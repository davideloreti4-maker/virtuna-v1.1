# Plan 01-05 — robustness + honesty + closeout — SUMMARY

> 2026-06-11. Wave 5 (depends on 01-04 ✓). Run inline (human-in-the-loop, D-00). Audits were
> code-only; the live phase-gate rig run + F42 permalink UAT were DEFERRED to a batched verification
> per Davide's choice (see "Deferred — required before phase close" below). ENGINE_VERSION → 3.19.0.
> Commits: `b98782ed` (robustness) + `743f46f4`/`b54f5b5f` (auto-wip prune) + `db892434` (LOCK+version).

## Co-review checkpoint decisions (Task 2, D-00)

- **Single-signal honesty:** **B+C** — add `partial_analysis` flag AND harden fold retry.
- **Fold robustness:** **all three** — F18 bounded retry + F20 salvage + F19 diversity nudge.
- **Prune list:** **approved as classified** (conservative, grep-confirmed).
- **Latency:** **accept under cap, measure at the batched live verify** (no blind reclaim; D-08).
- **F7 verdict (from audit):** **RACES** → moved to a true post-pipeline finally.

## Shipped

### Fold robustness (F18/F20/F19) — `wave3/fold.ts`
`runFold` single attempt → a bounded retry loop. **F18:** one re-attempt on a transient
parse/validation/timeout failure; per-attempt `FOLD_ATTEMPT_TIMEOUT_MS` (2×40s = 80s < the 90s
`PER_CALL_TIMEOUT_MS` HARD ceiling, which is NEVER raised — PITFALL 2). The thinking/plus diagnostic
path keeps its single-attempt 90s budget so the retry never aborts a legit ~88s plus call. **F20:**
salvage valid personas (drop only segment-count-mismatched ones; succeed at ≥6/10 = `MIN_VALID_PERSONAS`)
instead of all-or-nothing. **F19:** one diversity retry-nudge below `DIVERSITY_FLOOR`, with a
homogenized-but-valid fallback so a failed nudge re-attempt never costs a usable fold. New end-to-end
`fold.test.ts` (runFold had no prior e2e test — only adapter/diversity/schema units).

### partial_analysis honesty flag (B) — `types.ts` + `aggregator.ts`
New REQUIRED `partial_analysis: boolean` — true iff EXACTLY one core signal is dead
(`availability.gemini !== availability.behavioral`). Surfaces single-signal partial reads that
previously only the dual-failure `analysis_unavailable` caught. Derivable from the persisted
`signal_availability` JSONB on permalink reload (no new column).

### F7 rehost-delete race — `pipeline.ts`
Verdict (await-ordering reasoning): **RACES** — the fire-and-forget `remove()` was scheduled
BEFORE Omni/fold fetched the signed URL, only "working" on nondeterministic timing. Fixed: the
delete is now a `dropRehostTemp()` closure invoked in a `try/finally` around the last sighted-call
await (`await wave2Promise`) — runs AFTER Omni + fold + Apollo resolve, unconditionally on success
AND failure (T-04-01 preserved), with no race. Apify signed-URL flow untouched.

### Dead-tail prune (F43) — aggregator + types + consumers
`rule_score`/`trend_score`/`ml_score`/`reasoning` stop emitting fake fixed constants (50/0/0/`""`)
→ emit **null** (dead signals removed from the blend long ago; the constants leaked to the UI as
meaningful). DB columns kept for back-compat (route persists `?? null`); consumers null-handled
(eval-runner `?? 0`, impact-score `?? 0`, learning loop already `Partial<…|null>`). `content_type`/
`niche` `confidence:1.0` marked DEAD placeholder (F12 — no consumer; comment, not schema surgery).

### ENG-04 honesty LOCK — `aggregator.test.ts`
Named regression-guard `describe("ENG-04 honesty LOCK")`: engagement range null-when-no-baseline +
grounded/bounded/DETERMINISTIC (a Math.sin/random jitter would break determinism + grounding),
`analysis_unavailable` dual-failure-only, dead-tail emits null. GREEN against unchanged honesty code.

### Version
ENGINE_VERSION 3.18.0 → 3.19.0 + change-history (partial_analysis + prune = output-shape change).

## Deviations (audit grep under-surfaced coupling — surfaced per D-00)

- **`applyCtaPenalty` NOT deleted** (plan/STATE assumed it "dead, never called"). It IS unused by
  production `aggregateScores`, but it has a dedicated 17-case test file (`aggregator-cta-penalty.test.ts`)
  + an `aggregateScores` integration section, and it **emits nothing** (it's an unused pure function,
  not a fake field leaking to the UI). Deleting it destroys real coverage for ZERO honesty gain, so
  it was retained. The F43 goal (stop fake NUMBERS leaking) is unaffected.
- **`audio_fingerprint` + `platform_fit` NOT dropped** from the output (the approved table said
  "drop"). Both already emit **null** (honest absence, not a fake number), and `audio_fingerprint`
  has 7 explicit `=== null` lock tests (`aggregator-audio.test.ts`). The F43 prune targets fake
  CONSTANTS; dropping an honest null adds no honesty value (and broke the lock tests). Left as null
  passthroughs. If a true contract-drop is wanted later, it's a trivial typed follow-up.

## Verification

- Targeted: `fold.test.ts` + `aggregator.test.ts` + `aggregator-audio.test.ts` + `stage10-critique.test.ts`
  + `version.test.ts` all green.
- Full `npm test` → **1914 passed, 0 failed** (179 files). tsc `--noEmit` → **12 = baseline**
  (pre-existing `views`/EngagementRange + fixture cast; none from this work).

## Deferred — REQUIRED before phase 01 close (Davide-owned; not done in this session)

Per Davide's "inline but skip live runs" choice, these HARD Task-4 gates are intentionally deferred
to a batched live verification:
1. **Live phase-gate rig run** — `smoke-tiktok-pipeline.ts` + `measure-pipeline.ts` on a real video
   (no thrown frames; TOTAL under the 300s cap; capture the per-stage latency map). VALIDATION.md
   requires ≥1 live rig run before phase close; unit-green alone does NOT satisfy it.
2. **F42 permalink-reload UAT** (Davide-authenticated — `/analyze` is login-gated): drive a live
   run, reload the shared/saved permalink, confirm the 01-04 hero block + engagement range survive.
3. **Latency posture** — accepted under cap pending the measure-pipeline number from gate 1.

## Phase 01 status

Engine threads ENG-01/03/04 are CODE-complete + unit-green (ENG-03 latency pending the live measure).
**ENG-06 (D-12 deep 3-call prompt I/O co-review = "chunk B") remains OUT** — its own owning open
plan, must land before phase close (tracked in STATE + 01-03-SUMMARY). Phase 01 is NOT fully closed:
the 3 deferred live gates above + ENG-06 chunk B remain.
