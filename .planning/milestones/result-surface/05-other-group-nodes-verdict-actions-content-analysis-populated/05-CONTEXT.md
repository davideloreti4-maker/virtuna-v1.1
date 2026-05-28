# Phase 5: Other group nodes — Verdict + Actions + Content Analysis populated - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning
**Mode:** Claude's-discretion across all gray areas (per user request: "analyze, optimize, verify in detail all gray areas and choose your thought-through recommendation"). Every decision below is a starting point researcher/planner can override with codebase evidence.

<domain>
## Phase Boundary

Populate the remaining three group container frames — **Verdict** (R1.3), **Actions** (R1.4 + R1.5 + placeholders for R5/R6/R4), and **Content Analysis** (R1.6 = Hook decomp + Emotion arc) — with their full bodies, plus extend the Phase 4 anti-virality cross-group ripple (R1.9) so the orange treatment lands on Verdict's header + top-3 fixes section and pre-stages an Actions hero slot that Phase 6 will fill with reshoot script.

This phase delivers:

- **Verdict node body** (5.1) — large percentile chip + confidence chip + anti-virality state header row, anchored to `result.overall_score` / `result.confidence` / `result.anti_virality_gated`.
- **"Why this verdict?" collapsible** (5.2) — 4 sub-sections (Why this works / Why this might not / What the engine flagged / Counterfactual considered) assembled client-side from `result.reasoning` (DeepSeek narrative split), `result.warnings`, `result.factors`, and `result.counterfactuals.suggestions` — no engine schema change.
- **"vs my history" collapsible** (5.3) — two horizontal Recharts BarChart panels (vs creator's last-10 + vs niche cohort), empty state when prior analysis count < 3.
- **Anti-virality "Don't post yet" state** (5.4) — orange header inside Verdict + top-3 fixes anchored to segments (cross-references Audience filmstrip via segment timestamps), constructive copy per Phase 4 D-15/D-16. User can override (event-tracked, no hard block).
- **Actions group containers** (5.5) — frame-internal layout that holds: Reshoot placeholder slot (Phase 6 fills), Optimal-post placeholder slot (Phase 6 fills), Similar-videos card (real, this phase), Share placeholder slot (Phase 7 fills). All placeholders ship as labeled, dimmed "Coming in next phase" cards — visible enough to set expectations, dim enough not to feel broken.
- **Similar videos panel** (5.6) — compact-variant VideoCard (NOT a copy of `/trending`'s VideoCard; build `VideoCardCompact` reusing `Card` + `GlassPill` primitives), 5 items in a 1-column scrollable list inside Actions bounds. Tap → existing `tiktok-embed` modal.
- **Content Analysis: Hook decomp node** (5.7) — 4-bar GlassProgress (visual / audio / text / speech sub-scores from `result.hook_decomposition`) + coherence + cognitive-load chips, weakest-modality highlighted, expand pattern routes to inspector (Phase 4 precedent).
- **Content Analysis: Emotion arc node** (5.8) — Recharts area chart over `result.emotion_arc[]` (timestamp_ms × intensity_0_1), coral gradient gray→coral-200→coral-500 keyed off `label`, peak/valley marker dots.
- **Cross-group ripple extension** (5.9) — extend Phase 4's `frameId === 'verdict' || 'audience'` anti-virality check in `Board.tsx:47` to include `'actions'`; introduce an `ActionsRework slot` API that Phase 6 will plug the reshoot-script hero into; Verdict + Audience + Actions all subscribe to the same `useBoardStore` anti-virality selector (no new state).

**Out of scope (other phases):**
- Reshoot script content (Phase 6 — Phase 5 ships the empty hero slot + placeholder card only)
- Optimal post time content (Phase 6 — Phase 5 ships the placeholder card only)
- Share & export content (Phase 7 — Phase 5 ships the placeholder card only)
- Mobile polish + onboarding overlays + regression audit (Phase 8)
- Engine schema changes — Phase 5 is pure UI consumption of Phase 1+3+13 contracts (`reasoning`, `warnings`, `factors`, `counterfactuals`, `hook_decomposition`, `emotion_arc`, `weighted_*`, `dropoff_segment_indices`)
- Audience node (Phase 4 — shipped)
- Engine group + Input node + drawer (Phase 2 — shipped)
- Free-form reasoning citations as live navigation (deferred — Phase 5 ships citations as static text references; live-jump deferred to M2-II)
- Per-analysis history aggregation queries (Phase 5 assumes a thin server endpoint or precomputed bundle — researcher locks during planning, see D-09)

</domain>

<decisions>
## Implementation Decisions

### Architectural optimizations (apply across all three nodes)

- **O-1: Konva = frame-positioning only; node bodies = DOM overlay.** Carried forward from Phase 4 O-1. Verdict + Actions + Content Analysis bodies live in `NodeOverlay.tsx` DOM children; Konva renders the group frame border + title bar only. Hook decomp's GlassProgress bars, Emotion arc's Recharts chart, Verdict's chips + collapsibles, Actions' card slots all = React DOM. Researcher confirms the `NodeOverlay` pattern composes correctly with three sibling node bodies inside three sibling group frames (same `Board.tsx` rendering pass).
- **O-2: Reasoning narrative = client-side assembly, no engine change.** `result.reasoning` (DeepSeek narrative string) + `result.warnings[]` + `result.factors[]` + `result.counterfactuals?.suggestions[]` are sufficient to render the 4 sub-sections R1.3 demands. Mapping (locked here, planner may refine):
  - **"Why this works"** = filter `factors[]` where `score >= max_score * 0.7` + extract positive sentences from `result.reasoning` (regex on "works", "strong", "well", etc., OR — simpler — split `reasoning` on sentence boundaries and bucket by sentiment heuristic; researcher decides).
  - **"Why this might not"** = filter `factors[]` where `score < max_score * 0.4` + negative-sentiment sentences from `reasoning` + first 2 items of `counterfactuals.suggestions` where `type === 'fix'`.
  - **"What the engine flagged"** = `result.warnings[]` rendered as bullet list with badge styling (`warnings` is already a flat string array — direct render).
  - **"Counterfactual considered"** = `result.counterfactuals.suggestions[]` filtered to `type === 'fix' || type === 'stretch'`, rendered with timestamp anchors that link to Audience filmstrip segment indices.

  Bias toward the simplest split: if sentiment heuristic on `reasoning` proves fragile, researcher should propose a small engine-side `reasoning_sections: { works, might_not, flagged, counterfactual }` field for v1.1 — but Phase 5 ships with client-side assembly to avoid blocking on engine work.
- **O-3: Reuse Phase 4 primitives where possible — never re-implement.** `GlassPanel`, `GlassProgress`, `GlassPill`, `Card`, `TapPopover` (Phase 4), `PersonaInspector` pattern (Phase 4) are the substrate. Hook decomp + Emotion arc expand → reuse `PersonaInspector` shell renamed conceptually as "NodeInspector" (or extract a base `Inspector` primitive — researcher decides). No new bottom-sheet / right-side-panel infrastructure.
- **O-4: Anti-virality selector centralization.** Phase 4's `Board.tsx:47` hard-codes `frameId === 'verdict' || 'audience'`. Refactor to a `useAntiViralityAffectedFrames()` selector returning `Set<FrameId>` driven by `boardState` + `result.anti_virality_reason`. Initial set = `{'verdict', 'audience', 'actions'}` when `boardState === 'anti-virality'`. Future ripple expansions (R1.9 — high-confidence loop, exceptional hook score) extend this selector without touching `Board.tsx`. Single source of truth.
- **O-5: Content-analysis frame is a horizontal split, not a stack.** Frame bounds = `1352 × 200` (per `board-constants.ts:31`). Two child nodes side-by-side: Hook decomp (left, ~480px) + Emotion arc (right, ~872px). Vertical 200px budget is tight — both nodes must fit headline + body + a single expand affordance without scroll. Expand → inspector (per O-3), not in-place growth. Reduces frame-resize choreography vs Phase 4's Audience drawer.
- **O-6: VideoCardCompact is a new compact-variant, not a `/trending` reuse.** `/trending` `VideoCard` is ~190 lines, optimized for grid-tile display, depends on `useBookmarkStore`. Inside a 360×200 Actions frame, we need a 1-column horizontal-mini-tile (thumb 56×56 + creator + views + similarity score) — different visual model. Build `src/components/board/actions/SimilarVideoCardCompact.tsx` (~80 lines). Both share `tiktok-embed` modal trigger. Cross-link the original `VideoCard` in a code comment so future refactors can extract a shared base if patterns converge.

### Verdict node (5.1–5.4)

- **D-01: Vertical stacking inside Verdict frame** (360×280 base, grows when collapsibles open): `Anti-virality state header (conditional, 40px when shown)` → `Percentile chip row (big, ~72px tall, percentile left + confidence pill right)` → `"Why this verdict?" collapsible (24px collapsed / ~280px expanded)` → `"vs my history" collapsible (24px collapsed / ~200px expanded)`. Both collapsibles default-closed. Frame height grows organically per Phase 2 D-03 pattern.
- **D-02: Percentile chip = hero visual treatment.** Big number rendering `result.overall_score` (0–100) with explicit suffix label "th percentile" (single-shot calc: if `overall_score` is itself the percentile, use directly; otherwise researcher locks the percentile derivation — bias toward direct use). Font: `text-5xl` or `text-6xl` semibold Inter, coral when `≥70`, white/95 otherwise. Subtle band classification text below ("Strong / Mid / Low" derived from `band` field if exposed, else from score thresholds — researcher confirms).
- **D-03: Confidence chip = small GlassPill** to the right of the percentile, content `"Confidence: HIGH | MED | LOW"` from `result.confidence_label`. Color: white/60 text, no special accent (per Phase 4 — coral is for accents only, confidence is contextual not celebratory). Tap chip → popover explaining what confidence means (1-2 sentences).
- **D-04: Anti-virality state header (when `anti_virality_gated === true`)**: full-bleed orange band at top of Verdict frame, height 40px. Copy: `⚠ Don't post yet — fixable in {N} steps` where N = `counterfactuals.suggestions.filter(s => s.type === 'fix').length` capped at 3. Coral-to-orange gradient consistent with Phase 4 D-15. NO red. Constructive framing (no "FAIL", no "REJECTED"). Tap header → scrolls / expands "Why this verdict?" pre-opened to "Counterfactual considered" section.
- **D-05: "Why this verdict?" collapsible body** = the 4 sub-sections (D-01 / O-2 mapping). Sub-sections rendered as small chip-headers + body content. Each section can be individually expanded if researcher wants progressive disclosure — initial recommendation is all-4-open-when-parent-opens (simpler mental model). Inline `[seg 4]` citations route to Audience filmstrip via segment index — Phase 5 ships static text styling for citations (subtle coral underline); live-jump deferred per scope. Reasoning markdown rendered via existing markdown component (researcher checks `src/components/` for an existing renderer; if none, use `react-markdown` — already a likely transitive dep, verify).
- **D-06: "vs my history" collapsible body** = two horizontal Recharts `BarChart` instances, stacked vertically.
  - **Top chart**: "vs your last 10 analyses" — 11 bars (current + 10 prior), x-axis = `overall_score` 0-100, current bar in coral, history bars in white/30.
  - **Bottom chart**: "vs niche cohort (n=X)" — single comparison: current score (coral) vs niche median (white/30) vs niche p75 (white/15), as a 3-bar horizontal mini-chart.
  - Both charts use Recharts (already in stack, used by `src/components/competitors/comparison/comparison-bar-chart.tsx`) — `ResponsiveContainer` + `BarChart` + `XAxis` + `Bar`, no `CartesianGrid` (Raycast minimal).
- **D-07: Empty state** (per R1.3): when prior analysis count < 3, the "vs my history" collapsible body shows a small inline message: `"Need 3+ prior analyses to show comparison. {N}/3 complete."` Collapsible header stays visible (don't hide the section — discoverability matters).
- **D-08: Top-3 fixes anchored to segments** (R1.3 anti-virality requirement) = renders inside the "Counterfactual considered" sub-section of D-05 ONLY when `anti_virality_gated === true`. Each fix = small card: `[seg 4 · 0:08]` timestamp pill (clickable → highlights filmstrip frame in Audience node) + `headline` (≤80 chars) + `detail` (1-2 sentences). Tap timestamp pill = pan camera (Phase 2 use-camera.ts) to Audience node + flash the filmstrip frame at that segment.
- **D-09: Comparison data source** = thin server endpoint `/api/analyze/[id]/comparisons` returning `{ history: number[], niche: { median: number, p75: number, count: number } }`. Endpoint is precomputed — pulls `analyses` rows for `user_id ORDER BY created_at DESC LIMIT 10` + cached niche aggregates. **Claude's Discretion** — researcher decides between: (a) ship endpoint as Phase 5 task, (b) use a TanStack Query against an existing endpoint if one exists, (c) compute client-side from cached analyses list (faster to ship, no new endpoint, but pulls full analysis rows — only acceptable if list query already runs for sidebar's "Recent" section).

### Actions node (5.5 + 5.6)

- **D-10: Actions frame internal layout** (base 360×200, grows when reshoot promotes to hero): default state = 2×2 grid of cards: top-left = Reshoot placeholder, top-right = Optimal-post placeholder, bottom-left = Similar videos card, bottom-right = Share placeholder. Each card ~170×88. Anti-virality state = frame grows to 360×360, top half becomes full-bleed Reshoot hero slot (Phase 6 fills), bottom half stays 2×2 with Optimal-post / Similar / Share + a smaller Reshoot-summary stub.
- **D-11: Placeholder card treatment** — dim Card with `bg-white/[0.02]`, border-dashed (NOT solid — signals incompleteness without feeling broken), centered icon + label like `"Reshoot script" + "Coming in Phase 6"` in white/40. Not interactive (no hover state). Skeleton would imply loading; dashed border implies intentional empty. Decision rationale: feels like a project on a workboard with unstarted tasks, not a broken UI. Verified against Phase 4 magic-moment framing (set expectations forward, don't disappoint backward).
- **D-12: Similar videos card** (5.6) = real, this phase. Renders inside one card slot (170×88 in default state, expands to full-width 360×88 if researcher decides similar-videos should be hero-of-actions when no anti-virality). Card body = horizontal compact list of 5 `SimilarVideoCardCompact` rows (see O-6), each 56×56 thumb + creator @handle + view count + similarity score. Single horizontal scroll inside the card if all 5 don't fit; on tap-and-hold on mobile, scroll lock for vertical board pan.
- **D-13: Similar-videos empty state** (R1.5) = when `retrieval_evidence[]` is empty or `signal_availability.retrieval === false`, card body shows: `"No similar videos yet — try a new analysis"` + small refresh icon. Researcher confirms data source: `result.retrieval_evidence[]` (Phase 8 D-02 shape, max 5 items, per types.ts:306) is the canonical source. Each item maps to a `TrendingVideo`-shaped object — research the exact mapping in `retrieval_evidence` schema.
- **D-14: Actions tap → modal pattern**. Similar-video tap → existing `src/components/trending/tiktok-embed.tsx` modal (reuse). Placeholder cards = no tap action. Reshoot hero slot (Phase 6) defines its own tap behavior.

### Content Analysis nodes (5.7 + 5.8)

- **D-15: Frame internal layout** (1352×200 per O-5) = horizontal split into 2 nodes side-by-side: Hook decomp (left, ~480px, plus 16px gap) + Emotion arc (right, ~872px). 8px frame padding all around. No inline expand — both nodes route to inspector via Phase 4 pattern.
- **D-16: Hook decomp node composition**:
  - **Headline strip** (top, ~28px): node label "Hook decomposition" + small timestamp pill `0-3s` showing the hook zone (use `is_hook_zone` segment range from Phase 3 D-13).
  - **4-bar GlassProgress stack** (~120px): four horizontal `GlassProgress` bars stacked vertically, each ~22px (label left, bar middle, score right). Labels: "Visual stop power" / "Audio hook" / "Text overlay" / "First words". Values from `result.hook_decomposition.{visual_stop_power, audio_hook_quality, text_overlay_score, first_words_speech_score}`.
  - **Weakest-modality highlight**: the bar matching `result.hook_decomposition.weakest_modality` gets a subtle coral-tint background band (`bg-accent/8`) — single visual cue, no extra text.
  - **Chip row** (bottom, ~32px): two GlassPills side-by-side — `Coherence: {visual_audio_coherence}/10` + `Cognitive load: {label}` where label = "Low / Med / High" derived from `cognitive_load` value with INVERTED polarity per schema comment (higher = worse, so 0-3=Low, 4-6=Med, 7-10=High).
  - **Tap any bar / chip → inspector** (per O-3) with full reasoning: which hook factors are contributing, weakest modality fix suggestion (pulled from `counterfactuals.suggestions` filtered by `signal_anchor` matching hook).
- **D-17: Hook decomp empty state** = when `result.hook_decomposition` is null/undefined (engine fallback), render the four bars at 0 with a thin "Hook analysis unavailable for this video" caption. Don't hide the node — keeps board structure consistent.
- **D-18: Emotion arc node composition**:
  - **Headline strip** (top, ~28px): "Emotion arc" + small chip showing peak intensity timestamp (e.g., `Peak at 0:12`).
  - **Area chart body** (~140px): Recharts `<AreaChart>` over `result.emotion_arc[]` mapping `timestamp_ms` (x-axis) → `intensity_0_1` (y-axis 0-1). `ResponsiveContainer` to fill the node bounds.
  - **Color gradient** = vertical fill gradient (`<linearGradient>` defined inline in the Recharts `<defs>`): bottom = `rgba(132, 133, 134, 0.1)` (gray-muted from CLAUDE.md token), mid = coral-200 alpha 0.3, top = coral-500 alpha 0.6. Line stroke = coral solid. Reads as "intensity rising into the coral zone".
  - **Peak/valley markers**: small 6px coral dots on points where `label === 'high'` (peaks) and gray dots on `label === 'low'` (valleys). Use Recharts `<ReferenceDot>` or a custom dot renderer. No labels on dots — discoverable via tap.
  - **Tap dot → popover** (reuse Phase 4 `TapPopover` if API is generic enough; if not, lift it to `src/components/ui/TapPopover.tsx`): timestamp + intensity value + brief context line.
- **D-19: Emotion arc empty state** = when `result.emotion_arc` is null or empty array, render a flat baseline line at y=0.5 in gray with caption "Emotion arc unavailable" + faint coral hint. Same don't-hide reasoning as D-17.
- **D-20: Recharts over canvas decision** = use Recharts here, NOT canvas (Phase 4 D-10 picked canvas for retention curve). Reasoning: emotion_arc is static post-`complete` (no streaming morph, no per-segment fill animation, no slider-driven recompute) — Recharts' declarative simplicity beats canvas' performance budget here. Phase 4's canvas decision was driven by streaming + slider scrub + morph; none of those apply to emotion arc. If perf-tier audit later shows Recharts being heavy on Low tier, researcher can swap to canvas — keep the component boundary clean to allow it.

### Cross-group ripple (5.9)

- **D-21: Refactor `Board.tsx:47` `frameVisualState` resolver** → extract to `src/components/board/cross-group-state.ts` exposing `useAntiViralityAffectedFrames(): Set<FrameId>` selector + `getFrameAntiViralityState(frameId): 'idle' | 'anti-virality' | 'complete'` resolver. Initial affected set = `{verdict, audience, actions}` when `useBoardStore(s => s.boardState) === 'anti-virality'`. `Board.tsx` calls the resolver instead of hard-coding the frame id check.
- **D-22: Actions slot API for Phase 6 reshoot hero** = expose `<ActionsReshootHeroSlot />` as a Phase 5-created component that renders nothing (or a placeholder) in Phase 5, and is replaced/filled-in by Phase 6. Phase 5 reserves the layout slot + writes the conditional render rule: when `getFrameAntiViralityState('actions') === 'anti-virality'`, Actions frame grows to 360×360 and `<ActionsReshootHeroSlot />` becomes visible. Phase 5 ships the slot as a dashed placeholder card (per D-11 pattern); Phase 6 swaps the placeholder content for real reshoot UI without touching the slot wrapper.
- **D-23: Verdict header coordination** — when `anti_virality_gated === true`, Verdict header renders D-04 orange band. Audience already renders Phase 4 D-15 QUIET treatment. Actions renders the grown hero state per D-22. All three subscribe to the same `useBoardStore` selector — single source of truth, no prop drilling. Concurrent renders triggered by one state change (Phase 4 board-store anti-virality transition already in place).
- **D-24: New ripple signal hook for future expansions** = the `cross-group-state.ts` resolver from D-21 takes a state-name argument (currently only `'anti-virality'`). Future signals (high-confidence loop, exceptional hook score, R1.9 wording "Future signals follow same ripple pattern") plug in by extending the resolver — Phase 5 ships the abstraction so Phase 8 / M2 milestones don't refactor cross-group wiring.

### Streaming + state handling

- **D-25: All three new nodes render against streaming partial result**. While `boardState !== 'complete'`, render skeleton states:
  - **Verdict skeleton** = percentile chip = `--` placeholder, confidence chip = "Calculating…", collapsibles disabled.
  - **Hook decomp skeleton** = 4 bars at 0% with shimmer, chips greyed.
  - **Emotion arc skeleton** = flat gray baseline line.
  - **Actions** = static placeholder cards render immediately (no skeleton — placeholder IS the static state until Phase 6).
  - **Similar videos card** = skeleton 5 mini-row placeholders until `result.retrieval_evidence` populates.
- **D-26: Anti-virality transition timing** = Phase 4 wires the `complete → anti-virality` transition in `Board.tsx` `useEffect` (board-store.ts:90). Phase 5 inherits this — no new transition logic. Verdict's orange header + Actions' grown hero slot animate in via CSS transition (200ms ease-out opacity + height) when `boardState` flips.

### Accessibility + perf-tier respect

- **D-27: `prefers-reduced-motion`** — Verdict collapsibles use simple height transition (no spring, no scale), Recharts emotion-arc chart loads with no entrance animation when reduced-motion set, Hook decomp bar-fill animations skip (jump to final). Same `usePrefersReducedMotion` hook from Phase 2 D-23 / Phase 4.
- **D-28: Perf-tier degradation** — Low tier: Recharts emotion arc still renders (declarative chart is cheap), but tap-popover dots disabled (only ReferenceDots stay visible for peak/valley). Medium tier: full features. Same `src/lib/perf-tier.ts` subscription from Phase 2 D-20 / Phase 4.
- **D-29: `aria-live` regions** — Verdict announces "Verdict ready: {score}, confidence {level}" on `complete`, and "Don't post yet — see suggested fixes" on anti-virality transition. Hook decomp announces "Hook score: {weakest_modality} is weakest". Emotion arc announces "Emotion arc rendered, peak intensity at {timestamp}". One `aria-live="polite"` region per node, debounced 500ms after `complete`.
- **D-30: Keyboard navigation** — Verdict collapsibles open/close on Enter/Space (use `<details>` element OR `role="button" + aria-expanded` — researcher decides; bias `<details>` for built-in semantics, override styling with Tailwind). Hook decomp bars + emotion arc dots focusable via Tab, Enter opens inspector. Cross-group ripple does not change focus — focus stays where user put it (anti-virality transition is screen-state change, not modal flow).

### Telemetry

- **D-31: Structured logger events** (per NF4):
  - `verdict_node_rendered` (with `score`, `confidence_label`, `anti_virality_gated`)
  - `verdict_reasoning_expanded` / `verdict_history_expanded`
  - `verdict_anti_virality_override` (when user dismisses the "Don't post yet" header — R1.3 event tracking)
  - `hook_decomp_expanded` (with `weakest_modality`)
  - `emotion_arc_peak_tapped` (with `timestamp_ms`)
  - `similar_video_tapped` (with `video_id`, `similarity_score`)
  - `actions_reshoot_placeholder_visible` (one-shot per analysis, to measure Phase 6 anticipation)
  - `cross_group_ripple_applied` (with `signal: 'anti-virality'`, `affected_frames`)

### Claude's Discretion (researcher locks during planning)

- **Reasoning narrative split heuristic** (D-05 / O-2) — sentiment classification on sentence boundaries vs. simple paragraph splitting on existing structure within `result.reasoning`. Bias toward simplest: if DeepSeek's reasoning has implicit structure (numbered lists, headings, "However" pivots), use that; otherwise group `factors[]` by score thresholds without splitting `reasoning` at all and present `reasoning` as a single intro paragraph above the 4 buckets.
- **Engine-side `reasoning_sections` field for v1.1** — if client-side assembly fails QA at any point, researcher proposes the engine extension as a follow-up phase. Phase 5 ships without it.
- **Markdown renderer** — `react-markdown` likely already a transitive dep; if not, prefer it (small, secure with `rehype-sanitize`) over installing a heavier alternative. Researcher checks `package.json` first.
- **Percentile vs raw score interpretation** — `overall_score` is 0-100 (per types.ts:212). Whether that IS the percentile or whether percentile is computed against a corpus distribution — researcher confirms with `src/lib/engine/calibration.ts` + corpus stats. If percentile derivation requires a server call, surface it via the same `/api/analyze/[id]/comparisons` endpoint (D-09).
- **Comparison endpoint vs client-side aggregation** (D-09) — pick one and document why. Bias server endpoint for correctness + caching.
- **Recharts version + tree-shaking** — Recharts is already in the stack but check bundle impact when adding emotion-arc + comparison charts. If size becomes a concern, consider `victory` or hand-rolled SVG; researcher only acts on this if measured impact > 30KB gzipped delta.
- **VideoCardCompact extraction location** — `src/components/board/actions/SimilarVideoCardCompact.tsx` (proposed). If researcher finds 2+ places needing the same compact card, lift to `src/components/ui/VideoCardCompact.tsx`.
- **Inspector primitive extraction** (O-3) — `PersonaInspector` from Phase 4 is persona-specific. Researcher decides whether to (a) extract a base `<Inspector />` primitive in `src/components/ui/Inspector.tsx`, (b) leave `PersonaInspector` alone and build node-specific inspectors per node (`HookDecompInspector`, `EmotionArcInspector`), or (c) build a generic `NodeInspector` that takes a render-prop. Bias (a) — extracting a base primitive — only if it's <2 hours of work and PersonaInspector's shape is clearly generic. Otherwise (b) for simplicity.
- **Anti-virality override event details** (D-04 / R1.3) — what does "override" mean concretely? Recommendation: a small "Post anyway →" link in the orange header that, when tapped, fires `verdict_anti_virality_override` event + dismisses the header (state persists per analysis ID in localStorage so it doesn't re-appear on board re-mount). No engine state change. Researcher confirms.
- **Comparison chart axes + tooltips** (D-06) — Recharts default tooltip vs custom `ChartTooltip` reuse from `src/components/competitors/charts/chart-tooltip.tsx`. Bias reuse.
- **Emotion arc x-axis label format** — timestamps in `mm:ss` not raw ms. Reuse a util if one exists (likely in `src/lib/utils.ts` or `src/lib/time.ts`).
- **Hook decomp bar polarity for cognitive_load** — schema comment: "POLARITY INVERTED: higher score = MORE cognitive load = WORSE retention." For the chip display, invert visually: show "Cognitive load: Low" when raw value is high. Don't surface the raw 0-10 directly — bucket label only.
- **Reduced-motion behavior for Recharts** — Recharts has `isAnimationActive` prop on `<Area>`. Wire it to `!prefersReducedMotion`.
- **Actions frame default state when NO similar videos AND NO anti-virality** = the bottom-left card slot would be the empty-state similar-videos card per D-13. Frame stays 360×200, no grow. Confirm this reads as intentional, not empty.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone + roadmap
- `.planning/MILESTONE.md` — Result Surface milestone scope + board-model amendment (2026-05-25) + magic-moment framing
- `.planning/ROADMAP.md` §Phase 5 — phase goal, plans 5.1-5.9, success criteria, dependencies (Phase 4 visual + state patterns)
- `.planning/REQUIREMENTS.md` §R1.3 (Verdict node — full spec including 4-sub-section reasoning + 2 comparison charts + anti-virality override), §R1.4 (Actions node container contract), §R1.5 (Similar videos — Top-K=5 default, VideoCard reuse pattern, TikTok embed modal trigger), §R1.6 (Hook decomp + Emotion arc — exact UI spec), §R1.9 (cross-group state coordination — anti-virality ripple), §NF1 (perf tiers), §NF2 (accessibility), §NF4 (telemetry instrumentation)
- `.planning/PROJECT.md` §Key Decisions — server-first, TanStack Query, Zustand, Konva for board substrate, Raycast design language

### Prior phase context (still applies — anti-virality QUIET + coral + Konva/DOM split inherited)
- `.planning/phases/01-foundation-sse-consumer-engine-signal-extensions/01-CONTEXT.md` — Phase 1 SSE consumer + `useAnalysisStream` hook shape (`partial`, `result`, `stages`, `panelReady`, `phase`)
- `.planning/phases/02-board-substrate-navigation/02-CONTEXT.md` — **MUST READ**: D-03 (frame growth on expand pattern), D-04 (Konva + DOM overlay), D-13 (command bar chip actions including "re-weight audience" — Verdict's "Post anyway" override may want similar treatment), D-18 (board state machine — anti-virality is cross-group state), D-19 (cross-group ripple coordination), D-20 (perf tiers high/medium/low), D-23 (reduced-motion fallback), D-24 (accessibility baked in)
- `.planning/phases/03-engine-rework-pass-2-timeline-weighted-aggregator-heatmap-sc/03-CONTEXT.md` — **MUST READ**: D-13 (HeatmapPayload schema — segments share with Verdict's "anchored to segments" anti-virality fixes), D-16/D-17 (anti-virality dual-trigger — `confidence < 0.4` OR `timeline_pattern`), D-17 details (`anti_virality_reason`, `dropoff_segment_indices` — feeds Verdict's top-3 fixes)
- `.planning/phases/04-live-audience-node-the-killer-feature/04-CONTEXT.md` — **MUST READ**: O-1 (Konva/DOM split refinement), D-15 (anti-virality QUIET treatment — Verdict's orange header must coordinate visually), D-16 (rework guidance anchoring — Audience surfaces "where + brief", Verdict owns "what + why" per cross-group division), D-13 (`TapPopover` pattern reused for emotion arc dots), Inspector pattern (`PersonaInspector.tsx` as template for hook decomp + emotion arc expand routes)

### Codebase intel
- `.planning/codebase/STACK.md` — Next.js 16, React 19, TanStack Query, Zustand, Konva, Recharts, Vitest
- `.planning/codebase/ARCHITECTURE.md` — route groups, data flow, prediction pipeline structure
- `.planning/codebase/STRUCTURE.md` — file-layout conventions (Verdict/Actions/Content-Analysis must follow Audience's `src/components/board/audience/` folder pattern)
- `.planning/codebase/INTEGRATIONS.md` — Supabase tables, env vars, Sentry, signed URL pattern

### Engine surfaces consumed (Phase 5 reads these — no engine schema changes in Phase 5)
- `src/lib/engine/types.ts:210` — `PredictionResult` interface — Phase 5 reads: `overall_score`, `confidence`, `confidence_label`, `is_calibrated`, `reasoning`, `warnings`, `factors`, `suggestions`, `anti_virality_gated`, `anti_virality_reason`, `dropoff_segment_indices`, `hook_decomposition`, `emotion_arc`, `counterfactuals`, `retrieval_evidence`, `retrieval_score`, `signal_availability`
- `src/lib/engine/qwen/schemas.ts:15` — `HookDecompositionZodSchema` — exact fields Hook decomp node renders (4 sub-scores + weakest_modality + visual_audio_coherence + cognitive_load with INVERTED polarity)
- `src/lib/engine/qwen/schemas.ts:56` — `EmotionArcPointSchema` — Emotion arc data shape (`timestamp_ms`, `intensity_0_1`, `label?: "low"|"mid"|"high"`)
- `src/lib/engine/types.ts:407` — `CounterfactualSuggestionItem` — top-3 fixes shape (`type: "fix"|"stretch"|"reinforcement"`, `headline ≤80 chars`, `detail`, `timestamp_ms`, `signal_anchor`)
- `src/lib/engine/types.ts:423` — `CounterfactualResult` — `band: "low"|"mid"|"high"` + `suggestions[]` (band-adaptive rendering — Phase 5 filters by `type === 'fix'` for anti-virality top-3)
- `src/lib/engine/anti-virality.ts` — `isAntiViralityGated(result)` + `isTimelinePatternTriggered(heatmap)` checks (Phase 3-shipped, Phase 5 reads `anti_virality_gated` flag directly from result — no need to recompute)

### Board substrate consumed (Phase 2-shipped, plus Phase 4 patterns to mirror)
- `src/components/board/Board.tsx:47` — **MUST REFACTOR** per D-21: extract hard-coded `frameId === 'verdict' || 'audience'` into `useAntiViralityAffectedFrames()` selector
- `src/components/board/board-constants.ts:26-31` — `GROUP_FRAMES` bounds: verdict 360×280, actions 360×200, content-analysis 1352×200 — Phase 5 nodes must fit these
- `src/components/board/GroupFrame.tsx` + `GroupFrameOverlay.tsx` — labeled rectangle pattern; Verdict / Actions / Content Analysis nodes sit INSIDE their respective group frames
- `src/components/board/Node.tsx` + `NodeOverlay.tsx` — base node pattern (Konva + DOM overlay hybrid per Phase 4 O-1); Phase 5 nodes extend this pattern with DOM overlay doing most of the work
- `src/components/board/use-camera.ts` — camera auto-pan; Verdict's anti-virality fix-timestamp tap triggers pan to Audience filmstrip
- `src/stores/board-store.ts` — anti-virality state (`boardState === 'anti-virality'` selector at `:251`); Phase 5 nodes subscribe via `useBoardStore`. NO new state for Phase 5 — extend selectors only
- `src/hooks/queries/use-analysis-stream.ts` — Phase 1 SSE hook; Phase 5 nodes subscribe to `result` (for complete-state render) and `partial.result.confidence` (for streaming skeleton transitions if needed)

### Phase 4 components to study + reuse (engineering patterns to inherit)
- `src/components/board/audience/AudienceNode.tsx` — top-level node composition pattern; Phase 5 nodes mirror folder structure (`src/components/board/verdict/`, `actions/`, `content-analysis/`)
- `src/components/board/audience/PersonaInspector.tsx` — inspector pattern (bottom sheet / right-side panel); Hook decomp + Emotion arc reuse this shape (per O-3) — or extract a base `<Inspector />` primitive per Claude's Discretion item
- `src/components/board/audience/TapPopover.tsx` — popover-at-tap-point primitive; Emotion arc peak/valley dots reuse for tap detail
- `src/components/board/audience/HeatmapDrawer.tsx` — drawer/expand affordance pattern; Verdict collapsibles mirror the trigger pattern (chevron + label + animated open)
- `src/components/board/audience/HeadlineChips.tsx` — small chip row pattern; Verdict's percentile + confidence chip combo + Hook decomp's chips inherit the GlassPill spacing + sizing
- `src/components/board/audience/AntiViralityOverlay.tsx` — Phase 4's orange treatment scaffolding; Verdict's orange header coordinates with this visual language (consistency across nodes)

### Primitives to reuse (Raycast design system)
- `src/components/primitives/GlassProgress.tsx` — Hook decomp 4-bar stack uses this directly (`size="md"`, `color="coral"`)
- `src/components/primitives/index.ts` — `GlassPill`, `GlassPanel` exports — Verdict chips + Actions placeholder cards + inspector backgrounds
- `src/components/ui/GlassPanel.tsx` — popover + inspector + collapsible body backgrounds
- `src/components/ui/card.tsx` — Actions placeholder cards + Similar videos card base
- `src/components/competitors/charts/chart-tooltip.tsx` — Recharts custom tooltip (reuse for both Verdict comparison charts + Emotion arc)
- `src/components/competitors/comparison/comparison-bar-chart.tsx` — closest existing pattern for the "vs my history" Recharts setup; study the imports + ResponsiveContainer wiring
- `src/components/trending/tiktok-embed.tsx` — modal Phase 5 reuses for similar-video tap (5.6 / D-14)
- `src/components/trending/video-card.tsx` — reference only; Phase 5 builds a separate compact variant (per O-6) rather than reusing this
- `src/lib/perf-tier.ts` — tier detection + degradation hook; Phase 5 nodes subscribe per D-28
- `src/lib/a11y.ts` — `aria-live` helpers, focus management (Phase 2-shipped) — per D-29

### New Phase 5 files (researcher/planner will refine names + boundaries)
- `src/components/board/verdict/VerdictNode.tsx` — top-level Verdict node, plugged into the Verdict group frame
- `src/components/board/verdict/PercentileChip.tsx` — big percentile + confidence pill row
- `src/components/board/verdict/AntiViralityHeader.tsx` — orange "Don't post yet" header (conditional)
- `src/components/board/verdict/WhyVerdictCollapsible.tsx` — 4-sub-section collapsible body (assembles from `reasoning` + `warnings` + `factors` + `counterfactuals`)
- `src/components/board/verdict/VsHistoryCollapsible.tsx` — two horizontal Recharts BarCharts + empty state
- `src/components/board/verdict/TopFixesList.tsx` — top-3 fixes anchored to segments (renders inside WhyVerdictCollapsible when anti-virality)
- `src/components/board/verdict/use-comparisons.ts` — TanStack Query against `/api/analyze/[id]/comparisons` (or client-side derivation per D-09)
- `src/components/board/verdict/verdict-types.ts` + `verdict-constants.ts`
- `src/components/board/actions/ActionsNode.tsx` — top-level Actions node, plugged into Actions group frame
- `src/components/board/actions/ActionsReshootHeroSlot.tsx` — Phase 5 placeholder; Phase 6 fills
- `src/components/board/actions/ActionsOptimalPostSlot.tsx` — Phase 5 placeholder; Phase 6 fills
- `src/components/board/actions/ActionsShareSlot.tsx` — Phase 5 placeholder; Phase 7 fills
- `src/components/board/actions/SimilarVideosCard.tsx` — real, this phase; renders 5 `SimilarVideoCardCompact` rows
- `src/components/board/actions/SimilarVideoCardCompact.tsx` — compact mini-tile variant (per O-6)
- `src/components/board/actions/PlaceholderCard.tsx` — dashed-border, dim, "Coming in Phase N" treatment (per D-11)
- `src/components/board/actions/actions-types.ts` + `actions-constants.ts`
- `src/components/board/content-analysis/ContentAnalysisFrame.tsx` — horizontal split layout (per O-5)
- `src/components/board/content-analysis/HookDecompNode.tsx` — 4-bar GlassProgress + chips + tap-to-inspector
- `src/components/board/content-analysis/EmotionArcNode.tsx` — Recharts area chart + peak/valley markers + tap-to-popover
- `src/components/board/content-analysis/HookDecompInspector.tsx` (or generic NodeInspector per O-3 Claude's Discretion)
- `src/components/board/content-analysis/content-analysis-types.ts` + `content-analysis-constants.ts`
- `src/components/board/cross-group-state.ts` — `useAntiViralityAffectedFrames()` selector + `getFrameAntiViralityState(frameId)` resolver (per D-21 refactor)
- `src/app/api/analyze/[id]/comparisons/route.ts` — comparison data endpoint (if D-09 decision = "ship server endpoint")
- `src/components/board/verdict/__tests__/` + `actions/__tests__/` + `content-analysis/__tests__/` — Vitest coverage for sub-section assembly, placeholder rendering, similar-videos card rendering, Hook decomp value mapping, Emotion arc rendering, cross-group ripple

### Brand + design
- `BRAND-BIBLE.md` — Raycast design language; coral #FF7F50 only accent
- `CLAUDE.md` §Raycast Design Language Rules — verified token values (surface=#18191a, muted=#848586, accent-foreground=#1a0f0a); cards `bg-transparent`, modals solid opaque, inputs 8px radius, no glow effects, coral only for accents, GlassPanel zero-config (4 props)

### External docs (researcher confirms latest)
- Recharts docs (https://recharts.org/) — `AreaChart`, `BarChart`, `ResponsiveContainer`, `ReferenceDot`, `<linearGradient>` in `<defs>`, `isAnimationActive` prop for reduced-motion respect
- React-Konva docs (https://konvajs.org/docs/react/) — same as Phase 4; node frame uses Konva, body uses DOM overlay
- `react-markdown` docs (https://github.com/remarkjs/react-markdown) — IF used for reasoning narrative rendering, pair with `rehype-sanitize` for safety
- WCAG 2.1 — collapsible disclosure pattern (R1.3 collapsibles), color contrast on coral-on-dark + orange anti-virality treatment

### Visual references (carried from earlier milestones)
- Raycast extension landing pages — for Verdict's big-number percentile + chip styling
- TikTok Studio retention insight panel — for "vs my history" comparison feel (familiar mental model)
- Linear / Notion / Krea AI Nodes — for the dashed-border placeholder card treatment (per D-11)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 4 `useAnalysisStream` hook** — Verdict subscribes for `result.overall_score`, `result.anti_virality_gated`, `result.warnings`, `result.factors`, `result.reasoning`, `result.counterfactuals`. Hook decomp reads `result.hook_decomposition`. Emotion arc reads `result.emotion_arc`. Similar videos reads `result.retrieval_evidence`.
- **Phase 4 board substrate** — Verdict, Actions, Content-Analysis group frames already rendered by Phase 2; Phase 5 plugs node bodies into the existing frames.
- **Phase 4 `Node.tsx` / `NodeOverlay.tsx`** — base node pattern; Phase 5 nodes follow Audience's pattern: minimal Konva (frame only), DOM overlay does the work.
- **Phase 4 `perf-tier.ts` + `usePrefersReducedMotion`** — Phase 5 nodes subscribe identically.
- **Phase 4 anti-virality store state** (`board-store.ts:251`) — already wired; Phase 5 extends consumers (Verdict, Actions) without new store state.
- **Phase 4 `PersonaInspector`** — pattern reused for Hook decomp / Emotion arc inspector routes (or extract base primitive per O-3 Discretion).
- **Phase 4 `TapPopover`** — emotion-arc dot tap-popover reuses; if API needs generalization, lift to `src/components/ui/`.
- **Phase 4 `AntiViralityOverlay`** — Audience's orange treatment scaffolding; Verdict's header treatment + Actions' grown hero state coordinate visually with this.
- **Phase 2 `GroupFrame` / `GroupFrameOverlay`** — Verdict/Actions/Content-Analysis group frames already laid out (per `board-constants.ts:26-31`).
- **GlassPanel** primitive — popover + inspector + collapsible body backgrounds (Raycast container).
- **GlassProgress** primitive — Hook decomp 4-bar stack uses directly.
- **GlassPill** primitive — Verdict chips + Hook decomp chips.
- **Recharts** (already in stack, used by `src/components/competitors/comparison/comparison-bar-chart.tsx`) — Verdict comparison charts + Emotion arc area chart.
- **Existing `tiktok-embed` modal** (`src/components/trending/tiktok-embed.tsx`) — Similar videos tap reuses, no new modal infra.
- **TanStack Query** — comparison endpoint + retrieval evidence queries.
- **Zustand `board-store`** — extend selectors for cross-group anti-virality state (D-21); no new state for Phase 5.

### Established Patterns
- **Client-only Konva + DOM overlay hybrid** (Phase 2 → Phase 4 refinement) — Verdict/Actions/Content-Analysis lean DOM-heavy; Konva only for outer frame positioning.
- **Collapsible/expand → inspector route** (Phase 4 pattern) — Hook decomp + Emotion arc tap → inspector; Verdict's collapsibles open in-place (different pattern — collapsibles aren't deep enough to warrant inspector route).
- **Frame growth on expand** (Phase 2 D-03) — Verdict frame grows vertically when collapsibles open; Actions frame grows when anti-virality promotes reshoot hero.
- **`aria-live` regions for state announcements** (Phase 2 D-24) — Phase 5 nodes announce per D-29.
- **`prefers-reduced-motion` respect** (Phase 2 D-23 / Phase 4) — collapsibles use simple height transitions, Recharts gets `isAnimationActive={false}`.
- **Graceful degradation** — when hook_decomposition / emotion_arc is null, render empty-state with caption (per D-17 / D-19) — don't hide the node.
- **Structured logger instrumentation** — per D-31; consistent event naming with Phase 4 (`{node}_rendered`, `{action}_tapped`, `{state}_applied`).
- **Markdown rendering** — if `react-markdown` already in deps, use; otherwise researcher decides install vs. plain-text rendering for `result.reasoning`.

### Integration Points
- **Inside the existing Verdict/Actions/Content-Analysis group container frames** (Phase 2 / Phase 4-shipped frame structure) — node bodies fill these frames; frame title bar + chevron stays Phase 2-owned.
- **`use-analysis-stream.ts`** — Phase 5 nodes subscribe; no hook signature change needed.
- **`board-store` `boardState` + `useAntiViralityAffectedFrames()` selector** (D-21) — Verdict, Actions, Audience (Phase 4) subscribe.
- **`use-camera.ts`** — Verdict's anti-virality fix-timestamp tap triggers camera pan to Audience node + filmstrip frame highlight.
- **`tiktok-embed` modal** — Similar videos tap.
- **DB: `analyses` table** (existing) — comparison endpoint pulls `user_id ORDER BY created_at DESC LIMIT 10`.
- **DB: niche aggregates** — researcher confirms whether a materialized view exists (Phase 1's `niche_post_windows` is the precedent for niche-level aggregates) or if a runtime query is acceptable for the comparison endpoint.
- **NO new tables, NO new migrations in Phase 5** — pure UI + one possible read-only endpoint.

### Frame bounds (verified from `board-constants.ts`)
- **Verdict**: x=992, y=0, w=360, h=280 — node body fits in ~344×264 after frame title/padding. Collapsibles grow frame vertically.
- **Actions**: x=992, y=376, w=360, h=200 — base 2×2 card grid in ~344×184. Frame grows to ~344×344 when anti-virality promotes reshoot hero.
- **Content-Analysis**: x=0, y=672, w=1352, h=200 — horizontal split: Hook decomp (~480px) + Emotion arc (~872px) side-by-side in ~1336×184 inner bounds.

### Konva integration notes (carried from Phase 4)
- Verdict/Actions/Content-Analysis frame borders + labels = Konva (consistent with Phase 4)
- All node body content = DOM overlay (per O-1)
- Tap events on DOM elements handled natively; cross-group state changes propagate via `useBoardStore` subscriptions (no Konva event plumbing)
- DPR-aware rendering not relevant here (no per-frame canvas; Recharts handles SVG scaling)

</code_context>

<specifics>
## Specific Ideas

- **Verdict is the conclusion, Audience is the evidence.** Cross-group division (Phase 4 D-16): Audience surfaces "where + brief", Verdict owns "what + why". Reasoning narrative belongs in Verdict; per-segment fix chips also live in Audience but the FULL top-3 fix list with detail copy lives in Verdict.
- **"Don't post yet" is constructive, not punitive** (R1.3 + Phase 4 D-15). Orange (not red). Copy: "Fixable in {N} steps", not "FAILED" or "REJECTED". Override link is small, not aggressive.
- **Placeholder cards = dashed border + dim** (D-11). Set expectations forward, don't disappoint backward. Future-of-board promise pattern — feels like a project board with cards waiting for content, not a broken UI.
- **Coral #FF7F50 is the only accent**. Verdict's hero percentile is coral when high. Anti-virality orange band uses coral-to-orange gradient. Hook decomp weakest-modality highlight is coral-tinted. Emotion arc fills with coral gradient. Comparison charts: current bar coral, baselines white/muted.
- **No red/green** — performance gradients use coral-intensity-on-dark per Phase 4 / R1.2.
- **Content Analysis is the LEAST surprising node** — Hook decomp + Emotion arc are straightforward visualizations of engine-emitted data. Tap-to-inspector for depth, but the surface render should be calm and readable at a glance.
- **Performance test device = iPhone 11** (carried from Phase 4) — Recharts emotion-arc rendering must hit ≥45fps on iPhone 11. Comparison charts in Verdict are static post-render, less concerning.
- **Cost not a concern for any new infra** (carried from MILESTONE.md) — Phase 5 is mostly client-side; the comparison endpoint (if shipped) is cheap.
- **Engine schema is LOCKED** — Phase 5 makes ZERO engine changes. If client-side reasoning assembly proves fragile, propose engine extension as separate phase, not as Phase 5 scope creep.
- **Markdown rendering safety** — if `react-markdown` is used, REQUIRE `rehype-sanitize` to prevent XSS from any DeepSeek-emitted content. Engine output is trusted-ish, but defense-in-depth.
- **Similar videos card is a real-data smoke test for `retrieval_evidence`** — first time UI consumes this field in a node body. Surface empty state + non-empty state cleanly so future M2 milestones can rely on the contract.
- **Cross-group state abstraction is a forward investment** — D-21's `cross-group-state.ts` resolver looks like over-engineering for one signal (anti-virality), but R1.9 explicitly demands the pattern extends to future signals. Ship the resolver now to avoid a Phase 8 refactor.
- **bypassPermissions on workers, default on auditors** per agent-teams protocol (carried from Phase 4).

</specifics>

<deferred>
## Deferred Ideas

- **Engine-side `reasoning_sections` field** (`{ works, might_not, flagged, counterfactual }`) — proposed if client-side assembly fails QA. Phase 5 ships client-side; defer to v1.1 engine extension.
- **Live-jump citations** — `[seg 4]` inline citations in reasoning narrative as static text only in Phase 5. Live-jump behavior (tap citation → pan camera + highlight Audience filmstrip) deferred to M2-II onboarding milestone.
- **Reshoot script content** — Phase 6.
- **Optimal post time content** — Phase 6.
- **Share & export content** — Phase 7.
- **Per-creator vs niche cohort percentile derivation** — Phase 5 ships with whatever `overall_score` already represents. True percentile-vs-corpus calculation deferred if researcher determines it's not already locked.
- **Comparison chart history depth > 10** — R1.3 spec says last-10; deferred extending to last-30 / all-time per workspace milestone.
- **"vs niche cohort" pgvector-based niche identification** — Phase 5 uses creator's declared niche; deferred ML-based niche inference to M2-III.
- **Free-form "Why did X factor score low?" co-pilot** — Phase 5 tap-to-inspector is the structured interaction baseline; conversational layer deferred to M2-II/III (carried from Phase 4 deferred list).
- **Anti-virality override with rationale text input** — Phase 5 ships override as one-tap "Post anyway" event. Optional text field for "Why are you overriding?" deferred to M2-III (outcome feedback loop).
- **Recharts swap to canvas for emotion arc** — Phase 5 uses Recharts; perf-tier audit may drive a canvas swap if Low-tier perf insufficient (per D-20).
- **Inspector primitive extraction** — Phase 5 may ship per-node inspectors (HookDecompInspector, EmotionArcInspector) or extract a base `<Inspector />` primitive depending on Claude's Discretion outcome.
- **Hook decomp drill-down to individual modality fixes** — Phase 5 tap-to-inspector shows weakest-modality fix copy. Drill-down to specific tactical fixes per modality (e.g., "to fix text overlay: use larger font, sans-serif, top-third placement") deferred to Phase 6 reshoot script (Phase 6 owns the actionable-fix surface).
- **Emotion arc audio waveform underlay** — would be cinematic, mirrors Tribe v2 reference; deferred (same reasoning as Phase 4 deferred filmstrip waveform).
- **Verdict "Save analysis" + "Pin to dashboard"** — workspace milestone owns analysis lifecycle UX beyond per-analysis viewing.
- **Comparison charts as interactive scrub** (tap a history bar → board re-renders for that prior analysis) — deferred to workspace milestone.

</deferred>

---

*Phase: 5-Other-group-nodes-Verdict-Actions-Content-Analysis-populated*
*Context gathered: 2026-05-27*
