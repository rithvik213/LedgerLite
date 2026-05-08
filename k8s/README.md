# LedgerLite on Kubernetes

Flat-YAML manifests to deploy the full LedgerLite stack onto any Kubernetes cluster (kind / k3s / microk8s / managed). No Helm, no Kustomize — easier to read in an interview screen-share.

## Layout

```
k8s/
  namespace.yaml           — single namespace `ledgerlite`
  secrets/app-secrets.yaml — JWT signing key + Postgres password
  configmaps/              — postgres init script, Prometheus scrape config,
                             Grafana datasource provisioning
  infra/                   — Postgres (StatefulSet+PVC), Redpanda (StatefulSet+PVC),
                             Redis, Zipkin, Prometheus, Grafana
  services/                — auth, account, transaction, analytics, api-gateway
```

## Deploy on kind

```bash
# 1. cluster
kind create cluster --name ledgerlite

# 2. build images and load into the kind node
for svc in auth-service account-service transaction-service analytics-service api-gateway; do
  docker build -t ledgerlite/$svc:dev $svc/
  kind load docker-image ledgerlite/$svc:dev --name ledgerlite
done

# 3. apply manifests (namespace first so subsequent applies have somewhere to land)
kubectl apply -f k8s/namespace.yaml
kubectl apply -R -f k8s/

# 4. wait for everything to roll out (90s–3min depending on hardware)
kubectl get pods -n ledgerlite -w

# 5. expose the gateway and run e2e
kubectl port-forward -n ledgerlite svc/api-gateway 8080:8080 &
./e2e-test.sh
```

## Deploy on k3s (Beelink homelab)

Same as above, except images need to be in a registry the cluster can pull from.
Either:
- Push to GHCR/Docker Hub and update the `image:` references, OR
- Run a local registry on the Beelink and tag images accordingly.

## What this demonstrates

- **Probes** — every pod has liveness + readiness wired to `/actuator/health/{liveness,readiness}`. Pod gets restarted on liveness failure, removed from Service load-balancing on readiness failure.
- **Resource limits** — every container declares CPU + memory requests and limits. The JVM's `-XX:MaxRAMPercentage=75.0` tracks the memory limit.
- **ConfigMap + Secret separation** — config (Prometheus scrape targets, Grafana datasources, Postgres init) lives in ConfigMaps; the JWT signing key and DB password live in a Secret. Prod would source the Secret values via External Secrets Operator → Vault / AWS Secrets Manager.
- **StatefulSet + PVC for stateful workloads** — Postgres and Redpanda each have a stable network identity and persistent storage that survives pod restart.
- **Service DNS as service discovery** — no Eureka needed. `http://account-service:8082` from any pod resolves to the right place via CoreDNS.
- **NodePort for the gateway** — simplest way to expose the cluster boundary on a single-node setup. Production would put an Ingress controller (nginx-ingress, Traefik) in front for TLS termination and host-based routing.

## What this does NOT include (intentionally)

- No Helm/Kustomize — see top-of-doc note.
- No service mesh (Istio, Linkerd) — overkill at this scope.
- No HPA / VPA / cluster autoscaler — single-node demo.
- No PodDisruptionBudgets — single-replica services don't benefit.
- No NetworkPolicies — overkill at this scope.
- No Ingress + cert-manager — Beelink's existing reverse proxy handles TLS termination outside the cluster.
- `redpanda-console` is omitted (debug-only convenience, runs fine in compose).

## Gotchas this layout already accounts for

- `enableServiceLinks: false` on every Spring deployment. K8s otherwise injects legacy
  Docker-link env vars like `REDIS_PORT=tcp://10.x.x.x:6379` which Spring Boot then tries
  to parse as an integer port and crashes. Disabling service links is the standard fix.
- `initialDelaySeconds: 120` on liveness probes. Spring 3.3 + JPA + Kafka takes well over
  a minute to fully start; a tighter delay caused liveness failures and pod restarts before
  the app finished bootstrapping.
- Postgres `PGUSER=ledgerlite` env var so the multi-database init script's `psql` calls
  authenticate as the right user — without it the script's `psql` defaults to `root` and
  the init fails silently.
