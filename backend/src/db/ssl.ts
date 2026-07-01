import { readFileSync } from 'node:fs';

/**
 * Resolves the `pg` SSL option from a connection string, using **verified TLS**
 * for remote/cloud databases and no TLS for a plain localhost connection.
 *
 * - Neon & Supabase serve publicly-trusted certificates, so the default
 *   (`true` → verify against the system CA store) connects with no extra config.
 * - For a provider using a private/self-signed CA, set `PGSSLROOTCERT` to the CA
 *   file path — the connection stays verified, just against that CA.
 *
 * We never return `{ rejectUnauthorized: false }`: disabling verification would
 * expose the connection (and its credentials/data) to man-in-the-middle attacks.
 */
export function resolveSsl(connectionString: string): boolean | { ca: string } {
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])(:|\/)/.test(connectionString);
  if (isLocal && !/sslmode=require/i.test(connectionString)) {
    return false; // local dev over a Unix-ish loopback: plaintext is fine
  }
  const caPath = process.env.PGSSLROOTCERT;
  if (caPath) {
    return { ca: readFileSync(caPath, 'utf8') }; // verify against a custom CA
  }
  return true; // verify against the system/public CA store
}
