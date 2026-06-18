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
- [ ] **Phase 5: Studio Conversation Layer** - Make the studio feel like ONE conversation: profile-grounded open chat (no anchoring Reading) + Reading reframed as "Test · powered by SIM-1 Max" + Perplexity-style progress, cards embedded in chat, chat-to-refine (scoped re-run → re-tested card), and the generic skill-to-skill chain plumbing
- [ ] **Phase 6: Script & Remix Tools** - Un-deferred from v6.1: Script (hook→script→test) + Remix (alt funnel-top entry: trending/own-winner → ideas/hooks), both on the same Qwen pipeline as Test, plugging into P5's chain plumbing

> **Phase 5 re-scoped + Phase 6 added (2026-06-18).** Discuss-phase expanded P5 from "Open Chat & Test Reframe" into the integrative **Studio Conversation Layer**, and **un-deferred Scripts + Remix from v6.1** into a combined **Phase 6**. See `.planning/phases/05-open-chat-test-reframe/05-CONTEXT.md` (D-00).

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
- [ ] 05-04-PLAN.md — Conversation layer: real-stage SSE progress checklist (D-02) + model-authored follow-up turn (D-03) + generic chain-handoff contract (D-09) [STUDIO-01, STUDIO-02, STUDIO-03]

**Wave 3** *(blocked on Wave 2)*

- [ ] 05-05-PLAN.md — Core loop: chat-to-refine scoped re-run → new freshly-SIM-scored card inline + chat note (D-04) + refine-intent NL detect + tappable suggested chain CTA (D-05) [STUDIO-02, STUDIO-03, THREAD-05]
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

**Plans**: TBD
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
| 5. Studio Conversation Layer | 3/5 | In Progress | - |
| 6. Script & Remix Tools | 0/TBD | Not started | - |
