# Phase 5: Profile → Simulate Wow - Context

**Gathered:** 2026-06-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the **PMF on-ramp**: two NEW General verbs that chain in **one thread**.

- **PROFILE** — the user drops chat evidence (`.txt`/`.md`/doc, screenshot, or a **person-video**) → SIM-1 builds a **person/panel General audience** AND produces a **forensic behavioral READ** (who they are, behavioral tells, how they'll react — **evidence-quoted, goal-scoped**) rendered as the **hero result card** → the same bake is **saved to the General library** → a chain CTA **"Simulate a message to [them]"**. (PROF-01…04 + the P4 **D-06** reframe)
- **SIMULATE (General)** — `simulate(audience, stimulus)` runs a P4 `Stimulus` (the user's drafted reply/message) through a General audience → a **reaction-distribution** result card (distribution + themes). (SIMU-01/02)
- **End-to-end in ONE thread** — Profile-a-chat → Simulate-a-reply, continuous. (SIMU-03)

This phase ALSO ships the **visible "drop a chat / screenshot" inbox affordance** that P4 (D-01) deferred to its consumer — **minimal, in the existing composer**. It does **NOT** ship the front-door Audience picker, the Mode-scoped skill menu, or the generalized ambient reactor (all **P7**), nor the Predict verb (**P6**).

**Depends on:** Phase 3 (General audience + honesty layer + General library + `success_criterion`/`custom_context`) and Phase 4 (the `Stimulus` adapter). **Consumers:** P6 (Predict reuses the General-simulate substrate), P7 (promotes the surface).

**Carry-forward (locked, NOT re-asked):**
- **Stimulus contract is P4-frozen** — `normalizeStimulus` → `{ content, kind, source, subject/goal tag, tier }`. Simulate consumes it as-is; no re-cut (P4 D-02/D-06).
- **Honesty spine** — bands only (Strong/Mixed/Weak), **never** a numeric 0-100 score; a General audience is **Directional** by rule (`resolveTier`, never Validated). SIM-1 **Flash/Max badge renders here** (P4 computed+carried the tier; the visible badge was deferred to its consumer = P5).
- **Creator (Socials) composer stays byte-identical** — generality lives behind the (P7) Audience picker; P5 adds only a minimal additive affordance, never restructures the creator path (PROJECT.md locked constraint, VISION §15.2).

</domain>

<decisions>
## Implementation Decisions

### Profile verb — shape & deliverable (the D-06 reframe)
- **D-01: FUSE — one Profile verb, one bake → forensic READ card (hero) + saved person/panel SIM.** Profile does a SINGLE bake from the evidence; the **forensic behavioral READ is the hero result card** (the wow — who they are, behavioral tells, how they'll react, goal-scoped, evidence-quoted), and **the same baked person/panel is the saved General audience** that the chain CTA targets. One continuous flow satisfies PROF-01 (build), PROF-02 (READ card backed by evidence quotes), PROF-03 (saved to the General library), PROF-04 (chain CTA). **Rejected:** split into two verbs (Build-Audience + Forensic-READ → more surface, dilutes the single on-ramp moment — a split, if ever, is P7); audience-only-now-READ-to-v2 (drops the differentiated wow the founder reframed Profile around in P4 D-06).
- **D-02: Person vs panel is DETECTED from the evidence; default = person.** One counterparty in the chat → a **"person" SIM** (1 calibrated reactor persona = that person); a group chat / multi-party doc → a **"panel" SIM** (N personas). The reaction-distribution card **adapts**: a person-SIM shows **that one person's reaction + reasoning** (framed as a single read, not a fake distribution-of-one); a panel shows the **spread + clustered themes**. Default to **person** — the wow case is "profile the person I'm talking to." **Rejected:** always-a-panel-of-facets (invents moods/contexts the evidence can't support → honesty risk); always-single-person-v1 (PROF-01 says "person/panel"; group chats are a real wow case).
- **D-03: READ depth = goal-scoped, with the deep forensic layer riding the Max/video tier ONLY.** One Flash (chat/doc/screenshot) or Max (person-video) call returns: **who they are** (traits, comms style, drivers), **behavioral tells**, and **how they'll likely react to the user's goal** — all evidence-quoted. The **deeper forensic layer** (deception likelihood, micro-expression timestamps like *"at 0:42 the shoulder shift → high deception likelihood"*) is emitted **only on the Max/video tier**, where the signal actually exists. The READ is scoped to the user's stated goal (the `subject.goal` tag on the `Stimulus` + the audience `success_criterion`), not a generic dossier. **Rejected:** full-forensic-always (over-claims on thin text — a chat can't support micro-expression reads → honesty + ethics risk); persona-summary-only (drops the D-06 differentiation).
- **D-04: Ethics = a LIGHT guardrail + decision framing (adopt the spirit of ETHICS-GATE-SPEC, not the full gate).** Frame every READ as **"a behavioral read to inform YOUR decision"** (negotiation / hiring / safety / dating-safety), **refuse overt weaponization** (manipulate/coerce/stalk/dox), and keep **honesty caveats** ("directional, from limited evidence"). One boundary gate at the prompt layer; **no heavy classifier**. **Rejected:** full ETHICS-GATE-SPEC implementation (the branch's heavier gate — more build + cost flag, may gate too aggressively for the wow); product-framing-only (a forensic "deception/narcissist" read of a named real person with zero enforced refusal is a real brand/safety exposure).

### Profiler READ grounding (the behavioral brain)
- **D-05: HARVEST the parked branch's CORPUS, not its code.** The behavioral/forensic grounding the READ needs ("who this *person* is") is **distinct** from the in-`src` Apollo `KNOWLEDGE_CORE` (apollo-core.ts — that is the **craft** layer, "why *content* works", used by content skills). The behavioral brain lives only on the parked **`feat/chat-ethics-gate`** branch as corpus docs. Plan: **harvest** `BEHAVIORAL-CORE.md` (+ `ETHICS-GATE-SPEC.md`, `KNOWLEDGE-CORE-2.6-behavioral-DRAFT.md`, the Chase-Hughes mining) and **embed the behavioral core as a cached system prompt mirroring `apollo-core.ts`** (a NEW behavioral reaction-frame on the same engine spine). **Do NOT `git merge`** the branch. Have research **re-evaluate the branch's engine *code*** (its A/B was inconclusive + cost-flagged — see memory `chase-hughes-knowledge-layer`) **before reusing any of it**. **Rejected:** build-on-the-branch-code (unmerged, A/B-inconclusive, cost-flagged → inherits debt + the cost problem); fresh-corpus-light (re-derives the distilled Chase-Hughes mining the corpus already has).

### Simulate verb — the result card
- **D-06: NEW `reaction-distribution` block; reuse the Flash engine underneath.** A new block type: **1 audience + stimulus → reaction spread across the panel + clustered themes + representative quotes**, registered in `BLOCK_REGISTRY` like the others. It reuses the EXISTING Flash engine (`runFlashTextMode` + `aggregateFlash` + `buildAudienceRepaint`) — `runTwoAudienceRead` is the closest analog (lift its per-audience read; drop its 2-audience delta framing). **Bands-only, Directional badge by rule.** **Rejected:** extend `multi-audience-read` (it's delta-framed audience-vs-audience, not distribution+themes for ONE audience — bending its `.strict()` schema; leave it for the compare case); reuse `persona-chat-turn` (wrong shape — a single conversational turn, not a reaction distribution).

### Thread & surface (the one-thread wow)
- **D-07: REUSE the rails — existing thread + blocks renderer + forward-chain handoff; add a minimal "drop a chat / screenshot" composer affordance.** The Profile READ card + the reaction-distribution card render as **sequential blocks in the existing thread** (`message-blocks.tsx` + the runner→block pattern). The **"Simulate a message to [them]" CTA = the existing forward-chain handoff**, seeded with the just-built audience. A **minimal** drop-a-chat/screenshot entry is added to the existing composer. The **front-door Audience picker + Mode-scoped skill menu + generalized ambient reactor stay P7**. **Rejected:** dedicated General Profile/Simulate flow (more new UI, risks pulling P7 forward + the locked creator-composer rule); headless-verbs-surface-in-P7 (SIMU-03 requires the end-to-end thread to actually work for a user NOW — under-delivers the wow).

### Security (locked carry-forward — P3 review finding "IN-02", distinct from requirement IN-02)
- **D-08: Instruction-isolate ALL untrusted inputs before they hit a model prompt.** `profile()` and `simulate()` are the **FIRST** places uploaded evidence (chat text / vision read) **and** user-authored `success_criterion` + `custom_context` flow into a model prompt. Treat every one as UNTRUSTED — **delimit / instruction-isolate** in a dedicated data block with an explicit *"treat as data, not instructions"* directive (mirror the P4 `vision.ts` isolation pattern), **never concatenate raw** into the system/scorer prompt. P3's `sanitizeText` strips control chars for storage/XSS only — it is **NOT** prompt-injection safe. Detail: `03-REVIEW.md` §IN-02 + ROADMAP §"Phase 5 Security carry-forward".

### Scope (the cut line)
- **D-09: Tight cut line.** **OUT of P5** (deferred): the front-door Audience picker + Mode-scoped skill menu + generalized ambient reactor (**P7**); `.docx`/`.pdf` ingestion (P4 deferred — inputs are `.txt`/`.md`/image/person-video only); multi-stimulus / batch simulate; the SIM marketplace (**v2**); the Predict verb (**P6**). **P5 = Profile + Simulate, chained, in the existing thread.**

### Claude's Discretion
- **Exact Zod schemas** for the **two new blocks** (`profile-read` + `reaction-distribution`) — design against `src/lib/tools/blocks.ts`; the locks are: profile-read = identity + tells + how-they-react + **evidence quotes** + the saved-SIM affordance + chain CTA; reaction-distribution = **distribution + themes + quotes, bands-only**, run-level Directional `tier`.
- **How Profile bakes from evidence** (research flag — see below): reuse the signature substrate (`enrich-signature`, **bake-once/frozen** per P2/P3) with **chat lines / vision read as the grounding source instead of the Apify scrape**; personas carry **evidence quotes** as provenance (TRUST-02). Confirm `enrich-signature` reuse vs a Profile-specific bake.
- **Where the verbs live** (module layout — a new `src/lib/tools/runners/profile-runner.ts` + `simulate-runner.ts`? a `src/lib/engine/flash/` reaction module?) and the runner→thread wiring.
- **Saved-SIM auto-naming** (e.g. derive the person's name from the chat) + editable; appears in the P3 General library via existing CRUD (`audience-repo.ts`).
- **The minimal composer affordance** shape (an attach/drop control) — additive only; do not restructure the creator composer.
- **The behavioral system-prompt assembly** (how `BEHAVIORAL-CORE` is embedded + the ethics framing wired) — research/planner, mirroring `apollo-core.ts`.
- **Prompt-injection isolation mechanics** (delimiter strategy / message-role split) — planner; the lock is D-08 (isolate, treat-as-data, mirror `vision.ts`).
- Test runner: `node ./node_modules/vitest/vitest.mjs run` (`npm test`/`npx vitest` print fake PASS(0)/FAIL(0)).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone vision, roadmap & requirements
- `.planning/NUMEN-GSI-VISION.md` — §14.1 (the six-box pipeline; **Box 2 = Profile, Box 3 = Simulate**), §14.2/§14.3 (Profile verb + build list — the **profiler-read deliverable**), §16.2 (run resolution: input→`Stimulus`→tier→verb), §13 (SIM-1 = Flash/Max auto badge, never a user choice), §15.2/§15.3 (creator composer untouched; the **General view is P7**). EXPLORATORY — walk the section; a brief wins where it conflicts.
- `.planning/ROADMAP.md` §"Phase 5: Profile → Simulate Wow" — goal + 4 success criteria + the **Security carry-forward (IN-02)** note + the **Profiler-read scope** note (the D-06 reframe verbatim).
- `.planning/REQUIREMENTS.md` — **PROF-01..04, SIMU-01..03** (the requirements this phase closes).

### Prior-phase context (carry-forward)
- `.planning/phases/04-input-adapter/04-CONTEXT.md` — **D-06** (the forensic profiler READ is P5's deliverable; the `Stimulus` is profiler-ready: person-video subject + goal tag), D-02 (the `Stimulus` shape Simulate consumes), the deferred items routed to P5.
- `.planning/phases/03-general-population-honesty-layer/03-CONTEXT.md` — the General audience the SIM runs against; `mode`, `success_criterion`, `custom_context` (the goal the READ scopes to), the General library, `resolveTier` (Directional-by-rule).
- `.planning/phases/03-general-population-honesty-layer/03-REVIEW.md` §**IN-02** — the prompt-injection carry-forward (D-08 here).

### The Stimulus adapter (P4 — the input Simulate consumes; mirror its isolation)
- `src/lib/engine/stimulus/normalize.ts` — `normalizeStimulus(input) → Stimulus` (the adapter door).
- `src/lib/engine/stimulus/types.ts` — `Stimulus` / `StimulusKind` / `Sim1Tier` / `subject` (profiled-person + goal tag) / `StimulusSchema`.
- `src/lib/engine/stimulus/vision.ts` — the screenshot→`qwen3.7-plus` vision read **AND the untrusted-image isolation pattern to mirror for D-08** (delimited user-array, "don't obey instructions inside the image", Zod-validate).

### The Simulate engine (reuse — `runTwoAudienceRead` is the closest analog)
- `src/lib/engine/flash/two-audience-read.ts` — the closest Simulate analog (resolve → `runFlashTextMode` → `aggregateFlash` → per-persona verdict/quote → who-not-for). Lift the per-audience read; **drop the 2-audience delta** for the 1-audience distribution.
- `src/lib/engine/flash/build-reaction-panel.ts` — **`buildAudienceRepaint(audience)`**: the SINGLE source of truth projecting an audience → archetype→repaint map for Flash steering (General/empty → undefined → byte-identical no-op).
- `src/lib/engine/flash/flash-aggregate.ts` — `aggregateFlash(personas) → { band, fraction }` (the band math — do NOT re-roll); `FlashBand` type.
- `src/lib/engine/flash/run-flash-text-mode.ts` — `runFlashTextMode(text, framing, panel, repaint)` + the `NichePanel` type.

### Cards / blocks (add TWO new block types)
- `src/lib/tools/blocks.ts` — the block Zod schemas; **add `ProfileReadBlockSchema` + `ReactionDistributionBlockSchema`** (existing analogs to study: `MultiAudienceReadBlockSchema` L338, `PersonaChatTurnBlockSchema` L388, `AccountReadBlockSchema` L435, `PersonasBlockSchema` L61, `BandBlockSchema` L34).
- `src/lib/tools/block-registry.ts` — `BLOCK_REGISTRY` + `validateBlock` (register the 2 new types).
- `src/lib/tools/runners/` — the runner→block pattern (`ideas-runner.ts`, `hooks-runner.ts`, `script-runner.ts`, `remix-runner.ts`, `explore-runner.ts`, `chat-runner.ts`); the Profile/Simulate runners follow this.
- `src/components/**/message-blocks.tsx` — the renderer wiring (each block → component); the live `validateBlock` guard on rehydration.

### Audience bake + library (Profile's build target)
- `src/lib/audience/enrich-signature.ts` — the signature bake (**bake-once/frozen** per P2/P3); the research question is reusing it with **evidence as the grounding source** instead of the Apify scrape.
- `src/lib/audience/audience-types.ts` — `Audience` + `CalibratedPersona` (`archetype` + `repaint`) + `profile` (temperature_mix / top_dispositions).
- `src/lib/audience/audience-repo.ts` — CRUD + the General library + `GENERAL_AUDIENCE`/`GENERAL_TEMPLATES` (PROF-03 save target).
- `src/lib/audience/resolve-tier.ts` — `resolveTier` (Directional-by-rule for General; the run-level honesty badge).
- `src/lib/audience/audience-grounding.ts` — the audience-facing grounding-line pattern (honesty spine: only what's stored, never fabricated).

### Profiler grounding (the behavioral brain — branch `feat/chat-ethics-gate`, harvest CORPUS not code)
- `feat/chat-ethics-gate`:`.planning/corpus/BEHAVIORAL-CORE.md` — the distilled behavioral brain (the READ's grounding).
- `feat/chat-ethics-gate`:`.planning/corpus/ETHICS-GATE-SPEC.md` — the ethics gate spec (adopt the spirit for D-04).
- `feat/chat-ethics-gate`:`.planning/corpus/KNOWLEDGE-CORE-2.6-behavioral-DRAFT.md`, `.planning/corpus/HOW-TO-BUILD.md`, `.planning/HANDOFF-chase-hughes.md`, `.planning/corpus/_mining/chase-hughes/*` (extracts + `AB-RESULT-skit-260612.txt` + `_CRITIC-REPORT.md` — the inconclusive A/B + cost flag). **Do NOT merge the branch.**
- `src/lib/engine/apollo-core.ts` — the PATTERN to mirror: `KNOWLEDGE_CORE` → `APOLLO_SYSTEM_PROMPT` (byte-stable cached system prompt). (NB: this in-`src` core is the **craft** layer, not the behavioral one — the READ is a NEW behavioral prompt.)

### Model routing & policy
- `src/lib/engine/qwen/client.ts` — `QWEN_REASONING_MODEL=qwen3.7-plus` (Flash tier, text/vision, deaf) ⟺ chat/doc/screenshot READ; `QWEN_OMNI_MODEL=qwen3.5-omni-flash` (Max tier, audio sensor) ⟺ person-video READ.
- `docs/MODEL-POLICY.md` — the two-model-stack policy. Confirm before wiring the READ's tier→model.

### Surface (touch minimally — do NOT restructure)
- `src/components/app/home/composer.tsx` — the slim creator composer; P5 adds only a minimal additive "drop a chat / screenshot" affordance. Front-door promotion = P7.
- `src/lib/threads/messages.ts` — the thread message model (sequential blocks in one thread).

### Test runner
- Use `node ./node_modules/vitest/vitest.mjs run` — `npm test`/`npx vitest` emit fake PASS(0)/FAIL(0).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`runTwoAudienceRead`** (`flash/two-audience-read.ts`) — the Simulate analog; resolve → `runFlashTextMode` → `aggregateFlash` → per-persona `{archetype, verdict, quote}`. Simulate lifts the per-audience read, drops the delta.
- **`buildAudienceRepaint` / `buildReactionPanel`** (`flash/build-reaction-panel.ts`) — the shared, deterministic audience→repaint projection that makes the SIM steer reactions; the moat-credibility guarantee that text-SIM and video-fold simulate the SAME audience identically.
- **`aggregateFlash`** (`flash/flash-aggregate.ts`) — band + fraction math; reuse, do not re-roll (honesty spine).
- **`enrich-signature`** (`audience/enrich-signature.ts`) — the bake-once/frozen signature pipeline; Profile reuses it with evidence as the grounding source.
- **`audience-repo` + General library** (P3) — `GENERAL_AUDIENCE`, `GENERAL_TEMPLATES`, CRUD; PROF-03's save target with zero new persistence.
- **`apollo-core.ts` cached-system-prompt pattern** — the template for embedding `BEHAVIORAL-CORE` as the READ's grounding.
- **Runner→`BLOCK_REGISTRY`→`message-blocks.tsx`** — the entire card-emission pipeline; both new verbs ride it.
- **`vision.ts` isolation** (P4) — the untrusted-input isolation pattern to mirror for D-08.

### Established Patterns
- **Bands-only honesty** (`.strict()` schemas reject smuggled scores) + **Directional-by-rule** (`resolveTier`) — both new cards inherit this.
- **Bake-once / frozen signature** (P2 spike + P3 03-01) — the SIM is deterministic on the frozen persisted signature; Profile bakes once, never re-bakes.
- **Additive, wrap-don't-refactor** (P1/P4) — new verbs + blocks are additive; the Socials path + creator composer are untouched.
- **Forward-chain handoff** — the existing "next skill" CTA pattern; PROF-04's "Simulate a message to [them]" reuses it.
- **Two-model stack** (`qwen/client.ts`) — Max(omni) only for audio-bearing video; Flash(3.7-plus) for everything else incl. vision; the READ's tier follows the `Stimulus.tier`.

### Integration Points
- **Profile:** evidence `Stimulus` (`normalizeStimulus`) → behavioral READ call (cached `BEHAVIORAL-CORE` prompt, tier-routed) + person/panel bake (`enrich-signature` w/ evidence) → `profile-read` block + saved General audience (`audience-repo`) → forward-chain CTA.
- **Simulate:** drafted-message `Stimulus` + active General audience → `runFlashTextMode` (steered by `buildAudienceRepaint`) → `aggregateFlash` → `reaction-distribution` block (distribution + themes), Directional badge.
- **Thread:** both blocks append as sequential messages in the existing thread (`threads/messages.ts`); the chain is one continuous thread (SIMU-03).
- **Untrusted boundary:** uploaded evidence + `success_criterion`/`custom_context` → model prompt — instruction-isolated (D-08).

</code_context>

<specifics>
## Specific Ideas

- **The wow is one continuous thread:** drop a chat → a forensic READ of the person appears (with evidence quotes) → "Simulate a message to them" → draft a reply → see how that person reacts. No surface-hopping.
- **Founder reframed Profile (P4 D-06):** the high-value deliverable is the **forensic behavioral READ** (*"narcissistic tendencies because…"*, *"at 0:42 the micro-expression + shoulder shift → high deception likelihood"*), goal-scoped — **fused** with the reusable SIM, not split from it.
- **Founder engine fact (locked):** the behavioral brain is **distinct** from the in-`src` content/craft core; it's harvested from the parked `feat/chat-ethics-gate` corpus and embedded as a NEW cached behavioral prompt. Re-use the **corpus**, re-evaluate the **code**.
- **Honesty + ethics are product features here**, not afterthoughts: Directional badge, evidence quotes as provenance, "read for YOUR decision" framing, weaponization refusal.
- **Founder wants decisive, grounded recommendations** — every gray area this phase was resolved by accepting the recommended option (matches P3/P4); 8/8 recommendations accepted across two rounds.
- **Keep P5 tight (D-09):** Profile + Simulate + the chain + a minimal inbox affordance. The front-door surface is P7; Predict is P6.

</specifics>

<deferred>
## Deferred Ideas

- **Front-door Audience picker + Mode-scoped skill menu + generalized ambient reactor** → **Phase 7** (UX-01..05). P5 reuses the existing thread + adds only a minimal drop-a-chat affordance.
- **`.docx` / `.pdf` ingestion** → deferred until a real use case demands the parser deps (P4 D-05). P5 inputs = `.txt`/`.md`/image/person-video.
- **Multi-stimulus / batch simulate** (run several drafts at once) → later; P5 is one stimulus per run.
- **Full ETHICS-GATE-SPEC implementation** (the heavier classifier-style gate) → later if the light guardrail proves insufficient; P5 ships the light boundary gate.
- **Re-using the `feat/chat-ethics-gate` engine *code*** → re-evaluate at research given the inconclusive A/B + cost flag; P5 harvests the corpus, not the code.
- **SIM marketplace + rev-share flywheel** (MKT-*), **self-calibration Directional→Validated** (CAL-01), **Anchor Pack #2** (PACK2-01) → **v2** (already tracked, not in this roadmap).
- **Predict verb** (analyst-panel scenario → probability/factors/confidence) → **Phase 6**.

### Reviewed Todos (not folded)
None — no pending todos matched this phase (`todo.match-phase` returned 0).

</deferred>

---

*Phase: 5-profile-simulate-wow*
*Context gathered: 2026-06-28*
