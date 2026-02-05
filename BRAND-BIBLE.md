# Virtuna Brand Bible

> Complete design system reference for Virtuna v2.0

---

## Brand Identity

### Core Color

- **Coral (#FF7F50)** -- Primary brand color
- Replaces the original accent red (#ff6363) throughout
- Used sparingly: main CTAs, active states, key highlights
- Everything else follows the established reference design language 1:1

### Design Philosophy

- **Dark-mode first** -- No light theme; every token, component, and effect is optimized for dark surfaces
- **Glass-forward** -- Glassmorphism as a core visual language (backdrop blur, translucent surfaces, frosted panels)
- **Subtle and professional** -- Sparse use of accent color; let the content breathe
- **Performance-conscious** -- Reduced motion support throughout; mobile blur reduction for GPU efficiency

---

## Color System

### Usage Rules

1. **Coral** -- Use for: primary buttons, active tab indicators, key CTAs, accent highlights
   - DO: One coral element per section (the star of the show)
   - DON'T: Use coral for backgrounds, borders, or secondary elements

2. **Gray scale** -- Use for: backgrounds, surfaces, text, borders
   - Primary text: `foreground` (gray-50, near-white)
   - Secondary text: `foreground-secondary` (gray-400, #9c9c9d)
   - Muted text: `foreground-muted` (gray-500, #6a6b6c)
   - Surfaces: `surface` (#18191c), `surface-elevated` (#222326)
   - Background: `background` (gray-950, #07080a)

3. **Status colors** -- Use for: success (green), warning (amber), error (red), info (blue)
   - Only for semantic meaning, never decorative

### Color Token Summary

| Layer | Token | Value | Purpose |
|-------|-------|-------|---------|
| Accent | `--color-accent` | coral-500 (#FF7F50) | Brand CTA, links, focus rings |
| Accent | `--color-accent-hover` | coral-400 | Hover on accent elements |
| Accent | `--color-accent-active` | coral-600 | Pressed state |
| Background | `--color-background` | gray-950 (#07080a) | Page background |
| Background | `--color-surface` | #18191c | Cards, panels |
| Background | `--color-surface-elevated` | #222326 | Dropdowns, popovers |
| Text | `--color-foreground` | gray-50 (near-white) | Primary text |
| Text | `--color-foreground-secondary` | gray-400 (#9c9c9d) | Secondary text |
| Text | `--color-foreground-muted` | gray-500 (#6a6b6c) | Timestamps, captions |
| Border | `--color-border` | rgba(255,255,255,0.08) | Default borders |
| Border | `--color-border-glass` | rgba(255,255,255,0.06) | Glass component borders |
| Status | `--color-success` | oklch green | Success states |
| Status | `--color-warning` | oklch amber | Warning states |
| Status | `--color-error` | oklch red | Error states |
| Status | `--color-info` | oklch blue | Info states |

For the complete token reference (coral scale, gray scale, semantic mappings, etc.), see [docs/tokens.md](docs/tokens.md).

---

## Typography

| Category | Token | Value | Usage |
|----------|-------|-------|-------|
| Display font | `--font-display` | Funnel Display | Hero headings (h1, h2) |
| Body font | `--font-sans` | Satoshi | Body text, labels, UI |
| Code font | `--font-mono` | ui-monospace, SFMono-Regular, JetBrains Mono | Code blocks, inline code |
| Weight: regular | `--font-regular` | 400 | Body text |
| Weight: medium | `--font-medium` | 500 | Labels, nav items |
| Weight: semibold | `--font-semibold` | 600 | Headings, buttons |
| Weight: bold | `--font-bold` | 700 | Hero headings |

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

For line heights, letter spacing, and detailed usage guidance, see [docs/tokens.md](docs/tokens.md).

---

## Spacing & Layout

- **4px base unit** (spacing-1)
- Scale: 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96 (px)

| Token | Value | Usage |
|-------|-------|-------|
| `--spacing-1` | 4px | Tight gaps (icon-to-text) |
| `--spacing-2` | 8px | Compact padding (badges) |
| `--spacing-3` | 12px | Standard padding (input) |
| `--spacing-4` | 16px | Default gap/padding |
| `--spacing-6` | 24px | Generous padding |
| `--spacing-8` | 32px | Section spacing |
| `--spacing-16` | 64px | Major layout spacing |

For the full scale, see [docs/tokens.md](docs/tokens.md).

---

## Shadows

| Token | Usage |
|-------|-------|
| `--shadow-sm` | Subtle elevation (badges) |
| `--shadow-md` | Card elevation, dropdowns |
| `--shadow-lg` | Modal shadows, prominent cards |
| `--shadow-xl` | Dialog overlays, hero cards |
| `--shadow-glass` | Glass panels (inset highlight + drop) |
| `--shadow-glow-accent` | Coral glow (focus rings) |
| `--shadow-button` | Multi-layer 3D button shadow |

For full shadow values, see [docs/tokens.md](docs/tokens.md).

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 4px | Small inline elements |
| `--radius-xs` | 6px | Nav links, small interactive elements |
| `--radius-md` | 8px | Default (inputs, buttons, cards) |
| `--radius-lg` | 12px | Cards, panels, dropdowns |
| `--radius-xl` | 16px | Large cards, modals |
| `--radius-full` | 9999px | Pills, avatars |

---

## Components

The design system includes 36 components across four families.

### Component Hierarchy

- **Interactive (8):** Button, Input, InputField, Select, SearchableSelect, Toggle, Dialog, Tabs, CategoryTabs
- **Display (11):** Badge, Card, GlassCard, ExtensionCard, TestimonialCard, Avatar, AvatarGroup, Icon, Heading, Text, Caption, Code, Kbd, ShortcutBadge
- **Feedback (3):** Spinner, Toast, Skeleton
- **Layout (2):** Divider, GlassPanel
- **Motion (7):** FadeIn, FadeInUp, SlideUp, StaggerReveal, HoverScale, PageTransition, FrozenRouter
- **Effects (2):** NoiseTexture, ChromaticAberration
- **Primitives (6):** GlassPanel, GradientGlow, GradientMesh, GlassCard, GlassPill, TrafficLights

### Key Patterns

- **Button default is `secondary`** (not `primary`) -- matches sparse accent usage
- **Server components by default** -- `"use client"` only when interactivity requires it
- **CVA for variants** -- class-variance-authority manages all variant styling
- **Radix primitives** for complex interactive components (Dialog, Tabs, Toggle, Avatar)
- **forwardRef** for DOM-wrapping components
- **Compound components** -- Card/CardHeader/CardContent/CardFooter, StaggerReveal/StaggerRevealItem

For complete API reference, see [docs/components.md](docs/components.md).
For component index with source files, see [docs/component-index.md](docs/component-index.md).

---

## Motion & Animation

All animation is built on the `motion/react` library with IntersectionObserver-based scroll triggers.

| Component | Purpose | Duration | Trigger |
|-----------|---------|----------|---------|
| FadeIn | Opacity + slide reveal | 500ms | Viewport -100px |
| FadeInUp | Fade + 24px upward slide | 600ms | Viewport -80px |
| SlideUp | 60px upward slide | 600ms | Viewport -100px |
| StaggerReveal | Sequenced child reveal | 500ms/child, 80ms stagger | Viewport -50px |
| HoverScale | Micro-interaction on hover | Spring (stiffness 400, damping 25) | Hover/tap |
| PageTransition | Route change animation | 300ms fade | Route change |

### Timing Tokens

| Token | Value | Use Case |
|-------|-------|----------|
| `--duration-fast` | 150ms | Hover feedback, toggles |
| `--duration-normal` | 200ms | Standard transitions |
| `--duration-slow` | 300ms | Complex animations |

All motion components respect `prefers-reduced-motion: reduce` -- content renders instantly without animation.

For detailed motion guidelines, see [docs/motion-guidelines.md](docs/motion-guidelines.md).

---

## Glassmorphism

Glass effects are a core visual language in Virtuna, applied via the GlassPanel primitive and CSS utility classes.

### Blur Levels

| Level | Blur | Use Context |
|-------|------|-------------|
| `none` | 0px | No blur |
| `xs` | 2px | Feature frames |
| `sm` | 8px | Tooltips |
| `md` | 12px | Cards, dock |
| `lg` | 20px | Footer |
| `xl` | 36px | Windows |
| `2xl` | 48px | Action bars |

### Mobile Optimization

- Blur levels `md` and above are reduced to 8px below 768px viewport width
- This preserves visual quality while maintaining GPU performance on mobile devices

### Glass Utility Classes

- `.glass-base` -- Standard glass background with border
- `.glass-blur-{level}` -- Blur level classes (xs through 2xl)
- `.glass-navbar` -- Frosted glass navigation bar

---

## Do's and Don'ts

### Do

- Use semantic tokens (`--color-foreground`, not `--color-gray-50`) in components
- Use the token system for all values (no hardcoded hex/rgb in component files)
- Default Button to `secondary` variant (`primary` is reserved for the main CTA)
- Use server components by default; add `"use client"` only for interactivity
- Support `prefers-reduced-motion` in all motion components
- Use `forwardRef` for components that wrap DOM elements
- Use CVA for managing variant styles
- Use Radix primitives for complex interactive patterns (modals, toggles, tabs)

### Don't

- Use coral for more than one element per section
- Hardcode color values in component code
- Use oklch in `@theme` for very dark colors (Tailwind v4 compilation issue -- use hex/rgba)
- Skip glass effects where the design calls for them
- Use `primary` Button for every action
- Nest dialogs within dialogs
- Create multiple ToastProvider instances (one at root layout)
- Reference the reference design language origin in any user-facing content

---

## Accessibility

### Contrast Requirements (WCAG 2.1 AA)

- Normal text: 4.5:1 minimum
- Large text (24px+ or 18.66px+ bold): 3:1 minimum
- UI components: 3:1 minimum

### Known Contrast Issues

| Token | Context | Ratio | Status |
|-------|---------|-------|--------|
| `accent-foreground` on `accent` | White on coral | 2.48:1 | Fails AA |
| `foreground-muted` on `background` | Muted text | 3.75:1 | AA Large only |
| `foreground-muted` on `surface` | Muted text on cards | 3.29:1 | AA Large only |

**Guidance:**
- Use `foreground-secondary` (#9c9c9d, 7.3:1) instead of `foreground-muted` for important text
- Reserve `foreground-muted` for truly optional content (timestamps, decorative labels)
- Primary button contrast is a known action item for future remediation

For per-component accessibility requirements, see [docs/accessibility.md](docs/accessibility.md).

---

## Resources

- [Token Reference](docs/tokens.md) -- All design tokens with values and usage guidance
- [Component API](docs/components.md) -- Complete props, variants, and code examples
- [Component Index](docs/component-index.md) -- Source files, showcase pages, exports per component
- [Usage Guidelines](docs/usage-guidelines.md) -- When to use each component, composition patterns
- [Accessibility](docs/accessibility.md) -- WCAG AA contrast requirements per component
- [Motion Guidelines](docs/motion-guidelines.md) -- Animation patterns and when-to-use guidance
- [Contributing](docs/contributing.md) -- How to add components, modify tokens, extend the system
- [Design Specs](docs/design-specs.json) -- Structured token export (W3C Design Tokens-adjacent)
- [Live Showcase](/showcase) -- Interactive component demos across 7 pages

---

## Internal Notes

This design system is based on Raycast's design language (raycast.com) with coral (#FF7F50) branding. The Raycast relationship is internal context only -- never reference it in public-facing content, marketing copy, or user documentation. All component patterns, spacing, shadows, and glass effects are derived from the Raycast reference implementation.

Key internal decisions:
- Coral #FF7F50 replaces Raycast red #ff6363
- Fonts changed from Inter to Satoshi (body) and Funnel Display (headings)
- Dark gray tokens use exact hex values (not oklch) due to Tailwind v4 compilation inaccuracy at low lightness values
- Border and state tokens use rgba for precision

---

*Virtuna Design System v2.0 -- Brand Bible*
*Last updated: 2026-02-05*
