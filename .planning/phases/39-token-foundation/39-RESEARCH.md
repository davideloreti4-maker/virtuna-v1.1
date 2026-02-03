# Phase 39: Token Foundation - Research

**Researched:** 2026-02-03
**Domain:** Design tokens, CSS variables, Tailwind CSS v4, WCAG accessibility, color science
**Confidence:** HIGH

## Summary

This research investigates how to implement a comprehensive design token system for Virtuna v2.0, extracting values from raycast.com and implementing a two-tier token architecture (primitive + semantic) in Tailwind CSS v4. The phase covers 57 requirements across extraction, colors, typography, spacing, shadows, borders, animation, breakpoints, gradients, and architecture.

The key challenges are:
1. **Extraction without API access** - Raycast doesn't expose a public design system, so values must be extracted via browser DevTools inspection
2. **WCAG-compliant coral scale** - Generating a coral (100-900) scale where all text/background combinations pass WCAG AA (4.5:1 contrast)
3. **Two-tier architecture** - Structuring tokens as primitives (raw values) that feed semantic tokens (contextual usage)

**Primary recommendation:** Use browser DevTools to extract Raycast's design values systematically, generate the coral scale using OKLCH color space for perceptual uniformity with tools like the Tailwind Color Scale Generator, and implement tokens via Tailwind v4's `@theme` directive with clear primitive/semantic layering.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tailwindcss | ^4 | CSS framework with @theme tokens | CSS-first configuration via @theme directive |
| @tailwindcss/postcss | ^4 | PostCSS integration | Required for Tailwind v4 processing |

### Supporting Tools
| Tool | Purpose | When to Use |
|------|---------|-------------|
| Browser DevTools | Extract computed styles | Inspecting raycast.com CSS values |
| [Tailwind Color Scale Generator](https://66colorful.com/tools/tailwind-scale-generator) | OKLCH color scale generation | Creating perceptually uniform coral 100-900 scale |
| [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) | WCAG verification | Validating all color combinations for 4.5:1 ratio |
| [oklch.org](https://oklch.org) | OKLCH color picker | Fine-tuning individual color values |
| [easings.net](https://easings.net/) | Easing function reference | Defining animation timing tokens |

### No Additional Dependencies Required

The existing project setup has everything needed. No new packages required for token implementation.

## Architecture Patterns

### Recommended Token Structure in globals.css

```css
@import "tailwindcss";

@theme {
  /* ============================================
   * PRIMITIVE TOKENS (Layer 1)
   * Raw values - never used directly in components
   * ============================================ */

  /* --- Primitive Colors --- */
  --color-primitive-coral-100: oklch(0.97 0.02 30);
  --color-primitive-coral-200: oklch(0.93 0.05 30);
  --color-primitive-coral-300: oklch(0.87 0.09 30);
  --color-primitive-coral-400: oklch(0.78 0.14 30);
  --color-primitive-coral-500: oklch(0.68 0.18 30);  /* Base coral #FF7F50 */
  --color-primitive-coral-600: oklch(0.58 0.16 30);
  --color-primitive-coral-700: oklch(0.48 0.14 30);
  --color-primitive-coral-800: oklch(0.38 0.11 30);
  --color-primitive-coral-900: oklch(0.28 0.08 30);

  --color-primitive-gray-50: oklch(0.98 0 0);
  --color-primitive-gray-100: oklch(0.96 0 0);
  /* ... full gray scale ... */
  --color-primitive-gray-950: oklch(0.13 0.02 264);

  /* --- Primitive Spacing (8px base) --- */
  --spacing-primitive-1: 4px;
  --spacing-primitive-2: 8px;
  --spacing-primitive-3: 12px;
  --spacing-primitive-4: 16px;
  --spacing-primitive-6: 24px;
  --spacing-primitive-8: 32px;
  --spacing-primitive-12: 48px;
  --spacing-primitive-16: 64px;
  --spacing-primitive-24: 96px;

  /* ============================================
   * SEMANTIC TOKENS (Layer 2)
   * Contextual usage - used in components
   * Reference primitives via var()
   * ============================================ */

  /* --- Semantic Backgrounds --- */
  --color-bg-base: var(--color-primitive-gray-950);
  --color-surface: oklch(0.18 0.02 264);
  --color-surface-elevated: oklch(0.23 0.02 264);

  /* --- Semantic Text --- */
  --color-text-primary: var(--color-primitive-gray-50);
  --color-text-secondary: oklch(0.70 0 0);
  --color-text-tertiary: oklch(0.50 0 0);

  /* --- Semantic Accent --- */
  --color-accent: var(--color-primitive-coral-500);
  --color-accent-hover: var(--color-primitive-coral-400);
  --color-accent-active: var(--color-primitive-coral-600);

  /* --- Semantic Spacing --- */
  --spacing-component-padding: var(--spacing-primitive-4);
  --spacing-card-padding: var(--spacing-primitive-6);
  --spacing-section-gap: var(--spacing-primitive-12);
}
```

### Pattern 1: Two-Tier Token Architecture
**What:** Primitives define raw values; semantics reference primitives for contextual usage
**When to use:** All token categories (colors, spacing, typography, etc.)
**Why:** Enables theme switching, maintains consistency, prevents magic numbers
**Source:** [Martin Fowler - Design Token-Based UI Architecture](https://martinfowler.com/articles/design-token-based-ui-architecture.html)

```
Primitive Layer:          Semantic Layer:           Component Usage:
--color-coral-500  -->    --color-accent      -->   bg-accent (Tailwind utility)
--spacing-4        -->    --spacing-card      -->   p-card (custom utility)
```

### Pattern 2: Tailwind v4 @theme Token Definition
**What:** CSS-first token configuration using @theme directive
**When to use:** All custom design tokens
**Example:**
```css
/* Source: https://tailwindcss.com/docs/theme */
@theme {
  --color-regal-blue: #243c5a;
  --breakpoint-3xl: 120rem;
  --ease-fluid: cubic-bezier(0.3, 0, 0, 1);
  --animate-wiggle: wiggle 1s ease-in-out infinite;

  @keyframes wiggle {
    0%, 100% { transform: rotate(-3deg); }
    50% { transform: rotate(3deg); }
  }
}
```

### Pattern 3: OKLCH for Perceptual Color Uniformity
**What:** Use OKLCH color space for perceptually uniform color scales
**When to use:** Generating color palettes (especially coral scale 100-900)
**Why:** Equal OKLCH lightness changes = equal visual differences across all hues
**Source:** [oklch.org](https://oklch.org), [66colorful.com](https://66colorful.com/tools/tailwind-scale-generator)

```css
/* OKLCH format: oklch(lightness chroma hue) */
--color-coral-500: oklch(0.68 0.18 30);  /* L=68%, C=0.18, H=30deg */
```

### Pattern 4: Layered Shadow System
**What:** Multiple box-shadows stacked for realistic depth
**When to use:** Elevation system (sm, md, lg, elevated, float)
**Source:** [Josh W. Comeau - Designing Shadows](https://www.joshwcomeau.com/css/designing-shadows/)

```css
/* Doubling pattern: each layer doubles offset/blur, decreases opacity */
--shadow-lg:
  1px 2px 2px hsl(var(--shadow-color) / 0.2),
  2px 4px 4px hsl(var(--shadow-color) / 0.2),
  4px 8px 8px hsl(var(--shadow-color) / 0.2),
  8px 16px 16px hsl(var(--shadow-color) / 0.2),
  16px 32px 32px hsl(var(--shadow-color) / 0.2);
```

### Anti-Patterns to Avoid
- **Mixing primitive and semantic usage:** Never use `--color-primitive-*` directly in components
- **Hardcoded values in components:** All values must come from tokens
- **Skipping the primitive layer:** Going straight to semantics loses flexibility
- **Using HSL for color scales:** HSL is not perceptually uniform; use OKLCH instead
- **tailwind.config.js in v4:** Use @theme directive, not JavaScript config

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Color scale generation | Manual RGB/HSL calculations | [Tailwind Color Scale Generator](https://66colorful.com/tools/tailwind-scale-generator) | Ensures perceptual uniformity, handles gamut mapping |
| Contrast checking | Visual estimation | [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) | Precise WCAG compliance verification |
| Easing functions | Guessing cubic-bezier values | [easings.net](https://easings.net/) | Battle-tested timing functions |
| Color format conversion | Manual math | [oklch.org](https://oklch.org) | Accurate OKLCH <-> hex/rgb conversion |

**Key insight:** Color science is complex. OKLCH color space handles perceptual uniformity mathematically. Use existing tools rather than approximating by eye.

## Common Pitfalls

### Pitfall 1: Coral Scale Fails WCAG AA
**What goes wrong:** Generated coral scale has colors that fail 4.5:1 contrast on white/black backgrounds
**Why it happens:** Linear lightness progression doesn't account for accessibility needs
**How to avoid:**
- Use OKLCH with specific lightness targets
- Test EVERY combination: coral-100 through 900 on both white and dark backgrounds
- Darken coral-600+ specifically for text on light backgrounds
**Warning signs:** Contrast checker showing ratios below 4.5:1

### Pitfall 2: Token Naming Inconsistency
**What goes wrong:** Tokens named inconsistently (`--bg-base` vs `--color-background` vs `--background`)
**Why it happens:** No established convention before starting
**How to avoid:** Define naming convention upfront:
```
--color-{category}-{variant}: colors
--spacing-{purpose}: spacing
--font-{property}: typography
--shadow-{size}: shadows
--radius-{size}: border radius
--ease-{type}: easing
--animate-{name}: animations
--breakpoint-{name}: breakpoints
--z-{layer}: z-index
```
**Warning signs:** Searching for tokens becomes guesswork

### Pitfall 3: Tailwind v4 Breakpoint Variable Limitation
**What goes wrong:** Trying to use `var()` in breakpoint definitions
**Why it happens:** CSS variables are not supported in `--breakpoint-*` definitions
**How to avoid:** Define breakpoints with literal values only
```css
/* CORRECT */
--breakpoint-md: 768px;

/* WRONG - will not work */
--breakpoint-md: var(--bp-tablet);
```
**Warning signs:** Breakpoint utilities not generating
**Source:** [Tailwind CSS GitHub Discussion #15113](https://github.com/tailwindlabs/tailwindcss/discussions/15113)

### Pitfall 4: Safari Backdrop-Filter Bug
**What goes wrong:** Glass effects don't render in Safari
**Why it happens:** Safari requires `-webkit-backdrop-filter` with hardcoded values, not CSS variables
**How to avoid:** Always include webkit prefix with literal values
```css
.glass {
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px); /* Safari - use literal, not var() */
}
```
**Warning signs:** Glass appears solid/opaque in Safari

### Pitfall 5: Z-Index Collision
**What goes wrong:** Modals appear behind dropdowns, toasts hidden by headers
**Why it happens:** Ad-hoc z-index values without systematic scale
**How to avoid:** Define z-index scale with clear layer hierarchy:
```css
--z-base: 0;
--z-dropdown: 100;
--z-sticky: 200;
--z-modal-backdrop: 300;
--z-modal: 400;
--z-toast: 500;
--z-tooltip: 600;
```
**Warning signs:** Stacking order bugs, `z-index: 9999` appearing in code

### Pitfall 6: Missing Raycast Value Documentation
**What goes wrong:** Extracted values can't be traced back to source
**Why it happens:** Extraction done without recording where each value came from
**How to avoid:** Document source for every extracted value:
```css
/* Source: raycast.com homepage hero section, computed styles */
--color-bg-base: oklch(0.13 0.02 264);

/* Source: raycast.com/extensions card component, hover state */
--color-surface-hover: oklch(0.21 0.02 264);
```
**Warning signs:** Unable to verify tokens against reference later

## Code Examples

Verified patterns from official sources:

### Complete Token Section Structure
```css
/* Source: https://tailwindcss.com/docs/theme */
@import "tailwindcss";

@theme {
  /* ===========================================
   * COLORS - Primitive Layer
   * =========================================== */

  /* Coral scale (brand color, replaces Raycast purple) */
  --color-coral-100: oklch(0.97 0.02 30);
  --color-coral-200: oklch(0.93 0.05 30);
  --color-coral-300: oklch(0.87 0.09 30);
  --color-coral-400: oklch(0.78 0.14 30);
  --color-coral-500: oklch(0.68 0.18 30);
  --color-coral-600: oklch(0.58 0.16 30);
  --color-coral-700: oklch(0.48 0.14 30);
  --color-coral-800: oklch(0.38 0.11 30);
  --color-coral-900: oklch(0.28 0.08 30);

  /* ===========================================
   * COLORS - Semantic Layer
   * =========================================== */

  /* Backgrounds */
  --color-background: oklch(0.13 0.02 264);
  --color-background-elevated: oklch(0.18 0.02 264);
  --color-surface: oklch(0.23 0.02 264);

  /* Text */
  --color-foreground: oklch(0.98 0 0);
  --color-foreground-secondary: oklch(0.70 0 0);
  --color-foreground-muted: oklch(0.50 0 0);

  /* Accent (uses coral) */
  --color-accent: var(--color-coral-500);
  --color-accent-foreground: oklch(0.98 0 0);

  /* Semantic colors */
  --color-success: oklch(0.68 0.17 145);
  --color-warning: oklch(0.75 0.15 85);
  --color-error: oklch(0.60 0.20 25);
  --color-info: oklch(0.62 0.19 250);

  /* State colors */
  --color-hover: oklch(1 0 0 / 0.05);
  --color-active: oklch(1 0 0 / 0.1);
  --color-disabled: oklch(0.50 0 0 / 0.5);

  /* Border */
  --color-border: oklch(1 0 0 / 0.1);
  --color-border-hover: oklch(1 0 0 / 0.15);

  /* ===========================================
   * TYPOGRAPHY
   * =========================================== */

  /* Font families */
  --font-display: var(--font-funnel-display), sans-serif;
  --font-sans: var(--font-satoshi), ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, monospace;

  /* Font sizes */
  --text-xs: 12px;
  --text-sm: 14px;
  --text-base: 16px;
  --text-lg: 18px;
  --text-xl: 20px;
  --text-2xl: 24px;
  --text-3xl: 30px;
  --text-4xl: 36px;
  --text-5xl: 48px;
  --text-hero: 52px;

  /* Font weights */
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Line heights */
  --leading-none: 1;
  --leading-tight: 1.2;
  --leading-snug: 1.4;
  --leading-normal: 1.6;
  --leading-relaxed: 1.8;

  /* Letter spacing */
  --tracking-tight: -0.02em;
  --tracking-normal: 0;
  --tracking-wide: 0.02em;

  /* ===========================================
   * SPACING (8px base unit)
   * =========================================== */

  --spacing-0: 0;
  --spacing-1: 4px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-5: 20px;
  --spacing-6: 24px;
  --spacing-8: 32px;
  --spacing-10: 40px;
  --spacing-12: 48px;
  --spacing-16: 64px;
  --spacing-20: 80px;
  --spacing-24: 96px;

  /* Component-specific spacing */
  --spacing-button-padding-x: var(--spacing-4);
  --spacing-button-padding-y: var(--spacing-2);
  --spacing-card-padding: var(--spacing-6);
  --spacing-section-gap: var(--spacing-12);

  /* ===========================================
   * SHADOWS
   * =========================================== */

  --shadow-sm: 0 1px 2px oklch(0 0 0 / 0.2);
  --shadow-md:
    0 4px 6px oklch(0 0 0 / 0.15),
    0 2px 4px oklch(0 0 0 / 0.1);
  --shadow-lg:
    0 10px 15px oklch(0 0 0 / 0.15),
    0 4px 6px oklch(0 0 0 / 0.1);
  --shadow-xl:
    0 20px 25px oklch(0 0 0 / 0.15),
    0 10px 10px oklch(0 0 0 / 0.1),
    0 0 0 1px oklch(1 0 0 / 0.05);
  --shadow-glass:
    0 8px 32px oklch(0 0 0 / 0.2),
    inset 0 1px 0 oklch(1 0 0 / 0.1);
  --shadow-glow-accent: 0 0 20px oklch(0.68 0.18 30 / 0.3);

  /* ===========================================
   * BORDER RADIUS
   * =========================================== */

  --radius-none: 0;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;
  --radius-full: 9999px;

  /* ===========================================
   * BORDER WIDTH
   * =========================================== */

  --border-0: 0px;
  --border-1: 1px;
  --border-2: 2px;
  --border-4: 4px;

  /* ===========================================
   * ANIMATION
   * =========================================== */

  /* Durations */
  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;

  /* Easing functions */
  --ease-out-cubic: cubic-bezier(0.215, 0.61, 0.355, 1);
  --ease-out-quart: cubic-bezier(0.165, 0.84, 0.44, 1);
  --ease-in-out: cubic-bezier(0.42, 0, 0.58, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  /* Z-index scale */
  --z-base: 0;
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-modal-backdrop: 300;
  --z-modal: 400;
  --z-toast: 500;
  --z-tooltip: 600;

  /* ===========================================
   * BREAKPOINTS
   * =========================================== */

  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: 1536px;

  /* ===========================================
   * GRADIENTS
   * =========================================== */

  --gradient-coral: linear-gradient(
    135deg,
    var(--color-coral-400) 0%,
    var(--color-coral-500) 50%,
    var(--color-coral-600) 100%
  );

  --gradient-card-bg: linear-gradient(
    180deg,
    oklch(0.20 0.02 264) 0%,
    oklch(0.16 0.02 264) 100%
  );

  --gradient-overlay: linear-gradient(
    180deg,
    oklch(0 0 0 / 0) 0%,
    oklch(0 0 0 / 0.8) 100%
  );
}
```

### TypeScript Token Types
```typescript
// src/types/design-tokens.ts

/** Primitive color scale (100-900) */
export type ColorScale = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

/** Semantic color tokens */
export type SemanticColor =
  | 'background'
  | 'background-elevated'
  | 'surface'
  | 'foreground'
  | 'foreground-secondary'
  | 'foreground-muted'
  | 'accent'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'border';

/** Spacing scale values */
export type SpacingToken =
  | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20 | 24;

/** Shadow elevation tokens */
export type ShadowToken = 'sm' | 'md' | 'lg' | 'xl' | 'glass' | 'glow-accent';

/** Border radius tokens */
export type RadiusToken = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

/** Animation duration tokens */
export type DurationToken = 'fast' | 'normal' | 'slow';

/** Easing function tokens */
export type EaseToken = 'out-cubic' | 'out-quart' | 'in-out' | 'spring';

/** Z-index layer tokens */
export type ZIndexToken = 'base' | 'dropdown' | 'sticky' | 'modal-backdrop' | 'modal' | 'toast' | 'tooltip';

/** Breakpoint tokens */
export type BreakpointToken = 'sm' | 'md' | 'lg' | 'xl' | '2xl';
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tailwind.config.js theme | @theme directive in CSS | Tailwind v4 (2025) | CSS-first configuration |
| HSL/RGB for color scales | OKLCH color space | 2024-2025 | Perceptually uniform scales |
| Single box-shadow | Layered shadow stacks | 2023+ | More realistic elevation |
| CSS-in-JS tokens | CSS custom properties | 2024+ | Better performance, native cascade |
| `@tailwind` directives | `@import "tailwindcss"` | Tailwind v4 | Single import |

**Deprecated/outdated:**
- `tailwind.config.ts` for theme - Use `@theme` in CSS for v4 projects
- HSL for color generation - Use OKLCH for perceptual uniformity
- `bg-opacity-*` utilities - Use opacity modifier syntax (`bg-black/50`)
- `shadow-sm` naming - Renamed to `shadow-xs` in v4

## Open Questions

Things that require runtime investigation:

1. **Raycast's Exact Font Stack**
   - What we know: Likely Inter or a custom variant
   - What's unclear: Exact font-family, weights used, fallback stack
   - Recommendation: Inspect raycast.com with DevTools, document exact computed font-family
   - Resolution: EXT-11 task to identify exact font

2. **Raycast's Animation Timings**
   - What we know: General "fast" feel, smooth easings
   - What's unclear: Specific ms durations per interaction type
   - Recommendation: Use DevTools Animation panel to capture exact durations
   - Resolution: EXT-06, EXT-13 tasks to extract

3. **Coral Accessibility at Extremes**
   - What we know: Mid-range coral works on dark backgrounds
   - What's unclear: Which coral steps work as TEXT on white backgrounds
   - Recommendation: Generate scale, test all combinations, document safe pairs
   - Resolution: COL-02, COL-03 tasks to verify

## Sources

### Primary (HIGH confidence)
- [Tailwind CSS v4 Theme Docs](https://tailwindcss.com/docs/theme) - @theme directive, token definition
- [Tailwind CSS v4 Upgrade Guide](https://tailwindcss.com/docs/upgrade-guide) - Breaking changes, migration
- [Martin Fowler - Design Token Architecture](https://martinfowler.com/articles/design-token-based-ui-architecture.html) - Two/three-tier token systems
- [Josh W. Comeau - Designing Shadows](https://www.joshwcomeau.com/css/designing-shadows/) - Layered shadow technique
- [W3C WCAG Contrast Requirements](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html) - 4.5:1 AA standard

### Secondary (MEDIUM confidence)
- [Tailwind Color Scale Generator](https://66colorful.com/tools/tailwind-scale-generator) - OKLCH scale generation method
- [InclusiveColors](https://www.inclusivecolors.com/) - Accessible palette methodology
- [oklch.org](https://oklch.org) - OKLCH color space documentation
- [easings.net](https://easings.net/) - Easing function reference
- [U.S. Web Design System - Z-index Tokens](https://designsystem.digital.gov/design-tokens/z-index/) - Z-index scale patterns

### Tertiary (LOW confidence)
- WebSearch results on Raycast design - No official design system docs found
- Browser DevTools inspection of raycast.com - Primary extraction method (manual)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Tailwind v4 @theme is well-documented
- Architecture (two-tier tokens): HIGH - Industry-standard pattern, multiple authoritative sources
- Color science (OKLCH): HIGH - CSS spec, multiple tools support it
- Extraction methodology: MEDIUM - No official Raycast design system, requires manual DevTools work
- Accessibility (WCAG): HIGH - W3C standard, well-documented
- Raycast-specific values: LOW - Must be extracted manually, not documented

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - Tailwind v4 stable, OKLCH mature)
