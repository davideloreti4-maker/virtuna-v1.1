# Architecture: Design Token Alignment

**Project:** Virtuna v2.3.5 -- Raycast 1:1 Design Token Alignment
**Researched:** 2026-02-06
**Overall Confidence:** HIGH (based on direct source code analysis of all component files)

---

## Executive Summary

This document provides a complete impact assessment for aligning Virtuna's 36-component design system 1:1 with Raycast.com. The changes fall into four categories: (1) token-level changes in globals.css, (2) font migration from Funnel Display + Satoshi to Inter, (3) removal of non-Raycast visual effects (GradientGlow, GradientMesh, colored tints, innerGlow), and (4) documentation rewrite. The analysis covers every component, identifies dependencies between changes, and recommends a safe build order.

**Key finding:** The changes are primarily subtractive (removing effects) and token-level (swapping values), not structural. No component APIs need to change. The riskiest change is font migration because it affects visual metrics (line heights, letter spacing, character widths) across every text-rendering surface.

---

## 1. Component Impact Assessment (All 36 Components)

### Impact Levels

- **HEAVY** -- Requires code changes, prop removals, or visual rework
- **MODERATE** -- Requires font-class updates or minor token adjustments
- **LIGHT** -- Only affected by cascading token changes (no code edits)
- **NONE** -- No changes needed

### 1.1 Primitives (8 files)

| Component | File | Impact | Changes Required |
|-----------|------|--------|------------------|
| **GlassPanel** | `primitives/GlassPanel.tsx` | **HEAVY** | Strip `tint` prop (or make it always "neutral"), remove `innerGlow` prop, remove `tintMap` colored entries, remove innerGlow shadow calculation. Keep blur and borderGlow. The component becomes a neutral frosted panel only. |
| **GlassCard** (primitive) | `primitives/GlassCard.tsx` | **HEAVY** | Remove `glow` prop (removes GradientGlow dependency), remove `tinted` prop, remove `glowIntensity` prop, remove `color` prop, remove `hover="glow-boost"`. Keep `hover="lift"` and `padding`. Simplify to Card + GlassPanel wrapper. |
| **GradientGlow** | `primitives/GradientGlow.tsx` | **REMOVE** | Delete entire file. Non-Raycast effect. |
| **GradientMesh** | `primitives/GradientMesh.tsx` | **REMOVE** | Delete entire file. Non-Raycast effect. |
| **GlassPill** | `primitives/GlassPill.tsx` | **HEAVY** | Remove colored variants (purple, blue, pink, cyan, green, orange from `colorValues`). Keep "neutral" only. Remove `GradientColor` import dependency (which is from GradientGlow.tsx -- must decouple first). |
| **GlassInput** | `primitives/GlassInput.tsx` | **LIGHT** | Already Raycast-accurate (42px height, 8px radius, rgba(255,255,255,0.05) bg). Only font-sans class cascades from Inter change. No code edits needed. |
| **GlassTextarea** | `primitives/GlassTextarea.tsx` | **LIGHT** | Same as GlassInput -- already Raycast-accurate. Font change cascades automatically. |
| **TrafficLights** | `primitives/TrafficLights.tsx` | **NONE** | Uses hardcoded macOS colors. No font, glass, or token dependencies. |

### 1.2 UI Components (22 files)

| Component | File | Impact | Changes Required |
|-----------|------|--------|------------------|
| **Button** | `ui/button.tsx` | **LIGHT** | Already Raycast-accurate (shadow-button, border-white/[0.06], bg-transparent secondary). Font cascades via `font-medium`. No code changes. |
| **Input** | `ui/input.tsx` | **LIGHT** | Uses semantic tokens (`bg-surface`, `border-border`). Font cascades. No code changes. |
| **InputField** | `ui/input.tsx` | **LIGHT** | Wrapper around Input. Font cascades. No code changes. |
| **Card** | `ui/card.tsx` | **LIGHT** | Uses `gradient-card-bg` and `border-border`. Inset shadow matches Raycast. No changes. |
| **GlassCard** (ui) | `ui/card.tsx` | **LIGHT** | Uses `rgba(255,255,255,0.05)` bg and `border-border-glass`. Already Raycast pattern. No changes. |
| **Badge** | `ui/badge.tsx` | **LIGHT** | Uses semantic tokens. Font cascades. No changes. |
| **Dialog** | `ui/dialog.tsx` | **LIGHT** | Already correct: opaque `bg-surface-elevated`, not glass. Inset shadow matches Raycast. No changes. |
| **Select** | `ui/select.tsx` | **LIGHT** | Uses semantic tokens. Font cascades. No changes. |
| **SearchableSelect** | `ui/select.tsx` | **LIGHT** | Same as Select. No changes. |
| **Spinner** | `ui/spinner.tsx` | **NONE** | SVG-based, no text or font dependencies. No changes. |
| **Icon** | `ui/icon.tsx` | **NONE** | SVG wrapper. No changes. |
| **Heading** | `ui/typography.tsx` | **MODERATE** | Remove `font-display` from h1/h2 size classes. All headings should use Inter (via `font-sans`). Update `headingSizeClasses` map. |
| **Text** | `ui/typography.tsx` | **LIGHT** | Font cascades. No code changes. |
| **Caption** | `ui/typography.tsx` | **LIGHT** | Font cascades. No code changes. |
| **Code** | `ui/typography.tsx` | **NONE** | Uses `font-mono`. Unaffected by display/sans font changes. |
| **Tabs** | `ui/tabs.tsx` | **LIGHT** | Font cascades. No changes. |
| **CategoryTabs** | `ui/category-tabs.tsx` | **LIGHT** | Font cascades. No changes. |
| **Toggle** | `ui/toggle.tsx` | **LIGHT** | No font or glass dependencies. No changes. |
| **Avatar/AvatarGroup** | `ui/avatar.tsx` | **NONE** | Image/fallback based. No changes. |
| **Toast** | `ui/toast.tsx` | **LIGHT** | Font cascades. No changes. |
| **Skeleton** | `ui/skeleton.tsx` | **NONE** | CSS animation only. No changes. |
| **Divider** | `ui/divider.tsx` | **NONE** | Border line only. No changes. |
| **Kbd** | `ui/kbd.tsx` | **LIGHT** | Font cascades. No changes. |
| **ShortcutBadge** | `ui/shortcut-badge.tsx` | **LIGHT** | Font cascades. No changes. |
| **ExtensionCard** | `ui/extension-card.tsx` | **LIGHT** | Check for gradient color usage. May need gradient-theme simplification. |
| **TestimonialCard** | `ui/testimonial-card.tsx` | **LIGHT** | Font cascades. Check for Satoshi-specific references. |
| **Accordion** | `ui/accordion.tsx` | **LIGHT** | Font cascades. No changes. |

### 1.3 Effects Components (2 files)

| Component | File | Impact | Changes Required |
|-----------|------|--------|------------------|
| **ChromaticAberration** | `effects/chromatic-aberration.tsx` | **EVALUATE** | Not a Raycast pattern. However, it is a subtle text-shadow effect, not a glass effect. Decision: keep if used sparingly on showcase, or remove for purity. Recommend: keep (it is purely decorative and opt-in). |
| **NoiseTexture** | `effects/noise-texture.tsx` | **EVALUATE** | Subtle SVG grain overlay. Not explicitly Raycast, but Raycast uses similar subtle texture. Recommend: keep (very subtle, adds premium feel at 0.03 opacity). |

### 1.4 Motion Components (7 files)

| Component | File | Impact | Changes Required |
|-----------|------|--------|------------------|
| **FadeIn** | `motion/fade-in.tsx` | **NONE** | Animation wrapper. No visual changes. |
| **FadeInUp** | `motion/fade-in-up.tsx` | **NONE** | Animation wrapper. No visual changes. |
| **SlideUp** | `motion/slide-up.tsx` | **NONE** | Animation wrapper. No visual changes. |
| **StaggerReveal** | `motion/stagger-reveal.tsx` | **NONE** | Animation wrapper. No visual changes. |
| **HoverScale** | `motion/hover-scale.tsx` | **NONE** | Animation wrapper. No visual changes. |
| **PageTransition** | `motion/page-transition.tsx` | **NONE** | Animation wrapper. No visual changes. |
| **FrozenRouter** | `motion/frozen-router.tsx` | **NONE** | Utility. No visual changes. |

### 1.5 Layout Components (3 files)

| Component | File | Impact | Changes Required |
|-----------|------|--------|------------------|
| **Header** | `layout/header.tsx` | **LIGHT** | Uses `font-sans` class. Font cascades automatically. No code changes. |
| **Footer** | `layout/footer.tsx` | **MODERATE** | Has hardcoded `font-display` class on h2. Must change to Inter styling. |
| **Container** | `layout/container.tsx` | **NONE** | Layout only. No changes. |

### 1.6 App Components (impacted subset)

| Component | File | Impact | Changes Required |
|-----------|------|--------|------------------|
| **Sidebar** | `app/sidebar.tsx` | **NONE** | Already uses Raycast gradient glass directly (inline styles, not GlassPanel). No changes needed. |
| **ContentForm** | `app/content-form.tsx` | **CHECK** | Uses GlassInput/GlassTextarea. These are already Raycast-accurate. No changes. |
| **SurveyForm** | `app/survey-form.tsx` | **CHECK** | Same as ContentForm. |
| **Leave Feedback Modal** | `app/leave-feedback-modal.tsx` | **CHECK** | Uses GlassInput/GlassTextarea. |
| **Create Society Modal** | `app/create-society-modal.tsx` | **CHECK** | Uses GlassInput. |

### 1.7 Landing Components (impacted subset)

| Component | File | Impact | Changes Required |
|-----------|------|--------|------------------|
| **HeroSection** | `landing/hero-section.tsx` | **MODERATE** | Has `font-display` on h1. Change to Inter styling. |
| **FeaturesSection** | `landing/features-section.tsx` | **MODERATE** | Has `font-display` on h2. Change to Inter styling. |
| **FeatureCard** | `landing/feature-card.tsx` | **MODERATE** | Has `font-display` on h3. Also references Satoshi explicitly. Change to Inter. |
| **FAQSection** | `landing/faq-section.tsx` | **MODERATE** | Has `font-display` on h2. Change to Inter styling. |
| **StatsSection** | `landing/stats-section.tsx` | **MODERATE** | Has `font-display` on h2. Change to Inter styling. |
| **TestimonialQuote** | `landing/testimonial-quote.tsx` | **LIGHT** | References Satoshi. Font cascades via token change. |

---

## 2. Impact Summary

| Category | Files Changed | Risk Level |
|----------|--------------|------------|
| Token changes (globals.css) | 1 | LOW -- single file, well-structured |
| Font migration (layouts + components) | ~14 files | MEDIUM -- visual metrics change everywhere |
| GradientGlow/GradientMesh removal | 5 files (2 deleted, 3 updated) | LOW -- clear scope, limited consumers |
| GlassPanel tint/innerGlow removal | 3 files | MEDIUM -- must verify all consumers work with neutral-only |
| GlassCard (primitive) simplification | 1 file | MEDIUM -- must decouple from GradientGlow before deletion |
| GlassPill color removal | 1 file | LOW -- limited consumers |
| Typography.tsx heading classes | 1 file | LOW -- clear, isolated change |
| Landing page font-display removal | 5 files | LOW -- straightforward class replacement |
| Showcase pages | 7 pages + ~13 demo components | HIGH -- most extensive by file count |
| BRAND-BIBLE.md rewrite | 1 file (root) + 1 file (.planning) | MEDIUM -- must match new reality exactly |
| docs/ directory | 8 files | MEDIUM -- tokens.md, components.md need updates |

**Total estimated files to modify:** ~45-50 files

---

## 3. Dependency Graph

Understanding what depends on what is critical for safe build order.

```
globals.css (tokens)
  |
  +-- --font-display token --> typography.tsx, globals.css h1/h2 rule
  |     |
  |     +-- landing/hero-section.tsx (font-display class)
  |     +-- landing/features-section.tsx (font-display class)
  |     +-- landing/feature-card.tsx (font-display class)
  |     +-- landing/faq-section.tsx (font-display class)
  |     +-- landing/stats-section.tsx (font-display class)
  |     +-- layout/footer.tsx (font-display class)
  |     +-- trending-client.tsx (font-display class)
  |
  +-- --font-sans token --> ALL components via Tailwind font-sans
  |
  +-- Layout files (font loading)
        +-- (marketing)/layout.tsx (Satoshi + Funnel_Display)
        +-- (app)/layout.tsx (Satoshi + Funnel_Display)

GradientGlow.tsx
  |
  +-- exports GradientColor type --> GlassCard.tsx, GlassPill.tsx, GradientMesh.tsx
  +-- exports colorMap --> GradientMesh.tsx, showcase pages
  +-- component used in --> GlassCard.tsx, primitives-showcase, showcase/utilities

GradientMesh.tsx
  |
  +-- imports from GradientGlow.tsx (colorMap, GradientColor)
  +-- component used in --> showcase/utilities only

GlassPanel.tsx (tint/innerGlow)
  |
  +-- tint/innerGlow props used in --> GlassCard.tsx, showcase/layout-components
  +-- tint colors map referenced internally only
```

### Critical Dependency Chain

**Before deleting GradientGlow.tsx, you MUST:**

1. Remove `GradientGlow` import from `GlassCard.tsx` (primitive)
2. Remove `GradientColor` type import from `GlassPill.tsx`
3. Remove `colorMap` and `GradientColor` imports from `GradientMesh.tsx` (or delete GradientMesh first)
4. Update `primitives/index.ts` to remove GradientGlow/GradientMesh exports
5. Update showcase pages that import these components

**Before removing GlassPanel tint/innerGlow:**

1. Check all consumers pass only "neutral" tint or remove tint prop usage
2. The GlassCard primitive uses `tinted ? colorToTint[color] : "neutral"` -- simplify after removing tinted prop

---

## 4. Font Migration Plan

### What changes

| From | To | Scope |
|------|-----|-------|
| Funnel Display (Google Font) | Inter (Google Font or local) | Headings (h1, h2, hero text) |
| Satoshi (local woff2) | Inter (Google Font or local) | Body text, UI, everything else |

### Files requiring font changes

**Layout files (font loading -- critical):**

1. `src/app/(marketing)/layout.tsx` -- Remove Satoshi local font, remove Funnel_Display import, add Inter
2. `src/app/(app)/layout.tsx` -- Same changes as marketing layout

**Token file:**

3. `src/app/globals.css` -- Change `--font-display` and `--font-sans` to both reference Inter. Remove h1/h2 `@apply font-display` rule (or keep if you want Inter semibold for headings).

**Typography component:**

4. `src/components/ui/typography.tsx` -- Remove `font-display` from `headingSizeClasses[1]` and `headingSizeClasses[2]`. Headings use `font-sans` (Inter) like everything else.

**Landing page components (hardcoded font-display class):**

5. `src/components/landing/hero-section.tsx` -- Remove `font-display` class
6. `src/components/landing/features-section.tsx` -- Remove `font-display` class
7. `src/components/landing/feature-card.tsx` -- Remove `font-display` class, remove Satoshi reference
8. `src/components/landing/faq-section.tsx` -- Remove `font-display` class
9. `src/components/landing/stats-section.tsx` -- Remove `font-display` class
10. `src/components/layout/footer.tsx` -- Remove `font-display` class

**App page (hardcoded font-display class):**

11. `src/app/(app)/trending/trending-client.tsx` -- Remove `font-display` class

**Showcase page:**

12. `src/app/(marketing)/showcase/page.tsx` -- Update font token display, remove font-display demo

**Font asset files:**

13. Remove `src/fonts/Satoshi-Regular.woff2`, `Satoshi-Medium.woff2`, `Satoshi-Bold.woff2`

### Font weight mapping

| Raycast (Inter) | Funnel Display | Satoshi | Action |
|-----------------|---------------|---------|--------|
| 400 (Regular) | N/A | 400 Regular | Direct swap |
| 500 (Medium) | N/A | 500 Medium | Direct swap |
| 600 (SemiBold) | 600 | N/A | Was heading-only, now available for body |
| 700 (Bold) | 700 | 700 Bold | Direct swap |

**Raycast uses Inter with:**
- `letter-spacing: 0.2px` on body (already in globals.css)
- `-webkit-font-smoothing: antialiased` (already in globals.css)
- Font weights 400, 500, 600, 700

### Inter loading strategy

**Recommended:** Use `next/font/google` for Inter (it is a Google Font, same as Funnel Display was loaded).

```typescript
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});
```

Then in globals.css:
```css
--font-display: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
--font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
```

Both display and sans now point to Inter. The `font-display` token can be kept (for semantic clarity that "this is heading style") or removed entirely. Recommendation: **keep `--font-display` pointing to Inter** to avoid a larger refactor of all heading components. The visual output is identical since both now resolve to Inter.

### Visual impact assessment

Inter and Satoshi are both geometric sans-serifs with similar x-heights. The visual shift will be subtle for body text. The bigger visual shift is headings: Funnel Display is a narrow condensed display face while Inter is a standard-width sans-serif. Headings will appear wider and less "designed."

**Mitigation:** After font swap, review heading sizes. May need to:
- Reduce hero heading font size slightly (52px Inter reads bigger than 52px Funnel Display)
- Adjust letter-spacing for headings (Raycast uses `letter-spacing: -0.03em` on large headings)

---

## 5. Glass Effect Removal Strategy

### What gets removed

| Effect | Files | Strategy |
|--------|-------|----------|
| GradientGlow component | `primitives/GradientGlow.tsx` | Delete file |
| GradientMesh component | `primitives/GradientMesh.tsx` | Delete file |
| GlassPanel colored tints | `primitives/GlassPanel.tsx` | Remove `tintMap` colored entries, keep neutral |
| GlassPanel innerGlow | `primitives/GlassPanel.tsx` | Remove `innerGlow` prop and shadow calc |
| GlassCard glow/tinted/color | `primitives/GlassCard.tsx` | Remove glow, tinted, color, glowIntensity props |
| GlassPill colored variants | `primitives/GlassPill.tsx` | Remove colored entries from `colorValues`, keep neutral |
| Glow keyframes | `globals.css` | Remove `glow-float`, `glow-breathe`, `glow-drift` |
| Glow utility classes | `globals.css` | Remove `.animate-glow-*` classes |
| Glow intensity tokens | `globals.css` | Remove `--glow-intensity-*` tokens |
| Legacy gradient colors | `globals.css` | Remove `--color-gradient-*` tokens |

### What stays

| Effect | Reason |
|--------|--------|
| Glass blur (backdrop-filter) | Core Raycast pattern -- navbar, sidebar |
| `.glass-base` utility | Used by GlassPanel for neutral glass |
| `.glass-blur-*` utilities | Used by sidebar, navbar |
| `.glass-navbar` utility | Exact Raycast navbar pattern |
| `--gradient-navbar` | Exact Raycast gradient |
| `--gradient-card-bg` | Used by Card component |
| `--gradient-feature` | Raycast feature card gradient |
| `--shadow-glass` | Used by GlassPanel |
| NoiseTexture | Very subtle, premium feel, opt-in |
| ChromaticAberration | Opt-in decorative, not glass-related |

### GradientColor type extraction

`GradientColor` type is currently defined in `GradientGlow.tsx` and imported by:
- `GlassCard.tsx` (primitive)
- `GlassPill.tsx`
- `GradientMesh.tsx`

**Before deleting GradientGlow.tsx:**

Option A (recommended): Since we are removing all colored variants from GlassCard and GlassPill, there is no need to relocate the type. Just remove the colored props entirely.

Option B (if keeping colored pills): Move `GradientColor` type to a shared `types.ts` in primitives.

**Recommendation: Option A.** Remove colored props from all primitives. Raycast does not use colored glass tints.

### Removal execution order

1. Remove GradientGlow usage from GlassCard.tsx (remove glow prop, GradientGlow import)
2. Remove GradientColor type usage from GlassPill.tsx (simplify to neutral-only or string literal)
3. Delete GradientMesh.tsx (depends on GradientGlow, but deleting both anyway)
4. Delete GradientGlow.tsx
5. Update primitives/index.ts (remove exports)
6. Strip GlassPanel tint/innerGlow
7. Strip GlassCard color/tinted/glowIntensity
8. Strip GlassPill colored variants
9. Clean globals.css (glow keyframes, glow tokens, gradient colors)
10. Update showcase pages

---

## 6. Component Rename Analysis

### Should "Glass*" components be renamed?

**Current names:** GlassPanel, GlassCard (primitive), GlassCard (ui), GlassInput, GlassTextarea, GlassPill

**After changes:** These components still use `backdrop-filter: blur()` and translucent backgrounds. They are still "glass" components -- we are removing colored tints and inner glow, not the glass effect itself.

**Recommendation: Do NOT rename.** Rationale:
1. The components still use glassmorphism (blur + translucent bg)
2. Renaming would require updating 22+ import sites
3. The "Glass" prefix correctly distinguishes them from non-glass variants (Card vs GlassCard)
4. The naming is accurate -- we are stripping *colored* glass, not glass itself

**One exception to evaluate:** `GlassCard` exists in both `primitives/` and `ui/card.tsx`. After simplification, the primitive `GlassCard` becomes very similar to the ui `GlassCard`. Consider merging them or deprecating the primitive in favor of the ui version.

---

## 7. Token Architecture Assessment

### Current: Two-tier (Primitive -> Semantic)

```
Layer 1 (Primitive): --color-coral-500, --color-gray-950, etc.
Layer 2 (Semantic):  --color-accent -> var(--color-coral-500)
                     --color-background -> var(--color-gray-950)
```

**Assessment: This architecture is correct and should be kept.**

### Tokens to remove

| Token | Reason |
|-------|--------|
| `--glow-intensity-subtle` | GradientGlow removed |
| `--glow-intensity-medium` | GradientGlow removed |
| `--glow-intensity-strong` | GradientGlow removed |
| `--color-gradient-purple` | No longer used (GradientGlow/Mesh removed) |
| `--color-gradient-blue` | Same |
| `--color-gradient-pink` | Same |
| `--color-gradient-cyan` | Same |
| `--color-gradient-green` | Same |
| `--color-gradient-orange` | Same |
| `--shadow-glow-accent` | Evaluate -- may still be useful for focus rings |
| `--gradient-glow-coral` | Evaluate -- radial glow not used in Raycast |

### Tokens to modify

| Token | Current | New | Reason |
|-------|---------|-----|--------|
| `--font-display` | `var(--font-funnel-display), ...` | `var(--font-inter), ...` | Font migration |
| `--font-sans` | `var(--font-satoshi), ...` | `var(--font-inter), ...` | Font migration |
| `--color-border` | `rgba(255,255,255,0.06)` | Keep | Already correct |
| `--color-border-glass` | `rgba(255,255,255,0.06)` | Evaluate merge with `--color-border` | Same value, redundant |

### Tokens to keep (already Raycast-accurate)

All color tokens, spacing, radius, shadow (except glow), duration, easing, z-index, breakpoints. The previous v2.0 work already aligned these.

### Structural recommendation

Keep the two-tier architecture. Add a comment block marking the v2.3.5 alignment:

```css
/* v2.3.5: Raycast 1:1 alignment. All non-Raycast tokens removed. */
/* Only deviation: coral accent (#FF7F50) replaces Raycast red. */
```

---

## 8. BRAND-BIBLE.md Rewrite Scope

### Root BRAND-BIBLE.md (299 lines)

| Section | Action | Reason |
|---------|--------|--------|
| Brand Identity (Core Color) | **UPDATE** | Keep coral reference, update design philosophy (remove "Glass-forward") |
| Color System | **UPDATE** | Remove mention of gradient colors (purple, blue, pink, etc.). Keep coral, gray scale, semantic status |
| Typography | **REWRITE** | Replace Funnel Display + Satoshi with Inter throughout. Update type scale if sizes change |
| Spacing & Layout | **KEEP** | Already accurate |
| Shadows | **UPDATE** | Remove shadow-glow-accent if removed from tokens |
| Components section | **UPDATE** | Remove GradientGlow, GradientMesh from primitives list. Update GlassPanel/GlassCard descriptions |
| Motion & Animation | **KEEP** | Unchanged |
| Glassmorphism | **REWRITE** | Remove tint descriptions, innerGlow, GradientGlow section, GradientMesh section. Keep blur, glass-base, glass-navbar |
| Do's and Don'ts | **UPDATE** | Remove references to tint, innerGlow, colored glass, semantic color mapping (purple=AI, etc.) |
| Accessibility | **KEEP** | Unchanged |
| Internal Notes | **UPDATE** | Change "Fonts changed from Inter to Satoshi" -> "Fonts: Inter (matching Raycast)" |

### .planning/BRAND-BIBLE.md (542 lines)

This is the old v1.0 brand bible with extensive iOS 26 liquid glass references. **This entire file should be replaced** with a redirect to the root BRAND-BIBLE.md or deleted, since the root version is the canonical one.

### docs/ directory (8 files)

| File | Action | Reason |
|------|--------|--------|
| `tokens.md` | **UPDATE** | Remove gradient color tokens, glow tokens, update font tokens |
| `components.md` | **UPDATE** | Remove GradientGlow/GradientMesh docs, update GlassPanel/GlassCard API |
| `component-index.md` | **UPDATE** | Remove deleted components, update primitive count |
| `usage-guidelines.md` | **UPDATE** | Remove tinted glass patterns, colored pill patterns |
| `accessibility.md` | **KEEP** | Unchanged |
| `motion-guidelines.md` | **KEEP** | Unchanged |
| `contributing.md` | **UPDATE** | Update token addition guidelines if needed |
| `design-specs.json` | **UPDATE** | Remove deleted tokens from structured export |

---

## 9. Showcase Update Scope

### Showcase structure: 7 pages + 13 demo components

| Page | Route | Impact | Changes |
|------|-------|--------|---------|
| **Tokens** | `/showcase` | **MODERATE** | Update font token display, remove gradient color swatches, update font-display demo |
| **Inputs** | `/showcase/inputs` | **LIGHT** | Font cascades. May need visual review. |
| **Navigation** | `/showcase/navigation` | **LIGHT** | Font cascades. Visual review. |
| **Feedback** | `/showcase/feedback` | **LIGHT** | Font cascades. Visual review. |
| **Data Display** | `/showcase/data-display` | **MODERATE** | Uses GlassCard/GlassPanel demos. Remove tinted examples. |
| **Layout** | `/showcase/layout-components` | **HEAVY** | Extensive GlassPanel tint/innerGlow demos. All tinted examples must be updated or removed. |
| **Utilities** | `/showcase/utilities` | **HEAVY** | GradientGlow and GradientMesh demo sections must be removed entirely. |

### Showcase demo components

| Component | File | Impact |
|-----------|------|--------|
| `code-block.tsx` | NONE | Code display utility |
| `component-grid.tsx` | NONE | Layout utility |
| `copy-button.tsx` | NONE | UI utility |
| `dialog-demo.tsx` | LIGHT | Font cascades |
| `motion-demo.tsx` | NONE | Animation demo |
| `select-demo.tsx` | LIGHT | Font cascades |
| `showcase-section.tsx` | NONE | Layout utility |
| `sidebar-nav.tsx` | LIGHT | Font cascades |
| `spinner-demo.tsx` | NONE | SVG demo |
| `toast-demo.tsx` | LIGHT | Font cascades |
| `toggle-demo.tsx` | LIGHT | Font cascades |
| `token-swatch.tsx` | MODERATE | Remove gradient color swatches |
| `traffic-lights-demo.tsx` | NONE | No changes |

### Additional showcase pages (outside main showcase)

| Page | Route | Impact |
|------|-------|--------|
| `primitives-showcase` | `/primitives-showcase` | **HEAVY** | Extensive GradientGlow demos. Must be rewritten or removed. |
| `viral-results-showcase` | `/viral-results-showcase` | **LIGHT** | Visual review for font changes. |
| `viral-score-test` | `/viral-score-test` | **LIGHT** | Visual review. |

---

## 10. Recommended Build Order

### Phase A: Tokens and Foundation (do first, affects everything)

**Order matters.** Token changes cascade to all components automatically via Tailwind.

1. **A1: Font loading** -- Update both layout files to load Inter instead of Satoshi + Funnel Display
2. **A2: Font tokens** -- Update `--font-display` and `--font-sans` in globals.css to reference Inter
3. **A3: Remove glow/gradient tokens** -- Remove `--glow-intensity-*`, `--color-gradient-*` from globals.css
4. **A4: Remove glow keyframes** -- Remove `glow-float`, `glow-breathe`, `glow-drift` and `.animate-glow-*` classes
5. **A5: Remove h1/h2 font-display rule** -- Remove `h1, h2 { @apply font-display; }` from globals.css (or update to keep Inter semibold)
6. **A6: Delete Satoshi font files** -- Remove `src/fonts/Satoshi-*.woff2`

**Risk:** LOW -- Token changes are isolated to globals.css and layout files.
**Verification:** Dev server hot reload. Check that text renders in Inter.

### Phase B: Component cleanup (primitives first, then consumers)

**Order matters.** Must decouple dependencies before deleting files.

7. **B1: GlassCard (primitive) simplification** -- Remove glow, tinted, color, glowIntensity props. Remove GradientGlow import. Keep hover="lift" and padding.
8. **B2: GlassPill simplification** -- Remove colored variants. Remove GradientColor import. Keep neutral only.
9. **B3: Delete GradientGlow.tsx** -- File is now unused.
10. **B4: Delete GradientMesh.tsx** -- File is now unused (imported colorMap from GradientGlow which is deleted).
11. **B5: Update primitives/index.ts** -- Remove GradientGlow, GradientMesh exports.
12. **B6: GlassPanel simplification** -- Remove `tintMap` colored entries (keep neutral), remove `innerGlow` prop and shadow calc.
13. **B7: Typography Heading** -- Remove `font-display` from headingSizeClasses[1] and [2].
14. **B8: Landing components** -- Remove `font-display` class from hero, features, faq, stats, feature-card, footer.

**Risk:** MEDIUM -- Must verify all import chains are clean. TypeScript compiler will catch broken imports.
**Verification:** `tsc --noEmit` to verify no broken imports. Visual check of components.

### Phase C: Showcase and documentation updates

15. **C1: Showcase/utilities** -- Remove GradientGlow and GradientMesh demo sections.
16. **C2: Showcase/layout-components** -- Remove or simplify tinted GlassPanel demos.
17. **C3: Showcase/data-display** -- Update GlassCard demos (remove tinted variants).
18. **C4: Showcase tokens page** -- Update font token display, remove gradient color swatches.
19. **C5: Primitives-showcase page** -- Rewrite or remove GradientGlow demos.
20. **C6: Other showcase pages** -- Visual review and minor updates.

**Risk:** LOW -- Showcase is documentation, not core app. Errors are visual only.

### Phase D: Documentation rewrite

21. **D1: Root BRAND-BIBLE.md** -- Full rewrite per scope above.
22. **D2: docs/tokens.md** -- Remove deleted tokens, update font tokens.
23. **D3: docs/components.md** -- Remove GradientGlow/GradientMesh API docs, update GlassPanel/GlassCard.
24. **D4: docs/component-index.md** -- Remove deleted components.
25. **D5: docs/usage-guidelines.md** -- Remove colored glass patterns.
26. **D6: docs/design-specs.json** -- Remove deleted tokens.
27. **D7: .planning/BRAND-BIBLE.md** -- Replace with redirect or delete.

**Risk:** LOW -- Documentation only.

### Phase E: Regression and verification

28. **E1: Full visual regression** -- Check every showcase page.
29. **E2: App pages** -- Check dashboard, trending, settings.
30. **E3: Landing page** -- Check hero, features, FAQ, stats.
31. **E4: Mobile check** -- Verify blur reduction still works.
32. **E5: Build check** -- `pnpm build` clean, no warnings.

---

## 11. Risk Areas

### HIGH Risk

| Risk | Mitigation |
|------|------------|
| Font metric shift breaks layouts | Review heading sizes after swap. Inter is wider than Funnel Display -- hero text may need font-size reduction. |
| Broken imports after GradientGlow deletion | Run `tsc --noEmit` after Phase B. TypeScript will catch every broken import. |
| Showcase pages crash due to missing components | Do Phase B (component cleanup) before Phase C (showcase). Import errors are compile-time. |

### MEDIUM Risk

| Risk | Mitigation |
|------|------------|
| oklch dark token compilation (known Tailwind v4 issue) | Already mitigated -- dark tokens use hex. No new dark tokens being added. |
| backdrop-filter stripping by Lightning CSS | Already mitigated -- inline styles for backdrop-filter. No change to this pattern. |
| GlassCard primitive vs ui/GlassCard confusion | Consider adding a TODO to merge these in a future milestone. |
| Missing consumers of GradientColor type | Grep confirmed all consumers: GlassCard, GlassPill, GradientMesh. All handled in Phase B. |

### LOW Risk

| Risk | Mitigation |
|------|------------|
| Browser cache showing old fonts | Clear `.next/`, `node_modules/.cache/`, and browser cache (known issue from memory). |
| Letter-spacing differences between Satoshi and Inter | Already using `letter-spacing: 0.2px` on body (Raycast exact). This will look correct with Inter. |

---

## 12. Duplicate GlassCard Analysis

There are two components named "GlassCard":

1. **`primitives/GlassCard.tsx`** -- Full-featured card with GradientGlow ambient lighting, color themes, tinted glass, glow-boost hover. After stripping, becomes: GlassPanel wrapper with hover="lift" and padding.

2. **`ui/card.tsx` (GlassCard export)** -- Simple glass card with blur, border, and optional inner glow. Already Raycast-accurate.

**After v2.3.5 changes, the primitive GlassCard reduces to:**
- A `<div>` wrapping a `<GlassPanel>` with blur="md", borderGlow, and hover="lift"

**The ui GlassCard already provides:**
- A `<div>` with glass bg, blur, border, and inner glow shadow

**Recommendation:** After this milestone, evaluate merging. For now, keep both to minimize blast radius. The primitive version still provides the hover="lift" animation and padding presets that the ui version does not.

---

## 13. Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Component impact assessment | HIGH | Read every component file directly |
| Font migration plan | HIGH | Identified all 14 files with font-display/Satoshi references |
| Glass removal strategy | HIGH | Traced all GradientGlow/GradientMesh imports and consumers |
| Build order | HIGH | Dependency graph verified via grep of all imports |
| Token changes | HIGH | globals.css fully analyzed |
| Showcase scope | HIGH | All 7 pages + demo components reviewed |
| BRAND-BIBLE scope | HIGH | Both files read in full |
| Visual regression risk | MEDIUM | Inter vs Funnel Display visual difference cannot be fully assessed without rendering |

---

## Sources

All findings based on direct source code analysis of the codebase at `/Users/davideloreti/virtuna-v2.3.5-design-token/`. No external sources needed -- this is an internal architecture assessment.

- `src/app/globals.css` -- 419 lines, complete token system
- `src/components/primitives/` -- 8 files, all read in full
- `src/components/ui/` -- 22 files, key files read in full
- `src/components/effects/` -- 2 files, both read in full
- `src/components/motion/` -- 7 files assessed
- `src/components/landing/` -- 5 files with font-display usage
- `src/components/layout/` -- 3 files assessed
- `src/app/(marketing)/layout.tsx` and `src/app/(app)/layout.tsx` -- font loading
- `src/app/(marketing)/showcase/` -- 7 pages + 13 demo components
- `BRAND-BIBLE.md` (root) -- 309 lines
- `.planning/BRAND-BIBLE.md` -- 542 lines
