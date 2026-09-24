import base64
import json
import os
from pathlib import Path
import sys
import requests

BASE_URL = "http://localhost:8081/api"
FIXTURES_DIR = Path("data/fixtures/faces")
CREDENTIALS_FILE = Path(".tools/credentials.json")

def run():
    print("=" * 60)
    print("NEXUS VISUAL IDENTITY SEARCH — END-TO-END VERIFICATION")
    print("=" * 60)

    # 1. Load credentials
    assert CREDENTIALS_FILE.exists(), f"Credentials file {CREDENTIALS_FILE} not found"
    creds = json.loads(CREDENTIALS_FILE.read_text(encoding="utf-8"))
    admin_pw = creds["admin"]["password"]
    investigator_pw = creds["investigator"]["password"]

    print("[Step 1] Logging in...")
    admin_login = requests.post(f"{BASE_URL}/auth/login", json={"username": "admin", "password": admin_pw}).json()
    admin_token = admin_login["token"]
    assert admin_token, "Admin login failed"
    print("  Admin login successful.")

    inv_login = requests.post(f"{BASE_URL}/auth/login", json={"username": "investigator", "password": investigator_pw}).json()
    inv_token = inv_login["token"]
    assert inv_token, "Investigator login failed"
    print("  Investigator login successful.")

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    inv_headers = {"Authorization": f"Bearer {inv_token}"}

    # Check vision status
    status_res = requests.get(f"{BASE_URL}/vision/status", headers=inv_headers).json()
    print(f"  Vision Status: {status_res}")
    assert status_res["status"] == "ok"
    assert status_res["engine"]["detector_available"] is True
    assert status_res["engine"]["recognizer_available"] is True

    # 2. Reset and Load demo data
    print("\n[Step 2] Resetting and loading demo data...")
    requests.post(f"{BASE_URL}/demo/reset", headers=admin_headers)
    load_res = requests.post(f"{BASE_URL}/demo/load", headers=admin_headers).json()
    print(f"  Demo load completed with kinds: {list(load_res.keys())}")

    graph = requests.get(f"{BASE_URL}/graph", headers=inv_headers).json()
    nodes = graph["nodes"]
    print(f"  Graph contains {len(nodes)} nodes, {len(graph['edges'])} edges.")

    aariv_nodes = [n for n in nodes if n["type"] == "Person" and "Aariv" in n["label"]]
    assert len(aariv_nodes) > 0, "Aariv Veylan person node not found in graph"
    aariv = aariv_nodes[0]
    aariv_id = aariv["id"]
    print(f"  Found Aariv Veylan: ID='{aariv_id}', Label='{aariv['label']}'")

    # TEST A — Known identity
    print("\n[Test A] Known Identity — Enroll & Search Aariv Veylan")
    aariv_ref_path = FIXTURES_DIR / "aariv_veylan_ref.jpg"
    assert aariv_ref_path.exists(), f"Fixture missing: {aariv_ref_path}"
    with open(aariv_ref_path, "rb") as f:
        ref_bytes = f.read()

    print(f"  Enrolling {aariv_ref_path.name} ({len(ref_bytes)} bytes) for {aariv_id}...")
    files = {"file": (aariv_ref_path.name, ref_bytes, "image/jpeg")}
    enroll_res = requests.post(f"{BASE_URL}/persons/{aariv_id}/faces", headers=inv_headers, files=files).json()
    assert "id" in enroll_res, f"Enrollment failed: {enroll_res}"
    assert len(enroll_res["embedding"]) == 512, f"Embedding length != 512: {len(enroll_res['embedding'])}"
    print(f"  Enrolled successfully: Face ID={enroll_res['id']}, Model={enroll_res['modelName']}, Embedding dim={len(enroll_res['embedding'])}, Quality={enroll_res['qualityScore']}")

    # Verify enrolled face can be retrieved
    faces_list = requests.get(f"{BASE_URL}/persons/{aariv_id}/faces", headers=inv_headers).json()
    assert len(faces_list) >= 1, "Enrolled face not returned by getFaces"
    print(f"  Retrieved {len(faces_list)} face(s) for Aariv.")

    # Search with CCTV image
    aariv_cctv_path = FIXTURES_DIR / "aariv_veylan_cctv.jpg"
    assert aariv_cctv_path.exists(), f"Fixture missing: {aariv_cctv_path}"
    with open(aariv_cctv_path, "rb") as f:
        cctv_bytes = f.read()

    print(f"  Searching with {aariv_cctv_path.name} ({len(cctv_bytes)} bytes)...")
    files = {"file": (aariv_cctv_path.name, cctv_bytes, "image/jpeg")}
    search_res = requests.post(f"{BASE_URL}/vision/search", headers=inv_headers, files=files).json()
    print(f"  Search status: {search_res['status']}")
    print(f"  Faces detected: {search_res['facesDetected']}")
    assert search_res["status"] == "MATCH_CANDIDATE", f"Expected MATCH_CANDIDATE, got: {search_res['status']}"
    assert len(search_res["matches"]) > 0, "No candidates returned in matches"

    top_cand = search_res["matches"][0]
    sim = top_cand["similarity"]
    print(f"  *** RECORDED SIMILARITY: {sim} (status: {top_cand['status']}) ***")
    assert top_cand["personNodeId"] == aariv_id, f"Expected {aariv_id}, got {top_cand['personNodeId']}"
    assert sim >= 0.65, f"Similarity {sim} below threshold 0.65"

    ctx = top_cand["person"]
    print(f"  Person Context: Label='{ctx.get('label')}', Cases={ctx.get('cases')}, Phones={ctx.get('phones')}, Accounts={ctx.get('accounts')}, Vehicles={ctx.get('vehicles')}")
    assert ctx.get("label") == aariv["label"]
    assert top_cand["status"] in ["STRONG_CANDIDATE", "CANDIDATE"]

    # TEST B — Unknown person
    print("\n[Test B] Unknown Person — Search unknown_suspect.jpg")
    unk_path = FIXTURES_DIR / "unknown_suspect.jpg"
    with open(unk_path, "rb") as f:
        unk_bytes = f.read()
    files = {"file": (unk_path.name, unk_bytes, "image/jpeg")}
    unk_res = requests.post(f"{BASE_URL}/vision/search", headers=inv_headers, files=files).json()
    print(f"  Unknown suspect search status: {unk_res['status']}, matches count: {len(unk_res['matches'])}")
    assert unk_res["status"] == "NO_MATCH", f"Expected NO_MATCH, got {unk_res['status']}"
    assert len(unk_res["matches"]) == 0, f"Expected 0 matches, got {len(unk_res['matches'])}"

    # TEST C — Multiple faces
    print("\n[Test C] Multiple Faces — Search multi_face_crowd.jpg")
    multi_path = FIXTURES_DIR / "multi_face_crowd.jpg"
    with open(multi_path, "rb") as f:
        multi_bytes = f.read()
    files = {"file": (multi_path.name, multi_bytes, "image/jpeg")}
    multi_res = requests.post(f"{BASE_URL}/vision/search", headers=inv_headers, files=files).json()
    print(f"  Multi-face search status: {multi_res['status']}, faces detected: {multi_res['facesDetected']}")
    assert multi_res["status"] == "MULTIPLE_FACES", f"Expected MULTIPLE_FACES, got {multi_res['status']}"
    assert multi_res["facesDetected"] >= 2, f"Expected at least 2 faces, got {multi_res['facesDetected']}"
    assert len(multi_res["faces"]) >= 2, f"Expected faces entries >= 2"

    # Search with specific faceIndex=0
    files = {"file": (multi_path.name, multi_bytes, "image/jpeg")}
    indexed_res = requests.post(f"{BASE_URL}/vision/search?faceIndex=0", headers=inv_headers, files=files).json()
    print(f"  Search faceIndex=0 status: {indexed_res['status']}")
    assert indexed_res["status"] in ["MATCH_CANDIDATE", "NO_MATCH"], f"Unexpected indexed status {indexed_res['status']}"

    # TEST D — No face
    print("\n[Test D] No Face — Search no_face_doc.jpg")
    no_face_path = FIXTURES_DIR / "no_face_doc.jpg"
    with open(no_face_path, "rb") as f:
        no_face_bytes = f.read()
    files = {"file": (no_face_path.name, no_face_bytes, "image/jpeg")}
    no_face_res = requests.post(f"{BASE_URL}/vision/search", headers=inv_headers, files=files).json()
    print(f"  No-face search status: {no_face_res['status']}, faces detected: {no_face_res['facesDetected']}")
    assert no_face_res["status"] == "NO_FACE_DETECTED", f"Expected NO_FACE_DETECTED, got {no_face_res['status']}"
    assert no_face_res["facesDetected"] == 0

    # TEST E — Investigator Decision
    print("\n[Test E] Investigator Decision (Confirm and Reject)")
    # 1. Confirm Match
    confirm_payload = {
        "personNodeId": aariv_id,
        "decision": "CONFIRMED",
        "similarity": sim,
        "modelName": "adaface_ir101_webface12m",
        "imageHash": search_res["imageHash"],
        "notes": "Verified surveillance frame matches subject Aariv Veylan. High facial landmark correlation."
    }
    confirm_res = requests.post(f"{BASE_URL}/vision/decisions", headers=inv_headers, json=confirm_payload).json()
    print(f"  Confirm decision recorded: ID={confirm_res.get('id')}, Decision={confirm_res.get('decision')}, Author={confirm_res.get('author')}")
    assert confirm_res["decision"] == "CONFIRMED"
    assert confirm_res["author"] == "investigator"

    # Verify decision table
    decisions = requests.get(f"{BASE_URL}/vision/decisions?personNodeId={aariv_id}", headers=inv_headers).json()
    assert any(d["id"] == confirm_res["id"] for d in decisions), "Recorded decision not found in decision list"
    print(f"  Found {len(decisions)} decision(s) for person {aariv_id}.")

    # Verify audit log
    audit_logs = requests.get(f"{BASE_URL}/audit", headers=admin_headers).json()
    confirm_audit = [a for a in audit_logs if a["action"] == "vision:decision:confirmed"]
    assert len(confirm_audit) > 0, "No audit log entry found for vision:decision:confirmed"
    print(f"  Audit log entry verified: Action='{confirm_audit[0]['action']}', User='{confirm_audit[0]['userId']}', Entity='{confirm_audit[0]['entityId']}'")

    # Verify audit chain integrity
    audit_verify = requests.get(f"{BASE_URL}/audit/verify", headers=admin_headers).json()
    assert audit_verify.get("valid") is True, f"Audit chain invalid: {audit_verify}"
    print(f"  Audit chain cryptographic verification: valid={audit_verify['valid']}, count={audit_verify['entriesVerified']}")

    # Verify GraphBuilder does NOT merge Person nodes automatically
    graph_after = requests.get(f"{BASE_URL}/graph", headers=inv_headers).json()
    assert len(graph_after["nodes"]) == len(nodes), f"Node count changed! Before: {len(nodes)}, After: {len(graph_after['nodes'])}"
    aariv_after = [n for n in graph_after["nodes"] if n["id"] == aariv_id]
    assert len(aariv_after) == 1, "Aariv node altered or merged improperly"
    print(f"  Verified GraphBuilder: Node count unchanged ({len(graph_after['nodes'])} nodes). Person nodes remain distinct and unmerged.")

    # 2. Reject Match
    reject_payload = {
        "personNodeId": aariv_id,
        "decision": "REJECTED",
        "similarity": 0.66,
        "modelName": "adaface_ir101_webface12m",
        "imageHash": "fake-hash-for-rejection-test",
        "notes": "Rejected match: Subject height does not correlate with CCTV metadata."
    }
    reject_res = requests.post(f"{BASE_URL}/vision/decisions", headers=inv_headers, json=reject_payload).json()
    print(f"  Reject decision recorded: ID={reject_res.get('id')}, Decision={reject_res.get('decision')}")
    assert reject_res["decision"] == "REJECTED"

    audit_logs_after = requests.get(f"{BASE_URL}/audit", headers=admin_headers).json()
    reject_audit = [a for a in audit_logs_after if a["action"] == "vision:decision:rejected"]
    assert len(reject_audit) > 0, "No audit log entry found for vision:decision:rejected"
    print(f"  Audit log entry verified for rejection: {reject_audit[-1]['action']}")

    print("\n" + "=" * 60)
    print("ALL END-TO-END TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run()
