import json
from pathlib import Path
import requests

BASE_URL = "http://localhost:8081/api"
FIXTURES_DIR = Path("data/fixtures/faces")
CREDENTIALS_FILE = Path(".tools/credentials.json")

def verify_persistence():
    print("=" * 60)
    print("VERIFYING PERSISTENCE AFTER SERVICE RESTART")
    print("=" * 60)

    creds = json.loads(CREDENTIALS_FILE.read_text(encoding="utf-8"))
    admin_pw = creds["admin"]["password"]
    investigator_pw = creds["investigator"]["password"]

    admin_login = requests.post(f"{BASE_URL}/auth/login", json={"username": "admin", "password": admin_pw}).json()
    admin_token = admin_login["token"]
    inv_login = requests.post(f"{BASE_URL}/auth/login", json={"username": "investigator", "password": investigator_pw}).json()
    inv_token = inv_login["token"]

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    inv_headers = {"Authorization": f"Bearer {inv_token}"}

    # 1. Enrolled face embedding remains
    graph = requests.get(f"{BASE_URL}/graph", headers=inv_headers).json()
    aariv_nodes = [n for n in graph["nodes"] if n["type"] == "Person" and "Aariv" in n["label"]]
    assert len(aariv_nodes) > 0, "Aariv node not found"
    aariv_id = aariv_nodes[0]["id"]

    faces = requests.get(f"{BASE_URL}/persons/{aariv_id}/faces", headers=inv_headers).json()
    print(f"1. Enrolled faces for Aariv ({aariv_id}): {len(faces)} face(s)")
    assert len(faces) >= 1, "Persisted faces missing!"
    persisted_face = faces[0]
    assert len(persisted_face["embedding"]) == 512, "Persisted embedding dimension is not 512"
    print(f"   Face ID={persisted_face['id']}, Model={persisted_face['modelName']}, CreatedAt={persisted_face['createdAt']}")

    # 2. Previous decisions remain
    decisions = requests.get(f"{BASE_URL}/vision/decisions?personNodeId={aariv_id}", headers=inv_headers).json()
    print(f"2. Previous decisions for Aariv: {len(decisions)} decision(s)")
    assert len(decisions) >= 2, "Persisted decisions missing!"
    dec_types = [d["decision"] for d in decisions]
    assert "CONFIRMED" in dec_types and "REJECTED" in dec_types, f"Decisions incomplete: {dec_types}"
    print(f"   Decisions found: {dec_types}")

    # 3. Audit records remain valid
    audit_verify = requests.get(f"{BASE_URL}/audit/verify", headers=admin_headers).json()
    print(f"3. Audit chain integrity: valid={audit_verify['valid']}, entries={audit_verify['entriesVerified']}")
    assert audit_verify.get("valid") is True, "Audit chain invalid after restart!"

    # 4. Searching Aariv again still works
    aariv_cctv_path = FIXTURES_DIR / "aariv_veylan_cctv.jpg"
    with open(aariv_cctv_path, "rb") as f:
        cctv_bytes = f.read()
    files = {"file": (aariv_cctv_path.name, cctv_bytes, "image/jpeg")}
    search_res = requests.post(f"{BASE_URL}/vision/search", headers=inv_headers, files=files).json()
    print(f"4. Re-search status: {search_res['status']}, matches: {len(search_res['matches'])}")
    assert search_res["status"] == "MATCH_CANDIDATE"
    assert search_res["matches"][0]["personNodeId"] == aariv_id
    sim = search_res["matches"][0]["similarity"]
    print(f"   Re-search similarity: {sim}")
    assert sim >= 0.65

    print("\n" + "=" * 60)
    print("PERSISTENCE FULLY VERIFIED AFTER RESTART!")
    print("=" * 60)

if __name__ == "__main__":
    verify_persistence()
