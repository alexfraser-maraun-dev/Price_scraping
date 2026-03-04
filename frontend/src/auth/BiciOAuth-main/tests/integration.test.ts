import request from 'supertest';
import express from 'express';

jest.mock('openid-client', () => {
    const mClient = {
        authorizationUrl: jest.fn().mockReturnValue('http://google.auth/url'),
        callbackParams: jest.fn(),
        callback: jest.fn(),
    };
    return {
        generators: {
            nonce: () => 'test_nonce',
            state: () => 'test_state',
            codeVerifier: () => 'test_code_verifier',
            codeChallenge: () => 'test_code_challenge',
        },
        Issuer: {
            discover: jest.fn().mockResolvedValue({
                Client: jest.fn().mockImplementation(() => mClient)
            })
        }
    };
});

import { createAuthRouter } from '../src/router';
import { requireAuth } from '../src/middleware';
import { createSessionMiddleware } from '../src/session';

describe('Express Integration Tests', () => {
    let app: express.Express;

    beforeAll(async () => {
        app = express();
        const config = {
            clientId: 'test',
            clientSecret: 'secret',
            redirectUrl: 'http://localhost/callback',
            sessionSecret: 'secret32byteslongstring'
        };
        app.use(createSessionMiddleware(config));

        const authRouter = await createAuthRouter(config);

        app.use('/auth', authRouter);
        app.get('/protected', requireAuth('/auth/login'), (req, res) => {
            res.send('Secret Area');
        });
        app.get('/protected-api', requireAuth('/auth/login'), (req, res) => {
            res.json({ secret: 'data' });
        });
    });

    test('requireAuth redirects HTML requests', async () => {
        const res = await request(app).get('/protected');
        expect(res.status).toBe(302);
        expect(res.header.location).toBe('/auth/login');
    });

    test('requireAuth returns 401 for JSON requests', async () => {
        const res = await request(app)
            .get('/protected-api')
            .set('Accept', 'application/json');

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Unauthorized');
    });

    test('/auth/login redirects to Google', async () => {
        const res = await request(app).get('/auth/login');
        expect(res.status).toBe(302);
        expect(res.header.location).toBe('http://google.auth/url');
    });

    test('/auth/whoami returns unauthenticated array initially', async () => {
        const res = await request(app).get('/auth/whoami');
        expect(res.body.authenticated).toBe(false);
    });
});
