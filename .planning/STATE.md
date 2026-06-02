---
gsd_state_version: 1.0
milestone: v3.2
milestone_name: Viral Remix
status: ready_to_plan
last_updated: 2026-06-02T09:19:53.750Z
last_activity: 2026-06-02
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 9
  completed_plans: 9
  percent: 60
stopped_at: Phase 03 complete (3/3) — ready to discuss Phase 04
---

# Project State

## Project Reference

See: .planning/PROJECT.md

## Current Position

Phase: 04
Plan: Not started
Status: Ready to plan
Last activity: 2026-06-02

Roadmap shape (see `.planning/ROADMAP.md`):

1. Ingestion BUILD (HARD GATE) — INGEST-01 ← COMPLETE (3/3 plans done)
2. Remix Mode + One-Board-Two-Config — REMIX-01, REMIX-02 ← NEXT
3. Decode Frame — DECODE-01, DECODE-02
4. Adapt Frame + Niche — ADAPT-01, ADAPT-02
5. Develop & Predict + Lineage — DEVELOP-01, DEVELOP-02

Phase 1 hard gate is CLOSED: tiktok_url now produces real Omni segments via Supabase re-host + derive-and-drop. Phases 2-5 are UNBLOCKED.

## Decisions

- Plan 01: mediaUrls[0] confirmed as mp4 field; resolved URL is private api.apify.com KV record
- Plan 01: SSRF allowlist must include api.apify.com (resolved host is Apify KV, not TikTok CDN)
- Plan 01: Plan 03 re-hosts to Supabase with derive-and-drop for SECURITY (token non-leak), not TTL
- Plan 01: Resolve runs INLINE (resolve ~25-38s + Omni ~35s = 60-75s << maxDuration=300)
- Plan 01: No ASR in Phase 1 — Omni first_words_speech_score + content_summary fidelity sufficient
- Plan 02: IngestError kind taxonomy = empty_dataset | no_media_url | not_found | ssrf_rejected | scrape_failed
- Plan 02: not_found detected via item.error/item.errorCode BEFORE mediaUrls extraction
- Plan 02: SSRF allowlist: .apify.com, .apifyusercontent.com, .tiktokcdn.com, .tiktokcdn-us.com
- Plan 03: Option B (Supabase re-host) chosen — token non-leakage to DashScope/Alibaba is the security requirement
- Plan 03: signedVideoUrl variable reused (not renamed) — minimal-diff avoids partial-rename hazard at 5 read sites
- Plan 03: derive-and-drop runs INLINE — resolve+Omni ~70-90s << maxDuration=300 (spike §5 verdict)
- Plan 03: No second rate limiter — existing DAILY_LIMITS/429 branch at route.ts:296-310 is mode-agnostic
- Phase 3 Plan 01: runDecode returns exactly 4 beats in fixed BEAT_IDS order; Zod + runtime assertion both enforce (D-06)
- Phase 3 Plan 01: resolveAndRehost extracts pipeline.ts:529-609 derive-and-drop hop; pipeline.ts left unchanged (Plan 02 is first consumer)
- Phase 3 Plan 01: improvement_tip omitted from buildDecodeContext (advice-voiced, D-06); documented in comment
- Phase 3 Plan 02: early-return ReadableStream for remix branch keeps score-path start() body byte-for-byte identical; no interleaving risk
- Phase 3 Plan 02: existing placeholder INSERT reused for remix row (mode:validated.mode='remix' + overall_score:null already correct; no video_storage_path)
- Phase 3 Plan 02: cleanup() in finally of runDecodeStream inner try — unconditional execution even on Omni/runDecode throw (C4 derive-and-drop)
- Phase 3 Plan 03: beat order enforced via beatMap.get(id) loop over BEAT_IDS — deterministic regardless of LLM array order
- Phase 3 Plan 03: m3 fallback reads permalinkData.variants.remix.decode directly — bypasses use-analysis-stream short-circuit (gates on overall_score != null; null on decode rows)
- Phase 3 Plan 03: vi.fn() cast for mock pattern — avoids TS2352 on AnalysisStreamReturn shape; matches ContentAnalysisFrame.test.tsx convention

## Session Continuity

Last session: 2026-06-02T11:00:00Z

Stopped at: Completed 03-03-PLAN.md — DecodeShellNode frame body; Phase 3 complete
Next: Phase 4 (Adapt Frame + Niche) — /gsd-plan-phase 4
