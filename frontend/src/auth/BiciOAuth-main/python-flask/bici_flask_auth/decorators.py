from functools import wraps
from flask import session, request, redirect, jsonify

def require_auth(login_path='/auth/login'):
    """
    Decorator for protecting Flask routes. Redirects to login if HTML, returns 401 if JSON.
    Usage:
    @app.route('/protected')
    @require_auth(login_path='/auth/login')
    def my_protected():
        pass
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user' in session:
                return f(*args, **kwargs)
                
            # Protect original URL destination
            if request.method == 'GET':
                session['return_to'] = request.url
                
            if request.is_json or (request.accept_mimetypes.accept_json and not request.accept_mimetypes.accept_html):
                return jsonify({'error': 'Unauthorized', 'message': 'Authentication required'}), 401
                
            return redirect(login_path)
        return decorated_function
    return decorator

def get_user():
    """Returns the user dictionary from the session if authenticated."""
    user = session.get('user')
    if not user:
        raise Exception('User is not authenticated. Did you use @require_auth?')
    return user
