import os
from dotenv import load_dotenv

load_dotenv()

client_id = os.environ.get('GOOGLE_CLIENT_ID')
print(f"DEBUG: CLIENT_ID=[{client_id}]")
if client_id:
    print(f"DEBUG: START_QUOTE={client_id.startswith(chr(34))}")
    print(f"DEBUG: END_QUOTE={client_id.endswith(chr(34))}")
else:
    print("DEBUG: CLIENT_ID is None")
