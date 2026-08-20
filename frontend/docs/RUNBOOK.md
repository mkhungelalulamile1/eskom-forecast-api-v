# Runbook

Supersedes the old `docs/deployment-runbook.md` (flat-manifest, single-environment
version). See `docs/ARCHITECTURE.md` for design/rationale and
`docs/aks-workload-identity-storage.md` for the Storage-specific Workload
Identity debugging path (still accurate, just extended -- see §3 below).

## 0. Known infrastructure

dev and qa share one existing AKS cluster/resource group/ACR/Key Vault/agent
pool with other workloads already running on this platform's nonprod
environment. Prod has none of its own yet -- everything prod-related below
is a placeholder pending separate resources.

| Resource | Value | Used by |
|---|---|---|
| Azure AD tenant | `93aedbdc-cc67-4652-aa12-d250a876ae79` | all environments -- confirmed via `az login` |
| AKS resource group | `SAN-DTI-NONPROD-RG` | dev + qa |
| AKS cluster | `MAZ-AKS-SAN-DTI-NonProd` | dev (`app-coal-stockpile`) + qa (`app-coal-stockpile-qa`) namespaces on this one cluster |
| ACR name | `MAZACRSANDTINONPROD` | dev + qa pipelines (`acrName` variable) -> `mazacrsandtinonprod.azurecr.io` -- confirmed via `az acr show` (shared with other nonprod workloads on this cluster, `ACRSTOCKPILECONNECTION` is the ADO service-connection name, not the registry itself) |
| ARM service connection | `DTI-NONPROD-AZURE-CONNECTION` (ADO service-endpoint id `eebcde31-66f6-456b-948e-e94de2174836`) | dev + qa pipelines' `azureServiceConnection` -- used for everything (ACR login, `az aks command invoke`), not just AKS. Confirmed live: `WorkloadIdentityFederation` auth scheme (no stored secret), `isReady: true`, and its service principal (`78cceced-4abe-4811-9da1-adf2dc9d9a38`) holds `Contributor` + `Azure Kubernetes Service RBAC Cluster Admin` on `SAN-DTI-NONPROD-RG`, plus `AcrPull`/`AcrPush` on `MAZACRSANDTINONPROD` -- covers every operation this repo's pipelines perform |
| Self-hosted agent pool | `pool: { name: default, demands: [Agent.OS -equals Linux] }` | all pipeline templates, reused from this cluster's existing self-hosted pool |
| SWG proxy | `http://swgproxy.eskom.co.za:8080` | tool downloads (kustomize/kubeconform/trivy) + Dockerfile `HTTP_PROXY`/`HTTPS_PROXY` build-args |
| Key Vault | `MAZ-KV-SAN-DTI-NONPROD01` | shared with other nonprod workloads on this cluster -- this repo's secrets are env-suffixed (`coalstockpile-sql-username-dev`/`-qa`, `coalstockpile-sql-password-dev`/`-qa`) to avoid colliding with theirs |
| NGF data plane | Runs in `static-mode` (confirmed via the NGF Deployment's own container args) -- binds to exactly **one** `Gateway` resource per `GatewayClass`, cluster-wide. `lineai-gateway` (namespace `lineai-dev`) already holds that slot; a second `Gateway` object (this app's original approach) gets `GatewayConflict` and never programs, regardless of its spec | This app attaches via a cross-namespace `HTTPRoute` `parentRef` to `lineai-gateway` instead of owning a `Gateway`; see `docs/ARCHITECTURE.md` "Exposure" |
| dev's SQL Server | `mssql` ClusterIP Service, namespace `mssql-dev` (port 1433, pod `mssql-0` Running) | Backend's `SQL_SERVER_HOSTNAME` (`mssql.mssql-dev.svc.cluster.local`) -- an in-cluster database this app connects to but doesn't own; see `docs/ARCHITECTURE.md` "Database" |
| Storage account | `sasandtidiagnonprod01` (`https://sasandtidiagnonprod01.blob.core.windows.net`) | Backend's `AZURE_STORAGE_ACCOUNT_URL` -- confirmed live via `az storage account show`, shared with other nonprod workloads on this cluster |

## 1. Readiness check before the first dev pipeline run

As of this writing, running the dev pipelines would **not** succeed end to
end. In priority order (each blocks everything below it):

1. **Nothing is committed or pushed.** `git status` on this working copy
   shows every file this overhaul touched (`k8s/`, `pipelines/`, `docs/`,
   plus the pre-existing `main.py`/`src/`/`training/`/`frontend/`/
   `Dockerfile`/etc.) as untracked -- only `README.md` has ever been
   committed. The remote (`origin`) is Azure Repos:
   `.../Coal_Stockpile_Model/_git/COAL_STOCKPILE_MODEL_DASH_AKS`, on branch
   `feature/ci-cd-setup` locally (not yet pushed). Nothing below matters
   until this is committed and pushed.
2. **No ADO Pipeline definition points at this repo yet.** The
   `Coal_Stockpile_Model` ADO *project* already has six pipeline
   definitions (`Coal_Stockpile-Frontend`, `Coal_Stockpile_databackend`,
   `Coal_Stockpile_Modelbackend`, `Coal_Stockpile_Model`,
   `Coal_Stockpile_Model-R2`, plus Veracode) -- but the ones checked all
   target the **other** git repo in this project, `Coal_Stockpile_Model`
   (e.g. `Coal_Stockpile_Modelbackend` runs `azure-pipelines-2.yml` from
   that repo, on the Microsoft-hosted pool). None target this repo,
   `COAL_STOCKPILE_MODEL_DASH_AKS`, or any of the
   `pipelines/azure-pipelines-{backend,frontend}-{dev,qa,prod}.yml` files
   this overhaul added. New Pipeline definitions need to be created in ADO
   (Pipelines -> New pipeline -> this repo -> existing YAML) pointing at
   each.
3. **No `COAL-STOCKPILE-*` ADO Environment exists.** Only one Environment
   exists in this project, named `Test`. `deploy-stage.yml`/
   `cutover-stage.yml`'s `environment:` field will fail with "Environment
   could not be found" without one named exactly `COAL-STOCKPILE-DEV`
   (Pipelines -> Environments -> New environment).
4. ~~No Workload Identity exists for this app~~ **-- resolved for dev.**
   `id-coalstockpile-dev` (`SAN-DTI-NONPROD-RG`) exists, federated to
   `system:serviceaccount:app-coal-stockpile:eskom-forecast-sa`, client-id
   `75399a2c-0c4b-4b55-a568-89763fb6d6eb` filled into
   `k8s/overlays/dev/backend/patch-serviceaccount.yaml` and
   `patch-secretproviderclass.yaml`, and both role assignments
   (`Key Vault Secrets User` on `MAZ-KV-SAN-DTI-NONPROD01`,
   `Storage Blob Data Contributor` on `sasandtidiagnonprod01`) confirmed
   live via `az role assignment list --assignee
   b08b85b4-2d5e-4d78-80c3-87ee2e1bba6b --all` -- an admin with
   `Owner`/`User Access Administrator` on those two resources granted them
   (the account that created the identity itself lacked that right, the
   same wall `aks-mssql-setup` hit for this identical vault). RBAC changes
   can take a few minutes to propagate -- if the very next pipeline run
   still hits a Key Vault auth error, retry once rather than assuming
   something regressed. One Git-Bash-specific gotcha worth keeping in mind
   for next time: a leading `/subscriptions/...` CLI argument gets silently
   rewritten into a Windows path unless `MSYS_NO_PATHCONV=1` is set, which
   surfaces as a confusing `MissingSubscription` error unrelated to actual
   permissions.

   **qa's identity exists but is not yet role-assigned.**
   `id-coalstockpile-qa` (`SAN-DTI-NONPROD-RG`) created, federated
   (`fic-coalstockpile-qa`) to
   `system:serviceaccount:app-coal-stockpile-qa:eskom-forecast-sa`,
   client-id `19274d54-b8f0-4700-9dae-6c1c07dde191` filled into
   `k8s/overlays/qa/backend/patch-serviceaccount.yaml` and
   `patch-secretproviderclass.yaml` (principal-id
   `9e694555-9df7-4896-9335-2506faf0d4f9`, for the role-assignment step
   below). Still needed, same wall as dev hit -- an admin with
   `Owner`/`User Access Administrator` on the vault + storage account must
   grant:
   ```bash
   az role assignment create --assignee 9e694555-9df7-4896-9335-2506faf0d4f9 \
     --role "Key Vault Secrets User" \
     --scope "/subscriptions/abe5d9dc-a6ff-49b2-b485-e68e6cb14d0e/resourceGroups/SAN-DTI-NONPROD-RG/providers/Microsoft.KeyVault/vaults/MAZ-KV-SAN-DTI-NONPROD01"

   az role assignment create --assignee 9e694555-9df7-4896-9335-2506faf0d4f9 \
     --role "Storage Blob Data Contributor" \
     --scope "/subscriptions/abe5d9dc-a6ff-49b2-b485-e68e6cb14d0e/resourceGroups/SAN-DTI-NONPROD-RG/providers/Microsoft.Storage/storageAccounts/sasandtidiagnonprod01"
   ```
5. ~~Key Vault secret values unverified~~ **-- resolved.** Confirmed live
   (from inside the vault's private network) via `az keyvault secret list
   --vault-name MAZ-KV-SAN-DTI-NONPROD01`: both `coalstockpile-sql-username-dev`
   and `coalstockpile-sql-password-dev` already exist (Enabled: True),
   matching the exact names `k8s/overlays/dev/backend/patch-secretproviderclass.yaml`
   expects. Not verified: that their *values* are a real, working SQL login
   against `mssql-dev` -- see item 7 below. The same vault also holds
   `mssql-sa-password-dev` (mssql's own secret, confirming this is indeed
   the shared vault) plus several unrelated secrets
   (`DJANGO-SECRET-KEY`, `ENTRA-LINEAI-DEV-CLIENT-SECRET`, `GEMINI-API-KEY`,
   `Test-secret`) belonging to other workloads sharing it -- nothing here
   reads or writes those.
6. ~~Bronze/gold/metrics/weather/models containers unconfirmed~~ **--
   containers created, no data yet.** Confirmed live (`list_containers()`
   from inside `eskom-forecast-api`'s own pod, using its Workload Identity)
   that none of `bronze`/`gold`/`metrics`/`weather`/`models` existed in
   `sasandtidiagnonprod01` -- this was the actual cause of the dashboard's
   "Unable to load forecast data" error
   (`ContainerNotFound` reading `daily/predictions.parquet` from Gold).
   Created all 5 (empty) the same way -- `id-coalstockpile-dev`'s
   `Storage Blob Data Contributor` role covers container creation, not just
   blob read/write. `az storage container create` from a local machine
   fails with a network-rule error (same private-network restriction as
   the Key Vault) -- must run from inside the cluster/VNet.
   **Still outstanding:** the containers are empty. Re-hitting
   `/api/forecast-data` now fails with `BlobNotFound` for
   `daily/predictions.parquet` instead of `ContainerNotFound` -- expected,
   since nothing has ingested source data into Bronze or written
   predictions into Gold yet. That requires actually running this app's
   own ingest (`src/ingest.py`) and prediction (`src/app.py`'s Gold-write
   path) logic against real data -- a data/ML workflow, not a deploy-time
   fix, and out of scope for this runbook to script blindly.
7. **mssql-dev's target database and a dedicated SQL login for this app**
   still need creating (NetworkPolicy access is already fixed -- see
   `docs/ARCHITECTURE.md` "Database"). This affects runtime ingestion, not
   the pipeline/deploy succeeding.
8. **Branch strategy mismatch.** `docs/ARCHITECTURE.md`'s branch strategy
   assumed only `main` exists; the remote actually also has `develop`
   (not `development`, which is what the dev pipeline's trigger doesn't
   reference anyway -- it triggers on `feature/*`, which does match the
   current local branch `feature/ci-cd-setup`). Worth deciding whether `qa`'s
   `release/*` trigger and `develop` vs. `development` naming should be
   reconciled before relying on branch-based triggers for qa/prod.

None of the `PLACEHOLDER_*` fill-ins below matter until 1-4 above are
resolved -- they'd just cause a *different* failure further into the
pipeline.

## 2. Before first use: fill in remaining placeholders

Search with `grep -rn PLACEHOLDER_ k8s/ pipelines/`:

| Placeholder | Where | Filled in by |
|---|---|---|
| ~~`PLACEHOLDER_UAMI_CLIENT_ID` (dev), `PLACEHOLDER_UAMI_CLIENT_ID_QA`~~ | `k8s/overlays/{dev,qa}/backend/patch-serviceaccount.yaml`, `patch-secretproviderclass.yaml` | **-- resolved for both.** dev: `75399a2c-0c4b-4b55-a568-89763fb6d6eb`. qa: `19274d54-b8f0-4700-9dae-6c1c07dde191` (see §1 item 4 -- role assignments for qa's identity still pending an admin) |
| `PLACEHOLDER_AZURE_SERVICE_CONNECTION_PROD`, `PLACEHOLDER_RESOURCE_GROUP_PROD`, `PLACEHOLDER_AKS_CLUSTER_NAME_PROD`, `PLACEHOLDER_ACR_NAME_PROD` | `pipelines/azure-pipelines-{backend,frontend}-prod.yml` | ADO project admin + platform team, once prod has its own AKS cluster, ACR, and an ARM service connection to it |
| `PLACEHOLDER_UAMI_CLIENT_ID_PROD`, `PLACEHOLDER_KEYVAULT_NAME_PROD` | `k8s/overlays/prod/backend/patch-secretproviderclass.yaml`, `patch-serviceaccount.yaml` | once prod has its own AKS/Key Vault resources |
| `PLACEHOLDER_TLS_SECRET_NAME_QA`, `PLACEHOLDER_GATEWAY_NAME_PROD`/`_NAMESPACE_PROD`, `PLACEHOLDER_TLS_SECRET_NAME_PROD` | `k8s/overlays/{qa,prod}/gateway/patch-gateway-attachment.yaml` | qa: once qa has its own hostname requested and cert issued (dev's are done -- `csm-dev.digi-incubator.co.za`, see §2 below). prod: once prod's own cluster/NGF setup is known -- may not even attach to `lineai-gateway` at all, see the comment in that file |
| `PLACEHOLDER_SQL_DATABASE_NAME_QA`/`_PROD` | `k8s/overlays/{qa,prod}/backend/configmap.yaml` | once qa/prod's own target database name is confirmed |
| `PLACEHOLDER_SQL_SERVER_HOSTNAME_PROD`, `PLACEHOLDER_STORAGE_ACCOUNT_URL_PROD` | `k8s/overlays/prod/backend/configmap.yaml` | once prod's SQL Server/Storage account exist -- likely the same patterns as dev/qa if deployed the same way, but confirm rather than assume |

Not literal `PLACEHOLDER_*` but still unconfirmed:
- qa's `SQL_SERVER_HOSTNAME` (`mssql.mssql-qa.svc.cluster.local`) and
  `AZURE_STORAGE_ACCOUNT_URL` (`sasandtidiagnonprod01`, same as dev) are
  best-guess predictions following the confirmed dev pattern -- namespace
  `mssql-qa` doesn't exist on the cluster yet, and qa's use of the same
  storage account as dev hasn't been explicitly confirmed. Verify both
  before relying on them.

## 3. Initial environment bring-up (once per environment)

1. **dev**: **done** -- `id-coalstockpile-dev` created and federated to
   `system:serviceaccount:app-coal-stockpile:eskom-forecast-sa`
   (client-id `75399a2c-0c4b-4b55-a568-89763fb6d6eb`, principal-id
   `b08b85b4-2d5e-4d78-80c3-87ee2e1bba6b`), OIDC issuer
   `https://southafricanorth.oic.prod-aks.azure.com/93aedbdc-cc67-4652-aa12-d250a876ae79/d3247359-f7bb-4ac8-b84a-e074f21cb8a6/`.
   Role assignments still outstanding -- see §1 item 4 for the exact
   commands and who needs to run them.

   **qa**: not yet done, same steps needed for its own identity/federated
   credential (different subject -- qa's namespace):
   ```bash
   az identity create --name id-coalstockpile-qa --resource-group SAN-DTI-NONPROD-RG

   az identity federated-credential create \
     --name fic-coalstockpile-qa \
     --identity-name id-coalstockpile-qa --resource-group SAN-DTI-NONPROD-RG \
     --issuer "https://southafricanorth.oic.prod-aks.azure.com/93aedbdc-cc67-4652-aa12-d250a876ae79/d3247359-f7bb-4ac8-b84a-e074f21cb8a6/" \
     --subject system:serviceaccount:app-coal-stockpile-qa:eskom-forecast-sa \
     --audience api://AzureADTokenExchange

   MSYS_NO_PATHCONV=1 az role assignment create --role "Storage Blob Data Contributor" \
     --assignee-object-id <qa-uami-principal-id> --assignee-principal-type ServicePrincipal \
     --scope $(az storage account show --name sasandtidiagnonprod01 --query id -o tsv)

   MSYS_NO_PATHCONV=1 az role assignment create --role "Key Vault Secrets User" \
     --assignee-object-id <qa-uami-principal-id> --assignee-principal-type ServicePrincipal \
     --scope $(az keyvault show --name MAZ-KV-SAN-DTI-NONPROD01 --query id -o tsv)
   ```
   (On Windows/Git Bash, `MSYS_NO_PATHCONV=1` avoids the same
   `/subscriptions/...`-gets-rewritten-as-a-Windows-path issue noted in §1
   item 4 -- surfaces as `MissingSubscription`, not a Git Bash error, so it's
   easy to misdiagnose as an Azure-side problem.)
   Paste the client-id into that environment's `patch-serviceaccount.yaml` and
   `patch-secretproviderclass.yaml`.
2. Seed the Key Vault secrets each environment's `SecretProviderClass`
   references but doesn't create:
   ```bash
   az keyvault secret set --vault-name MAZ-KV-SAN-DTI-NONPROD01 --name coalstockpile-sql-username-dev --value '<value>'
   az keyvault secret set --vault-name MAZ-KV-SAN-DTI-NONPROD01 --name coalstockpile-sql-password-dev --value '<value>'
   # repeat with -qa for qa
   ```
3. Fill in `k8s/overlays/{dev,qa}/backend/configmap.yaml`'s
   `SQL_DATABASE_NAME` for real (`SQL_SERVER_HOSTNAME`/
   `AZURE_STORAGE_ACCOUNT_URL` are already set for both, see §0/§2 above --
   qa's are unconfirmed predictions, verify before relying on them).
4. **The database itself -- not this repo's manifests to fix, needs
   whoever owns each `mssql-<env>` namespace:** the target database
   (`SQL_DATABASE_NAME`) must exist on that SQL Server instance
   (`CREATE DATABASE ...`), and a dedicated least-privilege SQL login/user
   created for this app (not `sa`) -- see `docs/ARCHITECTURE.md` "Database".
   (`mssql-dev`'s NetworkPolicy already allows cross-namespace ingress on
   1433 from anywhere on the cluster -- confirmed live, `namespaceSelector: {}`
   on `mssql-allow-1433`; no further NetworkPolicy change needed here.)
5. ADO Environment resources must exist as `COAL-STOCKPILE-DEV`,
   `COAL-STOCKPILE-QA`, `COAL-STOCKPILE-PROD` (Pipelines -> Environments) --
   `deployment:` jobs (`deploy-stage.yml`, `cutover-stage.yml`) fail with
   "Environment X could not be found" without it, even with everything else
   configured. **prod only**: add a manual approval check on
   `COAL-STOCKPILE-PROD` (that Environment -> Approvals and checks -- this
   can't be expressed in YAML).
6. **prod only**: create prod's Azure Resource Manager service connection
   (needs `az aks command invoke` rights on the future prod cluster, plus
   ACR push/pull). dev/qa's connection (`DTI-NONPROD-AZURE-CONNECTION`)
   already exists.
7. Gateway *attachment* (`HTTPRoute` + `ReferenceGrant`, no `Gateway` object
   of our own -- see `docs/ARCHITECTURE.md` "Exposure" for why) is applied
   manually, not part of either pipeline (same as before this overhaul):
   ```bash
   az aks command invoke -g SAN-DTI-NONPROD-RG -n MAZ-AKS-SAN-DTI-NonProd \
     --command "kubectl apply -f rendered.yaml" \
     --file <(kubectl kustomize k8s/overlays/<env>/gateway)
   ```
   **dev: done, and traffic confirmed flowing end-to-end, including DNS.**
   `csm-dev-tls-secret` created, `HTTPRoute`/`ReferenceGrant` applied,
   `lineai-gateway`'s two new listeners added (`csm-dev-http`/`-https`,
   both `Programmed: True` with `attachedRoutes: 1`, verified not to have
   disturbed its existing `lineai`/`kibana` listeners), DNS resolves
   `csm-dev.digi-incubator.co.za` to `10.200.25.13`, and
   `https://csm-dev.digi-incubator.co.za/` and `/healthz` both return
   `200` end-to-end through the real hostname (not just by IP). One bug
   found and fixed along the way: `k8s/base/frontend/{single,shared}/networkpolicy.yaml`
   allowed ingress on port `80`, but the frontend container listens on
   `8080` (non-root nginx can't bind a privileged port) -- NetworkPolicy
   filters on the actual destination port after the Service's DNAT, not the
   Service's own port, so this silently dropped all Gateway-to-pod traffic
   and surfaced as a `504` at the Gateway. Renamed to
   `coalstockpilefrontend-allow-8080` and fixed the port; qa/prod inherit
   the fix automatically since they render from the same base. qa/prod need
   the whole listener/TLS/DNS sequence below repeated for their own
   hostname/cert once requested.

   **Second incident, 2026-07-26: our `HTTPRoute` broke Kibana, a
   completely different app on the same shared Gateway.** Our `parentRefs`
   had no `sectionName` -- reported by the `lineai-gateway` team, who found
   it from the live `kubectl.kubernetes.io/last-applied-configuration`.
   Per the Gateway API spec, a parentRef with no `sectionName` attaches to
   **every** listener on the Gateway whose `allowedRoutes` permits our
   namespace, not just the one meant for us. `kibana-http`/`-https` also
   have `allowedRoutes.namespaces.from: All`, so our route silently
   attached there too, inherited that listener's hard-filtered hostname
   (`kibana-dev.digi-incubator.co.za`), and won the routing tie-break
   against kibana's own route. The other team applied a live patch to
   restore Kibana while we fixed the durable source: both parentRefs in
   `k8s/base/gateway/gateway.yaml` and every overlay's
   `patch-gateway-attachment.yaml` now carry an explicit `sectionName`
   (mandatory going forward, not optional even though the API allows
   omitting it), plus `hostnames` as defense-in-depth (a declared hostname
   that doesn't intersect a listener's own hostname stops the route
   matching there even without `sectionName`). Re-applied to dev and
   confirmed both `csm-dev-http`/`-https` parents still show
   `Accepted: True`/`ResolvedRefs: True` and `https://csm-dev.digi-incubator.co.za/healthz`
   still returns `200`. **Any team attaching an `HTTPRoute` to a shared
   Gateway on this cluster must set `sectionName` -- this is not
   coalstockpile-specific.**

   **Third incident, 2026-07-30: a `kubectl apply` on `lineai-gateway`
   silently wiped our listeners.** The dashboard became completely
   unreachable (`curl` to `https://csm-dev.digi-incubator.co.za/` failed
   with a connection-level error, not an HTTP error) -- confirmed live via
   NGF's own nginx logs (`kubectl logs -n nginx-gateway -l
   app.kubernetes.io/name=nginx-gateway-fabric -c nginx`) showing
   `handshake rejected while SSL handshaking, server: 0.0.0.0:443` for our
   client IPs -- that's nginx's catch-all/no-matching-SNI server block,
   meaning no listener was matching our hostname at all anymore. `kubectl
   get gateway lineai-gateway -o jsonpath='{.spec.listeners[*].name}'`
   confirmed it: `csm-dev-http`/`csm-dev-https` were **entirely absent** --
   only `http`/`https` (lineai), `kibana-http`/`-https`, and
   `wims-qa-*`/`wims-dev-*` remained. Pinned down precisely via
   `kubectl get gateway lineai-gateway -o jsonpath='{.metadata.managedFields}'`
   and the `kubectl.kubernetes.io/last-applied-configuration` annotation:
   a `kubectl-client-side-apply` `Update` at exactly **2026-07-29T13:24:59Z**
   is the current `last-applied-configuration` -- and that annotation's
   listener list includes `kibana-http`/`-https` and
   `wims-qa-*`/`wims-dev-*` (both teams evidently made their listeners
   durable in `lineai-gateway`'s own committed manifest at some point) but
   **never included `csm-dev-*` at all, ever**. So this wasn't a
   regression in a previously-durable fix -- our listeners were never
   durable to begin with, and that 2026-07-29T13:24:59Z apply (whether a
   redeploy or someone manually re-running `kubectl apply` against their
   checked-in manifest) simply reverted the object to the one true state
   it's ever had on their side, silently taking our live-patched-in
   listeners with it. The outage likely sat unnoticed for about a day
   until this was next tested. Restored with the exact same patch
   command as the original setup (see below); confirmed
   `attachedRoutes=1`/`programmed=True` on both again and
   `/healthz` back to `200`.

   **This is not a one-time fluke -- it is guaranteed to recur** on their
   next redeploy, exactly like the sectionName incident above was guaranteed
   to keep breaking Kibana until fixed at the source. There is no fix
   available from this repo: the durable fix is for `lineai-gateway`'s
   owning team to add our two listeners to *their own* git-tracked
   manifest. Until that happens, treat "dashboard suddenly totally
   unreachable, not even by IP, with no recent change on our side" as this
   exact failure mode first -- check `kubectl get gateway lineai-gateway -n
   lineai-dev -o jsonpath='{.spec.listeners[*].name}'` for `csm-dev-http`/
   `csm-dev-https` before assuming anything is wrong in this repo's own
   manifests, and re-apply the listener patch below if they're missing.

   Before this serves traffic in a **new** environment, two things this
   repo's manifests can't do themselves (already done for dev, kept here as
   the template for qa/prod):
   - **The TLS Secret must exist first** (the `ReferenceGrant` above
     references it by name; order doesn't matter for `kubectl apply` itself,
     but nothing will terminate TLS correctly until this exists). One-time,
     from a signed cert + private key (never commit the key):
     ```bash
     az aks command invoke -g SAN-DTI-NONPROD-RG -n MAZ-AKS-SAN-DTI-NonProd \
       --command "kubectl create secret tls csm-<env>-tls-secret --cert=fullchain.crt --key=<env>.key -n app-coal-stockpile<-env-suffix>" \
       --file fullchain.crt --file <env>.key
     ```
     (`fullchain.crt` = leaf cert + intermediate, **not** the root CA,
     concatenated in that order -- dev's own signed cert came back as a
     PEM-encoded PKCS7 bundle from Eskom's internal CA;
     `openssl pkcs7 -in <file> -print_certs -out chain.pem` extracts the
     individual certs to reassemble in the right order and format.)
   - **`lineai-gateway`'s owner (namespace `lineai-dev`, not ours) needs to
     add two listeners** for this environment's hostname. Hand them:
     ```bash
     kubectl patch gateway lineai-gateway -n lineai-dev --type=json -p='[
       {"op": "add", "path": "/spec/listeners/-", "value": {
         "name": "csm-<env>-http", "hostname": "csm-<env>.digi-incubator.co.za",
         "port": 80, "protocol": "HTTP",
         "allowedRoutes": {"namespaces": {"from": "All"}}
       }},
       {"op": "add", "path": "/spec/listeners/-", "value": {
         "name": "csm-<env>-https", "hostname": "csm-<env>.digi-incubator.co.za",
         "port": 443, "protocol": "HTTPS",
         "allowedRoutes": {"namespaces": {"from": "All"}},
         "tls": {"mode": "Terminate", "certificateRefs": [
           {"kind": "Secret", "name": "csm-<env>-tls-secret", "namespace": "app-coal-stockpile<-env-suffix>"}
         ]}
       }}
     ]'
     ```
     (Mirrors the existing `kibana-http`/`kibana-https` listeners on that
     same Gateway -- confirmed live via `kubectl get gateway lineai-gateway
     -o yaml`.) Until this listener exists, the `HTTPRoute` stays
     `Accepted: True` (NGF accepts the parentRef itself) but nothing
     actually resolves the hostname to this app.
   - **DNS**: `csm-<env>.digi-incubator.co.za` needs to resolve to the
     shared NGF LB IP (`10.200.25.13`). **dev: done** -- confirmed resolving
     correctly from inside the cluster. (It briefly pointed at the wrong IP,
     `10.200.25.20`, when first created -- whoever owns this app's DNS
     entries fixed it; if a future environment's hostname 404s/504s right
     after DNS is "done," re-check it actually resolves to `10.200.25.13`
     and not some other device before assuming the Gateway/app is broken.)
8. Push a commit through the pipeline once (see branch strategy in
   `docs/ARCHITECTURE.md`) to create the namespace and all resources. First
   run for qa/prod bootstraps **both** colors (no active color exists yet --
   see `deploy-stage.yml`'s comment).

## 4. Routine releases

Handled by the pipelines
(`pipelines/azure-pipelines-{backend,frontend}-{dev,qa,prod}.yml`) on merge
to `feature/*`/`development`, `release/*`, or `main` respectively. No manual
steps for dev. For qa/prod, the pipeline deploys to the inactive color,
smoke-tests it, and cuts over automatically (prod pauses for approval before
cutover). Backend and frontend release independently -- bumping one never
touches the other's running color.

## 5. Manual verification

Assumes *you* have direct `kubectl` access (`az aks get-credentials` on a
machine that can reach the AKS API server) -- a different, human-operator
access path from the pipeline's (see `docs/ARCHITECTURE.md`). Without that,
prefix each `kubectl` call the way the pipeline does:
`az aks command invoke -g <rg> -n <cluster> --command "kubectl ..."`.

```bash
kubectl get pods,svc,networkpolicy -n <namespace>
kubectl get svc eskom-forecast-api -n <namespace> -o jsonpath='{.spec.selector.color}'   # qa/prod: active backend color
kubectl get svc coalstockpilefrontend -n <namespace> -o jsonpath='{.spec.selector.color}' # qa/prod: active frontend color

kubectl exec -n <namespace> deploy/eskom-forecast-api -- env | grep -i AZURE_   # expect WorkloadIdentityCredential in logs, not ManagedIdentityCredential
curl -s http://<gateway-address>/healthz
curl -sI http://<gateway-address>/
```

## 6. Rollback

No AG-failover equivalent (see `docs/ARCHITECTURE.md`) -- rollback is either:

- **Before cutover** (qa/prod): do nothing -- the untested color never
  received traffic; just fix forward and re-run the pipeline.
- **After cutover**: re-run `cutover-stage.yml`'s logic in reverse by hand
  (`kubectl patch svc <service> -p '{"spec":{"selector":{"color":"<old color>"}}}'`),
  or re-deploy the previous image tag to what's now the inactive color and
  cut over to it again.
- **dev**: `kubectl rollout undo deployment/<name> -n app-coal-stockpile`.

## 7. Troubleshooting quick reference

| Symptom | Likely cause / where to look |
|---|---|
| Backend 403 `AuthorizationPermissionMismatch` on Storage | Missing data-plane role or wrong identity -> `docs/aks-workload-identity-storage.md` |
| Backend logs show `ManagedIdentityCredential` not `WorkloadIdentityCredential` | Workload Identity not active (SA/label/annotation) -> `docs/aks-workload-identity-storage.md` |
| Backend pod stuck, `/mnt/secrets-store` empty or CSI mount error | SecretProviderClass misconfigured, UAMI missing "Key Vault Secrets User", or secret not yet seeded in Key Vault -> §3 steps 1-2 above |
| Backend can't reach SQL (connection refused/timeout) | `mssql-dev` already allows cross-namespace ingress on 1433 (confirmed live) -- if still failing, check `SQL_SERVER_HOSTNAME` is the namespace-qualified FQDN and the target namespace/pod is actually up: `kubectl get networkpolicy -n mssql-<env> -o yaml`, `kubectl get pods -n mssql-<env>` |
| Backend can't reach SQL (`SSL Provider`/certificate error) | Missing `TrustServerCertificate=yes` for the in-cluster instance's self-signed cert -> `src/ingest.py`'s `_connect()`, see `docs/ARCHITECTURE.md` "Database" |
| Backend can't reach SQL (login failed) | `SQL_USERNAME`/`SQL_PASSWORD` Key Vault secret values, or the SQL login doesn't exist/lack permissions on `SQL_DATABASE_NAME` yet -> §3 step 4 above |
| Frontend `/api` calls 502 | Backend Service not ready, or nginx resolver not set -> check frontend logs for the `10-resolver.sh` line; `kubectl get endpoints eskom-forecast-api` |
| `deploy-stage.yml` bumps the wrong color / touches the active color | Client Service's `color` selector doesn't reflect what's actually running -- check `kubectl get svc <name> -o jsonpath='{.spec.selector.color}'` before re-running |
| `HTTPRoute` shows `Accepted: True` but nothing responds | `lineai-gateway`'s owner hasn't added this environment's listener yet, or the listener's `hostname` doesn't exactly match -> `kubectl describe httproute coalstockpile-routes -n app-coal-stockpile`, `kubectl get gateway lineai-gateway -n lineai-dev -o yaml` |
| `HTTPRoute` shows `ResolvedRefs: False`, `BackendNotFound` | The backend/frontend Service it points at doesn't exist yet in this namespace -- e.g. `coalstockpilefrontend` won't resolve until that pipeline has actually run once |
| TLS handshake fails / wrong cert served | `ReferenceGrant` missing or naming a different Secret than the Gateway's `certificateRefs` actually asks for, or the Secret's `tls.crt` isn't leaf+intermediate in that order (no root) -> `kubectl get secret csm-<env>-tls-secret -o jsonpath='{.data.tls\.crt}' \| base64 -d \| openssl x509 -noout -subject -dates` |
| Gateway reachable but wrong backend serves a path | HTTPRoute prefix ordering -- backend prefixes must be their own rule so longest-prefix-first applies |
| Hostname resolves, `HTTPRoute` is `Accepted`/`ResolvedRefs: True`, pods are `Running` with endpoints -- but requests hang and time out (`504` at the Gateway) | NetworkPolicy port doesn't match the pod's actual container port -- it filters on the real destination port *after* the Service's DNAT, not the Service's own port. Frontend hit exactly this (`allow-80` policy vs. an actual `containerPort: 8080`); check `kubectl get networkpolicy -n <ns> -o yaml` against `kubectl get pod -o jsonpath='{.spec.containers[0].ports}'` |
| Can't reach the app at all | It's VNet-internal by design (shared NGF data plane, see `docs/ARCHITECTURE.md` "Exposure") -- confirm you're on the corporate network/VPN, and that DNS for the assigned hostname actually resolves to `10.200.25.13` |
| Can't reach the app at all, `curl` fails at the connection/TLS level (not an HTTP error), DNS resolves fine | `lineai-gateway`'s owner likely redeployed and reverted our listeners -- check `kubectl get gateway lineai-gateway -n lineai-dev -o jsonpath='{.spec.listeners[*].name}'` for `csm-dev-http`/`csm-dev-https`; if missing, re-apply the listener patch in §3 step 7. Confirm via NGF's own logs (`kubectl logs -n nginx-gateway -l app.kubernetes.io/name=nginx-gateway-fabric -c nginx`) showing `handshake rejected ... server: 0.0.0.0:443` for the client IP -- this happened once already (2026-07-30), see §3 step 7's third incident |
| `az acr import` fails in build-scan-push.yml | ACR's own outbound network (not the agent's) needs to reach Docker Hub -- check ACR firewall/network rules, not agent proxy settings |
| `trivy config`/`trivy image` fails the build | A real HIGH/CRITICAL finding, or a false positive -- add a justified entry to `k8s/.trivyignore` only after confirming it's not real |
