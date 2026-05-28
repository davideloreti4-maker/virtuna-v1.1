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
- 2.14 — Workspace schema (projects table + project_id FK + default seed)
- 2.15 — Gap closure: re-space group frames with 96px world-space gaps (UAT gap 1)
- 2.16 — Gap closure: sync DOM overlay with Konva drag transform via onDragMove (UAT gap 2)

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

**Plans:** 8 plans (4 waves)

Plans:
- [x] 03-01-PLAN.md — Wave 0 test scaffolding: Vitest stubs for pass2, weighted-aggregator, filmstrip, persona-weights; extend anti-virality.test.ts
- [x] 03-02-PLAN.md — Schema foundations: Wave 0 omni segments[], PredictionResult weighted_* + heatmap, partial.personas D-15 extensions, new SSE events, next.config.ts ffmpeg-static externalization
- [x] 03-03-PLAN.md — [BLOCKING] Migration: outcomes table (D-18) + filmstrips storage bucket (D-10) + pg_cron cleanup + `supabase db push --linked`
- [x] 03-04-PLAN.md — Pure-math modules: persona-weights precedence resolver (D-20) + weighted-aggregator buildWeightedCurve/assembleHeatmapPayload (D-12, D-13)
- [x] 03-05-PLAN.md — Anti-virality dual-trigger (D-17) + Stage10 swap to qwen3.6-plus thinking-mode (D-21)
- [x] 03-06-PLAN.md — Pass 2 orchestrator: persona-prompts-pass2 (D-04 enrichment) + pass2.ts runWave3Pass2 (D-01..D-06, D-23, D-24)
- [x] 03-07-PLAN.md — Filmstrip pipeline: ffmpeg extract + Supabase Storage signed-URL upload + fire-and-forget queue + /api/filmstrip/extract route (D-09, D-11)
- [x] 03-08-PLAN.md — Integration: pipeline.ts wiring (filmstrip + Pass 2) + aggregator.ts (weighted_* + heatmap + dual-trigger) + SSE stream route extensions

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

**Plans:** 11 plans (6 waves)

Plans:
- [x] 04-01-PLAN.md — Wave 0 test scaffolding (18 test stubs + 2 fixtures + migration scaffold)
- [x] 04-02-PLAN.md — Engine type extensions: HeatmapPayload.personas[].slot_type + weighted-aggregator-client.ts + audience-types/constants
- [x] 04-03-PLAN.md — Extend useAnalysisStream to dispatch filmstrip_segment_ready into a filmstrips: Record<number, string> return key
- [x] 04-04-PLAN.md — use-audience-choreography hook: skeleton rows + row state machine + curve state machine + anti-virality flag
- [x] 04-05-PLAN.md — HeadlineChips (5 chips + weights badge) + Filmstrip (placeholder→keyframe swap)
- [x] 04-06-PLAN.md — DropoffMarkers pure-fn + use-retention-curve-canvas DPR/RAF hook + RetentionCurve component (hand-rolled Catmull-Rom α=0.5)
- [x] 04-07-PLAN.md — PersonaRow (L→R cell wave) + HeatmapDrawer (desktop inline / mobile bottom-sheet + color-blind mode)
- [x] 04-08-PLAN.md — TapPopover (5 variants + scroll-dismiss) + PersonaInspector (absorbs plan 4.9 per D-14) + AntiViralityOverlay (dual-trigger visual variants)
- [x] 04-09-PLAN.md — Weight override: useClientWeights (RAF-debounced recompute) + WeightOverrideDrawer + POST /api/analyze/[id]/override with Zod
- [x] 04-10-PLAN.md — AudienceNode shell composition + Board.tsx integration
- [x] 04-11-PLAN.md — [BLOCKING] supabase db push --linked + full test sweep + manual mobile/perf verification

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

**Plans:** 4/10 plans executed

Plans:
- [x] 05-01-PLAN.md — Wave 0 foundation: install react-markdown + rehype-sanitize, refactor Board.tsx AV check into cross-group-state.ts selector, create 13 Wave 0 test stubs + PredictionResult fixtures
- [ ] 05-02-PLAN.md — Verdict shell: VerdictNode + PercentileChip + AntiViralityHeader (orange band + Post-anyway localStorage override) + types/constants
- [ ] 05-03-PLAN.md — WhyVerdictCollapsible: 4-bucket O-2 assembly + react-markdown (XSS-safe via rehype-sanitize) + TopFixesList for AV (camera-pan timestamp pills)
- [ ] 05-04-PLAN.md — VsHistoryCollapsible: 2 horizontal Recharts BarCharts + empty state + /api/analyze/[id]/comparisons RLS-gated route + useComparisons TanStack hook
- [x] 05-05-PLAN.md — Actions shell: ActionsNode 2x2 grid with AV grow-to-hero + PlaceholderCard (dashed border) + Reshoot/OptimalPost/Share slot wrappers
- [ ] 05-06-PLAN.md — SimilarVideosCard + SimilarVideoCardCompact (5 compact rows) + TikTok embed via Radix Dialog portal + empty state
- [x] 05-07-PLAN.md — Hook decomp node: 4-bar GlassProgress + weakest highlight + INVERTED-polarity cognitive load chip + HookDecompInspector Sheet
- [x] 05-08-PLAN.md — Emotion arc node: Recharts AreaChart with coral linearGradient + ReferenceDot peaks/valleys + perf-tier degradation + EmotionArcInspector
- [ ] 05-09-PLAN.md — Integration: ContentAnalysisFrame horizontal split (480px Hook + 872px Emotion) + Board.tsx render switch wires VerdictNode/ActionsNode/ContentAnalysisFrame
- [ ] 05-10-PLAN.md — Manual-verify checkpoint: 12-step visual + functional gate (Verdict / Actions / Content Analysis + AV ripple + reduced-motion)

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

**Plans:** 6 plans (4 waves)

Plans:
- [x] 06-01-PLAN.md — Wave 1: [BLOCKING] migrations + Supabase schema push + shared utils (script-utils, optimal-post-time) + types/constants + TELEMETRY extension
- [x] 06-02-PLAN.md — Wave 2: GET /api/analyze/[id]/script endpoint (transformation + cache write) + 10-case test matrix
- [x] 06-03-PLAN.md — Wave 2: POST /api/analyze/[id]/optimal-post-override endpoint (Zod-validated, RLS+defense-in-depth) + 6-case test matrix
- [ ] 06-04-PLAN.md — Wave 3: Script UI components (CopyButton, ScriptBody, ScriptInspectorTrigger, ScriptEmptyState) + use-script TanStack hook
- [ ] 06-05-PLAN.md — Wave 3: Optimal-post UI components (OptimalPostCard, OptimalPostEditSheet, OptimalPostSourcePill) + use-optimal-post-override mutation
- [ ] 06-06-PLAN.md — Wave 4: Wire ActionsReshootHeroSlot + ActionsOptimalPostSlot inside ActionsNode + update ActionsNode.test.tsx testids + patch database.types.ts

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
2. Public M2 drop triggered only after both M2-I + M2-II merge to main

**M3 (Engine Quality + Compounding Intelligence)** starts after M2 ships. Scope:
- Deferred engine debt from Engine Hardening (audio fingerprint, embedder.ts, D-F4 cron, 17 skipped tests)
- Compounding intelligence (outcome feedback loop, wins/flops trend, hook archetype library, trend velocity, weekly intelligence report)
- Tribe v2 frozen-encoder grounding (V-JEPA2 + W2vec-BERT + Llama 3.2), threshold tuning on real outcome data
- Original M3 backlog (Ultra tier, in-app viz rebuild, /about//research//manifesto, brand deals marketplace, competitor discovery, trending page relaunch, history view, analytics dashboard)

The **Workspace milestone** (projects management UI, canvas view of dashboard, templates, custom personas, team / sharing) lands after the M2 drop — it builds on top of the board substrate shipped here.

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
