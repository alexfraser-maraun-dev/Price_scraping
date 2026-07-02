import os
import secrets
from urllib.parse import urlencode
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import RedirectResponse
import httpx
import jwt
import ssl
import certifi
from jwt import PyJWKClient

# ==========================================
# CONFIGURATION & DOMAIN CHECK
# ==========================================

def get_auth_config():
    client_id = os.environ.get('GOOGLE_CLIENT_ID')
    client_secret = os.environ.get('GOOGLE_CLIENT_SECRET')
    redirect_url = os.environ.get('GOOGLE_REDIRECT_URL')
    
    if not (client_id and client_secret and redirect_url):
        print("Warning: Missing required configuration (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URL). Authentication routes may fail.")
        
    allow_domain = os.environ.get('ALLOW_DOMAIN', 'bici.cc')
    allowed_emails_str = os.environ.get('ALLOWED_EMAILS', '')
    auth_mode = os.environ.get('AUTH_MODE', 'domain_or_allowlist')
    
    return {
        'client_id': client_id,
        'client_secret': client_secret,
        'redirect_url': redirect_url,
        'allow_domain': allow_domain,
        'allowed_emails': allowed_emails_str,
        'auth_mode': auth_mode
    }

def safe_return_to(return_to: Optional[str]) -> str:
    """Restrict post-login redirects to same-origin relative paths.

    Prevents an open redirect via `/auth/login?return_to=https://evil.com`. Only a
    single leading slash is allowed; `//host` (protocol-relative) and backslash
    variants that browsers normalize to an absolute URL are rejected.
    """
    if not return_to or not return_to.startswith('/'):
        return '/'
    if return_to.startswith('//') or '\\' in return_to:
        return '/'
    return return_to


def is_user_allowed(email, config):
    if not email:
        return False
        
    lower_email = email.lower().strip()
    allowlist_str = config.get('allowed_emails', '')
    allowlist = [e.strip().lower() for e in allowlist_str.split(',')] if allowlist_str else []
    
    is_in_allowlist = lower_email in allowlist
    
    if config.get('auth_mode') == 'allowlist_only':
        return is_in_allowlist
        
    domain = config.get('allow_domain', '').lower().strip()
    is_in_domain = lower_email.endswith(f"@{domain}") if domain else False
    
    return is_in_domain or is_in_allowlist


# ==========================================
# JWT VERIFICATION
# ==========================================

GOOGLE_JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs"
ssl_context = ssl.create_default_context(cafile=certifi.where())
jwks_client = PyJWKClient(GOOGLE_JWKS_URI, ssl_context=ssl_context)

def verify_google_token(id_token: str, client_id: str):
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
            'iat': payload.get('iat', 0),
            'nonce': payload.get('nonce')
        }
    except Exception as e:
        raise ValueError(f"Invalid token: {str(e)}")


# ==========================================
# FASTAPI ROUTER & DEPENDENCY
# ==========================================

auth_router = APIRouter(prefix="/auth", tags=["auth"])

@auth_router.get('/login')
async def login(request: Request, return_to: str = '/'):
    config = get_auth_config()
    nonce = secrets.token_urlsafe(16)
    state = secrets.token_urlsafe(16)
    
    request.session['nonce'] = nonce
    request.session['state'] = state
    request.session['return_to'] = safe_return_to(return_to)
    
    params = {
        'client_id': config['client_id'],
        'redirect_uri': config['redirect_url'],
        'response_type': 'code',
        'scope': 'openid email profile',
        'state': state,
        'nonce': nonce,
        'prompt': 'select_account'
    }
    
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
    return RedirectResponse(url)

@auth_router.get('/callback')
async def callback(request: Request, state: Optional[str] = None, code: Optional[str] = None, error: Optional[str] = None):
    if error:
        raise HTTPException(status_code=400, detail=f"Auth Error: {error}")
        
    session_state = request.session.get('state')
    
    if not state or state != session_state:
        raise HTTPException(status_code=400, detail="Session expired or invalid state. Please login again.")
        
    config = get_auth_config()
    
    # Exchange code for tokens
    token_url = "https://oauth2.googleapis.com/token"
    token_data = {
        'code': code,
        'client_id': config['client_id'],
        'client_secret': config['client_secret'],
        'redirect_uri': config['redirect_url'],
        'grant_type': 'authorization_code'
    }
    
    async with httpx.AsyncClient() as client:
        res = await client.post(token_url, data=token_data)
        res.raise_for_status()
        tokens = res.json()
        
    id_token = tokens.get('id_token')
    
    if not id_token:
        raise HTTPException(status_code=400, detail="Google did not return an ID token")
        
    client_id_conf = config['client_id']
    if not client_id_conf:
        raise HTTPException(status_code=500, detail="Missing GOOGLE_CLIENT_ID configuration")
        
    try:
        claims = verify_google_token(id_token, client_id_conf)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Bind the ID token to this login attempt: the nonce we sent at /login must
    # match the one Google echoed into the token (defends against token replay).
    session_nonce = request.session.get('nonce')
    if not session_nonce or claims.get('nonce') != session_nonce:
        raise HTTPException(status_code=400, detail="Invalid or missing nonce. Please login again.")

    if not is_user_allowed(claims['email'], config):
        raise HTTPException(status_code=403, detail=f"Access Denied: Email {claims['email']} is not authorized for this application.")
        
    return_to = safe_return_to(request.session.get('return_to', '/'))
    
    # Clear old session to prevent fixation
    request.session.clear() 
    request.session['user'] = {
        'email': claims['email'],
        'name': claims['name'],
        'picture': claims['picture'],
        'sub': claims['sub'],
        'issued_at': claims['iat']
    }
    
    return RedirectResponse(return_to)

@auth_router.post('/logout')
@auth_router.get('/logout')
async def logout(request: Request):
    request.session.clear()
    return {"message": "Logged out successfully"}

@auth_router.get('/whoami')
async def whoami(request: Request):
    if 'user' in request.session:
        return {'authenticated': True, 'user': request.session['user']}
    return {'authenticated': False, 'user': None}

async def require_auth(request: Request):
    """
    FastAPI Dependency to protect routes.
    If the user is not authenticated, raises a 401 Unauthorized exception.
    """
    user = request.session.get('user')
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user
