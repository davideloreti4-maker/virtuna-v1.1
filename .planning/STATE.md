---
gsd_state_version: 1.0
milestone: v3.2
milestone_name: Viral Remix
status: ready_to_plan
last_updated: 2026-06-02T09:16:04.061Z
last_activity: 2026-06-02
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 10
  completed_plans: 10
  percent: 60
stopped_at: Phase 04 complete (4/4) — ready to discuss Phase 5
---

# Project State

## Project Reference

See: .planning/PROJECT.md

## Current Position

Phase: 5
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
- Plan 04-01: AdaptInput uses Pick<DecodeOutput, 4 structural fields + repeatable> & {niche} — omits luck[] and caption (D-01 structural content-leak guard)
- Plan 04-01: DECODE_FIXTURE uses format-only language (no topic nouns) to enable no-caption-leak test assertions in plan 04-02
- Plan 04-01: Wave 0 uses it.todo (not it.skip) — suite reports todo count without false-red failures
- Plan 04-02: Zod v4 UUID strictness: test fixture UUIDs must use valid version/variant bits (e.g. v4 format like 550e8400-e29b-41d4-a716-446655440000), not all-zeros UUIDs
- Plan 04-02: vi.hoisted() required for all vi.mock factory variables in vitest v4 to avoid temporal dead zone ReferenceError at module load time

## Session Continuity

Last session: 2026-06-02T09:07:16.858Z

Next: Phase 04 Plan 03 — AdaptFrameBody component (UI wave).
