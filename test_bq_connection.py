import os
from google.cloud import bigquery
from dotenv import load_dotenv

def test_connection():
    # Load environment variables from backend/.env
    env_path = os.path.join(os.path.dirname(__file__), 'backend', '.env')
    load_dotenv(env_path)
    
    # Ensure GOOGLE_APPLICATION_CREDENTIALS is set
    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not credentials_path:
        print("Error: GOOGLE_APPLICATION_CREDENTIALS not set in .env")
        return

    print(f"Using credentials from: {credentials_path}")
    
    try:
        # Initialize the BigQuery client
        client = bigquery.Client()
        
        # Perform a simple query to test connection
        query = "SELECT 1 AS test_val"
        query_job = client.query(query)
        results = query_job.result()
        
        for row in results:
            print(f"Connection successful! Test value: {row.test_val}")
            
    except Exception as e:
        print(f"Error connecting to BigQuery: {e}")

if __name__ == "__main__":
    test_connection()
