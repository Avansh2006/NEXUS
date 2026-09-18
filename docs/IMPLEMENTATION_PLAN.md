# Implementation plan

Commit every completed step; push after 2–3 steps once remote is known.
Every slice must retain the previous runnable demo. Verification gaps are explicit.

| Step | Files/dependencies | API/DB | Acceptance and tests |
|---|---|---|---|
| 0 Contract | docs, Git ignore; no dependencies | API.md | consistent canonical types/rules/formula |
| 1 Seed + skeleton | data/demo, scripts, Compose, backend, frontend; JDK/Maven/Node/Postgres | /demo/load,/graph; source/node/edge/evidence | seeded graph rendered; reproducible seed |
| 2 Ingestion | backend parsers, intelligence spaCy | /data/*,/extract; source hashes | raw inputs yield graph; row/duplicate/extraction tests |
| 3 Analysis | intelligence NetworkX/rules, backend client | /analyze,/clusters,/influencers,/suspicious-patterns; app_state | R1–R6 pos/neg, planted truth, suppression, repeatability |
| 4 Workspace | React/Cytoscape/fcose | /entities/*,/network/* | filters, focus, search, evidence, before/after |
| 5 Demo | reset/load controls, seed | /demo/reset | clean replay, offline runtime |
| 6 Review + time | service and UI | /timeline/*,/link-suggestions/*; alias state | ordered events; reversible merge; name non-merge |
| 7 Report | escaped HTML template, graph export | /reports | sources and metrics print correctly |
| 8 Paths + quality | BFS, gold fixtures, UI | /paths,/quality | path evidence; measured P/R |
| 9 Hardening | request filter, handlers, audit UI | /audit; audit_log | validation, limits, safe errors, CORS |
| 10 Rehearsal | tests, scripts, final docs | full contract | clean reset E2E; build; honest final inventory |

## Consistency pass
Names fixed in ARCHITECTURE/API. R1 phone sharing, R2 account sharing, R3 bridges,
R4 financial repetition/fan-in/pass-through, R5 repeated co-location, R6 repeated
co-accusation. Influence weights 0.45/0.35/0.20; score is descriptive.
