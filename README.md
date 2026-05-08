# LedgerLite

A microservices system implementing a personal finance ledger, built on Spring Boot 3. Four business services (auth, account, transaction, analytics) sit behind an API gateway. Service discovery and config use the deployment platform's native primitives — Kubernetes Services + ConfigMaps in the K8s deployment, Docker DNS + env vars in the Compose deployment — instead of Eureka and Spring Cloud Config Server. Exercises the standard microservice patterns: service discovery, externalized config, API gateway, event-driven architecture, distributed tracing, resilience patterns, and Kubernetes deployment with probes, resource limits, and StatefulSets.

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
   - Redis (6379)             rate limit token buckets
   - Zipkin (9411)            distributed tracing
   - Prometheus (9090)        metrics scraping
   - Grafana (3000)           dashboards
   - Redpanda Console (8085)  Kafka topic browser (Compose only)

  Service discovery / config:
   - K8s deploy:    Service DNS (account-service.ledgerlite.svc.cluster.local)
                    + ConfigMaps + Secrets
   - Compose deploy: Docker network DNS (postgres, redpanda, etc.)
                     + env vars per container
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
| Discovery | K8s Service DNS / Docker network DNS (no Eureka) |
| Config | ConfigMaps + Secrets / env vars (no Spring Cloud Config) |
| Gateway | Spring Cloud Gateway |
| Auth | Spring Security + JWT (jjwt 0.12.x) |
| Rate Limiting | Redis + Spring Cloud Gateway RequestRateLimiter |
| Resilience | Resilience4j (circuit breaker + retry) |
| Inter-service HTTP | Spring Cloud OpenFeign |
| Tracing | Micrometer Tracing -> Zipkin |
| Metrics | Micrometer -> Prometheus |
| API docs | springdoc-openapi 2.x |
| Integration tests | Testcontainers |
| Frontend | React 18 + TypeScript (strict) + Vite |
| Frontend state/data | TanStack Query, Zustand |
| Frontend UI | shadcn/ui (Radix primitives) + Tailwind |
| Frontend tests | Vitest + React Testing Library, Playwright (e2e) |
| Deployment | Kubernetes (raw YAML manifests) and Docker Compose |

## Running

### Prerequisites
- Docker & Docker Compose

### Option 1: Docker Compose (simplest)

Builds and runs everything in Docker — no Java, no kubectl, no Maven needed on your machine.

```bash
docker compose up -d --build
```

Starts the five Spring services + infra (Postgres, Redpanda, Redis, Zipkin, Prometheus, Grafana). Services start in dependency order via health checks.

### Option 2: Kubernetes (kind / k3s / managed cluster)

Demonstrates the K8s primitives — probes, resource limits, ConfigMaps, Secrets, StatefulSets. See `k8s/README.md` for the full guide. Quick version on kind:

```bash
kind create cluster --name ledgerlite

# Build images and load them into the kind node
for svc in auth-service account-service transaction-service analytics-service api-gateway; do
  docker build -t ledgerlite/$svc:dev $svc/
  kind load docker-image ledgerlite/$svc:dev --name ledgerlite
done

# Apply all manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -R -f k8s/

# Wait for everything healthy (90s–3min)
kubectl get pods -n ledgerlite -w

# Expose the gateway and run e2e
kubectl port-forward -n ledgerlite svc/api-gateway 8080:8080 &
./e2e-test.sh
```

### Option 3: Dev mode (infrastructure in Docker, services on host)

Useful for fast iteration — Spring services restart instantly without rebuilding images.

Prerequisites: Java 21, Maven 3.9+

```bash
# 1. Start infrastructure
docker compose -f docker-compose.infra.yml up -d

# 2. Start services (each in a separate terminal, any order — no Eureka, no Config Server)
cd auth-service && ./mvnw spring-boot:run
cd account-service && ./mvnw spring-boot:run
cd transaction-service && ./mvnw spring-boot:run
cd analytics-service && ./mvnw spring-boot:run
cd api-gateway && ./mvnw spring-boot:run
```

### Running tests

Once all services are healthy:

```bash
./e2e-test.sh
```

Runs 37 end-to-end tests through the gateway covering auth, accounts, transactions (with idempotency), analytics (Kafka event processing), and rate limiting.

### Stopping

```bash
# Compose
docker compose down

# K8s (kind)
kind delete cluster --name ledgerlite

# Dev mode
pkill -f "spring-boot:run"
docker compose -f docker-compose.infra.yml down
```

### Try it out

Requires `jq` for JSON parsing (`brew install jq`). If any step prints `null`, the previous step failed — re-run it and inspect the response.

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
TX_ID=$(curl -s -X POST http://localhost:8080/api/transactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d "{\"accountId\":\"$ACCOUNT_ID\",\"amount\":-35.50,\"category\":\"FOOD\",\"description\":\"Lunch\"}" | jq -r '.id')

# Reverse it (append-only ledger: original row stays, a negated row is appended)
curl -s -X POST http://localhost:8080/api/transactions/$TX_ID/reverse \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"reason":"wrong amount"}'

# Check spending analytics (wait a few seconds for Kafka processing)
sleep 3
curl -s "http://localhost:8080/api/analytics/spending/by-category?month=$(date +%Y-%m)" \
  -H "Authorization: Bearer $TOKEN"
```

All requests go through the API gateway on port 8080. Requires `jq` for JSON parsing (`brew install jq`).

### Dashboards
- **Zipkin (distributed traces):** http://localhost:9411
- **Grafana (metrics dashboards):** http://localhost:3000
- **Prometheus (raw metrics):** http://localhost:9090
- **Redpanda Console (Kafka topics, Compose only):** http://localhost:8085
- **Swagger UI:** http://localhost:8081/swagger-ui.html (per-service, ports 8081-8084)

On K8s, dashboards are inside the cluster — `kubectl port-forward -n ledgerlite svc/grafana 3000:3000` (and similar for the others) to reach them.

## Design Tradeoffs

- **Database-per-service on a shared Postgres instance.** Separate logical DBs keep service boundaries clean. In production, separate physical instances for true isolation and independent scaling.
- **Platform-native discovery and config, no Eureka or Spring Cloud Config Server.** Real K8s shops don't run Eureka — Service DNS gives every pod a stable name (`http://account-service:8082`), and ConfigMaps + Secrets cover what Config Server used to do. The Compose deployment gets the same effect from Docker network DNS + per-container env vars. Removing both pieces of machinery cut ~1500 lines of code and infrastructure without losing anything an interviewer would ask about. The interview talking point is *why* — Eureka and Config Server made sense in the EC2 era; on K8s they duplicate primitives the platform already provides.
- **Redpanda in dev-container mode.** Single-node, no persistence guarantees. Fine for dev; production would run a proper cluster.
- **Tracing at 100% sampling.** Great for dev/demo. Production would sample ~10% to control overhead.
- **Duplicated JWT validation** across services instead of a shared library. Avoids version coordination overhead at this scale. A shared lib makes sense at 10+ services.
- **Redis-backed rate limiting** at the gateway (20 req/sec sustained, burst to 40). Uses Spring Cloud Gateway's built-in `RequestRateLimiter` with Redis token buckets, so rate limits are shared across multiple gateway instances. Keyed by client IP.
- **Append-only ledger for transaction reversals.** Transactions are immutable. To "undo" a transaction, `POST /api/transactions/{id}/reverse` inserts a new row with negated amount that references the original via `reversesTransactionId`; the original is never mutated. A partial unique index (`uq_one_reversal_per_tx` on `reverses_transaction_id`) is the definitive guard against concurrent double-reversal — the DB rejects the second insert with a constraint violation that the controller advice maps to `409 already_reversed`. This is how real ledger systems handle corrections (reversal-then-new-entry rather than mutation), and it gives analytics a self-correcting Kafka stream: the negated row flows through the same `transactions.posted` pipeline and offsets the original aggregate.
- **K8s manifests are flat YAML, not Helm or Kustomize.** Easier to read in an interview screen-share. Probes, resource limits, ConfigMaps + Secrets, StatefulSets + PVCs are all present and labelled — the talking points map directly to identifiable lines of YAML. Two K8s-specific gotchas resolved during deployment and documented in `k8s/README.md`: `enableServiceLinks: false` to suppress the legacy Docker-link env injection that breaks Spring's port parsing, and `initialDelaySeconds: 120` on liveness probes because Spring 3.3 + JPA + Kafka takes well over a minute to bootstrap.

## Development Workflow

This repo uses a Claude Code-driven workflow with specialist subagents and review gates.

### Pre-push review hook

`.githooks/pre-push` runs the Claude `code-reviewer` agent against the diff being pushed and blocks on `block` / `changes-requested` verdicts. To enable in your local clone:

```bash
git config core.hooksPath .githooks
```

Bypass for WIP pushes: `SKIP_CLAUDE_REVIEW=1 git push` (or `git push --no-verify`).

Each push invokes the Claude API and consumes tokens — skip on noisy WIP pushes, run for real submissions.

### Frontend e2e (Playwright)

A single golden-path spec at `frontend/e2e/golden-path.spec.ts` covers the full demo flow: register → login → create account → post transaction → see it in analytics (proving the Kafka pipeline) → log out.

One-time setup:

```bash
cd frontend && npm install
npx playwright install chromium
```

Run it (the **backend stack must be running** at :8080 — see "Run instructions" above):

```bash
cd frontend && npm run e2e          # headless
cd frontend && npm run e2e:ui       # interactive UI mode
```

The Vite dev server is auto-started by `playwright.config.ts`. The component-level Vitest suite (`npm run test`) is unchanged and remains the primary signal — Playwright is for the cross-service demo flow only.
