# Architecture

Kustomize base/overlays, Key Vault-backed secrets via Workload Identity,
NetworkPolicy, Trivy-scanned images, blue/green releases for qa/prod, and
pipelines that reach the cluster only via `az aks command invoke` -- applied
to this repo's two stateless HTTP workloads.

## Topology

One AKS cluster for dev/qa, three namespaces:

| Namespace | Purpose | Topology |
|---|---|---|
| `app-coal-stockpile` | Development | Single Deployment per workload, plain in-place rolling updates |
| `app-coal-stockpile-qa` | QA / release rehearsal | Two Deployments per workload (`-blue`/`-green`), blue/green releases |
| `app-coal-stockpile-prod` | Production | Same blue/green topology as qa, own cluster (not yet provisioned) |

Each namespace runs two independently-built, independently-deployed
workloads -- backend (`eskom-forecast-api`, FastAPI) and frontend
(`coalstockpilefrontend`, nginx) -- plus one shared Gateway (NGINX Gateway
Fabric) fronting both. Every pattern below is applied **twice**, once per
workload, sharing one set of parameterized pipeline templates
(`pipelines/templates/`).

## Blue/green without a data layer

These workloads hold no state of their own -- both colors read/write the
same external Blob Storage and Azure SQL source, so there is nothing to keep
in sync between `-blue` and `-green`. Blue/green here reduces to exactly one
thing: **which color's pods the client Service's `color` selector points
at**.

- The client Service (`k8s/base/{backend,frontend}/shared/service.yaml`)
  selects on `app` + `color`. `color: blue` is the bootstrap default.
- `deploy-stage.yml` bumps only the inactive color's image (queried live
  from the cluster) and applies.
- `smoke-test-stage.yml` waits for the inactive color's pods to be Ready,
  then runs one check bypassing the Service entirely (a Python one-liner
  hitting `/healthz` for the backend; `nginx -t` for the frontend -- see the
  comment at the top of that file for why the check differs by workload).
- `cutover-stage.yml` flips the Service's `color` selector, confirms the
  Service's Endpoints now resolve only to pods of the new color, and reverts
  the flip automatically if that check fails.

There is no failover step, no listener, no synchronization-state check --
these workloads being stateless means cutover is just the selector flip plus
a verification, not a two-step "promote-then-flip" sequence.

## Pipeline execution mechanics

Pipelines run on a **self-hosted agent pool** (`pool: { name: default,
demands: [Agent.OS -equals Linux] }`) with no direct network path to the AKS
API server (confirmed directly: `kubectl` from a machine outside this
network fails to resolve the cluster's private-link FQDN), egress only via
`swgproxy.eskom.co.za:8080`. Every cluster interaction goes through `az aks
command invoke` (an `AzureCLI@2` task using the ARM service connection);
`kustomize` itself still runs locally on the agent since rendering/editing
YAML needs no cluster access, and only the final rendered manifest is
uploaded and applied via `--file`. Rollout/readiness waits are a
short-timeout polling loop, not one long blocking call, since `az aks
command invoke` has its own internal wait budget under 5 minutes.

Base images (`python:3.11-slim`, `nginx:1.27-alpine` -- both Docker Hub, not
MCR) are mirrored into ACR via `az acr import` before `docker build`: the
agent has no direct route to pull them, and the docker daemon's own
`FROM`-pull doesn't honor `HTTP_PROXY`/`HTTPS_PROXY` build-args (those only
affect `RUN`-step processes). The backend Dockerfile's `apt-get`/`curl` steps
(ODBC driver install) do go through the proxy via build-args, using the
existing `TRUST_CORPORATE_CA` + `certs/zscaler-root-ca.crt` mechanism that
was already scaffolded (previously only exercised for local Zscaler-behind
development, now also used by CI).

## Persistence

None of *this repo's* workloads hold state -- no PersistentVolumes, no
StorageClass, no backup CronJob. All durable state lives outside them: Azure
Blob Storage, and a SQL Server database (see "Database" below) that happens
to run in-cluster but is owned and persisted by a separate deployment, not
this one.

## Database

The source database (`SQL_SERVER_HOSTNAME`/`SQL_DATABASE_NAME`, read by
`src/ingest.py`) is a SQL Server instance running **in-cluster**, not Azure
SQL -- confirmed live: namespace `mssql-dev` has a `mssql` ClusterIP Service
(port 1433) fronting a running `mssql-0` pod. This app connects to it purely
as a client; it does not own, deploy, or back up that database.

- **Cross-namespace reachability.** The backend pod lives in
  `app-coal-stockpile`, the database in `mssql-dev` -- a different
  namespace. `SQL_SERVER_HOSTNAME` must therefore be the
  namespace-qualified form (`mssql.mssql-dev.svc.cluster.local`), not a bare
  `mssql` (unlike this app's own frontend->backend same-namespace DNS --
  see `frontend/nginx.conf`).
- **NetworkPolicy**: `mssql-dev`'s own NetworkPolicy (`mssql-allow-1433`,
  in the `mssql-dev` namespace -- not ours to own or change) originally
  allowed ingress on 1433 only from pods within its own namespace, which
  would have blocked our backend pod entirely. It's since been updated (by
  whoever owns that namespace) to `namespaceSelector: {}` -- ingress from
  any namespace on the cluster -- confirmed live via
  `kubectl get networkpolicy -n mssql-dev -o yaml`. No further NetworkPolicy
  change is needed for dev; qa/prod will need the equivalent once their own
  `mssql-<env>` instances exist, unless they're provisioned with the same
  any-namespace rule from the start.
- **TLS trust.** ODBC Driver 18 defaults to validating the server's TLS
  certificate against a trusted CA, which works for Azure SQL but not this
  in-cluster instance's self-signed certificate (the same reason this
  cluster's own `mssql` health checks connect with sqlcmd's `-C`
  /`-TrustServerCertificate` flag). `src/ingest.py`'s connection string sets
  `Encrypt=yes;TrustServerCertificate=yes;` to match -- the connection stays
  encrypted, it just doesn't validate the server's identity against a CA.
- **A dedicated SQL login, not `sa`.** `SQL_USERNAME`/`SQL_PASSWORD` should
  be a least-privilege login created specifically for this app (read access
  to the source tables, per `src/ingest.py`'s queries), not the SQL Server
  instance's own `sa` account -- creating that login is a database-owner
  action, not something this repo's manifests do.

## Security & secrets

- **Key Vault + Secrets Store CSI Driver**, via Azure Workload Identity. One
  UAMI per environment for the **backend only** (the frontend has no
  secrets and needs no identity) -- this **extends** the UAMI the backend
  already uses for Storage access (`docs/aks-workload-identity-storage.md`)
  with a second role assignment (`Key Vault Secrets User`) rather than
  provisioning a second identity, since one pod only ever needs one
  identity. dev and qa share `MAZ-KV-SAN-DTI-NONPROD01` with other nonprod
  workloads on that cluster -- secret *names* are env-suffixed
  (`coalstockpile-sql-username-dev` vs `-qa`) so the two environments (and
  anything else in that vault) never collide. Prod is expected to get its
  own vault.
- **NetworkPolicy**: default-deny, then explicit allow. Backend allows
  ingress on `8000` from same-namespace pods (the frontend's `/api` reverse
  proxy) and from the NGF gateway's namespace (`nginx-gateway`, the
  Gateway's direct-to-backend routes). Frontend allows ingress on `80` from
  the gateway's namespace only. No `policyTypes: Egress` restriction -- the
  backend needs open egress to Azure Storage/SQL/Open-Meteo, and egress
  allowlisting is a separate, larger effort not in scope here.
- **RBAC**: dev and qa share one AKS cluster and one ARM service connection
  (`DTI-NONPROD-AZURE-CONNECTION`), whose `az aks command invoke` RBAC is
  cluster-scoped, not namespace-scoped, so dev and qa's pipeline credentials
  could technically reach each other's namespace. Prod is isolated
  regardless, on its own cluster/connection once provisioned.
- **Image hardening**: `pipelines/templates/build-scan-push.yml` fails the
  build on any HIGH/CRITICAL Trivy finding on the pushed image;
  `validate-stage.yml` runs `trivy config` against the *rendered* manifests
  (not the raw `k8s/` source tree -- kustomize patches are intentionally
  partial, so scanning them directly produces false positives). No
  `.trivyignore` entries yet (`k8s/.trivyignore`) -- add them only for
  confirmed false positives or deliberately-accepted risk, each justified
  inline.

## Exposure

- **No `Gateway` object of our own.** This repo originally created its own
  `Gateway` per environment (matching a pattern documented for a different
  app on this platform: "each app team owns its own Gateway"). That doesn't
  actually work on this cluster -- confirmed live: NGF here runs in
  `static-mode` (`kubectl get deploy ngf-nginx-gateway-fabric -n
  nginx-gateway -o jsonpath='{.spec.template.spec.containers[*].args}'`
  shows `static-mode --gatewayclass=nginx`), which binds to exactly **one**
  `Gateway` resource per `GatewayClass`, cluster-wide -- not one per
  namespace, not one per app. `lineai-gateway` (namespace `lineai-dev`)
  already holds that slot (`Accepted`/`Programmed: True` for 28+ days by
  the time this was found); our own `stockpile-gateway` Gateway object was
  created, applied, and immediately stuck permanently on status
  `GatewayConflict` / `Programmed: False` -- nothing in its spec could have
  fixed that, since the conflict is about which Gateway *object* NGF is
  bound to, not anything about the object's content. It's since been
  deleted.
- **Attaches to `lineai-gateway` instead**, via a cross-namespace
  `HTTPRoute` `parentRef` (`k8s/base/gateway/gateway.yaml`) -- the same way
  `kibana`'s `HTTPRoute` (namespace `logging`) already does it (confirmed
  live via `kubectl get gateway lineai-gateway -o yaml`: dedicated
  `kibana-http`/`kibana-https` listeners with
  `allowedRoutes.namespaces.from: All`). `lineai-gateway`'s owner needs to
  add the equivalent two listeners for this app's hostname -- not something
  this repo's manifests can do, it's a resource in another namespace (same
  situation as the mssql-dev NetworkPolicy fix earlier in this project) --
  see `docs/RUNBOOK.md` for the exact patch to hand them.
  **Every `parentRef` must set `sectionName`** to that specific listener,
  never left to attach by name alone: a Gateway-wide parentRef (no
  `sectionName`) matches **every** listener whose `allowedRoutes` permits
  our namespace, not just ours. This broke Kibana on 2026-07-26 (our route
  silently attached to `kibana-http`/`-https` too, since those also allow
  routes from any namespace, and won the tie-break against kibana's own
  route) -- see the postmortem in `k8s/base/gateway/gateway.yaml` and
  `docs/RUNBOOK.md`. `hostnames` is set as defense-in-depth for the same
  reason.
- **TLS**: a `ReferenceGrant` (also in `k8s/base/gateway/gateway.yaml`)
  permits `lineai-gateway`'s https listener to reference this app's
  `kubernetes.io/tls` Secret across namespaces -- Gateway API requires this
  any time a Gateway's `certificateRefs` points outside its own namespace,
  same as `kibana-tls-secret` needed for the `logging` namespace. The cert
  itself is signed by Eskom's internal CA (not self-signed, not from a
  public CA) and loaded via a one-time `kubectl create secret tls`, not
  sourced from Key Vault like this repo's other secrets -- see
  `docs/RUNBOOK.md`.
- This cluster's NGF install has exactly one NGF-managed LoadBalancer
  Service (`ngf-nginx-gateway-fabric`, in namespace `nginx-gateway`,
  VNet-internal) -- `lineai-gateway`'s programmed address is that same IP.
  So this app is **internal-only**, matching every other Gateway-fronted
  app on this cluster -- there is no path to a dedicated public IP for it
  short of the platform team reconfiguring NGF's provisioning mode
  entirely (a shared-infrastructure change affecting every app on this NGF
  instance, not something scoped to this repo).
- **Single entry point** otherwise unchanged: both the backend
  (`eskom-forecast-api`) and frontend (`coalstockpilefrontend`) Services
  are plain `ClusterIP` -- no Azure LoadBalancer of their own. `lineai-gateway`
  reaches both directly over the cluster network once its listeners exist,
  so neither Service needs its own LB.

## Branch strategy -> pipeline triggers

GitFlow shape: `feature/*` -> `development` (dev pipelines) -> `release/*`
(qa pipelines) -> `main` (prod pipelines, gated by manual approval before
cutover). The remote actually has `main` and `develop` (not `development`) --
the dev pipelines' trigger (`feature/*`) doesn't depend on that naming
either way, but qa's `release/*` trigger and the `develop`/`development`
naming mismatch are both still open: decide whether to rename the branch,
retarget the dev pipeline's merge-trigger branch to `develop`, or treat this
as its own separate decision, before relying on branch-based triggers for
qa. `release/*` branches don't exist yet regardless.
