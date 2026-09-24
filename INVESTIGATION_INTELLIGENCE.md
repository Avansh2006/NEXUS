# NEXUS Investigation Intelligence Suite

## 1. Overview & Core Philosophy

The **NEXUS Investigation Intelligence Suite** enhances criminal network investigations by providing transparent, deterministic, and auditable analytical capabilities. Rather than deploying black-box generative AI models or opaque predictive algorithms, the suite focuses on helping investigators answer critical investigative questions:

- **How did the network and evidence base evolve over time?**
- **Why are two entities connected, and on what documented evidence is that connection based?**
- **What happens to analytical findings (alerts, communities, centrality) if questionable or disputed evidence is excluded?**
- **Where do ingested records contradict each other (alibis, identity claims, financials, corporate records)?**
- **What critical gaps and uncorroborated leads remain in the investigation?**
- **What significant structural shifts occurred as new batches of evidence arrived?**

### Non-Negotiable Investigative Boundaries
1. **Assist, Never Accuse**: The suite strictly forbids guilt scores, criminal likelihood estimates, threat scores, automated arrest recommendations, or predictive criminality.
2. **Deterministic Evidence Grounding**: Every node, relationship, path, contradiction, and milestone is explicitly tied to primary evidence IDs (`evidenceId`), document excerpts, and timestamps.
3. **Read-Only Simulation Integrity**: Counterfactual / What-If simulations and Investigation Replay operate in transient sandboxes and **never alter canonical investigation state** (`CANONICAL_GRAPH_UNCHANGED=true`).
4. **Auditability & RBAC**: Contradiction reviews and analytical changes are protected by role-based access control (RBAC) and recorded in the hash-chained audit log.

---

## 2. The Six Intelligence Capabilities

### Feature 1: Investigation Replay
- **Endpoint**: `GET /api/investigation/replay`
- **Purpose**: Provides a step-by-step reconstruction of how the investigation graph expanded over time as evidence documents were ingested.
- **Key Capabilities**:
  - Chronological ordering of evidence ingestion steps.
  - Step diffs indicating added nodes, added edges, and triggered alerts at each point in time.
  - Cumulative metrics tracking: graph node count, edge count, active alerts, and detected Louvain communities.
  - Interactive UI with playback controls (Play, Pause, Step Forward/Back), variable playback speeds (0.5x, 1x, 2x, 5x), a scrubber slider, and jump-to-step functionality.

### Feature 2: Counterfactual / What-If Analysis
- **Endpoint**: `POST /api/investigation/what-if`
- **Request Body**:
  ```json
  {
    "excludedNodeIds": ["SYN-PHONE-061"],
    "excludedEdgeIds": [],
    "excludedEvidenceIds": [],
    "scenarioNote": "Simulate excluding disputed mobile device SYN-PHONE-061"
  }
  ```
- **Purpose**: Allows investigators to test hypotheses by simulating the exclusion of suspect nodes, edges, or evidence sources without modifying the underlying database.
- **Key Capabilities**:
  - Sandboxed graph recalculation in memory.
  - Degree centrality recalculation and delta detection (`baselineDegree` vs `counterfactualDegree`).
  - Community reconfiguration analysis (nodes reassigned to different clusters).
  - Analytical Alert Impact: Classifies rules (R1–R7) into `PERSISTED` (still valid without the excluded items), `RESOLVED` (no longer triggered because the evidentiary link was broken), and `NEWLY_CREATED`.
  - Prominent UI banner verifying `CANONICAL_GRAPH_UNCHANGED = true`.
  - Quick-action integration directly from the graph Inspector panel.

### Feature 3: Contradiction Engine (Rules C1–C6)
- **Endpoints**:
  - `GET /api/investigation/contradictions`
  - `POST /api/investigation/contradictions/{id}/review`
- **Deterministic Discrepancy Rules**:
  - **C1: Temporal / Alibi Conflict**: Ingestion records place an entity or their device at two irreconcilable locations within a constrained time window (e.g. CDR cell tower pings vs witness statement).
  - **C2: Conflicting Associate Statements**: Multiple witness or interrogation records provide mutually incompatible assertions regarding an association or incident.
  - **C3: Corporate Registry Discrepancy**: Formal corporate ownership/directorship records conflict with observed financial transaction authorizations or intelligence records.
  - **C4: Disputed Identifier / Shared Device**: The same physical phone number, IMEI, or bank account is claimed or utilized by multiple distinct subjects in overlapping windows.
  - **C5: Financial Flow Inconsistency**: Reported declared legitimate income or business activity does not reconcile with aggregate transaction velocities or high-value account flows.
  - **C6: Visual vs Document Identity Discrepancy**: Facial recognition candidate match conflicts with government identification documents or alias declarations.
- **Human-in-the-Loop Review**:
  - Investigators and Administrators can record reviews (`OPEN`, `RESOLVED`, `DISMISSED`) along with an evidentiary rationale.
  - Reviews are persisted in the `contradiction_review` table and logged to the audit log.
  - Viewers can inspect contradictions but are restricted from submitting reviews (`403 Forbidden`).

### Feature 4: Evidence Trail Mode
- **Endpoint**: `GET /api/evidence/path?from={node}&to={node}`
- **Purpose**: Traces evidentiary justification paths connecting two entities in the criminal network.
- **Key Capabilities**:
  - Multi-hop traversal between source and target entities.
  - For every hop, surfaces:
    - Direct relationship type (`CALLS`, `TRANSACTS_WITH`, `ASSOCIATED_WITH`, etc.).
    - Exact primary evidence ID and document title.
    - Verbatim quote/excerpt from the evidentiary record.
    - Timestamp and provenance metadata.
  - Hypotheses presets (e.g., Aariv Veylan to Mira Solven via CDR communications and money laundering transfers).
  - Direct launch from Inspector: clicking "Trace Evidence Path" sets the source entity immediately.

### Feature 5: Investigation Gap Finder
- **Endpoint**: `GET /api/investigation/gaps`
- **Purpose**: Identifies structural evidentiary weaknesses and uncorroborated leads in the network.
- **Gap Classifications**:
  - **Unresolved Identifiers**: Anonymous phone numbers, unlinked bank accounts, or unidentified crypto wallets requiring subscriber/KYC subpoenas.
  - **Dead Ends**: High-value or frequent communication nodes that terminate at a leaf node without further known connections.
  - **Unverified Assets**: Vehicles, shell entities, or properties referenced in records that lack registry verification.
  - **Single-Source Corroboration**: Critical relationships or suspect nodes corroborated by only a single piece of evidence, vulnerable to single-point evidentiary challenge.
- **Actionable Steps**: Each gap includes a prioritized, practical procedural recommendation (e.g., "Issue formal section 91 notice to telecom provider", "Request SAR records from FIU").

### Feature 6: Network Change Radar
- **Endpoint**: `GET /api/analysis/changes`
- **Purpose**: Detects structural inflection points and milestones throughout the lifecycle of an investigation.
- **Key Capabilities**:
  - Chronological timeline of analytical milestones.
  - Metric deltas: Node additions, edge additions, density shifts, and changes in network centralization.
  - Key events highlighted: Syndicate link establishment, hub entity identification, cross-case linkages.

---

## 3. Architecture & Data Flow

```
+-------------------------------------------------------------------------+
|                              React Frontend                             |
|  - InvestigationIntelligence.tsx (Master Hub with 6 Tabs)               |
|  - InvestigationReplay.tsx       - CounterfactualAnalysis.tsx           |
|  - ContradictionPanel.tsx        - EvidenceTrail.tsx                    |
|  - InvestigationGaps.tsx         - NetworkChangeRadar.tsx               |
|  - Inspector.tsx (Quick Launch)  - IntelCopilot.tsx (Query Assistant)   |
+------------------------------------+------------------------------------+
                                     |
                                     | HTTP REST (JSON)
                                     v
+-------------------------------------------------------------------------+
|                           Spring Boot Backend                           |
|  - InvestigationController: Exposes all /api/investigation/* endpoints  |
|  - IntelligenceSuiteService: Implements Replay, What-If, C1-C6 Rules,   |
|                              Evidence Pathing, Gap Detection, & Radar   |
|  - RequestGuard: RBAC enforcement (Viewer read-only, Investigator edit) |
|  - Store: Persistence for contradiction_review & audit trail            |
|  - GraphBuilder: In-memory canonical graph representation               |
+------------------------------------+------------------------------------+
                                     |
                                     | Python HTTP Client
                                     v
+-------------------------------------------------------------------------+
|                     FastAPI Intelligence Sidecar                        |
|  - intent.py: Natural language intent mapping for IntelCopilot          |
|  - analysis.py: Centrality, community detection, R1-R7 rule engine      |
+-------------------------------------------------------------------------+
```

---

## 4. API Reference

| Endpoint | Method | RBAC Roles | Description |
|---|---|---|---|
| `/api/investigation/replay` | `GET` | Viewer, Investigator, Admin | Returns all chronological replay steps and network growth metrics |
| `/api/investigation/what-if` | `POST` | Viewer, Investigator, Admin | Simulates network state with specified exclusions (`canonicalGraphUnchanged=true`) |
| `/api/investigation/contradictions` | `GET` | Viewer, Investigator, Admin | Lists all detected C1–C6 contradictions |
| `/api/investigation/contradictions/{id}/review` | `POST` | Investigator, Admin | Records review decision (`OPEN`, `RESOLVED`, `DISMISSED`) |
| `/api/evidence/path?from={id}&to={id}` | `GET` | Viewer, Investigator, Admin | Returns multi-hop evidence trails between two nodes |
| `/api/investigation/gaps` | `GET` | Viewer, Investigator, Admin | Returns classified investigation gaps and recommended actions |
| `/api/analysis/changes` | `GET` | Viewer, Investigator, Admin | Returns analytical radar milestones and metric deltas |

---

## 5. Verification & Test Suite

### Backend Automated Tests
- **Test Class**: `systems.nexus.IntelligenceSuiteTest`
  - `testInvestigationReplayStepCountAndDiffs()`: Validates replay steps, diff integrity, and chronological ordering.
  - `testWhatIfAnalysisExclusionAndAlertDiff()`: Verifies node/edge exclusion, centrality recomputation, alert classification, and canonical graph immutability.
  - `testContradictionsDetectionRules()`: Validates C1, C4, and C5 contradiction discovery against synthetic dataset.
  - `testContradictionReviewWorkflow()`: Verifies `POST /review` updates status, note, and reviewer metadata.
  - `testEvidenceTrailPathsAndQuotes()`: Asserts multi-hop path extraction with verbatim quotes and evidence IDs.
  - `testInvestigationGapFinder()`: Asserts gap identification and procedural recommendations.
  - `testNetworkChangeRadarMilestones()`: Validates radar milestones and structural deltas.
- **Security Tests**: `systems.nexus.ApiSecurityTest`
  - Asserts that Viewers can execute What-If simulations (`200 OK`).
  - Asserts that Viewers are denied review submission (`403 Forbidden`).
  - Total Spring Boot Suite: **60 tests passed, 0 failures, 0 errors**.

### Frontend Automated E2E Tests
- **Test Suite**: `frontend/e2e/intelligence-suite.spec.ts`
  - Verifies navigation to the Investigation Intelligence workbench.
  - Verifies Replay scrubber and playback controls.
  - Verifies What-If simulation execution and `CANONICAL_GRAPH_UNCHANGED` safety banner.
  - Verifies Contradiction Engine filtering and review modal workflow.
  - Verifies Evidence Trail path selection and rationale extraction.
  - Verifies Investigation Gaps filtering and procedural action items.
  - Verifies Network Change Radar milestones.
  - Total Playwright Suite: **1 passed (19.0s), 0 errors**.
