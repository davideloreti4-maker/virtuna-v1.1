# Virtuna Design System

> Raycast-derived dark design language with coral (#FF7F50) branding.
> Complete design system reference for all components, tokens, and patterns.

---

## Design Direction

**Raycast Design Language** -- Clean, dark, minimal. No colored tinting, no glow effects. Color is used only for accents and interactive elements.

Core principles:

- **Dark-mode only** -- Every token, component, and effect is optimized for dark surfaces
- **Transparent surfaces** -- Cards use `bg-transparent`, not gradient backgrounds
- **Subtle borders** -- Universal 6% white opacity borders, hover 10%
- **Minimal shadows** -- Inset shadows at 5% opacity for depth, not drop shadows on cards
- **Performance-first** -- Inline `backdrop-filter` for Safari compatibility, no animated glow effects

> **Internal note:** This design system is derived from Raycast's design language (raycast.com) with coral (#FF7F50) replacing Raycast's red (#ff6363). The Raycast relationship is internal context only -- never reference it in public-facing content.

---

## Color Tokens

All values sourced from `src/app/globals.css` @theme block.

### Brand (Coral Scale)

| Token | Value | Usage |
|-------|-------|-------|
| `--color-coral-100` | `oklch(0.97 0.03 40)` | Subtle tinted backgrounds |
| `--color-coral-200` | `oklch(0.93 0.06 40)` | Light accent backgrounds, selected fills |
| `--color-coral-300` | `oklch(0.87 0.10 40)` | Prominent backgrounds, focus rings |
| `--color-coral-400` | `oklch(0.78 0.14 40)` | Hover state for accent buttons |
| `--color-coral-500` | `oklch(0.72 0.16 40)` | **Base brand color** (#FF7F50) |
| `--color-coral-600` | `oklch(0.60 0.14 40)` | Active/pressed state |
| `--color-coral-700` | `oklch(0.48 0.12 40)` | Dark accent backgrounds |
| `--color-coral-800` | `oklch(0.38 0.10 40)` | Very dark accent tint |
| `--color-coral-900` | `oklch(0.28 0.08 40)` | Darkest accent tint |

### Background

| Token | Value | Usage |
|-------|-------|-------|
| `--color-background` | `var(--color-gray-950)` (#07080a) | Page body background |
| `--color-background-elevated` | `var(--color-gray-900)` (#1a1b1e) | Elevated sections, sidebars |
| `--color-surface` | `#18191a` | Card surfaces, panel interiors |
| `--color-surface-elevated` | `#222326` | Elevated panels, dropdowns, popovers |

### Foreground (Text)

| Token | Value | Usage |
|-------|-------|-------|
| `--color-foreground` | `var(--color-gray-50)` (#f9f9f9) | Primary body text, headings |
| `--color-foreground-secondary` | `var(--color-gray-400)` (#9c9c9d) | Secondary labels, descriptions |
| `--color-foreground-muted` | `var(--color-gray-500)` (#848586) | Timestamps, helper text, placeholders |

### Accent

| Token | Value | Usage |
|-------|-------|-------|
| `--color-accent` | `var(--color-coral-500)` (#FF7F50) | Primary CTA, links, focus rings |
| `--color-accent-hover` | `var(--color-coral-400)` | Hover state for accent elements |
| `--color-accent-active` | `var(--color-coral-600)` | Pressed/active state |
| `--color-accent-foreground` | `#1a0f0a` | Text on accent backgrounds (dark brown, 7.2:1 contrast) |

### Borders

| Token | Value | Usage |
|-------|-------|-------|
| `--color-border` | `rgba(255,255,255,0.06)` | Default borders (inputs, cards, dividers) |
| `--color-border-hover` | `rgba(255,255,255,0.1)` | Border on hover state |
| `--color-border-glass` | `rgba(255,255,255,0.06)` | Glass component borders |
| `--color-border-subtle` | `rgba(255,255,255,0.04)` | Very subtle separators |

### States

| Token | Value | Usage |
|-------|-------|-------|
| `--color-hover` | `rgba(255,255,255,0.05)` | Background overlay on hover |
| `--color-active` | `rgba(255,255,255,0.1)` | Background overlay on press |
| `--color-disabled` | `rgba(128,128,128,0.5)` | Disabled element overlay |

### Status

| Token | Value | Usage |
|-------|-------|-------|
| `--color-success` | `oklch(0.68 0.17 145)` | Success toasts, valid input borders |
| `--color-warning` | `oklch(0.75 0.15 85)` | Warning badges, cautionary states |
| `--color-error` | `oklch(0.60 0.20 25)` | Error messages, invalid input borders |
| `--color-info` | `oklch(0.62 0.19 250)` | Informational banners, help text |

### Gray Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--color-gray-50` | `#f9f9f9` | Primary text (near-white) |
| `--color-gray-100` | `#f2f2f2` | Secondary text, bright surfaces |
| `--color-gray-200` | `#e0e0e0` | Disabled text on dark backgrounds |
| `--color-gray-300` | `#c6c6c6` | Placeholder text, dimmed labels |
| `--color-gray-400` | `#9c9c9d` | Raycast secondary text |
| `--color-gray-500` | `#848586` | Muted text (WCAG AA-boosted for contrast) |
| `--color-gray-600` | `#58595a` | Dimmed text, code comments |
| `--color-gray-700` | `#3a3b3d` | Subtle borders, separators |
| `--color-gray-800` | `#222326` | Elevated surface background |
| `--color-gray-900` | `#1a1b1e` | Elevated background |
| `--color-gray-950` | `#07080a` | Page body background |

For the complete token reference (spacing, shadows, radius, animations, gradients), see [docs/tokens.md](docs/tokens.md).

---

## Typography

| Property | Value | Notes |
|----------|-------|-------|
| Font family | **Inter** | All text via `next/font/google`. Single font for all weights. |
| Body letter-spacing | `0.2px` | Applied globally via `globals.css` body styles |
| Body line-height | `1.5` (24px at 16px base) | Applied globally |
| Rendering | Antialiased | `-webkit-font-smoothing: antialiased` |

### Font Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--font-sans` | `var(--font-inter), ui-sans-serif, system-ui, sans-serif` | All body text, headings, UI elements |
| `--font-mono` | `ui-monospace, SFMono-Regular, JetBrains Mono, monospace` | Code blocks, inline code |

### Type Scale

| Token | Size | Usage |
|-------|------|-------|
| `--text-xs` | 12px | Fine print, badges, timestamps |
| `--text-sm` | 14px | Secondary text, captions |
| `--text-base` | 16px | Default body text |
| `--text-lg` | 18px | Emphasized body |
| `--text-xl` | 20px | Section subheadings |
| `--text-2xl` | 24px | Card headings |
| `--text-3xl` | 30px | Section headings |
| `--text-4xl` | 36px | Page headings |
| `--text-5xl` | 48px | Large display |
| `--text-hero` | 52px | Hero section text |
| `--text-display` | 64px | Display-scale headings (H1) |

### Font Weights

| Token | Value | Usage |
|-------|-------|-------|
| `--font-regular` | 400 | Body text, descriptions |
| `--font-medium` | 500 | Labels, nav items |
| `--font-semibold` | 600 | Headings, button text |
| `--font-bold` | 700 | Hero headings |

---

## Spacing & Radius

### Spacing Scale (4px base unit)

Scale: 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96 (px)

| Token | Value | Usage |
|-------|-------|-------|
| `--spacing-1` | 4px | Tight gaps (icon-to-text) |
| `--spacing-2` | 8px | Compact padding (badges) |
| `--spacing-3` | 12px | Standard padding (input) |
| `--spacing-4` | 16px | Default gap/padding |
| `--spacing-6` | 24px | Generous padding |
| `--spacing-8` | 32px | Section spacing |
| `--spacing-16` | 64px | Major layout spacing |

### Radius Scale

| Token | Value | Component Usage |
|-------|-------|----------------|
| `--radius-xs` | 4px | Small inline elements |
| `--radius-sm` | 6px | Nav links, small interactive elements |
| `--radius-md` | 8px | Inputs, buttons (all sizes) |
| `--radius-lg` | 12px | Cards, GlassPanel, modals |
| `--radius-xl` | 16px | Header (floating pill) |
| `--radius-2xl` | 20px | Feature cards |
| `--radius-3xl` | 24px | Extra-large containers |
| `--radius-full` | 9999px | Pills, avatars |

---

## Surface Patterns

### Cards

- Background: `transparent` (not gradient)
- Border: `rgba(255,255,255,0.06)` (1px solid)
- Border radius: 12px
- Inset shadow: `rgba(255,255,255,0.05) 0px 1px 0px 0px inset`
- Hover: `bg-white/[0.02]` only -- no `translate-y`, no border change

### Glass (GlassPanel)

- Background: `linear-gradient(137deg, rgba(17,18,20,0.75) 4.87%, rgba(12,13,15,0.9) 75.88%)`
- Backdrop filter: `blur(5px)` (fixed, not configurable)
- Border: `rgba(255,255,255,0.06)` (1px solid)
- Border radius: 12px
- Inset shadow: `rgba(255,255,255,0.15) 0px 1px 1px 0px inset`
- Applied via inline styles to bypass Lightning CSS stripping

### Modals/Dialogs

- Background: Solid opaque dark, **NOT** glass
- Inset shadow: `rgba(255,255,255,0.1) 0 1px 0 0 inset`

### Inputs

- Background: `rgba(255,255,255,0.05)`
- Border: `rgba(255,255,255,0.05)` (1px solid)
- Border radius: 8px
- Height: 42px
- Backdrop filter: none

---

## Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px oklch(0 0 0 / 0.2)` | Subtle elevation (badges) |
| `--shadow-md` | `0 4px 6px oklch(0 0 0 / 0.15), 0 2px 4px oklch(0 0 0 / 0.1)` | Card elevation, dropdowns |
| `--shadow-lg` | `0 10px 15px oklch(0 0 0 / 0.15), 0 4px 6px oklch(0 0 0 / 0.1)` | Modal shadows |
| `--shadow-xl` | `0 20px 25px oklch(0 0 0 / 0.15), 0 10px 10px oklch(0 0 0 / 0.1), 0 0 0 1px oklch(1 0 0 / 0.05)` | Dialog overlays |
| `--shadow-glass` | `0 8px 32px oklch(0 0 0 / 0.2), inset 0 1px 0 oklch(1 0 0 / 0.1)` | Glass panels |
| `--shadow-glow-accent` | `0 0 20px oklch(0.72 0.16 40 / 0.3)` | Coral glow (focus rings) |
| `--shadow-button` | `rgba(0,0,0,0.5) 0 0 0 2px, rgba(255,255,255,0.19) 0 0 14px, rgba(0,0,0,0.2) 0 -1px 0.4px inset, rgb(255,255,255) 0 1px 0.4px inset` | Multi-layer 3D button shadow |
| `--shadow-button-secondary` | `rgba(0,0,0,0.5) 0 0 0 1px, rgba(255,255,255,0.06) 0 1px 0 inset, rgba(0,0,0,0.15) 0 1px 2px` | Secondary button shadow |

---

## Components Overview

### Primitives

| Component | Description |
|-----------|-------------|
| GlassPanel | Zero-config Raycast glass container (5px blur, 12px radius) |
| GlassPill | Small glass-effect pill tag with color variants |
| GlassInput | Glass-styled input with 42px height |
| GlassTextarea | Glass-styled textarea |
| TrafficLights | macOS-style red/yellow/green dots |

### UI Components

| Component | Description |
|-----------|-------------|
| Button | 4 variants (primary, secondary, ghost, destructive), 3 sizes |
| Card | Transparent card with 6% border and 5% inset shadow |
| GlassCard | Card with backdrop blur and frosted glass background |
| Badge | Status indicator with semantic color variants |
| Input / InputField | Input with label, helper text, error state |
| Select / SearchableSelect | Dropdown selection with keyboard navigation |
| Toggle | Switch with coral accent when checked |
| Dialog | Modal dialog with 5 sizes |
| Toast | Notification with 5 semantic variants |
| Tabs / CategoryTabs | Tab navigation with glass pill styling |
| Accordion | Expandable content panels |
| Avatar / AvatarGroup | User avatar with fallback and group stacking |
| ExtensionCard | Feature card with radial gradient themes |
| TestimonialCard | Quote card with author attribution |
| Spinner | Loading indicator (indeterminate + determinate) |
| Skeleton | Content placeholder with shimmer animation |
| Kbd / ShortcutBadge | Keyboard keycap and shortcut display |
| Heading / Text / Caption / Code | Semantic typography components |
| Divider | Horizontal/vertical separator |
| Icon | Icon wrapper with consistent sizing |

### Motion Components

FadeIn, FadeInUp, SlideUp, StaggerReveal, HoverScale, PageTransition, FrozenRouter

### Effects

NoiseTexture, ChromaticAberration

> **Removed components:** GradientGlow, GradientMesh, and primitives/GlassCard have been deleted. They are not part of the Raycast design language.

For complete API reference, see [docs/components.md](docs/components.md).
For component index with source files, see [docs/component-index.md](docs/component-index.md).

---

## Do's and Don'ts

### Do

- Use `bg-transparent` for cards (Raycast pattern)
- Use Inter for all text (single font family, all weights)
- Use inline `backdrop-filter` for glass effects (bypasses Lightning CSS stripping)
- Use semantic tokens (`--color-foreground`, not `--color-gray-50`) in components
- Use exact hex values for dark grays in @theme (not oklch -- compilation inaccuracy)
- Default Button to `secondary` variant (primary is reserved for main CTA)
- Use server components by default; add `"use client"` only for interactivity

### Don't

- Add colored glass tints or inner glow effects on glass panels
- Add `translate-y` hover effects on cards (Raycast cards do not lift)
- Use oklch for very dark colors in @theme blocks (Tailwind v4 compilation issue)
- Use multiple fonts -- Inter is the only font
- Use `GradientGlow` or `GradientMesh` -- they have been removed
- Reference the Raycast origin in any user-facing content

---

## External Library Vetting Checklist

Before committing any component from Magic UI, Aceternity UI, Origin UI,
Cult UI, or any third-party shadcn registry, ALL of the following gates
must PASS. Record pass/fail + date in the component's source file comment.

### Gate 1 — Color Audit
- [ ] No purple, violet, blue, or pink DEFAULT props bleed through to
      rendered output without being overridden
- [ ] gradientFrom / gradientTo / colorFrom / colorTo / shineColor /
      glowFrom / glowTo or equivalent color props all set to Raycast tokens
      (coral-500 for accent, gray-950/surface/surface-elevated for fills,
      transparent for neutral zones)
- [ ] No hardcoded hex values remain in tuned file that aren't Raycast tokens

### Gate 2 — Border Opacity
- [ ] Component border (if any) uses rgba(255,255,255,0.06) for resting
- [ ] Component border hover (if any) uses rgba(255,255,255,0.10)
- [ ] No 8%, 12%, or other non-standard opacities

### Gate 3 — Radius Scale
- [ ] Card-shaped containers: 12px (--radius-lg)
- [ ] Button-shaped containers: 8px (--radius-md)
- [ ] Modal-shaped containers: 12px (--radius-lg)
- [ ] Component does not introduce non-standard radii

### Gate 4 — Motion Audit
- [ ] No auto-looping high-contrast animations at duration < 6s
- [ ] No neon glow effects (colored box-shadow at high opacity on
      non-accent colors)
- [ ] No continuous scale/bounce effects that repeat without user action
- [ ] prefers-reduced-motion respected: either via motion-safe: Tailwind
      class, useReducedMotion() from motion/react, or usePrefersReducedMotion
      hook from src/hooks/usePrefersReducedMotion.ts

### Gate 5 — Font Audit
- [ ] Component source contains no embedded font-family CSS property
- [ ] No @font-face declarations
- [ ] All text inherits Inter via --font-sans (globals.css body declaration)

### Gate 6 — GlassPanel Compatibility
- [ ] Component does not declare competing backdrop-filter values in CSS
      (backdrop-filter must only be applied via React inline styles to
      bypass Lightning CSS stripping — per CLAUDE.md Known Technical Issues)
- [ ] Component composes as a child or sibling of GlassPanel without
      visual conflict (test in /showcase)

### Gate 7 — Dark-Mode-First
- [ ] Component has no `dark:` conditional logic that implies light mode
      as the default state
- [ ] If component uses useTheme(): dark theme resolves correctly on
      initial mount without flash (mounted-state guard in place)
- [ ] Component does not assume a white or light background

### Gate 8 — Bundle Size Sanity
- [ ] Component introduces no motion/animation library not already in
      package.json (motion/react is approved; framer-motion is legacy
      and not to be extended; GSAP is rejected per BRAND-BIBLE.md §4)
- [ ] Component introduces no third-party icon library beyond
      @phosphor-icons/react and lucide-react (both already installed)
- [ ] Component .tsx source is < 150 lines (if larger, split or simplify
      before commit)

### Gate 9 — Security Scan
- [ ] No fetch(), XMLHttpRequest, or navigator.sendBeacon calls
- [ ] No process.env references
- [ ] No eval(), new Function(), or dynamic imports from external URLs
- [ ] No obfuscated variable names in non-minified source

---

## Accessibility

### Contrast Requirements (WCAG 2.1 AA)

| Category | Minimum Ratio |
|----------|--------------|
| Normal text | 4.5:1 |
| Large text (24px+ or 18.66px+ bold) | 3:1 |
| UI components | 3:1 |

### Known Contrast Notes

| Token | Context | Ratio | Status |
|-------|---------|-------|--------|
| `foreground-muted` (#848586) | On background | 5.4:1 | PASS AA |
| `foreground-secondary` (#9c9c9d) | On background | 7.3:1 | PASS AAA |
| `accent-foreground` (#1a0f0a) | On accent (#FF7F50) | 7.2:1 | PASS AAA |

**Guidance:**
- Use `foreground-secondary` (#9c9c9d, 7.3:1) for important secondary text
- Use `foreground-muted` (#848586, 5.4:1) for timestamps, captions -- passes AA

For per-component accessibility requirements, see [docs/accessibility.md](docs/accessibility.md).

---

## Resources

- [Token Reference](docs/tokens.md) -- All design tokens with values and usage guidance
- [Component API](docs/components.md) -- Complete props, variants, and code examples
- [Component Index](docs/component-index.md) -- Source files, showcase pages, exports per component
- [Accessibility](docs/accessibility.md) -- WCAG AA contrast requirements per component
- [Contributing](docs/contributing.md) -- How to add components, modify tokens, extend the system
- [Design Specs](docs/design-specs.json) -- Structured token export (W3C Design Tokens-adjacent)
- [Live Showcase](/showcase) -- Interactive component demos

---



---

## Visual Metaphor Lock

> Phase 1 of the Brand Statement Landing milestone locked the paired visual language of Virtuna. This section is the source of truth for both visuals; Phase 2 implementation honors these specs verbatim.

### 1. Hero -- Behavioral Simulation Visual

**Concept (VIZ-01):** Animated audience particles reacting to a video stimulus, aggregating into a confidence score. The particles represent simulated audience reactions; their convergence into a single shape (a number, a coral pill, or a video frame -- Phase 2 picks) communicates the prediction. One-shot animation on viewport entry, NOT a loop.

**Technical implementation (VIZ-04, D-08):** Canvas 2D, ~30 KB. No third-party motion library for the particle physics.

**Why Canvas (not WebGL or SVG):**

- Direct evidence base -- `src/components/hive/HiveCanvas.tsx` proves Canvas 2D handles 1300+ nodes at 60fps in this codebase.
- WebGL is overkill for 150-300 particles + adds bundle bloat (Three.js is 600 KB+ even tree-shaken).
- SVG degrades sharply past ~100 simultaneous animated DOM nodes.

**Patterns Phase 2 reuses verbatim:**

| Pattern | File:line | What it solves |
|---------|-----------|----------------|
| DPR-aware resize | `src/components/hive/use-canvas-resize.ts:43-100` | Crisp rendering on retina + Safari fallback chain |
| RAF-driven animation with module-level "complete" flag | `src/components/hive/use-hive-animation.ts:42-49, 121-193` | Animation plays once per session, doesn't replay on remount |
| Ref-based render state (no React re-renders per frame) | `src/components/hive/HiveCanvas.tsx:54-57, 147-186` | Camera, layout, interaction in refs; `render()` reads synchronously |
| Reduced-motion early return + full-visibility constant | `src/components/hive/use-hive-animation.ts:65-69, 122-130` | Static keyframe fallback in 4 lines |
| Color batching via `Map<colorKey, circles>` | `src/components/hive/hive-renderer.ts:240-298` | Fewer fillStyle changes per frame at high node counts |
| Reduced-motion hook (reuse verbatim) | `src/hooks/usePrefersReducedMotion.ts:1-29` | Returns boolean, defaults to `true` for SSR safety |
| Easing token | `docs/tokens.md` § Easings -- `--ease-out-cubic: cubic-bezier(0.215, 0.61, 0.355, 1)` matches `easeOutCubic(t)` at `src/components/hive/use-hive-animation.ts:57` | Consistent motion language with rest of design system |

**Reference visuals (D-19):**

- Stripe homepage hero gradient -- restrained motion, premium feel: https://stripe.com
- Anthropic Claude product page -- calm, lab-credible motion: https://www.anthropic.com/claude
- Linear homepage hero -- minimal motion, structural feel: https://linear.app
- Raycast homepage hero -- ambient gradient + screenshot composition: https://raycast.com

**What Phase 1 locks (concept, per D-05, D-06, D-07):**

- Particles aggregate into a confidence-score shape on viewport entry.
- Coral accent (#FF7F50) for the converged "majority" particles; Raycast neutrals for the minority.
- One-shot animation, never a loop (matches WORKS-02 pulse-once intent).
- Reduced-motion fallback: render the static converged keyframe with the confidence number visible. No animation. (D-10)

**What Phase 2 finalizes (execution, per D-07):**

- Exact particle count (suggest target 200-400 -- matches density of `hive` viz at smaller scale).
- Easing curves (suggest `easeOutCubic` matching `src/components/hive/use-hive-animation.ts:57`).
- Convergence vector field (geometry of the aggregation).
- Initial particle distribution (uniform / normal / perlin).
- Aggregation icon / center treatment (a number / a coral pill / a video frame).

**Reference Phase 2 skeleton (illustrative, NOT Phase 1 deliverable):**

```tsx
// Source pattern: src/components/hive/HiveCanvas.tsx (proven 1300+ nodes / 60fps)
'use client';
import { useCallback, useEffect, useRef } from "react";
import { useCanvasResize } from "@/components/hive/use-canvas-resize"; // REUSE VERBATIM
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion"; // REUSE VERBATIM

let globalAnimationPlayed = false; // module-level -- same pattern as use-hive-animation.ts:42-49

export function BehavioralSimulationHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  // … RAF loop reading from sizeRef = useCanvasResize(canvasRef, render);
  // If reducedMotion || globalAnimationPlayed -> render static keyframe and return.
}
```

### 2. Pipeline -- Engine Diagram

**Concept (VIZ-02):** 4-stage horizontal diagram -- `video -> analyze -> simulate audience -> predict`. Subtle pulse motion fires once on viewport entry. Each stage has a 1-line label and an iconographic representation (icon source TBD in Phase 2 -- codebase has `@phosphor-icons/react` + `lucide-react` available).

**Technical implementation (VIZ-04, D-08, D-17):** SVG + `motion/react` (LazyMotion + `m` + `domAnimation` features), ~15 KB gzipped.

**Why SVG (not Canvas) for this visual:**

- Crisp at any DPI -- pipeline is small, label-led, structural.
- Stage labels are screen-reader accessible (Canvas 2D has no native a11y; pipeline labels are essential).
- One-shot motion fits SVG's strength -- no re-render every frame.

**Why `motion/react` (not framer-motion or plain CSS):**

- Already a project dep (`motion@^12.29.2`).
- Same API as framer-motion (which is also installed but used in legacy files); standardizing on `motion/react` reduces import inconsistency (per Pitfall 5).
- LazyMotion + `m` + `domAnimation` keeps bundle at ~15 KB instead of full 42.5 KB.
- Plain CSS keyframes considered and rejected: codebase standardized on `motion/react` for all scroll-reveal components (FadeIn, FadeInUp, SlideUp, StaggerReveal); mixing two animation paradigms increases maintenance cost.
- GSAP rejected: commercial license risk for paid plans + larger bundle than tree-shaken motion.

**Reference Phase 2 skeleton (illustrative, per RESEARCH.md Code Example 1):**

```tsx
'use client';
import { LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { useId } from "react";

const STAGES = [
  { label: "Video", icon: "video" },
  { label: "Analyze", icon: "analyze" },
  { label: "Simulate audience", icon: "audience" },
  { label: "Predict", icon: "predict" },
] as const;

export function EnginePipeline() {
  const reducedMotion = useReducedMotion();
  const titleId = useId();
  return (
    <LazyMotion strict features={domAnimation}>
      <svg role="img" aria-labelledby={titleId} viewBox="0 0 800 120" className="w-full h-auto">
        <title id={titleId}>4-stage prediction engine pipeline</title>
        {STAGES.map((stage, i) => (
          <m.g
            key={stage.label}
            initial={reducedMotion ? false : { opacity: 0.3, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: reducedMotion ? 0 : i * 0.15, ease: [0.215, 0.61, 0.355, 1] }}
          >
            {/* stage rendering */}
          </m.g>
        ))}
      </svg>
    </LazyMotion>
  );
}
```

**Reference visuals (D-19):**

- Linear Insights cycle graph -- pipeline-style with structural stages: https://linear.app/insights
- Vercel Observability product page -- section transitions with restrained motion: https://vercel.com/products/observability
- Stripe Atlas process diagrams -- clear step-by-step structural feel: https://stripe.com/atlas

**What Phase 1 locks (concept):**

- Exactly 4 stages: `video -> analyze -> simulate audience -> predict`.
- One-shot pulse on intersection-observer entry, NOT a continuous loop (matches WORKS-02).
- Reduced-motion fallback: static stages, no pulse, full visibility. (D-10)
- Stage labels are real text inside `<text>` SVG nodes for screen-reader access.

**What Phase 2 finalizes:**

- Specific icons per stage (Phosphor / Lucide picks).
- Pulse easing + duration (suggest `--ease-out-cubic` 600ms with 100-150ms stagger between stages, matching existing `StaggerReveal`).
- Connector style (line / arrow / dashed).
- Hover state on each stage (if any -- WORKS spec doesn't require).
- Mobile vertical-stack layout (per WORKS-05).

### 3. Scale Affordances (VIZ-03)

Both visuals must work at three scales: hero (desktop, full-bleed), mobile (≤640px), and future in-app embed (compact, ~400-600px wide).

| Visual | Hero (desktop) | Mobile (≤640px) | In-app embed |
|--------|----------------|-----------------|--------------|
| Hero behavioral simulation | Full-bleed canvas, 200-400 particles, ambient gradient backdrop | Reduce particle count to ~100; consider simplified static glyph if perf budget tight (per HERO-08) | 100-150 particles in card-bound area; aggregation target shrinks proportionally |
| Engine pipeline | Horizontal 4-stage diagram with icons + labels + pulse | Vertical 4-stage stack, same labels and icons, motion preserved or simplified (per WORKS-05) | Horizontal compact form, smaller icons, no labels (icon-only with tooltip) |

Reduced-motion fallback applies at all three scales: render static keyframe, no animation.

### 4. Rejected Alternatives (don't re-litigate)

| Considered | Rejected because | Reference |
|------------|------------------|-----------|
| WebGL hero | Bundle bloat (Three.js 600 KB+); no perceptual benefit at 150-400 particles | D-11 |
| GSAP for either visual | Commercial license cost on paid Business tier ($199/yr/dev) + larger than `motion/react` LazyMotion | D-11 |
| SVG for hero particles | DOM node count exceeds performant range past ~100 simultaneous particles | RESEARCH.md Pattern 2 |
| Canvas for pipeline | Stage labels need screen-reader access; Canvas has no native a11y | RESEARCH.md Pattern 2 |
| Plain CSS keyframes for pipeline | Codebase standardized on `motion/react`; mixing paradigms increases maintenance cost | RESEARCH.md Pattern 2 |
| Lottie animations | Asset-driven; doesn't fit hand-tuned canvas particle behavior; 50 KB+ even for simple animations | RESEARCH.md Pattern 2 |
| Figma frames or animated prototypes | D-05 chose written-only -- written spec + reference URLs is enough | D-05 |

### 5. Performance Budget (VIZ-04)

| Visual | Implementation | Gzipped Bundle Cost |
|--------|---------------|---------------------|
| Hero particles | Canvas 2D (no library, direct API) | ~30 KB (component code only) |
| Pipeline | SVG + `motion/react` LazyMotion + m + domAnimation | ~15 KB (motion subset, see motion.dev/docs/react-lazy-motion + motion.dev/docs/react-reduce-bundle-size) |
| **Total hero motion JS** | | **~45 KB** -- under VIZ-04 ceiling of 50 KB |

**Bundle pinning rule (per Pitfall 5):** All NEW motion code uses `motion/react` import path. The two `framer-motion` imports in `src/components/app/simulation/*.tsx` are legacy and slated for migration in a future cleanup. The vocab-lint script (Plan 04) flags new framer-motion import paths at commit time.

### 6. How Phase 2-6 use this section

- Phase 2 plan researcher: read §1 + §2 to choose particle behaviors / pipeline icons / motion easing during build prep. Read all referenced file:line landmarks before writing the hero canvas component.
- Phase 2 executor: import `motion/react` (NOT `framer-motion`), use `LazyMotion` + `m` + `domAnimation` for SVG pipeline, reuse `useCanvasResize` and `usePrefersReducedMotion` verbatim from existing hooks.
- Phase 5 quality gates: bundle audit MUST verify hero JS ≤ 45 KB gzipped (under 50 KB ceiling). Lighthouse Performance MUST stay ≥ 95.
- Phase 6 reference audit: visuals reviewed against the reference URLs in §1 and §2.

### Phase 2 implementation notes (per CLAUDE.md)

Phase 2 build of these visuals must respect:

- **Tailwind v4 oklch inaccuracy** -- coral `#FF7F50` is referenced as exact hex above; do NOT round-trip through `oklch()` for colors with L < 0.15.
- **Lightning CSS strips backdrop-filter** -- N/A for canvas particles, but if any glass surface frames either visual, apply `backdropFilter` via React inline `style={{ ... }}`, not a CSS class.
- **Dev cache hygiene** -- when Phase 2 motion changes don't render, kill dev + clear `.next/` + clear `node_modules/.cache/` + clear browser cache.

Source: `CLAUDE.md` "Known Technical Issues" section.

---

*Virtuna Design System v2.3.6 -- Brand Bible*
*Last updated: 2026-05-10*
