---
gsd_state_version: 1.0
milestone: v3.2
milestone_name: Viral Remix
status: executing
last_updated: "2026-06-01T15:05:00.000Z"
last_activity: 2026-06-01 -- Plan 03 (engine wiring + derive-and-drop) complete — INGEST-01 hard gate CLOSED
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
  percent: 20
---

# Project State

## Project Reference

See: .planning/PROJECT.md

## Current Position

Phase: 01-ingestion-build-hard-gate — COMPLETE (3/3 plans done)
Status: Phase 1 complete — INGEST-01 hard gate CLOSED. Phase 2 (Remix Mode) unblocked.
Last activity: 2026-06-01 -- Plan 03 (engine wiring + derive-and-drop) complete — INGEST-01 hard gate CLOSED

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

## Session Continuity

Last session: 2026-06-01 -- Plan 03 (engine wiring) complete. tiktok_url Omni branch added to pipeline.ts (Option B re-host + derive-and-drop). 3+3 new tests green. 1706 tests passing. INGEST-01 hard gate CLOSED. Phase 1 complete.

Next: Phase 2 -- Remix Mode + One-Board-Two-Config (REMIX-01, REMIX-02).
