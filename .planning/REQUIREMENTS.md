# Requirements: Numen GSI (v7.0)

**Defined:** 2026-06-26
**Core Value:** A calibrated, interrogable synthetic population you can run any stimulus through and get back a grounded, honest (Validated vs Directional) read — generalizing Numen from "analyze TikToks" to a domain-blind synthetic-population simulator.

> Scope: the PMF-shaped slice + all three General verbs. Engine/pack seam (Socials → Pack #1), pluggable scoring, `audiences` → general SIM, and the General surface (Profile / Simulate / Predict) with **Profile-a-chat → Simulate-reply** as the on-ramp wow. The creator (Socials) experience stays byte-identical; generality lives *behind* the Audience picker. Marketplace deferred. Input vision (exploratory, walk every section): `.planning/NUMEN-GSI-VISION.md`.

## v1 Requirements

Requirements for milestone v7.0. Each maps to exactly one roadmap phase.

### PACK — Engine / Pack Seam

- [x] **PACK-01**: The engine runs domain-blind via a `DomainPack` interface; the Socials assumptions are extracted into Pack #1, with no socials-specific logic on the core run path
- [x] **PACK-02**: Scoring is pluggable — the success criterion and aggregation are supplied by the pack; the frozen Apollo/virality math is *wrapped* as Pack #1's scorer with its behaviour unchanged
- [x] **PACK-03**: The `DomainPack` schema is defined (`populations / grounding / stimulusTypes / reactionFrame / scoring / outputSchema / calibration`) and Socials is populated against it as Pack #1
- [x] **PACK-04**: The creator (Socials) pipeline produces byte-identical output after the extraction (regression-locked against pre-seam fixtures)

### POP — General Population Object

- [x] **POP-01**: `audiences` is generalized into a domain-agnostic population on the signature substrate (socials enums + the fixed 4-weight model become optional/pack-supplied); existing Socials audiences migrate cleanly
- [x] **POP-02**: A General audience carries its Mode, a success-criterion, and a trust tier — _DONE 03-06 (route schemas accept + sanitize + cap mode/success_criterion/custom_context; form authors success-criterion + user-added grounding; trust tier via TrustBadge 03-05)_
- [x] **POP-03**: A user can save, name, browse, and reuse General audiences in a General library — _data-layer DONE 03-04 (create/list/rename through CRUD); browse/reuse surfaced 03-05 (General templates section in the manager); net-new General-from-scratch = P5, front-door mode picker = P7_
- [x] **POP-04**: Built-in General default template panel(s) (e.g. analyst / hiring) let a General run work with zero setup
- [x] **POP-05**: A user can author and edit a General audience's success-criterion (what "good" means — the metric the pack scorer optimizes for) — _DONE 03-06 (success-criterion Textarea in audience-form wired through POST/PATCH; route zod caps + sanitizes; scorer untouched per D-02 — surfaced not yet consumed)_

### TRUST — Honesty Layer

- [x] **TRUST-01**: Each audience and each run carries a Validated vs Directional badge, surfaced in the UI — _audience-surface badge DONE 03-05 (TrustBadge over resolveTier on the card); run-badge = downstream_
- [x] **TRUST-02**: Provenance is surfaced — a General audience's personas show the evidence behind them; ungrounded personas read as visibly ungrounded — _DONE 03-05 (inline evidence quote when grounded; muted "no evidence — Directional" affordance when not)_
- [x] **TRUST-03**: A user can build a *trustworthy* General SIM with no calibration data — guaranteed by determinism (temp 0 + seed, bake-once), provenance, and honest trust tiering (de-risked by an early spike per vision §7) — ✅ spike CLOSED 2026-06-26: provenance + tiering PASS; determinism FAIL (genuine thinking-mode synth) → verdict NO-GO conditional, clears to GO after dropping thinking-mode synth (see SPIKE-VERDICT.md)

### PROF — Profile Verb (the on-ramp)

- [x] **PROF-01**: A user can upload evidence (chat `.txt` / doc) and SIM-1 builds a person/panel audience from it
- [x] **PROF-02**: A Profile result card shows who the person/panel is, backed by evidence quotes
- [x] **PROF-03**: The audience built by Profile is saved to the General library
- [x] **PROF-04**: From a Profile, a chain CTA offers "Simulate a message to [them]"

### SIMU — Simulate Verb (General)

- [x] **SIMU-01**: `simulate(audience, stimulus)` runs a stimulus through a General audience and returns reactions
- [x] **SIMU-02**: A reaction-distribution result card renders the distribution + themes
- [x] **SIMU-03**: The end-to-end wow works in one thread: Profile-a-chat → Simulate-a-reply

### PRED — Predict Verb

- [x] **PRED-01**: `predict(panel, scenario)` simulates an analyst panel across scenario branches and collapses to probability + factors + confidence
- [ ] **PRED-02**: A prediction-gauge result card renders the probability, factors, and confidence
- [x] **PRED-03**: Predict output is always Directional and shows its assumptions + receipts (never presented as an oracle)

### IN — Input Adapter

- [x] **IN-01**: The composer inbox accepts text and file uploads (`.txt` / doc), not just video/URL, and normalizes them into a `Stimulus` (normalize primitive `normalizeStimulus` landed 04-04; inbox UI wiring = P5)
- [x] **IN-02**: The SIM-1 tier (Flash text / Max video) auto-selects from the input type
- [x] **IN-03**: The inbox accepts screenshot/image uploads, OCR-extracted into the `Stimulus` (read primitive `readImageWithVision` landed 04-03; inbox UI wiring = P5)

### UX — Audience-as-Front-Door Surface

- [ ] **UX-01**: The Audience picker is promoted to the primary context-setter (front-door picker + library), sectioned by Mode (Socials / General)
- [ ] **UX-02**: The skill menu is Mode-scoped (the active audience's mode decides the available skills); the Socials creator default is unchanged
- [ ] **UX-03**: The ambient reactor is generalized — the active Audience reacts live as the user drafts, with the creator experience byte-identical
- [ ] **UX-04**: A "Build an audience" entry offers from-description / from-evidence / from-template
- [ ] **UX-05**: The home empty state seeds starter chips to the wow (Test on your audience / Profile a chat / Predict an outcome); the first-run demo is the profile-chat moment

## v2 Requirements

Deferred to a future milestone. Tracked, not in this roadmap.

### Marketplace

- **MKT-01**: A user can share a SIM (audience) publicly
- **MKT-02**: A user can sell a SIM; marketplace economics / rev-share
- **MKT-03**: Outcome data feeds back to re-calibrate shared SIMs (the flywheel)

### Anchor Pack #2

- **PACK2-01**: A second Numen-authored anchor pack (Marketing — population ≈ creators, grounding adjacent) ships as a second "Validated" pack

### Self-Calibration

- **CAL-01**: A user can upload their own outcome history to promote a Directional SIM toward Validated

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Open-world prediction (Iran war, election-without-a-poll, "will X happen") | No owned population to simulate, no stimulus, no calibration → no moat (vision §8). If ever wanted, a separate Metaculus-shaped forecasting product, not this engine. |
| SIM-1 as a user-selectable model | SIM-1 is a visible engine badge that auto-runs Flash/Max; never a user choice (vision §13) |
| Refactoring the socials Apollo/virality scoring math | *Wrap* it as Pack #1's scorer behind the seam; refactoring the load-bearing socials math is the deep-surgery risk (vision §10) |
| `git merge rework/engine-core` | The signature-substrate content already landed on `main` piecemeal; merging replays merged work as conflicts/dupes (treat the branch as history only) |
| Changing the creator (Socials) composer UX | Creator core stays byte-identical; generality lives behind the Audience picker (vision §15.2) |

## Traceability

Phases assigned during roadmap creation. All Pending.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PACK-01 | Phase 1 | Complete |
| PACK-02 | Phase 1 | Complete |
| PACK-03 | Phase 1 | Complete |
| PACK-04 | Phase 1 | Complete |
| POP-01 | Phase 3 | Complete |
| POP-02 | Phase 3 | Done (03-06 route schemas + form fields + 03-05 trust tier) |
| POP-03 | Phase 3 | Done (03-04 data-layer + 03-05 browse/reuse; net-new General-from-scratch P5/P7) |
| POP-04 | Phase 3 | Complete (03-04) |
| POP-05 | Phase 3 | Done (03-06 success-criterion author/edit form + route validation) |
| TRUST-01 | Phase 3 | Done (03-05 audience-surface badge; 03-07 run/result card badge) |
| TRUST-02 | Phase 3 | Done (03-05 inline evidence + ungrounded affordance) |
| TRUST-03 | Phase 2 | Complete |
| PROF-01 | Phase 5 | Complete |
| PROF-02 | Phase 5 | Complete |
| PROF-03 | Phase 5 | Complete |
| PROF-04 | Phase 5 | Complete |
| SIMU-01 | Phase 5 | Complete |
| SIMU-02 | Phase 5 | Complete |
| SIMU-03 | Phase 5 | Complete |
| PRED-01 | Phase 6 | Complete |
| PRED-02 | Phase 6 | Pending |
| PRED-03 | Phase 6 | Complete |
| IN-01 | Phase 4 | Complete (04-04) |
| IN-02 | Phase 4 | Complete (04-02) |
| IN-03 | Phase 4 | Complete (04-03) |
| UX-01 | Phase 7 | Pending |
| UX-02 | Phase 7 | Pending |
| UX-03 | Phase 7 | Pending |
| UX-04 | Phase 7 | Pending |
| UX-05 | Phase 7 | Pending |

**Coverage:**

- v1 requirements: 30 total
- Mapped to phases: 30 (100%)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-26*
*Last updated: 2026-06-26 — traceability filled during roadmap creation (7 phases, 100% coverage)*
