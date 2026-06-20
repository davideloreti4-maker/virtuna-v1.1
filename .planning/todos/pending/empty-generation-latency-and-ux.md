---
id: empty-generation-latency-and-ux
title: "Ideas/Hooks generation: 3–4 min latency + silent empty result with no empty-state UX"
type: bug
severity: medium
created: 2026-06-20
source: Phase 14 live UAT
resolves_phase: null
area: tools/runners (ideas, hooks) / composer UI
---

## Symptom (observed live, Phase 14 UAT)

A live Ideas and a live Hooks generation each ran **3.4–4.0 min**, returned HTTP 200, persisted
**0 messages**, rendered **0 cards**, and logged **0 diagnostics**. The UI returned to the ready
greeting with no "nothing passed the bar" feedback.

## What it is NOT

- NOT the WR-01 critic-infra path — that was fixed in `e97938fb` (abstention → band-only + warn).
  Confirmed: the empty persisted **even after** the WR-01 fix, so band-only survivors would have
  shipped if the cause were critic abstention. It wasn't.

## Candidate causes (can't be distinguished without server-side stage logging)

1. **Structured generation returned empty** — `generateIdeasStructured` / `generateHooksStructured`
   (Qwen reasoning model) timing out or returning [] under a slow/degraded DashScope backend; the
   3–4 min is that call. `firstBatch.length === 0` → early return, nothing persisted.
2. **Gate legitimately rejected a weak batch** — all candidates Weak-band or genuine critic-fail →
   0 survivors. This is the *intended* "the gate can finally say no" (Phase 14 goal), but with no UX.
3. (Closed) WR-01 critic-infra silent drop — already fixed.

## Proposed fix (deferred)

1. **Stage logging** in `src/app/api/tools/{ideas,hooks}/route.ts` + runners: log
   `generated=N → survivors=M → persisted=K` (+ elapsed per stage). Turns the silent 3–4 min empty
   into a diagnosable trace and tells us cause (1) vs (2).
2. **Empty-state UX**: when 0 candidates pass, render an honest message ("No candidates cleared the
   Value Bar this round — try again or broaden the topic") instead of silently returning to ready.
3. **Latency**: investigate the 3–4 min structured-generation call (model/timeout/retry budget);
   confirm whether it's environment (slow DashScope) or a retry storm.

## Scope note

Surfaced during Phase 14 UAT. Deferred by owner (2026-06-20) to keep executing later phases. The
Phase 14 code itself is validated by unit tests + the LIVE slop-vs-strong run + real-data card
rendering; this is a live-generation reliability/UX concern, investigate before relying on live
Ideas/Hooks in production.
