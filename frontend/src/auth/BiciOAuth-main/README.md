# BiciOAuth (bici-google-auth)

A reusable Node.js/Express authentication module for internal Bici tools deployed on Render, powered by Google Workspace OAuth2/OpenID Connect.

## Core Features
- **Strict OIDC Security**: Validates JWT signatures against Google's live public JWKS, and explicitly asserts `iss`, `aud`, `exp`, `iat`, `sub`, and `email_verified` claims using `jose`.
- **Domain Authorization**: Enforces that only users with an `@bici.cc` email address (or an explicit allowlist of external domains/emails) can successfully establish a session.
- **Secure Sessions**: Utilizes HttpOnly cookies with `express-session`, regenerating Session IDs on every login to prevent fixation. CSRF states and nonces validate the OAuth handshake.
- **Protected Routes**: Includes native Express middlewares `requireAuth()` and `getUser()` to confidently firewall your app's endpoints.

---

## 🚀 Getting Started

### 1. Installation (Render Deployment)

Because BiciOAuth is a private internal repository, you cannot simply `npm install` it from the public registry. Render needs a Personal Access Token (PAT) to fetch it directly from GitHub during the build.

**Step 1: Add `GITHUB_PAT` to Render**
Create a GitHub Personal Access Token with read access to the repository, and add it as a secret environment variable named `GITHUB_PAT` in your Render dashboard for the specific web service.

**Step 2: Update `package.json`**
Add the dependency directly linked to GitHub, injecting the environment variable. Render will automatically interpolate this during `npm install`.

```json
{
  "dependencies": {
    "bicioauth": "git+https://${GITHUB_PAT}@github.com/techteambici/BiciOAuth.git"
  }
}
```

**For Local Development:**
If you have SSH keys set up locally, you can install the module directly from your terminal:
```bash
npm install git+ssh://git@github.com/techteambici/BiciOAuth.git
```

### 2. Environment Variables

Your Express application will need the following environment variables configured (e.g. in your Render dashboard or local `.env` file):

```env
# Google OAuth Credentials
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URL=https://your-render-app.onrender.com/auth/callback

# Security
SESSION_SECRET=a_random_cryptographically_secure_string_at_least_32_bytes_long

# Authorization Rules
ALLOW_DOMAIN=bici.cc
# Optional: comma separated list of external emails to allow
ALLOWED_EMAILS=contractor@gmail.com,audit@example.org
# Optional: 'domain_or_allowlist' (default) or 'allowlist_only'
AUTH_MODE=domain_or_allowlist
```

### 3. Google Cloud Setup

1. In the Google Cloud Console, navigate to **APIs & Services > Credentials**.
2. Click **Create Credentials** -> **OAuth client ID**.
3. Application Type = **Web application**.
4. **Authorized JavaScript origins**: `https://your-render-app.onrender.com`
5. **Authorized redirect URIs**: `https://your-render-app.onrender.com/auth/callback` (Must match the `GOOGLE_REDIRECT_URL` env variable exactly).
6. Enable the **Google+ API** or **Google Identity** APIs if prompted.
7. Under **OAuth consent screen**, ensure it is configured for "Internal" if you only want Workspace users, or "External" if you plan to use `ALLOWED_EMAILS` for non-workspace users.

### 4. Integration

See `examples/express-app/src/index.ts` for a complete end-to-end example. But at a high level:

```typescript
import express from 'express';
import { createAuthRouter, requireAuth, getUser } from 'bicioauth';

async function bootstrap() {
  const app = express();
  
  // REQUIRED: If deployed on Render behind their load balancer, you MUST trust the proxy 
  // so secure cookies map to X-Forwarded-Proto headers.
  app.set('trust proxy', 1);

  // Mount the Auth Router
  const authRouter = await createAuthRouter({
    allowDomain: 'bici.cc' // will override ALLOW_DOMAIN env var if present
  });
  app.use('/auth', authRouter);

  // Protected Route
  app.get('/dashboard', requireAuth('/auth/login'), (req, res) => {
    // If we reach here, the session is secure and valid.
    const user = getUser(req);
    res.send(`<h1>Welcome home, ${user.email}</h1>`);
  });

  app.listen(3000);
}
bootstrap();
```

---

## Technical Design & Threat Model

*   **OAuth Code Flow + PKCE**: This module forces the strict Authorization Code flow with Proof Key for Code Exchange (PKCE) and `state` nonces natively provided by `openid-client`.
*   **Redirect Mismatches**: If `GOOGLE_REDIRECT_URL` doesn't identically match what happens at auth time, Google throws a 400.
*   **Clock Skew**: `jose` JWT validation allows small clock skew tolerances for `exp` and `iat`. 
*   **JWKS Caching**: The public keys (`https://www.googleapis.com/oauth2/v3/certs`) are cached securely by `jose.createRemoteJWKSet()` to prevent massive outbound calls while still automatically rotating when Google cycles keys.
*   **Reverse Proxy (Render)**: Because the cookies are set to `secure: true` in production, you *must* run `app.set('trust proxy', 1)` in Express so that it correctly reads the `https` origin forwarded by Render. Otherwise, cookies will fail to save.
