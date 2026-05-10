# Roadmap: Landing Page Redesign

**Milestone:** Landing Page Redesign (worktree-scoped)
**Created:** 2026-05-11
**Granularity:** fine
**Total phases:** 8
**Total requirements covered:** 36 / 36

## Strategy

This is a single-page production landing redesign. Phases are derived from the 10 locked-in sections in `MILESTONE.md` plus cross-cutting concerns. Section-cluster phases group sections that share build patterns or hard dependencies (e.g., calculator + pricing must coexist because `CALC-04` bridges into pricing visually). Foundation work is isolated to Phase 1 to establish the Magic UI + shadcn integration pattern once. Cross-cutting copy + system-wide quality (responsiveness, a11y, perf, brand-spine finalization) lands as the final hardening phase per the milestone's "brand spine emerges during build" policy.

Anti-patterns explicitly avoided in this decomposition:

- No phase imposes a "lock the brand spine" gate (per MILESTONE.md brand spine policy)
- No phase requires a separate hero-video shoot (`HERO-V2` is deferred to future)
- No phase touches `/about`, `/research`, `/manifesto`, in-app viz, or live demo (out of scope)
- No horizontal layering (e.g., "all components first, then all sections") — every phase delivers user-visible value to a visitor at `/`

## Phases

- [ ] **Phase 1: Foundation & Route Scaffolding** — Stand up Magic UI integration, marketing route shell, and Raycast-native component vetting pattern
- [ ] **Phase 2: Hero & Trust Band (Above-Fold)** — Above-fold hero with layered UI fragments + social-proof band on initial paint
- [ ] **Phase 3: Three Surfaces Bento** — Three-tile bento with embedded surface visuals (Prediction · Competitor Intelligence · Brand Deals)
- [ ] **Phase 4: How It Works + The Science** — Numbered engine pipeline + chronological research timeline with subtle motion
- [ ] **Phase 5: Audience Tabs + Social Proof** — Built-for-creators/investors tabs + 3-up testimonial grid with metrics
- [ ] **Phase 6: Tool Consolidation Calculator + Pricing** — Interactive savings widget bridging visually into Starter/Pro pricing
- [ ] **Phase 7: FAQ + Final CTA + Footer** — Closing block: 5-8 collapsible FAQs, final CTA card, Numen Machines footer lockup
- [ ] **Phase 8: Copy Finalization + System Hardening** — Original copy audit, brand-spine sentence finalization, mobile/a11y/perf hardening

## Phase Details

### Phase 1: Foundation & Route Scaffolding
**Goal**: Establish the Magic UI integration pattern and replace the abandoned plagiarized template at `/` with an empty, production-ready route shell that all subsequent phases compose into.
**Depends on**: Nothing (first phase)
**Requirements**: (no v1 requirement maps directly — this is enabling infrastructure for all phases below; success is measured by what the next phase can build on)
**Success Criteria** (what must be TRUE):
  1. Visitor at `/` sees a clean, intentionally-empty marketing route (not the plagiarized AS template) with the existing dark-mode design tokens applied
  2. At least one Magic UI primitive is installed, vetted to feel native to the Raycast aesthetic (6% borders, GlassPanel pattern, Inter font), and exported through a documented integration path
  3. A documented vetting checklist exists for selectively importing Magic UI / Aceternity / Origin UI / Cult UI components without breaking the Raycast design language
  4. The route renders without console errors and without React hydration warnings on first load
**Plans**: TBD
**UI hint**: yes

### Phase 2: Hero & Trust Band (Above-Fold)
**Goal**: A visitor lands at `/` and immediately sees a production-quality above-fold hero with brand stance, dual CTAs, and a social-proof band — all rendering on initial paint with no layout shift.
**Depends on**: Phase 1
**Requirements**: HERO-01, HERO-02, HERO-03, HERO-04, HERO-05, TRUST-01, TRUST-02
**Success Criteria** (what must be TRUE):
  1. Visitor lands at `/` and sees an above-fold hero with eyebrow (`VIRTUNA · A NUMEN MACHINES PRODUCT`), H1, subhead, primary CTA "Sign up free" routing to signup/onboarding, and a soft secondary option (no second primary)
  2. Hero visual renders as layered UI fragments on a dark gradient (Raycast-style floating UI tiles) with subtle CSS-only motion on scroll/hover — never maximalist beams or neon glow
  3. Immediately below the hero, a social-proof band shows creator count, press logos, or "trusted by N" framing (placeholder content acceptable but flagged in code with a `TODO: replace before public launch` marker)
  4. H1 and any brand-spine sentence in the hero contain neither "viral" nor "AI"
  5. Above-fold renders on initial paint with no layout shift and no console errors
**Plans**: TBD
**UI hint**: yes

### Phase 3: Three Surfaces Bento
**Goal**: A visitor scrolling past the hero immediately understands Virtuna's three product surfaces (Prediction, Competitor Intelligence, Brand Deals) through a bento with embedded visuals — replacing the anti-patterned "screenshot dump" approach.
**Depends on**: Phase 2
**Requirements**: SURF-01, SURF-02, SURF-03, SURF-04
**Success Criteria** (what must be TRUE):
  1. Visitor sees a bento section with three tiles — Prediction, Competitor Intelligence, Brand Deals — each with name, one-line value prop, and an embedded visual (screenshot fragment, abstract viz, or mock UI) inside the tile
  2. Each tile is interactive — clicking or activating it routes or scrolls to a deeper explanation (later section, deferred page, or stub)
  3. On mobile, tiles stack vertically in a single column with no horizontal carousel and no horizontal overflow
  4. No standalone screenshot-dump section exists elsewhere on the page — every product visual lives embedded in a feature/surface tile
**Plans**: TBD
**UI hint**: yes

### Phase 4: How It Works + The Science
**Goal**: A visitor understands both *how* the prediction engine works and *why* it's defensible — through a numbered engine pipeline and a chronological behavioral-research timeline that reads to non-technical creators while still satisfying investor scrutiny.
**Depends on**: Phase 3
**Requirements**: PIPE-01, PIPE-02, PIPE-03, SCI-01, SCI-02, SCI-03
**Success Criteria** (what must be TRUE):
  1. Visitor sees a "How it works" section presenting the prediction engine pipeline as a numbered sequence (Linear "1.0 → 5.0" pattern) where each step has a name, one-line description, and a small visual or icon
  2. Pipeline steps reveal with subtle scroll-triggered or in-view motion in the Linear/Vercel idiom — never maximalist beams or neon glow
  3. Visitor sees a "Science" section presenting the behavioral-research moat as a chronological timeline (ElevenLabs pattern) with at least 3 milestones, citation chips, and dataset stats
  4. The Science section is comprehensible to a non-technical creator on a first read while still surviving investor/press scrutiny
**Plans**: TBD
**UI hint**: yes

### Phase 5: Audience Tabs + Social Proof
**Goal**: A visitor sees Virtuna positioned for both creators and investors/press through audience tabs, then validates the claim through a 3-up testimonial grid and platform metrics — without a single carousel.
**Depends on**: Phase 4
**Requirements**: AUD-01, AUD-02, AUD-03, PROOF-01, PROOF-02, PROOF-03
**Success Criteria** (what must be TRUE):
  1. Visitor sees an audience-tab section with at least 2 tabs (e.g., "For creators" and "For investors/press"), each presenting 2-4 statements/value props relevant to that audience
  2. Tab interaction is keyboard accessible (arrow keys + tab navigation) and announces tab changes to screen readers
  3. Visitor sees a static 3-up testimonial grid (no carousel) with creator name, handle, avatar, and quote per testimonial — placeholder content acceptable but flagged in code for replacement before public launch
  4. Visitor sees accuracy or platform metrics (e.g., predictions made, accuracy %, creators served) alongside the testimonials
**Plans**: TBD
**UI hint**: yes

### Phase 6: Tool Consolidation Calculator + Pricing
**Goal**: A visitor uses an interactive savings calculator to see how Virtuna replaces N tools and saves $X/mo, then flows visually (not just via a button) into Starter/Pro pricing where they can act on that savings.
**Depends on**: Phase 5
**Requirements**: CALC-01, CALC-02, CALC-03, CALC-04, PRICE-01, PRICE-02, PRICE-03, PRICE-04
**Success Criteria** (what must be TRUE):
  1. Visitor sees an interactive widget with sensible defaults producing a meaningful "Virtuna replaces N tools, saves $X/mo" headline on first paint, before any interaction
  2. Visitor can toggle which competitor tools they currently pay for (competitor analyzer, hashtag tool, viral predictor, etc.) and the savings number updates live
  3. The calculated savings carries forward visually into the pricing section (continuity — not just a "Go to pricing" button)
  4. Visitor sees a Starter and Pro pricing section side-by-side with price, key features, and a tier-appropriate CTA per tier; the Pro tier explicitly surfaces the 7-day trial offer
  5. Pricing CTAs route to the existing Whop checkout / signup flow already shipped in prior milestones
**Plans**: TBD
**UI hint**: yes

### Phase 7: FAQ + Final CTA + Footer
**Goal**: A visitor reaching the bottom of the page has objections answered, sees a final closing CTA, and lands on a Numen Machines-branded footer that grounds Virtuna inside the parent lab.
**Depends on**: Phase 6
**Requirements**: FAQ-01, FAQ-02, FAQ-03
**Success Criteria** (what must be TRUE):
  1. Visitor sees a FAQ section with 5-8 collapsible questions, each answered in 1-3 sentences, with keyboard-accessible expand/collapse
  2. Visitor sees a final CTA card that repeats the primary CTA from the hero in a closing-block treatment
  3. Visitor sees a footer with Numen Machines parent-brand lockup, key navigation links, social links, and legal links
**Plans**: TBD
**UI hint**: yes

### Phase 8: Copy Finalization + System Hardening
**Goal**: Every customer-facing word on `/` is original and the brand-spine sentence is finalized; the page passes mobile responsiveness, WCAG AA contrast, console-clean rendering, and Lighthouse performance bars across all 10 sections.
**Depends on**: Phase 7
**Requirements**: COPY-01, COPY-02, SYS-01, SYS-02, SYS-03, SYS-04
**Success Criteria** (what must be TRUE):
  1. A grep/audit of `/` content confirms zero plagiarized Artificial Societies copy across all 10 sections — every customer-facing word is original
  2. The brand-spine sentence (the replacement for v3.0's "Your audience, simulated") is finalized and propagated consistently across the hero, final CTA, and footer area
  3. The page is fully responsive — single-column stack on mobile across all 10 sections, visual hierarchy preserved, zero horizontal overflow
  4. The page passes WCAG AA contrast (≥ 4.5:1 body text, ≥ 3:1 large text) on all text/background combinations, verified with `wcag-contrast` or equivalent
  5. The page renders without console errors and without React hydration warnings, and Lighthouse scores ≥ 90 desktop / ≥ 80 mobile with LCP < 2.5s on a fast 4G profile
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Route Scaffolding | 0/0 | Not started | - |
| 2. Hero & Trust Band (Above-Fold) | 0/0 | Not started | - |
| 3. Three Surfaces Bento | 0/0 | Not started | - |
| 4. How It Works + The Science | 0/0 | Not started | - |
| 5. Audience Tabs + Social Proof | 0/0 | Not started | - |
| 6. Tool Consolidation Calculator + Pricing | 0/0 | Not started | - |
| 7. FAQ + Final CTA + Footer | 0/0 | Not started | - |
| 8. Copy Finalization + System Hardening | 0/0 | Not started | - |

## Coverage Validation

All 36 milestone requirements mapped to exactly one phase. No orphans, no duplicates.

| Category | Count | Phase |
|----------|-------|-------|
| HERO | 5 | Phase 2 |
| TRUST | 2 | Phase 2 |
| SURF | 4 | Phase 3 |
| PIPE | 3 | Phase 4 |
| SCI | 3 | Phase 4 |
| AUD | 3 | Phase 5 |
| PROOF | 3 | Phase 5 |
| CALC | 4 | Phase 6 |
| PRICE | 4 | Phase 6 |
| FAQ | 3 | Phase 7 |
| COPY | 2 | Phase 8 |
| SYS | 4 | Phase 8 |
| **Total** | **36** | **8 phases** |

Phase 1 is enabling infrastructure (no requirement maps directly) — it exists to establish the Magic UI integration pattern and route scaffolding that every later phase depends on. Without it, Phase 2 cannot ship a hero on a clean route.

---
*Roadmap created: 2026-05-11*
