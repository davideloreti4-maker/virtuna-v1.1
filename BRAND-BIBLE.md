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

*Virtuna Design System v2.3.5 -- Brand Bible*
*Last updated: 2026-02-08*
