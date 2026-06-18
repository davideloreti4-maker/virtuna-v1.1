---
phase: 07-audience-manager-calibrated-audience-as-shared-substrate-acr
plan: "05"
subsystem: ui
tags: [audience, calibration, sse, persona-display, composer-chip, per-thread-pin, flat-warm, honesty-spine, app-shell]

requires:
  - phase: 07-02
    provides: GENERAL_AUDIENCE/PRESET_AUDIENCES virtual constants, listAudiences/getAudience shape, sentinel ids
  - phase: 07-03
    provides: GET/POST /api/audiences, GET/PATCH/DELETE /api/audiences/[id], POST /api/audiences/calibrate SSE (status/fallback/error/done)
  - phase: 07-04
    provides: thread.active_audience_id read server-side in ideas route; engine wiring (steer + react)
provides:
  - /audience Manager list page (inside (app) shell)
  - /audience/new + /audience/[id] full-page form + read-only Profile
  - AudienceManager / AudienceForm / AudienceProfileView / CalibrationFlow components
  - composer AudienceChip (pill → dropdown/bottom-sheet) with per-thread pin
  - PATCH /api/threads/[id] (active_audience_id persistence)
  - sidebar Audience NavItem
affects: [07-06]

tech-stack:
  added: []
  patterns:
    - in-shell-content-div (no nested <main> under AppShell)
    - SSE-consume-on-client (calibration status/fallback/error/done)
    - collapsed-pill-picker (desktop dropdown / mobile bottom sheet — sketch-001 grammar)
    - per-thread-pin-via-PATCH (active_audience_id; NULL = General)
    - read-only-by-design (D-03 — DataTable structured to add edit column later)

key-files:
  created:
    - src/app/(app)/audience/page.tsx
    - src/app/(app)/audience/new/page.tsx
    - src/app/(app)/audience/[id]/page.tsx
    - src/components/audience/audience-manager.tsx
    - src/components/audience/audience-form.tsx
    - src/components/audience/audience-profile-view.tsx
    - src/components/audience/calibration-flow.tsx
    - src/components/app/home/audience-chip.tsx
    - src/app/api/threads/[id]/route.ts
  modified:
    - src/components/sidebar/Sidebar.tsx
    - src/components/app/home/composer.tsx

key-decisions:
  - "Audience routes MUST live under (app) route group to inherit AppShell (sidebar, AuthGuard, providers) — outside it they render bare with no auth"
  - "PATCH /api/threads/[id] created (no prior threads/[id] route) to persist the per-thread audience pin; RLS + explicit user_id ownership guard"
  - "Open thread id captured from GET /api/threads/open (returns threadId) in the existing composer mount load — no extra fetch"
  - "Calibration fallback uses --color-warning (never coral, never error), never fabricates personas (D-06 honesty spine)"
  - "AudienceChip selection NULL = General sentinel (matches 07-02 absence-of-id semantics)"

patterns-established:
  - "In-shell pages render a plain content <div> (max-w mx-auto px-4 py-6 sm:p-6) — AppShell owns the <main>"
  - "Page header mirrors competitors page: text-2xl font-medium + flex items-center justify-between"

requirements-completed: [AUD-07]

duration: ~75min
completed: 2026-06-18
---

# Phase 7 Plan 05: Audience Manager UI + Calibration + Composer Chip Summary

**The "see your audience" moat surface shipped: /audience Manager, SSE calibration with honest General fallback, read-only 10-persona Profile (PersonaGraph + stat tiles + DataTable), and a composer audience pill that pins per-thread via PATCH — all flat-warm, mobile-first, inside the (app) AppShell.**

## Performance

- **Duration:** ~75 min (incl. one checkpoint reject/fix cycle)
- **Completed:** 2026-06-18
- **Tasks:** 2 (+ 1 human-verify checkpoint, approved after shell/layout fix)
- **Files created:** 9
- **Files modified:** 2

## Accomplishments

- **Audience Manager** (`/audience`): "Your audiences" header, General card (coral badge + locked-default tooltip, no delete), preset cards, user audience cards with `⋯` overflow menu (edit/delete, `aria-label="Audience options"`), empty-state copy, "Create audience" primary CTA, solid-opaque delete `Dialog` with exact destructive copy.
- **Create/Edit form** (`/audience/new`, `/audience/[id]?edit=1`): full-page (not modal) — name, type segmented (personal/target), platform `Select`, goal label + goal-intent dropdown (deterministic). No persona-edit affordances (D-03).
- **Read-only Audience Profile** (`/audience/[id]`): `PersonaGraph` hero (10 personas, weight←share, tone:'default' — no coral cluster in v1), `StatTileRow` (platform / goal / temperature mix / top dispositions), `DataTable` (Name · Temperature `Badge` · Disposition `Badge` · Share %) built to accept an edit column later, read-only caption.
- **Calibration flow**: Personal (@handle) + Target (describe) paths → POST `/api/audiences/calibrate`, consumes SSE `status`/`fallback`/`error`/`done`. Honest staged status, **mandatory warning-toned fallback** ("Couldn't read enough yet" + "Continue with General", `--color-warning`, never coral/error, never fabricated), distinct error + Retry, transitions to read-only Profile on `done`.
- **Composer audience chip**: single collapsed pill `for {platform} · {name}` under the `showPlatformChip` gating set; desktop dropdown / mobile bottom-sheet picker (sketch-001 grammar); General = neutral, calibrated = coral; "Manage audiences →" footer link. Per-thread pin (D-04) via PATCH `/api/threads/[id]` `active_audience_id` (NULL = General).
- **Sidebar**: "Audience" `NavItem` (`UsersThree`), Settings group above Simulations, collapsed icon + tooltip, active highlight.

## Task Commits

1. **Task 1 + Task 2 implementation** — `466ca711` (captured via auto-checkpoint from the working session: all 11 files — pages, components, chip, threads PATCH route, sidebar + composer wiring)
2. **Shell/layout fix** — `a8d82695` (`fix`) — moved routes into `(app)` group + removed nested `<main>` + matched platform layout (checkpoint-driven, see Deviations)

**Plan metadata:** this commit (`docs: complete plan`)

## Files Created/Modified

- `src/app/(app)/audience/page.tsx` — Manager list page (in-shell content div)
- `src/app/(app)/audience/new/page.tsx` — Create form page
- `src/app/(app)/audience/[id]/page.tsx` — Read-only Profile + edit mode
- `src/components/audience/audience-manager.tsx` — list fetch + cards + delete dialog
- `src/components/audience/audience-form.tsx` — create/edit form, mounts calibration on create
- `src/components/audience/audience-profile-view.tsx` — PersonaGraph + StatTileRow + DataTable (read-only)
- `src/components/audience/calibration-flow.tsx` — SSE calibration, honest fallback
- `src/components/app/home/audience-chip.tsx` — composer pill + picker + per-thread pin
- `src/app/api/threads/[id]/route.ts` — PATCH active_audience_id (new route)
- `src/components/sidebar/Sidebar.tsx` — Audience NavItem
- `src/components/app/home/composer.tsx` — mounted AudienceChip + captured openThreadId

## Decisions Made

- **(app) route group is mandatory** — authed pages must live under `src/app/(app)/` to inherit `AppShell` (sidebar, AuthGuard, providers, content offset). The route group does not change URLs.
- **PATCH /api/threads/[id]** created from scratch (no prior threads/[id] route) to persist the pin; auth-first, RLS + explicit `user_id` ownership guard.
- **openThreadId** captured from the existing `/api/threads/open` mount fetch (it already returns `threadId`) — no extra request.
- **NULL = General** for the pin, matching 07-02's absence-of-active_audience_id semantics.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created PATCH /api/threads/[id] route**
- **Found during:** Task 2 (per-thread pin)
- **Issue:** The plan's key_links assume a PATCH to persist `thread.active_audience_id`, but no `/api/threads/[id]` route existed (only `/api/threads/open`). The chip could not persist the pin without it.
- **Fix:** Added `src/app/api/threads/[id]/route.ts` PATCH handler — auth-first, Zod-validated, RLS-scoped via session client with an explicit `user_id` ownership check.
- **Verification:** tsc clean, lint clean, route used by AudienceChip.handleSelect.
- **Committed in:** `466ca711`

**2. [Checkpoint reject → Rule 1 fix] Audience routes were outside the (app) shell**
- **Found during:** human-verify checkpoint (rejected)
- **Issue:** Routes lived at `src/app/audience/` (outside `(app)`), so pages rendered with NO sidebar, NO AuthGuard (loaded while logged out), NO providers, and a bare centered column on raw background — nothing like the rest of the app. The pages also self-nested a `<main>` (AppShell already renders one → invalid HTML).
- **Fix:** `git mv` all three route files into `src/app/(app)/audience/` (URLs unchanged); removed nested `<main>` wrappers in favor of in-shell content `<div>` matching the settings/competitors convention (`max-w-{4xl,2xl} mx-auto px-4 py-6 sm:p-6 space-y-6`); header restyled to `text-2xl font-medium` + `flex items-center justify-between`.
- **Verification:** Re-UAT passed (sidebar visible, NavItem active, correct offset); tsc 0 new errors; eslint clean on all changed files; `pnpm test` 2642 passed.
- **Committed in:** `a8d82695`

---

**Total deviations:** 2 (1 blocking auto-fix, 1 checkpoint-driven layout fix)
**Impact on plan:** Both essential — the PATCH route is required for the pin to work; the shell move is required for the pages to match the platform. No scope creep.

## Issues Encountered

- A prior session's auto-checkpoint (`chore(auto-wip)` → squashed into `466ca711` history) had already written the component files; re-authoring produced byte-identical content. The implementation commit is therefore lumped (Task 1 + Task 2 together) rather than split. No functional impact.

## Known Stubs / Deferred

- **Full calibration UAT is gated on 07-06's `audiences` migration push.** The `audiences` table is not yet live, so `GET /api/audiences` returns an error and the Manager shows "Couldn't load audiences" — **expected**, not a bug. The list/calibration end-to-end flow becomes testable once 07-06 runs `supabase db push` and regenerates `database.types.ts` (which also lets `(supabase as any)` casts in `audience-repo.ts` + the threads PATCH route be removed).

## Threat Flags

**PATCH /api/threads/[id]** is a new write endpoint at a trust boundary. Mitigations applied:
- Auth-first (401 before any DB access)
- Zod-validated body (`active_audience_id` string|null only)
- RLS-scoped session client + explicit `.eq("user_id", user.id)` ownership guard
- No user_id accepted from the body (CR-01)

No other new surface.

## Next Phase Readiness

- UI surface complete and shell-correct. 07-06 must push the `audiences` migration + regenerate `database.types.ts`, then run the full calibration UAT (create → calibrate → profile / fallback → composer pin).

---
*Phase: 07-audience-manager-calibrated-audience-as-shared-substrate-acr*
*Completed: 2026-06-18*

## Self-Check: PASSED
