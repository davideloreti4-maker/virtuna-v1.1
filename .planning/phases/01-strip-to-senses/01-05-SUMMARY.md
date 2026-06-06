---
phase: 01-strip-to-senses
plan: 05
subsystem: engine
tags: [dormant-move, dead-code, git-mv, cron, vercel]
dependency_graph:
  requires: [01-01, 01-02, 01-03, 01-04]
  provides: [dormant-engine-modules, clean-active-tree]
  affects: [aggregator.ts, vercel.json, src/lib/engine/_dormant/]
tech_stack:
  added: []
  patterns: [move-not-delete, _dormant convention, tsconfig/vitest exclude glob]
key_files:
  created:
    - src/lib/engine/flop-warning.ts
    - src/lib/engine/__tests__/flop-warning.test.ts
  modified:
    - src/lib/engine/aggregator.ts
    - src/lib/engine/__tests__/aggregator.test.ts
    - src/lib/engine/__tests__/aggregator-cta-penalty.test.ts
    - src/lib/engine/__tests__/aggregator-audio.test.ts
    - src/lib/engine/__tests__/aggregator-anti-virality.test.ts
    - src/lib/engine/__tests__/aggregator-optimal-post.test.ts
    - vercel.json
  dormanted:
    - src/lib/engine/_dormant/engine/audio-fingerprint.ts
    - src/lib/engine/_dormant/engine/trends.ts
    - src/lib/engine/_dormant/engine/fuzzy.ts
    - src/lib/engine/_dormant/engine/rules.ts
    - src/lib/engine/_dormant/engine/ml.ts
    - src/lib/engine/_dormant/engine/stage11-counterfactuals.ts
    - src/lib/engine/_dormant/engine/stage11-counterfactuals-prompts.ts
    - src/lib/engine/_dormant/engine/wave4/platform-fit.ts
    - src/lib/engine/_dormant/engine/wave4/platform-fit-prompts.ts
    - src/lib/engine/_dormant/cron/retrain-ml/route.ts
decisions:
  - "Extract maybeAppendLikelyFlopWarning to kept flop-warning.ts before dormanting stage11-counterfactuals"
  - "Move retrain-ml cron route to _dormant/cron/ (not delete) per move-not-delete convention"
  - "Remove retrain-ml schedule from vercel.json (confirmed 0 3 * * 1 entry)"
metrics:
  completed: "2026-06-04T10:18:58Z"
  tasks: 4
  files_changed: 21
---

# Phase 01 Plan 05: Dormant Move Summary

**One-liner:** Seven dead engine module groups (ml, audio-fingerprint, trends+fuzzy, rules, stage11-counterfactuals+prompts, wave4/platform-fit+prompts) + retrain-ml cron route moved to `_dormant/` via git mv; vercel.json retrain-ml schedule removed; active tree fully clean.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 0 | Extract maybeAppendLikelyFlopWarning to flop-warning.ts | ee3aeb8c | flop-warning.ts, flop-warning.test.ts, stage11-counterfactuals.ts, aggregator.ts, 5 test files |
| 1 | Dormant audio-fingerprint, trends, fuzzy, rules, stage11 | 77f1f845 | 10 files via git mv + aggregator.test.ts fix |
| 2 | Dormant platform-fit, ml; retrain-ml cron + vercel.json | b9503da4 | 7 files via git mv + vercel.json |
| 3 | Build + suite green; no active import into _dormant | (verification) | none |

## Deviations from Plan

### Auto-fixed Issues

**1. [Task 0 REQUIRED] Plan-05 pre-move guard was wrong — stage11-counterfactuals still had active importer**
- **Found during:** Pre-execution analysis
- **Issue:** Plan interfaces line 75 claimed "aggregator.ts no longer imports stage11-counterfactuals (Plan 02)." In reality, `maybeAppendLikelyFlopWarning` (a kept pure-TS helper) was still imported at aggregator.ts:50. The Plan-05 grep guard would have correctly blocked the stage11 dormant move.
- **Fix:** Created `src/lib/engine/flop-warning.ts` (kept module) containing the 12-line pure function. Removed it from `stage11-counterfactuals.ts`. Repointed `aggregator.ts` import. Created `flop-warning.test.ts` with 4 verbatim boundary tests. Removed the describe block from `stage11-counterfactuals.test.ts`. Fixed 5 aggregator test files (aggregator.test.ts, aggregator-cta-penalty.test.ts, aggregator-audio.test.ts, aggregator-anti-virality.test.ts, aggregator-optimal-post.test.ts) to replace `vi.mock("../stage11-counterfactuals")` with `vi.mock("../flop-warning")`.
- **Files modified:** `flop-warning.ts` (new), `flop-warning.test.ts` (new), `stage11-counterfactuals.ts`, `aggregator.ts`, 5 test files
- **Commit:** ee3aeb8c

**2. [Rule 2 - Missing fix] aggregator.test.ts had residual vi.mock("../stage11-counterfactuals") with importOriginal**
- **Found during:** Task 1 TypeScript check
- **Issue:** After Task 0 fixed the 4 explicitly listed aggregator tests, `aggregator.test.ts` still had a `vi.mock("../stage11-counterfactuals", async (importOriginal) => ...)` block that was not listed in the deviation instructions. This caused `tsc --noEmit` error TS2307 after the module moved to `_dormant/`.
- **Fix:** Replaced the `../stage11-counterfactuals` mock with `vi.mock("../flop-warning", () => ({ maybeAppendLikelyFlopWarning: vi.fn() }))`.
- **Files modified:** `src/lib/engine/__tests__/aggregator.test.ts`
- **Commit:** 77f1f845

## Per-Module Grep Proof (Zero Active Importers)

All greps run against active tree (excluding `_dormant/`):

| Module | Active importers |
|--------|-----------------|
| audio-fingerprint | none |
| trends | none |
| fuzzy | none |
| rules | none |
| stage11-counterfactuals | none |
| ml | none |
| wave4/platform-fit | none |

```
Active import into _dormant/: ZERO
grep -c retrain-ml vercel.json: 0
src/app/api/cron/retrain-ml/: absent from active tree
```

## Build + Test Verification

- `npm run build`: compiled successfully (Google Fonts network fetch fails in this offline environment — pre-existing, unrelated to this plan; TypeScript compilation clean)
- `npm test` (vitest run): 1746 tests PASS, 0 FAIL (dormanted tests correctly excluded by `**/_dormant/**` glob)
- `npx tsc --noEmit`: no errors

## Dormant Structure After Plan 05

```
src/lib/engine/_dormant/
├── engine/
│   ├── audio-fingerprint.ts
│   ├── fuzzy.ts
│   ├── ml.ts
│   ├── rules.ts
│   ├── stage11-counterfactuals.ts
│   ├── stage11-counterfactuals-prompts.ts
│   ├── trends.ts
│   ├── wave4/
│   │   ├── platform-fit.ts
│   │   ├── platform-fit-prompts.ts
│   │   └── __tests__/
│   │       ├── platform-fit.test.ts
│   │       └── platform-fit-prompts.test.ts
│   └── __tests__/
│       ├── fuzzy.test.ts
│       ├── ml.test.ts
│       ├── rules.test.ts
│       ├── stage11-counterfactuals.test.ts
│       └── trends.test.ts
└── cron/
    └── retrain-ml/
        └── route.ts
```

## Config Verification

- `tsconfig.json` line 38: `**/_dormant/**` already excluded (no edit needed)
- `vitest.config.ts` line 23: `**/_dormant/**` already excluded (no edit needed)

## Threat Surface Scan

T-05-01 mitigated: `src/app/api/cron/retrain-ml/route.ts` removed from routable Next.js tree → HTTP surface eliminated. `vercel.json` schedule removed → no scheduled invocations. No orphaned unauthenticated endpoint.

No new threat surfaces introduced.

## Known Stubs

None — this plan performs file moves only; no stubs introduced.

## Self-Check: PASSED

- [x] `src/lib/engine/flop-warning.ts` exists
- [x] `src/lib/engine/__tests__/flop-warning.test.ts` exists
- [x] `src/lib/engine/_dormant/engine/rules.ts` exists
- [x] `src/lib/engine/_dormant/engine/stage11-counterfactuals.ts` exists
- [x] `src/lib/engine/_dormant/engine/ml.ts` exists
- [x] `src/lib/engine/_dormant/engine/wave4/platform-fit.ts` exists
- [x] Commits ee3aeb8c, 77f1f845, b9503da4 verified in git log
- [x] Zero active importers of all moved modules (grep proof above)
- [x] `grep -c retrain-ml vercel.json == 0`
- [x] `npm test`: 1746 PASS, 0 FAIL
- [x] `npm run build`: compiled successfully
