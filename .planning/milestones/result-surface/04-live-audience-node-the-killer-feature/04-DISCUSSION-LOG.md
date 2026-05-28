# Phase 4: Live Audience node — the killer feature - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 4-live-audience-node-the-killer-feature
**Areas discussed:** Architectural optimizations, Stacking & streaming choreography, Retention curve + markers + tap interactions, Anti-virality visual treatment, Weight override UX

---

## Architectural optimizations (pre-discussion batch — all six accepted)

User instruction: "in addition analyze if there is optimization or different approaches that are better from the carried forward information." Six callouts surfaced; user said "accept all" — all six locked as O-1 through O-6 in CONTEXT.md.

| Optimization | Override target | Selected |
|--------------|-----------------|----------|
| O-1: Konva stages Audience frame only; curve = dedicated `<canvas>`, heatmap = CSS Grid, filmstrip = `<img>` | Refines Phase 2 D-04 (Konva everywhere) | ✓ |
| O-2: Per-cell fill during stream (not row-on-complete) | Refines R1.2 row-materialize spec | ✓ |
| O-3: Pass 1 baseline → single 800ms morph to weighted curve | Refines R1.2 streaming choreography | ✓ |
| O-4: Filmstrip placeholder = coral band + `visual_event` label | Fills Phase 3 D-11 async gap | ✓ |
| O-5: Weight override = client-side recompute, no engine roundtrip | Reads Phase 3 D-13 schema better | ✓ |
| O-6: Mobile portrait heatmap = collapsed band + bottom sheet on tap | Adapts R1.2 + R3.1 mobile portrait | ✓ |

---

## Area 1 — Stacking & streaming choreography

### Question 1.1 — Desktop vertical stacking order

| Option | Description | Selected |
|--------|-------------|----------|
| Chips → Filmstrip → Curve → Heatmap | Spec-aligned R1.2 order; filmstrip-as-top-axis per Tribe v2 reference | ✓ |
| Chips → Curve → Filmstrip → Heatmap | Curve primary, filmstrip as x-axis below | |
| Chips → Curve-overlay-Filmstrip → Heatmap | Filmstrip + curve in same band (overlaid) | |
| Filmstrip → Curve → Chips → Heatmap | Visual-first, metrics-second | |

**User's choice:** Chips → Filmstrip → Curve → Heatmap (Recommended)
**Notes:** Locks D-01 in CONTEXT.md. Heatmap = collapsible drawer below curve.

### Question 1.2 — Streaming reveal order for persona rows

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed archetype hierarchy | FYP×6 → niche×2 → loyalist×1 → cross-niche×1; skeletons placed at t=0 | ✓ |
| Completion order (race-style) | Rows appear top→bottom as personas finish | |
| Hybrid: skeletons hierarchy, fill on completion | Position locked, fill timing race-based | |
| Simultaneous — single 800ms morph | Wait for all 10, animate at once | |

**User's choice:** Fixed archetype hierarchy (Recommended)
**Notes:** Locks D-05. Predictable rhythm + presentation-friendly determinism.

### Question 1.3 — Cell fill animation pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Left-to-right wave, 180ms | Cells fill sequentially L→R, ~18ms per cell stagger, marker drops at last cell | ✓ |
| Simultaneous burst, 120ms fade-in | All cells fade in together, marker drops same moment | |
| Center-out reveal, 200ms | Cells expand outward from segment containing swipe_predicted_at | |
| No animation — instant on complete | Row pops in at full saturation when persona finishes | |

**User's choice:** Left-to-right wave, 180ms (Recommended)
**Notes:** Locks D-06. Reads as "the persona watched through the video."

### Question 1.4 — Heatmap "underlay" interpretation

| Option | Description | Selected |
|--------|-------------|----------|
| Drawer below curve, closed by default | Tap "Show personas ▾" affordance → grid expands inline (desktop) / bottom sheet (mobile) | ✓ |
| Literal underlay — always behind curve, low opacity | Heatmap ambient texture at 25% opacity behind curve | |
| Aggregate intensity band — always visible, no rows by default | Single coral band under curve; tap breaks into 10 rows | |
| Open by default, full grid | 10 rows always visible | |

**User's choice:** Drawer below curve, closed by default (Recommended)
**Notes:** Locks D-03. Literal-underlay interpretation rejected — readability cost too high.

---

## Area 2 — Retention curve + markers + tap interactions

### Question 2.1 — Retention curve rendering style

| Option | Description | Selected |
|--------|-------------|----------|
| Coral line + soft gradient fill under | 2px coral bezier, gradient coral/15→transparent, hook zone warm band (coral/8), catmull-rom α=0.5 smoothing | ✓ |
| Coral line only — no fill, no warm band | Minimalist; hook zone marked only with dashed gridline at 3s | |
| Dual: weighted curve + Pass 1 baseline ghost | Add dotted Pass 1 baseline line for contrast | |
| Stepped (no smoothing) — segment-honest | Flat step per segment, vertical risers | |

**User's choice:** Coral line + soft gradient fill under (Recommended)
**Notes:** Locks D-08 + D-09. TikTok-Studio-familiar style per R1.2.

### Question 2.2 — Dropoff marker design

| Option | Description | Selected |
|--------|-------------|----------|
| Coral dots with archetype-tier ring | 8px solid coral, ring color encodes archetype | ✓ |
| Avatar chips (initials in circle) | 20px circles with persona initials | |
| Coral pins (teardrop tags) | Inverted teardrop pins pointing down at curve | |
| Tick marks on curve baseline (no dots) | Vertical 4px ticks on bottom axis | |

**User's choice:** Coral dots with archetype-tier ring (Recommended)
**Notes:** Locks D-11. Overlap clustering: ≥3 within 12px or ≥2 within 6px → single dot + superscript counter (D-12).

### Question 2.3 — Tap interaction model

| Option | Description | Selected |
|--------|-------------|----------|
| Compact popover + drill-down to bottom sheet/inspector | Glance via popover (cell/marker/curve), deep read via bottom sheet (mobile) / inspector (desktop) | ✓ |
| Single bottom sheet for everything | Every tap opens same bottom sheet at relevant section | |
| Inline expand only (no popovers) | Tap row label expands row in-place to full width | |
| Popover-only (no deep view) | Sticky popover with full Pass 2 reasoning inline | |

**User's choice:** Compact popover + drill-down to bottom sheet/inspector (Recommended)
**Notes:** Locks D-13. Plan 4.9 inline row-expand becomes Claude's Discretion — researcher decides if it's redundant given inspector route (D-14).

---

## Area 3 — Anti-virality visual treatment

### Question 3.1 — Anti-virality treatment scope

| Option | Description | Selected |
|--------|-------------|----------|
| Quiet: orange band on curve + segment markers tagged | Coral→orange gradient in dropoff range only; ⚠ tags below filmstrip; heatmap cells unchanged | ✓ |
| Medium: orange band + heatmap cells in dropoff range tinted | Adds orange tinting to affected heatmap cells | |
| Loud: full orange ripple — curve + cells + chip + row labels | Maximum visibility; risks alarmism + red/green readability concerns | |
| Indirect: Audience stays clean, treatment lives in Verdict only | Audience full coral; orange only in Verdict | |

**User's choice:** Quiet: orange band on curve + segment markers tagged (Recommended)
**Notes:** Locks D-15. "Constructive not punitive" per R1.3. Heatmap stays coral.

### Question 3.2 — Rework guidance anchoring

| Option | Description | Selected |
|--------|-------------|----------|
| Inline annotation below filmstrip + Verdict-side full list | Fix-summary chips below filmstrip at affected segments + full top-3 list in Verdict | ✓ |
| Audience stays brief; full fixes only in Actions/Verdict | Only orange band + ⚠ tags in Audience; tap ⚠ jumps to Verdict | |
| Side rail callout pinned to Audience right edge | Vertical callout with leader lines to segments | |
| Tooltip-only on segment marker hover | Fixes appear only on hover/tap of ⚠ marker | |

**User's choice:** Inline annotation below filmstrip + Verdict-side full list (Recommended)
**Notes:** Locks D-16. Audience = "where + brief"; Verdict = "what + why" (cross-group ripple division per Phase 2 D-19).

---

## Area 4 — Weight override UX (plan 4.11)

### Question 4.1 — Override UI form

| Option | Description | Selected |
|--------|-------------|----------|
| Preset chips + "Custom" opens slider panel | Default / Established / Niche-heavy / New creator presets + Custom with 4 sliders | ✓ |
| 4 sliders, no presets | Single drawer with 4 sliders only | |
| Numeric input fields | 4 numeric inputs with manual sum validation | |
| Presets only — no custom | Named presets, no sliders | |

**User's choice:** Preset chips + "Custom" opens slider panel (Recommended)
**Notes:** Locks D-18. Preset starting values are starting points — researcher confirms exact mixes during planning.

### Question 4.2 — Override surface placement

| Option | Description | Selected |
|--------|-------------|----------|
| Tap weights badge — opens override drawer | R1.2 transparency badge becomes the affordance + command-bar chip routes to same drawer | ✓ |
| Command-bar chip-action only | "Re-weight audience" chip in command bar; badge read-only | |
| Both — badge tap + command-bar chip | Dual entry points to same drawer | |
| Inline in Audience node body (no drawer) | Preset chips permanently visible inside Audience body | |

**User's choice:** Tap weights badge — opens override drawer (Recommended)
**Notes:** Locks D-19. Single mental model: badge that SHOWS = badge that CHANGES. Command-bar chip still routes here (per Phase 2 D-13).

### Question 4.3 — Override persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Per-analysis sticky + "Save as default" toggle | Override applies to current analysis; opt-in toggle propagates to creator default | ✓ |
| Session-only (no DB persist) | URL/localStorage only; no DB writes | |
| Per-analysis only, no "save as default" toggle | Per-analysis DB write; Workspace milestone owns creator default later | |
| Auto-save to creator default immediately | First non-default override permanently changes user's default | |

**User's choice:** Per-analysis sticky + "Save as default" toggle (Recommended)
**Notes:** Locks D-21. No surprises — opt-in only. New `creator_persona_weights` table migration may ship in Phase 4 (researcher decides per D-22).

---

## Claude's Discretion

- Konva ↔ DOM overlay composition specifics for the Audience node
- Bezier interpolation library (hand-rolled catmull-rom vs `d3-shape`)
- Cluster-collapse exact pixel thresholds (starting: ≥3 within 12px / ≥2 within 6px)
- Per-persona row inline expand fate (plan 4.9) — keep lighter view OR fold into inspector
- Exact "Established / Niche-heavy / New creator" preset weight mixes
- Auto-renormalize algorithm (proportional vs absolute-locked-on-drag)
- Color-blind pattern variant for heatmap (diagonal stripes vs cross-hatch vs dot density)
- Reduced-motion behavior specifics for choreography
- Perf-tier degradation specifics for Audience node (Low tier cuts morph; Medium halves wave duration)

## Deferred Ideas

- Heatmap layer toggle (Attention / Emotion / Engagement / Skip-probability) — v1.5
- Persona avatars vs abstract coral dots — Workspace milestone
- Free-form conversational co-pilot — M2-II / M2-III
- Per-creator weight override UI at workspace level — Workspace milestone
- Outcome feedback loop (predicted vs actual overlay) — M2-III
- Per-segment audio waveform under filmstrip — M3 / Tribe v2
- Multi-video boards comparison — Workspace milestone
- Real-time collaboration on Audience node — Workspace milestone
- Synchronized curve+heatmap pinch-zoom scrubbing — Phase 8 if needed
- Counterfactual-anchored bi-directional cell highlighting — future
- Per-marker hover preview (desktop) — Phase 8 if cycles available
- Custom personas dropped onto Audience group — Workspace milestone
- Audience-snapshot-only PNG export — M2-II
