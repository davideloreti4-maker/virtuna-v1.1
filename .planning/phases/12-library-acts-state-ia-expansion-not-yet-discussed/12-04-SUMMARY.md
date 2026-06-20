---
phase: 12-library-acts-state-ia
plan: 04
subsystem: ui
tags: [audience, personas, react, nextjs, supabase, jsonb, regression-gate]

# Dependency graph
requires:
  - phase: 07-audience-manager
    provides: "CalibratedPersona type, Audience domain object, audience-profile-view DataTable (built so an edit column could be added later), PATCH /api/audiences/[id] accepting personas: z.array(z.unknown()), General/preset virtual constants, AUD-03 regression gate"
  - phase: 08-discover-remix-read
    provides: "W0 tuned the persona values P7 deferred on (unblocks persona editing)"
  - phase: 10-account-read-saved-shelf-flywheel
    provides: "D-05 recalibration write pattern (per-audience override slot, never General) — mirrored here"
provides:
  - "Presentation-only label?: string on CalibratedPersona (creator-editable display name, outside the regression-gate surface)"
  - "PersonaEditForm component (Name/Disposition/Temperature/Description → per-audience personas JSONB override via PATCH)"
  - "Per-persona Edit affordance + label ?? archetype-derived display + D-06 protected-baseline caption in audience-profile-view"
  - "Persona-edit unit test locking the override write (label persists, archetype+share byte-stable) + General-baseline gate green"
affects: [audience-editing, persona-calibration, marketing-intent, commerce-skills]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Presentation-only persona field (label) written via the personas JSONB override, explicitly excluded from the engine read-surface (runners read [archetype, repaint] only)"
    - "Inline-expand edit form on a read-only profile (local-state refresh on save, no hard reload) rather than a Dialog"
    - "Defense-in-depth gate: the edit affordance hides on General/preset AND the form structurally refuses to render for is_general/is_preset"

key-files:
  created:
    - src/components/audience/persona-edit-form.tsx
    - src/components/audience/__tests__/persona-edit.test.tsx
  modified:
    - src/lib/audience/audience-types.ts
    - src/components/audience/audience-profile-view.tsx

key-decisions:
  - "Name persists to a NEW presentation-only label?: string on CalibratedPersona (the type had no name field — display name was archetype-derived everywhere); falls back to the archetype-derived string when absent so legacy/General personas still render"
  - "Edit form rendered as an inline expand on the profile (planner discretion over Dialog) — local audience state refreshes on save so the edited Name shows with no hard reload"
  - "Disposition/Temperature labels are sibling <span>s, not <label htmlFor> — the Select trigger is a combobox <button> that does not accept an id, so htmlFor would dangle (a11y fix surfaced by the unit test)"
  - "No route/schema change: PATCH /api/audiences/[id] already accepts personas: z.array(z.unknown()), which passes the new label key without a Zod edit; ENGINE_VERSION stays 3.19.0; no migration (label is a JSONB key)"

patterns-established:
  - "Pattern: creator-tunable persona fields write the per-audience override slot only; the protected General baseline (virtual constant, personas:[], no DB row, no Edit affordance) is structurally unwritable"
  - "Pattern: a presentation-only field can be added to a gated engine type provided every runner read-site is byte-unchanged — verified by a positive invariant (5x [archetype, repaint]) not a fragile zero-grep"

requirements-completed: [AUD-EDIT-01]

# Metrics
duration: 11min
completed: 2026-06-20
---

# Phase 12 Plan 04: Persona Editing (AUD-EDIT-01) Summary

**Per-persona editing (Name·Disposition·Temperature·Description) on calibrated audiences — Name persists to a new presentation-only `label` on the `personas` JSONB override via the shipped `PATCH /api/audiences/[id]`; General/preset stay read-only; the AUD-03 regression gate stays green and ENGINE_VERSION untouched (3.19.0).**

## Performance

- **Duration:** 11 min (auto-tasks) + human-verify checkpoint
- **Started:** 2026-06-20T16:02:38Z
- **Completed:** 2026-06-20T16:13:54Z
- **Tasks:** 4 (3 auto + 1 blocking human-verify)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- Added a presentation-only `label?: string` to `CalibratedPersona` — the Name persistence target — documented as outside the regression-gate surface (runners read `[archetype, repaint]` only and never `label`).
- Built `PersonaEditForm`: edits Name(→`label`)/Disposition/Temperature/Description(→`repaint`) and PATCHes the updated `personas[]` override for a calibrated audience, preserving `archetype` + `share` byte-stable; NO weight/share field; General/preset structurally refused.
- Wired a per-persona pencil **Edit** affordance (calibrated only) + `label ?? archetype-derived` display (audience map + DataTable name column) + the D-06 protected-baseline caption replacing "Editing arrives once values are tuned." into `audience-profile-view.tsx`; the edited Name refreshes inline with no hard reload.
- Locked it with a 7-case unit test (override write incl. `label`, archetype/share byte-stable, name fallback, no weight field, General refused, General/preset no-Edit + caption, error copy) and re-ran the two AUD-03 gates **unmodified** (both green).
- Human-verified in Playwright (authed): calibrated edit "Fitness"→"Hardcore Hannah" persisted with `archetype`/`share` unchanged; General + preset read-only with the muted (non-coral) caption; PATCH works both directions; fixture restored; zero console errors.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add `label` to CalibratedPersona + build persona-edit-form** - `cf444366` (feat)
2. **Task 2: Wire Edit affordance + `label ?? archetype-derived` display + D-06 caption** - `32251102` (feat)
3. **Task 3: Unit test persona edit + assert General-baseline gate green** - `c06e9e99` (test)

**Plan metadata:** docs commit (this SUMMARY + STATE + ROADMAP + REQUIREMENTS)

## Files Created/Modified
- `src/lib/audience/audience-types.ts` - Added presentation-only `label?: string` to `CalibratedPersona` (documented as outside the gate surface).
- `src/components/audience/persona-edit-form.tsx` (new) - The per-persona edit form (Name/Disposition/Temperature/Description → personas JSONB override via PATCH); General/preset guard; honesty footnote; success/error copy. Also exports `archetypeDerivedName` helper.
- `src/components/audience/audience-profile-view.tsx` - Per-persona Edit row-action (calibrated only), `label ?? archetype-derived` display at both sites, inline edit form with local-state refresh, D-06 protected-baseline caption.
- `src/components/audience/__tests__/persona-edit.test.tsx` (new) - 7-case happy-dom/RTL lock on the edit + gate-safety.

## Decisions Made
- **Name → new `label?: string`:** `CalibratedPersona` had no name field; the display name was archetype-derived everywhere. D-06 lists Name as editable, so `label` is the persistence target with an archetype-derived fallback (legacy + General personas have none and still render).
- **Inline expand over Dialog** (planner discretion): the edit form opens inline on the profile; saving updates a local audience copy so the edited Name shows with no hard reload (the page owns the original fetch).
- **No route/schema/migration change:** `PATCH /api/audiences/[id]` already accepts `personas: z.array(z.unknown())`, so the new `label` key passes with no Zod edit; `label` is a JSONB key (no DDL); `ENGINE_VERSION` stays 3.19.0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Dangling `htmlFor` on the Disposition/Temperature labels**
- **Found during:** Task 3 (unit test) — `getByLabelText("Disposition")` failed because the shipped `Select` renders its trigger as a `<button role="combobox">` that does not accept/forward an `id`, so the `<label htmlFor="persona-disposition">` pointed at nothing.
- **Issue:** A `<label htmlFor>` with no matching control is a dead a11y association (and broke label-based querying).
- **Fix:** Changed the two `Select` field labels from `<label htmlFor>` to sibling `<span>`s (Name/Description keep `htmlFor` — `Input`/`Textarea` forward the id). The test asserts those two fields via visible-label `getByText` + the two `combobox` roles.
- **Files modified:** `src/components/audience/persona-edit-form.tsx`, `src/components/audience/__tests__/persona-edit.test.tsx`
- **Verification:** Persona-edit suite 7/7 green; `npm run build` passes.
- **Committed in:** `c06e9e99` (Task 3 commit)

**Note (AC wording vs. real types):** Task 3's AC example said a "`collector` archetype renders 'Collector'" — `collector` is a `Disposition`, not an `Archetype`. The name-fallback test instead uses a real archetype slug (`high_engager` → "High Engager"), exercising the same `archetype.replace(/_/g," ")…` fallback path. No code impact; test is correct against the actual `Archetype` union.

---

**Total deviations:** 1 auto-fixed (1 bug).
**Impact on plan:** The a11y fix was necessary for correctness (no dangling `htmlFor`) and surfaced by the planned test. No scope creep; no engine/gate/schema/route changes.

## Issues Encountered
None beyond the deviation above. Build green throughout; both AUD-03 regression gates green and unmodified (`git diff --stat` empty); the 5 runner repaint-map sites byte-unchanged.

## User Setup Required
None - no external service configuration required (no migration, no new env var).

## Next Phase Readiness
- **Phase 12 complete (4/4 plans):** IA-01 (sidebar Library + literal nouns, 12-01), LIB-01..03 (Library surface, 12-02), AUD-EDIT-02 (Compare, 12-03), AUD-EDIT-01 (persona editing, 12-04).
- Calibrated audiences are now fully editable (name/disposition/temperature/description per persona) on the protected-baseline-safe override slot — substrate for downstream marketing-intent (P15) and commerce (P16) per-audience tuning.
- ⚠ STILL OPEN from Phase 11 → 11-08 (BLOCKING: live `tracked_accounts` migration push + `database.types.ts` regen + engine regression gate). Unrelated to this plan; the "+ Track account" write degrades safely to false until run.

## Self-Check: PASSED

- Created files exist: `persona-edit-form.tsx`, `__tests__/persona-edit.test.tsx` ✓
- Modified files exist: `audience-types.ts`, `audience-profile-view.tsx` ✓
- Task commits exist: `cf444366`, `32251102`, `c06e9e99` ✓

---
*Phase: 12-library-acts-state-ia*
*Completed: 2026-06-20*
