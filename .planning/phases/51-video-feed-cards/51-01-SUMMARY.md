---
phase: 51
plan: 01
subsystem: data-layer
tags: [next-image, infinite-scroll, hooks, mock-data]

# Dependency graph
requires: [50-01]
provides: [useInfiniteVideos-hook, picsum-image-config]
affects: [51-02, 51-03]

# Tech tracking
tech-stack:
  added: [react-intersection-observer@10.0.2]
  patterns: [category-aware-pagination, loading-guard]

# File tracking
key-files:
  created: [src/hooks/use-infinite-videos.ts]
  modified: [next.config.ts, package.json]

# Decisions
decisions:
  - id: D-51-01-01
    decision: "Page size 6 for infinite scroll (fills 2 desktop grid rows)"
    rationale: "Optimal batch size for 3-column grid layout"
  - id: D-51-01-02
    decision: "300ms delay in loadMore for skeleton flash"
    rationale: "Matches existing 250ms tab loading pattern for perceived responsiveness"

# Metrics
metrics:
  duration: ~1 minute
  completed: 2026-02-06
---

# Phase 51 Plan 01: Image Config & Infinite Hook Summary

Next.js image configuration for picsum.photos thumbnails plus useInfiniteVideos hook with category-aware pagination, loading guards, and automatic reset on category change.

## What Was Built

### Task 1: Image Configuration + Dependency

- Added `picsum.photos` and `fastly.picsum.photos` to Next.js `images.remotePatterns`
- Both hostnames needed because picsum.photos redirects to fastly CDN
- Installed `react-intersection-observer` for infinite scroll sentinel (Plan 03)

### Task 2: useInfiniteVideos Hook

- Created `src/hooks/use-infinite-videos.ts` with category-aware pagination
- Default page size of 6 (fills 2 desktop rows in 3-column grid)
- 300ms artificial delay for skeleton flash (perceived loading)
- `isLoadingMore` guard prevents duplicate batch loads
- Automatic reset to page 1 when category changes
- Returns: `{ videos, hasMore, loadMore, isLoadingMore, total }`

## Key Files

| File | Purpose |
|------|---------|
| `next.config.ts` | Added remotePatterns for picsum image domains |
| `src/hooks/use-infinite-videos.ts` | Paginated video hook with category reset |
| `package.json` | Added react-intersection-observer dependency |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 8e34d87 | chore | Add picsum.photos remotePatterns + install react-intersection-observer |
| fd1a7b8 | feat | Create useInfiniteVideos hook |

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| D-51-01-01 | Page size 6 for infinite scroll | Optimal batch for 3-column grid (2 full rows) |
| D-51-01-02 | 300ms delay in loadMore | Matches existing tab loading pattern for consistency |

## Dependencies Installed

| Package | Version | Purpose |
|---------|---------|---------|
| react-intersection-observer | 10.0.2 | Infinite scroll sentinel for VideoGrid |

## Next Phase Readiness

**Ready for 51-02 (VideoCard component)**

- Image config in place for picsum.photos thumbnails
- useInfiniteVideos hook ready for VideoGrid integration (Plan 03)

**Blockers:** None
**Concerns:** None
