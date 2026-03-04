import os
import sys
from google.cloud import bigquery
from dotenv import load_dotenv

# Add the current directory to sys.path to import from main
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

def test_full_query():
    # Load environment variables
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    load_dotenv(env_path)
    
    # Initialize client
    client = bigquery.Client()
    
    # Read SQL
    sql_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'product_source.sql')
    with open(sql_path, 'r') as f:
        sql = f.read()
    
    print("Executing full product query (Limit 5 for testing)...")
    # Add a small limit for testing to save time/resources
    test_sql = sql.replace("LIMIT 1000", "LIMIT 5")
    
    try:
        query_job = client.query(test_sql)
        results = query_job.result()
        
        count = 0
        for row in results:
            count += 1
            print(f"\nProduct {count}:")
            print(f"  Name: {row.product_name}")
            print(f"  Brand: {row.brand_name}")
            print(f"  UPC: {row.upc}")
            print(f"  Price: {row.current_default_price}")
            print(f"  Revenue: {row.total_revenue}")
            
        print(f"\nSuccessfully fetched {count} products.")
            
    except Exception as e:
        print(f"Error executing full query: {e}")

if __name__ == "__main__":
    test_full_query()
