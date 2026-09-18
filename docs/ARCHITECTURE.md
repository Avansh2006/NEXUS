# Architecture

React/TypeScript/Vite/Tailwind + Cytoscape/fcose → Spring Boot Java 17 REST →
PostgreSQL. Spring calls a stateless FastAPI sidecar using spaCy and NetworkX.
Containers use internal DNS. Nginx serves the frontend and proxies /api.
No pretrained model download: spaCy blank English + EntityRuler, gazetteers,
role-cue patterns and validated identifiers. No LLM is enabled.

## Data model and canonical names
Node types: Person, Phone, Account, Location, Vehicle, Organization, Case.
Edge types: CALLED, TRANSFERRED_TO, SEEN_AT, CO_ACCUSED, OWNS, USES,
CONNECTED_TO_CASE, LOCATED_AT.
`source_record(id, kind, content_hash UNIQUE, payload JSONB)` stores raw input.
`node(id, type, label, properties JSONB)` stores canonical entities.
`edge(id, source_id, target_id, type, properties JSONB)` stores relationships.
`evidence(id, record_id, entity_id, edge_id, properties JSONB)` stores row/spans.
`app_state(id, payload JSONB)` persists analysis and review decisions.
`audit_log(id, action, created_at)` records operations without source text.
Node/edge properties include evidenceIds and caseIds. Edges carry firstSeen,
lastSeen, and individual events. Repeated events remain individually traceable.

## Identity and reproducibility
IDs derive from SHA-256 of canonical identifiers. Same phone/account/vehicle
merges across cases. Person key includes normalized name + case; name alone
never merges globally. Review suggestions compare names and show corroboration.
Accepted matches are aliases; rebuild applies them. Reject/undo rebuilds from raw
sources, preserving provenance. Sources are immutable except explicit demo reset.
Sorting precedes seeded Louvain (seed 42). Influence = 100 ×
(0.45 × degree centrality + 0.35 × normalized betweenness +
0.20 × case count / maximum case count). Zero denominators yield zero.
Rule thresholds and public identifiers live in intelligence/rules.json.
Public identifiers remain visible; their R1/R2 alerts are marked suppressed.

## Before and after
Canonical graph is stored once. Before analysis the UI projects case-specific
ghost IDs; after analysis it renders canonical IDs. Analysis reports actual counts.
Input changes invalidate analysis. No cached output is presented as fresh analysis.

## Tradeoffs
Small whole-graph rebuilds prioritize transparent reversible resolution over scale.
Synchronous bounded processing is appropriate for ~150 demo records.
No Neo4j; it is a scale-out roadmap choice. No polyglot fallback planned.
Local test profile may use H2 PostgreSQL mode; production Compose uses PostgreSQL.
