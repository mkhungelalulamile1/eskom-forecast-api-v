# Eskom Coal Forecasting API

FastAPI web app serving the coal burn/supply forecasting pipeline and dashboard, deployable on AKS. Single entry point: `main.py`.

## Local development

No Azure credentials are required for basic local testing — when `AZURE_STORAGE_ACCOUNT_URL`/`AZURE_STORAGE_CONNECTION_STRING` aren't set, the app falls back to local disk (`data/bronze`, `models/`, `data/gold`, etc., relative to the working directory), generating mock Bronze data on first use.

### Run directly with uvicorn

```powershell
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\python main.py
```

The app starts on `http://localhost:8000`. Interactive API docs are at `http://localhost:8000/docs`.

Useful routes to try:
- `GET /healthz` — liveness check, always `{"status": "ok"}`
- `GET /` — the dashboard (`frontend/index.html`)
- `GET /api/forecast-data`, `/api/forecast-metrics`, `/api/scenario-data`, `/api/oot-history` — require real Azure Storage (no local fallback for these reads); expect a 500 with a clear error until Azure Storage env vars are set
- `POST /api/run-forecast` with body `{"horizon": "daily"}` or `{"horizon": "monthly"}` — runs the pipeline against local mock data; needs a local weather cache or live network access to Open-Meteo for the weather step to succeed
- `POST /api/ingest-bronze-data` — requires `SQL_SERVER_HOSTNAME`/`SQL_DATABASE_NAME` plus a working Azure AD credential (managed identity in AKS, or a service principal locally — see the Docker Compose section below); fails fast with a clear error if config is missing
- `POST /api/refresh-weather-cache`

### Run with Docker Compose (against real Azure SQL/Storage)

`docker-compose.yml` is set up to test against the real dev SQL Server/Storage account (`SQL_SERVER_HOSTNAME`, `SQL_DATABASE_NAME`, `AZURE_STORAGE_ACCOUNT_URL`), not the local mock fallback — this is what you need for `POST /api/ingest-bronze-data` to actually pull real data, since that route has no local fallback (its whole job is talking to the real SQL source).

Authentication goes through `DefaultAzureCredential`, via a **service principal** (not `az login`): on Windows, `az login`'s token cache is encrypted with Windows DPAPI, which a Linux container simply cannot decrypt regardless of how the session folder is mounted — so `AzureCliCredential` never works cross-OS here. A service principal is also what AKS Workload Identity uses in production, so this keeps local testing and the real deployment on the same credential shape:

1. Copy `.env.example` to `.env` (gitignored) and fill in `AZURE_CLIENT_ID`/`AZURE_TENANT_ID`/`AZURE_CLIENT_SECRET` for a service principal that has SQL Server access (`CREATE USER [...] FROM EXTERNAL PROVIDER` + `db_datareader`, granted by your SQL Server's AAD admin) and Storage Blob Data Contributor on the storage account.
2. `docker compose up --build`

`DefaultAzureCredential` picks up `.env`'s values automatically via `EnvironmentCredential` — no CLI, no mounted session, no cross-OS cache issues.

If this network sits behind a TLS-inspecting corporate proxy (confirmed to be the case here — Zscaler), `docker-compose.yml` also passes `TRUST_CORPORATE_CA=true` as a build arg, which trusts `certs/zscaler-root-ca.crt` (exported from the Windows cert store) inside the image; without this, every outbound HTTPS call (Open-Meteo, Azure AD token requests) fails with `CERTIFICATE_VERIFY_FAILED`. This is local-dev/network-specific — a CI/CD build on a normal network should omit this arg (defaults to `false`).

`docker-compose.yml` also mounts `./data` and `./models` so locally-generated/ingested data and trained models persist across restarts instead of regenerating every time.

If you'd rather test purely against local mock data (no real Azure resources), remove/comment out the `SQL_SERVER_HOSTNAME`/`SQL_DATABASE_NAME`/`AZURE_STORAGE_ACCOUNT_URL` lines and skip the `.env` file — `ingest-bronze-data` will then fail fast with a clear "not configured" error, but `run-forecast`/`train-models` will fall back to local mock Bronze data as described above.

### Run the test suite

```powershell
.venv\Scripts\pip install pytest httpx
.venv\Scripts\python -m pytest src/test_pipeline.py -v
```

`httpx` is only needed for tests that drive FastAPI's `TestClient`. Some tests are marked `requires_azure_storage` and are skipped automatically unless `AZURE_STORAGE_CONNECTION_STRING` is set.

## Deploying to AKS

Kustomize base/overlays under `k8s/`, deployed via the pipelines in `pipelines/` (one per workload per environment — backend/frontend × dev/qa/prod), with Key Vault-backed secrets via Workload Identity, NetworkPolicy, Trivy-scanned images, and blue/green releases for qa/prod. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for design/rationale and [docs/RUNBOOK.md](docs/RUNBOOK.md) for setup, placeholders still to fill in, routine releases, and troubleshooting. dev is intentionally pinned to a single, non-blue/green Deployment per workload since the daily ingest+forecast job runs in-process (APScheduler), not as a separate Kubernetes CronJob.
