# Phase 1: Foundation & Shell - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 1-Foundation & Shell
**Areas discussed:** Route & old-code cleanup, Placeholder-slot design, Motion foundation, Header & footer chrome (+ design-system reframe, product naming, doc reconciliation)

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Route & old-code cleanup | New `/` replaces old clone; html/metadata bug; sibling routes | ✓ |
| Placeholder-slot design | Look + API + swap mechanism (FOUND-03) | ✓ |
| Motion foundation | One lib, global reduced-motion, primitives (FOUND-04) | ✓ |
| Header & footer chrome | Reuse vs rebuild, nav, mobile, footer richness (NAV-01/02/03) | ✓ |

**User's choice:** All four + "show me your thought-through recommended answer on all topics."
**Notes:** User delegated the thinking — asked for reasoned recommendations rather than a turn-by-turn interview. I presented a full recommendation per area, then sought confirmation.

---

## Lock vs adjust (after recommendations presented)

| Option | Description | Selected |
|--------|-------------|----------|
| Lock all as recommended | Accept every recommendation, incl. reuse+restyle existing header | |
| Lock, but delete old code now | Accept all except: delete old code for clean slate | |
| Adjust specific items | User flags changes | ✓ |

**User's choice:** "adjustments to make, dont reuse old stuff, in virtuna-numen-rework we have the new design system"
**Notes:** Two decisive adjustments that reframed the phase — (1) do NOT reuse old code (the old header/footer/landing are built on the now-killed glass+glow aesthetic); (2) adopt the **flat-warm** design system from the `~/virtuna-numen-rework` worktree. I then studied that system (`globals.css` flat-warm `@theme` + `01-CONTEXT.md` D-01..D-08) and re-presented adjusted recommendations.

## Footer richness

| Option | Description | Selected |
|--------|-------------|----------|
| Compact 2–3 column | Brand+tagline / product anchors / legal+social placeholders | ✓ |
| Ultra-minimal one-line | Logo + copyright + social icons | |
| Richer multi-column | Linear-style fuller footer | |

**User's choice:** Compact 2–3 column.

---

## Old-code disposition (post-reframe)

| Option | Description | Selected |
|--------|-------------|----------|
| Delete now — clean slate | Delete old `landing/*` + dead test routes in Phase 1 | ✓ |
| Orphan now, delete in Phase 5 | Stop importing; bulk-delete later | |

**User's choice:** Delete now — clean slate.
**Notes:** Header/footer rewritten fresh in place either way; this resolves the dead `landing/*` sections + unused test routes (viz-test, viral-score-test, board-preview, primitives-showcase). Sibling-route imports get fixed as needed.

## Product noun

| Option | Description | Selected |
|--------|-------------|----------|
| Simulation | Align landing with the product app + the moat | ✓ |
| Keep 'the reading' | Match current landing-v2 docs | |
| Decide in Phase 2/3 | Defer to hero/story copy | |

**User's choice:** Simulation.
**Notes:** Matches numen-rework D-09 (Davide vetoed "Reading"). Ripples to Phase 2 hero + Phase 3 showcase ("The Reading" → "The Simulation"). REQUIREMENTS/ROADMAP "reading" prose to be reconciled when Phases 2–3 are discussed.

## Doc reconciliation

| Option | Description | Selected |
|--------|-------------|----------|
| Update FOUND-02 + brief now | Edit REQUIREMENTS/ROADMAP/VISION brand wording to flat-warm | ✓ |
| Capture in CONTEXT only | Leave docs; override lives in CONTEXT | |

**User's choice:** Update FOUND-02 + brief now.
**Notes:** Done — edited REQUIREMENTS.md FOUND-02, ROADMAP.md Phase 1 SC#1 + plan 01-01, LANDING-VISION.md §6, committed alongside this CONTEXT.

---

## Claude's Discretion
- Final hex ramp / serif weight / coral hue — follow numen-rework's UAT-locked values.
- Component/motion library choices within the flat-warm + calm-motion bar — executor.
- Exact anchor-link set, section `id`s, scroll-skeleton stub markup — planner.
- Exact `/` page metadata copy — planner.

## Deferred Ideas
- Placeholder asset-registry / one-file swap manifest (the `src` prop suffices for v1).
- Removing the redundant `framer-motion` dep (do once `motion/*` wrappers migrate).
- Full reskin of sibling marketing routes (`/pricing`, `/showcase`) — later/separate.
- Standalone routes (/pricing, /about, /manifesto) — v2 EXPND-01.
- Real-asset integration pass — v2 EXPND-02.
- New abstract UAT gate for the theme — unnecessary (flat-warm already UAT-locked).
