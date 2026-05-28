---
quick_id: 260528-mzd
phase: 01-strip-retrieval-similar-videos-trending-dashboard
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/engine/_dormant/                                      # new directory
  - src/lib/engine/retrieval/                                     # MOVED to _dormant/
  - src/lib/engine/corpus/orchestrator.ts                         # MOVED to _dormant/corpus/
  - src/lib/engine/corpus/normalize-scrape.ts                     # MOVED (uses follower-tier internally; not consumed outside corpus)
  - src/lib/engine/corpus/apify-jobs.ts                           # MOVED (consumed only by orchestrator)
  - src/lib/engine/corpus/bucketing.ts                            # MOVED (consumed only by orchestrator)
  - src/lib/engine/corpus/baseline.ts                             # MOVED
  - src/lib/engine/corpus/calibration.ts                          # MOVED
  - src/lib/engine/corpus/corpus-version.ts                       # MOVED
  - src/lib/engine/corpus/eval-config.ts                          # MOVED
  - src/lib/engine/corpus/eval-harness.ts                         # MOVED
  - src/lib/engine/corpus/eval-runner.ts                          # MOVED
  - src/lib/engine/corpus/failure-cases.ts                        # MOVED
  - src/lib/engine/corpus/thresholds.ts                           # MOVED
  - src/lib/engine/corpus/cli/                                    # MOVED
  - src/lib/engine/corpus/metrics/                                # MOVED
  - src/lib/engine/corpus/__tests__/                              # MOVED (except follower-tier.test.ts stays)
  - src/lib/engine/corpus/follower-tier.ts                        # KEEP (active — wave4/platform-fit-prompts consumer)
  - src/lib/engine/corpus/__tests__/follower-tier.test.ts         # KEEP
  - src/lib/engine/corpus/embedder.ts                             # NEW — relocated from retrieval/embedder.ts
  - src/lib/engine/corpus/__tests__/embedder.test.ts              # NEW — relocated test
  - src/components/trending/                                      # MOVED to _dormant/components/trending/
  - src/components/board/actions/SimilarVideosCard.tsx            # MOVED to _dormant/components/board/actions/
  - src/components/board/actions/SimilarVideoCardCompact.tsx      # MOVED
  - src/components/board/actions/__tests__/SimilarVideosCard.test.tsx                # MOVED
  - src/components/board/actions/__tests__/SimilarVideosCard.empty.test.tsx          # MOVED
  - src/components/board/actions/__tests__/SimilarVideosCard.focus.test.tsx          # MOVED
  - src/lib/engine/__tests__/retrieval/                           # MOVED with retrieval
  - tsconfig.json
  - vitest.config.ts
  - src/app/(app)/trending/                                       # DELETED
  - src/app/api/trending/                                         # DELETED
  - src/hooks/queries/use-trending.ts                             # DELETED
  - src/hooks/queries/index.ts                                    # edit (remove use-trending export)
  - src/lib/mappers/trending.ts                                   # DELETED
  - src/lib/mappers/index.ts                                      # edit (remove trending export if present)
  - src/types/trending.ts                                         # DELETED (no active callers)
  - src/lib/supabase/middleware.ts                                # edit (remove "/trending" entry)
  - src/components/sidebar/Sidebar.tsx                            # edit (strip Trending nav)
  - src/components/app/sidebar.tsx                                # edit (strip Trending nav)
  - src/components/board/actions/ActionsNode.tsx                  # edit (strip SimilarVideosCard import + render branches)
  - src/components/board/actions/actions-constants.ts             # edit if retrieval refs
  - src/components/board/actions/__tests__/ActionsNode.test.tsx   # edit (drop SimilarVideos assertions)
  - src/lib/engine/pipeline.ts                                    # edit (helper swap, drop retrieval import + Wave 1 slot)
  - src/lib/engine/retrieval-empty.ts                             # NEW — createEmptyRetrievalResult() helper
  - src/lib/engine/__tests__/pipeline.test.ts                     # edit (drop retrieval mocks, assert helper path)
  - src/lib/engine/__tests__/aggregator.test.ts                   # edit if retrieval mocks present
  - src/app/api/webhooks/apify/route.ts                           # edit (import path: retrieval/embedder → corpus/embedder)
autonomous: true
requirements:
  - Phase-1 success criterion 1 (no SimilarVideosCard in src/)
  - Phase-1 success criterion 2 (no /api/trending in src/)
  - Phase-1 success criterion 3 (no /dashboard/trending or trending-dashboard in src/)
  - Phase-1 success criterion 4 (/api/analyze still writes scraped_videos + reads trending_sounds)
  - Phase-1 success criterion 5 (pnpm build, tsc --noEmit, pnpm test green)

must_haves:
  truths:
    - "src/lib/engine/_dormant/ exists; retrieval/ + runtime-only corpus files + dormant component dirs live inside; nothing under _dormant/ is compiled by tsc or executed by vitest"
    - "src/lib/engine/corpus/follower-tier.ts and src/lib/engine/corpus/embedder.ts remain in active tree; ingestion (apify webhook) still imports embedBatch + buildSubjectText successfully"
    - "/trending route returns hard 404 (Next.js default — no page, no redirect); /api/trending/* returns 404; neither sidebar surfaces a Trending nav item; ActionsNode renders no SimilarVideosCard slot"
    - "pipeline.ts no longer imports retrieval-stage; Wave 1 has 4 promise slots; aggregator receives an empty BenchmarkRetrievalResult from a single createEmptyRetrievalResult() helper"
    - "pnpm test + tsc --noEmit + pnpm build all green; /api/analyze still writes scraped_videos rows and consumes trending_sounds via enrichWithTrends"
  artifacts:
    - path: "src/lib/engine/_dormant/retrieval/retrieval-stage.ts"
      provides: "Dormant retrieval entry point (M2 restores by directory rename)"
    - path: "src/lib/engine/_dormant/corpus/orchestrator.ts"
      provides: "Dormant corpus orchestrator (runtime-only consumer)"
    - path: "src/lib/engine/corpus/embedder.ts"
      provides: "Active-tree embedder for apify webhook ingestion (relocated from retrieval/)"
    - path: "src/lib/engine/retrieval-empty.ts"
      provides: "createEmptyRetrievalResult() — M2 single swap point per D-10"
      exports: ["createEmptyRetrievalResult"]
    - path: "tsconfig.json"
      provides: "exclude includes **/_dormant/**"
      contains: "_dormant"
    - path: "vitest.config.ts"
      provides: "test.exclude includes **/_dormant/**"
      contains: "_dormant"
  key_links:
    - from: "src/lib/engine/pipeline.ts"
      to: "src/lib/engine/retrieval-empty.ts"
      via: "import { createEmptyRetrievalResult } + assignment to retrievalResult const in Wave 1 result destructuring"
      pattern: "createEmptyRetrievalResult"
    - from: "src/app/api/webhooks/apify/route.ts"
      to: "src/lib/engine/corpus/embedder.ts"
      via: "import { buildSubjectText, embedBatch }"
      pattern: "@/lib/engine/corpus/embedder"
    - from: "src/components/board/actions/ActionsNode.tsx"
      to: "(removed)"
      via: "SimilarVideosCard import + JSX usage MUST NOT appear"
      pattern: "SimilarVideosCard"
---

<objective>
Strip M2-corpus-dependent surfaces from the runtime per Phase 1 CONTEXT.md decisions D-01 through D-10. Park `src/lib/engine/retrieval/` + runtime-only corpus files + `src/components/trending/` + `SimilarVideosCard*` under `src/lib/engine/_dormant/` (and `_dormant/components/...`) so M2 restores via folder rename. Delete `/trending` route surfaces entirely (hard 404 per D-05). Wire pipeline.ts to a synthesized empty `BenchmarkRetrievalResult` via a single `createEmptyRetrievalResult()` helper (D-09/D-10). Keep ingestion untouched — scraper cron, apify webhook, `enrichWithTrends`, `scraped_videos`, `trending_sounds`, and `corpus/follower-tier.ts`.

Purpose: MVP ships without dead UI, dead routes, dead pipeline branches. Ingestion side stays alive so the M2 corpus milestone can pick up retrieval by reversing the directory move.

Output: A green tree (pnpm test + tsc --noEmit + pnpm build), zero src/ hits for `SimilarVideosCard`, `/api/trending`, `/dashboard/trending`, `trending-dashboard`, and an `_dormant/` directory containing every removed-from-runtime file ready for M2 to lift back out.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/MILESTONE.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-strip-retrieval-similar-videos-trending-dashboard/01-CONTEXT.md
@.planning/codebase/STRUCTURE.md
@CLAUDE.md

# Pipeline retrieval call sites (current state)
@src/lib/engine/pipeline.ts
@src/lib/engine/aggregator.ts
@src/lib/engine/types.ts

# Files moving into _dormant/
@src/lib/engine/retrieval/retrieval-stage.ts
@src/lib/engine/corpus/orchestrator.ts
@src/components/board/actions/SimilarVideosCard.tsx
@src/components/board/actions/ActionsNode.tsx

# Ingestion (KEEP — verify imports updated to corpus/embedder)
@src/app/api/webhooks/apify/route.ts
@src/app/api/cron/scrape-trending/route.ts

# Sidebars + middleware
@src/components/sidebar/Sidebar.tsx
@src/components/app/sidebar.tsx
@src/lib/supabase/middleware.ts

# Configs to exclude _dormant/
@tsconfig.json
@vitest.config.ts

<interfaces>
<!-- Key contracts. The executor uses these directly — no codebase exploration needed. -->

From src/lib/engine/types.ts (UNCHANGED, source of truth):
```typescript
export const BenchmarkRetrievalResultSchema = z.object({ ... });
export type BenchmarkRetrievalResult = z.infer<typeof BenchmarkRetrievalResultSchema>;
```

From src/lib/engine/pipeline.ts (CURRENT — Task 3 strips lines 39, 259-264, 696-722, 731, 740):
```typescript
// line 19 — imported type (KEEP)
type BenchmarkRetrievalResult,
// line 39 — REMOVE this import
import { runBenchmarkRetrieval } from "./retrieval/retrieval-stage";
// lines 259-264 — REMOVE local DEFAULT_RETRIEVAL_RESULT (moves to helper)
const DEFAULT_RETRIEVAL_RESULT: BenchmarkRetrievalResult = { ... };
// lines 696-722 — REMOVE retrievalPromise IIFE + try/catch
const retrievalPromise = (async () => { ... })();
// line 731 — destructure must drop retrievalResult; line 740 — drop retrievalPromise from Promise.all
const [geminiResult, audioFingerprintResult, , ruleResult, retrievalResult] = await timed(...
```

NEW helper at src/lib/engine/retrieval-empty.ts (Task 3 creates):
```typescript
import type { BenchmarkRetrievalResult } from "./types";

/**
 * Synthesized empty BenchmarkRetrievalResult — Phase 1 D-09/D-10 single swap point.
 * Aggregator's null-safe path (aggregator.ts:890) treats score as 0; the 0.05
 * retrieval weight redistributes across other stages without aggregator edits.
 * M2 corpus milestone restores by swapping this call for runBenchmarkRetrieval().
 */
export function createEmptyRetrievalResult(): BenchmarkRetrievalResult {
  return {
    evidence: [],
    score: null,
    availability: false,
    cost_cents: 0,
  };
}
```

Pipeline.ts post-edit shape (Task 3):
```typescript
import { createEmptyRetrievalResult } from "./retrieval-empty";
// ... (no retrieval-stage import, no DEFAULT_RETRIEVAL_RESULT, no retrievalPromise)

// Wave 1 — 4 slots, not 5:
const [geminiResult, audioFingerprintResult, , ruleResult] = await timed("wave_1", timings, () =>
  Promise.all([geminiPromise, audioFingerprintPromise, creatorPromise, rulePromise]),
  { wave: 1, onEvent: onStageEvent }
);
const retrievalResult = createEmptyRetrievalResult();
```

From src/app/api/webhooks/apify/route.ts (Task 1 edits import path only):
```typescript
// BEFORE:
import { buildSubjectText, embedBatch } from "@/lib/engine/retrieval/embedder";
// AFTER:
import { buildSubjectText, embedBatch } from "@/lib/engine/corpus/embedder";
```
</interfaces>

<corpus_import_graph_audit>
<!-- Audited 2026-05-28 per D-03 planner discretion -->

ACTIVE TREE (stays in src/lib/engine/corpus/):
- follower-tier.ts          ← imported by wave4/platform-fit-prompts.ts (runtime active)
- embedder.ts (relocated)   ← imported by webhooks/apify/route.ts (ingestion)
- __tests__/follower-tier.test.ts
- __tests__/embedder.test.ts (relocated)

DORMANT (moves to _dormant/corpus/):
- orchestrator.ts           ← only consumed by its own test + retrieval-side
- normalize-scrape.ts       ← only consumed by orchestrator + corpus tests
- apify-jobs.ts             ← only consumed by orchestrator + corpus tests
- bucketing.ts              ← only consumed by orchestrator + corpus tests
- baseline.ts, calibration.ts, corpus-version.ts, eval-config.ts,
  eval-harness.ts, eval-runner.ts, failure-cases.ts, thresholds.ts ← orchestrator-internal
- cli/ (build-corpus-args.ts, eval-args.ts, ml-audit.ts)
- metrics/ (bootstrap.ts, ece.ts, index.ts, leave-one-out.ts, macro-f1.ts,
  score-to-bucket.ts, stage-latency.ts)
- __tests__/* (all except follower-tier.test.ts) — D-07 travel-with-source

Note on apify-jobs.ts and normalize-scrape.ts: CONTEXT D-03 hedged with "if exercised by scraper cron / apify webhook". Grep confirms NEITHER scraper cron (src/app/api/cron/scrape-trending/route.ts) NOR apify webhook (src/app/api/webhooks/apify/route.ts) imports them. They are orchestrator-internal. Move to _dormant.
</corpus_import_graph_audit>

<trending_callgraph_audit>
<!-- Audited 2026-05-28: types/trending.ts, mappers/trending.ts, use-trending.ts -->

types/trending.ts consumers (all deleted or moved by this plan):
- src/app/(app)/trending/trending-client.tsx     → DELETED
- src/app/(app)/trending/page.tsx                → DELETED
- src/components/trending/*.tsx                  → MOVED to _dormant/
- src/lib/mappers/trending.ts                    → DELETED
→ types/trending.ts SAFE TO DELETE.

mappers/trending.ts consumers:
- src/app/api/trending/route.ts                  → DELETED
- src/app/api/trending/[videoId]/route.ts        → DELETED
- src/app/api/trending/stats/route.ts            → DELETED
→ mappers/trending.ts SAFE TO DELETE; remove its export from src/lib/mappers/index.ts.

hooks/queries/use-trending.ts consumers:
- src/app/(app)/trending/trending-client.tsx     → DELETED
- src/hooks/queries/index.ts                     → edit (remove re-export)
→ use-trending.ts SAFE TO DELETE.
</trending_callgraph_audit>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Park dormant code + relocate ingestion-side embedder + update build/test excludes</name>
  <files>
    src/lib/engine/_dormant/                                                  (new directory)
    src/lib/engine/_dormant/retrieval/                                        (mv from src/lib/engine/retrieval/)
    src/lib/engine/_dormant/corpus/orchestrator.ts                            (mv)
    src/lib/engine/_dormant/corpus/normalize-scrape.ts                        (mv)
    src/lib/engine/_dormant/corpus/apify-jobs.ts                              (mv)
    src/lib/engine/_dormant/corpus/bucketing.ts                               (mv)
    src/lib/engine/_dormant/corpus/baseline.ts                                (mv)
    src/lib/engine/_dormant/corpus/calibration.ts                             (mv)
    src/lib/engine/_dormant/corpus/corpus-version.ts                          (mv)
    src/lib/engine/_dormant/corpus/eval-config.ts                             (mv)
    src/lib/engine/_dormant/corpus/eval-harness.ts                            (mv)
    src/lib/engine/_dormant/corpus/eval-runner.ts                             (mv)
    src/lib/engine/_dormant/corpus/failure-cases.ts                           (mv)
    src/lib/engine/_dormant/corpus/thresholds.ts                              (mv)
    src/lib/engine/_dormant/corpus/cli/                                       (mv)
    src/lib/engine/_dormant/corpus/metrics/                                   (mv)
    src/lib/engine/_dormant/corpus/__tests__/                                 (mv — all corpus tests except follower-tier.test.ts)
    src/lib/engine/_dormant/engine/__tests__/retrieval/                       (mv from src/lib/engine/__tests__/retrieval/)
    src/lib/engine/_dormant/components/trending/                              (mv from src/components/trending/)
    src/lib/engine/_dormant/components/board/actions/SimilarVideosCard.tsx    (mv)
    src/lib/engine/_dormant/components/board/actions/SimilarVideoCardCompact.tsx  (mv)
    src/lib/engine/_dormant/components/board/actions/__tests__/SimilarVideosCard.test.tsx        (mv)
    src/lib/engine/_dormant/components/board/actions/__tests__/SimilarVideosCard.empty.test.tsx  (mv)
    src/lib/engine/_dormant/components/board/actions/__tests__/SimilarVideosCard.focus.test.tsx  (mv)
    src/lib/engine/corpus/embedder.ts                                         (NEW — mv from retrieval/embedder.ts before moving retrieval dir)
    src/lib/engine/corpus/__tests__/embedder.test.ts                          (NEW — mv from __tests__/retrieval/embedder.test.ts)
    src/app/api/webhooks/apify/route.ts                                       (edit import path)
    src/lib/engine/corpus/orchestrator.ts                                     (NOT edited — moves AS-IS; its retrieval/embedder import becomes broken but file is dormant + excluded)
    tsconfig.json                                                             (edit: add _dormant to exclude)
    vitest.config.ts                                                          (edit: add **/_dormant/** to test.exclude + coverage.exclude)
  </files>
  <action>
    Order of operations matters — embedder must be relocated BEFORE the retrieval/ directory is moved, so the active-tree consumer (apify webhook) never points at a dead path.

    Per D-01, D-03, D-06, D-07 and the import-graph audit in `<corpus_import_graph_audit>` / `<trending_callgraph_audit>`:

    1. Create `src/lib/engine/_dormant/` (empty marker directory if needed) so subsequent `git mv` targets resolve.

    2. **Relocate active-tree embedder FIRST (before retrieval/ moves):**
       - `git mv src/lib/engine/retrieval/embedder.ts src/lib/engine/corpus/embedder.ts`
       - `git mv src/lib/engine/__tests__/retrieval/embedder.test.ts src/lib/engine/corpus/__tests__/embedder.test.ts`
       - Inside the relocated `src/lib/engine/corpus/embedder.ts`: no path-relative imports exist (file uses only `@google/genai`-style externals, env vars, and same-package types if any) — but verify with `grep -n "^import\|from " src/lib/engine/corpus/embedder.ts` after the move. If any import was `./X` or `../retrieval/X`, rewrite to `../retrieval/X` → `./X` only when X also moves to corpus/, otherwise leave path unchanged and let Task 3 sweep stragglers.
       - Inside the relocated `src/lib/engine/corpus/__tests__/embedder.test.ts`: rewrite the SUT import from `@/lib/engine/retrieval/embedder` to `@/lib/engine/corpus/embedder`. Other imports unchanged.
       - In `src/app/api/webhooks/apify/route.ts` (line 6): change `import { buildSubjectText, embedBatch } from "@/lib/engine/retrieval/embedder";` to `import { buildSubjectText, embedBatch } from "@/lib/engine/corpus/embedder";`. **No other webhook edits** (this file stays KEEP per MILESTONE.md).

    3. **Move the entire retrieval directory:**
       - `git mv src/lib/engine/retrieval src/lib/engine/_dormant/retrieval`
       - `git mv src/lib/engine/__tests__/retrieval src/lib/engine/_dormant/engine/__tests__/retrieval` (preserve the test/source pairing under _dormant/; the exact intra-_dormant/ layout doesn't matter because vitest + tsc both ignore the tree).

    4. **Move runtime-only corpus files** per the audit. Use `git mv` for each:
       - `git mv src/lib/engine/corpus/orchestrator.ts src/lib/engine/_dormant/corpus/orchestrator.ts`
       - same for: `normalize-scrape.ts`, `apify-jobs.ts`, `bucketing.ts`, `baseline.ts`, `calibration.ts`, `corpus-version.ts`, `eval-config.ts`, `eval-harness.ts`, `eval-runner.ts`, `failure-cases.ts`, `thresholds.ts`.
       - `git mv src/lib/engine/corpus/cli src/lib/engine/_dormant/corpus/cli`
       - `git mv src/lib/engine/corpus/metrics src/lib/engine/_dormant/corpus/metrics`
       - `git mv` every file under `src/lib/engine/corpus/__tests__/` EXCEPT `follower-tier.test.ts` into `src/lib/engine/_dormant/corpus/__tests__/`. Easiest: `mkdir -p src/lib/engine/_dormant/corpus/__tests__` then `git mv` each test file individually (orchestrator.test.ts, normalize-scrape.test.ts, apify-jobs.test.ts, bucketing.test.ts, build-corpus-args.test.ts, calibration.test.ts, corpus-version.test.ts, eval-args.test.ts, eval-config.test.ts, eval-harness.test.ts, eval-runner.test.ts, failure-cases.test.ts, bootstrap.test.ts, leave-one-out.test.ts, macro-f1.test.ts, score-to-bucket.test.ts, stage-latency.test.ts, thresholds.test.ts).
       - **DO NOT** move `corpus/follower-tier.ts` or `corpus/__tests__/follower-tier.test.ts` — they stay active (consumed by `src/lib/engine/wave4/platform-fit-prompts.ts` at line 17).

    5. **Move the trending UI surfaces:**
       - `git mv src/components/trending src/lib/engine/_dormant/components/trending` (mirrors the components/board move below; keeping _dormant/ as the single dormant container per D-01).
       - `git mv src/components/board/actions/SimilarVideosCard.tsx src/lib/engine/_dormant/components/board/actions/SimilarVideosCard.tsx`
       - `git mv src/components/board/actions/SimilarVideoCardCompact.tsx src/lib/engine/_dormant/components/board/actions/SimilarVideoCardCompact.tsx`
       - Move the three SimilarVideosCard test files from `src/components/board/actions/__tests__/` into `src/lib/engine/_dormant/components/board/actions/__tests__/` (keep `ActionsNode.test.tsx` in place — Task 2 edits it).

    6. **Update tsconfig.json exclude:**
       Change `"exclude": ["node_modules", "extraction", "verification", "scripts", "e2e"]` to `"exclude": ["node_modules", "extraction", "verification", "scripts", "e2e", "**/_dormant/**"]`.

    7. **Update vitest.config.ts:**
       Add to `test` block: `exclude: ["**/_dormant/**", "**/node_modules/**", "**/dist/**", ".idea", ".git", ".cache"]` (preserve vitest defaults by listing them — vitest's default exclude vanishes if `test.exclude` is set, so re-add node_modules/dist/cache defaults). Also add `"**/_dormant/**"` to `coverage.exclude`.

    8. **Do NOT** edit imports inside files that are moving to _dormant/ (e.g. orchestrator.ts still importing `@/lib/engine/retrieval/embedder` — that import is now a broken path, but the file is in _dormant/ and excluded from compile + test). This is intentional per D-02 reversibility: M2 reverses the moves and the original imports light back up.

    Rationale for naming: keeping every dormant artifact under a single `src/lib/engine/_dormant/` root (including `_dormant/components/...`) gives M2 one directory rename to restore everything. The alternative — separate `src/components/_dormant/` and `src/lib/engine/_dormant/` — fragments the convention.
  </action>
  <verify>
    <automated><![CDATA[
# Run as a single bash block so each step's failure aborts the verify.
set -e

# A. Directory structure exists, expected files moved
test -d src/lib/engine/_dormant/retrieval/ && echo "OK: _dormant/retrieval exists"
test -f src/lib/engine/_dormant/retrieval/retrieval-stage.ts && echo "OK: retrieval-stage in _dormant"
test -f src/lib/engine/_dormant/corpus/orchestrator.ts && echo "OK: orchestrator in _dormant"
test -d src/lib/engine/_dormant/components/trending/ && echo "OK: components/trending in _dormant"
test -f src/lib/engine/_dormant/components/board/actions/SimilarVideosCard.tsx && echo "OK: SimilarVideosCard in _dormant"

# B. Active-tree embedder present, old retrieval/embedder.ts gone
test -f src/lib/engine/corpus/embedder.ts && echo "OK: corpus/embedder.ts present"
test ! -f src/lib/engine/retrieval/embedder.ts && echo "OK: old retrieval/embedder.ts absent"
test ! -d src/lib/engine/retrieval && echo "OK: retrieval/ dir removed from active tree"

# C. follower-tier KEPT active
test -f src/lib/engine/corpus/follower-tier.ts && echo "OK: follower-tier kept active"

# D. Webhook import path updated
grep -q '@/lib/engine/corpus/embedder' src/app/api/webhooks/apify/route.ts && echo "OK: webhook imports corpus/embedder"
! grep -q '@/lib/engine/retrieval/embedder' src/app/api/webhooks/apify/route.ts && echo "OK: webhook no longer imports retrieval/embedder"

# E. tsconfig + vitest excludes contain _dormant
grep -q '_dormant' tsconfig.json && echo "OK: tsconfig excludes _dormant"
grep -q '_dormant' vitest.config.ts && echo "OK: vitest excludes _dormant"

# F. No active-tree file imports from _dormant
# (Excluding the _dormant/ tree itself from the search.)
hits=$(grep -RIn 'from "@/lib/engine/_dormant\|from .*_dormant/' src/ --exclude-dir=_dormant 2>/dev/null | grep -v '^[[:space:]]*//\|^[[:space:]]*\*' | wc -l | tr -d ' ')
if [ "$hits" = "0" ]; then echo "OK: no active-tree imports of _dormant"; else echo "FAIL: active-tree imports _dormant ($hits hits)"; exit 1; fi

# G. tsc compiles (excluding _dormant) — proves embedder relocation didn't break webhook
pnpm exec tsc --noEmit
echo "OK: tsc --noEmit clean after Task 1"
]]></automated>
  </verify>
  <done>
    `src/lib/engine/_dormant/` contains retrieval/, runtime-only corpus files, components/trending/, and SimilarVideosCard*.
    `src/lib/engine/corpus/embedder.ts` exists and is imported by the apify webhook.
    `src/lib/engine/corpus/follower-tier.ts` remains active.
    `tsconfig.json` + `vitest.config.ts` exclude `**/_dormant/**`.
    `pnpm exec tsc --noEmit` is clean.
    Zero active-tree imports point at `_dormant/`.
  </done>
</task>

<task type="auto">
  <name>Task 2: Delete /trending route + strip Trending nav + remove SimilarVideosCard from ActionsNode</name>
  <files>
    src/app/(app)/trending/                                                   (DELETE entire directory: page.tsx, trending-client.tsx)
    src/app/api/trending/                                                     (DELETE entire directory: route.ts, [videoId]/route.ts, stats/route.ts)
    src/hooks/queries/use-trending.ts                                         (DELETE)
    src/hooks/queries/index.ts                                                (edit — remove use-trending re-export)
    src/lib/mappers/trending.ts                                               (DELETE)
    src/lib/mappers/index.ts                                                  (edit — remove trending re-export if present)
    src/types/trending.ts                                                     (DELETE — audit confirms zero active callers post-deletion)
    src/lib/supabase/middleware.ts                                            (edit — remove "/trending" from PROTECTED_PREFIXES at line 18)
    src/components/sidebar/Sidebar.tsx                                        (edit — strip isOnTrending state at line 182 + Trending nav button at line 323)
    src/components/app/sidebar.tsx                                            (edit — strip Trending navItems entry at line 34, and any TrendUp icon import if now unused)
    src/components/board/actions/ActionsNode.tsx                              (edit — drop SimilarVideosCard import line 11, remove both render branches at ~line 89 + ~line 113; collapse 2x2 grid layout to 1x2 or 1x3 as appropriate for remaining cards: ReshootHero, OptimalPost, Share)
    src/components/board/actions/actions-constants.ts                         (edit — remove any retrieval/SimilarVideos references; keep TELEMETRY, ACTIONS_GRID_DEFAULT_ROWS, ACTIONS_GRID_AV_ROWS but adjust the grid-row constants if Similar slot removal changes layout)
    src/components/board/actions/__tests__/ActionsNode.test.tsx               (edit — drop any SimilarVideosCard-render assertions and update grid-slot expectations)
  </files>
  <action>
    Per D-04, D-05, D-06 and the `<trending_callgraph_audit>`:

    1. **Delete route surfaces (hard 404 per D-05):**
       ```
       git rm -r src/app/\(app\)/trending
       git rm -r src/app/api/trending
       ```
       Next.js's default 404 will respond to `/trending` and `/api/trending/*` without any redirect, per D-05.

    2. **Delete client-side trending plumbing (no active callers — see audit):**
       ```
       git rm src/hooks/queries/use-trending.ts
       git rm src/lib/mappers/trending.ts
       git rm src/types/trending.ts
       ```

    3. **Edit barrel files:**
       - `src/hooks/queries/index.ts` line 1: remove `export { useTrendingVideos, useTrendingStats } from "./use-trending";`. If that was the only export, ensure the file remains valid (re-export others or leave as comment). Read the file first to confirm shape.
       - `src/lib/mappers/index.ts`: read first, then remove any `export ... from "./trending"` line if present. Leave deals/etc exports intact.

    4. **Middleware:**
       In `src/lib/supabase/middleware.ts` around line 18, remove the `"/trending"` entry from the `PROTECTED_PREFIXES` array (or whatever the surrounding identifier is — preserve other entries). Read the surrounding context first to keep array formatting clean.

    5. **Strip Trending nav from BOTH sidebars (D-04, no legacy detection):**
       - `src/components/sidebar/Sidebar.tsx`:
         - Line ~182: remove the `const isOnTrending = pathname.startsWith("/trending");` declaration.
         - Line ~323: remove the nav button JSX block invoking `router.push("/trending")`. Scrub any `isOnTrending` references that lit up the button's active state.
         - If `TrendUp`/`Trending` icon imports become unused after the removal, strip them too.
       - `src/components/app/sidebar.tsx`:
         - Line ~34: remove the `{ label: "Trending", icon: TrendUp, id: "trending", href: "/trending" }` entry from `navItems`.
         - Strip the `TrendUp` icon import if now unused.

    6. **Remove SimilarVideosCard from ActionsNode:**
       In `src/components/board/actions/ActionsNode.tsx`:
       - Line 11: delete `import { SimilarVideosCard } from './SimilarVideosCard';`.
       - Around line 86-95 (the AV-state bottom row slot): remove the entire `<SimilarVideosCard ... />` block. The grid layout that previously hosted it should reflow — collapse the row count if needed (consult ACTIONS_GRID_AV_ROWS in `actions-constants.ts`).
       - Around line 99-120 (the default 2x2 grid slot): remove the second `<SimilarVideosCard ... />` block. Now the remaining cards are Reshoot, OptimalPost, Share — that's a 1x3 row, not a 2x2. Update the surrounding JSX comment + any local grid-template-rows / wrapper height styling to match. Confirm by reading lines 80-130 first.

    7. **actions-constants.ts:**
       Read the file. If `ACTIONS_GRID_DEFAULT_ROWS` or `ACTIONS_GRID_AV_ROWS` encodes the old 2x2 / 4-card layout, update to reflect the 3-card row. If the constants don't enforce row-counts (only telemetry/labels), no edits needed. Remove any constant whose only consumer was the deleted SimilarVideosCard. The plan does NOT mandate a specific row constant value — choose whatever keeps the visual layout sensible for three cards in a single row, matching the Raycast 6%/12px-radius conventions already used in this file.

    8. **ActionsNode test:**
       In `src/components/board/actions/__tests__/ActionsNode.test.tsx`:
       - Drop every `screen.getBy*` / `expect(...)` line that asserts SimilarVideosCard renders.
       - Drop any mock for `SimilarVideosCard` (the import itself just disappeared).
       - Update grid-shape assertions (e.g. "renders 4 cards" → "renders 3 cards") if present.
       - Read the file before editing to map out the exact lines.

    Out of scope for this task: editing pipeline.ts (Task 3), editing pipeline/aggregator tests (Task 3), database.types.ts (deferred per CONTEXT deferred ideas).
  </action>
  <verify>
    <automated><![CDATA[
set -e

# A. Phase 1 success criteria 1, 2, 3 — zero grep hits in src/ (excluding _dormant/)
sim_hits=$(grep -RIn 'SimilarVideosCard' src/ --exclude-dir=_dormant 2>/dev/null | wc -l | tr -d ' ')
if [ "$sim_hits" = "0" ]; then echo "OK: SC1 — no SimilarVideosCard hits"; else echo "FAIL: SimilarVideosCard still present ($sim_hits hits)"; exit 1; fi

api_hits=$(grep -RIn '/api/trending' src/ --exclude-dir=_dormant 2>/dev/null | wc -l | tr -d ' ')
if [ "$api_hits" = "0" ]; then echo "OK: SC2 — no /api/trending hits"; else echo "FAIL: /api/trending still present ($api_hits hits)"; exit 1; fi

dash_hits=$(grep -RInE '/dashboard/trending|trending-dashboard' src/ --exclude-dir=_dormant 2>/dev/null | wc -l | tr -d ' ')
if [ "$dash_hits" = "0" ]; then echo "OK: SC3 — no /dashboard/trending or trending-dashboard hits"; else echo "FAIL: dashboard/trending refs remain ($dash_hits hits)"; exit 1; fi

# B. Deleted files actually gone
test ! -d 'src/app/(app)/trending' && echo "OK: /trending page directory removed"
test ! -d src/app/api/trending && echo "OK: /api/trending directory removed"
test ! -f src/hooks/queries/use-trending.ts && echo "OK: use-trending.ts deleted"
test ! -f src/lib/mappers/trending.ts && echo "OK: mappers/trending.ts deleted"
test ! -f src/types/trending.ts && echo "OK: types/trending.ts deleted"

# C. Middleware no longer references /trending in PROTECTED_PREFIXES (allow comment refs)
mid_hits=$(grep -n '"/trending"' src/lib/supabase/middleware.ts 2>/dev/null | wc -l | tr -d ' ')
if [ "$mid_hits" = "0" ]; then echo "OK: middleware /trending stripped"; else echo "FAIL: middleware still has /trending string"; exit 1; fi

# D. Sidebars no longer surface Trending nav (allow stray comments — gate on JSX/data)
side1_hits=$(grep -nE 'push\("/trending"\)|href:[[:space:]]*"/trending"|label:[[:space:]]*"Trending"' src/components/sidebar/Sidebar.tsx src/components/app/sidebar.tsx 2>/dev/null | wc -l | tr -d ' ')
if [ "$side1_hits" = "0" ]; then echo "OK: both sidebars stripped of Trending nav"; else echo "FAIL: sidebar Trending nav still present"; exit 1; fi

# E. ActionsNode no longer imports SimilarVideosCard
an_hits=$(grep -c 'SimilarVideosCard' src/components/board/actions/ActionsNode.tsx 2>/dev/null || true)
if [ "$an_hits" = "0" ]; then echo "OK: ActionsNode SimilarVideosCard-free"; else echo "FAIL: ActionsNode still references SimilarVideosCard ($an_hits hits)"; exit 1; fi

# F. tsc still clean
pnpm exec tsc --noEmit
echo "OK: tsc --noEmit clean after Task 2"

# G. Targeted tests pass for edited surfaces
pnpm exec vitest run src/components/board/actions/__tests__/ActionsNode.test.tsx
echo "OK: ActionsNode tests green"
]]></automated>
  </verify>
  <done>
    Phase 1 success criteria 1, 2, 3 all met (zero src/ hits for SimilarVideosCard, /api/trending, /dashboard/trending, trending-dashboard).
    Both sidebars no longer render a Trending nav item.
    `/trending` returns Next.js default 404 (no page exists).
    ActionsNode no longer imports or renders SimilarVideosCard; ActionsNode.test.tsx is green with updated expectations.
    `pnpm exec tsc --noEmit` clean.
  </done>
</task>

<task type="auto">
  <name>Task 3: Swap pipeline retrieval call for createEmptyRetrievalResult() helper + clean pipeline/aggregator tests + final green-gate</name>
  <files>
    src/lib/engine/retrieval-empty.ts                                         (NEW — single swap point per D-10)
    src/lib/engine/pipeline.ts                                                (edit — strip retrieval import, DEFAULT_RETRIEVAL_RESULT const, retrievalPromise IIFE, Wave 1 slot; assign retrievalResult from helper)
    src/lib/engine/__tests__/pipeline.test.ts                                 (edit — drop retrieval mocks; update PipelineResult shape assertions; the two retrieval-specific test cases at lines 926 + 953 either delete or rewrite against the helper)
    src/lib/engine/__tests__/aggregator.test.ts                               (edit — drop retrieval-stage mocks if present; replace with helper-result fixtures so the 0.05 retrieval weight path still asserts cleanly)
  </files>
  <action>
    Per D-08, D-09, D-10:

    1. **Create the helper at `src/lib/engine/retrieval-empty.ts`:**
       Exact contents — see `<interfaces>` block above. The helper:
       - Imports `BenchmarkRetrievalResult` from `./types` (which stays in active tree).
       - Exports a function `createEmptyRetrievalResult(): BenchmarkRetrievalResult`.
       - Returns `{ evidence: [], score: null, availability: false, cost_cents: 0 }` — bit-for-bit identical to the existing pipeline.ts:259-264 `DEFAULT_RETRIEVAL_RESULT` and to the `GRACEFUL_EMPTY` in the now-dormant retrieval-stage.ts.
       - Co-located with pipeline.ts (`src/lib/engine/retrieval-empty.ts`) per D-10 ("co-located near the pipeline — easy to swap for the real call when M2 corpus restores retrieval").

    2. **Edit `src/lib/engine/pipeline.ts`:**
       - Line 19 (inside the type-import block): KEEP `type BenchmarkRetrievalResult,` — aggregator still receives this type.
       - Line 39: DELETE `import { runBenchmarkRetrieval } from "./retrieval/retrieval-stage";`.
       - Add new import (near other engine-local imports): `import { createEmptyRetrievalResult } from "./retrieval-empty";`.
       - Lines 255-264: DELETE the `// Phase 8 — Wave-1 retrieval graceful-empty fallback` block and the entire `DEFAULT_RETRIEVAL_RESULT` const declaration. The helper supersedes it.
       - Lines 696-722: DELETE the entire `// Stage 6.5: Benchmark Retrieval` block plus the `retrievalPromise` IIFE + its outer try/catch + Sentry.captureException + warnings.push + timings.push lines.
       - Lines 731 + 740 (the Wave 1 destructure + Promise.all): SHRINK from 5 slots to 4. Replace
         ```
         const [geminiResult, audioFingerprintResult, , ruleResult, retrievalResult] = await timed(
           "wave_1",
           timings,
           () =>
             Promise.all([
               geminiPromise,
               audioFingerprintPromise,
               creatorPromise,
               rulePromise,
               retrievalPromise,
             ]),
           { wave: 1, onEvent: onStageEvent }
         );
         ```
         with
         ```
         const [geminiResult, audioFingerprintResult, , ruleResult] = await timed(
           "wave_1",
           timings,
           () =>
             Promise.all([
               geminiPromise,
               audioFingerprintPromise,
               creatorPromise,
               rulePromise,
             ]),
           { wave: 1, onEvent: onStageEvent }
         );
         const retrievalResult = createEmptyRetrievalResult();
         ```
       - Update the Sentry breadcrumb at line ~749 — change the `stages` array from `["gemini", "audio_fingerprint", "creator", "rules", "retrieval"]` to `["gemini", "audio_fingerprint", "creator", "rules"]` (the synthesized helper isn't a real stage).
       - Line ~978 (aggregator handoff): no edit needed — `retrievalResult` is still defined in scope and matches the type.
       - DO NOT edit aggregator.ts. The null-safe path at aggregator.ts:890 (`(pipelineResult.retrievalResult.score ?? 0) * 100`) already handles `score: null` correctly per D-09.

    3. **Edit `src/lib/engine/__tests__/pipeline.test.ts`:**
       Read the file first (52KB — focus on the two retrieval-specific test cases at lines 926 and 953, plus any earlier vi.mock blocks that stub `./retrieval/retrieval-stage`).
       - Remove any `vi.mock("@/lib/engine/retrieval/retrieval-stage", ...)` block (path no longer resolves).
       - Remove any `vi.mock("./retrieval/retrieval-stage", ...)` block.
       - The test at ~line 926 ("PipelineResult includes retrievalResult with full BenchmarkRetrievalResult shape, async"): KEEP and rewrite — it should now assert that `result.retrievalResult` equals `createEmptyRetrievalResult()` (or matches `{ evidence: [], score: null, availability: false, cost_cents: 0 }`). The expectation is the post-strip surface per D-08.
       - The test at ~line 953 ("retrieval failure pushes warning + returns empty BenchmarkRetrievalResult"): DELETE entirely — the failure-path is no longer reachable now that pipeline.ts has no retrievalPromise to throw. Per D-08 ("they still need to assert pipeline + aggregator behavior on the post-strip surface"), this assertion no longer corresponds to live behavior.
       - Any test that checks `warnings` for the string "Retrieval unavailable" needs to drop that expectation.
       - Any test that asserts `timings` includes a `"retrieval"` stage: drop that assertion or replace with the new stage list.

    4. **Edit `src/lib/engine/__tests__/aggregator.test.ts`:**
       Read the file. Search for `retrieval` references. If the suite mocks `runBenchmarkRetrieval` or constructs a fake retrieval-stage result, replace those construction sites with a literal `{ evidence: [], score: null, availability: false, cost_cents: 0 }` fixture or by calling `createEmptyRetrievalResult` from the helper (after importing it). The 0.05-weight aggregator path should remain asserted — drop only the mocks, not the score-redistribution coverage. Per D-08, this test stays active and asserts post-strip aggregator behavior.

    5. **Verify nothing else in the engine still imports retrieval-stage or runBenchmarkRetrieval.** If any wave3/wave4/wave5/anti-virality/aggregator-* test still has a stale `runBenchmarkRetrieval` mock, drop it (those mocks become orphaned). Spend at most 5 minutes on this sweep — grep `runBenchmarkRetrieval` + `retrieval-stage` across `src/` excluding `_dormant/`.

    6. **Final green-gate (the verify block below runs the trio).**
  </action>
  <verify>
    <automated><![CDATA[
set -e

# A. Helper exists and is exported correctly
test -f src/lib/engine/retrieval-empty.ts && echo "OK: retrieval-empty.ts created"
grep -q 'export function createEmptyRetrievalResult' src/lib/engine/retrieval-empty.ts && echo "OK: helper exported"

# B. pipeline.ts no longer references retrieval-stage / DEFAULT_RETRIEVAL_RESULT / retrievalPromise
# Allow comment mentions ("DEFAULT_RETRIEVAL_RESULT" in comments OK).
pipe_violations=$(grep -nE 'from "./retrieval/retrieval-stage"|runBenchmarkRetrieval|retrievalPromise[[:space:]]*=|const DEFAULT_RETRIEVAL_RESULT' src/lib/engine/pipeline.ts | grep -v '^[[:space:]]*\*\|^[[:space:]]*//' | wc -l | tr -d ' ')
if [ "$pipe_violations" = "0" ]; then echo "OK: pipeline.ts stripped"; else echo "FAIL: pipeline.ts still references retrieval-stage / retrievalPromise / DEFAULT_RETRIEVAL_RESULT"; grep -nE 'from "./retrieval/retrieval-stage"|runBenchmarkRetrieval|retrievalPromise[[:space:]]*=|const DEFAULT_RETRIEVAL_RESULT' src/lib/engine/pipeline.ts; exit 1; fi

# C. pipeline.ts imports the new helper
grep -q "from \"./retrieval-empty\"" src/lib/engine/pipeline.ts && echo "OK: pipeline.ts imports helper"
grep -q 'createEmptyRetrievalResult()' src/lib/engine/pipeline.ts && echo "OK: pipeline.ts calls helper"

# D. No active-tree code still imports runBenchmarkRetrieval anywhere
sweeper=$(grep -RIn 'runBenchmarkRetrieval\|from .*retrieval/retrieval-stage' src/ --exclude-dir=_dormant 2>/dev/null | wc -l | tr -d ' ')
if [ "$sweeper" = "0" ]; then echo "OK: no active-tree refs to runBenchmarkRetrieval"; else echo "FAIL: stale runBenchmarkRetrieval refs"; grep -RIn 'runBenchmarkRetrieval\|from .*retrieval/retrieval-stage' src/ --exclude-dir=_dormant; exit 1; fi

# E. The full success-criterion-5 trio
pnpm exec tsc --noEmit
echo "OK: tsc --noEmit clean"

pnpm test
echo "OK: pnpm test green"

pnpm build
echo "OK: pnpm build green"
]]></automated>
  </verify>
  <done>
    `src/lib/engine/retrieval-empty.ts` exists and exports `createEmptyRetrievalResult()` returning `{ evidence: [], score: null, availability: false, cost_cents: 0 }`.
    `pipeline.ts` has no `runBenchmarkRetrieval` import, no `DEFAULT_RETRIEVAL_RESULT` const, no `retrievalPromise` IIFE; Wave 1 is 4 slots; `retrievalResult` is assigned from the helper; aggregator handoff at the bottom of `predictionPipeline` still passes the helper result through unchanged.
    `pipeline.test.ts` and `aggregator.test.ts` no longer mock `retrieval-stage`; they assert the post-strip helper shape per D-08.
    Phase 1 success criterion 5 satisfied: `pnpm exec tsc --noEmit` + `pnpm test` + `pnpm build` all green.
    Phase 1 success criterion 4 implicitly preserved: `enrichWithTrends` (active in pipeline) still reads `trending_sounds`; apify webhook still writes to `scraped_videos` via untouched ingestion path.
  </done>
</task>

</tasks>

<verification>
Phase-level gate (run after Task 3):

```bash
set -e

# Success Criterion 1
[ "$(grep -RIn 'SimilarVideosCard' src/ --exclude-dir=_dormant | wc -l | tr -d ' ')" = "0" ]

# Success Criterion 2
[ "$(grep -RIn '/api/trending' src/ --exclude-dir=_dormant | wc -l | tr -d ' ')" = "0" ]

# Success Criterion 3
[ "$(grep -RInE '/dashboard/trending|trending-dashboard' src/ --exclude-dir=_dormant | wc -l | tr -d ' ')" = "0" ]

# Success Criterion 4 — ingestion intact (smoke check)
grep -q 'scraped_videos' src/app/api/cron/scrape-trending/route.ts
grep -q 'enrichWithTrends' src/lib/engine/pipeline.ts
grep -q 'corpus/embedder' src/app/api/webhooks/apify/route.ts

# Success Criterion 5
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

Additional manual sanity (not gating, but recommended): `pnpm dev`, hit `/trending` in browser, confirm Next.js 404 page renders. Hit `/analyze`, upload a video, watch the pipeline complete with Wave 1 reporting 4 stages (gemini, audio_fingerprint, creator, rules) and aggregator producing an overall_score with the 0.05 retrieval weight redistributed (other stages contributing slightly more proportionally).
</verification>

<success_criteria>
- [ ] `src/lib/engine/_dormant/` contains every file the M2 corpus milestone needs to restore via folder rename (retrieval/, runtime-only corpus files, components/trending/, SimilarVideosCard*, all their tests).
- [ ] `src/lib/engine/corpus/embedder.ts` and `src/lib/engine/corpus/follower-tier.ts` are in the active tree and are the ONLY corpus files that survive there.
- [ ] Apify webhook imports `@/lib/engine/corpus/embedder` and continues to write `scraped_videos`.
- [ ] `tsconfig.json` and `vitest.config.ts` both exclude `**/_dormant/**`.
- [ ] `/trending` and `/api/trending/*` return Next.js default 404 (no redirect).
- [ ] Neither `src/components/sidebar/Sidebar.tsx` nor `src/components/app/sidebar.tsx` renders a Trending nav item.
- [ ] `ActionsNode.tsx` no longer imports or renders `SimilarVideosCard`.
- [ ] `src/lib/engine/retrieval-empty.ts` exports `createEmptyRetrievalResult()` and is the single swap point pipeline.ts uses.
- [ ] `src/lib/engine/pipeline.ts` no longer imports `runBenchmarkRetrieval`, has no `DEFAULT_RETRIEVAL_RESULT` const, has no `retrievalPromise`, and runs Wave 1 with 4 stages.
- [ ] `pipeline.test.ts` and `aggregator.test.ts` are edited to assert the post-strip surface (no retrieval-stage mocks).
- [ ] All three green-gates pass: `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build`.
- [ ] All five ROADMAP §"Phase 1" Success Criteria pass.
</success_criteria>

<output>
After completion, create `.planning/quick/260528-mzd-strip-retrieval-similar-videos-trending-/260528-mzd-SUMMARY.md` capturing:
- Files moved into `_dormant/` (exhaustive list)
- Active-tree files relocated (corpus/embedder, etc.)
- Files deleted outright (trending route, mappers, types, use-trending)
- Files edited (pipeline.ts, both sidebars, middleware, ActionsNode, configs, two test files)
- The single M2 restore path: "rename src/lib/engine/_dormant/ → unpack to original locations; swap createEmptyRetrievalResult() for runBenchmarkRetrieval() in pipeline.ts; restore retrieval/retrieval-stage import."
- Any deviation from the plan (none expected) + grep-gate results
</output>
