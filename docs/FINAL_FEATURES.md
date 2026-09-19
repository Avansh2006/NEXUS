# Final feature inventory

## Implemented
- NEXUS identity and persistent PROTOTYPE — SYNTHETIC DATA banner.
- React/TypeScript/Vite/Tailwind + Cytoscape/fcose investigator workbench.
- Refined mineral surfaces, local Inter/Space Grotesk typography, Motion transitions,
  animated measured counters and a state-aware workflow bar; reduced-motion support.
- Spring Boot REST backend; PostgreSQL relational graph/evidence JSONB storage;
  stateless FastAPI/spaCy/NetworkX sidecar. Four-service Docker Compose build.
- FIR text/paste/JSON and CSV/JSON structured data; multi-file UI batches; bounded
  validation, per-row errors, hash duplicate counting, actual processing counts.
- Validated Indian mobile/vehicle/account/UPI/IFSC/amount patterns; synthetic tokens;
  spaCy EntityRuler gazetteers and role-cue people. Source spans/confidence retained.
- Hard-identifier merging, name-plus-phone/case corroboration, possible-match review,
  alias provenance and reversible merges rebuilt from source records.
- 121 reproducible synthetic records across six cases; 18 labeled gold FIRs.
- Evidence links on every graph node/edge; first/last seen and per-event timestamps.
- Degree, betweenness, seeded Louvain communities; weighted influence breakdown.
- R1–R6 explanations with entity/evidence IDs; visible public/service suppression.
- Dashboard, ingestion, graph workspace, entity/case inspector, alerts, clusters,
  timeline, reports, audit viewer; search, filters, focus and bounded expansion.
- Case-specific ghost projection before Analyze; canonical network after Analyze,
  short graph fade/camera focus; graph coloring, community borders, influence sizes.
- Case-link suggestions, shortest paths with hop evidence, highlighted FIRs,
  synthetic extraction-quality panel (27 TP, 0 FP, 0 FN on 18 samples).
- Printable escaped HTML report with optional graph PNG and browser Save as PDF.
- Reset/load demo, offline runtime, test suites, GitHub CI with PostgreSQL rehearsal.
- Request/body validation, rate limiting, fixed CORS origin, parameterized SQL,
  no secrets in Git, local-only published port and safe JSON error envelope.

## Partially implemented / deliberate scope limits
- Extraction is regex + blank spaCy EntityRuler + small gazetteer, not a trained
  general-purpose multilingual NER model. Benchmark is synthetic templates only.
- Person resolution uses phone or case corroboration, not a learned identity model.
  Name review shows candidate source evidence; there is no full merge-history screen.
- Timeline is an ordered event list and filters use one event date, not a range slider.
- Graph transitions use fade/camera fallback, not a bespoke animated node morph.
- PDF export uses browser print; no server-side PDF renderer.
- Demo analysis recomputes quickly; persisted results survive normal reloads but no
  independent precomputed analysis cache is used when the engine is down.
- Audit logging/viewer is operational, not tamper-evident or identity-attributed.
- Three automated browser scenarios cover the desktop journey, upload validation,
  report download, mobile layout and reduced motion, with screenshots and video.

## Roadmap
JWT/Investigator/Admin roles, SSO, tenant isolation, device/IMEI entities, richer
timeline ranges, multilingual evaluation, robust location corroboration, larger
gold corpus, production retention/backup/encryption, formal security audit.
Neo4j is an optional scale-out path. Government/bank/telecom integration would
require formal agreements and is not part of this prototype.
No crime prediction, guilt labeling, facial recognition or autonomous enforcement.
