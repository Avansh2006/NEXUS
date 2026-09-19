# ==========================================
# Stage 1: Build Java Spring Boot Application
# ==========================================
FROM maven:3.9.9-eclipse-temurin-17-alpine AS java-builder
WORKDIR /build
COPY backend/pom.xml .
RUN mvn -q dependency:go-offline
COPY backend/src src
RUN mvn -q package -DskipTests

# ==========================================
# Stage 2: Unified Production Runtime
# ==========================================
FROM python:3.12-slim-bookworm

WORKDIR /app

# Install OpenJDK 17 headless, curl for healthchecks and clean apt cache
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        openjdk-17-jre-headless \
        curl \
        ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install Python intelligence dependencies
COPY intelligence/requirements.txt /app/intelligence/requirements.txt
RUN pip install --no-cache-dir -r /app/intelligence/requirements.txt

# Copy backend JAR and intelligence engine
COPY intelligence /app/intelligence
COPY --from=java-builder /build/target/nexus-api-0.1.0.jar /app/app.jar
COPY data/demo /data/demo
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh

ENV DEMO_DIR=/data/demo \
    PORT=8081 \
    INTELLIGENCE_URL=http://127.0.0.1:8000 \
    FRONTEND_ORIGIN="*"

EXPOSE 8081 10000

ENTRYPOINT ["/docker-entrypoint.sh"]
