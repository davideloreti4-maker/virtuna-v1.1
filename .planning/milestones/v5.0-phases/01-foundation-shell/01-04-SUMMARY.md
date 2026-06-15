---
phase: 01-foundation-shell
plan: 04
subsystem: auth-routing
tags: [middleware, auth-callback, authed-landing, /home, protected-prefixes, open-redirect-guard, same-origin, supabase-ssr]

# Dependency graph
requires:
  - phase: 01-03
    provides: The /home route exists (authed server page in the (app) group, inherits the getUser gate + AppShell). This plan repoints the landing AT /home — 01-03 had to create the destination first to avoid a redirect-to-404 window.
provides:
  - The default authed landing is now /home (D-23) — both decision points repointed — authed users hitting /login or /signup land on /home, and the OAuth callback default destination is /home.
  - /home is auth-gated twice — the (app) layout getUser() gate (01-03) AND a PROTECTED_PREFIXES entry here (defense-in-depth, Spoofing mitigation) — an unauthenticated /home hit redirects to /login with the deep link preserved.
  - The authed-off-auth-page redirect (previously dead code shadowed by the public-path early-returns) is now reachable — /login & /signup flow through getUser() before the public skip so a signed-in visitor is bounced to /home.
  - middleware.landing.test.ts — the SHELL-06/D-23 landing-redirect regression guard (4 tests; first Supabase-SSR-mocked middleware unit test in the repo).
affects: [01-05 THEME-06 UAT gate (a signed-in user now actually lands on the reviewed /home shell), phase-02-the-simulation (the permalink restore flow is reached via the same /analyze/[id] route, untouched here)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Middleware landing unit test mocks @supabase/ssr createServerClient (controllable getUser + a stubbed .from().select().eq().maybeSingle() so the authed onboarding lookup is inert) and drives the REAL updateSession with a genuine NextRequest; next/server is not mocked (NextRequest/NextResponse run under vitest)"
    - "Same-origin redirect by construction — every Location is new URL(path, request.url|origin) or request.nextUrl.clone(); a user-supplied `next` is only ever resolved via new URL(next, origin), never followed as an absolute external URL (open-redirect guard, V5)"
    - "Auth pages (/login, /signup) are public for signed-OUT users but bypass the public-path fast-return for signed-IN users via an AUTH_PAGES carve-out — the authed-redirect check runs after getUser(), then the public skip returns the page for anonymous visitors"

key-files:
  created:
    - src/lib/supabase/__tests__/middleware.landing.test.ts
  modified:
    - src/lib/supabase/middleware.ts
    - src/app/auth/callback/route.ts

key-decisions:
  - "The plan's truth 'authed-on-auth-page -> /home' could not hold as a pure one-line repoint: the L130 authed-auth-page redirect was DEAD CODE, shadowed by two earlier public-path early-returns (L62 fast-return for public paths without ?ref; L116 public-skip after getUser). /login & /signup are public, so the branch never executed. To make the plan's stated behavior real (not just rename an unreachable line), the authed-redirect was made reachable: an AUTH_PAGES carve-out excludes /login & /signup from the L62 fast-return, and the authed-redirect now runs BEFORE the L116 public-skip. Documented as a Rule 1/3 deviation."
  - "Repointed BOTH decision points per D-23 + RESEARCH A4: middleware authed-off-auth-page redirect (/analyze -> /home) AND the auth/callback default (?? '/dashboard' -> ?? '/home'). Also repointed the /dashboard sunset 308 target /analyze -> /home so the sunset path lands on the new home too."
  - "Kept /analyze + /analyze/[id] dormant-but-reachable (D-23) — /analyze stays in PROTECTED_PREFIXES; the IDOR-defended /analyze/[id] permalink is untouched. Build confirms both still emit (f /analyze, f /analyze/[id])."
  - "Preserved /welcome first-time-user precedence in the callback (onboarding takes precedence over the landing) and the same-origin new URL(redirectTo, origin) redirect."

requirements-completed: [SHELL-06, THEME-05]

# Metrics
duration: 4min
completed: 2026-06-13
---

# Phase 1 Plan 04: Repoint Authed Landing to /home Summary

**Made the new Numen `/home` the default authed landing (D-23) by repointing the two places that decide where a signed-in user lands — the middleware authed-off-auth-page redirect and the OAuth callback default — to `/home`, adding `/home` to `PROTECTED_PREFIXES` for defense-in-depth, and keeping `/analyze` + `/analyze/[id]` dormant-but-reachable; closed a latent bug where the authed-auth-page redirect was dead code shadowed by the public-path early-returns; all same-origin (open-redirect guard), with a 4-test landing guard green and the full 1945-test suite + production build passing.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-13T17:54:13Z
- **Completed:** 2026-06-13T17:58:00Z
- **Tasks:** 2 (both `tdd="true"`)
- **Files:** 1 created, 2 modified

## Accomplishments

- **Authed landing repointed to `/home` (SHELL-06 / D-23)** — both decision points the RESEARCH (A4) identified are now `/home`:
  - **`middleware.ts`** — the authed-off-auth-page redirect now targets `new URL("/home", request.url)` (was `/analyze`); the `/dashboard` sunset 308 now targets `/home` (was `/analyze`).
  - **`auth/callback/route.ts`** — the default destination is now `?? "/home"` (was `?? "/dashboard"`, which itself 308-redirected to `/analyze`). The `/welcome` first-time-user branch still takes precedence; `next` is resolved same-origin via `new URL(next, origin)`.
- **`/home` auth-gated twice (defense-in-depth, T-04-02 Spoofing)** — added `/home` to `PROTECTED_PREFIXES`, so an unauthenticated `/home` hit redirects to `/login` with the deep link preserved (`?next=/home`), on top of the `(app)` layout `getUser()` gate from 01-03. `/home` is NOT in `PUBLIC_PATHS`.
- **Fixed the dead authed-auth-page redirect (latent bug, Rule 1/3)** — the existing `if (user && (pathname === "/login" || "/signup")) -> /analyze` branch was **unreachable**: `/login` & `/signup` are public, so the L62 public-path fast-return (`next()` for public paths without `?ref`) and the L116 public-skip both short-circuited before it. A signed-in user hitting `/login` was therefore NOT redirected by middleware at all. Added an `AUTH_PAGES` carve-out so `/login` & `/signup` flow through `getUser()`, and moved the authed-redirect ahead of the public-skip — making the plan's stated behavior ("hitting an auth page while signed in is sent to /home") actually true. Anonymous visitors to `/login`/`/signup` still see the page (the redirect gates on `user &&`, then the public-skip returns `supabaseResponse`).
- **`/analyze` left dormant-but-reachable (D-23)** — `/analyze` stays in `PROTECTED_PREFIXES`; `/analyze` + the IDOR-defended `/analyze/[id]` permalink are untouched. The production build confirms both still emit (`ƒ /analyze`, `ƒ /analyze/[id]`).
- **Open-redirect guard preserved (T-04-01)** — every redirect Location is same-origin by construction (`new URL(path, request.url|origin)` / `request.nextUrl.clone()`); the user-supplied `next` is only ever resolved via `new URL(next, origin)`, never followed as an absolute external URL. The landing test asserts the redirect host equals the request host.
- **Landing test (first Supabase-SSR-mocked middleware unit test in the repo)** — authored `middleware.landing.test.ts` first (RED against the current `/analyze` landing), then made it green: 4 tests — authed `/login` -> `/home`, authed `/signup` -> `/home`, unauthenticated `/home` -> `/login` (with `?next=/home`), and same-origin on both redirects. It mocks `@supabase/ssr`'s `createServerClient` (controllable `getUser`, stubbed `.from()` chain) and drives the real `updateSession` with a genuine `NextRequest` (next/server runs under vitest, verified by a throwaway probe).
- **Full regression + build green** — scoped suite green (20/20: 4 landing + the 16 home/composer from 01-03, proving the routing change didn't break the home); full suite **1945 passed / 26 skipped / 0 failed** (185 files); `pnpm run build` exits 0 and emits `ƒ /home`, `ƒ /auth/callback`, `ƒ Proxy (Middleware)`, `ƒ /analyze`, `ƒ /analyze/[id]`. Both edited source files type-check with **0** `tsc --noEmit` errors.

## Task Commits

Each task committed atomically (TDD: RED then GREEN):

1. **Task 1: Wave-0 landing test (RED)** — `0474093b` (`test`) — `middleware.landing.test.ts`; 4 tests fail against the current `/analyze` landing (and `/home` not yet protected) until Task 2 lands.
2. **Task 2: Repoint landing -> /home (GREEN)** — `1b9616f2` (`feat`) — middleware (`/home` in PROTECTED_PREFIXES, authed-auth-page redirect repointed + made reachable, `/dashboard` 308 retargeted) + auth callback default `/home`; landing test green (4/4), full suite green, build emits `ƒ /home`.

**Plan metadata:** final `docs(01-04)` commit (this SUMMARY + STATE + ROADMAP + REQUIREMENTS + deferred-items note).

## Files Created/Modified

- `src/lib/supabase/__tests__/middleware.landing.test.ts` — **Created.** SHELL-06/D-23 landing-redirect guard (4 tests). Mocks `@supabase/ssr` `createServerClient` (controllable `getUser` + inert `.from()` chain) + `@/lib/referral/constants`; drives the real `updateSession` with a `NextRequest`; asserts authed-on-auth-page -> `/home`, unauthenticated-`/home` -> `/login` (deep link), and same-origin on both. ~130 lines.
- `src/lib/supabase/middleware.ts` — **Modified.** Added `/home` to `PROTECTED_PREFIXES` + an `AUTH_PAGES` const; `/dashboard` sunset 308 target `/analyze` -> `/home`; `AUTH_PAGES` carve-out on the public-path fast-return; moved the authed-auth-page redirect ahead of the public-skip and repointed it `/analyze` -> `new URL("/home", request.url)`. Same-origin pattern preserved throughout.
- `src/app/auth/callback/route.ts` — **Modified.** Default `next` `?? "/dashboard"` -> `?? "/home"` (D-23). `/welcome` first-time precedence + `new URL(redirectTo, origin)` same-origin redirect intact; added an open-redirect-guard comment on the `next` resolution.

## Decisions Made

- **Made the authed-auth-page redirect reachable (not just renamed):** see the "dead code" accomplishment above. The plan asked to "repoint the L130-131 redirect"; taken literally that is a one-line rename of an unreachable branch, which would NOT make the plan's truth ("an authenticated user … hitting an auth page while signed in is sent to /home") hold. RESEARCH C15 even noted "no explicit land-on-/analyze after login beyond the auth-page redirect" without catching that the auth-page redirect itself was shadowed. The minimal, same-origin fix (an `AUTH_PAGES` carve-out + reordering the redirect before the public-skip) makes the behavior real. Treated as Rule 1 (auto-fix bug: stated behavior absent) + Rule 3 (blocking: the test could not pass otherwise).
- **Both decision points + the `/dashboard` 308 repointed:** middleware authed-auth-page redirect AND `auth/callback` default AND the `/dashboard` sunset 308 all now land on `/home` — so every authed path to a landing converges on `/home` (D-23), with `/welcome` still preceding for first-time users.
- **`/analyze` kept in `PROTECTED_PREFIXES`:** dormant-but-reachable per D-23 — still auth-gated, still the `/analyze/[id]` permalink host, IDOR defense untouched.
- **`next/server` not mocked in the test:** `NextRequest`/`NextResponse` run under vitest (verified by a throwaway probe before authoring), so the test exercises the real redirect machinery and can assert the actual `Location` host (same-origin) rather than a mock's return.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug / Rule 3 - Blocking] The authed-auth-page redirect was dead code; made it reachable**
- **Found during:** Task 1 (the RED test returned a `null` Location for the authed `/login` case instead of the expected `/analyze` redirect; a throwaway probe confirmed authed `/login` returned status 200 with no Location under the current middleware).
- **Issue:** The `if (user && (pathname === "/login" || "/signup")) -> redirect /analyze` branch (orig. L130-131) was unreachable. `/login` & `/signup` are in `PUBLIC_PATHS`, so the public-path fast-return (orig. L62, `next()` for public paths without `?ref`) and the public-skip (orig. L116) both short-circuited before the branch. A signed-in user hitting an auth page was NOT redirected by middleware. The plan's truth #1 ("hitting an auth page while signed in is sent to /home") and Task 1's required test could not hold against a pure rename.
- **Fix:** Added an `AUTH_PAGES = ["/login", "/signup"]` const; excluded auth pages from the public-path fast-return (`!isAuthPage`); moved the authed-auth-page redirect to run immediately after `getUser()`, BEFORE the public-skip, and repointed it to `new URL("/home", request.url)`. Anonymous auth-page visitors still see the page (the redirect gates on `user &&`; the public-skip then returns `supabaseResponse`). Same-origin preserved.
- **Files modified:** `src/lib/supabase/middleware.ts`
- **Commit:** `1b9616f2`

(The `/dashboard` sunset 308 retarget `/analyze` -> `/home` is in-scope per the plan's `<action>` — "point its target at /home … /dashboard stays sunset, just lands on the new home" — not a deviation.)

## Authentication Gates

None. No auth gate was hit during execution (this plan EDITS the auth-gate logic; it does not require interactive authentication to run). The middleware/callback changes are exercised by the mocked unit test + the production build, both run non-interactively.

## Out-of-Scope Discoveries (deferred, not fixed)

- **Pre-existing `tsc --noEmit` type drift in engine/board test fixtures (12 errors):** re-confirmed unchanged from plan 01-02's D2 — all in `src/lib/engine/**/__tests__/*` + `src/components/board/verdict/__tests__/fixtures/*` (the FROZEN engine area), none overlapping this plan's diff. This plan's three files type-check with 0 errors. Logged in `.planning/phases/01-foundation-shell/deferred-items.md` (D2, re-confirmed note). NOT fixed — out of scope per the executor scope-boundary rule + the engine-frozen milestone constraint. No runtime/test-suite impact (vitest runs via esbuild; full suite green).
- **Pre-existing `ECONNREFUSED :3000` integration test:** one full-suite test attempts to reach a dev server on port 3000 and logs a connection error, but is handled gracefully (counted as passing, not a failure). Unrelated to the landing repoint; pre-dates this plan.

## Threat Flags

None. This plan introduces no new network endpoint, schema, or external surface. It EDITS the existing auth gate (the highest-care surface of the phase, already in the plan's `<threat_model>`):
- **T-04-01 (open redirect)** — mitigated and preserved: all redirects are same-origin by construction (`new URL(path, request.url|origin)` / `.clone()`); the user-supplied `next` is only resolved via `new URL(next, origin)`. The landing test asserts the redirect host equals the request host.
- **T-04-02 (auth bypass)** — mitigated: `/home` is auth-gated twice (the `(app)` layout `getUser()` gate + the new `PROTECTED_PREFIXES` entry); an unauthenticated `/home` hit redirects to `/login`, asserted by the test. `/home` is NOT in `PUBLIC_PATHS`.
- **T-04-03 (IDOR on the permalink)** — unchanged: `/analyze/[id]` + its `.eq user_id` defense are untouched by the landing repoint.
- **T-04-SC (supply chain)** — N/A: zero package installs (the test reuses Vitest + the existing mocks; no new dependency).

## User Setup Required

None — no external service configuration. The landing repoint is exercised by the mocked unit test + the production build (both non-interactive). The behavior the human will see at the THEME-06 gate (plan 01-05) is that a signed-in user now actually lands on `/home` (rather than `/analyze`) — i.e. the reviewed shell is the one users hit.

## Next Phase Readiness

- **SHELL-06 loop closed:** a signed-in user lands on `/home` (both middleware + callback repointed, same-origin, `/home` auth-gated); reopening a past Simulation still restores via the kept `/analyze/[id]` permalink (untouched). The 01-03 composer's submit -> create -> navigate-to-`/analyze/[id]` seam now sits behind a `/home` landing that users actually reach.
- **Seam to 01-05 (THEME-06 UAT gate):** the empty `/home` (serif greeting + composer + stele) is now the genuine post-login destination — the human reviews the shell users actually land on, not a side route. The flat-warm hues / serif / greeting copy stay `[UAT]`, signed at the gate.
- **Seam to Phase 2:** untouched — the permalink restore (`usePermalinkAnalysis` + `/api/analysis/[id]`) and the bottom-pinned composer on `/analyze/[id]` are reached the same way; Phase 2 renders the thread above the composer.
- **No follow-up debt from this plan** beyond the pre-existing, already-logged engine-test `tsc` drift (deferred-items D2).

## Self-Check: PASSED

- `src/lib/supabase/__tests__/middleware.landing.test.ts` — FOUND (created; 4 tests; asserts `/home` landing + `/login` redirect for unauthenticated `/home` + same-origin).
- `src/lib/supabase/middleware.ts` — FOUND (modified; `"/home"` in PROTECTED_PREFIXES, authed-auth-page redirect -> `new URL("/home", request.url)`, `/dashboard` 308 -> `/home`, `AUTH_PAGES` carve-out).
- `src/app/auth/callback/route.ts` — FOUND (modified; default `next` `?? "/home"`, no `?? "/dashboard"` remains).
- Commit `0474093b` (Task 1, RED test) — FOUND in git log.
- Commit `1b9616f2` (Task 2, GREEN repoint) — FOUND in git log.
- `npx vitest run src/lib/supabase` — 4/4 landing tests pass (verified).
- Full suite `npx vitest run` — 1945 passed / 26 skipped / 0 failed (verified).
- `pnpm run build` — exits 0; `ƒ /home`, `ƒ /auth/callback`, `ƒ Proxy (Middleware)`, `ƒ /analyze`, `ƒ /analyze/[id]` all emitted (verified — /analyze dormant-but-reachable, not deleted).
- `tsc --noEmit` on the 3 plan files — 0 errors (the 12 reported errors are pre-existing engine/fixture debt outside this diff — deferred-items D2).

---
*Phase: 01-foundation-shell*
*Completed: 2026-06-13*
