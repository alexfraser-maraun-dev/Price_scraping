import session from 'express-session';
import { BiciAuthConfig } from './types';
import { parseConfig } from './config';

export function createSessionMiddleware(rawConfig: Partial<BiciAuthConfig>) {
  const config = parseConfig(rawConfig);
  return session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
    }
  });
}
