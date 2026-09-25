# NEXUS: Network Exploration & eXtraction for Unified Intelligence Systems

> **Evidence-Linked Criminal Network Intelligence & Forensic Workbench**  
> An evidence-anchored intelligence workbench for multi-source crime narratives, call records, financial transactions, and biometric surveillance.  
> **PROTOTYPE · SYNTHETIC BENCHMARK DATA** · Engineered under the strict **"Assist, Never Accuse"** doctrine.

---

## 🌐 Live Interactive Deployment

- **Hosted Workbench:** [https://nexus-workbench-avansh.netlify.app](https://nexus-workbench-avansh.netlify.app)
- **Live Demo Access:** Click **`⚡ 1-Click Evaluator Access (Admin)`** on the landing screen to instantly explore the pre-seeded multi-case intelligence graph without manual credential entry.
- **Technical Presentation Deck (PDF):** [docs/NEXUS_Hackathon_Deck.pdf](docs/NEXUS_Hackathon_Deck.pdf)

---

## 👥 Engineering & Architecture

| Name | Role | Responsibilities |
| :--- | :--- | :--- |
| **Avansh Yadav** | Lead & Full-Stack Architect | Distributed architecture, Spring Boot backend, React 19 UI, ML sidecar integration, Netlify deployment |

---

## 🎯 1. Problem Statement & The NEXUS Solution

### The Challenge
Modern law enforcement and judicial investigators face critical bottlenecks:
1. **Data Fragmentation:** Critical evidence is scattered across First Information Reports (FIRs), Call Detail Records (CDRs), bank statements, and CCTV camera snapshots.
2. **Cognitive Overload:** Complex syndicated networks span multiple jurisdictions with money mules, burner phones, and alternate aliases, hiding crucial links in plain sight.
3. **Black-Box AI Risks:** Generative AI models risk catastrophic hallucinations, algorithmic bias, unexplainable "guilt scores", and violation of constitutional due process.
4. **Evidentiary Integrity:** Digital intelligence is frequently challenged in court due to broken chain-of-custody and lack of statutory certification under digital evidence laws (e.g. *Bharatiya Sakshya Adhiniyam, 2023* / BSA 2023).

### The Solution: NEXUS
NEXUS fuses narrative texts, structured call and financial logs, and biometric surveillance into an interactive, multi-dimensional knowledge graph:
- **"Assist, Never Accuse":** AI models only propose factual candidate leads. The system strictly forbids automated guilt scoring, predictive criminality, and autonomous entity merges.
- **100% Provenance Anchoring:** Every entity node and relational edge is bound to verbatim primary evidence excerpts with source offsets and SHA-256 intake hashes.
- **Counterfactual Sandboxing:** Investigators can simulate the exclusion of disputed or contaminated evidence in volatile memory without altering canonical court records.
- **Cryptographic Audit Ledger:** Every analyst action is permanently recorded in an append-only SHA-256 hash-chained audit log with on-demand mathematical verification.

---

## 🛠️ 2. Technology Stack

```
                              ┌────────────────────────────────────────┐
                              │         CLIENT / PRESENTATION          │
                              │    React 19 · TypeScript · Vite 6      │
                              │  Tailwind CSS 4 · Cytoscape.js (fcose) │
                              │        Three.js 3D Spatial Globe       │
                              └──────────────────┬─────────────────────┘
                                                 │ HTTPS / JSON REST
                                                 ▼
                              ┌────────────────────────────────────────┐
                              │      CORE ENTERPRISE APPLICATION       │
                              │      Spring Boot 3.4.3 (Java 17 LTS)   │
                              │   - JJWT Authentication & RBAC Filters │
                              │   - Graph Ingestion & Reconciliation   │
                              │   - SHA-256 Hash-Chained Audit Ledger  │
                              │   - PostgreSQL 16 (or H2 Postgres Mode)│
                              └──────────────────┬─────────────────────┘
                                                 │ HTTP Internal Bridge
                                                 ▼
                              ┌────────────────────────────────────────┐
                              │       MACHINE INTELLIGENCE SIDECAR     │
                              │         Python 3.12 + FastAPI          │
                              │   - spaCy EntityRuler (Deterministic)  │
                              │   - NetworkX (Louvain, Centrality)     │
                              │   - SCRFD-10G (5-pt Face Detection)    │
                              │   - AdaFace IR-101 (512-dim Embedding) │
                              └────────────────────────────────────────┘
```

| Layer | Component | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend** | React | 19.x | Declarative component hierarchy and reactive state management |
| | TypeScript | 5.x | Strict end-to-end type safety |
| | Vite | 6.x | High-speed build system and reverse proxy |
| | Tailwind CSS | 4.x | Tactical HUD design system |
| | Cytoscape.js | 3.31 | Hardware-accelerated 2D relational graph physics (fcose layout) |
| | Three.js | r186 | 3D spatial globe canvas for cross-district correlation |
| **Backend** | Spring Boot | 3.4.3 | Enterprise REST API and business logic orchestration |
| | Java | 17 LTS | High-performance enterprise runtime |
| | JJWT | 0.12.x | Signed HMAC-SHA256 tokens with automated TTL |
| | Database | H2 / PostgreSQL 16 | Relational persistence with JSONB storage |
| **AI / ML Engine**| FastAPI | 0.115+ | Low-latency async ASGI framework hosting the intelligence sidecar |
| | Python | 3.12 | Machine intelligence execution runtime |
| | spaCy | 3.8+ | Rule-based `EntityRuler` + gazetteers (zero-hallucination NLP) |
| | NetworkX | 3.4+ | Degree/betweenness centrality & Louvain community clustering |
| | SCRFD-10G | InsightFace | 5-point facial landmark detector (16.9 MB ONNX) |
| | AdaFace IR-101 | cvlface | 512-dimensional biometric facial recognition embeddings (260 MB ONNX) |

---

## 🚀 3. Quickstart & Local Setup

### Prerequisites
- **Java 17 LTS** (Temurin/OpenJDK)
- **Python 3.12**
- **Node.js 22+**

### 1-Click Launch (Windows PowerShell)
From the repository root:

```powershell
# 1. Start all services in the background (FastAPI, Spring Boot, React)
.\scripts\host-services.ps1

# 2. Open http://localhost:8080 in your browser!
```

### Stopping Services
```powershell
.\scripts\stop-services.ps1
```

### Docker Compose Startup (Alternative)
```sh
python -m pip install -r scripts/requirements-dev.txt
python scripts/setup_credentials.py
docker compose up --build -d
```

---

## 🔑 4. Authentication & Roles

The system enforces strict Role-Based Access Control (RBAC):

| Role | Username | Password | Operational Capabilities |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `ZAnYeTpSbu9ainRYo1EELguTrN3twZlh` | Full controls, load/reset demo, diagnostics, audit review |
| **Investigator** | `investigator` | `TFw3vJQtf9b37aPWSq0OhBHBha2oOqLo` | Source ingestion, CCTV face search, link review, entity notes |
| **Viewer** | `viewer` | `-GxYeD8f13u58HMGtgZ8J4Fa88utj5Os` | Read-only inspection, dossiers, simulations, exports |

---

## 🧪 5. Testing & Verification Results

NEXUS includes an automated end-to-end verification suite:

```sh
# Run Python Intelligence & ML tests (40 tests)
.\.venv\Scripts\python.exe -m pytest -q intelligence

# Run End-to-End Visual Identity Search verification
.\.venv\Scripts\python.exe scripts/verify_e2e_vision.py

# Run Black-Box Ground-Truth Rehearsal
.\.venv\Scripts\python.exe scripts/verify_demo.py
```

### Verified Benchmark Metrics
- **Gold Standard Dataset:** 146 canonical nodes, 313 edges, 961 primary evidence citations.
- **Rule Engine Accuracy:** Precision 1.0, Recall 1.0 against synthetic gold set.
- **Ingestion Speed:** 0.601 seconds for 121 multi-source records.
- **Graph Analytics Speed:** 0.203 seconds for Louvain communities and centrality rankings.
- **Biometric Cosine Similarity:** 0.928 candidate retrieval for target suspect `Aariv Veylan`.
- **Test Suite Status:** **100% Passed (40/40 Unit & Integration Tests)**.

---

## ⚖️ 6. Statutory Admissibility (BSA 2023 Section 63)

Under Section 63 of the *Bharatiya Sakshya Adhiniyam, 2023* (formerly Section 65B of the Indian Evidence Act, 1872), digital intelligence requires rigorous verification:
1. **Append-Only SHA-256 Hash Chain:** Every analyst decision and source ingestion is cryptographically linked: `H_n = SHA256(H_{n-1} || event_payload)`.
2. **On-Demand Ledger Verification:** `/api/audit/verify` recalculates the entire cryptographic chain, immediately flagging any altered records.
3. **Statutory Certificate of Authenticity:** Automated dossier export includes device parameters, cryptographic hash stamps, and court-admissible certificate formatting.

---

## 📄 7. Technical Documentation Index

- **Interactive Hosted Workbench:** [https://nexus-workbench-avansh.netlify.app](https://nexus-workbench-avansh.netlify.app)
- **Technical Presentation Deck (PDF):** [docs/NEXUS_Hackathon_Deck.pdf](docs/NEXUS_Hackathon_Deck.pdf)
- **System Architecture & Data Model:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **REST API Contract & Specifications:** [docs/API.md](docs/API.md)
- **Visual Forensics & Biometrics Guide:** [docs/VISUAL_IDENTITY_SEARCH.md](docs/VISUAL_IDENTITY_SEARCH.md)
- **Prototype Security & Threat Model:** [docs/SECURITY.md](docs/SECURITY.md)
- **Deployment & Cloud Infrastructure:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
