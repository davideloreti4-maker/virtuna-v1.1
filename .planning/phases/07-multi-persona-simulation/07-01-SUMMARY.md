---
phase: "07"
plan: "01"
subsystem: "engine.wave3.persona-foundation"
tags:
  - persona
  - prompts
  - taxonomy
  - zod
  - cache-discipline
requirements:
  completed:
    - PERSONA-02
    - PERSONA-03
    - PERSONA-05
    - PERSONA-06
    - PERSONA-08
dependency_graph:
  requires:
    - phase-03-pipeline-infrastructure  # Wave 3 stub + SignalAvailability forward-compat
    - phase-04-wave-0-content-type-niche-detection  # ContentTypeSlug, NICHE_TREE.personas field
  provides:
    - persona-registry-data  # 10 archetypes + 7-row table + per-niche instantiation
    - persona-prompt-builders  # cache-stable system prompt + volatile user message
    - PersonaResponseSchema  # Zod boundary validator for raw LLM output
  affects:
    - wave3-orchestrator-stub  # Plan 07-02 will consume selectPersonaSlots + buildPersonaSystemPrompt + PersonaResponseSchema
tech_stack:
  added:
    - none
  patterns:
    - locked-table-with-fallback  # mirrors wave0/content-type-weights.ts
    - hardcoded-TS-data-module  # mirrors niches/taxonomy.ts
    - cache-stable-system-prompt + volatile-user-message  # mirrors wave0/prompts.ts (Phase 3 D-12)
    - Zod two-stage validation  # mirrors wave0/niche-detector.ts
    - PROFILE-16 host-only sanitization  # imports tryUrlHost from wave0/prompts
key_files:
  created:
    - src/lib/engine/wave3/persona-registry.ts  # 546 lines — 10 archetypes + 7-row allocation + per-niche instantiation
    - src/lib/engine/wave3/persona-prompts.ts  # 157 lines — buildPersonaSystemPrompt + buildPersonaUserMessage + PersonaResponseSchema
    - src/lib/engine/__tests__/wave3-persona-registry.test.ts  # 184 lines — 18 tests
    - src/lib/engine/__tests__/wave3-persona-prompts.test.ts  # 291 lines — 15 tests
  modified:
    - src/lib/engine/types.ts  # widening per D-15/D-19 (PersonaArchetypeSchema, PersonaSlotTypeSchema, PersonaSimulationResultSchema, PersonaBehavioralAggregate, SignalAvailability.personas)
    - src/lib/engine/wave0/prompts.ts  # exported tryUrlHost helper (single-keyword change per Step 1a)
decisions:
  - "Made SignalAvailability.personas key OPTIONAL (?: boolean) instead of required (Rule 3 deviation)"
  - "FYP_ARCHETYPE_ORDER modulo wrap for 7-FYP rows: 7th slot duplicates tough_crowd (matches ~30% FYP-filter weighting per D-02)"
  - "persona_id includes slotIndex for uniqueness across duplicate archetypes; cache prefix still keyed on archetype × niche × time-of-day"
metrics:
  duration_minutes: 22
  task_count: 3
  test_count: 33
  files_created: 4
  files_modified: 2
  lines_added: 1240
  completed: 2026-05-18
---

# Phase 7 Plan 01: Persona Registry + Prompt Builders Summary

Built the foundation data + prompt layer for Phase 7's Wave 3: a persona registry with 10 stable behavioral archetypes, a locked 7-row content-type allocation table, per-niche instantiation profiles, byte-stable persona system prompts, a PROFILE-16-safe user-message builder, and a Zod boundary validator — all under additive type widenings on `types.ts`.

## What Was Built

### Task 1 — types.ts widening (commit `71dfa0b`)

- `PersonaArchetypeSchema`: Zod enum of 10 archetypes (6 FYP behavioral per D-02 + 4 specialized per D-03: niche_deep_buyer, niche_deep_scout, loyalist, cross_niche_curiosity).
- `PersonaSlotTypeSchema`: Zod enum of 4 slot types (fyp, niche_deep, loyalist, cross_niche).
- `PersonaSimulationResultSchema`: replaces the legacy interface — adds archetype, slot_type, niche, and required non-empty bounded `reasoning` (Pitfall 5).
- `PersonaBehavioralAggregate`: type alias of `BehavioralPredictions` for type-level distinguishability (D-19).
- `SignalAvailability.personas?: boolean`: new optional key (D-15) — Plan 07-02 will wire it on the aggregator and may promote to required once exercised by tests.

### Task 2 — persona-registry.ts (commit `7ef5462`)

`src/lib/engine/wave3/persona-registry.ts` (546 lines, pure data + lookup module):

- `ARCHETYPES`: locked 10-entry const tuple. Order is load-bearing for top-3 tie-break (used in Plan 07-02's aggregator).
- `MOTIVATORS`: 6 psychographic motivator labels (D-04).
- `TIME_OF_DAY_TAGS`: exactly 4 entries (Pitfall 8 — bounds cache combinatorics to ~240 prefixes).
- `ARCHETYPE_DEFINITIONS`: byte-stable per-archetype text (D-02 — load-bearing for D-17 cache prefix).
- `ARCHETYPE_TRIGGERS`: scroll-past + stop trigger lists per archetype (D-04).
- `NICHE_INSTANTIATION`: per-niche instantiation profiles for all 10 primary niches × 10 archetypes (100 cells). 5 niches grounded in Phase 1 corpus evidence; 5 niches (food-cooking, tech-gadgets, gaming, fashion-style, music-performance) carry `[PLACEHOLDER]` cells flagged inline (Open Question #2 — deferred to Phase 10/12 retrospective).
- `CROSS_NICHE_ADJACENCY`: edges for all 10 primary niches (D-03).
- `ALLOCATION_TABLE`: locked 7-row table — each row sums to exactly 10 (asserted by test).
- `selectPersonaSlots(contentType, nicheSlug)`: deterministic 10-slot builder with null fallbacks per Pitfall 6 (null content_type → `other` row; null nicheSlug → "general TikTok" label + generic instantiation). Length invariant throws per Pitfall 2.
- `makeSlot(archetype, slot_type, slotIndex, nicheSlug, nicheLabel)`: per-slot composer; persona_id includes slotIndex for uniqueness, but cache prefix (system prompt) is keyed only on the archetype × niche × time-of-day tuple.

18 tests pass covering: ARCHETYPES order/membership, ALLOCATION_TABLE row sums, CROSS_NICHE_ADJACENCY coverage, TIME_OF_DAY_TAGS bound, selectPersonaSlots length invariant + 7 content-type distributions + null fallbacks + determinism, PERSONA-03 (3 niche_deep for tutorial), PERSONA-04 (2 loyalist for talking_head), cross-niche slot adjacency lookup.

### Task 3 — persona-prompts.ts (commit `9829562`)

`src/lib/engine/wave3/persona-prompts.ts` (157 lines, pure builders + Zod):

- `buildPersonaSystemPrompt(slot)`: cache-stable system prompt with 6 cache blocks per D-04/D-05 (Your Behavioral Archetype, Your Scroll-Past + Stop Triggers, Your Psychographic Motivator, Your Current Context, Niche Instantiation, Output Format). Identical slot input → byte-identical string (asserted by Test 1).
- `buildPersonaUserMessage(payload, deepseekResult, creatorContext, wave0Result, slot)`: volatile per-request user message. Includes caption, hashtags, duration, content-type echo from Wave 0 (D-11), Wave 2 synthesis context (component scores + warnings), and a loyalist-only PROFILE-16 host-only past_wins branch with D-03 null fallback ("loyal follower of <niche_label> creators generally").
- `PersonaResponseSchema`: Zod validator for raw DeepSeek output — 5 numeric scores bounded 0-100, required `reasoning` bounded 1-500 chars (Pitfall 5).

`src/lib/engine/wave0/prompts.ts` modified to export `tryUrlHost` (single-keyword change per Step 1a — `function` → `export function`). The persona builder imports the helper rather than duplicating it.

15 prompt tests pass covering: cache prefix byte-stability + invalidation signal, system-prompt structure (all 6 blocks), Pitfall 1 (niche_instantiation lives in system prompt, not user message), PROFILE-16 host-only (no path / query leakage), D-03 null fallback, D-11 content-type echo, loyalist boundary (fyp slots get no loyalist-only block), Wave 2 synthesis context surfacing, null deepseekResult graceful handling, Zod boundary (canonical sample + 4 rejection cases).

## Decisions Made

1. **`SignalAvailability.personas` is optional, not required** (Rule 3 deviation).

   Adding it as required (`personas: boolean`) immediately broke `aggregator.ts` which constructs `SignalAvailability` without the key. The plan explicitly defers all aggregator.ts edits to Plan 07-02. Making the key optional (`personas?: boolean`) satisfies Task 1's acceptance criteria, keeps the existing build green, and is documented inline so Plan 07-02 can promote it to required once aggregator wiring lands.

2. **FYP_ARCHETYPE_ORDER modulo wrap for 7-FYP rows** (Rule 1 bugfix during impl).

   `b_roll` and `action` allocate 7 FYP slots but the FYP archetype rotation has only 6 entries. The first test run hit `undefined.scroll_past`. Fix: `FYP_ARCHETYPE_ORDER[i % FYP_ARCHETYPE_ORDER.length]` — the 7th slot duplicates `tough_crowd`, which matches D-02's note that tough_crowd represents the ~30% FYP-filter segment. Deterministic; preserves cache stability per slot.

3. **persona_id includes slot index for uniqueness**.

   When duplicate archetypes occur (e.g., 2 loyalist slots on `talking_head`, 7th FYP tough_crowd duplicate), the persona_id needs to be unique across all 10 slots for downstream consumers (Plan 07-02's per-persona stage event names, aggregator's per-slot tracking). Added a 1-based `slotIndex` parameter to `makeSlot`; `persona_id = "${slot_type}-${slotIndex}-${archetype}-${nicheSlug}"`. Cache prefix is unaffected because the system prompt is keyed on archetype × niche × time-of-day, not on persona_id.

## Open Question #2 Status

5 of 10 primary niches carry `[PLACEHOLDER]` per-niche instantiation cells inline:

- `food-cooking`
- `tech-gadgets`
- `gaming`
- `fashion-style`
- `music-performance`

These niches were not covered by the 225-row Phase 1 corpus, so the researcher could not ground the per-niche text in corpus evidence. The placeholders are clearly flagged inline (52 `PLACEHOLDER` markers across the file) and ship as descriptive prose — no PII, no creator data, no per-niche-tuned cache prefix that would lock to wrong text downstream. Per the RESEARCH recommendation, refinement is deferred to the Phase 10/12 retrospective when production data is available.

## Cache Prefix Discipline (D-17 verification)

- `buildPersonaSystemPrompt(slot)` is asserted byte-stable for identical slot inputs (Test 1).
- `selectPersonaSlots(contentType, niche)` is asserted deterministic (Test 7 of the registry — deeply-equal arrays for identical inputs).
- No `Date.now()`, `Math.random()`, request IDs, or salts in `makeSlot`, `buildPersonaSystemPrompt`, or `buildPersonaUserMessage` (verified by grep + tests).
- `tryUrlHost` is imported, not redefined (avoids two divergent copies of the PROFILE-16 helper).

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 3 — Blocking issue] Made SignalAvailability.personas optional**
   - **Found during:** Task 1
   - **Issue:** Adding `personas: boolean` (required) caused `aggregator.ts:330` to fail type-check because Plan 07-02 (not 07-01) owns the aggregator wiring.
   - **Fix:** Made the key `personas?: boolean` (optional). Documented inline that Plan 07-02 will (a) wire the key on the aggregator's `availability` object and (b) consider promoting to required.
   - **Files modified:** `src/lib/engine/types.ts`
   - **Commit:** `71dfa0b`

2. **[Rule 1 — Bug] Fixed FYP_ARCHETYPE_ORDER undefined-index access on 7-FYP rows**
   - **Found during:** Task 2 GREEN test run (initial attempt failed on `b_roll`/`action`)
   - **Issue:** `FYP_ARCHETYPE_ORDER[i]` accessed undefined when `i=6` (only 6 archetypes in the rotation, but row.fyp=7 for b_roll/action).
   - **Fix:** Added modulo wrap: `FYP_ARCHETYPE_ORDER[i % FYP_ARCHETYPE_ORDER.length]`. 7th slot duplicates `tough_crowd`, matching D-02's ~30% FYP-filter weighting. Added `slotIndex` param to `makeSlot` so persona_id stays unique across duplicates without breaking cache stability.
   - **Files modified:** `src/lib/engine/wave3/persona-registry.ts`
   - **Commit:** `7ef5462`

## Known Stubs

None. All exported functions and data tables are fully wired:
- `selectPersonaSlots` returns real 10-slot arrays for every input.
- `buildPersonaSystemPrompt` and `buildPersonaUserMessage` produce real strings.
- `PersonaResponseSchema` validates real LLM output shapes.

`NICHE_INSTANTIATION` placeholder cells are NOT stubs in the "code path returns empty" sense — they are real descriptive strings flagged for Phase 10/12 refinement based on corpus evidence (Open Question #2). The runtime path produces a non-empty system prompt for every {archetype × niche × time-of-day} combination.

## Test Pass Count

- 18 persona-registry tests pass
- 15 persona-prompts tests pass
- **33 wave3 tests pass total**
- 57 adjacent tests still pass (aggregator + stubs + taxonomy) — no regressions

## Cache Combinatorics

10 archetypes × 10 primary niches × 4 time-of-day tags = 400 theoretical {archetype × niche × time-of-day} tuples. In practice the rotation collapses to ≤240 unique tuples per run (because each archetype is deterministically tied to one time-of-day via `ARCHETYPES.indexOf(archetype) % 4`). Phase 7's $0.025/analysis cache-hit budget (D-16) is comfortably under DeepSeek's auto-cache eviction window after warmup.

## Plan 07-02 Hand-off

This plan delivers the foundation; Plan 07-02 will:
1. Import `selectPersonaSlots`, `PersonaSlot`, `buildPersonaSystemPrompt`, `buildPersonaUserMessage`, and `PersonaResponseSchema` from the new modules.
2. Fill the body of `wave3.ts` with `Promise.allSettled` over 10 DeepSeek calls.
3. Create `wave3/aggregator.ts` with the per-metric different rule (D-06) and 7-of-10 threshold (D-13).
4. Widen `pipeline.ts` to pass `wave0Result` + `creatorContext` to `runWave3` and surface `personaBehavioralAggregate` on `PipelineResult`.
5. Add the `availability.personas` key in `aggregator.ts` (and consider promoting to required on `SignalAvailability`).
6. Extend `corpus/eval-runner.ts` with the D-14 A/B lightweight eval.

All Plan 07-02 work consumes Plan 07-01 outputs unchanged.

## Self-Check: PASSED

- src/lib/engine/wave3/persona-registry.ts: FOUND
- src/lib/engine/wave3/persona-prompts.ts: FOUND
- src/lib/engine/__tests__/wave3-persona-registry.test.ts: FOUND
- src/lib/engine/__tests__/wave3-persona-prompts.test.ts: FOUND
- src/lib/engine/types.ts modified: FOUND
- src/lib/engine/wave0/prompts.ts modified (export tryUrlHost): FOUND
- Commit 71dfa0b (Task 1): FOUND
- Commit 7ef5462 (Task 2): FOUND
- Commit 9829562 (Task 3): FOUND
- 33/33 wave3 tests pass
- 0 regressions in adjacent test suites (57/57 aggregator + stubs + taxonomy tests pass)
- taxonomy.ts untouched (Pitfall 7 honored)
- wave3.ts / pipeline.ts / aggregator.ts untouched (Plan 07-02 scope honored)
