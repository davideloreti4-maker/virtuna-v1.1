---
phase: 13-ambient-numen
plan: 01
subsystem: api
tags: [flash-text-mode, sim1, niche-resolution, type-to-room, reaction-route, zod, supabase]

# Dependency graph
requires:
  - phase: 03-ideas-tool
    provides: ideas-runner inline niche-panel + audience-repaint construction (the source of the lifted helper)
  - phase: 04-hooks-tool
    provides: hooks-runner inline niche-panel + audience-repaint construction (byte-identical second copy)
  - phase: 07-audience-manager
    provides: Audience type, getAudience/GENERAL_AUDIENCE, active_audience_id per-thread pin, audienceRepaint
  - phase: 14-kc-grounding-quality-loop
    provides: resolveNicheKey (14-01) — the runner-layer niche normalization the helper wraps
provides:
  - "buildReactionPanel(profileRow, audience) → { panel, audienceRepaint } — shared niche-resolution + repaint helper (one source for ideas-runner, hooks-runner, and the new react route)"
  - "POST /api/tools/react — the thin type-to-room reaction route; returns { fraction, scrollQuote } from one Flash text-mode call; the ONLY new model-calling code in Phase 13"
affects: [13-02-card-reaction-at-rest, 13-03-ambient-presence, 13-04-use-ambient-focus, ambient-numen, type-to-room]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared reaction-panel helper: lift byte-identical inline niche/repaint construction out of N runners into one buildReactionPanel so every Flash-reaction call site discriminates identically (resolves the niche-blind Pitfall once, not per-call-site)"
    - "Thin reaction route: auth-first (CR-01) → Zod body → server-resolved audience off the open thread → shared panel helper → runFlashTextMode → aggregateFlash → JSON { fraction, scrollQuote }; whole (no streaming), ephemeral (no persistence)"
    - "Reaction route NEVER reuses the markdown chat route (Pitfall 1) and NEVER trusts a body audience id (CR-01)"

key-files:
  created:
    - src/lib/engine/flash/build-reaction-panel.ts
    - src/app/api/tools/react/route.ts
    - src/lib/engine/flash/__tests__/build-reaction-panel.test.ts
    - src/app/api/tools/react/__tests__/route.test.ts
  modified:
    - src/lib/tools/runners/ideas-runner.ts
    - src/lib/tools/runners/hooks-runner.ts

key-decisions:
  - "buildReactionPanel reproduces the runners' inline logic byte-for-byte (panel = { niche: resolveNicheKey(profileRow?.niche_primary ?? null), contentType: null }; audienceRepaint = archetype→repaint map or undefined for General/no-audience/empty-personas) so refactoring the runners onto it changes nothing the model sees"
  - "resolveAudienceWeights stays OUT of the helper — it is `void resolvedWeights` (dead-wired for the future Max path) in both runners, not part of the Flash text reaction path; left untouched"
  - "react route default framing = 'hook' (RESEARCH A1, first-2s 'do you stop?', matching every card-level reaction); framing is an optional one-arg override ('idea')"
  - "selectLeadScrollQuote inline-copied into the route (RESEARCH A4 — it is private per-runner, not exported; the 4-runner precedent duplicates it)"
  - "audience resolved server-side off thread.active_audience_id via getAudience (CR-01); the body carries no audience id (a body audienceId is ignored)"
  - "no ENGINE_VERSION bump (text/Flash path + a route, zero video-scoring bytes — stays 3.19.0); no persistence (type-to-room is ephemeral, RESEARCH Open Q3 default)"

patterns-established:
  - "Pattern: one shared buildReactionPanel feeds all three Flash-reaction call sites (ideas-runner, hooks-runner, /api/tools/react) — niche discrimination is wired identically, never re-implemented"
  - "Pattern: thin honest reaction endpoint — JSON { fraction, scrollQuote }, Flash failure → 502 { error: reaction_failed } (client renders retry copy, never error-red)"

requirements-completed: [AMBIENT-01]

# Metrics
duration: 7min
completed: 2026-06-20
---

# Phase 13 Plan 01: Type-to-Room Reaction Route + Shared buildReactionPanel Helper Summary

**`POST /api/tools/react` fires one SIM-1 Flash text-mode reaction for an ad-hoc thought and returns real `{ fraction, scrollQuote }`, niche-discriminating via a new `buildReactionPanel` helper that both skill runners now share byte-identically — ENGINE_VERSION stays 3.19.0.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-06-20T20:52:24Z
- **Completed:** 2026-06-20T21:00:00Z
- **Tasks:** 2 (both TDD: RED → GREEN)
- **Files modified:** 6 (4 created, 2 refactored)

## Accomplishments
- **Shared `buildReactionPanel(profileRow, audience)` helper** — lifted the byte-identical niche-resolution (`resolveNicheKey`) + audience-repaint construction that `ideas-runner.ts` (L284-300) and `hooks-runner.ts` (L313-326) each duplicated inline; both runners now consume it with byte-identical output (resolves RESEARCH Open Q1).
- **`POST /api/tools/react`** — the thin type-to-room reaction route and the ONLY new model-calling code in Phase 13: auth-first → Zod body → server-resolved audience → shared panel → `runFlashTextMode` → `aggregateFlash` + lead stop quote → `{ fraction, scrollQuote }`. Niche-discriminating (Pitfall 2 closed), not the markdown chat route (Pitfall 1 avoided), not body-trusted (CR-01).
- **Regression-clean:** both runner suites unchanged (ideas 10, hooks 14), new helper test (7), new route test (7); full Flash + runners + react suites green (179 passed, 2 DASHSCOPE-gated skipped); `npm run build` OK; ENGINE_VERSION 3.19.0.

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1 (RED): failing test for buildReactionPanel** - `ba167573` (test)
2. **Task 1 (GREEN): extract buildReactionPanel; refactor both runners** - `d71b0b50` (feat)
3. **Task 2 (RED): failing tests for POST /api/tools/react** - `761c8c02` (test)
4. **Task 2 (GREEN): POST /api/tools/react reaction route** - `1a83448c` (feat)

_TDD tasks have two commits each (test → feat); no REFACTOR commit needed — both implementations were clean as written._

## Files Created/Modified
- `src/lib/engine/flash/build-reaction-panel.ts` - **(created)** Exports `buildReactionPanel(profileRow, audience) → { panel, audienceRepaint }`. `panel = { niche: resolveNicheKey(profileRow?.niche_primary ?? null), contentType: null }`; `audienceRepaint` = archetype→repaint map (undefined for General/no-audience/empty-personas → byte-identical Flash no-op). `resolveAudienceWeights` intentionally excluded.
- `src/app/api/tools/react/route.ts` - **(created)** `POST` — the type-to-room reaction route. Returns `{ fraction, scrollQuote }`; 401 unauth, 400 empty/whitespace, 502 on Flash failure. No streaming, no persistence.
- `src/lib/engine/flash/__tests__/build-reaction-panel.test.ts` - **(created)** 7 tests: niche resolution, calibrated/General/null/empty-personas repaint paths, byte-identical-to-inline invariant.
- `src/app/api/tools/react/__tests__/route.test.ts` - **(created)** 7 tests: auth, Zod boundary (no Flash call), happy path, resolved-panel wiring (Pitfall 2), server-side audience resolution (CR-01, body id ignored), 502.
- `src/lib/tools/runners/ideas-runner.ts` - **(modified)** Inline panel/repaint construction replaced by `buildReactionPanel(profileRow, audience)`; `resolveNicheKey` import dropped; `void resolvedWeights` left as-is.
- `src/lib/tools/runners/hooks-runner.ts` - **(modified)** Same refactor, byte-identical output preserved.

## Decisions Made
- **Byte-identical lift, not a redesign:** the helper reproduces the runners' exact inline logic so the model sees nothing different — the only safe way to refactor a regression-gated text path.
- **Weights stay out of the helper:** `resolveAudienceWeights` is dead-wired (`void resolvedWeights`) for the future Max path in both runners; the Flash text path uses only the repaint, so the helper covers only `{ panel, audienceRepaint }`.
- **Default framing `"hook"`** (RESEARCH A1) with an optional `"idea"` override; **`selectLeadScrollQuote` inline-copied** into the route (RESEARCH A4 — private per-runner, 4-runner precedent).
- **Server-resolved audience (CR-01):** `thread.active_audience_id → getAudience`; a body `audienceId` is never trusted (a test asserts a body-supplied attacker id is ignored).
- **No ENGINE_VERSION bump, no persistence:** text/Flash path only (3.19.0 unchanged); type-to-room is ephemeral (RESEARCH Open Q3).

## Deviations from Plan

None - plan executed exactly as written.

Both tasks followed the plan's TDD `<behavior>` and `<acceptance_criteria>` precisely. No Rule 1-4 deviations were needed; no architectural decisions arose.

## Issues Encountered
- **Pre-existing tsc errors in two runner TEST files** (`ideas-runner.test.ts` L144/L426, `hooks-runner.test.ts` L141/L173/L577) — fixtures pass a `user_id` field on `ProfileRow` (no such field) + an index access TS narrows to possibly-undefined. Last touched in commit `e3f82e94` (Phase 14-02), predating this plan; the tests PASS at runtime (vitest), only `tsc --noEmit` flags them. Falls under STATE.md's documented pre-existing tsc baseline. **Out of scope** per the executor scope boundary — logged to `deferred-items.md`, not fixed (I did not modify those test files).

## User Setup Required

None - no external service configuration required. The route reuses the existing Supabase auth + Qwen (`FLASH_MODEL`) infrastructure already configured for the shipped skill routes.

## Next Phase Readiness
- **Wave 1 anchor done.** The phase's only new server surface (`buildReactionPanel` + `POST /api/tools/react`) is shipped and tested. Wave 2+ plans (13-02 `CardReactionAtRest`, 13-03 `AmbientPresence` + type-to-room input, 13-04 `useAmbientFocus`) are pure client work that consume this route's `{ fraction, scrollQuote }` shape via `cardScrollQuoteReactions` → spotlight + Lens.
- **No blockers.** ENGINE_VERSION 3.19.0 held; engine/KC regression surface untouched (text path only); build green.

## Self-Check: PASSED

- Created files exist: `build-reaction-panel.ts`, `react/route.ts`, both test files — all FOUND.
- Commits exist: `ba167573`, `d71b0b50`, `761c8c02`, `1a83448c` — all in `git log`.

---
*Phase: 13-proactive-numen-ambient-initiated-expansion-the-ambient-audi*
*Completed: 2026-06-20*
