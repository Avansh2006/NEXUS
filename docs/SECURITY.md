# Prototype security

Use synthetic data only. NEXUS is a single-workspace prototype with explicit local
accounts. It has no connection to live investigative systems. Keep the application,
database, intelligence service, and debugger listeners on private/loopback interfaces.
The dedicated Azure test VM is accessed through SSH forwarding; see
[Azure test VM](AZURE_TEST_VM.md).

## Authentication and authorization

All `/api` routes require a bearer token except `GET /api/health` and
`POST /api/auth/login`. Login accepts `{username,password}`. The explicit accounts
are `admin`, `investigator`, and `viewer`; their passwords are configured externally.
Anonymous administrator access, role-header overrides, and fixed synthetic bearer
tokens are not supported.

Tokens use HS256 with the configured signing secret, issuer `nexus-prototype`,
validated subject/role, issued-at and expiry claims. Default expiry is one hour.
Startup rejects missing/short secrets, invalid BCrypt hash configuration, and invalid
token lifetime configuration. Supported configured BCrypt costs are 10 through 16.

| Capability | VIEWER | INVESTIGATOR | ADMIN |
| --- | --- | --- | --- |
| Read investigation, notes, quality and audit | Yes | Yes | Yes |
| Download reports, CSV and GraphML | Yes | Yes | Yes |
| POST structural simulation without mutation | Yes | Yes | Yes |
| Ingest, analyze, resolve, notes/watchlist/triage changes | No | Yes | Yes |
| Demo load/reset/incoming/retraction and diagnostics | No | No | Yes |

The backend enforces permissions. UI controls also reflect the role. Browser tokens
are stored in session storage, attached to JSON and download requests, and cleared
on sign-out or a 401 response. Sign-out clears the browser session; there is no
server-side per-token revocation service. Expiry/sign-in handling does not download
an error document as an export. A 403 displays a permission error.

## Private configuration

```sh
python -m pip install -r scripts/requirements-dev.txt
python scripts/setup_credentials.py
```

The helper writes ignored `.env` and `.tools/credentials.json` files without printing
credentials. It generates these required API environment settings:

- `NEXUS_JWT_SECRET`
- `NEXUS_ADMIN_PASSWORD_HASH`
- `NEXUS_INVESTIGATOR_PASSWORD_HASH`
- `NEXUS_VIEWER_PASSWORD_HASH`

The API verifies BCrypt hashes and does not need plaintext account passwords.
Local/test tools log in using `NEXUS_ADMIN_PASSWORD`,
`NEXUS_INVESTIGATOR_PASSWORD`, and `NEXUS_VIEWER_PASSWORD` from private configuration.
Do not pass those plaintext test variables into a production API environment or
copy private files into reports, source archives, or logs. Regeneration does not
silently replace a complete existing configuration. Protect local files with the
host's access controls; retain `.env.example` as a non-secret example only.

## Audit and data boundaries

Attributed audit entries record supported ingestion, analysis, resolution, workflow,
view, login and export activity. Notes, watchlists and triage changes are committed
with their audit records transactionally. Entries contain actor, timestamp, action,
entity/payload identifiers and chained SHA-256 hashes. `/api/audit/verify` checks the
stored chain; Reports exposes authorship and verification results.

This is tamper evidence, not immutable external storage or independent certification.
A party able to rewrite the complete database and recompute hashes is outside that
protection. Verification establishes chain consistency, not source truth.

Other controls include:

- POST bodies limited to 2 MiB, strict UTF-8 checks, 500 rows per ingest request,
  10,000 characters per narrative, independent row validation and duplicate handling.
- In-memory limits of 30 login attempts per minute per remote address and 30
  authenticated POST requests per minute per account, with 429 and retry headers.
  These limits reset on service restart and are not a distributed rate-limit service.
- Parameterized JDBC, escaped report/source text, bounded PNG report images,
  CSV formula-prefix neutralization and XML-writer GraphML output.
- Configured CORS origins, no-store responses, safe error envelopes, server-generated
  request IDs, and structured error logs without tokens or source narratives.
- Administrator-only diagnostics reporting database and intelligence availability
  separately; API liveness alone is not readiness.
- Opt-in development debuggers bound to loopback, with no production debugger ports.

## Deliberate limits

No enterprise SSO, tenant isolation, per-case authorization, production key rotation,
external audit anchoring, formal security certification, or comprehensive concurrency/load
assessment is claimed. Database backups, retention, encryption and deployment access
controls require environment-specific design beyond this synthetic prototype.
