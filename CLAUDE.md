# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Two **independent** npm projects, not a workspace/monorepo — there is no root `package.json` and no workspace linking. Run every command from inside the relevant directory (`cd backend` or `cd frontend`); there is no root-level orchestration.

- `backend/` — Express + TypeScript REST API (PostgreSQL via `pg`, JWT auth). Currently runnable end-to-end.
- `frontend/` — React 18 + TypeScript SPA (Redux Toolkit, Tailwind CSS v3, Vite). **Scaffolded at the dependency level only** — `package.json` exists but there is no `src/`, `index.html`, `vite.config.ts`, `tsconfig.json`, or Tailwind/PostCSS config yet, so its scripts will not run until those are added.

## Commands

### Backend (`cd backend`)
- `npm run dev` — dev server with auto-reload (`tsx watch src/server.ts`); **no build step needed**, runs the TS source directly.
- `npm run build` — compile `src/` → `dist/` with `tsc`.
- `npm start` — run the compiled server (`node dist/server.js`). **Requires `npm run build` first** — there is no `prestart` hook, so a clean checkout will fail with `MODULE_NOT_FOUND` until built.
- `npm run typecheck` / `npm run type-check` — both alias `tsc --noEmit` (kept as duplicates so either name works).
- `npm run migrate` / `migrate:down` / `migrate:create` — `node-pg-migrate`; require `DATABASE_URL` to be set.
- `npm run lint` / `lint:fix`, `npm test` / `test:watch` — **wired in `package.json` but not yet functional**: there is no ESLint flat config (`eslint.config.js`, required by ESLint 9) and no test files exist. Add config/tests before relying on these.
- Run a single test (once Vitest tests exist): `npx vitest run src/foo.test.ts` or filter by name with `npx vitest run -t "test name"`.

### Frontend (`cd frontend`)
Scripts (`dev`, `build`, `preview`, `typecheck`/`type-check`, `lint`, `test`) are defined but require the missing Vite/TS/Tailwind config and a `src/` entry point before they will run.

## Backend architecture

- **Entry point** `src/server.ts` builds the Express app, and `export default app` so it can be imported in tests without binding a port.
- **Module system is CommonJS** (`"type": "commonjs"` + `tsconfig` `module: commonjs`). Do not add ESM-only packages without adjusting the build.
- **Middleware order is deliberate** and should be preserved when adding routes: `helmet()` → `cors()` → `express.json()` → `express.urlencoded()` → routes → 404 handler → centralized error handler (4-arg). New routes go before the 404 handler.
- **Graceful shutdown**: SIGTERM/SIGINT close the HTTP server before `process.exit`. Preserve this when adding resources like a DB pool (close them in the shutdown path).
- **Port** comes from `process.env.PORT`, default `3000`.

## Environment & config gotchas

- Backend env vars (see `backend/.env.example`): `DATABASE_URL`, `PORT`, `JWT_SECRET`, `CLAUDE_API_KEY`. Copy to `backend/.env` (loaded via `import 'dotenv/config'` at the top of `server.ts`).
- **`CLAUDE_API_KEY` is a custom name.** The official Anthropic SDK reads `ANTHROPIC_API_KEY` by default — if you wire up `@anthropic-ai/sdk`, pass the key explicitly (`new Anthropic({ apiKey: process.env.CLAUDE_API_KEY })`) or it won't be picked up.
- **Unused-parameter convention**: `tsconfig` enables `noUnusedLocals` + `noUnusedParameters`. Prefix intentionally-unused function params with `_` (e.g. `_req`, `_next`) or the build fails. Existing handlers already follow this.
- Tailwind is pinned to **v3** (classic `tailwind.config.js` + `@tailwind` directives), not v4's CSS-first setup.
