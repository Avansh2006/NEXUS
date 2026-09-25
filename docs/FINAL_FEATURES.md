# Feature inventory

This inventory describes implemented source behavior. It does not replace the final
integrated test report. Use current logs and source revision to determine which checks
passed on a particular environment.

## Investigation and evidence

- Synthetic-data banner and React/TypeScript workbench with dashboard, ingestion,
  graph, inspector, alerts, communities, timeline and reports.
- FIR, criminal-history, intelligence-report and surveillance-report narratives;
  CSV/JSON call-detail and financial records; multi-file uploads; per-row errors and
  normalized duplicate detection within bounded requests.
- Conservative rule-based extraction with synthetic identifiers, Hindi/Hinglish cues,
  Devanagari digit normalization, explicit platform social handles, original text and
  extraction confidence. Python code-point offsets are converted to Java/JavaScript
  UTF-16 offsets at the service boundary.
- Exact-identifier resolution, corroborated person matching, human-reviewed possible
  matches, provenance-retaining aliases and reversible merge/undo.
- Evidence-support badges and explanations on entities/relationships. Support uses
  independent record count, source-kind diversity, minimum extraction confidence,
  and supplied credibility. Unassessed grades remain explicit; Low edges are dashed.
- Degree, betweenness, seeded Louvain communities, descriptive influence, R1-R7
  pattern explanations and visible public/service suppression. Patterns are leads for
  review, not guilt labels or predictions.
- Search, type/case/location/crime/date filters, focus, path evidence, case links,
  2D graph, optional 3D view, graph-grounded deterministic copilot, and reduced-motion
  presentation. The copilot does not call an external LLM.

## Workflow and playback

- Persisted entity notes with author/timestamp and plain-text rendering.
- Per-user watchlists and alert triage: New, Under Review, Verified, Dismissed.
  Verified means reviewed, not established wrongdoing. Concurrent stale triage updates
  return 409; initial version is zero.
- Workflow survives reanalysis for stable identifiers. Merge reads expose original
  entity notes through the canonical entity; undo retains their original ownership.
  Reset clears investigation workflow. Obsolete alert triage is hidden from active lists.
- Manual-first playback with play/pause, scrubbing and 0.5x/1x/2x speeds. Only revealed
  dated events and their edges appear; the view respects filters. Timers stop on page
  exit/data changes/completion. Playback does not change stored evidence or analysis.
- Selected-entity structural removal panel with before/after component size/count,
  isolates, removed edges and articulation status. The API accepts one to twenty unique
  existing non-Case IDs. Simulation excludes Case membership and never mutates the graph.

## Output, access and operations

- Authenticated HTML reports with evidence, optional displayed graph image, provenance
  text and browser Print to PDF. Any embedded certificate form remains a template;
  NEXUS does not certify its legal sufficiency.
- Authenticated nodes/edges CSV and GraphML exports with evidence/support fields,
  deterministic ordering, spreadsheet formula neutralization and XML escaping.
  Report data and graph exports cover the full graph irrespective of playback/filters;
  report images show the displayed view.
- Configured BCrypt prototype accounts, signed expiring JWTs, login/logout/expiry UI,
  role-aware controls and backend permissions. Administrator-only demo/diagnostics.
- Attributed hash-chained audit, audit actor display and verification UI with explicit
  failed checks. Hash-chain consistency is not independent source certification.
- Separate frozen held-out and synthetic Hindi/Hinglish quality results. Missing metrics
  show Unavailable; there is no hard-coded success or F1 fallback.
- Administrator service diagnostics, request IDs, VS Code debugging configurations,
  repository-relative local startup and dedicated new Azure VM verification tooling.

## Deliberate limitations

Extraction remains regex plus a blank spaCy EntityRuler and small gazetteers. Neither
synthetic nor held-out measurements establish general multilingual accuracy. Identity
resolution is not a learned identity model; there is no full merge-history screen.
Timeline date filtering is a single-date filter plus event playback, not an arbitrary
date-range editor. The UI simulates one selected entity at a time. PDF creation uses
browser print. There is no separate precomputed-analysis cache for engine outages.

No production SSO/tenant isolation, live government/bank/telecom integration, crime
prediction, facial recognition, autonomous enforcement or formal security certification
is included. See [security](SECURITY.md), [API](API.md), [testing](TESTING_GUIDE.md), and
[debugging](DEBUGGING.md) for operational boundaries and verification commands.
