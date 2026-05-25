---
gsd_state_version: 1.0
milestone: engine-hardening
milestone_name: Engine Hardening
status: idle
stopped_at: Phase 17 CLOSED 2026-05-25 — cost_cents renamed to cost_cents_estimated in smoke runner; ready for Phase 18
last_updated: "2026-05-25T00:00:00.000Z"
last_activity: 2026-05-25 -- Phase 17 closed inline: renamed cost_cents → cost_cents_estimated in scripts/smoke-tiktok-pipeline.ts (SmokeResult type + 11 touch points). CALIB-04 closed as estimate-from-tokens (billing API deferred while omni is free). tsc clean. Ready for Phase 18.
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 6
  completed_plans: 3
  percent: 40
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-24)
See: .planning/MILESTONE.md (immutable worktree identity)

**Core value:** AI-powered content intelligence that tells TikTok creators whether their content will resonate.
**Current focus:** Phase 18 — M1 Verification Debt Closure (next up)

## Current Position

Milestone: Engine Hardening (M2-1b of Intelligence Surface drop)
Phase: 17 (smoke-runner-live-billing-wiring) — **COMPLETE 2026-05-25**
Plan: closed inline (no separate plan needed — single 10-line rename)
Status: Idle — Phase 17 done; ready to start Phase 18
Last activity: 2026-05-25 -- Phase 17 closed: renamed `cost_cents` → `cost_cents_estimated` in smoke runner output schema. CALIB-04 closed. Phase 18 (VERIF debt closure) is next.

Progress: [██░░░░░░░░] 40% (2/5 phases complete)

**Phase range this milestone:** 14-18 (continues from M1 Engine Foundation's Phase 13)

**Parallelization shape:** Phases 14, 15, 16, 17 fork in parallel from the milestone branch base. Phase 18 sequences last (depends on 14-17 landing + live-deploy state).

## Performance Metrics

**Velocity:**

- Total plans completed: 2
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 14 | 2 | - | - |

**Recent Trend:**

- No plans complete yet

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table and MILESTONE.md "Stack decisions" block.
Recent decisions affecting current work:

- MILESTONE.md: Embedding model locked to DashScope `text-embedding-v3` (768-dim); no Gemini fallback
- MILESTONE.md: Calibration storage reuses `platt_parameters` schema + adds `engine_version` discriminator (preserves M1 text-mode row as historical reference)
- Phase 17: `cost_cents` renamed → `cost_cents_estimated` in smoke runner output schema (CALIB-04 closed 2026-05-25; billing API deferred while omni is free)
- MILESTONE.md: TS errors default path is **write the migration** (option a); rip out (option b) only if call-site audit shows the routes are dead
- MILESTONE.md: Qwen-only engine migration locked at M1 closure — do not revisit provider choice
- MILESTONE.md: M1 pipeline treated as locked — additive-only rule applies (calibration/threshold work touches calibration.ts + aggregator.ts but does not rewrite the pipeline)

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

[Issues that affect future work]

- Phase 14: `user_settings` consumer audit must conclude before path a vs path b can be chosen (soft dep flagged in MILESTONE.md)
- Phase 16: DashScope embedding API quota fit for ~50 sounds/day × 768-dim batch is a soft dep — confirmed in AUDIO-05

## Deferred Items

Items carried forward from M1 Engine Foundation close (now the active scope of this milestone):

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Calibration | Platt refit on Qwen corpus | Active (Phase 15) | M1 close 2026-05-24 |
| Calibration | Stratified validation rerun | Active (Phase 15) | M1 close 2026-05-24 |
| Calibration | Wave 3/4 threshold re-tune | Active (Phase 15) | M1 close 2026-05-24 |
| Calibration | Smoke runner DashScope billing | ~~Active~~ **CLOSED 2026-05-25** — renamed cost_cents→cost_cents_estimated | M1 close 2026-05-24 |
| Audio | embedder.ts implementation | Deferred (Phase 16 → future milestone) | 2026-05-25 |
| Audio | audio-fingerprint.ts re-enable | Deferred (Phase 16 → future milestone) | 2026-05-25 |
| Audio | D-F4 cron re-enable | Deferred (Phase 16 → future milestone) | 2026-05-25 |
| Audio | 17 `.skip` tests | Deferred (Phase 16 → future milestone) | 2026-05-25 |
| Types | 966 TS errors in api/{profile,settings,team}/* | Active (Phase 14) | Pre-existing blocker |
| Verification | M1 Phases 2/3/4/6 deferrals | Active (Phase 18) | M1 close 2026-05-24 |

## Session Continuity

Last session: 2026-05-25T00:00:00.000Z
Stopped at: Phase 17 closed inline
Resume file: .planning/phases/17-smoke-runner-live-billing-wiring/17-CONTEXT.md
