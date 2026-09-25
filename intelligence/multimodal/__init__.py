"""
NEXUS Multimodal Evidence Fusion Module
Provides OCR (PaddleOCR PP-OCRv5), Audio Transcription (faster-whisper + pyannote diarization),
and Visual Evidence Search (OpenCLIP ViT-B-32) with graceful local/CPU fallbacks.
"""

from .pipeline import MultimodalPipeline

__all__ = ["MultimodalPipeline"]
