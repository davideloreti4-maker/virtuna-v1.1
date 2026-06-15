# Roadmap: Landing v2 — Refined Marketing Site

## Overview

Five phases take Numen from an empty `/` route to a refined, dark, single-scroll
marketing landing that clears the taste bar five prior attempts missed. We build
**Foundation first** (the `/` mount, dark brand tokens, the reusable placeholder-slot
system, and the motion + reduced-motion wiring) because every downstream section depends
on it. Next the **Hero & Signature Moment** — the highest-craft, highest-risk "crowd →
score" audience-simulation centerpiece — gets its own phase and the room it needs. Then
the scroll body fills in: the **Story & Showcase** (how-it-works + "the reading" +
feature deep-dives) and **Proof & Conversion** (social proof, testimonials, pricing
teaser, final CTA, FAQ). A final **Quality Hardening** pass locks responsive behavior,
the performance bar, and accessibility across the whole page. Marketing surface only —
every product visual is a labelled, swappable placeholder slot, not a shipped asset.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Shell** - `/` mount, dark brand tokens, the placeholder-slot system, motion/reduced-motion wiring, and header + footer chrome (completed 2026-06-14)
- [x] **Phase 2: Hero & Signature Moment** - The hero headline + CTA and the signature centerpiece — pivoted from a canvas "crowd → score" animation to a **product-shot showcase** (desktop reading window + phone TikTok, swappable Placeholder slots) after live craft review (completed 2026-06-15)
- [x] **Phase 3: Story & Showcase** - How-it-works, "the reading" product showcase, and feature deep-dive blocks (placeholder frames) (completed 2026-06-15)
- [ ] **Phase 4: Proof & Conversion** - Social-proof strip, testimonials, pricing teaser, final CTA band, and an accessible FAQ
- [ ] **Phase 5: Quality Hardening** - Final responsive, performance, and accessibility pass across the whole page

## Phase Details

### Phase 1: Foundation & Shell

**Goal**: Stand up the marketing page at `/` with the dark Numen brand system, the reusable placeholder-slot component every section will use, the motion foundation behind a reduced-motion fallback, and the header + footer chrome that wraps the scroll.
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, NAV-01, NAV-02, NAV-03
**Success Criteria** (what must be TRUE):

  1. Visiting `/` renders the new marketing page (replacing the old home), dark-only, using the **flat-warm** Numen design system ported from `~/virtuna-numen-rework` (neutral charcoal #262624 bg, cream #ece7de text, terracotta-clay coral #d97757, Inter + Newsreader serif for voice moments, flat-matte — no glass/glow; 6%/10% borders + 12px radius carried as-is). _Supersedes the old `main` Raycast brand — see `phases/01-foundation-shell/01-CONTEXT.md`._
  2. The reusable placeholder-slot component renders labelled, aspect-ratio-correct stand-ins in image / video / avatar / logo variants, each swappable via one prop or one file with no layout shift
  3. Motion is wired via motion (Framer Motion) plus the permitted libs (shadcn/Radix/Magic UI/Aceternity) and every animation respects a global reduced-motion fallback
  4. A header shows the Stele logo + "Numen" wordmark and a "Try it free" CTA, and on small screens it collapses to a mobile-appropriate nav (menu and/or CTA)
  5. A footer provides brand, in-page section links, and legal/social placeholders

**Plans**: 5 plans (3 waves)

Plans:
**Wave 1**

- [x] 01-01-PLAN.md (wave 1) — flat-warm theme port + Newsreader wiring + scroll-skeleton route mount at `/` + `(marketing)/layout` pass-through fix + delete `landing/*` & dead routes + `/pricing` surgical fix (FOUND-01, FOUND-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md (wave 2) — reusable `<Placeholder>` slot (image/video/avatar/logo, `src` one-prop swap, aspect-locked, reduced-motion-gated breathe) (FOUND-03)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md (wave 3) — motion foundation: `<MotionConfig reducedMotion="user">` + CSS `@media (prefers-reduced-motion: reduce)` block + D-16 verify (FOUND-04)
- [x] 01-04-PLAN.md (wave 3) — flat-matte header (NumenLogo + anchor nav + "Try it free"→`/signup` + "Sign in"→`/login` + mobile collapse) (NAV-01, NAV-03)
- [x] 01-05-PLAN.md (wave 3) — flat-warm footer (brand + tagline + anchor mirror + Privacy/Terms/X/TikTok placeholders) (NAV-02)

### Phase 2: Hero & Signature Moment

**Goal**: Deliver the hero — a hybrid-voice headline and "Try it free" CTA — anchored by the signature "crowd → score" moment: a synthetic audience reacts to a video and resolves into a virality score, with a static fallback so it never blocks first paint or breaks accessibility.
**Depends on**: Phase 1
**Requirements**: HERO-01, HERO-02, HERO-03, HERO-04
**Success Criteria** (what must be TRUE):

  1. The hero presents a hybrid-voice headline + subcopy that communicates "know if it'll pop before you post"
  2. The hero's primary "Try it free" CTA routes to the existing app signup
  3. The hero centerpiece plays the signature "crowd → score" moment — a synthetic audience reacts to a video and resolves into a virality score
  4. With reduced-motion enabled (or before the moment lazy-loads), a static composed frame stands in so first paint is never blocked and accessibility is preserved

**Plans**: 4 plans (4 waves)
**UI hint**: yes

> Build order ≠ plan-number order (per 02-RESEARCH.md): the canvas (02-02) depends on `ComposedStill` (02-03), so the dependency sequence is **00 → 01 → 03 → 02**. Waves are assigned accordingly.

Plans:

**Wave 0**

- [x] 02-00-PLAN.md (wave 0) — Nyquist Wave-0 test scaffold: 4 RED test files (hero / composed-still / signature-moment-client / hero-constants), happy-dom pragma (HERO-01, HERO-02, HERO-03, HERO-04)

**Wave 1** *(blocked on Wave 0)*

- [x] 02-01-PLAN.md (wave 1) — RSC hero: serif H1 + Inter subcopy + "Try it free" CTA→SIGNUP_URL + "See how it works ↓" scroll-cue + the dimension-locked flat-warm stage shell; replace the page.tsx stub (HERO-01, HERO-02)

**Wave 2** *(blocked on Wave 1)*

- [x] 02-03-PLAN.md (wave 2) — ~~`ComposedStill` + `hero-constants` + the `"use client"` `SignatureMomentClient` ssr:false boundary~~ **SUPERSEDED** by the 02-02 pivot; these components were built then deleted when the canvas moment was retired (HERO-04 now satisfied by the fully-static product-shot hero). See 02-02-SUMMARY.

**Wave 3** *(blocked on Wave 2)*

- [x] 02-02-PLAN.md (wave 3) — ~~bespoke canvas-2D "crowd → score" moment~~ **PIVOTED**: the canvas was built (`7fc9ec77`) then REJECTED at the blocking human craft-verify (read as a tech-demo). Replaced with a **product-shot showcase** — flat-warm desktop reading window + phone TikTok, both swappable Placeholder slots (HERO-03 reinterpreted as "the product, shown" · HERO-04 satisfied: fully static, no-CLS). See 02-02-SUMMARY.

### Phase 3: Story & Showcase

**Goal**: Tell the product story through placeholder frames — a three-step "how it works", a "the reading"/Simulation showcase of the output, and three to four feature deep-dive blocks that each pair a benefit with a placeholder visual.
**Depends on**: Phase 1
**Requirements**: STORY-01, STORY-02, STORY-03
**Success Criteria** (what must be TRUE):

  1. A "how it works" section walks three steps — paste TikTok link → audience simulates → get your reading — using placeholder frames
  2. A "the reading" showcase presents the output (audience simulation, watch-through %, and Hook · Retention (where viewers drop) · Shareability) via placeholder product frames
  3. Three to four feature deep-dive blocks each pair a clear benefit with a placeholder visual
  4. Every product visual in these sections is a labelled placeholder slot from the Phase 1 system, swappable later with no layout shift

**Plans**: 4 base plans (4 waves) + 5 gap-closure plans (2 waves) — live UAT 2026-06-15 found visual-craft + a11y gaps; refinements keep the STUB LOCK (no real assets) and the "Simulation" noun.
**UI hint**: yes

Plans:

- [x] 03-00-PLAN.md (wave 0) — Nyquist test scaffold: 3 RED story test files (how-it-works / simulation-showcase / feature-blocks) + extend footer anchor test with #features (STORY-01, STORY-02, STORY-03)
- [x] 03-01-PLAN.md (wave 1) — "How it works" three-step section filling #how-it-works (STORY-01)
- [x] 03-02-PLAN.md (wave 2) — "The Simulation" output showcase filling #the-simulation (STORY-02)
- [x] 03-03-PLAN.md (wave 3) — feature deep-dive blocks + new #features section + "Features" nav anchor (header + footer) + BLOCKING static-build gate (STORY-03)

**Gap closure** *(from 03-VERIFICATION.md live UAT — `gap_closure: true`)*

**Wave 1** *(file-disjoint, parallel)*

- [x] 03-04-PLAN.md (wave 1) — static-SVG product-skeleton primitives (score-gauge / audience-cloud / driver-rows / device-chrome) + remove the "16:10" dev label from the marketing Placeholder (GAP-1 primitives, IN-04)
- [x] 03-06-PLAN.md (wave 1) — page rhythm: tighter section padding (GAP-3 page-level) + `scroll-margin-top` anchors (GAP-5) + refreshed docblock (IN-02)
- [x] 03-07-PLAN.md (wave 1) — mobile-nav a11y: Escape-close + focus trap + focus restore (GAP-4 / WR-03) + scroll-lock save/restore (WR-02) + shared `src/lib/nav.ts` constant (IN-03)
- [x] 03-08-PLAN.md (wave 1) — hero noun lock: "Numen reading" → "Numen Simulation" + test assertion (WR-01)

**Wave 2** *(blocked on 03-04)*

- [x] 03-05-PLAN.md (wave 2, depends 03-04) — apply skeletons + craft polish to the 3 story sections: fill the Simulation device frame (GAP-2), step skeletons (GAP-1), feature-block balance (GAP-3 component-level) + docblock (IN-01) + de-brittle tests (WR-04)

### Phase 4: Proof & Conversion

**Goal**: Build trust and drive the click — a social-proof strip and testimonials (placeholder avatars/logos/quotes), a pricing teaser with "Try it free" CTAs, a final full-width CTA band, and an accessible FAQ accordion.
**Depends on**: Phase 1
**Requirements**: PROOF-01, PROOF-02, CONVERT-01, CONVERT-02, CONVERT-03
**Success Criteria** (what must be TRUE):

  1. A social-proof strip shows creator avatars and a logo wall using placeholder slots
  2. A testimonials section shows creator quote cards with placeholder avatars and quotes
  3. A pricing teaser presents tiers (Starter/Pro) with "Try it free" CTAs (placeholder-ok pricing)
  4. A final full-width CTA band ("Try it free") sits before the footer
  5. An FAQ section answers common creator questions in a keyboard-accessible accordion

**Plans**: 6 plans (3 waves)
**UI hint**: yes

> Build order = wave order. The five section COMPONENTS are built file-disjoint in Wave 1
> (subdirs `proof/ pricing/ faq/ cta/`); a single Wave-2 integration plan owns the lone
> `page.tsx` edit (page.tsx write-contention — never two plans editing it in one wave). The
> CTA band is full-bleed (breaks `max-w-5xl`, D-12); the FAQ is the lone client island.

Plans:

**Wave 0**

- [x] 04-00-PLAN.md (wave 0) — Nyquist RED scaffold: 5 section test files + page-order/NAV-lock cross test (PROOF-01, PROOF-02, CONVERT-01, CONVERT-02, CONVERT-03)

**Wave 1** *(blocked on Wave 0; file-disjoint, parallel)*

- [x] 04-01-PLAN.md (wave 1) — social-proof strip (peer-count stat + reduced-motion-gated logo marquee) + bespoke flat-warm testimonials 3-card grid (PROOF-01, PROOF-02)
- [x] 04-02-PLAN.md (wave 1) — pricing teaser: bespoke flat-warm Starter + Pro cards (Pro "Most popular", placeholder $/mo + trial, both CTAs → SIGNUP_URL, no checkout machinery) (CONVERT-01)
- [x] 04-03-PLAN.md (wave 1) — FAQ: RSC wrapper + Radix single-open accordion client island, 6 objection-busting Q&A, cold tokens restyled flat-warm (CONVERT-03)
- [x] 04-04-PLAN.md (wave 1) — final full-width CTA band: serif close-line + "Try it free" CTA + risk-reducer microcopy + muted ScoreGaugeSkeleton echo (CONVERT-02)

**Wave 2** *(blocked on Wave 1)*

- [ ] 04-05-PLAN.md (wave 2) — integration: extend the marketing barrel + wire all 5 sections into `page.tsx` in the D-18 order (strip under #hero, testimonials after #features, fill #pricing/#faq, band before footer) + static-build gate (○ /) + NAV unchanged (PROOF-01, PROOF-02, CONVERT-01, CONVERT-02, CONVERT-03)

### Phase 5: Quality Hardening

**Goal**: Lock cross-cutting quality across the whole assembled page — mobile-first responsiveness from 320px up, a premium performance bar with lazy-loaded heavy motion/media and no slot-driven layout shift, and full keyboard + semantic + contrast accessibility.
**Depends on**: Phase 4 (whole page assembled across Phases 1–4)
**Requirements**: FOUND-05, FOUND-06, FOUND-07
**Success Criteria** (what must be TRUE):

  1. Every section is responsive mobile-first and renders cleanly from 320px through desktop with no horizontal scroll or broken layout
  2. Heavy motion and media lazy-load, no layout shift is introduced by placeholder slots, and Lighthouse mobile performance scores ≥90
  3. The page is fully keyboard-navigable with semantic landmarks, visible focus states, and WCAG AA contrast on all text/background pairs
  4. The signature moment and other heavy interactions degrade gracefully under reduced-motion and slow-load conditions without blocking content

**Plans**: TBD
**UI hint**: yes

Plans:

- [ ] 05-01: TBD — responsive audit + fixes, 320px → desktop (FOUND-05)
- [ ] 05-02: TBD — performance pass: lazy-load heavy motion/media, CLS/Lighthouse ≥90 (FOUND-06)
- [ ] 05-03: TBD — accessibility pass: landmarks, focus, keyboard nav, WCAG AA contrast (FOUND-07)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Shell | 5/5 | Complete   | 2026-06-14 |
| 2. Hero & Signature Moment | 4/4 | Complete   | 2026-06-15 |
| 3. Story & Showcase | 9/9 | Complete   | 2026-06-15 |
| 4. Proof & Conversion | 5/6 | In Progress|  |
| 5. Quality Hardening | 0/3 | Not started | - |
