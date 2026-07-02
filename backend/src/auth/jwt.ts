import jwt from 'jsonwebtoken';
import { z } from 'zod';

// Fail fast at module load if JWT_SECRET is unset — never fall back to a
// default secret. Mirrors the DATABASE_URL guard in src/db/index.ts.
const rawJwtSecret = process.env.JWT_SECRET;
if (!rawJwtSecret) {
  throw new Error('JWT_SECRET is not set. Add it to backend/.env (see .env.example).');
}
// Re-bind to an explicitly-`string`-typed const: narrowing on `rawJwtSecret`
// from the guard above does not carry into the closures below.
const JWT_SECRET: string = rawJwtSecret;

const TOKEN_EXPIRY = '7d';

const tokenPayloadSchema = z.object({
  sub: z.string(),
  email: z.string(),
});

export type AuthTokenPayload = z.infer<typeof tokenPayloadSchema>;

export interface TokenUser {
  id: string;
  email: string;
}

/** Sign a 7-day HS256 JWT with payload `{ sub: user.id, email }`. */
export function signToken(user: TokenUser): string {
  const payload: AuthTokenPayload = { sub: user.id, email: user.email };
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: TOKEN_EXPIRY,
  });
}

/**
 * Verify and decode a JWT. Throws (JsonWebTokenError / TokenExpiredError) on
 * an invalid, malformed, or expired token, or on a payload that doesn't
 * match the expected shape.
 */
export function verifyToken(token: string): AuthTokenPayload {
  const decoded: unknown = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  const result = tokenPayloadSchema.safeParse(decoded);
  if (!result.success) {
    throw new jwt.JsonWebTokenError('Invalid token payload');
  }
  return result.data;
}
