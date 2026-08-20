# Full image reference, not just a tag -- the self-hosted CI agent has no
# direct route to Docker Hub (proxy-only egress), so build-scan-push.yml
# mirrors this base into ACR first (`az acr import`) and overrides this to
# point at the ACR-mirrored copy. The python:3.11-slim default below is only
# for local/offline builds.
ARG PYTHON_BASE_IMAGE=python:3.11-slim
FROM ${PYTHON_BASE_IMAGE}

# Set to true only when building on a network behind a TLS-inspecting
# corporate proxy (e.g. Zscaler) whose root CA isn't trusted by default --
# otherwise every outbound HTTPS call in later steps (apt, Open-Meteo, Azure
# AD) fails with CERTIFICATE_VERIFY_FAILED. Not needed (and should stay
# false) for a real CI/CD build on a normal network.
ARG TRUST_CORPORATE_CA=false

# Installed first, before any other network call in this build, so the
# corporate proxy's re-signed certs are trusted for every step below.
COPY certs/ /tmp/certs/
RUN if [ "$TRUST_CORPORATE_CA" = "true" ]; then \
        cp /tmp/certs/*.crt /usr/local/share/ca-certificates/ \
        && apt-get update \
        && apt-get install -y --no-install-recommends ca-certificates \
        && update-ca-certificates; \
    fi \
    && rm -rf /tmp/certs /var/lib/apt/lists/*

# update-ca-certificates (above) only updates the OS-level trust store, which
# curl/openssl/pyodbc's ODBC driver honor -- but Python's `requests` library
# (used by training/weather.py for Open-Meteo, and transitively by some
# azure-identity/msal HTTP calls) verifies against its own bundled certifi CA
# store by default, ignoring the OS store entirely. REQUESTS_CA_BUNDLE
# repoints it at the OS store so the same trusted corporate CA covers both.
# Safe to set unconditionally: when TRUST_CORPORATE_CA=false this path is
# just the normal, unmodified system bundle, so this changes nothing.
ENV REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt

# unixODBC + Microsoft ODBC Driver 18 for SQL Server, required by pyodbc
# (src/ingest.py) for Azure SQL connectivity from a Linux container.
# libgssapi-krb5-2 explicitly, not just msodbcsql18/unixodbc -- the driver's
# .so is unconditionally linked against libgssapi_krb5.so.2 (even though
# Kerberos auth isn't used here), but Debian's msodbcsql18 package only lists
# it as a Recommends, not a Depends, so --no-install-recommends silently
# drops it: the package install succeeds, but the driver fails at dlopen()
# time with a misleading "file not found" (that's unixODBC's error for "this
# .so exists but one of ITS dependencies doesn't"), confirmed via `ldd` on
# the driver .so inside a running pod.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl gnupg apt-transport-https \
    && curl -sSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 unixodbc libgssapi-krb5-2 \
    && apt-get purge -y --auto-remove curl gnupg apt-transport-https \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# The base image's own pip/setuptools/wheel are frequently stale enough to
# fail a trivy image scan on their own -- setuptools in particular *vendors*
# a private, bundled copy of wheel and jaraco.context under
# setuptools/_vendor/ for its own internal use, which is a completely
# separate copy from whatever version requirements.txt pins for top-level
# use (pinning wheel/jaraco.context below does not touch this vendored
# copy at all). Upgrading setuptools here is what actually replaces it.
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
COPY src/ ./src/
COPY training/ ./training/
# training/additional_features.py imports feature_store/feature_experiments
# from here at module load time (src/app.py -> additional_features ->
# additionalfeatures/, see training/additional_features.py), so this is a
# real runtime dependency, not leftover sandbox content.
COPY additionalfeatures/ ./additionalfeatures/
COPY frontend/ ./frontend/

# Non-root user, enforced again at the Kubernetes level via securityContext
# (k8s/base/backend/*/deployment.yaml) -- both matter, since a securityContext
# runAsUser without matching writable ownership here would just fail to
# start. Chowning /app (not just adding the user) matters because the local
# Azure Storage/mock-data fallback paths (data/bronze, data/gold, models/,
# etc. -- see config.py) are relative paths under this WORKDIR; without
# real Azure Storage configured they get written to at runtime, which needs
# a non-root-writable /app regardless of how rarely that fallback triggers
# in AKS (Storage is always configured there, but "rarely" isn't "never").
RUN groupadd --gid 10001 appuser \
    && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
