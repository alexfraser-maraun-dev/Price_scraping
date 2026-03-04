import { createRemoteJWKSet, jwtVerify } from 'jose';

// Google's public JWKS endpoint
const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';
const jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URI));

export interface ValidatedClaims {
    sub: string;
    email: string;
    name: string;
    picture: string;
    iat: number;
}

export async function verifyGoogleToken(idToken: string, clientId: string): Promise<ValidatedClaims> {
    // Validate standard claims: iss, aud, exp, iat, sub via jose
    const { payload } = await jwtVerify(idToken, jwks, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: clientId,
    });

    if (!payload.sub) {
        throw new Error('Token is missing sub claim');
    }

    // explicit email verified check
    if (payload.email_verified !== true && payload.email_verified !== 'true') {
        throw new Error('Email is not verified by Google');
    }

    const email = typeof payload.email === 'string' ? payload.email : '';
    if (!email) {
        throw new Error('Token is missing email claim');
    }

    return {
        sub: payload.sub,
        email,
        name: typeof payload.name === 'string' ? payload.name : '',
        picture: typeof payload.picture === 'string' ? payload.picture : '',
        iat: typeof payload.iat === 'number' ? payload.iat : Math.floor(Date.now() / 1000)
    };
}
