# Phase 5 — Discussion Log

**Date:** 2026-05-27
**Mode:** Claude's-discretion (user requested: "analyze, optimize and verify in detail all gray areas and discussion topics in detail step by step and choose your thought-through recommendation")

## Gray Areas Presented

User was offered 4 thematic clusters (multi-select):

1. **Verdict node body + reasoning + vs-history** (5.1–5.4)
2. **Actions group + placeholders + similar videos** (5.5 + 5.6)
3. **Content Analysis nodes** (Hook decomp 5.7 + Emotion arc 5.8)
4. **Cross-group ripple extension** (5.9)

## User Selection

> "analyze, optimize and verify in detail all grey areas and discussion topics in detail step by step and choose your thought trough recommendation"

→ All 4 clusters driven by Claude with thought-through recommendations grounded in codebase inspection.

## Discussion Drivers (per cluster)

### Cluster 1 — Verdict node body + reasoning + vs-history

**Grounding work:**
- Read `src/lib/engine/types.ts` `PredictionResult` — confirmed `reasoning` is flat DeepSeek string, `warnings` array, `factors` array, `counterfactuals.suggestions[]` (Phase 13 shape).
- Inspected `src/components/competitors/comparison/comparison-bar-chart.tsx` — confirmed Recharts pattern in stack.
- Inspected `board-constants.ts:26-31` — Verdict frame bounds 360×280 (tight).

**Decisions made:**
- D-01..D-09 — vertical stacking, percentile hero treatment, anti-virality orange header, client-side reasoning assembly (no engine schema change), Recharts comparison charts.
- O-2 — client-side 4-sub-section assembly mapping from `reasoning` + `warnings` + `factors` + `counterfactuals.suggestions[]`.
- D-09 — comparison data source as Claude's Discretion (server endpoint vs client aggregation).

### Cluster 2 — Actions group + placeholders + similar videos

**Grounding work:**
- Verified Actions frame bounds 360×200 (tight for 4 children).
- Inspected `src/components/trending/video-card.tsx` — confirmed it's ~190 lines optimized for grid-tile display.
- Inspected `src/components/trending/tiktok-embed.tsx` exists for tap-to-modal.

**Decisions made:**
- D-10 — 2×2 grid default, grows to hero-on-anti-virality.
- D-11 — dashed-border dim placeholder treatment ("Coming in Phase N").
- O-6 — build `SimilarVideoCardCompact` (new compact variant) NOT a `/trending` VideoCard reuse — different layout (1-col mini-tile vs grid).
- D-13 — similar-videos data source = `result.retrieval_evidence[]`.

### Cluster 3 — Content Analysis (Hook decomp + Emotion arc)

**Grounding work:**
- Read `src/lib/engine/qwen/schemas.ts:15` — confirmed HookDecomposition exact shape (4 sub-scores + weakest_modality + coherence + cognitive_load with INVERTED polarity).
- Read `src/lib/engine/qwen/schemas.ts:56` — EmotionArcPoint shape (timestamp_ms × intensity_0_1 × label).
- Verified Content-Analysis frame bounds 1352×200 (wide horizontal strip).

**Decisions made:**
- O-5 — horizontal split layout (Hook left, Emotion right).
- D-16 — 4-bar GlassProgress stacked vertically (label/bar/score) + weakest-modality coral-tint highlight + 2-chip row.
- D-17/D-19 — empty state captions, don't hide nodes.
- D-18 — Recharts AreaChart with coral linearGradient + ReferenceDot peak/valley markers.
- D-20 — Recharts (not canvas) — static post-complete, declarative wins over canvas's streaming-driven justification from Phase 4.
- Cognitive_load polarity inversion (raw value high → label "Low") explicitly called out per schema comment.

### Cluster 4 — Cross-group ripple extension (5.9)

**Grounding work:**
- Read `src/components/board/Board.tsx:47` — confirmed hard-coded `frameId === 'verdict' || 'audience'` check.
- Read `src/stores/board-store.ts:247-251` — confirmed anti-virality selector already exists.

**Decisions made:**
- D-21 — extract `useAntiViralityAffectedFrames()` selector + `getFrameAntiViralityState()` resolver to `src/components/board/cross-group-state.ts`.
- D-22 — `<ActionsReshootHeroSlot />` API: Phase 5 ships as placeholder, Phase 6 fills.
- D-23 — Verdict + Audience + Actions all subscribe to same selector (single source of truth).
- D-24 — forward investment: resolver accepts state-name argument so future ripple signals (R1.9 high-confidence loop, exceptional hook score) extend without refactor.

## Scope Creep / Deferred

- Engine-side `reasoning_sections` field — deferred to v1.1 engine extension if client-side assembly fails QA.
- Live-jump citations — Phase 5 ships static text; live behavior deferred to M2-II.
- Anti-virality override rationale text input — deferred to M2-III outcome feedback loop.
- Comparison chart history depth > 10 — deferred to workspace milestone.
- Conversational "Why did X factor score low?" co-pilot — deferred to M2-II/III (carried from Phase 4 deferred list).
- Recharts → canvas swap for emotion arc — conditional on perf-tier audit.
- Inspector primitive extraction — deferred Claude's Discretion (Phase 5 may ship per-node inspectors).
- Hook decomp tactical-fix drill-down — owned by Phase 6 reshoot script.

## Carry-forward Patterns (from Phase 4)

- Anti-virality QUIET treatment (coral→orange, no red/green) — Verdict orange header + Audience preserved + Actions hero promotion coordinate via same selector.
- Konva = frame only; DOM overlay = node body.
- Coral #FF7F50 only accent.
- Performance test device = iPhone 11, ≥45fps.
- Engine schemas locked; UI-only phase.
- bypassPermissions on workers, default on auditors.

## Open Questions for Researcher

(All captured as "Claude's Discretion" entries in CONTEXT.md `<decisions>`.)

- Reasoning narrative split heuristic (sentiment vs structural).
- Comparison endpoint vs client-side aggregation (D-09).
- Percentile derivation (use `overall_score` directly or compute).
- Markdown renderer choice + safety (react-markdown + rehype-sanitize bias).
- Recharts bundle impact measurement.
- Inspector primitive extraction depth.
- Anti-virality override event mechanics (Post anyway link + localStorage dismissal).

---

*Discussion log written after CONTEXT.md per workflow template.*
