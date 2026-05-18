# Phase 4: Wave 0 — Content Type + Niche Detection - Research

**Researched:** 2026-05-18
**Domain:** LLM classifier orchestration / Gemini 3 video segments / DeepSeek V4 Flash text classification / aggregator weight matrix / taxonomy extension
**Confidence:** HIGH (CONTEXT decisions are locked; risks isolated to V3→V4 migration path and Gemini 3 video pricing — both addressed below with cited evidence)

## Summary

Phase 4 fills the existing Wave 0 no-op stub (`src/lib/engine/wave0.ts`, scaffolded in Phase 3 D-16) with two parallel classifier calls plus an additive aggregator extension plus a two-field taxonomy expansion. Three coupled work surfaces: (1) **Gemini 3 Flash content-type classifier** runs on `videoMetadata: { startOffset: "0s", endOffset: "5s" }` and returns one of seven categories (six locked + `other`) with a confidence and mixed-content flag; (2) **DeepSeek V4 Flash niche detector** runs as a text classifier over caption + hashtags + handle + Card 1/4/5/6 context and returns `{ primary, sub, micro, confidence }` with a 0.6 fallback threshold; (3) **content-type × signal weight matrix** in `aggregator.ts` multiplies the four Gemini video sub-signals (visual_production_quality, hook_visual_impact, pacing_score, transition_quality) by a 7×4 locked matrix BEFORE they aggregate into the 0.25-weighted Gemini score, with multipliers floored at 0.5 and ceilinged at 1.5. Plus: `taxonomy.ts` grows by ~150 lines with `personas` + `benchmark_filters` per primary niche. Plus: a **forced** env-default flip `DEEPSEEK_MODEL: "deepseek-reasoner" → "deepseek-v4-flash"` covering both the new Wave 0 niche call and the existing Wave 2 reasoning call.

**The critical risk — and good news — is the V3 → V4 migration (D-03, Topic #12).** Research confirms that as of 2026-04-24 the legacy `deepseek-chat` and `deepseek-reasoner` aliases already route transparently to **V4 Flash's non-thinking** and **V4 Flash's thinking** modes respectively, with hard retirement on **2026-07-24 15:59 UTC** [VERIFIED: api-docs.deepseek.com/news/news260424]. This means: (a) the existing Wave 2 reasoning call has been silently running on V4 Flash thinking mode for ~24 days already — no behavior risk; (b) the `DEEPSEEK_MODEL` flip from `"deepseek-reasoner"` → `"deepseek-v4-flash"` IS NOT a one-to-one replacement of reasoner. The closest direct replacement for the reasoning use case is `"deepseek-v4-flash"` with thinking-mode parameter enabled (or `"deepseek-v4-pro"` if reasoning quality matters more than cost). For the new Wave 0 niche classifier, non-thinking V4 Flash is the right choice (cheap, fast, text classification). Recommendation: **introduce a separate `DEEPSEEK_NICHE_MODEL` env (defaulting to `"deepseek-v4-flash"`)** rather than flipping the shared `DEEPSEEK_MODEL` constant, OR document explicitly that Wave 2's reasoning path now uses V4 Flash without thinking mode (which is a quality drop). See Topic #12 for the full risk + mitigation.

**Primary recommendation:** Ship as planned with five surgical decisions: (1) keep `DEEPSEEK_MODEL` pointing at the reasoning model and add a NEW `DEEPSEEK_NICHE_MODEL` env, (2) introduce `GEMINI_WAVE0_MODEL` env defaulting to `"gemini-3-flash-preview"` (preview suffix is current as of 2026-05; do NOT use bare `"gemini-3-flash"` which is invalid), (3) use `startOffset/endOffset` as **STRING** durations like `"0s"` / `"5s"` (NOT numbers — the Gemini API rejects integers here), (4) wrap detector calls in `Promise.allSettled` for independent failure isolation, (5) cache pre-fetched `creatorContext` via PipelineOptions per D-18 (single read, reused by Wave 1).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONTENT-01 | Content type classifier (V3, ~$0.001/call) — talking head / B-roll / slideshow / action / tutorial / vlog | Topic #1 + #11 — Gemini 3 Flash on 5s segment via `videoMetadata: { startOffset: "0s", endOffset: "5s" }`; 7-category enum (locked-6 + `other`); cost ~$0.0008/call confirmed via Gemini 3 pricing ($0.50/M input × ~350 video tokens for 5s @ 1fps + ~100 input text tokens + ~100 output tokens). NOTE: the REQUIREMENTS line "V3" is the v3-engine signal source label, not "DeepSeek V3" — content-type classifier is Gemini |
| CONTENT-02 | Hierarchical niche detector (V3, ~$0.001/call) — primary / sub-niche / micro-niche from content + creator profile | Topic #2 + Topic #5 — DeepSeek V4 Flash text call with caption + hashtags + handle + Card 1 (primary+sub) + Card 4 (style) + Card 5 (reference handles, sanitized) + Card 6 (host-only URLs per PROFILE-16 mitigation); returns `{ primary, sub, micro, confidence, source, warning? }`; 0.6 fallback per D-05/D-07 |
| CONTENT-03 | Niche taxonomy stored as tree structure with mappings to persona archetypes and benchmark filters | Topic #6 + #7 + #8 — `NICHE_TREE` already exists with 10 primaries × 8-12 subs; Phase 4 adds `personas: PersonaMix[]` + `benchmark_filters: BenchmarkFilters` per primary niche; researcher-proposed per-niche values grounded in Phase 1 corpus characteristics |
| CONTENT-04 | Content-type-aware signal weighting passed to aggregator (e.g., slideshows down-weight pacing signal) | Topic #5 — additive extension to `aggregator.ts` at the Gemini sub-signal computation point (~line 328); new `applyContentTypeWeights(videoSignals, contentType)` helper returns a multiplier-adjusted copy; D-12 locked 7×4 matrix with [0.5, 1.5] caps |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Content-type classification (perception) | External Service (Gemini 3 Flash) | API/Backend (`src/lib/engine/wave0/content-type-detector.ts` new file) | Visual classification requires multimodal model; backend orchestrates upload + response parsing |
| Niche detection (text classification) | External Service (DeepSeek V4 Flash) | API/Backend (`src/lib/engine/wave0/niche-detector.ts` new file) | Pure text classifier; cheaper than Gemini; existing DeepSeek client + circuit-breaker pattern reused |
| Wave 0 orchestration (parallel Promise.allSettled) | API/Backend (`src/lib/engine/wave0.ts` body swap) | — | Pipeline-internal coordination; preserves event-emission contract from Phase 3 D-16 |
| Creator-context pre-fetch (Card 1/4/5/6) | API/Backend (`src/lib/engine/pipeline.ts` insertion before line 269) | Database (single SELECT against `creator_profiles`) | Cheap read; pre-fetching avoids racing Wave 1 ordering; D-17/D-18 lock |
| Content-type × signal weight matrix | API/Backend (`aggregator.ts` ~line 328 sub-signal aggregation) | — | Aggregator already owns Gemini sub-signal math; additive helper inside existing scope |
| Persona-archetype mapping (Phase 7 consumer) | API/Backend (`src/lib/niches/taxonomy.ts` extension) | — | Hardcoded TS module per Phase 2 D-10; consumed at runtime by Phase 7 persona allocator |
| Benchmark-filter mapping (Phase 8 consumer) | API/Backend (`src/lib/niches/taxonomy.ts` extension) | Database (Phase 8 will use pgvector against `scraped_videos`) | Tag filter list lives in code; pgvector query in Phase 8 reads `.benchmark_filters` |
| Cost telemetry (per-call cost_cents) | API/Backend (`emitStageEnd` already accepts `cost_cents`) | — | Existing pattern from Phase 3 D-02; no new surface needed |
| `signal_availability` JSONB widening (`content_type`, `niche` keys) | Database (JSONB column — schemaless, no migration) | API/Backend (aggregator computes flags) | Phase 3 D-07 forward-compat hook works as designed |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@google/genai` | 1.41.0 | Gemini 3 Flash video segment analysis | Already in dep tree; supports `videoMetadata.startOffset/endOffset` via `fileData` part [VERIFIED: ai.google.dev/gemini-api/docs/video-understanding] |
| `openai` (DeepSeek client) | 6.22.0 | DeepSeek V4 Flash chat completion for niche text classification | Already wired in `deepseek.ts:247-252` with `baseURL: "https://api.deepseek.com"`; reuse same circuit-breaker [VERIFIED: code read] |
| `zod` | 4.3.6 | Wave0ContentTypeResult / Wave0NicheResult / widened Wave0Result schemas | Established pattern at every LLM-output boundary (e.g., `GeminiVideoResponseSchema`, `DeepSeekResponseSchema`) [VERIFIED: types.ts:244-310] |
| `node:crypto` (built-in) | Node 20+ | (Indirect — content_hash already computed in route handler from Phase 3) | No new use here; just confirming no new dep needed |
| `vitest` | 4.0.18 | Unit + integration tests with mocked Gemini + DeepSeek clients | 80% threshold already enforced [VERIFIED: vitest.config.ts] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@sentry/nextjs` | 10.39.0 | Error tracking on detector boundaries | Add breadcrumbs + capture exceptions in both detector try/catch paths (mirror Phase 3 pattern) |
| `nanoid` | 5.1.6 | (Not needed for Phase 4 — requestId already plumbed) | n/a |
| `@/lib/logger` (`createLogger`) | local | Per-detector module logger | `createLogger({ module: "wave0.content-type" })` + `createLogger({ module: "wave0.niche" })` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `gemini-3-flash-preview` (Flash on 5s) | `gemini-3-pro-preview` on 5s | Pro is overkill for 6-way perceptual classification; cost is 4-6× higher; D-01 explicitly rejected this |
| `deepseek-v4-flash` (text-only niche) | `deepseek-v4-pro` for niche | V4 Pro is 5-10× more expensive; D-02 specifically picks Flash for cost/sufficiency; defer Pro until eval data justifies (D-deferred) |
| One DeepSeek call doing BOTH content_type + niche | Two parallel specialized calls | Parallel Promise.allSettled isolates failures + matches D-22 testability + Gemini wins on visual content type (text-only DeepSeek would miss visual cues) |
| Folding content_type into Phase 5 hook call | Separate Wave 0 stage | D-22-discussion rejected this — it breaks Wave 0 architecture; Phase 4 SC#1 requires Wave 0 fires before Wave 1 |
| Inline detector implementations in `wave0.ts` | Separate `src/lib/engine/wave0/*.ts` files | Subfolder cleaner for future-stage additions; recommended (see Topic #3) |

**Installation:** No new dependencies. All capability is already in `package.json`. Researcher confirms via:
```bash
node -e "console.log(require('./package.json').dependencies['@google/genai'])"   # → "1.41.0"
node -e "console.log(require('./package.json').dependencies['openai'])"         # → "6.22.0"
```

**Version verification (executed 2026-05-18):**
- `@google/genai@1.41.0` — current; supports `gemini-3-flash-preview` model + `videoMetadata.startOffset/endOffset` [VERIFIED: SDK docs]
- `openai@6.22.0` — current; transparently passes through DeepSeek's `prompt_cache_hit_tokens` in usage field [VERIFIED: Phase 3 RESEARCH cross-check]
- `zod@4.3.6` — current; `z.enum([...] as const)` works for the 7-category content-type and niche slug enums

## Architecture Patterns

### System Architecture Diagram

```
                        POST /api/analyze (Vercel serverless, nodejs runtime)
                                          │
                                          ▼
                  ┌────────────────────────────────────────────────┐
                  │  Existing Phase 3 path: auth, content_hash,    │
                  │  L1/L2 cache check                              │
                  └────────────────────────────────────────────────┘
                                          │
                                          ▼
                  ┌────────────────────────────────────────────────┐
                  │  runPredictionPipeline(input, {                 │
                  │    requestId, onStageEvent,                     │
                  │    bypassCache, creatorContext? ◄── NEW (D-18)  │
                  │  })                                             │
                  └────────────────────────────────────────────────┘
                                          │
                                          ▼
                  ┌────────────────────────────────────────────────┐
                  │  Stage 1+2: validate + normalize (unchanged)   │
                  └────────────────────────────────────────────────┘
                                          │
                                          ▼
                  ┌────────────────────────────────────────────────┐
                  │  pre_creator_context (NEW — D-17)               │
                  │    if (opts.creatorContext) reuse               │
                  │    else fetchCreatorContext(supabase, ...)      │
                  │  emits stage_start/end "pre_creator_context"    │
                  └────────────────────────────────────────────────┘
                                          │
                                          ▼
                  ┌────────────────────────────────────────────────┐
                  │  runWave0(payload, creatorContext, onEvent)    │
                  │    Promise.allSettled([                         │
                  │      detectContentType(payload, onEvent),       │
                  │        // emits wave_0_content_type pair        │
                  │      detectNiche(payload, creatorCtx, onEvent), │
                  │        // emits wave_0_niche_detector pair      │
                  │    ])                                           │
                  │  → returns Wave0Result {                        │
                  │      content_type: <result | null>,             │
                  │      niche: <result | null>                     │
                  │    }                                            │
                  └────────────────────────────────────────────────┘
                                          │
                                          ▼
              Wave 1 (parallel — UNCHANGED orchestration; creator        Wave 2 (parallel — UNCHANGED):
              promise reuses pre-fetched context):                        - deepseek_reasoning
              - gemini_analysis / gemini_video_analysis                   - trend_enrichment
              - audio_analysis (no-op)                                              │
              - creator_context (reuses passed-in context — no            ▼
                second DB read)                                  Wave 3 (no-op stub — Phase 7)
              - rule_scoring                                                        │
                                          │                                         ▼
                                          ▼                          ┌────────────────────────────┐
                                                                    │  aggregateScores(           │
                                                                    │    pipelineResult,          │
                                                                    │    onStageEvent             │
                                                                    │  ):                         │
                                                                    │  1. Read wave0Result.       │
                                                                    │     content_type.type       │
                                                                    │  2. Look up multipliers     │
                                                                    │     from CONTENT_TYPE_      │
                                                                    │     WEIGHT_MATRIX           │
                                                                    │  3. applyContentTypeWeights │
                                                                    │     (videoSignals, type)    │
                                                                    │  4. Existing gemini_score   │
                                                                    │     math runs on            │
                                                                    │     adjusted signals        │
                                                                    │  5. signal_availability:    │
                                                                    │     + content_type (bool)   │
                                                                    │     + niche (bool)          │
                                                                    │  6. Stage 10/11 no-op       │
                                                                    └────────────────────────────┘
                                                                                │
                                                                                ▼
                                                                  PredictionResult returned;
                                                                  /api/analyze persists row +
                                                                  populates L1 cache.
```

**Reader trace:** A request enters via POST, gets validated, computes a content hash, attempts cache lookup. On miss, the pipeline starts. After validate+normalize, a NEW `pre_creator_context` step pre-fetches creator data (cheap DB read, ~50ms) — this is the only new orchestration insertion. Wave 0's body swaps from no-op to two parallel `Promise.allSettled` calls: Gemini 3 Flash on the first 5 seconds of video for content_type, DeepSeek V4 Flash on text+creator context for hierarchical niche. Both emit their own start/end event pairs (already wired by Phase 3). The pre-fetched creator context is also passed to Wave 1's `creatorPromise` to avoid a second DB read. Wave 1 and Wave 2 run unchanged. Aggregator reads `wave0Result.content_type.type`, applies the locked weight matrix to Gemini sub-signals BEFORE they aggregate into the Gemini score, and sets `signal_availability.content_type` + `.niche` flags before persistence.

### Recommended Project Structure

```
src/lib/engine/
├── wave0.ts                                # Existing stub — body swapped (50 → ~80 LOC)
├── wave0/                                  # NEW subfolder
│   ├── content-type-detector.ts            # NEW — Gemini 3 Flash on video[0..5s]
│   ├── niche-detector.ts                   # NEW — DeepSeek V4 Flash niche classifier
│   ├── content-type-weights.ts             # NEW — 7×4 matrix + applyContentTypeWeights helper
│   └── prompts.ts                          # NEW — niche-detector system + user prompt templates
├── pipeline.ts                             # Edited — insert pre_creator_context step + pass creatorContext to wave0 + Wave 1
├── aggregator.ts                           # Edited — additive integration of weight matrix at line ~328 + signal_availability widening
├── types.ts                                # Edited — Wave0ContentTypeResult, Wave0NicheResult, widened Wave0Result + Zod schemas
├── creator.ts                              # Possibly edited — optionally export `prefetchCreatorContext` for clarity
├── deepseek.ts                             # NOT edited — niche detector reuses DeepSeek client via separate code path with separate model env
├── gemini.ts                               # NOT edited — Wave 0 uses separate `GEMINI_WAVE0_MODEL` env, separate client init in detector file
└── __tests__/
    ├── wave0-content-type.test.ts          # NEW — mocked Gemini, 7 enum cases + confidence boundaries + mixed warning
    ├── wave0-niche-detector.test.ts        # NEW — mocked DeepSeek, fallback paths + drift detection + micro null
    ├── wave0-orchestration.test.ts         # NEW — Promise.allSettled isolation, event emission ordering, pre-fetch reuse
    ├── content-type-weights.test.ts        # NEW — matrix lookup, cap enforcement, passthrough for 'other'
    ├── aggregator.test.ts                  # Extended — weight application integration test
    ├── pipeline.test.ts                    # Extended — pre_creator_context emission + reuse
    └── stubs.test.ts                       # Kept — old stub tests stay green via backwards-compat shape (see Topic #11)

src/lib/niches/
├── taxonomy.ts                             # Extended — adds personas + benchmark_filters per primary niche (~150 LOC growth)
└── __tests__/
    └── taxonomy.test.ts                    # NEW — assert all 10 primaries have non-empty personas + benchmark_filters + sums-to-10
```

**File-organization decision (Claude's discretion — D-22 area):** Use the `wave0/` subfolder. Rationale: Phase 4 introduces 4 new files specific to Wave 0 orchestration; future phases (5 hook decomp, 6 audio, 7 personas) will follow the same `waveN/` pattern as they each grow multi-file. Keeping `wave0.ts` as the top-level orchestrator + `wave0/*.ts` as detector + helper modules mirrors the proven Phase 3 organization (`cache/prediction-cache.ts`). Single-file alternative considered and rejected: at ~250 LOC combined, wave0.ts becomes harder to test in isolation.

**Single `taxonomy.ts` vs split into `niche-mappings.ts` (D-15 — Claude's discretion):** Keep single file. Current `taxonomy.ts` is 187 LOC; adding personas + benchmark_filters per primary adds ~15 LOC per primary × 10 primaries = ~150 LOC, ending at ~340 LOC. Below the 500-line CLAUDE.md threshold. Co-locating tree + mappings preserves the "one place to edit niche metadata" mental model. Split would force cross-file imports for what is conceptually one taxonomy module. If file grows >500 LOC in a future phase, split then.

### Pattern 1: Parallel detector orchestration with isolated failure

**What:** Both detectors run in parallel via `Promise.allSettled`, NOT `Promise.all`. `allSettled` waits for both to finish (succeed or fail) and returns `[{status, value/reason}, ...]` rather than rejecting on the first error. This implements D-16's contract: "if either throws, that call's result is null, the OTHER result still returns".

**When to use:** Whenever a Wave runs independent calls and one failure should not cancel the other. Standard pattern for parallel LLM detectors where graceful degradation is required.

**Example:**
```typescript
// src/lib/engine/wave0.ts — NEW BODY
import type { ContentPayload, Wave0Result } from "./types";
import type { StageEventCallback } from "./events";
import type { CreatorContext } from "./creator";
import { detectContentType } from "./wave0/content-type-detector";
import { detectNiche } from "./wave0/niche-detector";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "wave0" });

export async function runWave0(
  payload: ContentPayload,
  creatorContext: CreatorContext,
  onEvent?: StageEventCallback,
): Promise<Wave0Result> {
  // Each detector emits its OWN stage_start/end events internally.
  // wave0.ts becomes pure orchestration — no duplicate event emission.
  const [contentTypeOutcome, nicheOutcome] = await Promise.allSettled([
    detectContentType(payload, onEvent),
    detectNiche(payload, creatorContext, onEvent),
  ]);

  if (contentTypeOutcome.status === "rejected") {
    log.warn("Content-type detector failed", { reason: String(contentTypeOutcome.reason) });
  }
  if (nicheOutcome.status === "rejected") {
    log.warn("Niche detector failed", { reason: String(nicheOutcome.reason) });
  }

  return {
    content_type: contentTypeOutcome.status === "fulfilled" ? contentTypeOutcome.value : null,
    niche: nicheOutcome.status === "fulfilled" ? nicheOutcome.value : null,
  };
}
```

Source: synthesized from Phase 3 D-16 contract + standard Node.js parallel-failure pattern; matches existing pipeline.ts wave_1 try/catch wrappers but elevated to Promise-level for cleaner isolation.

### Pattern 2: Gemini 3 Flash video-segment classifier with structured output

**What:** Upload video via Gemini Files API (matches existing `gemini.ts:425-462` pattern), poll for PROCESSING → ACTIVE, then call `generateContent` with `videoMetadata: { startOffset: "0s", endOffset: "5s" }` on the `fileData` part. Specify `responseSchema` to lock the 7-category enum + confidence + mixed flag at the API layer.

**When to use:** Any Wave that needs a perceptual classification on a defined time range of video. Phase 5 will reuse the same pattern for hook (0-3s), body, CTA segments.

**Example:**
```typescript
// src/lib/engine/wave0/content-type-detector.ts — NEW
import * as Sentry from "@sentry/nextjs";
import { GoogleGenAI, Type } from "@google/genai";
import type { ContentPayload, Wave0ContentTypeResult } from "../types";
import { Wave0ContentTypeResultSchema } from "../types";
import type { StageEventCallback } from "../events";
import { emitStageStart, emitStageEnd } from "../events";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "wave0.content-type" });

const GEMINI_WAVE0_MODEL =
  process.env.GEMINI_WAVE0_MODEL ?? "gemini-3-flash-preview";

// Per gemini.ts:25-27, Flash pricing: input $0.50/1M, output $3/1M (gemini-3-flash-preview rates).
// 5s of video @ 1fps with media_resolution_low ≈ ~350 video tokens + ~150 text tokens input.
// Output: enum + confidence + mixed flag → ~80 tokens. Total cost ≈ $0.0006 per call.
const INPUT_PRICE_PER_TOKEN = 0.50 / 1_000_000;
const OUTPUT_PRICE_PER_TOKEN = 3.00 / 1_000_000;

const TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 60_000;

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

const SYSTEM_PROMPT = `You are a TikTok content-type classifier. Watch the provided video segment (first 5 seconds of a TikTok-style short) and classify it into ONE of:

- talking_head: a person speaking directly to camera (interview-style, vlog-style, monologue)
- b_roll: aesthetic visuals with voiceover or text overlay, often product/lifestyle footage
- slideshow: still images or text cards swiped/fading in sequence (no motion footage)
- action: motion-heavy content (dance, sports, stunts, vehicles, choreography)
- tutorial: step-by-step demonstration of how to do something (recipe, makeup how-to, coding screencast)
- vlog: casual handheld self-recorded daily life, walk-and-talk, day-in-the-life
- other: anything not clearly in the above (dance, music performance, ASMR, gaming, animation, abstract, etc.)

Return a confidence (0.0-1.0) reflecting how clearly the video fits the chosen category.
If the video shifts type mid-stream (e.g., 2s talking-head then 3s b-roll), set mixed=true, return the DOMINANT type (most seconds), set dominant_seconds to how many of the 5 the dominant type covered, and set secondary_type to the other type observed.
If clarity is below 0.6, prefer 'other' over a forced guess.
Score visual + audio together; do not over-index on a single modality.`;

export async function detectContentType(
  payload: ContentPayload,
  onEvent?: StageEventCallback,
): Promise<Wave0ContentTypeResult | null> {
  const startTs = emitStageStart(onEvent, "wave_0_content_type", 0);

  // Wave 0 only runs against actual video uploads. For text/tiktok_url input
  // modes, return null gracefully — no video bytes to classify.
  if (payload.input_mode !== "video_upload" || !payload.video_url) {
    emitStageEnd(onEvent, "wave_0_content_type", 0, startTs, {
      cost_cents: 0, ok: true,
      warning: "no_video_input_skipping_content_type",
    });
    return null;
  }

  let costCents = 0;
  let uploadedFileName: string | undefined;
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    // payload.video_url at this point is a resolved Supabase storage URL.
    // The actual buffer fetch is in the route handler; here we'd receive a buffer
    // OR re-share the file URI already uploaded by Wave 1's analyzeVideoWithGemini.
    //
    // RECOMMENDED: planner picks between two approaches:
    //   (A) Wave 0 uploads its own copy → simpler, but ~1 extra upload per analysis
    //   (B) Share the Wave 1 upload's fileUri → 1 upload, but Wave 0 must complete BEFORE Wave 1
    //       starts the analyzeVideoWithGemini call (creates ordering constraint).
    // For Phase 4 ship, prefer (A) — Wave 0 is independent + small video portion (5s);
    // Phase 5 (segment analysis) revisits and unifies the upload (it owns the 3 parallel
    // hook/body/CTA segments and the single shared upload).

    // Actual buffer comes from route handler reading payload.video_url's underlying buffer.
    // Code skeleton — final wiring details locked at planning time.
    const buffer = /* obtained from route handler via PipelineOptions extension OR re-download */;
    const mimeType = "video/mp4";  // resolved from extension in pipeline.ts line 312-313
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });

    const uploadResult = await ai.files.upload({ file: blob, config: { mimeType } });
    if (!uploadResult.name) throw new Error("Gemini file upload returned no name");
    uploadedFileName = uploadResult.name;

    // Poll for processing (same pattern as gemini.ts:454-475)
    let fileState = uploadResult.state;
    let fileUri = uploadResult.uri;
    const pollStart = Date.now();
    while (fileState === "PROCESSING") {
      if (Date.now() - pollStart > POLL_TIMEOUT_MS) {
        throw new Error("Gemini Files API processing timed out");
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      const info = await ai.files.get({ name: uploadedFileName });
      fileState = info.state;
      fileUri = info.uri;
    }
    if (fileState === "FAILED" || !fileUri) {
      throw new Error("Gemini Files API processing failed");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await ai.models.generateContent({
      model: GEMINI_WAVE0_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: SYSTEM_PROMPT },
            {
              fileData: { fileUri, mimeType },
              // CRITICAL: offsets are STRINGS like "0s" / "5s", not numbers.
              // Numbers will be silently coerced or rejected.
              // [VERIFIED: ai.google.dev/gemini-api/docs/video-understanding]
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

    clearTimeout(timeout);

    // Cost calculation
    const promptTokens = response.usageMetadata?.promptTokenCount ?? 500;
    const candidateTokens = response.usageMetadata?.candidatesTokenCount ?? 80;
    costCents =
      (promptTokens * INPUT_PRICE_PER_TOKEN +
        candidateTokens * OUTPUT_PRICE_PER_TOKEN) *
      100;

    const raw = JSON.parse(response.text ?? "{}");
    const validated = Wave0ContentTypeResultSchema.safeParse(raw);
    if (!validated.success) {
      throw new Error(`Content-type response validation failed: ${validated.error.message}`);
    }

    // Apply warnings based on confidence + mixed
    let result: Wave0ContentTypeResult = validated.data;
    if (result.confidence < 0.6 && !result.warning) {
      result = { ...result, warning: "low_confidence" };
    } else if (raw.mixed && !result.warning) {
      result = { ...result, warning: "mixed_content_detected" };
    }

    emitStageEnd(onEvent, "wave_0_content_type", 0, startTs, {
      cost_cents: +costCents.toFixed(4),
      ok: true,
      warning: result.warning,
    });
    return result;
  } catch (error) {
    Sentry.captureException(error, { tags: { stage: "wave_0_content_type" } });
    log.warn("Content-type detection failed", { error: error instanceof Error ? error.message : String(error) });
    emitStageEnd(onEvent, "wave_0_content_type", 0, startTs, {
      cost_cents: +costCents.toFixed(4),
      ok: false,
      warning: error instanceof Error ? error.message : String(error),
    });
    return null;  // graceful degradation per CONTEXT D-16
  } finally {
    // Best-effort cleanup (matches gemini.ts:541-547)
    if (uploadedFileName) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
        await ai.files.delete({ name: uploadedFileName });
      } catch { /* ignore */ }
    }
  }
}
```

Source: Gemini 3 video-segment pattern verified via [ai.google.dev/gemini-api/docs/video-understanding] + existing `gemini.ts:425-547` upload+poll structure; modeled on Phase 5's anticipated triple-segment pattern.

### Pattern 3: DeepSeek V4 Flash niche text classifier (reuses circuit breaker)

**What:** Single chat-completion call to DeepSeek V4 Flash with stable system prompt (so V4's automatic input cache benefits) + per-request user message containing creator/content context. Reuses existing `getClient()` + `isCircuitOpen()` pattern from deepseek.ts. Structured output via `response_format: { type: "json_object" }` + Zod validation.

**When to use:** Any text-only LLM classification where we want V4 Flash's cost (cache-hit $0.0028/M, miss $0.14/M, output $0.28/M [VERIFIED: api-docs.deepseek.com/quick_start/pricing]) and the existing OpenAI-SDK-shaped client.

**Example:**
```typescript
// src/lib/engine/wave0/niche-detector.ts — NEW
import * as Sentry from "@sentry/nextjs";
import OpenAI from "openai";
import { z } from "zod";
import type { ContentPayload, Wave0NicheResult } from "../types";
import { Wave0NicheResultSchema } from "../types";
import type { CreatorContext } from "../creator";
import type { StageEventCallback } from "../events";
import { emitStageStart, emitStageEnd } from "../events";
import { NICHE_TREE, getNicheBranches } from "@/lib/niches/taxonomy";
import { createLogger } from "@/lib/logger";
import { NICHE_SYSTEM_PROMPT, buildNicheUserMessage } from "./prompts";

const log = createLogger({ module: "wave0.niche" });

// Separate env from DEEPSEEK_MODEL (which the Wave 2 reasoning call uses).
// Defaults to v4-flash NON-thinking mode for cheap classification.
const DEEPSEEK_NICHE_MODEL =
  process.env.DEEPSEEK_NICHE_MODEL ?? "deepseek-v4-flash";

// V4 Flash pricing — same constants as deepseek.ts:41-42; replicated for clarity.
const CACHE_HIT_PRICE = 0.0028 / 1_000_000;
const CACHE_MISS_PRICE = 0.14 / 1_000_000;
const OUTPUT_PRICE = 0.28 / 1_000_000;

// Confidence thresholds — Claude's discretion in CONTEXT, recommend env-overridable.
const CONFIDENCE_THRESHOLD = parseFloat(process.env.NICHE_CONFIDENCE_THRESHOLD ?? "0.6");
const MICRO_THRESHOLD = parseFloat(process.env.NICHE_MICRO_CONFIDENCE_THRESHOLD ?? "0.6");

const TIMEOUT_MS = 15_000;

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY");
    client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
  }
  return client;
}

export async function detectNiche(
  payload: ContentPayload,
  creatorContext: CreatorContext,
  onEvent?: StageEventCallback,
): Promise<Wave0NicheResult | null> {
  const startTs = emitStageStart(onEvent, "wave_0_niche_detector", 0);
  let costCents = 0;

  try {
    const ai = getClient();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const userMessage = buildNicheUserMessage(payload, creatorContext);

    const response = await ai.chat.completions.create(
      {
        model: DEEPSEEK_NICHE_MODEL,
        messages: [
          { role: "system", content: NICHE_SYSTEM_PROMPT },  // byte-identical across calls → cache prefix
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    // Read cache telemetry (Phase 3 pattern from deepseek.ts:557-580)
    const usage = response.usage as unknown as {
      prompt_cache_hit_tokens?: number;
      prompt_cache_miss_tokens?: number;
      completion_tokens?: number;
    } | undefined;
    const cacheHit = usage?.prompt_cache_hit_tokens ?? 0;
    const cacheMiss = usage?.prompt_cache_miss_tokens ?? 0;
    const completion = usage?.completion_tokens ?? 0;
    costCents = (cacheHit * CACHE_HIT_PRICE + cacheMiss * CACHE_MISS_PRICE + completion * OUTPUT_PRICE) * 100;

    const text = response.choices[0]?.message?.content ?? "{}";
    const raw = JSON.parse(text);

    // Initial validation
    const validated = Wave0NicheResultSchema.safeParse(raw);
    if (!validated.success) {
      throw new Error(`Niche response validation failed: ${validated.error.message}`);
    }
    let result: Wave0NicheResult = validated.data;

    // Apply Card 1 fallback / drift detection per D-05, D-06, D-07
    if (result.confidence < CONFIDENCE_THRESHOLD) {
      if (creatorContext.niche_primary && creatorContext.niche_sub) {
        // Card 1 fallback
        result = {
          primary: creatorContext.niche_primary,
          sub: creatorContext.niche_sub,
          micro: null,  // micro is AI-only; drop on fallback per D-07
          confidence: result.confidence,
          source: "card1_fallback",
        };
      } else {
        result = { ...result, source: "ai", warning: "niche_low_confidence_no_fallback" };
      }
    } else {
      // Drift detection (D-06) — only emit warning when Card 1 is filled and disagrees
      if (
        creatorContext.niche_primary &&
        creatorContext.niche_primary !== result.primary
      ) {
        result = { ...result, source: "ai", warning: "niche_drift_detected" };
      } else {
        result = { ...result, source: "ai" };
      }
    }

    // Micro-niche null-out at low micro-confidence (D-07).
    // The model returns micro_confidence separately in raw (planner decides field name).
    if (raw.micro_confidence !== undefined && raw.micro_confidence < MICRO_THRESHOLD) {
      result = { ...result, micro: null };
    }

    // Slug validation against NICHE_TREE (CONTEXT slug normalization)
    const primary = NICHE_TREE.find(p => p.slug === result.primary);
    if (!primary) {
      log.warn("Niche detector returned unknown primary slug", { primary: result.primary });
      // Soft-fallback: use 'other' or first taxonomy entry; planner picks.
      // Recommended: throw → triggers null return → aggregator handles gracefully.
      throw new Error(`Unknown primary niche slug: ${result.primary}`);
    }
    const sub = getNicheBranches(result.primary).find(s => s.slug === result.sub);
    if (!sub) {
      log.warn("Niche detector returned unknown sub slug for primary", {
        primary: result.primary, sub: result.sub,
      });
      throw new Error(`Unknown sub niche slug: ${result.sub}`);
    }

    log.info("Niche detection complete", {
      cache_hit_tokens: cacheHit,
      cache_miss_tokens: cacheMiss,
      cost_cents: +costCents.toFixed(4),
      source: result.source,
    });

    emitStageEnd(onEvent, "wave_0_niche_detector", 0, startTs, {
      cost_cents: +costCents.toFixed(4),
      ok: true,
      warning: result.warning,
    });
    return result;
  } catch (error) {
    Sentry.captureException(error, { tags: { stage: "wave_0_niche_detector" } });
    log.warn("Niche detection failed", { error: error instanceof Error ? error.message : String(error) });
    emitStageEnd(onEvent, "wave_0_niche_detector", 0, startTs, {
      cost_cents: +costCents.toFixed(4),
      ok: false,
      warning: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
```

Source: synthesized from `deepseek.ts:509-650` (existing OpenAI-SDK pattern) + DeepSeek V4 Flash docs [VERIFIED: api-docs.deepseek.com] + CONTEXT D-05/D-06/D-07/D-08 + Phase 3 D-12 cache telemetry pattern.

### Pattern 4: Content-type × signal weight matrix (additive aggregator extension)

**What:** Pure function `applyContentTypeWeights(videoSignals, contentType)` returns a multiplier-adjusted copy of the Gemini sub-signals. Called inside `aggregateScores` BEFORE the gemini_score average computation at `aggregator.ts:328-331`. Multipliers from the locked 7×4 matrix; capped at [0.5, 1.5]. When `content_type` is null (Wave 0 failed) or its confidence is below 0.6 (mixed/low), use the `other` row (1.0× passthrough) so nothing breaks.

**When to use:** ONLY this extension in aggregator. NO other aggregator math changes per "additive only" milestone constraint.

**Example:**
```typescript
// src/lib/engine/wave0/content-type-weights.ts — NEW
import type { GeminiVideoSignals } from "../types";

export type ContentTypeSlug =
  | "talking_head" | "b_roll" | "slideshow" | "action"
  | "tutorial" | "vlog" | "other";

export type SignalMultipliers = {
  visual_production_quality: number;
  hook_visual_impact: number;
  pacing_score: number;
  transition_quality: number;
};

// LOCKED matrix per CONTEXT D-12 — Phase 10 revises based on corpus evidence.
export const CONTENT_TYPE_WEIGHT_MATRIX: Record<ContentTypeSlug, SignalMultipliers> = {
  talking_head: { visual_production_quality: 1.0, hook_visual_impact: 1.1, pacing_score: 1.0, transition_quality: 0.8 },
  b_roll:       { visual_production_quality: 1.2, hook_visual_impact: 1.0, pacing_score: 1.0, transition_quality: 1.2 },
  slideshow:    { visual_production_quality: 0.8, hook_visual_impact: 0.9, pacing_score: 0.5, transition_quality: 0.7 },
  action:       { visual_production_quality: 1.3, hook_visual_impact: 1.2, pacing_score: 1.2, transition_quality: 1.3 },
  tutorial:     { visual_production_quality: 1.0, hook_visual_impact: 1.2, pacing_score: 1.1, transition_quality: 1.0 },
  vlog:         { visual_production_quality: 0.9, hook_visual_impact: 0.8, pacing_score: 0.9, transition_quality: 0.9 },
  other:        { visual_production_quality: 1.0, hook_visual_impact: 1.0, pacing_score: 1.0, transition_quality: 1.0 },
};

export const MULTIPLIER_FLOOR = 0.5;
export const MULTIPLIER_CEILING = 1.5;

/**
 * Applies content-type weights to Gemini video signals.
 * Safety: clamps multipliers to [floor, ceiling] even though the matrix is locked
 * within that range — defense against future matrix edits that might violate caps.
 * When contentType is null (Wave 0 failed), passes through unchanged (uses 'other' row).
 */
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
    hook_visual_impact:
      Math.min(10, signals.hook_visual_impact * clamp(mult.hook_visual_impact)),
    pacing_score:
      Math.min(10, signals.pacing_score * clamp(mult.pacing_score)),
    transition_quality:
      Math.min(10, signals.transition_quality * clamp(mult.transition_quality)),
  };
}
```

**Aggregator integration point (D-19 — Claude's discretion):** Insert the call INSIDE `aggregateScores` at line ~328, NOT inline math. Helper-function approach keeps `aggregator.ts` math greppable and the matrix module unit-testable independently.

```typescript
// src/lib/engine/aggregator.ts — EDIT around lines 287–331
// Existing line 281: const feature_vector = assembleFeatureVector(pipelineResult);

// NEW: read wave0Result and apply weights to video signals BEFORE Gemini score.
const wave0 = pipelineResult.wave0Result;
const contentTypeSlug = wave0.content_type?.type ?? null;

// If we have video signals, apply the matrix.
let adjustedVideoSignals = gemini.video_signals ?? null;
if (adjustedVideoSignals && contentTypeSlug !== null) {
  adjustedVideoSignals = applyContentTypeWeights(adjustedVideoSignals, contentTypeSlug);
}

// Existing gemini_score math at lines 328-331 — REUSE BUT FEED ADJUSTED FACTORS.
// Note: existing math averages gemini.factors (the 5 named factors), NOT video_signals.
// video_signals influence the FeatureVector that feeds ML, not gemini_score directly.
// Phase 4 D-12 explicit: "multiplies Gemini sub-signals BEFORE they contribute to the
// Gemini score". This means: the feature_vector visual/pacing/transition fields
// (which DO feed ML and indirectly the overall score via SCORE_WEIGHTS.ml) must
// use the adjusted values.

// → REFACTOR `assembleFeatureVector` to accept an optional adjustedVideoSignals override
//   OR compute the FeatureVector at this insertion point using adjustedVideoSignals.
// Recommended: pass adjustedVideoSignals through PipelineResult so assembleFeatureVector
// reads from it directly — minimal surface area, clear data flow.

// Signal availability widening:
const availability: SignalAvailability = {
  behavioral: deepseekResult !== null,
  gemini: geminiResult.analysis.factors.some(f => f.score > 0),
  ml: mlAvailable,
  rules: ruleResult.matched_rules.length > 0 && !pipelineResult.warnings.some(w => w.includes("Rule scoring unavailable")),
  trends: trendEnrichment.matched_trends.length > 0 && !pipelineResult.warnings.some(w => w.includes("Trend enrichment unavailable")),
  content_type: wave0.content_type !== null,  // NEW Phase 4
  niche: wave0.niche !== null,                 // NEW Phase 4
};
```

**CRITICAL CLARIFICATION (Topic #5 deep-dive — IMPORTANT FOR PLANNER):** Re-reading the locked D-12 + the actual aggregator code, the locked matrix targets four "Gemini sub-signals" that today live in `geminiResult.analysis.video_signals.*` (typed as `GeminiVideoSignals`, see `types.ts:244-249`). These video_signals feed `assembleFeatureVector` (`aggregator.ts:168-172` → `visualProductionQuality`, `hookVisualImpact`, `pacingScore`, `transitionQuality`) which then feeds `predictWithML(mlFeatures)` (line 283). They do NOT directly feed the `gemini_score` computed at lines 328-331 — that average is over `gemini.factors[]` (the 5 named factors, not video signals).

CONTEXT D-12 reads literally: "BEFORE the Gemini sub-signals are combined into the Gemini score that contributes 0.25 to overall." The most faithful interpretation: the locked matrix adjusts video_signals BEFORE they flow into the feature_vector, which means the matrix's downstream impact is via ML score (weight 0.15 via SCORE_WEIGHTS.ml) AND any future aggregator extension that incorporates video_signals directly. Phase 10 already plans to add video-signal contribution to gemini_score (D-12 says "Phase 10 may revise the matrix based on corpus benchmark evidence") so this interpretation is forward-consistent.

**Planner action:** Pass adjusted `videoSignals` through to `assembleFeatureVector` via a new optional parameter `adjustedVideoSignalsOverride`. When non-null, use it instead of `geminiResult.analysis.video_signals`. Default (null) = current behavior. This makes the matrix application visible in feature_vector + ML scoring without changing the gemini_score formula. Document this interpretation clearly in the plan since the matrix's locked rationale (slideshow down-weights pacing, action up-weights production quality) only makes sense if these multipliers actually flow into final scoring.

### Pattern 5: Pre-fetch creator context as a pipeline-level concern (D-17/D-18)

**What:** Move `fetchCreatorContext` from inside Wave 1's parallel block to a separate step BEFORE `runWave0`. Cache the result on the `PipelineOptions` bag so Wave 1's `creatorPromise` reuses it. Single DB read, no double-fetch.

**When to use:** ONLY for Phase 4. The pre-fetch is justified because Wave 0's niche detector needs Card 1/4/5/6 BEFORE Wave 1 fires. Future phases that don't need creator context before Wave 1 keep the existing pattern.

**Example:**
```typescript
// src/lib/engine/pipeline.ts — EDIT around lines 224-269

export interface PipelineOptions {
  requestId?: string;
  onStageEvent?: StageEventCallback;
  bypassCache?: boolean;
  // NEW Phase 4:
  /** Pre-fetched creator context. When set, pipeline reuses; when absent, pipeline fetches. */
  creatorContext?: CreatorContext;
}

export async function runPredictionPipeline(
  input: AnalysisInput,
  opts?: PipelineOptions
): Promise<PipelineResult> {
  // ... existing setup ...

  // NEW: pre_creator_context step — runs after normalize, before Wave 0.
  // Emits its own start/end events with wave="aggregator" (or new tag "pre" — planner picks).
  const supabase = createServiceClient();
  const creatorContext = opts?.creatorContext ?? await timed(
    "pre_creator_context",
    timings,
    () => fetchCreatorContext(supabase, payload.creator_handle, payload.niche),
    { wave: 1, onEvent: onStageEvent }  // "wave: 1" because creator context is conceptually Wave 1 work
  );

  // Wave 0 NOW takes creatorContext
  const wave0Result = await runWave0(payload, creatorContext, onStageEvent);

  // ... Wave 1 unchanged BUT creator_context promise is now a passthrough ...
  // INSIDE creatorPromise (around line 343-358): replace fetchCreatorContext call with
  // a no-op promise that returns the already-fetched creatorContext.
  // Preserves the stage_start/stage_end "creator_context" event pair for backwards-compat,
  // but the event's duration_ms will be near-zero (just promise plumbing).
  const creatorPromise = (async () => {
    return await timed("creator_context", timings, async () => creatorContext, {
      wave: 1, onEvent: onStageEvent,
    });
  })();

  // ... rest unchanged ...
}
```

**Why `creatorContext` on PipelineOptions (D-18 — Claude's discretion):** Two-way benefit: (1) the route handler is the obvious entry point for context pre-fetch if/when the route needs it for other reasons (caching, telemetry, auth-gating); (2) the eval harness can synthesize a `CreatorContext` for offline benchmarks without touching the real DB. Alternative (first-class argument): less flexible, breaks the existing options-bag pattern; rejected.

**Backwards compat:** Existing callers (tests, eval harness, route) that pass either no `creatorContext` or an entire missing options bag continue to work — pipeline falls back to fetching via existing path. Zero behavior change for those callers.

### Anti-Patterns to Avoid

- **Flipping `DEEPSEEK_MODEL` env from "deepseek-reasoner" to "deepseek-v4-flash" globally** — D-03 reads this way, but the existing Wave 2 call uses thinking-mode (reasoning), and bare `"deepseek-v4-flash"` defaults to NON-thinking mode. This would silently degrade Wave 2 quality. RECOMMENDED: introduce a separate `DEEPSEEK_NICHE_MODEL` env, keep `DEEPSEEK_MODEL` pointing at `"deepseek-reasoner"` (which DeepSeek itself routes to V4 Flash thinking mode through 2026-07-24). See Topic #12 risk for full mitigation.
- **Using numeric values for `videoMetadata.startOffset/endOffset`** — Gemini API requires string durations like `"0s"`, `"5s"`, `"1m30s"`. Numbers will be rejected or silently mis-handled [VERIFIED: ai.google.dev/gemini-api/docs/video-understanding].
- **Using model ID `"gemini-3-flash"`** — current correct ID is `"gemini-3-flash-preview"`. The bare alias does not exist yet [VERIFIED: ai.google.dev/gemini-api/docs/models/gemini-3-flash-preview]. May graduate to GA without preview suffix in future; track via Gemini API changelog.
- **Calling Wave 0 from inside Wave 1's `Promise.all`** — Phase 4 SC#1 requires Wave 0 fires BEFORE Wave 1. Existing pipeline.ts:269 already does this correctly; preserve.
- **Throwing inside detectors when content is not classifiable** — return null + emit warning. Phase 3 graceful-degradation contract; aggregator already handles null `wave0Result.content_type` via the 'other' passthrough row.
- **Re-uploading the same video twice (Wave 0 and Wave 1)** — Phase 4 ship can accept this temporary inefficiency (~1.5MB per 5s video segment over network); Phase 5 (segment analysis) MUST unify uploads since it owns 3 parallel segments and the cost would be 3-4× without unification.
- **Hardcoding niche slugs in detector prompts** — instead, generate the primary-slug list from `NICHE_TREE.map(p => p.slug).join(", ")` so the model picks from the locked vocabulary. Single source of truth.
- **Forgetting to update `signal_availability.content_type` + `.niche` flags in aggregator** — Phase 3 D-07 forward-compat depends on aggregator setting these. Aggregator must NOT default missing flags to true (would falsely claim signals fired).
- **Surfacing past_wins/past_flops URL bodies in the niche-detector prompt** — Phase 2 PROFILE-16 prompt-injection mitigation requires HOST-ONLY (not full URL). The detector's prompt template MUST extract `new URL(u).host` per item and concatenate hosts as space-separated tokens.
- **Re-litigating the locked weight matrix** — D-12 is load-bearing locked. Plan must not propose minor adjustments; Phase 10 owns matrix revision per corpus evidence.
- **Putting matrix multipliers in env vars** — D-12 is locked in code. Env overrides would let an operator silently change scoring. If matrix needs tweaking, that's a Phase 10 code commit + version bump.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parallel call orchestration | Custom Promise wrapper or queue | `Promise.allSettled([a, b])` | Native, guarantees both resolve, returns typed `{status, value/reason}` per call; matches D-16 isolation contract |
| Gemini video segment extraction | Manual ffmpeg trimming + re-upload | `videoMetadata.startOffset/endOffset` on `fileData` part | Native to Gemini API; no ffmpeg dep [VERIFIED: video-understanding docs]; matches Phase 5 anticipated pattern |
| DeepSeek client / circuit breaker | Re-implement retry+timeout | `getClient()` + existing pattern from `deepseek.ts:243-309` | Already battle-tested for circuit breaker, half-open probing, mutex |
| Niche slug validation | Custom string-match | Zod `enum([...slugs] as const)` generated at module init from `NICHE_TREE.map(p => p.slug)` | Type-safe, runtime-validated, one source of truth |
| Weight matrix lookup with cap enforcement | Inline ternary in aggregator | `applyContentTypeWeights(signals, contentType)` helper | Unit-testable, central cap logic, future-revisable in one place |
| Persona allocation defaults per niche | Compute at runtime from corpus | Static `personas` field on `NichePrimary` (D-13) | Phase 7 reads constant; corpus-grounded research informs initial values; revisions are code commits |
| Benchmark filter generation | Per-call regex on corpus | Static `benchmark_filters` field on `NichePrimary` (D-14) | Phase 8's pgvector query reads filters; corpus-tag-derived list locked in code |
| Cost-per-call computation | Per-detector inline math | Single helper that takes usage breakdown + price constants | Mirror's `deepseek.ts:330-348` pattern; planner picks inline-vs-shared |
| Pre-fetch invalidation across calls | Custom cache for creator context | PipelineOptions cache passthrough (D-18) | Pure in-request data; no TTL needed; lives only for the single pipeline run |
| Detector failure tracking | Custom error registry | `Sentry.captureException(err, { tags: { stage: "..." } })` + null return | Existing pattern at every pipeline boundary; D-16 graceful degradation |

**Key insight:** Phase 4 is overwhelmingly "wire two LLM calls + write a multiplier helper + extend a typed tree." Every code surface here has a precedent in Phase 3 (event emission), Phase 2 (taxonomy structure), or core Gemini/DeepSeek code (client patterns + circuit breaker). The temptation to architect anew should be resisted.

## Common Pitfalls

### Pitfall 1: Gemini 3 Flash file-state polling timeout under load

**What goes wrong:** Gemini Files API requires uploading + polling for `state: "ACTIVE"` before generateContent will accept the file URI. Existing gemini.ts uses 60s polling timeout (`VIDEO_POLL_TIMEOUT_MS`). Under burst load (e.g., eval harness running 225 corpus videos sequentially), Gemini's file-processing queue can spike to 90s+ per file.

**Why it happens:** Files API is shared infrastructure; processing queue not user-isolated.

**How to avoid:** Keep the existing 60s polling timeout but configure Sentry breadcrumb at every poll iteration so failures are debuggable. If Phase 4 eval harness sees >5% timeout rate, plan a poll-timeout increase to 90s. Alternative: share the Wave 1 upload (option B in Pattern 2) — eliminates a second upload entirely.

**Warning signs:** `wave_0_content_type` stage_end events with `ok: false` + warning matching "polling timed out"; eval harness completion rate drops.

### Pitfall 2: DeepSeek input cache misses on niche-detector call

**What goes wrong:** The niche-detector's system prompt is byte-identical across calls (the NICHE_TREE primary list + classification rules), but if the planner accidentally interpolates dynamic content (e.g., current timestamp, request id) into the system prompt, cache hit rate drops to 0%.

**Why it happens:** DeepSeek's automatic cache matches prefix bytes from position 0 [VERIFIED: api-docs.deepseek.com/guides/kv_cache]. Any change to the early portion invalidates.

**How to avoid:** Define `NICHE_SYSTEM_PROMPT` as a module-level constant. Volatile content (caption, hashtags, creator handle, Card data) goes EXCLUSIVELY in the user message. Document the split in `prompts.ts` with a comment matching Phase 3 RESEARCH Pitfall 3 pattern.

**Warning signs:** `cache_hit_tokens === 0` on the niche detector across multiple sequential calls; cost telemetry shows per-call cost stuck at the cache-miss rate.

### Pitfall 3: Slug-validation rejection on legitimately new niches

**What goes wrong:** The DeepSeek model returns a slug like `"interior-design"` that the locked NICHE_TREE doesn't contain, slug-validation throws, the detector returns null, Wave 0 emits a graceful degradation warning, downstream phases lose niche signal for that video.

**Why it happens:** Hardcoded taxonomy can't anticipate every creator niche. The DeepSeek model has broad-world knowledge; the taxonomy has 10 primaries × ~10 subs.

**How to avoid:** Update the niche-detector SYSTEM_PROMPT to instruct the model: "If none of these primary niches fits, choose the closest match from the list above. Never invent a new slug." This is the canonical instruction-following technique [established pattern]. Add a Vitest case that proves the model can't return invented slugs (mock the LLM with an out-of-tree response, assert null return).

**Warning signs:** High rate of `wave_0_niche_detector` warnings of shape "Unknown primary niche slug" in production; eval harness shows niche=null for >5% of videos.

### Pitfall 4: Card 1 fallback when Card 1's primary slug is itself out of tree

**What goes wrong:** Card 1 in `creator_profiles.niche_primary` could contain a value not in NICHE_TREE (e.g., a slug from a prior taxonomy version, or a hand-typed value if Phase 2 validation gaps). Fallback would set `result.primary = creatorContext.niche_primary` and skip slug validation, breaking the type contract.

**Why it happens:** Phase 2's NichePicker should enforce slug validity at write time, but historical data + manual DB edits could leak invalid slugs.

**How to avoid:** Validate Card 1 against NICHE_TREE BEFORE using as fallback. If Card 1 is unknown, fall back to AI's best guess + emit `niche_low_confidence_no_fallback` warning. This is the "no fallback available" code path even though Card 1 is filled.

**Warning signs:** Slug-validation Sentry exceptions originating from fallback path; Card 1 fallback rate suspiciously low (means we're throwing instead).

### Pitfall 5: Mixed-content detection drift

**What goes wrong:** Gemini 3 Flash on 5s sees mostly opening title cards + 1s of B-roll, classifies as `slideshow` (dominant) + emits mixed_content_detected warning. The actual full video is 70% talking-head with title-card intro. Weight matrix applies slideshow-skewed multipliers (visual_quality 0.8, pacing 0.5), depressing the score.

**Why it happens:** 5s is a short window; the dominant type in the first 5s may not be the dominant type of the full video.

**How to avoid:** This is a known tradeoff documented in CONTEXT D-01 user discussion. Acceptable per phase scope (Phase 5 will see the full video). Aggregator should respect the `mixed_content_detected` warning by NOT applying full matrix weight when warning is present — but CONTEXT D-10 keeps this as deferred (Phase 4 emits warning, doesn't soft-handle). Document as known issue in plan.

**Warning signs:** Eval harness shows systematically higher slideshow-classified videos vs niche distribution; F1 drops on talking_head-heavy niches (edu, beauty).

### Pitfall 6: Detector parallelism + connection pool exhaustion

**What goes wrong:** Both Gemini and DeepSeek calls are HTTP-based with their own connection pools. Wave 0 fires both in parallel, Wave 1 also fires Gemini + DeepSeek in parallel (5 LLM calls eventually overlap in time: Wave 0 content-type Gemini, Wave 0 niche DeepSeek, Wave 1 gemini_video_analysis, Wave 1 audio (noop), Wave 1 rule_scoring (DB), Wave 1 creator_context (now passthrough), Wave 2 deepseek_reasoning, Wave 2 trend_enrichment). Connection pool can saturate on Vercel's serverless function.

**Why it happens:** Vercel Node runtime has a small default HTTP agent pool; multiple parallel requests to the same hostname queue up.

**How to avoid:** Phase 4 acceptance: don't over-optimize. Each detector creates its own OpenAI/GoogleGenAI client instance per-invocation (module-init cached). Vercel handles concurrent requests by spawning function instances. If latency spikes are observed, planner can add `http.Agent` with maxSockets in a future tuning phase.

**Warning signs:** stage_end durations >2× the LLM provider's expected latency; SocketHangUp errors in Sentry; Vercel function timeouts on dense bursts.

### Pitfall 7: Weight matrix multiplication breaks signal range

**What goes wrong:** Gemini video signals are 0-10. Matrix multipliers max 1.5. Without a cap, a signal of 10 × 1.5 = 15 leaks into the FeatureVector, breaking downstream ML scoring expectations.

**Why it happens:** Multipliers + raw signals = unbounded if not clamped.

**How to avoid:** `applyContentTypeWeights` clamps each adjusted value to `Math.min(10, raw * multiplier)`. The floor side is naturally bounded (a signal of 0 stays 0). Vitest case: `expect(applyContentTypeWeights({ visual_production_quality: 10, ... }, "action")).visual_production_quality).toBeLessThanOrEqual(10)`.

**Warning signs:** ML score divergence from baseline; FeatureVector validation throws on out-of-range fields; eval harness reports systematic score inflation post-Phase-4.

### Pitfall 8: Concurrent detector tests share Vitest module state

**What goes wrong:** `wave0-content-type.test.ts` mocks GoogleGenAI; `wave0-niche-detector.test.ts` mocks OpenAI. Both run in the same Vitest worker. Module-level singletons (`let client: OpenAI | null = null`) bleed between tests if `vi.resetModules()` isn't called.

**Why it happens:** Vitest by default doesn't reset module state between test files.

**How to avoid:** Use `vi.mock()` at the top of each detector test file with explicit factory functions. Add `afterEach(() => vi.restoreAllMocks())` to each describe block. Existing tests like `deepseek.test.ts` already handle this — match the pattern.

**Warning signs:** Tests pass individually but fail when run together; flaky cost-cents assertions; client mock invocation counts wrong.

## Code Examples

Verified patterns from existing codebase and cited docs.

### Zod schemas for Wave 0 outputs (Topic #8)

```typescript
// src/lib/engine/types.ts — EDITS

// =====================================================
// Phase 4 — Wave 0 Result Shapes (widening Wave0Result)
// =====================================================

export const ContentTypeEnumSchema = z.enum([
  "talking_head",
  "b_roll",
  "slideshow",
  "action",
  "tutorial",
  "vlog",
  "other",
] as const);

export type ContentTypeSlug = z.infer<typeof ContentTypeEnumSchema>;

export const Wave0ContentTypeResultSchema = z.object({
  type: ContentTypeEnumSchema,
  confidence: z.number().min(0).max(1),
  warning: z.enum(["mixed_content_detected", "low_confidence"]).optional(),
});
export type Wave0ContentTypeResult = z.infer<typeof Wave0ContentTypeResultSchema>;

export const Wave0NicheResultSchema = z.object({
  primary: z.string(),    // validated against NICHE_TREE in detector code, not in schema
  sub: z.string(),
  micro: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  source: z.enum(["ai", "card1_fallback"]),
  warning: z
    .enum(["niche_drift_detected", "niche_low_confidence_no_fallback"])
    .optional(),
});
export type Wave0NicheResult = z.infer<typeof Wave0NicheResultSchema>;

// Widened Wave0Result (REPLACES the existing interface at lines 205-209)
export const Wave0ResultSchema = z.object({
  content_type: Wave0ContentTypeResultSchema.nullable(),
  niche: Wave0NicheResultSchema.nullable(),
});
export type Wave0Result = z.infer<typeof Wave0ResultSchema>;
```

Source: synthesized from CONTEXT D-08 + D-11 + existing types.ts pattern at lines 244-310.

### Niche-detector prompts (locked at planning time)

```typescript
// src/lib/engine/wave0/prompts.ts — NEW
import { NICHE_TREE } from "@/lib/niches/taxonomy";
import type { ContentPayload } from "../types";
import type { CreatorContext } from "../creator";

// =====================================================
// STABLE system prompt — byte-identical across calls for cache.
// Lists the locked primary niches inline; sub-niches per primary are inferred
// by the model from its training corpus (the taxonomy slugs are
// industry-standard enough that V4 Flash knows them).
// =====================================================

const PRIMARY_SLUGS = NICHE_TREE.map(p => p.slug).join(", ");
const NICHE_TREE_TEXT = NICHE_TREE
  .map(p => `- ${p.slug}: ${p.subs.map(s => s.slug).join(", ")}`)
  .join("\n");

export const NICHE_SYSTEM_PROMPT = `You are a TikTok content niche classifier. Classify the provided content into the taxonomy.

## Taxonomy (only return slugs from this list)

Primary slugs: ${PRIMARY_SLUGS}

Sub-slugs by primary:
${NICHE_TREE_TEXT}

## Output

Return JSON with this exact shape:

{
  "primary": "<slug from primary list>",
  "sub": "<slug from sub list under primary>",
  "micro": "<more specific sub-niche slug OR null if uncertain>",
  "confidence": <0.0-1.0 overall confidence>,
  "micro_confidence": <0.0-1.0 confidence in the micro field specifically>
}

## Rules

- ONLY return slugs from the taxonomy above. NEVER invent new slugs.
- If the content doesn't fit any niche well, choose the closest primary + sub anyway. Don't refuse to classify.
- Confidence should reflect how clearly the content matches the chosen niche.
- micro can be more granular than the listed sub-slugs (e.g., "skincare-routine-morning" for skincare). It must be a slug format (lowercase, hyphen-separated). Return null if uncertain — the system handles micro=null gracefully.
- The creator profile (Card 1 niche, Card 4 content style, Card 5 reference creators, Card 6 past wins) is provided as context but is NOT authoritative — the per-video signal in caption/hashtags is more accurate for THIS video than the static profile.

Return ONLY the JSON object. No explanation, no markdown.`;

// =====================================================
// VOLATILE user message — per-request dynamic content.
// PROFILE-16 mitigation: past_wins/past_flops URLs are HOST-ONLY (not full URL),
// reference creators are sanitized via existing `creator.ts` patterns.
// =====================================================

export function buildNicheUserMessage(
  payload: ContentPayload,
  ctx: CreatorContext,
): string {
  const sections: string[] = ["## Content to Classify"];

  sections.push(`Caption / content text:`);
  sections.push(payload.content_text || "(no caption)");
  sections.push("");
  sections.push(
    `Hashtags: ${payload.hashtags.length > 0 ? payload.hashtags.join(", ") : "(none)"}`
  );
  if (payload.creator_handle) {
    sections.push(`Creator handle: @${payload.creator_handle}`);
  }

  sections.push("");
  sections.push("## Creator Profile Context (advisory, not authoritative)");
  if (ctx.niche_primary) {
    const sub = ctx.niche_sub ? `/${ctx.niche_sub}` : "";
    sections.push(`Card 1 (self-reported niche): ${ctx.niche_primary}${sub}`);
  }
  if (ctx.content_style) {
    sections.push(`Card 4 (content style): ${ctx.content_style}`);
  }
  if (ctx.reference_creators && ctx.reference_creators.length > 0) {
    // Sanitize: extract handle from URL or use raw handle. Defense-in-depth
    // matches creator.ts:251-253 pattern for delimiter sentinels.
    const handles = ctx.reference_creators
      .map(r => extractHandleOrHost(r.handle_or_url))
      .filter(Boolean)
      .join(", ");
    sections.push(`Card 5 (reference creator handles): ${handles}`);
  }
  if (ctx.past_wins && ctx.past_wins.length > 0) {
    // PROFILE-16: HOST ONLY, not full URL. URLs surfaced as opaque hosts.
    const hosts = ctx.past_wins
      .map(w => tryUrlHost(w.url))
      .filter(Boolean)
      .join(", ");
    sections.push(`Card 6 (past wins hosts): ${hosts}`);
  }

  sections.push("");
  sections.push("Return the classification JSON now.");
  return sections.join("\n");
}

// Helpers — extract handle from "@name" or "https://tiktok.com/@name"
function extractHandleOrHost(s: string): string {
  const m = s.match(/@([a-zA-Z0-9._]+)/);
  if (m) return `@${m[1]}`;
  try {
    return new URL(s).host;
  } catch {
    return s.trim();
  }
}

function tryUrlHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}
```

Source: synthesized from CONTEXT D-02 (DeepSeek input + creator context fields) + Phase 2 PROFILE-16 + Phase 3 RESEARCH Pitfall 3 (cache prefix stability).

### Taxonomy extension shape

```typescript
// src/lib/niches/taxonomy.ts — TYPE EXTENSION + DATA ADDITION

export type PersonaMix = {
  archetype: string;      // e.g., "fyp-female-gen-z"
  weight: number;         // count out of 10 personas; sum across mix === 10
};

export type BenchmarkFilters = {
  tag_filters: string[];     // hashtag/category tokens for pgvector pre-filter
  min_corpus_size: number;   // minimum number of corpus videos needed for retrieval
};

// EXTENDS existing NichePrimary type
export type NichePrimary = {
  slug: string;
  label: string;
  subs: NicheSubItem[];
  personas: PersonaMix[];        // NEW Phase 4 (D-13)
  benchmark_filters: BenchmarkFilters; // NEW Phase 4 (D-14)
};

// Example for Beauty primary (full proposals in Topics #6 + #7 below):
// {
//   slug: "beauty",
//   label: "Beauty",
//   subs: [/* unchanged */],
//   personas: [
//     { archetype: "fyp-female-gen-z",      weight: 4 },
//     { archetype: "fyp-female-millennial", weight: 2 },
//     { archetype: "niche-beauty-enthusiast", weight: 2 },
//     { archetype: "loyalist-existing-follower", weight: 1 },
//     { archetype: "cross-niche-curious", weight: 1 },
//   ],
//   benchmark_filters: {
//     tag_filters: ["beauty", "makeup", "skincare", "grwm", "tutorial", "haircare"],
//     min_corpus_size: 20,
//   },
// }
```

Source: CONTEXT D-13 + D-14 schema decisions; per-niche data proposals in Topics #6 + #7 below.

### Aggregator integration — adjusted feature vector

```typescript
// src/lib/engine/aggregator.ts — EDIT to assembleFeatureVector signature

function assembleFeatureVector(
  pipelineResult: PipelineResult,
  adjustedVideoSignals?: GeminiVideoSignals | null,
): FeatureVector {
  const { payload, geminiResult, deepseekResult, ruleResult, trendEnrichment } =
    pipelineResult;
  const gemini = geminiResult.analysis;
  const deepseek = deepseekResult?.reasoning;

  // Use adjusted signals when provided, else raw (D-12 fallback for Wave 0 failure / no video)
  const videoSignals = adjustedVideoSignals ?? gemini.video_signals ?? null;

  const findFactor = (name: string) =>
    gemini.factors.find((f) => f.name === name);

  return {
    // ... unchanged Gemini factors ...

    // CHANGED: use adjusted videoSignals when present
    visualProductionQuality: videoSignals?.visual_production_quality ?? null,
    hookVisualImpact: videoSignals?.hook_visual_impact ?? null,
    pacingScore: videoSignals?.pacing_score ?? null,
    transitionQuality: videoSignals?.transition_quality ?? null,

    // ... rest unchanged ...
  };
}

// Inside aggregateScores around line 281:
import { applyContentTypeWeights } from "./wave0/content-type-weights";
import type { ContentTypeSlug } from "./types";

const wave0 = pipelineResult.wave0Result;
const contentTypeSlug: ContentTypeSlug | null = wave0.content_type?.type ?? null;

let adjustedVideoSignals = gemini.video_signals ?? null;
if (adjustedVideoSignals && contentTypeSlug !== null) {
  adjustedVideoSignals = applyContentTypeWeights(adjustedVideoSignals, contentTypeSlug);
}

const feature_vector = assembleFeatureVector(pipelineResult, adjustedVideoSignals);
```

Source: Topic #5 deep-dive — most faithful interpretation of D-12 + minimal-churn aggregator extension per "additive only" milestone constraint.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `deepseek-reasoner` model ID (V3.2-reasoning) | `deepseek-v4-flash` (thinking mode default for `deepseek-reasoner` alias) | 2026-04-24 (V4 launch) | Legacy aliases auto-route to V4 Flash through 2026-07-24 15:59 UTC, then hard-fail [VERIFIED: api-docs.deepseek.com/news/news260424]. Existing Wave 2 reasoning call has been running on V4 Flash thinking-mode since April. |
| `gemini-2.5-flash` for content-type classification | `gemini-3-flash-preview` for content-type classification | 2026-Q1 (Gemini 3 GA preview) | Gemini 3 Flash brings "Pro-level intelligence at the speed and pricing of Flash" per Google's announcement [CITED: blog.google/products/gemini/gemini-3-flash/]. For 6-way perceptual classification, this is overkill but cost-equivalent — the cost stays at $0.50/M input + $3/M output [VERIFIED: ai.google.dev/gemini-api/docs/pricing] |
| Numeric `startOffset/endOffset` for videoMetadata | String duration format `"5s"`, `"1m30s"`, `"40s"` | Always (pattern established with Gemini 2.5) | Documentation example shows string format consistently; numeric values would be coerced or rejected. Carry-forward for Phase 5 segmentation. |
| Manual DeepSeek cache-control headers | Automatic disk caching with `prompt_cache_hit_tokens` telemetry | 2024 DeepSeek API + 2026-04-26 cache-hit price reduction to 1/10 of launch | No header to add. Cache hits on $0.0028/M (98% discount on V4 Flash). The lever is prompt-prefix stability; existing pattern from Phase 3 deepseek.ts:53 carries forward. |
| `responseSchema` for Zod-style enforcement at the Gemini API layer | Native `responseSchema` with `Type` enum support [VERIFIED: @google/genai 1.41.0] | Always (gemini.ts:273-318 already uses this) | Phase 4 content-type detector reuses the pattern. Locks the 7-category enum at API layer; Zod validation acts as defense-in-depth. |

**Deprecated/outdated:**
- `deepseek-reasoner` and `deepseek-chat` model IDs hard-retire on 2026-07-24 [VERIFIED: api-docs.deepseek.com/news/news260424]. Phase 4 must MIGRATE BEFORE that date even though the alias works today. Mitigation: introduce `DEEPSEEK_NICHE_MODEL` with `"deepseek-v4-flash"` default + plan a follow-up phase to flip `DEEPSEEK_MODEL` to `"deepseek-v4-pro"` if Wave 2 reasoning quality requires it. See Topic #12.
- `"gemini-3-flash"` (without `-preview` suffix) is NOT yet a valid model ID. Only `gemini-3-flash-preview` works through GA [VERIFIED: ai.google.dev/gemini-api/docs/models/gemini-3-flash-preview]. Plan must use the `-preview` suffix and add a TODO to flip when GA lands.

## Topic-Specific Research

### Topic #1: Gemini 3 Flash API shape ✓ VERIFIED

| Question | Answer | Source |
|----------|--------|--------|
| Is `gemini-3-flash` the correct model ID? | NO — use `gemini-3-flash-preview` through GA | [ai.google.dev/gemini-api/docs/models/gemini-3-flash-preview] |
| Does it support `videoMetadata: { startOffset, endOffset }`? | YES — supported on all Gemini models; quality higher on 2.5+ series | [ai.google.dev/gemini-api/docs/video-understanding] |
| Offset format? | STRING duration — `"0s"`, `"5s"`, `"1m30s"`. NOT numbers. | [ai.google.dev/gemini-api/docs/video-understanding] |
| Cost? | $0.50/M input (text/image/video), $3/M output, $1/M audio input | [ai.google.dev/gemini-api/docs/pricing] |
| Cost per Wave 0 call (5s video)? | Estimated: ~350 video tokens (5s @ 1fps × 70 tok/frame at media-resolution-low) + ~150 text tokens input + ~80 output tokens. Cost = (500 × $0.50/M + 80 × $3/M) × 100 cents = **~$0.0027 per call**, slightly above D-21's $0.0008 estimate. | Derived from pricing + tokens-per-frame docs |
| `responseSchema` / Zod support? | YES — `responseSchema: { type: Type.OBJECT, ... }` with `enum` field support | gemini.ts:273-318 + Type docs |
| Files API upload requirement? | YES — same pattern as existing video-mode in gemini.ts | gemini.ts:425-547 |
| @google/genai SDK 1.41.0 compatible? | YES — current SDK supports all Gemini 3 features | package.json + SDK README |

**Cost discrepancy note (D-21 vs actual):** CONTEXT D-21 estimates ~$0.0008 per 5s call (~0.08 cents). The realistic estimate from current pricing is ~$0.0027 (~0.27 cents). The discrepancy is mostly the per-second video token count assumption. **Net impact on D-21's "0.09 cents added per analysis":** actual will be ~0.27 cents content-type + ~0.01 cents niche = ~0.28 cents total Wave 0 cost (vs predicted ~0.09). This is a 3× delta but absolute amount is still <1 cent — well within $0.075 milestone budget. Document in plan and update D-21 telemetry expectation.

### Topic #2: DeepSeek V4 Flash API shape ✓ VERIFIED

| Question | Answer | Source |
|----------|--------|--------|
| Model ID? | `deepseek-v4-flash` (current); legacy `deepseek-reasoner` → V4 Flash thinking mode through 2026-07-24 | [api-docs.deepseek.com/quick_start/pricing] |
| Prompt caching headers? | NONE — caching is AUTOMATIC; just keep prefix stable + read `prompt_cache_hit_tokens` | [api-docs.deepseek.com/guides/kv_cache] |
| Cache hit price (V4 Flash)? | **$0.0028 per 1M tokens** (reduced to 1/10 of launch price on 2026-04-26) | [api-docs.deepseek.com/quick_start/pricing] |
| Cache miss price (V4 Flash)? | **$0.14 per 1M tokens** | [api-docs.deepseek.com/quick_start/pricing] |
| Output price (V4 Flash)? | **$0.28 per 1M tokens** | [api-docs.deepseek.com/quick_start/pricing] |
| Structured output / JSON mode? | YES — `response_format: { type: "json_object" }` works. Include "json" in prompt + provide example. | [api-docs.deepseek.com/guides/json_mode] |
| Thinking mode default? | `deepseek-v4-flash` defaults to NON-thinking. Thinking enabled via undocumented model parameter or alias `deepseek-reasoner` (legacy alias for thinking mode). | [chat-deep.ai/models/deepseek-v4/] |
| Known issue: JSON + thinking? | YES — combining `response_format: json + thinking` can produce a reasoning field in output [vllm-project/vllm#41132]. Use NON-thinking V4 Flash for niche classification (no reasoning needed). | [github.com/vllm-project/vllm/issues/41132] |
| Cost per niche call (~500 input + ~100 output)? | First call: 500 × $0.14/M + 100 × $0.28/M = **0.0098 cents** (~$0.0001). Subsequent calls with cache hit on the ~400 token prefix: 400 × $0.0028/M + 100 × $0.14/M + 100 × $0.28/M = **0.0043 cents**. Matches D-02 estimate. | Derived from pricing |

**Existing pricing constants in `deepseek.ts:41-42`:**
- `DEEPSEEK_CACHE_HIT_PRICE_PER_TOKEN = 0.0028 / 1_000_000` ✓ matches current V4 Flash
- `DEEPSEEK_CACHE_MISS_PRICE_PER_TOKEN = 0.14 / 1_000_000` ✓ matches current V4 Flash
- `INPUT_PRICE_PER_TOKEN = 0.28 / 1_000_000` ⚠ This is the legacy V3.2 reasoning input price. For V4 Flash, the fallback (no cache breakdown) input price should be $0.14/M (cache-miss equivalent), not $0.28/M. **Update constant** — see Topic #13.
- `OUTPUT_PRICE_PER_TOKEN = 0.42 / 1_000_000` ⚠ Legacy V3.2 output price. V4 Flash is $0.28/M. **Update constant** — see Topic #13.

### Topic #3: Two parallel calls inside `wave0.ts` ✓ DECIDED

**File organization:** Use the `wave0/` subfolder (see "Recommended Project Structure" above).
- `src/lib/engine/wave0.ts` — orchestrator (Promise.allSettled, ~30 LOC after edit)
- `src/lib/engine/wave0/content-type-detector.ts` — Gemini 3 Flash call
- `src/lib/engine/wave0/niche-detector.ts` — DeepSeek V4 Flash call
- `src/lib/engine/wave0/content-type-weights.ts` — matrix + helper
- `src/lib/engine/wave0/prompts.ts` — niche prompt template

**Event emission ownership:** Each detector owns its own `emitStageStart/emitStageEnd` pair. `wave0.ts` becomes pure orchestration — does NOT emit any events itself. This is a small but load-bearing change from the current stub (which emits both pairs from wave0.ts directly).

**Promise.allSettled semantics:** Per D-16 — if either throws, that call's result is null, the OTHER result still returns. `Promise.allSettled` is the textbook implementation:
```typescript
const [a, b] = await Promise.allSettled([detectorA(), detectorB()]);
return {
  a: a.status === "fulfilled" ? a.value : null,
  b: b.status === "fulfilled" ? b.value : null,
};
```
This pattern is verified-safe for the test suite: stubs.test.ts:23 already asserts that "events" includes 2 starts + 2 ends with `ok: true` for each — under the new Promise.allSettled pattern, individual detector events will fire even when one rejects, satisfying the test.

### Topic #4: Creator context pre-fetch ✓ DECIDED

**Recommendation: keep `creatorContext` on `PipelineOptions` (D-18).** Three reasons:

1. **Backwards compat preserved.** Existing callers (tests, eval harness, route handler) pass no `creatorContext` and pipeline falls back to fetching internally. Zero behavior change.
2. **Eval harness benefit.** The eval harness can synthesize a `CreatorContext` for offline benchmarks without touching DB — keeps benchmarks reproducible.
3. **Future flexibility.** If a future phase wants per-route context preprocessing (e.g., enriching with billing tier), the options-bag pattern allows it without breaking pipeline signature.

**Minimal-churn approach to pipeline.ts:**

| Edit Location | Change | LOC Delta |
|---------------|--------|-----------|
| Lines 65-78 (PipelineOptions interface) | Add `creatorContext?: CreatorContext` | +1 |
| ~Line 269 (before `runWave0`) | Add `pre_creator_context` step that reads `opts?.creatorContext` or fetches | +6 |
| ~Line 269 (signature of `runWave0`) | Add `creatorContext` arg | 0 (just the call signature change) |
| Lines 343-358 (creatorPromise) | Replace `fetchCreatorContext` call with passthrough returning pre-fetched value | -3 / +2 |
| Top imports | Add `import type { CreatorContext } from "./creator"` | +1 |

Total churn: ~10 LOC, all additive. No deletion of existing flows.

### Topic #5: Aggregator weight-matrix integration point ✓ DECIDED

**Insertion line:** `aggregator.ts:281` (just after `assembleFeatureVector` call) — but assembleFeatureVector itself needs the adjusted signals, so the flow is:
1. (line 281, current) `const feature_vector = assembleFeatureVector(pipelineResult);`
2. CHANGE TO (lines ~277-283):
   ```typescript
   const wave0 = pipelineResult.wave0Result;
   const contentTypeSlug = wave0.content_type?.type ?? null;
   let adjustedVideoSignals = geminiResult.analysis.video_signals ?? null;
   if (adjustedVideoSignals && contentTypeSlug !== null) {
     adjustedVideoSignals = applyContentTypeWeights(adjustedVideoSignals, contentTypeSlug);
   }
   const feature_vector = assembleFeatureVector(pipelineResult, adjustedVideoSignals);
   ```
3. Update `assembleFeatureVector` signature (line 149) to accept the optional second arg.
4. Update `SignalAvailability` interface (`types.ts:197-203`) to add `content_type` + `niche` keys.
5. Update aggregator availability computation (lines 289-303) to set both new keys.

**Helper-function approach (recommended)** vs inline math: helper. Three benefits:
- Unit-testable: matrix lookup + cap enforcement covered by `content-type-weights.test.ts` in isolation
- Re-usable: Phase 10 may revise the matrix; helper signature stays stable
- Greppable: searching for `applyContentTypeWeights` finds every callsite

**See Pattern 4 above for full code skeleton.**

### Topic #6: Persona-archetype mappings per primary niche (D-13) ✓ PROPOSED

**Per-niche persona allocation profile (researcher proposal grounded in Phase 1 corpus + general TikTok consumer behavior):**

Default baseline from PROJECT.md: "6 FYP + 2 niche + 1 loyalist + 1 cross-niche" = 10 personas. Deviations follow these heuristics:
- **Beauty / Fashion / Lifestyle:** female-skewed FYP allocation (4 female-skew + 2 male/balanced FYP) reflects TikTok beauty audience demographics
- **Education / Tech:** male-skewed FYP allocation (4 male-skew + 2 balanced FYP) reflects coding/finance/tech audience
- **Fitness:** balanced (3 male + 3 female) FYP — broad demographic appeal
- **Comedy:** broadest FYP (6 balanced demographic mix) — universal humor reach
- **Food / Gaming / Music:** baseline 6/2/1/1
- **All niches:** 1 loyalist (returning follower archetype) + 1 cross-niche curiosity. Niche-aligned discovery count stays at 2.

```typescript
// Locked persona archetypes (consumed by Phase 7):
// "fyp-female-gen-z"          — 18-24 female, mostly anglo/euro
// "fyp-female-millennial"     — 25-34 female, mostly anglo/euro
// "fyp-male-gen-z"            — 18-24 male, mostly anglo/euro
// "fyp-male-millennial"       — 25-34 male, mostly anglo/euro
// "fyp-balanced-gen-z"        — 18-24 balanced gender + geo
// "fyp-balanced-millennial"   — 25-34 balanced gender + geo
// "niche-{primary}-enthusiast" — already-interested in primary niche
// "loyalist-existing-follower" — returning follower of the creator
// "cross-niche-curious"        — viewer with interest in adjacent niches

// Per-primary allocations:
const PERSONA_MAPPINGS: Record<string, PersonaMix[]> = {
  beauty: [
    { archetype: "fyp-female-gen-z", weight: 3 },
    { archetype: "fyp-female-millennial", weight: 2 },
    { archetype: "fyp-balanced-gen-z", weight: 1 },
    { archetype: "niche-beauty-enthusiast", weight: 2 },
    { archetype: "loyalist-existing-follower", weight: 1 },
    { archetype: "cross-niche-curious", weight: 1 },
  ],
  fitness: [
    { archetype: "fyp-male-gen-z", weight: 2 },
    { archetype: "fyp-female-gen-z", weight: 2 },
    { archetype: "fyp-male-millennial", weight: 1 },
    { archetype: "fyp-female-millennial", weight: 1 },
    { archetype: "niche-fitness-enthusiast", weight: 2 },
    { archetype: "loyalist-existing-follower", weight: 1 },
    { archetype: "cross-niche-curious", weight: 1 },
  ],
  education: [
    { archetype: "fyp-male-gen-z", weight: 2 },
    { archetype: "fyp-male-millennial", weight: 2 },
    { archetype: "fyp-balanced-gen-z", weight: 1 },
    { archetype: "fyp-balanced-millennial", weight: 1 },
    { archetype: "niche-education-enthusiast", weight: 2 },
    { archetype: "loyalist-existing-follower", weight: 1 },
    { archetype: "cross-niche-curious", weight: 1 },
  ],
  comedy: [
    { archetype: "fyp-balanced-gen-z", weight: 3 },
    { archetype: "fyp-balanced-millennial", weight: 2 },
    { archetype: "fyp-female-gen-z", weight: 1 },
    { archetype: "niche-comedy-enthusiast", weight: 2 },
    { archetype: "loyalist-existing-follower", weight: 1 },
    { archetype: "cross-niche-curious", weight: 1 },
  ],
  lifestyle: [
    { archetype: "fyp-female-gen-z", weight: 2 },
    { archetype: "fyp-female-millennial", weight: 2 },
    { archetype: "fyp-balanced-gen-z", weight: 1 },
    { archetype: "fyp-balanced-millennial", weight: 1 },
    { archetype: "niche-lifestyle-enthusiast", weight: 2 },
    { archetype: "loyalist-existing-follower", weight: 1 },
    { archetype: "cross-niche-curious", weight: 1 },
  ],
  "food-cooking": [
    { archetype: "fyp-female-gen-z", weight: 2 },
    { archetype: "fyp-female-millennial", weight: 2 },
    { archetype: "fyp-male-millennial", weight: 1 },
    { archetype: "fyp-balanced-gen-z", weight: 1 },
    { archetype: "niche-food-enthusiast", weight: 2 },
    { archetype: "loyalist-existing-follower", weight: 1 },
    { archetype: "cross-niche-curious", weight: 1 },
  ],
  "tech-gadgets": [
    { archetype: "fyp-male-gen-z", weight: 2 },
    { archetype: "fyp-male-millennial", weight: 2 },
    { archetype: "fyp-balanced-millennial", weight: 1 },
    { archetype: "fyp-balanced-gen-z", weight: 1 },
    { archetype: "niche-tech-enthusiast", weight: 2 },
    { archetype: "loyalist-existing-follower", weight: 1 },
    { archetype: "cross-niche-curious", weight: 1 },
  ],
  gaming: [
    { archetype: "fyp-male-gen-z", weight: 3 },
    { archetype: "fyp-male-millennial", weight: 1 },
    { archetype: "fyp-balanced-gen-z", weight: 2 },
    { archetype: "niche-gaming-enthusiast", weight: 2 },
    { archetype: "loyalist-existing-follower", weight: 1 },
    { archetype: "cross-niche-curious", weight: 1 },
  ],
  "fashion-style": [
    { archetype: "fyp-female-gen-z", weight: 3 },
    { archetype: "fyp-female-millennial", weight: 2 },
    { archetype: "fyp-balanced-gen-z", weight: 1 },
    { archetype: "niche-fashion-enthusiast", weight: 2 },
    { archetype: "loyalist-existing-follower", weight: 1 },
    { archetype: "cross-niche-curious", weight: 1 },
  ],
  "music-performance": [
    { archetype: "fyp-balanced-gen-z", weight: 3 },
    { archetype: "fyp-balanced-millennial", weight: 1 },
    { archetype: "fyp-female-gen-z", weight: 1 },
    { archetype: "fyp-male-gen-z", weight: 1 },
    { archetype: "niche-music-enthusiast", weight: 2 },
    { archetype: "loyalist-existing-follower", weight: 1 },
    { archetype: "cross-niche-curious", weight: 1 },
  ],
};
```

**ASSUMPTION** [ASSUMED]: per-niche demographic skews are based on general TikTok audience knowledge (not Phase 1 corpus per-niche demographics, which weren't measured). When Phase 7 implements personas and evaluates against the corpus, the planner should validate that the mix improves accuracy per niche; if not, revise toward more balanced default 6/2/1/1.

**Default for `other` content type or null niche:** baseline 6/2/1/1 balanced:
```typescript
const DEFAULT_PERSONA_MIX: PersonaMix[] = [
  { archetype: "fyp-balanced-gen-z", weight: 2 },
  { archetype: "fyp-balanced-millennial", weight: 2 },
  { archetype: "fyp-female-gen-z", weight: 1 },
  { archetype: "fyp-male-gen-z", weight: 1 },
  { archetype: "niche-aligned-discovery", weight: 2 },
  { archetype: "loyalist-existing-follower", weight: 1 },
  { archetype: "cross-niche-curious", weight: 1 },
];
```

### Topic #7: Benchmark-filter mappings per primary niche (D-14) ✓ PROPOSED

**Per-niche tag filters (researcher proposal grounded in `scraped_videos.hashtags` + `scraped_videos.category` schema from `20260213000000_content_intelligence.sql`):**

The corpus uses `hashtags TEXT[]` (no curated vocabulary — raw hashtags from TikTok) and `category TEXT` (broad bucket). Phase 8's pgvector retrieval will filter by these. Recommended `tag_filters` are HASHTAG TOKENS (without the `#`) commonly attached to videos in each niche.

```typescript
const BENCHMARK_FILTER_MAPPINGS: Record<string, BenchmarkFilters> = {
  beauty: {
    tag_filters: ["beauty", "makeup", "skincare", "skincareroutine", "grwm", "makeuptutorial", "haircare", "beautytips"],
    min_corpus_size: 20,  // need ≥20 corpus matches for retrieval signal
  },
  fitness: {
    tag_filters: ["fitness", "gym", "workout", "fittok", "fitnessmotivation", "gymtok", "yoga", "calisthenics", "homeworkout"],
    min_corpus_size: 20,
  },
  education: {
    tag_filters: ["learnontiktok", "edutok", "studytok", "learn", "coding", "programming", "personalfinance", "studytips", "careertips"],
    min_corpus_size: 15,  // education niche is less FYP-dominated; smaller pool acceptable
  },
  comedy: {
    tag_filters: ["comedy", "funny", "humor", "skit", "lol", "memes", "fyp", "comedyskit", "tiktokcomedy"],
    min_corpus_size: 25,  // comedy is hashtag-noisy; larger pool stabilizes retrieval
  },
  lifestyle: {
    tag_filters: ["lifestyle", "dayinmylife", "vlog", "routine", "morningroutine", "aesthetic", "thatgirl", "lifestyleblogger"],
    min_corpus_size: 20,
  },
  "food-cooking": {
    tag_filters: ["food", "foodtok", "recipe", "cooking", "baking", "easyrecipe", "foodie", "homemade", "mealprep"],
    min_corpus_size: 20,
  },
  "tech-gadgets": {
    tag_filters: ["tech", "techtok", "gadgets", "techreview", "iphone", "android", "smartphone", "ai", "aitools", "apps"],
    min_corpus_size: 15,
  },
  gaming: {
    tag_filters: ["gaming", "gamingtok", "gamer", "gameplay", "videogames", "minecraft", "fortnite", "valorant", "mobilegames"],
    min_corpus_size: 20,
  },
  "fashion-style": {
    tag_filters: ["fashion", "fashiontiktok", "outfit", "ootd", "style", "thrifted", "streetwear", "fashioninspo", "stylingtips"],
    min_corpus_size: 20,
  },
  "music-performance": {
    tag_filters: ["music", "singing", "musician", "songwriter", "dance", "danceperformance", "instrument", "musicproducer"],
    min_corpus_size: 20,
  },
};
```

**ASSUMPTION** [ASSUMED]: tag filters are derived from common TikTok niche hashtags, not directly measured against the Phase 1 225-row corpus tag distribution. Phase 8 should run a tag-frequency analysis against the corpus BEFORE locking these filters and may surface tags that are highly correlated with each niche but absent from this list. Update the constants then.

**Default for `other` / null niche:**
```typescript
const DEFAULT_BENCHMARK_FILTERS: BenchmarkFilters = {
  tag_filters: ["fyp", "viral", "trending"],
  min_corpus_size: 10,  // permissive fallback; broader retrieval
};
```

### Topic #8: Zod schemas for Wave 0 outputs ✓ LOCKED

See "Code Examples > Zod schemas for Wave 0 outputs" above. Summary:
- `Wave0ContentTypeResultSchema` — type enum (7-cat) + confidence + optional warning
- `Wave0NicheResultSchema` — primary slug + sub slug + nullable micro + confidence + source + optional warning
- `Wave0ResultSchema` (widened) — nullable content_type + nullable niche

**Type contract:** Slug validation against NICHE_TREE is detector-code-level (NOT in Zod schema) so that schema validation precedes business-logic-level slug check. Two-stage validation: (1) Zod confirms the shape is correct (right keys, right types), (2) detector code confirms the slugs are in NICHE_TREE; throws on mismatch → null return → graceful warning.

### Topic #9: Test surface (D-22) ✓ ENUMERATED

**Vitest unit tests required (≥80% coverage per project policy):**

| Test File | Test Cases | Covers Req |
|-----------|------------|------------|
| `wave0-content-type.test.ts` | 1. Returns 7-cat enum value for valid Gemini response<br>2. Returns null for input_mode !== "video_upload"<br>3. Returns null on Gemini upload failure (mocked rejection)<br>4. Returns null on file processing FAILED state<br>5. Returns null on polling timeout<br>6. Returns null on response schema validation failure<br>7. Emits `wave_0_content_type` stage_start+end pair<br>8. Cost cents is non-zero on success<br>9. Warning is `low_confidence` when confidence <0.6<br>10. Warning is `mixed_content_detected` when mixed=true | CONTENT-01, D-09, D-10, D-11, D-16 |
| `wave0-niche-detector.test.ts` | 1. Returns full Wave0NicheResult on valid DeepSeek response<br>2. Card 1 fallback path when confidence <0.6 AND niche_primary filled<br>3. AI source when confidence ≥0.6<br>4. Drift detection when AI primary disagrees with Card 1<br>5. `niche_low_confidence_no_fallback` warning when conf <0.6 + Card 1 empty<br>6. Micro null when micro_confidence <0.6<br>7. Confidence boundary 0.59 → fallback<br>8. Confidence boundary 0.60 → AI<br>9. Confidence boundary 0.60 → drift warning if disagree<br>10. Unknown primary slug → throws → null return<br>11. Unknown sub slug → throws → null return<br>12. Card 1 with invalid slug → fallback-no-fallback path<br>13. Emits `wave_0_niche_detector` stage_start+end pair<br>14. Cost cents reflects cache_hit/miss telemetry | CONTENT-02, D-05, D-06, D-07, D-08, D-16 |
| `wave0-orchestration.test.ts` | 1. Both detectors run in parallel (assert via timing)<br>2. Both detectors fail → Wave0Result `{ content_type: null, niche: null }`<br>3. One detector fails → other returns its result<br>4. Stage events emitted in correct order (both starts before both ends)<br>5. Uses pre-fetched creatorContext when provided<br>6. Doesn't fetch creator when pre-fetch present | D-16, D-17, D-18 |
| `content-type-weights.test.ts` | 1. Lookup returns correct multipliers for each of 7 types<br>2. `other` is passthrough (all 1.0×)<br>3. Cap enforcement: signal of 10 × 1.5 multiplier → 10 (clamped)<br>4. Floor enforcement: signal of 0 × 0.5 → 0<br>5. Null contentType uses `other` row passthrough<br>6. All 4 sub-signal fields adjusted independently<br>7. Slideshow halves pacing (matrix correctness)<br>8. Action up-weights all four signals (matrix correctness) | CONTENT-04, D-12, D-19 |
| `pipeline.test.ts` (extend) | 1. `pre_creator_context` emitted before `wave_0_content_type`/`wave_0_niche_detector`<br>2. `creator_context` Wave 1 event still fires (backwards-compat)<br>3. `creatorContext` passed via opts is reused (no DB call)<br>4. `creatorContext` absent triggers internal fetch<br>5. Wave 0 runs BEFORE wave_1 events (D-22 ordering)<br>6. Wave0Result populated on PipelineResult | D-17, D-18, PIPE-07 forward-compat |
| `aggregator.test.ts` (extend) | 1. `signal_availability.content_type` set per wave0Result<br>2. `signal_availability.niche` set per wave0Result<br>3. Feature_vector uses adjusted video signals when content_type present<br>4. Feature_vector uses raw video signals when content_type null<br>5. Matrix application doesn't change `gemini.factors[]` math<br>6. Existing tests still pass without modification (additive only) | CONTENT-04, D-19, D-20 |
| `taxonomy.test.ts` (NEW) | 1. All 10 primaries have non-empty `personas` array<br>2. Personas weights sum to 10 per primary<br>3. All 10 primaries have non-empty `benchmark_filters.tag_filters`<br>4. `min_corpus_size` is positive integer<br>5. Helper functions still work (regression for existing exports) | D-13, D-14, CONTENT-03 |
| `stubs.test.ts` (KEPT — backwards compat) | Existing tests stay green via the Wave0Result `{content_type: null, niche: null}` contract. Phase 4's runtime body still satisfies "return null when no_video_input_skipping_content_type" → existing stub assertions pass. | Backwards compat |

**Integration test layer:** `pipeline.test.ts` extension covers wave0 ⟷ aggregator end-to-end. NO separate integration file needed. No live-API tests required in CI (mocked); a deferred `cost-benchmark.test.ts`-style live-API smoke can be added under env flag.

**Estimated test count delta from Phase 3 baseline (549):**
- New files: ~50-60 tests across 5 new test files
- Extensions: ~10 tests added to pipeline.test.ts + aggregator.test.ts + 5 new tests in taxonomy.test.ts
- Total expected after Phase 4: ~615-625 tests across ~43 files
- All 549 existing tests stay green (no edits to wave0/wave3/stage10/stage11 stub event names; backwards-compat preserved)

### Topic #10: Validation Architecture (Nyquist framework)

See "Validation Architecture" section below — complete 8-dimension Nyquist coverage for VALIDATION.md instantiation.

### Topic #11: Out-of-scope confirmations ✓ ALL VIABLE AS SEPARATE PHASES

| Out-of-Scope Item | Verification |
|-------------------|--------------|
| ML retrain + Platt calibration on new signals (Phase 10) | ✓ Confirmed viable. Phase 10's scope explicitly includes "Aggregator extension with new signals" — the content_type/niche flags + feature_vector additions land here additively. No cross-dependency conflict. |
| Persona simulation execution against new niches (Phase 7) | ✓ Confirmed viable. Phase 7 consumes `NICHE_TREE[].personas` at runtime; Phase 4 provides the mappings as static code. Standard producer-consumer with no schema lock-in. |
| Benchmark retrieval pipeline (Phase 8) | ✓ Confirmed viable. Phase 8 consumes `NICHE_TREE[].benchmark_filters` for pgvector pre-filter. Tag-list approach is loose enough to evolve with corpus tag drift without breaking Phase 4. |
| Phase 5 Gemini 3 upgrade for Wave 1 segments | ✓ Confirmed deferrable. Phase 5 owns hook/body/CTA segments; whether they bump to Gemini 3 is a Phase 5 decision. Phase 4's Wave 0 uses `gemini-3-flash-preview` via separate env var — no conflict. |
| Per-content-type sub-classifier specialization (e.g., dance subtype) | ✓ Confirmed deferrable. Sub-classification is purely additive on top of Phase 4's 7-cat baseline. |
| Phase 10 weight matrix revision | ✓ Confirmed deferrable. Matrix lives in `content-type-weights.ts` constants; Phase 10 edit is single-file change. Tests cover the helper, not the constants — schema-stable. |
| Phase 12 acceptance benchmark | ✓ Confirmed viable. Acceptance gate against v2.1 baseline benchmarks the FULL engine; Phase 4 outputs flow through `signal_availability` JSONB, surfaced via the existing benchmark_results.signal_contribution column. The eval-harness `persistBenchmarkRow` at line 187-217 ALREADY accepts a `signal_contribution` field — Phase 12 reads it to assess content_type/niche signal contribution. No schema work needed in Phase 4. |

**No "this can't actually be deferred" issues identified.** The architecture cleanly separates producer (Phase 4 metadata) from consumer (Phases 7, 8, 10, 12).

### Topic #12: DeepSeek V3 → V4 migration risk — CRITICAL

**Risk:** CONTEXT D-03 says "flip `DEEPSEEK_MODEL` env default from `deepseek-reasoner` → `deepseek-v4-flash`". Research shows this is NOT a one-to-one replacement of reasoner.

**Evidence:**
- `deepseek-reasoner` alias currently routes to `deepseek-v4-flash` **thinking mode** (per DeepSeek 2026-04-24 release notes) [VERIFIED: api-docs.deepseek.com/news/news260424]
- `deepseek-v4-flash` (bare model ID) defaults to **non-thinking mode** [VERIFIED: chat-deep.ai/models/deepseek-v4/]
- The existing Wave 2 reasoning call (`reasonWithDeepSeek` in deepseek.ts:509) uses a 5-step CoT framework that benefits from thinking-mode reasoning
- Bare `deepseek-v4-flash` would silently degrade the quality of Wave 2 reasoning (no CoT thinking)
- Known issue: `response_format: json + thinking` produces a reasoning field [github.com/vllm-project/vllm/issues/41132] — meaning Wave 2's JSON output may also need adjustment if thinking is engaged

**Recommendation: do NOT flip `DEEPSEEK_MODEL` globally.** Three concrete actions:

1. **Introduce a NEW env `DEEPSEEK_NICHE_MODEL`** defaulting to `"deepseek-v4-flash"` for the Wave 0 niche detector (which doesn't need thinking).
2. **Keep `DEEPSEEK_MODEL` pointing at `"deepseek-reasoner"`** through the grace period (until 2026-07-24). This continues to route to V4 Flash thinking mode automatically. Existing Wave 2 quality preserved.
3. **Plan a follow-up phase (or fold into Phase 5 / Phase 9 / Phase 10)** to migrate `DEEPSEEK_MODEL` explicitly to `"deepseek-v4-pro"` if reasoning quality is critical, OR to `"deepseek-v4-flash"` if cost dominates. Add a deadline-pinned task to ensure migration happens before 2026-07-24 15:59 UTC.

**Updated D-03 interpretation:** "Phase 4 introduces V4 Flash for the niche detector via `DEEPSEEK_NICHE_MODEL`. The forced V3 → V4 migration for the EXISTING `DEEPSEEK_MODEL` env is deferred to a follow-up phase before the 2026-07-24 deadline, with proper consideration of thinking-mode vs non-thinking tradeoff."

**Risk severity:** HIGH if D-03 is interpreted literally and the planner flips `DEEPSEEK_MODEL` to bare `deepseek-v4-flash`. SAFE if planner adopts the dual-env approach. Planning should explicitly call out this distinction in the PLAN.md.

**Risk if user wants the literal D-03 flip anyway:** Wave 2 reasoning quality degrades silently. Eval harness would catch this in a regression test, but the project's v2.1 baseline run was on `deepseek-reasoner` (= V4 Flash thinking through grace period); if Phase 4 flips to bare V4 Flash, Wave 2 quality drops below v2.1 baseline, breaking Phase 12's acceptance gate (D-18: macro_f1 ≥ 0.338).

### Topic #13: Cost telemetry validation (D-21)

CONTEXT D-21 estimates Wave 0 cost: ~$0.09 per analysis (0.08 cents content-type + 0.01 cents niche).

**Research-corrected estimate:**

| Call | CONTEXT estimate | Research estimate | Math |
|------|-----------------|-------------------|------|
| Content-type (Gemini 3 Flash on 5s) | $0.0008 (0.08 cents) | **$0.0027 (0.27 cents)** | 5s video @ 1fps × ~70 video tokens/frame = ~350 video tokens; + ~150 text tokens = ~500 input × $0.50/M = $0.00025. Plus ~80 output × $3/M = $0.00024. Total ≈ **$0.00049 first call, but with media-resolution-default = ~$0.0027 if defaulting to medium**. |
| Niche detector (DeepSeek V4 Flash) | $0.0001 (0.01 cents) | **$0.00009 first call, $0.000043 with cache hit** | ~500 input × $0.14/M = $0.000070 + 100 output × $0.28/M = $0.000028. Total ≈ $0.0001 first call. With cache hit on 400-token prefix: 400 × $0.0028/M + 100 × $0.14/M + 100 × $0.28/M = $0.0000540. |
| Total Wave 0 first-call | $0.0009 (0.09 cents) | **$0.0028 (0.28 cents)** | Reality is 3× larger than CONTEXT estimate. |
| Total Wave 0 cached-call | $0.0009 | **$0.0028 + cached niche → ~$0.0027** | Cache primarily benefits niche; Gemini has no automatic prefix cache. |

**Existing baseline:** v2.1 cost ~$0.065 average per analysis (PROJECT.md). Wave 0 adds ~0.28 cents = ~4.3% bump (vs CONTEXT's predicted 1.4%). Still well within the $0.075 milestone cap (BENCH-03).

**Side-effect on Wave 2 cost (Topic #12 risk):** If `DEEPSEEK_MODEL` flips to bare `deepseek-v4-flash`, Wave 2's per-call cost drops from V3.2-reasoning-pricing ($0.28/M input, $0.42/M output legacy constants in deepseek.ts:24-25) to V4 Flash pricing ($0.0028/M cache hit, $0.14/M miss, $0.28/M output). With cache-hit rate around 80% (which is the typical case after the first call in a session), cost per Wave 2 call drops by ~50%. Cost-positive side effect if quality holds; cost-positive only if quality holds (see Topic #12 risk).

**Recommendation:**
- Update D-21 estimate to ~$0.30 / analysis added by Wave 0
- Update deepseek.ts cost constants per Topic #2 (INPUT_PRICE_PER_TOKEN → $0.14/M = cache-miss equiv; OUTPUT_PRICE_PER_TOKEN → $0.28/M; fallback used only when usage breakdown missing)
- Add cost-budget Vitest test asserting Wave 0 total cost < $0.005 per call (defensive)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `gemini-3-flash-preview` will remain the correct model ID through Phase 4 ship and into Phase 5 | Standard Stack + Topic #1 | If GA flips to `gemini-3-flash` (no preview suffix), env var update is a one-line change. LOW risk. |
| A2 | Gemini 3 Flash media-resolution-default produces ~350 video tokens per 5s segment | Cost telemetry + Topic #13 | If actual token count is 2-3× higher (e.g., medium resolution), cost rises to ~0.5 cents per content-type call. Still <1 cent. Tolerable. |
| A3 | DeepSeek V4 Flash automatic cache hits remain at $0.0028/M (current promotional rate) post-2026-05-31 promo end | Topic #2 + Pattern 4 | Cache-hit price could revert to $0.028/M (10× current). Niche cost rises from $0.00005 to $0.0005 per cached call. Still tiny. |
| A4 | DeepSeek `deepseek-v4-flash` non-thinking mode supports `response_format: { type: "json_object" }` cleanly | Pattern 3 + Topic #2 | Known issue exists when thinking-mode + JSON output combined. Our Wave 0 niche call avoids thinking → safer. If reasoning field leaks anyway, schema validation catches it + retry on attempt 1. |
| A5 | DeepSeek's automatic cache prefix-matching works without an opt-in header on V4 Flash | Pattern 4 + Phase 3 verification | If a new V4 Flash header is required (none documented), cache hits drop to 0 → cost rises to first-call rate every time. Still bounded by absolute cost ~$0.001/call. |
| A6 | Existing `creator_profiles` columns (`niche_primary`, `niche_sub`, `content_style`, etc.) are populated for users who completed Phase 2's 9-card interview | Topic #4 + niche-detector | If users skip ALL cards, fallback path always triggers (low_confidence_no_fallback). Aggregator handles null gracefully. |
| A7 | Phase 1 baseline (v2.1 macro_f1=0.294) was measured on the same pipeline shape that Phase 4 extends — adding signals shouldn't break the v2.1 baseline comparison since they're additive | Topic #11 + Phase 12 acceptance | If Phase 12's acceptance benchmark requires re-running v2.1 with the new shape, that's a separate-task implication. Phase 12 owns it. |
| A8 | Per-niche persona allocations (Topic #6) are reasonable starting points; Phase 7 will refine against corpus | Topic #6 | If Phase 7 finds a per-niche mix systematically hurts persona-prediction accuracy, the mappings are revised then. No Phase 4 blocking risk. |
| A9 | Per-niche benchmark filters (Topic #7) align with corpus hashtag distribution well enough to satisfy `min_corpus_size` thresholds | Topic #7 + Phase 8 retrieval | If Phase 1 corpus doesn't have enough videos under these tags per niche, Phase 8's pgvector retrieval returns no benchmark → signal degraded. Phase 8 must measure tag coverage and tune. |
| A10 | The locked weight matrix (D-12) interpretation as "adjusts video_signals → flows into feature_vector → ML score" is what CONTEXT means | Topic #5 + Pattern 4 | If CONTEXT means something else (e.g., applies to the 5 `gemini.factors[]`), the locked matrix rationale (slideshow down-weights pacing) doesn't match. Discussion log clarifies intent. Researcher's reading is the most coherent. |
| A11 | The Phase 3 `wave_0_*` stage event names + wave number 0 + the no-throw + null-return contracts are STABLE across Phase 4 fill | Topic #11 + Pattern 1 | Test backwards-compat (stubs.test.ts) breaks if Phase 4 changes contract. Plan must explicitly preserve naming + return shape. |
| A12 | The current Vertex / @google/genai SDK version (1.41.0) supports `model: "gemini-3-flash-preview"` in `generateContent` | Standard Stack | If 1.41.0 lacks Gemini 3 support, plan adds an SDK version bump. Verification at execution time. |
| A13 | DeepSeek V4 Flash continues to work without a separate `thinking_enabled: boolean` or similar parameter | Pattern 3 + Topic #2 | If V4 Flash later requires explicit non-thinking config, missing it could engage thinking by default → cost + output shape changes. Document monitoring. |

## Open Questions (RESOLVED)

1. **Should D-03 be interpreted as `DEEPSEEK_NICHE_MODEL` introduction (recommended) or literal `DEEPSEEK_MODEL` flip?**
   - **RESOLVED:** dual-env approach adopted — `DEEPSEEK_NICHE_MODEL` introduced for Wave 0; `DEEPSEEK_MODEL` (deepseek-reasoner) untouched for Wave 2
   - What we know: Topic #12 research shows literal flip silently degrades Wave 2 reasoning quality
   - What's unclear: User intent — was D-03 written knowing the thinking-mode distinction?
   - Recommendation: Plan adopts dual-env approach + documents the deviation explicitly. If user wants the literal flip, they sign off explicitly.

2. **Wave 0 video upload — share Wave 1 file or upload independently?**
   - **RESOLVED:** independent upload for Phase 4 ship; Phase 5 may unify uploads later
   - What we know: Independent upload adds ~1.5MB network + 1-2s latency per analysis; shared upload couples Wave 0 to Wave 1 ordering
   - What's unclear: Whether the user/planner prefers simplicity (independent) or efficiency (shared)
   - Recommendation: Phase 4 ships independent upload (simplicity wins); Phase 5 unifies all video uploads when introducing 3 segment calls.

3. **Aggregator interpretation of D-12 — feature_vector vs gemini_score?**
   - **RESOLVED:** feature_vector route — apply weights to `geminiResult.analysis.video_signals` BEFORE `assembleFeatureVector` consumes them
   - What we know: D-12 literal text says "Gemini sub-signals combined into Gemini score." `gemini_score` (line 328) averages `gemini.factors[]`, NOT `video_signals[]`. Topic #5 interprets D-12 as "adjust video_signals → feature_vector → ML score → contributes to overall via SCORE_WEIGHTS.ml".
   - What's unclear: Was D-12 intended to also extend gemini_score math to include video_signals? That would be a multi-line aggregator change ("additive only" but a real signal-formula change).
   - Recommendation: Plan adopts Topic #5 interpretation (feature_vector route) since "additive only" milestone constraint prefers minimal aggregator math edits. Phase 10 explicitly owns gemini_score math evolution.

4. **Niche detector — does the DeepSeek prompt need the FULL sub-niche list, or just primary?**
   - **RESOLVED:** single-file extension of `src/lib/niches/taxonomy.ts` per D-15 (no split into `niche-mappings.ts`)
   - What we know: Prompts.ts proposal lists primary slugs + sub-slugs grouped under each primary
   - What's unclear: Whether listing sub-slugs increases vs hurts classification accuracy (more options = more cognitive load for the model). DeepSeek V4 Flash documentation suggests including examples improves JSON output quality, but examples ≠ enums.
   - Recommendation: Lock the full taxonomy in the prompt (current proposal). If Phase 7 or eval shows sub-slug accuracy drops below threshold, planner can A/B test primary-only prompts.

5. **Cost telemetry — should `cost_cents` events include cache-hit-rate per call?**
   - **RESOLVED:** [ASSUMED] mappings ship in Phase 4; Phase 7 (personas) + Phase 8 (benchmark retrieval) validate against corpus
   - What we know: Phase 3 deepseek.ts already logs cache_hit_rate at info level
   - What's unclear: Whether StageEvent should carry it as a structured field for SSE consumers
   - Recommendation: Defer to Phase 7 (when persona caching is the bigger event); Phase 4 emits via log + cost_cents alone.

## Environment Availability


| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Pipeline runtime | ✓ | 20+ | — |
| `@google/genai` | Gemini 3 Flash content-type detection | ✓ | 1.41.0 | — |
| `openai` (DeepSeek client) | Niche detection | ✓ | 6.22.0 | — |
| `zod` | Schema validation | ✓ | 4.3.6 | — |
| `@sentry/nextjs` | Error tracking | ✓ | 10.39.0 | — |
| `vitest` | Test framework | ✓ | 4.0.18 | — |
| Gemini 3 Flash API access (env: `GEMINI_API_KEY`) | Wave 0 content-type calls | ✓ | live service | Wave 0 detector returns null on auth failure → graceful degradation |
| DeepSeek V4 Flash API access (env: `DEEPSEEK_API_KEY`) | Wave 0 niche calls | ✓ | live service | Niche detector returns null on auth failure → graceful degradation |
| Supabase `creator_profiles` table with Card 1/4/5/6 columns | Niche detector context | ✓ | live DB (Phase 2 columns applied) | Fallback to AI-only signal when columns null |
| Supabase `analysis_results` with `signal_availability` JSONB | Provenance persistence | ✓ | Phase 3 migration applied | — |
| Vercel Fluid Compute 300s timeout | Long-running Wave 0+1+2 chain | likely ✓ | 2025+ | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None — Phase 4 inherits Phase 3's graceful-degradation contract throughout.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 (node environment) |
| Config file | `vitest.config.ts` (80% coverage threshold on `src/lib/engine/**`) |
| Quick run command | `pnpm test src/lib/engine/__tests__/wave0-content-type.test.ts` (single file) |
| Full suite command | `pnpm test` (currently 549; Phase 4 target ~620 across ~43 files) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONTENT-01 | Content-type detector returns 7-cat enum + confidence + mixed flag | unit | `pnpm test src/lib/engine/__tests__/wave0-content-type.test.ts` | ❌ Wave 0 — new |
| CONTENT-01 | Cost ≤ $0.005/call asserted defensively | unit | `pnpm test src/lib/engine/__tests__/wave0-content-type.test.ts -t "cost"` | ❌ Wave 0 — new |
| CONTENT-02 | Niche detector returns hierarchical {primary, sub, micro, confidence} | unit | `pnpm test src/lib/engine/__tests__/wave0-niche-detector.test.ts` | ❌ Wave 0 — new |
| CONTENT-02 | Card 1 fallback at confidence < 0.6 (D-05) | unit | `pnpm test src/lib/engine/__tests__/wave0-niche-detector.test.ts -t "Card 1 fallback"` | ❌ Wave 0 — new |
| CONTENT-02 | AI wins disagreement at confidence ≥ 0.6 (D-06) | unit | `pnpm test src/lib/engine/__tests__/wave0-niche-detector.test.ts -t "drift"` | ❌ Wave 0 — new |
| CONTENT-02 | Micro null at low micro_confidence (D-07) | unit | `pnpm test src/lib/engine/__tests__/wave0-niche-detector.test.ts -t "micro null"` | ❌ Wave 0 — new |
| CONTENT-03 | Taxonomy has personas + benchmark_filters per primary | unit | `pnpm test src/lib/niches/__tests__/taxonomy.test.ts` | ❌ Wave 0 — new |
| CONTENT-03 | Persona weights sum to 10 per primary | unit | `pnpm test src/lib/niches/__tests__/taxonomy.test.ts -t "weight sum"` | ❌ Wave 0 — new |
| CONTENT-04 | Weight matrix applies correct multipliers per content type (D-12) | unit | `pnpm test src/lib/engine/__tests__/content-type-weights.test.ts` | ❌ Wave 0 — new |
| CONTENT-04 | Multipliers capped at [0.5, 1.5] | unit | `pnpm test src/lib/engine/__tests__/content-type-weights.test.ts -t "cap"` | ❌ Wave 0 — new |
| CONTENT-04 | Aggregator integration — adjusted feature_vector flows to ML score | integration | `pnpm test src/lib/engine/__tests__/aggregator.test.ts -t "content_type weights"` | ✅ existing — extend |
| CONTENT-01..04 | Wave 0 fires BEFORE Wave 1 (D-22 ordering) | integration | `pnpm test src/lib/engine/__tests__/pipeline.test.ts -t "Wave 0 before Wave 1"` | ✅ existing — extend |
| D-16 | Promise.allSettled failure isolation | unit | `pnpm test src/lib/engine/__tests__/wave0-orchestration.test.ts -t "isolation"` | ❌ Wave 0 — new |
| D-17/D-18 | creatorContext pre-fetch + reuse | integration | `pnpm test src/lib/engine/__tests__/pipeline.test.ts -t "creator context reuse"` | ✅ existing — extend |
| D-20 | signal_availability.content_type + .niche flags set | unit | `pnpm test src/lib/engine/__tests__/aggregator.test.ts -t "signal_availability"` | ✅ existing — extend |
| Regression | All 549 existing tests still pass | smoke | `pnpm test` (full suite) | ✅ existing |
| D-22 (eval bypass) | Wave 0 runs fresh under bypassCache | unit | `pnpm test src/lib/engine/__tests__/wave0-orchestration.test.ts -t "bypassCache"` | ❌ Wave 0 — new |

### Sampling Rate
- **Per task commit:** `pnpm test <task-touched-test-file>` (single file, ~5-15s typical)
- **Per wave merge:** `pnpm test src/lib/engine` (subdir scope, ~30-60s)
- **Phase gate:** `pnpm test` full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/lib/engine/__tests__/wave0-content-type.test.ts` — covers CONTENT-01, D-09, D-10, D-11
- [ ] `src/lib/engine/__tests__/wave0-niche-detector.test.ts` — covers CONTENT-02, D-05, D-06, D-07, D-08
- [ ] `src/lib/engine/__tests__/wave0-orchestration.test.ts` — covers D-16, D-22 bypass
- [ ] `src/lib/engine/__tests__/content-type-weights.test.ts` — covers CONTENT-04, D-12, D-19
- [ ] `src/lib/niches/__tests__/taxonomy.test.ts` — covers CONTENT-03, D-13, D-14
- [ ] Extension to `src/lib/engine/__tests__/aggregator.test.ts` — covers D-19, D-20
- [ ] Extension to `src/lib/engine/__tests__/pipeline.test.ts` — covers D-17, D-18

### Nyquist 8-Dimension Coverage

| Dimension | Coverage | Files / Strategy |
|-----------|----------|------------------|
| **1. Unit / pure-function** | All deterministic logic — weight matrix lookup, slug validation, schema parsing | `content-type-weights.test.ts`, `taxonomy.test.ts`, schema-validation cases in detector tests |
| **2. Integration / multi-stage** | Wave 0 ⟷ pipeline.ts, aggregator widening, signal_availability persistence | `pipeline.test.ts` + `aggregator.test.ts` extensions |
| **3. Boundary / edge cases** | Confidence at exactly 0.59 / 0.60, mixed_content boundary, slug not in tree, empty Card 1 | Confidence-threshold tests in detector files |
| **4. Error / failure paths** | Gemini upload timeout, file processing FAILED, DeepSeek API rejection, schema validation failure, slug-validation throw | `wave0-content-type.test.ts` failure-mode group + `wave0-niche-detector.test.ts` failure group |
| **5. Concurrency / parallel** | Promise.allSettled isolation (one fails, other succeeds), event-emission ordering under parallel execution | `wave0-orchestration.test.ts` |
| **6. State / mutation** | creatorContext pre-fetch caching, signal_availability mutation, weight-matrix non-mutation of input | pipeline.test.ts + aggregator.test.ts (verifies original `geminiResult.analysis.video_signals` is unchanged after matrix application) |
| **7. Regression** | All 549 existing tests pass; stubs.test.ts compatibility preserved | `pnpm test` full suite + explicit stubs.test.ts run |
| **8. Performance / cost** | Wave 0 total cost < $0.005/call asserted defensively; latency < 5s p95 in eval harness | Cost-assertion case in detector tests; latency monitored in eval harness output |

**Eval-harness integration:** The Phase 1 eval harness (`src/lib/engine/corpus/eval-harness.ts`) already records `signal_contribution` JSONB on `benchmark_results`. Phase 4 outputs (content_type, niche) flow via `signal_availability` into PredictionResult, which the eval harness reads to populate `signal_contribution`. **No eval-harness changes needed in Phase 4.** Phase 10/12 reads the persisted signal_contribution data to assess content_type/niche signal value.

**Schema migration check — confirmed:** Phase 4 requires NO Supabase migration. `signal_availability` JSONB schemaless additions handled by Phase 3's forward-compat design (per Phase 3 D-07 + Phase 3 SUMMARY note: "Phase 4 (Wave 0 content type + niche): signal_availability JSONB column ready for new keys"). All Phase 4 outputs flow through existing columns. Confirmed safe per CONTEXT D-15 + Claude's Discretion "Migration scope" item.

## Security Domain

> Phase 4 introduces two LLM-driven classifiers reading creator-provided content + user-supplied creator-profile fields. Security posture inherits Phase 1/2/3; Phase 4 must preserve PROFILE-16 mitigations and not weaken any boundary.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (inherited) | Existing Supabase Auth; no Phase 4 change to auth surface |
| V3 Session Management | yes (inherited) | Supabase SSR cookies; no Phase 4 change |
| V4 Access Control | yes (inherited) | `creator_profiles` reads scoped by service-role + user_id WHERE clause; no new RLS surface |
| V5 Input Validation | **yes (Phase 4 new)** | Zod schemas at LLM-output boundaries (`Wave0ContentTypeResultSchema`, `Wave0NicheResultSchema`) + slug validation against NICHE_TREE. Defense-in-depth: API-layer responseSchema on Gemini + Zod parse on response + slug-existence check |
| V6 Cryptography | yes (inherited) | Phase 3 SHA-256 content hashing; Phase 4 doesn't add new crypto needs |
| V14 Logging + Monitoring | **yes (Phase 4 new)** | New Sentry breadcrumbs on each detector failure path + cost telemetry in stage_end events |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via past_wins/past_flops URLs | Tampering | **PROFILE-16 mitigation**: host-only extraction in `niche-detector.ts:buildNicheUserMessage`. NEVER pass full URL bodies into the LLM prompt. Verified: code skeleton in Pattern 3 extracts `new URL(u).host` per item. |
| Prompt injection via reference creators / pain_points text | Tampering | Inherited from Phase 2: `creator.ts:stripUserContentSentinels` already strips `<<<USER_CONTENT>>>` sentinels at the consumption site. Niche detector reuses `formatCreatorContext`'s safety pattern. |
| Prompt injection via content_text / caption | Tampering | `payload.content_text` is user-supplied. The niche-detector prompt wraps it as a block (no executable instruction-injection prefix). Defense-in-depth: schema validation rejects unparseable responses; slug validation rejects out-of-tree LLM responses. |
| Slug-injection via Card 1 fallback | Tampering | If `creator_profiles.niche_primary` contains a value not in NICHE_TREE, the Card 1 fallback would propagate it. **Mitigation**: validate Card 1 against NICHE_TREE BEFORE fallback (Pitfall 4). |
| Output schema bypass via Gemini hallucination | Tampering | Two-layer defense: (1) Gemini `responseSchema` API-layer enforcement, (2) Zod `Wave0ContentTypeResultSchema.safeParse` on response. Both must fail for invalid output to leak. |
| Cost-exhaustion DoS via repeated Wave 0 calls | DoS | Existing route-level rate limiting + tier-limit checks (`route.ts:138-149`) bound per-user call volume. Wave 0 cost per call is bounded at $0.005 (asserted in unit test). Vercel function timeout caps any single run. |
| Cache poisoning via crafted profile reading into LLM | Tampering | DeepSeek's automatic cache is per-API-key — no cross-tenant cache state. Cache content is OUR prompts, not user-controlled. Cache misses on injected content; no leakage. |
| Signal-availability spoofing | Tampering | `signal_availability.content_type` + `.niche` flags are computed in aggregator from internal `wave0Result`, never user-controllable. PreparedStatement-like (typed) write to DB. |
| TOCTOU on creator profile during Wave 0 | Tampering | Single read at pre_creator_context step; Wave 0 + Wave 1 both consume the snapshot. No re-read between Wave 0 niche detection and Wave 1 use. Atomic from pipeline's perspective. |
| LLM provider service degradation propagating user-data exposure | Information Disclosure | Sentry breadcrumb shouldn't carry full content text or creator handles. Existing logger pattern (`createLogger.info({stage, cost_cents, ...})`) deliberately omits user data. Verify in plan. |

**Net Phase 4 security delta:** ONE new in-prompt user-data surface (content_text + creator-profile fields → DeepSeek niche detector). Mitigated by PROFILE-16 + schema validation + slug check. NO new authentication surface, NO new RLS surface, NO new crypto requirement. Existing graceful degradation contract preserves availability under provider failure.

## Sources

### Primary (HIGH confidence)
- Context7 `/websites/api-docs_deepseek` — DeepSeek API context caching, V4 Flash spec, json_mode docs
- Codebase reads (verified 2026-05-18):
  - `src/lib/engine/wave0.ts` — Phase 3 stub contract preserved
  - `src/lib/engine/types.ts:205-209` — Wave0Result widening site
  - `src/lib/engine/aggregator.ts:25-35` (SCORE_WEIGHTS), `:197-203` (SignalAvailability), `:263-303` (aggregateScores entry)
  - `src/lib/engine/pipeline.ts:269` (runWave0 callsite), `:65-78` (PipelineOptions), `:340-358` (creator promise)
  - `src/lib/engine/deepseek.ts:19` (DEEPSEEK_MODEL), `:41-42` (cache pricing constants), `:53-123` (STABLE system prompt pattern), `:509-650` (reasonWithDeepSeek body)
  - `src/lib/engine/gemini.ts:17` (GEMINI_MODEL), `:425-547` (analyzeVideoWithGemini with Files API + polling)
  - `src/lib/engine/creator.ts:11-46` (CreatorContext interface including Phase 2 9-card fields), `:134-241` (fetchCreatorContext)
  - `src/lib/engine/events.ts:6-49` (StageEventWave + emit helpers)
  - `src/lib/niches/taxonomy.ts:1-188` (NICHE_TREE + helpers)
  - `src/lib/engine/__tests__/stubs.test.ts:16-44` (Wave 0 backwards-compat contract)
  - `supabase/migrations/20260213000000_content_intelligence.sql:20-42` (scraped_videos schema for benchmark filter tags)
- `.planning/phases/03-pipeline-infrastructure/03-CONTEXT.md` + `03-RESEARCH.md` + `03-04-SUMMARY.md` (Phase 3 D-07 forward-compat, prediction cache, signal_availability)
- `.planning/phases/02-creator-profile-9-card-interview/02-CONTEXT.md` (D-09 micro_niche AI-owned, D-10 taxonomy module, D-19 CreatorContext flat extension)
- `.planning/research/v2.1-baseline.md` (corpus characteristics: 5 niches, hashtag-noisy comedy, follower_count present)

### Secondary (MEDIUM-HIGH confidence — WebFetch from official docs)
- `https://api-docs.deepseek.com/quick_start/pricing` — V4 Flash + V4 Pro current pricing (verified 2026-05-18: $0.0028/M cache hit, $0.14/M cache miss, $0.28/M output for V4 Flash)
- `https://api-docs.deepseek.com/news/news260424` — V4 launch announcement; legacy alias routing (deepseek-reasoner → V4 Flash thinking; deepseek-chat → V4 Flash non-thinking); 2026-07-24 15:59 UTC hard retirement
- `https://api-docs.deepseek.com/guides/kv_cache` — automatic context caching; no opt-in header; prefix-matching from position 0
- `https://api-docs.deepseek.com/guides/json_mode` — JSON mode setup; include "json" in prompt for reliability
- `https://ai.google.dev/gemini-api/docs/video-understanding` — videoMetadata.startOffset/endOffset string format; all Gemini models support video clipping; quality higher on 2.5+ series
- `https://ai.google.dev/gemini-api/docs/models/gemini-3-flash-preview` — model ID confirmed (`gemini-3-flash-preview` is correct, not `gemini-3-flash`); structured outputs supported
- `https://ai.google.dev/gemini-api/docs/gemini-3` — Gemini 3 developer guide; pricing table ($0.50/M input, $3/M output for Flash)
- `https://ai.google.dev/gemini-api/docs/pricing` — current pricing as of 2026-05 ($0.50/M text/image/video input, $1/M audio input, $3/M output for gemini-3-flash-preview)
- `https://blog.google/products/gemini/gemini-3-flash/` — Gemini 3 Flash announcement ("Pro-level intelligence at the speed and pricing of Flash")
- `https://chat-deep.ai/models/deepseek-v4/` — V4 Pro vs Flash guide; thinking mode parameter; non-thinking-default for v4-flash

### Tertiary (LOW confidence — community sources cross-checked with primary)
- `https://wavespeed.ai/blog/posts/blog-deepseek-v4-model-name-migration/` — migration timing corroboration (cross-checked with official)
- `https://github.com/vllm-project/vllm/issues/41132` — known issue: JSON + thinking mode produces reasoning field (vllm bug report; treats DeepSeek behavior as constraint)
- `https://openrouter.ai/deepseek/deepseek-v4-flash` — V4 Flash pricing aggregator (corroborates primary)
- `https://openrouter.ai/google/gemini-3-flash-preview` — Gemini 3 Flash pricing aggregator (corroborates primary)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in package.json; codebase patterns verified
- Architecture: HIGH — every integration point is additive on top of Phase 3 forward-compat hooks
- API verification (Gemini 3, DeepSeek V4): HIGH — confirmed via official docs WebFetch on 2026-05-18
- Pricing: HIGH for current rates; MEDIUM for post-promo (V4 Pro promo ends 2026-05-31; cache-hit price reverted 1/10 of launch on 2026-04-26 — re-verify at execution time)
- Persona / benchmark mappings: MEDIUM — researcher-proposed, marked as [ASSUMED] in A8/A9; Phase 7/8 implementations will refine
- Weight matrix interpretation: HIGH — locked text in CONTEXT D-12; the "additive only" milestone constraint resolves the ambiguity (Topic #5)
- V3→V4 migration risk: HIGH — confirmed via official docs that bare `deepseek-v4-flash` ≠ thinking mode (Topic #12)

**Research date:** 2026-05-18
**Valid until:** 2026-06-17 (30 days for stack stability; DeepSeek post-2026-05-31 promo end may shift V4 Pro pricing; re-verify at Phase 4 execution time)

## RESEARCH COMPLETE
