import { Request } from 'express';
import { SessionData } from 'express-session';

export interface BiciAuthConfig {
    clientId: string;
    clientSecret: string;
    redirectUrl: string;
    sessionSecret: string;

    /**
     * Domain default is `bici.cc`
     */
    allowDomain?: string;

    /**
     * Comma-separated list of additional, explicitly allowed emails.
     */
    allowedEmails?: string;

    /**
     * Mode for checking access.
     * `domain_or_allowlist`: allow if matches domain OR allowlist.
     * `allowlist_only`: allow ONLY if matches the allowlist.
     */
    authMode?: 'domain_or_allowlist' | 'allowlist_only';
}

export interface AuthSessionUser {
    email: string;
    name: string;
    picture: string;
    sub: string;
    issued_at: number;
}

declare module 'express-session' {
    interface SessionData {
        user?: AuthSessionUser;
        nonce?: string;
        state?: string;
        codeVerifier?: string;
        returnTo?: string;
    }
}

import { Session } from 'express-session';

export interface AuthRequest extends Request {
    session: Session & Partial<SessionData> & { user?: AuthSessionUser };
}
