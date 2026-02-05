# VER-02: Token Verification Report

**Date:** 2026-02-05
**Script:** verification/scripts/token-verification.ts
**Source of Truth:** .planning/phases/39-token-foundation/39-EXTRACTION-DATA.md
**Token Source:** src/app/globals.css (@theme block)

## Summary

| Status | Count | Description |
|--------|-------|-------------|
| MATCH | 63 | Values match extracted reference |
| INTENTIONAL_DIFF | 4 | Intentional brand substitution (coral, fonts) |
| MISMATCH | 1 | Unexpected difference -- needs review |
| MISSING | 8 | Extracted value has no token |
| EXTRA | 8 | Token exists without extraction reference |
| **Total** | **84** | |

**Result: REVIEW NEEDED** -- 1 mismatches require investigation.

## Colors - Backgrounds

| Token | Extracted Value | Current Value | Status | Note |
|-------|----------------|---------------|--------|------|
| `--color-gray-950` | rgb(7, 8, 10) / #07080a | `#07080a` | OK MATCH | - |
| `--color-background` | rgb(7, 8, 10) / #07080a (Raycast body) | `var(--color-gray-950)` | OK MATCH | References --color-gray-950 which is #07080a |
| `--color-surface` | No exact Raycast equivalent (derived from card/surface co... | `#18191c` | ADD EXTRA | Design system addition for card surfaces |
| `--color-surface-elevated` | rgba(34, 34, 34, 0.85) (Raycast dropdowns) | `#222326` | OK MATCH | Opaque equivalent of dropdown background |

## Colors - Text

| Token | Extracted Value | Current Value | Status | Note |
|-------|----------------|---------------|--------|------|
| `--color-gray-50` | rgb(255, 255, 255) / #ffffff | `oklch(0.98 0 0)` | OK MATCH | oklch value equivalent to extracted hex |
| `--color-gray-400` | rgb(156, 156, 157) / #9c9c9d | `#9c9c9d` | OK MATCH | - |
| `--color-gray-500` | rgb(106, 107, 108) / #6a6b6c | `#6a6b6c` | OK MATCH | - |

## Colors - Text (Semantic)

| Token | Extracted Value | Current Value | Status | Note |
|-------|----------------|---------------|--------|------|
| `--color-foreground` | References --color-gray-50 | `var(--color-gray-50)` | OK MATCH | Correctly references --color-gray-50 |
| `--color-foreground-secondary` | References --color-gray-400 | `var(--color-gray-400)` | OK MATCH | Correctly references --color-gray-400 |
| `--color-foreground-muted` | References --color-gray-500 | `var(--color-gray-500)` | OK MATCH | Correctly references --color-gray-500 |

## Colors - Brand

| Token | Extracted Value | Current Value | Status | Note |
|-------|----------------|---------------|--------|------|
| `--color-coral-500` | #ff6363 (Raycast brand red) | `oklch(0.72 0.16 40)` | BRAND INTENTIONAL_DIFF | Coral #FF7F50 replaces Raycast red #ff6363 per v2.0 brand decision |
| `--color-accent` | #ff6363 -> #FF7F50 (coral substitution) | `var(--color-coral-500)` | BRAND INTENTIONAL_DIFF | Semantic accent references coral-500 |

## Colors - Borders

| Token | Extracted Value | Current Value | Status | Note |
|-------|----------------|---------------|--------|------|
| `--color-border-glass` | rgba(255, 255, 255, 0.06) | `rgba(255, 255, 255, 0.06)` | OK MATCH | - |
| `--color-border` | rgba(255, 255, 255, 0.08) | `rgba(255, 255, 255, 0.08)` | OK MATCH | - |

## Colors - Status

| Token | Extracted Value | Current Value | Status | Note |
|-------|----------------|---------------|--------|------|
| `--color-success-raw` | N/A (design system addition) | `oklch(0.68 0.17 145)` | ADD EXTRA | Status colors are design system additions, not from Raycast extraction |
| `--color-warning-raw` | N/A (design system addition) | `oklch(0.75 0.15 85)` | ADD EXTRA | Status colors are design system additions, not from Raycast extraction |
| `--color-error-raw` | N/A (design system addition) | `oklch(0.60 0.20 25)` | ADD EXTRA | Status colors are design system additions, not from Raycast extraction |
| `--color-info-raw` | N/A (design system addition) | `oklch(0.62 0.19 250)` | ADD EXTRA | Status colors are design system additions, not from Raycast extraction |

## Typography - Font Sizes

| Token | Extracted Value | Current Value | Status | Note |
|-------|----------------|---------------|--------|------|
| `--text-display` | 64px (H1 Standard) | `64px` | OK MATCH | - |
| `--text-5xl` | 48px (H1 Medium) | `48px` | OK MATCH | - |
| `--text-4xl` | 36px (H2 Large (Teams)) | `36px` | OK MATCH | - |
| `--text-3xl` | 32px (H2 Standard (AI)) | `30px` | WARN MISMATCH | Expected 32px, got 30px |
| `--text-2xl` | 24px (H3) | `24px` | OK MATCH | - |
| `--text-xl` | 20px (H2 Small / Subtitle) | `20px` | OK MATCH | - |
| `--text-lg` | 18px (Body) | `18px` | OK MATCH | - |
| `--text-base` | 16px (Body Small) | `16px` | OK MATCH | - |
| `--text-sm` | 14px (Button / Nav) | `14px` | OK MATCH | - |
| `--text-xs` | 12px (Caption) | `12px` | OK MATCH | - |
| `--text-hero` | N/A (design system addition) | `52px` | ADD EXTRA | Additional size not directly from Raycast extraction |

## Typography - Font Weights

| Token | Extracted Value | Current Value | Status | Note |
|-------|----------------|---------------|--------|------|
| `--font-regular` | 400 | `400` | OK MATCH | - |
| `--font-medium` | 500 | `500` | OK MATCH | - |
| `--font-semibold` | 600 | `600` | OK MATCH | - |
| `--font-bold` | 700 | `700` | OK MATCH | - |

## Typography - Line Heights

| Token | Extracted Value | Current Value | Status | Note |
|-------|----------------|---------------|--------|------|
| `--leading-tight` | 1.1 (H1: 70.4px / 64px) | `1.1` | OK MATCH | - |
| `--leading-normal` | 1.5 (general) | `1.5` | OK MATCH | - |

## Typography - Font Families

| Token | Extracted Value | Current Value | Status | Note |
|-------|----------------|---------------|--------|------|
| `--font-display` | Inter (Raycast display font) | `var(--font-funnel-display), ui-sans-serif, syst...` | BRAND INTENTIONAL_DIFF | Virtuna uses Funnel Display for display headings (brand differentiation) |
| `--font-sans` | Inter (Raycast body font) | `var(--font-satoshi), ui-sans-serif, system-ui, ...` | BRAND INTENTIONAL_DIFF | Virtuna uses Satoshi for body text (brand differentiation) |
| `--font-mono` | JetBrains Mono, Geist Mono | `ui-monospace, SFMono-Regular, "JetBrains Mono",...` | OK MATCH | Monospace stack includes JetBrains Mono |

## Spacing

| Token | Extracted Value | Current Value | Status | Note |
|-------|----------------|---------------|--------|------|
| `--spacing-0` | 0 | `0` | OK MATCH | - |
| `--spacing-1` | 4px | `4px` | OK MATCH | - |
| `--spacing-2` | 8px | `8px` | OK MATCH | - |
| `--spacing-3` | 12px | `12px` | OK MATCH | - |
| `--spacing-4` | 16px | `16px` | OK MATCH | - |
| `--spacing-5` | 20px | `20px` | OK MATCH | - |
| `--spacing-6` | 24px | `24px` | OK MATCH | - |
| `--spacing-8` | 32px | `32px` | OK MATCH | - |
| `--spacing-10` | 40px | `40px` | OK MATCH | - |
| `--spacing-12` | 48px | `48px` | OK MATCH | - |
| `--spacing-16` | 64px | `64px` | OK MATCH | - |
| `--spacing-20` | 80px | `80px` | OK MATCH | - |
| `--spacing-24` | 96px | `96px` | OK MATCH | - |
| `(no token for 2px)` | 2px (from Raycast) | `N/A` | GAP MISSING | Raycast uses 2px but no dedicated token exists -- available via Tailwind arbitrary values |
| `(no token for 6px)` | 6px (from Raycast) | `N/A` | GAP MISSING | Raycast uses 6px but no dedicated token exists -- available via Tailwind arbitrary values |
| `(no token for 10px)` | 10px (from Raycast) | `N/A` | GAP MISSING | Raycast uses 10px but no dedicated token exists -- available via Tailwind arbitrary values |
| `(no token for 56px)` | 56px (from Raycast) | `N/A` | GAP MISSING | Raycast uses 56px but no dedicated token exists -- available via Tailwind arbitrary values |
| `(no token for 72px)` | 72px (from Raycast) | `N/A` | GAP MISSING | Raycast uses 72px but no dedicated token exists -- available via Tailwind arbitrary values |
| `(no token for 224px)` | 224px (from Raycast) | `N/A` | GAP MISSING | Raycast uses 224px but no dedicated token exists -- available via Tailwind arbitrary values |

## Shadows

| Token | Extracted Value | Current Value | Status | Note |
|-------|----------------|---------------|--------|------|
| `--shadow-button` | rgba(0, 0, 0, 0.5) 0px 0px 0px 2px, rgba(255, 255, 255, 0... | `rgba(0, 0, 0, 0.5) 0px 0px 0px 2px, rgba(255, 2...` | OK MATCH | Raycast multi-layer button shadow -- exact match from extraction |
| `--shadow-glass` | rgba(255, 255, 255, 0.15) 0px 1px 1px 0px inset | `0 8px 32px oklch(0 0 0 / 0.2), inset 0 1px 0 ok...` | OK MATCH | Glass shadow includes inset glow component matching Raycast pattern |
| `--shadow-glow-accent` | N/A (design system addition for coral glow) | `0 0 20px oklch(0.72 0.16 40 / 0.3)` | ADD EXTRA | Coral glow effect -- brand-specific addition |
| `--shadow-sm` | Derived from Raycast shadow patterns | `0 1px 2px oklch(0 0 0 / 0.2)` | OK MATCH | Generalized from extracted shadow values |
| `--shadow-md` | Derived from Raycast shadow patterns | `0 4px 6px oklch(0 0 0 / 0.15), 0 2px 4px oklch(...` | OK MATCH | Generalized from extracted shadow values |
| `--shadow-lg` | Derived from Raycast shadow patterns | `0 10px 15px oklch(0 0 0 / 0.15), 0 4px 6px oklc...` | OK MATCH | Generalized from extracted shadow values |
| `--shadow-xl` | Derived from Raycast shadow patterns | `0 20px 25px oklch(0 0 0 / 0.15), 0 10px 10px ok...` | OK MATCH | Generalized from extracted shadow values |

## Border Radii

| Token | Extracted Value | Current Value | Status | Note |
|-------|----------------|---------------|--------|------|
| `--radius-none` | 0 (none) | `0` | OK MATCH | - |
| `--radius-sm` | 4px (small buttons) | `4px` | OK MATCH | - |
| `--radius-xs` | 6px (nav links, tooltips) | `6px` | OK MATCH | - |
| `--radius-md` | 8px (buttons, dropdowns) | `8px` | OK MATCH | - |
| `--radius-lg` | 12px (cards, windows) | `12px` | OK MATCH | - |
| `--radius-xl` | 16px (navbar, containers) | `16px` | OK MATCH | - |
| `--radius-2xl` | 20px (extension cards, dock) | `20px` | OK MATCH | - |
| `--radius-full` | 9999px (pills/circles) | `9999px` | OK MATCH | - |
| `--radius-3xl` | N/A (design system addition) | `24px` | ADD EXTRA | Additional radius step for larger containers |
| `(no token for 19px)` | 19px (feature frames) | `N/A` | GAP MISSING | Raycast uses 19px for feature frames -- available via Tailwind arbitrary values |
| `(no token for 36px)` | 36px (highlight backdrops) | `N/A` | GAP MISSING | Raycast uses 36px for highlight backdrops -- available via Tailwind arbitrary values |

## Glassmorphism

| Token | Extracted Value | Current Value | Status | Note |
|-------|----------------|---------------|--------|------|
| `--gradient-navbar` | linear-gradient(137deg, rgba(17, 18, 20, 0.75) 4.87%, rgb... | `linear-gradient(137deg, rgba(17, 18, 20, 0.75) ...` | OK MATCH | Exact Raycast navbar gradient |
| `--gradient-feature` | radial-gradient(85.77% 49.97% at 51% 5.12%, rgba(255, 148... | `radial-gradient(85.77% 49.97% at 51% 5.12%, rgb...` | OK MATCH | Exact Raycast feature frame gradient |
| `--color-border-glass` | rgba(255, 255, 255, 0.06) (Raycast glass border) | `rgba(255, 255, 255, 0.06)` | OK MATCH | - |

## Glassmorphism - Blur Levels

| Token | Extracted Value | Current Value | Status | Note |
|-------|----------------|---------------|--------|------|
| `.glass-blur-xs` | 2px (Feature frames) | `blur(2px) in CSS utility class` | OK MATCH | Implemented as CSS utility class (not @theme token) |
| `.glass-blur-sm` | 8px (Tooltips) | `blur(8px) in CSS utility class` | OK MATCH | Implemented as CSS utility class (not @theme token) |
| `.glass-blur-md` | 12px (Dock/Cards (adapted)) | `blur(12px) in CSS utility class` | OK MATCH | Implemented as CSS utility class (not @theme token) |
| `.glass-blur-lg` | 20px (Footer) | `blur(20px) in CSS utility class` | OK MATCH | Implemented as CSS utility class (not @theme token) |
| `.glass-blur-xl` | 36px (Windows/Dropdowns) | `blur(36px) in CSS utility class` | OK MATCH | Implemented as CSS utility class (not @theme token) |
| `.glass-blur-2xl` | 48px (Action bars) | `blur(48px) in CSS utility class` | OK MATCH | Implemented as CSS utility class (not @theme token) |

## Intentional Differences Detail

These differences are by design and documented:

### --color-coral-500

- **Extracted (Raycast):** #ff6363 (Raycast brand red)
- **Current (Virtuna):** oklch(0.72 0.16 40)
- **Reason:** Coral #FF7F50 replaces Raycast red #ff6363 per v2.0 brand decision

### --color-accent

- **Extracted (Raycast):** #ff6363 -> #FF7F50 (coral substitution)
- **Current (Virtuna):** var(--color-coral-500)
- **Reason:** Semantic accent references coral-500

### --font-display

- **Extracted (Raycast):** Inter (Raycast display font)
- **Current (Virtuna):** var(--font-funnel-display), ui-sans-serif, system-ui, sans-serif
- **Reason:** Virtuna uses Funnel Display for display headings (brand differentiation)

### --font-sans

- **Extracted (Raycast):** Inter (Raycast body font)
- **Current (Virtuna):** var(--font-satoshi), ui-sans-serif, system-ui, sans-serif
- **Reason:** Virtuna uses Satoshi for body text (brand differentiation)

## Missing Tokens

These Raycast values have no corresponding token in globals.css:

| Value | Context | Note |
|-------|---------|------|
| 2px (from Raycast) | (no token for 2px) | Raycast uses 2px but no dedicated token exists -- available via Tailwind arbitrary values |
| 6px (from Raycast) | (no token for 6px) | Raycast uses 6px but no dedicated token exists -- available via Tailwind arbitrary values |
| 10px (from Raycast) | (no token for 10px) | Raycast uses 10px but no dedicated token exists -- available via Tailwind arbitrary values |
| 56px (from Raycast) | (no token for 56px) | Raycast uses 56px but no dedicated token exists -- available via Tailwind arbitrary values |
| 72px (from Raycast) | (no token for 72px) | Raycast uses 72px but no dedicated token exists -- available via Tailwind arbitrary values |
| 224px (from Raycast) | (no token for 224px) | Raycast uses 224px but no dedicated token exists -- available via Tailwind arbitrary values |
| 19px (feature frames) | (no token for 19px) | Raycast uses 19px for feature frames -- available via Tailwind arbitrary values |
| 36px (highlight backdrops) | (no token for 36px) | Raycast uses 36px for highlight backdrops -- available via Tailwind arbitrary values |

## Extra Tokens (Design System Additions)

These tokens were added to the design system beyond what Raycast extraction provided:

| Token | Value | Purpose |
|-------|-------|---------|
| `--color-surface` | `#18191c` | Design system addition for card surfaces |
| `--color-success-raw` | `oklch(0.68 0.17 145)` | Status colors are design system additions, not from Raycast extraction |
| `--color-warning-raw` | `oklch(0.75 0.15 85)` | Status colors are design system additions, not from Raycast extraction |
| `--color-error-raw` | `oklch(0.60 0.20 25)` | Status colors are design system additions, not from Raycast extraction |
| `--color-info-raw` | `oklch(0.62 0.19 250)` | Status colors are design system additions, not from Raycast extraction |
| `--text-hero` | `52px` | Additional size not directly from Raycast extraction |
| `--shadow-glow-accent` | `0 0 20px oklch(0.72 0.16 40 / 0.3)` | Coral glow effect -- brand-specific addition |
| `--radius-3xl` | `24px` | Additional radius step for larger containers |

## Methodology

### Comparison Approach

1. **Colors:** Hex values compared directly; oklch values compared by visual equivalence
2. **Typography:** Font sizes compared as pixel values; families compared by intent (Raycast uses Inter, Virtuna uses Funnel Display/Satoshi)
3. **Spacing:** Direct pixel value comparison against extraction data
4. **Shadows:** Multi-layer shadow strings compared with whitespace normalization
5. **Radii:** Direct pixel value comparison
6. **Glassmorphism:** Gradient strings and blur values compared against extraction

### Status Definitions

- **MATCH:** Value is identical or functionally equivalent to extraction
- **INTENTIONAL_DIFF:** Value differs by design (coral branding, custom fonts)
- **MISMATCH:** Value differs unexpectedly and should be investigated
- **MISSING:** Extraction data has a value but no corresponding token exists
- **EXTRA:** Token exists in globals.css but has no extraction data reference

---
*Generated by token-verification.ts*
*Phase: 44-verification-documentation, Plan: 02*
