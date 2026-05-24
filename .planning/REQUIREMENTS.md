# Requirements: Landing v1

**Defined:** 2026-05-24
**Milestone:** Landing v1
**Goal:** Ship a high-end SaaS-style animated landing page that converts TikTok creators AND impresses investors. Linear/Raycast-anchored aesthetic with OpusClip-grade conversion copy patterns. Replaces live landing page at root when shipped.

**Reference set:** Linear + Raycast (visual anchor) · OpusClip (copy/conversion patterns, NOT aesthetic).

**Stack core:** Magic UI + Framer Motion (motion.dev) + Aceternity UI + shadcn.
**Palette (on-demand):** GSAP ScrollTrigger, R3F, Spline (hero — locked in), tsParticles.
**Out:** Cult UI (off-brief), Lottie, Rive.

---

## v1 Requirements

### Foundation & Scaffold (FOUND)

- [ ] **FOUND-01**: Landing v1 builds at staging route `/v3` (file: `src/app/(marketing)/v3/page.tsx`) — live `(marketing)/page.tsx` untouched until cutover
- [ ] **FOUND-02**: `(marketing)/layout.tsx` duplicate `<html>/<body>` bug fixed and "Artificial Societies" stale title replaced with Virtuna metadata
- [ ] **FOUND-03**: `pnpm.overrides` aliases `framer-motion` to `motion@^12.29.2` — single animation runtime across whole bundle
- [ ] **FOUND-04**: Magic UI + Aceternity UI core components installed via shadcn CLI per-component (no npm package adds for component layer)
- [ ] **FOUND-05**: Pre-install collision check — verify `src/components/ui/marquee.tsx` and `src/hooks/useCountUp.ts` do not conflict with Magic UI Marquee + NumberTicker before install
- [ ] **FOUND-06**: `_components/` (route-private section components) and `_data/` (demo samples, science citations) directories created under `(marketing)/v3/`
- [ ] **FOUND-07**: `public/landing/placeholders/` directory established for non-final platform screenshots/videos
- [ ] **FOUND-08**: `LandingHeader.tsx` with anchor links to all 9 sections (smooth-scroll), "Sign in" link to `/login` for returning users, and "Sign up" CTA — above-fold navigation discoverability
- [ ] **FOUND-09**: Page-root `MotionConfig reducedMotion="user"` wraps all section components — single kill-switch for motion
- [ ] **FOUND-10**: `sitemap.ts` and `robots.ts` added (both currently missing) — production SEO baseline

### Hero (HERO)

- [ ] **HERO-01**: User sees H1 + sub-headline + dual CTA above-fold on desktop (1440px) and mobile (375px), no scroll required for headline
- [ ] **HERO-02**: H1 follows OpusClip-style outcome-pattern ("AI that…" or equivalent verb-first promise) — final copy iterable, position locked
- [ ] **HERO-03**: Primary CTA links to demo section anchor (`#demo`) or sign-up flow (configurable); secondary CTA links to pricing anchor (`#pricing`)
- [ ] **HERO-04**: Aceternity `Spotlight` ambient backdrop renders with coral-tinted single-stop alpha gradient (no multi-hue) — coral brand color preserved
- [ ] **HERO-05**: Spline 3D hero scene loaded lazily via `dynamic({ ssr: false })` + IntersectionObserver gate; static fallback poster image rendered for LCP and reduced-motion
- [ ] **HERO-06**: Magic UI `ShimmerButton` + `AnimatedShinyText` + `BorderBeam` shared with Final CTA — bookend pattern locked
- [ ] **HERO-07**: Hero respects `prefers-reduced-motion`: Spline scene skipped, static poster shown, button shimmer disabled
- [ ] **HERO-08**: Hero uses `100dvh` (not `100vh`) for full-viewport height — iOS Safari address bar fix
- [ ] **HERO-09**: H1 features a typography reveal — Magic UI `WordRotate` or `FlipWords` cycles a single word position through audience targets (e.g. "creators / brands / agencies") demonstrating multi-audience positioning. Reduced-motion variant uses static text
- [ ] **HERO-10**: Above-fold credibility hook between H1 and Spline scene — thin logo bar (Numen Machines lockup + 4-5 partner/early-backer slots, placeholder allowed) + "Backed by [behavioral research / Numen Machines]" microcopy. Visible without scroll on 1440px desktop and 375px mobile
- [ ] **HERO-11**: Reading order verified — H1 → microcopy → CTAs → Spline scene. Screen reader announces credibility hook before visual loads

### Interactive Demo (DEMO)

- [ ] **DEMO-01**: User picks from 3-4 sample TikTok cards (e.g. niche-tagged samples) — picker is server-rendered and ready ≤ 200ms after section enters viewport
- [ ] **DEMO-02**: On selection, scripted MultiStepLoader animates 4 stages mirroring Virtuna's engine pipeline (e.g. "Reading content → Scoring signals → Comparing benchmarks → Confidence emerging")
- [ ] **DEMO-03**: After loader, animated result reveal shows: predicted score (NumberTicker), top behavioral signals (AnimatedList), confidence band (CardStack or BoxReveal)
- [ ] **DEMO-04**: Reset CTA returns user to picker — user can run demo on every sample sequentially
- [ ] **DEMO-05**: Demo is keyboard-accessible (Tab navigates picker, Enter selects, focus visible) with `aria-live` announcing stage progress
- [ ] **DEMO-06**: Reduced-motion variant skips MultiStepLoader animation, shows result immediately
- [ ] **DEMO-07**: Demo state lives in local `useReducer` (no Zustand, no URL params); demo chunk pre-fetches on hero CTA hover
- [ ] **DEMO-08**: All sample TikTok references use fictional `@samplecreator` handles (no real creator content) — brand/legal safety
- [ ] **DEMO-09**: Subtle cursor-following micro-signal effect during result reveal via Aceternity `FollowingPointer` — particle/dot trail illustrates "audience as simulation" metaphor literally. Reduced-motion variant disables effect. Disabled on touch devices
- [ ] **DEMO-10**: Sample TikTok preview rendered inside Magic UI `Iphone15Pro` mockup frame during result reveal — frames mocked content in a real phone for premium SaaS aesthetic

### How It Works (HOW)

- [ ] **HOW-01**: User scrolls into pipeline section, sees 4-stage engine flow with stage labels (outcome-words, not jargon) connecting input → output
- [ ] **HOW-02**: Desktop (`lg+`): Magic UI `AnimatedBeam` horizontal pipeline animates one-shot on viewport entry — beams pulse once, do not loop (per BRAND-BIBLE VIZ-02 rule)
- [ ] **HOW-03**: Mobile (`<lg`): Aceternity `TracingBeam` vertical fallback replaces horizontal pipeline
- [ ] **HOW-04**: Reduced-motion variant: static pipeline diagram (no beam animation), all stages visible immediately
- [ ] **HOW-05**: Stage labels narratively bridge to Demo section above and Three Surfaces section below — copy reinforces narrative arc
- [ ] **HOW-06**: Magic UI `OrbitingCircles` render at each pipeline stage node — visualizes "signals orbiting" the engine; reduced-motion variant renders static positions
- [ ] **HOW-07**: GSAP ScrollTrigger pins the How It Works section as user scrolls — beam progress scrubs stage-by-stage tied to scroll position (desktop only). Reduced-motion and mobile fall back to one-shot animation per HOW-02 / HOW-03

### Three Surfaces Bento (BENTO)

- [ ] **BENTO-01**: User sees 3-card asymmetric BentoGrid (1 large Prediction + 2 smaller stacked: Competitor Intelligence + Brand Deals)
- [ ] **BENTO-02**: Each surface card has a live animated background (`Marquee` of relevant signals, `AnimatedList` of behavior signals, or coral `BorderBeam`) — distinguishes surfaces visually
- [ ] **BENTO-03**: Cards use CSS-only hover state (no MagicCard cursor-tracking) — avoids INP regression
- [ ] **BENTO-04**: Each card links to relevant in-app surface (gated behind auth — non-blocking for landing)
- [ ] **BENTO-05**: Mobile: single-column stack, each card retains animated background
- [ ] **BENTO-06**: Cards use ARIA roles (`role="article"` or appropriate) for screen-reader semantics
- [ ] **BENTO-07**: Aceternity `MacbookScroll` dashboard reveal section follows the Bento — user scrolls and the laptop frame scales/rotates in revealing a Virtuna dashboard screenshot (placeholder OK for v1). Reduced-motion variant shows static laptop frame with dashboard image; mobile (`<lg`) collapses to a static dashboard screenshot card

### Comparison vs Alternatives (CMP)

- [ ] **CMP-01**: User scrolls into comparison section (between Three Surfaces and Science), sees side-by-side comparison of Virtuna vs traditional creator analytics (TikTok Creative Center, Iconosquare-style tools, generic AI tools)
- [ ] **CMP-02**: Comparison framed positively — highlights Virtuna's differentiation (predictive vs reactive, audience-modeled vs raw stats, integrated brand deals + science moat), NOT logo-vs-logo attack
- [ ] **CMP-03**: Visual treatment uses minimal comparison table OR feature-chip grid with ✓/− icons; coral accent on Virtuna column
- [ ] **CMP-04**: Mobile (`<lg`): comparison stacks single-column with clear feature labels; no horizontal scroll
- [ ] **CMP-05**: Tone is confident and positioning-led — copy focuses on capability difference, never disparaging competitors
- [ ] **CMP-06**: Section reduced-motion variant: no animation on row reveals; all rows visible immediately
- [ ] **CMP-07**: Aceternity `Sparkles` subtle particle accent behind the Virtuna column / on checkmarks — distinguishes Virtuna positively without aggressive treatment

### The Science (SCI)

- [ ] **SCI-01**: User scrolls into Science section, sees Aceternity `StickyScroll` left rail (research steps) with sticky citation chips on right
- [ ] **SCI-02**: Citation chips reference REAL published behavioral research papers (candidate authors: BJ Fogg, Jonah Berger & Katherine Milkman, Robert Cialdini, Steve Krug) — researched and locked before phase ships
- [ ] **SCI-03**: Section displays 3 dataset stats via `NumberTicker` (e.g. videos analyzed, signals tracked, models trained) — stats are real or flagged `[projected]` honestly
- [ ] **SCI-04**: Mobile fallback: linear-flow citation list (no StickyScroll); reading order preserved
- [ ] **SCI-05**: Marquee citation band shows author + paper-year chips at bottom of section
- [ ] **SCI-06**: "Read more" CTA links to either a real Virtuna white paper (if exists) or a deferred-link state — no broken-link gestures
- [ ] **SCI-07**: Section reduced-motion variant: static citation chips, no marquee scroll
- [ ] **SCI-08**: Research narrative steps use Aceternity `TextGenerateEffect` (or Magic UI `TextRevealByWord`) — word-by-word reveal on scroll-in for research-paper-elegant pacing; reduced-motion variant shows complete text immediately
- [ ] **SCI-09**: Aceternity `Sparkles` backdrop behind citation chip cluster — subtle, low-density, dark-mode-safe

### Social Proof (PROOF)

- [ ] **PROOF-01**: User sees logo Marquee (2-row scrolling) with at minimum Numen Machines lockup highlighted via `BorderBeam` — additional partner/PR logos added as availability allows
- [ ] **PROOF-02**: Testimonials slot built as Aceternity `AnimatedTestimonials` component scaffold with "Coming soon — first 100 beta creators" placeholder copy; component shipped, content gated
- [ ] **PROOF-03**: 3-column metric bar shows projected-and-labeled stats (e.g. "Early Signal: X%", "Beta Cohort: Y") — every number honestly framed, no fake testimonials
- [ ] **PROOF-04**: Shared Aceternity `Spotlight` backdrop spans logos + testimonials + metric bar — fuses three sub-sections into one visual stack
- [ ] **PROOF-05**: All logos have alt text (logo name + Virtuna partner relation) for screen readers
- [ ] **PROOF-06**: When real testimonials become available (later milestone), `AnimatedTestimonials` populates without component refactor
- [ ] **PROOF-07**: Magic UI `AvatarCircles` cluster shows "X+ creators / partners" visual signal — clustered creator avatars with overflow indicator; uses placeholder avatars OK for v1
- [ ] **PROOF-08**: Magic UI `Globe` (cobe-powered) component visualizes "creators worldwide" — coral dots scattered on dark globe, slow rotation. Reduced-motion variant: static globe with dots, no rotation. Mobile: smaller globe or skip if performance budget tight

### Pricing (PRICE)

- [ ] **PRICE-01**: User sees 2-column shadcn Card pricing table (Starter / Pro) with monthly/yearly Tabs toggle ("Save up to X% yearly" OpusClip pattern)
- [ ] **PRICE-02**: Pro tier has Magic UI `BorderBeam` accent and ShimmerButton primary CTA — visually marked as recommended
- [ ] **PRICE-03**: 6-category feature checklist with ✓/− icons compares tiers — OpusClip-style density
- [ ] **PRICE-04**: Mobile pricing: tap-to-toggle tooltips on feature rows (no hover); both Cards stack single-column
- [ ] **PRICE-05**: Pricing $ amounts use clearly-marked placeholder (`$XX/mo`) — real prices locked during Phase 11 cutover (business decision gate)
- [ ] **PRICE-06**: FAQ accordion (shadcn Accordion) directly below pricing — 4-6 conversion-anchored Q&A; copy iterable
- [ ] **PRICE-07**: Primary CTA on each tier links to existing Whop checkout flow (no new payment infra)
- [ ] **PRICE-08**: Pro tier CTA uses Magic UI `AnimatedGradientText` for label — gradient sweep distinguishes the recommended tier without changing button shape
- [ ] **PRICE-09**: Magic UI `Confetti` animation triggers on Pro tier CTA click — coral-tinted, subtle, single burst (no looping). Reduced-motion variant skips the effect entirely

### Vision Beat (VISION)

- [ ] **VISION-01**: Brief founder vision beat appears between Pricing and Final CTA — 1-2 sentence quote attributed to founder name + role (e.g. "Davide Loreti, Founder, Virtuna"). Investor-targeted signal. Lightweight visual treatment, no photo required for v1

### Final CTA + Footer (CTA)

- [ ] **CTA-01**: Final CTA section mirrors Hero visually (same Spotlight + ShimmerButton + AnimatedShinyText) — bookend close pattern
- [ ] **CTA-02**: Final CTA copy mirrors Hero verbatim or paraphrases the same promise — does NOT introduce new positioning
- [ ] **CTA-03**: 4-column footer: product links, company, legal, social — server-rendered, no client JS
- [ ] **CTA-04**: Footer includes Numen Machines product lockup ("A Numen Machines product") with link
- [ ] **CTA-05**: Footer respects existing accessibility/contrast standards (WCAG AA, ≥ 4.5:1 on body text)
- [ ] **CTA-06**: Footer "Sign in" link present for returning users (mirrors header link)

### Cross-Cutting Motion Policy (MOTION)

- [ ] **MOTION-01**: All sections honor `prefers-reduced-motion` via `MotionConfig reducedMotion="user"` root + per-section verification of Aceternity components (which do not honor it natively)
- [ ] **MOTION-02**: No animation autoplays without user reaching viewport (IntersectionObserver gate or `whileInView`)
- [ ] **MOTION-03**: Coral (#FF7F50) used in motion only as single-stop alpha gradient — never multi-hue
- [ ] **MOTION-04**: All `backdrop-filter` and `mask-image` usages applied via inline `style={}` to bypass Lightning CSS stripping — verified on Vercel preview
- [ ] **MOTION-05**: All `oklch()` colors with L < 0.15 replaced with hex equivalents in `@theme inline` block — Tailwind v4 compilation accuracy

### SEO & Metadata (META)

- [ ] **META-01**: `<head>` meta description ≤ 160 chars referencing Virtuna's core value proposition and primary audience
- [ ] **META-02**: JSON-LD structured data for `SoftwareApplication` schema injected into page (`application/ld+json` script) — Google rich-result eligibility
- [ ] **META-03**: Open Graph image (`opengraph-image.tsx`) regenerated for Landing v1 — reflects new visual identity and locked H1 copy
- [ ] **META-04**: Twitter card meta tags configured (`summary_large_image`) with separate twitter-image if needed
- [ ] **META-05**: Canonical link tag set to production URL on the new landing page

### Analytics & Measurement (ANALYTICS)

- [ ] **ANALYTICS-01**: `@vercel/analytics` installed and `<Analytics />` mounted in root layout for the marketing route group
- [ ] **ANALYTICS-02**: `@vercel/speed-insights` installed for Core Web Vitals telemetry
- [ ] **ANALYTICS-03**: Key conversion events tracked via Vercel Analytics custom events: hero primary CTA click, hero secondary CTA click, demo sample selection (per sample), demo result reveal completion, pricing tier CTA click, final CTA click, sign-in link click
- [ ] **ANALYTICS-04**: Analytics respects DNT / consent; no PII captured

### Polish & Premium-Signal Layer (POLISH)

- [ ] **POLISH-01**: SVG grain noise overlay applied to dark background at low opacity (Linear/Raycast pattern) — static (reduced-motion safe), `pointer-events: none`
- [ ] **POLISH-02**: Scroll progress indicator — thin coral line (2-3px) at viewport top fills as user scrolls page length. Reduced-motion: static state at correct fill
- [ ] **POLISH-03**: Custom cursor styling on landing page — subtle coral-tinted cursor (e.g. coral outline ring on hover-interactive elements). Reverts to default cursor in `(app)/` routes. Disabled on touch devices (`pointer: coarse`)
- [ ] **POLISH-04**: Section dividers/transitions designed intentionally — alternating background tone shifts (e.g. `bg-background` vs `bg-background-elevated`) and/or subtle gradient/dot-pattern dividers between sections. Avoids "stacked boxes" feel
- [ ] **POLISH-05**: Secondary accent color defined and applied — neutral-warm complement to coral (e.g. warm gray or muted gold) used sparingly for non-coral accents (e.g. checkmarks in pricing, citation chip borders) — prevents over-coral monotony
- [ ] **POLISH-06**: Section H2s use Magic UI `TextAnimate` (or `HyperText`) for letter/word stagger reveal on scroll-in — consistent across all sections, reduced-motion variant renders static
- [ ] **POLISH-07**: Per-section motion choreography documented — stagger timing, scroll-trigger thresholds, exit animations — written as a shared `motionTokens.ts` constants file (`durations`, `easings`, `staggerDelays`, `viewportThresholds`) for cross-section consistency

### Performance, Accessibility, Mobile (PERF)

- [ ] **PERF-01**: Lighthouse Performance ≥ 90 on mobile (375px throttled 4G), measured against Vercel preview build
- [ ] **PERF-02**: LCP < 2.5s mobile (Spline scene must not block LCP — static poster covers fold)
- [ ] **PERF-03**: CLS < 0.1 across all 8 sections
- [ ] **PERF-04**: INP < 200ms on interactive elements (pricing toggle, demo picker, FAQ accordion)
- [ ] **PERF-05**: Mobile-responsive single-column stack across all 8 sections (375px verified)
- [ ] **PERF-06**: axe-core and pa11y CI checks clean — no critical or serious accessibility issues
- [ ] **PERF-07**: Lighthouse Accessibility ≥ 95 on the production landing page
- [ ] **PERF-08**: All animations skip on `prefers-reduced-motion: reduce` — verified manually via macOS / Chrome devtools
- [ ] **PERF-09**: Total landing-page motion JS ≤ 200 KB gzip (excluding lazy-loaded Spline chunk)
- [ ] **PERF-10**: Spline scene chunk is viewport-gated and does NOT count against initial bundle — bundle-analyzer verifies
- [ ] **PERF-11**: Skip-to-content link present at top of page (visually hidden until keyboard focus) — basic accessibility baseline
- [ ] **PERF-12**: Heading hierarchy verified — single H1, H2/H3 in nesting order, no level skips. axe-core gate enforces
- [ ] **PERF-13**: Document `<html lang="en">` set; page language declared

### Launch & Cutover (LAUNCH)

- [ ] **LAUNCH-01**: Davide reviews Vercel preview of `/v3` route before cutover — manual approval gate
- [ ] **LAUNCH-02**: Reference-fidelity audit: side-by-side screenshot comparison against Linear, Raycast, OpusClip — passes "feels native to reference set" bar
- [ ] **LAUNCH-03**: `/v3` content overwrites `src/app/(marketing)/page.tsx` (the live root landing) — one-way operation, post-approval
- [ ] **LAUNCH-04**: Metadata title, OG image, robots/sitemap updated to reflect new landing — old "Artificial Societies" residue removed
- [ ] **LAUNCH-05**: Standalone `/pricing` route deleted or 301-redirected to `/#pricing` — no duplicate pricing surfaces
- [ ] **LAUNCH-06**: Legacy landing-only imports audited and removed — bundle-size regression check passes
- [ ] **LAUNCH-07**: Real Whop checkout pricing decision applied to PRICE-05 placeholders before merge — business decision gate

---

## Future Requirements (deferred from this milestone)

- Real testimonials with named creators + @handle + follower count → PROOF refinement, next milestone
- Real partner logos beyond Numen Machines (≥ 6 credible logos) → PROOF refinement
- Real wired prediction demo (replace scripted reveal) → next milestone
- /about, /research, /manifesto supporting pages
- Lottie/Rive hero animation alternative (if Spline performance proves too costly)
- Cookie banner (EU/UK GDPR) — defer until traffic warrants
- Light mode variant
- White paper (Science section "Read more" target) — content production, separate workstream

---

## Out of Scope

- Real wired prediction demo on landing — scripted animated reveal only for Landing v1
- /about, /research, /manifesto supporting pages — CTAs may stub them
- Lottie/Rive animations — no animator pipeline in place
- Brand-spine "Your audience, simulated." as locked anchor — v3.0 attempt abandoned; copy fully iterable in Landing v1
- Reviving paused `milestone/landing-page` or `milestone/landing-page-redesign` branches — starting fresh on `milestone/landing` worktree
- Light mode theme variant — dark-mode first, defer
- Mobile native app — web-first
- Cult UI components — off-brief (texture/shader aesthetic clashes with Raycast minimal)
- Standalone brand-spine codification phase — v3.0 failure pattern, copy is iterable
- Vocab guardrails forbidding "viral"/"AI" — OpusClip patterns use them effectively
- Reviving v3.0 BehavioralSimulationHero Canvas — Spline scene selected instead

---

## Content Gates (block-before-merge)

These are not engineering work but block specific phases. Phase numbers below reference the ROADMAP.md phase structure (11 phases total).

| Gate | Phase blocked | Owner | Resolution |
|---|---|---|---|
| Spline scene file (`.splinecode` URL or self-hosted) created and optimized (≤ 500 KB) | Phase 3 (Hero Spline + Above-Fold Credibility) ship | Davide / designer | Build in Spline editor + optimize per Spline docs |
| Real paper citations sourced (3-5 papers, author + year + DOI/URL) | Phase 8 (The Science) ship | Davide | Curate before phase plan |
| Real white paper for SCI-06 link target | Phase 8 (The Science) ship (decision: link or skip) | Davide | If absent, SCI-06 ships without CTA |
| Numen Machines logo lockup asset (SVG, multiple weights) | Phase 9 (Social Proof) ship | Davide / designer | Provide asset file |
| Partner/PR logo permissions | Phase 9 (Social Proof) ship (optional — Numen Machines alone is acceptable minimum) | Davide | Outreach |
| Pricing economics decision ($ for Starter, $ for Pro, yearly discount %) | Phase 11 cutover merge (LAUNCH-07) | Davide | Business decision, lock before cutover |
| Davide approval on Vercel preview of `/v3` (LAUNCH-01) | Phase 11 cutover merge | Davide | Manual review, hard gate |

---

## Traceability

Every v1 REQ-ID maps to exactly one phase. Total: 126 REQ-IDs across 17 categories. See ROADMAP.md for full phase definitions and success criteria.

| REQ-ID | Phase | Phase Name |
|--------|-------|------------|
| FOUND-01 | 1 | Foundation + Scaffold |
| FOUND-02 | 1 | Foundation + Scaffold |
| FOUND-03 | 1 | Foundation + Scaffold |
| FOUND-04 | 1 | Foundation + Scaffold |
| FOUND-05 | 1 | Foundation + Scaffold |
| FOUND-06 | 1 | Foundation + Scaffold |
| FOUND-07 | 1 | Foundation + Scaffold |
| FOUND-08 | 1 | Foundation + Scaffold |
| FOUND-09 | 1 | Foundation + Scaffold |
| FOUND-10 | 1 | Foundation + Scaffold |
| HERO-01 | 2 | Hero Shell + Final CTA Bookend + Vision |
| HERO-02 | 2 | Hero Shell + Final CTA Bookend + Vision |
| HERO-03 | 2 | Hero Shell + Final CTA Bookend + Vision |
| HERO-04 | 2 | Hero Shell + Final CTA Bookend + Vision |
| HERO-05 | 3 | Hero Spline Scene + Above-Fold Credibility Hook |
| HERO-06 | 2 | Hero Shell + Final CTA Bookend + Vision |
| HERO-07 | 2 | Hero Shell + Final CTA Bookend + Vision |
| HERO-08 | 2 | Hero Shell + Final CTA Bookend + Vision |
| HERO-09 | 2 | Hero Shell + Final CTA Bookend + Vision |
| HERO-10 | 3 | Hero Spline Scene + Above-Fold Credibility Hook |
| HERO-11 | 2 | Hero Shell + Final CTA Bookend + Vision |
| DEMO-01 | 4 | Interactive Demo |
| DEMO-02 | 4 | Interactive Demo |
| DEMO-03 | 4 | Interactive Demo |
| DEMO-04 | 4 | Interactive Demo |
| DEMO-05 | 4 | Interactive Demo |
| DEMO-06 | 4 | Interactive Demo |
| DEMO-07 | 4 | Interactive Demo |
| DEMO-08 | 4 | Interactive Demo |
| DEMO-09 | 4 | Interactive Demo |
| DEMO-10 | 4 | Interactive Demo |
| HOW-01 | 5 | How It Works Pipeline |
| HOW-02 | 5 | How It Works Pipeline |
| HOW-03 | 5 | How It Works Pipeline |
| HOW-04 | 5 | How It Works Pipeline |
| HOW-05 | 5 | How It Works Pipeline |
| HOW-06 | 5 | How It Works Pipeline |
| HOW-07 | 5 | How It Works Pipeline |
| BENTO-01 | 6 | Three Surfaces Bento + Dashboard Reveal |
| BENTO-02 | 6 | Three Surfaces Bento + Dashboard Reveal |
| BENTO-03 | 6 | Three Surfaces Bento + Dashboard Reveal |
| BENTO-04 | 6 | Three Surfaces Bento + Dashboard Reveal |
| BENTO-05 | 6 | Three Surfaces Bento + Dashboard Reveal |
| BENTO-06 | 6 | Three Surfaces Bento + Dashboard Reveal |
| BENTO-07 | 6 | Three Surfaces Bento + Dashboard Reveal |
| CMP-01 | 7 | Comparison vs Alternatives |
| CMP-02 | 7 | Comparison vs Alternatives |
| CMP-03 | 7 | Comparison vs Alternatives |
| CMP-04 | 7 | Comparison vs Alternatives |
| CMP-05 | 7 | Comparison vs Alternatives |
| CMP-06 | 7 | Comparison vs Alternatives |
| CMP-07 | 7 | Comparison vs Alternatives |
| SCI-01 | 8 | The Science |
| SCI-02 | 8 | The Science |
| SCI-03 | 8 | The Science |
| SCI-04 | 8 | The Science |
| SCI-05 | 8 | The Science |
| SCI-06 | 8 | The Science |
| SCI-07 | 8 | The Science |
| SCI-08 | 8 | The Science |
| SCI-09 | 8 | The Science |
| PROOF-01 | 9 | Social Proof |
| PROOF-02 | 9 | Social Proof |
| PROOF-03 | 9 | Social Proof |
| PROOF-04 | 9 | Social Proof |
| PROOF-05 | 9 | Social Proof |
| PROOF-06 | 9 | Social Proof |
| PROOF-07 | 9 | Social Proof |
| PROOF-08 | 9 | Social Proof |
| PRICE-01 | 10 | Pricing + FAQ |
| PRICE-02 | 10 | Pricing + FAQ |
| PRICE-03 | 10 | Pricing + FAQ |
| PRICE-04 | 10 | Pricing + FAQ |
| PRICE-05 | 10 | Pricing + FAQ |
| PRICE-06 | 10 | Pricing + FAQ |
| PRICE-07 | 10 | Pricing + FAQ |
| PRICE-08 | 10 | Pricing + FAQ |
| PRICE-09 | 10 | Pricing + FAQ |
| VISION-01 | 2 | Hero Shell + Final CTA Bookend + Vision |
| CTA-01 | 2 | Hero Shell + Final CTA Bookend + Vision |
| CTA-02 | 2 | Hero Shell + Final CTA Bookend + Vision |
| CTA-03 | 2 | Hero Shell + Final CTA Bookend + Vision |
| CTA-04 | 2 | Hero Shell + Final CTA Bookend + Vision |
| CTA-05 | 2 | Hero Shell + Final CTA Bookend + Vision |
| CTA-06 | 2 | Hero Shell + Final CTA Bookend + Vision |
| MOTION-01 | 2 | Hero Shell + Final CTA Bookend + Vision |
| MOTION-02 | 2 | Hero Shell + Final CTA Bookend + Vision |
| MOTION-03 | 2 | Hero Shell + Final CTA Bookend + Vision |
| MOTION-04 | 1 | Foundation + Scaffold |
| MOTION-05 | 1 | Foundation + Scaffold |
| META-01 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| META-02 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| META-03 | 1 | Foundation + Scaffold |
| META-04 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| META-05 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| ANALYTICS-01 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| ANALYTICS-02 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| ANALYTICS-03 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| ANALYTICS-04 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| POLISH-01 | 1 | Foundation + Scaffold |
| POLISH-02 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| POLISH-03 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| POLISH-04 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| POLISH-05 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| POLISH-06 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| POLISH-07 | 1 | Foundation + Scaffold |
| PERF-01 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| PERF-02 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| PERF-03 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| PERF-04 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| PERF-05 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| PERF-06 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| PERF-07 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| PERF-08 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| PERF-09 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| PERF-10 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| PERF-11 | 1 | Foundation + Scaffold |
| PERF-12 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| PERF-13 | 1 | Foundation + Scaffold |
| LAUNCH-01 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| LAUNCH-02 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| LAUNCH-03 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| LAUNCH-04 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| LAUNCH-05 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| LAUNCH-06 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |
| LAUNCH-07 | 11 | Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover |

**Coverage:** 126/126 REQ-IDs mapped ✓ — no orphans, no duplicates.
