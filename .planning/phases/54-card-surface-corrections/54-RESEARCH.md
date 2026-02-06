# Phase 54: Card & Surface Corrections - Research

**Researched:** 2026-02-06
**Domain:** Component CSS corrections (cards, header, inputs) to match Raycast extraction data
**Confidence:** HIGH

## Summary

This phase corrects visual styling on three component groups -- cards, header, and inputs -- to match Raycast's extracted CSS exactly. The work is purely CSS/styling changes with no new component creation or behavioral modifications. Phase 53 (complete) established the correct token foundation; this phase applies those tokens at the component level.

The codebase has **two separate Card systems** (ui/card.tsx with Card+GlassCard, and primitives/GlassCard.tsx with a different GlassCard), a Header that uses opaque bg instead of glass, a base Input that uses `h-11` (44px) and `border-border` instead of Raycast's 42px/5% pattern, and FeatureCard borders at 10%/20% instead of the required 6%/10%.

**Primary recommendation:** Update ui/card.tsx (Card + GlassCard) with correct gradient bg, 12px radius, inset shadow, and unified hover states. Update primitives/GlassCard.tsx to remove GlassPanel/GradientGlow dependency and align to the same pattern (or merge into ui/card.tsx). Fix FeatureCard borders. Apply glass pattern to Header. Align base Input to GlassInput pattern (white/5 bg, 5% border, 42px height, 8px radius). Remove GlassInput and GlassTextarea, consolidating into base Input and a new base Textarea.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS v4 | ^4 | @theme tokens, utility classes | Already in use, all tokens defined in globals.css @theme |
| React | 19 | Component architecture | Already in use, forwardRef pattern for all components |
| `class-variance-authority` | ^0.7.1 | Component variant management | Already in use for Select, Button |
| `tailwind-merge` (via `cn()`) | ^3.4 | Conditional class merging | Already in use via `@/lib/utils` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@phosphor-icons/react` | existing | Icon library | Header mobile menu icons (already imported) |
| `lucide-react` | existing | Icon library | GlassInput uses Loader2, X from lucide |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline styles for backdrop-filter | CSS classes | Lightning CSS strips backdrop-filter from classes -- must use inline styles |
| CSS custom properties for shadows | Tailwind shadow utilities | Multi-layer shadows don't compose well with Tailwind utilities -- use `style={{ boxShadow }}` or `var(--token)` |

**Installation:**
```bash
# No new packages needed. All changes are CSS/component-level.
```

## Architecture Patterns

### Current Component Architecture (BEFORE)
```
src/components/
├── ui/
│   ├── card.tsx              # Card (gradient bg) + GlassCard (backdrop-filter) + CardHeader/Content/Footer
│   ├── input.tsx             # Input (h-11, border-border, bg-white/5) + InputField
│   ├── select.tsx            # Select (bg-surface, border-border-glass) + SearchableSelect
│   ├── extension-card.tsx    # ExtensionCard (rounded-xl, border-border-glass, bg-surface)
│   └── testimonial-card.tsx  # TestimonialCard (rounded-xl, border, bg-surface)
├── primitives/
│   ├── GlassCard.tsx         # DIFFERENT GlassCard (uses GlassPanel+GradientGlow, color/glow/tint props)
│   ├── GlassInput.tsx        # GlassInput (h-[42px], border-white/5, bg rgba(255,255,255,0.05))
│   ├── GlassTextarea.tsx     # GlassTextarea (border-white/5, bg rgba(255,255,255,0.05))
│   └── GlassPanel.tsx        # GlassPanel (colored tints, inner glow -- Phase 55 scope)
├── landing/
│   └── feature-card.tsx      # FeatureCard (border-white/10, hover:border-white/20)
└── layout/
    └── header.tsx            # Header (bg-background, no glass, border-white/10 mobile)
```

### Target Component Architecture (AFTER)
```
src/components/
├── ui/
│   ├── card.tsx              # Card (137deg gradient, 12px radius, inset shadow, hover states)
│   │                         #   + GlassCard (semantic alias OR kept for glass contexts)
│   │                         #   + CardHeader/Content/Footer (unchanged)
│   ├── input.tsx             # Input (h-[42px], bg white/5, border white/5, 8px radius) + InputField
│   ├── textarea.tsx          # NEW: Textarea (inherits Input pattern, auto-resize from GlassTextarea)
│   ├── select.tsx            # Select (updated: bg white/5, border white/5, correct height)
│   ├── extension-card.tsx    # ExtensionCard (border-border, 12px radius, unified hover)
│   └── testimonial-card.tsx  # TestimonialCard (border-border, consistent inset shadow)
├── primitives/
│   ├── GlassCard.tsx         # DEPRECATED: Re-export from ui/card.tsx or stripped down
│   ├── GlassInput.tsx        # DEPRECATED: Re-export from ui/input.tsx for backward compat
│   ├── GlassTextarea.tsx     # DEPRECATED: Re-export from ui/textarea.tsx for backward compat
│   └── GlassPanel.tsx        # UNCHANGED (Phase 55 scope)
├── landing/
│   └── feature-card.tsx      # FeatureCard (border-white/[0.06], hover:border-white/[0.1])
└── layout/
    └── header.tsx            # Header (glass-navbar pattern: gradient + blur(5px) + 6% border)
```

### Pattern 1: Unified Card Styling (Raycast Exact)
**What:** All card variants use the same base visual pattern from Raycast extraction
**When to use:** Card, GlassCard, ExtensionCard, TestimonialCard, any card-like surface
**Example:**
```tsx
// Source: 39-EXTRACTION-DATA.md -- Social Card Glass + Feature Card (Windows page)
// Raycast card pattern:
// - Background: var(--gradient-card-bg) = linear-gradient(137deg, #111214 4.87%, #0c0d0f 75.88%)
// - Border: 1px solid rgba(255,255,255,0.06) = border-border
// - Border-radius: 12px = rounded-lg (Tailwind v4 default) or rounded-[12px]
// - Box-shadow: rgba(255,255,255,0.1) 0px 1px 0px 0px inset
// - NO backdrop-filter blur on cards

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "border border-border rounded-[12px]",
        // Hover states (Raycast pattern)
        "transition-all duration-150",
        "hover:-translate-y-0.5 hover:border-border-hover hover:bg-white/[0.03]",
        className
      )}
      style={{
        background: "var(--gradient-card-bg)",
        boxShadow: "rgba(255, 255, 255, 0.1) 0px 1px 0px 0px inset",
        ...style,
      }}
      {...props}
    />
  )
);
```

### Pattern 2: Glass Navbar (Raycast Exact)
**What:** Header applies the Raycast glass navbar pattern
**When to use:** Header/navbar component
**Example:**
```tsx
// Source: 39-EXTRACTION-DATA.md -- Navbar Inner (Glassmorphism Bar)
// Raycast navbar:
// - backdrop-filter: blur(5px)
// - background: linear-gradient(137deg, rgba(17,18,20,0.75) 4.87%, rgba(12,13,15,0.9) 75.88%)
// - border: 1px solid rgba(255,255,255,0.06)
// - box-shadow: rgba(255,255,255,0.15) 0px 1px 1px 0px inset

<header
  className={cn(
    "sticky top-0 z-50 w-full",
    "border-b border-border",
    className
  )}
  style={{
    background: "var(--gradient-navbar)",
    backdropFilter: "blur(5px)",
    WebkitBackdropFilter: "blur(5px)",
    boxShadow: "rgba(255, 255, 255, 0.15) 0px 1px 1px 0px inset",
  }}
>
```

### Pattern 3: Raycast Input Styling
**What:** Base Input adopts GlassInput's Raycast-accurate styling
**When to use:** Input, Textarea, Select trigger
**Example:**
```tsx
// Source: GlassInput.tsx (already has Raycast values) + MEMORY.md
// Raycast input:
// - background: rgba(255,255,255,0.05)
// - border: 1px solid rgba(255,255,255,0.05) (5% NOT 6%)
// - border-radius: 8px (var(--rounding-normal))
// - height: 42px
// - hover: border-white/10
// - focus: ring-2 ring-accent/15 border-accent

<input
  className={cn(
    "flex h-[42px] w-full rounded-[8px] border border-white/5 px-3 text-foreground",
    "placeholder:text-foreground-muted",
    "transition-all duration-150",
    "hover:border-white/10",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-transparent)] focus:border-[var(--color-accent)]",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    error
      ? "border-[var(--color-red)] focus:ring-[var(--color-red-transparent)]"
      : "",
    className
  )}
  style={{
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  }}
/>
```

### Pattern 4: Backward-Compatible Deprecation
**What:** Deprecated components re-export from new locations
**When to use:** GlassInput, GlassTextarea, primitives/GlassCard after consolidation
**Example:**
```tsx
// File: src/components/primitives/GlassInput.tsx (after deprecation)
/**
 * @deprecated Use Input from "@/components/ui" instead.
 * This re-export exists for backward compatibility.
 */
export { Input as GlassInput } from "@/components/ui/input";
export type { InputProps as GlassInputProps } from "@/components/ui/input";
```

### Anti-Patterns to Avoid
- **Using `backdrop-filter` in CSS classes:** Lightning CSS strips it. Always use inline styles: `style={{ backdropFilter: 'blur(5px)' }}`.
- **Using `rounded-lg` without verifying pixel value:** In Tailwind v4, `rounded-lg` maps to `0.5rem` (8px). Cards need 12px. Use `rounded-[12px]` explicitly OR add a `--radius-lg: 12px` override to @theme.
- **Mixing opaque and semi-transparent backgrounds:** Cards use gradient (semi-transparent in glass contexts, opaque in card contexts). Inputs use `rgba(255,255,255,0.05)`. Don't use `bg-surface` (opaque #18191a) for inputs.
- **Changing GlassPanel in this phase:** GlassPanel changes (remove tints, fix blur) are Phase 55 scope. Only touch it if necessary for Card/Header changes.
- **Breaking the `blur` prop on GlassCard (ui/card.tsx):** The showcase page uses `<GlassCard blur="sm|md|lg">`. If removing backdrop-filter from Card, either keep GlassCard as a separate variant that retains blur, or update the showcase page.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Card hover animation | Custom JS animation | Tailwind `transition-all duration-150` + `hover:-translate-y-0.5` | CSS transforms are GPU-accelerated, simpler than JS |
| Glass backdrop blur | CSS classes (`.glass-blur-*`) | Inline `style={{ backdropFilter }}` | Lightning CSS strips backdrop-filter from classes |
| Shadow composition | Multiple shadow utilities | Single `boxShadow` inline style or CSS variable | Multi-layer shadows need precise control |
| Input consolidation | Merging props manually | Re-export pattern with type aliases | Keeps backward compatibility without code duplication |

**Key insight:** This phase is entirely CSS corrections -- no new functionality, no state management, no data flow changes. Every change maps to a specific Raycast extraction value that already exists in `39-EXTRACTION-DATA.md`.

## Common Pitfalls

### Pitfall 1: Two GlassCard Components with Same Name
**What goes wrong:** `ui/card.tsx` exports `GlassCard` AND `primitives/GlassCard.tsx` exports a different `GlassCard`. Import ambiguity causes the wrong component to be used.
**Why it happens:** The ui/ version is a simple card with blur (from card.tsx lines 107-135), while the primitives/ version is a complex wrapper using GlassPanel+GradientGlow (from GlassCard.tsx).
**How to avoid:** Map all imports before making changes:
- `ui/card.tsx` GlassCard is imported by: `showcase/data-display/page.tsx` (via `@/components/ui/card`)
- `primitives/GlassCard.tsx` is imported by: `trending/video-card.tsx` (via `@/components/primitives`)
- Both are exported from their respective `index.ts` files
- Decision: Keep ui/card.tsx GlassCard as the canonical version. Update primitives/GlassCard.tsx to either re-export from ui/card.tsx or be simplified to remove GlassPanel/GradientGlow dependencies (Phase 55 will remove those entirely).
**Warning signs:** VideoCard or showcase page rendering differently after changes.

### Pitfall 2: GlassInput Has Features Base Input Lacks
**What goes wrong:** GlassInput has `leftIcon`, `rightIcon`, `showClear`, `onClear`, `loading`, `size` variants, `error` as string (message), and `wrapperClassName`. Base Input only has `error` as boolean. Removing GlassInput breaks 2 consumers (survey-form, leave-feedback-modal) that use these extra features.
**Why it happens:** GlassInput was built as a full-featured input; base Input was kept minimal.
**How to avoid:** Merge GlassInput's feature set INTO base Input. The base Input must support all GlassInput props before GlassInput can be deprecated. Steps:
1. Add icon slots, clear button, loading, size variants to Input
2. Update Input's visual styling to match Raycast (white/5 bg, 5% border, 42px)
3. Test that survey-form and leave-feedback-modal work with the new Input
4. Create deprecation re-export in GlassInput.tsx
**Warning signs:** Build errors in survey-form.tsx or leave-feedback-modal.tsx.

### Pitfall 3: GlassTextarea Has Auto-Resize Logic
**What goes wrong:** GlassTextarea has `autoResize`, `minRows`, `maxRows` with ResizeObserver and height calculation. This must be preserved when consolidating.
**Why it happens:** Textarea auto-resize is non-trivial (ResizeObserver, height calc, scroll handling).
**How to avoid:** Create a new `ui/textarea.tsx` that inherits GlassTextarea's full feature set with Raycast-accurate styling. The auto-resize logic (lines 98-133 of GlassTextarea.tsx) should be copied verbatim.
**Warning signs:** Textareas not growing or collapsing on content change.

### Pitfall 4: Tailwind v4 `rounded-lg` Maps to 8px, Not 12px
**What goes wrong:** Card uses `rounded-lg` thinking it's 12px. In Tailwind v4 default, `rounded-lg` = `0.5rem` = 8px.
**Why it happens:** The @theme block defines `--radius-lg: 12px` but Tailwind v4's `rounded-lg` uses its own default (`--radius-lg` from Tailwind, which is 0.5rem). Custom `--radius-lg` in @theme MAY override it, depending on Tailwind v4's variable resolution.
**How to avoid:** Verify the actual rendered border-radius in browser DevTools. If `rounded-lg` doesn't map to 12px, use `rounded-[12px]` explicitly for cards. For inputs, use `rounded-[8px]` or `rounded-md`.
**Warning signs:** Cards looking too sharp or too rounded compared to Raycast reference.

### Pitfall 5: Header Glass Pattern Needs Inline Styles
**What goes wrong:** Adding `bg-gradient-navbar` or similar classes doesn't work because backdrop-filter gets stripped and gradients may not compile correctly.
**Why it happens:** Lightning CSS compilation issues with backdrop-filter and complex gradient values.
**How to avoid:** Apply the full glass pattern via inline styles:
```tsx
style={{
  background: "var(--gradient-navbar)",
  backdropFilter: "blur(5px)",
  WebkitBackdropFilter: "blur(5px)",
  boxShadow: "rgba(255, 255, 255, 0.15) 0px 1px 1px 0px inset",
}}
```
The `glass-navbar` CSS class in globals.css exists but relies on backdrop-filter in a CSS class (which may be stripped). Verify it works; if not, use inline styles.
**Warning signs:** Header appearing as solid dark instead of semi-transparent glass.

### Pitfall 6: Mobile Menu Divider Opacity Mismatch
**What goes wrong:** Mobile menu uses `border-white/10` (10% opacity) but Raycast uses 6%.
**Why it happens:** Original implementation used a higher opacity for visual contrast.
**How to avoid:** Change `border-white/10` to `border-border` (which is `rgba(255,255,255,0.06)`) in the Header's mobile menu section (header.tsx line 124).
**Warning signs:** Mobile menu divider looking too prominent.

### Pitfall 7: FeatureCard Is in landing/ Not ui/
**What goes wrong:** Developer looks for FeatureCard in `ui/` but it's in `landing/feature-card.tsx`.
**Why it happens:** FeatureCard is a landing-page-specific component, not a general UI primitive.
**How to avoid:** Update `src/components/landing/feature-card.tsx` directly. Change `border-white/10` to `border-white/[0.06]` and `hover:border-white/20` to `hover:border-white/[0.1]`.
**Warning signs:** FeatureCard borders not matching other cards.

### Pitfall 8: Browser Cache After CSS Token Changes
**What goes wrong:** Changes to @theme tokens or component styles don't appear in browser.
**Why it happens:** Multiple cache layers: `.next/` build cache, browser disk cache, `node_modules/.cache`.
**How to avoid:** After any token or component CSS change: 1) Kill dev server, 2) `rm -rf .next`, 3) Clear browser cache (Cmd+Shift+R), 4) Restart dev server.
**Warning signs:** Old borders, shadows, or backgrounds still showing despite code changes.

## Code Examples

### Card Component (Full Implementation)
```tsx
// Source: 39-EXTRACTION-DATA.md, Social Card Glass, Feature Card (Windows page)
// File: src/components/ui/card.tsx

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "border border-border rounded-[12px]",
        "transition-all duration-150",
        "hover:-translate-y-0.5 hover:border-border-hover hover:bg-white/[0.03]",
        className
      )}
      style={{
        background: "var(--gradient-card-bg)",
        boxShadow: "rgba(255, 255, 255, 0.1) 0px 1px 0px 0px inset",
        ...style,
      }}
      {...props}
    />
  )
);
```

### GlassCard in ui/card.tsx (Glass Variant)
```tsx
// Source: 39-EXTRACTION-DATA.md, Navbar Glass pattern
// Keeps blur for glass contexts (sidebar panels, overlays)
// Removes old blur-only approach, adds glass gradient + correct shadow

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, blur = "md", glow = true, style, ...props }, ref) => {
    const blurValue = blurValues[blur];
    return (
      <div
        ref={ref}
        className={cn(
          "border border-border rounded-[12px]",
          "transition-all duration-150",
          "hover:-translate-y-0.5 hover:border-border-hover hover:bg-white/[0.03]",
          className
        )}
        style={{
          background: "var(--gradient-glass)",
          backdropFilter: `blur(${blurValue})`,
          WebkitBackdropFilter: `blur(${blurValue})`,
          boxShadow: glow
            ? "rgba(255, 255, 255, 0.15) 0px 1px 1px 0px inset"
            : "rgba(255, 255, 255, 0.1) 0px 1px 0px 0px inset",
          ...style,
        }}
        {...props}
      />
    );
  }
);
```

### FeatureCard Correction
```tsx
// Source: REQUIREMENTS.md CARD-05
// File: src/components/landing/feature-card.tsx
// BEFORE: border-white/10 ... hover:border-white/20
// AFTER:
<div
  className={cn(
    "rounded-[12px] border border-white/[0.06] px-[26px] py-12",
    "transition-all duration-150",
    "hover:-translate-y-0.5 hover:border-white/[0.1] hover:bg-white/[0.03]",
    className
  )}
  style={{
    boxShadow: "rgba(255, 255, 255, 0.1) 0px 1px 0px 0px inset",
  }}
>
```

### Header Glass Pattern
```tsx
// Source: 39-EXTRACTION-DATA.md, Navbar Inner
// File: src/components/layout/header.tsx
<header
  className={cn(
    "sticky top-0 z-50 w-full border-b border-border",
    className
  )}
  style={{
    background: "var(--gradient-navbar)",
    backdropFilter: "blur(5px)",
    WebkitBackdropFilter: "blur(5px)",
    boxShadow: "rgba(255, 255, 255, 0.15) 0px 1px 1px 0px inset",
  }}
>
```

### Input Alignment
```tsx
// Source: GlassInput.tsx (already Raycast-accurate) + REQUIREMENTS INPT-01/02/03
// File: src/components/ui/input.tsx
// Key changes: h-11 -> h-[42px], border-border -> border-white/5, add bg-white/5 inline style

<input
  className={cn(
    "flex h-[42px] w-full rounded-[8px] border border-white/5 px-3 text-foreground",
    "font-sans font-medium",
    "placeholder:text-foreground-muted",
    "transition-all duration-150",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-transparent)] focus:border-[var(--color-accent)]",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    !error && "hover:border-white/10",
    error ? "border-[var(--color-red)]" : "",
    className
  )}
  style={{
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    ...style,
  }}
/>
```

### Mobile Menu Divider
```tsx
// Source: REQUIREMENTS HEAD-02
// File: src/components/layout/header.tsx line 124
// BEFORE: border-t border-white/10
// AFTER:
<div className="flex flex-col gap-4 border-t border-border px-8 py-6">
```

## Detailed File Impact Analysis

### Files Requiring Changes

| File | Requirement | Change Summary |
|------|-------------|----------------|
| `src/components/ui/card.tsx` | CARD-01,02,03,04 | Card: gradient bg, 12px radius, inset shadow, hover states. GlassCard: glass gradient, correct shadow |
| `src/components/landing/feature-card.tsx` | CARD-05 | Border 6% base, 10% hover, 12px radius, inset shadow, hover lift |
| `src/components/ui/extension-card.tsx` | CARD-03,04 | Fix border to border-border (6%), 12px radius, inset shadow, consistent hover |
| `src/components/ui/testimonial-card.tsx` | CARD-03,04 | Fix to use border-border, inset shadow consistency |
| `src/components/layout/header.tsx` | HEAD-01,02 | Glass navbar pattern (gradient + blur + border + shadow), mobile divider 6% |
| `src/components/ui/input.tsx` | INPT-01,02,03 | h-[42px], bg rgba(255,255,255,0.05), border-white/5, rounded-[8px], merge GlassInput features |
| `src/components/ui/textarea.tsx` (NEW) | INPT-01,02 | New file: consolidated Textarea with Raycast styling + auto-resize from GlassTextarea |
| `src/components/primitives/GlassInput.tsx` | INPT-01 | Deprecation re-export to ui/input.tsx |
| `src/components/primitives/GlassTextarea.tsx` | INPT-01 | Deprecation re-export to ui/textarea.tsx |
| `src/components/primitives/GlassCard.tsx` | CARD-01 | Simplify or deprecation re-export (remove GlassPanel/GradientGlow dependency) |
| `src/components/primitives/index.ts` | -- | Update exports for deprecated components |
| `src/components/ui/index.ts` | -- | Add Textarea export |

### Consumer Files Needing Import Updates

| File | Current Import | New Import |
|------|---------------|------------|
| `src/components/app/survey-form.tsx` | GlassInput, GlassTextarea from primitives | Input from ui, Textarea from ui |
| `src/components/app/leave-feedback-modal.tsx` | GlassInput, GlassTextarea from primitives | Input from ui, Textarea from ui |
| `src/components/app/create-society-modal.tsx` | GlassTextarea from primitives | Textarea from ui |
| `src/components/app/content-form.tsx` | GlassTextarea from primitives | Textarea from ui |
| `src/components/trending/video-card.tsx` | GlassCard from primitives | Card from ui (or keep primitives re-export) |

### Files NOT Changing
- `src/app/globals.css` -- Tokens already correct from Phase 53 (gradient-card-bg, border tokens)
- `src/components/primitives/GlassPanel.tsx` -- Phase 55 scope
- `src/components/primitives/GradientGlow.tsx` -- Phase 55 scope
- `src/components/primitives/GradientMesh.tsx` -- Phase 55 scope
- `src/components/ui/select.tsx` -- Select uses bg-surface which is a Phase 55 concern; its input styling is internal
- `src/components/ui/button.tsx` -- Already correct from Phase 53
- `src/components/app/sidebar.tsx` -- Already has inline gradient glass pattern

## Raycast Extraction Reference (Verified Values)

All values sourced from `39-EXTRACTION-DATA.md` (Playwright real-browser extraction, 2026-02-03).

### Card CSS (Social Card + Feature Card patterns)
```css
/* Social Card Glass (raycast.com homepage) */
background: linear-gradient(137deg, rgba(17,18,20,0.75) 4.87%, rgba(12,13,15,0.9) 75.88%);
border: 1px solid rgba(255, 255, 255, 0.06);
border-radius: 12px;
box-shadow: rgba(255, 255, 255, 0.15) 0px 1px 1px 0px inset;

/* Feature Card (raycast.com/windows) */
border-radius: 12px;
border: 1px solid rgba(255, 255, 255, 0.06);

/* Card token in globals.css (Phase 53 output) */
--gradient-card-bg: linear-gradient(137deg, #111214 4.87%, #0c0d0f 75.88%);
/* NOTE: This is the OPAQUE version. Glass version uses rgba values via --gradient-glass */
```

### Card Inset Shadow
```
/* From REQUIREMENTS + CONTEXT decision: */
Requirement CARD-04: rgba(255,255,255,0.1) 0 1px 0 0 inset
/* vs Raycast social card: rgba(255,255,255,0.15) 0px 1px 1px 0px inset */
/* Decision from CONTEXT.md: "match Raycast exactly" -- use 0.1 as specified in requirement */
```

### Navbar CSS (Raycast exact)
```css
position: fixed;       /* Raycast uses fixed; Virtuna uses sticky -- both acceptable */
backdrop-filter: blur(5px);
background: linear-gradient(137deg, rgba(17,18,20,0.75) 4.87%, rgba(12,13,15,0.9) 75.88%);
border: 1px solid rgba(255, 255, 255, 0.06);
border-radius: 16px;   /* Raycast navbar bar itself. Virtuna header is full-width, so radius=0 is correct */
box-shadow: rgba(255, 255, 255, 0.15) 0px 1px 1px 0px inset;
height: 76px;          /* Inner bar. Outer container is 92px with padding */
padding: 16px 32px;
```

### Input CSS (Raycast pattern)
```css
background-color: rgba(255, 255, 255, 0.05);  /* white/5 */
border: 1px solid rgba(255, 255, 255, 0.05);  /* 5% NOT 6% */
border-radius: 8px;                            /* var(--rounding-normal) */
height: 42px;                                  /* Raycast text input */
font-size: 14px;
font-weight: 500;
color: rgb(255, 255, 255);
/* hover: border-white/10 */
/* focus: ring-2 ring-accent + border-accent */
```

### Border Radius Reference
```
Cards: 12px (rounded-[12px])
Inputs: 8px (rounded-[8px] or rounded-md)
Navbar: 16px (Raycast floating bar) -- N/A for Virtuna full-width header
Extension cards (Raycast store): 10px (but Virtuna uses 12px per CARD-03)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Card with backdrop-filter blur | Solid 137deg gradient (no blur on cards) | Raycast extraction 2026-02-03 | Simpler, better performance |
| Card border-radius: rounded-lg (8px) | Explicit rounded-[12px] | CARD-03 requirement | Matches Raycast card radius |
| Card inset shadow 0.15/1px spread | Card inset shadow 0.1/0px spread | CARD-04 requirement | Subtler highlight |
| No card hover states | translate-y-0.5 + border-hover + bg overlay | CARD-02 requirement | Interactive feel |
| Header with opaque bg | Glass navbar pattern | HEAD-01 requirement | Matches Raycast 1:1 |
| GlassInput separate from Input | Consolidated into single Input | INPT-01/02 + CONTEXT decision | Simpler component API |
| Input height 44px (h-11) | Input height 42px (h-[42px]) | INPT-03 requirement | Matches Raycast |

**Deprecated/outdated after this phase:**
- `primitives/GlassInput.tsx` as standalone component (becomes re-export)
- `primitives/GlassTextarea.tsx` as standalone component (becomes re-export)
- `primitives/GlassCard.tsx` GlassPanel/GradientGlow dependency (simplified or re-exported)
- `blur` prop variations on ui/card.tsx GlassCard (needs decision: keep for glass contexts or remove)

## Open Questions

1. **GlassCard merge vs keep separate**
   - What we know: CONTEXT.md says "Claude's discretion." ui/card.tsx GlassCard has blur prop used in showcase. primitives/GlassCard.tsx uses GlassPanel+GradientGlow (Phase 55 deprecation targets).
   - What's unclear: Whether to merge primitives/GlassCard into ui/card.tsx GlassCard or keep them separate with primitives re-exporting.
   - Recommendation: Keep ui/card.tsx GlassCard as canonical with blur support. Simplify primitives/GlassCard.tsx to wrap ui/card.tsx Card (no GlassPanel/GradientGlow). VideoCard (only consumer) just uses it as a container with padding=none, no glow/tint features actually visible.

2. **Select component alignment scope**
   - What we know: Select uses `bg-surface` (opaque) and `border-border-glass`. Requirements don't explicitly list Select changes.
   - What's unclear: Whether Select should also get white/5 bg and 5% border in this phase.
   - Recommendation: Leave Select for Phase 55 regression. Focus on the 10 explicit requirements. Select's dropdown panel styling is secondary.

3. **White/3 hover overlay implementation**
   - What we know: CONTEXT says "Claude's discretion: pseudo-element vs direct bg change."
   - What's unclear: Whether `hover:bg-white/[0.03]` creates visual artifacts when combined with gradient backgrounds.
   - Recommendation: Use `hover:bg-white/[0.03]` directly (Tailwind utility). This adds a semi-transparent overlay on top of the gradient -- simple, no pseudo-element needed. The gradient remains visible through the 3% white overlay.

4. **Exact transition duration and easing**
   - What we know: CONTEXT says 150ms. Raycast uses `0.2s ease-in-out` for nav links, `0.1s ease-in-out` for buttons. No card-specific transition extracted.
   - What's unclear: Exact easing curve for card hover.
   - Recommendation: Use `duration-150` (150ms) with default `ease` (Tailwind default = ease). This is snappy and matches the CONTEXT decision. If it feels different from Raycast, adjust to `duration-200` in Phase 55 regression.

5. **GlassInput feature parity: size variants and error messages**
   - What we know: GlassInput has sm/md/lg sizes and error-as-string (message). Base Input has no sizes and error-as-boolean.
   - What's unclear: Whether ALL GlassInput features should be merged into Input, or just the minimum needed for consumer compatibility.
   - Recommendation: Merge all features. The full GlassInput API (sizes, icons, clear, loading, error message) is battle-tested and used in production forms. Dropping features would be a regression. But this makes the task larger -- estimate accordingly.

## Sources

### Primary (HIGH confidence)
- `39-EXTRACTION-DATA.md` -- Playwright real-browser extraction of Raycast CSS (2026-02-03). Navbar glass, social card glass, extension card borders, feature card borders, border radius scale.
- Codebase analysis -- Direct reading of card.tsx, GlassCard.tsx, extension-card.tsx, feature-card.tsx, header.tsx, input.tsx, GlassInput.tsx, GlassTextarea.tsx, testimonial-card.tsx, select.tsx, globals.css, all index.ts files, all consumer files.
- `REQUIREMENTS.md` -- CARD-01..05, HEAD-01..02, INPT-01..03 requirement definitions.
- `54-CONTEXT.md` -- User decisions on hover, gradient approach, input unification, header glass.

### Secondary (MEDIUM confidence)
- `SUMMARY.md` (research) -- Gap analysis identifying specific issues (card bg, header bg, input bg, FeatureCard borders).
- `ARCHITECTURE-DESIGN-TOKEN-EXTRACTION.md` -- Token architecture patterns (gradient tokens, inline backdrop-filter, shadow composition).
- `53-RESEARCH.md` -- Phase 53 research confirming token values are now correct.
- `MEMORY.md` -- Known issues: Lightning CSS strips backdrop-filter, oklch dark color inaccuracy, browser cache.

### Tertiary (LOW confidence)
- WebFetch of raycast.com -- Could not extract CSS from compiled Next.js site (CSS modules in separate files). All Raycast values come from 39-EXTRACTION-DATA.md instead.
- `rounded-lg` Tailwind v4 default mapping -- Need to verify in browser whether @theme `--radius-lg: 12px` overrides Tailwind's default. LOW confidence until tested.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new libraries, all changes are CSS/component-level within existing stack
- Architecture: HIGH -- Direct codebase analysis, all files read, all imports traced, consumer impact mapped
- Pitfalls: HIGH -- Based on known issues (MEMORY.md, Lightning CSS behavior), two-GlassCard ambiguity, GlassInput feature parity gap
- Raycast reference values: HIGH -- Sourced from Playwright extraction (39-EXTRACTION-DATA.md), not training data
- Tailwind v4 radius mapping: LOW -- Need browser verification

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (stable -- no library upgrades, all values from existing extraction)
