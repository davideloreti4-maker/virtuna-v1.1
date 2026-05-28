# Phase 3: Engine rework — Pass 2 timeline + weighted aggregator + heatmap schema + filmstrip - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Rework the prediction engine to produce **time-resolved per-persona attention data** with confidence-weighted aggregation, and the schema + asset pipeline the Audience node (Phase 4) consumes. Add a dedicated Qwen Pass 2 per-persona timeline call (thinking-mode) layered on top of the existing Pass 1 verdict pass. Refactor the aggregator to expose a weighted retention curve (FYP 0.65 / niche 0.20 / loyalist 0.10 / cross 0.05 default mix). Add a `heatmap` field to `PredictionResult`. Generate filmstrip keyframes for the Audience node top axis. Add a timeline-pattern anti-virality trigger alongside the existing 0.4 confidence cutoff. Finalize the future `outcomes` table schema. Add telemetry on Pass 2 cost/quality.

This is a **backend-only phase** that runs parallel to Phase 2 board substrate. No UI surface ships here. The contract Phase 4 consumes (heatmap shape, weighted_* fields, signed filmstrip URLs, streaming partial extensions) is what Phase 3 delivers.

**In scope:**
- Wave 0 omni schema extension: emit `segments[]` (hybrid scene-boundary + fixed-bucket fallback) with `{t_start, t_end, visual_event, audio_event}`
- Wave 3 Pass 2: dedicated per-persona thinking-mode call (qwen3.6-plus) producing per-segment attention timeline + reasoning at inflection points
- Aggregator extension: weighted retention curve from Pass 2 per-persona attentions × persona_weights
- `PredictionResult.heatmap` schema (segments[], personas[].attentions[], weights{}, weighted_curve[])
- New top-level canonical weighted fields: `weighted_completion_pct`, `weighted_top_dropoff_t`, `weighted_hook_score`
- Streaming partial extension: `partial.personas[].attentions[]` fills as Pass 2 returns
- Filmstrip generation: server-side ffmpeg keyframe extraction at omni segment t_start, background-queued in parallel with Wave 3, Supabase Storage bucket `/filmstrips/<analysis_id>/<segment>.jpg`, 30-day signed URLs
- Anti-virality dual-trigger: keep existing 0.4 confidence cutoff (cannot recalibrate — outcomes corpus empty), ADD timeline-pattern trigger (critical dropoff pattern)
- Stage10 self-critique upgrade: qwen3.6-flash → qwen3.6-plus thinking-mode (tighter confidence calibration)
- Persona weight override schema (per-niche / per-creator / per-analysis) — engine config types only, no UI
- `outcomes` table schema lock (analysis_id FK, posted_at, real_views, real_completion_pct, creator_rating)
- Pass 2 prompt enrichment: demographic context + time-of-day scrolling-state grounding
- Telemetry: Pass 2 latency p95, output quality guards (attention 0-1 range, monotonic-ish near swipe events, valid segment indexing), weight transparency surfacing

**Out of scope:**
- Audience node UI (Phase 4)
- Verdict / Actions / Content Analysis node bodies (Phase 5)
- Persona allocation count or mix changes (still 6/2/1/1; future allocation evolution = M3 Tribe v2)
- Demographic stratification axis in `selectPersonaSlots` (deferred to M3)
- Real outcome-data-driven anti-virality recalibration (deferred to M2-III when corpus accumulates)
- Per-creator weight override UI (Workspace milestone)
- Tribe v2 frozen-encoder grounding (M3)
- Filmstrip lazy/on-demand fetching (background-pre-generated only)
- Re-implementing Pass 1 share/comment/save intent metrics via Pass 2 (intent stays Pass 1)

</domain>

<decisions>
## Implementation Decisions

### Pass 1 / Pass 2 split (Area 1)

- **D-01:** **Two-pass architecture, both passes ship.** Pass 1 (existing Wave 3, qwen3.6-flash, 10 parallel, no thinking) keeps its current role: fast verdict, share/comment/save intent metrics, behavioral aggregate, anti-virality confidence input. Pass 2 (NEW, qwen3.6-plus thinking-mode, 10 parallel) layers on top to produce per-segment attention timeline + reasoning at inflection points. Pass 2 does NOT replace Pass 1.
- **D-02:** **Pass 2 model = `qwen3.6-plus` with thinking-mode enabled.** Already wired as `QWEN_REASONING_MODEL`. Enable thinking via DashScope `extra_body` param (matches Qwen3.6 hybrid thinking-mode toggle). Cost-not-a-concern per MILESTONE.md stack decision; qwen3.6-plus is also multimodal (vision-capable per Qwen3.6 Plus product spec).
- **D-03:** **Pass 2 input shape = Wave 0 segments (text) + per-segment keyframe images + Pass 1 persona verdict + persona archetype.** Pass 2 is vision-grounded via keyframes (uses qwen3.6-plus's vision capability) + audio-via-omni-text (qwen3.6-plus is NOT audio-modal; audio enters as omni's segment `audio_event` text). Each Pass 2 call sees one persona's lens. 10 calls parallel, ≥7-of-10 success threshold matching Pass 1 contract.
- **D-04:** **Pass 2 prompt enrichment.** Inject creator demographic context (age bucket, geo, follower tier) + time-of-day scrolling-state grounding ("you're doom-scrolling at 11pm before bed" / "you're on a coffee-break scroll at 10am"). Improves persona realism without changing slot allocation.
- **D-05:** **Pass 2 output schema:**
  ```ts
  {
    persona_id: string;
    segment_reactions: Array<{
      t_start: number;
      t_end: number;
      attention: number;        // 0-1
      reason?: string;          // populated only at inflection points (hook start, biggest delta, swipe predicted, end)
      swipe_predicted: boolean;
    }>;
    pass2_latency_ms: number;
    pass2_cost_cents: number;
  }
  ```
- **D-06:** **Pass 2 quality guards.** Output validation: attention in [0,1], segment_reactions count matches Wave 0 segments count, monotonic-ish near swipe_predicted boundaries (allow ±0.15 noise; flag larger violations), reasoning grounded in Wave 0 segment text. Failed validation → drop persona from Pass 2 aggregate (Pass 1 still counts toward behavioral metrics). Below 7-of-10 Pass 2 successes → heatmap field null, fallback to Pass 1 flat aggregate display.

### Segment grid + filmstrip (Area 2)

- **D-07:** **Hybrid segment grid (scene-boundary primary, fixed-bucket fallback).** Wave 0 omni prompt extended to emit `segments[]` with timestamped `{t_start, t_end, visual_event, audio_event, scene_boundary_reason}`. Server-side validator: if omni returns <4 boundaries OR any sub-1s segment OR no hook-zone separation OR malformed timestamps → fall back to deterministic 2s fixed buckets (1s buckets for <8s videos). Hook zone (0-3s) ALWAYS its own segment, regardless of path.
- **D-08:** **Min cell width = 1s, merge sub-1s scene cuts** at server-side normalization stage before emitting segments to downstream consumers. Per R2.6.
- **D-09:** **Filmstrip keyframe extraction = ffmpeg server-side at segment `t_start`.** Background worker triggered when Wave 0 emits segments. Pulls signed video URL, runs `ffmpeg -ss <t_start> -frames:v 1 -q:v 4 -f image2`, uploads JPEG to Supabase Storage. Deterministic, ~50ms per frame, no model cost. Researcher locates the right hosting (Vercel serverless ffmpeg vs background queue vs Supabase Edge Function — `ffmpeg-static` package preferred).
- **D-10:** **Storage: Supabase Storage bucket `filmstrips/<analysis_id>/<segment_idx>.jpg`.** Public-read disabled, 30-day signed URLs returned per `heatmap.segments[].keyframe_uri`. Cleanup via daily pg_cron sweep deleting >30d entries.
- **D-11:** **Timing: background, non-blocking, parallel with Wave 3.** Trigger fires the moment Wave 0 emits segments (~stage `wave_0_complete`). Pipeline does NOT await filmstrip completion. `PredictionResult.heatmap.segments[].keyframe_uri` starts null on first emit; SSE event `filmstrip_segment_ready { segment_idx, keyframe_uri }` fills entries in. Audience node renders curve + heatmap immediately, filmstrip thumbnails pop in seconds later. No SLA hit on the 60s engine cap.

### Aggregator + canonical weighted fields (Area 4)

- **D-12:** **Aggregator integration mode = additive + new canonical weighted fields.** Phase 1's `persona_behavioral_aggregate.completion_pct` (Pass 1 flat mean of watch_through_pct) is **untouched**. New top-level fields on `PredictionResult`:
  ```ts
  weighted_completion_pct: number | null;     // weighted mean of Pass 2 timeline mean per persona
  weighted_top_dropoff_t: number | null;      // timestamp of largest aggregate attention drop
  weighted_hook_score: number | null;         // mean attention in 0-3s hook zone
  heatmap: HeatmapPayload | null;             // full Pass 2 grid (see D-13)
  ```
  Pass 2 below 7-of-10 → all new fields = null; UI falls back to Pass 1 display per D-06.
- **D-13:** **`HeatmapPayload` schema:**
  ```ts
  interface HeatmapPayload {
    segments: Array<{
      idx: number;
      t_start: number;
      t_end: number;
      label?: string;                          // omni-supplied visual_event short label
      is_hook_zone: boolean;
      keyframe_uri: string | null;             // signed URL; null until filmstrip ready
    }>;
    personas: Array<{
      id: string;                              // matches existing persona.id
      attentions: number[];                    // length === segments.length
      swipe_predicted_at: number | null;       // t value
      segment_reasons: Record<number, string>; // sparse, inflection points only
    }>;
    weighted_curve: number[];                  // weighted aggregate attention per segment
    weights: {                                 // transparency surface, default mix
      fyp: number;        // 0.65
      niche: number;      // 0.20
      loyalist: number;   // 0.10
      cross_niche: number;// 0.05
    };
    weights_source: 'default' | 'niche_override' | 'creator_override' | 'analysis_override';
  }
  ```
  Backwards-compatible additive change. Existing Phase 1 consumers unaffected.
- **D-14:** **Headline metrics source policy.** Phase 4 Audience node MUST read:
  - **From Pass 2 (`weighted_*`):** Avg watch %, Top dropoff timestamp, Hook score (0-3s window), full retention curve, heatmap grid, dropoff markers
  - **From Pass 1 (`persona_behavioral_aggregate.*`):** Share intent, Comment intent, Save intent, Loop % (Pass 2 doesn't time-resolve intent; Pass 1's natural strength)
  - **vs Niche baseline:** computed from corpus + weighted_completion_pct (Phase 3 ships baseline lookup helper if not present)
- **D-15:** **Streaming partials extension.** `partial.personas[]` (existing Phase 1 shape) extended additively:
  ```ts
  partial.personas[i] = {
    id, status: 'pending'|'streaming'|'complete',
    verdict?, reasoning?,           // Pass 1, existing
    pass2_status?: 'pending'|'streaming'|'complete',  // NEW
    attentions?: number[],          // NEW, fills in segment-by-segment as Pass 2 streams
    swipe_predicted_at?: number,    // NEW
  }
  ```
  Phase 4 board subscribes to `partial.personas[i].attentions` for row-by-row reveal choreography.

### Anti-virality + outcomes schema (Area 3)

- **D-16:** **Confidence threshold STAYS at 0.4.** Cannot honestly recalibrate without real outcome data (Phase 1 D-15 fallback condition still holds — `outcomes` table empty). Calibration script `scripts/calibrate-anti-virality.ts` documented to require ≥50 rows; today's count is 0.
- **D-17:** **NEW dual-trigger: timeline-pattern anti-virality.** In addition to `confidence < 0.4`, fire anti-virality when weighted curve shows a **critical dropoff pattern**:
  - Default thresholds (researcher confirms via corpus sweep): aggregate attention loss ≥40% across first 5s, AND persona consensus ≥70% (at least 7 of 10 personas show drop in same window)
  - Logic OR'd with confidence gate: `anti_virality_gated = confidence < 0.4 || timeline_pattern_triggered`
  - When timeline-triggered, surface specific dropoff segment indices to drive Phase 5 anti-virality visual treatment
- **D-18:** **Outcomes table schema locked in Phase 3** (forward-compatible, no data yet):
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
    source TEXT NOT NULL DEFAULT 'creator_self_report',  -- 'tiktok_analytics_oauth' future
    captured_at TIMESTAMPTZ DEFAULT now()
  );
  CREATE INDEX outcomes_analysis_id_idx ON outcomes(analysis_id);
  ```
  Migration ships in Phase 3; ingestion writes land in M2-III feedback-loop milestone.

### Persona allocation + Qwen model audit (Area 5)

- **D-19:** **Persona allocation = no shape change in Phase 3.** Mix stays 6 FYP + 2 niche_deep + 1 loyalist + 1 cross_niche (10 total). The mix is a **viral-cold-traffic prior** matching Virtuna's "predict virality" pitch — NOT a universal model of the TikTok algorithm. Real algorithm-modeling accuracy = M3 Tribe v2 (retrained subject block on outcome data). Phase 3 quality wins come via Pass 2 prompt enrichment (D-04), not allocation rebalance.
- **D-20:** **Persona weight override schema (per R2.3, schema-only).** Engine config types updated to accept:
  ```ts
  interface PersonaWeights { fyp: number; niche: number; loyalist: number; cross_niche: number; }
  interface PersonaWeightConfig {
    default: PersonaWeights;
    niche_overrides?: Record<string, PersonaWeights>;
    creator_overrides?: Record<string, PersonaWeights>;
    analysis_override?: PersonaWeights;
  }
  ```
  No UI, no DB column. Aggregator reads the precedence chain (analysis > creator > niche > default), normalizes (sum = 1.0 ± 0.01), surfaces source via `heatmap.weights_source`. M2-II / Workspace milestone wires UI.
- **D-21:** **Stage10 self-critique upgrade: qwen3.6-flash → qwen3.6-plus thinking-mode.** Confidence drives anti-virality (D-16) and the entire verdict surface. Tighter critique → better confidence calibration → fewer false-positive "Don't post yet" + fewer false-negative virality misses. Adds latency to wave 4 (Stage 10), but inside the 60s cap; cost-not-a-concern. Researcher locates the right `extra_body` / `reasoning_effort` setting for stage10's specific quality bar.
- **D-22:** **Qwen model audit — current usage verified, no other changes:** qwen3.5-omni-plus (Wave 0/1 omni, KEEP — only multimodal Qwen), qwen3.6-flash (Wave 3 Pass 1 + rules + wave4 platform-fit, KEEP — right model for fast/parallel jobs), qwen3.6-plus (Wave 3 Pass 2 NEW + Stage11 counterfactuals + Stage10 upgraded), qwen3-max + qwq-plus (priced in cost.ts but not in client constants, no current use, no Phase 3 introduction).

### Telemetry + observability (Area 1 / NF4)

- **D-23:** **Pass 2 telemetry instrumentation.** Per-persona Pass 2 call emits structured log + Sentry metrics: `pass2_latency_ms`, `pass2_cost_cents`, `pass2_validation_failures` (which guard failed per D-06), `pass2_success_count` (out of 10), `pass2_aggregate_built` (true when ≥7). Wave-level p50/p95 latency tracked. Weight transparency: aggregator logs which `weights_source` resolved per analysis.
- **D-24:** **Cost ceiling sanity (informational, not blocking).** Pass 2 = 10 × qwen3.6-plus thinking calls per analysis. Rough budget: ~$0.0008 input + ~$0.0024 output per persona × 10 ≈ $0.032 per analysis added (vs Phase 1 baseline). Log per-analysis Pass 2 cost; flag if any single analysis exceeds $0.50 (10x expected) — signals prompt or model-routing regression.

### Claude's Discretion

- **ffmpeg hosting strategy** — Vercel serverless function (cold-start risk) vs Supabase Edge Function (Deno runtime, `ffmpeg-wasm`) vs background pg_cron job picking off a `pending_filmstrip` queue table. Researcher picks based on latency budget + cold-start behavior on Vercel's pricing tier.
- **Timeline-pattern threshold values** (D-17) — `≥40% attention loss first 5s + ≥70% persona consensus` is a starting point. Researcher sweeps on `training-data.json` to validate the cutoff doesn't fire on most "actually good" videos (false-positive rate < 10%).
- **Wave 0 omni prompt extension format** (D-07) — exact JSON shape for segments[] (whether to nest under existing structure or top-level), how to ask omni for `scene_boundary_reason`. Researcher locks during planning.
- **Pass 2 keyframe-injection format** (D-03) — whether all keyframes go in one message (high-token but single-turn) or rolled into the segment text as descriptions (no image upload). If image upload to qwen3.6-plus is supported and cost-acceptable, use real images. Otherwise fall back to omni's `visual_event` text.
- **Outcomes table indexing strategy** (D-18) — `(analysis_id)` is the obvious one; planner decides if `(posted_at)` or `(creator_id, posted_at)` indexes warranted for M2-III feedback queries.
- **`reasoning_effort` parameter** for qwen3.6-plus thinking-mode — `low` / `medium` / `high`. Researcher tests Pass 2 quality vs latency tradeoff; cost-not-a-concern argument permits `high` if quality warrants.
- **Anti-virality fix-extraction** (D-17 timeline-triggered case) — when timeline triggers anti-virality, how to extract "top 3 fixes anchored to segments" for Phase 5 surface. Default: pick segments with worst weighted_curve dip + pull counterfactuals from Stage11 output mapped to those segments. Researcher confirms counterfactual schema supports timestamp anchoring or designs a mapper.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone + roadmap

- `.planning/MILESTONE.md` — Result Surface scope, board-model amendment (2026-05-25), stack decisions locked
- `.planning/ROADMAP.md` §Phase 3 — phase goal, plan list (3.1-3.7), success criteria, dependencies (parallel with Phase 2 after APIs lock)
- `.planning/REQUIREMENTS.md` §R2 (Audience Engine — refactored 2026-05-25), §R1.9 (anti-virality cross-group state), §NF4 (telemetry on Pass 2 cost/quality)
- `.planning/PROJECT.md` §Current Milestone, §Key Decisions — locked architecture conventions

### Prior phase context (still applies)

- `.planning/phases/01-foundation-sse-consumer-engine-signal-extensions/01-CONTEXT.md` — Phase 1 decisions: D-04 (GET stream endpoint), D-07 (3-layer hook return), D-08 (`partial.personas[]` shape), D-12 (niche_post_windows), D-15 (anti-virality fallback rationale)
- `.planning/phases/02-board-substrate-navigation/02-CONTEXT.md` — Phase 2 decisions: D-17 (one concurrent analysis per session), D-18 (board state machine — anti-virality is cross-group state), D-19 (anti-virality ripples to Audience/Verdict/Actions). Phase 4 will consume Phase 3's heatmap; Phase 2's substrate accommodates it.

### Codebase intel

- `.planning/codebase/STACK.md` — Next.js 16, React 19, TypeScript strict, Vitest, Supabase, Qwen via DashScope
- `.planning/codebase/ARCHITECTURE.md` — route groups, data flow, prediction pipeline, Supabase client trio
- `.planning/codebase/INTEGRATIONS.md` — Supabase tables, Sentry, env vars (`DASHSCOPE_API_KEY`, `QWEN_*_MODEL`), webhook contracts
- `.planning/codebase/STRUCTURE.md` — file-layout conventions for lib/engine/, supabase/migrations/

### Engine surfaces to modify (must read before changing)

- `src/lib/engine/qwen/omni-analysis.ts` — Wave 0/1 omni. Extend `buildSystemPrompt` to request `segments[]` with timestamped visual+audio events. Extend `OmniAnalysisOutput` to surface segments.
- `src/lib/engine/qwen/schemas.ts` — `OmniAnalysisZodSchema`. Add `segments` field with Zod validation (min 1 element, sorted, non-overlapping).
- `src/lib/engine/qwen/client.ts` — model constants. No changes required; Pass 2 reuses `QWEN_REASONING_MODEL` (= qwen3.6-plus).
- `src/lib/engine/qwen/cost.ts` — pricing already includes qwen3.6-plus; no changes.
- `src/lib/engine/wave3.ts` — Pass 1 orchestrator. Refactor to emit Pass 1 events unchanged, then trigger Pass 2 sub-stage. Pass 2 lives in a new wave3-pass2 module.
- `src/lib/engine/wave3/persona-prompts.ts` — Pass 1 prompts. Add Pass 2 prompt builder in a sibling module (`persona-prompts-pass2.ts`) — keep Pass 1 prompts immutable.
- `src/lib/engine/wave3/aggregator.ts` — Pass 1 aggregator. Add weighted aggregator helper in sibling module (`weighted-aggregator.ts`) for Pass 2 timeline → weighted curve + canonical weighted fields.
- `src/lib/engine/wave3/persona-registry.ts` — `selectPersonaSlots`. **Read-only in Phase 3** — no allocation changes per D-19.
- `src/lib/engine/aggregator.ts` — top-level aggregator. Extend `PredictionResult` assembly to add `weighted_*` fields + `heatmap` per D-12/D-13.
- `src/lib/engine/types.ts` — `PredictionResult` schema. Add new fields per D-12/D-13. Existing fields untouched.
- `src/lib/engine/anti-virality.ts` — confidence threshold. Add timeline-pattern trigger per D-17 (new exported function `isTimelinePatternTriggered(heatmap)`). Update `isAntiViralityGated` signature or add a new function that ORs both triggers.
- `src/lib/engine/stage10-critique.ts` — model swap qwen3.6-flash → qwen3.6-plus thinking-mode per D-21. Verify Stage10 latency stays within wave-4 budget.
- `src/lib/engine/pipeline.ts` — orchestration. Add Pass 2 stage event emit (`stage_start`/`stage_end` per persona for Pass 2). Wire filmstrip background-trigger fire at `wave_0_complete`.
- `src/lib/engine/events.ts` — `StageEvent` discriminated union. Add `pass2_persona_start`, `pass2_persona_end`, `filmstrip_segment_ready` event variants.
- `src/app/api/analyze/[id]/stream/route.ts` — Phase 1's GET SSE endpoint. Extend event types written to the stream to include new event variants. Schema should remain backwards-compatible.

### New files Phase 3 will create

- `src/lib/engine/wave3/pass2.ts` — Pass 2 orchestrator (10 parallel qwen3.6-plus thinking calls)
- `src/lib/engine/wave3/persona-prompts-pass2.ts` — Pass 2 system + user prompt builders (demo + time-of-day enrichment per D-04)
- `src/lib/engine/wave3/weighted-aggregator.ts` — Pass 2 timeline → weighted curve, weighted_*, heatmap payload assembly
- `src/lib/engine/filmstrip/extract.ts` — ffmpeg keyframe extraction helper
- `src/lib/engine/filmstrip/storage.ts` — Supabase Storage upload + signed URL minting
- `src/lib/engine/filmstrip/queue.ts` — background-trigger entry point + per-segment async upload
- `src/lib/engine/persona-weights.ts` — PersonaWeightConfig precedence resolver per D-20
- `supabase/migrations/<ts>_outcomes_table.sql` — outcomes schema per D-18
- `src/lib/engine/__tests__/pass2.test.ts`, `weighted-aggregator.test.ts`, `filmstrip.test.ts`, `persona-weights.test.ts` — Vitest coverage

### Existing Pass 1 / persona infra (must read before extending)

- `src/lib/engine/wave3.ts` — current 10-parallel Wave 3 orchestrator, SUCCESS_THRESHOLD=7, circuit-breaker fast-fail, per-persona stage events. Pass 2 mirrors this structure.
- `src/lib/engine/wave3/persona-registry.ts` — 8 archetypes (high_engager, saver, lurker, sharer, viewer, niche_deep, loyalist, cross_niche_curiosity), `selectPersonaSlots` returns 10 = 6 FYP + 2 niche_deep + 1 loyalist + 1 cross_niche, deterministic.
- `src/lib/engine/wave3/aggregator.ts` — Pass 1 aggregator: D-06 per-metric rule (completion = flat mean; share/comment/save = top-3 enthusiast-weighted), D-13 ≥7/10 threshold.
- `scripts/calibrate-anti-virality.ts` — calibration script; requires ≥50 outcomes rows; currently emits fallback.
- `src/lib/engine/calibration-baseline.json` — baseline calibration artifact (26KB) — read to understand existing confidence distribution shape.

### Phase 4 downstream consumer (Audience node)

- Phase 4 will consume `PredictionResult.heatmap` + `weighted_*` + `partial.personas[i].attentions[]`. Phase 3 contract design must prioritize Phase 4's needs:
  - Heatmap grid must be renderable in Konva + DOM overlay hybrid (per Phase 2 D-04)
  - Streaming partials must support row-by-row reveal choreography (per R1.2 "rows materialize as Pass 2 personas complete")
  - Filmstrip URIs must be signed URLs renderable as `<img src>` in DOM overlay (no auth headers)

### Brand + design

- `BRAND-BIBLE.md` — Raycast design language (irrelevant to Phase 3 engine work but documents the visual system Phase 4 will use to display the heatmap)
- `CLAUDE.md` §Raycast Design Language Rules — token values

### External docs

- DashScope International Qwen models page (https://www.alibabacloud.com/help/en/model-studio/) — qwen3.6-plus thinking-mode `extra_body` config + multimodal vision input shape
- Qwen3.6 Plus product spec (https://designforonline.com/ai-models/qwen-qwen3-6-plus/) — vision + thinking-mode capability confirmation, 1M context
- Supabase Storage signed URL docs (https://supabase.com/docs/guides/storage/serving/downloads) — `createSignedUrl` API + 30-day TTL pattern
- ffmpeg-static npm package (https://github.com/eugeneware/ffmpeg-static) — bundled binary for serverless ffmpeg execution

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`wave3.ts` orchestration pattern** — 10-parallel Promise.allSettled, per-persona stage events, circuit-breaker fast-fail (`isCircuitOpen`), per-call cost rollup, ≥7/10 threshold. Pass 2 orchestrator mirrors this structure end-to-end.
- **`OmniAnalysisZodSchema`** — Zod-validated omni output. Extending with `segments[]` is a single-file change; existing fields stay.
- **`calculateCost(model, usage)`** — already handles qwen3.6-plus pricing. No cost-layer changes needed.
- **`emitStageStart` / `emitStageEnd`** — existing telemetry helpers. Pass 2 sub-stage events reuse these with new event names.
- **`createLogger({ module })`** structured logger pattern — Pass 2 telemetry (D-23) instruments per-persona logs.
- **`stripModelOutput` + Zod safe-parse + retry-once** pattern in omni-analysis.ts — Pass 2 reuses for robust parsing.
- **`getQwenClient`** singleton — already supports any DashScope-compatible model.
- **Supabase service-role client** (`src/lib/supabase/service.ts`) — used by background tasks; filmstrip queue + outcomes table writes use this.
- **`niche_post_windows` materialization pattern** (Phase 1 D-14) — pre-aggregated table + daily refresh cron. Outcomes future analytics may follow similar pattern.
- **PredictionResult `signal_availability`** field — Pass 2 follows the graceful-degradation convention: when Pass 2 below threshold, flag `signal_availability.pass2_timeline = false` and surface null heatmap.

### Established Patterns

- **Graceful degradation, never throw** — every wave catches its own failures and returns null + warning. Pass 2 + filmstrip both inherit this. Anti-virality dual-trigger logic must also tolerate null heatmap (only confidence trigger fires).
- **Additive schema evolution** — `PredictionResult` has accumulated optional fields across phases. Phase 3 continues the pattern: new fields are optional, existing consumers unaffected.
- **Env-overridable model constants** — Phase 3's new behaviors don't add new env vars; Pass 2 uses existing `QWEN_REASONING_MODEL`. If researcher needs a separate `QWEN_PASS2_MODEL` constant for routing flexibility, propose during plan-phase but default to reusing QWEN_REASONING_MODEL.
- **Cost rollup** — every wave returns `cost_cents` aggregated to `PredictionResult.cost_cents`. Pass 2 cost adds in, just like Wave 3 Pass 1.
- **Per-call timeouts** — Wave 3 Pass 1 uses 45s per call. Pass 2 thinking may need 60s (thinking mode is slower); researcher picks. Wave-level p95 target ≤8s per R2.2 — thinking mode may make this tight; needs empirical verification.
- **Vitest mock-first patterns** in `src/lib/engine/__tests__/wave3.test.ts` — Pass 2 tests follow same approach (mock OpenAI client, assert on parsed output).

### Integration Points

- **Pipeline orchestration** (`src/lib/engine/pipeline.ts`) — wire Pass 2 trigger after Pass 1 returns per-persona (or fire Pass 2 in parallel after Pass 1 starts? Researcher decides — sequential is safer, parallel could halve perceived latency but complicates streaming partials.)
- **SSE event stream** (`src/app/api/analyze/[id]/stream/route.ts`) — new event variants for `pass2_persona_*` and `filmstrip_segment_ready`. Phase 1's `useAnalysisStream` hook needs no signature change if added additively; payload schema bumps.
- **Supabase Storage bucket creation** — bucket `filmstrips` may not exist yet. Phase 3 migration creates it with RLS policy: service role can write, signed URLs only for read.
- **pg_cron daily filmstrip cleanup** — register a function deleting Storage objects older than 30 days. Pattern mirrors existing `niche_post_windows` refresh cron.
- **`analyses` table** — no new columns required; heatmap data lives on the `analysis_results` JSON column alongside existing PredictionResult fields.
- **Telemetry sinks** — Sentry breadcrumbs + structured logger; no new infra.

</code_context>

<specifics>
## Specific Ideas

- **Quality > cost everywhere (per MILESTONE.md stack decisions).** Pass 2 thinking-mode at `high` reasoning_effort is acceptable if quality warrants. ~$0.03/analysis added budget tolerable.
- **Pass 2's primary value = per-segment reasoning text at inflection points**, not raw attention numbers. The numbers can be model-fragile; the inflection-point reasons are what Phase 4 surfaces in the heatmap reason popover ("Persona X swiped at 4s — pacing dropped, no new visual hook").
- **Hook zone (0-3s) is sacred** per R1.2 — always its own segment, always highlighted with warm band in heatmap, hook score = weighted attention in this window specifically.
- **Filmstrip aesthetics** — the Audience node's filmstrip is the user's anchor for "where am I looking on the timeline." Keyframes need to be visually distinct enough to scrub by. ffmpeg `-q:v 4` should give clear JPEGs without blowing storage.
- **`weighted_curve[]` is THE primary visual signal** for the retention curve in the Audience node. Smooth bezier rendering in Phase 4 — Phase 3 emits the raw per-segment values; Phase 4 interpolates.
- **No new design tokens, no new UI in Phase 3.** All UI deferred to Phase 4. Phase 3 is pure engine + schema + data assets.
- **Cost-not-a-concern doesn't mean cost-unmonitored** — D-24 flags anomalies but doesn't gate. Per-analysis Pass 2 cost logged; flag if > $0.50.
- **Phase 3 + Phase 2 parallel after API lock** per ROADMAP.md. The "API lock" is this CONTEXT.md's D-13 (HeatmapPayload schema) + D-15 (partial.personas extension). Once these freeze (post-planning), Phase 2 and Phase 3 teams work independently against the contract.
- **TikTok algorithm fidelity is NOT a Phase 3 goal** — the 6/2/1/1 mix is a viral-cold-traffic prior. Don't get distracted by "is this how the algorithm actually works." That's M3.
- **`bypassPermissions` on workers, default on auditors** per agent-teams protocol.

</specifics>

<deferred>
## Deferred Ideas

- **Real outcome-data-driven anti-virality recalibration** — blocked on outcomes corpus accumulation. M2-III feedback loop ingests creator self-reports + (eventually) TikTok Analytics OAuth. Phase 3 ships outcomes schema; calibration re-runs once ≥50 rows.
- **Demographic stratification axis in `selectPersonaSlots`** — adds `demo_bucket` dimension to slot selection. Significant scope; possibly own phase. M3 Tribe v2 work.
- **Tribe v2 frozen-encoder grounding** (V-JEPA2 + W2vec-BERT + Llama 3.2) — replaces LLM persona-heatmap with grounded encoder + trained subject block. M3 milestone.
- **Audio-as-multimodal in Pass 2** — currently audio enters as omni's text description. Future: pipe raw audio waveform features into Pass 2 alongside keyframes. Blocked on multimodal-thinking-capable Qwen (qwen3.6-plus is vision+text+thinking, no audio).
- **Per-creator weight override UI** — schema ships in Phase 3 (D-20); UI lives in Workspace milestone.
- **Filmstrip lazy on-demand fetching** — rejected for "background pre-generate" approach in Phase 3 (D-11). If storage cost becomes hotspot, revisit.
- **Allocation rebalance to 5/2/1/2 (more cross-niche)** — better generalization signal but breaks Phase 1 contracts + Phase 2 row count. Defer to M3.
- **Established-creator vs new-creator weight presets** — rule-based weight selector (e.g., loyalist 0.30 for creators with >100k followers) — schema accommodates via creator_overrides; rule logic deferred to M2-II or workspace milestone.
- **Pass 2 + Pass 1 unification into a single fat thinking-mode call** — rejected for two-pass streaming UX (verdict fast, timeline fills). Revisit if Qwen quality gap closes.
- **Time-bucket-based segment grid (no scene boundaries)** — rejected as default per D-07 hybrid choice. Available as fallback.
- **Per-segment audio fingerprint matching** — interesting but out of scope. Existing `audio-fingerprint.ts` operates at video level.
- **Wave 4 platform-fit upgrade to thinking-mode** — currently qwen3.6-flash. Same argument as Stage10 (D-21) could apply but flagged as separate scope decision. Not in Phase 3.
- **Multi-window / ranked anti-virality fix suggestions** — Phase 3 surfaces top-3 fixes at timeline-triggered segments. Multi-window ranking deferred.
- **Notion-import filmstrip / heatmap PNG export** — R5 deferred to M2-II.

</deferred>

---

*Phase: 3-Engine-rework-Pass-2-timeline-weighted-aggregator-heatmap-sc*
*Context gathered: 2026-05-26*
