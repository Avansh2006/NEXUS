# NEXUS Re-Audit & Gap Log

**Date:** 2026-09-19  
**Repository:** `Avansh2006/NEXUS`  
**Branch:** `first-agy`  
**Auditor:** Antigravity Hardening Agent  

---

## 1. Executive Summary

This log records the baseline audit comparing the active codebase against the hardening, scale, and feature requirements. NEXUS is a prototype criminal network analysis system developed for PS-13. The codebase has a working end-to-end pipeline (Spring Boot, Python/FastAPI, React/Cytoscape/Three.js, PostgreSQL/H2) with 100% passing tests (pytest, maven, playwright, verify_demo).

This pass addresses critical legal accuracy, objective neutrality, independent evaluation, security architecture, and system scalability gaps.

---

## 2. Workstream A: Corrections & Objective Grounding

| ID | Specification | Existing State | Gap / Resolution Required |
| :--- | :--- | :--- | :--- |
| **A1** | Replace "Section 65B" with BSA 2023, s.63 & Provenance Statement | `Report.java` contains a self-declared "Section 65B Certificate" claiming verification and court submission. | **Gap:** Under the Bharatiya Sakshya Adhiniyam, 2023 (BSA 2023, s. 63), software cannot certify its own integrity. **Resolution:** Replace with an automated "Electronic Record Provenance Statement" (hashes, timestamps, deterministic notice) + blank "Template certificate (BSA 2023, s.63, Schedule Part A/B)" for human officer signature. Purge all claims of self-certification or courtroom admissibility. |
| **A2** | Neutralize role labels everywhere | `analysis.py` defines roles: `KINGPIN`, `BROKER`, `MONEY_MULE`, `DISPATCHER`, `OPERATIVE`, `FRONT_ENTITY`, `LOGISTICS`, `HOTSPOT`. Copilot chip says "Identify the kingpin...". | **Resolved (Pass):** Renamed to neutral pattern labels: `Central Hub (bridge pattern)`, `Cross-Cluster Broker Pattern`, `Pass-Through Account Pattern`, `Outbound Communication Hub`, `High-Activity Node`, `Business Entity (unverified)`, `Transport Asset`, `Location Nexus`. Added criteria values, `"Pattern hypothesis — for investigator review"` disclaimers, pass-through victim notice, and neutralized copilot / HUD / inspector text. |
| **A3** | Independent Held-Out Evaluation | Benchmark is measured against 18 synthetic gold FIRs authored alongside the regex patterns (1.0 precision / 1.0 recall). | **Resolved (Pass):** Created 44 independent held-out FIRs across 4 Indian states (`data/eval/heldout_dev/` and frozen `data/eval/heldout_test/`) containing OCR errors, Hinglish legal cues, and Devanagari numerals. Built `scripts/evaluate_extraction.py` calculating strict and lenient span P/R/F1. Generated `docs/EVALUATION.md` error analysis and integrated honest test metrics (P=100.0%, R=50.8%, F1=67.3%, zero hallucinated FP) directly into UI quality panel. |
| **A4** | Copilot Honesty & Intent Mapping | Copilot displays "ZERO-HALLUCINATION · DETERMINISTIC ENGINE". | **Resolved (Pass):** Rebranded everywhere to "deterministic, graph-grounded" and purged all "zero-hallucination" claims. Built `intelligence/intent.py` with strict Pydantic `IntentModel` schema, `POST /copilot/intent`, out-of-scope query guard ("I can't answer that from the graph data..."), clickable suggestions, explicit UI pipeline banner (`NL QUERY → INTENT MAPPER → GRAPH QUERY → GROUNDED TEMPLATE`), and unit tests. |
| **A5** | Real Security Controls | Rate limit is a 30 req/min memory window in `RequestGuard.java`. Audit log has plain timestamps in DB. No auth. | **Resolved (Pass):** Added standard HTTP 429 rate-limiting headers (`Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`). Implemented cryptographic SHA-256 hash-chaining on `audit_log` (`prev_hash` linkage from genesis `0`*64) with `GET /api/audit/verify` traversal and tamper detection. Added synthetic HS256 JWT auth and RBAC (`ADMIN`, `INVESTIGATOR`, `VIEWER`), enforcing 403 Forbidden on mutations for VIEWER role and 401 on invalid credentials/tokens. |

---

## 3. Workstream B: Scale & Feature Extensions

| ID | Specification | Existing State | Gap / Resolution Required |
| :--- | :--- | :--- | :--- |
| **B1** | Live Incremental FIR Ingestion | Full re-analysis resets or recalculates the whole graph. | **Gap:** No live incremental streaming of a single incoming FIR into an existing analyzed workspace. **Resolution:** Build "Add New FIR" / "Load incoming FIR (demo)" (NXS-007) that incrementally extracts, resolves, highlights cross-case links, and measures ingestion latency without resetting. Provide a remove button for repeatability. |
| **B2** | Scale Proof & Performance | System tested up to 121 records (~146 nodes, 313 edges). | **Gap:** PS-13 requires scale resilience. Exact betweenness is $O(V \cdot E)$, which becomes slow at 10k+ nodes. **Resolution:** Create `scripts/generate_scale_data.py` (1k, 10k, 50k seeded synthetic records). Introduce sampled approximate betweenness (NetworkX $k$-sampling) with explicit exact vs. approximate UI flags. Add UI cluster meta-node collapse and lazy rendering. Document benchmarks in `docs/PERFORMANCE.md`. |
| **B3** | PS Source-Coverage Gap | System ingests FIRs, CDRs, Bank Transactions. | **Gap:** Missing `SocialHandle`, `CriminalHistory`, `IntelReport`, `SurveillanceReport`, and Admiralty credibility grades (A–F, 1–6). **Resolution:** Add entities, parsers, dashed rendering for low credibility, and credibility fields across schema and UI. |
| **B4** | What-If Disruption Analysis | Shortest path finder exists, but no node removal simulation. | **Gap:** Investigators cannot test the structural resilience of the syndicate upon node removal. **Resolution:** Add `POST /api/what-if/remove` simulating graph fragmentation, component splitting, and articulation point analysis. |
| **B5** | Interactive Timeline Playback | Timeline is a static chronological list. | **Gap:** No dynamic temporal playback. **Resolution:** Add play/pause/scrub control with variable speeds to progressively reveal edges and events by timestamp, respecting `prefers-reduced-motion`. |
| **B6** | Hindi / Hinglish / Devanagari | Extractor only parses Latin alphanumeric strings and standard Indian phone formats. | **Gap:** Real-world Indian FIRs frequently contain Devanagari digits, transliterated names, and Hindi role markers. **Resolution:** Add Devanagari numeral normalization ($\u0966-\u096f \to 0-9$), transliterated gazetteers, and Hindi demo FIR with separate recall metrics. |
| **B7** | Investigator Workflow & Triage | Alerts are static read-only outputs from analysis. | **Gap:** No case-management workflow (status triage, notes, watchlist). **Resolution:** Add alert triage (`New`, `Under Review`, `Verified`, `Dismissed`), entity notes, and watchlist, stored with user attribution and hashed audit records. |
| **B8** | Multi-Format Export & Confidence Badges | Reports only export HTML. Edge weights are uniform. | **Gap:** No CSV/GraphML export; no multi-factor confidence scoring. **Resolution:** Add CSV and GraphML export endpoints; add transparent Low/Medium/High confidence badges calculated from evidence diversity, extraction confidence, and hard/soft corroboration. |

---

## 4. Workstream C & D Deliverables

- `docs/EVALUATION.md`: Independent evaluation on heldout dev & test sets.
- `docs/PERFORMANCE.md`: Empirical benchmarks on 1k, 10k, and 50k nodes.
- `docs/IMPROVEMENT_SUGGESTIONS.md`: Evidence-based error analysis, ranked future proposals, self-critique, and Top 5 next actions.
- Synchronized documentation across README, `API.md`, `DEMO_GUIDE.md`, `SECURITY.md`, and `FINAL_FEATURES.md`.
