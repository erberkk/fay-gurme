"""Locally restore every product photo that has not already been curated.

Uses the official Real-ESRGAN NCNN/Vulkan release already present in the local
workspace. No API, account, upload, or paid service is involved. Originals are
read from public/media and never modified.
"""

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image, ImageOps
import hashlib
import json
import subprocess
import time

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public"
MEDIA = PUBLIC / "media"
WORK = ROOT / "source/product-upscale"
INPUTS = WORK / "input"
UPSCALED = WORK / "upscaled"
TOOL = ROOT / "source/video-upscale/tools/realesrgan-20220424"
REPORT = WORK / "report.json"
MODEL = "realesrgan-x4plus"
AI_BLEND = 0.72
MAX_LONG_EDGE = 1400


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def target_size(width, height):
    long_edge = min(MAX_LONG_EDGE, max(width, height) * 4)
    scale = long_edge / max(width, height)
    return max(1, round(width * scale)), max(1, round(height * scale))


def prepare_input(product):
    source = PUBLIC / product["image"].lstrip("/")
    destination = INPUTS / f"{product['id']}.png"
    if destination.exists():
        return
    with Image.open(source) as raw:
        image = ImageOps.exif_transpose(raw).convert("RGB")
        # Very large inputs gain little from a 4x intermediate and cost heavily
        # in GPU memory. The untouched source is used again in the final blend.
        if max(image.size) > 1200:
            image.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
        image.save(destination, format="PNG", compress_level=1)


def finish_output(path, product):
    source = PUBLIC / product["image"].lstrip("/")
    destination = MEDIA / f"enhanced-{product['id']}.webp"
    with Image.open(source) as raw:
        original = ImageOps.exif_transpose(raw).convert("RGB")
        source_size = original.size
        size = target_size(*original.size)
        original = original.resize(size, Image.Resampling.LANCZOS)
    with Image.open(path) as raw:
        restored = raw.convert("RGB").resize(size, Image.Resampling.LANCZOS)
    result = Image.blend(original, restored, AI_BLEND)
    staging = destination.with_suffix(".tmp.webp")
    result.save(staging, format="WEBP", quality=88, method=6)
    staging.replace(destination)
    path.unlink()
    return {
        "id": product["id"],
        "name": product["name"],
        "original": product["image"],
        "restored": f"/media/{destination.name}",
        "originalSize": list(source_size),
        "restoredSize": list(size),
        "originalBytes": source.stat().st_size,
        "restoredBytes": destination.stat().st_size,
    }


def main():
    started = time.monotonic()
    for directory in (INPUTS, UPSCALED):
        directory.mkdir(parents=True, exist_ok=True)
    executable = TOOL / "realesrgan-ncnn-vulkan.exe"
    model_file = TOOL / "models/realesrgan-x4plus.bin"
    if not executable.is_file() or not model_file.is_file():
        raise FileNotFoundError("Local Real-ESRGAN NCNN tool or model is missing")

    menu = json.loads((PUBLIC / "data/menu.json").read_text(encoding="utf-8"))
    restoration = json.loads((PUBLIC / "data/media-restorations.json").read_text(encoding="utf-8"))
    curated_ids = {item["id"] for item in restoration["photos"]}
    candidates = [p for p in menu["products"] if p.get("image") and p["id"] not in curated_ids]
    pending = [p for p in candidates if not (MEDIA / f"enhanced-{p['id']}.webp").is_file()]
    by_id = {p["id"]: p for p in pending}
    print(
        json.dumps({"phase": "prepare", "candidates": len(candidates), "pending": len(pending)}), flush=True
    )
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(prepare_input, pending))

    records = []
    if pending:
        command = [
            executable,
            "-i",
            INPUTS,
            "-o",
            UPSCALED,
            "-m",
            TOOL / "models",
            "-n",
            MODEL,
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
        log_path = WORK / "ncnn.log"
        with log_path.open("w", encoding="utf-8") as log, ThreadPoolExecutor(max_workers=3) as pool:
            process = subprocess.Popen(
                [str(value) for value in command], stdout=log, stderr=subprocess.STDOUT
            )
            active = {}
            completed = 0
            last_report = 0.0
            while process.poll() is None or active or any(UPSCALED.glob("*.png")):
                for path in UPSCALED.glob("*.png"):
                    product_id = path.stem
                    if (
                        product_id in by_id
                        and path not in active
                        and time.time() - path.stat().st_mtime > 0.6
                    ):
                        active[path] = pool.submit(finish_output, path, by_id[product_id])
                for path, future in list(active.items()):
                    if future.done():
                        records.append(future.result())
                        del active[path]
                        completed += 1
                now = time.monotonic()
                if now - last_report >= 15:
                    print(
                        json.dumps(
                            {
                                "phase": "restore",
                                "completed": completed,
                                "total": len(pending),
                                "elapsedSeconds": round(now - started, 1),
                            }
                        ),
                        flush=True,
                    )
                    last_report = now
                if process.poll() not in (None, 0):
                    raise RuntimeError(f"Real-ESRGAN failed with code {process.returncode}; see {log_path}")
                time.sleep(0.2)
            if process.wait() != 0:
                raise RuntimeError("Real-ESRGAN did not finish successfully")

    expected = [MEDIA / f"enhanced-{p['id']}.webp" for p in candidates]
    missing = [path.name for path in expected if not path.is_file()]
    if missing:
        raise ValueError(f"Missing restored product images: {missing[:5]}")
    all_with_images = [p for p in menu["products"] if p.get("image")]
    report = {
        "completedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "products": len(menu["products"]),
        "productsWithSourcePhoto": len(all_with_images),
        "previouslyCurated": len(curated_ids),
        "locallyRestored": len(candidates),
        "productsWithoutSourcePhoto": [p["id"] for p in menu["products"] if not p.get("image")],
        "method": f"Real-ESRGAN x4plus NCNN/Vulkan; {round(AI_BLEND * 100)}% restoration and {round((1 - AI_BLEND) * 100)}% source blend; WebP quality 88; maximum long edge {MAX_LONG_EDGE}px.",
        "modelSha256": sha256(model_file),
        "sourceFilesModified": False,
        "elapsedSeconds": round(time.monotonic() - started, 1),
        "generatedBytes": sum(path.stat().st_size for path in expected),
        "recordsGeneratedThisRun": sorted(records, key=lambda item: int(item["id"])),
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {key: value for key, value in report.items() if key != "recordsGeneratedThisRun"},
            ensure_ascii=False,
            indent=2,
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
