# Phase 10: Account Read, Saved Shelf & Recalibration Flywheel - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 10-account-read-saved-shelf-recalibration-flywheel
**Areas discussed:** Cut line / hero, Outcome→audience flywheel mechanic, Outcome capture, Recalibration trigger, Saved shelf shape, Account Read output

> Seeded by this session's Sandcastles competitive review (`.planning/research/sandcastles-adopt-improve.md`): P10 = the moat phase (calibration compounding via the outcome loop). User asked recommendations be surfaced first, grounded in prior session strategy + P7 carry-forward.

---

## Cut line / hero

| Option | Description | Selected |
|--------|-------------|----------|
| Flywheel hero; shelf+AcctRead lean; Drift folds in | Build the loop deep (the moat); shelf + Account Read ride existing infra; Drift = the loop's trigger | ✓ |
| All four equal depth | Full build each — risks sprawl + dilutes moat | |
| Shelf + Account Read first, flywheel lean | Visible surfaces first, defer the loop | |

**User's choice:** Option 1 — but required a complete, sound explanation of the data flywheel + learning loop before accepting ("it needs to actually make sense and be useful").
**Notes:** Drove the full flywheel re-design (see below).

---

## Outcome→audience flywheel mechanic

| Option | Description | Selected |
|--------|-------------|----------|
| Propose-and-confirm PersonaWeights nudge; manual entry v1 | Initial hand-wavy proposal | (rejected as unrefined) |
| Silent auto-recalibrate | Auto-mutate on outcome | |
| Log only | No correction | |

**User's choice:** None — flagged the initial proposal as "doesn't seem so refined." Triggered a full re-design.
**Notes:** Re-designed into a sound loop: (D-02) compare engagement SIGNATURES not scores (pull-score is a concept ceiling, not a view prediction); (D-03) separate calibration-error (→audience object) from craft-error (→creator/Account Read) so flops don't corrupt the model; (D-06) two levels — per-creator learning loop (built) vs cross-creator data flywheel (seeded only). Naive "7 vs 9 → bump weights" explicitly rejected for scale-mismatch + noise + can't-attribute reasons.

---

## Outcome capture

| Option | Description | Selected |
|--------|-------------|----------|
| Paste posted URL → scrape public + optional private add | Apify scrape public metrics + creator adds saves/retention/clicks | ✓ |
| Manual entry of full breakdown | High friction → low completion | |
| Public scrape only | Misses saver/converter dispositions | |

**User's choice:** Option 1 (recommended).
**Notes:** Reuses scrape infra; honest about public-vs-creator-supplied; yields a real engagement signature.

---

## Recalibration trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Confidence-gated after N consistent posts; creator confirms | Noise-resistant threshold + human-in-the-loop nudge | ✓ |
| Every post nudges (EMA) | Always-moving scoring object fights regression gate | |
| Manual recalibrate button only | Weaker compounding | |

**User's choice:** Option 1 (recommended).
**Notes:** Targets P7's `PersonaWeights` `analysis_override`; preserves determinism + regression gate + no-autonomous-mutation.

---

## Saved shelf shape

| Option | Description | Selected |
|--------|-------------|----------|
| Flat shelf SURFACE, typed items, thread↔shelf wiring (P12-extendable) | Flat per ROADMAP guard but typed + Acts/State wiring so P12 Library extends it | ✓ |
| Minimal sidebar list (ROADMAP-literal) | P12 rework risk | |
| Full Library now | Scope creep into P11/P12 | |

**User's choice:** Option 1 (recommended).

---

## Account Read output

| Option | Description | Selected |
|--------|-------------|----------|
| Thread card reusing reading/ render, savable to shelf | "Read on yourself"; reuse reading/; Act→State; Apify scrape not Connectors | ✓ |
| Dedicated standing-report surface | New surface; dashboard-metaphor drift | |
| Lightweight text summary | Underwhelms vs Test Read | |

**User's choice:** Option 1 (recommended).

---

## Claude's Discretion

- Exact `N` threshold + divergence/confidence math for recalibration (deterministic, gate-safe).
- Disposition→engagement-proxy mapping table over the existing 10 archetypes.
- DB schema for outcome capture + reconciliation logging (structured to later feed cross-creator priors).
- Saved-shelf persistence shape (extend `bookmarks` vs new typed table).
- Account Read scrape sync/stream + Drift re-scrape cadence (reuse cron infra).

## Deferred Ideas

- Cross-creator prior-fitting (actuated data flywheel) — seeded only.
- Re-scrape automation / auto video↔Read attribution.
- Full P12 Library (watchlist + Explore wiring).
- remix-your-own-winner (v6.1 backlog); generate→critique→regenerate (backlog); RAG over history (backlog); persona editing (post-tuning); shelf folders/tags/CMS (out).
