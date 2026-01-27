# Phase 3: Landing Site - Research

**Researched:** 2026-01-27
**Domain:** Landing page development, scroll animations, responsive design
**Confidence:** HIGH

## Summary

This phase requires building pixel-perfect landing pages (Homepage, Pricing, About) that clone societies.io exactly. The research focused on scroll-triggered animations, parallax effects, image asset strategy, responsive implementation, and common pitfalls.

Key findings:
- Framer Motion (already installed as `motion`) provides all scroll animation features needed via `whileInView`, `useScroll`, and `useTransform` hooks
- Next.js Image component handles optimization, but assets must be downloaded and placed in `/public` before build time
- Mobile-first Tailwind approach with custom breakpoints matching societies.io is the correct strategy
- Existing Phase 2 animation components (FadeIn, SlideUp) need scroll-trigger enhancement, not replacement

**Primary recommendation:** Extend existing animation components with `whileInView` viewport triggers rather than creating new components. Use `useScroll` + `useTransform` for parallax effects.

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| motion | ^12.29.2 | All animations including scroll-triggered | Already in project, has built-in scroll features |
| next/image | 16.1.5 | Image optimization | Built into Next.js, handles responsive images |
| tailwindcss | ^4 | Responsive utilities | Already configured with custom theme |

### Supporting (No Additional Installs Needed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next/font | built-in | Font loading without FOUT | Already configured with Geist fonts |
| clsx + tailwind-merge | installed | Conditional classes | Already available via cn() utility |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Framer Motion scroll | GSAP ScrollTrigger | More powerful but adds 45KB, overkill for this project |
| Framer Motion scroll | Lenis + custom | Smoother scrolling but adds complexity |
| whileInView | react-intersection-observer | Lighter but requires separate animation library integration |

**Installation:** No additional packages required. The current stack is complete.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── page.tsx                 # Homepage
│   ├── pricing/page.tsx         # Pricing page
│   ├── about/page.tsx           # About page
│   └── coming-soon/page.tsx     # Placeholder for unbuilt pages
├── components/
│   ├── animations/
│   │   ├── fade-in.tsx          # Extend with whileInView
│   │   ├── slide-up.tsx         # Extend with whileInView
│   │   ├── scroll-reveal.tsx    # NEW: Generic scroll reveal wrapper
│   │   └── parallax.tsx         # NEW: Parallax effect component
│   ├── landing/
│   │   ├── hero.tsx             # Homepage hero section
│   │   ├── features.tsx         # Feature highlights
│   │   ├── testimonials.tsx     # Social proof section
│   │   ├── cta-section.tsx      # Call-to-action sections
│   │   ├── pricing-table.tsx    # Pricing tiers
│   │   ├── pricing-toggle.tsx   # Monthly/yearly toggle
│   │   ├── team-section.tsx     # About page team grid
│   │   └── values-section.tsx   # About page values
│   ├── layout/
│   │   ├── header.tsx           # Update to match societies.io exactly
│   │   ├── footer.tsx           # Update to match societies.io exactly
│   │   └── mobile-menu.tsx      # NEW: Mobile navigation drawer
│   └── ui/
│       └── (existing components)
└── public/
    └── images/
        └── landing/             # Downloaded societies.io assets
```

### Pattern 1: Scroll-Triggered Animation with whileInView

**What:** Animate elements when they enter the viewport using Framer Motion's built-in `whileInView` prop.

**When to use:** Any element that should animate on scroll (headings, cards, images, sections).

**Example:**
```typescript
// Source: motion.dev/docs/react-scroll-animations
import { motion } from "motion/react"

function ScrollReveal({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
```

### Pattern 2: Parallax Effect with useScroll + useTransform

**What:** Create parallax scrolling effects by linking element transforms to scroll progress.

**When to use:** Background images, hero sections, decorative elements that should move at different rates.

**Example:**
```typescript
// Source: motion.dev/docs/react-use-scroll
import { motion, useScroll, useTransform } from "motion/react"
import { useRef } from "react"

function ParallaxImage({ src, alt }: { src: string; alt: string }) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  })

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "30%"])

  return (
    <div ref={ref} className="overflow-hidden relative">
      <motion.img
        src={src}
        alt={alt}
        style={{ y }}
        className="w-full h-[120%] object-cover"
      />
    </div>
  )
}
```

### Pattern 3: Hide/Show Sticky Header

**What:** Header that hides when scrolling down, shows when scrolling up.

**When to use:** Landing page navigation to maximize content space while keeping nav accessible.

**Example:**
```typescript
// Source: frontend.fyi/tutorials/making-a-disappearing-sticky-navigation
import { motion, useScroll, useMotionValueEvent } from "motion/react"
import { useState } from "react"

function StickyHeader() {
  const [hidden, setHidden] = useState(false)
  const { scrollY } = useScroll()

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() ?? 0
    if (latest > previous && latest > 150) {
      setHidden(true)
    } else {
      setHidden(false)
    }
  })

  return (
    <motion.header
      variants={{
        visible: { y: 0 },
        hidden: { y: "-100%" }
      }}
      animate={hidden ? "hidden" : "visible"}
      transition={{ duration: 0.35, ease: "easeInOut" }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      {/* Header content */}
    </motion.header>
  )
}
```

### Pattern 4: Mobile Menu with AnimatePresence

**What:** Slide-out mobile navigation with proper enter/exit animations.

**When to use:** Mobile hamburger menu implementation.

**Example:**
```typescript
// Source: dev.to/wiommi/animate-a-hamburger-menu-with-framer-motion
import { motion, AnimatePresence } from "motion/react"

function MobileMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />
          {/* Menu panel */}
          <motion.nav
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3 }}
            className="fixed right-0 top-0 bottom-0 w-[280px] bg-landing-bg z-50"
          >
            {/* Menu items */}
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  )
}
```

### Pattern 5: Pricing Toggle with State

**What:** Monthly/yearly pricing toggle with animated price transitions.

**When to use:** Pricing page billing cycle selection.

**Example:**
```typescript
// Source: cruip.com/how-to-create-a-pricing-table-with-a-monthly-yearly-toggle
import { motion } from "motion/react"
import { useState } from "react"

function PricingToggle({ onToggle }: { onToggle: (isAnnual: boolean) => void }) {
  const [isAnnual, setIsAnnual] = useState(false)

  const handleToggle = () => {
    setIsAnnual(!isAnnual)
    onToggle(!isAnnual)
  }

  return (
    <div className="flex items-center gap-4">
      <span className={isAnnual ? "text-landing-text-dim" : "text-landing-text"}>Monthly</span>
      <button
        onClick={handleToggle}
        className="relative w-14 h-8 bg-landing-bg-card rounded-full p-1"
      >
        <motion.div
          className="w-6 h-6 bg-landing-accent rounded-full"
          animate={{ x: isAnnual ? 24 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </button>
      <span className={isAnnual ? "text-landing-text" : "text-landing-text-dim"}>
        Yearly <span className="text-landing-accent text-sm">(Save 20%)</span>
      </span>
    </div>
  )
}
```

### Anti-Patterns to Avoid

- **Creating new animation components instead of extending existing ones:** The Phase 2 FadeIn and SlideUp components can be enhanced with `whileInView` rather than duplicated.
- **Using Intersection Observer directly:** Framer Motion's `whileInView` and `useInView` handle this internally with better animation integration.
- **Animating layout properties:** Avoid animating `width`, `height`, `top`, `left` - use `transform` and `opacity` for 60fps animations.
- **Not using `viewport={{ once: true }}`:** Without this, animations replay every time element enters viewport, causing jank on scroll.
- **Heavy parallax on mobile:** Parallax effects can cause performance issues on mobile - consider disabling or reducing intensity.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scroll-triggered animations | Custom Intersection Observer | `whileInView` from motion | Handles enter/exit, respects animation lifecycle |
| Parallax effects | Manual scroll listeners | `useScroll` + `useTransform` | Optimized, uses RAF, handles resize |
| Mobile menu animation | CSS transitions | `AnimatePresence` + motion | Handles unmount animation, staggered items |
| Sticky header show/hide | Manual scroll tracking | `useMotionValueEvent` | Debounced, performant scroll tracking |
| Price animation on toggle | Manual state + CSS | Motion layout animations | Smooth number transitions, spring physics |
| Image lazy loading | Custom observer | Next.js Image `loading="lazy"` | Built-in, handles placeholder, optimization |

**Key insight:** Framer Motion (motion) provides scroll primitives that handle edge cases around resize, scroll direction, and animation lifecycle. Rolling custom solutions leads to bugs around edge cases like rapid scrolling, browser resize, or mobile address bar changes.

## Common Pitfalls

### Pitfall 1: Animations Not Running in Production

**What goes wrong:** Animations work in development but stop in production build.
**Why it happens:** Missing "use client" directive, or hydration mismatch between server and client.
**How to avoid:** Always add "use client" to animation components. Use `initial={false}` if SSR causes flicker.
**Warning signs:** Animations work locally but fail on Vercel preview.

### Pitfall 2: Layout Shift from Images

**What goes wrong:** Content jumps as images load, causing poor CLS score.
**Why it happens:** Images without explicit dimensions cause reflow when loaded.
**How to avoid:** Always provide `width` and `height` to Next.js Image, or use `fill` with sized container.
**Warning signs:** Page elements shift position during load.

### Pitfall 3: Scroll Jank from Non-Composited Animations

**What goes wrong:** Scroll feels choppy, especially on mobile.
**Why it happens:** Animating properties that trigger layout/paint (width, height, margin).
**How to avoid:** Only animate `transform` and `opacity`. Use `will-change: transform` sparingly.
**Warning signs:** Low frame rate visible in DevTools Performance panel.

### Pitfall 4: Mobile Menu Scroll Lock

**What goes wrong:** Page scrolls behind open mobile menu.
**Why it happens:** Body scroll not disabled when menu opens.
**How to avoid:** Add `overflow: hidden` to body when menu is open, restore on close.
**Warning signs:** Background content scrolling while menu is visible.

### Pitfall 5: FOUT (Flash of Unstyled Text)

**What goes wrong:** Text briefly shows in system font before custom font loads.
**Why it happens:** Font not preloaded, or font-display: swap causing flash.
**How to avoid:** Use `next/font` which auto-preloads and uses size-adjust to prevent layout shift.
**Warning signs:** Text flickers or changes appearance on initial load.

### Pitfall 6: Parallax on Mobile Performance

**What goes wrong:** Parallax effects cause stuttering on mobile devices.
**Why it happens:** Mobile GPUs struggle with transformed layers during scroll.
**How to avoid:** Reduce parallax intensity on mobile or disable entirely. Use CSS `@media (prefers-reduced-motion)` as a guide (though per CONTEXT.md, we don't respect it for this clone).
**Warning signs:** Choppy scroll on iOS Safari or older Android devices.

### Pitfall 7: Assets Not Available in Production

**What goes wrong:** Images return 404 in production.
**Why it happens:** Assets added to `/public` after build time aren't served.
**How to avoid:** Ensure all assets exist in `/public` before `next build`. Never dynamically add files to public folder.
**Warning signs:** Images work in dev but 404 in production.

## Code Examples

### Extending Existing FadeIn with Scroll Trigger

```typescript
// Enhanced version of existing src/components/animations/fade-in.tsx
"use client"

import { motion } from "motion/react"
import { ReactNode } from "react"

interface FadeInProps {
  children: ReactNode
  delay?: number
  duration?: number
  className?: string
  /** If true, animates when scrolled into view. If false, animates on mount. */
  scroll?: boolean
}

export function FadeIn({
  children,
  delay = 0,
  duration = 0.5,
  className,
  scroll = false,
}: FadeInProps) {
  const animationProps = scroll
    ? {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.3 },
      }
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
      }

  return (
    <motion.div
      {...animationProps}
      transition={{
        duration,
        delay,
        ease: [0.4, 0, 0.2, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
```

### Staggered Grid Animation

```typescript
// For feature grids, team sections, etc.
"use client"

import { motion } from "motion/react"
import { ReactNode } from "react"

interface StaggeredGridProps {
  children: ReactNode[]
  className?: string
  staggerDelay?: number
}

export function StaggeredGrid({ children, className, staggerDelay = 0.1 }: StaggeredGridProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={{
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      className={className}
    >
      {children.map((child, index) => (
        <motion.div
          key={index}
          variants={{
            hidden: { opacity: 0, y: 30 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  )
}
```

### Next.js Image with Priority for Hero

```typescript
// Hero image that loads immediately
import Image from "next/image"

function HeroSection() {
  return (
    <section className="relative h-screen">
      <Image
        src="/images/landing/hero-bg.webp"
        alt="Hero background"
        fill
        priority
        className="object-cover"
        sizes="100vw"
      />
      <div className="relative z-10">
        {/* Hero content */}
      </div>
    </section>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| useViewportScroll | useScroll | Framer Motion v6 | New API, same functionality |
| framer-motion package | motion package | 2024 | Renamed, lighter bundle |
| Manual font preloading | next/font | Next.js 13 | Zero-config FOUT prevention |
| CSS scroll-snap | Still valid | - | Combine with Framer Motion for enhanced UX |
| rem-based breakpoints only | Container queries | Tailwind v4 | Component-level responsiveness |

**Deprecated/outdated:**
- `useViewportScroll`: Renamed to `useScroll` in newer versions
- Manual `<link rel="preload">` for fonts: Use `next/font` instead
- Separate intersection-observer package: Use motion's built-in `whileInView`

## Open Questions

1. **Exact breakpoints from societies.io**
   - What we know: Need to reverse-engineer their CSS to match exactly
   - What's unclear: Specific pixel values for their breakpoints
   - Recommendation: Inspect societies.io using DevTools during planning phase, document exact breakpoints

2. **Exact scroll animation timings from societies.io**
   - What we know: Need to match their easing, duration, and trigger points
   - What's unclear: Specific animation parameters they use
   - Recommendation: Record screen captures of societies.io and analyze frame-by-frame if needed

3. **Image formats and optimization strategy**
   - What we know: Download images from societies.io, use Next.js Image component
   - What's unclear: Whether to convert to WebP or keep original formats
   - Recommendation: Keep original formats, let Next.js handle conversion on-demand

## Sources

### Primary (HIGH confidence)
- [Motion.dev - React Scroll Animations](https://motion.dev/docs/react-scroll-animations) - scroll-linked animations, useScroll, parallax
- [Motion.dev - useInView](https://motion.dev/docs/react-use-in-view) - viewport detection hooks
- [Next.js - Image Component](https://nextjs.org/docs/app/api-reference/components/image) - image optimization
- [Next.js - Static Assets](https://nextjs.org/docs/app/building-your-application/optimizing/static-assets) - public folder strategy
- [Tailwind CSS - Responsive Design](https://tailwindcss.com/docs/responsive-design) - breakpoint system

### Secondary (MEDIUM confidence)
- [Frontend.fyi - Auto-hiding Sticky Navigation](https://www.frontend.fyi/tutorials/making-a-disappearing-sticky-navigation) - verified against motion docs
- [Cruip - Pricing Table Toggle](https://cruip.com/how-to-create-a-pricing-table-with-a-monthly-yearly-toggle-in-tailwind-css-and-next-js/) - matches Tailwind best practices
- [BuildUI - Fixed Header Recipe](https://buildui.com/recipes/fixed-header) - useBoundedScroll pattern
- [DEV Community - Hamburger Menu Animation](https://dev.to/wiommi/animate-a-hamburger-menu-with-framer-motion-50ml) - AnimatePresence pattern

### Tertiary (LOW confidence)
- WebSearch results for general patterns - validated against primary sources where possible

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH - No new packages needed, motion already installed with scroll features
- Architecture: HIGH - Patterns verified against official motion.dev docs
- Pitfalls: MEDIUM - Based on community reports and motion GitHub issues

**Research date:** 2026-01-27
**Valid until:** 2026-02-27 (stable libraries, no major version changes expected)
