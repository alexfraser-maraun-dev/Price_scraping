from flask import Flask, jsonify, request
from bici_flask_auth import create_auth_blueprint, require_auth, get_user
import os

app = Flask(__name__)

# Essential for session security
app.secret_key = os.environ.get('SESSION_SECRET', 'super_secret_for_development_only')
app.config['SESSION_COOKIE_HTTPONLY'] = True

# If behind a reverse proxy (like Render), proxy the X-Forwarded-Proto header
from werkzeug.middleware.proxy_fix import ProxyFix
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)
if os.environ.get('NODE_ENV') == 'production':
    app.config['SESSION_COOKIE_SECURE'] = True

# Register the Auth Blueprint
auth_bp = create_auth_blueprint({
    'client_id': os.environ.get('GOOGLE_CLIENT_ID', 'test_id'),
    'client_secret': os.environ.get('GOOGLE_CLIENT_SECRET', 'test_secret'),
    'redirect_url': os.environ.get('GOOGLE_REDIRECT_URL', 'http://localhost:5000/auth/callback'),
    'allow_domain': 'bici.cc'
})
app.register_blueprint(auth_bp, url_prefix='/auth')


@app.route('/')
def index():
    return """
      <h1>Welcome to Bici Flask App</h1>
      <p>Public Content.</p>
      <a href="/app">Go to Protected App</a><br/>
      <a href="/api/data">Go to Protected API</a><br/>
      <a href="/auth/login">Login directly</a>
    """


@app.route('/app')
@require_auth(login_path='/auth/login')
def protected_app():
    user = get_user()
    return f"""
      <h2>Dashboard</h2>
      <p>Welcome, {user.get('name')} ({user.get('email')}).</p>
      <img src="{user.get('picture')}" alt="Profile" style="width:50px;border-radius:25px;" />
      <br/>
      <form action="/auth/logout" method="POST">
        <button type="submit">Logout</button>
      </form>
    """


@app.route('/api/data')
@require_auth(login_path='/auth/login')
def protected_api():
    user = get_user()
    return jsonify({
       "secretData": [1, 2, 3],
       "accessedBy": user['email']
    })


if __name__ == '__main__':
    app.run(port=5000, debug=True)
