# v6.0 EXPANSION BRIEF — *Discover · Sell · Sharpen* (Phases 11–16)

> **⚠️ CORRECTED 2026-06-19 — this body is the early draft; the CANONICAL phase shapes now live in
> `ROADMAP.md` + `REQUIREMENTS.md`.** A first pass mislabeled the Sandcastles track. The authoritative
> structure (per `research/sandcastles-adopt-improve.md §PROPOSED PHASE STRUCTURE`) is **6 phases, 11–16**:
>
> | v6.0 # | Phase | This doc's stale section |
> |---|---|---|
> | **11** | **Explore (Audience-Curated Discovery)** — a SKILL in-thread, NOT a feed; cards carry ambient reaction | "P1 Living Research Feed" (superseded framing) |
> | **12** | **Library & Acts/State IA** — 4-item nav; extends P10 shelf; + Audience-surface edits | "P2 Creator-Persona+ & Workspace" |
> | **13** | **Proactive Numen (Ambient + Initiated)** — ambient reaction on every card + proactive drops *(was MISSING)* | — (new) |
> | **14** | **KC Grounding & Quality-Loop** | "P3" |
> | **15** | **Marketing Intent (mode-switch)** | "P4" |
> | **16** | **Commerce Skills** | "P5" |
>
> **Status: folded INTO v6.0 (owner decision — extend, NOT a new milestone).** No new worktree, no
> `/gsd-new-milestone`; continue on `milestone/numen-tools`. The debt→phase map below is still valid
> (re-key FEED→EXPLORE, WORK→IA/LIB/AUD-EDIT, and add AMBIENT/PROACTIVE for P13). Each phase needs a
> `/gsd-discuss-phase` pass.

---

## Why this milestone

v6.0 built the **studio** (generate → SIM-1 test → the Read) + the **flywheel** (post → measure →
recalibrate). This milestone extends the moat in three directions the competitor audit + commerce
discussion surfaced, and pays down every piece of deferred debt so nothing rots:

1. **Discover** — a persistent research surface that beats Sandcastles/Blort (they stop at "here's a
   script"; we score outliers *relative to your audience* + Read every node).
2. **Sell** — open the TAM from B2C creators to anyone who monetizes content (sellers, brands, e-com,
   TikTok Shop, affiliates) **without forking a marketing app** — the audience is the mode-switch.
3. **Sharpen** — the KC Grounding & Quality-Loop levers: move generation from "good prose-craft" (caps
   ~20–30% over raw LLM) to "structurally can't be copied" (real-exemplar RAG + generate→critique→regenerate
   + flop-prediction + SIM-rank verification). This is the durable moat.

**Hard inheritance from v6.0 (non-negotiable):** honesty spine (never fabricate a score / ungraded-as-graded),
Qwen-only pipeline, fixed typed-renderer UI (no generative UI), flat-warm THEME-06, engine OPEN but
regression-gated (suite green + same-video Max score-identity + `ENGINE_VERSION` bump only on deliberate
reviewed scoring change). The **General audience** stays the default + regression anchor.

---

## Locked Phases

> Sequencing has one real open question (see ⚠️ on P3) — resolve in `/gsd-roadmapper`.

### Phase 1 — Living Research Feed *(was Sandcastles "P11")*
**Goal:** a persistent, daily-habit research surface. Adopt Sandcastles' whole Research surface
(watchlists + niche feed + auto-explore agents); **improve** it by scoring every outlier *relative to
the active calibrated audience* and offering an inline Read at every node — "they tell you it went viral;
we tell you if it'll land for *your* people."
- Persistent **watchlist** (profiles + niches/keywords the creator tracks) + auto-explore.
- Outlier grid reuses v6.0 P8 Discover (apidojo actor + outlier-score compute already shipped) — this
  phase adds **persistence + audience-relative scoring + inline Read per node**, not a new scraper.
- **Comment seeding** (deferred from v6.0 P8 D-04) lands here.
- Tile CTA stays "Remix → Read" (our chain), never "rewrite for me" (their dead end).
- **Moat verdict (decisive):** competitors model the CREATOR + borrow proof from outliers; they NEVER
  model the audience and NEVER validate output. We have both layers they structurally lack.
- **Depends on:** v6.0 P8 (Discover grid + outlier-score), P7 (Audience object). ⚠️ Benefits heavily
  from P3 lever #1 (real-exemplar RAG) — may want P3 first or parallel.

### Phase 2 — Creator-Persona+ & Workspace *(was Sandcastles "P12")*
**Goal:** match Sandcastles' persona depth + org primitive, **layering** on what we already have.
- **Field-level legibility** — surface *which* profile/audience field drove each output (counters their
  "robotic/generic" reviewer weakness; extends GROUND-03's "why" line to be field-traceable).
- **Projects / Collections** org — **merge-or-LAYER on the v6.0 P10 Saved shelf, do NOT double-build.**
  Saved shelf is the flat store; Collections is the grouping view over it.
- **⚠️ Writing-voice sample (N1) ALREADY SHIPPED** (merged `d2f121e7`: `writing_voice_sample` col +
  `voice` role/formatter + MODE_ROLES + 10th profile card). This phase **surfaces/extends** it (field
  legibility, per-skill voice toggle) — it does NOT rebuild voice capture.
- **Folds in P7 deferred debt:** persona editing, **multi-select audience compare** (the KILLER feature —
  retention vs growth side-by-side; object already `audience_ids[]`-ready), and confirm **persona
  value-tuning** (verify v6.0 P8 W0 removed the `[ASSUMED]` placeholder markers).
- **Folds in PROFILE tier-C debt:** compact onboarding redesign (shorten the 9-card) + link-social →
  Apify metadata prefill.
- **Depends on:** P10 Saved shelf, P7 Audience object.

### Phase 3 — KC Grounding & Quality-Loop *(the levers — THE durable moat)*
**Goal:** move generation from *discipline* (prose-craft, mostly done in v6.0 P2 corpus) to *rightness*
(real data + executed self-rejection). Source: `.planning/research/kc-improvement-levers.md`.
Sequence by impact×cost:
- **#2 Live profile grounding** — assembler arg exists (v6.0 02-02) but the quality gate must test
  *with* real profile + exemplars, not cold-start. (Cold-start number is misleadingly pessimistic.)
- **#3 Generate → critique → regenerate loop** — execute the Value Bar: over-generate, score each
  (mechanism? non-fakeable concrete? fit? not reckless? not trope?), kill failures, regenerate.
  Best-of-N w/ rubric beats v6.0's current one-pass.
- **#1 Real-exemplar retrieval (RAG)** — inject 2–3 *actual recent high-performers* in the creator's
  niche. Raw LLM can't know what went viral this week. (= the same moat Sandcastles leans on; pgvector
  cols already exist unused.) Includes **N2 cited-research pass** (topical-fact research pre-script).
- **#6 "Will this flop?" adversarial pass** — predict each item's failure mode for *this* audience.
- **#9 SIM-rank verification loop** — generate→render→simulate→rank+why; the foresight product centerpiece
  (already partially live as the Ideas/Hooks Flash gate — formalize + extend).
- **#10 SIM niche-blind fix** — text Flash path uses generic equal-weighted personas; the rich
  `persona-registry` engine is unused on the text path (wiring + threshold job, NOT corpus).
- **#4/#5 runtime enforcement** — per-niche trope-injection + specificity auto-reject (corpus floor done
  in v6.0 P2; runtime enforcement is the future work).
- **#7 voice calibration** — extends the already-shipped N1 voice sample.
- **⚠️ SEQUENCING:** levers #1/#2 underpin P1 Living Research Feed (audience-relative exemplars). The
  roadmapper should decide whether P3 precedes or runs parallel to P1. Likely **P3 lever #1 lands before
  or with P1.**
- **Engine note:** all of this is grounding/pipeline/data — keep the regression gate green; bump
  `ENGINE_VERSION` only if Max video-scoring output deliberately changes (most of this is the text path).

### Phase 4 — Marketing Intent (mode-switch) *(was Commerce "Phase A")*
**Goal:** make the *existing* skills (Test / Ideas / Hooks / Script) commerce-capable with **no audience
duplication** — a per-run **intent** control in the composer.
- **Intent control** beside the skill chip + audience picker; defaults from the active audience's
  `goal_intent`, overridable per run (one audience, switch intent → test an idea then an ad, no clone).
- **Intent-conditioned reaction frame** injected into the persona simulation. **De-risk before planning:**
  there are TWO injection points and they differ — the video sim (`runWave3` persona prompt) and the
  text-skill runner path. Confirm both first; this is the only real technical unknown.
- **Buyer-reaction output block** (`would_buy`, `objection`, `price_reaction`) alongside existing cards.
- **Locked design:** intent does **NOT** change population weights or engine mechanics — only (1) the
  per-persona reaction frame, (2) the output "why" vocabulary, (3) the scoring objective. Same person,
  different question → content/prompt-layer change, NOT an engine refactor.
- **Already scaffolded (de-risks build):** `audiences.goal_intent` enum has `"sell"` and is plumbed
  (`goal-intent.ts` GOAL_INTENT_BIAS); `audiences.type = "target"` already models "a market I sell to";
  every skill is audience-aware (steer-everywhere closed in v6.0 P8 W2 — verified).
- **Depends on:** P7 (Audience object + `goal_intent`).

### Phase 5 — Commerce Skills *(was Commerce "Phase B")*
**Goal:** two net-new skills with no creator analog, both consuming P4's buyer-reaction frame; follow the
existing skill triad (route + runner + view + block).
- **Offer / Product Validation** — test the *proposition itself* (concept, price, positioning) against
  the buyer audience *before any content exists*: would-buy %, ranked objections, price sensitivity.
  (text path)
- **Ad Creative** — pre-flight ad creative against the buyer audience: stop-scroll + purchase intent +
  objection-surfaced, ROAS-framed. (likely rides the video/sim path)
- **Brand-profile entity** (brands as a separate buyer) + in-thread monetization affordances land here.
- **Competitive proof:** "Augmented Society" (flat format-picker over canned Societies) shut down 15 Feb —
  breadth-of-format-wrappers without an owned audience + chain + flywheel didn't hold. Don't trade the moat
  for breadth.
- **Depends on:** P4 (buyer-reaction frame + intent infra).

---

## Pre-Launch Hardening *(cross-cutting gate, not a phase — run before any public traffic)*
- **Rate-limiting per tool** — constants are RESERVED-NOT-WIRED (`src/app/api/tools/hooks/route.ts`:
  `void RATE_LIMIT_WINDOW_SECS`). Wire the limiter across all tool routes before launch traffic.
- Re-run the full engine regression gate + honesty-spine checks at milestone close.

---

## Explicitly Deferred (rails laid / usage-gated — keep as seeds, do NOT build this milestone)
- **FLYWHEEL-05 cross-creator prior-fitting mechanism** — reconciliation logging ships in v6.0; the
  aggregated prior-fitting that sharpens base persona priors is intentionally deferred until enough
  privacy-safe data accumulates. (Lever #8 = the compounding flywheel; rails are in, mechanism waits.)
- **Spread / virality prediction in the Read** (P7 deferred).
- **Real social OAuth** (P7 deferred — Apify scrape suffices v1; no Connectors).
- **Script Diagnose mode** (paste existing script → line-edits + drop-point) + **remix-your-own-winner**
  deep dive (skills depth — fold into P5 or backlog).
- **RAG over the creator's OWN scraped history** (subset of lever #1, usage-gated until history accumulates).
- **Desktop-dense layout.**

## Verify-Don't-Rebuild (debt v6.0 likely already closed — confirm, don't re-lock)
- **Steer-everywhere** — VERIFIED closed (v6.0 P8 W2; all runners audience-aware: chat/ideas/hooks/script/remix).
- **Persona value-tuning** — v6.0 P8 W0 claimed to close the `[ASSUMED]` placeholders; confirm markers gone.
- **Test concept/script text pre-flight** — v6.0 P8 multi-audience concept Read likely covers this; confirm.
- **Reload-rehydration** (v6.0 P3 debt) — closed in P4 (open-thread dedup root-cause fix).

---

## Debt → Phase map (nothing lost)

| Debt / want | Source | Lands in |
|---|---|---|
| Living Research Feed (watchlist + auto-explore) | Sandcastles audit | **P1** |
| Comment seeding | v6.0 P8 D-04 deferred | **P1** |
| Field-level legibility | Sandcastles reviewer weakness | **P2** |
| Projects/Collections (layer on Saved shelf) | Sandcastles org primitive | **P2** |
| Multi-select audience compare (KILLER) | P7 deferred | **P2** |
| Persona editing | P7 deferred | **P2** |
| Compact onboarding + link-social prefill (PROFILE tier C) | REQ backlog | **P2** |
| KC levers #1/#2/#3/#6/#9/#10, #4/#5 runtime, #7 | kc-improvement-levers.md | **P3** |
| N2 cited-research pass | Sandcastles N-track | **P3** |
| Marketing intent mode-switch + buyer block | Commerce track A | **P4** |
| Offer Validation + Ad Creative skills | Commerce track B | **P5** |
| Brand-profile entity + in-thread monetization | REQ backlog | **P5** |
| Rate-limiting per tool | reserved-not-wired | **Pre-launch gate** |
| Cross-creator prior (FLYWHEEL-05) | v6.0 by-design defer | **Deferred seed** |
| Virality prediction / social OAuth / Script Diagnose / own-history RAG / desktop-dense | P7 + backlog | **Deferred** |

---

## How to continue (in-milestone — no new worktree)
1. **Resolve sequencing:** does P14 (KC Grounding, esp. lever #1 RAG + #2 profile grounding) precede or
   run parallel to P11 (Explore needs audience-relative exemplars)? Decide in roadmap. Also: P13 ambient
   EXTENDS P9's shipped reaction primitive — confirm the reuse seam.
2. **Discuss the first expansion phase:** `/gsd-discuss-phase 11` (Explore, the flagship) **or** `/gsd-discuss-phase 14` (levers-first).
3. **Wire the tracked P10 follow-up** (FLYWHEEL-02 `pinPredictedSignature` into each runner) — belongs with KCQ-05 (P14 SIM-rank loop).
4. **Pre-launch:** HARDEN-01 rate-limiting before any public traffic.

> Canonical phase list = ROADMAP.md (Phases 11–16). The old loose "Sandcastles P13" placeholder is
> dropped; the early "Living Research Feed / Persona+ Workspace" framing in this doc's body is superseded
> by Explore-as-skill / Library-IA / Proactive-ambient.
