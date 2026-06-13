# Phase 1: Foundation & Shell - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-13
**Phase:** 1-Foundation & Shell
**Areas discussed:** Flat-warm look, Sidebar scope, Desktop shell, Home & input

> Note: Davide requested every question lead with Claude's thought-through recommendation (recommended option first). Applied throughout.

---

## Flat-warm look (THEME)

| Question | Selected |
|----------|----------|
| Base hue (warm gray / brown-paper / barely-warm) | **Pivoted** — see below |
| Serif personality | Editorial / literary (Newsreader, Source Serif 4) ✓ |
| Coral maturation | Toward terracotta/clay (~#d97757) ✓ |
| Elevation without effects | Tone-step + hairline borders ✓ |

**Base-hue pivot:** Claude's first swatch offered warm-gray / brown / barely-warm. Davide: *"I don't like the warmth at all… warmth just don't feels right, like the today even more"* and shared the **Claude.ai dark UI** as the reference he likes. Diagnosis: he wants **neutral charcoal surfaces** (softer/lifted off `#07080a`), with warmth coming from **cream text + coral accent**, not brown backgrounds. Second swatch (`.planning/sketches/01-base-hue/swatch.html`) offered Frame A (softer ~#262624) vs Frame B (deeper ~#1b1b1a) — Davide chose **Frame A**.

**Notes:** This refines the brief's "warm-neutral hue." Exact hex/serif-face/coral values deferred to build + the THEME-06 human-UAT gate.

---

## Sidebar scope (SHELL-05, §2.8)

| Question | Selected |
|----------|----------|
| Composition | **Lean & clean** (New Simulation + Simulations list + Settings/Account) ✓ |
| Pinned + Projects stubs | **Cut both for v1** ✓ |
| @handle selector | **Keep in sidebar** (creator context) ✓ |
| Naming | **Pivoted** → product noun debate (see below) |

**Naming pivot:** On "New Reading / Readings", Davide: *"product noun is either analysis or simulation or test. reading sounds shit."* Claude flagged this as milestone-level (renames Phase 2, brief, all copy) and presented Simulation / Test / Analysis with trade-offs. Davide chose **Simulation** (names the audience-simulation moat; premium; pairs with "Numen"). Caveat surfaced: today's score is Apollo-reasoning-led, so "Simulation" is slightly aspirational positioning.

---

## Desktop shell (SHELL-05, SHELL-07)

| Question | Selected |
|----------|----------|
| Desktop sidebar behavior | **Persistent + collapsible** (⌘\, content shifts) ✓ |
| Mobile pattern | **Slide-in drawer** (not bottom sheet) ✓ |
| Default state | **Expanded, then remembered** (sidebar-store) ✓ |
| Content width | **Centered readable column ~760px** ✓ |

**Notes:** Today's sidebar is overlay-only on all viewports (collapse code dead at `Sidebar.tsx:358`). Persistent-desktop revives it + adds a main content offset. Resolves brief §7's drawer-vs-bottom-sheet open item → drawer.

---

## Home & input (SHELL-01..04, DEMO-01)

| Question | Selected |
|----------|----------|
| Greeting style | Personalized question — **"Ready to simulate your audience, [Name]?"** (Davide's wording) ✓ |
| URL auto-detect scope | **TikTok only** ✓ |
| Route model | **New home = landing; submit → new permalink** (Claude model); /analyze dormant ✓ |
| First-run demo (DEMO-01) | **Keep, detail in P5** ✓ |
| Empty-home starter chips | **Composer only, no chips** ✓ |

**Greeting iteration:** Davide rejected "What are we simulating / Ready to simulate" as clunky, then gave the direction *"something like, ready to simulate your audience"* — the "your audience" object made it work.

**Demo + chips:** Davide questioned the demo (*"what's demo about? doesn't make sense"*) and the chips (*"what are the chips you're talking about?"*). Claude explained the starter chips (quick-actions under the composer, à la Claude's Write/Learn/Code row) and the demo's first-run "show the magic" purpose. Davide kept the demo for P5 but chose a **composer-only empty home with no chips** (Paste/Upload chips are redundant with the composer's own affordances) — an intentional override of the brief's locked 3-chip spec.

---

## Claude's Discretion

- Exact route paths (new home + Simulation permalink) — planner.
- Component/motion library choices within the flat-warm + calm-motion taste bar — executor.
- Final token values / serif typeface / coral hex — pending the THEME-06 UAT gate.
- Greeting micro-copy final wording.

## Deferred Ideas

- Pinning Simulations (Pinned stub cut; pinning = future scope).
- Projects feature ("Soon" placeholder cut; future).
- Instagram URL analysis (v1 is TikTok-only).
- **Brief reconciliation follow-up:** propagate "Reading" → "Simulation", the neutral-charcoal base-hue refinement, and the composer-only home back into NUMEN-REWORK-BRIEF.md / ROADMAP.md / REQUIREMENTS.md prose (separate task).
