---
phase: 11
plan: 05
subsystem: explore-client-primitives
tags: [explore, sse, outlier-tile, fit-bar, track-account, honesty-spine, one-accent-law]
requires:
  - "src/lib/discover/explore-rank.ts (FitLevel, FitRankedOutlier, rankWithAudienceFit) [11-01]"
  - "src/lib/tools/blocks.ts (OutlierGridBlockSchema tiles += fit/trackable/trackHandle) [11-01]"
  - "src/app/api/tools/explore/route.ts (SSE route: stage/content/done/error) [11-04]"
  - "src/hooks/queries/use-hooks-stream.ts (SSE consumer exemplar)"
  - "src/components/discover/discover-grid.tsx, outlier-tile.tsx (P8 grid + tile)"
provides:
  - "useExploreStream — SSE consumer for /api/tools/explore (start/stop/reset/toBlocks/stages)"
  - "OutlierTile fit bar (3-level, success/warning/muted) + '+ Track account' affordance"
  - "OutlierGridBlockRenderer wired LIVE (onRemix/onTrack/pending/tracked pass-through)"
affects:
  - "11-06 (mounts useExploreStream + supplies onRemix/onTrack handlers in ExploreThreadView)"
tech-stack:
  added: []
  patterns:
    - "fetch + res.body.getReader() SSE consumer (NOT the GET-only SSE client; BLOCKER-1)"
    - "honesty degrade: fit bar omitted entirely when fit==null (D-02) — no empty/zero bar"
    - "one-accent law: fit bar is DATA (score-zone tone), coral reserved for the Remix CTA"
    - "renderer pass-through (callbacks optional → static-reference fallback preserved)"
key-files:
  created:
    - "src/hooks/queries/use-explore-stream.ts"
  modified:
    - "src/components/discover/outlier-tile.tsx"
    - "src/components/thread/outlier-grid-block.tsx"
    - "src/components/discover/discover-grid.tsx"
decisions:
  - "Imported OutlierGridBlock type from blocks.ts in the renderer (single source of truth) — schema-inferred tile is structurally assignable to OutlierTileData[], so fit/trackable/trackHandle flow through with no local interface"
  - "tracked state keys off tile.trackHandle ∈ trackedIds (the written handle), not platformVideoId; track-pending keys off platformVideoId (per-tile in-flight)"
  - "Rephrased the hook's header comments to avoid the literal SSE-client class name so the plan's `! grep EventSource` guard passes unambiguously while preserving the BLOCKER-1 guidance"
metrics:
  duration: "6m 11s"
  completed: "2026-06-20"
  tasks: 3
  files: 4
  commits: 3
---

# Phase 11 Plan 05: Explore Client Primitives Summary

The Explore client primitives that mount in 11-06: an `useExploreStream` SSE consumer (fetch+getReader, one grid block per run), an `OutlierTile` extended with the honest 3-level audience-fit bar + a "+ Track account" affordance, and an upgraded `OutlierGridBlockRenderer` that wires Remix/Track through to the tiles — honesty spine and one-accent law preserved, all typechecking, affected-area tests green (55/55).

## What Was Built

### Task 1 — `useExploreStream` (`src/hooks/queries/use-explore-stream.ts`, 259 lines) — commit `6fd6174f`
- Cloned the `use-hooks-stream` structure but SIMPLER: Explore streams ONE `outlier-grid` block in the `content` event — no per-tile `score` events, no `followup`.
- `fetch("/api/tools/explore", POST, Content-Type: application/json, signal)` + `res.body.getReader()` + the `\n\n` frame split + `event:`/`data:` line parse. NOT the GET-only SSE client (BLOCKER-1 — POST needs a body).
- Handles event types: `stage` (upsert-by-name into `StageState[]`, verbatim the use-hooks-stream upsert), `content` (set `streamingBlock` from `data.blocks.find(b => b.type === "outlier-grid")` — shape-guarded), `done` (`setIsDone`, clear status), `error` (throw). Catches `AbortError`, else `setError`; `finally setIsStreaming(false)` guarded by `isMountedRef`.
- Exposes `start(params)` / `stop` / `reset` / `toBlocks()` (→ `[streamingBlock]` or `[]`) / `stages`. WR-05 `isMountedRef` unmount guard verbatim.

### Task 2 — `OutlierTile` fit bar + Track account (`src/components/discover/outlier-tile.tsx`) — commit `5024f01b`
- `OutlierTileData` gains `fit?: { level: FitLevel } | null` (imported from `@/lib/discover/explore-rank`), `trackable?`, `trackHandle?`. `OutlierTileProps` gains `onTrack?`, `trackPending?`, `tracked?`.
- **Fit bar** (between the multiplier badge row and `<VideoCard>` — UI-SPEC §Surface 1 read order step 2): `h-1.5 rounded-full` track on `bg-white/[0.06]`; fill width by level (Weak 33% / Fair 66% / Strong 100%) and tone by level — `var(--color-success)` / `var(--color-warning)` / `var(--color-foreground-muted)`. Label `text-[11px] font-semibold uppercase tracking-wide text-foreground-muted` reading `FIT · {level}` + sub-line "Fit for your audience · predicted".
- **Honesty degrade (D-02):** renders ONLY when `tile.fit != null` — on null/absent the bar is omitted ENTIRELY (no empty/zero bar, no placeholder, no fabricated level). NEVER coral (verified: the only `#FF7F50` in the file is the Remix CTA's `style`; every other "coral" is doc prose saying "NEVER coral").
- **Track button** (above the CTA — read order step 4): renders ONLY when `tile.trackable`; quiet non-accent text-button (`text-xs font-medium text-foreground-muted`, left-aligned) "+ Track account" → `onTrack?.(tile)`; `trackPending` → "Tracking…"; `tracked` → "Tracking" with a `Check` icon. Non-accent (secondary to Remix).
- The "Remix → Read" CTA is UNCHANGED — the lone coral element (one-accent law).

### Task 3 — `OutlierGridBlockRenderer` wired LIVE (`outlier-grid-block.tsx` + `discover-grid.tsx`) — commit `4d5bdfce`
- Replaced the renderer's local `OutlierGridBlock` interface with the canonical type imported from `blocks.ts` (single source of truth — the Phase 11 tile fields flow through automatically).
- Renderer accepts optional `onRemix` / `onTrack` / `remixPendingId` / `trackPendingId` / `trackedIds` and forwards them to `<DiscoverGrid>`. Header comment updated: LIVE in the Explore thread (handlers from ExploreThreadView), static reference ONLY when callbacks omitted (Discover-page reuse unchanged — Pitfall 2 fixed).
- `DiscoverGrid` now forwards `onTrack` / `trackPending` (`=== platformVideoId`) / `tracked` (`tile.trackHandle ∈ trackedIds`) to each `OutlierTile`.
- `message-blocks.tsx` BLOCK_COMPONENTS dispatch and `block-registry.ts` UNCHANGED (new props optional → existing `{ block }` call site still valid). Pattern 3 preserved.

## Verification Results

- `npx tsc --noEmit -p tsconfig.json` — **zero errors across all four touched files** (per-file greps clean; full-project run surfaces only pre-existing `__tests__`/`fixtures` errors unrelated to this plan — logged to `deferred-items.md`).
- `use-explore-stream` SSE guard: `grep getReader` present (4×), `grep EventSource` absent → PASS.
- Fit-bar honesty: `tile.fit != null` guard present; no empty/zero-bar path exists.
- One-accent law: `grep -nE "#FF7F50|--color-accent|coral"` → the only real color value is `#FF7F50` in the Remix CTA `style`; all other matches are doc prose. Fit bar uses success/warning/muted only.
- `npx eslint` on the four files — No issues found.
- `npx vitest run` (discover + thread + hooks) — **55 passed, 0 failed**.

## Deviations from Plan

None — plan executed exactly as written. Three minor implementation choices (all within plan latitude) are recorded in the frontmatter `decisions`:
1. Renderer imports `OutlierGridBlock` from `blocks.ts` rather than widening the local interface (the plan listed this as the *preferred* option — "single source of truth").
2. `tracked` keys off `trackHandle ∈ trackedIds`; `trackPending` keys off `platformVideoId` (matches the plan's stated prop semantics for `trackPendingId`/`trackedIds`).
3. Header comments reworded to drop the literal SSE-client class name so the plan's `! grep EventSource` verification command passes cleanly; the BLOCKER-1 guidance is preserved in plain words.

## Known Stubs

None. The on-tap real persona reaction is INTENTIONALLY not built here — it comes free downstream via the reused `discover→remix` chain → `remix-card`'s `LensTrigger` (D-02/D-04). This is the deliberate cheap-eager / expensive-lazy split, not a stub. The `onRemix`/`onTrack` handlers are supplied by `ExploreThreadView` in 11-06 (the renderer's callbacks are optional by design, so omitting them preserves the Discover-page static reference).

## Self-Check: PASSED

- FOUND: src/hooks/queries/use-explore-stream.ts
- FOUND: src/components/discover/outlier-tile.tsx
- FOUND: src/components/thread/outlier-grid-block.tsx
- FOUND: src/components/discover/discover-grid.tsx
- FOUND commit: 6fd6174f (Task 1)
- FOUND commit: 5024f01b (Task 2)
- FOUND commit: 4d5bdfce (Task 3)
