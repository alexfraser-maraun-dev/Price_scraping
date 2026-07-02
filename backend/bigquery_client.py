import json
import logging
import os
from typing import Any, Dict, List, Optional

from google.cloud import bigquery
from google.api_core.exceptions import GoogleAPIError
from google.oauth2 import service_account

logger = logging.getLogger(__name__)

PROJECT = "bici-klaviyo-datasync"
DATASET = "BiciPricingScraper"

TABLE_REGISTRY = f"{PROJECT}.{DATASET}.Competitor_Registry"
TABLE_RUNS = f"{PROJECT}.{DATASET}.BiciPricingScraper_Runs"
TABLE_OFFERS = f"{PROJECT}.{DATASET}.BiciPricingScraper_Competitors"

RUNS_SCHEMA = [
    bigquery.SchemaField("run_id", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("domain", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("connector_type", "STRING"),
    bigquery.SchemaField("started_at", "TIMESTAMP"),
    bigquery.SchemaField("finished_at", "TIMESTAMP"),
    bigquery.SchemaField("offers_found", "INT64"),
    bigquery.SchemaField("offers_matched", "INT64"),
    bigquery.SchemaField("status", "STRING"),
    bigquery.SchemaField("error", "STRING"),
]

OFFERS_SCHEMA = [
    bigquery.SchemaField("run_id", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("domain", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("scraped_at", "TIMESTAMP"),
    bigquery.SchemaField("item_id", "INT64"),
    bigquery.SchemaField("upc", "STRING"),
    bigquery.SchemaField("competitor_title", "STRING"),
    bigquery.SchemaField("competitor_sku", "STRING"),
    bigquery.SchemaField("competitor_barcode", "STRING"),
    bigquery.SchemaField("price", "FLOAT64"),
    bigquery.SchemaField("compare_at_price", "FLOAT64"),
    bigquery.SchemaField("currency", "STRING"),
    bigquery.SchemaField("available", "BOOL"),
    bigquery.SchemaField("url", "STRING"),
    bigquery.SchemaField("match_method", "STRING"),
    bigquery.SchemaField("match_confidence", "FLOAT64"),
]

REGISTRY_SCHEMA = [
    bigquery.SchemaField("domain", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("display_name", "STRING"),
    bigquery.SchemaField("connector_type", "STRING"),
    bigquery.SchemaField("enabled", "BOOL"),
    bigquery.SchemaField("config", "STRING"),
    bigquery.SchemaField("created_at", "TIMESTAMP"),
    bigquery.SchemaField("updated_at", "TIMESTAMP"),
]

SEED_COMPETITORS = [
    ("primeauvelo.com", "Primeau Vélo", "serp_api"),
    ("enroute.cc", "Enroute", "shopify_html"),
    ("thebikeshop.com", "The Bike Shop", "shopify_json"),
    ("steedcycles.com", "Steed Cycles", "shopify_json"),
]


class BigQueryClient:
    """
    Client for the BiciPricingScraper dataset: competitor registry,
    scrape-run logging, scraped competitor offers, and product baselines.
    """

    def __init__(self, client: Optional[bigquery.Client] = None):
        if client is not None:
            self.client = client
            return
        try:
            creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
            if creds_path:
                creds = service_account.Credentials.from_service_account_file(creds_path)
                self.client = bigquery.Client(credentials=creds, project=creds.project_id)
            else:
                self.client = bigquery.Client()
        except Exception as e:
            logger.error(f"Failed to initialize BigQuery client: {e}")
            self.client = None

    # ------------------------------------------------------------------
    # Setup
    # ------------------------------------------------------------------
    def ensure_tables(self) -> bool:
        """Create the scraper dataset/tables if missing, and seed the registry when empty.

        Checks existence before creating: the service account typically lacks
        project-level dataset-create rights, so a blind create_dataset 403s even
        when the dataset already exists.
        """
        if not self.client:
            return False
        try:
            try:
                self.client.get_dataset(f"{PROJECT}.{DATASET}")
            except GoogleAPIError:
                self.client.create_dataset(f"{PROJECT}.{DATASET}")

            for table_id, schema in [
                (TABLE_REGISTRY, REGISTRY_SCHEMA),
                (TABLE_RUNS, RUNS_SCHEMA),
                (TABLE_OFFERS, OFFERS_SCHEMA),
            ]:
                try:
                    existing = self.client.get_table(table_id)
                except GoogleAPIError:
                    self.client.create_table(bigquery.Table(table_id, schema=schema))
                    logger.info(f"Created table {table_id}")
                    continue
                # Legacy pre-pipeline tables have an incompatible schema; replace them
                # only when empty, otherwise require a manual migration.
                existing_fields = {f.name for f in existing.schema}
                required_fields = {f.name for f in schema}
                if not required_fields.issubset(existing_fields):
                    if existing.num_rows == 0:
                        self.client.delete_table(table_id)
                        self.client.create_table(bigquery.Table(table_id, schema=schema))
                        logger.info(f"Recreated empty table {table_id} with the current schema")
                    else:
                        logger.error(f"{table_id} has data but is missing columns "
                                     f"{sorted(required_fields - existing_fields)}; migrate it manually")
                        return False

            count = list(self.client.query(f"SELECT COUNT(*) AS n FROM `{TABLE_REGISTRY}`").result())[0].n
            if count == 0:
                for domain, display_name, connector_type in SEED_COMPETITORS:
                    self.upsert_competitor(domain, display_name, connector_type, enabled=True)
                logger.info(f"Seeded competitor registry with {len(SEED_COMPETITORS)} domains")
            return True
        except GoogleAPIError as e:
            logger.error(f"ensure_tables failed: {e}")
            return False

    # ------------------------------------------------------------------
    # Competitor registry
    # ------------------------------------------------------------------
    def list_competitors(self, enabled_only: bool = False) -> List[Dict[str, Any]]:
        if not self.client:
            return []
        sql = f"SELECT * FROM `{TABLE_REGISTRY}`"
        if enabled_only:
            sql += " WHERE enabled = TRUE"
        sql += " ORDER BY created_at"
        try:
            return [dict(row) for row in self.client.query(sql).result()]
        except GoogleAPIError as e:
            logger.error(f"list_competitors failed: {e}")
            return []

    def upsert_competitor(
        self,
        domain: str,
        display_name: Optional[str] = None,
        connector_type: Optional[str] = None,
        enabled: Optional[bool] = None,
        config: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Insert or update a registry row. Only non-None fields are updated."""
        if not self.client:
            return False
        sql = f"""
        MERGE `{TABLE_REGISTRY}` t
        USING (SELECT @domain AS domain) s
        ON t.domain = s.domain
        WHEN MATCHED THEN UPDATE SET
            display_name = COALESCE(@display_name, t.display_name),
            connector_type = COALESCE(@connector_type, t.connector_type),
            enabled = COALESCE(@enabled, t.enabled),
            config = COALESCE(@config, t.config),
            updated_at = CURRENT_TIMESTAMP()
        WHEN NOT MATCHED THEN INSERT
            (domain, display_name, connector_type, enabled, config, created_at, updated_at)
        VALUES
            (@domain, COALESCE(@display_name, @domain), COALESCE(@connector_type, 'serp_api'),
             COALESCE(@enabled, TRUE), @config, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())
        """
        job_config = bigquery.QueryJobConfig(query_parameters=[
            bigquery.ScalarQueryParameter("domain", "STRING", domain),
            bigquery.ScalarQueryParameter("display_name", "STRING", display_name),
            bigquery.ScalarQueryParameter("connector_type", "STRING", connector_type),
            bigquery.ScalarQueryParameter("enabled", "BOOL", enabled),
            bigquery.ScalarQueryParameter("config", "STRING", json.dumps(config) if config else None),
        ])
        try:
            self.client.query(sql, job_config=job_config).result()
            return True
        except GoogleAPIError as e:
            logger.error(f"upsert_competitor({domain}) failed: {e}")
            return False

    # ------------------------------------------------------------------
    # Scrape results
    # ------------------------------------------------------------------
    def write_run(self, run_meta: Dict[str, Any]) -> bool:
        return self._load_rows(TABLE_RUNS, RUNS_SCHEMA, [run_meta])

    def write_offers(self, rows: List[Dict[str, Any]]) -> bool:
        return self._load_rows(TABLE_OFFERS, OFFERS_SCHEMA, rows)

    def _load_rows(self, table_id: str, schema, rows: List[Dict[str, Any]]) -> bool:
        """Batch-load rows (avoids the streaming-buffer limitations of insert_rows_json)."""
        if not self.client:
            return False
        if not rows:
            logger.info(f"No rows to insert into {table_id}.")
            return True
        try:
            job_config = bigquery.LoadJobConfig(
                schema=schema,
                write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
            )
            job = self.client.load_table_from_json(rows, table_id, job_config=job_config)
            job.result()
            logger.info(f"Inserted {len(rows)} rows into {table_id}.")
            return True
        except GoogleAPIError as e:
            logger.error(f"BigQuery load into {table_id} failed: {e}")
            return False

    def fetch_latest_offers(self) -> List[Dict[str, Any]]:
        """Offers from the most recent successful run of each enabled competitor."""
        if not self.client:
            return []
        sql = f"""
        WITH latest_runs AS (
            SELECT domain, run_id
            FROM (
                SELECT r.domain, r.run_id,
                       ROW_NUMBER() OVER (PARTITION BY r.domain ORDER BY r.finished_at DESC) AS rn
                FROM `{TABLE_RUNS}` r
                JOIN `{TABLE_REGISTRY}` reg ON reg.domain = r.domain AND reg.enabled = TRUE
                WHERE r.status = 'success'
            )
            WHERE rn = 1
        )
        SELECT o.*
        FROM `{TABLE_OFFERS}` o
        JOIN latest_runs lr ON o.domain = lr.domain AND o.run_id = lr.run_id
        WHERE o.item_id IS NOT NULL
        """
        try:
            return [dict(row) for row in self.client.query(sql).result()]
        except GoogleAPIError as e:
            logger.error(f"fetch_latest_offers failed: {e}")
            return []

    # ------------------------------------------------------------------
    # Product baseline
    # ------------------------------------------------------------------
    def fetch_product_baselines(self) -> List[Dict[str, Any]]:
        """Top-revenue SKUs from product_source.sql — the products we match offers against."""
        if not self.client:
            return []
        sql_path = os.path.join(os.path.dirname(__file__), "..", "product_source.sql")
        if not os.path.exists(sql_path):
            logger.error(f"product_source.sql not found at {sql_path}")
            return []
        with open(sql_path, "r") as f:
            sql = f.read()
        try:
            return [dict(row) for row in self.client.query(sql).result()]
        except GoogleAPIError as e:
            logger.error(f"fetch_product_baselines failed: {e}")
            return []


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    bq_client = BigQueryClient()
    if bq_client.client:
        print("BigQuery Client Initialized.")
        print("ensure_tables:", bq_client.ensure_tables())
        for competitor in bq_client.list_competitors():
            print(competitor)
    else:
        print("BigQuery Client Failed to Initialize.")
