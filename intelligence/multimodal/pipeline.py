import base64
from typing import Dict, Any, List, Optional
from .ocr import DocumentOcrEngine
from .audio import AudioIntelligenceEngine
from .visual import VisualEvidenceEngine

class MultimodalPipeline:
    """
    Unified Multimodal Evidence Fusion Pipeline for NEXUS:
    1. Document OCR & Entity Extraction (PaddleOCR PP-OCRv5 for en, hi, mr)
    2. Audio Transcription & Diarization (faster-whisper small int8 + pyannote)
    3. Visual Evidence Search & CCTV Frame Sampling (OpenCLIP ViT-B-32)
    """

    def __init__(self):
        self.ocr_engine = DocumentOcrEngine()
        self.audio_engine = AudioIntelligenceEngine()
        self.visual_engine = VisualEvidenceEngine()

    def get_status(self) -> Dict[str, Any]:
        return {
            "status": "ok",
            "ocr": self.ocr_engine.get_status(),
            "audio": self.audio_engine.get_status(),
            "visual": self.visual_engine.get_status(),
        }

    def process_document(self, file_bytes: bytes, filename: str, asset_id: str = "") -> Dict[str, Any]:
        return self.ocr_engine.process_document(file_bytes, filename, asset_id)

    def process_audio(self, audio_bytes: bytes, filename: str, asset_id: str = "") -> Dict[str, Any]:
        return self.audio_engine.process_audio(audio_bytes, filename, asset_id)

    def process_visual(
        self,
        file_bytes: bytes,
        filename: str,
        media_type: str = "IMAGE",
        asset_id: str = "",
        case_id: str = ""
    ) -> Dict[str, Any]:
        return self.visual_engine.process_visual_asset(file_bytes, filename, media_type, asset_id, case_id)

    def search_visual(
        self,
        query_embedding: List[float],
        gallery_items: List[Dict[str, Any]],
        threshold: float = 0.50,
        top_k: int = 15
    ) -> List[Dict[str, Any]]:
        return self.visual_engine.search_similar(query_embedding, gallery_items, threshold, top_k)
