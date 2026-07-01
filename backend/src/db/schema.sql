-- ---------------------------------------------------------------------------
-- Database schema (idempotent). Safe to run repeatedly.
-- Applied by src/db/migrate.ts against DATABASE_URL.
-- ---------------------------------------------------------------------------

-- gen_random_uuid() for UUID primary keys (built into core on PG13+, and
-- provided by pgcrypto on older versions).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enum types. CREATE TYPE has no "IF NOT EXISTS", so guard with a DO block
-- that swallows the duplicate-object error on re-runs.
DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- users -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  name          TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- tasks -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                   TEXT          NOT NULL,
  description             TEXT          NOT NULL,
  ai_enhanced_description TEXT,                       -- nullable
  status                  task_status   NOT NULL DEFAULT 'todo',
  priority                task_priority NOT NULL DEFAULT 'medium',
  due_date                TIMESTAMPTZ,                -- nullable
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks (user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status  ON tasks (status);

-- Keep tasks.updated_at accurate on every UPDATE.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- comments ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
