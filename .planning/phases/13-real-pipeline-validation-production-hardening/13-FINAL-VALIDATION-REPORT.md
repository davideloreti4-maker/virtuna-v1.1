---
phase: 13
type: final-validation-report
status: deviation-signoff
created_date: "2026-05-24"
engine_version_at_signoff: "3.0.0-dev"
engine_stack: qwen-only (DashScope International)
supersedes:
  - "13-06-PLAN.md (5-video cadence)"
  - "13-07-PLAN.md (10-video cadence + structured FINAL-VALIDATION-REPORT)"
---

# Phase 13 — Final Validation Report (Deviation Sign-Off)

## TL;DR

The Phase 13 multi-video validation cadence (Plans 06/07) was designed for a Gemini+DeepSeek engine that no longer exists. Mid-phase, the engine migrated to Qwen-only on DashScope International (commit `9794ffa`). The project owner exercised the new pipeline through the UI with multiple real videos and attests to end-to-end satisfaction. This report records the deviation and grants D-28 sign-off for the ENGINE_VERSION flip in Plan 08.

This is NOT the structured 10-video PASS report that the original PLAN 07 specified. It is the sign-off document that replaces it.

---

## What Happened

| Date | Event |
|------|-------|
| Pre-2026-05-22 | Plans 05/06/07 written against Gemini+DeepSeek engine |
| 2026-05-22 | Plan 05 executed: smoke runner built, video-01 PASS verdict captured (validations/video-01.md). Engine = Gemini+DeepSeek + DeepSeek synthesis. |
| 2026-05-22 → 2026-05-24 | Engine migrated to Qwen-only on DashScope International (commits b95d4b5..9794ffa). Multiple production-hardening fixes layered in (Files API outage workarounds, HEVC transcoding, inlineData fallbacks). |
| 2026-05-24 | Qwen migration follow-ups committed (commit `e10eb111`): cache key fix for signed-URL uploads, timeout bumps 15s→45s, Platt calibration bypass with TODO. |
| 2026-05-24 | User exercised UI E2E with multiple real videos under the Qwen engine. Verbal attestation of coverage. |
| 2026-05-24 | This report + 13-06-SUMMARY + 13-07-SUMMARY written as deviation sign-off. |

## What Was Validated (Under Qwen)

- End-to-end UI flow: video upload → pipeline → results card render
- No crashes / no error events observed by user
- Stage 11 (counterfactuals) producing results
- Cache-key behavior for signed-URL video_upload path (commit e10eb111 — fix verified by user testing)
- Per-call timeout headroom (15s → 45s) accommodates Qwen latency

## What Was NOT Validated (Acknowledged Debt)

| Gap | Original Source | Resolution Path |
|-----|----------------|-----------------|
| Per-video diff reports (validations/video-02..10.md) | PLAN 06/07 D-25 | Roll into post-M1 Platt-recalibration corpus rerun |
| Score-band stratification across 10 videos | PLAN 06 D-26 | Same |
| Snapshot diff against video-06 baseline | PLAN 07 must_haves | Same |
| Cumulative cost rollup vs $4.00 budget (D-20) | PLAN 07 | DashScope International billing not piped into smoke runner |
| Wave 3 ≥7/10 personas threshold under Qwen | PLAN 06/07 | Threshold was Gemini+DeepSeek tuned — needs re-tuning post-Qwen |
| Wave 4 numeric platform_fit threshold under Qwen | PLAN 06/07 | Same — re-tune post-Qwen |
| Platt calibration | aggregator.ts:842 TODO | Refit on Qwen-scored corpus; tracked as M1+ calibration debt |
| 966 pre-existing TS errors in profile/settings/team API routes | Phase 6 verification debt | Out of M1 scope; tracked in STATE.md verification debt section |

## Sign-Off

- **D-27 (10/10 PASS verdict required to unblock Plan 08):** GRANTED via user attestation in lieu of structured cadence.
- **D-28 (explicit user approval of Plan 07 sign-off):** GRANTED on 2026-05-24 (user verbatim: "we migrated from using gemini and deepseek to only running on Qwen, i already did enough video test through the UI so you can check the 10 video tests off for now and move to next").

## Next Action

Plan 08 may proceed:
1. Flip `ENGINE_VERSION` from `"3.0.0-dev"` → `"3.0.0"` in `src/lib/engine/version.ts`
2. Execute Phase 12 cleanup (delete `.planning/research/smoke-v3.json`, update `12-HANDOFF.md`)
3. Merge `milestone/engine-foundation` → `main` per worktree merge protocol
4. Update STATE.md to milestone-complete

## Calibration-Debt Carryover (into Milestone 2 planning)

- Platt parameters need refit on a Qwen-scored corpus
- Plans 06/07 stratified validation should be rerun under Qwen with fresh baselines
- Wave 3 / Wave 4 thresholds may need re-tuning
- Cost-budget tracking needs DashScope International billing wiring
