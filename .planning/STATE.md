---
gsd_state_version: 1.0
milestone: apollo
milestone_name: Apollo
status: planning
last_updated: "2026-06-04T10:27:00.801Z"
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 6
  completed_plans: 6
  percent: 20
---

# Project State

## Project Reference

See: .planning/PROJECT.md · Milestone identity: .planning/MILESTONE.md · Cut-list SSOT: .planning/ENGINE-MAP.md

## Current Position

Phase: 01 (strip-to-senses) — EXECUTING
Plan: 6 of 6 (01-01, 01-02, 01-03 COMPLETE)
**Milestone worktree** `~/virtuna-engine-opt/` on `milestone/engine-opt`. Milestone **Apollo** — turn the ~25-call score machine into a 3-call knowledge-grounded expert (Omni → Audience-Sim → Apollo Reasoner).

Engine teardown **complete** (S0–S19, 2026-06-03) → `ENGINE-MAP.md`. Milestone formalized. **Synced with `origin/main` (merged in Remix PR #6 + audience change) — branch was stale + blind to Remix.** Re-scanned Remix engine path; folded into the plan (Remix = Apollo modes, R12). **No phase plans yet.**

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | Strip to Senses | context gathered (2026-06-04) — ready to plan |
| 2 | Omni Verbatim | not started |
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

**P1 context captured** (`.planning/phases/01-strip-to-senses/01-CONTEXT.md`, 2026-06-04). Decisions D1–D4 locked + 15-item reverification checklist (D5). Also fixed: ROADMAP headings (em-dash→colon, SDK now parses) + archived stale pre-Apollo P1 to `.planning/_archive/`.

`/clear` then → `/gsd-plan-phase 1` (Strip to Senses — subtractive: delete fabricated stats [sine-jitter engagement + "top X%" labels], dormant dead machinery, cut dead blend keys + prove score-identity, null-degrade UI; keep score derivation unchanged; independently shippable). In parallel: begin distilling corpus v1 (gates P3).

## Open bets / to verify

- Fold quality (R10): grounded-1 Audience-Sim vs current-20 retention curve — A/B on real videos.
- ✅ **DB row counts (01-01 Task 4):** trending_sounds=0, outcomes=0, scraped_videos=7389 (benign — Plan 03 removes trends.ts call site before Plan 05 dormant move).
- Archetype count in the fold (10 vs ~5).
- `optimal-post.ts`: honest signal or cut.
- Corpus v1: data sources + distillation form + size (→ cached-prompt vs retrieval threshold). Biggest unknown.
- Remix decode/adapt: confirm clean re-grounding on the shared core without breaking `/api/remix/adapt`.
