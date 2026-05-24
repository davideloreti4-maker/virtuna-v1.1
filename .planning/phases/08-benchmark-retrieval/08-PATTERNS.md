# Phase 8: Benchmark Retrieval — Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 12 new + 5 extended = 17 files
**Analogs found:** 17 / 17

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/engine/retrieval/embedder.ts` (NEW) | Engine helper (SDK wrapper + pure helper) | API request-response | `src/lib/engine/gemini.ts` | exact (same SDK + same client pattern) |
| `src/lib/engine/retrieval/bucket-derivation.ts` (NEW) | Engine constant + pure helper | read-only (pure functions) | `src/lib/engine/corpus/thresholds.ts` + `src/lib/engine/corpus/follower-tier.ts` | exact (same const-snapshot + pure-classifier pattern) |
| `src/lib/engine/retrieval/pgvector-client.ts` (NEW) | DB client (Supabase RPC wrapper) | DB read | `src/lib/engine/trends.ts` (`.from().select()` pattern) | role-match (no RPC analogs exist; closest is direct `.from()` reads) |
| `src/lib/engine/retrieval/retrieval-stage.ts` (NEW) | Engine stage (Wave 1 sibling) | orchestration | `src/lib/engine/wave0/niche-detector.ts` | exact (own start/end events + graceful degradation + cost telemetry) |
| `src/lib/engine/retrieval/re-ranker.ts` (NEW) | Pure helper (in-memory transform) | read-only (pure functions) | `src/lib/engine/aggregator.ts` `selectWeights()` | role-match (pure scoring/redistribution math) |
| `scripts/embed-corpus.ts` (NEW) | CLI script | mutation (batch DB write) | `scripts/build-corpus.ts` | exact (same arg-parsing + tsconfig-paths + dotenv + service-client pattern) |
| `supabase/migrations/<timestamp>_phase8_pgvector.sql` (NEW) | SQL migration | DDL | `supabase/migrations/20260517120000_phase3_pipeline_columns.sql` + `20260512000000_training_corpus.sql` | exact (additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` style + recent date convention) |
| `src/lib/engine/__tests__/retrieval/*.test.ts` (NEW) | Vitest unit tests | test fixtures | `src/lib/engine/__tests__/trends.test.ts` | exact (same Supabase-mock + logger-mock + Sentry-mock pattern) |
| `src/lib/engine/pipeline.ts` (EXTENDED) | Pipeline orchestration | both | self (extend Wave 1 `Promise.all`) | self-extension |
| `src/lib/engine/aggregator.ts` (EXTENDED) | Score aggregation | both | self (extend `SCORE_WEIGHTS` + `SignalAvailability`) | self-extension |
| `src/lib/engine/types.ts` (EXTENDED) | Zod schemas + TS interfaces | type definitions | self (follow `BehavioralPredictionsSchema` + `Wave0NicheResultSchema` pattern) | self-extension |
| `src/lib/engine/corpus/orchestrator.ts` `bucketAndPersist` (EXTENDED) | DB insert path | mutation | self (add embedding step to row build) | self-extension |
| `src/app/api/webhooks/apify/route.ts` (EXTENDED) | API route handler (insert path) | mutation | self (add embedding step before upsert) | self-extension |
| `src/types/database.types.ts` (REGENERATED) | TS types from DB schema | type definitions | (auto-generated) | regeneration step |

---

## Pattern Assignments

### `src/lib/engine/retrieval/embedder.ts` (NEW — Gemini SDK wrapper)

**Role:** Engine helper (SDK wrapper + pure subject-text builder)
**Data flow:** API request-response (Gemini)
**Closest analog:** `src/lib/engine/gemini.ts`
**Why it's analogous:** Same `@google/genai` SDK; same lazy-singleton client; same `getClient()` pattern that reads `GEMINI_API_KEY`; same env-overrideable model name; same logger module + Sentry capture + try/catch + retry-with-backoff structure. Only difference: `embedContent` instead of `generateContent`.

**Imports + client init pattern** (`gemini.ts:1-15`, `17`, `31-32`, `81-88`):

```typescript
import * as Sentry from "@sentry/nextjs";
import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import {
  GeminiResponseSchema,
  // ...
  type GeminiAnalysis,
} from "./types";

const log = createLogger({ module: "gemini" });

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const MAX_RETRIES = 2; // 3 total attempts

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

**Cost telemetry + log.info pattern** (`gemini.ts:142-149`, `366-380`):

```typescript
// Token-based cost estimation
function calculateCost(
  promptTokens: number | undefined,
  candidateTokens: number | undefined
): number {
  const input = promptTokens ?? FALLBACK_INPUT_TOKENS;
  const output = candidateTokens ?? FALLBACK_OUTPUT_TOKENS;
  return (input * INPUT_PRICE_PER_TOKEN + output * OUTPUT_PRICE_PER_TOKEN) * 100;
}

// ...

const duration_ms = Math.round(performance.now() - startTime);
log.info("Text analysis complete", {
  stage: "gemini_text_analysis",
  duration_ms,
  cost_cents: +cost_cents.toFixed(4),
  model: GEMINI_MODEL,
});

Sentry.addBreadcrumb({
  category: "engine.gemini",
  message: "Text analysis complete",
  level: "info",
  data: { duration_ms, cost_cents: +cost_cents.toFixed(4), model: GEMINI_MODEL },
});
```

**Retry loop pattern** (`gemini.ts:329-392`):

```typescript
for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: { /* ... */ },
    });
    // ... return
  } catch (error) {
    lastError = error instanceof Error ? error : new Error(String(error));
    if (lastError.name === "AbortError") {
      throw new Error(`Gemini request timed out after ${TEXT_TIMEOUT_MS}ms`);
    }
    if (attempt === MAX_RETRIES) break;
    // Exponential backoff: 1s, 3s
    const delay = attempt === 0 ? 1000 : 3000;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
Sentry.captureException(lastError, { tags: { stage: "gemini_text_analysis" } });
```

**Adapt by:**
- Replace `generateContent` with `embedContent` and pass `config: { outputDimensionality: 768, taskType: "RETRIEVAL_QUERY"|"RETRIEVAL_DOCUMENT" }`.
- Constants: `EMBEDDING_MODEL = "gemini-embedding-001"` (per RESEARCH Finding 1 — text-embedding-004 shut down 2026-01-14), `EMBEDDING_DIM = 768`.
- Two exported call functions: `embedQuery(text)` (single, `RETRIEVAL_QUERY`) and `embedBatch(texts)` (sync batch ≤100, `RETRIEVAL_DOCUMENT`).
- Pure helper `buildSubjectText({primary_slug, creator_handle, caption, hashtags})` — D-06 byte-identical formula. NOT in gemini.ts; this is a NEW responsibility.
- Cost math is per-token at $0.15/M input only (no output tokens for embeddings); use `Math.ceil(text.length / 4)` heuristic for tokens.
- Retry loop for backfill path: 60s sleep on 429, max 3 retries.

---

### `src/lib/engine/retrieval/bucket-derivation.ts` (NEW — bucket classification helpers + percentile constant)

**Role:** Engine constant + pure classifier helpers
**Data flow:** read-only (pure functions over constants)
**Closest analog:** `src/lib/engine/corpus/thresholds.ts` (for the snapshot-constant pattern) AND `src/lib/engine/corpus/follower-tier.ts` (for the pure-classifier pattern)
**Why it's analogous:** thresholds.ts shows how to store an immutable per-niche calibration snapshot as a TS const, with a strict accessor that throws on unknown keys. follower-tier.ts shows the right shape for a pure classifier that takes a metric and returns a bucket label or `null` when the metric is missing.

**Snapshot-constant pattern** (`thresholds.ts:21-53`):

```typescript
/**
 * Threshold snapshots — one entry per corpus_version.
 * Add new entries; NEVER edit existing ones (D-13 immutability).
 */
const THRESHOLD_SNAPSHOTS: Record<string, ThresholdsByNiche> = {
  "full.2026-05-11": {
    beauty:    { viralFloor:  5_120_000, underCeiling:   250_840 },
    fitness:   { viralFloor:  5_480_000, underCeiling: 1_164_240 },
    edu:       { viralFloor:  2_000_000, underCeiling:   368_500 },
    comedy:    { viralFloor: 25_900_000, underCeiling: 9_000_000 },
    lifestyle: { viralFloor:    871_200, underCeiling:   153_540 },
  },
};

export function getThresholds(version: CorpusVersion | string): ThresholdsByNiche {
  const snap = THRESHOLD_SNAPSHOTS[version];
  if (!snap) {
    throw new Error(
      `Unknown corpus_version: ${version}. Add a snapshot to THRESHOLD_SNAPSHOTS before evaluating.`,
    );
  }
  return snap;
}
```

**Pure-classifier pattern** (`follower-tier.ts:11-20`):

```typescript
export function getFollowerTier(
  count: number | null | undefined
): FollowerTier | null {
  if (count === null || count === undefined || count <= 0) return null;
  if (count < 10_000) return "nano";
  if (count < 100_000) return "micro";
  if (count < 1_000_000) return "mid";
  if (count < 10_000_000) return "large";
  return "mega";
}
```

**Adapt by:**
- Two exported constants: a re-export view of `THRESHOLD_SNAPSHOTS["full.2026-05-11"]` (via `getThresholds()`) for the 5 calibrated niches (beauty/fitness/edu/comedy/lifestyle) — read for `views >= viralFloor`/`<= underCeiling` classification. And a NEW `NON_CORPUS_ENGAGEMENT_PERCENTILES: Record<string, { p80: number; p40: number }>` for the 5 non-calibrated niches (tech/gaming/fashion/music/food), populated at backfill time by `scripts/embed-corpus.ts --derive-percentiles` and committed to git.
- Pure function `deriveBucket({ niche, views, likes, shares, comments, saves })`: branches on whether `niche` is in the calibrated set or not. Calibrated branch → views-based. Non-calibrated branch → engagement-rate percentile lookup. Returns `"viral" | "average" | "under"`. NEVER throws; for unknown niche or missing pool → return `"average"` as the safe default per RESEARCH Finding 5 chicken-and-egg.
- Pure function `bucketValue(bucket): 1.0 | 0.5 | 0.0` for D-03 score formula.
- Both files (`thresholds.ts` + `follower-tier.ts`) ship as pure TS with NO Supabase / NO logger / NO Sentry — bucket-derivation.ts must match that purity (testable in pure unit tests).

---

### `src/lib/engine/retrieval/pgvector-client.ts` (NEW — Supabase RPC wrapper)

**Role:** DB client (RPC caller)
**Data flow:** DB read (read-only)
**Closest analog:** `src/lib/engine/trends.ts` (lines 40-46, 93-98 — direct `supabase.from().select().limit()` reads with `data ?? []` typing)
**Why it's analogous:** No existing RPC analog exists in the codebase (verified via grep). The closest pattern is direct `.from().select()` reads against system-wide tables using the service client. The pattern Phase 8 needs (RPC call with error → throw → caller catches) maps cleanly onto this read-only DB-call shape; RPC is just the wire protocol.

**Direct-DB-read pattern** (`trends.ts:40-48`):

```typescript
const { data } = await supabase
  .from("trending_sounds")
  .select("sound_name, velocity_score, trend_phase")
  .order("velocity_score", { ascending: false })
  .limit(50);
trendingSounds = (data ?? []) as TrendingSound[];
soundsCache.set("trending_sounds", trendingSounds);
log.debug("Trending sounds loaded", { count: trendingSounds.length });
```

**Error-on-supabase-error pattern** (`orchestrator.ts:353-363`):

```typescript
const { error } = await supabase
  .from("training_corpus")
  .upsert(dedupedDbRows, {
    onConflict: "corpus_version,platform_video_id",
    ignoreDuplicates: false,
  });

if (error) {
  log.error("Upsert failed", { error: error.message });
  throw error;
}
```

**Adapt by:**
- Use `supabase.rpc("match_corpus_videos", {...params})` instead of `.from().select()`. Per RESEARCH §"Query Pattern for Top-K with Filters", PostgREST does not support pgvector operators directly — the RPC pattern is the canonical Supabase semantic-search path.
- Two exported functions: `matchTrainingCorpus(supabase, opts: MatchOptions)` and `matchScrapedVideos(supabase, opts: MatchOptions)` — both return `Promise<MatchRow[]>`.
- Standard error handling: destructure `{ data, error }`; if error → throw `new Error("match_corpus_videos RPC failed: " + error.message)`; return `(data ?? []) as MatchRow[]`.
- Imports: `import type { SupabaseClient } from "@supabase/supabase-js"`. Accept `supabase: SupabaseClient` as first arg — caller (retrieval-stage.ts) owns client creation via `createServiceClient()` (same pattern as `enrichWithTrends(supabase, ...)` and `runWave0(payload, supabase, ...)`).
- The vector parameter is passed as a `number[]` JSON array — supabase-js serializes it to the `vector` Postgres type at the RPC call boundary.

---

### `src/lib/engine/retrieval/retrieval-stage.ts` (NEW — Wave 1 sibling stage)

**Role:** Engine stage (Wave 1 sibling — `runBenchmarkRetrieval`)
**Data flow:** orchestration (embedder + pgvector-client + re-ranker + bucket-derivation)
**Closest analog:** `src/lib/engine/wave0/niche-detector.ts`
**Why it's analogous:** Both stages:
1. Emit their own `stage_start` / `stage_end` events via `emitStageStart`/`emitStageEnd` helpers (NOT via the pipeline's outer `timed()` wrapper — both stages run INSIDE a Wave that's wrapped in `timed()`, but each stage owns its own event pair).
2. Have a `costCents` accumulator that's set inside the try block and reported in the `stage_end` event regardless of success/failure.
3. Wrap the whole body in try/catch → never throw → return `null` (or a default empty result) on any failure (graceful degradation per Phase 1 D-rule).
4. Run inside a Wave's `Promise.all`/`Promise.allSettled` block, where the caller MUST NOT depend on this stage's success.

**Stage entrypoint signature + event lifecycle** (`niche-detector.ts:49-56`):

```typescript
export async function detectNiche(
  payload: ContentPayload,
  creatorContext: CreatorContext,
  onEvent?: StageEventCallback,
): Promise<Wave0NicheResult | null> {
  const startTs = emitStageStart(onEvent, "wave_0_niche_detector", 0);
  let costCents = 0;

  try {
    // ... work ...
```

**Graceful degradation pattern** (Phase 1 D-rule — apply at the OUTER catch; emit stage_end with `ok: false`):

```typescript
// (pseudocode; the exact shape is in niche-detector.ts ~lines 175-200 in the full file)
} catch (error) {
  log.warn("Stage failed; degrading gracefully", {
    error: error instanceof Error ? error.message : String(error),
  });
  Sentry.captureException(error, {
    tags: { stage: "retrieval", source: "retrieval-stage" },
  });
  emitStageEnd(onEvent, "retrieval", 1, startTs, {
    cost_cents: costCents,
    ok: false,
    warning: error instanceof Error ? error.message : String(error),
  });
  return { evidence: [], score: null, availability: false };
}
```

**Stage event helpers** (`events.ts:19-49` — read-only reference):

```typescript
export function emitStageStart(
  onEvent: StageEventCallback | undefined,
  stage: string,
  wave: StageEventWave,
): number {
  const timestamp_ms = performance.now();
  onEvent?.({ type: "stage_start", stage, wave, timestamp_ms });
  return timestamp_ms;
}

export function emitStageEnd(
  onEvent: StageEventCallback | undefined,
  stage: string,
  wave: StageEventWave,
  startTs: number,
  opts: { cost_cents?: number; ok?: boolean; warning?: string } = {},
): void {
  const duration_ms = Math.round(performance.now() - startTs);
  onEvent?.({ type: "stage_end", stage, wave, duration_ms,
    cost_cents: opts.cost_cents ?? 0, ok: opts.ok ?? true, warning: opts.warning });
}
```

**Adapt by:**
- Signature: `runBenchmarkRetrieval(payload: ContentPayload, creatorContext: CreatorContext, wave0Result: Wave0Result, supabase: SupabaseClient, onEvent?: StageEventCallback): Promise<BenchmarkRetrievalResult>`. `wave: 1` for emit calls (NOT `0` like Wave 0 detectors). Stage name: `"retrieval"`.
- Internal flow per D-04 hierarchical relaxation:
  1. Build subject text via `buildSubjectText()` from embedder.ts.
  2. Call `embedQuery(text)` → get vector + cost_cents.
  3. Iterate tiers T1→T3 in TS; for each tier call `matchTrainingCorpus` first, top up from `matchScrapedVideos` if `<K`; tag each result with `relaxed_to`. Stop at K=5 accumulated.
  4. Apply soft re-ranker (`./re-ranker.ts`) on top-K×2 raw matches.
  5. Derive bucket for scraped_videos items via `deriveBucket()` (training_corpus items use the labeled `bucket_label` directly; mark `bucket_source: "corpus"` vs `"derived"`).
  6. Apply min_corpus_size gate per D-04b — read from `taxonomy.find(p => p.slug === niche).benchmark_filters.min_corpus_size`. If pool < gate, return evidence with `score: null` + `availability: false` + emit `retrieval_pool_too_small` pipeline warning.
  7. Compute D-03 score: `Σ similarity_i · bucket_value(bucket_i) / Σ similarity_i`.
- Result shape: `{ evidence: RetrievalEvidenceItem[]; score: number | null; availability: boolean; cost_cents: number }`.
- Catch all errors at the top level; emit `stage_end` with `ok: false`; return `{ evidence: [], score: null, availability: false, cost_cents }` so pipeline doesn't break.

---

### `src/lib/engine/retrieval/re-ranker.ts` (NEW — pure soft re-ranker)

**Role:** Pure helper (in-memory transform)
**Data flow:** read-only (pure function over arrays)
**Closest analog:** `src/lib/engine/aggregator.ts` `selectWeights()` (lines 59-102)
**Why it's analogous:** Both are pure, deterministic, side-effect-free functions that transform an array of {value, weight}-like records by re-ranking/redistributing weights. selectWeights iterates a filtered list, multiplies by a proportional factor, and rounds to avoid floating-point noise — the same shape re-ranker.ts needs for the +5% similarity bonus on hashtag overlap.

**Pure transform pattern with filtered iteration** (`aggregator.ts:59-102`):

```typescript
export function selectWeights(
  availability: SignalAvailability
): { behavioral: number; gemini: number; ml: number; rules: number; trends: number } {
  const filtered = (Object.entries(availability) as Array<[string, boolean]>)
    .filter(([key]) => (SCORE_WEIGHT_KEYS as readonly string[]).includes(key)) as Array<
    [ScoreWeightKey, boolean]
  >;

  const available = filtered.filter(([, v]) => v);
  const missing = filtered.filter(([, v]) => !v);

  if (missing.length === 0) return { ...SCORE_WEIGHTS };

  const missingWeight = missing.reduce((sum, [key]) => sum + SCORE_WEIGHTS[key], 0);
  const availableWeight = available.reduce((sum, [key]) => sum + SCORE_WEIGHTS[key], 0);

  const result = { behavioral: 0, gemini: 0, ml: 0, rules: 0, trends: 0 };
  for (const [key, isAvailable] of filtered) {
    if (isAvailable) {
      result[key] = SCORE_WEIGHTS[key] + (SCORE_WEIGHTS[key] / availableWeight) * missingWeight;
    }
  }

  const total = Object.values(result).reduce((a, b) => a + b, 0);
  if (total === 0) return result;
  for (const key of Object.keys(result) as ScoreWeightKey[]) {
    result[key] = Math.round((result[key] / total) * 1000) / 1000;
  }
  return result;
}
```

**Adapt by:**
- Signature: `applyHashtagReRank(items: MatchRow[], tagFilters: string[], bonus: number = 0.05): MatchRow[]`. Returns NEW array (immutable input).
- Logic: for each item, compute `overlap = (item.hashtags ∩ tagFilters).length`. If `overlap > 0`, set `boosted.similarity = item.similarity * (1 + bonus)` (no further multiplier; D-04a says "small re-ranking bonus, e.g. +5%"). Otherwise pass through unchanged.
- Sort `descending` by boosted similarity; return top K=5.
- Hashtag normalization: per CONTEXT D-04a "Claude's Discretion — Hashtag normalization", lowercase both sides before comparison to be safe.
- Pure function — no logger, no Sentry. Unit-testable in isolation (matches the `aggregator.test.ts` style for `selectWeights`).

---

### `scripts/embed-corpus.ts` (NEW — idempotent CLI backfill)

**Role:** CLI script (one-time backfill + re-runnable)
**Data flow:** mutation (batch UPDATE on training_corpus.embedding + scraped_videos.embedding)
**Closest analog:** `scripts/build-corpus.ts`
**Why it's analogous:** Same project CLI convention — Node script run via `pnpm tsx scripts/...`, loads `.env.local` with dotenv, registers tsconfig-paths so `@/`-aliases resolve at runtime, uses `createServiceClient()` for service-role DB access, uses logger via `console.log("[script-name] ...")`, parses args via a sibling module (`*.args.ts`), exits with explicit `process.exit(0|1)`, catches all top-level errors in `main().catch(...)`.

**CLI bootstrap pattern** (`build-corpus.ts:1-50`):

```typescript
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";
import { ApifyClient } from "apify-client";

// Load .env.local (Next.js convention — same pattern as other scripts)
config({ path: resolve(__dirname, "../.env.local") });

// Register tsconfig-paths so @/ aliases resolve correctly at runtime.
// Must happen before any @/-aliased modules are required.
const tsconfig = JSON.parse(
  readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"),
);
register({
  baseUrl: resolve(__dirname, ".."),
  paths: tsconfig.compilerOptions.paths,
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { bucketAndPersist, ... } = require("../src/lib/engine/corpus/orchestrator");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createServiceClient } = require("../src/lib/supabase/service");

const log = (msg: string) => console.log(`[build-corpus] ${msg}`);
const warn = (msg: string) => console.warn(`[build-corpus] WARN: ${msg}`);

async function main() {
  let args;
  try {
    args = parseBuildCorpusArgs(process.argv.slice(2));
  } catch (err) {
    if (err instanceof BuildCorpusArgsError) {
      log(err.message);
      log("");
      log(err.usage);
      process.exit(1);
    }
    throw err;
  }
  // ...
}

main().catch((err) => {
  log(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
  if (err instanceof Error && err.stack) log(err.stack);
  process.exit(1);
});
```

**Adapt by:**
- Logger prefix: `[embed-corpus]`.
- Args parsing in a sibling: `src/lib/engine/retrieval/cli/embed-corpus-args.ts` exporting `parseEmbedCorpusArgs(argv): { mode: "backfill" | "derive-percentiles"; table?: "training_corpus" | "scraped_videos" | "both"; batchSize?: number; dryRun: boolean }` and `EmbedCorpusArgsError`. Mirrors `build-corpus-args.ts` pattern.
- Idempotency: `SELECT id, niche, creator_handle, caption, hashtags FROM <table> WHERE embedding IS NULL` before batching. Re-runs are safe — already-embedded rows are skipped.
- Batching: 100 rows per Gemini call (per RESEARCH §"Batch Limits"). Use `embedBatch(texts)` from `embedder.ts`.
- Update pattern: `supabase.from(table).update({ embedding }).eq("id", id)` per row (cannot use `.upsert()` because we're mutating existing rows). Wrap each batch in `Promise.all` for parallel HTTP.
- Two-mode CLI: `--backfill` (default) does the embedding work; `--derive-percentiles` runs once at end of backfill to compute `NON_CORPUS_ENGAGEMENT_PERCENTILES` from scraped_videos for the 5 non-calibrated niches and prints a TS code block (analogous to `formatThresholdCodeBlock`) for the user to paste into `bucket-derivation.ts`.
- Apply per-niche pool size threshold ≥30 rows (RESEARCH Finding 5) — log skipped niches.

---

### `supabase/migrations/<timestamp>_phase8_pgvector.sql` (NEW — single migration)

**Role:** SQL migration (extension + ALTER TABLE + indexes + RPC functions)
**Data flow:** DDL
**Closest analog:** `supabase/migrations/20260517120000_phase3_pipeline_columns.sql` (idiom for additive ALTER TABLE) + `20260512000000_training_corpus.sql` (idiom for CREATE TABLE with extensions schema)
**Why it's analogous:** Phase 3's migration is the most recent additive-column change to `analysis_results` — same shape Phase 8 needs (add 2 new columns). It uses `IF NOT EXISTS` consistently for idempotent re-runs. Filename convention: `YYYYMMDDHHMMSS_phase<N>_<description>.sql`.

**Filename convention from neighbors:**
- `20260517120000_phase3_pipeline_columns.sql` — phase 3
- `20260517210000_creator_profile_9card_columns.sql` — phase 2
- `20260512000000_training_corpus.sql` — phase 1
- Phase 8 should use: `20260518000000_phase8_pgvector.sql` (today's date 2026-05-18, time 00:00:00, after the most recent migration).

**Additive ALTER TABLE idiom** (`20260517120000_phase3_pipeline_columns.sql:1-30`):

```sql
-- Phase 3: Pipeline Infrastructure — provenance + content-hash cache columns.
-- Adds two columns and one compound index to analysis_results.
-- All statements use IF NOT EXISTS for idempotent re-runs.

-- =====================================================
-- ANALYSIS RESULTS — 2 new columns for Phase 3 provenance + cache
-- =====================================================

-- signal_availability JSONB: which signals fired during this prediction.
-- Shape per CONTEXT.md D-07: { behavioral: bool, gemini: bool, ml: bool, rules: bool, trends: bool }.
-- Forward-compat: future phases (...8: retrieval; ...) add keys.
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS signal_availability JSONB DEFAULT '{}';

-- content_hash TEXT: SHA-256 hex digest of the input (buffer/url/text).
ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- =====================================================
-- INDEX — compound index supporting the L2 cache SELECT
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_analysis_results_cache_lookup
  ON analysis_results(user_id, content_hash, engine_version, created_at DESC)
  WHERE deleted_at IS NULL;
```

**Multi-column additive ALTER TABLE** (`20260517210000_creator_profile_9card_columns.sql:9-23` — comma-separated form):

```sql
ALTER TABLE creator_profiles
  ADD COLUMN IF NOT EXISTS target_platforms          TEXT[],
  ADD COLUMN IF NOT EXISTS niche_primary             TEXT,
  ADD COLUMN IF NOT EXISTS niche_sub                 TEXT,
  -- ...
  ADD COLUMN IF NOT EXISTS profile_interview_seen_at TIMESTAMPTZ;
```

**Adapt by:**
- Top comment block: phase + description + idempotency note (mirror Phase 3 header).
- Statements in order:
  1. `CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;` (per RESEARCH §"Enable Extension").
  2. `ALTER TABLE training_corpus ADD COLUMN IF NOT EXISTS embedding extensions.vector(768);` (fully-qualified per RESEARCH note).
  3. `ALTER TABLE scraped_videos ADD COLUMN IF NOT EXISTS embedding extensions.vector(768);`.
  4. Missing-filter-column adds on scraped_videos (RESEARCH Finding 3 Strategy A — `primary_niche`, `follower_tier` with CHECK, `posted_at`, `creator_handle`) using the multi-column `ALTER TABLE ... ADD COLUMN IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, ...` form from the 9-card migration.
  5. `UPDATE scraped_videos SET creator_handle = author WHERE creator_handle IS NULL AND author IS NOT NULL;` (one-time backfill).
  6. `ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS retrieval_evidence JSONB DEFAULT '[]', ADD COLUMN IF NOT EXISTS retrieval_score NUMERIC(5,4);` (D-11).
  7. HNSW indexes on both pools with `WITH (m = 16, ef_construction = 64)` (per D-07 + RESEARCH §"HNSW Index").
  8. `CREATE OR REPLACE FUNCTION match_corpus_videos(...)` and `match_scraped_videos(...)` — full DDL is in RESEARCH §"Migration: Create the RPC function" (lines 562-687).
- NO RLS changes (training_corpus and scraped_videos are already system-wide tables — service-role only via `createServiceClient()`).

---

### `src/lib/engine/__tests__/retrieval/*.test.ts` (NEW — Vitest unit tests)

**Role:** Test fixtures (Vitest unit tests)
**Data flow:** mocked I/O (no live DB, no live API)
**Closest analog:** `src/lib/engine/__tests__/trends.test.ts`
**Why it's analogous:** trends.test.ts mocks `@/lib/logger`, `@sentry/nextjs`, `@/lib/cache`, AND `@/lib/supabase/service` exactly the way Phase 8 tests will need to. It uses a chainable mock for the Supabase client that returns configurable responses — same shape needed for mocking `.rpc()` calls.

**Mock setup pattern** (`trends.test.ts:5-57`):

```typescript
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

// Supabase mock with configurable table responses
let tableResponses: Record<string, { data: unknown; error: unknown }> = {};

const mockSupabaseChain = (tableResult: { data: unknown; error: unknown }) => {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "is", "not", "gte", "gt", "or", "order", "limit", "maybeSingle"];
  for (const method of methods) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (v: unknown) => void) => resolve(tableResult);
  return chain;
};

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      const response = tableResponses[table] ?? { data: [], error: null };
      return mockSupabaseChain(response);
    }),
  })),
}));
```

**Test arrangement pattern** (`trends.test.ts:72-90`):

```typescript
describe("enrichWithTrends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tableResponses = {
      trending_sounds: { data: [], error: null },
      scraped_videos: { data: [], error: null },
    };
  });

  it("returns default values when no trending data", async () => {
    const supabase = createServiceClient();
    const result = await enrichWithTrends(supabase, makeInput());

    expect(result.trend_score).toBeGreaterThanOrEqual(0);
    expect(result.matched_trends).toEqual([]);
  });
});
```

**Adapt by:**
- Test files per module: `embedder.test.ts`, `bucket-derivation.test.ts`, `pgvector-client.test.ts`, `retrieval-stage.test.ts`, `re-ranker.test.ts`. Location: `src/lib/engine/__tests__/retrieval/` (new subdirectory).
- For embedder: mock `@google/genai` `GoogleGenAI` constructor returning a stub with `models.embedContent` that returns deterministic 768-d zero vectors. Test `buildSubjectText` is byte-identical for given inputs (key test — D-06 spec).
- For pgvector-client: extend the mock chain to support `.rpc(name, params)` — return `{ data: [...mockRows], error: null }`. Verify the function name + param shape is what the stored function expects.
- For retrieval-stage: integration-style test that mocks embedder + pgvector-client and verifies the full Wave 1 lifecycle (`stage_start` event → embedding call → matches gathered → re-ranker invoked → bucket-derivation invoked → score computed → `stage_end` event). Same `StageEventCallback` capture pattern used in `pipeline.test.ts`.
- Coverage target: 80% per project standard. Mock all external deps; NO live Gemini, NO live pgvector.

---

### `src/lib/engine/pipeline.ts` (EXTENDED — Wave 1 `Promise.all` adds retrieval sibling)

**Role:** Pipeline orchestration (self-extension)
**Data flow:** orchestration (both)
**Pattern to copy:** existing Wave 1 sibling stage (e.g. `rulePromise` at `pipeline.ts:395-411`)

**Sibling stage skeleton** (`pipeline.ts:394-411`):

```typescript
// Stage 6: Rule Loading + Scoring -- NON-CRITICAL (fallback with warning)
const rulePromise = (async (): Promise<RuleScoreResult> => {
  try {
    return await timed("rule_scoring", timings, async () => {
      const rules = await loadActiveRules(supabase, payload.content_type);
      return scoreContentAgainstRules(payload.content_text, rules);
    }, { wave: 1, onEvent: onStageEvent });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { stage: "rule_scoring", requestId },
    });
    warnings.push(
      `Rule scoring unavailable: ${error instanceof Error ? error.message : String(error)}`
    );
    timings.push({ stage: "rule_scoring", duration_ms: 0 });
    return DEFAULT_RULE_RESULT;
  }
})();

// Run Wave 1 in parallel
const [geminiResult, audioResult, , ruleResult] = await timed(
  "wave_1",
  timings,
  () => Promise.all([geminiPromise, audioPromise, creatorPromise, rulePromise]),
  { wave: 1, onEvent: onStageEvent }
);
```

**Adapt by:**
- Add new sibling promise `retrievalPromise` BETWEEN `rulePromise` and the closing `Promise.all`. NOTE: retrieval-stage.ts emits its OWN `stage_start`/`stage_end` events internally (per D-09 — matches niche-detector.ts pattern, NOT the rule_scoring pattern which uses outer `timed()` wrapping). So the wrapper here is just the outer try/catch + push warning on failure; do NOT wrap in another `timed()` call (would double-emit events).
- Add `retrievalPromise` to the `Promise.all([...])` array at line 420 (5th slot). Update the destructure tuple.
- Add `runBenchmarkRetrieval` import from `./retrieval/retrieval-stage`.
- Extend `PipelineResult` interface with `retrievalResult: BenchmarkRetrievalResult`.
- Return new field in the final `return { ... }` block (line 545-559).

---

### `src/lib/engine/aggregator.ts` (EXTENDED — SCORE_WEIGHTS + SignalAvailability + selectWeights)

**Role:** Score aggregation (self-extension)
**Data flow:** both
**Pattern to copy:** existing SCORE_WEIGHTS + SCORE_WEIGHT_KEYS + selectWeights (lines 31-102)

**Current SCORE_WEIGHTS pattern** (`aggregator.ts:31-44`):

```typescript
const SCORE_WEIGHTS = {
  behavioral: 0.35,
  gemini: 0.25,
  ml: 0.15,
  rules: 0.15,
  trends: 0.10,
} as const;

const SCORE_WEIGHT_KEYS = ["behavioral", "gemini", "ml", "rules", "trends"] as const;
type ScoreWeightKey = (typeof SCORE_WEIGHT_KEYS)[number];
```

**Current SignalAvailability flow** (`aggregator.ts:330-349`):

```typescript
const availability: SignalAvailability = {
  behavioral: deepseekResult !== null,
  gemini: geminiResult.analysis.factors.some((f) => f.score > 0),
  ml: mlAvailable,
  rules: ruleResult.matched_rules.length > 0 && ...,
  trends: trendEnrichment.matched_trends.length > 0 && ...,
  content_type: pipelineResult.wave0Result.content_type !== null,
  niche: pipelineResult.wave0Result.niche !== null,
};

const weights = selectWeights(availability);
```

**Adapt by:**
- Per D-03b, replace SCORE_WEIGHTS with redistributed values: `behavioral: 0.33, gemini: 0.24, ml: 0.14, rules: 0.14, trends: 0.10, retrieval: 0.05` (each existing × 0.95).
- Extend `SCORE_WEIGHT_KEYS` tuple: `["behavioral", "gemini", "ml", "rules", "trends", "retrieval"] as const`.
- Extend `result` initial object in `selectWeights` to include `retrieval: 0`.
- Update the `selectWeights` return type signature: `{ behavioral; gemini; ml; rules; trends; retrieval }`.
- Extend `availability` assembly to include `retrieval: pipelineResult.retrievalResult.availability` (read from the new pipeline result field).
- Update overall_score formula at line 386-392: add `+ pipelineResult.retrievalResult.score * weights.retrieval` (with null-safe: `((retrievalResult.score ?? 0) * weights.retrieval)`).
- Add `retrieval_score` + `retrieval_evidence` to the assembled `PredictionResult` object at line 519.

---

### `src/lib/engine/types.ts` (EXTENDED — Zod schemas + interfaces)

**Role:** Zod schemas + TS interfaces (self-extension)
**Data flow:** type definitions
**Pattern to copy:** existing `BehavioralPredictionsSchema` (lines 319-330) for nested z.object + nullable fields; existing `Wave0NicheResultSchema` (lines 291-301) for enum+optional+source-tagged shape; `SignalAvailability` interface (198-206) for the additive key.

**Zod schema pattern** (`types.ts:319-352`):

```typescript
export const BehavioralPredictionsSchema = z.object({
  completion_pct: z.number().min(0).max(100),
  completion_percentile: z.string(),
  share_pct: z.number().min(0).max(100),
  share_percentile: z.string(),
  comment_pct: z.number().min(0).max(100),
  comment_percentile: z.string(),
  save_pct: z.number().min(0).max(100),
  save_percentile: z.string(),
});

export type BehavioralPredictions = z.infer<typeof BehavioralPredictionsSchema>;
```

**Source-tagged enum pattern** (`types.ts:291-301`):

```typescript
export const Wave0NicheResultSchema = z.object({
  primary: z.string(),
  sub: z.string(),
  micro: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  source: z.enum(["ai", "card1_fallback"]),
  warning: z.enum(["niche_drift_detected", "niche_low_confidence_no_fallback"]).optional(),
});
export type Wave0NicheResult = z.infer<typeof Wave0NicheResultSchema>;
```

**SignalAvailability extension pattern** (`types.ts:198-206`):

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

**Adapt by:**
- New `RetrievalEvidenceItemSchema` per D-02 shape (10 fields including bucket_label enum, bucket_source enum, relaxed_to nullable enum). Export `RetrievalEvidenceItem = z.infer<...>`. Place after `BehavioralPredictionsSchema`.
- New `BenchmarkRetrievalResultSchema = z.object({ evidence: z.array(RetrievalEvidenceItemSchema).max(5), score: z.number().min(0).max(1).nullable(), availability: z.boolean(), cost_cents: z.number() })`. Export `BenchmarkRetrievalResult`.
- Extend `SignalAvailability` interface: add `retrieval: boolean;` after `niche: boolean;`.
- Extend `PredictionResult` interface: add `retrieval_score: number | null;` and `retrieval_evidence: RetrievalEvidenceItem[];` fields.
- Extend `score_weights` shape in `PredictionResult`: add `retrieval: number;`.
- Per RESEARCH §Critical Cross-File Constraint #3 in aggregator.ts: SignalAvailability has KEYS that participate in weight math AND KEYS that are pure provenance (content_type, niche). `retrieval` participates in weight math — make sure SCORE_WEIGHT_KEYS in aggregator.ts includes it.

---

### `src/lib/engine/corpus/orchestrator.ts` — `bucketAndPersist` EXTENSION (auto-embed on insert per D-08)

**Role:** DB insert path (self-extension)
**Data flow:** mutation
**Pattern to copy:** the existing `dbRows` build at lines 319-342 — extend it to include `embedding`.

**Current insert build pattern** (`orchestrator.ts:319-358`):

```typescript
// Build DB rows
const dbRows = final.map((r) => ({
  platform: r.platform,
  platform_video_id: r.platform_video_id,
  // ...
  caption: r.caption,
  hashtags: r.hashtags,
  // ...
  niche: r.niche,
  bucket: r.bucket,
  bucket_target: bucketTargetFor(r),
}));

// Batch-dedup on platform_video_id before upsert
const seenVideoIds = new Set<string>();
const dedupedDbRows = dbRows.filter((r) => { /* ... */ });

const { error } = await supabase
  .from("training_corpus")
  .upsert(dedupedDbRows, {
    onConflict: "corpus_version,platform_video_id",
    ignoreDuplicates: false,
  });

if (error) {
  log.error("Upsert failed", { error: error.message });
  throw error;
}
```

**Adapt by:**
- BEFORE the dbRows build, batch-embed all `final` rows: `const subjectTexts = final.map(r => buildSubjectText({ primary_slug: r.niche, creator_handle: r.creator_handle, caption: r.caption, hashtags: r.hashtags }));` then `const { vectors } = await embedBatch(subjectTexts);` (call in chunks of 100). Map results back to rows by index.
- Add `embedding: vectors[i]` field to each dbRow.
- The existing upsert is unchanged — Supabase accepts the `embedding` column the same way as other columns once the migration adds it.
- Wrap embed call in try/catch — on failure, log warning and proceed WITHOUT embedding (leave column NULL). Backfill script will catch them later. This preserves additive-only constraint: Phase 1 build still succeeds even if Phase 8 embedder fails.
- Imports: `import { buildSubjectText, embedBatch } from "../retrieval/embedder";`.

---

### `src/app/api/webhooks/apify/route.ts` — EXTENSION (auto-embed on insert per D-08)

**Role:** API route handler (self-extension)
**Data flow:** mutation
**Pattern to copy:** the existing `records` build at lines 67-91 — extend it to include `embedding`.

**Current upsert build pattern** (`route.ts:64-107`):

```typescript
const BATCH_SIZE = 50;
let upsertedCount = 0;
let errorCount = 0;

for (let i = 0; i < items.length; i += BATCH_SIZE) {
  const batch = items.slice(i, i + BATCH_SIZE);

  const records = batch
    .filter((item): item is ApifyVideoItem => Boolean(item.id))
    .map((item) => ({
      platform: "tiktok" as const,
      platform_video_id: item.id,
      video_url: item.webVideoUrl ?? null,
      author: item.authorMeta?.name ?? null,
      // ...
      hashtags: item.hashtags?.map((h) => h.name) ?? null,
      // ...
    }));

  if (records.length === 0) continue;

  const { error } = await supabase
    .from("scraped_videos")
    .upsert(records, {
      onConflict: "platform,platform_video_id",
      ignoreDuplicates: false,
    });

  if (error) {
    log.error("Batch upsert error", { offset: i, error: error.message });
    errorCount += records.length;
  } else {
    upsertedCount += records.length;
  }
}
```

**Adapt by:**
- After the `records` build inside the loop, call `embedBatch(subjectTexts)` where subjectTexts is the D-06 formula applied to each record's `(primary_niche, author, description, hashtags)`. Add `embedding: vectors[i]` to each record.
- Match `BATCH_SIZE = 50` here — Gemini sync batch supports up to 100, 50 fits comfortably with headroom.
- ALSO add the new D-08 mappings to records: `creator_handle: item.authorMeta?.name ?? null` (alias of author), `primary_niche: <derived from category + hashtag lookup>` (RESEARCH Finding 3 Strategy A — apply CATEGORY_TO_NICHE_SLUG map at insert time), `posted_at: <from Apify item metadata, e.g. item.createTime>` if available.
- Wrap embed call in try/catch: on failure, log warning and proceed without embedding (column stays NULL — backfill script catches it). DO NOT block the webhook on embedding failures (cron must keep working).
- Imports: `import { buildSubjectText, embedBatch } from "@/lib/engine/retrieval/embedder";`.

---

### `src/types/database.types.ts` (REGENERATED)

**Role:** Auto-generated TS types from Supabase schema
**Data flow:** type definitions
**Pattern to copy:** none — this file is regenerated via the existing project script after migration.

**Adapt by:**
- After applying the new migration, run the existing regen command (planner verifies — typically `pnpm supabase:gen-types` or equivalent based on package.json scripts).
- New columns appear automatically: `training_corpus.embedding`, `scraped_videos.embedding`, `scraped_videos.primary_niche` + `follower_tier` + `posted_at` + `creator_handle`, `analysis_results.retrieval_evidence` + `retrieval_score`.
- `vector(768)` typically maps to `string | null` in supabase-js types (vector is wire-serialized as a stringified array). Code that reads vectors must NOT use this type directly — the RPC function returns rows where `embedding` is NEVER selected back out (per the RPC return type in RESEARCH §"Migration: Create the RPC function" — only metadata + similarity is returned). So this column shows up in `Row` type but is never directly consumed in TS.

---

## Shared Patterns

### Service-role Supabase client
**Source:** `src/lib/supabase/service.ts` via `createServiceClient()` (imported in `pipeline.ts:3`, `trends.ts:1`, `orchestrator.ts:3`)
**Apply to:** `retrieval-stage.ts` (reuses pipeline's client passed in), `embed-corpus.ts` (creates its own), `pgvector-client.ts` (accepts as arg)

```typescript
import { createServiceClient } from "@/lib/supabase/service";
const supabase = createServiceClient(); // bypasses RLS — required for system-wide tables
```

System-wide tables (`training_corpus`, `scraped_videos`) and the new RPC functions all require service-role access. Per RESEARCH §"Reusable Assets": this is the standard pattern.

---

### Logger per module
**Source:** `src/lib/logger.ts` via `createLogger({ module: "..." })` (used in `gemini.ts:15`, `trends.ts:7`, `creator.ts:5`, `niche-detector.ts:12`, `orchestrator.ts:22`, EVERY engine file)
**Apply to:** All new retrieval modules (`embedder.ts`, `pgvector-client.ts`, `retrieval-stage.ts`, `bucket-derivation.ts`, `re-ranker.ts`)

```typescript
import { createLogger } from "@/lib/logger";
const log = createLogger({ module: "retrieval.embedder" }); // dot-separated namespace
```

Naming convention: `<area>.<file-basename>` (e.g. `retrieval.embedder`, `retrieval.stage`, `retrieval.pgvector`). Matches existing engine modules (`engine.gemini`, `wave0.niche`, `corpus/orchestrator`).

---

### Sentry capture at stage boundaries
**Source:** `gemini.ts:394-396`, `niche-detector.ts:8`, `pipeline.ts:1`, `orchestrator.ts:2`
**Apply to:** `retrieval-stage.ts` outer catch + `embed-corpus.ts` batch failure handling + `pgvector-client.ts` RPC error rethrow (caller catches)

```typescript
import * as Sentry from "@sentry/nextjs";

// In an engine stage:
Sentry.captureException(error, {
  tags: { stage: "retrieval", source: "retrieval-stage", requestId },
});

// At a major checkpoint inside a stage:
Sentry.addBreadcrumb({
  category: "engine.retrieval",
  message: "Embedding complete",
  level: "info",
  data: { duration_ms, cost_cents, dims: 768 },
});
```

Tag conventions seen in the codebase: `stage` (always), `requestId` (in pipeline-spawned stages), `source` (for sub-stage modules), `corpusVersion` (for backfill paths).

---

### Stage event emission ownership
**Source:** `events.ts:19-49` (helpers) + `niche-detector.ts:54` (in-stage emission pattern — Phase 4 D-16)
**Apply to:** `retrieval-stage.ts` MUST emit its own `stage_start`/`stage_end` events internally (NOT wrapped in pipeline's outer `timed()`)

```typescript
// In retrieval-stage.ts:
const startTs = emitStageStart(onEvent, "retrieval", 1);
let costCents = 0;
try {
  // ... work ...
  emitStageEnd(onEvent, "retrieval", 1, startTs, { cost_cents: costCents, ok: true });
  return result;
} catch (error) {
  emitStageEnd(onEvent, "retrieval", 1, startTs, {
    cost_cents: costCents, ok: false,
    warning: error instanceof Error ? error.message : String(error)
  });
  return GRACEFUL_FALLBACK;
}
```

In pipeline.ts, the retrieval sibling promise must NOT be wrapped in another `timed("retrieval", ...)` call (would double-emit). Instead, wrap in a plain try/catch that pushes warnings on failure (the events are emitted from inside the stage).

---

### Graceful degradation (Phase 1 D-rule, HARD-03)
**Source:** Every Wave 1 sibling (`pipeline.ts:362-371`, `400-410`, etc.) + `niche-detector.ts` returns `null` on any failure
**Apply to:** `retrieval-stage.ts` — return `{ evidence: [], score: null, availability: false, cost_cents }` on any error; emit pipeline warning `"Benchmark retrieval unavailable: <reason>"`

```typescript
// In pipeline.ts where the retrieval sibling lives:
const retrievalPromise = (async (): Promise<BenchmarkRetrievalResult> => {
  try {
    return await runBenchmarkRetrieval(payload, creatorContext, wave0Result, supabase, onStageEvent);
  } catch (error) {
    Sentry.captureException(error, { tags: { stage: "retrieval", requestId } });
    warnings.push(`Benchmark retrieval unavailable: ${error instanceof Error ? error.message : String(error)}`);
    timings.push({ stage: "retrieval", duration_ms: 0 });
    return { evidence: [], score: null, availability: false, cost_cents: 0 };
  }
})();
```

Per BENCH-05 (no regressions in existing 203 tests): retrieval failure must NEVER break the prediction pipeline. The aggregator's `selectWeights` already handles `availability.retrieval = false` via the existing redistribution math — no special-case code needed.

---

### Zod validation at LLM/external boundaries
**Source:** `types.ts:319-352` (BehavioralPredictionsSchema), `gemini.ts:96-104` (parseGeminiResponse with safeParse + descriptive throw)
**Apply to:** `embedder.ts` validates the Gemini embedding response shape (length === 768); `retrieval-stage.ts` validates the RPC result shape via `RetrievalEvidenceItemSchema`; `types.ts` defines both new schemas.

```typescript
function parseGeminiResponse(raw: string): GeminiAnalysis {
  const cleaned = stripFences(raw);
  const parsed = JSON.parse(cleaned);
  const result = GeminiResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Gemini response validation failed: ${result.error.message}`);
  }
  return result.data;
}
```

For embeddings, validation is simpler: just check `values.length === 768` (per RESEARCH §"Model + SDK Call"). RPC rows validated via `RetrievalEvidenceItemSchema.array().parse(rows)` at the retrieval-stage boundary, with safeParse + log-on-failure (degraded item is skipped, not thrown).

---

### Idempotent migrations via `IF NOT EXISTS`
**Source:** Every recent migration (`20260517120000`, `20260517210000`, `20260516*`, ...)
**Apply to:** All Phase 8 DDL — `CREATE EXTENSION IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`.

Re-runs of the migration after partial failure must be safe. The Supabase Studio operator workflow (Phase 3 STATE.md line 139 — "user applied migration via Studio SQL editor") depends on idempotency.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | All 17 files in Phase 8 have a strong codebase analog. |

The closest "no analog" was `pgvector-client.ts` for the `.rpc()` pattern — no existing engine code uses Supabase RPC. The path used is `.from().select()` everywhere. However, this is a wire-level difference; the surrounding shape (accept supabase as arg, return typed rows, throw on error) is identical to existing direct-DB-read helpers. Classified as "role-match" rather than "no analog."

---

## Critical Cross-File Constraints

These ride between Phase 8 files and existing engine code. Planner must surface in plans:

1. **SCORE_WEIGHT_KEYS must include `retrieval`** — extending `SCORE_WEIGHTS` in aggregator.ts is NOT enough; the keys tuple at line 43 is what `selectWeights` iterates. Skipping this causes the new weight to be silently dropped by the filter at line 67. (Analog: Phase 4 D-20 already documented this trap.)

2. **D-06 subject text formula must be byte-identical at backfill (RETRIEVAL_DOCUMENT) AND predict time (RETRIEVAL_QUERY)** — both `embedBatch` callers (orchestrator.ts, webhooks/apify/route.ts, embed-corpus.ts) AND the predict-time `embedQuery` caller (retrieval-stage.ts) MUST go through `buildSubjectText()` from embedder.ts. Never inline the formula. Test: `embedder.test.ts` asserts byte-identical output for given inputs.

3. **D-09 retrieval-stage emits its own events; pipeline.ts must NOT wrap in `timed()`** — the retrieval sibling in pipeline.ts is a plain try/catch around `runBenchmarkRetrieval`, NOT a `timed("retrieval", ...)` call. Wrapping would double-emit stage_start/stage_end events, breaking pipeline.test.ts assertions about event count.

4. **RESEARCH Finding 1: model name divergence from D-05** — code uses `gemini-embedding-001` not `text-embedding-004`. The 768-d intent of D-05 is preserved via `outputDimensionality: 768`. Surface this in plan SUMMARY for user awareness.

5. **RESEARCH Finding 3: scraped_videos missing filter columns** — migration MUST add `primary_niche`, `follower_tier`, `posted_at`, `creator_handle` to scraped_videos. The retrieval RPC function relies on them. The `bucketAndPersist` extension AND the webhook handler extension AND the embed-corpus backfill must populate `primary_niche` (and `creator_handle`) at insert time. Phase 8 plan includes a one-time UPDATE backfill SQL inside the migration for existing rows.

6. **RESEARCH Finding 5: NON_CORPUS_ENGAGEMENT_PERCENTILES requires ≥30 rows per niche** — `bucket-derivation.ts` constant is populated by `scripts/embed-corpus.ts --derive-percentiles` only AFTER backfill embeds enough scraped_videos. Niches with `<30` rows fall back to all-`average` bucketing. Plan must sequence: (a) embed all rows, (b) run `--derive-percentiles`, (c) commit the generated constant block before merging.

---

## Metadata

**Analog search scope:**
- `src/lib/engine/` (15 files)
- `src/lib/engine/corpus/` (16 files)
- `src/lib/engine/wave0/` (4 files)
- `src/lib/engine/__tests__/` (20 test files)
- `src/app/api/webhooks/apify/` + `src/app/api/cron/scrape-trending/`
- `supabase/migrations/` (22 SQL files)
- `scripts/` (13 CLI scripts)

**Files scanned:** ~90
**Pattern extraction date:** 2026-05-18
**Most recent migration date used for filename:** 2026-05-17 → Phase 8 should use 2026-05-18T00:00:00 → `20260518000000_phase8_pgvector.sql`
