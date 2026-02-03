# Architecture Research: Design System Structure

**Domain:** Design System Organization
**Researched:** 2026-02-03
**Confidence:** HIGH

---

## Executive Summary

This research establishes the optimal architecture for organizing Virtuna's design system, including design tokens, CSS variables, Tailwind configuration, component library, and documentation. The recommendations leverage Tailwind CSS v4's CSS-first configuration with `@theme`, implement a two-tier token system (primitive + semantic), and establish clear patterns for the `/showcase` component library.

Key findings:
- Tailwind v4's `@theme` directive eliminates the need for separate `tailwind.config.ts` — tokens live in `globals.css`
- Two-tier token architecture (primitives + semantic) provides optimal balance of flexibility and maintainability
- Component showcase should follow category-based organization with consistent documentation patterns
- Current project structure is well-organized but can benefit from explicit token layering

---

## Recommended Project Structure

```
src/
├── app/
│   ├── globals.css                    # All design tokens in @theme + base styles
│   └── (marketing)/
│       └── showcase/                  # Component library showcase
│           ├── page.tsx               # Main showcase (overview + tokens)
│           ├── inputs/page.tsx        # Form inputs category
│           ├── navigation/page.tsx    # Navigation components
│           ├── feedback/page.tsx      # Feedback & overlays
│           ├── data-display/page.tsx  # Data visualization components
│           ├── layout/page.tsx        # Layout components (NEW)
│           └── utilities/page.tsx     # Utility components (NEW)
│
├── components/
│   ├── primitives/                    # Design system building blocks
│   │   ├── index.ts                   # Barrel export with types
│   │   ├── GlassPanel.tsx            # Core glass container
│   │   ├── GlassCard.tsx             # Feature card variant
│   │   ├── GlassInput.tsx            # Form input
│   │   ├── [Component].tsx           # One file per component
│   │   └── ...
│   │
│   ├── ui/                           # Generic UI (shadcn/ui style)
│   │   ├── index.ts
│   │   ├── Button.tsx
│   │   └── ...
│   │
│   ├── layout/                       # Layout components
│   │   ├── index.ts
│   │   ├── Container.tsx
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   │
│   └── motion/                       # Animation wrappers
│       ├── index.ts
│       ├── FadeIn.tsx
│       └── SlideUp.tsx
│
├── lib/
│   └── utils.ts                      # cn() and other utilities
│
└── types/
    └── design-system.ts              # Shared type definitions (NEW)
```

### Structure Rationale

1. **`globals.css` as Single Source of Truth**: Tailwind v4's `@theme` directive allows all design tokens to live in CSS, eliminating the need for a separate `tailwind.config.ts`. This is already implemented correctly.

2. **Category-Based Showcase**: The `/showcase` follows atomic design principles — grouping by function (inputs, navigation, feedback, etc.) rather than by implementation detail.

3. **Primitives vs UI Separation**:
   - `primitives/` = Virtuna design system specifics (Glass*, Gradient*, etc.)
   - `ui/` = Generic reusable components (Button, Input, Card from shadcn patterns)

4. **Barrel Exports**: Every component directory has an `index.ts` for clean imports (`from "@/components/primitives"` vs `from "@/components/primitives/GlassPanel"`).

---

## Token Organization

### Current State Analysis

The existing `globals.css` already implements Tailwind v4's `@theme` correctly with:
- Color system (background hierarchy, text colors, accents)
- Typography (font families, sizes, weights, line heights)
- Spacing scale
- Border radius
- Shadows
- Animations
- Gradients

### Recommended Token Layering

Implement a **two-tier token system** for maximum maintainability:

#### Tier 1: Primitive Tokens
Raw values that define the design vocabulary. Never used directly in components.

```css
@theme {
  /* ============================================
     PRIMITIVE TOKENS — Raw values
     Do NOT use these directly in components
     ============================================ */

  /* Color Primitives */
  --primitive-black: #07080a;
  --primitive-grey-900: oklch(0.13 0.02 264);
  --primitive-grey-800: oklch(0.18 0.02 264);
  --primitive-grey-700: oklch(0.23 0.02 264);
  --primitive-white: #f4f4f6;
  --primitive-coral-500: #E57850;
  --primitive-coral-600: #d96a42;
  --primitive-blue-500: #57c1ff;
  --primitive-red-500: #ff6161;
  --primitive-green-500: #59d499;
  --primitive-yellow-500: #ffc533;

  /* Spacing Primitives (8px base) */
  --primitive-space-1: 4px;
  --primitive-space-2: 8px;
  --primitive-space-3: 12px;
  --primitive-space-4: 16px;
  --primitive-space-6: 24px;
  --primitive-space-8: 32px;
  /* ... */
}
```

#### Tier 2: Semantic Tokens
Intent-based tokens that reference primitives. Use these in components.

```css
@theme {
  /* ============================================
     SEMANTIC TOKENS — Use these in components
     ============================================ */

  /* Background (references primitives) */
  --color-bg: var(--primitive-grey-900);
  --color-bg-100: var(--primitive-grey-800);
  --color-bg-200: var(--primitive-grey-700);

  /* Text */
  --color-fg: var(--primitive-white);
  --color-fg-muted: oklch(0.70 0 0);
  --color-fg-subtle: oklch(0.50 0 0);

  /* Accent (Brand) */
  --color-accent: var(--primitive-coral-500);
  --color-accent-hover: var(--primitive-coral-600);

  /* Semantic States */
  --color-error: var(--primitive-red-500);
  --color-warning: var(--primitive-yellow-500);
  --color-success: var(--primitive-green-500);
  --color-info: var(--primitive-blue-500);

  /* Component-specific spacing */
  --spacing-input-padding: var(--primitive-space-3);
  --spacing-card-padding: var(--primitive-space-4);
  --spacing-section-gap: var(--primitive-space-8);
}
```

### CSS Variable Naming Convention

| Pattern | Usage | Example |
|---------|-------|---------|
| `--primitive-*` | Raw values (never use directly) | `--primitive-grey-800` |
| `--color-*` | Semantic color tokens | `--color-bg`, `--color-fg-muted` |
| `--spacing-*` | Semantic spacing tokens | `--spacing-card-padding` |
| `--radius-*` | Border radius tokens | `--radius-md`, `--radius-lg` |
| `--shadow-*` | Shadow tokens | `--shadow-glass`, `--shadow-elevated` |
| `--duration-*` | Animation durations | `--duration-fast`, `--duration-normal` |
| `--ease-*` | Easing functions | `--ease-out`, `--ease-spring` |
| `--font-*` | Font family tokens | `--font-display`, `--font-sans` |
| `--text-*` | Font size tokens | `--text-h1`, `--text-body` |
| `--leading-*` | Line height tokens | `--leading-h1`, `--leading-body` |
| `--gradient-*` | Gradient definitions | `--gradient-coral`, `--gradient-card` |

### Tailwind Config Structure

With Tailwind v4, most configuration lives in `globals.css` via `@theme`. However, keep `tailwind.config.ts` for:
- Plugin configuration
- Content paths (if non-standard)
- Prefix customization

**Minimal `tailwind.config.ts`:**
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  // No theme extension needed — all in globals.css @theme
};

export default config;
```

---

## Component Library Architecture

### /showcase Structure

```
/showcase
├── page.tsx              # Overview: Design tokens + primitives demo
├── inputs/
│   └── page.tsx          # GlassInput, GlassTextarea, GlassSelect, etc.
├── navigation/
│   └── page.tsx          # GlassTabs, GlassBreadcrumbs, CommandPalette, GlassNavbar
├── feedback/
│   └── page.tsx          # GlassToast, GlassTooltip, GlassModal, GlassProgress, GlassAlert
├── data-display/
│   └── page.tsx          # Kbd, GlassBadge, GlassAvatar, GlassSkeleton
├── layout/               # NEW
│   └── page.tsx          # Container, GlassPanel, GlassCard, Divider
└── utilities/            # NEW
    └── page.tsx          # Motion components, GradientGlow, GradientMesh, TrafficLights
```

### Showcase Page Sections Pattern

Each showcase category page should follow this consistent structure:

```tsx
// /showcase/[category]/page.tsx
export default function CategoryShowcasePage() {
  return (
    <div className="min-h-screen bg-bg-base">
      <main className="py-16">
        <Container>
          {/* 1. Header with back link */}
          <FadeIn>
            <div className="mb-12">
              <Link href="/showcase">← Back to Showcase</Link>
              <h1>Category Name</h1>
              <p>Brief description of this category</p>
            </div>
          </FadeIn>

          {/* 2. Component sections */}
          <Section title="ComponentName" description="One-line description">
            {/* Props showcase grid */}
            <div className="grid gap-8 md:grid-cols-2">
              {/* Subsection: Basic */}
              <div className="space-y-4">
                <h3 className="text-[14px] font-medium text-text-tertiary">Basic</h3>
                {/* Component demo */}
              </div>

              {/* Subsection: Variants */}
              {/* Subsection: Sizes */}
              {/* Subsection: States */}
            </div>
          </Section>

          {/* 3. Repeat for each component */}

          {/* 4. Composition example (optional) */}
          <Section title="Composition Example" description="Real-world usage pattern">
            {/* Full example showing components used together */}
          </Section>
        </Container>
      </main>
      <Footer />
    </div>
  );
}
```

### Component Documentation Pattern

Each component file should include:

1. **Type exports** at the top (co-located with component)
2. **JSDoc comments** with examples
3. **Default props** clearly defined
4. **Prop interfaces** exported for external use

**Example structure:**

```tsx
// GlassPanel.tsx

/** Available tint colors for glass panels */
export type GlassTint = "neutral" | "purple" | "blue" | /* ... */;

export interface GlassPanelProps {
  children: ReactNode;
  /** Blur intensity: sm (8px), md (12px), lg (20px) */
  blur?: "sm" | "md" | "lg";
  /** Background opacity 0-1, default 0.6 */
  opacity?: number;
  // ... more props with JSDoc
}

/**
 * GlassPanel - Glassmorphism container with configurable blur.
 *
 * @example
 * // Neutral glass
 * <GlassPanel blur="md" borderGlow>Content</GlassPanel>
 *
 * @example
 * // Tinted glass (iOS 26 style)
 * <GlassPanel tint="purple" innerGlow={0.5}>Content</GlassPanel>
 */
export function GlassPanel({ /* props */ }: GlassPanelProps) {
  // implementation
}
```

### Index Barrel Export Pattern

```typescript
// primitives/index.ts

// Component exports
export { GlassPanel } from "./GlassPanel";
export { GlassCard } from "./GlassCard";
// ...

// Type exports (always named, never default)
export type { GlassPanelProps, GlassTint, RefractionLevel } from "./GlassPanel";
export type { GlassCardProps } from "./GlassCard";
// ...
```

---

## Documentation Architecture

### File Organization

```
.planning/
├── BRAND-BIBLE.md           # Design system overview (existing)
├── PROJECT.md               # Project state and milestones
├── ROADMAP.md               # Development roadmap
└── research/
    ├── ARCHITECTURE.md      # This file
    ├── FEATURES.md          # Feature inventory
    ├── STACK.md             # Technology decisions
    └── PITFALLS.md          # Common mistakes to avoid

src/
├── app/globals.css          # Design tokens (self-documenting via comments)
└── components/
    └── primitives/
        └── *.tsx            # Component files with JSDoc
```

### Documentation Hierarchy

| Document | Purpose | Audience |
|----------|---------|----------|
| `BRAND-BIBLE.md` | Complete design reference, copy-paste patterns | Developers, AI assistants |
| `globals.css` | Token definitions with inline comments | Developers |
| `/showcase` | Visual reference, interactive demos | Everyone |
| Component JSDoc | API reference, usage examples | Developers |

### Cross-Referencing Pattern

**In BRAND-BIBLE.md:**
```markdown
### GlassPanel Props
See `/showcase` for visual examples.
See `src/components/primitives/GlassPanel.tsx` for full API.
```

**In globals.css:**
```css
/* ============================================
   RAYCAST-EXTRACTED COLOR SYSTEM
   See BRAND-BIBLE.md Section 2 for usage guidelines
   ============================================ */
```

**In Component files:**
```typescript
/**
 * GlassPanel - Glassmorphism container.
 *
 * @see BRAND-BIBLE.md Section 7 for design guidelines
 * @see /showcase for visual examples
 */
```

---

## Build Order

Recommended implementation sequence based on dependencies:

### Phase 1: Token Foundation (Do First)
1. **Refactor `globals.css` with two-tier tokens**
   - Add primitive token layer
   - Refactor semantic tokens to reference primitives
   - Maintain backward compatibility with existing class names

2. **Add shared type definitions**
   - Create `src/types/design-system.ts` for shared types
   - Export color, size, variant unions

### Phase 2: Component Refinement
3. **Update component prop types**
   - Use shared types from `design-system.ts`
   - Ensure consistency across all primitives

4. **Enhance JSDoc documentation**
   - Add `@example` blocks to all components
   - Add `@see` references to BRAND-BIBLE

### Phase 3: Showcase Enhancement
5. **Add missing showcase pages**
   - `/showcase/layout` for Container, GlassPanel, GlassCard, Divider
   - `/showcase/utilities` for motion, gradients, TrafficLights

6. **Standardize showcase format**
   - Ensure all pages follow the same Section pattern
   - Add code snippets/copy buttons where useful

### Phase 4: Documentation Polish
7. **Update BRAND-BIBLE.md**
   - Add token tier explanation
   - Add cross-references to showcase pages
   - Ensure all components documented

8. **Create component index**
   - Add component list with links to showcase and source

---

## Anti-Patterns

### Organizational Mistakes to Avoid

| Anti-Pattern | Problem | Do Instead |
|--------------|---------|------------|
| **Tokens in tailwind.config.ts** | Duplicates with CSS, harder to maintain | Use `@theme` in globals.css exclusively |
| **Using primitive tokens directly** | Hard to change, no semantic meaning | Always use semantic tokens in components |
| **Magic values in components** | `p-[13px]`, `text-[#abc]` | Use design tokens or extend `@theme` |
| **Mixed token naming** | `--bg-primary` vs `--primary-bg` | Follow consistent `--category-modifier` pattern |
| **Component files without types** | Poor DX, no autocomplete | Export interfaces alongside components |
| **Showcase without states** | Incomplete documentation | Show default, hover, active, disabled, error for all components |
| **Deep nesting in primitives/** | Hard to find components | Keep flat: one file per component |
| **Hardcoded Raycast colors** | Brand inflexibility | Use semantic tokens (`--color-accent`) so coral can be swapped |

### Token Anti-Patterns

```css
/* BAD: Raw value usage */
.card {
  background: #18191a;
  padding: 16px;
}

/* GOOD: Semantic token usage */
.card {
  background: var(--color-bg-100);
  padding: var(--spacing-card-padding);
}
```

```css
/* BAD: Component token without semantic layer */
@theme {
  --button-padding: 16px;  /* Magic value */
}

/* GOOD: Component token referencing semantic token */
@theme {
  --primitive-space-4: 16px;
  --spacing-button-padding: var(--primitive-space-4);
}
```

### Showcase Anti-Patterns

```tsx
/* BAD: Inconsistent showcase structure */
<Section>
  <GlassInput placeholder="example" />
  {/* No variants, no sizes, no states */}
</Section>

/* GOOD: Complete showcase coverage */
<Section title="GlassInput" description="Text input with glass styling">
  <Subsection title="Basic">...</Subsection>
  <Subsection title="With Icons">...</Subsection>
  <Subsection title="Sizes">...</Subsection>
  <Subsection title="States">...</Subsection>
</Section>
```

---

## Sources

- [Tailwind CSS v4.0 Documentation - Theme Variables](https://tailwindcss.com/docs/theme) (HIGH confidence)
- [Tailwind CSS v4.0 Release Blog](https://tailwindcss.com/blog/tailwindcss-v4) (HIGH confidence)
- [Design Token-Based UI Architecture - Martin Fowler](https://martinfowler.com/articles/design-token-based-ui-architecture.html) (HIGH confidence)
- [Design tokens explained - Contentful](https://www.contentful.com/blog/design-token-system/) (MEDIUM confidence)
- [The Future of Design Systems is Semantic - Figma Blog](https://www.figma.com/blog/the-future-of-design-systems-is-semantic/) (MEDIUM confidence)
- [Tailwind CSS Best Practices 2025 - FrontendTools](https://www.frontendtools.tech/blog/tailwind-css-best-practices-design-system-patterns) (MEDIUM confidence)
- [Exploring Typesafe design tokens in Tailwind 4 - DEV Community](https://dev.to/wearethreebears/exploring-typesafe-design-tokens-in-tailwind-4-372d) (MEDIUM confidence)
- [Storybook for Next.js Documentation](https://storybook.js.org/docs/get-started/frameworks/nextjs) (HIGH confidence)

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Token Architecture | HIGH | Tailwind v4 official docs + established design system patterns |
| File Structure | HIGH | Based on current working project structure + industry standards |
| Showcase Organization | HIGH | Existing pattern already implemented, just needs extension |
| Build Order | HIGH | Clear dependencies identified, no circular dependencies |
| Naming Conventions | HIGH | Follows Tailwind v4 conventions and CSS custom property standards |
