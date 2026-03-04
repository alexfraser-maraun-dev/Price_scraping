import { Response, NextFunction } from 'express';
import { AuthRequest, AuthSessionUser } from './types';

/**
 * Middleware to protect routes. 
 * If a user is not in the session, it returns a 401 JSON error (if requesting JSON)
 * or redirects to the login path (if requesting HTML).
 */
export function requireAuth(loginPath: string = '/auth/login') {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (req.session && req.session.user) {
            return next();
        }

        // Save intended destination for redirect after login
        if (req.originalUrl && req.method === 'GET') {
            req.session.returnTo = req.originalUrl;
        }

        const acceptHeader = req.headers.accept || '';
        if (acceptHeader.includes('application/json') || req.xhr) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        }

        res.redirect(loginPath);
    };
}

/**
 * Helper to retrieve the authenticated user from the Request session.
 * Throws an error if called on a route that hasn't passed requireAuth.
 */
export function getUser(req: AuthRequest): AuthSessionUser {
    if (!req.session || !req.session.user) {
        throw new Error('User is not authenticated. Did you forget requireAuth middleware?');
    }
    return req.session.user;
}
