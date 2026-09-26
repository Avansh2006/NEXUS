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

# Ensure default auth credentials for prototype / demo deployment
if [ -z "$NEXUS_JWT_SECRET" ]; then
    export NEXUS_JWT_SECRET="b3521409dc7b19228e06955b7a7618ab450efc97f79875316fcb2cccd85c27a59c963611e7cd5a2032ebaf4cc9303ead"
fi
if [ -z "$NEXUS_ADMIN_PASSWORD_HASH" ]; then
    export NEXUS_ADMIN_PASSWORD_HASH='$2b$12$1lQL7QRyFmdCa7da0lTuRegEini5CmjBkVRx1oa.EHJHRBFtyrD6i'
fi
if [ -z "$NEXUS_INVESTIGATOR_PASSWORD_HASH" ]; then
    export NEXUS_INVESTIGATOR_PASSWORD_HASH='$2b$12$cKRppxj45xgKBsZIP351YuqjIQVUtp6oC1az.CG.IMTNRbQnPNgaq'
fi
if [ -z "$NEXUS_VIEWER_PASSWORD_HASH" ]; then
    export NEXUS_VIEWER_PASSWORD_HASH='$2b$12$Ap4ctJ/JDiuUK4Qk3uZI3uIgXwD9IHowft3jYf1QGn5FzJlWdiGGm'
fi

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

export NEXUS_LOW_MEMORY=${NEXUS_LOW_MEMORY:-true}
export ORT_NUM_THREADS=${ORT_NUM_THREADS:-1}

# 0. Ensure pretrained vision models are available
echo "[NEXUS] Verifying pretrained vision models..."
if [ "${NEXUS_LOW_MEMORY}" = "true" ]; then
    rm -f /app/intelligence/models/adaface_ir_101.onnx /app/models/adaface_ir_101.onnx 2>/dev/null || true
fi
python /app/intelligence/download_models.py || true

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

# 3. Launch Spring Boot in foreground with strict 512MB container memory bounds
echo "[NEXUS] Starting Spring Boot API on port ${PORT}..."
exec java -Xmx128m -Xms32m -XX:+UseSerialGC -XX:MaxMetaspaceSize=80m \
          -Dserver.port=${PORT} \
          -Dnexus.intelligence-url=${INTELLIGENCE_URL} \
          -Dnexus.demo-dir=${DEMO_DIR} \
          -Dnexus.frontend-origin="${FRONTEND_ORIGIN}" \
          -Dnexus.auth.secret="${NEXUS_JWT_SECRET}" \
          -Dnexus.auth.admin-hash="${NEXUS_ADMIN_PASSWORD_HASH}" \
          -Dnexus.auth.investigator-hash="${NEXUS_INVESTIGATOR_PASSWORD_HASH}" \
          -Dnexus.auth.viewer-hash="${NEXUS_VIEWER_PASSWORD_HASH}" \
          -jar /app/app.jar
