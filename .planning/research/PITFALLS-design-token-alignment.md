# Pitfalls: Design Token Alignment

**Project:** Virtuna v2.3.5 Design Token Alignment
**Domain:** Design system overhaul on production app with Tailwind v4 + Next.js
**Researched:** 2026-02-06
**Confidence:** HIGH (verified against codebase analysis + prior experience)

---

## Critical Pitfalls

Mistakes that cause rewrites, broken deployments, or multi-day delays.

---

### Pitfall 1: Lightning CSS Silently Strips backdrop-filter from CSS Classes

**What goes wrong:** Tailwind v4 uses Lightning CSS as its CSS transformer. Lightning CSS strips `backdrop-filter` and `-webkit-backdrop-filter` declarations from CSS class definitions during compilation. The CSS class compiles to an empty rule, producing zero blur on glass elements. This is silent -- no build error, no warning. The component renders fine structurally but looks completely wrong visually.

**Why it happens:** Lightning CSS performs aggressive optimization and vendor prefix handling. In certain configurations, it considers `backdrop-filter` as unnecessary or transforms it incorrectly during the CSS minification/optimization pass. The `@theme` block and utility classes are processed differently from inline styles.

**Evidence:** Verified firsthand in this codebase. `GlassPanel.tsx` already has a comment on line 113: "NOTE: CSS classes (glass-blur-*) are stripped by Lightning CSS in Tailwind v4." The component correctly uses inline styles as a workaround. However, `globals.css` lines 350-378 still define `.glass-blur-xs` through `.glass-blur-2xl` classes with `backdrop-filter` -- these classes are dead code that will mislead future developers.

**Consequences:**
- All glass effects silently break (panels look like solid dark rectangles)
- Visual regression is not caught by unit tests
- Debugging is frustrating because DevTools shows the class is present but empty

**Warning signs:**
- Glass panels render without frosted blur effect
- CSS classes appear in DOM but have no computed backdrop-filter
- `.glass-blur-*` classes in globals.css compile to empty rules

**Prevention:**
1. Apply ALL `backdrop-filter` values via React inline styles, never CSS classes
2. Remove the dead `.glass-blur-*` classes from globals.css to prevent confusion
3. Add a comment in globals.css explaining why glass blur must be inline
4. If creating new glass components, always use `style={{ backdropFilter: ... }}`

**Recovery:** Replace CSS class usage with inline `style={{ backdropFilter: 'blur(Xpx)', WebkitBackdropFilter: 'blur(Xpx)' }}`. The existing `GlassPanel.tsx` pattern is the correct reference.

**Phase relevance:** Phase 1 (Token foundation) -- clean up dead CSS classes. Every glass-related phase after.

---

### Pitfall 2: oklch-to-hex Compilation Inaccuracy for Dark Colors

**What goes wrong:** Tailwind v4's `@theme` block compiles oklch values to hex at build time. For very dark colors (Lightness < 0.15), the oklch-to-hex conversion is significantly inaccurate. A color specified as `oklch(0.085 0.01 264)` intended to produce `#07080a` instead compiles to `#0d0d0d` -- a visibly different shade on dark UIs where even 2-3 hex values matter.

**Why it happens:** The oklch color space has precision limitations at the extremes (very dark and very light). Lightning CSS's color space conversion math introduces rounding errors that become perceptible at low lightness values.

**Evidence:** Verified in this codebase. The `globals.css` already uses this workaround -- `--color-gray-950: #07080a` is specified as hex rather than oklch. Gray-400 through gray-900 are also hex values. The coral scale (lines 13-21) uses oklch because those colors have higher lightness values where conversion is accurate.

**Current exposure:** The following dark tokens use oklch and may be at risk if values are adjusted:
- Any new token with L < 0.15 in oklch
- Any adjusted surface/background tokens

**Warning signs:**
- Background colors look slightly "off" compared to Raycast reference
- Dark surfaces appear lighter than expected
- Color picker shows different hex than intended

**Prevention:**
1. Use exact hex or rgba values for ALL dark tokens (L < 0.20 in oklch) in the `@theme` block
2. Use oklch only for mid-range and bright colors where conversion is accurate
3. When extracting colors from Raycast, always capture the computed hex value and use that directly
4. Document the "hex for darks, oklch for everything else" rule in globals.css

**Recovery:** Compare computed colors in DevTools against target hex values. Replace any drifted oklch values with exact hex.

**Phase relevance:** Phase 1 (Token values) -- verify every dark token.

---

### Pitfall 3: Font Migration Causes Layout Shifts Across All 36+ Components

**What goes wrong:** Switching from Funnel Display (headings) + Satoshi (body) to Inter changes font metrics (x-height, cap-height, ascender/descender ratios, character widths). This causes text to reflow, buttons to resize, cards to change height, and layouts to shift. With 36+ components, 7 showcase pages, a dashboard, and a trending page, the cascade is massive.

**Why it happens:** Inter has a taller x-height (approximately 72.5% of cap-height) compared to Satoshi (approximately 66%). This means Inter text is visibly taller at the same font-size, causing more vertical space consumption. Funnel Display is a display serif with very different proportions than Inter for headlines. When the font-family CSS variable changes, every element using `font-sans` or `font-display` reflows.

**Evidence:**
- Both layouts (`src/app/(app)/layout.tsx` and `src/app/(marketing)/layout.tsx`) load Satoshi via `localFont` from woff2 files and Funnel Display via Google Fonts
- `globals.css` line 103-104 defines `--font-display` referencing `--font-funnel-display` and `--font-sans` referencing `--font-satoshi`
- `typography.tsx` applies `font-display` to H1/H2 headings (line 10-11)
- The hero section uses explicit `font-display` and `font-sans` classes with hardcoded font weights like `font-[350]` and `font-[450]` that may not exist in Inter

**Specific risk areas (verified in codebase):**
- `hero-section.tsx` line 28: `font-display text-[36px] sm:text-[44px] md:text-[52px] leading-[1.15] font-[350]` -- Inter does not have weight 350 (it will snap to 300 or 400, changing visual weight)
- `hero-section.tsx` line 36: `font-sans text-lg font-[450]` -- Inter does not have weight 450 (snaps to 400 or 500)
- Every `font-display` usage becomes Inter instead of a distinct display typeface, losing visual hierarchy differentiation

**Warning signs:**
- Text overflows containers after font swap
- Buttons change width (text inside changes width)
- Card heights shift by 2-6px per line of text
- Hero text looks "too plain" without display typeface distinction

**Prevention:**
1. Change fonts FIRST in isolation before any other token changes
2. After swapping, do a full visual audit of every page (landing, dashboard, trending, all 7 showcase pages)
3. Adjust line-heights, letter-spacing, and font-sizes to compensate for metric differences
4. Replace `font-[350]` and `font-[450]` with valid Inter weights (300/400/500)
5. Consider keeping a display font or using Inter with different weights for headings vs body to maintain hierarchy
6. Use `next/font` with `display: 'swap'` and `adjustFontFallback: true` to minimize CLS

**Recovery:** If layout shifts are unacceptable, create a font override layer that adjusts sizes/spacing per component. This is tedious but contained.

**Phase relevance:** Must be its own dedicated phase, done EARLY. Font changes touch everything.

---

### Pitfall 4: GradientGlow/GradientMesh Removal Breaks Component Dependencies

**What goes wrong:** Removing or simplifying `GradientGlow` and `GradientMesh` primitives breaks every component that imports them. The dependency chain is deeper than it appears because `GlassCard` (the most-used card primitive) internally composes `GradientGlow` for its `glow` prop.

**Why it happens:** The primitives barrel-export (`index.ts`) re-exports `GradientGlow`, `GradientMesh`, `GlassCard`, `GlassPanel`, `GlassPill`, and `TrafficLights`. Removing any of these breaks imports. Additionally, `GlassCard` uses `GradientGlow` internally (line 101-112 of GlassCard.tsx), and the `colorMap` from `GradientGlow.tsx` is re-exported and used by `GradientMesh.tsx`.

**Evidence -- verified dependency graph:**

```
GradientGlow.tsx
  |-- exports colorMap (used by GradientMesh.tsx line 5)
  |-- used internally by GlassCard.tsx (line 101-112)
  |-- imported by showcase/utilities/page.tsx (6 direct usages)
  |-- imported by showcase/layout-components/page.tsx (indirectly via GlassPanel demos)

GradientMesh.tsx
  |-- imports colorMap from GradientGlow (line 5)
  |-- imported by showcase/utilities/page.tsx (4 direct usages)
  |-- imported by landing page hero patterns (BRAND-BIBLE.md references)

GlassCard (primitives/GlassCard.tsx)
  |-- imports GradientGlow internally
  |-- used in showcase/data-display/page.tsx (12 references)
  |-- the `glow` prop renders a GradientGlow behind the card
```

**Files that will break on removal (23 files, 201 occurrences):**
- `src/components/primitives/GlassCard.tsx` -- internal GradientGlow usage
- `src/components/primitives/GradientMesh.tsx` -- imports colorMap from GradientGlow
- `src/app/(marketing)/showcase/utilities/page.tsx` -- 10+ direct usages
- `src/app/(marketing)/showcase/data-display/page.tsx` -- GlassCard with glow
- `src/app/(marketing)/showcase/layout-components/page.tsx` -- GlassPanel tint demos
- `src/components/landing/hero-section.tsx` -- potential GradientMesh background
- `src/components/ui/card.tsx` -- separate GlassCard (ui version) with glow prop
- Plus 16 more files with glass-related imports

**Warning signs:**
- TypeScript compilation fails with "Cannot find module" or "Property does not exist"
- Components render without ambient lighting effects they previously had
- Showcase pages crash or show blank sections

**Prevention:**
1. Do NOT delete GradientGlow/GradientMesh immediately. Simplify them first (remove tints, reduce to Raycast-accurate patterns), then deprecate over time
2. If removing the `glow` prop from GlassCard, add a prop deprecation phase: keep the prop, make it no-op, remove later
3. Update the primitives `index.ts` barrel export simultaneously
4. Create a dependency map before touching any primitive
5. Run `tsc --noEmit` after every primitive change to catch import breaks

**Recovery:** `git stash` the deletion, add back a simplified version that satisfies the type contract but renders nothing (no-op component). Then migrate consumers one by one.

**Phase relevance:** Must happen AFTER token foundation, BEFORE showcase cleanup. Needs its own phase.

---

### Pitfall 5: Two Competing GlassCard Components With Different APIs

**What goes wrong:** The codebase has TWO different GlassCard components with different APIs: `src/components/primitives/GlassCard.tsx` (uses `color`, `tinted`, `glow`, `glowIntensity`, `hover` props) and `src/components/ui/card.tsx` (exports a separate `GlassCard` with only `blur` and `glow` boolean props). During the token alignment, changes to one are missed on the other, causing inconsistent behavior.

**Evidence:**
- `src/components/primitives/GlassCard.tsx`: Props include `color`, `tinted`, `glow`, `glowIntensity`, `hover`, `padding`
- `src/components/ui/card.tsx`: A completely different GlassCard (forwardRef-based) with only `blur` ("sm"/"md"/"lg") and `glow` (boolean)
- The showcase data-display page imports from `ui/card.tsx` (line 9)
- The showcase utilities page imports from `primitives/GradientGlow.tsx`
- Application components may import either one depending on when they were written

**Consequences:**
- Updating primitives GlassCard misses ui GlassCard (and vice versa)
- Inconsistent glass rendering across the app
- Developers get confused about which GlassCard to use

**Warning signs:**
- Some cards look updated while others still have old styling
- Import paths diverge (`@/components/primitives` vs `@/components/ui`)

**Prevention:**
1. Audit every import to determine which GlassCard is used where
2. Consolidate to ONE GlassCard during this migration
3. The `ui/card.tsx` version should be the canonical one (Raycast pattern: simple Card + GlassCard)
4. The `primitives/GlassCard.tsx` version should be either merged or deprecated

**Phase relevance:** Phase addressing component simplification. Must be resolved before showcase updates.

---

## Moderate Pitfalls

Mistakes that cause delays or technical debt.

---

### Pitfall 6: Hardcoded Color Values Bypass Token Changes

**What goes wrong:** Components use hardcoded hex/rgba values instead of design tokens. When tokens change, these components do not update, creating visual inconsistency.

**Evidence -- verified hardcoded values in components:**

| File | Hardcoded Value | Should Be |
|------|----------------|-----------|
| `persona-card.tsx:40` | `bg-[#1a1a1a]` | `bg-surface` or `bg-surface-elevated` |
| `auth-guard.tsx:42` | `bg-[#0A0A0A]` | `bg-background` |
| `view-selector.tsx:76` | `bg-[#18181B]` | `bg-surface` |
| `ui/card.tsx:122` | `background: "rgba(255, 255, 255, 0.05)"` | Should use token |
| `ui/card.tsx:61` | `boxShadow: "inset 0 1px 0 0 rgba(255, 255, 255, 0.1)"` | Should use token |

Additionally, 30+ files use `white/[0.06]`, `white/[0.1]`, `white/[0.03]` patterns. These are technically correct (they match the Raycast values) but are hardcoded rather than referencing `border-border`, `border-border-hover`, etc. When border opacity tokens change, these stay stale.

**Top offenders (by occurrence count):**
- `society-selector.tsx`: 6 hardcoded white/[0.0X] values
- `test-type-selector.tsx`: 3 hardcoded values
- `button.tsx`: 1 secondary variant with `white/[0.06]`
- `survey-form.tsx`: 2 hardcoded values
- `content-form.tsx`: 2 hardcoded values

**Prevention:**
1. Create a codebase audit task: grep for `bg-\[#`, `text-\[#`, `border-\[#`, `bg-\[rgba`, and `white/\[0.` patterns
2. Replace with semantic tokens: `bg-background`, `bg-surface`, `border-border`, etc.
3. For `white/[0.06]` patterns, use `border-border` (which is `rgba(255, 255, 255, 0.06)`)
4. This is a good candidate for a lint rule: disallow arbitrary color values

**Phase relevance:** Token migration phase. Can be parallelized with other cleanup.

---

### Pitfall 7: Showcase Pages Contain Hardcoded Token Metadata That Drifts

**What goes wrong:** The showcase page (`src/app/(marketing)/showcase/page.tsx`) contains 200+ lines of hardcoded token data arrays (`CORAL_SCALE`, `GRAY_SCALE`, `SEMANTIC_COLORS`, `FONT_FAMILIES`, `SHADOWS`, etc.) that describe the design tokens. When `globals.css` tokens change, these arrays become stale documentation that misleads.

**Evidence:**
- `showcase/page.tsx` line 86: `semantic: "rgba(255,255,255,0.08)"` but actual `--color-border` is `rgba(255, 255, 255, 0.06)` -- already drifted
- `showcase/page.tsx` line 113-114: `FONT_FAMILIES` lists "Funnel Display" and "Satoshi" -- will be wrong after font migration
- `showcase/page.tsx` line 81: `accent-foreground` semantic shows `"-> gray-50"` but actual is `#1a0f0a` (dark brown)
- 7 showcase sub-pages reference specific component APIs (GlassPanel tints, GlassCard glow, GradientGlow colors) that may change

**Warning signs:**
- Showcase pages show "correct" token names but wrong values
- Developers reference showcase instead of globals.css and get wrong information
- Code examples in showcase show deprecated patterns

**Prevention:**
1. After every token change in globals.css, update the showcase data arrays
2. Consider generating showcase data from the actual CSS variables at build time (eliminates drift)
3. Add a note at the top of showcase/page.tsx: "These values MUST match globals.css"
4. Update showcase pages as the LAST step of each phase, not first

**Phase relevance:** Final showcase update phase. Every phase that changes tokens creates showcase drift.

---

### Pitfall 8: Browser and Build Cache Prevents CSS Changes from Appearing

**What goes wrong:** After changing token values in `globals.css`, the changes do not appear in the browser. This happens at multiple caching layers: Next.js dev server cache, `node_modules/.cache`, `.next/` build artifacts, and browser cache.

**Evidence:** Known issue from prior development on this project. The memory notes document: "Dev server cache: Kill dev server + clear `.next/` + restart when CSS changes don't appear."

**Cache layers (in order of frequency):**
1. **Next.js dev server** -- Hot Module Replacement does not always pick up `@theme` block changes in globals.css
2. **`.next/` directory** -- Contains compiled CSS from previous builds
3. **`node_modules/.cache/`** -- Contains cached Tailwind/PostCSS/Lightning CSS output
4. **Browser cache** -- Aggressively caches CSS files on localhost
5. **Vercel Edge Cache (production)** -- CDN may serve stale CSS after deployment

**Warning signs:**
- Token values in DevTools show OLD values after editing globals.css
- Hard refresh (Cmd+Shift+R) does not fix it
- Other developers see different styles than you do
- Production deployment shows old styles

**Prevention:**
1. Create a cache-clearing script: `rm -rf .next node_modules/.cache && pnpm dev`
2. After EVERY token change in globals.css, restart the dev server
3. Use incognito/private browsing for visual verification
4. For production: Vercel's default cache busting via content-hashed filenames should work, but verify the first deployment after token changes

**Recovery:** Full cache clear: `rm -rf .next node_modules/.cache`, kill dev server, clear browser cache, restart.

**Phase relevance:** EVERY phase. Establish the cache-clearing discipline from day one.

---

### Pitfall 9: GlassPanel/GlassPill Inline oklch Values Diverge from Tokens

**What goes wrong:** `GlassPanel.tsx` and `GlassPill.tsx` contain hardcoded oklch color values in their `tintMap` and `colorValues` objects (JavaScript, not CSS). These values are NOT connected to the `@theme` tokens in `globals.css`. When token values change in CSS, these JS values stay stale.

**Evidence:**
- `GlassPanel.tsx` lines 41-77: `tintMap` with 7 color definitions using hardcoded oklch strings
- `GlassPill.tsx` lines 28-64: `colorValues` with 7 color definitions using hardcoded oklch strings
- `GradientGlow.tsx` lines 29-36: `colorMap` with 6 hardcoded oklch strings
- `GradientMesh.tsx` line 5: imports `colorMap` from GradientGlow
- None of these reference CSS custom properties -- they are standalone JS constants

**Example of current divergence risk:**
```typescript
// GlassPanel.tsx tintMap
purple: { bg: "oklch(0.18 0.04 300" }

// globals.css @theme
--color-gradient-purple: oklch(0.63 0.24 300);
```
These are related but not identical values. During the Raycast alignment, if gradient colors change in CSS, the tintMap purple stays at the old value.

**Prevention:**
1. Document which JS color constants correspond to which CSS tokens
2. If simplifying primitives, consider making them read CSS custom properties via `var()` in inline styles instead of JS constants
3. Or create a shared `colors.ts` constants file that both JS components and documentation reference
4. Include a checklist: "When changing gradient colors in globals.css, also update: GlassPanel tintMap, GlassPill colorValues, GradientGlow colorMap"

**Phase relevance:** Primitive simplification phase. Ideally consolidate to single source of truth.

---

### Pitfall 10: Removing Glass Tint Props Breaks TypeScript Contracts

**What goes wrong:** If the `tint` prop is removed from `GlassPanel`, or the `color` prop from `GlassCard`/`GlassPill`, TypeScript compilation fails for every consumer passing those props. The type exports from `index.ts` (`GlassTint`, `GlassBlur`, `GradientColor`) are also used downstream.

**Evidence -- exported types that may change:**
```typescript
// primitives/index.ts exports:
export type { GlassTint, GlassBlur } from "./GlassPanel";    // 7 tint values
export type { GradientColor } from "./GradientGlow";           // 6 color values
export type { GlassCardProps } from "./GlassCard";             // includes color, tinted, glow, glowIntensity
```

If Raycast alignment means removing tint colors or the glow concept, every file importing these types breaks.

**Prevention:**
1. Deprecate props before removing: make them optional with no-op behavior
2. Use TypeScript `@deprecated` JSDoc tag to warn consumers
3. Run `tsc --noEmit` after every prop change to catch breaks early
4. Phase the removal: first make no-op, then remove in a later phase

**Phase relevance:** Primitive API simplification phase.

---

### Pitfall 11: Accessibility Contrast Regression from Token Value Changes

**What goes wrong:** Changing background, text, or accent color values can silently violate WCAG contrast requirements. The current token system has been tuned for specific contrast ratios (e.g., `--color-gray-500` comment says "5.4:1 on #07080a"). Changing either the background or the text color breaks these ratios.

**Evidence of current contrast-awareness:**
- `globals.css` line 31: Gray-500 was explicitly lightened from Raycast's `#6a6b6c` to `#848586` for WCAG AA (5.4:1 on `#07080a`)
- `globals.css` line 81: `--color-accent-foreground: #1a0f0a` is documented as "7.2:1 on coral-500, WCAG AAA"
- The BRAND-BIBLE.md section 10 mentions "Ensure 4.5:1 contrast for text"

**High-risk token changes:**
- Changing `--color-background` (the denominator in all contrast ratios)
- Changing `--color-foreground-muted` or `--color-foreground-secondary` (already borderline)
- Changing `--color-accent` (affects button text contrast)

**Prevention:**
1. After changing ANY color token, check contrast ratios using the WebAIM contrast checker
2. Key pairs to verify: foreground/background, foreground-secondary/background, foreground-muted/background, accent-foreground/accent
3. Add contrast ratio comments to globals.css for every text-on-background pairing
4. Set minimum: 4.5:1 for body text (AA), 3:1 for large text (AA), 7:1 for primary text (AAA)

**Phase relevance:** Token value changes phase. Must be verified before any phase is considered done.

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable.

---

### Pitfall 12: Two Layout Files Need Identical Font Changes

**What goes wrong:** Both `src/app/(app)/layout.tsx` (app routes) and `src/app/(marketing)/layout.tsx` (marketing routes) independently load and configure fonts. Changing fonts in one but forgetting the other causes the app section and marketing section to use different typefaces.

**Evidence:**
- Both files contain identical Satoshi `localFont` + Funnel Display `Funnel_Display` setup (lines 7-22 in both)
- Both apply CSS variable classes to `<html>`: `${satoshi.variable} ${funnelDisplay.variable}`
- There is no shared font configuration module

**Prevention:**
1. Extract font configuration into a shared `src/lib/fonts.ts` module
2. Import from both layouts
3. Change in one place, applies everywhere

**Phase relevance:** Font migration phase. Create shared module first.

---

### Pitfall 13: Dead Glow Animation Keyframes Bloat CSS After Cleanup

**What goes wrong:** `globals.css` contains animation keyframes (`glow-float`, `glow-breathe`, `glow-drift`) and utility classes (`.animate-glow-float`, `.animate-glow-breathe`, `.animate-glow-drift`, `.animate-shimmer`) specifically for GradientGlow/GradientMesh effects. If these primitives are simplified or removed, these keyframes and classes become dead code.

**Evidence:** `globals.css` lines 288-341: 6 keyframes and 4 utility classes specifically for glow effects. Also `--glow-intensity-*` tokens on lines 203-206.

**Prevention:**
1. Track which keyframes are still used after primitive simplification
2. Remove unused keyframes in the same phase as primitive changes
3. Remove `--glow-intensity-*` tokens if no longer referenced

**Phase relevance:** Cleanup after primitive simplification.

---

### Pitfall 14: Raycast Variable Aliases in :root May Conflict

**What goes wrong:** `globals.css` lines 235-243 define Raycast variable aliases in `:root` (e.g., `--rounding-normal`, `--color-fg`, `--color-fg-300`, `--color-accent-transparent`). These are bridge variables to keep primitives working. During the token overhaul, these may be forgotten, causing primitives that use `var(--color-fg)` to break.

**Evidence:**
```css
:root {
  --rounding-normal: 8px;
  --color-fg: var(--color-foreground);
  --color-fg-300: var(--color-foreground-muted);
  --color-accent-transparent: oklch(0.72 0.16 40 / 0.15);
  --color-red: var(--color-error);
  --color-red-transparent: oklch(0.60 0.20 25 / 0.15);
  --ease-out: var(--ease-out-cubic);
}
```

**Prevention:**
1. Grep for `--rounding-normal`, `--color-fg`, `--color-fg-300`, etc. to find all consumers
2. Migrate consumers to use the canonical token names
3. Remove aliases only after all consumers are updated
4. Or keep aliases as a backwards-compatibility layer

**Phase relevance:** Token foundation phase.

---

### Pitfall 15: Showcase Code Examples Show Old Patterns After Migration

**What goes wrong:** The showcase pages contain `<CodeBlock>` components with literal code string examples. These show patterns like `<GlassPanel tint="purple" borderGlow innerGlow={0.6}>` and `<GradientGlow color="blue" animate animationType="float" />`. After simplifying these components, the code examples demonstrate APIs that no longer exist.

**Evidence:**
- `showcase/layout-components/page.tsx` line 83-91: Code example shows all 7 blur levels
- `showcase/layout-components/page.tsx` line 190-203: Code example shows tint and innerGlow props
- `showcase/utilities/page.tsx` line 405-414: Code example shows GradientGlow with animate/animationType
- `showcase/utilities/page.tsx` line 477-484: Code example shows GradientMesh with animate prop
- `showcase/page.tsx` line 549-557: Code example shows `font-display` and "Satoshi" references

**Prevention:**
1. After each component API change, search showcase for that component name
2. Update both the live demos AND the code string examples
3. Consider a testing step: verify all code examples actually compile

**Phase relevance:** Final showcase cleanup phase.

---

### Pitfall 16: Agent Reference Confusion -- Old BRAND-BIBLE.md vs New Reference

**What goes wrong:** The existing `BRAND-BIBLE.md` documents the old "iOS 26 Liquid Glass + Raycast" aesthetic with GradientGlow/GradientMesh patterns, Funnel Display + Satoshi fonts, and specific glass component APIs. If this file is not replaced or clearly marked as deprecated, Claude Code agents (or other AI tools) will use it as reference and generate old-pattern code.

**Evidence:** BRAND-BIBLE.md contains:
- Section 7: GlassPanel/GradientGlow/GradientMesh component APIs that are being changed
- Section 3: "Funnel Display (headings) + Satoshi (body)" -- being replaced with Inter
- Section 6: Shadow system that may change
- Section 14: Layout patterns using `<GradientMesh>` and `<GlassCard>` with old props
- The file is explicitly marked as "single source of truth" (line 542)

**Prevention:**
1. Replace BRAND-BIBLE.md with updated reference as ONE of the first actions
2. Or rename to `BRAND-BIBLE-DEPRECATED.md` and create new reference
3. Add a prominent header to the old file: "DEPRECATED -- see RAYCAST-REFERENCE.md"
4. Ensure `.claude/` project instructions reference the new file, not the old

**Recovery:** If an agent generates code with old patterns, the code review step catches it. But prevention is far cheaper.

**Phase relevance:** Phase 0 / pre-work. Must happen before any coding phase begins.

---

## Phase-Specific Warnings Summary

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|-------------|---------------|----------|------------|
| Token foundation (globals.css) | oklch dark color inaccuracy (#2), cache not refreshing (#8), dead CSS classes (#1) | Critical | Use hex for darks, restart dev server after every change, remove dead .glass-blur-* classes |
| Font migration | Layout shifts across all pages (#3), two layout files (#12), showcase font data stale (#7) | Critical | Dedicated phase, shared font module, full visual audit |
| Primitive simplification | Dependency chain breaks (#4), two GlassCards (#5), TypeScript contract breaks (#10), JS color divergence (#9) | Critical | Dependency map first, deprecate before remove, tsc --noEmit after every change |
| Hardcoded value cleanup | Bypassed tokens (#6), Raycast aliases (#14) | Moderate | Grep audit, systematic replacement |
| Showcase updates | Stale data arrays (#7), dead code examples (#15) | Moderate | Update as last step per phase |
| Reference docs | Agent confusion (#16) | Moderate | Replace BRAND-BIBLE.md before coding begins |
| Every phase | Cache issues (#8), accessibility regression (#11) | High | Cache-clear script, contrast ratio checks |

---

## Recommended Phase Order Based on Pitfalls

1. **Reference docs first** -- Replace BRAND-BIBLE.md to prevent agent confusion (#16)
2. **Token foundation** -- Fix globals.css values, remove dead classes (#1, #2, #8, #14)
3. **Font migration** -- Separate phase due to global impact (#3, #12)
4. **Primitive simplification** -- Consolidate GlassCards, simplify APIs (#4, #5, #9, #10)
5. **Hardcoded value cleanup** -- Replace arbitrary values with tokens (#6)
6. **Accessibility audit** -- Verify all contrast ratios (#11)
7. **Showcase updates** -- Update all 7 pages last (#7, #13, #15)

---

## Sources

- Codebase analysis: `globals.css`, `GlassPanel.tsx`, `GradientGlow.tsx`, `GradientMesh.tsx`, `GlassCard.tsx`, `GlassPill.tsx`, `card.tsx`, `typography.tsx`, both `layout.tsx` files, showcase pages
- Prior experience documented in MEMORY.md: Lightning CSS backdrop-filter stripping, oklch compilation inaccuracy, browser cache behavior
- [Tailwind CSS v4 backdrop-filter discussion](https://github.com/tailwindlabs/tailwindcss/discussions/15103)
- [Lightning CSS issues with Tailwind v4](https://github.com/tailwindlabs/tailwindcss/issues/17046)
- [Next.js font optimization](https://vercel.com/blog/nextjs-next-font)
- [Vercel CDN cache documentation](https://vercel.com/docs/cdn-cache)
- [Visual regression testing in design systems](https://sparkbox.com/foundry/design_system_visual_regression_testing)
- [Inter font pairing with Satoshi](https://maxibestof.one/typefaces/inter/pairing/satoshi)
- [Satoshi font metrics (66% x-height)](https://maxibestof.one/typefaces/satoshi)
