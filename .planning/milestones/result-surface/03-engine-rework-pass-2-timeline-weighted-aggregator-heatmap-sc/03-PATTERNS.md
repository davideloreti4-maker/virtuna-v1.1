# Phase 3: Engine Rework — Pass 2 Timeline + Weighted Aggregator + Heatmap Schema + Filmstrip - Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 22 (13 new, 9 modified)
**Analogs found:** 22 / 22

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/engine/wave3/pass2.ts` | orchestrator | request-response (10-parallel) | `src/lib/engine/wave3.ts` | exact |
| `src/lib/engine/wave3/persona-prompts-pass2.ts` | prompt builder | transform | `src/lib/engine/wave3/persona-prompts.ts` | exact |
| `src/lib/engine/wave3/weighted-aggregator.ts` | aggregator | transform | `src/lib/engine/wave3/aggregator.ts` | role-match |
| `src/lib/engine/filmstrip/extract.ts` | utility | file-I/O | `src/lib/engine/qwen/omni-analysis.ts` (subprocess shape) | partial |
| `src/lib/engine/filmstrip/storage.ts` | storage client | request-response | `src/lib/supabase/service.ts` | role-match |
| `src/lib/engine/filmstrip/queue.ts` | background worker | event-driven | `src/lib/engine/pipeline.ts` (fire-and-forget fetch) | partial |
| `src/lib/engine/persona-weights.ts` | utility | transform | `src/lib/engine/wave3/aggregator.ts` (weight math shape) | partial |
| `src/app/api/filmstrip/extract/route.ts` | controller | request-response | `src/app/api/analyze/[id]/stream/route.ts` | role-match |
| `supabase/migrations/<ts>_outcomes_table.sql` | migration | CRUD | `supabase/migrations/20260524000000_niche_post_windows.sql` | exact |
| `src/lib/engine/__tests__/pass2.test.ts` | test | — | `src/lib/engine/__tests__/wave3.test.ts` | exact |
| `src/lib/engine/__tests__/weighted-aggregator.test.ts` | test | — | `src/lib/engine/__tests__/wave3-aggregator.test.ts` | role-match |
| `src/lib/engine/__tests__/filmstrip.test.ts` | test | — | `src/lib/engine/__tests__/wave3.test.ts` | role-match |
| `src/lib/engine/__tests__/persona-weights.test.ts` | test | — | `src/lib/engine/__tests__/anti-virality.test.ts` | role-match |
| `src/lib/engine/qwen/omni-analysis.ts` (modify) | orchestrator | request-response | self | — |
| `src/lib/engine/qwen/schemas.ts` (modify) | schema/types | transform | self | — |
| `src/lib/engine/wave3.ts` (modify) | orchestrator | request-response | self | — |
| `src/lib/engine/aggregator.ts` (modify) | aggregator | transform | self | — |
| `src/lib/engine/types.ts` (modify) | schema/types | — | self | — |
| `src/lib/engine/anti-virality.ts` (modify) | utility | transform | self | — |
| `src/lib/engine/stage10-critique.ts` (modify) | orchestrator | request-response | self | — |
| `src/lib/engine/pipeline.ts` (modify) | orchestrator | event-driven | self | — |
| `src/lib/engine/events.ts` (modify) | schema/types | — | self | — |

---

## Pattern Assignments

### `src/lib/engine/wave3/pass2.ts` (orchestrator, 10-parallel request-response)

**Analog:** `src/lib/engine/wave3.ts`

Mirror the entire structure of `wave3.ts` end-to-end. Key deltas: model = `QWEN_REASONING_MODEL`, add `enable_thinking: true` + `thinking_budget: 8000`, timeout = 60s, input adds `segments[]` + `keyframeUris[]` + `pass1Results[]`, output type = `Wave3Pass2Outcome`.

**Imports pattern** (lines 1–22):
```typescript
import * as Sentry from "@sentry/nextjs";
import { createLogger } from "@/lib/logger";
import type { StageEventCallback } from "../events";
import { emitStageStart, emitStageEnd } from "../events";
import { selectPersonaSlots, type PersonaSlot } from "./persona-registry";
import { buildPass2SystemPrompt, buildPass2UserContent, Pass2ResponseSchema } from "./persona-prompts-pass2";
import { getQwenClient, QWEN_REASONING_MODEL } from "../qwen/client";
import type { PersonaSimulationResult } from "../types";
import type { SegmentGrid, HeatmapPayload } from "../types"; // new types
```

**Module-level constants** (lines 33–38 in wave3.ts):
```typescript
const PER_CALL_TIMEOUT_MS = 60_000; // thinking-mode is slower than flash (was 45_000)
const SUCCESS_THRESHOLD = 7;         // same D-06 threshold as Pass 1
```

**Thinking-mode call pattern** — replaces lines 153–163 in wave3.ts:
```typescript
const response = await ai.chat.completions.create(
  {
    model: QWEN_REASONING_MODEL,  // "qwen3.6-plus"
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: buildPass2UserContent(slot, pass1, segments, keyframeUris) },
    ],
    response_format: { type: "json_object" },
    // @ts-expect-error — DashScope extension, not in OpenAI types
    enable_thinking: true,
    // @ts-expect-error
    thinking_budget: 8000,
  } as never,
  { signal: controller.signal },
);
```

**Cost telemetry** (lines 167–182 in wave3.ts — copy verbatim, use `calculateCost(QWEN_REASONING_MODEL, completion.usage)`):
```typescript
// Use calculateCost from qwen/cost.ts (already priced for qwen3.6-plus):
import { calculateCost } from "../qwen/cost";
// ...
const callCostCents = calculateCost(QWEN_REASONING_MODEL, response.usage ?? undefined);
```

**Retry-once pattern** (lines 148–243 in wave3.ts — copy verbatim):
- `while (attempt <= 1)` loop
- retry ONLY on Zod validation failure (`isValidation` guard)
- NO retry on AbortError (timeout)
- Accumulate `callCostAccum` across both attempts

**Promise.allSettled + survivor counting** (lines 246–268 in wave3.ts — copy verbatim):
```typescript
const settledResults = await Promise.allSettled(slots.map((slot, i) =>
  callPersona(slot, pass1Results[i]!)
));
const survivors: Pass2PersonaResult[] = [];
const warnings: string[] = [];
for (let i = 0; i < settledResults.length; i++) { ... }
```

**Stage event shape** (lines 127–128 in wave3.ts):
```typescript
const stageName = `wave_3_pass2_persona_${slot.archetype}_${slot.slot_type}`;
const callStart = emitStageStart(onEvent, stageName, 3);  // wave=3
// wave-level:
emitStageStart(onEvent, "wave_3_pass2", 3);
```

**D-23 telemetry log** (add after successful parse, not in wave3.ts analog):
```typescript
log.info("pass2 persona complete", {
  archetype: slot.archetype,
  pass2_latency_ms: Math.round(performance.now() - callStart),
  pass2_cost_cents: +callCostAccum.toFixed(6),
});
```

**Return shape** (pass2-specific, extends Wave3Outcome pattern):
```typescript
export interface Wave3Pass2Outcome {
  pass2Results: Pass2PersonaResult[];   // successful persona results
  warnings: string[];
  cost_cents: number;
  pass2_success_count: number;
  pass2_aggregate_built: boolean;       // true when ≥7 succeeded
}
```

---

### `src/lib/engine/wave3/persona-prompts-pass2.ts` (prompt builder, transform)

**Analog:** `src/lib/engine/wave3/persona-prompts.ts`

Mirror module structure (STABLE_SYSTEM_PROMPT + volatile user builder + Zod response schema). Key additions: inject keyframes as `image_url` content array items, inject `segment_grid` as JSON block, add D-04 demographic + time-of-day enrichment.

**Imports + module pattern** (lines 1–20 in persona-prompts.ts):
```typescript
import { z } from "zod";
import type { PersonaSlot } from "./persona-registry";
import type { SegmentGrid } from "../types";
import type { PersonaSimulationResult } from "../types";
```

**Stable system prompt constant** (lines 30–65 in persona-prompts.ts — same discipline):
```typescript
// STABLE_PASS2_SYSTEM_PROMPT — byte-identical per (archetype × niche) tuple.
// D-17: inject demographic context + time-of-day scrolling-state as STATIC blocks
// so the DashScope cache prefix covers the full tuple.
// NEVER interpolate Date.now() / request IDs here.
export const STABLE_PASS2_SYSTEM_PROMPT = `You are simulating a TikTok viewer...`;
```

**Volatile user content builder** (lines 73–138 in persona-prompts.ts pattern):
```typescript
// Returns OpenAI content array (image_url items + text)
export function buildPass2UserContent(
  slot: PersonaSlot,
  pass1: PersonaSimulationResult,
  segments: SegmentGrid[],
  keyframeUris: (string | null)[],
): Array<{ type: "image_url"; image_url: { url: string } } | { type: "text"; text: string }> {
  const items: Array<...> = [];
  // inject available keyframes
  for (const uri of keyframeUris) {
    if (uri) items.push({ type: "image_url", image_url: { url: uri } });
  }
  // inject segment grid + Pass 1 verdict as text
  items.push({ type: "text", text: buildPass2TextBlock(slot, pass1, segments) });
  return items;
}
```

**Zod response schema** (lines 148–157 in persona-prompts.ts — same shape):
```typescript
export const Pass2ResponseSchema = z.object({
  persona_id: z.string(),
  segment_reactions: z.array(z.object({
    t_start: z.number().min(0),
    t_end:   z.number().min(0),
    attention: z.number().min(0).max(1),     // D-06 guard: attention in [0,1]
    reason: z.string().max(400).optional(),  // inflection points only
    swipe_predicted: z.boolean(),
  })),
  pass2_latency_ms: z.number(),
  pass2_cost_cents: z.number(),
});
export type Pass2Response = z.infer<typeof Pass2ResponseSchema>;
```

**Quality guard** (D-06 — add after Zod parse, not in analog):
```typescript
// Segment count must match segments.length exactly:
if (parsed.segment_reactions.length !== segments.length) {
  throw new Error(`validation failed: segment_reactions.length mismatch (${parsed.segment_reactions.length} vs ${segments.length})`);
}
```

---

### `src/lib/engine/wave3/weighted-aggregator.ts` (aggregator, transform)

**Analog:** `src/lib/engine/wave3/aggregator.ts`

Mirror module structure (pure TypeScript math, no I/O, exported functions). Key additions: persona-weight resolution, weighted curve computation, hook score, top dropoff timestamp, HeatmapPayload assembly.

**Imports** (lines 1–2 in aggregator.ts):
```typescript
import type { Pass2PersonaResult, SegmentGrid, HeatmapPayload, PersonaWeights } from "../types";
import { resolveWeights } from "../persona-weights";
```

**Export constants pattern** (lines 13–17 in aggregator.ts):
```typescript
export const SUCCESS_THRESHOLD = 7; // D-06: ≥7/10 Pass 2 successes for non-null heatmap
export const DEFAULT_WEIGHTS: PersonaWeights = {
  fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05,
};
```

**Core aggregation function** (mirrors `aggregatePersonaResults` lines 31–65):
```typescript
export function buildWeightedCurve(
  pass2Results: Pass2PersonaResult[],
  segments: SegmentGrid[],
  weights: PersonaWeights,
): { weighted_curve: number[]; weighted_completion_pct: number; weighted_top_dropoff_t: number; weighted_hook_score: number } {
  // Weight normalization — critical: redistribute missing persona type weight (Pitfall 6)
  const normalizedWeights = normalizeOverSurvivors(pass2Results, weights);
  // Per segment: weighted mean of attention across surviving personas
  const weighted_curve = segments.map((_, segIdx) => {
    let sum = 0; let totalW = 0;
    for (const r of pass2Results) {
      const w = getPersonaWeight(r, normalizedWeights);
      sum += (r.segment_reactions[segIdx]?.attention ?? 0) * w;
      totalW += w;
    }
    return totalW > 0 ? sum / totalW : 0;
  });
  // ...
}
```

**Null-safe mean helper** (copy from aggregator.ts lines 67–70):
```typescript
function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
```

**Weight normalization over survivors** (Pitfall 6 — not in analog, add new):
```typescript
function normalizeOverSurvivors(
  survivors: Pass2PersonaResult[],
  weights: PersonaWeights,
): PersonaWeights {
  // Sum weights of surviving persona types; redistribute proportionally
  // Returns weights that sum to 1.0 — prevents NaN from missing cross_niche slot
}
```

**HeatmapPayload assembly** (new, returns D-13 shape):
```typescript
export function assembleHeatmapPayload(
  pass2Results: Pass2PersonaResult[],
  segments: SegmentGrid[],
  weights: PersonaWeights,
  weightsSource: HeatmapPayload['weights_source'],
): HeatmapPayload {
  // segments[], personas[], weighted_curve[], weights, weights_source
}
```

---

### `src/lib/engine/filmstrip/storage.ts` (storage client, request-response)

**Analog:** `src/lib/supabase/service.ts`

Thin wrapper using service-role client for Storage operations. Uses `createServiceClient()` — never creates its own client.

**Imports + client pattern** (entire service.ts):
```typescript
import { createServiceClient } from "@/lib/supabase/service";
import { createLogger } from "@/lib/logger";
const log = createLogger({ module: "engine.filmstrip.storage" });
```

**Upload + signed URL pattern** (from RESEARCH.md §Code Examples):
```typescript
export async function uploadFrameAndGetSignedUrl(
  analysisId: string,
  segmentIdx: number,
  jpegBuffer: Buffer,
): Promise<string | null> {
  const supabase = createServiceClient();
  const path = `${analysisId}/${segmentIdx}.jpg`;
  
  const { error: uploadError } = await supabase.storage
    .from('filmstrips')
    .upload(path, jpegBuffer, { contentType: 'image/jpeg', upsert: true });
  if (uploadError) {
    log.error("filmstrip upload failed", { path, error: uploadError.message });
    return null;
  }

  const { data, error: urlError } = await supabase.storage
    .from('filmstrips')
    .createSignedUrl(path, 60 * 60 * 24 * 30); // 30 days in seconds
  if (urlError || !data) {
    log.error("filmstrip signed URL failed", { path, error: urlError?.message });
    return null;
  }
  return data.signedUrl;
}
```

**Graceful degradation contract** (matches engine pattern — NEVER throws):
```typescript
// All exported functions catch their own errors and return null on failure.
// Matches: "graceful degradation, never throw" from wave3.ts contract.
```

---

### `src/lib/engine/filmstrip/extract.ts` (utility, file-I/O)

**Analog:** `src/lib/engine/qwen/omni-analysis.ts` (retry + error structure), but core logic is `child_process.spawn` with `ffmpeg-static`.

**Imports**:
```typescript
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import { createLogger } from "@/lib/logger";
const log = createLogger({ module: "engine.filmstrip.extract" });
```

**Core extraction function**:
```typescript
export async function extractFrameAtTimestamp(
  videoUrl: string,
  tStartSeconds: number,
): Promise<Buffer | null> {
  // ffmpeg -ss <t_start> -i <url> -frames:v 1 -q:v 4 -f image2 pipe:1
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const proc = spawn(ffmpegPath!, [
      "-ss", String(tStartSeconds),
      "-i", videoUrl,
      "-frames:v", "1",
      "-q:v", "4",
      "-f", "image2",
      "pipe:1",
    ]);
    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.on("close", (code) => {
      if (code !== 0) {
        log.error("ffmpeg non-zero exit", { code, tStartSeconds });
        resolve(null);  // never throw — graceful degradation contract
      } else {
        resolve(Buffer.concat(chunks));
      }
    });
    proc.on("error", (err) => {
      log.error("ffmpeg spawn error", { error: err.message });
      resolve(null);
    });
  });
}
```

**CRITICAL: `next.config.ts` addition required** (from RESEARCH.md):
```typescript
// next.config.ts
experimental: {
  serverComponentsExternalPackages: ['ffmpeg-static']
}
```

---

### `src/lib/engine/filmstrip/queue.ts` (background worker, event-driven)

**Analog:** `src/lib/engine/pipeline.ts` (fire-and-forget fetch pattern)

**Fire-and-forget trigger pattern** (D-11 — never await, never block pipeline):
```typescript
import { createLogger } from "@/lib/logger";
const log = createLogger({ module: "engine.filmstrip.queue" });

export function triggerFilmstripGeneration(
  analysisId: string,
  segments: SegmentGrid[],
  videoUrl: string,
): void {
  // Fire-and-forget: void fetch to dedicated filmstrip route
  // ANTI-PATTERN: DO NOT await this. Pipeline must not block on filmstrip.
  void fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/filmstrip/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysisId, segments, videoUrl }),
  }).catch((err: unknown) => {
    log.error("filmstrip trigger failed", { analysisId, error: String(err) });
    // Swallow — filmstrip is non-blocking background signal
  });
  log.info("filmstrip generation triggered", { analysisId, segmentCount: segments.length });
}
```

---

### `src/app/api/filmstrip/extract/route.ts` (controller, request-response)

**Analog:** `src/app/api/analyze/[id]/stream/route.ts` (route structure)

**Route config** (lines 19–21 in stream/route.ts):
```typescript
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;  // filmstrip can take time for long videos
```

**POST handler shape**:
```typescript
export async function POST(request: Request): Promise<Response> {
  // 1. Parse + validate body (analysisId, segments[], videoUrl)
  // 2. For each segment: extractFrameAtTimestamp → uploadFrameAndGetSignedUrl
  // 3. onEvent callback emits filmstrip_segment_ready SSE event (via Supabase realtime or direct DB update)
  // NEVER: block caller — fire response immediately after triggering extraction loop
}
```

---

### `src/lib/engine/persona-weights.ts` (utility, transform)

**Analog:** `src/lib/engine/wave3/aggregator.ts` (pure math module pattern)

**Module structure** (mirrors aggregator.ts — pure functions, no I/O, exported types):
```typescript
import { createLogger } from "@/lib/logger";
const log = createLogger({ module: "engine.persona-weights" });

export interface PersonaWeights {
  fyp: number; niche: number; loyalist: number; cross_niche: number;
}
export interface PersonaWeightConfig {
  default: PersonaWeights;
  niche_overrides?: Record<string, PersonaWeights>;
  creator_overrides?: Record<string, PersonaWeights>;
  analysis_override?: PersonaWeights;
}

export const DEFAULT_PERSONA_WEIGHT_CONFIG: PersonaWeightConfig = {
  default: { fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05 },
};

export function resolveWeights(
  config: PersonaWeightConfig,
  context: { analysis_override?: PersonaWeights; creator_id?: string; niche?: string },
): { weights: PersonaWeights; source: 'default' | 'niche_override' | 'creator_override' | 'analysis_override' } {
  // Precedence: analysis > creator > niche > default
  // Always call normalizeWeights() on resolved result
}

export function normalizeWeights(w: PersonaWeights): PersonaWeights {
  const sum = w.fyp + w.niche + w.loyalist + w.cross_niche;
  if (sum === 0) return DEFAULT_PERSONA_WEIGHT_CONFIG.default;
  return { fyp: w.fyp/sum, niche: w.niche/sum, loyalist: w.loyalist/sum, cross_niche: w.cross_niche/sum };
}
```

---

### `supabase/migrations/<ts>_outcomes_table.sql` (migration, CRUD)

**Analog:** `supabase/migrations/20260524000000_niche_post_windows.sql` (pg_cron + SECURITY DEFINER pattern)
**Storage bucket analog:** `supabase/migrations/20260512010000_corpus_videos_storage.sql`

This migration has three parts: (1) outcomes table, (2) filmstrips Storage bucket, (3) pg_cron cleanup function.

**Outcomes table pattern** (D-18 locked schema):
```sql
-- Table pattern: same header comment style as niche_post_windows.sql
CREATE TABLE IF NOT EXISTS outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  posted_at TIMESTAMPTZ,
  real_views INTEGER,
  real_completion_pct NUMERIC(5,2),
  real_share_pct NUMERIC(5,2),
  real_comment_pct NUMERIC(5,2),
  real_save_pct NUMERIC(5,2),
  creator_rating SMALLINT CHECK (creator_rating BETWEEN 1 AND 5),
  creator_note TEXT,
  source TEXT NOT NULL DEFAULT 'creator_self_report',
  captured_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX outcomes_analysis_id_idx ON outcomes(analysis_id);
CREATE INDEX outcomes_posted_at_idx ON outcomes(posted_at) WHERE posted_at IS NOT NULL;
```

**Storage bucket pattern** (lines 25–32 in corpus_videos_storage.sql):
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'filmstrips', 'filmstrips',
  false,       -- private; signed URLs only
  5242880,     -- 5 MB per frame (JPEGs are small)
  ARRAY['image/jpeg']
) ON CONFLICT (id) DO NOTHING;
```

**pg_cron cleanup pattern** (lines 58–end in niche_post_windows.sql — SECURITY DEFINER + idempotent unschedule):
```sql
CREATE OR REPLACE FUNCTION cleanup_expired_filmstrips()
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = storage, pg_temp
AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'filmstrips'
    AND created_at < NOW() - INTERVAL '30 days';
END;
$$;

REVOKE EXECUTE ON FUNCTION cleanup_expired_filmstrips() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION cleanup_expired_filmstrips() FROM anon, authenticated;

-- Idempotent schedule (mirrors niche_post_windows.sql unschedule-then-reschedule):
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-filmstrips') THEN
    PERFORM cron.unschedule('cleanup-expired-filmstrips');
  END IF;
END $$;

SELECT cron.schedule(
  'cleanup-expired-filmstrips',
  '0 3 * * *',
  $$SELECT cleanup_expired_filmstrips()$$
);
```

---

### `src/lib/engine/__tests__/pass2.test.ts` (test)

**Analog:** `src/lib/engine/__tests__/wave3.test.ts` (copy structure verbatim)

**Mock setup** (lines 27–61 in wave3.test.ts — copy verbatim):
```typescript
vi.mock("@/lib/logger", () => ({ createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }));

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));
vi.mock("openai", () => {
  const MockOpenAI = vi.fn(function (this: Record<string, unknown>) {
    this.chat = { completions: { create: mockCreate } };
  });
  return { default: MockOpenAI };
});
process.env.DASHSCOPE_API_KEY = "test-key";
```

**Test fixture factory** (mirrors `makePayload` / `makeWave0Result` — add `makeSegments()` + `makePass1Results()`):
```typescript
function makeSegments(count = 5): SegmentGrid[] {
  return Array.from({ length: count }, (_, i) => ({
    idx: i, t_start: i * 2, t_end: (i + 1) * 2,
    visual_event: `event_${i}`, audio_event: `audio_${i}`,
    is_hook_zone: i === 0,
  }));
}
function mockPass2Response(segmentCount = 5) {
  return {
    choices: [{ message: { content: JSON.stringify({
      persona_id: "p1",
      segment_reactions: Array.from({ length: segmentCount }, (_, i) => ({
        t_start: i * 2, t_end: (i+1)*2, attention: 0.7, swipe_predicted: false,
      })),
      pass2_latency_ms: 1200, pass2_cost_cents: 0.003,
    }) } }],
    usage: { prompt_tokens: 5000, completion_tokens: 400 },
  };
}
```

**12-test surface to mirror** (from wave3.test.ts comment header):
1. fires exactly 10 parallel calls with `enable_thinking: true`
2. all-succeed → 10 `Pass2PersonaResult` entries with full shape
3. 7/10 succeed → `pass2_aggregate_built: true` + 3 failure warnings
4. 5/10 succeed → `pass2_aggregate_built: false`, heatmap null
5. Promise.allSettled isolation — 10 attempted even with rejections
6. cost telemetry: `wave_3_pass2` stage_end carries `cost_cents ≥ 0`
7. events: 22 stage events when all 10 succeed (10 per-persona pairs + 1 wave pair)
8. Zod validation failure → retry-once → 11 total calls
9. segment count mismatch validation → persona dropped from aggregate
10. AbortError → no retry → slot fails after first attempt
11. `thinking_budget: 8000` present in every API call
12. D-23 telemetry: `pass2_latency_ms` + `pass2_cost_cents` logged per persona

---

### `src/lib/engine/__tests__/weighted-aggregator.test.ts` (test)

**Analog:** `src/lib/engine/__tests__/wave3-aggregator.test.ts`

Pure math tests — no mock needed. Test the weighted curve math, normalization, hook score, top_dropoff, HeatmapPayload shape, Pitfall 6 (missing persona type redistributes weight).

---

### `src/lib/engine/__tests__/filmstrip.test.ts` (test)

**Analog:** `src/lib/engine/__tests__/wave3.test.ts` (mock infrastructure)

Mock `ffmpeg-static`, `child_process.spawn`, and `createServiceClient`. Assert: fire-and-forget is non-blocking, upload called per segment, signed URL returned.

---

### `src/lib/engine/__tests__/persona-weights.test.ts` (test)

**Analog:** `src/lib/engine/__tests__/anti-virality.test.ts` (pure unit test — no mocks)

```typescript
import { describe, it, expect } from "vitest";
import { resolveWeights, normalizeWeights, DEFAULT_PERSONA_WEIGHT_CONFIG } from "../persona-weights";

describe("persona-weights precedence resolver", () => {
  it("returns default when no overrides", () => { ... });
  it("analysis_override > creator_override > niche_override > default", () => { ... });
  it("normalizeWeights: values sum to 1.0 ± 0.001", () => { ... });
  it("normalizeWeights: missing cross_niche slot redistributes correctly", () => { ... });
  it("normalizeWeights: all-zero input returns default weights", () => { ... });
});
```

---

## Modified Files — Pattern Notes

### `src/lib/engine/qwen/schemas.ts` — Add `segments` field

**Analog:** existing `emotion_arc` extension (lines 56–63 + 137–139) — same additive `.optional()` pattern:
```typescript
// Line 139 pattern to follow:
emotion_arc: z.array(EmotionArcPointSchema).optional(),

// New — add after emotion_arc in OmniAnalysisZodSchema:
segments: z.array(z.object({
  t_start: z.number().min(0),
  t_end:   z.number().min(0),
  visual_event: z.string().max(200),
  audio_event:  z.string().max(200),
  scene_boundary_reason: z.string().max(300).optional(),
})).optional(),
// .optional() = backward compat; server normalizer sets is_hook_zone downstream
```

**New standalone schema for server normalizer** (add alongside `EmotionArcPointSchema` at line 56):
```typescript
export const SegmentSchema = z.object({
  t_start: z.number().min(0),
  t_end:   z.number().min(0),
  visual_event: z.string().max(200),
  audio_event:  z.string().max(200),
  scene_boundary_reason: z.string().max(300).optional(),
  is_hook_zone: z.boolean().optional(),
  idx: z.number().int().min(0).optional(),
});
export type SegmentGrid = z.infer<typeof SegmentSchema>;
```

### `src/lib/engine/qwen/omni-analysis.ts` — Extend `buildSystemPrompt`

**Pattern:** Append to the existing string return (line 122 `return` statement). Do NOT change `analyzeVideoWithOmni` — only `buildSystemPrompt`. Append the segments[] JSON instruction block from RESEARCH.md §Pattern 2 after the last current rule. `OmniAnalysisOutput` interface extends with `segments?: SegmentGrid[]`.

### `src/lib/engine/wave3.ts` — Wire Pass 2 trigger

**Pattern:** After `aggregatePersonaResults()` call (line 264), trigger Pass 2:
```typescript
// After Pass 1 aggregate (line 264 in wave3.ts):
// Pass 2 fires after Pass 1 completes — sequential, not concurrent with Pass 1.
// Pipeline.ts wires filmstrip at wave_0_complete; Pass 2 fires here at wave_3_pass1_complete.
```
No structural changes to existing orchestration. Pass 2 call is added in `pipeline.ts`, not directly in wave3.ts (per architecture diagram in RESEARCH.md).

### `src/lib/engine/anti-virality.ts` — Dual-trigger

**Pattern:** Additive exports only. Existing `isAntiViralityGated(confidence: number)` signature MUST remain unchanged (aggregator.ts line 31 imports it with 1 arg). Add new functions:
```typescript
// Add after existing isAntiViralityGated (line 35):
export function isTimelinePatternTriggered(heatmap: HeatmapPayload | null): boolean {
  if (!heatmap) return false;
  // D-17: ≥40% attention loss first 5s AND ≥70% persona consensus
}

// New overload for dual-trigger (D-17); old signature preserved for backward compat:
export function isAntiViralityGatedFull(
  confidence: number,
  heatmap: HeatmapPayload | null,
): { gated: boolean; reason: 'confidence' | 'timeline_pattern' | 'both' | null } {
  const confidenceGated = isAntiViralityGated(confidence);
  const timelineGated   = isTimelinePatternTriggered(heatmap);
  // ...
}
```

### `src/lib/engine/stage10-critique.ts` — Model swap

**Pattern:** Single change at line 6 (import) and line 70 (model constant) + add thinking-mode params:
```typescript
// Line 6: change import
import { getQwenClient, QWEN_REASONING_MODEL } from "./qwen/client";  // was QWEN_FAST_MODEL

// Line 70 area: change model + add thinking params
const response = await ai.chat.completions.create(
  {
    model: QWEN_REASONING_MODEL,  // D-21: upgraded from QWEN_FAST_MODEL
    messages: [...],
    response_format: { type: "json_object" },
    // @ts-expect-error — DashScope extension
    enable_thinking: true,
    // @ts-expect-error
    thinking_budget: 4000,  // shorter than Pass 2 (critique is less complex)
  } as never,
  { signal: controller.signal },
);
```

Also update pricing constants at lines 18–20 to use qwen3.6-plus rates (or switch to `calculateCost(QWEN_REASONING_MODEL, usage)`).

### `src/lib/engine/events.ts` — Add new event variants

**Pattern:** Extend the `StageEvent` discriminated union (line 8) additively:
```typescript
export type StageEvent =
  | { type: "stage_start"; stage: string; wave: StageEventWave; timestamp_ms: number }
  | { type: "stage_end"; stage: string; wave: StageEventWave; duration_ms: number; cost_cents: number; ok: boolean; warning?: string }
  | { type: "pipeline_warning"; message: string; stage?: string }
  // NEW — Phase 3 additive:
  | { type: "filmstrip_segment_ready"; segment_idx: number; keyframe_uri: string }
  | { type: "pass2_persona_start"; persona_id: string; archetype: string }
  | { type: "pass2_persona_end"; persona_id: string; archetype: string; latency_ms: number; cost_cents: number; ok: boolean };
```

### `src/lib/engine/types.ts` — Add new fields

**Pattern:** Additive optional fields on `PredictionResult` (existing fields untouched). Find `PredictionResult` interface and append:
```typescript
// Phase 3 additions — all optional, backward-compatible:
weighted_completion_pct?: number | null;
weighted_top_dropoff_t?: number | null;
weighted_hook_score?: number | null;
heatmap?: HeatmapPayload | null;
```

Add `HeatmapPayload` interface and `SegmentGrid` type (can re-export from qwen/schemas.ts if defined there, or define here as source of truth per STRUCTURE.md convention).

### `src/lib/engine/aggregator.ts` — Wire weighted fields

**Pattern:** After existing `isAntiViralityGated` call (line 31 import area), add `isAntiViralityGatedFull` import. In the assembly block, add `weighted_*` fields and `heatmap` from `Wave3Pass2Outcome` (passed in from pipeline.ts). SCORE_WEIGHTS and existing fields untouched.

### `src/lib/engine/pipeline.ts` — Wire Pass 2 + filmstrip trigger

**Pattern:** After `runWave3()` call (line 37 import area), import and call:
1. `triggerFilmstripGeneration(analysisId, segments, videoUrl)` — fire-and-forget at `wave_0_complete`
2. `runWave3Pass2(segments, keyframeUris, wave3.results, onEvent)` — after Pass 1 completes
3. Pass `pass2Outcome` to aggregator

---

## Shared Patterns

### Thinking-mode API call (apply to: `pass2.ts`, `stage10-critique.ts`)
**Source:** RESEARCH.md §Standard Stack (DashScope API Parameters, verified)
```typescript
// ANTI-PATTERN: Do NOT use reasoning_effort — it does NOT exist for Qwen models
// CORRECT pattern:
const response = await ai.chat.completions.create(
  {
    model: QWEN_REASONING_MODEL,
    messages: [...],
    response_format: { type: "json_object" },
    // @ts-expect-error — DashScope extension, not in OpenAI types
    enable_thinking: true,
    // @ts-expect-error
    thinking_budget: 8000,  // Pass 2; use 4000 for Stage10
  } as never,
  { signal: controller.signal },
);
```

### Graceful degradation / never-throw (apply to: all new engine modules)
**Source:** `src/lib/engine/wave3.ts` (entire module contract)
- Every async function catches its own errors and returns `null` + warning
- Pass 2 below threshold → heatmap = null, `signal_availability.pass2_timeline = false`
- Filmstrip failure → `keyframe_uri = null`; SSE event never fires for that segment
- Anti-virality dual-trigger with null heatmap → confidence-only gate fires, timeline gate skips

### Structured logger pattern (apply to: all new engine modules)
**Source:** `src/lib/engine/wave3.ts` lines 23, `src/lib/engine/qwen/omni-analysis.ts` line 21
```typescript
import { createLogger } from "@/lib/logger";
const log = createLogger({ module: "engine.<module-name>" });
// Usage: log.info("message", { key: value }); log.error("msg", { error: err.message });
```

### Cost rollup via `calculateCost` (apply to: `pass2.ts`)
**Source:** `src/lib/engine/qwen/cost.ts` (qwen3.6-plus already priced)
```typescript
import { calculateCost } from "../qwen/cost";
// Usage (replace inline price math from wave3.ts):
const callCostCents = calculateCost(QWEN_REASONING_MODEL, response.usage ?? undefined);
```
Note: `calculateCost` does NOT handle cache-hit/cache-miss breakdown — for cache-aware telemetry copy the inline `cacheHit * CACHE_HIT_PRICE + cacheMiss * CACHE_MISS_PRICE` pattern from wave3.ts lines 174–182.

### Retry-once pattern (apply to: `pass2.ts`, mirrors wave3.ts)
**Source:** `src/lib/engine/wave3.ts` lines 148–243
- `while (attempt <= 1)` — max 2 total attempts
- Retry ONLY if `isValidation` (Zod parse failure); never on AbortError; never on second attempt
- `callCostAccum` accumulates across both attempts (not overwritten on retry)
- Sentry capture on terminal failure with `tags: { stage, archetype, slot_type }`

### emitStageStart / emitStageEnd (apply to: all new orchestrators)
**Source:** `src/lib/engine/events.ts` lines 19–49
```typescript
const stageStart = emitStageStart(onEvent, "wave_3_pass2", 3);  // wave=3
// ... work ...
emitStageEnd(onEvent, "wave_3_pass2", 3, stageStart, {
  cost_cents: +totalCostCents.toFixed(4),
  ok: aggregate !== null,
  warning: aggregate === null ? "wave_3_pass2_below_threshold" : undefined,
});
```

### Test mock infrastructure (apply to: `pass2.test.ts`, `filmstrip.test.ts`)
**Source:** `src/lib/engine/__tests__/wave3.test.ts` lines 27–62
```typescript
vi.mock("@/lib/logger", ...); vi.mock("@sentry/nextjs", ...);
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));
vi.mock("openai", () => { ... });
process.env.DASHSCOPE_API_KEY = "test-key";
// Import module AFTER mocks are set up
import { runWave3Pass2 } from "../wave3/pass2";
```

### Supabase service-role client usage (apply to: `filmstrip/storage.ts`)
**Source:** `src/lib/supabase/service.ts`
```typescript
// NEVER create a client directly in filmstrip modules.
// ALWAYS import and call createServiceClient() at call time (not module-level singleton).
const supabase = createServiceClient();
```

---

## No Analog Found

All files have analogs or are self-modifications. No files require RESEARCH.md-only patterns.

| File | Reason |
|------|--------|
| `src/lib/engine/filmstrip/extract.ts` (core logic) | ffmpeg subprocess pattern has no existing codebase analog; use RESEARCH.md §Code Examples for ffmpeg-static spawn shape |

---

## Metadata

**Analog search scope:** `src/lib/engine/`, `src/lib/supabase/`, `src/app/api/`, `supabase/migrations/`, `src/lib/engine/__tests__/`
**Files scanned:** 18 source files + 5 migrations
**Analog search stopped at:** 5 strong matches (wave3.ts, aggregator.ts, persona-prompts.ts, anti-virality.ts, wave3.test.ts) — all subsequent files are variants or self-modifications
**Pattern extraction date:** 2026-05-26
