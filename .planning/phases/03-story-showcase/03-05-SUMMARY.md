---
phase: 03-story-showcase
plan: 05
subsystem: marketing-story-sections
tags: [skeletons, gap-closure, story-showcase, rsc, craft, wr-04, gap-1, gap-2, gap-3]
gap_closure: true
requires:
  - "src/components/marketing/story/skeletons (03-04 barrel: ScoreGaugeSkeleton, AudienceCloudSkeleton, DriverRowsSkeleton, BrowserChrome, PhoneChrome)"
  - "src/app/globals.css flat-warm tokens (bg-surface / bg-surface-elevated, border-border, text-foreground-*, --radius-lg)"
  - "src/components/motion (FadeInUp, StaggerReveal, StaggerRevealItem) self-gated reduced-motion islands"
provides:
  - "SimulationShowcase device frame filled with the gauge -> cloud+watch% -> driver-rows skeleton, height-capped at max-h-[460px] (no more ~640px void)"
  - "HowItWorks three step skeletons (PhoneChrome+URL-row / AudienceCloudSkeleton / ScoreGaugeSkeleton) in data-step-visual aspect-[16/10] boxes"
  - "FeatureBlock wider-shorter (aspect-[16/9] max-h-[300px]) top-aligned framed-skeleton row; denser gap-12 md:gap-16 row rhythm"
  - "Three story tests gating the new skeleton structure; simulation-showcase queries de-brittled (WR-04) via within(dl)+getAllByText"
affects:
  - "03-06 owns page-level rhythm/whitespace (GAP-3 page-level) — this plan only touched the section components, not page.tsx"
tech-stack:
  added: []
  patterns:
    - "Consume 03-04 static-SVG skeleton primitives as section set-dressing inside existing pure-RSC story sections (no data, no engine, no client leak)"
    - "Stable count hooks (data-step-visual / data-feature-visual) replace the Placeholder data-variant hook now that skeletons carry no data-variant; aspect-* wrapper classes preserve the no-CLS lock"
    - "WR-04 de-brittling: scope plausibly-multi-match output tokens to the outputs <dl> via within(dl)+getAllByText(...).length>=1 rather than strict single-match getByText"
key-files:
  created: []
  modified:
    - src/components/marketing/story/simulation-showcase.tsx
    - src/components/marketing/story/how-it-works.tsx
    - src/components/marketing/story/feature-block.tsx
    - src/components/marketing/story/feature-blocks.tsx
    - src/components/marketing/story/__tests__/simulation-showcase.test.tsx
    - src/components/marketing/story/__tests__/how-it-works.test.tsx
    - src/components/marketing/story/__tests__/feature-blocks.test.tsx
decisions:
  - "Reused the EXISTING inline browser chrome in simulation-showcase (not the 03-04 BrowserChrome wrapper) to avoid a duplicate numen.app pill; the plan permitted either"
  - "Filled-frame internal layout = ScoreGaugeSkeleton full-width on top, then AudienceCloudSkeleton + DriverRowsSkeleton two-up on md, stacked on mobile; window body capped max-h-[460px] (GAP-2)"
  - "WR-04 closed by scoping the five output-token assertions to the outputs <dl> via within(dl)+getAllByText — the skeleton now renders watch-through/Hook/Retention/drop/Shareability too, so strict getByText would be multi-match"
  - "Step/feature visual count hooks switched from data-variant (Placeholder) to data-step-visual / data-feature-visual since the 03-04 skeletons carry no data-variant; aspect-* wrapper class preserves no-CLS"
  - "<h2> 'The Simulation' kept as the SOLE rendered /simulat/i node — skeleton labels/captions carry no 'simulat*'; how-it-works step-3 'Get your Simulation' stays the single /simulat/i match there"
metrics:
  duration: ~10min
  completed: 2026-06-15
  tasks: 4
  files: 7
---

# Phase 3 Plan 05: Apply Product Skeletons to the Story Sections Summary

Applied the 03-04 product-skeleton primitives to the three story sections so the placeholders read as intentional product skeletons (GAP-1), the Simulation device frame stops being a ~640px empty void (GAP-2), and the feature blocks read paired-not-stranded (GAP-3 component-level) — plus folded in the SimulationShowcase docblock fix (IN-01) and the brittle-query fix (WR-04), and extended the three story tests to gate the new skeleton structure. All four section files stay pure RSC; `/` stays statically prerendered (`○`).

## What Was Built

### Task 1 — Fill the Simulation device frame + cap height (GAP-2, IN-01) — `46926db1`
- Replaced the nested empty `<Placeholder variant="image" aspect="16/10" label="Your prediction" />` (the ~640px void) inside the browser window with the assembled 03-04 skeletons: `ScoreGaugeSkeleton` full-width on top, then `AudienceCloudSkeleton` + `DriverRowsSkeleton` two-up on `md` / stacked on mobile, in a calm flat-warm `grid gap-6 p-6 md:p-8` body.
- **Height-capped** the window body at `max-h-[460px]` (with `overflow-hidden`) so the frame reads as a compact product window, not a tall empty rectangle (GAP-2).
- Reused the EXISTING inline browser chrome (slim bar + 3 dots + `numen.app` pill + layered dark drop shadow + warm seat) rather than wrapping in the 03-04 `BrowserChrome` — avoids a duplicate `numen.app` pill (the plan permitted either).
- IN-01: aligned the file docblock to the THREE rendered output chips (the third = combined "Hook · Retention · Shareability"), not five.
- Kept the section pure RSC (only `FadeInUp` is the client leaf) and the LOCKED `<h2>` "The Simulation" as the SOLE rendered `/simulat/i` node — skeleton text carries no "simulat*".

### Task 2 — Three how-it-works step skeletons (GAP-1) — `613d3ab8`
- Replaced each step's empty `<Placeholder>` with a section-appropriate static skeleton:
  - Step 01 "Paste a TikTok link" → a small `PhoneChrome` containing a faux URL-input row (input box + two muted lines).
  - Step 02 "The audience reacts" → `AudienceCloudSkeleton`.
  - Step 03 "Get your Simulation" → `ScoreGaugeSkeleton` (the prediction shape).
- Each step visual now sits in a `data-step-visual` wrapper that is an `aspect-[16/10]` flat-warm box (no-CLS preserved; the stable count hook the 03-00 gate uses, since the 03-04 skeletons carry no `data-variant`).
- Kept pure RSC (only `StaggerReveal`/`StaggerRevealItem` client leaf), the step-3 "Get your Simulation" `/simulat/i` node, and the `reading` noun lock (grep-confirmed absent).

### Task 3 — Feature-block craft (GAP-3 component-level) — `ea245382`
- `feature-block.tsx`: grid `items-center` → `items-start` (copy top-aligns with the visual, never stranded); replaced the tall `aspect="16/10"` empty Placeholder with an intentional 03-04 skeleton framed in `BrowserChrome` at a wider-shorter `aspect-[16/9]` box capped `max-h-[300px]`; added the `data-feature-visual` count hook; kept the `md:order-*` flip on the visual column. Now takes a `visual: React.ReactNode` prop.
- `feature-blocks.tsx`: passes a relevant skeleton per feature (gauge / driver-rows / cloud / driver-rows); tightened inter-row rhythm `gap-16 md:gap-24` → `gap-12 md:gap-16` so the rows feel connected (GAP-3).
- Both files stay pure RSC, no-CLS preserved, coral kept precious (only the single inherited skeleton hint).

### Task 4 — Extend story tests + de-brittle queries (WR-04) — `9d875b51`
- `simulation-showcase.test.tsx`: scoped the five output-token assertions (audience / watch-through / Hook / Retention+drop / Shareability) to the outputs `<dl>` via `within(dl).getAllByText(...).length >= 1` — WR-04 closed, because the filled frame now also renders those tokens. Kept the LOCKED `<h2>` "The Simulation" verbatim + a strict single-match `/simulat/i` guard. Added a GAP-2 structural gate: `>= 1` arc `<circle>` (stroke-dasharray) + `>= 6` `<circle>` dots + the three driver labels.
- `how-it-works.test.tsx`: counts exactly 3 step visuals via `data-step-visual`; the no-CLS test now asserts an `aspect-*` class OR inline `aspectRatio` on each wrapper.
- `feature-blocks.test.tsx`: counts 3–4 visuals via `data-feature-visual`; keeps the level-3-heading-per-block pairing, the no-CLS aspect assertion, and the `md:order-*` flip assertion.

## Verification Results
- `npx vitest run src/components/marketing/story/` → **30 passed, 0 failed** (4 suites: skeletons, simulation-showcase, how-it-works, feature-blocks).
- `grep -rl '"use client"' src/components/marketing/story/*.tsx` → **empty** (all four sections pure RSC).
- Task greps: `ScoreGaugeSkeleton`/`DriverRowsSkeleton` present in simulation-showcase, no `"use client"`; how-it-works imports skeletons, no `"use client"`, no `\breading\b`, `data-step-visual` × 3; feature-block `items-start`, no `aspect="16/10"`, `aspect-[16/9]`+`max-h-[300px]`, `md:order-*` flip, `data-feature-visual`; feature-blocks `gap-12 md:gap-16`. All **OK**.
- `npx tsc --noEmit` → 0 errors in any touched `story/` file (13 pre-existing errors elsewhere in board/engine/header test fixtures — out of scope, untouched).
- `npm run build` → **Compiled successfully**, route table shows `┌ ○ /` (root route stays **static** — no client leak introduced).

## Deviations from Plan

### Auto-fixed Issues
None — plan executed as written. (The plan explicitly anticipated the WR-04 token-duplication from the filled frame and instructed migrating those assertions in Task 4, which is exactly what was done; not a deviation.)

## Known Stubs
The section visuals are now 03-04 static-SVG product skeletons — intentional, STUB-LOCK-compliant set-dressing (the entire purpose of this gap-closure plan: give the stubs an intentional skeleton vocabulary). No real data, no real screenshots, no engine/data wiring was introduced. The fixed sample values (score 87, 68% watch-through, drops at 0:07, bar fills) live in the 03-04 primitives and are honest-shape hints, resolved when real screenshots/data land in a future product milestone (out of scope for this marketing milestone).

## Threat Flags
None — static SVG skeletons + presentational layout in existing pure-RSC sections. No new boundary, no user input, no data flow, no network, no secrets (matches the plan threat model: nothing to mitigate).

## Self-Check: PASSED
- All 7 modified key files exist on disk and carry this plan's changes (verified by the passing greps + suite).
- All 4 commits exist in history (`46926db1`, `613d3ab8`, `ea245382`, `9d875b51`).
