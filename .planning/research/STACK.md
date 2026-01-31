# Stack Research: Premium Landing Page Design

**Project:** Virtuna v1.3.2 - Raycast-inspired Landing Page Redesign
**Researched:** 2026-01-31
**Overall confidence:** HIGH

---

## Executive Summary

This research covers CSS techniques and animation approaches for achieving premium visual effects inspired by Raycast.com and iOS 26's "Liquid Glass" design language. The existing stack (Next.js 14+, TypeScript, Tailwind CSS 4, Motion v12) is well-suited for this work. No additional libraries are required - the focus is on CSS techniques and Motion patterns.

---

## CSS Techniques

### Glassmorphism (Frosted Glass)

The core glassmorphism effect requires four CSS properties working together.

**Essential CSS Properties:**

```css
.glass-panel {
  /* 1. Semi-transparent background */
  background: rgba(255, 255, 255, 0.15);

  /* 2. Backdrop blur - the magic ingredient */
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px); /* Safari support */

  /* 3. Subtle border for edge definition */
  border: 1px solid rgba(255, 255, 255, 0.2);

  /* 4. Soft shadow for depth */
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);

  border-radius: 16px;
}
```

**Tailwind CSS 4 Implementation:**

```tsx
<div className="
  bg-white/15
  backdrop-blur-md
  border border-white/20
  shadow-lg shadow-black/10
  rounded-2xl
">
```

**Dark Theme Variant (for Virtuna's dark aesthetic):**

```css
.glass-panel-dark {
  background: rgba(26, 26, 26, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
```

**Blur Value Guidelines:**
- Light blur (6-8px): Subtle frosting, content behind visible
- Medium blur (10-14px): Sweet spot for most UI elements
- Heavy blur (16-24px): Strong frosting, near-opaque appearance

**Why these values:** 10-20px is the sweet spot for blur. Below 10px, text behind becomes distractingly readable. Above 20px, you lose the translucency that gives the effect its energy.

### iOS 26 "Liquid Glass" Advanced Technique

Apple's Liquid Glass goes beyond basic glassmorphism with layered depth cues.

**Complete Implementation:**

```css
.liquid-glass {
  position: relative;
  padding: 2rem;
  border-radius: 24px;
  color: #fff;

  /* Glass core */
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.15),
    rgba(255, 255, 255, 0.05)
  );
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.15);

  /* Depth via multiple shadows */
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);

  overflow: hidden;
}

/* Overlay gradient for extra depth */
.liquid-glass::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 24px;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.12),
    rgba(255, 255, 255, 0.06)
  );
  mix-blend-mode: overlay;
  pointer-events: none;
}

/* Subtle highlight/reflection */
.liquid-glass::after {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 24px;
  background: radial-gradient(
    circle at 30% 30%,
    rgba(255, 255, 255, 0.06),
    transparent 70%
  );
  filter: blur(1px);
  pointer-events: none;
}
```

**Key Difference from Basic Glassmorphism:** The gradient background (135deg angle), multiple pseudo-elements for layered depth, and inset shadows that simulate light refraction.

### Gradient Lighting / Glow Effects

For dramatic Raycast-style gradient glows behind elements.

**Glow Behind Cards:**

```css
.glow-container {
  position: relative;
}

.glow-container::before {
  content: '';
  position: absolute;
  inset: -20px;
  background: radial-gradient(
    ellipse at center,
    rgba(229, 120, 80, 0.4) 0%,  /* Virtuna accent color */
    transparent 70%
  );
  filter: blur(40px);
  z-index: -1;
}
```

**Tailwind Implementation:**

```tsx
{/* Glow layer */}
<div className="absolute -inset-5 bg-gradient-radial from-accent/40 to-transparent blur-3xl -z-10" />
```

**Animated Gradient Glow (Subtle Pulse):**

```css
@keyframes glow-pulse {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.02); }
}

.animated-glow::before {
  animation: glow-pulse 4s ease-in-out infinite;
}
```

**Neon Text Glow:**

```css
.neon-text {
  text-shadow:
    0 0 5px rgba(229, 120, 80, 0.5),
    0 0 10px rgba(229, 120, 80, 0.3),
    0 0 20px rgba(229, 120, 80, 0.2);
}
```

**Why layer shadows:** Multiple shadows with increasing blur radii create depth and light-bleed effect. Three layers (5px, 10px, 20px) is the standard for realistic glow.

### Gradient Borders

For premium card edges with color transitions.

**Technique 1: Pseudo-element (Recommended)**

```css
.gradient-border {
  position: relative;
  background: var(--color-background-elevated);
  border-radius: 16px;
}

.gradient-border::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 17px;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.2),
    rgba(255, 255, 255, 0.05)
  );
  z-index: -1;
}
```

**Technique 2: Mask (For Complex Gradients)**

```css
.gradient-border-mask {
  border: 2px solid transparent;
  background:
    linear-gradient(var(--color-background-elevated), var(--color-background-elevated)) padding-box,
    linear-gradient(135deg, #E57850, #708090) border-box;
  border-radius: 16px;
}
```

**Tailwind Implementation:**

```tsx
<div className="relative">
  {/* Gradient border layer */}
  <div className="absolute -inset-px rounded-[17px] bg-gradient-to-br from-white/20 to-white/5" />
  {/* Content */}
  <div className="relative bg-background-elevated rounded-2xl p-6">
    Content here
  </div>
</div>
```

### Depth & Shadows (iOS 26 Style)

Multi-layer shadows create realistic depth perception.

**Elevation Levels:**

```css
/* Level 1: Subtle lift (cards, panels) */
.elevation-1 {
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.1),
    0 4px 8px rgba(0, 0, 0, 0.1);
}

/* Level 2: Medium elevation (modals, dropdowns) */
.elevation-2 {
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.1),
    0 8px 16px rgba(0, 0, 0, 0.15),
    0 16px 32px rgba(0, 0, 0, 0.1);
}

/* Level 3: High elevation (floating elements) */
.elevation-3 {
  box-shadow:
    0 4px 8px rgba(0, 0, 0, 0.1),
    0 16px 32px rgba(0, 0, 0, 0.2),
    0 32px 64px rgba(0, 0, 0, 0.15);
}
```

**Why multiple shadows:** Single shadows look flat. Stacking 2-3 shadows with different blur/spread values creates the perception of real-world light behavior.

---

## Animation Stack

### Motion (Framer Motion) v12 - Already Installed

The project already has `motion` v12.29.2 installed. This is the recommended library.

**Basic Setup:**

```tsx
import { motion } from 'motion/react';

// Simple fade-in
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4, ease: 'easeOut' }}
>
```

### Recommended Animation Patterns

**1. Viewport-triggered Animations (Scroll Reveal)**

```tsx
import { motion } from 'motion/react';

<motion.div
  initial={{ opacity: 0, y: 30 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: '-50px' }}
  transition={{ duration: 0.5, ease: [0.215, 0.61, 0.355, 1] }}
>
  Content fades in on scroll
</motion.div>
```

**2. Staggered Children (Feature Cards)**

```tsx
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' }
  }
};

<motion.div
  variants={containerVariants}
  initial="hidden"
  whileInView="visible"
  viewport={{ once: true }}
>
  {items.map((item) => (
    <motion.div key={item.id} variants={itemVariants}>
      {item.content}
    </motion.div>
  ))}
</motion.div>
```

**3. Spring Physics (Interactive Elements)**

```tsx
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
>
  Click me
</motion.button>
```

**4. Layout Animations (Smooth Transitions)**

```tsx
<motion.div layout layoutId="unique-id">
  Content that smoothly animates between layouts
</motion.div>
```

### Performance Optimization

**Rule 1: Only Animate Transform & Opacity**

```tsx
// GOOD - GPU accelerated
<motion.div
  animate={{
    opacity: 1,
    x: 0,
    scale: 1,
    rotate: 0
  }}
/>

// BAD - Triggers layout/paint
<motion.div
  animate={{
    width: 100,
    height: 100,
    top: 0,
    left: 0
  }}
/>
```

**Rule 2: Respect Reduced Motion**

```tsx
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

<motion.div
  initial={prefersReducedMotion ? false : { opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4 }}
/>
```

Or use Motion's built-in support:

```tsx
import { MotionConfig } from 'motion/react';

<MotionConfig reducedMotion="user">
  <App />
</MotionConfig>
```

**Rule 3: Limit Backdrop-Filter Animations**

```tsx
// AVOID - backdrop-filter is expensive
<motion.div
  animate={{ backdropFilter: 'blur(20px)' }}
/>

// BETTER - Animate opacity of a pre-blurred element
<motion.div
  className="backdrop-blur-lg"
  animate={{ opacity: 1 }}
/>
```

**Rule 4: Use will-change Sparingly**

```tsx
// Only use when animation is imminent
<motion.div
  whileHover={{ scale: 1.05 }}
  style={{ willChange: 'transform' }}
/>
```

### Animation Duration Guidelines

| Animation Type | Duration | Easing |
|---------------|----------|--------|
| Micro-interactions (hover, tap) | 150-200ms | `easeOut` or spring |
| Element entrance | 300-400ms | `[0.215, 0.61, 0.355, 1]` (ease-out-cubic) |
| Page transitions | 400-600ms | `[0.165, 0.84, 0.44, 1]` (ease-out-quart) |
| Background/ambient | 2000-4000ms | `easeInOut` |

**Custom easing values already in globals.css:**
- `--ease-out-cubic: cubic-bezier(0.215, 0.61, 0.355, 1)`
- `--ease-out-quart: cubic-bezier(0.165, 0.84, 0.44, 1)`

---

## Integration Notes

### Tailwind CSS 4 Custom Theme Extensions

Add to `globals.css` under `@theme`:

```css
@theme {
  /* Existing variables... */

  /* Glassmorphism utilities */
  --backdrop-blur-glass: 12px;
  --backdrop-blur-glass-heavy: 20px;

  /* Glow colors */
  --color-glow-accent: rgba(229, 120, 80, 0.4);
  --color-glow-accent-strong: rgba(229, 120, 80, 0.6);
}
```

### Reusable Component Patterns

**Glass Panel Component:**

```tsx
// components/ui/glass-panel.tsx
interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  intensity?: 'light' | 'medium' | 'heavy';
}

export function GlassPanel({
  children,
  className,
  intensity = 'medium'
}: GlassPanelProps) {
  const blurClass = {
    light: 'backdrop-blur-sm',
    medium: 'backdrop-blur-md',
    heavy: 'backdrop-blur-lg'
  }[intensity];

  return (
    <div className={cn(
      'relative bg-white/10 border border-white/10 rounded-2xl',
      blurClass,
      'shadow-lg shadow-black/10',
      className
    )}>
      {children}
    </div>
  );
}
```

**Glow Container Component:**

```tsx
// components/ui/glow-container.tsx
interface GlowContainerProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
}

export function GlowContainer({
  children,
  className,
  glowColor = 'from-accent/40'
}: GlowContainerProps) {
  return (
    <div className={cn('relative', className)}>
      <div className={cn(
        'absolute -inset-8 rounded-full blur-3xl -z-10',
        `bg-gradient-radial ${glowColor} to-transparent`
      )} />
      {children}
    </div>
  );
}
```

### Browser Compatibility

**Backdrop-filter support:**
- Chrome 76+ (2019)
- Safari 9+ (with -webkit- prefix)
- Firefox 103+ (2022)
- Edge 79+ (2020)

**Fallback pattern:**

```css
.glass-panel {
  /* Fallback for older browsers */
  background: rgba(26, 26, 26, 0.9);
}

@supports (backdrop-filter: blur(10px)) {
  .glass-panel {
    background: rgba(26, 26, 26, 0.6);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
}
```

---

## Performance Checklist

- [ ] Limit glassmorphic elements to 2-3 per viewport
- [ ] Reduce blur to 6-8px on mobile devices
- [ ] Never animate backdrop-filter directly
- [ ] Only animate transform and opacity properties
- [ ] Use `viewport={{ once: true }}` for scroll-triggered animations
- [ ] Test on mobile devices (glassmorphism is GPU-intensive)
- [ ] Respect `prefers-reduced-motion`
- [ ] Keep animation durations under 400ms for UI interactions

---

## Sources

### Glassmorphism & CSS
- [Glass UI - CSS Glassmorphism Generator](https://ui.glass/generator/)
- [Dark Glassmorphism: The Aesthetic That Will Define UI in 2026](https://medium.com/@developer_89726/dark-glassmorphism-the-aesthetic-that-will-define-ui-in-2026-93aa4153088f)
- [Glassmorphism: What It Is and How to Use It in 2026](https://invernessdesignstudio.com/glassmorphism-what-it-is-and-how-to-use-it-in-2026)
- [How to Create Glassmorphic UI Effects with Pure CSS](https://blog.openreplay.com/create-glassmorphic-ui-css/)

### iOS 26 Liquid Glass
- [Tutorial: How to Recreate the iOS 26 Glassy Effect with CSS](https://therobbiedavis.com/how-to-recreate-the-ios-26-glassy-effect-with-css/)
- [Recreating Apple's Liquid Glass Effect with Pure CSS](https://dev.to/kevinbism/recreating-apples-liquid-glass-effect-with-pure-css-3gpl)
- [Liquid Glass UI: iOS 26 Redesign](https://www.designmonks.co/blog/liquid-glass-ui)

### Animation Performance
- [Motion Animation Performance Guide](https://motion.dev/docs/performance)
- [Framer Motion Tips for Performance in React](https://tillitsdone.com/blogs/framer-motion-performance-tips/)
- [Smooth as Butter: Achieving 60 FPS Animations with CSS3](https://medium.com/outsystems-experts/how-to-achieve-60-fps-animations-with-css3-db7b98610108)
- [CSS GPU Acceleration](https://www.testmu.ai/blog/css-gpu-acceleration/)

### Tailwind CSS
- [Tailwind CSS Backdrop Blur Documentation](https://tailwindcss.com/docs/backdrop-blur)
- [Gradient Border with TailwindCSS](https://reniki.com/blog/gradient-border)

### Glow Effects
- [Best Glowing Effects in CSS 2026](https://www.testmuai.com/blog/glowing-effects-in-css/)
- [CSS Glow Effects Collection](https://freefrontend.com/css-glow-effects/)
