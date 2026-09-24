# NEXUS Multimodal Evidence Fusion

## 1. Executive Summary

NEXUS Multimodal Evidence Fusion extends the evidence-linked criminal-network investigation workbench with unified intake and machine intelligence for unstructured, real-world law enforcement media:

1. **Scanned Documents & FIRs**: Powered by **PaddleOCR PP-OCRv5** (supporting English, Hindi, and Marathi / Devanagari scripts) with verbatim bounding-box citations and automated feed-forward into the deterministic entity extraction pipeline.
2. **Audio & Voice Intelligence**: Powered by pretrained **faster-whisper** (`small`, int8, CPU-optimized) for multilingual audio transcription with exact timestamps, coupled with anonymous speaker diarization (`SPEAKER_00`, `SPEAKER_01`) via `pyannote/speaker-diarization-community-1` (gracefully falling back when offline or `HF_TOKEN` is unavailable).
3. **Cross-Case Visual Evidence Search**: Independent of the face recognition engine, powered by pretrained **OpenCLIP ViT-B-32** (`laion2b_s34b_b79k`) producing 512-dimensional normalized unit embeddings. Video and CCTV surveillance streams are sampled at ~2-second intervals (safe maximum of 20 keyframes). Similarities are ranked and displayed as cross-case investigative leads (e.g. `CASE-019 — Visual Similarity 92/100`).
4. **Evidentiary Integrity & Investigator Oversight**: All extracted entities and visual matches are strictly treated as **reviewable investigative leads**, never automated verdicts or silent identity merges. Every ingested asset is fingerprint-hashed (SHA-256) upon intake, and all human acceptance, rejection, or corroboration decisions are permanently logged into the cryptographic audit log.

---

## 2. Architecture & Data Flow

```
                           +------------------------------------------+
                           |           UNIFIED EVIDENCE INTAKE        |
                           |   (PDF, Scanned FIR, WAV, MP3, JPG, MP4) |
                           +--------------------+---------------------+
                                                |
                                      [SHA-256 Intake Hash]
                                                |
                                                v
               +-----------------------------------------------------------------+
               |             Spring Boot Backend Orchestration (Port 8080)        |
               |       - EvidenceService & EvidenceController                    |
               |       - PostgreSQL 16 (evidence_asset, evidence_item, review)   |
               |       - SHA-256 Hash Chained Audit Log                          |
               +--------------------------------+--------------------------------+
                                                |
                                        REST HTTP Bridge
                                                |
                                                v
               +-----------------------------------------------------------------+
               |             FastAPI Python Intelligence Sidecar (Port 8000)     |
               +--------------------+-------------------+------------------------+
                                    |                   |
            +-----------------------+                   +------------------------+
            |                                           |                        |
            v                                           v                        v
+-----------------------+                   +-----------------------+  +-----------------------+
|  Document OCR Engine  |                   |   Audio Intelligence  |  | Visual Evidence Search|
|   PaddleOCR PP-OCRv5  |                   |     faster-whisper    |  |  OpenCLIP ViT-B-32    |
| (English, Hindi, Mr)  |                   | (small int8, PyAnnote)|  | (laion2b_s34b_b79k)   |
+-----------+-----------+                   +-----------+-----------+  +-----------+-----------+
            |                                           |                          |
            +---------------------+---------------------+                          |
                                  |                                                |
                                  v                                                v
                     +--------------------------+                     +--------------------------+
                     | extraction.py (Entities) |                     | Cosine Similarity Search |
                     | Persons, Phones, Accounts|                     | pgvector / NumPy / Java  |
                     +------------+-------------+                     +------------+-------------+
                                  |                                                |
                                  +---------------------+--------------------------+
                                                        |
                                                        v
                                          +----------------------------+
                                          | Human Review & Graph Leads |
                                          | (ACCEPTED/REJECTED/CORROB) |
                                          +----------------------------+
```

---

## 3. Component Details

### 3.1 Document OCR & FIR Analysis (`PaddleOCR PP-OCRv5`)
- **Supported Formats**: Scanned PDF pages, JPEG, PNG, TIFF.
- **Multilingual Support**: English (`en`), Hindi (`hi`), and Marathi (`mr`) scripts.
- **Entity Feed-Forward**: Recognized text lines are passed through `intelligence/extraction.py` to extract Persons, Phone numbers, Bank accounts, Vehicle registration numbers, and Locations.
- **Provenance Linkage**: Each extracted entity retains its verbatim text, source asset ID, page index, and bounding box coordinates.

### 3.2 Audio & Voice Intelligence (`faster-whisper`)
- **Model**: Pretrained `faster-whisper` (`small`, CPU int8 quantization).
- **Features**: Automatic language detection (e.g. Hindi, English, Marathi), timestamped transcript segments (`start` and `end` seconds).
- **Diarization**: Anonymous speaker labeling (`SPEAKER_00`, `SPEAKER_01`) with graceful heuristic fallback when running in offline/airgapped environments without Hugging Face credentials.
- **Entity Extraction**: Segment text is routed to entity extraction so spoken phone numbers, aliases, and bank accounts are mapped directly to specific timestamps in the call recording.

### 3.3 Visual Evidence Search (`OpenCLIP ViT-B-32`)
- **Model**: `open_clip.create_model_and_transforms('ViT-B-32', pretrained='laion2b_s34b_b79k')`.
- **Embedding Space**: 512-dimensional normalized unit vector ($||\vec{v}||_2 = 1.0$).
- **CCTV Frame Sampling**: Video files are automatically sampled every ~2 seconds (safe cap at 20 frames) to extract keyframes with thumbnails.
- **Search Strategy**: Evaluates cosine similarity:
  $$\text{sim}(q, t) = \frac{\vec{q} \cdot \vec{t}}{||\vec{q}||_2 ||\vec{t}||_2} = \vec{q} \cdot \vec{t}$$
  Using `pgvector` when available with an exact NumPy/Java in-memory fallback.
- **Judicial Safeguard Disclaimer**: Returned leads explicitly display:
  > *"Visual similarity indicates an investigative lead only. It does not establish physical identity, vehicle ownership, or case connection."*

---

## 4. Endpoints Reference

| Method | Endpoint | Description | RBAC |
|---|---|---|---|
| `GET` | `/api/evidence/status` | Reports sidecar engine status and device (CPU/GPU) | Permitted All |
| `POST` | `/api/evidence/upload` | Ingests file (multipart), computes SHA-256 hash | INVESTIGATOR, ADMIN |
| `GET` | `/api/evidence/assets` | Lists ingested evidence assets (optional `caseId` filter) | Permitted All |
| `GET` | `/api/evidence/assets/{assetId}` | Retrieves specific evidence asset details | Permitted All |
| `GET` | `/api/evidence/assets/{assetId}/items` | Retrieves extracted items, segments, and embeddings | Permitted All |
| `POST` | `/api/evidence/document/analyze` | Triggers PP-OCRv5 and entity extraction for a document | INVESTIGATOR, ADMIN |
| `POST` | `/api/evidence/audio/analyze` | Triggers faster-whisper transcription & diarization | INVESTIGATOR, ADMIN |
| `POST` | `/api/evidence/visual/embed` | Samples video frames / extracts OpenCLIP embeddings | INVESTIGATOR, ADMIN |
| `POST` | `/api/evidence/visual-search` | Performs cross-case visual similarity search | Permitted All (Read-Only) |
| `POST` | `/api/evidence/review` | Commits investigator determination (`ACCEPTED`, `REJECTED`, `CORROBORATED`) | INVESTIGATOR, ADMIN |
| `GET` | `/api/evidence/reviews` | Retrieves logged human determinations | Permitted All |
| `POST` | `/api/evidence/demo/seed` | Seeds synthetic multimodal fixtures (FIR, Wiretap, Vehicles) | INVESTIGATOR, ADMIN |

---

## 5. Walkthrough for Judges and Investigators

1. **Access Multimodal Workbench**:
   - In the NEXUS navigation bar, select **Multimodal Evidence** (Layers icon).
   - Notice the **Neural Sidecar Status** panel verifying local CPU readiness for `PP-OCRv5`, `faster-whisper`, and `OpenCLIP ViT-B-32`.
2. **Seed Demo Multimodal Evidence**:
   - Click **"Seed Demo Multimodal Evidence"**.
   - NEXUS instantiates four synthetic fixtures:
     - `Scanned_FIR_NXS007.pdf`: Scanned FIR document mentioning Aariv Veylan, phone 9820198201, and account 9182736450.
     - `Wiretap_Intercept_NXS007.wav`: Wiretap audio between `SPEAKER_00` and `SPEAKER_01`.
     - `Seized_Vehicle_CASE019.jpg`: Seized getaway vehicle in target case `CASE-019`.
     - `CCTV_Vehicle_NXS007.jpg`: CCTV probe vehicle frame from Navapur Sector 4 in active case `NXS-007`.
3. **Inspect Document OCR Intelligence**:
   - Open the **Document OCR (PP-OCRv5)** tab.
   - Review the recognized document text and extracted entity cards with verbatim citations.
   - Click **"Review Lead"** on an extracted phone or person to record an **ACCEPTED** or **CORROBORATED** determination with notes.
4. **Inspect Audio & Wiretap Intelligence**:
   - Open the **Audio Intelligence (Whisper)** tab.
   - View the full wiretap transcript, detected language, and timestamped segments (`SPEAKER_00` at `0.00s – 3.20s`).
   - Notice telephony entities linked to specific speech timestamps.
5. **Execute Cross-Case Visual Search**:
   - Open the **Visual Evidence Search (OpenCLIP)** tab.
   - Select `CCTV_Vehicle_NXS007.jpg` as the query probe.
   - Click **"Find Cross-Case Matches"**.
   - Observe the ranked match: `CASE-019 — Visual Similarity 95/100` alongside the mandatory investigative lead safeguard banner.
6. **Inspect the Audit Log**:
   - Open the **Investigator Review Log** tab to see every human decision cryptographically recorded with operator ID and timestamps.
