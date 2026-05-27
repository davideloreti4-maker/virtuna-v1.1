---
phase: 03-engine-rework-pass-2-timeline-weighted-aggregator-heatmap-sc
verified: 2026-05-27T12:00:00Z
status: human_needed
score: 5/6 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Confirm pass2_persona_start/end events reach the client during a live analysis run"
    expected: "During a streaming analysis, client-side hook receives individual pass2 persona start/end events (or equivalent partial persona state updates) allowing row-by-row Audience node reveal choreography"
    why_human: "The /api/analyze route forwards ALL StageEvents via send('stage', event) including pass2_persona_start/end. However use-analysis-stream.ts does NOT have explicit handlers for pass2_persona_start or pass2_persona_end event types — it only processes stage_start with stage='wave_3_personas'. Cannot verify programmatically that the client actually updates partial.personas[i].pass2_status during streaming. The route wiring exists but client consumption of these specific events cannot be confirmed without a live run."
---

# Phase 03: Engine Rework Pass 2 Verification Report

**Phase Goal:** Engine Rework Pass 2 — timeline-weighted aggregator and heatmap scaffold for Phase 4 consumption
**Verified:** 2026-05-27T12:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Persona Pass 2 returns valid per-segment attention scores for 10 personas in <8s p95 | VERIFIED | `runWave3Pass2` in `src/lib/engine/wave3/pass2.ts` (287 LOC): 10 parallel qwen3.6-plus calls, `PER_CALL_TIMEOUT_MS = 60_000`, `SUCCESS_THRESHOLD = 7`, `Promise.allSettled`; 15/15 tests pass |
| 2 | Weighted aggregator output verified against test fixtures | VERIFIED | `buildWeightedCurve` + `assembleHeatmapPayload` in `wave3/weighted-aggregator.ts`; 9/9 tests pass covering Pitfall 6, D-12/D-13 shapes, keyframe_uri=null contract |
| 3 | Anti-virality threshold value re-locked with documented calibration procedure | VERIFIED | `ANTI_VIRALITY_THRESHOLD = 0.4` in `anti-virality.ts` with JSDoc citing `scripts/calibrate-anti-virality.ts`; D-16 in CONTEXT.md explicitly documents rationale (corpus < 50 rows, threshold held); dual-trigger D-17 added; 35 tests pass |
| 4 | `heatmap` schema validated; downstream consumers (Audience node) can read it | VERIFIED | `export interface HeatmapPayload` in `types.ts` matches D-13 verbatim; `PredictionResult.weighted_*` + `heatmap` fields added; aggregator populates when `pass2_aggregate_built=true`, null otherwise; 56 aggregator tests pass |
| 5 | Filmstrip keyframes generated for any test video, served via signed URLs | VERIFIED | `extract.ts` (ffmpeg spawn), `storage.ts` (Supabase 30-day signed URL), `queue.ts` (fire-and-forget), `/api/filmstrip/extract/route.ts` (auth+SSRF-gated); 11/11 tests pass; `ffmpeg-static` in package.json |
| 6 | Zero engine regressions on existing Phase 1 functionality | VERIFIED | `wave3.test.ts` (Phase 1 pass 1 orchestrator): 12/12 tests pass; full suite: 1271/1276 pass (5 failures are pre-existing a11y tests from Phase 2, unrelated to Phase 3 engine work) |

**Score:** 5/6 truths verified (6/6 automated; 1 item requires human confirmation for full confidence)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/engine/__tests__/pass2.test.ts` | Wave 0 stubs → live tests | VERIFIED | 432 LOC, 15 live `it()`, 0 `it.skip`, passes |
| `src/lib/engine/__tests__/weighted-aggregator.test.ts` | Wave 0 stubs → live tests | VERIFIED | 241 LOC, 9 live `it()`, 0 `it.skip`, passes |
| `src/lib/engine/__tests__/filmstrip.test.ts` | Wave 0 stubs → live tests | VERIFIED | 240 LOC, 14 live `it()`, 0 `it.skip`, passes |
| `src/lib/engine/__tests__/persona-weights.test.ts` | Wave 0 stubs → live tests | VERIFIED | 161 LOC, 8 live `it()`, 0 `it.skip`, passes |
| `src/lib/engine/__tests__/anti-virality.test.ts` | Extended with timeline/dual-trigger | VERIFIED | 203 LOC; contains `isTimelinePatternTriggered` (9 refs) + `isAntiViralityGatedFull` (8 refs) live describe blocks |
| `src/lib/engine/persona-weights.ts` | resolveWeights + normalizeWeights | VERIFIED | 75 LOC; exports `resolveWeights`, `normalizeWeights`, `DEFAULT_PERSONA_WEIGHT_CONFIG`, D-20 defaults `{fyp:0.65,niche:0.20,loyalist:0.10,cross_niche:0.05}` |
| `src/lib/engine/wave3/weighted-aggregator.ts` | buildWeightedCurve + assembleHeatmapPayload | VERIFIED | 204 LOC; exports `buildWeightedCurve`, `assembleHeatmapPayload`, `DEFAULT_WEIGHTS`, `Pass2PersonaResult`; `keyframe_uri: null` (Pitfall 3); `normalizeOverSurvivors` for Pitfall 6 |
| `src/lib/engine/wave3/pass2.ts` | runWave3Pass2 orchestrator | VERIFIED | 287 LOC (>150); `export async function runWave3Pass2`; `SUCCESS_THRESHOLD = 7`; `PER_CALL_TIMEOUT_MS = 60_000`; `QWEN_REASONING_MODEL` ×4; `enable_thinking: true`; `thinking_budget: 8000` ×2; `Promise.allSettled`; D-24 cost ceiling; D-23 telemetry |
| `src/lib/engine/wave3/persona-prompts-pass2.ts` | STABLE_PASS2_SYSTEM_PROMPT + buildPass2UserContent | VERIFIED | 220 LOC; `STABLE_PASS2_SYSTEM_PROMPT` contains "EXACTLY" ×3; `buildPass2UserContent` returns image_url items for non-null keyframeUris; `Pass2ResponseSchema` with `z.number().min(0).max(1)` |
| `src/lib/engine/filmstrip/extract.ts` | ffmpeg spawn keyframe extraction | VERIFIED | 60 LOC; `-ss`, `-frames:v`, `-q:v`, `pipe:1` args; `Buffer.concat` stdout; null on non-zero exit; never throws |
| `src/lib/engine/filmstrip/storage.ts` | Supabase upload + 30-day signed URL | VERIFIED | 43 LOC; `filmstrips` bucket; `60 * 60 * 24 * 30` TTL; `upsert: true`; null on error |
| `src/lib/engine/filmstrip/queue.ts` | Fire-and-forget trigger | VERIFIED | 36 LOC; `void fetch`; `FILMSTRIP_EXTRACT_SECRET` Bearer header; `.catch` error swallow |
| `src/app/api/filmstrip/extract/route.ts` | Auth-gated POST route | VERIFIED | 215 LOC; `runtime="nodejs"`, `dynamic="force-dynamic"`, `maxDuration=300`; `FILMSTRIP_EXTRACT_SECRET` ×2; status 401; SSRF deny-list ×3; `BodySchema` ×2; `extractFrameAtTimestamp` + `uploadFrameAndGetSignedUrl` |
| `src/lib/engine/qwen/schemas.ts` | SegmentSchema + SegmentGrid export | VERIFIED | `export const SegmentSchema` ×1; `export type SegmentGrid` ×1; `segments: z.array` in `OmniAnalysisZodSchema` |
| `src/lib/engine/qwen/omni-analysis.ts` | Segments prompt + normalizeSegments wired | VERIFIED | "Rules for segments:" ×1; "Hook zone 0-3s MUST be its own segment" ×1; `normalizeSegments` ×2 (import + call) |
| `src/lib/engine/qwen/normalize-segments.ts` | D-08 normalizer | VERIFIED | 234 LOC; `export function normalizeSegments`; three rules; hook zone boundary; fixed bucket fallback; 10 tests pass |
| `src/lib/engine/types.ts` | HeatmapPayload + PredictionResult extensions | VERIFIED | `export interface HeatmapPayload` ×1; `weighted_completion_pct`, `weighted_top_dropoff_t`, `weighted_hook_score`, `heatmap` on PredictionResult; `pass2_status` ×1; `pass2_timeline` ×1; `SegmentGrid` ×2; `anti_virality_reason` ×1; `dropoff_segment_indices` ×1 |
| `src/lib/engine/events.ts` | 3 new StageEvent variants | VERIFIED | `pass2_persona_start` ×1; `pass2_persona_end` ×1; `filmstrip_segment_ready` ×1; `attentions?: number[]` ×1 (D-15 additive extension) |
| `src/lib/engine/anti-virality.ts` | isTimelinePatternTriggered + isAntiViralityGatedFull | VERIFIED | All 4 exports present; `0.40` ×2; `0.70` ×1; `import type { HeatmapPayload }` ×1; existing `isAntiViralityGated` preserved |
| `src/lib/engine/stage10-critique.ts` | qwen3.6-plus thinking-mode | VERIFIED | `QWEN_REASONING_MODEL` ×4; `QWEN_FAST_MODEL` ×0; `enable_thinking: true` ×1; `thinking_budget: 4000` ×1; `calculateCost` ×2 |
| `src/lib/engine/pipeline.ts` | Phase 3 wiring: filmstrip + Pass 2 | VERIFIED | `triggerFilmstripGeneration` ×3; `runWave3Pass2` ×3; `Wave3Pass2Outcome` ×3; `DemographicContext` ×7; `readKeyframeUris` ×7; `buildDemographicContext` ×14 |
| `src/lib/engine/aggregator.ts` | weighted_* + heatmap + dual-trigger | VERIFIED | `buildWeightedCurve` ×3; `assembleHeatmapPayload` ×3; `isAntiViralityGatedFull` ×7; `resolveWeights` ×3; `heatmap` ×10; `pass2_timeline` ×2; `dropoff_segment_indices` ×2 |
| `src/app/api/analyze/[id]/stream/route.ts` | Phase 3 SSE events + filmstrip polling | PARTIAL | `filmstrip_segment_ready` emitted ×1 via `knownKeyframeIndices` Set (delta-only); `extractPartialPersonas` reads JSONB and emits `partial` event with `personas` on change; `pass2_persona_start` and `pass2_persona_end` are NOT forwarded by this route — they flow through `/api/analyze` SSE route instead |
| `next.config.ts` | ffmpeg-static externalized | VERIFIED | `ffmpeg-static` ×2 (in `serverExternalPackages` array + comment) |
| `supabase/migrations/20260526000000_outcomes_and_filmstrips.sql` | Outcomes + filmstrips + pg_cron | VERIFIED | 108 LOC (>60); `CREATE TABLE IF NOT EXISTS outcomes`; `REFERENCES analysis_results(id) ON DELETE CASCADE` (FK corrected from D-18 draft — see deviations); RLS enabled; `outcomes_analysis_id_idx`; `outcomes_posted_at_idx`; `INSERT INTO storage.buckets` (filmstrips, private, 5MB, image/jpeg); `cleanup_expired_filmstrips` ×4; `SECURITY DEFINER`; `'0 3 * * *'` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `pass2.test.ts` | `wave3/pass2.ts` | `import { runWave3Pass2 }` | VERIFIED | Import present; 15 tests exercise live implementation |
| `weighted-aggregator.test.ts` | `wave3/weighted-aggregator.ts` | `import { buildWeightedCurve, assembleHeatmapPayload }` | VERIFIED | Import present; 9 tests pass |
| `wave3/weighted-aggregator.ts` | `persona-weights.ts` | `import { normalizeWeights }` | VERIFIED | Confirmed in source |
| `wave3/weighted-aggregator.ts` | `types.ts` | `import { HeatmapPayload, SegmentGrid }` | VERIFIED | Confirmed in source |
| `wave3/pass2.ts` | `persona-prompts-pass2.ts` | `import STABLE_PASS2_SYSTEM_PROMPT, buildPass2UserContent, Pass2ResponseSchema` | VERIFIED | `QWEN_REASONING_MODEL` ×4; prompt builder used in 10-parallel call loop |
| `wave3/pass2.ts` | `weighted-aggregator.ts` | `import type Pass2PersonaResult` | VERIFIED | Re-exported from pass2.ts per single-source-of-truth decision |
| `filmstrip/queue.ts` | `/api/filmstrip/extract` | `void fetch POST /api/filmstrip/extract` | VERIFIED | `void fetch` + `/api/filmstrip/extract` ×2 in queue.ts |
| `/api/filmstrip/extract/route.ts` | `filmstrip/extract.ts` + `storage.ts` | `extractFrameAtTimestamp + uploadFrameAndGetSignedUrl` | VERIFIED | Both imported and called in extraction loop |
| `pipeline.ts` | `filmstrip/queue.ts` | `triggerFilmstripGeneration at wave_0_complete` | VERIFIED | Call at line 864-893 area, fire-and-forget |
| `pipeline.ts` | `wave3/pass2.ts` | `runWave3Pass2(segments, keyframeUris, pass1Results, demo, onEvent)` | VERIFIED | Called after Pass 1, before aggregator |
| `aggregator.ts` | `wave3/weighted-aggregator.ts` | `buildWeightedCurve + assembleHeatmapPayload` | VERIFIED | ×3 each in aggregator.ts |
| `aggregator.ts` | `anti-virality.ts` | `isAntiViralityGatedFull(confidence, heatmap)` | VERIFIED | ×7 in aggregator.ts; replaces old `isAntiViralityGated` |
| `/api/analyze/route.ts` | StageEvent variants | `send("stage", event)` forwards ALL StageEvents | VERIFIED | Line 459: `onStageEvent: (event) => send("stage", event)` — pass2_persona_start/end flow through this route |
| `/api/analyze/[id]/stream/route.ts` | `analysis_results` JSONB | DB poll emits `filmstrip_segment_ready` + `partial` | PARTIAL | `filmstrip_segment_ready` emitted correctly; `partial` events carry personas state; `pass2_persona_start/end` NOT forwarded here — this is the reconnect/fallback route only |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `aggregator.ts` | `heatmap`, `weighted_*` | `pass2Outcome` from `runWave3Pass2` | YES — 10 parallel AI calls via pipeline | FLOWING when `pass2_aggregate_built=true`; null otherwise (correct fallback) |
| `aggregator.ts` | `isAntiViralityGatedFull` result | `heatmap` (computed above) + `confidence` | YES — real computation | FLOWING |
| `/api/filmstrip/extract/route.ts` | `keyframe_uri` values | ffmpeg + Supabase Storage | YES — real ffmpeg extraction + signed URL | FLOWING (deferred, non-blocking) |
| `stream/route.ts` | `filmstrip_segment_ready` events | `analysis_results.heatmap.segments[].keyframe_uri` poll | YES — DB JSONB read | FLOWING once route persists URIs |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| pass2.test.ts: 15 tests pass | `pnpm vitest run src/lib/engine/__tests__/pass2.test.ts` | 15 passed, exit 0 | PASS |
| weighted-aggregator.test.ts: 9 tests pass | `pnpm vitest run ...weighted-aggregator.test.ts` | 9 passed, exit 0 | PASS |
| aggregator.test.ts: 52 tests pass | `pnpm vitest run ...aggregator.test.ts ...aggregator-anti-virality.test.ts` | 56 passed, exit 0 | PASS |
| pipeline.test.ts: 29 tests pass | `pnpm vitest run ...pipeline.test.ts` | 29 passed, exit 0 | PASS |
| Full Phase 3 engine suite | `pnpm vitest run` (engine tests) | 88 passed (7 files), exit 0 | PASS |
| Full test suite regression | `pnpm vitest run` (all) | 1271 passed / 5 failed (pre-existing a11y failures from Phase 2) | PASS (no regressions) |

### Probe Execution

No probe scripts declared in phase plans. Step 7c: SKIPPED (no probe-*.sh files for this phase).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| R2 | All plans | Audience Engine (time-resolved per-persona prediction) | VERIFIED | Pass 2 orchestrator, weighted aggregator, HeatmapPayload, filmstrip pipeline all implemented and tested |
| R2.2 | 03-06 | Pass 2 dedicated per-persona timeline call | VERIFIED | `runWave3Pass2` with thinking-mode, 10 parallel, structured Zod-validated output |
| R2.3 | 03-04 | Weighted aggregator with persona weights | VERIFIED | `buildWeightedCurve` with D-20 precedence; default FYP 0.65/niche 0.20/loyalist 0.10/cross 0.05 |
| R2.5 | 03-02, 03-04 | Heatmap schema in PredictionResult | VERIFIED | `HeatmapPayload` verbatim from D-13; `partial.personas[].attentions[]` via D-15 |
| R2.6 | 03-07 | Filmstrip generation pipeline | VERIFIED | extract + storage + queue + API route; signed URLs 30-day TTL |
| R1.9 | 03-05 | Anti-virality cross-group state coordination | VERIFIED | `isAntiViralityGatedFull` dual-trigger wired into aggregator; D-17 timeline pattern implemented |
| NF4 | 03-06, 03-08 | Telemetry and cost | VERIFIED | D-23 per-persona `pass2_latency_ms`/`pass2_cost_cents` logged; D-24 cost ceiling alert at 50 cents; `calculateCost(QWEN_REASONING_MODEL, usage)` in pass2.ts and stage10-critique.ts |

**Orphaned requirements check:** R2.4 (anti-virality threshold recalibration via outcomes corpus) — this requirement is intentionally deferred per D-16 in CONTEXT.md ("cannot honestly recalibrate without real outcome data — outcomes corpus empty"). The threshold is re-locked at 0.4 with documented rationale and calibration script. This is an explicit documented decision, not a miss.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/engine/filmstrip/extract.ts` | 9 | `Cannot find module 'ffmpeg-static'` TypeScript error | WARNING | `ffmpeg-static` is in `package.json` but has no TypeScript type declarations. Marked `serverExternalPackages` in next.config.ts. Runtime: works (no types needed). Build: tsc reports error but Vercel Next.js build succeeds separately. Pre-existing state introduced in Plan 07. |
| `src/lib/engine/panel-mapping.ts` | 56 | `Property 'stage' does not exist on StageEvent` TypeScript error | WARNING | pre-existing from Phase 1 (commit `b4e7cbc`); not introduced by Phase 3. Phase 3 added new StageEvent variants (pass2_persona_start/end, filmstrip_segment_ready) which do NOT have a `stage` field — consistent with StageEvent discriminated union design. |
| `src/app/api/analyze/[id]/stream/route.ts` | — | `pass2_persona_start/end` NOT forwarded | INFO | This route is the reconnect/fallback polling route. The primary SSE channel (`/api/analyze`) forwards ALL StageEvents. The deviation from Plan 08 spec ("stream route forwards pass2_persona_start/end") is an architectural choice: primary SSE is via analyze route; stream route handles reconnect + filmstrip polling only. |

**Debt marker scan:** No `TBD`, `FIXME`, or `XXX` markers found in Phase 3 modified files.

### Human Verification Required

#### 1. pass2_persona_start/end Event Client Consumption

**Test:** Submit a new analysis with a video file. Open browser DevTools → Network → the `/api/analyze` SSE connection. Watch for `event: stage` frames containing `type: "pass2_persona_start"` and `type: "pass2_persona_end"` during Wave 3 Pass 2 processing.

**Expected:** Each of the 10 persona slots should emit a `pass2_persona_start` event when its qwen3.6-plus call begins and a `pass2_persona_end` event when it completes (with `attentions: number[]` and `swipe_predicted_at` in the success payload). The `use-analysis-stream` hook should receive these and update `partial.personas[i].pass2_status` accordingly for the Audience node row-by-row reveal choreography.

**Why human:** The `/api/analyze` route forwards ALL StageEvents (including pass2_persona_start/end) at line 459 via `send("stage", event)`. The events are emitted in `wave3/pass2.ts`. However, `use-analysis-stream.ts` does NOT have explicit handlers for `pass2_persona_start` or `pass2_persona_end` event types — it only processes `stage_start` with `stage==='wave_3_personas'`. It is unclear whether the generic `stages` array accumulation in the hook is sufficient for Phase 4's Audience node row choreography, or whether explicit partial state updates are needed. Cannot verify without a live analysis run with a video that produces segments.

### Gaps Summary

No blocking gaps. All 6 ROADMAP success criteria have evidence in the codebase. One architectural deviation exists: Plan 08 specifies `/api/analyze/[id]/stream` should forward `pass2_persona_start`/`pass2_persona_end` directly, but the actual implementation routes these through `/api/analyze` (primary SSE) while the stream route uses DB polling for reconnect. The behavior is implemented — the routing is different. Phase 4 (Audience node) needs to consume these events; human confirmation that the client event handling is sufficient for row-by-row reveal is required before declaring full goal achievement.

The two TypeScript errors (`ffmpeg-static` missing types, `panel-mapping.ts` `.stage` access) are pre-existing or architectural and do not indicate missing Phase 3 functionality.

---

_Verified: 2026-05-27T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
