import base64
import hashlib
import io
import logging
from typing import Dict, Any, List, Optional, Tuple
import cv2
import numpy as np
from PIL import Image

from .detector import SCRFDDetector, FaceDetection, compute_face_quality
from .alignment import align_face
from .recognizer import AdaFaceRecognizer

logger = logging.getLogger("nexus.vision.pipeline")

MAX_IMAGE_DIM = 4096
MIN_IMAGE_DIM = 16
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


class VisionPipeline:
    def __init__(self, detector: Optional[SCRFDDetector] = None, recognizer: Optional[AdaFaceRecognizer] = None):
        self.detector = detector or SCRFDDetector()
        self.recognizer = recognizer or AdaFaceRecognizer()

    def get_status(self) -> Dict[str, Any]:
        return {
            "detector": "SCRFD-10G" if self.detector.is_available() else "unavailable",
            "detector_available": self.detector.is_available(),
            "recognizer": self.recognizer.model_name if self.recognizer.is_available() else "unavailable",
            "recognizer_version": self.recognizer.model_version,
            "recognizer_available": self.recognizer.is_available(),
            "embedding_dimension": 512,
            "metric": "cosine_similarity",
        }

    @staticmethod
    def decode_image_bytes(image_bytes: bytes) -> np.ndarray:
        if not image_bytes:
            raise ValueError("Empty image payload")
        if len(image_bytes) > MAX_FILE_SIZE:
            raise ValueError(f"Image exceeds size limit of {MAX_FILE_SIZE // (1024*1024)} MiB")

        # Verify safe image headers with PIL first
        try:
            with Image.open(io.BytesIO(image_bytes)) as pil_img:
                fmt = (pil_img.format or "").upper()
                if fmt not in ("JPEG", "JPG", "PNG", "WEBP", "BMP"):
                    raise ValueError(f"Unsupported image format: {fmt}. Allowed formats: JPEG, PNG, WEBP")
                w, h = pil_img.size
                if w < MIN_IMAGE_DIM or h < MIN_IMAGE_DIM:
                    raise ValueError(f"Image dimensions ({w}x{h}) below minimum required {MIN_IMAGE_DIM}x{MIN_IMAGE_DIM}")
                if w > MAX_IMAGE_DIM or h > MAX_IMAGE_DIM:
                    raise ValueError(f"Image dimensions ({w}x{h}) exceed maximum {MAX_IMAGE_DIM}x{MAX_IMAGE_DIM}")
        except ValueError:
            raise
        except Exception as e:
            raise ValueError(f"Malformed or unreadable image file: {e}")

        # Decode using OpenCV
        arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Failed to decode image data into RGB matrix")
        return img

    @staticmethod
    def compute_sha256(data: bytes) -> str:
        return hashlib.sha256(data).hexdigest()

    @staticmethod
    def crop_to_data_url(image_bgr: np.ndarray, quality: int = 85) -> str:
        success, buf = cv2.imencode(".jpg", image_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
        if not success:
            return ""
        b64 = base64.b64encode(buf).decode("ascii")
        return f"data:image/jpeg;base64,{b64}"

    def detect(self, image_bgr: np.ndarray, conf_threshold: float = 0.5) -> List[FaceDetection]:
        return self.detector.detect(image_bgr, conf_threshold=conf_threshold)

    def extract_face(
        self,
        image_bgr: np.ndarray,
        face_index: Optional[int] = None,
        require_single: bool = False,
        conf_threshold: float = 0.5,
    ) -> Tuple[FaceDetection, np.ndarray]:
        """
        Detects and returns (FaceDetection, aligned_112x112_bgr).
        """
        detections = self.detect(image_bgr, conf_threshold=conf_threshold)
        if not detections:
            raise ValueError("NO_FACE_DETECTED: No face detected in image")

        if require_single and len(detections) > 1:
            raise ValueError(f"MULTIPLE_FACES: {len(detections)} faces detected in image; single face required")

        if face_index is not None:
            if face_index < 0 or face_index >= len(detections):
                raise ValueError(f"Invalid face index {face_index}; {len(detections)} faces found")
            chosen = detections[face_index]
        else:
            # Default to largest face
            chosen = max(detections, key=lambda d: (d.bbox[2] - d.bbox[0]) * (d.bbox[3] - d.bbox[1]))

        aligned = align_face(image_bgr, chosen.landmarks, crop_size=112)
        return chosen, aligned

    def embed_aligned(self, aligned_bgr: np.ndarray) -> List[float]:
        return self.recognizer.embed(aligned_bgr)

    def process_for_enrollment(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        Validates, detects single face, aligns, and generates embedding for face enrollment.
        """
        img = self.decode_image_bytes(image_bytes)
        img_hash = self.compute_sha256(image_bytes)
        detection, aligned = self.extract_face(img, require_single=True)

        if not detection.quality.get("usable", True):
            raise ValueError("LOW_QUALITY: Detected face resolution or quality is too low for enrollment")

        embedding = self.embed_aligned(aligned)
        thumbnail = self.crop_to_data_url(aligned)

        x1, y1, x2, y2 = detection.bbox
        return {
            "image_hash": img_hash,
            "embedding": embedding,
            "model_name": self.recognizer.model_name,
            "model_version": self.recognizer.model_version,
            "quality": detection.quality,
            "score": round(float(detection.score), 4),
            "bbox": {"x": int(x1), "y": int(y1), "width": int(x2 - x1), "height": int(y2 - y1)},
            "thumbnail": thumbnail,
        }

    def process_for_search(
        self,
        image_bytes: bytes,
        selected_face_index: Optional[int] = None,
        conf_threshold: float = 0.45,
    ) -> Dict[str, Any]:
        """
        Detects faces in search image (e.g. CCTV), extracts embedding for selected face,
        and returns face candidates metadata.
        """
        img = self.decode_image_bytes(image_bytes)
        img_hash = self.compute_sha256(image_bytes)
        detections = self.detect(img, conf_threshold=conf_threshold)

        if not detections:
            return {
                "status": "NO_FACE_DETECTED",
                "faces_detected": 0,
                "image_hash": img_hash,
                "faces": [],
                "embedding": None,
            }

        faces_meta = []
        for i, d in enumerate(detections):
            x1, y1, x2, y2 = d.bbox
            crop_x1, crop_y1 = max(0, int(x1)), max(0, int(y1))
            crop_x2, crop_y2 = min(img.shape[1], int(x2)), min(img.shape[0], int(y2))
            crop = img[crop_y1:crop_y2, crop_x1:crop_x2]
            thumb = self.crop_to_data_url(crop, quality=80)
            faces_meta.append(
                {
                    "face_index": i,
                    "bbox": {"x": int(x1), "y": int(y1), "width": int(x2 - x1), "height": int(y2 - y1)},
                    "score": round(float(d.score), 4),
                    "quality": d.quality,
                    "thumbnail": thumb,
                }
            )

        if len(detections) > 1 and selected_face_index is None:
            return {
                "status": "MULTIPLE_FACES",
                "faces_detected": len(detections),
                "image_hash": img_hash,
                "faces": faces_meta,
                "embedding": None,
            }

        idx = selected_face_index if selected_face_index is not None else 0
        if idx < 0 or idx >= len(detections):
            idx = 0
        chosen_detection = detections[idx]
        aligned = align_face(img, chosen_detection.landmarks, crop_size=112)
        embedding = self.embed_aligned(aligned)
        aligned_thumb = self.crop_to_data_url(aligned)

        return {
            "status": "FACE_EXTRACTED",
            "faces_detected": len(detections),
            "selected_face_index": idx,
            "image_hash": img_hash,
            "faces": faces_meta,
            "embedding": embedding,
            "aligned_thumbnail": aligned_thumb,
            "quality": chosen_detection.quality,
            "model_name": self.recognizer.model_name,
            "model_version": self.recognizer.model_version,
        }
