# Design — Audience Simulation v2: generated persona populations (200–1000 reactors)

**Written:** 2026-07-15 · **Worktree:** `~/virtuna-explore-b` · **Branch:** `feat/per-persona-ideas-script`
**Status:** DESIGN LOCKED on the core architecture; a de-risking **spike** is the next step (no engine
changes yet). Nothing here is built into the product.

> This came out of the per-persona generation work (below). Shipping that forced the question:
> *if the audience is going to steer generation, is the audience even real?* The answer — no, not yet —
> is what this redesign is about. Read §1 for the why, §4 for the architecture, §6 for what's locked.

---

## 0 · TL;DR

- The calibrated audience today is **10 fixed archetypes, synthesized by one LLM call from the
  creator's OWN video engagement ratios. It captures ZERO real audience data.** (Evidence §3.)
- We want **200–1000 individual personas that react**, as a differentiator — but the honest lever for
  "accurate" is NOT persona count, it's real audience data + a feedback loop, neither of which exists.
- **Decision: go "generated, not measured."** One unified LLM generator produces a synthetic-but-rich,
  steerable population from *whatever context exists* (nothing → niche → creator content → real
  comments). Richer data = richer input to the same path, never a separate pipeline. `provenance`
  stamps how real each population is so the UI never oversells.
- **Efficiency:** generation happens ONCE at calibration (LLM-heavy is fine — amortized). A content
  test stays ~1 LLM call: characterize the content into named feature axes, then a cheap transparent
  scoring function reacts all N individuals. Virality (TikTok-algorithm amplification) layers on later.
- **Next:** a standalone spike (`scripts/`, zero production risk) that generates a population from
  sparse vs. rich context and prints a reaction distribution — to see if generated personas + cheap
  scoring actually feel real before we touch the engine.

---

## 1 · Why — the realization behind this

Prior work made the calibrated audience steer *generation* (not just ranking): the persona became a
structural ASSIGNMENT the writer names back. Measured per skill:

- **hooks** — blind judge 60% (#298/#299, shipped)
- **ideas** — blind judge 75% vs a 20.8% control, live-verified; **shipped this session** (uncommitted
  → now 3 commits on `feat/per-persona-ideas-script`)
- **script** — 6.7%, below chance; does NOT transfer; built but **dormant/unwired**

That work is real and stays. But it exposed the deeper problem: **the personas doing the reacting
aren't a reconstruction of the creator's real audience — and neither are the ones we generate FOR.**
Two honest limits surfaced:

1. **"75% measures differentiation, not efficacy or accuracy."** A blind judge can tell the 4 ideas
   were aimed at different segments. That is *not* evidence a real Deep Fan would engage more.
2. **The reaction receipt ("They stopped — '…'") is synthetic**, presented like a measurement. The
   honesty spine keeps us from *inventing beyond the SIM*, but it doesn't make the SIM's predictions
   *true*.

The owner's direction: stop pretending we can measure; **build the best generated simulation** — many
personas, efficient, steerable — and be honest it's simulation. Earn "accurate" later via a feedback
loop. This doc is that pivot.

## 2 · Competitive frame — Artificial Societies (societies.io, YC W25)

- Builds networks of **300–5,000+ interconnected AI personas** per "society," from a database of
  ~500k personas grounded in **individual-level** LinkedIn/X behavioral data. Personas **interact and
  influence each other** (reshare cascades → spread emerges). Claims validation (a study beating human
  experts + LLMs; partners cite "95% accuracy," self-reported/unaudited).
- **Their moat is the data + the validation loop — not the prompting.**
- **Our different wedge (don't copy them, be platform-correct):**
  1. **TikTok-algorithm-native virality.** TikTok spread is driven by the FYP recommender amplifying
     on early signals (watch-through, rewatch, share-rate), **not** a follower-graph reshare cascade.
     So our "propagation" = model the *algorithm's* amplification on aggregate early signals — a
     genuinely different simulation than AS runs.
  2. **Scrape + from-scratch / aspirational audiences.** Test an audience you *want* but don't have.
  3. **The calibration/honesty loop** — if/when we validate predicted-vs-actual, that's the moat.

## 3 · Current-state engine map (grounded, read-only survey 2026-07-15)

**THE TWO NUMBERS:**

- **(a) 1 LLM call per content test.** One Qwen call returns all 10 persona reactions; the batch path
  scores N candidates × 10 archetypes in a single call. Never one-call-per-persona.
  `src/lib/engine/flash/run-flash-text-mode.ts:100` (single), `:221` (batch); model `qwen3.7-plus`
  (`FLASH_MODEL`→`QWEN_REASONING_MODEL`, `qwen/client.ts:41`). `temp:0, seed:7, json_object`.
- **(b) Calibration captures NO real audience data.** The scrape (`clockworks/tiktok-profile-scraper`,
  `apify-provider.ts:28,398`) pulls the creator's OWN profile stats + own videos (aggregate engagement
  COUNTS, captions, subtitles) — **no comments, no commenter profiles, no follower attributes**
  (`scraping/types.ts:26-60`). The 10 personas + shares + `persona_weights` are **fabricated by one
  `qwen3.7-plus` synthesis call from the creator's own engagement RATIOS**
  (`enrich-signature.ts:151-169` SYNTH_SYSTEM, `:347-376`). "The Zach King scrape pulls Zach's videos,
  not his viewers." One-time bake ~$0.05–0.15, frozen on the row (`calibration.ts:222` `calibrateFromScrape`).

**Hard-coded invariants a redesign must break:**
- Every SIM result is Zod `.length(10)` (`flash-schema.ts:34`).
- `selectPersonaSlots` throws if slot count ≠ 10 (`persona-registry.ts:526`).
- Fixed 10-archetype taxonomy: `high_engager, saver, lurker, sharer, tough_crowd, purposeful_viewer,
  niche_deep_buyer, niche_deep_scout, loyalist, cross_niche_curiosity` (`persona-registry.ts:22-33`).

**Existing degradation ladder (reuse it):** personal scrape → thin (<10 videos, `calibration.ts:55`)
→ niche-search fallback (`clockworks/tiktok-scraper`) → honest General. Everything below is
creator-content-only; none of it is real audience data.

**Persona schema today (all archetype-aggregate, zero per-individual data):**
- `SignaturePersona` (`audience-types.ts:117`): `archetype, share, temperature, disposition,
  reaction_frame, evidence`. `FlashPersona` (`flash-schema.ts:23`): `archetype, verdict, quote`.
- `persona_weights` = 4 flat columns `fyp/niche/loyalist/cross_niche` (`database.types.ts:537-548`).

## 4 · Target architecture

### 4.1 One unified generator (the collapsed "ladder")

There is ONE creation path. It takes a **context bundle** — anywhere from *nothing* to *340 real
comments* — and always emits the full population in the schema. Data richness is just input richness;
real audience data (if ever added, e.g. comment scraping) enriches the *input*, never forks the code.

Runs **once at calibration** → LLM-heavy generation is affordable (amortized over every future test).

### 4.2 Two levels

- **Segments** (K ≈ 8–15): LLM-written, readable, weightable. Generalizes the current 10 archetypes
  (now creator-specific, not a fixed taxonomy). This is the "your groups" UI layer + the weighting.
- **Individuals** (N = 200–1000): **procedurally sampled** off each segment (centroid + per-individual
  jitter on numeric features; synthetic display name/bio). This is the reactor set → gives a real
  distribution + long tail, not one point per bucket. **DECISION (a):** LLM emits segments + variation,
  we expand; individuals are variations on a theme (cheaper, cleaner, keeps the readable layer) — vs.
  (b) LLM emits individuals directly (richer, flatter, pricier, mode-collapse risk).

### 4.3 Schema strawman (source-agnostic, provenance-first)

```ts
type Provenance = {
  source: 'scraped' | 'manual' | 'synthetic';
  realSampleSize?: number;   // scraped: N real people behind it
  scrapedAt?: string;
  confidence?: 'high' | 'medium' | 'low';
  createdBy?: string;        // manual
  basis?: string;            // synthetic: what context fed the generator
};

// MACHINE side — named + scored (auditable), NOT an opaque embedding. Content
// gets characterized into these SAME axes → reaction = cheap fn(persona, content).
type ReactionProfile = {
  interests: Record<string, number>; // topic → affinity 0..1 (sparse)
  hookSensitivity: number;           // opening strength it demands
  noveltyBias: number;               // trend-chaser ↔ comfort-watcher
  skepticism: number;                // distrust of claims/hype
  attentionSpan: number;             // patience for a slow build
};

// VIRALITY side — feeds TikTok-algorithm amplification
type BehaviorProfile = {
  watchThrough: number;      // completion — FYP's #1 signal
  sharePropensity: number;
  commentPropensity: number;
  savePropensity: number;
};

type Segment = {
  id: string; name: string; share: number; // Σ = 1
  blurb: string; whyFollows: string;
  provenance: Provenance;
  archetype?: Archetype;                     // optional bridge to legacy 10
  centroid: ReactionProfile & BehaviorProfile;
  variation?: unknown;                       // how members spread (spike will shape this)
};

type Persona = {                             // the reactor; display always synthetic (privacy)
  id: string; segmentId: string;
  displayName: string; bio: string;
  reaction: ReactionProfile;                 // centroid + jitter
  behavior: BehaviorProfile;
  provenance: Provenance;
  weight: number;                            // Σ over all individuals = 1
};

type AudiencePopulation = {
  audienceId: string;
  segments: Segment[];
  individuals: Persona[];
  provenance: Provenance;                    // population-level; mixed sources allowed
};
```

### 4.4 Reaction at test-time (cheap)

1. **One LLM call** characterizes the content candidate into the same named axes (topics it hits, how
   strong its hook is, its claims, its pacing).
2. **Cheap transparent scoring fn** reacts all N individuals: `fn(persona.reaction, content) → P(stop)`
   → verdict. O(N) arithmetic, no LLM.
3. Aggregate → overall distribution + per-segment split. A few OPTIONAL segment-level LLM calls for
   real verbatim quotes (or, when real comments exist, pull actual matching comments — honest).

### 4.5 Virality (later)

On top of the reaction distribution: sum behavioral propensities (watch-through, share, save) weighted
by share → the early signals the FYP cares about → a model of the algorithm's amplification decision
("does it get pushed past the follower base?"). NOT a follower-graph cascade. Deferred past v1.

### 4.6 Cold-start (no scrape / new profile) — DECISION: **populate, but loudly labeled**

New/failed/empty → the SAME generator runs on niche priors or the user's description (or manual
from-scratch). It always produces a population so the product demonstrates value immediately, but
`provenance` drives honest framing everywhere ("Based on a typical VFX audience — calibrate to make it
yours") + a one-click path to calibrate. (Alternative considered + rejected for v1: refuse-until-real.)

## 5 · Efficiency / cost sketch

- **Calibration (once/creator):** generator = a few batched LLM calls (segments, then per-segment
  detail). Cents, amortized. This is where the LLM budget goes.
- **Content test:** ~1 LLM call (content characterization) + O(N) arithmetic for N reactions + optional
  handful of quote calls. Scales 300→1000 for free (dot products). vs. today's 1 call/10 reactions.

## 6 · Decisions locked (this conversation)

1. **Generated, not measured.** Plausible + steerable synthetic audience; "accurate" earned later via
   a predicted-vs-actual feedback loop. `provenance` keeps it honest.
2. **One unified generator**, context-bundle in → population out. No per-data-source branching.
3. **Two levels — (a):** LLM writes segments + variation; individuals sampled procedurally.
4. **Named/scored features, not embeddings** (auditable — fits the honesty spine). Embedding optional later.
5. **Persist segments; deterministically (seeded) sample individuals.** Stable, light, never stale.
6. **~8–15 segments, N=300 to start** (bump to 1000 later; reaction math is O(N)).
7. **Cold-start: populate-but-labeled.**
8. **Privacy hard rule:** real people only ever back a segment in aggregate; individual display names
   are always synthetic. We never show a real commenter reacting to unpublished content.

## 7 · Open / deferred

- **The feedback loop** (predicted vs. actual after posting) — the only thing that earns "accurate."
  Not designed yet; highest future leverage.
- **Real-data scrape (Track A)** — comment/commenter scraping to enrich the generator's input. Deferred;
  becomes richer *input*, not a new path. (Honest ceiling: commenters = the engaged slice, misses lurkers.)
- **Virality layer** (§4.5) design.
- **Manual from-scratch builder** — first-class UI vs. cold-start fallback? (owner call, deferred.)
- **Engine migration** — breaking `.length(10)`, `selectPersonaSlots`, the fixed taxonomy, the frozen
  `signature`; back-compat (today's 10-archetype signature → 10 segments + synthesized individuals).
- **The variation model** (`Segment.variation`) — how members spread around a centroid; the spike shapes it.
- **Content-characterization axes** must match `ReactionProfile` axes exactly — co-design them in the spike.

## 8 · The spike (next step — no production changes)

Standalone `scripts/` script (mirrors `scripts/measure-targeting.ts`). Validates the two riskiest
assumptions by LOOKING at output:

1. **Generate** a population from two contexts — sparse (*"brand-new magic creator, no scrape"*) and
   rich (*Zach King content*) — 1 LLM call each → 8–15 segments + variation → sample ~300 individuals.
2. **React** to 2–3 test hooks/ideas: 1 LLM call characterizes each → cheap scorer runs all 300 →
   print overall + per-segment distribution + a sample of individuals with verdicts.

**Passes if:** sparse-input generation yields a varied, plausible audience (not mush) AND cheap
feature-scoring yields a believable, *differentiated* distribution across content. If yes → design the
engine integration. If no → we learned it for the cost of one script.

## 9 · Relationship to the in-flight branch

`feat/per-persona-ideas-script` (3 commits, NOT pushed): the shipped **ideas targeting** is
representation-agnostic — "assign generation to a segment, name it back" rides on top of ANY audience
model, so it re-bases onto this cleanly. What this redesign eventually replaces is the fixed
10-archetype *selection* (`select-persona-targets`) and the SIM's `.length(10)` contract. Nothing here
blocks merging the ideas work; nothing there blocks this.
