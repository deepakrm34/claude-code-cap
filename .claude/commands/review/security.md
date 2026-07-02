---
description: Review staged changes for auth, JWT, and SQL-injection issues
allowed-tools: Bash(git diff --staged), Bash(git diff --staged --name-only), Bash(git diff --staged --stat)
---

## Staged changes to review

- Files: !`git diff --staged --name-only`
- Diff: !`git diff --staged`

If nothing is staged, say so and stop — do not review the working tree instead.

## Repo security baseline (compare the diff against these)

- Auth middleware (Bearer verification, typed `req.user`): @backend/src/middleware/auth.ts
- JWT helpers (HS256 pinned, payload zod-validated, fail-fast secret): @backend/src/auth/jwt.ts
- Auth routes (bcrypt cost 12, timing-equalized 401s, generic "Invalid credentials"): @backend/src/routes/auth.ts

## What to check — in the staged diff only

1. **Auth / authorization**
   - New route files or handlers reachable without `requireAuth` (router-level `router.use(requireAuth)` or per-route).
   - Missing ownership scoping: every task/comment query must filter `user_id = req.user.sub`; unowned rows must return **404, never 403** (no resource enumeration).
   - Trusting client input for identity (user id from body/params instead of the JWT `sub`).
2. **JWT**
   - `jwt.verify` without pinning `algorithms: ['HS256']`; tokens signed without expiry; payloads read without validation.
   - `JWT_SECRET` (or any secret) hardcoded, defaulted, logged, or returned in a response.
3. **SQL injection**
   - Any value interpolated into SQL text — all values must go through `query()` / `getClient()` placeholders (`$1, $2, …`).
   - Dynamic SQL (SET/WHERE/column lists) may only interpolate placeholder indexes or identifiers from a fixed in-code allowlist, never request data.
4. **Secrets & credentials in the diff** — `.env` values, `sk-ant-*` keys, `postgresql://` connection strings, password hashes; passwords handled by anything other than bcrypt, or logged/returned.

## Report

Rank findings by severity (critical → low). For each: `file:line`, the offending code, why it's exploitable, and a concrete fix. If the diff is clean, state that explicitly and note what was checked. Report only — do not edit files.
