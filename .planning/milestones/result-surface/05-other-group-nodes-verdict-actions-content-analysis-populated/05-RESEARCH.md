# Phase 5: Other group nodes — Verdict + Actions + Content Analysis populated - Research

**Researched:** 2026-05-27
**Domain:** DOM-overlay node bodies (Recharts area/bar charts + GlassProgress bars + Radix collapsibles + dashed-placeholder cards) inside Phase 2-shipped Konva group frames + cross-group state coordination (anti-virality ripple)
**Confidence:** HIGH — Phase 4 patterns (NodeOverlay composition, PersonaInspector, TapPopover, AntiViralityOverlay, HeatmapDrawer) are shipped and directly reusable. Engine schema (`PredictionResult`, `HookDecomposition`, `EmotionArcPoint`, `CounterfactualResult`, `RetrievalEvidenceItem`) is locked and verified in `src/lib/engine/types.ts` + `src/lib/engine/qwen/schemas.ts`. Recharts (3.7.0 installed, 3.8.1 latest) has shipped patterns in the codebase. Single MEDIUM-confidence gap: comparison data source (D-09) needs lock during planning.

---

## Summary

Phase 5 plugs three node bodies into already-existing Phase 2 group frames (Verdict 360×280, Actions 360×200, Content-Analysis 1352×200) — same pattern Phase 4 used for the Audience node. Konva renders nothing inside these node bodies; everything is DOM overlay rendered inside `GroupFrameOverlay` via the children prop (`Board.tsx:289-305`). Verdict gets a hero percentile chip + confidence pill + two collapsibles (reasoning narrative + history comparison) + conditional orange anti-virality header. Actions gets a 2×2 card grid with three dashed placeholders (reshoot/optimal-post/share) + one real `SimilarVideosCard` consuming `result.retrieval_evidence`. Content-Analysis splits horizontally into a Hook decomp node (4-bar GlassProgress + chips) and an Emotion arc node (Recharts AreaChart with coral gradient). Phase 5 also refactors Phase 4's hard-coded anti-virality frame check at `Board.tsx:47` into a `useAntiViralityAffectedFrames()` selector that returns `{verdict, audience, actions}` — Phase 5 ships the abstraction for R1.9 future ripple signals.

**Primary recommendation:** Ship 9 sub-plans in dependency order — **5.0 cross-group-state.ts refactor (foundation for 5.1-5.9 anti-virality coordination) → 5.1 VerdictNode shell + PercentileChip → 5.2 WhyVerdictCollapsible (depends on 5.1) → 5.3 VsHistoryCollapsible + comparisons endpoint → 5.4 AntiViralityHeader + TopFixesList → 5.5 ActionsNode shell + PlaceholderCard primitive → 5.6 SimilarVideosCard + SimilarVideoCardCompact → 5.7 HookDecompNode → 5.8 EmotionArcNode → 5.9 final Board.tsx wiring + verification**. Plans 5.1+5.5+5.7+5.8 are independent and parallelizable after 5.0 lands. Install `react-markdown` + `rehype-sanitize` (Verdict 5.2 only; ~50KB gzipped combined). Reuse Recharts AreaChart + linearGradient patterns from `src/components/competitors/charts/follower-growth-chart.tsx` (verified identical shape). DO NOT extract a generic `Inspector` primitive in Phase 5 — Phase 4's `PersonaInspector` is persona-specific and Hook decomp's expand should reuse the existing Sheet+side="bottom|right" pattern directly (option (b) from CONTEXT D-O3 Discretion).

**Top risks (mitigated below):**
1. Recharts bundle impact — already in the stack (verified `package.json` line 47 `recharts: ^3.7.0`); adding AreaChart + 2× BarChart adds ~0-5KB (chart components tree-shake; codebase already imports `AreaChart` in `competitors/charts/follower-growth-chart.tsx` line 5). Verified.
2. Comparison endpoint (D-09) — three viable paths exist. Recommend **server endpoint** for correctness + future cache. See §Don't Hand-Roll + §Open Questions.
3. Reasoning narrative client-side assembly fragility (O-2) — recommend simplest split: render `result.reasoning` as a single intro paragraph inside the collapsible, then 4 buckets driven by `factors` score thresholds + `warnings` + `counterfactuals` (NOT sentence-level sentiment on the prose). Avoids brittle regex on free-form DeepSeek output.
4. SSR + Recharts — Recharts uses `window` measurement via `ResponsiveContainer`; works fine because the Verdict/Actions/Content-Analysis nodes mount inside Board's `'use client'` tree (Board.tsx:1) and are rendered only after the BoardCanvas dynamic import completes. No SSR-only wrappers needed.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Architectural optimizations (O-1 … O-6, all accepted):**
- **O-1** Konva = frame-positioning only; ALL node body content = DOM overlay (Verdict chips/collapsibles, Actions cards, Hook decomp bars, Emotion arc Recharts). Mirrors Phase 4 O-1.
- **O-2** Reasoning narrative = client-side assembly from `result.reasoning` + `warnings[]` + `factors[]` + `counterfactuals.suggestions[]`. No engine schema change.
- **O-3** Reuse Phase 4 primitives: `GlassPanel`, `GlassProgress`, `GlassPill`, `Card`, `TapPopover`, `PersonaInspector` shell pattern. No new bottom-sheet / inspector infra.
- **O-4** Centralize anti-virality selector — refactor `Board.tsx:47` `frameId === 'verdict' || 'audience'` into `useAntiViralityAffectedFrames(): Set<FrameId>` returning `{verdict, audience, actions}` when `boardState === 'anti-virality'`.
- **O-5** Content-Analysis frame = horizontal split (Hook decomp left ~480px + Emotion arc right ~872px), no stack; expand routes to inspector, not in-place growth.
- **O-6** Build `SimilarVideoCardCompact` as a NEW compact-mini-tile component (~80 lines); DO NOT reuse `/trending`'s `VideoCard` (190 LOC, depends on `useBookmarkStore`, wrong visual model for 56×56 thumb).

**Verdict (D-01 … D-09):**
- **D-01** Stack: anti-virality header (conditional 40px) → percentile chip row (~72px) → "Why this verdict?" collapsible (24px collapsed / ~280px expanded) → "vs my history" collapsible (24px / ~200px). Both default-closed.
- **D-02** Percentile chip = `text-5xl/6xl` semibold Inter, coral when ≥70 else white/95. Band label below ("Strong / Mid / Low").
- **D-03** Confidence chip = small `GlassPill` to the right, content from `result.confidence_label` ("HIGH" | "MEDIUM" | "LOW"). White/60 text, no coral accent. Tap → popover explaining confidence.
- **D-04** Anti-virality state header (when `result.anti_virality_gated === true`) = full-bleed 40px orange band at top, copy `⚠ Don't post yet — fixable in {N} steps` where N = `counterfactuals.suggestions.filter(s => s.type === 'fix').length` capped at 3. Coral-to-orange gradient.
- **D-05** Reasoning collapsible body = 4 sub-sections from O-2 mapping. Inline `[seg N]` citations = static text styling (subtle coral underline); live-jump deferred to M2-II. Markdown via `react-markdown` + `rehype-sanitize`.
- **D-06** History collapsible body = two horizontal Recharts BarChart instances: (a) "vs your last 10" = 11 bars (current coral + 10 prior white/30), (b) "vs niche cohort" = 3-bar mini (current coral + niche median white/30 + niche p75 white/15). No CartesianGrid.
- **D-07** Empty state (< 3 prior analyses) = inline `"Need 3+ prior analyses to show comparison. {N}/3 complete."` Section header stays visible.
- **D-08** Top-3 fixes anchored to segments — only when `anti_virality_gated`, rendered inside "Counterfactual considered" sub-section. Each = small card with `[seg N · 0:08]` timestamp pill + `headline` ≤80 chars + `detail` 1-2 sentences. Tap timestamp pill → `setActivePreset('audience')`.
- **D-09** **Claude's Discretion** — comparison data source. Researcher locks one of: (a) ship `/api/analyze/[id]/comparisons` endpoint, (b) use existing TanStack Query against existing list endpoint, (c) compute client-side from cached analyses list. **This research recommends (a)**.

**Actions (D-10 … D-14):**
- **D-10** Internal layout = base 2×2 grid (~170×88 per card) in 360×200 frame. Anti-virality state = frame grows to 360×360, top half full-bleed `ActionsReshootHeroSlot` (Phase 6 fills), bottom half stays 2×2 with Optimal-post / Similar / Share + Reshoot-summary stub.
- **D-11** Placeholder card treatment = dim `bg-white/[0.02]` + border-dashed (NOT solid) + centered icon + label `"{name}" + "Coming in Phase {N}"` in white/40. Not interactive.
- **D-12** Similar videos card = real, this phase. 56×56 thumb + `@handle` + view count + similarity score. 5 items horizontal compact list.
- **D-13** Similar-videos empty state = when `retrieval_evidence[]` empty OR `signal_availability.retrieval === false`, show `"No similar videos yet — try a new analysis"` + refresh icon.
- **D-14** Similar-video tap → existing `src/components/trending/tiktok-embed.tsx` modal. Placeholder cards = no tap action.

**Content Analysis (D-15 … D-20):**
- **D-15** Frame 1352×200 = horizontal split: Hook decomp left ~480px + 16px gap + Emotion arc right ~872px. 8px padding. No inline expand; tap → inspector.
- **D-16** Hook decomp composition: headline strip (28px) + 4-bar GlassProgress stack (120px, each ~22px) + weakest-modality background tint + chip row (32px) with `Coherence: {N}/10` + `Cognitive load: Low/Med/High` (INVERTED polarity).
- **D-17** Hook decomp empty state (null `hook_decomposition`) = render 4 bars at 0 + caption "Hook analysis unavailable for this video". Don't hide node.
- **D-18** Emotion arc composition: headline strip (28px, "Emotion arc" + peak timestamp chip) + Recharts AreaChart body (140px) with linearGradient (gray → coral-200 → coral-500) + 6px coral dots on `label === 'high'`, gray dots on `label === 'low'`. Tap dot → popover.
- **D-19** Emotion arc empty state (null `emotion_arc`) = flat baseline at y=0.5 in gray + caption "Emotion arc unavailable".
- **D-20** Recharts (NOT canvas) for emotion arc — static post-`complete`, no streaming morph. Phase 4's canvas decision was driven by streaming + slider scrub, doesn't apply here.

**Cross-group ripple (D-21 … D-24):**
- **D-21** Extract `Board.tsx:47` resolver to `src/components/board/cross-group-state.ts`: `useAntiViralityAffectedFrames(): Set<FrameId>` + `getFrameAntiViralityState(frameId): 'idle' | 'anti-virality' | 'complete'`.
- **D-22** `<ActionsReshootHeroSlot />` exposed as Phase 5-created component, dashed placeholder in Phase 5, swapped by Phase 6.
- **D-23** Single `useBoardStore` source of truth for anti-virality; Verdict header + Audience filmstrip chips + Actions hero slot all subscribe.
- **D-24** Resolver takes a state-name argument (`'anti-virality'` for now) so future signals (high-confidence loop, exceptional hook score) plug in without refactoring `Board.tsx`.

**Streaming + state (D-25 … D-26):**
- **D-25** Skeleton states while `boardState !== 'complete'`: Verdict percentile = `--`, confidence = "Calculating…", collapsibles disabled. Hook decomp = 4 bars at 0% + shimmer. Emotion arc = flat gray baseline. Actions placeholders render immediately (no skeleton). Similar videos = 5 mini-row skeletons.
- **D-26** Anti-virality transition timing inherited from Phase 4 `Board.tsx` useEffect at lines 109-143. Animation = 200ms ease-out opacity + height.

**Accessibility + perf (D-27 … D-30):**
- **D-27** `prefers-reduced-motion` = simple height transition on collapsibles, Recharts `isAnimationActive={false}`, Hook decomp bar fills jump to final.
- **D-28** Perf-tier degradation = Low tier: Recharts emotion arc still renders, tap-popover dots disabled (only ReferenceDots stay). Medium tier: full features.
- **D-29** `aria-live="polite"` regions debounced 500ms: Verdict announces "Verdict ready: {score}, confidence {level}" + "Don't post yet — see suggested fixes" on AV transition. Hook decomp announces "Hook score: {weakest_modality} is weakest". Emotion arc announces peak timestamp.
- **D-30** Keyboard nav = bias `<details>` element for built-in semantics (researcher confirmed — see Pattern 4). Tab through hook decomp bars + emotion arc dots, Enter opens inspector.

**Telemetry (D-31):**
- Structured logger events: `verdict_node_rendered`, `verdict_reasoning_expanded`, `verdict_history_expanded`, `verdict_anti_virality_override`, `hook_decomp_expanded`, `emotion_arc_peak_tapped`, `similar_video_tapped`, `actions_reshoot_placeholder_visible`, `cross_group_ripple_applied`.

### Claude's Discretion (resolved in this doc)

- **Reasoning narrative split heuristic** → **resolved**: render `result.reasoning` as single intro paragraph above 4 buckets driven by `factors[]` score thresholds + `warnings` + `counterfactuals`. No sentence-level sentiment classification. (See §Architecture Pattern 1.)
- **Engine-side `reasoning_sections` field** → **deferred to v1.1**; Phase 5 ships client-side assembly only.
- **Markdown renderer** → **install `react-markdown@10.1.0` + `rehype-sanitize@6.0.0`** (~50KB gzipped combined). Verified neither is currently installed in `package.json`.
- **Percentile vs raw score interpretation** → **direct use of `overall_score`** — `PredictionResult.overall_score` is 0-100 per `types.ts:212`. Calibration via Platt scaling is documented at `is_calibrated: boolean` (types.ts:215). No additional percentile derivation needed for Phase 5 baseline.
- **Comparison endpoint vs client-side aggregation (D-09)** → **server endpoint `/api/analyze/[id]/comparisons`**. Rationale: enables future server-side niche cohort caching, avoids loading 10 full PredictionResult rows into the client, future-proofs for the niche_post_windows materialized-view precedent (Phase 1 D-13).
- **Recharts version + tree-shaking** → **3.7.0 installed (3.8.1 latest)** — verified via `npm view recharts version`. Already used at: `competitors/comparison/comparison-bar-chart.tsx` (BarChart), `competitors/charts/follower-growth-chart.tsx` (AreaChart with linearGradient — direct template for Emotion arc), `app/brand-deals/earnings-chart.tsx` (AreaChart with defs/linearGradient), `competitors/comparison/comparison-growth-chart.tsx` (AreaChart). Bundle delta ~0KB (already imported).
- **`SimilarVideoCardCompact` extraction location** → **`src/components/board/actions/SimilarVideoCardCompact.tsx`** (proposed). Confirmed Phase 5 is the only consumer — keep local.
- **Inspector primitive extraction (O-3)** → **option (b)**: build node-specific `HookDecompInspector` using Phase 4's `Sheet` pattern directly (not extracting a base primitive). Rationale: `PersonaInspector` has persona-specific shape (`heatmap.personas.find`, attention sparkline canvas, segment_reasons timeline) — generic extraction would be premature. Both Hook decomp + Emotion arc inspectors reuse the `Sheet` + `side={isMobile ? 'bottom' : 'right'}` pattern directly. Total inspector boilerplate ~40 LOC each.
- **Anti-virality override (D-04 / R1.3)** → small "Post anyway →" link in orange header. On tap: `verdict_anti_virality_override` event + dismiss header + persist dismissal per `analysisId` in localStorage so re-mount doesn't re-show. NO engine state change.
- **Comparison chart axes + tooltips (D-06)** → **reuse `ChartTooltip`** from `src/components/competitors/charts/chart-tooltip.tsx` (verified — shared dark theme tooltip with surface bg + foreground colors).
- **Emotion arc x-axis label format** → `mm:ss`. Check `src/lib/utils.ts` for existing util first; if absent, inline `formatTime(ms)` helper.
- **Hook decomp cognitive_load polarity** → invert to display label: raw 0-3=Low, 4-6=Med, 7-10=High. Never surface raw 0-10 directly. Schema comment at `src/lib/engine/qwen/schemas.ts:27` explicitly warns about inverted polarity.
- **Reduced-motion for Recharts** → `<Area isAnimationActive={!prefersReducedMotion}>`. Same pattern used in `competitors/charts/follower-growth-chart.tsx:82` (`isAnimationActive={false}` hard-coded; we want conditional).
- **Actions frame default state when NO similar videos AND NO anti-virality** → bottom-left card stays as empty-state similar-videos card per D-13. Frame stays 360×200. Reads as intentional.

### Deferred Ideas (OUT OF SCOPE)

Engine-side `reasoning_sections` field, live-jump citations (`[seg 4]` → camera pan), reshoot script content (Phase 6), optimal post time content (Phase 6), share & export content (Phase 7), per-creator vs niche cohort percentile derivation, comparison chart history depth > 10, pgvector-based niche identification, free-form "Why did X factor score low?" co-pilot, anti-virality override with rationale text input, Recharts→canvas swap for emotion arc, inspector primitive extraction, hook decomp drill-down to individual modality fixes (Phase 6 owns), emotion arc audio waveform underlay, Verdict "Save analysis"/"Pin to dashboard", comparison charts as interactive scrub.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R1.3 | Verdict node — percentile + confidence + AV header + "Why this verdict?" + "vs my history" + override | §Architecture Pattern 1 (4-bucket assembly) + §Architecture Pattern 5 (collapsibles) + §Code Examples 2 (BarChart) + §Common Pitfalls 1, 4 |
| R1.4 | Actions node container — reshoot/optimal/similar/share children + reshoot-hero promotion when AV | §Architecture Pattern 2 (2×2 grid + grow-to-hero) + §Architecture Pattern 6 (PlaceholderCard) |
| R1.5 | Similar videos — Top-5 pgvector matches, VideoCard mini-tiles, TikTok embed modal | §Code Examples 4 (SimilarVideoCardCompact) + §Don't Hand-Roll item 3 (reuse `tiktok-embed`) |
| R1.6 | Hook decomp node — 4-bar GlassProgress + coherence + cognitive load chips + expandable | §Architecture Pattern 3 (Hook decomp composition) + §Code Examples 1 (GlassProgress stack) |
| R1.7 | Emotion arc node — Recharts area chart, gray→coral-200→coral-500 gradient, peak/valley markers | §Architecture Pattern 4 (Recharts AreaChart) + §Code Examples 3 (linearGradient + ReferenceDot) |
| R1.8 | Comparative baseline (vs last 10 + vs niche cohort) — two horizontal bar charts + empty state | §Code Examples 2 (BarChart) + §Open Questions 1 (D-09 endpoint lock) |
| R1.9 | Cross-group state coordination — anti-virality ripples to Verdict + Audience + Actions | §Architecture Pattern 7 (cross-group-state.ts) + §Common Pitfalls 2 |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Verdict body composition (chips + collapsibles) | Browser/Client | — | Pure UI; reads `useAnalysisStream().result`. No server logic. |
| Reasoning markdown render | Browser/Client | — | `react-markdown` runs client-side; `rehype-sanitize` strips XSS client-side. |
| History comparison data | API/Backend | Database | Aggregates `analyses` rows for user_id (Supabase RLS-gated) + niche aggregates. New endpoint `/api/analyze/[id]/comparisons`. |
| Comparison chart render | Browser/Client | — | Recharts SVG, static post-fetch. |
| Actions placeholder cards | Browser/Client | — | Pure UI; no data. |
| Similar videos data | Browser/Client | — | Already in `result.retrieval_evidence[]` from Phase 8 engine work — no fetch. |
| Similar video tap → TikTok embed | Browser/Client | External (TikTok CDN) | TikTok embed.js script loaded client-side per `trending/tiktok-embed.tsx`. |
| Hook decomp bars | Browser/Client | — | Reads `result.hook_decomposition.*` directly. |
| Emotion arc Recharts | Browser/Client | — | Reads `result.emotion_arc[]`. SVG render only. |
| Cross-group anti-virality selector | Browser/Client | — | `useBoardStore` Zustand selector. Pure derivation from `boardState`. |
| Anti-virality override persistence | Browser/Client | — | `localStorage` per analysisId. No DB write. |
| Telemetry events | Browser/Client | API/Backend | Structured logger fires client-side; backend log sink already wired. |

**Tier check passes:** No capability is misassigned. The only API/Backend addition is the comparisons endpoint, and that's intentional per D-09 lock.

---

## Standard Stack

### Core (already installed — no installs needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | ^3.7.0 (latest 3.8.1) [VERIFIED: package.json line 47, npm view] | AreaChart for emotion arc + BarChart for history comparison | Already in stack; 4 existing chart components use it; React 19 compatible |
| zustand | ^5.0.10 [VERIFIED: package.json] | `useBoardStore` for cross-group anti-virality state subscription | Already shipped Phase 2 |
| @tanstack/react-query | ^5.90.21 [VERIFIED] | Fetch `/api/analyze/[id]/comparisons` with cache + retry | Already shipped Phase 1 SSE consumer |
| radix-ui (Sheet, Popover) | ^1.4.3 [VERIFIED] | Inspector bottom-sheet (mobile) / right-side panel (desktop) | Phase 4 PersonaInspector + TapPopover both use radix-ui |
| @phosphor-icons/react | ^2.1.10 [VERIFIED] | CaretDown/CaretUp for collapsibles + RefreshCw for similar-video empty state | Already used in `HeatmapDrawer.tsx` |

### Supporting (install required for Phase 5)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-markdown | ^10.1.0 [VERIFIED: npm view react-markdown version] | Render `result.reasoning` markdown inside Verdict's "Why this verdict?" collapsible | ONLY Verdict 5.2 |
| rehype-sanitize | ^6.0.0 [VERIFIED: npm view] | XSS sanitization layer for DeepSeek-emitted markdown | REQUIRED pair with react-markdown |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-markdown | Plain-text render of `result.reasoning` | Loses bold/italic/list structure DeepSeek may emit; saves ~50KB |
| react-markdown | `marked` + manual sanitize | `react-markdown` already integrates rehype plugins; less custom wiring |
| Recharts AreaChart | Hand-rolled SVG `<path>` for emotion arc | Recharts already in stack; hand-roll only if perf-tier audit (Phase 8) flags it |
| Recharts BarChart | Hand-rolled flexbox `<div>` bars | Recharts gives free tooltips + axis labels; div approach cheaper but loses interactivity |
| Custom `Inspector` primitive | Per-node inspectors using `Sheet` directly | Extraction is premature — PersonaInspector is persona-specific; ship per-node, extract later if 3+ inspectors converge |

**Installation:**
```bash
npm install react-markdown@^10.1.0 rehype-sanitize@^6.0.0
```

**Version verification:** Both packages verified via `npm view {pkg} version` on 2026-05-27. Last published: react-markdown 10.1.0 (active), rehype-sanitize 6.0.0 (active). [VERIFIED: npm registry]

---

## Architecture Patterns

### System Architecture Diagram

```
                                  ┌──────────────────────────────────────────┐
                                  │ useAnalysisStream (Phase 1)              │
                                  │ → result: PredictionResult               │
                                  │ → phase: 'complete' | 'anti-virality'    │
                                  └──────────────┬───────────────────────────┘
                                                 │
                                                 ↓
                                  ┌──────────────────────────────────────────┐
                                  │ useBoardStore (Zustand, Phase 2)         │
                                  │ → boardState: 'complete' | 'anti-...'    │
                                  │ → triggerAntiVirality()                  │
                                  └──────────────┬───────────────────────────┘
                                                 │
                                                 ↓
                            ┌────────────────────────────────────────────────┐
                            │ cross-group-state.ts (Phase 5 NEW — D-21)      │
                            │ useAntiViralityAffectedFrames(): Set<FrameId>  │
                            │ getFrameAntiViralityState(id): visual-state    │
                            └─────┬──────────────────┬──────────────────┬────┘
                                  │                  │                  │
                  ┌───────────────┘                  │                  └────────────────┐
                  ↓                                  ↓                                   ↓
        ┌──────────────────┐               ┌────────────────────┐              ┌──────────────────┐
        │ VerdictNode      │               │ ActionsNode        │              │ ContentAnalysis  │
        │ (Phase 5)        │               │ (Phase 5)          │              │ Frame (Phase 5)  │
        ├──────────────────┤               ├────────────────────┤              ├──────────────────┤
        │ AntiViralityHdr  │               │ 2×2 cards default  │              │ HookDecompNode   │
        │ PercentileChip   │               │ → grows when AV    │              │  4-bar GlassProg │
        │ ConfidenceChip   │               │ ReshootHeroSlot    │              │  cohchip + cogld │
        │ <details>        │               │ OptimalPostSlot    │              │  → Sheet (insp)  │
        │  WhyVerdict      │               │ SimilarVideosCard  │              ├──────────────────┤
        │   ↓ 4 sections   │               │ ShareSlot          │              │ EmotionArcNode   │
        │   react-markdown │               │                    │              │  Recharts Area + │
        │  TopFixesList    │               │ All placeholders   │              │  linearGradient  │
        │ <details>        │               │ = dashed border    │              │  ReferenceDot    │
        │  VsHistory       │               │ + dim + "Phase N"  │              │  → Sheet (insp)  │
        │   ↓ Recharts ×2  │               │                    │              │                  │
        └──────┬───────────┘               └─────┬──────────────┘              └─────┬────────────┘
               │                                  │                                   │
               │ fetch                            │ reads                             │ reads
               ↓                                  ↓                                   ↓
        ┌──────────────────┐               ┌────────────────────┐              ┌──────────────────┐
        │ /api/analyze/    │               │ result.retrieval_  │              │ result.hook_     │
        │ [id]/comparisons │               │ evidence[] (Phase  │              │ decomposition +  │
        │ (Phase 5 NEW)    │               │ 8 already shipped) │              │ result.emotion_  │
        │ → history + niche│               │ → 5 items max      │              │ arc[] (Phase 1)  │
        └─────┬────────────┘               └─────┬──────────────┘              └──────────────────┘
              │                                  │
              ↓                                  ↓ tap
        ┌──────────────────┐               ┌────────────────────┐
        │ Supabase         │               │ src/components/    │
        │ analyses table   │               │ trending/tiktok-   │
        │ + niche aggregate│               │ embed.tsx (reuse)  │
        └──────────────────┘               └────────────────────┘
```

### Component Responsibilities

| Component | File | Owns |
|-----------|------|------|
| Cross-group resolver | `src/components/board/cross-group-state.ts` (NEW) | `useAntiViralityAffectedFrames()`, `getFrameAntiViralityState(id)` |
| Verdict shell | `src/components/board/verdict/VerdictNode.tsx` (NEW) | Top-level composition, local state (override dismissed, collapsibles open) |
| Percentile chip | `src/components/board/verdict/PercentileChip.tsx` (NEW) | Big number + band label + confidence pill |
| AV header | `src/components/board/verdict/AntiViralityHeader.tsx` (NEW) | Orange band + override link + telemetry |
| Why-verdict collapsible | `src/components/board/verdict/WhyVerdictCollapsible.tsx` (NEW) | `<details>` + 4 sub-sections from O-2 assembly |
| Vs-history collapsible | `src/components/board/verdict/VsHistoryCollapsible.tsx` (NEW) | `<details>` + 2 Recharts BarCharts + empty state |
| Top-3 fixes list | `src/components/board/verdict/TopFixesList.tsx` (NEW) | Renders inside WhyVerdict when AV; segment-pill tap → camera pan |
| Comparison data hook | `src/components/board/verdict/use-comparisons.ts` (NEW) | TanStack Query against new endpoint |
| Comparison endpoint | `src/app/api/analyze/[id]/comparisons/route.ts` (NEW) | Server reads analyses table + niche aggregates |
| Actions shell | `src/components/board/actions/ActionsNode.tsx` (NEW) | 2×2 grid layout, AV-driven grow-to-hero |
| Placeholder primitive | `src/components/board/actions/PlaceholderCard.tsx` (NEW) | Dashed border + dim + label + icon |
| Reshoot hero slot | `src/components/board/actions/ActionsReshootHeroSlot.tsx` (NEW) | Phase 5 = placeholder; Phase 6 swaps |
| Optimal post slot | `src/components/board/actions/ActionsOptimalPostSlot.tsx` (NEW) | Phase 5 placeholder; Phase 6 swaps |
| Share slot | `src/components/board/actions/ActionsShareSlot.tsx` (NEW) | Phase 5 placeholder; Phase 7 swaps |
| Similar videos card | `src/components/board/actions/SimilarVideosCard.tsx` (NEW) | 5 compact rows + tap routes to embed modal + empty state |
| Similar video compact | `src/components/board/actions/SimilarVideoCardCompact.tsx` (NEW) | 56×56 thumb + handle + views + similarity score |
| Content-analysis frame | `src/components/board/content-analysis/ContentAnalysisFrame.tsx` (NEW) | Horizontal split 480px + 872px |
| Hook decomp node | `src/components/board/content-analysis/HookDecompNode.tsx` (NEW) | 4-bar GlassProgress + chips + tap-to-inspector |
| Hook decomp inspector | `src/components/board/content-analysis/HookDecompInspector.tsx` (NEW) | Sheet body with full reasoning + fix anchored to `signal_anchor === 'hook'` |
| Emotion arc node | `src/components/board/content-analysis/EmotionArcNode.tsx` (NEW) | Recharts AreaChart + linearGradient + ReferenceDots |
| Emotion arc inspector | `src/components/board/content-analysis/EmotionArcInspector.tsx` (NEW) | Sheet with larger arc + per-peak detail |

### Recommended Project Structure
```
src/
├── components/board/
│   ├── cross-group-state.ts                 # NEW (D-21 — resolver)
│   ├── Board.tsx                            # MODIFIED (extract :47 derive)
│   ├── verdict/                             # NEW folder (mirrors audience/)
│   │   ├── VerdictNode.tsx
│   │   ├── PercentileChip.tsx
│   │   ├── AntiViralityHeader.tsx
│   │   ├── WhyVerdictCollapsible.tsx
│   │   ├── VsHistoryCollapsible.tsx
│   │   ├── TopFixesList.tsx
│   │   ├── use-comparisons.ts
│   │   ├── verdict-constants.ts
│   │   ├── verdict-types.ts
│   │   └── __tests__/
│   ├── actions/                             # NEW folder
│   │   ├── ActionsNode.tsx
│   │   ├── PlaceholderCard.tsx
│   │   ├── ActionsReshootHeroSlot.tsx
│   │   ├── ActionsOptimalPostSlot.tsx
│   │   ├── ActionsShareSlot.tsx
│   │   ├── SimilarVideosCard.tsx
│   │   ├── SimilarVideoCardCompact.tsx
│   │   ├── actions-constants.ts
│   │   ├── actions-types.ts
│   │   └── __tests__/
│   └── content-analysis/                    # NEW folder
│       ├── ContentAnalysisFrame.tsx
│       ├── HookDecompNode.tsx
│       ├── HookDecompInspector.tsx
│       ├── EmotionArcNode.tsx
│       ├── EmotionArcInspector.tsx
│       ├── content-analysis-constants.ts
│       ├── content-analysis-types.ts
│       └── __tests__/
└── app/api/analyze/[id]/comparisons/
    └── route.ts                             # NEW (Next.js Route Handler)
```

### Pattern 1: Reasoning Narrative Client-Side Assembly (D-05 / O-2)

**What:** Map locked `result.reasoning` (DeepSeek narrative string) + `result.warnings[]` + `result.factors[]` + `result.counterfactuals?.suggestions[]` into 4 chip-headed sub-sections without engine schema changes.

**When to use:** Inside `WhyVerdictCollapsible` body. Default-open all 4 buckets when parent opens (simpler mental model than per-bucket toggling).

**Recommended split (simplest):**
- Render `result.reasoning` as a single `<ReactMarkdown rehypePlugins={[rehypeSanitize]}>` intro paragraph at top of collapsible body.
- Sub-section 1 "Why this works": filter `factors[]` where `score >= 7` (out of 10 — uses `FactorSchema` ScoreSchema 0-10 from `src/lib/engine/types.ts:432`). Render each as bullet with `f.name` + `f.rationale`.
- Sub-section 2 "Why this might not": filter `factors[]` where `score < 4`. Render with `f.improvement_tip`.
- Sub-section 3 "What the engine flagged": render `result.warnings[]` as `<ul>` with badge styling. Empty array = section hidden.
- Sub-section 4 "Counterfactual considered": render `result.counterfactuals.suggestions.filter(s => s.type === 'fix' || s.type === 'stretch')`. Each = card with `[seg N · 0:08]` timestamp pill (from `timestamp_ms`) + `headline` + `detail`. When `anti_virality_gated === true`, this sub-section ALSO renders `TopFixesList` (D-08) with the same data filtered to `type === 'fix'`.

**Why simplest wins:** Sentence-level sentiment classification on DeepSeek's prose is brittle (no guarantee of positive/negative cue words). `factors[]` already has numeric scores with explicit semantics. `warnings[]` is already a flat string array. `counterfactuals.suggestions[]` has explicit `type` discriminators. Use what the engine already classified.

**Example:**
```typescript
// Source: derived from src/lib/engine/types.ts:227 + 311 + 423
function assembleReasoningBuckets(result: PredictionResult) {
  return {
    intro: result.reasoning,
    works: result.factors.filter((f) => f.score >= 7),
    mightNot: result.factors.filter((f) => f.score < 4),
    flagged: result.warnings,
    counterfactual: result.counterfactuals?.suggestions
      .filter((s) => s.type === 'fix' || s.type === 'stretch')
      .slice(0, 5)
      ?? [],
  };
}
```

### Pattern 2: 2×2 Actions Grid with Grow-to-Hero (D-10)

**What:** Default 2×2 card grid (~170×88 each) in 360×200 frame. When `getFrameAntiViralityState('actions') === 'anti-virality'`, frame grows to 360×360 (mirrors Phase 2 D-03 frame-growth-on-expand pattern), top half becomes full-bleed `ActionsReshootHeroSlot`, bottom half stays 2×2.

**Implementation:** CSS Grid with `grid-template-rows: ${isAV ? '160px 160px' : '88px 88px'}` and a conditional `<ActionsReshootHeroSlot />` at the top spanning both columns when AV. Frame height is managed by `GroupFrameOverlay` reading from a Phase 2-shipped `expanded` state — Phase 5 may need to extend `board-constants.ts:31` `actions` height OR add an `actionsGrown` derived state.

**Open Question 2** below tracks the frame-height mechanism choice.

### Pattern 3: Hook Decomp 4-Bar Stack (D-16)

**What:** Four horizontal `GlassProgress` bars stacked vertically, each ~22px tall (label left ~120px, bar middle, score right ~32px). Headline strip 28px above + chip row 32px below = 180px total fits in 200px - 16px padding = 184px node bounds.

**Composition:**
```typescript
// Source: composed from src/components/primitives/GlassProgress.tsx + src/lib/engine/qwen/schemas.ts:15
import { GlassProgress } from '@/components/primitives/GlassProgress';
import { GlassPill } from '@/components/primitives/GlassPill';

interface HookDecompProps { decomp: HookDecomposition | null; segments: SegmentGrid[]; }

function HookDecompBody({ decomp, segments }: HookDecompProps) {
  if (!decomp) return <EmptyState caption="Hook analysis unavailable" />;
  const bars = [
    { key: 'visual_stop_power', label: 'Visual stop power', value: decomp.visual_stop_power },
    { key: 'audio_hook_quality', label: 'Audio hook', value: decomp.audio_hook_quality },
    { key: 'text_overlay_score', label: 'Text overlay', value: decomp.text_overlay_score },
    { key: 'first_words_speech_score', label: 'First words', value: decomp.first_words_speech_score },
  ];
  const cognitiveBucket = decomp.cognitive_load <= 3 ? 'Low'
    : decomp.cognitive_load <= 6 ? 'Med' : 'High';
  return (
    <div className="flex flex-col gap-2">
      {/* Headline strip */}
      <header className="flex items-center justify-between text-xs">
        <span className="font-medium">Hook decomposition</span>
        <GlassPill size="sm">{hookZoneLabel(segments)}</GlassPill>
      </header>
      {/* 4-bar stack */}
      <div className="flex flex-col gap-1.5">
        {bars.map((b) => (
          <div
            key={b.key}
            className={cn(
              'flex items-center gap-2',
              b.key === decomp.weakest_modality && 'bg-accent/8 -mx-1 px-1 rounded-[6px]',
            )}
          >
            <span className="w-[120px] text-[11px] text-foreground-muted truncate">{b.label}</span>
            <GlassProgress value={b.value * 10} color="coral" size="md" className="flex-1" />
            <span className="w-[32px] text-[11px] tabular-nums text-right">{b.value.toFixed(1)}</span>
          </div>
        ))}
      </div>
      {/* Chip row */}
      <div className="flex gap-1.5">
        <GlassPill size="sm">Coherence: {decomp.visual_audio_coherence.toFixed(1)}/10</GlassPill>
        <GlassPill size="sm">Cognitive load: {cognitiveBucket}</GlassPill>
      </div>
    </div>
  );
}
```

### Pattern 4: Recharts AreaChart with Coral Gradient (D-18)

**What:** Emotion arc rendered as Recharts `<AreaChart>` over `result.emotion_arc[]` mapping `timestamp_ms` × `intensity_0_1`. Vertical fill gradient defined in `<defs><linearGradient>`. Peak/valley markers via `<ReferenceDot>` for `label === 'high' | 'low'`. `<Area type="monotone" isAnimationActive={!prefersReducedMotion} />`.

**Direct codebase template:** `src/components/competitors/charts/follower-growth-chart.tsx` lines 36-86. Same shape (linearGradient inside defs, Area with `fill="url(#gradId)"`, ResponsiveContainer wrapper).

**When to use:** Inside `EmotionArcNode.tsx` body. NOT for Hook decomp (use GlassProgress) and NOT for retention curve (Phase 4 uses hand-rolled canvas).

**Example (verified via codebase + Context7):**
```typescript
// Source: src/components/competitors/charts/follower-growth-chart.tsx + Context7 recharts/recharts
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, ReferenceDot, Tooltip } from 'recharts';
import { ChartTooltip } from '@/components/competitors/charts/chart-tooltip';

function EmotionArcChart({ points, prefersReducedMotion }: { points: EmotionArcPoint[]; prefersReducedMotion: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="emotionGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.6} />
            <stop offset="60%" stopColor="var(--color-accent)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="rgba(132,133,134,0.1)" stopOpacity={1} />
          </linearGradient>
        </defs>
        <XAxis dataKey="timestamp_ms" hide />
        <YAxis domain={[0, 1]} hide />
        <Tooltip content={<ChartTooltip formatter={(v) => `${(v * 100).toFixed(0)}%`} />} />
        <Area
          type="monotone"
          dataKey="intensity_0_1"
          stroke="var(--color-accent)"
          strokeWidth={2}
          fill="url(#emotionGradient)"
          isAnimationActive={!prefersReducedMotion}
        />
        {/* Peak/valley markers — overlay ReferenceDot at points where label is 'high'/'low' */}
        {points.map((p) =>
          p.label === 'high' ? (
            <ReferenceDot
              key={`peak-${p.timestamp_ms}`}
              x={p.timestamp_ms}
              y={p.intensity_0_1}
              r={6}
              fill="var(--color-accent)"
              stroke="none"
            />
          ) : p.label === 'low' ? (
            <ReferenceDot
              key={`valley-${p.timestamp_ms}`}
              x={p.timestamp_ms}
              y={p.intensity_0_1}
              r={4}
              fill="rgba(132,133,134,0.6)"
              stroke="none"
            />
          ) : null,
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

### Pattern 5: Native `<details>` Collapsible (D-30)

**What:** Use native HTML `<details>` + `<summary>` for "Why this verdict?" and "vs my history" collapsibles. Built-in semantics: keyboard Enter/Space toggle, `aria-expanded` automatic, screen reader announces "expanded/collapsed".

**When to use:** All Verdict collapsibles. Style with Tailwind, no Radix Accordion needed (lighter weight + accessible by default).

**Why over Radix Accordion:** No external state needed (`<details>` manages own open state), no controlled-component dance, no extra component dep. Phase 4's `HeatmapDrawer.tsx` uses a similar pattern (Sheet on mobile, inline grid-template-rows transition on desktop) — `<details>` is even simpler.

**Example:**
```typescript
<details className="group rounded-[8px] border border-white/[0.06] bg-white/[0.02] open:bg-white/[0.04]">
  <summary
    className="flex cursor-pointer items-center justify-between p-2 text-sm font-medium list-none"
    onClick={() => logger.event('verdict_reasoning_expanded', { score: result.overall_score })}
  >
    <span>Why this verdict?</span>
    <CaretDown size={12} className="opacity-60 group-open:rotate-180 transition-transform" />
  </summary>
  <div className="p-3 pt-0 text-xs">{/* 4 sub-sections */}</div>
</details>
```

### Pattern 6: Dashed Placeholder Card (D-11)

**What:** Reusable `<PlaceholderCard label="Reshoot script" phase="6" icon={SparkleIcon} />` component. Dashed border (NOT solid), `bg-white/[0.02]`, centered icon + label in white/40, no hover state, not interactive.

**Why dashed:** Solid border + skeleton implies loading; dashed border + label implies intentional empty slot — matches mental model of "card on a project board waiting for content". Verified visual reference: Linear/Notion/Krea AI Nodes.

**Example:**
```typescript
export function PlaceholderCard({ label, phase, icon: Icon }: PlaceholderCardProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-1 rounded-[12px] p-3 bg-white/[0.02] text-white/40"
      style={{
        border: '1px dashed rgba(255,255,255,0.06)',
      }}
      aria-label={`${label}: coming in Phase ${phase}`}
      role="presentation"
    >
      <Icon size={16} aria-hidden="true" />
      <span className="text-xs font-medium">{label}</span>
      <span className="text-[10px]">Coming in Phase {phase}</span>
    </div>
  );
}
```

### Pattern 7: Cross-Group State Selector (D-21 / D-24)

**What:** Extract `Board.tsx:47` hard-coded `frameId === 'verdict' || 'audience'` check into pure-function module that can be called by Verdict, Actions, Audience, AND future ripple consumers.

**Why now:** R1.9 explicitly mandates the abstraction. Future signals (high-confidence loop, exceptional hook score) plug in without touching Board.tsx wiring. Phase 5 ships the abstraction so Phase 8/M2 don't refactor cross-group state.

**API surface:**
```typescript
// Source: NEW src/components/board/cross-group-state.ts
import { useBoardStore, type BoardMachineState } from '@/stores/board-store';
import type { GroupId } from './board-types';

// D-24: Extendable signal name; currently only 'anti-virality'.
type CrossGroupSignal = 'anti-virality';

// Map signal → affected frame set. Future signals add entries here.
const AFFECTED_FRAMES: Record<CrossGroupSignal, Set<GroupId>> = {
  'anti-virality': new Set(['verdict', 'audience', 'actions']),
};

export function useAntiViralityAffectedFrames(): Set<GroupId> {
  const boardState = useBoardStore((s) => s.boardState);
  return boardState === 'anti-virality' ? AFFECTED_FRAMES['anti-virality'] : new Set();
}

export function getFrameAntiViralityState(
  frameId: GroupId,
  boardState: BoardMachineState,
): 'idle' | 'streaming' | 'anti-virality' | 'complete' {
  if (boardState === 'idle' || boardState === 'edit-input') return 'idle';
  if (boardState === 'streaming') return 'streaming';
  if (boardState === 'anti-virality' && AFFECTED_FRAMES['anti-virality'].has(frameId)) {
    return 'anti-virality';
  }
  return 'complete';
}
```

**Migration of `Board.tsx`:** Replace the inline `deriveFrameVisual` function (lines 40-51) with a call to `getFrameAntiViralityState`. Use a single subscription to `useBoardStore(s => s.boardState)` and pass it to the resolver per frame.

### Anti-Patterns to Avoid

- **Don't render Verdict body inside `BoardCanvas` (Konva).** All DOM body content lives in `GroupFrameOverlay`'s children — same pattern as `AudienceNode` (`Board.tsx:303`). Konva owns only the frame border + label.
- **Don't pull `result.heatmap` into Verdict for the comparison data** — that's the audience timeline. Verdict's history comparison uses `overall_score` time-series across analyses (new endpoint).
- **Don't reuse `VideoCard` from `/trending`** — wrong visual model (grid tile vs compact row), wrong size, depends on `useBookmarkStore`. Build `SimilarVideoCardCompact` per O-6.
- **Don't use Radix Accordion when `<details>` suffices.** Adds external state + controlled-component complexity for zero a11y gain.
- **Don't sentence-split DeepSeek's `result.reasoning` for sentiment classification.** Use `factors[]` score thresholds; they're already classified by the engine.
- **Don't compute percentile client-side** — `overall_score` IS 0-100 per `types.ts:212`. If a true percentile-vs-corpus is needed later, it lives on the server (calibration.ts pipeline).
- **Don't render the reshoot-hero slot at full size in Phase 5.** Phase 5 ships the placeholder; Phase 6 swaps content. The slot's existence preserves layout slot reservation.
- **Don't hard-code anti-virality affected frames in any new component.** Every consumer calls `useAntiViralityAffectedFrames()` or `getFrameAntiViralityState(frameId, boardState)`. Single source of truth.
- **Don't fire `verdict_anti_virality_override` more than once per analysisId.** Persist dismissed state in localStorage keyed by `analysisId`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown rendering | Custom regex parser for bold/italic/lists | `react-markdown@^10.1.0` + `rehype-sanitize@^6.0.0` | XSS, edge cases in nested lists, autolinks |
| Area chart with gradient | Manual SVG `<path d>` calculation + linearGradient JSX | Recharts AreaChart (already in stack) | Tree-shakes, responsive, accessibility props, tested |
| Horizontal bar chart | Flexbox `<div>` bars with width % | Recharts BarChart (already in stack) | Free tooltips + axis labels + animation respect |
| TikTok video modal | New embed component | `src/components/trending/tiktok-embed.tsx` (reuse) | Script injection, cleanup, cache-busting already handled |
| Bottom-sheet (mobile) / side-panel (desktop) inspector | New responsive sheet | `src/components/ui/sheet.tsx` (Radix Dialog wrapper) | Phase 4 `PersonaInspector` already uses this pattern |
| Tap popover | New popover with scroll-dismiss | Phase 4 `TapPopover` (extend if needed) | Already handles 5 variants + scroll-dismiss + portal |
| Collapsible disclosure | Custom expand/collapse animation | Native `<details>` + Tailwind | Built-in a11y, keyboard, screen reader semantics |
| Anti-virality state derivation | Inline `boardState === 'anti-virality' && frameId === ...` in 3 places | `useAntiViralityAffectedFrames()` selector | Single source of truth; D-21 abstraction |
| Recent analyses query for comparison | Inline Supabase client query in component | TanStack Query against `/api/analyze/[id]/comparisons` | Caching, retry, server-side RLS, decouple UI from DB shape |
| Niche cohort aggregation | Per-analysis live SQL | Server endpoint with cached materialized-view pattern (mirror `niche_post_windows`) | Cost + correctness; Phase 1 precedent |
| Reduced-motion handling | Manual matchMedia query | `usePrefersReducedMotion` from `@/hooks/usePrefersReducedMotion` | Phase 2 D-23 / Phase 4 already use this |
| Perf-tier degradation | Custom feature flag | `usePerfStore` from `@/lib/perf-tier` | Phase 2 D-20 / Phase 4 already wired |
| `aria-live` regions | Manual announcer | `@/lib/a11y` helpers (Phase 2-shipped) | Consistent debouncing + cleanup |

**Key insight:** Phase 5 is a *composition* phase, not an *infrastructure* phase. Phase 2 shipped the board substrate. Phase 3 shipped the engine schema. Phase 4 shipped the audience patterns. Phase 5 should write almost no novel primitives — every line of code should compose existing primitives. The only legitimate new primitives are `PlaceholderCard` (genuinely new visual treatment), `cross-group-state.ts` (genuinely new abstraction per D-21), and `SimilarVideoCardCompact` (genuinely new visual model per O-6). Everything else is composition.

---

## Common Pitfalls

### Pitfall 1: Recharts ResponsiveContainer inside a 200px-tall frame

**What goes wrong:** Recharts `ResponsiveContainer` measures parent height via ResizeObserver. If the Content-Analysis frame body height isn't stabilized before mount, the chart renders at 0px and never re-measures.

**Why it happens:** `GroupFrameOverlay.tsx:124` sets body height to `screenH - TITLE_BAR_HEIGHT`. If `screenH` is calculated from world-space × camera.scale and the camera transform hasn't settled (e.g., during initial fit-to-content glide), the body briefly has a measured height of 0.

**How to avoid:** Pass an explicit numeric `height` prop to `ResponsiveContainer` (e.g., `height={140}`) instead of relying on `100%` height. The 200px frame minus 36px title bar minus 16px padding minus 28px headline strip = 120-140px chart body. Set `height={140}` and let `width="100%"` handle responsive.

**Warning signs:** Emotion arc renders blank on first mount but appears after a window resize.

### Pitfall 2: Anti-virality state ripple race condition

**What goes wrong:** `Board.tsx` useEffect at lines 109-143 fires `triggerAntiVirality()` when `stream.phase === 'complete'` AND `stream.result.antiVirality === true`. If Verdict/Actions subscribe to `boardState` directly, they may render BEFORE the state transition completes. Hook decomp / Emotion arc could also flash a non-AV state then re-render with AV.

**Why it happens:** React batching may not coalesce `finishStreaming()` + `triggerAntiVirality()` into a single render pass if they're called separately.

**How to avoid:** All Phase 5 nodes call `getFrameAntiViralityState(frameId, boardState)` from cross-group-state.ts. The resolver maps `boardState === 'complete'` (transitional) AND `boardState === 'anti-virality'` (final) correctly. Phase 4's audience node already handles this — mirror that pattern. Optionally: wrap the dual state setters in `useBoardStore.setState` with `(s) => ({...})` batch syntax to guarantee a single render.

**Warning signs:** Verdict header flashes white → orange on AV transition. Actions frame momentarily renders at 200px then jumps to 360px.

### Pitfall 3: `result.reasoning` markdown with embedded HTML

**What goes wrong:** DeepSeek may emit markdown with HTML escape sequences or raw `<script>` / `<img onerror>` tags. Without sanitization, Verdict's collapsible body becomes an XSS vector.

**Why it happens:** `react-markdown` by default permits some HTML passthrough (configurable via `rehype-raw`). Without `rehype-sanitize`, the renderer trusts input.

**How to avoid:** ALWAYS pair `react-markdown` with `rehype-sanitize`:
```typescript
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

<ReactMarkdown rehypePlugins={[rehypeSanitize]}>{result.reasoning}</ReactMarkdown>
```
Engine output is internally trusted but defense-in-depth — if the DeepSeek prompt is ever compromised or a corrupt response slips through validation, the sanitizer is the last line of defense.

**Warning signs:** None visually — XSS would be a security incident, not a visual bug. Verify via test fixture: pass `result.reasoning = "<img src=x onerror=alert(1)>"` and assert no script execution.

### Pitfall 4: Cognitive load polarity inversion forgotten

**What goes wrong:** Surfacing raw `cognitive_load` value (0-10 where higher = WORSE) as a positive scoring chip makes "High cognitive load" look like a good signal.

**Why it happens:** Other Hook decomp fields (`visual_stop_power`, `audio_hook_quality`, etc.) use 0-10 where higher = better. `cognitive_load` is INVERTED per schema comment at `src/lib/engine/qwen/schemas.ts:27`.

**How to avoid:** ALWAYS bucket cognitive_load via the inverted polarity mapping: raw 0-3 → "Low" (good), 4-6 → "Med", 7-10 → "High" (bad). NEVER display the raw 0-10 number. Same applies if researcher tries to average cognitive_load with other hook fields — invert first via `10 - cognitive_load` per schema comment line 8.

**Warning signs:** Cognitive load chip shows "Cognitive load: 8.5/10" as if it were a high-quality signal.

### Pitfall 5: Missing `is_calibrated` flag in Verdict copy

**What goes wrong:** Surfacing `overall_score` as a percentile without checking `result.is_calibrated` — if Platt scaling didn't run, the score is raw uncalibrated 0-100.

**Why it happens:** `is_calibrated: boolean` is documented at `types.ts:215` but easy to miss.

**How to avoid:** If `result.is_calibrated === false`, append a small "(uncalibrated)" sub-text under the percentile chip OR use a less authoritative copy ("Score: 72" instead of "72nd percentile"). Researcher confirms exact copy with planner.

**Warning signs:** Engine telemetry shows `is_calibrated: false` rates >5% but UI never acknowledges.

### Pitfall 6: Frame height growth from collapsibles colliding with Konva camera

**What goes wrong:** Verdict frame is laid out at 360×280 base in world-space (`board-constants.ts:29`). Opening both collapsibles grows DOM overlay to ~600px. World-space coordinates don't update — overlay overflows the Konva frame bounds.

**Why it happens:** Konva frame uses static bounds; DOM overlay uses CSS height that can grow.

**How to avoid:** Two approaches:
1. **Soft (recommended for Phase 5):** Let the DOM overlay grow inside `GroupFrameOverlay`'s body via `overflow-y: auto`. Frame visual border stays at 280px; collapsibles scroll within. Mirrors `AudienceNode` (`AudienceNode.tsx:259` `overflow-y-auto`).
2. **Hard (deferred):** Phase 2 D-03 frame growth-on-expand pattern. Update `board-constants.ts` or compute height dynamically. Adds Konva re-layout complexity — not worth it for Phase 5.

**Warning signs:** Verdict collapsible content disappears below frame border, requires scroll.

### Pitfall 7: TikTok embed modal mounting inside Konva stage

**What goes wrong:** If `SimilarVideosCard` triggers the TikTok embed modal as a child of the Konva canvas, Konva's event capture interferes with the modal's interaction.

**Why it happens:** Modals must mount via portal at body level. Phase 4's `Sheet`/`PersonaInspector` already does this (uses Radix Sheet portal).

**How to avoid:** When Phase 6 (or Phase 5 for similar-video tap) opens the TikTok modal, use Radix Dialog (with portal) — NOT inline mount. Trending's `tiktok-embed.tsx` is just the embed body; it's typically wrapped in a Dialog/Sheet by the consumer.

**Warning signs:** TikTok player non-interactive; pan/zoom triggers behind the modal.

### Pitfall 8: localStorage write on every render

**What goes wrong:** Anti-virality override dismissal state stored in localStorage; reading it on every render via `useSyncExternalStore` or repeated `localStorage.getItem` causes layout thrash.

**Why it happens:** localStorage is synchronous and triggers a re-read each render if not memoized.

**How to avoid:** Read once on mount via `useState(() => localStorage.getItem(...))` initializer. Write only on dismiss action. Use Zustand persist middleware OR a small custom hook.

**Warning signs:** Lighthouse Performance score drops on Verdict node mount.

---

## Code Examples

### Example 1: Hook decomp 4-bar GlassProgress stack
See `Architecture Pattern 3` above.

### Example 2: Horizontal BarChart for "vs my history"
```typescript
// Source: composed from src/components/competitors/comparison/comparison-bar-chart.tsx
// Adapted for horizontal layout (layout="vertical")
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import { ChartTooltip } from '@/components/competitors/charts/chart-tooltip';

interface HistoryChartProps {
  current: number;
  history: number[];          // length 10 max
  prefersReducedMotion: boolean;
}

function HistoryBarChart({ current, history, prefersReducedMotion }: HistoryChartProps) {
  const data = [
    { label: 'Now', value: current, isCurrent: true },
    ...history.map((v, i) => ({ label: `−${i + 1}`, value: v, isCurrent: false })),
  ];
  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart layout="vertical" data={data} margin={{ top: 4, right: 12, left: 24, bottom: 0 }}>
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis dataKey="label" type="category" tickLine={false} axisLine={false}
               fontSize={10} stroke="var(--color-foreground-muted)" width={24} />
        <Tooltip content={<ChartTooltip formatter={(v) => `${v.toFixed(0)}`} />} />
        <Bar dataKey="value" isAnimationActive={!prefersReducedMotion} radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.isCurrent ? 'var(--color-accent)' : 'rgba(255,255,255,0.3)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
```

### Example 3: Emotion arc AreaChart with gradient + ReferenceDots
See `Architecture Pattern 4` above.

### Example 4: SimilarVideoCardCompact (compact mini-tile)
```typescript
// Source: NEW src/components/board/actions/SimilarVideoCardCompact.tsx
// Reuses src/components/ui/card.tsx Card + composes against RetrievalEvidenceItem from types.ts:670
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { GlassPill } from '@/components/primitives/GlassPill';
import type { RetrievalEvidenceItem } from '@/lib/engine/types';

function formatCompactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface Props {
  item: RetrievalEvidenceItem;
  onTap: (item: RetrievalEvidenceItem) => void;
}

export function SimilarVideoCardCompact({ item, onTap }: Props) {
  return (
    <Card
      onClick={() => onTap(item)}
      className="flex items-center gap-2 p-2 cursor-pointer"
      role="button"
      tabIndex={0}
      aria-label={`Similar video by ${item.creator_handle ?? 'unknown'}, ${formatCompactNumber(item.views)} views`}
    >
      {/* Thumb — note: retrieval_evidence has no thumbnail field; use creator avatar fallback OR skip image */}
      <div className="h-14 w-14 shrink-0 rounded-[6px] bg-white/[0.06] overflow-hidden" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-xs font-medium text-foreground">@{item.creator_handle ?? '—'}</span>
        <span className="text-[10px] text-foreground-muted">{formatCompactNumber(item.views)} views</span>
      </div>
      <GlassPill size="sm">{(item.similarity_score * 100).toFixed(0)}%</GlassPill>
    </Card>
  );
}
```

**Note:** `RetrievalEvidenceItem` (`src/lib/engine/types.ts:670`) does NOT have a `thumbnail_url` field — it has `creator_handle`, `caption_snippet`, `video_url`, `views`, etc. The compact card either skips the thumb visual entirely OR derives one from a future enrichment step. Lock with planner. **Open Question 3** below.

### Example 5: Cross-group state resolver
See `Architecture Pattern 7` above.

### Example 6: Native `<details>` collapsible
See `Architecture Pattern 5` above.

### Example 7: Dashed placeholder card
See `Architecture Pattern 6` above.

### Example 8: Comparison endpoint server route
```typescript
// Source: NEW src/app/api/analyze/[id]/comparisons/route.ts
// Mirrors Phase 1 niche_post_windows pattern; reads analyses table via Supabase RLS
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  // user_id is RLS-gated by Supabase
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Last 10 analyses (most recent first, excluding current)
  const { data: history } = await supabase
    .from('analyses')
    .select('overall_score, created_at')
    .eq('user_id', user.id)
    .neq('id', id)
    .order('created_at', { ascending: false })
    .limit(10);

  // Niche aggregates — null fallback for Phase 5 baseline; researcher confirms with planner
  // whether to use a materialized view (mirror niche_post_windows precedent) or live query.
  const niche = null; // placeholder — Open Question 1

  return NextResponse.json({
    history: history?.map((r) => r.overall_score) ?? [],
    niche,
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Engine emits classified `reasoning_sections` | Client-side assembly from `factors[]` + `warnings[]` + `counterfactuals[]` + `reasoning` prose | Phase 13 introduced `counterfactuals` with `type` discriminators (fix/stretch/reinforcement) | Phase 5 ships client-side; engine extension deferred |
| Recharts 2.x with class components | Recharts 3.7+ with hooks-friendly responsive | 2024+ Recharts 3.0 stable | Already on 3.7.0; React 19 compatible per peerDeps |
| Modal-only TikTok preview | Embed via official tiktok.com/embed.js | Phase 1 trending route shipped | Reuse — don't reimplement |
| Hand-rolled SVG bar charts | Recharts `<BarChart layout="vertical">` for horizontal bars | Always — Recharts has built-in horizontal layout | Already used in stack |
| Phase 4's hard-coded `frameId === 'verdict' || 'audience'` check | `useAntiViralityAffectedFrames()` selector with named signals | Phase 5 (this phase) | R1.9 future-proofs ripple |

**Deprecated/outdated:**
- Custom Inspector primitive extraction (Phase 4 considered, deferred). Phase 5 also defers — three node-specific inspectors is fine.
- `result.heatmap` for Verdict body (wrong — heatmap is Audience timeline data, not Verdict's history comparison).
- `/trending`'s `VideoCard` for similar videos (wrong visual model per O-6).

---

## Project Constraints (from CLAUDE.md)

The project `./CLAUDE.md` mandates the following — all are honored in this research:

- **Stack** is Next.js 15 (actually 16.1.5 per `package.json`), TypeScript, Tailwind v4, Supabase. ✓ Phase 5 uses these.
- **Coral** (#FF7F50) is the only accent. ✓ Phase 5 uses `--color-accent` token (verified `globals.css` mapping).
- **Raycast aesthetic** — Tailwind v4 with verified token values (surface=#18191a, muted=#848586, accent-foreground=#1a0f0a). ✓ Used.
- **Universal 6% borders** (`white/[0.06]`), 10% hover. ✓ Used in GlassPanel/Card/details.
- **GlassPanel zero-config** (4 props: children, className, style, as). ✓ Reused per O-3.
- **Modals/dialogs solid opaque** (not glass). ✓ Sheet uses `bg-[#18191a]` per PersonaInspector pattern.
- **Cards** = `bg-transparent`, border `rgba(255,255,255,0.06)`, 12px radius. ✓ `src/components/ui/card.tsx` already correct.
- **Card hover** = `bg-white/[0.02]` only. ✓ `card.tsx` line 56.
- **Inputs/buttons** = 8px radius. ✓ Compact card uses 6px (smaller component) — acceptable per Radius scale 4/6/8/12.
- **Tailwind v4 oklch inaccuracy** for dark colors (L < 0.15) — use exact hex. ✓ Coral token defined; no new dark token needed.
- **Lightning CSS strips backdrop-filter** — apply via React inline styles. ✓ TapPopover already uses `style={{backdropFilter: 'blur(5px)'}}`.
- **Body**: Inter font, `letter-spacing: 0.2px`. ✓ Inherited from `<body>`.
- **File org**: `/src` for source, `/tests` for tests, NEVER save to root. ✓ All new files under `src/`.
- **NEVER create docs/README files** unless explicitly requested. ✓ Only RESEARCH.md (orchestrator-mandated).
- **ALWAYS read a file before editing it**. ✓ `Board.tsx` will be read before D-21 refactor.
- **NEVER commit secrets** — no secrets in scope.
- **ALWAYS run tests after changes**. ✓ Vitest already wired (config verified at `vitest.config.ts:22`).
- **Server components by default**. ✓ Verdict/Actions/Content-Analysis are CLIENT components (mounted under `Board.tsx`'s `'use client'` tree) because they consume `useAnalysisStream` + `useBoardStore`. Server endpoint for comparisons is server-side (Route Handler).
- **Commit format**: `type(phase): description`. ✓ Per `.planning/config.json`.

---

## Runtime State Inventory

> Not applicable — Phase 5 is a greenfield composition phase. No rename/refactor/migration; no existing runtime state contains the new node identifiers. Cross-group-state.ts refactor of `Board.tsx:47` is pure code edit, not a data migration.

**Stored data:** None — no DB rows, no localStorage keys reference Verdict/Actions/Content-Analysis identifiers today.
**Live service config:** None — no external service config references the new nodes.
**OS-registered state:** None.
**Secrets/env vars:** None — no new secrets. Engine already uses existing keys.
**Build artifacts:** Verified — no stale package builds; `src/__mocks__/react-konva.tsx` already accounts for Vitest.

**Anti-virality override localStorage key (NEW):** `virtuna:verdict-av-override:{analysisId}` — keyed per analysis. Cleared via no policy (persists indefinitely; per-analysis is fine).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| recharts | Emotion arc + history charts | ✓ | ^3.7.0 (latest 3.8.1) [VERIFIED npm view] | — |
| react-markdown | Verdict reasoning | ✗ | needs install ^10.1.0 | Plain-text rendering of `result.reasoning` |
| rehype-sanitize | XSS in reasoning markdown | ✗ | needs install ^6.0.0 | If plain-text, sanitize not needed |
| @phosphor-icons/react | Caret icons | ✓ | ^2.1.10 | — |
| @tanstack/react-query | Comparison fetch | ✓ | ^5.90.21 | — |
| radix-ui (Dialog/Sheet/Popover) | Inspector sheets | ✓ | ^1.4.3 | — |
| Supabase | analyses table for history | ✓ (`@supabase/ssr` ^0.8.0) | ✓ | — |
| Next.js Route Handlers | comparisons endpoint | ✓ (Next 16.1.5) | ✓ | — |
| Vitest | Test infra | ✓ ^4.0.18 | ✓ | — |
| `@testing-library/react` | Component tests | ✓ ^16.3.2 | ✓ | — |
| happy-dom | Test env for component tests | ✓ ^20.9.0 | ✓ | — |

**Missing dependencies with fallback:**
- `react-markdown` + `rehype-sanitize` — fall back to plain-text render if user/budget pushes against the install. Recommendation: install (small footprint, single phase).

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @testing-library/react 16.3.2 + happy-dom 20.9.0 |
| Config file | `vitest.config.ts` (verified) |
| Test env opt-in | `/** @vitest-environment happy-dom */` pragma at top of component test files |
| Quick run command | `npx vitest run src/components/board/verdict/__tests__` (per-folder) |
| Full suite command | `npm test` (runs `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R1.3 | Verdict node renders percentile + confidence + collapsibles against fixture | component | `npx vitest run src/components/board/verdict/__tests__/VerdictNode.test.tsx` | ❌ Wave 0 |
| R1.3 | Anti-virality header renders ONLY when `anti_virality_gated === true` | component | `npx vitest run src/components/board/verdict/__tests__/AntiViralityHeader.test.tsx` | ❌ Wave 0 |
| R1.3 | "Why this verdict?" assembles 4 buckets from factors+warnings+counterfactuals | unit | `npx vitest run src/components/board/verdict/__tests__/assembleReasoningBuckets.test.ts` | ❌ Wave 0 |
| R1.3 | History collapsible empty state when <3 prior analyses | component | `npx vitest run src/components/board/verdict/__tests__/VsHistoryCollapsible.test.tsx` | ❌ Wave 0 |
| R1.3 | Anti-virality override fires `verdict_anti_virality_override` event + persists dismissal | component | `npx vitest run src/components/board/verdict/__tests__/AntiViralityHeader.override.test.tsx` | ❌ Wave 0 |
| R1.4 | Actions 2×2 default + grow-to-hero when AV | component | `npx vitest run src/components/board/actions/__tests__/ActionsNode.test.tsx` | ❌ Wave 0 |
| R1.4 | PlaceholderCard renders dashed border + correct phase label | component | `npx vitest run src/components/board/actions/__tests__/PlaceholderCard.test.tsx` | ❌ Wave 0 |
| R1.5 | SimilarVideosCard renders 5 items + tap fires modal | component | `npx vitest run src/components/board/actions/__tests__/SimilarVideosCard.test.tsx` | ❌ Wave 0 |
| R1.5 | SimilarVideosCard empty state when retrieval signal unavailable | component | `npx vitest run src/components/board/actions/__tests__/SimilarVideosCard.empty.test.tsx` | ❌ Wave 0 |
| R1.6 | HookDecompNode renders 4 bars + chips against fixture | component | `npx vitest run src/components/board/content-analysis/__tests__/HookDecompNode.test.tsx` | ❌ Wave 0 |
| R1.6 | HookDecompNode highlights weakest_modality bar | component | same file | ❌ Wave 0 |
| R1.6 | HookDecompNode cognitive_load polarity inverted in display | component | same file | ❌ Wave 0 |
| R1.6 | HookDecompNode empty state when `hook_decomposition === null` | component | same file | ❌ Wave 0 |
| R1.7 | EmotionArcNode renders Recharts AreaChart + ReferenceDots for peaks/valleys | component | `npx vitest run src/components/board/content-analysis/__tests__/EmotionArcNode.test.tsx` | ❌ Wave 0 |
| R1.7 | EmotionArcNode empty state when `emotion_arc === null` | component | same file | ❌ Wave 0 |
| R1.7 | EmotionArcNode skips animation when prefersReducedMotion | component | same file | ❌ Wave 0 |
| R1.8 | VsHistoryCollapsible renders 2 charts with correct coral/white split | component | already covered in `VsHistoryCollapsible.test.tsx` above | ❌ Wave 0 |
| R1.9 | `useAntiViralityAffectedFrames()` returns correct set per boardState | unit | `npx vitest run src/components/board/__tests__/cross-group-state.test.ts` | ❌ Wave 0 |
| R1.9 | `getFrameAntiViralityState(verdict, anti-virality)` === 'anti-virality' for all 3 frames | unit | same file | ❌ Wave 0 |
| R1.9 | Board.tsx integration: AV transition coordinates across V/A/Actions | integration | `npx vitest run src/components/board/__tests__/Board.cross-group.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/components/board/{verdict,actions,content-analysis}/__tests__` (~10s, scoped to phase)
- **Per wave merge:** `npm test` (~30-60s, full suite)
- **Phase gate:** Full suite green + manual mobile smoke + Recharts visual check before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/components/board/verdict/__tests__/VerdictNode.test.tsx` — covers R1.3
- [ ] `src/components/board/verdict/__tests__/AntiViralityHeader.test.tsx` — covers R1.3 conditional render
- [ ] `src/components/board/verdict/__tests__/AntiViralityHeader.override.test.tsx` — covers R1.3 override event
- [ ] `src/components/board/verdict/__tests__/assembleReasoningBuckets.test.ts` — covers R1.3 O-2 assembly logic
- [ ] `src/components/board/verdict/__tests__/VsHistoryCollapsible.test.tsx` — covers R1.3 + R1.8
- [ ] `src/components/board/verdict/__tests__/use-comparisons.test.ts` — TanStack Query mock
- [ ] `src/components/board/actions/__tests__/ActionsNode.test.tsx` — covers R1.4
- [ ] `src/components/board/actions/__tests__/PlaceholderCard.test.tsx` — covers R1.4 placeholder render
- [ ] `src/components/board/actions/__tests__/SimilarVideosCard.test.tsx` — covers R1.5
- [ ] `src/components/board/actions/__tests__/SimilarVideosCard.empty.test.tsx` — covers R1.5 empty state
- [ ] `src/components/board/content-analysis/__tests__/HookDecompNode.test.tsx` — covers R1.6
- [ ] `src/components/board/content-analysis/__tests__/EmotionArcNode.test.tsx` — covers R1.7
- [ ] `src/components/board/__tests__/cross-group-state.test.ts` — covers R1.9 resolver
- [ ] `src/components/board/__tests__/Board.cross-group.test.tsx` — covers R1.9 integration
- [ ] `src/components/board/verdict/__tests__/fixtures/` — `PredictionResult` fixtures: complete + AV + low-confidence + empty hook_decomp + empty emotion_arc + empty retrieval_evidence + history empty + history full
- [ ] Test for Recharts in happy-dom — verify whether `ResponsiveContainer` measures correctly without window resize (Pitfall 1). May need explicit height prop in tests.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing Supabase Auth — comparisons endpoint requires authenticated user (verified in Example 8) |
| V3 Session Management | yes | Supabase session cookies — unchanged for Phase 5 |
| V4 Access Control | yes | RLS on `analyses` table — `user_id = auth.uid()` already enforced. Comparisons endpoint inherits RLS. |
| V5 Input Validation | yes | `analysisId` URL param validated as UUID server-side; `result.reasoning` markdown sanitized via `rehype-sanitize` |
| V6 Cryptography | no | No new crypto. Existing Supabase + TLS unchanged. |

### Known Threat Patterns for Next.js + Supabase + Recharts + react-markdown

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via DeepSeek-emitted markdown in `result.reasoning` | Tampering | `rehype-sanitize` plugin pair with `react-markdown` (REQUIRED — see Pitfall 3) |
| SQL injection in comparisons endpoint | Tampering | Supabase parameterized queries (built-in); never string-concat `id` into SQL |
| IDOR — fetching another user's comparison history | Information Disclosure | RLS on `analyses` table + `user_id` check in route handler (verified in Example 8 — `supabase.auth.getUser()` before query) |
| Open redirect via `signal_anchor` field tap | Tampering | Phase 5 doesn't follow URLs from engine output — segment-pill tap calls `setActivePreset('audience')` (internal-only) |
| localStorage tampering of anti-virality override | Information Disclosure | Acceptable — override is a UI hint, not a security control. Engine state unchanged. |
| TikTok embed script tag injection | Tampering | Existing `tiktok-embed.tsx` uses fixed `https://www.tiktok.com/embed.js` URL; no user-provided script source |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `overall_score` (0-100) is directly usable as the percentile chip without further derivation | §Architecture Pattern 1 + D-02 | If true percentile-vs-corpus calc is needed, percentile chip is misleading; recoverable via planner lock |
| A2 | Comparison endpoint should be server-side (D-09 lock to (a)) | §Open Questions 1 | If client-side is preferred, endpoint work is wasted; chart UI unchanged |
| A3 | Cognitive load polarity bucketing 0-3=Low, 4-6=Med, 7-10=High matches creator intuition | D-16 + Pitfall 4 | If buckets feel wrong, easy adjustment (single mapping function) |
| A4 | `RetrievalEvidenceItem` has no thumbnail field; SimilarVideoCardCompact skips visual thumb | §Code Examples 4 | If a thumbnail enrichment is shipped Phase 6/7, swap is local to compact card |
| A5 | Native `<details>` element + Tailwind sufficient for Verdict collapsibles vs. Radix Accordion | §Architecture Pattern 5 | If complex animation required (height interpolation), swap to Radix; Phase 4 D-23 reduced-motion respects either |
| A6 | Render `result.reasoning` as single intro paragraph + bucket from `factors[]`/`warnings`/`counterfactuals` is preferable to sentence-level sentiment classification | §Architecture Pattern 1 + Discretion lock | If buckets feel empty/redundant, swap to a different split heuristic; client-side change only |
| A7 | localStorage persistence keyed by `analysisId` is sufficient for "Post anyway" dismissal | §Discretion lock (anti-virality override) | If a user re-opens the same analysis on another device, dismissal won't carry; acceptable trade-off |
| A8 | Bundle delta from `react-markdown` + `rehype-sanitize` (~50KB gzipped combined) is acceptable | §Standard Stack | If perf budget tight, fall back to plain-text rendering |
| A9 | Hook decomp inspector + Emotion arc inspector are simple enough to build per-node without extracting a base `Inspector` primitive | §O-3 Discretion lock | If future inspectors add (3+), refactor cost is contained |
| A10 | `useBoardStore.boardState` transition `complete → anti-virality` happens atomically enough that consumers don't flash incorrect state | §Common Pitfalls 2 | If flashing observed, wrap setters in batch (`setState(s => ...)` form) |

---

## Open Questions

1. **D-09 comparison data source lock + niche aggregate strategy.**
   - What we know: Three viable paths exist; this research recommends server endpoint (option a).
   - What's unclear: Whether to ship a Supabase materialized view for niche cohort aggregates (mirror Phase 1's `niche_post_windows`) OR live-aggregate per request OR ship Phase 5 with `niche: null` placeholder and lock the cohort impl in M2-II.
   - Recommendation: Phase 5 ships the endpoint shape `{history: number[], niche: null | {median: number, p75: number, count: number}}`. `niche` returns null in Phase 5; the chart renders "Niche comparison coming soon" empty state. Mat-view work moves to Phase 8 or M2.

2. **Actions frame grow-to-hero mechanism.**
   - What we know: D-10 specifies frame grows from 360×200 to 360×360 when anti-virality.
   - What's unclear: Whether to (a) update `board-constants.ts:31` to vary actions height by board state, (b) keep static 200px frame and have content overflow with `overflow: visible`, OR (c) introduce a Phase 2 D-03 frame-growth-on-expand pattern extension.
   - Recommendation: Option (c) — Phase 2 D-03 already established frame-growth semantics. Extend `board-constants.ts` to expose `getFrameBounds(frameId, boardState)`. Verdict frame may need the same treatment when collapsibles open (Pitfall 6).

3. **SimilarVideoCardCompact thumbnail source.**
   - What we know: `RetrievalEvidenceItem` shape (verified at `types.ts:670`) has `creator_handle`, `caption_snippet`, `video_url`, `views`, etc. — NO `thumbnail_url` field.
   - What's unclear: Whether to ship Phase 5 without thumbnail (Card 1 has a 56×56 placeholder gray box), enrich on the server before returning to client, or generate a thumbnail from `video_url` via TikTok's metadata API.
   - Recommendation: Phase 5 ships without thumbnail (empty 56×56 box with subtle TikTok logo or first letter of creator handle). Thumbnail enrichment moves to Phase 6 or M2.

4. **Inspector sheet pattern reuse vs. extraction.**
   - What we know: O-3 lists this as Claude's discretion. Phase 4's `PersonaInspector` is persona-specific. This research recommends per-node inspectors (option b).
   - What's unclear: Whether Phase 5's HookDecompInspector + EmotionArcInspector inherit the persona-specific helpers (e.g., AttentionSparkline) or use their own.
   - Recommendation: Per-node implementations; do not extract a base. Re-evaluate after Phase 5 ships if 3+ inspectors are similar enough.

5. **Where `verdict_anti_virality_override` dismissal state lives.**
   - What we know: Discretion lock = localStorage keyed by analysisId.
   - What's unclear: Whether dismissal should be a Zustand store slice (consistent with `board-store`) or pure localStorage hook.
   - Recommendation: Pure localStorage hook (`useAVOverride(analysisId)`) — simpler, no store coupling. Zustand if it grows to >1 stored field.

6. **Tailwind v4 token for orange (anti-virality).**
   - What we know: `--color-warning` is used in Phase 4 `AntiViralityOverlay.tsx:38` and `TapPopover.tsx:159` as `var(--color-warning)`. Phase 5 anti-virality header should reuse.
   - What's unclear: Whether `--color-warning` is already defined in `globals.css` with the correct coral-to-orange gradient blend, or if Phase 5 needs to verify/add it.
   - Recommendation: Researcher confirms in planner step; `grep -n "color-warning\|color: orange" src/app/globals.css`.

---

## Sources

### Primary (HIGH confidence)
- **Codebase — engine schemas:** `src/lib/engine/types.ts:210` (PredictionResult), `:407` (CounterfactualSuggestionItem), `:670` (RetrievalEvidenceItem); `src/lib/engine/qwen/schemas.ts:15` (HookDecompositionZodSchema), `:56` (EmotionArcPointSchema). All read directly; verified.
- **Codebase — Phase 4 patterns:** `src/components/board/Board.tsx`, `src/components/board/audience/AudienceNode.tsx`, `src/components/board/audience/PersonaInspector.tsx`, `src/components/board/audience/TapPopover.tsx`, `src/components/board/audience/AntiViralityOverlay.tsx`, `src/components/board/audience/HeatmapDrawer.tsx`, `src/components/board/audience/HeadlineChips.tsx`. All read.
- **Codebase — primitives:** `src/components/primitives/GlassProgress.tsx`, `src/components/primitives/GlassPill.tsx`, `src/components/ui/card.tsx`, `src/components/trending/tiktok-embed.tsx`, `src/components/trending/video-card.tsx`. All read.
- **Codebase — Recharts existing usage:** `src/components/competitors/charts/follower-growth-chart.tsx` (AreaChart + linearGradient, direct template), `src/components/competitors/comparison/comparison-bar-chart.tsx` (BarChart), `src/components/competitors/charts/chart-tooltip.tsx` (ChartTooltip — reuse), `src/components/app/brand-deals/earnings-chart.tsx`, `src/components/competitors/comparison/comparison-growth-chart.tsx`. All verified.
- **Codebase — board substrate:** `src/components/board/board-constants.ts:25-32` (GROUP_FRAMES), `src/components/board/GroupFrameOverlay.tsx`, `src/components/board/use-camera.ts`, `src/stores/board-store.ts`. All read.
- **Codebase — test infra:** `vitest.config.ts`, `src/components/board/audience/__tests__/` (18 test files for template); `src/components/board/__tests__/` (10 test files).
- **CONTEXT.md** (the discuss-phase output for Phase 5).
- **REQUIREMENTS.md** §R1.3, R1.4, R1.5, R1.6, R1.7, R1.8, R1.9.
- **ROADMAP.md** §Phase 5.
- **Phase 4 RESEARCH.md** (lines 1-100 read).

### Secondary (MEDIUM confidence)
- **Context7 — recharts/recharts:** Verified AreaChart + linearGradient pattern + ReferenceLine/ReferenceArea pattern + BarChart onClick handlers. ReferenceDot specifics — verified by direct codebase recipe (follower-growth-chart.tsx) + Recharts docs general docs page.
- **npm registry — recharts:** Latest 3.8.1 (2026-03-25 publish), installed 3.7.0. React 19 in peerDependencies. [VERIFIED]
- **npm registry — react-markdown:** Latest 10.1.0. [VERIFIED]
- **npm registry — rehype-sanitize:** Latest 6.0.0. [VERIFIED]

### Tertiary (LOW confidence)
- None — every claim has a primary or secondary source.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every dep verified in package.json or via npm view
- Architecture: HIGH — Phase 4 patterns directly reusable; engine schemas locked
- Pitfalls: HIGH — derived from observed Phase 4 patterns + Recharts known quirks
- Validation: HIGH — Vitest config verified; 18 audience test files as template
- Security: HIGH — RLS + react-markdown sanitization both standard
- Open Questions: 6 listed — most are planner-locks, not blockers

**Research date:** 2026-05-27
**Valid until:** 2026-06-26 (30 days for stable Phase 5 stack; Recharts 3.8.1 may release minor versions but API stable)
