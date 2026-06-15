# Phase 3: Rich Visuals as Drill-Downs - Research

**Researched:** 2026-06-14
**Domain:** Frontend component transplant + reskin (Next.js 15 / TypeScript / Tailwind v4 / SVG charts) — presentation-layer only, engine FROZEN at 3.19.0
**Confidence:** HIGH (every claim below is grounded in a file read this session; no training-data assumptions about the codebase)

## Summary

This phase is exactly what the P2 scout claimed: a **reskin + remount, not a rebuild**. I read all 14 candidate files (7 leaf charts + 5 derive/geometry layers + 2 kit primitives) and the definitive coupling grep returns **zero** `useBoardStore` / choreography / camera imports across the entire transplant set. The architecture invariant (reading cluster is board-store-free) holds for free — the leaf charts are already pure prop-driven components. The risk the planner must manage is NOT severing store coupling in the leaves (there is none); it's (a) never importing the *board callers* (`AudienceNode`, `VerdictNode`, `ContentAnalysisFrame`) which ARE store-coupled, and (b) re-deriving each chart's props prop-side inside the reading panels from `data` + the pure derive helpers.

The two highest-value, fully-resolved deliverables: (1) the **per-component severability map** — all clean, with the exact prop-derivation recipe for each; and (2) the **exact `reading.tsx` two-touch edit** for the new `score` panel — I captured the literal current `PanelId` union, `PANEL_TITLE` map, and `PanelContent` switch, plus the byte-exact `VerdictNode` recipe the score panel mirrors.

Two corrections to the planning docs surfaced: (1) the UI-SPEC says "the reading container has NO filmstrip map today; P3 must BUILD it" — actually a clean store-free hook already exists (`usePermalinkFilmstrips()` → `Record<number,string>`); P3 calls it, doesn't build it. (2) `PersonaGraph` is described as "HTML-Canvas" in CONTEXT/UI-SPEC — it is actually **SVG** (`<svg>`/`<circle>`/`<animate>`), so it reskins via SVG attrs + token swaps, NOT Canvas draw-color constants. Both make the phase *smaller*, not larger.

**Primary recommendation:** Mount the 7 leaf charts (6 + RetentionPlayer gated) directly as `DrillSheet` children; re-derive every prop inside `reading.tsx` `PanelContent` from `data` + the pure `*-derive.ts` helpers; add the `score` panel as a closed-union extension; reskin per the cited Tier-1/Tier-2 token map; source the filmstrip map from `usePermalinkFilmstrips()` and niche cohort from `useComparisons()` (both clean TanStack queries, lazy/panel-local). Exclude `RetentionPlayer` by default (source is null on the dominant tiktok_url path).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Render rich charts (retention curve, persona cloud, histogram, filmstrip, tiles) | Browser/Client (`"use client"` leaf components) | — | All are SVG/CSS/DOM, no SSR data needs; already client components |
| Shape engine fields → chart props | Client (pure derive functions, React-free) | — | `audience-derive.ts` / `content-analysis-derive.ts` / `verdict-derive.ts` are pure, unit-tested, no React |
| Single analysis data subscription | Client (container `reading.tsx`) | API (`/api/analysis/[id]`) | One `usePermalinkAnalysis()` in the container; children are prop leaves (P2 invariant) |
| Niche cohort histogram source (score panel) | Client (panel-local `useComparisons`) | API (`/api/analyze/[id]/comparisons`) | Cached TanStack query, lazy on score-panel mount; NOT a second analysis subscription |
| Filmstrip keyframe URLs (retention panel) | Client (panel-local `usePermalinkFilmstrips`) | API (`/api/analyze/[id]/filmstrips`) | Cached TanStack query → `Record<number,string>`; store-free |
| Signed video URL (RetentionPlayer, optional) | Client (`useUploadedVideoSource`) | API (`/api/videos/sign`) | Only resolves for `input_mode==='video_upload'` rows; null on tiktok_url |
| Panel open/close + which panel | Client (container `useState<PanelId\|null>`) | — | Closed-union allow-list; never reflect a raw key (threat T-02-12) |
| Reskin (tokens, strip glass/glow) | Client (CSS classes + inline style + SVG attrs) | Tokens (`globals.css @theme`) | Flat-warm tokens already declared; charts repoint to them |

**Key insight:** every capability lives in the browser tier. There is no API or SSR work in this phase — the only network calls are three already-built, cached, store-free TanStack queries, and they are panel-local (fired only when a panel mounts), preserving the container's single-subscription contract.

## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01..D-07, + carried-forward from P1/P2)
- **D-01 Curate, don't preserve-all:** DROP `FactorBars` (superseded by `reading/driver-rows.tsx`, 0–100) and `InsightHeroFrame` (superseded by the new Reading hero). Their data already lives in the Reading. KEEP `RetentionChart`, `SegmentTable`, `PersonaGraph`, `CraftFilmstrip`, `ScoreDistribution`.
- **D-02 Add a `score` panel:** hero ScoreGauge gets a NEW `onOpen` tap → opens `ScoreDistribution` (niche histogram + confidence range). Genuinely new wiring (gauge has no tap today).
- **D-03 Visual→surface mapping (the phase spine):** score→ScoreDistribution · personas→PersonaGraph · hook→reskin P2 native 0–10 rows · retention→RetentionChart + CraftFilmstrip + SegmentTable (composed) · shareability→StatTile rate tiles + share_pull evidence · deeper-read→unchanged.
- **D-04 Filmstrip in the Retention panel**, timeline-paired with the curve ("drop at 0:08 → frame at 0:08").
- **D-05 Emotion arc DROPPED** this phase — no standalone component to transplant (woven into `ContentAnalysisFrame`).
- **D-06 Composed cluster per panel** (not one-chart-per-tap), scrollable, curated.
- **D-07 Reskin depth:** token-swap baseline + targeted re-treat (glows/gradients/glass) + a **blocking human-UAT gate** at phase close.
- **Carried LOCKED:** disclosure seam = `DrillSheet` (unchanged); panel state = closed allow-list union; per-block graceful degradation (never a fabricated 0, never grey-cell — `PanelEmpty`); flat-warm THEME-06 tokens; ~760px column (visuals MAY break wider in the drawer); score-forward NO prose; product noun "Simulation"; reading cluster MUST stay board-store-free.

### Claude's Discretion (planner / executor)
- **Mobile interactivity downgrade** — `PersonaGraph` hover→tap; `CraftFilmstrip` scrub; `SegmentTable` sort. No hover-only on touch.
- **`RetentionPlayer` inclusion** — include ONLY if the uploaded source resolves on permalink reload. (Researcher finding below: it generally does NOT on the dominant path — recommend exclude/conditional.)
- **Per-visual degraded states** — reuse P2 `PanelEmpty`; audit each null/empty path.
- **`ScoreDistribution` confidence-range text gating** — `showRangeText = confidence_label !== 'HIGH'`.
- **Drill-down panel library / motion** — `DrillSheet` already built; mostly settled.
- **Whether to relocate chart files** out of `board/**` vs reskin in place — executor's call; keep imports clean + cluster store-free.

### Deferred Ideas (OUT OF SCOPE)
- Emotion arc as a drill-down (D-05).
- `RetentionPlayer` scrubbable video, if source doesn't persist.
- A dedicated 6th "Content/Craft" surface.
- Shareable / deep-linked `?panel=…` panels (v2 `SHARE-01`).
- Naming reconciliation (brief/roadmap/`READ-*` say "Reading"; build uses "Simulation").

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| READ-09 | All existing rich board visuals preserved as drill-downs; nothing visual deleted (in spirit — D-01 curates two superseded shells) | Severability map confirms all 7 transplant targets are pure leaves; mount mechanics + prop-derivation recipes documented; reskin token map cited file:line; degradation paths audited |

## Standard Stack

No new dependencies. Everything is first-party + already installed (verified in `package.json`).

### Core (already installed — used as-is)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 15.x | App router, `useParams` for route id | Project framework |
| `react` | 19.x | Components/hooks | Project framework |
| `@tanstack/react-query` | (installed) | The 3 panel-local cached queries (`usePermalinkFilmstrips`, `useComparisons`, `usePermalinkAnalysis`) | Already the data layer; dedupes + caches |
| `tailwindcss` v4 | (installed) | `@theme` tokens, utility classes | Project styling; flat-warm tokens live in `globals.css` |
| `@radix-ui/*` / `radix-ui` | 1.4.3 | `Sheet` (the `DrillSheet` surface) — UNCHANGED this phase | Vendored in P1/P2 |

### Supporting (first-party, already in repo)
| Module | Path | Purpose |
|--------|------|---------|
| `audience-derive.ts` | `board/audience/` | `buildPersonaNodes`, `buildSegmentGroups`, `worstBadGroupKey`, `findBiggestDrop`, `normalizeCurve`, `toRetentionCurve`, `nicheGhostCurve`, `totalDuration`, `formatTime` (SECONDS), `cohortDropFrame`, `averageWatchThrough` |
| `content-analysis-derive.ts` | `board/content-analysis/` | `buildCells` (→ `CraftCell[]`), `buildWaveBars`, `formatTimeSec`, `durationFromSegments`, `audioMixCaption` |
| `verdict-derive.ts` | `board/verdict/` | `confidenceRange`, `bandTone` (score-zone SSOT), `deriveBehavioralTiles` (→ shareability `StatTileData[]`) |
| `retention-geometry.ts` | `board/audience/` | `VB_W/VB_H/PAD_TOP/FLOOR_Y`, `yForValue`, `xForIndex`, `retentionAt`, `clamp01` |
| `keyframe.ts` / `KeyframeImage.tsx` | `board/_kit/` | `resolveKeyframeUrl`, `KeyframeSegmentLike`; cohort thumb image (SegmentTable) |
| `usePermalinkFilmstrips` | `hooks/queries/` | `Record<number,string>` keyframe map (retention panel) — **already exists, store-free** |
| `useComparisons` | `board/verdict/use-comparisons.ts` | `{ niche: NicheCohort \| null, history }` (score panel) — clean `useQuery` |
| `useIsMobile`, `usePrefersReducedMotion` | `hooks/` | Sheet-vs-drawer + reduced-motion |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Calling `usePermalinkFilmstrips()` panel-side | Building a fresh filmstrip merge in the container | The hook already exists, is cached, store-free; building one duplicates work and risks a second subscription. Use the hook. |
| Importing leaf charts directly | Importing `AudienceNode`/`VerdictNode` | The Nodes drag `useBoardStore` + choreography into the store-free cluster — a hard P2 invariant violation. NEVER import a `*Node`/`*Frame`/`*Hero`. |
| Mounting `PersonaGraph` (full) | Reusing `persona-cloud.tsx` (the P2 hero cloud) | The hero cloud is dots-only by design (D-02); the panel wants the full 200-dot + hover/tap graph. Different component, same `buildPersonaNodes` source. |

**Installation:** none — `npm install` adds nothing this phase.

## Package Legitimacy Audit

> Not applicable — this phase installs **zero** external packages. All components are first-party (`src/components/board/**`, `src/components/reading/**`) and all libraries (`next`, `react`, `@tanstack/react-query`, `tailwindcss`, `@radix-ui/*`) are already-installed project dependencies vendored/wired in Phases 1–2. Registry vetting gate not triggered.

## Severability Map — Landmine 1 (HIGHEST VALUE)

**Definitive coupling grep** (`useBoardStore | use-audience-choreography | useAudienceChoreography | use-client-weights | useClientWeights | board-store | pendingVideo | Camera | world-space | board-types`) across all 14 files: **ZERO matches**. Every transplant target and derive layer is already board-store-free. There is no coupling to sever — the "reskin + remount" sizing is validated by evidence.

| Component | Path | Store-coupled? | What it imports | Transplant verdict |
|-----------|------|---------------|-----------------|--------------------|
| `RetentionChart` | `board/audience/RetentionChart.tsx` | **No** | `Skeleton`, `audience-derive`, `retention-geometry`, `HeatmapPayload` type | Mount directly; pure props |
| `SegmentTable` | `board/audience/SegmentTable.tsx` | **No** | `Skeleton`, `_kit` (`DataTable`, `KeyframeImage`), `audience-derive` types | Mount directly |
| `RetentionPlayer` | `board/audience/RetentionPlayer.tsx` | **No** | `RetentionChart`, `audience-derive`, `retention-geometry` | Mount only if `videoSrc` resolves (see Landmine 5) |
| `CraftFilmstrip` | `board/content-analysis/CraftFilmstrip.tsx` | **No** | `Skeleton`, `content-analysis-derive`, `content-analysis-constants`, types | Mount directly |
| `PersonaGraph` | `board/_kit/PersonaGraph.tsx` | **No** | `cn` only | Mount directly; **SVG not Canvas** |
| `ScoreDistribution` | `board/verdict/ScoreDistribution.tsx` | **No** | `cn` only | Mount directly |
| `StatTile`/`StatTileRow` | `board/_kit/StatTile.tsx` | **No** | `cn`, `Delta` | Mount directly |
| `audience-derive.ts` | `board/audience/` | **No** (React-free) | `@/lib/engine/types`, `persona-weights` (type), `../_kit` (types) | Call from panels |
| `content-analysis-derive.ts` | `board/content-analysis/` | **No** (React-free) | engine types, `qwen/schemas` (type), constants | Call from panels |
| `verdict-derive.ts` | `board/verdict/` | **No** (React-free) | engine types, `ScoreDistribution` types, `_kit` types | Call from panels |
| `retention-geometry.ts` | `board/audience/` | **No** (React-free) | `HeatmapPayload` type | Call from panels |
| `keyframe.ts` | `board/_kit/` | **No** (zero imports) | — | Call from panels |
| `KeyframeImage.tsx` | `board/_kit/` | **No** | `useState`, `cn` | Mount (via SegmentTable) |
| `DataTable.tsx` | `board/_kit/` | **No** | `cn`, type | Mount (via SegmentTable) |

### The store-coupled CALLERS — NEVER import these
| Caller | Path | Couples via | Why avoid |
|--------|------|-------------|-----------|
| `AudienceNode` | `board/audience/AudienceNode.tsx` | `useBoardStore`, `useAudienceChoreography`, `useClientWeights`, `pendingVideo`, `Camera`/`board-types` | Re-introduces the retired board store into the store-free cluster |
| `VerdictNode` | `board/verdict/VerdictNode.tsx` | `useBoardStore`, `useComparisons` (this one's fine alone), `FactorBars` (dropped) | Drags the store back in; also pulls dropped `FactorBars` |
| `ContentAnalysisFrame` | `board/content-analysis/` | (board frame wrapper) | Frame wrapper; emotion_arc is woven here (D-05 drops it) |

### Per-panel prop derivation (the executor wires these inside `reading.tsx` `PanelContent`, from `data` only)

**score panel** (mirrors `VerdictNode.tsx` L244–272 byte-for-byte):
```ts
const score = Math.round(data.overall_score);                  // 0–100
const range = confidenceRange(score, data.confidence);         // verdict-derive
const showRangeText = data.confidence_label !== 'HIGH';        // discretion gate
const niche = useComparisons(id).data?.niche ?? null;          // NicheCohort | null
<ScoreDistribution score={score} niche={niche} range={range} showRangeText={showRangeText} />
```
`ScoreDistribution` internally degrades `field`→`lane`→`absolute` when `niche` is null/thin (`resolveMode`, FIELD_MIN_COUNT=20) — that IS its in-panel `PanelEmpty` equivalent (no throw).

**personas panel** (same `buildPersonaNodes` call `persona-cloud.tsx` already makes, L46–49):
```ts
const badKey = worstBadGroupKey(buildSegmentGroups(data.heatmap ?? null, data.persona_simulation_results));
const nodes  = buildPersonaNodes(data.heatmap ?? null, data.persona_simulation_results, badKey); // PersonaNode[]
<PersonaGraph personas={nodes} reducedMotion={usePrefersReducedMotion()} />
```
Empty `nodes` → render `PanelEmpty` (mirror `persona-cloud` returning null on this path).

**retention panel** (the curve recipe traced from `AudienceNode.tsx` L122–131, minus the store recompute branch):
```ts
const filmstrips = usePermalinkFilmstrips();                    // Record<number,string>, store-free
const raw   = data.heatmap?.weighted_curve ?? null;            // engine emits weighted_curve
const curve = raw ? toRetentionCurve(normalizeCurve(raw)) : null;  // survival curve
const drop  = curve ? findBiggestDrop(normalizeCurve(curve)) : null;
const total = totalDuration(data.heatmap?.segments, /*fallback*/ 30);
const nichePct = data.heatmap?.niche_completion_pct != null
  ? (data.heatmap.niche_completion_pct > 1.5 ? data.heatmap.niche_completion_pct/100 : data.heatmap.niche_completion_pct)
  : null;
<RetentionChart curve={curve} heatmap={data.heatmap ?? null} drop={drop}
  totalDurationSec={total} filmstrips={filmstrips} nicheCompletionPct={nichePct} isLoading={false} />
// + CraftFilmstrip (cells = buildCells(segments, filmstrips, arc, total)) — arc = data.emotion_arc ?? []
//   (note: CraftFilmstrip renders only the audio band from `arc`, not the emotion arc proper — D-05)
// + SegmentTable (groups = buildSegmentGroups(...), badKey = worstBadGroupKey(groups),
//   cohortFrames = per-slot cohortDropFrame(heatmap, key, filmstrips))
```
Empty curve/segments → `PanelEmpty` (don't render an empty SVG).

**shareability panel:**
```ts
const tiles = deriveBehavioralTiles(data);                     // StatTileData[] from behavioral_predictions
const dim   = dims?.find(d => d.name === 'share_pull');        // evidence text (ApolloDimension)
<StatTileRow tiles={/* tiles, single weakest marked tone:'accent' */} />
// + dim?.evidence as the supporting text
```
`deriveBehavioralTiles` omits tiles whose `*_pct` is absent (never fabricates). Empty tiles + no dim → `PanelEmpty`.

**hook panel:** UNCHANGED data path — keep the P2 `HookPanel` 0–10 rows (`reading.tsx` L235–288), reskin only (already on tokens — verify).

## The `score` Panel Edit — Landmine 4 (HIGHEST VALUE)

`ScoreGauge` exposes **no** tap target today. Verified `ScoreGaugeProps` (`score-gauge.tsx` L40–47):
```ts
export interface ScoreGaugeProps { score: number; size?: number; stroke?: number; }
```
No `onOpen`, no click handler. Adding the `score` panel is genuinely new wiring — a four-touch edit (closed-union safe), NOT a content swap.

### Exact current state in `reading.tsx` (verbatim, for the planner)

**Current `PanelId` union (L66):**
```ts
type PanelId = 'hook' | 'retention' | 'shareability' | 'personas';
```

**Current `PANEL_TITLE` map (L68–73):**
```ts
const PANEL_TITLE: Record<PanelId, string> = {
  hook: 'Hook',
  retention: 'Retention',
  shareability: 'Shareability',
  personas: 'Audience',
};
```

**Current `PanelContent` switch (L208–223):**
```ts
switch (panel) {
  case 'hook':         return <HookPanel hook={data.hook_decomposition ?? null} dims={dims} />;
  case 'retention':    return <RetentionPanel heatmap={data.heatmap ?? null} dropIndices={data.dropoff_segment_indices} />;
  case 'shareability': return <DimensionPanel dim={dims?.find((d) => d.name === 'share_pull')} />;
  case 'personas':     return <PersonasPanel heatmap={data.heatmap ?? null} />;
}
```

**Current hero gauge mount (L142–143) — needs the new `onOpen`:**
```ts
<ScoreGauge score={data.overall_score} />
```

### The four-touch edit (closed-union safe, threat T-02-12)
1. **Extend the union (L66):** `type PanelId = 'hook' | 'retention' | 'shareability' | 'personas' | 'score';`
2. **Add the title (L68–73):** `score: 'Score',` (matched `Record<PanelId,string>` makes this type-enforced — a missing key won't compile).
3. **Add `onOpen` to `ScoreGauge`:** add `onOpen?: () => void` to `ScoreGaugeProps`; wrap the gauge's outer `<div role="img">` with a button affordance (or make it `role="button"` + `onClick`/`onKeyDown` Enter/Space, mirroring `persona-cloud.tsx` L76–95). The gauge is ~120px desktop / ~96px mobile = comfortably ≥44px. At the call site: `<ScoreGauge score={data.overall_score} onOpen={() => setPanel('score')} />`.
4. **Add the switch case:** `case 'score': return <ScorePanel data={data} id={id} />;` where `ScorePanel` runs the score-panel recipe above. (Note: `id` is in scope in `Reading()` from `usePermalinkAnalysis()`; pass it down for `useComparisons(id)`.)

**Security note:** `panel` is set only via the closed union (`setPanel('score')` literal), and `PANEL_TITLE[panel]` indexes the typed record — no raw key is ever reflected into the title or content. The `Record<PanelId,string>` type makes the allow-list compiler-enforced.

## Landmines 2, 3, 5, 6 — Resolved

### Landmine 2 — `emotion_arc` has no standalone component ✅ CONFIRMED
No `EmotionArc.tsx` exists. `emotion_arc` (`EmotionArcPoint[]`) is consumed only inside `content-analysis-derive.ts` (`intensityAt`, `buildWaveBars`, `energyDipWindow`) and woven into `ContentAnalysisFrame`. `CraftFilmstrip` takes an `arc` prop but renders only an **audio activity band** from it (L76 `buildWaveBars(arc, durationSec)`) + per-cell energy grading — the emotion arc proper is never plotted as a curve. **Do not hunt for an EmotionArc component; D-05 drops it.** When wiring `CraftFilmstrip`, pass `arc = data.emotion_arc ?? []`.

### Landmine 3 — niche/ghost curve is an overlay inside `RetentionChart` ✅ CONFIRMED
Verified in `RetentionChart.tsx`: the ghost line is computed at L67–78 via `nicheGhostCurve(heatmap)` (from `audience-derive`) with a flat-line fallback at `nicheCompletionPct`, drawn at L143–152 (dashed path) + the `niche` tag at L196–203. **It is NOT a separate file** — it transplants automatically with the curve. The roadmap's "niche/ghost curves" success-criterion item is satisfied by mounting `RetentionChart` alone.

### Landmine 5 — `RetentionPlayer` video source persistence → RECOMMEND EXCLUDE (default)
Read `use-uploaded-video-source.ts` end-to-end. Resolution precedence:
1. `pendingObjectUrl` (board-store `pendingVideo.objectUrl`) — **unavailable in the store-free reading cluster; MUST NOT be reintroduced.** P3 passes `null` here.
2. Signed URL from `/api/videos/sign` — only when the persisted row is `input_mode === 'video_upload'` with a `video_storage_path` (can 404 → `missing`).
3. Otherwise `{ src: null, status: 'idle' }`.

**Consequence:** on a permalink reload with `pendingObjectUrl=null`, a source resolves ONLY for `video_upload` rows. For the milestone's **dominant tiktok_url path** (D-21: paste-URL is TikTok-only; uploads are the secondary `+` path), `path` is null → `status: 'idle'` → no player. **Recommendation: default the retention panel to static `RetentionChart` + `CraftFilmstrip` + `SegmentTable`.** Optionally layer `RetentionPlayer` in only when `useUploadedVideoSource(data, null).status === 'ready'` (it degrades byte-for-byte to `RetentionChart` when `videoSrc` is null — `RetentionPlayer.tsx` L138). If the signed-URL path proves unreliable at UAT, ship static and defer the player (clean degrade, no risk to SC-2). `RetentionPlayer` also carries the heaviest reskin load (Tier-2: blur, glass tooltip, coral glows) — excluding it shrinks the reskin surface.

### Landmine 6 — Data-scale traps ✅ ALL CONFIRMED (read from `engine/types.ts` + `qwen/schemas.ts`)
| Field | Scale | Source (file:line) | Trap to avoid |
|-------|-------|--------------------|---------------|
| Hook modality sub-scores (`visual_stop_power`, `audio_hook_quality`, `text_overlay_score`, `first_words_speech_score`, `visual_audio_coherence`, `cognitive_load`) | **0–10** (`ScoreSchema`) | `qwen/schemas.ts` L25–45 | P2 `HookPanel` already correct (`Math.min(10, score) * 10` for bar). `cognitive_load` has INVERTED polarity (higher=worse) but the P2 panel doesn't render it. |
| `ApolloDimension.score` | **0–100** | `types.ts` L843 (`z.number().min(0).max(100)`) | Don't confuse with the 0–10 hook scores. `dimensions[]` is exactly length 6 (L876): hook/retention/clarity/share_pull/substance/credibility. |
| `ScoreDistribution` histogram | **10 decile bins** `[0-10)…[90-100]` | `ScoreDistribution.tsx` L4–9 (`NicheCohort.histogram`) | Bins, not percentages. |
| `overall_score` | **0–100** | `types.ts` L302 | Gauge + score panel. |
| `confidence` | **0–1** numeric | `types.ts` L303 | Feeds `confidenceRange`. |
| `confidence_label` | `"HIGH" \| "MEDIUM" \| "LOW"` | `types.ts` L238, L304 | Gates `showRangeText` (`!== 'HIGH'`). |
| `behavioral_predictions.*_pct` (share/comment/save/completion/loop) | **0–100** | `types.ts` L740–762 | Shareability tiles. |
| `heatmap.weighted_curve` | per-segment attention `number[]` | `types.ts` L58 | The curve `RetentionChart` consumes (via `toRetentionCurve(normalizeCurve(...))`). |
| `weighted_top_dropoff_t` | seconds, top-level + heatmap mirror | `types.ts` L483 | P2 already uses the SECONDS path. |

**THREE `formatTime` helpers — pick SECONDS for retention:**
- `audience-derive.formatTime(seconds)` ✅ — use for RetentionChart / SegmentTable / drop times (`audience-derive.ts` L49).
- `content-analysis-derive.formatTimeSec(sec)` ✅ — used internally by CraftFilmstrip (L25).
- `verdict/TopFixesList.formatTime(ms)` ❌ — milliseconds; NEVER for retention (the 0:08-vs-0:00 trap).

## Mount Mechanics

- **`DrillSheet` is generic + UNCHANGED** (`drill-sheet.tsx`): takes `{open, onOpenChange, title, children, className}`. Already flat-warm (`bg-surface shadow-none`, no inset/blur). Bottom sheet mobile / right drawer desktop via `useIsMobile`. Content region already `overflow-y-auto px-6 pb-6` (composed-cluster scroll, D-06). Panel-agnostic by design — P3 adds panel TYPES, never touches this file.
- **Single subscription stays in the container:** `reading.tsx` L103 `const { id, data, isLoading } = usePermalinkAnalysis();` is the only analysis subscription. Children are prop leaves. The three panel-local queries (`usePermalinkFilmstrips`, `useComparisons`) are NOT analysis subscriptions — they're separate cached endpoints, fired only when their panel mounts, so they don't violate the single-subscription contract. (`usePermalinkAnalysis` and `usePermalinkFilmstrips` both read the route `id` via `useParams` — consistent.)
- **Swap locus:** each panel's body in `PanelContent` (the `switch`). P2 deliberately shipped real native content there (D-12) so P3 swaps content in the same container. Edit the per-case body; keep the `DrillSheet` + panel-state machinery.

## Composed-Cluster Panels — D-06

The retention panel composes three components on one aligned timeline (D-04 "watch journey"). They share geometry: `RetentionChart` and `RetentionPlayer` agree via `retention-geometry.ts` (`VB_W=600`, `VB_H=138`, `xForIndex`/`xForTime`); `CraftFilmstrip` uses its own width-% cells keyed by position; `SegmentTable` is time-agnostic (per-cohort rows + drop frames). All three consume from the SAME `heatmap.segments` + `filmstrips` map, so the timeline aligns by construction (segment `t_start`/`t_end` → x-position; filmstrip keyed by `seg.idx ?? i`). Derived data each needs:
- `RetentionChart`: `curve` (from `weighted_curve`), `heatmap`, `drop`, `totalDurationSec`, `filmstrips`, `nicheCompletionPct`.
- `CraftFilmstrip`: `cells` (`buildCells(segments, filmstrips, arc, durationSec)`), `durationSec`, `arc` (`data.emotion_arc ?? []`), `audio` (`data.audio_signals ?? null`), `audioCaption` (`audioMixCaption(audio)`), `ctaPresent`.
- `SegmentTable`: `groups` (`buildSegmentGroups(heatmap, simResults)`), `badKey` (`worstBadGroupKey(groups)`), `cohortFrames` (per-slot `cohortDropFrame(heatmap, key, filmstrips)`).

Stack with `gap-6` between distinct visuals, `gap-3` within a visual (per UI-SPEC spacing).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Filmstrip keyframe map | A fresh stream+permalink merge in the container | `usePermalinkFilmstrips()` → `Record<number,string>` | Already exists, cached, store-free. **UI-SPEC overstates this as "P3 must BUILD it" — it doesn't.** |
| Niche cohort histogram source | A new fetch/derive | `useComparisons(id)` → `{ niche: NicheCohort \| null }` | Clean `useQuery`; the exact source `VerdictNode` uses |
| Confidence range | Math in the panel | `confidenceRange(score, data.confidence)` | Pure, honest (width ∝ 1−confidence), already used by the gauge path |
| Score-zone color | A parallel green/amber/red map | `bandTone(score)` (verdict-derive SSOT) | The gauge + driver rows already use it; a second scheme drifts |
| Survival curve from attention | Curve math | `toRetentionCurve(normalizeCurve(weighted_curve))` | Pure, unit-tested; handles 0–1 vs 0–100 detection + monotonic envelope |
| Persona node layout | Golden-angle math | `buildPersonaNodes(...)` + `PersonaGraph`'s internal layout | Already deterministic/SSR-safe; `persona-cloud` copied it verbatim |
| Shareability tiles | Tile assembly | `deriveBehavioralTiles(data)` | Omits absent metrics (never fabricates a 0%) |

**Key insight:** the derive layer is the moat. Every number a drill-down shows already has a pure, tested derivation function. The phase is wiring + reskin, not computation.

## Reskin Surface Area — D-07 (cited file:line)

**Render-tech note:** all charts are **SVG/CSS/DOM** (no HTML-Canvas anywhere — `PersonaGraph` is SVG `<circle>`, contrary to the CONTEXT/UI-SPEC "HTML-Canvas" label). So **every reskin is token swap + inline-style/SVG-attr edits** — no Canvas draw-color constants needed.

### Tier 1 — Token-swap (mechanical, obedient charts)
| Component | Swap | Evidence (file:line) |
|-----------|------|----------------------|
| `SegmentTable.tsx` | `text-white/90`→`text-foreground`; `text-white/40`→`text-foreground-muted`; `text-accent` (bad row) → keep | L63, L66, L79–82 |
| `_kit/DataTable.tsx` | `text-white/90`,`/80`,`/70`,`/35`→cream tokens; `border-white/[0.06]`→`--color-border` | L29–32, L50, L59, L71 |
| `_kit/StatTile.tsx` | `text-white/95`,`/75`,`/55`,`/40`→cream; `border-white/[0.06] bg-white/[0.016]`→`--color-border`/`bg-surface-elevated` low-alpha; accent tile keep | L37, L46–51, L31–33 |
| `reading.tsx` `HookPanel` (kept) | already on tokens (`text-foreground-secondary`, `var(--color-warning)`, cream gradient bar) — verify only | L256–286 |

### Tier 2 — Re-treat (matte violations — the real work)
| Component | Violation | Evidence (file:line) | Required re-treat |
|-----------|-----------|----------------------|-------------------|
| `verdict/ScoreDistribution.tsx` | Glows `0 0 Npx rgba(255,127,80,…)` on band/pin/dot; gradient panel bg; hardcoded coral; **`var(--color-frame, #161719)` fallback resolves to cold near-black (token does NOT exist — verified)**; lane inset-shine | band glow L240; pin glow L314; dot glow L326; chip shadow L338; panel gradient L72; lane inset L196–197; `--color-frame` L325; surfaces L325/L337 | Remove every `0 0 Npx` glow; pin/dot = solid `--color-accent` + hairline ring only; band = flat `--color-accent` ~8% + hairline border, no outer glow; repoint surfaces to `--color-surface`/`-elevated`; **repoint `var(--color-frame,#161719)` → `var(--color-surface)`**; flatten panel gradient; lane track flat `--color-border` |
| `audience/RetentionChart.tsx` | Hardcoded **`#FF7F50`** (old coral) on drop dot/labels/time mark; white-alpha area gradient; `rgba(255,127,80,…)` lock line / filmstrip outline / box-shadow; curve stroke `rgba(255,255,255,0.72)` | drop dot L175; delta L186; time mark L262; gradient `retentionFill` L132–135; lock line L160; filmstrip L237/L241; curve L169; ghost L148; niche tag L199 | All `#FF7F50`→`var(--color-accent)`; area fill → flat cream-alpha `rgba(236,231,222,0.06→0)`; lock line coral low-alpha, no shadow; curve stroke → cream `rgba(236,231,222,0.72)`; drop cell: drop the coral `box-shadow` glow (footage `filter` grading OK); white-alpha y-guides/labels → cream-muted |
| `content-analysis/CraftFilmstrip.tsx` | Coral **glow** `0 0 10px rgba(255,127,80,.55)` end-cap; warm soft-light grade + grain + inset shines; `rgba(255,255,255,…)` text/bars | end-cap glow L155; grade L135; grain L142; inset shines L58/L66/L120; `text-white/40` L98/L178/L186; bar `rgba(244,244,245,.26)` L171 | Remove end-cap glow (keep flat coral scalpel bar); footage grade+grain+vignette MAY stay (reads as filmed video, not chrome); white-shine inset highlights (L58/L66/L120) → hairline or remove; caption/axis `text-white/*` → cream-muted; bar fill → cream-alpha |
| `audience/RetentionPlayer.tsx` (only if included) | `#FF7F50` playhead/scrubber/readout; `backdrop-filter: blur(2px)`; `#18191a` glass tooltip w/ inset shine; `#0c0d0f` backplate; coral knob ring shadow | `#FF7F50` L204/L224/L253/L277; blur L174; glass tooltip L216; backplate L148; knob ring L205 | `#FF7F50`→`--color-accent`; **remove `backdrop-filter: blur`** (Lightning CSS strips it + matte forbids) → flat dim; tooltip → `--color-surface` flat; backplate → charcoal token; knob ring hairline, no glow |
| `_kit/PersonaGraph.tsx` | Glass hover card `bg-[#18191a]/95 border-white/10 shadow-xl`; `<animate>` opacity pulse; white-alpha dots/links/nodes; `text-white/*` in card | hover card L208; `<animate>` L188–194; white dots L95/L142/L160; node fill L160/L183; links `stroke="white"` L151; card text L215–230 | Hover card → flat `--color-surface` + hairline `--color-border`, `shadow-xl`→`--shadow-float` max; dots/nodes/links `rgba(255,255,255,…)`→cream-alpha `rgba(236,231,222,…)` (match `persona-cloud` L109); coral cluster keeps `var(--color-accent)`; **gate `<animate>` on `reducedMotion`** (prop exists, L188 already conditional — ensure panel passes `usePrefersReducedMotion()`); add mobile tap-to-reveal for the hover card |
| `_kit/KeyframeImage.tsx` (via SegmentTable) | Coral radial glow fallback; `#0c0b10` backplate; `bg-white/15` play; `text-white/85/90` | radial L77; backplate L54; play L87; overlay L83; badges L93–103 | Fallback radial → flat charcoal token (no coral halo); backplate → charcoal token; coral timecode/marked badge keeps `--color-accent`; bottom legibility scrim MAY stay |

**Token availability (verified in `globals.css`):** `--color-success/warning/error` (L57–59,102–104), `--color-accent` (L96), `--color-surface`/`-elevated` (L87–88), `--color-foreground`/`-secondary`/`-muted` (L91–93), `--color-border`/`-hover` (L109–110), `--shadow-float` (L166). **`--color-frame` is ABSENT** — the `ScoreDistribution` YouMarker fallback `var(--color-frame, #161719)` silently resolves to cold near-black; repoint to `--color-surface`.

**Re-treat scope guard (D-07):** targeted, NOT a from-scratch redesign. Swap tokens, kill glows/shines/blurs, flatten gradient *chrome* (keep footage *grading*). Preserve each chart's geometry, layout, information design.

## Graceful Degradation — D-13 / SC-2

The P2 `PanelEmpty` pattern (`reading.tsx` L361–363): `<p className="pt-2 text-[13px] text-foreground-muted">Not available for this read.</p>`. Each transplant target's null path:
| Panel | Null/empty path | Degrade |
|-------|-----------------|---------|
| score | `niche` null/thin | `ScoreDistribution` internal `lane`/`absolute` mode (honest, no throw) — acceptable in-panel |
| personas | empty `personas` → `buildPersonaNodes` returns `[]` | guard: render `PanelEmpty` (mirror `persona-cloud` null path) |
| retention | empty curve/segments | guard: `PanelEmpty` instead of empty SVG; filmstrip already self-gates (`cells.some(url)` L224) |
| retention (filmstrip) | no keyframes | `CraftFilmstrip` already neutral placeholder cells (`EMPTY_CELL_BG`), grade/grain suppressed (`hasFrames` gate L81/L128) |
| shareability | no tiles + no dim | guard: `PanelEmpty` (`deriveBehavioralTiles` returns `[]` when `behavioral_predictions` absent) |
| segment table | zero visible groups (`g.count>0` filter L39) | guard: `PanelEmpty` |
| RetentionPlayer | no `videoSrc` | falls back to static `RetentionChart` byte-for-byte (L138) |

**Guards to ADD** (the charts don't self-degrade to `PanelEmpty`, they render empty shells): personas, retention (whole-curve-empty), shareability, segment-table. Wrap each panel body with a `data`-presence check → `<PanelEmpty />`.

## Mobile Interactivity Downgrade — Discretion

Hooks confirmed present: `src/hooks/useIsMobile.ts`, `src/hooks/usePrefersReducedMotion.ts`.
- **`PersonaGraph` hover card → tap** (the real work): desktop uses `onMouseEnter`/`onMouseLeave` (L164–165). Add a touch path — tapped node shows its card, tap-elsewhere dismisses. No hover-only affordance on touch.
- **`RetentionPlayer` scrub:** already pointer-driven (`onPointerDown/Move/Up` + keyboard slider, L75–96, L240) — fine on touch.
- **`SegmentTable` sort:** keep simple; don't add a hover-only sort control (sorting is optional).
- **Reduced motion:** gate `PersonaGraph`'s `<animate>` pulse (L188 already `{!reducedMotion && …}` — just pass the prop). Gauge stroke transition already reduced-motion-gated.

## Phase-4 Awareness

Keep visuals prop-driven + side-effect-light so Phase-4 stage-reveal (`useAnalysisStream` at the container) can animate them without a rewrite. Audit:
- The leaf charts are all pure props — no internal data fetch, no self-subscription. ✅
- **The one allowed exception:** `useComparisons` (score panel) and `usePermalinkFilmstrips` (retention panel) are panel-local cached queries keyed by `id` — fine. They fire on panel mount, not on the container's reveal path, so they don't fight Phase-4's stream-driven reveal of the headline blocks.
- `tabular-nums` is universal in the transplant set — preserve it (prevents digit jitter on the Phase-4 reveal).
- No component does its own analysis-data fetch that would conflict with a future container-driven reveal. ✅

## Runtime State Inventory

> Presentation-layer reskin/remount phase — no data migrations, no stored state, no OS registrations.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — engine FROZEN, no DB writes; panels read existing `PredictionResult` / comparisons / filmstrips endpoints | None |
| Live service config | None — no external service config touched | None |
| OS-registered state | None | None |
| Secrets/env vars | None — `/api/videos/sign` (RetentionPlayer) uses existing signed-URL infra; no new keys | None |
| Build artifacts | None — no package renames; chart files may MOVE (`board/**`→shared) but that's a code edit, no stale artifacts (TS/Vite resolve fresh) | If files relocate: update imports; `vitest.config.ts` `@/` alias already covers `src/**` |

**Nothing found in any category requiring migration** — verified: this phase writes no data and changes no runtime registration. The only "state" is React `useState` panel id (ephemeral).

## Common Pitfalls

### Pitfall 1: Importing a `*Node`/`*Frame`/`*Hero` wrapper
**What goes wrong:** the whole board store + choreography hooks get pulled into the store-free reading cluster, breaking the P2 invariant and SC-2.
**Why it happens:** the Nodes are the "obvious" callers of the leaf charts; copy-pasting their JSX drags their imports.
**How to avoid:** import ONLY the leaf chart + the pure derive helpers. Re-derive props from `data`. Grep your new imports for `useBoardStore|Node|Frame|Hero` before committing.
**Warning signs:** a new `import … from '.../AudienceNode'`; a `useBoardStore` appearing under `src/components/reading/`.

### Pitfall 2: Crossing the `formatTime` wires
**What goes wrong:** retention times render in milliseconds (0:08 becomes 0:00 or garbage).
**Why it happens:** three `formatTime` helpers exist; the `TopFixesList` one is ms.
**How to avoid:** use `audience-derive.formatTime` (seconds) for everything retention/segment.
**Warning signs:** a drop time that doesn't match the curve x-position.

### Pitfall 3: Crossing the 0–10 vs 0–100 score scales
**What goes wrong:** hook bars overflow (0–100 treated as 0–10 → 1000% width) or score histogram mis-bins.
**Why it happens:** hook modalities are 0–10, ApolloDimension/overall_score are 0–100, histogram is 10 bins.
**How to avoid:** the existing components already encode the right scale — don't "fix" them. Keep the P2 `HookPanel` `* 10` math; pass `overall_score` (0–100) straight to `ScoreDistribution`/`ScoreGauge`.

### Pitfall 4: Re-treating footage grading as if it were chrome
**What goes wrong:** the filmstrip loses its "this is filmed video" read and looks like flat swatches.
**Why it happens:** the matte taste bar says "no shine" — but the filmstrip's energy grade/grain/vignette is *footage treatment*, not UI chrome.
**How to avoid:** D-07 distinguishes them. Kill glows/inset-shine highlights; KEEP `energyGradeFilter`, grain, per-cell vignette. The cited Tier-2 table separates the two per file.

### Pitfall 5: Adding a degraded-state guard the chart doesn't have
**What goes wrong:** an empty SVG / empty table renders instead of `PanelEmpty` on permalink-reload nulls (SC-2 grey-cell failure).
**Why it happens:** the leaf charts render empty shells on empty data; they don't know about `PanelEmpty`.
**How to avoid:** wrap personas/retention/shareability/segment-table panel bodies with a `data`-presence check → `<PanelEmpty />` (see Degradation table).

### Pitfall 6: `--color-frame` token assumption
**What goes wrong:** `ScoreDistribution` YouMarker dot border stays cold near-black (`#161719`) after reskin — a subtle off-palette artifact a token-swap-only pass misses.
**Why it happens:** the code references `var(--color-frame, #161719)` but `--color-frame` was never declared in the flat-warm migration (verified absent).
**How to avoid:** repoint to `var(--color-surface)` explicitly during the Tier-2 re-treat.

## Code Examples

### The `score` panel content (new — mirrors VerdictNode L244–272)
```tsx
// Source: board/verdict/VerdictNode.tsx L244-272 + board/verdict/use-comparisons.ts
import { ScoreDistribution } from '@/components/board/verdict/ScoreDistribution';
import { confidenceRange } from '@/components/board/verdict/verdict-derive';
import { useComparisons } from '@/components/board/verdict/use-comparisons';

function ScorePanel({ data, id }: { data: PredictionResult; id: string }) {
  const { data: comparisons } = useComparisons(id);          // lazy, panel-local
  const niche = comparisons?.niche ?? null;                  // NicheCohort | null
  const score = Math.round(data.overall_score);              // 0-100
  const range = confidenceRange(score, data.confidence);     // confidence is 0-1
  const showRangeText = data.confidence_label !== 'HIGH';
  return <ScoreDistribution score={score} niche={niche} range={range} showRangeText={showRangeText} />;
}
```

### The retention panel curve recipe (from AudienceNode L122-131, store-free)
```tsx
// Source: board/audience/AudienceNode.tsx L122-131 (minus recomputedCurve store branch)
import { toRetentionCurve, normalizeCurve, findBiggestDrop, totalDuration } from '@/components/board/audience/audience-derive';
import { usePermalinkFilmstrips } from '@/hooks/queries/use-permalink-filmstrips';

const filmstrips = usePermalinkFilmstrips();                 // Record<number,string>, store-free
const raw   = data.heatmap?.weighted_curve ?? null;
const curve = raw ? toRetentionCurve(normalizeCurve(raw)) : null;
const drop  = curve ? findBiggestDrop(normalizeCurve(curve)) : null;
const total = totalDuration(data.heatmap?.segments, 30);
```

## State of the Art

| Old Approach (board) | Current Approach (Reading) | Why |
|----------------------|----------------------------|-----|
| `AudienceNode` recomputes curve from client-weight overrides (`useClientWeights`) | Read `heatmap.weighted_curve` directly | Weight-override UI is board-only; the Reading shows the default mix |
| `VerdictNode` mounts `FactorBars` | `reading/driver-rows.tsx` (0–100) | D-01: FactorBars (0–10) superseded |
| Charts inside Konva-shell frames with camera/world-space | Charts as `DrillSheet` children, no shell | Canvas retired; DOM/SVG frames transplant |
| `persona-cloud.tsx` (P2 hero, dots-only) | `PersonaGraph` (full 200-dot + hover/tap) as the drill-down | D-02: hero cloud opens the full graph |

**Deprecated/outdated in the planning docs (corrected here):**
- "P3 must BUILD the filmstrip map" (UI-SPEC §retention) — `usePermalinkFilmstrips()` already provides it.
- "`PersonaGraph` is HTML-Canvas" (CONTEXT L102, UI-SPEC) — it is SVG; reskin via SVG attrs/tokens, no Canvas draw constants.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The dominant ingest path is tiktok_url (uploads secondary), so RetentionPlayer's signed-URL source is usually absent | Landmine 5 | If most real reads are uploads, RetentionPlayer would resolve more often — but the recommendation (conditional include + clean static fallback) is safe either way; UAT confirms |
| A2 | `data.emotion_arc ?? []` is the correct `arc` prop for CraftFilmstrip on permalink reload | Composed cluster | If `emotion_arc` lands under `variants` on reload (like Apollo does via `readApollo`), the audio band degrades to flat (not a throw) — acceptable per D-13; planner may add a `variants.emotion_arc` dual-read if UAT shows a flat band |

**Note:** A2 is the one place worth a planner glance — Apollo data has a dual-read (`apollo_reasoning` live vs `variants.apollo` on reload, `reading.tsx` L77–81). If `emotion_arc` / `audio_signals` / `video_signals` follow the same persistence pattern, the filmstrip's audio band + grading may need a `variants` dual-read. The chart degrades gracefully if not (flat band, neutral cells), so it's not a correctness blocker — but it affects filmstrip richness on reload.

## Open Questions

1. **Does `emotion_arc`/`audio_signals` persist top-level or under `variants` on permalink reload?**
   - What we know: Apollo uses a `variants.apollo` dual-read (`reading.tsx` L77–81); `heatmap.weighted_*` fields were explicitly mirrored into `heatmap` for reload-survival (`types.ts` L72–78).
   - What's unclear: whether `emotion_arc`/`audio_signals`/`video_signals` (CraftFilmstrip inputs) survive reload top-level or need a `variants` dual-read.
   - Recommendation: wire `data.emotion_arc ?? []` etc. now; CraftFilmstrip degrades cleanly (flat audio band, neutral cells) if absent. If the phase-close UAT shows a flat/empty filmstrip on a reloaded upload, add a `variants` dual-read for these three fields (a one-line helper like `readApollo`). Not a blocker for SC-2 (no throw, no grey-cell).

2. **Does the `/api/videos/sign` signed-URL path reliably return `ready` for owner permalink reloads of `video_upload` rows?**
   - What we know: the hook handles 404→`missing` and non-ok→`idle` gracefully.
   - What's unclear: real-world hit rate (retention deletion, storage path correctness).
   - Recommendation: ship static retention composition; gate RetentionPlayer on `status === 'ready'`; let UAT decide whether to keep the player.

## Environment Availability

> No new external dependencies. The three data endpoints the panels consume already exist and are exercised by the board today.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `/api/analysis/[id]` | container (`usePermalinkAnalysis`) | ✓ (P2 uses it) | — | — |
| `/api/analyze/[id]/comparisons` | score panel (`useComparisons`) | ✓ (board uses it) | — | `niche=null` → ScoreDistribution lane/absolute mode |
| `/api/analyze/[id]/filmstrips` | retention panel (`usePermalinkFilmstrips`) | ✓ (board uses it) | — | empty map → filmstrip self-gates to placeholders |
| `/api/videos/sign` | RetentionPlayer (optional) | ✓ (board uses it) | — | 404/idle → static RetentionChart |
| Vitest + @testing-library/react | tests | ✓ | vitest 4.0.18, RTL 16.3.2 | — |

**Missing dependencies with no fallback:** none.

## Validation Architecture

> Nyquist validation is enabled (config absent = enabled). This section defines how each transplanted visual's "renders real output, no throw / no grey-cell" criterion (SC-2) gets verified.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @testing-library/react 16.3.2 |
| Config file | `vitest.config.ts` (default env `node`; component/hook tests opt into `happy-dom` via `/** @vitest-environment happy-dom */` pragma) |
| Quick run command | `npx vitest run src/components/reading` |
| Full suite command | `npm test` (`vitest run`) — currently ~2035 green (per STATE.md) |
| Setup | `./src/test/setup.ts`; `@/` alias → `src/`; Konva aliased to stubs (no node_modules for konva — irrelevant here, charts are Konva-free) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| READ-09 | `score` panel opens from gauge tap → renders `ScoreDistribution` | component | `npx vitest run src/components/reading/__tests__/reading.test.tsx` | ⚠️ extend (gauge `onOpen` + 5th panel) |
| READ-09 | Each of the 5 panels renders its rich visual with real fixture data (no throw) | component | `npx vitest run src/components/reading` | ❌ Wave 0 (new `reading.panels.test.tsx`) |
| READ-09 | Each panel degrades to `PanelEmpty` on null/thin data (no grey-cell, no throw) | component | `npx vitest run src/components/reading` | ❌ Wave 0 (use `makeApolloNullResult`/`makePartialResult` + empty-heatmap fixtures) |
| READ-09 | Closed-union safety: `PanelId` is type-enforced, no raw-key reflection | type/compile | `npx tsc --noEmit` (or vitest type test) | ✅ enforced by `Record<PanelId,string>` |
| READ-09 | Derive helpers produce correct chart props (already covered) | unit | `npx vitest run src/components/board/audience/__tests__/audience-derive.test.ts` | ✅ exists |
| READ-09 (reskin) | Matte: no `box-shadow: 0 0`, no `backdrop-filter`, no `#FF7F50`, no glass gradient in transplanted charts | static/UAT | grep assertion + human-UAT gate | ⚠️ add a grep-based lint test + the blocking UAT gate |

### Existing test coverage (to lean on / reference)
- ✅ `board/audience/__tests__/audience-derive.test.ts` — the retention/persona/segment derivations.
- ✅ `board/content-analysis/__tests__/content-analysis-derive.test.ts` — filmstrip cells / wave bars.
- ✅ `board/verdict/__tests__/verdict-derive.test.ts` — `confidenceRange`/`bandTone`/`deriveBehavioralTiles`.
- ✅ `board/audience/__tests__/RetentionPlayer.test.tsx` — the only leaf-chart render test that exists.
- ✅ `reading/__tests__/reading.test.tsx`, `reading.degraded.test.tsx`, `reading.no-cut-data.test.tsx` — the container + D-13 degradation + READ-10 guard.
- ✅ Fixtures: `makeReadingResult`, `makeUnavailableResult`, `makePartialResult`, `makeApolloNullResult` (`reading/__tests__/fixtures/reading-fixture.ts`).

### Sampling Rate
- **Per task commit:** `npx vitest run src/components/reading` (the panel + container tests).
- **Per wave merge:** `npm test` (full suite green — must not drop below the ~2035 baseline).
- **Phase gate:** full suite green + clean `npm run build` BEFORE the D-07 human-UAT gate (precondition, same as 01-05).

### Wave 0 Gaps
- [ ] `reading/__tests__/reading.panels.test.tsx` — covers READ-09: each of the 5 panels renders its rich visual with `makeReadingResult()` (no throw), and degrades to `PanelEmpty` on empty/null-heatmap/apollo-null fixtures. (The SVG charts `RetentionChart`/`SegmentTable`/`PersonaGraph`/`CraftFilmstrip`/`ScoreDistribution`/`StatTile` have NO direct render tests today — this is the coverage gap.)
- [ ] Extend `reading.test.tsx` — gauge `onOpen` → `setPanel('score')` → `ScoreDistribution` mounts; `PANEL_TITLE.score === 'Score'`.
- [ ] Empty-data fixtures — a `makeReadingResult({ heatmap: null })` / empty-personas / empty-segments helper for the degradation assertions (extend `reading-fixture.ts`).
- [ ] Reskin lint (optional but recommended) — a grep/static test asserting the transplanted chart files contain no `box-shadow: 0 0`, no `backdrop-filter`, no `#FF7F50`, no `linear-gradient(137deg` (catches matte regressions cheaply before the UAT gate).
- [ ] No framework install needed (Vitest + RTL present).

## Security Domain

> `security_enforcement` default = enabled. This is a presentation-layer phase with no auth/crypto/storage changes; the only relevant control is the closed-union allow-list (carried from P2).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | (route already auth-gated upstream; unchanged) |
| V3 Session Management | no | unchanged |
| V4 Access Control | partial | permalink IDOR defense is upstream (unchanged); panels read only the already-authorized `data` |
| V5 Input Validation / Output Encoding | **yes** | Closed `PanelId` union — never reflect a raw key into title/content switch (threat T-02-12). `Record<PanelId,string>` makes the allow-list compiler-enforced. READ-10 no-cut-data guard stands (never spread raw `PredictionResult` into JSX). |
| V6 Cryptography | no | signed-URL infra (`/api/videos/sign`) unchanged; no new crypto |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Reflected panel key → arbitrary title/content (T-02-12) | Tampering/Info-disclosure | Closed union + typed `PANEL_TITLE` record; `setPanel('score')` literal only |
| Cut/jargon engine data leaking into a drill-down (READ-10) | Info-disclosure | Whitelisted field reads only; never spread `data` into JSX; the no-cut-data test guards it |
| Signed video URL logged/leaked (RetentionPlayer) | Info-disclosure | Existing infra; never log the URL (P2 `ThumbnailStrip` already follows this) |
| Untrusted LLM score rendered raw (NaN/105) | Tampering | `ScoreGauge` already clamps/finite-guards the displayed score (L57); `ScoreDistribution` `clampPct` clamps positions |

## Sources

### Primary (HIGH confidence — read this session)
- `src/components/reading/reading.tsx` — container, exact PanelId union / PANEL_TITLE / PanelContent switch / hero mount / D-13 gate / PanelEmpty.
- `src/components/reading/drill-sheet.tsx`, `score-gauge.tsx`, `persona-cloud.tsx` — seam + tap sources.
- `src/components/board/audience/RetentionChart.tsx`, `SegmentTable.tsx`, `RetentionPlayer.tsx`, `retention-geometry.ts`, `audience-derive.ts`, `use-uploaded-video-source.ts` — retention cluster.
- `src/components/board/content-analysis/CraftFilmstrip.tsx`, `content-analysis-derive.ts`, `content-analysis-types.ts` — filmstrip.
- `src/components/board/_kit/PersonaGraph.tsx`, `StatTile.tsx`, `KeyframeImage.tsx`, `DataTable.tsx`, `keyframe.ts`, `index.ts` — kit primitives.
- `src/components/board/verdict/ScoreDistribution.tsx`, `verdict-derive.ts`, `use-comparisons.ts`, `VerdictNode.tsx` (L238–275) — score cluster + the recipe to mirror.
- `src/components/board/audience/AudienceNode.tsx` (imports + L180–240) — the curve/filmstrip/source recipe + the store-coupled caller to AVOID.
- `src/lib/engine/types.ts` (L41–79 HeatmapPayload, L230–298 confidence/hero, L300–469 PredictionResult, L740–762 BehavioralPredictions, L840–848 ApolloDimension), `src/lib/engine/qwen/schemas.ts` (L25–57 HookDecomposition) — data shapes (Landmine 6).
- `src/hooks/queries/use-permalink-analysis.ts`, `use-permalink-filmstrips.ts` — the store-free data hooks.
- `src/app/globals.css` (L57–166) — flat-warm token availability (and `--color-frame` absence).
- `vitest.config.ts`, `package.json` — test framework.
- Definitive coupling grep across all 14 transplant files — 0 board-store matches.

### Secondary (planning docs, this milestone)
- `03-CONTEXT.md` (D-01..D-07 + the 6 landmines), `03-UI-SPEC.md` (the reskin token map + transplant contract), `02-CONTEXT.md` (the seam D-09/D-10/D-12/D-13), `01-CONTEXT.md` (THEME-06), `REQUIREMENTS.md` (READ-09), `ROADMAP.md`, `STATE.md`.

### Tertiary (LOW confidence)
- None — all claims are file-grounded.

## Metadata

**Confidence breakdown:**
- Severability map: HIGH — definitive grep + full file reads on all 14 targets.
- `score` panel edit: HIGH — verbatim current union/map/switch + the byte-exact VerdictNode recipe.
- Data scales (Landmine 6): HIGH — read from Zod schemas + type defs.
- RetentionPlayer source persistence (Landmine 5): HIGH on the mechanism (read the hook); MEDIUM on real-world hit rate (A1 — UAT confirms).
- Reskin token map: HIGH — every line cited file:line; `--color-frame` absence verified.
- Filmstrip/comparisons sourcing: HIGH — the hooks exist and are store-free (corrects the UI-SPEC).
- emotion_arc/audio persistence on reload (Open Q1 / A2): MEDIUM — degrades cleanly if wrong, flagged for UAT.

**Research date:** 2026-06-14
**Valid until:** 2026-07-14 (stable — codebase-grounded; engine frozen; only risk is concurrent edits to the read files)

---

## RESEARCH COMPLETE

**Phase:** 3 - Rich Visuals as Drill-Downs
**Confidence:** HIGH

### Key Findings
- **Severability map is entirely clean** — definitive grep across all 14 transplant targets + derive layers returns ZERO board-store/choreography/camera coupling. The "reskin + remount, not rebuild" sizing is validated by evidence; the only discipline needed is "never import a `*Node`/`*Frame`/`*Hero` wrapper" and "re-derive props prop-side."
- **The `score` panel edit is fully specified** — captured the verbatim current `PanelId` union (`'hook' | 'retention' | 'shareability' | 'personas'`), `PANEL_TITLE` map, and 4-case `PanelContent` switch, plus the exact four-touch closed-union edit and the byte-exact `VerdictNode` recipe (`confidenceRange` + `useComparisons.niche` + `showRangeText = confidence_label !== 'HIGH'`).
- **Two planning-doc corrections that SHRINK the phase:** (1) the filmstrip map already exists as `usePermalinkFilmstrips()` (store-free) — P3 calls it, doesn't build it (UI-SPEC overstated); (2) `PersonaGraph` is SVG, not HTML-Canvas — reskin via SVG attrs/tokens, no Canvas draw constants.
- **RetentionPlayer: recommend exclude/conditional** — its only permalink-reload source is the signed-URL path (`video_upload` rows only); null on the dominant tiktok_url path. Static composition is the safe default; it also carries the heaviest reskin (blur/glass/glows).
- **All data scales confirmed** (hook 0–10, ApolloDimension/overall_score 0–100, histogram 10 bins, confidence 0–1) and the three-`formatTime`-helper trap mapped; one latent reskin bug found (`--color-frame` token is absent → cold near-black fallback in ScoreDistribution).

### File Created
`.planning/phases/03-rich-visuals-as-drill-downs/03-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Zero new deps; all first-party + installed, verified in package.json |
| Architecture (severability + mount) | HIGH | Full file reads + definitive coupling grep |
| Reskin map | HIGH | Every violation cited file:line; token availability verified |
| Pitfalls / data scales | HIGH | Read from Zod schemas + type defs |
| RetentionPlayer real-world source rate | MEDIUM | Mechanism HIGH (read the hook); hit-rate is A1, UAT confirms |

### Open Questions (degrade cleanly — not blockers)
1. Whether `emotion_arc`/`audio_signals` persist top-level or under `variants` on permalink reload (CraftFilmstrip richness; degrades to flat band if wrong — flagged for UAT).
2. `/api/videos/sign` real-world `ready` rate for RetentionPlayer (gate on `status==='ready'`; static fallback).

### Ready for Planning
Research complete. The planner has the exact severability map, the precise `reading.tsx` edit, the per-panel prop-derivation recipes, the cited reskin token map (Tier-1/Tier-2), the degradation guards to add, and the Validation Architecture (Wave-0 test gaps + the blocking D-07 human-UAT gate). Nothing in scope turns "reskin + remount" into "rebuild."
