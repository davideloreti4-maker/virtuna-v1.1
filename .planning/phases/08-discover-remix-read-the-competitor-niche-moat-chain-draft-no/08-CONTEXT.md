# Phase 8: Discover & Remix→Read — the competitor/niche moat chain - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Open a new funnel-top front door that competitors (Blort, Sandcastles) stop short of. **Discover** real outliers (a creator/competitor profile *and* a niche/keyword, via Apify, ranked by an **outlier-score** — over-performance vs a baseline — plus value metrics) → **audience-steered Remix** (deconstruct hook/structure, regenerate the concept *for the active calibrated audience*) → **multi-audience concept Read** on the regenerated text **before any filming**. The category is foresight: find out it lands before you shoot.

This phase deliberately absorbs two pieces of moat-critical debt that make the difference between "wired" and "real": it **tunes the persona bias values** (so the audience reactions are signal, not placeholders) and **closes the steer-everywhere debt** (so every skill generates *for the active audience*, not a generic profile).

**In scope:** Discover outlier grid (Apify + outlier-score), audience-steered Remix, single-audience concept Read, multi-audience compare Read, verbatim quote panel, who-it's-NOT-for inverse Read, persona-value tuning (wave 0), full steer-everywhere closure.

**Out of scope (→ other phases / backlog):** comment seeding, own-channel deep "what to improve" report (= P10 Account Read), saved shelf / watchlists (P10), pre-warmed niche feeds (P10), the live interactive persona cloud (P9 AudienceLens), N>2 audience compare, real social OAuth.

</domain>

<decisions>
## Implementation Decisions

### Scope & wave sequencing
- **D-01:** Build in waves, thin chain first, panels last — **W0:** tune persona bias values · **W1:** Discover grid + outlier-score + new Apify actor · **W2:** audience-steered Remix + close ALL-runner steer debt · **W3:** single-audience concept Read landing · **W4:** multi-audience compare + verbatim panel + who-it's-NOT-for. De-risks the all-new Apify/outlier/grid build before the killer feature; persona-tuning gates only W4 (and anything that reads persona values).
- **D-02:** **Persona bias values are tuned as W0, a hard prerequisite** (closes debt #2). The multi-audience compare shows two persona sets side-by-side — with `[ASSUMED]` placeholder values it would render noise as signal. Tuning also unblocks read-only personas in the UI and the no-coral-cluster weak-signal fallback. The "wins for growth, bombs for buyers" claim is only a moat if the numbers are real.
- **D-04:** **Comment seeding is DEFERRED** out of P8 (lowest value, net-new generation). **Keep** who-it's-NOT-for + verbatim quote panel (cheap, data already exists).

### Steer-everywhere debt (#1) — closed in P8
- **D-03:** **Close ALL remaining steer in P8**, not just remix+script. P7 wired the calibrated Audience into the react/SIM path everywhere, but position-① *steer* is proven in the ideas-runner ONLY — hook / test / remix / chat still ground generation on the generic creator profile (= half-moat: predict-for-audience, generate-for-generic on 5 of 6 skills). Replicate the 07-04 extension shape across the hook + test runners + the separate chat-runner (it's replication across runners, not new design). **Constraint:** General audience = DEFAULT no-op must be preserved so the engine regression gate stays green (ENGINE_VERSION unchanged unless a deliberate scoring change is made).

### Outlier-score compute (all-new — no prior art)
- **D-05:** **Hybrid baseline.** Profile input ranks each video vs THAT channel's trailing median (true Sandcastles-style "12x" over-performance). Niche/keyword input ranks vs the result-set median (no per-author scrape = bounded cost), **labeled honestly** as "vs niche," not "vs own channel." Matches the dual input + Apify cost reality.
- **D-06:** **Rank = outlier-multiplier primary + save-rate/share-rate value tiebreak** (saves/views, shares/views). Surfaces *replicable, actionable* formats over pure view-spikes. All fields returned by the scraper. Legible: "why #1" = highest over-performance.
- **D-07:** **Trailing ~90d window, recency-decayed.** Surfaces *current* opportunities; decays older spikes so a 2-year-old viral can't dominate. Window is a constant.

### Multi-audience Read (W4 — the pulled-forward "killer feature")
- **D-08:** **Verdict line + interpretation + lever + drill.** Top: per-audience aggregate verdict ("Growth: Strong 8/10 · Buyers: Weak 3/10") with the DELTA as the one-line Read + lever ("wins for growth, bombs for buyers — hook indexes on novelty, buyers want proof"). Below: expandable per-audience persona panels. Aligns with the locked P9 AudienceLens "interpret + lever" spine — but **P8 ships a static side-by-side Read card, NOT the live interactive cloud** (P9 owns that; do not redesign it here).
- **D-09:** **Pick 2 audiences explicitly** (cap at 2 for v1 legibility; object stays `audience_ids[]`-ready for N later). **Default pair = active calibrated audience vs General** — doubles as proof that calibration changes the verdict.
- **D-10:** **Who-it's-NOT-for derives from low-disposition personas** — name the segment that scrolls/bounces straight from per-persona verdicts already emitted (no extra model call → no fabrication risk). Falls out naturally in a 2-audience compare; also shown on single-audience Read.
- **D-11:** **Verbatim = focus-group quote wall**, grouped by stop/scroll verdict, each tagged with its audience, sharpest pulled as a lead. Pure presentation over already-emitted `scrollQuote` + `segment_reactions`.

### Discover front door
- **D-12:** **Apify provider = apidojo, SPLIT into two actors** (clockworks removed — broken). `apidojo/tiktok-scraper` (all-in-one, keyword/hashtag search + profile videos, 600/sec) = Discover search + competitor outlier pull. `apidojo/tiktok-profile-scraper` (full-history pagination, follower/following, bio, 40+ fields, 425/sec) = P7 personal-audience calibration + own-channel full history. Both $0.30/1k posts, 98% success. Each optimized for its job. **Keep the existing provider interface (`scrapeProfile`/`scrapeVideos`) + SSRF allowlist** — only the actor slugs swap. (Note: `tiktok-scraper` forbids single-post URLs / min 10 per query — irrelevant, Remix decodes via the rehosted mp4, not an Apify scrape.)
- **D-13:** **Discover = its own browsable grid view; tile CTA "Remix → Read" drops into the thread chain.** Browsable grid surface, chain-coupled action. No saving / watchlist (that's P10).
- **D-14:** **One entry, two modes** — paste @handle/URL → profile mode (own-channel baseline) OR type niche/keyword → niche mode (niche-median baseline). One grid, tiles tagged by source. Mirrors the D-05 hybrid baseline.
- **D-15:** **Profile mode further tags own vs competitor.** Both own + competitor run the same outlier grid in P8 — **own-channel surfaces YOUR over-performers to remix-your-own-winner** (a real P8 use). The deep self-optimize "what to improve / standing report" stays **P10 Account Read** (don't build it twice).
- **D-16:** **On-demand pull, ~20-30 tiles, cached per (input, day)** so re-opening doesn't re-scrape. Add a simple per-user cap (folds toward closing rate-limit debt #10). Balances cost, latency, freshness.

### Claude's Discretion
- Exact outlier-multiplier decay curve, niche-median computation details, and tile-count tuning — within D-05/D-06/D-07 envelope.
- Provisional requirement IDs (DISC-*, REMIX-*, READ-*, plus AUD steer extensions) to be formalized by planner against REQUIREMENTS.md.
- Pre-W0 hygiene check: confirm the P7 `audience-regression-gate.test.ts` is committed (debt #8) before relying on it as the W2 steer-closure gate.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase planning & requirements
- `.planning/ROADMAP.md` — Phase 8 draft scope (lines ~263-281) + the P7 audience-substrate it depends on.
- `.planning/REQUIREMENTS.md` — AUD-01..08 (audience object + steer) to extend; DISC-*/REMIX-*/READ-* to formalize.
- `.planning/phases/07-audience-manager-calibrated-audience-as-shared-substrate-acr/07-CONTEXT.md` — the audience object + 07-04's steer-extension shape (the pattern D-03 replicates).

### Design direction (do not redesign)
- `.planning/sketches/005-audience-scale/index.html` — LOCKED P9 AudienceLens. P8's multi-audience Read (D-08) follows its "interpret + lever" spine but ships a static card only; the live cloud is P9.

### Memory (project decisions)
- `phase8-discover-remix-roadmap.md` — competitor audit (Blort/Sandcastles), outlier-score mechanic, P8 locked draft.
- `phase9-audiencelens-ux.md` — the locked AudienceLens spine P8 must not pre-empt.
- `audience-manager-phase7.md` — Temperature×Disposition persona lens, goal→bias table, steer/react/refine loop.
- `numen-brand-spine.md` — foresight-not-generation, anti-slop, the Read as the moat.

### Code (reuse-first — scout before building)
- `src/lib/tools/runners/remix-runner.ts` — resolve→decode→adapt→Flash-gate; extend to steer on active audience (D-03).
- `src/lib/audience/audience-types.ts` + `resolve-audience-weights.ts` — Audience object + array-shaped resolver (already `audience_ids[]`-ready for D-09).
- `src/lib/scraping/apify-provider.ts` — `scrapeProfile`/`scrapeVideos` + SSRF allowlist; swap actor slugs to apidojo (D-12).
- `src/lib/engine/flash/flash-schema.ts` — FlashPersona (archetype/verdict/quote) + `aggregateFlash`; source of verbatims (D-10/D-11).
- `src/lib/tools/chain-handoff.ts` — CHAIN_HANDOFFS registry; add discover→remix→read entries (D-13).
- `src/lib/tools/blocks.ts` + `src/components/thread/message-blocks.tsx` — typed-block schemas + dispatcher; new outlier-grid + multi-audience-Read blocks.
- `src/components/competitors/detail/video-card.tsx` — metrics-grid card to reuse for outlier tiles.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **remix-runner.ts** — the full resolve→decode→adapt→Flash pipeline already exists; P8 extends it to take `audiences: Audience[]` → `resolveAudienceWeights()` into the Flash panel (currently uses `profileRow.niche_primary` only).
- **Audience object + resolver** — `resolveAudienceWeights(audiences[])` is array-shaped; multi-audience compare (D-09) needs UI + a second resolve, not a new object.
- **apify-provider.ts** — provider interface + SSRF allowlist stay; only actor slugs change (D-12).
- **FlashPersona data** — archetype/verdict/quote already emitted per persona → who-it's-NOT-for (D-10) + verbatim wall (D-11) are presentation, not new generation.
- **VideoCard + typed-block renderers** — outlier tiles + Read cards extend existing components.

### Established Patterns
- **Tool-runner contract** (`{promptTemplate, knowledgeBundle, outputSchema, renderer}`) + CHAIN_HANDOFFS — Discover/Remix register as runner+card+CTA with no one-off wiring.
- **Content-first, scores-stream + self-judge gate + honest "directional" labeling** — apply to Discover/Remix outputs.
- **General = DEFAULT no-op** — the steer closure (D-03) must preserve this so the engine regression gate stays green.

### Integration Points
- New Apify Discover layer → `apify-provider.ts` (apidojo actors).
- Outlier-score compute → new module consuming scraped video metrics.
- Steer closure → hook/test runners + chat-runner (replicate 07-04 ideas-runner shape).
- Multi-audience Read → new typed block + the existing thread/AudienceLens-adjacent render path.

</code_context>

<specifics>
## Specific Ideas

- Outlier mechanic explicitly modeled on Sandcastles' "12x over-performance vs own baseline," but hybridized for niche search (D-05).
- Multi-audience headline framing the owner wants: "wins for growth, bombs for buyers."
- apidojo chosen over clockworks for reliability; split-actor strategy to deliver best value per use case (search vs full-profile depth).
- Own-channel input should *feel* different from competitor input (analysis vs discovery) — but the deep report lives in P10, P8 only tags + surfaces own winners.

</specifics>

<deferred>
## Deferred Ideas

- **Comment seeding** (2-3 audience-calibrated pinned comments) → backlog / future P8.x.
- **Own-channel deep "what to improve" standing report** → P10 Account Read (self-optimize over own history).
- **Saved shelf / watchlists / standalone browsable Discover feed** → P10 Saved shelf.
- **Pre-warmed niche feeds (scheduled background scrape)** → P10 flywheel.
- **N>2 audience compare** → future (object already `audience_ids[]`-ready).
- **Live interactive persona cloud (reaction replay, clickable nodes, chat-with-persona)** → P9 AudienceLens.
- **Real social OAuth** (debt #4), **rich chat KC slice** (#5), **wins/flops content enrichment** (#6), **RAG over creator history** (#7) → v6.1+. Per-tool rate-limiting (#10) partially addressed via the D-16 per-user cap.

### Open debt NOT closed by P8 (flag for planner)
- #8 untracked `audience-regression-gate.test.ts` — verify committed before W2 relies on it.
- #9 43 pre-existing tsc errors in `__tests__` (runtime suite green) — separate cleanup.
- #11 coarse SSE stage transitions — needs runner refactor, deferred.

</deferred>

---

*Phase: 8-discover-remix-read-the-competitor-niche-moat-chain*
*Context gathered: 2026-06-19*
