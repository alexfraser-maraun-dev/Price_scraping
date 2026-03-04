import { isUserAllowed, parseConfig } from '../src/config';
import { BiciAuthConfig } from '../src/types';

describe('BiciOAuth Authorization Rules', () => {
    const baseConfig: BiciAuthConfig = {
        clientId: 'test',
        clientSecret: 'secret',
        redirectUrl: 'http://localhost/callback',
        sessionSecret: 'secret',
        allowDomain: 'bici.cc',
        allowedEmails: 'outside@example.com, test@example.org',
        authMode: 'domain_or_allowlist'
    };

    test('allows emails from the primary domain', () => {
        expect(isUserAllowed('user@bici.cc', baseConfig)).toBe(true);
        expect(isUserAllowed('admin@BICI.CC', baseConfig)).toBe(true);
    });

    test('blocks emails outside the domain', () => {
        expect(isUserAllowed('user@gmail.com', baseConfig)).toBe(false);
        expect(isUserAllowed('hacker@evil.com', baseConfig)).toBe(false);
    });

    test('allows explicitly allowlisted emails outside the domain', () => {
        expect(isUserAllowed('outside@example.com', baseConfig)).toBe(true);
        expect(isUserAllowed('TEST@EXAMPLE.ORG', baseConfig)).toBe(true);
    });

    test('handles allowlist_only mode correctly', () => {
        const strictConfig = { ...baseConfig, authMode: 'allowlist_only' as const };

        // Domain alone is no longer enough
        expect(isUserAllowed('user@bici.cc', strictConfig)).toBe(false);

        // Allowlist still works
        expect(isUserAllowed('outside@example.com', strictConfig)).toBe(true);
    });

    test('parses config env variables properly', () => {
        process.env.GOOGLE_CLIENT_ID = 'env_id';
        process.env.GOOGLE_CLIENT_SECRET = 'env_secret';
        process.env.GOOGLE_REDIRECT_URL = 'env_redirect';
        process.env.SESSION_SECRET = 'env_session';
        process.env.ALLOW_DOMAIN = 'biker.cc';

        const parsed = parseConfig(); // should inherit from env
        expect(parsed.allowDomain).toBe('biker.cc');
        expect(parsed.clientId).toBe('env_id');
    });
});
