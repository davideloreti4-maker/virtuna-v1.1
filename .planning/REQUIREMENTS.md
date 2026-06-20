# Requirements — v6.0 Numen Studio

> **Scope skeleton, not a locked spec.** The discuss input (`NUMEN-TOOLS-VISION.md`)
> is EXPLORATORY. These requirements fix *what* v1 delivers; the *HOW* (Knowledge-Core
> schema, persona framings, tool modes, copy) is deliberately resolved **per-phase in
> discuss** — walk every section.

**Milestone goal:** Open Numen from a single-video analyzer into a creator **studio** —
generation tools (Ideas → Hooks) where **every output is tested on a synthetic
audience (SIM-1) before the creator acts** — plus general open chat. Generation is the
surface; **SIM-1-on-everything is the moat.** Builds on the v5.0 Reading surface and
reuses its typed-block renderers.

---

## v1 Requirements

> **Spike gate dropped (2026-06-16).** The two de-risk bets are resolved by owner
> domain experience, not a gate phase: (1) text-only SIM-1 Flash predicts relative
> pull and improves with the right data/context/framing — the winning framing is
> discovered *inside* ENGINE-01, not as a precondition; (2) the Knowledge-Core moves
> to a general-use generative core unconditionally (no "validate then maybe rebuild").
> ENGINE-02 / IDEAS-02 / HOOKS-02 are therefore unconditional.

### ENGINE — SIM-1 text-mode + self-judge

- [x] **ENGINE-01**: SIM-1 Flash text-mode — the 10 archetypes react to *text* input (no video), returning per-persona reactions + an aggregate pull score, with mode-specific framing (Hook = "scrolling, first 2s, do you stop?"; Idea = "in your niche, would this make you stop/share?"). The winning persona framing (right data + context + minimal grounding for text discrimination) is calibrated here and documented as the inline-scoring spec.
- [x] **ENGINE-02**: SIM-1 self-judge quality gate — generations are Flash-scored and weak outputs regenerate/filter before the user sees them; regeneration is **bounded** (cost).
- [x] **ENGINE-03**: Honest Flash/Max framing — Flash surfaced as *concept ceiling* ("worth shooting?"), Max as *realized result*; never a fabricated score, never a view-count promise Flash can't back.

### GROUND — Knowledge-Core generative rebuild (THE value, the long pole)

- [x] **GROUND-01**: Knowledge-Core restructured for generation — a **committed** ground-up rebuild into a general-use generative core (shared generative base + per-mode slices: Ideas, Hooks, chat), authored fresh; **not** retrofitted from the scoring core or the stale `training-data.json`. Content/curation workstream first, code second.
- [x] **GROUND-02**: Per-mode grounding assembly — each tool assembles a tight curated context slice (niche + relevant craft frame + the specific input), not the whole profile/KC (avoids signal dilution).
- [x] **GROUND-03**: Grounding legible in UI — outputs surface *why* they were made ("because your audience is 18–25 gym beginners and your last 3 myth-busting videos overperformed").

### THREAD — model generalization, runner, rendering, chat

- [x] **THREAD-01**: Generalized thread data model — nullable `reading_id` + a `type` discriminator (grounded vs open thread); migration + types.
- [x] **THREAD-02**: Composer = universal door — routes input to Test (URL/upload) vs a generator/chat (prompt).
- [x] **THREAD-03**: Open chat thread — profile-grounded general chat with no anchoring Reading (markdown messages). *(sequenced last; only as good as GROUND-01 — gated behind KC quality)*
- [x] **THREAD-04**: Typed-block rendering — messages render as markdown OR typed blocks via the **fixed** numen-rework renderer library; **no** model-generated UI.
- [x] **THREAD-05**: Chain CTAs — outputs carry in-thread chain CTAs ("Develop this →", "Test full →") that move between tools.
- [x] **THREAD-06**: Tool-runner abstraction — each tool = `{promptTemplate, knowledgeBundle, outputSchema, renderer}`; structured output → typed renderer, no schema → markdown. Ideas/Hooks/chat run through it so Scripts/Remix slot in later without one-off code.
- [x] **THREAD-07**: Message/block persistence — a thread's messages + typed blocks persist and re-hydrate on reload.

### IDEAS — funnel-top generator

- [x] **IDEAS-01**: Generate ideas — idea cards (title · angle · *why it fits you*) from the creator profile (Auto) or a seeded topic/angle.
- [x] **IDEAS-02**: Inline Flash viability hint — each card shows a SIM-1 Flash viability score; **content-first, score streams in** (never blocks content render). *(shipped P3 — content-first SSE band/fraction streams after card-face)*
- [x] **IDEAS-03**: Chain to Hooks — "Develop this →" carries an idea into Hooks. *(shipped P3/P4 — POST /api/tools/ideas/develop → real hook generation)*

### HOOKS — flagship moat demo

- [x] **HOOKS-01**: Generate hooks — N hook cards from an idea or a topic, each tagged with the archetype it grabs.
- [x] **HOOKS-02**: Flash pull-score ranking — hook cards ranked by a SIM-1 Flash pull-score ("who'll actually stop scrolling," first-2s framing).
- [x] **HOOKS-03**: Chain to Test — "Test full →" carries a hook into Test (the full Reading).

### PROFILE — grounding source (v1: reuse existing)

- [x] **PROFILE-01**: Tools ground on the existing `creator_profiles` (9-card) + cold-start → platform baselines + graceful degradation when the profile is thin. *(compact-onboarding redesign + link-social prefill deferred to v6.1)*

### TEST — the chain endpoint

- [x] **TEST-01**: Test reframe — the existing Reading is reframed as "Test · powered by SIM-1 Max," reachable as the landing point of every chain; the video path is unchanged (regression-gated). *(completed 05-02)*

### STUDIO — conversation layer (P5, owner expansion 2026-06-18)

> Makes the studio feel like ONE conversation. All three live in the single open thread per user with full running context. See `phases/05-open-chat-test-reframe/05-CONTEXT.md`.

- [x] **STUDIO-01**: Progress affordance — when a skill runs, real pipeline stages stream over SSE as Perplexity-style checkmarks (Generating → Self-judge → Simulating your audience → Ranking); no fake timers (honesty spine). Cards then stream content-first. *(completed 05-04)*
- [x] **STUDIO-02**: Cards embedded in chat + model-authored follow-up turn after cards (D-03); chat-to-refine (scoped re-run → new SIM-scored card) lands in 05-05. *(progress-checklist + follow-up turn completed 05-04; refine in 05-05)*
- [x] **STUDIO-03**: Generic skill-to-skill chain plumbing — CHAIN_HANDOFFS registry (chain-handoff.ts) is the SSOT; P6 Script/Remix plug in by appending, no one-off wiring. *(completed 05-04)*

### SCRIPT / REMIX — chain skills (P6, un-deferred from v6.1 2026-06-18)

- [x] **SCRIPT-01**: Script tool — from a chosen hook/idea → a script card (beats + timing + per-beat retention markers), content-first with a Flash viability beat + self-judge gate, sitting hooks→script→test, landing on "Test full →". (Diagnose mode — paste existing script → line-edits + drop-point — may follow.)
- [x] **REMIX-01**: Remix tool — an alternate funnel-top entry: paste a trending/competitor URL or pick the creator's own winner → decode *why it worked* → generate *their* niche/voice version (new hook + script angle) → Flash score → feed the Hooks/Test chain. **Preceded by a reuse scout** of `milestone/viral-remix` (Ingestion + Remix Mode COMPLETE) + `viral-remix-adapt` + `src/app/api/remix/adapt/` — revive, don't rebuild.

### LIVE — Living Audience (AudienceLens, P9)

- [x] **LIVE-01**: reaction replay (segment-by-segment on the video Test timeline via HeatmapPayload.personas[].attentions[]; staggered cascade elsewhere — D-06).
- [x] **LIVE-02**: node drill-down (tap dot → archetype + verbatim reaction to this concept).
- [x] **LIVE-03**: chat-with-persona (in-voice, grounded via chat-runner extension; sub-thread persisted within the Read).
- [x] **LIVE-04**: segment clustering (Temp × Disposition lens via buildSegmentGroups).
- [x] **LIVE-05**: Population·1,000 (deterministic mulberry32 swarm + live counters + cascade + archetype breakdown — D-02, zero model calls).
- [x] **LIVE-06**: AudienceLens retrofit (one reusable Lens across all 6 skills, degrade by feature — D-04).
- [x] **LIVE-07**: Rewrite-for-audience loop (lever-as-steering via CHAIN_HANDOFFS → new card + Read showing delta — D-05).

### SELF — Account Read (know thyself, P10)

> "A Read on your own account" — the companion to Discover's "know thy competitor." Reuses Apify personal-scrape + the fixed `reading/` renderers. See `phases/10-.../10-CONTEXT.md` D-08.

- [x] **SELF-01**: Account Read generation — from the creator's own Apify personal-scrape + analysis/history, generate a standing "Read on your own account" surfacing recurring hook/format patterns, drop-points, and what's-working-vs-what-to-fix. Reuses Apify scrape — **not** new Connectors/OAuth.
- [x] **SELF-02**: Account Read render + savable — a thread card reusing the **fixed** `reading/` components (an Act whose output is State, savable to the shelf); honest thin-history fallback when own history is empty/thin (**never fabricate**).
- [x] **SELF-03**: Accuracy track record — a trust-building "within X% on your last N" stat sourced from accumulated reconciliations; honest empty state ("not enough posted outcomes yet") when the track record is empty.

### SAVE — Saved shelf (lean, flat, P10)

> Flat connective tissue across skills; P12-Library-extendable. Flat guard: **NO folders/tags/CMS**. See D-07.

- [x] **SAVE-01**: Typed saved-items store — a flat, typed `saved_items` table (Read / idea / hook / script / outlier / format), P12-extendable; no folders/tags/CMS.
- [x] **SAVE-02**: Shelf surface + thread↔shelf wiring — a flat Saved surface (own nav item) where every thread output is savable and every shelf item is actionable back into a thread (Acts/State IA).

### FLYWHEEL — recalibration loop (the moat, P10)

> The per-creator learning loop that error-corrects the Audience object against real post outcomes: predict → post → measure → reconcile → correct → compound. FULLY SPECIFIED in D-02..D-06. Must preserve determinism + the regression gate + human-in-the-loop (no silent scoring mutation).

- [x] **FLYWHEEL-01**: Outcome capture — paste posted URL → Apify scrapes public metrics + optional creator-supplied private signals (saves / retention / link-clicks); honest public-vs-creator-supplied (D-04).
- [x] **FLYWHEEL-02**: Predicted vs realized SIGNATURES — pin the SIM-predicted engagement signature (6-disposition vector) at run; map the real outcome onto the same dispositions. Compare **signatures, not score-vs-views** (D-02). **Pin now WIRED** (2026-06-19, commit `7ae00c2f`): ideas/hooks/script/remix runners call `pinPredictedSignature` post-SIM (was dormant — fn existed but no caller); the paste-URL → reconcile loop fires end-to-end.
- [x] **FLYWHEEL-03**: Calibration-vs-craft reconciliation — a deterministic reconcile classifies divergence as **calibration-error** (audience MIX → Audience object) vs **craft-error** (content under/over-delivered → creator as Account-Read guidance, **never** mutates the model) (D-03).
- [x] **FLYWHEEL-04**: Confidence-gated recalibration — propose a PersonaWeights recalibration only after ≥N consistent posts → honest PROPOSE nudge → **creator confirms** → write through P7's `analysis_override` slot. No single-post mutation, no silent auto-recalibration; `ENGINE_VERSION` untouched; General-audience baseline unchanged (regression anchor) (D-05).
- [x] **FLYWHEEL-05**: Reconciliation logging (cross-creator SEED) — log structured reconciliation data so aggregated, privacy-safe patterns can later sharpen base persona priors; the prior-fitting mechanism is **deferred** (lay rails, don't fake) (D-06).
- [x] **FLYWHEEL-06**: Drift trigger — scheduled re-scrape of the creator's own account; when audience composition diverges, route into the **same** propose→confirm recalibration path (folded into FLYWHEEL-04, not a separate mechanism) (D-06 / D-01).

---

## Expansion Phases 11–16 (added 2026-06-19; corrected to the authoritative Sandcastles shape — owner folded the Sandcastles + KC-quality + Commerce tracks into v6.0; NOT yet discussed)

> Full scope + debt→phase map: `.planning/NEXT-MILESTONE-VISION.md`. Authoritative Sandcastles phase shape: `research/sandcastles-adopt-improve.md §PROPOSED PHASE STRUCTURE` (it SUPERSEDES the early "Living Research Feed / Collections" framing). All inherit the cross-cutting constraints below. Each phase still needs a `/gsd-discuss-phase` pass.

### EXPLORE — Explore (Audience-Curated Discovery) (P11)

> THE flagship adopt: discovery as an in-thread SKILL, NOT a feed surface. The "separate Feed" framing is explicitly superseded — the SIM lets the *audience* curate.

- [x] **EXPLORE-01**: Explore skill in-thread — audience-curated outlier/competitor discovery; customizable params (the audience-on-tap control + serendipity valve); reuses P8 apidojo Discover + outlier-score.
- [x] **EXPLORE-02**: Each result card carries an **ambient audience reaction** + lands on a Read; tile CTA "Remix → Read" (our chain, never "rewrite for me").
- [x] **EXPLORE-03**: Audience-relative outlier scoring — relative to YOUR audience, not generic source-channel view-count.
- [x] **EXPLORE-04**: Start-screen set-actions — audience-aware quick-actions so a blank thread is never intimidating ("Top performers in my niche today", "What are my competitors shipping").
- [x] **EXPLORE-05**: Tracked-accounts/watchlist as input State — lives in Library (P12); click a tracked account → "Explore its outliers" fires in-thread.
- [ ] **EXPLORE-06**: Comment seeding — deferred from P8 D-04; lands here.

### IA / LIB / AUD-EDIT — Library & Acts/State IA (P12)

> The State home + nav collapse. **Acts** (generate/explore/test/refine/chat) → the thread; **State** (watchlist, saved work, audience, settings) → surfaces; wired together.

- [ ] **IA-01**: 4-item nav collapse — **Thread · Audience · Library · Settings** (from Sandcastles' 11 sections).
- [ ] **LIB-01**: Library = saved nouns (Reads/ideas/hooks/scripts), sectioned — **EXTENDS** the P10 flat `saved_items` store (built P12-extendable on purpose, D-07); **NOT** a second store / no rework.
- [ ] **LIB-02**: Tracked accounts/watchlist live in Library (the State home for Explore's inputs).
- [ ] **LIB-03**: Surface↔thread wiring — every surface item actionable INTO the thread; every thread output savable TO a surface.
- [ ] **AUD-EDIT-01**: Persona editing (P7 deferred, pulled in) — on the Audience surface.
- [ ] **AUD-EDIT-02**: Multi-select audience compare — the KILLER feature: retention-vs-growth side-by-side; object already `audience_ids[]`-ready (P7 deferred, pulled in).
- [ ] **AUD-EDIT-03**: Compact onboarding redesign — shorten the 9-card (PROFILE tier-C).
- [ ] **AUD-EDIT-04**: Link-social → Apify metadata prefill (PROFILE tier-C).
- *(Voice-sample N1 ALREADY SHIPPED — merge `d2f121e7`; surface/extend on the Audience surface, do NOT rebuild. Confirm P8 W0 removed persona-value `[ASSUMED]` markers.)*

### AMBIENT / PROACTIVE — Proactive Numen (Ambient + Initiated) (P13 — the "ambient audience system")

> Thread alive even when not typing = daily-habit engine, in-conversation, no dashboard. ⚠️ EXTEND P9's shipped reaction primitive (persona-cloud Lens + chat-with-persona) — do NOT duplicate.

- [ ] **AMBIENT-01**: Ambient audience reaction on EVERY skill card — Ideas/Hooks/Script/Remix/Explore results carry a lightweight inline audience reaction (always felt, not summoned), reusing P9's primitive.
- [ ] **PROACTIVE-01**: Proactive morning drops — Numen INITIATES ("3 things stirring your people would bite on").
- [ ] **PROACTIVE-02**: Scheduled Explore (their Automations equivalent) — recurring audience-curated discovery delivered into the thread.
- *(Honesty spine: never fabricate a reaction; degrade gracefully when thin.)*

### KCQ — KC Grounding & Quality-Loop (P14, the durable moat — `kc-improvement-levers.md`)

- [x] **KCQ-01**: Live-profile grounding (#2) — gate must test *with* real profile + exemplars, not cold-start.
- [x] **KCQ-02**: Generate→critique→regenerate (#3) — best-of-N w/ rubric, replacing the current one-pass gate.
- [ ] **KCQ-03**: Real-exemplar RAG (#1) — inject 2–3 actual recent niche high-performers; pgvector cols exist unused. Includes the **N2 cited-research pass** (topical-fact research pre-script).
- [x] **KCQ-04**: "Will this flop?" adversarial pass (#6) — predict each item's failure mode for *this* audience.
- [x] **KCQ-05**: SIM-rank verification loop (#9) — generate→render→simulate→rank+why; the foresight centerpiece (formalize/extend the existing Flash gate).
- [x] **KCQ-06**: SIM niche-blind fix (#10) — wire the rich `persona-registry` into the text Flash path (currently generic equal-weighted).
- [x] **KCQ-07**: Runtime trope-injection + specificity auto-reject (#4/#5) — corpus floor done in P2; runtime enforcement here.
- [x] **KCQ-08**: Voice calibration (#7) — extends the shipped N1 voice sample.
- [x] **KCQ-09**: Field-level legibility — surface *which* profile/audience/KC field drove each output (extends GROUND-03; counters the "robotic/generic" competitor weakness). *(Thin surface shipped in 14-04: inline "Made for you — {whyItFits}" rationale on the idea card, D-04. Full field-level legibility surface deferred to P12 IA.)*

### INTENT / REACT / BLOCK — Marketing Intent mode-switch (P15)

- [ ] **INTENT-01**: Composer intent control — grow⇄sell, default from audience `goal_intent`, per-run override (no audience cloning).
- [ ] **REACT-01**: Intent-conditioned reaction-frame injection at BOTH points — `runWave3` video sim + the text-skill runner (**de-risk: confirm both before planning; they differ**). NOT an engine refactor — population weights/mechanics unchanged.
- [ ] **BLOCK-01**: Buyer-reaction output block — `would_buy` / `objection` / `price_reaction`, alongside existing cards.

### OFFER / ADCREATIVE / COMMERCE — Commerce Skills (P16)

- [ ] **OFFER-01**: Offer/Product Validation — test the proposition (concept, price, positioning) against the buyer audience *before any content exists*: would-buy %, ranked objections, price sensitivity (text path).
- [ ] **ADCREATIVE-01**: Ad Creative pre-flight — stop-scroll + purchase intent + objection-surfaced, ROAS-framed (video/sim path).
- [ ] **COMMERCE-01**: Brand-profile entity (brands as a separate buyer) + in-thread monetization affordances.

### HARDEN — Pre-launch gate (cross-cutting, before public traffic)

- [ ] **HARDEN-01**: Wire rate-limiting per tool — constants RESERVED-NOT-WIRED (`src/app/api/tools/hooks/route.ts`: `void RATE_LIMIT_WINDOW_SECS`). Re-run full engine regression gate + honesty-spine checks at milestone close.

### Cross-cutting & infra debt (surfaced from transcript + memory sweep 2026-06-19 — owner-raised, not yet placed in a feature phase)

- [x] **UX-01 (NEAR-TERM, before P11)**: Composer / skill-selector redesign — **BUILT** (2026-06-19, commit `feb55e43`) in the real app — not just sketched. `composer-controls.tsx` (skill pill + grouped Creator/Marketing popover, audience + intent icon-only, read-only ModelTag, `/` slash entry) replaces `tool-chips.tsx`; verified desktop + 390px. **DIRECTION LOCKED** via sketch `006-composer-skill-selector` (winner: **Variant 1 — Minimal · context surfaced**). Locked decisions, now shipped:
  - **Flat-warm THEME-06** (warm charcoal, cream, terracotta serif stele — no glass); premium **line-icon SVGs**, no emoji.
  - **One accented control** = the **skill pill** (grouped **Creator / Marketing**, `MAX` badge where the video model fires); audience + intent sit beside it as **icon-only borderless** controls; `+` opens upload/attach (the SIM-1 Max **Test** path).
  - **Model is READ-ONLY** — the skill decides Flash vs Max, shown as an indicator (no selector, no "auto" label).
  - **Popover everywhere** (desktop AND mobile — no bottom sheet); **`/` slash** entry for fast skill switching.
  - **Composer sits low** so the upward popover never clips; **popover needs `max-height` + scroll** at ~9 skills; mobile sizing via media query (verified desktop + 390px). Supersedes sketch `001-hybrid-composer`.
- [ ] **UX-02**: Creator-skills vs marketing-skills differentiation in the composer/IA — same surface, distinct grouping (owner: "we differentiate between creator skills and marketing skills"). Folds into P15/P16 + the P12 IA.
- [ ] **INFRA-01 (pre-launch)**: Video storage → Cloudflare R2 migration + Supabase free/Pro tier planning for first ~100 users; confirm live video playback on R2 in the analysis result. (Owner launch-readiness thread; ties to HARDEN-01 + billing.)
- [ ] **PERF-01**: Model-routing + latency — Test E2E ~4min is too slow (owner); evaluate switching the text-skill audience-sim from `qwen-3.7-plus` → `3.6-flash` for speed; resolve the engine model-flip **pending on branch `fix/flash-coercion-stability`** (memory `engine-model-assignment`). Engine is OPEN this milestone but regression-gated. See memory `engine-latency-optimization`.
- [x] **HONESTY-01**: Chat citation pills are **fake labels, not real RAG** (memory `chat-citations-not-grounded`) — honesty-spine violation. Either ground them for real (fits KCQ-03 exemplar RAG) or drop the pills. Resolve with P14.

> **Out of product scope (GTM, note only):** the 5 UGC marketing accounts (the founder/content/media/creator/brand "report" accounts), logos, account-warming — go-to-market execution, not a build phase.

---

## Cross-cutting constraints

- **Honesty spine (from v5.0 — READ-10 / D-13):** never present an ungraded generation as graded; never fabricate a Flash score; degrade gracefully when profile/KC is thin.
- **Bounded cost:** self-judge regeneration loops are capped; latency pattern = content-first, scores-stream.
- **Engine OPEN, validated behavior PROTECTED (not frozen):** text-mode, generation, KC, and fold refactors are all permitted. Guardrail: keep the engine test suite green, preserve same-video score-identity/determinism on the SIM-1 Max path, and bump `ENGINE_VERSION` on any *deliberate* change to video-scoring output. No silent regressions.
- **Qwen-only** pipeline (no Gemini/DeepSeek).
- **Rich UI via the fixed numen-rework typed-renderer library** — NOT model-generated UI (craft trap hit twice on landing).
- **Flat-warm THEME-06** is the design SSOT.

---

## Future Requirements (post-v6.0 — deferred seeds, rails laid, NOT this milestone)

> **2026-06-19:** the Sandcastles + Commerce + KC-quality tracks were folded INTO v6.0 as Phases 11–15 (see Expansion section above). The items below remain genuinely deferred — rails laid, build gated on data/usage volume.
>
> **Pulled IN to phases:** compact onboarding + link-social prefill → AUD-EDIT-03/04 (P12); own-history exemplar RAG → KCQ-03 (P14, niche-exemplar form); in-thread monetization + brand-profile → COMMERCE-01 (P16); test concept pre-flight → covered by P8 multi-audience concept Read (verify).

- [ ] **FLYWHEEL-05 cross-creator prior-fitting mechanism** (lever #8) — reconciliation logging shipped (P10); aggregated prior-fitting that sharpens base persona priors is deferred until enough privacy-safe data accumulates.
- [ ] **Spread / virality prediction in the Read** (P7 deferred).
- [ ] **Real social OAuth** (P7 deferred — Apify scrape suffices; no Connectors).
- [ ] **Script Diagnose mode** (paste existing script → line-edits + drop-point) + **remix-your-own-winner** deep dive — skills depth; may fold into P15 or stay backlog.
- [ ] **RAG over the creator's OWN scraped history** (broader than KCQ-03's niche-exemplar form) — usage-gated.
- [ ] **Desktop-dense layout.**
- [ ] **Billing / payments infra** — billing API deferred since omni-plus is free (PROJECT.md, v3.1-era); ties to the pricing tiers ($29/$49/$129) + iOS Reader-App payment strategy (memory). Launch-ops, not a build phase here; wire alongside HARDEN-01 before public/paid traffic.
- *(Cross-milestone, NOT this product: **Landing page rebuild** — separate landing-v2 milestone. **In-app prediction-viz / "hive" rebuild** — superseded by P9 Living Audience AudienceLens. **Light-mode theme** — out of scope, dark-first.)*

---

## Out of Scope

- Model-generated / "generative UI" — fixed typed renderers only (craft trap).
- Silent regression of SIM-1 Max (video) scoring behavior — protected by the regression gate (open to deliberate, reviewed change; not to silent drift).
- Leaning on the stale `training-data.json` exemplars (a liability, not an asset).
- Depending on creator *voice* as a grounding foundation (low reliability; a bonus when present).
- Non-Qwen models.

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENGINE-01 | Phase 1 | Complete |
| THREAD-01 | Phase 1 | Complete |
| THREAD-02 | Phase 1 | Complete |
| THREAD-04 | Phase 1 | Complete |
| THREAD-06 | Phase 1 | Complete |
| THREAD-07 | Phase 1 | Complete |
| ENGINE-03 | Phase 1 | Complete |
| GROUND-01 | Phase 2 | Complete |
| GROUND-02 | Phase 2 | Complete |
| IDEAS-01 | Phase 3 | Complete |
| IDEAS-02 | Phase 3 | Complete |
| IDEAS-03 | Phase 3 | Complete (chain to Hooks via /develop) |
| ENGINE-02 | Phase 3 | Complete |
| GROUND-03 | Phase 3 | Complete |
| PROFILE-01 | Phase 3 | Complete |
| THREAD-05 | Phase 5 | Complete (05-05) |
| HOOKS-01 | Phase 4 | Complete |
| HOOKS-02 | Phase 4 | Complete |
| HOOKS-03 | Phase 4 | Complete |
| THREAD-03 | Phase 5 | Complete |
| TEST-01 | Phase 5 | Complete |
| STUDIO-01 | Phase 5 | Complete (05-04) |
| STUDIO-02 | Phase 5 | Complete (05-04 follow-up + 05-05 refine) |
| STUDIO-03 | Phase 5 | Complete (05-04) |
| SCRIPT-01 | Phase 6 | Complete |
| REMIX-01 | Phase 6 | Complete |
| LIVE-01 | Phase 9 | Complete |
| LIVE-02 | Phase 9 | Complete |
| LIVE-03 | Phase 9 | Complete (gap closed — conceptText wired into the video-Test AudienceLens via readingConceptText + threaded through MessageBlocks → PersonasBlockRenderer; chat reachable on video Test + text-Read PersonasBlock; 4 text cards honestly chat-less per CR-01; lens-chat-gate regression test locks the gate) |
| LIVE-04 | Phase 9 | Complete |
| LIVE-05 | Phase 9 | Complete (deterministic swarm + counters + cascade shipped 09-05, verified reachable) |
| LIVE-06 | Phase 9 | Complete (gap closed — text-Read PersonasBlock now mounts the reusable Lens via conceptText threading; all 6 surfaces mount the single shared AudienceLens) |
| LIVE-07 | Phase 9 | Complete (gap closed — card-rewrite.ts builds LensRewrite from CHAIN_HANDOFFS self-handoff SSOT; rewrite prop supplied at all 4 regenerable card mounts; RewriteCta renders + onRewrite re-POSTs the pinned contract to the real runner; null synchronous delta accepted; card-rewrite regression test locks endpoint sourcing + re-POST) |
| SELF-01 | Phase 10 | Complete (10-05) |
| SELF-02 | Phase 10 | Complete (10-05) |
| SELF-03 | Phase 10 | Complete (10-05) |
| SAVE-01 | Phase 10 | Complete (10-02, 10-04, 10-07) |
| SAVE-02 | Phase 10 | Complete (10-04) |
| FLYWHEEL-01 | Phase 10 | Complete (10-02, 10-03, 10-07) |
| FLYWHEEL-02 | Phase 10 | Complete (10-01, 10-03) |
| FLYWHEEL-03 | Phase 10 | Complete (10-01, 10-03) |
| FLYWHEEL-04 | Phase 10 | Complete (10-01, 10-06) |
| FLYWHEEL-05 | Phase 10 | Complete (10-02, 10-06) |
| FLYWHEEL-06 | Phase 10 | Complete (10-06) |
| EXPLORE-01..06 | Phase 11 | Planned (expansion) |
| IA-01 / LIB-01..03 / AUD-EDIT-01..04 | Phase 12 | Planned (expansion) |
| AMBIENT-01 / PROACTIVE-01..02 | Phase 13 | Planned (expansion) |
| KCQ-01..09 | Phase 14 | Planned (expansion) |
| INTENT-01 / REACT-01 / BLOCK-01 | Phase 15 | Planned (expansion) |
| OFFER-01 / ADCREATIVE-01 / COMMERCE-01 | Phase 16 | Planned (expansion) |
| HARDEN-01 | Pre-launch gate | Planned (expansion) |
