# Phase 1: Strip to Senses - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-04
**Phase:** 1-strip-to-senses
**Areas discussed:** Fake engagement + its UI, Dormant vs delete, Blend cut mechanics, Cut-call UI + optimal-post, Reverification scope

---

## Pre-flight (before discussion)

Two blocking problems found and resolved:
- **ROADMAP unparseable** — phase headings used `## Phase N — Name` (em-dash); SDK `roadmap.get-phase` returned `found:false`. Fixed to `## Phase N: Name` (colon). Committed `3e92a343`.
- **Stale phase-1 dir** — `01-strip-retrieval-similar-videos-trending-dashboard/` (2026-05-28, pre-Apollo, retrieval/trending strip) did not match current ROADMAP "Strip to Senses". User chose **Re-discuss fresh**; stale dir archived to `.planning/_archive/01-pre-apollo-strip-retrieval-trending/`.

---

## Fake engagement + its UI

| Option | Description | Selected |
|--------|-------------|----------|
| Null field, hide card | Delete jitter derivation; keep field null; card renders only when present; P5 rebuilds | ✓ (corrected) |
| Rip UI out now | Delete derivation + card + store field + result-card block entirely | |
| Honest 'unavailable' placeholder | Keep field + card, show explicit unavailable state | |

**User's choice:** "I only want to remove the fake stats as discussed (you're in the top 8%) — the rest should be kept as we discussed."
**Notes:** Reframed by the user. The fabrication to remove = the `Math.sin` jitter engagement numbers **and** the "top X%" corpus-percentile labels. The engagement-prediction *concept* + UI shell are KEPT; P5 (R11) repopulates grounded. With the jitter gone, the field is null in P1 → card null-degrades. **Honesty correction:** grounded LLM prediction is honest — we delete fabrication, not prediction. The score (grounded LLM read) stays honest and untouched.

---

## Dormant vs delete

| Option | Description | Selected |
|--------|-------------|----------|
| Uniform `_dormant/`, delete only fabricated | Move ml/audio-fp/trends/platform-fit/stage11/rule-semantic to `_dormant/`; hard-delete only predicted-engagement + stage10 flags | ✓ |
| Hard-delete everything dead | Delete all dead modules; git history is restore | |
| Case-by-case | Classify each module individually | |

**User's choice:** Uniform `_dormant/`, delete only fabricated (Recommended)
**Notes:** `_dormant/` preserves Apollo-corpus seed material + reversibility; excluded from tsconfig + vitest. Tests travel with source.

---

## Blend cut mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| Remove keys + assert/measure delta | Strip dead keys from SCORE_WEIGHT_KEYS; prove determinism + measure pre/post delta | ✓ |
| Preserve score byte-identical | Keep weights, only stop running dead calls (feed empty results) | |
| I decide after reading selectWeights | Read redistribution logic first | |

**User's choice:** Remove keys + assert/measure delta (Recommended)
**Notes:** Score derivation stays behavioral+gemini. Expect ~0 delta (dead sources already redistributed-away); any shift = honesty correction, documented — not silently absorbed. Gated on R8 determinism.

---

## Cut-call UI + optimal-post

| Option | Description | Selected |
|--------|-------------|----------|
| Hide nulls, keep optimal-post | Hide SuggestionsSection when null; null-safe platform_fit; keep optimal-post pending audit | ✓ |
| Remove counterfactuals + optimal-post UI now | Delete wiring; rebuild P3/P5 | |
| Keep fallback advice visible, cut optimal-post | Show FALLBACK_ITEM; dormant optimal-post | |

**User's choice:** Hide nulls, keep optimal-post (Recommended)
**Notes:** Ungrounded fallback advice ≠ honest → hide rather than show FALLBACK_ITEM. Keep optimal-post (honest 0-LLM heuristic) pending audit it isn't fabricated.

---

## Reverification scope

**User's choice:** "...everything you think should be reverified before plan/execution."
**Notes:** User delegated the reverification checklist to Claude. 15 items captured in CONTEXT.md D5 (determinism gate, score delta, DB counts, remix intact, UI null-degrades, `_dormant/` exclusion, import-graph, optimal-post audit, latency cap, cache-key bump, stage10 orphans, test reconciliation). Planner bakes these in as `[BLOCKING]` tasks / acceptance criteria.

---

## Claude's Discretion

- `_dormant/` directory layout + whether `rules.ts` regex tier travels (from import graph)
- Optional `_dormant/README.md`
- Order of operations for green-at-each-step
- `calibration-baseline.json` delete vs dormant (keep dormant if a non-label consumer survives)

## Deferred Ideas

- Grounded engagement estimate (R11) → P5
- Score rederivation / Apollo composite / directional confidence (R5) → P3/P5
- `database.types.ts` retrieval/engagement column cleanup → later schema pass
- Mining regex/persona-registry as Apollo corpus seed → P3
