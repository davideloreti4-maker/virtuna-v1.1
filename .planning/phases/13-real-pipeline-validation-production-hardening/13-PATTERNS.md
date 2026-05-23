# Phase 13: Real Pipeline Validation + Production Hardening — Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 26 (create + modify + delete + artifact)
**Analogs found:** 25 / 26 (1 — `validations/video-NN.md` — no precise codebase analog, ad-hoc per-video diff doc; structure ide­ntified from RESEARCH §13-RESEARCH.md "Specifics")

> Most of Phase 13 is *removal/verification*, not new construction. The pattern map favours: (a) reuse `gemini/segmented.ts` upload+poll pattern verbatim for shared `fileUri`, (b) reuse `stage11-counterfactuals*` skeleton for the rebuild with SDK swap DeepSeek → Gemini, (c) reuse `scripts/smoke-test-gemini-audio.ts` shape for `engine-self-test.ts`, (d) reuse `09-VALIDATION.md` / `10-VALIDATION.md` shape for the cross-phase review doc.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/engine-self-test.ts` (NEW) | script (live-API audit) | request-response | `scripts/smoke-test-gemini-audio.ts` | exact |
| `src/lib/engine/stage11-counterfactuals.ts` (REBUILD) | service (always-on stage) | request-response | `src/lib/engine/wave0/content-type-detector.ts` (Gemini call shape) + itself (event emission + outer skeleton) | exact |
| `src/lib/engine/stage11-counterfactuals-prompts.ts` (REBUILD) | utility (prompt + schema) | transform | itself (current file — stable prefix + volatile user message + Zod schema pattern) | exact |
| `src/lib/engine/gemini.ts` (MODIFY: D-09, D-10, D-19) | service | request-response | itself | exact |
| `src/lib/engine/gemini/cost.ts` (MODIFY: D-09 add bare aliases) | utility (cost calc) | transform | itself | exact |
| `src/lib/engine/gemini/segmented.ts` (MODIFY: D-19 287MB, D-18 fileUri thread) | service | request-response | itself | exact |
| `src/lib/engine/wave0/content-type-detector.ts` (MODIFY: D-17 fold niche schema, D-18 receive fileUri) | service | request-response | itself + `src/lib/engine/wave0/niche-detector.ts` (schema fields to fold in) | exact |
| `src/lib/engine/wave0/niche-detector.ts` (DELETE after D-17) | service | request-response | n/a (deletion) | n/a |
| `src/lib/engine/wave0.ts` (MODIFY: D-17 — drop detectNiche call, read folded fields) | orchestrator | request-response | itself | exact |
| `src/lib/engine/aggregator.ts` (MODIFY: D-16 SCORE_WEIGHTS, D-06 wire counterfactuals to result) | service (weighted aggregate) | transform | itself (existing SCORE_WEIGHTS pattern at lines 53-62) | exact |
| `src/lib/engine/pipeline.ts` (MODIFY: D-18 lift upload to entry, thread fileUri) | orchestrator | event-driven | itself (existing video-download block at lines 410-441) + `gemini/segmented.ts:97-141` upload pattern | exact |
| `src/lib/engine/version.ts` (FLIP: D-27 `3.0.0-dev` → `3.0.0`) | config (constant) | transform | itself (1-line constant) | exact |
| `src/lib/engine/cache/prediction-cache.ts` (VERIFY ONLY: D-23) | service (cache layer) | request-response | itself — already correct per RESEARCH Example 2 | exact (read-only verify) |
| `src/lib/engine/deepseek.ts` (DEFERRED MODIFY: D-22 hang kill-path — only if manifests) | service | request-response | itself (existing AbortController + setTimeout at lines 530-553) | exact |
| `src/components/app/simulation/results-panel.tsx` (MODIFY: D-06 — rewire to `result.counterfactuals.suggestions`) | component | request-response | itself (existing line 207 `<SuggestionsSection suggestions={result.suggestions} />`) | exact |
| `src/components/app/simulation/insights-section.tsx` (REBUILD per UI-SPEC + D-05 band) | component | request-response | itself (existing `SuggestionsSection`) | exact (replace body) |
| `src/components/app/simulation/signal-availability-chips.tsx` (MODIFY: D-30 three-state) | component | request-response | itself | exact |
| `src/app/api/analyze/route.ts` (VERIFY: D-23 cache lookup uses `ENGINE_VERSION`; D-19 — ensure size cap matches new 287MB) | controller (API route) | request-response | itself + `cache/prediction-cache.ts:73-82` (cache key already uses `ENGINE_VERSION`) | exact (read-only verify + small validation tweak) |
| `src/lib/engine/__tests__/stage11-counterfactuals.test.ts` (REWRITE: D-05 schema, D-04 always-on, D-02 Gemini mock not DeepSeek) | test (unit) | request-response | itself (current file as skeleton — mock structure) + `src/lib/engine/wave0/__tests__/content-type-detector.test.ts` (Gemini mock shape) | exact |
| `src/lib/engine/__tests__/factories.ts` (EXTEND: add `makeCounterfactualResult(band, ...)`) | test factory | transform | itself (existing `makeGeminiAnalysis`, etc.) | exact |
| `src/components/app/simulation/__tests__/insights-section.test.tsx` (NEW) | test (RTL component) | request-response | `src/components/app/simulation/__tests__/` existing component tests (RTL pattern) | role-match |
| `src/components/app/simulation/__tests__/signal-availability-chips.test.tsx` (NEW) | test (RTL component) | request-response | same as above | role-match |
| `src/lib/engine/cache/__tests__/prediction-cache.test.ts` (EXTEND: D-23 version-invalidation test case) | test (unit) | request-response | itself | exact |
| `.planning/phases/13-.../13-AUDIT-CAPTION-LESS.md` (NEW artifact, D-13) | doc artifact | n/a | `.planning/phases/09-platform-algo-fit-self-critique-counterfactuals/09-VALIDATION.md` (table-of-stages shape) | role-match |
| `.planning/phases/13-.../13-CODE-REVIEW-PHASES-9-12.md` (NEW artifact, SC#5) | doc artifact | n/a | `.planning/phases/12-accuracy-benchmark-acceptance-gate/12-HANDOFF.md` (per-plan ✅/❌ status sections) | role-match |
| `.planning/phases/13-.../validations/video-NN.md` (NEW artifact ×10, D-25) | doc artifact | n/a | none — ad-hoc per-video diff doc; structure per `13-RESEARCH.md` §Specifics | no-analog |

---

## Pattern Assignments

### `scripts/engine-self-test.ts` (NEW — script, live-API audit)

**Analog:** `scripts/smoke-test-gemini-audio.ts`

**Imports + env-load pattern** (analog lines 25-31):
```typescript
import { config } from "dotenv";
import { resolve } from "path";
import { GoogleGenAI } from "@google/genai";

// Load env (Next.js convention — same as scripts/import-apify-data.ts)
config({ path: resolve(__dirname, "../.env.local") });
```

**Model slot probe pattern** — adapt from `wave0/content-type-detector.ts:147-169` (the generateContent call shape), iterate over an inline array of `{ name, envVar, defaultModel }`. Reference scaffolding from `13-RESEARCH.md` Pattern 1:
```typescript
const SLOTS = [
  { name: "wave0",   model: process.env.GEMINI_WAVE0_MODEL    ?? "gemini-3.1-flash-lite" },
  { name: "hook",    model: process.env.GEMINI_HOOK_MODEL     ?? "gemini-3.1-pro" },
  { name: "body",    model: process.env.GEMINI_BODY_MODEL     ?? "gemini-3-flash" },
  { name: "cta",     model: process.env.GEMINI_CTA_MODEL      ?? "gemini-3-flash" },
  { name: "stage11", model: process.env.GEMINI_STAGE11_MODEL  ?? "gemini-3.1-pro" },
];

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

for (const slot of SLOTS) {
  const response = await ai.models.generateContent({
    model: slot.model,
    contents: [{ role: "user", parts: [{ text: 'Return JSON {"ok":true}' }] }],
    config: { responseMimeType: "application/json" },
  });
  const reportedModel = (response as any).modelVersion ?? (response as any).model;
  const match = reportedModel?.startsWith(slot.model);
  console.log(`${slot.name}: requested=${slot.model} reported=${reportedModel} match=${match}`);
  if (!match) process.exit(1);
}
```

**Exit code / fail-loud pattern** (analog `e2e-uat-phase6.ts:124-128`):
```typescript
if (pass < 3) {
  console.error(`[uat] FAIL — only ${pass}/${Object.keys(gates).length} gates passed`);
  process.exit(2);
}
console.log(`[uat] PASS — Phase 6 audio pipeline end-to-end validated.`);
```

**Run command convention:** `./node_modules/.bin/tsx scripts/engine-self-test.ts` (matches `e2e-uat-phase6.ts:17`).

**Assumption-locking (per A3):** On first run, log the full `response` object structure once so the assertion path (`modelVersion` vs `model` vs `usageMetadata.modelVersion`) gets pinned from observed output.

---

### `src/lib/engine/stage11-counterfactuals.ts` (REBUILD — always-on, Gemini-backed)

**Analog (outer skeleton + event emission):** itself (current file `stage11-counterfactuals.ts`).
**Analog (Gemini call shape):** `src/lib/engine/wave0/content-type-detector.ts:144-172`.

**Imports pattern** (swap DeepSeek for Gemini — adapt content-type-detector.ts:1-8):
```typescript
import * as Sentry from "@sentry/nextjs";
import { GoogleGenAI, Type } from "@google/genai";
import { createLogger } from "@/lib/logger";
import type { PredictionResult, CounterfactualResult } from "./types";
import type { StageEventCallback } from "./events";
import { emitStageStart, emitStageEnd } from "./events";
import {
  STABLE_COUNTERFACTUALS_SYSTEM_PROMPT,
  buildSignalContextUserMessage,
  CounterfactualsResponseSchema,
} from "./stage11-counterfactuals-prompts";
```

**Model + client + timeout constants** (drop DeepSeek client, adopt Gemini):
```typescript
const GEMINI_STAGE11_MODEL = process.env.GEMINI_STAGE11_MODEL ?? "gemini-3.1-pro";
const PER_CALL_TIMEOUT_MS = 30_000; // Stage 11 is heavier than the 15s DeepSeek call

let _ai: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!_ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY environment variable");
    _ai = new GoogleGenAI({ apiKey });
  }
  return _ai;
}
```

**Core call pattern with shared `fileUri` + AbortController + retry-once** (adapt content-type-detector.ts:144-172 + current stage11-counterfactuals.ts:88-103 retry loop):
```typescript
export async function runStage11Counterfactuals(
  aggregateResult: PredictionResult,
  videoContext: { fileUri: string; mimeType: string } | null, // D-01: Wave 1 fileUri reuse
  onEvent?: StageEventCallback,
): Promise<CounterfactualResult | null> {
  const start = emitStageStart(onEvent, "stage_11_counterfactuals", "post");
  // D-04: NO score >= 70 short-circuit. Always runs.
  let costCents = 0;
  const ai = getClient();
  let attempt = 0;

  while (attempt <= 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);
    try {
      const userMessage = buildSignalContextUserMessage(aggregateResult);
      const parts: Array<unknown> = [{ text: userMessage }];
      if (videoContext) parts.push({ fileData: { fileUri: videoContext.fileUri, mimeType: videoContext.mimeType } });

      const response = await ai.models.generateContent({
        model: GEMINI_STAGE11_MODEL,
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction: STABLE_COUNTERFACTUALS_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          abortSignal: controller.signal,
        },
      });
      clearTimeout(timer);
      // ... cost calc via gemini/cost.ts calculateCost(GEMINI_STAGE11_MODEL, response.usageMetadata) ...
      const parsed = CounterfactualsResponseSchema.safeParse(JSON.parse(response.text ?? "{}"));
      if (!parsed.success) {
        if (attempt === 0) { attempt++; continue; }
        throw new Error(`validation failed: ${parsed.error.message}`);
      }
      emitStageEnd(onEvent, "stage_11_counterfactuals", "post", start, {
        cost_cents: +costCents.toFixed(4), ok: true,
      });
      return { suggestions: parsed.data.suggestions, band: parsed.data.band };
    } catch (err) {
      clearTimeout(timer);
      if (attempt >= 1) {
        Sentry.captureException(err, { tags: { stage: "stage_11_counterfactuals" } });
        emitStageEnd(onEvent, "stage_11_counterfactuals", "post", start, {
          cost_cents: +costCents.toFixed(4), ok: false,
          warning: err instanceof Error ? err.message : String(err),
        });
        return null;
      }
      attempt++;
    }
  }
  return null;
}
```

**Cost calculation pattern** (use shared helper from `gemini/cost.ts:55-71`):
```typescript
import { calculateCost as calculateGeminiCost } from "./gemini/cost";
// ...
costCents += calculateGeminiCost(GEMINI_STAGE11_MODEL, response.usageMetadata);
```

**Keep `maybeAppendLikelyFlopWarning`** verbatim (current stage11-counterfactuals.ts:39-51) — pure-TS check, no model dependency.

**Remove:** `isCircuitOpen()` import + check (current line 7 + 75-82) — Stage 11 no longer hits DeepSeek; circuit breaker is DeepSeek-scoped.

---

### `src/lib/engine/stage11-counterfactuals-prompts.ts` (REBUILD — discriminated union schema + full signal context)

**Analog:** itself (current file — stable system prompt + volatile user message + Zod schema split).

**Stable system prompt pattern** (current lines 22-38 — preserve byte-stable shape for Gemini context caching when supported; replace prompt text with band-adaptive instructions per `13-RESEARCH.md` Pattern 3):
```typescript
export const STABLE_COUNTERFACTUALS_SYSTEM_PROMPT = `You are a counterfactual reasoning assistant for a TikTok content analytics engine.

You receive: (1) the video itself via fileData, (2) every signal the engine extracted, (3) the engine's overall score.

Your job depends on the score band:
- band=low (<50): Return exactly 3 fixes. Each must reference a specific signal that's failing.
- band=mid (50-70): Return 2 fixes + 1 reinforcement of the strongest signal.
- band=high (>=70): Return 1 stretch optimization + 2-3 reinforcements tied to specific signals.

Each item must include:
- type: "fix" | "stretch" | "reinforcement"
- headline: ≤80 char single-line summary
- detail: 1-3 sentence explanation
- timestamp_ms: number — video timestamp anchor when applicable, 0 otherwise
- signal_anchor: which signal grounds this (e.g. "gemini.scroll_stop_power", "persona_dissent", "audio.silence_ratio")

Ground every claim in the data. Do not invent.`;
```

**User-message builder pattern** (current lines 51-76 — REPLACE truncation `result.reasoning.slice(0, 500)` with full reasoning per D-03; add all signal sections from `13-RESEARCH.md` Pattern 3):
```typescript
export function buildSignalContextUserMessage(result: PredictionResult): string {
  const band: "low" | "mid" | "high" =
    result.overall_score < 50 ? "low" : result.overall_score < 70 ? "mid" : "high";
  return `## Score
overall: ${result.overall_score}
confidence: ${result.confidence}
band: ${band}

## Gemini Factor Scores
${result.factors.map(f => `- ${f.name}: ${f.score}/10 — ${f.rationale}`).join("\n")}

## Hook Decomposition (when available)
${JSON.stringify(result.hook_decomposition ?? null, null, 2)}

## Audio Signals
${JSON.stringify(result.audio_signals ?? null, null, 2)}

## Trend Matches
${result.matched_trends?.map(t => `- ${t.sound_id} velocity=${t.velocity_score}`).join("\n") ?? "(none)"}

## Persona Dissent (Wave 3)
${result.persona_simulation_results?.map(p => `- ${p.persona_id}: verdict=${p.verdict} dissent=${p.dissent ?? false}`).join("\n") ?? "(none)"}

## Platform Fit (Wave 4)
${JSON.stringify(result.platform_fit ?? null, null, 2)}

## DeepSeek Reasoning (full, untruncated — D-03)
${result.reasoning ?? "(none)"}

## Engine's Earlier Suggestions (internal context — do NOT pass through)
${(result.suggestions ?? []).map(s => `- [${s.priority}] ${s.text}`).join("\n")}

## Instructions
Return JSON matching the schema for band="${band}".`;
}
```

**Zod discriminated-union pattern** (REPLACE current `.length(3)` schema at lines 82-92 with band-adaptive shape per D-05):
```typescript
const SuggestionItemSchema = z.object({
  type: z.enum(["fix", "stretch", "reinforcement"]),
  headline: z.string().min(1).max(80),
  detail: z.string().min(1),
  timestamp_ms: z.number().min(0),
  signal_anchor: z.string().min(1),
});

const LowBandSchema = z.object({
  band: z.literal("low"),
  suggestions: z.array(SuggestionItemSchema.extend({ type: z.literal("fix") })).length(3),
});
const MidBandSchema = z.object({
  band: z.literal("mid"),
  suggestions: z.array(SuggestionItemSchema).length(3)
    .refine(arr => arr.filter(s => s.type === "fix").length === 2, "must have 2 fixes")
    .refine(arr => arr.filter(s => s.type === "reinforcement").length === 1, "must have 1 reinforcement"),
});
const HighBandSchema = z.object({
  band: z.literal("high"),
  suggestions: z.array(SuggestionItemSchema).min(3).max(4)
    .refine(arr => arr.filter(s => s.type === "stretch").length === 1, "must have 1 stretch")
    .refine(arr => arr.filter(s => s.type === "reinforcement").length >= 2, "must have >=2 reinforcements"),
});

export const CounterfactualsResponseSchema = z.discriminatedUnion("band", [
  LowBandSchema, MidBandSchema, HighBandSchema,
]);
```

---

### `src/lib/engine/gemini.ts` (MODIFY: D-09 + D-10 + D-19)

**Analog:** itself.

**D-09 drop `-preview` defaults** (current lines 34-36):
```typescript
// BEFORE:
export const GEMINI_HOOK_MODEL = process.env.GEMINI_HOOK_MODEL ?? "gemini-3.1-pro-preview";
export const GEMINI_BODY_MODEL = process.env.GEMINI_BODY_MODEL ?? "gemini-3-flash-preview";
export const GEMINI_CTA_MODEL  = process.env.GEMINI_CTA_MODEL  ?? "gemini-3-flash-preview";

// AFTER (only after self-test confirms bare IDs callable — Pitfall 2 / A1):
export const GEMINI_HOOK_MODEL = process.env.GEMINI_HOOK_MODEL ?? "gemini-3.1-pro";
export const GEMINI_BODY_MODEL = process.env.GEMINI_BODY_MODEL ?? "gemini-3-flash";
export const GEMINI_CTA_MODEL  = process.env.GEMINI_CTA_MODEL  ?? "gemini-3-flash";
```

**D-10 silent-fallback fix** (current line 28 + lines 181-189) — remove the `GEMINI_MODEL=gemini-2.5-flash` pin from `calculateCost` shim that masks telemetry; require per-model billing at every call site:
```typescript
// BEFORE (line 28):
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

// BEFORE (lines 181-189): shim pins GEMINI_MODEL pricing for legacy callers
function calculateCost(promptTokens, candidateTokens): number {
  return calculateCostPerModel(GEMINI_MODEL, { promptTokenCount: promptTokens, candidatesTokenCount: candidateTokens });
}

// AFTER: legacy `calculateCost` callers (line ~357, line ~497 — text + video paths)
// pass the actual model they used. The default at line 572 also reads response.modelVersion
// for telemetry parity with the self-test.
```

**D-19 lift cap to 287MB** (current line 40):
```typescript
// BEFORE:
const VIDEO_MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
// AFTER:
const VIDEO_MAX_SIZE_BYTES = 287 * 1024 * 1024; // 287MB — TikTok max known per D-19
// Error message at line 506-508 must update from "50MB / ~3 minutes" to "287MB".
```

---

### `src/lib/engine/gemini/cost.ts` (MODIFY: D-09 add bare-ID aliases)

**Analog:** itself (current PRICING table lines 21-27).

**Pattern — keep `-preview` keys for backwards-compat, ADD bare aliases at same rates** (RESEARCH Example 4):
```typescript
const PRICING: Record<string, { input: number; output: number }> = {
  // Bare IDs (D-09 — new defaults after self-test verifies)
  "gemini-3.1-pro":          { input: 2.00 / 1_000_000,  output: 12.00 / 1_000_000 },
  "gemini-3-flash":          { input: 0.50 / 1_000_000,  output:  3.00 / 1_000_000 },
  // -preview aliases (kept for backwards-compat — DO NOT delete)
  "gemini-3.1-pro-preview":  { input: 2.00 / 1_000_000,  output: 12.00 / 1_000_000 },
  "gemini-3-pro-preview":    { input: 2.00 / 1_000_000,  output: 12.00 / 1_000_000 },
  "gemini-3-flash-preview":  { input: 0.50 / 1_000_000,  output:  3.00 / 1_000_000 },
  "gemini-3.1-flash-lite":   { input: 0.25 / 1_000_000,  output:  1.50 / 1_000_000 },
  "gemini-2.5-flash":        { input: 0.15 / 1_000_000,  output:  0.60 / 1_000_000 },
};
```

---

### `src/lib/engine/gemini/segmented.ts` (MODIFY: D-19 + D-18 receive shared fileUri)

**Analog:** itself.

**D-19 cap update** (current line 43): same constant flip as `gemini.ts:40`.

**D-18 fileUri-injection pattern** — refactor `analyzeVideoSegmented` to accept an optional pre-uploaded `videoContext` (matches Claude's Discretion Option A from `13-RESEARCH.md` Pattern 2):
```typescript
export interface SegmentedAnalysisOptions extends SegmentedPromptOptions {
  onStageEvent?: StageEventCallback;
  durationSeconds: number;
  // NEW (D-18): when present, skip upload + poll. Lifecycle owned by pipeline.ts.
  videoContext?: { fileUri: string; mimeType: string };
}

export async function analyzeVideoSegmented(
  videoBuffer: Buffer,
  mimeType: string,
  opts: SegmentedAnalysisOptions,
): Promise<MergedSegmentedResult> {
  // ... size-cap check stays ...
  let fileUri: string;
  let uploadedFileName: string | undefined;
  if (opts.videoContext) {
    fileUri = opts.videoContext.fileUri;
    // DO NOT delete in finally — caller (pipeline.ts) owns lifecycle
  } else {
    // Legacy path: own upload + poll + cleanup (current lines 97-141 verbatim)
  }
  // ... fan-out hook/body/cta segments use fileUri ...
  try { /* fan-out */ } finally {
    if (uploadedFileName) {
      try { await ai.files.delete({ name: uploadedFileName }); } catch {}
    }
  }
}
```

---

### `src/lib/engine/wave0/content-type-detector.ts` (MODIFY: D-17 fold niche schema + D-18 receive fileUri)

**Analog (own structure):** itself.
**Analog (niche fields to fold in):** `src/lib/engine/wave0/niche-detector.ts` schema + `Wave0NicheResultSchema` (types.ts).

**D-17 schema extension pattern** — extend `RESPONSE_SCHEMA` (current lines 26-42) to return content_type + niche in one call:
```typescript
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    type: { type: Type.STRING, enum: [/* talking_head, b_roll, ... */] },
    confidence: { type: Type.NUMBER },
    mixed: { type: Type.BOOLEAN },
    dominant_seconds: { type: Type.NUMBER },
    secondary_type: { type: Type.STRING, enum: [/* ... */] },
    // NEW (D-17):
    niche_primary_slug: { type: Type.STRING },     // matches NICHE_TREE.slug
    niche_micro_slug: { type: Type.STRING, nullable: true },
    niche_confidence: { type: Type.NUMBER },
  },
  required: ["type", "confidence", "mixed", "niche_primary_slug", "niche_confidence"],
};
```

**D-18 receive fileUri pattern** — split detector into upload (legacy fallback) vs reuse paths, matching segmented.ts approach:
```typescript
export async function detectContentType(
  payload: ContentPayload,
  supabase: SupabaseClient,
  videoContext?: { fileUri: string; mimeType: string }, // NEW (D-18)
  onEvent?: StageEventCallback,
): Promise<Wave0ContentTypeResult | null> {
  // ... when videoContext supplied: skip upload+poll, use fileUri directly in fileData
}
```

**Return-shape extension** — return `Wave0ContentTypeResult` now embeds niche fields; types.ts must extend `Wave0ContentTypeResultSchema`. Aggregator + wave0.ts orchestrator read niche fields off the same payload.

---

### `src/lib/engine/wave0/niche-detector.ts` (DELETE after D-17 fold verified)

**Analog:** n/a (deletion).

**Sequencing per Pitfall 10:**
1. Extend `content-type-detector.ts` schema (D-17 fold).
2. Migrate `wave0.ts` orchestrator to read niche fields from extended `Wave0ContentTypeResult` payload.
3. Run full test suite green.
4. THEN delete `niche-detector.ts` + corresponding `__tests__/niche-detector.test.ts` + `wave0/prompts.ts` niche prompt block.

---

### `src/lib/engine/wave0.ts` (MODIFY: D-17 — drop detectNiche call)

**Analog:** itself (current `Promise.allSettled` orchestrator at lines 28-63).

**Before** (current lines 34-37):
```typescript
const [contentTypeOutcome, nicheOutcome] = await Promise.allSettled([
  detectContentType(payload, supabase, onEvent),
  detectNiche(payload, creatorContext, onEvent),
]);
```

**After** (D-17 — single call returns both):
```typescript
const contentTypeOutcome = await detectContentType(payload, supabase, videoContext, onEvent)
  .catch(reason => {
    Sentry.captureException(reason, { tags: { stage: "wave_0_content_type", source: "orchestrator" } });
    return null;
  });

return {
  content_type: contentTypeOutcome
    ? { type: contentTypeOutcome.type, confidence: contentTypeOutcome.confidence, warning: contentTypeOutcome.warning }
    : null,
  niche: contentTypeOutcome && contentTypeOutcome.niche_primary_slug
    ? {
        primary_slug: contentTypeOutcome.niche_primary_slug,
        micro_slug: contentTypeOutcome.niche_micro_slug ?? null,
        confidence: contentTypeOutcome.niche_confidence,
      }
    : null,
};
```

(`Wave0Result` type stays stable — only its provenance changes.)

---

### `src/lib/engine/aggregator.ts` (MODIFY: D-16 weights, D-06 wire counterfactuals)

**Analog:** itself (existing `SCORE_WEIGHTS` at lines 53-62 + Stage 11 call at lines 1066-1067).

**D-16 weight update pattern** (replace current values; keep `SCORE_WEIGHT_KEYS` tuple intact so `selectWeights` redistribution still works):
```typescript
export const SCORE_WEIGHTS = {
  behavioral:   0.40, // up from 0.35 — primary CoT, video-aware via Wave 2 input
  gemini:       0.35, // up from 0.25 — now drives Stage 11 too; video understanding is core
  audio:        0.10, // up from 0.07 — real audio signal, more important in primary flow
  trends:       0.10, // unchanged — audio-fingerprint based, video-derived
  platform_fit: 0.05, // unchanged
  ml:           0,    // disabled — Phase 10 (unchanged)
  retrieval:    0,    // D-15: disabled this phase — caption-derived embedding sparse
  rules:        0,    // D-14: disabled this phase — all 17 rules caption-pattern-based
} as const;
// Sum = 1.00 — verify in aggregator.test.ts.
```

**D-06 wire-up** — current invocation at lines 1066-1067 needs to pass `videoContext` and (per D-04) accept always-non-null result:
```typescript
// BEFORE (line 1066):
const counterfactualResult = await runStage11Counterfactuals(result, onStageEvent);

// AFTER:
const counterfactualResult = await runStage11Counterfactuals(result, videoContext, onStageEvent);
// videoContext threaded down from pipeline.ts via aggregateScores's input
```

(`PipelineResult` likely needs a `videoContext?: { fileUri: string; mimeType: string }` field so `aggregateScores` can pass it through. Check `pipeline.ts` `PipelineResult` interface at lines 52-80.)

---

### `src/lib/engine/pipeline.ts` (MODIFY: D-18 — lift upload to pipeline entry)

**Analog:** itself (existing video download at lines 427-441) + `gemini/segmented.ts:97-141` (upload + poll-to-ACTIVE pattern).

**D-18 lift pattern** — move upload out of `geminiPromise` block, do it once at pipeline entry, thread through:
```typescript
// At pipeline.ts ~line 420 (BEFORE the geminiPromise IIFE):
let videoContext: { fileUri: string; mimeType: string } | null = null;
let uploadedFileName: string | undefined;
const ai = getGeminiClient(); // export from gemini.ts

if (validated.input_mode === "video_upload" && validated.video_storage_path) {
  const { data: videoBlob, error } = await supabase.storage.from("videos").download(validated.video_storage_path);
  if (error || !videoBlob) throw new Error(`Video download failed: ${error?.message ?? "no data"}`);
  const buffer = Buffer.from(await videoBlob.arrayBuffer());
  if (buffer.byteLength > VIDEO_MAX_SIZE_BYTES) throw new Error("Video exceeds maximum size (287MB).");

  const ext = validated.video_storage_path.split(".").pop()?.toLowerCase() ?? "mp4";
  const mimeType = EXT_TO_MIME[ext] ?? "video/mp4";
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });

  const uploadResult = await ai.files.upload({ file: blob, config: { mimeType } });
  uploadedFileName = uploadResult.name;
  // poll-to-ACTIVE (reuse gemini/segmented.ts:117-141 verbatim)
  let fileState = uploadResult.state;
  let fileUri = uploadResult.uri;
  const pollStart = Date.now();
  while (fileState === "PROCESSING") {
    if (Date.now() - pollStart > VIDEO_POLL_TIMEOUT_MS) throw new Error("Upload timeout");
    await new Promise(r => setTimeout(r, VIDEO_POLL_INTERVAL_MS));
    const info = await ai.files.get({ name: uploadedFileName });
    fileState = info.state; fileUri = info.uri;
  }
  if (fileState !== "ACTIVE" || !fileUri) throw new Error(`Unexpected state ${fileState}`);
  videoContext = { fileUri, mimeType };
}

try {
  // ... run stages with videoContext passed through ...
  // wave0: runWave0(payload, supabase, creatorContext, videoContext, onStageEvent)
  // gemini-segmented: analyzeVideoSegmented(buffer, mimeType, { ..., videoContext })
  // — but note D-18 also says reuse buffer download is gone too;
  //   segmented now skips upload when videoContext present
} finally {
  if (uploadedFileName) {
    try { await ai.files.delete({ name: uploadedFileName }); } catch {}
  }
}
```

(Required: pipeline returns a `videoContext` field on `PipelineResult` so aggregator's Stage 11 can use it.)

---

### `src/lib/engine/version.ts` (FLIP — D-27)

**Analog:** itself (1-line constant file).

**Current state** (lines 1-7):
```typescript
/**
 * Engine version — single source of truth.
 * Phase 12's acceptance gate flips "3.0.0-dev" → "3.0.0" with a one-line edit here.
 * Per CONTEXT.md D-05 + D-06; see RESEARCH Pitfall 8 for circular-import avoidance.
 */
export const ENGINE_VERSION = "3.0.0-dev";
```

**Post-gate (after 10 videos pass + user sign-off — D-27 + D-28):**
```typescript
export const ENGINE_VERSION = "3.0.0";
```

Also update the comment to reference Phase 13 D-27 (it currently references Phase 12 D-05/D-06).

---

### `src/lib/engine/cache/prediction-cache.ts` (VERIFY ONLY — D-23)

**Analog:** itself.

**Verification target** — lines 20-22 (cache key includes `ENGINE_VERSION`) + lines 73-82 (L2 query filters `.eq("engine_version", ENGINE_VERSION)`).

**Current state (already correct per RESEARCH Example 2):**
```typescript
export function cacheKey(contentHash: string, userId: string): string {
  return `${contentHash}::${ENGINE_VERSION}::${userId}`;
}

// L2 lookup at lines 73-82:
const { data, error } = await supabase
  .from("analysis_results")
  .select("*")
  .eq("user_id", userId)
  .eq("content_hash", contentHash)
  .eq("engine_version", ENGINE_VERSION)  // ← auto-invalidates on flip
  .gt("created_at", cutoff)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();
```

**Plan task** — read-only annotation: add a JSDoc note on `cacheKey` referencing Phase 13 D-23, and add a regression test case to `prediction-cache.test.ts` that flips `ENGINE_VERSION` and asserts a previously-cached entry is no longer returned.

---

### `src/lib/engine/deepseek.ts` (DEFERRED — D-22, only if hang manifests)

**Analog:** itself (existing AbortController + setTimeout at lines 530-553).

**Existing in-process timeout pattern** (current lines 530-553):
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
// ...
const response = await ai.chat.completions.create(
  { model: DEEPSEEK_MODEL, messages: [...], response_format: { type: "json_object" } },
  { signal: controller.signal }
);
clearTimeout(timeout);
```

**D-22 wall-clock kill-path pattern** — only add when hang first fires during E2E (per `13-RESEARCH.md` Pattern 4):
```typescript
const WALL_CLOCK_MS = 120_000;
const result = await Promise.race([
  ai.chat.completions.create({ /* ... */ }, { signal: controller.signal }),
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("DeepSeek wall-clock timeout exceeded")), WALL_CLOCK_MS)
  ),
]);
```

Focus call site: `reasonWithDeepSeek` at line 514 (the 30-60s `deepseek-reasoner` Wave 2 call).

---

### `src/components/app/simulation/results-panel.tsx` (MODIFY: D-06 rewire)

**Analog:** itself (current line 207).

**Current state** (line 207):
```typescript
<SuggestionsSection suggestions={result.suggestions} />
```

**After D-06:**
```typescript
{result.counterfactuals && (
  <SuggestionsSection
    suggestions={result.counterfactuals.suggestions}
    band={result.counterfactuals.band}  // adaptive header per D-05
  />
)}
```

`result.suggestions` becomes internal-only (D-06, Pitfall 4) — no consumer reads it anymore.

---

### `src/components/app/simulation/insights-section.tsx` (REBUILD per UI-SPEC + D-05)

**Analog:** itself (current `SuggestionsSection` at lines 35-75 — keep the GlassSection / Badge / Caption / Text styling DNA; replace data model + badge mapping).

**Current effort-tag mapping** (lines 18-27):
```typescript
function getEffortTag(priority: Suggestion['priority']) {
  switch (priority) {
    case 'high':   return { label: 'Quick Win', variant: 'success' as const };
    case 'medium': return { label: 'Medium',    variant: 'warning' as const };
    case 'low':    return { label: 'Major',     variant: 'default' as const };
  }
}
```

**After (D-05 type → badge mapping)** — drives off `SuggestionItem.type`, not priority:
```typescript
function getTypeBadge(type: 'fix' | 'stretch' | 'reinforcement') {
  switch (type) {
    case 'fix':           return { label: 'Fix',           variant: 'warning' as const };
    case 'stretch':       return { label: 'Stretch',       variant: 'default' as const };
    case 'reinforcement': return { label: "What's working", variant: 'success' as const };
  }
}
```

**Band-adaptive header** (D-05):
```typescript
const HEADER_BY_BAND = {
  low:  "What to change",
  mid:  "Improvements + what's working",
  high: "What's working + to push higher",
} as const;
```

**Props shape:**
```typescript
interface SuggestionsSectionProps {
  suggestions: CounterfactualSuggestion[];      // from result.counterfactuals.suggestions
  band: 'low' | 'mid' | 'high';
}
```

(Existing GlassSection + Badge + Caption + Text + leading-relaxed + border-b styling preserved per project Raycast design language — see `CLAUDE.md` "Raycast Design Language Rules".)

---

### `src/components/app/simulation/signal-availability-chips.tsx` (MODIFY: D-30 three-state)

**Analog:** itself.

**Current two-state pattern** (lines 34-46):
```typescript
{CHIP_SIGNALS.map(({ key, label }) => {
  const available = (signalAvailability[key] as boolean | undefined) ?? false;
  return (
    <Badge variant={available ? 'success' : 'default'} size="sm"
           className={available ? '' : 'line-through opacity-40'}>
      {label} {available ? '✓' : '✕'}
    </Badge>
  );
})}
```

**After (D-30 three-state — ✓ available / ✕ intentionally-disabled / ⚠ failed-this-video):**
```typescript
type ChipState = 'available' | 'disabled' | 'failed';
const STATE_STYLES: Record<ChipState, { variant: 'success' | 'default' | 'warning'; symbol: string; className: string }> = {
  available: { variant: 'success', symbol: '✓', className: '' },
  disabled:  { variant: 'default', symbol: '✕', className: 'line-through opacity-40' },
  failed:    { variant: 'warning', symbol: '⚠', className: '' },
};

function deriveState(key: keyof SignalAvailability, availability: SignalAvailability): ChipState {
  // Intentional disables (M1 design): ml, rules, retrieval per D-14/D-15/Phase 10 D-05
  if (key === 'ml' || (DISABLED_THIS_PHASE.has(key))) return 'disabled';
  return availability[key] ? 'available' : 'failed';
}
```

(Exact set membership of `DISABLED_THIS_PHASE` finalised in plan — depends on signal_availability schema extension; see `aggregator.ts` `signal_availability` population at the result return site.)

---

### `src/app/api/analyze/route.ts` (VERIFY: D-23 cache key + D-19 size cap)

**Analog:** itself.

**D-23 verification** — current import + call site already correct (lines 9-13, 192-194 area):
```typescript
import {
  computeContentHash,
  lookupPredictionCache,
  populatePredictionCache,
} from "@/lib/engine/cache/prediction-cache";
```

`lookupPredictionCache(contentHash, userId)` calls `cacheKey()` → composes `ENGINE_VERSION` automatically. No change required; add a comment annotation linking to Phase 13 D-23 invariant.

**D-19 size-cap pre-validation** — current video_storage_path validation at lines 114-126 only checks path string. The 287MB cap is enforced inside `gemini.ts:505` AFTER the buffer is loaded. Consider adding a `content-length` header check upstream to fail fast for >287MB requests. Plan task — Claude's Discretion (RESEARCH Open Question 2 — Vercel function memory).

---

### `src/lib/engine/__tests__/stage11-counterfactuals.test.ts` (REWRITE — D-05 schema + D-04 always-on + Gemini mock)

**Analog (test skeleton):** itself (current file — Vitest + vi.hoisted mock + factory helpers).
**Analog (Gemini mock pattern):** `src/lib/engine/wave0/__tests__/content-type-detector.test.ts` (if exists; alternatively `src/lib/engine/__tests__/gemini.test.ts`).

**Mock swap** — current file mocks `openai` (lines 38-48). Replace with `@google/genai` mock:
```typescript
const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

vi.mock("@google/genai", () => {
  const MockGenAI = vi.fn(function (this: Record<string, unknown>) {
    this.models = { generateContent: mockGenerateContent };
  });
  return { GoogleGenAI: MockGenAI, Type: { OBJECT: "OBJECT", STRING: "STRING", NUMBER: "NUMBER" } };
});

// Remove the `vi.mock("../deepseek", ...)` block — no longer used.
process.env.GEMINI_API_KEY = "test-key";
```

**Per-band fixture factories** (replace current `makeValidCounterfactualsResponse` 3-suggestion shape):
```typescript
function makeLowBandResponse(): string {
  return JSON.stringify({
    band: "low",
    suggestions: [
      { type: "fix", headline: "...", detail: "...", timestamp_ms: 3000, signal_anchor: "gemini.scroll_stop_power" },
      { type: "fix", /* ... */ },
      { type: "fix", /* ... */ },
    ],
  });
}
function makeMidBandResponse(): string { /* 2 fix + 1 reinforcement */ }
function makeHighBandResponse(): string { /* 1 stretch + 2-3 reinforcement */ }

function mockGeminiSuccess(jsonText: string): void {
  mockGenerateContent.mockResolvedValueOnce({
    text: jsonText,
    usageMetadata: { promptTokenCount: 4000, candidatesTokenCount: 600 },
    modelVersion: "gemini-3.1-pro",
  });
}
```

**Test cases to add (D-04 + D-05):**
- "always runs even when overall_score >= 70" (D-04) — score 80, expect non-null result with `band="high"`
- "low band returns 3 fix items"
- "mid band returns 2 fix + 1 reinforcement"
- "high band returns 1 stretch + 2-3 reinforcements"
- "schema validation rejects mid band with wrong type mix"
- "fileUri is included in generateContent parts when videoContext provided"
- "no fileData part when videoContext null (graceful degraded mode)"
- Keep all 4 `maybeAppendLikelyFlopWarning` boundary tests verbatim (no logic change).

---

### `src/lib/engine/__tests__/factories.ts` (EXTEND — add band-adaptive factory)

**Analog:** itself (existing `makeGeminiAnalysis`, `makeDeepSeekReasoning`, etc.).

**New factory pattern** — mirror existing `makeGeminiAnalysis` shape (lines 22-50):
```typescript
import type { CounterfactualResult, CounterfactualSuggestionItem } from "../types";

export function makeCounterfactualResult(
  band: "low" | "mid" | "high" = "low",
  overrides?: Partial<CounterfactualResult>,
): CounterfactualResult {
  const baseItem = (type: CounterfactualSuggestionItem["type"], headline: string): CounterfactualSuggestionItem => ({
    type, headline, detail: `Detail for ${headline}`, timestamp_ms: 0, signal_anchor: "gemini.scroll_stop_power",
  });
  const suggestions =
    band === "low"  ? [baseItem("fix","Fix hook"), baseItem("fix","Fix pacing"), baseItem("fix","Fix CTA")] :
    band === "mid"  ? [baseItem("fix","Fix hook"), baseItem("fix","Fix pacing"), baseItem("reinforcement","Keep tone")] :
                      [baseItem("stretch","Push harder"), baseItem("reinforcement","Audio strong"), baseItem("reinforcement","Pacing strong")];
  return { band, suggestions, ...overrides };
}
```

---

### `src/components/app/simulation/__tests__/insights-section.test.tsx` (NEW — RTL)

**Analog:** existing component test in `src/components/app/simulation/__tests__/` (Vitest + Testing Library pattern).

**Imports pattern (RTL standard):**
```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SuggestionsSection } from "../insights-section";
import { makeCounterfactualResult } from "@/lib/engine/__tests__/factories";
```

**Test cases (per D-05 + D-06):**
- "renders 3 fix items with type badges when band=low"
- "renders adaptive header text per band"
- "returns null when suggestions array empty"
- "uses 'Fix' / 'Stretch' / 'What's working' badge labels"
- "shows timestamp anchor when timestamp_ms > 0"

---

### `src/components/app/simulation/__tests__/signal-availability-chips.test.tsx` (NEW — D-30 three-state)

**Analog:** same as above.

**Test cases:**
- "renders ✓ for available signal"
- "renders ✕ with line-through for intentionally-disabled signal (ml, rules, retrieval)"
- "renders ⚠ for failed-this-video signal (e.g. audio when upload error)"
- "applies success/default/warning Badge variants per state"

---

### `src/lib/engine/cache/__tests__/prediction-cache.test.ts` (EXTEND — D-23 version-invalidation case)

**Analog:** itself.

**New test case pattern:**
```typescript
import { ENGINE_VERSION } from "@/lib/engine/version";

it("invalidates cache when ENGINE_VERSION differs from stored row (D-23)", async () => {
  // Seed analysis_results with engine_version="3.0.0-dev"
  await supabase.from("analysis_results").insert({
    content_hash: "abc", user_id: "u1", engine_version: "3.0.0-dev", /* ... */
  });
  // ENGINE_VERSION at import-time = "3.0.0" (post-flip simulation via vi.doMock)
  vi.doMock("@/lib/engine/version", () => ({ ENGINE_VERSION: "3.0.0" }));
  const result = await lookupPredictionCache("abc", "u1");
  expect(result).toBeNull();
});
```

---

### `.planning/phases/13-.../13-AUDIT-CAPTION-LESS.md` (NEW artifact — D-13)

**Analog:** `.planning/phases/09-platform-algo-fit-self-critique-counterfactuals/09-VALIDATION.md` — same per-row table shape (Task ID / File / Behavior / Test type / Status). Adapt to per-stage instead of per-task.

**Stage-table shape** (per `13-CONTEXT.md` §Specifics + RESEARCH Pitfall 5 confirmed sites):

```markdown
# Phase 13 — Caption-Less Engine Audit (D-13)

**Audited:** <date>
**Gates:** Stage 11 rebuild + signal-weight changes (Plans 2-3)

| Stage | Entry file:line | Reads content_text/caption? | Behavior on empty caption | Verdict | Fix scope |
|-------|-----------------|----------------------------|----------------------------|---------|-----------|
| Wave 0 niche detector | `wave0/niche-detector.ts:62` | YES | DeepSeek classifies empty string → unpredictable | DISABLE (D-17 folds into Gemini) | — |
| Wave 0 content-type | `wave0/content-type-detector.ts:120` | NO (video-only) | Works on video bytes | ACCEPT | — |
| Wave 1 segmented | `gemini/segmented.ts` | NO | Works on video bytes | ACCEPT | — |
| Wave 2 DeepSeek reasoning | `deepseek.ts:467` (`${context.input.content_text}` in user msg) | YES | Empty section in prompt | DOCUMENT (graceful, model handles empty) | 0 |
| Wave 2 Gemini text fallback | `gemini.ts:235` | YES | Empty text prompt | DOCUMENT | 0 |
| Rules scoring | `pipeline.ts:596` → `rules.ts:138-171` | YES | All 17 regex rules return false | DISABLE (D-14 weight=0) | — |
| Retrieval embedder | `retrieval/embedder.ts:127-137` | YES | Sparse query embedding | DISABLE (D-15 weight=0) | — |
| Trends hashtag extraction | `trends.ts:45,101` | YES | No hashtags found → no trend boost | ACCEPT (audio-fingerprint primary path) | 0 |
| Wave 3 personas | `wave3/persona-prompts.ts:83` | YES | Empty caption in prompt | DOCUMENT | 0 |
| Wave 4 platform fit | `wave4/platform-fit-prompts.ts:133` (`Caption: ${payload.content_text \|\| "(no caption)"}`) | YES (with fallback string) | "(no caption)" injected — graceful | ACCEPT | 0 |
| Stage 10 critique | `stage10-critique-prompts.ts` | (verify) | (verify) | (verify) | — |
| Stage 11 counterfactuals | `stage11-counterfactuals-prompts.ts:51-76` (CURRENT) | YES | Empty section | REBUILD (D-01..D-05) | full rewrite |
| Cache key | `prediction-cache.ts:31-44` | text mode only | Hashes empty string in text-mode (degenerate cache key) | ACCEPT (video_upload hashes buffer) | 0 |
```

**Section structure** (per phase-9 + 10 VALIDATION shape):
- Section 1: Stage table (above)
- Section 2: Per-mode contract verification (per D-12 video_upload / tiktok_url / text-only)
- Section 3: tiktok_url flow verification (per D-31 — does it download video bytes or fall back to metadata-only?)
- Section 4: Test-update scope (per D-24 — which existing tests will need rewrite)
- Section 5: Sign-off — verdict per stage, blocking issues for Plan 2

---

### `.planning/phases/13-.../13-CODE-REVIEW-PHASES-9-12.md` (NEW artifact — SC#5)

**Analog:** `.planning/phases/12-accuracy-benchmark-acceptance-gate/12-HANDOFF.md` — per-plan `✅` / `❌` / `⚠️` status sections; matches forward-looking cross-phase review.

**Section structure:**
```markdown
# Phase 13 — Cross-Phase Code Review (Phases 9-12)

**Reviewed:** <date>
**Scope:** Wave wiring correctness, signal fallback paths, silent degradations across phases 9, 10, 11, 12.

## Phase 9 — Platform-Algo-Fit + Self-Critique + Counterfactuals

### ✅ <area passing review>
<finding + file:line>

### ⚠️ <area with concern>
<finding + file:line + recommended action>

### ❌ <area with bug>
<finding + file:line + reproduce steps + fix plan>

## Phase 10 — ML Audit + Calibration + Aggregator Extension
<same shape>

## Phase 11 — Existing UI Integration + Privacy Policy
<same shape>

## Phase 12 — Accuracy Benchmark (superseded)
<archival note per D-29; focus only on remnants kept (--max-rows flag, platt_parameters)>

## Bug Triage
| Finding | File:line | Severity | Action | Plan |
|---------|-----------|----------|--------|------|
```

(Per RESEARCH Plan 04 sequencing — runs IN PARALLEL with Plan 2/3 as read-only.)

---

### `.planning/phases/13-.../validations/video-NN.md` (NEW artifact ×10 — D-25)

**Analog:** none in codebase. Structure from `13-RESEARCH.md` §Specifics:

```markdown
# Video <NN> Validation — <short-descriptor>

**Date:** <date>
**TikTok URL:** <source>
**Input mode:** video_upload | tiktok_url
**Engine version (binary tag):** <git-sha>

## Section 1 — Prediction
- overall_score:
- confidence:
- band:
- signal_availability: <chip states>
- Stage 11 suggestions: <list per type>

## Section 2 — Actuals (from WebFetch / user paste)
- views:
- likes:
- shares:
- comments:
- completion %:

## Section 3 — Diff Analysis
- Was the prediction directionally right? (over / under / on-target)
- Did Stage 11 suggestions match obvious issues? (yes / partial / no)
- User thumbs-up on relevance? (yes / no)

## Section 4 — Signal-by-signal Calibration
| Signal | Predicted contribution | Observed correlation | Notes |
|--------|------------------------|----------------------|-------|

## Verdict
PASS / FAIL — <reason>
```

(Binary version tag per RESEARCH Anti-Pattern: "Modifying engine code paths during the 10-video cadence" — restart count if engine logic changes mid-cadence.)

---

## Shared Patterns

### Pattern S1 — Gemini client singleton + lazy init

**Source:** `src/lib/engine/wave0/content-type-detector.ts:60-68` (also at `gemini.ts:49-50`, `gemini/segmented.ts` indirectly via `getClient` export).
**Apply to:** `stage11-counterfactuals.ts` (post-rebuild), `scripts/engine-self-test.ts`.

```typescript
let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY environment variable");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}
```

### Pattern S2 — AbortController + setTimeout + clearTimeout (per-call timeout)

**Source:** `src/lib/engine/wave0/content-type-detector.ts:144-172` + `gemini.ts:566-590` + `deepseek.ts:530-553`.
**Apply to:** `stage11-counterfactuals.ts` post-rebuild (current implementation already uses this — keep verbatim with new TIMEOUT_MS).

```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
let response;
try {
  response = await ai.models.generateContent({
    /* ... */
    config: { /* ..., */ abortSignal: controller.signal },
  });
} finally {
  clearTimeout(timeout);
}
```

### Pattern S3 — Files API upload + poll-to-ACTIVE + outer finally cleanup

**Source:** `src/lib/engine/gemini/segmented.ts:97-141` (canonical) — also at `gemini.ts:511-558`, `wave0/content-type-detector.ts:118-142`.
**Apply to:** new pipeline.ts entry-point upload block (D-18).

```typescript
let uploadedFileName: string | undefined;
try {
  const blob = new Blob([new Uint8Array(videoBuffer)], { type: mimeType });
  const uploadResult = await ai.files.upload({ file: blob, config: { mimeType } });
  if (!uploadResult.name) throw new Error("Video upload failed: no file name returned from Gemini Files API");
  uploadedFileName = uploadResult.name;

  let fileState = uploadResult.state;
  let fileUri = uploadResult.uri;
  const pollStart = Date.now();
  while (fileState === "PROCESSING") {
    if (Date.now() - pollStart > VIDEO_POLL_TIMEOUT_MS) throw new Error("Upload timeout");
    await new Promise(r => setTimeout(r, VIDEO_POLL_INTERVAL_MS));
    const info = await ai.files.get({ name: uploadedFileName });
    fileState = info.state; fileUri = info.uri;
  }
  if (fileState !== "ACTIVE" || !fileUri) throw new Error(`Unexpected state ${fileState}`);

  // ... use fileUri ...
} finally {
  if (uploadedFileName) {
    try { await ai.files.delete({ name: uploadedFileName }); } catch {}
  }
}
```

### Pattern S4 — Stage event emission (emitStageStart / emitStageEnd)

**Source:** every stage in `src/lib/engine/` — canonical at `stage11-counterfactuals.ts:62-72` and `wave0/content-type-detector.ts:84-93`.
**Apply to:** rebuilt `stage11-counterfactuals.ts` (preserve emission), shared-fileUri pipeline.ts block (new stage event `gemini_video_upload` may be added — Claude's Discretion).

```typescript
const startTs = emitStageStart(onEvent, "<stage_name>", <wave_num | "post">);
try {
  // ... work ...
  emitStageEnd(onEvent, "<stage_name>", <wave_num | "post">, startTs, { cost_cents, ok: true });
} catch (err) {
  emitStageEnd(onEvent, "<stage_name>", <wave_num | "post">, startTs, { cost_cents, ok: false, warning: err.message });
}
```

### Pattern S5 — Zod boundary validation on LLM response

**Source:** `stage11-counterfactuals.ts:124` + `wave0/content-type-detector.ts:181-188` + `gemini.ts` schema usage.
**Apply to:** Stage 11 rebuild (discriminated-union version).

```typescript
const parsed = CounterfactualsResponseSchema.safeParse(JSON.parse(text));
if (!parsed.success) {
  // retry once then throw
  throw new Error(`validation failed: ${parsed.error.message}`);
}
return parsed.data;
```

### Pattern S6 — Stable system prompt + volatile user message (cache hit invariant)

**Source:** `stage11-counterfactuals-prompts.ts:22-38` + `deepseek.ts:54-90` + `wave0/prompts.ts` (NICHE_SYSTEM_PROMPT).
**Apply to:** Stage 11 rebuild — even though Gemini's automatic context caching has different rules than DeepSeek's, the split discipline keeps prompt engineering legible and ports the cache-friendly invariant if Gemini context caching is enabled later.

### Pattern S7 — Sentry tagging by stage on error

**Source:** `stage11-counterfactuals.ts:150` + `wave0/content-type-detector.ts` similar + `gemini.ts` similar.
**Apply to:** all rebuilt or new stages.

```typescript
Sentry.captureException(lastError, { tags: { stage: "stage_11_counterfactuals" } });
```

### Pattern S8 — Dotenv load + tsx run for scripts

**Source:** `scripts/smoke-test-gemini-audio.ts:25-31`, `scripts/e2e-uat-phase6.ts:19-27`.
**Apply to:** `scripts/engine-self-test.ts`.

```typescript
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env.local") });
```

Run: `./node_modules/.bin/tsx scripts/engine-self-test.ts` (or `pnpm tsx scripts/engine-self-test.ts`).

### Pattern S9 — vi.hoisted + vi.mock for SDK clients in tests

**Source:** `src/lib/engine/__tests__/stage11-counterfactuals.test.ts:33-48` (current openai mock).
**Apply to:** rewritten stage11 test (Gemini SDK mock).

```typescript
const { mockGenerateContent } = vi.hoisted(() => ({ mockGenerateContent: vi.fn() }));
vi.mock("@google/genai", () => {
  const MockGenAI = vi.fn(function (this: Record<string, unknown>) {
    this.models = { generateContent: mockGenerateContent };
    this.files = { upload: vi.fn(), get: vi.fn(), delete: vi.fn() };
  });
  return { GoogleGenAI: MockGenAI, Type: { OBJECT: "OBJECT", STRING: "STRING", NUMBER: "NUMBER", BOOLEAN: "BOOLEAN", ARRAY: "ARRAY" } };
});
```

### Pattern S10 — Raycast design language for new UI

**Source:** `CLAUDE.md` project rules (Raycast Design Language Rules, verified 2026-02-08).
**Apply to:** rebuilt `insights-section.tsx`, modified `signal-availability-chips.tsx`.

Constraints:
- 6% borders (`white/[0.06]`), 10% hover (`white/[0.1]`)
- Cards: `bg-transparent`, `border-radius: 12px`, inset shadow `rgba(255,255,255,0.05) 0 1px 0 0 inset`
- Inter font, antialiased, `letter-spacing: 0.2px`
- Use existing `<GlassSection>`, `<Badge>`, `<Caption>`, `<Text>` primitives from current `insights-section.tsx`

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.planning/phases/13-.../validations/video-NN.md` (×10) | doc artifact | n/a | No prior per-video validation diff doc exists in the codebase. Closest structural sibling is `.planning/phases/<n>/<n>-VALIDATION.md` (test matrix shape), but the per-video diff format is novel — structure pinned from `13-RESEARCH.md` §Specifics. Plan author fills in the template. |

---

## Metadata

**Analog search scope:** `src/lib/engine/`, `src/components/app/simulation/`, `src/components/viral-results/`, `src/app/api/`, `scripts/`, `.planning/phases/09*`, `.planning/phases/10*`, `.planning/phases/11*`, `.planning/phases/12*`.
**Files scanned:** ~40 source + ~14 planning artifacts (greps + targeted reads).
**Pattern extraction date:** 2026-05-22

**Key sequencing reminders for planner (lifted from RESEARCH §Architectural Notes):**
1. `engine-self-test.ts` (D-21) BLOCKS Stage 11 rebuild and `-preview` drop (Pitfall 2 / A1) — if bare IDs fail self-test, keep `-preview` and amend CONTEXT D-09.
2. `AUDIT-CAPTION-LESS.md` (D-13) BLOCKS signal-weight changes (D-14/D-15/D-16).
3. Wave 0 niche fold (D-17) order: extend schema → migrate orchestrator → tests green → DELETE `niche-detector.ts` (Pitfall 10).
4. D-18 fileUri thread changes the signature of `runWave0`, `detectContentType`, `analyzeVideoSegmented`, `runStage11Counterfactuals` — coordinate the migration in one plan (Plan 03) to avoid TS errors across waves.
5. `ENGINE_VERSION` flip (D-27) is the LAST commit on the milestone branch before merge; all 10 videos must pass first (D-25) + user sign-off (D-28).
6. Test rewrites (D-24) span both Plan 02 (Stage 11 schema changes) and Plan 03 (signal-weight test fixtures); plan a single "test sweep" task at the end of Plan 03 to gate `npm test` green before E2E starts.

## PATTERN MAPPING COMPLETE
