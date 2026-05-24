# Roadmap — Result Surface

**Milestone:** Result Surface (M2-I of Intelligence Surface drop)
**Branch:** `milestone/result-surface`

7 phases. Phases 1-2 are foundation (sequential). Phases 3-6 can parallelize across worktrees. Phase 7 is integration + regression audit (sequential, final).

---

## Phase 1: Foundation — SSE consumer + engine signal extensions

**Requirements covered:** R2.1, R6.1, R1.7 (verify), R1.9 (calibrate threshold)

**Goal:** Wire the result page to consume the engine's existing SSE stream and add the two new engine signals (optimal post time, emotion arc verification).

**Plans:** 8 plans

Plans:
- [ ] 01-01-PLAN.md — Wave 0 test scaffolding + canonical fixtures (it.todo stubs unblock all downstream plans)
- [ ] 01-02-PLAN.md — Wave 1 SSE consumer hook + panel-mapping module + POST event:started fix (D-01 through D-08, Pitfall #6)
- [ ] 01-03-PLAN.md — Wave 2 GET /api/analyze/[id]/stream EventSource endpoint (D-04, IDOR mitigation)
- [ ] 01-04-PLAN.md — Wave 2 Omni Plus emotion_arc engine extension (R1.7, Pitfall #7)
- [ ] 01-05-PLAN.md — Wave 2 optimal_post_window aggregator + niche_post_windows migration (R6.1, D-12 through D-15, Pitfall #4)
- [ ] 01-06-PLAN.md — Wave 2 anti-virality threshold calibration (R1.9, sweep against outcomes corpus or insufficient-data fallback)
- [ ] 01-07-PLAN.md — Wave 3 [BLOCKING] supabase db push + types regen + full Wave 2 test gate
- [ ] 01-08-PLAN.md — Wave 4 /analyze + /analyze/[id] route scaffold + ResultCard skeleton + E2E (D-09, D-10, D-11)

**Success criteria:**
- Result page subscribes to SSE, all stage events update local state
- `optimal_post_window` returned by `/api/analyze`
- Emotion arc data confirmed in pipeline output (or added)
- Anti-virality threshold locked with rationale documented
- Page renders skeleton on submit, transitions through stage states

**Dependencies:** None (engine v3.0.0 already shipped)
**Parallelizable with:** Nothing (foundation)
**Worktree:** `~/virtuna-result-surface/` (this one)

---

## Phase 2: Live audience simulation viz

**Requirements covered:** R2.2, R2.3, R2.4, NF1 (60fps)

**Goal:** The wow moment. Live persona hive that animates as Wave 3 runs.

**Plans:**
- 2.1 — Persona hive component (Canvas 2D, extends `~/src/components/hive/`)
- 2.2 — Persona node states: idle → pulsing → settled (with verdict color)
- 2.3 — Wave 3 SSE → persona node animation orchestration
- 2.4 — Verdict reveal animation (aggregated percentile + confidence)
- 2.5 — Reduced-motion fallback (static breakdown)
- 2.6 — Performance: maintain 60fps on iPhone 13+ (profile + optimize)
- 2.7 — Stage label component ("Reading audience…" plain-English transitions)

**Success criteria:**
- Live viz holds 60fps on iPhone 13+ (measured)
- All 10 personas animate in parallel as DeepSeek calls complete
- Verdict reveal smooth, ~800ms ease
- Reduced-motion fallback verified

**Dependencies:** Phase 1 (SSE consumer)
**Parallelizable with:** Phase 3 (once Phase 1 done)
**Worktree:** Spawn `~/virtuna-result-surface-p2/` after Phase 1 merges

---

## Phase 3: Result card panels — Set A (visual)

**Requirements covered:** R1.1, R1.2, R1.4, R1.7, R1.8

**Goal:** Build the panels that render charts/visualizations. Self-contained, no LLM dependency at render time.

**Plans:**
- 3.1 — Result card shell (GlassPanel container, layout grid mobile/desktop)
- 3.2 — Retention curve panel (Recharts line + drop-off markers)
- 3.3 — Hook decomp panel (4-bar GlassProgress + chips + expansion)
- 3.4 — Emotion arc panel (Recharts area chart with color-coded intensity)
- 3.5 — Comparative baseline panel (2 horizontal bar charts)
- 3.6 — Panel loading skeletons + empty states

**Success criteria:**
- All 5 visual panels render against test fixture data
- Mobile + desktop layouts both pass design review
- Empty states + skeletons consistent across panels

**Dependencies:** Phase 1
**Parallelizable with:** Phase 2, Phase 4
**Worktree:** Spawn `~/virtuna-result-surface-p3/` after Phase 1 merges

---

## Phase 4: Result card panels — Set B (text-heavy)

**Requirements covered:** R1.3, R1.5, R1.6, R1.9

**Goal:** Build the panels heavy on text content. Reads from aggregator output.

**Plans:**
- 4.1 — Persona breakdown panels (10 expandable cards, FYP-grouped layout)
- 4.2 — Similar videos panel (reuse VideoCard from `/trending`)
- 4.3 — Reasoning narrative panel (structured Markdown sections)
- 4.4 — Anti-virality verdict state (orange warning, top 3 fixes)
- 4.5 — Per-panel test fixtures from production engine output snapshots

**Success criteria:**
- All 4 panels render against real engine output snapshots
- Text overflow handled gracefully on mobile
- Anti-virality state triggers below threshold (verified)

**Dependencies:** Phase 1
**Parallelizable with:** Phase 2, Phase 3
**Worktree:** Spawn `~/virtuna-result-surface-p4/` after Phase 1 merges

---

## Phase 5: Reshoot script + optimal post time

**Requirements covered:** R5 (all), R6.2

**Goal:** Turn engine output into actionable creator surface (script + post time UI).

**Plans:**
- 5.1 — `/api/analyze/<id>/script` endpoint (pure transformation of counterfactuals + A/B variants)
- 5.2 — Script result caching (alongside analysis result row)
- 5.3 — Reshoot script panel UI (4 sections + per-section + copy-all buttons)
- 5.4 — Script empty state (high-confidence case)
- 5.5 — Optimal post time panel (day/time/reasoning, timezone-aware)
- 5.6 — Niche-level reasoning surface ("Your niche peaks on Tue evenings…")

**Success criteria:**
- Script endpoint returns structured script in <200ms p95
- All 4 script sections copy individually + whole script copies with headers
- Empty state shows on high-confidence analyses
- Post-time panel respects creator timezone, editable

**Dependencies:** Phase 1 (uses `optimal_post_window` from aggregator)
**Parallelizable with:** Phase 2, Phase 3, Phase 4
**Worktree:** Spawn `~/virtuna-result-surface-p5/` after Phase 1 merges

---

## Phase 6: Share & export

**Requirements covered:** R4 (all)

**Goal:** Frictionless sharing — the loop that turns a result into product virality.

**Plans:**
- 6.1 — Satori share-image generator (1080×1920 + 1200×630 variants)
- 6.2 — `/api/analyze/<id>/share-image` endpoint (cached, ≤2s p95)
- 6.3 — Public permalink route `/r/<slug>` with read-only result card view
- 6.4 — Short-slug generator + collision-resistant ID strategy
- 6.5 — Public/private toggle per analysis (UI + DB column)
- 6.6 — Share button: native share sheet on mobile, dropdown on desktop
- 6.7 — `result_share` telemetry events

**Success criteria:**
- Share image generates in ≤2s p95
- Public permalinks render correctly without auth, with OG metadata
- Native share works on iOS Safari + Chrome Android
- Privacy: no PII in share images or permalinks unless opted-in

**Dependencies:** Phases 3 + 4 (need actual rendered panels for share image)
**Parallelizable with:** Phase 5 (after 3+4 done)
**Worktree:** Spawn `~/virtuna-result-surface-p6/` after Phases 3+4 merge

---

## Phase 7: Mobile + onboarding + integration + regression audit

**Requirements covered:** R3 (all), R7 (all), NF1-NF6

**Goal:** Final integration. Mobile-first pass. WOW onboarding orchestration. Regression audit before merge to main.

**Plans:**
- 7.1 — Mobile responsive pass: `/analyze` + result card + live viz vertical layouts
- 7.2 — Mobile upload flow (native picker, file size check, progress bar)
- 7.3 — Bottom-sheet panel expansion pattern on mobile
- 7.4 — First-analysis tutorial overlay (3-step, skippable)
- 7.5 — Paced verdict reveal on first analysis (gated tap)
- 7.6 — Next-action prompts (reshoot, re-upload nudges)
- 7.7 — Telemetry instrumentation (first-analysis events, share events, engagement metrics)
- 7.8 — Regression audit across 10+ existing pages
- 7.9 — Mobile Lighthouse run (target ≥90 across all dimensions)
- 7.10 — Accessibility audit (WCAG AA, screen reader for live viz)
- 7.11 — Cross-browser smoke (Safari, Chrome, Firefox on desktop + mobile)

**Success criteria:**
- Mobile Lighthouse ≥ 90 across all dimensions
- Zero regressions on existing pages
- First-analysis tutorial completion >50% on internal testing
- WCAG AA maintained
- All telemetry events captured

**Dependencies:** All phases (1-6) complete
**Parallelizable with:** Nothing (final integration)
**Worktree:** `~/virtuna-result-surface/` (this one — merges Phase 1-6 branches back)

---

## Wave summary

| Wave | Phases | Parallel? | Duration estimate |
|------|--------|-----------|-------------------|
| Foundation | 1 | No (foundation) | 2-3 days |
| Build | 2, 3, 4, 5 | Yes (4 parallel worktrees) | 5-7 days each in parallel |
| Polish | 6 | After 3+4 | 3-4 days |
| Ship | 7 | No (integration) | 3-5 days |

**Total milestone duration:** ~3 weeks if all parallel waves run with ~1 worker per worktree. ~5-6 weeks sequential.

---

## After this milestone ships

Once `milestone/result-surface` merges to main:

1. Fork `~/virtuna-iteration-intelligence/` for M2-II (Iteration & Niche Intelligence)
2. Fork `~/virtuna-compounding-intelligence/` for M2-III (Compounding Intelligence)
3. Both run in parallel from main + this milestone's design patterns
4. Public drop triggered only after all 3 milestones merge to main

No public release event happens during this milestone. New surfaces ship behind feature flag (`FEATURE_INTELLIGENCE_SURFACE`) until the drop event.

---

## Risks

| Risk | Mitigation |
|------|------------|
| Live viz can't hit 60fps on older devices | Reduced-motion fallback already in scope; profile early in P2 |
| Mobile Lighthouse <90 due to heavy live viz | Lazy-load viz code; gate behind viewport intersection |
| Anti-virality threshold mis-calibrated | Resolve in P1 against corpus before locking; revisit in P7 with real user data |
| Share image generation cost runs higher than expected | Satori is local — should be ~free; verify in P6 |
| Existing hive component refactor cascades regressions | Scope live viz to new component; keep existing hive untouched |
| First-analysis WOW backfires (annoys returning users) | Strict first-analysis gating via `first_analysis_at IS NULL` check |
