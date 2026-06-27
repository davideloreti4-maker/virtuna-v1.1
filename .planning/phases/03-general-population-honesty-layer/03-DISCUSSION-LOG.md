# Phase 3: General Population + Honesty Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-27
**Phase:** 3-general-population-honesty-layer
**Areas discussed:** Determinism close-out, General-run scope, Success-criterion, POP-01 data-model/Mode, Provenance surfacing, Custom-context, General templates

> Founder selected ALL four offered gray areas + asked for the additional topics I'd surface, each with a grounded recommendation as the first option. All 7 decisions resolved by accepting the recommended option.

---

## Determinism close-out (P2 NO-GO condition → D-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Drop thinking-mode synth + re-confirm (Recommended) | `enable_thinking:false` on the qwen-3.7-plus synth in enrich-signature.ts; re-run double-bake; expect signatureEqual:true. Genuinely closes the leg + cuts cost/latency. Guard: A/B socials control. | ✓ |
| Scope contract to frozen artifact | Assert determinism on the persisted signature; push re-bake determinism to v2 (CAL-01). Redefines the bar. | |
| Both | Belt-and-suspenders. | |

**User's choice:** Drop thinking-mode synth + re-confirm.
**Notes:** Runs as a P3 Wave-0 prerequisite before any General-surface work.

---

## General-run scope (phase boundary → D-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Object + library + honesty only (Recommended) | No General scoring/run path; Simulate stays P5 (SIMU-01). SC#3 "runs" = runnable-READY zero-setup. | ✓ |
| Minimal runnable General scorer in P3 | Pull a thin General scoring path forward. Duplicates P5, grows the phase. | |

**User's choice:** Object + library + honesty only.

---

## Success-criterion (POP-02/05 → D-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Free-text, stored + editable, P5/P6 consume (Recommended) | Single editable prose field; flows into DomainPack.scoring contract; no live scorer in P3. | ✓ |
| Structured / selectable metric | Metric enum/builder. Premature — no General scorer yet. | |
| Free-text now + optional structured later | Prose now, seam for structure later. | |

**User's choice:** Free-text, stored + editable, P5/P6 consume.

---

## POP-01 data-model / Mode (additional → D-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Additive `mode` column + mode-gated constraints (Recommended) | Explicit mode ('socials'\|'general'); socials byte-stable; weight-sum CHECK gated to mode='socials'; existing audiences default 'socials'. | ✓ |
| Derive Mode from is_general flag | No new column. Muddier — conflates "default General constant" with "in General mode." | |

**User's choice:** Additive `mode` column + mode-gated constraints.

---

## Provenance surfacing (TRUST-02 → D-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Inline evidence + explicit ungrounded state (Recommended) | Grounded persona shows evidence inline; ungrounded persona renders muted "no evidence — Directional." Honest at a glance. | ✓ |
| Evidence behind expand/disclosure | Compact summary; evidence on click. Not honest at a glance. | |

**User's choice:** Inline evidence + explicit ungrounded state.

---

## Custom-context / source=user (D-defer-01 fulfillment → D-07)

| Option | Description | Selected |
|--------|-------------|----------|
| First-class custom_context[] + input/edit, "user-added grounding" (Recommended) | Promote provenance.custom_context to a real SIM-scoped field; input+edit on any General audience; rendered distinct from scraped grounding. | ✓ |
| Read-only display in P3, defer input/edit | Surface if present, defer affordance. Slips the committed D-defer-01 promise. | |

**User's choice:** First-class custom_context[] + input/edit.

---

## General default templates (POP-04 → D-08)

| Option | Description | Selected |
|--------|-------------|----------|
| 2 hand-authored virtual-constant panels: analyst + hiring (Recommended) | Mirror PRESET_AUDIENCES; no bake/scrape; Directional; zero-setup by construction. | ✓ |
| Generate template personas via a bake at first use | Richer but adds cost + breaks zero-setup. | |
| Ship just one template to start | Minimal; roadmap signals two. | |

**User's choice:** 2 hand-authored virtual-constant panels: analyst + hiring.

---

## Claude's Discretion

- Exact migration mechanics for the `mode` column + conditional weight-CHECK (D-04).
- Shape/location of `resolveTier` + badge component (D-06); storage shape of `custom_context[]` beyond provenance-level/SIM-scoped (D-07).
- Authored persona content for the analyst/hiring panels (D-08).
- Whether success-criterion is a column or lives in signature/profile jsonb (D-03).
- Where the General library extends `audience-manager.tsx` (Mode-sectioning is P7).

## Deferred Ideas

- General Simulate verb → P5 (SIMU-*); Profile verb → P5 (PROF-*); Predict → P6 (PRED-*); Input adapter → P4 (IN-*); Audience-as-front-door → P7 (UX-*).
- Structured success-criterion metrics → post-P5/P6.
- Re-bake/drift determinism + self-calibration → v2 (CAL-01).
