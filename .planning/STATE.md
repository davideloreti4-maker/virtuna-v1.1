---
gsd_state_version: 1.0
milestone: v3.2
milestone_name: Viral Remix
status: pr-open
stopped_at: "Milestone SHIPPED to PR #6 (milestone/viral-remix-pr → main, MERGEABLE, claude-review running). Discovery: feat/actions-frame-inline-redesign was ALREADY merged to main via PR #5, so the 'merge feat first' note in MILESTONE.md is obsolete. PR is a squashed code-only branch (61 files, +7631/-58, zero .planning); 3-way merged vs main, only route.ts needed manual reconcile (stage-11 defer + decode branch both kept — additive). Cherry-pick was abandoned: milestone history contains the P3↔P4 reconciliation merge that linear cherry-pick can't preserve. Next: await claude-review, then merge PR #6 → /gsd-complete-milestone."
last_updated: "2026-06-02T18:35:00.000Z"
last_activity: 2026-06-02
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 17
  completed_plans: 17
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md

## Current Position

Phase: 05 (develop-predict-lineage) — COMPLETE ✅ (all 5 phases done, 100%)
Plan: 4 of 4 complete; UAT 8/9 passed; security 12/12 threats CLOSED
Status: Milestone phases complete — ready for close-out (verify → audit → ship)
Last activity: 2026-06-02

Roadmap shape (see `.planning/ROADMAP.md`):

1. Ingestion BUILD (HARD GATE) — INGEST-01 ← COMPLETE (3/3 plans done)
2. Remix Mode + One-Board-Two-Config — REMIX-01, REMIX-02 ← COMPLETE (3/3)
3. Decode Frame — DECODE-01, DECODE-02 ← COMPLETE (3/3)
4. Adapt Frame + Niche — ADAPT-01, ADAPT-02 ← COMPLETE (4/4)
5. Develop & Predict + Lineage — DEVELOP-01, DEVELOP-02 ← NEXT

Phase 1 hard gate is CLOSED: tiktok_url now produces real Omni segments via Supabase re-host + derive-and-drop. Phases 2-5 are UNBLOCKED.

Phases 3 and 4 were built in parallel worktrees (milestone/viral-remix = Decode, milestone/viral-remix-adapt = Adapt) and merged here. The Decode↔Adapt contract was reconciled at merge: `DecodeResult` is canonical; Adapt consumes it via the `decodeResultToAdaptInput` adapter in `adapt.ts`.

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
- Plan 04-01: AdaptInput carries the 4 structural beats + repeatable lane + niche — omits luck[] and caption (D-01 structural content-leak guard)
- Plan 04-01: DECODE_FIXTURE uses format-only language (no topic nouns) to enable no-caption-leak test assertions in plan 04-02
- Plan 04-01: Wave 0 uses it.todo (not it.skip) — suite reports todo count without false-red failures
- Plan 04-02: Zod v4 UUID strictness: test fixture UUIDs must use valid version/variant bits (e.g. 550e8400-e29b-41d4-a716-446655440000), not all-zeros UUIDs
- Plan 04-02: vi.hoisted() required for all vi.mock factory variables in vitest v4 to avoid temporal dead zone ReferenceError at module load time
- Merge (3+4): DecodeResult is the canonical decode payload; Adapt's invented DecodeOutput dropped. `decodeResultToAdaptInput` adapter bridges beats→flat fields + repeatable string[]→RepeatableItem[]; luck never mapped in (D-01 preserved)
- Plan 05-03: ?summary branch runs after user_id-scoped SELECT — ownership enforcement inherited, forged parent_id 404s (T-05-06)
- Plan 05-03: POLLING_CEILING_MS = 360_000 as named constant — D-13, explicit and grep-discoverable
- Plan 05-03: Live-poll gate explicitly NOT claimed as permalink-reload fix; comment cites Phase 3 DecodeShellNode dual-read as the correct site
- Plan 05-03: isRemix derived inline in Sidebar render — sole consumer, cast already there
- Plan 05-04: FrameErrorBoundary is a class component (React requirement for getDerivedStateFromError); no external dep (T-05-SC)
- Plan 05-04: Fallback shows generic '{frame} couldn't render' only — no stack/PII rendered (T-05-10)
- Plan 05-04: Score-mode frames NOT wrapped in FrameErrorBoundary — minimal scope, D-14 regression surface clean
- Plan 05-04: AdaptConceptCard Develop trigger: py-3 added for ≥44px mobile tap target

## Session Continuity

Last session: 2026-06-02T12:30:00.000Z

Stopped at: Phase 5 plan 4 tasks 1-3 complete — FrameErrorBoundary, Raycast sweep, regression gate (1840 tests green). Task 4 is a blocking human-verify checkpoint.
Next: Human approves Task 4 checkpoint (8-step Develop loop verification on running app) → phase complete
