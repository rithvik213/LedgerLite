# LedgerLite — Claude Code Project Context

> **Read this file first.** It contains everything you need to build this project from scratch. Update the "Build progress" section as pieces are completed.

---

## What this project is

A Spring Boot 3 microservices system being built as **interview preparation** for a JPMorgan Chase SWE 2 role on a Spring Boot microservices team. The domain is a personal finance ledger — relevant fintech context, manageable scope, exercises all the standard microservice patterns.

The project was scoped in a Claude.ai chat conversation. **Nothing has been built yet.** You are starting from an empty directory and building all 6 pieces.

## Critical context

- **Time budget: ~2 days total.** Bias toward "good enough to demo and discuss confidently" over "production-hardened." Don't yak-shave.
- **Deployment target: Portainer + Docker on a Beelink SER5 mini PC** (homelab, resource-constrained). Keep JVM heap footprints reasonable.
- **Owner is a working SWE at Oracle** with Spring Boot familiarity (rusty). Don't over-explain basics; do explain non-obvious tradeoffs.
- **Owner's style: direct, concise, will push back when wrong.** Skip apologies and hedge words. State things plainly. No "Certainly!" / "Great question!" preambles.
- **Interview-driven scope.** Every architectural choice should map to a talking point an interviewer will ask about (see "Interview talking points" below).

---

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

  Cross-cutting:
   - Eureka (8761)            service discovery
   - Config Server (8888)     centralized config (native file mode)
   - Zipkin (9411)            distributed tracing
   - Prometheus (9090)        metrics scraping
   - Grafana (3000)           dashboards
   - Redpanda Console (8085)  kafka topic browser
```

## Tech stack (locked in — don't substitute)

| Concern              | Choice                                |
|----------------------|---------------------------------------|
| Language             | Java 21                               |
| Framework            | Spring Boot 3.3.5                     |
| Cloud BOM            | Spring Cloud 2023.0.3                 |
| Database             | Postgres 16                           |
| Migrations           | Flyway                                |
| Messaging            | Redpanda (Kafka API compatible)       |
| Service discovery    | Eureka                                |
| Centralized config   | Spring Cloud Config (native mode)     |
| Gateway              | Spring Cloud Gateway                  |
| Auth                 | Spring Security + JWT (jjwt 0.12.x)   |
| Resilience           | Resilience4j                          |
| Inter-service HTTP   | Spring Cloud OpenFeign                |
| Tracing              | Micrometer Tracing → Zipkin           |
| Metrics              | Micrometer → Prometheus               |
| API docs             | springdoc-openapi 2.x                 |
| Integration testing  | Testcontainers                        |
| Containers           | Multi-stage Dockerfile, JRE-alpine    |
| Orchestration        | docker-compose, deployed via Portainer|

---

## Build progress

All pieces below are TODO. Mark each ✅ as completed and note any deviations from the plan.

### ✅ Piece 1: Foundation

**Completed.** All deliverables built. Both services compile and package successfully. No deviations from plan. Note: Maven wrapper was installed manually (downloaded jar + scripts) since `mvn` wasn't on the host PATH.

Set up the project root and the cross-cutting infrastructure. After this piece the owner should be able to run docker-compose for infra and have Eureka + Config Server running locally.

**Deliverables:**

1. **Top-level files**
   - `README.md` — project overview, architecture diagram, tech stack, run instructions, design tradeoffs
   - `.gitignore` — Maven (`target/`), IDE files, OS files, env files, Docker volumes

2. **`docker-compose.infra.yml`** — local infra stack only. Services:
   - `postgres` — image `postgres:16-alpine`, port 5432, env `POSTGRES_USER=ledgerlite POSTGRES_PASSWORD=ledgerlite POSTGRES_MULTIPLE_DATABASES=auth_db,account_db,transaction_db,analytics_db`, mount `./postgres/init-multiple-dbs.sh` to `/docker-entrypoint-initdb.d/`, healthcheck via `pg_isready`
   - `redpanda` — image `redpandadata/redpanda:v24.2.7`, dev-container mode, expose Kafka on host port 19092, internal listener on `redpanda:9092`
   - `redpanda-console` — image `redpandadata/console:v2.7.2`, port 8085 (host) → 8080 (container), browser for Kafka topics
   - `zipkin` — image `openzipkin/zipkin:3`, port 9411
   - `prometheus` — image `prom/prometheus:v2.55.0`, port 9090, mount `./prometheus/prometheus.yml`, set `extra_hosts: ["host.docker.internal:host-gateway"]` so it can scrape services running on the host during dev
   - `grafana` — image `grafana/grafana:11.3.0`, port 3000, anonymous auth enabled with Admin role for easy local dev
   - Named network `ledgerlite`, named volumes for postgres data and grafana data

3. **`postgres/init-multiple-dbs.sh`** — bash script that reads `POSTGRES_MULTIPLE_DATABASES` env var (comma-separated) and creates each database. Make executable.

4. **`prometheus/prometheus.yml`** — scrape configs for all 7 services using `host.docker.internal:<port>` (so Prometheus in Docker can reach services running on the host during local dev). Include jobs for: discovery-server, config-server, auth-service, account-service, transaction-service, analytics-service, api-gateway. Metrics path `/actuator/prometheus`.

5. **`discovery-server/`** — Eureka server, port 8761
   - Spring Boot 3.3.5, Java 21
   - Dependencies: `spring-cloud-starter-netflix-eureka-server`, `spring-boot-starter-actuator`, `micrometer-registry-prometheus`
   - `@EnableEurekaServer` on main class
   - Disable self-registration (`register-with-eureka: false`, `fetch-registry: false`)
   - Disable self-preservation in dev so dead instances evict quickly
   - Multi-stage Dockerfile (see conventions)

6. **`config-server/`** — Spring Cloud Config Server, port 8888
   - Dependencies: `spring-cloud-config-server`, `spring-cloud-starter-netflix-eureka-client`, actuator, prometheus
   - `@EnableConfigServer` on main class
   - Native profile (`spring.profiles.active: native`)
   - `spring.cloud.config.server.native.search-locations: ${CONFIG_REPO_PATH:file:../config-repo}` — env-overridable so it works locally and in Docker
   - Registers with Eureka
   - Multi-stage Dockerfile

7. **`config-repo/application.yml`** — shared config inherited by every service that reads from Config Server:
   - Eureka client settings (defaultZone, prefer-ip-address, lease intervals tuned for fast eviction in dev)
   - Actuator exposure: `health,info,prometheus,metrics,loggers,env`
   - Health probes enabled (liveness, readiness)
   - Tracing sampling probability `1.0` (note in comment: `~0.1` in prod)
   - Zipkin endpoint env-overridable
   - Shared `ledgerlite.jwt.{secret, ttl, issuer}` — secret env-overridable with a long dev-only default

**Verification at end of piece 1:**
```bash
docker compose -f docker-compose.infra.yml up -d
docker compose -f docker-compose.infra.yml ps   # all healthy
docker exec ledgerlite-postgres psql -U ledgerlite -l | grep -E 'auth_db|account_db|transaction_db|analytics_db'

(cd discovery-server && mvn -N wrapper:wrapper && ./mvnw spring-boot:run) &
# Visit http://localhost:8761 — Eureka dashboard loads

(cd config-server && mvn -N wrapper:wrapper && ./mvnw spring-boot:run) &
# curl http://localhost:8888/application/default | jq
# Returns the shared config as JSON
```

### ✅ Piece 2: Auth Service

**Completed.** All endpoints working, JWT issuance/validation, BCrypt hashing, Flyway migration, bean validation, RFC 7807 error responses, Swagger UI, Eureka registration, Config Server integration. No deviations from plan.

Build at `auth-service/` on port 8081 with database `auth_db`. Requirements:
- User entity: `id (UUID)`, `email (unique)`, `passwordHash`, `createdAt`, `roles`
- Endpoints:
  - `POST /api/auth/register` — body `{email, password}`, returns 201 + user
  - `POST /api/auth/login` — body `{email, password}`, returns `{token, expiresAt}`
  - `GET /api/auth/me` — requires JWT, returns current user
- BCrypt password hashing
- JWT issuance with HS256 (secret/ttl/issuer from shared config)
- Flyway migration `V1__create_users.sql`
- Spring Security config: stateless, `/register` and `/login` permitAll, everything else authenticated
- Global `@ControllerAdvice` exception handler returning RFC 7807 problem-detail responses
- Bean validation on request DTOs (`@Email`, `@Size(min=8)`)
- springdoc-openapi → `/swagger-ui.html`
- Register with Eureka, pull config from Config Server (use `spring-cloud-starter-config` + `spring.config.import=optional:configserver:`)
- Multi-stage Dockerfile matching the pattern from piece 1
- Pull JWT helper into a small utility class — pieces 3, 4, 5 will copy this same JWT-validation pattern (decide now: shared library jar, or duplicate per service? Recommendation: duplicate. A shared lib forces version coordination across services and is overkill at this scale. Document the tradeoff in the code.)

### ✅ Piece 3: Account Service

**Completed.** CRUD endpoints, optimistic locking with @Version, JWT validation, Flyway migration, Eureka registration, Config Server integration. No deviations from plan.

Build at `account-service/` on port 8082 with database `account_db`. Requirements:
- Account entity: `id (UUID)`, `userId (UUID)`, `name`, `type (CHECKING|SAVINGS|CREDIT)`, `balance (BigDecimal, precision 19, scale 4)`, `currency`, `version (@Version for optimistic locking)`, `createdAt`, `updatedAt`
- Endpoints (all require JWT, scope to `userId` from token):
  - `POST /api/accounts`
  - `GET /api/accounts` — list user's accounts
  - `GET /api/accounts/{id}`
  - `PATCH /api/accounts/{id}/balance` — internal-style endpoint for transaction service to call; expects `{delta, expectedVersion}`. Returns 409 on version mismatch.
- Flyway migration
- JWT validation (copy/adapt from auth-service)
- `OptimisticLockException` → 409 Conflict in `@ControllerAdvice`
- Dockerfile, register with Eureka

### ✅ Piece 4: Transaction Service

**Completed.** Feign client to account-service with HC5 (PATCH support), Resilience4j circuit breaker + retry, Kafka event publishing, idempotency keys, all CRUD endpoints. Integration tests pass against running infra. Deviations: (1) Used feign-hc5 instead of default JDK client because JDK HttpURLConnection doesn't support PATCH. (2) Integration test uses running docker-compose infra instead of Testcontainers due to Docker Desktop 4.70 API incompatibility with current Testcontainers/docker-java versions.

Build at `transaction-service/` on port 8083 with database `transaction_db`. **This is the centerpiece — the most demonstrative service.** Requirements:
- Transaction entity: `id (UUID)`, `accountId`, `userId`, `amount`, `category`, `description`, `idempotencyKey (unique)`, `createdAt`, `status (PENDING|POSTED|FAILED)`
- Endpoint: `POST /api/transactions`
  - Requires `Idempotency-Key` header (reject 400 if missing)
  - If key already used → return original response (200, not 201)
  - Steps: validate → call account-service via Feign to update balance → on success persist as POSTED → publish `TransactionPostedEvent` to Kafka topic `transactions.posted` → return 201
  - On account-service failure: persist as FAILED, return appropriate error
- Resilience4j circuit breaker on the Feign client to account-service (with fallback)
- Resilience4j retry with exponential backoff (3 attempts, only on 5xx/timeouts)
- Dual-write problem note in the code: we write to DB then publish to Kafka; in production use transactional outbox. Document this — it's a great interview question to surface yourself.
- Other endpoints: `GET /api/transactions/{id}`, `GET /api/transactions?accountId=...`
- **At least one Testcontainers integration test** spinning up Postgres + Redpanda, testing the full POST flow including idempotency replay
- Flyway, JWT validation, Dockerfile, Eureka

### ✅ Piece 5: Analytics Service

**Completed.** Kafka consumer on `transactions.posted`, idempotent via `processed_transactions` table, manual ack, monthly spending aggregation, both query endpoints working. Deviations: (1) Fixed Redpanda to use dual listeners (internal/external) for host access. (2) Set `spring.json.use.type.headers=false` so the consumer ignores the producer's class name header and uses its own DTO class.

Build at `analytics-service/` on port 8084 with database `analytics_db`. Requirements:
- Kafka consumer on `transactions.posted`, consumer group `analytics-aggregator`
- On each event, upsert into `monthly_spending` table: `(userId, accountId, yearMonth, category, totalAmount, transactionCount)` with PK `(userId, accountId, yearMonth, category)`
- Endpoints (JWT required, scope to userId):
  - `GET /api/analytics/spending?accountId=&month=YYYY-MM`
  - `GET /api/analytics/spending/by-category?month=YYYY-MM`
- Idempotent consumer: include `transactionId` in the event, dedupe via a `processed_transactions` table or use the upsert's natural idempotency
- Manual ack mode on the Kafka listener so we don't ack until the DB write succeeds
- Flyway, JWT validation, Dockerfile, Eureka

### ⏳ Piece 6: API Gateway + Production Deployment

Build at `api-gateway/` on port 8080:
- Spring Cloud Gateway with discovery-based routing (`spring.cloud.gateway.discovery.locator.enabled=true`) plus explicit route definitions per service
- Edge JWT validation as a `GlobalFilter` (parse + verify; reject 401 if invalid; pass `X-User-Id` header downstream)
- Allow-list for `/api/auth/register` and `/api/auth/login` (no JWT required)
- Rate limiting via Redis-backed `RequestRateLimiter` filter (add Redis to docker-compose) — or skip Redis and use in-memory if time is tight
- CORS config
- Aggregate Swagger UI showing all downstream service docs

Then production deployment:
- `docker-compose.yml` (full stack, separate from `docker-compose.infra.yml`) with all services + infra in one file, ready for Portainer Stack deployment
- Each service builds from its Dockerfile via compose `build:` directive, or pre-pushed to a registry
- Set `EUREKA_URL`, `CONFIG_REPO_PATH` (or `SPRING_PROFILES_ACTIVE=git`), `JWT_SECRET` etc. via env
- Caddy or Traefik in front for HTTPS termination (the owner already has a reverse proxy on the Beelink — coordinate with them)
- Resource limits on each service: `mem_limit: 512m` realistic for the Beelink
- Grafana datasource provisioning + import a Spring Boot dashboard from grafana.com
- Final README pass: architecture diagram, run instructions, design tradeoffs, interview talking points

---

## Coding conventions (use throughout)

- Package root: `com.ledgerlite.<service>` (e.g., `com.ledgerlite.auth`)
- Each service has its own `pom.xml` extending `spring-boot-starter-parent` (no parent pom — services are independently buildable)
- Multi-stage Dockerfiles: `maven:3.9-eclipse-temurin-21` build stage → `eclipse-temurin:21-jre-alpine` runtime stage
- JVM tuning in Docker: `-XX:MaxRAMPercentage=75.0 -XX:+UseG1GC`
- `application.yml` uses env-var overrides with sensible defaults: `${EUREKA_URL:http://localhost:8761/eureka/}`
- All services expose actuator: `health,info,prometheus,metrics` (auth/account/transaction/analytics also expose `loggers,env`)
- Tracing sampling: `1.0` in dev (would be `~0.1` in prod)
- Config Server inheritance: shared settings in `config-repo/application.yml`, service-specific overrides in `config-repo/<service-name>.yml`
- Comments explain **why**, not **what**. Keep them sparse.
- Use Java records for DTOs where reasonable
- No Lombok unless the owner asks for it (keeps the code more legible to interviewers)

## Service ports (canonical)

| Service             | Port  | DB              |
|---------------------|-------|-----------------|
| api-gateway         | 8080  | -               |
| auth-service        | 8081  | auth_db         |
| account-service     | 8082  | account_db      |
| transaction-service | 8083  | transaction_db  |
| analytics-service   | 8084  | analytics_db    |
| discovery-server    | 8761  | -               |
| config-server       | 8888  | -               |
| postgres            | 5432  | -               |
| redpanda (kafka)    | 19092 | -               |
| redpanda console    | 8085  | -               |
| zipkin              | 9411  | -               |
| prometheus          | 9090  | -               |
| grafana             | 3000  | -               |

---

## Interview talking points the project must demonstrate

Each of these should be implemented in code AND the owner should be able to explain it. When building a piece, make sure the relevant items are present and obvious in the code (so they're easy to walk through in a screen share):

1. **Idempotency keys** — transaction-service POST. Why: financial systems must tolerate client retries.
2. **Optimistic locking** with `@Version` — account-service balance updates. Why: avoid lost updates under concurrency without holding row locks.
3. **Circuit breakers + retries** with Resilience4j — transaction-service → account-service Feign client. Why: prevent cascading failure, give downstream a chance to recover.
4. **Event-driven / eventual consistency** — Kafka between transaction and analytics. Why: decouples write path from read path, enables independent scaling.
5. **Dual-write problem awareness** — transaction-service comments call out the DB+Kafka dual-write and document the transactional outbox as the proper fix.
6. **Edge JWT validation** at the gateway — services trust the gateway-injected `X-User-Id` header but still re-validate JWT for defense-in-depth.
7. **Distributed tracing** — Micrometer + Zipkin, propagated across HTTP and Kafka. Owner should be able to show a trace spanning multiple services.
8. **Health checks / Kubernetes-style probes** — `/actuator/health/liveness` and `/actuator/health/readiness` enabled.
9. **Database-per-service** — separate logical DBs per service, even though they share a Postgres instance. Note in README that prod would separate physically.
10. **Testcontainers** — at least one real integration test on transaction-service.
11. **Centralized config** — Spring Cloud Config Server, with a note that prod would use Git-backed mode + Vault for secrets.
12. **Service discovery** — Eureka, with note that K8s-native deployments would use Service objects instead.

---

## Owner working preferences

- Don't ask permission for obvious things (creating files, running mvn, installing deps) — just do them
- For non-obvious tradeoffs, explain inline in 1-2 sentences and pick a default
- Write actual code, not pseudocode or placeholders
- Don't pad responses with restatements of what was just said
- Push back if asked to do something that's a bad idea — owner respects this
- Build piece by piece — leave a working, runnable system at the end of each piece
- Don't over-test; one good Testcontainers integration test on transaction-service is the bar. Add unit tests where they're cheap, skip the rest.
- After completing a piece, update the "Build progress" section in this CLAUDE.md (mark ✅, note any deviations from the plan)
- After completing a piece, give the owner a short test plan they can run to verify it works end-to-end
- Commit to git after each piece completes (suggest the commit message; let the owner run the commit)

## What "done" looks like

- All 7 services running in Docker, deployed via Portainer Stack on the Beelink
- End-to-end demo: register user → login → create account → post transaction → query analytics — all via the gateway
- Testcontainers integration test passing on transaction-service
- Grafana dashboard showing live JVM/HTTP metrics
- Distributed trace visible in Zipkin spanning gateway → transaction-service → account-service → kafka → analytics-service
- README polished enough to send a hiring manager
- Owner can confidently walk through the code and answer interview questions for each of the 12 talking points above