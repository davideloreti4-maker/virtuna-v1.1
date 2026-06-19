---
phase: 08-discover-remix-read-the-competitor-niche-moat-chain
plan: 03
subsystem: discover
tags: [outlier-grid, typed-block, chain-handoff, discover-view, video-card-reuse, dotted-grid, remix-launch]

requires:
  - phase: 08-discover-remix-read-the-competitor-niche-moat-chain
    plan: 02
    provides: "POST /api/discover (classify→cap→cache→scrape→rank→tiles), classifyDiscoverInput, rankOutliers/RankedOutlier shape"
  - phase: 06-script-remix
    provides: "CHAIN_HANDOFFS registry + handoffsFor, /api/tools/remix/run rehost route, open-thread remix-card persistence + rehydration"
provides:
  - "outlier-grid typed block (BlockUnionSchema + BLOCK_REGISTRY + message-blocks renderer) — measured tiles, NO band/score/sim1-flash (Pitfall 5/D-05/D-11)"
  - "discover SkillId + discover→remix CHAIN_HANDOFFS entry (Remix → Read CTA → /api/tools/remix/run, anchorFrom card)"
  - "OutlierTile (reuses VideoCard metrics grid + labelled multiplier badge + source tag + single coral CTA)"
  - "DiscoverGrid (responsive grid over DottedGrid + loading/empty/error states)"
  - "DiscoverEntry (one-input-two-modes, live profile/niche classification hint)"
  - "(app)/discover route (RSC page + client) + sidebar nav entry"
affects: [Plan 04+ killer-feature Read, P9 living audience, P10 saved shelf]

tech-stack:
  added: []
  patterns:
    - "Reuse-first tile composition: OutlierTile imports VideoCard verbatim (video_url:null → plain div) and adds the badge/source/CTA around it — the 4-col metrics grid is never re-rolled"
    - "Registry-driven chain launch: the tile CTA reads the discover→remix endpoint from CHAIN_HANDOFFS (handoffsFor('discover')) — no hard-coded endpoint, no card edit to add a handoff"
    - "Chain coupling via persistence: remix run persists a remix-card to the open thread; the client routes to /home where the composer rehydrates persistedRemixBlocks (no new composer/home seam needed)"
    - "Tiles over a static DottedGrid base layer — the grid pans, the tiles are a normal responsive CSS grid laid over it (not drag-pannable)"

key-files:
  created:
    - src/components/discover/outlier-tile.tsx
    - src/components/discover/discover-grid.tsx
    - src/components/discover/discover-entry.tsx
    - src/app/(app)/discover/page.tsx
    - src/app/(app)/discover/discover-client.tsx
    - src/components/thread/outlier-grid-block.tsx
  modified:
    - src/lib/tools/blocks.ts
    - src/lib/tools/block-registry.ts
    - src/lib/tools/chain-handoff.ts
    - src/lib/tools/__tests__/chain-handoff.test.ts
    - src/components/thread/message-blocks.tsx
    - src/components/app/sidebar.tsx

key-decisions:
  - "Chain launch persists-then-navigates: the Remix → Read CTA POSTs the tile videoUrl to the registry endpoint /api/tools/remix/run (which persists a remix-card to the open thread) then router.push('/home'). Avoids adding a new query-param/store seam to the composer (out-of-wave surface) while still honouring 'tile CTA launches the chain, no card edit'."
  - "OutlierTile reuses VideoCard literally (passes video_url:null so VideoCard renders a plain div, not a whole-tile <a> link) — the tile's single action is the coral CTA, not a link-out. Satisfies the reuse-first + accent-law contracts simultaneously."
  - "Source tag mapped client-side: the route emits raw `niche:x`/`profile:x`; the client maps to the UI-SPEC display labels (niche label / 'Competitor'). Own-vs-competitor refinement is deferred to W3/W4 (D-15 v1)."
  - "outlier-grid renderer added (in-thread reference path, UI-SPEC B2) — registering the block in BLOCK_REGISTRY makes BlockType require an entry in message-blocks Record<BlockType,...>; the renderer reuses DiscoverGrid results state (no model-generated UI)."

patterns-established:
  - "A browsable own-grid view that is also a typed-block (outlier-grid) — the same tile shape powers both the Discover route and an in-thread reference."

requirements-completed: [DISC-02]

duration: 10min
completed: 2026-06-19
---

# Phase 08 Plan 03: W1 Frontend — Discover Front Door + Outlier Grid + Remix→Read Chain Summary

**Shipped the Discover front door: a browsable `(app)/discover` grid view where one input classifies @handle/URL→profile or free-text→niche with a live baseline hint, outlier tiles reuse the VideoCard metrics grid verbatim and carry an always-labelled `{n}× vs own|niche` multiplier (measured data, never a SIM score) + source tag + a single coral `Remix → Read` CTA that launches the discover→remix chain through the CHAIN_HANDOFFS registry — and all loading/empty/error states render honestly with no fake progress.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-19T08:22:01Z
- **Completed:** 2026-06-19T08:32:58Z
- **Tasks:** 3 (auto) + 1 deviation fix
- **Files:** 6 created, 6 modified

## Accomplishments

- **Task 1 — outlier-grid block + discover→remix chain wiring.** Added `OutlierGridBlockSchema` to `BlockUnionSchema`: a tile shape carrying VideoData-derived metrics (views/likes/comments/shares/saves), the measured `multiplier`, a `baselineLabel` enum (`vs own`/`vs niche`) so the renderer never shows a bare multiplier (D-05), a `source` tag, and the video reference Remix needs (`videoUrl`/`platformVideoId`). Deliberately NO `band`/`score`/`model: sim1-flash` field — Discover tiles are measured data, not SIM output (Pitfall 5/D-11). Registered `outlier-grid` in `BLOCK_REGISTRY`. Added `discover` to the `SkillId` union and appended a `from:discover → to:remix` `ChainHandoff` (`Remix → Read`, endpoint `/api/tools/remix/run`, `anchorFrom: "card"`). Extended `chain-handoff.test.ts` to assert the discover→remix entry resolves and discover is a valid SkillId.
- **Task 2 — OutlierTile + DiscoverGrid.** `OutlierTile` reuses `VideoCard` verbatim (passing `video_url:null` so it renders as a plain div) for the caption + 4-col metrics grid, then adds (a) the neutral 20px/600 tabular-nums multiplier badge rendered as `{n}× {baselineLabel}` (never coral, never bare), (b) the source sub-tag, and (c) the single coral `Remix → Read` CTA (46px touch target) — enforcing the board-kit accent law (exactly one coral per tile). `DiscoverGrid`: a responsive CSS grid (`minmax(164px,1fr)` → ~2-up at 390px) over the `DottedGrid` surface rendering the tiles, plus loading (tile skeletons via `Skeleton`, no fake %), empty/zero-result (Compass-icon centered shape), and error+retry (ScrapeErrorBanner shape with an `onRetry` seam), all using the exact UI-SPEC copy.
- **Task 3 — (app)/discover route + entry/client.** `DiscoverEntry`: a single 44px input with the placeholder copy, calling `classifyDiscoverInput` on change to drive the live mode hint (`Profile mode · ranked vs their own baseline` / `Niche mode · ranked vs niche median`). `DiscoverClient`: owns input state, POSTs `{ input }` to `/api/discover` on submit, manages loading/error/empty/results, renders `DiscoverGrid` over `DottedGrid`, and on `Remix → Read` reads the discover→remix endpoint from `handoffsFor('discover')` and POSTs the tile `videoUrl` to `/api/tools/remix/run` then `router.push('/home')` where the open thread rehydrates the persisted remix-card. `discover/page.tsx` is an auth-gated RSC mirroring the competitors split. Wired Discover (Compass icon, `/discover` active state) into the sidebar nav. NO save/watchlist/shelf affordance (P10).

## Task Commits

1. **Task 1: outlier-grid block + discover→remix chain handoff** — `87a01de8` (feat)
2. **Task 2: OutlierTile + DiscoverGrid** — `a2732fc8` (feat)
3. **Task 3: (app)/discover route + entry/client + nav** — `904f55be` (feat)
4. **Deviation fix: wire outlier-grid renderer into BLOCK_COMPONENTS** — `696e89f7` (fix)

## Files Created/Modified

**Created**
- `src/components/discover/outlier-tile.tsx` — OutlierTile (reuses VideoCard + multiplier badge + source tag + coral CTA)
- `src/components/discover/discover-grid.tsx` — DiscoverGrid + loading/empty/error states over DottedGrid
- `src/components/discover/discover-entry.tsx` — one-input-two-modes entry with live classification hint
- `src/app/(app)/discover/page.tsx` — auth-gated RSC
- `src/app/(app)/discover/discover-client.tsx` — input state + POST /api/discover + chain-launch
- `src/components/thread/outlier-grid-block.tsx` — in-thread outlier-grid renderer (UI-SPEC B2)

**Modified**
- `src/lib/tools/blocks.ts` — OutlierGridBlockSchema + union
- `src/lib/tools/block-registry.ts` — register outlier-grid
- `src/lib/tools/chain-handoff.ts` — discover SkillId + discover→remix entry
- `src/lib/tools/__tests__/chain-handoff.test.ts` — discover→remix assertions
- `src/components/thread/message-blocks.tsx` — map outlier-grid renderer (registry completeness)
- `src/components/app/sidebar.tsx` — Discover nav entry + active state

## Decisions Made

- **Persist-then-navigate chain launch.** The `Remix → Read` CTA does not pre-fill the composer via a new query-param/store seam (that would touch the composer/home surface owned by another wave). Instead it POSTs to the registry endpoint `/api/tools/remix/run`, which already persists a remix-card to the open thread, then routes to `/home` where the composer rehydrates `persistedRemixBlocks`. The chain is launched purely through the existing registry + persistence seams — no card-component edit, no composer change.
- **Literal VideoCard reuse via `video_url:null`.** VideoCard wraps the whole card in an `<a>` only when `video_url` is set. Passing `null` makes it render a plain div, so the tile's single action stays the coral CTA (not a competing link-out) while still satisfying "reuse VideoCard, do not re-roll the 4-col grid."
- **Client-side source-tag mapping.** The route returns raw `niche:<q>`/`profile:<q>` source strings; the client maps them onto the UI-SPEC display labels. The own-vs-competitor distinction (`Your channel` vs `Competitor`) is a W3/W4 refinement — v1 tags profile pulls as `Competitor` (D-15).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] outlier-grid registration forced a missing renderer entry**
- **Found during:** Overall verification (full `tsc --noEmit` after Task 3)
- **Issue:** Registering `outlier-grid` in `BLOCK_REGISTRY` (Task 1) widened `BlockType`, so `message-blocks.tsx`'s `Record<BlockType, React.ComponentType<…>>` failed to compile (`Property '"outlier-grid"' is missing`). The completeness gate is intentional — every registered block must have a renderer.
- **Fix:** Created `OutlierGridBlockRenderer` (reuses `DiscoverGrid` results state for the in-thread reference path per UI-SPEC B2 — no model-generated UI) and mapped it in `BLOCK_COMPONENTS`.
- **Files modified:** `src/components/thread/outlier-grid-block.tsx` (new), `src/components/thread/message-blocks.tsx`
- **Commit:** `696e89f7`

## Issues Encountered

- The targeted `pnpm test` runs the full suite (vitest project config) rather than only the matched file — all 2684 tests pass (27 skipped), so this is a non-issue, just slower feedback (~44s per run).

## Verification

- `chain-handoff` ✓ — discover→remix resolves with `Remix → Read` + endpoint `/api/tools/remix/run` + `anchorFrom: "card"`; discover is a valid SkillId; registry completeness asserts `discover→remix` present; all SkillId members resolve. Full suite: **2684 passed / 27 skipped**.
- `grep video-card src/components/discover/` ✓ — OutlierTile imports/reuses VideoCard.
- Multiplier badge always renders with `baselineLabel` (`vs own`/`vs niche`) — never a bare multiplier (source-asserted in outlier-tile.tsx).
- `grep discover src/lib/tools/chain-handoff.ts` ✓ — discover in the SkillId union AND a CHAIN_HANDOFFS entry.
- outlier-grid schema has `baselineLabel` and NO `z.literal("sim1-flash")` field (only an explanatory NO-comment).
- DiscoverGrid renders loading (tile skeletons via Skeleton)/empty/error states; error reuses the ScrapeErrorBanner shape.
- `discover/page.tsx` + `discover-client.tsx` exist; client POSTs `/api/discover`; entry uses `classifyDiscoverInput` for the live hint.
- No save/watchlist/shelf user-facing affordance (greps return only `saves:` metric fields + NO-comments).
- `pnpm exec tsc --noEmit` — no new discover/outlier/route non-test type errors. Pre-existing test-file errors (`partial_analysis`/`FlashAggregate`) are unrelated and out of scope.
- Lint: no new errors/warnings in any of the 6 created/2 modified files; the repo's 62 errors / 83 warnings are pre-existing debt across unrelated files (SCOPE BOUNDARY — not touched).

## User Setup Required

None. The route consumes the existing `/api/discover` (08-02) and `/api/tools/remix/run` (06-05) — no new env var, no migration.

## Next Phase Readiness

- The Discover funnel-top is live: a user can open `/discover`, paste a @handle/URL or type a niche, see the mode classified live, pull outlier tiles over the DottedGrid, and click `Remix → Read` to drop the winner into the thread chain (Remix → Hooks → Script → Test).
- The `outlier-grid` typed block is registered + rendered, so a Discover pull can also be referenced in-thread for the W3/W4 killer-feature Read.
- Saving / watchlist / shelf is intentionally absent (P10).

## Self-Check: PASSED

- FOUND: src/components/discover/outlier-tile.tsx
- FOUND: src/components/discover/discover-grid.tsx
- FOUND: src/components/discover/discover-entry.tsx
- FOUND: src/app/(app)/discover/page.tsx
- FOUND: src/app/(app)/discover/discover-client.tsx
- FOUND: src/components/thread/outlier-grid-block.tsx
- FOUND: commit 87a01de8 (Task 1)
- FOUND: commit a2732fc8 (Task 2)
- FOUND: commit 904f55be (Task 3)
- FOUND: commit 696e89f7 (deviation fix)
- VERIFIED: discover→remix in CHAIN_HANDOFFS; outlier-grid in BLOCK_REGISTRY + message-blocks
- VERIFIED: no sim1-flash literal field in OutlierGridBlockSchema; multiplier always labelled

---
*Phase: 08-discover-remix-read-the-competitor-niche-moat-chain-draft-no*
*Completed: 2026-06-19*
