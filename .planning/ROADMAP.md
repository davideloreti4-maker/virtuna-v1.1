# Roadmap: v6.0 Numen Studio

## Overview

This milestone opens Numen from a single-video analyzer into a creator **studio**: generation tools (Ideas → Hooks) where every output is tested on a synthetic audience (SIM-1) before the creator acts, plus open chat with no prior video. Generation is the surface; **SIM-1-on-everything is the moat.**

The journey starts at the **engine + thread foundation** (Flash text-mode, generalized thread model, tool-runner, typed-block rendering, persistence, the universal composer). The two former de-risk bets are resolved by owner experience rather than a gate phase — text-only SIM-1 Flash predicts relative pull (the winning persona framing is calibrated *inside* the engine phase, not gated ahead of it), and the Knowledge-Core moves to a general-use generative core unconditionally. In parallel, the long-pole **Knowledge-Core generative rebuild** — THE value — proceeds as a content/curation workstream. The foundation and KC then converge on the **Ideas → Hooks moat chain**: Ideas (auto/seeded, content-first with a streaming Flash viability hint, self-judge quality gate) chains into **Hooks** (the flagship — N ranked hook cards with a Flash pull-score, each landing on Test). Finally **open chat** (sequenced last, only as good as the KC) and the **Test reframe** close the loop as the chain endpoint.

> **Spike gate removed (2026-06-16).** A GO/NO-GO de-risk phase was dropped: both bets are resolved by owner domain experience — text-only Flash works (and improves with the right data/context/framing), and the KC rebuild is a committed general-use redo. The framing-discovery artifact lives in ENGINE-01; the authored KC slice is absorbed into GROUND-01. Phases renumbered 1–5.

**Engine posture:** OPEN but regression-gated. Text-mode / generation / KC / fold work is permitted; the SIM-1 Max (video) scoring path is protected — every engine-touching phase keeps the engine suite green and preserves same-video score-identity, bumping `ENGINE_VERSION` only on deliberate, reviewed scoring changes.

## Phases

**Phase Numbering:**

- Milestone-scoped — phases 1..N for v6.0 only (this project numbers each milestone independently).
- Integer phases (1, 2, 3): planned milestone work.
- Decimal phases (2.1, 2.2): urgent insertions (marked INSERTED).

- [x] **Phase 1: Engine & Thread Foundation** - SIM-1 Flash text-mode (+ winning-framing calibration) + generalized thread model, tool-runner, typed-block rendering, persistence, universal composer (completed 2026-06-17)
- [x] **Phase 2: Knowledge-Core Generative Rebuild** - Ground-up general-use generative KC (shared base + per-mode slices) — THE value, the long pole (completed 2026-06-17)
- [x] **Phase 3: Ideas Tool** - Funnel-top idea generation grounded on the profile + KC, with a streaming Flash viability hint, self-judge gate, and chain CTAs (completed 2026-06-18; reload-rehydration deferred to P4 per owner)
- [x] **Phase 4: Hooks Tool** - Flagship moat demo: N ranked hook cards with a SIM-1 Flash pull-score, chaining into Test (completed 2026-06-18)
- [x] **Phase 5: Studio Conversation Layer** - Make the studio feel like ONE conversation: profile-grounded open chat (no anchoring Reading) + Reading reframed as "Test · powered by SIM-1 Max" + Perplexity-style progress, cards embedded in chat, chat-to-refine (scoped re-run → re-tested card), and the generic skill-to-skill chain plumbing (completed 2026-06-18)
- [x] **Phase 6: Script & Remix Tools** - Un-deferred from v6.1: Script (hook→script→test) + Remix (alt funnel-top entry: trending/own-winner → ideas/hooks), both on the same Qwen pipeline as Test, plugging into P5's chain plumbing (completed 2026-06-18)
- [x] **Phase 8: Discover & Remix→Read** - New funnel-top: Discover niche/competitor outliers (Apify, ranked by outlier-score + value metrics) → audience-steered Remix → multi-audience concept Read (verbatim quote panel, who-it's-NOT-for, comment seeding) *before* filming *(DRAFT 2026-06-18 — not yet discussed)* (completed 2026-06-19)
- [ ] **Phase 9: Living Audience** - Make "tested against YOUR audience" tangible: reaction replay on the persona cloud, clickable persona nodes with verbatim reactions, and chat-with-persona (ask an archetype *why*) *(DRAFT 2026-06-18 — not yet discussed)*
- [ ] **Phase 10: Account Read, Saved Shelf & Recalibration Flywheel** - Turn the studio inward: self-optimize Account Read over your own history, a lean Saved shelf, drift→recalibrate nudge, and the post→measure→correct outcome loop *(DRAFT 2026-06-18 — not yet discussed)*

> **Phase 5 re-scoped + Phase 6 added (2026-06-18).** Discuss-phase expanded P5 from "Open Chat & Test Reframe" into the integrative **Studio Conversation Layer**, and **un-deferred Scripts + Remix from v6.1** into a combined **Phase 6**. See `.planning/phases/05-open-chat-test-reframe/05-CONTEXT.md` (D-00).

> **Phases 8–10 drafted (2026-06-18) — NOT yet discussed.** Competitor audit (Blort, Sandcastles) + MVP-value discussion produced three new phases that extend the moat from "generate + test" into "discover + remix + interrogate + self-optimize." Sequenced *after* Phase 7 (they consume the calibrated Audience object). Details below are a draft shape for a future `/gsd-discuss-phase` pass; requirement IDs are provisional. Source decisions captured in memory `phase8-discover-remix-roadmap.md` (+ `numen-tools-vision.md`).

## Phase Details

### Phase 1: Engine & Thread Foundation

**Goal**: Stand up the substrate the whole studio runs on — a SIM-1 Flash text-mode engine path, a thread model that supports grounded and open threads, a reusable tool-runner, typed-block rendering, message/block persistence, and the composer as the universal entry door.
**Depends on**: Nothing (first phase)
**Requirements**: ENGINE-01, ENGINE-03, THREAD-01, THREAD-02, THREAD-04, THREAD-06, THREAD-07
**Success Criteria** (what must be TRUE):

  1. SIM-1 Flash reacts to text input (no video) — the 10 archetypes return per-persona reactions + an aggregate pull score with mode-specific framing (Hook = "scrolling, first 2s, do you stop?"; Idea = "in your niche, would this make you stop/share?"). The winning persona framing (right data + context + minimal grounding for text discrimination) is calibrated here and written up as the inline-scoring spec.
  2. A creator can start either a grounded thread (a video's Reading) or an open thread (profile-only) from the composer, which routes URL/upload to Test and a prompt to a generator/chat; the thread data model carries a nullable `reading_id` + a `type` discriminator (migration + types live).
  3. A thread's messages render as markdown OR typed blocks through the fixed numen-rework renderer library (no model-generated UI), and any tool's output flows through one shared tool-runner contract (`{promptTemplate, knowledgeBundle, outputSchema, renderer}`) — structured output → typed renderer, no schema → markdown.
  4. A thread's messages and typed blocks persist and re-hydrate correctly on reload (no data loss across a refresh).
  5. Flash output is framed honestly as a *concept ceiling* ("worth shooting?") distinct from Max as *realized result* — never a fabricated score, never a view-count promise Flash can't back — and the engine suite stays green with same-video Max score-identity preserved (`ENGINE_VERSION` bumped only on a deliberate, reviewed scoring change).

**Plans**: TBD
**UI hint**: yes

### Phase 2: Knowledge-Core Generative Rebuild

**Goal**: Rebuild the Knowledge-Core from scratch for *generation* (not scoring) — a shared generative base plus per-mode slices (Ideas, Hooks, chat) and a tight per-request grounding-assembly mechanism — as a content/curation workstream first, code second. THE value, the long pole.
**Depends on**: Nothing hard — can begin early and run in parallel with Phase 1, as it is a content workstream, not gated behind the engine/thread code. (The general-use rebuild is committed, not validated by a gate.)
**Requirements**: GROUND-01, GROUND-02
**Success Criteria** (what must be TRUE):

  1. A generation-grade Knowledge-Core exists — authored fresh as a shared generative base + per-mode slices (Ideas, Hooks, chat) — and is NOT retrofitted from the scoring core or the stale `training-data.json`.
  2. Each tool can assemble a tight curated context slice (niche + the relevant craft frame + the specific input) rather than the whole profile/KC, with the per-mode grounding-assembly mechanism in place to avoid signal dilution.
  3. The rebuilt KC measurably outperforms the scoring-core baseline on a generative eval (blind comparison / SIM-1 self-judge delta), confirming generative craft over generic competence. *(D-12 relaxes this to an owner-blind rank vs raw-LLM + current-KC; no statistical eval artifact — see Plan 04.)*

**Plans**: 5 plans
**Wave 1**

- [x] 02-01-PLAN.md — Thin code spine: corpus dirs + D-04 template skeletons + scripted regen compiler + KC_GEN_VERSION
- [x] 02-02-PLAN.md — Live-tier grounding assembler (GROUND-02): per-mode field-map, by-role profile, cold-start, fence, hard cap

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-03-PLAN.md — Author BASE + Ideas pilot slice to full depth (owner-curated) + recompile

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-04-PLAN.md — D-12 thin owner-blind gate on the Ideas pilot (gates replication)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02-05-PLAN.md — Replicate proven shape: Hooks slice (full) + thin chat stance-slice + recompile

**UI hint**: no

### Phase 3: Ideas Tool

**Goal**: Ship the funnel-top generator — idea cards grounded on the creator profile + the rebuilt KC, content-first with a streaming SIM-1 Flash viability hint, a bounded self-judge quality gate, legible grounding, and a chain into Hooks.
**Depends on**: Phase 1 (Flash text-mode + tool-runner + typed renderers + composer) and Phase 2 (KC Ideas slice + grounding assembly). First phase where inline Flash scoring is exercised in product.
**Requirements**: IDEAS-01, IDEAS-02, IDEAS-03, ENGINE-02, GROUND-03, PROFILE-01, THREAD-05
**Success Criteria** (what must be TRUE):

  1. A creator gets idea cards (title · angle · *why it fits you*) generated from their existing `creator_profiles` (Auto) or a seeded topic/angle — with cold-start → platform baselines and graceful degradation when the profile is thin.
  2. Each idea card renders content immediately and a SIM-1 Flash viability score streams in a beat later (content-first; the score never blocks the content render), and weak generations are caught by a *bounded* Flash self-judge gate before the creator sees them (no ungraded generation presented as graded).
  3. Each card surfaces *why* it was made — legible grounding ("because your audience is 18-25 gym beginners and your last 3 myth-busting videos overperformed") — visibly separating Numen from a generic chatbot.
  4. "Develop this →" carries a chosen idea into Hooks via the in-thread chain-CTA mechanism.
  5. The engine suite stays green and the SIM-1 Max video path's same-video score-identity is preserved (Ideas adds Flash + self-judge calls; no silent regression of the protected path).

**Plans**: 4 plans
**Wave 1** *(parallel — disjoint files)*

- [x] 03-01-PLAN.md — Niche-instantiate the text SIM (D-05) + recalibrate thresholds + slop-vs-strong test (D-06), text-path-only, regression-gated (D-07) [ENGINE-02]
- [x] 03-02-PLAN.md — idea-card typed block (D-10) + grounding-line extractor (D-09) + KC_GEN_VERSION stamp helper [IDEAS-01, GROUND-03, PROFILE-01]

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-03-PLAN.md — Ideas API route: over-generate→niche-SIM gate→3 cards, open thread, content-first stream, anchor seam, KC_GEN_VERSION stamp [IDEAS-01/02, ENGINE-02, GROUND-03, PROFILE-01, THREAD-05]

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-04-PLAN.md — Live Idea chip + platform chip + Auto/seeded routing + Ideas thread view (content-first render) + "Develop this →" chain CTA + UAT [IDEAS-01/02/03, GROUND-03, PROFILE-01, THREAD-05] *(UAT passed 2026-06-18; reload-rehydration deferred to P4 per owner)*

**UI hint**: yes

### Phase 4: Hooks Tool

**Goal**: Ship the flagship moat demo — from an idea or a topic, generate N hook cards each tagged with the archetype it grabs, ranked by a SIM-1 Flash pull-score ("who'll actually stop scrolling," first-2s framing), each chaining into the full Test.
**Depends on**: Phase 3 (the "Develop this →" chain feeds Hooks; reuses the tool-runner, self-judge, legible-grounding, and content-first-scores-stream patterns). Phase 2 supplies the Hooks KC slice.
**Requirements**: HOOKS-01, HOOKS-02, HOOKS-03
**Success Criteria** (what must be TRUE):

  1. A creator gets N hook cards generated from an idea or their own topic, each tagged with the archetype it grabs.
  2. The hook cards are ranked by a SIM-1 Flash pull-score using the first-2s "do you stop scrolling?" framing — content-first, scores stream in — producing a visibly working ranked-hooks demo.
  3. "Test full →" carries a chosen hook into Test (the full Reading), completing the Ideas → Hooks → Test spine.
  4. The engine suite stays green and the SIM-1 Max video path's same-video score-identity is preserved (Hooks adds Flash pull-scoring; no silent regression of the protected path).

**Plans**: 3 plans
**Wave 1** *(parallel — disjoint files)*

- [x] 04-01-PLAN.md — hook-card typed block (D-11) + audience-archetype tag extractor (D-03/D-04) [HOOKS-01]

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-02-PLAN.md — Hooks pipeline: over-generate→gate→RANK→top-5 + Hooks SSE route + /develop auto-fire replaces the P3 placeholder (D-01/D-02/D-07/D-08/D-10) [HOOKS-01, HOOKS-02]

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04-03-PLAN.md — Live Hook chip + content-first thread view + "Test full →" handoff (D-05/D-06) + open-thread rehydration (P3 debt) + UAT [HOOKS-01, HOOKS-02, HOOKS-03]

**UI hint**: yes

### Phase 5: Studio Conversation Layer

**Goal**: Close the studio by making **idea → hooks → (script) → test feel like ONE flowing conversation** — open chat + the Test reframe **plus** the integrative conversation layer (Perplexity-style progress, cards embedded in chat, chat-to-refine, and the generic skill-to-skill chain plumbing) — all in a single shared open thread per user. (Re-scoped 2026-06-18 from "Open Chat & Test Reframe"; full decisions in `05-CONTEXT.md`.)
**Depends on**: Phase 2 (open chat is gated behind KC quality — only as good as GROUND-01) and Phase 1 (thread model + composer + renderers + tool-runner). Consumes the chain CTAs + `testBrief` carry-in landed in Phases 3-4. On the critical path for Phase 6 (Script/Remix plug into the chain plumbing built here).
**Requirements**: THREAD-03, TEST-01, THREAD-05, STUDIO-01, STUDIO-02, STUDIO-03
**Success Criteria** (what must be TRUE):

  1. A creator can hold a profile-grounded general chat in the single open thread with no anchoring Reading (markdown messages), persisting and re-hydrating like any thread; grounding is a tight per-turn slice (`assembleBundle({mode:"chat"})` + the chat stance-slice), and answers reflect the rebuilt KC rather than generic chatbot output (cold-start degrades to platform baselines).
  2. Open chat, all skill cards (idea/hook/…), and refine-chat live in the SAME open thread with full running context — every skill run and chat turn reads the whole prior thread, so "chat about this output" and the idea→hooks→test flow carry context end-to-end.
  3. When a skill runs, real pipeline stages stream over SSE as Perplexity-style checkmarks (Generating → Self-judge → Simulating your audience → Ranking — no fake timers); cards then stream in content-first, followed by a short model-authored follow-up chat turn that references the run.
  4. A chat refine request ("make hook 1 punchier") re-runs the relevant skill scoped to that card → a NEW, freshly SIM-1-scored card inline (refined output is never an untested rewrite); a skill only runs on an explicit chip send or a tapped chain CTA — never a silent auto-fire.
  5. The existing Reading is reframed as "Test · powered by SIM-1 Max" (hero + entry language) and is the landing point of every chain CTA, with the carried hook/idea shown as a visible brief above the upload; one generic anchor-carry handoff is built so Script/Remix (P6) register as runner+card+CTA without new plumbing.
  6. The engine suite stays green and the SIM-1 Max video path's same-video score-identity is preserved — open chat + the Test reframe are text-path / presentation changes, not scoring changes (no `ENGINE_VERSION` bump unless a deliberate scoring change is made).

**Plans**: 5 plans

**Wave 1** *(parallel — disjoint files)*

- [x] 05-01-PLAN.md — Open-chat backend: chat-runner + POST /api/tools/chat SSE route (grounded markdown turns persisted to the open thread) [THREAD-03]
- [x] 05-02-PLAN.md — Test reframe: Reading hero → "Test · powered by SIM-1 Max" + chip/entry language + carried-brief above upload (presentation only, no ENGINE_VERSION bump) [TEST-01]

**Wave 2** *(blocked on Wave 1; 03 & 04 parallel — disjoint files)*

- [x] 05-03-PLAN.md — Open-chat frontend: useChatStream + ChatThreadView + live Chat chip + composer chat-send + markdown rehydration + empty state [THREAD-03, STUDIO-03]
- [x] 05-04-PLAN.md — Conversation layer: real-stage SSE progress checklist (D-02) + model-authored follow-up turn (D-03) + generic chain-handoff contract (D-09) [STUDIO-01, STUDIO-02, STUDIO-03] (completed 2026-06-18)

**Wave 3** *(blocked on Wave 2)*

- [x] 05-05-PLAN.md — Core loop: chat-to-refine scoped re-run → new freshly-SIM-scored card inline + chat note (D-04) + refine-intent NL detect + tappable suggested chain CTA (D-05) [STUDIO-02, STUDIO-03, THREAD-05]

**UI hint**: yes

### Phase 6: Script & Remix Tools

**Goal**: Add the two remaining studio skills (un-deferred from v6.1, combined): **Script** (from a chosen hook/idea → beats + timing + per-beat retention markers, sitting hooks→script→test) and **Remix** (an alternate funnel-top entry: paste a trending/competitor URL or pick the creator's own winner → decode why it worked → generate *their* version → feed the chain). Both run the same Qwen pipeline as Test, are SIM-1-tested like every output, and plug into the generic chain plumbing built in Phase 5.
**Depends on**: Phase 5 (the generic skill-to-skill chain plumbing, progress-affordance, cards-in-chat, and refine patterns) and Phase 2 (KC slices — author Script/Remix slices, replicating the proven Ideas/Hooks shape). **Reuse scout first** — prior art exists: `src/app/api/analyze/[id]/script/route.ts`, `src/app/api/remix/adapt/route.ts`, and the `milestone/viral-remix` worktree (revive, don't rebuild).
**Requirements**: SCRIPT-01, REMIX-01
**Success Criteria** (what must be TRUE):

  1. A creator carries a chosen hook into Script and gets a script card (beats + timing + per-beat retention markers), content-first with a SIM-1 Flash viability beat, gated by the self-judge — landing on "Test full →" like every chain output.
  2. A creator starts from Remix (trending/competitor URL or own winner) and gets *their* niche/voice version (new hook + script angle) that feeds the same Hooks/Test chain — built on a reuse scout of the `viral-remix` prior art, not a from-scratch rebuild.
  3. Both skills register through the Phase 5 generic chain plumbing (runner + typed card + chain CTA) with no one-off wiring, and append in the single open thread with the progress/cards-in-chat/refine behavior built in Phase 5.
  4. The engine suite stays green and the SIM-1 Max video path's same-video score-identity is preserved (Script/Remix add Flash + generation calls on the text path; no regression of the protected path).

**Plans**: 5 plans

**Wave 1**

- [x] 06-01-PLAN.md — Script foundation: `script` assembler mode + authored `script.md` KC slice → `KC_SCRIPT_SYSTEM_PROMPT` + `script-card` typed block (schema/registry/renderer) [SCRIPT-01]

**Wave 2** *(blocked on Wave 1; parallel — disjoint files)*

- [x] 06-02-PLAN.md — Remix foundation: REMIX-01 reuse scout (06-SCOUT.md, D-05a re-confirm) + `remix` assembler mode + `remix-card` typed block [REMIX-01]
- [x] 06-03-PLAN.md — Script backend: `runScriptPipeline` (one card, opener-only Flash gate D-01) + `POST /api/tools/script` SSE route [SCRIPT-01]

**Wave 3** *(blocked on Wave 2)*

- [x] 06-04-PLAN.md — Remix backend: revive `runRemixPipeline` (resolve→real decode→adapt→opener gate→one remix-card) + `POST /api/tools/remix/run` SSE route (maxDuration=300) [REMIX-01] ✓ 2026-06-18

**Wave 4** *(blocked on Wave 3)*

- [x] 06-05-PLAN.md — Wiring + gate: fill CHAIN_HANDOFFS placeholders + ScriptTestContext + SSE hooks + thread views + composer/chips + UAT + BLOCKING engine regression gate (suite green, ENGINE_VERSION unchanged) [SCRIPT-01, REMIX-01]

**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 (Phase 2 may begin in parallel with Phase 1 as a content workstream; Phase 6 depends on Phase 5's chain plumbing).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Engine & Thread Foundation | 4/4 | Complete    | 2026-06-17 |
| 2. Knowledge-Core Generative Rebuild | 5/5 | Complete   | 2026-06-17 |
| 3. Ideas Tool | 3/4 | In Progress|  |
| 4. Hooks Tool | 3/3 | Complete    | 2026-06-18 |
| 5. Studio Conversation Layer | 5/5 | Complete    | 2026-06-18 |
| 6. Script & Remix Tools | 5/5 | Complete    | 2026-06-18 |

### Phase 7: Audience Manager — calibrated audience as shared substrate across all skills (the moat)

**Goal:** Connect the dangling wiring — today the engine simulates against 10 hardcoded universal archetypes, blind to the creator's actual audience. Make a calibrated **Audience** the shared substrate every skill (idea/hook/script/test/remix/chat) queries through a 3-position loop (steer → react → refine). This × the skills = the moat.

**Locked scope (full design: memory `audience-manager-phase7.md`):**

- **Object:** `Audience = { name, type (personal|target), platform, goal (free-set), 10 calibrated personas, calibration data }`. Personal = scrape-anchored (TikTok + IG presets, Apify, **no OAuth v1**); Target = described (custom = all other platforms).
- **Creator profile slimmed to name only** — niche/voice/content-history become per-audience calibration inputs (per-account anyway).
- **Persona redesign (algo-grounded):** Temperature (cold/warm/hot — reuses FYP/niche/loyalist weights) × Disposition (scanner/skeptic/collector/connector/converter/lurker). 10 = calibrated distribution; each emits algo signals (hook-pass, completion, rewatch, save, share, comment, follow). **Structure** lands in P7; **values** tuned in post-P7 refinement run.
- **3-position wiring (all skills):** ① steer (audience grounds Qwen generation — *in P7*, makes GROUND-03 literally true) · ② react (sim → signals + verbatims) · ③ refine (why = regen gradient). Goal reweights scoring (grow→cold-share, sell→converter, authority→skeptic).
- **Calibration:** scrape/description → structured Audience Profile (repaints 10 personas + sets temperature mix + seeds generation).
- **UI:** sidebar = Audience Manager CRUD + 3 presets · composer chip = active selection `platform · name`.

**Guardrails:** **General audience** (current universal 10) = default across ALL tools, must reproduce today's scores → regression gate survives. Calibration A/B = opt-in until validated.

**Deferred → post-v1:** multi-select compare (killer feature — retention vs growth side-by-side; object built `audience_id`→`audience_ids[]`-ready), real social OAuth, spread/virality prediction in the Read.

**Requirements**: AUD-01 (object + CRUD + persistence), AUD-02 (calibration pipeline), AUD-03 (General default + regression gate), AUD-04 (audience -> react/SIM path), AUD-05 (steer proof in ideas-runner), AUD-06 (goal -> deterministic reweight), AUD-07 (Manager UI + presets + composer chip + per-thread pin), AUD-08 (creator profile slim to name-only, ideas read-path)
**Depends on:** Phase 6
**Plans:** 6/6 plans executed — PHASE COMPLETE

**Wave 1** *(parallel - disjoint files)*

- [x] 07-01-PLAN.md - Audience domain core: types + goal-intent bias table (D-05) + Temperature x Disposition lens (D-02) + resolveAudienceWeights (array-shaped, General->DEFAULT) [AUD-04, AUD-06]
- [x] 07-02-PLAN.md - Persistence: `audiences` migration + `threads.active_audience_id` + audience-repo CRUD + virtual General/preset constants + types regen [AUD-01]

**Wave 2** *(blocked on Wave 1)*

- [x] 07-03-PLAN.md - Calibration pipeline (scrape->profile->thin-gate->never-fabricate, D-06) + persona repaint + audiences CRUD/calibrate SSE routes [AUD-02, AUD-01]

**Wave 3** *(blocked on Wave 2)*

- [x] 07-04-PLAN.md - Wiring: react (audience weights+repaint into Flash, no-op for General) + steer proof (ideas-runner grounds on audience, D-01) [AUD-04, AUD-05, AUD-08]

**Wave 4** *(blocked on Wave 3; has human-verify checkpoint)*

- [x] 07-05-PLAN.md - Manager UI + calibration flow (honest fallback) + read-only Audience Profile/persona display (D-03) + composer audience chip + per-thread pin (D-04) [AUD-07] — shipped inside (app) AppShell; full calibration UAT gated on 07-06 migration push

**Wave 5** *(blocked on Wave 4; BLOCKING gate + human-action push)*

- [x] 07-06-PLAN.md - migration applied to live prod (qyxvxleheckijapurisj) + types regen + BLOCKING engine regression gate (ENGINE_VERSION 3.19.0 + General->DEFAULT + full suite 2647 green) [AUD-03] — UAT skipped (owner directive); protected-path proof passed automatically

---

### Phase 8: Discover & Remix→Read — the competitor/niche moat chain *(PLANNED — 6 plans, 5 waves)*

**Goal:** Open a new funnel-top that competitors (Blort, Sandcastles) stop short of. **Discover** real outliers (a creator/competitor profile *and* a niche/keyword, via Apify, ranked by **outlier-score** — over-performance vs the source channel's own baseline — plus value metrics) → **Remix** (deconstruct hook/structure/format, regenerate the concept *for the active calibrated audience*) → **Read** (concept Read on the regenerated text **before any filming**). The category is foresight: find out it lands before you shoot. Filming happens *after* the winning Read; an optional finished-video Read (existing Max path) confirms post-shoot.

**Draft scope:**

- **Discover (Outlier Grid):** profile + niche input → Apify pull → grid ranked by outlier-multiplier + value metrics. Parity with Sandcastles' core, but the tile CTA is "Remix → Read", not "rewrite for me."
- **Audience-steered Remix (closes a slice of P7 steer-debt #1):** the remix/script runner must steer on the *active audience*, not the generic creator profile — otherwise the Read predicts against your audience while the generation targets a generic one (half-moat). This deliberately pulls the steer-everywhere debt forward for the remix+script runner.
- **Multi-audience Read (pulls forward the post-v1 "killer feature"):** same concept scored against two audiences side-by-side ("wins for growth, bombs for buyers"). Object is already `audience_ids[]`-ready from P7.
- **Verbatim quote panel:** fan the *already-emitted* per-persona `scrollQuote` + `segment_reactions` into a focus-group quote wall (mostly presentation — data exists).
- **Who-it's-NOT-for (inverse Read):** name the segment that will scroll/bounce (anti-slop; data in per-persona verdicts).
- **Comment seeding (idea D):** generate 2–3 audience-calibrated pinned comments for a winning concept (reuses persona voices).

**Reuse vs new:** ~80% is wiring the existing Ideas→Hooks→Test chain + P6 remix-runner + P7 audience object to a new front door. **New build:** Apify scrape layer + outlier-score compute + the grid UI.

**Requirements:** AUD-W0 (persona-value tuning), DISC-01/02/03/04 (apidojo swap, outlier grid view, outlier-score compute, per-day cache), REMIX-01 + AUD-STEER (audience-steered remix + close all-runner steer debt), READ-01/02/03 (single-audience Read, multi-audience compare, verbatim wall + who-it's-not-for). Comment seeding DEFERRED (D-04).
**Depends on:** Phase 7 (calibrated Audience object + react-path grounding).**Plans:** 6/6 plans complete
**Wave 1**

- [x] 08-01-PLAN.md — W0 persona-value tuning (GOAL_INTENT_BIAS + TEMPERATURE_DISPOSITION, regression-gate-safe) [AUD-W0]

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 08-02-PLAN.md — W1 backend: apidojo swap + field remap + outlier-compute + classify + per-day cache + /api/discover [DISC-01/03/04]
- [x] 08-04-PLAN.md — W2: audience-steered Remix + close all-runner steer debt (hooks/script/chat/remix) + steer tag [REMIX-01, AUD-STEER]

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 08-03-PLAN.md — W1 frontend: outlier-grid block + discover→remix chain + Discover grid view (reuse VideoCard/DottedGrid) [DISC-02]

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 08-05-PLAN.md — W3: single-audience concept Read block + who-it's-NOT-for (bands only, static card) [READ-01, READ-03]

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 08-06-PLAN.md — W4: multi-audience compare (pick-2, active-vs-General) + verbatim wall + /api/tools/read [READ-02, READ-03]

**UI hint:** yes

### Phase 9: Living Audience — interactive simulation UX *(PLANNED — 5 plans, 4 waves)*

**Goal:** Make "tested against YOUR audience" *felt*, not just numeric. Turn the static persona cloud into a living, interrogable audience — the Artificial-Societies node-cloud experience, on top of infra that already exists (`PersonaCloud`, `PersonaGraph` with 200 viewer dots / links / hover cards / pulse, per-persona `segment_reactions`, persona system prompts in `persona-registry.ts`, the P5 chat-runner).

**Draft scope (ladder):**

1. **Reaction replay** — the cloud reacts *as it watches*, segment-by-segment (drives off the existing `segment_reactions` timeline).
2. **Clickable persona nodes** — tap a dot → that archetype + its verbatim reaction to *this* concept (uses the `onOpen` seam already stubbed in `PersonaCloud` → `PersonaGraph` drill-down).
3. **Chat-with-persona (flagship cheatcode):** tap → "ask them why" → conversational chat grounded on the persona's `persona-registry` system prompt + its reaction to this concept; it answers in-voice. Reuses the P5 chat-runner.
4. **Cluster by segment** — group the cloud by the P7 Temperature×Disposition lens (which segment loved/hated it).

**Honesty posture (a feature, not a caveat):** labeled SIM-1, shows the *reasoning* per persona, never fakes a focus group. Legible simulation = the moat's credibility (anti-slop spine).

**Reuse vs new:** the cloud primitives, reaction data, persona prompts, and chat-runner all exist. **New build:** the replay animation, the node→card drill interaction, and the per-persona grounded chat session.

**Requirements:** LIVE-01 (reaction replay), LIVE-02 (node drill-down), LIVE-03 (chat-with-persona), LIVE-04 (segment clustering), LIVE-05 (Population·1,000), LIVE-06 (AudienceLens retrofit), LIVE-07 (Rewrite-for-audience loop) — formalized in REQUIREMENTS.md (planned 09-01).
**Depends on:** Phase 8 (a Read worth interrogating) — though rungs 1–2 only need Phase 7.**Plans:** 2/5 plans executed
**Wave 1**

- [x] 09-01-PLAN.md — Formalize LIVE-* + pure lens-derive math core (1,000-from-10, weighted rollup, cascade order) [W1]
- [x] 09-02-PLAN.md — AudienceLens shell + onOpen seam wired on video Test surface + node drill + reaction replay [W1]

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 09-03-PLAN.md — Chat-with-persona: chat-runner personaGrounding + drawer + sub-thread persistence [W2]

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 09-04-PLAN.md — Cluster-by-segment + Rewrite-for-audience loop + Lens mounts on 4 text skills + text Read [W3]

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 09-05-PLAN.md — Population·1,000 deterministic swarm + weighted counters + batched cascade [W4]

**UI hint:** yes

### Phase 10: Account Read, Saved Shelf & Recalibration Flywheel *(DRAFT — not yet discussed)*

**Goal:** Turn the studio inward and make the moat *compound over time*. The companion to Discover's "know thy competitor" is "know thyself" — plus the loop that makes the audience object error-correct against reality.

**Draft scope:**

- **Account Read (self-optimize):** scrape the creator's own account history → a standing report: where you stand, your recurring hook/format patterns, drop-points, what's working vs what to fix. Extends P7's personal-scrape (D-06) from audience-*composition* to content-*pattern* analysis. A "Read" on your own account.
- **Saved shelf (lean):** a flat saved-items shelf for outliers (from Discover), Reads/concepts, and formats. Connective tissue across skills. **Scope guard:** flat shelf, NOT folders/tags/CMS.
- **Drift → recalibrate (idea B):** scheduled re-scrape of the creator's own account; when audience composition shifts, nudge "your audience changed — recalibrate."
- **Outcome loop / data flywheel:** log *actual* post outcomes back against the prediction → error-correct the audience object ("we said 7, it hit 9 — your buyers are warmer than modeled"). Closes generate→predict→**post→measure→recalibrate** — the loop no competitor can run without the calibrated object.

**Backlog adjacent (noted, not scoped here):** remix-your-own-winner (idea E — already on v6.1 backlog), generate→critique→regenerate quality loop (backlog lever #3 — the "improve-against-weakest-segment" loop), RAG over creator history.

**Requirements:** provisional — SELF-* (account read), SAVE-* (saved shelf), FLYWHEEL-* (drift + outcome loop). To be formalized at discuss-phase.
**Depends on:** Phase 7 (personal scrape + audience object); benefits from Phase 8 (saved outliers) + Phase 9 (interrogable Reads).
**Plans:** TBD
**UI hint:** yes

**UI hint**: yes
