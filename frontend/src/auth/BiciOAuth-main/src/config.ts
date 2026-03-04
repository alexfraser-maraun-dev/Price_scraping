import { BiciAuthConfig } from './types';

export function parseConfig(config: Partial<BiciAuthConfig> = {}): BiciAuthConfig {
    const clientId = config.clientId || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = config.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
    const redirectUrl = config.redirectUrl || process.env.GOOGLE_REDIRECT_URL;
    const sessionSecret = config.sessionSecret || process.env.SESSION_SECRET;

    if (!clientId || !clientSecret || !redirectUrl || !sessionSecret) {
        throw new Error('bici-google-auth: Missing required configuration (clientId, clientSecret, redirectUrl, sessionSecret). Set them in config obj or via ENV.');
    }

    return {
        clientId,
        clientSecret,
        redirectUrl,
        sessionSecret,
        allowDomain: config.allowDomain || process.env.ALLOW_DOMAIN || 'bici.cc',
        allowedEmails: config.allowedEmails || process.env.ALLOWED_EMAILS || '',
        authMode: config.authMode || (process.env.AUTH_MODE as any) || 'domain_or_allowlist'
    };
}

export function isUserAllowed(email: string, config: BiciAuthConfig): boolean {
    if (!email) return false;

    const lowerEmail = email.toLowerCase().trim();
    const allowlist = config.allowedEmails
        ? config.allowedEmails.split(',').map(e => e.trim().toLowerCase())
        : [];

    const isInAllowlist = allowlist.includes(lowerEmail);

    if (config.authMode === 'allowlist_only') {
        return isInAllowlist;
    }

    // domain_or_allowlist
    const domain = config.allowDomain?.toLowerCase().trim();
    const isInDomain = domain ? lowerEmail.endsWith(`@${domain}`) : false;

    return isInDomain || isInAllowlist;
}
