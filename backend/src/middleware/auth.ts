import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { verifyToken, type AuthTokenPayload } from '../auth/jwt';

// Declaration merging: attach the decoded JWT payload to every Express
// Request so downstream handlers get typed access to `req.user` without
// casting.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

const BEARER_PREFIX = 'Bearer ';

/**
 * Requires a valid `Authorization: Bearer <token>` header. On success,
 * attaches the decoded payload to `req.user` and calls `next()`. On a
 * missing header, malformed token, or expired token, responds 401.
 */
export const requireAuth: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.header('authorization');
  if (!authHeader || !authHeader.startsWith(BEARER_PREFIX)) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(BEARER_PREFIX.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
