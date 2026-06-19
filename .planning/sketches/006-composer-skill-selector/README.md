---
sketch: 006
name: composer-skill-selector
question: "What skill-selector scales to ~10 skills (creator + marketing), works native on mobile AND desktop, and shows the active SIM-1 model?"
winner: "1 — Minimal · context surfaced"
tags: [composer, skills, navigation, mobile, desktop, marketing, model-pill, ux-01]
---

# Sketch 006: Composer Skill Selector

## Design Question
The temporary skill-chip row (`tool-chips.tsx`) doesn't scale — v6.0's expansion (Phases 11–16) pushes the skill count to ~9: **Creator** (Explore · Ideas · Hooks · Script · Remix · Test · Chat) + **Marketing** (Offer Validation · Ad Creative). Need a selector that (1) scales without a chip row, (2) feels native on mobile *and* desktop, (3) carries the Creator/Marketing grouping (P14/P15), (4) shows the active **SIM-1 Flash/Max** model on the trigger. Decision pass — supersedes the open question in sketch 001.

## How to View
```
open .planning/sketches/006-composer-skill-selector/index.html
```

## Direction (locked after round 2)
Flat-warm **THEME-06** (warm charcoal `#262624` / composer `#1e1d1b`, cream `#ece7de`, **terracotta** stele `#d97757`, Newsreader serif greeting, **no glass/glow**). **Premium line-icon SVGs — no emoji.** **Popover everywhere** (cleaner than a bottom sheet on mobile too). Theme: `../themes/flatwarm.css` (separate from the old Raycast `default.css`).

The composer carries the **full decided control set**: `+` upload/attach (the SIM-1 Max Test path) · **skill** selector (grouped Creator/Marketing, MAX badge where the video model fires) · **audience** selector · **intent** selector (grow⇄sell) · right-side **SIM-1 Flash/Max** indicator (auto-set by skill, overridable) · mic · send. Type `/` in the field for fast skill entry.

## Variants (round 2 — control-bar density)
- **A: Full control bar** — `+` · Skill · Audience · Intent on the left, SIM-1 model · mic · send on the right. All controls always visible/labeled. Most legible "what am I about to run"; busier.
- **B: Minimal + slash** — Claude-clean bar (`+` · Skill left, model · send right); audience + intent fold into the skill popover's CONTEXT header; `/` drives skill entry. Calmest; one tap deeper for audience/intent.

## What to Look For
- Premium + on-platform now? (serif stele greeting, terracotta accent, matte — matches the live app)
- A vs B: are always-on audience/intent chips worth the density, or is B's folded CONTEXT header cleaner?
- Does the right-side **SIM-1 Flash/Max** indicator read clearly as "which engine fires," with the MAX badge legible?
- `/` slash entry + grouped Creator/Marketing popover — fast enough to retire the chip row?
