---
gsd_state_version: 1.0
milestone: apollo
milestone_name: Apollo
status: ready_to_plan
last_updated: 2026-06-05
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 9
  completed_plans: 9
  percent: 40
stopped_at: P1+P2 SHIPPED → PR #13 (milestone/engine-opt → main); ready to plan Phase 3 (corpus v1 ready)
---

# Project State

## Project Reference

See: .planning/PROJECT.md · Milestone identity: .planning/MILESTONE.md · Cut-list SSOT: .planning/ENGINE-MAP.md

## Current Position

Phase: 3
Phase: 03 (Apollo Reasoner) — NOT STARTED (blocked on corpus v1)
Last completed plan: 02-03
**Milestone worktree** `~/virtuna-engine-opt/` on `milestone/engine-opt`. Milestone **Apollo** — turn the ~25-call score machine into a 3-call knowledge-grounded expert (Omni → Audience-Sim → Apollo Reasoner).

Engine teardown **complete** (S0–S19, 2026-06-03) → `ENGINE-MAP.md`. Milestone formalized. **Synced with `origin/main` (merged in Remix PR #6 + audience change) — branch was stale + blind to Remix.** Re-scanned Remix engine path; folded into the plan (Remix = Apollo modes, R12). **No phase plans yet.**

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | Strip to Senses | COMPLETE (2026-06-04) — 6/6 plans done |
| 2 | Omni Verbatim | COMPLETE (2026-06-04) — 3/3 plans done; R1 proven on real run (gwxLeHphZCxK); D-02 silent deferred HUMAN-UAT |
| 3 | Apollo Reasoner (Brain 1, the moat) | not started — blocked on Chase Hughes corpus |
| 4 | Audience-Sim Fold (Brain 2, the bet) | not started |
| 5 | Wire + Surface | not started |

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

## Open bets / to verify

- Fold quality (R10): grounded-1 Audience-Sim vs current-20 retention curve — A/B on real videos.
- ✅ **DB row counts (01-01 Task 4):** trending_sounds=0, outcomes=0, scraped_videos=7389 (benign — Plan 03 removes trends.ts call site before Plan 05 dormant move).
- Archetype count in the fold (10 vs ~5).
- `optimal-post.ts`: honest signal or cut.
- Corpus v1: data sources + distillation form + size (→ cached-prompt vs retrieval threshold). Biggest unknown.
- Remix decode/adapt: confirm clean re-grounding on the shared core without breaking `/api/remix/adapt`.
