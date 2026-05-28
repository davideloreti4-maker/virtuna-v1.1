# Phase 4: Live Audience node — the killer feature - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the **Audience node** — the visual hinge of the Result Surface milestone and the centerpiece of `/analyze`. The Audience node lives inside the Audience group container frame (shipped in Phase 2) and consumes the heatmap schema + weighted curve + filmstrip URIs (shipped in Phase 3). It is a *single composed visualization* — headline metrics chips + keyframe filmstrip + retention curve with dropoff markers + collapsible heatmap drawer + per-persona expand path — that materializes via live streaming choreography as Pass 2 personas complete, transforms visually under anti-virality state, and supports interactive weight overrides that recompute the aggregate client-side.

This phase delivers the **full Audience node body and its interactions**, including:
- The compositional layout (stacking + sizing inside the existing Audience group frame)
- Streaming choreography (skeletons → row reveal → curve morph) wired against Phase 3 partial event streams
- Interactive tap surfaces (cell / row / marker / curve) at multiple depths (popover → bottom sheet/inspector)
- Anti-virality visual treatment (timeline-pattern + confidence triggers both surface here)
- Audience weighting transparency badge + override drawer with client-side recompute
- Mobile portrait adaptation (no rotation, no fullscreen — same composition, viewport-adapted heatmap)
- Reduced-motion + perf-tier respect (instant materialization in reduced-motion; degraded animation on low tier)

**Out of scope (other phases):**
- Verdict / Actions / Content Analysis node bodies (Phase 5)
- Reshoot script + optimal post time UIs (Phase 6)
- Share & export (Phase 7)
- Mobile polish pass + onboarding overlays + regression audit (Phase 8)
- Engine changes — schemas are locked from Phase 3 (no new fields, no new events)
- Persona weight server-side persistence at creator/niche scope beyond the per-analysis + "save as default" toggle pattern (workspace milestone owns full creator + niche override management)
- Heatmap layer toggle (Attention / Emotion / Engagement / Skip-probability) — single attention layer only

</domain>

<decisions>
## Implementation Decisions

### Architectural optimizations (accepted across the board, override carried-forward defaults where noted)

- **O-1:** **Inside the Audience node, Konva stages only the bounding frame.** Curve = dedicated `<canvas ref>` (RAF loop, devicePixelRatio control, easy bezier + animation). Heatmap = CSS Grid in DOM overlay (color-blind toggle = CSS variable swap, native a11y, alt-text per cell, text-selection works). Filmstrip = standard `<img>` row in DOM overlay. Konva does spatial positioning + frame border only. This overrides the naive reading of Phase 2 D-04 "Konva for spatial layer" — the spatial layer ends at the Audience node's outer frame; everything inside is DOM-native. Researcher must confirm this composes correctly with the existing Phase 2 `Node.tsx` / `NodeOverlay.tsx` pattern.
- **O-2:** **Per-cell fill-during-stream, not row-on-complete.** Row skeleton renders on `pass2_persona_start`. Cells fade-fill as each `partial.personas[i].attentions[j]` value arrives. Full saturation on `pass2_persona_end`. Maximizes the "watch AI think" magic-moment framing without new pipeline cost — values already streaming per Phase 3 D-15.
- **O-3:** **Curve update strategy = baseline → single morph.** On `complete` SSE event, render Pass 1 flat baseline curve (use `persona_behavioral_aggregate.completion_pct` from Phase 1 — already available). When Pass 2 aggregate ≥7-of-10 lands (`weighted_curve` populated), animate a single 800ms morph from baseline to weighted curve. Do NOT update curve per persona — would jitter 10 times.
- **O-4:** **Filmstrip async pop-in placeholder = coral-tinted segment band + omni `visual_event` label text.** `heatmap.segments[].label` already exists (Phase 3 D-13). Render labels in coral-tinted bands as placeholder; swap to `<img>` when `filmstrip_segment_ready` event delivers `keyframe_uri`. No new pipeline work.
- **O-5:** **Weight override = client-side recompute, no engine roundtrip.** `heatmap.personas[i].attentions[]` + `weights` are client-side. `weighted_curve[j] = Σ (weights[persona_type] × personas[i].attentions[j])` is pure math. Recompute weighted_curve + weighted_completion_pct + weighted_top_dropoff_t + weighted_hook_score locally on slider change. Engine roundtrip only when user pins the override (writes `analysis_override` column). Researcher must lock the exact normalization formula (almost certainly identical to `weighted-aggregator.ts` server logic — ship as a shared `lib/engine/persona-weights.ts` export usable from client).
- **O-6:** **Mobile portrait heatmap = collapsed coral-intensity aggregate band by default + full grid in bottom sheet on tap.** Portrait default shows chips + filmstrip + curve + markers + the heatmap *drawer affordance* — drawer opens to bottom sheet (NOT inline expansion) on mobile to preserve scroll context. Desktop drawer opens inline. World coordinates stay identical phone/desktop (spatial consistency per Phase 2 D-10); only the heatmap rendering adapts to viewport.

### Audience node composition

- **D-01:** **Desktop vertical stacking order = Chips → Filmstrip → Curve+markers → Heatmap drawer.** Headline metrics chip row at top. Filmstrip directly below chips, acts as the visual top-axis anchor (per Tribe v2 IA reference in milestone). Curve renders directly below filmstrip, segment-aligned with the keyframes above. Dropoff markers (coral dots) sit on the curve. Heatmap drawer is collapsed by default beneath the curve with a "Show personas ▾" affordance.
- **D-02:** **Headline chips row content** (per R1.2): Avg watch %, Loop %, Top dropoff timestamp, Replayable-hook score (0-3s window), vs Niche baseline diff badge. All read from `weighted_*` fields when available; fall back to `persona_behavioral_aggregate.*` if Pass 2 below 7-of-10 (per Phase 3 D-06).
- **D-03:** **Heatmap default state = closed drawer, "Show personas ▾" affordance.** Tap affordance → grid expands inline (Audience node grows vertically) on desktop. On mobile portrait, same affordance opens grid in a bottom sheet (per O-6). The "underlay" wording in R1.2 is interpreted as a drawer pattern (literal opacity-underlay rejected — readability cost too high).
- **D-04:** **Mobile portrait composition** — same world coordinates as desktop (per Phase 2 D-10 spatial consistency). Render adaptations only: heatmap drawer opens bottom-sheet instead of inline; per-persona inline expand (plan 4.9) becomes a bottom-sheet operation; tap popovers reposition to avoid edge clipping.

### Streaming choreography

- **D-05:** **Persona row reveal order = fixed archetype hierarchy, ignoring completion order.** Skeleton rows pre-render at t=0 (when `wave_0_complete` fires and segments are known) in this order: FYP non-followers (6 rows) → niche-aligned (2 rows) → loyalist (1 row) → cross-niche (1 row). Each row stays in its archetype slot regardless of which persona's Pass 2 finishes first. Predictable visual rhythm + supports muscle memory for repeat users + presentation-friendly determinism.
- **D-06:** **Cell fill animation = left-to-right wave, 180ms total per row.** When a persona's `attentions[]` is fully populated (or as values stream, per O-2), cells fade-fill in segment order from t=0 to t=end with ~18ms per cell stagger on a 10-segment video (scales per segment count, total ≤180ms). Marker drops on the curve at `swipe_predicted_at` synchronously with the last cell fill in that row. Reads as "the persona watched through the video."
- **D-07:** **Curve morph timing** (per O-3): Pass 1 baseline appears immediately on `complete` (single-step animation from current state to flat baseline). Single 800ms morph from baseline to weighted curve when aggregate is ready (`weighted_curve` non-null). All dropoff markers fade in during the morph window so they "land" on the weighted curve, not the baseline.

### Retention curve rendering

- **D-08:** **Curve style** = coral (#FF7F50) bezier line, 2px stroke, soft gradient fill underneath (coral/15 → transparent), catmull-rom α=0.5 smoothing for natural-but-not-loose interpolation. Hook zone 0-3s tinted with warm band (coral/8) behind the curve. Reads as TikTok-Studio-familiar (per R1.2).
- **D-09:** **Axis labels** — % on left axis (0/25/50/75/100 gridlines, subtle). Timestamps anchored to filmstrip frames above; no duplicate timestamp axis below curve. Avoids visual clutter; filmstrip IS the x-axis.
- **D-10:** **Curve renders in dedicated `<canvas>` in DOM overlay** (per O-1), NOT in Konva. RAF loop drives the morph + dropoff-marker fade. Researcher decides between hand-rolled Bezier vs `d3-shape` (no other d3 use in codebase — bias toward hand-rolled if simple enough).

### Dropoff markers + tap interactions

- **D-11:** **Marker design = coral dots with archetype-tier ring.** 8px solid coral fill, ring color encodes archetype: FYP = warm coral ring, niche = coral-300, loyalist = coral-100, cross-niche = white/30. No avatars, no initials inside the marker (initials cost mobile readability + avatar fetching cost). Persona ID shown in tap popover.
- **D-12:** **Marker overlap clustering** — when ≥3 markers within 12px (or ≥2 within 6px), collapse to a single coral dot with a small superscript counter (e.g., "³"). Tap cluster → popover lists all collapsed personas with mini-rows.
- **D-13:** **Tap interaction model = popover for glance, bottom sheet (mobile) / right-side inspector (desktop) for deep read.**
  - **Tap heatmap cell** = popover at tap point with: persona avatar + archetype tag, segment timestamp, attention %, 1-line `segment_reasons[idx]` if present (inflection points only). "See full →" link routes to inspector.
  - **Tap dropoff marker on curve** = popover identical content but for `swipe_predicted_at` segment.
  - **Tap row label in heatmap** = inspector opens directly with full Pass 2 reasoning + all `segment_reasons` + Pass 1 verdict + swipe_predicted_at context.
  - **Tap curve point (not on marker)** = aggregate metric overlay popover (weighted attention at t, contributing personas) + filmstrip frame highlight synchronization (the keyframe at that segment glows briefly). No bottom sheet route from curve-point tap.
- **D-14:** **Per-persona inline row expand (plan 4.9) — Claude's Discretion**. Researcher decides whether 4.9 stays as a separate "row expands in-place to full width with inline detail" interaction or is replaced entirely by the inspector route from D-13 (tap row label → inspector). Recommendation: collapse 4.9 into the inspector pattern if user testing shows inline expand isn't pulling weight; otherwise ship as a lighter contextual view (compact reasoning + jump-to-inspector affordance).

### Anti-virality visual treatment

- **D-15:** **Audience node treatment = QUIET.** Curve gradient fill transitions coral → orange ONLY within the timeline-pattern dropoff range (typically 5-10% of x-axis). Affected segments (per Phase 3 D-17 dropoff detection) get a small ⚠ tag below the filmstrip in those segments only. Heatmap cells STAY coral (no orange tint inside heatmap — preserves the coral-intensity system from R1.2 + avoids reading like red/green). Row labels stay unchanged. Reads as "look here" not "panic."
- **D-16:** **Rework guidance anchoring = inline annotation chips below filmstrip + full top-3 list in Verdict node.** Each affected segment gets a small fix-summary chip below the filmstrip ("seg 4: add visual hook"). Tap chip → popover with full fix text + counterfactual reference. The full top-3 fix list lives in the Verdict node (per R1.3 / Phase 5). Audience surfaces "where + brief"; Verdict owns "what + why." Cross-group ripple (per Phase 2 D-19) is honored via this division.
- **D-17:** **Triggers honored** — both the existing confidence-gate (`confidence < 0.4` per Phase 3 D-16) AND the new timeline-pattern trigger (per Phase 3 D-17) drive the Audience visual treatment. If only the confidence-gate fires (no timeline pattern), the curve still gets a subtle border/header treatment but no per-segment orange band (since no segment is implicated). Researcher confirms exact visual variant for each trigger combination.

### Weight override UX (plan 4.11)

- **D-18:** **Override UI form = preset chips + "Custom" opens slider panel.** Default presets (researcher confirms exact mix values; below is starting point):
  - **Default mix** — 65 / 20 / 10 / 5 (FYP / niche / loyalist / cross-niche) — locked from Phase 3 D-12 default
  - **Established creator** — 40 / 20 / 30 / 10 (heavier loyalist; useful when creator has audience-deep niche)
  - **Niche-heavy** — 30 / 55 / 10 / 5 (B2B / educational / instrument-makers / specialized creators)
  - **New creator** — 75 / 15 / 5 / 5 (cold start emphasis, viral-acquisition bias)
  - **Custom…** — drawer with 4 sliders + auto-renormalize to sum = 1.0 on each drag (proportional rebalancing of the other three sliders)
- **D-19:** **Surface placement = the Audience-weighting transparency badge IS the affordance.** R1.2 spec calls for a transparency badge displaying current weights (e.g., "Weighted: 65/20/10/5"). The same badge becomes the tap target — tap badge → drawer slides up from bottom (mobile) / right-anchored panel (desktop). Command-bar chip-action "re-weight audience" (per Phase 2 D-13) routes to the same drawer (single mental model, two entry points).
- **D-20:** **Recompute = client-side immediate** (per O-5). Slider drag triggers debounced (16ms RAF) recompute of `weighted_curve` + headline metrics. Curve morphs continuously as user drags (similar perceptual feedback as a video scrub). All headline chips update in real time. Anti-virality re-evaluation (timeline-pattern trigger) recomputes too — orange band may appear/disappear during drag. Behavior is intentional ("see your audience choice change the verdict") and informs creators about weight sensitivity.
- **D-21:** **Persistence = per-analysis sticky + "Save as my default" opt-in toggle.** Default behavior: override applies to current analysis only, persisted via the `analysis_override` precedence (Phase 3 D-20 schema). Drawer footer shows "☐ Save as my default for future analyses" checkbox — if checked, override propagates to `creator_overrides[user_id]` (Phase 3 D-20 schema) and applies to all future analyses where no per-analysis override exists. Reset link in drawer footer always restores defaults. No auto-save without explicit opt-in (no surprises).
- **D-22:** **DB writes** — per-analysis override writes to the existing analyses row when "Apply" is tapped (or autosaves on drawer close if researcher decides). "Save as default" writes a row to a new `creator_persona_weights` table (researcher locks the exact schema during planning — keep small: `user_id PK`, `fyp`, `niche`, `loyalist`, `cross_niche`, `updated_at`).

### Claude's Discretion

- **Konva ↔ DOM overlay composition specifics** — exact ref pattern for the canvas-in-DOM-overlay-on-Konva-Stage layout. Researcher locks during planning. Bias toward existing Phase 2 `NodeOverlay.tsx` pattern.
- **Bezier interpolation library choice** (D-10) — hand-rolled catmull-rom vs `d3-shape` import. No other d3 in codebase → bias hand-rolled unless complexity warrants.
- **Cluster-collapse exact pixel thresholds** (D-12) — starting point: ≥3 within 12px or ≥2 within 6px. Researcher tweaks empirically against real curves.
- **Per-persona row inline expand fate** (D-14) — keep as lighter contextual view OR fold into inspector. Researcher decides during planning based on what inspector pattern can absorb without overloading.
- **Exact "Established / Niche-heavy / New creator" preset values** (D-18) — starting points above; researcher sweeps against outcomes corpus expectations and Virtuna's known creator segments to validate.
- **Auto-renormalize algorithm** (D-18) — proportional vs absolute-locked-on-drag (e.g., when FYP slider moves +5%, do the other three shrink proportionally OR is there a "locked" pinning gesture?). Bias proportional; ship locked-pin only if user testing demands.
- **Color-blind pattern variant for heatmap** (per Phase 2 D-24, R1.2 NF2) — CSS class-swap is the optimization (O-1) — exact pattern (diagonal stripes vs cross-hatch vs dot density) is researcher's choice. Test against deuteranopia + protanopia simulators.
- **Reduced-motion behavior for streaming choreography** — when `prefers-reduced-motion` set, skeletons + cells render but no L→R wave, no curve morph (jump-cut to final). Marker fade-in still present (no motion, just opacity transition — gentler).
- **Perf-tier degradation specifics** for Audience node — researcher decides which animations get cut on Medium / Low tier (recommendation: Low = skip morph, Medium = halve cell-fill wave duration to 90ms).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone + roadmap
- `.planning/MILESTONE.md` — Result Surface milestone scope + board-model amendment (2026-05-25) + magic-moment framing
- `.planning/ROADMAP.md` §Phase 4 — phase goal, plans 4.1-4.12, success criteria, dependencies (Phase 2 board substrate + Phase 3 engine data)
- `.planning/REQUIREMENTS.md` §R1.2 (Audience node centerpiece — full content + interaction spec), §R1.9 (cross-group state coordination — anti-virality ripple), §R2 (Audience Engine — data contract), §R3.1 (mobile board — spatial consistency), §NF1 (perf tiers), §NF2 (accessibility — heatmap pattern variants)
- `.planning/PROJECT.md` §Key Decisions — locked architecture conventions (server-first, TanStack Query, Zustand, Konva for board substrate, Raycast design language)

### Prior phase context (still applies)
- `.planning/phases/01-foundation-sse-consumer-engine-signal-extensions/01-CONTEXT.md` — Phase 1 SSE consumer + hook contract; `useAnalysisStream` shape (`partial`, `result`, `stages`, `panelReady`, `phase`) consumed by Audience node
- `.planning/phases/02-board-substrate-navigation/02-CONTEXT.md` — Phase 2 board substrate; D-04 (Konva + DOM overlay, see O-1 refinement above), D-10 (spatial consistency phone/desktop), D-18 (board state machine, anti-virality is cross-group state), D-19 (cross-group ripple coordination), D-20 (perf tiers high/medium/low), D-23 (reduced-motion fallback), D-24 (accessibility baked in)
- `.planning/phases/03-engine-rework-pass-2-timeline-weighted-aggregator-heatmap-sc/03-CONTEXT.md` — Phase 3 schema lock; **MUST READ**: D-12 (canonical weighted_* fields), D-13 (`HeatmapPayload` exact schema — segments[], personas[].attentions[], swipe_predicted_at, segment_reasons, weights, weighted_curve), D-14 (headline metrics source policy — which fields come from Pass 2 vs Pass 1), D-15 (`partial.personas[].attentions[]` streaming shape for choreography), D-16/D-17 (anti-virality dual-trigger), D-20 (PersonaWeightConfig precedence chain — analysis > creator > niche > default)

### Codebase intel
- `.planning/codebase/STACK.md` — Next.js 16, React 19, TanStack Query, Zustand, Konva (`react-konva` + `konva`), Recharts, Vitest
- `.planning/codebase/ARCHITECTURE.md` — route groups, data flow, prediction pipeline structure
- `.planning/codebase/STRUCTURE.md` — file-layout conventions
- `.planning/codebase/INTEGRATIONS.md` — Supabase tables, env vars, Sentry, signed URL pattern

### Engine surfaces consumed (Phase 3-shipped contract — Audience node reads these)
- `src/lib/engine/types.ts` — `PredictionResult` schema with Phase 3 additions (`heatmap`, `weighted_completion_pct`, `weighted_top_dropoff_t`, `weighted_hook_score`)
- `src/lib/engine/wave3/weighted-aggregator.ts` — Phase 3-shipped; client-side weight recompute MUST mirror this logic exactly (O-5). Researcher confirms whether it can be imported directly client-side or needs a portable helper extracted.
- `src/lib/engine/persona-weights.ts` — Phase 3-shipped; PersonaWeightConfig precedence resolver. Reused for client-side override application.
- `src/lib/engine/anti-virality.ts` — Phase 3-shipped; both `confidence < 0.4` gate AND `isTimelinePatternTriggered(heatmap)` checks. Client may need a pure-function version for instant re-evaluation during slider drag (O-5 / D-20).
- `src/lib/engine/events.ts` — `pass2_persona_start`, `pass2_persona_end`, `filmstrip_segment_ready` event variants drive choreography

### Board substrate consumed (Phase 2-shipped)
- `src/components/board/Board.tsx` — top-level board client component; Phase 4 plugs the Audience node into the Audience group container frame already rendered here
- `src/components/board/GroupFrame.tsx` + `GroupFrameOverlay.tsx` — labeled rectangle pattern; Audience node sits INSIDE the Audience frame
- `src/components/board/Node.tsx` + `NodeOverlay.tsx` — base node pattern (Konva + DOM overlay hybrid); Audience node extends this pattern but DOM overlay does most of the work (per O-1)
- `src/components/board/BoardStateMachine.ts` (or wherever state is) — anti-virality state, streaming state; Audience node subscribes
- `src/components/board/use-camera.ts` — camera auto-pan on `complete` to Audience+Verdict hero (per Phase 2 D-09)
- `src/hooks/queries/use-analysis-stream.ts` — Phase 1 SSE hook; Audience node consumes `partial.personas[i]` for choreography, `result.heatmap` for full render

### New Phase 4 files (researcher/planner will refine)
- `src/components/board/audience/AudienceNode.tsx` — top-level Audience node component, plugged into the Audience group frame
- `src/components/board/audience/HeadlineChips.tsx` — 5-metric chip row + transparency badge
- `src/components/board/audience/Filmstrip.tsx` — keyframe + placeholder band component
- `src/components/board/audience/RetentionCurve.tsx` — dedicated `<canvas>` curve + dropoff markers + RAF morph driver
- `src/components/board/audience/HeatmapDrawer.tsx` — CSS Grid heatmap + drawer affordance + bottom-sheet variant for mobile
- `src/components/board/audience/PersonaRow.tsx` — single row with skeleton + L→R cell fill animation
- `src/components/board/audience/TapPopover.tsx` — popover at tap point (cell / marker / curve-point)
- `src/components/board/audience/PersonaInspector.tsx` — bottom sheet / right-side inspector for deep persona view
- `src/components/board/audience/WeightOverrideDrawer.tsx` — preset chips + custom slider panel + persistence toggle
- `src/components/board/audience/AntiViralityOverlay.tsx` — orange band + ⚠ tags + inline fix chips (conditional render)
- `src/components/board/audience/use-audience-choreography.ts` — orchestrates pass2_persona_start / fill / curve morph timing
- `src/components/board/audience/use-client-weights.ts` — client-side recompute (mirrors `weighted-aggregator.ts`), debounced RAF
- `src/components/board/audience/audience-constants.ts` — animation durations, marker pixel thresholds, preset weight mixes
- `src/components/board/audience/audience-types.ts` — local TypeScript interfaces
- `src/components/board/audience/__tests__/` — Vitest coverage (choreography, client-side recompute, popover positioning, cluster collapse)
- `supabase/migrations/<ts>_creator_persona_weights.sql` — Phase 4 may ship the creator override table per D-22 (researcher decides if it's a Phase 4 or future-milestone change — pragmatic to ship now since UI is here)

### Components to study (engineering patterns to inherit)
- `src/components/board/Board.tsx` + `BoardCanvas.tsx` (Phase 2-shipped) — overall composition pattern
- `src/components/competitors/charts/posting-heatmap.tsx` — existing heatmap; study color/intensity scale pattern; do NOT reuse (different domain — posting time vs attention)
- `src/components/ui/GlassPanel.tsx` — Raycast container for popover + inspector + override drawer backgrounds
- `src/components/hive-demo/hive-demo-canvas.tsx` — RAF + canvas pattern reference; tier-hive proper is deleted but the demo holds the patterns
- `src/lib/perf-tier.ts` (Phase 2-shipped) — tier detection + degradation hook; Audience node subscribes to current tier
- `src/lib/a11y.ts` (Phase 2-shipped) — `aria-live` helpers, focus management

### Brand + design
- `BRAND-BIBLE.md` — Raycast design language; coral #FF7F50 only accent across heatmap + curve + dropoff markers; GlassPanel + 6% borders + 12px radius for popovers + inspector + drawers
- `CLAUDE.md` §Raycast Design Language Rules — verified token values; cards `bg-transparent`, modals solid opaque, inputs `bg: rgba(255,255,255,0.05)`, no glow effects, coral only for accents

### External docs (researcher confirms latest)
- React-Konva docs (https://konvajs.org/docs/react/) — Stage / Layer / Group; `Stage` SSR compatibility; pointer event bubbling between Konva + DOM
- Konva.js performance guide (https://konvajs.org/docs/performance/All_Performance_Tips.html) — frame-rate optimization for per-frame redraws
- MDN Canvas docs (https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) — DPR-aware rendering, `requestAnimationFrame`, path strokes for the curve
- WCAG 2.1 — heatmap pattern variant guidance (NF2 / Phase 2 D-24); color-only encoding fails for color-blind users — alternative encoding required

### Visual references (carried from earlier milestones)
- TikTok Studio retention curve UI — primary mental model for the curve+marker pattern per R1.2 "TikTok-Studio-familiar style"
- Meta Tribe v2 (`~/Downloads/Meta-Tribe-V2-2_1.jpeg`) — filmstrip-as-top-axis + persona-row layout reference
- Krea AI Nodes (`~/Downloads/Krea AI Nodes.webp`) — board-level interaction pattern (carried from Phase 2)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 1 `useAnalysisStream` hook** — Audience node subscribes directly. `partial.personas[i]` for choreography; `result.heatmap` for full render; `phase` for state machine
- **Phase 2 board substrate** — Audience group container frame already rendered; Audience node plugs into it. Camera auto-pan to Audience+Verdict on `complete` already wired
- **Phase 2 `Node.tsx` / `NodeOverlay.tsx`** — base node pattern; Audience node uses overlay extensively (per O-1)
- **Phase 2 `perf-tier.ts`** — current tier + subscribe API; Audience node uses to gate animation richness
- **Phase 2 `usePrefersReducedMotion` hook** (or equivalent) — Audience node gates RAF loops + cell-fill wave on this signal
- **Phase 3 `weighted-aggregator.ts`** — server-side weighting math; client-side recompute (O-5) mirrors this or imports a portable helper
- **Phase 3 `persona-weights.ts`** — PersonaWeightConfig precedence resolver; reused for client override application
- **GlassPanel** primitive (Raycast container) — popover + inspector + override drawer backgrounds
- **TanStack Query** for server state — analysis result + creator default weights query
- **Zustand stores** — Audience-specific UI state (drawer open/closed, expanded persona row, weight override draft state) fits in a new `audience-store` or extends the board store

### Established Patterns
- **Client-only Konva + DOM overlay hybrid** (Phase 2) — Audience node leans DOM-heavy (per O-1); Konva only for spatial positioning of the node's outer frame
- **RAF-driven animations** — pattern established in tier-hive demos; reused for curve morph + cell-fill wave
- **`aria-live` regions for streaming state** (Phase 2 D-24) — Audience node announces "Audience reactions arriving" / "Audience analysis complete" / "Anti-virality triggered at segments X-Y"
- **`prefers-reduced-motion` respect** (Phase 2 D-23) — animations off, structure intact
- **Graceful degradation** — when Pass 2 below threshold, Audience shows Pass 1 baseline curve + chips + empty heatmap with "Detailed audience prediction unavailable" message (no error, just less)
- **Structured logger** instrumentation — `audience_node_rendered`, `weight_override_applied`, `persona_inspector_opened`, `anti_virality_displayed` events per NF4

### Integration Points
- **Inside the existing Audience group container frame** (Phase 2) — Audience node body fills this frame; frame title bar / chevron stays Phase 2-owned
- **`use-analysis-stream.ts`** — Audience node subscribes; no hook signature change needed
- **`pass2_persona_start` / `pass2_persona_end` / `filmstrip_segment_ready` SSE events** — Phase 3-shipped; choreography hook listens
- **`prefers-reduced-motion` media query** — Phase 2 hook
- **Phase 3 anti-virality module** — `isAntiViralityGated(result)` returns true; orange treatment activates
- **`heatmap.segments[].keyframe_uri`** — filmstrip swaps placeholder → `<img>` when `filmstrip_segment_ready` updates this field
- **DB: existing `analyses.analysis_override` JSON column** (Phase 3 D-20) — Audience writes per-analysis weight overrides here
- **DB: new `creator_persona_weights` table** (D-22) — Audience writes creator default when "Save as my default" is checked; CREATE TABLE migration ships in Phase 4

### Konva integration notes (carried from Phase 2 + refined for Audience node)
- Audience node frame border + label = Konva (consistent with other group container children)
- Everything inside Audience node body = DOM overlay (per O-1) — curve = dedicated `<canvas>`, heatmap = CSS Grid, filmstrip = `<img>` row, popovers + inspector + override drawer = React DOM
- Tap events on Konva markers (dropoff dots) bubble to React handlers; tap events on DOM elements (cells, row labels, curve canvas) handled natively
- DPR-aware rendering on the dedicated curve canvas — set canvas pixel size to `width * devicePixelRatio`, scale 2D context, control CSS size separately

</code_context>

<specifics>
## Specific Ideas

- **Magic-moment framing is paramount.** Per MILESTONE.md, the Audience node IS the moment that converts free users to paid. Every animation choice (D-05 hierarchy reveal / D-06 L→R wave / D-07 baseline-to-morph) optimizes for the "watching AI think" feel.
- **Coral #FF7F50 is the only accent color.** Heatmap = coral-intensity-on-dark gradient. Curve = coral. Markers = coral with archetype-tier ring variants (also coral palette). No red/green per R1.2 + CLAUDE.md.
- **TikTok-Studio-familiar style** for the curve specifically (per R1.2). Creators already understand retention curves from TikTok Studio — DON'T reinvent the visual language. Same line + gradient pattern, Virtuna-coloured.
- **Tribe v2 filmstrip-as-top-axis** — keyframes anchor temporal context (D-01 stacking). The user reads "what happens in the video" via filmstrip, then "how the audience reacts" via curve directly below.
- **Spatial consistency** — same world coordinates phone + desktop (Phase 2 D-10). Audience node renders at the same spatial position; only the heatmap drawer adapts (O-6).
- **Anti-virality is constructive, not punitive** (R1.3) — the QUIET treatment (D-15) honors this. Orange band says "look here," not "you failed."
- **Weight override gives the creator agency** — sliders + presets demystify the prediction. Client-side instant recompute (O-5) is the killer feature within the killer feature: drag a slider, watch the verdict flip in real-time. This is the "you're in control" moment.
- **Performance test device = iPhone 11.** Audience node must hit ≥45fps on iPhone 11 during streaming AND during weight slider drag. If it doesn't, drop to Medium tier degradation OR reduce the L→R wave duration further.
- **Cost not a concern** for any new infra in Phase 4 (carried from MILESTONE.md). However Phase 4 is purely client-side rendering work — no engine cost added; the cost-not-a-concern argument is about engine choices already locked in Phase 3.
- **bypassPermissions on workers, default on auditors** per agent-teams protocol (carried).

</specifics>

<deferred>
## Deferred Ideas

- **Heatmap layer toggle** (Attention / Emotion / Engagement / Skip-probability) — Phase 4 ships single attention layer; toggle deferred to v1.5 (per Phase 2 deferred list, still applies).
- **Persona avatars vs abstract coral dots** — D-11 locks coral dots; avatar variant deferred. Could be revisited once outcome data + persona-personalization features land in Workspace milestone.
- **Free-form conversational co-pilot** ("Why did Persona 3 swipe?") — Phase 4's tap-to-inspector pattern is the structured-interaction baseline; conversational layer deferred to M2-II / M2-III (carried from Phase 2 deferred list).
- **Per-creator weight override UI at the workspace level** — D-21 ships per-analysis + opt-in creator-default. Workspace milestone owns per-niche overrides (Phase 3 D-20 schema accommodates).
- **Outcome feedback loop ("predicted vs actual" overlay on Audience heatmap)** — M2-III. Once user posts a video, real TikTok analytics overlay on the predicted Audience heatmap → comparison node. Schema already in place (Phase 3 D-18 outcomes table).
- **Per-segment audio waveform under filmstrip** — would be cinematic; deferred. Not in scope of Phase 4. Could land alongside Tribe v2 audio modality in M3.
- **Multi-video boards comparison** — Workspace milestone (carried from Phase 2 deferred list).
- **Real-time collaboration (Figma-style cursors on Audience node)** — Workspace milestone.
- **Heatmap pinch-to-zoom into time range scrubbing both curve + heatmap together** — R1.2 mentions; Phase 4 ships the basic pinch-zoom on heatmap. Synchronized curve scrub deferred to Phase 8 mobile polish if pattern isn't natural.
- **Counterfactual-anchored cells (tap fix chip → highlight which cells the fix addresses)** — D-16 ships the chips; bi-directional highlighting deferred.
- **Per-marker hover preview without tap (desktop)** — minor UX win; ship if researcher has cycles, otherwise defer.
- **Custom personas dropped onto Audience group** (agency uploads brand persona) — Workspace milestone (carried).
- **Export Audience node snapshot as PNG separately from the full board share image** — Phase 7 ships board share; Audience-specific export deferred to M2-II.

</deferred>

---

*Phase: 4-Live-Audience-node-the-killer-feature*
*Context gathered: 2026-05-27*
