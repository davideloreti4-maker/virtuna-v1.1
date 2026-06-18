# Phase 7: Audience Manager — calibrated audience as shared substrate across all skills (the moat) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 07-audience-manager-calibrated-audience-as-shared-substrate-acr
**Areas discussed:** P7 cut line, Persona model reconciliation, Calibration UX & persona visibility, Presets + active-audience selection, Goal → scoring reweight, Personal-audience scrape flow

> Format: each area presented as a single recommendation-first question (grounded options). All six recommendations accepted by the owner.

---

## P7 cut line

| Option | Description | Selected |
|--------|-------------|----------|
| Substrate + react-wiring + 1 steer proof (Recommended) | Audience object + Manager CRUD + calibration + general default + gate; wire audience into SIM/react; prove steer in ideas-runner only | ✓ |
| Substrate + steer across all skills | Also wire steer into all 5 runners + chat-runner | |
| Substrate object + Manager UI only | Defer all engine wiring (react + steer) | |

**User's choice:** Substrate + react-wiring + 1 steer proof
**Notes:** Gate-able slice; values deferred to refinement run anyway; avoids editing every runner + the separate chat-runner in one phase.

---

## Persona model reconciliation (regression-gate-critical)

| Option | Description | Selected |
|--------|-------------|----------|
| Layer over existing 10 — reweight + repaint (Recommended) | Keep 10 archetype IDs + byte-stable prompts; calibration = PersonaWeights override + repaint; Temp×Disposition = label lens | ✓ |
| New Temp×Disposition vocabulary (rebuild personas) | Redesign the 10 into an explicit matrix as engine definitions; forces re-baseline | |
| You decide post-research | Lock intent, planner chooses layering | |

**User's choice:** Layer over existing 10 — reweight + repaint
**Notes:** `persona-weights.ts` override precedence is literally built for this; general-audience stays byte-stable → regression gate survives by construction.

---

## Calibration UX & persona visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Visible read-only profile + persona list (Recommended) | Show Audience Profile + 10 personas read-only; no editing in v1 (values untuned) | ✓ |
| Fully editable personas | Creator can tweak mix + edit personas now | |
| Opaque — profile summary only | Personas stay under the hood | |

**User's choice:** Visible read-only profile + persona list
**Notes:** Makes "your audience" feel real (hero-object moat) + builds trust, but blocks editing of untuned values until the refinement run.

---

## Presets + active-audience selection

| Option | Description | Selected |
|--------|-------------|----------|
| General + 2 goal-leaning templates, per-thread active (Recommended) | General + growth-leaning + conversion-leaning presets; active chosen at composer chip, pinned per-thread | ✓ |
| General only, global single-active selection | Only General built-in; one global active | |
| General + 2 templates, global active | Three presets but global single-active | |

**User's choice:** General + 2 goal-leaning templates, per-thread active
**Notes:** Immediate value without forcing calibration; per-thread fits the existing thread-scoped context model (chain handoffs already carry context per-thread).

---

## Goal → scoring reweight

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed goal taxonomy w/ free-text label (Recommended) | Free-text label maps to fixed intent set (grow/sell/authority/nurture); deterministic weight bias, classified/picked once at calibration | ✓ |
| LLM classifies free-text goal each run | Per-run LLM weight bias; injects nondeterminism | |
| Goal is display-only in P7 | Store goal, defer reweight to refinement | |

**User's choice:** Fixed goal taxonomy w/ free-text label
**Notes:** Deterministic + cache-stable + testable; protects determinism + regression-gate constraints.

---

## Personal-audience scrape flow

| Option | Description | Selected |
|--------|-------------|----------|
| Creator's own handle → calibrate → graceful General fallback (Recommended) | Scrape creator's OWN account via Apify; honest General fallback on thin/failed scrape, never fabricate | ✓ |
| Any handle (own OR competitor) | Scrape any public handle as personal source | |
| You decide post-research | Lock intent, researcher confirms Apify shape | |

**User's choice:** Creator's own handle → calibrate → graceful General fallback
**Notes:** Matches "personal = my audience" + honesty spine; reuses shipped scrape infra. "Any handle" rejected — blurs personal-vs-target type distinction.

---

## Claude's Discretion

- Exact PersonaWeights bias values per goal-intent (structure now, values tuned in refinement run).
- The 10-archetype → Temperature×Disposition label mapping table.
- Calibration sync/async UX detail (researcher confirms Apify latency).
- Goal-intent creator-picked (dropdown) vs LLM-classified-once-at-calibration (must resolve to a cached deterministic bias).
- Audience DB schema — must stay `audience_id`→`audience_ids[]`-ready.
- THEME-06 flat-warm visual system as design SSOT.

## Deferred Ideas

- Steer across the remaining skills (hook/script/test/remix/chat) → post-P7 refinement run.
- Persona value tuning (prompts, signal→score weight fitting via fold A/B, goal-intent bias values) → refinement run.
- Persona editing by the creator → post-tuning.
- Multi-select audience compare (retention vs growth side-by-side) → post-v1; object kept `audience_ids[]`-ready.
- Real social OAuth → post-v1.
- Spread/virality prediction in the Read → post-v1.
