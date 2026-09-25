import base64
import os
import pytest
from fastapi.testclient import TestClient

from app import app
from cctv_search import (
    CctvHuntEngine,
    QueryParser,
    compute_iou,
    check_spatial_proximity,
    generate_synthetic_cctv_video,
)

client = TestClient(app)

FIXTURE_VIDEO_PATH = "data/fixtures/cctv/synthetic_cctv_junction.mp4"


@pytest.fixture(scope="session", autouse=True)
def ensure_cctv_fixture():
    """Generates synthetic CCTV video fixture if not present."""
    if not os.path.exists(FIXTURE_VIDEO_PATH):
        generate_synthetic_cctv_video(FIXTURE_VIDEO_PATH, duration_frames=60, fps=15.0)
    assert os.path.exists(FIXTURE_VIDEO_PATH)


def test_cctv_status_endpoint():
    response = client.get("/vision/cctv/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["enabled"] is True
    assert "dinoModel" in data
    assert "samModel" in data
    assert "leadNotice" in data
    assert "MACHINE-GENERATED" in data["leadNotice"]


def test_query_parser():
    # Simple prompts
    p1 = QueryParser.parse("white SUV")
    assert p1["is_compound"] is False
    assert p1["primary_concept"] == "white SUV"
    assert p1["prompts_for_dino"] == ["white SUV"]

    p2 = QueryParser.parse("red motorcycle")
    assert p2["is_compound"] is False
    assert p2["primary_concept"] == "red motorcycle"

    # Compound prompts
    c1 = QueryParser.parse("person with red backpack")
    assert c1["is_compound"] is True
    assert c1["primary_concept"] == "person"
    assert c1["secondary_concept"] == "red backpack"
    assert c1["relation"].lower() == "with"
    assert c1["prompts_for_dino"] == ["person", "red backpack"]

    c2 = QueryParser.parse("suspect carrying black bag")
    assert c2["is_compound"] is True
    assert c2["primary_concept"] == "suspect"
    assert c2["secondary_concept"] == "black bag"
    assert c2["relation"].lower() == "carrying"

    c3 = QueryParser.parse("man wearing yellow helmet")
    assert c3["is_compound"] is True
    assert c3["primary_concept"] == "man"
    assert c3["secondary_concept"] == "yellow helmet"

    # Invalid prompts
    with pytest.raises(ValueError):
        QueryParser.parse("   ")

    with pytest.raises(ValueError):
        QueryParser.parse("a" * 250)


def test_spatial_proximity_and_iou():
    # Perfect overlap
    b1 = [0.2, 0.2, 0.5, 0.5]
    b2 = [0.2, 0.2, 0.5, 0.5]
    assert compute_iou(b1, b2) == pytest.approx(1.0)

    # Disjoint boxes
    b3 = [0.0, 0.0, 0.1, 0.1]
    b4 = [0.8, 0.8, 0.9, 0.9]
    assert compute_iou(b3, b4) == 0.0

    # Person and backpack in close proximity
    person_box = [0.30, 0.40, 0.45, 0.85]
    backpack_box = [0.28, 0.45, 0.35, 0.65]  # inside / attached to person torso
    is_assoc, score = check_spatial_proximity(person_box, backpack_box)
    assert is_assoc is True
    assert score > 0.4

    # Completely unrelated object far away
    distant_box = [0.80, 0.10, 0.95, 0.30]
    is_assoc_distant, _ = check_spatial_proximity(person_box, distant_box)
    assert is_assoc_distant is False


def test_unsupported_video_and_empty_file():
    # Empty video
    response = client.post("/vision/cctv/search", json={
        "video_base64": "",
        "query": "white SUV"
    })
    assert response.status_code == 400

    # Corrupt / invalid base64
    fake_bytes = base64.b64encode(b"not a valid video stream content").decode("utf-8")
    response2 = client.post("/vision/cctv/search", json={
        "video_base64": fake_bytes,
        "filename": "corrupt.mp4",
        "query": "white SUV"
    })
    assert response2.status_code == 400


def test_cctv_search_simple_prompt():
    with open(FIXTURE_VIDEO_PATH, "rb") as f:
        video_bytes = f.read()
    b64_video = base64.b64encode(video_bytes).decode("utf-8")

    response = client.post("/vision/cctv/search", json={
        "video_base64": b64_video,
        "filename": "junction_cctv.mp4",
        "query": "white SUV",
        "asset_id": "AST-CCTV-001",
        "case_id": "CASE-019"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "READY"
    assert data["query"] == "white SUV"
    assert data["assetId"] == "AST-CCTV-001"
    assert data["caseId"] == "CASE-019"
    assert len(data["tracks"]) >= 1

    first_track = data["tracks"][0]
    assert first_track["trackId"].startswith("TRACK-")
    assert first_track["firstSeenMs"] >= 0
    assert first_track["lastSeenMs"] >= first_track["firstSeenMs"]
    assert first_track["bestConfidence"] > 0.5
    assert "representativeFrame" in first_track
    assert first_track["representativeFrame"]["thumbnail"].startswith("data:image/jpeg;base64,")
    assert first_track["representativeFrame"]["cropThumbnail"].startswith("data:image/jpeg;base64,")
    assert "detections" in first_track
    assert len(first_track["detections"]) >= 1


def test_cctv_search_compound_prompt():
    with open(FIXTURE_VIDEO_PATH, "rb") as f:
        video_bytes = f.read()
    b64_video = base64.b64encode(video_bytes).decode("utf-8")

    response = client.post("/vision/cctv/search", json={
        "video_base64": b64_video,
        "filename": "junction_cctv.mp4",
        "query": "person with red backpack",
        "asset_id": "AST-CCTV-002",
        "case_id": "CASE-001"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "READY"
    assert data["parsedQuery"]["is_compound"] is True
    assert data["parsedQuery"]["primary_concept"] == "person"
    assert data["parsedQuery"]["secondary_concept"] == "red backpack"
    assert len(data["tracks"]) >= 1

    track = data["tracks"][0]
    assert track["compoundAssociation"] is not None
    assert track["compoundAssociation"]["primary"] == "person"
    assert track["compoundAssociation"]["secondary"] == "red backpack"


def test_get_cctv_analysis_by_id():
    with open(FIXTURE_VIDEO_PATH, "rb") as f:
        video_bytes = f.read()
    b64_video = base64.b64encode(video_bytes).decode("utf-8")

    res = client.post("/vision/cctv/search", json={
        "video_base64": b64_video,
        "filename": "cctv.mp4",
        "query": "white SUV"
    })
    assert res.status_code == 200
    analysis_id = res.json()["analysisId"]

    # Retrieve by ID
    get_res = client.get(f"/vision/cctv/search/{analysis_id}")
    assert get_res.status_code == 200
    assert get_res.json()["analysisId"] == analysis_id

    # Non-existent ID returns 404
    bad_res = client.get("/vision/cctv/search/NON-EXISTENT-ID")
    assert bad_res.status_code == 404


def test_cctv_search_file_upload_endpoint():
    with open(FIXTURE_VIDEO_PATH, "rb") as f:
        video_bytes = f.read()

    response = client.post(
        "/vision/cctv/search/file",
        files={"file": ("junction.mp4", video_bytes, "video/mp4")},
        data={
            "query": "white SUV",
            "asset_id": "AST-UPLOAD-01",
            "case_id": "CASE-100"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "READY"
    assert data["assetId"] == "AST-UPLOAD-01"
    assert len(data["tracks"]) >= 1
