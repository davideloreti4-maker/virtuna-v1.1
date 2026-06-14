# Phase 2: The Reading - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 2-The Reading (user-facing: "The Simulation")
**Areas discussed:** Hero form, Driver rows, Disclosure, P2↔P3 seam + states
**Mode note:** User selected all 4 gray areas and requested a stated recommendation on every question. Recommendations were given inline; the user overrode one (score render).

---

## Hero form

### Score render
| Option | Description | Selected |
|--------|-------------|----------|
| Bare number (Recommended) | Large zone-colored numeral + band word, no ring | |
| Arc gauge | Number inside a 0–100 filling, zone-colored arc | ✓ |
| Zone bar + marker | Number above a green→amber→red track with a tick | |

**User's choice:** Arc gauge — **override of the recommendation.**
**Notes:** Davide wants the instrument read; the gauge animates its fill during Phase-4 reveal (flat stroke, not a glow).

### Persona cloud in hero (now)
| Option | Description | Selected |
|--------|-------------|----------|
| Light static cloud (Recommended) | SVG/CSS dots, worst cluster coral, no Canvas/hover; full graph → P3 | ✓ |
| Full PersonaGraph now | Canvas graph + 200 dots + hover dropped straight in | |
| No cloud, text only | "57% watch · 3 audiences" line, cloud only in a drill-down | |

**User's choice:** Light static cloud (Recommended).

### Hero arrangement + mobile
| Option | Description | Selected |
|--------|-------------|----------|
| Thumb → score|cloud (Recommended) | Thumbnail top → score left/cloud right; stack on mobile (matches mock) | ✓ |
| Score centered hero | Big centered score, cloud + watch% a band below | |
| Score badge on thumb | Score overlaid on the video frame | |

**User's choice:** Thumb → score|cloud (Recommended).

### Gate (don't-post-yet) treatment
| Option | Description | Selected |
|--------|-------------|----------|
| Banner, keep score (Recommended) | "Don't post yet — [reason]" banner above the gauge; score subordinated | ✓ |
| Gate replaces score | Full no-go verdict, score hidden/tiny | |
| Red gauge + small chip | Gauge turns red + a small chip | |

**User's choice:** Banner, keep score (Recommended).
**Notes:** User asked what the gate is. Clarified: `anti_virality_gated` = a "don't post yet" flag raised on top of the score, triggered by low confidence OR a damaging retention drop pattern (`anti_virality_reason`: confidence / timeline_pattern / both). Score and go/no-go are paired, not exclusive.

---

## Driver rows

### Row form
| Option | Description | Selected |
|--------|-------------|----------|
| Bar + value (Recommended) | Label + horizontal bar (fill = 0–100 score) + value; reuse FactorBars | ✓ |
| Value chip only | Label + value chip, no bar | |
| Mini-curve + value | Sparkline per row | |

**User's choice:** Bar + value (Recommended).

### Retention's readout
| Option | Description | Selected |
|--------|-------------|----------|
| Bar=score, value=⚠time (Recommended) | Bar fills by retention score; value = drop timestamp "⚠0:08" | ✓ |
| Show score AND time | Small score number + the timestamp | |
| Time only, no bar | Retention is purely "⚠0:08" | |

**User's choice:** Bar=score, value=⚠time (Recommended).

### Bar color
| Option | Description | Selected |
|--------|-------------|----------|
| Neutral, weakest colored (Recommended) | Neutral bars; only the weakest lever takes its zone color + ⚠ | ✓ |
| All bars zone-colored | Every bar green/amber/red by its score | |
| All neutral | Only the hero carries color | |

**User's choice:** Neutral, weakest colored (Recommended).

### Row order
| Option | Description | Selected |
|--------|-------------|----------|
| Fixed funnel (Recommended) | Hook → Retention → Shareability (attention → hold → spread) | ✓ |
| Severity-sorted | Weakest lever floats to the top | |
| Fixed + focus weakest | Fixed order, weakest pre-emphasized | |

**User's choice:** Fixed funnel (Recommended).

---

## Disclosure

### Heavy drill-down mechanism (row-detail now + Phase-3 charts)
| Option | Description | Selected |
|--------|-------------|----------|
| Sheet / drawer (Recommended) | Bottom sheet mobile / side drawer desktop; the Phase-3 mount point | ✓ |
| Inline accordion | Expand the row in place in the thread | |
| Full modal | Centered overlay that dims the thread | |
| Sub-route | Navigate to /analyze/[id]/[section] | |

**User's choice:** Sheet / drawer (Recommended).

### Light in-thread disclosures ("N more fixes", "Deeper read")
| Option | Description | Selected |
|--------|-------------|----------|
| Inline expand (Recommended) | Expand in place in the thread (two-tier: light inline, heavy in sheet) | ✓ |
| Everything in the sheet | One mechanism for everything | |
| Always expanded | No collapsing at all | |

**User's choice:** Inline expand (Recommended).

### Desktop form of the drill-down
| Option | Description | Selected |
|--------|-------------|----------|
| Right-side drawer (Recommended) | Slides from the right; Reading stays visible left | ✓ |
| Centered modal | Focal dialog that dims the thread | |
| Wide bottom sheet | Mobile sheet, just wider | |

**User's choice:** Right-side drawer (Recommended).

---

## P2↔P3 seam + states

### What fills a drill-down sheet in Phase 2
| Option | Description | Selected |
|--------|-------------|----------|
| Real native content (Recommended) | Actual engine data in simple native form; P3 swaps in rich charts (same container) | ✓ |
| Stub placeholder | "Detail coming" until Phase 3 | |
| Pull rich charts in now | Mount RetentionChart/FactorBars directly (collapses P3) | |

**User's choice:** Real native content (Recommended).

### Degraded / missing engine data
| Option | Description | Selected |
|--------|-------------|----------|
| Per-block graceful (Recommended) | Honor honesty flags: analysis_unavailable → "couldn't analyze" (never the fake 0); partial_analysis → note; apollo null → degrade deeper-read | ✓ |
| Single global fallback | One "analysis incomplete" message | |
| Assume complete data | Happy path only, defer | |

**User's choice:** Per-block graceful (Recommended).

### Empty Fix First (zero fixes / no rewrites)
| Option | Description | Selected |
|--------|-------------|----------|
| Positive win state (Recommended) | "Nothing urgent to fix — this is solid"; fixes without rewrite chip when none | ✓ |
| Hide when empty | Fix First disappears | |
| Always show, blank if none | Header always, empty body | |

**User's choice:** Positive win state (Recommended).

### "No prose narration" line
| Option | Description | Selected |
|--------|-------------|----------|
| Labels + fixes only (Recommended) | Terse labels + data + actionable fix/rewrite text; no verdict sentences | ✓ |
| Allow 1 hero summary line | Also a single synthesized line under the score | |
| Pure data, no fix prose | Fixes as structured tags only | |

**User's choice:** Labels + fixes only (Recommended).

---

## Claude's Discretion
- Drill-down library (Radix/shadcn Sheet/vaul/motion) — executor.
- Open-drill-down URL behavior (shallow `?panel=` sync vs ephemeral) — planner (back-button-closes-sheet is the desired feel).
- Arc-gauge geometry/stroke/number type + reveal animation curve (Phase 4 owns motion) — executor.
- Video thumbnail source + static-vs-playable — planner.
- Component/motion libraries within the taste bar — executor.
- Exact micro-copy (band words, gate reason, empty-state line, section labels) — build time.

## Deferred Ideas
- Full PersonaGraph Canvas drill-down → Phase 3.
- Rich board visuals as drill-downs → Phase 3 (READ-09).
- Naming reconciliation (brief/roadmap/requirements prose + READ-* IDs still say "Reading") — separate prose pass.
- Shareable/deep-linked drill-down panels → possible once the sheet exists; full share-as-image/link is v2 SHARE-01.
- Offered-but-skipped gray areas (user chose "ready for context"): thumbnail static-vs-playable, hero↔rows scroll/anchor behavior, composer-as-follow-up positioning (largely Phase-5/CHAT).
- **Planner sizing note:** all board visuals are already Konva-free → Phase 3 is reskin+remount, lighter than the roadmap assumed (phase split kept intact).
