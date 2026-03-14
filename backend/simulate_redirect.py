from dotenv import load_dotenv
import os
from urllib.parse import urlencode

load_dotenv()

client_id = os.environ.get('GOOGLE_CLIENT_ID')
redirect_url = os.environ.get('GOOGLE_REDIRECT_URL')

params = {
    'client_id': client_id,
    'redirect_uri': redirect_url,
    'response_type': 'code',
    'scope': 'openid email profile',
    'state': 'test_state',
    'nonce': 'test_nonce',
    'prompt': 'select_account'
}

url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
print(f"Generated URL:\n{url}")
