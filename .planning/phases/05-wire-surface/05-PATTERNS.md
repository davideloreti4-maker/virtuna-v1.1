# Phase 5: Wire + Surface — Pattern Map

**Mapped:** 2026-06-06
**Files analyzed:** 12 (new + modified)
**Analogs found:** 11 / 12 (1 net-new with no analog: InsightHeroFrame component)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/engine/types.ts` (ApolloDimensionSchema — add `score`) | model/schema | transform | self (existing schema additions like `emotion_arc`, `verbatim`) | exact |
| `src/lib/engine/deepseek.ts` (post-parse rubric-sum, lines 141-168) | service | transform | self (existing post-parse backstop block) | exact |
| `src/lib/engine/apollo-core.ts` (§4 rubric — invert holistic→sum) | config/corpus | transform | self (existing §4 block lines 171-219) | exact |
| `src/lib/engine/aggregator.ts` (thread dimensions[].score through) | service | CRUD | self (apollo_reasoning assembly lines 968-975) | exact |
| `src/lib/engine/version.ts` (bump ENGINE_VERSION) | config | transform | self (line 26) | exact |
| `src/lib/engine/panel-mapping.ts` (add `insight_hero` panel id) | config | event-driven | self (existing PANEL_IDS + STAGE_TO_PANEL) | exact |
| `src/lib/engine/creator.ts` + `src/lib/engine/aggregator.ts` (R11 estimate) | service | CRUD | `src/lib/engine/aggregator.ts` (apollo_score blend lines 726-747) | role-match |
| `src/components/board/InsightHeroFrame.tsx` (net-new) | component | request-response | `src/components/board/content-analysis/ContentAnalysisFrame.tsx` | role-match (dual-read template) |
| `src/components/board/verdict/verdict-derive.ts` (D-02 band — reuse only) | utility | transform | self | exact |
| `src/components/board/verdict/VerdictNode.tsx` (D-02 — reuse, no edit) | component | request-response | self | exact |
| `src/components/board/audience/audience-derive.ts` (D-07 drop-point join) | utility | transform | self (biggestDrop/dropTime lines 99-183) | exact |
| `src/components/app/simulation/results-panel.tsx` (strip lines 159-166) | component | request-response | self | exact |

---

## Pattern Assignments

### `src/lib/engine/types.ts` — add bounded `score` to ApolloDimensionSchema

**Decision:** D-01 (rubric-sum)
**Analog:** self — existing schema extension pattern (emotion_arc, verbatim, apollo_reasoning optional fields on PredictionResult)

**Current schema (lines 756-763) — extend this:**
```typescript
// src/lib/engine/types.ts:756-763
export const ApolloDimensionSchema = z.object({
  name: z.enum(["hook", "retention", "clarity", "share_pull", "substance", "credibility"]),
  band: z.enum(["strong", "mid", "weak"]),
  lever: z.string().min(1),
  evidence: z.string().min(1),
});
```

**D-01 change — add `score` field with zod bounds (security V5 — LLM output is untrusted):**
```typescript
// ADD score field inside ApolloDimensionSchema (after `band`):
score: z.number().min(0).max(100),
// Keep `band` for UI display; `score` is the numeric anchor for the deterministic sum.
```

**Extension pattern for PredictionResult (lines 295-300) — the existing optional field pattern:**
```typescript
// src/lib/engine/types.ts:295-300
apollo_reasoning?: {
  rewrites: ApolloRewrite[];
  dimensions: ApolloDimension[];   // dimensions now carry .score
  composite_score: number;
  confidence_scope: string;
} | null;
```

**Assembly-hop rule:** dimension score MUST ride inside the existing `dimensions` array (not a new top-level field) so it flows through `aggregator.ts:968-975 → persistApolloToVariants (route.ts:198) → variants.apollo` automatically without touching the persist path.

---

### `src/lib/engine/deepseek.ts` — post-parse rubric-sum site (lines 141-168)

**Decision:** D-01
**Analog:** self — the existing post-parse backstop block is the exact insertion point

**Current post-parse block (lines 141-172):**
```typescript
// src/lib/engine/deepseek.ts:141-172
const result = DeepSeekResponseSchema.safeParse(parsed);
if (!result.success) {
  throw new Error(`DeepSeek response validation failed: ${result.error.message}`);
}
const data = result.data;

// Clamp composite_score to 0-100
data.composite_score = Math.min(100, Math.max(0, data.composite_score));

// Assert rewrites.length >= 2
if (data.rewrites.length < 2) {
  log.warn("Apollo rewrites too few post-parse", { count: data.rewrites.length });
}

// R2 backstop: normalize-whitespace-compare rewrite.original to verbatim hook.
if (verbatim?.hook) {
  const feedHook = verbatim.hook.spoken_words || verbatim.hook.on_screen_text || "";
  if (feedHook) {
    const normFeed = normalizeWs(feedHook);
    for (const rewrite of data.rewrites) {
      if (normalizeWs(rewrite.original) !== normFeed) {
        rewrite.original = feedHook;
      }
    }
  }
}

return data;
```

**D-01 insertion point — after the clamp, before the rewrites check:**
```typescript
// INSERT after data.composite_score = Math.min(100, Math.max(0, data.composite_score));
// D-01: deterministic sum overwrites the LLM's holistic composite.
// Hook weight ≈ 80% (apollo-core.ts §4 weighting), 5 body dims share remaining 20%.
// Clamp stays at line 149 and applies to the sum output.
const HOOK_WEIGHT = 0.80;
const BODY_WEIGHT = 0.20 / 5; // 5 non-hook dims share remainder
const sum = data.dimensions.reduce((acc, dim) => {
  const w = dim.name === "hook" ? HOOK_WEIGHT : BODY_WEIGHT;
  return acc + dim.score * w;
}, 0);
data.composite_score = Math.min(100, Math.max(0, Math.round(sum)));
```

**Security note (V5):** The new `score` field on each dimension must be zod-bounded (min/max in schema) + this post-parse clamp is the defense-in-depth. Do NOT skip the clamp even after schema validation.

---

### `src/lib/engine/apollo-core.ts` — invert §4 holistic→sum instruction (lines 171-219)

**Decision:** D-01 (Pitfall 5 — must edit corpus AND schema AND post-parse together)
**Analog:** self — lines 171-219 contain the §4 block

**Lines to invert (188-190) — current:**
```
// src/lib/engine/apollo-core.ts:188-190 (CURRENT — must be inverted):
// "Grade each dimension on the same 3-band scale as §2 — Strong / Mid / Weak —
//  not a 0–100 per dimension."
// "Give one composite 0–100: a holistic, hook-weighted judgment...
//  do not present the composite as arithmetic — it is a weighted judgment, not a sum of parts."
```

**D-01 replacement contract — invert both bullet points:**
- Each dimension: grade on the **3-band scale AND assign a numeric score** (e.g. Strong=high, Mid=mid, Weak=low range). The numeric score is how the composite becomes deterministic.
- Composite: **DO present it as a deterministic, hook-weighted sum** (hook ~80%, body dims share ~20%). The LLM emits the numeric per-dimension scores; TypeScript computes the composite.

**Surrounding context to preserve (lines 183-185 — DO NOT change):**
```
// src/lib/engine/apollo-core.ts:183-185
// "Weighting: the hook decides ~80% of performance...
//  keep at least half the judgment weight on the first ~3 seconds.
//  A weak hook caps the ceiling no matter how strong the body."
```

---

### `src/lib/engine/aggregator.ts` — thread dimensions[].score through blend + assembly

**Decision:** D-01 (assembly-hop guard)
**Analog:** self — the apollo blend (lines 726-747) + assembly block (lines 968-975)

**Apollo blend — no change needed (lines 726-747):**
```typescript
// src/lib/engine/aggregator.ts:726-747 — reads composite_score, now a deterministic sum
const apollo_score = deepseek?.composite_score ?? 0;  // now the rubric-sum output
const raw_overall_score = Math.min(100, Math.max(0, Math.round(
  behavioral_score * weights.behavioral +
  apollo_score * weights.apollo
)));
const overall_score = raw_overall_score;
```

**apollo_reasoning assembly — dimensions now carry .score (lines 968-975):**
```typescript
// src/lib/engine/aggregator.ts:968-975
apollo_reasoning: deepseek && deepseek.rewrites && deepseek.dimensions && deepseek.composite_score !== undefined
  ? {
      rewrites: deepseek.rewrites,
      dimensions: deepseek.dimensions,    // each dim now has .score — rides through unchanged
      composite_score: deepseek.composite_score,
      confidence_scope: deepseek.confidence_scope ?? "",
    }
  : null,
```

**Assembly-hop verification:** `dimensions[].score` is inside the `dimensions` array which is already inside `apollo_reasoning` which flows through `persistApolloToVariants` (route.ts:198) → `variants.apollo`. No additional threading required — the field is additive within the existing JSONB shape. **Verify after a real run:** `variants.apollo.dimensions[0].score` must be non-null in the DB row.

**R11 predicted_engagement compute site (line 977):**
```typescript
// src/lib/engine/aggregator.ts:977 — current:
predicted_engagement: null, // Plan 02 D1.1: sine-jitter deleted; null until Plan 05 regrounding

// D-05/R11 replacement — only when creatorContext.follower_count is present:
// predicted_engagement: computeEngagementRange(creatorContext, overall_score) ?? null,
// where computeEngagementRange returns PredictedEngagement | null
```

**R11 input availability (confirmed — creator.ts:216-240):**
```typescript
// src/lib/engine/creator.ts:216-224
return {
  found: true,
  follower_count: profile.tiktok_followers,   // real when creator profile exists
  avg_views: null,                             // per-creator null; use platform_averages.avg_views
  engagement_rate: profile.engagement_rate,
  platform_averages,                           // avg_views: 50000 fallback or real DB aggregate
  // ...
};
```

---

### `src/lib/engine/version.ts` — bump ENGINE_VERSION (line 26)

**Decision:** D-01 cache invariant (Pitfall 3)
**Analog:** self

**Current (line 26):**
```typescript
// src/lib/engine/version.ts:26
export const ENGINE_VERSION = "3.7.0";
```

**D-01 change:** bump to `"3.8.0"` (or next semver). Cache key = `hash::ENGINE_VERSION::userId` (D-23 invariant, version.ts:23). Bump auto-invalidates all cached 3.7.0 results. **Non-negotiable — do this in the same commit as D-01 corpus + schema + deepseek changes.**

---

### `src/lib/engine/panel-mapping.ts` — add `insight_hero` panel id (lines 10-37)

**Decision:** D-03 (progressive reveal — Apollo frame paints when wave_2 lands)
**Analog:** self — existing PANEL_IDS array + STAGE_TO_PANEL map

**Current PANEL_IDS + STAGE_TO_PANEL (lines 10-37):**
```typescript
// src/lib/engine/panel-mapping.ts:10-37
export const PANEL_IDS = [
  "verdict",
  "retention",
  "persona_breakdown",
  "hook_decomp",
  "similar_videos",
  "reasoning",
  "emotion_arc",
  "comparative_baseline",
  "optimal_post",
  "anti_virality",
] as const;

export const STAGE_TO_PANEL: Record<string, readonly PanelId[]> = {
  wave_1: ["hook_decomp", "similar_videos", "emotion_arc"],
  wave_2: ["reasoning"],
  wave_3_personas: ["retention", "persona_breakdown"],
  aggregator: ["verdict", "comparative_baseline", "optimal_post", "anti_virality"],
};
```

**D-03 change — add `insight_hero` and map to `wave_2`:**
```typescript
// ADD "insight_hero" to PANEL_IDS array
// ADD to STAGE_TO_PANEL:
wave_2: ["reasoning", "insight_hero"],   // Apollo stage fires both existing + new panel
```

**panelReadyFromStages is already built (lines 50-68) — no changes needed to the reducer.**

**How the InsightHeroFrame consumes this:**
```typescript
// In InsightHeroFrame — reads panelReady["insight_hero"] from useAnalysisStream
const { panelReady } = useAnalysisStream({ initialData: permalinkData ?? null });
const isReady = panelReady["insight_hero"] === "ready";
// Render skeleton/placeholder when "loading"; render content when "ready"
```

---

### `src/components/board/InsightHeroFrame.tsx` — net-new, zero existing consumers

**Decision:** D-08 (insight-hero surface set)
**Analog:** `src/components/board/content-analysis/ContentAnalysisFrame.tsx` (dual-read pattern lines 35-99)

This is the largest net-new P5 component. No existing board frame reads `apollo_reasoning` today.

**Imports pattern — copy from ContentAnalysisFrame.tsx (lines 1-33):**
```typescript
'use client';
import { useMemo } from 'react';
import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { usePermalinkAnalysis } from '@/hooks/queries/use-permalink-analysis';
import type { ApolloRewrite, ApolloDimension } from '@/lib/engine/types';
import type { HeatmapPayload } from '@/lib/engine/types';
import { findBiggestDrop, buildInsight } from '../audience/audience-derive';
import { bandLabel, bandTone, confidenceRange } from '../verdict/verdict-derive';
```

**Dual-read pattern — copy verbatim from ContentAnalysisFrame.tsx:79-99 (THE template):**
```typescript
// src/components/board/content-analysis/ContentAnalysisFrame.tsx:79-99
// Dual-read: live SSE PredictionResult has apollo_reasoning at TOP LEVEL;
// permalink reload row has it under variants.apollo (null at top level).
// Reading top-level ONLY = blank on reload (Pitfall 2, regression WPk976kozfWs).
const apollo = useMemo(() => {
  const v = (row?.variants as { apollo?: typeof row?.apollo_reasoning } | null)?.apollo;
  return v ?? row?.apollo_reasoning ?? null;
}, [row?.variants, row?.apollo_reasoning]);
```

**The RESEARCH.md one-liner (line 158) — canonical form:**
```typescript
const apollo = row?.variants?.apollo ?? (row as PredictionResult)?.apollo_reasoning ?? null;
```

**Core render structure — D-08 priority order:**
```typescript
// InsightHeroFrame render order (D-08):
// 1. Hero read (apollo.confidence_scope or Apollo's interpretation text)
// 2. 3 rewrites (original struck-through + copyable variant) — D-07 label on retention rewrite
// 3. 6 §-cited dimensions (apollo.dimensions[].name + .band + .lever + .score)
// 4. Fold retention heatmap (pass-through to existing AudienceNode/RetentionChart)
// 5. Score band (confidenceRange + bandLabel + bandTone from verdict-derive — D-02)
// 6. Flop/anti-virality warning (result.anti_virality_gated)
```

**Rewrite copyable + struck-through pattern — no existing analog (clipboard API):**
```typescript
// Each rewrite item:
// <del>{rewrite.original}</del>  — struck-through original (verbatim hook)
// <button onClick={() => navigator.clipboard.writeText(rewrite.variant)}>Copy</button>
// <span>{rewrite.variant}</span>
```

**D-07 drop-point label — join with audience-derive (lines 99-183):**
```typescript
// src/components/board/audience/audience-derive.ts:155-170
// buildInsight(segments, drop, groups) returns { lead, time, tail, addendum }
// Attach drop time to the rewrite whose lever_fixed references retention (§2.2):
const retentionRewrite = apollo.rewrites.find(r =>
  r.lever_fixed.includes("§2.2") || r.lever_fixed.toLowerCase().includes("retention")
);
// Label: "targets the {dropTime} dip" — dropTime from buildInsight().time
```

**Old-row defensive render (no score on pre-D-01 dimensions):**
```typescript
// dimension.score may be undefined on rows persisted before D-01.
// Render band only when score absent; render score+band when present.
const scoreDisplay = typeof dim.score === 'number' ? dim.score : null;
```

---

### `src/components/board/verdict/verdict-derive.ts` + `VerdictNode.tsx` — D-02 reuse (no edit)

**Decision:** D-02 (score band — reuse existing machinery)
**Status:** Already live. No code changes required. The planner task is to reference these in the InsightHeroFrame.

**Functions to import (verdict-derive.ts:19-109):**
```typescript
// src/components/board/verdict/verdict-derive.ts:19-23
export function confidenceRange(score: number, confidence: number): ConfidenceRange {
  const c = Number.isFinite(confidence) ? clamp(confidence, 0, 1) : 0.5;
  const half = clamp(Math.round((1 - c) * 22), 3, 22); // tight band when confident
  return { lo: Math.max(0, score - half), hi: Math.min(100, score + half) };
}

// src/components/board/verdict/verdict-derive.ts:25-29
export function bandLabel(score: number): string {
  if (score >= 70) return 'High potential';
  if (score >= 40) return 'Solid contender';
  return 'Needs work';
}

// src/components/board/verdict/verdict-derive.ts:105-109
export function bandTone(score: number): ScoreTone {
  if (score >= 70) return 'good';
  if (score >= 40) return 'warn';
  return 'crit';
}
```

**VerdictNode consumption pattern (lines 208-217) — how band is rendered:**
```typescript
// src/components/board/verdict/VerdictNode.tsx:208-217
const score = Math.round(result.overall_score);
const range = confidenceRange(score, result.confidence);
// range.lo / range.hi = the "78–82" band display (D-02)
// bandLabel(score) = "High potential" / "Solid contender" / "Needs work"
// bandTone(score) = 'good' | 'warn' | 'crit' → drives color
```

---

### `src/components/board/audience/audience-derive.ts` — D-07 drop-point join (read-only)

**Decision:** D-07 (surface-time R4, no engine change)
**Status:** Existing functions; no modification needed. InsightHeroFrame imports them.

**Functions for D-07 join (lines 99-183):**
```typescript
// src/components/board/audience/audience-derive.ts:111-123
export function findBiggestDrop(normalizedCurve: number[]): BiggestDrop | null {
  if (normalizedCurve.length < 2) return null;
  let maxDrop = -Infinity;
  let dropIndex = 1;
  for (let i = 1; i < normalizedCurve.length; i++) {
    const step = (normalizedCurve[i - 1] ?? 0) - (normalizedCurve[i] ?? 0);
    if (step > maxDrop) { maxDrop = step; dropIndex = i; }
  }
  return { index: dropIndex, delta: Math.max(0, maxDrop), fromIndex: dropIndex - 1 };
}

// src/components/board/audience/audience-derive.ts:155-188
// buildInsight(segments, drop, groups) → { lead, time, tail, addendum }
// time = formatTime(seg.t_start) → "0:02" coral-rendered string
```

**HeatmapPayload source for InsightHeroFrame:**
```typescript
// result.heatmap is HeatmapPayload | null (types.ts:405)
// heatmap.weighted_curve: number[]  → feed to findBiggestDrop
// heatmap.segments[]: { idx, t_start, t_end, is_hook_zone, ... } → t_start for dropTime
```

---

### `src/components/app/simulation/results-panel.tsx` — strip dead engagement UI (lines 159-166)

**Decision:** D-08 (strip fake-engagement UI)
**Analog:** self

**Dead block to remove (lines 159-166):**
```typescript
// src/components/app/simulation/results-panel.tsx:159-166 — DELETE this block:
{/* TikTokResult Card — shows video + predicted engagement (RES-1) */}
{result.predicted_engagement && (
  <TikTokResultCard
    videoSrc={videoSrc}
    thumbnailSrc={thumbnailSrc}
    engagement={result.predicted_engagement}
  />
)}
```

**Import to remove (line 15):**
```typescript
// src/components/app/simulation/results-panel.tsx:15 — DELETE:
import { TikTokResultCard } from './tiktok-result-card';
```

**If R11 is built:** replace the deleted JSX block with the engagement range display component. If R11 is deferred, the block is simply deleted — the null-guard already prevents renders, so this is purely a cleanup.

**Test to update:** `src/components/app/simulation/__tests__/results-panel.predicted-engagement-null.test.tsx` — the "renders when present" case becomes dead after strip. Either delete that case or repurpose the test for the R11 range component.

---

### `src/app/api/analyze/route.ts` — persistApolloToVariants (lines 173-210, read-only reference)

**Decision:** D-01 assembly-hop guard (no changes needed here)
**Status:** Existing persist path already handles the extended `apollo_reasoning` — `dimensions[].score` rides through the same `{ ...current, apollo }` spread.

**Persist pattern (lines 173-210) — copy this for any new variants persist:**
```typescript
// src/app/api/analyze/route.ts:173-210
async function persistApolloToVariants(service, id, userId, finalResult, log) {
  const apollo = finalResult.apollo_reasoning;
  if (!apollo) return;  // skip when Apollo didn't run

  // Read-merge-write: preserve sibling variants (craft, remix/decode)
  const { data: row } = await service.from("analysis_results")
    .select("variants").eq("id", id).eq("user_id", userId).single();
  const current = (row.variants ?? {}) as Record<string, unknown>;

  await service.from("analysis_results")
    .update({ variants: { ...current, apollo } })
    .eq("id", id).eq("user_id", userId);  // T-03-10: V4 access control on BOTH read + write
}
```

---

## Shared Patterns

### Dual-read live-vs-permalink (THE assembly-hop prevention pattern)
**Source:** `src/components/board/content-analysis/ContentAnalysisFrame.tsx:79-99`
**Apply to:** All new board frames that surface engine data (InsightHeroFrame)
**Why:** Live SSE `PredictionResult` carries fields at top level; permalink reload DB row nests them under `variants.<key>`. Regression WPk976kozfWs = blank-on-reload from top-level-only read.

```typescript
// TEMPLATE — copy for apollo:
const apollo = useMemo(() => {
  const v = row?.variants?.apollo;
  return v ?? row?.apollo_reasoning ?? null;
}, [row?.variants?.apollo, row?.apollo_reasoning]);

// ContentAnalysisFrame template (lines 79-99):
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

### Post-parse clamp (LLM output untrusted — ASVS V5)
**Source:** `src/lib/engine/deepseek.ts:149`
**Apply to:** Any new numeric field derived from LLM output (dimension.score, predicted_engagement range)

```typescript
// src/lib/engine/deepseek.ts:149 — existing pattern:
data.composite_score = Math.min(100, Math.max(0, data.composite_score));
// Replicate for new dimension.score after sum:
data.composite_score = Math.min(100, Math.max(0, Math.round(sum)));
```

### Read-merge-write variants persist (V4 access control)
**Source:** `src/app/api/analyze/route.ts:173-210`
**Apply to:** Any future variants write. R11 predicted_engagement goes into `aggregator.ts` not a new persist path — it rides `PredictionResult.predicted_engagement` through the existing SSE upsert.

### ENGINE_VERSION bump cache invariant
**Source:** `src/lib/engine/version.ts:23-26`
**Apply to:** Any engine output contract change (D-01 specifically)

```typescript
// D-23 invariant: bump version whenever the score derivation changes.
// Cache key = hash::ENGINE_VERSION::userId — bump auto-invalidates L1+L2.
export const ENGINE_VERSION = "3.8.0";  // bump from 3.7.0 with D-01
```

### Zod schema extension — additive, backwards-compatible
**Source:** `src/lib/engine/types.ts:282-300` (apollo_reasoning optional field)
**Apply to:** D-01 `score` addition on ApolloDimensionSchema

The optional-field pattern used for `emotion_arc`, `verbatim`, `apollo_reasoning` on `PredictionResult`: always add as optional/nullable so pre-D-01 DB rows still parse. For a REQUIRED new field inside an existing required object (like adding `score` inside `ApolloDimensionSchema`), ensure old-row read sites use `dim.score ?? null` defensively.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/components/board/InsightHeroFrame.tsx` (net-new) | component | request-response | Zero existing board components read `apollo_reasoning`; ContentAnalysisFrame provides the dual-read template but the rewrite-strike-through + copyable-variant + dimension-card + drop-point-label UI is entirely new construction. |

---

## Critical Assembly-Hop Checklist

The engine has a documented recurring regression where a new field is declared+prompted but drops somewhere in the pipeline before DB. For D-01 dimension `.score`:

```
ApolloDimensionSchema (types.ts)          ← ADD score: z.number().min(0).max(100)
    ↓
deepseek.ts post-parse (lines 141-168)    ← COMPUTE sum, OVERWRITE composite_score, CLAMP
    ↓
aggregator.ts apollo_reasoning (line 968) ← dimensions array already threaded (no change)
    ↓
route.ts persistApolloToVariants (198)    ← { ...current, apollo } already includes dimensions
    ↓
variants.apollo.dimensions[].score in DB  ← VERIFY non-null on real run
    ↓
InsightHeroFrame dual-read (variants.apollo ?? apollo_reasoning)  ← dim.score ?? null
```

**Warning sign:** score shows on fresh board but vanishes on permalink reload = persisted but not read. Score never shows anywhere = not threaded.

---

## Metadata

**Analog search scope:** `src/lib/engine/`, `src/components/board/`, `src/components/app/simulation/`, `src/hooks/queries/`, `src/app/api/analyze/`
**Files scanned:** 15
**Pattern extraction date:** 2026-06-06
