# Phase 6: Predict Verb - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the **third General verb: PREDICT**. `predict(panel, scenario)` runs an **analyst panel** that *reasons across* a scenario and collapses to **probability + factors + confidence**, rendered as a **prediction-gauge** result card. **Always Directional, always shows assumptions + receipts — a reasoned forecast, never an oracle** (PRED-01/02/03).

This is the **breadth/narrative verb, explicitly NOT the PMF bet** (vision §15.4). The build bias is **reuse + honesty + tight scope**, not richness — depth lives in the creator anchor and the Profile-chat wow, not here.

**Depends on:** Phase 5 (the General-simulate substrate — Predict reuses the Flash engine spine, the runner→route→block→thread rails, and `resolveTier`) and Phase 3 (the General audience + the Analyst Panel template + `success_criterion`). **Consumer:** Phase 7 (promotes Predict into the front-door surface).

**Carry-forward (locked, NOT re-asked):**
- **Reuse the P5 rails** — runner→`BLOCK_REGISTRY`→`message-blocks` + the route spine (auth → csrf → cap → RLS-audience-under-session → persist to the one open thread). Exactly Profile/Simulate's shape.
- **Honesty spine** — Directional **by rule** (`resolveTier`, never Validated for General); bands-first; `.strict()` block schemas reject smuggled fields. The panel-derived range (D-01) is the ONE sanctioned numeric.
- **SIM-1 badge** — the scenario is text → **Flash** (`qwen3.7-plus`); visible badge, never a user choice.
- **Creator (Socials) composer byte-identical** — the front-door Audience picker + Mode-scoped skill menu + generalized ambient reactor stay **P7**.
- **Open-world prediction stays OUT** (Iran war / election-without-a-poll) — no owned population → no moat (vision §8). Predict is panel-bound only.

</domain>

<decisions>
## Implementation Decisions

### Probability form — the honesty collision (the one founder-diverged call)
- **D-01: Probability = a likelihood BAND + a coarse RANGE, and the range is DERIVED FROM PANEL SPREAD (never fabricated, never model-emitted).** The gauge shows e.g. *"Lean yes, ~55–70%"*: the **band is the center** (Likely / Lean / Toss-up / Unlikely), the **range is where the analysts spread** (min–max of their individual likelihood leans). This keeps the milestone's bands-first spine intact while honoring PRED-01/02's literal "probability"/"gauge" — the number is **real panel signal**, not a point estimate and not an oracle (PRED-03). **The range is the only sanctioned numeric; a planner guard/assert must prove it comes from aggregation of the panel, never directly from a model field.** Founder chose band+range over a pure likelihood band (wanted a bounded number) and explicitly over a point % (rejected — oracle). **Rejected:** fixed band→range map (decorative digits, not panel-grounded); model-emitted range (hallucinated precision).
- **D-05: Confidence = the TIGHTNESS of that panel-spread range — pure derivation, no extra call, no model self-report.** A tight range (analysts agree) → **High** confidence; a wide range (analysts split) → **Low**. Confidence, the range, and the band are **one coherent panel-derived object**, not three independent fields — mirrors the `aggregateFlash` / `two-audience-read` "interpret the verdicts, never fabricate a number" discipline.

### Reasoning mechanic — how the panel produces the forecast
- **D-02: A NEW "predict" reaction-frame on the EXISTING Flash engine spine — drop the stop/scroll content frame.** Add a `predict` `FlashFraming` variant (sibling to the existing `hook` / `idea` / `chat` framings in `flash-prompts.ts`): each analyst persona **reasons about the scenario's LIKELIHOOD + names one driving factor** (for/against), instead of a content stop/scroll verdict. It reuses the whole engine plumbing — `runFlashTextMode` + `buildAudienceRepaint` + the panel — but **NOT** the content-react frame. This directly fixes the filed P5 **barbell** finding (`simulate-reaction-person-framing.md`: the stop/scroll frame mis-fits non-content — a skeptical analyst "scrolls past" a business scenario like a video). Cheap (reuses the spine), correct (new frame), and scoped to the non-PMF verb. **Rejected:** reuse stop/scroll verbatim (inherits the exact barbell mismatch); multi-branch fork (N× calls, over-scoped — see Deferred).

### Panel scope — which audiences Predict runs against
- **D-03: Any panel-type General audience; DEFAULT = the existing Analyst Panel template; REJECT person SIMs.** Audience-first (vision §16.4): the user picks the panel, then drops the scenario. Defaults to the zero-setup `template-analyst` (Skeptic / Strategist / Contrarian / Researcher, already in `audience-repo.ts`). A **person** SIM is rejected at the route/runner with a redirect nudge (*"Predict needs a panel — try the Analyst Panel"*) — a lone mind is not a panel forecast (honesty + the literal "analyst panel" in PRED-01). Person/panel is read deterministically from the persisted `__subject_kind` `custom_context` marker (the same one Simulate reads), never re-inferred from persona count. **Rejected:** analyst-template-only (under-delivers audience-first — can't predict with a hiring/custom panel); any-audience-incl-person (dilutes the honesty spine + the panel framing).

### Receipts & assumptions (PRED-03 — "never an oracle")
- **D-04: Factors = the per-analyst named drivers (the "receipts"); assumptions = the scenario's premises + the panel's `success_criterion`; the Directional caveat is always on.** PRED-03's "assumptions + receipts" is satisfied by surfacing, on the card: (a) the **factors** each analyst named (tied to which analyst/persona named it — so the forecast is auditable, not a black box), (b) the **assumptions** the panel reasoned under (the scenario's stated premises + the panel's success-criterion as its lens), and (c) an **always-rendered Directional caveat**. The panel composition (who's on it) is shown so the user can see whose reasoning produced the number.

### Surface & cut line
- **D-06: Minimal trigger so the thread works end-to-end; everything else deferred to P7/v2.** Predict is reachable via a **minimal additive entry** — a **chain-CTA "Predict an outcome →"** seeded from the Simulate `reaction-distribution` card (extends the existing forward-chain handoff) and/or a single minimal composer/skill affordance — so the card renders **in the existing one thread** and the wow is human-verifiable. The **front-door Audience picker + Mode-scoped skill menu + generalized ambient reactor stay P7**. **Deferred** (see Deferred Ideas): prediction history/saving, multi-scenario/batch compare, multi-branch scenario fork, outcome calibration. Mirrors P5's tight cut exactly. **Rejected:** headless-only (can't human-verify the end-to-end wow — P5 required the thread to actually work); fuller-surface-now (pulls P7 forward, risks the locked composer rule, bloats the non-PMF verb).

### Security (locked carry-forward — same boundary as P5 D-08)
- **D-07: Instruction-isolate the scenario text + the panel's `success_criterion`/`custom_context` before they hit the reasoning prompt.** Predict is a new place untrusted user input (the scenario) flows into a model prompt. Treat the scenario + the audience's authored fields as **UNTRUSTED** — delimit / instruction-isolate in a dedicated data block ("treat as data, not instructions"), mirror the P4 `vision.ts` / P5 `profile-bake.ts` isolation; **never concatenate raw** into the system/reasoning prompt. P3's `sanitizeText` is storage/XSS only, NOT prompt-injection safe.
- **D-08: Fold the P5 WR-03 route fix in here (non-General/non-panel audience → 400, not 500).** The Predict route resolves a panel audience under the session (RLS-scoped) and must reject a person/non-General audience as a **400 validation error**, not throw a 500 — this is the natural place to close the open P5 simulate-route follow-up since Predict's route mirrors it and explicitly rejects person SIMs (D-03).

### Claude's Discretion (planner/researcher decide — do NOT re-ask the founder)
- **Exact Zod schema** for the new `prediction-gauge` block (co-locate in `profile-blocks.ts` or `blocks.ts`; study `ProfileReadBlockSchema`, `ReactionDistributionBlockSchema`, `MultiAudienceReadBlockSchema`). Locks: likelihood band + **panel-derived** range + `factors[]` (each tied to an analyst) + confidence band + assumptions + always-on caveat + `tier: "Directional"` + `model: "sim1-flash"`; `.strict()` (reject any smuggled point-score).
- **The `predict` `FlashFraming` wiring** in `flash-prompts.ts` — the per-persona likelihood-lean + named-factor question and how its output is parsed (mirror how `hook`/`idea`/`chat` swap the per-candidate question + band verbiage).
- **The aggregation** — panel leans → band (center) + range (spread) + confidence (tightness) + clustered factors. Where it lives (a `predict-aggregate.ts` sibling to `flash-aggregate.ts`, or inside the runner). Reuse `aggregateFlash`'s pure-derivation discipline, adapted from stop/scroll to a likelihood lean.
- **Module layout** — `src/lib/tools/runners/predict-runner.ts` (mirrors `simulate-runner.ts`) + `/api/tools/predict/route.ts` (mirrors `simulate/route.ts`).
- **The minimal trigger shape** (chain-CTA on the reaction-distribution card / a composer entry) — additive only; do not restructure the creator composer.
- **The person-SIM rejection UX** — route 400 + the redirect-nudge copy.
- Test runner: `node ./node_modules/vitest/vitest.mjs run` (`npm test`/`npx vitest` print fake PASS(0)/FAIL(0)).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone vision, roadmap & requirements
- `.planning/NUMEN-GSI-VISION.md` — §14.1 (the six-box pipeline), §14.2 (**PREDICT** = `predict(panel, scenario)` = simulate an analyst panel across scenario branches → collapse to probability + factors + confidence; always Directional + assumptions + receipts), §15.4 (**Predict = story/breadth, NOT the PMF bet**), §16.2 (run resolution: audience → skill → input → run → render → persist), §16.4 (Predict picks Audience FIRST), §8 (open-world prediction OUT). EXPLORATORY — walk the section; a brief wins where it conflicts.
- `.planning/ROADMAP.md` §"Phase 6: Predict Verb" — goal + the 3 success criteria.
- `.planning/REQUIREMENTS.md` — **PRED-01, PRED-02, PRED-03** (the requirements this phase closes).

### Prior-phase context (carry-forward — Predict reuses the P5 substrate)
- `.planning/phases/05-profile-simulate-wow/05-CONTEXT.md` — the runner→route→block→thread pattern; D-06 (reaction-distribution / Flash-engine reuse), D-07 (reuse the rails + minimal additive affordance), D-08 (prompt-injection isolation — Predict's D-07 mirrors it).
- `.planning/phases/03-general-population-honesty-layer/03-CONTEXT.md` — the General audience, `resolveTier` (Directional-by-rule), `success_criterion`/`custom_context`, the Analyst/Hiring templates.
- `.planning/todos/pending/simulate-reaction-person-framing.md` — the **barbell** finding that motivates D-02 (the new reasoning frame). Reviewed, not folded (the Simulate-side fix stays a P5 follow-up).
- `.planning/todos/pending/p05-code-review-followups.md` — **WR-03** (simulate non-General → 400) folded into D-08; the rest stay a P5 hardening pass.

### The Simulate engine substrate (reuse — `simulate-runner` + `two-audience-read` are the closest analogs)
- `src/lib/tools/runners/simulate-runner.ts` — the closest analog: lifts the per-audience Flash read, the deterministic `__subject_kind` marker resolution (person/panel), the `resolveTier` Directional guard, the `.strict()` block validation. `predict-runner.ts` mirrors this.
- `src/lib/engine/flash/two-audience-read.ts` — the **pure-derivation** pattern: interpret the panel's bands into prose/lever with NO extra model call, NO fabricated number. Predict's band/range/confidence derivation follows this discipline.
- `src/lib/engine/flash/run-flash-text-mode.ts` — `runFlashTextMode(text, framing, panel, repaint)` + the `FlashFraming` type. The new `predict` framing slots in here.
- `src/lib/engine/flash/flash-prompts.ts` — where `FlashFraming` (`hook`/`idea`/`chat`) swaps the per-persona question + band verbiage. Add the `predict` framing here.
- `src/lib/engine/flash/flash-aggregate.ts` — `aggregateFlash` pure band+fraction math (do NOT re-roll). The template for the new likelihood→band+range+confidence aggregation discipline.
- `src/lib/engine/flash/build-reaction-panel.ts` — `buildAudienceRepaint(audience)` — the deterministic audience→repaint projection that steers the panel (General/empty → no-op).

### Cards / blocks (add ONE new block type: `prediction-gauge`)
- `src/lib/tools/profile-blocks.ts` — the P5 sibling block schemas (`ProfileReadBlockSchema`, `ReactionDistributionBlockSchema`) — the closest pattern; both are `.strict()` bands-only. Add `PredictionGaugeBlockSchema` here (or in `blocks.ts` if room).
- `src/lib/tools/blocks.ts` — the block union (`MultiAudienceReadBlockSchema` is a good multi-output analog) + the 500-line limit (P5 spilled into `profile-blocks.ts` for exactly this reason).
- `src/lib/tools/block-registry.ts` — `BLOCK_REGISTRY` + `validateBlock` (register the new block).
- `src/components/**/message-blocks.tsx` — the renderer wiring (block → component) + the rehydration `validateBlock` guard. The prediction-gauge card mounts here.

### Audience / panel (Predict's lens)
- `src/lib/audience/audience-repo.ts` — `GENERAL_TEMPLATES` (the **`template-analyst`** panel — the zero-setup default, lines ~117–168) + `getAudience`/the General library + `SENTINEL_IDS`.
- `src/lib/audience/resolve-tier.ts` — `resolveTier` (Directional-by-rule; the run-level honesty badge).
- `src/lib/audience/audience-types.ts` — `Audience` + `CalibratedPersona` + the `custom_context` `__subject_kind` marker convention.

### Route spine + thread (mirror `simulate`)
- `src/app/api/tools/simulate/route.ts` — the route spine to mirror (auth 401 → `csrfGuard` → cap → `getAudience` under session/RLS → `normalizeStimulus` → run → `insertMessage` on the open thread → generic 500 on failure, never echo `err.message`). **Fold the WR-03 non-General→400 fix here (D-08).**
- `src/lib/engine/stimulus/normalize.ts` + `src/lib/engine/stimulus/vision.ts` — `normalizeStimulus` (the scenario is `kind:"text"` → Flash) + the untrusted-input **isolation pattern to mirror for D-07**.
- `src/lib/threads/messages.ts` + `src/lib/threads/threads.ts` — `insertMessage` (re-validates the block at the write boundary + KC stamp) + `createOpenThreadLazy` (the one-thread persist).

### Model routing
- `src/lib/engine/qwen/client.ts` — `QWEN_REASONING_MODEL=qwen3.7-plus` (Flash tier — the scenario is text → always Flash for Predict; omni/Max is not a Predict input).
- `docs/MODEL-POLICY.md` — the two-model-stack policy.

### Test runner
- Use `node ./node_modules/vitest/vitest.mjs run` — `npm test`/`npx vitest` emit fake PASS(0)/FAIL(0).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`simulate-runner.ts`** — the analog runner: `__subject_kind` marker resolution, `resolveTier` Directional guard, `.strict()` block validation, injectable `deps.flash` for zero-network tests. `predict-runner.ts` clones its shape.
- **`two-audience-read.ts`** — the pure band-interpretation pattern (NO extra model call, NO fabricated number). Predict's band→range→confidence derivation inherits this exact discipline.
- **`runFlashTextMode` + `FlashFraming` (`flash-prompts.ts`)** — the framing-swap seam; the `predict` reasoning frame is a new `FlashFraming`, reusing the engine plumbing without the stop/scroll content frame (fixes the barbell, D-02).
- **`aggregateFlash`** — the pure band-math template; Predict adds a likelihood-lean aggregation sibling (band center + spread range + tightness confidence).
- **`template-analyst`** (`audience-repo.ts`) — the zero-setup Analyst Panel (Skeptic/Strategist/Contrarian/Researcher + a risk-surfacing `success_criterion`) — Predict's default lens, already built.
- **`profile-blocks.ts` `.strict()` schemas + `BLOCK_REGISTRY` + `message-blocks.tsx`** — the entire card-emission pipeline; the prediction-gauge block rides it.
- **`simulate/route.ts`** — the route spine (auth/csrf/cap/RLS-audience/one-thread) to mirror, plus the WR-03 fix point.

### Established Patterns
- **Bands-first honesty** (`.strict()` rejects smuggled scores) + **Directional-by-rule** (`resolveTier`) — the prediction-gauge inherits both; the panel-derived range is the single sanctioned numeric (D-01).
- **Deterministic person/panel** via the persisted `__subject_kind` marker (never re-inferred from persona count) — Predict reuses it to reject person SIMs (D-03).
- **Pure derivation over fabrication** — band/fraction (`aggregateFlash`) and delta/lever (`two-audience-read`) are computed from verdicts, never invented. Predict's range + confidence follow suit (D-01/D-05).
- **Additive, wrap-don't-refactor** — a new verb + one new block + a new framing; the Socials path + creator composer untouched.
- **Forward-chain handoff** — the existing "next skill" CTA; Predict's "Predict an outcome →" extends it from the Simulate card (D-06).

### Integration Points
- **Predict:** scenario `Stimulus` (`normalizeStimulus`, `kind:"text"` → Flash) + a resolved panel audience (default `template-analyst`) → the new `predict` Flash framing (steered by `buildAudienceRepaint`) → likelihood-lean aggregation (band + panel-spread range + confidence + clustered factors) → `prediction-gauge` block → persisted to the one open thread.
- **Trigger:** chain-CTA "Predict an outcome →" from the Simulate `reaction-distribution` card (+ a minimal composer/skill entry) → the existing thread.
- **Untrusted boundary:** the scenario text + `success_criterion`/`custom_context` → the reasoning prompt — instruction-isolated (D-07).

</code_context>

<specifics>
## Specific Ideas

- **The honest gauge:** *"Lean yes, ~55–70% · confidence: Medium"* — where the **range is literally the analysts disagreeing** and the **tightness of that range IS the confidence**. One panel-derived object, no fabricated digit. This was the founder's deliberate refinement (band+range over a pure band), kept honest by deriving the number from panel spread.
- **Predict reasons, it doesn't react:** the founder/vision frame is *"the lens reasons over scenarios"* — a NEW analyst-reasoning frame, explicitly NOT the stop/scroll content react that mis-fits (the filed barbell todo). Each analyst names a driving factor = the receipts.
- **Predict is breadth, not the bet:** vision §15.4 — it exists for the *"simulate/profile/predict anything"* narrative; no PMF effort sunk into football odds. Build bias = reuse + tight, every time.
- **Founder wants decisive, grounded recommendations** — 3/4 areas accepted the recommended option; the one divergence (probability form) was a deliberate band+range refinement, then locked to a panel-derived (honest) range. Matches the P3/P4/P5 pattern.

</specifics>

<deferred>
## Deferred Ideas

- **Front-door Audience picker + Mode-scoped skill menu + generalized ambient reactor** → **Phase 7** (UX-01..05). P6 reuses the existing thread + a minimal trigger only.
- **Multi-branch scenario fork** (optimistic / base / pessimistic, reason each, aggregate across) → later (v2 depth). P6 is one panel reasoning over one scenario.
- **Multi-scenario / batch compare** (predict several scenarios at once) → later. P6 is one scenario per run.
- **Prediction history / saving a prediction to a library** → later. P6 persists to the thread only (like every other verb's run).
- **Outcome calibration** (a prediction's accuracy feeds back to promote Directional → Validated) → **v2 (CAL-01)**, already tracked.
- **Point probability %** → rejected (oracle framing PRED-03 forbids).
- **Person SIMs predicting** → rejected (a lone mind is not a panel forecast).

### Reviewed Todos (not folded)
- **`simulate-reaction-person-framing.md`** (P5 barbell) — **informed D-02** (Predict gets a new reasoning frame to avoid it), but the **Simulate-side** content-frame fix stays a separate P5/engine follow-up; not Predict's scope.
- **`p05-code-review-followups.md`** — **WR-03** (simulate non-General → 400) folded into **D-08** (Predict's route closes it naturally). WR-01 (file-cap bypass), WR-04 (composer video no-op), and the Info items stay a P5 hardening pass — not P6 scope.

</deferred>

---

*Phase: 6-predict-verb*
*Context gathered: 2026-06-29*
