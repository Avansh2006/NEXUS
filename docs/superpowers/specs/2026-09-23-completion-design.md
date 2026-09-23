# NEXUS completion design

## Objective and accepted scope

Complete the existing synthetic-data investigation workbench on branch
`feat/deva`, add usable debugging support, and verify
the complete workflow on a new dedicated Azure VM in Animesh's subscription. Preserve
React/TypeScript, Spring Boot/Java 17, PostgreSQL 16, and Python 3.12/FastAPI.
The user approved the feature scope on 2026-09-23. This document defines the
implementation boundaries and acceptance criteria for detailed design review.

The application remains a prototype using synthetic records. Descriptive
patterns and structural simulations must not imply guilt, predicted crime,
or recommended enforcement. Existing ingestion, reversible resolution,
evidence navigation, reports, and demo replay must continue working.

## Findings verified against source

- Authentication endpoints exist, but requests without credentials become
  administrators. Role headers and fixed synthetic tokens are accepted.
  The frontend request helper does not attach credentials.
- JWT signing uses a source-code constant and tokens have no expiry.
- Ingestion accepts FIR, CDR, and transactions only. Additional sources,
  persistent investigator workflow, and graph export routes are absent.
- Timeline displays events but has no playback controls.
- Devanagari digit normalization and several Hinglish cues already exist.
  Extend and test them rather than replace working extraction.
- Audit hashing exists, but most callers attribute activity to `system`.
- Python tests cannot collect locally because FastAPI is missing. Maven is
  unavailable on PATH and the installed Java launcher fails to start.
- Existing documents disagree about implemented features and test coverage;
  completion claims must be rewritten using fresh test evidence.

## 1. Authentication and attributed activity

Replace implicit administrator access with required authentication for `/api`
except health and login. Use a maintained JWT implementation with an
environment-provided signing secret, expiry, issuer, and validated role claims.
Remove role-header authentication and fixed synthetic bearer tokens. Demo
accounts remain explicit prototype accounts; password hashes and signing
secrets come from environment configuration, not committed values.

Add login/logout and session-expiry handling in a dedicated frontend component
and request helper. Keep the bearer token in memory/session storage, never in
URLs or logs. Authenticated downloads use the same helper. A 401 clears the
session and returns to login; a 403 displays a permission error.

VIEWER can read and export. INVESTIGATOR can ingest, analyze, resolve matches,
and update triage, notes, and watchlists. ADMIN additionally controls demo
reset/load/retraction. UI controls reflect permissions; backend checks are
authoritative. Mutation audit records use the authenticated principal.

## 2. Additional evidence sources and confidence

Extend `/api/data/{kind}` with `criminal-history`, `intel-report`, and
`surveillance-report`. These narrative sources use `caseId`, UTC `date`, and
`text`, with optional `sourceReliability` (A–F) and `informationCredibility`
(1–6). Retain the existing 500-record batch and 10,000-character narrative
limits, independent row errors, normalized duplicate detection, and original
source text. Reject malformed supplied grades rather than silently replacing
them. Missing grades are displayed as unassessed, not reliable.

Add SocialHandle extraction only for explicit platform/handle context, avoiding
UPI/account ambiguity. Use platform plus normalized handle as the hard key.
Narrative source types remain source records rather than invented people.
New graph relationships retain source IDs and evidence spans, and appear in
the inspector, source upload options, graph legend, and exports.

Calculate transparent evidence-support badges from independent source-record
count, source-kind diversity, minimum extraction confidence, and assessed
credibility. High requires at least two independent records, two source kinds,
minimum extraction confidence 0.9, and no unknown/low credibility. Medium
requires two independent records and minimum extraction confidence 0.8 without
low credibility. All other cases are Low. E/F reliability or credibility 5/6
counts as low. Show the contributing values and rule, explicitly label this
as evidence support rather than a probability of truth. Low-support edges use
dashed styling. Multiple spans from one record do not count as corroboration.

## 3. Investigator workflow

Add dedicated database tables for entity notes, per-user watchlist entries,
and alert triage. Do not store workflow state in graph output that is replaced
on reanalysis. Notes contain text (1–4,000 characters), author, entity ID, and
server timestamp; render text without HTML interpretation. Watchlists are
user-specific and idempotent. Triage statuses are New, Under Review, Verified,
and Dismissed; Verified means the lead was reviewed, not that guilt is proved.

Use `/api/entities/{id}/notes` for GET/POST, `/api/entities/{id}/watchlist` for
POST with `{watched: boolean}`, `/api/watchlist` for GET, and
`/api/alerts/{id}/triage` for POST with `{status, version}`. Read workflow state
through `/api/workflow`. Reject unknown entity/alert IDs and unsupported
statuses. Use optimistic versions for triage; stale updates return 409.
Persist workflow changes and attributed audit records in one transaction.

Reanalysis preserves workflow for stable IDs; hide obsolete alert state from
the active list. Reset explicitly clears investigation workflow. Merge/undo
must retain notes attached to the original source entity and expose them
through the canonical entity while that merge is active.

## 4. Timeline playback

Add a reusable playback component with play/pause, scrubber, current timestamp,
and 0.5×/1×/2× speeds. Build a sorted list of valid event instants. Scrubbing
reveals only events at or before the selected instant; graph edges appear
when they have a revealed event. Filter nodes consistently with revealed
edges and existing filters. Empty and single-instant timelines remain usable.

Apply playback to a derived graph view, never the persisted graph. Preserve
layout positions when possible. Pause on reset/data changes, page exit, and
completion. Reduced-motion users receive manual scrubbing by default; playback
requires their explicit action. Remove timers on unmount. Full reports/exports
remain full-graph operations and say so beside their controls.

## 5. Structural removal simulation

Add `POST /api/what-if/remove` with `{entityIds: string[]}`, one to 20 unique
existing non-Case IDs. Compute undirected connected components before and
after virtual removal, excluding Case nodes and CONNECTED_TO_CASE edges so
case membership does not create artificial connectivity. Return component
counts, largest component sizes, isolated nodes, removed edge count, and
whether each selected node is an articulation point in the original graph.

Never mutate graph, evidence, sources, or analysis. Provide a selected-entity
simulation panel with explicit before/after quantities and a structural-only
disclaimer. Reject empty/unknown selections. Test disconnected graphs, cycles,
bridges, isolates, all selected nodes removed, and repeated requests.

## 6. Exports

Add authenticated GET `/api/exports/nodes.csv`, `/api/exports/edges.csv`, and
`/api/exports/graph.graphml`. Include IDs, types, labels, evidence identifiers,
timestamps where applicable, and evidence-support fields. Preserve stable ID
relationships and deterministic ordering. Escape CSV quotes/newlines and
neutralize spreadsheet formula prefixes; use an XML writer for GraphML with
declared keys and namespace. Return correct content types and attachment
filenames. Audit exports. Browser controls handle errors before downloading.

## 7. Hindi and extraction correctness

Keep one-to-one digit normalization so source offsets continue to refer to
the original text. Add explicit Hindi person/account cues and conservative
name boundaries with punctuation or known terminators. Preserve account
precedence over phone-shaped numbers. Do not infer identities from unbounded
adjacent prose. Verify Java source slicing with non-BMP characters before
extracted entities: Python code-point offsets and Java UTF-16 indices must be
converted at the service boundary without corrupting stored evidence.

Add separate synthetic Hindi/Hinglish samples and report their exact-match
span metrics independently of the frozen held-out evaluation. Do not rewrite
held-out gold data or claim general multilingual accuracy.

## 8. Debugging and operational visibility

Add VS Code launch/attach configurations for browser source maps, Java JDWP,
and Python debugpy, with matching local tasks and documented prerequisites.
Debugger listeners bind to loopback and are opt-in; no production debug ports.
Add request correlation IDs, structured error logging without tokens, full
source text, or secrets, and an authenticated admin diagnostics view reporting
service availability and versions. Failures remain explicit; a reachable Java
health endpoint alone must not imply Python or database readiness.

Update local startup to remove user-specific paths and document test commands,
environment variables, service logs, attaching breakpoints, and trace retrieval.

## 9. Azure VM verification

The user requested creation of a new VM rather than reuse of an existing VM.
Use Animesh's signed-in Azure subscription and resource group
`nexus-deva-test-rg`, with VM `nexus-deva-test-vm`. Restrict SSH to the client's
public IP and configure daily shutdown. Inspect OS, disk, Docker availability, active containers,
and occupied ports. Use a unique checkout, Compose project, volume names, and
unused loopback-bound port. Preserve existing workloads and network rules.
Access the test UI through SSH forwarding. Generate test secrets on the VM;
never commit or print them. Use synthetic data only.

Run Python unit/contract tests, Java unit/API/integration tests, strict
TypeScript production build, and Playwright browser journeys against the
PostgreSQL-backed stack. Capture commit ID, runtime versions, exit codes,
test counts, duration, browser traces/screenshots, and logs in ignored
`artifacts/`. Re-run demo rehearsal after new features, exercise persistence
across container restart, and check service-unavailable recovery. Collect
evidence locally. Cleanup may remove only this task's test containers/volumes.

## Acceptance and delivery

Each subsystem gets failing regression tests before implementation, focused
checks after changes, and integration coverage before being marked complete.
Browser tests cover login/expiry/roles, ingestion errors and duplicates, new
sources, notes/watchlist/triage persistence, playback, simulation immutability,
exports, report generation, mobile layout, and reduced motion. Tests use
synthetic fixtures and controlled time, not wall-clock performance assertions.

Deliver committed source on the new branch, debugger configurations, updated
API/setup/feature documentation, and an honest test report separating local
checks from Azure checks. A missing VM connection blocks Azure verification,
not a claim that it passed. Production SSO, tenant isolation, real integrations,
and legal certification remain outside this prototype's scope.
