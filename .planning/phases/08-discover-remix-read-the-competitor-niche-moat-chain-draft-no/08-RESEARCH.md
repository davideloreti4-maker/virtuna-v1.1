# Phase 8: Discover & Remix→Read — the competitor/niche moat chain - Research

**Researched:** 2026-06-19
**Domain:** Apify TikTok scraping + outlier-score compute · audience-steer closure across runners · multi-audience static Read card · persona-value tuning (W0)
**Confidence:** HIGH (reuse map + steer pattern verified against live code; Apify actor slugs/fields verified against live apidojo docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 — Wave sequencing:** W0 tune persona bias values · W1 Discover grid + outlier-score + new Apify actor · W2 audience-steered Remix + close ALL-runner steer debt · W3 single-audience concept Read landing · W4 multi-audience compare + verbatim panel + who-it's-NOT-for. Persona-tuning (W0) gates only W4 and anything reading persona values.
- **D-02 — Persona bias values tuned as W0, a HARD prerequisite.** Multi-audience compare with `[ASSUMED]` placeholder values would render noise as signal. Tuning also unblocks read-only personas + the no-coral-cluster weak-signal fallback.
- **D-03 — Close ALL remaining steer in P8** (not just remix+script). Replicate the 07-04 ideas-runner extension shape across hook + test runners + the chat-runner. **Constraint:** General audience = DEFAULT no-op MUST be preserved so the engine regression gate stays green (ENGINE_VERSION unchanged unless a deliberate scoring change is made).
- **D-04 — Comment seeding DEFERRED** out of P8. **Keep** who-it's-NOT-for + verbatim quote panel.
- **D-05 — Hybrid baseline.** Profile input ranks each video vs THAT channel's trailing median. Niche/keyword input ranks vs the result-set median, **labeled honestly "vs niche,"** not "vs own channel."
- **D-06 — Rank = outlier-multiplier primary + save-rate/share-rate value tiebreak** (saves/views, shares/views).
- **D-07 — Trailing ~90d window, recency-decayed.** Window is a constant.
- **D-08 — Verdict line + interpretation + lever + drill.** Per-audience aggregate verdict with the DELTA as the one-line Read + lever; below, expandable per-audience persona panels. P8 ships a **static** side-by-side Read card, NOT the live interactive cloud (P9 owns that).
- **D-09 — Pick 2 audiences explicitly** (cap at 2 for v1; object stays `audience_ids[]`-ready). **Default pair = active calibrated audience vs General.**
- **D-10 — Who-it's-NOT-for derives from low-disposition personas** (no extra model call). Shown on single- + multi-audience Read.
- **D-11 — Verbatim = focus-group quote wall**, grouped by stop/scroll verdict, each tagged with its audience. Pure presentation over already-emitted `scrollQuote` + `segment_reactions`.
- **D-12 — Apify provider = apidojo, SPLIT into two actors** (clockworks removed — broken). `apidojo/tiktok-scraper` = Discover search + competitor outlier pull. `apidojo/tiktok-profile-scraper` = P7 personal-audience calibration + own-channel full history. Both $0.30/1k posts. **Keep the existing provider interface (`scrapeProfile`/`scrapeVideos`) + SSRF allowlist** — only actor slugs swap. (`tiktok-scraper` forbids single-post URLs / min 10 per query — irrelevant; Remix decodes via the rehosted mp4, not an Apify scrape.)
- **D-13 — Discover = its own browsable grid view; tile CTA "Remix → Read" drops into the thread chain.** No saving / watchlist (P10).
- **D-14 — One entry, two modes** — paste @handle/URL → profile mode; type niche/keyword → niche mode. One grid, tiles tagged by source.
- **D-15 — Profile mode further tags own vs competitor.** Own-channel surfaces YOUR over-performers to remix-your-own-winner. Deep self-optimize report stays P10.
- **D-16 — On-demand pull, ~20-30 tiles, cached per (input, day)** + a simple per-user cap.

### Claude's Discretion

- Exact outlier-multiplier decay curve, niche-median computation details, and tile-count tuning — within the D-05/D-06/D-07 envelope.
- Provisional requirement IDs (DISC-*, REMIX-*, READ-*, plus AUD steer extensions) — formalize against REQUIREMENTS.md.
- Pre-W0 hygiene check: confirm the P7 `audience-regression-gate.test.ts` is committed (debt #8) before relying on it as the W2 steer-closure gate. **[VERIFIED — see Environment / Pre-flight below: it IS committed.]**

### Deferred Ideas (OUT OF SCOPE)

- Comment seeding → backlog / future P8.x.
- Own-channel deep "what to improve" standing report → P10 Account Read.
- Saved shelf / watchlists / standalone browsable Discover feed → P10.
- Pre-warmed niche feeds (scheduled background scrape) → P10 flywheel.
- N>2 audience compare → future (object already `audience_ids[]`-ready).
- Live interactive persona cloud → P9 AudienceLens.
- Real social OAuth (#4), rich chat KC slice (#5), wins/flops enrichment (#6), RAG (#7) → v6.1+.
- NOT closed by P8: #9 43 pre-existing tsc errors in `__tests__`, #11 coarse SSE stage transitions.
</user_constraints>

<phase_requirements>
## Phase Requirements

> IDs are provisional (CONTEXT.md Claude's Discretion) — planner formalizes against REQUIREMENTS.md. Mapped here to the research findings that enable each.

| ID | Description | Research Support |
|----|-------------|------------------|
| AUD-W0 | Tune persona bias values (replace `[ASSUMED]` placeholders) so compare is signal, not noise (D-02) | `[ASSUMED]` values live in 3 named tables (§W0 Persona-Tuning Targets): `GOAL_INTENT_BIAS`/`WEIGHT_PRESETS`, `TEMPERATURE_DISPOSITION`, `STRONG/MIXED_THRESHOLD`. All deterministic, no model call. Regression gate anchors the General no-op. |
| DISC-01 | New Apify provider — swap clockworks → apidojo split actors (D-12) | `apify-provider.ts` interface + SSRF allowlist reused verbatim; only `PROFILE_ACTOR`/`VIDEO_ACTOR` slugs swap. **Field-shape remap required** (apidojo ≠ clockworks — §Pitfall 1). |
| DISC-02 | One-entry-two-modes Discover grid view (D-13/D-14/D-15/D-16) | New `outlier-grid` view over `DottedGrid`; tiles reuse `VideoCard`; empty/error/skeleton states reuse competitor components. |
| DISC-03 | Outlier-score compute — hybrid baseline + multiplier + 90d decay (D-05/D-06/D-07) | New pure module consuming scraped `VideoData[]`; baseline = trailing-median (profile) or result-set-median (niche). All inputs returned by the scraper. |
| DISC-04 | On-demand pull cached per (input, day) + per-user cap (D-16) | Cache key `(normalizedInput, mode, YYYY-MM-DD)`; mirrors existing Apify run patterns. |
| REMIX-01 | Audience-steered Remix — steer on active audience, not generic profile (D-03) | `remix-runner.ts` extends to take `audiences: Audience[]` → `resolveAudienceWeights()` + audience niche into the Flash panel (today uses `profileRow.niche_primary` only). |
| AUD-STEER | Close ALL-runner steer — hook + test + chat runners (D-03) | Replicate the exact 07-04 ideas-runner shape (`buildAudienceGroundingLine` + `resolveAudienceWeights` + optional `audience` input). chat-runner today is profile-only (verified). |
| READ-01 | Single-audience concept Read landing (W3) | New `multi-audience-read` block in single-audience form; reuses `aggregateFlash` band math + `FlashPersona` data. |
| READ-02 | Multi-audience compare Read — pick-2, default active-vs-General (D-08/D-09) | `resolveAudienceWeights(Audience[])` is already array-shaped; needs a second resolve + the static card UI (sketch 005 `.read` spine). |
| READ-03 | Verbatim quote wall (D-11) + Who-it's-NOT-for (D-10) | `FlashPersona.{verdict, quote, archetype}` + `CalibratedPersona.disposition` already emitted — pure presentation, no new generation. |
</phase_requirements>

## Summary

Phase 8 is **~80% wiring, ~20% net-new**. The net-new is concentrated and well-bounded: (1) a new Apify field-mapping + outlier-score compute module, and (2) the Discover grid view + two typed blocks. Everything else — the Audience object, the array-shaped weight resolver, the Flash band math, the per-persona `{verdict, quote, archetype}` data, the chain-handoff registry, and the typed-block dispatcher — already exists and was verified in this session against live code.

The two **moat-critical risks** are both confirmed real and both fully scoped:
1. **Steer debt (D-03):** Verified — `chat-runner.ts`, `hooks-runner.ts`, and `script-runner.ts` all ground on `profileRow.niche_primary` only and never consume an `Audience`. Only `ideas-runner.ts` has the 07-04 steer extension (`buildAudienceGroundingLine` + `resolveAudienceWeights` + an optional `audience` input). Closing the debt = replicating that exact import-and-input shape across the other three runners + their routes. **No new design.**
2. **Persona-value tuning (W0):** The `[ASSUMED]` placeholders are deterministic table values in three named files — none require a model call, none touch `ENGINE_VERSION`. Tuning is editing constants + re-asserting the regression gate.

The single largest *integration* trap is that **apidojo's output field names differ materially from clockworks** (`views` not `playCount`, `bookmarks` not `collectCount`, `uploadedAt` not `createTime`, follower baseline at `channel.followers`). The existing Zod schema in `src/lib/schemas/competitor.ts` is shaped for clockworks and MUST be remapped, not reused as-is. D-12 says "only actor slugs swap" — that is true for the *interface*, but NOT for the response-parsing layer. This is Pitfall 1.

**Primary recommendation:** Build W0 (constant tuning + gate) and W1 (apidojo swap + field remap + outlier compute) first as the de-risk spine; reuse `VideoData`/`ProfileData` as the normalized internal shape so the outlier-compute and grid never see raw apidojo JSON. Steer-closure (W2) is mechanical replication gated by the already-committed `audience-regression-gate.test.ts`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Apify scrape (keyword/profile pull) | API / Backend (Apify SDK call) | — | Token-bearing, SSRF-guarded, server-only (`apify-client`). Never client. |
| Outlier-score compute (baseline + multiplier + decay) | API / Backend (pure module) | — | Deterministic numeric transform over scraped `VideoData[]`; runs server-side before tiles are sent. |
| Discover grid view | Frontend Server (Next RSC) + Client (interactive grid) | — | Grid surface is a `(app)` route page; tiles render server-side, CTA click is client. |
| Audience steer resolution | API / Backend (runner) | — | `resolveAudienceWeights` + grounding fold happen inside the runner before generation. |
| Multi-audience Read card | API / Backend (compute) + Client (static render) | — | Two Flash resolves server-side; the card itself is a fixed typed renderer (no model UI). |
| Persona-value config | Build-time constants | — | `GOAL_INTENT_BIAS`, `TEMPERATURE_DISPOSITION`, thresholds are compiled tables (no runtime call). |
| Cache (per input/day) | API / Backend | Database (optional) | On-demand server cache keyed `(input, mode, day)`; in-memory or a `discover_cache` table. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `apify-client` | `^2.22.1` (installed) | Apify Actor invocation + dataset read for both apidojo actors | Official Apify SDK, already the project's scrape transport. **[VERIFIED: package.json + node resolve → 2.22.1]** |
| `zod` | installed | Re-map + validate apidojo dataset items; the typed-block schemas | Already the block/scrape validation SSOT. **[VERIFIED: codebase]** |
| `@supabase/supabase-js` | installed | Audience rows, thread `active_audience_id`, optional discover cache | Project data layer. **[VERIFIED: codebase]** |

**No new dependencies are required for Phase 8.** The scrape transport, validation, data layer, UI primitives, and renderer library are all present. **[VERIFIED: codebase grep — apidojo is a hosted Actor invoked through the existing `apify-client`, not an npm package.]**

### Supporting (all already in-repo — reuse, do not install)
| Library/Module | Purpose | When to Use |
|---------|---------|-------------|
| `src/lib/scraping/apify-provider.ts` | Provider class — swap slugs (D-12) | DISC-01 |
| `src/lib/audience/resolve-audience-weights.ts` | Array-shaped weight resolver | REMIX-01, READ-02 |
| `src/lib/engine/flash/flash-aggregate.ts` | `aggregateFlash` band/fraction | READ-01/02 |
| `src/components/competitors/detail/video-card.tsx` | Outlier tile base | DISC-02 |
| `src/components/app/dotted-grid.tsx` | Grid surface | DISC-02 |
| `src/lib/tools/chain-handoff.ts` | `CHAIN_HANDOFFS` registry | D-13 CTA |
| `src/lib/tools/blocks.ts` + `src/components/thread/message-blocks.tsx` | Typed-block schema union + dispatcher | B1/B2 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| apidojo split actors (D-12) | clockworks (current) | clockworks is broken per owner — **locked out**. Do not reuse clockworks slugs. |
| New `discover_cache` table | In-memory per-process cache | DB cache survives serverless cold-starts + multi-instance; in-memory is simpler but per-instance. Within D-16 discretion. |
| Per-author scrape for niche baseline | result-set median (D-05) | Per-author = N× cost; D-05 locks the bounded niche-median path. **Locked.** |

**Installation:** None. (Apify actors are invoked, not installed.)

**Version verification performed:**
- `apify-client` → `2.22.1` installed. **[VERIFIED: `node -e require('apify-client/package.json').version` → 2.22.1]**
- `apidojo/tiktok-scraper` → live, $0.30/1k, 400–600 posts/sec, min 10 posts/query, single-post URLs forbidden. **[CITED: apify.com/apidojo/tiktok-scraper]**
- `apidojo/tiktok-profile-scraper` → live, $0.30/1k, ~425 posts/sec, 40+ fields, 98% success across 25K+ runs. **[CITED: apify.com/apidojo/tiktok-profile-scraper]**

## Package Legitimacy Audit

> Phase 8 installs **no new packages**. The only external dependency is the already-installed, official Apify SDK; the apidojo actors are hosted Apify Store actors invoked by slug, not npm packages.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `apify-client` | npm | mature (Apify official) | high | github.com/apify/apify-client-js | OK | Already installed (`^2.22.1`) — no change |

**Apify Actors (not npm packages — Apify Store hosted):**
| Actor slug | Store | Pricing | Success | Verdict |
|------------|-------|---------|---------|---------|
| `apidojo/tiktok-scraper` | apify.com | $0.30/1k, 400–600/s | — | CITED-live |
| `apidojo/tiktok-profile-scraper` | apify.com | $0.30/1k, ~425/s | 98% / 25K+ runs | CITED-live |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

> Note: the `gsd-tools` legitimacy seam was not invokable from this worktree (shim absent at `gsd-core/bin/`). `apify-client` legitimacy is established by it being the project's existing, already-vendored official Apify SDK (codebase-verified at `2.22.1`), not by training-data assumption. The apidojo actor slugs are `[CITED]` from live apify.com pages, not assumed.

## Architecture Patterns

### System Architecture Diagram

```
DISCOVER (W1)                         REMIX (W2)                    READ (W3/W4)
────────────                          ──────────                    ────────────

[single input box]
  │ classify
  ├── @handle/URL ──► profile mode    (tile CTA "Remix → Read")
  └── free text ────► niche mode             │
        │                                    ▼
        ▼                          [chain-handoff: discover→remix]
  apify-provider                            │
  (apidojo slug)                            ▼
  scrapeVideos/                     remix-runner.runRemixPipeline
  scrapeProfile                       resolve → Omni perceive → decode → adapt
        │                              │  + NEW: audiences[] → resolveAudienceWeights
   raw apidojo JSON                    │         + audience niche → Flash panel  (D-03)
        │ ZOD REMAP (Pitfall 1)        ▼
        ▼                            runFlashTextMode(adapted hook) → aggregateFlash
  VideoData[] (normalized)            │
        │                            remix-card block ──► CHAIN ──► hooks → script → test
        ▼                                                              │
  outlier-compute (NEW, pure)                                          ▼
   baseline = trailing-median(profile)               ┌─────────────────────────────────┐
            | result-set-median(niche)               │  multi-audience-read block (B1)  │
   90d recency decay  (D-07)                          │  for each of ≤2 audiences:       │
   multiplier = views / baseline                      │   resolveAudienceWeights([aud])  │
   tiebreak = saves/views, shares/views (D-06)        │   → Flash personas → aggregate   │
        │                                             │   verdict line + DELTA Read+Lever │
        ▼                                             │   who-NOT-for (low-disposition)   │
  ranked tiles → outlier-grid view (B2)               │   verbatim wall (verdict+quote)   │
   over DottedGrid surface                            └─────────────────────────────────┘
   cache (input, mode, day)  (D-16)                     static card — sketch 005 .read spine
                                                        (NO live cloud — P9 owns that)
```

### Recommended Project Structure (net-new files only — everything else extends in place)
```
src/lib/discover/
├── outlier-compute.ts        # NEW pure module — baseline, multiplier, decay, rank (DISC-03)
├── discover-cache.ts         # NEW per-(input,day) cache (DISC-04)
└── classify-input.ts         # NEW @handle|URL vs niche classifier (D-14)
src/lib/scraping/
├── apify-provider.ts         # EDIT — slugs → apidojo
└── ../schemas/competitor.ts  # EDIT — Zod remap apidojo field names (Pitfall 1)
src/lib/tools/
├── chain-handoff.ts          # EDIT — append discover→remix; add "discover" SkillId
├── blocks.ts                 # EDIT — add outlier-grid + multi-audience-read schemas to union
└── runners/
    ├── remix-runner.ts       # EDIT — audiences[] steer (REMIX-01)
    ├── hooks-runner.ts       # EDIT — replicate 07-04 steer shape (AUD-STEER)
    ├── script-runner.ts      # EDIT — replicate 07-04 steer shape (AUD-STEER)
    └── chat-runner.ts        # EDIT — replicate 07-04 steer shape (AUD-STEER)
src/components/discover/      # NEW — grid view, outlier-tile, mode hint
src/components/thread/
├── multi-audience-read-block.tsx   # NEW B1 renderer
└── message-blocks.tsx        # EDIT — register 2 new block components
```

### Pattern 1: Replicate the 07-04 ideas-runner steer shape (D-03 — the core W2 pattern)
**What:** Each generation runner gains an optional `audience?: Audience | null` input, swaps its grounding-line call to `buildAudienceGroundingLine(audience, platform, profileRow)`, and (where it scores) passes `resolveAudienceWeights([audience])` into the Flash/SIM path. General/null delegates to the existing profile path — byte-identical no-op.
**When to use:** hooks-runner, script-runner, chat-runner, remix-runner (W2).
**Example (the live, shipped reference — copy this shape):**
```typescript
// Source: src/lib/tools/runners/ideas-runner.ts (07-04, VERIFIED in-session)
import { buildAudienceGroundingLine } from "@/lib/audience/audience-grounding";
import { resolveAudienceWeights } from "@/lib/audience/resolve-audience-weights";
import type { Audience } from "@/lib/audience/audience-types";

export interface IdeasPipelineInput {
  ask: string;
  platform: AssemblerInput["platform"];
  profileRow: ProfileRow | null;
  audience?: Audience | null;   // ← the ONLY signature change to add steer
}
// General/null → buildAudienceGroundingLine delegates to buildGroundingLine
//   → zero behavior change → regression gate green.
```
And the route side (already shipped for ideas — replicate per runner):
```typescript
// Source: src/app/api/tools/ideas/route.ts (VERIFIED in-session)
import { getAudience, GENERAL_AUDIENCE } from "@/lib/audience/audience-repo";
const activeAudienceId = (openThread as { active_audience_id?: string | null }).active_audience_id ?? null;
// NULL = General (no DB query). Non-null → getAudience() (virtual-constant short-circuit).
// Pass `audience: activeAudience` into the runner input.
```

### Pattern 2: Normalize at the scrape boundary (Pitfall 1 mitigation)
**What:** apidojo raw JSON is remapped to the existing `VideoData`/`ProfileData` interfaces inside `apify-provider.ts` (via a remapped Zod schema). Outlier-compute + grid only ever see `VideoData` — they never know which actor produced it.
**Why:** isolates the apidojo↔clockworks field-name delta to one file; keeps D-12's "interface unchanged" promise true for every downstream consumer.

### Pattern 3: Outlier baseline is mode-dependent, decay is shared
```
multiplier(video) = views(video) / baseline
  baseline =  median(trailing-90d views of THAT channel)   when mode=profile  (D-05 "vs own")
           |  median(trailing-90d views of the result set)  when mode=niche    (D-05 "vs niche")
rank key   = (recencyDecay(postedAt) * multiplier) primary,
             then saves/views desc, then shares/views desc  (D-06 value tiebreak)
```
Decay curve + niche-median details are Claude's Discretion within the D-05/06/07 envelope. Recommend a simple half-life over the 90d window (e.g. weight = 0.5^(ageDays/HALF_LIFE_DAYS)) as a constant.

### Anti-Patterns to Avoid
- **Reusing the clockworks Zod schema for apidojo** → silent zeros (every metric parses to its `.default(0)` because the key names don't match). This is the single most likely "it ran but the grid is empty/wrong" failure. See Pitfall 1.
- **Re-applying `GOAL_INTENT_BIAS` per request** → the bias is PRE-BAKED at calibration time into `audience.persona_weights`; the resolver passes it through `analysis_override` only. Re-applying breaks determinism (Pitfall 2 from P7, still load-bearing).
- **Letting General inject an `analysis_override`** → breaks the regression gate. General MUST resolve to `DEFAULT` mix, source `'default'`.
- **A second coral element per card** → board-kit accent law (UI-SPEC §Color). The outlier "12×" badge is neutral data, NOT coral; coral stays on the CTA.
- **Bumping `ENGINE_VERSION`** for W0 tuning or steer closure → these are text/generation-path changes, additive only. The gate asserts `ENGINE_VERSION === "3.19.0"`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Apify run + dataset read | Custom fetch to Apify REST | `apify-client` `ApifyClient` (existing) | Auth, polling, dataset pagination handled |
| mp4 SSRF safety | New host-allow logic | `isAllowedMp4Host` in apify-provider | Spike-hardened allowlist already there |
| Band/verdict rollup | New scoring math | `aggregateFlash()` | Calibrated `STRONG=6/MIXED=3`, honesty-spine output shape |
| Multi-audience resolution | New per-audience config object | `resolveAudienceWeights(Audience[])` | Already array-shaped; multi-select is additive |
| Block validation on render | Manual prop checks | `validateBlock` + `UnsupportedBlock` (D-14) | Re-validates on rehydration; invalid → sentinel |
| Tile metrics grid | New card | `VideoCard` (4-col Eye/Heart/MessageCircle/Share2) | Pixel-matches Raycast tokens; reuse + extend |
| Grid surface | New pannable canvas | `DottedGrid` | 24px dotted base layer exists |
| Empty/error/skeleton | New states | `CompetitorEmptyState` / `ScrapeErrorBanner` / `competitor-card-skeleton` | All exist, Raycast-styled |
| Audience-facing grounding line | New copy builder | `buildAudienceGroundingLine` | Honesty-spine, delegates for General |

**Key insight:** This phase's value is *wiring discipline*, not invention. The only genuinely new logic is the outlier-score arithmetic and the apidojo field remap — both small, pure, and testable in isolation.

## Runtime State Inventory

> Phase 8 is greenfield-leaning (new features) but the **apidojo actor swap (D-12) IS a runtime-config change with cached/stored implications**. This inventory covers it.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `competitor_videos` / scrape result rows (if persisted by the existing competitors feature) were written from **clockworks** field shapes. Discover (P8) writes fresh; it does not migrate old rows. | None for P8 — Discover is read-fresh + cache-per-day. No back-migration. |
| Live service config | `APIFY_TOKEN` env (used by `apify-provider`, `webhooks/apify/route.ts`, `cron/scrape-trending/route.ts`). `APIFY_ACTOR_ID` env defaults to `clockworks~tiktok-scraper` in `cron/scrape-trending`. | P8 changes provider slugs in `apify-provider.ts` only. **Flag:** the cron + webhook routes still reference clockworks; confirm whether P8's swap is provider-wide or Discover-scoped (recommend Discover-scoped to avoid touching the existing competitors/cron path — but verify the actors are still valid). |
| OS-registered state | None. | None — verified: no Task Scheduler / cron OS jobs; `cron/scrape-trending` is a Vercel route, not OS-registered. |
| Secrets/env vars | `APIFY_TOKEN` (unchanged — same account, same token works for apidojo actors). `APIFY_ACTOR_ID` default string references clockworks. | Token: no change. If P8 also retires clockworks globally, update `APIFY_ACTOR_ID` default + the two routes; otherwise leave them. |
| Build artifacts | None (no compiled package rename). | None. |

**Critical flag for planner:** D-12 says "swap the actor slugs" but `clockworks` is referenced in **four** places: `apify-provider.ts` (PROFILE_ACTOR/VIDEO_ACTOR), `apify-provider.ts` resolveVideoUrl comment, `cron/scrape-trending/route.ts` (`APIFY_ACTOR_ID` default), and `resolve-video.test.ts` (asserts `clockworks/tiktok-scraper`). The Remix path's `resolveVideoUrl` uses `VIDEO_ACTOR` with `shouldDownloadVideos:true` + `postURLs` — **apidojo `tiktok-scraper` forbids single-post URLs**, so the Remix resolve path may NOT be able to use the same actor. CONTEXT D-12 acknowledges this ("Remix decodes via the rehosted mp4, not an Apify scrape") but the *current code* DOES use Apify (`resolveVideoUrl`) for the rehost. **Planner must decide:** keep clockworks (or a single-URL-capable actor) for `resolveVideoUrl`, and use apidojo only for Discover's `scrapeVideos`/`scrapeProfile`. This is the highest-value open question (§Open Questions Q1).

## Common Pitfalls

### Pitfall 1: apidojo field names ≠ clockworks — the Zod schema silently zeros out
**What goes wrong:** The existing `apifyVideoSchema` (in `src/lib/schemas/competitor.ts`) expects clockworks keys: `playCount`, `diggCount`, `shareCount`, `commentCount`, `collectCount`, `createTime`, `webVideoUrl`, `videoMeta.duration`. apidojo `tiktok-scraper` returns **`views`, `likes`, `shares`, `comments`, `bookmarks`, `uploadedAt`, and `channel.followers`**. Because every metric field uses `.default(0)`, a mismatched parse succeeds and yields **all-zero metrics** — the grid renders but every outlier multiplier is `0/0` or garbage.
**Why it happens:** D-12 says "only actor slugs swap" — true at the *interface* level, false at the *parsing* level.
**How to avoid:** Write a new apidojo-shaped Zod schema (or a discriminated parser) that maps `views→views`, `bookmarks→saves`, `uploadedAt→postedAt`, `channel.followers→authorFollowers`, then emits the **same** `VideoData` interface. Test against a real captured apidojo dataset item, not training-data field names.
**Warning signs:** Grid renders but all multipliers identical/zero; `engagementRate` NaN; "vs own/niche" badges all "0×".
**Source:** **[CITED: apify.com/apidojo/tiktok-scraper]** output fields (`views`, `likes`, `comments`, `shares`, `bookmarks`, `uploadedAt`, `channel.followers`) vs **[VERIFIED: src/lib/schemas/competitor.ts]** clockworks keys.

### Pitfall 2: Remix `resolveVideoUrl` cannot use apidojo `tiktok-scraper` (single-post URL forbidden)
**What goes wrong:** `resolveVideoUrl` passes `postURLs: [url]` (one URL) + `shouldDownloadVideos:true`. apidojo `tiktok-scraper` **forbids single-post URLs and requires ≥10 posts/query**. A blind slug swap breaks the Remix rehost.
**How to avoid:** Scope the apidojo swap to Discover's `scrapeVideos`/`scrapeProfile` only; leave `resolveVideoUrl` on a single-URL-capable actor (clockworks or another). Or confirm `apidojo/tiktok-profile-scraper` / a third actor supports single-post mp4 download.
**Warning signs:** Remix card always errors `resolve_failed` after the swap.
**Source:** **[CITED: apify.com/apidojo/tiktok-scraper]** "single post URLs are not allowed", "min 10 posts/query"; **[VERIFIED: apify-provider.ts resolveVideoUrl]**.

### Pitfall 3: Steer closure that injects an override for General → regression gate red
**What goes wrong:** A runner edit that always builds an `analysis_override` (even for General) flips the gate's `source: 'default'` assertion.
**How to avoid:** `resolveAudienceWeights([])` / `[generalAudience]` MUST return `source:'default'` (it already does — keep the delegation). Re-run `audience-regression-gate.test.ts` per runner edit.
**Warning signs:** `audience-regression-gate.test.ts` fails on the General invariant; `ENGINE_VERSION` assertion fails if anyone touches the version.
**Source:** **[VERIFIED: src/lib/engine/__tests__/audience-regression-gate.test.ts]**.

### Pitfall 4: W0 tuning that changes the band thresholds → silently shifts every gate
**What goes wrong:** `STRONG_THRESHOLD=6`/`MIXED_THRESHOLD=3` are consumed by the ideas/hooks/script gate floors (`band !== "Weak"`). Re-tuning them as part of W0 changes which generations survive across ALL skills, not just the compare card.
**How to avoid:** Treat the three W0 tuning surfaces as separate decisions. The CONTEXT D-02 intent is to tune **persona bias values** (`GOAL_INTENT_BIAS`/`WEIGHT_PRESETS` + the repaint/`TEMPERATURE_DISPOSITION` lens), NOT necessarily the aggregate thresholds. If thresholds change, run the full engine suite (2647 tests) and treat it as a deliberate, reviewed change.
**Warning signs:** Idea/hook survivor counts shift; previously-passing fixtures flip band.
**Source:** **[VERIFIED: flash-aggregate.ts (thresholds), ideas-runner.ts (gate floor consumes them)]**.

### Pitfall 5: Honesty-spine violation in the new blocks (fabricated 0–100)
**What goes wrong:** A new `multi-audience-read` or `outlier-grid` block emits a numeric 0–100 score or a fabricated per-persona figure.
**How to avoid:** Mirror `BandBlockSchema` — band word + fraction + `model: z.literal("sim1-flash")` only. The "12×" multiplier is *measured scrape data* (allowed, must carry "vs own"/"vs niche" label); a SIM *score* number is forbidden.
**Source:** **[VERIFIED: blocks.ts BandBlockSchema, RemixCardBlockSchema]**; UI-SPEC §Color honesty rules.

### Pitfall 6: Cache key that ignores mode → profile vs niche collision
**What goes wrong:** Caching on `(input, day)` alone collides when the same string is valid as both a handle and a niche, or when mode classification differs.
**How to avoid:** Key on `(normalizedInput, mode, YYYY-MM-DD)`. Use the existing `normalizeHandle` for the profile branch.
**Source:** **[VERIFIED: competitor.ts normalizeHandle]**; D-16.

## W0 Persona-Tuning Targets (the `[ASSUMED]` values to replace — D-02)

> These are the deterministic constant tables carrying `[ASSUMED]` markers from P7. W0 replaces the placeholder *values* (not the structure). None require a model call. None touch `ENGINE_VERSION`.

| File | Symbol | What's `[ASSUMED]` | Tuning constraint |
|------|--------|--------------------|-------------------|
| `src/lib/audience/goal-intent.ts` | `GOAL_INTENT_BIAS` | Which `WEIGHT_PRESETS` key each intent maps to (grow→new_creator, sell/authority→niche_heavy, nurture→established). Comment: "structure-not-values … tuned in the post-P7 refinement run." | Values from `WEIGHT_PRESETS` (don't invent mixes). Keys locked; values tune. |
| `src/components/board/audience/audience-constants.ts` | `WEIGHT_PRESETS` | The four preset mixes (default/established/niche_heavy/new_creator) | Must sum to 1.0; `default` MUST stay `{0.65,0.20,0.10,0.05}` (regression-gate anchor). |
| `src/lib/audience/temperature-disposition.ts` | `TEMPERATURE_DISPOSITION` | 10-archetype → temperature×disposition lens (`[ASSUMED] per D-02`) | Presentation-only; feeds who-NOT-for (D-10) + verbatim grouping (D-11). Tune so low-disposition personas are meaningful. |
| `src/lib/engine/flash/flash-aggregate.ts` | `STRONG_THRESHOLD`/`MIXED_THRESHOLD` | Calibrated, NOT `[ASSUMED]` — leave unless deliberate | Changing these shifts every gate (Pitfall 4). Recommend NOT touching in W0. |

**Recommendation:** W0 scope = `GOAL_INTENT_BIAS` value tuning + `TEMPERATURE_DISPOSITION` lens validation (so disposition labels are real for who-NOT-for). The `repaintPersonas` template (`ARCHETYPE_BASE_DESCRIPTION` + `GOAL_INTENT_SUFFIX`) is already authored prose, not `[ASSUMED]` — review for quality but it is not a placeholder. After tuning, re-run `audience-regression-gate.test.ts` + `persona-weights.test.ts`.

## Code Examples

### Outlier multiplier + decay (new pure module sketch)
```typescript
// Source pattern: D-05/D-06/D-07 — NEW src/lib/discover/outlier-compute.ts
import type { VideoData } from "@/lib/scraping/types";

const WINDOW_DAYS = 90;             // D-07 constant
const HALF_LIFE_DAYS = 30;          // Claude's discretion — decay constant

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export function rankOutliers(
  videos: VideoData[],
  mode: "profile" | "niche",
): Array<VideoData & { multiplier: number; rankKey: number; baselineLabel: string }> {
  const now = Date.now();
  const recent = videos.filter(
    (v) => (now - v.postedAt.getTime()) / 86_400_000 <= WINDOW_DAYS,
  );
  // niche: one shared baseline; profile: same-channel baseline (single channel per pull)
  const baseline = median(recent.map((v) => v.views)) || 1;
  const baselineLabel = mode === "profile" ? "vs own" : "vs niche";  // D-05 honest label

  return recent
    .map((v) => {
      const ageDays = (now - v.postedAt.getTime()) / 86_400_000;
      const decay = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);   // D-07 recency decay
      const multiplier = v.views / baseline;
      return { ...v, multiplier, baselineLabel, rankKey: decay * multiplier };
    })
    .sort(
      (a, b) =>
        b.rankKey - a.rankKey ||                                  // D-06 primary
        b.saves / (b.views || 1) - a.saves / (a.views || 1) ||    // saves/views tiebreak
        b.shares / (b.views || 1) - a.shares / (a.views || 1),    // shares/views tiebreak
    );
}
```

### Two-audience Read resolve (READ-02)
```typescript
// Source: resolve-audience-weights.ts is already Audience[]-shaped (VERIFIED).
// W4 resolves each audience separately for the side-by-side card.
const pair = [activeAudience, GENERAL_AUDIENCE];   // D-09 default pair
const reads = pair.map((aud) => {
  const { weights } = resolveAudienceWeights([aud]);  // per-audience override
  // ...run Flash with these weights → aggregateFlash(personas) → { band, fraction }
});
// who-NOT-for = personas with low-disposition (D-10) from each audience's CalibratedPersona[]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| clockworks TikTok actors | apidojo split actors | P8 (D-12) | Different field names (Pitfall 1); single-post URL forbidden on search actor (Pitfall 2) |
| Steer in ideas-runner only (07-04) | Steer in all 4 runners (P8 D-03) | P8 W2 | Closes the half-moat (predict-for-audience, generate-for-generic) |
| Single-audience Read | Static 2-audience compare card | P8 W4 | "wins for growth, bombs for buyers" headline; live cloud deferred to P9 |

**Deprecated/outdated:**
- clockworks actors: owner reports broken — do not reuse their slugs for new code. (`cron/scrape-trending` + `webhooks/apify` still reference them; out of P8 scope unless globally retired.)
- `training-data.json` exemplars: a liability per REQUIREMENTS — not a P8 input.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | apidojo `tiktok-scraper` exposes per-video `channel.followers`, usable as a profile-mode baseline alongside trailing-median views | Pitfall 1 / outlier-compute | If absent, profile-mode baseline must rely solely on the channel's own trailing-median view set (still works; D-05 is view-median-based anyway). LOW risk — view fields are confirmed; follower baseline is a bonus. |
| A2 | `resolveVideoUrl` (Remix rehost) needs a single-URL-capable actor that apidojo `tiktok-scraper` is NOT | Pitfall 2 / Runtime State | If apidojo offers a single-URL download mode (or profile-scraper does), the split can be cleaner. MEDIUM — planner must verify the chosen rehost actor before W2. |
| A3 | W0 should NOT touch `STRONG/MIXED_THRESHOLD` (they're calibrated, not `[ASSUMED]`) | W0 Targets / Pitfall 4 | If owner intends threshold re-tuning, it's a deliberate engine change needing the full suite + review. LOW — flagged for confirmation. |
| A4 | apidojo swap is Discover-scoped, leaving the existing competitors/cron clockworks path untouched | Runtime State Inventory | If owner wants a global retire, 2 extra routes + 1 test + an env default change. LOW — additive either way. |
| A5 | Half-life recency decay (0.5^(age/30d)) is an acceptable curve within D-07 | outlier-compute example | Pure Claude's-discretion tuning; trivially adjustable. NONE. |

**Note:** The apidojo actor *slugs, pricing, fields, and constraints* are `[CITED]` from live apify.com pages (not assumed). `apify-client@2.22.1` is `[VERIFIED]` from the installed package.

## Open Questions

1. **Which actor handles the Remix `resolveVideoUrl` single-URL rehost after the apidojo swap?**
   - What we know: apidojo `tiktok-scraper` forbids single-post URLs (≥10/query). The current code uses it (`VIDEO_ACTOR`) with `postURLs:[one]`+`shouldDownloadVideos`.
   - What's unclear: whether to keep clockworks for that one method, or whether an apidojo actor supports single-URL mp4 download.
   - Recommendation: **Scope apidojo to Discover's `scrapeVideos`/`scrapeProfile` only; leave `resolveVideoUrl` on its current working actor.** Verify before W2. (Highest-priority planner decision.)

2. **Cache backing: in-memory vs `discover_cache` table?**
   - Recommendation: a small Supabase `discover_cache(key, payload_json, created_date)` table survives serverless cold-starts; in-memory is acceptable for a v1 single-instance. Within D-16 discretion.

3. **Per-user cap value (D-16)?**
   - Recommendation: a constant (e.g. N pulls/user/day); pick a number, surface a friendly cap message reusing the error-banner shape. Folds toward debt #10.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `apify-client` | DISC-01 scrape transport | ✓ | 2.22.1 | — |
| `APIFY_TOKEN` env | apidojo Actor auth | ✓ (used by existing provider + cron + webhook) | — | — (same token works for apidojo) |
| apidojo `tiktok-scraper` Actor | Discover search/competitor pull | ✓ (live, $0.30/1k) | — | clockworks (broken — not viable) |
| apidojo `tiktok-profile-scraper` Actor | profile mode / own-channel | ✓ (live, 98% / 25K+ runs) | — | — |
| `zod`, `@supabase/supabase-js`, Radix UI, lucide-react, phosphor | validation, data, UI | ✓ | installed | — |
| `gsd-tools` legitimacy seam | package audit | ✗ (shim absent in worktree) | — | Manual verify (done — see §Package Legitimacy Audit) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `gsd-tools` seam absent → manual package verification performed instead (apify-client codebase-verified; apidojo slugs live-cited).

## Pre-flight Hygiene Check (CONTEXT Claude's Discretion item)

- **`audience-regression-gate.test.ts` committed?** **YES — VERIFIED.** `git ls-files` returns `src/lib/engine/__tests__/audience-regression-gate.test.ts` and `src/lib/engine/__tests__/persona-weights.test.ts`. **Debt #8 is resolved** — W2 steer-closure can rely on this gate. The gate asserts (1) `ENGINE_VERSION === "3.19.0"`, (2) General reproduces the DEFAULT mix at source `'default'` via both resolvers, (3) Max video path untouched.

## Sources

### Primary (HIGH confidence — verified in-session)
- `src/lib/scraping/apify-provider.ts`, `src/lib/scraping/types.ts`, `src/lib/schemas/competitor.ts` — provider interface, SSRF allowlist, clockworks Zod field shape
- `src/lib/audience/{audience-types,resolve-audience-weights,audience-grounding,goal-intent,temperature-disposition,persona-repaint,audience-repo}.ts` — Audience object, array resolver, steer fold, W0 tuning targets
- `src/lib/tools/runners/{ideas,hooks,script,chat,remix}-runner.ts` — steer-debt confirmation (only ideas has 07-04 steer)
- `src/lib/tools/{chain-handoff,blocks}.ts`, `src/components/thread/message-blocks.tsx` — chain registry, block union, dispatcher
- `src/lib/engine/flash/{flash-schema,flash-aggregate}.ts`, `src/lib/engine/persona-weights.ts` — FlashPersona data, band math, weight precedence
- `src/lib/engine/__tests__/audience-regression-gate.test.ts` — the W2 gate (committed)
- `src/components/{competitors/detail/video-card,app/dotted-grid,competitors/competitor-empty-state,competitors/scrape-error-banner,competitors/competitor-card-skeleton}.tsx` — UI reuse surfaces (exist)
- `src/components/board/audience/audience-constants.ts` — `WEIGHT_PRESETS`
- `package.json` + `node` resolve — `apify-client@2.22.1`

### Secondary (MEDIUM confidence — live external docs)
- apify.com/apidojo/tiktok-scraper — slug, input (`keywords`/`startUrls`/`sortType`/`dateRange`/`maxItems`), output (`views`/`likes`/`comments`/`shares`/`bookmarks`/`uploadedAt`/`channel.followers`), $0.30/1k, 400–600/s, min-10/forbid-single-URL
- apify.com/apidojo/tiktok-profile-scraper — slug, profiles input + date range, 40+ fields, $0.30/1k, ~425/s, 98% success

### Tertiary (LOW confidence)
- None — all claims are codebase-verified or live-cited.

## Metadata

**Confidence breakdown:**
- Reuse map / steer pattern: HIGH — every claimed file read in-session; steer debt confirmed by grep.
- Apify apidojo integration: HIGH on slugs/pricing/constraints (live-cited); MEDIUM on exact nested field JSON until a real dataset item is captured (Pitfall 1 mitigation: validate against a real item).
- Outlier compute / W0 targets: HIGH on *where* / structure; decay curve + cap value are Claude's-discretion tuning.
- Pitfalls: HIGH — derived from concrete code + cited constraints.

**Research date:** 2026-06-19
**Valid until:** 2026-07-19 (stable in-repo) · 2026-06-26 for apidojo actor specifics (Apify Store pages change — re-verify field shape against a live dataset item before W1 ships).
</content>
</invoke>
