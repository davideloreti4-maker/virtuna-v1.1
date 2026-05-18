# Phase 6: Audio Analysis + Fingerprint Matching - Research

**Researched:** 2026-05-18
**Domain:** Multimodal Gemini audio extraction + pgvector semantic match + aggregator extension
**Confidence:** HIGH on stack/migration/SDK shape; MEDIUM on Gemini-Flash audio reliability (will need live verification); MEDIUM on similarity threshold (Phase 12 benchmark gates)

## Summary

Phase 6 fills the `audio_analysis` no-op (renamed `audio_fingerprint` per D-A4) with four real signals — voice clarity, audio hook, silence/voiceover/music ratio, and a pgvector fingerprint match — all extracted from a single extended `gemini_video_analysis` call. The audio scores live inside the existing Gemini response (no extra LLM call, no ffmpeg, no re-upload — load-bearing D-A1 constraint). A new `gemini-embedding-001` text-embedding step embeds the Gemini-produced `audio_description` string and runs a Supabase pgvector cosine match against `trending_sounds.audio_embedding`. When the fingerprint matches, the Jaro-Winkler caption fallback in `trends.ts` is gated off. The audio signal enters the aggregator as a new top-level signal (weight 0.05-0.10) with a content-type-adaptive `audio_perceptual_score` formula and a phase-aware fingerprint boost.

Two architectural decisions diverge from CONTEXT.md and must be flagged for planner/discuss-phase reconsideration: **(1)** the canonical Gemini text-embedding model is now `gemini-embedding-001` (3072-dim default, truncatable to 768/1536), NOT the deprecated `text-embedding-004` mentioned in CONTEXT D-F1 (`text-embedding-004` shut down January 14, 2026 — already past). **(2)** Supabase's own documentation now recommends **HNSW over ivfflat for write-heavy / small-dataset workloads**; CONTEXT D-F2 specifies ivfflat. HNSW is the safer default for ~50-500 trending_sounds rows that grow incrementally via the cron path.

**Primary recommendation:** Embed Gemini's `audio_description` via `gemini-embedding-001` truncated to **768 dimensions** (storage-efficient, free on dev, $0.15/M tokens on paid tier, auto-normalized for cosine similarity). Store as `vector(768)` with **HNSW** index using `vector_cosine_ops`. Threshold 0.80 for "match"; revisit via Phase 12 benchmark. Architect the Wave 1 audio_fingerprint stage as a sub-await on the Gemini promise (Architectural Option A — see Question #3) so wave parallelism is preserved with the other Wave 1 siblings (creator/rules), even though it logically chains off the Gemini description output.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Audio Source Mechanism:**
- **D-A1 (LOCKED):** Audio signals come from extending the existing `gemini_video_analysis` prompt. Gemini natively processes audio inside the video stream. Phase 6 widens the response schema with new audio fields; the `audio_fingerprint` stage extracts them from the Gemini result in the aggregator. **Zero extra Gemini calls** (for video). Zero added latency by design.
- **D-A2 (LOCKED):** Audio scoring is content-type-aware. talking_head / tutorial / vlog → full audio scoring. slideshow / b_roll / action → voice_clarity = null, audio_hook_first_2s = null (ratios + audio_description still emit). other → full audio scoring (passthrough).
- **D-A3 (LOCKED):** silence/voiceover/music ratio shape = three percentages summing to 1.0.
- **D-A4 (LOCKED):** `audio_analysis` stage renamed to `audio_fingerprint`. Renamed stage owns fingerprint match ONLY. Perceptual scores extracted from `gemini_video_analysis` response directly inside the aggregator — no separate "extract" stage.

**Fingerprint Approach:**
- **D-F0 (LOCKED):** Audio fingerprint approach = Gemini-description embedding + pgvector cosine match. NOT Chromaprint/AcoustID, NOT raw audio waveforms.
- **D-F1 (LOCKED):** Embed Gemini's `audio_description` text via Gemini text embedding API. Researcher verifies exact endpoint and dimensionality.
- **D-F2 (LOCKED):** Phase 6 owns pgvector for `trending_sounds`. Phase 6's migration installs the pgvector extension + adds `audio_embedding vector(N)` + `audio_description text` + ivfflat index. Phase 8 reuses.
- **D-F3 (LOCKED):** Fingerprint wins; caption fuzzy match runs only on fallback when `signal_availability.audio_fingerprint = false`.
- **D-F4 (LOCKED):** One-time backfill + cron extension for trending_sounds embeddings. Cost ceiling ~$0.025/day.

**Aggregator Weight + Boundary:**
- **D-G1 (LOCKED):** Audio = new standalone signal in aggregator. Initial weight ~0.05-0.10 (planner picks). Two sub-components: `audio_perceptual_score` + `audio_fingerprint_boost`. SignalAvailability gains `audio` + `audio_fingerprint` boolean keys.
- **D-G2 (LOCKED):** Fingerprint match = phase-aware boost on the audio signal only (NOT on overall score). Emerging +15, rising +10, peak +5, declining -5, none 0.
- **D-G3 (LOCKED):** `audio_perceptual_score` formula adapts to available sub-scores per content type. talking_head/tutorial/vlog → voice-driven. slideshow/b_roll/action → ambient-driven. other → balanced. Each formula normalizes to 0-100 BEFORE the fingerprint boost.
- **D-G4 (LOCKED):** `FeatureVector.audioTrendingMatch` populated from pgvector cosine when available, Jaro-Winkler score otherwise. Field semantics unchanged (0-1).

**HOOK-02 Ownership:**
- **D-H1 (LOCKED):** Phase 6 owns HOOK-02 (audio hook score for first 2s). REQUIREMENTS.md traceability updates: HOOK-02 moves from Phase 5's "Multi-Modal Hook Decomposition" section to Phase 6's "Audio Analysis" section.
- **D-H2 (LOCKED):** Audio hook window stays 0-2s. Field name: `audio_hook_first_2s`. Output: 0-10 integer score.
- **D-H3 (LOCKED):** Phase 5 and Phase 6 stay parallel in Wave 4. No new strict dependency from Phase 5 → Phase 6.

### Claude's Discretion

User self-identified as non-technical. All technical / implementation-mechanic choices are Claude's discretion:

- Exact audio fields in extended `gemini_video_analysis` response schema (Zod shape, prompt language)
- Gemini text embedding model + dimensionality (researcher locks)
- pgvector index parameters (ivfflat lists / probes — see Question #4 deviation toward HNSW)
- Cosine similarity threshold for "this is a match" (baseline ~0.80-0.85)
- Initial audio signal weight value (0.05 vs 0.07 vs 0.10) within the 0.05-0.10 range
- `audio_perceptual_score` formula coefficients within D-G3's content-type-aware structure
- Stage event payload shape for `audio_fingerprint`
- Backfill script idempotency / batching
- Migration scope (single vs split)
- Failure semantics when extended gemini_video_analysis returns video fields but audio fields missing/invalid

### Deferred Ideas (OUT OF SCOPE)

**Phase 5 (Multi-Modal Hook Decomposition) — handled during Phase 5 discuss-phase:**
- SEGMENT-01 hook window 0-3s → 0-5s
- HOOK-02 traceability migration (REQUIREMENTS.md table updates)

**Phase 7 (Multi-Persona Simulation):**
- Per-persona audio reaction signals

**Phase 8 (Benchmark Retrieval):**
- Audio embedding reuse for benchmark retrieval (Phase 6 ships pgvector; Phase 8 owns audio-as-retrieval-filter design)

**Phase 9 (Platform Algo Fit + Self-Critique + Counterfactuals):**
- Platform-specific audio weight tuning (TikTok/IG/YT)
- Counterfactual suggestions about audio swaps

**Phase 10 (ML Audit + Calibration + Aggregator Extension):**
- Audio signal weight tuning (Phase 6 ships 0.05-0.10 placeholder; Phase 10 sets the real weight)
- `audio_perceptual_score` formula coefficient refinement
- ML retrain with fingerprint cosine similarity in `audioTrendingMatch`

**Engine Foundation milestone retrospective:**
- Chromaprint / AcoustID revisit (only if Phase 12 benchmark shows insufficient precision)
- Audio sentiment / emotion / genre classification
- Real audio waveform analysis (ffmpeg)

**Intelligence Surface milestone (M2):**
- Audio results UI surfacing
- Audio-correlated retention curve overlay

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUDIO-01 | Audio analysis stage replaces existing no-op (`audioResult: null` → real result) | Q3, Q7, Q11 — stage architecture, payload, failure paths |
| AUDIO-02 | Voice clarity / SNR score (0-10) | Q2 — extended Gemini schema; D-A2 content-type gating |
| AUDIO-03 | Audio hook score for first 2s (0-10) | Q2 — extended Gemini schema; D-H2 0-2s window |
| AUDIO-04 | Silence / voiceover / music ratio computed | Q2 — D-A3 three-percentage shape |
| AUDIO-05 | Audio fingerprint matching against trending sounds DB (replaces fuzzy string match) | Q1, Q3, Q4, Q5 — Gemini embedding + pgvector match |
| AUDIO-06 | Trending sound detection: bool + velocity (rising / peak / declining) | Q6 — trend_phase already exists; emerging/rising/peak/declining vocabulary verified in calculate-trends |
| HOOK-02 | Audio hook quality score (0-10, first 2s audio analysis) — **MIGRATED FROM PHASE 5 TO PHASE 6** per D-H1 | Q2 — same field as AUDIO-03 |
| AGG-01 | SignalAvailability extended with new signals — personas, **audio**, retrieval, hook, algo-fit | Q8 — adds `audio` + `audio_fingerprint` keys |
| AGG-02 | Dynamic weight redistribution rules updated for new signals | Q8 — selectWeights filter widens to include `audio` |
| AGG-04 | PredictionResult schema extended with new fields | Q8 — adds audio result fields, signal_availability widening |
| AGG-05 | Existing 465 tests pass without modification | Q12 — additive only; new tests added |
| AGG-06 | New aggregator tests cover dynamic redistribution with new signals | Q12 — test surface listed |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Multimodal audio + video LLM analysis | API / Backend (`src/lib/engine/gemini.ts`) | — | LLM call boundaries belong in `gemini.ts`; Phase 6 widens the existing call's prompt + response schema |
| Audio fingerprint stage orchestration | API / Backend (`src/lib/engine/audio-fingerprint.ts` — new) | — | Wave 1 sibling of gemini_video_analysis; owns pgvector match logic only |
| Text embedding (audio_description → vector) | API / Backend (helper in `src/lib/engine/audio-fingerprint.ts`) | — | One-off Gemini API call inside the fingerprint stage; cost telemetry through stage_end event |
| pgvector match RPC | Database / Storage (Supabase Postgres function) | API / Backend (RPC caller) | RPC function lives in migration; TypeScript caller invokes via `supabase.rpc()` |
| Aggregator extension (audio_perceptual_score + boost) | API / Backend (`src/lib/engine/aggregator.ts`) | — | All score math + signal availability lives in aggregator |
| Trending sounds backfill | Scripts (`scripts/backfill-trending-sound-embeddings.ts` — new) | — | One-off operational script, not in request path |
| Cron embedding extension | API / Backend (`src/app/api/cron/calculate-trends/route.ts`) | — | Inline call after each batch upsert |
| Audio result UI surfacing | — | — | OUT OF SCOPE — M2 milestone owns visualization |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@google/genai` | **2.4.0** (latest), pinned at 1.41.0 in codebase | Gemini video + text embedding API | Already in stack; `embedContent` method is the canonical text embedding entrypoint [VERIFIED: npm view @google/genai version → 2.4.0] |
| `gemini-embedding-001` | GA model (April 2026 flagship) | Text embedding of audio_description string | Default 3072 dims, truncatable to 768/1536 via Matryoshka Representation Learning. **`text-embedding-004` shut down January 14, 2026** — do NOT use the model name mentioned in CONTEXT D-F1 [CITED: developers.googleblog.com] |
| `pgvector` | 0.7+ (Supabase auto-upgraded; latest is 0.8.2 as of late 2025) | Vector storage + similarity index | Already standard on Supabase; supports HNSW since 0.7.0 [CITED: supabase.com/blog/pgvector-0-7-0] |
| `@supabase/supabase-js` | 2.93.1 (in package.json) | RPC invocation | Already in stack; `.rpc()` method is the canonical call shape |
| `zod` | 4.3.6 | Validate Gemini extended response | Established pattern in `gemini.ts` + Wave 0 detectors |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/lib/cache.ts` `createCache<T>` | existing | Cache pgvector query results | If query latency dominates Wave 1 — skip in v1, revisit if benchmark shows it matters |
| `src/lib/logger.ts` `createLogger` | existing | Module-scoped logging | Always — `createLogger({ module: "audio_fingerprint" })` |
| `@sentry/nextjs` | 10.39.0 | Error capture at stage boundary | Required per established pattern; matches Wave 0 detectors |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| HNSW index (recommended) | ivfflat (from CONTEXT D-F2) | ivfflat: needs data before index can be built (cluster centers learned at build time); HNSW: builds on empty table, adapts to incremental writes. For ~50/day cron-grown dataset, HNSW is the safer default per Supabase's own current docs. **Recommend planner override CONTEXT D-F2 ivfflat → HNSW** [CITED: medium.com/@philmcc/pgvector-index-selection] [VERIFIED: supabase.com/docs/guides/database/extensions/pgvector] |
| `gemini-embedding-001` (recommended, 768 dim truncated) | `gemini-embedding-2` | Embedding-2 is multimodal (text + image + audio + video) at $0.20/M tokens (vs $0.15/M for 001); we only need text embedding of a description string, so 001 is sufficient and cheaper. Embedding-2 also adds 4× input length (irrelevant for 50-150 char description) [CITED: tokencost.app/blog/gemini-embedding-2-pricing] |
| 768-dim vector storage | 3072-dim (full default) | 768 is auto-normalized via Matryoshka technique with negligible quality loss; 4× storage and index-memory savings; well under pgvector's 2000-dim HNSW limit. Recommend 768 unless Phase 12 benchmark shows recall problems [CITED: developers.googleblog.com] |
| Awaiting the Gemini promise (Option A) | Sequential after Wave 1 (Option C) | Sequential breaks the "Wave 1 parallel siblings" contract from Phase 3 D-01. Option A preserves parallelism with creator/rules siblings; the only sub-dependency is on the Gemini promise's resolved audio_description — handled via Promise chaining inside the stage |

**Installation:**
```bash
# No new npm dependencies required — @google/genai and @supabase/supabase-js
# already in package.json. Verify Gemini version is recent enough for
# embedContent + gemini-embedding-001 model (any 1.x+ supports it).

# Optional: bump @google/genai from 1.41.0 to 2.4.0 for latest types — but
# 1.41.0 already supports embedContent per Context7 docs [VERIFIED]. Defer bump.
```

**Version verification (2026-05-18):**
- `@google/genai`: latest 2.4.0; codebase pinned at 1.41.0 — both support `embedContent` [VERIFIED: `npm view @google/genai version` → 2.4.0]
- `gemini-embedding-001`: GA April 2026, $0.15/M input tokens standard, $0.075/M batch [CITED: tokencost.app, ai.google.dev]
- `pgvector`: 0.8.2 as of late 2025; Supabase ships 0.7+ on all new projects [CITED: supabase.com/blog/pgvector-0-7-0]

## Architecture Patterns

### System Architecture Diagram

```
INPUT (request to /api/analyze)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Wave 0 (Phase 4)                                            │
│   content-type-detector → content_type (talking_head/etc)   │
│   niche-detector       → niche.primary                       │
└─────────────────────────────────────────────────────────────┘
    │ (content_type drives D-A2 gating in aggregator)
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Wave 1 (parallel siblings)                                  │
│                                                              │
│   gemini_video_analysis ──┐ (extended prompt + schema       │
│   (existing, EXTENDED)    │  emits audio_* fields too)      │
│                            │                                 │
│   audio_fingerprint ◄─────┘ (NEW; awaits Gemini             │
│   (Phase 6 NEW STAGE)        promise's audio_description    │
│        │                     → gemini-embedding-001         │
│        │                     → supabase.rpc('match_*')      │
│        │                     → returns matched sound +      │
│        │                       similarity + trend_phase     │
│        ▼                                                     │
│   creator_context (passthrough — pre-fetched)               │
│   rule_scoring                                               │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Wave 2 (parallel)                                           │
│   deepseek_reasoning                                         │
│   trend_enrichment (Jaro-Winkler; GATED by                  │
│                     signal_availability.audio_fingerprint)  │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ Wave 3 (Phase 7 — not yet) + Aggregator                     │
│                                                              │
│   aggregateScores():                                         │
│     • Read audio fields from gemini.video.* response        │
│     • Compute audio_perceptual_score per D-G3 formula       │
│       (content-type-aware)                                   │
│     • Apply audio_fingerprint_boost per D-G2                 │
│       (emerging +15, rising +10, peak +5, declining -5)      │
│     • Audio enters weighted average with weight 0.05-0.10   │
│     • SignalAvailability.audio + audio_fingerprint set       │
│     • FeatureVector.audioTrendingMatch ←─ fingerprint        │
│       cosine OR fuzzy match score (D-G4)                     │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
RESULT (PredictionResult JSON with new audio fields)


OUT-OF-BAND PATHS (not in request flow):

CRON (every hour): /api/cron/calculate-trends
   • Existing upsert path (line 138 of route.ts)
   • EXTENDED: for each newly upserted sound, fetch sound_url →
     gemini-embedding-001 description prompt → embedContent →
     upsert audio_embedding + audio_description columns

BACKFILL (one-time): scripts/backfill-trending-sound-embeddings.ts
   • Iterate trending_sounds WHERE audio_embedding IS NULL
   • Batch size 25; rate limit to stay well under 10M TPM
   • Resumable via WHERE clause; idempotent via ON CONFLICT

DB (one-time): supabase/migrations/<ts>_phase6_audio_fingerprint.sql
   • CREATE EXTENSION IF NOT EXISTS vector;
   • ALTER TABLE trending_sounds ADD audio_embedding vector(768),
                                     audio_description text;
   • CREATE INDEX ... USING hnsw (audio_embedding vector_cosine_ops);
   • CREATE FUNCTION match_trending_sound_by_audio(...) RETURNS ...
```

### Recommended Project Structure

```
src/lib/engine/
├── pipeline.ts             # rename audio_analysis → audio_fingerprint stage; wire audioFingerprintPromise to Wave 1 Promise.all
├── gemini.ts               # extended VIDEO_RESPONSE_SCHEMA + buildVideoPrompt (audio fields)
├── audio-fingerprint.ts    # NEW — stage logic: await Gemini, embed description, run RPC, return match
├── audio-perceptual.ts     # NEW — content-type-aware formula (D-G3); keeps aggregator clean
├── aggregator.ts           # add audio weight + signal availability widening
├── types.ts                # add AudioPerceptualResult, AudioFingerprintResult, extend SignalAvailability + PredictionResult
├── trends.ts               # gate Jaro-Winkler with if (!signal_availability.audio_fingerprint)
└── __tests__/
    ├── audio-fingerprint.test.ts        # NEW
    ├── audio-perceptual.test.ts         # NEW
    ├── aggregator.test.ts               # extend with audio-availability cases
    ├── gemini.test.ts                   # extend with audio fields in response schema
    └── trends.test.ts                   # extend with fallback gating

scripts/
└── backfill-trending-sound-embeddings.ts   # NEW

src/app/api/cron/calculate-trends/
└── route.ts                # EXTEND — inline embedding computation after upsert

supabase/migrations/
└── <ts>_phase6_audio_fingerprint.sql   # NEW — extension + columns + HNSW index + RPC function
```

### Pattern 1: Extended Gemini Video Response

**What:** Append audio fields to existing `VIDEO_RESPONSE_SCHEMA` + `buildVideoPrompt` in `src/lib/engine/gemini.ts`. Validate via Zod after parse.

**When to use:** This IS the canonical Phase 6 audio extraction mechanism per D-A1. Gemini natively processes the audio track of the video alongside vision tokens at no additional Gemini call cost.

**Pattern source:** Existing `gemini.ts` lines 211-247 + 273-314 (VIDEO_RESPONSE_SCHEMA). The audio fields are appended in-place.

```typescript
// Source: extends src/lib/engine/gemini.ts:274 (VIDEO_RESPONSE_SCHEMA)
// + src/lib/engine/types.ts:243 (GeminiVideoSignalsSchema)
// [CITED: ai.google.dev/gemini-api/docs/audio — Gemini 2.5 Flash analyzes
//  audio inside video Files API uploads natively]

const VIDEO_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    // ... existing factors, overall_impression, content_summary, video_signals ...
    audio_signals: {
      type: Type.OBJECT,
      properties: {
        // null when content_type ∈ {slideshow, b_roll, action} per D-A2
        voice_clarity_0_10: { type: Type.NUMBER, nullable: true },
        audio_hook_first_2s_0_10: { type: Type.NUMBER, nullable: true },
        // Three percentages summing to 1.0 (D-A3)
        silence_ratio: { type: Type.NUMBER },
        voiceover_ratio: { type: Type.NUMBER },
        music_ratio: { type: Type.NUMBER },
        // 50-150 char description for fingerprint (D-F1)
        audio_description: { type: Type.STRING },
      },
      required: [
        "silence_ratio",
        "voiceover_ratio",
        "music_ratio",
        "audio_description",
      ],
    },
  },
  required: [
    "factors",
    "overall_impression",
    "content_summary",
    "video_signals",
    "audio_signals",
  ],
};
```

### Pattern 2: Text Embedding via @google/genai SDK

**What:** Embed a string via `ai.models.embedContent({ model, contents, config: { outputDimensionality, taskType } })`. Returns `{ embeddings: [{ values: number[] }] }`.

**When to use:** Inside `audio-fingerprint.ts` stage to embed Gemini's `audio_description`; inside backfill script + cron extension to embed trending_sounds descriptions.

```typescript
// Source: Context7 docs for /googleapis/js-genai + canonical pattern from
// ai.google.dev/gemini-api/docs/embeddings [VERIFIED via Context7 CLI]

import { GoogleGenAI } from "@google/genai";

async function embedAudioDescription(text: string): Promise<number[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: {
      outputDimensionality: 768,
      // SEMANTIC_SIMILARITY = symmetric similarity (both sides are descriptions)
      // [CITED: docs.cloud.google.com/vertex-ai/generative-ai/docs/embeddings/task-types]
      taskType: "SEMANTIC_SIMILARITY",
    },
  });
  if (!response.embeddings?.[0]?.values) {
    throw new Error("Gemini embedContent returned no embeddings");
  }
  return response.embeddings[0].values;
}
```

### Pattern 3: pgvector Match Function (Supabase RPC)

**What:** Postgres function that takes a query embedding, similarity threshold, and limit; returns matched rows with similarity scores. Called from TypeScript via `supabase.rpc('match_trending_sound_by_audio', { ... })`.

**Why RPC over inline SQL:** PostgREST does not currently support pgvector similarity operators (`<=>`) in raw filter queries. Wrapping the query in an SQL function is the canonical Supabase pattern. [CITED: supabase.com/docs/guides/ai/semantic-search — "PostgREST does not currently support pgvector similarity operators, so you need to wrap your query in a Postgres function and call it via the rpc() method."]

```sql
-- Source: supabase.com/docs/guides/ai/semantic-search canonical pattern
-- [CITED]
CREATE OR REPLACE FUNCTION match_trending_sound_by_audio(
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  sound_name text,
  sound_url text,
  trend_phase text,
  velocity_score numeric,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    ts.id,
    ts.sound_name,
    ts.sound_url,
    ts.trend_phase,
    ts.velocity_score,
    1 - (ts.audio_embedding <=> query_embedding) AS similarity
  FROM trending_sounds ts
  WHERE ts.audio_embedding IS NOT NULL
    AND 1 - (ts.audio_embedding <=> query_embedding) >= match_threshold
  ORDER BY ts.audio_embedding <=> query_embedding ASC
  LIMIT LEAST(match_count, 10);
$$;
```

```typescript
// Source: supabase.com/docs/guides/ai/semantic-search [CITED]
const { data: matches, error } = await supabase.rpc(
  "match_trending_sound_by_audio",
  {
    query_embedding: queryEmbedding,
    match_threshold: 0.80, // tunable; Phase 12 benchmark validates
    match_count: 1,
  },
);
if (error) throw error;
const bestMatch = matches?.[0] ?? null;
```

### Anti-Patterns to Avoid

- **Calling Gemini twice for video + audio:** Violates D-A1. Audio is part of the same Gemini Files API upload; the prompt asks for audio fields in the same response.
- **Using `text-embedding-004`:** Shut down January 14, 2026 (past) [CITED: tokencost.app]. Use `gemini-embedding-001`.
- **ivfflat index on a write-incremental column:** ivfflat builds cluster centers from existing data; new sounds added via cron won't fit existing clusters cleanly, degrading recall. HNSW adapts to writes [CITED: dev.to/philip_mcclarence_2ef9475].
- **Querying pgvector with raw SQL from Supabase JS client:** PostgREST doesn't support `<=>` operator in filter clauses. Use an RPC function [CITED: supabase.com/docs/guides/ai/semantic-search].
- **Storing 3072-dim vectors when 768 suffices:** Storage and index memory 4× larger; Matryoshka means 768-dim quality is near-equivalent for similarity tasks [CITED: developers.googleblog.com].
- **Forgetting `audio_embedding IS NOT NULL` in the match function:** A sound row exists immediately after upsert (cron path); its embedding is computed inline AFTER. Until embedding completes, the row has `audio_embedding = NULL` — match function must skip it. (Failure mode 7c below.)
- **Letting `audio_perceptual_score` go negative or exceed 100:** D-G3 normalizes to 0-100 BEFORE the fingerprint boost. The boost can take audio_score outside [0, 100] briefly; clamp at the boundary before mixing into overall.
- **Treating `signal_availability.audio` and `signal_availability.audio_fingerprint` identically:** They are different gates. `audio` = "we got any perceptual scores from Gemini" (true even when no fingerprint match). `audio_fingerprint` = "we got a pgvector match above threshold." The aggregator weight redistribution cares about `audio`; trends.ts fallback cares about `audio_fingerprint`.
- **Putting Wave 0's `content_type` into selectWeights math:** Phase 4 already added a `SCORE_WEIGHT_KEYS` filter (aggregator.ts line 43). Phase 6 MUST add `audio` to `SCORE_WEIGHT_KEYS` (it IS a weight-bearing signal) but MUST NOT add `audio_fingerprint` (it's provenance, not a weight). This is the load-bearing constraint from PATTERNS Critical Cross-File Constraint #3.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio waveform fingerprinting | Custom Chromaprint/AcoustID integration | Gemini description embedding + pgvector | Operational complexity (FFmpeg binary, Vercel cold-start risk); D-F0 explicitly rejected; reuses existing Gemini infrastructure [ASSUMED, but consistent with D-F0 reasoning] |
| Text embedding model | Train your own | `gemini-embedding-001` | State-of-the-art on MTEB Multilingual (68.32 avg score) [CITED: tokenmix.ai/blog/gemini-embedding-001-dimensions-pricing-guide-2026]; you can't beat Google here cheaply |
| Vector similarity index | Compute cosine in TypeScript | pgvector HNSW | <1ms query latency at our scale; offloads to Postgres; tested at billions-of-rows scale [CITED: supabase.com/docs/guides/ai] |
| pgvector query parameterization | Manual SQL | Supabase RPC function | PostgREST doesn't support `<=>` operator; RPC is the canonical Supabase pattern [CITED] |
| Idempotent backfill | Roll your own queue | `WHERE audio_embedding IS NULL` + batch + ON CONFLICT | Stateless re-runnability with no resume token; matches Phase 1 corpus-build idempotency pattern |
| Audio→text transcription | Whisper / custom | Gemini's built-in audio understanding | Gemini 2.5 Flash analyzes audio in video files natively [CITED: ai.google.dev/gemini-api/docs/audio]; no extra service needed |

**Key insight:** Phase 6's entire stack is "extend what's already in the codebase." Zero new vendors. Zero new package dependencies. Zero new binaries. The only new technology is `gemini-embedding-001` (same SDK, new method) and pgvector (Postgres extension). This is by design — D-A1 + D-F0 keep operational complexity low.

## Common Pitfalls

### Pitfall 1: Gemini Flash returns ratios that don't sum to 1.0

**What goes wrong:** LLM emits `{ silence: 0.1, voiceover: 0.6, music: 0.4 }` (sum = 1.1). Aggregator math drifts; debugger sees "1.1 sum" warnings.

**Why it happens:** JSON schema doesn't enforce numerical relationships; Gemini Flash-lite isn't great at arithmetic; the prompt may not be explicit enough.

**How to avoid:**
- Add explicit prompt instruction: "silence_ratio + voiceover_ratio + music_ratio MUST sum to exactly 1.0; rebalance internally before emitting."
- Add post-parse Zod refinement that normalizes ratios if sum > 0 and abs(sum-1.0) < 0.1; emits a warning if abs(sum-1.0) ≥ 0.1.
- Test surface: deterministic Gemini mock returning a sum=1.05 response; assert normalization fires.

**Warning signs:** New `audio_ratio_normalization_applied` warning appears in `pipeline.warnings` array; eval harness drift detector flags audio_perceptual_score distribution shift.

### Pitfall 2: Wave 1 deadlock if audio_fingerprint awaits Gemini promise inside Promise.all

**What goes wrong:** If `audioFingerprintPromise` does `await geminiPromise` inside Wave 1's `Promise.all([geminiPromise, audioFingerprintPromise, creatorPromise, rulePromise])`, the audio_fingerprint stage events fire at the END of Wave 1 (after Gemini resolves), violating "siblings run in parallel" UX intent.

**Why it happens:** The audio_fingerprint stage genuinely depends on Gemini's `audio_description` output — no way around the sequence. But Promise.all sees the await chain.

**How to avoid:** This is **a known tradeoff, not a bug**. Audio_fingerprint emits its `stage_start` event AT THE BEGINNING (before awaiting Gemini), then emits `stage_end` after the pgvector match completes. The SSE consumer sees audio_fingerprint stage_start fire alongside Gemini's stage_start (parallel UX), then audio_fingerprint stage_end fires later than Gemini's (because it had to wait). Document this in the M2 viz design notes.

**Alternative:** Run audio_fingerprint AFTER Wave 1 as a "Wave 1.5" stage. Rejected because (a) it breaks Phase 3 D-01's stage-event ordering contract and (b) the perceived parallelism is what users see; the sub-await is mechanism, not semantics.

**Warning signs:** Stage event timeline shows audio_fingerprint stage_end always after gemini_video_analysis stage_end — that's expected. Concerning would be if audio_fingerprint stage_start fires AFTER gemini_video_analysis stage_end.

### Pitfall 3: Embedding cost runaway in backfill script

**What goes wrong:** Naive backfill loop fires 500 embedContent calls in 30 seconds; hits a rate limit (Gemini free tier embedding-001 has regional quotas not exposed in docs); errors cascade; script aborts halfway.

**Why it happens:** Gemini embedding-001 has 10M TPM on free tier but per-minute RPM is undocumented [CITED: ai.google.dev/gemini-api/docs/rate-limits — rate limits page lists models but didn't surface embedding RPM in fetched content]. Per-second burst limits can still bite.

**How to avoid:**
- Batch size 25 (Gemini supports batch in `contents: string[]` per Context7 docs; one call embeds multiple strings).
- Sleep 200ms between batches → max 125 calls/sec; well under any rate-limit ceiling.
- On ANY error (429, 5xx, AbortError), exponential back-off: 1s, 3s, 10s, 30s, abort with descriptive error.
- Resumable: every successful batch commits to DB before next; on restart, `WHERE audio_embedding IS NULL` skips done rows.
- Track cost: log `billableCharacterCount` from response.metadata + summary at end.

**Warning signs:** "Quota exceeded" 429 errors; script aborts before reaching end; cost projection in CONTEXT D-F4 ($0.025/day) exceeded.

### Pitfall 4: Cron embedding extension blocks the upsert path

**What goes wrong:** Cron `calculate-trends` route extends to compute embedding inline. The embedding call adds ~500ms per row. With 50 sounds/day = ~25s extra per cron tick. If the cron's serverless timeout is 60s and the existing upsert takes 30s, we're at 55s — close to timeout.

**Why it happens:** Naive "after upsert, await embedContent for each row" doubles cron latency.

**How to avoid:**
- Make embedding FAILURE-TOLERANT: wrap each embedContent call in try/catch; on failure, log warning + skip + move on. The sound row still upserts; its `audio_embedding` stays null; the next cron tick retries via `WHERE audio_embedding IS NULL`.
- Or: defer embedding to a SECOND cron pass on the next tick (cleaner separation; same final state).
- Or: batch the embedding calls (25 at a time via `contents: string[]`) before storing.
- For now: synchronous-but-failure-tolerant is simplest; benchmark + revise if cron hits timeout.

**Warning signs:** Cron route p99 latency creeps up; Vercel function timeouts on calculate-trends; sounds upserted but audio_embedding column always null.

### Pitfall 5: Similarity threshold tuned on training data leaks via cache

**What goes wrong:** Phase 12 benchmark tunes the cosine threshold (0.80 → 0.83 say) using corpus eval. But eval-harness runs with `bypassCache: true`. Production runs use the L1/L2 cache. Cached PredictionResults computed under threshold 0.80 stay valid until 24h TTL or engine_version bump.

**Why it happens:** The threshold is a configuration constant, not part of the cache key. Changing the threshold post-deployment doesn't auto-invalidate the cache.

**How to avoid:**
- Make the threshold an env constant (`AUDIO_FINGERPRINT_SIMILARITY_THRESHOLD`) so changing it requires a redeploy (clears L1; L2 entries still match cache key but new predictions use new threshold).
- For corpus-tuned threshold changes that ship to production, bump `ENGINE_VERSION` constant (e.g., `3.0.0-dev` → `3.0.1-dev`) — auto-invalidates ALL cached predictions per Phase 3 D-14.
- Document this in the planner's NOTES — Phase 10 / Phase 12 may need to bump engine version after audio threshold retune.

**Warning signs:** "Why is the prediction unchanged?" bug reports after a threshold change; staleness in eval-harness vs production divergence.

### Pitfall 6: D-A2 content-type gating leaks null sub-scores into the formula

**What goes wrong:** content_type = slideshow. D-A2 says voice_clarity = null. The aggregator's `audio_perceptual_score` formula does `(voice_clarity + audio_hook + ratio_score) / 3` and gets NaN.

**Why it happens:** JavaScript arithmetic with null → NaN propagation.

**How to avoid:**
- Per-content-type formula switches (D-G3); the slideshow formula doesn't reference voice_clarity at all. See Question #8's concrete formulas below.
- Pre-formula null check: filter `[voice_clarity, audio_hook, ratio_score].filter((x): x is number => x !== null)`; average only non-null. If empty after filter, audio_perceptual_score = 0 + emit warning.
- Test surface: deterministic mock with `voice_clarity = null` + `audio_hook = null` → assert audio_perceptual_score is computed from ratio + audio_description only, no NaN.

**Warning signs:** `NaN` in `audio_perceptual_score` field of stored PredictionResult; `audio_score: null` when content_type ≠ slideshow.

### Pitfall 7: Race condition between cron upsert and predict-time match

**What goes wrong:** Cron tick is mid-flight at T=0: sound X is upserted to trending_sounds at T=1ms but embedding hasn't been computed yet (set at T=500ms). A user uploads a video using sound X at T=200ms. The match function returns no row (audio_embedding IS NULL). Fingerprint signal = false, fallback to Jaro-Winkler fires.

**Why it happens:** Cron upsert is sequential (upsert → embed → update). Inter-step exposure window of ~500ms.

**How to avoid:**
- Accept the race — it's <1s per sound, ~50 sounds/day, and the Jaro-Winkler fallback handles the gap gracefully. The next user query a minute later hits the populated embedding.
- Alternative: compute embedding BEFORE upsert. Upsert the embedding column atomically with the rest of the row. Marginal improvement, not worth the cron-path refactor.
- Document this as known minor degradation in the planner's notes.

**Warning signs:** Rate of "fingerprint match found = false despite sound name match" surveys above background rate in eval harness analysis.

## Runtime State Inventory

Phase 6 is greenfield (new columns, new RPC, new files) — NOT a rename / refactor. **Section omitted per template.**

Phase 6 DOES include a one-time backfill, but that's not "runtime state inventory" in the rename sense — it's a deliberate data migration step that the planner schedules as a task.

## Code Examples

Verified patterns from official sources:

### Embedding a single string via @google/genai

```typescript
// Source: Context7 docs for /googleapis/js-genai (embedContent method)
// + ai.google.dev/gemini-api/docs/embeddings [VERIFIED]

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const result = await ai.models.embedContent({
  model: "gemini-embedding-001",
  contents: "upbeat hip-hop track, sampled vocal hook, 90 BPM",
  config: {
    outputDimensionality: 768,
    taskType: "SEMANTIC_SIMILARITY",
  },
});

// Result shape:
// { embeddings: [{ values: number[768] }],
//   metadata: { billableCharacterCount: number } }
const vector = result.embeddings![0]!.values!;
```

### Batch embedding (for backfill script)

```typescript
// Source: Context7 docs for /googleapis/js-genai [VERIFIED]
// embedContent supports contents as string[] for batch

const result = await ai.models.embedContent({
  model: "gemini-embedding-001",
  contents: [
    "sound description 1",
    "sound description 2",
    // ... up to ~25 per batch
  ],
  config: { outputDimensionality: 768, taskType: "SEMANTIC_SIMILARITY" },
});

for (const embedding of result.embeddings!) {
  // embedding.values is number[768]
}
```

### Supabase RPC call from TypeScript

```typescript
// Source: supabase.com/docs/guides/ai/semantic-search canonical pattern [CITED]

const { data: matches, error } = await supabase.rpc(
  "match_trending_sound_by_audio",
  {
    query_embedding: vector,   // number[768]
    match_threshold: 0.80,
    match_count: 1,
  },
);

if (error) {
  // Graceful degradation: warn, fall through to null
  log.warn("pgvector match failed", { error: error.message });
  return null;
}

const bestMatch = matches?.[0] ?? null;
// bestMatch shape: { id, sound_name, sound_url, trend_phase, velocity_score, similarity }
```

### Migration SQL (full Phase 6 migration)

```sql
-- supabase/migrations/<timestamp>_phase6_audio_fingerprint.sql
-- Source: combined pattern from supabase.com/docs/guides/database/extensions/pgvector
-- + supabase.com/docs/guides/ai/semantic-search [CITED]

-- Phase 6 owns pgvector setup; Phase 8 will reuse
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Trending sounds: add embedding + description columns
ALTER TABLE trending_sounds
  ADD COLUMN IF NOT EXISTS audio_embedding vector(768),
  ADD COLUMN IF NOT EXISTS audio_description text;

-- HNSW index (recommended over ivfflat for incremental writes)
-- m=16, ef_construction=64 are pgvector defaults; tunable later if recall drops
CREATE INDEX IF NOT EXISTS trending_sounds_audio_embedding_idx
  ON trending_sounds USING hnsw (audio_embedding vector_cosine_ops);

-- Match function — single source for predict-time queries
CREATE OR REPLACE FUNCTION match_trending_sound_by_audio(
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  sound_name text,
  sound_url text,
  trend_phase text,
  velocity_score numeric,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    ts.id,
    ts.sound_name,
    ts.sound_url,
    ts.trend_phase,
    ts.velocity_score,
    1 - (ts.audio_embedding <=> query_embedding) AS similarity
  FROM trending_sounds ts
  WHERE ts.audio_embedding IS NOT NULL
    AND 1 - (ts.audio_embedding <=> query_embedding) >= match_threshold
  ORDER BY ts.audio_embedding <=> query_embedding ASC
  LIMIT LEAST(match_count, 10);
$$;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `text-embedding-004` (Google) | `gemini-embedding-001` GA | January 14, 2026 (text-embedding-004 shut down) | **Load-bearing — CONTEXT D-F1 references text-embedding-004 implicitly. Researcher locks gemini-embedding-001 as the correct choice.** |
| ivfflat as default vector index | HNSW as default vector index | pgvector 0.7.0 (March 2024); Supabase docs flipped recommendation soon after | **CONTEXT D-F2 specifies ivfflat. Researcher recommends planner override to HNSW for better incremental-write characteristics.** |
| 768-dim embedding storage (text-embedding-ada-002 era) | 768 still optimal via Matryoshka truncation of 3072 native | gemini-embedding-001 GA released 2025 | Same column dimension as legacy choice; better quality per dim; consistent storage budget |
| Inline raw SQL with pgvector operators | Supabase RPC function | Always (PostgREST hasn't supported `<=>` operator) | Wrapper-function pattern is the only canonical way |

**Deprecated/outdated:**
- `text-embedding-004`: Shut down January 14, 2026. References in CONTEXT D-F1 need replacement.
- `embedding-001` (the truly original Gemini embedding model): superseded by `gemini-embedding-001`; doesn't support outputDimensionality.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Gemini 2.5 Flash reliably emits `voice_clarity_0_10`, `audio_hook_first_2s_0_10`, ratios, and `audio_description` from a single video Files API upload with appropriate prompt + response_schema | Question #2, Pattern 1 | If reliability is <90% (i.e., Gemini frequently omits or hallucinates fields), `signal_availability.audio = false` fires often; audio signal effectively absent in production. Mitigation: Phase 6 must include a live-API smoke test on a known-good video before locking the prompt. Phase 12 benchmark surfaces the rate. |
| A2 | `gemini-embedding-001` rate limits on free tier accommodate Phase 6's traffic (10M TPM is generous; backfill of ~500 trending_sounds rows fits easily) | Question #1, Pitfall #3 | Underdocumented per-minute RPM may bite if cron + predict-time + backfill all run simultaneously. Mitigation: rate-limit in code (200ms between batches in backfill); cron computes embedding inline per-row, not in bulk. |
| A3 | 768-dim embedding gives comparable retrieval quality to 3072-dim for our description matching task | Question #1, Standard Stack | If 768 misses fingerprint matches that 3072 would catch, Phase 12 benchmark will show degraded fingerprint recall. Mitigation: column is `vector(768)` initially; can re-embed at 3072 in a later migration if needed (4× storage cost). |
| A4 | Baseline cosine similarity threshold of 0.80 is defensible | Question #5 | If threshold is too lax (0.70): false matches pollute audio_score with phase boosts from wrong sounds. Too strict (0.90): real matches missed; Jaro-Winkler fallback runs more often. Mitigation: env-overridable; Phase 12 benchmark validates; Phase 10 may revise. |
| A5 | Awaiting the Gemini promise inside the audio_fingerprint stage preserves D-A1's "zero extra Gemini calls" constraint | Question #3 | The text embedding IS a Gemini call. D-A1's wording focuses on VIDEO analysis; embeddings are explicitly acknowledged. **Confirmed semantically consistent — D-F1 + D-A1 are reconciled.** |
| A6 | `trending_sounds.trend_phase` column already exists with `emerging` / `rising` / `peak` / `declining` values | Question #6 | **VERIFIED** via `src/types/database.types.ts:1253` (column exists) + `src/app/api/cron/calculate-trends/route.ts:167-179` (classifyTrendPhase emits exactly these 4 values). No new migration needed for the column. |
| A7 | The pgvector match function should NOT enforce RLS — trending_sounds is global data, not user-scoped | Pattern 3 | Adding RLS would block service-role lookups during prediction; current pattern bypasses RLS via service client. Document this in the migration. |
| A8 | Phase 5 wave3-style stub doesn't exist for audio_fingerprint — D-A4 says rename audio_analysis stage in place | Question #11 | Verified: pipeline.ts:375 is a `timed("audio_analysis", ...)` block returning `null`. Phase 6 renames the timed name to `"audio_fingerprint"` and fills the body. **CONFIRMED — no stub-file pattern to follow; rename + fill in place.** |
| A9 | Phase 5 (running in parallel Wave 4) will NOT modify the extended `gemini_video_analysis` schema | Question #2 | If Phase 5 also widens VIDEO_RESPONSE_SCHEMA (e.g., hook visual sub-fields), there's a merge conflict in `gemini.ts`. Mitigation: Phase 5 + Phase 6 plans must coordinate via the planner's wave-merge protocol; both are additive schemas; merge is mechanical. |
| A10 | The cosine similarity threshold of 0.80 won't conflict with the existing Jaro-Winkler threshold of 0.7 in `trends.ts` | Question #7 | These are different distance metrics on different inputs; not directly comparable. Both stay independent; Phase 12 surfaces if either needs tuning. |

**Confirmation requested from user via discuss-phase:**

- **A1** (Gemini reliability) — user should know that audio sub-scores may be lower-quality than visual sub-scores; we'll degrade gracefully but the signal may add less value than D-G1's 0.05-0.10 weight assumes. Phase 12 benchmark will measure.
- **A2/A4** (rate limits and threshold) — purely technical; Claude's discretion per CONTEXT.

## Open Questions

1. **Should the audio_fingerprint stage's similarity threshold be ENV-overridable or hardcoded?**
   - What we know: D-G2 has fixed phase boost values; CONTEXT D-claude's discretion says threshold is Claude's call.
   - What's unclear: Whether Phase 10/12 will need to retune the threshold often (yes → env) or just once (no → hardcoded constant).
   - Recommendation: Env-overridable (`AUDIO_FINGERPRINT_SIMILARITY_THRESHOLD`, default 0.80) — matches the existing `NICHE_CONFIDENCE_THRESHOLD` env pattern from Phase 4 D-08 / Claude's discretion. Cheap.

2. **Should the backfill script run as a separate `tsx` invocation or as a one-off cron route hit?**
   - What we know: D-F4 says "scripts/backfill-trending-sound-embeddings.ts" — implies a tsx script.
   - What's unclear: Vercel cron route would auto-run but the timing is unpredictable; tsx script needs an operator to invoke.
   - Recommendation: tsx script per D-F4. Document the run command in the plan. The plan owner runs it once after migration is applied.

3. **Does Phase 6 need a smoke test against the LIVE Gemini API to verify audio field reliability?**
   - What we know: Existing tests mock @google/genai. CONTEXT D-A1's load-bearing assumption is "Gemini Flash reliably emits audio fields in same response."
   - What's unclear: Without a live smoke test, A1 stays speculative until production traffic surfaces failures.
   - Recommendation: Add a Phase 6 plan task: "Run a manual end-to-end audio smoke test against a known-good talking_head video + slideshow video + tutorial video using the actual Gemini API. Document the response JSON in `.planning/phases/06-audio-analysis-fingerprint-matching/smoke-test-results.md`. Pass the test before marking Phase 6 SC#1 met." This is the kind of empirical verification that prevents A1 from being a foundation crack.

4. **Should `audio_description` be persisted on `analysis_results` for debugging / future ML training?**
   - What we know: D-F1 doesn't address persistence of the predict-time description; only the trending_sounds-side description is persisted.
   - What's unclear: Without persistence, we can't audit "why did this video match sound X?" or retrain on description-quality features later.
   - Recommendation: YES, persist on analysis_results. Add `audio_description text` column (small text). Phase 10 ML audit may want to train on these later. Cheap.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@google/genai` SDK | Audio extraction + text embedding | YES | 1.41.0 (in `package.json`); 2.4.0 latest | None — pinned version supports embedContent |
| `gemini-embedding-001` API access | Text embedding | YES via existing `GEMINI_API_KEY` | GA April 2026 | None — model is GA, paid + free tiers active |
| Supabase pgvector extension | Vector storage + similarity index | YES (Supabase auto-includes) | 0.7+ (latest 0.8.2) | Migration installs via `CREATE EXTENSION IF NOT EXISTS vector` — idempotent |
| Supabase service client | RPC calls + writes | YES (`createServiceClient` in `src/lib/supabase/service.ts`) | existing | None — used throughout codebase |
| Existing `trending_sounds` table | Vector column target | YES, schema verified | populated by cron path | None — table is in production |
| Existing `trend_phase` column | Velocity classification (AUDIO-06) | YES (`src/types/database.types.ts:1253`) | values: emerging/rising/peak/declining | None — column + values verified |
| Vercel cron infrastructure | Embedding population for new sounds | YES (existing `/api/cron/calculate-trends`) | Hourly trigger configured in `vercel.json` | None — cron is operational |
| Vitest test runner | Test coverage for Phase 6 modules | YES | 4.0.18, 80% threshold on `src/lib/engine/**` | None — established |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

**Notes:**
- `GEMINI_API_KEY` is already configured (used by `gemini.ts` and Wave 0 detectors). The embedding API uses the same key.
- pgvector extension may already be installed in some environments (Phase 8 plans to use it). Migration must use `CREATE EXTENSION IF NOT EXISTS` to be idempotent.
- The cosine similarity threshold (0.80) is parameterized in the RPC call, not the schema — so no migration change is needed if threshold tuning happens later.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` (80% coverage threshold on `src/lib/engine/**`) |
| Quick run command | `npx vitest run src/lib/engine/__tests__/audio-fingerprint.test.ts src/lib/engine/__tests__/audio-perceptual.test.ts` |
| Full suite command | `npm test` |
| Coverage scope | `src/lib/engine/**/*.ts` (excludes `__tests__`, `types.ts`, `*.json` data files) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUDIO-01 | audio_fingerprint stage returns real result object (not null) | unit | `npx vitest run src/lib/engine/__tests__/audio-fingerprint.test.ts -t "returns AudioFingerprintResult"` | ❌ Wave 0 |
| AUDIO-02 | voice_clarity_0_10 field extracted from Gemini response with content-type gating | unit | `npx vitest run src/lib/engine/__tests__/audio-perceptual.test.ts -t "voice_clarity null for slideshow"` | ❌ Wave 0 |
| AUDIO-03 | audio_hook_first_2s_0_10 field extracted (0-10 integer) | unit | `npx vitest run src/lib/engine/__tests__/audio-perceptual.test.ts -t "audio_hook range"` | ❌ Wave 0 |
| AUDIO-04 | silence/voiceover/music ratios sum to 1.0 (with normalization tolerance) | unit | `npx vitest run src/lib/engine/__tests__/audio-perceptual.test.ts -t "ratio normalization"` | ❌ Wave 0 |
| AUDIO-05 | pgvector cosine match returns sound + similarity when above threshold | unit (mocked Supabase) | `npx vitest run src/lib/engine/__tests__/audio-fingerprint.test.ts -t "pgvector match above threshold"` | ❌ Wave 0 |
| AUDIO-05 | Fingerprint match takes priority; Jaro-Winkler runs only when audio_fingerprint = false | unit | `npx vitest run src/lib/engine/__tests__/trends.test.ts -t "fallback to fuzzy match when audio_fingerprint absent"` | partial — `trends.test.ts` exists, needs new cases |
| AUDIO-06 | matched_trend includes trend_phase value (emerging/rising/peak/declining) | unit | `npx vitest run src/lib/engine/__tests__/audio-fingerprint.test.ts -t "returns trend_phase from matched sound"` | ❌ Wave 0 |
| HOOK-02 | audio_hook_first_2s_0_10 emits when content_type ∈ {talking_head, tutorial, vlog, other} | unit | (same as AUDIO-03) | ❌ Wave 0 |
| AGG-01 | SignalAvailability widens with audio + audio_fingerprint keys | unit | `npx vitest run src/lib/engine/__tests__/aggregator.test.ts -t "audio availability"` | partial — extend |
| AGG-02 | selectWeights includes audio in weight math when audio: true | unit | `npx vitest run src/lib/engine/__tests__/aggregator.test.ts -t "audio in weight redistribution"` | partial — extend |
| AGG-04 | PredictionResult includes audio_perceptual_score, audio_fingerprint result fields | unit | `npx vitest run src/lib/engine/__tests__/aggregator.test.ts -t "PredictionResult audio fields"` | partial — extend |
| AGG-05 | Existing 465 tests still pass (additive change) | full suite | `npm test` | partial — must run after every wave merge |
| AGG-06 | Aggregator handles dynamic redistribution with audio absent | unit | `npx vitest run src/lib/engine/__tests__/aggregator.test.ts -t "redistribution when audio absent"` | partial — extend |
| — | Per-content-type formula switching (audio_perceptual_score) | unit | `npx vitest run src/lib/engine/__tests__/audio-perceptual.test.ts -t "content-type formula"` | ❌ Wave 0 |
| — | audio_fingerprint_boost: emerging +15, rising +10, peak +5, declining -5 | unit | `npx vitest run src/lib/engine/__tests__/audio-perceptual.test.ts -t "fingerprint boost by trend_phase"` | ❌ Wave 0 |
| — | Backfill script idempotency (rerun skips done rows) | unit | `npx vitest run scripts/__tests__/backfill-trending-sound-embeddings.test.ts` | ❌ Wave 0 |
| — | Cron extension embedding failure tolerance | unit | `npx vitest run src/app/api/cron/calculate-trends/__tests__/route.test.ts -t "embedding failure does not block upsert"` | ❌ Wave 0 (or extend) |
| — | FeatureVector.audioTrendingMatch populated from cosine (fingerprint) or fuzzy (fallback) | unit | `npx vitest run src/lib/engine/__tests__/aggregator.test.ts -t "audioTrendingMatch source"` | partial — extend |

### Sampling Rate

- **Per task commit:** `npx vitest run src/lib/engine/__tests__/{audio-fingerprint,audio-perceptual}.test.ts` (quick, < 5s for the audio subset)
- **Per wave merge:** `npm test` (full suite, must stay green; ~ 30-60s)
- **Phase gate:** Full suite green before `/gsd-verify-work`; plus the manual smoke test from Open Question #3 documented in `smoke-test-results.md`

### Wave 0 Gaps

- [ ] `src/lib/engine/__tests__/audio-fingerprint.test.ts` — covers AUDIO-01, AUDIO-05, AUDIO-06, fingerprint stage failure paths (Q7)
- [ ] `src/lib/engine/__tests__/audio-perceptual.test.ts` — covers AUDIO-02, AUDIO-03, AUDIO-04, HOOK-02, formula switching, boost application
- [ ] `scripts/__tests__/backfill-trending-sound-embeddings.test.ts` — idempotency + rate-limit handling
- [ ] Extend `src/app/api/cron/calculate-trends/__tests__/route.test.ts` (or create) — embedding failure handling
- [ ] Extend `src/lib/engine/__tests__/trends.test.ts` — fallback gating when audio_fingerprint = false
- [ ] Extend `src/lib/engine/__tests__/aggregator.test.ts` — audio availability, weight redistribution, FeatureVector.audioTrendingMatch source switching
- [ ] Extend `src/lib/engine/__tests__/gemini.test.ts` — audio fields in VIDEO_RESPONSE_SCHEMA parse path

### Critical Sample Points (per Nyquist auditor expectation)

Below are the empirically critical boundaries Phase 6 tests MUST cover. Each maps to a failure mode that production traffic will hit if not covered:

1. **Perceptual score boundaries** (D-G3 formula): test at the EXACT boundary of each content-type case:
   - `voice_clarity = 0`, `audio_hook = 0`, balanced ratios → audio_perceptual_score floor (0)
   - `voice_clarity = 10`, `audio_hook = 10`, voiceover_ratio = 0.95 → audio_perceptual_score ceiling (100) for voice-driven formula
   - `music_ratio = 1.0`, voice_clarity/audio_hook null (slideshow) → ambient-driven formula gives reasonable score (not 0, not NaN)
2. **Fingerprint threshold boundary**: test at 0.7999, 0.8000, 0.8001 cosine similarity. Pgvector RPC's `>= match_threshold` is inclusive.
3. **Content-type gating edge cases**: test `content_type = other` (D-A2 says "full audio scoring"), `content_type = null` (Wave 0 failure — D-G3 doesn't specify but the safe behavior is "other" passthrough), `content_type = vlog` (voice-driven per D-G3).
4. **Trend phase boost boundary**: each of {emerging, rising, peak, declining, null} maps to the correct delta {+15, +10, +5, -5, 0}.
5. **Failure-mode coverage** (each graceful-degradation path documented in Question #7):
   - Path A: Gemini returns video fields, audio fields invalid → audio = false, audio_fingerprint = false, warning emitted
   - Path B: Audio description present but too short / embedding fails → audio_fingerprint = false, fallback to Jaro-Winkler fires
   - Path C: Embedding succeeds but pgvector returns no row above threshold → audio_fingerprint = false, fallback fires
   - Path D: pgvector RPC throws → captured to Sentry, audio_fingerprint = false, fallback fires
6. **Confidence interval validation**: Phase 12 benchmark surfaces actual fingerprint precision/recall on the 225-row corpus. Target: ≥75% precision (false matches < 25% of total matches) and ≥30% recall (catches at least 30% of true sound usages — gold standard would require labeling, which we DO have via clockworks `sound_name` populated on 100% of corpus rows per `.planning/research/v2.1-baseline.md`).

### Manual / non-automated tests

- **Manual smoke test (gate):** Run the actual `/api/analyze` route end-to-end against three known-good videos (one talking_head, one slideshow, one tutorial) using the real Gemini API. Verify audio fields populate correctly; verify audio_description is 50-150 chars + plausible; verify pgvector match returns expected sound when video uses a known trending sound. Document outputs in `.planning/phases/06-audio-analysis-fingerprint-matching/smoke-test-results.md`. **This is the only check that verifies A1 (Gemini reliability) before production traffic surfaces failures.**

## Security Domain

> `security_enforcement` not explicitly set to `false` in `.planning/config.json` (config doesn't explicitly enable or disable it — treat as enabled per template rule).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth surface (Phase 6 doesn't add public endpoints; backfill is operator-only via tsx) |
| V3 Session Management | no | Same as V2 |
| V4 Access Control | yes — limited | Cron route already has `verifyCronAuth(request)`; RPC function is callable by service client only (no anon access); backfill script uses service client (RLS bypassed); audio_embedding column is read-only via match function — no direct end-user write path |
| V5 Input Validation | yes | Zod validation on extended Gemini response (existing pattern); Zod validation on new types (AudioFingerprintResult); RPC function parameters are typed at the SQL layer (vector(768), float, int — no SQL injection vector); pre-pass length check on audio_description (must be ≥10, ≤200 chars before embedding) |
| V6 Cryptography | no | No new crypto; embeddings are non-secret |

### Known Threat Patterns for Next.js + Supabase + Gemini stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection into Gemini via user-uploaded video description | Tampering | Audio fields come from Gemini's own analysis of the video, not from user input. The audio_description is Gemini-emitted, not user-supplied. Match function uses the embedding (vector), not the raw text — so even if a malicious description embedding is computed, it can only match similar embeddings; it can't escape into SQL. |
| pgvector dimension confusion DoS | Denial of Service | RPC function signature requires `vector(768)`; passing wrong dimension errors immediately. Mitigation: catch the error, log, return null, fall through to Jaro-Winkler. |
| Cosine similarity flooding (force many matches by adversarial query) | DoS | LIMIT in RPC function bounded to 10 (LEAST(match_count, 10)). HNSW index makes the query O(log n), so even adversarial inputs are sub-second. |
| Service role key leakage via embedding cost telemetry | Information Disclosure | Stage events carry `cost_cents` numeric but not the full Gemini response. Service keys are only on the backend; never in stage events. |
| Backfill script API key checked into git | Information Disclosure | Backfill reads `GEMINI_API_KEY` from `process.env`; never hardcoded. The script is run via tsx with env loaded; matches existing CLI patterns in `src/lib/engine/corpus/cli/`. |

**Phase 6 introduces NO new public endpoints, NO new auth flows, NO new user-input ingress paths.** All new code paths operate on Gemini-derived or operator-derived data. Threat surface is minimal.

## Architecture Q&A — Detailed Answers (planner-facing)

> Plain-prose answers to each of the 14 questions from the additional_context, suitable for the planner to lift directly into PLAN tasks.

### Q1. Gemini text embedding endpoint + dimensionality

**Endpoint:** `ai.models.embedContent({ ... })` in `@google/genai` SDK (already in package.json at 1.41.0; latest is 2.4.0; both support it).

**Model name:** `gemini-embedding-001` (GA April 2026 flagship). **NOT** `text-embedding-004` (deprecated Jan 14, 2026). **NOT** `gemini-embedding-2` (newer but $0.20/M vs $0.15/M, multimodal capabilities we don't need).

**Dimensionality:** Default 3072; truncatable to **768** (recommended) or 1536 via `outputDimensionality` config option. Matryoshka Representation Learning means quality at 768 is near-equivalent to 3072 for similarity tasks. Auto-normalized for cosine.

**pgvector column dimension:** `vector(768)` matches the truncated embedding. Within pgvector HNSW's 2000-dim limit.

**Exact API call shape:**
```typescript
const result = await ai.models.embedContent({
  model: "gemini-embedding-001",
  contents: "audio description string",     // or string[] for batch
  config: {
    outputDimensionality: 768,
    taskType: "SEMANTIC_SIMILARITY",          // symmetric similarity
  },
});
const vector = result.embeddings![0]!.values!;  // number[768]
const cost = result.metadata?.billableCharacterCount; // for cost tracking
```

**Cost-per-call:** $0.15 per 1M input tokens (standard tier). At ~50 sounds/day × ~200 chars/description ≈ 10,000 chars ≈ ~3,000 tokens (chars / 4 rule of thumb) ≈ $0.00045/day for cron. Backfill of 500 sounds: 1.5M chars ≈ ~400k tokens ≈ ~$0.06 one-time. Predict-time: 1 call per analysis ≈ ~50 tokens × $0.15/M ≈ $0.0000075 per analysis. **Well under the $0.025/day ceiling in D-F4.**

**Rate limits:** 10M TPM on free tier (very generous). Per-RPM not surfaced in fetched docs; can hit a per-second burst if naive. Backfill stays under 25 calls/200ms = 125/sec which is well within any plausible RPM ceiling.

**Sources:** Context7 docs for `/googleapis/js-genai`; [Gemini Embedding docs](https://ai.google.dev/gemini-api/docs/embeddings); [pricing](https://tokenmix.ai/blog/gemini-embedding-001-dimensions-pricing-guide-2026); [GA blog](https://developers.googleblog.com/gemini-embedding-available-gemini-api/).

### Q2. Extended gemini_video_analysis prompt + response schema

**Schema additions** (TypeScript-side Zod, then add to VIDEO_RESPONSE_SCHEMA Type-object):

```typescript
// src/lib/engine/types.ts — append after GeminiVideoSignalsSchema
export const GeminiAudioSignalsSchema = z
  .object({
    voice_clarity_0_10: z.number().min(0).max(10).nullable(),
    audio_hook_first_2s_0_10: z.number().min(0).max(10).nullable(),
    silence_ratio: z.number().min(0).max(1),
    voiceover_ratio: z.number().min(0).max(1),
    music_ratio: z.number().min(0).max(1),
    audio_description: z.string().min(10).max(200),
  })
  .refine(
    (d) =>
      Math.abs(d.silence_ratio + d.voiceover_ratio + d.music_ratio - 1.0) < 0.1,
    {
      message: "ratios must sum to ~1.0 (tolerance 0.1)",
    },
  );

export type GeminiAudioSignals = z.infer<typeof GeminiAudioSignalsSchema>;

export const GeminiVideoResponseSchema = GeminiResponseSchema.extend({
  video_signals: GeminiVideoSignalsSchema,
  audio_signals: GeminiAudioSignalsSchema,
});
```

**Prompt additions** (append to `buildVideoPrompt` in `gemini.ts` after the video_signals section):

```
## Audio Signals (additional audio-specific evaluation)

Analyze the audio track of the video and emit:

- **voice_clarity_0_10**: Clarity and intelligibility of any spoken voice (0-10). 0 = no voice, muddy, or hard to understand; 10 = crystal-clear professional voiceover. **Return null if no voice is present in the video.**
- **audio_hook_first_2s_0_10**: Audio impact of the first 2 seconds (0-10). 0 = silent or unremarkable; 10 = striking hook (catchy beat, intriguing voice line, or attention-grabbing music). **Return null if no voice AND no music in the first 2 seconds.**
- **silence_ratio**: Fraction of the video with no audible content (0.0-1.0).
- **voiceover_ratio**: Fraction of the video with spoken voice (0.0-1.0).
- **music_ratio**: Fraction of the video with music or non-voice audio (0.0-1.0).

**The three ratios MUST sum to exactly 1.0.** Rebalance internally before emitting.

- **audio_description**: 50-150 character description of the audio. Describe genre, tempo, mood, and any distinctive elements (e.g., "upbeat hip-hop track, sampled vocal hook 'oh la la', 90 BPM, female lead"). For voice-only content, describe tone and pace (e.g., "calm female voiceover, slow pace, no music"). For silent content, write "silent" or "ambient room tone only".

## Content-Type-Specific Gating

You will be told the content type below. Apply these rules:
- talking_head / tutorial / vlog / other: emit all audio fields (voice_clarity and audio_hook are numbers, not null)
- slideshow / b_roll / action: voice_clarity_0_10 and audio_hook_first_2s_0_10 MUST be null; emit the ratios and audio_description normally
```

**Note on content-type gating:** The content_type comes from Wave 0 BEFORE the Gemini video analysis runs. Phase 6's plan must pass `wave0Result.content_type?.type` into `analyzeVideoWithGemini` as a new argument (currently it accepts `niche` only).

**Watch out:**
- Gemini Flash-lite is known to fudge constrained-arithmetic outputs (Pitfall 1). The Zod refinement above has a 0.1 tolerance; planner must normalize values when they're within tolerance.
- Audio_description min length of 10 chars is defensive against Gemini returning "no audio" or empty strings; the embedding step needs non-trivial text.

### Q3. audio_fingerprint stage architecture in Wave 1

**Recommendation: Option A — share the Gemini promise.**

The audio_fingerprint stage runs in parallel with the other Wave 1 siblings (creator, rules), but internally awaits the `geminiPromise` for the `audio_description` string, then runs its own embedding + pgvector match. SSE events fire at the boundaries of the audio_fingerprint stage (start at Wave 1 entry, end after the RPC match completes — usually shortly after Gemini's stage_end). This preserves the parallel-siblings UX contract from Phase 3 D-01.

```typescript
// Inside runPredictionPipeline, in the Wave 1 block (replace existing audioPromise):

const audioFingerprintPromise = (async (): Promise<AudioFingerprintResult | null> => {
  const startTs = emitStageStart(onStageEvent, "audio_fingerprint", 1);
  let costCents = 0;
  try {
    // Sub-dependency: wait for Gemini to emit audio_description
    const geminiResult = await geminiPromise;
    const audioDescription = geminiResult.analysis.audio_signals?.audio_description;
    if (!audioDescription || audioDescription.length < 10) {
      emitStageEnd(onStageEvent, "audio_fingerprint", 1, startTs, {
        cost_cents: 0, ok: true, warning: "no_audio_description",
      });
      return null;  // signal_availability.audio_fingerprint = false; fallback runs
    }

    // Embed and match
    const result = await runAudioFingerprintMatch(audioDescription, supabase);
    costCents = result.cost_cents;

    emitStageEnd(onStageEvent, "audio_fingerprint", 1, startTs, {
      cost_cents: costCents, ok: true,
      warning: result.match === null ? "no_pgvector_match_above_threshold" : undefined,
    });
    return result;
  } catch (error) {
    Sentry.captureException(error, { tags: { stage: "audio_fingerprint" } });
    emitStageEnd(onStageEvent, "audio_fingerprint", 1, startTs, {
      cost_cents: costCents, ok: false,
      warning: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
})();

// Add to Wave 1 Promise.all
const [geminiResult, audioFingerprintResult, , ruleResult] = await timed(
  "wave_1",
  timings,
  () => Promise.all([geminiPromise, audioFingerprintPromise, creatorPromise, rulePromise]),
  { wave: 1, onEvent: onStageEvent },
);
```

**Re-check D-A1:** D-A1 says "zero extra Gemini calls" specifically for video analysis. The text embedding IS a Gemini call (the same SDK, different method), but D-F1 explicitly acknowledges and requires it. So Option A doesn't violate D-A1.

**Options B (own minimal Gemini text-only description call) — REJECTED:**
- Would double the Gemini-side work (Gemini already analyzed audio; second call asks it again to describe).
- Violates the spirit of D-A1 (no extra LLM video work — and this would be redundant audio work).
- Adds latency in serial that we're trying to keep parallel.

**Options C (sequence audio_fingerprint AFTER Wave 1 in a sub-wave) — REJECTED:**
- Breaks Phase 3 D-01's stage event ordering contract.
- The "parallel sibling" UX would actually be sequential — confusing for M2 viz.
- Wave 1.5 doesn't exist; introducing it means migrating event payloads' `wave` enum.

### Q4. pgvector schema

**Recommended migration** (single, additive):

```sql
-- supabase/migrations/<timestamp>_phase6_audio_fingerprint.sql

-- Phase 6 owns pgvector setup; Phase 8 will reuse the extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Add columns to existing trending_sounds table
ALTER TABLE trending_sounds
  ADD COLUMN IF NOT EXISTS audio_embedding vector(768),
  ADD COLUMN IF NOT EXISTS audio_description text;

-- HNSW index — recommended over ivfflat for incremental-write workload
CREATE INDEX IF NOT EXISTS trending_sounds_audio_embedding_idx
  ON trending_sounds USING hnsw (audio_embedding vector_cosine_ops);

-- Match function (RPC)
CREATE OR REPLACE FUNCTION match_trending_sound_by_audio(
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  sound_name text,
  sound_url text,
  trend_phase text,
  velocity_score numeric,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    ts.id,
    ts.sound_name,
    ts.sound_url,
    ts.trend_phase,
    ts.velocity_score,
    1 - (ts.audio_embedding <=> query_embedding) AS similarity
  FROM trending_sounds ts
  WHERE ts.audio_embedding IS NOT NULL
    AND 1 - (ts.audio_embedding <=> query_embedding) >= match_threshold
  ORDER BY ts.audio_embedding <=> query_embedding ASC
  LIMIT LEAST(match_count, 10);
$$;
```

**Why HNSW over ivfflat (deviation from CONTEXT D-F2):**
- ivfflat requires data to be present to learn cluster centers; on an empty `trending_sounds` post-migration, ivfflat would build an empty index that performs poorly on the first ~50 sounds added by the next cron tick.
- HNSW builds on an empty table and adapts to incremental writes (cron path adds ~50 sounds/day).
- Supabase's own current docs explicitly recommend HNSW unless you have a special read-only use case.
- pgvector defaults (m=16, ef_construction=64) work well at our scale.

**Note on dimension choice:** 768 dims chosen for storage efficiency + HNSW's 2000-dim limit. Reverting to 3072 dims later requires a new migration (re-embed all sounds; rebuild index).

**Note on ivfflat fallback:** If pgvector version on Supabase ever predates 0.7.0 (HNSW support), the migration's `USING hnsw` will fail with a syntax error. Supabase ships 0.7+ on all new projects [VERIFIED]. Phase 6 plans should include a smoke check on the migration in a dev branch.

### Q5. Match function

**Recommendation: Supabase RPC function** (Pattern 3 above).

**Rationale:**
- PostgREST does not support pgvector `<=>` operator in raw filter clauses [CITED: supabase.com/docs/guides/ai/semantic-search].
- RPC is the canonical Supabase pattern.
- Function body is type-safe (SQL parameter types) and bounded (LIMIT 10 prevents adversarial queries).
- Function is `STABLE` (not `IMMUTABLE`) because it depends on the trending_sounds table state; allows Postgres planner to cache results within a query.

**Function body** (SQL, in migration):
```sql
-- See Q4 migration block above
```

**TypeScript caller:**
```typescript
const { data: matches, error } = await supabase.rpc(
  "match_trending_sound_by_audio",
  {
    query_embedding: queryEmbedding,
    match_threshold: parseFloat(process.env.AUDIO_FINGERPRINT_SIMILARITY_THRESHOLD ?? "0.80"),
    match_count: 1,
  },
);
if (error) {
  log.warn("pgvector match RPC failed", { error: error.message });
  return null;
}
const bestMatch = matches?.[0] ?? null;
```

**No-match case:** RPC returns empty array; `matches?.[0] ?? null` evaluates to null. signal_availability.audio_fingerprint = false; trends.ts fallback fires.

**Threshold:** 0.80 baseline. Env-overridable. Phase 12 benchmark validates against the 225-row corpus (which has `sound_name` populated for 100% of rows via clockworks — gold standard available).

### Q6. Velocity / trend_phase derivation

**VERIFIED.** The `trend_phase` column on `trending_sounds` already exists:
- `src/types/database.types.ts:1253` — `trend_phase: string | null`
- `src/app/api/cron/calculate-trends/route.ts:167-179` — `classifyTrendPhase()` function emits exactly these values: `emerging | rising | peak | declining`

**Classification logic (already shipped):**
```typescript
function classifyTrendPhase(growthRate, velocityScore, totalViews) {
  if (totalViews >= 500_000 && growthRate >= -0.2) return "peak";
  if (growthRate > 0.5 && velocityScore < 50) return "emerging";
  if (growthRate > 0.3 && velocityScore >= 50) return "rising";
  if (growthRate >= -0.1 && growthRate <= 0.3 && velocityScore >= 100) return "peak";
  return "declining";
}
```

**No new column needed.** No migration change required for AUDIO-06.

**Phase 6's audio_fingerprint stage** simply reads `trend_phase` from the matched row (it's already in the RPC's `RETURNS TABLE`) and passes it through to the aggregator for the phase boost mapping (D-G2: emerging +15, rising +10, peak +5, declining -5).

**Edge case:** `trend_phase = null` (older sounds without phase classification). Map null to 0 boost (graceful default).

### Q7. Failure semantics — graceful degradation paths

| # | Failure Path | What Happens | Result |
|---|--------------|--------------|--------|
| A | Extended gemini_video_analysis returns video fields but audio_signals missing/invalid | Zod parse fails; existing parseGeminiVideoResponse throws; geminiPromise resolves to DEFAULT_GEMINI_RESULT (no audio fields) | `signal_availability.audio = false`, `signal_availability.audio_fingerprint = false`. Audio weight redistributes per HARD-03 via selectWeights. Warning: `"Audio analysis unavailable — Gemini response missing audio fields"`. |
| B | Gemini emits audio fields but audio_description is too short (<10 chars) | audio_fingerprint stage sees the short description, returns null, emits `no_audio_description` warning. audio perceptual scores still flow through. | `signal_availability.audio = true` (perceptual scores present); `signal_availability.audio_fingerprint = false`. trends.ts fallback fires. audio_perceptual_score computed without fingerprint boost. |
| C | Audio description present, but Gemini embedContent call fails (timeout, 5xx, AbortError) | audio_fingerprint stage catches the error; returns null; emits warning. Captured to Sentry. | Same as B. |
| D | Embedding succeeds; pgvector RPC returns empty array (no match above threshold) | audio_fingerprint stage handles `matches?.[0] ?? null`; returns null; emits `no_pgvector_match_above_threshold` warning. | Same as B. |
| E | pgvector RPC throws (extension missing, function not migrated, dimension mismatch) | Caught at stage boundary; returns null; emits warning. Captured to Sentry. | Same as B. **This is the operational red flag — indicates migration didn't apply correctly.** |
| F | content_type = slideshow but Gemini emitted voice_clarity = 5 (violates D-A2 gating) | Aggregator's D-G3 formula for slideshow doesn't read voice_clarity at all; the field is unused. Audit-friendly behavior: log warning "voice_clarity emitted for non-voice content_type" but don't fail. | `signal_availability.audio = true`; audio_perceptual_score computed from ambient formula. Warning emitted for eval-harness review. |
| G | content_type = null (Wave 0 failed) | D-G3 doesn't specify behavior. **Recommendation: treat as "other"** (passthrough; balanced formula). | Same as content_type = "other". |
| H | Both extended Gemini AND fallback Jaro-Winkler fail | Compounded failure (rare). audio_perceptual_score = 0; audio weight redistributes; matched_trends = empty array. | All signals downstream of audio behave as if the analysis was text-only. Confidence drops; warning surfaces. |

**Aggregator integration semantics for signal_availability:**
- `audio` = `geminiResult.analysis.audio_signals !== undefined` (any audio fields present)
- `audio_fingerprint` = `audioFingerprintResult !== null && audioFingerprintResult.match !== null`

### Q8. Aggregator integration points

**SignalAvailability widening (`src/lib/engine/types.ts:198-206`):**
```typescript
export interface SignalAvailability {
  behavioral: boolean;
  gemini: boolean;
  ml: boolean;
  rules: boolean;
  trends: boolean;
  content_type: boolean;
  niche: boolean;
  audio: boolean;             // NEW — Phase 6 D-G1
  audio_fingerprint: boolean; // NEW — Phase 6 D-G1
}
```

**`SCORE_WEIGHT_KEYS` widening (`src/lib/engine/aggregator.ts:43`):**
```typescript
const SCORE_WEIGHT_KEYS = [
  "behavioral", "gemini", "ml", "rules", "trends",
  "audio",  // NEW — Phase 6 D-G1, participates in weight math
] as const;
// NOTE: audio_fingerprint stays OUT — provenance only, not weight-bearing
```

**`SCORE_WEIGHTS` widening (`src/lib/engine/aggregator.ts:31`):**
```typescript
const SCORE_WEIGHTS = {
  behavioral: 0.35,
  gemini: 0.25,
  ml: 0.15,
  rules: 0.15,
  trends: 0.10,
  audio: 0.05,        // Phase 6 D-G1 — planner picks 0.05 vs 0.07 vs 0.10
} as const;
// Existing weights sum to 1.00; adding 0.05 audio breaks the sum to 1.05
// Two options:
// 1. Re-scale existing weights so audio + others sum to 1.0 — VIOLATES "additive only"
// 2. Let weights sum to 1.05 — selectWeights() rescales to 1.0 anyway (line 95-99)
// Recommendation: option 2 (additive-friendly; selectWeights normalizes)
```

**`selectWeights` math:** No changes needed. Existing `selectWeights` (lines 59-102) iterates `SCORE_WEIGHT_KEYS`, filters available signals, redistributes missing weight proportionally, normalizes to sum 1.0. Adding `audio` to `SCORE_WEIGHT_KEYS` lets it participate naturally. When `audio = false` (graceful degradation), its 0.05 weight redistributes proportionally to behavioral/gemini/ml/rules/trends. **This is the magic of Phase 3 D-07's forward-compat design.**

**audio_perceptual_score formulas (D-G3 — concrete proposal for planner):**

```typescript
// src/lib/engine/audio-perceptual.ts (NEW)
import type { GeminiAudioSignals, ContentTypeSlug } from "./types";

export function computeAudioPerceptualScore(
  audio: GeminiAudioSignals,
  contentType: ContentTypeSlug | null,
): number {
  const ct = contentType ?? "other"; // null → other (passthrough/balanced)

  // Voice-driven content types (talking_head, tutorial, vlog)
  if (ct === "talking_head" || ct === "tutorial" || ct === "vlog") {
    const voiceClarity = audio.voice_clarity_0_10 ?? 0; // shouldn't be null for these types
    const audioHook = audio.audio_hook_first_2s_0_10 ?? 0;
    // Reward high voiceover_ratio for voice-driven content
    const ratioScore = audio.voiceover_ratio * 10;
    return Math.round(((voiceClarity + audioHook + ratioScore) / 3) * 10);
  }

  // Ambient-driven content types (slideshow, b_roll, action)
  if (ct === "slideshow" || ct === "b_roll" || ct === "action") {
    // voice_clarity/audio_hook ignored (D-A2)
    // Reward high music_ratio for ambient content
    const ratioScore = audio.music_ratio * 10;
    // Audio description quality inference: longer descriptions imply richer audio
    const descBonus = Math.min(2, audio.audio_description.length / 75);
    return Math.round((ratioScore + descBonus) * 10);
  }

  // "other" — balanced formula across all available sub-scores
  const components = [
    audio.voice_clarity_0_10,
    audio.audio_hook_first_2s_0_10,
    audio.voiceover_ratio * 10,
    audio.music_ratio * 10,
  ].filter((x): x is number => x !== null);
  if (components.length === 0) return 0;
  const avg = components.reduce((a, b) => a + b, 0) / components.length;
  return Math.round(avg * 10);
}
```

**audio_fingerprint_boost application (D-G2):**

```typescript
const PHASE_BOOST: Record<string, number> = {
  emerging: 15,
  rising: 10,
  peak: 5,
  declining: -5,
};
const boost = fingerprint?.match
  ? (PHASE_BOOST[fingerprint.match.trend_phase ?? ""] ?? 0)
  : 0;
const audioScoreWithBoost = Math.max(0, Math.min(100, audioPerceptualScore + boost));
```

**FeatureVector.audioTrendingMatch (D-G4):**

```typescript
// Replace aggregator.ts:211-214 (current Jaro-Winkler-only logic):
audioTrendingMatch: fingerprint?.match
  ? fingerprint.match.similarity     // 0..1 cosine
  : trendEnrichment.matched_trends.length > 0
    ? Math.min(1, Math.max(...trendEnrichment.matched_trends.map(t => t.velocity_score)) / 100)
    : null,
```

### Q9. Backfill script design

**File:** `scripts/backfill-trending-sound-embeddings.ts`

**Algorithm:**
1. `createServiceClient()` (bypass RLS).
2. Query `SELECT id, sound_name, sound_url FROM trending_sounds WHERE audio_embedding IS NULL ORDER BY velocity_score DESC LIMIT 25` (highest-priority first).
3. For each batch of 25:
   - Generate a description per sound via a separate Gemini text-only call (the trending_sounds table doesn't have video; use `sound_name + sound_url` as input). **Note: this is NOT a video call; it's a TEXT call that asks Gemini "describe what this sound URL likely contains, given the sound_name."** Cost ~$0.0001/call.
   - Alternative: fetch `sound_url` (a TikTok sound page), pass to Gemini Files API as a URL, ask for description. **More accurate but adds latency.** Recommend the text-only approach for backfill speed; Phase 12 benchmark validates if text-only descriptions are good enough.
   - Embed each description via `gemini-embedding-001` (batch call: `contents: descriptions[]`).
   - Upsert via `UPDATE trending_sounds SET audio_embedding = ?, audio_description = ? WHERE id = ?` for each.
4. Sleep 500ms between batches (rate-limit hygiene).
5. On error: exponential back-off (1s, 3s, 10s); abort after 3 attempts on same batch.
6. Idempotent: rerun without arguments re-runs from where it left off (WHERE audio_embedding IS NULL).
7. Logging: at start, log total rows to process. Per-batch: progress (X/Y). At end: total rows updated + total cost in cents + wall time.

**Cost projection:** 500 sounds × 200 chars/description ≈ 100,000 chars ≈ 25k tokens ≈ $0.0038 one-time. **Well under any reasonable ceiling.**

**Run command (documented in plan):**
```bash
npx tsx scripts/backfill-trending-sound-embeddings.ts
```

### Q10. calculate-trends cron extension

**File:** `src/app/api/cron/calculate-trends/route.ts`

**Splice point:** After line 138 (the existing batch upsert). Add a SECOND pass over the just-upserted rows to populate embeddings:

```typescript
// After existing upsert loop (around line 145):

// Phase 6 — extend cron to populate audio_embedding for newly-upserted rows
for (const record of trendRecords) {
  try {
    // Generate description (text-only Gemini call; same approach as backfill)
    const desc = await generateSoundDescription(record.sound_name, record.sound_url);
    // Embed
    const embedding = await embedAudioDescription(desc);
    // Update
    const { error } = await supabase
      .from("trending_sounds")
      .update({ audio_embedding: embedding, audio_description: desc })
      .eq("sound_name", record.sound_name);
    if (error) log.warn("Embedding update failed", { sound_name: record.sound_name, error: error.message });
  } catch (error) {
    // FAILURE-TOLERANT: sound row already upserted; just log and continue.
    // Next cron tick will retry via WHERE audio_embedding IS NULL on a backfill rerun.
    log.warn("Embedding generation failed for sound", {
      sound_name: record.sound_name,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
```

**Important:**
- Use try/catch per-row — never let one bad row block the whole cron.
- Don't await Promise.all of all 50 embeddings — sequential is fine at <1s/row × 50 = 50s budget within typical 60s Vercel cron timeout.
- If timeout pressure becomes real, switch to a SECOND cron route (`/api/cron/embed-trending-sounds`) that runs every 6 hours and uses the same `WHERE audio_embedding IS NULL` query as the backfill script.

### Q11. Stage event payload shape

The renamed `audio_fingerprint` stage emits per Phase 3 D-02's `StageEvent` discriminated union. Specific payload shapes:

```typescript
// Stage start
{
  type: "stage_start",
  stage: "audio_fingerprint",
  wave: 1,
  timestamp_ms: <performance.now() value>,
}

// Stage end (success with match)
{
  type: "stage_end",
  stage: "audio_fingerprint",
  wave: 1,
  duration_ms: <elapsed>,
  cost_cents: <embedding cost in cents, ~0.0001 typical>,
  ok: true,
}

// Stage end (success, no match above threshold)
{
  type: "stage_end",
  stage: "audio_fingerprint",
  wave: 1,
  duration_ms: <elapsed>,
  cost_cents: <embedding cost>,
  ok: true,
  warning: "no_pgvector_match_above_threshold",
}

// Stage end (no audio_description from Gemini)
{
  type: "stage_end",
  stage: "audio_fingerprint",
  wave: 1,
  duration_ms: <elapsed>,
  cost_cents: 0,  // no embedding call made
  ok: true,
  warning: "no_audio_description",
}

// Stage end (failure)
{
  type: "stage_end",
  stage: "audio_fingerprint",
  wave: 1,
  duration_ms: <elapsed>,
  cost_cents: <if embedding call started>,
  ok: false,
  warning: "<error message>",
}
```

**No new event types.** The existing `StageEvent` discriminated union from `src/lib/engine/events.ts` already accommodates `audio_fingerprint`.

### Q12. Tests required to hit Vitest 80% threshold

See **Phase Requirements → Test Map** above and **Wave 0 Gaps** in Validation Architecture. Summary:

**New test files (Wave 0 must create):**
- `src/lib/engine/__tests__/audio-fingerprint.test.ts` (~10 cases covering AUDIO-01, AUDIO-05, AUDIO-06, failure paths A/B/C/D/E)
- `src/lib/engine/__tests__/audio-perceptual.test.ts` (~12 cases covering AUDIO-02, AUDIO-03, AUDIO-04, HOOK-02, content-type formula switching, boost application, ratio normalization)
- `scripts/__tests__/backfill-trending-sound-embeddings.test.ts` (~4 cases: idempotency, rate limit backoff, batch resumption, ON CONFLICT semantics)
- `src/app/api/cron/calculate-trends/__tests__/route.test.ts` (~3 cases: embedding failure tolerance, sequential per-row processing, log emission on partial failure) — may need to be the first cron route test in the codebase

**Existing test files to extend:**
- `src/lib/engine/__tests__/gemini.test.ts` — add cases for parsing extended VIDEO_RESPONSE_SCHEMA with audio_signals
- `src/lib/engine/__tests__/trends.test.ts` — add case for "Jaro-Winkler skipped when signal_availability.audio_fingerprint = true"
- `src/lib/engine/__tests__/aggregator.test.ts` — add cases for audio availability widening, weight redistribution with audio absent, FeatureVector.audioTrendingMatch source switching

**Test surface count:** ~35 new test cases across 7 files. Should hit 80% threshold on new modules + maintain 80%+ on extended modules.

### Q13. Migration scope

**Single migration recommended.**

```
supabase/migrations/<timestamp>_phase6_audio_fingerprint.sql
```

Single migration covers:
- `CREATE EXTENSION IF NOT EXISTS vector`
- `ALTER TABLE trending_sounds ADD COLUMN audio_embedding vector(768)`
- `ALTER TABLE trending_sounds ADD COLUMN audio_description text`
- `CREATE INDEX ... USING hnsw (audio_embedding vector_cosine_ops)`
- `CREATE FUNCTION match_trending_sound_by_audio(...)`

Plus optional: persist `audio_description` on `analysis_results` for debugging (per Open Question #4 recommendation):
- `ALTER TABLE analysis_results ADD COLUMN audio_description text`

**Filename pattern:** `<YYYYMMDDHHMMSS>_phase6_audio_fingerprint.sql` — matches existing `20260517120000_phase3_pipeline_columns.sql` style.

**Migration is fully idempotent** via `IF NOT EXISTS` / `OR REPLACE` clauses.

**Rollback strategy:** Migration is additive only. To roll back: drop the function, drop the index, drop the columns. The vector extension stays (Phase 8 needs it).

### Q14. Validation Architecture section

**Provided above as the standalone "Validation Architecture" section.** Includes test framework details, requirement-to-test mapping, sampling rate, Wave 0 gaps, and critical sample points (Nyquist auditor consumes this).

## Sources

### Primary (HIGH confidence)
- Context7 library `/googleapis/js-genai` — embedContent method, EmbedContentConfig, EmbedContentParameters interfaces (fetched via `ctx7 docs` CLI; covers TypeScript SDK shape precisely)
- [Gemini Embeddings docs](https://ai.google.dev/gemini-api/docs/embeddings) — model selection (gemini-embedding-001 GA), dimensionality (768/1536/3072), Matryoshka behavior
- [Gemini embedding GA blog](https://developers.googleblog.com/gemini-embedding-available-gemini-api/) — production-ready status, MTEB performance
- [Supabase semantic search guide](https://supabase.com/docs/guides/ai/semantic-search) — canonical RPC function pattern with cosine distance + match_threshold
- [Supabase pgvector docs](https://supabase.com/docs/guides/database/extensions/pgvector) — extension install + index creation syntax
- [Supabase HNSW docs](https://supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes) — recommendation of HNSW + cosine operator syntax
- `src/lib/engine/pipeline.ts:375` — verified existing `audio_analysis` no-op stage location
- `src/lib/engine/aggregator.ts:211-214` — verified existing `audioTrendingMatch` field population logic
- `src/lib/engine/trends.ts:37-83` — verified existing Jaro-Winkler match loop (becomes fallback)
- `src/types/database.types.ts:1242-1289` — verified existing `trending_sounds` schema (no embedding column yet) + `trend_phase` column existence
- `src/app/api/cron/calculate-trends/route.ts:167-179` — verified `classifyTrendPhase` emits emerging/rising/peak/declining
- `vitest.config.ts` — verified 80% coverage threshold on `src/lib/engine/**`

### Secondary (MEDIUM confidence — verified with multiple sources)
- [Gemini Embedding 2 pricing comparison](https://tokencost.app/blog/gemini-embedding-2-pricing) — $0.15/M vs $0.20/M pricing context
- [pgvector v0.7.0 release notes](https://supabase.com/blog/pgvector-0-7-0) — HNSW support since 0.7.0 (March 2024)
- [pgvector HNSW vs ivfflat](https://medium.com/@philmcc/pgvector-index-selection-ivfflat-vs-hnsw-for-postgresql-vector-search-6eff26aaa90c) — recommendation rationale for small datasets
- [Gemini task types](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/embeddings/task-types) — SEMANTIC_SIMILARITY task type for symmetric similarity
- [TokenMix Gemini embedding guide 2026](https://tokenmix.ai/blog/gemini-embedding-001-dimensions-pricing-guide-2026) — current pricing + dimensions

### Tertiary (LOW confidence — marked for validation)
- Rate limits for `gemini-embedding-001` free tier — documentation does not surface RPM clearly; assumption A2 covers this
- Gemini Flash audio reliability — assumption A1 covers this; manual smoke test recommended in Open Question #3 to verify

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library version verified via npm/Context7/docs.
- Gemini text embedding model + dimensionality: HIGH — Context7 + official docs both confirm `gemini-embedding-001` + outputDimensionality + SEMANTIC_SIMILARITY task type.
- pgvector + HNSW: HIGH — Supabase docs explicit; HNSW recommended over ivfflat for the workload shape; deviation from CONTEXT D-F2 is documented.
- Architecture (Wave 1 sub-await): MEDIUM — Option A is sound but creates a sub-dependency that produces UX nuance (audio_fingerprint stage_end fires after Gemini stage_end). Documented as known tradeoff in Pitfall 2.
- Pitfalls: HIGH for #1-5 (mechanical/empirical); MEDIUM for #6-7 (logical, derived).
- Failure semantics: HIGH — each path mapped to existing graceful-degradation pattern from Phase 1.
- Aggregator integration: HIGH — extends existing Phase 3 D-07 forward-compat shape.
- Cost projections: HIGH (backfill + cron) — math confirmed against known pricing.
- Gemini Flash audio reliability: MEDIUM (A1) — assumption needs live smoke test before production.

**Research date:** 2026-05-18
**Valid until:** 2026-06-17 (30 days; Gemini SDK + pgvector docs are stable; Gemini text embedding model is GA + actively supported)

---

## RESEARCH COMPLETE

**Phase:** 6 - Audio Analysis + Fingerprint Matching
**Confidence:** HIGH on the stack and migration; MEDIUM on the architectural sub-dependency (Wave 1 audio_fingerprint awaits Gemini promise) and on Gemini Flash audio-field reliability (mitigated by Open Question #3 smoke test).

### Biggest findings (one-paragraph summary)

Phase 6 is buildable today with zero new vendors, zero new npm dependencies, and a single Supabase migration. The canonical stack is the same `@google/genai` SDK already in the codebase but invoked via `embedContent({ model: "gemini-embedding-001", config: { outputDimensionality: 768, taskType: "SEMANTIC_SIMILARITY" } })` — `text-embedding-004` mentioned implicitly in CONTEXT D-F1 was shut down January 14, 2026 and must be replaced. Two non-trivial deviations from CONTEXT.md surface: (1) **HNSW index over ivfflat** because Supabase's own current docs recommend HNSW for write-incremental small datasets like our cron-grown trending_sounds table (CONTEXT D-F2 explicitly specifies ivfflat — planner should override based on this evidence); and (2) the `audio_fingerprint` Wave 1 stage MUST await the Gemini promise internally because Gemini's `audio_description` field is the embedding input (Option A from Question #3), creating a parallel-but-chained UX where the stage's start event fires alongside Gemini's but its end event lands shortly after. The single Phase 6 migration installs pgvector, adds `audio_embedding vector(768)` + `audio_description text` columns on `trending_sounds`, creates an HNSW cosine index, and registers a `match_trending_sound_by_audio` RPC — Phase 8 reuses the extension. All other architectural decisions (failure semantics, aggregator integration, formulas per D-G3, backfill script) extend established Phase 1/3/4 patterns cleanly.

### 1-2 sharpest open questions for the planner

1. **CONTEXT D-F2 says ivfflat; this research recommends HNSW. Will the planner accept the deviation, or does it need to round-trip back to discuss-phase for a user override?** The technical case for HNSW is strong (Supabase's own docs flipped the recommendation; the cron-grown 50-sound/day workload is exactly what ivfflat handles worst; pgvector defaults work fine). My recommendation: planner accepts the override and locks HNSW in the plan, citing this research's State of the Art section. But if the planner wants user-level sign-off because D-F2 is a LOCKED decision, the round-trip is one question to discuss-phase.

2. **A1 (Gemini Flash audio reliability) is the biggest hidden risk in Phase 6.** The entire load-bearing premise of D-A1 — that Gemini reliably emits voice_clarity, audio_hook, and ratios from a single video call — is empirically unverified in this codebase. **Open Question #3 above proposes a Phase 6 manual smoke test against three real videos using the live Gemini API before SC#1 can be marked met.** Does the planner build that smoke test as a Wave 0 task (cheapest insurance) or defer to Phase 12 benchmark (which would surface failures only AFTER all the code is written)? My recommendation: Wave 0 smoke test; document results in `smoke-test-results.md`; gate SC#1 on it. If Gemini Flash audio reliability is below ~85%, the audio signal will be effectively absent in production and Phase 10 ML audit will down-weight it to ~0 — so it's worth knowing early.

### Files Created

- `/Users/davideloreti/virtuna-engine-foundation-p6/.planning/phases/06-audio-analysis-fingerprint-matching/06-RESEARCH.md`

### Ready for Planning

Research complete. Planner can now create PLAN.md files. Recommend planner reads `<user_constraints>` and the architectural deviation table (Standard Stack > Alternatives Considered) first; everything else flows from those decisions.
