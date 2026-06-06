# Phase 5: Wire + Surface - Research

**Researched:** 2026-06-06
**Domain:** Engine output-contract wiring (Apollo score-finalize) + board surfacing (Next.js 15 / React / Zustand / SSE)
**Confidence:** HIGH (all claims traced to current code at file:line; no reliance on STATE.md/memory for code facts)

## Summary

Phase 5 surfaces the already-optimized 3-call engine (ENGINE_VERSION 3.7.0, ~74s E2E). It is NOT an engine re-optimization. The work splits into one **engine-contract change** (D-01 rubric-sum, which touches the Apollo corpus prompt + output schema + aggregator + a small post-parse compute) and a **board surfacing layer** (D-02 band reuse, D-03 progressive reveal, D-07 surface-time R4 join, D-08 insight-hero + strip dead UI) that is mostly net-new UI reading data that already reaches the DB.

**The single most important finding (D-05 / R11 GATE): YES — creator-baseline data reaches the live engine.** `fetchCreatorContext` runs in the live pipeline (pipeline.ts:402) and returns `follower_count`, `avg_views`, `engagement_rate`, and `platform_averages` (creator.ts:216-240). These are formatted into `creatorContextString` (pipeline.ts:667) and injected into the Apollo/deepseek prompt (pipeline.ts:708). So the *inputs* for a grounded R11 estimate are present today. **However**, no engagement *estimate* is ever computed or persisted — `predicted_engagement` is hard-null'd in the aggregator (aggregator.ts:977). R11 is therefore *buildable* this phase, but it is a genuine new computation (creator baseline × quality read), not a wiring fix. The CONTEXT default lean (a wide, history-relative range) is the right shape.

**Second finding (the largest net-new surface): the Apollo insight — the declared HERO (D-08) — is persisted but NOT rendered anywhere today.** `apollo_reasoning` (rewrites + dimensions + composite_score) reaches the DB via `variants.apollo` (route.ts:173-210) and is on the live `PredictionResult` (aggregator.ts:968), but grep finds zero board components reading `apollo_reasoning`, `rewrites`, or `dimensions`. The entire insight-hero frame (read + 3 rewrites + 6 §-cited dimensions) is new construction. This is the bulk of P5 effort.

**Primary recommendation:** Sequence P5 as: (1) **engine** — D-01 rubric-sum (corpus §4 + ApolloDimensionSchema + deepseek.ts post-parse sum + aggregator), bump ENGINE_VERSION → invalidate cache; (2) **surface** — insight-hero frame reading `apollo_reasoning` with the dual-read (live top-level + permalink `variants.apollo`) pattern copied verbatim from ContentAnalysisFrame.tsx:79-99; (3) **R11** build the grounded estimate (inputs confirmed present); (4) **strip** the dead `predicted_engagement` UI path (results-panel.tsx:160). D-02 band, D-03 progressive reveal, and D-07 heatmap-join all reuse machinery that already exists and is proven.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rubric-sum score derivation (D-01) | API / Engine (`apollo-core.ts` corpus, `deepseek.ts`, `aggregator.ts`) | — | Score is an engine output contract; determinism (temp0+seed) lives in the LLM call layer, not the UI |
| Score band presentation (D-02) | Browser / Client (`verdict-derive.ts`, `VerdictNode.tsx`) | — | Pure derivation from `overall_score`+`confidence`; already client-side |
| Progressive per-frame reveal (D-03) | Browser / Client (`use-analysis-stream.ts`, `panel-mapping.ts`) | API (SSE stage events) | Stage events come from the engine; panel-readiness reduction is client-side |
| Surface-time R4 join (D-07) | Browser / Client (board join of `apollo_reasoning.rewrites` × `heatmap` drop-points) | — | Explicitly a render-layer correlation, NO engine change (protects R6) |
| Insight-hero surface (D-08) | Browser / Client (new frame) + API persist (`variants.apollo`, already done) | — | Data already persisted; only the read/render is missing |
| Grounded engagement R11 | API / Engine (new compute in aggregator) + Browser (range display) | — | Inputs present in `creatorContext`; the multiply/range is a new engine-side derivation |
| Strip dead engagement UI (D-08) | Browser / Client (`results-panel.tsx`) | — | Already null-guarded; removal is pure UI deletion |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R4 | Audience-aware insight: rewrites reference where archetypes drop | **Surface-time (D-07).** `audience-derive.ts` already computes `biggestDrop` + `dropTime` (mm:ss) from `heatmap.segments[].t_start/t_end`. Board joins each `apollo_reasoning.rewrites[]` to the nearest drop-point at render time. No engine change. (audience-derive.ts:99-183) |
| R5 | Honest expert score, rederived from the two brains; confidence; no corpus-percentile | **D-01 rubric-sum.** Score path already = behavioral + apollo composite (aggregator.ts:733-747); Platt/percentile already dropped. P5 changes how `composite_score` is produced (deterministic sum of dimension scores vs holistic ask). |
| R6 | ≤90s E2E | **Protected.** D-07 keeps fold ∥ Apollo parallel; no serialization. 74s baseline (ENGINE_VERSION 3.7.0). No new LLM calls in P5. |
| R7 | ~3 LLM calls | **Unchanged.** P5 adds zero LLM calls. Rubric-sum is a prompt-shape + post-parse arithmetic change to the existing Apollo call. |
| R11 | Grounded engagement estimate | **GATE = YES, buildable.** Inputs (`follower_count`, `avg_views`, `platform_averages`) reach the engine (creator.ts:216-240 → pipeline.ts:667/708). No estimate computed today (`predicted_engagement` null, aggregator.ts:977). New compute. |
| R12 | One brain across modes | Out of active P5 build scope per CONTEXT (Remix re-grounding completed in P3). No P5 task; verify untouched. |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 — De-noise via rubric-sum.** Apollo scores each of its 6 named dimensions (temp0+seed); the 0–100 composite is the **deterministic sum** of those dimension scores — NOT a separately-asked holistic 0–100. Kills the ±5 holistic-guess variance. Touches the Apollo output contract + aggregator blend.
- **D-02 — Present as a directional band + tight range, demoted below the insight.** Reuse `verdict-derive.ts` (`confidenceRange`, `bandLabel`, `bandTone`). Band shows strong/mid/weak + a range (e.g. "78–82"); width should reflect real residual noise. Keep the chess-engine-eval framing.
- **D-03 — Progressive per-frame reveal.** Each board frame paints when its call lands: omni breakdown (~17s) → fold heatmap (~67s) → Apollo score+rewrites (~70s). Score appears exactly once, final (omni produces no score → no shifting-number problem).
- **D-04 — <45s target DROPPED.** Do not pursue. Not a stretch goal. **Do not research latency reduction.**
- **D-05 — Gate R11 on a researcher input-availability check.** If creator-baseline reaches the engine → build estimate = creator baseline × Apollo+fold quality read. If not → remove fake `predicted-engagement` UI + defer real estimate. P5 surfacing does not block on R11 either way.
- **D-06 — R11 output form decided AFTER the researcher reports.** Default lean (if built): a wide, honest range relative to the creator's own history ("8–40k vs your ~15k median"), never a false-precise point.
- **D-07 — R4 satisfied at surface-time, not generation-time.** Keep fold ∥ Apollo PARALLEL (serializing = +50s → ~120s, breaks R6). The board visually correlates each Apollo rewrite with fold's heatmap drop-point ("targets the 0:02 dip"). Awareness rendered, not generated.
- **D-08 — Insight-hero surface set + priority.** Hero = the read + 3 verbatim-grounded rewrites (original struck-through + copyable variants). Then in order: 6 §-cited dimensions → fold retention heatmap → score band (D-02) → flop/anti-virality warning. Strip the dead fake-engagement UI. Insight stays the hero; score never competes for top attention.

### Claude's Discretion
- Skeleton/placeholder loading states per frame during progressive reveal (D-03) — user picked plain progressive; planner/UI may add a light loading affordance.
- Exact band copy, range width formula, and tone thresholds — within the existing `verdict-derive.ts` machinery.

### Deferred Ideas (OUT OF SCOPE)
- Dead keyframe→fold plumbing cleanup (standalone `/gsd-quick`, ~20 min).
- Broader omni-flash validation (music/accented/visual-only — standalone QA).
- <45s engine path (explicitly dropped, D-04).
- True generation-time audience-aware rewrites (fold→Apollo serial) — deferred unless latency budget reopens.
- Real grounded engagement estimate — deferred ONLY if researcher finds baseline input not wired (it IS wired — so this is buildable, not deferred).
- Chat surface — next milestone.
</user_constraints>

## Project Constraints (from CLAUDE.md)

- **Stack:** Next.js 15, TypeScript, Tailwind v4, Supabase. Server components by default; client only when interactive.
- **Raycast design language (verified 2026-02-08):** 6% borders (`white/[0.06]`), 10% hover, 12px card radius, Inter font. Cards `bg-transparent`; card hover `bg-white/[0.02]` only (no translate-y). GlassPanel zero-config (5px blur). Modals = solid opaque, NOT glass.
- **Tailwind v4 known issues:** oklch inaccuracy for L<0.15 (use exact hex); Lightning CSS strips `backdrop-filter` (apply via React inline `style={{ backdropFilter }}`); dev-server CSS caching (clear `.next/` + caches when CSS changes don't appear).
- **Qwen-only pipeline:** no Gemini/DeepSeek models (already true; the `deepseek.ts` / `gemini/` filenames are legacy — the actual models are Qwen, confirmed `QWEN_SEED` at deepseek.ts:395).
- **TDD London (mock-first) for new code; input validation at boundaries; files <500 lines.**
- **Run tests after changes; verify build before commit.** `npm test` (vitest run), `npm run build`, `npm run lint`.
- **Commit format:** `type(phase): description`. Auto-push hook active (verify HEAD).

## Standard Stack

No new packages required. P5 is entirely in-repo wiring + UI on the existing stack.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | (in repo) | Apollo output schema validation (`ApolloDimensionSchema`, `DeepSeekResponseSchema`) | Already the engine's validation boundary |
| @tanstack/react-query | (in repo) | Permalink hydration + polling (`use-analysis-stream.ts`) | Already the board data layer |
| zustand | (in repo) | Board store (`board-store.ts`) | Already the board state layer |
| recharts | (in repo) | RetentionChart heatmap | Already rendering the retention curve |

**Installation:** none.

**Version verification:** `vitest@^4.0.18`, `@vitest/coverage-v8@^4.0.18` confirmed in package.json. No registry installs in this phase, so the Package Legitimacy Audit is N/A.

## Package Legitimacy Audit

**N/A — Phase 5 installs zero external packages.** All work is in-repo wiring + UI on already-installed dependencies. No slopcheck/registry verification required.

## Architecture Patterns

### System Architecture Diagram

```
                      ┌─────────────────────────────────────────────────────┐
  video_upload  ──▶   │  PIPELINE (pipeline.ts) — ENGINE_VERSION 3.7.0       │
                      │                                                       │
                      │  Omni (qwen omni-flash ~17s) ── observer/transcriber  │
                      │     │  emits: segments, verbatim, emotion_arc         │
                      │     │  NO score                                       │
                      │     ▼                                                 │
                      │  creatorContext (fetchCreatorContext, pipeline.ts:402)│
                      │     follower_count / avg_views / platform_averages ───┼──▶ [R11 inputs PRESENT]
                      │     │  formatCreatorContext → creatorContextString    │
                      │     ▼                                                 │
                      │  ┌──────────────── PARALLEL (keep, D-07) ───────────┐ │
                      │  │ Apollo/deepseek (~53s)      fold (~50s)          │ │
                      │  │  composite_score             per-archetype       │ │
                      │  │  dimensions[6] (band only)   × per-segment        │ │
                      │  │  rewrites[2-3]               → heatmap            │ │
                      │  └──────────────────────────────────────────────────┘ │
                      │     ▼                                                 │
                      │  aggregator.aggregateScores (aggregator.ts:378)       │
                      │   overall_score = behavioral*w + apollo_composite*w   │
                      │   apollo_reasoning = {rewrites, dimensions, composite} │
                      │   predicted_engagement = null  ◀── [R11 NOT computed]  │
                      └──────────────────────────┬──────────────────────────┘
                                                 │
              ┌──── SSE stage events ────────────┤────── persist ──────┐
              ▼                                   ▼                     ▼
   use-analysis-stream.ts                PredictionResult       analysis_results row
   { result, stages, panelReady }        (live, top-level       columns + variants.apollo
   panelReadyFromStages()                 apollo_reasoning)      (route.ts:173-210)
              │                                   │                     │
              ▼                                   ▼                     ▼
   ┌──────────────────────── BOARD (progressive reveal, D-03) ──────────────────────┐
   │  VerdictNode (score band — D-02, uses confidenceRange/bandLabel/bandTone) ✅live │
   │  AudienceNode/RetentionChart (heatmap, drop-points) ✅ live                      │
   │  ContentAnalysisFrame (craft) ✅ live — DUAL-READ TEMPLATE for apollo            │
   │  ── INSIGHT-HERO FRAME (read + 3 rewrites + 6 dims) ⛔ NET-NEW, nothing reads it  │
   │  ── R11 range display ⛔ NET-NEW                                                  │
   │  results-panel TikTokResultCard (predicted_engagement) ⛔ DEAD, strip (D-08)     │
   └────────────────────────────────────────────────────────────────────────────────┘
```

### Pattern 1: Dual-read live-vs-persisted (THE template for the insight-hero)
**What:** The live SSE `PredictionResult` carries fields at the top level; the permalink-reload DB row nests the same data under `variants.<key>`. Read BOTH defensively.
**When to use:** Any frame surfacing `apollo_reasoning` (insight-hero). This is the exact regression class that bit the craft frame (regression WPk976kozfWs) and the emotion_arc/verbatim assembly-hop.
**Example (copy this verbatim for apollo):**
```typescript
// Source: src/components/board/content-analysis/ContentAnalysisFrame.tsx:79-99
const craft = useMemo<CraftSignals>(() => {
  const v = row?.variants?.craft ?? {};
  return {
    ...EMPTY_CRAFT,
    ...v,
    video_signals: v.video_signals ?? row?.video_signals ?? null,
    // ...each field: variants.<key> ?? top-level ?? null
  };
}, [row?.variants?.craft, row?.video_signals, /* ... */]);
```
For the insight-hero: `const apollo = row?.variants?.apollo ?? (row as PredictionResult)?.apollo_reasoning ?? null;`

### Pattern 2: Score band derivation (D-02 — already live, just reuse)
**What:** `confidenceRange(score, confidence)` → `{lo, hi}`; `bandLabel(score)`; `bandTone(score)`. Pure functions.
**When to use:** The demoted score band beneath the insight. Already wired in VerdictNode.tsx:14-16, 208-217.
**Example:**
```typescript
// Source: src/components/board/verdict/verdict-derive.ts:19-23
export function confidenceRange(score: number, confidence: number): ConfidenceRange {
  const c = Number.isFinite(confidence) ? clamp(confidence, 0, 1) : 0.5;
  const half = clamp(Math.round((1 - c) * 22), 3, 22); // tight band when confident
  return { lo: Math.max(0, score - half), hi: Math.min(100, score + half) };
}
```
**D-02 band-width note:** range width is driven by `confidence` (0-1), NOT directly by score noise. Rubric-sum (D-01) shrinks the *score* jitter; to shrink the *band*, the rubric-sum determinism should raise confidence (higher when dimensions agree). The `half` formula already maps high confidence → 3-point band. No new banding code needed; the discretion is the width formula / thresholds.

### Pattern 3: Surface-time R4 heatmap join (D-07 — no engine change)
**What:** Each `apollo_reasoning.rewrites[]` is labelled with the nearest fold heatmap drop-point at render time.
**Join point:** `audience-derive.ts` already exposes `biggestDrop` (segment index + delta), `dropTime` (mm:ss string), and per-segment `t_start`/`t_end`. The insight-hero frame imports these and labels a rewrite "targets the 0:02 dip" by mapping the rewrite to the drop segment.
**Example:**
```typescript
// Source: src/components/board/audience/audience-derive.ts:99-122, 142-183
// biggestDrop(curve) → { index, delta, fromIndex }
// dropTime + segment[drop.index].t_start → "0:02"
```
The simplest honest join: attach the single biggest-drop timestamp to the rewrite that addresses retention (`lever_fixed` referencing §2.2). The planner decides whether to map all 3 rewrites or just the retention-lever one.

### Pattern 4: Progressive per-frame reveal (D-03 — infrastructure exists, needs an apollo panel)
**What:** `panelReadyFromStages(stages)` reduces SSE `stage_start`/`stage_end` events into per-panel `idle|loading|ready|error`.
**Gap:** `STAGE_TO_PANEL` (panel-mapping.ts:32-37) maps `wave_2 → ["reasoning"]` but there is no `"insight_hero"` panel id, and the live stage name for Apollo is `deepseek_reasoning` / `wave_2`. The planner must add a panel id for the insight-hero and map it to the Apollo stage so it paints when Apollo lands (~70s). The reveal mechanism itself is built and tested.

### Anti-Patterns to Avoid
- **Adding a new top-level DB column for apollo dimension scores.** `apollo_reasoning` already persists via `variants.apollo` (read-merge-write, route.ts:198). Add the new numeric dimension score INSIDE the existing `ApolloDimensionSchema` so it flows through the existing persist path — do NOT create a parallel column (that's the assembly-hop null trap).
- **Serializing fold → Apollo for "real" audience-aware rewrites.** Explicitly rejected (D-07): +50s breaks R6. The join is render-only.
- **Reading `apollo_reasoning` only at the top level.** On permalink reload it is `null` there — it lives in `variants.apollo`. Dual-read or the hero blanks on reload.
- **Re-asking the LLM for a holistic composite after rubric-sum.** D-01's entire point is that the composite becomes arithmetic; the corpus §4 currently says the opposite ("do NOT present the composite as arithmetic", apollo-core.ts:190) — that line must be inverted.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Score band / range / tone | New banding component | `verdict-derive.ts` (`confidenceRange`/`bandLabel`/`bandTone`) | Already live + tested in VerdictNode |
| Live-vs-permalink hydration | New fetch logic | ContentAnalysisFrame dual-read pattern + `usePermalinkAnalysis` + `useAnalysisStream` | Proven; the naive single-read is a known regression |
| Heatmap drop-point math | New drop detection | `audience-derive.ts` `biggestDrop`/`dropTime` | Already computes mm:ss drop points |
| Per-frame reveal | New streaming reducer | `panelReadyFromStages` + `STAGE_TO_PANEL` | Built + tested; just add a panel id |
| Apollo persist | New DB write | `persistApolloToVariants` (route.ts:173) | Already read-merge-writes `variants.apollo` with V4 access control |
| Rewrite verbatim grounding | New verbatim-match | `deepseek.ts` post-parse R2 backstop (deepseek.ts:156-168) | Already overwrites `rewrite.original` from the verbatim hook on mismatch |

**Key insight:** Almost every primitive P5 needs already exists. The genuinely new work is (a) the rubric-sum arithmetic in the engine contract, (b) the insight-hero frame component that reads `apollo_reasoning`, and (c) the R11 estimate compute. Everything else is reuse.

## Critical Question Answers (the binding research outputs)

### Q1 — D-05 / R11 GATE: Does creator-baseline reach the engine? **YES.**

**Evidence (definitive):**
- `fetchCreatorContext(supabase, payload.creator_handle, payload.niche)` is called in the **live** pipeline: pipeline.ts:402 (inside `pre_creator_context` stage, threaded forward as `creatorContext`).
- It returns real baseline data: `follower_count: profile.tiktok_followers`, `engagement_rate`, `platform_averages` (avg_views, avg_engagement_rate, avg_share_rate, avg_comment_rate computed from `scraped_videos`) — creator.ts:216-240 + getPlatformAverages creator.ts:61-122.
- `avg_views` is currently always `null` for the found-creator path (creator.ts:219 — "Could be computed from scraped_videos by author in the future"), BUT `platform_averages.avg_views` is real (creator.ts:113-118) and `follower_count` is real when the creator profile exists.
- This context is formatted (`formatCreatorContext`, creator.ts:262 → includes follower count + platform avg views, lines 267/288) into `creatorContextString` (pipeline.ts:667) and **injected into the Apollo prompt** (`creator_context: creatorContextString`, pipeline.ts:708).

**What is NOT present:** No engagement-estimate computation anywhere. `predicted_engagement` is hard-set to `null` in the aggregator (aggregator.ts:977: `predicted_engagement: null, // sine-jitter fabrication deleted; field null until Plan 05 regrounding`) and is nullable on the type (types.ts:265).

**Verdict:** R11 is **BUILDABLE this phase** (the gate resolves YES). It is a genuine new computation — anchor = `creatorContext.follower_count` (and/or `platform_averages.avg_views`) × the quality read (overall_score / behavioral). The CONTEXT default lean (a wide history-relative range, D-06) is correct. **Caveat to flag for planning:** the per-creator `avg_views` is null today (only platform avg + follower_count are real for a found creator), so the "vs your ~15k median" framing needs the anchor to be `follower_count`-derived or the planner must decide to compute per-creator avg_views from `scraped_videos` (a small new query). The R11 verify ("two creators of different follower tiers get materially different estimates") is satisfiable via `follower_count` even without per-creator avg_views.

**The fake UI to strip regardless** (D-08): `results-panel.tsx:160` renders `<TikTokResultCard engagement={result.predicted_engagement}>` gated on `{result.predicted_engagement && ...}`. Since the field is now always `null` (aggregator.ts:977), the card never renders. The null-anticipating test already exists: `results-panel.predicted-engagement-null.test.tsx` (asserts the card does NOT render when null). Stripping = remove the dead JSX block (results-panel.tsx:159-166) + `TikTokResultCard` import. If R11 is built, this slot is *replaced* by the new range display rather than just deleted.

### Q2 — D-01 rubric-sum: current Apollo output schema + what changes.

**Current schema (types.ts:756-792):**
- `ApolloDimensionSchema` = `{ name (enum 6: hook/retention/clarity/share_pull/substance/credibility), band: "strong"|"mid"|"weak", lever: string, evidence: string }`. **NO numeric per-dimension score.**
- `composite_score: z.number().min(0).max(100)` is a SEPARATE field the LLM emits.
- Corpus §4 (apollo-core.ts:188-190) explicitly instructs: grade each dimension on the 3-band scale "**not** a 0–100 per dimension", and "Give **one composite 0–100**: a holistic, hook-weighted judgment ... do **not** present the composite as arithmetic — it is a weighted judgment, not a sum of parts." **This holistic ask is the ±5 noise source.**

**Current composite flow:** `apollo_score = deepseek.composite_score` (aggregator.ts:726) → `raw_overall_score = round(behavioral_score * w.behavioral + apollo_score * w.apollo)` (aggregator.ts:733-742, weights ≈0.533/0.467) → `overall_score = raw_overall_score` (aggregator.ts:747, no calibration). The fold-behavioral term is `behavioral_score = round(mean(7 component_scores) * 10)` (aggregator.ts:695-708).

**What D-01 changes (the full threading — mind the assembly-hop):**
1. **Corpus §4 (apollo-core.ts:173, 189-190):** invert the instruction — each dimension gets a numeric score; composite is their (hook-weighted) deterministic sum. Hook keeps ~80% weight (apollo-core.ts:184) → the sum should be a weighted sum, not flat.
2. **`ApolloDimensionSchema` (types.ts:756-761):** add a numeric `score` field (e.g. `z.number().min(0).max(N)`). Keep `band` for display or derive band from score.
3. **`deepseek.ts` post-parse backstop (deepseek.ts:141-168):** compute `composite_score` as the deterministic (weighted) sum of `data.dimensions[].score` and OVERWRITE the LLM's emitted composite — making it byte-deterministic given fixed dimension scores. The existing clamp (deepseek.ts:149) stays.
4. **Aggregator (aggregator.ts:726):** no change needed — it already reads `deepseek.composite_score`; the value is now a sum.
5. **Persist (route.ts:198):** no change — `apollo_reasoning` (incl. new dimension scores) already flows through `variants.apollo`.
6. **Board:** the insight-hero reads the per-dimension scores for the "6 §-cited dimensions" display (D-08).

**Determinism note:** temp:0 + seed already live (deepseek.ts:394-395 `temperature: 0, seed: QWEN_SEED`). The ±5 swing is provider nondeterminism on the *holistic composite ask*, not on the deterministic-sum arithmetic. Banded dimension grades are coarser (3 bands) → if D-01 maps band→score (Strong/Mid/Weak → fixed points), the sum is fully deterministic; if it asks numeric per-dimension scores, residual provider noise persists per dimension but averages out across 6 + the sum is structural. **Recommendation:** map the 3-band grade to fixed numeric anchors per dimension (deterministic), weighted by hook ~80% — this is the most aggressive de-noise and matches the banked P3 "composite of named dimensions" principle. Flag for planner: decide band→fixed-score vs numeric-per-dimension (the former is fully deterministic; the latter keeps granularity but some noise).

### Q3 — D-02 score band: reuse surface + signatures.

**Confirmed live (VerdictNode.tsx:14-16, 208-217):**
- `confidenceRange(score: number, confidence: number): { lo, hi }` — verdict-derive.ts:19-23. Width = `clamp(round((1-confidence)*22), 3, 22)`.
- `bandLabel(score: number): string` — verdict-derive.ts:25-29 ("High potential" ≥70 / "Solid contender" ≥40 / "Needs work").
- `bandTone(score: number): ScoreTone` — verdict-derive.ts:105-109 (good ≥70 / warn ≥40 / crit).

**Band-width ↔ residual noise mapping:** the band is a function of `confidence`, not raw score variance. Rubric-sum (D-01) reduces score jitter; to make the band *tighter*, the determinism must raise `confidence`. The `calculateConfidence` agreement term (aggregator.ts:226-242) already rises when apollo and behavioral agree on direction — a deterministic composite that agrees more consistently with behavioral will naturally tighten the band. No banding code change required; the Claude's-discretion items (copy/width formula/thresholds) live entirely inside `verdict-derive.ts`.

### Q4 — D-07 surface-time R4: rewrite output + heatmap shapes + join point.

**Apollo `rewrites` shape (types.ts:770-776):** `{ original: string (verbatim hook), variant: string, lever_fixed: string (the §2 lever — different per rewrite, D-08) }`. 2–3 of them.
**Fold heatmap shape (types.ts:41-79):** `HeatmapPayload.segments[]` = `{ idx, t_start, t_end, label?, is_hook_zone, keyframe_uri }`; `weighted_curve: number[]`; plus persona attentions + `swipe_predicted_at`.
**Join machinery (already built, audience-derive.ts):** `biggestDrop(curve)` → `{ index, delta, fromIndex }` (lines 99-122); `dropTime`/`formatTime` → mm:ss (lines 142-183); `totalDuration` from last segment `t_end` (lines 133-136).
**Join point + feasibility:** YES, the board can join with NO engine change. The insight-hero frame imports `HeatmapPayload` (from `result.heatmap` / `variants` heatmap mirror) + the audience-derive drop helpers, computes the biggest-drop mm:ss, and labels the retention-lever rewrite "targets the 0:02 dip". The `lever_fixed` field tells which rewrite addresses retention (§2.2) so the label attaches to the right one.

### Q5 — D-03 progressive reveal + D-08 surface set: what exists vs new.

**Exists:**
- SSE streaming + `panelReadyFromStages` per-panel readiness reducer (panel-mapping.ts:50-71), consumed by `use-analysis-stream.ts:159-166`.
- `STAGE_TO_PANEL` maps stages→panels (panel-mapping.ts:32-37): `wave_1→[hook_decomp, similar_videos, emotion_arc]`, `wave_2→[reasoning]`, `wave_3_personas→[retention, persona_breakdown]`, `aggregator→[verdict,...]`.
- VerdictNode (score band) ✅ live; AudienceNode/RetentionChart (heatmap) ✅ live; ContentAnalysisFrame (craft) ✅ live.
- Omni produces no score → no shifting-number problem (D-03 premise confirmed: `overall_score` only computed in aggregator at the end).

**New:**
- **The insight-hero frame itself** — read + 3 rewrites (struck-through original + copyable variants) + 6 §-cited dimensions. **Nothing reads `apollo_reasoning` today** (grep: zero board consumers). This is the bulk of the build.
- A panel id for the insight-hero in `PANEL_IDS` + a `STAGE_TO_PANEL` entry mapping the Apollo stage (`wave_2` / `deepseek_reasoning`) so it paints at ~70s.
- Copyable-variant UI (clipboard) for the rewrites.
- Dual-read hydration for `apollo_reasoning` (live top-level + `variants.apollo`).

### Q6 — D-08 strip dead fake-engagement UI: confirmed dead + safe.

- `results-panel.tsx:159-166` — `{result.predicted_engagement && <TikTokResultCard engagement={...} />}`. Field is always `null` (aggregator.ts:977) → never renders.
- Null test exists: `results-panel.predicted-engagement-null.test.tsx` (3 cases — does NOT render when null/absent; renders when present). After strip, the "renders when present" case becomes dead (no path sets it) — the planner should either delete that case or repurpose the test for the R11 range component.
- Safe to remove the JSX block + `TikTokResultCard` import. If R11 is built, replace this slot with the range display.

## Runtime State Inventory

> P5 is a wiring + surfacing phase. It changes an output contract (D-01 dimension score) and adds UI. The relevant "runtime state" risk is the **cache** and the **persisted JSONB shape**, not OS/secrets.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `analysis_results.variants.apollo` JSONB already stores `apollo_reasoning` (route.ts:198). Adding a numeric dimension `score` (D-01) extends this nested shape — old rows lack it. | Code: render defensively (dimension score optional on read; old rows show band only). No data migration needed — new field is additive in JSONB. |
| Live service config | Prediction cache (L1 in-mem 24h + L2 Supabase 24h) keyed on `hash::ENGINE_VERSION::userId` (ENGINE-MAP S0). D-01 changes the score for the same video. | **MUST bump `ENGINE_VERSION`** (version.ts:26, currently "3.7.0") so D-01 scores don't serve stale 3.7.0 cached results. The bump auto-invalidates (version.ts:23 D-23 invariant). |
| OS-registered state | None — no Task Scheduler / pm2 / systemd state references the engine output contract. | None — verified by grep (no OS-registration code in scope). |
| Secrets/env vars | `QWEN_SEED` (deepseek.ts:395) governs determinism — unchanged by D-01. No new secrets. | None. |
| Build artifacts | None — no compiled binaries / egg-info; standard Next.js build. | `npm run build` after changes (CLAUDE.md), clear `.next/` if CSS doesn't appear (Tailwind v4 caching note). |

**Nothing found in OS-registered / secrets / build-artifact categories beyond the standard build.** The one mandatory action: **bump ENGINE_VERSION** when D-01 lands (else cached pre-rubric-sum scores serve).

## Common Pitfalls

### Pitfall 1: The assembly-hop null (new dimension score dies before the DB)
**What goes wrong:** A new field (D-01 numeric dimension score) is added to the schema + prompt but dropped somewhere in `Apollo → deepseek.ts → aggregator apollo_reasoning → route variants.apollo → board read`, so it nulls in the DB / blanks on the board.
**Why it happens:** The engine has a documented recurring regression (emotion_arc, verbatim per-segment, craft signals) where a field is declared+prompted but not threaded the whole way. STATE.md:109 + CONTEXT code_context call this out explicitly.
**How to avoid:** Add the score field INSIDE `ApolloDimensionSchema` (types.ts:756) so it rides the existing `dimensions` array that already persists. Verify on a real run that `variants.apollo.dimensions[].score` is non-null in the DB row.
**Warning signs:** Dimension scores render on the live board but vanish on permalink reload (= persisted but not read) OR vanish everywhere (= not threaded to DB).

### Pitfall 2: Apollo insight blanks on permalink reload (top-level-only read)
**What goes wrong:** Insight-hero reads `result.apollo_reasoning`; works on fresh SSE, blank on `/analyze/[id]` reload because the row nests it under `variants.apollo`.
**Why it happens:** Live `PredictionResult` has it top-level (aggregator.ts:968); permalink row has it under `variants.apollo` (route.ts:198). The permalink path sets `result = permalinkRow` directly (use-analysis-stream.ts:520).
**How to avoid:** Dual-read exactly like ContentAnalysisFrame.tsx:79-99. This is regression WPk976kozfWs replayed for apollo.
**Warning signs:** Hero shows on first analysis, gone after refresh / shared link.

### Pitfall 3: Cache serves stale pre-D-01 scores
**What goes wrong:** D-01 changes the score derivation but the cache key is unchanged → users get old 3.7.0 holistic scores.
**How to avoid:** Bump `ENGINE_VERSION` (version.ts:26). Non-negotiable per the D-23 cache invariant (version.ts:23).
**Warning signs:** Score still swings ±5 on identical input after D-01 ships (= cache hit on old result).

### Pitfall 4: Serializing fold→Apollo to make R4 "real"
**What goes wrong:** A well-meaning attempt to feed the heatmap into Apollo at generation time adds ~50s → breaks R6.
**How to avoid:** D-07 is render-only. Keep the parallel graph (pipeline.ts: deepseekPromise kicked off ~727, fold runs ~767, `await wave2Promise` ~806). The join is in the board.
**Warning signs:** E2E creeps toward 120s; `scripts/measure-pipeline.ts` shows fold and deepseek no longer overlapping.

### Pitfall 5: Inverting corpus §4 incompletely
**What goes wrong:** The schema gets a numeric dimension score but the corpus §4 still says "do not present the composite as arithmetic" (apollo-core.ts:190) → the LLM emits inconsistent dimension scores vs composite.
**How to avoid:** Edit apollo-core.ts §4 (lines 173, 188-190) AND the schema AND the deepseek.ts post-parse sum together, in one plan, with a determinism re-check (same video twice → identical composite).
**Warning signs:** `composite_score` ≠ sum of dimension scores on inspection.

## Code Examples

### Apollo output contract — where D-01 lands
```typescript
// Source: src/lib/engine/types.ts:756-792 (CURRENT — band only, holistic composite)
export const ApolloDimensionSchema = z.object({
  name: z.enum(["hook","retention","clarity","share_pull","substance","credibility"]),
  band: z.enum(["strong","mid","weak"]),   // D-01: add numeric `score` here
  lever: z.string().min(1),
  evidence: z.string().min(1),
});
// composite_score: z.number().min(0).max(100)  // D-01: becomes deterministic sum
```

### Post-parse is where the deterministic sum belongs
```typescript
// Source: src/lib/engine/deepseek.ts:141-168 (existing backstop block)
// D-01 add: data.composite_score = weightedSum(data.dimensions, HOOK_WEIGHT≈0.8);
// then the existing clamp at :149 keeps it in [0,100].
data.composite_score = Math.min(100, Math.max(0, data.composite_score));
```

### Composite → overall_score (no change needed; reads the sum)
```typescript
// Source: src/lib/engine/aggregator.ts:726, 733-747
const apollo_score = deepseek?.composite_score ?? 0;             // now a sum
const raw_overall_score = Math.min(100, Math.max(0, Math.round(
  behavioral_score * weights.behavioral + apollo_score * weights.apollo)));
const overall_score = raw_overall_score;                         // no calibration
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Holistic 0–100 composite asked of the LLM | (P5 D-01) deterministic sum of 6 dimension scores | this phase | kills ±5 swing on identical input |
| `predicted_engagement` = f(score)+sine jitter | null today (P1 deleted it); (P5) grounded range from creator baseline | P1 → P5 | honest engagement estimate |
| 7-source weighted blend | behavioral + apollo composite (2 terms) | P3-04 | already done; P5 only changes how apollo composite is produced |

**Deprecated/outdated:**
- `apollo-core.ts:190` "do not present the composite as arithmetic" — to be inverted by D-01.
- `results-panel.tsx:159-166` predicted_engagement card — dead, strip (D-08).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Mapping the 3-band dimension grade to fixed numeric anchors (vs asking numeric per-dimension scores) is the better de-noise route | Q2 / D-01 | Low — both satisfy D-01; planner decides. Fixed-anchor is fully deterministic; numeric keeps granularity with residual noise. Flagged for the planner. |
| A2 | `follower_count` alone suffices for the R11 "different tiers → different estimates" verify (per-creator `avg_views` is null today) | Q1 / R11 | Medium — if the user wants the "vs your ~15k median" exact framing, a new per-creator avg-views query from `scraped_videos` is needed. Confirm scope with user before building. |
| A3 | The biggest-drop timestamp attaches to the retention-lever rewrite (via `lever_fixed` §2.2) for the D-07 label | Q4 / D-07 | Low — UI decision; planner may map all 3 rewrites or just one. |

## Open Questions

1. **R11 anchor: `follower_count` vs computed per-creator `avg_views`?**
   - What we know: `follower_count` + `platform_averages.avg_views` are live; per-creator `avg_views` is null (creator.ts:219).
   - What's unclear: whether the user wants the exact "vs your ~15k median" (needs per-creator history) or a follower-tier-based range is acceptable.
   - Recommendation: build the range off `follower_count` × quality read first (satisfies R11 verify); add per-creator avg-views as a follow-up only if the user insists on the median framing. **Confirm with user during planning.**

2. **D-01 dimension scoring: fixed band→score anchors vs numeric per-dimension?**
   - What we know: both satisfy "composite = sum of dimensions"; band→fixed-anchor is fully deterministic.
   - Recommendation: band→fixed weighted anchors (most de-noise). Planner/user to confirm.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node/Next.js/TS build | all | ✓ | Next.js 15 (in repo) | — |
| vitest | validation | ✓ | 4.0.18 | — |
| Supabase (analysis_results, creator_profiles, scraped_videos) | R11 inputs, persist | ✓ (live, used by pipeline) | — | — |
| `scripts/measure-pipeline.ts` | R6 E2E re-check | ✓ (referenced in HANDOFF) | — | — |
| Qwen API (omni/plus/flash) | engine run for real-run verify | ✓ (live engine 3.7.0) | — | — |

**No missing dependencies.** P5 needs no new tools; the engine and DB are live.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 |
| Config file | vitest config present (package.json `test: vitest run`) |
| Quick run command | `npx vitest run <path>` (single file) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R5/D-01 | composite_score == deterministic (weighted) sum of dimension scores | unit | `npx vitest run src/lib/engine/__tests__/deepseek*.test.ts` | ❌ Wave 0 (new — assert sum identity + 6 dims + score field) |
| R8/D-01 | same video twice → identical composite (rubric-sum determinism) | unit | `npx vitest run <new determinism test>` | ❌ Wave 0 |
| R5/D-01 | schema accepts dimension `score`; old rows (band-only) still parse on read | unit | `npx vitest run src/lib/engine/__tests__/*types*` | ❌ Wave 0 |
| (threading) | `apollo_reasoning.dimensions[].score` survives aggregator→persist (assembly-hop guard) | unit | aggregator test asserting non-null on the new field | ❌ Wave 0 |
| D-02 | band/range render from overall_score+confidence | unit | `npx vitest run src/components/board/verdict/__tests__/*` | ✅ (VerdictNode tests exist) |
| D-08 strip | TikTokResultCard never renders (predicted_engagement null) | unit | `npx vitest run src/components/app/simulation/__tests__/results-panel.predicted-engagement-null.test.tsx` | ✅ (exists; update after strip) |
| D-08 hero | insight-hero renders rewrites + dims from live result AND permalink variants.apollo | unit | new frame test, dual-read fixture | ❌ Wave 0 |
| D-07 | a rewrite is labelled with the heatmap biggest-drop mm:ss | unit | new join test | ❌ Wave 0 |
| R11 | two creators of different follower tiers → materially different range; output is a range not a point | unit | new aggregator/estimate test | ❌ Wave 0 (only if R11 built) |
| R6 | E2E ≤90s, fold ∥ Apollo unchanged | integration/manual | `scripts/measure-pipeline.ts <video>` | ✅ harness exists (human/live) |

### Sampling Rate
- **Per task commit:** the single relevant `npx vitest run <file>` (quick).
- **Per wave merge:** `npm test` (full suite — engine has ~900+ tests; threading regressions surface here).
- **Phase gate:** full suite green + one real video run proving `variants.apollo.dimensions[].score` non-null in the DB + insight-hero renders on both fresh + permalink + `measure-pipeline.ts` ≤90s.

### Wave 0 Gaps
- [ ] `deepseek*.test.ts` — composite == weighted sum of dimension scores; determinism (same input twice); 6 dims with score
- [ ] aggregator threading test — `apollo_reasoning.dimensions[].score` non-null end-to-end
- [ ] insight-hero frame test — dual-read (live top-level + `variants.apollo`), rewrites struck-through + copyable, 6 dims, drop-point label (D-07)
- [ ] R11 estimate test (only if built) — tier-sensitivity + range-not-point
- [ ] update `results-panel.predicted-engagement-null.test.tsx` after strip (remove/repurpose the "renders when present" case)

## Security Domain

> `security_enforcement` not explicitly set false → included. P5 surfaces existing data + a new estimate; the threat surface is input validation on the new schema field + preserving the existing access-control on persist.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | unchanged — analyze route already authed |
| V3 Session Management | no | unchanged |
| V4 Access Control | yes | `persistApolloToVariants` already enforces `.eq("user_id")` on read AND write (route.ts:189, 200, T-03-10). New dimension score rides the same persist — preserve the user-id guards; do NOT add a new write path that bypasses them. |
| V5 Input Validation | yes | New `score` field MUST be zod-bounded in `ApolloDimensionSchema` (min/max). LLM output is untrusted — the existing post-parse clamp pattern (deepseek.ts:149) applies. Creator pain_points/reference_creators already prompt-sanitized (creator.ts:252, WR-08 delimiters) — unchanged. |
| V6 Cryptography | no | none |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| LLM emits out-of-range dimension score → bad composite | Tampering | zod `.min().max()` on the new field + post-parse clamp (deepseek.ts pattern) |
| Cross-user write of `variants.apollo` | Elevation/Info-disclosure | existing `.eq("user_id")` on read+write (route.ts) — preserve |
| Prompt injection via creator_context (follower/pain_points feeding R11) | Tampering | already wrapped in `<<<USER_CONTENT>>>` delimiters + sentinel strip (creator.ts:330-371) — R11 must not un-wrap |
| Stale cache serving pre-D-01 score | Tampering (integrity) | bump ENGINE_VERSION (version.ts:26) |

## Sources

### Primary (HIGH confidence — current code, this session)
- `src/lib/engine/creator.ts:61-374` — fetchCreatorContext, follower_count/avg_views/platform_averages, formatCreatorContext (R11 gate)
- `src/lib/engine/pipeline.ts:395-855` — live wiring: creator fetch :402, creatorContextString :667, deepseek injection :708, fold ∥ deepseek parallelism :727/:767/:806
- `src/lib/engine/types.ts:251-410, 756-792` — PredictionResult, apollo_reasoning, ApolloDimensionSchema (band-only), composite_score, predicted_engagement nullable
- `src/lib/engine/aggregator.ts:695-747, 968-977` — behavioral+apollo blend, apollo_reasoning assembly, predicted_engagement:null
- `src/lib/engine/apollo-core.ts:171-219` — §4 scoring rubric (holistic composite instruction to invert), §6 rewrites
- `src/lib/engine/deepseek.ts:141-168, 385-395` — post-parse R2 backstop (D-01 sum site), temp0+seed
- `src/app/api/analyze/route.ts:160-210` — persistApolloToVariants (variants.apollo, V4 access control)
- `src/components/board/verdict/verdict-derive.ts:19-117` — confidenceRange/bandLabel/bandTone (D-02 reuse)
- `src/components/board/verdict/VerdictNode.tsx:14-228` — band already wired
- `src/components/board/content-analysis/ContentAnalysisFrame.tsx:35-99` — dual-read live-vs-permalink template
- `src/components/board/audience/audience-derive.ts:99-183` — biggestDrop/dropTime (D-07 join)
- `src/components/app/simulation/results-panel.tsx:159-166` + `__tests__/results-panel.predicted-engagement-null.test.tsx` — D-08 strip target + test
- `src/hooks/queries/use-analysis-stream.ts:159-166, 491-553` — panelReady, permalink hydration
- `src/lib/engine/panel-mapping.ts:10-71` — STAGE_TO_PANEL, panelReadyFromStages (D-03 infra; no apollo panel yet)
- `src/lib/engine/version.ts:23-26` — ENGINE_VERSION 3.7.0, cache invariant

### Secondary (context — verified against code)
- `.planning/phases/05-wire-surface/05-CONTEXT.md` — decisions D-01..D-08
- `.planning/REQUIREMENTS.md` — R4-R12
- `.planning/ENGINE-MAP.md`, `.planning/STATE.md`, `.planning/HANDOFF-phase5.md` — engine state (cross-checked against code; STATE prefix verified)

## Metadata

**Confidence breakdown:**
- D-05/R11 gate (YES): HIGH — traced fetchCreatorContext → creatorContextString → deepseek injection at file:line.
- D-01 schema/composite path: HIGH — ApolloDimensionSchema (band-only) + holistic composite ask + post-parse site all read directly.
- D-02 reuse surface: HIGH — functions live + already consumed in VerdictNode.
- D-07 join feasibility: HIGH — both shapes + drop-point helpers exist.
- D-03/D-08 surface gaps: HIGH — grep confirms zero apollo_reasoning board consumers.
- Architecture: HIGH.
- Pitfalls: HIGH — drawn from documented prior regressions (emotion_arc/verbatim/craft assembly-hop, WPk976kozfWs permalink).

**Research date:** 2026-06-06
**Valid until:** 2026-07-06 (stable in-repo domain; re-verify if the engine output contract or board data layer is refactored before P5 executes)

## RESEARCH COMPLETE

**Phase:** 5 - Wire + Surface
**Confidence:** HIGH

### Key Findings
- **D-05/R11 GATE = YES.** Creator-baseline (`follower_count`, `avg_views`, `platform_averages`) reaches the live engine (creator.ts:216-240 → pipeline.ts:667/708). No estimate computed today (`predicted_engagement` null, aggregator.ts:977). R11 is **buildable**, a genuine new compute. Strip the dead UI (results-panel.tsx:160) regardless; replace with the range if built.
- **The declared HERO is not surfaced.** `apollo_reasoning` (rewrites + dimensions + composite) persists to `variants.apollo` (route.ts:198) but ZERO board components read it. The insight-hero frame is the largest net-new P5 build.
- **D-01 is a real contract change, not a wiring fix.** `ApolloDimensionSchema` has band only (no numeric score); corpus §4 instructs a holistic composite ("not a sum") — that line must be inverted; sum belongs in the deepseek.ts post-parse backstop. temp0+seed already live.
- **D-02 / D-03 / D-07 reuse proven machinery.** Band (`confidenceRange`/`bandLabel`/`bandTone`) already wired in VerdictNode; progressive reveal (`panelReadyFromStages`) built (needs an apollo panel id); heatmap drop-point helpers exist in audience-derive.
- **MUST bump ENGINE_VERSION** (version.ts:26) when D-01 lands or stale 3.7.0 scores serve from cache.

### File Created
`.planning/phases/05-wire-surface/05-RESEARCH.md`

### Ready for Planning
Research complete. The planner can sequence: (1) D-01 engine contract + ENGINE_VERSION bump, (2) insight-hero frame (dual-read), (3) R11 estimate (confirm anchor scope with user — Open Q1), (4) strip dead UI. Two user-confirm items flagged in Assumptions Log (A1 band→score mapping, A2 R11 anchor).
