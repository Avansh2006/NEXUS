# NEXUS: Complete Project Submission Report & Technical Documentation

**System Title:** NEXUS (Network Exploration & eXtraction for Unified Intelligence Systems)  
**Classification:** Evidence-Linked Criminal Network Intelligence & Forensic Workbench  
**Status:** Complete, Fully Integrated Prototype with Synthetic Benchmark Datasets  

---

## 1. Executive Summary & Problem Statement

### 1.1 The Challenge
Modern law enforcement, anti-money-laundering (AML) units, and judicial investigators face severe operational bottlenecks:
- **Data Fragmentation & Multi-Format Silos:** Evidence arrives in disparate forms—First Information Reports (FIRs), interrogation transcripts, surveillance logs, Call Detail Records (CDRs), bank wire statements, CCTV camera snapshots, and recorded phone taps.
- **Cognitive Overload & Blind Spots:** Investigators manually correlate hundreds of documents, leading to missed syndicated connections, overlooked intermediary money mules, and uncorroborated single-source leads.
- **Black-Box AI Risks:** Contemporary generative AI and predictive policing software risk catastrophic hallucinations, algorithmic bias, unexplainable "guilt scores," and violation of procedural due process.
- **Evidentiary Integrity & Admissibility:** Admitting digital intelligence in court requires strict chain of custody, tamper-evident audit logs, and verifiable statutory certification under digital evidence laws (e.g., Section 63 of the *Bharatiya Sakshya Adhiniyam, 2023* / BSA 2023).

### 1.2 The Solution: NEXUS
**NEXUS** is an end-to-end, evidence-anchored intelligence workbench designed to synthesize complex narrative reports, transactional tables, surveillance media, and biometric candidates into an interactive, multi-dimensional knowledge graph.

NEXUS is engineered strictly under an **"Assist, Never Accuse"** doctrine:
- **100% Provenance Anchoring:** Every entity node and relational edge is tied to verbatim primary evidence excerpts with source offsets and SHA-256 intake hashes.
- **Human-in-the-Loop Safeguards:** AI models only propose candidate leads. The system strictly forbids automated guilt scoring, predictive criminality, and autonomous entity merges.
- **Sandboxed Counterfactuals:** Investigators can simulate the exclusion of disputed or contaminated evidence in-memory without mutating the canonical investigation record.
- **Cryptographic Audit Ledger:** Every analyst action is permanently recorded in an append-only SHA-256 hash-chained audit log.

---

## 2. Complete Technical Stack & Architecture

NEXUS is designed as a distributed, decoupled multi-service system utilizing modern enterprise frameworks, specialized machine intelligence sidecars, and high-performance graph visualizers.

```
                              +--------------------------------------------------+
                              |              CLIENT / PRESENTATION               |
                              |   React 19 + TypeScript + Vite + Tailwind CSS    |
                              |   Cytoscape.js (fcose) + Three.js 3D Canvas      |
                              +-------------------------+------------------------+
                                                        |
                                                HTTPS / JSON REST
                                                        |
                                                        v
                              +--------------------------------------------------+
                              |         CORE APPLICATION SERVER (Port 8081)      |
                              |               Spring Boot 3.4.3 (Java 17)        |
                              |   - REST Controllers & RBAC Security (JJWT)      |
                              |   - Graph Orchestration & Identity Resolution    |
                              |   - SHA-256 Hash-Chained Audit Ledger            |
                              |   - PostgreSQL 16 (or H2 in Postgres mode)       |
                              +-------------------------+------------------------+
                                                        |
                                            HTTP Internal JSON Bridge
                                                        |
                                                        v
                              +--------------------------------------------------+
                              |       INTELLIGENCE & AI SIDECAR (Port 8000)      |
                              |                 Python 3.12 + FastAPI            |
                              |  +--------------------------------------------+  |
                              |  | Extraction: spaCy EntityRuler + Regex      |  |
                              |  | Graph Analytics: NetworkX (Louvain, Clust) |  |
                              |  | Face Search: SCRFD-10G + AdaFace IR-101    |  |
                              |  | Document OCR: PaddleOCR PP-OCRv5 (En/Hi/Mr)|  |
                              |  | Audio Intel: faster-whisper + PyAnnote     |  |
                              |  | Cross-Case Visuals: OpenCLIP ViT-B-32      |  |
                              |  +--------------------------------------------+  |
                              +--------------------------------------------------+
```

### 2.1 Technology Matrix

| Layer | Component | Version / Identifier | Purpose & Technical Function |
|---|---|---|---|
| **Frontend UI** | React | 19.x | Declarative component hierarchy and reactive state management |
| | TypeScript | 5.x | Strict end-to-end type safety across API payloads |
| | Vite | 6.x | High-speed ESM build system and development proxy |
| | Tailwind CSS | 4.x | Tactical HUD design system, dark-mode intelligence palette |
| | Cytoscape.js | 3.x | Hardware-accelerated 2D relational graph engine |
| | cytoscape-fcose | 2.x | Fast Compound Spring Embedder physics layout |
| | Three.js | r128+ | High-density 3D spatial network visualization canvas |
| | Lucide React | Latest | Consistent tactical symbology and iconography |
| **Backend Core** | Spring Boot | 3.4.3 | Enterprise REST API and business logic orchestration |
| | Java | 17 LTS | High-performance enterprise runtime |
| | Spring Security | 6.x | RBAC enforcement, session management, and request filters |
| | JJWT | 0.12.x | Signed HMAC-SHA256 JSON Web Tokens with automated TTL |
| | Spring Data JDBC/JPA| 3.4.x | Transaction management, schema migrations, and ORM |
| | Jackson | 2.18.x | High-throughput JSON serialization with strict unknown-property validation |
| **Database** | PostgreSQL | 16 | Relational persistence with JSONB and pgvector indexing |
| | H2 Database | 2.x | In-memory / file-based PostgreSQL mode for local zero-dependency testing |
| **Intelligence Engine**| FastAPI | 0.115+ | Low-latency async ASGI framework hosting the AI sidecar |
| | Python | 3.12 | Core machine intelligence runtime |
| | spaCy | 3.8+ | Blank English tokenizer with rule-based `EntityRuler` and gazetteers |
| | NetworkX | 3.4+ | Algorithmic graph analysis: degree/betweenness centrality, Louvain clustering |
| | ONNX Runtime | 1.20+ | Multi-threaded CPU execution engine for neural network inference |
| **Computer Vision** | SCRFD-10G | InsightFace KPS | Multi-scale face detection & 5-point landmark localization (~16.9 MB) |
| | AdaFace IR-101 | cvlface (WebFace12M)| Adaptive-margin face recognition; 512-dim L2 normalized embeddings (~248 MB) |
| | OpenCLIP | ViT-B-32 (laion2b) | Visual scene & object embedding for cross-case surveillance matching |
| **Multimodal NLP** | PaddleOCR | PP-OCRv5 | Deep text detection & recognition supporting English, Hindi, and Marathi |
| | faster-whisper | small (int8) | High-speed speech-to-text with timestamps and offline speaker diarization |
| **DevOps & Infrastructure** | Docker Compose | 29.x | Declarative container orchestration, multi-stage builds, isolated networks |
| | Nginx | 1.27 Alpine | Reverse proxy, static asset delivery, and SSL termination |

---

## 3. Core System Modules & Capabilities

### 3.1 Unstructured Narrative Ingestion & Deterministic Extraction
NEXUS ingests raw narrative police FIRs, interrogation notes, surveillance logs, and structured tabular feeds (CDRs, banking transfers).
- **Rule-Based Extraction:** Instead of erratic LLM generative calls, extraction utilizes deterministic regex, spaCy `EntityRuler`, and curated Indian name/alias gazetteers.
- **Multilingual Support:** Handles Hinglish operational slang (*"hawala"*, *"khabari"*, *"bhai"*), normalize Devanagari numerals (`०-९` $\rightarrow$ `0-9`), and identifies national registration formats (Aadhaar, PAN, Indian vehicle plates, IFSC).
- **UTF-16 Character Alignment:** Converts Python Unicode code-point offsets into Java/JavaScript UTF-16 code-unit offsets at the boundary to guarantee pixel-perfect text highlight anchoring in browser inspectors.

### 3.2 Canonical Identity Resolution & Provenance Badge System
- **Deterministic ID Generation:** Canonical entity IDs are derived via deterministic SHA-256 hashes of normalized identifiers (e.g., canonical phone numbers, bank accounts).
- **Corroborated Person Matching:** Names alone never merge across cases. Discovered candidate matches are presented in a dedicated review queue with shared evidence corroboration.
- **Reversible Merge / Undo:** Accepted merges create provenance-preserving aliases. Any merge decision can be rolled back at any time, instantly rebuilding the graph from original immutable sources.
- **Evidence Support Badging:** Nodes and edges display visual support badges (`High`, `Medium`, `Low`, `Unassessed`) calculated from independent record count, source diversity, and extraction confidence. Low-confidence edges are rendered dashed.

### 3.3 Advanced Graph Analytics & Syndicate Pattern Detection
- **Graph Centrality:** Computes in/out degree centrality and normalized betweenness centrality via NetworkX.
- **Seeded Louvain Communities:** Clusters network entities into communities using a fixed random seed (`seed=42`) to guarantee 100% repeatable, deterministic layouts across sessions.
- **Influence Score Formula:**
  $$\text{Influence} = 100 \times \left(0.45 \cdot \text{DegreeCentrality} + 0.35 \cdot \text{BetweennessCentrality} + 0.20 \cdot \frac{\text{CaseCount}}{\text{MaxCases}}\right)$$
- **Syndicate Pattern Engine (Rules R1–R7):**
  - **R1: Shared Device / Number:** Multiple suspects operating through a common phone or SIM.
  - **R2: Rapid Fund Layering:** Intermediary bank accounts channeling split deposits to secondary entities within hours.
  - **R3: Cross-Case Intermediary:** Brokers or couriers appearing across disconnected jurisdictional FIRs.
  - **R4: Co-Accused Clique:** Tight-knit clusters of suspects jointly charged across multiple cases.
  - **R5: High-Frequency Communication Burst:** Sudden surges in telecommunications preceding recorded offenses.
  - **R6: Geographic Convergence:** Disparate syndicate members repeatedly localized at identical cell towers or safehouses.
  - **R7: Shell Corporate Gateway:** Nominee directorships routing illicit funds through corporate shells.

### 3.4 Visual Identity Search (CCTV & Surveillance Forensics)
- **Surveillance Probe Intake:** Investigators upload blurry or unconstrained CCTV frames, dashcam captures, or witness photos.
- **Detection & Alignment:** SCRFD-10G locates faces down to $16 \times 16$ pixels and extracts 5 facial landmarks, performing a $112 \times 112$ similarity transform.
- **Adaptive Margin Recognition (AdaFace):** AdaFace IR-101 dynamically scales the angular margin based on image quality, drastically reducing false positives on degraded surveillance footage.
- **Candidate Matching Only:** The system generates ranked candidate leads with cosine similarity scores. It **strictly forbids automatic entity merging**. Every match requires an explicit investigator rationale logged to the audit ledger.

### 3.5 Multimodal Evidence Fusion
- **Scanned FIR OCR:** PaddleOCR PP-OCRv5 parses multi-page scanned FIRs in English, Hindi, and Marathi, feeding recognized text lines back into the entity extraction pipeline with bounding-box citations.
- **Intercept Audio Intelligence:** Faster-Whisper transcribes surveillance wiretaps with sub-second timestamps and anonymous speaker separation (`SPEAKER_00`, `SPEAKER_01`).
- **OpenCLIP Cross-Case Search:** Embeds surveillance keyframes and crime scene imagery into a shared 512-dimensional vector space, uncovering visual connections across disparate case files.

### 3.6 Forensic Investigation Suite & Judicial Dossier Export
- **Investigation Replay:** Chronologically reconstructs the network step-by-step as evidence was ingested, complete with playback controls, scrubbers, and green pulse delta animations.
- **Counterfactual "What-If" Analysis:** Investigators simulate excluding disputed evidence, informants, or devices. The canvas renders "ghosted" nodes (40% opacity) and severed red dashed edges, reporting resolved alerts while keeping the canonical database untouched.
- **Contradiction Engine (Rules C1–C6):** Flags alibi conflicts, contradictory witness statements, disputed shared devices, and corporate registry mismatches.
- **Evidence Trail Mode:** Multi-hop shortest path search detailing every connecting relationship with verbatim document citations.
- **Courtroom Dossier Export:** Generates an exhaustive 14-section judicial report, complete with network snapshots, entity tables, chain of custody logs, and a statutory **BSA 2023 Section 63 Template Certificate**.

---

## 4. Security Model, RBAC & Evidentiary Integrity

### 4.1 Role-Based Access Control (RBAC) Matrix

| Feature / Action | VIEWER | INVESTIGATOR | ADMINISTRATOR |
|---|:---:|:---:|:---:|
| Browse Dashboard & Network Graph | Yes | Yes | Yes |
| Inspect Nodes, Edges & Primary Citations | Yes | Yes | Yes |
| Run In-Memory Counterfactual What-If Simulations | Yes | Yes | Yes |
| Run Investigation Replay & Timeline Playback | Yes | Yes | Yes |
| Export Analytical Reports, CSV & GraphML | Yes | Yes | Yes |
| Ingest Raw FIRs, CDRs, Audio, Video & Documents | No (403) | Yes | Yes |
| Add / Edit Entity Notes & Personal Watchlists | No (403) | Yes | Yes |
| Triage Alerts (New, Under Review, Verified, Dismissed) | No (403) | Yes | Yes |
| Confirm / Reject Facial Identity Candidates | No (403) | Yes | Yes |
| Merge / Undo Canonical Entities | No (403) | Yes | Yes |
| Review & Resolve Contradictions (C1–C6) | No (403) | Yes | Yes |
| Verify Hash-Chained Audit Ledger | No (403) | Yes | Yes |
| Reset Investigation State & Load Demo Datasets | No (403) | No (403) | Yes |
| Access System Diagnostics & Service Telemetry | No (403) | No (403) | Yes |

### 4.2 Cryptographic Audit Ledger
Every mutating action generates an immutable audit record:
$$\text{Hash}_n = \text{SHA-256}\left(\text{Hash}_{n-1} \,\|\, \text{Timestamp} \,\|\, \text{Actor} \,\|\, \text{Action} \,\|\, \text{TargetID} \,\|\, \text{Metadata}\right)$$
The verification engine recalculates the hash chain from the genesis block ($H_0$). Any tampering, out-of-order deletion, or unauthorized database update triggers an immediate cryptographic failure flag in the UI.

---

## 5. System Execution, Verification & Evaluation

### 5.1 Verification Commands
All services and integration suites are verifiable via standard CLI tooling:

```bash
# 1. Run Python Intelligence & Algorithmic Unit Tests
pytest -q intelligence

# 2. Run Spring Boot Java Backend Integration Suite
mvn -f backend/pom.xml test

# 3. Build & Run Frontend End-to-End Playwright Tests
cd frontend
pnpm build
pnpm test:e2e

# 4. Verify Local Stack End-to-End Synthetic Pipeline
cd ..
python scripts/verify_demo.py
```

### 5.2 Active Local Services

| Service | Port | Local Endpoint | Health Check Status |
|---|---|---|---|
| **Vite Frontend UI** | `8080` | `http://localhost:8080` | `HTTP 200 OK` |
| **Spring Boot REST API**| `8081` | `http://localhost:8081/api/health` | `HTTP 200 OK` |
| **FastAPI AI Sidecar** | `8000` | `http://localhost:8000/health` | `HTTP 200 OK` |

### 5.3 Prototype Accounts

| Role | Username | Prototype Credentials Location |
|---|---|---|
| **Administrator** | `admin` | See [`.tools/credentials.json`](file:///D:/Development/Hackathon/NEXUS/.tools/credentials.json) |
| **Investigator** | `investigator` | See [`.tools/credentials.json`](file:///D:/Development/Hackathon/NEXUS/.tools/credentials.json) |
| **Viewer** | `viewer` | See [`.tools/credentials.json`](file:///D:/Development/Hackathon/NEXUS/.tools/credentials.json) |

---

## 6. Project Impact & Innovation Highlights

1. **Deterministic Accountability over Opaque Hallucination:** Unlike generative chatbots that speculate or fabricate connections, NEXUS mathematically derives its conclusions and anchors every graph edge to a primary evidence span.
2. **First-of-its-Kind Counterfactual Ghosting:** Investigators can stress-test an entire evidentiary chain in seconds by simulating the removal of compromised informants or disputed mobile taps without database alteration.
3. **Statutory Alignment with Modern Evidence Codes:** Built from the ground up to support modern judicial requirements, including electronic evidence certification conforming to India's *Bharatiya Sakshya Adhiniyam, 2023*.
4. **Adaptive Surveillance Face Retrieval on Commodity Hardware:** Utilizes CPU-optimized ONNX runtime with AdaFace IR-101 and SCRFD-10G to deliver sub-second facial candidate retrieval on low-resolution CCTV footage without expensive GPU infrastructure.
