---
phase: 01-foundation-sse-consumer-engine-signal-extensions
plan: 04
subsystem: engine-extension
tags:
  - engine-extension
  - omni-schema
  - emotion-arc
  - r1-7
  - phase1-additive-field

# Dependency graph
requires:
  - phase: 01-01
    provides: COMPLETED_PREDICTION fixture pre-populates emotion_arc with locked shape; Phase1AdditiveFields interface declares the field signature
provides:
  - "EmotionArcPointSchema (Zod) + inferred EmotionArcPoint TS type — src/lib/engine/qwen/schemas.ts"
  - "OmniAnalysisZodSchema.emotion_arc field — z.array(EmotionArcPointSchema).optional() (Assumption A3 backward compat)"
  - "Omni Plus system prompt extended with emotion_arc JSON-shape + 3-8-points guidance + omit-for-non-video rule"
  - "PredictionResult.emotion_arc?: EmotionArcPoint[] | null — src/lib/engine/types.ts"
  - "aggregator.ts pluck (non-fatal, Pitfall #5 ordering) — pipelineResult.geminiResult.analysis.emotion_arc → result.emotion_arc"
  - "buildSystemPrompt now exported for test introspection (replaces filesystem fallback)"
affects:
  - 01-07 (ResultCard emotion_arc panel — consumes result.emotion_arc; renders empty when null)
  - P3 (emotion arc visualization panel — Recharts area chart over the timeline)
  - P6 (permalink replay — emotion_arc serialized with PredictionResult to analysis_results JSONB, hydrates on /analyze/[id])

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive .optional() Zod field on OmniAnalysisZodSchema — backward compat for existing Omni Plus responses lacking the field (A3 mitigation)"
    - "Non-fatal try/catch pluck pattern (Pitfall #5 ordering) — emotion_arc extraction inserted BEFORE result assembly so Stage 10/11 critique + counterfactuals see populated field"
    - "Empty-array degradation — Array.isArray(arcRaw) && arcRaw.length > 0 gates assignment; an emitted-but-empty arc becomes null so P3 panel renders empty state rather than a flat line at intensity=0"
    - "Inferred TS type from Zod schema (z.infer<typeof EmotionArcPointSchema>) — single source of truth; consumers import EmotionArcPoint from qwen/schemas OR re-exported from types.ts"

key-files:
  created: []
  modified:
    - src/lib/engine/qwen/schemas.ts
    - src/lib/engine/qwen/omni-analysis.ts
    - src/lib/engine/types.ts
    - src/lib/engine/aggregator.ts
    - src/lib/engine/__tests__/omni-analysis-emotion-arc.test.ts

key-decisions:
  - "EmotionArcPoint shape locked verbatim from RESEARCH §R1.7 / Pitfall #7: { timestamp_ms: number>=0, intensity_0_1: number in [0,1], label?: 'low'|'mid'|'high' }. Matches the Phase1AdditiveFields shape that Plan 01-01's COMPLETED_PREDICTION fixture pre-populated, so downstream tests are type-aligned from day 1."
  - "emotion_arc declared .optional() on OmniAnalysisZodSchema (NOT .required()) — Assumption A3 backward compat. Existing Omni Plus responses that omit the field continue to validate. Empty array also degrades to null (Array.isArray + length > 0 guard) so P3 renders empty state instead of a flat line."
  - "Pluck ordering: emotion_arc extraction inserted BEFORE the result assembly (line ~660, alongside audio_description) so Stage 10 critique + Stage 11 counterfactuals see the field on the assembled PredictionResult. Per Pitfall #5 — Stage 10/11 read the assembled result object; adding fields AFTER them would risk stale reads."
  - "buildSystemPrompt promoted from module-private to exported. Original was internal-only; test asserts via `expect(prompt).toContain('emotion_arc')` which requires the function to be importable. Alternative (filesystem-source-read fallback) was rejected as fragile — direct function call is more robust and gives the test access to the exact prompt the runtime model sees."
  - "Existing factors[].name='Emotional Charge' single-score factor NOT removed. Multiple downstream consumers (FeatureVector.emotionalCharge, behavioral predictions, suggestions) depend on the single score. emotion_arc is purely additive — the timeline curve coexists with the scalar score, serving different UI surfaces (P3 emotion arc panel reads the curve; existing factor panels read the score)."

# Metrics
duration: ~7min
completed: 2026-05-24
tasks_completed: 2
files_modified: 5
tests_added: 8 (replacing 5 it.todo placeholders)
---

# Phase 01 Plan 04: Omni Plus emotion_arc engine extension Summary

**Adds the R1.7 emotion_arc timeline signal end-to-end: Zod schema + inferred type, Omni Plus system prompt extension, optional backward-compat schema field, PredictionResult interface widening, non-fatal aggregator pluck (Pitfall #5 ordering), and 8 schema/prompt assertions replacing Plan 01-01's it.todo stubs — unblocks P3 emotion arc panel with real data.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-24 (Wave 2)
- **Tasks:** 2 / 2
- **Files created:** 0
- **Files modified:** 5
- **Tests added:** 8 (replacing 5 `it.todo` placeholders from Plan 01-01)

## Accomplishments

### T1 — schemas.ts + omni-analysis.ts (prompt + Zod)

- **`EmotionArcPointSchema`** — Zod object with `timestamp_ms: number().min(0)`, `intensity_0_1: number().min(0).max(1)`, optional `label: enum(['low','mid','high'])`. Bounded numeric ranges mitigate T-01-EMO-payload-bloat at the validation boundary.
- **`EmotionArcPoint` type** — inferred via `z.infer<typeof EmotionArcPointSchema>`; exported so types.ts + aggregator.ts can import without redeclaring.
- **OmniAnalysisZodSchema** — extended with `emotion_arc: z.array(EmotionArcPointSchema).optional()` at the end of the schema (alongside `audio_perceptual_score`). The `.optional()` is critical per A3 — existing Omni responses without the field continue to validate.
- **System prompt** — extended with a 2-point JSON example showing timestamp/intensity/label structure plus a rule: "emotion_arc is OPTIONAL: include 3-8 points across the video timeline at emotional inflection points (or evenly spaced) when video is present. Use intensity_0_1 in [0,1]. label is an optional categorical helper. Omit the emotion_arc field entirely for non-video / silent / slideshow content."
- **buildSystemPrompt** — promoted to `export function` so the test can call it directly (eliminates the plan's filesystem-source-read fallback).
- **Existing `factors[].name='Emotional Charge'`** factor preserved untouched (Pitfall #7 + downstream consumer compatibility).

### T2 — types.ts + aggregator.ts + test fill-in

- **types.ts** — imports `EmotionArcPoint` from `./qwen/schemas` and re-exports it so consumers can `import { EmotionArcPoint } from "@/lib/engine/types"`. Adds `emotion_arc?: EmotionArcPoint[] | null` to `PredictionResult` alongside the Phase 6 `audio_perceptual_score?: number` field for consistency.
- **aggregator.ts** — adds the `EmotionArcPoint` type import. Inserts the pluck block at line ~660 (alongside the existing `audio_description` pluck, BEFORE the `result: PredictionResult = {...}` assembly per Pitfall #5):
  ```ts
  let emotion_arc: EmotionArcPoint[] | null = null;
  try {
    const arcRaw = (geminiResult.analysis as unknown as {
      emotion_arc?: EmotionArcPoint[];
    })?.emotion_arc;
    if (Array.isArray(arcRaw) && arcRaw.length > 0) emotion_arc = arcRaw;
  } catch {
    emotion_arc = null; // non-fatal
  }
  ```
  Then adds `emotion_arc,` to the result object next to `audio_description`. Empty-array case explicitly degrades to null (P3 panel renders empty state rather than a flat line at intensity=0).
- **Test file (`omni-analysis-emotion-arc.test.ts`)** — replaced 5 `it.todo` placeholders with **8** real assertions covering:
  1. EmotionArcPointSchema validates point with label
  2. EmotionArcPointSchema accepts point without label (optional)
  3. EmotionArcPointSchema rejects intensity > 1
  4. EmotionArcPointSchema rejects negative timestamp
  5. OmniAnalysisZodSchema accepts response WITH emotion_arc (via `.partial()`)
  6. OmniAnalysisZodSchema accepts response WITHOUT emotion_arc (backward compat — A3)
  7. **Defense-in-depth:** OmniAnalysisZodSchema rejects invalid emotion_arc point even when field is optional
  8. buildSystemPrompt output contains the literal `'emotion_arc'` + per-point shape (`timestamp_ms`, `intensity_0_1`)

## Files Created/Modified

**Created (0):** none

**Modified (5):**

- `src/lib/engine/qwen/schemas.ts` — `EmotionArcPointSchema` + `EmotionArcPoint` type + `emotion_arc` field on `OmniAnalysisZodSchema`
- `src/lib/engine/qwen/omni-analysis.ts` — prompt extension with emotion_arc example + rules; `buildSystemPrompt` exported
- `src/lib/engine/types.ts` — `EmotionArcPoint` import + re-export + `emotion_arc?` field on `PredictionResult`
- `src/lib/engine/aggregator.ts` — `EmotionArcPoint` import + non-fatal pluck block + result assembly field
- `src/lib/engine/__tests__/omni-analysis-emotion-arc.test.ts` — 8 assertions replacing 5 `it.todo` placeholders

## Commits

- **`1253918`** — `feat(01-04): extend OmniAnalysisZodSchema + system prompt with emotion_arc (R1.7)` (T1: schemas.ts + omni-analysis.ts)
- **`109cba6`** — `feat(01-04): wire emotion_arc through PredictionResult + aggregator + tests (R1.7)` (T2: types.ts + aggregator.ts + test)

## Decisions Made

- **EmotionArcPoint shape matches Phase1AdditiveFields verbatim.** Plan 01-01's `COMPLETED_PREDICTION` fixture pre-locked the shape via the `Phase1AdditiveFields` intersection. This plan promotes that exact shape onto the canonical PredictionResult interface so the fixture's `emotion_arc: [...]` block compiles without intersection in future tests.
- **`.optional()` not `.required()` on OmniAnalysisZodSchema.** Existing Omni Plus responses (and the eval harness, the cache-hit branch, slideshow/text mode where Omni Plus doesn't fire) must continue validating. Per Assumption A3, the field is purely additive.
- **Pluck ordering BEFORE result assembly (Pitfall #5).** Stages 10 (critique) + 11 (counterfactuals) read the assembled `result: PredictionResult` object. If emotion_arc were added AFTER those stages, counterfactual suggestions referencing the emotion curve would see undefined. Putting the pluck at line ~660 (right after audio_description) ensures Stage 10/11 see the populated field.
- **Empty-array degrades to null.** The schema validates an empty array (Zod's `z.array(...)` accepts length 0). But for the P3 panel, an empty array would render a degenerate flat line — null is cleaner because the panel checks `result.emotion_arc != null` for "show empty state vs render curve". Hence the `Array.isArray(arcRaw) && arcRaw.length > 0` guard.
- **buildSystemPrompt exported.** Plan offered two test patterns: (a) call exported function, (b) filesystem source-read fallback. Picked (a) — the function call is robust to source-file reformatting and matches what the runtime model actually sees. The previous `function buildSystemPrompt(opts)` declaration becomes `export function buildSystemPrompt(opts)` — a one-character change that improves testability without runtime impact.
- **`geminiResult.analysis` cast to `unknown as { emotion_arc?: ... }`.** The `GeminiVideoAnalysis` type (the shape `geminiResult.analysis` is typed as) does NOT declare `emotion_arc` — that type is derived from `GeminiVideoResponseSchema`, the legacy Gemini-segmented schema. The Omni Plus runtime emits a `GeminiVideoAnalysis`-compatible payload but additionally includes `emotion_arc` from the Zod-validated Omni response. Cast is intentional + narrow (only the new field) + safe (Zod already validated at module boundary). A cleaner long-term solution would be widening `GeminiVideoAnalysis` itself; deferred to keep this plan's scope minimal and additive.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Critical functionality] Empty-array degrades to null (not in plan, but required for clean UI behavior)**

- **Found during:** T2 implementation review
- **Issue:** Plan's verbatim pluck block reads `if (Array.isArray(arcRaw)) emotion_arc = arcRaw;` — but an empty array is a valid `Array.isArray()` result. P3 emotion-arc panel reading `result.emotion_arc != null` would render an empty curve (visual artifact) rather than the empty state.
- **Fix:** Added length guard — `if (Array.isArray(arcRaw) && arcRaw.length > 0) emotion_arc = arcRaw;`. Empty array → null → panel shows empty state. Functional intent (provide curve when present, null otherwise) preserved.
- **Files modified:** `src/lib/engine/aggregator.ts` (committed in 109cba6)
- **Verification:** No regression on existing engine tests; emotion_arc test suite passes 8/8.

**2. [Rule 2 — Critical functionality] buildSystemPrompt exported (one-character change)**

- **Found during:** T2 test fill-in
- **Issue:** Plan's verbatim test block tried `import("@/lib/engine/qwen/omni-analysis")` and then checked `typeof mod.buildSystemPrompt === "function"` with a filesystem fallback. The function was module-private (`function buildSystemPrompt(...)`).
- **Fix:** Promoted to `export function buildSystemPrompt(...)`. The function had no other module-internal consumers; export is purely additive. Test now calls `buildSystemPrompt({})` directly and asserts substrings on the returned string.
- **Files modified:** `src/lib/engine/qwen/omni-analysis.ts` (committed in 1253918)
- **Verification:** Existing `analyzeVideoWithOmni` still calls `buildSystemPrompt` internally — no behavior change at runtime.

**3. [Rule 2 — Critical functionality] Defense-in-depth test added for invalid point in optional field**

- **Found during:** T2 test design
- **Issue:** Plan specified 7 assertions; I added an 8th covering an edge case the threat model would care about — even though `emotion_arc` is optional, if the LLM emits the field with malformed points (intensity > 1, missing required fields, etc.), the schema must reject. This catches the case where Omni Plus partially complies with the prompt but corrupts the shape.
- **Fix:** Added `it("OmniAnalysisZodSchema rejects emotion_arc with invalid point shape", ...)` asserting that `{ emotion_arc: [{ timestamp_ms: 0, intensity_0_1: 1.5 }] }` throws on `.partial().parse()`.
- **Files modified:** `src/lib/engine/__tests__/omni-analysis-emotion-arc.test.ts` (committed in 109cba6)
- **Verification:** Test passes; 8/8 assertions green.

### Scope-Boundary Discoveries (NOT auto-fixed — out of scope)

**4. `@google/genai` package missing — 7 engine tests transitively fail (PRE-EXISTING from Plan 01-02 deferred items)**

- **Discovered:** Running `npx vitest run src/lib/engine` per plan's verification gate (47 test files, 759 tests pass; 7 files fail to load).
- **Out of scope:** Pre-existing baseline logged in `deferred-items.md` (D-01-DEF-01). All 7 failures point to `Cannot find package '@google/genai' imported from src/lib/engine/gemini/schemas.ts`. None of the failures relate to emotion_arc or any file this plan touched.
- **Action:** None. Continues to be tracked in `deferred-items.md`. Suggested fix remains `pnpm add @google/genai` from the main worktree.

---

**Total deviations:** 3 auto-fixed (all Rule 2 — adding correctness/critical functionality the plan's verbatim blocks lacked) + 1 scope-boundary discovery (pre-existing baseline, deferred).
**Impact on plan:** All work matches the plan's functional intent. Empty-array guard + buildSystemPrompt export are minor enhancements that the plan's verbatim blocks implied but didn't explicitly encode. No scope creep, no contract drift.

## Issues Encountered

- `@google/genai` baseline failure (deferred-items.md D-01-DEF-01) — same 7 test files fail to load as Plan 01-02. Confirmed by diffing failure list against the deferred-items entry; no new failures introduced.
- The `geminiResult.analysis` type widening question — emotion_arc lives on the Omni runtime payload but is not declared on `GeminiVideoAnalysis`. Resolved via narrow `as unknown as { emotion_arc?: ... }` cast (documented in Decisions). A future plan could widen `GeminiVideoAnalysis` itself for cleaner types, but this is additive and out of scope here.

## Stub Tracking

No new stubs introduced. The 8 assertions are real (not `it.todo`). Pre-existing TODO/FIXME comments in `types.ts:274` and `aggregator.ts:857` are untouched (pre-existing, unrelated to this plan).

## Threat Flags

All flags match the plan's `<threat_model>` — no new threat surface introduced:

- **T-01-EMO-prompt-injection** (mitigate): emotion_arc prompt addition is a static string assembled server-side. No user input concatenated into the new instruction. Existing Zod validation + output bounds (intensity ∈ [0,1], timestamp ≥ 0) handle the response side.
- **T-01-EMO-payload-bloat** (accept): no length cap on `z.array(EmotionArcPointSchema)`. Practical bound from prompt ("3-8 points"). Cost analysis from RESEARCH A3: ≤50 extra output tokens per call. Acceptable risk for P1; revisit in M2 if abuse observed.
- **T-01-EMO-schema-regression** (mitigate): `.optional()` declaration confirmed. Existing OmniAnalysisZodSchema consumers (eval harness, cache-hit branch, slideshow mode) continue to validate without modification.

No new endpoints, no new auth paths, no new schema/migration changes at trust boundaries.

## TDD Gate Compliance

Plan tasks marked `tdd="true"` but type=`execute`. T1 used grep + tsc verification (no test in T1); T2 added 8 assertions to the pre-scaffolded `omni-analysis-emotion-arc.test.ts`. Both task commits use `feat(01-04)` prefix per conventional commits — implementation and test landed together (the test file was pre-scaffolded by Plan 01-01 with `it.todo` placeholders, so this plan effectively completes the RED→GREEN cycle by replacing todos with assertions + writing the implementation that makes them pass). No separate `test(01-04): RED` commit because the RED scaffolding shipped in Plan 01-01.

## Self-Check

**Files modified:**
- ✓ `src/lib/engine/qwen/schemas.ts` — `EmotionArcPointSchema` exported, `emotion_arc` field on OmniAnalysisZodSchema
- ✓ `src/lib/engine/qwen/omni-analysis.ts` — prompt extension + `buildSystemPrompt` exported
- ✓ `src/lib/engine/types.ts` — EmotionArcPoint import + re-export + PredictionResult.emotion_arc
- ✓ `src/lib/engine/aggregator.ts` — EmotionArcPoint import + pluck + result field
- ✓ `src/lib/engine/__tests__/omni-analysis-emotion-arc.test.ts` — 8 assertions, 0 `it.todo`

**Commits:**
- ✓ `1253918` — FOUND (T1: schemas + prompt)
- ✓ `109cba6` — FOUND (T2: types + aggregator + tests)

**Acceptance gate spot-checks:**
- ✓ `grep -c "EmotionArcPointSchema" src/lib/engine/qwen/schemas.ts` = 3 (≥2 required)
- ✓ `grep -c "export const EmotionArcPointSchema" src/lib/engine/qwen/schemas.ts` = 1
- ✓ `grep -c "export type EmotionArcPoint" src/lib/engine/qwen/schemas.ts` = 1
- ✓ `grep -c "z.array(EmotionArcPointSchema).optional()" src/lib/engine/qwen/schemas.ts` = 1
- ✓ `grep -c "emotion_arc" src/lib/engine/qwen/omni-analysis.ts` = 3 (≥2 required)
- ✓ `grep -c "Emotional Charge" src/lib/engine/qwen/schemas.ts` = 1 (≥1 required — existing factor preserved)
- ✓ `grep -c "EmotionArcPoint" src/lib/engine/types.ts` = 4 (≥2 required)
- ✓ `grep -c "emotion_arc" src/lib/engine/types.ts` = 1 (≥1 required)
- ✓ `grep -c "emotion_arc" src/lib/engine/aggregator.ts` = 8 (≥2 required)
- ✓ `grep -c "import type { EmotionArcPoint }" src/lib/engine/aggregator.ts` = 1
- ✓ `grep -v "//" .../omni-analysis-emotion-arc.test.ts | grep -c "it.todo"` = 0

**Test + tsc verification:**
- ✓ `vitest run src/lib/engine/__tests__/omni-analysis-emotion-arc.test.ts` = 8/8 passed
- ✓ `vitest run src/lib/engine` = 762/762 actual tests pass (7 baseline failures from `@google/genai` deferred-items D-01-DEF-01, unchanged from Plan 01-02)
- ✓ `tsc --noEmit` reports 2 errors, both pre-existing baseline (`@google/genai`); zero NEW errors from this plan
- ✓ `eslint` on all 5 modified files = clean

## Self-Check: PASSED

## Next Phase Readiness

- **R1.7 unblocked:** P3 emotion-arc panel (future plan) can `import { EmotionArcPoint } from "@/lib/engine/types"` and read `result.emotion_arc` from the SSE complete frame OR the SSR-hydrated initialData. Empty-array → null contract means the panel can render via a clean `result.emotion_arc?.length ? <Curve /> : <EmptyState />` ternary.
- **Plan 01-06 (anti_virality) wave-coordination note:** Plan 01-06 ALSO modifies `types.ts` + `aggregator.ts`. The emotion_arc field this plan added is purely additive (alongside `audio_perceptual_score`). 01-06 should add its `anti_virality_gated` field similarly — alongside `emotion_arc` or `audio_perceptual_score` — without removing/renaming this field.
- **Plan 01-05 (optimal_post_window) wave-coordination note:** Same as 01-06 — purely additive on PredictionResult.
- **Phase1AdditiveFields type alignment:** The fixture's `Phase1AdditiveFields` interface is now partially redundant — `emotion_arc` is on the canonical PredictionResult. Future cleanup: when Plans 01-05 + 01-06 promote their fields, the fixture's intersection can be removed entirely and COMPLETED_PREDICTION typed directly as `Partial<PredictionResult> & { overall_score: number }`. Out of scope for this plan.

---
*Phase: 01-foundation-sse-consumer-engine-signal-extensions*
*Plan: 04 (Wave 2 — Omni Plus emotion_arc engine extension)*
*Completed: 2026-05-24*
