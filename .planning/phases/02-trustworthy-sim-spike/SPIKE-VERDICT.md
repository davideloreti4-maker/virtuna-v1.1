# SPIKE-VERDICT — Trustworthy-SIM (no-calibration General)

**Phase:** 02-trustworthy-sim-spike
**Requirement:** TRUST-03
**Date:** 2026-06-26
**Gate basis:** D-04 hard 3-gate (all three legs must PASS for a GO)
**Question answered:** *Can a user build a trustworthy General SIM with no calibration data?*

Evidence source: the human-approved live probe in `02-02-SUMMARY.md` (`scripts/spike/trustworthy-sim-probe.ts`, frozen `khaby.lame` scrape re-baked ×2 with real Qwen, exit 0) + the kept zero-network replay gate `src/lib/audience/__tests__/signature-determinism.test.ts`. The probe scaffolding is torn down at the close of this plan (D-05); its evidence is quoted verbatim below and recoverable from git history.

---

## OVERALL VERDICT: **NO-GO** (conditional — clears to GO after the determinism mitigation below)

All three gates must PASS for an unconditional GO. **Determinism FAILED** (genuine, not transport). Per D-04 a failed gate is a NO-GO with a written fallback plan — that fallback is in §Fallback. Provenance and Tiering are unambiguously GREEN, so the trust model's *grounding* and *honesty* legs hold; the single open issue is bake reproducibility, which the bake-once-freeze production reality and a one-line synth config change resolve. This is a **NO-GO pending one mitigation**, not a model-invalidating NO-GO.

| Leg | Gate (D-04) | Result |
|-----|-------------|--------|
| 1. Determinism | 2/2 bakes identical signature JSON post-normalization | **FAIL** (genuine non-determinism) |
| 2. Provenance | 100% reactors ≥1 evidence quote · ungrounded distinguishable · scraped + `source=user` | **PASS** |
| 3. Tiering | no-calibration SIM resolves Directional by rule (never Validated) | **PASS** |

---

## Gate 1 — Determinism: **FAIL** (genuine)

**Bar (D-04):** the same SIM baked twice (temp 0 + seed, bake-once) produces an identical signature JSON post-normalization (`scraped_at` stripped).

**Result: FAIL.** The two bakes of the IDENTICAL frozen `khaby.lame` input diverged on load-bearing LLM-derived fields. Probe evidence (verbatim, 02-02):

```
# DETERMINISM
  socials: NON-DETERMINISTIC (A !== B)
    videos_watched: A=3 B=3
    full-diff (un-normalized) differing paths: creator_persona.content_description,
    creator_persona.context, creator_persona.format_signature, audience.temperature_mix.*,
    audience.interest_tags.*, audience.what_resonates, audience.what_falls_flat,
    audience.persona_weights.*, audience.personas.{0..9}.{share,reaction_frame,evidence},
    summary, provenance.scraped_at
    signatureEqual (post-normalization): false
  general: NON-DETERMINISTIC (A !== B)   (same load-bearing field classes diverge)
```
```
PROBE_JSON … "socialsEqual":false,"watchedMismatch":false … "general":false …
```

**Why this is a GENUINE FAIL and not the Pitfall-2 INCONCLUSIVE escape.** Pitfall 2 (02-RESEARCH §Pitfall 2): a flaky omni watch returns `null` on one bake but not the other, so `videos_watched` differs and the synthesis payload differs for a *transport* reason — that case is scored **INCONCLUSIVE, not a determinism failure** (re-run or pin the watched set). Here **watch counts MATCHED (A=3, B=3 → `watchedMismatch:false`)**, so the divergence is NOT transport. The omni-flash watch leg was reproducible; the divergence is downstream in the `qwen-3.7-plus` thinking-mode synthesis (`enable_thinking:true`, `thinking_budget:2000`) — exactly Pitfall 3 (thinking-mode residual non-determinism the seed exists to pin, but which the provider did not honor here). `temperature:0` + fixed `QWEN_SEED` were insufficient. The probe correctly did NOT spend an extra re-run, because the matched watch count already ruled out the INCONCLUSIVE branch.

**The KEEP replay gate IS deterministic and stays green (CI-safe backstop).** `signature-determinism.test.ts` (02-01) proves the *assembly + normalization* half of the determinism property is byte-deterministic by construction: with recorded LLM deps (zero network) two assemblies from identical inputs are byte-identical post-normalization, and `provenance.scraped_at` is the SOLE volatile field (fake-timers double-bake, Assumption A1). 5/5 green pre- and post-teardown. So determinism splits cleanly:
- **Assembly / normalization / tiering determinism (non-LLM half): GREEN, CI-locked** — this is P3's free-by-construction regression foundation.
- **LLM-synthesis determinism (the make-or-break unknown): RED** — thinking-mode synth does not reproduce across bakes.

**Material nuance the verdict must weigh (bake-once-freeze).** Production **bakes the signature ONCE and FREEZES it on the row** (`calibration.ts` bake-once orchestration; the per-skill hot path never re-calls the LLM). It never re-bakes the same input. So cross-bake non-determinism is **THEORETICAL** (it is never exercised operationally) rather than OPERATIONAL — the frozen artifact a user sees is stable for the life of the SIM. The FAIL is real against the literal D-04 bar (2/2 identical re-bakes), but its production blast radius is the re-bake/drift path (a v2 concern, CAL-01), not the user's day-to-day trust experience. This is why the verdict is NO-GO-pending-mitigation rather than a hard stop: the trust model is sound; the determinism *contract* needs to be either tightened (kill the jitter) or scoped honestly (assert on the frozen artifact, not on re-bakes).

---

## Gate 2 — Provenance: **PASS**

**Bar (D-04):** 100% of reactor personas carry ≥1 evidence quote; ungrounded personas are distinguishable from grounded ones; holds across BOTH scraped AND `source=user` evidence (D-03).

**Result: PASS.** Probe evidence (verbatim, 02-02):

```
# PROVENANCE
  socials A: 10/10 reactors grounded (≥1 evidence quote)
  socials B: 10/10 grounded
  general A: 10/10 grounded
  general B: 10/10 grounded
  ungrounded distinguishable: yes (empty-evidence predicate flags ungrounded reactors)
  source=user note surfaced in a persona's evidence: true
  general provenance.custom_context: {"source":"user","note":"audience is busy founders;
    reward terse, contrarian, data-backed takes"}
```

- **40/40 reactor-personas grounded** (10 each across all four bakes — socials A/B + general A/B).
- **Ungrounded distinguishable:** the empty-evidence predicate flags ungrounded reactors — grounded ≠ ungrounded is observable, not assumed.
- **`source=user` is first-class (D-03):** the user custom-context note (the `"contrarian"` probe token) surfaced inside a General-proto persona's `evidence`, and `provenance.custom_context = {source:"user", note}` tags it — so user-supplied grounding *strengthens* provenance (tagged, visible) rather than *fakes* it. The provenance model holds for both scraped and user-supplied evidence.

The KEEP gate also locks the substrate this leg inspects: `signature-determinism.test.ts` asserts all 10 personas carry non-empty `evidence` post-normalization.

---

## Gate 3 — Tiering: **PASS**

**Bar (D-04):** a no-calibration SIM resolves **Directional by rule**, never Validated.

**Result: PASS.** Probe evidence (verbatim, 02-02):

```
# TIERING
  no-calibration General SIM → Directional (expected Directional): OK
```

The tier keys off `DomainPack.calibration` (the trust-tier basis), NOT `Audience.calibration` (scrape provenance). Socials carries a populated `CalibrationSpec` (`baselineRef`) → Validated anchor; a no-calibration General SIM has no calibration set → Directional by rule. The KEEP gate locks this as a pure predicate (`resolveTier`): Socials→Validated, General/`undefined`/`{}`/`{baselineRef:""}`→Directional, never Validated. The badge *resolver* in `src/` is P3 (TRUST-01) — the spike asserts the rule only (D-05 scope).

---

## Fallback plan (required by D-04 for a NO-GO) — the path to GO before Phase 3

The trust model is sound on provenance + tiering; close the determinism leg with ONE of the following before P3 invests in the General surface. Recommended order:

1. **(Recommended) Drop thinking-mode for the synthesis bake.** Set `enable_thinking:false` (drop `thinking_budget`) on the `qwen-3.7-plus` synthesis call in `enrich-signature.ts`. Thinking-mode staging is the documented residual-jitter source (Pitfall 3); `temp:0` greedy decoding is the primary determinism lever and survives without it. Re-run the double-bake; expect `signatureEqual:true`. Cheapest, most direct fix; validate it doesn't regress synthesis quality on the socials control.
2. **(Acceptable) Scope the determinism contract to the frozen artifact (bake-once-freeze).** Make D-04's bar honest to production reality: assert determinism on the **frozen, persisted signature** (which is stable by construction — never re-baked) rather than on cross-bake reproducibility. The KEEP replay gate already locks this half green. Re-bake/drift reproducibility moves to v2 (CAL-01) where re-bake is actually a feature. Lowest engineering cost; trades a strict guarantee for an operationally-accurate one.
3. **(Hardening, optional) Field-tolerance in the equality rule.** Allow bounded tolerance on prose fields (`summary`, `reaction_frame`) while holding structural fields (weights, shares, tier, evidence-presence) byte-exact. Use only if (1) leaves acceptable residual prose jitter — do not use to paper over structural divergence.

A re-run of the live double-bake after applying (1) is the GO confirmation. Until one of these lands, the determinism leg is RED and the gate is NO-GO.

---

## P3 carry-forward

- **`source=user` structural shape (Open Question 3 / D-defer-01):** today the spike attaches custom context probe-locally as `provenance.custom_context = {source:"user", note}` (a SIM-level provenance block) and surfaces the note in persona `evidence`. **Recommendation for P3:** promote this to a real first-class field on the audience/signature — keep it at the **provenance level** (SIM-scoped `custom_context[]` with `source` + `note` + optional per-persona evidence linkage), not buried per-evidence-string, so the badge/provenance UI can render "user-added grounding" distinctly from scraped grounding. The full input affordance + UI + editing on any audience is P3 (D-defer-01).
- **`videos_watched=INCONCLUSIVE` caveat (Pitfall 2):** it did **NOT** trigger here (counts matched, `watchedMismatch:false`). But a live omni-watch mismatch in future re-bakes is a *transport* signal, not a determinism failure — score it INCONCLUSIVE and re-run / pin the watched set; never let it drive a NO-GO. The kept replay test is immune (recorded `watchVideo` deps).
- **Determinism regression foundation:** `src/lib/audience/signature-equality.ts` (`normalizeSignature`/`signatureEqual`/`stableStringify`) + `signature-determinism.test.ts` survive teardown as P3's free-by-construction gate (5/5 green, zero network, CI-safe). The badge resolver itself is P3 (TRUST-01).
- **Two production fixes from the live run carry forward (NOT throwaway):** `enrich-signature.ts` synth timeout 60s→120s (`aa783456`) and `competitor.ts` `subtitleLinks:null` acceptance + regression test (`dbbcf46c`). Both are latent calibration-path bugs the spike uncovered; they live in `src/` and survive the spike close.

---

## Budget actuals

| Resource | Final clean run | Target (D-01b) |
|----------|-----------------|----------------|
| Qwen calls | 10 | ~10 |
| Apify calls | 0 (re-baked from frozen fixture; D-01a) | 1 |
| Est. cost | < $0.50 | < $0.50 |

The final clean run hit budget exactly (10 Qwen + 0 Apify, re-baked from the frozen `socials-bundle.fixture.json`). Across the full debugging session ~3 Apify scrapes + extra omni/synth on aborted bakes (schema/scrub bugs aborted the first two scrapes pre-freeze) — total still in the ~$0.30–0.50 human-approved range. Once the fixture froze, every iteration was Apify-free (D-01a honored).

---

*Spike closed 2026-06-26. Determinism RED (genuine, mitigation in hand) · Provenance GREEN · Tiering GREEN. Verdict: NO-GO pending the §Fallback determinism mitigation, then GO for the Phase 3 General surface. Throwaway `scripts/spike/` torn down per D-05; KEEP gate + 2 production fixes retained.*
