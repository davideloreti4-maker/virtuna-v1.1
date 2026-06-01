---
phase: 01-ingestion-build-hard-gate
plan: 01
subsystem: ingestion
tags: [apify, clockworks, tiktok, qwen-omni, spike, ssrf]

requires:
  - phase: none
    provides: first plan of milestone
provides:
  - "Confirmed live Apify→Omni ingestion contract (A1-A5 resolved)"
  - "mediaUrls[0] confirmed as the mp4 field Plan 02 adds to apifyVideoSchema"
  - "Resolved URL is a private api.apify.com KV record (SSRF allowlist host = api.apify.com)"
  - "Failure case shape: deleted/private = count=1 item with error/errorCode keys, NOT empty dataset"
  - "Plan 03 strategy: inline resolve (~60-75s << 300s) + Supabase re-host with derive-and-drop (security, not TTL)"
  - "A4 verdict: Omni hook fidelity sufficient — no separate Qwen ASR in Phase 1/3"
affects: [02-single-url-resolver, 03-engine-wiring, decode-phase]

tech-stack:
  added: []
  patterns:
    - "Token-scoped Apify KV URL fetch (?token=) proven; rejected for prod in favor of re-host"
    - "C1 caption-hallucination guard via two-video structural differential"

key-files:
  created:
    - .planning/phases/01-ingestion-build-hard-gate/01-INGESTION-SPIKE.md
  modified: []

key-decisions:
  - "Plan 02 apifyVideoSchema mp4 field = mediaUrls[0] (confirmed live, not assumed)"
  - "SSRF allowlist must include api.apify.com (resolved host is Apify KV, not TikTok CDN)"
  - "Plan 03 re-hosts to Supabase + derive-and-drop for SECURITY (token non-leak), not TTL — KV record persists days"
  - "Resolve runs INLINE: resolve(25-38s)+Omni(35s) ~= 60-75s, well under maxDuration=300"
  - "No ASR in Phase 1 — Omni first_words_speech_score + content_summary fidelity is sufficient"

patterns-established:
  - "Deleted/private detection: branch on item.error/item.errorCode BEFORE mediaUrls extraction"
  - "Derive-and-drop honored even in spike: no mp4 persisted, throwaway scripts deleted"

requirements-completed: [INGEST-01]

duration: 45min
completed: 2026-06-01
---

# Phase 01 Plan 01: Ingestion Spike Summary

**Live Clockworks→Qwen-Omni ingestion contract confirmed end-to-end — `mediaUrls[0]` is a private `api.apify.com` KV URL, fetchable only with token; two structurally-different videos produced materially different real Omni signal (C1 guard passed), closing the hard gate.**

## Performance

- **Duration:** ~45 min (incl. dep install + Apify billing/token detours)
- **Completed:** 2026-06-01T12:36Z
- **Tasks:** 4 (1 human-action checkpoint resolved by developer; 3 auto)
- **Files created:** 1 (the gating artifact)

## Accomplishments
- Resolved A1–A5: confirmed input key, `mediaUrls[0]` field, TTL (days, token-scoped), latency (~60–75s inline), Omni fidelity (ASR deferred).
- Proved real (not caption-hallucinated) Omni signal via a two-video C1 differential (comedy 6 segs / 16.8s vs tutorial 7 segs / 59s; distinct content_type, niche, hook profile, summaries naming visual specifics).
- Discovered the resolved mp4 is a **private** Apify KV record (anon 403 / `?token=` 200 `video/mp4`) — directly shapes Plan 02's SSRF allowlist (`api.apify.com`) and Plan 03's re-host-vs-passthrough decision.
- Documented the deleted/private failure shape (count=1 with `error`/`errorCode`) → Plan 02 typed-error classifier.

## Files Created/Modified
- `.planning/phases/01-ingestion-build-hard-gate/01-INGESTION-SPIKE.md` — the gating artifact (7 required sections; A1–A5 resolution table).

## Decisions Made
See `key-decisions` frontmatter. Headline: Plan 03 should **re-host to Supabase with derive-and-drop** — not for TTL (KV record persists days) but to avoid leaking a full-access Apify token to DashScope; this reuses the proven signed-URL Omni path.

## Deviations from Plan
- **≥5-URL matrix not fully met (honest gap).** Only 2 live canonical URLs + 1 fabricated 404 were available (developer supplied 2). `vm.` short link, region-locked, photo carousel, and private-account classes were NOT live-tested — their taxonomy rows are marked **inferred**, not confirmed, in the artifact §3. The *critical* unknowns (A1–A5, C1, the core deleted/private failure shape) ARE confirmed, so the gate is meaningfully closed; a follow-up micro-spike can confirm the remaining classes if Plan 02 needs their exact shapes.
- **Token/billing detour (not scope creep).** This worktree had no `node_modules` (ran `pnpm install`), a truncated/invalid `APIFY_TOKEN`, and no `DASHSCOPE_API_KEY`. Copied DASHSCOPE from the main worktree and used a developer-supplied funded Apify token. All creds in gitignored `.env.local`.

## Issues Encountered
- First Apify token invalid ("user not found"); second (main's) was a near-exhausted FREE account ($0.058 left). Resolved with a developer-supplied funded token.
- Initial Omni calls failed `400 Failed to download multimodal content` — root cause was the private KV record (missing `?token=`), not a format/TTL issue. Confirmed by anon-403 / token-200 probe.

## User Setup Required
`.env.local` in this worktree now holds `APIFY_TOKEN` (funded) + `DASHSCOPE_API_KEY` (copied from main). Both gitignored. Plans 02/03 read the same env.

## Next Phase Readiness
- **Plan 02 unblocked:** add `mediaUrls` to `apifyVideoSchema`, `resolveVideoUrl()` returns the private KV URL, classify `error`/`errorCode` items, SSRF allowlist `api.apify.com`.
- **Plan 03 unblocked:** inline resolve + Supabase re-host (derive-and-drop) + feed signed URL to existing `analyzeVideoWithOmni`.
- The hard gate is CLOSED: a non-owned URL demonstrably yields real Omni segments.

---
*Phase: 01-ingestion-build-hard-gate*
*Completed: 2026-06-01*
