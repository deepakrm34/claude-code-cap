import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { resolveSsl } from './ssl';

/**
 * Applies src/db/schema.sql against DATABASE_URL.
 *
 * The schema is idempotent (CREATE ... IF NOT EXISTS, guarded enum/trigger
 * creation), so this can be run repeatedly. Postgres executes a multi-statement
 * simple query in a single implicit transaction, so a failure rolls the whole
 * file back rather than leaving a half-applied schema.
 */

function resolveSchemaPath(): string {
  // __dirname is src/db when run via tsx, or dist/db when run compiled.
  const candidates = [
    join(__dirname, 'schema.sql'), // alongside this file (tsx, or if copied into dist)
    join(process.cwd(), 'src', 'db', 'schema.sql'), // compiled run with source tree present
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(`Could not locate schema.sql. Looked in:\n  ${candidates.join('\n  ')}`);
  }
  return found;
}

async function migrate(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Add it to backend/.env (see .env.example).');
  }

  const schemaPath = resolveSchemaPath();
  const sql = readFileSync(schemaPath, 'utf8');

  const client = new Client({ connectionString, ssl: resolveSsl(connectionString) });
  await client.connect();
  try {
    console.log(`Applying schema from ${schemaPath} ...`);
    await client.query(sql);
    console.log('Schema applied successfully.');
  } finally {
    await client.end();
  }
}

migrate().catch((err: unknown) => {
  console.error('Migration failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
