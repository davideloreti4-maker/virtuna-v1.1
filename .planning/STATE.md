---
gsd_state_version: 1.0
milestone: apollo
milestone_name: Apollo
status: ready_to_plan
last_updated: "2026-06-05T13:39:37.624Z"
progress:
  total_phases: 2
  completed_phases: 0
  total_plans: 5
  completed_plans: 4
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md · Milestone identity: .planning/MILESTONE.md · Cut-list SSOT: .planning/ENGINE-MAP.md

## Current Position

Phase: 04 (audience-sim-fold-brain-2-the-bet) — EXECUTING
Plan: 5 of 5
Phase: 03 (Apollo Reasoner) — NOT STARTED (blocked on corpus v1)
Last completed plan: 04-01
**Milestone worktree** `~/virtuna-engine-opt/` on `milestone/engine-opt`. Milestone **Apollo** — turn the ~25-call score machine into a 3-call knowledge-grounded expert (Omni → Audience-Sim → Apollo Reasoner).

Engine teardown **complete** (S0–S19, 2026-06-03) → `ENGINE-MAP.md`. Milestone formalized. **Synced with `origin/main` (merged in Remix PR #6 + audience change) — branch was stale + blind to Remix.** Re-scanned Remix engine path; folded into the plan (Remix = Apollo modes, R12). **No phase plans yet.**

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | Strip to Senses | COMPLETE (2026-06-04) — 6/6 plans done |
| 2 | Omni Verbatim | COMPLETE (2026-06-04) — 3/3 plans done; R1 proven on real run (gwxLeHphZCxK); D-02 silent deferred HUMAN-UAT |
| 3 | Apollo Reasoner (Brain 1, the moat) | not started — blocked on Chase Hughes corpus |
| 4 | Audience-Sim Fold (Brain 2, the bet) | in progress (2/5 plans complete) |
| 5 | Wire + Surface | not started |

## Decisions locked (2026-06-05, 04-04)

- **Both aggregateScores paths share ONE pipeline call per run (useFold:true)** — fold LLM call counted exactly once per pipeline invocation; R7 call-count assertion is structurally honest.
- **swipeSegments uses run1 values as representative for drop-point comparison** — segment ordering stable across runs; averaging indices would be lossy.
- **wave_3_persona_* + wave_3_pass2_persona_* regex counts the 20 individual calls** — matches actual stage names in wave3.ts (10 pass1 personas) + pass2.ts (10 pass2 personas).
- **04-04 COMPLETE (2026-06-05)** — ab-fold-referee.ts composite complete: 3-metric gate (parity<=5, diversity>=0.8x, drop>=6/10), R7 call-count assertion, R8 2-runs averaging, per-video table, advisory overall verdict (D-05). tsc zero errors in script. Commit: `aa3a8428`. Next: `/gsd-execute-phase 4 04-05` — real-API referee run + production-flip human checkpoint.

## Decisions locked (2026-06-05, 04-03)

- **adaptFoldToPersonaSimResults synthesizes reasoning from archetype** — `PersonaSimulationResult.reasoning` is required (min 1) but absent from FoldResponse; `"fold-derived: {archetype}"` satisfies the constraint without inventing data.
- **Pass2PersonaResult does NOT have swipe_predicted_at / segment_reasons** — those are computed by `assembleHeatmapPayload` from `segment_reactions`; adapter populates only the 6 required fields; heatmap derivation unchanged (D-11/D-12).
- **behavioralSource:"fold" branch uses IIFE** — clean 3-way fallback (fold → personas → deepseek) without nested ternaries; production default "deepseek" byte-unchanged (D-09).
- **pipeline foldOutcome uses ENGINE_USE_FOLD=1 flag** — default OFF; 10-pass `runWave3Pass2` call site preserved dormant-not-deleted (D-09 rollback path, T-04-06).
- **04-03 COMPLETE (2026-06-05)** — fold adapters real (fold-adapter.test.ts + fold-diversity-guard.test.ts 6/6 GREEN); aggregator "fold" branch routes behavioral aggregate + heatmap from foldOutcome; pipeline threads foldOutcome default OFF; ab-fold-referee @ts-expect-error shim removed; 1826/1826 tests GREEN. Commits: `f289eaf5` (adapters), `bf44f0d3` (aggregator + pipeline).

## Decisions locked (2026-06-05, 04-02)

- **FoldArchetypeSchema uses z.string() for archetype** — test fixture (fold-schema.test.ts) uses a different archetype set than the real registry; z.enum would reject all 5 test cases; structural constraints (.length(10), attention [0,1], reason ≤200) still enforced; real archetype enum is a Plan 03 adapter concern.
- **computeAvgCurveRange + checkDiversityGuard exported from fold.ts** — fold-internal utilities used post-parse in runFold; fold-diversity-guard.test.ts imports them from fold.ts per PATTERNS.md; not deferred to Plan 03.
- **04-02 COMPLETE (2026-06-05)** — fold-prompts.ts (byte-stable 10-archetype prompt + FoldResponseSchema + buildFoldUserContent) + fold.ts (single bounded qwen3.6-plus thinking call, R7); fold-schema.test.ts 5/5 GREEN; tsc 0 errors in new files; exactly 1 completions.create.

## Decisions locked (2026-06-05, 04-01)

- **REDUCED referee VIDEO_SET (2 of 6)** — user decision 2026-06-05; D-03 composite degrades gracefully (drop-point agreement is per-video); deferred 4 D-04 slots (hook-strength × niche spread) to be added before Plan 04 referee runs. `gwxLeHphZCxK` (.mp4, good) + `IMG_0012` (.mov, bad/weak hook) confirmed on disk.

## Decisions locked (2026-06-03)

- **Keep the score** (0–100) + a **confidence** indicator — framed as Apollo's expert assessment (the LLM is the ground truth, like a chess engine's position eval). NOT demoted to a band. Rederive it from Apollo (+ Audience-Sim), drop the dead 7-source blend + corpus-percentile framing. Delete only the fabricated engagement counts. (R5/R9 updated.)
- **Keep engagement prediction — but grounded.** The current `predicted-engagement` is fake (views = f(score)+sine jitter, ignores creator reach). Delete that derivation in P1; rebuild in P5 grounded in creator baseline (follower tier/history) × quality read, shown as a range + confidence (R11). Concept is valid; the implementation wasn't.
- **Value > moat:** build the value pillars; corpus is multi-source + matures over time, not a build gate. See VISION.md.
- **Determinism = tolerance band, NOT byte-identity (2026-06-04, P1 01-01 baseline).** Ran the 2-run gate on a fixed video (temp0+seed already live in pass2): `overall_score` **79 vs 78**, behavioral **75 vs 71**, visual stable **82,82**. Drift isolated to wave3 pass2 thinking-mode persona pass × 10 Qwen calls — provider-level nondeterminism temp0+seed can't pin. **R8 amended** → "deterministic within provider noise band"; **D3.2 score-identity reframed** (Plan 06): post-strip score must land in the **78–79 band** on the same video + derivation structurally unchanged (behavioral-40% + visual-35% renorm), not byte-equal. Strip only touches dead paths so it can't move the score; the ±1 is pre-existing noise. Memory: `engine-determinism-gate`.

## Pre-flight findings — resolved (2026-06-03)

1. ✅ **Stale/Remix-blind** → merged `origin/main`; Remix re-scanned + folded (R12, ENGINE-MAP Remix section).
2. ✅ **P1 sequencing** → P1 is now subtractive only; score keeps its existing derivation until P3/P5 (no "rederive from Apollo" before Apollo exists).
3. ✅ **Long-lived branch** → P1 + P2 marked independently shippable to main (ship promptly).
4. ✅ **A/B referee (R10)** → P4 will revive `corpus/eval-harness.ts` + `eval-runner.ts`.
5. ✅ **Score = composite** principle banked in P3.
6. ✅ **Determinism vs creativity** → scoring temp0+seed, rewrite variants may use temp>0 (noted in P3).
7. 🔲 **Corpus v1** → user's parallel track; the long pole for P3. START NOW.

## Next action

**P1 executed + complete** (6/6 plans, 2026-06-04). **P2 PLANNED** (2026-06-04) — research + validation + pattern-map + 3 verified plans (3 waves). Planner picked **persistence Option A** (dedicated `verbatim` JSONB column, mirrors emotion_arc). Plan-checker caught + the planner fixed a real BLOCKER: per-segment `spoken_text`/`on_screen_text` had no persistence path (declared+prompted but dropped before the DB — the segment-axis twin of the emotion_arc bug); now threaded on BOTH the inline shape AND exported `SegmentSchema` → normalizeSegments → aggregator pluck → `VerbatimPayload.segments` → both route inserts → `verbatim->'segments'` real-run proof. VERIFICATION PASSED iteration 2.

- **02-01** (Wave 1) — ✅ COMPLETE (2026-06-04) — schema + prompt contracts + 20-case Wave 0 regression test all GREEN
- **02-02** (Wave 2) — ✅ COMPLETE (2026-06-04) — VerbatimPayload + aggregator pluck/thread + verbatim JSONB migration (live on prod) + db types + both route sites :594/:921 + ENGINE_VERSION 3.2.0
- **02-03** (Wave 3) — ✅ COMPLETE (2026-06-04) — R1 proven on real DB rows (gwxLeHphZCxK: hook+5-seg both axes), R6 ~106s under 300s cap, R12 51/51 green, R8 grep=2; D-02 silent deferred HUMAN-UAT

**P2 COMPLETE.** **SHIPPED 2026-06-05 → PR #13** (`milestone/engine-opt` → `main`, 88 commits, 103 files). Code fully verified; both VERIFICATIONs `human_needed` only for live-env/deferred-UAT reasons — carried as a post-merge checklist in the PR body (R6 latency, R8 determinism, R12 remix smoke, D-02 silence honesty, R1 row reconfirm). Corpus v1 **ready** (`KNOWLEDGE-CORE.md` v1.1 validated) → **P3 unblocked.** Next: merge PR #13, then `/gsd-plan-phase 3` (or `/gsd-discuss-phase 3` for the §8 supersede-vs-merge + rewrites-temp + Remix re-grounding decisions).

**P4-02 COMPLETE (2026-06-05)** — fold LLM layer: `fold-prompts.ts` (byte-stable 10-archetype system prompt + FoldResponseSchema + buildFoldUserContent) + `fold.ts` (single bounded qwen3.6-plus thinking call — the 20→1 fold — with Zod boundary validation, segment-count guard, diversity guard, cache-aware cost telemetry). fold-schema.test.ts 5/5 GREEN. Commits: `42a6e85b` (fold-prompts), `18b8bdc2` (fold).

**P4-03 COMPLETE (2026-06-05)** — fold adapters (real implementations replacing stubs): `adaptFoldToPersonaSimResults` + `adaptFoldToPass2Results` (with niche_deep→niche normalization); aggregator "fold" branch (behavioral aggregate + heatmap from foldOutcome); pipeline `foldOutcome: Wave3FoldOutcome | null` default OFF (ENGINE_USE_FOLD=1); ab-fold-referee @ts-expect-error shim removed. 1826/1826 tests GREEN. Commits: `f289eaf5` (adapters), `bf44f0d3` (aggregator + pipeline).

**P4-04 COMPLETE (2026-06-05)** — ab-fold-referee.ts 3-metric composite: behavioral parity <=5, diversity >=0.8x avgCurveRange, drop-point agreement >=6/10 archetypes; R7 call-count assertion (wave_3_fold=1 vs wave_3_persona_*+wave_3_pass2_persona_*=20); R8 2-runs-per-path averaging; per-video table; advisory overall verdict (REPRODUCE/BEAT/PARTIAL/MISS, D-05 no exit-1 on metric miss); COST_CAP_CENTS wired. tsc zero errors. Commit: `aa3a8428`. Next: `/gsd-execute-phase 4 04-05` — real-API referee run + production-flip human checkpoint.

## Open bets / to verify

- Fold quality (R10): grounded-1 Audience-Sim vs current-20 retention curve — A/B on real videos.
- ✅ **DB row counts (01-01 Task 4):** trending_sounds=0, outcomes=0, scraped_videos=7389 (benign — Plan 03 removes trends.ts call site before Plan 05 dormant move).
- Archetype count in the fold (10 vs ~5).
- `optimal-post.ts`: honest signal or cut.
- Corpus v1: data sources + distillation form + size (→ cached-prompt vs retrieval threshold). Biggest unknown.
- Remix decode/adapt: confirm clean re-grounding on the shared core without breaking `/api/remix/adapt`.
