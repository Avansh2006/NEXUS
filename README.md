# NEXUS
**Network Exploration & eXtraction for Unified Intelligence Systems**

An evidence-linked investigation workbench that connects fragmented fictional FIRs,
call records, and transactions. **PROTOTYPE — SYNTHETIC DATA.**

## Run with Docker
1. Copy `.env.example` to `.env` and replace `POSTGRES_PASSWORD` with a local password.
2. Run `docker compose up --build`.
3. Open http://localhost:8080, choose **Load demo**, then **Analyze Network**.

Images and packages need network access on the first build. The built demo runs
without external APIs, remote fonts, an LLM, or pretrained model downloads.
The only published port binds to localhost. This prototype has no authentication.

## Stack
React 19 + TypeScript + Vite + Tailwind + Cytoscape/fcose; Spring Boot/Java 17;
PostgreSQL 16; stateless Python FastAPI + spaCy EntityRuler + NetworkX.

## Development
Prerequisites: Java 17+, Maven 3.9+, Python 3.12, Node 22+, pnpm 11.

```sh
python -m venv .venv
# Activate .venv for your shell
pip install -r intelligence/requirements.txt
python scripts/generate_demo.py
cd intelligence
uvicorn app:app --host 127.0.0.1 --port 8000
```

In a second terminal, `cd backend` and `mvn spring-boot:run -Dspring-boot.run.profiles=local`.
The **local** profile uses H2 in PostgreSQL mode for development only.
In a third terminal, `cd frontend`, `pnpm install`, and `pnpm dev`.
Frontend proxies requests to port 8081. Use http://localhost:8080 for the configured origin.

```sh
cd intelligence && python -m pytest -q
cd ../backend && mvn test
cd ../frontend && pnpm build
cd .. && python scripts/verify_demo.py
```

The rehearsal script resets the synthetic investigation and finishes with an analyzed
demo and a printable report in ignored `artifacts/`. See [docs/DEMO_GUIDE.md](docs/DEMO_GUIDE.md).
Extraction quality is a synthetic template benchmark, not real-world accuracy.
See [docs/FINAL_FEATURES.md](docs/FINAL_FEATURES.md) for verified scope and limitations.
For setup, sample inputs, manual acceptance checks, automated UI tests and
troubleshooting, read the [complete testing guide](docs/TESTING_GUIDE.md).

## Git workflow
One commit per completed implementation step; push after two or three steps.
Repository: https://github.com/Avansh2006/NEXUS (private).
