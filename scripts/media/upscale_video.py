"""Local video restoration: Python + Real-ESRGAN NCNN/Vulkan + FFmpeg.

The original MP4 is never modified. Intermediate files are confined to this
project's source/video-upscale/render directory. Requires Pillow and the
official portable NCNN release in source/video-upscale/tools.
"""

from concurrent.futures import ThreadPoolExecutor
from fractions import Fraction
from pathlib import Path
import hashlib
import json
import subprocess
import time

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "public/media/f83d333f18dbd47b.mp4"
WORK = ROOT / "source/video-upscale/render"
INPUTS, UPSCALED, FINAL = [WORK / name for name in ("input", "upscaled", "1080")]
TOOL = ROOT / "source/video-upscale/tools/realesrgan-20220424"
OUTPUT = ROOT / "public/media/venue-ai-1080.mp4"
BLEND = 0.75


def run(args, **kwargs):
    return subprocess.run([str(a) for a in args], check=True, **kwargs)


def probe(path):
    return json.loads(
        subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)]
        )
    )


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def status(phase, count, total, started):
    info = {
        "phase": phase,
        "framesCompleted": count,
        "totalFrames": total,
        "elapsedSeconds": round(time.monotonic() - started, 1),
    }
    (WORK / "progress.json").write_text(json.dumps(info, indent=2), encoding="utf-8")
    print(json.dumps(info), flush=True)


def finish_frame(path):
    """Reconstruct at 4x, then downsample and blend with actual source detail."""
    destination = FINAL / path.name
    with Image.open(path) as image:
        image.load()
        restored = image.convert("RGB").resize((1080, 1920), Image.Resampling.LANCZOS)
    source_path = INPUTS / path.name
    with Image.open(source_path) as image:
        original = image.convert("RGB").resize((1080, 1920), Image.Resampling.LANCZOS)
    staging = destination.with_suffix(".tmp")
    Image.blend(original, restored, BLEND).save(staging, format="PNG", compress_level=1)
    staging.replace(destination)
    # Delete only consumed, generated frames in the verified working directory.
    for temporary in (path, source_path):
        if not temporary.resolve().is_relative_to(WORK.resolve()):
            raise ValueError("Intermediate path escaped the working directory")
        temporary.unlink()
    return destination.name


def main():
    started = time.monotonic()
    for directory in (INPUTS, UPSCALED, FINAL):
        directory.mkdir(parents=True, exist_ok=True)
    source_hash = sha256(SOURCE)
    metadata = probe(SOURCE)
    video = next(s for s in metadata["streams"] if s["codec_type"] == "video")
    total = int(video["nb_frames"])
    rate = video["avg_frame_rate"]
    if Fraction(rate) != Fraction(video["r_frame_rate"]):
        raise ValueError("This pipeline requires a constant-frame-rate source")
    if (video["width"], video["height"]) != (720, 1280):
        raise ValueError("Unexpected source dimensions")
    marker = WORK / "decoded.json"
    if marker.exists() and json.loads(marker.read_text())["sourceSha256"] != source_hash:
        raise ValueError("Source differs from the resumable intermediate files")
    if not marker.exists():
        status("decode", 0, total, started)
        run(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                SOURCE,
                "-map",
                "0:v:0",
                "-fps_mode",
                "passthrough",
                "-compression_level",
                "1",
                INPUTS / "%07d.png",
            ]
        )
        if len(list(INPUTS.glob("*.png"))) != total:
            raise ValueError("Decoded frame count differs from source")
        marker.write_text(json.dumps({"sourceSha256": source_hash, "frames": total}))

    completed = len(list(FINAL.glob("*.png")))
    if completed < total:
        status("neural-restoration", completed, total, started)
        args = [
            TOOL / "realesrgan-ncnn-vulkan.exe",
            "-i",
            INPUTS,
            "-o",
            UPSCALED,
            "-m",
            TOOL / "models",
            "-n",
            "realesrgan-x4plus",
            "-s",
            "4",
            "-g",
            "0",
            "-t",
            "256",
            "-j",
            "2:1:4",
            "-f",
            "png",
        ]
        with (WORK / "ncnn.log").open("w") as log, ThreadPoolExecutor(max_workers=2) as pool:
            process = subprocess.Popen([str(a) for a in args], stdout=log, stderr=subprocess.STDOUT)
            pending = {}
            last_report = time.monotonic()
            try:
                while process.poll() is None or pending or any(UPSCALED.glob("*.png")):
                    for path in UPSCALED.glob("*.png"):
                        if path not in pending and time.time() - path.stat().st_mtime > 0.75:
                            pending[path] = pool.submit(finish_frame, path)
                    for path, future in list(pending.items()):
                        if future.done():
                            future.result()
                            del pending[path]
                            completed += 1
                    if time.monotonic() - last_report >= 20:
                        status("neural-restoration", completed, total, started)
                        last_report = time.monotonic()
                    if process.poll() not in (None, 0):
                        raise RuntimeError(f"NCNN failed with code {process.returncode}; see ncnn.log")
                    time.sleep(0.2)
                if process.wait() != 0:
                    raise RuntimeError("NCNN did not finish successfully")
            except BaseException:
                process.terminate()
                process.wait()
                raise
    names = [FINAL / f"{index:07d}.png" for index in range(1, total + 1)]
    if not all(path.is_file() for path in names):
        raise ValueError("Restored frame sequence has missing frames")

    status("encode", total, total, started)
    pts_offset = round(float(video.get("start_time", "0")) * 90000)
    run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-framerate",
            rate,
            "-start_number",
            "1",
            "-i",
            FINAL / "%07d.png",
            "-i",
            SOURCE,
            "-map",
            "0:v:0",
            "-map",
            "1:a?",
            "-c:v",
            "libx264",
            "-preset",
            "slow",
            "-profile:v",
            "high",
            "-level:v",
            "4.1",
            "-refs",
            "3",
            "-crf",
            "17",
            "-vf",
            f"settb=1/90000,setpts=PTS+{pts_offset},scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709",
            "-colorspace",
            "bt709",
            "-color_primaries",
            "bt709",
            "-color_trc",
            "bt709",
            "-color_range",
            "tv",
            "-enc_time_base",
            "1:90000",
            "-fps_mode",
            "passthrough",
            "-video_track_timescale",
            "90000",
            "-c:a",
            "copy",
            "-movflags",
            "+faststart",
            OUTPUT,
        ]
    )
    output_info = probe(OUTPUT)
    output_video = next(s for s in output_info["streams"] if s["codec_type"] == "video")
    assert (output_video["width"], output_video["height"]) == (1080, 1920)
    assert int(output_video["nb_frames"]) == total
    assert Fraction(output_video["avg_frame_rate"]) == Fraction(rate)
    assert sha256(SOURCE) == source_hash
    run(["ffmpeg", "-hide_banner", "-v", "error", "-xerror", "-i", OUTPUT, "-f", "null", "-"])
    run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-ss",
            "5",
            "-i",
            OUTPUT,
            "-frames:v",
            "1",
            "-c:v",
            "libwebp",
            "-quality",
            "94",
            ROOT / "public/media/venue-ai-1080-poster.webp",
        ]
    )
    report = {
        "source": str(SOURCE.relative_to(ROOT)),
        "sourceSha256": source_hash,
        "output": str(OUTPUT.relative_to(ROOT)),
        "outputSha256": sha256(OUTPUT),
        "sourceResolution": [720, 1280],
        "outputResolution": [1080, 1920],
        "frames": total,
        "fps": rate,
        "outputBytes": OUTPUT.stat().st_size,
        "outputDuration": output_info["format"]["duration"],
        "method": "Real-ESRGAN x4plus via NCNN/Vulkan on local AMD GPU; Lanczos to 1080p; 75% restoration + 25% source blend; H.264 CRF17; original audio copied.",
        "neuralModelSource": "https://github.com/xinntao/Real-ESRGAN",
        "portableRelease": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip",
        "modelSha256": sha256(TOOL / "models/realesrgan-x4plus.bin"),
        "limitations": "Frame-wise learned restoration, not recovered native 1080p detail. Fine texture can be inferred or smoothed. No frame interpolation or face-specific synthesis.",
        "elapsedSeconds": round(time.monotonic() - started, 1),
        "totalWallTimeSeconds": round(time.time() - marker.stat().st_mtime, 1),
        "sourceVideoStart": video.get("start_time"),
        "outputVideoStart": output_video.get("start_time"),
        "outputColorSpace": output_video.get("color_space"),
    }
    (ROOT / "source/video-upscale/report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    status("complete", total, total, started)
    print(json.dumps(report, indent=2), flush=True)


if __name__ == "__main__":
    main()
