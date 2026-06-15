# Phase 2: The Reading (user-facing: "The Simulation") - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Author the **consolidated result thread's information architecture** — reduce the engine's ~40 `PredictionResult` fields to the 4 questions a creator has, laid out top-to-bottom **inside the Phase-1 thread shell** (permalink `/analyze/[id]`):

**hero** (`overall_score` + go/no-go gate + watch-through % + persona cloud) → **3 driver rows** (Hook / Retention=*where they drop* / Shareability) → **Fix First** (timestamped fixes + copyable hook rewrites) → **Deeper read** (remaining 3 Apollo dims + supporting signals) → composer.

This phase ships the **thread structure + the disclosure surfaces with real-but-simple native content**. The rich board visuals (RetentionChart, PersonaGraph, filmstrip…) fill those surfaces in **Phase 3** — same containers, content swapped. Cut/jargon data never appears.

Presentation-layer only. Engine **FROZEN at 3.19.0** — no `lib/engine/` changes. Work in `src/components/**`, `src/app/**`, hooks. Mobile-first; desktop is the same thread, widened, on the **locked flat-warm system** (THEME-06).

Requirements: READ-01, READ-02, READ-03, READ-04, READ-05, READ-06, READ-07, READ-08, READ-10 (9). *(READ-09 = rich visuals = Phase 3.)*
</domain>

<decisions>
## Implementation Decisions

> Phase-2 decisions numbered D-01..D-15 below (self-contained to this phase).
> "Phase 1 D-NN" refers to decisions in `01-CONTEXT.md`, carried forward as locked.

### Carried forward — LOCKED, do NOT re-litigate
- **Product noun = "Simulation"** (Phase 1 D-09; Davide vetoed "Reading"). This phase's user-facing labels/headers use *Simulation*; the `READ-*` requirement IDs stay opaque. **Open reconciliation:** brief/roadmap/requirements prose still say "Reading" — Phase 2 builds the "Simulation" labels regardless (tracked in Deferred).
- **Vertical order** hero → 3 driver rows → Fix First → deeper read → composer (brief §2.3, READ-01). Fixed.
- **Score-forward, NO prose narration** (brief §2.6, READ-02). Operationalized in D-15 below.
- **Watch-through % owned by the hero, shown exactly once** (brief §2.9, READ-04).
- **Cut data never appears** (brief §2.9, READ-10): `feature_vector`, `score_weights`, `signal_availability`, dead sub-scores (`rule_score`/`trend_score`/`ml_score`/`gemini_score`), telemetry (`latency_ms`, `cost_cents`, model names), `critique`, `predicted_engagement` (false-precision "projected views"), dead modules (retrieval/platform_fit/audio-fingerprint).
- **Flat-warm tokens LOCKED (THEME-06):** app `#262624` / composer `#1e1d1b` / chip `#2f2e2b`; coral `oklch(0.68 0.13 33)≈#d97757` (lone accent); serif=Newsreader (voice only); **score zones** green `oklch(0.68 0.17 145)` / amber `oklch(0.75 0.15 85)` / red `oklch(0.60 0.20 25)`. Sidebar score chips still use emerald/amber Tailwind — **unify to the score-zone tokens in this phase** (Phase 1 follow-up).
- **~760px centered readable column** in the main area (Phase 1 D-17); rich visuals may break wider in Phase 3.
- **Thread renders at `/analyze/[id]`** permalink (Phase 1 kept it, no `/s/[id]` rename); two-layout composer drops to bottom-pinned when an id exists.

### Hero (READ-02/03/04)
- **D-01 (score render — USER OVERRIDE):** Hero score = an **arc / radial gauge** — the number inside a 0–100 filling arc, the fill zone-colored green/amber/red. (Davide overrode the recommended bare-number; he wants the instrument read.) The arc animates its fill during Phase-4 stage-reveal (calm motion). Not a glow/halo — a flat stroked arc, consistent with the matte taste bar.
- **D-02 (persona cloud — simple now):** The hero shows a **lightweight static persona cloud** — SVG/CSS dots sized by persona weight, worst cluster in coral, **no Canvas, no hover cards**. The full `PersonaGraph` (Canvas, 200 viewer dots, hover) is the **Phase-3 drill-down**, opened from the hero cloud. Source: `heatmap.personas[]` via `audience-derive` `buildPersonaNodes()`.
- **D-03 (hero layout):** **Video thumbnail strip on top** → **score (gauge) left | persona cloud right** on desktop; **stack score-then-cloud on mobile**. Matches locked mock (brief §5). Watch-through % sits with the cloud ("57% watch").
- **D-04 (gate = "don't post yet" banner):** When `anti_virality_gated` is true, a **red/coral banner above the gauge** reads "Don't post yet — [reason]" (`anti_virality_reason`: confidence / timeline_pattern / both), and the **score stays visible but subordinated** (not hidden). Reuse `AntiViralityHeader`. Score + go/no-go are paired, not exclusive.

### Driver rows (READ-05/06)
- **D-05 (row form):** Each row = **label + horizontal bar (fill = the 0–100 dimension score) + value at the right**. Reuse/adapt `FactorBars`. Bars give instant cross-row magnitude comparison.
- **D-06 (Retention's special readout):** Retention's **bar fills by its 0–100 retention score** (consistent with Hook/Share), but its **value column shows the drop timestamp `⚠ 0:08`** (`weighted_top_dropoff_t`) — the fixable lever, NOT watch-time (that's the hero). Bar = how good; value = where it breaks.
- **D-07 (row color):** **Neutral cream bars**; **only the single weakest lever** takes its zone color (amber/red) + `⚠`. The hero gauge owns the verdict color; rows stay calm and the eye lands on the lever to fix.
- **D-08 (row order):** **Fixed funnel** Hook → Retention → Shareability (attention → hold → spread). Stable, learnable; what-to-fix-first prioritization lives in Fix First, not row order.

### Disclosure — the two-tier system (READ-06/07/08) — sets the Phase-3 seam
- **D-09 (heavy drill-downs = sheet/drawer):** A row's **detail tap** (and every Phase-3 rich visual) opens a **bottom sheet on mobile / right-side drawer on desktop**. The Reading stays intact behind it; the sheet is the focused home for a heavy chart and dismisses you back in place. **This is the Phase-3 mount point** — Phase 3 drops the rich components into this same surface.
- **D-10 (light reveals = inline):** The in-thread light disclosures — **"N more fixes →"** and **"Deeper read"** — **expand inline** in the thread (short lists/text, stay in the one-document flow). Deliberate two-tier: light inline, heavy in the sheet.
- **D-11 (desktop form):** Drill-down surface = **right-side drawer on desktop** (Reading stays visible at left), **bottom sheet on mobile**.

### Phase-2↔3 seam + degraded/empty states (READ-06/08/10)
- **D-12 (seam = real native content now):** In Phase 2 the drill-down sheet shows the **actual engine data in simple native form** (e.g. Hook detail = the 4 modality sub-scores as plain rows/mini-bars; Retention = drop segments as a text list). **Phase 3 swaps these for the rich charts in the same container.** Ships a genuine, demoable drill-down — NOT stubs, NOT the rich charts pulled forward (the roadmap's structure-now / visuals-later split is kept intact).
- **D-13 (honesty / degraded data — per-block graceful):** Honor the engine's honesty flags independently per block:
  - `analysis_unavailable` (both core signals died → score collapses to a **fake 0**) → render a dedicated **"couldn't analyze this video"** state — **NEVER present the 0 as a real score.**
  - `partial_analysis` (exactly one signal dead → half-basis) → a small **"partial read"** annotation.
  - `apollo_reasoning: null` (DeepSeek circuit-breaker open → no rewrites/deeper dims) → **Deeper read shows only what's present**; hero/rows still resolve from `overall_score` + gate (which never go null).
  This is **correctness** (permalink reloads + real failures hit nulls), not polish.
- **D-14 (empty Fix First = positive win):** Zero fixes (`counterfactuals.suggestions` empty) → **"Nothing urgent to fix — this is solid"** (a win, not a blank). No rewrites (`apollo_reasoning.rewrites` empty/null) → show the timestamped fixes without the rewrite chip.
- **D-15 (the "no prose narration" line):** **Allowed** — terse labels (band word "Strong", dim names, gate reason), data, and the engine's **actionable fix/rewrite text** ("Recut the open — you lose them at 0:08"; the literal hook rewrites). **Banned** — any verdict/horoscope sentence ("your video will travel…"). The fixes are the product value; the horoscope is what's vetoed.

### Claude's Discretion (planner / executor)
- **Drill-down library** for the sheet/drawer (Radix Dialog/Drawer, shadcn `Sheet`, `vaul`, or motion) — executor's call within the flat-warm + calm-motion taste bar.
- **URL behavior of an open drill-down** (shallow `?panel=hook` sync for back-button-to-close + shareable panel state, vs pure ephemeral UI state) — UX-leaning planner call; back-button-closes-the-sheet on mobile is the desired feel.
- **Arc-gauge exact geometry / stroke / number typography** and its reveal animation curve (Phase 4 owns reveal motion).
- **Video thumbnail source + behavior** (static poster vs inline playable) at the top of the thread — planner's call.
- **Component/motion libraries** (Radix/shadcn/MagicUI/Aceternity/motion) at executor discretion within the taste bar.
- **Exact micro-copy** (band words, gate-reason phrasing, empty-state line, section labels) — finalize at build.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source of truth & contract
- `.planning/NUMEN-REWORK-BRIEF.md` — LOCKED milestone brief. **§2.3** (4-question IA), **§2.4** (driver rows: Retention = where-they-drop, not watch-time), **§2.5** (disclosure + reuse), **§2.6** (score-forward, no prose), **§2.9** (cut data), **§5** (locked result mock), **§6** (engine signal reference: CORE vs SUPPORTING vs CUT field lists). NOTE: brief prose says "Reading"; user-facing noun is "Simulation" (Phase 1 D-09).
- `.planning/REQUIREMENTS.md` — READ-01..08, READ-10 (this phase's 9-requirement contract).
- `.planning/ROADMAP.md` — Phase 2 goal + 5 success criteria. (Phase 3 = READ-09 rich visuals as drill-downs; Phase 4 = stage-reveal; keep the seam intact.)
- `.planning/phases/01-foundation-shell/01-CONTEXT.md` — carried-forward locks (D-09 Simulation, D-17 760px column, D-23 route model) + THEME-06 locked values.

### Engine data shape (read-only; engine is frozen)
- `src/lib/engine/types.ts` — `PredictionResult` (the field source). Key: `overall_score`, `anti_virality_gated` + `anti_virality_reason`, `analysis_unavailable`, `partial_analysis`, `apollo_reasoning` (nullable: `rewrites[]`, `dimensions[]` [hook/retention/clarity/share_pull/substance/credibility], `ceiling_capper`), `hero` (`HeroBlock`: `verdict_line`/`go_no_go`/`the_one_fix`), `counterfactuals.suggestions[]`, `heatmap` (`weighted_completion_pct`, `personas[]`, `weighted_top_dropoff_t`, `dropoff_segment_indices`), `hook_decomposition.weakest_modality`, `emotion_arc`. **CUT (never render):** `feature_vector`, `*_score` dead signals, `predicted_engagement`, `critique`, telemetry.

### Components to recompose (existing, all Konva-free DOM/React/SVG)
- `src/components/board/InsightHeroFrame.tsx` — already reads `overall_score`, `anti_virality_gated`, Apollo dims + rewrites. The hero's closest analog.
- `src/components/board/verdict/AntiViralityHeader.tsx` — the gate "don't post yet" header (D-04).
- `src/components/board/verdict/FactorBars.tsx` — driver-row bar analog (D-05).
- `src/components/board/verdict/TopFixesList.tsx` — Fix First analog (filters `suggestions` type='fix', top-N timestamped).
- `src/components/board/_kit/PersonaGraph.tsx` — full persona cloud → **Phase-3 drill-down**; Phase 2 builds a lightweight static cloud (D-02).
- `src/components/board/audience/audience-derive.ts` — `buildPersonaNodes()`, drop-segment + niche-ghost derivations (data shaping for hero cloud + retention readout).
- `src/components/board/audience/RetentionChart.tsx`, `SegmentTable.tsx`, `content-analysis/CraftFilmstrip.tsx`, `verdict/ScoreDistribution.tsx` — Phase-3 drill-down content (reference for what the simple Phase-2 content stands in for).

### Data/route hooks (existing)
- `src/hooks/queries/use-permalink-analysis.ts` — `usePermalinkAnalysis()` → `{ id, data: PredictionResult|null, isLoading }` for the `/analyze/[id]` reload (the Reading's static-data source in Phase 2; Phase 4 adds `useAnalysisStream` for live reveal).
- `src/hooks/queries/use-analysis-stream.ts` — `useAnalysisStream` (Phase 4 owns the live stage-reveal; referenced here for awareness of the eventual seam).

### Current surface (what Phase 2 replaces)
- `src/app/(app)/analyze/layout.tsx` + `[id]/page.tsx` — today mounts the Konva `<Board />` 8-frame grid. Phase 2 recomposes the verdict/audience/insight frames into the consolidated vertical thread on this route.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (all confirmed Konva-free — recompose, don't rebuild)
- **`InsightHeroFrame`** already assembles `overall_score` + gate + Apollo dims + rewrites — the richest starting point for the hero + Fix First + deeper-read content.
- **`FactorBars`** = ready-made label+bar+value primitive for the 3 driver rows (D-05).
- **`AntiViralityHeader`** = the gate banner (D-04).
- **`TopFixesList`** = Fix First's timestamped-fix list (D-14 empty state to add).
- **`PersonaGraph`** + `audience-derive.buildPersonaNodes()` = full cloud for Phase 3; Phase 2 derives a static dot-cloud from the same `heatmap.personas[]` (D-02).
- **`usePermalinkAnalysis`** = single-analysis fetch by route id → `PredictionResult` (the Reading's Phase-2 data source).
- Hooks present: `useIsMobile`, `usePrefersReducedMotion` (mobile sheet vs desktop drawer switch; reduced-motion for the gauge animation).
- Libs available: Radix, shadcn, motion/Framer Motion, Phosphor + Lucide, CVA, `cn()`.

### Established Patterns
- Flat-warm `@theme` semantic tokens (THEME-06 locked) — the gauge fill, weakest-row color, and gate banner reference the **score-zone tokens** (`--color-success/warning/error` or equivalents); **unify the sidebar score chips onto these** this phase.
- kebab-case components, `"use client"` for interactive, barrel exports.
- CLAUDE.md gotchas: oklch L<0.15 miscompiles → hex for dark surfaces; Lightning CSS strips `backdrop-filter` → blur via inline `style`.

### Integration Points
- `/analyze/[id]` route — recompose the Board frames into the vertical thread (the Konva shell/camera/pan-zoom dies; the frame content components live on).
- Drill-down sheet/drawer (D-09) — **new shared container** that Phase 3's rich visuals mount into. Build it generic enough to receive any panel.
- `usePermalinkAnalysis` → the Reading (static, Phase 2); `useAnalysisStream` is the Phase-4 swap-in for live reveal — keep the Reading's data source abstracted so Phase 4 can drive it from the stream without a rewrite.
</code_context>

<specifics>
## Specific Ideas

- **The locked mock (brief §5)** is the layout north star: thumbnail → `│71│ Strong` gauge + dot-cloud + "57% watch" → `Hook ▓▓▓▓▓ 87 / Retention ▓▓▓ ⚠0:08 / Shareability ▓▓▓▓ 64` → FIX FIRST (`▸ Recut the open…` + `▸ 2 more fixes →`) → `▸ Deeper read` → quick-action chips + composer.
- **Whoop-style** = the zone-color logic on the gauge (green/amber/red by score), realized here as an actual **arc gauge** (D-01, Davide's override).
- **"Hero = the outcome; rows = the levers you change next time"** (brief §2.4) — the framing behind neutral rows + only-weakest-colored (D-07) and fixed funnel order (D-08).
- **Two-tier disclosure** (D-09/D-10): the single most reused decision — Phase 3 and Phase 5 both plug into the sheet/drawer + inline-expand pattern set here.
</specifics>

<deferred>
## Deferred Ideas

- **Full `PersonaGraph` (Canvas) drill-down** — Phase 3 (opened from the Phase-2 static hero cloud, D-02). Not out-of-milestone, just the next phase.
- **Rich board visuals as drill-downs** (RetentionChart, filmstrip, SegmentTable, emotion arc, FactorBars-rich, niche/ghost curves) — Phase 3 (READ-09); Phase 2 builds the containers + simple native content (D-12).
- **Naming reconciliation** (carried from Phase 1's Brief-Deviations follow-up): brief/roadmap/requirements prose + the `READ-*` IDs still say "Reading"; user-facing build uses "Simulation." A separate prose-reconciliation pass, NOT done here.
- **Shareable/deep-linked drill-down panels** (`?panel=…` that survives share) — possible once the sheet exists (D-09 discretion); fuller "share a Reading as image/link" is a v2 growth-loop req (`SHARE-01`).
- **Gray areas offered but not discussed** (Davide chose "ready for context"): thumbnail static-vs-playable, scroll/anchor behavior between hero and rows, how the composer-as-follow-up sits under a complete Reading (the last is largely Phase-5/CHAT scope). Left to planner discretion or a future touch-up.

### Observation for the planner (not a scope change)
The scout confirmed **all board visuals are already Konva-free DOM/React/SVG** — only the outer canvas shell uses Konva. So **Phase 3 is a reskin + remount, not a heavy transplant** — lighter than the roadmap assumed. The phase split is kept intact (Phase 2 = structure + simple native content; Phase 3 = rich visuals in the same containers); flagged only so the planner sizes Phase 3 realistically.
</deferred>

---

*Phase: 2-The Reading (user-facing: "The Simulation")*
*Context gathered: 2026-06-14*
