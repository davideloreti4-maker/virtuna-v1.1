---
phase: 04-hooks-tool
plan: 02
subsystem: hooks-pipeline
tags: [hooks-runner, sse-route, develop-replacement, gate-then-rank, tdd, vitest, d-01, d-02, d-03, d-04, d-07, d-08, d-10, hooks-01, hooks-02]

# Dependency graph
requires:
  - phase: 04-hooks-tool
    plan: 01
    provides: "HookCardBlock schema + HookCardBlockSchema, deriveAudienceArchetype, hook-card registry entry"
  - phase: 03-ideas-tool
    plan: 03
    provides: "ideas-runner.ts stage structure (generate→SIM→gate→build), /develop PINNED contract, SSE pattern"
  - phase: 01-engine-thread-foundation
    provides: "runFlashTextMode('hook' framing), aggregateFlash, MIXED_THRESHOLD, insertMessage, createOpenThreadLazy"
  - phase: 02-knowledge-core-generative-rebuild
    provides: "KC_HOOKS_SYSTEM_PROMPT (byte-stable, KC_BASE + KC_HOOKS_SLICE), kcStamp()"
provides:
  - "runHooksPipeline: over-generate→parallel-niche-SIM→gate(band!=='Weak')→RANK(band tier→fraction)→top-5 hook-card blocks"
  - "POST /api/tools/hooks SSE route: auth→cap→pipeline→content-first stream→insertMessage(KC_GEN_VERSION stamped)"
  - "/api/tools/ideas/develop: placeholder REMOVED — now runs real Hooks generation while preserving pinned response contract"
affects: [04-hooks-tool plan 03 (UI wiring), the /develop 'Develop this →' CTA (messageId now = real hooks message)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GATE THEN RANK (D-01): over-generate→gate(Weak drop)→rank(band tier→fraction tie-break)→top-5 — distinct from Ideas (gate only, no rank)"
    - "Rank comparator: bandOrdinal(Strong=0,Mixed=1) primary; parseFractionNumerator descending secondary; generationIndex ascending tie-break"
    - "HOOKS_OUTPUT_CONTRACT: static json_object directive (DashScope 'json' word requirement — 03-04 bug #3 pattern)"
    - "Content-first SSE: face(hookLine+audienceArchetype+rank+scrollQuote) event before score(band+fraction) event per card"

key-files:
  created:
    - src/lib/tools/runners/hooks-runner.ts
    - src/app/api/tools/hooks/route.ts
    - src/lib/tools/runners/__tests__/hooks-runner.test.ts
    - src/app/api/tools/hooks/__tests__/route.test.ts
  modified:
    - src/app/api/tools/ideas/develop/route.ts
    - src/app/api/tools/ideas/__tests__/route.test.ts

key-decisions:
  - "HOOK_BUFFER=8 (over-generate), MAX_HOOKS=5 (top survivors after rank)"
  - "Rank comparator: band tier (Strong=0 > Mixed=1) primary → fraction numerator descending secondary → generation order tie-break"
  - "HOOKS_OUTPUT_CONTRACT lives in the runner (owns json_object mode); requests mechanism as PROSE (not craft slug — D-04)"
  - "/develop: runHooksPipeline(ask='', platform, profileRow, anchor) replaces placeholder; fencedHooksBundle still returned for back-compat"
  - "ideas/develop test updated: mock includes .from() chain (profile load) + hooks-runner mock (D-07 real generation path)"

# Metrics
duration: ~8min
completed: 2026-06-18
---

# Phase 04 Plan 02: Hooks Pipeline — Runner + SSE Route + /develop Real Generation Summary

**Over-generate→niche-SIM→gate(Weak drop)→rank(band tier→fraction)→top-5 Hooks pipeline — the flagship moat mechanism server-side, streaming content-first into the open thread.**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-06-18
- **Tasks:** 2 of 2 (both TDD RED/GREEN)
- **Files created:** 4
- **Files modified:** 2

## Plan-03 Handoff (MANDATORY — 3 contracts)

### 1. Hooks Route SSE Event Contract

```
POST /api/tools/hooks { ask?, platform, anchor? }

event: status   { message: "Generating hooks…" }
event: status   { message: "Scoring on your audience…" }
event: content  {
  blocks: [
    {
      type: "hook-card",
      props: {
        hookLine: string,           // verbatim/executable hook text
        audienceArchetype: string,  // D-03 audience tag ("Stops the skeptic", etc.)
        mechanism: string,          // attention mechanism prose
        seedHook: string,
        rank: number,               // D-01: 1..N, bands non-increasing
        scrollQuote: string,        // D-02/D-04: lead quote ON THE FACE
        model: "sim1-flash",
        channel: string | null,
        // band/fraction deferred to score events (content-first)
      }
    }, ...
  ]
}
event: score    { seedHook, rank, band, fraction, model }  // per card, a beat after content
event: done     { count: number }
```

### 2. Pipeline constants + rank comparator

- **HOOK_BUFFER:** 8 (over-generate target)
- **MAX_HOOKS:** 5 (top survivors kept after gate + rank — D-08)
- **Gate floor:** `band !== "Weak"` (stops ≥ MIXED_THRESHOLD=3 — Plan-01 contract)
- **Rank comparator:**
  1. Band tier: Strong (ordinal 0) > Mixed (ordinal 1) — Strong always ranks above Mixed
  2. Fraction tie-break: higher stop-count numerator descending (e.g. "8/10 stop" > "5/10 stop")
  3. Final tie-break: generation order (first generated = first ranked)
- **Ranking is QUALITATIVE** (band word + fraction + sim1-flash tag — D-02). NO fabricated numeric pull-score, NO view-count promise (ENGINE-03).

### 3. /develop: placeholder removed, pinned response shape preserved

`POST /api/tools/ideas/develop { ideaId?, anchor, platform }`

**Before (P3):** Wrote a markdown placeholder block to the open thread.
**Now (P4 D-07):** Runs `runHooksPipeline({ ask: "", platform, profileRow, anchor })` inline, persists real ranked hook-card blocks, returns the **same pinned shape:**

```ts
{ threadId: string, messageId: string, fencedHooksBundle: string, ideaId: string | null }
```

- `messageId` now = the real hooks message row id (not placeholder)
- `fencedHooksBundle` still returned for back-compat (generation happened server-side)
- Plan 03's "Develop this →" CTA needs **no change** — it reads the thread back to render blocks

## Task Commits

| # | Phase | Commit | Description |
|---|-------|--------|-------------|
| 1 RED | TDD | b5609df6 | test(04-02): failing hooks-runner tests (RED) |
| 1 GREEN | TDD | 2c09a09e | feat(04-02): hooks-runner — over-generate→niche-SIM→gate→rank→top-5 |
| 2 RED | TDD | 1165d21b | test(04-02): failing hooks route + /develop replacement tests (RED) |
| 2 GREEN | TDD | 7048a961 | feat(04-02): Hooks SSE route + /develop real generation |

## Files Created/Modified

- `src/lib/tools/runners/hooks-runner.ts` — NEW: `runHooksPipeline` (over-generate→SIM→gate→rank→top-5)
- `src/app/api/tools/hooks/route.ts` — NEW: `POST /api/tools/hooks` SSE route
- `src/lib/tools/runners/__tests__/hooks-runner.test.ts` — NEW: 9 tests (TDD RED→GREEN)
- `src/app/api/tools/hooks/__tests__/route.test.ts` — NEW: 10 tests (TDD RED→GREEN)
- `src/app/api/tools/ideas/develop/route.ts` — MODIFIED: placeholder REMOVED, real Hooks generation (D-07)
- `src/app/api/tools/ideas/__tests__/route.test.ts` — MODIFIED: updated mock for profile load + hooks-runner mock

## Decisions Made

- **GATE THEN RANK:** hooks are atomic, discriminable first-2s units — ranking survivors is legitimate and IS the flagship demo. Ideas use gate-only (no rank); hooks add the rank step after the gate. This is the structural distinction between the two pipelines.
- **HOOK_BUFFER=8:** over-generate 8 to get 5 survivors after gate; mirrors Ideas IDEA_BUFFER=5→3 ratio, scaled for hooks (need more diversity options for a tighter gate).
- **Rank comparator:** band tier primary (Strong always above Mixed — honesty spine), fraction descending secondary (tougher-crowd stop = stronger pull signal), generation order tie-break (deterministic, no fabrication).
- **HOOKS_OUTPUT_CONTRACT:** owned by the runner (mirrors IDEAS_OUTPUT_CONTRACT pattern). Requests `mechanism` as plain prose — explicitly NOT a craft-archetype slug (D-04). DashScope requires literal "json" in messages for json_object mode.
- **/develop inline generation:** rather than a deferred webhook, the develop endpoint now blocks on runHooksPipeline and returns the real messageId. Simpler, consistent with the thread model — the thread always holds real content.
- **ideas/develop test update:** existing test mocked createClient without `.from()` — the new profile load breaks it. Fixed by adding `.from()` chain to mock + adding hooks-runner mock. This is a Rule 1 auto-fix (test mock didn't match updated implementation).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ideas/develop existing test mock missing .from() chain**
- **Found during:** Task 2 GREEN (full test suite run)
- **Issue:** `src/app/api/tools/ideas/__tests__/route.test.ts` test "appends Hooks placeholder to open thread" mocked `createClient` without `.from()`. The new /develop route now loads `creator_profiles` via `supabase.from()` — the old mock caused `TypeError: supabase.from is not a function`.
- **Fix:** Added `.from/.select/.eq/.maybeSingle` chain to the mock + added `hooks-runner` vi.mock() at the top of the file (new route imports it).
- **Files modified:** `src/app/api/tools/ideas/__tests__/route.test.ts`
- **Commit:** 7048a961 (bundled with GREEN implementation commit)

## Known Stubs

None — all pipeline stages are fully wired:
- `runHooksPipeline`: real Qwen generation + real Flash SIM + real aggregation + real block assembly
- `/api/tools/hooks`: real SSE route with insertMessage persistence
- `/develop`: real Hooks generation (placeholder entirely removed)

## Threat Flags

No new threat surface beyond what the plan's threat model covers. All T-04-03 through T-04-09 mitigations applied:
- T-04-03: `supabase.auth.getUser()` before any DB read on both routes
- T-04-04: profile load by session `user.id`, never request body
- T-04-05: `assembleBundle` injection fence applied to `ask` + `anchor` inside `runHooksPipeline`'s assembler call
- T-04-06: server-side ask/anchor caps (400) on both routes, independent of client; bounded ~8 over-generate, no regen
- T-04-07: `insertMessage` re-validates all hook-card blocks at write boundary (D-14)
- T-04-08: `getQwenClient` / `QWEN_REASONING_MODEL` only inside runner — no Claude/Gemini/DeepSeek
- T-04-09: ranking is qualitative (band+fraction+sim1-flash tag); no numeric pull-score, no view-count promise

## Self-Check: PASSED

- `src/lib/tools/runners/hooks-runner.ts`: FOUND (exports runHooksPipeline)
- `src/app/api/tools/hooks/route.ts`: FOUND (exports POST)
- `src/app/api/tools/ideas/develop/route.ts`: FOUND (runHooksPipeline called, placeholder removed)
- `src/lib/tools/runners/__tests__/hooks-runner.test.ts`: FOUND (9 tests, all PASS)
- `src/app/api/tools/hooks/__tests__/route.test.ts`: FOUND (10 tests, all PASS)
- Commit b5609df6 (RED test runner): FOUND
- Commit 2c09a09e (GREEN runner): FOUND
- Commit 1165d21b (RED test route): FOUND
- Commit 7048a961 (GREEN route + /develop): FOUND
- npx vitest run hooks-runner.test.ts: 9 PASS, 0 FAIL
- npx vitest run route.test.ts (hooks): 10 PASS, 0 FAIL
- npm test: 238 PASS, 0 FAIL (2409 tests)
- npm run build: Compiled successfully
