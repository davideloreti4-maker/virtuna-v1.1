# Motion Guidelines

> Animation patterns and usage guidance for Virtuna.

All motion components are built on `motion/react` (Framer Motion) and use IntersectionObserver for scroll-triggered reveals. Every component respects `prefers-reduced-motion`.

---

## Principles

- **Subtle over dramatic:** Animations enhance, never distract
- **Performance-first:** All animations respect `prefers-reduced-motion: reduce`
- **Consistent timing:** Use duration tokens (`--duration-fast`: 150ms, `--duration-normal`: 200ms, `--duration-slow`: 300ms)
- **Consistent easing:** Use easing tokens (ease-out for entries, ease-in for exits)
- **Scroll-triggered:** Viewport intersection triggers reveals (no scroll-jacking)

---

## Scroll Reveal Components

### FadeIn

- **Purpose:** Opacity fade with subtle vertical slide on scroll
- **Duration:** 500ms default
- **Distance:** 20px translateY default
- **Easing:** ease-out-cubic `[0.215, 0.61, 0.355, 1]`
- **Trigger:** IntersectionObserver at `-100px` viewport margin
- **Use for:** Content sections, cards, text blocks, general reveals
- **Source:** `src/components/motion/fade-in.tsx`

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `delay` | `number` | `0` | Delay in seconds before animation starts |
| `duration` | `number` | `0.5` | Animation duration in seconds |
| `distance` | `number` | `20` | Vertical translate distance in pixels |
| `once` | `boolean` | `true` | Only trigger once when entering viewport |
| `className` | `string` | -- | Additional CSS classes |

```tsx
<FadeIn>
  <Card>Fades in on scroll</Card>
</FadeIn>

<FadeIn delay={0.2} distance={30}>
  <Card>Delayed, larger distance</Card>
</FadeIn>
```

---

### FadeInUp

- **Purpose:** Combined fade + upward slide (signature scroll-reveal)
- **Duration:** 600ms default
- **Distance:** 24px translateY default
- **Easing:** `[0.25, 0.1, 0.25, 1.0]` (standard ease)
- **Trigger:** IntersectionObserver at `-80px` viewport margin (earlier than FadeIn)
- **Use for:** Hero content, feature cards, key messaging, section headings
- **Source:** `src/components/motion/fade-in-up.tsx`

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `delay` | `number` | `0` | Delay in seconds |
| `duration` | `number` | `0.6` | Duration in seconds |
| `distance` | `number` | `24` | Vertical distance in pixels |
| `once` | `boolean` | `true` | Only trigger once |
| `as` | `"div" \| "section" \| "article" \| "aside" \| "header" \| "footer" \| "main" \| "span"` | `"div"` | HTML element to render |
| `className` | `string` | -- | Additional CSS classes |

```tsx
// Basic usage
<FadeInUp>
  <h2>Section Title</h2>
</FadeInUp>

// Manual stagger with incremental delay
<FadeInUp delay={0}>First item</FadeInUp>
<FadeInUp delay={0.1}>Second item</FadeInUp>
<FadeInUp delay={0.2}>Third item</FadeInUp>

// As a section element
<FadeInUp as="section" className="py-20">
  <SectionContent />
</FadeInUp>
```

---

### SlideUp

- **Purpose:** Dramatic upward slide with opacity
- **Duration:** 600ms default
- **Distance:** 60px translateY default (larger distance than FadeIn/FadeInUp)
- **Easing:** ease-out-quart `[0.165, 0.84, 0.44, 1]`
- **Trigger:** IntersectionObserver at `-100px` viewport margin
- **Use for:** List items, stacked content, elements needing more pronounced entrance
- **Source:** `src/components/motion/slide-up.tsx`

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `delay` | `number` | `0` | Delay in seconds |
| `duration` | `number` | `0.6` | Duration in seconds |
| `distance` | `number` | `60` | Vertical distance in pixels |
| `once` | `boolean` | `true` | Only trigger once |
| `className` | `string` | -- | Additional CSS classes |

```tsx
<SlideUp>
  <Card>Slides up on scroll</Card>
</SlideUp>
```

---

## Orchestration Components

### StaggerReveal

- **Purpose:** Sequenced reveal of child elements with coordinated timing
- **Child duration:** 500ms per child
- **Stagger delay:** 80ms between children (default)
- **Initial delay:** 100ms before first child
- **Easing:** `[0.25, 0.1, 0.25, 1.0]`
- **Trigger:** IntersectionObserver at `-50px` viewport margin
- **Use for:** Card grids, feature lists, navigation items, any group of similar elements
- **Pattern:** `StaggerReveal` wraps `StaggerRevealItem` (or `StaggerReveal.Item`) children
- **Source:** `src/components/motion/stagger-reveal.tsx`

**StaggerReveal Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `staggerDelay` | `number` | `0.08` | Delay between children in seconds (80ms) |
| `initialDelay` | `number` | `0.1` | Delay before first child in seconds (100ms) |
| `once` | `boolean` | `true` | Only trigger once |
| `className` | `string` | -- | Additional CSS classes |

**StaggerRevealItem Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | -- | Additional CSS classes |

```tsx
<StaggerReveal className="grid grid-cols-3 gap-4">
  <StaggerReveal.Item>
    <Card>Card 1</Card>
  </StaggerReveal.Item>
  <StaggerReveal.Item>
    <Card>Card 2</Card>
  </StaggerReveal.Item>
  <StaggerReveal.Item>
    <Card>Card 3</Card>
  </StaggerReveal.Item>
</StaggerReveal>
```

**Note:** In server components, import `StaggerRevealItem` directly instead of using the compound `StaggerReveal.Item` pattern for RSC static generation compatibility.

---

### HoverScale

- **Purpose:** Micro-interaction on hover with spring physics
- **Scale:** 1.02x on hover (default), 0.98x on tap/press (default)
- **Spring:** stiffness 400, damping 25 (snappy feel)
- **Use for:** Interactive cards, clickable elements, buttons (subtle enhancement)
- **Source:** `src/components/motion/hover-scale.tsx`

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `scale` | `number` | `1.02` | Scale factor on hover |
| `tapScale` | `number` | `0.98` | Scale factor on tap/press |
| `className` | `string` | -- | Additional CSS classes |

```tsx
<HoverScale>
  <Card>Hover me for a subtle scale effect</Card>
</HoverScale>

<HoverScale scale={1.05} tapScale={0.95} className="inline-block">
  <Button>Interactive Button</Button>
</HoverScale>
```

---

## Page Transitions

### PageTransition

- **Purpose:** Route change animation using AnimatePresence
- **Pattern:** FrozenRouter + AnimatePresence with `mode="wait"`
- **Duration:** 300ms opacity fade
- **Use for:** Wrapping page content in layouts for smooth route transitions
- **Source:** `src/components/motion/page-transition.tsx`

```tsx
// In a layout component
<PageTransition>
  {children}
</PageTransition>
```

### FrozenRouter

- **Purpose:** Prevents child re-render during exit animations
- **Use for:** Internal use by PageTransition (rarely used directly)
- **Source:** `src/components/motion/frozen-router.tsx`

---

## Effects (Non-Motion)

### NoiseTexture

- **Purpose:** SVG grain overlay for texture and premium feel
- **Method:** SVG `feTurbulence` with `fractalNoise` pattern
- **Opacity:** 0.03 default (very subtle)
- **SSR:** Uses `React.useId()` for unique filter IDs (no hydration mismatch)
- **Use for:** Large glass panels, hero backgrounds, premium sections
- **Source:** `src/components/effects/noise-texture.tsx`

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `opacity` | `number` | `0.03` | Overlay opacity (keep low) |
| `baseFrequency` | `number` | `0.65` | Noise frequency (higher = finer) |
| `numOctaves` | `number` | `3` | Detail level (more = heavier) |
| `className` | `string` | -- | Additional CSS classes |

```tsx
<GlassCard className="relative">
  <NoiseTexture />
  <p>Content with subtle grain overlay</p>
</GlassCard>
```

**Important:** Parent must have `position: relative` for correct overlay positioning.

---

### ChromaticAberration

- **Purpose:** RGB split text effect for decorative headings
- **Method:** CSS `textShadow` with offset red and cyan channels
- **Offset:** 1px default
- **Intensity:** 0.15 default (subtle)
- **Use for:** Display headings on glass surfaces, decorative text only
- **Source:** `src/components/effects/chromatic-aberration.tsx`

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `offset` | `number` | `1` | Pixel offset for RGB split |
| `intensity` | `number` | `0.15` | Shadow opacity (0-1) |
| `as` | `"div" \| "span"` | `"div"` | HTML element to render |
| `className` | `string` | -- | Additional CSS classes |

```tsx
<ChromaticAberration>
  <h2 className="text-2xl font-bold">Premium Feature</h2>
</ChromaticAberration>
```

**Important:** Use sparingly on decorative headings only. Never on body text or content that needs clear readability.

---

## Choosing the Right Animation

| Context | Component | Why |
|---------|-----------|-----|
| General content appearing on scroll | **FadeIn** | Subtle, default choice |
| Hero content, feature highlights | **FadeInUp** | More presence, signature animation |
| List items entering from below | **SlideUp** | Dramatic entrance for important content |
| Grid of cards or repeated items | **StaggerReveal** | Coordinated group animation |
| Interactive card hover feedback | **HoverScale** | Micro-interaction, spring physics |
| Route transitions | **PageTransition** | Smooth page changes |
| Adding premium texture | **NoiseTexture** | Grain overlay on glass surfaces |
| Decorative heading effect | **ChromaticAberration** | RGB split on display text |

### Decision Flow

1. Is it a group of similar items? -> **StaggerReveal**
2. Is it hero/key messaging? -> **FadeInUp**
3. Is it a hover interaction? -> **HoverScale**
4. Is it general content? -> **FadeIn** (safe default)
5. Need more dramatic entrance? -> **SlideUp**

---

## Timing Guidelines

| Context | Duration | Easing |
|---------|----------|--------|
| Hover feedback | 150ms (`--duration-fast`) | ease-out |
| Toggle, switch | 150ms (`--duration-fast`) | ease-spring |
| Content reveal (scroll) | 500-600ms | ease-out-cubic or ease-out-quart |
| Page transition | 300ms (`--duration-slow`) | linear (opacity) |
| Stagger delay | 80ms between items | -- |
| Initial stagger delay | 100ms | -- |
| Exit animation | 200-300ms | ease-in |
| Skeleton shimmer | 2s cycle | ease-in-out (infinite) |

---

## Reduced Motion

All motion components check `prefers-reduced-motion: reduce` via the `useReducedMotion()` hook from `motion/react`.

**When reduced motion is preferred:**

| Component | Behavior |
|-----------|----------|
| FadeIn | Renders plain `<div>` (instant display, no animation) |
| FadeInUp | Renders plain element (using `as` prop tag) |
| SlideUp | Renders plain `<div>` |
| StaggerReveal | Renders plain `<div>` (all children visible immediately) |
| HoverScale | Renders plain `<div>` (no scale effect) |
| PageTransition | Renders children directly (no AnimatePresence) |
| Skeleton shimmer | `motion-reduce:animate-none` via Tailwind (static gradient) |

**Motion is always optional** -- all content must be accessible and functional without animation.

### CSS-Level Reduced Motion

The Skeleton component uses Tailwind's `motion-reduce:animate-none` class, which applies `animation: none` when `prefers-reduced-motion: reduce` is active. This overrides the inline shimmer animation.

---

## Import Paths

```tsx
// All motion components
import { FadeIn, FadeInUp, SlideUp, StaggerReveal, StaggerRevealItem, HoverScale, PageTransition } from "@/components/motion";

// Individual imports
import { FadeIn } from "@/components/motion/fade-in";
import { FadeInUp } from "@/components/motion/fade-in-up";
import { SlideUp } from "@/components/motion/slide-up";
import { StaggerReveal, StaggerRevealItem } from "@/components/motion/stagger-reveal";
import { HoverScale } from "@/components/motion/hover-scale";
import { PageTransition } from "@/components/motion/page-transition";

// Effects
import { NoiseTexture } from "@/components/effects/noise-texture";
import { ChromaticAberration } from "@/components/effects/chromatic-aberration";

// Types
import type { FadeInProps } from "@/components/motion/fade-in";
import type { FadeInUpProps } from "@/components/motion/fade-in-up";
import type { SlideUpProps } from "@/components/motion/slide-up";
import type { StaggerRevealProps, StaggerRevealItemProps } from "@/components/motion/stagger-reveal";
import type { HoverScaleProps } from "@/components/motion/hover-scale";
import type { NoiseTextureProps } from "@/components/effects/noise-texture";
import type { ChromaticAberrationProps } from "@/components/effects/chromatic-aberration";
```

---

*Last updated: 2026-02-05*
