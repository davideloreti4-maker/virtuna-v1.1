# Project Research Summary

**Project:** Virtuna v3.1 Landing Page Redesign
**Domain:** Dark-themed SaaS Landing Page (Raycast aesthetic)
**Researched:** 2026-02-06
**Confidence:** HIGH

## Executive Summary

The Virtuna v3.1 landing page redesign is a component replacement project, not a greenfield build. The existing codebase already has the ideal architecture: a `(marketing)` route group with independent layout, a component-per-section pattern in `src/components/landing/`, and a complete 36-component design system matching the Raycast aesthetic with coral (#FF7F50) branding. The redesign replaces the current societies.io landing sections with Raycast-quality equivalents, leveraging 100% of the existing infrastructure.

The recommended approach is v0-driven section-by-section generation with manual adaptation to the existing design system. No new dependencies are needed beyond cleaning up a duplicate animation package (removing `framer-motion`, keeping `motion`). The existing motion components (FadeIn, StaggerReveal, SlideUp), glass primitives (GlassCard, GlassPanel), and effects library (NoiseTexture, ChromaticAberration) provide all the building blocks. Each section can be built, reviewed, and merged incrementally following the established pattern.

Critical risks center on v0 integration friction: generated code will use default shadcn/ui conventions instead of Virtuna's custom tokens, requiring manual token replacement and component deduplication per section. The Tailwind v4 Lightning CSS backdrop-filter bug (strips blur from CSS classes, requiring inline styles) is already documented and solved via inline style patterns. Mobile performance with glass effects must be monitored, but the codebase already has mobile blur reduction media queries in place. Overall, this is a low-risk redesign with clear execution patterns and high confidence in technical feasibility.

## Key Findings

### Recommended Stack

**Zero new dependencies needed.** The existing stack contains everything required: Motion (Framer Motion's successor) for scroll-triggered animations, next/image for product screenshot optimization, 4 pre-built motion components, React Three Fiber + Spline for optional 3D (already installed), and a complete design system. The only action is cleanup: remove duplicate `framer-motion` package (keeping `motion`), add AVIF support to `next.config.ts`, and add `scroll-behavior: smooth` to `globals.css`.

**Core technologies (existing):**
- **Motion v12.29.2** (update to 12.33.0): Scroll animations, parallax, stagger reveals — provides all landing page animation patterns with existing FadeIn/StaggerReveal wrappers
- **Next.js 16 + React 19**: Already installed, Image component with AVIF optimization covers product screenshots
- **Tailwind CSS v4**: Design system with @theme block provides all tokens, but Lightning CSS strips backdrop-filter (use inline styles)
- **Design system (36 components)**: Button, Card, GlassCard, Accordion, Tabs, TestimonialCard, ExtensionCard — covers every landing page UI pattern

**Critical cleanup:**
- Remove `framer-motion` (duplicate package), update `motion` to latest
- Add `formats: ['image/avif', 'image/webp']` to next.config.ts
- Add `html { scroll-behavior: smooth; }` to globals.css

### Expected Features

Research analyzed 5 reference sites (Raycast, Linear, Resend, Clerk, Vercel) and identified 9 table stakes features and 10 differentiators. The landing page must establish credibility immediately (hero + social proof + product screenshots) before explaining features.

**Must have (table stakes):**
- **Hero section with clear value prop**: Large headline, subheadline, CTA, product visual — establishes what Virtuna is in 3 seconds
- **Sticky navigation with CTA**: Logo + nav links + "Get started" button — persistent conversion path
- **Social proof (logo bar)**: "Trusted by" logos immediately below hero — credibility signal
- **Feature showcase**: 3-4 deep-dive sections (trending feed, analysis, scoring) with screenshots + grid of secondary features
- **Product screenshots**: Framed in browser chrome, above and below fold — "show don't tell"
- **Multiple CTA placements**: Hero, mid-page, bottom — repeat conversion opportunities
- **Footer with links**: Multi-column structure, social, legal — professional finish
- **Mobile responsiveness**: Full 320px-1440px+ support — non-negotiable
- **FAQ section**: 5-7 questions addressing common objections

**Should have (competitive differentiators):**
- **Animated hero visual**: 3D Spline scene, Three.js particle network, or Motion-composed floating product elements — immediate "wow"
- **Scroll-triggered reveals**: Already built (FadeIn, StaggerReveal components) — apply to every section for narrative flow
- **Glass-morphism cards**: Use existing GlassCard/GlassPanel primitives for features, testimonials, frames — signature Raycast aesthetic
- **Product screenshots in browser chrome**: macOS window frame with traffic lights — polished vs lazy screenshots
- **Gradient accent dividers**: Replace `border-white/10` with coral-to-transparent gradients — premium feel
- **Animated metrics counters**: "500K+ posts analyzed" counting up on scroll — engagement moment
- **Interactive feature tabs**: Raycast-style tabbed showcase — depth without clutter
- **Testimonial cards with avatars**: Named quotes from users/partners — builds trust
- **Subtle background patterns**: Dot grid + NoiseTexture + radial spotlights — depth vs flat black

**Defer (v2+ or not needed):**
- Pricing section (business model not finalized)
- Blog content on landing page (separate route)
- Complex interactive demo (product itself is the demo)
- Multi-page marketing site (single-page scroll is current pattern)
- Custom cursor effects (accessibility concern, not in reference sites)
- Newsletter signup (competes with primary CTA)
- Chatbot widget (breaks aesthetic, not in reference sites)

### Architecture Approach

**Component replacement, not restructuring.** The existing `(marketing)` route group with independent root layout cleanly separates landing from `(app)` dashboard. The `src/components/landing/` directory contains 12 section components following a component-per-section pattern. The redesign replaces these 12 files with Raycast-style equivalents — no routing changes, no layout rewrites.

**Major components to replace:**
1. **Section components** (src/components/landing/) — Replace all 12 existing sections (hero, features, stats, etc.) with Raycast-style equivalents, maintaining the component-per-section pattern
2. **Layout updates** (src/components/layout/) — Restyle Header and Footer to Raycast aesthetic, keep Container wrapper unchanged
3. **New landing primitives** (src/components/landing/) — Add 6 landing-specific components: animated-counter, product-screenshot, video-embed, logo-marquee, feature-bento, section-header

**Server/client strategy:** Section-level "use client" for animated sections is acceptable (existing pattern). Micro-optimizing server/client boundaries adds complexity for marginal gain on a statically-generated page. Keep sections with animations as client components, use server components only for purely static sections (logo cloud, CTA, footer).

**Image handling:** Product screenshots in `/public/images/landing/` with next/image, AVIF/WebP optimization, `preload` on hero image (LCP element), lazy loading below fold (default). Use existing TrafficLights component for macOS window chrome framing.

**v0 workflow integration:** Generate one section at a time with v0, adapt to design system (replace shadcn imports with Virtuna components, replace hardcoded colors with tokens, replace Lucide icons with Phosphor, add Raycast design rules), place in `src/components/landing/[section].tsx`, compose in `(marketing)/page.tsx`. Each section is independent and can be merged incrementally.

### Critical Pitfalls

1. **v0 generated code ignores custom design tokens** — v0 outputs default shadcn/ui palette (bg-slate-900, text-white) instead of Virtuna's semantic tokens (bg-background, text-foreground). Every section needs manual token replacement: color classes → design tokens, font classes → font-display/font-sans, borders → white/[0.06] pattern, shadows → design system shadows, radius → 12px cards/8px inputs. Create v0 migration checklist in Phase 1, enforce per section.

2. **Tailwind v4 Lightning CSS strips backdrop-filter from CSS classes** — Any backdrop-filter declared in CSS classes (including existing .glass-blur-* utilities) is silently removed during build. Glass effects work in dev (browser reads source CSS), vanish in production. NEVER use CSS classes for backdrop-filter — always apply via React inline styles: `style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}`. This is already documented in MEMORY.md. Test production builds per section.

3. **Every section marked "use client" destroys SEO and bundle size** — All existing landing sections are "use client" because they use FadeIn. This means entire page is client-rendered (zero SSR for crawlers, full Motion bundle shipped to all visitors). While section-level "use client" is acceptable for animated sections, keep text content in server components where possible. The page is statically generated, so impact is minimized. Don't over-engineer this — existing pattern works fine.

4. **Glass/blur effects destroy mobile performance** — backdrop-filter is GPU-intensive. Multiple glass panels + blur(48px) + scroll animations cause jank on mobile. The codebase already has mobile blur reduction (globals.css caps blur at 8px for max-width: 768px). Limit glass effects to max 3-4 visible simultaneously, prefer rgba backgrounds over backdrop-filter for decorative elements, test on real Android device per section.

5. **v0 generates duplicate component abstractions** — Each v0 section comes with its own button styles, card patterns, badges. After 7 sections, you have 7 different button implementations. Immediately replace inline UI elements with existing components (Button, Card, GlassCard, Badge). Add component deduplication step to v0 migration checklist.

6. **Inconsistent section spacing and max-width** — v0 defaults to various container widths (max-w-7xl, max-w-6xl, max-w-5xl). Existing code uses `max-w-6xl mx-auto px-6` + `py-24` consistently. Create SectionWrapper component in Phase 1 to enforce standard pattern.

## Implications for Roadmap

Based on research, the roadmap should follow a visual-completeness build order: foundation (hero + header + footer) → social proof & trust (logos + stats + testimonials) → product story (screenshots + features + capabilities) → conversion & polish (use cases + FAQ + CTA + SEO). This order maximizes incremental progress and delivers a deployable landing page at each milestone.

### Phase 1: Foundation & Infrastructure
**Rationale:** Establish patterns before building content. Hero has highest visual impact and establishes Raycast design language for all subsequent sections.
**Delivers:** Deployable minimal landing page (Header + Hero + Footer), v0 migration checklist, server/client boundary pattern, SectionWrapper component, inline backdrop-filter pattern.
**Addresses:** TS-1 (Hero), TS-2 (Nav), TS-7 (Footer), D-9 (background patterns), setup for all differentiators.
**Avoids:** CRIT-1 (token migration checklist), CRIT-2 (inline blur pattern), MOD-2 (SectionWrapper enforces spacing).
**Research flag:** NO — hero patterns well-documented in reference sites, existing codebase provides structure.

### Phase 2: Social Proof & Trust
**Rationale:** Credibility signals must come before feature explanations. Logos + stats + testimonials complete trust triangle immediately below hero.
**Delivers:** Logo cloud, animated stats section, testimonial cards. Landing page that convinces (Header → Hero → Logos → Stats → Testimonials → Footer).
**Addresses:** TS-3 (social proof), D-6 (animated counters), D-8 (testimonials with avatars).
**Uses:** Motion useSpring for counters, TestimonialCard from design system, existing BackersSection structure as reference.
**Avoids:** MOD-5 (contrast on glass surfaces — verify testimonial card readability).
**Research flag:** NO — standard patterns, design system covers all components.

### Phase 3: Product Story
**Rationale:** "Show don't tell" — screenshots of actual product are more convincing than feature descriptions. Product showcase + features grid + AI capabilities detail the value proposition.
**Delivers:** Product showcase with framed screenshots, features grid with glass cards, AI capabilities deep-dive. Visitor understands what Virtuna does and why it's better.
**Addresses:** TS-4 (features showcase), TS-5 (product screenshots), D-3 (glass cards), D-4 (browser chrome framing).
**Uses:** TrafficLights for macOS chrome, GlassCard for feature cards, Playwright extraction scripts for screenshots.
**Avoids:** CRIT-4 (mobile glass performance — test on real device), MOD-6 (if 3D visualization, use dynamic import).
**Research flag:** NO — feature grids and screenshot sections are well-established landing page patterns.

### Phase 4: Conversion & Polish
**Rationale:** Conversion layer (use cases, FAQ, final CTA) only matters once page has substance. SEO metadata and OG images are invisible to users, added last.
**Delivers:** Use cases/integrations tabs, FAQ accordion, final CTA section, SEO metadata + JSON-LD, OG images. Complete production-ready landing page.
**Addresses:** TS-6 (multiple CTAs), TS-9 (FAQ), D-5 (gradient dividers), D-7 (interactive tabs), MIN-4 (metadata).
**Uses:** Tabs component from design system, Accordion for FAQ (already exists), existing FAQ content as reference.
**Avoids:** MOD-4 (CTA hierarchy — max 2 primary CTAs per page), CRIT-3 (FAQ accordion is client component, rest can be server).
**Research flag:** NO — standard conversion patterns, well-documented in SaaS landing page research.

### Optional Phase 5: Premium Visuals
**Rationale:** 3D hero animation or interactive feature demos are high-impact but high-effort. Core landing page is complete without them. This phase is a polish pass for "wow factor."
**Delivers:** Spline 3D scene or Three.js particle network for hero, or Motion-composed animated product assembly. Video embeds for product demos.
**Addresses:** D-1 (animated hero visual).
**Uses:** Existing @splinetool/react-spline or @react-three/fiber + drei, dynamic import with ssr: false.
**Avoids:** MOD-6 (Three.js bundle bloat — must use next/dynamic), CRIT-4 (3D is GPU-heavy on mobile).
**Research flag:** YES if choosing 3D — Spline scene design or Three.js particle system implementation needs deeper research during planning.

### Phase Ordering Rationale

- **Hero first** because it establishes the Raycast design language and has highest visual impact — all subsequent sections follow its aesthetic
- **Social proof before features** because trust signals (logos, stats, testimonials) are more persuasive than feature lists for a SaaS product
- **Product screenshots before feature descriptions** because showing the product is more convincing than describing it ("show don't tell")
- **FAQ and CTA last** because they're conversion-layer elements that only matter once the page has substance
- **SEO metadata last** because it's invisible to users and can be added after visual completeness
- **3D/premium visuals optional** because core landing page is complete without them — this is a polish pass for differentiation

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 5 (Premium Visuals)** — If pursuing 3D hero: Spline scene design workflow, asset optimization, or Three.js particle system implementation patterns need phase-specific research. Existing packages are installed but integration patterns for landing pages need validation.

**Phases with standard patterns (skip research-phase):**
- **Phase 1-4** — All follow well-documented landing page patterns. Hero sections, feature grids, product screenshots, FAQ accordions, and testimonial cards are standard. v0 can generate structure, existing design system covers all components, reference sites provide design direction. No phase-specific research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Existing stack verified via package.json + codebase audit. Zero new dependencies needed beyond cleanup. Motion, Next.js Image, design system cover all requirements. |
| Features | HIGH | Based on live analysis of 5 reference sites (Raycast, Linear, Resend, Clerk, Vercel) + 4 SaaS landing page research sources. Table stakes and differentiators consistent across all references. |
| Architecture | HIGH | Verified directly in codebase — (marketing) route group exists, component-per-section pattern established, design system components catalogued. Replacement architecture not restructure. |
| Pitfalls | HIGH | CRIT-2 (backdrop-filter bug) already documented in MEMORY.md from direct experience. CRIT-1 (v0 token mismatch) confirmed via v0 docs and codebase token analysis. Other pitfalls corroborated by Next.js/Motion GitHub issues. |

**Overall confidence:** HIGH

The research is grounded in verified existing code (not speculation), official documentation (Next.js, Motion, Tailwind v4), and direct analysis of 5 live reference implementations. The project-specific risks (backdrop-filter bug, dual animation package) are already documented from experience. The only area of uncertainty is v0 output quality variability, which is mitigated by the established adaptation workflow.

### Gaps to Address

- **v0 generation quality** — v0 output with custom design tokens varies. Some sections may require more manual rework than others. This is managed by the per-section migration checklist, but actual adaptation time per section is unknown until generation. Consider generating one section as a pilot to calibrate effort estimates.

- **Product screenshot availability** — Several features (product showcase, feature deep-dives, tabbed sections) depend on high-quality product screenshots. The existing extraction/ directory has Playwright scripts for capturing screenshots, but whether the current Virtuna app is visually polished enough for landing page use needs validation. If screenshots aren't landing-ready, consider using v0 to generate mockups or placeholder visuals.

- **Content completeness** — FAQ questions, feature copy, testimonial quotes, and logo assets need to exist or be created. Research assumes content is available or easy to produce. If content creation is a bottleneck, it could delay section integration even after code is written.

- **3D visual design** — If Phase 5 (Premium Visuals) is pursued, the actual 3D scene design (Spline) or particle system behavior (Three.js) requires design direction that wasn't part of this research. Technical implementation is clear, but "what should it look like" is unresolved.

## Sources

### Primary (HIGH confidence)
- Virtuna codebase analysis — `src/app/(marketing)/`, `src/components/landing/`, `src/components/ui/`, `src/components/motion/`, `globals.css`, `package.json`, layout files
- Virtuna MEMORY.md — backdrop-filter bug, dev cache behavior, hydration notes
- raycast.com live CSS analysis (2026-02-06) — Glass patterns, border values, radius scale
- [Motion npm package](https://www.npmjs.com/package/motion) — v12.33.0 latest
- [Motion scroll animations docs](https://www.framer.com/motion/scroll-animations/)
- [Motion upgrade guide](https://motion.dev/docs/react-upgrade-guide)
- [Next.js 16 release blog](https://nextjs.org/blog/next-16)
- [Next.js Image component docs](https://nextjs.org/docs/app/api-reference/components/image)
- [Next.js Metadata API](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)

### Secondary (MEDIUM confidence)
- linear.app, vercel.com, resend.com, clerk.com live page analysis (2026-02-06)
- [SaaSFrame: 10 SaaS Landing Page Trends for 2026](https://www.saasframe.io/blog/10-saas-landing-page-trends-for-2026-with-real-examples)
- [Fibr: 20 Best SaaS Landing Pages + 2026 Best Practices](https://fibr.ai/landing-page/saas-landing-pages)
- [DesignStudioUIUX: 10 SaaS Landing Page Design Best Practices 2026](https://www.designstudiouiux.com/blog/saas-landing-page-design/)
- [Unbounce: 26 SaaS Landing Pages](https://unbounce.com/conversion-rate-optimization/the-state-of-saas-landing-pages/)
- [v0 documentation](https://v0.dev/docs)
- [v0 design systems](https://vercel.com/blog/maximizing-outputs-with-v0-from-ui-generation-to-code-creation)
- [Next.js SEO Guide 2026](https://www.djamware.com/post/697a19b07c935b6bb054313e/next-js-seo-optimization-guide--2026-edition)

### Tertiary (LOW confidence)
- [shadcn/ui CSS Backdrop Filter performance issue #327](https://github.com/shadcn-ui/ui/issues/327)
- [Safari backdrop-filter performance fix](https://graffino.com/til/how-to-fix-filter-blur-performance-issue-in-safari)
- [Dark Mode Glassmorphism tips](https://alphaefficiency.com/dark-mode-glassmorphism)
- [SaaS Landing Page Mistakes - UX Planet](https://uxplanet.org/i-reviewed-250-saas-landing-pages-avoid-these-10-common-design-mistakes-a1a8499e6ee8)
- [Framer Motion + Next.js App Router hydration issue](https://github.com/vercel/next.js/issues/49279)

---
*Research completed: 2026-02-06*
*Ready for roadmap: yes*
