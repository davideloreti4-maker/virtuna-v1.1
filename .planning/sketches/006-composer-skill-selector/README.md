---
sketch: 006
name: composer-skill-selector
question: "What skill-selector scales to ~10 skills (creator + marketing), works native on mobile AND desktop, and shows the active SIM-1 model?"
winner: null
tags: [composer, skills, navigation, mobile, desktop, marketing, model-pill, ux-01]
---

# Sketch 006: Composer Skill Selector

## Design Question
The temporary skill-chip row (`tool-chips.tsx`) doesn't scale — v6.0's expansion (Phases 11–16) pushes the skill count to ~9: **Creator** (Explore · Ideas · Hooks · Script · Remix · Test · Chat) + **Marketing** (Offer Validation · Ad Creative). Need a selector that (1) scales without a chip row, (2) feels native on mobile *and* desktop, (3) carries the Creator/Marketing grouping (P14/P15), (4) shows the active **SIM-1 Flash/Max** model on the trigger. Decision pass — supersedes the open question in sketch 001.

## How to View
```
open .planning/sketches/006-composer-skill-selector/index.html
```

## Variants
- **A: Grouped popover** — One skill pill in the composer; click → compact anchored popover with Creator/Marketing sections, each skill row showing icon · name · one-line desc · model tag. Lightest, Claude-model-pill familiar.
- **B: Command menu (⌘K)** — Pill (or ⌘K) opens a searchable Raycast-style overlay, grouped + filterable. Scales best to 10+; power-user feel.
- **C: Adaptive popover↔sheet** — Same trigger, two native surfaces: desktop = popover (A), mobile = thumb-reachable bottom sheet with bigger touch targets. One data model, two presentations. Shown as a side-by-side desktop frame + phone frame.

## What to Look For
- Does the pill read instantly as "the skill switcher" — and is the SIM-1 Flash/Max tag legible without being noisy?
- Does the **Creator / Marketing** split feel clarifying or like over-structure at 9 skills?
- A vs B: popover (calm, creator-first) vs command-menu (fast, power-user) — which fits Numen's "one conversation" co-pilot?
- C: do the mobile bottom-sheet touch targets feel native? Is "same trigger → two surfaces" the right answer to mobile+desktop, or overkill vs just making A responsive?
- All three: does the composer feel cleaner than today's chip row, without losing the at-a-glance "what am I about to run" context?
