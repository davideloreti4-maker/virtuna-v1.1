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
- [x] **Phase 3: General Population + Honesty Layer** - `audiences` generalizes into a domain-agnostic SIM library with Validated/Directional badges and surfaced provenance (BUILT 2026-06-27 — 7/7 plans; auto-verified 5/5 must-haves + all 7 req IDs; WR-01 honesty fix applied; **awaiting human UAT → `/gsd-verify-work 3`**. TRUST-01 closed on both audience surface + run card; D-01 determinism resolved via bake-once-freeze) (completed 2026-06-27)
- [x] **Phase 4: Input Adapter** - One inbox door accepts text/file/image, normalizes to a `Stimulus`, auto-selects the SIM-1 tier (BUILT 2026-06-27 — 4/4 plans; `normalizeStimulus` adapter door GREEN, full stimulus suite GREEN; IN-01/02/03 closed)
- [x] **Phase 5: Profile → Simulate Wow** - The on-ramp: Profile a chat into a saved audience, then Simulate a reply through it, in one thread (completed 2026-06-28)
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

- [x] 03-01-PLAN.md — Drop thinking-mode synth + live double-bake gate (POP-01) ✅ (c4c7b5c9, 6d5854a2). Live gate RAN: synth non-deterministic even isolated (MoE batch-routing) → operator adopted **bake-once-freeze (Option 2)**; determinism contracted on the frozen signature + green replay gate; cross-bake → v2 (CAL-01)

**Wave 1** *(blocked on Wave 0 — foundation, parallel)*

- [x] 03-02-PLAN.md — Audience type fields (mode/success_criterion/custom_context/CustomContext) + resolveTier resolver + truth-table test (POP-01, POP-02, TRUST-01) ✅ (40148540, d16046f2)
- [x] 03-03-PLAN.md — Additive mode-gated migration + live apply (POP-01) ✅ (6d8b6073). Applied to live `virtuna-v1.1` via Supabase MCP (operator-authorized) + verified: 2 rows backfilled mode='socials', gated CHECK live, 3 columns present; history version reconciled to 20260627000000

**Wave 2** *(blocked on Wave 1)*

- [x] 03-04-PLAN.md — Repo row mappers + zod + mode='socials' on constants + GENERAL_TEMPLATES (analyst/hiring) (POP-01, POP-03, POP-04) ✅ (b28e493a, 98f65169); audience suite 12 files/157 passed

**Wave 3** *(blocked on Wave 2 — parallel)*

- [x] 03-05-PLAN.md — isPersonaGrounded + TrustBadge + card honesty (inline evidence/ungrounded) + manager templates section (TRUST-01, TRUST-02, POP-03)
- [x] 03-06-PLAN.md — Route schemas + form: success-criterion + custom-context author/edit (POP-05, POP-02, TRUST-02) ✅ (fae6d676, d2d200ef); route suite 25 passed, audience 92 passed, reskin guard green

**Wave 4** *(blocked on Wave 3)*

- [x] 03-07-PLAN.md — Run/result Read card trust badge (A5 — additive `props.tier` enum + TrustBadge mount + emitter resolveTier wiring) (TRUST-01) ✅ (5bdc34c0, a9731b44, 7d730ae9); route suite 5 passed, flash 116 passed, reskin guard green

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

**Plans**: 4 plans
Plans:
**Wave 0** *(Nyquist test scaffold + `Stimulus` contract)*

- [x] 04-01-PLAN.md — `Stimulus` type + widen `StimulusType` union (file_text/image) + 5 Wave-0 test stubs (+ gated A2 base64 smoke) (IN-01, IN-02, IN-03) ✅ (42615adc, cc87d0f2); smoke GREEN, 4 unit stubs RED-pending Waves 1–2

**Wave 1** *(blocked on Wave 0 — parallel leaf modules, no file overlap)*

- [x] 04-02-PLAN.md — `tier.ts` (resolveSim1Tier, pure, IN-02) + `ingest.ts` (.txt/.md read + V5/V12 validation, IN-01) (IN-02, IN-01) ✅ (c81e8bbe, a9ab6700); tier.test.ts 4/4 + ingest.test.ts 5/5 GREEN
- [x] 04-03-PLAN.md — `vision.ts` (screenshot → qwen3.7-plus vision read, base64, never omni, IN-03) (IN-03) ✅ (f06516e9); vision.test.ts 5/5 GREEN (+1 gated live smoke skipped)

**Wave 2** *(blocked on Wave 1)*

- [x] 04-04-PLAN.md — `normalize.ts` (`normalizeStimulus` adapter entry — orchestrates ingest/vision/tier; profiler-ready person-video tag, D-06) (IN-01, IN-02, IN-03) ✅ (9386564d); normalize.test.ts 4/4 GREEN, full stimulus suite 5 files/20 passed; Socials path untouched (D-02)

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

**Security carry-forward (P3 code-review IN-02)**: `simulate()` is the FIRST place user-authored `success_criterion` + `custom_context` flow into a model prompt. Treat them as UNTRUSTED — delimit / instruction-isolate, never concatenate raw into the scorer prompt (prompt-injection). P3's `sanitizeText` only strips control chars for storage/XSS, NOT prompt safety. Detail: `.planning/phases/03-general-population-honesty-layer/03-REVIEW.md` §IN-02.

**Security carry-forward (P4 secure-phase, 2026-06-28 — `.planning/phases/04-input-adapter/04-SECURITY.md` AR-04-01/02)**: P4 accepted two latent items because their trust boundary (the HTTP route + storage dereference) lands HERE. MUST close in P5: (1) **`storagePath` sanitization** (T-04-04-03b / WR-03, MEDIUM) — before any `storage` fetch, reject `..`/absolute and enforce a key-shape regex (e.g. `^[\w-]+\/[\w.-]+$`), or add `.regex()` to `StimulusSchema.storagePath`; the "only safe path" claim must become enforced, not asserted. (2) **`text` content cap** (T-04-04-04 / WR-02, LOW–MEDIUM) — bound the `text` stimulus kind (`.max()` on `content` or a route-level cap) to match the file/image DoS posture.

**Profiler-read scope (from P4 discuss, 2026-06-27 — see `.planning/phases/04-input-adapter/04-CONTEXT.md` D-06)**: Profile's high-value deliverable is the **forensic profiler READ** — an expert behavioral/psychological analysis of a *specific person*, scoped to the user's goal (traits, tells, deception likelihood; e.g. *"narcissist tendencies because…"*, *"at 0:42 the micro-expression → high deception likelihood"*), from a chat **or a video of someone** — not just "build a reusable persona." This is the existing Apollo/Chase-Hughes behavioral knowledge core (`.planning/corpus/KNOWLEDGE-CORE.md`; parked `feat/chat-ethics-gate` work as a starting asset) generalized from "why content works" → "who this person is." Same engine spine, new reaction-frame + grounding. P4 makes the `Stimulus` profiler-ready (person-video + subject/goal tag); the READ is built HERE. Discuss whether to formally split PROFILE into build-an-Audience vs profiler-read deliverable at P5 discuss-phase.

**Plans**: 6 plans
Plans:
**Wave 1** *(interface-first foundations, parallel — no file overlap)*

- [x] 05-01-PLAN.md — Block contracts (profile-read + reaction-distribution) + registry/union/component-map wiring + profile→simulate chain handoff + persistence round-trip (PROF-02, PROF-04, SIMU-02, SIMU-03)
- [x] 05-02-PLAN.md — behavioral-core.ts: harvest the branch corpus → byte-stable cached behavioral system prompt + D-04 ethics block + tier-gated forensic directives (PROF-02)
- [x] 05-03-PLAN.md — profile-bake.ts: evidence → frozen person/panel AudienceSignature (reuse enrich-signature synth parts) + storagePath sanitize + omni person-video path (PROF-01) ✅ (0d1d8ad4); profile-bake 15/15, audience suite 13 files/172 passed; reuses synth PARTS not enrichSignature() (grep===0); D-08 isolation + AR-04-01 closed at lib layer

**Wave 2** *(blocked on Wave 1)*

- [x] 05-04-PLAN.md — profile-runner + /api/tools/profile: fused READ + bake → saved General SIM, tier-gated forensic, D-08 isolation, P4 carries closed (PROF-01, PROF-02, PROF-03) ✅ (c5903396); runProfile fuses the forensic READ + saved General SIM from ONE bake, tier-routed (flash→reasoning / max→omni, Pitfall 1 asserted), forensic gated to max (D-03), `__subject_kind` marker persisted (D-02/Pitfall 2), savedAudienceId on the block (PROF-04); route closes AR-04-01 (sanitizeStoragePath) + AR-04-02 (text cap); profile-runner 7/7 + route 5/5, tools+flash regression 27 files/313 passed, tsc clean
- [x] 05-05-PLAN.md — simulate-runner + /api/tools/simulate: Flash read → person/panel reaction-distribution, bands-only Directional, same thread (SIMU-01, SIMU-02, SIMU-03) ✅ (cf618428); runSimulate lifts two-audience-read's per-audience read (buildAudienceRepaint → runFlashTextMode → aggregateFlash), drops the 2-audience delta; deterministic person/panel branch from the persisted `__subject_kind` marker (never persona count, Pitfall 2 asserted); person → single lead read (band/fraction suppressed), panel → band+fraction(===aggregateFlash, never re-rolled)+themes+drill; tier Directional by rule; behavioral-core NOT imported (Pitfall 5, grep===0); route auth/csrf/cap/RLS-audience spine → SAME open thread (SIMU-03); simulate-runner 7/7 + route 5/5, runner+route+flash 19 files/216 passed, tsc clean

**Wave 3** *(blocked on Wave 2)*

- [x] 05-06-PLAN.md — minimal additive composer affordance → /api/tools/profile + end-to-end one-thread human-verify (PROF-01, SIMU-03) — DONE (92feb6c6): additive Paperclip attach + drag overlay + removable chip + inline D-09 reject, POSTs evidence StimulusInput to /api/tools/profile; profile-read + reaction-distribution render in-thread via MessageBlocks (bounded poll surfaces the card's same-thread Simulate result); creator path byte-identical; zero coral. **Task 2 end-to-end human-verify (real browser) PASSED 2026-06-29** — real chat → profile-read (evidence-quoted tells, Directional, no 0-100/N-of-10, zero accent) → Simulate → reaction-distribution in the SAME thread. Two bugs found+fixed live: open-thread divergence `15873d53` (createOpenThreadLazy get-first) + live-poll cache `3a9abfe5` (no-store). Deferred: simulate reaction content-framing (todo filed).

**UI hint**: yes

### Phase 6: Predict Verb

**Goal**: A user can run an analyst-panel scenario prediction that collapses to probability, factors, and confidence — always honestly Directional, never an oracle.
**Depends on**: Phase 5
**Requirements**: PRED-01, PRED-02, PRED-03
**Success Criteria** (what must be TRUE):

  1. `predict(panel, scenario)` simulates an analyst panel across scenario branches and collapses to a probability + factors + confidence.
  2. A prediction-gauge result card renders the probability, factors, and confidence.
  3. Predict output is always Directional and always shows its assumptions + receipts — never presented as an oracle.

**Plans**: 7 plans
Plans:
**Wave 0**

- [x] 06-01-PLAN.md — Predict schema contract (ordinal lean + factor, .strict() honesty guard) + Nyquist test scaffold (PRED-01, PRED-03)

**Wave 1** *(blocked on Wave 0 — parallel, no file overlap)*

- [x] 06-02-PLAN.md — predict-aggregate.ts: the novel honest collapse — band + panel-spread range + confidence + factors (PRED-01)
- [x] 06-03-PLAN.md — run-predict-panel.ts: the analyst-reasoning frame (drops stop/scroll) + D-07 injection isolation (PRED-01)
- [x] 06-04-PLAN.md — prediction-gauge block schema (.strict()) + feathered-span renderer + 3-file registration (PRED-02, PRED-03)

**Wave 2** *(blocked on Wave 1)*

- [ ] 06-05-PLAN.md — predict-runner.ts: orchestration + shared readSubjectKind + Directional assemble (PRED-01, PRED-03)

**Wave 3** *(blocked on Wave 2)*

- [ ] 06-06-PLAN.md — /api/tools/predict route: security spine + D-08 400 guards + one-thread persist (PRED-01, PRED-03)

**Wave 4** *(blocked on Wave 3)*

- [ ] 06-07-PLAN.md — chain CTA simulate→predict + Simulate-card edit + audienceId carry + end-to-end human-verify (PRED-01)

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
| 3. General Population + Honesty Layer | 7/7 | Complete    | 2026-06-27 |
| 4. Input Adapter | 4/4 | Complete    | 2026-06-28 |
| 5. Profile → Simulate Wow | 6/6 | Complete    | 2026-06-28 |
| 6. Predict Verb | 3/7 | In Progress|  |
| 7. Audience-as-Front-Door Surface | 0/TBD | Not started | - |

---
*Roadmap created 2026-06-26. 30 v1 requirements mapped across 7 phases (100% coverage). Granularity: fine. Phase 0 (signature substrate) already on `main` — do NOT `git merge rework/engine-core`. Phase 1 planned 2026-06-26 (6 plans, 4 waves). Phase 3 planned 2026-06-27 (7 plans, Waves 0–4; D-01 determinism gate is Wave 0).*
