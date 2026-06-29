---
phase: 07-audience-as-front-door-surface
plan: 01
subsystem: ui
tags: [react, nextjs, composer, skills, audience-mode]

# Dependency graph
requires:
  - phase: 03-audience-foundation
    provides: "Audience.mode ('socials' | 'general') first-class axis + resolveTier"
  - phase: 05-profile-simulate-wow
    provides: "Profile / Simulate runners + routes the General verbs will submit to (07-04)"
  - phase: 06-predict
    provides: "Predict runner + /api/tools/predict the General Predict verb will submit to (07-04)"
provides:
  - "SkillMode type ('socials' | 'general') + required modes[] field on SkillMeta"
  - "Widened ToolId (profile/simulate/predict) + the three General SKILLS rows + icons"
  - "Mode-gated SkillRows (filters on activeMode BEFORE the Creator/Marketing partition)"
  - "activeMode prop on SkillRows and ComposerControlsProps (defaults 'socials')"
affects: [07-04, 07-02, 07-03, composer-host-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mode-first skill filter: gate the SKILLS list on the active Audience mode, THEN partition by group for the Socials sub-headers"
    - "Additive-default prop (activeMode='socials') keeps the live Socials render byte-identical until the host threads the real mode"

key-files:
  created: []
  modified:
    - src/components/app/home/composer-controls.tsx
    - src/components/app/home/__tests__/composer-controls.test.tsx
    - src/components/app/home/composer.tsx

key-decisions:
  - "General SKILLS rows carry inert group:'creator' to satisfy the type — the outer filter is mode; group only sub-headers the Socials section"
  - "General mode renders a flat Profile/Simulate/Predict list with NO Creator/Marketing sub-headers (isGeneral gate on the GroupLabel)"
  - "activeMode defaults to 'socials' everywhere so the live composer is unchanged until 07-04 threads the real mode (byte-identical contract)"

patterns-established:
  - "Mode-first partition: inMode() filter precedes the group partition so adding a mode never perturbs the Socials render"

requirements-completed: [UX-02]

# Metrics
duration: 4min
completed: 2026-06-29
---

# Phase 7 Plan 01: Mode-scoped skill menu Summary

**The composer skill menu is now Audience-mode-scoped — a per-skill `modes[]` tag gates `SkillRows` before the Creator/Marketing group partition, so a General audience surfaces Profile/Simulate/Predict while the Socials render stays byte-identical (default `activeMode='socials'`).**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-29T06:40:43Z
- **Completed:** 2026-06-29T06:44:24Z
- **Tasks:** 2
- **Files modified:** 3 (2 planned + 1 Rule-3 blocking fix)

## Accomplishments
- `SkillMode` type + required `modes: SkillMode[]` on `SkillMeta`; every existing creator skill tagged `['socials']`.
- `ToolId` widened with `profile`/`simulate`/`predict`; three General skill rows appended (`modes: ['general']`, no accent) with `people`/`target`/`crosshair` icons.
- `SkillRows` + `ComposerControlsProps` gained an optional `activeMode` (default `'socials'`); an `inMode()` filter gates the list BEFORE the group partition; General mode renders a flat list with no sub-headers.
- Guard test updated (not weakened): byte-identical Socials default kept + new General-mode and explicit-default assertions; `reskin-matte` green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add SkillMode + modes[] tag + three General entries** - `b3ad353a` (feat)
2. **Task 2: Mode-gate SkillRows filter + thread activeMode + update guard test** - `917f25af` (feat)

## Files Created/Modified
- `src/components/app/home/composer-controls.tsx` - SkillMode type, modes[] field, 3 General SKILLS rows + icons, activeMode-gated SkillRows filter, activeMode threaded through ComposerControls.
- `src/components/app/home/__tests__/composer-controls.test.tsx` - mode-scoped + byte-identical-default assertions.
- `src/components/app/home/composer.tsx` - [Rule 3] `PLACEHOLDER_BY_TOOL` `Record<ToolId,string>` gained the three new keys (union-widening fallout).

## Decisions Made
- General rows use inert `group: 'creator'` to satisfy the `SkillGroup` type; the mode filter is the real gate (group only sub-headers the Socials section).
- General mode is a flat list (no Creator/Marketing labels) — the in-mode general set has no marketing entries, and the `Creator` `GroupLabel` is suppressed when `activeMode === 'general'`.
- `activeMode` defaults to `'socials'` at every destructure so the live composer is byte-identical until 07-04 threads the selected audience's mode.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `composer.tsx` PLACEHOLDER_BY_TOOL Record missing the new ToolId keys**
- **Found during:** Task 1 (widening `ToolId` with profile/simulate/predict)
- **Issue:** `const PLACEHOLDER_BY_TOOL: Record<ToolId, string>` in `composer.tsx:97` failed to compile (TS2739) once `ToolId` gained `profile`/`simulate`/`predict` — a NEW tsc error (baseline 20 → 21).
- **Fix:** Added the three keys with sensible General-verb placeholder copy. Host wiring still lands in 07-04; until then `activeMode` defaults to `'socials'` so these are never reached, but the Record contract requires them.
- **Files modified:** src/components/app/home/composer.tsx
- **Verification:** `tsc --noEmit` back to the 20-error baseline; zero errors in `home/`.
- **Committed in:** b3ad353a (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to keep the project compiling after the planned `ToolId` widening. Minimal additive change, no scope creep; the host-wiring scope still belongs to 07-04.

## Issues Encountered
None beyond the Rule-3 blocking fix above. The pre-existing 20-error tsc baseline (unrelated files, e.g. `earnings-chart.tsx`) is out of scope per SCOPE BOUNDARY and was not touched.

## User Setup Required
None - no external service configuration required.

## Verification
- `node ./node_modules/vitest/vitest.mjs run src/components/app/home/__tests__/composer-controls.test.tsx` — 14/14 green.
- `node ./node_modules/vitest/vitest.mjs run src/components/reading/__tests__/reskin-matte.test.ts` — 6/6 green (no coral/glass).
- `tsc --noEmit` — 20 errors (pre-existing baseline, unchanged); zero on composer-controls.tsx / composer.tsx / home/.
- `grep -c "modes:"` = 13 (≥12); `grep -c "modes.includes"` = 1 (≥1); accent grep = 0.

## Next Phase Readiness
- The mode-scoped skill SSOT is ready. 07-04 threads the real `activeMode` from the selected audience into `<ComposerControls>` and wires the per-skill submit semantics (D-07) for Profile/Simulate/Predict.
- Sibling Wave-1 plans (07-02 picker sections, 07-03 Build chooser) are unaffected — this plan is presentation-only and adds no API surface.

## Self-Check: PASSED
- composer-controls.tsx, composer-controls.test.tsx, 07-01-SUMMARY.md all present.
- Commits b3ad353a + 917f25af present in git log.

---
*Phase: 07-audience-as-front-door-surface*
*Completed: 2026-06-29*
