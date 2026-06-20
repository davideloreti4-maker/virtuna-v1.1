---
phase: 12-library-acts-state-ia
plan: 03
subsystem: ui
tags: [audience, compare, multi-audience-read, nextjs, react, route-handler, vitest]

# Dependency graph
requires:
  - phase: 08-discover-remix-read
    provides: "runTwoAudienceRead + MultiAudienceReadBlockRenderer + /api/tools/read (multi-audience Read, 08-05/08-06)"
  - phase: 07-audience-manager
    provides: "Audience object (audience_ids[]-ready), getAudience RLS-scoped, virtual General/preset sentinels"
  - phase: 12-library-acts-state-ia
    provides: "12-02 SaveAffordance on the multi-audience Read card (exercised live by this plan's inline render)"
provides:
  - "Arbitrary explicit two-audience pair path on POST /api/tools/read (audienceIds[2] body field)"
  - "Compare selection mode on /audience — pick any two saved audiences, neutral selection, launch the P8 Read inline"
  - "Route test locking the arbitrary-pair path (resolve both / reject bad id 400 / default-path preserved / auth)"
affects: [phase-13-proactive-numen, audience-surface, multi-audience-read]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Thin entry-point over proven infra: net-new build = the selection-mode UI + an arbitrary-pair route branch; the Read runner + render are REUSED verbatim (no redesign)"
    - "Explicit-pair trust boundary: arbitrary audienceIds resolved via getAudience under the session (RLS-scoped), bad id rejected 400 (no silent General fallback) — same discipline as the shipped secondAudienceId path"
    - "Neutral-not-coral selection state (white/[0.06] + cream Check); coral reserved for the launch CTA (one-accent law)"

key-files:
  created:
    - "src/app/api/tools/read/__tests__/route.test.ts"
  modified:
    - "src/app/api/tools/read/route.ts"
    - "src/components/audience/audience-manager.tsx"

key-decisions:
  - "Explicit-pair path is purely additive: a 2-entry audienceIds[] branch resolves the pair; the shipped active-vs-General default (thread.active_audience_id + optional secondAudienceId) is unchanged. Both paths share runTwoAudienceRead + persistence."
  - "A bad explicit id returns 400 audience_not_found (NOT a silent General fallback) — an explicitly-requested pick that fails to resolve must surface, never hide behind General (CR-01)."
  - "Render location = inline panel on /audience via the reused MultiAudienceReadBlockRenderer (planner discretion from UI-SPEC; render component fixed, not redesigned)."
  - "3rd selection drops the OLDEST pick (replace-oldest) to keep selectedIds ≤ 2 (D-05/D-09)."
  - "No ENGINE_VERSION bump — route-layer audience resolution only, engine bytes untouched."

patterns-established:
  - "Arbitrary-pair compare: select any two saved audiences (incl. General/preset sentinels) → /api/tools/read { concept, audienceIds } → reused P8 multi-audience Read"
  - "Selection mode suppresses normal row navigation + hides the ⋯ menu/General badge so each row reads as a single selection target"

requirements-completed: [AUD-EDIT-02]

# Metrics
duration: ~5min (+ Playwright UAT)
completed: 2026-06-20
---

# Phase 12 Plan 03: Audience Compare (multi-select arbitrary pair) Summary

**A Compare selection mode on `/audience` that picks any two saved audiences and runs P8's existing multi-audience Read (08-06) against the arbitrary pair, via a thin `audienceIds[2]` branch on `/api/tools/read` — "wins for growth, bombs for buyers" over proven infra, no render redesign, no engine bytes.**

## Performance

- **Duration:** ~5 min build/test + Playwright human-verify UAT
- **Started:** 2026-06-20T17:46:39Z (first task commit)
- **Completed:** 2026-06-20 (post-checkpoint finalize)
- **Tasks:** 4 (3 auto + 1 human-verify checkpoint)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- **Arbitrary-pair route path (AUD-EDIT-02 / D-05):** `POST /api/tools/read` now accepts an OPTIONAL `audienceIds: [string, string]` body field. When exactly 2, BOTH ids are resolved via `getAudience` under the session (RLS-scoped, never raw weights) and passed to the reused `runTwoAudienceRead`. A bad explicit id is rejected `400 { error: "audience_not_found" }` (no silent General fallback). The shipped active-vs-General default path is byte-for-byte unchanged.
- **Compare selection mode (`audience-manager.tsx`):** a `Compare` header action (Scales icon) toggles selection mode — prompt `Pick two audiences to compare.`, a `{n}/2 selected` counter, `Cancel`, an inline concept input, and the `Compare these two →` launch CTA (disabled until exactly 2, tooltip `Select two audiences`). Each row gains a neutral checkbox (white/[0.06] + cream `Check`); selecting toggles `selectedIds` (cap 2, replace-oldest) and suppresses row navigation. The launch POSTs `{ concept, audienceIds }` and renders the returned block inline via the reused `MultiAudienceReadBlockRenderer`.
- **Route test:** new `route.test.ts` (no test existed for this route) locks the arbitrary-pair contract — both ids resolve and run (asserts the second is NOT General), a bad id returns 400 with no Read run, the default path still passes, and auth is enforced.
- **Live UAT confirmed the 12-02 SaveAffordance gap is closed:** saving the inline Compare Read persisted a real `read` item ("Growth Audience — Mixed Read") to `saved_items` — exercising the 12-02 multi-audience-read Save affordance end-to-end (the gap flagged in 12-02 is now verified closed in the live flow).

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend /api/tools/read for an arbitrary explicit two-audience pair** — `23ce01e2` (feat)
2. **Task 2: Route test — arbitrary-pair resolves both ids + rejects bad pairs** — `c7fcdd36` (test)
3. **Task 3: Add the Compare selection mode + launch to audience-manager.tsx** — `1fec4491` (feat)
4. **Task 4: Human-verify checkpoint** — no code commit (verification gate; PASSED via Playwright UAT)

**Plan metadata:** (this docs commit)

## Files Created/Modified

- `src/app/api/tools/read/route.ts` — Added the explicit arbitrary-pair branch (`audienceIds[2]` → resolve both via `getAudience` → `runTwoAudienceRead`; bad id → 400 `audience_not_found`). Default active-vs-General path refactored into the `else` branch, behavior unchanged. Header doc updated. No `ENGINE_VERSION` touched.
- `src/app/api/tools/read/__tests__/route.test.ts` — NEW. 5 tests (arbitrary-pair resolves both / bad-id 400 / default-path smoke / missing-concept 400 / unauthorized 401). Mocks supabase, audience-repo (`getAudience` + `GENERAL_AUDIENCE`), threads/messages, `runTwoAudienceRead`, `kcStamp`.
- `src/components/audience/audience-manager.tsx` — Added selection state (`selectionMode`, `selectedIds`, `compareConcept`, `comparing`, `compareBlock`, `compareNote`), `toggleSelection` (cap 2, replace-oldest), `handleCompare` (POST `/api/tools/read`), `exitSelectionMode`. Header gains the `Compare` action + selection controls; rows gain a neutral checkbox + selection toggle (navigation + ⋯ menu + General badge suppressed in selection mode); the result renders inline via the reused `MultiAudienceReadBlockRenderer`.

## Decisions Made

- **Additive, not invasive:** the arbitrary-pair path is an early `if (audienceIds?.length === 2)` branch; the shipped default path is the `else`. This keeps 08-06's active-vs-General behavior provably intact (asserted by the default-path test + the `active_audience_id`/`secondAudienceId` greps).
- **Explicit bad-id rejection over fallback:** an unresolved explicit pick returns 400 rather than degrading to General — a silent fallback would hide a bad pick from the user (CR-01 trust-boundary discipline).
- **Inline render on /audience:** chosen from the UI-SPEC's render-location discretion; the render COMPONENT (`MultiAudienceReadBlockRenderer`) is fixed and reused verbatim — no redesign.
- **Neutral selection / coral CTA:** selected rows + checkboxes use `white/[0.06]` + a cream `Check` (`text-cream-secondary`, per STATE 05-04 "checkmark cream, never coral"); coral stays only on the `Compare these two →` primary CTA.

## Deviations from Plan

None — plan executed exactly as written. All four tasks ran in order; no Rule 1–4 deviations were required (build + tests green on each task; no missing critical functionality, no blocking issues, no architectural changes).

## Issues Encountered

- **`gsd-tools` CLI not in PATH** (GSD-Lean — SDK CLI not installed in this worktree). State/Roadmap/Requirements updates were applied directly via file edits in sequential mode (this agent owns those writes), preserving the same content the SDK handlers would have produced.

## Known Stubs

None. No hardcoded empty/placeholder data introduced — the Compare flow renders real `runTwoAudienceRead` output; degraded states (under-calibrated pick, launch failure) surface honest warning-tone copy, never fabricated content.

## Under-Calibrated Warning — NOT EXERCISED (no defect)

The honest warning-tone note `This audience isn't calibrated enough to compare yet.` (warning, never error-red, never coral) is wired in `handleCompare` (shown on a non-OK route response or a missing block). It was **not reachable in UAT** because all four available audiences (General, Growth, Conversion, Fitness) are calibrated enough to compare — no under-calibrated fixture exists in the test account. The code path is present and correct; only the live trigger was unavailable. No defect.

## User Setup Required

None — no external service configuration. No migration introduced (audiences already pushed in P7); the route reuses the shipped `getAudience` + `runTwoAudienceRead` + persistence.

## Next Phase Readiness

- AUD-EDIT-02 (the killer Compare feature) is shipped and human-verified. Phase 12 plans 12-01 (IA nav) + 12-02 (Library) + 12-03 (Compare) are now complete; **12-04 (AUD-EDIT-01 persona editing)** remains for phase completion.
- The arbitrary-pair route path + reused Read render are available for any future audience-surface or proactive (P13) reaction surfaces that need a side-by-side compare.

## Self-Check: PASSED

- Files verified present: `src/app/api/tools/read/route.ts`, `src/app/api/tools/read/__tests__/route.test.ts`, `src/components/audience/audience-manager.tsx`.
- Commits verified in history: `23ce01e2` (Task 1), `c7fcdd36` (Task 2), `1fec4491` (Task 3).

---
*Phase: 12-library-acts-state-ia*
*Completed: 2026-06-20*
