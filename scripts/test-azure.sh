#!/usr/bin/env bash
# Run from a dedicated NEXUS checkout on the test VM. Requires Docker Compose v2.
# Leaves this project's stack running on loopback for inspection.
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p artifacts/azure .tools/azure
export COMPOSE_PROJECT_NAME=nexus-deva-test
if [[ ! -f .tools/azure/test.env ]]; then
  umask 077
  python3 -c 'import secrets; print("POSTGRES_PASSWORD=" + secrets.token_hex(32))' > .tools/azure/test.env
fi
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/work" -w /work python:3.12-slim \
  sh -c 'pip install --disable-pip-version-check --no-cache-dir --target /tmp/vendor -r scripts/requirements-dev.txt >/dev/null && PYTHONPATH=/tmp/vendor python scripts/setup_credentials.py --env-file .tools/azure/test.env --credentials-file .tools/azure/credentials.json' || exit 1
set -a
source .tools/azure/test.env
set +a
trap 'docker compose start intelligence >/dev/null 2>&1 || true' EXIT
failed=0
run_step() {
  local name="$1"
  shift
  printf '\nRunning %s\n' "$name"
  "$@" > "artifacts/azure/$name.log" 2>&1
  local code=$?
  printf '%s\t%s\n' "$name" "$code" | tee -a artifacts/azure/results.tsv
  if [[ "$code" -ne 0 ]]; then
    tail -n 60 "artifacts/azure/$name.log"
    failed=1
  fi
  return "$code"
}
: > artifacts/azure/results.tsv
{
  date -u --iso-8601=seconds
  uname -a
  docker --version
  docker compose version
  cat artifacts/azure/source-revision.txt
} > artifacts/azure/environment.txt
run_step python-tests docker run --rm -v "$PWD:/work" -w /work python:3.12-slim \
  sh -c 'pip install --disable-pip-version-check -r intelligence/requirements.txt -r scripts/requirements-dev.txt && python -m pytest -q intelligence scripts/test_setup_credentials.py scripts/test_verify_features.py --junitxml=artifacts/azure/python-junit.xml'
run_step java-tests docker run --rm -v "$PWD:/work" -v nexus-test-maven:/root/.m2 -w /work maven:3.9.9-eclipse-temurin-17 \
  mvn -B -f backend/pom.xml test
run_step frontend-build docker run --rm -v "$PWD:/work" -w /work/frontend node:22 \
  sh -c 'npm install --global pnpm@11.19.0 && pnpm install --frozen-lockfile && pnpm build'
if run_step compose-build docker compose up --build -d; then
  ready=0
  for attempt in $(seq 1 90); do
    if python3 -c 'import urllib.request; urllib.request.urlopen("http://127.0.0.1:8080/api/health", timeout=3)' 2>/dev/null; then
      ready=1
      break
    fi
    sleep 2
  done
  if [[ "$ready" -eq 1 ]]; then
    run_step demo-rehearsal env NEXUS_API=http://127.0.0.1:8080/api python3 scripts/verify_demo.py
    if run_step feature-checks env NEXUS_API=http://127.0.0.1:8080/api python3 scripts/verify_features.py --phase prepare; then
      run_step database-restart docker compose restart db
      for attempt in $(seq 1 30); do
        if docker compose exec -T db pg_isready -U "${POSTGRES_USER:-nexus}" >/dev/null 2>&1; then break; fi
        sleep 1
      done
      run_step api-restart docker compose restart api
      for attempt in $(seq 1 60); do
        if python3 -c 'import urllib.request; urllib.request.urlopen("http://127.0.0.1:8080/api/health", timeout=3)' 2>/dev/null; then break; fi
        sleep 1
      done
      run_step persistence-check env NEXUS_API=http://127.0.0.1:8080/api python3 scripts/verify_features.py --phase verify-persistence
    fi
    run_step engine-stop docker compose stop intelligence
    run_step engine-unavailable-check env NEXUS_API=http://127.0.0.1:8080/api python3 scripts/verify_features.py --phase verify-unavailable
    run_step engine-start docker compose start intelligence
    for attempt in $(seq 1 30); do
      if docker compose exec -T intelligence python -c 'import urllib.request; urllib.request.urlopen("http://localhost:8000/health", timeout=2)' >/dev/null 2>&1; then break; fi
      sleep 1
    done
    run_step engine-recovered-check env NEXUS_API=http://127.0.0.1:8080/api python3 scripts/verify_features.py --phase verify-recovered
    run_step browser-tests docker run --rm --network host --ipc=host \
      -e NEXUS_UI_URL=http://localhost:8080 -v "$PWD:/work" -w /work/frontend \
      -e NEXUS_ADMIN_PASSWORD -e NEXUS_INVESTIGATOR_PASSWORD -e NEXUS_VIEWER_PASSWORD \
      mcr.microsoft.com/playwright:v1.58.2-noble \
      sh -c 'npm install --global pnpm@11.19.0 && pnpm install --frozen-lockfile && pnpm test:e2e'
  else
    printf 'readiness\t1\n' >> artifacts/azure/results.tsv
    failed=1
  fi
fi
docker compose ps > artifacts/azure/compose-status.txt
docker compose logs --no-color --tail=200 > artifacts/azure/compose.log 2>&1
cat artifacts/azure/results.tsv
trap - EXIT
exit "$failed"
