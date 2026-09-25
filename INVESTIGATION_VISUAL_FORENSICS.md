# NEXUS Investigation Visual Forensics & Judicial Dossier Export

## Executive Summary

The **NEXUS Investigation Visual Forensics & Judicial Reporting Suite** elevates the NEXUS criminal network intelligence workbench into a courtroom-ready, explainable, and visually verifiable analytical system. Rather than introducing speculative "black-box" scores or autonomous accusations, this suite provides forensic transparency into:
1. **How an investigation evolved** over time as records were ingested.
2. **What structural impact occurs** if contested or compromised evidence is excluded (in-memory counterfactual simulation).
3. **Why two entities are connected**, highlighting multi-hop relational paths with verbatim document citations and dimming background noise.
4. **Cryptographic integrity and statutory compliance**, verifying the SHA-256 hash-chained audit ledger and generating a comprehensive 14-section evidentiary dossier conforming to statutory requirements, including a Bharatiya Sakshya Adhiniyam, 2023 (BSA 2023) Section 63 template certificate.

Every finding remains strictly **evidence-first, deterministic, human-reviewed, and provenance-backed**.

---

## Architectural & Ethical Principles

```
  ┌────────────────────────────────────────────────────────────────────────┐
  │                    CORE FORENSIC SAFEGUARDS                            │
  ├────────────────────────────────────┬───────────────────────────────────┤
  │ 1. ASSISTIVE, NEVER ACCUSATORY     │ 2. CANONICAL GRAPH IMMUTABILITY   │
  │    • No automated guilt scores     │    • What-If analysis runs strictly│
  │    • No criminal likelihood %      │      in-memory                    │
  │    • No arrest recommendations     │    • Replay does not alter live   │
  │    • No automated entity merges    │      database state               │
  ├────────────────────────────────────┼───────────────────────────────────┤
  │ 3. STRICT PROVENANCE ANCHORING     │ 4. STATUTORY TEMPLATE SAFEGUARDS  │
  │    • Every edge links to source    │    • BSA 2023 s.63 certificate is │
  │      evidence spans with row/offset│      clearly labeled TEMPLATE ONLY│
  │    • Verbatim raw text quotes      │    • Software cannot self-certify │
  │    • Cryptographic SHA-256 digests │      admissibility                │
  └────────────────────────────────────┴───────────────────────────────────┘
```

---

## Capability 1: Live Cytoscape Investigation Replay

### Overview & Workflow
Investigation Replay reconstructs the temporal genesis of the criminal network, simulating chronological ingestion step-by-step. Investigators can scrub through historical events or view playback directly overlaid on the primary Cytoscape canvas.

```
[Investigation Intelligence] ──► [Investigation Replay] ──► [View on Graph]
                                                                  │
                                                                  ▼
[Cytoscape Canvas HUD] ◄── [Step Navigation & Scrubber] ◄── [Interactive Canvas]
  ├── Step Counter: STEP X / Y
  ├── Play / Pause & Speed Controls (0.5x, 1x, 2x, 5x)
  ├── Record Descriptor: Kind, Case ID, Evidence Count
  └── Delta Highlighting: Green pulse for newly added nodes/edges
```

### Canvas Overlay Features
- **In-Canvas HUD (`.replay-hud`):** Positioned immediately above the Cytoscape graph canvas, displaying the current step index, total steps, timestamp, record kind, and case identifier.
- **Scrubber & Speed Selector:** Interactive slider spanning steps 1 to N, step back/forward buttons, play/pause toggle, and speed selectors (`0.5x`, `1x`, `2x`, `5x`).
- **Smooth Layout Preservation:** Uses pre-calculated fcose layouts so nodes do not violently re-jitter between steps.
- **Delta Animation:**
  - Nodes introduced at the active step are assigned `.replay-new` with an emerald pulse animation (`#10b981`).
  - Historical nodes remain visible; future nodes are masked.
- **Source Linkage:** Investigators can click the source record link in the step card to jump straight to the underlying evidence text.

---

## Capability 2: Counterfactual Graph Ghosting

### Overview & Workflow
Counterfactual Analysis allows investigators to ask: *"What happens to our network topology and analytical leads if this informant statement, CDR batch, or entity is excluded?"*

Crucially, **the canonical database is never mutated**. The simulation runs strictly in-memory (`CANONICAL_GRAPH_UNCHANGED=true`).

```
[Inspector / Workbench] ──► [Simulate Exclusion] ──► [View on Graph Canvas]
                                                            │
                                                            ▼
[Simulation Mode Banner] ──► [Mode Selector: Canonical | Simulation | Overlay]
                                    │
                                    ▼
[Cytoscape Ghosting]
  ├── Preserved Elements: Full opacity (#60c5b3, #38bdf8)
  ├── Ghosted Nodes (.ghost-node): 40% opacity, dashed border
  ├── Severed Edges (.ghost-severed): 35% opacity, dashed red border (#ef4444)
  └── Inspector: "SIMULATION IMPACT" card with degree delta & resolved alerts
```

### Display Modes
1. **`[Canonical]`:** Shows the full, unaltered network before simulated removals.
2. **`[Simulation]`:** Renders strictly the residual network with the simulated exclusion applied.
3. **`[Overlay]` (Default):** Ghosts the removed nodes and severed connections in place against the surviving graph:
   - **Ghosted Nodes (`.ghost-node`):** Rendered with 40% opacity, muted grey fills, and dashed outlines.
   - **Severed Edges (`.ghost-severed`):** Rendered with dashed red styling (`#ef4444`, 35% opacity).
   - **Preserved Network:** Retains vibrant entity and edge coloring.
- **Only Impacted Toggle:** When checked, filters the canvas view strictly to nodes and edges directly affected by the exclusion delta.
- **Inspector Simulation Impact Card:** Displays:
  - Degree delta: e.g., `Degree: 5 → 2`.
  - Resolved alerts: e.g., `R1 Shared Phone RESOLVED`.
  - Supporting paths removed.

---

## Capability 3: Evidence Path Highlighting

### Overview & Workflow
When an investigator selects two entities or clicks **"Why Are These Connected?"**, NEXUS traces all evidentiary paths connecting them through phone calls, financial transactions, shared locations, and co-accused relationships.

```
[Entity A Selected] ──► [Click Entity B] ──► [Why Are These Connected?]
                                                        │
                                                        ▼
[Canvas Evidence Trail] ◄── [Dim Background (12%)] ◄── [Evidence Path Highlighting]
  ├── Path Nodes & Edges: Vibrant Cyan Glow (#38bdf8)
  ├── Path Switcher: Path 1 (2 hops), Path 2 (3 hops)
  └── Evidence Callout Card:
        ├── Direct / Indirect Connection Type
        ├── Source Record ID & Kind
        ├── Verbatim Quote / Raw Excerpt
        └── [Open Source Record] Button
```

### Visual Experience
- **Focus & Context Highlighting:** All entities and edges outside the active path are dimmed to **12% opacity** (`.evidence-dim`), instantly guiding the viewer's focus to the evidentiary chain.
- **Cyan Trail Glow (`.evidence-path-node`, `.evidence-path-edge`):** The traversed path nodes and edges glow with vibrant blue styling (`#38bdf8`, 4px line width, increased node borders).
- **Multi-Path Switcher:** If multiple connecting routes exist, buttons (`Path 1`, `Path 2`, etc.) allow cycling between distinct investigative chains.
- **Edge Callout Card (`.evidence-callout-overlay`):** Clicking any path edge opens an evidentiary card detailing:
  - Relationship type (`CALL`, `TRANSACTION`, `CO_ACCUSED`).
  - Source record ID and record type (FIR, CDR, Bank Statement).
  - Verbatim excerpt with span offset.
  - "Open Source Record" action to view the raw ingestion document.

---

## Capability 4: Audit Chain Verification & Investigation Dossier Export

### 1. SHA-256 Cryptographic Chain Verification
The NEXUS audit log is an immutable, SHA-256 hash-chained ledger. Each action (logins, queries, face enrollment, match confirmations, graph alterations) is hashed along with the preceding block's hash.

- **On-Demand Verification:** Clicking **`[Verify Chain of Custody]`** in the Audit panel or running `GET /api/audit/verify` re-computes every block hash from genesis to head.
- **Verification States:**
  - **`AUDIT CHAIN VALID`:** Displays total entries verified without alteration, the Genesis Block Hash, and the Ledger Head Hash.
  - **`INTEGRITY VERIFICATION FAILED`:** Identifies the exact index and reason if tampering, broken linkages, or altered hashes are detected.

### 2. Comprehensive 14-Section Judicial Investigation Dossier
Generated via `POST /api/reports`, the Judicial Dossier compiles complete investigation intelligence into a print-ready, court-admissible HTML document with embedded CSS.

| # | Section Title | Contents & Statutory Anchors |
|---|---------------|------------------------------|
| **1** | **Case Overview & Scope** | Case identifiers, active filters, entity/edge/record counts, date range. |
| **2** | **Entity Roster & Influence** | Full inventory of persons, phones, accounts, vehicles with descriptive influence metrics. |
| **3** | **Visual Identity Verifications** | Biometric gallery audit: reference photos, probe queries, SCRFD detector landmarks, AdaFace IR-101 512-D embeddings, similarity scores, investigator confirmation/rejection audit trail. |
| **4** | **Supporting Evidence Manifest** | Itemized table of all primary evidence spans: Evidence ID, Record ID, Entity/Edge, Span/Row, and Raw Text. |
| **5** | **Relational Graph Visualization** | High-resolution embedded PNG snapshot (`data:image/png;base64,...`) of Cytoscape canvas with timestamp. |
| **6** | **Provenance & Evidence Trails** | Multi-hop connection explanations with verbatim document quotes and path indices. |
| **7** | **Analytical Leads & Pattern Detections** | Factual pattern alerts (R1–R7) with participating entities, rule criteria, and review statuses. |
| **8** | **Contradiction Analysis** | Inconsistency flags: temporal overlaps, impossible travel, conflicting alibis, role contradictions. |
| **9** | **Counterfactual Impact Assessment** | In-memory What-If simulation report: excluded elements, degree deltas, resolved alerts, surviving network metrics. Watermarked with `SIMULATION VIEW`. |
| **10** | **Investigative Gaps & Missing Leads** | Unresolved identifiers, single-source leads, uncorroborated phone numbers/accounts. |
| **11** | **Network Evolution Radar** | Structural mutations across evidence ingestion batches (density, diameter, community shifts). |
| **12** | **Audit Chain Integrity Verification** | Cryptographic audit ledger verification status, genesis block hash, ledger head hash, entries checked. |
| **13** | **Electronic Record Provenance & BSA 2023 Section 63 Template Certificate** | Complete graph data JSON SHA-256 digest, source manifest digest, statutory Part A (Device Custodian) and Part B (Technical Expert) certificates under Section 63(4) of Bharatiya Sakshya Adhiniyam, 2023. Explicitly labeled **NOTICE: TEMPLATE ONLY — Software cannot self-certify legal admissibility**. |
| **14** | **Analytical Limitations & Procedural Safeguards** | Clear disclaimer that rules, clusters, and candidate face matches provide leads only, not determinations of guilt or criminal liability. |

### 3. In-App Dossier Customization & Live Preview
- **Section Selection Checklist:** Investigators can select/deselect individual sections or use **`[Select All]`** / **`[Reset to Default]`**.
- **Live Preview Modal:** Clicking **`[Preview Dossier]`** generates and renders the formatted dossier inside a responsive, full-screen dialog before downloading.
- **Export Options:** **`[Print / Save to PDF]`** triggers the browser's native print engine with `@media print` page breaks; **`[Download HTML]`** exports an offline archive.

---

## Verification & Test Results

### 1. Backend Verification (Maven)
- **Total Tests:** 68
- **Failures / Errors:** 0
- **Key Test Classes:**
  - `VisualForensicsAndDossierTest`: Validates audit chain verification, broken chain detection, all 14 dossier sections, HTML escaping (preventing XSS), counterfactual simulation reporting, and BSA 2023 template notices.
  - `VisionTest`: Validates SCRFD face detection, AdaFace IR-101 embedding generation, candidate matching, RBAC restrictions, and audit logging.
  - `WorkflowTest`, `ApiTest`, `StoreTest`: Verify graph analytics, ingestion, and persistence.

### 2. Frontend E2E Verification (Playwright)
All 20 test specifications in the Playwright suite pass cleanly:
```text
Running 20 tests using 1 worker

  ✓   1 e2e/completion.spec.ts: session gate, role controls and expired download (2.2s)
  ✓   2 e2e/completion.spec.ts: persistent workflow, narrative source, simulation, playback and exports (11.1s)
  ✓   3 e2e/completion.spec.ts: manual playback reveals dated events including reduced motion and mobile (1.3s)
  ✓   4 e2e/completion.spec.ts: quality does not invent missing F1 and audit verification reports failure (1.7s)
  ✓   5 e2e/completion.spec.ts: malformed stored sessions return to sign in with synthetic banner (925ms)
  ✓   6 e2e/intelligence-suite.spec.ts: Investigation Intelligence Suite: full walkthrough across all 6 capabilities (11.8s)
  ✓   7 e2e/investigation.spec.ts: clean investigation: evidence → network → review → report (8.8s)
  ✓   8 e2e/investigation.spec.ts: file upload isolates bad rows, deduplicates, and escapes source text (4.2s)
  ✓   9 e2e/investigation.spec.ts: mobile and reduced-motion layout remains usable (1.5s)
  ✓  10 e2e/investigation.spec.ts: tactical extensions: 3D canvas toggle, Intel Copilot queries, and BSA 2023 provenance statement (5.9s)
  ✓  11 e2e/investigation.spec.ts: live incoming FIR: streaming ingestion, cross-case linkage, latency telemetry, and retraction (5.8s)
  ✓  12 e2e/review-regressions.spec.ts: changing case filter realigns playback cutoff and graph (1.1s)
  ✓  13 e2e/review-regressions.spec.ts: meta communities obey filters and note drafts survive watchlist changes (1.3s)
  ✓  14 e2e/review-regressions.spec.ts: incoming graph changes refresh workflow and reset playback (1.4s)
  ✓  15 e2e/session-races.spec.ts: old download 401 cannot clear a newer session (979ms)
  ✓  16 e2e/session-races.spec.ts: old identity refresh cannot overwrite a newer session (886ms)
  ✓  17 e2e/ui-refinement.spec.ts: workflow text is readable and mobile navigation stays inside the viewport (1.5s)
  ✓  18 e2e/visual-forensics.spec.ts: Visual Forensics & Judicial Dossier: full verification across all 4 capabilities (10.0s)
  ✓  19 e2e/visual-identity.spec.ts: empty database → EMPTY_GALLERY state → viewer RBAC check → responsive seeding → Aariv CCTV candidate match (15.5s) [Similarity: 0.928]
  ✓  20 e2e/visual-identity.spec.ts: visual identity search: sample fixture → candidate detection → confirmation modal → history (12.8s)

  20 passed (1.7m)
```

---

## Step-by-Step Judge & Court Demonstration Guide

To demonstrate the Visual Forensics capabilities to an investigator or judicial officer:

### Step 1: Demonstrate Historical Replay
1. Navigate to **Investigation Intelligence** &rarr; **Investigation Replay**.
2. Click **`[View on Graph]`** to activate the canvas HUD.
3. Use the playback scrubber or click **`[Play]`** to observe the chronological unfolding of connections.
4. Point out the glowing emerald pulse (`.replay-new`) indicating incoming evidence.
5. Click **`[Exit Replay]`** to return to the canonical workspace.

### Step 2: Demonstrate Counterfactual Analysis (Safe Ghosting)
1. In the **Entity Inspector**, select an entity (e.g., `SYN-PHONE-001`) and click **`[Simulate Exclusion]`**.
2. Point out the red warning banner: `SIMULATION MODE — Canonical investigation unchanged`.
3. Switch between **`[Canonical]`**, **`[Simulation]`**, and **`[Overlay]`**.
4. In **`[Overlay]`**, observe the ghosted nodes (dashed grey border) and severed edges (dashed red line).
5. Highlight the **SIMULATION IMPACT** card in the Inspector showing the degree delta and resolved alerts.
6. Click **`[Exit Simulation]`** and demonstrate that the canonical graph is completely unaltered.

### Step 3: Demonstrate "Why Are These Connected?" (Evidence Trail)
1. Click entity `SYN-PERSON-001`, then click another entity `SYN-PERSON-002`.
2. Click **`[Why Are These Connected?]`** in the Inspector.
3. Observe how the background graph dims to **12% opacity**, while the connecting path illuminates in **vibrant cyan**.
4. Click the path edge to open the **Evidentiary Connection Callout Card**.
5. Read the verbatim source excerpt and click **`[Open Source Record]`** to verify the underlying FIR.
6. Click **`[Clear Evidence Highlight]`** to restore normal graph opacity.

### Step 4: Verify Audit Chain of Custody & Generate Judicial Dossier
1. Navigate to **Audit** and click **`[Verify Chain of Custody]`**.
2. Show the **`AUDIT CHAIN VALID`** banner, Genesis Block Hash, and Head Hash.
3. Navigate to **Reports**.
4. Check the desired sections (or click **`[Select All]`**).
5. Click **`[Preview Dossier]`** to view the full 14-section judicial report in the live preview modal.
6. Scroll to **Section 12 & 13** to show the **Electronic Record Provenance Statement** and the **Bharatiya Sakshya Adhiniyam, 2023 (BSA 2023) Section 63 Template Certificate**.
7. Emphasize the mandatory warning: **Software cannot self-certify legal admissibility; human custodian sign-off is required**.
8. Click **`[Print / Save to PDF]`** or **`[Download HTML]`** to export the official file.
