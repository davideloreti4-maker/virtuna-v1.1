# Phase 53: Font & Color Foundation - Research

**Researched:** 2026-02-06
**Domain:** CSS design tokens, font loading (next/font), Tailwind v4 @theme
**Confidence:** HIGH

## Summary

This phase replaces two custom fonts (Funnel Display + Satoshi) with Inter via `next/font/google` and corrects all color tokens in `globals.css` to match Raycast's extracted values exactly. The scope is narrow but touches foundational files that ripple through the entire codebase.

The font change affects **2 layout files** (both load Satoshi + Funnel Display identically), **11 component/page files** that use `font-display`, the `globals.css` @theme block (3 font-family tokens), and the `h1, h2 { @apply font-display }` rule. The color changes are confined to `globals.css` @theme but affect every component that consumes the semantic tokens.

**Primary recommendation:** Replace font loading in both layouts with `Inter` from `next/font/google`, update all `--font-*` CSS variables to reference `--font-inter`, convert remaining oklch gray-50 through gray-300 to hex, fix `gradient-card-bg` to use Raycast's 137deg angle, change body `line-height` from 1.15 to 1.5, and add missing glass-gradient / button-secondary-shadow tokens. Remove the `font-display` Tailwind utility from all components and the `h1, h2` CSS rule.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next/font/google` | Built into Next.js 16.1.5 | Load Inter with automatic optimization | Self-hosted, no layout shift, CSS variable integration |
| Tailwind CSS v4 | ^4 (via `@tailwindcss/postcss`) | @theme token system, utility classes | Already in use, @theme block is the token source of truth |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `class-variance-authority` | ^0.7.1 | Button/component variant management | Already in use, no change needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `next/font/google` Inter | Self-hosted Inter woff2 files | Google Fonts via next/font is simpler, auto-optimizes subsets, no manual font files needed |
| Removing `--font-display` entirely | Keeping a display alias pointing to Inter | Cleaner to remove since Inter is used for everything; display alias to Inter is redundant noise |

**Installation:**
```bash
# No new packages needed. Inter is available via next/font/google (built into Next.js).
# Satoshi woff2 files in src/fonts/ can be deleted after migration.
```

## Architecture Patterns

### Current Font Architecture (BEFORE)
```
src/
├── fonts/
│   ├── Satoshi-Regular.woff2     # Local font files (TO DELETE)
│   ├── Satoshi-Medium.woff2      # Local font files (TO DELETE)
│   └── Satoshi-Bold.woff2        # Local font files (TO DELETE)
├── app/
│   ├── globals.css               # @theme: --font-display, --font-sans, --font-mono
│   ├── (app)/layout.tsx          # Loads Satoshi (local) + Funnel Display (Google)
│   └── (marketing)/layout.tsx    # Loads Satoshi (local) + Funnel Display (Google)
```

### Target Font Architecture (AFTER)
```
src/
├── app/
│   ├── globals.css               # @theme: --font-sans (Inter), --font-mono
│   ├── (app)/layout.tsx          # Loads Inter (Google) only
│   └── (marketing)/layout.tsx    # Loads Inter (Google) only
```

### Pattern 1: Inter Font Loading via next/font/google
**What:** Replace dual font loading with single Inter import
**When to use:** Both layout.tsx files
**Example:**
```typescript
// Source: Context7 - Next.js v16.1.5 font docs
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body className="min-h-screen bg-background font-sans">
        {children}
      </body>
    </html>
  );
}
```

### Pattern 2: CSS Variable Token Update
**What:** Point `--font-sans` to `--font-inter` instead of `--font-satoshi`
**When to use:** globals.css @theme block
**Example:**
```css
@theme {
  /* BEFORE */
  --font-display: var(--font-funnel-display), ui-sans-serif, system-ui, sans-serif;
  --font-sans: var(--font-satoshi), ui-sans-serif, system-ui, sans-serif;

  /* AFTER - single font, no display alias */
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, "JetBrains Mono", monospace;
}
```

### Pattern 3: oklch-to-Hex Conversion for Dark Grays
**What:** Replace oklch values for light gray tokens that compile correctly, keep hex for dark
**When to use:** Gray scale tokens gray-50 through gray-300 in @theme
**Example:**
```css
@theme {
  /* BEFORE - oklch compiles inaccurately for some shades */
  --color-gray-50: oklch(0.98 0 0);
  --color-gray-100: oklch(0.96 0 0);
  --color-gray-200: oklch(0.90 0 0);
  --color-gray-300: oklch(0.80 0 0);

  /* AFTER - exact hex for all grays */
  --color-gray-50: #f9f9f9;   /* oklch(0.98 0 0) → verified hex */
  --color-gray-100: #f2f2f2;  /* oklch(0.96 0 0) → verified hex */
  --color-gray-200: #e0e0e0;  /* oklch(0.90 0 0) → verified hex */
  --color-gray-300: #c6c6c6;  /* oklch(0.80 0 0) → verified hex */
  /* gray-400 through gray-950 already use hex */
}
```

### Anti-Patterns to Avoid
- **Keeping `--font-display` alias pointing to Inter:** Adds confusion. If there's only one font, there's no need for a `display` alias. Remove it and update all 11 files that use `font-display` class.
- **Using oklch for dark colors in @theme:** Tailwind v4's Lightning CSS compiles oklch to hex at build time. For L < 0.15, the conversion is inaccurate. Always use exact hex for dark tokens.
- **Changing `font-[350]` / `font-[450]` to standard weights without visual check:** Inter supports these intermediate weights via variable font. Funnel Display used `font-[350]` for a light-medium weight. Inter's 400 or 500 may look different -- must verify visually.
- **Forgetting to clear .next/ cache:** CSS changes in @theme are aggressively cached. Must kill dev server, clear `.next/` dir, and restart.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Font optimization/subsetting | Manual woff2 subsetting | `next/font/google` | Auto-subsets, self-hosts, generates CSS variables, prevents layout shift |
| oklch-to-hex conversion | Manual math | Browser DevTools or online converter (oklch.com) | Floating point precision matters for dark colors |
| CSS variable scoping | Custom CSS injection | Tailwind v4 `@theme` block | @theme is the canonical source, auto-generates utility classes |

**Key insight:** The entire font infrastructure is handled by `next/font/google`. No manual font file management, no @font-face rules, no preload links needed.

## Common Pitfalls

### Pitfall 1: Font Weight Mismatch (font-[350] / font-[450])
**What goes wrong:** Several components use `font-[350]` (Funnel Display light-medium) and `font-[450]` (Satoshi light-medium). Inter is a variable font that supports these weights, but the visual appearance at these weights differs from Funnel Display/Satoshi.
**Why it happens:** Different fonts have different optical weights at the same numeric value.
**How to avoid:** Replace `font-[350]` with `font-light` (300) or `font-normal` (400) based on visual match. Replace `font-[450]` with `font-normal` (400) or `font-medium` (500). Visual regression needed.
**Warning signs:** Headings looking too thin or too bold after font swap.
**Files affected:**
- `src/components/landing/hero-section.tsx` (font-[350], font-[450])
- `src/components/landing/features-section.tsx` (font-[350])
- `src/components/landing/faq-section.tsx` (font-[350])
- `src/components/landing/stats-section.tsx` (font-[350])
- `src/components/layout/footer.tsx` (font-[350])
- `src/app/(marketing)/coming-soon/page.tsx` (font-[350])

### Pitfall 2: Duplicate HTML Root Elements
**What goes wrong:** Both `(app)/layout.tsx` and `(marketing)/layout.tsx` render their own `<html>` and `<body>` elements. Each must be updated independently.
**Why it happens:** Next.js route groups each have their own root layout.
**How to avoid:** Update BOTH layout files identically. Test both route groups after changes.
**Warning signs:** Font not applying in one section (app vs marketing).

### Pitfall 3: Body line-height Ripple Effects
**What goes wrong:** Changing body `line-height` from 1.15 to 1.5 affects EVERY text element that doesn't have an explicit line-height. Spacing between elements will increase globally.
**Why it happens:** line-height inherits by default.
**How to avoid:** Set body line-height to 1.5 (matching Raycast). For headings that used leading-[1.15], add explicit `leading-tight` (1.1) or similar. The typography.tsx Heading component already sets explicit leading for sizes 1-4, but sizes 5-6 inherit.
**Warning signs:** Layouts feeling "too spacious" after change, vertical rhythm breaking.

### Pitfall 4: `h1, h2 { @apply font-display }` Rule
**What goes wrong:** After removing `--font-display`, the CSS rule `h1, h2 { @apply font-display; }` will fail to compile because `font-display` utility no longer exists.
**Why it happens:** The `font-display` utility class is auto-generated from `--font-display` in @theme. Remove the variable, the utility disappears.
**How to avoid:** Remove the `h1, h2 { @apply font-display; }` rule entirely. All headings should use Inter (font-sans) by default through inheritance. Components that explicitly set `font-display` class must be updated.
**Warning signs:** Build errors referencing unknown utility class `font-display`.

### Pitfall 5: gradient-card-bg Uses Wrong Angle
**What goes wrong:** Current `--gradient-card-bg` uses `180deg` (top-to-bottom). Raycast uses `137deg` for card gradients.
**Why it happens:** Original implementation used a different angle than the extraction data.
**How to avoid:** Update to `linear-gradient(137deg, #111214 4.87%, #0c0d0f 75.88%)` matching the exact Raycast pattern. The color stops also need updating from `#222326, #141517` to `#111214, #0c0d0f`.
**Warning signs:** Cards looking different from Raycast reference.

### Pitfall 6: Lightning CSS Strips backdrop-filter
**What goes wrong:** CSS classes with `backdrop-filter` get their values stripped during Tailwind v4 compilation.
**Why it happens:** Lightning CSS (Tailwind v4's bundler) has a known issue with backdrop-filter in CSS classes.
**How to avoid:** Already mitigated in GlassInput/GlassCard via inline styles. Do NOT move any backdrop-filter values into CSS classes during this phase.
**Warning signs:** Glass effects disappearing after CSS changes.

### Pitfall 7: Browser/Dev Cache Masking Changes
**What goes wrong:** CSS changes in @theme don't appear in browser even after save.
**Why it happens:** Multiple cache layers: .next/ build cache, browser disk cache, node_modules/.cache.
**How to avoid:** After token changes: 1) Kill dev server, 2) `rm -rf .next`, 3) Clear browser cache, 4) Restart dev server.
**Warning signs:** Old font or colors still showing despite code changes.

## Code Examples

### Font Loading - Both Layout Files
```typescript
// Source: Context7 - Next.js v16.1.5 font docs
// File: src/app/(app)/layout.tsx AND src/app/(marketing)/layout.tsx

import { Inter } from "next/font/google";
// Remove: import localFont from "next/font/local";
// Remove: import { Funnel_Display } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  // Inter is a variable font - all weights (100-900) included automatically
});

// Remove: const satoshi = localFont({...});
// Remove: const funnelDisplay = Funnel_Display({...});

// In JSX:
<html lang="en" className={`${inter.variable}`}>
  <body className="min-h-screen bg-background font-sans antialiased">
```

### globals.css @theme Font Tokens
```css
/* COMPLETE FONT TOKEN UPDATE */
@theme {
  /* --- Font Families --- */
  /* Single font: Inter for all text (matching Raycast 1:1) */
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, "JetBrains Mono", monospace;
  /* REMOVED: --font-display (no longer needed) */
}
```

### globals.css Body Styles
```css
/* BEFORE */
html, body {
  @apply bg-background text-foreground font-sans;
  overflow-x: hidden;
  line-height: 1.15;
  letter-spacing: 0.2px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

h1, h2 {
  @apply font-display;
}

/* AFTER */
html, body {
  @apply bg-background text-foreground font-sans;
  overflow-x: hidden;
  line-height: 1.5;  /* TYPO-02: Raycast uses 1.5-1.6 */
  letter-spacing: 0.2px;  /* TYPO-03: Already correct */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* REMOVED: h1, h2 { @apply font-display; } */
```

### Color Token Corrections
```css
@theme {
  /* --- Gray Scale (ALL hex, no oklch) --- */
  --color-gray-50: #f9f9f9;
  --color-gray-100: #f2f2f2;
  --color-gray-200: #e0e0e0;
  --color-gray-300: #c6c6c6;
  --color-gray-400: #9c9c9d;   /* Already hex */
  --color-gray-500: #848586;   /* Already hex */
  --color-gray-600: #58595a;   /* Already hex */
  --color-gray-700: #3a3b3d;   /* Already hex */
  --color-gray-800: #222326;   /* Already hex */
  --color-gray-900: #1a1b1e;   /* Already hex */
  --color-gray-950: #07080a;   /* Already hex */

  /* --- Card Gradient (COLR-02) --- */
  --gradient-card-bg: linear-gradient(137deg, #111214 4.87%, #0c0d0f 75.88%);
  /* WAS: linear-gradient(180deg, #222326, #141517) */

  /* --- Glass Gradient Token (COLR-06) - NEW --- */
  --gradient-glass: linear-gradient(137deg, rgba(17, 18, 20, 0.75) 4.87%, rgba(12, 13, 15, 0.9) 75.88%);
  /* NOTE: --gradient-navbar already has this value; rename or add alias */

  /* --- Input Background Token (COLR-04) - VERIFY --- */
  /* Input bg is rgba(255,255,255,0.05) - applied via inline styles in GlassInput/GlassTextarea */
  /* and via bg-surface (opaque #18191a) in ui/input.tsx */
  /* DECISION: ui/input.tsx should use rgba(255,255,255,0.05) not bg-surface */

  /* --- Button Shadow - Secondary (COLR-07) - NEW --- */
  --shadow-button-secondary: rgba(0, 0, 0, 0.5) 0px 0px 0px 1px, rgba(255, 255, 255, 0.06) 0px 1px 0px 0px inset, rgba(0, 0, 0, 0.15) 0px 1px 2px 0px;
  /* Primary --shadow-button already exists and is correct */
}
```

### Component font-display Removal (11 files)
```typescript
// PATTERN: Replace font-display with nothing (inherit font-sans)

// BEFORE (typography.tsx)
1: "text-display font-semibold leading-none tracking-tight font-display",
2: "text-5xl font-semibold leading-tight tracking-tight font-display",

// AFTER
1: "text-display font-semibold leading-none tracking-tight",
2: "text-5xl font-semibold leading-tight tracking-tight",

// BEFORE (landing components)
<h2 className="font-display text-[32px] font-[350] ...">

// AFTER
<h2 className="text-[32px] font-normal ...">
// (font-[350] replaced with font-normal or font-light based on visual match)
```

## Detailed File Impact Analysis

### Files Requiring Changes

| File | Change Type | Details |
|------|-------------|---------|
| `src/app/(app)/layout.tsx` | Font loading rewrite | Replace Satoshi+Funnel with Inter |
| `src/app/(marketing)/layout.tsx` | Font loading rewrite | Replace Satoshi+Funnel with Inter |
| `src/app/globals.css` | Token overhaul | Font vars, gray hex, gradients, line-height, h1/h2 rule |
| `src/components/ui/typography.tsx` | Remove font-display | Lines 10-11 |
| `src/components/landing/hero-section.tsx` | Remove font-display, fix font-[350]/[450] | Lines 28, 36 |
| `src/components/landing/features-section.tsx` | Remove font-display, fix font-[350] | Line 63 |
| `src/components/landing/faq-section.tsx` | Remove font-display, fix font-[350] | Line 72 |
| `src/components/landing/stats-section.tsx` | Remove font-display, fix font-[350] | Line 28 |
| `src/components/landing/feature-card.tsx` | Remove font-display, update comments | Lines 21, 40 |
| `src/components/layout/footer.tsx` | Remove font-display, fix font-[350] | Line 21 |
| `src/app/(marketing)/coming-soon/page.tsx` | Remove font-display, fix font-[350] | Line 17 |
| `src/app/(app)/trending/trending-client.tsx` | Remove font-display | Line 206 |
| `src/app/(marketing)/showcase/page.tsx` | Update font showcase docs | Lines 113-116, 549-553 |
| `src/components/landing/testimonial-quote.tsx` | Update comments (Satoshi refs) | Lines 18-20 |
| `src/components/ui/input.tsx` | Fix bg-surface to rgba input bg | Line 48 |
| `src/types/design-tokens.ts` | Remove 'display' from FontFamilyToken | Line 67 |

### Files to DELETE
| File | Reason |
|------|--------|
| `src/fonts/Satoshi-Regular.woff2` | No longer needed |
| `src/fonts/Satoshi-Medium.woff2` | No longer needed |
| `src/fonts/Satoshi-Bold.woff2` | No longer needed |

### Files NOT Changing (already correct)
- `src/components/primitives/GlassInput.tsx` - Already uses `rgba(255,255,255,0.05)` via inline style
- `src/components/primitives/GlassTextarea.tsx` - Already uses `rgba(255,255,255,0.05)` via inline style
- `src/components/ui/button.tsx` - Already has correct `shadow-button` and border patterns
- `src/components/ui/card.tsx` - Uses `var(--gradient-card-bg)` which will auto-update via token change
- `src/components/app/sidebar.tsx` - Already has inline 137deg gradient

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dual font (display+body) | Single font (Inter for all) | Raycast extraction 2026-02-05 | Simpler font loading, consistent rendering |
| oklch in @theme for all colors | Hex for all grays, oklch only for brand | Known issue since Tailwind v4 | Accurate dark color rendering |
| body line-height 1.15 | body line-height 1.5 | Raycast extraction 2026-02-05 | Better readability, matches Raycast |
| `localFont` for Satoshi | `next/font/google` for Inter | This phase | No manual font files to manage |

**Deprecated/outdated:**
- `--font-display` CSS variable: Remove entirely. No separate display font needed.
- `--font-funnel-display` CSS variable reference: Dead after Funnel Display removed.
- `--font-satoshi` CSS variable reference: Dead after Satoshi removed.
- `font-[350]` / `font-[450]` arbitrary weights: These were Funnel Display / Satoshi specific. Map to standard Inter weights.

## Open Questions

1. **Exact hex values for gray-50 through gray-300**
   - What we know: oklch(0.98 0 0), oklch(0.96 0 0), oklch(0.90 0 0), oklch(0.80 0 0) are the current oklch values
   - What's unclear: The exact hex these compile to via Lightning CSS vs browser-native oklch rendering. Need to verify the hex values against actual browser rendering.
   - Recommendation: Use a reliable oklch-to-hex converter. For achromatic colors (chroma=0), the math is straightforward: L maps to sRGB linearly. Approximate values: 0.98 -> #f9f9f9, 0.96 -> #f2f2f2, 0.90 -> #e0e0e0, 0.80 -> #c6c6c6. Verify in browser DevTools.

2. **font-[350] replacement weight for Inter**
   - What we know: Funnel Display at weight 350 gives a specific visual density. Inter at 350 will be different.
   - What's unclear: Whether `font-normal` (400) or `font-light` (300) is the better visual match.
   - Recommendation: Inter at 400 (`font-normal`) is likely the best match. Funnel Display 350 was already between light and normal. Visual verification required after implementation.

3. **Should `--font-display` alias be kept pointing to Inter?**
   - What we know: 11 files use `font-display` class. The phase says "remove Funnel Display and Satoshi."
   - What's unclear: Whether to keep `--font-display` as an alias to `--font-sans` for backward compatibility or remove it entirely.
   - Recommendation: Remove entirely. Having `--font-display` point to Inter is misleading -- it suggests a different font when there isn't one. Clean removal is better than a confusing alias.

4. **`--shadow-button-secondary` exact values from Raycast**
   - What we know: COLR-07 requires Raycast's 3-layer secondary button shadow. The current secondary button uses `bg-transparent border border-white/[0.06]` with no box-shadow.
   - What's unclear: Exact Raycast secondary button shadow values (not extracted in current data).
   - Recommendation: The current secondary button styling matches Raycast's pattern (transparent bg + border). If no shadow is used on Raycast's secondary buttons, this requirement may be about documenting the absence of shadow rather than adding one. Verify against live Raycast site.

## Sources

### Primary (HIGH confidence)
- Context7 `/vercel/next.js/v16.1.5` - Font loading via `next/font/google` with CSS variables
- Codebase analysis - Direct reading of globals.css, both layout.tsx files, all 11 font-display component files
- MEMORY.md - oklch compilation inaccuracy for dark colors, backdrop-filter stripping

### Secondary (MEDIUM confidence)
- Phase 53 requirements document - TYPO-01 through TYPO-05, COLR-01 through COLR-07
- Raycast Design Language Rules (from live CSS extraction 2026-02-06) - Body, borders, glass, cards, buttons, inputs values

### Tertiary (LOW confidence)
- oklch-to-hex conversion values for gray-50 through gray-300 - Computed, not verified against browser rendering
- `--shadow-button-secondary` values - Not extracted from Raycast, inferred from pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - next/font/google and Tailwind v4 @theme are well-documented, already in use
- Architecture: HIGH - Direct codebase analysis, exact file paths and line numbers identified
- Pitfalls: HIGH - Based on known issues (MEMORY.md), direct code reading, and prior Tailwind v4 experience
- Color tokens: MEDIUM - Gray hex conversions are computed, card gradient values from extraction data
- Button secondary shadow: LOW - Exact Raycast values not confirmed

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (stable - no library upgrades needed)
