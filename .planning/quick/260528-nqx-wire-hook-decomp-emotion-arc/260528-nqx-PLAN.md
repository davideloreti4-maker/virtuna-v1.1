---
quick_id: 260528-nqx
phase: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/engine/aggregator.ts
  - src/lib/engine/__tests__/aggregator.test.ts
  - src/components/board/content-analysis/__tests__/ContentAnalysisFrame.test.tsx
autonomous: true
requirements:
  - PHASE-2-SC1  # aggregator no longer returns null-shaped hook_decomposition / emotion_arc on happy path
  - PHASE-2-SC2  # hook + arc nodes render populated decomposition (no "(unavailable)" copy)
  - PHASE-2-SC3  # new aggregator unit tests cover populated path
must_haves:
  truths:
    - "aggregateScores returns a PredictionResult with hook_decomposition populated when geminiResult.analysis.hook_decomposition is present"
    - "aggregateScores returns a PredictionResult with emotion_arc populated when geminiResult.analysis.emotion_arc is a non-empty array"
    - "Both fields remain null (non-fatal) when Gemini output omits them — backward compat preserved"
    - "HookDecompNode renders score bars (not COPY.HOOK_DECOMP_UNAVAILABLE) when given the engine's runtime hook_decomposition shape"
    - "EmotionArcNode renders the chart (not COPY.EMOTION_ARC_UNAVAILABLE) when given the engine's runtime emotion_arc shape"
  artifacts:
    - path: "src/lib/engine/aggregator.ts"
      provides: "Populated hook_decomposition pluck + assembly into PredictionResult.result"
    - path: "src/lib/engine/__tests__/aggregator.test.ts"
      provides: "Unit coverage for populated + omitted paths for both fields"
    - path: "src/components/board/content-analysis/__tests__/ContentAnalysisFrame.test.tsx"
      provides: "Component test asserting nodes render real data shape, no unavailable copy"
  key_links:
    - from: "src/lib/engine/aggregator.ts (PredictionResult assembly @ ~L1080)"
      to: "src/components/board/content-analysis/ContentAnalysisFrame.tsx (result.hook_decomposition / result.emotion_arc reads)"
      via: "useAnalysisStream → setResult(PredictionResult) → <HookDecompNode decomp={result.hook_decomposition}> / <EmotionArcNode points={result.emotion_arc}>"
      pattern: "hook_decomposition,\\s*$|emotion_arc,\\s*$"
---

<objective>
Phase 2 — Wire Hook Decomposition + Emotion Arc End-to-End.

The engine already extracts `emotion_arc` from `geminiResult.analysis` (aggregator.ts:685-693, then surfaced at L1107) but does NOT pluck `hook_decomposition` — that field travels through the Gemini schema (`gemini/schemas.ts:85`) into `geminiResult.analysis` and is read by `pipeline.ts:874` for watermark detection, then dropped. The `PredictionResult` type already has the slot (`types.ts:316: hook_decomposition?: HookDecomposition | null`). Result: `ContentAnalysisFrame` reads `result?.hook_decomposition ?? null` and `HookDecompNode` always renders `COPY.HOOK_DECOMP_UNAVAILABLE`.

This plan plucks `hook_decomposition` from `geminiResult.analysis` alongside the existing `emotion_arc` block, assembles it into the `result` object, and proves both fields reach the board nodes with the right shape via aggregator unit tests + a frame-level component test.

Purpose: ship the half-wired path so the hook + arc nodes render real engine output. DB persistence (schema-drift columns) is explicitly out of scope — Phase 4 owns that. The streaming path (`useAnalysisStream`) delivers `PredictionResult` directly to the board without touching the DB, so wiring at aggregator is sufficient.

Output:
- `aggregator.ts`: typed `hook_decomposition` pluck + inclusion in `result` literal
- New aggregator unit tests covering populated + omitted paths
- New `ContentAnalysisFrame` component test asserting both nodes render real data
</objective>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md

# Engine — current half-wired state
@src/lib/engine/aggregator.ts        # focus: L523-540 (signature + destructure), L680-693 (emotion_arc pluck), L1080-1153 (result assembly)
@src/lib/engine/types.ts             # PredictionResult.hook_decomposition + emotion_arc slots (~L300-325)
@src/lib/engine/gemini/schemas.ts    # HookDecomposition export (L143) + GeminiVideoAnalysisSchema (L85)
@src/lib/engine/qwen/schemas.ts      # EmotionArcPoint + HookDecomposition exports (~L130, L167)
@src/lib/engine/pipeline.ts          # L874 confirms geminiResult.analysis.hook_decomposition is populated upstream

# Board consumers
@src/components/board/content-analysis/ContentAnalysisFrame.tsx
@src/components/board/content-analysis/HookDecompNode.tsx
@src/components/board/content-analysis/EmotionArcNode.tsx
@src/components/board/content-analysis/content-analysis-constants.ts  # COPY.HOOK_DECOMP_UNAVAILABLE / COPY.EMOTION_ARC_UNAVAILABLE
@src/components/board/verdict/__tests__/fixtures/prediction-result.ts # complete.hook_decomposition + complete.emotion_arc fixture shapes

# Existing tests — mock harness pattern to follow
@src/lib/engine/__tests__/aggregator.test.ts
@src/components/board/content-analysis/__tests__/HookDecompNode.test.tsx
@src/components/board/content-analysis/__tests__/EmotionArcNode.test.tsx

<interfaces>
From src/lib/engine/types.ts:
```typescript
export interface PredictionResult {
  // ... existing fields ...
  hook_decomposition?: HookDecomposition | null;   // L316 — slot exists, never written today
  emotion_arc?: EmotionArcPoint[] | null;          // already written by aggregator L1107
}
```

From src/lib/engine/gemini/schemas.ts:
```typescript
export type HookDecomposition = z.infer<typeof HookDecompositionZodSchema>;
// fields include: visual_stop_power, audio_hook_quality, first_words_speech_score,
// text_overlay_score, visual_audio_coherence, cognitive_load, weakest_modality,
// watermark_detected
```

From src/lib/engine/aggregator.ts (current emotion_arc pattern, L685-693):
```typescript
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

From src/components/board/content-analysis/ContentAnalysisFrame.tsx:
```typescript
<HookDecompNode
  decomp={result?.hook_decomposition ?? null}
  segments={result?.heatmap?.segments ?? null}
  counterfactuals={result?.counterfactuals?.suggestions}
/>
<EmotionArcNode points={result?.emotion_arc ?? null} />
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pluck hook_decomposition in aggregator and assemble into PredictionResult</name>
  <files>src/lib/engine/aggregator.ts</files>
  <behavior>
    - When `geminiResult.analysis.hook_decomposition` is a HookDecomposition object → `result.hook_decomposition` is the same object (referential pass-through)
    - When `geminiResult.analysis.hook_decomposition` is `undefined` / `null` → `result.hook_decomposition` is `null` (not undefined — match types.ts contract)
    - Existing emotion_arc behavior is unchanged
    - Non-fatal: a thrown access (defensive) leaves `hook_decomposition: null` without aborting aggregateScores
  </behavior>
  <action>
1. Open `src/lib/engine/aggregator.ts`. Locate the emotion_arc block at L680-693.

2. Add a typed import (if not already present) — confirm `HookDecomposition` is reachable. The `types.ts` re-exports it (`export type { HookDecomposition, ... }`). Use the canonical engine import path:
   ```typescript
   import type { HookDecomposition } from "./types";
   // OR if a HookDecomposition type import already lives in aggregator.ts, reuse it.
   ```
   Verify by grep on the file before adding (`grep -n "HookDecomposition" src/lib/engine/aggregator.ts`); only add the import if missing.

3. **Immediately after** the existing emotion_arc try/catch block (after L693), insert the hook_decomposition pluck mirroring the same shape:
   ```typescript
   // Phase 2 (Quick 260528-nqx) — hook_decomposition pluck from Gemini analysis.
   // Wave 1 hook-segment analysis emits this on geminiResult.analysis per the
   // GeminiVideoAnalysisSchema (gemini/schemas.ts:85). pipeline.ts:874 already
   // reads .watermark_detected off the same field; we now surface the full
   // decomposition into PredictionResult so HookDecompNode renders real data
   // instead of falling back to COPY.HOOK_DECOMP_UNAVAILABLE. Non-fatal:
   // matches the emotion_arc Pitfall #5 ordering — populated BEFORE Stage 10/11
   // so critique + counterfactuals see the field.
   let hook_decomposition: HookDecomposition | null = null;
   try {
     const raw = (geminiResult.analysis as { hook_decomposition?: HookDecomposition | null }).hook_decomposition;
     if (raw && typeof raw === "object") hook_decomposition = raw;
   } catch {
     hook_decomposition = null; // non-fatal
   }
   ```
   Notes:
   - Use a single-key cast (`as { hook_decomposition?: ... }`) rather than `as unknown as {...}` — `GeminiVideoAnalysis` already declares the field on the schema side; the existing `as unknown as` for emotion_arc is a legacy quirk. Do NOT touch the emotion_arc block in this task.
   - Do NOT add validation/normalization — Gemini's Zod schema already validated upstream. We are surfacing, not re-checking.

4. In the `const result: PredictionResult = { ... }` literal at L1080-1153, insert the field next to `emotion_arc` (which is at L1107). Add a one-line comment for grep-ability:
   ```typescript
   // Phase 2 (Quick 260528-nqx) — hook_decomposition surfaced from Gemini analysis.
   hook_decomposition,
   ```
   Place it immediately AFTER the `emotion_arc,` line so the two related fields are adjacent.

5. Do NOT modify the order of Stage 10 / Stage 11 logic — those phases mutate `result.confidence` / `result.anti_virality_*` / `result.counterfactuals` but the hook_decomposition field is set-once at assembly and is safe to leave untouched.

6. Run `pnpm tsc --noEmit` and fix any type errors before declaring done.
  </action>
  <verify>
    <automated>cd /Users/davideloreti/virtuna-mvp-cut && pnpm tsc --noEmit 2>&1 | tail -20 && grep -nE "^\s*hook_decomposition,\s*$" src/lib/engine/aggregator.ts && grep -nE "let hook_decomposition: HookDecomposition \| null" src/lib/engine/aggregator.ts</automated>
  </verify>
  <done>
    - `let hook_decomposition: HookDecomposition | null = null` block exists immediately after the emotion_arc block (~L694)
    - `hook_decomposition,` appears inside the `const result: PredictionResult = {...}` literal adjacent to `emotion_arc,`
    - `pnpm tsc --noEmit` reports zero errors
    - No changes outside the two regions described above
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Aggregator unit tests for populated hook_decomposition + emotion_arc paths</name>
  <files>src/lib/engine/__tests__/aggregator.test.ts</files>
  <behavior>
    - Given geminiResult.analysis populated with a valid hook_decomposition + emotion_arc array → aggregateScores returns a PredictionResult with both fields set referentially / structurally to the input
    - Given geminiResult.analysis with hook_decomposition undefined and emotion_arc empty/missing → aggregateScores returns both fields as null
    - Tests reuse the existing mock harness at the top of aggregator.test.ts (Sentry, logger, supabase, ml, etc.) — no new external mocks needed
  </behavior>
  <action>
1. Open `src/lib/engine/__tests__/aggregator.test.ts`. Read enough of the file to understand the existing harness pattern (mocks at top, test data factory pattern, how a PipelineResult fixture is constructed).

2. Locate an existing test that calls `aggregateScores(pipelineResultFixture)` and extract the minimal fixture builder it uses. If no factory exists, find an existing happy-path test and copy its fixture inline — do NOT introduce a new sweeping factory abstraction.

3. Add a new `describe` block at the bottom of the file (do NOT touch existing tests):
   ```typescript
   describe("hook_decomposition + emotion_arc pluck (Quick 260528-nqx)", () => {
     it("populates hook_decomposition on result when geminiResult.analysis.hook_decomposition is present", async () => {
       const hookDecomp = {
         visual_stop_power: 8.2,
         audio_hook_quality: 6.5,
         first_words_speech_score: 7.0,
         text_overlay_score: 4.1,
         visual_audio_coherence: 7.4,
         cognitive_load: 5,
         weakest_modality: "text_overlay_score" as const,
         watermark_detected: false,
       };
       const arc = [
         { timestamp_ms: 0, intensity_0_1: 0.3 },
         { timestamp_ms: 1500, intensity_0_1: 0.8 },
       ];
       const pipelineResult = makeMinimalPipelineResult({
         geminiAnalysisOverrides: { hook_decomposition: hookDecomp, emotion_arc: arc },
       });
       const result = await aggregateScores(pipelineResult);
       expect(result.hook_decomposition).toEqual(hookDecomp);
       expect(result.emotion_arc).toEqual(arc);
     });

     it("falls back to null when geminiResult.analysis omits both fields", async () => {
       const pipelineResult = makeMinimalPipelineResult({
         geminiAnalysisOverrides: { hook_decomposition: undefined, emotion_arc: undefined },
       });
       const result = await aggregateScores(pipelineResult);
       expect(result.hook_decomposition).toBeNull();
       expect(result.emotion_arc).toBeNull();
     });

     it("falls back to null when emotion_arc is an empty array (preserves Pitfall #5 backward compat)", async () => {
       const pipelineResult = makeMinimalPipelineResult({
         geminiAnalysisOverrides: { hook_decomposition: undefined, emotion_arc: [] },
       });
       const result = await aggregateScores(pipelineResult);
       expect(result.emotion_arc).toBeNull();
     });
   });
   ```

4. `makeMinimalPipelineResult` may not exist — if not, inline the fixture (lift from the nearest passing test in the file). DO NOT introduce a shared factory in a separate file; this is a focused quick task.

5. Confirm the test types compile: `pnpm vitest --run src/lib/engine/__tests__/aggregator.test.ts -t "Quick 260528-nqx"`.
  </action>
  <verify>
    <automated>cd /Users/davideloreti/virtuna-mvp-cut && pnpm vitest --run src/lib/engine/__tests__/aggregator.test.ts -t "260528-nqx" 2>&1 | tail -30</automated>
  </verify>
  <done>
    - New `describe` block with 3 tests exists in aggregator.test.ts
    - All 3 new tests pass; no existing tests regress
    - First test asserts result.hook_decomposition + result.emotion_arc are populated with input values
    - Second test asserts both are null when omitted upstream
    - Third test asserts empty-array emotion_arc → null (Pitfall #5 backward compat)
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: ContentAnalysisFrame component test — board renders populated data, no "(unavailable)" copy</name>
  <files>src/components/board/content-analysis/__tests__/ContentAnalysisFrame.test.tsx</files>
  <behavior>
    - Given a useAnalysisStream returning a result with populated hook_decomposition + emotion_arc → frame renders HookDecompNode score bars + EmotionArcNode chart
    - Neither COPY.HOOK_DECOMP_UNAVAILABLE nor COPY.EMOTION_ARC_UNAVAILABLE appears in the rendered output
    - Given a useAnalysisStream returning a result with both fields null → both unavailable strings DO appear (regression guard so we don't accidentally render bars from a stale closure or default)
  </behavior>
  <action>
1. Check whether `src/components/board/content-analysis/__tests__/ContentAnalysisFrame.test.tsx` exists. If yes — append new test cases. If no — create it.

2. Required imports + mock setup:
   ```typescript
   import { describe, it, expect, vi, beforeEach } from "vitest";
   import { render, screen } from "@testing-library/react";
   import { ContentAnalysisFrame } from "../ContentAnalysisFrame";
   import { COPY } from "../content-analysis-constants";
   import { fixtures } from "@/components/board/verdict/__tests__/fixtures/prediction-result";

   // Mock the two query hooks. ContentAnalysisFrame reads:
   //   - usePermalinkAnalysis() -> { data: PredictionResult | null }
   //   - useAnalysisStream({initialData}) -> { phase, result }
   vi.mock("@/hooks/queries/use-permalink-analysis", () => ({
     usePermalinkAnalysis: vi.fn(() => ({ data: null })),
   }));
   vi.mock("@/hooks/queries/use-analysis-stream", () => ({
     useAnalysisStream: vi.fn(),
   }));

   import { useAnalysisStream } from "@/hooks/queries/use-analysis-stream";
   ```

3. Three test cases:
   ```typescript
   describe("ContentAnalysisFrame (Quick 260528-nqx)", () => {
     beforeEach(() => vi.clearAllMocks());

     it("renders HookDecompNode + EmotionArcNode with real data; no (unavailable) copy", () => {
       (useAnalysisStream as any).mockReturnValue({
         phase: "complete",
         result: fixtures.complete, // already has populated hook_decomposition + emotion_arc
       });
       render(<ContentAnalysisFrame camera={undefined as any} layout={undefined as any} />);
       // Neither unavailable string appears
       expect(screen.queryByText(COPY.HOOK_DECOMP_UNAVAILABLE)).toBeNull();
       expect(screen.queryByText(COPY.EMOTION_ARC_UNAVAILABLE)).toBeNull();
     });

     it("renders unavailable copy when result.hook_decomposition is null", () => {
       (useAnalysisStream as any).mockReturnValue({
         phase: "complete",
         result: { ...fixtures.complete, hook_decomposition: null, emotion_arc: null },
       });
       render(<ContentAnalysisFrame camera={undefined as any} layout={undefined as any} />);
       expect(screen.getByText(COPY.HOOK_DECOMP_UNAVAILABLE)).toBeInTheDocument();
       expect(screen.getByText(COPY.EMOTION_ARC_UNAVAILABLE)).toBeInTheDocument();
     });
   });
   ```
   Confirm props: re-check `ContentAnalysisFrameProps` (`content-analysis-types.ts`). If `camera`/`layout` are required and typed, pass minimal valid stubs rather than `undefined as any` — only use the `as any` escape hatch if the type genuinely requires structured camera/layout state that isn't load-bearing for this test.

4. `fixtures.complete` already has `hook_decomposition` (line 89 of fixture file) and an `emotion_arc` field. Verify by reading the fixture before running tests:
   ```bash
   grep -n "hook_decomposition\|emotion_arc" src/components/board/verdict/__tests__/fixtures/prediction-result.ts
   ```

5. Recharts renders nothing meaningful in jsdom — that's fine. We're asserting the *absence* of unavailable copy, not chart geometry. EmotionArcNode's empty-state path renders the COPY string in plain DOM; the populated path renders the chart container (no COPY string). HookDecompNode renders score-bar labels — assert their absence path negatively (no COPY) rather than positively (specific label text) to keep the test resilient to label tweaks.

6. Run the new test file: `pnpm vitest --run src/components/board/content-analysis/__tests__/ContentAnalysisFrame.test.tsx`.
  </action>
  <verify>
    <automated>cd /Users/davideloreti/virtuna-mvp-cut && pnpm vitest --run src/components/board/content-analysis/__tests__/ContentAnalysisFrame.test.tsx 2>&1 | tail -30</automated>
  </verify>
  <done>
    - Test file exists with at minimum 2 tests (populated + null)
    - Populated test asserts neither COPY.HOOK_DECOMP_UNAVAILABLE nor COPY.EMOTION_ARC_UNAVAILABLE renders
    - Null test asserts both unavailable strings DO render (regression guard)
    - All tests pass; jsdom has no recharts-related fatal errors (warnings on `ResizeObserver` etc. are acceptable)
  </done>
</task>

</tasks>

<verification>
Run the full impacted test surface in one pass:

```bash
cd /Users/davideloreti/virtuna-mvp-cut && \
  pnpm tsc --noEmit && \
  pnpm vitest --run \
    src/lib/engine/__tests__/aggregator.test.ts \
    src/components/board/content-analysis/__tests__/
```

All three of:
1. tsc clean
2. Aggregator suite green (existing + new 260528-nqx tests)
3. content-analysis suite green (existing HookDecompNode + EmotionArcNode + new ContentAnalysisFrame tests)

Plus a focused grep sanity check that the new wiring landed in the result literal:
```bash
grep -nE "^\s*(hook_decomposition|emotion_arc),\s*$" src/lib/engine/aggregator.ts
# Must show BOTH fields inside the result literal (~L1107 region)
```
</verification>

<success_criteria>
Maps 1:1 to ROADMAP Phase 2 success criteria:

1. **SC1 — `aggregator.ts` no longer returns null-shaped hook_decomposition / emotion_arc on happy path:**
   - Task 1 wires hook_decomposition pluck + assembles into result literal
   - Task 2 unit-tests the populated path proving non-null output

2. **SC2 — Verdict/hook node renders populated decomposition without "(unavailable)" copy:**
   - Task 3 component test asserts COPY.HOOK_DECOMP_UNAVAILABLE / COPY.EMOTION_ARC_UNAVAILABLE strings are absent when result is populated

3. **SC3 — New aggregator unit tests cover the populated path:**
   - Task 2 adds 3 new tests (populated, both-null, empty-arc backward compat) under a "260528-nqx" tagged describe block

Out of scope (explicit non-goals — Phase 4 territory):
- `analysis_results` schema migration to add `hook_decomposition` column
- DB persistence in `buildInsertRow`
- Reverting the script-route inline `hook_decomposition: null` workaround at `src/app/api/analyze/[id]/script/route.ts:134`
</success_criteria>

<output>
After completion, create `.planning/quick/260528-nqx-wire-hook-decomp-emotion-arc/260528-nqx-SUMMARY.md` capturing:
- Diff summary (aggregator pluck + result literal field; 3 aggregator tests; 2 frame tests)
- Confirmation that `pnpm tsc --noEmit` is clean
- Confirmation that targeted vitest runs are green
- One-line note flagging the Phase 4 follow-up (schema-drift column + script-route workaround revert)
</output>
