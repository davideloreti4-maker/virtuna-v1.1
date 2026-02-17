# State — Backend Reliability

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-02-17 — Milestone Backend Reliability started

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-17)

**Core value:** AI-powered content intelligence that tells TikTok creators whether their content will resonate
**Current focus:** Backend reliability — fix broken wiring, improve ML, add observability

## Accumulated Context

- Prediction engine pipeline works (Gemini + DeepSeek + Rules + Trends) but 6 crons are orphaned
- ML classifier at 31% accuracy due to class imbalance (tiers 4/5 never predicted)
- Calibration module built but idle (no outcome data yet)
- Zero test coverage on engine modules
- No error monitoring (Sentry not integrated)
- DeepSeek has Gemini fallback (added 2026-02-17) but other failure modes unhandled
- training-data.json is 2.6MB static file, not regenerated from scraped_videos
- Circuit breaker is per-serverless-instance (module-level state), not distributed
