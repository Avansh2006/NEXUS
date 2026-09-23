"""
NEXUS Visual Identity Search - Model Download & Cache Utility

Downloads pretrained weights for SCRFD-10G (Face Detector) and AdaFace IR-101 (Face Recognition)
and caches them locally for 100% offline inference.
"""

import os
import sys
import subprocess
from pathlib import Path

MODELS_DIR = Path(__file__).resolve().parent / "models"

MODELS = {
    "det_10g.onnx": {
        "url": "https://github.com/yakhyo/adaface-onnx/releases/download/weights/det_10g.onnx",
        "description": "SCRFD-10G Face Detector (ONNX)",
        "min_size": 16_000_000,
    },
    "adaface_ir_101.onnx": {
        "url": "https://github.com/yakhyo/adaface-onnx/releases/download/weights/adaface_ir_101.onnx",
        "description": "AdaFace IR-101 WebFace12M Face Recognizer (ONNX)",
        "min_size": 250_000_000,
    },
}


def download_file(url: str, dest: Path) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    temp_dest = dest.with_suffix(".tmp")
    print(f"Downloading {dest.name} from {url}...")
    try:
        # Use curl if available for fast and reliable resume/redirect support
        res = subprocess.run(
            ["curl.exe", "-L", "-o", str(temp_dest), url],
            check=True,
            capture_output=True,
            text=True,
        )
        if temp_dest.exists() and temp_dest.stat().st_size > 1000:
            temp_dest.replace(dest)
            print(f"Successfully downloaded {dest.name} ({dest.stat().st_size / (1024*1024):.1f} MB)")
            return True
    except Exception as e:
        print(f"curl download failed: {e}")

    # Fallback to urllib
    try:
        import urllib.request
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as resp, open(temp_dest, "wb") as f:
            while chunk := resp.read(1024 * 1024):
                f.write(chunk)
        if temp_dest.exists() and temp_dest.stat().st_size > 1000:
            temp_dest.replace(dest)
            print(f"Successfully downloaded {dest.name} ({dest.stat().st_size / (1024*1024):.1f} MB)")
            return True
    except Exception as e:
        print(f"urllib download failed: {e}")
        if temp_dest.exists():
            temp_dest.unlink()
        return False
    return False


def ensure_models() -> bool:
    all_ready = True
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    for filename, info in MODELS.items():
        dest = MODELS_DIR / filename
        if dest.exists() and dest.stat().st_size >= info["min_size"]:
            print(f"Model already present: {filename} ({dest.stat().st_size / (1024*1024):.1f} MB)")
            continue
        print(f"Fetching {info['description']}...")
        if not download_file(info["url"], dest):
            all_ready = False
            print(f"ERROR: Could not download {filename}")
    return all_ready


if __name__ == "__main__":
    success = ensure_models()
    if not success:
        sys.exit(1)
    print("All vision models ready for local offline inference.")
