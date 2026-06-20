# Phase 11: Explore (Audience-Curated Discovery) - Research

**Researched:** 2026-06-20
**Domain:** In-thread skill chain (Next.js 15 SSE) + audience-relative outlier math + reuse of P8 Discover / P9 reaction primitive / chain-handoff
**Confidence:** HIGH (the entire phase is wiring + extending already-shipped, in-repo systems — every claim is `[VERIFIED: codebase]` from files read this session)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Eager honest audience-fit score per tile; real SIM reaction on tap. The result grid annotates each tile with an audience-relative score — re-rank/weight P8's measured outlier multiplier against the active audience's niche + calibration (a "vs YOUR audience" baseline, same legitimate math family as `rankOutliers`' "vs niche" baseline). Cheap, always-present layer.
- **D-02:** Honesty spine is hard-binding — no fabricated reactions on the grid. The eager per-tile signal is an honest *fit score/indicator* (re-ranked math), NOT a fabricated persona quote/verdict. The real persona reaction (quotes + stop/scroll verdict) is produced by the P9 reaction primitive ONLY on tap, from real SIM output. Never synthesize a quote to fill a tile. Degrade gracefully (show the measured multiplier + fit score) when no audience signal is available.
- **D-03:** Rejected eager full-SIM-per-tile (cost/latency-prohibitive on a ~20–30-tile/pull daily surface) and rejected measured-only grid (hides the moat). Split = cheap honest score eager, expensive real reaction lazy.
- **D-04:** Remix-then-Read. Tapping a result tile generates the creator's OWN version of the outlier for their audience (Remix), SIM-tests *that*, and lands on a Read. An outlier is NOT the creator's content, so "lands on a Read" *implies* the remixed version. Reuse the already-registered `discover→remix` chain handoff + `remix-card` block.
- **D-05:** CTA wording LOCKED: "Remix → Read" — never "rewrite for me" / "rewrite this".
- **D-06:** Audience-derived quick-actions + params sheet incl. serendipity valve. Idle state shows 2–4 audience-aware quick-action cards (e.g. "Top performers in my niche today", "What competitors shipped", "Surprise me"), each running a preset pull. A params sheet refines: niche/keywords, accounts, time-window, and a serendipity slider (widen-beyond-niche valve).
- **D-07:** Explore's thread view owns its own idle/empty state (precedent: `ChatThreadView`). Quick-actions live there, not as a global home affordance.
- **D-08:** P11 ships the minimal "Track this account" WRITE on result tiles — persists a watchlist row that is flat + typed + Library-compatible (P10 D-07 Saved-shelf model). P11 *produces* the watchlist input; P12 builds the management/Library UI with no rework.
- **D-09:** Comment-seeding (EXPLORE-06) DEFERRED again. Off the core spine, twice-deferred. → a later phase. **Do NOT plan it.**

### Claude's Discretion

- Exact eager fit-score formula (niche-match + calibration weighting of the measured multiplier) — must stay honest (no fabricated reaction) and reuse `rankOutliers` arithmetic where possible. **→ This research prescribes a concrete formula (see §Architecture Patterns → Pattern 2).**
- Visual encoding of the fit score on the tile — **PRESCRIBED in 11-UI-SPEC.md as a 3-segment fit bar + "FIT · {Strong|Fair|Weak}" label** (NOT dots, NOT a number).
- New typed block(s) vs reuse of `outlier-grid` (extend with audience-fit field, or add `explore-grid` variant) — **prefer extend. This research confirms EXTEND is feasible + lists every touch point (see §Architecture Patterns → Pattern 3).**
- Quick-action copy + count (2–4) — **PRESCRIBED as 3 in 11-UI-SPEC.md.**
- Whether the params sheet is a popover/sheet vs inline — **PRESCRIBED as an upward popover beside the composer skill pill in 11-UI-SPEC.md.**

### Deferred Ideas (OUT OF SCOPE)

- **Comment-seeding (EXPLORE-06)** — twice-deferred (D-09). Do NOT plan.
- **Library / watchlist management UI + 4-item IA collapse** — Explore only *produces* the watchlist row (D-08). All surfacing/management → P12.
- **Ambient reaction on every skill card, proactive morning drops, scheduled Explore** → P13 (must not duplicate P9's primitive).
- **Idea-inbox / hook-vault / collections "on the outlier spine"** (superseded older Living-Research-Feed rescope) — NOT P11.
- **Export / "Export for LLM"** — explicitly SKIP (don't bleed the closed loop).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXPLORE-01 | Explore skill in-thread — audience-curated outlier/competitor discovery; customizable params (audience-on-tap + serendipity valve); reuses P8 apidojo Discover + outlier-score | Skill-chain wiring checklist (§Architecture Pattern 1) mirrors Hooks/Discover; params + serendipity widen the existing `/api/discover` pull/rank logic lifted into `/api/tools/explore` (§Pattern 2 + §Don't Hand-Roll). |
| EXPLORE-02 | Each result card carries an ambient audience reaction + lands on a Read; tile CTA "Remix → Read" | Eager fit bar (§Pattern 2) = the ambient honest signal; the on-tap **real** reaction + Read come **for free** by reusing the existing `discover→remix` chain → `remix-card` which ALREADY mounts the P9 `LensTrigger` (§Pattern 4, the most important finding). |
| EXPLORE-03 | Audience-relative outlier scoring — relative to YOUR audience, not generic view-count | Concrete re-rank formula reusing `rankOutliers` arithmetic + audience `personas[].temperature` + niche-keyword overlap on `caption`/`hashtags` (§Pattern 2). Pure honest math, no SIM call. |
| EXPLORE-04 | Start-screen set-actions — audience-aware quick-actions | `ExploreThreadView` owns its idle state (D-07, precedent `ChatThreadView`); 3 prescribed quick-action cards derive from the active `Audience` (§Pattern 5). |
| EXPLORE-05 | Tracked-accounts/watchlist as input State — lives in Library (P12); P11 ships PRODUCER half | New `tracked_accounts` table mirroring `saved_items` RLS idiom + `+ Track account` write on tiles (§Pattern 6 / §Don't Hand-Roll). Consume/management UI is P12. |
| EXPLORE-06 | Comment seeding | **DEFERRED again (D-09). Not in this phase.** |
</phase_requirements>

## Summary

Phase 11 is **~90% wiring of already-shipped systems**, not new construction. Every load-bearing primitive exists in-repo and was read this session: the P8 Discover pull/rank stack (`apify-provider.ts`, `outlier-compute.ts`, `discover-grid.tsx`, `outlier-tile.tsx`, `/api/discover`), the canonical in-thread skill chain (composer dispatch → SSE route → runner → stream hook → thread view → typed block → `message-blocks` dispatch with D-14 double-validation), the `CHAIN_HANDOFFS` registry with `discover→remix` already live, the P9 reaction primitive (`LensTrigger` + `cardScrollQuoteReactions` + `AudienceLens`), the `Audience` object + `getAudience` loader, and the flat-typed `saved_items` watchlist precedent.

**The single most important finding (de-risks the whole phase):** D-04 "Remix → Read" requires essentially **no new chain code**. Tapping the tile's "Remix → Read" launches the existing `discover→remix` handoff (`POST /api/tools/remix/run` with the tile's `videoUrl`), which decode→adapts the outlier and persists a `remix-card`. That `remix-card` renderer (`remix-card-block.tsx`) ALREADY mounts the P9 `LensTrigger` with `cardScrollQuoteReactions(fraction, scrollQuote)` — so the real, honest, non-fabricated persona reaction (D-02) and the SIM-validated Read appear automatically. The Explore tile reuses `DiscoverClient`'s exact `handleRemix` pattern verbatim (`handoffsFor("discover").find(h => h.to === "remix")`). **No `CHAIN_HANDOFFS` edit, no new runner, no new Read layout.**

The genuinely new build is small and well-scoped: (1) lift the `/api/discover` pull/rank logic into a new SSE route `/api/tools/explore` that follows the skill-chain SSE contract and adds the **audience-relative fit re-rank** (pure honest math — Pattern 2) + serendipity-widen param; (2) extend `OutlierGridBlockSchema` with an optional `fit` field + `trackable` flag (no migration — mirrors the `predictedFailureMode` nullable-optional precedent); (3) a new `ExploreThreadView` owning its idle quick-actions (D-07); (4) a new flat-typed `tracked_accounts` table + `+ Track account` write (D-08); (5) enable the already-stubbed `explore` skill pill and wire the composer dispatch branch.

**Primary recommendation:** Mirror the Hooks/Discover skill-chain file-for-file (the checklist in §Architecture Pattern 1 is exhaustive), reuse `discover→remix` for the tap (do NOT fork a parallel path), keep the fit score as pure re-ranked arithmetic on `rankOutliers` output (never a SIM call on the grid — D-02/D-03), and extend (not duplicate) the `outlier-grid` block.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Explore skill selection / idle quick-actions / params popover | Browser / Client (`Composer`, `ExploreThreadView`, `ComposerControls`) | — | Skill state + idle ownership are client concerns; D-07 explicitly puts idle in the thread view (precedent `ChatThreadView`). |
| Outlier pull (apidojo scrape) + cache + daily cap | API / Backend (`/api/tools/explore` route) | External (Apify apidojo actor) | Scrape is a server-only secret-bearing call (`APIFY_TOKEN`); SSRF + auth + cap MUST live server-side. Lifted from `/api/discover`. |
| Audience-relative fit re-rank (the D-01/EXPLORE-03 math) | API / Backend (pure module `explore-rank.ts`, called by the route) | — | Pure deterministic arithmetic on scraped `VideoData[]` + the loaded `Audience`; no network, no SIM. Belongs beside `outlier-compute.ts`. |
| On-tap Remix → SIM → Read + real persona reaction | API / Backend (`/api/tools/remix/run` — UNCHANGED) + Client (`remix-card` renderer mounts `LensTrigger`) | Engine (Flash SIM on adapted hook — UNCHANGED) | Reuse the shipped `discover→remix` chain verbatim. The reaction is REAL SIM output rendered by the P9 primitive (D-02). |
| Watchlist "Track account" write | API / Backend (new `/api/tracked-accounts` + `tracked-accounts-repo.ts`) + DB (new `tracked_accounts` table) | — | A durable per-user write; RLS own-rows-only (mirrors `saved_items`). Producer half only (D-08); management UI is P12. |
| Fit-score / quick-action visual encoding | Browser / Client (`outlier-tile.tsx` extension, `ExploreThreadView`) | — | Fixed typed-renderer library (THREAD-04 — no model-generated UI). |

## Standard Stack

> P11 introduces **NO new external packages** (11-UI-SPEC.md §Registry Safety confirms: no new shadcn blocks, no third-party registries). Everything composes from in-repo modules + dependencies already in the tree. The "stack" below is the **in-repo module surface** the planner builds against.

### Core (in-repo, reused verbatim)
| Module | Path | Purpose | Why Standard |
|--------|------|---------|--------------|
| `rankOutliers` / `median` / `WINDOW_DAYS` / `HALF_LIFE_DAYS` | `src/lib/discover/outlier-compute.ts` | Pure recency-decayed outlier multiplier + honest baseline label | The D-01 fit re-rank wraps this; same honest-math family (`[VERIFIED: codebase]`). |
| `createScrapingProvider()` → `ApifyScrapingProvider.scrapeVideos` | `src/lib/scraping/index.ts` + `apify-provider.ts` | apidojo TikTok scrape + SSRF allowlist | The Explore pull reuses it byte-for-byte; SSRF + actor IDs already vetted (P8/P10) (`[VERIFIED: codebase]`). |
| `CHAIN_HANDOFFS` / `handoffsFor` | `src/lib/tools/chain-handoff.ts` | `discover→remix` "Remix → Read" already registered (endpoint `/api/tools/remix/run`) | D-04/D-05 reuse this entry; **no edit needed** (`[VERIFIED: codebase]`). |
| `LensTrigger` + `cardScrollQuoteReactions` + `AudienceLens` | `src/components/audience-lens/` | P9 on-tap real reaction primitive (never fabricates) | The `remix-card` already mounts it → the Explore tap reaction is free (D-02) (`[VERIFIED: codebase]`). |
| `getAudience` / `GENERAL_AUDIENCE` / `Audience` | `src/lib/audience/audience-repo.ts` + `audience-types.ts` | Load active audience from `openThread.active_audience_id`; General default | Drives D-01 scoring + D-06 quick-actions (`[VERIFIED: codebase]`). |
| `buildAudienceGroundingLine` | `src/lib/audience/audience-grounding.ts` | Honest audience-facing "Because: your {platform} audience — {temp · dispositions}" line | Reuse for the fit-score provenance copy / quick-action subtitles (`[VERIFIED: codebase]`). |
| `validateBlock` / `assertBlocksInRegistry` / `BLOCK_REGISTRY` | `src/lib/tools/block-registry.ts` | D-14 double-validation SSOT | The extended `outlier-grid` block re-validates here at write + rehydration (`[VERIFIED: codebase]`). |
| `insertMessage` | `src/lib/threads/messages.ts` | Persist typed blocks + `KC_GEN_VERSION` to the open thread | Explore persists its grid block via this (`[VERIFIED: codebase]`). |
| `kcStamp().kcGenVersion` | `src/lib/kc/kc-stamp.ts` | KC provenance stamp on persisted messages | Every skill route stamps it; Explore must too (`[VERIFIED: codebase]`). |
| `createSavedItem` (pattern, NOT reused) | `src/lib/shelf/shelf-repo.ts` | The flat-typed repo idiom the new `tracked-accounts-repo` mirrors | D-08 says flat + typed + Library-compatible; this is the template (`[VERIFIED: codebase]`). |
| `csrfGuard` | `src/lib/http/csrf-guard.ts` | Content-Type 415 + cross-origin 403 on mutating POSTs | Every skill/scrape route calls it; Explore + track-account routes must (`[VERIFIED: codebase]`). |

### Supporting (in-repo, reused/extended)
| Module | Path | Purpose | When to Use |
|--------|------|---------|-------------|
| `DiscoverGrid` / `OutlierTile` / `OutlierTileData` | `src/components/discover/` | Responsive grid + tile (4 states) | Reuse verbatim; `OutlierTile` gets the fit-bar + Track-account extension (11-UI-SPEC §Surface 1). |
| `classifyDiscoverInput` | `src/lib/discover/classify-input.ts` | profile-vs-niche input classification | Reuse for the params-sheet accounts/niche routing. |
| `getCachedDiscover` / `checkUserCap` / `DISCOVER_DAILY_CAP` | `src/lib/discover/discover-cache.ts` | Per-(input,mode,day) cache + per-user daily cap | Reuse; **see Pitfall 5 — it is in-memory, not durable across serverless instances.** |
| `useHooksStream` (template) | `src/hooks/queries/use-hooks-stream.ts` | The fetch+getReader SSE consumer pattern (NOT EventSource) | `use-explore-stream` clones this shape. |
| `HooksThreadView` (template) | `src/components/thread/hooks-thread-view.tsx` | Thread-view that renders streaming + persisted + progress + error | `ExploreThreadView` clones this shape, adds the idle quick-actions block (D-07). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Lifting `/api/discover` logic into a new `/api/tools/explore` route | Calling `/api/discover` from the Explore client, then a separate fit-rank pass client-side | REJECTED — fit-rank needs the loaded `Audience` (server, from `active_audience_id`) and the grid block must persist to the open thread (server). The skill-chain contract is server-SSE. Lift the logic. |
| Extending `OutlierGridBlockSchema` with optional `fit` | New `explore-grid` block + renderer + registry entry | CONTEXT prefers extend; this research confirms extend is feasible with zero migration (nullable-optional, mirrors `predictedFailureMode`). Duplicating doubles the renderer/registry/validation surface for no gain. |
| Reusing `discover→remix` for the tap | A new `explore→remix` chain entry | REJECTED — `discover→remix` already does exactly the right thing (`videoUrl` → adapt → `remix-card` with P9 reaction). A parallel entry is pure duplication; `from:"discover"` is fine (the tile is a discover-shaped tile). |
| New durable `tracked_accounts` table | Overloading `saved_items` with `item_type:'tracked_account'` | RECOMMENDED new table — `saved_items.snapshot` is a block snapshot for re-render; a tracked account is an input *handle*, not a saved block. D-08 says "flat + typed + Library-compatible" and the `saved_items` migration comment explicitly says P12 EXTENDS with *separate* tables. A dedicated table matches that intent and keeps the shelf semantics clean. (Planner may confirm in discuss — see Open Questions Q1.) |

**Installation:** none — no packages added.

**Version verification:** N/A — no external packages introduced this phase. (`ENGINE_VERSION = "3.19.0"` confirmed at `src/lib/engine/version.ts:127`; **must remain unchanged** — see Pitfall 6.)

## Package Legitimacy Audit

> **Not applicable.** Phase 11 installs no external packages (verified against 11-UI-SPEC.md §Registry Safety and the absence of any new dependency in scope). All work composes existing in-repo modules + dependencies already in `package.json` (`apify-client`, `zod`, Radix, `react-markdown`, `@phosphor-icons/react`). No registry lookups required.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────────┐
   CREATOR               │  Composer (composer.tsx)                     │
   picks /explore  ─────▶│  activeTool="explore" → showExploreView      │
   or quick-action       │  dispatch branch in handleSubmit (NEW)       │
                         └───────────────┬─────────────────────────────┘
                                         │ (idle) renders
                                         ▼
                    ┌────────────────────────────────────────┐
                    │ ExploreThreadView (NEW, owns idle)      │
                    │  • 3 audience-derived quick-action cards │  ◀── Audience (getAudience)
                    │  • params popover (niche/accounts/window │       drives card copy + degrade
                    │    /serendipity) beside skill pill       │
                    │  • streaming + persisted grid + error    │
                    └───────────────┬────────────────────────┘
                                    │ start(params) → SSE
                                    ▼
       ┌──────────────────────────────────────────────────────────────┐
       │ POST /api/tools/explore  (NEW SSE route — mirrors hooks route)│
       │  auth → csrfGuard → openThread → getAudience(active_audience) │
       │  → checkUserCap → cache OR scrapeVideos(apidojo)              │
       │  → rankOutliers(videos,mode)         [P8, honest multiplier]  │
       │  → rankWithAudienceFit(ranked, audience, serendipity)  (NEW)  │  ◀── pure math, NO SIM call
       │  → build outlier-grid block {tiles[+fit,+trackable], mode}    │       (D-02/D-03)
       │  → SSE: stage / content(faces) / score? / done               │
       │  → insertMessage(openThread, block, kcGenVersion)             │
       └───────────────┬──────────────────────────────────────────────┘
                       │ tiles render via message-blocks dispatch (D-14 validate)
                       ▼
       ┌──────────────────────────────────────────────────────────┐
       │ OutlierTile (EXTENDED)                                     │
       │  measured multiplier (neutral) ─ fit bar "FIT·Strong"     │  fit = re-ranked estimate,
       │  (predicted, omitted on General) ─ metrics grid           │  NEVER coral, NEVER a quote
       │  [+ Track account] ──────────────▶ POST /api/tracked-accts│──▶ tracked_accounts (NEW table)
       │  [Remix → Read] (coral, the one accent)                   │       (D-08 producer half → P12)
       └───────────────┬──────────────────────────────────────────┘
                       │ onRemix(tile) — VERBATIM DiscoverClient pattern:
                       │ handoffsFor("discover").find(h=>h.to==="remix")
                       ▼
       ┌──────────────────────────────────────────────────────────┐
       │ POST /api/tools/remix/run  (UNCHANGED — reuse)            │
       │  resolve → decode → adapt → Flash gate → remix-card       │
       │  persist remix-card to open thread → navigate /home       │
       └───────────────┬──────────────────────────────────────────┘
                       │ remix-card rehydrates in thread
                       ▼
       ┌──────────────────────────────────────────────────────────┐
       │ RemixCardRenderer (UNCHANGED)                             │
       │  adapted hook + decode anatomy + band chip                │
       │  └─ LensTrigger(cardScrollQuoteReactions(fraction,quote)) │  ◀── REAL SIM reaction (D-02),
       │     → AudienceLens (real persona quotes + verdicts)       │       the Read + "the room"
       └──────────────────────────────────────────────────────────┘
```

The reader can trace the primary use case end-to-end: creator picks `/explore` (or a quick-action) → server pulls + ranks + audience-fit-scores → tiles render with the honest fit bar → tap "Remix → Read" → existing remix chain produces the adapted concept + REAL SIM reaction + Read. **Everything below the `/api/tools/explore` route already exists.**

### Recommended Project Structure (new + extended files)
```
src/
├── lib/
│   ├── discover/
│   │   ├── outlier-compute.ts          # REUSE (rankOutliers) — do not edit
│   │   └── explore-rank.ts             # NEW — pure audience-fit re-rank (Pattern 2)
│   ├── tracked-accounts/
│   │   └── tracked-accounts-repo.ts    # NEW — flat-typed repo (mirrors shelf-repo.ts)
│   └── tools/
│       ├── blocks.ts                   # EXTEND — OutlierGridBlockSchema.props += fit?, trackable?
│       └── runners/
│           └── explore-runner.ts       # NEW — pull→rank→fit→build block (thin; route may inline)
├── app/
│   ├── api/
│   │   ├── tools/explore/route.ts      # NEW — SSE route (mirrors hooks/route.ts)
│   │   └── tracked-accounts/route.ts   # NEW — POST/GET/DELETE (mirrors saved/route.ts)
├── components/
│   ├── discover/
│   │   ├── outlier-tile.tsx            # EXTEND — fit bar + "+ Track account" (11-UI-SPEC §1)
│   │   └── discover-grid.tsx           # REUSE (maybe a thin fit-bar skeleton slot, §5)
│   ├── thread/
│   │   ├── outlier-grid-block.tsx      # EXTEND — pass fit/trackable + onRemix/onTrack to grid
│   │   └── explore-thread-view.tsx     # NEW — owns idle quick-actions (mirrors hooks-thread-view)
│   └── app/home/
│       ├── composer.tsx                # EXTEND — explore stream + view-gate + submit branch
│       └── composer-controls.tsx       # EDIT — flip explore skill `enabled: false → true`
├── hooks/queries/
│   └── use-explore-stream.ts           # NEW — fetch+getReader SSE consumer (mirrors use-hooks-stream)
└── supabase/migrations/
    └── 2026XXXX_tracked_accounts.sql   # NEW — flat-typed table + RLS (mirrors saved_items)
```

### Pattern 1: The canonical in-thread skill chain — file-by-file wiring checklist (mirrors Hooks)

**What:** Every skill in the repo follows ONE chain. Explore mirrors it. This is the exhaustive checklist the planner turns into tasks. Each row cites the exemplar file read this session.

| Layer | Explore file (NEW unless noted) | Mirror this exemplar | Key contract to preserve |
|-------|--------------------------------|----------------------|--------------------------|
| 1. Skill pill SSOT | `composer-controls.tsx` (EDIT) | `SKILLS` array | Flip `explore` row `enabled: false → true`. `model: "Flash"`, `group:"creator"`, icon `compass`, command `/explore` already set. `ToolId` union already includes `"explore"`. |
| 2. SSE route | `src/app/api/tools/explore/route.ts` | `src/app/api/tools/hooks/route.ts` | auth-first (`getUser` → 401) → `csrfGuard` → parse+cap body → load `creator_profiles` → `createOpenThreadLazy(user.id)` → load active audience from `openThread.active_audience_id` via `getAudience` (fallback `GENERAL_AUDIENCE`, non-fatal) → SSE `ReadableStream` with `send(event,data)` → `insertMessage(openThread.id,"assistant",[block],kcStamp().kcGenVersion)`. **Audience id NEVER from body (CR-01).** |
| 3. Runner (or inline) | `src/lib/tools/runners/explore-runner.ts` | `hooks-runner.ts` (structure) + `/api/discover` (pull/rank) | Pull → `rankOutliers` → `rankWithAudienceFit` (Pattern 2) → build `outlier-grid` block. Validate with `OutlierGridBlockSchema.safeParse` (D-14 belt-and-suspenders). **No SIM call here** (D-02/D-03). The route may inline this — Explore has no Flash/gate loop, so a thin runner is fine. |
| 4. Stream hook | `src/hooks/queries/use-explore-stream.ts` | `use-hooks-stream.ts` | **`fetch` + `res.body.getReader()` — NOT `EventSource`** (EventSource is GET-only, can't POST a body — documented BLOCKER-1). Parse `\n\n`-delimited frames; handle `stage`/`content`/`done`/`error`. Expose `start(params)`, `stop`, `reset`, `toBlocks()`. |
| 5. Thread view | `src/components/thread/explore-thread-view.tsx` | `hooks-thread-view.tsx` + `chat-thread-view.tsx` (idle ownership) | `max-w-[760px] mx-auto … gap-6 px-4 py-6`. Renders `ProgressChecklist` while streaming, the grid (streaming + persisted via `MessageBlocks`), `SkillRunError` on error, AND **owns its idle quick-actions** (D-07 — unlike Hooks, Explore shows idle content like `ChatThreadView`). |
| 6. Typed block | `src/lib/tools/blocks.ts` (EXTEND) | `OutlierGridBlockSchema` + `predictedFailureMode` precedent | Add `fit` (nullable-optional) + `trackable?` (optional) to `tiles[*]`. No migration. (Pattern 3.) |
| 7. Block registry | `src/lib/tools/block-registry.ts` | already has `"outlier-grid"` | **No change** — extending the existing schema needs no registry edit (the key already exists). |
| 8. Renderer dispatch | `src/components/thread/message-blocks.tsx` | `BLOCK_COMPONENTS["outlier-grid"]` already → `OutlierGridBlockRenderer` | **No change to the map.** But `OutlierGridBlockRenderer` itself (EXTEND) must pass `onRemix`/`onTrack`/fit through to `DiscoverGrid`/`OutlierTile` (today it renders a static reference — see Pitfall 3). |
| 9. Composer dispatch | `composer.tsx` (EXTEND) | the `hooks`/`remix` branches | Add `const explore = useExploreStream()`, `showExploreView` gate, persisted-blocks load (filter `b.type === 'outlier-grid'`), `handleSubmit` branch for `activeTool === "explore"` (NEVER arm `pendingNavRef`/`stream.start` — Pitfall 1), and mount `<ExploreThreadView>` in `threadContent`. |

**SSE stage contract (preserve exactly — clients parse `event:`/`data:` lines):** emit coarse real-pipeline stages around the awaited pull (mirrors hooks/remix routes — "real not timed", STUDIO-01/D-02). Suggested stages: `"Pulling outliers"` → `"Scoring for your audience"` (the fit re-rank) → done. **No fake `%`** (the apidojo pull is genuinely minutes — 11-UI-SPEC copy: "this can take a few minutes").

### Pattern 2: Audience-relative fit re-rank — the concrete D-01/EXPLORE-03 formula (PRESCRIBED)

**What:** A pure, deterministic function `rankWithAudienceFit(ranked: RankedOutlier[], audience: Audience, serendipity: number)` that lives in a new `src/lib/discover/explore-rank.ts` (beside `outlier-compute.ts`, same no-network purity). It takes the P8 `rankOutliers` output and annotates each tile with a quantized `fit` level. **It is honest re-ranked math — NOT a SIM call, NOT a fabricated quote (D-02/D-03).**

**When to use:** Called by `/api/tools/explore` immediately after `rankOutliers`, before building the block.

**Inputs that drive the score (all already on hand, `[VERIFIED: codebase]`):**
- `tile.multiplier` + `tile.baselineLabel` — the measured outlier signal from `rankOutliers` (the honest base).
- `tile.caption` + `tile.hashtags` (`VideoData.hashtags: string[]`, confirmed in `scraping/types.ts`) — for niche-keyword overlap.
- `audience.personas[]` — `CalibratedPersona { temperature: 'cold'|'warm'|'hot', disposition, share }` (the calibration signal).
- `audience.profile?.temperature_mix` + `top_dispositions` — aggregate calibration (when present).
- `audience.goal_intent` / `goal_label` / `name` — niche / intent context.
- `audience.is_general` / `calibration?.thin` — the **degrade gate** (D-02): no calibrated signal → omit fit entirely.

**Formula sketch (Claude's discretion — prescribed; planner may tune constants):**

```ts
// explore-rank.ts — PURE, deterministic, NO network, NO SIM (D-02/D-03).
export type FitLevel = "Strong" | "Fair" | "Weak";

export interface FitRankedOutlier extends RankedOutlier {
  /** Quantized audience-fit estimate. null = no calibrated signal → renderer omits the bar (D-02). */
  fit: { level: FitLevel } | null;
}

// Degrade gate (D-02): General / preset / thin calibration → no fit signal at all.
function hasFitSignal(a: Audience): boolean {
  return !a.is_general && !a.is_preset && !a.calibration?.thin
      && Array.isArray(a.personas) && a.personas.length > 0;
}

// (a) Niche-match: keyword overlap between the tile and the audience niche vocabulary.
//     Audience niche tokens = audience.name + goal_label split to words (+ any niche field).
//     Tile tokens = caption words + hashtags. Jaccard-ish overlap → 0..1.
function nicheMatch(tile: RankedOutlier, audience: Audience): number { /* token overlap, 0..1 */ }

// (b) Calibration-fit: how well the tile's "temperature demand" matches the audience temp mix.
//     A high-multiplier outlier is a COLD-reach play (broad FYP); a modest, high-save/comment
//     post is a WARM/loyalist play. Map the tile's measured signature (multiplier + saves/views +
//     shares/views, all already on RankedOutlier) onto cold/warm/hot demand, then dot-product with
//     the audience temperature_mix (or derive the mix from personas[].temperature × share). → 0..1.
function calibrationFit(tile: RankedOutlier, audience: Audience): number { /* dot-product, 0..1 */ }

export function rankWithAudienceFit(
  ranked: RankedOutlier[],
  audience: Audience,
  serendipity: number,            // 0 = on-niche, 1 = widen beyond niche (the valve, D-06)
): FitRankedOutlier[] {
  if (!hasFitSignal(audience)) {
    // Honest degrade (D-02): no fit, keep the measured ranking exactly as P8 produced it.
    return ranked.map((t) => ({ ...t, fit: null }));
  }
  const scored = ranked.map((t) => {
    const nm = nicheMatch(t, audience);          // 0..1
    const cf = calibrationFit(t, audience);       // 0..1
    // Serendipity DOWN-WEIGHTS niche-match so off-niche tiles can surface (the valve).
    const nicheWeight = 1 - serendipity;          // slide right → niche matters less
    const fitScore = nicheWeight * nm + (1 - nicheWeight) * cf;   // 0..1 continuous
    const level: FitLevel = fitScore >= 0.66 ? "Strong" : fitScore >= 0.4 ? "Fair" : "Weak";
    // Re-rank: blend the measured rankKey with the fit estimate so "fits YOUR audience" floats up,
    // but the measured signal still dominates (honesty: we never hide a real outlier).
    return { tile: t, fitScore, level };
  });
  // Sort by a blended key (measured rankKey * (1 + α·fitScore)); α small so measured stays primary.
  scored.sort((x, y) => (y.tile.rankKey * (1 + 0.5 * y.fitScore))
                       - (x.tile.rankKey * (1 + 0.5 * x.fitScore)));
  return scored.map(({ tile, level }) => ({ ...tile, fit: { level } }));
}
```

**Honesty constraints baked in (D-02, hard-binding):**
- The function returns a **level word only** (`Strong|Fair|Weak`) — no number, no quote, no verdict, no persona voice. The 11-UI-SPEC explicitly maps this to a 3-segment bar + "FIT · {level}" + "predicted" sub-line (NOT a 0–100 number — that would invite "is this the SIM verdict?" confusion).
- When `hasFitSignal` is false (General / preset / thin), `fit: null` → the renderer **omits the bar entirely** and shows only the measured multiplier (today's `OutlierTile`). Never an empty/zero bar.
- The serendipity slider only re-weights niche-match in the formula — it does not fabricate anything; it widens what surfaces.

**Why this stays "the same legitimate math family as rankOutliers' vs-niche baseline" (D-01):** `rankOutliers` already computes a relative measure (`views / median`). The fit re-rank computes another relative measure (tile signature · audience calibration) and *blends* it into the sort. Both are deterministic arithmetic on real scraped numbers + stored calibration — no model inference, no invented data.

### Pattern 3: Extend `OutlierGridBlockSchema` (NOT a new block) — the concrete schema diff + every touch point

**What:** Add two optional fields to the existing block (prefer extend, CONTEXT). The `predictedFailureMode` field on `IdeaCardBlockSchema`/`HookCardBlockSchema` is the EXACT precedent (`[VERIFIED: codebase]` — `.nullable().optional()` so existing persisted blocks + rehydration stay valid, no migration).

**Schema diff (`src/lib/tools/blocks.ts`, inside `OutlierGridBlockSchema.props.tiles` object):**
```ts
// ── ADD to each tile object in OutlierGridBlockSchema.props.tiles ──
// EXPLORE-03 (D-01): the audience-relative fit ESTIMATE. Level word only — NO number,
// NO band, NO quote, NO model tag (honesty spine D-02: this is re-ranked math, NOT SIM output).
// null = no calibrated audience signal → renderer omits the bar entirely (degrade, D-02).
// OPTIONAL → existing persisted outlier-grid blocks stay valid (no migration, mirrors predictedFailureMode).
fit: z.object({ level: z.enum(["Strong", "Fair", "Weak"]) }).nullable().optional(),
// EXPLORE-05 (D-08): whether this tile offers the "+ Track account" affordance.
// OPTIONAL → existing blocks default to no track button (Discover view stays unchanged).
trackable: z.boolean().optional(),
// (OPTIONAL) the account handle the track button writes — needed only when trackable.
trackHandle: z.string().optional(),
```

**Every downstream touch point (the planner's checklist — what changes vs what is verified-safe):**
| Touch point | File | Change |
|-------------|------|--------|
| Schema | `blocks.ts` `OutlierGridBlockSchema` | ADD the 3 optional fields above. `OutlierGridBlock` type re-infers automatically. |
| Validation SSOT | `block-registry.ts` | **NONE** — `"outlier-grid"` entry already exists; the schema reference picks up the new fields. `validateBlock`/`assertBlocksInRegistry` work unchanged (D-14 still enforced). |
| Renderer dispatch | `message-blocks.tsx` `BLOCK_COMPONENTS` | **NONE** to the map. |
| Renderer body | `outlier-grid-block.tsx` `OutlierGridBlockRenderer` | EXTEND — today it renders a *static* `<DiscoverGrid state="results">` with NO remix CTA (it was an in-thread *reference*, see Pitfall 3). For Explore it must accept + pass `onRemix` and `onTrack` callbacks and map `fit`/`trackable` onto tiles. The block's local `OutlierGridBlock` interface (inline in this file, lines 19-25) must widen to include the new fields. |
| Tile data type | `outlier-tile.tsx` `OutlierTileData` | ADD `fit?: { level: FitLevel } | null` + `trackable?` + `trackHandle?`. |
| Tile render | `outlier-tile.tsx` `OutlierTile` | ADD the fit bar (between multiplier badge and metrics grid) + the "+ Track account" button (11-UI-SPEC §Surface 1 read order). |
| Runner build | `explore-runner.ts` | EMIT the new fields (from `rankWithAudienceFit` + `trackable: mode==="profile" || hasHandle`). Validate via `OutlierGridBlockSchema.safeParse`. |

**Honesty hard-bind on the block (carry the existing `outlier-grid` comment forward):** the block STILL carries NO `band`, NO `model: sim1-flash`, NO numeric score for the measured tile. `fit.level` is the ONLY added signal and is explicitly an estimate, not SIM output. (The 11-UI-SPEC §Surface 1 Planner note says exactly this.)

### Pattern 4: Tile → Remix → Read — REUSE the shipped `discover→remix` chain (the de-risk finding)

**What:** D-04's "Remix → Read" is **already built**. The Explore tile's CTA reuses `DiscoverClient.handleRemix` verbatim (`[VERIFIED: codebase]` — `discover-client.tsx` lines 118-141):

```ts
// VERBATIM pattern — Explore tile onRemix (from DiscoverClient):
const handoff = handoffsFor("discover").find((h) => h.to === "remix"); // → endpoint /api/tools/remix/run
await fetch(handoff.endpoint, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url: tile.videoUrl, platform: DEFAULT_PLATFORM }),
});
router.push("/home");  // open thread rehydrates the persisted remix-card
```

**Why this is the whole D-04 answer:**
1. `/api/tools/remix/run` (UNCHANGED) decode→adapts the outlier's `videoUrl` for the active audience and persists a `remix-card` to the open thread.
2. `RemixCardRenderer` (UNCHANGED, `remix-card-block.tsx` lines 153-174) **already mounts `LensTrigger`** with `cardScrollQuoteReactions(fraction, scrollQuote)` + `buildCardRewrite(...)`. → the REAL, honest, non-fabricated persona reaction (D-02) + the Read appear automatically.
3. The remix-card's `band/fraction` describe the **adapted hook** scroll-stop (the remixed version is the creator's content, so it legitimately has a SIM Read) — exactly D-04's "an outlier is not the creator's content, so the Read is on the remixed version."

**Decisions for the planner (small):**
- **Where does the tap land?** From the Explore *thread* the tile already lives in the open thread; the remix-card persists into the same thread. The `router.push("/home")` may be unnecessary if Explore already renders in `/home` — but the open thread must re-fetch to surface the new remix-card (the `DiscoverClient` pushed because it was a *standalone* page; the in-thread Explore can instead trigger a thread reload like `handleDevelopRemix` does in `composer.tsx` lines 384-410). **This is the one genuine wiring choice (see Open Questions Q2).**
- **CTA label is LOCKED** "Remix → Read" (D-05) — `OutlierTile` already uses exactly this string (`outlier-tile.tsx` line 116). No change.

### Pattern 5: Explore owns its idle quick-actions (D-07 / EXPLORE-04)

**What:** `ExploreThreadView` shows idle content (unlike `HooksThreadView`, which returns `null` when idle). Precedent: `ChatThreadView` "always shows when the chat chip is active (owns its own empty state)" (`[VERIFIED: codebase]` — composer.tsx line 185 `showChatView = activeTool === 'chat'` unconditionally; STATE.md decision 05-03).

**The 3 prescribed quick-action cards (11-UI-SPEC §Surface 3, copy LOCKED):**
| Card | Title · sub | Runs | Degrade |
|------|-------------|------|---------|
| 1 | "Top performers in my niche today" · "Fresh outliers, scored for your audience" | niche pull from `audience.name`/niche, time-window=today | always available |
| 2 | "What competitors shipped" · "Recent posts from accounts you track" | pull over tracked accounts | **if no tracked accounts → quiet "Track an account first" disabled sub-state (never an empty/fabricated competitor feed)** |
| 3 | "Surprise me" · "Widen beyond your niche — something unexpected" | preset pull with serendipity=high | always available |

Each card maps to a preset `start(params)` on `use-explore-stream`. The cards derive copy from the active `Audience` (via `getAudience`/the audience list already fetched in `composer.tsx`). On `activeTool === "explore"`, `showExploreView` should be unconditional (mirror chat) so the idle screen shows.

### Pattern 6: Watchlist "Track account" write (D-08 / EXPLORE-05 producer half)

**What:** A new flat-typed `tracked_accounts` table + repo + route, mirroring the `saved_items` idiom exactly (`[VERIFIED: codebase]` — confirmed NO `tracked_accounts`/`watchlist` table exists yet). Producer half ONLY — the tile writes; P12 builds the Library management UI with no rework.

**Migration (mirror `20260619100200_saved_items.sql` RLS idiom):**
```sql
CREATE TABLE IF NOT EXISTS public.tracked_accounts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform    text        NOT NULL DEFAULT 'tiktok' CHECK (platform IN ('tiktok','instagram','youtube')),
  handle      text        NOT NULL,                 -- the @handle the creator tracks (no '@', lowercased)
  source_video_id text,                              -- the outlier tile this was tracked from (provenance)
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform, handle)                 -- idempotent track (no dup rows)
);
ALTER TABLE public.tracked_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tracked_all_own ON public.tracked_accounts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS tracked_accounts_user_idx ON public.tracked_accounts (user_id);
```

**Repo (`src/lib/tracked-accounts/tracked-accounts-repo.ts`) — mirror `shelf-repo.ts`:** `listTrackedAccounts`, `createTrackedAccount` (zod-validated; `user_id` ALWAYS session-derived — CR-01; idempotent via the unique constraint / upsert), `deleteTrackedAccount`. **Route (`src/app/api/tracked-accounts/route.ts`) — mirror `saved/route.ts`:** auth-first → `csrfGuard` → POST writes one row, GET lists (for P12), DELETE removes.

**Tile write:** the "+ Track account" button POSTs `{ platform, handle: deriveHandleFromTile }`. The handle source — outlier tiles carry `platformVideoId`/`videoUrl`/`caption` but **NOT an author handle today** (confirmed: `OutlierTileData` has no `handle` field). The planner must thread the source channel handle through the scrape→block path, OR (simpler for profile-mode pulls) derive it from the pull input. **See Open Questions Q3.**

**Note on the existing migration push pattern:** prior phases applied migrations to live prod in a final BLOCKING wave (e.g. 07-06, 10-07: "live schema push + types regen + engine regression gate"). The planner should sequence the `tracked_accounts` migration the same way (a late wave with `database.types.ts` regen), and may use `(supabase as any)` casts in the interim repo (the `audience-repo`/`shelf-repo` convention).

### Anti-Patterns to Avoid
- **Forking a parallel Remix path for the tap.** REUSE `discover→remix` (Pattern 4). A new `explore→remix` chain entry is pure duplication.
- **Calling the SIM on the grid to fill the fit score.** Hard-banned by D-02/D-03 — the eager signal is re-ranked math; the real reaction is lazy (on tap, via the remix-card's `LensTrigger`).
- **Adding a numeric 0–100 fit score to the tile.** 11-UI-SPEC forbids it (invites "is this the SIM verdict?" confusion). Level word + bar only.
- **Coral on the fit score.** The fit score is DATA, never the action — neutral cream + score-zone tone (green/amber/muted). Coral is reserved for the one CTA "Remix → Read" (one-accent law, CLAUDE.md + 11-UI-SPEC §Color).
- **Duplicating the `outlier-grid` block.** Extend it (Pattern 3).
- **`EventSource` for the stream.** GET-only, can't POST a body — use `fetch`+`getReader` (documented BLOCKER-1).
- **Arming `pendingNavRef`/calling `stream.start` in the Explore submit branch.** That is exclusive to the Test video path; an Explore send must never navigate to `/analyze/[id]` (mirrors the Pitfall-5 guard on every other skill branch in `composer.tsx`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Outlier ranking math | A new outlier scorer | `rankOutliers` (`outlier-compute.ts`) | Recency-decay + median baseline + honest label already built + tested (P8). Wrap it for fit. |
| TikTok scrape + SSRF | A new Apify call | `createScrapingProvider().scrapeVideos` | apidojo actor IDs + SSRF allowlist + remap schemas already vetted (P8/P10). |
| The tap → Read + real reaction | A new remix/SIM/Read flow | The `discover→remix` chain + `remix-card` (+ its `LensTrigger`) | **The entire D-04 chain already exists** (Pattern 4). This is the biggest "don't build" of the phase. |
| Persona reaction UI | A new reaction component | `LensTrigger` + `cardScrollQuoteReactions` + `AudienceLens` | P9 primitive; never fabricates (D-02). Already mounted on the remix-card. |
| Typed-block validation | A custom validator | `validateBlock` / `assertBlocksInRegistry` (D-14) | Double-validation SSOT at write + rehydration. |
| SSE consumer | A new EventSource/reader | Clone `use-hooks-stream.ts` | fetch+getReader frame parsing, mount-guard, abort, stage/content/score handling all solved. |
| Flat watchlist store | A bespoke schema/CMS | New `tracked_accounts` table mirroring `saved_items` RLS idiom + `shelf-repo` pattern | Flat + typed + Library-compatible (D-08). No folders/tags. |
| Daily cap + per-(input,day) cache | A new limiter | `checkUserCap` / `getCachedDiscover` | Already built — **but note its in-memory limitation (Pitfall 5).** |
| Audience-fit provenance copy | Invented "matches your audience" prose | `buildAudienceGroundingLine` | Honest "Because: your {platform} audience — {temp · dispositions}" from stored calibration, never fabricated counts. |

**Key insight:** Phase 11 is an *integration* phase. The new code is (a) one pure math module (`explore-rank.ts`), (b) one SSE route that lifts `/api/discover` logic, (c) one thread view with idle quick-actions, (d) one flat table + repo + route, (e) schema/tile extensions, (f) composer wiring. Everything else is reuse. The temptation to rebuild the reaction/Read/remix flow is the trap — it already ships.

## Common Pitfalls

### Pitfall 1: Explore submit silently navigating to `/analyze/[id]`
**What goes wrong:** Copy-pasting the Test branch into the Explore submit handler arms `pendingNavRef.current = true` / calls `stream.start`, so an Explore send navigates to the video analyze route.
**Why it happens:** `composer.tsx` has a navigate-on-id effect (`[VERIFIED: codebase]` lines 427-438) that is EXCLUSIVE to the Test path.
**How to avoid:** The Explore branch must mirror the hooks/ideas/chat/script/remix branches — call `explore.start(params)` and `return`, NEVER touch `pendingNavRef` or `stream.start` (the comments at lines 442-466 spell this out).
**Warning signs:** clicking a quick-action jumps to `/analyze/...`.

### Pitfall 2: `OutlierGridBlockRenderer` renders a STATIC reference (no Remix/Track CTA)
**What goes wrong:** Reusing the existing renderer as-is gives tiles with NO working "Remix → Read" or "+ Track account" — the in-thread `outlier-grid` block was deliberately a *static record* of a Discover pull, with "No remix CTA wiring here" (`[VERIFIED: codebase]` — `outlier-grid-block.tsx` header comment + line 13).
**Why it happens:** P8 wired the live chain-launch in the *standalone* `DiscoverClient`, not in the in-thread block renderer.
**How to avoid:** EXTEND `OutlierGridBlockRenderer` to accept + pass `onRemix`/`onTrack` (and fit/trackable) through to `DiscoverGrid`/`OutlierTile`. The grid + tile already accept `onRemix`/`remixPendingId` props — wire them. The thread view (`ExploreThreadView`) owns the `onRemix` handler (the `DiscoverClient.handleRemix` pattern, Pattern 4) and the `onTrack` handler.
**Warning signs:** tiles render but the CTA does nothing.

### Pitfall 3: Fabricating a reaction or showing an empty fit bar on General audience
**What goes wrong:** Rendering a fit bar (or a placeholder quote) when no calibrated audience is active violates the hard-binding honesty spine (D-02).
**Why it happens:** Forgetting the degrade gate; trying to "fill" the tile.
**How to avoid:** `rankWithAudienceFit` returns `fit: null` for General/preset/thin (the `hasFitSignal` gate, Pattern 2). The renderer OMITS the bar entirely on `fit == null` (11-UI-SPEC: "Never render an empty/zero bar, never fabricate a level"). The real persona voice appears ONLY on tap, from the remix-card's real SIM (`LensTrigger`).
**Warning signs:** an empty/zero fit bar, or any persona quote on a grid tile.

### Pitfall 4: Breaking the D-14 double-validation by skipping `OutlierGridBlockSchema.safeParse`
**What goes wrong:** Emitting the extended block without runner-side validation → an invalid block silently becomes `UnsupportedBlock` on rehydration (D-14: invalid blocks → sentinel).
**Why it happens:** The new `fit`/`trackable` fields must satisfy the schema exactly; a typo (e.g. `level: "Medium"` instead of `"Fair"`) fails parse.
**How to avoid:** The runner validates via `OutlierGridBlockSchema.safeParse` before returning (belt-and-suspenders, mirrors `hooks-runner` line 480), and the route persists via `insertMessage` which re-validates at the write boundary. Use the exact enum `["Strong","Fair","Weak"]`.
**Warning signs:** tiles render fine in-stream but disappear (become `UnsupportedBlock`) after reload.

### Pitfall 5: The Discover cache + daily cap are in-memory (not durable across serverless instances)
**What goes wrong:** Reusing `getCachedDiscover`/`checkUserCap` assumes a single long-lived process; on Vercel serverless, module-level state (`[VERIFIED: codebase]` — `discover-cache.ts` line 30 "Module-level state (single-instance, in-memory — Open Q2). Not exported.") resets per cold start, so the cache rarely hits and the daily cap is per-instance, not per-user-global.
**Why it happens:** P8 shipped it as in-memory (an accepted Open Q at the time).
**How to avoid:** For P11 this is acceptable to **reuse as-is** (Explore is not yet high-traffic; the cap is a soft guard, not a billing control). Document it as a known limitation. Do NOT silently rely on it for cost control — real rate-limiting is the HARDEN-01 pre-launch gate (the `RATE_LIMIT_*` constants are RESERVED-NOT-WIRED across skill routes). If the planner wants durability, that's a deliberate scope add (Supabase-backed cap) — flag in discuss, don't assume.
**Warning signs:** cache "cached:true" almost never returns; the daily cap doesn't hold across requests.

### Pitfall 6: Bumping `ENGINE_VERSION` or perturbing the SIM-1 Max path
**What goes wrong:** Any change that touches video-scoring bytes forces an `ENGINE_VERSION` bump and risks the regression gate.
**Why it happens:** Misplacing the fit math inside an engine function, or calling the SIM on the grid.
**How to avoid:** The fit re-rank is a NEW pure module at the runner/route layer (like `resolveNicheKey` lives at the runner layer, `[VERIFIED: codebase]` — never inside `selectPersonaSlots`). Explore makes NO video-scoring calls; the only SIM is the existing Flash gate inside the UNCHANGED remix runner. `ENGINE_VERSION` stays `"3.19.0"`. Keep the engine + KC regression suites green; preserve same-video SIM-1 Max score-identity (CONTEXT hard constraint).
**Warning signs:** `version.test.ts` fails; the engine suite reports score drift.

## Code Examples

### The on-tap chain reuse (Explore tile → existing remix chain) — VERIFIED pattern
```ts
// Source: src/app/(app)/discover/discover-client.tsx (handleRemix, lines 120-141) — reuse verbatim.
import { handoffsFor } from "@/lib/tools/chain-handoff";

async function onRemix(tile: OutlierTileData) {
  const handoff = handoffsFor("discover").find((h) => h.to === "remix"); // endpoint: /api/tools/remix/run
  if (!handoff?.endpoint) return;
  setRemixPendingId(tile.platformVideoId);
  await fetch(handoff.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: tile.videoUrl, platform }),  // tile.videoUrl IS the anchor (anchorFrom:"card")
  });
  // remix-card persists to the open thread; surface it (in-thread Explore: reload thread, not router.push).
}
```

### The remix-card already mounts the real P9 reaction (no Explore code needed) — VERIFIED
```tsx
// Source: src/components/thread/remix-card-block.tsx (lines 153-174) — UNCHANGED, runs automatically.
<LensTrigger
  flatPersonas={cardScrollQuoteReactions(fraction, scrollQuote)}  // REAL SIM fraction + lead quote, never fabricated
  conceptText={adaptedHook}
  platform={platform}
  rewrite={buildCardRewrite({ skill: 'remix', fraction, scrollQuote, conceptText: adaptedHook, platform, leverRidesAnchor: true })}
  label="See how the room reacted to this adapted hook"
>
  <blockquote>&ldquo;{scrollQuote}&rdquo;</blockquote>
</LensTrigger>
```

### SSE route skeleton (mirror hooks route) — the shape to clone
```ts
// Source: src/app/api/tools/hooks/route.ts (auth→csrf→audience→stream→persist), adapted for Explore.
export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const guard = csrfGuard(request); if (guard) return guard;
  // parse + cap params (niche/accounts/window/serendipity) — all length-capped server-side
  const openThread = await createOpenThreadLazy(user.id);
  // load active audience from openThread.active_audience_id (NEVER body) via getAudience; fallback GENERAL_AUDIENCE
  // checkUserCap → cache OR scrapeVideos → rankOutliers → rankWithAudienceFit(audience, serendipity)
  // build outlier-grid block { tiles: [...+fit,+trackable], mode }; OutlierGridBlockSchema.safeParse
  // SSE: send("stage", {name:"Pulling outliers", status:"active"}) ... send("content",{blocks}) ... send("done")
  // insertMessage(openThread.id, "assistant", [block], kcStamp().kcGenVersion)
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Discover as a standalone page (`/discover`) | Discovery as an in-thread skill (`/explore`) | P11 (this phase) | The standalone `discover-client.tsx` is the *reference*, not the delivery surface; its logic is lifted into the skill route. |
| Outlier tile shows only measured multiplier (P8) | Tile also shows an audience-relative fit estimate (predicted) | P11 | EXPLORE-03; the positioning moat tell ("your audience, predicted" vs competitors' "9.2M views, someone else"). |
| Saved shelf is the only flat-typed State store (P10) | + a flat-typed `tracked_accounts` watchlist | P11 producer / P12 consumer | The track→explore loop goes live immediately; P12 surfaces it. |

**Deprecated/outdated for this phase:**
- The `sandcastles-adopt-improve.md` "Living Research Feed = analyze-grid + idea-inbox + hook-vault + collections" rescope is **SUPERSEDED** (CONTEXT canonical_refs note): collections/library → P12; Explore stays the discovery→score→reaction→Remix→Read spine. Do not plan a feed/inbox/vault.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A dedicated `tracked_accounts` table (vs overloading `saved_items`) is the right shape for D-08 | §Pattern 6 / Open Q1 | Low — both are flat+typed+Library-compatible; if the planner prefers `saved_items` overload, the repo/route shape is near-identical. The CONTEXT D-08 + the `saved_items` migration comment ("P12 EXTENDS with separate tables") favor a separate table, but it's a discuss-confirmable call. |
| A2 | The fit-score formula constants (thresholds 0.66/0.4, blend α=0.5, serendipity as a niche-weight) are reasonable defaults | §Pattern 2 | Low — these are tunable; the *structure* (honest re-rank, degrade gate, level-word output) is the load-bearing part and is locked by D-01/D-02. Constants tune in UAT like the Flash thresholds did. |
| A3 | Reusing the in-memory Discover cache/cap as-is is acceptable for P11 | §Pitfall 5 | Medium — if Explore drives real traffic before HARDEN-01, the cap won't hold globally. Mitigation: it's a soft guard, not billing; flag durability as a deliberate scope decision in discuss rather than assume it. |
| A4 | The author handle for "+ Track account" can be threaded from the scrape (profile mode) or pull input | §Pattern 6 / Open Q3 | Medium — `OutlierTileData` has no `handle` field today; if neither the scrape remap nor the pull input yields a handle for niche-mode tiles, the Track button may need to be profile-mode-only in P11 (still satisfies the producer half). |

## Open Questions

1. **Watchlist store: new `tracked_accounts` table vs `saved_items` overload?**
   - What we know: No watchlist table exists; D-08 demands flat + typed + Library-compatible; the `saved_items` migration comment says P12 extends with *separate* tables.
   - What's unclear: whether the owner wants a distinct table (recommended) or to reuse `saved_items` with `item_type:'outlier'`/a new type.
   - Recommendation: **new `tracked_accounts` table** (Pattern 6). It cleanly separates "saved block snapshot" from "tracked input handle." Confirm in discuss; either way the repo/route shape is the `shelf-repo` idiom.

2. **In-thread Explore: how does the remix-card surface after the tap?**
   - What we know: `DiscoverClient` did `router.push("/home")` because it was a standalone page; `composer.tsx handleDevelopRemix` instead reloads the open thread in place (`GET /api/threads/open` → filter blocks).
   - What's unclear: whether the Explore tile sits in `/home` already (then just reload the thread) or needs navigation.
   - Recommendation: since Explore IS an in-thread skill rendered in the composer (`/home`), reuse the **in-place thread-reload** pattern (`handleDevelopRemix` lines 384-410) rather than `router.push`. The remix-card persists to the same open thread; refetch surfaces it. Minor wiring choice, not a blocker.

3. **"+ Track account" handle source for niche-mode tiles.**
   - What we know: tiles carry `platformVideoId`/`videoUrl`/`caption` but no author handle (`OutlierTileData`). The apidojo video remap (`remapApidojoVideo`) does not populate an author handle onto `VideoData`.
   - What's unclear: whether the apidojo video item carries an author/channel field that can be remapped onto the tile (check the live actor output / `apidojoVideoSchema`), or whether Track is profile-mode-only in P11.
   - Recommendation: prefer threading the source channel handle through `VideoData` → tile (if the actor returns it). If not available for niche-mode, ship Track for profile-mode pulls in P11 (still satisfies the producer half) and note niche-mode Track as a P12/follow-up. A Wave-0 spike on the apidojo author field resolves this.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `APIFY_TOKEN` (env) | apidojo scrape in `/api/tools/explore` | ✓ (used by P8/P10 in prod) | — | none — Explore can't pull without it (same posture as `/api/discover`). |
| apidojo actors (`apidojo/tiktok-scraper`, profile-scraper) | outlier pull | ✓ (live, P8) | — | none. |
| Supabase (auth, `threads`, `messages`, new `tracked_accounts`) | persistence | ✓ | — | none — core platform. |
| Qwen/DashScope (`DASHSCOPE_API_KEY`) | only via the UNCHANGED remix runner's Flash gate (on tap) | ✓ in prod | — | the grid itself makes NO SIM call (D-02/D-03), so a missing key degrades only the on-tap reaction, not the grid. |

**Missing dependencies with no fallback:** none new — all are already provisioned for the shipped P8/P9/P10 features Explore reuses.
**Missing dependencies with fallback:** the on-tap SIM (remix runner) degrades to the existing `SkillRunError` "nothing was charged" surface if Qwen is unavailable; the grid still renders (measured + fit).

## Sources

### Primary (HIGH confidence — read this session, `[VERIFIED: codebase]`)
- `src/lib/discover/outlier-compute.ts` — `rankOutliers` signature, `WINDOW_DAYS=90`, `HALF_LIFE_DAYS=30`, median baseline, multiplier, baselineLabel, rankKey, tiebreaks.
- `src/lib/tools/blocks.ts` — `OutlierGridBlockSchema` + the `predictedFailureMode` nullable-optional precedent + `BlockUnionSchema`.
- `src/lib/tools/block-registry.ts` — `validateBlock` / `assertBlocksInRegistry` / `BLOCK_REGISTRY` (D-14).
- `src/components/thread/message-blocks.tsx` — `BLOCK_COMPONENTS` dispatch + per-block re-validation (D-14).
- `src/lib/tools/chain-handoff.ts` — `CHAIN_HANDOFFS` (`discover→remix` live, endpoint `/api/tools/remix/run`) + `handoffsFor`.
- `src/app/api/tools/hooks/route.ts` + `src/lib/tools/runners/hooks-runner.ts` — the canonical SSE route + runner contract (auth, csrf, audience load, stage/content/score, persist, KC stamp, D-14 safeParse).
- `src/hooks/queries/use-hooks-stream.ts` — fetch+getReader SSE consumer (NOT EventSource).
- `src/components/thread/hooks-thread-view.tsx` + `chat-thread-view.tsx` (idle ownership precedent).
- `src/components/app/home/composer.tsx` + `composer-controls.tsx` — the dispatch hub, `SKILLS` (explore stubbed `enabled:false`), `ToolId` union, per-skill submit branches, `handleDevelopRemix` thread-reload pattern, navigate-on-id guard.
- `src/app/api/discover/route.ts` + `src/app/(app)/discover/discover-client.tsx` — the pull/rank logic to lift + the verbatim `handleRemix` chain-launch.
- `src/lib/scraping/apify-provider.ts` (apidojo actors + SSRF allowlists) + `src/lib/scraping/types.ts` (`VideoData` incl. `hashtags`).
- `src/components/discover/discover-grid.tsx` + `outlier-tile.tsx` — grid states + tile (already accepts `onRemix`/`remixPendingId`), the fit-bar/track extension surface.
- `src/components/thread/outlier-grid-block.tsx` — the STATIC in-thread renderer (Pitfall 2).
- `src/components/audience-lens/AudienceLens.tsx` + `flat-card-reactions.ts` + `LensTrigger` + `src/components/thread/remix-card-block.tsx` — the P9 reaction primitive ALREADY mounted on the remix-card (the D-04 de-risk).
- `src/lib/audience/audience-repo.ts` + `audience-types.ts` + `audience-grounding.ts` — `getAudience`/`GENERAL_AUDIENCE`, the `Audience`/`CalibratedPersona` fields (temperature/disposition/share, goal_intent, calibration.thin), honest grounding line.
- `src/lib/shelf/shelf-repo.ts` + `supabase/migrations/20260619100200_saved_items.sql` + `src/app/api/saved/route.ts` — the flat-typed repo/route/RLS idiom for `tracked_accounts`.
- `src/lib/discover/discover-cache.ts` — in-memory cache + `DISCOVER_DAILY_CAP=20` (Pitfall 5).
- `src/lib/engine/wave3/niche-resolver.ts` — runner-layer-no-ENGINE_VERSION-bump precedent; `src/lib/engine/version.ts` (`ENGINE_VERSION="3.19.0"`).
- `src/app/api/tools/remix/run/route.ts` — the UNCHANGED tap endpoint (`{ url, platform }`).
- `.planning/phases/11-.../11-CONTEXT.md`, `11-UI-SPEC.md`; `.planning/REQUIREMENTS.md`; `.planning/ROADMAP.md`; `.planning/STATE.md`; `.planning/config.json`.

### Secondary (MEDIUM confidence)
- `.planning/research/sandcastles-adopt-improve.md` / `sandcastles-structural-insights.md` — competitor positioning contrast (note the SUPERSEDED feed rescope flagged in CONTEXT).

### Tertiary (LOW confidence)
- none — every load-bearing claim is verified in-codebase.

## Metadata

**Confidence breakdown:**
- Skill-chain wiring (Pattern 1): HIGH — every layer cited to a read exemplar file.
- Fit-score formula (Pattern 2): HIGH on structure/honesty constraints (locked by D-01/D-02 + verified inputs); MEDIUM on exact constants (tunable, A2).
- Block extension (Pattern 3): HIGH — `predictedFailureMode` is an exact in-repo precedent.
- Tap→Remix→Read reuse (Pattern 4): HIGH — the remix-card mounting `LensTrigger` is verified verbatim.
- Watchlist (Pattern 6): HIGH on the idiom (mirrors `saved_items`); MEDIUM on the handle source (A4/Q3) and table-vs-overload (A1/Q1).
- Pitfalls: HIGH — all six cite verified code (in-memory cache, static renderer, nav guard, D-14, ENGINE_VERSION).

**Research date:** 2026-06-20
**Valid until:** ~2026-07-20 (stable — internal codebase, no fast-moving external deps). Re-verify only if the skill-chain, `CHAIN_HANDOFFS`, or `Audience` shape changes before planning.
