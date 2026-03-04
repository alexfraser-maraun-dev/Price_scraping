import jwt
import ssl
import certifi
from jwt import PyJWKClient

GOOGLE_JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs"
ssl_context = ssl.create_default_context(cafile=certifi.where())
jwks_client = PyJWKClient(GOOGLE_JWKS_URI, ssl_context=ssl_context)

def verify_google_token(id_token, client_id):
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(id_token)
        
        payload = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=client_id,
            issuer=["https://accounts.google.com", "accounts.google.com"],
            options={"require": ["iss", "aud", "exp", "iat", "sub"]}
        )
        
        if not payload.get('sub'):
            raise ValueError('Token is missing sub claim')
            
        email_verified = payload.get('email_verified')
        if email_verified is not True and str(email_verified).lower() != 'true':
            raise ValueError('Email is not verified by Google')
            
        email = payload.get('email')
        if not email:
            raise ValueError('Token is missing email claim')
            
        return {
            'sub': payload['sub'],
            'email': email,
            'name': payload.get('name', ''),
            'picture': payload.get('picture', ''),
            'iat': payload.get('iat', 0)
        }
    except Exception as e:
        raise ValueError(f"Invalid token: {str(e)}")
