# Milestone: Backend Reliability

**Branch:** milestone/backend-reliability
**Worktree:** /Users/davideloreti/virtuna-backend-reliability
**Created:** 2026-02-17

## Objective
Fix, wire, and harden the prediction engine — schedule 6 orphaned cron jobs, rehabilitate the ML classifier to >75% accuracy, wire Platt calibration into live scoring, add Sentry + structured logging, build test coverage for all engine modules, and close edge-case fragility.

## Tiers
1. **Broken wiring** — built modules never called (crons not scheduled, ML not in aggregator)
2. **Missing observability** — zero tests, no Sentry, no structured logging
3. **Data quality** — ML at 31% accuracy, static training data, calibration idle
4. **Edge-case fragility** — calibration file parsing, LLM double-failure, circuit breaker races
