# Prototype security

Only synthetic data. No integration with real investigative systems.
Local-only Compose port binding; unauthenticated prototype mode by default, never internet-expose.
Secrets read from environment; .env ignored; .env.example contains placeholders.

## Implemented Security Controls

1. **Authentication & RBAC (Role-Based Access Control)**:
   - Synthetic identity verification via signed HS256 JWT tokens and fixed test credentials:
     - `admin` (`admin@nexus.internal`, role `ADMIN`): Full access to view and mutate graph data.
     - `investigator` (`officer@nexus.internal`, role `INVESTIGATOR`): Full analysis, triage, and mutation permissions.
     - `viewer` (`viewer@nexus.internal`, role `VIEWER`): Read-only access; all mutation endpoints (`POST`) return HTTP 403 Forbidden with `{ "error": { "code": "FORBIDDEN" } }`.
   - Headers: Accepts `Authorization: Bearer <token>` or `X-Nexus-Role: <ROLE>` for rapid demo switching.
   - Endpoints: `POST /api/auth/login` (generates JWT), `GET /api/auth/me` (inspects current session principal).

2. **Tamper-Evident Hash-Chained Audit Logging**:
   - Every state-altering action, report export, and query is immutably appended to `audit_log`.
   - Each audit record includes: `id`, `action`, `created_at`, `user_id`, `entity_id`, `payload_digest`, `prev_hash`, and `entry_hash`.
   - Hashes are chained using SHA-256 (`entry_hash = SHA256(prev_hash + created_at + user_id + action + entity_id + payload_digest)`).
   - Integrity verification endpoint `GET /api/audit/verify` traverses the full chain from genesis (`0`*64) to the head. Any manual database modification or log tampering breaks hash linkage and is detected with the exact row index and discrepancy details.

3. **Rate Limiting & Throttling**:
   - Ingest and mutation requests bounded to 30 requests/minute per client IP.
   - Rejections return HTTP 429 Too Many Requests with standard compliant headers:
     - `Retry-After`: Seconds until quota reset.
     - `X-RateLimit-Limit`: Maximum requests per window (30).
     - `X-RateLimit-Remaining`: Remaining allowance in current window (0).
     - `X-RateLimit-Reset`: Unix timestamp of the window reset.

4. **Input Sanitization & Boundary Protections**:
   - JSON/CSV schema validation, bounded inputs, UTF-8 strict validation, per-row error isolation.
   - Finite nonnegative amounts and duration, ISO timestamps, no client-supplied file paths.
   - Parameterized JDBC queries prevent SQL injection.
   - Report HTML strictly escapes source strings.
   - Image export accepts bounded PNG data URLs only (<= 1.5 MB).
   - Fixed CORS origin, safe error envelopes.
   - No external calls at demo runtime; intelligence engine only reachable on internal network.

Production deployments would additionally require enterprise SSO (SAML/OIDC), mTLS, at-rest database encryption, multi-tenant workspace isolation, data retention schedules, and automated key rotation.

