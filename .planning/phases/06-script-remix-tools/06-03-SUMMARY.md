---
phase: 06-script-remix-tools
plan: "03"
subsystem: script-backend
tags: [script, runner, sse-route, tdd, flash-gate, content-first, honesty-spine]
dependency_graph:
  requires: [06-01]
  provides: [runScriptPipeline, ScriptPipelineInput, ScriptPipelineResult, SCRIPT_OUTPUT_CONTRACT, POST /api/tools/script]
  affects: [open-thread, message-blocks, kc-stamp]
tech_stack:
  added: []
  patterns: [tdd-red-green, content-first-sse, opener-only-flash-gate, one-card]
key_files:
  created:
    - src/lib/tools/runners/script-runner.ts
    - src/lib/tools/runners/__tests__/script-runner.test.ts
    - src/app/api/tools/script/route.ts
    - src/app/api/tools/script/__tests__/route.test.ts
  modified: []
decisions:
  - "D-02 one-card: runScriptPipeline returns 0 or 1 script-card (not N ranked) — mirrors D-02 plan spec"
  - "D-01 opener-only gate: runFlashTextMode called once on openingBeatSeed with framing 'hook' — never full-script scan"
  - "Pitfall 5 content-first: content event ships beats+openingBeatSeed+scrollQuote; band/fraction deferred to score event"
  - "SCRIPT_OUTPUT_CONTRACT owned by runner (Pitfall 3 — contains literal 'json' so Qwen json_object mode works)"
  - "Self-judge: empty beats array dropped with warning, no regen loop (cost-bounded)"
  - "Follow-up Qwen turn non-fatal — caught silently so script-card delivery never blocks"
  - "Pre-existing TS error in hook route test (line 189) mirrors same destructuring pattern in script route test — out of scope"
metrics:
  duration: "6min"
  completed_date: "2026-06-18"
  tasks: 2
  files: 4
---

# Phase 06 Plan 03: Script Backend Summary

Script runner + SSE route landed — runScriptPipeline generates ONE script (D-02), gates ONLY the opening beat on Flash (D-01), returns a validated script-card. POST /api/tools/script authenticates first, caps input, persists to the open thread, and streams content-first.

## What Was Built

**Task 1 (TDD RED→GREEN): runScriptPipeline**

`script-runner.ts` cloning hooks-runner.ts structure with one-card semantics. `ScriptPipelineInput { ask, platform, profileRow, anchor? }` and `ScriptPipelineResult { blocks, warnings }` exported. `SCRIPT_OUTPUT_CONTRACT` contains the literal word "json" (Pitfall 3 — Qwen json_object mode requirement). Pipeline: `generateScriptStructured` calls Qwen with `KC_SCRIPT_SYSTEM_PROMPT + SCRIPT_OUTPUT_CONTRACT`, returns `{ beats[], openingBeatSeed }`. Self-judge gate drops empty beats array (no regen loop). Opener-only Flash gate: `runFlashTextMode(openingBeatSeed, "hook", panel)` called ONCE (D-01 honesty). `aggregateFlash(personas)` → `{band, fraction}` scoped to opener only (Pitfall 5). `selectLeadScrollQuote` ships lead quote on card face (D-04). `ScriptCardBlockSchema.safeParse` D-14 belt-and-suspenders — invalid card dropped with warning. 9 tests GREEN.

**Task 2 (AUTO): POST /api/tools/script**

`route.ts` cloning hooks/route.ts posture. Auth gate first (T-06-06). Server-side caps: `ask` ≤ 2000, `anchor` ≤ 5000 (WARNING-5 / T-06-09). `user_id` from session only (CR-01). Profile load (cold-start safe). `createOpenThreadLazy`. SSE stream: stage events (`Generating → Self-judge → Simulating your audience`), content event (beats+openingBeatSeed+scrollQuote face first), score event (opener band chip a beat later — content-first), `insertMessage` with `kcStamp().kcGenVersion` (D-10), non-fatal follow-up Qwen turn, done. 8 tests GREEN.

## Success Criteria — All Met

- runScriptPipeline returns ONE script-card (D-02): YES — 0 or 1 block, never N
- Opener-only Flash gate (D-01): YES — runFlashTextMode called once on openingBeatSeed
- Opener-scoped band honesty (Pitfall 5): YES — band/fraction from opener SIM only
- POST /api/tools/script: auth-first (T-06-06): YES — 401 before any DB/LLM
- Ask/anchor caps enforced: YES — 2000/5000 char server-side (WARNING-5)
- Script-card persisted to open thread: YES — insertMessage with KC_GEN_VERSION stamp
- Content-first SSE: YES — content (face) → score (band chip) → followup → done
- Zero new SIM calibration: YES — Flash gate reused unchanged

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. ScriptCardRenderer "Test full →" CTA stub was tracked in 06-01-SUMMARY.md and is intentional (wired in 06-05). This plan adds no new stubs.

## Threat Flags

None. T-06-06 through T-06-10 all mitigated as planned. No unplanned trust boundary surface added.

## TDD Gate Compliance

- RED gate: `test(06-03): add failing tests for runScriptPipeline` (d17ad8b7) — confirmed failing before implementation
- GREEN gate: `feat(06-03): runScriptPipeline` (b6974c13) — 9 tests pass
- Route RED gate: `test(06-03): add failing tests for POST /api/tools/script route` (9b843cc6)
- Route GREEN gate: `feat(06-03): POST /api/tools/script SSE route` (7e2efded) — 8 tests pass

## Self-Check: PASSED

Files:
- FOUND: src/lib/tools/runners/script-runner.ts
- FOUND: src/lib/tools/runners/__tests__/script-runner.test.ts
- FOUND: src/app/api/tools/script/route.ts
- FOUND: src/app/api/tools/script/__tests__/route.test.ts

Commits:
- d17ad8b7: test(06-03): add failing tests for runScriptPipeline (RED)
- b6974c13: feat(06-03): runScriptPipeline (GREEN — 9 tests)
- 9b843cc6: test(06-03): add failing tests for POST /api/tools/script route (RED)
- 7e2efded: feat(06-03): POST /api/tools/script SSE route (GREEN — 8 tests)
