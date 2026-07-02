---
description: Run tests, typecheck, and lint across backend and frontend
argument-hint: [backend|frontend] [vitest filter, e.g. a file path or -t "name"]
---

Run this repo's quality suite and report the results. Arguments (optional): `$ARGUMENTS`

## Scope

- No arguments → run the full suite in **both** workspaces (`backend/` and `frontend/`).
- If the arguments name a workspace (`backend` or `frontend`), run only that one.
- Any remaining arguments are a vitest filter — pass them through, e.g. `npx vitest run src/foo.test.ts` or `npx vitest run -t "test name"`. When a filter is given, skip typecheck/lint and run only the filtered tests.

## What to run (per workspace, from inside that directory — this is NOT a monorepo, there are no root scripts)

1. `npm run typecheck`
2. `npm run lint`
3. `npm test` (vitest run)

Run backend and frontend sequentially; within a workspace the three steps are independent, so keep going even if an earlier step fails — the goal is a complete picture, not fail-fast.

## Interpreting results

- **Vitest exits 1 with "No test files found"** when a workspace has no `*.test.ts(x)` / `*.spec.ts(x)` files yet. Report that as "no tests yet", NOT as a failure. (As of creation, neither workspace has test files — this is expected until tests are added.)
- Lint baseline is **zero errors** in both workspaces. Any lint error is a real regression.
- Backend tests that touch the database hit the live Neon cloud Postgres via `backend/.env` — they need internet access, and remote latency will trigger the dev slow-query logger's warnings on stderr; those warnings are noise, not failures.

## Report

Finish with a compact per-workspace table: typecheck / lint / tests → pass, fail, or no tests yet. If something failed, show the relevant error output verbatim below the table and state the likely cause — but do not start fixing anything unless the user asked for fixes in the same message.
