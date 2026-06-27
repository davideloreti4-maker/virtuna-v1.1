# Phase 3: General Population + Honesty Layer - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Generalize `audiences` from a socials-locked object into a **domain-agnostic SIM** on the signature substrate — saveable, named, browseable, with an authorable success-criterion — and make every audience and every run wear an honest **Validated vs Directional** badge with surfaced provenance. Requirements: **POP-01…POP-05, TRUST-01, TRUST-02**.

This phase delivers the **population object + the honesty layer**. It does **NOT** build the General *verbs* — Profile (P5), Simulate (P5, SIMU-01), Predict (P6) — nor the front-door Audience picker promotion (P7). The General audience produced here is **runnable-READY** (complete, badged, provenance-bearing) but is only *run* once P5's Simulate verb lands.

**Hard prerequisite (gate):** Phase 2 closed **NO-GO (conditional)** — the determinism leg must clear before P3 invests in the General surface. P3 opens with the spike's recommended mitigation (drop thinking-mode synth + re-confirm `signatureEqual:true`) as a Wave-0 prereq (D-01).

**Carry-forward (locked, not re-asked):**
- **Creator composer byte-identical** (P1 D-08) — generality lives *behind* the Audience picker; Socials audiences + the regression gate stay byte-stable.
- **Determinism foundation** (spike) — `signature-equality.ts` + `signature-determinism.test.ts` are the free-by-construction regression gate; the tier **rule** is locked (`DomainPack.calibration` set → Validated, else Directional).
- **Additive-migration discipline** — the `audience_signature` migration was explicitly additive (`IF NOT EXISTS`, weight cols + CHECK untouched); P3 continues this.
- **`source=user` custom-context** (spike P3 carry-forward + D-defer-01) — promoted to a first-class provenance-level field with full input+UI+edit, landing here.

</domain>

<decisions>
## Implementation Decisions

### Determinism close-out (P2 NO-GO condition — Wave-0 gate)
- **D-01:** **Drop thinking-mode on the synthesis bake + re-confirm.** Set `enable_thinking:false` (drop `thinking_budget`) on the `qwen-3.7-plus` synthesis call in `enrich-signature.ts`, re-run the live double-bake, expect `signatureEqual:true`. This is the spike verdict's recommended fix (§Fallback option 1) — it **genuinely closes** the determinism leg (`temp:0` greedy decoding is the real determinism lever; thinking-mode staging was the documented residual-jitter source, Pitfall 3) and also cuts cost + latency. **This runs as a P3 Wave-0 prerequisite** before any General-surface work. **Guard:** A/B the synth output against the socials control to confirm no synthesis-quality regression. Rejected: scope-the-contract-to-frozen-artifact (redefines the bar instead of closing it; thinking-mode cost+latency stays); both (belt-and-suspenders — unnecessary once option 1 lands clean, re-bake/drift determinism is a v2/CAL-01 concern anyway).

### General-run scope (phase boundary)
- **D-02:** **Object + library + honesty layer ONLY — no General scoring/run path in P3.** P3 ships the General population object, the General library, the success-criterion, the Validated/Directional badges, and provenance surfacing. The General **Simulate** path (`simulate(audience, stimulus)`) is **P5 (SIMU-01)** — P3 does not depend on it and must not duplicate it. Read ROADMAP SC#3 "a default template panel **runs** with zero setup" as **runnable-READY with zero setup** (no calibration/scrape needed) — the template executes the moment P5's verb exists. The spike already baked + de-risked the General signature, so nothing in P3 needs to execute a run. Rejected: minimal-runnable-General-scorer-in-P3 (pulls SIMU work forward, duplicates P5, grows the phase).

### Success-criterion (POP-02 / POP-05)
- **D-03:** **Free-text prose field, stored + editable; P5/P6 scorers consume it.** A single editable string ("what 'good' means for this audience") on the General audience. Socials keeps its **implicit fixed virality fold** (unchanged — its success-criterion is the pack's locked scorer). **No live scorer wired in P3** (consistent with D-02): the field flows into the `DomainPack.scoring` input contract for the P5/P6 scorers to consume later. Satisfies author + edit (POP-05) without locking a metric taxonomy before any General scorer exists. Rejected: structured/selectable metric (premature — no General scorer yet to consume structure); free-text-now-plus-structured-later (acceptable but adds a seam we don't need yet — revisit when P5/P6 reveal what structure is actually required).

### POP-01 data-model — "Mode" + socials→general generalization
- **D-04:** **Additive explicit `mode` column + mode-gated constraints.** Add `mode` (`'socials' | 'general'`) to the `audiences` table. Socials rows default `'socials'` and stay **byte-stable** (4-weight cols + sum-CHECK untouched → regression gate free by construction). General rows carry `'general'` with the socials enums (platform) and the fixed 4-weight model **optional / pack-supplied** — the weight-sum CHECK is **gated to `mode='socials'`** so General rows don't need it. Continue the additive-migration idiom (`ADD COLUMN IF NOT EXISTS`, never alter weight cols/CHECK/`analysis_results`). Existing Socials audiences migrate by **defaulting `mode='socials'`**. Mode is **first-class** because POP-02 says the audience "carries its Mode" and P7 needs it for Mode-sectioned library + Mode-scoped skills. Rejected: derive-Mode-from-`is_general` (muddier — conflates "is the default General constant" with "is in General mode"; POP-02 wants Mode carried explicitly).

### Honesty layer — provenance surfacing (TRUST-02)
- **D-05:** **Inline evidence + an explicit ungrounded state.** Each grounded persona shows its evidence quote(s) **inline** on the card; an ungrounded persona renders in a **distinct muted "no evidence — Directional" state** (mirrors the spike's empty-evidence predicate). Grounded ≠ ungrounded must be visible **at a glance** — the whole point of the honesty layer. Fine visual detail → `/gsd-ui-phase`. Rejected: evidence-behind-expand/disclosure (honesty not visible at a glance; weaker trust story).

### Honesty layer — trust badge (TRUST-01)
- **D-06:** **Validated/Directional badge on BOTH the audience (card + library) AND the run/result card** — required verbatim by TRUST-01 ("each audience and each run"). P3 builds the real `resolveTier` **resolver** + the badge component on top of the spike-locked tier *rule* (`DomainPack.calibration` populated → Validated; General / `undefined` / `{}` / `{baselineRef:""}` → Directional, never Validated). The rule itself was proven in the spike (PASS); P3 productionizes the resolver + UI. (Placement is requirement-locked, not a gray area — captured for the planner.)

### Custom-context (`source=user`) — D-defer-01 fulfillment
- **D-07:** **First-class SIM-scoped `custom_context[]` field with full input + edit, surfaced as "user-added grounding."** Promote the spike's probe-local `provenance.custom_context = {source, note}` to a real field on the audience/signature (kept at the **provenance level**, SIM-scoped, with `source` + `note` + optional per-persona evidence linkage — per the verdict's P3 recommendation, NOT buried per-evidence-string). Add an **input + edit affordance** on any General audience and render it **distinctly from scraped grounding**. User-supplied grounding **strengthens** provenance (tagged, visible), never fakes it. Delivers D-defer-01 in full. Rejected: read-only-display-in-P3 (slips the committed D-defer-01 promise of input+UI+edit here).

### POP-04 — General default templates
- **D-08:** **Two hand-authored virtual-constant panels: analyst + hiring.** Ship `analyst` + `hiring` as virtual constants mirroring the existing `PRESET_AUDIENCES` pattern in `audience-repo.ts` — authored synthetic persona panels, **no bake / no scrape**, `tier=Directional` by rule, runnable with **zero setup** by construction. Provenance reads as authored/template grounding (and visibly ungrounded-by-design where no evidence backs a persona, per D-05). Two (not one) proves the template mechanism generalizes and matches ROADMAP's plural "e.g. analyst / hiring." Rejected: generate-personas-via-bake-at-first-use (adds a bake path + cost, breaks "zero setup," drifts toward the real Profile verb P5); ship-just-one (roadmap signals two).

### Claude's Discretion
- Exact migration mechanics for D-04 (column type/default, how the weight-sum CHECK is made conditional, whether General population/weights live in a new jsonb vs nullable cols) — researcher/planner territory; the lock is **additive + socials byte-stable + Mode first-class**.
- Exact shape/location of `resolveTier` (D-06) and the badge component; the storage shape of `custom_context[]` (D-07) beyond "provenance-level, SIM-scoped, `source`+`note`+optional persona linkage."
- The authored persona content for the analyst/hiring panels (D-08) — pick representative, defensible panels; structure mirrors `PRESET_AUDIENCES`.
- Whether the success-criterion (D-03) is a column or lives in the signature/profile jsonb — planner decides; it must be editable + flow into `DomainPack.scoring`'s input contract.
- Where the General library extends `audience-manager.tsx` (Socials/General sectioning is P7's promotion; P3 surfaces General audiences in the existing manager).
- Test-runner quirk: use `node ./node_modules/vitest/vitest.mjs run` — `npm test`/`npx vitest` print fake PASS(0)/FAIL(0).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone vision & requirements
- `.planning/NUMEN-GSI-VISION.md` §3 (the two-tier Validated/Directional model), §6 (verified architecture reality — what the substrate provides), §7 (the make-or-break trust model this honesty layer productionizes). EXPLORATORY — walk every section; a brief wins where it conflicts.
- `.planning/ROADMAP.md` §"Phase 3: General Population + Honesty Layer" — goal + 5 success criteria. NOTE: SC#3 "runs with zero setup" is read as **runnable-READY** per D-02 (Simulate is P5).
- `.planning/REQUIREMENTS.md` **POP-01…POP-05, TRUST-01, TRUST-02** — the requirements this phase covers.

### Phase 2 spike — the gate this phase clears + carries forward
- `.planning/phases/02-trustworthy-sim-spike/SPIKE-VERDICT.md` — the NO-GO (conditional) verdict; §Fallback (determinism mitigation = D-01) + §"P3 carry-forward" (`source=user` first-class field = D-07; determinism regression foundation; badge resolver is P3 = D-06).
- `.planning/phases/02-trustworthy-sim-spike/02-CONTEXT.md` — D-03 (custom context = first-class `source=user` evidence) + D-defer-01 (custom-context full capability deferred to P3 = D-07).
- `.planning/phases/01-engine-pack-seam/01-CONTEXT.md` — the `DomainPack` seam (D-05/D-06) + "build on substrate, do NOT `git merge rework/engine-core`."

### Code to extend / build on (the substrate)
- `src/lib/audience/audience-repo.ts` — `GENERAL_AUDIENCE` + `PRESET_AUDIENCES` virtual constants (the pattern D-08's analyst/hiring panels mirror), `Audience` type, CRUD + virtual-constant prepend. Extend for `mode` (D-04) + General templates (D-08).
- `src/lib/audience/audience-types.ts` — `Audience`, `AudienceSignature`, `SignaturePersona` (`evidence`), `SignatureProvenance` (`custom_context` lands here, D-07), `GoalIntent`. The provenance/evidence shape D-05 surfaces.
- `src/lib/audience/enrich-signature.ts` — the bake "heart"; the `qwen-3.7-plus` synthesis call where D-01 sets `enable_thinking:false`.
- `src/lib/audience/calibration.ts` — bake-once orchestration; where the Directional-by-rule tiering (D-06) is observed.
- `src/lib/audience/signature-equality.ts` + `src/lib/audience/__tests__/signature-determinism.test.ts` — the kept determinism regression gate (free-by-construction); D-01's re-confirm runs against this foundation.
- `src/lib/engine/domain-pack.ts` — `DomainPack` interface; `CalibrationSpec` (the tier basis, D-06), `DomainPackScoring` (success-criterion flows into its input contract, D-03).
- `src/lib/engine/packs/socials.ts` — Socials = Pack #1; the General pack/population mounts the SAME contract.

### Migrations (additive idiom to follow — D-04)
- `supabase/migrations/20260619000000_audiences.sql` — the `audiences` table (platform/type CHECKs, 4-weight cols + sum-CHECK, RLS). The `mode` column + conditional CHECK land here-style.
- `supabase/migrations/20260624000000_audience_signature.sql` — the EXEMPLAR additive migration (`ADD COLUMN IF NOT EXISTS`, weight cols untouched, NULL for General/presets). D-04 + D-07 follow this discipline verbatim.

### UI surface to extend
- `src/components/audience/audience-manager.tsx` — the library (General baseline + presets + user cards, sectioned). POP-03 surfaces General audiences here (Mode-sectioning is P7).
- `src/components/audience/audience-card.tsx`, `src/components/audience/audience-status-chip.tsx` — where the Validated/Directional badge (D-06) + provenance/ungrounded state (D-05) render.
- `src/components/audience/audience-form.tsx` — where the success-criterion (D-03) + custom-context input/edit (D-07) affordances attach.

### Test runner
- Use `node ./node_modules/vitest/vitest.mjs run` — `npm test`/`npx vitest` emit fake PASS(0)/FAIL(0).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `audience-repo.ts` `GENERAL_AUDIENCE` + `PRESET_AUDIENCES` — virtual-constant pattern (sentinel ids, no DB row, prepended to user rows). D-08's analyst/hiring panels are net-new constants of the same shape.
- `audience-manager.tsx` — an existing library UI with General + presets + user sections, selection mode, compare. POP-03 (browse/reuse General) extends it rather than building fresh.
- `signature-equality.ts` (`normalizeSignature`/`signatureEqual`/`stableStringify`) + `signature-determinism.test.ts` — the kept, zero-network, CI-safe determinism gate; D-01's re-confirm + P3 regressions run on it.
- Persona `evidence` + `SignatureProvenance` — provenance is already modeled; D-05 is an **inspection/surfacing** of existing data + D-07's new `custom_context`, not new infra.

### Established Patterns
- **Additive-migration discipline** — `audience_signature` migration is the exemplar: `ADD COLUMN IF NOT EXISTS`, never touch weight cols/CHECK/`analysis_results`, NULL for General/presets so the regression gate is free by construction. D-04 + D-07 follow it.
- **Tier keys off `DomainPack.calibration`, NOT `Audience.calibration`** (spike) — the resolver (D-06) reads the pack's calibration spec, not the audience's scrape-provenance `calibration` jsonb.
- **Bake-once + frozen-on-row** — General/presets/templates never carry a signature → the regression gate stays byte-stable; D-08 templates are unbaked virtual constants by design.
- **Virtual constants skip persistence** — any write path checks `is_general`/`is_preset` and skips; D-08 templates inherit this.

### Integration Points
- `audiences` table → `mode` column + conditional weight-CHECK (D-04); `SignatureProvenance.custom_context[]` (D-07).
- `DomainPack.scoring` input contract ← the free-text success-criterion (D-03) flows in for P5/P6 scorers.
- `DomainPack.calibration` → `resolveTier` resolver → badge component (D-06).
- `enrich-signature.ts` synth call ← `enable_thinking:false` (D-01).

</code_context>

<specifics>
## Specific Ideas

- Founder wants **decisive, grounded recommendations** — every gray area in this phase was resolved by accepting the recommended option (all 7); the recommendations are the locked decisions above.
- The honesty layer's job is **honest at a glance** (D-05) — grounded vs ungrounded and Validated vs Directional must read instantly, not behind a click. This is the trust moat made visible.
- Determinism is closed by **killing thinking-mode** (D-01), not by redefining the bar — the trust story stays genuine, and it's a cost+latency win on the side.

</specifics>

<deferred>
## Deferred Ideas

- **General Simulate verb** (`simulate(audience, stimulus)` → reaction-distribution card) → **Phase 5 (SIMU-01/02)**. P3 makes the General audience runnable-ready; P5 runs it. (D-02)
- **Profile verb** (build a person/panel audience from uploaded evidence — the real bake-from-evidence path) → **Phase 5 (PROF-*)**. D-08's analyst/hiring are authored templates, not Profile output.
- **Predict verb** (analyst-panel scenario reasoning → probability/factors/confidence gauge) → **Phase 6 (PRED-*)**; the success-criterion (D-03) feeds its scorer.
- **Input adapter** (text/file/image → `Stimulus`, SIM-1 tier auto-select) → **Phase 4 (IN-*)**.
- **Audience-as-front-door promotion** (picker as primary context-setter, Mode-sectioned library, Mode-scoped skills, generalized ambient reactor, empty-state wow chips) → **Phase 7 (UX-*)**. P3 adds the `mode` field + surfaces General in the existing manager; P7 promotes the picker and sections by Mode.
- **Structured success-criterion metrics** → revisit post-P5/P6 once scorers reveal needed structure (D-03 keeps free-text now).
- **Re-bake / drift determinism + self-calibration** (Directional→Validated promotion) → **v2 (CAL-01)**; D-01 closes the bake-once determinism leg, re-bake determinism is explicitly out of v7.0.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 3-general-population-honesty-layer*
*Context gathered: 2026-06-27*
