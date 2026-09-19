#!/bin/bash
set -e

echo "========================================================"
echo "    NEXUS — AI-Powered Criminal Network Analysis       "
echo "             Unified Production Runner                  "
echo "========================================================"

export PORT=${PORT:-8081}
export INTELLIGENCE_PORT=${INTELLIGENCE_PORT:-8000}
export INTELLIGENCE_URL="http://127.0.0.1:${INTELLIGENCE_PORT}"
export DEMO_DIR=${DEMO_DIR:-/data/demo}
export FRONTEND_ORIGIN=${FRONTEND_ORIGIN:-*}

if [ -n "$DATABASE_URL" ]; then
    echo "[NEXUS] Cloud DATABASE_URL configured."
else
    echo "[NEXUS] No DATABASE_URL provided. Using embedded in-memory H2 database (PostgreSQL mode)."
fi

# Cleanup on exit
cleanup() {
    echo "[NEXUS] Shutting down services..."
    if [ -n "$PYTHON_PID" ]; then
        kill -TERM "$PYTHON_PID" 2>/dev/null || true
    fi
    exit 0
}
trap cleanup SIGTERM SIGINT

# 1. Start Python Intelligence Engine in background
echo "[NEXUS] Starting Python Intelligence Engine on 127.0.0.1:${INTELLIGENCE_PORT}..."
uvicorn app:app --app-dir /app/intelligence --host 127.0.0.1 --port ${INTELLIGENCE_PORT} &
PYTHON_PID=$!

# 2. Wait for intelligence service health check
echo "[NEXUS] Waiting for Intelligence Engine to initialize..."
for i in $(seq 1 30); do
    if curl -sf "http://127.0.0.1:${INTELLIGENCE_PORT}/health" > /dev/null 2>&1; then
        echo "[NEXUS] Intelligence Engine is ready (healthy after ${i}s)."
        break
    fi
    sleep 1
done

# 3. Launch Spring Boot in foreground
echo "[NEXUS] Starting Spring Boot API on port ${PORT}..."
exec java -Dserver.port=${PORT} \
          -Dnexus.intelligence-url=${INTELLIGENCE_URL} \
          -Dnexus.demo-dir=${DEMO_DIR} \
          -Dnexus.frontend-origin="${FRONTEND_ORIGIN}" \
          -jar /app/app.jar
