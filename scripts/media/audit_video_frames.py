"""Check the completed restoration for missing frames or severe luminance errors.

These checks detect obvious processing failures; they are not a perceptual
quality score and cannot establish that inferred detail is historically real.
"""

from pathlib import Path
import json
import subprocess
import numpy as np

ROOT = Path(__file__).resolve().parents[2]


def frames(path):
    raw = subprocess.check_output(
        [
            "ffmpeg",
            "-v",
            "error",
            "-i",
            str(path),
            "-map",
            "0:v:0",
            "-vf",
            "scale=64:64:flags=area,format=gray",
            "-fps_mode",
            "passthrough",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "gray",
            "-",
        ]
    )
    return np.frombuffer(raw, dtype=np.uint8).reshape(-1, 64, 64).astype(np.float32)


original = frames(ROOT / "public/media/f83d333f18dbd47b.mp4")
restored = frames(ROOT / "public/media/venue-ai-1080.mp4")
assert original.shape == restored.shape == (744, 64, 64)
a, b = original.mean(axis=(1, 2)), restored.mean(axis=(1, 2))
dark = np.flatnonzero((a > 8) & (b < a * 0.5)).tolist()
bright = np.flatnonzero((a < 110) & (b > a * 2 + 15)).tolist()
assert not dark and not bright, "Unexpected severe brightness change"
motion_a = np.abs(np.diff(original, axis=0)).mean(axis=(1, 2))
motion_b = np.abs(np.diff(restored, axis=0)).mean(axis=(1, 2))
report = {
    "framesCompared": len(a),
    "unexpectedDarkFrames": dark,
    "unexpectedBrightFrames": bright,
    "meanLuminanceDifference": round(float(np.mean(np.abs(a - b))), 3),
    "maximumMeanLuminanceDifference": round(float(np.max(np.abs(a - b))), 3),
    "meanFrameChangeSource": round(float(motion_a.mean()), 3),
    "meanFrameChangeRestored": round(float(motion_b.mean()), 3),
    "note": "Coarse alignment and luminance sanity check only. Does not certify absence of fine temporal artifacts or measure native-detail recovery.",
}
(ROOT / "source/video-upscale/frame-checks.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report, indent=2))
