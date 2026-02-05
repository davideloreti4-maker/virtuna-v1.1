# Phase 42: Effects & Animation - Research

**Researched:** 2026-02-05
**Domain:** Glassmorphism effects, scroll-triggered animations, noise/chromatic aberration decorative effects, performance optimization
**Confidence:** HIGH

## Summary

Phase 42 implements glassmorphism effect primitives and animation components that match the Raycast aesthetic. The codebase already has substantial foundations: `GlassPanel`, `GlassCard`, and `GradientGlow` in `src/components/primitives/`, existing `FadeIn` and `SlideUp` animation components in `src/components/motion/`, glass utility classes in `globals.css`, Motion (Framer Motion) v12.29.3, `tw-animate-css` v1.4.0, and hooks for `useIsMobile` and `usePrefersReducedMotion`.

The primary work is: (1) promoting and enhancing the existing GlassPanel to match Raycast's exact blur levels per context, (2) building the FadeInUp combined animation and stagger reveal system using Motion's `whileInView` + `variants` with `staggerChildren`, (3) adding noise texture via inline SVG `feTurbulence` filter, (4) adding chromatic aberration as a CSS utility using `text-shadow` RGB split, (5) implementing skeleton loading with shimmer animation, and (6) adding a hover scale micro-interaction utility.

Key discovery from Raycast extraction: Raycast uses **CSS class-based animations** (`page_fadeInUp`, `page_fadeInUpStagger`) for their scroll reveals -- NOT Framer Motion. They use CSS keyframes with translateY + opacity for the fade-in-up pattern. However, since our codebase already uses Motion for animations and it provides superior developer experience (whileInView, variants, reduced motion support), we should **continue using Motion** but match Raycast's exact timing, easing, and visual behavior.

**Primary recommendation:** Enhance existing components rather than building from scratch. The GlassPanel, motion components, and skeleton already exist. Add the missing requirements (stagger, noise, chromatic aberration, hover scale) as new utilities/components alongside the existing ones.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| motion (Framer Motion) | 12.29.3 | Animation components (FadeInUp, stagger, whileInView) | Already installed; provides whileInView, variants, staggerChildren, useReducedMotion |
| tw-animate-css | 1.4.0 | CSS-based Tailwind v4 animation utilities | Already installed; provides animate-in, fade-in, slide-in classes |
| tailwindcss | 4.x | @theme tokens, utility classes, motion-reduce: modifier | Already configured with two-tier token system |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-variance-authority | 0.7.1 | Variant management for GlassPanel | For blur/tint/opacity variant props |
| clsx + tailwind-merge | via cn() | Class composition | All component className merging |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Motion for scroll animations | CSS-only (tw-animate-css) | Motion provides useReducedMotion, viewport options, variants; CSS-only lacks stagger orchestration |
| SVG feTurbulence noise | Canvas noise / CSS background-image | SVG is most performant, inlined, and no external asset needed |
| CSS text-shadow chromatic | SVG filter chromatic | text-shadow is simpler, more performant, and sufficient for text effects |

**Installation:**
```bash
# No new packages needed - all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/components/
├── motion/
│   ├── index.ts              # Re-exports all motion components
│   ├── fade-in.tsx            # EXISTING - enhance with Raycast easing
│   ├── slide-up.tsx           # EXISTING - enhance with Raycast easing
│   ├── fade-in-up.tsx         # NEW - FadeInUp combined (EFX-03)
│   ├── stagger-reveal.tsx     # NEW - Stagger container (EFX-04)
│   ├── hover-scale.tsx        # NEW - Hover micro-interaction (EFX-05)
│   ├── page-transition.tsx    # EXISTING - no changes
│   └── frozen-router.tsx      # EXISTING - no changes
├── primitives/
│   ├── GlassPanel.tsx         # EXISTING - enhance blur variants
│   ├── GlassCard.tsx          # EXISTING - no changes
│   ├── GradientGlow.tsx       # EXISTING - no changes
│   ├── GlassSkeleton.tsx      # EXISTING - enhance shimmer animation
│   └── ...
├── effects/
│   ├── index.ts               # Re-exports all effect utilities
│   ├── noise-texture.tsx      # NEW - SVG noise overlay (GLS-06)
│   └── chromatic-aberration.tsx # NEW - RGB split effect (GLS-07)
└── ui/
    ├── skeleton.tsx            # EXISTING - enhance with shimmer (EFX-06)
    └── ...
```

### Pattern 1: Motion whileInView with Variants (Scroll-Triggered Animation)
**What:** Raycast-matching fade-in-up animation triggered by viewport intersection
**When to use:** All section reveals, card appearances, content blocks
**Source:** Motion docs (Context7 /websites/motion_dev) + Raycast CSS extraction

```typescript
// FadeInUp - Combined fade + translateY (Raycast signature)
import { motion, useReducedMotion } from "motion/react";
import type { Variants } from "motion/react";

const fadeInUpVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 24, // Raycast uses ~20-30px translateY
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.1, 0.25, 1.0], // CSS ease equivalent, Raycast default
    },
  },
};

interface FadeInUpProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  distance?: number;
  once?: boolean;
}

export function FadeInUp({
  children,
  className,
  delay = 0,
  duration = 0.6,
  distance = 24,
  once = true,
}: FadeInUpProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "-80px" }}
      variants={{
        hidden: { opacity: 0, y: distance },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration, delay, ease: [0.25, 0.1, 0.25, 1.0] },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
```

### Pattern 2: Stagger Reveal with Parent/Child Variants
**What:** Parent orchestrates children with staggerChildren delay
**When to use:** Extension grids, feature lists, card grids
**Source:** Motion docs (Context7 /websites/motion_dev) - staggerChildren + delayChildren

```typescript
// StaggerReveal - Parent container that staggers child animations
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08, // Raycast-style ~80ms stagger
      delayChildren: 0.1,    // Small initial delay
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1.0],
    },
  },
};

// Usage:
// <StaggerReveal>
//   <StaggerReveal.Item>Card 1</StaggerReveal.Item>
//   <StaggerReveal.Item>Card 2</StaggerReveal.Item>
// </StaggerReveal>
```

### Pattern 3: SVG Noise Texture Overlay
**What:** Inline SVG feTurbulence filter for subtle grain effect
**When to use:** Glass panels that need tactile depth, premium surfaces
**Source:** CSS-Tricks "Grainy Gradients" + Raycast feature frame analysis

```typescript
// NoiseTexture - SVG noise overlay component
// Render as a positioned overlay inside glass containers

export function NoiseTexture({
  opacity = 0.03,
  baseFrequency = 0.65,
  className,
}: {
  opacity?: number;
  baseFrequency?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 z-[1]", className)}
      style={{ opacity }}
      aria-hidden="true"
    >
      <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <filter id="noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency={baseFrequency}
            numOctaves={3}
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
      </svg>
    </div>
  );
}
```

### Pattern 4: Chromatic Aberration via CSS
**What:** RGB channel split using text-shadow or box-shadow offsets
**When to use:** Optional premium glass effect, hero text, decorative elements
**Source:** CSS chromatic aberration techniques (multiple sources)

```typescript
// ChromaticAberration - CSS utility component
// Uses text-shadow for text, pseudo-elements for containers

// For text:
const chromaticTextStyle: CSSProperties = {
  textShadow: "-1px 0 rgba(255, 0, 0, 0.15), 1px 0 rgba(0, 255, 255, 0.15)",
};

// For containers (via pseudo-element with box-shadow):
// .chromatic-border::before {
//   content: '';
//   position: absolute;
//   inset: -1px;
//   border-radius: inherit;
//   background: transparent;
//   box-shadow: -1px 0 2px rgba(255, 0, 0, 0.1), 1px 0 2px rgba(0, 255, 255, 0.1);
//   pointer-events: none;
// }
```

### Pattern 5: Glass Panel with Context-Aware Blur
**What:** Enhanced GlassPanel matching Raycast's blur levels per context
**When to use:** All glass surfaces
**Source:** 39-EXTRACTION-DATA.md blur value summary

```typescript
// Raycast blur levels extracted from their CSS:
// | Context       | Blur  | Our Map       |
// |---------------|-------|---------------|
// | Feature frames| 2px   | "xs" (new)    |
// | Navbar        | 5px   | "sm" variant  |
// | Tooltips      | 8px   | "sm" (existing)|
// | Dock/Cards    | 10px  | "md" variant  |
// | Snippets      | 15px  | "md" (existing)|
// | Footer        | 20px  | "lg" (existing)|
// | Windows       | 36px  | "xl" (new)    |
// | Action bars   | 48px  | "2xl" (new)   |

// Recommendation: Expand blur variants to match Raycast contexts
type BlurLevel = "none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

const blurMap: Record<BlurLevel, number> = {
  none: 0,
  xs: 2,    // Feature frames
  sm: 8,    // Tooltips, light blur
  md: 12,   // Cards, dock
  lg: 20,   // Footer, heavy surfaces
  xl: 36,   // Windows, dropdowns
  "2xl": 48, // Action bars
};
```

### Anti-Patterns to Avoid

- **Too many glass layers:** Limit to 2-3 backdrop-filter elements visible simultaneously. More causes severe GPU performance degradation (confirmed by shadcn/ui #327 issues).
- **Missing -webkit-backdrop-filter:** Safari requires the vendor prefix. Always include both `backdropFilter` and `WebkitBackdropFilter` in inline styles.
- **Blur without translate3d on Safari:** Safari has a known performance bug with `filter: blur()`. Add `transform: translate3d(0, 0, 0)` to force GPU acceleration.
- **will-change on every element:** Only apply `will-change: transform` or `will-change: backdrop-filter` to elements that actually animate. Remove it after animation completes.
- **Noise SVG without unique filter IDs:** If multiple NoiseTexture instances exist, each needs a unique filter ID to avoid conflicts.
- **Stagger without viewport gating:** Always use `whileInView` with `once: true` for stagger animations. Without viewport gating, all items animate on mount regardless of visibility.
- **Missing reduced motion fallback:** Every animation component MUST check `useReducedMotion()` and provide a static fallback. The existing pattern in `fade-in.tsx` and `slide-up.tsx` is correct -- follow it.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scroll-triggered animation | Manual IntersectionObserver | Motion `whileInView` | Built-in viewport detection, reduced motion support, variant orchestration |
| Stagger timing | Manual delay calculation per child | Motion `staggerChildren` in variants | Handles insertion order, direction (first/last/center), timing automatically |
| Reduced motion detection | Manual matchMedia listener | Motion `useReducedMotion()` | SSR-safe, reactive, used in existing components |
| Enter/exit animations | CSS keyframes + manual class toggling | Motion `AnimatePresence` | Handles exit animations, layout shifts, multiple children |
| Mobile detection for blur | Custom breakpoint logic | Existing `useIsMobile()` hook + CSS media query | Already implemented in `src/hooks/useIsMobile.ts`, CSS `@media` for blur reduction already in `globals.css` |
| Skeleton shimmer | Custom CSS animation | Existing `GlassSkeleton` + `ui/skeleton.tsx` | Both already implemented with different approaches |
| Glass utility classes | Inline styles for each glass element | Existing `glass-base`, `glass-blur-*`, `glass-navbar` classes | Already in `globals.css` with Safari prefixes |

**Key insight:** The codebase already has ~70% of the required infrastructure. This phase is about filling gaps (stagger, noise, chromatic aberration, hover scale) and refining existing components to match Raycast's exact values.

## Common Pitfalls

### Pitfall 1: Backdrop-Filter Performance on Low-End Devices
**What goes wrong:** Multiple backdrop-filter elements cause frame drops, especially on Chromium browsers without dedicated GPU
**Why it happens:** Each backdrop-filter creates a separate compositing layer; blur() is GPU-intensive and scales with element size and blur radius
**How to avoid:** Limit to 2-3 visible glass elements per viewport. Use CSS media query to reduce blur on mobile (already in globals.css). For overlay modals, consider replacing blur with semi-transparent background (`bg-black/60`) as fallback.
**Warning signs:** FPS drops below 30 on scroll, fan activation on laptops, janky animations on mobile devices

### Pitfall 2: Safari Blur Performance Bug
**What goes wrong:** Blur filter causes extreme slowness in Safari 15+
**Why it happens:** Safari's CPU-based rendering path for certain filter operations
**How to avoid:** Always pair blur with `transform: translate3d(0, 0, 0)` to force GPU layer. The existing `glass-blur-*` classes in globals.css handle this via `backdrop-filter` (which is GPU-accelerated), but any `filter: blur()` usage (like on GradientGlow) needs the translate3d fix.
**Warning signs:** Interactions near blurred elements become sluggish in Safari specifically

### Pitfall 3: Stagger Animation Running on Mount Instead of Scroll
**What goes wrong:** All staggered items animate immediately when the page loads, even if below the fold
**Why it happens:** Using `initial` + `animate` instead of `initial` + `whileInView`
**How to avoid:** Always use `whileInView="visible"` with `viewport={{ once: true }}` for staggered reveals. The stagger should only trigger when the container enters the viewport.
**Warning signs:** Cards at the bottom of the page have already finished their animation by the time user scrolls to them

### Pitfall 4: Noise Texture SVG Filter ID Collision
**What goes wrong:** Multiple noise overlays on the same page reference the same filter ID, causing one to display incorrectly
**Why it happens:** SVG filter IDs must be unique within the DOM
**How to avoid:** Generate unique filter IDs using React `useId()` hook or a counter. Each NoiseTexture instance must have its own `<filter id="noise-{unique}">`.
**Warning signs:** Some noise textures render as solid gray or not at all

### Pitfall 5: Chromatic Aberration Overuse
**What goes wrong:** Effect applied broadly, making text hard to read and UI feel cheap
**Why it happens:** Applying the effect without restraint
**How to avoid:** Chromatic aberration should be OPTIONAL and CONFIGURABLE. Use it only on decorative glass surfaces (not text-heavy UI). Keep offsets subtle (1-2px). Raycast uses it primarily in their 3D scene shader (chromatic aberration: 3px shift on the glass orb), not on general UI text.
**Warning signs:** Body text has visible color fringing, UI feels "glitchy" instead of "premium"

### Pitfall 6: Missing Motion Import Path
**What goes wrong:** Importing from `"framer-motion"` instead of `"motion/react"`
**Why it happens:** Outdated documentation references
**How to avoid:** The codebase uses `motion/react` (the newer import path). The `motion` package (v12.29.x) is installed. Always import from `"motion/react"` for React components. Check existing `fade-in.tsx` for the correct import pattern.
**Warning signs:** Import errors, duplicate bundles, tree-shaking failures

## Code Examples

Verified patterns from existing codebase and official documentation:

### Existing FadeIn Pattern (Reference for New Components)
```typescript
// Source: /Users/davideloreti/virtuna-v1.1/src/components/motion/fade-in.tsx
// This is the established pattern - all new motion components follow this
import { motion, useReducedMotion } from "motion/react";
import type { Variants } from "motion/react";

// 1. Define variants with const assertion
const variants = { hidden: {...}, visible: {...} } as const satisfies Variants;

// 2. Check reduced motion preference
const prefersReducedMotion = useReducedMotion();
if (prefersReducedMotion) {
  return <div className={className}>{children}</div>;
}

// 3. Use whileInView for scroll-triggered animation
<motion.div
  initial="hidden"
  whileInView="visible"
  viewport={{ once, margin: "-100px" }}
  variants={variants}
>
  {children}
</motion.div>
```

### Raycast Glassmorphism Patterns (Extracted Values)
```css
/* Source: 39-EXTRACTION-DATA.md - Verified via Playwright extraction */

/* Pattern 1: Navbar Glass (most common surface) */
.glass-navbar {
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  background: linear-gradient(137deg, rgba(17, 18, 20, 0.75) 4.87%, rgba(12, 13, 15, 0.9) 75.88%);
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: rgba(255, 255, 255, 0.15) 0px 1px 1px 0px inset;
}

/* Pattern 2: Feature Frame (radial gradient glow + light blur) */
.glass-feature {
  backdrop-filter: blur(2px);
  background: radial-gradient(85.77% 49.97% at 51% 5.12%,
    rgba(255, 148, 148, 0.11) 0px,
    rgba(222, 226, 255, 0.08) 45.83%,
    rgba(241, 242, 255, 0.02) 100%),
    rgba(0, 0, 0, 0.44);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: rgba(255, 255, 255, 0.03) 0px 0px 40px 20px,
              rgba(255, 255, 255, 0.3) 0px 0.5px 0px 0px inset;
}

/* Pattern 3: Heavy Glass (windows, dropdowns) */
.glass-heavy {
  backdrop-filter: blur(36px);
  -webkit-backdrop-filter: blur(36px);
  background-color: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(143, 141, 145, 0.2);
  box-shadow: rgba(0, 0, 0, 0.4) 0px 4px 40px 8px,
              rgba(0, 0, 0, 0.8) 0px 0px 0px 0.5px,
              rgba(255, 255, 255, 0.3) 0px 0.5px 0px 0px inset;
}

/* Pattern 4: Social Card / Snippet Glass */
.glass-card {
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  background: linear-gradient(137deg, rgba(17, 18, 20, 0.75) 4.87%, rgba(12, 13, 15, 0.9) 75.88%);
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: rgba(255, 255, 255, 0.15) 0px 1px 1px 0px inset;
}
```

### Motion Stagger with whileInView
```typescript
// Source: Motion docs (Context7 /websites/motion_dev)
// Verified pattern for scroll-triggered stagger reveal

import { motion, useReducedMotion } from "motion/react";
import type { Variants } from "motion/react";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      when: "beforeChildren",
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1.0],
    },
  },
};

function StaggerGrid({ children }: { children: React.ReactNode }) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div>{children}</div>;
  }

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      variants={containerVariants}
    >
      {children}
    </motion.div>
  );
}

function StaggerItem({ children }: { children: React.ReactNode }) {
  return (
    <motion.div variants={itemVariants}>
      {children}
    </motion.div>
  );
}
```

### Hover Scale Micro-Interaction
```typescript
// Pattern for hover scale effect matching Raycast's card hover
// Raycast buttons use: transform 0.1s ease-in-out (subtle scale on press)

function HoverScale({
  children,
  scale = 1.02,
  className,
}: {
  children: React.ReactNode;
  scale?: number;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      whileHover={prefersReducedMotion ? {} : { scale }}
      whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {children}
    </motion.div>
  );
}
```

### tw-animate-css Usage (CSS-only alternative)
```html
<!-- Source: tw-animate-css docs (Context7 /wombosvideo/tw-animate-css) -->
<!-- CSS-only fade-in-up using Tailwind utility classes -->
<div class="animate-in fade-in slide-in-from-bottom-6 duration-500">
  Content fades in and slides up from 1.5rem below
</div>

<!-- With delay for stagger effect (manual) -->
<div class="animate-in fade-in slide-in-from-bottom-6 duration-500 delay-0">Item 1</div>
<div class="animate-in fade-in slide-in-from-bottom-6 duration-500 delay-100">Item 2</div>
<div class="animate-in fade-in slide-in-from-bottom-6 duration-500 delay-200">Item 3</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSS `@keyframes` + `IntersectionObserver` | Motion `whileInView` + `variants` | Motion v10+ (2023) | Declarative, reduced motion built-in, variant orchestration |
| Manual stagger delay calculation | Motion `staggerChildren` | Motion v4+ (2021) | Automatic timing, configurable direction |
| Background image for noise | Inline SVG `feTurbulence` filter | 2020+ | No external asset, smaller bundle, configurable |
| Canvas-based noise | SVG filter + CSS mix-blend-mode | 2022+ | Better performance, declarative, composable |
| jQuery scroll reveal | Motion `whileInView` | 2023+ | React-native, tree-shakeable, SSR-safe |
| Separate framer-motion package | `motion/react` import from `motion` package | 2024 (v11+) | Smaller bundle, unified package |
| Manual `prefers-reduced-motion` media query | Motion `useReducedMotion()` hook | Motion v5+ | Reactive, SSR-safe, declarative |

**Deprecated/outdated:**
- Importing from `"framer-motion"` -- use `"motion/react"` instead (codebase already uses this)
- `react-intersection-observer` package for scroll triggers -- Motion's `whileInView` handles this natively
- AOS (Animate On Scroll) library -- heavyweight, Motion provides the same with better React integration

## Open Questions

1. **Exact Raycast FadeInUp CSS keyframes**
   - What we know: Raycast uses CSS classes `page_fadeInUp` and `page_fadeInUpStagger` (confirmed from HTML extraction). Standard approach is `translateY(20-30px)` to `translateY(0)` + `opacity: 0` to `opacity: 1` with ~0.6s duration.
   - What's unclear: The exact compiled CSS keyframe definitions are in their CSS bundle file (minified, not extracted). The cubic-bezier values in their CSS were not directly extracted.
   - Recommendation: Use `ease: [0.25, 0.1, 0.25, 1.0]` (CSS `ease` equivalent) as the default, matching common scroll-reveal conventions. The existing codebase uses `[0.215, 0.61, 0.355, 1]` (ease-out-cubic) and `[0.165, 0.84, 0.44, 1]` (ease-out-quart). Keep these as token options. Raycast's visual behavior matches ease-out timing.

2. **Raycast's exact stagger delay**
   - What we know: They use `page_fadeInUpStagger` CSS class suggesting staggered timing
   - What's unclear: Exact per-child delay (could be 50ms, 80ms, or 100ms between items)
   - Recommendation: Start with 80ms stagger (common sweet spot). The planner can make this configurable. Visually tune to match raycast.com during implementation.

3. **Raycast chromatic aberration scope**
   - What we know: Raycast uses chromatic aberration (3px shift) in their **Three.js glass orb shader** (extracted from homepage 3D scene). It is NOT applied to general UI elements or text.
   - What's unclear: Whether they use any CSS-based chromatic aberration on glass panels
   - Recommendation: Implement as an optional CSS utility for glass surfaces only (not text). Keep it subtle (1-2px offsets). Make it easily toggleable. Mark as optional/decorative.

4. **Noise texture performance on mobile**
   - What we know: SVG feTurbulence is CPU-rendered. One noise overlay is fine, many could impact performance.
   - What's unclear: Exact performance threshold on mobile Safari
   - Recommendation: Limit to 1-2 noise overlays per viewport. Disable on mobile via `useIsMobile()` or CSS media query. Keep opacity very low (0.02-0.05) for subtlety.

5. **Mobile blur reduction strategy**
   - What we know: The existing `globals.css` already reduces `glass-blur-md` and `glass-blur-lg` to 8px on mobile via `@media (max-width: 768px)`. This matches the Phase 42 requirement of "6-8px vs 12-20px desktop."
   - What's unclear: Whether Raycast does the same (their mobile site wasn't fully extracted)
   - Recommendation: Keep the existing media query approach. It already meets the requirement. The GlassPanel component uses the CSS classes, so it inherits this behavior automatically.

## Raycast Animation & Effect Reference Data

### Extracted Blur Values (from 39-EXTRACTION-DATA.md)

| Context | Blur | Border | Background Pattern |
|---------|------|--------|-------------------|
| Feature frames | 2px | 1px solid rgba(255,255,255,0.08) | Radial gradient + rgba(0,0,0,0.44) |
| Navbar | 5px | 1px solid rgba(255,255,255,0.06) | Linear gradient 137deg |
| Tooltips | 8px | 1px solid rgba(255,255,255,0.06) | Linear gradient 137deg (solid) |
| Dock/Cards | 10px | 1px solid rgba(255,255,255,0.06) | Linear gradient 137deg |
| Snippets | 15px | 1px solid rgba(255,255,255,0.06) | Linear gradient 137deg |
| Footer | 20px | none | Linear gradient + radial gradient |
| Windows/Dropdowns | 36px | 1px solid rgba(143,141,145,0.2) | rgba(0,0,0,0.6) solid |
| Action bars | 48px | none | rgba(0,0,0,0.1) |

### Extracted Border Patterns
- **Glass border (standard):** `rgba(255, 255, 255, 0.06)` -- used on most glass elements
- **Feature border:** `rgba(255, 255, 255, 0.08)` -- slightly more visible
- **Window border:** `rgba(143, 141, 145, 0.2)` -- warm gray, heavier
- **Dropdown border:** `rgba(255, 255, 255, 0.2)` -- stronger white

### Existing Easing Tokens (from globals.css)
```
--ease-out-cubic: cubic-bezier(0.215, 0.61, 0.355, 1)   -> Motion: [0.215, 0.61, 0.355, 1]
--ease-out-quart: cubic-bezier(0.165, 0.84, 0.44, 1)    -> Motion: [0.165, 0.84, 0.44, 1]
--ease-in-out: cubic-bezier(0.42, 0, 0.58, 1)           -> Motion: [0.42, 0, 0.58, 1]
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)        -> Motion: [0.34, 1.56, 0.64, 1]
```

### Raycast Animation CSS Class Names (from HTML extraction)
- `page_fadeInUp___VRvH` / `page_fadeInUp__yDeSr` -- fade-in with upward movement
- `page_fadeInUpStagger__UbVUU` -- staggered variant of fadeInUp

### Raycast 3D Scene Effects (from HTML extraction)
- Chromatic aberration: 3px shift (in Three.js shader, not CSS)
- Anisotropic blur: 2.88px (in 3D glass material)
- Mobile sampling: 5 vs 6 samples (reduced for performance)
- DPR: 2x device pixel ratio

## Sources

### Primary (HIGH confidence)
- `/Users/davideloreti/virtuna-v1.1/.planning/phases/39-token-foundation/39-EXTRACTION-DATA.md` -- Raycast glassmorphism values, blur levels, border patterns (Playwright extraction)
- `/Users/davideloreti/virtuna-v1.1/src/components/primitives/GlassPanel.tsx` -- Existing GlassPanel implementation
- `/Users/davideloreti/virtuna-v1.1/src/components/primitives/GlassSkeleton.tsx` -- Existing skeleton with shimmer
- `/Users/davideloreti/virtuna-v1.1/src/components/motion/fade-in.tsx` -- Established Motion pattern
- `/Users/davideloreti/virtuna-v1.1/src/components/motion/slide-up.tsx` -- Established Motion pattern
- `/Users/davideloreti/virtuna-v1.1/src/app/globals.css` -- Glass utility classes, easing tokens, mobile blur reduction
- `/Users/davideloreti/virtuna-v1.1/src/hooks/usePrefersReducedMotion.ts` -- Reduced motion hook
- `/Users/davideloreti/virtuna-v1.1/src/hooks/useIsMobile.ts` -- Mobile detection hook
- Context7 `/websites/motion_dev` -- Motion `whileInView`, `variants`, `staggerChildren`, `useReducedMotion`
- Context7 `/wombosvideo/tw-animate-css` -- tw-animate-css `animate-in`, `fade-in`, `slide-in-from-*` classes

### Secondary (MEDIUM confidence)
- [CSS-Tricks: Grainy Gradients](https://css-tricks.com/grainy-gradients/) -- SVG feTurbulence noise technique, baseFrequency/numOctaves parameters
- [Graffino: Safari blur performance fix](https://graffino.com/til/how-to-fix-filter-blur-performance-issue-in-safari) -- translate3d(0,0,0) GPU acceleration fix
- [shadcn/ui #327](https://github.com/shadcn-ui/ui/issues/327) -- Backdrop-filter performance degradation, fallback strategies
- [web.dev: backdrop-filter](https://web.dev/backdrop-filter/) -- Performance warning, @supports fallback pattern
- [TutorialPedia: CSS Chromatic Aberration](https://www.tutorialpedia.org/blog/css-chromatic-aberration-text/) -- text-shadow RGB split technique

### Tertiary (LOW confidence)
- Raycast HTML extraction (page_fadeInUp class names visible, but exact keyframe CSS not extracted from compiled bundle)
- General glassmorphism best practices (multiple web sources agree on blur limits, performance considerations)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries already installed; Motion API verified via Context7
- Architecture: HIGH -- Patterns extracted from existing codebase + established Motion patterns
- Glass values: HIGH -- Extracted via Playwright from raycast.com (39-EXTRACTION-DATA.md)
- Animation easing: MEDIUM -- Raycast CSS class names extracted, but exact cubic-bezier values from their compiled CSS not captured; using standard ease-out values that visually match
- Noise/chromatic: MEDIUM -- Technique well-documented across sources; Raycast's specific usage is in their 3D shader, not CSS (may not apply 1:1)
- Performance: HIGH -- Multiple sources confirm backdrop-filter limitations; existing mobile optimization already in codebase
- Pitfalls: HIGH -- Derived from shadcn/ui issues, Safari bug reports, and codebase analysis

**Research date:** 2026-02-05
**Valid until:** 2026-03-07 (30 days -- stable domain, all deps locked)
