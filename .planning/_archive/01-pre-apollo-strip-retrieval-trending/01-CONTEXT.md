# Phase 1: Strip Retrieval + Similar Videos + /trending Dashboard - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove all M2-corpus-dependent surfaces from the runtime so MVP ships without dead UI cards, dead API routes, and dead pipeline branches. Ingestion side stays intact for a future corpus milestone to pick up.

**In scope:**
- Delete `SimilarVideosCard` + variants from board substrate
- Remove retrieval reads from `/api/analyze` pipeline runtime
- Delete `/trending` dashboard page + `/api/trending/*` routes + supporting client code
- Strip `/trending` nav from sidebars
- Park `src/lib/engine/retrieval/*` + related files in `src/lib/engine/_dormant/` (excluded from build + tests)

**Out of scope (untouched):**
- `scraped_videos` table + scraper cron
- `trending_sounds` table
- Trend enrichment inside `/api/analyze` pipeline (`enrichWithTrends`)
- Audio fingerprint code (dormant by other means, not Phase 1's concern)
- Embedder ingestion logic — only its runtime call sites get removed

</domain>

<decisions>
## Implementation Decisions

### Retrieval Directory Disposition
- **D-01:** Move `src/lib/engine/retrieval/` → `src/lib/engine/_dormant/retrieval/`. Move `src/lib/engine/corpus/orchestrator.ts` (and any sibling files used ONLY by runtime retrieval) into `_dormant/corpus/` similarly. The `_dormant/` directory is excluded from `tsconfig.json` and from vitest config so it neither compiles nor runs.
- **D-02:** M2 corpus milestone restores by moving files back out of `_dormant/`. Decision intentionally reversible.
- **D-03:** Files used by ingestion (e.g. `corpus/normalize-scrape.ts`, `corpus/apify-jobs.ts`, `corpus/bucketing.ts` if exercised by scraper cron / apify webhook) stay in active tree. Planner audits exact split.

### Sidebar + /trending Route
- **D-04:** Strip Trending nav item from BOTH sidebars: `src/components/sidebar/Sidebar.tsx` AND `src/components/app/sidebar.tsx`. No legacy detection — both lose the link.
- **D-05:** `/trending` page deletion → hard 404 (Next.js default). No redirect. Bookmarked links break by design; ROADMAP already removed `/trending` from MVP surface.
- **D-06:** Delete entire `src/app/(app)/trending/` directory and `src/app/api/trending/` directory. Move `src/components/trending/` to `_dormant/` (it's pure presentational, M2 may want it back).

### Test Deletion vs Quarantine
- **D-07:** Tests travel with their source into `_dormant/`. Vitest config excludes `**/_dormant/**`. Tests for `SimilarVideosCard.*`, retrieval-stage, embedder, /api/trending move alongside the code they cover.
- **D-08:** Tests that mock retrieval (e.g. `pipeline.test.ts`, `aggregator` tests) stay in active tree but get edited to drop retrieval mocks — they still need to assert pipeline + aggregator behavior on the post-strip surface.

### Aggregator Retrieval Weight
- **D-09:** Pass a synthesized empty `BenchmarkRetrievalResult` into the aggregator. Existing null-safe path treats `score` as 0; the 0.05 weight effectively redistributes across other stages proportionally without aggregator edits.
- **D-10:** Source the empty result from a single helper (e.g. `createEmptyRetrievalResult()`) co-located near the pipeline — easy to swap for the real call when M2 corpus restores retrieval.

### Claude's Discretion
- Exact file list inside `_dormant/` vs active tree for `corpus/*.ts` files: planner audits which files have ingestion-side callers vs runtime-only callers and splits accordingly.
- Whether `src/types/trending.ts` lives in active tree (consumed by ingestion?) or moves to `_dormant/`: planner checks import graph.
- How to communicate the dormant convention to future contributors (top-level README note in `_dormant/`?).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope
- `.planning/MILESTONE.md` — MVP Cut scope, locked decisions, success criteria, carryover acknowledgments
- `.planning/ROADMAP.md` §"Phase 1" — phase scope, depends-on, success criteria

### Codebase maps (read for orientation)
- `.planning/codebase/ARCHITECTURE.md` — system boundaries
- `.planning/codebase/STRUCTURE.md` — directory layout
- `.planning/codebase/STACK.md` — tech stack
- `.planning/codebase/INTEGRATIONS.md` — external deps

### Engine pipeline (entry points for strip)
- `src/lib/engine/pipeline.ts` — retrieval call sites at lines 39 (import), 106-108 (comment), 250 (matched_trends fallback), 255, 697-740 (retrievalPromise + Promise.all slot), 749, 978 (aggregator handoff)
- `src/lib/engine/retrieval/retrieval-stage.ts` — `runBenchmarkRetrieval` entry, target for move to `_dormant/`
- `src/lib/engine/retrieval/embedder.ts`, `pgvector-client.ts`, `bucket-derivation.ts`, `re-ranker.ts` — same disposition
- `src/lib/engine/corpus/orchestrator.ts` — needs import-graph audit before move
- `src/lib/engine/aggregator.ts` — consumes `retrievalResult.score` at weight 0.05; expects null-safe input

### UI surfaces to delete / dormant
- `src/components/board/actions/SimilarVideosCard.tsx` + `SimilarVideoCardCompact.tsx` → `_dormant/`
- `src/components/board/actions/ActionsNode.tsx` — strip SimilarVideosCard import + render branch
- `src/components/trending/*` (video-card, empty-state, video-grid, video-detail-modal) → `_dormant/`
- `src/components/sidebar/Sidebar.tsx:323` — Trending nav item, strip
- `src/components/app/sidebar.tsx:34` — Trending nav item, strip
- `src/components/board/actions/actions-constants.ts` — audit for retrieval/Similar refs

### Routes to delete (hard 404)
- `src/app/(app)/trending/page.tsx`, `src/app/(app)/trending/trending-client.tsx`
- `src/app/api/trending/route.ts`, `src/app/api/trending/[videoId]/route.ts`, `src/app/api/trending/stats/route.ts`
- `src/hooks/queries/use-trending.ts` + reference in `src/hooks/queries/index.ts`
- `src/lib/mappers/trending.ts` + reference in `src/lib/mappers/index.ts`
- `src/types/trending.ts` — audit for active-tree callers
- `src/lib/supabase/middleware.ts` — has `/trending` reference, audit

### Ingestion (KEEP — do not touch)
- `src/app/api/cron/scrape-trending/route.ts`
- `src/app/api/cron/calculate-trends/route.ts` + its tests
- `src/app/api/webhooks/apify/route.ts`
- `src/lib/engine/trends.ts` — `enrichWithTrends`, consumed by pipeline
- `src/lib/engine/corpus/normalize-scrape.ts`, `apify-jobs.ts`, `bucketing.ts` — likely ingestion side, planner confirms

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Null-safe aggregator path:** `aggregator.ts` already handles `retrievalResult.score === 0` cleanly — no aggregator edit required, just supply a synthesized empty result from pipeline.
- **`_dormant/` directory convention:** New. Phase 1 establishes it. Excluded from `tsconfig.json` + `vitest.config.ts` so dormant code neither compiles nor runs.
- **Helper centralization:** `createEmptyRetrievalResult()` (or similar) gives M2 corpus a single swap point.

### Established Patterns
- **Two sidebars in repo:** `sidebar/Sidebar.tsx` (Phase 2.5 restructured nav) and `app/sidebar.tsx`. Both reference `/trending`. Strip both — no legacy detection.
- **Engine pipeline graceful-empty pattern:** Phase 8 (historical) introduced graceful-empty fallbacks for retrieval at multiple sites (e.g. pipeline.ts:255). Pattern is already proven — we extend it by sourcing the empty result directly instead of via retrieval call.
- **Cron + webhook pipelines write `scraped_videos`/`trending_sounds`:** ingestion is decoupled from runtime retrieval. The strip is safe — ingestion doesn't read `_dormant/`.

### Integration Points
- `aggregator.ts:686-693` — Phase 2 will edit this same path (null fallback for hook_decomposition/emotion_arc). Phases 1 and 2 touch the same file but different fields. Coordinate to avoid merge conflicts.
- `pipeline.ts` Promise.all stage assembly — Phase 1 removes one slot. Test fixtures that mock all 5 stages need updating.

</code_context>

<specifics>
## Specific Ideas

- M2 corpus milestone restore = directory rename out of `_dormant/`, swap empty helper for real call. Phase 1 actively designs for that restore.
- Hard 404 on `/trending` is intentional. ROADMAP success criterion 3 is `grep -r "/dashboard/trending\|trending-dashboard" returns zero src/ hits`.

</specifics>

<deferred>
## Deferred Ideas

- **Top-level `_dormant/README.md`** explaining the dormant convention to future contributors. Useful but not blocking — planner can include or defer to a docs phase.
- **Type cleanup pass on `database.types.ts`** for retrieval-related columns (e.g. `similar_videos`, retrieval scores). Coordinate with Phase 4 (schema drift fix) — out of Phase 1 scope.
- **Audio fingerprint dormancy formalization:** MILESTONE.md notes audio fingerprint is "dormant" pending embedder unblock, but not in Phase 1 scope.

</deferred>

---

*Phase: 1-strip-retrieval-similar-videos-trending-dashboard*
*Context gathered: 2026-05-28*
