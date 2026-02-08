# Design Tokens Reference

> Source: [`src/app/globals.css`](../src/app/globals.css) | Visual reference: [/showcase](/showcase)

## Quick Reference

Most commonly used tokens for everyday component work:

| Category | Token | Value | When to Use |
|----------|-------|-------|-------------|
| Background | `--color-background` | `var(--color-gray-950)` (#07080a) | Page background |
| Surface | `--color-surface` | #18191a | Cards, panels |
| Text | `--color-foreground` | `var(--color-gray-50)` | Primary text |
| Muted text | `--color-foreground-muted` | `var(--color-gray-500)` | Secondary info |
| Accent | `--color-accent` | `var(--color-coral-500)` | Brand CTA, links |
| Border | `--color-border` | `rgba(255,255,255,0.06)` | Default borders |
| Spacing | `--spacing-4` | 16px | Standard gap/padding |
| Radius | `--radius-md` | 8px | Default border radius |
| Font | `--font-sans` | Inter, system-ui | Body text |
| Shadow | `--shadow-md` | Multi-layer | Card elevation |
| Duration | `--duration-normal` | 200ms | Standard transitions |

---

## Architecture

Virtuna uses a **two-tier token architecture**:

1. **Primitive tokens (Layer 1)** -- Raw values. Never use directly in components.
2. **Semantic tokens (Layer 2)** -- Contextual aliases that reference primitives via `var()`. Always prefer these.

**Design system principles:**
- Dark-mode first (no light mode tokens)
- oklch for color math where accurate; hex/rgba for dark grays (see note below)
- 8px spacing base unit

> **Tailwind v4 note:** The `@theme` block compiles oklch values to hex at build time. For very dark colors (lightness < 0.15), this conversion is inaccurate (e.g., `oklch(0.085 0.01 264)` compiles to `#0d0d0d` instead of target `#07080a`). Dark gray tokens use exact hex/rgba values to guarantee accuracy. oklch works fine in inline CSS styles where the browser interprets directly.

---

## Colors

### Coral Scale (Brand)

The coral scale replaces Raycast's red (#ff6363) with Virtuna coral (#FF7F50). Used for accent, interactive, and brand elements.

| Token | Value | Usage |
|-------|-------|-------|
| `--color-coral-100` | `oklch(0.97 0.03 40)` | Subtle tinted backgrounds, light hover states |
| `--color-coral-200` | `oklch(0.93 0.06 40)` | Light accent backgrounds, selected state fills |
| `--color-coral-300` | `oklch(0.87 0.10 40)` | Prominent backgrounds, focus rings |
| `--color-coral-400` | `oklch(0.78 0.14 40)` | Hover state for accent buttons, link hover |
| `--color-coral-500` | `oklch(0.72 0.16 40)` | **Base brand color** (#FF7F50). Primary buttons, active links |
| `--color-coral-600` | `oklch(0.60 0.14 40)` | Active/pressed state for accent buttons |
| `--color-coral-700` | `oklch(0.48 0.12 40)` | Dark accent backgrounds, emphasis borders |
| `--color-coral-800` | `oklch(0.38 0.10 40)` | Very dark accent tint, subtle glow bases |
| `--color-coral-900` | `oklch(0.28 0.08 40)` | Darkest accent tint, near-invisible accent wash |

### Gray Scale

Extracted from raycast.com computed styles. Dark grays use exact hex values for Tailwind v4 compilation accuracy.

| Token | Value | Usage |
|-------|-------|-------|
| `--color-gray-50` | `#f9f9f9` | Primary text (near-white) |
| `--color-gray-100` | `#f2f2f2` | Secondary text, bright surfaces |
| `--color-gray-200` | `#e0e0e0` | Disabled text on dark backgrounds |
| `--color-gray-300` | `#c6c6c6` | Placeholder text, dimmed labels |
| `--color-gray-400` | `#9c9c9d` | Raycast secondary text (rgb 156,156,157) |
| `--color-gray-500` | `#848586` | Muted text (WCAG AA-boosted, 5.4:1 on #07080a) |
| `--color-gray-600` | `#58595a` | Dimmed text, code comments (rgb 88,89,90) |
| `--color-gray-700` | `#3a3b3d` | Subtle borders, separator lines |
| `--color-gray-800` | `#222326` | Elevated surface background |
| `--color-gray-900` | `#1a1b1e` | Elevated background (rgb 26,27,30) |
| `--color-gray-950` | `#07080a` | Page body background (rgb 7,8,10) |

### Semantic Status Colors (Raw)

Base status colors used by the semantic layer. Not used directly in components.

| Token | Value | Usage |
|-------|-------|-------|
| `--color-success-raw` | `oklch(0.68 0.17 145)` | Base green for success states |
| `--color-warning-raw` | `oklch(0.75 0.15 85)` | Base amber for warning states |
| `--color-error-raw` | `oklch(0.60 0.20 25)` | Base red for error states |
| `--color-info-raw` | `oklch(0.62 0.19 250)` | Base blue for informational states |

---

### Semantic Colors

Always prefer semantic tokens over primitives in component code. They convey intent and can be remapped without touching component files.

#### Backgrounds

| Token | Value | Maps To | Usage |
|-------|-------|---------|-------|
| `--color-background` | `var(--color-gray-950)` | #07080a | Page-level background |
| `--color-background-elevated` | `var(--color-gray-900)` | #1a1b1e | Elevated sections, sidebar backgrounds |
| `--color-surface` | `#18191a` | rgb(24,25,26) | Card surfaces, panel interiors |
| `--color-surface-elevated` | `#222326` | rgb(34,35,38) | Elevated panels, dropdowns, popovers |

#### Text

| Token | Value | Maps To | Usage |
|-------|-------|---------|-------|
| `--color-foreground` | `var(--color-gray-50)` | Near-white | Primary body text, headings |
| `--color-foreground-secondary` | `var(--color-gray-400)` | #9c9c9d | Secondary labels, descriptions |
| `--color-foreground-muted` | `var(--color-gray-500)` | #848586 | Timestamps, helper text, placeholders |

#### Accent

| Token | Value | Maps To | Usage |
|-------|-------|---------|-------|
| `--color-accent` | `var(--color-coral-500)` | #FF7F50 | Primary CTA, links, focus rings |
| `--color-accent-hover` | `var(--color-coral-400)` | Lighter coral | Hover state for accent elements |
| `--color-accent-active` | `var(--color-coral-600)` | Darker coral | Pressed/active state for accent elements |
| `--color-accent-foreground` | `#1a0f0a` | Dark brown | Text on accent backgrounds (7.2:1 WCAG AAA) |

#### Status

| Token | Value | Maps To | Usage |
|-------|-------|---------|-------|
| `--color-success` | `var(--color-success-raw)` | Green | Success toasts, valid input borders |
| `--color-warning` | `var(--color-warning-raw)` | Amber | Warning badges, cautionary states |
| `--color-error` | `var(--color-error-raw)` | Red | Error messages, invalid input borders |
| `--color-info` | `var(--color-info-raw)` | Blue | Informational banners, help text |

#### Borders

| Token | Value | Usage |
|-------|-------|-------|
| `--color-border` | `rgba(255,255,255,0.06)` | Default borders (inputs, cards, dividers) |
| `--color-border-hover` | `rgba(255,255,255,0.1)` | Border on hover state |
| `--color-border-glass` | `rgba(255,255,255,0.06)` | Glass component borders (navbar, panels) |
| `--color-border-subtle` | `rgba(255,255,255,0.04)` | Very subtle separators, grid lines |

#### States

| Token | Value | Usage |
|-------|-------|-------|
| `--color-hover` | `rgba(255,255,255,0.05)` | Background overlay on hover |
| `--color-active` | `rgba(255,255,255,0.1)` | Background overlay on active/pressed |
| `--color-disabled` | `rgba(128,128,128,0.5)` | Disabled element overlay/text |

---

## Typography

### Font Families

| Token | Value | Usage |
|-------|-------|-------|
| `--font-sans` | `var(--font-inter)`, ui-sans-serif, system-ui, sans-serif | All text: body, headings, labels, UI elements |
| `--font-mono` | ui-monospace, SFMono-Regular, JetBrains Mono, monospace | Code blocks, inline code, keyboard shortcuts |

### Font Sizes

| Token | Value | Usage |
|-------|-------|-------|
| `--text-xs` | 12px | Fine print, badges, timestamps |
| `--text-sm` | 14px | Secondary text, helper text, captions |
| `--text-base` | 16px | Default body text |
| `--text-lg` | 18px | Emphasized body text, lead paragraphs |
| `--text-xl` | 20px | Section subheadings |
| `--text-2xl` | 24px | Card headings, small section titles |
| `--text-3xl` | 30px | Section headings |
| `--text-4xl` | 36px | Page headings |
| `--text-5xl` | 48px | Large display headings |
| `--text-hero` | 52px | Hero section text |
| `--text-display` | 64px | Display-scale headings (H1) |

### Font Weights

| Token | Value | Usage |
|-------|-------|-------|
| `--font-regular` | 400 | Body text, descriptions |
| `--font-medium` | 500 | Labels, nav items, subtle emphasis |
| `--font-semibold` | 600 | Headings, button text, strong emphasis |
| `--font-bold` | 700 | Hero headings, primary CTA text |

### Line Heights

| Token | Value | Usage |
|-------|-------|-------|
| `--leading-none` | 1 | Display headings, single-line text |
| `--leading-tight` | 1.1 | Hero headings, large titles |
| `--leading-snug` | 1.25 | Section headings, card titles |
| `--leading-normal` | 1.5 | Body text, paragraphs |
| `--leading-relaxed` | 1.625 | Long-form content, readable prose |

### Letter Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--tracking-tight` | -0.02em | Large headings (tighter for visual density) |
| `--tracking-normal` | 0 | Body text (browser default) |
| `--tracking-wide` | 0.02em | All-caps labels, badge text |

---

## Spacing

Based on an 8px grid system. Use these tokens for all padding, margin, and gap values.

| Token | Value | Usage |
|-------|-------|-------|
| `--spacing-0` | 0 | Reset spacing |
| `--spacing-1` | 4px | Tight gaps (icon-to-text, inline elements) |
| `--spacing-2` | 8px | Compact padding (badges, small buttons) |
| `--spacing-3` | 12px | Standard internal padding (input padding) |
| `--spacing-4` | 16px | Default gap/padding (card padding, grid gap) |
| `--spacing-5` | 20px | Comfortable padding (section inner padding) |
| `--spacing-6` | 24px | Generous padding (card sections, form groups) |
| `--spacing-8` | 32px | Section spacing (between content blocks) |
| `--spacing-10` | 40px | Large section spacing |
| `--spacing-12` | 48px | Page section margins |
| `--spacing-16` | 64px | Major layout spacing (hero to content) |
| `--spacing-20` | 80px | Large layout gaps |
| `--spacing-24` | 96px | Maximum section spacing |

---

## Shadows

Multi-layer shadows for realistic depth. Based on raycast.com button and card styles.

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px oklch(0 0 0 / 0.2)` | Subtle elevation (badges, small elements) |
| `--shadow-md` | `0 4px 6px oklch(0 0 0 / 0.15), 0 2px 4px oklch(0 0 0 / 0.1)` | Card elevation, dropdown shadows |
| `--shadow-lg` | `0 10px 15px oklch(0 0 0 / 0.15), 0 4px 6px oklch(0 0 0 / 0.1)` | Modal shadows, prominent cards |
| `--shadow-xl` | `0 20px 25px oklch(0 0 0 / 0.15), 0 10px 10px oklch(0 0 0 / 0.1), 0 0 0 1px oklch(1 0 0 / 0.05)` | Dialog overlays, hero cards |
| `--shadow-glass` | `0 8px 32px oklch(0 0 0 / 0.2), inset 0 1px 0 oklch(1 0 0 / 0.1)` | Glass panels (inset highlight + drop shadow) |
| `--shadow-glow-accent` | `0 0 20px oklch(0.72 0.16 40 / 0.3)` | Coral glow effect (focus rings, featured elements) |
| `--shadow-button` | `rgba(0,0,0,0.5) 0 0 0 2px, rgba(255,255,255,0.19) 0 0 14px, rgba(0,0,0,0.2) 0 -1px 0.4px inset, rgb(255,255,255) 0 1px 0.4px inset` | Raycast multi-layer button shadow |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-none` | 0 | Square corners (images, full-bleed elements) |
| `--radius-sm` | 4px | Small inline elements |
| `--radius-xs` | 6px | Nav links, small interactive elements |
| `--radius-md` | 8px | Default radius (inputs, buttons, cards) |
| `--radius-lg` | 12px | Cards, panels, dropdowns |
| `--radius-xl` | 16px | Large cards, modals |
| `--radius-2xl` | 20px | Feature cards, hero elements |
| `--radius-3xl` | 24px | Extra-large containers |
| `--radius-full` | 9999px | Pills, avatars, circular elements |

---

## Animation

### Durations

| Token | Value | Usage |
|-------|-------|-------|
| `--duration-fast` | 150ms | Micro-interactions (hover, focus, toggle) |
| `--duration-normal` | 200ms | Standard transitions (open/close, slide) |
| `--duration-slow` | 300ms | Complex animations (modal enter, page transitions) |

### Easings

| Token | Value | Usage |
|-------|-------|-------|
| `--ease-out-cubic` | `cubic-bezier(0.215, 0.61, 0.355, 1)` | Natural deceleration (elements settling into place) |
| `--ease-out-quart` | `cubic-bezier(0.165, 0.84, 0.44, 1)` | Snappier deceleration (dropdown open, toast appear) |
| `--ease-in-out` | `cubic-bezier(0.42, 0, 0.58, 1)` | Symmetric ease (looping animations, pulsing) |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Springy overshoot (toggle, scale bounce) |

### Animation Presets

| Token | Value | Usage |
|-------|-------|-------|
| `--animate-accordion-down` | `accordion-down 0.2s ease-out` | Accordion panel expanding |
| `--animate-accordion-up` | `accordion-up 0.2s ease-out` | Accordion panel collapsing |
| `--animate-gradient-x` | `gradient-x 3s linear infinite` | Horizontal gradient sweep |
| `--animate-shimmer` | `shimmer 2s ease-in-out infinite` | Skeleton loading shimmer |

---

## Z-Index

Layering scale for stacking context management. Use these instead of arbitrary z-index values.

| Token | Value | Usage |
|-------|-------|-------|
| `--z-base` | 0 | Default stacking (content flow) |
| `--z-dropdown` | 100 | Dropdowns, select menus, popovers |
| `--z-sticky` | 200 | Sticky headers, floating toolbars |
| `--z-modal-backdrop` | 300 | Modal backdrop overlay |
| `--z-modal` | 400 | Modal/dialog content |
| `--z-toast` | 500 | Toast notifications (above modals) |
| `--z-tooltip` | 600 | Tooltips (highest priority) |

---

## Breakpoints

Reference values for responsive design. Use Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`, etc.) instead of these tokens directly.

| Token | Value | Usage |
|-------|-------|-------|
| `--breakpoint-sm` | 640px | Mobile landscape |
| `--breakpoint-md` | 768px | Tablet portrait |
| `--breakpoint-lg` | 1024px | Tablet landscape / small desktop |
| `--breakpoint-xl` | 1280px | Desktop |
| `--breakpoint-2xl` | 1536px | Large desktop |

---

## Gradients

Complex gradient values for branded and decorative elements.

| Token | Value | Usage |
|-------|-------|-------|
| `--gradient-coral` | `linear-gradient(135deg, coral-400, coral-500, coral-600)` | Brand gradient (CTA buttons, hero accents) |
| `--gradient-card-bg` | `linear-gradient(137deg, #111214 4.87%, #0c0d0f 75.88%)` | Card background gradient |
| `--gradient-overlay` | `linear-gradient(180deg, transparent, oklch(0 0 0 / 0.8))` | Image overlay fade-to-black |
| `--gradient-navbar` | `linear-gradient(137deg, rgba(17,18,20,0.75) 4.87%, rgba(12,13,15,0.9) 75.88%)` | Glass navbar background |
| `--gradient-glass` | `linear-gradient(137deg, rgba(17,18,20,0.75) 4.87%, rgba(12,13,15,0.9) 75.88%)` | Glass panel background (same as navbar) |
| `--gradient-feature` | `radial-gradient(85.77% 49.97% at 51% 5.12%, ...)` | Feature card decorative radial gradient |

---

## Syntax Highlighting (sugar-high)

Theme tokens for code blocks rendered with sugar-high. Matches Virtuna dark aesthetic.

| Token | Value | Usage |
|-------|-------|-------|
| `--sh-class` | `#e5a869` | Class names |
| `--sh-identifier` | `#c9d1d9` | Variable names, identifiers |
| `--sh-sign` | `#6a6b6c` | Operators, punctuation |
| `--sh-property` | `#7ee787` | Object properties |
| `--sh-entity` | `#d2a8ff` | Entities, decorators |
| `--sh-jsxliterals` | `#ff9f7f` | JSX literal values |
| `--sh-string` | `#a5d6ff` | String literals |
| `--sh-keyword` | `#ff7b72` | Language keywords |
| `--sh-comment` | `#58595a` | Code comments |
