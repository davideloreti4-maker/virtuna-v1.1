---
phase: 04-audience-sim-fold-brain-2-the-bet
plan: "05"
subsystem: scripts/referee + production-flip gate
tags: [referee, a-b-test, fold, shadow, d10, r7, r10, d03, d05]
dependency_graph:
  requires:
    - 04-04 (ab-fold-referee.ts complete)
    - 04-03 (aggregator "fold" branch + pipeline foldOutcome)
  provides:
    - Referee real-API run captured (D-03 composite, 2-video set)
    - SHADOW decision recorded (D-10) — flip deferred to P5
    - P4 complete: fold fully built+wired+dormant; 10-pass production default intact
  affects:
    - P5 (carry-forward: lower FOLD_THINKING_BUDGET to fit 90s, re-run referee, then flip)
tech_stack:
  added: []
  patterns:
    - D-10 shadow path: fold stays dormant behind ENGINE_USE_FOLD=1 flag; 10-pass is production default
    - D-09 dormant-not-deleted: runWave3Pass2 preserved (3 occurrences); one-flag rollback intact
key_files:
  created: []
  modified: []
decisions:
  - "SHADOW (D-10): fold timed out at 90s on every run (thinking_budget=4000); no output produced; 10-pass production default unchanged; flip deferred to P5 pending thinking_budget cut"
  - "90s is the fold's LATENCY BUDGET — raising the timeout is NOT the fix; the fold only earns the flip if its single call fits the latency envelope (otherwise it loses the R7 wall-clock win)"
  - "R7 confirmed (fold=1 vs tenpass=20 calls) — the call fires; it's the output quality within the time box that must improve"
  - "Reduced-set caveat applies (2 of 6 videos) but is irrelevant here — failure is structural/100% timeout, not statistical"
  - "No ENGINE_VERSION bump — production behavior unchanged"
metrics:
  duration: "~25 min (referee run: ~13 min; verification: ~5 min)"
  completed: "2026-06-05"
  tasks_completed: 2
  files_created: 1
  files_modified: 0
---

# Phase 4 Plan 5: A/B Referee Run + SHADOW Decision (D-10) Summary

**One-liner:** Real-API referee run (2 videos, 8 pipeline invocations, 16c) returned MISS 0/2 due to fold 90s timeout on every run; SHADOW decision recorded (D-10) — 10-pass stays production default, flip deferred to P5 pending thinking_budget cut.

## Referee Run — Full Results

**Run:** `npx tsx scripts/ab-fold-referee.ts` — 2026-06-05, real DashScope/Qwen API.
**Video set:** 2 of 6 D-04 videos (reduced set, user decision P1).
**Total cost:** 16c / 2000c cap (no cap trip).

### Per-Video Composite Table (D-03, verbatim)

```
========== REFEREE RESULTS — PER-VIDEO TABLE ==========
Video ID              Parity Δ   OK?  DivRatio   OK?  DropAgr   OK?  R7 OK?  Verdict
────────────────────────────────────────────────────────────────────────────────────────────────────
gwxLeHphZCxK          0.00 (≤5)     ✓  0.000 (≥0.8)     ✗  0/10 (≥6)     ✗       ✓  MISS
  fold: behavioral=72.5  avgRange=0  calls=1
  10ps: behavioral=72.5  avgRange=0.485  calls=20
IMG_0012              0.00 (≤5)     ✓  0.000 (≥0.8)     ✗  0/10 (≥6)     ✗       ✓  MISS
  fold: behavioral=22.5  avgRange=0  calls=1
  10ps: behavioral=22.5  avgRange=0.635  calls=20

========== ADVISORY OVERALL VERDICT ==========
Videos tested:     2 (of 6 D-04 set — 4 deferred)
Reproduce/beat:    0/2
Beat:              0/2
Parity all OK:     YES
Diversity all OK:  NO
Drop-agree all OK: NO
R7 call-count OK:  YES (fold=1, tenpass=20 on all videos)
Total cost:        16c / cap 2000c

VERDICT: MISS (0/2 videos pass — fold needs improvement)
```

### R7 Call-Count Proof — CONFIRMED

Every run: `foldCalls=1 (expect 1)  tenpassCalls=20 (expect 20)`.
R7 is structurally proven: the single fold LLM call fires exactly once per pipeline invocation. The 20-vs-1 architecture is correct.

### Root Cause: Fold 90s Timeout (NOT a Quality Miss)

All 4 pipeline runs (2 videos × 2 runs) logged:

```
END wave_3_fold   90003ms  $0.0000  !!FAIL wave_3_fold_failed
```

The fold's `PER_CALL_TIMEOUT_MS` ceiling (90s) was hit on every run with `thinking_budget=4000`. The fold LLM call was issued (R7=1 confirmed), but returned no valid output within the budget.

**Consequence in the aggregator:** `foldOutcome` was null → the aggregator's fold branch fell back to the 10-pass persona data for `behavioral_score` (hence parity = 0.0, a trivial pass) but produced `avgCurveRange=0` (no fold heatmap, no curve diversity) and `swipeSegments=0/10` (no drop-point data). The MISS is entirely a timeout artifact, not a model quality regression.

**Why the timeout was NOT raised:** 90s is the fold's **latency budget** — the fold only earns the production flip if its single call beats the 10-pass on wall-clock time. Raising the ceiling defeats the entire purpose of the fold (R7 / latency win). This is already documented in `src/lib/engine/fold.ts` comment (commit `a1de3937`).

### Metric Breakdown

| Metric | gwxLeHphZCxK | IMG_0012 | Notes |
|--------|-------------|---------|-------|
| Behavioral parity ≤5 | 0.00 PASS | 0.00 PASS | Trivial — fallback to 10-pass data |
| Diversity ratio ≥0.8x | 0.000 FAIL | 0.000 FAIL | Fold produced 0 curves (timeout) |
| Drop-point ≥6/10 | 0/10 FAIL | 0/10 FAIL | Fold produced 0 segments (timeout) |
| R7 fold=1 call | 1 PASS | 1 PASS | Call fires; output silently discarded |

**Reduced-set caveat:** Based on 2 videos (not 6). The failure is structural (100% timeout on all 4 runs across both videos) — expanding to 6 videos would produce the same result.

## Task 2: SHADOW Decision (D-10)

**Decision:** SHADOW — keep 10-pass production default; fold stays built+wired+dormant; flip deferred to P5.

**Production state (unchanged):**
- `pipeline.ts`: `useFold` default OFF via `ENGINE_USE_FOLD === "1"` gate — unchanged.
- `aggregator.ts`: `behavioralSource` default ("deepseek" / 10-pass) — unchanged.
- `runWave3Pass2` call site: present 3 times (D-09 dormant-not-deleted — one-flag rollback intact).
- ENGINE_VERSION: NOT bumped (no production behavior change).

**Verification results:**
- `grep -c "runWave3Pass2" src/lib/engine/pipeline.ts` = **3** (D-09 pass)
- `npm run build` = **green** (0 errors)
- `npx vitest run src/lib/engine/wave3/__tests__/` = **20 PASS / 0 FAIL**

## P5 Carry-Forward (REQUIRED — pick this up in Phase 5)

**The fold is NOT broken. The fold is over-budget.** The fix is:

1. **Lower `FOLD_THINKING_BUDGET`** (and/or `FOLD_MAX_TOKENS`) in `src/lib/engine/fold.ts` until the qwen3.6-plus thinking call consistently completes within 90s.
2. **Re-run `scripts/ab-fold-referee.ts`** on the same 2-video set for a real A/B — this time with actual fold output, not a fallback to 10-pass data.
3. **If the 3-metric composite passes** (parity ≤5, diversity ≥0.8x, drop ≥6/10) on both videos: execute the production flip (Task 2 FLIP branch from this plan) with a single revertable commit.
4. **Do NOT extend the 90s timeout** — that defeats R7 and the latency win.

Suggested starting point: `FOLD_THINKING_BUDGET=1000` (from 4000) — this is the primary dial. `FOLD_MAX_TOKENS` may also need a cut if token generation is the bottleneck vs. thinking latency.

## Deviations from Plan

None — SHADOW path executed exactly as described in Task 2. No files modified (production defaults unchanged by design).

## Known Stubs

None — the fold is fully built and wired. The dormant status is intentional (D-10), not a stub.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes. Production behavior unchanged. T-04-08 (flip on brittle A/B) mitigated — flip not taken.

## Self-Check: PASSED

- `04-05-SUMMARY.md` — WRITTEN (this file)
- `runWave3Pass2` preserved — VERIFIED (count=3)
- Build green — VERIFIED
- Wave3 tests green — VERIFIED (20/0)
- No production files modified — CONFIRMED
