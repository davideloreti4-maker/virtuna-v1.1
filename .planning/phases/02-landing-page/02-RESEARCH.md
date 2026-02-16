# Phase 2: Landing Page - Research

**Researched:** 2026-02-16
**Domain:** Landing page development (sections, hive demo, pricing, responsiveness)
**Confidence:** HIGH

## Summary

Phase 2 is building on an extensively pre-built landing page. The codebase already contains **all major landing page sections**: HeroSection, FeaturesSection, StatsSection, SocialProofSection, FAQSection, plus a fully functional HiveDemoCanvas with 50 pre-computed nodes. The pricing page at `/pricing` also already exists with a full comparison table, Whop checkout integration, auth-aware CTAs, and post-checkout tier refresh. Additionally, unused but available components exist: BackersSection, CaseStudySection, PartnershipSection, ComparisonChart, PersonaCard.

The primary work is **evaluating, polishing, and wiring** rather than building from scratch. The hero section already has the correct CTA structure (primary "Start free trial" + secondary "See pricing"). The hive demo already has pre-computed positions, Canvas 2D rendering, `touch-action: auto` for mobile scroll pass-through, progressive build animation, and subtle idle float. The pricing section already has the feature comparison table and Whop checkout modal integration.

**Primary recommendation:** Audit each existing section against the requirements (LAND-01 through LAND-08), fix styling inconsistencies with the Raycast design language, ensure mobile responsiveness, and verify the hive demo performs well on mid-range devices. Most of this phase is refinement, not creation.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.5 | App Router, server components, Image optimization | Already installed, app structure established |
| React | 19.2.3 | UI rendering | Already installed |
| Tailwind CSS | v4 | Styling with `@theme` tokens | Already configured with full design token system |
| motion (framer-motion) | ^12.29.3 | Scroll animations, `whileInView`, stagger | Already installed, `FadeIn` component exists and is used by all sections |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-intersection-observer` | ^10.0.2 | Lazy-load heavy sections (hive demo canvas) | Installed but unused -- use for lazy-mounting HiveDemoCanvas to improve LCP |
| `@radix-ui/react-accordion` | ^1.2.12 | FAQ accordion | Already used by FAQSection |
| `@phosphor-icons/react` | ^2.1.10 | Icons throughout sections | Already used in features, social proof, header, footer |
| `class-variance-authority` | ^0.7.1 | Button variants | Already used by Button component |
| `clsx` + `tailwind-merge` | ^2.1.1 / ^3.4.0 | Conditional class merging | Already used via `cn()` utility |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Canvas 2D (hive demo) | WebGL / @react-three/fiber | Overkill for 50 nodes; Canvas 2D already achieves 60fps. R3F is installed but adds bundle weight for no benefit here |
| `FadeIn` (motion) | CSS `@starting-style` + IntersectionObserver | Would require rewriting all existing animation patterns; motion already handles reduced-motion preferences |
| Custom scroll sections | `react-scroll` or `fullpage.js` | Not needed -- standard page flow with FadeIn animations is the established pattern |

**Installation:**
```bash
# No new dependencies needed -- all libraries already installed
```

## Architecture Patterns

### Existing Project Structure (Relevant)
```
src/
├── app/
│   ├── (marketing)/
│   │   ├── page.tsx              # Landing page (already wired)
│   │   ├── layout.tsx            # Header wrapper
│   │   ├── pricing/
│   │   │   ├── page.tsx          # Pricing page (already wired)
│   │   │   └── pricing-section.tsx  # Full pricing + checkout
│   │   └── coming-soon/page.tsx  # Placeholder for links
│   └── layout.tsx                # Root layout (Inter font, viewport meta)
├── components/
│   ├── landing/
│   │   ├── hero-section.tsx      # Hero with CTA (exists)
│   │   ├── features-section.tsx  # 4 feature cards (exists)
│   │   ├── feature-card.tsx      # Reusable card (exists)
│   │   ├── stats-section.tsx     # 4 stats (exists)
│   │   ├── social-proof-section.tsx  # 3 testimonials (exists)
│   │   ├── faq-section.tsx       # 7 FAQ items (exists)
│   │   ├── testimonial-quote.tsx # Quote component (exists)
│   │   ├── comparison-chart.tsx  # AI accuracy chart (unused)
│   │   ├── backers-section.tsx   # Investor logos (unused)
│   │   ├── case-study-section.tsx    # Teneo case study (unused)
│   │   ├── partnership-section.tsx   # Pulsar partnership (unused)
│   │   ├── persona-card.tsx      # Persona display (unused)
│   │   └── index.ts              # Barrel exports
│   ├── hive-demo/
│   │   ├── index.tsx             # Section wrapper (exists)
│   │   ├── hive-demo-canvas.tsx  # Canvas renderer (exists, 50 nodes)
│   │   └── hive-demo-data.ts     # Pre-computed positions (exists)
│   ├── layout/
│   │   ├── header.tsx            # Glass navbar + mobile menu (exists)
│   │   └── footer.tsx            # CTA + links + social (exists)
│   └── motion/
│       └── fade-in.tsx           # Scroll-triggered animation (exists)
└── hooks/
    ├── useIsMobile.ts            # Viewport detection (exists)
    └── usePrefersReducedMotion.ts # a11y preference (exists)
```

### Pattern 1: Server Components by Default, Client Only for Interactivity

**What:** Landing page sections that don't need client-side state should be server components. Only add `"use client"` when needed for animations, state, or event handlers.

**When to use:** Always, per project conventions.

**Current state:** ALL landing sections are currently `"use client"` due to `FadeIn` (motion) usage. This is correct because motion's `whileInView` requires client-side IntersectionObserver. The root `page.tsx` is a server component that composes client section components -- this is the correct pattern.

### Pattern 2: Consistent Card Styling (Raycast Design Language)

**What:** All cards use `bg-transparent`, 6% white border, 12px radius, 5% inset shadow. Hover adds `bg-white/[0.02]` only -- no translate-y, no border change.

**When to use:** Every card-like element on the landing page.

**Example:**
```typescript
// Verified pattern from existing FeatureCard component
<div
  className="rounded-[12px] border border-white/[0.06] px-[26px] py-12 transition-colors duration-150 hover:bg-white/[0.02]"
  style={{
    boxShadow: "rgba(255, 255, 255, 0.05) 0px 1px 0px 0px inset",
  }}
>
```

### Pattern 3: Section Layout Pattern

**What:** Each section follows a consistent container pattern.

**Example:**
```typescript
// Consistent across all existing sections
<section className="py-24">
  <div className="mx-auto max-w-6xl px-6">
    <FadeIn>
      <div className="mb-16 text-center">
        <span className="text-sm text-foreground-secondary">Label</span>
        <h2 className="mt-4 text-[32px] font-normal leading-[36px] text-white sm:text-[40px] sm:leading-[44px]">
          Heading
        </h2>
      </div>
    </FadeIn>
    {/* Content grid */}
  </div>
</section>
```

### Pattern 4: CTA Button Patterns

**What:** Hero uses primary + secondary button pair. CTA links use `asChild` with `Link`.

**Example:**
```typescript
// Source: existing hero-section.tsx
<Button variant="primary" size="lg" asChild>
  <Link href="/auth/signup">Start free trial</Link>
</Button>
<Button variant="secondary" size="lg" asChild>
  <Link href="/pricing">See pricing</Link>
</Button>
```

### Anti-Patterns to Avoid
- **Importing full HiveCanvas:** The hive-demo is a separate lightweight component. Never import from `@/components/hive/` in the landing page -- use `@/components/hive-demo/`
- **Adding translate-y hover effects:** Raycast cards do not lift on hover. Only `bg-white/[0.02]` change
- **Using oklch for dark grays in @theme:** Known Tailwind v4 compilation inaccuracy for L < 0.15. All dark tokens already use hex
- **Adding `backdrop-filter` via CSS classes:** Lightning CSS strips them. Use inline styles (already done in header.tsx, GlassPanel)
- **Using multiple fonts:** Inter is the only font. No Poppins, no SF Pro, no anything else

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scroll animations | Custom IntersectionObserver + CSS transitions | `FadeIn` component (motion `whileInView`) | Already built, handles reduced-motion, viewport margin, stagger delays |
| FAQ accordion | Custom expand/collapse | `AccordionRoot/Item/Trigger/Content` (Radix) | Already built, accessible, keyboard nav, animated height transitions |
| Responsive header | Custom mobile menu | Existing `Header` component | Already handles hamburger, overlay, outside-click-close, body scroll lock |
| Button variants | Inline styles per button | `Button` component with CVA variants | Already has primary/secondary/ghost/destructive with proper shadows |
| Class merging | String concatenation | `cn()` utility (clsx + tailwind-merge) | Handles Tailwind class conflicts correctly |
| Lazy canvas loading | Manual IntersectionObserver | `react-intersection-observer` `useInView` hook | Already installed, cleaner API than manual observer |

**Key insight:** This phase is almost entirely wiring existing components together and making minor refinements. The design system, animation patterns, and section components already exist. The planner should focus on auditing what exists vs. requirements, not building new component infrastructure.

## Common Pitfalls

### Pitfall 1: Canvas Continuous RAF Loop on Mobile Battery
**What goes wrong:** The hive demo canvas runs `requestAnimationFrame` continuously even when off-screen, draining battery on mobile devices.
**Why it happens:** The current `HiveDemoCanvas` starts RAF immediately on mount and never pauses it based on visibility.
**How to avoid:** Use `react-intersection-observer` to mount/unmount the canvas component, or use `IntersectionObserver` to pause/resume the RAF loop when the section scrolls out of view.
**Warning signs:** High battery drain on mobile, CPU usage while scrolling past the demo section.

### Pitfall 2: LCP Regression from Heavy Client Components
**What goes wrong:** All landing sections being `"use client"` means the entire page is client-rendered, potentially hurting LCP.
**Why it happens:** Each section uses `FadeIn` (motion), which requires `"use client"`.
**How to avoid:** The root `page.tsx` IS a server component that imports client sections. This is acceptable because Next.js still server-renders client components on initial load. The key is ensuring critical above-the-fold content (hero) renders fast. Consider `loading="eager"` for any hero images and avoid blocking resources.
**Warning signs:** LCP > 2.5s on mobile PageSpeed Insights.

### Pitfall 3: Accordion Border Inconsistency
**What goes wrong:** The FAQ accordion items use `border-white/10` (10% opacity) while the design system standard is `border-white/[0.06]` (6% opacity).
**Why it happens:** The accordion component was built from a different reference and hasn't been updated to match the Raycast design language.
**How to avoid:** Audit the `AccordionItem` class in `faq-section.tsx` and ensure it uses `border-white/[0.06]` consistently.
**Warning signs:** FAQ borders appear brighter/thicker than other section borders.

### Pitfall 4: CTA Link Targets After Phase 1 Auth Changes
**What goes wrong:** Hero and pricing CTAs link to `/auth/signup` and `/auth/login`, but Phase 1 may have moved these to the `(onboarding)` route group at `/login` and `/signup`.
**Why it happens:** Phase 1 restructured route groups. The existing landing components were built before Phase 1 completed.
**How to avoid:** Verify the actual auth routes that exist after Phase 1 completion. The codebase currently shows both `/auth/login` and `/(onboarding)/login` exist. Need to check which are the canonical paths used by middleware redirects.
**Warning signs:** Clicking "Start free trial" leads to a 404 or unexpected page.

### Pitfall 5: Mobile Touch Scrolling Through Canvas
**What goes wrong:** Canvas element intercepts touch events, preventing users from scrolling past the hive demo on mobile.
**Why it happens:** Canvas touch event handlers can call `preventDefault()`, or the browser may treat the canvas as a scrolling boundary.
**How to avoid:** The current implementation already sets `style={{ touchAction: "auto" }}` on the canvas element. This tells the browser to handle touch scrolling normally. Verify this isn't overridden by any CSS. Do NOT add touch event listeners with `{ passive: false }`.
**Warning signs:** Users get "stuck" on the hive demo section and can't scroll past it on mobile.

### Pitfall 6: Pricing Page Already Complete
**What goes wrong:** Time wasted rebuilding the pricing section that already exists and works.
**Why it happens:** Plan 02-03 is "Pricing page with tier comparison and CTAs" but the pricing page already has all this.
**How to avoid:** The planner should audit the existing `/pricing` page against LAND requirements first. The existing `pricing-section.tsx` already has: auth-aware CTAs (redirect to signup if unauthenticated, show checkout modal if authenticated), feature comparison table, Starter vs Pro cards with prices, "Most popular" badge on Pro, post-checkout polling feedback, Whop checkout modal integration. The only potential work is styling consistency with the landing page and ensuring mobile responsiveness.
**Warning signs:** Duplicate pricing logic, conflicting CTA behavior, or inconsistent design between landing page and pricing page.

## Code Examples

Verified patterns from existing codebase:

### Lazy Loading Canvas with react-intersection-observer
```typescript
// Recommended pattern for HiveDemo -- lazy mount canvas
"use client";

import { useInView } from "react-intersection-observer";
import { HiveDemoCanvas } from "./hive-demo-canvas";

export function HiveDemo() {
  const { ref, inView } = useInView({
    triggerOnce: true,
    rootMargin: "200px", // Start loading 200px before visible
  });

  return (
    <section ref={ref}>
      {/* ... section header ... */}
      <div className="relative aspect-square max-h-[400px] sm:max-h-[500px] w-full rounded-[12px] border border-white/[0.06] overflow-hidden">
        {inView ? <HiveDemoCanvas /> : <div className="w-full h-full bg-background" />}
      </div>
    </section>
  );
}
```

### Pausing RAF When Off-Screen
```typescript
// Alternative: keep canvas mounted but pause animation
"use client";

import { useRef, useEffect } from "react";
import { useInView } from "react-intersection-observer";

export function HiveDemoCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const { ref: containerRef, inView } = useInView({ threshold: 0 });

  useEffect(() => {
    if (!inView) {
      cancelAnimationFrame(animRef.current);
      return;
    }
    // ... start RAF loop ...
    return () => cancelAnimationFrame(animRef.current);
  }, [inView]);

  return (
    <div ref={containerRef}>
      <canvas ref={canvasRef} style={{ touchAction: "auto" }} />
    </div>
  );
}
```

### Mobile-First Responsive Section Grid
```typescript
// Source: existing features-section.tsx
// 1 column mobile, 2 tablet, 4 desktop
<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
  {features.map((feature, index) => (
    <FadeIn key={feature.title} delay={0.1 + index * 0.1}>
      <FeatureCard {...feature} />
    </FadeIn>
  ))}
</div>
```

### Testimonial Card with Consistent Styling
```typescript
// Source: existing social-proof-section.tsx
<div
  className="rounded-[12px] border border-white/[0.06] p-8 h-full"
  style={{
    boxShadow: "rgba(255, 255, 255, 0.05) 0px 1px 0px 0px inset",
  }}
>
  <TestimonialQuote
    quote={testimonial.quote}
    authorName={testimonial.authorName}
    authorTitle={testimonial.authorTitle}
    authorCompany={testimonial.authorCompany}
  />
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `framer-motion` import path | `motion/react` import path | motion v12+ | Already used in codebase -- `FadeIn` imports from `"motion/react"` |
| `next/font` loading strategy | `display: "swap"` default | Next.js 13+ | Already configured in root `layout.tsx` |
| Manual DPR handling for canvas | Standard pattern with `window.devicePixelRatio` | Stable | Already implemented in `HiveDemoCanvas` |
| CSS `backdrop-filter` classes | Inline styles for Safari compat | Discovered during v2.1 | Documented in CLAUDE.md, already applied in header, GlassPanel |
| `whileInView` scroll animations | Viewport margin + `once` prop | motion v5+ | Already used via `FadeIn` component with `margin: "-100px"` and `once: true` |

**Deprecated/outdated:**
- `framer-motion` package name: Now published as `motion` (project has both installed for compat, imports use `motion/react`)
- `next/legacy/image`: Project uses `next/image` with the modern API
- `GradientGlow`, `GradientMesh`: Deleted components -- not part of Raycast design language

## Existing Component Audit (vs. Requirements)

This is the critical section for planning. Each requirement is mapped to what already exists:

| Requirement | What Exists | Gap | Effort |
|-------------|-------------|-----|--------|
| **LAND-01**: Hero + value prop + CTA | `hero-section.tsx` -- headline, subhead, "Start free trial" + "See pricing" CTAs, animated badge | Verify CTA link targets post-Phase 1. Minor styling audit | Minimal |
| **LAND-02**: Interactive mini hive demo (50 nodes, pre-computed) | `hive-demo/` -- 50 pre-computed nodes, Canvas 2D, progressive build animation, idle float | Add lazy loading (RAF pause/IntersectionObserver). Verify no physics at runtime | Minimal |
| **LAND-03**: Mobile-optimized hive demo | `touch-action: auto` set, Canvas 2D (lightweight), no touch event listeners | Test on actual mid-range device. Add IntersectionObserver to pause RAF when off-screen | Low |
| **LAND-04**: Features/benefits section | `features-section.tsx` -- 4 cards (viral prediction, trend intelligence, referral rewards, audience insights) | Verify content accuracy and card count. Responsive grid already 1/2/4 cols | Minimal |
| **LAND-05**: Social proof section | `social-proof-section.tsx` -- 3 testimonials with quote component | Content is placeholder (fictional creators). May need real/better placeholder content | Low |
| **LAND-06**: FAQ section | `faq-section.tsx` -- 7 FAQ items using Radix Accordion | Fix border opacity (currently 10%, should be 6%). Content review | Minimal |
| **LAND-07**: Raycast design language | All sections use design tokens, Inter font, coral accents | Audit for minor inconsistencies (FAQ border, any hardcoded colors, text opacity patterns) | Low |
| **LAND-08**: Fully responsive (mobile-first) | Grid patterns are mobile-first. Header has mobile menu | Test all sections at 320px/375px/768px/1024px/1440px breakpoints. Fix any overflow or text sizing issues | Medium |

### Pricing Page Audit (Plan 02-03)

| Requirement | What Exists | Gap |
|-------------|-------------|-----|
| **PAY-01 subset**: Pricing comparison table | `pricing-section.tsx` -- full feature comparison, Starter vs Pro | Already complete |
| Pricing CTAs per tier | Auth-aware: redirect to signup (unauth) or show checkout modal (auth) | Already complete |
| Starter vs Pro pricing | $19/mo Starter, $49/mo Pro, "Most popular" badge on Pro | Already complete |
| Post-checkout feedback | Polling with spinner, success banner | Already complete |

## Open Questions

1. **Auth route paths after Phase 1**
   - What we know: Phase 1 completed 2026-02-16. Both `/auth/login` and `/(onboarding)/login` exist in the codebase
   - What's unclear: Which is the canonical login/signup path that middleware redirects to?
   - Recommendation: The planner should verify by checking `src/middleware.ts` and the Phase 1 plans. Hero CTAs currently link to `/auth/signup` -- this may need updating

2. **Testimonial content authenticity**
   - What we know: Current testimonials use fictional creator names (Maya Chen, Jordan Williams, Priya Sharma) with specific follower counts
   - What's unclear: Are these acceptable for MVP launch or do they need replacing?
   - Recommendation: Keep as-is for MVP. They're realistic but clearly placeholder. Flag for post-launch update

3. **Stats section accuracy**
   - What we know: Stats show "86% prediction accuracy", "10K+ AI personas", "<30s results", "3.2x engagement lift"
   - What's unclear: Are these claims validated or aspirational for MVP?
   - Recommendation: Keep for MVP since the stats section serves marketing purposes. These match what the FAQ section states

4. **Unused landing components**
   - What we know: `BackersSection`, `CaseStudySection`, `PartnershipSection`, `ComparisonChart`, `PersonaCard` exist but are not used on the landing page
   - What's unclear: Should any of these be added to the landing page for Phase 2?
   - Recommendation: Do not add them. The current page structure (hero -> hive demo -> features -> stats -> social proof -> FAQ -> footer CTA) is sufficient for MVP. Adding investor logos or case studies for a product that doesn't have real investors/case studies would be misleading

## Sources

### Primary (HIGH confidence)
- Codebase audit: All 15+ landing components read and analyzed
- `BRAND-BIBLE.md` -- complete design system reference (v2.3.5, 2026-02-08)
- `globals.css` -- full token system verified
- `ROADMAP.md` -- phase requirements and success criteria
- `REQUIREMENTS.md` -- all 8 LAND requirements
- `.planning/research/STACK.md` -- prior stack research confirming no new dependencies
- [Motion docs (Context7)](/websites/motion_dev) -- `whileInView`, viewport animations
- [Next.js v16.1.5 docs (Context7)](/vercel/next.js/v16.1.5) -- Image responsive sizes, lazy loading

### Secondary (MEDIUM confidence)
- [MDN: Optimizing Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) -- RAF, offscreen canvas, redraw regions
- [web.dev: Canvas Performance](https://web.dev/canvas-performance/) -- devicePixelRatio, batch operations
- [Chrome: Passive Event Listeners](https://developer.chrome.com/blog/scrolling-intervention) -- touch-action and scroll blocking
- [KlientBoost: SaaS Landing Pages](https://www.klientboost.com/landing-pages/saas-landing-page/) -- CTA placement, hero best practices
- [Unbounce: SaaS Landing Pages](https://unbounce.com/conversion-rate-optimization/the-state-of-saas-landing-pages/) -- conversion patterns

### Tertiary (LOW confidence)
- None -- all findings verified against codebase or official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and in use, verified in package.json and component imports
- Architecture: HIGH -- all patterns verified by reading existing component source code
- Pitfalls: HIGH -- identified from actual code inconsistencies (FAQ border), known issues (Lightning CSS, touch-action), and Phase 1 dependency analysis
- Component audit: HIGH -- every single landing component file was read and analyzed

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable -- no fast-moving dependencies)
