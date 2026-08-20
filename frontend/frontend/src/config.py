import os

from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient


class Config:
    """
    Configuration helper class containing Azure storage parameters and local path fallbacks.
    """
    def __init__(self):
        # Application mode
        self.app_mode = os.getenv("APP_MODE", "development").lower()

        # Development mode uses local parquet files.
        # Production mode uses Azure Blob Storage.
        self.use_local_storage = self.app_mode == "development"
        # Azure Storage configuration. AZURE_STORAGE_ACCOUNT_URL (managed
        # identity auth, e.g. "https://<account>.blob.core.windows.net")
        # takes precedence over AZURE_STORAGE_CONNECTION_STRING (shared-key
        # auth) when both are set -- see get_blob_service_client().
        self.storage_account_url = os.getenv("AZURE_STORAGE_ACCOUNT_URL", "")
        self.connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "")
        self.bronze_container = os.getenv("BRONZE_CONTAINER_NAME", "bronze")

        # Source database for Bronze ingestion (see ingest.py). Auth is via
        # Azure AD / managed identity, not a username/password, consistent
        # with Blob Storage's auth model above.
        self.sql_server_hostname = os.getenv("SQL_SERVER_HOSTNAME", "mssql.mssql-dev.svc.cluster.local")
        self.sql_database_name = os.getenv("SQL_DATABASE_NAME", "COAL_STOCKPILE_MODEL")
        self.gold_container = os.getenv("GOLD_CONTAINER_NAME", "gold")
        self.metrics_container = os.getenv("METRICS_CONTAINER_NAME", "metrics")
        self.weather_container = os.getenv("WEATHER_CONTAINER_NAME", "weather")

        # Local mock directories for testing/development if Azure credentials are not set
        self.local_bronze_dir = os.getenv("LOCAL_BRONZE_DIR", "data/bronze")
        self.local_gold_dir = os.getenv("LOCAL_GOLD_DIR", "data/gold")
        self.local_models_dir = os.getenv("LOCAL_MODELS_DIR", "models")
        self.local_metrics_dir = os.getenv("LOCAL_METRICS_DIR", "data/metrics")
        self.local_weather_dir = os.getenv("LOCAL_WEATHER_DIR", "data/weather")

        # Entity and history assumptions
        self.num_entities = int(os.getenv("NUM_ENTITIES", "15"))
        self.num_years = int(os.getenv("NUM_YEARS", "20"))

    def has_storage_access(self) -> bool:
        """True if enough configuration is present to reach Azure Storage, by either auth method."""
        return bool(self.storage_account_url or self.connection_string)

    def has_sql_access(self) -> bool:
        """
        Returns True if the SQL source database has been configured.
        """
        return bool(
            self.sql_server_hostname and
            self.sql_database_name
        )

    def get_blob_service_client(self) -> BlobServiceClient:
        """
        Builds a BlobServiceClient, preferring managed identity (via
        AZURE_STORAGE_ACCOUNT_URL and DefaultAzureCredential) over the
        shared-key connection string when both are configured. Raises if
        neither is set -- callers should guard with has_storage_access()
        first, matching the existing `if config.connection_string:` pattern.
        """
        if self.storage_account_url:
            return BlobServiceClient(account_url=self.storage_account_url, credential=DefaultAzureCredential())
        return BlobServiceClient.from_connection_string(self.connection_string)
    def use_azure(self) -> bool:
        """
        Returns True when Azure Storage should be used.

        Production
        ----------
        APP_MODE=production

        Development
        -----------
        APP_MODE=development
        """

        return (
            not self.use_local_storage
            and self.has_storage_access()
        )


    def use_local(self) -> bool:
        """
        Returns True when local parquet files should be used.
        """

        return not self.use_azure()
