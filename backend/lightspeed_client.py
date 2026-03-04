import os
import requests
import logging
from typing import Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

# Set up logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

class LightspeedClient:
    """
    Client for interacting with the Lightspeed Retail (R-Series) API.
    Handles OAuth2 authentication and API requests.
    """
    
    BASE_URL = "https://api.lightspeedapp.com/API/Account"
    TOKEN_URL = "https://cloud.lightspeedapp.com/oauth/access_token.php"

    def __init__(self):
        self.client_id = os.getenv("LIGHTSPEED_CLIENT_ID")
        self.client_secret = os.getenv("LIGHTSPEED_CLIENT_SECRET")
        self.refresh_token = os.getenv("LIGHTSPEED_REFRESH_TOKEN")
        self.account_id = os.getenv("LIGHTSPEED_ACCOUNT_ID")
        self.access_token = None
        
    def _authenticate(self) -> bool:
        """
        Retrieves a new access token using the refresh token.
        Returns True if successful, False otherwise.
        """
        if not all([self.client_id, self.client_secret, self.refresh_token]):
            logger.error("Missing Lightspeed API credentials in environment variables.")
            return False
            
        payload = {
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'refresh_token': self.refresh_token,
            'grant_type': 'refresh_token'
        }
        
        try:
            response = requests.post(self.TOKEN_URL, data=payload)
            response.raise_for_status()
            data = response.json()
            self.access_token = data.get('access_token')
            logger.info("Successfully authenticated with Lightspeed API.")
            return True
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to authenticate with Lightspeed API: {e}")
            return False

    def _get_headers(self) -> Dict[str, str]:
        """Returns the headers required for API requests."""
        if not self.access_token:
            if not self._authenticate():
                raise Exception("Failed to get access token for Lightspeed API.")
        
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json",
            "Content-Type": "application/json"
        }

    def get_item(self, item_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetches an item by its Lightspeed ItemID.
        """
        if not self.account_id:
            logger.error("Missing LIGHTSPEED_ACCOUNT_ID in environment variables.")
            return None
            
        url = f"{self.BASE_URL}/{self.account_id}/Item/{item_id}.json"
        headers = self._get_headers()
        
        try:
            # We explicitly load relations to see pricing data, like ItemShops or PriceLevels if needed.
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data.get('Item')
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch item {item_id}: {e}")
            return None

    def update_item_price(self, item_id: str, new_price: float) -> Optional[Dict[str, Any]]:
        """
        [DANGER ZONE] Updates the price of an item.
        THIS IS CURRENTLY DISABLED FOR SAFETY.
        """
        logger.warning(f"Attempted to update price for item {item_id} to {new_price}. THIS FUNCTION IS DISABLED FOR SAFETY.")
        return None
        
        # --- FUTURE IMPLEMENTATION (DRAFT) ---
        # url = f"{self.BASE_URL}/{self.account_id}/Item/{item_id}.json"
        # headers = self._get_headers()
        # payload = {
        #    # Payload structure depends on whether we are updating default price or a specific price level.
        #    # E.g., "Prices": {"ItemPrice": [{"amount": new_price, "useTypeID": 1}]}
        # }
        # try:
        #    response = requests.put(url, headers=headers, json=payload)
        #    response.raise_for_status()
        #    return response.json()
        # except requests.exceptions.RequestException as e:
        #    logger.error(f"Failed to update item {item_id}: {e}")
        #    return None

if __name__ == "__main__":
    # Simple test execution
    client = LightspeedClient()
    if client._authenticate():
        print("Authentication Setup Ready.")
    else:
        print("Authentication Setup Missing/Failed. Please check .env file.")
