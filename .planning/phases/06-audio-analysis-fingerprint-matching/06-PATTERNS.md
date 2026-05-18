# Phase 6: Audio Analysis + Fingerprint Matching - Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 9 (4 new + 5 modified-in-place, additive-only)
**Analogs found:** 9 / 9 (every file has a direct in-repo analog)

## File Classification

| New/Modified File | New/Mod | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|---------|------|-----------|----------------|---------------|
| `supabase/migrations/<ts>_phase6_audio_fingerprint.sql` | NEW | migration | DDL + RPC function | `supabase/migrations/20260517120000_phase3_pipeline_columns.sql` + `supabase/migrations/20260213000000_content_intelligence.sql` | role-match (first pgvector migration in repo) |
| `src/lib/engine/audio-fingerprint.ts` | NEW | engine stage (Wave 1 sibling) | request-response (Gemini embed + Supabase RPC) | `src/lib/engine/wave0/content-type-detector.ts` (Gemini call shape) + `src/lib/engine/trends.ts` (Supabase fetch + match loop shape) | exact (composite) |
| `src/lib/engine/audio-perceptual.ts` | NEW | pure-function score module | transform (Gemini fields → 0-100 score) | `src/lib/engine/wave0/content-type-weights.ts` (locked matrix + pure transform pattern) | exact |
| `scripts/backfill-trending-sound-embeddings.ts` | NEW | one-off script (tsx) | batch + idempotent upsert | `scripts/import-apify-data.ts` (dotenv + service client + batch loop) + `scripts/extract-training-data.ts` (typed Database imports) | exact |
| `src/lib/engine/__tests__/audio-fingerprint.test.ts` | NEW | test (vitest) | unit (mocked @google/genai + supabase RPC) | `src/lib/engine/__tests__/wave0-content-type.test.ts` (Gemini mock pattern) + `src/lib/engine/__tests__/trends.test.ts` (supabase chain mock) | exact (composite) |
| `src/lib/engine/__tests__/audio-perceptual.test.ts` | NEW | test (vitest) | unit (pure function) | `src/lib/engine/__tests__/content-type-weights.test.ts` | role-match |
| `src/lib/engine/pipeline.ts` | MOD | orchestrator | rename stage + fill body | self (lines 374-378 + 417-422) — extending in place | exact (self-extension) |
| `src/lib/engine/gemini.ts` | MOD | LLM client | extend schema + prompt | self (lines 273-314 + 200-248) — extending in place | exact (self-extension) |
| `src/lib/engine/aggregator.ts` | MOD | aggregator | add audio signal + redistribute | self (lines 31-43 SCORE_WEIGHTS, 211-214 audioTrendingMatch, 330-349 SignalAvailability) | exact (self-extension) |
| `src/lib/engine/trends.ts` | MOD | trend enrichment | gate fuzzy loop | self (lines 50-83) — wrap in availability guard | exact (self-extension) |
| `src/lib/engine/types.ts` | MOD | type defs | add Audio* types, widen SignalAvailability | self (lines 7-47 FeatureVector, 142-187 PredictionResult, 198-206 SignalAvailability) | exact (self-extension) |
| `src/app/api/cron/calculate-trends/route.ts` | MOD | cron route | extend post-upsert with embed step | self (lines 130-145 batch upsert loop) | exact (self-extension) |

## Pattern Assignments

---

### NEW: `src/lib/engine/audio-fingerprint.ts` (engine stage, Wave 1 sibling)

**Primary analog:** `src/lib/engine/wave0/content-type-detector.ts` (Gemini call shape, logger, Sentry, schema validation)
**Secondary analog:** `src/lib/engine/trends.ts` (Supabase fetch + cache pattern)

**Imports pattern** (copy structure from `wave0/content-type-detector.ts:1-10`):
```typescript
import * as Sentry from "@sentry/nextjs";
import { GoogleGenAI } from "@google/genai";
import { createLogger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AudioFingerprintResult, GeminiVideoAnalysis } from "./types";
// NOTE: no `Type` import — audio-fingerprint does NOT define a response schema
// (description text → embedContent → vector → RPC); schema lives in gemini.ts.

const log = createLogger({ module: "audio_fingerprint" });
```

**Env-driven client + config pattern** (copy from `wave0/content-type-detector.ts:12-67`):
```typescript
const GEMINI_EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";
const SIMILARITY_THRESHOLD = Number(
  process.env.AUDIO_FINGERPRINT_SIMILARITY_THRESHOLD ?? "0.80",
);
const EMBEDDING_DIMENSIONALITY = 768; // matches migration vector(768)

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

**Stage event + try/catch/never-throw pattern** (copy structure from `wave0/content-type-detector.ts:78-230`, omit stage event emission — pipeline.ts wraps in `timed()` for that):
```typescript
// SIGNATURE: returns AudioFingerprintResult | null. Never throws (HARD-03).
// Pipeline.ts calls this inside timed("audio_fingerprint", ...), so stage events
// are emitted by the wrapper, NOT this function. Different from wave0 detectors
// (which emit their own events because they are called from runWave0 directly).
export async function matchAudioFingerprint(
  audioDescription: string | null,
  supabase: SupabaseClient,
): Promise<AudioFingerprintResult | null> {
  if (!audioDescription) {
    log.debug("No audio_description provided — skipping fingerprint match");
    return null;
  }

  try {
    const ai = getClient();
    const response = await ai.models.embedContent({
      model: GEMINI_EMBEDDING_MODEL,
      contents: audioDescription,
      config: {
        outputDimensionality: EMBEDDING_DIMENSIONALITY,
        taskType: "SEMANTIC_SIMILARITY",
      },
    });
    const queryEmbedding = response.embeddings?.[0]?.values;
    if (!queryEmbedding) {
      log.warn("embedContent returned no embedding");
      return null;
    }

    const { data: matches, error } = await supabase.rpc(
      "match_trending_sound_by_audio",
      {
        query_embedding: queryEmbedding,
        match_threshold: SIMILARITY_THRESHOLD,
        match_count: 1,
      },
    );
    if (error) {
      log.warn("pgvector match failed", { error: error.message });
      return null;
    }
    const best = matches?.[0] ?? null;
    if (!best) return null;

    return {
      sound_name: best.sound_name,
      sound_url: best.sound_url,
      similarity: best.similarity,
      trend_phase: best.trend_phase,
      velocity_score: Number(best.velocity_score) || 0,
    };
  } catch (error) {
    Sentry.captureException(error, { tags: { stage: "audio_fingerprint" } });
    log.warn("Audio fingerprint failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
```

**Error handling pattern** (copy from `wave0/content-type-detector.ts:210-219`):
```typescript
catch (error) {
  Sentry.captureException(error, { tags: { stage: "audio_fingerprint" } });
  const message = error instanceof Error ? error.message : String(error);
  log.warn("Audio fingerprint failed", { error: message });
  return null;
}
```

**Cost telemetry note** — embedContent returns `metadata.billableCharacterCount` (per RESEARCH §"Code Examples"). The embed call is cheap (~50-150 char description × $0.15/M tokens) but the stage should still report its cost. Pipeline.ts passes a `costCents` value to `timed()` via the wrapper — the stage returns the result and the wrapper invocation site computes cost.

---

### NEW: `src/lib/engine/audio-perceptual.ts` (pure transform module)

**Primary analog:** `src/lib/engine/wave0/content-type-weights.ts` — same idiom: locked matrix/coefficients + pure function returning 0-N score.

**Imports pattern** (copy from `wave0/content-type-weights.ts:1-2`):
```typescript
import type { ContentTypeSlug, AudioPerceptualResult, GeminiAudioSignals } from "./types";
```

**Locked-coefficient pattern** (copy from `wave0/content-type-weights.ts:14-23` — `CONTENT_TYPE_WEIGHT_MATRIX`):
```typescript
// Per CONTEXT D-G3 + Claude's discretion on coefficients.
// Phase 10 ML audit may revise — modification requires a Phase 10 commit + version bump.
const PERCEPTUAL_FORMULA_BY_TYPE: Record<
  ContentTypeSlug,
  // "voice" → voice-driven; "ambient" → music-heavy; "balanced" → all-sub-score
  { mode: "voice" | "ambient" | "balanced"; coefficients: Record<string, number> }
> = {
  talking_head: { mode: "voice", coefficients: { voice_clarity: 0.45, audio_hook: 0.35, voiceover_ratio: 0.20 } },
  tutorial:     { mode: "voice", coefficients: { voice_clarity: 0.40, audio_hook: 0.35, voiceover_ratio: 0.25 } },
  vlog:         { mode: "voice", coefficients: { voice_clarity: 0.35, audio_hook: 0.30, voiceover_ratio: 0.35 } },
  slideshow:    { mode: "ambient", coefficients: { music_ratio: 0.60, description_quality: 0.40 } },
  b_roll:       { mode: "ambient", coefficients: { music_ratio: 0.55, description_quality: 0.45 } },
  action:       { mode: "ambient", coefficients: { music_ratio: 0.55, description_quality: 0.45 } },
  other:        { mode: "balanced", coefficients: { /* all available */ } },
};
```

**Pure function + null clamping pattern** (copy from `wave0/content-type-weights.ts:38-55`):
```typescript
/**
 * Computes audio_perceptual_score (0-100) from Gemini audio fields.
 * Returns NEW object (does not mutate input).
 * - Null sub-scores excluded from formula (D-A2 content-type gating).
 * - Result clamped to [0, 100] BEFORE fingerprint_boost is applied by aggregator (per D-G3).
 * - Null contentType uses `other` row (balanced passthrough) — preserves Wave 0 failure contract.
 */
export function computeAudioPerceptualScore(
  signals: GeminiAudioSignals,
  contentType: ContentTypeSlug | null,
): AudioPerceptualResult { /* ... */ }
```

**Pattern source:** `wave0/content-type-weights.ts:42-54` — `clamp` helper + `Math.min(10, ...)` ceiling + `mult[contentType ?? "other"]` null fallback. Exactly mirror this shape for audio.

---

### NEW: `supabase/migrations/<ts>_phase6_audio_fingerprint.sql`

**Primary analog:** `supabase/migrations/20260517120000_phase3_pipeline_columns.sql` (idempotent ALTER TABLE idiom; IF NOT EXISTS guards; targeted ADD COLUMN).
**Secondary analog:** `supabase/migrations/20260213000000_content_intelligence.sql:65` (the existing `trending_sounds` CREATE TABLE — confirms `trend_phase` enum already supports `emerging`/`rising`/`peak`/`declining` per RESEARCH A6).

**Header + idempotency pattern** (copy from `20260517120000_phase3_pipeline_columns.sql:1-3`):
```sql
-- Phase 6: Audio Analysis + Fingerprint Matching — pgvector setup + trending_sounds embedding columns + match RPC.
-- All statements use IF NOT EXISTS for idempotent re-runs.
-- pgvector ownership: Phase 6 installs the extension; Phase 8 (competitor_videos.embedding) reuses it.
```

**ALTER TABLE idiom** (copy from `20260517120000_phase3_pipeline_columns.sql:13-18`):
```sql
ALTER TABLE trending_sounds
  ADD COLUMN IF NOT EXISTS audio_embedding vector(768),
  ADD COLUMN IF NOT EXISTS audio_description text;
```

**Index pattern** (extends the partial-index style from `20260517120000_phase3_pipeline_columns.sql:28-30`):
```sql
-- HNSW chosen over ivfflat per RESEARCH §"State of the Art" + §"Anti-Patterns".
-- HNSW builds on empty tables and adapts to incremental writes (cron path adds
-- ~50 sounds/day); ivfflat requires data to learn cluster centers, degrading
-- on incremental write workloads. CONTEXT D-F2 specified ivfflat; researcher
-- recommends override to HNSW.
CREATE INDEX IF NOT EXISTS trending_sounds_audio_embedding_idx
  ON trending_sounds USING hnsw (audio_embedding vector_cosine_ops);
```

**RPC function pattern** (no direct in-repo analog — repo has `CREATE OR REPLACE FUNCTION` for triggers only at `20260213000000_content_intelligence.sql:9-15` and `20260213140000_referral_tables.sql:86`). Follow Supabase canonical pattern from RESEARCH §"Pattern 3":
```sql
-- pgvector RPC wrapper: PostgREST cannot use <=> operator in raw filters
-- (canonical Supabase pattern per RESEARCH).
CREATE OR REPLACE FUNCTION match_trending_sound_by_audio(
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid, sound_name text, sound_url text,
  trend_phase text, velocity_score numeric, similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT ts.id, ts.sound_name, ts.sound_url, ts.trend_phase, ts.velocity_score,
         1 - (ts.audio_embedding <=> query_embedding) AS similarity
  FROM trending_sounds ts
  WHERE ts.audio_embedding IS NOT NULL
    AND 1 - (ts.audio_embedding <=> query_embedding) >= match_threshold
  ORDER BY ts.audio_embedding <=> query_embedding ASC
  LIMIT LEAST(match_count, 10);
$$;
```

**No RLS on the RPC** per RESEARCH A7 — `trending_sounds` is already public-read (`20260213000000_content_intelligence.sql:220-222`). The function inherits that and is invoked by service-role anyway.

**Filename convention:** Existing files use `YYYYMMDDhhmmss_description.sql` (e.g., `20260517120000_phase3_pipeline_columns.sql`, `20260517210000_creator_profile_9card_columns.sql`). Use today's UTC timestamp (`20260518000000_phase6_audio_fingerprint.sql`) — must sort AFTER `20260517210000` so the migration order is deterministic.

---

### NEW: `scripts/backfill-trending-sound-embeddings.ts`

**Primary analog:** `scripts/import-apify-data.ts` (dotenv + service client + batch loop).
**Secondary analog:** `scripts/extract-training-data.ts:1-10` (typed `Database` import pattern).

**Imports + env loading pattern** (copy from `scripts/import-apify-data.ts:1-6`):
```typescript
import { config } from "dotenv";
import { resolve } from "path";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.types";

config({ path: resolve(__dirname, "../.env.local") });

const BATCH_SIZE = 25; // Gemini embedContent supports contents:string[] batch
```

**Service-client init pattern** (copy from `scripts/import-apify-data.ts:128-130`):
```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("[backfill] Missing Supabase env vars in .env.local");
  process.exit(1);
}
const supabase = createClient<Database>(supabaseUrl, supabaseKey);
```

**Idempotent batch loop pattern** (copy structural shape from `scripts/import-apify-data.ts` batch upsert + `src/app/api/cron/calculate-trends/route.ts:131-145`):
```typescript
async function main() {
  let cursor: string | null = null;
  let processedCount = 0;
  let totalCost = 0;

  while (true) {
    // Idempotent via WHERE audio_embedding IS NULL — resumable on failure
    let query = supabase
      .from("trending_sounds")
      .select("id, sound_name, sound_url")
      .is("audio_embedding", null)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);
    if (cursor) query = query.gt("id", cursor);
    const { data: batch, error } = await query;
    if (error) throw new Error(`Fetch failed: ${error.message}`);
    if (!batch || batch.length === 0) break;

    // 1. Generate descriptions per sound (Gemini text completion against sound_url metadata)
    // 2. Batch embed all descriptions (contents: string[]) per RESEARCH §"Batch embedding"
    // 3. Upsert audio_embedding + audio_description in one shot per row

    // Rate-limit per RESEARCH §"Pitfall 3"
    await new Promise((r) => setTimeout(r, 200));

    cursor = batch[batch.length - 1].id;
    processedCount += batch.length;
    console.log(`[backfill] Processed ${processedCount} sounds`);
  }
}

main().catch((err) => { console.error("[backfill] Fatal:", err); process.exit(1); });
```

**Logging convention** — scripts use bracketed `console.log("[backfill] ...")`. Different from engine code (which uses `createLogger({module})`). Match the script style.

---

### MODIFIED: `src/lib/engine/pipeline.ts` (rename + fill audio_analysis stage)

**Self-analog at lines 374-378 (the existing no-op stage to rename + fill):**
```typescript
// CURRENT (line 374-378):
// Stage 4: Audio Analysis (handled via fuzzy matching in trend enrichment -- no separate stage)
const audioPromise = timed("audio_analysis", timings, async () => null, {
  wave: 1,
  onEvent: onStageEvent,
});

// REPLACE WITH (Phase 6):
// Stage 4: Audio Fingerprint -- NON-CRITICAL (graceful degradation via null return).
// Awaits geminiPromise's audio_description sub-await (Option A from RESEARCH Q3),
// preserving Wave 1 parallelism visible to SSE consumers (stage_start fires
// immediately alongside Gemini's; stage_end fires after pgvector match completes).
const audioFingerprintPromise = (async (): Promise<AudioFingerprintResult | null> => {
  try {
    return await timed("audio_fingerprint", timings, async () => {
      const geminiResult = await geminiPromise; // sub-await — fingerprint genuinely depends on description
      const audioDescription =
        geminiResult.analysis.audio_signals?.audio_description ?? null;
      return matchAudioFingerprint(audioDescription, supabase);
    }, { wave: 1, onEvent: onStageEvent });
  } catch (error) {
    Sentry.captureException(error, { tags: { stage: "audio_fingerprint", requestId } });
    warnings.push(
      `Audio fingerprint unavailable: ${error instanceof Error ? error.message : String(error)}`
    );
    timings.push({ stage: "audio_fingerprint", duration_ms: 0 });
    return null;
  }
})();
```

**Promise.all destructuring update at line 417:**
```typescript
// CURRENT:
const [geminiResult, audioResult, , ruleResult] = await timed("wave_1", ...);

// REPLACE WITH:
const [geminiResult, audioFingerprintResult, , ruleResult] = await timed("wave_1", ...);
```

**PipelineResult shape extension** (line 51-area) — add `audioFingerprintResult: AudioFingerprintResult | null` to the returned object. Match existing `wave0Result: Wave0Result` slot pattern (line 51 of pipeline.ts).

**`timed()` wrapper contract (lines 98-126)** — copy/preserve exactly. New stage name string `"audio_fingerprint"` replaces `"audio_analysis"`. The wrapper handles stage events automatically per Phase 3 D-01.

**Critical (RESEARCH Pitfall 2):** the inner `await geminiPromise` is the known tradeoff — `audio_fingerprint` `stage_start` fires immediately (visible parallelism preserved), `stage_end` fires after Gemini resolves + pgvector match completes (inevitable sequence). Document in plan.

---

### MODIFIED: `src/lib/engine/gemini.ts` (extend VIDEO_RESPONSE_SCHEMA + prompt)

**Self-analog at lines 273-314 (existing `VIDEO_RESPONSE_SCHEMA`):**
```typescript
// EXTEND IN PLACE: append `audio_signals` to properties + required[]
// Mirror the existing video_signals nested-object pattern (lines 292-306).
const VIDEO_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    factors: { /* unchanged */ },
    overall_impression: { /* unchanged */ },
    content_summary: { /* unchanged */ },
    video_signals: { /* unchanged */ },
    // NEW Phase 6 — copy from RESEARCH §"Pattern 1":
    audio_signals: {
      type: Type.OBJECT,
      properties: {
        voice_clarity_0_10: { type: Type.NUMBER, nullable: true },        // null when content_type ∈ {slideshow, b_roll, action} per D-A2
        audio_hook_first_2s_0_10: { type: Type.NUMBER, nullable: true },  // null when content_type ∈ {slideshow, b_roll, action}
        silence_ratio: { type: Type.NUMBER },
        voiceover_ratio: { type: Type.NUMBER },
        music_ratio: { type: Type.NUMBER },
        audio_description: { type: Type.STRING },
      },
      required: ["silence_ratio", "voiceover_ratio", "music_ratio", "audio_description"],
    },
  },
  required: [
    "factors", "overall_impression", "content_summary", "video_signals",
    "audio_signals",  // NEW
  ],
};
```

**`buildVideoPrompt` extension (lines 203-248):** Append a new section "Audio Signals" after the "Video Signals" section (line 222). Include explicit ratio-sum instruction per RESEARCH Pitfall 1:
```typescript
## Audio Signals (in addition to video — Gemini natively processes the audio track)

- **voice_clarity_0_10**: Speech intelligibility, SNR, articulation quality (0-10). Return null if no human speech is present.
- **audio_hook_first_2s_0_10**: Audio impact in first 2 seconds — would the user keep sound on? (0-10). Return null if no audio/silence in first 2s.
- **silence_ratio**, **voiceover_ratio**, **music_ratio**: Three fractions summing to EXACTLY 1.0. Rebalance internally before emitting.
- **audio_description**: 50-150 char natural language description of the audio (genre, mood, tempo, vocal/instrumental, lyrical hooks). Example: "upbeat hip-hop track, 90 BPM, sampled female vocal hook 'oh la la'"
```

**`GeminiVideoResponseSchema` (Zod) extension at `types.ts:259-263`** — append `audio_signals` field with Zod refinement that normalizes ratio sum within tolerance per RESEARCH Pitfall 1:
```typescript
export const GeminiAudioSignalsSchema = z.object({
  voice_clarity_0_10: z.number().min(0).max(10).nullable(),
  audio_hook_first_2s_0_10: z.number().min(0).max(10).nullable(),
  silence_ratio: z.number().min(0).max(1),
  voiceover_ratio: z.number().min(0).max(1),
  music_ratio: z.number().min(0).max(1),
  audio_description: z.string().min(1).max(300),
}).refine(
  (v) => Math.abs(v.silence_ratio + v.voiceover_ratio + v.music_ratio - 1.0) < 0.1,
  { message: "Audio ratios must sum to ~1.0 (±0.1 tolerance)" },
);
export const GeminiVideoResponseSchema = GeminiResponseSchema.extend({
  video_signals: GeminiVideoSignalsSchema,
  audio_signals: GeminiAudioSignalsSchema, // NEW
});
```

**Pattern source for Zod refinement:** `types.ts:75-83` uses `.refine()` for AnalysisInput; copy that idiom.

---

### MODIFIED: `src/lib/engine/aggregator.ts` (add audio signal)

**Self-analog at lines 31-43 (SCORE_WEIGHTS + SCORE_WEIGHT_KEYS):**
```typescript
// EXTEND IN PLACE — initial weight per D-G1 (planner picks 0.05/0.07/0.10).
// Recommended starting value: 0.07 — middle of the 0.05-0.10 range. Phase 10 ML audit retunes.
const SCORE_WEIGHTS = {
  behavioral: 0.35,
  gemini: 0.25,
  ml: 0.15,
  rules: 0.15,
  trends: 0.10,
  audio: 0.07,  // NEW Phase 6 (D-G1) — Phase 10 audit retunes
} as const;

// CRITICAL: per D-G1 + RESEARCH §"Anti-Patterns" #8 — add `audio` to SCORE_WEIGHT_KEYS
// (it IS weight-bearing). Do NOT add `audio_fingerprint` (provenance only, filtered out).
const SCORE_WEIGHT_KEYS = ["behavioral", "gemini", "ml", "rules", "trends", "audio"] as const;
```

**Self-analog at lines 86, 97 (selectWeights initialization):**
```typescript
// EXTEND IN PLACE — add `audio: 0` to result init
const result = { behavioral: 0, gemini: 0, ml: 0, rules: 0, trends: 0, audio: 0 };
```

**Self-analog at lines 211-214 (audioTrendingMatch in assembleFeatureVector — per D-G4 swap):**
```typescript
// CURRENT (line 211-214):
audioTrendingMatch: trendEnrichment.matched_trends.length > 0
  ? Math.min(1, Math.max(...trendEnrichment.matched_trends.map(t => t.velocity_score)) / 100)
  : null,

// REPLACE WITH (Phase 6 D-G4):
// Fingerprint cosine takes priority; fall back to Jaro-Winkler-derived score.
audioTrendingMatch:
  audioFingerprintResult?.similarity != null
    ? audioFingerprintResult.similarity  // 0-1 cosine when audio_fingerprint = true
    : trendEnrichment.matched_trends.length > 0
      ? Math.min(1, Math.max(...trendEnrichment.matched_trends.map(t => t.velocity_score)) / 100)
      : null,
```

**Self-analog at lines 330-349 (SignalAvailability construction — per D-G1):**
```typescript
// EXTEND IN PLACE — add audio + audio_fingerprint keys
const availability: SignalAvailability = {
  behavioral: deepseekResult !== null,
  gemini: geminiResult.analysis.factors.some((f) => f.score > 0),
  ml: mlAvailable,
  rules: ruleResult.matched_rules.length > 0 && !pipelineResult.warnings.some((w) => w.includes("Rule scoring unavailable")),
  trends: trendEnrichment.matched_trends.length > 0 && !pipelineResult.warnings.some((w) => w.includes("Trend enrichment unavailable")),
  content_type: pipelineResult.wave0Result.content_type !== null,
  niche: pipelineResult.wave0Result.niche !== null,
  // NEW Phase 6 (D-G1):
  audio: geminiResult.analysis.audio_signals !== undefined,           // weight-bearing
  audio_fingerprint: audioFingerprintResult !== null,                  // provenance only — filtered out of selectWeights
};
```

**audio_score computation (new section, place between line 378 `gemini_score` and line 380-area `ml_score`):**
- Pure inputs: `geminiResult.analysis.audio_signals`, `pipelineResult.wave0Result.content_type`, `audioFingerprintResult`
- Step 1: Call `computeAudioPerceptualScore(audio_signals, content_type)` — returns 0-100
- Step 2: Apply `audio_fingerprint_boost` per D-G2 (emerging +15, rising +10, peak +5, declining -5, none 0)
- Step 3: Clamp final to [0, 100]
- Pattern source: existing `behavioral_score` math at lines 357-368 (avg + Math.round + Math.min/Math.max clamp)

**Weighted-average extension (existing math near line 380-420 area, after individual signal scores):** Mirror existing pattern but include `weights.audio * audio_score` in the sum, only when `availability.audio === true` (selectWeights already redistributes the missing 0.07 when audio false).

---

### MODIFIED: `src/lib/engine/trends.ts` (gate Jaro-Winkler fallback)

**Self-analog at lines 50-83 (the existing match loop to gate):**

Per D-F3, wrap the Jaro-Winkler loop (lines 54-83) so it only executes when `signal_availability.audio_fingerprint === false`. The function signature must change to accept an availability hint (or the orchestrator gates the call). RESEARCH §"Pattern" recommends adding a parameter:

```typescript
// CURRENT signature (line 31-34):
export async function enrichWithTrends(
  supabase: ReturnType<typeof createServiceClient>,
  input: AnalysisInput
): Promise<TrendEnrichment>

// EXTEND TO (Phase 6 D-F3):
export async function enrichWithTrends(
  supabase: ReturnType<typeof createServiceClient>,
  input: AnalysisInput,
  opts?: { audioFingerprintMatched?: boolean }, // NEW — when true, skip Jaro-Winkler sound loop
): Promise<TrendEnrichment>
```

**Gated loop pattern (wraps line 54):**
```typescript
// CURRENT (line 54):
if (trendingSounds) {
  for (const sound of trendingSounds) { /* Jaro-Winkler match */ }
}

// REPLACE WITH (D-F3):
// Per D-F3: Jaro-Winkler runs only when audio_fingerprint failed to match.
// When audio_fingerprint succeeded, matched_trends is populated upstream
// (in aggregator from audioFingerprintResult). Single source of truth.
if (trendingSounds && !opts?.audioFingerprintMatched) {
  for (const sound of trendingSounds) { /* Jaro-Winkler match — unchanged */ }
}
```

**Pipeline call-site update (`pipeline.ts:478-479`):** pass the new opt:
```typescript
return await timed("trend_enrichment", timings, () =>
  enrichWithTrends(supabase, validated, {
    audioFingerprintMatched: audioFingerprintResult !== null,
  }),
  { wave: 2, onEvent: onStageEvent }
);
```

**matched_trends population when fingerprint succeeded:** aggregator (not trends.ts) synthesizes a `matched_trends` entry from `audioFingerprintResult` so `TrendEnrichment.matched_trends.length > 0` (single source of truth contract per D-F3). Hashtag scoring loop at trends.ts:86-156 remains UNGATED — hashtags are orthogonal to audio fingerprint.

---

### MODIFIED: `src/lib/engine/types.ts` (add Audio types + widen SignalAvailability)

**Self-analog at lines 198-206 (SignalAvailability — pure widening):**
```typescript
// EXTEND IN PLACE — add audio + audio_fingerprint keys
export interface SignalAvailability {
  behavioral: boolean;
  gemini: boolean;
  ml: boolean;
  rules: boolean;
  trends: boolean;
  content_type: boolean;
  niche: boolean;
  // NEW Phase 6 (D-G1) — weight-bearing
  audio: boolean;
  // NEW Phase 6 (D-G1) — provenance only (excluded from SCORE_WEIGHT_KEYS)
  audio_fingerprint: boolean;
}
```

**New types (place near line 369, alongside `TrendEnrichment`):**
```typescript
// Phase 6 — Audio Analysis result shapes

/** Audio sub-scores extracted from the extended gemini_video_analysis response. */
export interface GeminiAudioSignals {
  voice_clarity_0_10: number | null;       // 0-10, null per D-A2 content-type gating
  audio_hook_first_2s_0_10: number | null; // 0-10, null per D-A2
  silence_ratio: number;                    // 0-1, sums to 1.0 with siblings (D-A3)
  voiceover_ratio: number;                  // 0-1
  music_ratio: number;                      // 0-1
  audio_description: string;                // 50-150 char description (D-F1)
}

/** audio_perceptual_score output (D-G3). */
export interface AudioPerceptualResult {
  audio_perceptual_score: number;           // 0-100 normalized BEFORE fingerprint_boost
  formula_mode: "voice" | "ambient" | "balanced";
  sub_scores_used: string[];                // for debugging — which sub-scores fed the formula
}

/** pgvector fingerprint match result (D-F0/F1). */
export interface AudioFingerprintResult {
  sound_name: string;
  sound_url: string | null;
  similarity: number;                       // 0-1 cosine similarity
  trend_phase: "emerging" | "rising" | "peak" | "declining" | null;
  velocity_score: number;
}
```

**FeatureVector field (line 37) — unchanged signature, source-of-data swap per D-G4:**
```typescript
// EXISTING shape preserved (D-G4 guarantee):
audioTrendingMatch: number | null;  // semantics: 0-1 match strength — source-of-data swap is opaque to ML
```

**PredictionResult extension (lines 142-187):** add `audio_perceptual_score: number` (0-100) + `audio_fingerprint: AudioFingerprintResult | null` fields. Mirror existing `rule_score: number` + `trend_score: number` patterns at lines 163-164.

---

### MODIFIED: `src/app/api/cron/calculate-trends/route.ts` (extend with inline embedding)

**Self-analog at lines 130-145 (existing batch upsert loop):**

After the existing upsert at line 138, add an inline embed step per D-F4. Pattern source: same import shape as audio-fingerprint.ts (GoogleGenAI client + embedContent batch).

```typescript
// EXISTING (line 134-145) UNCHANGED — preserve existing upsert path

// NEW Phase 6 (D-F4) — append after `upsertedCount += batch.length;` block
// Failure-tolerant: each embedContent failure logs + continues (RESEARCH Pitfall 4).
// Rate limit unnecessary at ~50 sounds/day; embedContent batch handles burst.
for (let i = 0; i < trendRecords.length; i += BATCH_SIZE) {
  const batch = trendRecords.slice(i, i + BATCH_SIZE);
  // ... existing upsert (unchanged) ...

  // NEW: inline embedding for this batch
  try {
    const descriptions = await Promise.all(
      batch.map((row) => generateSoundDescription(row.sound_name, row.sound_url, ai)),
    );
    const embedResult = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: descriptions,
      config: { outputDimensionality: 768, taskType: "SEMANTIC_SIMILARITY" },
    });
    // Upsert audio_embedding + audio_description per row
    for (let j = 0; j < batch.length; j++) {
      const vector = embedResult.embeddings?.[j]?.values;
      if (!vector) continue;
      await supabase
        .from("trending_sounds")
        .update({ audio_embedding: vector, audio_description: descriptions[j] })
        .eq("sound_name", batch[j].sound_name);
    }
  } catch (error) {
    log.warn("Inline embedding failed for batch", { offset: i, error: String(error) });
    // Continue — sound rows still upserted; embedding column stays null;
    // next cron tick retries via backfill script's WHERE audio_embedding IS NULL semantics
  }
}
```

**Logger pattern (preserved from line 6):** `const log = createLogger({ module: "cron/calculate-trends" });` — no change.

**Failure tolerance pattern (RESEARCH Pitfall 4):** every embedContent call is wrapped in try/catch; on failure log + continue; next cron tick OR backfill script handles retry. Mirror existing graceful-degradation logging at lines 140-144 ("Upsert error" log without throw).

---

### NEW: `src/lib/engine/__tests__/audio-fingerprint.test.ts`

**Primary analog:** `src/lib/engine/__tests__/wave0-content-type.test.ts:1-120` (Gemini SDK mocking pattern).
**Secondary analog:** `src/lib/engine/__tests__/trends.test.ts:1-100` (Supabase chain mocking + RPC pattern).

**Mock setup pattern** (copy from `wave0-content-type.test.ts:9-42`):
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(), addBreadcrumb: vi.fn(),
}));

const mockEmbedContent = vi.fn();
vi.mock("@google/genai", () => {
  const MockGoogleGenAI = vi.fn(function (this: Record<string, unknown>) {
    this.models = { embedContent: mockEmbedContent };
  });
  return { GoogleGenAI: MockGoogleGenAI };
});

const mockRpc = vi.fn();
const mockSupabaseClient = {
  rpc: mockRpc,
} as unknown as import("@supabase/supabase-js").SupabaseClient;

process.env.GEMINI_API_KEY = "test-key";
import { matchAudioFingerprint } from "../audio-fingerprint";
```

**Test cases pattern** (copy structure from `wave0-content-type.test.ts:76-130`):
- Returns valid AudioFingerprintResult on Gemini + RPC success above threshold
- Returns null when `audio_description` is null/empty
- Returns null on embedContent failure (caught by try/catch)
- Returns null on Supabase RPC error (graceful degradation)
- Returns null when matches array is empty (no row above threshold)
- Threshold boundary tests (0.7999 / 0.8000 / 0.8001) per RESEARCH §"Critical Sample Points" #2
- Returns trend_phase from matched sound (AUDIO-06)

---

### NEW: `src/lib/engine/__tests__/audio-perceptual.test.ts`

**Primary analog:** `src/lib/engine/__tests__/content-type-weights.test.ts` (pure-function test pattern). Quick to enumerate cases per content type since input is pure data.

**Test cases (RESEARCH §"Critical Sample Points" #1 + #3):**
- talking_head: voice-driven formula (voice_clarity + audio_hook + voiceover_ratio)
- slideshow: ambient formula (music_ratio + description), voice_clarity = null
- other: balanced formula
- content_type = null → defaults to "other" passthrough
- Boundary: all-zero inputs → 0
- Boundary: all-max inputs → 100
- Trend phase boost: emerging +15, rising +10, peak +5, declining -5, null 0 (RESEARCH §"Critical Sample Points" #4)
- Clamp to [0, 100] after boost applied

---

## Shared Patterns

### Authentication / Authorization
**Source:** `src/lib/cron-auth.ts` (referenced by `calculate-trends/route.ts:2`)
**Apply to:** Cron extension only.
```typescript
// CURRENT pattern at calculate-trends/route.ts:14-16:
const authError = verifyCronAuth(request);
if (authError) return authError;
```
Phase 6 extends only the body of GET; auth contract unchanged.

**Service-role client for DB writes:**
- Engine code uses `createServiceClient()` from `@/lib/supabase/service` (per `trends.ts:1`, `calculate-trends/route.ts:3`)
- Scripts use direct `createClient<Database>(url, key)` with env vars (per `scripts/import-apify-data.ts:128-132`)
- The audio-fingerprint stage uses the supabase client passed in by pipeline.ts (already constructed upstream — see `pipeline.ts:309-310` for the supabase argument flow)

### Error Handling
**Source:** `src/lib/engine/wave0/content-type-detector.ts:210-220` (the canonical Gemini-stage failure path)
**Apply to:** `audio-fingerprint.ts` (entry point), `aggregator.ts` audio block.
```typescript
} catch (error) {
  Sentry.captureException(error, { tags: { stage: "audio_fingerprint" } });
  const message = error instanceof Error ? error.message : String(error);
  log.warn("Audio fingerprint failed", { error: message });
  return null; // graceful degradation — HARD-03
}
```

**Pipeline-stage failure (different shape — wraps in `timed()` + adds to warnings array):**
**Source:** `src/lib/engine/pipeline.ts:362-371` (gemini_analysis catch block — the canonical wave-stage failure path)
```typescript
catch (error) {
  Sentry.captureException(error, { tags: { stage: "audio_fingerprint", requestId } });
  warnings.push(`Audio fingerprint unavailable: ${error instanceof Error ? error.message : String(error)}`);
  timings.push({ stage: "audio_fingerprint", duration_ms: 0 });
  return null; // typed AudioFingerprintResult | null
}
```

### Validation
**Source:** `src/lib/engine/wave0/content-type-detector.ts:180-194` (Zod `.safeParse()` after JSON.parse)
**Apply to:** Gemini response parsing in `gemini.ts` (extended schema) and (defensively) `audio-perceptual.ts` if it ever consumes external data.
```typescript
const validated = Wave0ContentTypeResultSchema.safeParse({ type: raw.type, confidence: raw.confidence });
if (!validated.success) {
  throw new Error(`Content-type response validation failed: ${validated.error.message}`);
}
```

**Ratio normalization Zod refinement** — per RESEARCH Pitfall 1 + types.ts:75-83 `.refine()` idiom:
```typescript
.refine(
  (v) => Math.abs(v.silence_ratio + v.voiceover_ratio + v.music_ratio - 1.0) < 0.1,
  { message: "Audio ratios must sum to ~1.0 (±0.1 tolerance)" }
);
```

### Logging
**Source:** `src/lib/engine/trends.ts:7`, `src/lib/engine/wave0/content-type-detector.ts:10`
**Apply to:** `audio-fingerprint.ts`.
```typescript
const log = createLogger({ module: "audio_fingerprint" });
log.info("Audio fingerprint complete", { sound_name, similarity, trend_phase });
log.warn("Audio fingerprint failed", { error });
log.debug("No audio_description provided — skipping fingerprint match");
```

### Caching (optional)
**Source:** `src/lib/cache.ts` (createCache<T>(ttlMs))
**Apply to:** `audio-fingerprint.ts` IF benchmark shows pgvector query latency dominates Wave 1 (RESEARCH §"Supporting" recommends skipping in v1).
```typescript
// Cache top-50 trending_sounds embeddings for 5 min — same TTL as trends.ts:22
const embeddingCache = createCache<{ sound_name: string; vector: number[] }[]>(5 * 60 * 1000);
```
**Default for Phase 6 v1:** SKIP cache; pgvector queries are <1ms at our scale. Revisit if metrics show otherwise.

### Stage Event Emission
**Source:** `src/lib/engine/events.ts:19-49` (`emitStageStart`/`emitStageEnd` helpers) + `src/lib/engine/pipeline.ts:98-126` (`timed()` wrapper)
**Apply to:** `audio_fingerprint` stage in pipeline.ts.

Per Phase 3 D-01, every `timed()` boundary emits `stage_start` + `stage_end` automatically. The `audio_fingerprint` stage doesn't need its own emission — it lives inside `timed("audio_fingerprint", ...)`. RESEARCH Pitfall 2 documents the known late-stage_end timing because of the inner Gemini sub-await.

### Test Mocking
**Sources (combined):**
- `src/lib/engine/__tests__/wave0-content-type.test.ts:9-50` — @google/genai mock
- `src/lib/engine/__tests__/trends.test.ts:18-57` — supabase chain mock
- `src/lib/engine/__tests__/aggregator.test.ts:1-66` — full aggregator mocks
- `src/lib/engine/__tests__/factories.ts` — `makePipelineResult`, `makeGeminiAnalysis` builders

**Apply to:** all new Phase 6 test files.

For audio_fingerprint tests: combine the wave0 Gemini mock (embed-style: only `models.embedContent`, no `files.*`) with a minimal supabase `{ rpc: vi.fn() }` mock.

For audio-perceptual tests: zero mocks (pure function) — direct unit tests of formula correctness.

### Migration Conventions
**Source:** All existing migrations in `supabase/migrations/`
**Apply to:** new Phase 6 migration.

- Filename: `<UTC-timestamp>_<description>.sql`. New file: `20260518000000_phase6_audio_fingerprint.sql` (must sort after `20260517210000`).
- Header: brief comment describing the migration's purpose and idempotency.
- Idempotency: `CREATE EXTENSION IF NOT EXISTS vector`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`.
- No `DROP` statements in this phase (additive-only constraint).
- RLS: `trending_sounds` is already public-read (per `20260213000000_content_intelligence.sql:220-222`); no new policies needed.

## No Analog Found

| File | Role | Reason |
|------|------|--------|
| pgvector RPC function (`match_trending_sound_by_audio`) | DB function | No prior `RETURNS TABLE ... LANGUAGE sql STABLE` function in repo. Repo has trigger functions only (`update_updated_at_column`, `prevent_wallet_transaction_mutation`, `calculate_balance_after`). Pattern source = Supabase canonical pattern per RESEARCH §"Pattern 3" — verbatim copy. |
| Gemini `embedContent` SDK call | external API | No prior embedContent usage in repo (only `generateContent`). Pattern source = RESEARCH §"Pattern 2" + Context7 docs — verbatim copy of the canonical Google Gen AI SDK shape. |
| `gemini-embedding-001` model | model identifier | First text-embedding model in repo. RESEARCH §"State of the Art" notes that `text-embedding-004` (which CONTEXT D-F1 hints at) shut down 2026-01-14. |

**Implication for planner:** When writing the SQL function and the embedContent call, reference RESEARCH directly (not the codebase) — no in-repo precedent. Apply the patterns from RESEARCH §"Pattern 2" and §"Pattern 3" verbatim. Every other new file has a strong in-repo analog above.

## Metadata

**Analog search scope:**
- `src/lib/engine/**` (engine modules + tests)
- `src/lib/engine/wave0/**` (Wave 0 detector — primary new-Gemini-stage analog)
- `src/lib/engine/__tests__/**` (test patterns)
- `src/app/api/cron/calculate-trends/route.ts` (cron extension target)
- `scripts/**` (script analog for backfill)
- `supabase/migrations/**` (DDL idioms + filename convention)
- `src/lib/cache.ts` (optional caching)
- `src/lib/engine/events.ts`, `src/lib/engine/types.ts` (orchestration glue)

**Files scanned:** ~25 (~18 read in full or in targeted ranges; ~7 line-count probed via Grep)

**Critical Cross-File Constraints (load-bearing for downstream agents):**
1. **SCORE_WEIGHT_KEYS gate** (RESEARCH §"Anti-Patterns" #8, aggregator.ts:39-44): `audio` MUST be added to `SCORE_WEIGHT_KEYS` (weight-bearing); `audio_fingerprint` MUST NOT (provenance only). Critical for `selectWeights` math correctness.
2. **Wave 1 parallelism (Pitfall 2):** `audio_fingerprint` inner `await geminiPromise` is intentional and accepted. `stage_start` fires immediately; `stage_end` necessarily fires after Gemini resolves. Don't refactor to a serial "Wave 1.5" stage.
3. **Additive-only constraint** (CONTEXT.md §"NO changes to"): Phase 6 does NOT redistribute existing signal weights (selectWeights math handles redistribution from D-G1 audio absence), does NOT modify the content-type weight matrix (Phase 4 D-12), and does NOT change existing `audioTrendingMatch` field semantics in FeatureVector (D-G4 swaps source-of-data, not semantics).
4. **Migration ownership (D-F2):** Phase 6 owns pgvector setup; Phase 8 reuses. Use `CREATE EXTENSION IF NOT EXISTS vector` for idempotency.
5. **Single source of truth for matched_trends (D-F3):** When fingerprint matches, aggregator synthesizes the `matched_trends` entry from `audioFingerprintResult`; trends.ts Jaro-Winkler loop is gated off via the new `opts.audioFingerprintMatched` parameter.
6. **Ratio refinement, not validation (Pitfall 1):** Zod `.refine()` with ±0.1 tolerance — do NOT reject responses with sum=1.05; normalize internally and emit a warning.
7. **Failure tolerance in cron (Pitfall 4):** Each embedContent failure logs + continues; sound rows still upsert; backfill script handles the eventual reconciliation.
8. **Migration filename order:** `20260518000000_phase6_audio_fingerprint.sql` (must sort after `20260517210000_creator_profile_9card_columns.sql`).

**Pattern extraction date:** 2026-05-18
