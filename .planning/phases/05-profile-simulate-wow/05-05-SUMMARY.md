---
phase: 05-profile-simulate-wow
plan: 05
subsystem: tools
tags: [simulate-runner, simulate-route, flash-reuse, reaction-distribution, subject-kind-marker, person-panel-branch, one-thread-wow, tdd]

# Dependency graph
requires:
  - phase: 05-profile-simulate-wow (plan 01)
    provides: ReactionDistributionBlockSchema (the reaction-distribution block contract) + buildSimulateRequest seam
  - phase: 05-profile-simulate-wow (plan 04)
    provides: the reserved custom_context __subject_kind marker persisted on the saved General SIM
  - phase: 04-input-adapter
    provides: normalizeStimulus (the drafted message → Stimulus adapter)
  - phase: 03-general-population-honesty-layer
    provides: getAudience (RLS-scoped resolution) + resolveTier (Directional-by-rule) + General library
  - phase: "engine (Flash substrate)"
    provides: runFlashTextMode + aggregateFlash + buildAudienceRepaint (the SIM engine, reused never re-rolled)
provides:
  - "runSimulate + SimulateRunInput + SimulateRunDeps — the Simulate verb (drafted message → person/panel reaction-distribution block on the existing Flash engine)"
  - "POST /api/tools/simulate — auth/csrf/cap → getAudience (RLS) → normalize → runSimulate → insertMessage on the SAME open thread (SIMU-03)"
affects: [05-06 composer affordance, gsd-ui-phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lift two-audience-read's per-audience read (buildAudienceRepaint → runFlashTextMode → aggregateFlash), DROP the 2-audience delta — one audience, one distribution (D-06)"
    - "Deterministic person/panel branch from the persisted __subject_kind marker, NEVER persona count (D-02 / Pitfall 2); default-person honest-safe fallback"
    - "Person → single lead read (band/fraction SUPPRESSED — no distribution-of-one); panel → band+fraction+clustered-themes+per-persona drill"
    - "aggregateFlash band math reused verbatim (never re-rolled) — honesty spine; resolveTier guard asserts Directional-only"
    - "Message is the reaction CONTENT (data) fed to the Flash engine, never the steering prompt — D-08 by structural separation (steer rides the audience repaint)"
    - "behavioral-core NOT imported into the Simulate path (Pitfall 5 — the behavioral prompt rides ONLY the Profile READ)"
    - "Flash injected via deps for zero-network unit tests; route mirrors read/route.ts security spine"

key-files:
  created:
    - src/lib/tools/runners/simulate-runner.ts
    - src/lib/tools/runners/__tests__/simulate-runner.test.ts
    - src/app/api/tools/simulate/route.ts
    - src/app/api/tools/simulate/__tests__/route.test.ts
  modified:
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Person read maps the deterministic stop/scroll lead-persona verdict to plain language (stop→receptive / scroll→resistant) + a grounded reasoning line derived from that verdict — no fabricated signal beyond the engine's verdict + the persona's own quote"
  - "Themes cluster the panel by reaction frame (stopped vs scrolled), one representative quote each — honest grouping over only the frames the panel actually produced, no invented buckets"
  - "resolveTier(audience) is called as the SSOT but the runner hard-guards tier === 'Directional' (throws otherwise) — Simulate runs against General SIMs only, and the block schema's tier is z.literal('Directional')"
  - "Flash injected via SimulateRunDeps.flash (defaults to the real runFlashTextMode) so the runner tests are zero-network without a module mock"

patterns-established:
  - "Pattern: a one-audience reaction runner that reuses the multi-audience Flash read and branches presentation (not engine) on a persisted subjectKind marker"

requirements-completed: [SIMU-01, SIMU-02, SIMU-03]

# Metrics
duration: ~9min
completed: 2026-06-28
---

# Phase 05 Plan 05: Simulate Verb (runner + route) Summary

**`runSimulate` runs a drafted message through a General audience on the EXISTING Flash engine (buildAudienceRepaint → runFlashTextMode → aggregateFlash, the 2-audience delta dropped) and emits a person/panel-aware, bands-only, Directional `reaction-distribution` card — the person/panel branch driven DETERMINISTICALLY by the `__subject_kind` marker Profile persisted (never persona count) — and `/api/tools/simulate` wires it behind the full auth/csrf/cap/RLS-audience spine onto the SAME open thread the Profile READ landed in, closing the SIMU-03 one-thread wow.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-06-28T20:22:00Z (approx)
- **Completed:** 2026-06-28T20:25:30Z
- **Tasks:** 2 (Task 1 TDD: RED → GREEN; Task 2 route)
- **Files modified:** 4 created (+ 3 planning docs)

## Accomplishments
- **SIMU-01 (Flash reuse, never re-roll):** `runSimulate` lifts `two-audience-read`'s per-audience read core — `buildAudienceRepaint(audience)` → `runFlashTextMode(message, "idea", {niche:null,contentType:null}, repaint)` → `aggregateFlash(result.personas)` → `{band, fraction}` — and DROPS the 2-audience delta. The band math is reused verbatim; a test asserts `block.props.fraction === aggregateFlash(personas).fraction` (no re-roll).
- **SIMU-02 (person/panel reaction card):** the card branches the WHOLE shape on subjectKind. **Person** → a single honest `read` (the highest-share calibrated persona matched against the Flash panel → `{verdict, reasoning, quote}`) with `band`/`fraction`/`themes` SUPPRESSED (Pitfall 2 — no "7/10" for one human). **Panel** → `band` + `fraction` + clustered `themes[]` (stopped vs scrolled, one representative quote each) + the per-persona `reactions[]` drill.
- **D-02 / Pitfall 2 (deterministic branch):** subjectKind resolves from `audience.custom_context.find(c => c.persona_evidence_link === "__subject_kind")?.note` — NOT persona count. A test proves a person-marked audience carrying **3** calibrated personas STILL renders a person read (no fraction); an explicit `input.subjectKind` override wins; absent marker → `"person"` (honest-safe fallback).
- **Honesty spine:** `tier` is `"Directional"` by rule — `resolveTier(audience)` is the SSOT and the runner hard-guards `tier === "Directional"` (Simulate runs against General SIMs only); the emitted block is re-validated against the `.strict()` bands-only `ReactionDistributionBlockSchema`.
- **Pitfall 5:** `grep -cE "behavioral-core|BEHAVIORAL_" src/lib/tools/runners/simulate-runner.ts` === **0** — the behavioral prompt rides ONLY the Profile READ; Simulate uses the unchanged Flash prompt.
- **D-08:** the drafted message is the reaction CONTENT (data) handed to the Flash engine as the reaction target, never concatenated into the steering/system prompt (the steer rides the audience repaint). Documented structurally.
- **SIMU-03 (one-thread wow + security spine):** `POST /api/tools/simulate` mirrors `read/route.ts` — auth 401 → `csrfGuard` → `MAX_MESSAGE_LENGTH` (2000) cap (400 empty/oversize) → `getAudience` under the session (RLS-scoped; bad id → 400 `audience_not_found`, never raw weights) → `normalizeStimulus` → `runSimulate` → `insertMessage` (re-validate + KC stamp) on the SAME open thread the Profile READ was appended to. The route does NOT pass subjectKind — `runSimulate` reads the persisted marker deterministically.

## Task Commits

1. **Task 1 (RED): failing tests for simulate-runner** — `1f4c8eda` (test)
2. **Task 1 (GREEN): simulate-runner — Flash read → person/panel reaction-distribution** — `ee04b4c4` (feat)
3. **Task 2: /api/tools/simulate route — security spine + same-thread persistence** — `cf618428` (feat)

## Files Created/Modified
- `src/lib/tools/runners/simulate-runner.ts` — `runSimulate` + `SimulateRunInput` + `SimulateRunDeps`; deterministic `resolveSubjectKind` (marker, never count); lifted Flash read; `pickLeadPersona` (highest-share archetype match) for the person read; `clusterThemes` (reaction-frame split) + per-persona drill for the panel; `resolveTier` Directional guard; `.strict()` re-validation. No behavioral-core import.
- `src/lib/tools/runners/__tests__/simulate-runner.test.ts` — 7 tests: panel (band/fraction === aggregateFlash + themes + 10 reactions, no read), person (single read, band/fraction/themes suppressed, lead echoes loyalist), marker-driven branch incl. person-with-3-personas + explicit override + absent-marker default, block validity (person + panel), Flash called once.
- `src/app/api/tools/simulate/route.ts` — POST with the auth/csrf/cap/RLS-audience spine; `{ audienceId, message }` body; `getAudience` resolution (400 on bad id); `normalizeStimulus` → `runSimulate` → `insertMessage` on the open thread.
- `src/app/api/tools/simulate/__tests__/route.test.ts` — 5 tests: 401 before any run; 400 empty/over-cap message; 400 `audience_not_found`; 200 `{block}` reaction-distribution + insertMessage once on `thread-1`.
- `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` — position, metrics, decisions, plan-progress, SIMU-01/02/03 closed.

## Verification
- `node ./node_modules/vitest/vitest.mjs run src/lib/tools/runners/__tests__/simulate-runner.test.ts` → 7/7 pass.
- `node ./node_modules/vitest/vitest.mjs run src/app/api/tools/simulate/__tests__/route.test.ts` → 5/5 pass.
- `node ./node_modules/vitest/vitest.mjs run src/lib/tools/runners src/app/api/tools/simulate src/lib/engine/flash` → 19 files / 216 passed (+2 skipped) — no re-roll regression in the Flash engine suite.
- `grep -cE "behavioral-core|BEHAVIORAL_" src/lib/tools/runners/simulate-runner.ts` → 0 (Pitfall 5).
- `npx tsc --noEmit` → 20 errors total = the pre-existing baseline carried since 05-01; zero new errors on the touched files.

## Decisions Made
See frontmatter `key-decisions`. The load-bearing ones: the person read maps the deterministic stop/scroll lead verdict to plain language + a grounded reasoning line (no fabricated signal beyond the engine verdict + the persona's own quote); themes cluster by the reaction frame the panel actually produced; `resolveTier` is the SSOT but a hard guard enforces the schema's `Directional` literal; Flash is injected via deps for zero-network tests.

## Deviations from Plan
None — plan executed exactly as written.

## Known Stubs
None — `runSimulate` and the route are fully wired against the real 05-01 block contract, the 05-04 persisted marker, the 04 `normalizeStimulus` adapter, the 03 `getAudience`/`resolveTier`, and the existing Flash engine. The final flat-warm visual polish of the `reaction-distribution` renderer remains the `/gsd-ui-phase` pass (05-01 deferral), not a stub in this plan's scope.

## Threat Flags
None — the only new surface is `POST /api/tools/simulate`, which is the plan threat model's `client → POST /api/tools/simulate` boundary; T-05-14…17 are all mitigated here (auth/csrf before any DB/LLM; RLS-scoped audience resolution, never raw weights; message cap; `aggregateFlash` band math reused, never re-rolled; `.strict()` bands-only block). No surface beyond the plan's `<threat_model>`.

## TDD Gate Compliance
Task 1 followed RED → GREEN: a `test(05-05)` commit (`1f4c8eda`, module-not-found RED) precedes the `feat(05-05)` GREEN commit (`ee04b4c4`). No REFACTOR commit needed. No unexpected RED-phase pass.

## Next Phase Readiness
- The Profile → Simulate end-to-end now works headless: Profile (05-04) persists the General SIM + subjectKind marker and emits the chain CTA; Simulate (this plan) resolves that SIM, reads the marker deterministically, and persists a `reaction-distribution` block to the SAME open thread (SIMU-03).
- 05-06 (the minimal composer "drop a chat / screenshot" affordance) and the `/gsd-ui-phase` visual pass are the remaining Phase-5 surface work.

## Self-Check: PASSED
- FOUND: src/lib/tools/runners/simulate-runner.ts
- FOUND: src/lib/tools/runners/__tests__/simulate-runner.test.ts
- FOUND: src/app/api/tools/simulate/route.ts
- FOUND: src/app/api/tools/simulate/__tests__/route.test.ts
- FOUND commit: 1f4c8eda (RED test)
- FOUND commit: ee04b4c4 (GREEN runner)
- FOUND commit: cf618428 (route)

---
*Phase: 05-profile-simulate-wow*
*Completed: 2026-06-28*
