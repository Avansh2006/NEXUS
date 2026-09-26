"""
NEXUS Visual Identity Search - Model Download & Cache Utility

Downloads pretrained weights for SCRFD-10G (Face Detector) and AdaFace IR-101 (Face Recognition)
and caches them locally for 100% offline inference.
"""

import hashlib
import os
import shutil
import subprocess
import sys
from pathlib import Path

MODELS_DIR = Path(os.getenv("NEXUS_MODEL_DIR", str(Path(__file__).resolve().parent / "models")))

MODELS = {
    "det_10g.onnx": {
        "url": "https://github.com/yakhyo/adaface-onnx/releases/download/weights/det_10g.onnx",
        "description": "SCRFD-10G Face Detector (ONNX)",
        "min_size": 16_000_000,
        "sha256": "5838f7fe053675b1c7a08b633df49e7af5495cee0493c7dcf6697200b85b5b91",
    },
    "adaface_ir_101.onnx": {
        "url": "https://github.com/yakhyo/adaface-onnx/releases/download/weights/adaface_ir_101.onnx",
        "description": "AdaFace IR-101 WebFace12M Face Recognizer (ONNX)",
        "min_size": 250_000_000,
        "sha256": "f2eb07d03de0af560a82e1214df799fec5e09375d43521e2868f9dc387e5a43e",
    },
}


def verify_checksum(file_path: Path, expected_sha256: str) -> bool:
    if not file_path.exists():
        return False
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest().lower() == expected_sha256.lower()


def download_file(url: str, dest: Path, expected_sha256: str) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    temp_dest = dest.with_suffix(".tmp")
    print(f"Downloading {dest.name} from {url}...")

    # Check for curl executable across platforms
    curl_bin = shutil.which("curl") or shutil.which("curl.exe")
    if curl_bin:
        try:
            subprocess.run(
                [curl_bin, "-L", "-f", "-o", str(temp_dest), url],
                check=True,
                capture_output=True,
                text=True,
            )
            if temp_dest.exists() and temp_dest.stat().st_size > 1000:
                if verify_checksum(temp_dest, expected_sha256):
                    temp_dest.replace(dest)
                    print(f"Successfully downloaded and verified {dest.name} ({dest.stat().st_size / (1024*1024):.1f} MB)")
                    return True
                else:
                    print(f"Checksum mismatch for {dest.name} after curl download.")
        except Exception as e:
            print(f"curl download failed: {e}")

    # Fallback to urllib
    try:
        import urllib.request
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (NEXUS Model Downloader)"})
        with urllib.request.urlopen(req) as resp, open(temp_dest, "wb") as f:
            while chunk := resp.read(1024 * 1024):
                f.write(chunk)
        if temp_dest.exists() and temp_dest.stat().st_size > 1000:
            if verify_checksum(temp_dest, expected_sha256):
                temp_dest.replace(dest)
                print(f"Successfully downloaded and verified {dest.name} ({dest.stat().st_size / (1024*1024):.1f} MB)")
                return True
            else:
                print(f"Checksum mismatch for {dest.name} after urllib download.")
                if temp_dest.exists():
                    temp_dest.unlink()
                return False
    except Exception as e:
        print(f"urllib download failed: {e}")
        if temp_dest.exists():
            temp_dest.unlink()
        return False
    return False


def ensure_models() -> bool:
    all_ready = True
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    low_mem = os.getenv("NEXUS_LOW_MEMORY", "false").lower() in ("true", "1", "yes")
    for filename, info in MODELS.items():
        if low_mem and filename == "adaface_ir_101.onnx":
            print(f"[NEXUS] NEXUS_LOW_MEMORY active: Skipping 250MB {filename} to stay within 512MB RAM bounds.")
            continue
        dest = MODELS_DIR / filename
        if dest.exists() and dest.stat().st_size >= info["min_size"]:
            if verify_checksum(dest, info["sha256"]):
                print(f"Model already present and verified: {filename} ({dest.stat().st_size / (1024*1024):.1f} MB, SHA-256 match)")
                continue
            else:
                print(f"Corrupt or incomplete model file detected for {filename}. Re-downloading...")
        print(f"Fetching {info['description']}...")
        if not download_file(info["url"], dest, info["sha256"]):
            all_ready = False
            print(f"ERROR: Could not download and verify {filename}")
    return all_ready


if __name__ == "__main__":
    success = ensure_models()
    if not success:
        sys.exit(1)
    print("All vision models ready for local offline inference.")
