import os

def parse_config(config=None):
    if config is None:
        config = {}
        
    client_id = config.get('client_id') or os.environ.get('GOOGLE_CLIENT_ID')
    client_secret = config.get('client_secret') or os.environ.get('GOOGLE_CLIENT_SECRET')
    redirect_url = config.get('redirect_url') or os.environ.get('GOOGLE_REDIRECT_URL')
    
    if not (client_id and client_secret and redirect_url):
        raise ValueError("bici-flask-auth: Missing required configuration (client_id, client_secret, redirect_url). Set them via config or ENV.")
        
    allow_domain = config.get('allow_domain') or os.environ.get('ALLOW_DOMAIN', 'bici.cc')
    allowed_emails_str = config.get('allowed_emails') or os.environ.get('ALLOWED_EMAILS', '')
    auth_mode = config.get('auth_mode') or os.environ.get('AUTH_MODE', 'domain_or_allowlist')
    
    return {
        'client_id': client_id,
        'client_secret': client_secret,
        'redirect_url': redirect_url,
        'allow_domain': allow_domain,
        'allowed_emails': allowed_emails_str,
        'auth_mode': auth_mode
    }

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
