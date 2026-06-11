# Phase 1 — Synthesis & Fix-Plan (build map)

> Collapses the e2e walkthrough (45 flags + D-R1 + output-contract thesis + cheatcode
> vision) into a prioritized, dependency-ordered plan across 01-01…01-04, with a clean
> engine-side vs Phase-2-handoff vs deferred split. Source: 01-WALKTHROUGH-LOG.md,
> 01-ENGINE-ASBUILT-MAP.md. Created 2026-06-11.

## North star (the throughline)
The engine already produces 3 of the 5 cheatcode outputs — it buries them under generic
scorecards and withholds the one creators want most. **Job = emit LESS, lead with the moat,
make it honest, build the outcome model.** Cheatcode = certainty + specificity + done-for-you,
before posting. Oracle, not dashboard.

## Locked decisions (Tier 0)
- **D-R1:** Read = pure sensor (drop factor scores/rationale/overall_impression); Apollo = sole judge.
- **ENG-02 direction (evidence-backed, F31):** remap-guard + prose-discipline + § kept internal,
  over heavy redesign. Redesign only if Phase-4 chat wants the shared taxonomy.
- **Confidence:** re-base agreement on Apollo-vs-Fold (F22), not Apollo-vs-itself.

## The 3 work tiers

### Tier 1 — Honesty & correctness (must-do, low-risk, mostly mechanical)
| Flag | Fix | Plan |
|------|-----|------|
| F23/F30/F31 | §-cite remap guard (validate→strip/flag danglers vs lean core) + keep § out of user prose | 01-01 |
| F9 | Read: bounded retry on empty critical field + drift logging (D-11) | 01-02 |
| F18/F20 | Fold: one bounded retry + salvage valid personas (stop all-or-nothing) | 01-04 |
| F22/F44 | confidence agreement = Apollo-vs-Fold; kill self-agreement | 01-04 |
| F34 | Stage-10 rebase on Apollo-vs-Fold or retire (its gemini_score basis dies w/ D-R1) | 01-04 |
| F18(honesty) | surface single-signal death (partial_analysis flag), not just dual | 01-04 |
| F7 | verify/fix tiktok rehost derive-and-drop race (move delete to true post-pipeline finally) | 01-01 audit / 01-04 |
| F12/F35/F43 | prune dead: confidence:1.0, reasoning="", rule/trend/ml constants, applyCtaPenalty (dead), platform_fit/audio_fingerprint | 01-03/01-04 |
| F16 | loosen audio_description min(10) | 01-02 |
| F17 | clean fold stale comments; confirm no-thinking is intended | 01-02/01-04 |

### Tier 2 — D-R1 restructure + cheatcode output contract (medium-risk, cross-cutting, Phase-2 ripple)
| Item | Fix | Plan |
|------|-----|------|
| D-R1 Read side | drop factor scores + overall_impression + improvement_tip from Read output | 01-02 |
| D-R1 Apollo side (F27/F28/F6) | rebuild buildDeepSeekUserMessage around perception skeleton; trim 9-card creator dump; consolidate dual instruction source | 01-03 |
| F24 | drop component_scores on video (like T3.3 behavioral_predictions) | 01-03 |
| F26 | stop emitting discarded composite_score | 01-03 |
| F36 | collapse 3 scorecards → 1 (Apollo dims); kill gemini_score; DECIDE rulebook fate | 01-03/01-04 + Phase 2 |
| F37/F41 | emit first-class HERO block { verdict_line, ceiling, the_one_fix, go_no_go, post_window } | 01-03 (Apollo out) + 01-04 (assembly) |
| F25/F45 | score honesty: lead tier + distribution, demote /100 (engine emits tier/band) | 01-04 + Phase 2 |
| F42 | persist everything the board shows (kill live/permalink gap) | 01-04 + route |
| Cheatcode #1/#4 | moment-drop+reason & persona who-leaves as clean plain-language fields | 01-04 |

### Tier 3 — Phase 2 handoffs (DISPLAY, not engine — do NOT build here)
F31 §-prose render strip · F32 re-source "What drives it" off Apollo dims · impact-score apollo
mislabel · F41 Verdict-tab IA (tab shows score not verdict) · bubble→plain "who it's for" verdict ·
F38 cut "11 of 17 signals" jargon + de-dup intents · one-verdict-first progressive disclosure ·
F39 monetization surface. → Phase 2 (Board/Test UI/UX). Engine just emits clean honest fields.

### Tier 4 — Strategic / deferred
- **F40 — grounded outcome/views model.** THE #1 value lever ("post this → land here"). Big (corpus/
  learning-based, not a score transform). DEFERRED — needs its own decision/phase. Name it, don't park silently.
- **D-10/F8 — flash vs plus read model.** Needs live A/B (01-02 Task 2 checkpoint).
- **F33/F11/F21 — latency.** Apollo measured ~92s and GATES (not fold) — reclaim in 01-04 cleanup after quality fixes; measure-first.

## Dependency-ordered execution (existing wave order holds)
1→2→3→4 is correct because each edits the next's input shape:
- **01-01 (ENG-02 grounding)** — independent moat fix; remap+prose-discipline. FIRST.
- **01-02 (Read sensor + drift)** — D-R1 Read side + F9 retry + flash/plus A/B. Read output shape locked here.
- **01-03 (Apollo prompt + output)** — depends on 01-02 (new Read shape) + 01-01 (grounding); rebuild input, hero block, trim, drop dead output.
- **01-04 (aggregator + honesty + verify)** — depends on 01-02+01-03; gemini_score removal, confidence fix, hero assembly, fold retry, dead-tail prune, persist, latency, E2E verify.

## SCOPING QUESTION (needs Davide)
Original phase scope = "audit/refine the existing engine (correct/honest/fast)". The walkthrough
surfaced a bigger opportunity: the **cheatcode output-contract restructure** (Tier 2: hero block +
collapse scorecards + prune). Options:
- **A (tight):** Tier 1 + D-R1 Read-side only. Defer Tier 2 restructure to a follow-on paired with Phase 2.
- **B (recommended):** Tier 1 + D-R1 + Tier 2 output-contract restructure IN this phase. Rationale:
  Phase 2 board CANNOT build the cheatcode UI on the current 3-scorecard output — the engine must emit
  the hero-block/one-framework shape first. Defer only F40 (outcome model) + display (Tier 3).
- **C (full):** B + commit to scoping the F40 outcome model decision now.

## DECISION — Scope B (Davide, 2026-06-11)
This phase delivers: Tier 1 (honesty/correctness) + D-R1 (Read pure-sensor) + Tier 2 (cheatcode
output contract: hero block, collapse 3 scorecards → 1, prune dead output, honest score band, persist
what's shown). DEFERRED: F40 grounded-outcome model (own decision/phase) + Tier 3 display (Phase 2).
→ Plans 01-03 and 01-04 grow materially (absorb Tier 2); 01-01/01-02 largely intact. Plans need a
targeted re-scope to absorb this before/as we execute each.
