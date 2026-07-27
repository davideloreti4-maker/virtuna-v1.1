# Population Quantum Cognition — Entangled Audience Fold (Spike Spec)

> **Status:** DRAFT for approval. Decision locked: **population QC only**, simple, high-EV.
> **Worktree:** `~/virtuna-quantum-spike` · branch `spike/quantum-cognition` (off `main`)
> **Nature:** Pre-milestone validation spike. NOT a milestone. Two-gate kill point (§4).
> **Engine impact:** ZERO. Standalone, reuses the pipeline read-only. Engine is frozen
>   (presentation-only, Numen Surface) — this is R&D ahead of a future engine milestone.

---

## 1. The bet (one paragraph)

The Fold simulates 10 viewer archetypes **in sealed booths** and averages their scorecards.
That bakes in one false assumption — viewers judged **independently** — which the code
confirms (no cross-persona interaction anywhere). Real audiences are **coupled**: one
person's enthusiasm shifts the next's, and content "catches." We model the 10 personas as
a single **genuinely entangled quantum state** (10 qubits), evolve it under a coupling
structure drawn from the archetypes' social roles, and measure the **joint** engagement
distribution. The non-factorizable, super-additive tail of that distribution **is breakout**
— and the *same computation* that produces it is the **litmus that proves this is genuine
quantum cognition, not a metaphor**. Additive: it emits a breakout/polarization signal
alongside the existing score, never replacing it.

---

## 2. Why this spot (the decisive filter)

Genuine QC must produce a non-classical signature **you can check against reality.** That
filter eliminates every other locus in the E2E:

- within-video order effects → genuine QC, but you can't reorder a posted video → **unfalsifiable**.
- Apollo (craft) / Read (perception) → **no ground truth** exists to validate against.
- **Audience/engagement layer → the ONLY place with observable ground truth** (real views,
  shares, breakouts). The one locus where reality can confirm a non-classical prediction.

So population QC at the Fold isn't a preference — it's the only place genuine QC can be
*proven*. (Full reasoning trail in this thread; single-person QC roadmap in §9.)

---

## 3. The model (simple, concrete)

**Inputs — all already produced by the pipeline (no new extraction):**
- the 10 personas' existing intents (`watch_through_pct`, `share_intent`, `save_intent`,
  `comment_intent`) from `persona_simulation_results[]`.
- the archetype identity of each persona (`high_engager`, `sharer`, `lurker`, …).

**Construction:**
1. **10 qubits**, one per persona, basis `{not-engage, engage}` (d=2 → joint space 2¹⁰ =
   1,024 amplitudes — instant to simulate, no special hardware).
2. **Local fields** `h_i` — each persona's engage-tilt for THIS video, derived from its
   existing intents (a simple weighted combine of its share/save/comment/watch). Content
   enters here.
3. **Coupling** `J_ij` — the entanglement structure, set from archetype social roles
   (theory, not fit): `sharer` = hub (high out-coupling), `high_engager` = secondary hub,
   `lurker` = sink (in, ~no out), `cross_niche_curiosity` = threshold breakout edge,
   `loyalist` = pre-coupled/low-marginal.
4. **Hamiltonian** `H = Σ_i h_i·X_i  +  Σ_{i<j} J_ij·Z_i Z_j`. The `X` terms drive each
   persona toward engage; the `ZZ` terms entangle them. Evolve `|Ψ⟩ = e^{-iHt}|Ψ₀⟩` from a
   product initial state.
5. **Measure** (Born rule, computational basis) → a distribution over all 1,024 audience
   configurations (which personas jointly engaged).

**Outputs (additive — into `counterfactuals.suggestions[]`, `signal_anchor: string`, no
schema change; a `persona_dissent` anchor already exists):**
- **Breakout score** = mass on the super-additive "many-jointly-engaged" tail, relative to
  the independent baseline. The edge — a signal the classical mean structurally cannot give.
- **Polarization** = spread of the distribution (divisive vs flat-consensus).

The headline `overall_score` is **untouched** (the LLM intents are good; reprocessing them
into the average would only risk the information ceiling). The new value is purely in the
**correlation structure** classical aggregation throws away.

---

## 4. The two gates (kill points)

**Gate 1 — is the signature real? (the QC litmus. Free, no outcome data.)**
Does the joint engagement distribution **fail to factorize** into 10 independent personas?
Quantify (total correlation / a Bell-type quantity). If it factorizes → the coupling did
nothing, it's classical → **kill, or it was never QC.** This is where you confirm you've
earned the words "quantum cognition." Costs almost nothing — run it first.

**Gate 2 — is it an edge? (needs outcome data.)**
Does the breakout score **correlate with real breakout** on a reach-controlled,
breakout-labeled set (engagement-rate / within-niche percentile, not raw views)? Use the
existing ~225-row labeled corpus as **validation, not training**. If no correlation → the
signature is real but useless → hold it.

Pass both → graduate to a flagged engine milestone (A/B at the `aggregator.ts:863` seam).
Fail Gate 1 → not QC. Fail Gate 2 → not an edge. Either way, cheap to learn.

---

## 5. What's deliberately NOT in it (the simplicity wins)

The population-only decision drops everything that added complexity or risk:

- ❌ **No QC-param extractor** — uses existing persona intents, not the missing head-fake/
  desire-proxy detections. (Earlier D7 — gone.)
- ❌ **No within-video / order model** — unfalsifiable + dead actionability (segments are
  anonymous time-slices). Dropped to single-person roadmap (§9).
- ❌ **No attention-curve dependency** — the core runs on intent scalars, so the flat-curve
  diversity-guard gap doesn't bite. (Curves are an optional later refinement of `h_i`.)
- ❌ **No mean-field shortcut** — genuine entanglement is tractable at 10 qubits, so we do
  the real thing (and Gate 1 is only meaningful for the real thing).
- ❌ **No score replacement** — additive only; can't degrade the headline.

---

## 6. Verified facts (from code audits, 2026-06-12)

- **🟢 Runnable standalone, no auth wall.** `/api/analyze` 401 is bypassed by the learning
  harness (`scripts/run-learning.ts feed` + `sweep`, service key). `runEngineOnTrainingVideo()`
  importable in-process, returns full `PredictionResult` incl. `persona_simulation_results[]`.
  Env: `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `DASHSCOPE_API_KEY`. ~$1.50–2.50 + ~90s/video. Deterministic (temp0+seed).
- **🟢 Personas confirmed independent.** `aggregatePersonaResults` (wave3/aggregator.ts:31)
  = top-3-weighted mean, zero cross-persona interaction in the codebase. The coupling model
  would be the first component to look at joint persona behavior.
- **🟢 Output venue ready.** `CounterfactualResult.suggestions[]` with free-string
  `signal_anchor`; `persona_dissent` anchor already used in dormant stage11. No schema change.
- **🟢 A/B seam clean.** New audience signal slots at `aggregator.ts:863` behind a flag,
  Apollo untouched.

---

## 7. Build difficulty + plan

**The quantum part is the easy part.** The 10-qubit engine is a 1,024-element complex
vector + one matrix exponential — a few hundred lines of TS (complex-linalg helper) or a
tiny numpy sidecar; runs in milliseconds. The real work is the **modeling** (the coupling
graph `J_ij`) and the **validation** (Gates 1–2).

| Stage | What | Size |
|---|---|---|
| Core engine | 10 qubits, H, evolve, Born measure | 2–3 days |
| Modeling | `J_ij` from archetype roles + `h_i` from intents | within ~1 week |
| Gate 1 | factorizability test (no data) | ~1 day |
| Gate 2 | breakout-correlation harness (reuse learning harness) | few days |
| **Total to validated answer** | | **~2–3 weeks** |

Module layout (standalone, does NOT touch `src/lib/engine/`):
`scripts/quantum-cognition-spike/` → `state.ts` (qubit register + H) · `couple.ts`
(`J_ij` graph) · `fields.ts` (intents → `h_i`) · `measure.ts` (Born + outputs) ·
`gate1-factorize.ts` · `run.ts` · `gate2-report.ts` · `classical-baseline.ts`.

---

## 8. Honest gaps / ceiling

1. **Two-gate split is real.** Gate 1 (signature exists) is cheap and proves the QC claim.
   Gate 2 (predicts breakout) needs a labeled outcome set bigger than 8 videos — lean on the
   ~225-row corpus as validation.
2. **Predictive ceiling.** Breakout is heavily exogenous (algorithm, seeding, luck). The
   content-side contagion signal explains *part* of the variance, never all. Partial signal
   on a currently-zero capability is still a win — don't promise an oracle.
3. **Coupling priors unvalidated.** `J_ij` comes from archetype roles (theory). Defensible,
   but a hypothesis until Gate 2.

---

## 9. Generalization (roadmap aside — build population-first)

The entangled-population model is a **general collective-response primitive**, not video-only:

| Layer | Reusable? |
|---|---|
| QC core (entangled population, Born, factorizability) | ✅ build once, domain-agnostic |
| Coupling graph pattern | ✅ transfers, weights re-set per domain |
| Stimulus → local-field encoder | ❌ per-vertical |
| Archetype set + ground-truth validation | ❌ per-vertical |

**Generalized EV = collective human response** (marketing/creative response, product
adoption, opinion/sentiment cascades) — anywhere social coupling drives an observable
outcome. Video is the **validation vertical** (cleanest ground truth), not the only one.

**NOT generalizable to single-person cognition** — there the entanglement edge disappears.
Single-person QC is a *separate* capability (order/sequence effects: script/hook ordering,
funnel sequencing, survey design — the QQ-equality is its proven win). Complementary,
deferred. Build population-first; it has the clean litmus and the unique edge.

---

## 10. Open decisions (now small)

1. **Coupling graph `J_ij`** — the one real modeling choice. Sign off the archetype-role
   topology (sharer hub / lurker sink / cross_niche threshold / loyalist pre-coupled)?
2. **`h_i` mapping** — how persona intents combine into the engage-tilt (proposed: weighted
   share+save+comment+watch). Approve a simple weighted combine?
3. **Evolution scalars** — coupling gain + evolution time. Hand-set from face validity
   (start small, increase until Gate-1 signature appears without saturating). Approve
   hand-set, not fit?

---

## 11. Operational prerequisites
- `.env.local` in the spike worktree: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `DASHSCOPE_API_KEY`.
- Gate 2 dataset: reach-controlled, breakout-labeled videos (the ~225-row corpus, as
  validation only). For an initial smoke, the 6–8 known-outcome videos still work for Gate 1
  (signature) + a directional Gate 2.

---

## 12. OUT OF SCOPE — deferred, tracked, NOT forgotten

| Item | Disposition |
|---|---|
| FOLD reliability (1-attempt, fail→null drops 50% of score) | Separate engine-hardening gap |
| READ silent-fail → all-zeros | Separate engine-hardening gap |
| §2.6 Chase Hughes behavioral layer (mined, ethics-gated, un-wired) | Complementary hero-half knowledge effort; higher-certainty EV — consider before/alongside |
| Chat citations ungrounded | Unrelated product bug |
| Single-person QC (sequence/ordering) | Separate capability, §9 — deferred |

---

## 13. References
Busemeyer & Bruza, *Quantum Models of Cognition and Decision*; Pothos & Busemeyer (order
effects); Wang & Busemeyer (QQ-equality, question-order law); Khrennikov (interference).
Internal: `wave3/persona-registry.ts` (10 archetypes), `wave3/aggregator.ts` (independent
baseline), `learning/` (runnable harness), `types.ts` (`PersonaSimulationResult`,
`CounterfactualResult`).
