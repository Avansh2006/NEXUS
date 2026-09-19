# NEXUS demo

## Start
Copy .env.example → .env; set a local database password; `docker compose up --build`.
Open http://localhost:8080. Runtime needs no internet after images are built.
Wait for intelligence health and API startup; first build downloads dependencies.
Local alternative: README development steps (H2 profile explicitly marked).
On Windows, if Java reports UnixDomainSockets `Invalid argument: connect`, launch
with `-Djdk.net.unixdomain.tmpdir=<short-existing-directory>` before `-jar`.

## Three-minute click script
1. Click reset (circular arrow, top right). Expected: zero counters, empty workspace.
2. Click **Load demo**. Expected: 121 records, 146 entities, 313 relationships.
   Case islands show separate copies of shared identifiers before analysis.
3. Click **Analyze Network**. Actual computed counts appear; canonical identifiers
   connect the islands. The shared phone is selected, one-hop focus enabled.
4. Inspect **SYN-PHONE-001**: NXS-001, NXS-002, NXS-003. R1 explains three people
   across three cases. Inspect supporting FIR records and colored extraction spans.
5. Search **SYN-ACCOUNT-001**. Show the account's cases, incoming transfers and R4.
   Explain fan-in and rapid pass-through as descriptive timing patterns only.
6. Open **Alerts**. Find the suppressed public/service number SYN-PHONE-999.
   Explain that suppression is visible and configurable, not silently hidden.
7. Under possible matches show **Rivan Kesh** entries remain separate. Show Aariv
   Veylan/Veylen as review suggestions. Accept is manual; **Undo merge** restores
   the sources and invalidates analysis. Re-analyze after changes.
8. Open **Dashboard** to see case-link suggestions, then **Investigation → Find path**.
   Choose SYN-PHONE-001 and SYN-ACCOUNT-001; **Trace path**. Show evidence per hop.
9. Click **3D Holo Sphere** on the Tactical HUD to display the interactive 3D WebGL
   force-directed evidence sphere (Three.js) with real-time rotational telemetry.
10. Click the floating **NEXUS Intel Copilot** button (bottom right) to open the deterministic,
    graph-grounded query assistant. Click investigative prompt chips like *"Which entities have the highest betweenness centrality?"*,
    inspect the deterministic explanation citing exact graph metrics, and click the entity badge
    to navigate directly to that node in the inspector.
11. Point out the **Syndicate Hierarchy & Pattern Hypothesis Badge** in the Inspector (e.g., Central Hub, Pass-Through Account, Broker).
12. Click **Generate Investigation Report**. Open downloaded HTML and print/save PDF.
    Includes the graph visual, cases, metrics, alerts, timeline ranges, evidence IDs, original source records,
    and an **Electronic Record Provenance Statement** with automated SHA-256 digests plus a human-officer template certificate under Section 63 of the Bharatiya Sakshya Adhiniyam, 2023 (BSA 2023).
13. Click **Stream FIR NXS-007** in the action bar. Observe live streaming ingestion and cross-case linkage within ~50ms, connecting suspect Karan Bhati to the central syndicate hub SYN-PHONE-001 and Veyra Services. Click the cross-case badge to inspect the shared node, then click **Retract NXS-007** to demonstrate non-destructive rollback.

## Rehearsal and fallback
`python scripts/verify_demo.py` performs a clean API rehearsal and writes
`artifacts/verification.json` and `artifacts/NEXUS-investigation-report.html`.
The GitHub Actions `demo-verification` artifact includes the PostgreSQL run outputs.
Browser fallback files are generated locally under `artifacts/`: `workspace.png`,
`case-islands.png`, `analyzed-network.png`, `alerts.png`, and `nexus-demo.webm`.
These runtime artifacts are ignored by Git. Verify they exist before taking the demo
machine offline; they are not substitutes for the tested live application.
`cd frontend && pnpm test:e2e` regenerates screenshots/video in
`artifacts/playwright/`; see TESTING_GUIDE.md for browser installation and full tests.
If the engine is unavailable, restore it and retry. No fabricated cached analysis is
displayed. A report/screenshots/recording are the presentation fallback.
Do not claim real-world integrations, production security, crime prediction, or guilt.

## Synthetic Credentials & Security Controls
NEXUS ships with synthetic RBAC authentication and tamper-evident audit logging for demonstration:
- **Admin**: `username: admin`, `password: AdminPass123!`, token: `synthetic-admin-token` (Full access).
- **Investigator**: `username: investigator`, `password: Investigator123!`, token: `synthetic-investigator-token` (Full access).
- **Viewer**: `username: viewer`, `password: Viewer123!`, token: `synthetic-viewer-token` (Read-only; POST mutations rejected with 403 Forbidden).
- **Audit Verification**: Run `curl http://localhost:8080/api/audit/verify` to verify the SHA-256 hash-chain across all recorded transactions and actions.
- **Rate Limit Headers**: Requests exceeding 30 mutations/minute receive HTTP 429 with standard `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers.

## Practical limits
30 mutations/minute/client; avoid repeatedly hammering reset/analyze during rehearsal.
Default graph shows top 80 + alert entities; **Expand all** shows the bounded network.
Filters can hide selected nodes; clear filters when exploring another case.
The Reports screen offers an HTML download; browser print is the PDF fallback.

