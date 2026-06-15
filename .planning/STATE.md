---
gsd_state_version: 1.0
milestone: landing-v2
milestone_name: Refined Marketing Site
status: "03-05 (final gap plan) DONE — applied the 03-04 product-skeleton primitives to all three story sections (Simulation frame filled + height-capped GAP-2; how-it-works steps + feature blocks show intentional skeletons GAP-1; feature rows top-aligned wider-shorter + denser rhythm GAP-3 component-level); IN-01 + WR-04 fixed; story suite 30/30 GREEN, all sections pure RSC, / stays ○ static. Phase 03 gap-closure complete (18/18 plans)"
stopped_at: Completed 03-05-PLAN.md
last_updated: "2026-06-15T11:31:30.000Z"
last_activity: 2026-06-15
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 18
  completed_plans: 18
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-14) · Milestone: .planning/MILESTONE.md

**Core value:** A refined, premium marketing landing that makes a creator instantly *get* Numen — "know if it'll pop before you post" — and click "Try it free."
**Current focus:** Phase 03 — story-showcase

## Current Position

Phase: 03 (story-showcase) — GAP CLOSURE COMPLETE
Plan: 4 base done + all 5 gap plans (03-04, 03-05, 03-06, 03-07, 03-08) DONE
Status: 03-05 (final gap plan) DONE — applied the 03-04 product-skeleton primitives to all three story sections: Simulation frame filled + height-capped (GAP-2), how-it-works steps + feature blocks show intentional skeletons not empty boxes (GAP-1), feature rows top-aligned wider-shorter + denser rhythm (GAP-3 component-level); IN-01 docblock + WR-04 brittle queries fixed; story suite 30/30 GREEN, all sections pure RSC, / stays ○ static
Last activity: 2026-06-15

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 5
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 5 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01 P01 | 9 | 3 tasks | 6 files |
| Phase 01 P02 | 5min | 2 tasks | 3 files |
| Phase 01 P04 | 7min | 2 tasks | 2 files |
| Phase 01 P05 | 4min | 2 tasks | 2 files |
| Phase 01 P03 | 3min | 2 tasks | 4 files |
| Phase 02 P00 | 10min | 2 tasks | 4 files |
| Phase 02 P01 | 8min | 2 tasks | 4 files |
| Phase 02 P03 | ~30min | 2 tasks | 4 files (+1 stub) |
| Phase 02 P02 | ~session | canvas→pivot | product-shot showcase (−5 files) |
| Phase 03 P00 | 1min | 2 tasks | 4 files |
| Phase 03 P01 | 18min | 2 tasks | 3 files |
| Phase 03 P02 | ~12min | 2 tasks | 3 files |
| Phase 03 P03 | 4min | 3 tasks | 6 files |
| Phase 03 P04 | ~6min | 2 tasks | 7 files (gap-closure) |
| Phase 03 P06 | ~4min | 1 task | 1 file (gap-closure) |
| Phase 03 P07 | ~12min | 2 tasks | 4 files (gap-closure, TDD) |
| Phase 03 P08 | ~6min | 1 task tasks | 2 files (gap-closure) files |
| Phase 03 P05 | ~10min | 4 tasks | 7 files (gap-closure) |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Hero signature moment ("crowd → score", HERO-03/04) isolated in its own phase (Phase 2) — highest-craft, highest-risk item gets the room it needs.
- Roadmap: Cross-cutting quality (FOUND-05 responsive, FOUND-06 perf/lazy, FOUND-07 a11y) mapped to a final hardening pass (Phase 5) over the assembled page; seeded as standing criteria from Foundation onward.
- Milestone: Marketing surface only — every product visual is a labelled, swappable placeholder slot (FOUND-03), never a shipped asset.
- [Phase ?]: 01-01: Adopted numen-rework flat-warm @theme wholesale (charcoal #262624 / cream #ece7de / terracotta coral); cold Raycast brand retired
- [Phase ?]: 01-01: page.tsx owns Header+main+Footer; (marketing)/layout.tsx is a bare pass-through (D-10 double-html bug fixed)
- [Phase ?]: 01-01: Nav/section anchors = hero/how-it-works/the-simulation/pricing/faq (D-23 Simulation noun); src/lib/routes.ts holds shared CTA URLs
- [Phase ?]: 01-02: <Placeholder> breathe is an opt-in boolean prop (default OFF), double-gated via animate-skeleton-breathe + motion-reduce:animate-none
- [Phase ?]: 01-02: marketing dir + barrel established (D-15); per-variant default aspect (image/video 16/9, avatar 1/1, logo 3/1); logo icon-only, video play-triangle overlay
- [Phase ?]: 01-04: Header rewritten flat-matte — bar = #1a1a18 opaque (no blur), logo → #hero; mobile = useState disclosure (NOT Radix Sheet, D-21) with shadow-float panel that closes on tap; CTA via Button asChild → SIGNUP_URL/LOGIN_URL
- [Phase ?]: 01-05: Footer rebuilt flat-warm as a STATIC server component (no use client) — tone-step #1a1a18 surface + hairline TOP border, no glass/gradient; product anchors mirror the header nav, legal/social are labelled href='#' placeholder stubs (D-22)
- [Phase 01-03]: 01-03: MotionConfigShell (<MotionConfig reducedMotion='user'>) wraps the FULL chrome (Header+main+Footer); page stays RSC and / stays statically prerendered
- [Phase 01-03]: 01-03: two-layer reduced-motion contract = MotionConfig (Framer) + CSS @media (prefers-reduced-motion: reduce) animation:none for skeleton-breathe/shimmer/marquee/marquee-vertical
- [Phase 01-03]: 01-03: D-16 satisfied by VERIFY (6/6 motion/* on motion/react, 0 framer-motion) + MotionConfig wiring, NOT migration; framer-motion dep retained (4 product files), removal deferred to Phase 5
- [Phase ?]: 02-00: Wave-0 hero tests RED-by-design — module-not-found is the success signal; HERO-01..04 turn GREEN in 02-01/02-03, not here
- [Phase ?]: 02-00: SVG ring geometry re-derived in-test (radius 114, offset=circumference·(1−score/100)) + token assertions (var(--color-accent), threshold from verdict-constants) catch a hardcoded ring/hex
- [Phase 02-01]: Hero is a PURE RSC — no client directive, no lazy ssr-disabled import in hero.tsx/page.tsx (the 02-00 landmine); client island + canvas deferred to 02-03/02-02. / stays statically prerendered (verified ○ in build route table).
- [Phase 02-01]: The hero STAGE shell owns the no-CLS aspect-lock (inline aspect-ratio 16/10) — the fixed box 02-03's ComposedStill + 02-02's client island mount into with zero layout shift.
- [Phase 02-01]: Stage holds a labelled Placeholder(variant=video,aspect=9/16) as visible scaffolding; the 02-03/02-02 swap-in seam is marked in hero.tsx. Coral is the lone accent, only on the primary CTA.
- [Phase 02-03]: dynamic(ssr:false) canvas import lives ONLY in signature-moment-client.tsx ('use client'); Hero/page stay pure RSC and / stays statically prerendered (○). THE Next-16 landmine fix (mirrors Board.tsx), verified by clean build.
- [Phase 02-03]: ComposedStill = pure-RSC universal floor (D-15) — phone + deterministic seeded-PRNG settled dot field (~46 SVG circles, never Math.random → no hydration mismatch) + clean re-derived coral arc ring (glow/tiers/white/framer-motion STRIPPED) + static coral score; role=img/aria-label + aspect-lock. Serves SSR/reduced-motion/mobile/at-rest.
- [Phase 02-03]: SignatureMomentClient gate = !reduced && !isMobile && tier!=='low' && !fpsDropped → return null on still paths (canvas rAF never mounts under reduced-motion, Pitfall 5); ComposedStill is its dynamic loading fallback. hero-constants.ts is the score(87)/geometry(240/12)/timing/palette SSOT shared with the 02-02 canvas.
- [Phase 02-03]: CLOSED OUT ON RESUME — code was committed in a prior session (feat 86b744ba + auto-wip 5574c4f4) but never got a SUMMARY/tracking; reconciled here. Needed a TEMPORARY signature-canvas.tsx stub (re-renders ComposedStill) so the ssr:false import + vitest collector resolve — 02-02 REPLACES it. WATCH: the auto-wip hook can pre-empt the executor's atomic-commit protocol mid-plan.
- [Phase 02-02]: **PIVOT — canvas signature moment RETIRED.** The bespoke canvas "crowd → score" (built 7fc9ec77) was REJECTED at the blocking human craft-verify: read as a screensaver/tech-demo (420-particle cloud, doubled+rough ring from the canvas stacking on ComposedStill, particles outside the stage, score/label collision). Root cause = conceptual (abstract effect ≠ premium product hero) + architectural (client canvas stacked a second mis-scaled instrument over the SSR still).
- [Phase 02-02]: **NEW hero = PRODUCT-SHOT showcase** (user-chosen, OpusClip/Vercel/sandcastles pattern): flat-warm desktop browser window = the Numen reading (OUTPUT) + a phone in front = the TikTok you paste (INPUT); reads left→right as paste → prediction. Both screens are swappable <Placeholder> slots (FOUND-03) — real desktop/mobile screenshots or a screen-capture video drop in via `src` once numen-rework ships. Device chrome + layered shadows + faint warm radial seat = permanent craft; phone is a sibling of the overflow-hidden window with its own shadow+ring to read "in front".
- [Phase 02-02]: HERO-03 REINTERPRETED = "the product, shown" (not the animated crowd). HERO-04 satisfied by construction = hero is fully static (pure RSC, no client JS/canvas) + aspect-locked slots ⇒ no-CLS, accessible. 02-03's components (ComposedStill, hero-constants, SignatureMomentClient ssr:false boundary) + the canvas + their 02-00 Nyquist suites were DELETED; hero.test.tsx re-scoped (8 tests gate the showcase). Suite 1949 green, build clean, / static.
- [Phase 02-02]: DEFERRED to Phase 5 — showcase is desktop-tuned (absolute phone, lg shadows); responsive restack at mobile widths + perf/a11y = FOUND-05/06/07 sweep. ASSET follow-up (product): swap placeholders → real desktop+mobile screenshots, then a looping screen-capture video.
- [Phase ?]: 03-00: Wave-0 story tests RED-by-design — module-not-found for HowItWorks/SimulationShowcase/FeatureBlocks is the success signal; STORY-01/02/03 turn GREEN in 03-01/02/03
- [Phase ?]: 03-00: 'The Simulation' heading asserted VERBATIM (matches #the-simulation anchor); 5 outputs + step copy matched by stable tokens; noun discipline gated (Simulation present, 'reading' forbidden)
- [Phase ?]: 03-00: footer.test.tsx it.each extended with #features (between #the-simulation and #pricing) — RED until 03-03 wires footer.tsx PRODUCT_LINKS
- [Phase ?]: 03-01: HowItWorks is a pure RSC; StaggerReveal entrance is the only client island; / stays statically prerendered
- [Phase ?]: 03-01: use the named StaggerRevealItem export in RSCs — StaggerReveal.Item static prop is undefined across the RSC to client prerender boundary (next build crash on /)
- [Phase ?]: 03-01: single canonical product-noun node ('Get your Simulation' title) satisfies the gate getByText(/simulat.../); step 2 = 'The audience reacts', step-3 label = 'Your prediction'
- [Phase ?]: 03-02: SimulationShowcase RSC built (STORY-02) — flat-warm device-framed Placeholder (hero browser-window chrome reused, not imported) names all 5 outputs; #the-simulation stub filled in place; 7/7 STORY-02 gate GREEN, / stays static
- [Phase ?]: 03-02: copy↔test token discipline — LOCKED <h2>'The Simulation' is the sole /simulat/i node; Placeholder label='Your prediction', output-1 label='Audience reaction' so 03-00 single-match getByText queries resolve unambiguously
- [Phase ?]: 03-03: STORY-03 FeatureBlocks = 4 alternating benefit + Placeholder deep-dive rows (pure RSC); FeatureBlock flip idiom (cn(flip && md:order-1/2)) = canonical in-repo alternating-row pattern
- [Phase ?]: 03-03: new #features section mounted between #the-simulation and #pricing; one NAV_LINKS edit surfaces 'Features' in desktop bar + mobile panel (5 links), footer mirrors it
- [Phase ?]: 03-03: phase static-prerender guarantee HOLDS — all 4 story files pure RSC, assembled / builds ○ static (exit 0); full suite 1967 green
- [Phase ?]: 03-04: product-skeleton primitives = pure-RSC static SVG (score gauge 270deg arc + 87/Strong, 18-dot audience cloud + 68% watch-through, Hook/Retention/Shareability driver rows + drops at 0:07); coral kept precious (1 dot + 1 bar)
- [Phase ?]: 03-04: device chrome (BrowserChrome/PhoneChrome) factored into skeletons/ so 03-05 reuses chrome without re-importing the hero
- [Phase ?]: 03-04: '16:10' dev ratio label removed from marketing Placeholder; no-CLS aspectRatio inline lock kept intact
- [Phase ?]: 03-04: IN-04 NOT applied — CVA VariantProps allows null so variant ?? 'image' fallback is required (tsc TS2322)
- [Phase ?]: 03-06: page.tsx scroll-mt-20 (80px) on all 6 anchors clears the 64px sticky header with ~16px room (GAP-5); section rhythm tightened py-20 → py-16 md:py-20 (hero py-12 md:py-16) for desktop density (GAP-3 page-level); docblock refreshed (IN-02); / stays statically prerendered (pure RSC, build ○ /)
- [Phase ?]: 03-07: src/lib/nav.ts = single source of truth for the in-page nav set (IN-03); header NAV_LINKS + footer PRODUCT_LINKS hand-duplicated arrays deleted, both import { NAV_LINKS } from "@/lib/nav" (rendered output byte-identical, footer suite GREEN)
- [Phase ?]: 03-07: mobile-nav a11y closed (GAP-4/WR-03) — Escape-close + focus trap (Tab/Shift+Tab wrap on a[href],button) + focus restore to trigger on a wasOpenRef-gated open→closed transition (never steals focus on mount); trap/restore INLINE in header.tsx (a11y.ts has no helper, header is the only consumer)
- [Phase ?]: 03-07: WR-02 scroll-lock fixed — useEffect snapshots `const prev = document.body.style.overflow`, sets "hidden" while open, restores `prev` in cleanup (no bare `= ""` clobber of a pre-existing lock owner); aria-expanded/aria-controls/panel id/data-testid unchanged, no visual change, / stays ○ static
- [Phase 03-08]: 03-08: hero desktop slot label 'Numen reading' to 'Numen Simulation' — the last place on / shipping the retired noun is gone; page-wide 'Simulation, never reading' lock now holds above the fold (WR-01)
- [Phase 03-08]: 03-08: HERO-01 subcopy assertion narrowed /simulat(es|ion|e)/i to /simulates/i so the new 'Numen Simulation' slot label does not create a second /simulat/i match (single-match getByText discipline, carried from 03-02)
- [Phase 03-05]: 03-05: filled the Simulation device frame with the 03-04 gauge/cloud/driver-rows skeleton + capped the window body max-h-[460px] (GAP-2 — the ~640px void is gone); reused the existing inline browser chrome (not BrowserChrome) to avoid a duplicate numen.app pill
- [Phase 03-05]: 03-05: how-it-works steps + feature blocks now show intentional 03-04 product skeletons (GAP-1) in data-step-visual / data-feature-visual aspect-stable wrappers (skeletons carry no data-variant); feature rows top-align (items-start) at a wider-shorter aspect-[16/9] max-h-[300px] framed in BrowserChrome + denser gap-12 md:gap-16 row rhythm (GAP-3 component-level)
- [Phase 03-05]: 03-05: WR-04 closed — the filled frame now also renders watch-through/Hook/Retention/drop/Shareability, so the simulation-showcase output assertions are scoped to the outputs <dl> via within(dl)+getAllByText; <h2> 'The Simulation' kept as the sole rendered /simulat/i node + a GAP-2 structural gate added (>=1 arc circle + >=6 circles + driver labels)

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

[Issues that affect future work]

None yet.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-06-15T11:31:30.000Z
Stopped at: Completed 03-05-PLAN.md
Resume file: None
