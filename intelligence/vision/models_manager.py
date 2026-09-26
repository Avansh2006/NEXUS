import os
from pathlib import Path
from typing import Optional
import onnxruntime as ort

MODELS_DIR = Path(os.getenv("NEXUS_MODEL_DIR", str(Path(__file__).resolve().parents[1] / "models")))

SCRFD_MODEL_NAME = "det_10g.onnx"
ADAFACE_MODEL_NAME = "adaface_ir_101.onnx"


def get_detector_path() -> Optional[Path]:
    p = MODELS_DIR / SCRFD_MODEL_NAME
    if p.exists() and p.stat().st_size > 1000000:
        return p
    return None


def get_recognizer_path() -> Optional[Path]:
    if os.getenv("NEXUS_LOW_MEMORY", "false").lower() in ("true", "1", "yes"):
        return None
    p = MODELS_DIR / ADAFACE_MODEL_NAME
    if p.exists() and p.stat().st_size > 50000000:
        return p
    # Fallback to ir_50 or ir_18 if present
    for alt in ["adaface_ir_50.onnx", "adaface_ir_18.onnx"]:
        p_alt = MODELS_DIR / alt
        if p_alt.exists() and p_alt.stat().st_size > 10000000:
            return p_alt
    return None


def create_session(model_path: Path) -> ort.InferenceSession:
    # Use CPU execution provider with optimized thread counts
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = int(os.getenv("ORT_NUM_THREADS", "4"))
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    return ort.InferenceSession(str(model_path), sess_options=opts, providers=["CPUExecutionProvider"])
