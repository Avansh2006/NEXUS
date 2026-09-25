# NEXUS completion implementation plan

> For agentic workers: execute the approved design task by task with tests before implementation and a whole-branch integration review. Independent source extraction, workflow APIs, and frontend work use the dispatching-parallel-agents skill; authentication, deployment, and integration remain with the primary agent.

**Goal:** Deliver the approved synthetic investigation features on `feat/deva` and verify them on the dedicated Azure VM.

**Architecture:** Retain the current three-service architecture and relational evidence graph. Add isolated services/controllers for workflow and structural/export functions; keep presentation in dedicated React components. Authentication is enforced at the API boundary and shared by all clients.

**Tech Stack:** React 19/TypeScript/Vite, Spring Boot/Java 17, PostgreSQL 16, Python 3.12/FastAPI.

**Spec:** `docs/superpowers/specs/2026-09-23-completion-design.md` (approved).

## Global constraints

- Branch `feat/deva`; existing Azure test VM only.
- Synthetic data, descriptive human-reviewed leads, no guilt/enforcement assertions.
- Existing record/evidence identifiers and original source text must survive reconstruction.
- Authenticated role enforcement, attributed transactional mutations, no credentials in logs or Git.
- 500 records per batch, 10,000 narrative characters; no unbounded source ingestion.
- Debugger listeners bind to loopback and are opt-in; no production debug ports.

## Review focus

1. Expired sessions and failed downloads must return to login without downloading error documents (auth/browser tests).
2. Concurrent triage changes return 409 instead of losing an update (workflow integration test).
3. Emoji preceding Hindi evidence must not shift Java/frontend highlighted spans (extraction/graph test).
4. Formula-like labels and XML special characters must survive safe exports (export round-trip tests).
5. Empty/disconnected/time-filtered graphs must not crash playback or mutate persisted simulation state (analysis/browser tests).

## Task 1: Authentication, attribution, and diagnostics

Files: `Auth.java`, `RequestGuard.java`, `ApiController.java`, `ApiErrors.java`, new `DiagnosticsController.java`, `pom.xml`, application properties, compose/environment settings, `ApiSecurityTest.java`, new `AuthTest.java`.

Interface: login POST accepts `{username,password}` and returns `{token,username,role,expiresAt}`; GET `/api/auth/me` returns authenticated identity. Only `/api/health` and `/api/auth/login` are public. ADMIN owns `/api/demo/*`; VIEWER may POST reports and structural simulation, but cannot mutate investigation data. `/api/diagnostics` is ADMIN-only and reports database/engine availability and runtime versions.

- [x] Add anonymous-protected-route and real-login regression tests; run `mvn -f backend/pom.xml -Dtest=ApiSecurityTest test` against baseline and retain expected failures.
- [x] Add maintained JWT/BCrypt libraries. Configure `NEXUS_JWT_SECRET`, `NEXUS_ADMIN_PASSWORD_HASH`, `NEXUS_INVESTIGATOR_PASSWORD_HASH`, `NEXUS_VIEWER_PASSWORD_HASH`; refuse incomplete configuration. Validate issuer, expiry, subject, and role.
- [x] Remove fixed tokens/header roles and anonymous fallback. Rate-limit login attempts and authenticated mutations, retain body/UTF-8/CORS guards, and attach server-generated request IDs.
- [x] Attribute store audit calls from the authenticated request; suppress secrets/source text in error logging. Add admin diagnostics with explicit unavailable statuses.
- [x] Re-run focused Java tests; verify successful login, wrong password, token expiry, and each permission boundary.

## Task 2: Source coverage, extraction, evidence support

Files: `InvestigationService.java`, `GraphBuilder.java`, `EngineClient.java`, `extraction.py`, `app.py`, new focused Python and Java tests, synthetic multilingual evaluation fixtures/script.

Interface: narrative kinds `fir`, `criminal-history`, `intel-report`, `surveillance-report`; required `caseId,date,text`; optional `sourceReliability`, `informationCredibility`. Graph node/edge properties expose `support` with `level`, independent record/source-kind counts, minimum extraction confidence, and credibility assessment. SocialHandle IDs use platform and normalized handle.

- [x] Write and run red tests for additional narratives, invalid supplied grades, conservative Hindi cues, SocialHandle/UPI ambiguity, and non-BMP source offsets.
- [x] Extend normalized ingestion and pure graph reconstruction while preserving row isolation and duplicate handling. Convert code-point offsets once at the Python/Java boundary.
- [x] Compute deterministic evidence-support fields from independent source records using the exact thresholds in the spec; Low edges remain explicitly low even when repeated spans exist.
- [x] Add separate Hindi/Hinglish evaluation fixtures and metrics without modifying frozen held-out samples; run extraction, graph, and ingestion tests.

## Task 3: Persistent investigator workflow

Files: new `WorkflowService.java`, `WorkflowController.java`, workflow schema and Store reset/attribution changes, new `WorkflowTest.java`.

Interfaces:

```text
GET /api/workflow -> {notes: Note[], watchlist: string[], triage: Triage[]}
GET /api/entities/{id}/notes -> Note[]
POST /api/entities/{id}/notes {text} -> Note
GET /api/watchlist -> string[]
POST /api/entities/{id}/watchlist {watched:boolean} -> {watched:boolean}
POST /api/alerts/{id}/triage {status,version} -> Triage
Note = {id,entityId,text,author,createdAt}
Triage = {alertId,status,version,author,updatedAt}
```

- [x] Write red tests for persistence, blank/oversized notes, unknown IDs, per-user watchlists, stale version conflicts, merge/undo note visibility, and reset.
- [x] Add separate workflow tables and transactional APIs. Preserve stable-ID state across graph rebuilds; retain original note entity IDs and resolve aliases only when reading.
- [x] Apply attributable audit entries in each mutation transaction. Re-run workflow tests with H2 and verify PostgreSQL persistence in the integrated VM suite.

## Task 4: Structural simulation and safe exports

Files: new `GraphTools.java`, `GraphToolsController.java`, `GraphToolsTest.java`.

Interfaces:

```text
POST /api/what-if/remove {entityIds:string[]} ->
 {before:{components,largestComponent,isolatedNodes},
  after:{components,largestComponent,isolatedNodes},
  removedEdges,articulationPoints:string[],removedEntityIds:string[]}
GET /api/exports/nodes.csv
GET /api/exports/edges.csv
GET /api/exports/graph.graphml
```

- [x] Write red tests for disconnected/cycle/bridge/isolated graphs, one-to-20 unique valid non-Case IDs, and graph immutability.
- [x] Implement undirected structural analysis excluding Case nodes/membership edges, with deterministic result ordering.
- [x] Write export tests for quotes/newlines, formula-prefixed labels, XML metacharacters, and parseable GraphML keys/evidence/support fields.
- [x] Implement CSV neutralization and XML writer exports with authenticated downloads, content types, filenames, and audit entries. Run graph-tools tests.

## Task 5: Frontend integration

Files: `types.ts`, `App.tsx`, `Inspector.tsx`, `NetworkGraph.tsx`, new auth/workflow/playback components, CSS, browser tests.

- [x] Add browser assertions for login/logout/session expiry before implementing the auth gate. Share bearer credentials across JSON and download requests and clear on 401.
- [x] Integrate role-aware controls and diagnostic access. Add narrative upload choices, credibility display, support explanations, SocialHandle colors, and dashed Low-support edges.
- [x] Integrate notes/watchlist/triage with visible loading and error states, version conflict handling, and refresh after graph changes.
- [x] Add manual-first playback with play/pause, scrubber, speeds, timer cleanup, filter interaction, and derived graph/events only. Preserve graph layout positions where possible.
- [x] Add selected-entity simulation and full-graph export controls. Test empty states, mobile/reduced motion, real downloads, and no persisted graph changes after simulation/playback.
- [x] Run TypeScript build and focused browser tests, then the full five existing journeys plus new journeys.

## Task 6: Reproducible deployment and complete verification

Files: `scripts/test-azure.sh`, new credential setup helper, `scripts/verify_demo.py`, `.github/workflows/ci.yml`, compose/render/local launcher, API/security/testing/feature documentation.

- [x] Generate ephemeral test passwords and BCrypt hashes on the VM into ignored files, keep existing database password, and pass credentials to service/test processes without printing them.
- [x] Update all rehearsal clients to log in; ensure browser tests use generated accounts and new permission semantics.
- [x] Upload only source changes to `/home/nexus/NEXUS`; run Python tests, Java tests, strict frontend build, PostgreSQL Compose stack, API rehearsal, and Playwright with collected exit codes.
- [x] Verify workflow persistence across API/database restart and service-unavailable recovery. Record debugger configuration validation separately from interactive breakpoint attachment.
- [x] Review diff and tests, resolve findings, update truthful feature/limitation inventory, collect logs and screenshots locally, and record the source manifest.
- [x] Commit using the user's configured repository identity when available; do not invent authorship. Leave all work on `feat/deva`, and report any remaining identity/remote-push limitation explicitly.

Final verification: see `docs/AZURE_COMPLETION_RESULTS.md`. Interactive debugger attachment remains untested; configuration and script syntax were checked. Delivery remains on `feat/deva` without merging.
