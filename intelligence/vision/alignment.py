import cv2
import numpy as np

# Standard 5-point facial landmark reference for 112x112 canonical crop (AdaFace / ArcFace standard)
# Landmarks order: [left eye, right eye, nose tip, left mouth corner, right mouth corner]
REFERENCE_5PTS = np.array(
    [
        [38.2946, 51.6963],
        [73.5318, 51.5014],
        [56.0252, 71.7366],
        [41.5493, 92.3655],
        [70.7299, 92.2041],
    ],
    dtype=np.float32,
)


def align_face(image: np.ndarray, landmarks: np.ndarray, crop_size: int = 112) -> np.ndarray:
    """
    Align face to canonical crop using similarity transformation.
    
    Args:
        image: BGR image numpy array.
        landmarks: 5x2 facial landmarks array [[x, y], ...].
        crop_size: Output square image size (default 112).
    
    Returns:
        Aligned face image of shape (crop_size, crop_size, 3).
    """
    if landmarks.shape != (5, 2):
        raise ValueError(f"Expected 5x2 facial landmarks, got shape {landmarks.shape}")

    ref = REFERENCE_5PTS.copy()
    if crop_size != 112:
        scale = float(crop_size) / 112.0
        ref *= scale

    # Compute similarity transform (rotation + uniform scale + translation)
    # cv2.estimateAffinePartial2D computes optimal similarity transform without shear
    m, _ = cv2.estimateAffinePartial2D(landmarks.astype(np.float32), ref)
    if m is None:
        # Fallback if estimation fails: simple bounding box crop around landmarks
        x1 = max(0, int(np.min(landmarks[:, 0])) - 10)
        y1 = max(0, int(np.min(landmarks[:, 1])) - 10)
        x2 = min(image.shape[1], int(np.max(landmarks[:, 0])) + 10)
        y2 = min(image.shape[0], int(np.max(landmarks[:, 1])) + 10)
        crop = image[y1:y2, x1:x2]
        if crop.size == 0:
            return cv2.resize(image, (crop_size, crop_size))
        return cv2.resize(crop, (crop_size, crop_size))

    aligned = cv2.warpAffine(image, m, (crop_size, crop_size), borderMode=cv2.BORDER_REFLECT)
    return aligned
