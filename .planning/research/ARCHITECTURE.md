# Architecture Research: Premium Landing Page Components

**Project:** Virtuna v1.3.2 - Landing Page Redesign
**Researched:** 2026-01-31
**Overall Confidence:** HIGH

## Executive Summary

Premium landing page components for glassmorphism, gradient effects, and smooth animations should follow a three-layer architecture: **Primitives** (visual effect building blocks), **Composites** (assembled feature components), and **Sections** (full page sections). This mirrors the existing codebase structure where `src/components/ui/` contains primitives, `src/components/landing/` contains composites, and page sections are assembled from these.

The key insight: **separate visual effects from structural components**. A `GlassPanel` should be a visual primitive that can wrap any content. A `GradientCard` composes glass effects with gradient accents. This separation enables consistent visual language across the landing page while allowing flexibility in content structure.

---

## Component Hierarchy

### Layer 1: Primitives (Build First)

Base components that implement single visual effects. These are the atomic building blocks.

```
src/components/effects/
  glass-panel.tsx      # Glassmorphism container
  gradient-glow.tsx    # Gradient lighting/glow effect
  animated-gradient.tsx # Animated gradient backgrounds
  traffic-lights.tsx   # macOS window control dots
```

#### 1.1 GlassPanel

**Purpose:** Reusable glassmorphism container with proper fallbacks.

**Props Interface:**
```typescript
interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  blur?: 'subtle' | 'medium' | 'heavy';  // 8px | 12px | 16px
  opacity?: number;  // 0.05 to 0.25 recommended
  border?: boolean;  // Show border (default: true)
  glow?: boolean;    // Add subtle outer glow
}
```

**Key Implementation Details:**
- Use `backdrop-filter: blur()` with `-webkit-` prefix handled by Tailwind v4
- Always provide fallback `bg-background-elevated/90` for unsupported browsers
- Limit blur to 6-8px on mobile for performance
- Border uses `border-white/10` to match existing `FeatureCard` pattern
- Avoid animating elements with `backdrop-filter` directly

**Why build first:** Every premium component (cards, modals, sections) will compose this.

#### 1.2 GradientGlow

**Purpose:** Cursor-following or static gradient glow effect.

**Props Interface:**
```typescript
interface GradientGlowProps {
  children: React.ReactNode;
  className?: string;
  color?: string;           // Gradient color (default: accent)
  intensity?: 'subtle' | 'medium' | 'strong';
  mode?: 'static' | 'hover' | 'cursor';  // Trigger mode
  spread?: number;          // Glow spread in pixels
  position?: 'top' | 'bottom' | 'center' | 'cursor';
}
```

**Key Implementation Details:**
- Use CSS `radial-gradient` positioned via CSS custom properties
- For cursor mode, track `pointermove` and update `--glow-x`, `--glow-y` variables
- Use `box-shadow` with blur for the actual glow (more performant than filter)
- Keep glow layer behind content with `z-index` management

**Why build second:** Used by gradient cards and hero effects.

#### 1.3 TrafficLights

**Purpose:** macOS window control dots (red/yellow/green).

**Props Interface:**
```typescript
interface TrafficLightsProps {
  className?: string;
  size?: 'sm' | 'md';  // 10px | 12px
  interactive?: boolean;  // Show hover states
}
```

**Key Implementation Details:**
- Three circles with exact macOS colors: `#FF5F57`, `#FEBC2E`, `#28C840`
- Spacing: 8px gap between circles
- Optional hover states showing close/minimize/maximize icons
- Position absolute within parent container

**Why build early:** Required for `WindowMockup` composite.

#### 1.4 AnimatedGradient

**Purpose:** Animated background gradients for sections.

**Props Interface:**
```typescript
interface AnimatedGradientProps {
  className?: string;
  colors?: string[];  // Gradient color stops
  speed?: 'slow' | 'medium' | 'fast';
  direction?: 'horizontal' | 'vertical' | 'diagonal';
}
```

**Key Implementation Details:**
- Use CSS `@keyframes` with `background-position` animation
- Set `background-size: 200%` or `400%` to enable smooth looping
- Prefer CSS animation over Framer Motion for backgrounds (less overhead)

---

### Layer 2: Composites (Build Second)

Components that compose primitives into feature units.

```
src/components/landing/
  gradient-card.tsx    # Feature card with color identity
  window-mockup.tsx    # macOS window with content
  glow-card.tsx        # Card with hover glow effect
```

#### 2.1 GradientCard

**Purpose:** Feature cards with color identity and premium styling.

**Props Interface:**
```typescript
interface GradientCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  colorScheme: 'blue' | 'purple' | 'orange' | 'green';
  className?: string;
}
```

**Composition:**
```
GradientCard
  GlassPanel (blur: 'subtle', border: true)
    GradientGlow (position: 'top', intensity: 'subtle')
      [icon slot]
      [title slot]
      [description slot]
```

**Key Implementation Details:**
- Each `colorScheme` maps to gradient colors (align with Virtuna's accent palette)
- Glow appears at top of card, fades down
- Hover state intensifies glow slightly
- Inherits existing `FeatureCard` padding: `py-12 px-[26px]`

#### 2.2 WindowMockup

**Purpose:** macOS-style window for showcasing UI/features.

**Props Interface:**
```typescript
interface WindowMockupProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  variant?: 'browser' | 'app';  // Browser has URL bar
  dark?: boolean;
}
```

**Composition:**
```
WindowMockup
  GlassPanel (blur: 'medium')
    [window header]
      TrafficLights
      [title or URL bar]
    [content slot - children]
```

**Key Implementation Details:**
- Window header: `h-10` with border-bottom
- Content area has subtle inner shadow for depth
- Rounded corners: `rounded-lg` (matches existing design tokens)
- Shadow: `shadow-xl` for elevation

#### 2.3 GlowCard

**Purpose:** Interactive card with cursor-following glow.

**Props Interface:**
```typescript
interface GlowCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
}
```

**Composition:**
```
GlowCard
  GlassPanel
    GradientGlow (mode: 'cursor')
      [children]
```

---

### Layer 3: Motion Wrappers (Build in Parallel)

Extend existing motion system with new patterns.

```
src/components/motion/
  fade-in.tsx          # EXISTS - keep as-is
  slide-up.tsx         # EXISTS - keep as-is
  stagger-children.tsx # NEW - staggered child animations
  parallax.tsx         # NEW - scroll-linked parallax
  animated-section.tsx # NEW - full section animation wrapper
```

#### 3.1 StaggerChildren

**Purpose:** Animate children with staggered delays.

**Props Interface:**
```typescript
interface StaggerChildrenProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;  // Delay between each child (default: 0.1)
  once?: boolean;
}
```

**Key Implementation Details:**
- Use Framer Motion `staggerChildren` in parent variants
- Children use `motion.div` with shared variants
- Respects `prefers-reduced-motion`

#### 3.2 AnimatedSection

**Purpose:** Full page section with scroll-triggered entrance.

**Props Interface:**
```typescript
interface AnimatedSectionProps {
  children: React.ReactNode;
  className?: string;
  animation?: 'fade' | 'slide-up' | 'scale';
  threshold?: number;  // Viewport intersection threshold
  delay?: number;
}
```

**Key Implementation Details:**
- Uses `whileInView` with `viewport={{ once: true, margin: "-100px" }}`
- Matches existing easing: `[0.215, 0.61, 0.355, 1]` (ease-out-cubic)
- Default animation matches existing `FadeIn` pattern

---

### Layer 4: Page Sections (Build Last)

Full sections assembled from composites.

```
src/components/landing/
  hero-section.tsx         # EXISTS - enhance with new effects
  features-section.tsx     # EXISTS - use new GradientCards
  showcase-section.tsx     # NEW - WindowMockup with demo
  testimonials-section.tsx # NEW - glassmorphism testimonial cards
```

---

## Reusability Patterns

### Glass Effect System

**Single source of truth for glassmorphism:**

```typescript
// In GlassPanel component
const blurValues = {
  subtle: 'blur-sm',      // 8px
  medium: 'blur-md',      // 12px
  heavy: 'blur-lg',       // 16px
} as const;

// Consistent glass styling
const glassBase = cn(
  'backdrop-blur-[var(--glass-blur)]',
  'bg-white/[var(--glass-opacity)]',
  'border border-white/10',
  'rounded-lg'
);
```

**CSS custom properties in globals.css:**
```css
@theme {
  --glass-blur-subtle: 8px;
  --glass-blur-medium: 12px;
  --glass-blur-heavy: 16px;
  --glass-opacity-light: 0.1;
  --glass-opacity-dark: 0.05;
}
```

**Why this pattern:**
- Centralized blur/opacity values ensure consistency
- CSS custom properties enable theme-level overrides
- Easy to adjust globally without hunting through components

### Gradient System

**Color identity palette:**
```typescript
// src/lib/gradients.ts
export const gradientPalettes = {
  blue: {
    start: '#3B82F6',
    end: '#1D4ED8',
    glow: 'rgba(59, 130, 246, 0.4)',
  },
  purple: {
    start: '#8B5CF6',
    end: '#6D28D9',
    glow: 'rgba(139, 92, 246, 0.4)',
  },
  orange: {
    start: '#F97316',
    end: '#EA580C',
    glow: 'rgba(249, 115, 22, 0.4)',
  },
  accent: {
    start: '#E57850',  // Virtuna accent
    end: '#D45D3A',
    glow: 'rgba(229, 120, 80, 0.4)',
  },
} as const;
```

**Usage pattern:**
```tsx
<GradientCard colorScheme="accent" />
<GradientGlow color={gradientPalettes.purple.glow} />
```

### Animation System

**Extend existing motion patterns:**

The codebase already has solid patterns in `src/components/motion/`:
- `FadeIn` and `SlideUp` use consistent easing
- Both respect `prefers-reduced-motion` via `useReducedMotion()`
- Both use `whileInView` with `viewport={{ once: true }}`

**Extend, don't replace:**
```typescript
// New animations follow the same patterns
export const motionPresets = {
  fadeIn: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  },
  slideUp: {
    hidden: { opacity: 0, y: 60 },
    visible: { opacity: 1, y: 0 },
  },
  scaleIn: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 },
  },
} as const;

// Consistent easing (already defined in globals.css)
export const easings = {
  outCubic: [0.215, 0.61, 0.355, 1],
  outQuart: [0.165, 0.84, 0.44, 1],
} as const;
```

---

## Build Order

Recommended implementation sequence based on dependencies:

### Phase 1: Visual Primitives (Foundation)

| Order | Component | Dependencies | Estimated Effort |
|-------|-----------|--------------|------------------|
| 1.1 | GlassPanel | None | 2-3 hours |
| 1.2 | TrafficLights | None | 1 hour |
| 1.3 | GradientGlow | None | 3-4 hours |
| 1.4 | AnimatedGradient | None | 2 hours |

**Rationale:** These have no dependencies and are needed by all composites.

### Phase 2: Composites

| Order | Component | Dependencies | Estimated Effort |
|-------|-----------|--------------|------------------|
| 2.1 | WindowMockup | GlassPanel, TrafficLights | 3-4 hours |
| 2.2 | GradientCard | GlassPanel, GradientGlow | 3-4 hours |
| 2.3 | GlowCard | GlassPanel, GradientGlow | 2-3 hours |

**Rationale:** Build WindowMockup first for early showcase ability.

### Phase 3: Motion Extensions

| Order | Component | Dependencies | Estimated Effort |
|-------|-----------|--------------|------------------|
| 3.1 | StaggerChildren | Existing motion system | 2 hours |
| 3.2 | AnimatedSection | Existing FadeIn/SlideUp | 2-3 hours |

**Rationale:** Can build in parallel with Phase 2.

### Phase 4: Page Sections

| Order | Component | Dependencies | Estimated Effort |
|-------|-----------|--------------|------------------|
| 4.1 | Showcase Section | WindowMockup | 3-4 hours |
| 4.2 | Enhanced Features | GradientCard | 2-3 hours |
| 4.3 | Hero Enhancements | All primitives | 3-4 hours |

---

## File Structure

```
src/
  components/
    effects/                    # NEW - visual effect primitives
      index.ts
      glass-panel.tsx
      gradient-glow.tsx
      animated-gradient.tsx
      traffic-lights.tsx
    motion/                     # EXISTS - extend
      index.ts
      fade-in.tsx              # EXISTS
      slide-up.tsx             # EXISTS
      stagger-children.tsx     # NEW
      animated-section.tsx     # NEW
    landing/                    # EXISTS - extend
      index.ts
      gradient-card.tsx        # NEW
      window-mockup.tsx        # NEW
      glow-card.tsx            # NEW
      hero-section.tsx         # EXISTS - enhance
      features-section.tsx     # EXISTS - update to use GradientCard
    ui/                         # EXISTS - keep as-is
      ...
  lib/
    gradients.ts               # NEW - gradient palette definitions
    utils.ts                   # EXISTS
```

---

## Integration with Existing Codebase

### Tailwind v4 Considerations

The project uses Tailwind CSS v4 with `@theme` directive in `globals.css`. New design tokens should follow this pattern:

```css
@theme {
  /* Existing tokens */
  --color-accent: #E57850;

  /* New glass tokens */
  --glass-blur-subtle: 8px;
  --glass-blur-medium: 12px;
  --glass-blur-heavy: 16px;
}
```

### Motion Library

The project uses `motion` (v12.29.2), the standalone Framer Motion successor. Key differences:
- Import from `"motion/react"` not `"framer-motion"`
- Same API as Framer Motion
- Types import: `import type { Variants } from "motion/react"`

### Component Patterns to Follow

The existing codebase establishes clear patterns:

1. **Client components:** Mark with `"use client"` at top
2. **cn() utility:** Use for className merging
3. **Props interfaces:** Export interfaces for TypeScript
4. **Ref forwarding:** Use `forwardRef` for primitive UI components
5. **Reduced motion:** Always check `useReducedMotion()`

---

## Anti-Patterns to Avoid

### Performance Anti-Patterns

1. **Animating backdrop-filter:** Never animate blur values. Instead, crossfade between blurred/unblurred states.

2. **Stacking glass elements:** Limit to 2-3 glassmorphic elements per viewport. More causes performance issues on mobile.

3. **Large blur values:** Keep blur at 8-12px for best performance. Reduce to 6px on mobile via media query.

### Accessibility Anti-Patterns

1. **Low contrast text on glass:** Always use `text-white` or very light text. Never dark text on glass.

2. **Missing borders:** Glass without borders is hard to perceive. Always include `border-white/10`.

3. **Motion without alternatives:** Always wrap animations in `useReducedMotion()` checks.

### Architecture Anti-Patterns

1. **Hardcoded gradient colors:** Use the centralized `gradientPalettes` object, not inline hex values.

2. **Duplicated glass styles:** Use `GlassPanel` primitive, not copying backdrop-filter everywhere.

3. **Mixed animation systems:** Stick to Motion library for all animations. Don't mix with CSS animations for the same elements.

---

## Sources

### Glassmorphism Best Practices
- [Glass UI Generator](https://ui.glass/generator/) - CSS generator reference
- [Josh W. Comeau - Backdrop Filter](https://www.joshwcomeau.com/css/backdrop-filter/) - Performance insights
- [Dark Glassmorphism 2026](https://medium.com/@developer_89726/dark-glassmorphism-the-aesthetic-that-will-define-ui-in-2026-93aa4153088f) - Modern trends

### React Component Patterns
- [React Design Patterns 2026](https://www.sayonetech.com/blog/react-design-patterns/) - Composition patterns
- [Launch UI Components](https://www.launchuicomponents.com/) - Landing page component reference
- [Aceternity UI Glowing Effect](https://ui.aceternity.com/components/glowing-effect) - Glow implementation reference

### Motion/Animation
- [Motion.dev Scroll Animations](https://motion.dev/docs/react-scroll-animations) - Official docs
- [React Scroll Animations with Framer Motion](https://blog.logrocket.com/react-scroll-animations-framer-motion/) - Patterns

### Window Mockup
- [react-mockup npm](https://www.npmjs.com/package/react-mockup) - Reference implementation
- [Mac OS X Traffic Lights](https://codepen.io/atdrago/pen/yezrBR) - CSS reference
