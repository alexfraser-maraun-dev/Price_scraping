import secrets
from urllib.parse import urlencode
from flask import Blueprint, request, session, redirect, jsonify, current_app
from .config import parse_config, is_user_allowed
from .auth import verify_google_token
import requests

def create_auth_blueprint(raw_config=None):
    """
    Creates a Flask Blueprint handling /login, /callback, /logout, and /whoami
    Make sure your Flask app has app.secret_key set, and ideally, 
    app.config['SESSION_COOKIE_HTTPONLY'] = True 
    app.config['SESSION_COOKIE_SECURE'] = True (in production)
    """
    config = parse_config(raw_config)
    auth_bp = Blueprint('auth', __name__)
    auth_bp.config = config
    
    @auth_bp.route('/login')
    def login():
        nonce = secrets.token_urlsafe(16)
        state = secrets.token_urlsafe(16)
        
        session['nonce'] = nonce
        session['state'] = state
        
        params = {
            'client_id': auth_bp.config['client_id'],
            'redirect_uri': auth_bp.config['redirect_url'],
            'response_type': 'code',
            'scope': 'openid email profile',
            'state': state,
            'nonce': nonce,
            'prompt': 'select_account'
        }
        
        url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
        return redirect(url)
        
    @auth_bp.route('/callback')
    def callback():
        state = request.args.get('state')
        code = request.args.get('code')
        error = request.args.get('error')
        
        if error:
            return f"Auth Error: {error}", 400
            
        session_state = session.get('state')
        
        if not state or state != session_state:
            return "Session expired or invalid state. Please login again.", 400
            
        # Exchange code for tokens
        token_url = "https://oauth2.googleapis.com/token"
        token_data = {
            'code': code,
            'client_id': auth_bp.config['client_id'],
            'client_secret': auth_bp.config['client_secret'],
            'redirect_uri': auth_bp.config['redirect_url'],
            'grant_type': 'authorization_code'
        }
        
        try:
            res = requests.post(token_url, data=token_data)
            res.raise_for_status()
            tokens = res.json()
            id_token = tokens.get('id_token')
            
            if not id_token:
                raise ValueError("Google did not return an ID token")
                
            claims = verify_google_token(id_token, auth_bp.config['client_id'])
            
            if not is_user_allowed(claims['email'], auth_bp.config):
                return f"Access Denied: Email {claims['email']} is not authorized for this application.", 403
                
            # Clear old session to prevent fixation, but store our return_to
            return_to = session.get('return_to', '/')
            session.clear() 
            session['user'] = {
                'email': claims['email'],
                'name': claims['name'],
                'picture': claims['picture'],
                'sub': claims['sub'],
                'issued_at': claims['iat']
            }
            
            return redirect(return_to)
            
        except Exception as e:
            current_app.logger.error(f'Auth Callback Error: {e}')
            return f"Authentication failed: {str(e)}", 500
            
    @auth_bp.route('/logout', methods=['GET', 'POST'])
    def logout():
        session.clear()
        return redirect('/')
        
    @auth_bp.route('/whoami')
    def whoami():
        if 'user' in session:
            return jsonify({'authenticated': True, 'user': session['user']})
        return jsonify({'authenticated': False, 'user': None})
        
    return auth_bp
