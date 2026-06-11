# Phase 5: Wire + Surface - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-06
**Phase:** 5-Wire + Surface
**Areas discussed:** Score presentation, Board reveal UX, Grounded engagement (R11), Rewrite + insight surfacing (R4)

> User requested thought-through recommendations on each area; Claude presented reasoning,
> user selected the recommended option in every case.

---

## Score presentation — de-noising approach

| Option | Description | Selected |
|--------|-------------|----------|
| Rubric-sum 6 dims | Apollo scores 6 named dims (temp0+seed), deterministic sum into 0–100; kills holistic variance; in-scope R5 | ✓ |
| Ensemble N reads | Run Apollo N times, median; robust but multiplies ~53s call, breaks budget | |
| Accept noise, band only | No derivation change; band wide enough to absorb ±5 | |

**User's choice:** Rubric-sum 6 dims
**Notes:** Matches banked P3 "composite of named dimensions" principle; ±5 swing is the holistic-guess variance.

## Score presentation — board appearance

| Option | Description | Selected |
|--------|-------------|----------|
| Directional band + range | strong/mid/weak + tight range, demoted below insight; reuses coral band machinery | ✓ |
| Bare number, demoted | Single integer, small/secondary | |
| Band label only, no number | "Strong/Mid/Weak", no digits; loses chess-engine-eval framing | |

**User's choice:** Directional band + range
**Notes:** Keeps the 2026-06-03 chess-engine-eval framing without re-exposing a jittery integer.

---

## Board reveal UX — paint strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Progressive per-frame | Each frame paints when its call lands; 17s first paint; single final score (omni has no score → no shifting) | ✓ |
| Single final paint | Spinner until ~74s then all at once | |
| Progressive + skeleton states | Progressive with per-frame skeleton placeholders | |

**User's choice:** Progressive per-frame
**Notes:** omni produces no score, so the "number shifts" fear is moot — score appears once, final.

## Board reveal UX — <45s target

| Option | Description | Selected |
|--------|-------------|----------|
| Drop it — 74s is fine | 17s first paint feels fast; sub-45 paths conflict 1-call mandate or fake a number | ✓ |
| Keep <45s as stretch goal | Pursue later via non-conflicting path, don't gate P5 | |

**User's choice:** Drop it

---

## Grounded engagement (R11) — input handling

| Option | Description | Selected |
|--------|-------------|----------|
| Gate on researcher check | Confirm baseline data reaches engine; build if yes, defer + strip fake UI if no | ✓ |
| Commit to building R11 now | In-scope regardless; bigger phase, risk if data not captured | |
| Defer R11 entirely | Just remove fake UI, build later | |

**User's choice:** Gate on researcher check
**Notes:** Only creator_handle threaded today; follower/typical-views data is in the scraping layer, unconfirmed at the engine. R11's own note requires confirming inputs first.

## Grounded engagement (R11) — output form

| Option | Description | Selected |
|--------|-------------|----------|
| Range + confidence vs own history | Wide honest range vs creator median, never a point | |
| Multiplier band only | "below/on-par/above usual", no numbers | |
| Decide after researcher reports | Hold form until inputs known | ✓ |

**User's choice:** Decide after researcher reports
**Notes:** Let the available data shape the output; default lean is a wide history-relative range if built.

---

## Rewrite + insight surfacing (R4) — wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Surface-time correlation | Keep fold ∥ Apollo parallel; board ties rewrites to heatmap drop-points; awareness rendered not generated | ✓ |
| True serial wiring | fold → Apollo reads curve at generation; ~+50s → ~120s, breaks R6 | |
| Cheap drop-point handoff | Feed Apollo only worst drop timestamp; still serial, same latency hit | |

**User's choice:** Surface-time correlation
**Notes:** Reinterprets R4 from generation-time to surface-time to preserve the 74s E2E / R6 ≤90s.

## Rewrite + insight surfacing (R4) — surface set

| Option | Description | Selected |
|--------|-------------|----------|
| Insight-hero full set | read + 3 rewrites hero → 6 dims → heatmap → score band → flop warning; strip fake-engagement UI | ✓ |
| Rewrites + score only | Just 3 rewrites + score band; hold dims/flop for later | |
| Everything, equal weight | No hero hierarchy; risks score competing with insight | |

**User's choice:** Insight-hero full set
**Notes:** Insight stays the hero per apollo-direction; score never competes for top attention.

---

## Claude's Discretion

- Per-frame skeleton/loading affordance during progressive reveal (user picked plain progressive).
- Exact band copy, range-width formula, tone thresholds within `verdict-derive.ts`.

## Deferred Ideas

- Dead keyframe→fold plumbing cleanup (standalone /gsd-quick, ~20 min — follow-up #2).
- Broader omni-flash validation (music/accented/visual-only — follow-up #4).
- <45s engine path (explicitly dropped).
- True generation-time audience-aware rewrites (fold→Apollo serial) — deferred unless latency budget reopens.
- Real grounded engagement estimate — deferred if researcher finds baseline input not wired.
- Chat surface — next milestone.
