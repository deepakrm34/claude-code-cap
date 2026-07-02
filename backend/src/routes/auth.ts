import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { query } from '../db';
import { signToken } from '../auth/jwt';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// bcrypt cost factor — within the requested 10-12 range.
const BCRYPT_COST = 12;

// Compared against when a login email doesn't exist, so the unknown-email and
// wrong-password paths take the same wall-clock time (prevents user
// enumeration via response timing). Computed once at module load.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('timing-equalizer-placeholder', BCRYPT_COST);

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  name: z.string().trim().min(1),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
}

interface PublicUser {
  id: string;
  email: string;
  name: string;
}

function toPublicUser(row: UserRow): PublicUser {
  return { id: row.id, email: row.email, name: row.name };
}

/** True if `err` is a `pg` unique_violation error (SQLSTATE 23505). */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === '23505'
  );
}

// POST /auth/register
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const { email, password, name } = parsed.data;
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    try {
      const result = await query<UserRow>(
        `INSERT INTO users (email, password_hash, name)
         VALUES ($1, $2, $3)
         RETURNING id, email, name, password_hash`,
        [email, passwordHash, name],
      );
      const user = result.rows[0];
      const token = signToken({ id: user.id, email: user.email });
      res.status(201).json({ token, user: toPublicUser(user) });
    } catch (err) {
      if (isUniqueViolation(err)) {
        res.status(409).json({ error: 'Email already registered' });
        return;
      }
      throw err;
    }
  }),
);

// POST /auth/login
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      return;
    }

    const { email, password } = parsed.data;
    const result = await query<UserRow>(
      `SELECT id, email, name, password_hash FROM users WHERE email = $1`,
      [email],
    );

    if (result.rows.length === 0) {
      // Burn the same bcrypt time as a real comparison before responding.
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = signToken({ id: user.id, email: user.email });
    res.status(200).json({ token, user: toPublicUser(user) });
  }),
);

// GET /auth/me (protected probe route)
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const result = await query<PublicUser>(`SELECT id, email, name FROM users WHERE id = $1`, [userId]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({ user: result.rows[0] });
  }),
);

export default router;
