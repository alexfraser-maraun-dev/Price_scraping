import os
import logging
from typing import List, Dict, Any
from google.cloud import bigquery
from google.api_core.exceptions import GoogleAPIError

logger = logging.getLogger(__name__)

class BigQueryClient:
    """
    Client for interacting with Google BigQuery.
    Handles reading product baselines and writing scrape results to bici-klaviyo-datasync.BiciPricingScraper.
    """
    
    # Target tables for writing the results
    TARGET_TABLE_RUNS = "bici-klaviyo-datasync.BiciPricingScraper.BiciPricingScraper_Runs"
    TARGET_TABLE_COMPETITORS = "bici-klaviyo-datasync.BiciPricingScraper.BiciPricingScraper_Competitors"

    def __init__(self):
        # Assumes GOOGLE_APPLICATION_CREDENTIALS is set in the environment or
        # running in an environment with default credentials.
        try:
            self.client = bigquery.Client()
        except Exception as e:
            logger.error(f"Failed to initialize BigQuery client: {e}")
            self.client = None

    def fetch_product_baselines(self) -> List[Dict[str, Any]]:
        """
        Fetches the baseline product data (including System SKU and Lightspeed ItemID).
        Needs the actual source table name and query logic.
        """
        if not self.client:
            return []
            
        logger.warning("fetch_product_baselines is a stub. Replace with actual query.")
        # --- FUTURE IMPLEMENTATION (DRAFT) ---
        # query = \"\"\"
        #     SELECT system_sku, lightspeed_item_id, product_name, current_bici_price, margin
        #     FROM `project.dataset.source_items_table`
        # \"\"\"
        # try:
        #     query_job = self.client.query(query)
        #     results = query_job.result()
        #     return [dict(row) for row in results]
        # except GoogleAPIError as e:
        #     logger.error(f"Failed to fetch baselines from BQ: {e}")
        #     return []
        
        return []

    def write_comparison_results(self, rows_to_insert: List[Dict[str, Any]]) -> bool:
        """
        Inserts new scrape and comparison results into the target history table.
        """
        if not self.client:
            return False
            
        if not rows_to_insert:
            logger.info("No rows to insert into BigQuery.")
            return True
            
        logger.info(f"Attempting to write {len(rows_to_insert)} rows to {self.TARGET_TABLE}...")
        
        try:
            # We use insert_rows_json for streaming inserts, or load_table_from_json for batch load
            errors = self.client.insert_rows_json(self.TARGET_TABLE, rows_to_insert)
            if not errors:
                logger.info(f"Successfully inserted {len(rows_to_insert)} rows into {self.TARGET_TABLE}.")
                return True
            else:
                logger.error(f"Encountered errors while inserting rows: {errors}")
                return False
        except GoogleAPIError as e:
            logger.error(f"BigQuery API Error during insert: {e}")
            return False

if __name__ == "__main__":
    bq_client = BigQueryClient()
    if bq_client.client:
        print("BigQuery Client Initialized.")
    else:
        print("BigQuery Client Failed to Initialize.")
