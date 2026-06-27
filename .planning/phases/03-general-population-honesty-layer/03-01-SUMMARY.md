---
phase: 03-general-population-honesty-layer
plan: 01
subsystem: audience-signature / determinism
status: IN-PROGRESS — paused at Task 3 (checkpoint:human-action, blocking-human)
tags: [determinism, D-01, wave-0-gate, qwen, enrich-signature]
requires:
  - src/lib/audience/enrich-signature.ts (defaultSynthesize)
  - src/lib/audience/signature-equality.ts (signatureEqual/normalizeSignature/stableStringify)
provides:
  - "D-01 fix: thinking-mode dropped on the synth bake (enable_thinking:false, thinking_budget removed)"
  - "scripts/rebake-determinism.ts — paid live double-bake harness (ready for the human gate run)"
affects:
  - "Wave-0 GATE: the rest of Phase 3 (migration/repo/UI) is BLOCKED until the live signatureEqual:true is recorded"
tech-stack:
  added: []
  patterns:
    - "greedy temp:0 + seed = the real determinism lever (thinking-mode staging was Pitfall-3 jitter)"
    - "live double-bake harness restored from torn-down spike probe (git 362ef8df^)"
key-files:
  created:
    - scripts/rebake-determinism.ts
    - scripts/fixtures/socials-bundle.fixture.json
  modified:
    - src/lib/audience/enrich-signature.ts
decisions:
  - "D-01 close-out applied in-place; ENGINE_VERSION NOT bumped (synth-call config only)"
  - "Harness is standalone tsx/node-runnable, deliberately NOT in the vitest suite (paid + live)"
metrics:
  tasks_completed: 2
  tasks_total: 3
  files_touched: 3
  completed: null
---

# Phase 3 Plan 01: D-01 Determinism Close-out Summary (IN-PROGRESS)

**One-liner:** Dropped thinking-mode on the `qwen-3.7-plus` synthesis bake (`enable_thinking:false`, `thinking_budget` removed) so greedy `temp:0` is the sole decode path, and re-created the paid live double-bake harness — now PAUSED at the blocking-human gate that must record `signatureEqual:true` before any Wave-1 work proceeds.

## Status

**PAUSED at Task 3** — `checkpoint:human-action` (`gate="blocking-human"`). Tasks 1 and 2 are complete and committed. The live paid Qwen double-bake (the actual D-01 proof) requires the operator's environment (`DASHSCOPE_API_KEY`), budget approval (~$0.50), and a synth-quality judgement — it cannot be auto-run by the executor.

## Tasks Completed

| Task | Name | Type | Commit | Files |
|------|------|------|--------|-------|
| 1 | Drop thinking-mode on the synthesis bake (D-01) | auto | `c4c7b5c9` | src/lib/audience/enrich-signature.ts |
| 2 | Re-create the live double-bake harness | auto | `6d5854a2` | scripts/rebake-determinism.ts, scripts/fixtures/socials-bundle.fixture.json |

### Task 1 — Drop thinking-mode (D-01)

In `defaultSynthesize` (enrich-signature.ts ~line 345-354): set `enable_thinking: false`, removed the `thinking_budget: 2000` line. Retained `temperature: 0` and `seed: QWEN_SEED` verbatim. Updated the `model` trailing comment + the `enable_thinking` comment to reference D-01 (greedy temp:0 is the determinism lever; thinking-mode staging was the Pitfall-3 residual-jitter source observed NON-DETERMINISTIC in spike 02-02). Also corrected two now-stale header comments (lines 8, 54-58) that described "thinking ON" / `thinking_budget` so the file no longer documents dropped behaviour. `SYNTH_MAX_TOKENS` (6000) and `SYNTH_TIMEOUT_MS` (120s) left as-is per plan. **ENGINE_VERSION NOT bumped.**

- `grep enable_thinking` → single match, `enable_thinking: false` on the synth call.
- `thinking_budget` non-comment count → 0.
- `temperature: 0` + `seed: QWEN_SEED` still present in defaultSynthesize (line 351-352).
- Replay gate `signature-determinism.test.ts` → **5 passed** (no assembly/normalization regression). NOTE: this replay test is zero-network and CANNOT prove the live D-01 fix — that is Task 3's job.

### Task 2 — Re-create the live double-bake harness

Restored the torn-down spike probe (`git show 362ef8df^:scripts/spike/trustworthy-sim-probe.ts`) as a trimmed `scripts/rebake-determinism.ts`. The harness: loads the frozen secret-scrubbed `khaby.lame` socials bundle (vendored to `scripts/fixtures/socials-bundle.fixture.json`, Apify-free / no re-scrape), bakes `enrichSignature` with the real `defaultSynthesize` TWICE on the identical input, asserts `signatureEqual(a, b) === true` (printing both `stableStringify(normalizeSignature(...))` on mismatch), and prints bake-A's `summary` + each reactor's `reaction_frame` for the A/B quality judgement. Gates on `DASHSCOPE_API_KEY` (zero-network FATAL exit if unset). Standalone tsx/node script — NOT added to vitest.

- imports `enrichSignature` + `signatureEqual`/`normalizeSignature`/`stableStringify`.
- reads `DASHSCOPE_API_KEY`, aborts clearly when unset.
- exactly 2 bakes; no Apify/network scrape path.
- `npx tsc --noEmit` → **no NEW errors on `scripts/rebake-determinism.ts`** (repo tsc baseline is non-zero; our path is clean).
- Fixture verified secret-clean (`token=` count 0).

## Deviations from Plan

**Minor (in-scope hygiene, no rule needed):** corrected three stale comments in enrich-signature.ts (lines 8, 54-58) that still described "thinking ON" / `thinking_budget` after the Task-1 edit removed that behaviour. No value retuning — comment-accuracy only, to avoid doc-drift. Acceptance criteria explicitly tolerate comment-only `thinking_budget` references; corrected them anyway.

Otherwise: plan executed exactly as written.

## PENDING — Task 3 (BLOCKING-HUMAN GATE)

The D-01 GATE evidence is NOT yet recorded. The operator must run the live paid harness and paste the result here:

**How to verify:**
1. Ensure `DASHSCOPE_API_KEY` is set (budget ~10 Qwen calls / <$0.50, spike actuals).
2. Run: `node --import tsx scripts/rebake-determinism.ts`
3. Confirm it prints `signatureEqual: true`.
4. Eyeball the A/B output: `summary` + reactor `reaction_frame`s read coherently vs the socials control (no quality collapse — A2 guard).
5. Paste the `signatureEqual:true` line + a one-line quality judgement below as the D-01 GATE evidence.

**Acceptance:**
- A REAL paid Qwen run (not the replay test) with `signatureEqual(a,b) === true`.
- Synth quality judged non-regressed vs the socials control (A2).
- If `signatureEqual:false`: STOP the phase, escalate to SPIKE-VERDICT §Fallback option 3 (bounded prose tolerance) before any Wave-1 work.

**Resume signal:** `approved — signatureEqual:true recorded` (or report the mismatch).

### D-01 GATE EVIDENCE

> _Awaiting the live paid run — to be pasted by the operator._

## Self-Check

- `src/lib/audience/enrich-signature.ts` — FOUND (modified, committed c4c7b5c9)
- `scripts/rebake-determinism.ts` — FOUND (committed 6d5854a2)
- `scripts/fixtures/socials-bundle.fixture.json` — FOUND (committed 6d5854a2)
- Commit `c4c7b5c9` — FOUND
- Commit `6d5854a2` — FOUND

## Self-Check: PASSED (Tasks 1-2; Task 3 pending human gate)
