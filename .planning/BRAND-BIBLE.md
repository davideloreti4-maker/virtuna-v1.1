# Virtuna Brand Bible

**Version:** 1.0
**Last Updated:** 2026-02-03
**Design Direction:** iOS 26 Liquid Glass + Raycast Premium Aesthetic

---

## Quick Reference

When generating UI, provide this file as context along with `/showcase` screenshots.

```
Design system: iOS 26 liquid glass + Raycast-inspired
Background: Near-black (#0A0A0B / oklch 0.13)
Glass: Frosted panels with colored tints and inner glow
Accent: Coral/orange (#E57850)
Typography: Funnel Display (headings) + Satoshi (body)
```

---

## 1. Brand Identity

### Logo
**Primary:** "Virtuna" wordmark in Funnel Display Bold
**Usage:**
- Minimum size: 80px width
- Clear space: 1x height on all sides
- On dark backgrounds: White text
- Never: Outline, gradient text, or modified proportions

### Tagline
"AI-powered viral content insights"

### Brand Voice
- **Confident** — We know what makes content viral
- **Direct** — No fluff, actionable insights
- **Premium** — Quality over quantity
- **Technical yet accessible** — Expert insights, clear language

---

## 2. Color System

### Background Hierarchy

| Token | Value | Usage |
|-------|-------|-------|
| `bg-base` | oklch(0.13 0.02 264) / #0A0A0B | Page backgrounds, hero sections |
| `surface` | oklch(0.18 0.02 264) / ~#121214 | Elevated containers, panels |
| `surface-elevated` | oklch(0.23 0.02 264) / ~#1A1A1E | Cards, modals, dropdowns |

### Text Hierarchy

| Token | Value | Usage |
|-------|-------|-------|
| `text-primary` | oklch(0.98 0 0) / #FAFAFA | Headlines, primary content |
| `text-secondary` | oklch(0.70 0 0) / #B3B3B3 | Descriptions, secondary info |
| `text-tertiary` | oklch(0.50 0 0) / #808080 | Placeholders, disabled, hints |

### Accent Colors

| Token | Value | Usage | Semantic |
|-------|-------|-------|----------|
| `gradient-purple` | oklch(0.63 0.24 300) | AI features | Intelligence |
| `gradient-blue` | oklch(0.62 0.19 250) | Analytics | Data |
| `gradient-pink` | oklch(0.66 0.22 350) | Social features | Engagement |
| `gradient-cyan` | oklch(0.72 0.15 200) | Performance | Speed |
| `gradient-green` | oklch(0.68 0.17 145) | Growth metrics | Success |
| `gradient-orange` | oklch(0.70 0.18 50) | Content creation | Creativity |

### Primary Accent
- **Coral/Orange:** #E57850 — CTAs, primary buttons, links

### Color Usage Rules
1. **One accent per feature** — Each feature section gets ONE gradient color
2. **Purple for AI** — Anything AI/ML powered uses purple
3. **Blue for data** — Analytics, charts, metrics use blue
4. **Green for positive** — Growth, success, earnings use green
5. **Neutral for chrome** — UI chrome, borders, dividers stay neutral

---

## 3. Typography

### Font Stack

```css
--font-display: 'Funnel Display', sans-serif;  /* Headlines */
--font-sans: 'Satoshi', ui-sans-serif, system-ui, sans-serif;  /* Body */
```

### Type Scale

| Name | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Hero | 52-72px | Bold (700) | 1.1 | Landing hero headlines |
| H1 | 40-48px | Bold (700) | 1.2 | Page titles |
| H2 | 28-32px | Semibold (600) | 1.3 | Section headings |
| H3 | 20-24px | Semibold (600) | 1.4 | Card titles |
| H4 | 16-18px | Medium (500) | 1.4 | Subsections |
| Body | 16px | Regular (400) | 1.6 | Paragraphs |
| Body Small | 14px | Regular (400) | 1.5 | Secondary text |
| Caption | 12px | Medium (500) | 1.4 | Labels, hints |
| Overline | 11-12px | Semibold (600) | 1.2 | Tags, categories (uppercase) |

### Typography Rules
1. **Funnel Display** for headlines only (H1, H2, hero text)
2. **Satoshi** for everything else
3. **Never** use more than 3 font weights on one page
4. **Letter-spacing:** -0.02em for headlines, normal for body
5. **Text on glass:** Add subtle text-shadow for depth

---

## 4. Spacing System

### Base Unit: 4px

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Tight spacing, icon gaps |
| `space-2` | 8px | Inline element gaps |
| `space-3` | 12px | Small padding |
| `space-4` | 16px | Standard padding, gaps |
| `space-6` | 24px | Card padding |
| `space-8` | 32px | Section gaps |
| `space-12` | 48px | Large section padding |
| `space-16` | 64px | Page section margins |
| `space-24` | 96px | Hero section padding |

### Spacing Rules
1. **Component internal:** 16-24px padding
2. **Between cards:** 16-24px gap
3. **Between sections:** 48-96px margin
4. **Icon to text:** 8-12px gap

---

## 5. Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 4px | Pills, small badges |
| `radius-md` | 8px | Buttons, inputs |
| `radius-lg` | 12px | Cards, panels |
| `radius-xl` | 16px | Modals, large containers |
| `radius-2xl` | 24px | Hero cards, featured content |
| `radius-full` | 9999px | Avatars, circular buttons |

---

## 6. Shadow System

### Elevation Scale

```css
/* Subtle - barely visible */
--shadow-sm: 0 1px 2px oklch(0 0 0 / 0.2);

/* Medium - cards, dropdowns */
--shadow-md:
  0 4px 6px oklch(0 0 0 / 0.15),
  0 2px 4px oklch(0 0 0 / 0.1);

/* Large - modals, popovers */
--shadow-lg:
  0 10px 15px oklch(0 0 0 / 0.15),
  0 4px 6px oklch(0 0 0 / 0.1);

/* Elevated - floating panels */
--shadow-elevated:
  0 20px 25px oklch(0 0 0 / 0.15),
  0 10px 10px oklch(0 0 0 / 0.1),
  0 0 0 1px oklch(1 0 0 / 0.05);

/* Float - dramatic floating effect */
--shadow-float:
  0 25px 50px oklch(0 0 0 / 0.25),
  0 12px 24px oklch(0 0 0 / 0.15);

/* Glass - for glassmorphism panels */
--shadow-glass:
  0 8px 32px oklch(0 0 0 / 0.2),
  inset 0 1px 0 oklch(1 0 0 / 0.1);
```

---

## 7. Glassmorphism System

### GlassPanel Props

```tsx
<GlassPanel
  blur="sm" | "md" | "lg"     // 8px | 12px | 20px
  opacity={0.6}                // Background opacity 0-1
  tint="neutral" | "purple" | "blue" | "pink" | "cyan" | "green" | "orange"
  innerGlow={0.5}              // 0-1 intensity
  borderGlow                   // Adds ring-1 border
/>
```

### Glass Rules
1. **Max 2-3 glass layers** per viewport
2. **Mobile:** Reduce blur to 6-8px for performance
3. **Safari:** Always include -webkit-backdrop-filter
4. **Tint + innerGlow** for iOS 26 liquid glass effect
5. **borderGlow** adds subtle white ring

### GradientGlow (Ambient Lighting)

```tsx
<GradientGlow
  color="purple"              // Gradient palette color
  intensity="subtle" | "medium" | "strong"  // 15% | 30% | 50% opacity
  size={400}                  // Diameter in px
  position="center" | "top" | "bottom" | "top-left" | ...
  blur={100}                  // Blur amount
  animate                     // Enable animation
  animationType="pulse" | "float" | "breathe"
/>
```

### GradientMesh (Multi-color Background)

```tsx
<GradientMesh
  colors={["purple", "blue", "pink"]}  // 2-4 colors
  intensity="subtle" | "medium" | "strong"
  animate                     // Slow drift animation
/>
```

---

## 8. Component Patterns

### GlassCard

```tsx
<GlassCard
  color="purple"              // Color identity
  glow                        // Add ambient glow behind
  tinted                      // Apply color tint to glass
  hover="none" | "lift" | "glow-boost"
  padding="none" | "sm" | "md" | "lg"
/>
```

### GlassPill

```tsx
<GlassPill
  color="neutral" | "purple" | ...
  size="sm" | "md" | "lg"
  active                      // Selected state
  disabled
  onClick={...}
/>
```

### TrafficLights

```tsx
<TrafficLights
  size="sm" | "md" | "lg"     // 10px | 12px | 14px
  interactive                 // Show hover icons
  disabled                    // Gray out
/>
```

---

## 9. Button System

### Variants

| Variant | Usage | Style |
|---------|-------|-------|
| `primary` | Main CTAs | Coral background (#E57850), white text |
| `secondary` | Secondary actions | Glass panel, white text |
| `ghost` | Tertiary actions | Transparent, white text |
| `link` | Inline links | No background, accent color text |

### Sizes

| Size | Height | Padding | Font Size |
|------|--------|---------|-----------|
| `sm` | 32px | 12px 16px | 14px |
| `md` | 40px | 16px 24px | 16px |
| `lg` | 48px | 20px 32px | 18px |

### States
- **Default:** Base style
- **Hover:** Scale 1.02, slight glow
- **Active:** Scale 0.98
- **Disabled:** 50% opacity, no pointer
- **Loading:** Spinner replaces text

---

## 10. Form Components

### Input

```tsx
<Input
  error                       // Red border
  disabled
  className="..."
/>
```

- Background: `surface-elevated`
- Border: `1px solid white/10`
- Focus: `ring-2 ring-accent`
- Error: `ring-2 ring-red-500`

### On Glass Backgrounds
- Use slightly higher opacity background
- Add subtle inner shadow
- Ensure 4.5:1 contrast for text

---

## 11. Animation & Motion

### Timing

| Duration | Usage |
|----------|-------|
| 150ms | Micro-interactions (button press) |
| 200ms | Hover states, small transitions |
| 300ms | Panel open/close, card reveals |
| 500ms | Page transitions, large animations |
| 1000ms+ | Background animations, ambient motion |

### Easing

```css
--ease-out-cubic: cubic-bezier(0.215, 0.61, 0.355, 1);    /* General use */
--ease-out-quart: cubic-bezier(0.165, 0.84, 0.44, 1);     /* Dramatic */
```

### Spring Physics (for hovers/interactions)
- Stiffness: 400
- Damping: 17

### Reduced Motion
- Respect `prefers-reduced-motion`
- Replace animations with instant transitions
- Remove parallax and scale effects

---

## 12. Responsive Breakpoints

| Name | Min Width | Usage |
|------|-----------|-------|
| `sm` | 640px | Large phones landscape |
| `md` | 768px | Tablets |
| `lg` | 1024px | Small desktops |
| `xl` | 1280px | Standard desktops |
| `2xl` | 1536px | Large screens |

### Mobile Considerations
- Glass blur: Reduce to 6-8px
- Gradient count: Max 2 gradient glows
- Touch targets: Min 44x44px
- Font sizes: Slightly larger for readability

---

## 13. Icon System

### Library: Phosphor Icons

```tsx
import { IconName } from "@phosphor-icons/react";
```

### Weights
- `thin` — Decorative
- `light` — Secondary actions
- `regular` — Default, most UI
- `bold` — Emphasis
- `fill` — Active states, CTAs

### Sizes
- 16px — Inline with text
- 20px — Standard UI icons
- 24px — Navigation, prominent actions
- 32px — Feature icons
- 48px — Hero icons

### Usage Rules
1. **One weight per context** — Don't mix weights in same UI area
2. **Color match** — Icons inherit text color or use accent
3. **Optical alignment** — Some icons need slight offset

---

## 14. Layout Patterns

### Container
- Max width: 1280px
- Padding: 16px (mobile), 24px (tablet), 32px (desktop)
- Centered with `mx-auto`

### Grid
- Gap: 16-24px
- Columns: 1 (mobile), 2 (tablet), 3-4 (desktop)

### Hero Section
```tsx
<div className="relative min-h-screen bg-bg-base">
  <GradientMesh colors={["purple", "blue", "pink"]} intensity="medium" animate />
  <div className="relative z-10 flex flex-col items-center justify-center px-4 py-24 text-center">
    {/* Content */}
  </div>
</div>
```

### Feature Grid
```tsx
<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
  <GlassCard color="purple" glow tinted hover="lift">...</GlassCard>
  <GlassCard color="blue" glow tinted hover="lift">...</GlassCard>
  <GlassCard color="pink" glow tinted hover="lift">...</GlassCard>
</div>
```

---

## 15. Composition Reference

### Window Mockup
```tsx
<GlassPanel blur="lg" borderGlow className="overflow-hidden">
  <div className="flex items-center gap-4 border-b border-white/5 px-4 py-3">
    <TrafficLights size="sm" />
    <span className="text-sm text-text-secondary">Window Title</span>
  </div>
  <div className="p-6">
    {/* Content */}
  </div>
</GlassPanel>
```

### Stats Card
```tsx
<GlassCard color="cyan" tinted padding="sm">
  <p className="text-xs text-text-secondary">Label</p>
  <p className="text-2xl font-bold text-text-primary">Value</p>
  <p className="text-xs" style={{ color: colorMap.cyan }}>+Change</p>
</GlassCard>
```

### Filter Pill Group
```tsx
<div className="flex flex-wrap gap-2">
  <GlassPill color="purple" active onClick={...}>All</GlassPill>
  <GlassPill color="neutral" onClick={...}>Filter 1</GlassPill>
  <GlassPill color="neutral" onClick={...}>Filter 2</GlassPill>
</div>
```

---

## 16. Do's and Don'ts

### Do
- Use ONE accent color per feature/section
- Maintain consistent spacing (4px base unit)
- Test glass effects on Safari
- Respect reduced-motion preferences
- Use semantic color mapping (purple = AI, blue = data, etc.)

### Don't
- Stack more than 3 glass layers
- Use heavy blur on mobile (>8px)
- Mix Funnel Display in body text
- Use random colors without semantic meaning
- Forget focus states for accessibility

---

## 17. File Structure

```
src/
├── components/
│   ├── primitives/          # Design system building blocks
│   │   ├── GlassPanel.tsx
│   │   ├── GlassCard.tsx
│   │   ├── GlassPill.tsx
│   │   ├── GradientGlow.tsx
│   │   ├── GradientMesh.tsx
│   │   ├── TrafficLights.tsx
│   │   └── index.ts
│   ├── ui/                  # Generic UI components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   └── ...
│   ├── layout/              # Layout components
│   │   ├── Container.tsx
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   └── motion/              # Animation wrappers
│       ├── FadeIn.tsx
│       └── SlideUp.tsx
├── app/
│   └── globals.css          # Design tokens in @theme
```

---

## 18. Generating New UI

When using v0 or Claude to generate UI:

1. **Provide this file** as context
2. **Screenshot relevant showcase section** as visual reference
3. **Specify primitive names** explicitly:
   ```
   "Use GlassCard with color='purple', glow, tinted, hover='lift'"
   ```
4. **Reference color semantics**:
   ```
   "This is an AI feature, so use purple gradient"
   ```
5. **Specify composition patterns**:
   ```
   "Follow the Stats Dashboard pattern from showcase"
   ```

---

*This brand bible is the single source of truth for Virtuna's visual identity. Reference it before creating any new UI.*
