# Phase 5: Profile → Simulate Wow - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-28
**Phase:** 5-profile-simulate-wow
**Areas discussed:** Profile deliverable shape, Simulate result card, Profiler grounding + ethics, One-thread wow + surface, Person/panel, READ depth, Ethics gate, Cut line

---

## Gray-area selection

User selected **all four** offered areas and added: *"add anything you think is needed and give me your thought through and grounded recommendation in the answer options to choose from."* → Claude drove each decision with a recommended option first; added the **Cut line** area and captured **Security (D-08)** as a locked constraint.

---

## Profile deliverable shape (D-06 reframe)

| Option | Description | Selected |
|--------|-------------|----------|
| Fuse: READ + saved SIM | One verb, one bake → forensic READ card (hero) + saved person/panel SIM the chain CTA targets | ✓ |
| Split into two verbs | Separate Build-Audience + Forensic-READ; more surface, dilutes the on-ramp | |
| Audience-only now, READ → v2 | Ship the reusable audience only; drops the differentiated wow | |

**User's choice:** Fuse: READ + saved SIM → **D-01**

---

## Simulate result card (SIMU-02)

| Option | Description | Selected |
|--------|-------------|----------|
| New reaction-distribution block | 1 audience → spread + themes + quotes; reuse Flash engine | ✓ |
| Extend multi-audience-read | Bend the 2-audience delta block; wrong framing | |
| Reuse persona-chat-turn | A single chat turn, not a distribution | |

**User's choice:** New reaction-distribution block → **D-06**

---

## Profiler READ grounding + parked branch

| Option | Description | Selected |
|--------|-------------|----------|
| Harvest corpus, not code | Embed BEHAVIORAL-CORE + ETHICS-GATE-SPEC as a cached behavioral prompt; re-eval branch code at research; don't merge | ✓ |
| Build on the branch code | Cherry-pick the unmerged, A/B-inconclusive, cost-flagged engine | |
| Fresh build, corpus-light | Re-derives the distilled Chase-Hughes mining | |

**User's choice:** Harvest corpus, not code → **D-05**
**Notes:** Claude located the asset mid-discussion — the behavioral brain lives only on `feat/chat-ethics-gate` (`.planning/corpus/BEHAVIORAL-CORE.md`, `ETHICS-GATE-SPEC.md`); the in-`src` `apollo-core.ts` core is the content/craft layer, not the behavioral one.

---

## One-thread wow + surface

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse thread + minimal inbox | Sequential blocks in the existing thread + forward-chain handoff + minimal drop-a-chat affordance; front-door stays P7 | ✓ |
| Dedicated General flow | More new UI; risks pulling P7 forward + the creator-composer rule | |
| Headless verbs, surface in P7 | Under-delivers SIMU-03's end-to-end wow | |

**User's choice:** Reuse thread + minimal inbox → **D-07**

---

## Person vs panel (+ how a person-SIM simulates)

| Option | Description | Selected |
|--------|-------------|----------|
| Detect; person=1 reactor, panel=spread | Default person; card adapts (single read vs distribution) | ✓ |
| Always a panel (facets) | Invents facets the evidence can't support | |
| Always single person (v1) | PROF-01 says "person/panel"; group chats are a real wow | |

**User's choice:** Detect; person=1 reactor, panel=spread → **D-02**

---

## Forensic READ depth (v1)

| Option | Description | Selected |
|--------|-------------|----------|
| Goal-scoped + video-tier richness | Who they are + tells + how they react (evidence-quoted); deception/micro-expression only on Max/video | ✓ |
| Full forensic always | Over-claims on thin text; honesty + ethics risk | |
| Persona summary only | Drops the D-06 differentiation | |

**User's choice:** Goal-scoped + video-tier richness → **D-03**

---

## Ethics handling (v1)

| Option | Description | Selected |
|--------|-------------|----------|
| Light guardrail + decision framing | Adopt ETHICS-GATE-SPEC spirit; refuse weaponization; honesty caveats; one boundary gate | ✓ |
| Full ethics gate (per spec) | Heavier build + cost flag; may gate too aggressively | |
| Product framing only | Zero enforced refusal on real-person reads = brand/safety exposure | |

**User's choice:** Light guardrail + decision framing → **D-04**

---

## P5 cut line

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm tight cut line | OUT: front-door/Mode-menu/ambient (P7), .docx/.pdf (P4), multi-stimulus, marketplace (v2), Predict (P6) | ✓ |
| Pull front-door picker forward | Bigger phase; risks the creator-composer rule | |
| Let me adjust the cut line | — | |

**User's choice:** Confirm tight cut line → **D-09**

---

## Claude's Discretion

- Exact Zod schemas for the two new blocks (`profile-read` + `reaction-distribution`).
- How Profile bakes from evidence (reuse `enrich-signature` w/ evidence source vs a Profile-specific bake) — research flag.
- Module layout for the verbs + runner→thread wiring; saved-SIM auto-naming; the minimal composer affordance shape; the behavioral system-prompt assembly; prompt-injection isolation mechanics (lock = D-08).

## Deferred Ideas

- Front-door Audience picker + Mode-scoped skill menu + generalized ambient reactor → P7.
- `.docx`/`.pdf` ingestion → later (parser deps); multi-stimulus/batch simulate → later.
- Full ETHICS-GATE-SPEC implementation → later if the light gate proves insufficient.
- Re-using the `feat/chat-ethics-gate` engine code → re-evaluate at research.
- SIM marketplace + flywheel (MKT-*), self-calibration (CAL-01), Anchor Pack #2 (PACK2-01) → v2.
- Predict verb → P6.
