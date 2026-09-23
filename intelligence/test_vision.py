import base64
import io
import cv2
import numpy as np
import pytest
from PIL import Image
from starlette.testclient import TestClient

from app import app
from vision.pipeline import VisionPipeline
from vision.alignment import align_face
from vision.recognizer import AdaFaceRecognizer
from vision.detector import compute_face_quality


@pytest.fixture
def client():
    return TestClient(app)


def create_blank_image(width=200, height=200, color=(128, 128, 128)):
    img = np.full((height, width, 3), color, dtype=np.uint8)
    _, buf = cv2.imencode('.jpg', img)
    return buf.tobytes()


def create_test_face_crop(size=112):
    # Generates a synthetic aligned face-like pattern
    img = np.full((size, size, 3), 150, dtype=np.uint8)
    # Add gradients and features
    cv2.circle(img, (size // 3, size // 3), size // 8, (60, 60, 60), -1)
    cv2.circle(img, (2 * size // 3, size // 3), size // 8, (60, 60, 60), -1)
    cv2.line(img, (size // 2, size // 3), (size // 2, 2 * size // 3), (90, 80, 70), 3)
    cv2.ellipse(img, (size // 2, 3 * size // 4), (size // 4, size // 10), 0, 0, 180, (40, 40, 120), 2)
    return img


def test_vision_status_endpoint(client):
    res = client.get('/vision/status')
    assert res.status_code == 200
    data = res.json()
    assert 'embedding_dimension' in data
    assert data['embedding_dimension'] == 512
    assert 'metric' in data
    assert data['metric'] == 'cosine_similarity'


def test_alignment_transformation():
    landmarks = np.array([
        [30, 40],
        [70, 40],
        [50, 60],
        [35, 80],
        [65, 80],
    ], dtype=np.float32)
    dummy_img = np.zeros((150, 150, 3), dtype=np.uint8)
    aligned = align_face(dummy_img, landmarks, crop_size=112)
    assert aligned.shape == (112, 112, 3)


def test_face_quality_metrics():
    # Sharp image
    img = create_test_face_crop(112)
    q = compute_face_quality(img)
    assert 'sharpness' in q
    assert 'brightness' in q
    assert 'contrast' in q
    assert 'usable' in q
    assert 'overall_quality' in q
    assert 0.0 <= q['overall_quality'] <= 1.0

    # Tiny / blurry image
    tiny = np.zeros((10, 10, 3), dtype=np.uint8)
    q_tiny = compute_face_quality(tiny)
    assert q_tiny['usable'] is False


def test_recognizer_embedding_and_similarity():
    rec = AdaFaceRecognizer()
    face1 = create_test_face_crop(112)
    face2 = create_test_face_crop(112)

    emb1 = rec.embed(face1)
    emb2 = rec.embed(face2)

    assert len(emb1) == 512
    assert len(emb2) == 512

    # Vector norm must be approx 1.0
    norm1 = np.linalg.norm(emb1)
    assert abs(norm1 - 1.0) < 1e-4

    # Identical faces have cosine similarity ~ 1.0
    sim_self = rec.cosine_similarity(emb1, emb1)
    assert abs(sim_self - 1.0) < 1e-4

    # Different face (different noise/pattern)
    face_diff = np.random.RandomState(42).randint(0, 255, (112, 112, 3), dtype=np.uint8)
    emb_diff = rec.embed(face_diff)
    sim_diff = rec.cosine_similarity(emb1, emb_diff)
    assert sim_diff < 0.95


def test_compare_endpoint(client):
    v1 = [1.0] + [0.0] * 511
    v2 = [1.0] + [0.0] * 511  # identical
    v3 = [0.0, 1.0] + [0.0] * 510  # orthogonal

    payload = {
        'query_embedding': v1,
        'gallery': [
            {'id': 'p1', 'embedding': v2},
            {'id': 'p2', 'embedding': v3},
        ],
        'threshold': 0.5,
    }
    res = client.post('/vision/compare', json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data['count'] == 1
    assert data['matches'][0]['id'] == 'p1'
    assert abs(data['matches'][0]['similarity'] - 1.0) < 1e-4


def test_no_face_detected_search(client):
    blank_bytes = create_blank_image(200, 200)
    b64 = base64.b64encode(blank_bytes).decode('ascii')
    res = client.post('/vision/search', json={'image_base64': b64})
    assert res.status_code == 200
    data = res.json()
    assert data['status'] == 'NO_FACE_DETECTED'
    assert data['faces_detected'] == 0
    assert data['embedding'] is None


def test_no_face_detected_enroll_fails(client):
    blank_bytes = create_blank_image(200, 200)
    b64 = base64.b64encode(blank_bytes).decode('ascii')
    res = client.post('/vision/enroll', json={'image_base64': b64})
    assert res.status_code in (400, 422)
    assert 'NO_FACE_DETECTED' in res.json()['detail']


def test_malformed_image_rejected(client):
    res = client.post('/vision/search', json={'image_base64': 'not-a-valid-image-bytes'})
    assert res.status_code == 400

    res2 = client.post('/vision/enroll', json={'image_base64': 'not-a-valid-image-bytes'})
    assert res2.status_code == 400


def test_multipart_file_upload(client):
    blank_bytes = create_blank_image(200, 200)
    files = {'image': ('test.jpg', blank_bytes, 'image/jpeg')}
    res = client.post('/vision/search/file', files=files)
    assert res.status_code == 200
    assert res.json()['status'] == 'NO_FACE_DETECTED'
