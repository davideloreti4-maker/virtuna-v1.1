# Architecture: Raycast-Style Landing Page Integration

**Domain:** Landing page redesign for existing Next.js SaaS app
**Researched:** 2026-02-06
**Confidence:** HIGH

---

## Executive Summary

The Virtuna codebase already has the ideal architecture for a landing page redesign. The existing `(marketing)` route group with its own root layout cleanly separates landing page concerns from the `(app)` dashboard. The existing `src/components/landing/` directory with 12 section components provides the structural pattern to follow. The redesign replaces these components with Raycast-style equivalents -- no routing changes, no layout rewrites, no architectural migration needed.

The v0 workflow (generate each section individually, then adapt to the design system) maps perfectly to this component-per-section pattern. Each section is an independent component that can be built, reviewed, and merged incrementally.

---

## Current Architecture (As-Is)

### Route Structure

```
src/app/
  globals.css              # Shared design tokens (@theme block)
  (marketing)/             # Route group: landing + public pages
    layout.tsx             # Root layout: Satoshi + Funnel Display fonts, Header
    page.tsx               # Landing page: composes 7 section components
    coming-soon/           # Placeholder page
    showcase/              # Component library showcase (7 sub-routes)
    primitives-showcase/
    viral-results-showcase/
    viral-score-test/
    viz-test/
  (app)/                   # Route group: authenticated dashboard
    layout.tsx             # Root layout: fonts + AppShell + ToastProvider
    dashboard/
    trending/
    settings/
```

### Component Architecture

```
src/components/
  landing/                 # Landing page sections (12 files)
    index.ts               # Barrel exports
    hero-section.tsx       # "use client" - FadeIn animations
    backers-section.tsx    # "use client" - FadeIn + Image logos
    features-section.tsx   # "use client" - FadeIn + FeatureCard grid
    stats-section.tsx      # "use client" - FadeIn + ComparisonChart
    case-study-section.tsx
    partnership-section.tsx
    faq-section.tsx        # "use client" - Accordion (Radix)
    feature-card.tsx       # Sub-component
    persona-card.tsx       # Sub-component
    comparison-chart.tsx   # Sub-component
    testimonial-quote.tsx  # Sub-component
  ui/                      # Design system (22 files, 36+ components)
  motion/                  # Animation wrappers (8 files)
    fade-in.tsx, fade-in-up.tsx, slide-up.tsx
    stagger-reveal.tsx, hover-scale.tsx
    page-transition.tsx, frozen-router.tsx
  primitives/              # Glass components (9 files)
    GlassCard.tsx, GlassPanel.tsx, GlassPill.tsx
    GlassInput.tsx, GlassTextarea.tsx
    GradientGlow.tsx, GradientMesh.tsx, TrafficLights.tsx
  effects/                 # Visual effects (3 files)
    chromatic-aberration.tsx, noise-texture.tsx
  layout/                  # Shared layout (4 files)
    header.tsx, footer.tsx, container.tsx
  app/                     # Dashboard-specific (25 files)
  trending/                # Trending page (8 files)
  visualization/           # Data viz (8 files)
  viral-results/           # Results components
```

### Key Observations

1. **Both route groups have independent root layouts** with their own `<html>` and `<body>` tags. Navigation between them triggers full page loads (expected behavior).

2. **All 7 current landing sections are "use client"** because they use `FadeIn` (framer-motion). This is the correct pattern -- animation requires client hydration. The actual content is static (no data fetching).

3. **The page.tsx is a pure composition file** -- it imports sections and arranges them vertically. Zero logic, zero state. This is the ideal pattern for the redesign.

4. **Design tokens are shared** via `globals.css` @theme block. Both route groups import the same CSS. The landing page redesign can use all existing tokens.

5. **Header and Footer are in `src/components/layout/`** and shared across marketing pages.

---

## Recommended Architecture (To-Be)

### Route Structure: No Changes Needed

The existing `(marketing)` route group is the correct home. The landing page stays at `/` via `(marketing)/page.tsx`. No new route groups, no restructuring.

```
src/app/
  (marketing)/
    layout.tsx             # MODIFY: update metadata for new branding
    page.tsx               # REPLACE: new section composition
    ...                    # All other routes unchanged
```

**Rationale:** The route architecture is already optimized. Two separate root layouts give clean separation between marketing (Header + minimal chrome) and app (AppShell + sidebar + toast). Changing this would be pure churn.

### Component Organization: Replace `src/components/landing/`

The redesign replaces the contents of `src/components/landing/` with Raycast-style sections. The directory structure stays the same; the components change.

#### Components to REMOVE (current societies.io landing)

| Component | Reason |
|-----------|--------|
| `hero-section.tsx` | Replaced by Raycast-style hero |
| `backers-section.tsx` | Replaced by logo cloud / social proof |
| `features-section.tsx` | Replaced by Raycast-style feature showcase |
| `feature-card.tsx` | Replaced by new feature card design |
| `stats-section.tsx` | Replaced or absorbed into new sections |
| `comparison-chart.tsx` | Replaced or absorbed |
| `case-study-section.tsx` | Replaced by product demo / testimonials |
| `partnership-section.tsx` | Replaced or removed |
| `faq-section.tsx` | May keep with restyled design |
| `persona-card.tsx` | Specific to old hero, removed |
| `testimonial-quote.tsx` | Replaced by new testimonial pattern |

#### Components to CREATE (Raycast-style landing)

Based on the Raycast landing page structure (12 sections), adapted for Virtuna:

| Component | Type | Reuses Existing? |
|-----------|------|-----------------|
| `hero-section.tsx` | New | Button, FadeIn, Container |
| `logo-cloud-section.tsx` | New | Image (logos), FadeIn |
| `product-showcase-section.tsx` | New | GlassCard, FadeIn, Image |
| `features-grid-section.tsx` | New | Card, FadeIn, StaggerReveal |
| `ai-capabilities-section.tsx` | New | GlassPanel, GradientGlow |
| `testimonials-section.tsx` | New | TestimonialCard, Avatar |
| `use-cases-section.tsx` | New | Tabs, Card, FadeIn |
| `stats-section.tsx` | New | FadeIn (animated counters) |
| `integrations-section.tsx` | New | ExtensionCard, CategoryTabs |
| `cta-section.tsx` | New | Button, GradientGlow |
| `faq-section.tsx` | New | AccordionRoot, FadeIn |
| `footer-section.tsx` | Modify | Existing Footer, restyle |

#### Components to KEEP (reuse from design system)

| Category | Components | Notes |
|----------|-----------|-------|
| **UI primitives** | Button, Card, GlassCard, Badge, Avatar, Tabs, Accordion, Input | Direct reuse |
| **Motion** | FadeIn, FadeInUp, SlideUp, StaggerReveal, HoverScale | Direct reuse |
| **Primitives** | GlassCard, GlassPanel, GlassPill, GradientGlow, GradientMesh | Direct reuse |
| **Effects** | ChromaticAberration, NoiseTexture | Direct reuse |
| **Layout** | Container, Header, Footer | Modify Header/Footer styling |
| **UI composites** | TestimonialCard, ExtensionCard, CategoryTabs | Direct reuse |

### New Components Needed (Landing-Specific)

These are components that don't exist in the design system and must be created for the landing page:

| Component | Purpose | Location |
|-----------|---------|----------|
| `animated-counter.tsx` | Count-up animation for stats | `components/landing/` |
| `product-screenshot.tsx` | Framed screenshot with glow | `components/landing/` |
| `video-embed.tsx` | Product demo video player | `components/landing/` |
| `logo-marquee.tsx` | Scrolling logo ticker | `components/landing/` |
| `feature-bento.tsx` | Bento grid feature layout | `components/landing/` |
| `section-header.tsx` | Reusable section label + heading + description | `components/landing/` |

**Decision: Keep landing-specific components in `components/landing/`, not in `components/ui/`.** These are presentation-layer components tied to the landing page layout. They don't belong in the general design system.

---

## Server vs Client Component Strategy

### The Current Problem

Every existing landing section is `"use client"` because it uses `FadeIn` (framer-motion). This means the entire landing page ships as client JavaScript. For a marketing page optimized for SEO and LCP, this is suboptimal.

### Recommended Strategy

**Principle: Server components by default. Client boundary at the animation wrapper, not the section.**

```
Section Component (Server)     "use client" boundary
  |                                   |
  v                                   v
<section>                        <FadeIn>
  <Container>                      <div>animated content</div>
    <SectionHeader />             </FadeIn>
    <FadeIn>  <-- client island
      <FeatureGrid />
    </FadeIn>
  </Container>
</section>
```

#### Per-Section Classification

| Section | Render | Why |
|---------|--------|-----|
| Hero | **Client** | Scroll animations, 3D/Spline element, CTA hover states |
| Logo Cloud | **Server** | Static logos, no interaction. Use CSS animation for marquee |
| Product Showcase | **Client** | Image transitions, scroll-triggered reveals |
| Features Grid | **Client** | StaggerReveal, HoverScale on cards |
| AI Capabilities | **Client** | GradientGlow animations, scroll triggers |
| Testimonials | **Client** | Carousel/auto-scroll, or server if static grid |
| Use Cases | **Client** | Tab switching (Radix Tabs) |
| Stats | **Client** | Animated counters on scroll |
| Integrations | **Client** | CategoryTabs filtering |
| CTA | **Server** | Static content, link-based CTAs |
| FAQ | **Client** | Accordion expand/collapse (Radix) |
| Footer | **Server** | Static links, can use SSR icons |

**Practical reality:** Most sections will be client components because framer-motion animations are a core part of the Raycast aesthetic. The optimization is to keep the *section wrapper* as a server component where possible and push `"use client"` down to the smallest necessary boundary.

**However:** Don't over-engineer this. The current pattern (section-level "use client") works fine and is simpler. The landing page is a single route that benefits from full client-side hydration for smooth scroll animations. Micro-optimizing server/client boundaries adds complexity for marginal gain on a page that will be statically generated anyway.

**Recommendation: Keep section-level "use client" for sections with animations. Use server components only for purely static sections (logo cloud, CTA, footer).** This matches the existing pattern and avoids unnecessary refactoring.

---

## Image Handling Strategy

### Product Screenshots

Use `next/image` with these patterns:

```tsx
// Hero screenshot - above the fold, priority load
<Image
  src="/images/landing/product-hero.png"
  alt="Virtuna dashboard showing viral prediction scores"
  width={1200}
  height={800}
  priority              // Preload for LCP
  quality={90}          // High quality for hero
  placeholder="blur"    // Blur-up while loading
  blurDataURL="..."     // Generate at build time
  className="rounded-xl shadow-xl"
/>

// Below-fold screenshots - lazy loaded (default)
<Image
  src="/images/landing/feature-trending.png"
  alt="Trending feed with video cards"
  width={800}
  height={600}
  sizes="(max-width: 768px) 100vw, 50vw"  // Responsive sizing
  quality={85}
/>
```

### Image Asset Organization

```
public/images/landing/
  hero/
    product-hero.png          # Main dashboard screenshot (1200x800)
    product-hero-mobile.png   # Mobile variant (600x800)
  features/
    feature-trending.png      # Trending page screenshot
    feature-analysis.png      # Analysis view screenshot
    feature-results.png       # Results view screenshot
  social/
    og-image.png              # 1200x630 OG image
    twitter-card.png          # 1200x600 Twitter card
  logos/
    ...                       # Already exists with backer logos
```

### OG Image Strategy

Use Next.js file-based metadata for OG images:

```
src/app/(marketing)/
  opengraph-image.png         # Static 1200x630 OG image
  twitter-image.png           # Static 1200x600 Twitter card
```

Or use dynamic generation with `opengraph-image.tsx` for route-specific cards.

### Image Optimization Checklist

- [ ] All hero images use `priority` prop
- [ ] All below-fold images use default lazy loading
- [ ] Use `sizes` prop for responsive images
- [ ] Store images locally in `public/` (not remote) for build-time optimization
- [ ] Generate `blurDataURL` for hero images
- [ ] Compress source PNGs before adding to repo (target < 500KB per screenshot)
- [ ] Use WebP source format where possible

---

## SEO Architecture

### Metadata Implementation

Update `(marketing)/layout.tsx` metadata for the new landing page:

```tsx
export const metadata: Metadata = {
  metadataBase: new URL('https://virtuna.ai'),
  title: {
    default: 'Virtuna | AI-Powered Viral Prediction for Creators',
    template: '%s | Virtuna',
  },
  description: 'Military-grade data intelligence for social media creators. Predict viral potential, discover trending opportunities, and optimize your content strategy.',
  keywords: ['viral prediction', 'AI analytics', 'social media intelligence', 'trending content', 'creator tools'],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://virtuna.ai',
    siteName: 'Virtuna',
    title: 'Virtuna | AI-Powered Viral Prediction for Creators',
    description: 'Military-grade data intelligence for social media creators.',
    images: [{ url: '/images/landing/social/og-image.png', width: 1200, height: 630, alt: 'Virtuna Dashboard' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Virtuna | AI-Powered Viral Prediction',
    description: 'Military-grade data intelligence for social media creators.',
    images: ['/images/landing/social/twitter-card.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};
```

### Structured Data (JSON-LD)

Add to `(marketing)/page.tsx` as a server component script:

```tsx
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Virtuna',
  applicationCategory: 'BusinessApplication',
  description: 'AI-powered viral prediction platform for social media creators',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  creator: {
    '@type': 'Organization',
    name: 'Virtuna',
    url: 'https://virtuna.ai',
  },
};

// In page component:
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
/>
```

### Semantic HTML

Each section should use semantic elements:

```tsx
<main>
  <section aria-labelledby="hero-heading">...</section>
  <section aria-labelledby="features-heading">...</section>
  <section aria-labelledby="testimonials-heading">...</section>
  ...
</main>
<footer role="contentinfo">...</footer>
```

---

## v0 Integration Workflow

### How v0-Generated Code Maps to This Architecture

The v0 workflow is: prompt one section at a time, get JSX output, adapt it to the existing design system.

#### Step-by-Step Process Per Section

1. **Prompt v0** with section requirements + design reference screenshots
2. **Receive** v0 output (JSX + Tailwind, typically using shadcn/ui conventions)
3. **Adapt** to Virtuna design system:
   - Replace shadcn/ui imports with `@/components/ui` equivalents
   - Replace hardcoded colors with design token classes (`bg-background`, `text-foreground-muted`, etc.)
   - Replace inline animations with motion components (`FadeIn`, `StaggerReveal`)
   - Replace shadcn `cn()` with local `cn()` from `@/lib/utils`
   - Add Raycast design rules: border `white/[0.06]`, radius scale, inset shadows
4. **Place** adapted component in `src/components/landing/[section-name].tsx`
5. **Add** to barrel export in `src/components/landing/index.ts`
6. **Compose** in `(marketing)/page.tsx`

#### v0 Prompt Template for Consistent Output

```
Create a [section type] section for a dark-mode SaaS landing page.

Design constraints:
- Background: #07080a (near-black)
- Text: off-white (#f5f5f5) primary, #9c9c9d secondary, #848586 muted
- Accent: coral #FF7F50 (use sparingly, only CTAs)
- Borders: rgba(255,255,255,0.06)
- Border radius: 12px cards, 8px inputs, 6px small elements
- Font: Inter/system for body, display font for headings
- Glass effects: rgba(17,18,20,0.75) bg + blur(5px) + white/6% border
- Shadows: inset rgba(255,255,255,0.1) 0 1px 0 0 for cards

Content:
[specific section content]

Technical:
- React functional component with TypeScript
- Tailwind CSS classes only (no inline styles except backdrop-filter)
- next/image for all images
- Framer Motion for scroll animations
- Server component unless interactivity needed
```

#### Adaptation Mapping (v0 output -> Virtuna)

| v0 Generates | Virtuna Equivalent |
|--------------|-------------------|
| `import { Button } from "@/components/ui/button"` | `import { Button } from "@/components/ui"` |
| `<Card>` (shadcn) | `<Card>` or `<GlassCard>` |
| `className="bg-zinc-900"` | `className="bg-background"` |
| `className="text-zinc-400"` | `className="text-foreground-muted"` |
| `className="border-zinc-800"` | `className="border-border"` |
| `className="rounded-lg"` | `className="rounded-lg"` (same) |
| `motion.div` (inline) | `<FadeIn>` / `<SlideUp>` wrappers |
| `className="bg-primary"` | `className="bg-accent"` |

---

## Data Flow

### No Data Fetching on Landing Page

The landing page is 100% static content. No API calls, no database queries, no Supabase interaction. All content (copy, stats, testimonials, FAQ items) is hardcoded in component files or extracted to constant arrays within the same file.

The only "data" is:
- **Static copy** - Hardcoded in components
- **Image assets** - From `public/images/landing/`
- **Logo SVGs** - From `public/logos/`

This means the page can be fully statically generated at build time, giving optimal LCP and TTFB.

### Middleware Interaction

The existing Supabase auth middleware (`src/middleware.ts`) runs on all routes but is a no-op for unauthenticated marketing pages. It won't interfere with landing page performance. The matcher pattern already excludes static assets.

---

## Suggested Build Order

Build sections in this order for maximum incremental progress and visual completeness at each step.

### Phase 1: Foundation (visible landing page with hero)

| Order | Section | Rationale |
|-------|---------|-----------|
| 1 | **Header restyle** | First thing users see, sets the tone |
| 2 | **Hero section** | Highest visual impact, establishes new design language |
| 3 | **Footer restyle** | Bookends the page, completing the minimal viable landing |

**Milestone:** Deployable landing page with hero + header + footer.

### Phase 2: Social Proof & Trust

| Order | Section | Rationale |
|-------|---------|-----------|
| 4 | **Logo cloud** | Quick win, builds credibility immediately below hero |
| 5 | **Stats section** | The 86% accuracy metric is a key differentiator |
| 6 | **Testimonials** | Social proof completes the trust triangle |

**Milestone:** Landing page that convinces. Header -> Hero -> Logos -> Stats -> Testimonials -> Footer.

### Phase 3: Product Story

| Order | Section | Rationale |
|-------|---------|-----------|
| 7 | **Product showcase** | Show, don't tell. Screenshots of the actual product |
| 8 | **Features grid** | Detail the value propositions |
| 9 | **AI capabilities** | Highlight the technology differentiator |

**Milestone:** Full product story told. Visitor understands what Virtuna does and why it's better.

### Phase 4: Conversion & Polish

| Order | Section | Rationale |
|-------|---------|-----------|
| 10 | **Use cases / integrations** | Show breadth of application |
| 11 | **FAQ section** | Handle objections |
| 12 | **CTA section** | Final conversion push before footer |
| 13 | **SEO metadata + JSON-LD** | Technical completeness |
| 14 | **OG images** | Social sharing readiness |

**Milestone:** Complete, production-ready landing page.

### Build Order Rationale

- **Hero first** because it's the single highest-impact element and establishes the Raycast design language for all subsequent sections
- **Social proof before features** because trust signals (logos, stats, testimonials) are more persuasive than feature lists for a SaaS product
- **Product screenshots before feature descriptions** because showing the product is more convincing than describing it
- **FAQ and CTA last** because they're conversion-layer elements that only matter once the page has substance
- **SEO metadata last** because it's invisible to the user and can be added after visual completeness

---

## Integration Points Summary

| Integration Point | Status | Action Needed |
|-------------------|--------|--------------|
| Route structure `(marketing)/page.tsx` | Exists | Replace section imports |
| Marketing layout `(marketing)/layout.tsx` | Exists | Update metadata, possibly fonts |
| Design tokens `globals.css` @theme | Exists | No changes needed |
| UI components `components/ui/` | Exists (22 files) | Direct reuse |
| Motion components `components/motion/` | Exists (8 files) | Direct reuse |
| Primitives `components/primitives/` | Exists (9 files) | Direct reuse |
| Effects `components/effects/` | Exists (3 files) | Direct reuse |
| Layout components `components/layout/` | Exists (4 files) | Restyle Header + Footer |
| Landing components `components/landing/` | Exists (12 files) | Replace all section files |
| Image assets `public/images/landing/` | Exists (partial) | Add product screenshots |
| Barrel exports `components/landing/index.ts` | Exists | Update exports for new sections |
| Middleware `middleware.ts` | Exists | No changes needed |
| Next config `next.config.ts` | Exists | Possibly add image domains |

---

## Anti-Patterns to Avoid

### 1. Creating a Parallel Component System
**Don't:** Create `components/landing-v2/` alongside `components/landing/`. This leads to confusion about which is current.
**Do:** Replace files in `components/landing/` directly. Use git history if you need the old versions.

### 2. Mixing Landing Data with App Data
**Don't:** Import from `lib/mock-data.ts` for landing page content.
**Do:** Keep landing content as const arrays within section components or in a `components/landing/data.ts` file.

### 3. Over-Engineering Server/Client Boundaries
**Don't:** Create wrapper components just to push "use client" down one level.
**Do:** Mark sections as "use client" when they need framer-motion. It's simple, it works, and Next.js static generation handles the rest.

### 4. Using Remote Images for Product Screenshots
**Don't:** Host product screenshots on an external CDN and use `remotePatterns`.
**Do:** Keep screenshots in `public/images/landing/` for build-time optimization with automatic blur placeholders.

### 5. Duplicating Design Tokens
**Don't:** Add new color values or custom classes for landing-specific styling.
**Do:** Use existing design tokens from `globals.css`. If the Raycast design language needs a new token, add it to the @theme block so it's available everywhere.

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Route structure | HIGH | Verified directly in codebase -- `(marketing)` group exists and works |
| Component reuse | HIGH | Audited all 22 UI + 8 motion + 9 primitive components |
| Image handling | HIGH | Next.js Image API is stable and well-documented |
| SEO metadata | HIGH | Next.js Metadata API verified via official docs |
| v0 workflow | MEDIUM | Based on v0 docs + common integration patterns; actual v0 output quality varies |
| Build order | MEDIUM | Based on landing page best practices; actual order may shift based on asset availability |
| Server/client split | HIGH | Verified current pattern in codebase + Next.js official guidance |

---

## Sources

- [Next.js Route Groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups) - Route group architecture
- [Next.js Image Component](https://nextjs.org/docs/app/getting-started/images) - Image optimization
- [Next.js Metadata API](https://nextjs.org/docs/app/api-reference/functions/generate-metadata) - SEO metadata
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) - Rendering strategy
- [Raycast Landing Page (Lapa Ninja)](https://www.lapa.ninja/post/raycast-2/) - Raycast design reference
- [v0 Documentation](https://v0.app/docs) - v0 integration workflow
- [Maximizing outputs with v0 (Vercel Blog)](https://vercel.com/blog/maximizing-outputs-with-v0-from-ui-generation-to-code-creation) - v0 best practices
- [Next.js SEO Guide 2026](https://www.djamware.com/post/697a19b07c935b6bb054313e/next-js-seo-optimization-guide--2026-edition) - SEO patterns
