---
phase: 05-follow-up
status: complete
mode: quick-execution
completed: 2026-06-15
requirements: [CHAT-01, CHAT-02]
deferred: [DEMO-01]
commit: feat(05) follow-up chat tail — pinned composer + Ask-the-expert thread
---

# Phase 5 — Follow-up & Demo (SUMMARY)

Executed inline (quick execution), engine FROZEN, chat backend reused verbatim.

## Scope decision (user)

**DEMO-01 descoped** from v5.0 at the user's direction during milestone close. Phase 5 ships
the follow-up loop only. DEMO-01 carried to a later milestone (REQUIREMENTS marked Deferred).

## What shipped (CHAT-01 / CHAT-02)

- `follow-up-context.tsx` — `FollowUpProvider` holds one `useExpertChat({ analysisId })`
  instance + the shared composer `draft`, exposed via `useFollowUp()`. Single source so the
  composer (sends) and the tail (displays) share state; chips seed the draft.
- `follow-up-thread.tsx` — the inline Q&A tail below the Reading (user/assistant turns,
  live streaming turn, error), plus the quick-action chips that **seed** (not auto-send) a
  prompt into the composer. Flat-warm matte (coral reserved for the user turn).
- `reading-thread.tsx` — the `/analyze/[id]` client shell: `FollowUpProvider` wrapping
  `Reading` + `FollowUpThread` + the bottom-pinned `Composer`. **Gated** to a completed
  Simulation (you can't ask about a still-loading Reading); reuses the deduped
  `usePermalinkAnalysis` query (no extra fetch). No-id `/analyze` base stays inert.
- `composer.tsx` — follow-up mode: when pinned **and** inside a `FollowUpProvider`, text
  routes to `useExpertChat.send` (NOT a new analysis), the input binds to the shared draft,
  the `+` upload is hidden (text-only follow-up for v1), and send locks while streaming.
  On `/home` (no provider) it stays the analysis composer — unchanged.
- `analyze/layout.tsx` — mounts `<ReadingThread>` instead of `<Reading>`.

No separate chat dock; the bottom-pinned composer IS the follow-up input (per brief).

## Verification

- +11 tests: `follow-up.test.tsx` (routes to expert / disabled-empty / hides upload /
  renders turns / streaming turn / chip seeds draft) + `reading-thread.test.tsx` (gating:
  complete → tail+composer; in-flight/failed/no-id → none).
- Existing composer suites still green (no provider → analysis mode unchanged).
- Full suite 2102 green; clean build. No engine/API change.

## Follow-ups (non-blocking)

- Live UAT — confirm the follow-up send + streaming render on a real Simulation, mobile +
  desktop, and the pinned composer's sticky-bottom behaviour with the sidebar offset.
