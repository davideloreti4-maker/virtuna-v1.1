---
phase: 05-develop-predict-lineage
plan: "03"
subsystem: lineage-ui
tags: [lineage, remix-chip, polling, sidebar, route]
dependency_graph:
  requires: [05-01, 05-02]
  provides: [RemixedFromChip, /api/analysis/[id]?summary, sidebar-remix-tag, polling-ceiling-360s]
  affects:
    - src/app/api/analysis/[id]/route.ts
    - src/components/board/RemixedFromChip.tsx
    - src/components/board/InputResultCard.tsx
    - src/components/sidebar/Sidebar.tsx
    - src/hooks/queries/use-analysis-stream.ts
tech_stack:
  added: []
  patterns: [ownership-scoped-minimal-summary, raycast-chip, live-poll-fallback-marker, ceiling-constant]
key_files:
  created:
    - src/components/board/RemixedFromChip.tsx
  modified:
    - src/app/api/analysis/[id]/route.ts
    - src/components/board/InputResultCard.tsx
    - src/components/sidebar/Sidebar.tsx
    - src/hooks/queries/use-analysis-stream.ts
decisions:
  - "?summary branch inserted after user_id-scoped SELECT — ownership enforcement inherited, never a separate auth check needed (T-05-06)"
  - "POLLING_CEILING_MS = 360_000 as a named constant (not inline literal) — makes the D-13 intent explicit and grep-discoverable"
  - "Live-poll completion gate comment explicitly disavows permalink-reload fix — the frame-level dual-read in DecodeShellNode is the correct site for that (Phase 3)"
  - "isRemix derived inline in render (not extracted to use-sidebar-queries) — Sidebar.tsx is the sole consumer and the cast already lives there"
metrics:
  duration: "~12 minutes"
  completed: "2026-06-02T11:15:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 5
---

# Phase 05 Plan 03: Lineage UI — Chip, Summary Route, Remix Tag, Polling Ceiling Summary

**One-liner:** Ownership-scoped `?summary` branch on `/api/analysis/[id]` + `RemixedFromChip` on child boards + sidebar "Remix" badge for null-score source rows + polling ceiling lifted 90s→360s for developed-child full-pipeline runs.

## What Was Built

Lineage surface and polling hardening for Develop & Predict (DEVELOP-02):

1. **`/api/analysis/[id]?summary` branch** — minimal ownership-scoped parent summary returning `{ id, caption, created_at }` only. Runs after the existing `user_id`-scoped SELECT so a forged cross-user `parent_id` 404s before the summary branch is reached (T-05-06). Handler param renamed `_request` → `request` to read `searchParams`.

2. **`RemixedFromChip.tsx`** (`'use client'`) — fetches `?summary`, renders an anchor to `/analyze/[parentId]` styled as a Raycast chip (6% border, muted text, no glow/tint). Caption truncated to 40 chars. Loading state shows "Remixed from …"; fetch error falls back to "Remixed from source" (link still navigable). `data-testid="remixed-from-chip"`.

3. **`InputResultCard.tsx`** — imports `RemixedFromChip` and mounts it at the top of the `showResult` JSX branch, gated on `permalinkData.parent_id != null`. Ordinary analyses render no chip; developed children always show the chip.

4. **Sidebar Recent "Remix" tag** — `recentBoards` cast extended with `variants?: { remix?: unknown } | null`. Score chip render replaced with an inline `isRemix` check: when `overall_score == null && variants.remix != null`, renders a `rounded-full bg-white/[0.06] px-1.5` Raycast badge with `data-testid="sidebar-remix-tag"`. Scored rows keep the numeric chip unchanged (D-11/D-12).

5. **Polling ceiling lift** (`use-analysis-stream.ts`) — `90_000` replaced with named constant `POLLING_CEILING_MS = 360_000` in the ceiling `setTimeout` (D-13). Developed children run the full ~90-332s prediction pipeline.

6. **Live-poll completion fallback** — poll gate extended: completes on `overall_score != null` OR `variants.remix != null`. Explicit comment clarifies this gate fires only on the LIVE-polling path (phase==="polling"); permalink-reload hydration remains DecodeShellNode Phase 3 dual-read (unchanged). `completedFromInitial` at line 127 intentionally not modified.

## Acceptance Criteria Verification

- [x] `GET /api/analysis/[id]?summary` returns `{id, caption, created_at}` only — runs after user_id SELECT (T-05-06)
- [x] Handler param is `request` (not `_request`), reads `new URL(request.url).searchParams`
- [x] `RemixedFromChip.tsx` exists, renders anchor to `/analyze/[parentId]`, text "Remixed from", Raycast chip styling, `data-testid="remixed-from-chip"`
- [x] `InputResultCard` mounts chip only when `permalinkData.parent_id` is truthy
- [x] Sidebar renders "Remix" badge (`data-testid="sidebar-remix-tag"`) for null-score remix rows; scored rows keep numeric chip
- [x] `POLLING_CEILING_MS = 360_000` used in setTimeout — old `90_000` literal gone from non-comment lines
- [x] Live-poll gate completes on `overall_score != null` OR `variants.remix != null` with comment noting live-poll-path-only
- [x] `completedFromInitial` gate (line 127) not modified
- [x] `npx tsc --noEmit` — TypeScript: No errors found

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `611e6bc4` | feat(05-03): add ?summary route branch, RemixedFromChip, mount on child board |
| Task 2 | `7bb64c3a` | feat(05-03): Recent Remix tag + polling ceiling lift to 360s + live-poll remix fallback |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All data paths are wired: `?summary` fetches live DB row, chip links to real parent, Remix tag derives from real `variants.remix` field.

## Threat Surface Scan

No new network endpoints beyond the scoped `?summary` branch (already in plan threat model T-05-06). No new auth paths or schema changes. RemixedFromChip renders caption as React text child — no `dangerouslySetInnerHTML` (T-05-07 satisfied).

## Self-Check: PASSED

- `src/components/board/RemixedFromChip.tsx` — exists
- `src/app/api/analysis/[id]/route.ts` — `summary` keyword present (count ≥ 1)
- `src/components/board/InputResultCard.tsx` — `RemixedFromChip` import + `parent_id` guard present
- `src/components/sidebar/Sidebar.tsx` — `isRemix` + `sidebar-remix-tag` present
- `src/hooks/queries/use-analysis-stream.ts` — `POLLING_CEILING_MS` + `360_000` present
- Commits `611e6bc4` and `7bb64c3a` confirmed in git log
- `npx tsc --noEmit` → TypeScript: No errors found
