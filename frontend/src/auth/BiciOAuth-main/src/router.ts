import { Router, Request, Response, NextFunction } from 'express';
import { generators, Issuer, BaseClient } from 'openid-client';
import session from 'express-session';
import { BiciAuthConfig, AuthRequest } from './types';
import { parseConfig, isUserAllowed } from './config';
import { verifyGoogleToken } from './auth';

export async function createAuthRouter(rawConfig: Partial<BiciAuthConfig>): Promise<Router> {
    const config = parseConfig(rawConfig);
    const router = Router();

    // 2. Discover Google OIDC settings
    const googleIssuer = await Issuer.discover('https://accounts.google.com');
    const client = new googleIssuer.Client({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uris: [config.redirectUrl],
        response_types: ['code']
    });

    // GET /auth/login
    router.get('/login', (req: AuthRequest, res: Response) => {
        const nonce = generators.nonce();
        const state = generators.state();
        const code_verifier = generators.codeVerifier();
        const code_challenge = generators.codeChallenge(code_verifier);

        req.session.nonce = nonce;
        req.session.state = state;
        req.session.codeVerifier = code_verifier;

        const authUrl = client.authorizationUrl({
            scope: 'openid email profile',
            state,
            nonce,
            code_challenge,
            code_challenge_method: 'S256',
            prompt: 'select_account',
        });

        res.redirect(authUrl);
    });

    // GET /auth/callback
    router.get('/callback', async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const params = client.callbackParams(req);

            const state = req.session.state;
            const nonce = req.session.nonce;
            const code_verifier = req.session.codeVerifier;

            if (!state || !nonce || !code_verifier) {
                return res.status(400).send('Session expired or invalid state. Please try logging in again.');
            }

            // Exchange code for tokens
            const tokenSet = await client.callback(config.redirectUrl, params, { state, nonce, code_verifier });

            if (!tokenSet.id_token) {
                throw new Error('Google did not return an ID token');
            }

            // verify via strict 'jose' claims validation
            const claims = await verifyGoogleToken(tokenSet.id_token, config.clientId);

            // check domain or allowlist
            if (!isUserAllowed(claims.email, config)) {
                return res.status(403).send(`Access Denied: Email ${claims.email} is not authorized for this application.`);
            }

            // Successful auth -> establish session
            req.session.regenerate((err) => {
                if (err) return next(err);

                req.session.user = {
                    email: claims.email,
                    name: claims.name,
                    picture: claims.picture,
                    sub: claims.sub,
                    issued_at: claims.iat
                };

                const returnTo = req.session.returnTo || '/';
                delete req.session.returnTo;
                res.redirect(returnTo);
            });
        } catch (error) {
            console.error('Auth Callback Error:', error);
            res.status(500).send('Authentication failed');
        }
    });

    // POST /auth/logout (and GET for convenience, though POST is safer)
    const logoutHandler = (req: AuthRequest, res: Response, next: NextFunction) => {
        req.session.destroy((err) => {
            if (err) return next(err);
            res.clearCookie('connect.sid'); // default express-session cookie
            res.redirect('/');
        });
    };

    router.post('/logout', logoutHandler);
    router.get('/logout', logoutHandler);

    // GET /auth/whoami
    router.get('/whoami', (req: AuthRequest, res: Response) => {
        if (req.session && req.session.user) {
            res.json({ authenticated: true, user: req.session.user });
        } else {
            res.json({ authenticated: false, user: null });
        }
    });

    return router;
}
