# NEXUS — complete testing guide
**Network Exploration & eXtraction for Unified Intelligence Systems**
This guide tests the real application, including its PostgreSQL deployment, intelligence engine, UI, and reports. All fixtures are fictional.

## 1. Choose how to run
**Recommended: Docker Desktop / Docker Engine with Compose.** Install Git and Docker; no Java or Python is needed for the app itself.
From the repository root:
```powershell
Copy-Item .env.example .env
# Edit .env: replace POSTGRES_PASSWORD with a local password.
docker compose up --build -d
docker compose ps
docker compose logs --tail=30 api intelligence
```
Open **http://localhost:8080**. The API must respond at **http://localhost:8080/api/health** with `{"status":"ok"}`. The database and engine should be healthy.
Initial builds need internet; the built application does not. Keep `.env` out of Git.

### Alternative: local Windows development
Prerequisites: Java 17+, Maven 3.9+, Python 3.12, Node 22+, pnpm 11. This workspace also contains ignored portable tools under `.tools/`.
```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r intelligence/requirements.txt
Set-Location frontend
pnpm install --frozen-lockfile
Set-Location ..
.\scripts\start-local.ps1
```
Keep that terminal open; use another terminal for tests. `Ctrl+C` stops its services. Use `-NoBuild` after a successful backend build to start faster.
This local profile uses **H2 in PostgreSQL mode**, not PostgreSQL. Use Compose/CI to verify the real storage backend.
Local URLs: frontend `http://localhost:8080`, API `http://localhost:8081/api`, engine `http://localhost:8000`.
Use `localhost` in the browser because CORS is explicitly configured for that origin. Logs are in `artifacts/`.

## 2. Two-minute smoke test
| Action | Expected result |
|---|---|
| Open the app | NEXUS branding, synthetic-data banner, navigation and no error overlay |
| Click top-right **Reset demo data** | Zero source/entity/relationship counters; empty network |
| Click **Load demo** | 121 source records, 146 entities, 313 relationships |
| Inspect graph state | **CASE ISLANDS**; shared identifiers have separate visual copies |
| Click **Analyze Network** | **RESOLVED**; 3 cases linked; 21 active leads; shared phone selected |
| Inspect SYN-PHONE-001 | NXS-001, NXS-002, NXS-003; R1 explanation; influence breakdown |
| Open Alerts | 22 total rule results including one visible public/service suppression |
| Generate Investigation Report | Downloaded HTML opens, includes evidence, and prints to PDF |
Every insight is a lead for human review. A public identifier or a high influence score is not evidence of guilt.

## 3. Automated tests
Run commands from the repository root unless a directory change is shown.
```powershell
# Python extraction, rules, determinism, suppression, gold set: 11 tests
.\.venv\Scripts\python.exe -m pytest intelligence -q
# Java resolution, provenance, validation, limits, CORS, row errors: 8 tests
mvn -f backend/pom.xml test
# Strict TypeScript plus production assets
Set-Location frontend
pnpm build
Set-Location ..
# Reproducible fixtures: expect no diff
.\.venv\Scripts\python.exe scripts/generate_demo.py
git diff --exit-code -- data/demo
```
**API rehearsal resets synthetic data.** It finishes with a clean, analyzed demo. Close conflicting investigations first.
```powershell
# Compose exposes API through port 8080; omit this variable for local port 8081.
$env:NEXUS_API = 'http://localhost:8080/api'
.\.venv\Scripts\python.exe scripts/verify_demo.py
Remove-Item Env:NEXUS_API
```
Success prints `"status":"passed"`; files appear at `artifacts/verification.json` and `artifacts/NEXUS-investigation-report.html`.
The script checks raw loading, planted links, distinct same-name people, duplicates, CSV, all core read endpoints, malformed inputs, deterministic analysis, report output and merge/undo restoration.

### Automated browser tests
Keep the running app open on port 8080. These tests also reset/restore the synthetic demo; run with one worker as configured.
```powershell
Set-Location frontend
pnpm exec playwright install chromium
pnpm test:e2e
pnpm test:e2e:report
```
Three browser tests cover the desktop investigation, file-upload errors/duplicates, and mobile/reduced-motion layout. Successful runs produce screenshots and videos in `artifacts/playwright/`; failures retain traces.
To use installed Chrome instead: run `pnpm exec playwright install ffmpeg`, then `$env:PLAYWRIGHT_CHANNEL='chrome'` before `pnpm test:e2e`.
To use a different UI URL: set `$env:NEXUS_UI_URL='http://localhost:8080'`. Adjust CORS configuration if the origin changes.
On macOS/Linux, use `export NAME=value`, `.venv/bin/python`, and ordinary `cd`; install browser dependencies with `pnpm exec playwright install --with-deps chromium`.

## 4. Manual UI acceptance checklist
| Area | Test and expected outcome |
|---|---|
| Dashboard | Six cases and ranked influence; three case-pair suggestions after analysis; Inspect opens the shared entity |
| Search | Search `SYN-ACCOUNT-001`; click result; correct inspector opens and the graph centers on it |
| Type filter | Choose Person: graph displays people only; All types restores the network |
| Case filter | Choose NXS-001: only that case's members remain; clear for cross-case exploration |
| Extra filters | Filter a crime type, `Navapur Exchange`, or date `2026-09-02`; clear restores results |
| Focus | Select entity, click 1 hop / 2 hops: unrelated nodes dim; Off restores opacity |
| Graph controls | Zoom in/out, Fit network, Expand all/Top entities work; selecting existing nodes does not randomly relayout the graph |
| Tactical HUD | Floating glass bar shows live system beacon ("DETERMINISTIC AI"), node/edge count chips, and view toggle |
| 3D Holo Sphere | Click "3D Holo Sphere" in Tactical HUD: interactive Three.js WebGL sphere renders with coordinate telemetry, drag-to-rotate, node inspection, and orbiting entity nodes; click "2D Graph" returns cleanly |
| Spotlight Cards | Dashboard cards and callouts feature cursor-following radial glowing spotlight borders on hover |
| FIR evidence | Inspector → supporting FIR record; original text contains colored spans; hover exposes type/confidence |
| Account patterns | SYN-ACCOUNT-001 shows fan-in, repeated transfers, rapid pass-through with actual counts and evidence IDs |
| Suppression | Alerts → public/service entry explicitly explains SYN-PHONE-999 suppression |
| Resolution | Rivan Kesh candidates remain distinct; inspect evidence before Accept merge; Undo restores original nodes and invalidates analysis |
| Name variant | Aariv Veylan / Aariv Veylen appears as a suggestion, never an automatic name-only merge |
| Paths | Choose phone SYN-PHONE-001 → account SYN-ACCOUNT-001; Trace path displays the chain and evidence per hop |
| Clusters | Communities show member lists; clicking a member opens the workspace |
| Timeline | Events are chronological in UTC; changing entity limits the list |
| Reports | Generate after viewing a graph; HTML contains PNG, cases, influence, alerts, timeline ranges, evidence IDs, source text |
| Audit | Reports → Refresh shows upload, analysis, view, review and report events |
| Animation | Counters and navigation ease into place; graph fades briefly; controls remain usable |
| Accessibility | Keyboard Tab shows focus; icon-only navigation has labels; OS reduced motion removes decorative animations |
| Mobile | At 390px width, controls remain reachable and no horizontal page scroll occurs |

## 5. Test your own synthetic upload
Select **Data Ingestion → FIR / case narrative**. Paste this JSON, then Ingest records:
```json
{"records":[{"caseId":"NXS-077","date":"2026-09-01T00:00:00Z","crimeType":"Synthetic test","text":"Accused Tavi Molven; phone SYN-PHONE-077; account SYN-ACCOUNT-077; location Navapur Sector 1."},{}]}
```
Expected: **1 accepted, 0 duplicates, 1 rejected row**. The valid FIR appears with highlights. Ingest exactly the same JSON again: **0 accepted, 1 duplicate, 1 rejected row**.
Use the committed `data/demo/cdr.csv` and `transactions.csv` with the corresponding type selectors. After demo loading, they should be counted as duplicates.
| Negative input | Expected behavior |
|---|---|
| Empty records array / malformed JSON | Safe validation message, no stack trace |
| Missing caseId/text/date in FIR | Per-row error; valid neighboring rows still ingest |
| Negative amount, invalid account/phone, invalid timestamp | Per-row error |
| Unsupported extension / file over 2 MiB / invalid UTF-8 | Client rejection or safe server validation error |
| More than 500 rows | Request rejected |
| Repeat record with reordered JSON keys | Duplicate skipped |
| Literal `<script>alert(1)</script>` in FIR | Displayed as text; report HTML escapes it; no script execution |
| More than 30 mutations/minute | HTTP 429; wait for the minute window to expire |
Tests mutate the demo. Reset and Load demo before presenting.

## 6. Accuracy, performance and offline checks
Gold labels: `data/demo/gold.json`. Expected synthetic score: **27 TP, 0 FP, 0 FN; precision/recall 100% on 18 FIRs**. This is not a real-world accuracy claim.
Influence = 100 × (0.45 degree + 0.35 normalized betweenness + 0.20 normalized case count). Analyze twice: metrics, memberships and alerts must match; graph layout positions need not.
Inspect timings in `artifacts/verification.json`. Warm local analysis was about 0.8–1.0 seconds; first load can be slower. No production SLA or large-graph benchmark is claimed.
After the Compose build, disconnect internet and repeat smoke test. Fonts, records, extraction and analysis must still work. Shut down the engine to confirm a clear unavailable-engine message; restart it to recover.

## 7. CI, artifacts and troubleshooting
Every push runs [GitHub Actions](https://github.com/Avansh2006/NEXUS/actions): unit tests, frontend build, fixture regeneration, actual PostgreSQL/Compose rehearsal, and browser tests. Download **demo-verification** for reports, screenshots, videos and traces.
| Problem | Check / fix |
|---|---|
| First page shows unavailable API | `docker compose ps` and `docker compose logs --tail=50 api intelligence`; wait for startup |
| Port already in use | Stop the previous NEXUS process; local and Compose cannot both use 8080 |
| Wrong-origin / CORS error | Open `http://localhost:8080`; FRONTEND_ORIGIN must exactly match |
| PowerShell script execution denied | Run commands manually or use your normal trusted-script policy; no global policy change is required |
| Java UnixDomainSockets error | Use scripts/start-local.ps1; it configures a short temporary socket directory |
| Maven cannot replace JAR | Stop the running local Java service before rebuilding; Windows locks open JARs |
| Engine not available | Confirm port 8000/engine health and installed Python requirements; no external model download is needed |
| Browser executable missing | `pnpm exec playwright install chromium`; for Chrome channel install FFmpeg as above |
| HTTP 429 during repeated tests | Wait one minute; do not disable the rate limiter to hide the failure |
| Graph looks empty after filters | Clear all filters, select Off focus, and Fit network |
| Saved HTML has no graph image | View the graph first, then export; source/evidence report still works without PNG |
| Database reset needed | Use the app's Reset demo data; avoid deleting Docker volumes unless you intend to erase all persisted demo data |
Limitations: no login/RBAC, multilingual NER validation, full date-range UI, server-rendered PDF, load/concurrency stress test, or formal penetration test. See FINAL_FEATURES.md for the complete boundary.
