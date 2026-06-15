---
phase: 04-stage-reveal
status: complete
mode: quick-execution
completed: 2026-06-15
requirements: [REVEAL-01, REVEAL-02]
commit: feat(04) stage-reveal — branded skeleton + real-signal liveness + settle cascade
---

# Phase 4 — Stage-Reveal (SUMMARY)

Executed inline (quick execution, no separate PLAN.md), engine FROZEN, presentation-only.

## Decision that shaped the phase (user-approved)

Literal "each block materializes as its engine stage completes" is **not reachable**:
the live per-stage `stage_start`/`stage_end` events ride the composer's POST body-reader,
which **unmounts** on the `/home → /analyze/[id]` `router.push` (the froze-prone flow), and
the frozen engine never persists stage progress to the DB row. The reconnect SSE route
(`/api/analyze/[id]/stream`) emits only `partial` (personas), `filmstrip_segment_ready`, and
`complete` — no per-stage frames.

→ User chose **Real-signal reveal**: a branded skeleton + liveness from the honest signals
that DO survive, then a calm settle cascade on completion. No fake stage labels.

## What shipped

- `use-reading-reveal.ts` — store-free (NO `useBoardStore`; reading-cluster invariant)
  EventSource consumer of the reconnect stream; surfaces `personaCount` + `keyframeCount` +
  phase. Guarded for SSR/jsdom; degrades cleanly to skeleton→complete when the engine emits
  no mid-flight deltas.
- `reading-skeleton.tsx` — branded in-flight IA (thumbnail → hero gauge+cloud → 3 driver rows
  → Fix First) in the SAME 760px column + gap rhythm as the settled Reading (so the swap
  doesn't thrash). Liveness caption reflects real persona/keyframe progress.
- `reading.tsx` — the bare `ReadingLoading` spinner replaced by `<ReadingSkeleton>` on the
  loading + in-flight branches; on completion the core blocks (hero → rows → Fix First)
  cascade in via the new `.reading-reveal` fade-up, **gated to a prior skeleton** (cold
  permalink reloads appear at rest — no gratuitous animation).
- `globals.css` — `@keyframes reading-reveal` + `.reading-reveal` (0.42s soft fade-up,
  staggered via inline `animation-delay`), with a `prefers-reduced-motion: reduce` → `none`
  guard (belt-and-suspenders with the JS reduced-motion gate).

## Verification

- +8 tests (`reading-reveal.test.tsx`): hook counts (max-monotonic personas, deduped
  keyframes), connect/close lifecycle, skeleton caption reflects real progress.
- `reading.degraded.test.tsx` updated (`reading-loading` → `reading-skeleton`).
- Full suite green; clean build. No engine changes.

## Follow-ups (non-blocking)

- Live UAT (the recurring milestone craft pass) — confirm the skeleton→settle motion reads
  calm on a real ~50s run, mobile + desktop.
