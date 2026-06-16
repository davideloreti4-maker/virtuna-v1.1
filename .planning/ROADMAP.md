# Roadmap: v6.0 Numen Studio

## Overview

This milestone opens Numen from a single-video analyzer into a creator **studio**: generation tools (Ideas → Hooks) where every output is tested on a synthetic audience (SIM-1) before the creator acts, plus open chat with no prior video. Generation is the surface; **SIM-1-on-everything is the moat.**

The journey: a **GO/NO-GO spike gate** de-risks the two riskiest bets (does text-only SIM-1 Flash predict pull? does a fresh generative Knowledge-Core slice beat the scoring core?). A passing spike unlocks the **engine + thread foundation** (Flash text-mode, generalized thread model, tool-runner, typed-block rendering, persistence, the universal composer). In parallel, the long-pole **Knowledge-Core generative rebuild** — THE value — proceeds as a content/curation workstream. The foundation and KC then converge on the **Ideas → Hooks moat chain**: Ideas (auto/seeded, content-first with a streaming Flash viability hint, self-judge quality gate) chains into **Hooks** (the flagship — N ranked hook cards with a Flash pull-score, each landing on Test). Finally **open chat** (sequenced last, only as good as the KC) and the **Test reframe** close the loop as the chain endpoint.

**Engine posture:** OPEN but regression-gated. Text-mode / generation / KC / fold work is permitted; the SIM-1 Max (video) scoring path is protected — every engine-touching phase keeps the engine suite green and preserves same-video score-identity, bumping `ENGINE_VERSION` only on deliberate, reviewed scoring changes.

## Phases

**Phase Numbering:**
- Milestone-scoped — phases 1..N for v6.0 only (this project numbers each milestone independently).
- Integer phases (1, 2, 3): planned milestone work.
- Decimal phases (2.1, 2.2): urgent insertions (marked INSERTED).

- [ ] **Phase 1: Spike Gate** - GO/NO-GO de-risk: SIM-1 Flash text-fidelity + Knowledge-Core generative-craft slice
- [ ] **Phase 2: Engine & Thread Foundation** - SIM-1 Flash text-mode + generalized thread model, tool-runner, typed-block rendering, persistence, universal composer
- [ ] **Phase 3: Knowledge-Core Generative Rebuild** - Ground-up generative KC (shared base + per-mode slices) — THE value, the long pole
- [ ] **Phase 4: Ideas Tool** - Funnel-top idea generation grounded on the profile + KC, with a streaming Flash viability hint, self-judge gate, and chain CTAs
- [ ] **Phase 5: Hooks Tool** - Flagship moat demo: N ranked hook cards with a SIM-1 Flash pull-score, chaining into Test
- [ ] **Phase 6: Open Chat & Test Reframe** - Profile-grounded open chat (no anchoring Reading) + the Reading reframed as "Test · powered by SIM-1 Max," the endpoint of every chain

## Phase Details

### Phase 1: Spike Gate
**Goal**: Resolve the two highest-risk bets with evidence before committing the build architecture — prove (or re-scope) text-only SIM-1 Flash scoring, and prove the generative Knowledge-Core approach.
**Depends on**: Nothing (first phase)
**Requirements**: SPIKE-01, SPIKE-02
**Success Criteria** (what must be TRUE):
  1. SIM-1 Flash text-fidelity has a documented verdict from a cheap fold smoke run across 2-3 persona framings — measured on known-outcome content by Spearman ranking correlation + score separation + same-input stability — and the winning framing is written up as the inline-scoring spec.
  2. The verdict explicitly states GO or NO-GO for the inline-scoring premise; on a weak result, the re-scope path for ENGINE-02 / IDEAS-02 / HOOKS-02 is recorded (these inline-score requirements are conditional on this gate).
  3. A small authored Knowledge-Core generative-craft slice (for Hooks) beats the scoring-core baseline on an eval set via blind comparison / SIM-1 self-judge delta, validating the generative-rebuild approach before the full GROUND-01 effort.
  4. The engine test suite is green and same-video score-identity on the SIM-1 Max (video) path is preserved (spike work is additive Flash/eval scaffolding; no silent regression of the protected video path).
**Plans**: TBD
**UI hint**: no

### Phase 2: Engine & Thread Foundation
**Goal**: Stand up the substrate the whole studio runs on — a SIM-1 Flash text-mode engine path, a thread model that supports grounded and open threads, a reusable tool-runner, typed-block rendering, message/block persistence, and the composer as the universal entry door.
**Depends on**: Phase 1 (spike GO confirms the Flash text-mode + inline-scoring architecture; the documented winning framing seeds ENGINE-01)
**Requirements**: ENGINE-01, ENGINE-03, THREAD-01, THREAD-02, THREAD-04, THREAD-06, THREAD-07
**Success Criteria** (what must be TRUE):
  1. SIM-1 Flash reacts to text input (no video) — the 10 archetypes return per-persona reactions + an aggregate pull score with mode-specific framing (Hook = "scrolling, first 2s, do you stop?"; Idea = "in your niche, would this make you stop/share?").
  2. A creator can start either a grounded thread (a video's Reading) or an open thread (profile-only) from the composer, which routes URL/upload to Test and a prompt to a generator/chat; the thread data model carries a nullable `reading_id` + a `type` discriminator (migration + types live).
  3. A thread's messages render as markdown OR typed blocks through the fixed numen-rework renderer library (no model-generated UI), and any tool's output flows through one shared tool-runner contract (`{promptTemplate, knowledgeBundle, outputSchema, renderer}`) — structured output → typed renderer, no schema → markdown.
  4. A thread's messages and typed blocks persist and re-hydrate correctly on reload (no data loss across a refresh).
  5. Flash output is framed honestly as a *concept ceiling* ("worth shooting?") distinct from Max as *realized result* — never a fabricated score, never a view-count promise Flash can't back — and the engine suite stays green with same-video Max score-identity preserved (`ENGINE_VERSION` bumped only on a deliberate, reviewed scoring change).
**Plans**: TBD
**UI hint**: yes

### Phase 3: Knowledge-Core Generative Rebuild
**Goal**: Rebuild the Knowledge-Core from scratch for *generation* (not scoring) — a shared generative base plus per-mode slices (Ideas, Hooks, chat) and a tight per-request grounding-assembly mechanism — as a content/curation workstream first, code second. THE value, the long pole.
**Depends on**: Phase 1 (SPIKE-02 validates the generative-rebuild approach; the authored slice seeds the full build). Can begin early and run in parallel with Phase 2 — it is a content workstream, not gated behind the engine/thread code.
**Requirements**: GROUND-01, GROUND-02
**Success Criteria** (what must be TRUE):
  1. A generation-grade Knowledge-Core exists — authored fresh as a shared generative base + per-mode slices (Ideas, Hooks, chat) — and is NOT retrofitted from the scoring core or the stale `training-data.json`.
  2. Each tool can assemble a tight curated context slice (niche + the relevant craft frame + the specific input) rather than the whole profile/KC, with the per-mode grounding-assembly mechanism in place to avoid signal dilution.
  3. The rebuilt KC measurably outperforms the scoring-core baseline on the generative eval (extending the SPIKE-02 method to the full slices), confirming generative craft over generic competence.
**Plans**: TBD
**UI hint**: no

### Phase 4: Ideas Tool
**Goal**: Ship the funnel-top generator — idea cards grounded on the creator profile + the rebuilt KC, content-first with a streaming SIM-1 Flash viability hint, a bounded self-judge quality gate, legible grounding, and a chain into Hooks.
**Depends on**: Phase 2 (Flash text-mode + tool-runner + typed renderers + composer) and Phase 3 (KC Ideas slice + grounding assembly). First phase where SPIKE-01's GO is exercised in product.
**Requirements**: IDEAS-01, IDEAS-02, IDEAS-03, ENGINE-02, GROUND-03, PROFILE-01, THREAD-05
**Success Criteria** (what must be TRUE):
  1. A creator gets idea cards (title · angle · *why it fits you*) generated from their existing `creator_profiles` (Auto) or a seeded topic/angle — with cold-start → platform baselines and graceful degradation when the profile is thin.
  2. Each idea card renders content immediately and a SIM-1 Flash viability score streams in a beat later (content-first; the score never blocks the content render), and weak generations are caught by a *bounded* Flash self-judge gate before the creator sees them (no ungraded generation presented as graded).
  3. Each card surfaces *why* it was made — legible grounding ("because your audience is 18-25 gym beginners and your last 3 myth-busting videos overperformed") — visibly separating Numen from a generic chatbot.
  4. "Develop this →" carries a chosen idea into Hooks via the in-thread chain-CTA mechanism.
  5. The engine suite stays green and the SIM-1 Max video path's same-video score-identity is preserved (Ideas adds Flash + self-judge calls; no silent regression of the protected path).
**Plans**: TBD
**UI hint**: yes

### Phase 5: Hooks Tool
**Goal**: Ship the flagship moat demo — from an idea or a topic, generate N hook cards each tagged with the archetype it grabs, ranked by a SIM-1 Flash pull-score ("who'll actually stop scrolling," first-2s framing), each chaining into the full Test.
**Depends on**: Phase 4 (the "Develop this →" chain feeds Hooks; reuses the tool-runner, self-judge, legible-grounding, and content-first-scores-stream patterns). Phase 3 supplies the Hooks KC slice.
**Requirements**: HOOKS-01, HOOKS-02, HOOKS-03
**Success Criteria** (what must be TRUE):
  1. A creator gets N hook cards generated from an idea or their own topic, each tagged with the archetype it grabs.
  2. The hook cards are ranked by a SIM-1 Flash pull-score using the first-2s "do you stop scrolling?" framing — content-first, scores stream in — producing a visibly working ranked-hooks demo.
  3. "Test full →" carries a chosen hook into Test (the full Reading), completing the Ideas → Hooks → Test spine.
  4. The engine suite stays green and the SIM-1 Max video path's same-video score-identity is preserved (Hooks adds Flash pull-scoring; no silent regression of the protected path).
**Plans**: TBD
**UI hint**: yes

### Phase 6: Open Chat & Test Reframe
**Goal**: Close the studio — a profile-grounded open chat thread with no anchoring Reading (sequenced last, only as good as the rebuilt KC) and the existing Reading reframed as "Test · powered by SIM-1 Max," reachable as the landing point of every chain.
**Depends on**: Phase 3 (open chat is gated behind KC quality — it is only as good as GROUND-01) and Phase 2 (thread model + composer + renderers). Test reframe consumes the chain CTAs landed in Phases 4-5.
**Requirements**: THREAD-03, TEST-01
**Success Criteria** (what must be TRUE):
  1. A creator can hold a profile-grounded general chat in an open thread with no anchoring Reading (markdown messages), persisting and re-hydrating like any thread.
  2. The open chat's answers reflect the rebuilt KC's grounding (sequenced after the KC rebuild on purpose) rather than generic chatbot output.
  3. The existing Reading is reframed as "Test · powered by SIM-1 Max" and is the landing point reached by every chain CTA ("Test full →"); the video/upload path is unchanged.
  4. The engine suite stays green and the SIM-1 Max video path's same-video score-identity is preserved — the Test reframe is a presentation/wiring change, not a scoring change (no `ENGINE_VERSION` bump unless a deliberate scoring change is made).
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 (Phase 3 may begin in parallel with Phase 2 as a content workstream).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Spike Gate | 0/TBD | Not started | - |
| 2. Engine & Thread Foundation | 0/TBD | Not started | - |
| 3. Knowledge-Core Generative Rebuild | 0/TBD | Not started | - |
| 4. Ideas Tool | 0/TBD | Not started | - |
| 5. Hooks Tool | 0/TBD | Not started | - |
| 6. Open Chat & Test Reframe | 0/TBD | Not started | - |
