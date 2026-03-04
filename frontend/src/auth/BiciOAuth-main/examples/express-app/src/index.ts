import express from 'express';
import { createAuthRouter, requireAuth, getUser } from 'bici-google-auth';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
    const app = express();

    // NOTE: Behind a reverse proxy like Render, trust the proxy so cookies set 
    // with `secure: true` are correctly evaluated against X-Forwarded-Proto header.
    app.set('trust proxy', 1);

    // Parse JSON bodies (e.g. for API endpoints)
    app.use(express.json());

    // Mount the OIDC authentication routes at /auth
    const authRouter = await createAuthRouter({
        // Values will be read from process.env if omitted.
        // GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URL, SESSION_SECRET
        allowDomain: 'bici.cc',
        authMode: 'domain_or_allowlist'
    });
    app.use('/auth', authRouter);

    // 1) Public route
    app.get('/', (req, res) => {
        res.send(`
      <h1>Welcome to Bici App</h1>
      <p>Public Content.</p>
      <a href="/app">Go to Protected App</a><br/>
      <a href="/api/data">Go to Protected API</a><br/>
      <a href="/auth/login">Login directly</a>
    `);
    });

    // 2) Protected HTML route
    // The requireAuth middleware redirects to /auth/login if not authenticated
    app.get('/app', requireAuth('/auth/login'), (req, res) => {
        // You can safely use getUser() once requireAuth passes
        const user = getUser(req as any);
        res.send(`
      <h2>Dashboard</h2>
      <p>Welcome, ${user.name} (${user.email}).</p>
      <img src="${user.picture}" alt="Profile" style="width:50px;border-radius:25px;" />
      <br/>
      <form action="/auth/logout" method="POST">
        <button type="submit">Logout</button>
      </form>
    `);
    });

    // 3) Protected JSON API route
    // If request Accept header includes application/json, requireAuth returns 401 instead of redirecting
    app.get('/api/data', requireAuth('/auth/login'), (req, res) => {
        const user = getUser(req as any);
        res.json({
            secretData: [1, 2, 3],
            accessedBy: user.email
        });
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Example app listening on http://localhost:${PORT}`);
    });
}

main().catch(console.error);
