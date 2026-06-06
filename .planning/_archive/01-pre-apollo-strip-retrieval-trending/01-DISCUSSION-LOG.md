# Phase 1: Strip Retrieval + Similar Videos + /trending Dashboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 1-strip-retrieval-similar-videos-trending-dashboard
**Areas discussed:** Retrieval directory disposition, Sidebar + /trending route, Test deletion vs quarantine, Aggregator retrieval weight

---

## Retrieval Directory Disposition

| Option | Description | Selected |
|--------|-------------|----------|
| Move to `_dormant/` folder | Move `src/lib/engine/retrieval/` → `src/lib/engine/_dormant/retrieval/`. Excluded from tsconfig + test runs. M2 restores via folder rename. | ✓ |
| Delete call sites, leave files | Strip imports from pipeline.ts + aggregator.ts. Files orphaned; risk of silent rot + dead-code lint warnings. | |
| Feature-flag gate | Wrap retrieval call in `if(env.ENABLE_RETRIEVAL)`. Files stay in active tree as no-op. Risk: half-wired drift during M2 work. | |

**User's choice:** Move to `_dormant/` folder (Recommended)
**Notes:** Quick walkthrough — recommendation accepted. Reversibility via folder rename is the key property for the M2 corpus restore path.

---

## Sidebar + /trending Route

| Option | Description | Selected |
|--------|-------------|----------|
| Strip both sidebars + hard 404 | Remove Trending nav from `sidebar/Sidebar.tsx` AND `app/sidebar.tsx`. Delete `/trending` route entirely → Next.js default 404. | ✓ |
| Strip active sidebar only + redirect | Identify active sidebar, strip only that one. Add 308 redirect `/trending` → `/analyze` for bookmarked links. | |
| Strip both + redirect to /analyze | Strip both sidebars. Keep minimal page that 308-redirects to `/analyze`. Preserves bookmarks, no orphan code. | |

**User's choice:** Strip both sidebars completely + hard 404
**Notes:** "remove trending completely from the sidebar" — no redirect, clean cut.

---

## Test Deletion vs Quarantine

| Option | Description | Selected |
|--------|-------------|----------|
| Move tests with code to `_dormant/` | Tests travel alongside source into `_dormant/`. Vitest excludes `**/_dormant/**`. Restored together by M2. | ✓ |
| Delete outright | Cleanest diff, smallest test suite. M2 rewrites tests from scratch. | |
| Quarantine to `__archived__/` | Move only tests to `src/**/__archived__/`. Source goes to `_dormant/`. Two locations to track. | |

**User's choice:** Move tests with code to `_dormant/` (Recommended)
**Notes:** Single-location convention. Consistent with the directory-rename restore pattern.

---

## Aggregator Retrieval Weight

| Option | Description | Selected |
|--------|-------------|----------|
| Synthesized empty result, null-safe path | Pass empty `BenchmarkRetrievalResult` into aggregator. Existing null-safe path treats score as 0. Zero aggregator edits. | ✓ |
| Branch aggregator to skip retrieval | Explicit if-skip + renormalize remaining weights to sum to 1.0. Cleaner math but requires aggregator edit + un-edit on restore. | |
| Hardcode weight redistribution | Bump other stage weights (e.g. gemini 0.55 → 0.60) to absorb the 5%. Non-reversible decision affecting MVP-era predicted scores. | |

**User's choice:** Synthesized empty result, null-safe path (Recommended)
**Notes:** Minimal blast radius. M2 restore = swap the empty helper for the real retrieval call at one site.

---

## Claude's Discretion

- Exact file list inside `_dormant/` vs active tree for `src/lib/engine/corpus/*.ts` — planner audits import graph (ingestion-side callers stay active).
- Whether `src/types/trending.ts` lives in active tree or moves to `_dormant/` — planner checks import graph.
- Whether to add a top-level `_dormant/README.md` for future contributors — judgement call.

## Deferred Ideas

- Top-level `_dormant/README.md` explaining the dormant convention.
- Type cleanup pass on `database.types.ts` for retrieval-related columns — coordinate with Phase 4 (schema drift fix).
- Audio fingerprint dormancy formalization — out of Phase 1 scope.
