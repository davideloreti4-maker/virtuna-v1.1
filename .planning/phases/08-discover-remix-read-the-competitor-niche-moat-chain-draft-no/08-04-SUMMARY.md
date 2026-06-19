---
phase: 08-discover-remix-read-the-competitor-niche-moat-chain
plan: 04
subsystem: api
tags: [audience-steer, qwen, flash-sim, remix, hooks, script, chat, regression-gate]

# Dependency graph
requires:
  - phase: 07-audience-manager
    provides: "Audience domain object, resolveAudienceWeights, buildAudienceGroundingLine, getAudience/GENERAL_AUDIENCE, per-thread active_audience_id pin"
  - phase: 08-01
    provides: "W0 persona-bias lock (DEFAULT no-op regression gate anchor)"
provides:
  - "audience steer on remix/hooks/script/chat runners (replicating the shipped 07-04 ideas-runner shape)"
  - "per-thread active audience wiring in the four tool routes (remix/run, hooks, script, chat)"
  - "remix-card as-your-{audience} steer tag (D-03) + optional audienceName prop on RemixCardBlockSchema"
  - "consolidated steer-closure regression test (General no-op byte-identical; calibrated steer engaged)"
affects: [08-05, 08-06, discover-remix-read-chain, audience-steer-everywhere]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Position-1 STEER replication: optional audience field → buildAudienceGroundingLine + resolveAudienceWeights + audienceRepaint→runFlashTextMode, copied verbatim from ideas-runner across four runners"
    - "Per-thread audience load: openThread.active_audience_id (NULL=General, no DB query) → getAudience fallback GENERAL_AUDIENCE, after auth+thread before runner call"

key-files:
  created:
    - "src/lib/tools/runners/__tests__/steer-closure.test.ts"
  modified:
    - "src/lib/tools/runners/remix-runner.ts"
    - "src/lib/tools/runners/hooks-runner.ts"
    - "src/lib/tools/runners/script-runner.ts"
    - "src/lib/tools/runners/chat-runner.ts"
    - "src/app/api/tools/remix/run/route.ts"
    - "src/app/api/tools/hooks/route.ts"
    - "src/app/api/tools/script/route.ts"
    - "src/app/api/tools/chat/route.ts"
    - "src/lib/tools/blocks.ts"
    - "src/components/thread/remix-card-block.tsx"

key-decisions:
  - "Chat/script steer the generation by folding the audience-grounding line into assembleBundle.overrides (chat has no Flash path); remix/hooks/script feed the audienceRepaint map into runFlashTextMode where they score"
  - "General/null audience injects no override and omits the audienceRepaint arg → byte-identical no-op; ENGINE_VERSION stays 3.19.0 (no bump)"
  - "remix REMIX-01 niche derives `{profileNiche} · {audience.name} (goal_label)` for a calibrated audience (Audience has no niche field); profile niche alone for General"
  - "remix-card audienceName prop is optional + omitted for General → renderer shows no tag (regression-safe no-op); tag is text-muted, never coral (one-coral law)"

patterns-established:
  - "Steer-closure test asserts, per runner, that General/null calls Flash without audienceRepaint and a calibrated audience supplies the per-archetype repaint + analysis_override"

requirements-completed: [REMIX-01, AUD-STEER]

# Metrics
duration: 10min
completed: 2026-06-19
---

# Phase 8 Plan 04: Steer-Everywhere Closure + Audience-Steered Remix Summary

**Closed the position-1 STEER debt: remix/hooks/script/chat now generate FOR the active calibrated audience (audience-grounding line + persona repaint into Flash) while General stays a byte-identical DEFAULT no-op, plus the remix card's as-your-{audience} tag — engine regression gate green, ENGINE_VERSION 3.19.0.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-19T08:37:18Z
- **Completed:** 2026-06-19T08:46:43Z
- **Tasks:** 3
- **Files modified:** 10 (+1 created)

## Accomplishments
- All four remaining runners (remix/hooks/script/chat) accept an optional `audience` and steer generation on it, replicating the shipped 07-04 ideas-runner import-and-input shape exactly (no new pattern invented).
- All four tool routes load the per-thread `active_audience_id` (NULL=General, no DB query) via `getAudience` with a safe `GENERAL_AUDIENCE` fallback, feeding the audience into the steered runner.
- Remix card surfaces the steer with a muted `as your {audience}` tag for calibrated audiences; General renders byte-identically (no tag, one-coral law preserved).
- New `steer-closure.test.ts` asserts the General no-op (no `audienceRepaint`, no `analysis_override`) and the calibrated steer (repaint map + `analysis_override`) per runner; the existing `audience-regression-gate` suite stays green (ENGINE_VERSION 3.19.0).

## Task Commits

Each task was committed atomically (Task 1 is TDD: test → feat):

1. **Task 1 (TDD RED): failing steer-closure test** - `d2688c9` (test)
2. **Task 1 (TDD GREEN): steer four runners** - `846432b` (feat)
3. **Task 2: wire active audience into four routes** - `7dc0f40` (feat)
4. **Task 3: remix card as-your-{audience} tag** - `fbdc064` (feat)
5. **Task 1 follow-up: valid Archetype slugs in test fixture** - `b282978` (fix)

## Files Created/Modified
- `src/lib/tools/runners/remix-runner.ts` - audience field + buildAudienceGroundingLine + resolveAudienceWeights + audienceRepaint→Flash + REMIX-01 adapt niche + audienceName card prop
- `src/lib/tools/runners/hooks-runner.ts` - audience field + grounding line (folded into overrides) + repaint→Flash
- `src/lib/tools/runners/script-runner.ts` - audience field + grounding line (overrides) + repaint→opener Flash
- `src/lib/tools/runners/chat-runner.ts` - audience field + grounding line folded into assembleBundle.overrides (no Flash path)
- `src/app/api/tools/remix/run/route.ts` - per-thread audience load → runner
- `src/app/api/tools/hooks/route.ts` - per-thread audience load → runner
- `src/app/api/tools/script/route.ts` - per-thread audience load → runner
- `src/app/api/tools/chat/route.ts` - per-thread audience load → runner
- `src/lib/tools/blocks.ts` - optional `audienceName` on RemixCardBlockSchema.props
- `src/components/thread/remix-card-block.tsx` - muted `as your {audience}` tag near the adapted-hook headline
- `src/lib/tools/runners/__tests__/steer-closure.test.ts` - per-runner no-op vs calibrated-steer gate

## Decisions Made
- **Chat/script generation steer = assembleBundle.overrides:** chat runs no Flash, and script/chat ground via the assembler (not a card grounding-line), so the audience-facing line is folded into the (fenced) `overrides` channel for a calibrated audience; General → undefined override (byte-identical). remix/hooks/script also feed the per-archetype `audienceRepaint` into `runFlashTextMode` (their scoring path).
- **REMIX-01 niche:** the `Audience` domain object carries no niche field, so the calibrated adapt niche is composed as `{profileNiche} · {audience.name} (goal_label)`; General keeps the profile niche alone.
- **No-op guarantee:** General/null injects no `analysis_override` and omits the `audienceRepaint` arg; `ENGINE_VERSION` untouched at 3.19.0 (verified by the regression gate + grep).

## Deviations from Plan
None - plan executed exactly as written. All three tasks implemented per the 07-04 reference shape with no architectural changes.

## Issues Encountered
- The new test fixture initially typed `CalibratedPersona.archetype` with `Disposition` values (`skeptic`/`converter`) — the field is the strict `Archetype` union. Swapped to valid slugs (`tough_crowd`/`niche_deep_buyer`); runtime tests already passed (vitest doesn't typecheck), fix cleared the 2 tsc errors in the new file (`b282978`).
- ~43 pre-existing tsc errors remain in unrelated TEST files (e.g. `messages.test.ts`, `hooks-runner.test.ts` `user_id`-on-ProfileRow). Out of scope (scope boundary) — logged to `deferred-items.md`; runtime test suite is green (2695 passed).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- W2 steer closure complete: every generation skill (ideas + remix/hooks/script/chat) now generates FOR the active calibrated audience; the half-moat (predict-for-audience, generate-for-generic) is closed.
- Audience-steered Remix is ready for the Discover→Remix→Read chain (08-05/08-06).
- No blockers. Engine regression gate green (ENGINE_VERSION 3.19.0).

## Self-Check: PASSED

All 12 created/modified files present on disk; all 5 task/fix commits present in git history.

---
*Phase: 08-discover-remix-read-the-competitor-niche-moat-chain-draft-no*
*Completed: 2026-06-19*
