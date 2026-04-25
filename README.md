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
                    │   (8080)    │  - JWT validation
                    │             │  - Redis rate limiting
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

  Cross-cutting:
   - Eureka (8761)            service discovery
   - Config Server (8888)     centralized config
   - Redis (6379)             rate limit token buckets
   - Zipkin (9411)            distributed tracing
   - Prometheus (9090)        metrics scraping
   - Grafana (3000)           dashboards
   - Redpanda Console (8085)  Kafka topic browser
```

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
| Rate Limiting | Redis + Spring Cloud Gateway RequestRateLimiter |
| Resilience | Resilience4j (circuit breaker + retry) |
| Inter-service HTTP | Spring Cloud OpenFeign |
| Tracing | Micrometer Tracing -> Zipkin |
| Metrics | Micrometer -> Prometheus |
| API docs | springdoc-openapi 2.x |
| Integration tests | Testcontainers |

## Running

### Prerequisites
- Docker & Docker Compose

### Option 1: Full stack (recommended)

Builds and runs everything in Docker — no Java or Maven needed on your machine.

```bash
docker compose up -d --build
```

This starts all 7 services + infrastructure (Postgres, Redpanda, Zipkin, Prometheus, Grafana). Services start in dependency order via health checks.

### Option 2: Dev mode (infrastructure in Docker, services on host)

Useful for faster iteration — services restart instantly without rebuilding images.

Prerequisites: Java 21, Maven 3.9+

```bash
# 1. Start infrastructure
docker compose -f docker-compose.infra.yml up -d

# 2. Start services (each in a separate terminal, in order)
cd discovery-server && ./mvnw spring-boot:run
cd config-server && ./mvnw spring-boot:run
# Wait ~5s for discovery + config to be ready, then:
cd auth-service && ./mvnw spring-boot:run
cd account-service && ./mvnw spring-boot:run
cd transaction-service && ./mvnw spring-boot:run
cd analytics-service && ./mvnw spring-boot:run
cd api-gateway && ./mvnw spring-boot:run
```

### Running tests

Once all services are running and Eureka has propagated (~20 seconds):

```bash
./e2e-test.sh
```

Runs 37 end-to-end tests through the gateway covering auth, accounts, transactions (with idempotency), analytics (Kafka event processing), and rate limiting.

### Stopping

```bash
# Full stack
docker compose down

# Dev mode
pkill -f "spring-boot:run"
docker compose -f docker-compose.infra.yml down
```

### Try it out

```bash
# Register a user
curl -s -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@test.com","password":"password123"}'

# Login and save the JWT token
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@test.com","password":"password123"}' | jq -r '.token')

# Create a checking account
ACCOUNT_ID=$(curl -s -X POST http://localhost:8080/api/accounts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Checking","type":"CHECKING"}' | jq -r '.id')

# Deposit $1000
curl -s -X PATCH http://localhost:8080/api/accounts/$ACCOUNT_ID/balance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"delta":1000,"expectedVersion":0}'

# Post a transaction
curl -s -X POST http://localhost:8080/api/transactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d "{\"accountId\":\"$ACCOUNT_ID\",\"amount\":-35.50,\"category\":\"FOOD\",\"description\":\"Lunch\"}"

# Check spending analytics (wait a few seconds for Kafka processing)
sleep 3
curl -s "http://localhost:8080/api/analytics/spending/by-category?month=$(date +%Y-%m)" \
  -H "Authorization: Bearer $TOKEN"
```

All requests go through the API gateway on port 8080. Requires `jq` for JSON parsing (`brew install jq`).

### Dashboards
- **Eureka (service registry):** http://localhost:8761
- **Zipkin (distributed traces):** http://localhost:9411
- **Grafana (metrics dashboards):** http://localhost:3000
- **Prometheus (raw metrics):** http://localhost:9090
- **Redpanda Console (Kafka topics):** http://localhost:8085
- **Swagger UI:** http://localhost:8081/swagger-ui.html (per-service, ports 8081-8084)

## Design Tradeoffs

- **Database-per-service on a shared Postgres instance.** Separate logical DBs keep service boundaries clean. In production, separate physical instances for true isolation and independent scaling.
- **Eureka for discovery** instead of Kubernetes-native service discovery. Appropriate for Docker Compose deployments; in K8s you'd use Service objects and DNS.
- **Config Server in native (file) mode** instead of Git-backed. Simpler for dev/demo. Production would use Git-backed mode + HashiCorp Vault for secrets.
- **Redpanda in dev-container mode.** Single-node, no persistence guarantees. Fine for dev; production would run a proper cluster.
- **Tracing at 100% sampling.** Great for dev/demo. Production would sample ~10% to control overhead.
- **Duplicated JWT validation** across services instead of a shared library. Avoids version coordination overhead at this scale. A shared lib makes sense at 10+ services.
- **Redis-backed rate limiting** at the gateway (20 req/sec sustained, burst to 40). Uses Spring Cloud Gateway's built-in `RequestRateLimiter` with Redis token buckets, so rate limits are shared across multiple gateway instances. Keyed by client IP.
