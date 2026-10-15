# ==========================================
# 1. Build Stage
# ==========================================
FROM maven:3.9.6-eclipse-temurin-17-alpine AS builder
WORKDIR /app

# Copy pom.xml and cache dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source code and build standalone JAR
COPY src ./src
RUN mvn clean package -DskipTests -B

# ==========================================
# 2. Production Runtime Stage
# ==========================================
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Security: Non-root user
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

# Environment variables optimized for Render (RAM limits, random generator)
ENV PORT=8080
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:InitialRAMPercentage=40.0 -XX:+ExitOnOutOfMemoryError -Djava.security.egd=file:/dev/./urandom"

# Copy built JAR from builder
COPY --from=builder /app/target/*.jar app.jar

# Dynamic port handled via $PORT
EXPOSE 8080

CMD ["sh", "-c", "java $JAVA_OPTS -Dserver.port=${PORT:-8080} -jar app.jar"]
