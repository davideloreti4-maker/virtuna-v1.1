# Phase 7: Multi-Persona Simulation - Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 11 (4 new + 7 modified/extended)
**Analogs found:** 11 / 11 (every Phase 7 file has a direct in-repo analog — Phase 4's `wave0/` subfolder is a near-perfect mirror of Phase 7's intended `wave3/` subfolder)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/engine/wave3.ts` (rewritten body) | orchestrator | request-response, batch | `src/lib/engine/wave0.ts` | exact |
| `src/lib/engine/wave3/persona-registry.ts` (NEW) | data registry + lookup | transform | `src/lib/niches/taxonomy.ts` + `src/lib/engine/wave0/content-type-weights.ts` | exact |
| `src/lib/engine/wave3/persona-prompts.ts` (NEW) | prompt builder | transform | `src/lib/engine/wave0/prompts.ts` | exact |
| `src/lib/engine/wave3/aggregator.ts` (NEW) | aggregator helper | transform, batch | `src/lib/engine/wave0/content-type-weights.ts` (pure-fn shape) + `src/lib/engine/aggregator.ts` (aggregation math idiom) | role-match |
| `src/lib/engine/types.ts` (extended) | type module | n/a | `src/lib/engine/types.ts` (extend in place, mirror Phase 4 D-08 widening) | exact (in-place) |
| `src/lib/engine/pipeline.ts` (call-site widening, ~line 511, ~line 40-59 result shape) | orchestrator (call site) | request-response | `src/lib/engine/pipeline.ts` (Wave 0 widening pattern from Phase 4) | exact (in-place) |
| `src/lib/engine/aggregator.ts` (additive: `signal_availability.personas` + opt-in `behavioralSource` param) | aggregator | transform | `src/lib/engine/aggregator.ts:330-349` itself (D-20 added `content_type` + `niche` keys identically) | exact (in-place) |
| `src/lib/engine/corpus/eval-harness.ts` (or `eval-runner.ts`) (extended) | orchestrator (eval harness) | batch | `src/lib/engine/corpus/eval-harness.ts:50-100` + `eval-runner.ts:103-104` | exact (in-place) |
| `src/lib/engine/__tests__/wave3.test.ts` (NEW) | test (orchestrator) | n/a | `src/lib/engine/__tests__/wave0-orchestration.test.ts` | exact |
| `src/lib/engine/__tests__/wave3-persona-registry.test.ts` (NEW) | test (data + allocation) | n/a | `src/lib/engine/__tests__/content-type-weights.test.ts` | exact |
| `src/lib/engine/__tests__/wave3-persona-prompts.test.ts` (NEW) | test (prompt builder + Zod) | n/a | `src/lib/engine/__tests__/wave0-niche-detector.test.ts` (Zod + mocked OpenAI client pattern) | exact |
| `src/lib/engine/__tests__/wave3-aggregator.test.ts` (NEW) | test (pure math) | n/a | `src/lib/engine/__tests__/content-type-weights.test.ts` (pure-fn unit-test shape) | exact |
| `src/lib/engine/__tests__/stubs.test.ts` (extended) | test | n/a | `src/lib/engine/__tests__/stubs.test.ts:64-86` (current Wave 3 stub contract) | exact (in-place) |
| `src/lib/engine/__tests__/factories.ts` (extended) | test factory | n/a | `src/lib/engine/__tests__/factories.ts:259` (current `wave3Result: []` default) | exact (in-place) |

---

## Pattern Assignments

### `src/lib/engine/wave3.ts` — orchestrator (request-response, batch fan-out)

**Analog:** `src/lib/engine/wave0.ts` (Phase 4 — same `Promise.allSettled` shape, same Sentry capture-on-reject discipline, same nullable graceful-degradation contract).

**Imports pattern** (lines 1-10 of `wave0.ts`):
```typescript
import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentPayload, Wave0Result } from "./types";
import type { CreatorContext } from "./creator";
import type { StageEventCallback } from "./events";
import { detectContentType } from "./wave0/content-type-detector";
import { detectNiche } from "./wave0/niche-detector";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "wave0" });
```
**Phase 7 adaptation:**
- Import from `./wave3/persona-registry` (`selectPersonaSlots`, `type PersonaSlot`), `./wave3/persona-prompts` (`buildPersonaSystemPrompt`, `buildPersonaUserMessage`, `PersonaResponseSchema`), `./wave3/aggregator` (`aggregatePersonaResults`).
- Import `OpenAI` directly (mirror `wave0/niche-detector.ts:2`) since Wave 3 OWNS the DeepSeek call (Wave 0 delegated to detectors; Wave 3 fans out 10 calls itself).
- Logger: `createLogger({ module: "wave3" })`.
- Per RESEARCH Pattern 1 line 311, also import `isCircuitOpen` from `./deepseek` (currently a private function — will need to export it or duplicate the breaker check).

**Promise.allSettled orchestration** (lines 34-37 of `wave0.ts` — load-bearing analog for Phase 7):
```typescript
const [contentTypeOutcome, nicheOutcome] = await Promise.allSettled([
  detectContentType(payload, supabase, onEvent),
  detectNiche(payload, creatorContext, onEvent),
]);
```
**Phase 7 adaptation (D-13 threshold logic):**
```typescript
const settledResults = await Promise.allSettled(slots.map(callPersona));
const survivors: PersonaSimulationResult[] = [];
const warnings: string[] = [];
for (let i = 0; i < settledResults.length; i++) {
  const outcome = settledResults[i];
  if (outcome.status === "fulfilled") {
    survivors.push(outcome.value);
  } else {
    const slot = slots[i];
    warnings.push(`Persona ${slot.archetype}/${slot.slot_type} failed: ${outcome.reason?.message ?? outcome.reason}`);
  }
}
// D-13: ≥7-of-10 threshold check happens inside aggregatePersonaResults().
```

**Sentry-on-rejected pattern** (lines 39-56 of `wave0.ts` — WR-01):
```typescript
if (contentTypeOutcome.status === "rejected") {
  // WR-01: capture rejected detector outcomes to Sentry for observability
  Sentry.captureException(contentTypeOutcome.reason, {
    tags: { stage: "wave_0_content_type", source: "orchestrator" },
  });
  log.warn("Content-type detector rejected", {
    reason: String(contentTypeOutcome.reason),
  });
}
```
**Phase 7 adaptation:** Per-persona Sentry tags `{ stage: "wave_3_persona", archetype: slot.archetype, slot_type: slot.slot_type }` — already shown in RESEARCH Pattern 1 lines 447-449. Tags fire inside `callPersona`, not in the orchestrator (events fire from the same level that owns the try/catch).

**Stage event emission** — Phase 7 emits per-persona events from inside `callPersona` (mirrors Phase 4 D-16 "event ownership moved DOWN to detectors" pattern from `wave0/niche-detector.ts:54, 180-184`). The Wave-level `wave_3_personas` start/end fires from the body of `runWave3` itself, summing per-call cost.

---

### `src/lib/engine/wave3/persona-registry.ts` — data registry + lookup (NEW)

**Analog 1 (locked-table pattern):** `src/lib/engine/wave0/content-type-weights.ts` (Phase 4 — 7-row matrix, `Record<ContentTypeSlug, ...>` typing, lookup function with `?? "other"` fallback). This is the **closest analog** because the 7-row D-10 allocation table is literally a 7-row lookup keyed by `ContentTypeSlug`.

**Analog 2 (hardcoded-TS-module pattern):** `src/lib/niches/taxonomy.ts` (Phase 2 D-10 — taxonomy data lives in code, versioned in git, no runtime DB roundtrips; `NICHE_TREE` exported as `const`).

**Locked-table excerpt** (lines 10-23 of `wave0/content-type-weights.ts`):
```typescript
/**
 * LOCKED matrix per CONTEXT D-12 (Phase 4).
 * Phase 10 may revise based on Phase 1 corpus benchmark evidence.
 * DO NOT modify here — modification requires a Phase 10 commit + version bump.
 */
export const CONTENT_TYPE_WEIGHT_MATRIX: Record<ContentTypeSlug, SignalMultipliers> = {
  talking_head: { visual_production_quality: 1.0, hook_visual_impact: 1.1, pacing_score: 1.0, transition_quality: 0.8 },
  b_roll:       { visual_production_quality: 1.2, hook_visual_impact: 1.0, pacing_score: 1.0, transition_quality: 1.2 },
  slideshow:    { visual_production_quality: 0.8, hook_visual_impact: 0.9, pacing_score: 0.5, transition_quality: 0.7 },
  action:       { visual_production_quality: 1.3, hook_visual_impact: 1.2, pacing_score: 1.2, transition_quality: 1.3 },
  tutorial:     { visual_production_quality: 1.0, hook_visual_impact: 1.2, pacing_score: 1.1, transition_quality: 1.0 },
  vlog:         { visual_production_quality: 0.9, hook_visual_impact: 0.8, pacing_score: 0.9, transition_quality: 0.9 },
  other:        { visual_production_quality: 1.0, hook_visual_impact: 1.0, pacing_score: 1.0, transition_quality: 1.0 },
};
```

**Phase 7 adaptation — the D-10 allocation table** (RESEARCH lines 820-830):
```typescript
export const ALLOCATION_TABLE: Record<ContentTypeSlug, Record<SlotType, number>> = {
  talking_head: { fyp: 5, niche_deep: 2, loyalist: 2, cross_niche: 1 },
  b_roll:       { fyp: 7, niche_deep: 2, loyalist: 0, cross_niche: 1 },
  slideshow:    { fyp: 6, niche_deep: 2, loyalist: 1, cross_niche: 1 },
  action:       { fyp: 7, niche_deep: 2, loyalist: 0, cross_niche: 1 },
  tutorial:     { fyp: 4, niche_deep: 3, loyalist: 2, cross_niche: 1 },
  vlog:         { fyp: 4, niche_deep: 2, loyalist: 3, cross_niche: 1 },
  other:        { fyp: 6, niche_deep: 2, loyalist: 1, cross_niche: 1 },
};
```

**Lookup-with-fallback** (line 42 of `wave0/content-type-weights.ts`):
```typescript
const mult = CONTENT_TYPE_WEIGHT_MATRIX[contentType ?? "other"];
```
**Phase 7 adaptation:** `const row = ALLOCATION_TABLE[contentType ?? "other"]`. The `?? "other"` fallback handles both `null` (Wave 0 content-type detection failed) and `mixed_content_detected` warning (Phase 4 D-10) → both route to the `other` row (6/2/1/1 default per D-10).

**`as const` enum + `Record<Enum, T>` pattern** (taxonomy.ts uses string-literal type for `slug`; wave0/types.ts uses `z.enum([...] as const)` for `ContentTypeSlug`). Phase 7 mirrors this:
```typescript
export const ARCHETYPES = [
  "high_engager", "saver", "lurker", "sharer", "tough_crowd", "purposeful_viewer",
  "niche_deep_buyer", "niche_deep_scout", "loyalist", "cross_niche_curiosity",
] as const;
export type Archetype = (typeof ARCHETYPES)[number];
```

**Lookup function shape** (`applyContentTypeWeights`, lines 38-55 of `wave0/content-type-weights.ts`):
- Pure function, returns NEW object (never mutates input — load-bearing for byte-stability of system prompts that consume this data).
- Null-input fallback at the top.
- No side effects, no logging.

**Phase 7 adaptation:** `selectPersonaSlots(contentType, nicheSlug)` returns a fresh `PersonaSlot[10]` array. Throws on length mismatch (Pitfall 2 — RESEARCH lines 907-909):
```typescript
if (slots.length !== 10) {
  throw new Error(`Persona allocation mismatch: expected 10, got ${slots.length} for content_type=${contentType}`);
}
```

**Key adaptations needed for Phase 7:**
1. **Pitfall 7 avoidance** — Do NOT mutate `taxonomy.ts`'s `personas` field (Phase 4 D-13 slugs `"fyp-female-gen-z"` etc.). Phase 7's new registry is a **separate module**. Existing `taxonomy.test.ts` continues to pass unchanged. (Verified at `src/lib/niches/taxonomy.ts:68-74`.)
2. **Read-only consumer of `taxonomy.ts`** — Phase 7 imports `NICHE_TREE` for niche labels via `find((p) => p.slug === nicheSlug)?.label` (mirror of `wave0/niche-detector.ts:9, 42` consumer pattern).
3. **240-prefix cache combinatorics** — Each `PersonaSlot` must produce a byte-stable system prompt for the same `{archetype × niche × time_of_day}` tuple. `selectPersonaSlots` returns deterministic outputs for identical inputs (no Math.random, no Date.now, no per-call salts).

---

### `src/lib/engine/wave3/persona-prompts.ts` — prompt builder (NEW)

**Analog:** `src/lib/engine/wave0/prompts.ts` (Phase 4 — load-bearing analog: same stable-prefix + volatile-tail split, same PROFILE-16 host-only sanitization, same module-level constant pattern for the system prompt).

**Stable system prompt pattern** (lines 5-46 of `wave0/prompts.ts`):
```typescript
// =====================================================
// STABLE system prompt — byte-identical across calls (Phase 3 D-12 + Pitfall 2/3).
// NICHE_TREE inlining resolved at MODULE LOAD; still byte-identical per-request.
// Dynamic content (caption, hashtags, handle, Card data) goes EXCLUSIVELY
// in the user message — never in this prompt.
// =====================================================

const PRIMARY_SLUGS = NICHE_TREE.map((p) => p.slug).join(", ");
const NICHE_TREE_TEXT = NICHE_TREE
  .map((p) => `- ${p.slug}: ${p.subs.map((s) => s.slug).join(", ")}`)
  .join("\n");

export const NICHE_SYSTEM_PROMPT = `You are a TikTok content niche classifier...

## Output

Return JSON with this exact shape:
{ ... }

Return ONLY the JSON object. No explanation, no markdown.`;
```
**Phase 7 adaptation (CRITICAL DIFFERENCE — function vs constant):**
- Wave 0 has ONE system prompt for one detector → `const NICHE_SYSTEM_PROMPT`.
- Wave 3 has ~240 distinct system prompts (one per `{archetype × niche × time-of-day}` tuple) → `function buildPersonaSystemPrompt(slot: PersonaSlot): string`.
- Same byte-stability discipline: same inputs → byte-identical output. Verified by unit test (RESEARCH validation table line 1417 — "cache prefix stability").

**Phase 7 system-prompt builder** (RESEARCH lines 525-578 — verbatim starting point):
```typescript
export function buildPersonaSystemPrompt(slot: PersonaSlot): string {
  return `You are simulating a single TikTok For You Page viewer.

## Your Behavioral Archetype

${slot.archetype_definition.trim()}

## Your Scroll-Past + Stop Triggers

You scroll past when: ${slot.scroll_past_triggers.join("; ")}.
You stop scrolling for: ${slot.stop_triggers.join("; ")}.

## Your Psychographic Motivator

You watch TikTok primarily as a ${slot.motivator}.

## Your Current Context

${slot.time_of_day_label}. ${slot.time_of_day_description}

## Niche Instantiation

You are part of the ${slot.niche_label} cluster on TikTok.

${slot.niche_instantiation.trim()}

## Your Task

You will be shown one video's summary, caption, hashtags, and context. React AS THIS PERSONA — not as a neutral observer. Respond with how YOU specifically would react to scrolling past this on your FYP.

## Output Format

Return a JSON object with this exact shape (NO markdown, NO extra text):
{ "scroll_past_second": <integer or float 0..video_duration_seconds, ...>, "watch_through_pct": <number 0..100>, "comment_intent": <0..100>, "share_intent": <0..100>, "save_intent": <0..100>, "reasoning": "<1-2 sentence reaction>" }

Stay in character. Your reasoning should feel authentic to ${slot.archetype} — not analytical.`;
}
```

**Volatile user message pattern** (lines 53-97 of `wave0/prompts.ts`):
```typescript
export function buildNicheUserMessage(
  payload: ContentPayload,
  ctx: CreatorContext,
): string {
  const sections: string[] = ["## Content to Classify"];
  sections.push("Caption / content text:");
  sections.push(payload.content_text || "(no caption)");
  // ... etc

  // PROFILE-16: past_wins URLs are HOST-ONLY
  if (ctx.past_wins && ctx.past_wins.length > 0) {
    const hosts = ctx.past_wins
      .map((w) => tryUrlHost(w.url))
      .filter(Boolean)
      .join(", ");
    if (hosts) sections.push(`Card 6 (past wins hosts): ${hosts}`);
  }

  sections.push("");
  sections.push("Return the classification JSON now.");
  return sections.join("\n");
}
```

**PROFILE-16 host-only helper** (lines 110-116 of `wave0/prompts.ts`) — Phase 7 reuses verbatim:
```typescript
function tryUrlHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}
```

**Phase 7 user-message builder** — extends with persona-specific blocks (RESEARCH lines 584-654):
- Loyalist-only past_wins surfacing (D-03) — guard with `slot.slot_type === "loyalist" && creatorContext.past_wins?.length`. Fallback to "loyal follower of [niche] creators generally" when null (D-03 explicit null fallback — Pitfall 3, RESEARCH lines 1126-1134).
- Content-type echo from Wave 0 (`wave0Result.content_type.type` + confidence) — feeds persona's reaction context.
- Wave 2 DeepSeek synthesis hint (component_scores.hook_effectiveness + retention_strength + warnings) — gives the persona richer grounding.

**Zod schema pattern** (lines 109-118 of `wave0/niche-detector.ts` — two-stage validation):
```typescript
// (1) Zod shape validation
const validatedAi = Wave0NicheResultSchema.safeParse({
  primary: raw.primary,
  sub: raw.sub,
  micro: raw.micro ?? null,
  confidence: raw.confidence,
  source: "ai",
});
if (!validatedAi.success) {
  throw new Error(`Niche response validation failed: ${validatedAi.error.message}`);
}
```
**Phase 7 adaptation — `PersonaResponseSchema`** (RESEARCH lines 659-666; lives in `persona-prompts.ts` next to the builders):
```typescript
export const PersonaResponseSchema = z.object({
  scroll_past_second: z.number().min(0),
  watch_through_pct: z.number().min(0).max(100),
  comment_intent: z.number().min(0).max(100),
  share_intent: z.number().min(0).max(100),
  save_intent: z.number().min(0).max(100),
  reasoning: z.string().min(1).max(500),  // Pitfall 5: required + non-empty to prevent LLM token-budget compression
});
export type PersonaResponse = z.infer<typeof PersonaResponseSchema>;
```

**Key adaptations needed for Phase 7:**
1. The per-niche instantiation block lives in the SYSTEM prompt (D-17 cache discipline — Pitfall 1, RESEARCH lines 1106-1114). DO NOT put `niche_instantiation` text in the user message; this breaks cache prefix and drops hit rate to near-zero.
2. The system prompt is now a FUNCTION (`buildPersonaSystemPrompt(slot)`), not a module-level constant. Cache stability lives at the function-output level — same `slot` → same string, asserted by unit test.
3. `reasoning` field is required (`z.string().min(1).max(500)`) — Pitfall 5 (LLMs occasionally omit reasoning under token-budget pressure; required-non-empty + retry-once mitigates).
4. The user message MUST NOT leak full URLs — only `URL(u).host` via the reused `tryUrlHost` helper (PROFILE-16; Assumption A5 in RESEARCH).

---

### `src/lib/engine/wave3/aggregator.ts` — per-metric different aggregation (NEW)

**Analog 1 (pure-fn shape):** `src/lib/engine/wave0/content-type-weights.ts:38-55` — pure function, no side effects, returns new object, null-input fallback at top.

**Analog 2 (aggregation idiom):** `src/lib/engine/aggregator.ts:354-368` — flat-mean reduction over component scores. The shape `sum / count` is the same as Phase 7's `completion_pct = mean(watch_through_pct)`.

**Pure-function shape** (lines 38-55 of `wave0/content-type-weights.ts`):
```typescript
export function applyContentTypeWeights(
  signals: GeminiVideoSignals,
  contentType: ContentTypeSlug | null,
): GeminiVideoSignals {
  const mult = CONTENT_TYPE_WEIGHT_MATRIX[contentType ?? "other"];
  const clamp = (m: number) =>
    Math.max(MULTIPLIER_FLOOR, Math.min(MULTIPLIER_CEILING, m));
  return {
    visual_production_quality:
      Math.min(10, signals.visual_production_quality * clamp(mult.visual_production_quality)),
    // ...
  };
}
```

**Mean-reduction analog** (lines 358-367 of `aggregator.ts`):
```typescript
const behavioralAvg = cs
  ? (cs.hook_effectiveness +
      cs.retention_strength +
      cs.shareability +
      cs.comment_provocation +
      cs.save_worthiness +
      cs.trend_alignment +
      cs.originality) /
    7
  : 0;
const behavioral_score = Math.round(behavioralAvg * 10);
```
**Phase 7 adaptation — Pattern 4 from RESEARCH (lines 990-1058):**
```typescript
const TOP_N = 3;
const TOP_WEIGHT_TOTAL = 0.60;
const REMAINING_WEIGHT_TOTAL = 0.40;

export function aggregatePersonaResults(
  survivors: PersonaSimulationResult[],
  successThreshold: number = 7,
): { aggregate: PersonaBehavioralAggregate | null; warnings: string[] } {
  if (survivors.length < successThreshold) {
    return {
      aggregate: null,
      warnings: [`wave_3_below_threshold (${survivors.length}/${successThreshold})`],
    };
  }
  const completion_pct = mean(survivors.map((s) => s.watch_through_pct));
  const share_pct = topNWeighted(survivors, "share_intent");
  const comment_pct = topNWeighted(survivors, "comment_intent");
  const save_pct = topNWeighted(survivors, "save_intent");
  // ... assemble PersonaBehavioralAggregate
}
```

**Tie-break stability** (RESEARCH Pattern 4 lines 1039-1044):
```typescript
const sorted = [...survivors].sort((a, b) => {
  const diff = b[metric] - a[metric];
  if (diff !== 0) return diff;
  // tie-break: archetype enum order (deterministic — Open Question #4 resolved)
  return ARCHETYPES.indexOf(a.archetype) - ARCHETYPES.indexOf(b.archetype);
});
```

**Defensive edge case (Pitfall 4, RESEARCH lines 1136-1144):**
```typescript
// When remaining.length === 0 (n < TOP_N + 1, defensive only — threshold = 7 prevents),
// return topMean directly. Avoids silent 60% × topMean shrinkage.
if (remaining.length === 0) return topMean;
return TOP_WEIGHT_TOTAL * topMean + REMAINING_WEIGHT_TOTAL * remainingMean;
```

**Key adaptations needed for Phase 7:**
1. Per-metric DIFFERENT rule (D-06) — `completion_pct` is flat mean; `share/comment/save` are top-3-weighted. Three of four metrics share the `topNWeighted` helper; the fourth (`completion_pct`) uses `mean`. Test all four in `wave3-aggregator.test.ts`.
2. Threshold (D-13) — `< 7 survivors → aggregate = null + warning`; `≥ 7 → compute aggregate`. The aggregator returns BOTH the (nullable) aggregate AND a warnings array (mirror of Phase 4 `wave0` pattern where detectors return null + the orchestrator surfaces the warning).
3. Survivor-aware math — top-3 is always top-3 of survivors (not top-3 of original 10); remaining 40% splits across `(survivors.length - 3)`. RESEARCH Open Question #4 + Pattern 4 lines 1039-1044 specify the tie-break.
4. Percentile-label placeholder (RESEARCH lines 1060-1064) — the existing `FALLBACK_DEEPSEEK_CALIBRATION` shape in `deepseek.ts:227-239` is the percentile substrate; planner wires the actual label assignment.

---

### `src/lib/engine/types.ts` — type module (additive widening)

**Analog (in-place — same file):** Phase 4 D-08 widening of `Wave0Result` (`types.ts:303-307`). Same idiom: add Zod schema → `type X = z.infer<typeof XSchema>` → export both. The SignalAvailability widening (lines 198-206) was the Phase 4 model for adding the `content_type` / `niche` keys; Phase 7 mirrors with the `personas: boolean` key.

**Existing `PersonaSimulationResult` (lines 210-218 — to widen per D-19):**
```typescript
/** Wave 3 persona simulation result — Phase 7 fills with real V3 reactions. */
export interface PersonaSimulationResult {
  persona_id: string;
  scroll_past_second: number;
  watch_through_pct: number;
  comment_intent: number;
  share_intent: number;
  save_intent: number;
}
```
**Phase 7 widening (D-19):**
```typescript
export const PersonaArchetypeSchema = z.enum([
  "high_engager", "saver", "lurker", "sharer", "tough_crowd", "purposeful_viewer",
  "niche_deep_buyer", "niche_deep_scout", "loyalist", "cross_niche_curiosity",
] as const);
export type PersonaArchetype = z.infer<typeof PersonaArchetypeSchema>;

export const PersonaSlotTypeSchema = z.enum(["fyp", "niche_deep", "loyalist", "cross_niche"] as const);
export type PersonaSlotType = z.infer<typeof PersonaSlotTypeSchema>;

export const PersonaSimulationResultSchema = z.object({
  persona_id: z.string(),
  archetype: PersonaArchetypeSchema,
  slot_type: PersonaSlotTypeSchema,
  niche: z.string(),
  scroll_past_second: z.number().min(0),
  watch_through_pct: z.number().min(0).max(100),
  comment_intent: z.number().min(0).max(100),
  share_intent: z.number().min(0).max(100),
  save_intent: z.number().min(0).max(100),
  reasoning: z.string().min(1).max(500),
});
export type PersonaSimulationResult = z.infer<typeof PersonaSimulationResultSchema>;

// D-19 alias — distinguish at type level from raw BehavioralPredictions.
export type PersonaBehavioralAggregate = BehavioralPredictions;
```

**Existing `SignalAvailability` (lines 193-206 — to widen per D-15):**
```typescript
export interface SignalAvailability {
  behavioral: boolean;
  gemini: boolean;
  ml: boolean;
  rules: boolean;
  trends: boolean;
  content_type: boolean;  // NEW Phase 4 (D-20)
  niche: boolean;          // NEW Phase 4 (D-20)
}
```
**Phase 7 widening (D-15) — single new key:**
```typescript
export interface SignalAvailability {
  behavioral: boolean;
  gemini: boolean;
  ml: boolean;
  rules: boolean;
  trends: boolean;
  content_type: boolean;
  niche: boolean;
  personas: boolean;       // NEW Phase 7 (D-15) — set by aggregator from pipelineResult.personaBehavioralAggregate !== null
}
```

**Existing `PredictionResult` (lines 142-187 — to widen per D-20):** Add two additive fields:
```typescript
export interface PredictionResult {
  // ... existing fields ...
  /** Phase 7 (D-20) — null when Wave 3 below threshold (D-13). */
  persona_behavioral_aggregate: PersonaBehavioralAggregate | null;
  /** Phase 7 (D-09) — per-persona detail for M2 audience-viz. Empty array on fallback. */
  persona_simulation_results: PersonaSimulationResult[];
  signal_availability: SignalAvailability;  // already exists; .personas key added per D-15
}
```

**Key adaptations needed for Phase 7:**
1. **In-place edit** of the existing file — no new types file. Mirror the Phase 4 D-08 idiom in the same module section.
2. The Phase 4 widening kept the IMPLEMENTATION-layer types fully separate from the API-layer `analysis_results` JSONB columns — Phase 7 follows: new fields fit into existing `behavioral_predictions` JSON column or a new top-level `persona_*` JSON column (CONTEXT D-20: "Planner picks").

---

### `src/lib/engine/pipeline.ts` — call-site widening (in-place edit)

**Analog (in-place):** The Phase 4 widening of `runWave0` from a no-arg stub to `runWave0(payload, supabase, creatorContext, onEvent?)` was done at pipeline lines 470-499 (Wave 0 call site). Phase 7 mirrors at pipeline:511.

**Existing call site (lines 507-515 of `pipeline.ts`):**
```typescript
// -------------------------------------------------------
// Wave 3: Multi-persona simulation (Phase 7 fills the stub)
// Runs AFTER Wave 2 completes — events fire after wave_2 stage_end.
// -------------------------------------------------------
const wave3Result = await runWave3(
  payload,
  deepseekRaw?.reasoning ?? null,
  onStageEvent
);
```
**Phase 7 widening (signature gains `wave0Result` + `creatorContext`; return widens to `Wave3Outcome`):**
```typescript
const wave3Outcome = await runWave3(
  payload,
  deepseekRaw?.reasoning ?? null,
  wave0Result,           // NEW — for allocation routing per D-11
  creatorContext,        // NEW — for loyalist persona grounding per D-03
  onStageEvent
);
// Surface BOTH the per-persona detail AND the aggregate onto PipelineResult.
const wave3Result: PersonaSimulationResult[] = wave3Outcome.results;
const personaBehavioralAggregate: PersonaBehavioralAggregate | null = wave3Outcome.aggregate;
warnings.push(...wave3Outcome.warnings);
```

**`PipelineResult` shape widening (lines 40-59):**
```typescript
export interface PipelineResult {
  // ... existing fields ...
  wave0Result: Wave0Result;
  wave3Result: PersonaSimulationResult[];                            // existing — now widened payload
  personaBehavioralAggregate: PersonaBehavioralAggregate | null;     // NEW Phase 7 (Pitfall 9 — load-bearing for aggregator's signal_availability.personas read)
  requestId: string;
  // ...
}
```

Aggregator (line 347 — same file) gains the `personas: pipelineResult.personaBehavioralAggregate !== null` key on `availability`.

**Key adaptations needed for Phase 7:**
1. **No re-wiring of upstream stages** — Wave 3 runs AFTER Wave 2 in sequence (current pipeline.ts:508-509 comment confirms). The Phase 7 call-site change is local to lines 511-522.
2. The pipeline's `warnings` array (line 558) already collects from `wave0Result`, `geminiResult`, `trendEnrichment`. Phase 7 pushes `wave3Outcome.warnings` into the same array.
3. The Wave 3 `wave_3_below_threshold` warning surfaces here; no per-persona warnings (those are persona-call internals).

---

### `src/lib/engine/aggregator.ts` — additive `personas` key + optional `behavioralSource` param

**Analog (in-place — same file):** The Phase 4 widening at `aggregator.ts:330-349` added `content_type: pipelineResult.wave0Result.content_type !== null` and `niche: pipelineResult.wave0Result.niche !== null`. Phase 7 mirrors with `personas`.

**Existing `availability` block (lines 330-349):**
```typescript
const availability: SignalAvailability = {
  behavioral: deepseekResult !== null,
  gemini: geminiResult.analysis.factors.some((f) => f.score > 0),
  ml: mlAvailable,
  rules:
    ruleResult.matched_rules.length > 0 &&
    !pipelineResult.warnings.some((w) =>
      w.includes("Rule scoring unavailable")
    ),
  trends:
    trendEnrichment.matched_trends.length > 0 &&
    !pipelineResult.warnings.some((w) =>
      w.includes("Trend enrichment unavailable")
    ),
  // Phase 4 D-20: provenance flags surfaced from Wave 0 detector outcomes.
  // Persisted to analysis_results.signal_availability JSONB; do NOT participate
  // in selectWeights math (filtered out by SCORE_WEIGHT_KEYS).
  content_type: pipelineResult.wave0Result.content_type !== null,
  niche: pipelineResult.wave0Result.niche !== null,
};
```

**Phase 7 in-place addition (D-15):**
```typescript
const availability: SignalAvailability = {
  // ... existing keys unchanged ...
  content_type: pipelineResult.wave0Result.content_type !== null,
  niche: pipelineResult.wave0Result.niche !== null,
  // NEW Phase 7 (D-15) — additive provenance flag; does NOT participate in selectWeights math.
  personas: pipelineResult.personaBehavioralAggregate !== null,
};
```

**Optional `behavioralSource` param for D-14 A/B** (RESEARCH lines 1281-1295):
```typescript
export async function aggregateScores(
  pipelineResult: PipelineResult,
  onStageEvent?: StageEventCallback,
  options?: { behavioralSource?: "deepseek" | "personas" },
): Promise<PredictionResult> {
  // ... existing body ...
  const behavioralSource = options?.behavioralSource ?? "deepseek";  // default = production behavior
  const behavioral_predictions =
    behavioralSource === "personas" && pipelineResult.personaBehavioralAggregate !== null
      ? pipelineResult.personaBehavioralAggregate
      : (deepseek?.behavioral_predictions ?? FALLBACK_BEHAVIORAL);
  // ... rest of body ...
}
```
Production callers (route.ts) don't pass the option → unchanged behavior. The Phase 1 eval harness's substituted run passes `{ behavioralSource: "personas" }` for D-14.

**Key adaptations needed for Phase 7:**
1. **NO change to `SCORE_WEIGHTS`** (D-08 — behavioral 0.35 stays). Aggregator's selectWeights math + percentile mapping is untouched.
2. **NO change to `selectWeights()`** redistribution. Phase 10 may revise.
3. **NO change to the `behavioral_predictions` read source in production** (default `behavioralSource = "deepseek"`). Pitfall 10 (RESEARCH lines 1204-1213) — the optional param is the ONLY swap mechanism; production never passes it.

---

### `src/lib/engine/corpus/eval-harness.ts` (or `eval-runner.ts`) — D-14 A/B extension

**Analog (in-place):** `corpus/eval-runner.ts:103-104` — `aggregateScores(pipelineResult)` invocation. Phase 7 extends with an additional run passing `{ behavioralSource: "personas" }`.

**Existing eval loop excerpt (eval-runner.ts:103-104):**
```typescript
const pipelineResult = await runPredictionPipeline(input);
const prediction = await aggregateScores(pipelineResult);  // FIX: always await (benchmark.ts:515 bug)
```

**Phase 7 D-14 A/B extension** (RESEARCH lines 1297-1300):
```typescript
const pipelineResult = await runPredictionPipeline(input);
// Production run — reads deepseek.behavioral_predictions (unchanged)
const predictionDeepseek = await aggregateScores(pipelineResult);
// Substituted run — reads personaBehavioralAggregate (only when non-null per D-13)
const predictionPersonas = await aggregateScores(
  pipelineResult,
  undefined,
  { behavioralSource: "personas" },
);
// Persist BOTH rows to benchmark_results with distinct engine_version tags
// (e.g., "3.0.0-dev-personasA" / "3.0.0-dev-personasB" per D-14).
```

**Key adaptations needed for Phase 7:**
1. CONTEXT D-14: One-off run, not part of production pipeline. Output → `.planning/research/persona-aggregate-ab-2026-05-XX.md`.
2. ~$0.20 additional LLM cost — within Phase 1 corpus eval budget.
3. Planner decides whether to add a CLI flag (e.g., `npx tsx scripts/eval.ts --behavioral-source personas`) or run programmatically as a one-off script. RESEARCH validation section line 1439 suggests the CLI-flag pattern.
4. Open Question #6 (RESEARCH lines 1364-1367): whether substituted run also persists `persona_simulation_results` to a new `benchmark_persona_details` sidecar. Planner picks; recommend defer per RESEARCH.

---

### `src/lib/engine/__tests__/wave3.test.ts` — orchestration test (NEW)

**Analog:** `src/lib/engine/__tests__/wave0-orchestration.test.ts` (Phase 4 — mock both detectors, assert Promise.allSettled isolation, assert parallel firing, assert callback forwarding, assert event count).

**Test structure (lines 11-72 of `wave0-orchestration.test.ts`):**
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ContentPayload } from "../types";
import type { CreatorContext } from "../creator";

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  })),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

// Mock both detector modules so we can control resolution + verify forwarded args.
const mockDetectContentType = vi.fn();
const mockDetectNiche = vi.fn();
vi.mock("../wave0/content-type-detector", () => ({
  detectContentType: (...args: unknown[]) => mockDetectContentType(...args),
}));
vi.mock("../wave0/niche-detector", () => ({
  detectNiche: (...args: unknown[]) => mockDetectNiche(...args),
}));

import { runWave0 } from "../wave0";

describe("runWave0 — Phase 4 orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("both detectors succeed → Wave0Result has both fields non-null", async () => { /* ... */ });
  it("one detector fails, the other succeeds — Promise.allSettled isolation", async () => { /* ... */ });
  it("both detectors fail — Wave0Result has both null (stub contract preserved)", async () => { /* ... */ });
  it("creatorContext is passed through to detectNiche", async () => { /* ... */ });
  it("detectors fire in parallel (both invoked before either resolves)", async () => { /* ... */ });
  it("onEvent callback is forwarded to both detectors", async () => { /* ... */ });
  it("bypassCache: Wave 0 runs fresh under bypassCache (D-22 — no internal cache to bypass)", async () => { /* ... */ });
});
```

**Phase 7 adaptation (per RESEARCH validation table lines 1410-1431):**
- Mock the `openai` module (mirror `wave0-niche-detector.test.ts:20-26`) instead of mocking 10 separate functions. Each of the 10 calls hits the same mocked `chat.completions.create`.
- Test cases (mapping to req IDs):
  - PERSONA-01: 10 parallel calls fire (assert `mockCreate.mock.calls.length === 10`).
  - PERSONA-06 + D-19: retry-once on schema-fail (assert `mockCreate.mock.calls.length === 11` when first call returns invalid JSON; 10 calls + 1 retry).
  - PERSONA-09: `DEEPSEEK_PERSONA_MODEL` env override works.
  - PERSONA-11 + D-09: per-persona detail persists onto outcome.results.
  - PIPE-08: stage events fire (10 per-persona pairs + 1 wave-level pair = 22 events).
  - D-13 ≥7 threshold: aggregate computed at exactly 7 survivors; null at 6 survivors.
  - D-13 0-survivor edge: empty results + null aggregate + warning.
  - D-16 cost budget: with all-cache-hit usage, total cost_cents < $0.025 (== 2.5 cents).
  - D-18 cost telemetry: sum of 10 per-call cost_cents equals wave_3_personas stage_end cost_cents.

**Backwards-compat test extension (`stubs.test.ts:64-86`):**
```typescript
// Current Phase 3 stub contract:
describe("Wave 3 stub", () => {
  it("returns []", async () => {
    const result = await runWave3(fakePayload, null);
    expect(result).toEqual([]);
  });
  it("emits 1 stage_start + 1 stage_end with stage='wave_3_personas' and wave=3", async () => {
    const cb = vi.fn();
    await runWave3(fakePayload, null, cb);
    // ... event assertions ...
  });
});
```
**Phase 7 adaptation:** Update calls to pass the widened signature `runWave3(payload, null, wave0Result, creatorContext, cb)`. Stub-style tests still pass under the widened signature when DeepSeek client is mocked to throw (all 10 fail → empty results + null aggregate).

---

### `src/lib/engine/__tests__/wave3-persona-registry.test.ts` — allocation + lookup tests (NEW)

**Analog:** `src/lib/engine/__tests__/content-type-weights.test.ts` (Phase 4 — pure-function unit-test shape for a locked lookup table).

**Test surface (per RESEARCH validation table lines 1411, 1413, 1416):**
- PERSONA-02 + D-02: All 6 FYP behavioral archetypes are present in `ARCHETYPES` const (assert enum membership).
- PERSONA-03: `selectPersonaSlots` emits 2 niche-deep slots when row.niche_deep ≥ 2 (test all 7 content types).
- PERSONA-05: `cross_niche_curiosity` slot reads from `CROSS_NICHE_ADJACENCY` table — verify all 10 primary niches have an adjacency entry (no `?? "lifestyle"` fallback in production traffic).
- PERSONA-07 + D-10: All 7 content_type allocations sum to exactly 10 (`Object.values(ALLOCATION_TABLE).map(row => Object.values(row).reduce((a,b) => a+b, 0))` all === 10).
- D-11 fallback: `selectPersonaSlots(null, "beauty")` returns 10 slots from the `other` row (6/2/1/1).
- Niche-fallback: `selectPersonaSlots("slideshow", null)` returns 10 slots with "general TikTok" instantiation labels.
- Determinism: two identical calls produce byte-equal slot arrays (cache-stability substrate).

---

### `src/lib/engine/__tests__/wave3-persona-prompts.test.ts` — prompt builder + Zod tests (NEW)

**Analog:** `src/lib/engine/__tests__/wave0-niche-detector.test.ts` (Zod two-stage validation) + assertions on byte-identical string outputs.

**Test surface (per RESEARCH validation table lines 1413, 1417, 1428-1430):**
- PERSONA-04: Loyalist past_wins host extraction — non-null past_wins → host string surfaces; null past_wins → "loyal follower of [niche] creators generally" fallback (Pitfall 3).
- PERSONA-08 + D-17: Two calls to `buildPersonaSystemPrompt(slot)` with identical slot input produce identical strings (byte-for-byte). Mutate one field (e.g., change `time_of_day_label`) → output diverges. Asserts cache-prefix stability.
- D-19 schema: `PersonaResponseSchema.safeParse` rejects missing `reasoning` (Pitfall 5); rejects `watch_through_pct > 100`; accepts canonical sample.
- PROFILE-16: No raw URL bodies in `buildPersonaUserMessage` output — assert that `creatorContext.past_wins[0].url = "https://example.com/secret-path"` produces only `"example.com"` host in the prompt (mirror of `wave0-niche-detector.test.ts` PROFILE-16 assertion pattern).

---

### `src/lib/engine/__tests__/wave3-aggregator.test.ts` — pure-math tests (NEW)

**Analog:** `src/lib/engine/__tests__/content-type-weights.test.ts` (pure-fn unit-test shape; deterministic numeric assertions; floor/ceiling edge cases).

**Test surface (per RESEARCH validation table lines 1422-1425):**
- D-06 per-metric different rule:
  - `completion_pct` is flat mean (10 personas at [50, 60, 70, ...] → mean = expected).
  - `share_pct` with 3 personas at 90 + 7 at 10 → 0.6×90 + 0.4×10 = 58.0 (not the flat mean = 34.0).
- D-06 tie-break: 5 personas at share_intent=50 + 5 at 50 → top-3 picked by archetype enum order (deterministic across runs).
- D-13 threshold: 7 survivors → aggregate computed; 6 survivors → aggregate null + warning string.
- D-13 0-survivor edge: empty input → aggregate null + warning.
- Pitfall 4 (`n < TOP_N + 1`): defensive `remaining.length === 0` returns topMean directly (not topMean × 0.60).

---

### `src/lib/engine/__tests__/factories.ts` — test-double extension (in-place)

**Analog (in-place — same file):** The existing `makePipelineResult` factory at line 230+ already defaults `wave3Result: []`. Phase 7 extends with `personaBehavioralAggregate: null` (default null is the post-threshold-fail signal that matches Phase 4 D-08 pattern for nullable detector outputs).

**Existing factory shape (lines 230-271):**
```typescript
return {
  payload: makeContentPayload(),
  geminiResult: { /* ... */ },
  creatorContext: { /* ... */ },
  // ...
  // Phase 3 — Wave 0/3 stub outputs (Phase 4/7 fill with real logic)
  wave0Result: { content_type: null, niche: null },
  wave3Result: [],
  requestId: "test-req-123",
  // ...
};
```

**Phase 7 in-place addition:**
```typescript
// Phase 3 — Wave 0/3 stub outputs (Phase 4/7 fill with real logic)
wave0Result: { content_type: null, niche: null },
wave3Result: [],
// NEW Phase 7 (Pitfall 9, A11) — default null preserves "no aggregate" semantics
// for all existing aggregator.test.ts and pipeline.test.ts callers.
personaBehavioralAggregate: null,
```

---

## Shared Patterns

### DeepSeek client + circuit breaker
**Source:** `src/lib/engine/deepseek.ts:243-273` (`getClient()` + `isCircuitOpen()` — module-level OpenAI client with HARD-04 probe mutex).
**Apply to:** `src/lib/engine/wave3.ts` (10-call orchestrator).
```typescript
let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY environment variable");
    client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
  }
  return client;
}
```
**Phase 7 note:** `isCircuitOpen` is currently a private function in `deepseek.ts:256-273`. RESEARCH Pattern 1 (line 311) expects to import it. Planner must either (a) export `isCircuitOpen` from `deepseek.ts`, or (b) thread the breaker check through a new helper. Option (a) is the smaller surface change — additive export, no signature changes elsewhere.

### Cache-aware cost telemetry (DeepSeek V4 Flash pricing)
**Source:** `src/lib/engine/wave0/niche-detector.ts:89-102` (Phase 4 pattern — `usage.prompt_cache_hit_tokens` / `prompt_cache_miss_tokens` with `GAP-04-02` fallback to `prompt_tokens × CACHE_MISS_PRICE`).
**Apply to:** every per-persona call inside `runWave3`.
```typescript
const CACHE_HIT_PRICE = 0.0028 / 1_000_000;
const CACHE_MISS_PRICE = 0.14 / 1_000_000;
const OUTPUT_PRICE = 0.28 / 1_000_000;

const usage = response.usage as unknown as {
  prompt_tokens?: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
  completion_tokens?: number;
} | undefined;
const cacheHit = usage?.prompt_cache_hit_tokens ?? 0;
const cacheMiss = usage?.prompt_cache_miss_tokens ?? 0;
const completion = usage?.completion_tokens ?? 0;
const hasCacheBreakdown = cacheHit > 0 || cacheMiss > 0;
const inputCost = hasCacheBreakdown
  ? cacheHit * CACHE_HIT_PRICE + cacheMiss * CACHE_MISS_PRICE
  : (usage?.prompt_tokens ?? 0) * CACHE_MISS_PRICE;
costCents = (inputCost + completion * OUTPUT_PRICE) * 100;
```
**Phase 7 note:** V4 Flash pricing verified 2026-05-18 (RESEARCH A1). Re-verify at execution time per RESEARCH "Valid until" line 1529. The OUTPUT_PRICE value here (0.28/M) supersedes the RESEARCH Pattern 1 placeholder (0.42/M) and matches verified `wave0/niche-detector.ts:23` constant.

### Stage event emission (start + end pair, per-stage Sentry tag)
**Source:** `src/lib/engine/wave0/niche-detector.ts:54, 180-184, 190-194` (per-detector event ownership — `emitStageStart` at top of try, `emitStageEnd` in both success + catch branches with `cost_cents` field).
**Apply to:** every per-persona call AND the Wave-level orchestrator.

```typescript
const startTs = emitStageStart(onEvent, "wave_0_niche_detector", 0);
try {
  // ... DeepSeek call ...
  emitStageEnd(onEvent, "wave_0_niche_detector", 0, startTs, {
    cost_cents: +costCents.toFixed(4),
    ok: true,
    warning: result.warning,
  });
  return result;
} catch (error) {
  Sentry.captureException(error, { tags: { stage: "wave_0_niche_detector" } });
  emitStageEnd(onEvent, "wave_0_niche_detector", 0, startTs, {
    cost_cents: +costCents.toFixed(4),
    ok: false,
    warning: message,
  });
  return null;
}
```
**Phase 7 note:** Per-persona stage names use `wave_3_persona_${slot.archetype}_${slot.slot_type}` (RESEARCH Pattern 1 line 372) so the 10 calls are distinguishable in the event stream. Wave-level stage name stays `wave_3_personas` (matches the Phase 3 stub contract — RESEARCH line 80, `stubs.test.ts:78`).

### Zod two-stage validation (LLM-output boundary)
**Source:** `src/lib/engine/wave0/niche-detector.ts:104-128` (Phase 4 — `JSON.parse` → `Schema.safeParse` → throw on `success: false` → secondary slug-validation against canonical list).
**Apply to:** `PersonaResponseSchema` consumer inside `callPersona`.

```typescript
const text = response.choices[0]?.message?.content ?? "{}";
const raw = JSON.parse(text);
const validated = PersonaResponseSchema.safeParse(raw);
if (!validated.success) {
  throw new Error(`Persona response validation failed: ${validated.error.message}`);
}
```
**Phase 7 retry-once mechanic:** Inline `while (attempt <= 1)` loop (RESEARCH Pattern 1 lines 381-466) — retry only when `lastError.message.includes("validation failed")`; no retry on AbortError (RESEARCH Pattern 1 line 444 + Anti-Patterns line 1074).

### PROFILE-16 host-only URL sanitization
**Source:** `src/lib/engine/wave0/prompts.ts:110-116` (`tryUrlHost` helper) + Phase 2 D-19 + `creator.ts:339-348` (past_wins URL hosts only).
**Apply to:** `buildPersonaUserMessage` loyalist branch.
```typescript
function tryUrlHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

// In builder:
if (slot.slot_type === "loyalist" && creatorContext.past_wins?.length) {
  const hosts = creatorContext.past_wins
    .map((w) => tryUrlHost(w.url))
    .filter(Boolean)
    .join(", ");
  if (hosts) sections.push(`You have engaged before with content hosted at: ${hosts}.`);
}
```
**Phase 7 note:** Verified at RESEARCH A5 (line 1327) + Security Domain (line 1471). Defense in depth against prompt injection via URL bodies.

### Cache-prefix discipline (system prompt = stable; user message = volatile)
**Source:** `src/lib/engine/wave0/prompts.ts:5-46` (Phase 3 D-12 + Phase 4 Pitfall 2/3 — module-level `NICHE_SYSTEM_PROMPT` const; per-request `buildNicheUserMessage` function).
**Apply to:** `buildPersonaSystemPrompt` (function — but pure, deterministic, byte-stable per `{archetype × niche × time-of-day}` input).

**Phase 7 critical adaptation (Pitfall 1 — RESEARCH lines 1106-1114):**
- Per-niche instantiation text MUST live in the system prompt.
- Per-call volatile content (caption, hashtags, deepseek synthesis, content type echo) lives in the user message.
- Verified by unit test asserting two calls with identical slot input produce identical system-prompt strings.

### `createLogger({ module: "..." })` per file
**Source:** `src/lib/engine/wave0.ts:10`, `wave0/niche-detector.ts:12`, `wave0/prompts.ts` (no logger — pure module).
**Apply to:**
- `src/lib/engine/wave3.ts` → `createLogger({ module: "wave3" })`.
- `src/lib/engine/wave3/persona-registry.ts` → `createLogger({ module: "wave3.persona-registry" })` (only if any error-path logging needed; primary file is pure data, may omit).
- `src/lib/engine/wave3/persona-prompts.ts` → no logger (pure builder; mirror of `wave0/prompts.ts` shape).
- `src/lib/engine/wave3/aggregator.ts` → `createLogger({ module: "wave3.aggregator" })` for threshold-failure warnings.

### Vitest mocking discipline (env-vars-before-import, mocked OpenAI client)
**Source:** `src/lib/engine/__tests__/wave0-niche-detector.test.ts:10-30` (canonical pattern — `vi.mock("@/lib/logger")`, `vi.mock("@sentry/nextjs")`, `vi.mock("openai", ...)` with `mockCreate` constant, `process.env.DEEPSEEK_API_KEY = "test-key"` BEFORE the `import { detectNiche } from "..."`).
**Apply to:** `wave3.test.ts` and `wave3-persona-prompts.test.ts` (anything that imports modules that touch `process.env.DEEPSEEK_API_KEY` at module load).

```typescript
const mockCreate = vi.fn();
vi.mock("openai", () => {
  const MockOpenAI = vi.fn(function (this: Record<string, unknown>) {
    this.chat = { completions: { create: mockCreate } };
  });
  return { default: MockOpenAI };
});

process.env.DEEPSEEK_API_KEY = "test-key";

import { runWave3 } from "../wave3";  // import AFTER env + mocks
```

---

## No Analog Found

(None — every Phase 7 file has a direct in-repo analog. Phase 4 introduced the `wave0/` subfolder + Promise.allSettled + DeepSeek V4 Flash + Zod two-stage validation + per-stage cache telemetry + locked content-type matrix; Phase 7's `wave3/` subfolder mirrors all five concepts identically. This is the closest pattern continuity in the entire milestone — the planner should reference Phase 4 as "the template" throughout.)

---

## Cross-Cutting Adaptations (not in any single file)

These are pattern-level adaptations the planner should apply consistently across multiple files:

1. **`Wave3Outcome` return type widening** — `runWave3` no longer returns `PersonaSimulationResult[]`. It returns `{ aggregate, results, warnings }` (RESEARCH lines 339-343). The Phase 3 stub's return shape is preserved at the `wave3Result: PersonaSimulationResult[]` field on `PipelineResult`; the new `aggregate` and `warnings` are surfaced through additive fields and the existing pipeline `warnings` array.

2. **Env-var pattern: `DEEPSEEK_PERSONA_MODEL`** (RESEARCH lines 91, 318-319). Mirrors Phase 4 D-03 `DEEPSEEK_NICHE_MODEL` pattern — separate env from `DEEPSEEK_MODEL` (which routes to thinking-mode via `deepseek-reasoner` alias). Default `"deepseek-v4-flash"` (non-thinking, cheap, parallel-friendly).

3. **`isCircuitOpen` export from `deepseek.ts`** (currently private, RESEARCH Pattern 1 line 311) — planner must add a one-line export so Wave 3 can fast-fail when the breaker is open without firing 10 wasted calls.

4. **PipelineResult forwarding** — `pipeline.ts:40-59` widens with `personaBehavioralAggregate`; ALL callers of `aggregateScores(pipelineResult, ...)` (route.ts, eval-runner.ts, pipeline.test.ts factories) need a default `personaBehavioralAggregate: null` for backwards-compat. The `factories.ts:230` extension handles tests; route.ts gets the field from the pipeline return.

5. **JSDoc CONTEXT-D-XX trail** — every Phase 4 module has comments like `// Per CONTEXT D-16: detectors emit their OWN stage_start/stage_end` (`wave0.ts:14-20`). Phase 7 mirrors with `// Per CONTEXT D-13: ≥7-of-10 success threshold`, `// Per CONTEXT D-06: top-3-enthusiast-weighted`, etc. — the planner should include these JSDoc trails in every new file.

---

## Metadata

**Analog search scope:** `src/lib/engine/wave0/`, `src/lib/engine/wave3.ts`, `src/lib/engine/pipeline.ts`, `src/lib/engine/aggregator.ts`, `src/lib/engine/types.ts`, `src/lib/engine/deepseek.ts`, `src/lib/engine/__tests__/`, `src/lib/engine/corpus/eval-runner.ts`, `src/lib/engine/corpus/eval-harness.ts`, `src/lib/niches/taxonomy.ts`.

**Files scanned:** 18 (10 source + 8 tests).

**Pattern extraction date:** 2026-05-18.

**Confidence:** HIGH — every target file has a direct, working analog in the same repo. The Phase 4 `wave0/` subfolder is the template for Phase 7's `wave3/` subfolder; the Phase 4 `D-08`/`D-20` additive-widening pattern in `types.ts` + `aggregator.ts` is the template for Phase 7's `D-15`/`D-19`/`D-20` additive widening. No external pattern research required.

## PATTERN MAPPING COMPLETE
