# Testing NEXUS

All fixtures are synthetic. Rehearsal and integrated browser tests reset or mutate the
investigation; run them in a dedicated workspace. Implementation availability is not
proof of an integrated pass. Record the source revision, environment, test counts,
duration, exit codes and artifacts from each actual run.

## Set up a stack

Docker Compose is the PostgreSQL-backed path. Python is needed locally for credential
setup; application Java/Python/Node runtimes are provided by container images.

```powershell
python -m pip install -r scripts/requirements-dev.txt
python scripts/setup_credentials.py
docker compose up --build -d
docker compose ps
docker compose logs --tail=30 api intelligence
```

Setup generates ignored `.env` and `.tools/credentials.json`, including the JWT secret,
BCrypt hashes and generated local/test account passwords. It prints paths rather than
secrets. Open the private credentials file locally to sign in; do not paste it into
logs or source control. Complete existing settings are retained.

Open `http://localhost:8080` and sign in as `admin`. The public
`/api/health` endpoint checks API liveness only. Open **Diagnostics**, then
**Refresh diagnostics** to inspect database and intelligence availability separately.
No default password or anonymous administrator session exists.

For native Windows development, use PowerShell 7, Java 17+, Maven 3.9+, Python 3.12,
Node 22+ and pnpm 11:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r intelligence/requirements.txt -r scripts/requirements-dev.txt
.\.venv\Scripts\python.exe scripts/setup_credentials.py
Set-Location frontend
pnpm install --frozen-lockfile
Set-Location ..
.\scripts\start-local.ps1
```

The launcher reads `.env`, uses repository-relative paths and installed tools, and
writes service logs to `artifacts/`. Keep its terminal open; Ctrl+C stops the children.
`-NoBuild` skips a previously successful backend build. This local profile uses H2 in
PostgreSQL mode; it does not substitute for PostgreSQL integration checks.
Local API: `http://localhost:8081/api`; intelligence: `http://localhost:8000`.
Use the configured browser origin, normally `http://localhost:8080`.

## Credentials for command-line tests

The API needs `NEXUS_JWT_SECRET` and all three `NEXUS_*_PASSWORD_HASH` variables.
Rehearsal/browser clients need plaintext `NEXUS_ADMIN_PASSWORD`,
`NEXUS_INVESTIGATOR_PASSWORD`, and `NEXUS_VIEWER_PASSWORD` to perform real login.
Keep plaintext test variables out of production API configuration.

Load the generated passwords into the test process without printing them:

```powershell
$testAccounts = Get-Content -LiteralPath .tools/credentials.json -Raw | ConvertFrom-Json
foreach ($testRole in @('admin','investigator','viewer')) {
    [Environment]::SetEnvironmentVariable(
        "NEXUS_$($testRole.ToUpperInvariant())_PASSWORD",
        $testAccounts.$testRole.password,
        'Process'
    )
}
Remove-Variable testAccounts
```

For Linux shells, source only the trusted, private setup-generated environment file
with `set -a; source .env; set +a`. Do not echo secrets or enable shell tracing.
The Azure runner generates and sources its own ignored `.tools/azure/test.env`.

## Automated commands

From the repository root, using the configured Python environment:

```powershell
python -m pytest -q intelligence
mvn -f backend/pom.xml test
python intelligence/evaluate_multilingual.py
Set-Location frontend
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
Set-Location ..
```

Python covers extraction, spans and graph analysis. Java covers authentication,
permissions, ingestion, graph construction, workflow, exports and simulation.
TypeScript/Vite checks production compilation. The multilingual script evaluates
separate committed Hindi/Hinglish fixtures; it does not change frozen held-out labels.

The existing browser journeys exercise investigation, uploads, reporting and
presentation. `e2e/completion.spec.ts` adds session expiry/roles, persistent workflow,
new narratives, non-mutating simulation, exports, diagnostics, playback, quality/audit
honesty, and malformed-session recovery. Controlled mocked tests isolate UI behavior;
real API journeys require configured account passwords. A skipped credential-dependent
test is not an integrated pass. Run all configured tests against the deployed stack
before recording final acceptance.

Browser options:

- `NEXUS_UI_URL` overrides the default `http://localhost:8080`.
- `PLAYWRIGHT_CHANNEL=msedge` or `chrome` selects an installed browser.
- `pnpm exec playwright install --with-deps chromium` installs Linux dependencies.
- Use one worker as configured because real journeys share mutable investigation state.
- Run against a stable build/server; editing files during a Vite test can trigger HMR
  navigation and invalidate browser results.

Authenticated API rehearsal:

```powershell
$env:NEXUS_API = 'http://localhost:8080/api'
python scripts/verify_demo.py
```

Use local port 8081 instead when testing native Java directly. The script logs in as
admin and resets the synthetic workspace. Inspect its exit status and generated
`artifacts/verification.json` and report. Do not infer success merely from the script
starting or the API health endpoint responding.

## Manual acceptance

| Area | Check |
| --- | --- |
| Sessions | Sign in/out; invalid credentials fail; expired API/download requests return to login without downloading error content |
| Roles | Viewer reads/exports/simulates but cannot mutate; investigator changes workflow/analysis but cannot use demo controls or diagnostics |
| Demo | Admin Reset clears data/workflow; Load populates case islands; Analyze yields resolved graph and source-linked leads |
| Ingestion | Each narrative kind accepts valid rows; invalid neighboring rows are isolated; identical normalized records are duplicates |
| Grades | A-F/1-6 supplied grades retained; malformed grades rejected; missing values shown unassessed |
| Evidence | Original Hindi/emoji source slices highlight correctly; explicit social handles remain distinct from UPI/account identifiers |
| Support | Inspect record count, source diversity, confidence and credibility explanation; Low relationships are dashed |
| Resolution | Accept/undo reviewed match; original notes remain associated with their source entity and are readable through active canonical merge |
| Workflow | Save note, watch entity and update triage; reload/reanalyze and verify persistence; stale triage version returns409 |
| Playback | Manual initial view; scrub/play/pause/speed controls; empty/single instant usable; filters respected; leaving page stops playback |
| Simulation | Compare before/after connectivity; Case membership excluded; persisted graph/evidence remain identical |
| Exports | Download nodes CSV, edges CSV and GraphML with authorization; content/evidence IDs valid; formula-like labels safely encoded |
| Reports | Full graph data despite filters/playback; optional PNG reflects displayed view; browser print creates PDF |
| Quality | Missing metrics display Unavailable; held-out and synthetic Hindi/Hinglish results remain separately labeled |
| Audit | Actor/time/action visible; Verify audit chain reports success/failure; unavailable service shows an explicit error |
| Diagnostics | Admin sees independent database/engine status; API-only liveness is not treated as complete readiness |
| Layout | Search, path/focus, 2D/3D controls; keyboard access; 390px layout; reduced-motion manual playback |

Synthetic narrative example for **Intelligence report**:

```json
{"records":[{"caseId":"NXS-077","date":"2026-09-01T00:00:00Z","text":"Phone SYN-PHONE-077; Instagram handle @synthetic_example.","sourceReliability":"B","informationCredibility":2},{}]}
```

Expect one accepted row and one row error; repeat unchanged input to check duplicates.
Additional boundary checks include malformed JSON, invalid UTF-8, oversized bodies,
more than 500 rows, invalid dates/grades, negative numeric values, unsupported workflow
statuses, and unknown entity/alert IDs. Respect the configured rate limits; a 429 is an
explicit result with retry information, not a reason to disable the guard.

## Persistence, failure recovery and Azure

After saving workflow, restart this test stack's API/database containers and verify
state with real authenticated reads. Pause the intelligence service in the dedicated
test stack, verify explicit unavailable results, restart it, and verify recovery.
Record those results separately from unit tests and browser-only mocks. Do not remove
unrelated containers or volumes.

The user-requested new VM is `nexus-deva-test-vm` in `nexus-deva-test-rg`.
[Azure test VM](AZURE_TEST_VM.md) documents provisioning, SSH forwarding, daily shutdown
and the isolated `nexus-deva-test` Compose project. On its dedicated checkout:

```sh
bash scripts/test-azure.sh
```

The runner collects stage logs/exit codes in `artifacts/azure/`, uses versioned container
runtimes and generated test credentials, and leaves its stack available for inspection.
Preserve the exact uploaded revision/source manifest alongside results. See
[Azure completion results](AZURE_COMPLETION_RESULTS.md) for the recorded final
PostgreSQL/Azure run, test counts, and remaining verification limits.

Browser artifacts are under `artifacts/playwright/` and the HTML report under
`artifacts/playwright-report/`. Failed tests retain screenshots and video.
Traces are disabled by default because they can capture credentials. For private
local diagnosis only, set `NEXUS_PRIVATE_TRACE=1`, then use
`pnpm exec playwright show-trace <trace.zip>` inside `frontend`; do not publish traces.
Keep artifacts free of credentials before sharing.

## Debugging and troubleshooting

See [Debugging](DEBUGGING.md) for VS Code React source maps, Java JDWP and Python debugpy.
Listeners are opt-in and loopback-only. Record actual breakpoint attachment separately
from configuration validation. Use a response's `X-Request-ID` to find its structured
server error log without copying source text or bearer tokens.

| Symptom | Check |
| --- | --- |
| API refuses startup | Generate/verify all signing-secret and BCrypt settings; do not replace them with default passwords |
| Sign-in fails | Correct private account password, service configuration, expiry, and 429 retry interval |
| CORS denied | Browser origin matches FRONTEND_ORIGIN; SSH forwarded port changes may require origin configuration |
| Port occupied | Use the intended stack's free loopback port; do not stop unrelated processes |
| Engine unavailable | Intelligence container/process health, installed dependencies and logs |
| Java build cannot replace JAR | Stop the matching native local service before rebuilding on Windows |
| Browser missing | Install the configured Playwright browser/channel and platform dependencies |
| Playback graph empty | Clear filters or choose Show all events; inspect whether source events have valid timestamps |
| Export failed | Inspect visible error/session status; failed HTTP responses must not become downloaded files |
| Database cleanup | Prefer administrator Reset for synthetic investigation state; volume deletion removes persistence |

No load/concurrency certification, production SLA, formal penetration-test result,
legal certification or general multilingual accuracy is implied by these checks.
