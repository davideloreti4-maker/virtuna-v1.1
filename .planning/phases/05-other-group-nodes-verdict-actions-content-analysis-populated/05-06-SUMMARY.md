---
phase: 05
plan: "06"
subsystem: actions
tags: [phase-5, actions, similar-videos, tiktok-embed, retrieval-evidence, R1.5]
dependency_graph:
  requires: ["05-01", "05-05"]
  provides: ["SimilarVideosCard", "SimilarVideoCardCompact", "formatCompactNumber"]
  affects: ["ActionsNode", "actions-constants"]
tech_stack:
  added: []
  patterns: ["Radix Dialog portal", "formatCompactNumber utility", "TikTokEmbed reuse"]
key_files:
  created:
    - src/components/board/actions/SimilarVideoCardCompact.tsx
    - src/components/board/actions/SimilarVideosCard.tsx
  modified:
    - src/components/board/actions/actions-constants.ts
    - src/components/board/actions/ActionsNode.tsx
    - src/components/board/actions/__tests__/SimilarVideosCard.test.tsx
    - src/components/board/actions/__tests__/SimilarVideosCard.empty.test.tsx
    - src/components/board/actions/__tests__/ActionsNode.test.tsx
decisions:
  - "Used logger.info() for SIMILAR_VIDEO_TAPPED telemetry — logger has no .event() method"
  - "TikTokEmbed requires both videoUrl (full URL string) and videoId (extracted digit string) — extractTikTokVideoId() helper added inline in SimilarVideosCard"
  - "RetrievalEvidenceItem.video_url is nullable (z.string().nullable()) — null guard added before passing to TikTokEmbed"
  - "ActionsNode.test.tsx updated: replaced actions-similar-videos-slot / actions-similar-videos-slot-av assertions with similar-videos-card assertions; added TikTokEmbed + Dialog vi.mock stubs"
metrics:
  duration: "~4 minutes"
  completed: "2026-05-28"
  tasks_completed: 2
  files_changed: 7
---

# Phase 5 Plan 06: SimilarVideosCard Summary

SimilarVideosCard with 5-cap mini-tile rows from retrieval_evidence, tap-to-TikTok-embed via Radix Dialog portal, wired into both default and AV ActionsNode slots (B2 alignment).

## Tasks Completed

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 | SimilarVideoCardCompact + actions-constants extensions | ee2bd33 | Done |
| 2 | SimilarVideosCard + test finalization + ActionsNode B2 wiring | ac9e7b6 | Done |

## Interface Discoveries (for SUMMARY.md output requirement)

### TikTokEmbed export + props signature

```typescript
// Path: src/components/trending/tiktok-embed.tsx
export function TikTokEmbed({ videoUrl, videoId, className }: TikTokEmbedProps)
// Props: videoUrl (full URL), videoId (extracted digit ID), className (optional)
```

Plan spec assumed `url` prop. Actual is `videoUrl` + `videoId`. Added `extractTikTokVideoId()` in SimilarVideosCard to extract the digit ID from the URL via `/\/video\/(\d+)/` regex. **Deviation: Rule 1 auto-fix.**

### Dialog import path used

```typescript
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
```

Matches plan spec exactly. DialogContent uses Radix Portal internally (confirmed in dialog.tsx) — satisfies Pitfall 7 (portal at body level).

### RetrievalEvidenceItem shape vs assumed

Actual schema diverges from plan spec:

| Field | Plan assumed | Actual |
|-------|-------------|--------|
| `video_url` | `string` | `string \| null` (nullable) |
| `creator_handle` | `string?` optional | `string \| null` (nullable) |
| Additional fields | Not listed | `source_pool`, `source_id`, `likes`, `shares`, `comments`, `saves`, `hashtags`, `posted_at`, `bucket_label`, `bucket_source`, `relaxed_to` |

`video_url` nullable required null guard before TikTokEmbed invocation. SimilarVideoCardCompact uses `item.creator_handle ?? ''` (handles null correctly).

### logger shape

`logger` in `src/lib/logger.ts` exposes: `debug`, `info`, `warn`, `error`, `child`. No `.event()` method. Plan spec referenced `logger.event?.()`. Changed to `logger.info(TELEMETRY.SIMILAR_VIDEO_TAPPED, {...})`. **Deviation: Rule 1 auto-fix.**

## Verification Results

- R1.5 satisfied: top-5 retrieval_evidence renders as compact mini-tiles, tap opens TikTok embed modal, empty state present when `items=[]` or `signalAvailable=false` or `items=undefined`
- All 29 actions test files pass (SimilarVideosCard: 6, SimilarVideosCard.empty: 4, ActionsNode: 10, PlaceholderCard: 9)
- `grep -c "ActionsShareSlot" src/components/board/actions/ActionsNode.tsx` = 3 (import + 2 render sites) >= 2 (B2 criterion preserved)
- `grep -c "SimilarVideosCard" src/components/board/actions/ActionsNode.tsx` = 5 (import + type import + 2 render sites + comment) >= 3
- `grep -c "actions-similar-videos-slot" src/components/board/actions/ActionsNode.tsx` = 0 (replaced)
- `grep -c "actions-similar-videos-slot-av" src/components/board/actions/ActionsNode.tsx` = 0 (replaced)
- TypeScript: 0 errors on modified files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TikTokEmbed props mismatch**
- **Found during:** Task 2 read_first of tiktok-embed.tsx
- **Issue:** Plan spec said `<TikTokEmbed url={openItem.video_url} />` but actual component requires `videoUrl` + `videoId`
- **Fix:** Changed to `<TikTokEmbed videoUrl={openItem.video_url} videoId={extractTikTokVideoId(openItem.video_url)} />`; added `extractTikTokVideoId()` helper inline
- **Files modified:** SimilarVideosCard.tsx

**2. [Rule 1 - Bug] logger.event() does not exist**
- **Found during:** Task 2 read_first of logger.ts
- **Issue:** Plan spec referenced `logger.event?.(TELEMETRY.SIMILAR_VIDEO_TAPPED, {...})` but logger exports no `event` method
- **Fix:** Changed to `logger.info(TELEMETRY.SIMILAR_VIDEO_TAPPED, {...})` + updated test mock from `{ event: vi.fn() }` to `{ info: vi.fn() }`
- **Files modified:** SimilarVideosCard.tsx, SimilarVideosCard.test.tsx

**3. [Rule 1 - Bug] video_url is nullable in RetrievalEvidenceItem**
- **Found during:** Task 2 read_first of types.ts
- **Issue:** `video_url: z.string().nullable()` — passing null to TikTokEmbed would crash
- **Fix:** Added `{openItem && openItem.video_url && <TikTokEmbed ... />}` null guard; key on `item.video_url ?? item.source_id` in list
- **Files modified:** SimilarVideosCard.tsx

**4. [Rule 2 - Missing] ActionsNode.test.tsx needed TikTokEmbed + Dialog mocks**
- **Found during:** Task 2 wiring into ActionsNode
- **Issue:** SimilarVideosCard now imported by ActionsNode; existing test file had no stubs for TikTokEmbed or Dialog — would fail with module resolution errors
- **Fix:** Added `vi.mock('@/components/trending/tiktok-embed', ...)` + `vi.mock('@/components/ui/dialog', ...)` at top of ActionsNode.test.tsx; updated placeholder-testid assertions to `similar-videos-card`
- **Files modified:** ActionsNode.test.tsx

**5. [Rule 2 - Missing] Test fixtures needed full RetrievalEvidenceItem shape**
- **Found during:** Task 2 writing SimilarVideosCard.test.tsx (8-item cap test)
- **Issue:** Plan spec's inline fixture objects had only 4 fields; actual schema requires `source_pool`, `source_id`, `bucket_label`, `bucket_source`, `relaxed_to`, `likes`, `shares`, `comments`, `saves`, `hashtags`, `posted_at` or TypeScript errors
- **Fix:** Added all required fields to inline test fixtures

## Known Stubs

None. All SimilarVideosCard functionality is wired end-to-end. Thumb placeholder (gray box) is intentional per plan — `thumbnail_url` does not exist in RetrievalEvidenceItem schema (Phase 5 limitation noted in code comment).

## Threat Surface Scan

No new network endpoints or auth paths introduced. `video_url` null guard prevents passing null to TikTokEmbed. Threat T-05-25 (URL tampering): TikTokEmbed component does not validate tiktok.com domain internally — the component passes the URL directly to a `data-video-id` attribute and the TikTok embed.js script processes it. Engine output passes through Zod validation at SSE boundary (per threat register disposition: "Engine output passes through Zod validation at SSE boundary"). No additional guard added; consistent with T-05-25 accept/mitigate disposition.

## Self-Check: PASSED

- `src/components/board/actions/SimilarVideoCardCompact.tsx` — FOUND
- `src/components/board/actions/SimilarVideosCard.tsx` — FOUND
- `src/components/board/actions/ActionsNode.tsx` — FOUND (modified)
- Commit `ee2bd33` — Task 1 (SimilarVideoCardCompact) — FOUND
- Commit `ac9e7b6` — Task 2 (SimilarVideosCard + B2 wiring) — FOUND
- 29 tests passing — VERIFIED
