import logging
from dataclasses import dataclass
from typing import List, Optional, Tuple, Dict, Any
import cv2
import numpy as np

from .models_manager import get_detector_path, create_session

logger = logging.getLogger("nexus.vision.detector")


@dataclass
class FaceDetection:
    bbox: Tuple[float, float, float, float]  # x1, y1, x2, y2
    score: float
    landmarks: np.ndarray  # (5, 2)
    quality: Dict[str, Any]


def compute_face_quality(face_crop: np.ndarray) -> Dict[str, Any]:
    """
    Computes quality metrics on a cropped face for CCTV / surveillance assessment.
    """
    if face_crop.size == 0:
        return {
            "sharpness": 0.0,
            "brightness": 0.0,
            "contrast": 0.0,
            "face_width": 0,
            "face_height": 0,
            "usable": False,
            "overall_quality": 0.0,
        }

    gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY) if len(face_crop.shape) == 3 else face_crop
    h, w = gray.shape[:2]

    # Blur estimation via Laplacian variance
    lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    # Brightness (mean) and contrast (std)
    mean_val = float(np.mean(gray))
    std_val = float(np.std(gray))

    # Calibrate an overall quality score in [0.0, 1.0]
    # Penalize low resolution (<30px), heavy blur (<20 var), extreme darkness/overexposure
    res_factor = min(1.0, max(0.0, (min(w, h) - 20) / 80.0))
    sharp_factor = min(1.0, max(0.0, lap_var / 150.0))
    illum_factor = 1.0 - min(1.0, abs(mean_val - 128.0) / 110.0)

    overall = float(0.4 * res_factor + 0.4 * sharp_factor + 0.2 * illum_factor)
    usable = (min(w, h) >= 20) and (overall >= 0.15)

    return {
        "sharpness": round(lap_var, 2),
        "brightness": round(mean_val, 2),
        "contrast": round(std_val, 2),
        "face_width": int(w),
        "face_height": int(h),
        "usable": bool(usable),
        "overall_quality": round(overall, 3),
    }


def distance2bbox(points: np.ndarray, distance: np.ndarray, max_shape: Optional[Tuple[int, int]] = None) -> np.ndarray:
    x1 = points[:, 0] - distance[:, 0]
    y1 = points[:, 1] - distance[:, 1]
    x2 = points[:, 0] + distance[:, 2]
    y2 = points[:, 1] + distance[:, 3]
    if max_shape is not None:
        x1 = np.clip(x1, 0, max_shape[1])
        y1 = np.clip(y1, 0, max_shape[0])
        x2 = np.clip(x2, 0, max_shape[1])
        y2 = np.clip(y2, 0, max_shape[0])
    return np.stack([x1, y1, x2, y2], axis=-1)


def distance2kps(points: np.ndarray, distance: np.ndarray, max_shape: Optional[Tuple[int, int]] = None) -> np.ndarray:
    preds = []
    for i in range(0, distance.shape[1], 2):
        px = points[:, i % 2] + distance[:, i]
        py = points[:, i % 2 + 1] + distance[:, i + 1]
        if max_shape is not None:
            px = np.clip(px, 0, max_shape[1])
            py = np.clip(py, 0, max_shape[0])
        preds.append(px)
        preds.append(py)
    return np.stack(preds, axis=-1)


def nms(detections: np.ndarray, iou_thresh: float = 0.4) -> List[int]:
    if len(detections) == 0:
        return []
    x1 = detections[:, 0]
    y1 = detections[:, 1]
    x2 = detections[:, 2]
    y2 = detections[:, 3]
    scores = detections[:, 4]

    areas = (x2 - x1 + 1) * (y2 - y1 + 1)
    order = scores.argsort()[::-1]

    keep = []
    while order.size > 0:
        i = order[0]
        keep.append(i)
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])

        w = np.maximum(0.0, xx2 - xx1 + 1)
        h = np.maximum(0.0, yy2 - yy1 + 1)
        inter = w * h
        ovr = inter / (areas[i] + areas[order[1:]] - inter)

        inds = np.where(ovr <= iou_thresh)[0]
        order = order[inds + 1]
    return keep


class SCRFDDetector:
    def __init__(self, model_path: Optional[str] = None):
        self.session = None
        self.input_size = (640, 640)
        self.mean = 127.5
        self.std = 128.0
        self.feat_strides = [8, 16, 32]
        self.num_anchors = 2
        self.anchor_cache: Dict[Tuple[int, int, int], np.ndarray] = {}
        self.model_path = model_path
        self._initialized = False

    def _ensure_session(self):
        if not self._initialized:
            self._initialized = True
            path = self.model_path or get_detector_path()
            if path is not None:
                try:
                    self.session = create_session(path)
                    self.input_name = self.session.get_inputs()[0].name
                    self.output_names = [o.name for o in self.session.get_outputs()]
                    logger.info(f"SCRFD face detector loaded from {path}")
                except Exception as e:
                    logger.warning(f"Failed to initialize SCRFD detector: {e}")
                    self.session = None

    def is_available(self) -> bool:
        self._ensure_session()
        return self.session is not None

    def detect(self, image: np.ndarray, conf_threshold: float = 0.5, iou_threshold: float = 0.4) -> List[FaceDetection]:
        if not self.is_available():
            return []

        orig_h, orig_w = image.shape[:2]
        target_w, target_h = self.input_size

        # Maintain aspect ratio resize and pad
        im_ratio = float(orig_h) / float(orig_w)
        model_ratio = float(target_h) / float(target_w)
        if im_ratio > model_ratio:
            new_h = target_h
            new_w = int(new_h / im_ratio)
        else:
            new_w = target_w
            new_h = int(new_w * im_ratio)

        scale = float(new_h) / float(orig_h)
        resized = cv2.resize(image, (new_w, new_h))
        padded = np.zeros((target_h, target_w, 3), dtype=np.uint8)
        padded[:new_h, :new_w, :] = resized

        blob = cv2.dnn.blobFromImage(
            padded, 1.0 / self.std, (target_w, target_h), (self.mean, self.mean, self.mean), swapRB=True
        )

        outputs = self.session.run(self.output_names, {self.input_name: blob})

        scores_list = []
        bboxes_list = []
        kps_list = []

        num_fmc = len(self.feat_strides)
        for idx, stride in enumerate(self.feat_strides):
            scores = outputs[idx]
            bbox_preds = outputs[idx + num_fmc] * stride
            kps_preds = outputs[idx + num_fmc * 2] * stride

            h = target_h // stride
            w = target_w // stride
            cache_key = (h, w, stride)
            if cache_key in self.anchor_cache:
                anchor_centers = self.anchor_cache[cache_key]
            else:
                anchor_centers = np.stack(np.mgrid[:h, :w][::-1], axis=-1).astype(np.float32)
                anchor_centers = (anchor_centers * stride).reshape((-1, 2))
                if self.num_anchors > 1:
                    anchor_centers = np.stack([anchor_centers] * self.num_anchors, axis=1).reshape((-1, 2))
                self.anchor_cache[cache_key] = anchor_centers

            pos_inds = np.where(scores >= conf_threshold)[0]
            if len(pos_inds) == 0:
                continue

            bboxes = distance2bbox(anchor_centers, bbox_preds)
            kps = distance2kps(anchor_centers, kps_preds).reshape((-1, 5, 2))

            scores_list.append(scores[pos_inds])
            bboxes_list.append(bboxes[pos_inds])
            kps_list.append(kps[pos_inds])

        if not scores_list:
            return []

        all_scores = np.vstack(scores_list)
        all_bboxes = np.vstack(bboxes_list) / scale
        all_kps = np.vstack(kps_list) / scale

        # Clip boxes to original dimensions
        all_bboxes[:, 0] = np.clip(all_bboxes[:, 0], 0, orig_w)
        all_bboxes[:, 1] = np.clip(all_bboxes[:, 1], 0, orig_h)
        all_bboxes[:, 2] = np.clip(all_bboxes[:, 2], 0, orig_w)
        all_bboxes[:, 3] = np.clip(all_bboxes[:, 3], 0, orig_h)

        detections = np.hstack((all_bboxes, all_scores)).astype(np.float32)
        order = all_scores.ravel().argsort()[::-1]
        detections = detections[order]
        all_kps = all_kps[order]

        keep = nms(detections, iou_thresh=iou_threshold)
        detections = detections[keep]
        all_kps = all_kps[keep]

        results = []
        for i in range(len(detections)):
            x1, y1, x2, y2, sc = detections[i]
            box = (float(x1), float(y1), float(x2), float(y2))
            kps = all_kps[i]

            # Crop face for quality assessment
            crop_x1, crop_y1 = max(0, int(x1)), max(0, int(y1))
            crop_x2, crop_y2 = min(orig_w, int(x2)), min(orig_h, int(y2))
            crop = image[crop_y1:crop_y2, crop_x1:crop_x2]
            quality = compute_face_quality(crop)

            results.append(
                FaceDetection(
                    bbox=box,
                    score=float(sc),
                    landmarks=kps,
                    quality=quality,
                )
            )

        return results
