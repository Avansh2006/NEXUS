# NEXUS

**Network Exploration & eXtraction for Unified Intelligence Systems**

An evidence-linked investigation workbench for fictional narratives, call records,
and transactions. **PROTOTYPE - SYNTHETIC DATA.** Descriptive patterns and structural
simulations support human review; they do not establish guilt or recommend enforcement.

## Run with Docker

From the repository root, with Python and Docker Compose installed:

```sh
python -m pip install -r scripts/requirements-dev.txt
python scripts/setup_credentials.py
docker compose up --build -d
```

The credential helper creates private `.env` and `.tools/credentials.json` files,
including a database password, signing secret, BCrypt hashes, and local/test account
passwords. It prints file locations, never credentials. Existing complete authentication
configuration is retained; incomplete configuration must be resolved before proceeding.
Keep both files out of Git and shared logs. Open the private credentials file locally
when signing in; there are no built-in passwords.

Open http://localhost:8080, sign in as `admin`, choose **Load demo**, then
**Analyze Network**. `investigator` can ingest, analyze, resolve matches, and update
workflow. `viewer` can read, download reports/exports, and run non-mutating simulations.
Only `admin` controls the demo and service diagnostics.

Initial builds require network access. The built application uses local fonts,
synthetic fixtures, and its internal intelligence service, without an external LLM
or pretrained model download. Compose publishes the application on loopback.

## Stack and capabilities

React 19, TypeScript, Vite, Cytoscape/fcose and Three.js; Spring Boot on Java 17;
PostgreSQL 16; Python 3.12 with FastAPI, spaCy EntityRuler and NetworkX.

- FIR, criminal-history, intelligence-report and surveillance-report narratives,
  plus call-detail and financial records, with original source spans.
- Exact-identifier resolution, reversible reviewed merges, evidence-support badges,
  communities, descriptive patterns and source-linked reports.
- Persistent entity notes, personal watchlists, versioned alert triage, manual-first
  timeline playback, structural removal simulation, CSV and GraphML exports.
- Expiring authenticated sessions, role-aware controls, attributed audit chain
  verification, and administrator diagnostics.
- Visual Identity Search: Unconstrained CCTV and surveillance face candidate retrieval
  using pretrained AdaFace IR-101 and SCRFD-10G; human-in-the-loop review, candidate
  matching only (strictly no auto-merging), and cryptographic audit trail.

See [Visual Identity Search Guide](docs/VISUAL_IDENTITY_SEARCH.md), [feature inventory](docs/FINAL_FEATURES.md), [API contract](docs/API.md), and
[prototype security](docs/SECURITY.md) for precise scope and limitations.

## Development and verification

Prerequisites: Java 17+, Maven 3.9+, Python 3.12, Node 22+, pnpm 11.
Create a virtual environment, install `intelligence/requirements.txt` and
`scripts/requirements-dev.txt`, generate credentials, and install frontend dependencies
with `pnpm install --frozen-lockfile` inside `frontend`.

On Windows, `scripts/start-local.ps1` starts the local stack using repository-relative
paths and local environment configuration. The local Java profile uses H2 in PostgreSQL
mode; Compose verification exercises PostgreSQL. For manual service startup, load the
configured authentication variables into the Java process environment first.

```sh
python -m pytest -q intelligence
mvn -f backend/pom.xml test
# Inside frontend:
pnpm build
pnpm test:e2e
# Repository root, running stack and test credentials in the environment:
python scripts/verify_demo.py
```

Rehearsal and integration tests reset synthetic investigation state. See the
[testing guide](docs/TESTING_GUIDE.md) for credential loading, commands, artifacts,
and acceptance checks. Feature implementation is separate from final integrated test
results; see [Azure completion results](docs/AZURE_COMPLETION_RESULTS.md) for the
recorded source snapshot, logs, and exit codes.

VS Code launch/attach configurations and request-ID debugging are documented in
[Debugging](docs/DEBUGGING.md). The newly provisioned dedicated Azure VM, loopback
SSH access, and repeatable verification runner are documented in
[Azure test VM](docs/AZURE_TEST_VM.md).
