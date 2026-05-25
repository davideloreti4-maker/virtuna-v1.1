# Roadmap — Result Surface

**Milestone:** Result Surface (M2-I of Intelligence Surface drop)
**Branch:** `milestone/result-surface`

8 phases. Phase 1 done (foundation, sequential). Phases 2-3 parallelize once APIs lock. Phase 4 is the centerpiece (sequential, depends on 2+3). Phases 5-7 parallelize once 4 lands. Phase 8 is integration + regression audit (sequential, final).

**Major direction shift (2026-05-25):** The original "live audience simulation viz" inside a stacked result card has been replaced with a **node-based board model** — `/analyze` is a persistent Konva canvas with 5 group container frames (Input, Engine, Audience, Verdict, Actions, Content Analysis). The Audience node combines a TikTok-Studio-familiar retention curve + per-persona dropoff markers + piano-roll heatmap underlay + filmstrip + headline metrics. Same engine substrate, fundamentally new UI shell. See Phase 2 CONTEXT.md for full rationale.

---

## Phase 1: Foundation — SSE consumer + engine signal extensions ✅

**Requirements covered:** R2.1, R6.1, R1.7 (verify), R1.9 (calibrate threshold — baseline; recalibrated in Phase 3)

**Status:** Complete.

**Goal:** Wire the result page to consume the engine's existing SSE stream and add the two new engine signals (optimal post time, emotion arc verification).

**Plans:** 8 plans (all complete)

**Note:** Phase 1's `ResultCard` skeleton at `/analyze/[id]` (plan 1.8) is **deprecated by Phase 2 board model** — UI shell rebuilt from scratch. Phase 1's engine + hook + route work (SSE consumer, panel-mapping, `optimal_post_window` aggregator, anti-virality threshold baseline) remains the foundation.

---

## Phase 2: Board substrate + Navigation

**Requirements covered:** R1.1 (board substrate), partial R2 (board live-state machine), R3.1 (mobile board), NF1 (perf tiers), NF2 (accessibility scaffold), NF3 (sunset tier-hive cleanly)

**Goal:** Ship the universal board canvas as `/analyze`. Konva-based runtime with 5 group container frames, camera (pan/zoom/presets), state machine (idle / streaming / complete / anti-virality), sidebar restructure, universal context-aware command bar, `/dashboard` → `/analyze` redirect, reduced-motion fallback, accessibility scaffolding, performance tier detection.

This is the shell every subsequent phase plugs into.

**Plans (planning will refine):**
- 2.1 — Konva canvas runtime + camera (pan/zoom, fit-to-content, presets, deep-link camera state via URL)
- 2.2 — Group container frame component (Konva shape + DOM overlay, labeled with title + chevron)
- 2.3 — Node base component (Konva + DOM overlay hybrid, hit-test, interaction, accessibility)
- 2.4 — Board state machine (idle / streaming / complete / anti-virality / edit-input states + transitions)
- 2.5 — Sidebar restructure (sections: New analysis, Navigate, Running, Pinned, Recent, Projects placeholder, Account)
- 2.6 — Universal context-aware command bar (placeholder + chip actions per route + state)
- 2.7 — Input node + drawer (compact node card + slide-out edit drawer with "Recent inputs" picker)
- 2.8 — `/dashboard` → `/analyze` redirect + tier-hive component deletion (`src/components/hive/*` removed)
- 2.9 — Reduced-motion fallback (animations off, board structure + pan/zoom intact)
- 2.10 — Performance tier detection + degradation (high / medium / low)
- 2.11 — Accessibility scaffolding (ARIA, focus management, keyboard nav, alt text, contrast)
- 2.12 — First-board orientation tooltip (subtle hint for first-time visitors)
- 2.13 — Engine group children scaffolding (5 stage placeholders with state machine)

**Success criteria:**
- `/analyze` renders board canvas with all 5 group container frames visible (preview state)
- Pan/zoom + fit-to-content + camera presets work on desktop AND mobile portrait
- Sidebar matches proposed structure; navigation between recent boards works
- Command bar accepts URL/file/text on `/analyze` empty board and routes to engine submit
- `/dashboard` redirects cleanly to `/analyze`
- Tier-hive component fully removed (zero imports, zero references)
- Reduced-motion fallback verified
- Performance tier auto-detected; 60fps on iPhone 13+, 45fps on iPhone 11+ (test device), 30fps min everywhere
- Accessibility scaffold passes axe-core baseline

**Dependencies:** Phase 1 (engine + SSE)
**Parallelizable with:** Phase 3 (engine rework can proceed in parallel after substrate APIs lock)
**Worktree:** Spawn `~/virtuna-result-surface-p2/` after Phase 1 merges

---

## Phase 3: Engine rework — Pass 2 timeline + weighted aggregator + heatmap schema + filmstrip

**Requirements covered:** R2 (refactored: audience engine), R1.9 (anti-virality recalibrated against weighted aggregate), NF4 (telemetry on Pass 2 cost/quality)

**Goal:** Rework the engine to produce time-resolved per-persona attention data with confidence-weighted aggregation. Add dedicated Qwen Pass 2 per-persona timeline call with thinking-mode. Refactor aggregator to weighted mean (persona audience-share weights). Recalibrate anti-virality threshold against weighted aggregate distribution. Add `heatmap` field to `PredictionResult` schema. Generate filmstrip keyframes for Audience node top axis.

**Plans (planning will refine):**
- 3.1 — Qwen persona prompt v2: dedicated per-persona Pass 2 call with thinking-mode + structured per-segment output
- 3.2 — Aggregator refactor: weighted mean with configurable `persona_weights` (defaults: FYP 0.65 / niche 0.20 / loyalist 0.10 / cross 0.05)
- 3.3 — Anti-virality threshold recalibration vs weighted aggregate (corpus sweep + documented rationale)
- 3.4 — `PredictionResult.heatmap` schema additions (segments[], personas[].attentions[], swipe markers, reasons at inflection points)
- 3.5 — Streaming partials extension (`partial.personas[].attentions[]` fills in as Pass 2 returns)
- 3.6 — Filmstrip generation pipeline (keyframe extraction via Qwen-VL or Gemini, Supabase Storage, signed URLs)
- 3.7 — Telemetry: Pass 2 latency, output quality guards, weight transparency surfacing

**Success criteria:**
- Persona Pass 2 returns valid per-segment attention scores for 10 personas in <8s p95
- Weighted aggregator output verified against test fixtures + outcomes corpus
- Anti-virality threshold value re-locked with documented calibration procedure
- `heatmap` schema validated; downstream consumers (Audience node) can read it
- Filmstrip keyframes generated for any test video, served via signed URLs
- Zero engine regressions on existing Phase 1 functionality

**Dependencies:** Phase 1 (engine baseline)
**Parallelizable with:** Phase 2 (different surface — UI vs engine; APIs lock early then both teams work independently)
**Worktree:** Spawn `~/virtuna-result-surface-p3/` after Phase 1 merges

---

## Phase 4: Live Audience node — the killer feature

**Requirements covered:** R1.2 (refactored: Audience node centerpiece), partial R2.2/R2.3 (streaming choreography)

**Goal:** Build the Audience node — the visual hinge of the whole product. Combined visualization: keyframe filmstrip top axis, retention curve overlay, per-persona dropoff markers, headline metrics chip row, piano-roll heatmap underlay (collapsed by default), per-persona inline expand. Live-stream choreography materializes rows as Pass 2 personas complete. Anti-virality state highlights critical drops with rework guidance.

**Plans (planning will refine):**
- 4.1 — Audience node shell (inside Audience group frame, Konva + DOM overlay)
- 4.2 — Headline metrics chip row (Avg watch %, Loop %, Top dropoff, Hook score, vs Niche)
- 4.3 — Filmstrip component (renders keyframes from Phase 3.6 output, scrollable on long videos)
- 4.4 — Retention curve component (Canvas-rendered, smooth bezier, weighted aggregate from Phase 3.2)
- 4.5 — Dropoff markers component (avatar/dot chips on curve, group on overlap)
- 4.6 — Heatmap component (persona × segment grid, coral-intensity-on-dark, collapsible)
- 4.7 — Streaming choreography (rows materialize as Pass 2 completes per persona, ~3-5s total reveal)
- 4.8 — Tap interactions (cell → reason popover, row label → persona detail, marker → persona at that moment, curve point → aggregate scrub)
- 4.9 — Per-persona inline expand (row spans full width with detail when tapped)
- 4.10 — Anti-virality visual treatment (critical drop highlights, rework guidance anchored to segments)
- 4.11 — Audience weighting transparency badge + weight override UI (chip-action)
- 4.12 — Mobile portrait optimization (compact curve + heatmap pinch-zoom + tap-row-expand)

**Success criteria:**
- Audience node renders all layers correctly against test fixtures
- Live streaming choreography animates rows-as-personas-complete smoothly
- Hits 60fps on iPhone 13+ and 45fps on iPhone 11+ during streaming
- All interactions functional (tap cell / row / marker / curve)
- Anti-virality state correctly transforms visual treatment
- Mobile portrait layout fully functional (no rotation needed)
- Reduced-motion fallback verified

**Dependencies:** Phase 2 (board substrate) + Phase 3 (engine + filmstrip data)
**Parallelizable with:** Nothing — this is the singular focused effort
**Worktree:** Spawn `~/virtuna-result-surface-p4/` after Phases 2+3 merge

---

## Phase 5: Other group nodes — Verdict + Actions + Content Analysis populated

**Requirements covered:** R1.3 (refactored: persona detail in Audience), R1.4 (Hook decomp node), R1.5 (Similar videos in Actions), R1.6 (Reasoning in Verdict), R1.7 (Emotion arc node), R1.8 (Comparative baseline in Verdict), R1.9 (Anti-virality cross-group state)

**Goal:** Populate the remaining group nodes with their content.

**Plans (planning will refine):**
- 5.1 — Verdict node body (percentile + confidence chip + anti-virality state header)
- 5.2 — Reasoning narrative section in Verdict (collapsible, R1.6 4 sections, markdown + citations)
- 5.3 — Comparative baseline section in Verdict (collapsible, R1.8 two horizontal bar charts)
- 5.4 — Anti-virality "Don't post yet" state (orange treatment, top 3 fixes anchored to segments)
- 5.5 — Actions group containers (reshoot placeholder, optimal post placeholder, similar videos card, share placeholder)
- 5.6 — Similar videos panel inside Actions (R1.5, reuse VideoCard from `/trending`)
- 5.7 — Content Analysis: Hook decomp node (R1.4, 4-bar GlassProgress + chips + expand)
- 5.8 — Content Analysis: Emotion arc node (R1.7, Recharts area chart)
- 5.9 — Cross-group state coordination (anti-virality ripple across Verdict / Audience / Actions)

**Success criteria:**
- All remaining nodes render against test fixtures
- Anti-virality coordinated state changes work across all three groups
- Hook decomp + Emotion arc render correctly at all screen sizes
- All collapsible sections work; expand state survives navigation

**Dependencies:** Phase 4 (Audience node sets visual + state patterns)
**Parallelizable with:** Phase 6 (Reshoot script can be built in parallel)
**Worktree:** Spawn `~/virtuna-result-surface-p5/` after Phase 4 merges

---

## Phase 6: Reshoot script + optimal post time

**Requirements covered:** R5 (all), R6.2

**Goal:** Turn engine output into actionable creator surface (script + post time UI). Refines Actions group with these two nodes.

**Plans (planning will refine):**
- 6.1 — `/api/analyze/<id>/script` endpoint (pure transformation of counterfactuals + A/B variants)
- 6.2 — Script result caching (alongside analysis result row)
- 6.3 — Reshoot script node inside Actions group (4 sections + per-section + copy-all)
- 6.4 — Script empty state (high-confidence case)
- 6.5 — Optimal post time node inside Actions group (day/time/reasoning, timezone-aware)
- 6.6 — Niche-level reasoning surface

**Success criteria:**
- Script endpoint returns structured script in <200ms p95
- All 4 script sections copy individually + whole script copies with headers
- Empty state shows on high-confidence analyses
- Post-time node respects creator timezone, editable

**Dependencies:** Phase 5 (Actions group scaffold)
**Parallelizable with:** Phase 5 (can develop nodes in parallel once group containers from P2 exist)
**Worktree:** Spawn `~/virtuna-result-surface-p6/` after Phase 4 merges

---

## Phase 7: Share & export

**Requirements covered:** R4 (all)

**Goal:** Frictionless sharing — the loop that turns a board into product virality.

**Plans (planning will refine):**
- 7.1 — Satori share-image generator (1080×1920 + 1200×630 variants, board-style composition)
- 7.2 — `/api/analyze/<id>/share-image` endpoint (cached, ≤2s p95)
- 7.3 — Public permalink route `/r/<slug>` with read-only board view
- 7.4 — Short-slug generator + collision-resistant ID strategy
- 7.5 — Public/private toggle per analysis (UI + DB column)
- 7.6 — Share button: native share sheet on mobile, dropdown on desktop
- 7.7 — `result_share` telemetry events

**Success criteria:**
- Share image generates in ≤2s p95
- Public permalinks render correctly without auth, with OG metadata
- Native share works on iOS Safari + Chrome Android
- Privacy: no PII in share images or permalinks unless opted-in

**Dependencies:** Phases 4 + 5 (need actual rendered board for share image)
**Parallelizable with:** Phase 6
**Worktree:** Spawn `~/virtuna-result-surface-p7/` after Phases 4+5 merge

---

## Phase 8: Mobile + onboarding + integration + regression audit

**Requirements covered:** R3 (all, refactored: mobile board), R7 (all), NF1-NF6

**Goal:** Final integration. Mobile-first polish pass. WOW onboarding orchestration. Regression audit before merge to main.

**Plans (planning will refine):**
- 8.1 — Mobile responsive polish: `/analyze` board, all node bodies, vertical layouts
- 8.2 — Mobile upload flow (native picker, file size check, progress bar)
- 8.3 — Mobile portrait optimizations for Audience node (pinch-zoom, tap-row-expand) — verify Phase 4 work
- 8.4 — First-board orientation tooltip polish (Phase 2 shipped baseline)
- 8.5 — First-analysis tutorial overlay (3-step, skippable; updated for board model)
- 8.6 — Paced verdict reveal on first analysis (gated tap)
- 8.7 — Next-action prompts (reshoot, re-upload nudges)
- 8.8 — Telemetry instrumentation (first-analysis events, share events, engagement metrics)
- 8.9 — Regression audit across 10+ existing pages
- 8.10 — Mobile Lighthouse run (target ≥90 across all dimensions on iPhone 13)
- 8.11 — Accessibility audit (WCAG AA, screen reader for board + Audience node)
- 8.12 — Cross-browser smoke (Safari, Chrome, Firefox on desktop + mobile)

**Success criteria:**
- Mobile Lighthouse ≥ 90 across all dimensions
- Zero regressions on existing pages
- First-analysis tutorial completion >50% on internal testing
- WCAG AA maintained
- All telemetry events captured

**Dependencies:** All phases (1-7) complete
**Parallelizable with:** Nothing (final integration)
**Worktree:** `~/virtuna-result-surface/` (this one — merges Phase 2-7 branches back)

---

## Wave summary

| Wave | Phases | Parallel? | Duration estimate |
|------|--------|-----------|-------------------|
| Foundation | 1 ✅ | Done | — |
| Build substrate + engine | 2, 3 | Yes (UI vs engine, parallel after APIs lock) | 2-3 days each |
| Build centerpiece | 4 | No (focused) | 5-7 days |
| Populate other nodes | 5, 6 | Yes (parallel after P4) | 3-5 days each |
| Share | 7 | After 4+5 | 3-4 days |
| Ship | 8 | No (integration) | 3-5 days |

**Total milestone duration:** ~3-4 weeks if Phase 2+3 parallel and Phase 5+6 parallel. ~5-6 weeks sequential.

---

## After this milestone ships

Once `milestone/result-surface` merges to main:

1. Fork `~/virtuna-iteration-intelligence/` for M2-II (Iteration & Niche Intelligence)
2. Fork `~/virtuna-compounding-intelligence/` for M2-III (Compounding Intelligence)
3. Both run in parallel from main + this milestone's board substrate
4. Public drop triggered only after all 3 milestones merge to main

The **Workspace milestone** (projects management UI, canvas view of dashboard, templates, custom personas, team / sharing) lands after the Intelligence Surface drop — it builds on top of the board substrate shipped here.

The **M3 "Tribe Engine" milestone** (V-JEPA2 + W2vec-BERT + Llama 3.2 encoder stack, retrained subject block on outcome data, ensemble with LLM persona heatmap) is roadmapped post-Intelligence-Surface drop. Phase 3 here ships the L2+ Qwen-thinking-mode persona Pass 2 timeline call — Tribe v2 frozen-encoder grounding and trained subject block are deferred.

No public release event happens during this milestone. New surfaces ship behind feature flag (`FEATURE_INTELLIGENCE_SURFACE`) until the drop event.

---

## Risks

| Risk | Mitigation |
|------|------------|
| Board substrate (Konva + DOM hybrid) doesn't hit perf on iPhone 11 | Tiered perf detection auto-degrades; reduced-motion baseline; Phase 2 benchmark gate |
| Pass 2 quality below L1 baseline (model hallucinates per-segment scores) | Output validation + sanity checks in Phase 3.1; reasoning at inflection points only; A/B vs L1 fixtures |
| Aggregator refactor breaks Phase 1's anti-virality threshold | Phase 3.3 explicit recalibration step; documented rationale; verify against outcomes corpus |
| Existing hive component deletion cascades regressions | Phase 2.8 audits all imports before removal; tier-hive was only used at `/dashboard` (now redirected) |
| Filmstrip generation slow (Qwen-VL keyframe extraction) | Cache keyframes in Supabase Storage; generate during Wave 0 in parallel with other engine work |
| Mobile portrait Audience node too cramped | Phase 4.12 + Phase 8.3 dedicated portrait passes; tap-row-expand pattern; pinch-zoom |
| First-board orientation lost without tutorial | Phase 2.12 ships subtle hint; Phase 8.4 polishes |
| Share image gen cost runs higher than expected | Satori is local — should be ~free; verify in P7 |
| First-analysis WOW backfires (annoys returning users) | Strict first-analysis gating via `first_analysis_at IS NULL` check |
