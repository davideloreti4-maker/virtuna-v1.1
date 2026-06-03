---
gsd_state_version: 1.0
milestone: apollo
milestone_name: Apollo
status: planning
last_updated: "2026-06-03T00:00:00.000Z"
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md · Milestone identity: .planning/MILESTONE.md · Cut-list SSOT: .planning/ENGINE-MAP.md

## Current Position

**Milestone worktree** `~/virtuna-engine-opt/` on `milestone/engine-opt`. Milestone **Apollo** — turn the ~25-call score machine into a 3-call knowledge-grounded expert (Omni → Audience-Sim → Apollo Reasoner).

Engine teardown **complete** (S0–S19, 2026-06-03) → `ENGINE-MAP.md`. Milestone formalized: MILESTONE.md + REQUIREMENTS.md + ROADMAP.md written. **No phase plans yet.**

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | Strip to Senses | not started |
| 2 | Omni Verbatim | not started |
| 3 | Apollo Reasoner (Brain 1, the moat) | not started — blocked on Chase Hughes corpus |
| 4 | Audience-Sim Fold (Brain 2, the bet) | not started |
| 5 | Wire + Surface | not started |

## Next action

- `/gsd-plan-phase 1` to produce the Phase 1 PLAN.md (strip-to-senses — low-risk, corpus-independent, start-able now), **or**
- pin down the **Chase Hughes corpus** (the P3 moat dependency) in parallel.

## Open bets / to verify

- Fold quality (R10): grounded-1 Audience-Sim vs current-20 retention curve — A/B on real videos.
- Cheap DB check: trending_sounds / scraped_videos / outcomes row counts (expected 0).
- Archetype count in the fold (10 vs ~5).
- `optimal-post.ts`: honest signal or cut.
- Chase Hughes corpus: data + distillation form (biggest unknown).
