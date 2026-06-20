---
phase: 11-explore-audience-curated-discovery
plan: 03
subsystem: api
tags: [supabase, zod, watchlist, tracked-accounts, rls, csrf, vitest, tdd]

# Dependency graph
requires:
  - phase: 11-02
    provides: "tracked_accounts migration (flat table — id, user_id, platform, handle, source_video_id, created_at; UNIQUE(user_id,platform,handle); RLS own-rows-only; platform CHECK tiktok/instagram/youtube)"
  - phase: 10-02
    provides: "shelf-repo.ts / saved_items flat-typed repo idiom (the EXACT template mirrored: SupabaseClient param, zod safeParse, CR-01 session-derived user_id)"
  - phase: 10-04
    provides: "/api/saved route idiom (auth-first getUser 401, repo-delegated validation, 201 create, zod->400 mapping, DELETE ?id=)"
provides:
  - "tracked-accounts-repo.ts — listTrackedAccounts / createTrackedAccount / deleteTrackedAccount (flat-typed watchlist repo, CR-01 session-derived user_id, idempotent upsert, handle normalization)"
  - "/api/tracked-accounts route — POST (write) / GET (list, for P12 Library) / DELETE (remove) — auth-first + csrfGuard on mutating methods"
  - "TrackedAccount + TrackedAccountInput domain types + TrackedAccountInputSchema (zod)"
  - "The Explore watchlist PRODUCER half (EXPLORE-05 / D-08) — live the moment P11 ships"
affects: [11-05, 11-08, 12, P12-library]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Flat-typed watchlist repo mirroring shelf-repo (FLAT — no folders/tags; P12 EXTENDS never reworks)"
    - "Idempotent upsert on a UNIQUE constraint (onConflict 'user_id,platform,handle') so re-tracking is a no-op"
    - "Handle normalization (@-strip + trim + lowercase) at the repo boundary to match the UNIQUE dedupe"
    - "csrfGuard on ALL mutating route methods (POST + DELETE), not only POST — deliberate hardening beyond the /api/saved mirror"
    - "Interim (supabase as any) cast convention for a table not yet in database.types.ts (regen in 11-08)"

key-files:
  created:
    - src/lib/tracked-accounts/tracked-accounts-repo.ts
    - src/app/api/tracked-accounts/route.ts
    - src/lib/tracked-accounts/tracked-accounts-repo.test.ts
  modified: []

key-decisions:
  - "csrfGuard applied to DELETE as well as POST (plan must_haves: 'csrfGuard-protected on the mutating methods') — stronger than the /api/saved mirror, which guards neither; client (11-05) must send Content-Type: application/json on DELETE too."
  - "Test imports the repo via the @/ absolute alias (not a relative ../ import) — the vitest @/ trailing-slash prefix alias fails to resolve a brand-new sibling via relative path; the @/ form resolves deterministically (proven by probe)."
  - "user_id is NEVER in TrackedAccountInput nor read from the body — derived from auth.getUser() inside the repo (CR-01)."

patterns-established:
  - "Pattern: flat watchlist write path = repo (zod + session user_id + idempotent upsert) + thin auth-first route delegating to it"
  - "Pattern: idempotent 'track/save' write via upsert onConflict on the UNIQUE business key (returns existing row, never errors on duplicate)"

requirements-completed: [EXPLORE-05]

# Metrics
duration: 7min
completed: 2026-06-20
---

# Phase 11 Plan 03: Tracked-Accounts Watchlist Write Path Summary

**Flat-typed `tracked-accounts` repo + `/api/tracked-accounts` route (POST/GET/DELETE) — the Explore watchlist PRODUCER half: CR-01 session-derived user_id, idempotent upsert on the UNIQUE constraint, auth-first + csrfGuard, with behaviour locked by an 8-case unit test.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-20T04:07Z (local +02:00)
- **Completed:** 2026-06-20T04:14Z (local +02:00)
- **Tasks:** 2
- **Files created:** 3

## Accomplishments
- `tracked-accounts-repo.ts` — `listTrackedAccounts` / `createTrackedAccount` / `deleteTrackedAccount`, mirroring `shelf-repo.ts` exactly, with two watchlist-specific additions: handle normalization (`@`-strip + lowercase) and an **idempotent upsert** (`onConflict: "user_id,platform,handle"`) so re-tracking the same account returns the existing row instead of erroring on the UNIQUE constraint.
- CR-01 honesty/security spine enforced + proven: `user_id` is derived from `auth.getUser()` inside the repo and is **not** part of the writable input type — a body that smuggles `user_id` is ignored (unit-test asserted).
- `/api/tracked-accounts/route.ts` — POST (201 write), GET (list, the read P12's Library will consume), DELETE (remove by `?id=`); every method 401-gated unauthenticated; **POST + DELETE both csrfGuard-protected**; zod failures map to 400, `unauthenticated` to 401, else 500.
- 8/8 unit tests green; full `tsc --noEmit` clean on repo + route + test; `ENGINE_VERSION` untouched (3.19.0).

## Task Commits

Each task was committed atomically (Task 1 followed the TDD RED→GREEN gate):

1. **Task 1 (TDD RED): failing test for watchlist repo** - `91aeb24` (test)
2. **Task 1 (TDD GREEN): implement tracked-accounts repo** - `1be96f5` (feat)
3. **Task 2: /api/tracked-accounts route** - `4d34d6f` (feat)

_No REFACTOR commit — the repo cleanly mirrored shelf-repo with nothing to clean up._

## Files Created/Modified
- `src/lib/tracked-accounts/tracked-accounts-repo.ts` (142 lines) — flat-typed watchlist repo: domain types `TrackedAccount`/`TrackedAccountInput`, `TrackedAccountInputSchema` (zod), `normalizeHandle`, list/create/delete. `user_id` session-derived (CR-01); idempotent upsert; interim `(supabase as any)` casts until 11-08 types regen.
- `src/app/api/tracked-accounts/route.ts` (139 lines) — POST/GET/DELETE, auth-first, csrfGuard on POST+DELETE, delegates all validation + user_id to the repo. Error mapping mirrors `/api/saved` (zod->400, unauthenticated->401, else 500), `[tracked-accounts]` log prefix.
- `src/lib/tracked-accounts/tracked-accounts-repo.test.ts` (206 lines) — 8 cases: CR-01 (body user_id ignored), unauthenticated throw, handle normalization, invalid-platform throw (400-mappable), idempotent upsert onConflict, list newest-first + error throw, delete by id.

## Decisions Made
- **csrfGuard on DELETE too (not just POST).** The plan's `must_haves.truths` and Task 2 action explicitly require csrfGuard "on the mutating methods" / "POST+DELETE call csrfGuard." The mirror routes (`/api/saved`, `/api/bookmarks`) guard *neither* DELETE — this plan deliberately hardens beyond them. Consequence: the 11-05 client must send `Content-Type: application/json` on its DELETE call (csrfGuard 415s requests without it), same content-type contract as POST. Followed the plan over the looser mirror.
- **`@/` absolute import in the test instead of relative `../`.** See Deviations (Rule 3) — the vitest `@/` trailing-slash prefix alias fails to resolve a newly-created sibling module via a relative path; the `@/lib/tracked-accounts/...` form resolves deterministically.
- **`user_id` excluded from `TrackedAccountInput`** (compile-time CR-01 guard) and never read from the route body — derived only from the session inside the repo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test import path: relative `../` → `@/` absolute alias**
- **Found during:** Task 1 (TDD GREEN — making the committed RED test pass)
- **Issue:** The RED test imported the repo as `"../tracked-accounts-repo"`. Vitest failed the whole suite with `Cannot find module '../tracked-accounts-repo'` *even after* the repo `.ts` existed on disk and typechecked clean. Root cause isolated with a probe test: the vitest config's `@/` alias is a trailing-slash **prefix** alias (`"@/": .../src/`), and a relative sibling import from a brand-new directory under that aliased root fails to resolve, while the `@/lib/...` absolute form resolves deterministically (probe: exit 0, 1/1 pass).
- **Fix:** Changed the test import to `@/lib/tracked-accounts/tracked-accounts-repo` (the codebase-wide absolute-alias convention). Committed as part of the GREEN commit.
- **Files modified:** src/lib/tracked-accounts/tracked-accounts-repo.test.ts
- **Verification:** 8/8 tests pass (`success: true`).
- **Committed in:** `1be96f5` (Task 1 GREEN commit)

**2. [Rule 1 - Bug] Strict-mode TS2532 on mock `.calls` tuple access in the test**
- **Found during:** Task 2 (running the full project `tsc --noEmit` as overall verification)
- **Issue:** Three test assertions read `(...).mock.calls[0][0]` / `[0][1]`; under the project's strict TS config the tuple element `calls[0]` is `possibly 'undefined'` → 3× `TS2532`, breaking the project-wide typecheck (the plan keeps `tsc` clean).
- **Fix:** Added a `!` non-null assertion on `.mock.calls[0]!` at the three sites (the upsert was already asserted called, so the call exists).
- **Files modified:** src/lib/tracked-accounts/tracked-accounts-repo.test.ts
- **Verification:** `tsc --noEmit` clean on all three tracked-accounts files; tests still 8/8 green.
- **Committed in:** `4d34d6f` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking module-resolution, 1 strict-mode type bug)
**Impact on plan:** Both confined to the test file (my own new code), necessary to make the suite run + keep `tsc` clean. No scope creep, no change to the repo/route surface the plan specified.

## Issues Encountered
- The `Cannot find module` failure (above) initially looked like a stale vitest cache; cleared `.vite`/`.vitest` cache + `--no-cache` did not fix it. A focused probe test using the `@/` alias isolated it to relative-vs-alias resolution, not caching. Resolved by switching to the absolute alias.

## Known Stubs
None — the repo writes real `tracked_accounts` rows and the route delegates to it; no hardcoded empty values, no placeholder text. (The table is not yet applied to the live DB — that is the planned 11-08 BLOCKING wave, not a stub; the `(supabase as any)` cast is the documented interim convention until the 11-08 types regen.)

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- **11-05** can wire the result tile's "+ Track account" button to `POST /api/tracked-accounts` with `{ platform, handle, source_video_id? }`. Reminder: send `Content-Type: application/json` (csrfGuard) — and on any DELETE call too.
- **11-08** (BLOCKING) must: (a) push the `tracked_accounts` migration to the live DB, (b) regenerate `src/types/database.types.ts`, then (c) drop the interim `(supabase as any)` casts in `tracked-accounts-repo.ts` (3 sites: list/create/delete).
- **P12 Library** consumes `GET /api/tracked-accounts` (returns `{ accounts }`, newest-first) with no rework — the table + repo + route are flat + typed + Library-compatible (D-08).

## Self-Check: PASSED

All created files present on disk; all 3 task commits present in git history.
- FOUND: src/lib/tracked-accounts/tracked-accounts-repo.ts
- FOUND: src/app/api/tracked-accounts/route.ts
- FOUND: src/lib/tracked-accounts/tracked-accounts-repo.test.ts
- FOUND: 11-03-SUMMARY.md
- FOUND commits: 91aeb243 (test), 1be96f58 (feat), 4d34d6f2 (feat)

## TDD Gate Compliance

Task 1 (`tdd="true"`) followed the RED→GREEN gate: a `test(...)` commit (`91aeb243`, suite failing — `Cannot find module`, expected RED) preceded the `feat(...)` GREEN commit (`1be96f58`, 8/8 passing). No REFACTOR needed.

---
*Phase: 11-explore-audience-curated-discovery*
*Completed: 2026-06-20*
