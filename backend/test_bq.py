import os
from google.cloud import bigquery
from dotenv import load_dotenv

load_dotenv()
bq_creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
if bq_creds_path:
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = bq_creds_path
try:
    client = bigquery.Client()
    print("BQ connected")
except Exception as e:
    print(f"Error: {e}")
