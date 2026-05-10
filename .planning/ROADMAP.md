# Roadmap: Brand Statement Landing

## Overview

Six phases that move from brand foundation to live page. Phase 1 locks brand spine and visual metaphors before a single pixel is built, so copy and visual decisions stay consistent across all seven viewports. Phases 2-4 build the page section by section. Phase 5 hardens quality gates. Phase 6 runs the reference-fidelity audit and replaces the live landing page.

## Phases

**Phase Numbering:** Milestone-scoped, starts at 1.

- [ ] **Phase 1: Brand Spine & Visual Metaphor** - Lock brand voice, vocab guardrails, and visual language before any build work starts
- [ ] **Phase 2: Foundation & Hero** - Scaffold the page, vet external component sources, build above-fold (viewport 1)
- [ ] **Phase 3: Demo + How It Works + Bento** - Build viewports 2-4 (live demo, engine pipeline, three surfaces)
- [ ] **Phase 4: Science + Social Proof + Pricing** - Build viewports 5-7 plus footer
- [ ] **Phase 5: Quality, Performance & Accessibility** - Lighthouse ≥ 95, Core Web Vitals, WCAG AA, mobile audit, TypeScript clean
- [ ] **Phase 6: Reference Audit & Launch** - $100M+ fidelity review against reference set, then replace live landing page

## Phase Details

### Phase 1: Brand Spine & Visual Metaphor
**Goal**: Brand voice, copy guardrails, and both visual concepts are locked as documented artifacts before any code is written
**Depends on**: Nothing (first phase)
**Requirements**: BRAND-01, BRAND-02, BRAND-03, BRAND-04, BRAND-05, BRAND-06, VIZ-01, VIZ-02, VIZ-03, VIZ-04, VIZ-05
**Success Criteria** (what must be TRUE):
  1. `.planning/reference/BRAND-SPINE.md` exists with "Your audience, simulated." as the canonical one-liner, voice tone, vocab guardrails, and preferred verbs
  2. Davide has reviewed and signed off on the hero headline, sub-headline, subline, and CTA copy before any build starts
  3. BRAND-BIBLE addendum documents the behavioral-simulation particle visual and the 4-stage engine-pipeline diagram as the locked visual language of Virtuna
  4. Plagiarized Artificial Societies copy is identified and replacement copy is written and approved across all live customer-facing surfaces
  5. Implementation technology choice (canvas / SVG / WebGL / framer-motion) for hero motion is decided with performance rationale documented
**Plans**: 4 plans across 2 waves
  - [x] 01-01-PLAN.md — Author BRAND-SPINE.md voice/vocab/lockup/audience reference (BRAND-01..04) [Wave 1, parallel]
  - [x] 01-02-PLAN.md — Append Visual Metaphor Lock addendum to BRAND-BIBLE.md (VIZ-01..05) [Wave 1, parallel]
  - [x] 01-03-PLAN.md — Plagiarism audit + replacement copy with Davide D-15 batch sign-off (BRAND-05, BRAND-06) [Wave 2, depends on 01-01]
  - [x] 01-04-PLAN.md — Vocab-lint script + pre-commit hook + package.json wiring (BRAND-02 enforcement, downstream Phase 2-6) [Wave 1, parallel]

### Phase 2: Foundation & Hero
**Goal**: Page scaffold exists using the correct tech stack, external component sources are vetted, and the above-fold section (viewport 1) is built and visually correct
**Depends on**: Phase 1
**Requirements**: BUILD-01, BUILD-02, HERO-01, HERO-02, HERO-03, HERO-04, HERO-05, HERO-06, HERO-07, HERO-08, HERO-09, HERO-10
**Success Criteria** (what must be TRUE):
  1. `src/app/page.tsx` (landing) renders with the full hero section — pre-headline lockup, oversized H1, sub-headline, subline, and dual CTA — against the correct coral + Raycast neutral ambient gradient
  2. Behavioral-simulation animated visual (audience particles aggregating into a confidence score) is visible and respects reduced-motion
  3. Hero copy contains zero instances of "viral" or "AI"
  4. Mobile hero at 375px stacks vertically with hierarchy preserved and simulation scales or simplifies gracefully
  5. Rejection criteria for any Magic UI / Aceternity / Origin UI / Cult UI component imports are documented and applied
**Plans**: 4 plans across 2 waves
  - [ ] 02-01-PLAN.md — Scaffold: swap page hero, update barrel, delete plagiarized hero-section.tsx, add scroll-behavior CSS (BUILD-01) [Wave 1, parallel]
  - [ ] 02-02-PLAN.md — Canvas + constants + Vitest invariants: BehavioralCanvas client island, behavioral-hero-constants (HERO_GRADIENT + chip + motion), constants test (HERO-06, HERO-07, HERO-08, HERO-10) [Wave 1, parallel]
  - [ ] 02-03-PLAN.md — External component policy doc + BRAND-BIBLE cross-reference (BUILD-02) [Wave 1, parallel]
  - [ ] 02-04-PLAN.md — BehavioralHero server composition: locked copy, dual CTA, gradient backdrop, DOM-accessible 87% chip overlay (HERO-01..05, HERO-07, HERO-09, HERO-10) [Wave 2, depends on 02-01, 02-02, 02-03]
**UI hint**: yes

### Phase 3: Demo + How It Works + Bento
**Goal**: Viewports 2, 3, and 4 are built and interactive — live demo flow, engine-pipeline diagram, and three-surfaces bento grid
**Depends on**: Phase 2
**Requirements**: DEMO-01, DEMO-02, DEMO-03, DEMO-04, DEMO-05, DEMO-06, DEMO-07, DEMO-08, WORKS-01, WORKS-02, WORKS-03, WORKS-04, WORKS-05, WORKS-06, SURF-01, SURF-02, SURF-03, SURF-04, SURF-05, SURF-06
**Success Criteria** (what must be TRUE):
  1. A visitor can paste a TikTok URL into the demo input, see 3-5 seconds of simulated processing steps, and receive a prediction score with confidence interval and at least one audience-response indicator
  2. Empty, invalid-URL, and error states all render non-broken recovery UI; "Try a sample video" button works with a pre-baked URL
  3. The engine-pipeline diagram shows 4 labeled stages with icons; its pulse motion fires once on viewport entry (not on loop) and is absent in reduced-motion mode
  4. The bento grid renders 3 cells (Prediction, Competitor Intelligence, Brand Deals) with Raycast card aesthetics — bg-transparent, 6% border, 12px radius, hover state bg-white/[0.02] only
  5. All three viewports scroll naturally from hero to demo to pipeline to bento with no horizontal scroll on mobile
**Plans**: TBD
**UI hint**: yes

### Phase 4: Science + Social Proof + Pricing
**Goal**: Viewports 5, 6, and 7 are built — behavioral-research science section, creator social proof, pricing comparison, and footer with Numen Machines lockup
**Depends on**: Phase 3
**Requirements**: SCI-01, SCI-02, SCI-03, SCI-04, SCI-05, SCI-06, PROOF-01, PROOF-02, PROOF-03, PROOF-04, PROOF-05, PRICE-01, PRICE-02, PRICE-03, PRICE-04, PRICE-05, PRICE-06
**Success Criteria** (what must be TRUE):
  1. The Science section renders 3-5 citation chips or research surfaces, a dataset-stats callout, and a self-improving-loop visualization with monospaced / lab-coded aesthetics
  2. Social proof section displays 3-5 creator quotes with attribution; platform metrics use honest "early signal" framing where numbers are not yet impressive
  3. Pricing section shows a clear Starter vs Pro feature comparison in Raycast card style with 7-day trial messaging and a single primary CTA at the bottom
  4. Footer renders Numen Machines lockup, social links, legal links, and copyright
  5. Mobile pricing cards stack vertically and the comparison remains scannable at 375px
**Plans**: TBD
**UI hint**: yes

### Phase 5: Quality, Performance & Accessibility
**Goal**: The full landing page passes Lighthouse ≥ 95, Core Web Vitals targets, WCAG AA, keyboard navigation, reduced-motion fallbacks, mobile verification, and TypeScript strict checks — no blocking regressions before audit
**Depends on**: Phase 4
**Requirements**: BUILD-03, BUILD-04, BUILD-05, BUILD-06, BUILD-08, BUILD-10
**Success Criteria** (what must be TRUE):
  1. Lighthouse scores ≥ 95 on Performance, Accessibility, and Best Practices on both mobile and desktop
  2. LCP < 2.5s, CLS < 0.1, INP < 200ms measured on the full page
  3. All animations have reduced-motion fallbacks; full keyboard navigation works across every interactive element including CTAs, demo input, and pricing buttons
  4. `pnpm lint` and `pnpm build` exit clean with zero TypeScript `any` violations
  5. Auth-gated CTAs correctly route logged-out users to dashboard onboarding and logged-in users to their dashboard; verified on iPhone-class (375px) and tablet viewports
**Plans**: TBD

### Phase 6: Reference Audit & Launch
**Goal**: Every viewport passes the $100M+ reference-fidelity review against Anthropic, Linear, Vercel, and Raycast, and the new page replaces the live landing at `/`
**Depends on**: Phase 5
**Requirements**: BUILD-07, BUILD-09
**Success Criteria** (what must be TRUE):
  1. Reference-fidelity audit document exists covering all 7 viewports — each reviewed against the closest comparable section in Anthropic / Linear / Vercel / Raycast; every viewport passes the quality bar
  2. `src/app/page.tsx` is the new landing page (no parallel `/landing-v2` route); the old landing is gone
  3. The live Vercel deployment renders the new landing at the root URL with no visual regressions from the pre-launch audit state
**Plans**: TBD

## Progress

**Execution Order:** 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Brand Spine & Visual Metaphor | 0/4 | Planned | - |
| 2. Foundation & Hero | 0/4 | Planned | - |
| 3. Demo + How It Works + Bento | 0/TBD | Not started | - |
| 4. Science + Social Proof + Pricing | 0/TBD | Not started | - |
| 5. Quality, Performance & Accessibility | 0/TBD | Not started | - |
| 6. Reference Audit & Launch | 0/TBD | Not started | - |
