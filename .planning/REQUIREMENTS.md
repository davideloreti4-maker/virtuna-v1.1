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
- [ ] **IDEAS-02**: Inline Flash viability hint — each card shows a SIM-1 Flash viability score; **content-first, score streams in** (never blocks content render).
- [ ] **IDEAS-03**: Chain to Hooks — "Develop this →" carries an idea into Hooks.

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

- [ ] **SCRIPT-01**: Script tool — from a chosen hook/idea → a script card (beats + timing + per-beat retention markers), content-first with a Flash viability beat + self-judge gate, sitting hooks→script→test, landing on "Test full →". (Diagnose mode — paste existing script → line-edits + drop-point — may follow.)
- [x] **REMIX-01**: Remix tool — an alternate funnel-top entry: paste a trending/competitor URL or pick the creator's own winner → decode *why it worked* → generate *their* niche/voice version (new hook + script angle) → Flash score → feed the Hooks/Test chain. **Preceded by a reuse scout** of `milestone/viral-remix` (Ingestion + Remix Mode COMPLETE) + `viral-remix-adapt` + `src/app/api/remix/adapt/` — revive, don't rebuild.

---

## Cross-cutting constraints

- **Honesty spine (from v5.0 — READ-10 / D-13):** never present an ungraded generation as graded; never fabricate a Flash score; degrade gracefully when profile/KC is thin.
- **Bounded cost:** self-judge regeneration loops are capped; latency pattern = content-first, scores-stream.
- **Engine OPEN, validated behavior PROTECTED (not frozen):** text-mode, generation, KC, and fold refactors are all permitted. Guardrail: keep the engine test suite green, preserve same-video score-identity/determinism on the SIM-1 Max path, and bump `ENGINE_VERSION` on any *deliberate* change to video-scoring output. No silent regressions.
- **Qwen-only** pipeline (no Gemini/DeepSeek).
- **Rich UI via the fixed numen-rework typed-renderer library** — NOT model-generated UI (craft trap hit twice on landing).
- **Flat-warm THEME-06** is the design SSOT.

---

## Future Requirements (v6.1+)

> **Scripts + Remix un-deferred to v6.0 Phase 6 (2026-06-18)** — see SCRIPT-01 / REMIX-01 above.

- [ ] **Test concept/script text pre-flight mode** — may land with Script (P6) or later.
- [ ] **Compact onboarding redesign** (shorten the 9-card) + **link-social → Apify metadata prefill** (PROFILE tier C).
- [ ] **RAG over the creator's own scraped history / exemplar selection** — deferred until usage accumulates.
- [ ] **In-thread monetization**; **brand-profile entity** (brands as a separate buyer).

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
| IDEAS-02 | Phase 3 | Pending |
| IDEAS-03 | Phase 3 | Pending |
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
| SCRIPT-01 | Phase 6 | Pending |
| REMIX-01 | Phase 6 | Complete |
