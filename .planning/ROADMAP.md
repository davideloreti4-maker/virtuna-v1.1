# Roadmap: Numen GSI (v7.0)

## Overview

Turn the socials-locked engine into a domain-blind synthetic-population simulator. We start at the load-bearing seam: extract Socials into Pack #1 behind a pluggable `DomainPack` engine, *wrapping* (never refactoring) the frozen Apollo/virality math and locking creator output byte-identical. We then de-risk the milestone's make-or-break question with a small spike — can a user build a *trustworthy* SIM with no calibration data? — before any General surface is built on top of it. From there we generalize `audiences` into a domain-agnostic population with honest Validated/Directional badging, widen the inbox to text/file/image, and ship the PMF on-ramp wow (Profile-a-chat → Simulate-a-reply) as one end-to-end thread. Predict (always Directional) adds narrative breadth, and finally the Audience-as-front-door surface ties the verbs together — all behind the Audience picker so the creator experience never changes.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Phases are milestone-scoped (numbered 1-N for v7.0). The engine-rework "Phase 0" signature substrate is already on `main` and is NOT a build phase here.

- [x] **Phase 1: Engine / Pack Seam** - Engine goes domain-blind; Socials becomes Pack #1 with pluggable scoring, creator output byte-identical (completed 2026-06-26)
- [x] **Phase 2: Trustworthy-SIM Spike** - De-risk the make-or-break question: a trustworthy SIM with zero calibration via determinism + provenance + honest tiering (completed 2026-06-26 — verdict NO-GO conditional, clears to GO after dropping thinking-mode synth)
- [ ] **Phase 3: General Population + Honesty Layer** - `audiences` generalizes into a domain-agnostic SIM library with Validated/Directional badges and surfaced provenance
- [ ] **Phase 4: Input Adapter** - One inbox door accepts text/file/image, normalizes to a `Stimulus`, auto-selects the SIM-1 tier
- [ ] **Phase 5: Profile → Simulate Wow** - The on-ramp: Profile a chat into a saved audience, then Simulate a reply through it, in one thread
- [ ] **Phase 6: Predict Verb** - Analyst-panel scenario reasoning collapses to probability/factors/confidence, always honestly Directional
- [ ] **Phase 7: Audience-as-Front-Door Surface** - The Audience picker becomes the primary context-setter tying the verbs together; creator experience byte-identical

## Phase Details

### Phase 1: Engine / Pack Seam

**Goal**: The core engine runs domain-blind via a `DomainPack` interface, with Socials extracted into Pack #1 and scoring supplied by the pack — and the creator pipeline still produces identical output.
**Depends on**: Nothing (first phase; builds on the signature substrate already on `main`)
**Requirements**: PACK-01, PACK-02, PACK-03, PACK-04
**Success Criteria** (what must be TRUE):

  1. The core run path runs `pack[mode].run(...)` against a `DomainPack` (`populations / grounding / stimulusTypes / reactionFrame / scoring / outputSchema / calibration`) with no socials-specific logic remaining on it.
  2. Socials is populated as Pack #1 against the schema; its success criterion and aggregation are supplied by the pack, not hardcoded in the core.
  3. The frozen Apollo/virality math runs unchanged as Pack #1's *wrapped* scorer (no refactor of the scoring math itself).
  4. ⚠️ SUPERSEDED by CONTEXT D-02/D-03: the byte-identical golden-master lock is dropped. The phase gate is a LIGHT smoke + structural check — the Socials run completes and its output schema is structurally valid (`overall_score ∈ [0,100]`), NOT exact values.

**Plans**: 6 plans
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Wave 0: `npm install` + green pre-seam baseline (PACK-04) ✅
- [x] 01-02-PLAN.md — DomainPack 7-field interface + contract probe (PACK-03)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-03-PLAN.md — SOCIALS_PACK (wrap aggregateScores whole) + resolvePack dispatcher (PACK-02, PACK-03)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-04-PLAN.md — D-03 BLOCKING smoke + structural gate (PACK-04)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-05-PLAN.md — Wire route.ts JSON + SSE call sites through the pack (PACK-01)
- [x] 01-06-PLAN.md — Wire eval-runner + learning/predict call sites through the pack (PACK-01)

### Phase 2: Trustworthy-SIM Spike

**Goal**: Prove that a user can build a *trustworthy* General SIM with no calibration data — de-risking the vision's make-or-break open question (§7) before any General surface is invested in.
**Depends on**: Phase 1
**Requirements**: TRUST-03
**Success Criteria** (what must be TRUE):

  1. The same SIM baked twice (temp 0 + seed, bake-once) produces an identical signature — determinism is demonstrably verifiable, not a dice roll.
  2. Every reactor persona in a no-calibration SIM carries its evidence + provenance, and ungrounded personas are distinguishable from grounded ones.
  3. A SIM with no calibration set is honestly tiered Directional (never Validated), and the spike closes with a written go/no-go verdict on whether the no-calibration trust model holds for the General surface.

**Plans**: 3 plans
Plans:
**Wave 1**

- [x] 02-01-PLAN.md — KEEP determinism gate: signature-equality (normalize/equal) + zero-network replay test + Directional-by-rule tiering assertion (TRUST-03)

**Wave 2** *(blocked on Wave 1)*

- [x] 02-02-PLAN.md — THROWAWAY live probe: ×2 double-bake (real Qwen) + General-bundle proto + provenance/source=user inspection (autonomous:false, needs keys + ~$0.50) (TRUST-03) — ✅ COMPLETE: live probe RAN on khaby.lame (human-approved spend). **DETERMINISM = NON-DETERMINISTIC** (genuine, matched watch counts A=3 B=3 → not transport; thinking-mode synth temp0+seed insufficient, `signatureEqual:false`); **PROVENANCE GREEN** (10/10 grounded all bakes, source=user surfaced); **TIERING GREEN** (Directional). Evidence verbatim in `02-02-SUMMARY.md`. 2 latent prod bugs fixed en route (subtitleLinks:null `dbbcf46c`, synth timeout 60→120s `aa783456`). Verdict → 02-03.

**Wave 3** *(blocked on Wave 2)*

- [x] 02-03-PLAN.md — SPIKE-VERDICT.md (hard 3-gate GO/NO-GO + fallback) + throwaway teardown (TRUST-03) — ✅ COMPLETE: verdict = **NO-GO (conditional)** — Determinism FAIL (genuine), Provenance + Tiering PASS; fallback to GO = drop thinking-mode synth then re-confirm `signatureEqual:true`. Threw away `scripts/spike/*` (D-05); KEEP gate green (135 tests). Commits a14af4b9, 362ef8df.

### Phase 3: General Population + Honesty Layer

**Goal**: `audiences` generalizes into a domain-agnostic population on the signature substrate — saveable, named, browseable, with an authorable success-criterion — and every audience and run wears an honest trust badge with surfaced provenance.
**Depends on**: Phase 2
**Requirements**: POP-01, POP-02, POP-03, POP-04, POP-05, TRUST-01, TRUST-02
**Success Criteria** (what must be TRUE):

  1. A General audience exists on the signature substrate with the socials enums and fixed 4-weight model now optional/pack-supplied; existing Socials audiences migrate cleanly and still run unchanged.
  2. A General audience carries its Mode, a trust tier, and an editable success-criterion (the metric the pack scorer optimizes), and a user can author and edit that success-criterion.
  3. A user can save, name, browse, and reuse General audiences in a General library, and a built-in default template panel (e.g. analyst / hiring) runs with zero setup.
  4. Each audience and each run shows a Validated vs Directional badge in the UI.
  5. A persona's provenance is surfaced — the evidence behind it is visible, and ungrounded personas read as visibly ungrounded.

**Plans**: 7 plans
Plans:
**Wave 0** *(determinism gate — D-01, paid live re-bake)*

- [ ] 03-01-PLAN.md — Drop thinking-mode synth + live double-bake re-confirm (`signatureEqual:true`) — autonomous:false (POP-01)

**Wave 1** *(blocked on Wave 0 — foundation, parallel)*

- [ ] 03-02-PLAN.md — Audience type fields (mode/success_criterion/custom_context/CustomContext) + resolveTier resolver + truth-table test (POP-01, POP-02, TRUST-01)
- [ ] 03-03-PLAN.md — Additive mode-gated migration + [BLOCKING] `supabase db push` — autonomous:false (POP-01)

**Wave 2** *(blocked on Wave 1)*

- [ ] 03-04-PLAN.md — Repo row mappers + zod + mode='socials' on constants + GENERAL_TEMPLATES (analyst/hiring) (POP-01, POP-03, POP-04)

**Wave 3** *(blocked on Wave 2 — parallel)*

- [ ] 03-05-PLAN.md — isPersonaGrounded + TrustBadge + card honesty (inline evidence/ungrounded) + manager templates section (TRUST-01, TRUST-02, POP-03)
- [ ] 03-06-PLAN.md — Route schemas + form: success-criterion + custom-context author/edit (POP-05, POP-02, TRUST-02)

**Wave 4** *(blocked on Wave 3)*

- [ ] 03-07-PLAN.md — Run/result Read card trust badge (A5 — additive block field + TrustBadge mount) (TRUST-01)

**UI hint**: yes

### Phase 4: Input Adapter

**Goal**: One inbox door accepts text, file, and image inputs in addition to video/URL, normalizing any input into a `Stimulus` and auto-selecting the SIM-1 tier — so the General verbs can accept non-video stimuli.
**Depends on**: Phase 1
**Requirements**: IN-01, IN-02, IN-03
**Success Criteria** (what must be TRUE):

  1. The composer inbox accepts text and file uploads (`.txt` / doc) alongside video/URL and normalizes each into a `Stimulus`.
  2. The inbox accepts screenshot/image uploads and OCR-extracts them into the `Stimulus`.
  3. SIM-1 auto-selects its tier (Flash for text, Max for video) from the input type — never a user choice.
  4. The creator (Socials) video/URL path through the inbox is unchanged.

**Plans**: TBD
**UI hint**: yes

### Phase 5: Profile → Simulate Wow

**Goal**: Deliver the PMF on-ramp — a user profiles a chat into a saved person/panel audience, then simulates a reply through it, as one continuous end-to-end thread.
**Depends on**: Phase 3, Phase 4
**Requirements**: PROF-01, PROF-02, PROF-03, PROF-04, SIMU-01, SIMU-02, SIMU-03
**Success Criteria** (what must be TRUE):

  1. A user uploads evidence (chat `.txt` / doc) and SIM-1 builds a person/panel audience from it, shown as a Profile result card backed by evidence quotes.
  2. The Profile-built audience is saved to the General library and offers a chain CTA "Simulate a message to [them]".
  3. `simulate(audience, stimulus)` runs a stimulus through a General audience and returns reactions rendered as a reaction-distribution card (distribution + themes).
  4. The full Profile-a-chat → Simulate-a-reply flow completes end-to-end within a single thread.

**Plans**: TBD
**UI hint**: yes

### Phase 6: Predict Verb

**Goal**: A user can run an analyst-panel scenario prediction that collapses to probability, factors, and confidence — always honestly Directional, never an oracle.
**Depends on**: Phase 5
**Requirements**: PRED-01, PRED-02, PRED-03
**Success Criteria** (what must be TRUE):

  1. `predict(panel, scenario)` simulates an analyst panel across scenario branches and collapses to a probability + factors + confidence.
  2. A prediction-gauge result card renders the probability, factors, and confidence.
  3. Predict output is always Directional and always shows its assumptions + receipts — never presented as an oracle.

**Plans**: TBD
**UI hint**: yes

### Phase 7: Audience-as-Front-Door Surface

**Goal**: The Audience picker becomes the primary context-setter that ties the three verbs together — Mode-scoped, with a generalized ambient reactor and a wow-seeded empty state — while the creator experience stays byte-identical.
**Depends on**: Phase 6
**Requirements**: UX-01, UX-02, UX-03, UX-04, UX-05
**Success Criteria** (what must be TRUE):

  1. The Audience picker is promoted to the primary front-door context-setter (picker + library), sectioned by Mode (Socials / General).
  2. The skill menu is Mode-scoped — the active audience's mode decides the available skills — and the Socials creator default is unchanged.
  3. The ambient reactor is generalized so the active Audience reacts live as the user drafts, with the creator experience byte-identical.
  4. A "Build an audience" entry offers from-description / from-evidence / from-template.
  5. The home empty state seeds starter chips to the wow (Test on your audience / Profile a chat / Predict an outcome) and the first-run demo is the profile-chat moment.

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Engine / Pack Seam | 6/6 | Complete    | 2026-06-26 |
| 2. Trustworthy-SIM Spike | 3/3 | Complete    | 2026-06-26 |
| 3. General Population + Honesty Layer | 0/7 | Planned | - |
| 4. Input Adapter | 0/TBD | Not started | - |
| 5. Profile → Simulate Wow | 0/TBD | Not started | - |
| 6. Predict Verb | 0/TBD | Not started | - |
| 7. Audience-as-Front-Door Surface | 0/TBD | Not started | - |

---
*Roadmap created 2026-06-26. 30 v1 requirements mapped across 7 phases (100% coverage). Granularity: fine. Phase 0 (signature substrate) already on `main` — do NOT `git merge rework/engine-core`. Phase 1 planned 2026-06-26 (6 plans, 4 waves). Phase 3 planned 2026-06-27 (7 plans, Waves 0–4; D-01 determinism gate is Wave 0).*
