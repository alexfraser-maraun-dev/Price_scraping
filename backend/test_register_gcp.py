import os
import sys
import json
import requests
from google.auth.transport.requests import Request
from google.oauth2 import service_account
from dotenv import load_dotenv

def register_gcp_project():
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    load_dotenv(env_path)
    
    merchant_id = os.getenv("MERCHANT_ID")
    merchant_creds_path = os.getenv("MERCHANT_APPLICATION_CREDENTIALS")
    
    if not merchant_id or not merchant_creds_path:
        print("Error: Missing credentials in .env")
        return

    print(f"Registering GCP project for Merchant ID: {merchant_id}")
    
    try:
        # 1. Get OAuth token from the service account key
        creds = service_account.Credentials.from_service_account_file(
            merchant_creds_path,
            scopes=['https://www.googleapis.com/auth/content']
        )
        creds.refresh(Request())
        token = creds.token
        
        # 2. Call the registerGcp endpoint
        url = f"https://merchantapi.googleapis.com/accounts/v1/accounts/{merchant_id}/developerRegistration:registerGcp"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        # Note: We don't provide an email here because we are authenticating AS the service account.
        # If this requires a specific admin email, the API will tell us.
        payload = {}
        
        print(f"Sending POST to {url}...")
        response = requests.post(url, headers=headers, json=payload)
        
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    register_gcp_project()
