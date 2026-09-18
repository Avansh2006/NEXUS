FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY backend/pom.xml .
RUN mvn -q dependency:go-offline
COPY backend/src src
RUN mvn -q package -DskipTests
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /build/target/nexus-api-0.1.0.jar app.jar
COPY data/demo /data/demo
ENV DEMO_DIR=/data/demo
USER 10001
ENTRYPOINT ["java", "-jar", "app.jar"]
