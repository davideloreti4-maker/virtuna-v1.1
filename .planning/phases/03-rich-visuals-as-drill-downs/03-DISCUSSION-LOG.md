# Phase 3: Rich Visuals as Drill-Downs - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 3-Rich Visuals as Drill-Downs
**Areas discussed:** Visual → surface mapping, Curate vs preserve-all, Add a score drill-down, Reskin depth & sign-off

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Visual → surface mapping | Where each rich chart mounts; homeless visuals (ScoreDistribution, FactorBars, InsightHero) | ✓ |
| Curate vs preserve-all | How literally to honor "nothing visual deleted" | ✓ |
| Add a score drill-down? | A 5th panel for the homeless ScoreDistribution | ✓ |
| Reskin depth & sign-off | Token-swap vs re-treat + whether a human-UAT gate | ✓ |

**User's choice:** All four. **Notes:** "on all topics in the answer always show me your thought-through recommendation" — standing instruction to lead every answer with a reasoned recommendation.

---

## Curate vs preserve-all

| Option | Description | Selected |
|--------|-------------|----------|
| Curate — drop superseded | Drop FactorBars (replaced by 0-100 DriverRows) + InsightHeroFrame (replaced by new hero); data already in the new Reading; keep the distinct rich visuals | ✓ |
| Preserve-all (literal) | Every board visual gets a drill-down home, including the old hero + 0-10 bars; bigger phase, visible redundancy | |

**User's choice:** Curate — drop superseded.
**Notes:** Recommendation accepted. "Nothing deleted" honored in spirit — the *information* survives in the new hero/rows, the redundant *component* doesn't. → D-01.

---

## Add a score/hero drill-down

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — tap gauge → score panel | Add a 5th panel: niche histogram (where your 71 sits) + confidence range; gives ScoreDistribution a home, deepens the instrument the gauge was chosen for | ✓ |
| No — score stays clean | Hero number is a clean untappable headline; ScoreDistribution dropped or folded into inline Deeper-read | |

**User's choice:** Yes — tap gauge → score panel.
**Notes:** Recommendation accepted. Extends the P2 closed union hook|retention|share|personas → +score. → D-02.

---

## Filmstrip placement (mapping sub-fork)

| Option | Description | Selected |
|--------|-------------|----------|
| Retention — pair with curve | Filmstrip + RetentionChart share the timeline; drop point lines up with the frame on screen ("watch journey") | ✓ |
| Hook — visual stop-power | Filmstrip as evidence behind the modality sub-scores (the open only) | |
| Its own 'Content' surface | A 6th panel for the full craft instrument; more surface, more scope | |

**User's choice:** Retention — pair with curve.
**Notes:** Recommendation accepted. Strongest narrative pairing. → D-04.

---

## Panel density (mapping sub-fork)

| Option | Description | Selected |
|--------|-------------|----------|
| Composed cluster per panel | A panel shows its related set, scrollable (retention = curve + filmstrip + table); preserves cross-visual relationships; themed, not a dump | ✓ |
| One focused chart per panel | Each tap = a single chart; calmest, but more taps and loses cross-visual context | |

**User's choice:** Composed cluster per panel.
**Notes:** Recommendation accepted. The value is in the relationship between visuals. → D-06.

---

## Reskin depth + sign-off

| Option | Description | Selected |
|--------|-------------|----------|
| Swap + re-treat + UAT gate | Token-swap & strip-glass baseline; re-treat charts that fight the matte taste bar (gradient/glow); live human-UAT review at P3 close (like THEME-06) | ✓ |
| Token-swap only, no gate | Fastest; trust the token system + taste bar; risk a gradient/glow slips through | |
| Full re-treat each chart | Redesign every chart from scratch; highest craft, much bigger phase — drifts toward the stood-down rebuild | |

**User's choice:** Swap + re-treat + UAT gate.
**Notes:** Recommendation accepted. The reskinned charts are net-new visual surfaces the P1 shell gate never covered; milestone has a burned-twice-on-craft history. → D-07.

---

## Emotion arc (flagged, not a selected question)

**Recommendation:** Drop — it is not a standalone chart (woven into `ContentAnalysisFrame`); extraction is rebuild-ish work outside reskin+remount; supporting-tier data.
**Outcome:** No objection raised → accepted. → D-05.

---

## Readiness check

| Option | Description | Selected |
|--------|-------------|----------|
| Ready for context | Product forks resolved; remaining items are planner/researcher discretion | ✓ |
| Explore more gray areas | Pull a smaller item up to an explicit decision | |

**User's choice:** Ready for context.

---

## Claude's Discretion

- Mobile interactivity downgrade (PersonaGraph hover→tap, filmstrip scrub, table sort).
- `RetentionPlayer` inclusion — gated on uploaded-source persistence on permalink reload.
- Per-visual degraded/empty states — reuse P2 `PanelEmpty`, follow D-13.
- `ScoreDistribution` confidence-range text gating (`showRangeText`).
- Whether to relocate chart files vs reskin in place — keep imports clean + reading cluster board-store-free.

## Deferred Ideas

- Emotion arc as a drill-down (no standalone chart; D-05).
- `RetentionPlayer` scrubbable video (source-persistence dependent).
- A dedicated "Content/Craft" 6th surface (declined — filmstrip folds into retention).
- Shareable / deep-linked drill-down panels (`?panel=…`); fuller share = v2 SHARE-01.
- Naming reconciliation (Reading → Simulation prose pass) — still carried from Phase 1 & 2.
