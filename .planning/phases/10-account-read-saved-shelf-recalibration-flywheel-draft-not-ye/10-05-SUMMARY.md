---
phase: 10
plan: 05
subsystem: account-read
tags: [account-read, flywheel, typed-block, sse, reading-renderers, honesty-spine]
requires:
  - "src/lib/scraping/apify-provider.ts (scrapeProfile + scrapeVideos, own account)"
  - "src/lib/flywheel/reconciliation-repo.ts (listReconciliations — fix + track record)"
  - "src/lib/flywheel/reconcile.ts (CRAFT_DISPOSITIONS — D-03b split)"
  - "src/lib/audience/calibration.ts (THIN_MIN_VIDEOS pattern, P7 D-06)"
  - "src/components/reading/* (ReadingSection — fixed renderers reused)"
  - "src/components/thread/save-affordance.tsx (Plan 04, item_type 'read')"
provides:
  - "src/lib/account-read/account-read.ts (generateAccountRead + thin gate + track record)"
  - "account-read typed block (BlockUnionSchema + BLOCK_REGISTRY + BLOCK_COMPONENTS)"
  - "POST /api/account-read (SSE: status -> done/fallback/error)"
affects:
  - "src/lib/tools/blocks.ts"
  - "src/lib/tools/block-registry.ts"
  - "src/components/thread/message-blocks.tsx"
tech-stack:
  added: []
  patterns:
    - "calibrate/route.ts SSE pattern reused verbatim (maxDuration=300, auth-first, status/done/fallback/error)"
    - "P7 D-06 thin gate reused verbatim (getFollowerTier===null AND videos<THIN_MIN_VIDEOS)"
    - "multi-audience-read static-composed-card precedent for the typed block"
    - "pure deterministic extractor + pre-fetched deps (testable without SupabaseClient)"
key-files:
  created:
    - "src/lib/account-read/account-read.ts"
    - "src/lib/account-read/__tests__/account-read.test.ts"
    - "src/components/thread/account-read-block.tsx"
    - "src/app/api/account-read/route.ts"
  modified:
    - "src/lib/tools/blocks.ts"
    - "src/lib/tools/block-registry.ts"
    - "src/components/thread/message-blocks.tsx"
decisions:
  - "Own handle resolved from the authed user's personal audience calibration.handle (T-10-12 ownership) — no new OAuth, reuses P7 personal-scrape ownership"
  - "fix guidance sourced ONLY from CRAFT-disposition reconciliations (scanner/lurker/skeptic) — calibration dispositions never leak into craft-fix (D-03 protection, model never mutated)"
  - "track record withheld below TRACK_RECORD_MIN_ROWS=3 — empty copy shown (SELF-03)"
  - "no personal audience / no handle on file → honest thin fallback (never fabricate)"
  - "deterministic v1 extractor (no LLM) — Qwen pattern-naming reserved as future enrichment"
metrics:
  duration_min: 6
  tasks: 3
  files_created: 4
  files_modified: 3
  completed: 2026-06-19
---

# Phase 10 Plan 05: Account Read Summary

The "know thyself" surface — "a Read on your own account" — built LEAN on existing infra: Apify personal-scrape (P7), the fixed `reading/` renderers, the P7 thin gate, and the flywheel's craft-error reconciliation rows. A creator runs "Read my account" and gets an honest, `reading/`-rendered Read of their own history (recurring hooks, format mix, what's-working, what-to-fix) with a flywheel-sourced accuracy track record, savable to the shelf as `item_type: 'read'` — or an honest thin-history state that never fabricates patterns. Zero new packages.

## What Was Built

### Task 1 — `account-read.ts` pattern extraction + thin gate (SELF-01/02/03)
`generateAccountRead(handle, userId, deps, provider?)` scrapes the creator's own profile + videos (apidojo multi-post) and returns one of three typed results:
- **Success** — `AccountReadPatterns` (recurringHooks, formatMix, dropPoints, working, fix) + an optional `trackRecord`.
- **`{ fallback: 'thin' }`** — the P7 D-06 gate reused verbatim (`getFollowerTier === null AND videos < THIN_MIN_VIDEOS`). NEVER fabricates patterns (SELF-02).
- **`{ error: 'scrape_failed' }`** — distinct from thin (scrape/actor failure).

Pattern extraction is pure + deterministic (no `Date.now`/`Math.random`/I/O). `fix` aggregates the divergence magnitude of CRAFT dispositions (scanner/lurker/skeptic per the LOCKED A1 split) across reconciliation rows, ranks worst-first, and maps to craft guidance — calibration dispositions (the WHO) are excluded with defense-in-depth so a content flop never corrupts the model (D-03b). `computeTrackRecord` returns `{ withinPct, lastN }` only when ≥ `TRACK_RECORD_MIN_ROWS` (3) rows exist, else `null` (SELF-03).

### Task 2 — `account-read` typed block
`AccountReadBlockSchema` added to `blocks.ts` + `BlockUnionSchema`, registered in `BLOCK_REGISTRY` and `BLOCK_COMPONENTS` (rehydration-safe via `validateBlock`). `account-read-block.tsx` composes the fixed `ReadingSection` renderer for the hero ("A Read on your own account") + the pattern sections (What's working · What to fix · Recurring hooks · Format mix · Drop-points) — NO model-generated UI. Thin fallback renders warning-toned (`--color-warning`, never error/coral). The track-record number is cream-primary (data, never a coral CTA); its empty copy shows below threshold. A `<SaveAffordance item_type="read">` mounts on the success path with the block's own props as the shelf snapshot.

### Task 3 — `POST /api/account-read` SSE route
Mirrors `calibrate/route.ts` verbatim: `maxDuration = 300`, auth-first `getUser()`, SSE `status → done | fallback | error`. The own handle is resolved from the authed user's personal audience `calibration.handle` (T-10-12 ownership — never arbitrary input). No personal audience / no handle → honest thin fallback. Reconciliations are fetched read-only to feed `fix` + the track record. Error copy is generic and never echoes the raw handle (T-10-13). On success it emits the composed `account-read` block.

## Acceptance Criteria

- [x] Thin/empty history → `{ fallback: 'thin' }` with NO fabricated patterns (SELF-02).
- [x] `fix` derives from craft-error reconciliation rows only; the model is never mutated (D-03b).
- [x] Track record only present when ≥ `TRACK_RECORD_MIN_ROWS` rows exist (SELF-03).
- [x] SELF-03 empty-track-record path handled: rich account + zero reconciliations → patterns present, `trackRecord` null (covered by an explicit test).
- [x] Block registered in `BLOCK_REGISTRY` + `BlockUnionSchema` + `BLOCK_COMPONENTS` (rehydration-safe).
- [x] Renderer composes `reading/` components — no bespoke/model-generated Read UI.
- [x] Thin fallback uses `--color-warning`, never error/coral; track-record number cream-primary.
- [x] Stream emits `status → done | fallback | error`; `getUser()` before any scrape/DB read.

## Deviations from Plan

None — plan executed as written. The plan's `files_modified` listed `src/lib/account-read/account-read.ts` etc. as modified; they were created (the `src/lib/account-read/` directory did not previously exist). No behavioral deviation.

## SELF-03 Empty / Low-History Handling

Three graceful degradation paths, all honest (never fabricated):
1. **No personal audience / no handle on file** → route emits a `fallback` event with calibrate-first guidance (never scrapes, never fabricates).
2. **Thin scraped history** (P7 D-06 gate) → `{ fallback: 'thin' }` → warning-toned card, no patterns.
3. **Rich account but < 3 reconciliation rows** → patterns render fully, `trackRecord` is `null` → the renderer shows the "Not enough posted outcomes yet to show a track record. Capture a few and this builds." empty copy.

## Verification

- `npx vitest run src/lib/account-read/` → 14/14 PASS.
- `npm run build` → success (all routes compiled, including `/api/account-read` and `/saved`).
- `npx eslint` on all new/modified files → No issues found.
- Block round-trips through `validateBlock` (registry + union + components).

## Known Stubs

`patterns.dropPoints` ships as an empty array `[]` in v1 — the deterministic extractor does not yet derive retention drop-points (those need analysis/history retention data, wired in a future plan). The renderer degrades honestly ("— none detected yet"), never a fabricated drop-point. This is an intentional honest-empty, not a misleading stub: `analysisHistory` is already threaded through `AccountReadDeps` as the future enrichment seam.

## Threat Flags

None. The route introduces no new trust boundary beyond the plan's threat model: own-account scrape (T-10-12, ownership via P7 personal audience), thin gate honesty (T-10-13), registry-gated block (T-10-14), zero new packages (T-10-SC).

## Self-Check: PASSED

- FOUND: src/lib/account-read/account-read.ts
- FOUND: src/lib/account-read/__tests__/account-read.test.ts
- FOUND: src/components/thread/account-read-block.tsx
- FOUND: src/app/api/account-read/route.ts
- Commit a0779150 (test), a395e864 (impl), 02844797 (block), 250a4356 (route) — all in git log.
