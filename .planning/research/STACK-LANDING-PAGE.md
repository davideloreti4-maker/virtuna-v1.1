# Technology Stack: v3.1 Landing Page Redesign

**Project:** Virtuna v3.1 Landing Page
**Researched:** 2026-02-06
**Mode:** Stack additions for Raycast-style SaaS landing page
**Scope:** NEW capabilities only (existing stack validated, not re-researched)

---

## Executive Summary

The landing page redesign requires **zero new package dependencies**. The existing stack already contains everything needed: `motion` (Framer Motion successor) for scroll-triggered animations, `next/image` for product screenshot optimization, 4 pre-built motion components for section reveals, and a full design system for visual composition. The only actions are a dependency cleanup (remove duplicate `framer-motion` package) and minor configuration updates (`next.config.ts` image formats, CSS smooth scroll).

---

## Existing Stack (Validated -- No Changes)

| Technology | Version | Status |
|------------|---------|--------|
| Next.js | 16.1.5 | Current -- latest major |
| React | 19.2.3 | Current |
| TypeScript | ^5 | Current |
| Tailwind CSS | v4 | Current |
| `motion` | 12.29.2 | Functional, update to 12.33.0 recommended |
| `framer-motion` | 12.29.3 | **REMOVE** (duplicate, see cleanup below) |
| `react-intersection-observer` | 10.0.2 | Current (latest) |
| `@react-three/fiber` + `drei` | 9.5.0 / 10.7.7 | Installed, available for hero visuals |
| `@splinetool/react-spline` | 4.1.0 | Installed, available for hero visuals |
| `class-variance-authority` | 0.7.1 | Current |
| `clsx` + `tailwind-merge` | 2.1.1 / 3.4.0 | Current |
| `tw-animate-css` | 1.4.0 | Current |

---

## Critical Cleanup: Dual Animation Package

**Problem:** `package.json` lists BOTH `framer-motion` (^12.29.3) and `motion` (^12.29.2). All code imports from `motion/react`, which is the correct modern path. Having both installed causes bundle bloat and potential runtime conflicts from duplicate internal state.

**Action:** Remove `framer-motion`, keep and update `motion`.

```bash
npm uninstall framer-motion
npm install motion@latest
```

**Context:** Framer Motion was rebranded to Motion as an independent, multi-framework library. The `motion` package is the successor. The upgrade guide explicitly states: "Uninstall framer-motion and install motion." There are no breaking changes in Motion v12 for React.

**Confidence:** HIGH

**Sources:**
- [Motion upgrade guide](https://motion.dev/docs/react-upgrade-guide)
- [motion npm](https://www.npmjs.com/package/motion) -- v12.33.0 published 2026-02-06

---

## Capability Analysis: What the Landing Page Needs

### 1. Scroll-Triggered Section Reveals

**Need:** Sections fade/slide in as user scrolls down the page.

**Already have:** 4 motion components in `src/components/motion/`:

| Component | Effect | API Used |
|-----------|--------|----------|
| `FadeIn` | Opacity 0->1, y 20->0, ease-out cubic | `whileInView` |
| `FadeInUp` | Opacity 0->1, y 24->0, Raycast easing `[0.25, 0.1, 0.25, 1.0]` | `whileInView` |
| `SlideUp` | Opacity 0->1, y 60->0, ease-out expo | `whileInView` |
| `StaggerReveal` + `.Item` | Container orchestrates staggered children, 80ms delay | `whileInView` + `staggerChildren` |

All four components handle `useReducedMotion` for accessibility, support `once` viewport triggering, and have configurable `delay`/`duration`/`distance` props.

**Verdict:** No new package needed. These components cover every scroll-reveal pattern on a SaaS landing page.

**Landing page mapping:**

| Section | Component | Config |
|---------|-----------|--------|
| Hero headline + subtext | `FadeInUp` with staggered `delay` (0, 0.1, 0.2) | Default 24px distance |
| Feature cards grid | `StaggerReveal` wrapping `StaggerReveal.Item` children | 80ms stagger, 100ms initial delay |
| Product screenshot | `SlideUp` | 60px distance for dramatic entrance |
| Social proof / testimonials | `FadeIn` | Subtle 20px distance |
| CTA section | `FadeInUp` | Default |
| Footer | No animation (always visible at bottom) | N/A |

---

### 2. Hero Parallax Effect

**Need:** Product screenshot moves at different speed than background on scroll (subtle depth).

**Already have:** `motion/react` exports `useScroll` and `useTransform` -- available in the installed `motion` package with zero additional cost.

```tsx
import { motion, useScroll, useTransform } from "motion/react";

function HeroScreenshot() {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 0.3], [0, -60]);

  return (
    <motion.div style={{ y }}>
      <Image src="/images/landing/trending-screenshot.png" ... />
    </motion.div>
  );
}
```

**Verdict:** No new package needed. Motion's `useScroll` + `useTransform` handles parallax natively.

**Confidence:** HIGH -- These are core Motion APIs, not experimental.

---

### 3. Product Screenshot Optimization

**Need:** High-quality product screenshots (trending page, dashboard) that load fast.

**Already have:** `next/image` with Sharp built into Next.js 16.

**Configuration update needed for `next.config.ts`:**

```typescript
const nextConfig: NextConfig = {
  transpilePackages: ['three'],
  images: {
    formats: ['image/avif', 'image/webp'], // Enable AVIF (20% smaller than WebP)
    qualities: [75, 90], // 75 general, 90 for hero shots
    remotePatterns: [
      // ...existing patterns
    ],
  },
};
```

**Key Next.js 16 image changes to be aware of:**

| Change | Impact |
|--------|--------|
| `priority` prop deprecated | Use `preload` instead for above-the-fold images |
| `images.qualities` restricted | Must specify allowed quality values (was 1-100) |
| `minimumCacheTTL` = 4 hours default | Good for landing pages (no change needed) |
| AVIF support | Opt-in via `formats` config, 20% smaller than WebP |

**Product screenshot workflow:**
1. Capture actual screenshots of trending page and dashboard at 2560x1440 (2x)
2. Save as PNG in `/public/images/landing/`
3. Next.js optimizes to AVIF/WebP at serve time (60-80% size reduction)
4. Hero screenshot: `<Image preload ...>` for LCP optimization
5. Below-fold screenshots: Default lazy loading (automatic)

**Browser frame mockup:** Build as a Tailwind CSS component (rounded corners, traffic light dots, toolbar bar). This is a 20-line component, NOT a library dependency.

**Verdict:** No new package. Config change only.

**Confidence:** HIGH -- Verified via [Next.js 16 blog](https://nextjs.org/blog/next-16) and [Image component docs](https://nextjs.org/docs/app/api-reference/components/image).

---

### 4. Smooth Scroll for Navbar Anchors

**Need:** Clicking navbar links (#features, #pricing) scrolls smoothly to section.

**Context:** Next.js 16 explicitly removed automatic `scroll-behavior: smooth` that existed in earlier versions.

**Solution:** One CSS line in `globals.css`:

```css
html {
  scroll-behavior: smooth;
}
```

For programmatic scrolling with offset (fixed navbar compensation):

```typescript
// No library -- native browser API
function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}
```

**Alternatives rejected:**

| Library | Why NOT |
|---------|---------|
| Lenis (~15KB) | Designed for scroll-hijacking physics. Overkill for anchor navigation. |
| `react-scroll` | Last meaningful update 2023. Native `scrollIntoView` is better. |
| `locomotive-scroll` (~50KB) | Custom scroll container paradigm. Wrong tool entirely. |

**Verdict:** CSS only. No package needed.

**Confidence:** HIGH -- CSS `scroll-behavior: smooth` has 97%+ browser support.

---

### 5. Hero Abstract Visual

**Need:** Visually striking hero background/visual that matches Raycast aesthetic.

**Three options using EXISTING packages:**

| Option | Approach | Bundle Cost | LCP Impact |
|--------|----------|-------------|------------|
| **A: CSS/Design System (recommended)** | Layer `GradientGlow` + `GradientMesh` + `NoiseTexture` + floating animated `GlassCard` components | 0 KB additional | None |
| B: Spline 3D scene | Use existing `@splinetool/react-spline` | 0 KB additional (installed) | 1-5MB scene file |
| C: R3F 3D scene | Use existing `@react-three/fiber` + `drei` | 0 KB additional (installed) | ~150KB Three.js |

**Recommendation: Option A** -- Combine existing design system effects for a hero visual that is:
- Zero additional bundle cost
- Fast LCP (no 3D asset loading)
- Fully matches the existing Raycast design language
- Animatable with existing motion components
- Works on all devices (no WebGL required)

Existing components available for composition:
- `GradientGlow` -- radial gradient backgrounds
- `GradientMesh` -- mesh gradient with R3F (already lightweight)
- `NoiseTexture` -- film grain overlay
- `ChromaticAberration` -- RGB split effect
- `GlassCard` -- glassmorphism card with Raycast styling
- `GlassPanel` -- glass surface with blur

**Defer 3D (Spline/R3F) to post-MVP** if the CSS approach doesn't deliver enough visual impact. The packages are already installed and ready.

**Confidence:** MEDIUM -- Visual design is subjective. The technical approach is sound, but whether it looks "good enough" requires implementation and iteration.

---

### 6. v0 Generation Workflow

**Need:** Each landing page section generated individually with v0, reviewed, then assembled.

**This is a workflow, not a package dependency.**

**v0 prompt strategy per section:**

1. **Include in every prompt:**
   - Tailwind v4 `@theme` color tokens (coral scale, grays, border opacity values)
   - Available motion component names (`FadeInUp`, `StaggerReveal`, etc.)
   - Raycast design rules (border `white/[0.06]`, radius 12px cards, no colored tinting)
   - `"use client"` directive only for interactive sections

2. **v0 output adaptation:**
   - v0 defaults to shadcn/ui components -- these MUST be swapped for Virtuna design system components
   - Replace `<Card>` with `<GlassCard>`, `<Button>` with Virtuna `<Button>`, etc.
   - Replace shadcn color classes with Virtuna token classes

3. **v0 Design System Registry (skip for v3.1):**
   - v0 supports custom registries that teach it your components
   - Requires building a `registry.json` endpoint with component source + metadata
   - **Not worth the setup cost for ~6-8 sections.** Manually including design context in prompts is faster.
   - Consider if Virtuna design system is used across multiple projects later.

**Confidence:** MEDIUM -- v0 generates valid React/Tailwind code, but quality with custom design tokens varies. Each section will need manual adaptation.

---

## What NOT to Add

| Package | Why NOT |
|---------|---------|
| `gsap` / `@gsap/react` | Motion already covers all scroll-triggered, stagger, and parallax patterns. Adding GSAP creates two competing animation paradigms in the codebase. |
| `lenis` / `@studio-freight/lenis` | CSS `scroll-behavior: smooth` + native `scrollIntoView` covers anchor navigation. Lenis is for scroll-hijacking sites. |
| `aos` (Animate On Scroll) | Strictly inferior to existing Motion `whileInView` components. CSS-class-based, no spring physics, no gestures. |
| `react-scroll` | Dead library. Native APIs are better. |
| `locomotive-scroll` | Custom scroll container paradigm. Wrong tool for a SaaS landing page. |
| `swiper` / `embla-carousel` | No carousel planned. If testimonials need one later, build with Motion + CSS `scroll-snap`. |
| `@vercel/og` | Only needed for dynamic OG images. Static OG image is simpler for a landing page. |
| `sharp` (manual install) | Next.js bundles Sharp internally. Never install separately. |
| `tailwindcss-animate` | Project already has `tw-animate-css` v1.4.0. Don't add a competing utility. |
| `shadcn/ui` | The project has its OWN 36-component design system. shadcn would conflict. v0 output using shadcn must be adapted to Virtuna components. |
| `react-countup` / `countup.js` | If stats counters are needed, Motion's `useMotionValue` + `useTransform` + `animate` handle number animations natively. |

---

## Installation Summary

```bash
# Clean up dual animation package
npm uninstall framer-motion

# Update motion to latest
npm install motion@latest

# That's it. Zero new packages.
```

**Total new dependencies: 0**
**Removed dependencies: 1 (framer-motion)**
**Updated dependencies: 1 (motion 12.29.2 -> 12.33.0)**

---

## Configuration Changes

### next.config.ts

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['three'],
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [75, 90],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'fastly.picsum.photos',
      },
    ],
  },
};

export default nextConfig;
```

### globals.css (addition)

```css
html {
  scroll-behavior: smooth;
}
```

### Image component usage (Next.js 16 compliance)

```tsx
// BEFORE (deprecated in Next.js 16)
<Image src="/hero.png" priority alt="..." />

// AFTER
<Image src="/hero.png" preload alt="..." />
```

---

## Integration Points with Existing Stack

| Existing Capability | How Landing Page Uses It |
|---|---|
| `FadeIn`, `FadeInUp`, `SlideUp`, `StaggerReveal` | Wrap every section for scroll-triggered reveals |
| `GlassCard`, `GlassPanel` | Feature cards, testimonial cards, product showcase frames |
| `GradientGlow`, `GradientMesh` | Hero abstract visual, section dividers |
| `NoiseTexture`, `ChromaticAberration` | Hero visual depth and texture |
| `Button` (primary/secondary) | CTAs ("Get started", "Learn more") |
| `Heading`, `Text` (Typography) | All text with Raycast-matched sizes and weights |
| Design tokens (coral, grays, borders) | Consistent Raycast branding across all sections |
| `next/image` | Product screenshots with AVIF/WebP optimization |
| Tailwind v4 `@theme` block | v0 prompts reference token names directly |
| `useReducedMotion` in all motion components | Accessibility compliance built-in |
| `@phosphor-icons/react` | Section icons, feature icons |

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Animation (no new package) | HIGH | 4 existing motion components verified in codebase, Motion v12 APIs confirmed |
| Image optimization (config only) | HIGH | Next.js 16 blog + official docs verified |
| Smooth scroll (CSS only) | HIGH | CSS spec, 97%+ browser support |
| Dual-package cleanup | HIGH | Motion upgrade guide explicitly documents this |
| Hero visual (CSS approach) | MEDIUM | Technical approach sound, visual outcome subjective |
| v0 workflow (manual prompts) | MEDIUM | v0 works but needs per-section manual adaptation |

---

## Sources

### Verified (HIGH confidence)
- [Motion npm package](https://www.npmjs.com/package/motion) -- v12.33.0 latest (2026-02-06)
- [Motion scroll animations docs](https://www.framer.com/motion/scroll-animations/)
- [Motion upgrade guide](https://motion.dev/docs/react-upgrade-guide)
- [Next.js 16 release blog](https://nextjs.org/blog/next-16)
- [Next.js Image component docs](https://nextjs.org/docs/app/api-reference/components/image)
- [react-intersection-observer npm](https://www.npmjs.com/package/react-intersection-observer) -- v10.0.2 latest
- [CSS scroll-behavior MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-behavior)

### Consulted (MEDIUM confidence)
- [v0 documentation](https://v0.dev/docs)
- [v0 design systems](https://vercel.com/blog/maximizing-outputs-with-v0-from-ui-generation-to-code-creation)
- [SaaS landing page trends 2026](https://www.saasframe.io/blog/10-saas-landing-page-trends-for-2026-with-real-examples)
- [Raycast landing page analysis](https://www.raycast.com)
- [CSS scroll-driven animations MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations)

---

*Research completed: 2026-02-06*
*Ready for roadmap creation*
