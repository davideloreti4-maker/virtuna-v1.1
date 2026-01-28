# Phase 2: Design System & Components - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Build reusable component library matching societies.io design exactly. Includes buttons, inputs, cards, skeletons, layout components (Header, Footer, Container), and animation components (FadeIn, SlideUp, PageTransition). This phase creates the foundation — individual pages and features use these components in later phases.

</domain>

<decisions>
## Implementation Decisions

### Visual Fidelity
- **Pixel-perfect match** — Extract exact colors, spacing, shadows, borders from societies.io reference
- **Dark mode only** — Match the dark theme in reference; no light mode for v1.1
- **Extract exact font** — Identify and use the same font family as societies.io (replace Inter if different)
- **Extract border-radius** — Measure border-radius values from reference components
- **Match shadows per-component** — Extract exact shadow values for each component type
- **Match all effects** — Replicate any gradients, glows, or special visual effects from reference
- **Flag unclear details** — When values can't be extracted precisely, leave TODO comment for review
- **Use v0 MCP for UI** — Utilize v0 MCP tool for component creation with references for best results
- **Visual browser verification** — Every visual change must be verified in browser until no difference is visible vs reference

### Component Variants
- **Buttons** — Only variants visible in societies.io (primary, secondary, ghost, etc.)
- **Inputs** — Match reference states only: default, focus, error, disabled
- **Cards** — Build each card type exactly as it appears in its context (society card, test card, etc.)
- **Skeletons** — Replicate skeleton loading styles from societies.io exactly

### Animation Approach
- **Framer Motion** — Use Framer Motion for all animations
- **Match timing exactly** — Measure and replicate durations, easings, delays from reference
- **Match page transitions** — Replicate page transition effects from societies.io (fade, slide, etc.)
- **Reduced-motion** — Simpler/faster animations for `prefers-reduced-motion` users (reduce, don't disable)

### Token Structure
- **Tailwind config** — Design tokens live in tailwind.config.ts
- **Color naming** — Claude's discretion: Use shadcn/ui-style conventions (background, foreground, card, input, border, primary, secondary, muted, accent, destructive)
- **Extract spacing** — Measure spacing values from societies.io and create custom scale
- **Extract typography** — Measure font sizes, line heights, weights from reference
- **Use cva** — class-variance-authority for variant management (clean variant API)

### Claude's Discretion
- Color naming convention (recommended: shadcn/ui pattern)
- Exact implementation of reduced-motion alternatives
- File/folder structure for components

</decisions>

<specifics>
## Specific Ideas

- Reference screenshots exist in `.reference` folder
- Use v0 MCP to generate components with visual references for best fidelity
- "Visual browser verification until no difference is seeable" — iterate until pixel-perfect
- Should feel exactly like societies.io — not inspired by, but identical to

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-design-system*
*Context gathered: 2026-01-28*
