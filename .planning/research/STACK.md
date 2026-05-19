# Technology Stack — Landing Craft Additions

**Project:** Virtuna — Linear Landing Clone milestone
**Researched:** 2026-05-19
**Scope:** Additions and configuration changes needed on top of the existing Next.js 16.1.5 / React 19 / Tailwind v4 / shadcn stack to reach top-tier production craft quality on a single-page landing route.

---

## Existing Stack (Do Not Re-research)

Already installed and wired — no action unless noted:

| Package | Installed Version | Status |
|---------|------------------|--------|
| `next` | 16.1.5 | Current |
| `react` / `react-dom` | 19.2.3 | Current |
| `tailwindcss` | v4 | Current |
| `motion` (framer-motion) | 12.34.0 | Installed, import via `motion/react` |
| `framer-motion` | 12.34.0 | Installed as alias to `motion` |
| `@react-three/fiber` | 9.5.0 | Installed |
| `@react-three/drei` | 10.7.7 | Installed |
| `three` | 0.182.0 | Installed |
| `@splinetool/react-spline` | 4.1.0 | Installed |
| `react-intersection-observer` | 10.0.2 | Installed |
| `sharp` | 0.34.5 | Installed (Next.js peer dep) |
| `tw-animate-css` | 1.4.0 | Installed |

**Motion import convention already established:** `from 'motion/react'` (not `framer-motion`). Two app files still use `framer-motion` directly — these should be migrated for consistency but are outside the landing route scope.

---

## Recommended Additions

### 1. Motion / Animation

**Decision: No new package. Optimize existing `motion` v12 for landing route.**

`motion` 12.34.0 is already installed and is the current canonical package (rebranded from framer-motion). The design system already has 7 motion components (`FadeInUp`, `FadeIn`, `StaggerReveal`, `HoverScale`, `SlideUp`, `PageTransition`, `FrozenRouter`) built on it. These are the correct foundation.

**What to add: `LazyMotion` + `m` component pattern for the landing route.**

The default `motion` import ships 34KB gzipped to the client. Using `LazyMotion` with `domAnimation` feature bundle cuts initial payload to 4.6KB gzipped; features load async at +15KB. This is a configuration pattern, not a new package.

```tsx
// In landing layout or landing page root
import { LazyMotion, domAnimation } from 'motion/react'

export function LandingMotionProvider({ children }: { children: React.ReactNode }) {
  return <LazyMotion features={domAnimation}>{children}</LazyMotion>
}
```

Then within landing components, replace `motion.div` with `m.div`:

```tsx
import { m } from 'motion/react'
// instead of: import { motion } from 'motion/react'
```

**For scroll-linked animations** (header opacity on scroll, parallax hero text, section counters): Use `useScroll` + `useTransform` from `motion/react`. Already available, no new import.

**For micro-interactions**: `whileHover`, `whileTap` on `m.*` elements. Zero new code.

**Bundle cost:** 0 new KB. Optimization saves ~29KB gzipped on initial load vs current unconstrained usage.

**Classification: Table-stakes optimization.** Landing pages at Linear/Stripe/Vercel caliber all keep motion off the critical path.

---

### 2. Smooth Scroll — Lenis

**Decision: Add `lenis` 1.3.23.**

Lenis is NOT currently installed. Native browser momentum scrolling lacks the eased inertia that defines premium SaaS landing experiences (linear.app, vercel.com). The library adds buttery physics-based scroll without breaking CSS `position: sticky` — a critical constraint for the sticky nav and any pinned scroll sections.

CSS scroll-driven animations (`animation-timeline: scroll()`) are NOT a replacement: Firefox support is incomplete as of 2025, and Lenis is required specifically for the smooth kinetics, not just for triggering animations.

**Integration with Next.js App Router:**

```tsx
// src/components/landing/lenis-provider.tsx
'use client'
import { ReactLenis } from 'lenis/react'

export function LenisProvider({ children }: { children: React.ReactNode }) {
  return (
    <ReactLenis root options={{ lerp: 0.08, duration: 1.2, smoothWheel: true }}>
      {children}
    </ReactLenis>
  )
}
```

Wrap only the landing layout — do NOT apply to app routes (it conflicts with modals/dialogs).

**Lenis + motion/react `useScroll` coexistence:** Lenis 1.x emits synthetic scroll events that `useScroll` observes correctly. No bridge required unless using GSAP ScrollTrigger (which we are not).

**Bundle cost:** ~40KB gzipped (unpackedSize 438KB). Small for what it delivers.

**Install:**
```bash
pnpm add lenis
```

**Classification: Table-stakes.** Smooth scroll is the single highest-leverage motion improvement for the craft bar. Noticeable immediately; its absence is equally noticeable on mobile.

---

### 3. Typography

**Decision: No new package. Two zero-cost configuration changes.**

**3a. Add the `opsz` axis to the Inter variable font load.**

Inter v4 ships an optical size (`opsz`) axis. When set, the font automatically adjusts stroke contrast and letterform details for small body text vs large display headings — the difference is subtle but measurable in display-scale type. Currently the project loads Inter without this axis, so all weights render with the same optical treatment regardless of size.

The existing `layout.tsx` already uses `next/font/google`. Add `axes: ['opsz']` — this is a single-line change:

```ts
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  axes: ['opsz'],  // ADD THIS
})
```

Then in CSS, enable automatic optical sizing:
```css
body {
  font-optical-sizing: auto; /* browsers apply opsz automatically with font-size */
}
```

This requires Next.js to download a slightly larger font file (opsz axis adds a small amount to the font binary) but it is self-hosted via `next/font` with zero network round-trips.

**Bundle cost:** ~0KB JS. Slight font file size increase (~5-10KB added to the Inter variable woff2), served from Vercel CDN.

**3b. Fluid type scale via CSS `clamp()` tokens in `@theme`.**

Do not install a fluid-type-scale npm package. The output of tools like fluid-type-scale.com is plain CSS — paste the generated `clamp()` values directly into the Tailwind `@theme` block as custom font-size tokens scoped to the landing route.

A minimal scale for a production landing (display / headline / subhead / body / small):

```css
@theme {
  /* Landing fluid type scale — viewport 375px → 1280px */
  --font-size-display:   clamp(2.5rem, 1.4rem + 4.5vw, 5.5rem);   /* 40px → 88px */
  --font-size-headline:  clamp(1.875rem, 1.2rem + 2.75vw, 3.5rem); /* 30px → 56px */
  --font-size-subhead:   clamp(1.25rem, 0.9rem + 1.5vw, 2rem);     /* 20px → 32px */
  --font-size-body-lg:   clamp(1.0625rem, 0.95rem + 0.5vw, 1.25rem); /* 17px → 20px */
}
```

These are then consumed as `text-[--font-size-display]` in Tailwind v4's arbitrary-value syntax, or registered as named utilities with `@utility`.

**Bundle cost:** 0 KB. Pure CSS.

**Classification (both): Table-stakes.** Linear-grade typography is the single clearest signal of production craft. Both changes are configuration-only — zero dependency weight.

---

### 4. Performance Tooling

#### 4a. Bundle Analyzer

**Decision: Add `@next/bundle-analyzer` 16.2.6 as dev dependency.**

Not installed. Essential for verifying that landing route additions (Lenis, LazyMotion features, R3F scene) stay within budget. Run before shipping each phase.

```ts
// next.config.ts — wrap existing withSentryConfig
import withBundleAnalyzer from '@next/bundle-analyzer'

const withAnalyzer = withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' })
export default withAnalyzer(withSentryConfig(nextConfig, sentryOptions))
```

```bash
ANALYZE=true pnpm build
```

Also available via the built-in experimental Turbopack analyzer (no extra dep):
```bash
pnpm next experimental-analyze
```

**Install:**
```bash
pnpm add -D @next/bundle-analyzer
```

**Bundle cost:** devDep only, zero production impact.

**Classification: Table-stakes for a production-quality milestone.** Every shipping phase should run a bundle check.

#### 4b. Web Vitals Reporting

**Decision: Use `next/web-vitals` built-in — no additional package needed.**

Next.js 16 ships `useReportWebVitals` in `next/web-vitals`. This tracks LCP, INP, CLS, FCP, TTFB without any additional npm package. Create a single client component and drop it in the landing layout:

```tsx
// src/components/landing/web-vitals.tsx
'use client'
import { useReportWebVitals } from 'next/web-vitals'

export function WebVitals() {
  useReportWebVitals((metric) => {
    // Log to console in dev; send to analytics endpoint in prod
    if (process.env.NODE_ENV === 'development') {
      console.log('[web-vital]', metric.name, Math.round(metric.value), metric.rating)
    }
  })
  return null
}
```

**Bundle cost:** 0 KB (already part of Next.js runtime).

**Classification: Table-stakes.** Proves the landing page meets performance targets before shipping.

#### 4c. Lighthouse CI

**Decision: Defer. Not worth the CI setup complexity for a single landing page milestone.**

`@lhci/cli` (0.15.1) is the correct package if CI integration is desired. The Vercel integration in the dashboard provides automated Lighthouse reports for every preview deployment, which covers this need without local CI config. Flag for a future DevOps milestone.

**Classification: Anti-feature for this milestone.** Vercel's built-in covers the need.

---

### 5. 3D / Canvas

**Decision: Use Spline (already installed) for one decorative hero element only. Wrap with strict lazy loading.**

The project already has `@splinetool/react-spline` 4.1.0, `@react-three/fiber` 9.5.0, `@react-three/drei` 10.7.7, and `three` 0.182.0 installed. The `SplineOrb` component already exists.

**Tradeoffs:**

| Approach | Gzipped Cost | Complexity | When |
|----------|-------------|-----------|------|
| CSS/SVG gradient orb | 0KB | None | Always available as fallback |
| Spline scene (lazy) | ~140KB runtime deferred | Medium | Hero visual interest |
| react-three-fiber custom | ~580KB three.js + R3F | High | Complex interactive scenes |
| OGL custom shader | ~35KB | Very high | Shader-art-grade effects |

**Recommendation:** One Spline scene, loaded dynamically with `next/dynamic` + `ssr: false` + `loading` prop to show a CSS placeholder while the runtime loads. Never block hero text rendering on the 3D scene.

```tsx
const SplineOrb = dynamic(
  () => import('@/components/visualization/SplineOrb').then(m => ({ default: m.SplineOrb })),
  { ssr: false, loading: () => <OrbPlaceholder /> }
)
```

Do NOT use `@react-three/fiber` directly in the landing route. It requires Three.js (~580KB gzipped) which is justified for the app's canvas hive visualization (1300+ nodes) but not for a landing page decorative element.

**No new packages needed.**

**Classification:**
- Spline decorative hero element: Differentiator (adds craft, manageable cost if lazy-loaded)
- R3F/Three.js landing usage: Anti-feature (bundle cost not justified for decorative-only use on a landing page)
- OGL: Anti-feature (too much custom shader authorship for this scope)

---

### 6. Image Optimization

**Decision: Configure AVIF in `next.config.ts`. No new packages needed.**

Sharp 0.34.5 is already installed as a Next.js peer dependency and handles all image format conversion server-side. The only missing piece is AVIF format configuration in `next.config.ts`:

```ts
const nextConfig: NextConfig = {
  transpilePackages: ['three'],
  images: {
    formats: ['image/avif', 'image/webp'],  // ADD THIS
    remotePatterns: [...],
  },
}
```

AVIF delivers 40-50% smaller files than WebP for photographic content and 20-30% smaller for illustrations. Browser support is now baseline (Chrome, Firefox, Safari 16.4+).

For landing page images, always specify `sizes` to generate a proper responsive srcset:

```tsx
<Image
  src="/hero-screenshot.png"
  alt="Virtuna dashboard"
  fill
  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 80vw, 1024px"
  priority  // for above-fold images only
/>
```

Use `priority` only for the single largest above-fold image (hero visual). Everything else gets lazy loading by default.

**Bundle cost:** 0 KB JS. Storage increases slightly (Next.js caches both AVIF and WebP variants), served from Vercel CDN.

**Classification: Table-stakes.** Core Web Vitals (LCP) depends on hero image delivery speed. AVIF is a free win.

---

## Complete Installation Command

```bash
# Single new runtime dep
pnpm add lenis

# Single new dev dep
pnpm add -D @next/bundle-analyzer
```

All other improvements are configuration changes to existing packages.

---

## Summary Table

| Area | Action | Package | Version | Bundle Cost (gzip) | Classification |
|------|--------|---------|---------|-------------------|----------------|
| Motion optimization | LazyMotion + `m.*` pattern | `motion` (existing) | 12.34.0 | -29KB saved | Table-stakes |
| Scroll smoothness | Add Lenis provider to landing layout | `lenis` (new) | 1.3.23 | +40KB | Table-stakes |
| Typography — optical | Add `axes: ['opsz']` to next/font Inter | `next/font` (existing) | — | ~0KB | Table-stakes |
| Typography — fluid scale | CSS `clamp()` tokens in @theme block | CSS only | — | 0KB | Table-stakes |
| Bundle analysis | Add `@next/bundle-analyzer` as devDep | `@next/bundle-analyzer` (new) | 16.2.6 | 0KB (devDep) | Table-stakes |
| Web Vitals | Use `next/web-vitals` built-in hook | `next/web-vitals` (existing) | — | 0KB | Table-stakes |
| AVIF images | Add `formats: ['image/avif', 'image/webp']` to next.config | `sharp` (existing) | 0.34.5 | 0KB | Table-stakes |
| 3D hero element | Lazy-load SplineOrb with CSS fallback | `@splinetool/react-spline` (existing) | 4.1.0 | ~140KB deferred | Differentiator |
| Lighthouse CI | Skip — Vercel dashboard covers it | — | — | — | Anti-feature (this milestone) |
| R3F in landing route | Do NOT add R3F to landing bundle | `@react-three/fiber` (existing, app-only) | — | -580KB avoided | Anti-feature |
| GSAP | Do NOT add — motion/react covers all needs | — | — | +250KB avoided | Anti-feature |

---

## Anti-Features (Explicit)

**Do not add:**

- **GSAP** (3.15.0): 250KB gzipped. `motion/react` covers every animation pattern needed (scroll-linked, viewport reveal, spring physics, stagger). GSAP's advantages are SVG animation and complex timelines — neither is required here.

- **AOS / ScrollReveal / similar**: One-trick scroll libs that conflict with the existing motion system. The DS already has `FadeInUp`, `StaggerReveal`, `FadeIn` — use them.

- **Framer (the design tool) templates or component libraries**: Any external "landing template" library will import its own design tokens and fight the existing Raycast-derived system. Every section is built from the 36-component DS.

- **react-three-fiber in the landing route**: Three.js is 580KB gzipped. Justified for the in-app canvas hive (1300 nodes), not for a landing page decorative element. Use Spline (lazy-loaded) instead.

- **React Spring**: The DS is already committed to `motion/react`. Two animation systems in one codebase create inconsistent easing and maintenance overhead.

- **Lottie/lottie-react**: Adds 60-80KB for JSON-defined animations. CSS + motion/react covers all landing animation needs.

- **Maximalist effect libraries** (framer-motion-3d, @theatre/core, motion-canvas): Complexity cost is not justified for a clean, minimalist SaaS landing. These conflict with the Linear/Raycast/Anthropic aesthetic direction explicitly called out in PROJECT.md.

---

## Configuration Changes Required (Non-Package)

1. **`next.config.ts`**: Add `images.formats: ['image/avif', 'image/webp']`
2. **`next.config.ts`**: Wrap with `@next/bundle-analyzer`
3. **`src/app/(marketing)/layout.tsx`**: Add `<LenisProvider>` wrapper
4. **`src/app/layout.tsx` and `src/app/(marketing)/layout.tsx`**: Add `axes: ['opsz']` to Inter font config
5. **`src/app/globals.css`**: Add fluid type scale tokens (`--font-size-display` etc.) to `@theme` block
6. **Landing route components**: Switch `motion.*` to `m.*` + `LazyMotion` for reduced initial payload

---

## Sources

- Context7: `/grx7/framer-motion` — scroll hooks, LazyMotion, whileInView patterns (HIGH confidence)
- Context7: `/darkroomengineering/lenis` — ReactLenis setup, Next.js App Router integration (HIGH confidence)
- Context7: `/vercel/next.js` — next/font variable axes, image formats, useReportWebVitals, bundle analyzer (HIGH confidence)
- motion.dev docs: [Reduce bundle size](https://motion.dev/docs/react-reduce-bundle-size) — LazyMotion 4.6KB vs 34KB full (HIGH confidence)
- npm registry: lenis 1.3.23, @next/bundle-analyzer 16.2.6, web-vitals 5.2.0, sharp 0.34.5 (HIGH confidence — live npm)
- [fluid-type-scale.com](https://www.fluid-type-scale.com/) — CSS clamp output, web calculator only (no npm package) (HIGH confidence)
- MDN: font-optical-sizing property, opsz variable font axis (HIGH confidence)
