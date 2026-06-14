# Phase 02 — Deferred Items (out of scope, discovered during execution)

Logged per the executor SCOPE BOUNDARY rule: pre-existing failures in files NOT
touched by the current plan. NOT fixed here — recorded for a future cleanup pass.

## Pre-existing `tsc --noEmit` errors (discovered during Plan 02-01)

`npx tsc --noEmit` reports **12 errors across 6 files, none introduced by this
plan** (all in files last modified by earlier engine/board commits, several by the
known `test: changes` git-autocommit). The project's `npm test` (vitest) is green;
these are strict-typecheck-only failures in test/fixture files. Plan 02-01's own new
files (`src/components/reading/**`) are tsc-clean.

| File | Count | Sample error |
|------|-------|--------------|
| `src/lib/engine/wave3/__tests__/fold-adapter.test.ts` | 5 | TS2345 PersonaSlot[] arg mismatch; TS2532 possibly undefined |
| `src/lib/engine/wave3/__tests__/fold-schema.test.ts` | 3 | TS2532 Object is possibly 'undefined' |
| `src/lib/engine/wave3/__tests__/fold-diversity-guard.test.ts` | 1 | TS2345 `number[] | undefined` not assignable to `number[]` |
| `src/lib/engine/__tests__/stage10-critique.test.ts` | 1 | TS2353 `views` not in `EngagementRange` |
| `src/lib/engine/__tests__/flop-warning.test.ts` | 1 | TS2353 `views` not in `EngagementRange` |
| `src/components/board/verdict/__tests__/fixtures/prediction-result.ts` | 1 | TS2352 cast needs `as unknown as PredictionResult` first |

**Why deferred:** SCOPE BOUNDARY — only auto-fix issues directly caused by the
current task's changes. These files are untouched by Plan 02-01. The board fixture
(`prediction-result.ts`) is imported by the new reading fixture but imports/runs
fine at runtime; its cast error predates this plan (last touched by commit 622d36df).

**Suggested owner:** a dedicated typecheck-cleanup quick task, or fold into the
Phase-2 verification pass if a green `tsc` gate is required before milestone merge.

## `src/components/sidebar/Sidebar.tsx` over the 500-line guideline (noted Plan 02-03)

`Sidebar.tsx` is **537 lines** (> the 500-line file guideline). It was already 529
lines before Plan 02-03 — it crept over the line after the P1-02 `SidebarAccountSelector`
extraction that originally pulled it under 500. Plan 02-03 Task 2 added net **+8 lines**
for the score-chip token swap (`scoreTone()` → `bandTone` switch + import).

**Why deferred:** SCOPE BOUNDARY — Task 2 is explicitly scoped to a *color-token swap
only* ("do NOT change the chip layout … or any other sidebar behavior"). A structural
split (extracting another sub-component) is out of scope for a token edit and would
touch unrelated sidebar markup. The new component Plan 02-03 owns (`driver-rows.tsx`,
181 lines) is well under 500.

**Suggested owner:** a sidebar refactor quick task — extract the history-row /
score-chip render block (or the Simulations list) into its own file to bring
`Sidebar.tsx` back under 500.

## `fix-first.test.tsx` unused `within` import (noted Plan 02-05)

`src/components/reading/__tests__/fix-first.test.tsx:3` imports `within` from
`@testing-library/react` but never uses it → `tsc --noEmit` TS6133 (a 13th
strict-typecheck-only error, on top of the 12 above). Introduced by Plan 02-04
commit `1890a5de` (the FixFirstList RED test), NOT by 02-05.

**Why deferred:** SCOPE BOUNDARY — 02-05 did not touch `fix-first.test.tsx`. The
error is typecheck-only: `npm test` (vitest) is green and `npm run build` (Next.js
production typecheck) is **clean (exit 0)** — it does not fail on this, so it is
non-blocking for the phase gate.

**Suggested owner:** fold into the same typecheck-cleanup quick task as the 12
pre-existing `tsc` errors above (drop the unused `within` import — one-line fix).
