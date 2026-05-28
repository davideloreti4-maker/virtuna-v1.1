---
quick_id: 260528-mzd
phase: 01-strip-retrieval-similar-videos-trending-dashboard
plan: 01
subsystem: engine/corpus/pipeline/ui
tags: [mvp-cut, dormant, retrieval, trending, similar-videos, pipeline]
depends_on: []
provides:
  - src/lib/engine/_dormant/ (M2 restore directory)
  - src/lib/engine/corpus/embedder.ts (active-tree ingestion embedder)
  - src/lib/engine/retrieval-empty.ts (D-10 swap point)
affects:
  - src/lib/engine/pipeline.ts
  - src/components/sidebar/Sidebar.tsx
  - src/components/app/sidebar.tsx
  - src/components/board/actions/ActionsNode.tsx
  - src/app/api/webhooks/apify/route.ts
tech-stack:
  added: []
  patterns:
    - _dormant/ directory convention for reversible code parking
    - createEmptyRetrievalResult() single-swap-point pattern (D-10)
key-files:
  created:
    - src/lib/engine/_dormant/ (entire tree)
    - src/lib/engine/corpus/embedder.ts (relocated from retrieval/)
    - src/lib/engine/corpus/__tests__/embedder.test.ts (relocated)
    - src/lib/engine/retrieval-empty.ts
  modified:
    - src/app/api/webhooks/apify/route.ts
    - src/components/board/actions/ActionsNode.tsx
    - src/components/board/actions/actions-constants.ts
    - src/components/board/actions/__tests__/ActionsNode.test.tsx
    - src/components/sidebar/Sidebar.tsx
    - src/components/app/sidebar.tsx
    - src/hooks/queries/index.ts
    - src/lib/engine/__tests__/pipeline.test.ts
    - src/lib/engine/pipeline.ts
    - src/lib/mappers/index.ts
    - src/lib/supabase/middleware.ts
    - tsconfig.json
    - vitest.config.ts
  deleted:
    - src/app/(app)/trending/ (page.tsx + trending-client.tsx)
    - src/app/api/trending/ (route.ts, [videoId]/route.ts, stats/route.ts)
    - src/hooks/queries/use-trending.ts
    - src/lib/mappers/trending.ts
    - src/types/trending.ts
decisions:
  - "D-01: All dormant files parked under single src/lib/engine/_dormant/ root for one-rename M2 restore"
  - "D-10: createEmptyRetrievalResult() at src/lib/engine/retrieval-empty.ts is single swap point"
  - "D-05: /trending returns Next.js default 404; no redirect"
  - "ActionsNode grid updated to 3-card layout (Reshoot + OptimalPost + Share) after SimilarVideosCard removal"
metrics:
  duration: ~50 minutes
  completed: 2026-05-28T14:56:03Z
  tasks: 3
  files_modified: 13
  files_created: ~65 (mostly _dormant/ moves)
  files_deleted: 8
---

# Phase 01 Plan 01: Strip Retrieval + Similar Videos + /trending Dashboard Summary

Strip M2-corpus-dependent surfaces from the runtime. Park retrieval/, runtime-only corpus files, trending UI surfaces, and SimilarVideosCard* under `src/lib/engine/_dormant/` for reversible M2 restore via directory rename. Wire pipeline.ts to synthesized empty BenchmarkRetrievalResult via createEmptyRetrievalResult() helper.

## What Was Done

### Task 1: Park dormant code + relocate ingestion-side embedder + update build/test excludes

**Files moved into `_dormant/`:**
- `src/lib/engine/_dormant/retrieval/` — retrieval-stage.ts, bucket-derivation.ts, pgvector-client.ts, re-ranker.ts, cli/embed-corpus-args.ts
- `src/lib/engine/_dormant/corpus/` — orchestrator.ts, normalize-scrape.ts, apify-jobs.ts, bucketing.ts, baseline.ts, calibration.ts, corpus-version.ts, eval-config.ts, eval-harness.ts, eval-runner.ts, failure-cases.ts, thresholds.ts
- `src/lib/engine/_dormant/corpus/cli/` — build-corpus-args.ts, eval-args.ts, ml-audit.ts
- `src/lib/engine/_dormant/corpus/metrics/` — bootstrap.ts, ece.ts, index.ts, leave-one-out.ts, macro-f1.ts, score-to-bucket.ts, stage-latency.ts
- `src/lib/engine/_dormant/corpus/__tests__/` — all corpus tests except follower-tier.test.ts (18 test files)
- `src/lib/engine/_dormant/engine/__tests__/retrieval/` — bucket-derivation.test.ts, pgvector-client.test.ts, re-ranker.test.ts, retrieval-stage.test.ts
- `src/lib/engine/_dormant/components/trending/` — 8 components (empty-state.tsx, index.ts, tiktok-embed.tsx, velocity-indicator.tsx, video-card-skeleton.tsx, video-card.tsx, video-detail-modal.tsx, video-grid.tsx)
- `src/lib/engine/_dormant/components/board/actions/` — SimilarVideosCard.tsx, SimilarVideoCardCompact.tsx, 3 test files

**Active-tree files relocated:**
- `src/lib/engine/retrieval/embedder.ts` → `src/lib/engine/corpus/embedder.ts`
- `src/lib/engine/__tests__/retrieval/embedder.test.ts` → `src/lib/engine/corpus/__tests__/embedder.test.ts`

**Config edits:**
- `tsconfig.json`: added `**/_dormant/**` to exclude
- `vitest.config.ts`: added `**/_dormant/**` to test.exclude + coverage.exclude
- `src/app/api/webhooks/apify/route.ts`: import path `@/lib/engine/retrieval/embedder` → `@/lib/engine/corpus/embedder`

**Verified kept active:** `src/lib/engine/corpus/follower-tier.ts` + its test (consumed by wave4/platform-fit-prompts.ts)

### Task 2: Delete /trending routes + strip Trending nav + remove SimilarVideosCard from ActionsNode

**Files deleted outright:**
- `src/app/(app)/trending/page.tsx` + `trending-client.tsx` — hard 404 via Next.js default (D-05)
- `src/app/api/trending/route.ts`, `[videoId]/route.ts`, `stats/route.ts`
- `src/hooks/queries/use-trending.ts`
- `src/lib/mappers/trending.ts`
- `src/types/trending.ts`

**Files edited:**
- `src/hooks/queries/index.ts`: removed `useTrendingVideos/useTrendingStats` re-export
- `src/lib/mappers/index.ts`: removed `mapScrapedVideoToTrendingVideo` re-export
- `src/lib/supabase/middleware.ts`: removed `"/trending"` from `PROTECTED_PREFIXES`
- `src/components/sidebar/Sidebar.tsx`: removed `isOnTrending`, `TrendUp` import, Trending NavItem
- `src/components/app/sidebar.tsx`: removed Trending from navItems, `TrendUp` import; fixed isActive ternary (removed unreachable final branch causing TS2339)
- `src/components/board/actions/ActionsNode.tsx`: removed `SimilarVideosCard` import + both AV/default render branches; grid now 3-card layout (Reshoot + OptimalPost + Share)
- `src/components/board/actions/actions-constants.ts`: removed `SIMILAR_VIDEOS_TITLE/EMPTY/UNAVAILABLE` constants + `SIMILAR_VIDEO_TAPPED` telemetry key
- `src/components/board/actions/__tests__/ActionsNode.test.tsx`: removed SimilarVideosCard mocks (TikTokEmbed, Dialog), dropped 2 similar-videos-card assertions, updated "B2: AV state bottom row" test to assert 2-card layout

### Task 3: Swap pipeline retrieval call for createEmptyRetrievalResult() + clean tests

**Files created:**
- `src/lib/engine/retrieval-empty.ts` — exports `createEmptyRetrievalResult(): BenchmarkRetrievalResult` returning `{ evidence: [], score: null, availability: false, cost_cents: 0 }`

**Files edited:**
- `src/lib/engine/pipeline.ts`:
  - Replaced `import { runBenchmarkRetrieval } from "./retrieval/retrieval-stage"` with `import { createEmptyRetrievalResult } from "./retrieval-empty"`
  - Deleted `DEFAULT_RETRIEVAL_RESULT` const (lines 255-264)
  - Deleted `retrievalPromise` IIFE + its outer try/catch (lines 696-722)
  - Shrunk Wave 1 destructure from 5 slots to 4 (`[geminiResult, audioFingerprintResult, , ruleResult]`)
  - Added `const retrievalResult = createEmptyRetrievalResult()` after Wave 1 await
  - Updated Sentry breadcrumb stages: removed `"retrieval"` from Wave 1 stage list
- `src/lib/engine/__tests__/pipeline.test.ts`:
  - Removed `mockRunBenchmarkRetrieval` hoisted block + `vi.mock("@/lib/engine/retrieval/retrieval-stage", ...)`
  - Rewrote Phase 8 describe as "Phase 1 — retrievalResult from createEmptyRetrievalResult helper"
  - Replaced invocation test with post-strip shape assertion
  - Deleted failure-path test ("retrieval failure pushes warning") — no longer reachable

## M2 Restore Path

To restore retrieval for the M2 corpus milestone:
1. Unpack `src/lib/engine/_dormant/` back to original locations (rename/copy each subdirectory)
2. In `pipeline.ts`: swap `createEmptyRetrievalResult()` for `runBenchmarkRetrieval({...})`; restore the `import { runBenchmarkRetrieval } from "./retrieval/retrieval-stage"` import; rebuild the `retrievalPromise` IIFE slot in Wave 1
3. Restore `retrieval/retrieval-stage` vi.mock in pipeline.test.ts
4. Remove `**/_dormant/**` from tsconfig.json and vitest.config.ts excludes
5. Fix internal imports in dormant corpus files (orchestrator.ts etc. may point at `@/lib/engine/retrieval/embedder` — update to `@/lib/engine/corpus/embedder`)

## Deviations from Plan

**1. [Rule 1 - Bug] Fixed TypeScript type narrowing error in src/components/app/sidebar.tsx**
- **Found during:** Task 2
- **Issue:** After removing the `{ label: "Trending", ... }` entry from `navItems as const`, TypeScript inferred the remaining id union as `"dashboard" | "competitors" | "brand-deals"`. The final ternary branch `pathname === item.href` became unreachable (`never` type), causing TS2339: Property 'href' does not exist on type 'never'.
- **Fix:** Replaced final ternary branch with `pathname.startsWith("/brand-deals")` (direct check, no `item.href` access)
- **Files modified:** `src/components/app/sidebar.tsx`
- **Commit:** 83b3bf1

**2. [Environment] pnpm build fails — pre-existing missing packages**
- `react-konva`, `konva/lib/Node`, `react-markdown`, `rehype-sanitize`, `ffmpeg-static` missing from worktree build environment
- Confirmed pre-existing: build failed identically at base commit d1d8722 before any of our changes
- These packages exist in main repo node_modules but the Next.js build resolves from worktree context
- Not introduced by this plan; documented here for operator awareness

**3. [Environment] pnpm test — 5 pre-existing test file failures**
- `Board.test.tsx`, `Board.a11y.test.tsx`, `GroupFrame.test.tsx` (react-konva missing), `WhyVerdictCollapsible.test.tsx`, `VerdictNode.test.tsx` (react-markdown missing)
- All 5 were failing at base commit before our changes
- Our changes improved test suite: removed 2 SimilarVideosCard test failures (now in _dormant, correctly excluded by vitest)
- Final test count: 5 failing (all pre-existing) | 1244 passing | 17 skipped

## Grep Gate Results (Phase 1 Success Criteria)

```
SC1: grep -r "SimilarVideosCard" src/ --exclude-dir=_dormant → 0 hits ✓
SC2: grep -r "/api/trending" src/ --exclude-dir=_dormant → 0 hits ✓
SC3: grep -rE "/dashboard/trending|trending-dashboard" src/ --exclude-dir=_dormant → 0 hits ✓
SC4: enrichWithTrends in pipeline.ts ✓ | scraped_videos in scrape-trending cron ✓ | corpus/embedder in apify webhook ✓
SC5: tsc --noEmit → 9 pre-existing errors only (same as baseline) ✓
     pnpm test → 5 pre-existing failures (same files as baseline) ✓
     pnpm build → fails (pre-existing environment issue, same as baseline)
```

## Known Stubs

None — all changes are actual deletions/moves/rewrites, not placeholder values.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. Routes were only removed (reducing attack surface).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 04359ce | Park dormant code, relocate ingestion embedder, exclude _dormant |
| Task 2 | 83b3bf1 | Delete /trending routes, strip Trending nav, remove SimilarVideosCard |
| Task 3 | afb5256 | Swap pipeline retrieval for createEmptyRetrievalResult helper |

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `_dormant/retrieval/retrieval-stage.ts` exists | FOUND |
| `corpus/embedder.ts` active | FOUND |
| `retrieval-empty.ts` active | FOUND |
| `corpus/follower-tier.ts` kept active | FOUND |
| `/trending page directory` deleted | CONFIRMED |
| `/api/trending directory` deleted | CONFIRMED |
| commit 04359ce (Task 1) | FOUND |
| commit 83b3bf1 (Task 2) | FOUND |
| commit afb5256 (Task 3) | FOUND |
