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

### SPIKE — De-risk gates (Phase 1, GO/NO-GO)

- [ ] **SPIKE-01**: SIM-1 Flash text-fidelity validated — a text-only fold predicts *relative* pull on known-outcome content (Spearman ranking correlation + score separation + same-input stability), tested across 2–3 persona framings; the winning framing is documented as the inline-scoring spec. **GO/NO-GO gate — a weak result re-scopes ENGINE-02 / IDEAS-02 / HOOKS-02 (the inline-scoring premise).**
- [ ] **SPIKE-02**: Knowledge-Core generative-craft slice validated — a small authored KC slice (for Hooks) beats the scoring-core baseline on an eval set (blind comparison / SIM-1 self-judge delta), proving the generative-rebuild approach before the full GROUND-01 effort.

### ENGINE — SIM-1 text-mode + self-judge

- [ ] **ENGINE-01**: SIM-1 Flash text-mode — the 10 archetypes react to *text* input (no video), returning per-persona reactions + an aggregate pull score, with mode-specific framing (Hook = "scrolling, first 2s, do you stop?"; Idea = "in your niche, would this make you stop/share?").
- [ ] **ENGINE-02**: SIM-1 self-judge quality gate — generations are Flash-scored and weak outputs regenerate/filter before the user sees them; regeneration is **bounded** (cost). *(conditional on SPIKE-01)*
- [ ] **ENGINE-03**: Honest Flash/Max framing — Flash surfaced as *concept ceiling* ("worth shooting?"), Max as *realized result*; never a fabricated score, never a view-count promise Flash can't back.

### GROUND — Knowledge-Core generative rebuild (THE value, the long pole)

- [ ] **GROUND-01**: Knowledge-Core restructured for generation — a shared generative base + per-mode slices (Ideas, Hooks, chat), authored fresh; **not** retrofitted from the scoring core or the stale `training-data.json`. Content/curation workstream first, code second.
- [ ] **GROUND-02**: Per-mode grounding assembly — each tool assembles a tight curated context slice (niche + relevant craft frame + the specific input), not the whole profile/KC (avoids signal dilution).
- [ ] **GROUND-03**: Grounding legible in UI — outputs surface *why* they were made ("because your audience is 18–25 gym beginners and your last 3 myth-busting videos overperformed").

### THREAD — model generalization, runner, rendering, chat

- [ ] **THREAD-01**: Generalized thread data model — nullable `reading_id` + a `type` discriminator (grounded vs open thread); migration + types.
- [ ] **THREAD-02**: Composer = universal door — routes input to Test (URL/upload) vs a generator/chat (prompt).
- [ ] **THREAD-03**: Open chat thread — profile-grounded general chat with no anchoring Reading (markdown messages). *(sequenced last; only as good as GROUND-01 — gated behind KC quality)*
- [ ] **THREAD-04**: Typed-block rendering — messages render as markdown OR typed blocks via the **fixed** numen-rework renderer library; **no** model-generated UI.
- [ ] **THREAD-05**: Chain CTAs — outputs carry in-thread chain CTAs ("Develop this →", "Test full →") that move between tools.
- [ ] **THREAD-06**: Tool-runner abstraction — each tool = `{promptTemplate, knowledgeBundle, outputSchema, renderer}`; structured output → typed renderer, no schema → markdown. Ideas/Hooks/chat run through it so Scripts/Remix slot in later without one-off code.
- [ ] **THREAD-07**: Message/block persistence — a thread's messages + typed blocks persist and re-hydrate on reload.

### IDEAS — funnel-top generator

- [ ] **IDEAS-01**: Generate ideas — idea cards (title · angle · *why it fits you*) from the creator profile (Auto) or a seeded topic/angle.
- [ ] **IDEAS-02**: Inline Flash viability hint — each card shows a SIM-1 Flash viability score; **content-first, score streams in** (never blocks content render). *(conditional on SPIKE-01)*
- [ ] **IDEAS-03**: Chain to Hooks — "Develop this →" carries an idea into Hooks.

### HOOKS — flagship moat demo

- [ ] **HOOKS-01**: Generate hooks — N hook cards from an idea or a topic, each tagged with the archetype it grabs.
- [ ] **HOOKS-02**: Flash pull-score ranking — hook cards ranked by a SIM-1 Flash pull-score ("who'll actually stop scrolling," first-2s framing). *(conditional on SPIKE-01)*
- [ ] **HOOKS-03**: Chain to Test — "Test full →" carries a hook into Test (the full Reading).

### PROFILE — grounding source (v1: reuse existing)

- [ ] **PROFILE-01**: Tools ground on the existing `creator_profiles` (9-card) + cold-start → platform baselines + graceful degradation when the profile is thin. *(compact-onboarding redesign + link-social prefill deferred to v6.1)*

### TEST — the chain endpoint

- [ ] **TEST-01**: Test reframe — the existing Reading is reframed as "Test · powered by SIM-1 Max," reachable as the landing point of every chain; the video path is unchanged (regression-gated).

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

- [ ] **SCRIPTS tool** — Write (from a hook/idea: beats + timing + per-beat retention markers) · Diagnose (paste existing script → line-edits + drop-point).
- [ ] **REMIX tool** — paste viral URL → decode *why it worked* → generate *your* version (niche/voice, new hook + script) → Flash score → Test. **Preceded by a reuse scout** of `milestone/viral-remix` (Ingestion + Remix Mode COMPLETE) + `viral-remix-adapt` — revive, don't rebuild.
- [ ] **Test concept/script text pre-flight mode** — lands with Scripts.
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
| *(filled by the roadmap)* | — | — |
