import 'dotenv/config';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { resolveSsl } from './ssl';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Add it to backend/.env (see .env.example).');
}

/**
 * Shared connection pool. `max: 10` caps concurrent server-side connections;
 * requests beyond that queue until a client frees up.
 */
export const pool = new Pool({
  connectionString,
  max: 10,
  ssl: resolveSsl(connectionString),
});

/**
 * The pool emits 'error' when an *idle* client fails (e.g. the server closed the
 * connection, network dropped, DB restarted). These are not tied to an active
 * query and are treated as unrecoverable: log and exit so a process supervisor
 * (pm2, systemd, container orchestrator) can restart with a fresh pool.
 */
pool.on('error', (err: Error) => {
  console.error('[db] Unrecoverable error on idle PostgreSQL client:', err);
  process.exit(1);
});

const isDevelopment = process.env.NODE_ENV !== 'production';
const SLOW_QUERY_MS = 200;

/**
 * Run a parameterized query against the pool. In development, any query slower
 * than 200ms is logged with its duration and (whitespace-collapsed) SQL text.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  const start = process.hrtime.bigint();
  const result = await pool.query<T>(text, params as unknown[]);
  if (isDevelopment) {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    if (ms > SLOW_QUERY_MS) {
      const sql = text.replace(/\s+/g, ' ').trim();
      console.warn(`[db] slow query ${ms.toFixed(1)}ms (${String(result.rowCount ?? 0)} rows): ${sql}`);
    }
  }
  return result;
}

/** Acquire a client for multi-statement work (transactions). Always release it. */
export function getClient(): Promise<PoolClient> {
  return pool.connect();
}

/** Gracefully drain and close the pool. Call this during shutdown. */
export function closePool(): Promise<void> {
  return pool.end();
}
