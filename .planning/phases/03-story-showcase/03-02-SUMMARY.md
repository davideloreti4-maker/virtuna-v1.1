---
phase: 03-story-showcase
plan: 02
subsystem: marketing-landing
tags: [story, showcase, rsc, placeholder, flat-warm, STORY-02]
requires:
  - "03-00 (RED STORY-02 Nyquist gate: simulation-showcase.test.tsx)"
  - "03-01 (page.tsx #how-it-works filled; named import shape)"
  - "src/components/marketing/placeholder.tsx (the swappable product-visual slot)"
  - "src/components/marketing/hero/hero.tsx (device-chrome treatment, copied not imported)"
provides:
  - "SimulationShowcase RSC — STORY-02 'The Simulation' output showcase"
  - "barrel export of SimulationShowcase from @/components/marketing"
  - "#the-simulation stub filled in place in (marketing)/page.tsx"
affects:
  - "src/app/(marketing)/page.tsx (#the-simulation section now renders real content)"
tech-stack:
  added: []
  patterns:
    - "Pure RSC marketing section + one client island (FadeInUp) — keeps / static ○"
    - "Device-frame chrome copied from hero (browser window + dark layered drop shadow + warm seat), Placeholder gets rounded-none border-0 so the frame owns the chrome"
    - "Named outputs as a <dl> of label+detail chips; copy↔test token discipline"
key-files:
  created:
    - "src/components/marketing/story/simulation-showcase.tsx"
  modified:
    - "src/components/marketing/index.ts"
    - "src/app/(marketing)/page.tsx"
decisions:
  - "The LOCKED <h2>'The Simulation' is the single /simulat/i text node; all other copy avoids 'simulat' so the 03-00 getByText(/simulat/i) resolves unambiguously — Placeholder label = 'Your prediction', output-1 label = 'Audience reaction'"
  - "Output details reworded to avoid duplicate /audience/i and /retention/i nodes (getByText is single-match)"
  - "Normalized the #the-simulation <section> to single-line (matches how-it-works/pricing/faq) — class values (LOCKED rhythm) unchanged"
metrics:
  duration: "~12min"
  completed: "2026-06-15"
  tasks: 2
  files: 3
---

# Phase 3 Plan 02: The Simulation Output Showcase Summary

**One-liner:** Built the STORY-02 `SimulationShowcase` RSC — a flat-warm, device-framed `<Placeholder>` depicting the SHAPE of a Numen Simulation with the three named outputs (audience reaction · watch-through % · Hook · Retention/where-they-drop · Shareability) — and filled the `#the-simulation` stub in place, turning the 03-00 Nyquist gate GREEN (7/7).

## What Was Built

### Task 1 — `SimulationShowcase` RSC + barrel export (commit `c7f73ee0`)
- New pure Server Component `src/components/marketing/story/simulation-showcase.tsx` (no `"use client"`; only `FadeInUp` is a client island, so `/` stays statically prerendered `○`).
- Composition (D-D Layout A):
  1. Sans `<h2>` reading EXACTLY **"The Simulation"** (LOCKED — matches the `#the-simulation` anchor) + a one-line cream-secondary subhead.
  2. ONE prominent flat-warm device-framed `<Placeholder variant="image" aspect="16/10">` nested inside the hero's browser-window chrome (overflow-hidden window + slim bar with 3 dots + a `numen.app` address pill + the layered DARK drop shadow + the faint warm "seat" radial, both copied verbatim and commented as flat-warm-legal / "NOT a glow"). The nested Placeholder gets `rounded-none border-0 bg-surface` so the frame owns the chrome. Swappable for a real screenshot via the one `src` prop later (FOUND-03).
  3. The three named outputs as a responsive `<dl>` of label+detail chips (stacks on mobile, 3-up on `sm`).
- No banned imports (`board/` · `reading/` · `viral-results` — the canonical reading IA was a shape reference only). No glass/glow/backdrop-blur, no `#FF7F50`, no hardcoded hex (except the two commented flat-warm-legal rgba values). Coral kept precious (not used here, A6).
- Barrel: `export { SimulationShowcase } from "./story/simulation-showcase";` added to `src/components/marketing/index.ts`.

### Task 2 — fill the `#the-simulation` stub (commit `ece5a27f`)
- Added `SimulationShowcase` to the `@/components/marketing` named import in `src/app/(marketing)/page.tsx`.
- Replaced the muted stub `<h2 ...text-foreground-muted>The Simulation</h2>` with `<SimulationShowcase />` inside the EXISTING `#the-simulation` section. The LOCKED rhythm (`border-t border-border px-6 py-20` + inner `mx-auto max-w-5xl`) is preserved exactly; hero, how-it-works, pricing, and faq sections are untouched.

## Verification

- `npx vitest run src/components/marketing/story/__tests__/simulation-showcase.test.tsx` → **7/7 GREEN** (STORY-02 satisfied).
- `npx vitest run src/components/marketing/story/` → **13/13 GREEN** (how-it-works + simulation-showcase).
- `npm run build` → **exit 0**, `/` is **`○` (Static)** in the route table.
- ESLint on all 3 touched files → **No issues found**.
- Acceptance greps: no `"use client"`; barrel exports `SimulationShowcase`; no banned imports; no glass/glow; `<SimulationShowcase>` rendered inside `<section id="the-simulation" className="border-t border-border px-6 py-20">`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] copy↔test token collisions made `getByText` ambiguous**
- **Found during:** Task 1 (GREEN turn — tests went 5/7 then 6/7 before passing).
- **Issue:** The 03-00 test uses `getByText(/audience/i)`, `/simulat/i`, `/retention/i` (single-match queries). My first draft repeated those tokens across the heading, subhead, output labels, the Placeholder `label`, AND the output details — producing 2–3 matching text nodes per query.
- **Fix:** Made the LOCKED `<h2>"The Simulation"` the sole `/simulat/i` node (Placeholder label → "Your prediction", output-1 label → "Audience reaction", subhead no longer says "Simulation"); reworded output details to drop the duplicate "audience"/"Retention" tokens while keeping "drop" exactly once.
- **Files modified:** `src/components/marketing/story/simulation-showcase.tsx`
- **Commit:** `c7f73ee0`

**2. [Rule 3 — Blocking] JSDoc string tripped the banned-import acceptance grep**
- **Found during:** Task 1 acceptance check.
- **Issue:** `grep -Eq 'board/|reading/|viral-results'` matched my own doc comment that listed the banned paths, producing a false "banned import" positive.
- **Fix:** Reworded the comment to describe the retired trees in prose without the literal `board/` · `reading/` · `viral-results` tokens; the grep is now clean.
- **Commit:** `c7f73ee0`

**3. [Rule 3 — Blocking] `#the-simulation` `<section>` was multi-line; acceptance grep expects single-line**
- **Found during:** Task 2 verification.
- **Issue:** The original 03-00 stub formatted the `#the-simulation` `<section>` across three lines, so `grep -q 'id="the-simulation" className="border-t border-border px-6 py-20"'` (single-line) failed even though the class values were correct.
- **Fix:** Collapsed the tag to single-line, matching the canonical form already used by `#how-it-works`/`#pricing`/`#faq`. The LOCKED class values (id/border/padding/measure) are unchanged — formatting normalization only, no rhythm change.
- **Files modified:** `src/app/(marketing)/page.tsx`
- **Commit:** `ece5a27f`

## Known Stubs

The device-framed `<Placeholder label="Your prediction" />` is the intended, swappable product-visual slot (FOUND-03) — a real desktop screenshot drops in later via the single `src` prop with zero layout shift. This is the milestone's marketing-surface design (every product visual is a labelled placeholder), not an incomplete stub.

## Out-of-Scope Failing Tests (pre-existing 03-03 RED gates — NOT introduced here)

The full suite shows 2 failing test files, both Wave-0 RED gates seeded in 03-00 for STORY-03 (built in 03-03), and confirmed out of scope:
- `src/components/marketing/story/__tests__/feature-blocks.test.tsx` — module-not-found (`feature-blocks.tsx` is built in 03-03).
- `src/components/layout/__tests__/footer.test.tsx > links to the nav anchor #features` — the footer `#features` anchor is wired in 03-03.

Full suite otherwise: **1962 passed**, 26 skipped, 1 failed (the footer #features assertion above).

## Self-Check: PASSED

All 3 key files exist on disk and all 3 commits (c7f73ee0, ece5a27f, 834dea0f) are present in git history.
