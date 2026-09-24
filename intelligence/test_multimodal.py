import base64
import io
import math
import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app import app

client = TestClient(app)

def create_sample_image(color=(120, 150, 180), size=(100, 100)) -> bytes:
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()

def test_evidence_status():
    response = client.get("/evidence/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "ocr" in data
    assert "audio" in data
    assert "visual" in data
    assert data["visual"]["dimensions"] == 512

def test_document_ocr_and_entity_extraction():
    # Construct a sample document text containing NEXUS entity patterns
    doc_text = (
        "GOVERNMENT OF MAHARASHTRA POLICE DEPARTMENT\n"
        "FIRST INFORMATION REPORT (FIR No. 204/2026)\n"
        "Complainant stated that accused Aariv Veylan transferred INR 85,000\n"
        "to account SYN-ACCOUNT-001 from mobile SYN-PHONE-001.\n"
        "Witness Dev Neral spotted vehicle MH-04-AB-1234 at Navapur Sector 2."
    )
    b64_doc = base64.b64encode(doc_text.encode('utf-8')).decode('utf-8')

    response = client.post("/evidence/document/ocr", json={
        "file_base64": b64_doc,
        "filename": "scanned_fir.txt",
        "asset_id": "AST-DOC-001"
    })
    assert response.status_code == 200
    res = response.json()
    assert res["assetId"] == "AST-DOC-001"
    assert res["pageCount"] >= 1
    assert "entities" in res
    assert len(res["entities"]) > 0

    # Verify extracted entities have provenance and page numbering
    types_found = {e["type"] for e in res["entities"]}
    assert "Account" in types_found or "Phone" in types_found or "Person" in types_found
    for ent in res["entities"]:
        assert "provenance" in ent
        assert ent["provenance"]["sourceRecordId"] == "AST-DOC-001"
        assert ent["pageNumber"] >= 1

def test_audio_transcription_and_diarization():
    dummy_audio = b"RIFF....WAVEfmt ...." + b"\x00" * 200
    b64_audio = base64.b64encode(dummy_audio).decode('utf-8')

    response = client.post("/evidence/audio/transcribe", json={
        "audio_base64": b64_audio,
        "filename": "call_recording_01.wav",
        "asset_id": "AST-AUD-001"
    })
    assert response.status_code == 200
    res = response.json()
    assert res["assetId"] == "AST-AUD-001"
    assert "segments" in res
    assert len(res["segments"]) >= 1
    assert "fullTranscript" in res
    assert "entities" in res

    first_seg = res["segments"][0]
    assert "start" in first_seg
    assert "end" in first_seg
    assert "speaker" in first_seg
    assert "timestampDisplay" in first_seg
    assert first_seg["speaker"].startswith("SPEAKER_")

    # Verify extracted entities are linked to timestamps
    for ent in res["entities"]:
        assert "timestampStart" in ent
        assert "timestampEnd" in ent
        assert "speaker" in ent
        assert ent["provenance"]["sourceRecordId"] == "AST-AUD-001"

def test_visual_embedding_and_search():
    img1 = create_sample_image(color=(200, 50, 50))
    b64_img1 = base64.b64encode(img1).decode('utf-8')

    response = client.post("/evidence/visual/embed", json={
        "file_base64": b64_img1,
        "filename": "seized_vehicle_01.jpg",
        "media_type": "IMAGE",
        "asset_id": "AST-IMG-001",
        "case_id": "CASE-001"
    })
    assert response.status_code == 200
    res = response.json()
    assert res["assetId"] == "AST-IMG-001"
    assert res["mediaType"] == "IMAGE"
    assert res["frameCount"] == 1
    emb1 = res["primaryEmbedding"]
    assert len(emb1) == 512

    # Verify unit normalization (L2 norm should be ~1.0)
    norm = math.sqrt(sum(x * x for x in emb1))
    assert pytest.approx(norm, 0.05) == 1.0

    # Test Search against a synthetic gallery
    # Candidate A: very close embedding
    candidate_a_emb = [round(x + 0.001, 5) for x in emb1]
    # Candidate B: inverted/opposite embedding
    candidate_b_emb = [round(-x, 5) for x in emb1]

    gallery = [
        {
            "assetId": "AST-IMG-TARGET-A",
            "caseId": "CASE-019",
            "frameIndex": 0,
            "timestamp": 0.0,
            "embedding": candidate_a_emb,
            "thumbnail": "data:image/jpeg;base64,sample"
        },
        {
            "assetId": "AST-IMG-TARGET-B",
            "caseId": "CASE-042",
            "frameIndex": 0,
            "timestamp": 0.0,
            "embedding": candidate_b_emb,
            "thumbnail": "data:image/jpeg;base64,sample2"
        }
    ]

    search_resp = client.post("/evidence/visual/search", json={
        "query_embedding": emb1,
        "gallery": gallery,
        "threshold": 0.40,
        "top_k": 5
    })
    assert search_resp.status_code == 200
    search_data = search_resp.json()
    assert "matches" in search_data
    assert len(search_data["matches"]) >= 1

    top_match = search_data["matches"][0]
    assert top_match["matchAssetId"] == "AST-IMG-TARGET-A"
    assert top_match["matchCaseId"] == "CASE-019"
    assert top_match["similarityScore"] > 90.0
    assert "CASE-019 — Visual Similarity" in top_match["similarityDisplay"]
    assert "Visual similarity lead only" in top_match["leadDisclaimer"]
    assert "provenance" in top_match

def test_multimodal_error_handling():
    # Empty / malformed base64
    resp = client.post("/evidence/document/ocr", json={
        "file_base64": "invalid-base64!@@#",
        "filename": "test.pdf"
    })
    assert resp.status_code == 400

    # Missing query embedding
    resp2 = client.post("/evidence/visual/search", json={
        "query_embedding": [],
        "gallery": []
    })
    assert resp2.status_code == 200
    assert resp2.json()["count"] == 0
