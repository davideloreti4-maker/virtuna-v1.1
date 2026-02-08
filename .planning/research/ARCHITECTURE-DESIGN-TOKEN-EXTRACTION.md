# Architecture: Design Token System

**Domain:** Design token alignment (Raycast 1:1)
**Researched:** 2026-02-06

## Raycast's Token Architecture (Extracted)

Raycast uses a two-layer token system in their CSS:

### Layer 1: Primitive Variables (`:root`)

Defined in a single CSS file (`5038a0f8e1dbb537.css`), these are raw values:

```
--grey-50 through --grey-900     (12 steps)
--spacing-none through --spacing-13   (17 steps)
--rounding-none through --rounding-full  (9 steps)
--Base-White, --Base-Black
--blue-dark, --red-dark
--Red-Default, --Red-Dim, --Red-Muted, --Red-Faint
--font-color-rgb, --lines-color-rgb
--main-font, --monospace-font
--container-*-width (4 sizes)
--grid-gap
```

### Layer 2: Semantic Aliases (in components)

Component CSS uses semantic variables that fall back to primitives:

```
--background: var(--grey-900)
--Card-Border: rgba(255,255,255,0.06)
--Text-Default: var(--grey-200)
--Text-Loud: var(--Base-White)
--primaryText: var(--Base-White)
--secondaryText: rgba(255,255,255,0.6)
--tertiaryText: rgba(255,255,255,0.4)
--separatorColor: rgba(255,255,255,0.1)
--controlBackground: rgba(255,255,255,0.1)
```

### Observation: Minimal Abstraction

Raycast's token system is **not heavily abstracted**. Many components use raw `rgba()` values directly rather than referencing variables. This is pragmatic: the site is dark-mode only, so there's no need for theme-switching abstractions.

## Recommended Architecture for Virtuna

### Keep Current Two-Layer Approach

Virtuna's existing `@theme` block already follows a primitive -> semantic pattern. This is correct and should be maintained.

```css
@theme {
  /* Layer 1: Primitives */
  --color-gray-950: #07080a;

  /* Layer 2: Semantic */
  --color-background: var(--color-gray-950);
}
```

### Token File Structure

**Single file: `globals.css`** -- Keep all tokens in one file. Raycast does this, and it works well for a dark-mode-only system. No need for separate token files or CSS modules for tokens.

### Component Boundaries

| Component | Token Usage Pattern |
|-----------|-------------------|
| Cards | `--gradient-card-bg` (gradient) + `--color-border` (border) + card inset shadow |
| Glass surfaces | `--gradient-navbar` (glass gradient) + inline `backdrop-filter` + `--color-border-glass` |
| Buttons (light) | `--shadow-button` + grey-50 bg |
| Buttons (dark) | `--shadow-button-dark` + gradient bg |
| Modals | `--color-background` (solid bg, NOT glass) + `--color-border` + inset shadow |
| Inputs | `rgba(255,255,255,0.05)` bg + `--color-border` |
| Text primary | `--color-foreground` |
| Text secondary | `--color-foreground-secondary` |
| Text muted | `--color-foreground-muted` |

### Alias Layer for Raycast Compatibility

The current `:root` alias block should be expanded to include all Raycast variable names used in components:

```css
:root {
  /* Existing aliases */
  --rounding-normal: 8px;
  --color-fg: var(--color-foreground);

  /* Add these */
  --Card-Border: var(--color-border);
  --Text-Default: var(--color-foreground-secondary);
  --Text-Loud: var(--color-foreground);
  --grey-900: var(--color-gray-950);
  --grey-600: #1b1c1e;
  /* etc. */
}
```

This keeps Virtuna's token naming (Tailwind-style `--color-*`) while allowing components that reference Raycast variable names to work.

## Patterns to Follow

### Pattern 1: Exact Hex for Dark Colors

**What:** Use exact hex values (not oklch) for all grey scale tokens.
**When:** Any color with lightness < 0.5 in the @theme block.
**Why:** Tailwind v4 oklch-to-hex conversion is inaccurate for dark colors.

```css
/* DO */
--color-gray-950: #07080a;
--color-gray-900: #1a1b1e;

/* DON'T */
--color-gray-950: oklch(0.085 0.01 264);
```

### Pattern 2: Inline Backdrop-Filter

**What:** Apply backdrop-filter via React inline styles, not CSS classes.
**When:** Any glass/blur effect.
**Why:** Lightning CSS strips backdrop-filter from compiled CSS.

```tsx
// DO
<div style={{ backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }}>

// DON'T rely solely on
<div className="glass-blur-sm">
```

### Pattern 3: Multi-Layer Shadows as Complete Tokens

**What:** Define complete shadow stacks as single tokens.
**When:** Button shadows, card shadows with multiple layers.
**Why:** Tailwind shadow utilities don't compose multiple layers well.

```css
--shadow-button-dark:
  inset 0 1px 0 0 rgba(255,255,255,0.05),
  0 0 0 1px rgba(255,255,255,0.25),
  inset 0 -1px 0 0 rgba(0,0,0,0.2);
```

### Pattern 4: Gradient Tokens for Card Backgrounds

**What:** Define card backgrounds as gradient tokens, not flat colors.
**When:** Card components.
**Why:** Raycast cards use a 137deg gradient, not flat surfaces.

```css
--gradient-card-bg: linear-gradient(137deg, #111214 4.87%, #0c0d0f 75.88%);
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Colored Glass Tints

**What:** Adding color tints to glass surfaces (purple glass, blue glass, etc.)
**Why bad:** Raycast glass is exclusively neutral. Colored tints make it look like iOS, not Raycast.
**Instead:** Use neutral glass only. Color comes from content and accent elements, not from surface tinting.

### Anti-Pattern 2: Separate Display Font

**What:** Using a different font for headings vs body text.
**Why bad:** Raycast uses Inter for everything. A separate display font creates visual inconsistency with the reference design.
**Instead:** Differentiate headings by weight (600-700) and size only.

### Anti-Pattern 3: Mixing oklch and Hex

**What:** Using oklch for some tokens and hex for others in the same scale.
**Why bad:** Makes it impossible to visually verify the scale without compiling. Creates maintenance confusion.
**Instead:** Use hex for the entire grey scale. oklch is fine for brand colors (coral) where exact Raycast match is not required.

### Anti-Pattern 4: Glass Blur on Cards

**What:** Using backdrop-filter blur on regular cards.
**Why bad:** Raycast cards are SOLID (gradient background, not transparent). Glass blur is reserved for the navbar, sidebar, and special surfaces only.
**Instead:** Use `--gradient-card-bg` for cards. Reserve glass for overlay/navigation elements.

## Sources

- Raycast CSS extraction (see STACK-DESIGN-TOKEN-EXTRACTION.md)
- Virtuna globals.css analysis
- Tailwind v4 Lightning CSS behavior (project MEMORY.md)
