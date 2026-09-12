"""Verify the restored hero video against its source and record the result.

Checks resolution, frame count, frame rate, start time, colour metadata,
duration and that the audio packets are bit-identical to the original, then
writes the verified metadata into the restoration manifests.
"""

from pathlib import Path
from fractions import Fraction
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "public/media/f83d333f18dbd47b.mp4"
OUTPUT = ROOT / "public/media/venue-ai-1080.mp4"


def read(path):
    return (ROOT / path).read_text(encoding="utf-8-sig")


def write(path, text):
    (ROOT / path).write_text(text, encoding="utf-8")


def probe(path):
    return json.loads(
        subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)]
        )
    )


def audio_hash(path):
    return (
        subprocess.check_output(
            [
                "ffmpeg",
                "-v",
                "error",
                "-i",
                str(path),
                "-map",
                "0:a:0",
                "-c",
                "copy",
                "-f",
                "hash",
                "-hash",
                "sha256",
                "-",
            ]
        )
        .decode()
        .strip()
    )


def main():
    report = json.loads(read("source/video-upscale/report.json"))
    original, restored = probe(SOURCE), probe(OUTPUT)
    a = next(s for s in original["streams"] if s["codec_type"] == "video")
    b = next(s for s in restored["streams"] if s["codec_type"] == "video")
    assert [b["width"], b["height"]] == [1080, 1920]
    assert int(a["nb_frames"]) == int(b["nb_frames"]) == 744
    assert Fraction(a["avg_frame_rate"]) == Fraction(b["avg_frame_rate"]) == 30
    assert abs(float(a["start_time"]) - float(b["start_time"])) < 0.001
    assert b["color_space"] == b["color_transfer"] == b["color_primaries"] == "bt709"
    assert abs(float(original["format"]["duration"]) - float(restored["format"]["duration"])) < 0.03
    assert audio_hash(SOURCE) == audio_hash(OUTPUT)
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == report["sourceSha256"]
    assert hashlib.sha256(OUTPUT.read_bytes()).hexdigest() == report["outputSha256"]
    report["audioPacketsUnchanged"] = True
    report["timingAndColorVerified"] = True
    write("source/video-upscale/report.json", json.dumps(report, ensure_ascii=False, indent=2) + "\n")

    for path in ["public/data/media-restorations.json", "source/restoration-manifest.json"]:
        if not (ROOT / path).exists():
            continue
        data = json.loads(read(path))
        data["video"].update(
            used="/media/venue-ai-1080.mp4",
            resolution=[1080, 1920],
            durationSeconds=float(restored["format"]["duration"]),
            bytes=OUTPUT.stat().st_size,
            original="/media/f83d333f18dbd47b.mp4",
            originalResolution=[720, 1280],
            upscaleStatus="Completed locally: Python + Real-ESRGAN x4plus NCNN/Vulkan + FFmpeg. 75% restored / 25% original blend, 1080x1920, 30 fps, original audio preserved.",
            methodReport="source/video-upscale/report.json",
        )
        write(path, json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print(
        json.dumps(
            {
                "verified": True,
                "frames": 744,
                "resolution": [1080, 1920],
                "audioUnchanged": True,
                "bytes": OUTPUT.stat().st_size,
            }
        )
    )


if __name__ == "__main__":
    main()
