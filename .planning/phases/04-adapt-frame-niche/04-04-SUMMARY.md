---
phase: 04-adapt-frame-niche
plan: "04"
subsystem: ui/adapt-frame
tags: [ui, hooks, tanstack-query, adapt, tdd, wave-3, board, mobile]
dependency_graph:
  requires:
    - src/lib/engine/remix/decode-types.ts (AdaptInput, AdaptConcept — plan 04-01)
    - src/lib/engine/remix/decode.fixture.ts (DECODE_FIXTURE — plan 04-01)
    - src/app/api/remix/adapt/route.ts (POST endpoint — plan 04-02)
    - src/components/board/adapt/AdaptConceptCard.tsx (card component — plan 04-03)
    - src/hooks/queries/use-creator-profile.ts (useCreatorProfile, useUpdateCreatorProfile)
    - src/components/app/cards/niche-picker.tsx (NichePicker)
    - src/lib/queries/query-keys.ts (queryKeys.analysis.detail)
  provides:
    - src/hooks/queries/use-adapt-concepts.ts
    - src/components/board/adapt/AdaptFrameBody.tsx
    - src/components/board/adapt/AdaptShellNode.tsx (updated)
    - src/components/board/Board.tsx (camera+layout wiring for AdaptShellNode)
    - src/components/board/BoardMobile.tsx (camera+layout wiring for AdaptShellNode)
  affects:
    - Phase 5 (Develop + Predict) — Adapt frame is now live on both desktop + mobile board
tech_stack:
  added: []
  patterns:
    - Self-sourcing frame body (ContentAnalysisFrame.tsx analog)
    - Dual-read: variants.remix.adapt ?? liveAdaptConcepts (persisted wins on permalink)
    - adaptFiredRef guard (mirrors Board.tsx streamingAnalysisIdRef) — auto-fire once
    - Pitfall 5: await updateProfile.mutateAsync THEN pass niche labels directly (no cache-race)
    - TanStack mutation + cache invalidation (use-creator-profile.ts analog)
key_files:
  created:
    - src/hooks/queries/use-adapt-concepts.ts
    - src/components/board/adapt/AdaptFrameBody.tsx
    - src/hooks/queries/__tests__/use-adapt-concepts.test.ts
  modified:
    - src/components/board/adapt/AdaptShellNode.tsx
    - src/components/board/Board.tsx
    - src/components/board/BoardMobile.tsx
    - src/components/board/adapt/__tests__/AdaptFrameBody.test.tsx
    - src/components/board/adapt/__tests__/AdaptShellNode.test.tsx
key-decisions:
  - "queryKeys.analysis.detail(id) is the correct key (not .byId) — PATTERNS.md had a discrepancy from actual query-keys.ts"
  - "GroupFrameLayout uses bounds: Rect (not w/h) — MOCK_LAYOUT in test fixed accordingly"
  - "AdaptShellNode.test.tsx updated for Phase 4 wiring (Rule 1 auto-fix: old descriptor gone, QueryClient wrapper added)"
  - "Button variant='primary' not 'default' — matched existing ui/button variants"
requirements-completed: [ADAPT-01, ADAPT-02]
duration: ~18 min
completed: 2026-06-02
---

# Phase 04 Plan 04: Adapt Frame Wiring Summary

Self-sourcing `AdaptFrameBody` with dual-read rehydrate, auto-generate-once guard, inline `NichePicker` for empty niche, independent error state, and desktop+mobile mount wiring via updated `AdaptShellNode`, `Board.tsx`, and `BoardMobile.tsx`.

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-02T09:25:00Z
- **Completed:** 2026-06-02T09:43:00Z
- **Tasks:** 2 of 3 (Task 3 is checkpoint:human-verify — paused for manual check)
- **Files modified:** 8

## Accomplishments

- `useAdaptConcepts` TanStack mutation hook: POST /api/remix/adapt, invalidates analysis query on success, luck[] excluded at type level (D-01)
- `AdaptFrameBody` full state machine: niche-prompt → auto-generate → loading skeletons → 3 stacked cards → independent error (role=alert, D-06)
- Dual-read rehydrate: `variants.remix.adapt` from DB wins on permalink reload; `adaptFiredRef` guards against re-generation (D-05, Pitfall 3)
- Inline NichePicker: await `updateProfile.mutateAsync` then pass niche labels directly (Pitfall 5 — no cache-race)
- Desktop + mobile wiring: `Board.tsx` and `BoardMobile.tsx` pass `camera`+`layout` to `<AdaptShellNode>` (D-10)
- Full test coverage: 1804 tests green, 0 fail after all changes

## Task Commits

| Task | Name | Commit | Type |
|------|------|--------|------|
| 1 (RED) | useAdaptConcepts failing tests | 29921dec | test |
| 1 (GREEN) | useAdaptConcepts mutation hook | 67990434 | feat |
| 2 (RED) | AdaptFrameBody failing tests | d60f060a | test |
| 2 (GREEN) | AdaptFrameBody + shell + Board + BoardMobile | afcc9925 | feat |
| 3 | checkpoint:human-verify | — | human gate |

## Files Created/Modified

- `src/hooks/queries/use-adapt-concepts.ts` — TanStack mutation: POST /api/remix/adapt, luck[] excluded, invalidates analysis query
- `src/components/board/adapt/AdaptFrameBody.tsx` — Full state machine (self-sourcing + dual-read + niche-gate + auto-fire-once + error)
- `src/components/board/adapt/AdaptShellNode.tsx` — Wires camera+layout → renders AdaptFrameBody (replaces descriptor)
- `src/components/board/Board.tsx` — Passes camera+layout to AdaptShellNode (line 517)
- `src/components/board/BoardMobile.tsx` — Passes CARD_CAMERA+layout to AdaptShellNode (line 137, D-10)
- `src/hooks/queries/__tests__/use-adapt-concepts.test.ts` — 4 tests green (POST, error throw, invalidation, no-luck)
- `src/components/board/adapt/__tests__/AdaptFrameBody.test.tsx` — 9 tests green (niche-prompt, race-guard, auto-fire, rehydrate-no-regen, error state, decode-absent, 3 smoke)
- `src/components/board/adapt/__tests__/AdaptShellNode.test.tsx` — Updated for Phase 4 (descriptor gone, QueryClient added)

## Decisions Made

- `queryKeys.analysis.detail(id)` is correct (PATTERNS.md referenced `.byId` which doesn't exist in query-keys.ts)
- `GroupFrameLayout.bounds: Rect` (not `w/h/x/y`) — test fixture updated accordingly
- `Button variant="primary"` matches ui/button codebase (not "default")
- `adaptFiredRef` pre-set to `true` when `persistedAdapt` is non-null — safest guard for Pitfall 3 (runs before effects, no async race)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AdaptShellNode.test.tsx: stale descriptor + missing QueryClientProvider**
- **Found during:** Task 2 (running full adapt suite after implementation)
- **Issue:** Plan 01 scaffold tests checked for old static descriptor text ("Niche-adapted concepts drawn from the source format.") and rendered without QueryClientProvider. After Phase 4 wiring, AdaptShellNode renders AdaptFrameBody which uses hooks — causing missing QueryClient errors.
- **Fix:** Updated AdaptShellNode.test.tsx to add all required hook mocks + QueryClientProvider wrapper, replace descriptor-text test with structural checks + verify new AdaptFrameBody content renders.
- **Files modified:** `src/components/board/adapt/__tests__/AdaptShellNode.test.tsx`
- **Verification:** All 6 tests green; full suite 1804 green.
- **Committed in:** afcc9925 (Task 2 commit)

**2. [Rule 1 - Bug] Button variant mismatch**
- **Found during:** Task 2 (tsc --noEmit)
- **Issue:** Used `variant="default"` which is not in the ui/button variant union.
- **Fix:** Changed to `variant="primary"`.
- **Files modified:** `src/components/board/adapt/AdaptFrameBody.tsx`
- **Verification:** tsc --noEmit clean (0 errors).
- **Committed in:** afcc9925

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Known Stubs

None. The AdaptFrameBody reads live `variants.remix.adapt` from the DB row or live mutation state. No hardcoded concept values or placeholder arrays. Until Phase 3 Decode merges, `decodeOutput` will be null on the live board and the component correctly shows the "Concepts generate once the source video is decoded." empty state.

## Threat Flags

None. All STRIDE threats from the plan's threat model are implemented:
- T-04-10: Niche derives only from taxonomy labels (getPrimaryLabel/getSubLabel), never free text
- T-04-11: adaptFiredRef + Pitfall 3 gate ensure at-most-one-fire
- T-04-12: Reuses existing /api/profile/creator-profile PATCH (CSRF + RLS already enforced)
- T-04-13: Independent frame state machine — null adapt → Adapt error state only, Decode unaffected

## Status

**Paused at Task 3 (checkpoint:human-verify)** — code complete, awaiting developer sign-off on:
1. Concept quality (format-adapted not content-copied)
2. Raycast visual conformance (transparent bg, 6% border, coral chip only, no lift)
3. Rehydrate-no-regen (Network tab shows no POST to /api/remix/adapt on permalink reload)
4. Mobile mirror (3 cards in card-stack below 768px)
5. Empty-niche inline-prompt flow

## Self-Check: PASSED

- [x] `src/hooks/queries/use-adapt-concepts.ts` — FOUND
- [x] `src/components/board/adapt/AdaptFrameBody.tsx` — FOUND
- [x] `src/components/board/adapt/AdaptShellNode.tsx` — FOUND (modified)
- [x] `src/components/board/Board.tsx` — FOUND (modified, AdaptShellNode camera={camera} layout={layout})
- [x] `src/components/board/BoardMobile.tsx` — FOUND (modified, AdaptShellNode camera={CARD_CAMERA} layout={layout})
- [x] Commits 29921dec (test RED), 67990434 (feat GREEN), d60f060a (test RED), afcc9925 (feat GREEN) — FOUND in git log
- [x] `npx vitest run` → 1804 green, 0 fail
- [x] `npx tsc --noEmit` → 0 errors
- [x] `grep -E "remix.*adapt" AdaptFrameBody.tsx` → dual-read pattern confirmed
- [x] `grep -n "adaptFiredRef" AdaptFrameBody.tsx` → guard present (lines 93-95, 125)
- [x] `grep -n "AdaptShellNode camera" Board.tsx BoardMobile.tsx` → 2 matches
