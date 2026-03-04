import os
import sys
import json
from google.shopping import merchant_reports_v1
from google.oauth2 import service_account
from dotenv import load_dotenv

def test_insights():
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    load_dotenv(env_path)
    
    merchant_id = os.getenv("MERCHANT_ID")
    merchant_creds_path = os.getenv("MERCHANT_APPLICATION_CREDENTIALS")
    
    print(f"Testing Merchant API Price Insights for ID: {merchant_id}")
    
    creds = service_account.Credentials.from_service_account_file(merchant_creds_path)
    client = merchant_reports_v1.ReportServiceClient(credentials=creds)
    
    parent = f"accounts/{merchant_id}"
    
    query = """
        SELECT 
            id,
            benchmark_price,
            report_country_code
        FROM price_competitiveness_product_view
        WHERE report_country_code = 'CA'
        LIMIT 5
    """
    
    print("Executing query...")
    try:
        request = merchant_reports_v1.SearchRequest(parent=parent, query=query)
        response = client.search(request=request)
        
        count = 0
        for row in response:
            count += 1
            print(f"Row {count}: {row.price_competitiveness_product_view}")
            
        if count == 0:
            print("No insights found.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_insights()
