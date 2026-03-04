# BiciOAuth (bici-flask-auth)

A reusable Python/Flask authentication module for internal Bici tools deployed on Render, powered by Google Workspace OAuth2/OpenID Connect.

## Core Features
- **Strict OIDC Security**: Validates JWT signatures using `PyJWT` with JWKS fetching, checking all claims (`iss`, `aud`, `exp`, `iat`, `sub`).
- **Domain Authorization**: Enforces that only users with an `@bici.cc` email address (or an explicit allowlist) can establish a session.
- **Flask Integration**: Built natively for Flask. Includes a Blueprint for the routing flow and straightforward `@require_auth` decorators.

---

## 🚀 Getting Started

### 1. Installation (Render Deployment)

Because BiciOAuth is a private internal repository, Render needs a Personal Access Token (PAT) to install it during build time.

**Step 1: Get a GitHub PAT**
Create a classic or fine-grained Personal Access Token with read access to the `techteambici` repositories.

**Step 2: Add it to the Render Environment**
In your Render service settings, add a secret environment variable named `GITHUB_PAT`.

**Step 3: Update `requirements.txt`**
Do NOT use SSH URLs (`git@github.com...`) in your requirements file, as Render's build sequence cannot resolve them without complex SSH key management. Instead, dynamically inject your token using this exact format in your `requirements.txt`:

```text
git+https://${GITHUB_PAT}@github.com/techteambici/BiciOAuth.git#egg=bici_flask_auth&subdirectory=python-flask
```
*(Render will automatically interpolate the `$GITHUB_PAT` environment variable during the `pip install` sequence).*

**For Local Development:**
If you are developing locally, you can use your SSH keys or point `pip` directly to a sibling folder:
```bash
# Using pip to install from a local path
pip install -e ../BiciOAuth/python-flask
```

### 2. Environment Variables

Your Flask application needs the following environment variables configured (e.g. via Render or a local `.env`):

```env
# Google OAuth Credentials
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URL=https://your-flask-app.onrender.com/auth/callback

# Security
SESSION_SECRET=a_random_cryptographically_secure_string_at_least_32_bytes_long

# Authorization Rules
ALLOW_DOMAIN=bici.cc
ALLOWED_EMAILS=contractor@gmail.com,audit@example.org
AUTH_MODE=domain_or_allowlist
```

### 3. Integration Example

See `examples/flask-app/app.py` for a complete example. Standard usage:

```python
from flask import Flask, jsonify
from bici_flask_auth import create_auth_blueprint, require_auth, get_user
import os

app = Flask(__name__)
app.secret_key = os.environ.get('SESSION_SECRET', 'super_secret')

# If deployed behind Render
from werkzeug.middleware.proxy_fix import ProxyFix
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True

# Register the Blueprint
auth_bp = create_auth_blueprint()
app.register_blueprint(auth_bp, url_prefix='/auth')

@app.route('/dashboard')
@require_auth('/auth/login')
def dashboard():
    user = get_user()
    return f"<h1>Welcome home, {user['email']}</h1>"

if __name__ == '__main__':
    app.run()
```
