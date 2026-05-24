---
phase: "07"
plan: "02b"
type: execute
wave: 3
depends_on: ["07-02a"]
files_modified:
  - src/lib/engine/wave3.ts
  - src/lib/engine/pipeline.ts
  - src/lib/engine/__tests__/wave3.test.ts
  - src/lib/engine/__tests__/stubs.test.ts
  - src/lib/engine/aggregator.ts
autonomous: true
requirements:
  - PERSONA-01
  - PERSONA-02
  - PERSONA-03
  - PERSONA-04
  - PERSONA-05
  - PERSONA-06
  - PERSONA-07
  - PERSONA-10

must_haves:
  truths:
    - "Wave 3 fires exactly 10 parallel `deepseek-chat` calls via Promise.allSettled when invoked"
    - "When ≥7 of 10 personas succeed, `Wave3Outcome.aggregate` is non-null; when <7 succeed, it is null + `wave_3_below_threshold` warning"
    - "Wave 3 inherits DeepSeek's circuit breaker — when `isCircuitOpen()` returns true, returns `{ aggregate: null, results: [], warnings: ['wave_3_circuit_breaker_open'] }` without firing any persona calls"
    - "Per-persona stage events fire with `wave_3_persona_{archetype}_{slot_type}` naming; wave-level event remains `wave_3_personas`"
    - "Pipeline.ts surfaces `personaBehavioralAggregate` to PipelineResult; aggregator's PredictionResult assembly reads pipelineResult.wave3Result for persona_simulation_results"
    - "Each persona call has 15s timeout; retry-once only on Zod parse failure (Pitfall 5); no retry on AbortError"
    - "Existing stubs.test.ts Wave 3 stub contract preserved (empty results + null aggregate on full DeepSeek failure; wave-level event names + wave=3 still fire)"
    - "`wave3.ts` uses `OUTPUT_PRICE = 0.28 / 1_000_000` (W-4 — NOT the obsolete 0.42 from V3.2 pricing)"
  artifacts:
    - path: src/lib/engine/wave3.ts
      provides: "Rewritten runWave3 body — 10-call orchestration via Promise.allSettled + circuit-breaker fast-fail (uses existing `isCircuitOpen` export from deepseek.ts:736) + per-call retry-once + cache-aware cost telemetry + per-persona event emission"
      exports: ["runWave3", "Wave3Outcome"]
    - path: src/lib/engine/pipeline.ts
      provides: "Widened runWave3 call site at line 511 — passes wave0Result + creatorContext; surfaces wave3Outcome.aggregate as personaBehavioralAggregate on PipelineResult"
      contains: "wave3Outcome"
    - path: src/lib/engine/aggregator.ts
      provides: "Placeholder PredictionResult field assignments from Plan 07-02a updated to read full pipelineResult fields (final integration with signal_availability.personas + optional behavioralSource is Plan 07-03's scope)"
      contains: "persona_simulation_results"
    - path: src/lib/engine/__tests__/wave3.test.ts
      provides: "Orchestration tests — 10 parallel calls, Promise.allSettled isolation, ≥7 threshold, circuit-breaker fast-fail (via importOriginal mock), retry-once on validation failure, AbortError no-retry, cost telemetry, env override, per-persona events"
    - path: src/lib/engine/__tests__/stubs.test.ts
      provides: "Updated Wave 3 backward-compat block: widened runWave3 signature (5 args including wave0Result + creatorContext); all-reject simulation preserves Phase 3 D-17 shape contract"
  key_links:
    - from: src/lib/engine/wave3.ts
      to: src/lib/engine/deepseek.ts
      via: "imports isCircuitOpen (already exported at deepseek.ts:736 — B-1 verified, no edit to deepseek.ts in this plan)"
      pattern: "import \\{ isCircuitOpen \\}"
    - from: src/lib/engine/wave3.ts
      to: src/lib/engine/wave3/persona-registry.ts
      via: "selectPersonaSlots(contentType, nicheSlug) → 10 PersonaSlot entries"
      pattern: "selectPersonaSlots\\("
    - from: src/lib/engine/wave3.ts
      to: src/lib/engine/wave3/persona-prompts.ts
      via: "buildPersonaSystemPrompt + buildPersonaUserMessage + PersonaResponseSchema"
      pattern: "buildPersonaSystemPrompt\\("
    - from: src/lib/engine/wave3.ts
      to: src/lib/engine/wave3/aggregator.ts
      via: "aggregatePersonaResults(survivors, 7) → { aggregate, warnings } (from Plan 07-02a)"
      pattern: "aggregatePersonaResults\\("
    - from: src/lib/engine/pipeline.ts
      to: src/lib/engine/wave3.ts
      via: "runWave3(payload, deepseekResult, wave0Result, creatorContext, onStageEvent) → Wave3Outcome"
      pattern: "runWave3\\("
---

<objective>
Land Phase 7's load-bearing orchestration layer: rewrite `src/lib/engine/wave3.ts` from the Phase 3 D-17 no-op stub into a 10-call Promise.allSettled DeepSeek V4 Flash orchestrator with circuit-breaker fast-fail, per-call retry-once on validation failure, cache-aware cost telemetry, and per-persona stage events. Update pipeline.ts to pass `wave0Result` + `creatorContext` into the new signature and surface `personaBehavioralAggregate` to the PipelineResult. Update aggregator.ts (placeholder fields from Plan 07-02a) to consume the now-populated pipeline output. Add the orchestration test suite (`wave3.test.ts` — 14 behavior tests) and update the backward-compat block in `stubs.test.ts` to match the widened signature.

Purpose (B-4 split rationale, continued from 07-02a): with types + factories + aggregator helper already validated in 07-02a, this plan focuses solely on the orchestrator and its tests. NO type widening here, NO new pure-function modules, NO eval-harness changes. Plan 07-03 lands the FULL aggregator integration (`signal_availability.personas` + optional `behavioralSource` param) — this plan leaves that for 07-03 and only ensures aggregator compiles against the populated pipeline.

Output: 5 files touched. The orchestrator rewrite (~280 LOC) + the orchestration test suite (~400 LOC) are the heaviest single concerns in Phase 7; isolating them in their own plan preserves context budget headroom.

NO edit to `src/lib/engine/deepseek.ts` in this plan. `isCircuitOpen` is already exported at line 736 (verified: `grep -n "isCircuitOpen" src/lib/engine/deepseek.ts` shows `736:export { DEEPSEEK_MODEL, isCircuitOpen };`). The plan checker (B-1) flagged the original 07-02 plan's redundant export edit; this revision honors that.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/07-multi-persona-simulation/07-CONTEXT.md
@.planning/phases/07-multi-persona-simulation/07-RESEARCH.md
@.planning/phases/07-multi-persona-simulation/07-PATTERNS.md
@.planning/phases/07-multi-persona-simulation/07-VALIDATION.md
@.planning/phases/07-multi-persona-simulation/07-01-PLAN.md
@.planning/phases/07-multi-persona-simulation/07-02a-PLAN.md
@src/lib/engine/wave3.ts
@src/lib/engine/wave0.ts
@src/lib/engine/wave0/niche-detector.ts
@src/lib/engine/deepseek.ts
@src/lib/engine/pipeline.ts
@src/lib/engine/types.ts
@src/lib/engine/aggregator.ts
@src/lib/engine/__tests__/factories.ts
@src/lib/engine/__tests__/stubs.test.ts
@src/lib/engine/__tests__/wave0-orchestration.test.ts
@src/lib/engine/__tests__/wave0-niche-detector.test.ts

<interfaces>
<!-- Key types and contracts the executor needs. Extracted from codebase. -->

From Plan 07-02a output (src/lib/engine/types.ts):
PredictionResult includes `persona_behavioral_aggregate` + `persona_simulation_results` (post-widening).

From Plan 07-02a output (src/lib/engine/pipeline.ts):
PipelineResult includes `personaBehavioralAggregate: PersonaBehavioralAggregate | null` (post-widening).

From Plan 07-02a output (src/lib/engine/wave3/aggregator.ts):
```typescript
export function aggregatePersonaResults(
  survivors: PersonaSimulationResult[],
  successThreshold?: number,
): { aggregate: PersonaBehavioralAggregate | null; warnings: string[] };
```

From src/lib/engine/wave3.ts (CURRENT — Phase 3 D-17 stub, to be REPLACED):
```typescript
export async function runWave3(
  _payload: ContentPayload,
  _deepseekResult: DeepSeekReasoning | null,
  onEvent?: StageEventCallback,
): Promise<PersonaSimulationResult[]> {
  const start = emitStageStart(onEvent, "wave_3_personas", 3);
  const result: PersonaSimulationResult[] = [];
  emitStageEnd(onEvent, "wave_3_personas", 3, start, { cost_cents: 0, ok: true });
  return result;
}
```

From src/lib/engine/deepseek.ts (line 736 — VERIFIED to exist; no edit needed):
```typescript
export { DEEPSEEK_MODEL, isCircuitOpen };
```

From src/lib/engine/wave0/niche-detector.ts (lines 21-23 — pricing constants Phase 7 mirrors):
```typescript
const CACHE_HIT_PRICE = 0.0028 / 1_000_000;
const CACHE_MISS_PRICE = 0.14 / 1_000_000;
const OUTPUT_PRICE = 0.28 / 1_000_000;        // ← NOT 0.42 (V3.2 legacy)
```

From src/lib/engine/pipeline.ts (line 511 CURRENT — to be widened):
```typescript
const wave3Result = await runWave3(
  payload,
  deepseekRaw?.reasoning ?? null,
  onStageEvent
);
```

From src/lib/engine/__tests__/stubs.test.ts (lines 64-86 CURRENT — to be updated for new signature):
```typescript
describe("Wave 3 stub", () => {
  it("returns []", async () => {
    const result = await runWave3(fakePayload, null);
    expect(result).toEqual([]);
  });
  // ...emits stage_start + stage_end with wave_3_personas/wave=3...
});
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Rewrite `src/lib/engine/wave3.ts` body — 10-call Promise.allSettled orchestrator + circuit-breaker fast-fail + retry-once + cost telemetry</name>
  <files>src/lib/engine/wave3.ts</files>
  <read_first>
    - src/lib/engine/wave3.ts (FULL — current Phase 3 D-17 no-op stub; preserve event names "wave_3_personas" + wave=3)
    - src/lib/engine/wave0.ts (FULL — Promise.allSettled orchestrator analog at lines 34-37; Sentry-on-rejected at lines 39-56; JSDoc CONTEXT-D-XX trail style at lines 14-20)
    - src/lib/engine/wave0/niche-detector.ts (FULL — lines 1-220: getClient(), DEEPSEEK_NICHE_MODEL env pattern, CACHE_HIT_PRICE/CACHE_MISS_PRICE/OUTPUT_PRICE constants verified at $0.0028 / $0.14 / $0.28 per 1M, AbortController + setTimeout pattern, response_format: { type: "json_object" }, Zod safeParse + throw on failure, usage.prompt_cache_hit_tokens telemetry with GAP-04-02 fallback, emitStageStart/emitStageEnd success+error branches with cost_cents, Sentry.captureException with stage tags)
    - src/lib/engine/deepseek.ts (line 736 — verify `export { DEEPSEEK_MODEL, isCircuitOpen };` exists; B-1 — do NOT add another export of isCircuitOpen)
    - src/lib/engine/wave3/persona-registry.ts (Plan 07-01 output — read selectPersonaSlots signature + PersonaSlot type)
    - src/lib/engine/wave3/persona-prompts.ts (Plan 07-01 output — read buildPersonaSystemPrompt, buildPersonaUserMessage, PersonaResponseSchema)
    - src/lib/engine/wave3/aggregator.ts (Plan 07-02a output — read aggregatePersonaResults signature + return shape)
    - src/lib/engine/types.ts (PersonaBehavioralAggregate, PersonaSimulationResult, Wave0Result; Plan 07-01 + 07-02a widening complete)
    - .planning/phases/07-multi-persona-simulation/07-RESEARCH.md (lines 289-498 — Pattern 1 full wave3.ts body source: getClient, Wave3Outcome interface, callPersona retry-once on validation failure, AbortError no-retry, cost telemetry pattern, Promise.allSettled survivor collection)
    - .planning/phases/07-multi-persona-simulation/07-PATTERNS.md (lines 28-94 — wave3.ts orchestrator analog; cross-cutting note #2 explicit OUTPUT_PRICE = 0.28 NOT 0.42)
    - .planning/phases/07-multi-persona-simulation/07-CONTEXT.md (D-13 threshold; D-17 cache discipline; D-18 cost telemetry)
  </read_first>
  <action>
**Rewrite `src/lib/engine/wave3.ts`** as a complete file replacement (current Phase 3 D-17 no-op stub → new orchestrator). The OUTPUT_PRICE constant MUST be `0.28 / 1_000_000` (mirrors `wave0/niche-detector.ts:23`; W-4 — explicitly NOT `0.42 / 1_000_000`).

```typescript
import * as Sentry from "@sentry/nextjs";
import OpenAI from "openai";
import { createLogger } from "@/lib/logger";
import type {
  ContentPayload,
  DeepSeekReasoning,
  PersonaSimulationResult,
  Wave0Result,
  PersonaBehavioralAggregate,
} from "./types";
import type { CreatorContext } from "./creator";
import type { StageEventCallback } from "./events";
import { emitStageStart, emitStageEnd } from "./events";
import { selectPersonaSlots, type PersonaSlot } from "./wave3/persona-registry";
import {
  buildPersonaSystemPrompt,
  buildPersonaUserMessage,
  PersonaResponseSchema,
} from "./wave3/persona-prompts";
import { aggregatePersonaResults } from "./wave3/aggregator";
import { isCircuitOpen } from "./deepseek";

const log = createLogger({ module: "wave3" });

/**
 * Phase 7 PERSONA-09: separate env from DEEPSEEK_MODEL (which routes to thinking-mode via
 * deepseek-reasoner alias per Phase 4 D-03). DEEPSEEK_PERSONA_MODEL defaults to bare V4 Flash
 * (non-thinking) — cheap, parallel-friendly.
 */
const DEEPSEEK_PERSONA_MODEL =
  process.env.DEEPSEEK_PERSONA_MODEL ?? "deepseek-v4-flash";

/**
 * V4 Flash pricing — mirrors wave0/niche-detector.ts:21-23. Re-verify against
 * api-docs.deepseek.com/quick_start/pricing at execution time (RESEARCH A1).
 * NOTE (W-4): OUTPUT_PRICE is 0.28/M — the V3.2-era 0.42/M would be incorrect.
 */
const CACHE_HIT_PRICE = 0.0028 / 1_000_000;
const CACHE_MISS_PRICE = 0.14 / 1_000_000;
const OUTPUT_PRICE = 0.28 / 1_000_000;

const PER_CALL_TIMEOUT_MS = 15_000;
const SUCCESS_THRESHOLD = 7;  // D-13: ≥7-of-10 personas required for non-null aggregate

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY environment variable");
    client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
  }
  return client;
}

/**
 * Phase 7 Wave 3 outcome — widens the Phase 3 D-17 stub return shape.
 * - `aggregate`: PersonaBehavioralAggregate when ≥7 personas succeed; null otherwise.
 * - `results`: every successful PersonaSimulationResult (≤10 entries).
 * - `warnings`: per-persona failure messages + wave-level threshold warnings.
 */
export interface Wave3Outcome {
  aggregate: PersonaBehavioralAggregate | null;
  results: PersonaSimulationResult[];
  warnings: string[];
}

/**
 * Phase 7 contract: fires 10 parallel deepseek-chat calls — one per persona slot —
 * with per-slot stage events, ≥7-of-10 threshold (D-13), and graceful degradation.
 *
 * Per CONTEXT D-08: this signal is ADDITIVE on PredictionResult. The legacy
 * aggregator.ts read of deepseek.behavioral_predictions stays unchanged (Plan 07-03
 * adds an OPT-IN swap via the new behavioralSource param).
 *
 * Inherits the Phase 1 / Phase 3 graceful-degradation contract: NEVER throws.
 * Returns null aggregate + warning on any failure mode (circuit open, all 10 fail, etc.).
 */
export async function runWave3(
  payload: ContentPayload,
  deepseekResult: DeepSeekReasoning | null,
  wave0Result: Wave0Result,
  creatorContext: CreatorContext,
  onEvent?: StageEventCallback,
): Promise<Wave3Outcome> {
  const stageStart = emitStageStart(onEvent, "wave_3_personas", 3);

  // Circuit-breaker fast-fail (PATTERNS cross-cutting note #3) — don't burn 10 calls
  // when DeepSeek is known-down. isCircuitOpen is exported from deepseek.ts:736 (existing).
  if (isCircuitOpen()) {
    log.warn("Circuit breaker open — skipping Wave 3");
    emitStageEnd(onEvent, "wave_3_personas", 3, stageStart, {
      cost_cents: 0,
      ok: false,
      warning: "circuit_breaker_open",
    });
    return {
      aggregate: null,
      results: [],
      warnings: ["wave_3_circuit_breaker_open"],
    };
  }

  // D-11: routing — wave0Result.content_type.type → 7-row allocation table → 10 slots.
  // D-10: null content_type OR mixed_content_detected warning → "other" row fallback
  // (handled inside selectPersonaSlots).
  const contentTypeSlug = wave0Result.content_type?.type ?? null;
  const nicheSlug = wave0Result.niche?.primary ?? null;

  let slots: PersonaSlot[];
  try {
    slots = selectPersonaSlots(contentTypeSlug, nicheSlug);
  } catch (err) {
    // Pitfall 2: selectPersonaSlots throws on length mismatch — defensive guard.
    const lastError = err instanceof Error ? err : new Error(String(err));
    Sentry.captureException(lastError, { tags: { stage: "wave_3_personas" } });
    log.error("selectPersonaSlots failed", { error: lastError.message });
    emitStageEnd(onEvent, "wave_3_personas", 3, stageStart, {
      cost_cents: 0,
      ok: false,
      warning: lastError.message,
    });
    return {
      aggregate: null,
      results: [],
      warnings: [`wave_3_slot_allocation_failed: ${lastError.message}`],
    };
  }

  const ai = getClient();
  let totalCostCents = 0;

  const callPersona = async (slot: PersonaSlot): Promise<PersonaSimulationResult> => {
    const stageName = `wave_3_persona_${slot.archetype}_${slot.slot_type}`;
    const callStart = emitStageStart(onEvent, stageName, 3);

    const systemPrompt = buildPersonaSystemPrompt(slot);
    const userMessage = buildPersonaUserMessage(
      payload,
      deepseekResult,
      creatorContext,
      wave0Result,
      slot,
    );

    let attempt = 0;
    let lastError: Error | null = null;
    let callCostCents = 0;

    while (attempt <= 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);
      try {
        const response = await ai.chat.completions.create(
          {
            model: DEEPSEEK_PERSONA_MODEL,
            messages: [
              { role: "system", content: systemPrompt }, // STABLE — cache prefix (D-17)
              { role: "user", content: userMessage },     // VOLATILE per-call
            ],
            response_format: { type: "json_object" },
          },
          { signal: controller.signal },
        );
        clearTimeout(timer);

        // Cache-aware cost telemetry — mirrors wave0/niche-detector.ts:89-102 (Phase 4 pattern).
        const usage = response.usage as unknown as {
          prompt_tokens?: number;
          prompt_cache_hit_tokens?: number;
          prompt_cache_miss_tokens?: number;
          completion_tokens?: number;
        } | undefined;
        const cacheHit = usage?.prompt_cache_hit_tokens ?? 0;
        const cacheMiss = usage?.prompt_cache_miss_tokens ?? 0;
        const completion = usage?.completion_tokens ?? 0;
        const hasBreakdown = cacheHit > 0 || cacheMiss > 0;
        const inputCost = hasBreakdown
          ? cacheHit * CACHE_HIT_PRICE + cacheMiss * CACHE_MISS_PRICE
          : (usage?.prompt_tokens ?? 0) * CACHE_MISS_PRICE;
        callCostCents = (inputCost + completion * OUTPUT_PRICE) * 100;

        const text = response.choices[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(text);
        const validated = PersonaResponseSchema.safeParse(parsed);
        if (!validated.success) {
          throw new Error(`validation failed: ${validated.error.message}`);
        }

        const result: PersonaSimulationResult = {
          persona_id: slot.persona_id,
          archetype: slot.archetype,
          slot_type: slot.slot_type,
          niche: slot.niche,
          ...validated.data,
        };

        emitStageEnd(onEvent, stageName, 3, callStart, {
          cost_cents: +callCostCents.toFixed(6),
          ok: true,
        });
        // Add to wave-level total
        totalCostCents += callCostCents;
        return result;
      } catch (err) {
        clearTimeout(timer);
        lastError = err instanceof Error ? err : new Error(String(err));
        const isTimeout = lastError.name === "AbortError";
        const isValidation = lastError.message.includes("validation failed");

        // ONE retry only on validation failure; no retry on timeout, no retry on second attempt.
        if (isTimeout || attempt === 1 || !isValidation) {
          Sentry.captureException(lastError, {
            tags: {
              stage: "wave_3_persona",
              archetype: slot.archetype,
              slot_type: slot.slot_type,
            },
          });
          emitStageEnd(onEvent, stageName, 3, callStart, {
            cost_cents: +callCostCents.toFixed(6),
            ok: false,
            warning: lastError.message,
          });
          throw lastError;
        }
        attempt++;
        log.info("Retrying persona call after schema failure", {
          archetype: slot.archetype,
          slot_type: slot.slot_type,
        });
      }
    }
    throw lastError ?? new Error("Unreachable persona call state");
  };

  const settledResults = await Promise.allSettled(slots.map(callPersona));
  const survivors: PersonaSimulationResult[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < settledResults.length; i++) {
    const outcome = settledResults[i]!;
    if (outcome.status === "fulfilled") {
      survivors.push(outcome.value);
    } else {
      const slot = slots[i]!;
      const reason = outcome.reason instanceof Error
        ? outcome.reason.message
        : String(outcome.reason);
      warnings.push(`Persona ${slot.archetype}/${slot.slot_type} failed: ${reason}`);
    }
  }

  const { aggregate, warnings: aggregatorWarnings } = aggregatePersonaResults(
    survivors,
    SUCCESS_THRESHOLD,
  );
  warnings.push(...aggregatorWarnings);

  emitStageEnd(onEvent, "wave_3_personas", 3, stageStart, {
    cost_cents: +totalCostCents.toFixed(4),
    ok: aggregate !== null,
    warning: aggregate === null ? "wave_3_below_threshold" : undefined,
  });

  return {
    aggregate,
    results: survivors,
    warnings,
  };
}
```

NO edit to `src/lib/engine/deepseek.ts` — `isCircuitOpen` is already exported at line 736 (B-1 verified). Importing it directly via `import { isCircuitOpen } from "./deepseek";` works against the existing line 736 re-export.
  </action>
  <verify>
    <automated>pnpm tsc --noEmit src/lib/engine/wave3.ts 2>&1 | head -10 || echo "TSC CLEAN" ; grep -n "OUTPUT_PRICE\|isCircuitOpen\|Promise.allSettled\|wave_3_personas\|SUCCESS_THRESHOLD" src/lib/engine/wave3.ts | head -10</automated>
  </verify>
  <acceptance_criteria>
    - `src/lib/engine/wave3.ts` is rewritten — current Phase 3 D-17 no-op stub body replaced
    - File contains `import { isCircuitOpen } from "./deepseek";` (B-1: uses existing export at deepseek.ts:736; no new export added)
    - `git diff src/lib/engine/deepseek.ts` shows NO changes (B-1 enforcement)
    - File contains exact string `export interface Wave3Outcome {`
    - File contains exact string `Promise.allSettled(`
    - File contains exact string `selectPersonaSlots(contentTypeSlug, nicheSlug)`
    - File contains exact string `aggregatePersonaResults(\n    survivors,\n    SUCCESS_THRESHOLD,\n  )` OR equivalent (whitespace tolerant — both args present)
    - File contains exact string `const SUCCESS_THRESHOLD = 7;`
    - File contains exact string `const OUTPUT_PRICE = 0.28 / 1_000_000;` (W-4)
    - File does NOT contain `0.42 / 1_000_000`: `grep -c "0.42 / 1_000_000" src/lib/engine/wave3.ts` returns 0 (W-4)
    - File contains exact string `process.env.DEEPSEEK_PERSONA_MODEL ?? "deepseek-v4-flash"`
    - File contains exact string `wave_3_persona_${slot.archetype}_${slot.slot_type}` (per-persona stage name)
    - File contains exact string `wave_3_circuit_breaker_open` (circuit-breaker warning string)
    - File contains exact string `PER_CALL_TIMEOUT_MS = 15_000`
    - File contains exact string `validation failed` (retry-once trigger substring per Pitfall 5)
    - `pnpm tsc --noEmit` shows no new errors
  </acceptance_criteria>
  <done>wave3.ts rewritten with full orchestration: 10-call Promise.allSettled, circuit-breaker fast-fail via imported isCircuitOpen (no deepseek.ts edit per B-1), per-call retry-once on validation failure, AbortError no-retry, cache-aware cost telemetry with OUTPUT_PRICE 0.28/M (W-4), per-persona events. Type-compiles clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire pipeline.ts to widened runWave3 signature; update aggregator.ts placeholder fields to consume real pipeline output</name>
  <files>src/lib/engine/pipeline.ts, src/lib/engine/aggregator.ts</files>
  <read_first>
    - src/lib/engine/pipeline.ts (lines 1-25 imports block; lines 40-59 PipelineResult — already widened in Plan 07-02a with personaBehavioralAggregate; lines 230-280 to confirm creatorContext is in scope at the Wave 3 call site; lines 507-555 current Wave 3 call site + return block)
    - src/lib/engine/wave3.ts (Task 1 output — new Wave3Outcome interface, runWave3 signature)
    - src/lib/engine/aggregator.ts (lines 519-540 — PredictionResult assembly block; Plan 07-02a added `persona_behavioral_aggregate: pipelineResult.personaBehavioralAggregate ?? null` + `persona_simulation_results: pipelineResult.wave3Result` as placeholder)
    - .planning/phases/07-multi-persona-simulation/07-PATTERNS.md (lines 487-541 pipeline.ts widening pattern)
    - .planning/phases/07-multi-persona-simulation/07-CONTEXT.md (D-11 routing wave0Result.content_type → allocation; D-03 loyalist consumes creatorContext.past_wins)
  </read_first>
  <action>
**Step A: Update `src/lib/engine/pipeline.ts` Wave 3 call site (lines 507-555).** Replace the current `runWave3` invocation:

Before:
```typescript
const wave3Result = await runWave3(
  payload,
  deepseekRaw?.reasoning ?? null,
  onStageEvent
);
```

After:
```typescript
const wave3Outcome = await runWave3(
  payload,
  deepseekRaw?.reasoning ?? null,
  wave0Result,
  creatorContext,
  onStageEvent,
);
const wave3Result: PersonaSimulationResult[] = wave3Outcome.results;
const personaBehavioralAggregate: PersonaBehavioralAggregate | null = wave3Outcome.aggregate;
warnings.push(...wave3Outcome.warnings);
```

Then in the pipeline return block (lines 545-560), add `personaBehavioralAggregate,` next to the existing `wave3Result,`:
```typescript
wave3Result,
personaBehavioralAggregate,
```

VERIFY before editing: `wave0Result` and `creatorContext` are both in scope at line 511. Read pipeline.ts:230-510 to confirm — both should be local variables from the Phase 4 D-17 pre-fetch (creatorContext) and the Phase 4 Wave 0 call (wave0Result).

**Step B: Confirm aggregator.ts assembly compiles** against the new PipelineResult. Plan 07-02a added the placeholder lines:
```typescript
persona_behavioral_aggregate: pipelineResult.personaBehavioralAggregate ?? null,
persona_simulation_results: pipelineResult.wave3Result,
```

These remain unchanged in this plan — Plan 07-03 lands the FULL aggregator integration (`signal_availability.personas` flag + optional `behavioralSource` param to swap the behavioral_predictions source). For this plan, just verify no new edits to `aggregator.ts` are needed (`pnpm tsc --noEmit` confirms).

If TypeScript flags any error in the aggregator.ts assembly block after the pipeline.ts widening, the most likely cause is the new `personaBehavioralAggregate` field name colliding with a typo upstream — re-read both files and fix the path.
  </action>
  <verify>
    <automated>pnpm tsc --noEmit 2>&1 | grep -i "error" | head -10 || echo "TSC CLEAN" ; pnpm vitest run src/lib/engine/__tests__/pipeline 2>&1 | tail -15</automated>
  </verify>
  <acceptance_criteria>
    - `src/lib/engine/pipeline.ts` contains exact string `const wave3Outcome = await runWave3(`
    - `src/lib/engine/pipeline.ts` Wave 3 call passes 5 arguments — `payload`, `deepseekRaw?.reasoning ?? null`, `wave0Result`, `creatorContext`, `onStageEvent` (verify via reading the call block; `grep -A 6 "wave3Outcome = await runWave3" src/lib/engine/pipeline.ts` shows all 5)
    - `src/lib/engine/pipeline.ts` contains exact string `personaBehavioralAggregate: PersonaBehavioralAggregate | null = wave3Outcome.aggregate`
    - `src/lib/engine/pipeline.ts` return block contains `personaBehavioralAggregate,` (grep matches at least once after the existing `wave3Result,` field)
    - `src/lib/engine/aggregator.ts` PredictionResult assembly still contains `persona_behavioral_aggregate: pipelineResult.personaBehavioralAggregate ?? null,` AND `persona_simulation_results: pipelineResult.wave3Result,` (unchanged from Plan 07-02a; Plan 07-03 owns further integration)
    - `pnpm tsc --noEmit` shows no new errors
    - Existing pipeline tests + aggregator tests pass (no behavior change in default path)
  </acceptance_criteria>
  <done>pipeline.ts surfaces wave3Outcome.aggregate as personaBehavioralAggregate on PipelineResult; aggregator's placeholder fields from 07-02a now receive real (non-default) values when Wave 3 runs.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Add wave3.test.ts orchestration tests + update stubs.test.ts backward-compat block</name>
  <files>src/lib/engine/__tests__/wave3.test.ts, src/lib/engine/__tests__/stubs.test.ts</files>
  <read_first>
    - src/lib/engine/wave3.ts (Task 1 output — full new file)
    - src/lib/engine/__tests__/wave0-niche-detector.test.ts (FULL — vi.mock("openai") pattern with MockOpenAI constructor + mockCreate constant; process.env.DEEPSEEK_API_KEY = "test-key" BEFORE import)
    - src/lib/engine/__tests__/wave0-orchestration.test.ts (FULL — full mocking pattern for orchestration tests; submodule vi.mock with mockFn references)
    - src/lib/engine/__tests__/stubs.test.ts (FULL — lines 64-86 current Wave 3 stub test contract; signature widening must preserve event behavior)
    - src/lib/engine/__tests__/factories.ts (read fakeCreatorContext + fakePayload helpers if exported there; otherwise inline minimal fixtures inside the test file)
    - .planning/phases/07-multi-persona-simulation/07-VALIDATION.md (Wave 0 test scaffolding requirements)
    - .planning/phases/07-multi-persona-simulation/07-CONTEXT.md (D-13 threshold; D-18 cost telemetry; PERSONA-01..11 requirement IDs)
  </read_first>
  <behavior>
    - Test 1 (PERSONA-01): Wave 3 fires exactly 10 parallel `deepseek-chat` calls when invoked. Assert via `mockCreate.mock.calls.length === 10` after mocked `runWave3` invocation with all-success responses.
    - Test 2 (PERSONA-11): The returned `Wave3Outcome.results` array contains 10 entries when all succeed. Each entry has `archetype`, `slot_type`, `niche`, `scroll_past_second`, `watch_through_pct`, `comment_intent`, `share_intent`, `save_intent`, `reasoning` fields.
    - Test 3 (D-13 threshold met): When 7 of 10 calls succeed and 3 reject, `Wave3Outcome.aggregate !== null` and `Wave3Outcome.warnings` contains 3 `Persona ... failed` entries.
    - Test 4 (D-13 threshold not met): When 5 of 10 calls succeed and 5 reject, `Wave3Outcome.aggregate === null` and warnings contains a `wave_3_below_threshold (5/7)` string.
    - Test 5 (Promise.allSettled isolation): When some calls reject synchronously, the other calls still run. Assert mockCreate.mock.calls.length === 10 (all 10 attempted).
    - Test 6 (D-18 cost telemetry — wave-level): The wave-level `wave_3_personas` stage_end event carries non-negative `cost_cents`.
    - Test 7 (PIPE-08 events): 10 per-persona stage_start + 10 per-persona stage_end + 1 wave-level stage_start + 1 wave-level stage_end events emitted (22 total when all 10 succeed).
    - Test 8 (PERSONA-09 env override): When `DEEPSEEK_PERSONA_MODEL=custom-model` is set in process.env BEFORE module re-import, the mocked OpenAI client receives `model: "custom-model"` on every call. (Reset env after test; use `vi.resetModules()` + dynamic import for re-instantiation.)
    - Test 9 (D-17 cache stability via system prompt — indirect): When `runWave3` is invoked twice with the SAME inputs, `mockCreate.mock.calls[0][0].messages[0].content` equals `mockCreate.mock.calls[10][0].messages[0].content` (first call of invocation A equals first call of invocation B for the same slot).
    - Test 10 (retry-once on validation failure — Pitfall 5): When first response is invalid JSON for one specific call and second response is valid, the same persona slot is retried once. Total mockCreate calls = 11 (10 base + 1 retry).
    - Test 11 (AbortError no-retry): When the first response throws an AbortError, the slot fails (no retry). Total mockCreate calls = 10.
    - Test 12 (circuit-breaker fast-fail — W-3): With `isCircuitOpen` mocked to return true via the importOriginal pattern, `runWave3` returns `{ aggregate: null, results: [], warnings: ["wave_3_circuit_breaker_open"] }` and `mockCreate.mock.calls.length === 0`.
    - Test 13 (stubs.test.ts backward-compat): Updated `runWave3(payload, null, wave0Result, creatorContext)` returns `{ aggregate: null, results: [], warnings: [...] }` when DeepSeek mock throws on every call.
    - Test 14 (stubs.test.ts events): Event names `wave_3_personas` + wave=3 still fire in the all-reject case (Phase 3 D-17 contract preserved at the SHAPE level).
  </behavior>
  <action>
**Step A: Create `src/lib/engine/__tests__/wave3.test.ts`.** Full orchestration test suite. Mirror `wave0-niche-detector.test.ts` for OpenAI mocking and `wave0-orchestration.test.ts` for the submodule mocking style. Test boilerplate (env BEFORE imports):

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ContentPayload, Wave0Result } from "../types";
import type { CreatorContext } from "../creator";
import type { StageEvent } from "../events";

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  })),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

const mockCreate = vi.fn();
vi.mock("openai", () => {
  const MockOpenAI = vi.fn(function (this: Record<string, unknown>) {
    this.chat = { completions: { create: mockCreate } };
  });
  return { default: MockOpenAI };
});

// W-3: mock isCircuitOpen while preserving other deepseek.ts exports (importOriginal pattern).
const mockIsCircuitOpen = vi.fn(() => false);
vi.mock("../deepseek", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../deepseek")>();
  return { ...orig, isCircuitOpen: mockIsCircuitOpen };
});

process.env.DEEPSEEK_API_KEY = "test-key";

import { runWave3 } from "../wave3";

function makePayload(): ContentPayload {
  return {
    content_text: "test caption",
    hashtags: ["beauty"],
    duration_hint: 30,
  } as ContentPayload;
}
function makeWave0Result(): Wave0Result {
  return {
    content_type: { type: "slideshow", confidence: 0.85 },
    niche: { primary: "beauty", sub: "skincare", micro: null, confidence: 0.9, source: "ai" },
  };
}
function makeCreatorContext(): CreatorContext {
  return {
    handle: "test",
    found: false,
    platform_averages: null,
    niches: ["beauty"],
    target_audience: null,
    past_wins: null,
    past_flops: null,
  } as unknown as CreatorContext;
}

function mockPersonaResponse(overrides: Partial<{
  scroll_past_second: number; watch_through_pct: number;
  comment_intent: number; share_intent: number; save_intent: number; reasoning: string;
}> = {}) {
  return {
    choices: [{
      message: {
        content: JSON.stringify({
          scroll_past_second: 5,
          watch_through_pct: 80,
          comment_intent: 20,
          share_intent: 30,
          save_intent: 70,
          reasoning: "default test reasoning",
          ...overrides,
        }),
      },
    }],
    usage: {
      prompt_tokens: 3000,
      prompt_cache_hit_tokens: 2500,
      prompt_cache_miss_tokens: 500,
      completion_tokens: 150,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsCircuitOpen.mockReturnValue(false);
});
```

Implement all 12 behavior tests (1-12) listed in `<behavior>` (Tests 13-14 live in `stubs.test.ts`). Critical patterns:

```typescript
describe("runWave3 — Phase 7 orchestration (Plan 07-02b)", () => {
  it("Test 1 (PERSONA-01): fires exactly 10 parallel deepseek-chat calls", async () => {
    mockCreate.mockImplementation(() => Promise.resolve(mockPersonaResponse()));
    await runWave3(makePayload(), null, makeWave0Result(), makeCreatorContext());
    expect(mockCreate.mock.calls.length).toBe(10);
  });

  it("Test 3 (D-13 threshold met): 7 succeed / 3 fail → aggregate non-null + 3 failure warnings", async () => {
    let n = 0;
    mockCreate.mockImplementation(() => {
      n++;
      if (n <= 7) return Promise.resolve(mockPersonaResponse());
      return Promise.reject(new Error("simulated failure"));
    });
    const outcome = await runWave3(makePayload(), null, makeWave0Result(), makeCreatorContext());
    expect(outcome.aggregate).not.toBeNull();
    expect(outcome.results.length).toBe(7);
    expect(outcome.warnings.filter((w) => w.startsWith("Persona ")).length).toBe(3);
  });

  it("Test 4 (D-13 threshold not met): 5 succeed / 5 fail → aggregate null + below-threshold warning", async () => {
    let n = 0;
    mockCreate.mockImplementation(() => {
      n++;
      if (n <= 5) return Promise.resolve(mockPersonaResponse());
      return Promise.reject(new Error("simulated failure"));
    });
    const outcome = await runWave3(makePayload(), null, makeWave0Result(), makeCreatorContext());
    expect(outcome.aggregate).toBeNull();
    expect(outcome.warnings.some((w) => w.includes("wave_3_below_threshold (5/7)"))).toBe(true);
  });

  it("Test 8 (PERSONA-09): DEEPSEEK_PERSONA_MODEL env override works", async () => {
    const prev = process.env.DEEPSEEK_PERSONA_MODEL;
    process.env.DEEPSEEK_PERSONA_MODEL = "custom-model";
    vi.resetModules();
    const { runWave3: freshRunWave3 } = await import("../wave3");
    mockCreate.mockImplementation(() => Promise.resolve(mockPersonaResponse()));
    await freshRunWave3(makePayload(), null, makeWave0Result(), makeCreatorContext());
    for (const call of mockCreate.mock.calls) {
      expect((call[0] as { model: string }).model).toBe("custom-model");
    }
    if (prev === undefined) delete process.env.DEEPSEEK_PERSONA_MODEL;
    else process.env.DEEPSEEK_PERSONA_MODEL = prev;
  });

  it("Test 12 (circuit-breaker fast-fail; W-3): no calls fire when isCircuitOpen returns true", async () => {
    mockIsCircuitOpen.mockReturnValue(true);
    const outcome = await runWave3(makePayload(), null, makeWave0Result(), makeCreatorContext());
    expect(mockCreate.mock.calls.length).toBe(0);
    expect(outcome.aggregate).toBeNull();
    expect(outcome.warnings).toContain("wave_3_circuit_breaker_open");
  });
});
```

Implement Tests 2, 5, 6, 7, 9, 10, 11 following the same pattern. See `<behavior>` for full assertions.

**Step B: Update `src/lib/engine/__tests__/stubs.test.ts` Wave 3 block (lines 64-86).** Read the current block. Replace with the widened-signature backward-compat tests (Tests 13-14):

```typescript
describe("Wave 3 backward-compat (Phase 7 widened signature; Plan 07-02b)", () => {
  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.resetModules();
  });

  it("Test 13: returns { aggregate: null, results: [], warnings: [...] } when all 10 calls reject", async () => {
    vi.doMock("openai", () => {
      const MockOpenAI = vi.fn(function (this: Record<string, unknown>) {
        this.chat = {
          completions: {
            create: vi.fn(() => Promise.reject(new Error("test-down"))),
          },
        };
      });
      return { default: MockOpenAI };
    });
    // W-3 pattern: preserve other deepseek exports via importOriginal
    vi.doMock("../deepseek", async (importOriginal) => {
      const orig = await importOriginal<typeof import("../deepseek")>();
      return { ...orig, isCircuitOpen: () => false };
    });
    const { runWave3 } = await import("../wave3");
    const fakeWave0Result = { content_type: null, niche: null };
    const fakeCreatorContext = {} as Parameters<typeof runWave3>[3];
    const outcome = await runWave3(fakePayload, null, fakeWave0Result, fakeCreatorContext);
    expect(outcome.aggregate).toBeNull();
    expect(outcome.results).toEqual([]);
    expect(outcome.warnings.length).toBeGreaterThanOrEqual(10);
  });

  it("Test 14: emits stage_start + stage_end with stage='wave_3_personas' and wave=3", async () => {
    vi.doMock("openai", () => {
      const MockOpenAI = vi.fn(function (this: Record<string, unknown>) {
        this.chat = {
          completions: {
            create: vi.fn(() => Promise.reject(new Error("test-down"))),
          },
        };
      });
      return { default: MockOpenAI };
    });
    vi.doMock("../deepseek", async (importOriginal) => {
      const orig = await importOriginal<typeof import("../deepseek")>();
      return { ...orig, isCircuitOpen: () => false };
    });
    const { runWave3 } = await import("../wave3");
    const cb = vi.fn();
    const fakeWave0Result = { content_type: null, niche: null };
    const fakeCreatorContext = {} as Parameters<typeof runWave3>[3];
    await runWave3(fakePayload, null, fakeWave0Result, fakeCreatorContext, cb);
    const events = cb.mock.calls.map((c) => c[0] as StageEvent);
    expect(events.some((e) => e.type === "stage_start" && (e as { stage: string }).stage === "wave_3_personas")).toBe(true);
    expect(events.some((e) => e.type === "stage_end" && (e as { stage: string }).stage === "wave_3_personas")).toBe(true);
  });
});
```

Adjust `fakePayload` to match the existing fixture in stubs.test.ts (read top of file for current shape).
  </action>
  <verify>
    <automated>pnpm vitest run src/lib/engine/__tests__/wave3.test.ts src/lib/engine/__tests__/stubs.test.ts --reporter=verbose 2>&1 | tail -50</automated>
  </verify>
  <acceptance_criteria>
    - `src/lib/engine/__tests__/wave3.test.ts` exists with 12 test cases (Tests 1-12)
    - File contains the `vi.mock("../deepseek", async (importOriginal) => { ... })` pattern (W-3 — preserves other deepseek exports)
    - File contains exact string `mockCreate.mock.calls.length` (assertions on parallel-call count)
    - File contains exact string `wave_3_circuit_breaker_open` (Test 12 assertion)
    - `src/lib/engine/__tests__/stubs.test.ts` Wave 3 block contains the updated widened-signature tests (Tests 13-14)
    - `pnpm vitest run src/lib/engine/__tests__/wave3.test.ts src/lib/engine/__tests__/stubs.test.ts` exits 0 with ≥ 14 passing tests in the new wave3 + stubs blocks
  </acceptance_criteria>
  <done>wave3.test.ts implements 12 orchestration tests (parallel-call count, threshold met/not-met, Promise.allSettled isolation, cost telemetry, event count, env override, cache prefix stability, retry-once, AbortError no-retry, circuit-breaker fast-fail via importOriginal mock). stubs.test.ts Wave 3 block updated to widened signature with backward-compat assertions on shape + event names. All 14 tests pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| DeepSeek API → Wave 3 orchestrator | 10 parallel persona calls; Zod boundary at each response; circuit breaker fast-fail when API is known-down |
| 10 parallel responses → PersonaSimulationResult[] | Per-call validation; ≥7 threshold gates aggregate visibility; failed personas surface as warnings via Promise.allSettled |
| Wave 3 output → PipelineResult | wave3Outcome.aggregate surfaces as personaBehavioralAggregate; wave3Outcome.results as wave3Result; warnings appended to pipeline-level warnings array |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-07-02b-01 | Denial of Service | 10× parallel API calls when DeepSeek is down | mitigate | Circuit-breaker fast-fail via `isCircuitOpen()` — zero calls fire when breaker open. Test 12 asserts via importOriginal mock pattern (W-3). |
| T-07-02b-02 | Denial of Service | Per-call timeout exhaustion | mitigate | 15s `AbortController` per call; Promise.allSettled isolates failures so timeouts don't cascade. |
| T-07-02b-03 | Tampering | Zod boundary validation bypass via retry loop | mitigate | Retry-once ONLY on `validation failed` substring; no retry on AbortError or non-validation errors. Tests 10 + 11 assert mechanic. |
| T-07-02b-04 | Tampering | OUTPUT_PRICE misconfiguration (W-4) | mitigate | Acceptance criterion explicitly asserts `OUTPUT_PRICE = 0.28 / 1_000_000` present AND `0.42 / 1_000_000` absent. |
| T-07-02b-05 | Information Disclosure | Per-persona Sentry tags expose internal slot identifiers | accept | Sentry tags carry `archetype` + `slot_type` — neither identifies users or PII. Same posture as wave0/niche-detector.ts (Phase 4). |
</threat_model>

<verification>
- All 3 tasks complete with `<automated>` commands exiting 0
- `pnpm vitest run src/lib/engine/__tests__/wave3*.test.ts src/lib/engine/__tests__/stubs.test.ts src/lib/engine/__tests__/wave3-aggregator.test.ts` exits 0
- `pnpm tsc --noEmit` shows no new errors
- `git diff --name-only` for this plan shows ONLY: `src/lib/engine/wave3.ts`, `src/lib/engine/pipeline.ts`, `src/lib/engine/aggregator.ts` (touched only insofar as Plan 07-02a's placeholders remain), `src/lib/engine/__tests__/wave3.test.ts`, `src/lib/engine/__tests__/stubs.test.ts`
- `git diff src/lib/engine/deepseek.ts` returns empty (B-1 enforcement — isCircuitOpen already exported at line 736, no edit needed)
- `git diff src/lib/niches/taxonomy.ts` returns empty (Pitfall 7 still honored)
</verification>

<success_criteria>
- 10 parallel `deepseek-chat` calls fire on every Wave 3 invocation (SC#1 ✓ + PERSONA-01 ✓ + PIPE-08 ✓)
- Each persona returns structured JSON with scroll_past_second, watch_through_pct, comment_intent, share_intent, save_intent (SC#3 ✓ + PERSONA-06 ✓)
- ≥7 threshold gates aggregate visibility (D-13 ✓)
- Per-persona drop-off second persisted on PredictionResult.persona_simulation_results via pipeline + Plan 07-02a placeholders (SC#5 substrate ✓; full integration completes in Plan 07-03)
- Wave 3 inherits DeepSeek circuit breaker via the existing line-736 isCircuitOpen export (B-1 honored — no redundant export edit)
- Cost telemetry uses OUTPUT_PRICE 0.28/M (W-4) — verified by acceptance grep + cost budget test in Plan 07-04
- 14 tests across wave3.test.ts (12) + stubs.test.ts (2 updated) pass; existing pipeline.test.ts + aggregator.test.ts still pass under widened signatures
- aggregator.ts integration (`signal_availability.personas` + behavioralSource param) is INTENTIONALLY left for Plan 07-03
</success_criteria>

<output>
After completion, create `.planning/phases/07-multi-persona-simulation/07-02b-SUMMARY.md` capturing:
- 5 files modified (wave3.ts rewritten; pipeline.ts widened call site; aggregator.ts placeholder unchanged; wave3.test.ts new; stubs.test.ts updated)
- B-1 confirmation: `git diff src/lib/engine/deepseek.ts` empty — no isCircuitOpen export edit
- W-3 confirmation: importOriginal pattern used in `vi.mock("../deepseek", ...)` blocks
- W-4 confirmation: OUTPUT_PRICE = 0.28/M; grep for `0.42` in wave3.ts returns 0
- Test pass count: 12 wave3 + 2 stubs + (carry-over: 11 wave3-aggregator from Plan 07-02a)
- Plan 07-03 input: aggregator.ts placeholder fields work but signal_availability.personas + behavioralSource swap are still TODO — Plan 07-03 owns
</output>
