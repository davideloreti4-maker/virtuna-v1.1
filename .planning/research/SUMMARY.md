# Project Research Summary

**Project:** Virtuna — Linear Landing Clone
**Domain:** Single-page SaaS marketing landing (creator-tool / AI-prediction vertical)
**Researched:** 2026-05-19
**Confidence:** HIGH

---

## Executive Summary

This is the third landing milestone for Virtuna. The first two were abandoned — one before shipping (composition felt too derivative of societies.io), one after two phases (viewport aesthetic still 90% template-derived). Research confirms both failures shared the same root cause: visual composition was driven by the reference site's spatial logic rather than by Virtuna's own product narrative. The fundamental fix is architectural and process-level: every section must have a written Virtuna-product-narrative rationale before markup begins, and that rationale must stand on its own without referencing what the craft reference does in the same position. linear.app is a quality bar, not a blueprint.

The recommended build approach is RSC-first with thin client islands, a route-scoped landing.css token layer that never touches @theme, and LazyMotion + m.* components throughout. The existing 36-component design system and 7 motion primitives are the correct foundation — no net-new animation library is needed. Two packages are added: lenis 1.3.23 for scroll smoothness and @next/bundle-analyzer 16.2.6 as a dev tool. Every other improvement is configuration: opsz axis on Inter, fluid clamp() type scale in landing.css, AVIF images in next.config.ts, and LazyMotion replacing unconstrained motion.* usage in the landing bundle. Total new JS on the critical path: ~40KB gzipped (Lenis only).

Three categories of risk dominate. First, derivative composition: structural cloning kills this milestone the same way it killed the prior two. Prevention is a written section brief per section before any markup. Second, production build traps: oklch dark tokens compile wrong, backdrop-filter is silently stripped by Lightning CSS, and motion.div initial={{ opacity: 0 }} on the hero LCP element tanks mobile Lighthouse. All three are documented CLAUDE.md gotchas and must be enforced as Phase 1 gates, not discovered during QA. Third, scope drift: the landing route is self-contained. No dashboard component is modified. git diff --name-only scoped to landing files is a hard gate at the end of every phase.

---

## Key Findings

### Stack Additions (from STACK.md)

The existing stack (Next.js 16.1.5 / React 19 / Tailwind v4 / motion 12.34.0 / shadcn) already has everything needed. Two new packages only:

**New runtime dep:**
- lenis 1.3.23 — physics-based smooth scroll scoped to the (marketing) layout only; ~40KB gzipped; no replacement preserves CSS position: sticky correctly on Firefox

**New dev dep:**
- @next/bundle-analyzer 16.2.6 — run before every phase ships; ANALYZE=true pnpm build

**Configuration changes (zero new deps):**
- LazyMotion + m.* pattern replaces direct motion.* in landing components — cuts initial motion payload from 34KB to 4.6KB gzipped; domAnimation features load async at +15KB
- axes: ['opsz'] added to next/font Inter declaration — optical sizing at display scale
- Fluid type scale via CSS clamp() tokens in landing.css — --font-size-display: clamp(2.5rem, 1.4rem + 4.5vw, 5.5rem) through --font-size-body-lg
- images.formats: ['image/avif', 'image/webp'] in next.config.ts — free LCP win, no JS cost

**Explicit anti-features (do not add):**
- GSAP — 250KB gzipped; motion/react covers all animation patterns needed
- R3F / Three.js in landing route — 580KB gzipped; Spline (already installed, lazy-loaded) is the correct decorative 3D path
- Lottie — 60-80KB; CSS + motion/react covers all landing animation needs
- AOS / ScrollReveal — conflicts with the existing DS motion system

**JS budget target:** hero critical path under 200KB gzipped; motion features deferred async via LazyMotion; Spline scene lazy-mounted below fold via next/dynamic with CSS fallback.

---

### Section Features (from FEATURES.md)

Section composition follows Virtuna's product narrative arc, not Linear's section order.

**Must have (P1 — blocks launch):**
- Sticky nav: transparent at top, dark + backdrop-blur after 80px scroll, anchor links, CTA always visible
- Hero: eyebrow badge + H1 (display weight, 8 words max) + subheadline + dual CTA; product screenshot or visual; social proof micro-claim below CTA
- Feature bento: mixed-size grid — 2x2 flagship for Prediction, 1x1 for Competitor Intel and Brand Deals; product UI fragments as visuals; staggered scroll-reveal
- How it works: scroll-pinned two-panel (step cards scroll left, pinned UI preview transitions right); 3 steps matching Virtuna's actual flow — input → analysis → results
- Pricing: Starter/Pro two-card layout with monthly/annual toggle; Most Popular badge; trial language on CTA; collapsible comparison table; 4-6 item FAQ accordion on same page
- Final CTA row + minimal footer: full-width headline + CTA; logo + legal links + social icons

**Should have (P2):**
- Testimonial cards: 2-3 with real attribution; outcome-specific quotes
- Stat counters: 2-4 bold numbers with count-up animation; only credible if above ~1,000
- Floating mobile CTA bar: appears after hero scroll, hides near pricing

**Defer (out of scope):**
- Live prediction demo widget (API feasibility unknown; fake spinner not acceptable)
- Video testimonials (content dependency)
- Theme toggle (light mode deferred)
- Logo strip (only if recognizable brands exist)

**Cross-cutting interaction standard:**
- All scroll reveals: opacity 0-1 + translateY 16px-0, whileInView fires once (viewport once: true)
- Stagger: 60-80ms between siblings
- Animate only transform and opacity — never margin, height, width
- prefers-reduced-motion respected on every animated element

---

### Architecture Decisions (from ARCHITECTURE.md)

**Token scope — landing.css strategy (non-negotiable):**
All landing-specific tokens live in src/app/(marketing)/landing.css as plain CSS custom properties under :root — NOT in @theme. @theme remains Raycast-accurate and dashboard-only. Dark surface tokens must use hex, not oklch (Tailwind v4 compilation inaccuracy at L < 0.15). Token families: --landing-text-display-*, --landing-ease-*, --landing-gradient-*, --landing-section-gap (140px desktop / 80px mobile).

**RSC-first with thin client islands:**
- (marketing)/page.tsx: RSC
- LandingNav: Client island (scroll listener for opacity/backdrop transition)
- Hero shell + CTA: RSC (Button as a/Link)
- Hero animated elements: Client island wrapping only the moving element
- Feature bento cards: RSC (hover via CSS)
- PricingSection: RSC (Whop CTA is a plain a)
- LandingFAQAccordion: Client island (Radix Accordion)
- HivePreview: Client island, lazy-mounted via next/dynamic + useInView
- CTA section, Footer: RSC

**MotionWrapper pattern (enforced from Phase 1):** Section files are RSC; only the animating leaf element needs a client wrapper. Never use client on a full section file. Use existing DS primitives (FadeInUp, StaggerReveal, HoverScale) — extend via props, do not fork.

**Scroll architecture:**
- Section reveals: whileInView + viewport once: true, margin: -80px via FadeInUp and StaggerReveal
- Nav + scroll progress bar: single useScrollProgress hook (RAF-throttled)
- Sticky how-it-works copy panel: CSS position: sticky + align-self: start — pure RSC
- HivePreview: next/dynamic (ssr: false) + useInView with rootMargin: 200px; CSS skeleton while loading

**Visual fidelity harness at verification/scripts/visual-comparison.spec.ts (already exists):**
Three viewports configured: 1440x900, 768x1024, 375x812 with reducedMotion: reduce. Update PAGES array in Phase 1 with new data-section selectors. Craft gate is rubric-based, NOT pixel-match against reference site.

**Component inventory:**
- Reuse as-is: Button, GlassPanel, FadeIn, FadeInUp, StaggerReveal, HoverScale, NoiseTexture
- Fork with landing- prefix: LandingFeatureCard (larger padding, gradient border), LandingFAQAccordion, LandingNav
- Rebuild content only: hero-section, features-section, faq-section, cta-section, social-proof-section
- Delete (societies.io artifacts): backers-section, case-study-section, partnership-section, persona-card, comparison-chart
- New: scroll-progress, social-proof-ticker, pricing-section, product-feature-section, hive-preview, moat-section

---

### Critical Pitfalls (from PITFALLS.md)

**1. Derivative composition — killed prior two milestones**
Written Virtuna-product-narrative section brief required before any markup. Brief must answer why this section exists here from the product story alone. Recovery from a derivative section is NOT iteration on the same composition — revert to blank and re-derive. Detecting derivative-feel late is HIGH-cost recovery.

**2. Lightning CSS strips backdrop-filter in production builds**
Documented in CLAUDE.md. All glassmorphic effects must use React inline styles: style={{ backdropFilter: 'blur(12px)' }}, never backdrop-blur-* Tailwind classes. Gate: next build && next start smoke test before Phase 1 closes.

**3. oklch dark token compilation inaccuracy**
Documented in CLAUDE.md. All tokens at L < 0.15 must use hex. Verify visually in both Chrome and Safari.

**4. LCP regression from JS-driven hero animation**
motion.div initial={{ opacity: 0 }} on the H1 makes the LCP element invisible until hydration. Use CSS animations for hero entry. Gate: Lighthouse mobile LCP < 2.5s before hero phase closes.

**5. Scope drift into in-app surfaces**
Hard rule: git diff --name-only at end of each phase must show only (marketing)/ route files and landing-specific component/token paths. Any dashboard route file in the diff is a scope violation — stop and revert.

**Additional gates from Phase 1:**
- CLS from images without dimensions — Lighthouse CLS < 0.1 gate per section phase
- SSR hydration mismatch — MotionWrapper pattern established in Phase 1
- Mobile-last development — Playwright 375px + 768px snapshots required per phase
- Token leakage — dashboard Playwright regression snapshot after Phase 1 ships

---

## Implications for Roadmap

### Phase 1: Foundation + Cross-Cutting Gates

**Rationale:** All Phase 1 deliverables are prerequisites for every other phase. Token layer must exist before section components reference its vars. Motion patterns must be established before animated sections ship. Craft rubric and section brief process must be agreed before composition decisions are made. Front-loading these guardrails is the specific change from the prior two failed attempts.

**Delivers:**
- src/app/(marketing)/landing.css — token families defined, dark values in hex, import chain confirmed
- (marketing)/layout.tsx updated — LenisProvider, WebVitals, imports landing.css
- LandingNav — scroll-aware sticky, backdropFilter inline style, transparent-to-dark transition
- useScrollProgress hook — RAF-throttled, single subscriber
- ScrollProgressIndicator — thin coral scaleX progress bar
- MotionWrapper pattern documented + reference implementation committed
- verification/scripts/visual-comparison.spec.ts updated with new PAGES array and data-section selectors
- Craft quality rubric written (typography / spacing / motion / mobile / polish)
- Production build smoke test passing (next build && next start)
- Dashboard Playwright regression snapshot baseline confirmed
- pnpm add lenis + pnpm add -D @next/bundle-analyzer installed
- AVIF image config in next.config.ts; axes: ['opsz'] in Inter font declaration
- Fluid type scale tokens in landing.css

**Gates:** Production build smoke test; dashboard regression snapshot; no oklch dark tokens; no backdrop-blur-* classes

**Research flags:** Standard patterns — skip research-phase.

---

### Phase 2: Nav + Hero

**Rationale:** Hero is the LCP element and primary conversion surface. Must ship before downstream sections so LCP is measured early. Highest derivative-feel risk — section brief discipline established here first.

**Delivers:**
- Hero section: Virtuna eyebrow badge + H1 + subheadline + dual CTA + product screenshot or Spline orb (lazy-loaded, CSS fallback)
- Social proof micro-claim below CTA (real stat, not placeholder)
- CSS-based hero entry animation — H1 paint-visible pre-hydration
- Playwright snapshots at 375px, 768px, 1280px

**Gates:** Lighthouse mobile LCP < 2.5s; Lighthouse CLS < 0.1; section brief written pre-markup; scope diff clean

**Research flags:** Standard patterns — skip research-phase.

---

### Phase 3: Feature Bento

**Rationale:** Communicates product surface area to evaluating visitors. Depends on Phase 1 tokens and motion primitives. No dependency on hero content.

**Delivers:**
- LandingFeatureCard fork — 80px vertical padding, gradient border, correct hover
- Bento grid: 2x2 Prediction flagship + 1x1 Competitor Intel + 1x1 Brand Deals; product UI fragments as visuals
- StaggerReveal on card group entry, 60-80ms stagger
- Playwright snapshots at 375px, 768px, 1280px

**Gates:** Card visuals are product UI captures; section brief reviewed; scope diff clean; CLS < 0.1

**Research flags:** Standard patterns — skip research-phase.

---

### Phase 4: How It Works

**Rationale:** Scroll-pinned walkthrough is the highest-craft-signal section and the clearest vehicle for Virtuna's 3-step flow. HivePreview anchors product reality claim.

**Delivers:**
- ProductFeatureSection: CSS sticky-copy layout; step cards scroll, pinned UI preview panel crossfades
- 3 steps mapping to Virtuna's actual flow; useScroll + useTransform composited transitions
- HivePreview: next/dynamic + useInView trigger, CSS skeleton placeholder
- Playwright snapshots at 375px, 768px, 1280px

**Gates:** No layout-affecting CSS animated during scroll (Chrome DevTools Performance verified); CLS < 0.1; scope diff clean

**Research flags:** Documented Framer Motion pattern — skip research-phase.

---

### Phase 5: Social Proof

**Rationale:** P2 feature — amplifies product case. Has content dependency (real testimonials) that must be available before phase starts. Placeholder content is not acceptable.

**Delivers:**
- 2-3 testimonial cards: real attribution (name + handle + avatar), GlassPanel + FadeInUp
- Stat counters: 2-4 real numbers with count-up animation on whileInView entry
- SocialProofTicker marquee — client island, pause-on-hover
- Playwright snapshots at 375px, 768px, 1280px

**Content dependency:** Real testimonials and stat numbers must be confirmed before phase starts.

**Gates:** All testimonials have real attribution; stats real and above 1,000; CLS < 0.1; scope diff clean

**Research flags:** Standard patterns — skip research-phase.

---

### Phase 6: Pricing + Footer

**Rationale:** Final conversion step with Whop plan ID operational dependency. Footer is minimal. Grouped as final content phase in the narrative order.

**Delivers:**
- PricingSection: Starter/Pro two-card layout, monthly/annual toggle with savings callout, Most Popular badge, trial note, Whop CTA links
- Collapsible feature comparison table (collapsed by default)
- LandingFAQAccordion: 4-6 items, Radix Accordion, Virtuna-specific FAQ copy
- Final CTA row: Start predicting + primary CTA
- Minimal footer: logo + Privacy/Terms/Cookie links + social icons + dynamic copyright year
- Playwright snapshots at 375px, 768px, 1280px

**Operational blocker:** Whop plan IDs must be created in Whop dashboard. If unavailable, CTA links are # stubs with a comment marking them.

**Gates:** Annual toggle works; FAQ covers trial/cancellation accurately; no locked feature icons; CLS < 0.1; scope diff clean

**Research flags:** Whop plan ID creation is an open operational task — confirm before phase starts.

---

### Phase 7: Motion Polish + Cross-Browser QA

**Rationale:** Formal craft rubric review across all sections. Per-section quality checks happen in each phase; Phase 7 is holistic tuning and sign-off. The milestone failed twice for accepting visual quality below the production bar.

**Delivers:**
- Sticky nav transition timing calibration; backdrop-blur verified in production build
- Floating mobile CTA bar
- prefers-reduced-motion formal audit; verified in iOS Safari simulator
- MoatSection (behavioral science differentiator) — if confirmed in scope
- Cross-browser verification: Safari (oklch, backdrop-filter), Firefox (Lenis scroll)
- Final full-page Playwright snapshots — all three viewports, all sections
- Bundle analyzer run: verify JS budget
- Craft rubric review: every section scored against typography / spacing / motion / mobile / polish
- WCAG contrast audit

**Gates:** Mobile LCP < 2.5s; CLS < 0.1; no console hydration errors; no backdrop-blur-* classes; craft rubric approved; bundle within target; scope diff clean

**Research flags:** Standard patterns — skip research-phase.

---

### Phase Ordering Rationale

- Phase 1 before everything: establishes guardrails (token scope, motion pattern, rubric, section brief process) absent when prior milestones failed
- Hero before downstream sections: LCP measured early; derivative-feel risk highest here; section brief discipline established on hardest section first
- Feature bento before how-it-works: introduces product surfaces; walkthrough deepens them — narrative arc dependency
- Social proof after product sections: amplifies established product case; content dependency requires lead time
- Pricing last among content phases: Whop plan ID dependency; revenue risk if shipped with stub links
- Polish phase always last: per-section quality check happens in every phase; Phase 7 is holistic tuning and formal sign-off

---

### Research Flags

**Phases with standard patterns — skip research-phase:**
All phases (1-7) use well-documented frameworks and established codebase patterns.

**Phases with open questions to resolve before/during planning:**
- Phase 6 (Pricing): Whop plan ID creation is an operational blocker

---

## Open Questions to Resolve Before/During Requirements

1. **Live demo feasibility:** Is a real API call viable on a public landing route, or is a credible demo-mode response acceptable? Fake spinner is explicitly not acceptable; absence is better.

2. **Whop plan IDs:** Confirm plan IDs are created or agree on stub behavior for launch.

3. **Hero entry animation strategy:** CSS animation on hero text (fires pre-hydration, no LCP cost) vs static H1 with only supporting elements animated. Recommendation: CSS animation.

4. **Hero visual — Spline vs product screenshot:** Product UI screenshot outperforms abstract 3D for creator-tool conversion (ranked #1 vs #3 in feature research). Decision needed.

5. **Testimonial content availability:** 2-3 real creator quotes with name, handle, avatar required for Phase 5. Confirm availability before requirements lock; otherwise Phase 5 ships as stat counters only.

6. **Behavioral science moat section scope:** Confirm in or out during requirements definition; needs section brief before Phase 7 if included.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Fully grounded in live codebase analysis + Context7 official docs for motion, lenis, next.js |
| Features | HIGH | Cross-verified: SaaSFrame, Mantlr, Eleken, Webstacks + direct craft reference analysis |
| Architecture | HIGH | Direct codebase analysis of existing files; all decisions grounded in actual code paths |
| Pitfalls | HIGH | Grounded in this project's actual failure history (2 prior abandoned milestones) + CLAUDE.md documented gotchas + verified technical sources |

**Overall confidence: HIGH**

### Gaps to Address

- **Whop plan IDs:** Operational dependency. Must be resolved before Phase 6 ships with live checkout.
- **Live demo API feasibility:** Engineering decision with unknown backend complexity. Needs a spike or decision call before requirements lock.
- **Testimonial content:** Must come from Davide or beta user cohort.
- **Moat section scope:** Confirm in or out during requirements definition.

---

## Sources

### Primary (HIGH confidence)

- Direct codebase analysis: src/app/globals.css, src/components/landing/ (14 files), src/components/motion/, verification/scripts/visual-comparison.spec.ts, src/app/(marketing)/layout.tsx
- Context7: /grx7/framer-motion — LazyMotion, scroll hooks, whileInView patterns
- Context7: /darkroomengineering/lenis — ReactLenis Next.js App Router integration
- Context7: /vercel/next.js — next/font variable axes, image formats, useReportWebVitals, bundle analyzer
- motion.dev docs: Reduce bundle size, LazyMotion 4.6KB vs 34KB
- npm registry: lenis 1.3.23, @next/bundle-analyzer 16.2.6
- MDN: font-optical-sizing, opsz variable font axis
- .planning/MILESTONES.md and .planning/PROJECT.md — prior milestone failure history

### Secondary (HIGH confidence)

- SaaSFrame: bento grid patterns, SaaS landing trends 2026
- Mantlr: how Stripe, Linear, Vercel ship premium UI
- Webstacks: SaaS pricing page design
- Eleken: footer UX patterns 2026
- 925 Studios: AI slop web design anti-patterns 2026

### Technical references (HIGH confidence)

- GitHub tailwindcss/tailwindcss #16351 and #15356 — oklch browser compatibility
- nextjs.org/docs/messages/react-hydration-error
- cloudfour.com / debugbear.com — LCP from lazy-loaded hero images
- sentry.io / vercel.com — CLS from font-display swap

---

*Research completed: 2026-05-19*
*Ready for roadmap: yes*
