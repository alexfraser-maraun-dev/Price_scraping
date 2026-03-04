import os
import sys
import json
from google.shopping import merchant_reports_v1
from google.oauth2 import service_account
from dotenv import load_dotenv

# Add the current directory to sys.path to import from main
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

def test_merchant_api():
    # Load environment variables
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    load_dotenv(env_path)
    
    merchant_id = os.getenv("MERCHANT_ID")
    merchant_creds_path = os.getenv("MERCHANT_APPLICATION_CREDENTIALS")
    
    if not merchant_id:
        print("Error: MERCHANT_ID not set in .env")
        return
    
    if not merchant_creds_path:
        print("Error: MERCHANT_APPLICATION_CREDENTIALS not set in .env")
        return

    print(f"Testing Merchant API (v1) for ID: {merchant_id}")
    print(f"Using credentials from: {merchant_creds_path}")
    
    try:
        # Initialize Merchant Service using v1
        creds = service_account.Credentials.from_service_account_file(merchant_creds_path)
        client = merchant_reports_v1.ReportServiceClient(credentials=creds)
        print("Successfully initialized Merchant API v1 client")
        
        # MCQL Query (v1)
        # Note: v1 requires 'product_view.id' in the SELECT clause
        # Note: 'gtin' is now 'gtins' (array)
        parent = f"accounts/{merchant_id}"
        query = """
            SELECT 
                product_view.id,
                product_view.offer_id, 
                product_view.gtin,
                product_view.title,
                product_view.brand
            FROM product_view
            LIMIT 5
        """
        
        print("Executing ProductView query...")
        request = merchant_reports_v1.SearchRequest(
            parent=parent,
            query=query
        )
        
        response = client.search(request=request)
        
        print("\nResults:")
        count = 0
        for row in response:
            count += 1
            p = row.product_view
            print(f"- ID: {p.id}, OfferID: {p.offer_id}: {p.title} (GTINs: {p.gtin}, Brand: {p.brand})")
            
        if count == 0:
            print("No products found.")
        else:
            print(f"\nSuccessfully fetched {count} products.")
            
    except Exception as e:
        print(f"Error connecting to Merchant API: {e}")

if __name__ == "__main__":
    test_merchant_api()
