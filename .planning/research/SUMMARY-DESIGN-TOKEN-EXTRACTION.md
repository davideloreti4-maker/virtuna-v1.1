# Research Summary: Raycast Design Token Extraction

**Domain:** Design system token alignment (Raycast 1:1 replication)
**Researched:** 2026-02-06
**Overall confidence:** HIGH -- extracted directly from 10+ compiled CSS files on raycast.com

## Executive Summary

Raycast's design system was extracted from 12 production CSS files served from `raycast.com/_next/static/css/`. The extraction reveals a remarkably disciplined system: a single font (Inter), a 12-step grey scale from `#e6e6e6` to `#07080a`, consistent border opacity at 6%, and a signature glass pattern using a 137-degree gradient with 5px blur. The system is opinionated about shadows -- every card has an `inset 0 1px 0 0 rgba(255,255,255,0.1)` top highlight, and buttons use multi-layer shadows with ring borders rather than traditional outlines.

Virtuna's current token system is approximately 60% aligned. The body background (`#07080a`), card borders (6% white), glass gradient, and basic spacing scale are already correct. However, three critical discrepancies need immediate attention: (1) fonts are wrong (Funnel Display + Satoshi instead of Inter), (2) the card background gradient uses wrong angle and colors, and (3) several grey scale values are significantly off because oklch approximations diverge from Raycast's exact hex values.

The extraction is comprehensive across all design dimensions: colors (grey scale + semantic + accent), typography (sizes, weights, line-heights, letter-spacing), spacing (17-step scale), border radius (9-step scale), shadows (card, button light/dark/danger, modal, glass), borders (7 opacity levels), glass patterns (5 distinct patterns), transitions (6 easing functions), and component-specific patterns (buttons, cards, modals, inputs, nav, lists). All values are documented with exact CSS and their component context.

## Key Findings

**Stack:** Inter is the only primary font. No display font. Headings differentiated by weight (600-700) and size only.
**Architecture:** Two-layer token system: `:root` variables (`--grey-*`, `--spacing-*`, `--rounding-*`) consumed by component classes. Semantic aliases (`--Card-Border`, `--Text-Default`) wrap primitives.
**Critical pitfall:** oklch color values in Tailwind v4 `@theme` blocks compile to hex at build time with inaccurate conversion for certain values. Must use exact hex from Raycast for grey scale.

## Implications for Roadmap

Based on research, suggested phase structure for token alignment:

1. **Font Swap** - Replace Funnel Display + Satoshi with Inter
   - Addresses: CRITICAL typography mismatch
   - Risk: Low -- Inter is a standard Google Font, Next.js has first-class support
   - Scope: globals.css `@theme` font vars, `h1/h2` rule removal, layout.tsx font import

2. **Grey Scale Correction** - Replace oklch approximations with exact Raycast hex values
   - Addresses: Grey-200 through Grey-300 mismatch (significant visual difference)
   - Risk: Medium -- may affect component contrast ratios, needs visual verification
   - Scope: globals.css `@theme` color tokens

3. **Card Gradient Fix** - Update card background from 180deg to 137deg with correct colors
   - Addresses: Card visual appearance (currently too light, wrong angle)
   - Scope: `--gradient-card-bg` token + any hardcoded card gradients in components

4. **Shadow System Expansion** - Add dark button, danger button, modal shadows
   - Addresses: Missing button variant shadows, incomplete shadow system
   - Scope: New shadow tokens in `@theme`, button component updates

5. **Body Line-Height Fix** - Change from 1.15 to appropriate body value
   - Addresses: Text readability, Raycast uses 1.5-1.6 for body text

6. **Cleanup** - Remove legacy tokens (iOS 26 references, colored glass tints), add missing semantic aliases
   - Addresses: BRAND-BIBLE.md references to "iOS 26 Liquid Glass" aesthetic

**Phase ordering rationale:**
- Font swap first because it affects all text rendering and is the most visually impactful change
- Grey scale second because it affects surface/text contrast across all components
- Card gradient third because cards are the most numerous component
- Shadows and line-height can be done in parallel
- Cleanup last after all values are corrected

**Research flags for phases:**
- Font swap: Standard Next.js font loading, unlikely to need research
- Grey scale: Need to verify WCAG AA contrast ratios after changing values
- Card gradient: May need to update multiple component files that hardcode gradient values

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Grey scale | HIGH | Extracted from `:root` CSS custom properties with exact hex values |
| Typography | HIGH | Font-face declarations + computed styles confirm Inter as sole primary font |
| Borders | HIGH | Consistent 6% opacity confirmed across all card/panel CSS classes |
| Shadows | HIGH | Complete button shadow definitions extracted with all state variants |
| Glass patterns | HIGH | Gradient + blur + border + shadow pattern confirmed across multiple components |
| Spacing | HIGH | Full 17-step scale extracted from `:root` with exact pixel values |
| Radius | HIGH | Full 9-step scale with variable names and component mapping |
| Transitions | MEDIUM | Durations and easings extracted, but component-specific combinations may vary |

## Gaps to Address

- **Navbar height:** Not explicitly found in CSS (likely set by flex content). Would need DevTools inspection.
- **Sidebar width:** Not found in these CSS files (may be in JS or a CSS file we didn't fetch).
- **Z-index for site navbar:** The in-page z-index scale was found but the site-level navbar z-index wasn't explicitly in the extracted CSS.
- **Dark mode toggle:** Raycast is dark-only on the marketing site. No light theme tokens found.
- **Responsive font scaling:** Some font sizes change at breakpoints (e.g., hero h1: 36px -> 48px -> 64px). Full responsive mapping would require more detailed component-by-component extraction.
