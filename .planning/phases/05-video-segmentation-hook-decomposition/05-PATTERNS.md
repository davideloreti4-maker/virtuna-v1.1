# Phase 5: Video Segmentation + Hook Decomposition - Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 11 new/extended files
**Analogs found:** 11 / 11 (100% coverage — Phase 5 is a textbook "the platform already has the primitive" refactor)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/engine/gemini/segmented.ts` (new) | orchestrator (service) | parallel-fanout + file-I/O | `src/lib/engine/wave0.ts` (parallel detector orchestrator) + `src/lib/engine/gemini.ts:425-541` (single Files API upload/poll/delete) | exact (compose both) |
| `src/lib/engine/gemini/hook-segment.ts` (new) | service (LLM call) | request-response (videoMetadata-scoped) | `src/lib/engine/wave0/content-type-detector.ts:99-229` | exact |
| `src/lib/engine/gemini/body-segment.ts` (new) | service (LLM call) | request-response (videoMetadata-scoped) | `src/lib/engine/wave0/content-type-detector.ts:99-229` | exact |
| `src/lib/engine/gemini/cta-segment.ts` (new) | service (LLM call) | request-response (videoMetadata-scoped) | `src/lib/engine/wave0/content-type-detector.ts:99-229` | exact |
| `src/lib/engine/gemini/schemas.ts` (new) | model (Zod + Gemini schemas) | data-shape | `src/lib/engine/types.ts:236-265` (FactorSchema, GeminiVideoSignalsSchema, GeminiVideoResponseSchema) + `src/lib/engine/wave0/content-type-detector.ts:26-42` (Gemini OpenAPI-3-subset literal) | exact |
| `src/lib/engine/gemini/prompts.ts` (new) | utility (prompt builders) | data-shape | `src/lib/engine/gemini.ts:200-248` (`buildVideoPrompt`) + `src/lib/engine/wave0/prompts.ts:17-97` (stable system / volatile user split) | exact (compose both) |
| `src/lib/engine/gemini/cost.ts` (new) | utility (per-model pricing) | transform | `src/lib/engine/gemini.ts:25-29, 142-149` (`calculateCost`) | role-match (needs extension to take `model` param) |
| `src/lib/engine/types.ts` (extended) | model (types + Zod) | data-shape (widening) | Phase 4's own widening at `src/lib/engine/types.ts:198-206` (SignalAvailability + content_type/niche keys) + `types.ts:236-265` (GeminiVideoResponseSchema) | exact (same file, same pattern) |
| `src/lib/engine/aggregator.ts` (extended) | service (scoring) | transform + branch | `src/lib/engine/aggregator.ts:311-349` (Phase 4 content-type weights branch + SignalAvailability assembly) | exact (same file, same pattern) |
| `src/lib/engine/pipeline.ts` (extended) | orchestrator (pipeline) | event-driven + parallel | `src/lib/engine/pipeline.ts:332-371` (Wave 1 Gemini call site) | exact (single call-site swap) |
| `src/lib/engine/__tests__/gemini-segmented.test.ts` (new) | test | mock-based | `src/lib/engine/__tests__/wave0-content-type.test.ts` | exact |

---

## Pattern Assignments

### `src/lib/engine/gemini/segmented.ts` (orchestrator, parallel-fanout + file-I/O)

**Analog:** `src/lib/engine/wave0.ts` (parallel orchestrator using `Promise.allSettled`) + `src/lib/engine/gemini.ts:415-541` (Files API upload + poll + outer `finally` delete).

**`Promise.allSettled` parallel orchestration pattern** (`src/lib/engine/wave0.ts` lines 28-63):

```typescript
export async function runWave0(
  payload: ContentPayload,
  supabase: SupabaseClient,
  creatorContext: CreatorContext,
  onEvent?: StageEventCallback,
): Promise<Wave0Result> {
  const [contentTypeOutcome, nicheOutcome] = await Promise.allSettled([
    detectContentType(payload, supabase, onEvent),
    detectNiche(payload, creatorContext, onEvent),
  ]);

  if (contentTypeOutcome.status === "rejected") {
    Sentry.captureException(contentTypeOutcome.reason, {
      tags: { stage: "wave_0_content_type", source: "orchestrator" },
    });
    log.warn("Content-type detector rejected", { reason: String(contentTypeOutcome.reason) });
  }
  // ... same for nicheOutcome ...

  return {
    content_type: contentTypeOutcome.status === "fulfilled" ? contentTypeOutcome.value : null,
    niche: nicheOutcome.status === "fulfilled" ? nicheOutcome.value : null,
  };
}
```

**Copy this exact shape for the 3-way fan-out**: `Promise.allSettled([runHookSegment(...), runBodySegment(...), runCtaSegment(...)])`, each outcome inspected for `status === "fulfilled"`, rejected outcomes captured to Sentry at the orchestrator boundary. The orchestrator does NOT emit its own `gemini_video_analysis` stage event (per CONTEXT D-14, the three per-segment events replace it).

**Single Files API upload + poll-to-ACTIVE pattern** (`src/lib/engine/gemini.ts` lines 425-463):

```typescript
const blob = new Blob([new Uint8Array(videoBuffer)], { type: mimeType });
const uploadResult = await ai.files.upload({
  file: blob,
  config: { mimeType },
});

if (!uploadResult.name) {
  throw new Error("Video upload failed: no file name returned from Gemini Files API");
}
uploadedFileName = uploadResult.name;

// Poll for file processing completion
const pollStart = Date.now();
let fileState = uploadResult.state;
let fileUri = uploadResult.uri;

while (fileState === "PROCESSING") {
  if (Date.now() - pollStart > VIDEO_POLL_TIMEOUT_MS) {
    throw new Error(`Video processing timed out after ${VIDEO_POLL_TIMEOUT_MS / 1000}s.`);
  }
  await new Promise((resolve) => setTimeout(resolve, VIDEO_POLL_INTERVAL_MS));

  const fileInfo = await ai.files.get({ name: uploadedFileName });
  fileState = fileInfo.state;
  fileUri = fileInfo.uri;
}

if (fileState === "FAILED") {
  throw new Error("Video processing failed in Gemini Files API. The file may be corrupt or in an unsupported format.");
}
if (!fileUri) {
  throw new Error("Video upload succeeded but no file URI was returned.");
}
```

**Reuse VERBATIM** — only the post-upload block changes (one `generateContent` → three parallel calls). Same constants: `VIDEO_MAX_SIZE_BYTES = 50 * 1024 * 1024`, `VIDEO_POLL_INTERVAL_MS = 500`, `VIDEO_POLL_TIMEOUT_MS = 60_000`.

**Files API delete in OUTER `finally` (Pitfall #1)** (`src/lib/engine/gemini.ts` lines 532-541):

```typescript
} finally {
  // Clean up: delete uploaded file (best-effort)
  if (uploadedFileName) {
    try {
      await ai.files.delete({ name: uploadedFileName });
    } catch {
      // Best-effort cleanup — don't throw if delete fails
    }
  }
}
```

**Critical**: this `finally` MUST sit at the orchestrator level around the `await Promise.allSettled([...])` — never inside the per-segment helpers. RESEARCH Pitfall #1 (lines 480-488): "Test that fails intermittently because two helpers happen to complete in the same microtask. Sentry breadcrumbs showing 404 on `gemini_body` immediately after `gemini_hook` succeeded."

**`getClient()` singleton pattern** (`src/lib/engine/gemini.ts` lines 81-88):

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

**Reuse from `gemini.ts` directly** (RESEARCH code example line 622: `// reuse gemini.ts:81 singleton`). Do not re-implement; either export `getClient` from `gemini.ts` or thread the `ai` instance from the orchestrator into the helpers (RESEARCH `runHookSegment` signature line 686 takes `ai: GoogleGenAI` as first param).

---

### `src/lib/engine/gemini/hook-segment.ts` / `body-segment.ts` / `cta-segment.ts` (service, request-response with videoMetadata)

**Analog:** `src/lib/engine/wave0/content-type-detector.ts` — the gold pattern. Phase 4 already proved single-upload + `videoMetadata: { startOffset: "0s", endOffset: "5s" }` works against Gemini 3 Flash preview.

**The `videoMetadata` per-segment scoping pattern** (`src/lib/engine/wave0/content-type-detector.ts` lines 146-168):

```typescript
let response;
try {
  response = await ai.models.generateContent({
    model: GEMINI_WAVE0_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: SYSTEM_PROMPT },
          {
            // CRITICAL: startOffset/endOffset are STRING durations per RESEARCH Anti-Pattern.
            fileData: { fileUri, mimeType },
            videoMetadata: { startOffset: "0s", endOffset: "5s" },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      abortSignal: controller.signal,
    },
  });
} finally {
  clearTimeout(timeout);
}
```

**Copy this shape three times**, one per segment. Window template:
- Hook: `{ startOffset: "0s", endOffset: "5s" }` (CONTEXT D-03)
- Body: `` { startOffset: "5s", endOffset: `${duration - 3}s` } `` (compute from video duration)
- CTA: `` { startOffset: `${duration - 3}s`, endOffset: `${duration}s` } ``

Pitfall #4 (RESEARCH line 510-518): always construct via `` `${seconds}s` `` template literal; never plain numbers, ISO 8601, or timecodes. Unit-test with a value > 9 (e.g. `"22s"`) to catch zero-padding bugs.

Pitfall #3 (RESEARCH line 500-508): `videoMetadata` MUST be a sibling key of `fileData` within the **same `parts[]` object**. Not at top-level config, not as a sibling of `parts[]`. The SDK type definitions tolerate misplacement; the API silently ignores out-of-place `videoMetadata` and analyzes the full video.

**Per-segment AbortController + timeout pattern** (`src/lib/engine/wave0/content-type-detector.ts` lines 143-145, 169-171):

```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

let response;
try {
  response = await ai.models.generateContent({ /* ... */ });
} finally {
  clearTimeout(timeout);
}
```

**Three controllers, not one** (RESEARCH Pitfall #5, line 520-528): "If one segment times out and aborts the shared controller, the other two are killed mid-flight even though they had budget." Each helper owns its own `AbortController` + `setTimeout` + `clearTimeout` in its own `finally`.

**Per-stage Sentry tag pattern** (`src/lib/engine/wave0/content-type-detector.ts` lines 210-219):

```typescript
} catch (error) {
  Sentry.captureException(error, { tags: { stage: "wave_0_content_type" } });
  const message = error instanceof Error ? error.message : String(error);
  log.warn("Content-type detection failed", { error: message });
  emitStageEnd(onEvent, "wave_0_content_type", 0, startTs, {
    cost_cents: +costCents.toFixed(4),
    ok: false,
    warning: message,
  });
  return null;
}
```

**Per-segment Sentry tags** (CONTEXT Claude's Discretion + AI-SPEC §4): `tags: { stage: "gemini_hook" }` / `"gemini_body"` / `"gemini_cta"`. Return shape MUST be a tagged settled result (RESEARCH line 691: `Promise<SegmentResult<HookSegmentResult>>` where `SegmentResult<T> = { ok: true; analysis: T; cost_cents: number; model: string } | { ok: false; error: unknown }`) — the orchestrator's `mergeSegments` reads this discriminator.

**Per-segment event emission pattern** (`src/lib/engine/wave0/content-type-detector.ts` line 83, 204-208):

```typescript
const startTs = emitStageStart(onEvent, "wave_0_content_type", 0);
// ... call ...
emitStageEnd(onEvent, "wave_0_content_type", 0, startTs, {
  cost_cents: +costCents.toFixed(4),
  ok: true,
  warning: result.warning,
});
```

Phase 5 emits **three pairs** under `wave: 1`: `gemini_hook` / `gemini_body` / `gemini_cta` (CONTEXT D-14, replacing today's single `gemini_video_analysis` event). The orchestrator does NOT emit its own pair.

**Zod-at-boundary parse pattern** (`src/lib/engine/wave0/content-type-detector.ts` lines 178-187):

```typescript
const rawText = response.text ?? "{}";
const raw = JSON.parse(rawText);
const validated = Wave0ContentTypeResultSchema.safeParse({
  type: raw.type,
  confidence: raw.confidence,
});
if (!validated.success) {
  throw new Error(`Content-type response validation failed: ${validated.error.message}`);
}
```

**Use `response.text ?? ""` (Pitfall #8, RESEARCH line 546-552)**: even with `responseMimeType: "application/json"` the field can be `undefined` (safety filter, refusal, max_output_tokens hit). Also reuse `stripFences` from `gemini.ts:91-94` (RESEARCH code example line 680 imports it: `import { stripFences } from "../gemini";`).

**Niche injection into prompt** — body and CTA prompts read `opts.niche` + `opts.contentType`; hook prompt also reads `opts.niche` so first-words scoring can be niche-aware (CONTEXT D-15). Use the Wave 0 niche detector's stable-system + volatile-user pattern (see `prompts.ts` analog below).

---

### `src/lib/engine/gemini/schemas.ts` (model, Zod + Gemini responseSchema literals)

**Analog:** `src/lib/engine/types.ts:236-265` (FactorSchema, GeminiVideoSignalsSchema, GeminiVideoResponseSchema) + `src/lib/engine/wave0/content-type-detector.ts:26-42` (Gemini OpenAPI-3-subset literal).

**Project Zod schema convention** (`src/lib/engine/types.ts` lines 236-265):

```typescript
export const FactorSchema = z.object({
  name: z.string(),
  score: z.number().min(0).max(10),
  rationale: z.string(),
  improvement_tip: z.string(),
});

export const GeminiVideoSignalsSchema = z.object({
  visual_production_quality: z.number().min(0).max(10),
  hook_visual_impact: z.number().min(0).max(10),
  pacing_score: z.number().min(0).max(10),
  transition_quality: z.number().min(0).max(10),
});

export const GeminiResponseSchema = z.object({
  factors: z.array(FactorSchema).length(5),
  overall_impression: z.string(),
  content_summary: z.string(),
  video_signals: GeminiVideoSignalsSchema.optional(),
});

export const GeminiVideoResponseSchema = GeminiResponseSchema.extend({
  video_signals: GeminiVideoSignalsSchema,
});

export type GeminiVideoAnalysis = z.infer<typeof GeminiVideoResponseSchema>;
```

**Conventions to mirror**: (1) `z.number().min(0).max(10)` for all score fields — Phase 5 should define a shared `const ScoreSchema = z.number().min(0).max(10)` at top of file (RESEARCH line 762); (2) `.length(5)` constraint on the factors array; (3) `z.infer<typeof X>` to derive the TypeScript type below the schema; (4) compose with `.extend({ ... })` for inheritance (RESEARCH `HookSegmentZodSchema` extends the same shape with `hook_decomposition`).

**Gemini responseSchema OpenAPI-3-subset literal** (`src/lib/engine/wave0/content-type-detector.ts` lines 26-42):

```typescript
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    type: {
      type: Type.STRING,
      enum: ["talking_head", "b_roll", "slideshow", "action", "tutorial", "vlog", "other"],
    },
    confidence: { type: Type.NUMBER },
    mixed: { type: Type.BOOLEAN },
    dominant_seconds: { type: Type.NUMBER },
    secondary_type: {
      type: Type.STRING,
      enum: ["talking_head", "b_roll", "slideshow", "action", "tutorial", "vlog", "other"],
    },
  },
  required: ["type", "confidence", "mixed"],
};
```

**Conventions to mirror**: (1) `Type.OBJECT` / `Type.STRING` / `Type.NUMBER` / `Type.BOOLEAN` / `Type.ARRAY` enum imported from `@google/genai`; (2) inline `enum: [...]` arrays for string enums; (3) explicit `required: [...]` array listing every non-optional key; (4) **hand-written** — do NOT use `zod-to-json-schema` (RESEARCH line 447: emits unsupported `$schema` / `additionalProperties` / `$ref` keywords that Gemini rejects with 400 INVALID_ARGUMENT).

**Critical**: schemas are hand-written **TWICE** — once as Zod (client-side validation + `.refine` for cross-field invariants), once as Gemini literal (server-side decoder constraint). Unit-test they stay in sync. **Add `propertyOrdering`** on CTA schema to bias the model toward emitting `cta_present` first (RESEARCH line 878-880).

**Cross-field invariant for CTA presence (Pitfall #7)** (RESEARCH lines 807-819):

```typescript
export const CtaSegmentZodSchema = z.object({
  cta_present: z.boolean(),
  strength: ScoreSchema.nullable(),
  type: z.enum(["follow", "comment", "link_in_bio", "watch_next", "engage_question", "other"]).nullable(),
  rationale: z.string().min(1).max(400),
}).refine(
  (v) => v.cta_present
    ? v.strength !== null && v.type !== null
    : v.strength === null && v.type === null,
  { message: "When cta_present=true, strength and type must be non-null; when false, both must be null." },
);
```

Discriminated union / `oneOf` is NOT supported by Gemini's responseSchema dialect (Pitfall #7, RESEARCH lines 538-544). Express presence-aware shape as `boolean` discriminator + `nullable: true` on dependent fields. Invariant lives only in Zod `.refine`, never in the Gemini schema literal.

---

### `src/lib/engine/gemini/prompts.ts` (utility, prompt builders)

**Analog:** `src/lib/engine/gemini.ts:200-248` (`buildVideoPrompt`) + `src/lib/engine/wave0/prompts.ts:1-97` (stable system + volatile user split, Phase 3 D-12 cacheable-prefix discipline).

**`buildVideoPrompt` calibration-aware structure** (`src/lib/engine/gemini.ts` lines 203-248):

```typescript
function buildVideoPrompt(
  calibration: CalibrationData,
  niche?: string
): string {
  const topDifferentiators = [...calibration.viral_vs_average.differentiators]
    .sort((a, b) => Math.abs(b.difference_pct) - Math.abs(a.difference_pct))
    .slice(0, 3);

  return `You are a TikTok video content analysis expert. Your job is to evaluate video content quality across 5 specific factors and 4 video production signals.

## The 5 Factors (evaluate based on visual AND audio content)

1. **Scroll-Stop Power**: ...
2. **Completion Pull**: ...
...

## Scoring Rules

- Score each factor and video signal 0.0-10.0 with one decimal precision (e.g. 7.3)
- Use ABSOLUTE scoring — universal quality standards, NOT niche-relative
- Most content should score 4-7; scores above 8 are exceptional
- For each factor provide: score + rationale (1-2 sentences WHY) + improvement_tip (actionable${niche ? ", niche-aware" : ""} suggestion)

## Calibration Data (from 7,321 analyzed TikTok videos)

- Viral share rate threshold (p90): ${calibration.primary_kpis.share_rate.viral_threshold}
- Viral weighted engagement score (p90): ${calibration.primary_kpis.weighted_engagement_score.percentiles.p90}
- Duration sweet spot: ${calibration.duration_analysis.sweet_spot_by_weighted_score.optimal_range_seconds[0]}-${calibration.duration_analysis.sweet_spot_by_weighted_score.optimal_range_seconds[1]} seconds
- Top viral differentiators:
${topDifferentiators.map((d) => `  - ${d.factor}: ${d.description}`).join("\n")}

## Important

Score content quality only. Do NOT apply algorithm weights or predict engagement metrics — that happens downstream.

Return JSON matching the schema exactly. The factors array must contain exactly 5 objects with names: "Scroll-Stop Power", "Completion Pull", "Rewatch Potential", "Share Trigger", "Emotional Charge". Include the video_signals object with all 4 fields.${niche ? `\n\nNiche: ${niche}` : ""}`;
}
```

**Conventions to mirror**: (1) markdown-headed sections (`## The 5 Factors`, `## Scoring Rules`, `## Calibration Data`, `## Important`); (2) calibration data inlined into the prompt (top-3 differentiators by `Math.abs(difference_pct)`); (3) **absolute scoring** not niche-relative; (4) optional niche string appended at end via template literal; (5) explicit "Return JSON matching the schema exactly" closer.

**Stable-prefix / volatile-suffix split** (`src/lib/engine/wave0/prompts.ts` lines 5-46):

```typescript
// =====================================================
// STABLE system prompt — byte-identical across calls (Phase 3 D-12 + Pitfall 2/3).
// NICHE_TREE inlining resolved at MODULE LOAD; still byte-identical per-request.
// Dynamic content (caption, hashtags, handle, Card data) goes EXCLUSIVELY
// in the user message — never in this prompt.
// =====================================================

const PRIMARY_SLUGS = NICHE_TREE.map((p) => p.slug).join(", ");

export const NICHE_SYSTEM_PROMPT = `You are a TikTok content niche classifier. ...`;

// =====================================================
// VOLATILE user message — per-request dynamic content.
// =====================================================

export function buildNicheUserMessage(payload: ContentPayload, ctx: CreatorContext): string {
  // ... assembles caption / hashtags / creator profile sections
}
```

**Apply to Phase 5 prompts**: each segment prompt has a stable rubric (system message + 5-factor descriptions + scoring rules + calibration constants resolved at module load) and a volatile suffix (niche, content_type, creator context per-request). Even though Phase 5 doesn't ship explicit context caching (Deferred Idea: Gemini context caching for hook prompt prefix), the same discipline makes future caching a one-flip change.

**Hook prompt unique additions** (RESEARCH §1b rubric + CONTEXT D-04, D-15):
- 4 sub-modality score descriptions + scoring rule: "If a modality is genuinely absent from the hook, score it at 0 and mention this in the rationale; do not name it as weakest_modality" (Anti-Pattern, RESEARCH line 452).
- `weakest_modality` enum constraint matching Zod enum.
- `cognitive_load` polarity note: **"higher = WORSE (more cognitive load = lower retention) — INVERTED vs every other 0-10 score in this system."** (RESEARCH line 451, Failure Mode at AI-SPEC §1b row 6).
- Niche-aware first-words guidance: "An opener that works for beauty differs from one that works for fitness."

**Anti-pattern: no few-shot examples in the hook prompt** (RESEARCH line 450): "inflates token cost ~30% on the most expensive segment, embeds labeler bias invisibly. Refine the rubric language instead."

---

### `src/lib/engine/gemini/cost.ts` (utility, per-model pricing)

**Analog:** `src/lib/engine/gemini.ts:25-29, 142-149` (`calculateCost`).

**Current single-model helper** (`src/lib/engine/gemini.ts` lines 25-29, 141-149):

```typescript
// Flash pricing (2025): input $0.15/1M tokens, output $0.60/1M tokens
const INPUT_PRICE_PER_TOKEN = 0.15 / 1_000_000;
const OUTPUT_PRICE_PER_TOKEN = 0.60 / 1_000_000;
const FALLBACK_INPUT_TOKENS = 2000;
const FALLBACK_OUTPUT_TOKENS = 800;

/** Calculate cost in cents from token usage metadata */
function calculateCost(
  promptTokens: number | undefined,
  candidateTokens: number | undefined
): number {
  const input = promptTokens ?? FALLBACK_INPUT_TOKENS;
  const output = candidateTokens ?? FALLBACK_OUTPUT_TOKENS;
  return (input * INPUT_PRICE_PER_TOKEN + output * OUTPUT_PRICE_PER_TOKEN) * 100;
}
```

**Extend the signature** (RESEARCH lines 554-573, Pitfall #9): without `model` param, Phase 5 would under-count hook cost by ~13× ($12.00/M output vs $0.60/M Flash). Apply RESEARCH's verified per-model price table:

```typescript
// src/lib/engine/gemini/cost.ts
// Source: extends gemini.ts:142-149 with per-model pricing.
// CITED: ai.google.dev/gemini-api/docs/pricing as of 2026-05-18.
const PRICING: Record<string, { input: number; output: number }> = {
  "gemini-3.1-pro-preview":  { input: 2.00 / 1_000_000,  output: 12.00 / 1_000_000 },
  "gemini-3-pro-preview":    { input: 2.00 / 1_000_000,  output: 12.00 / 1_000_000 }, // alias redirects to 3.1
  "gemini-3-flash-preview":  { input: 0.50 / 1_000_000,  output:  3.00 / 1_000_000 },
  "gemini-3.1-flash-lite":   { input: 0.25 / 1_000_000,  output:  1.50 / 1_000_000 },
  "gemini-2.5-flash":        { input: 0.15 / 1_000_000,  output:  0.60 / 1_000_000 }, // legacy
};

const FALLBACK_INPUT_TOKENS = 2000;
const FALLBACK_OUTPUT_TOKENS = 800;

export function calculateCost(
  model: string,
  usageMetadata: { promptTokenCount?: number; candidatesTokenCount?: number } | undefined,
): number {
  const rates = PRICING[model] ?? PRICING["gemini-3-flash-preview"]!; // safe default
  const input = usageMetadata?.promptTokenCount ?? FALLBACK_INPUT_TOKENS;
  const output = usageMetadata?.candidatesTokenCount ?? FALLBACK_OUTPUT_TOKENS;
  return (input * rates.input + output * rates.output) * 100; // cents
}
```

**Note**: Wave 0 already uses Gemini 3 Flash pricing constants in `wave0/content-type-detector.ts:17-18` (`INPUT_PRICE_PER_TOKEN = 0.50 / 1_000_000`, `OUTPUT_PRICE_PER_TOKEN = 3.00 / 1_000_000`). Phase 5's centralized `cost.ts` should make this Wave 0 file a candidate for follow-up consolidation (out of scope for Phase 5 per additive-only milestone constraint; leave as deferred).

---

### `src/lib/engine/types.ts` (extended — widened GeminiVideoAnalysis + new sub-types)

**Analog:** Phase 4's own widening at `src/lib/engine/types.ts:198-206` (SignalAvailability + content_type/niche keys) + `types.ts:236-265` (GeminiVideoResponseSchema composition pattern).

**Phase 4 SignalAvailability widening pattern** (`src/lib/engine/types.ts` lines 193-206):

```typescript
/**
 * Provenance — which signals fired vs degraded for this prediction.
 * Persisted to analysis_results.signal_availability JSONB column.
 * Forward-compat: future phases (audio, retrieval, hook_decomp, etc.) add keys here.
 */
export interface SignalAvailability {
  behavioral: boolean;
  gemini: boolean;
  ml: boolean;
  rules: boolean;
  trends: boolean;
  content_type: boolean;  // NEW Phase 4 (D-20) — set by aggregator from wave0Result.content_type !== null
  niche: boolean;          // NEW Phase 4 (D-20) — set by aggregator from wave0Result.niche !== null
}
```

**Phase 5 adds three keys** (CONTEXT D-12): `gemini_hook`, `gemini_body`, `gemini_cta`. Match the comment convention: `// NEW Phase 5 (D-12) — set by aggregator from segmented analysis result`. The existing `gemini` key stays and is now derived: `gemini = gemini_hook || gemini_body || gemini_cta` (computed at aggregator-time per RESEARCH summary item #3).

**GeminiVideoAnalysis widening pattern** (`src/lib/engine/types.ts` lines 250-265):

```typescript
export const GeminiResponseSchema = z.object({
  factors: z.array(FactorSchema).length(5),
  overall_impression: z.string(),
  content_summary: z.string(),
  video_signals: GeminiVideoSignalsSchema.optional(),
});

export type GeminiAnalysis = z.infer<typeof GeminiResponseSchema>;

export const GeminiVideoResponseSchema = GeminiResponseSchema.extend({
  video_signals: GeminiVideoSignalsSchema,
});

export type GeminiVideoAnalysis = z.infer<typeof GeminiVideoResponseSchema>;
export type GeminiVideoSignals = z.infer<typeof GeminiVideoSignalsSchema>;
```

**Phase 5 widens** (CONTEXT D-13): add `hook_decomposition` and `cta_segment` as `.optional().nullable()` fields (RESEARCH Pitfall #10, line 575-583: "Make `hook_decomposition` and `cta_segment` **optional + nullable** in `GeminiVideoAnalysisSchema`"). Existing test factories (`__tests__/factories.ts:22-64`) build fixtures without those fields — they MUST continue to typecheck. Also widen the interior `video_signals` fields from `number` to `number | null` (RESEARCH line 439: "the existing `video_signals` interior fields move from `number` to `number | null` — this is a schema widening that ripples into `FeatureVector` (`types.ts:7-47`) and any aggregator code reading those fields. Plan must include a type-narrowing audit of every consumer.")

**Polarity warning**: `cognitive_load` is **higher = worse** — opposite of every other score. The Zod schema range `0-10` is the same, but every consumer needs a comment-level annotation: `// POLARITY INVERTED — higher score = MORE cognitive load = WORSE retention` (RESEARCH line 776).

---

### `src/lib/engine/aggregator.ts` (extended — SignalAvailability keys + CTA-penalty branch)

**Analog:** `src/lib/engine/aggregator.ts:311-349` (Phase 4 content-type weights branch + SignalAvailability assembly).

**SignalAvailability assembly pattern** (`src/lib/engine/aggregator.ts` lines 329-349):

```typescript
const availability: SignalAvailability = {
  behavioral: deepseekResult !== null,
  gemini: geminiResult.analysis.factors.some((f) => f.score > 0), // HARD-03: false when all factors are 0 (fallback)
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

**Phase 5 additions**: read the per-segment availability from `pipelineResult.geminiResult.signalAvailability` (the new shape returned by `analyzeVideoSegmented`):

```typescript
gemini_hook: pipelineResult.geminiResult.signalAvailability?.gemini_hook ?? false,
gemini_body: pipelineResult.geminiResult.signalAvailability?.gemini_body ?? false,
gemini_cta:  pipelineResult.geminiResult.signalAvailability?.gemini_cta ?? false,
// Existing `gemini` becomes derived:
gemini: pipelineResult.geminiResult.signalAvailability
  ? (pipelineResult.geminiResult.signalAvailability.gemini_hook
      || pipelineResult.geminiResult.signalAvailability.gemini_body
      || pipelineResult.geminiResult.signalAvailability.gemini_cta)
  : geminiResult.analysis.factors.some((f) => f.score > 0), // fallback for text mode / legacy callers
```

**`?? false` fallback for historical JSONB rows** (RESEARCH line 475): "Aggregator must `?? false` on missing keys when reading historical rows. **No data migration; planner adds the `?? false` fallback in `aggregator.ts`.**"

**`SCORE_WEIGHT_KEYS` filter discipline** (`src/lib/engine/aggregator.ts` lines 39-44, 65-69):

```typescript
// PATTERNS Critical Cross-File Constraint #3:
// selectWeights() must iterate ONLY known SCORE_WEIGHTS keys. Phase 4 widened
// SignalAvailability with content_type + niche provenance keys (D-20) — those
// must NOT participate in weight redistribution math.
const SCORE_WEIGHT_KEYS = ["behavioral", "gemini", "ml", "rules", "trends"] as const;

// In selectWeights():
const filtered = (Object.entries(availability) as Array<[string, boolean]>)
  .filter(([key]) => (SCORE_WEIGHT_KEYS as readonly string[]).includes(key)) as Array<
  [ScoreWeightKey, boolean]
>;
```

**Critical**: `gemini_hook` / `gemini_body` / `gemini_cta` are PROVENANCE keys, like `content_type` / `niche`. They must NOT appear in `SCORE_WEIGHT_KEYS` and must NOT participate in `selectWeights()` math (PATTERNS Critical Cross-File Constraint #3 — the existing comment at lines 39-44 already documents this rule for Phase 4; Phase 5 inherits and extends).

**Phase 4 content-type weights branch (model for CTA-penalty branch)** (`src/lib/engine/aggregator.ts` lines 311-317):

```typescript
const wave0 = pipelineResult.wave0Result;
const contentTypeSlug = wave0.content_type?.type ?? null;
const rawVideoSignals = geminiResult.analysis.video_signals ?? null;
const adjustedVideoSignals =
  rawVideoSignals && contentTypeSlug !== null
    ? applyContentTypeWeights(rawVideoSignals, contentTypeSlug)
    : rawVideoSignals;
```

**Apply same shape for CTA penalty** (CONTEXT D-06): read `wave0Result.content_type?.type` and `geminiResult.analysis.cta_segment?.cta_present`, then apply the penalty table per content type. Recommended location: as a new branch immediately AFTER the content-type weights branch and BEFORE `assembleFeatureVector` is called. Pure function — `applyCtaPenalty(geminiScore, contentTypeSlug, ctaSegment)` returns adjusted gemini_score.

Penalty table (CONTEXT D-06):
- `tutorial` × `cta_present=false`: -0.5 score units
- `b_roll` × `cta_present=false`: -0.3 score units
- All others: neutral

When `cta_present=true`, blend `strength` (0-10) into gemini math at Claude's discretion (CONTEXT D-06: "blend strength into existing aggregator video_signals math or surface as a separate sub-score; planner picks").

**`"Weights redistributed — missing signals"` warning pattern** (`src/lib/engine/aggregator.ts` lines 437-451): the existing warning filter is already SCORE_WEIGHT_KEYS-aware — Phase 5's three new keys are correctly excluded by this filter, so no additional code change is required for the warning logic.

---

### `src/lib/engine/pipeline.ts` (extended — Wave 1 swap + per-segment events)

**Analog:** `src/lib/engine/pipeline.ts:332-371` (Wave 1 Gemini call site, current `analyzeVideoWithGemini` invocation).

**Current Wave 1 Gemini call site** (`src/lib/engine/pipeline.ts` lines 332-371):

```typescript
// Stage 3: Gemini Analysis -- NON-CRITICAL (fallback with warning — HARD-03)
const geminiPromise = (async (): Promise<PipelineResult["geminiResult"]> => {
  try {
    // Route video uploads to video-specific Gemini analysis
    if (validated.input_mode === "video_upload" && validated.video_storage_path) {
      return await timed("gemini_video_analysis", timings, async () => {
        const { data: videoBlob, error: downloadError } = await supabase
          .storage
          .from("videos")
          .download(validated.video_storage_path!);

        if (downloadError || !videoBlob) {
          throw new Error(
            `Failed to download video from storage: ${downloadError?.message ?? "no data"}`
          );
        }

        const buffer = Buffer.from(await videoBlob.arrayBuffer());
        const ext = validated.video_storage_path!.split(".").pop()?.toLowerCase() ?? "mp4";
        const mimeType = EXT_TO_MIME[ext] ?? "video/mp4";

        return analyzeVideoWithGemini(buffer, mimeType, validated.niche);
      }, { wave: 1, onEvent: onStageEvent });
    }

    // Default: text analysis
    return await timed("gemini_analysis", timings, () =>
      analyzeWithGemini(validated),
      { wave: 1, onEvent: onStageEvent }
    );
  } catch (error) {
    Sentry.captureException(error, {
      tags: { stage: "gemini_analysis", requestId },
    });
    warnings.push(
      `Gemini analysis unavailable: ${error instanceof Error ? error.message : String(error)}`
    );
    timings.push({ stage: "gemini_analysis", duration_ms: 0 });
    return DEFAULT_GEMINI_RESULT;
  }
})();
```

**Phase 5 swap** (CONTEXT D-11, D-14):
1. **Remove the outer `timed("gemini_video_analysis", ...)` wrapper** for the video branch — the three per-segment events emitted by the helpers replace the single `gemini_video_analysis` event (CONTEXT D-14, Phase 3 D-01/D-02 explicit design).
2. **Replace** `analyzeVideoWithGemini(buffer, mimeType, validated.niche)` with `analyzeVideoSegmented(buffer, mimeType, { niche: validated.niche, contentType: wave0Result.content_type?.type, creatorContext, onStageEvent, calibration })`.
3. **Preserve** the legacy export `analyzeVideoWithGemini` and the text-mode branch (`analyzeWithGemini`) unchanged — CONTEXT D-11: "existing `analyzeVideoWithGemini` stays callable so the eval harness corpus-replay path can compare segmented vs un-segmented outputs during the Phase 12 acceptance benchmark."
4. **Preserve** the storage download + Supabase client + extension→MIME mapping pattern (lines 338-352) verbatim.
5. **Preserve** the outer try/catch + `DEFAULT_GEMINI_RESULT` fallback (lines 362-371). RESEARCH summary: "Pipeline never throws on Gemini failure."

**Wave 1 Promise.all parallel pattern** (`src/lib/engine/pipeline.ts` lines 413-422):

```typescript
// Run Wave 1 in parallel -- all stages gracefully degrade (HARD-03).
const [geminiResult, audioResult, , ruleResult] = await timed(
  "wave_1",
  timings,
  () => Promise.all([geminiPromise, audioPromise, creatorPromise, rulePromise]),
  { wave: 1, onEvent: onStageEvent }
);
```

**Preserve unchanged**: the Wave 1 outer wrapper still emits the parent `wave_1` event; the three new segment events bubble up as Phase 3 D-01/D-02 nested stage events under the same wave. The `Promise.all` over Wave 1 stages stays — only the inner `geminiPromise` body changes.

**`PipelineResult` shape extension** (`src/lib/engine/pipeline.ts` lines 40-59):

```typescript
export interface PipelineResult {
  payload: ContentPayload;
  geminiResult: { analysis: GeminiAnalysis; cost_cents: number };
  // ... other fields ...
}
```

**Phase 5 widens** the `geminiResult` shape to add `signalAvailability` (per-segment provenance) — the aggregator reads this for the `gemini_hook` / `gemini_body` / `gemini_cta` keys:

```typescript
geminiResult: {
  analysis: GeminiVideoAnalysis | GeminiAnalysis;  // segmented returns the widened shape
  cost_cents: number;
  signalAvailability?: { gemini_hook: boolean; gemini_body: boolean; gemini_cta: boolean };  // NEW Phase 5
};
```

**Wave 1 stages logged in breadcrumb** (`src/lib/engine/pipeline.ts` lines 424-429):

```typescript
Sentry.addBreadcrumb({
  category: "engine.pipeline",
  message: "Wave 1 complete",
  level: "info",
  data: { requestId, stages: ["gemini", "audio", "creator", "rules"] },
});
```

Leave unchanged — the breadcrumb is wave-level, not segment-level (each segment helper has its own Sentry tags + emit pair).

---

### `src/lib/engine/__tests__/gemini-segmented.test.ts` (new — unit + integration tests)

**Analog:** `src/lib/engine/__tests__/wave0-content-type.test.ts` — verified Vitest mock pattern for Gemini Files API + `generateContent` + per-stage events.

**Vitest mock pattern** (`src/lib/engine/__tests__/wave0-content-type.test.ts` lines 9-47):

```typescript
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import type { StageEvent } from "../events";
import type { ContentPayload } from "../types";

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  })),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

const mockGenerate = vi.fn();
const mockFileUpload = vi.fn();
const mockFileGet = vi.fn();
const mockFileDelete = vi.fn();
vi.mock("@google/genai", () => {
  const MockGoogleGenAI = vi.fn(function (this: Record<string, unknown>) {
    this.models = { generateContent: mockGenerate };
    this.files = {
      upload: mockFileUpload, get: mockFileGet, delete: mockFileDelete,
    };
  });
  return {
    GoogleGenAI: MockGoogleGenAI,
    Type: { OBJECT: "OBJECT", STRING: "STRING", NUMBER: "NUMBER", BOOLEAN: "BOOLEAN" },
  };
});

process.env.GEMINI_API_KEY = "test-key";
process.env.GEMINI_WAVE0_MODEL = "gemini-3-flash-preview";

import { detectContentType } from "../wave0/content-type-detector";
```

**Copy verbatim** — same mocks for `@/lib/logger`, `@sentry/nextjs`, `@google/genai`. Just add `ARRAY: "ARRAY"` to the `Type` mock since segment schemas use it. Set THREE env vars instead of one:

```typescript
process.env.GEMINI_API_KEY = "test-key";
process.env.GEMINI_HOOK_MODEL = "gemini-3.1-pro-preview";
process.env.GEMINI_BODY_MODEL = "gemini-3-flash-preview";
process.env.GEMINI_CTA_MODEL  = "gemini-3-flash-preview";
```

**Sequenced mock returns for 3-way fan-out** (RESEARCH lines 974-994):

```typescript
mockGenerate
  .mockResolvedValueOnce({ text: JSON.stringify(VALID_HOOK_FIXTURE), usageMetadata: HOOK_USAGE })
  .mockResolvedValueOnce({ text: JSON.stringify(VALID_BODY_FIXTURE), usageMetadata: BODY_USAGE })
  .mockResolvedValueOnce({ text: JSON.stringify(VALID_CTA_FIXTURE),  usageMetadata: CTA_USAGE });

const result = await analyzeVideoSegmented(
  Buffer.from(new Uint8Array(8)),
  "video/mp4",
  { niche: "beauty", contentType: "tutorial", duration: 30, calibration: STUB_CAL, onStageEvent: vi.fn() },
);

expect(mockGenerate).toHaveBeenCalledTimes(3);
const calls = mockGenerate.mock.calls;
expect(calls[0][0].contents[0].parts[1].videoMetadata).toEqual({ startOffset: "0s", endOffset: "5s" });
expect(calls[1][0].contents[0].parts[1].videoMetadata).toEqual({ startOffset: "5s", endOffset: "27s" });
expect(calls[2][0].contents[0].parts[1].videoMetadata).toEqual({ startOffset: "27s", endOffset: "30s" });
```

**`beforeEach` default mocks** (`src/lib/engine/__tests__/wave0-content-type.test.ts` lines 65-74):

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  mockFileUpload.mockResolvedValue({ name: "files/abc", state: "ACTIVE", uri: "gs://abc" });
  mockFileGet.mockResolvedValue({ name: "files/abc", state: "ACTIVE", uri: "gs://abc" });
});
```

**Event-driven assertion pattern** (`src/lib/engine/__tests__/wave0-content-type.test.ts` lines 82-86, 130-144):

```typescript
const cb = vi.fn();
const result = await detectContentType(videoPayload, mockSupabaseClient, cb);
const events = cb.mock.calls.map((c) => c[0] as StageEvent);
expect(events.some((e) => e.type === "stage_start" && (e as { stage?: string }).stage === "wave_0_content_type")).toBe(true);
expect(events.some((e) => e.type === "stage_end" && (e as { stage?: string }).stage === "wave_0_content_type" && (e as { ok?: boolean }).ok === true)).toBe(true);
```

**Phase 5 test surface** (CONTEXT Claude's Discretion + RESEARCH Pitfall #10):
- Three start/end event pairs assertion: `gemini_hook` / `gemini_body` / `gemini_cta` under `wave: 1`.
- Files API delete called **exactly once** after all 3 settle (test for D-10 / Pitfall #1).
- Partial-failure table (8 cases: HHH, HHF, HFH, FHH, HFF, FHF, FFH, FFF) per RESEARCH line 1003 — assert null-fill + per-segment `pipeline_warning` events + signalAvailability flags + null when all 3 fail (D-08 / D-09).
- CTA presence-aware: `cta_present=true` → `strength` and `type` non-null; `cta_present=false` → both null (Zod `.refine` invariant).
- `weakest_modality` enum membership.
- `cognitive_load` polarity perturbation pair (RESEARCH § Eval D8): two hook fixtures only differ in cognitive_load score — assert higher cognitive_load → lower overall (NOT higher).
- Short-video body-skip branch: `duration < 8s` → body call skipped + `gemini_body=false` (Claude's discretion picks option (a) per CONTEXT).
- Aggregator CTA-penalty branch: 7 content_type × 2 cta_present = 14 cases, mocking `wave0Result.content_type.type` and `geminiResult.analysis.cta_segment.cta_present`.
- Niche injection: assert each call's prompt text contains the niche string.
- Existing 549 tests still pass (RESEARCH Pitfall #10): make `hook_decomposition` and `cta_segment` `.optional().nullable()` so `makeGeminiAnalysis()` factory still typechecks.

---

## Shared Patterns

### Authentication / Client Initialization
**Source:** `src/lib/engine/gemini.ts:81-88` (`getClient` singleton)
**Apply to:** All segment helpers + orchestrator

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

**Critical**: do NOT re-implement. Either `export { getClient }` from `gemini.ts`, or thread the `ai` instance from orchestrator → helpers (RESEARCH code example threads it via `runHookSegment(ai, fileUri, mimeType, opts)` first param).

### Environment-Variable-with-Default Pattern
**Source:** `src/lib/engine/gemini.ts:17` (`GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash"`) + `src/lib/engine/wave0/content-type-detector.ts:14` (`GEMINI_WAVE0_MODEL = process.env.GEMINI_WAVE0_MODEL ?? "gemini-3-flash-preview"`)
**Apply to:** Each segment helper

```typescript
// In hook-segment.ts:
const model = process.env.GEMINI_HOOK_MODEL ?? "gemini-3.1-pro-preview";

// In body-segment.ts:
const model = process.env.GEMINI_BODY_MODEL ?? "gemini-3-flash-preview";

// In cta-segment.ts:
const model = process.env.GEMINI_CTA_MODEL ?? "gemini-3-flash-preview";
```

**Critical**: the default model strings must be the **preview-suffixed forms** (RESEARCH summary item #1): bare aliases `gemini-3-pro` / `gemini-3-flash` are invalid SDK strings as of 2026-05-18. Phase 4 already documents this in `wave0/content-type-detector.ts:13` (the comment explicitly says: `// Default is "gemini-3-flash-preview" (NOT "gemini-3-flash" — bare alias invalid as of 2026-05-18).`).

### Sentry Per-Stage Tagging
**Source:** `src/lib/engine/wave0/content-type-detector.ts:211` + `src/lib/engine/gemini.ts:523-525`
**Apply to:** Each segment helper

```typescript
Sentry.captureException(error, { tags: { stage: "gemini_hook" } });   // / "gemini_body" / "gemini_cta"
```

### Stage Event Emission
**Source:** `src/lib/engine/events.ts:19-49` (`emitStageStart` / `emitStageEnd`)
**Apply to:** Each segment helper (three pairs total under `wave: 1`)

```typescript
const startTs = emitStageStart(opts.onStageEvent, "gemini_hook", 1);
// ... call ...
emitStageEnd(opts.onStageEvent, "gemini_hook", 1, startTs, {
  cost_cents: +cost_cents.toFixed(4),
  ok: true,
  warning: undefined,
});
```

The orchestrator does NOT emit a top-level `gemini_video_analysis` pair — the three segment events replace it (CONTEXT D-14).

### `pipeline_warning` Emission for Partial Failures
**Source:** `src/lib/engine/events.ts:11` (StageEvent union includes `{ type: "pipeline_warning"; message: string; stage?: string }`) + RESEARCH Pattern 3 (mergeSegments)
**Apply to:** Orchestrator's `mergeSegments` function

```typescript
opts.onStageEvent?.({
  type: "pipeline_warning",
  message: "Gemini hook analysis unavailable — score uses other segments.",
  stage: "gemini_hook",
});
```

One warning per failed segment (CONTEXT D-08). If all 3 fail, emit `gemini_video_unavailable` instead (CONTEXT D-09).

### Structured Logging
**Source:** `src/lib/engine/wave0/content-type-detector.ts:10` (`createLogger({ module: "wave0.content-type" })`)
**Apply to:** Each segment helper

```typescript
import { createLogger } from "@/lib/logger";
const log = createLogger({ module: "engine.gemini.hook" });  // / .body / .cta
```

CONTEXT Established Patterns: "Phase 5 logs under `engine.gemini.hook`, `engine.gemini.body`, `engine.gemini.cta` (or one module name + stage field)."

### Zod-at-LLM-Boundary Validation
**Source:** `src/lib/engine/gemini.ts:107-116` (`parseGeminiVideoResponse`) + `src/lib/engine/wave0/content-type-detector.ts:178-187` (inline `safeParse`)
**Apply to:** Each segment helper, immediately after `response.text` access

```typescript
const rawText = response.text ?? "";
const cleaned = stripFences(rawText);  // reuse gemini.ts:91-94
const parsed = JSON.parse(cleaned);
const result = HookSegmentZodSchema.safeParse(parsed);
if (!result.success) {
  throw new Error(`Hook segment response validation failed: ${result.error.message}`);
}
const analysis = result.data;
```

`stripFences` is already exported from `gemini.ts:91-94` (RESEARCH code example imports it: `import { stripFences } from "../gemini";`).

### Cost Soft-Cap Warning
**Source:** `src/lib/engine/gemini.ts:499-504`

```typescript
if (cost_cents > 2.0) {
  log.warn("Video analysis cost exceeds soft cap", {
    cost_cents: +cost_cents.toFixed(4),
    soft_cap: 2.0,
  });
}
```

**Apply to** each segment with per-segment caps from AI-SPEC §4b cost table:
- Hook (Pro): soft cap 1.6¢
- Body (Flash): soft cap 0.7¢
- CTA (Flash): soft cap 0.4¢

Warn-only — never fail.

### `+cost.toFixed(4)` Numeric Coercion for Event Payloads
**Source:** `src/lib/engine/wave0/content-type-detector.ts:200-208` + `src/lib/engine/gemini.ts:510, 518`
**Apply to:** Every `cost_cents` field on `stage_end` events

```typescript
cost_cents: +costCents.toFixed(4)
```

**Critical**: the `+` prefix converts the string returned by `toFixed` back to a number — Phase 3's `StageEvent.cost_cents` is typed `number`. Pattern is project-wide.

### File Size Cap
**Source:** `src/lib/engine/gemini.ts:21, 418-423`

```typescript
const VIDEO_MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

if (videoBuffer.byteLength > VIDEO_MAX_SIZE_BYTES) {
  throw new Error("Video exceeds maximum size (50MB / ~3 minutes). Trim the video before uploading.");
}
```

**Reuse VERBATIM** — Phase 5 keeps the same 50MB cap (CONTEXT no decision changes this).

---

## Critical Cross-File Constraints

Carry-forward from Phase 3 / Phase 4 PATTERNS — Phase 5 inherits + extends:

1. **No new DB schema migration.** `analysis_results.signal_availability` JSONB column already exists (Phase 3 migration). New keys `gemini_hook` / `gemini_body` / `gemini_cta` are forward-compatible JSONB extensions. Old rows have no such keys; aggregator MUST `?? false` when reading missing keys (RESEARCH line 475).

2. **`SCORE_WEIGHT_KEYS` discipline.** `selectWeights()` in `aggregator.ts:43, 65-67` iterates ONLY known SCORE_WEIGHTS keys. Phase 5's new provenance keys (`gemini_hook` / `gemini_body` / `gemini_cta`) MUST NOT appear in `SCORE_WEIGHT_KEYS` and MUST NOT participate in weight redistribution math. (Same rule as Phase 4's `content_type` / `niche` keys.)

3. **Event-emission ownership.** Per-segment helpers OWN their `stage_start` / `stage_end` pairs. The orchestrator does NOT emit a wrapper pair (CONTEXT D-14: three new events REPLACE today's single `gemini_video_analysis`). Phase 4 already established this discipline in `wave0.ts:18-20` ("This function is pure orchestration — no event emission") — Phase 5 inherits the same shape.

4. **Files API delete in OUTER finally only.** The `ai.files.delete({ name })` MUST sit at the orchestrator level around `Promise.allSettled([...])`. Never inside any per-segment helper (RESEARCH Pitfall #1 — the most damaging Phase 5 footgun).

5. **Existing 549 tests stay green.** Phase 5 widens `GeminiVideoAnalysis` with `hook_decomposition` and `cta_segment` as `.optional().nullable()` (RESEARCH Pitfall #10). Existing `makeGeminiAnalysis()` factory (`__tests__/factories.ts:22-64`) builds fixtures without those fields and must continue to typecheck.

6. **`analyzeVideoWithGemini` legacy export preserved.** Eval harness corpus replay (CONTEXT D-11) still calls the legacy single-call function for A/B comparison until Phase 12 cleanup. Phase 5 keeps the export callable; only `pipeline.ts:353` swap removes it from the live pipeline.

7. **Polarity flag for `cognitive_load`.** Every consumer of the field needs a comment-level annotation: `// POLARITY INVERTED — higher score = MORE cognitive load = WORSE retention`. Failure to flag = silent ML regression when Phase 10 trains on the score (RESEARCH line 451).

---

## No Analog Found

None. Every Phase 5 file has at least one strong existing analog. This is consistent with the milestone's additive-only constraint and RESEARCH's primary finding: "Phase 5 is a textbook *'the platform already has the primitive — split one call into three calls of the same shape'* refactor" (RESEARCH line 467).

---

## Metadata

**Analog search scope:**
- `src/lib/engine/` (root + `wave0/` + `__tests__/`)
- `.planning/phases/05-video-segmentation-hook-decomposition/05-RESEARCH.md` Code Examples section (verified patterns)
- `.planning/phases/05-video-segmentation-hook-decomposition/05-CONTEXT.md` Canonical References (line-numbered analog list)

**Files scanned:** 11 source files + 1 test file + 2 planning docs

**Pattern extraction date:** 2026-05-18

**Key insight**: Phase 5's `wave0/content-type-detector.ts` analog is the **gold pattern** — that file already proves single-upload + `videoMetadata: { startOffset, endOffset }` works against Gemini 3 Flash preview with the exact response schema, Zod-at-boundary, Sentry tag, AbortController + timeout, and `finally` delete shape Phase 5 needs three copies of. Phase 4 was the de-risking phase for Phase 5; Phase 5 is fan-out + merge over patterns already in production.
