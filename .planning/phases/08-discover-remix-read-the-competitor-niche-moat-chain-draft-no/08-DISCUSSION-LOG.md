# Phase 8: Discover & Remix→Read — the competitor/niche moat chain - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 8-discover-remix-read-the-competitor-niche-moat-chain
**Areas discussed:** Phase scope/slice, Outlier-score compute, Multi-audience Read, Discover front door

> The owner opened with a debt dump from a prior session (steer-everywhere debt, untuned persona values, multi-select compare, social OAuth, thin chat KC slice, wins/flops URLs-only, RAG, untracked regression test, tsc errors, rate-limiting, coarse SSE). The two moat-critical items (#1 steer, #2 persona values) directly reshaped P8 scope.

---

## Phase scope / slice

| Option | Description | Selected |
|--------|-------------|----------|
| Thin chain first, panels last (waved) | W0..W4; de-risk Apify/outlier/grid before killer feature | ✓ |
| Full 6-feature bundle, one wave | All at once, highest risk | |
| Discover grid only this phase | Defer the chain — Sandcastles parity | |

**User's choice:** Thin chain first. **Note:** apidojo actor needed — clockworks broken.

| Option | Description | Selected |
|--------|-------------|----------|
| Tune persona values first (W0) | Prerequisite so compare is real, not placeholders | ✓ |
| Ship compare, label "directional" | Honest framing on untuned numbers | |
| Defer compare to P9/P10 | Single-audience Read only in P8 | |

**User's choice:** Tune persona values first as W0.

| Option | Description | Selected |
|--------|-------------|----------|
| Close ALL remaining steer in P8 | hook/test/chat + chat-runner, replication of 07-04 | ✓ |
| Only remix+script (draft scope) | Leaves half-moat on 3 skills | |
| Separate steer-closure phase first | Delays Discover | |

**User's choice:** Close ALL remaining steer in P8.

| Option | Description | Selected |
|--------|-------------|----------|
| Defer comment seeding | Lowest value, net-new | ✓ |
| Keep who-it's-NOT-for | Cheap, anti-slop | ✓ |
| Keep verbatim quote panel | Presentation over existing data | ✓ |

**User's choice:** Defer comment seeding; keep who-it's-NOT-for + verbatim panel.

---

## Outlier-score compute

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid baseline (own-channel / niche-median) | Profile→own median, keyword→result-set median, labeled | ✓ |
| Always per-author own-baseline | Truest but N× scrape cost | |
| Follower-normalized only | Cheapest, penalizes break-out videos | |

| Option | Description | Selected |
|--------|-------------|----------|
| Multiplier primary + save/share tiebreak | Surfaces replicable formats | ✓ |
| Composite weighted score | Less legible, needs tuning | |
| Pure multiplier (wave 1) | Risk of un-actionable spikes | |

| Option | Description | Selected |
|--------|-------------|----------|
| Trailing ~90d, recency-decayed | Current opportunities | ✓ |
| Strict recent (~30d) | Thin sets in slow niches | |
| All-time, no decay | Stale hall-of-fame | |

**User's choice:** Hybrid baseline · multiplier + save/share tiebreak · 90d decayed.

---

## Multi-audience Read

| Option | Description | Selected |
|--------|-------------|----------|
| Verdict line + interpretation + lever + drill | Foresight, aligns w/ P9 AudienceLens spine | ✓ |
| Two persona panels side-by-side | A chart, no interpretation | |
| A/B toggle (one at a time) | Loses simultaneous compare punch | |

| Option | Description | Selected |
|--------|-------------|----------|
| Pick 2 explicitly; default active vs General | Cap 2 v1, doubles as calibration proof | ✓ |
| Always active vs General only | No two-real-audiences story | |
| Up to N (3-4) | Dense on mobile | |

| Option | Description | Selected |
|--------|-------------|----------|
| Derive from low-disposition personas | No extra call, falls out of compare | ✓ |
| Separate generation call | Fabrication risk | |
| Compare-only | Drops single-audience value | |

| Option | Description | Selected |
|--------|-------------|----------|
| Focus-group wall, grouped by verdict + tag | Real-room feel, data exists | ✓ |
| Lead quote per audience only | Loses volume | |
| Cluster by disposition | Depends on persona tuning | |

**User's choice:** Verdict+interpretation+lever+drill · pick-2 default active-vs-General · who-NOT-for from low-disposition · focus-group quote wall.

---

## Discover front door

| Option | Description | Selected |
|--------|-------------|----------|
| Researcher evaluates actors, you confirm | Field-parity check | |
| You specify the actor slug now | Skips parity check | |
| Wave-0 spike: test 2-3 actors | Most rigorous | |

**User's choice:** Go apidojo, evaluate their services together → (resolved below as the split-actor decision).

| Option | Description | Selected |
|--------|-------------|----------|
| Own grid view, tile CTA → thread chain | Browsable grid, chain-coupled action | ✓ |
| Results as a typed block in-thread | Dense grid awkward in column | |
| Standalone feed with save/watchlist | P10 scope | |

| Option | Description | Selected |
|--------|-------------|----------|
| One entry, two modes (@handle vs niche) | Mirrors hybrid baseline | ✓ |
| Both required together | Heavier scrape, forces input | |
| Two separate entry points | Splits the unified grid | |

**User's choice + follow-up:** One entry, two modes — AND differentiate @handle as competitor vs own channel (own = lighter; deep "what to improve" report questioned → confirmed it lives in P10 Account Read).

| Option | Description | Selected |
|--------|-------------|----------|
| On-demand, ~20-30 tiles, cached per input/day | Balanced cost/latency/freshness | ✓ |
| Unbounded live pull | Cost/rate-limit risk | |
| Pre-warmed niche feeds | P10 infra | |

**User's choice:** On-demand, ~20-30 tiles, cached per (input, day) + per-user cap.

### apidojo follow-up (resolved live with web research)
Surfaced apidojo's lineup (`tiktok-scraper` all-in-one, `tiktok-profile-scraper`, `tiktok-user-scraper`). Owner leaned toward a split ("option 2 — best value"). Verified the profile-scraper paginates full history + 40+ fields + follower/following in one run, while the all-in-one is the keyword-search workhorse (600/sec). **Resolved: split — `apidojo/tiktok-scraper` for Discover search + competitor outlier pull; `apidojo/tiktok-profile-scraper` for P7 calibration + own-channel full history.** Both $0.30/1k, 98%.

---

## Claude's Discretion
- Outlier decay curve, niche-median computation details, tile-count tuning (within D-05/06/07 envelope).
- Provisional requirement IDs (DISC-*/REMIX-*/READ-* + AUD steer extensions) — planner formalizes.
- Pre-W0 hygiene: confirm `audience-regression-gate.test.ts` committed before W2 steer-closure gate.

## Deferred Ideas
- Comment seeding → backlog/P8.x
- Own-channel deep "what to improve" report → P10 Account Read
- Saved shelf / watchlists / standalone Discover feed → P10
- Pre-warmed niche feeds → P10 flywheel
- N>2 audience compare → future
- Live interactive persona cloud → P9 AudienceLens
- Social OAuth (#4), rich chat KC slice (#5), wins/flops enrichment (#6), RAG (#7) → v6.1+
- Not closed by P8: untracked regression test (#8), 43 tsc errors in tests (#9), coarse SSE (#11)
