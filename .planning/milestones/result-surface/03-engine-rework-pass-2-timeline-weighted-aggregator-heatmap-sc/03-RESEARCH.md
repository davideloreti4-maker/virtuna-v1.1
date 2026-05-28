# Phase 3: Engine Rework — Pass 2 Timeline + Weighted Aggregator + Heatmap Schema + Filmstrip - Research

**Researched:** 2026-05-26
**Domain:** Prediction engine extension — DashScope thinking-mode, ffmpeg filmstrip, Supabase Storage, anti-virality dual-trigger, schema evolution
**Confidence:** HIGH (engine code verified), MEDIUM (external API behavior), LOW (threshold calibration without outcomes corpus)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Pass 1 / Pass 2 split (Area 1):**
- D-01: Two-pass architecture, both passes ship. Pass 1 keeps its role (fast verdict, intent metrics, behavioral aggregate, anti-virality confidence input). Pass 2 layers on top per-segment attention timeline + reasoning at inflection points. Pass 2 does NOT replace Pass 1.
- D-02: Pass 2 model = `qwen3.6-plus` with thinking-mode enabled. Already wired as `QWEN_REASONING_MODEL`. Enable thinking via DashScope `extra_body` param.
- D-03: Pass 2 input shape = Wave 0 segments (text) + per-segment keyframe images + Pass 1 persona verdict + persona archetype.
- D-04: Pass 2 prompt enrichment — inject creator demographic context + time-of-day scrolling-state grounding.
- D-05: Pass 2 output schema locked (persona_id, segment_reactions[], pass2_latency_ms, pass2_cost_cents).
- D-06: Pass 2 quality guards. Output validation: attention in [0,1], segment count match, monotonic-ish near swipe boundaries. Below 7/10 → heatmap null, fallback to Pass 1.

**Segment grid + filmstrip (Area 2):**
- D-07: Hybrid segment grid (scene-boundary primary, fixed-bucket fallback). Wave 0 omni prompt extended to emit `segments[]`.
- D-08: Min cell width = 1s; merge sub-1s scene cuts at server-side normalization.
- D-09: Filmstrip = ffmpeg server-side at segment t_start. Background worker. Researcher picks hosting strategy.
- D-10: Storage: Supabase Storage bucket `filmstrips/<analysis_id>/<segment_idx>.jpg`. 30-day signed URLs. Cleanup via pg_cron.
- D-11: Timing: background, non-blocking, parallel with Wave 3. SSE event `filmstrip_segment_ready` fills entries in.

**Aggregator + canonical weighted fields (Area 4):**
- D-12: Additive integration. Pass 1 `persona_behavioral_aggregate.completion_pct` untouched. New top-level: `weighted_completion_pct`, `weighted_top_dropoff_t`, `weighted_hook_score`, `heatmap`.
- D-13: HeatmapPayload schema locked (segments[], personas[], weighted_curve[], weights{}, weights_source).
- D-14: Headline metrics source policy — Pass 2 for retention/heatmap, Pass 1 for intent signals.
- D-15: Streaming partials extension — `partial.personas[i]` gets pass2_status, attentions, swipe_predicted_at.

**Anti-virality + outcomes schema (Area 3):**
- D-16: Confidence threshold STAYS at 0.4. Cannot recalibrate without outcomes corpus.
- D-17: NEW dual-trigger — timeline-pattern trigger (≥40% attention loss first 5s + ≥70% persona consensus). OR'd with confidence gate.
- D-18: Outcomes table schema locked. Migration ships in Phase 3, ingestion in M2-III.

**Persona allocation + Qwen model audit (Area 5):**
- D-19: Persona allocation no change (6 FYP + 2 niche_deep + 1 loyalist + 1 cross_niche). Read-only.
- D-20: Persona weight override schema (engine config types only, no UI).
- D-21: Stage10 upgraded: qwen3.6-flash → qwen3.6-plus thinking-mode.
- D-22: Qwen model audit — no other model changes in Phase 3.

**Telemetry + observability (Area 1 / NF4):**
- D-23: Pass 2 telemetry — per-persona structured log + Sentry: pass2_latency_ms, pass2_cost_cents, pass2_validation_failures, pass2_success_count, pass2_aggregate_built.
- D-24: Cost ceiling: flag if any single analysis exceeds $0.50.

### Claude's Discretion

- **ffmpeg hosting strategy** — Vercel serverless vs Supabase Edge Function (ffmpeg-wasm) vs background queue table + pg_cron. Researcher picks.
- **Timeline-pattern threshold values** (D-17) — ≥40%/≥70% defaults; validate against corpus (false-positive rate < 10%).
- **Wave 0 omni prompt extension format** (D-07) — exact JSON shape for segments[], scene_boundary_reason field.
- **Pass 2 keyframe-injection format** (D-03) — all keyframes in one multimodal message vs segment text descriptions.
- **Outcomes table indexing strategy** (D-18) — beyond analysis_id; decide on posted_at or (creator_id, posted_at).
- **`reasoning_effort` / thinking_budget for qwen3.6-plus** — no reasoning_effort param confirmed; use thinking_budget instead.
- **Anti-virality fix-extraction** (D-17 timeline-triggered case) — top-3 fixes anchored to segments via worst weighted_curve dip + Stage11 counterfactuals mapped to timestamps.

### Deferred Ideas (OUT OF SCOPE)

- Real outcome-data-driven anti-virality recalibration (M2-III)
- Demographic stratification axis in selectPersonaSlots (M3)
- Tribe v2 frozen-encoder grounding (M3)
- Audio-as-multimodal in Pass 2
- Per-creator weight override UI (Workspace milestone)
- Filmstrip lazy on-demand fetching
- Allocation rebalance
- Pass 2 + Pass 1 unification
- Time-bucket-only segment grid
- Multi-window anti-virality ranking
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| R2 | Audience Engine — time-resolved per-persona prediction, weighted aggregator, heatmap schema | Pass 2 architecture (§Architecture Patterns), HeatmapPayload schema (§Standard Stack), weighted aggregator (§Patterns) |
| R2.2 | Pass 2 dedicated per-persona timeline call, thinking-mode, <8s p95 for 10 personas parallel | DashScope thinking-mode API (§Code Examples), 10-parallel Promise.allSettled pattern (§Architecture Patterns) |
| R2.3 | Weighted aggregator with persona_weights config, future-proofed override schema | PersonaWeightConfig schema (§Standard Stack), precedence resolver pattern (§Architecture Patterns) |
| R2.4 | Anti-virality recalibration — timeline-pattern trigger D-17, top-3 fixes anchored to segments | Anti-virality dual-trigger (§Architecture Patterns), Stage11 counterfactual mapper (§Code Examples) |
| R2.5 | HeatmapPayload schema in PredictionResult | HeatmapPayload locked schema (§Standard Stack), Zod extension (§Code Examples) |
| R2.6 | Filmstrip pipeline — ffmpeg keyframe extraction, Supabase Storage, signed URLs, 30-day retention | Filmstrip hosting decision (§Architecture Patterns), Supabase Storage pattern (§Code Examples) |
| R1.9 | Anti-virality cross-group state — dual-trigger must propagate | isAntiViralityGated OR expansion (§Code Examples) |
| NF4 | Pass 2 telemetry — latency p50/p95, output token count, validation pass rate | Sentry + structured logger instrumentation (§Architecture Patterns) |
</phase_requirements>

---

## Summary

Phase 3 is a backend-only engine extension with 7 distinct sub-domains: (1) DashScope thinking-mode API for Pass 2, (2) Wave 0 segment schema extension, (3) filmstrip generation and hosting, (4) weighted aggregator design, (5) anti-virality dual-trigger logic, (6) outcomes table migration, and (7) telemetry instrumentation. All are well-supported by existing codebase patterns.

The critical finding is the **ffmpeg hosting decision**: Vercel serverless functions have a documented, unresolved binary path issue with `ffmpeg-static` in Next.js. The confirmed workaround uses a **`pending_filmstrip` queue table + Supabase Edge Function** as background processor — or alternatively, a new dedicated Vercel API route with explicit `next.config.ts` binary declaration (using the `vercel-labs/ffmpeg-on-vercel` pattern). The Supabase Edge Function + ffmpeg-wasm route is theoretically viable but performance for frame extraction is unproven at volume.

The DashScope thinking-mode API confirmation is critical: **qwen3.6-plus uses `enable_thinking: true` (not `reasoning_effort`)** passed via `extra_body`. No `reasoning_effort` parameter exists for Qwen models — use `thinking_budget` to cap token spend. The model IS vision-capable (MMMU 86.0%) and supports `image_url` inputs via the standard OpenAI content array format.

The existing codebase provides excellent scaffolding: `wave3.ts` orchestration pattern (10-parallel, circuit-breaker, ≥7/10 threshold), `emitStageStart/End` telemetry helpers, `calculateCost(model, usage)` already priced for qwen3.6-plus, and the `niche_post_windows` migration as the exact pg_cron + SECURITY DEFINER function template to follow for filmstrip cleanup.

**Primary recommendation:** Use a `pending_filmstrip` queue table + background API route (triggered via fire-and-forget fetch from pipeline.ts at wave_0_complete) as the filmstrip hosting strategy. Avoids ffmpeg-static's `__dirname` resolution bug in Next.js, fits within existing Vercel patterns, and keeps filmstrip outside the 60s engine SLA.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pass 2 per-persona thinking calls | API / Backend | — | 10 parallel LLM calls; server-side only; never in browser |
| Weighted aggregator computation | API / Backend | — | Pure TS math on Pass 2 outputs; runs in pipeline aggregator |
| Filmstrip ffmpeg extraction | API / Backend | Database (queue) | Server-side binary execution; background-queued to avoid SLA impact |
| Filmstrip storage + signed URL minting | Database / Storage | API / Backend | Supabase Storage owns persistence; API mints URLs |
| `HeatmapPayload` schema | API / Backend | — | PredictionResult extension; engine owns the schema |
| Anti-virality dual-trigger | API / Backend | — | Confidence + timeline gate logic in `anti-virality.ts` |
| Streaming partial.personas[].attentions[] | API / Backend | Browser/Client | SSE forwarder in stream/route.ts; client hook reads |
| Outcomes table schema | Database / Storage | — | Pure migration; no ingestion in Phase 3 |
| Pass 2 telemetry | API / Backend | — | Sentry + structured logger; same tier as existing engine telemetry |
| Stage10 model swap | API / Backend | — | Single model constant change + thinking-mode params |

---

## Standard Stack

### Core (verified in codebase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| openai (SDK) | 6.22.0 | DashScope API calls via compatible-mode endpoint | Already wired; `getQwenClient()` singleton reused |
| zod | 4.3.6 | Schema validation for Pass 2 output | Existing pattern across all wave outputs |
| @sentry/nextjs | 10.39.0 | Error tracking + per-persona telemetry | Existing instrumentation — just add new breadcrumbs |
| @supabase/supabase-js | 2.93.1 | Storage bucket upload + createSignedUrl | Service-role client already in `src/lib/supabase/service.ts` |
| vitest | 4.0.18 | Unit tests for new modules | Existing test runner; 80% coverage threshold on engine code |

### Supporting (for new capabilities)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ffmpeg-static | 5.3.0 (latest) | Bundled ffmpeg binary for keyframe extraction | Filmstrip generation — conditional on hosting strategy chosen below |
| child_process (Node built-in) | N/A | Spawn ffmpeg subprocess | Used alongside ffmpeg-static |

### DashScope API Parameters (VERIFIED via official docs)

**Thinking-mode activation for qwen3.6-plus (OpenAI-compatible SDK):**

```typescript
// In Node.js SDK: non-standard params passed as top-level (NOT extra_body)
const response = await ai.chat.completions.create({
  model: QWEN_REASONING_MODEL,  // "qwen3.6-plus"
  messages: [...],
  response_format: { type: "json_object" },
  // @ts-expect-error — DashScope extension, not in OpenAI types
  enable_thinking: true,
  // @ts-expect-error
  thinking_budget: 8000,  // max thinking tokens; omit for uncapped
} as never, { signal: controller.signal });
```

**Key finding:** There is NO `reasoning_effort` parameter for Qwen models. DashScope uses `enable_thinking` + optional `thinking_budget`. The CONTEXT.md reference to `reasoning_effort` is incorrect for this model family.

### qwen3.6-plus Vision Capability (VERIFIED via search + MMMU score)

qwen3.6-plus supports image inputs via the standard OpenAI `image_url` content type. MMMU score = 86.0 (strong multimodal). Format:

```typescript
{
  role: "user",
  content: [
    { type: "image_url", image_url: { url: "https://signed-supabase-url/frame.jpg" } },
    { type: "text", text: "Analyze this frame..." }
  ]
}
```

Multiple images supported (token limit constrains count). For 10 segments × 10 personas = 100 image tokens; cost is manageable within "cost-not-a-concern" budget.

### Filmstrip Hosting Decision (DISCRETION RESOLVED)

**Recommendation: Background queue table + Vercel API route with ffmpeg-static**

Rationale:
1. `ffmpeg-static` v5.3.0 has a **known, unresolved `__dirname` resolution bug** in Next.js serverless functions (GitHub issue #53791, unresolved). Cannot be used directly in `/api/analyze/[id]/stream/route.ts`.
2. **Workaround (vercel-labs/ffmpeg-on-vercel pattern):** Create a **dedicated filmstrip API route** (`src/app/api/filmstrip/extract/route.ts`) with explicit binary declaration in `next.config.ts`, configured at 3009 MB memory (matches analyze route). This isolates the binary path issue to one route with explicit config.
3. Pipeline fires a **fire-and-forget `fetch`** to this route at `wave_0_complete` — no await, no SLA impact.
4. Alternative (Supabase Edge Function + ffmpeg-wasm): Viable but ffmpeg-wasm performance for frame extraction is unproven at volume. Adds Deno deployment complexity. Not recommended unless Vercel route fails in production testing.
5. **Supabase Edge Function fallback:** Keep as Plan B. If Vercel route proves flaky, migrate extraction logic to an Edge Function that reads the signed video URL and calls ffmpeg-wasm.

**`next.config.ts` addition required:**
```typescript
experimental: {
  serverComponentsExternalPackages: ['ffmpeg-static']
}
```

### Supabase Storage: createSignedUrl Pattern (VERIFIED via codebase + docs)

```typescript
// Using existing service-role client (src/lib/supabase/service.ts)
const supabase = createServiceClient();
const { data, error } = await supabase.storage
  .from('filmstrips')
  .createSignedUrl(`${analysisId}/${segmentIdx}.jpg`, 60 * 60 * 24 * 30); // 30 days in seconds
// data.signedUrl — renderable as <img src> without auth headers
```

Max TTL: not explicitly documented, but 30-day (2,592,000s) is a common production pattern with no known limit below that value. [ASSUMED: no hard cap below 30 days]

### pg_cron Filmstrip Cleanup (VERIFIED pattern from niche_post_windows migration)

```sql
-- Mirror pattern from 20260524000000_niche_post_windows.sql
CREATE OR REPLACE FUNCTION cleanup_expired_filmstrips()
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
BEGIN
  -- Delete storage.objects rows for filmstrips older than 30 days
  -- Note: direct DELETE on storage.objects works for service-role;
  -- for API-level delete, use pg_net extension to call storage API
  DELETE FROM storage.objects
  WHERE bucket_id = 'filmstrips'
    AND created_at < NOW() - INTERVAL '30 days';
END;
$$;

SELECT cron.schedule(
  'cleanup-expired-filmstrips',
  '0 3 * * *',  -- 03:00 UTC daily
  $$SELECT cleanup_expired_filmstrips()$$
);
```

**Note:** Direct `DELETE FROM storage.objects` is the recommended pattern (confirmed by supa-file-helper community tooling). Requires pg_cron + SECURITY DEFINER to bypass RLS. [VERIFIED: matches existing codebase convention in niche_post_windows migration]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Background queue table | Supabase Edge Function + ffmpeg-wasm | Edge Function has no proven ffmpeg-wasm perf at scale; adds Deno deployment complexity |
| pg_cron cleanup | Vercel cron `/api/cron/delete-filmstrips` | pg_cron stays close to data; existing precedent; preferred |
| image_url injection in Pass 2 | Segment text descriptions only | Image injection gives true visual grounding; qwen3.6-plus supports it; cost justified |

---

## Architecture Patterns

### System Architecture Diagram

```
Wave 0 (omni-analysis.ts)
    │
    ├─► segments[] emitted (hybrid scene-boundary / fixed-bucket fallback)
    │       │
    │       ├─► [fire-and-forget] filmstrip extraction route
    │       │       │  ffmpeg: signed_video_url → JPEG per t_start
    │       │       │  Supabase Storage upload: filmstrips/<id>/<idx>.jpg
    │       │       └─► createSignedUrl(30d) → SSE: filmstrip_segment_ready{idx, uri}
    │       │
    │       └─► [continues] Wave 3 Pass 1 (parallel)
    │
Wave 3 Pass 1 (wave3.ts — unchanged)
    │  10× qwen3.6-flash parallel
    │  → PersonaSimulationResult[] (verdict, intent metrics)
    │
    └─► Wave 3 Pass 2 (wave3/pass2.ts — NEW)
            │  10× qwen3.6-plus + enable_thinking=true parallel
            │  Input: segments[] + keyframe images + Pass 1 verdict + archetype
            │  Output: per-persona segment_reactions[] (attention 0-1, reason at inflection)
            │
            ├─► Quality guards (D-06)
            │       ≥7/10 success → weighted-aggregator.ts
            │       <7/10 → heatmap null, signal_availability.pass2_timeline = false
            │
            └─► weighted-aggregator.ts (NEW)
                    │  persona_weights precedence: analysis > creator > niche > default
                    │  → weighted_curve[], weighted_completion_pct, weighted_top_dropoff_t
                    │  → weighted_hook_score (0-3s window mean)
                    │  → HeatmapPayload assembly
                    │
                    └─► aggregator.ts (extension)
                            → PredictionResult + weighted_* fields + heatmap field

Stage 10 (stage10-critique.ts — model swap)
    qwen3.6-flash → qwen3.6-plus + enable_thinking=true
    → tighter confidence calibration
    → anti-virality confidence input improves

Anti-virality (anti-virality.ts — extended)
    confidence < 0.4 (existing)
    OR timeline_pattern_triggered (NEW: D-17)
    → anti_virality_gated boolean
    → dropoff_segment_indices[] (for Phase 5 visual treatment)
```

### Recommended Project Structure (new files only)

```
src/lib/engine/
├── wave3/
│   ├── pass2.ts                    # NEW: Pass 2 orchestrator (mirrors wave3.ts structure)
│   ├── persona-prompts-pass2.ts    # NEW: Pass 2 prompt builders (D-04 enrichment)
│   └── weighted-aggregator.ts      # NEW: Pass 2 → weighted curve + HeatmapPayload
├── filmstrip/
│   ├── extract.ts                  # NEW: ffmpeg keyframe extraction helper
│   ├── storage.ts                  # NEW: Supabase Storage upload + signed URL minting
│   └── queue.ts                    # NEW: background-trigger fire-and-forget entry point
├── persona-weights.ts              # NEW: PersonaWeightConfig precedence resolver (D-20)
└── __tests__/
    ├── pass2.test.ts               # NEW
    ├── weighted-aggregator.test.ts # NEW
    ├── filmstrip.test.ts           # NEW
    └── persona-weights.test.ts     # NEW

src/app/api/filmstrip/extract/
└── route.ts                        # NEW: dedicated Vercel route for ffmpeg (isolated binary)

supabase/migrations/
└── <ts>_outcomes_table.sql         # NEW: D-18 schema
```

### Pattern 1: Pass 2 Orchestrator (mirrors wave3.ts)

```typescript
// Source: verified from src/lib/engine/wave3.ts (existing)
// Pass 2 mirrors the exact same orchestration contract

const SUCCESS_THRESHOLD = 7;
const PER_CALL_TIMEOUT_MS = 60_000; // thinking-mode is slower than flash

export async function runWave3Pass2(
  segments: SegmentGrid[],
  keyframeUris: (string | null)[],   // signed URLs from filmstrip (null = not ready yet)
  pass1Results: PersonaSimulationResult[],
  onEvent?: StageEventCallback,
): Promise<Wave3Pass2Outcome> {
  const stageStart = emitStageStart(onEvent, "wave_3_pass2", 3);

  const callPersona = async (slot: PersonaSlot, pass1: PersonaSimulationResult) => {
    const ai = getQwenClient();
    const response = await ai.chat.completions.create({
      model: QWEN_REASONING_MODEL,  // qwen3.6-plus
      messages: buildPass2Messages(slot, segments, keyframeUris, pass1),
      response_format: { type: "json_object" },
      // @ts-expect-error DashScope extension
      enable_thinking: true,
      // @ts-expect-error
      thinking_budget: 8000,
    } as never, { signal: controller.signal });
    // ... validate + return
  };

  const settledResults = await Promise.allSettled(slots.map((slot, i) =>
    callPersona(slot, pass1Results[i]!)
  ));
  // ... same threshold logic as wave3.ts
}
```

### Pattern 2: Wave 0 Segment Schema Extension

```typescript
// Extend OmniAnalysisZodSchema in src/lib/engine/qwen/schemas.ts
export const SegmentSchema = z.object({
  t_start: z.number().min(0),
  t_end:   z.number().min(0),
  visual_event: z.string().max(200),
  audio_event:  z.string().max(200),
  scene_boundary_reason: z.string().max(300).optional(),
  is_hook_zone: z.boolean().optional(), // server normalizer sets this
});

// Server-side normalizer (in pass2.ts or dedicated normalizer):
function normalizeSegments(raw: z.infer<typeof SegmentSchema>[]): SegmentGrid[] {
  // Merge sub-1s segments
  // Ensure hook zone (0-3s) always its own segment
  // Fallback to 2s fixed buckets if <4 boundaries
}
```

**Prompt extension to Wave 0 system prompt** (append to existing `buildSystemPrompt`):

```
"segments": [
  {
    "t_start": 0.0,
    "t_end": 2.8,
    "visual_event": "<brief description of dominant visual change>",
    "audio_event": "<brief description of dominant audio/speech change>",
    "scene_boundary_reason": "<why this is a scene boundary, optional>"
  }
]

Rules for segments:
- Detect natural scene boundaries (cut, transition, topic shift, pacing change).
- Hook zone 0-3s MUST be its own segment even if no boundary detected.
- Minimum segment duration: 1s (merge shorter cuts into adjacent segment).
- If fewer than 4 boundaries detected: return 2s fixed buckets (1s for <8s videos).
- Sort by t_start ascending. No overlap. t_end of segment[i] = t_start of segment[i+1].
```

### Pattern 3: Weighted Aggregator

```typescript
// src/lib/engine/wave3/weighted-aggregator.ts
export const DEFAULT_WEIGHTS: PersonaWeights = {
  fyp: 0.65, niche: 0.20, loyalist: 0.10, cross_niche: 0.05
};

export function buildWeightedCurve(
  pass2Results: Pass2PersonaResult[],
  segments: SegmentGrid[],
  weights: PersonaWeights,
): { weighted_curve: number[]; weighted_completion_pct: number; weighted_top_dropoff_t: number; weighted_hook_score: number } {
  // For each segment: sum(attention[i] * weight[persona.type]) / sum(weights)
  // hook_score = mean of segments where is_hook_zone = true
  // top_dropoff_t = t_start of segment with largest drop in weighted_curve
}
```

### Pattern 4: Anti-virality Dual-Trigger (D-17)

```typescript
// src/lib/engine/anti-virality.ts — additive extension
export function isTimelinePatternTriggered(heatmap: HeatmapPayload | null): boolean {
  if (!heatmap) return false;
  const firstFiveSecondsCurve = heatmap.weighted_curve.filter(
    (_, i) => heatmap.segments[i]!.t_end <= 5
  );
  if (firstFiveSecondsCurve.length < 2) return false;
  const attentionLoss = firstFiveSecondsCurve[0]! - firstFiveSecondsCurve[firstFiveSecondsCurve.length - 1]!;
  const personaConsensus = heatmap.personas.filter(p =>
    p.attentions[0]! - (p.attentions[firstFiveSecondsCurve.length - 1] ?? p.attentions[0]!) >= 0.40
  ).length / heatmap.personas.length;
  return attentionLoss >= 0.40 && personaConsensus >= 0.70;
}

export function isAntiViralityGated(confidence: number, heatmap: HeatmapPayload | null): boolean {
  return confidence < ANTI_VIRALITY_THRESHOLD || isTimelinePatternTriggered(heatmap);
}
```

**Anti-virality fix extraction for D-17 timeline-triggered case:**

Stage11 counterfactuals output already includes `timestamp_ms` anchoring per suggestion. When `isTimelinePatternTriggered` fires, map the 3 worst `weighted_curve` dips to segment indices, then filter Stage11 suggestions whose `timestamp_ms` falls within those segments. If no Stage11 suggestions anchor to the dropoff segments, fall back to generating top-3 from segment visual_event labels + attention delta. This mapper lives in `weighted-aggregator.ts` and returns `dropoff_segment_indices: number[]` alongside the heatmap payload.

### Pattern 5: Persona Weight Override (D-20)

```typescript
// src/lib/engine/persona-weights.ts
export function resolveWeights(config: PersonaWeightConfig, context: {
  analysis_override?: PersonaWeights;
  creator_id?: string;
  niche?: string;
}): { weights: PersonaWeights; source: HeatmapPayload['weights_source'] } {
  if (context.analysis_override) return { weights: normalize(context.analysis_override), source: 'analysis_override' };
  if (context.creator_id && config.creator_overrides?.[context.creator_id])
    return { weights: normalize(config.creator_overrides[context.creator_id]!), source: 'creator_override' };
  if (context.niche && config.niche_overrides?.[context.niche])
    return { weights: normalize(config.niche_overrides[context.niche]!), source: 'niche_override' };
  return { weights: config.default, source: 'default' };
}
// normalize: scale values so sum = 1.0 ± 0.01
```

### Anti-Patterns to Avoid

- **Mutating Pass 1 aggregator**: Pass 1's `aggregatePersonaResults` in `wave3/aggregator.ts` MUST remain unchanged. Pass 2 aggregation is a sibling module.
- **Blocking pipeline on filmstrip**: The `filmstrip/queue.ts` fire-and-forget `fetch` must NOT be awaited. Use `void fetch(...)` or `.catch(log.error)`.
- **`reasoning_effort` param on qwen3.6-plus**: This parameter does NOT exist for Qwen models. Use `enable_thinking: true` + optional `thinking_budget`.
- **Registering new env vars**: Pass 2 reuses `QWEN_REASONING_MODEL`. Do not introduce a separate `QWEN_PASS2_MODEL` env var.
- **Importing heavy modules in shared pipeline**: filmstrip extraction (ffmpeg) belongs in the dedicated `/api/filmstrip/extract` route only. Never import into `pipeline.ts`.
- **Missing `@ts-expect-error` on DashScope extensions**: The OpenAI SDK TypeScript types do not include `enable_thinking`. Suppress with `@ts-expect-error` consistently.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ffmpeg binary management | Custom binary downloader or path resolver | `ffmpeg-static` npm package + explicit `next.config.ts` config | ffmpeg-static handles platform-specific binary paths; custom downloaders are fragile |
| JSON schema validation for Pass 2 output | Manual type guards | Zod `safeParse` with `stripModelOutput` + retry-once pattern | Existing wave3.ts pattern; handles partial responses gracefully |
| Storage signed URL logic | Custom JWT signing | `supabase.storage.from().createSignedUrl()` | Signed URLs use dedicated internal key separate from Auth JWTs; cannot replicate safely |
| pg_cron scheduling | Custom TypeScript scheduler | pg_cron in migration SQL + SECURITY DEFINER function | Exact same pattern as `niche_post_windows`; proven in codebase |
| Persona weight normalization | Ad-hoc division | `resolveWeights()` in `persona-weights.ts` with explicit normalize step | Sum-to-1 enforcement critical for weighted_curve correctness; needs unit test |

**Key insight:** The hardest problems here (model calling pattern, storage upload, retry logic, telemetry) all have EXACT patterns already in the codebase. Copy the pattern first, then adapt.

---

## Common Pitfalls

### Pitfall 1: `__dirname` Resolution Failure for ffmpeg-static in Next.js
**What goes wrong:** `ffmpeg-static` resolves the binary path using `__dirname` at import time. In Next.js serverless bundles, `__dirname` points to the bundled `.next` directory, not `node_modules`. The binary is absent. Error: "ENOENT: no such file or directory" at runtime in production.
**Why it happens:** Next.js bundles API routes into serverless functions; `__dirname` semantics change in the bundled context.
**How to avoid:** Use the isolated filmstrip route approach with `serverComponentsExternalPackages: ['ffmpeg-static']` in `next.config.ts` to prevent bundling. The binary then resolves from `node_modules` via the file system at runtime.
**Warning signs:** Works locally, fails on first Vercel deploy with ENOENT on the ffmpeg binary path.

### Pitfall 2: Pass 2 Calling with Thinking on Stage10 Simultaneously
**What goes wrong:** Both Pass 2 (10 parallel) and Stage10 (upgraded to thinking-mode) run. If Stage10 fires before Pass 2 completes, thinking tokens from both can hit DashScope rate limits simultaneously.
**Why it happens:** Stage10 runs AFTER `aggregateScores()` in the pipeline (post-Wave 3). Pass 2 runs during Wave 3. Overlap is minimal but possible.
**How to avoid:** Pass 2 runs parallel with Wave 3 Pass 1; Stage10 runs after aggregation. Pipeline ordering already prevents simultaneous execution. No change needed.
**Warning signs:** DashScope 429 errors on stage10 calls during high-load periods.

### Pitfall 3: Streaming Partials with null keyframe_uri
**What goes wrong:** Phase 4's Audience node subscribes to `partial.personas[i].attentions[]`. If filmstrip hasn't resolved yet when attentions fill in, `heatmap.segments[i].keyframe_uri` is null. Phase 4 must render the curve without images initially.
**Why it happens:** Filmstrip is background/non-blocking; attentions arrive before frames.
**How to avoid:** `keyframe_uri` starts null in the initial heatmap payload. `filmstrip_segment_ready` SSE events fill it in. Phase 4 handles null gracefully (renders placeholder). Document this contract explicitly in HeatmapPayload type.
**Warning signs:** Phase 4 crashes if it assumes keyframe_uri is always populated on first render.

### Pitfall 4: Attention Array Length Mismatch Between Pass 2 Personas
**What goes wrong:** One persona's `segment_reactions.length` doesn't match `segments.length` (model returned fewer/more segments). `weighted_curve[i]` gets undefined when indexing.
**Why it happens:** qwen3.6-plus may hallucinate a different segment count if the prompt doesn't rigidly enforce it.
**How to avoid:** Quality guard in D-06 — validate `segment_reactions.length === segments.length`. Failed guard drops persona from aggregate (doesn't throw). Ensure Pass 2 prompt says: "Return EXACTLY N segment reactions where N = [count]".
**Warning signs:** NaN in weighted_curve; `pass2_validation_failures` counter rising in Sentry.

### Pitfall 5: `thinking_budget` Consuming Excessive Tokens
**What goes wrong:** qwen3.6-plus thinking-mode without `thinking_budget` can use many thinking tokens, spiking cost per persona above D-24 ceiling unexpectedly across 10 parallel calls.
**Why it happens:** Uncapped thinking traces for complex videos can be very long.
**How to avoid:** Set `thinking_budget: 8000` for Pass 2 and `thinking_budget: 4000` for Stage10. Monitor `pass2_cost_cents` per D-23. Flag if single analysis > $0.50.
**Warning signs:** D-24 cost ceiling triggers in structured logger.

### Pitfall 6: Weighted Curve NaN from Empty FYP Slot
**What goes wrong:** Weighted aggregator divides by zero or produces NaN if a persona type (e.g., cross_niche) has no survivors in the Pass 2 results.
**Why it happens:** 10 personas have 6 FYP + 2 niche + 1 loyalist + 1 cross_niche. If the sole cross_niche persona fails, its weight (0.05) still participates in the denominator.
**How to avoid:** Normalize weights over SURVIVING personas only (redistribute missing persona's weight proportionally). Add explicit test: all 10 fail → heatmap null. 9 survive, cross_niche missing → weights redistribute to sum = 1.0.
**Warning signs:** NaN/Infinity in weighted_completion_pct logged by telemetry.

### Pitfall 7: Outcomes Migration Missing Timestamp Index
**What goes wrong:** M2-III feedback queries filter by `posted_at` date range. Without an index, full table scan on growing `outcomes` table.
**Why it happens:** The locked schema (D-18) only includes `outcomes_analysis_id_idx`. M2-III needs temporal queries.
**How to avoid:** Add `(creator_id, posted_at)` composite index in the Phase 3 migration. The analysis is zero-cost now (table empty); it becomes expensive to add retroactively with millions of rows.
**Warning signs:** Slow M2-III analytics queries post-launch.

---

## Code Examples

### DashScope thinking-mode call (Pass 2 persona)

```typescript
// Source: verified pattern — adapts wave3.ts callPersona() to add thinking-mode
// DashScope docs: https://www.alibabacloud.com/help/en/model-studio/deep-thinking

const response = await ai.chat.completions.create(
  {
    model: QWEN_REASONING_MODEL,  // "qwen3.6-plus"
    messages: [
      { role: "system", content: STABLE_PASS2_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          // keyframes injected if available
          ...keyframeUris.map(uri => uri ? {
            type: "image_url" as const,
            image_url: { url: uri }
          } : null).filter(Boolean),
          { type: "text", text: buildPass2UserText(slot, pass1, segments) }
        ]
      }
    ],
    response_format: { type: "json_object" },
    // @ts-expect-error — DashScope extension, not in OpenAI types
    enable_thinking: true,
    // @ts-expect-error
    thinking_budget: 8000,
  } as never,
  { signal: controller.signal }
);
```

### Supabase Storage bucket + RLS migration

```sql
-- Source: mirrors 20260512010000_corpus_videos_storage.sql pattern
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'filmstrips',
  'filmstrips',
  false,                  -- private; signed URLs only
  5242880,                -- 5 MB per frame (JPEGs are tiny)
  ARRAY['image/jpeg']
) ON CONFLICT (id) DO NOTHING;

-- No object-level SELECT policy — only signed URL access (service-role writes)
-- Signed URLs bypass RLS automatically (signed with internal storage key)
```

### pg_cron cleanup job (filmstrip retention)

```sql
-- Source: mirrors 20260524000000_niche_post_windows.sql pg_cron + SECURITY DEFINER pattern
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

### Outcomes table schema (D-18, with indexing decision resolved)

```sql
CREATE TABLE outcomes (
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

-- Obvious PK-adjacent index for join lookups (D-18 locked)
CREATE INDEX outcomes_analysis_id_idx ON outcomes(analysis_id);

-- DISCRETION RESOLVED: Add composite index for M2-III feedback queries
-- (creator_id requires FK via analyses table join — index on posted_at sufficient for range scans)
CREATE INDEX outcomes_posted_at_idx ON outcomes(posted_at)
  WHERE posted_at IS NOT NULL;
-- Phase 3: table is empty so index cost is zero. M2-III will need this for temporal filtering.
```

**Indexing rationale:** `(creator_id, posted_at)` would require a `creator_id` column on `outcomes` or a join-based approach. Since M2-III feedback queries likely filter by `posted_at` date range and join to `analyses` for `creator_id`, a standalone `outcomes_posted_at_idx` covering `posted_at IS NOT NULL` is simpler and sufficient for now.

### Stage10 model swap (D-21)

```typescript
// src/lib/engine/stage10-critique.ts — single change
// Before: model: QWEN_FAST_MODEL
// After:
const response = await ai.chat.completions.create(
  {
    model: QWEN_REASONING_MODEL,  // "qwen3.6-plus" — D-21 upgrade
    messages: [...],
    response_format: { type: "json_object" },
    // @ts-expect-error
    enable_thinking: true,
    // @ts-expect-error
    thinking_budget: 4000,  // critique is shorter than per-persona timeline
  } as never,
  { signal: controller.signal }
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DeepSeek V4 Flash for persona simulation | qwen3.6-flash (Pass 1) + qwen3.6-plus thinking (Pass 2) | Engine Foundation milestone | Pass 2 adds time-resolved attention; thinking traces improve inflection point reasoning |
| Single confidence gate for anti-virality | Dual-trigger: confidence + timeline pattern | Phase 3 (this phase) | Catches hook failures that confidence gate misses (high-score-but-drops-immediately pattern) |
| Flat completion_pct (unweighted mean) | Weighted retention curve (persona audience-share weights) | Phase 3 (this phase) | FYP non-followers dominate correctly at 65%; loyalist over-represented in flat mean |
| No segment-level data from Wave 0 | segments[] with scene boundaries from omni | Phase 3 (this phase) | Enables filmstrip + Pass 2 spatial grounding |

**Deprecated / outdated:**
- `reasoning_effort` param: Not applicable to Qwen models. Use `enable_thinking` + `thinking_budget` instead.
- Gemini Files API for keyframe extraction: Removed in Engine Foundation. Filmstrip now uses ffmpeg server-side.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `thinking_budget: 8000` tokens per persona is sufficient for full 10-segment attention trace | Standard Stack | If too low, thinking truncates and attention quality degrades silently — add validation check |
| A2 | qwen3.6-plus image_url type works identically to qwen3.5's VL models via DashScope compatible endpoint | Standard Stack | If unsupported, fall back to segment text descriptions only (Visual_event from omni) |
| A3 | Supabase createSignedUrl accepts 30-day TTL (2,592,000 seconds) without error | Code Examples | If capped lower, reduce retention period or regenerate URLs on demand |
| A4 | ffmpeg-static + `serverComponentsExternalPackages` workaround resolves `__dirname` issue in production | Architecture Patterns | If still broken, migrate filmstrip to Supabase Edge Function + ffmpeg-wasm (Plan B) |
| A5 | Direct `DELETE FROM storage.objects` in pg_cron SECURITY DEFINER function deletes the underlying files, not just metadata | Code Examples | If only deletes metadata rows (files orphaned in S3), use pg_net + storage API instead |
| A6 | D-17 thresholds (≥40% attention loss in 5s + ≥70% persona consensus) produce <10% false-positive rate | Anti-virality section | No outcomes corpus to validate; thresholds are educated guesses. Recalibrate once M2-III corpus accumulates |
| A7 | Stage10 `thinking_budget: 4000` is sufficient for critique quality | Code Examples | If too low, critique misses consistency flags; increase budget or measure quality delta vs qwen3.6-flash baseline |

---

## Open Questions

1. **keyframe injection fallback path**
   - What we know: qwen3.6-plus supports `image_url` inputs (MMMU 86.0, vision-capable per product spec)
   - What's unclear: Whether DashScope's compatible-mode endpoint supports image_url in the same call as `enable_thinking` without conflict
   - Recommendation: Test in Wave 0 of implementation. If image + thinking combo errors, fall back to omni's `visual_event` text descriptions injected as segment context.

2. **Filmstrip generation timing vs Pass 2 input**
   - What we know: Filmstrip fires at `wave_0_complete` (background); Pass 2 fires after Pass 1 completes (Wave 3, sequential after Wave 2)
   - What's unclear: Will any keyframes be ready before all 10 Pass 2 calls complete? Likely YES for early segments given ~50ms per frame extraction.
   - Recommendation: Pass 2 prompt builder checks which keyframe_uris are populated at call time; passes available ones, falls back to text for missing. Keeps Pass 2 non-blocking.

3. **False-positive rate of D-17 thresholds without corpus**
   - What we know: 40%/70% thresholds set in CONTEXT.md as starting point. `training-data.json` (26MB) contains feature vectors but NOT per-segment attention timelines.
   - What's unclear: Without simulated Pass 2 outputs, we cannot sweep the threshold against training data.
   - Recommendation: In Wave 0 of implementation, run Pass 2 on 10-20 corpus videos from `training_corpus` table; manually review which fire the timeline trigger; adjust thresholds before locking. Document result in implementation notes.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| ffmpeg (local) | Filmstrip extraction dev/test | ✓ | 8.0.1 | — |
| ffmpeg-static (npm) | Filmstrip extraction production | ✓ (npm registry) | 5.3.0 | Supabase Edge Function + ffmpeg-wasm |
| Node.js | All engine code | ✓ | 25.2.1 | — |
| DashScope API (QWEN_REASONING_MODEL) | Pass 2 + Stage10 | ✓ (env var wired) | qwen3.6-plus | — |
| Supabase Storage | Filmstrip persistence | ✓ (existing project) | — | — |
| pg_cron (Supabase) | Filmstrip cleanup | ✓ (existing migrations use it) | — | Vercel cron route |
| Vitest | Unit tests | ✓ | 4.0.18 | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:**
- `ffmpeg-static` in Next.js serverless: Fallback = Supabase Edge Function + ffmpeg-wasm (Plan B, not primary)

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/lib/engine/__tests__/pass2.test.ts` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R2.2 | Pass 2 fires 10 parallel calls with enable_thinking=true | unit | `npx vitest run src/lib/engine/__tests__/pass2.test.ts` | ❌ Wave 0 |
| R2.2 | ≥7/10 threshold → aggregate non-null | unit | `npx vitest run src/lib/engine/__tests__/pass2.test.ts` | ❌ Wave 0 |
| R2.2 | <7/10 → heatmap null, signal_availability.pass2_timeline=false | unit | `npx vitest run src/lib/engine/__tests__/pass2.test.ts` | ❌ Wave 0 |
| R2.3 | Weighted curve = correct weighted mean | unit | `npx vitest run src/lib/engine/__tests__/weighted-aggregator.test.ts` | ❌ Wave 0 |
| R2.3 | Weight normalization: missing persona redistributes correctly | unit | `npx vitest run src/lib/engine/__tests__/weighted-aggregator.test.ts` | ❌ Wave 0 |
| R2.3 | PersonaWeightConfig precedence: analysis > creator > niche > default | unit | `npx vitest run src/lib/engine/__tests__/persona-weights.test.ts` | ❌ Wave 0 |
| R2.4 | isTimelinePatternTriggered fires on ≥40%/≥70% | unit | `npx vitest run src/lib/engine/__tests__/anti-virality.test.ts` | ✅ (extend existing) |
| R2.4 | isTimelinePatternTriggered false on null heatmap | unit | `npx vitest run src/lib/engine/__tests__/anti-virality.test.ts` | ✅ (extend existing) |
| R2.5 | HeatmapPayload schema validates correctly via Zod | unit | `npx vitest run src/lib/engine/__tests__/weighted-aggregator.test.ts` | ❌ Wave 0 |
| R2.6 | Filmstrip signed URLs generated per segment | unit | `npx vitest run src/lib/engine/__tests__/filmstrip.test.ts` | ❌ Wave 0 |
| R2.6 | Filmstrip upload is non-blocking (fire-and-forget) | unit | `npx vitest run src/lib/engine/__tests__/filmstrip.test.ts` | ❌ Wave 0 |
| NF4 | pass2_latency_ms, pass2_cost_cents emitted per persona | unit | `npx vitest run src/lib/engine/__tests__/pass2.test.ts` | ❌ Wave 0 |
| NF4 | Stage10 thinking-mode emits cost telemetry correctly | unit | `npx vitest run src/lib/engine/__tests__/stage10-critique.test.ts` | ✅ (extend existing) |

### Sampling Rate

- **Per task commit:** `npx vitest run src/lib/engine/__tests__/` (engine tests only, ~30s)
- **Per wave merge:** `npx vitest run --coverage`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/lib/engine/__tests__/pass2.test.ts` — covers R2.2 (mirrors wave3.test.ts pattern exactly)
- [ ] `src/lib/engine/__tests__/weighted-aggregator.test.ts` — covers R2.3, R2.5
- [ ] `src/lib/engine/__tests__/filmstrip.test.ts` — covers R2.6 (mock Supabase Storage + ffmpeg)
- [ ] `src/lib/engine/__tests__/persona-weights.test.ts` — covers D-20 precedence resolver
- [ ] Extend `src/lib/engine/__tests__/anti-virality.test.ts` — add isTimelinePatternTriggered tests
- [ ] Extend `src/lib/engine/__tests__/stage10-critique.test.ts` — verify model swap + thinking-mode cost telemetry

*(Existing test infrastructure: wave3.test.ts, aggregator.test.ts, anti-virality.test.ts, stage10-critique.test.ts all exist and provide patterns to follow)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | Supabase Storage bucket: public=false; service-role write only; signed URLs for read |
| V5 Input Validation | yes | Zod schema on Pass 2 output (attention bounds, segment count, swipe_predicted boolean) |
| V6 Cryptography | yes | Supabase signed URLs use dedicated internal key (not Auth JWT) — never hand-roll |
| V7 Error Handling | yes | Pass 2 + filmstrip never throw; graceful degradation per existing engine contract |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Signed URL oversharing | Info Disclosure | 30-day TTL + bucket public=false; no wildcard object policies |
| Prompt injection via segment labels | Tampering | Segment visual_event/audio_event max 200 chars (Zod); passed as context not system trust |
| Cost amplification via malicious video | Elevation of Privilege | D-24 cost ceiling ($0.50 flag); thinking_budget cap prevents unbounded token spend |
| Storage object deletion in cleanup | Denial of Service | SECURITY DEFINER function with explicit search_path; pg_cron job scoped to filmstrips bucket only |

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: codebase] `src/lib/engine/wave3.ts` — existing 10-parallel orchestration pattern to mirror
- [VERIFIED: codebase] `src/lib/engine/qwen/client.ts` — QWEN_REASONING_MODEL constant, getQwenClient singleton
- [VERIFIED: codebase] `src/lib/engine/qwen/cost.ts` — qwen3.6-plus pricing ($0.40/M input, $2.40/M output)
- [VERIFIED: codebase] `src/lib/engine/qwen/omni-analysis.ts` — existing omni call shape; segments[] extends this
- [VERIFIED: codebase] `src/lib/engine/anti-virality.ts` — existing isAntiViralityGated to extend
- [VERIFIED: codebase] `src/lib/engine/stage10-critique.ts` — existing Stage10 to swap model in
- [VERIFIED: codebase] `src/lib/engine/stage11-counterfactuals-prompts.ts` — timestamp_ms field exists on suggestions
- [VERIFIED: codebase] `supabase/migrations/20260524000000_niche_post_windows.sql` — canonical pg_cron + SECURITY DEFINER template
- [VERIFIED: codebase] `supabase/migrations/20260512010000_corpus_videos_storage.sql` — canonical Storage bucket migration template
- [VERIFIED: npm registry] ffmpeg-static v5.3.0 — current latest, published 6 months ago
- [CITED: alibabacloud.com/help/en/model-studio/deep-thinking] — DashScope thinking-mode params: enable_thinking, thinking_budget (no reasoning_effort)
- [CITED: alibabacloud.com/help/en/model-studio/vision] — qwen3.6-plus vision: MMMU 86.0%, image_url content type supported

### Secondary (MEDIUM confidence)
- [CITED: github.com/vercel-labs/ffmpeg-on-vercel] — Vercel Fluid compute + ffmpeg-static pattern; requires explicit binary declaration
- [CITED: github.com/vercel/next.js/issues/53791] — ffmpeg-static __dirname bug in Next.js serverless (unresolved)
- [CITED: supabase.com/docs/guides/cron/quickstart] — pg_cron SQL syntax: `cron.schedule('name', 'expr', $$SQL$$)`
- [CITED: github.com/GaryAustin1/supa-file-helper] — `DELETE FROM storage.objects` pattern for bulk cleanup

### Tertiary (LOW confidence)
- [ASSUMED] Supabase createSignedUrl accepts 30-day TTL without documented cap
- [ASSUMED] Direct `DELETE FROM storage.objects` deletes underlying S3 objects (not just metadata)
- [ASSUMED] D-17 threshold values (40%/70%) produce <10% false positive rate on "good" videos

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all key libraries verified in codebase or npm registry
- DashScope thinking-mode API: HIGH — official docs confirmed; `reasoning_effort` absence confirmed
- Architecture patterns: HIGH — all patterns derived from existing codebase
- ffmpeg hosting: MEDIUM — Vercel production behavior inferred from community reports + official labs example
- Anti-virality thresholds: LOW — no outcomes corpus; thresholds require empirical validation during implementation
- Supabase Storage TTL: MEDIUM — API works as expected; max TTL not explicitly documented

**Research date:** 2026-05-26
**Valid until:** 2026-06-25 (30 days — stable libraries; DashScope API may update)
