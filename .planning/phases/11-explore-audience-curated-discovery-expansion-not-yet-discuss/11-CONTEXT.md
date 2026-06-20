# Phase 11: Explore (Audience-Curated Discovery) - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn one-shot Discover into the daily-habit **entry door** — delivered as an **in-thread skill, NOT a feed/dashboard surface**. The "separate Feed surface" tension dissolves because Numen has the SIM: the *audience* curates. Explore = audience-curated outlier/competitor discovery, where every result tile carries an honest audience-fit score, taps into the SIM moat chain (Remix → Read), and feeds a watchlist input State.

**Positioning spine:** "They tell you it popped; we tell you if it lands for *your* people." Competitors model the CREATOR + borrow proof from outliers; they NEVER model the audience and NEVER validate output. Explore surfaces both layers they structurally lack.

**In scope (P11):**
- Explore as a composer skill (`/explore`) following the canonical in-thread chain
- Audience-relative outlier scoring on the result grid (EXPLORE-03)
- Ambient audience-fit signal per tile + on-tap real reaction (EXPLORE-02)
- Tile → Remix → Read moat chain (EXPLORE-02)
- Audience-derived start-screen quick-actions + params sheet incl. serendipity valve (EXPLORE-04, EXPLORE-01)
- Minimal "Track account" write → watchlist input State, Library-compatible (EXPLORE-05, producer half)

**Out of scope (→ other phases):**
- Library / watchlist management UI, 4-item IA collapse (→ P12)
- Ambient reaction on *every* skill card, proactive morning drops, scheduled Explore (→ P13)
- Comment-seeding (EXPLORE-06 — deferred again, see Deferred Ideas)
- Any export / "Export for LLM" affordance (don't bleed the closed loop)

</domain>

<decisions>
## Implementation Decisions

### Audience-Relative Scoring + Ambient Reaction (EXPLORE-02, EXPLORE-03)
- **D-01:** **Eager honest audience-fit score per tile; real SIM reaction on tap.** The result grid annotates each tile with an audience-relative score — re-rank/weight P8's measured outlier multiplier against the **active audience's niche + calibration** (a "vs YOUR audience" baseline, same legitimate math family as `rankOutliers`' "vs niche" baseline). This is the eager, cheap, always-present layer.
- **D-02:** **Honesty spine is hard-binding — no fabricated reactions on the grid.** The eager per-tile signal is an honest *fit score/indicator* (re-ranked math), **NOT** a fabricated persona quote/verdict. The real persona reaction (quotes + stop/scroll verdict) is produced by the **P9 reaction primitive only on tap**, from real SIM output. Never synthesize a quote to fill a tile. Degrade gracefully (show the measured multiplier + fit score) when no audience signal is available.
- **D-03:** **Rejected eager full-SIM-per-tile** (cost/latency-prohibitive on a daily-habit surface, ~20–30 tiles/pull) and **rejected measured-only grid** (hides the audience moat behind every tap, under-delivers EXPLORE-02/03). The split — cheap honest score eager, expensive real reaction lazy — is the deliberate cost/moat balance.

### Tile → Read Mechanism (EXPLORE-02)
- **D-04:** **Remix-then-Read.** Tapping a result tile generates the creator's **own version** of the outlier for their audience (Remix), SIM-tests *that*, and lands on a Read (would your audience bite + why). Rationale: an outlier is **not the creator's content**, so it has no SIM "Read" of its own — the measured multiplier is all that can be shown without remixing; "lands on a Read" therefore *implies* the remixed version. Matches the literal EXPLORE-02 tile CTA ("Remix → Read"), completes the moat chain (borrow proof → make yours → validate), and the eager fit score (D-01) already covers the cheap glance, so the tap is the committed, valuable action (no redundant cheap diagnostic).
- **D-05:** **CTA wording LOCKED: "Remix → Read"** — never "rewrite for me" / "rewrite this" (carried from P8). Reuse the already-registered `discover→remix` chain handoff + `remix-card` block rather than building a parallel path.

### Start-Screen Set-Actions + Params (EXPLORE-04, EXPLORE-01)
- **D-06:** **Audience-derived quick-actions + params sheet incl. serendipity valve.** Explore's idle/empty state shows 2–4 **audience-aware** quick-action cards derived from the active audience (e.g. "Top performers in my niche today", "What competitors shipped", "Surprise me"), each running a preset pull. A params sheet refines: niche/keywords, accounts, time-window, and a **serendipity slider** (widen-beyond-niche valve). This is the only option satisfying BOTH EXPLORE-04 ("audience-aware quick-actions") and EXPLORE-01 ("customizable params = audience-on-tap + serendipity valve") — both named in scope.
- **D-07:** **Explore's thread view owns its own idle/empty state** (no generic start-screen primitive exists; `ChatThreadView` sets the precedent of a skill owning its empty state + nudge). Quick-actions live there, not as a global home affordance.

### Watchlist Input + Scope Boundary (EXPLORE-05, EXPLORE-06)
- **D-08:** **P11 ships the minimal "Track this account" WRITE** on result tiles — persists a watchlist row that is **flat + typed + Library-compatible** (P10 D-07 deliberately built the Saved shelf this way). P11 *produces* the watchlist input so the track→explore loop is live immediately; **P12 builds the management/Library UI with no rework**. Rejected consume-only (would leave the watchlist empty/dormant until P12).
- **D-09:** **Comment-seeding (EXPLORE-06) DEFERRED again.** Off the core discovery→score→reaction→Remix→Read spine, adds a net-new apidojo comment-scrape + seeding path, and was already deferred once (P8 D-04). Keep the flagship phase focused.

### Claude's Discretion
- Exact eager fit-score formula (niche-match + calibration weighting of the measured multiplier) — researcher/planner to design; must stay honest (no fabricated reaction) and reuse `rankOutliers` arithmetic where possible.
- Visual encoding of the fit score on the tile (dots / bar / label) — UI-phase decision; keep flat-warm + the fixed typed-renderer library.
- New typed block(s) for Explore results vs reuse of the existing `outlier-grid` block (extend it with the audience-fit field, or add an `explore-grid` variant) — planner decides; prefer extend-not-duplicate.
- Quick-action copy + count (2–4) and which audience fields drive them.
- Whether the params sheet is a popover/sheet vs inline — UI-phase.

### Folded Todos
None — no pending todos matched this phase's scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase definition + strategy
- `.planning/ROADMAP.md` §"Phase 11: Explore (Audience-Curated Discovery)" — goal, requirements EXPLORE-01..06, depends-on, moat verdict
- `.planning/NEXT-MILESTONE-VISION.md` — v6.0 expansion brief; Explore = skill-in-thread (NOT feed) framing, depends on P8 Discover + P7 Audience
- `.planning/research/sandcastles-adopt-improve.md` — §PROPOSED PHASE STRUCTURE (P11 authoritative shape), §"audience-curated discovery = Explore skill in-thread", quick-actions list, watchlist/Channels adopt→improve, positioning contrast (their "9.2M views (someone else)" vs Numen "pull-score N (your audience)"). **NOTE:** the doc's older "Living Research Feed = analyze-grid + idea-inbox + hook-vault + collections" rescope (line ~91) is **SUPERSEDED** — collections/library → P12; Explore stays the discovery→reaction→Read spine.
- `.planning/research/sandcastles-structural-insights.md` — competitor teardown: analyze-grid filters/badges (outlier-score 0–100x / views / eng%), video-detail deconstruction tabs, Channels watchlist builder (4 search modes), SKIP Export-for-LLM

### Competitor UI screenshot references (for UI-phase)
- `~/Downloads/Sandcastles.ai Screenshots/` (18 PNGs) — reviewed in discussion. Key frames:
  - Hook vault list — borrowed-proof badge pattern per row (multiplier `5.3x` + view-count `114K` + category tag + "Inspired by @handle"). **Numen improvement:** replace borrowed views with **audience-fit score (your audience, predicted)**.
  - Video-detail deconstruction + full left-nav IA + **"How to Personalize this Video for Your Content Niche → Option 1 / Option 2"** — the personalize-angle pattern that, in Numen, **lands on a Read** (D-04).
  - Format/hook ontology galleries — taxonomy browse (not P11's per-video outlier grid; reference only).
  - "New script" wizard (Topic→Research→Hook→Script) — their creation flow (reference, not adopted).
- `.planning/reference/societies-landing.png/`, `.planning/reference/societies-landing-dark.png/` — Augmented Society (the flat format-picker competitor that **shut down**) landing visuals; cautionary positioning reference

### Prior-phase context (decisions that bind P11)
- `.planning/phases/08-discover-remix-read-the-competitor-niche-moat-chain-draft-no/08-CONTEXT.md` — Discover/Remix/Read chain; "Remix → Read" CTA lock; outlier-score = measured, not a SIM score
- `.planning/phases/09-living-audience-interactive-simulation-ux-draft-not-yet-disc/09-CONTEXT.md` — reaction primitive (flat persona reactions, AudienceLens), honesty spine
- `.planning/phases/10-account-read-saved-shelf-recalibration-flywheel-draft-not-ye/10-CONTEXT.md` — Saved shelf D-07 (flat + typed + Library-compatible → P12 extends, no rework)
- `.planning/phases/07-audience-manager-calibrated-audience-as-shared-substrate-acr/07-CONTEXT.md` — Audience object, active-audience loading

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/lib/discover/outlier-compute.ts` (`rankOutliers`)** — WINDOW_DAYS=90, HALF_LIFE_DAYS=30, median baseline, multiplier = views/baseline, "vs own"/"vs niche" labels. **Base for the D-01 audience-relative re-rank** (add audience niche+calibration weighting; keep it honest math, not a SIM score).
- **`src/lib/scraping/apify-provider.ts`** — apidojo/tiktok-scraper actor (profile + video search) with SSRF allowlist. Reuse for Explore pulls.
- **`src/app/api/discover/route.ts`** — POST /api/discover: input classification (profile vs niche), daily cap, cache+scrape, rank. Reference for the new `/api/tools/explore` route's scrape/rank half.
- **`src/components/discover/discover-grid.tsx` (`DiscoverGrid`)** — responsive grid, 4 states; already audience-honest (multiplier + baseline label). Reuse/extend for the in-thread result grid.
- **`src/components/thread/outlier-grid-block.tsx` + `src/lib/tools/blocks.ts` (`OutlierGridBlockSchema`)** — existing in-thread `outlier-grid` typed block (tiles/mode/source; no band/score — measured only). **Extend with an audience-fit field OR add an `explore-grid` variant** (planner; prefer extend).
- **`src/components/audience-lens/flat-card-reactions.ts` (`cardScrollQuoteReactions`)** + **`src/components/audience-lens/AudienceLens.tsx`** — P9 reaction primitive; derives flat personas from REAL SIM fraction + scrollQuote, anchors real quote to lead persona, **never fabricates**. Use for the on-tap reaction (D-02).
- **`src/lib/audience/audience-repo.ts` (`getAudience`, `GENERAL_AUDIENCE`)** — load active audience from `openThread.active_audience_id`, General default. Drives D-01 scoring + D-06 quick-actions.
- **chain-handoff registry (`CHAIN_HANDOFFS`)** — `discover→remix` already registered (08-03). Reuse for D-04 Remix-then-Read; `remix-card` block exists.

### Established Patterns
- **Canonical in-thread skill chain (P4 Hooks exemplar):** composer skill pill (`SKILLS` array in `src/components/app/home/composer-controls.tsx` — `explore` already stubbed, `enabled: false`) → `POST /api/tools/{skill}/route.ts` (auth → `getAudience` → runner → SSE stream stage/status/content/score/followup → persist blocks + KC_GEN_VERSION to openThread) → runner in `src/lib/tools/runners/` → typed block (`src/lib/tools/blocks.ts` + `block-registry.ts`) → thread view (`*-thread-view.tsx`) → `src/components/thread/message-blocks.tsx` (`BLOCK_COMPONENTS` dispatch, `validateBlock` double-validation, D-14). **Explore follows this exactly:** `/api/tools/explore/route.ts`, `explore-runner.ts`, `use-explore-stream`, `ExploreThreadView`, enable the `explore` skill pill.
- **Empty-state ownership:** `src/components/thread/chat-thread-view.tsx` owns its own empty state + cold-start nudge → precedent for D-07 (Explore owns its idle quick-actions).
- **UI SSOT:** flat-warm fixed typed-renderer library; NOT model-generated UI, NOT plain text.

### Integration Points
- Discover is currently a **standalone page** (`src/app/(app)/discover/discover-client.tsx`) — P11 must lift its pull/rank logic into the in-thread skill route; the standalone page is the reference, not the delivery surface.
- Watchlist write (D-08) connects to the P10 Saved-shelf persistence model (flat/typed) so P12 Library can surface it.
- Engine: text/UI-path work — **keep the engine + KC regression suites green; preserve same-video SIM-1 Max score-identity; no `ENGINE_VERSION` bump** (Explore reuses scoring, doesn't change video-scoring bytes).

</code_context>

<specifics>
## Specific Ideas

- **Positioning UI contrast (the concrete moat tell):** their card = "9.2M views (someone else, past)"; Numen tile = **measured multiplier + audience-fit score (your audience, predicted)**. Make this contrast legible on every tile.
- **"Personalize for your niche → Option 1 / Option 2"** (Sandcastles video-detail) is the pattern for the Remix step — but in Numen the personalize-angle **lands on a Read** (SIM-validated), which they never attach.
- **Quick-action seeds** (from research): "Top performers in my niche today", "What are my competitors shipping" (Explore over watchlist), plus a serendipity "Surprise me".
- **Honesty over flash:** the eager per-tile signal must read as an honest estimate, never a fake persona voice. Real voices appear only on tap, from real SIM.

</specifics>

<deferred>
## Deferred Ideas

- **Comment-seeding (EXPLORE-06)** — pull top comments on outliers to seed reactions/idea angles. Deferred again (D-09); off the core spine, twice-deferred. → a later phase.
- **Library / watchlist management UI + 4-item IA collapse** — Explore only *produces* the watchlist row (D-08). All surfacing/management → **P12 (Library & Acts/State IA)**.
- **Ambient reaction on every skill card, proactive morning drops, scheduled Explore (Automations equivalent)** → **P13 (Proactive Numen)** — builds on P9's primitive, must not duplicate.
- **Idea-inbox / hook-vault / collections "on the outlier spine"** (the superseded older Living-Research-Feed rescope) — NOT P11; these are other skills / P12 Library. Explore stays the discovery→score→reaction→Remix→Read spine.
- **Export / "Export for LLM"** — explicitly SKIP (don't bleed the closed loop).

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 11-explore-audience-curated-discovery*
*Context gathered: 2026-06-20*
