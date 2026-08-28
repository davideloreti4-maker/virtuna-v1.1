# AGENTS.md

Project-specific guidance for AI agents. See also `CLAUDE.md` (identity, design
system, worktree map) and `docs/` for deeper references.

## Cursor Cloud specific instructions

### What this is
Single Next.js 16 app (App Router, React 19, Tailwind v4, TypeScript) — a TikTok
creator product ("Maven" in the UI, "Virtuna" in the repo) that simulates how a
synthetic audience reacts to content. Backend = Supabase (Auth/Postgres/Storage).
AI = Qwen via DashScope. Scraping = Apify. It is **not** a monorepo (single
`package.json`, no workspace).

### Standard commands (already documented in `package.json`)
- Dev server: `pnpm dev` → http://localhost:3000 (Turbopack; the script sets
  `NODE_OPTIONS=--max-old-space-size=2048`).
- Lint: `pnpm lint`. Unit/component tests: `pnpm test` (Vitest, ~4400 tests, ~90s).
- Typecheck: `npx tsc --noEmit` (no dedicated script; tsconfig excludes
  `scripts/`, `e2e/`, `extraction/`).
- E2E: `pnpm e2e` (Playwright; needs the dev server + auth env — see below).

### Environment variables (the #1 gotcha)
Secrets live in `.env.local`, which is **gitignored and NOT present in a fresh
cloud VM**. Without Supabase keys the app only serves the public landing page
`/` (HTTP 200); **every other route 500s**, because the auth middleware runs on
all non-static requests.
- The Supabase auth middleware lives in `src/proxy.ts` (Next.js 16 renamed
  `middleware.ts` → `proxy.ts`) → `src/lib/supabase/middleware.ts`. It calls
  `createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, ...)`, so missing
  keys throw "Your project's URL and Key are required" on `/login`, `/signup`,
  `/home`, etc.
- Minimum to boot authed flows: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (+ optionally
  `NEXT_PUBLIC_APP_URL`). AI features additionally need `DASHSCOPE_API_KEY`;
  scraping/discover/audience-calibration need `APIFY_TOKEN`. Templates:
  `.env.example` / `.env.local.example`.
- The intended dev setup points at a **hosted Supabase project** (see
  `.env.example` comments and `docs/UI-WORKFLOW.md`). These are configured as
  Cloud secrets in this environment, so `/login`, `/signup`, `/home` and all
  authed API routes work end-to-end. The dev server reads them from the process
  env — if you started it before secrets existed, restart it to pick them up.

### Auth / test accounts (hosted Supabase)
- UI signup (`/signup`) sends a confirmation email and does NOT create a usable
  session directly — the action redirects to `/login` with "Check your email".
  In the cloud VM you can't receive that email, so to get a working login,
  provision a **pre-confirmed** user with the service-role Admin API:
  `POST $NEXT_PUBLIC_SUPABASE_URL/auth/v1/admin/users` with headers
  `apikey`/`Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY` and body
  `{"email":"...","password":"...","email_confirm":true}`, then log in via the
  UI. Clean up test users afterwards (`DELETE .../admin/users/<id>`), as this is
  a shared hosted project.
- First login for a new user redirects to `/welcome` onboarding (enter a TikTok
  handle → "Continue" → lands on `/home`); returning users go straight to
  `/home`.

### Local Supabase (`supabase start`) is currently NOT a working path
`supabase db reset` / `supabase start` cannot initialize this repo's schema:
1. Eight migration files share duplicate version prefixes (e.g. two
   `20260213000000_*`, two `20260216000000_*`, …), which collide on
   `schema_migrations_pkey`.
2. `supabase/migrations/20260217000000_competitor_intelligence.sql` has invalid
   SQL — `COALESCE(...)` inside a table-level `UNIQUE(...)` constraint, which
   Postgres rejects (expressions aren't allowed there).
So use a **hosted Supabase project** (secrets above) rather than the local CLI
stack unless/until the migrations are repaired.

### Other non-obvious notes
- `pnpm install` skips some optional build scripts (`esbuild`, `sharp`,
  `supabase`, `@sentry/cli`, `unrs-resolver`) because only `ffmpeg-static` is in
  `pnpm.onlyBuiltDependencies`. Lint, typecheck, tests, and `pnpm dev` all work
  regardless. Consequence: the `supabase` CLI binary is NOT installed at
  `node_modules/.bin/supabase` by default (its postinstall is skipped).
- Dev-server CSS caching: if CSS changes don't appear, kill the dev server and
  clear `.next/` + `node_modules/.cache/` before restarting (see `CLAUDE.md`).
- Dev-mode only: the post-auth client-side redirect (e.g. completing `/welcome`
  onboarding, or the first navigation into `/home`) can briefly hang on a loading
  skeleton while Turbopack compiles the route / the store hydrates. Server-side
  every route returns 200; a page reload resolves it. This is a dev Fast-Refresh
  artifact, not an app/setup failure.
- Design system source of truth = `src/app/globals.css` + `docs/DESIGN-SYSTEM.md`
  (many other design docs are stale — see `CLAUDE.md` / `.cursor/rules`).
- On `main` today `pnpm lint` reports ~13 pre-existing errors; `tsc --noEmit` and
  `pnpm test` are clean. Don't treat the lint errors as caused by your setup.
