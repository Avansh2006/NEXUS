# Prototype security

Only synthetic data. No integration with real investigative systems.
Local-only Compose port binding; unauthenticated prototype, never internet-expose.
JWT/roles are optional and must be reported honestly in FINAL_FEATURES.
Secrets read from environment; .env ignored; .env.example contains placeholders.

Implementation requirements: JSON/CSV schema validation, bounded inputs, UTF-8,
per-row errors, finite nonnegative amounts and duration, ISO timestamps, no file
paths supplied by clients. Parameterized JDBC; report HTML escapes source strings.
Image export accepts bounded PNG data URLs only. Request throttling, fixed CORS
origin, safe error envelope; audit operations without source text.
No external calls at demo runtime; intelligence only reachable on internal network.
Uploads invalidate stale analysis. Report includes human-review caveat.

Production would need SSO/RBAC, TLS, encryption at rest, tenant isolation, retention,
tamper-evident audit, backup/recovery, key rotation, formal security review, and
data-sharing agreements. Regex/gazetteer performance is not real-world accuracy.
