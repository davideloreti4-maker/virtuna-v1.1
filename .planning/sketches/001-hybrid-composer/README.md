---
sketch: 001
name: hybrid-composer
question: "How should the skill selector work when the chip row doesn't scale?"
winner: null
tags: [composer, skills, navigation, mobile, desktop]
---

# Sketch 001: Hybrid Composer

## Design Question
Replace the chip row (Test / Idea / Hooks / Chat) with a pattern that works on mobile, scales to 10+ skills, and fits the Raycast aesthetic.

## How to View
```
open .planning/sketches/001-hybrid-composer/index.html
```

## Variants
- **A: Pill → Dropdown** — Single mode pill in composer header; click opens a compact inline dropdown with all skills + platform selector inside. Desktop-first.
- **B: Pill → Bottom Sheet (mobile)** — Same pill but shown inside a mobile device frame. Tap opens a native-feeling bottom sheet with full-width skill cards and platform selector.
- **C: Pill → Command Palette** — Pill opens a Raycast-style ⌘K overlay. Searchable, keyboard-navigable. Power-user mode.

## What to Look For
- Does the pill feel immediately clear as a "mode selector"?
- Variant A vs C: dropdown feels lighter; palette feels more powerful — which fits Numen's creator workflow better?
- Variant B: do the touch targets feel right? Does platform inside the sheet feel natural?
- All three: does removing the chip row make the composer feel cleaner or missing context?
