import os
from dotenv import load_dotenv

load_dotenv()

def hex_dump(name, value):
    if value is None:
        print(f"{name} is None")
        return
    print(f"{name}: '{value}'")
    hex_repr = " ".join([f"{ord(c):02x}" for c in value])
    print(f"HEX: {hex_repr}")

hex_dump("GOOGLE_CLIENT_ID", os.environ.get('GOOGLE_CLIENT_ID'))
hex_dump("GOOGLE_CLIENT_SECRET", os.environ.get('GOOGLE_CLIENT_SECRET'))
