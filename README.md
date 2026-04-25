# LedgerLite

A Spring Boot 3 microservices system implementing a personal finance ledger. Built to exercise standard microservice patterns: service discovery, centralized config, API gateway, event-driven architecture, distributed tracing, and resilience patterns.

## Architecture

```
                    ┌─────────────┐
                    │   Client    │
                    └──────┬──────┘
                           │ HTTPS
                    ┌──────▼──────┐
                    │ API Gateway │  Spring Cloud Gateway
                    │   (8080)    │  - JWT validation, rate limiting
                    └──────┬──────┘
            ┌──────────────┼──────────────┬──────────────┐
            │              │              │              │
       ┌────▼────┐    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
       │  Auth   │    │ Account │    │  Trans  │    │ Analyt. │
       │ Service │    │ Service │    │ Service │    │ Service │
       │ (8081)  │    │ (8082)  │    │ (8083)  │    │ (8084)  │
       └────┬────┘    └────┬────┘    └────┬────┘    └────▲────┘
            │              │              │              │
            └──────────────┴──────┬───────┘              │
                                  │                      │
                            ┌─────▼──────┐         ┌─────┴──────┐
                            │  Postgres  │         │  Redpanda  │
                            └────────────┘         │ (Kafka API)│
                                                   └────────────┘
```

**Cross-cutting:** Eureka (discovery), Config Server, Zipkin (tracing), Prometheus + Grafana (metrics), Redpanda Console (Kafka browser)

## Tech Stack

| Concern | Choice |
|---------|--------|
| Language | Java 21 |
| Framework | Spring Boot 3.3.5 |
| Cloud BOM | Spring Cloud 2023.0.3 |
| Database | Postgres 16 (database-per-service) |
| Migrations | Flyway |
| Messaging | Redpanda (Kafka API) |
| Discovery | Eureka |
| Config | Spring Cloud Config (native mode) |
| Gateway | Spring Cloud Gateway |
| Auth | Spring Security + JWT (jjwt 0.12.x) |
| Resilience | Resilience4j (circuit breaker + retry) |
| Inter-service HTTP | Spring Cloud OpenFeign |
| Tracing | Micrometer Tracing -> Zipkin |
| Metrics | Micrometer -> Prometheus |
| API docs | springdoc-openapi 2.x |
| Integration tests | Testcontainers |

## Running Locally

### Prerequisites
- Java 21
- Maven 3.9+
- Docker & Docker Compose

### 1. Start infrastructure
```bash
docker compose -f docker-compose.infra.yml up -d
```

### 2. Start services (in order)
```bash
cd discovery-server && ./mvnw spring-boot:run &
cd config-server && ./mvnw spring-boot:run &
# Wait for discovery + config to be ready, then start the others
cd auth-service && ./mvnw spring-boot:run &
cd account-service && ./mvnw spring-boot:run &
cd transaction-service && ./mvnw spring-boot:run &
cd analytics-service && ./mvnw spring-boot:run &
cd api-gateway && ./mvnw spring-boot:run &
```

### 3. Access dashboards
- **Eureka:** http://localhost:8761
- **Zipkin:** http://localhost:9411
- **Grafana:** http://localhost:3000
- **Prometheus:** http://localhost:9090
- **Redpanda Console:** http://localhost:8085

## Design Tradeoffs

- **Database-per-service on a shared Postgres instance.** Separate logical DBs keep service boundaries clean. In production, separate physical instances for true isolation and independent scaling.
- **Eureka for discovery** instead of Kubernetes-native service discovery. Appropriate for Docker Compose deployments; in K8s you'd use Service objects and DNS.
- **Config Server in native (file) mode** instead of Git-backed. Simpler for dev/demo. Production would use Git-backed mode + HashiCorp Vault for secrets.
- **Redpanda in dev-container mode.** Single-node, no persistence guarantees. Fine for dev; production would run a proper cluster.
- **Tracing at 100% sampling.** Great for dev/demo. Production would sample ~10% to control overhead.
- **Duplicated JWT validation** across services instead of a shared library. Avoids version coordination overhead at this scale. A shared lib makes sense at 10+ services.
