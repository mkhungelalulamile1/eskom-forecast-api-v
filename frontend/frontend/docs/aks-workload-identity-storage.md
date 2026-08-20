# AKS Workload Identity → Azure Storage Access Runbook

How to grant an AKS-hosted API pod access to Azure Blob Storage using **Azure AD
Workload Identity** (federated, key-less), and how to debug the failures that
typically show up along the way.

> All environment-specific names (resource groups, cluster, storage account,
> namespace, identities, subscription IDs, IP addresses) are shown as
> `<placeholders>`. Fill them in from your own environment before running
> anything. **Nothing in this document is specific to one account.**

---

## 1. Background / what problem this solves

The application runs as two workloads in the same Kubernetes namespace:

- A **frontend** (nginx) that serves a static dashboard and reverse-proxies
  `/api/*` to the backend.
- A **backend** API that, on request, reads/writes Parquet files in an Azure
  Storage account.

The backend authenticates to Storage with `DefaultAzureCredential`. In AKS the
intended path is **Workload Identity**: the pod presents a short-lived
federated token that Azure AD exchanges for a token for a **User-Assigned
Managed Identity (UAMI)**, which holds the Storage role.

The symptom that this runbook fixes:

```
INFO  DefaultAzureCredential acquired a token from ManagedIdentityCredential
INFO  Response status: 403
      x-ms-error-code: AuthorizationPermissionMismatch
ERROR This request is not authorized to perform this operation using this permission.
```

Two independent things must both be true for this to work:

1. The pod must **use the intended UAMI** (Workload Identity wired correctly).
2. That UAMI must **hold a data-plane Storage role** on the account.

If either is missing you get a 403. The sections below set up both.

---

## 2. Prerequisites

**Tools**

- `az` CLI (logged in: `az login`)
- `kubectl` (context pointed at the target cluster)
- Resource Graph extension (for cross-subscription lookups):
  `az extension add -n resource-graph`

**Cluster features** — the AKS cluster must have the OIDC issuer and Workload
Identity enabled. If unsure:

```bash
az aks show -g <aks-resource-group> -n <aks-cluster-name> \
  --query "{oidc:oidcIssuerProfile.enabled, wi:securityProfile.workloadIdentity.enabled}" -o json
```

If either is `false`, enable them (this is a cluster-level change — coordinate
with whoever owns the cluster):

```bash
az aks update -g <aks-resource-group> -n <aks-cluster-name> \
  --enable-oidc-issuer --enable-workload-identity
```

**Azure permissions you need**

- Create/read the managed identity: `Managed Identity Contributor` (or higher)
  on the identity's resource group.
- Create the role assignment on Storage: `Owner` **or** `User Access
  Administrator` on the storage account (or its resource group/subscription).

---

## 3. Placeholders used below

| Placeholder | Meaning |
|---|---|
| `<subscription-id>` | Subscription containing the AKS cluster |
| `<aks-resource-group>` | Resource group of the AKS cluster |
| `<aks-cluster-name>` | AKS cluster name |
| `<uami-resource-group>` | Resource group for the managed identity |
| `<uami-name>` | User-Assigned Managed Identity name |
| `<uami-client-id>` | UAMI **client** ID → goes in the ServiceAccount annotation |
| `<uami-principal-id>` | UAMI **principal (object)** ID → goes in the role assignment |
| `<storage-account-name>` | Target Azure Storage account |
| `<storage-subscription-id>` | Subscription of the storage account (may differ from the AKS one) |
| `<namespace>` | Kubernetes namespace of the workloads |
| `<service-account-name>` | Kubernetes ServiceAccount for the backend pod |
| `<deployment-name>` | Backend Deployment name |

> **Do not confuse the two identity IDs.**
> **client id → Kubernetes SA annotation.  principal id → Azure role assignment.**

---

## 4. Step-by-step

### Step 1 — Create or identify the managed identity

Create a new UAMI (skip if one already exists) and capture **both** IDs:

```bash
az identity create -g <uami-resource-group> -n <uami-name> \
  --query "{clientId:clientId, principalId:principalId}" -o json
```

To read the IDs of an existing one:

```bash
az identity show -g <uami-resource-group> -n <uami-name> \
  --query "{clientId:clientId, principalId:principalId}" -o json
```

Record `clientId` (→ Step 5 annotation) and `principalId` (→ Step 4 role
assignment).

### Step 2 — Get the cluster's OIDC issuer URL

```bash
az aks show -g <aks-resource-group> -n <aks-cluster-name> \
  --query oidcIssuerProfile.issuerUrl -o tsv
```

### Step 3 — Federate the identity to the Kubernetes ServiceAccount

This is what lets Azure AD trust tokens issued for one specific SA. The
`--subject` **must exactly match** `system:serviceaccount:<namespace>:<service-account-name>`.

```bash
az identity federated-credential create \
  --name <any-fedcred-name> \
  --identity-name <uami-name> \
  --resource-group <uami-resource-group> \
  --issuer "<oidc-issuer-url-from-step-2>" \
  --subject system:serviceaccount:<namespace>:<service-account-name> \
  --audience api://AzureADTokenExchange
```

Verify:

```bash
az identity federated-credential list \
  --identity-name <uami-name> -g <uami-resource-group> -o table
```

### Step 4 — Grant the data-plane Storage role

> **Control-plane roles (Reader / Contributor / Owner) do NOT grant blob data
> access.** You need a **Storage Blob Data** role. Use:
> - `Storage Blob Data Reader` if the app only reads.
> - `Storage Blob Data Contributor` if the app also writes.

Do **not** hand-build the `--scope` string — derive the exact resource ID so you
never hit the "invalid subscription" error (see Debugging §5.3):

```bash
# If the storage account is in a different subscription, prefix these with
# --subscription <storage-subscription-id>, or `az account set` first.
scope=$(az storage account show -n <storage-account-name> --query id -o tsv)
echo "$scope"   # sanity check: must look like /subscriptions/.../storageAccounts/<name>

az role assignment create \
  --assignee-object-id <uami-principal-id> \
  --assignee-principal-type ServicePrincipal \
  --role "Storage Blob Data Contributor" \
  --scope "$scope"
```

**PowerShell** variable capture differs:

```powershell
$scope = az storage account show -n <storage-account-name> --query id -o tsv
az role assignment create --assignee-object-id <uami-principal-id> --assignee-principal-type ServicePrincipal --role "Storage Blob Data Contributor" --scope $scope
```

Using `--assignee-object-id` + `--assignee-principal-type ServicePrincipal`
(instead of `--assignee`) skips a Graph lookup and avoids "principal not found"
right after the identity is created.

Verify:

```bash
az role assignment list --assignee <uami-client-id> --scope "$scope" -o table
```

### Step 5 — Wire up Kubernetes

Two pieces are required. **Both** are mandatory — the annotation alone does
nothing without the pod label.

**(a) ServiceAccount** annotated with the UAMI **client** id:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: <service-account-name>
  namespace: <namespace>
  annotations:
    azure.workload.identity/client-id: "<uami-client-id>"
```

**(b) Deployment** — reference the SA and add the activation label to the **pod
template** (not the Deployment metadata):

```yaml
spec:
  template:
    metadata:
      labels:
        app: <app-label>
        azure.workload.identity/use: "true"   # activates the webhook injection
    spec:
      serviceAccountName: <service-account-name>
      containers:
        - name: <container-name>
          # ...
```

### Step 6 — Apply and restart

```bash
kubectl apply -f <your-manifest>.yaml
kubectl rollout restart deploy/<deployment-name> -n <namespace>
kubectl rollout status  deploy/<deployment-name> -n <namespace>
```

### Step 7 — Verify it works

The injected environment and token volume should be present:

```bash
kubectl exec -n <namespace> deploy/<deployment-name> -- env | grep -i AZURE_
# expect: AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_FEDERATED_TOKEN_FILE, AZURE_AUTHORITY_HOST
```

And the application log line should now read **WorkloadIdentityCredential**
(not `ManagedIdentityCredential`), with Storage returning `200`:

```
DefaultAzureCredential acquired a token from WorkloadIdentityCredential
Response status: 200
```

---

## 5. Debugging

### 5.1 `403 ... AuthorizationPermissionMismatch`

**Meaning:** authentication succeeded, authorization failed — the identity has
**no data-plane role** on the storage account.

**Checklist:**
- Confirm the role is a **Storage Blob Data** role, not plain Reader/Contributor.
- Confirm it was assigned to the **right identity** (`principalId`) and the
  **right scope** (correct account; or the specific container if you scoped
  narrowly and the app reads a different container).
- RBAC changes take **a few minutes** to propagate. A 403 immediately after
  assigning is normal — wait ~5 min and restart the pod to drop cached tokens.

```bash
az role assignment list --assignee <uami-client-id> --all -o table
```

### 5.2 Log says `ManagedIdentityCredential` instead of `WorkloadIdentityCredential`

**Meaning:** Workload Identity is not active for the pod, so
`DefaultAzureCredential` fell back to the node/kubelet identity (which won't have
your role). This is the single most common cause of a persistent 403 even after
the role is assigned.

**Checklist — in order of likelihood:**
1. Missing pod label `azure.workload.identity/use: "true"` on the **pod
   template** (a label on the Deployment's top-level metadata does nothing).
2. Missing `serviceAccountName` on the pod spec.
3. ServiceAccount missing the `azure.workload.identity/client-id` annotation, or
   it holds the **principal** id by mistake (it must be the **client** id).
4. The Workload Identity mutating webhook isn't installed on the cluster
   (see Prerequisites — `--enable-workload-identity`).

Confirm the injection actually happened:

```bash
kubectl describe pod -n <namespace> -l app=<app-label> | grep -iE "azure-wi-token|AZURE_"
kubectl exec -n <namespace> deploy/<deployment-name> -- env | grep -i AZURE_CLIENT_ID
```

If `AZURE_CLIENT_ID` is absent, the webhook didn't fire — recheck items 1–4 and
`kubectl rollout restart`.

### 5.3 `The request did not have a subscription or a valid tenant level resource provider`

**Meaning:** the `--scope` passed to the role assignment didn't resolve to a
valid subscription.

**Causes & fixes:**
- A `<placeholder>` was left in the scope, or `$scope` was empty.
  `echo "$scope"` — it must start with `/subscriptions/<guid>/...`.
- The storage account is in a **different subscription** than the active one.
  Find it and target it explicitly:

  ```bash
  az graph query -q "resources | where type =~ 'microsoft.storage/storageAccounts' and name == '<storage-account-name>' | project name, subscriptionId, resourceGroup, id"
  # then: az account set --subscription <that-sub>   (or add --subscription to the commands)
  ```

### 5.4 `AADSTS70021: No matching federated identity record found`

**Meaning:** the token exchange failed — the federated credential doesn't match
the token the pod presented.

**Checklist:**
- `--subject` must be **exactly** `system:serviceaccount:<namespace>:<service-account-name>`
  (namespace and SA name are case-sensitive and must match the running pod).
- `--issuer` must equal the cluster's current OIDC issuer URL (re-fetch it;
  it changes if the cluster was recreated).
- `--audience` must be `api://AzureADTokenExchange`.

```bash
az identity federated-credential list --identity-name <uami-name> -g <uami-resource-group> -o jsonc
```

### 5.5 `Principal ... does not exist in the directory` when assigning the role

**Meaning:** Entra ID replication lag right after `az identity create`.

**Fix:** wait 1–2 minutes and retry; ensure you use `--assignee-object-id`
with `--assignee-principal-type ServicePrincipal`.

### 5.6 Still 403 after everything looks right

- **Token cache:** restart the pod (`kubectl rollout restart`) so it re-fetches
  a token reflecting the new role.
- **Wrong container scope:** if you scoped the role to one container but the app
  reads another, widen to account scope or add the second container.
- **Right identity, wrong id:** double-check the SA annotation carries the
  **client** id of the **same** identity you granted the role to (mismatched
  identities is easy to do when several exist).

### 5.7 Related: frontend nginx fails to start / build with `host not found in upstream`

Not an identity issue, but part of the same stack. nginx resolves `upstream`
hosts at config-load time; a Kubernetes Service DNS name doesn't resolve during
`docker build` or before the backend exists. Resolve the backend **at request
time** by putting the host in a variable with a runtime `resolver`, and do **not**
run `nginx -t` in the image build. (See the frontend nginx config for the
pattern.)

---

## 6. Quick reference

```bash
# IDs
az identity show -g <uami-resource-group> -n <uami-name> --query "{clientId:clientId, principalId:principalId}" -o json

# OIDC issuer
az aks show -g <aks-resource-group> -n <aks-cluster-name> --query oidcIssuerProfile.issuerUrl -o tsv

# Federated credential
az identity federated-credential create --name <fedcred> --identity-name <uami-name> -g <uami-resource-group> \
  --issuer "<oidc-url>" --subject system:serviceaccount:<namespace>:<service-account-name> --audience api://AzureADTokenExchange

# Storage data-plane role
scope=$(az storage account show -n <storage-account-name> --query id -o tsv)
az role assignment create --assignee-object-id <uami-principal-id> --assignee-principal-type ServicePrincipal \
  --role "Storage Blob Data Contributor" --scope "$scope"

# Roll and verify
kubectl rollout restart deploy/<deployment-name> -n <namespace>
kubectl exec -n <namespace> deploy/<deployment-name> -- env | grep -i AZURE_
```
