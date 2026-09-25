# Debugging NEXUS

The repository includes VS Code configurations for React, the Python service,
and Java. These are development tools; deployment defaults do not enable
debugger listeners. Install the recommended Python and Java extensions when
VS Code prompts, or use `.vscode/extensions.json` as the list.

## Python

Create the Python 3.12 environment and install `intelligence/requirements.txt`
as described in the testing guide. Select that interpreter in VS Code, stop
any other service using port 8000, and run **NEXUS: Python intelligence**.
Place a breakpoint in `extract_route` or `analyze_route` in `intelligence/app.py`
and ingest/analyze through the UI. Uvicorn reload is deliberately disabled so
breakpoints stay in one process. The API listens on loopback.

## Java

Install Java 17+, Maven, and PowerShell 7 and put them on PATH. Generate `.env`
using `scripts/setup_credentials.py` first. The debug task imports these settings
without printing credentials. Start the Python service, then
run VS Code task **NEXUS: Java API with debugger**. It starts the local H2
profile with JDWP listening on `127.0.0.1:5005`. Select **NEXUS: attach Java API**
and set a breakpoint in `ApiController` or `InvestigationService`. Stop the
task after detaching if the API is no longer needed. Do not start a second
API on port 8081.

## React

Run `pnpm install --frozen-lockfile` in `frontend` once. Start the backend and
Python services, then select **NEXUS: React browser**. Its prerequisite task
starts Vite on port 8080 and the browser debugger uses development source
maps to bind breakpoints in `.tsx` files. If Vite is already running, stop
that instance first. Production bundles are tested separately on the Azure VM.

## Azure diagnostics

See [Azure test VM](AZURE_TEST_VM.md) for SSH and test commands. Test logs and
exit codes are in `artifacts/azure/`; Playwright failures retain screenshots
and videos. Traces are disabled by default because they record credentials and
authorization headers. Set `NEXUS_PRIVATE_TRACE=1` only for private local diagnosis;
do not publish those trace archives. View a private trace with `pnpm exec playwright show-trace`
from `frontend`, providing its ZIP path. Use `docker compose -p nexus-deva-test
logs --tail=100` on the VM for service errors. Run Compose commands from the
checkout with the test environment loaded as in `scripts/test-azure.sh`.

Keep any remote debugger bound to loopback and access it through an SSH
tunnel. Azure network rules permit SSH only; do not open JDWP or Python
debugger ports publicly. Debugger configuration syntax can be validated
without an editor, but actual breakpoint attachment requires the extensions
and their runtimes; test reports must distinguish those checks.
