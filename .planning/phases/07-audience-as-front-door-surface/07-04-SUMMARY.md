---
phase: 07-audience-as-front-door-surface
plan: 04
subsystem: ui
tags: [react, nextjs, composer, audience-mode, general-verbs, submit-semantics]

# Dependency graph
requires:
  - phase: 07-audience-as-front-door-surface
    plan: 01
    provides: "SkillMode type + activeMode prop on ComposerControls/SkillRows (default 'socials'); widened ToolId (profile/simulate/predict); mode-gated skill menu"
  - phase: 05-profile-simulate-wow
    provides: "/api/tools/profile (evidence-drop) + /api/tools/simulate routes + reloadProfileThread one-thread surface"
  - phase: 06-predict
    provides: "/api/tools/predict route + prediction-gauge block renderer"
provides:
  - "Live activeMode threaded into ComposerControls from the selected audience's mode"
  - "Per-skill submit semantics for Profile / Simulate / Predict (D-07)"
  - "Client-side General-audience gate on Simulate/Predict (routes to Build, never fires ungated)"
affects: [07-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mode derived for the menu: activeMode = selectedAudience?.mode ?? 'socials' keeps the Socials render byte-identical"
    - "General-verb gate lives in handleSubmit (fire vs route-to-Build); canSubmit only gates on draft so the button can redirect rather than dead-end"
    - "Profile opens the evidence-drop file picker inside the select gesture (a file input .click() needs a user gesture; an effect can't open it)"

key-files:
  created: []
  modified:
    - src/components/app/home/composer.tsx
    - src/components/app/home/__tests__/composer.test.tsx

key-decisions:
  - "canSubmit for Simulate/Predict gates on a non-empty draft only; the selected-General-audience requirement is the handleSubmit gate so a no-audience submit routes to Build (/audience/new) instead of dead-ending — the server is the real trust boundary (T-07-04-01)"
  - "Profile selection opens the existing evidence-drop file input (evidenceInputRef.click()) within the menu/slash click gesture — moved evidenceInputRef declaration ahead of handleUserSelectTool so it is in scope"
  - "reloadProfileThread + the mount rehydration filter now also capture 'prediction-gauge' so the Predict result actually surfaces in-thread (Rule 2)"

patterns-established:
  - "General verbs reuse the P5/P6 routes via additive handleSubmit branches; the byte-identical Socials branches are never modified"

requirements-completed: [UX-02]

# Metrics
duration: 7min
completed: 2026-06-29
---

# Phase 7 Plan 04: Composer General-verb submit semantics Summary

**The composer now threads the live `activeMode` from the selected audience into the skill menu and wires explicit per-skill submit semantics for the three General verbs — Profile opens the evidence-drop, Simulate/Predict POST to the existing `/api/tools/{simulate,predict}` routes gated on a selected General audience (ungated submit routes to Build, never fires), and the Socials submit path stays byte-identical.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-29T07:06:53Z
- **Completed:** 2026-06-29T07:14:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- `activeMode={selectedAudience?.mode ?? "socials"}` threaded into the `<ComposerControls>` mount — a General audience surfaces Profile/Simulate/Predict; Socials/null defaults keep the live menu byte-identical (Pitfall 2).
- **Profile** → selecting it (menu or `/profile` slash) opens the existing evidence-drop file picker (`evidenceInputRef.click()`) instead of arming a topic submit. `evidenceInputRef` was lifted ahead of `handleUserSelectTool` so the click rides the user gesture.
- **Simulate / Predict** → new `handleSubmit` branches that require a selected General audience, then `POST /api/tools/simulate` `{ audienceId, message }` / `/api/tools/predict` `{ audienceId, scenario }` and surface the result via `reloadProfileThread()`. No `pendingNavRef`/`stream.start` — a General verb never navigates to `/analyze`.
- **Gate (T-07-04-01):** when no General audience is selected, Simulate/Predict route the user to Build (`/audience/new`) and return WITHOUT firing a stimulus — the client gate cannot fire an ungated read; the server independently enforces auth + the D-08 honesty guards.
- `canSubmit` extended: Simulate/Predict require a non-empty draft; Profile is inert on the topic field (the evidence drop is its entry).
- Test coverage: 5 new cases (Simulate gate / Simulate fire / Predict fire / Profile-opens-evidence / Socials-byte-identical) on top of the 6 existing.

## Task Commits

1. **Task 1: Thread activeMode into ComposerControls** — `87bbc1a6` (feat)
2. **Task 2: Per-skill submit semantics for Profile / Simulate / Predict** — `b469a4ad` (feat)
3. **Task 3: Extend composer.test.tsx for the gated General submit** — `6753b5b5` (test)

## Files Created/Modified
- `src/components/app/home/composer.tsx` — `activeMode` prop on the ComposerControls mount; `handleUserSelectTool` opens the evidence picker on Profile; `handleSubmit` Simulate/Predict branches (audienceId-gated, route-to-Build); `canSubmit` General-verb branches; `evidenceInputRef` moved up; `reloadProfileThread` + mount filter widened to include `prediction-gauge`.
- `src/components/app/home/__tests__/composer.test.tsx` — global fetch mock + slash-select/audience-pick scaffolding + 5 new General-verb cases.

## Decisions Made
- **canSubmit gates on draft only for the General verbs; the General-audience requirement is the `handleSubmit` gate.** This lets a no-audience submit redirect to Build rather than dead-ending behind a disabled button, while the must-have "cannot fire ungated client-side" is enforced inside `handleSubmit` (and the server is the real trust boundary). This is the only design consistent with both the canSubmit acceptance and the route-to-Build gate test.
- **Routed the gate to `/audience/new`** (the description Build path, D-08) via `router.push` — the in-composer Build chooser mount is 07-05's scope; `/audience/new` is the correct, observable Build redirect for this plan.
- **Profile opens the file picker inside the select gesture, not via an effect** — a file input `.click()` must ride a real user gesture, which an effect cannot provide.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Predict result block not captured by the thread reload**
- **Found during:** Task 2
- **Issue:** Both Simulate and Predict were planned to surface via `reloadProfileThread()`, but its filter (and the mount rehydration filter) only matched `profile-read`/`reaction-distribution`. The Predict route persists a `prediction-gauge` block, which would POST successfully but never appear in-thread.
- **Fix:** Added `b.type === 'prediction-gauge'` to both filters so the analyst-panel Predict result renders via the shared `MessageBlocks` (renderer registered in 06-04), live and on reload.
- **Files modified:** src/components/app/home/composer.tsx
- **Commit:** b469a4ad

---

**Total deviations:** 1 auto-fixed (Rule 2). No architectural changes; no new routes; ENGINE_VERSION untouched (3.20.0).

## Authentication Gates
None.

## Issues Encountered
- The existing TikTok-validation tests in the file fire real mount fetches (they don't install the fetch mock), producing benign `ECONNREFUSED`/abort console noise on teardown — pre-existing, not a failure (all 11 tests pass). The new General-verb describe installs a routed `global.fetch` mock and restores it in `afterEach`.

## Verification
- `node ./node_modules/vitest/vitest.mjs run src/components/app/home/__tests__/composer.test.tsx src/components/app/home/__tests__/composer-layout.test.tsx src/components/reading/__tests__/reskin-matte.test.ts` — 25/25 green.
- `grep -c "activeMode=" composer.tsx` = 1; `grep -E -c "/api/tools/(simulate|predict)" composer.tsx` = 2.
- `tsc --noEmit` — 19 errors (≤ pre-existing 20-error baseline; zero on composer.tsx / composer.test.tsx).
- No new route file under `src/app/api/`; ENGINE_VERSION unchanged (3.20.0).

## Next Phase Readiness
- 07-05 (mode:general wiring) mounts the Build chooser in the composer; it can replace the `/audience/new` redirect with the in-composer chooser via an `onBuildAudience` path if desired. The General-verb submit semantics + the activeMode thread are complete and tested.

## Self-Check: PASSED
