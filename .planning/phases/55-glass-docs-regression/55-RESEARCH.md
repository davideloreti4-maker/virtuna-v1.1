# Phase 55: Glass, Documentation & Regression - Research

**Researched:** 2026-02-08
**Domain:** Component refactoring, design system documentation, visual regression testing
**Confidence:** HIGH

## Summary

This phase involves three interconnected workstreams: (1) stripping GlassPanel down to Raycast-neutral-only glass, hard-deleting GradientGlow and GradientMesh, (2) rewriting the BRAND-BIBLE.md and updating all design docs with accurate Raycast values, and (3) running a full visual regression audit across all 36 components and 3 page routes.

The codebase is well-structured for this work. GlassPanel has 6 removable props (`tint`, `blur`, `opacity`, `borderGlow`, `innerGlow` with their associated types), GradientGlow has exactly 4 consumer files (GlassCard, GradientMesh, GlassPill type import, primitives-showcase page), and GradientMesh has zero external consumers beyond its barrel export and GradientMesh.tsx itself. Existing Playwright + pixelmatch infrastructure in `verification/scripts/` can be reused for regression screenshots.

**Primary recommendation:** Execute in three sequential sub-tasks: (1) GlassPanel refactor + component deletions + consumer cleanup, (2) BRAND-BIBLE.md rewrite + doc updates, (3) full regression audit with fix pass. The GlassPanel refactor is the riskiest change and should be completed and verified before documentation, since docs need to reflect the final component API.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Playwright | ^1.58.0 | Visual regression screenshots | Already installed, has existing specs in `verification/scripts/visual-comparison.spec.ts` |
| pixelmatch | ^6.0.0 | Pixel-level diff comparison | Already installed, used by existing visual-comparison spec |
| pngjs | ^7.0.0 | PNG manipulation for diffs | Already installed, paired with pixelmatch |
| wcag-contrast | ^3.0.0 | WCAG AA contrast ratio calculation | Already installed, used by `verification/scripts/contrast-audit.ts` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | (npx) | TypeScript script runner | Running verification scripts (`npx tsx verification/scripts/...`) |
| Next.js dev server | 16.1.5 | Local rendering for screenshots | Must be running for Playwright page captures |

### Alternatives Considered

None needed -- all required tooling is already installed. No new dependencies for this phase.

## Architecture Patterns

### Current File Structure (Phase 55 Scope)

```
src/
├── components/
│   ├── primitives/
│   │   ├── GlassPanel.tsx      # REFACTOR: strip to neutral-only
│   │   ├── GlassCard.tsx       # REFACTOR: remove GradientGlow dep, simplify
│   │   ├── GlassPill.tsx       # FIX: move GradientColor type locally
│   │   ├── GradientGlow.tsx    # DELETE
│   │   ├── GradientMesh.tsx    # DELETE
│   │   ├── GlassInput.tsx      # VERIFY only
│   │   ├── GlassTextarea.tsx   # VERIFY only
│   │   ├── TrafficLights.tsx   # VERIFY only
│   │   └── index.ts            # CLEANUP: remove deleted exports
│   └── ui/
│       └── card.tsx            # VERIFY: GlassCard values match Raycast
├── app/
│   ├── globals.css             # CLEANUP: remove orphaned CSS
│   └── (marketing)/
│       ├── primitives-showcase/page.tsx  # REWRITE: remove GradientGlow sections
│       └── showcase/
│           ├── layout-components/page.tsx  # UPDATE: GlassPanel API changes
│           └── data-display/page.tsx       # UPDATE: GlassCard API changes
├── BRAND-BIBLE.md              # REWRITE from scratch
├── .planning/BRAND-BIBLE.md    # REWRITE from scratch
└── docs/
    ├── tokens.md               # UPDATE: font, border, surface values
    ├── components.md           # UPDATE: GlassPanel/GlassCard API
    ├── component-index.md      # UPDATE: remove GradientGlow/Mesh rows
    ├── contributing.md         # UPDATE: remove GradientGlow/Mesh references
    ├── design-specs.json       # UPDATE: font family values
    └── accessibility.md        # VERIFY: contrast ratios still valid
```

### Pattern 1: GlassPanel Refactored API

**What:** GlassPanel becomes a zero-config Raycast glass container.
**When to use:** Any surface needing the Raycast frosted glass effect.

```tsx
// AFTER refactor -- simplified props
export interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: "div" | "section" | "article" | "aside";
}

export function GlassPanel({
  children,
  className,
  style,
  as: Component = "div",
}: GlassPanelProps) {
  return (
    <Component
      className={cn(
        "rounded-[12px] border border-white/[0.06]",
        className
      )}
      style={{
        background: "linear-gradient(137deg, rgba(17,18,20,0.75) 4.87%, rgba(12,13,15,0.9) 75.88%)",
        backdropFilter: "blur(5px)",
        WebkitBackdropFilter: "blur(5px)",
        boxShadow: "rgba(255,255,255,0.15) 0px 1px 1px 0px inset",
        ...style,
      }}
    >
      {children}
    </Component>
  );
}
```

**Key decisions (locked in CONTEXT.md):**
- `blur` prop removed -- fixed 5px via inline style (Lightning CSS bypass)
- `tint` prop removed -- no colored tints
- `innerGlow` prop removed -- no inner glow
- `opacity` prop removed -- Raycast glass gradient is the background
- `borderGlow` prop removed -- standard `border-white/[0.06]` always on
- `rounded-xl` (16px) changed to `rounded-[12px]` (Raycast cards = 12px)
- `glass-base` CSS class no longer needed (inline style replaces it)
- `shadow-glass` CSS class no longer needed (inline `boxShadow` replaces it)

### Pattern 2: GlassCard Cleanup

**What:** GlassCard in `primitives/` is deprecated and will be deleted. The `ui/card.tsx` GlassCard remains and is already Raycast-correct.

**Current state of `ui/card.tsx` GlassCard (already correct):**
- `background: rgba(255, 255, 255, 0.05)` -- correct
- `border-radius: 12px` -- correct
- `border: border-border` (which maps to `rgba(255,255,255,0.06)`) -- correct
- `boxShadow: rgba(255,255,255,0.15) 0px 1px 1px 0px inset` -- correct
- `hover: bg-white/[0.02]` -- correct per Raycast live audit (subtle, no translate-y)
- Blur values in `blurValues` map -- these may need review (5px fixed? or keep variable?)

**Current state of `primitives/GlassCard.tsx` (to be deleted):**
- Depends on GradientGlow (ambient glow behind card)
- Depends on GlassPanel (glass effect)
- Has tint, innerGlow, hover lift/glow-boost features -- all non-Raycast patterns
- Already marked `@deprecated` in JSDoc

### Pattern 3: Type Migration for GlassPill

**What:** GlassPill imports `GradientColor` type from `GradientGlow.tsx`. When GradientGlow is deleted, this import breaks.

**Solution:** Move the `GradientColor` type definition to a shared location or inline it in GlassPill:

```tsx
// In GlassPill.tsx -- inline the type after GradientGlow deletion
type PillColor = "purple" | "blue" | "pink" | "cyan" | "green" | "orange";

export interface GlassPillProps {
  color?: PillColor | "neutral";
  // ... rest of props
}
```

### Anti-Patterns to Avoid

- **Partial deletion:** Do NOT deprecate GradientGlow/GradientMesh with `@deprecated` annotations. CONTEXT.md says hard delete. Any import of a deleted file produces a build-time error which is self-documenting.
- **Changing `ui/card.tsx` GlassCard blur to fixed 5px:** The `ui/card.tsx` GlassCard has configurable blur (sm/md/lg) and this may be intentional for different glass contexts. Verify whether this should also be fixed to 5px or stay variable. Decision needed.
- **Leaving orphaned CSS:** After deleting GradientGlow/GradientMesh, the `glow-float`, `glow-breathe`, `glow-drift` keyframes and utility classes become dead code. Remove them.
- **Forgetting inline style for backdrop-filter:** Lightning CSS strips `backdrop-filter` from CSS classes. Always use React inline styles.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Visual regression screenshots | Custom screenshot logic | Existing `verification/scripts/visual-comparison.spec.ts` | Already configured with animation disabling, page captures, diff reporting |
| WCAG contrast checking | Manual ratio calculation | Existing `verification/scripts/contrast-audit.ts` + `wcag-contrast` npm package | Handles all token/background combos systematically |
| Pixel diff comparison | Manual visual comparison | `pixelmatch` library (already installed) | Sub-pixel accurate, generates diff images |
| Finding all consumers of deleted components | Manual grep | `grep -r` for import statements | Catches re-exports, dynamic imports, type-only imports |

**Key insight:** The existing `verification/` directory has production-quality scripts for exactly this kind of regression work. Reuse them rather than creating new verification approaches.

## Common Pitfalls

### Pitfall 1: GlassPill Type Import Chain Break

**What goes wrong:** Deleting `GradientGlow.tsx` breaks `GlassPill.tsx` because it imports `type GradientColor` from `./GradientGlow`.
**Why it happens:** GlassPill only needs the type union, not the component, but TypeScript resolves the import at build time.
**How to avoid:** Before deleting GradientGlow.tsx, move the `GradientColor` type to GlassPill.tsx (as a local `PillColor` type) or to a shared types file.
**Warning signs:** Build fails with "Cannot find module './GradientGlow'" after deletion.

### Pitfall 2: primitives/GlassCard.tsx vs ui/card.tsx GlassCard Name Collision

**What goes wrong:** Both `primitives/GlassCard.tsx` and `ui/card.tsx` export a `GlassCard` component. Deleting the primitives version may break consumers that import from `@/components/primitives`.
**Why it happens:** The design system has two GlassCard implementations with different APIs.
**How to avoid:**
1. Find all `GlassCard` imports and determine which source they use
2. Current consumers in `src/app/(marketing)/showcase/data-display/page.tsx` import from `@/components/primitives` -- these need migration to `@/components/ui/card`
3. The barrel export in `primitives/index.ts` needs the GlassCard export removed
**Warning signs:** Import resolution errors or wrong component rendered after deletion.

**Current consumers of primitives GlassCard:**
- `src/app/(marketing)/showcase/data-display/page.tsx` (lines 9, 316-398)
- JSDoc examples in `noise-texture.tsx` and `chromatic-aberration.tsx` (comments only, not imports)

### Pitfall 3: CSS Class Orphaning

**What goes wrong:** After GlassPanel refactor, `glass-base` and `shadow-glass` CSS classes in globals.css become dead code. The `glass-blur-*` classes are already documented as stripped by Lightning CSS but still exist in the file.
**Why it happens:** The refactored GlassPanel uses inline styles exclusively, making these CSS classes unused.
**How to avoid:** After refactoring GlassPanel, grep for ALL glass-related CSS classes to confirm zero usage, then remove them from globals.css.
**Specific classes to remove:**
- `.glass-base` (line 346) -- was used by GlassPanel, now inline
- `.glass-blur-xs` through `.glass-blur-2xl` (lines 351-379) -- Lightning CSS strips them anyway
- Mobile blur media query (lines 391-399) -- no longer relevant with fixed 5px
- `.glass-navbar` (lines 382-388) -- verify if header/sidebar still use it (sidebar uses inline styles, header uses inline styles, so likely orphaned)
- `@keyframes glow-float`, `glow-breathe`, `glow-drift` (lines 289-322) -- only used by GradientGlow/Mesh
- `.animate-glow-float`, `.animate-glow-breathe`, `.animate-glow-drift` (lines 328-338) -- only used by GradientGlow/Mesh
- `--glow-intensity-subtle/medium/strong` tokens (lines 205-207) -- only used by GradientGlow
- `--gradient-glow-coral` token (line 193) -- only used by GradientGlow
- `--color-gradient-*` tokens (lines 210-215) -- verify usage before removing

**WARNING:** Verify `.glass-navbar` is truly orphaned. The class exists at line 382 but inline styles are used by both `sidebar.tsx` (line 107-111) and `header.tsx` (line 61-64). Grep confirms no file imports `.glass-navbar` as a className.

### Pitfall 4: Showcase Page Breakage

**What goes wrong:** The `primitives-showcase` page heavily uses GradientGlow (10+ instances) and will completely break after deletion.
**Why it happens:** This page was specifically built to showcase GradientGlow colors, intensities, and composed examples.
**How to avoid:** Rewrite or significantly simplify the primitives-showcase page. Remove all GradientGlow sections. Keep TrafficLights and update GlassPanel section to reflect simplified API.
**Warning signs:** Build errors or blank sections on the page.

### Pitfall 5: Browser/Build Cache After CSS Token Changes

**What goes wrong:** CSS changes don't appear in the browser after modifying globals.css tokens.
**Why it happens:** Next.js aggressively caches CSS in `.next/`. Browser also caches.
**How to avoid:** After CSS changes: (1) stop dev server, (2) delete `.next/` directory, (3) restart dev server, (4) hard-refresh browser (Cmd+Shift+R).
**Warning signs:** Old values still rendering despite correct source code.

### Pitfall 6: BRAND-BIBLE.md Exists in Two Locations

**What goes wrong:** Two Brand Bible files diverge because only one is updated.
**Why it happens:** There's `BRAND-BIBLE.md` at repo root AND `.planning/BRAND-BIBLE.md` in the planning directory.
**How to avoid:** CONTEXT.md says Claude's discretion on location. Recommendation: keep one canonical file at repo root, make `.planning/BRAND-BIBLE.md` a symlink or delete it. Both currently contain different content (repo root is v2.0 partial update, .planning is v1.0 completely outdated).

### Pitfall 7: Doc Token Value Mismatches (Pre-existing)

**What goes wrong:** Documentation references values that don't match the actual `globals.css`.
**Why it happens:** Docs were written during earlier phases and not updated after Phase 53/54 corrections.
**Known mismatches found during research:**

| File | Wrong Value | Correct Value | Location |
|------|------------|---------------|----------|
| `BRAND-BIBLE.md` (root) | `--color-border: rgba(255,255,255,0.08)` | `rgba(255,255,255,0.06)` | Line 56 |
| `BRAND-BIBLE.md` (root) | Font: `Satoshi` body, `Funnel Display` headings | Font: `Inter` for all | Lines 71-73 |
| `BRAND-BIBLE.md` (root) | `--color-surface: #18191c` | `#18191a` | Lines 37, 51 |
| `BRAND-BIBLE.md` (root) | `foreground-muted: #6a6b6c` | `#848586` (lightened in Phase 53) | Line 55 |
| `docs/tokens.md` | `--font-sans: Satoshi` | `Inter` | Lines 19, 155 |
| `docs/tokens.md` | `--font-display: Funnel Display` | Removed (Inter for all) | Line 154 |
| `docs/tokens.md` | `--color-surface: #18191c` | `#18191a` | Lines 12, 100 |
| `docs/tokens.md` | `--color-border: rgba(255,255,255,0.08)` | `rgba(255,255,255,0.06)` | Line 16 |
| `docs/tokens.md` | `foreground-muted: #6a6b6c` | `#848586` | Line 70 |
| `docs/design-specs.json` | `Funnel Display`, `Satoshi` | `Inter` | Lines 82-83 |
| `docs/components.md` | GlassPanel/GlassCard docs reference tint, innerGlow, blur props | Simplified API | Multiple |
| `docs/component-index.md` | Lists GradientGlow, GradientMesh as components | Deleted | Lines 85-86, 131 |
| `docs/contributing.md` | References GradientGlow, GradientMesh in structure | Deleted | Lines 18, 255-256 |
| `.planning/BRAND-BIBLE.md` | Entirely outdated (v1.0 with iOS 26 direction) | Complete rewrite needed | Entire file |
| `src/app/(marketing)/showcase/page.tsx` | `surface` semantic shows `#18191c` | `#18191a` | Line 49 |

## Code Examples

### Example 1: Refactored GlassPanel (Final Implementation)

```tsx
// Source: CONTEXT.md locked decisions + Raycast extraction values
"use client";

import { cn } from "@/lib/utils";
import { type ReactNode, type CSSProperties } from "react";

export interface GlassPanelProps {
  children: ReactNode;
  /** Additional className for layout overrides */
  className?: string;
  /** Custom style overrides */
  style?: CSSProperties;
  /** HTML element to render as */
  as?: "div" | "section" | "article" | "aside";
}

/**
 * GlassPanel - Raycast-style frosted glass container.
 *
 * Fixed 5px blur, Raycast neutral glass gradient, 12px radius.
 * No configuration needed -- matches Raycast 1:1.
 *
 * Safari-compatible via inline backdrop-filter (bypasses Lightning CSS stripping).
 *
 * @example
 * <GlassPanel>
 *   <h2>Content</h2>
 * </GlassPanel>
 *
 * @example
 * <GlassPanel as="aside" className="p-6">
 *   <nav>Sidebar content</nav>
 * </GlassPanel>
 */
export function GlassPanel({
  children,
  className,
  style,
  as: Component = "div",
}: GlassPanelProps) {
  return (
    <Component
      className={cn(
        "rounded-[12px] border border-white/[0.06]",
        className
      )}
      style={{
        background:
          "linear-gradient(137deg, rgba(17,18,20,0.75) 4.87%, rgba(12,13,15,0.9) 75.88%)",
        backdropFilter: "blur(5px)",
        WebkitBackdropFilter: "blur(5px)",
        boxShadow: "rgba(255,255,255,0.15) 0px 1px 1px 0px inset",
        ...style,
      }}
    >
      {children}
    </Component>
  );
}
```

### Example 2: Barrel Export Cleanup

```tsx
// src/components/primitives/index.ts -- AFTER cleanup
export { GlassPanel } from "./GlassPanel";
export type { GlassPanelProps } from "./GlassPanel";

// GradientGlow DELETED -- removed from exports
// GradientMesh DELETED -- removed from exports
// GlassCard DELETED (primitives version) -- use ui/card.tsx GlassCard instead

export { GlassPill } from "./GlassPill";
export type { GlassPillProps } from "./GlassPill";

export { TrafficLights } from "./TrafficLights";
export type { TrafficLightsProps } from "./TrafficLights";

export { GlassInput } from "./GlassInput";
export type { GlassInputProps, GlassInputSize } from "./GlassInput";

export { GlassTextarea } from "./GlassTextarea";
export type { GlassTextareaProps } from "./GlassTextarea";
```

### Example 3: CSS Cleanup in globals.css

```css
/* REMOVE these sections after GradientGlow/GradientMesh deletion: */

/* Lines 193: --gradient-glow-coral (only GradientGlow used it) */
/* Lines 205-207: --glow-intensity-* tokens */
/* Lines 210-215: --color-gradient-* tokens -- VERIFY first, GlassPill may use */
/* Lines 289-322: @keyframes glow-float, glow-breathe, glow-drift */
/* Lines 328-338: .animate-glow-float, .animate-glow-breathe, .animate-glow-drift */
/* Lines 346-349: .glass-base (replaced by inline style) */
/* Lines 351-379: .glass-blur-xs through .glass-blur-2xl (stripped by Lightning CSS anyway) */
/* Lines 382-388: .glass-navbar -- VERIFY no consumers first */
/* Lines 391-399: Mobile blur media query */

/* KEEP: */
/* Lines 250-287: accordion, gradient-x, shimmer keyframes (used by other components) */
/* Line 340-342: .animate-shimmer (used by Skeleton component) */
```

### Example 4: Showcase Data Display Page Migration

```tsx
// BEFORE (uses primitives/GlassCard with GradientGlow dependency)
import { GlassCard } from "@/components/primitives";

<GlassCard blur={blur} className="relative">...</GlassCard>
<GlassCard blur="md" glow className="relative">...</GlassCard>

// AFTER (uses ui/card.tsx GlassCard)
import { GlassCard } from "@/components/ui/card";

<GlassCard blur={blur} className="relative">...</GlassCard>
<GlassCard blur="md" glow className="relative">...</GlassCard>
// API is compatible -- blur and glow props exist on ui/GlassCard too
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| iOS 26 Liquid Glass (tinted, multi-blur) | Raycast neutral glass (5px, no tint) | Phase 53-55 | GlassPanel simplified to zero-config |
| Funnel Display + Satoshi fonts | Inter for all text | Phase 53 | Already in globals.css, docs lag behind |
| Colored glass tints per feature | Neutral glass only | Phase 55 | Remove tintMap, GlassTint type |
| GradientGlow ambient lighting | No ambient lighting | Phase 55 | Hard delete component |
| GradientMesh backgrounds | No mesh backgrounds | Phase 55 | Hard delete component |
| Variable blur (2px-48px scale) | Fixed 5px blur | Phase 55 | Remove blur prop and blurPxMap |
| Inner glow on glass panels | No inner glow | Phase 55 | Remove innerGlow prop |

**Deprecated/outdated:**
- `GlassTint` type: deleted (no colored tints)
- `GlassBlur` type: deleted (fixed 5px)
- `GradientColor` type from GradientGlow: relocated to GlassPill as `PillColor`
- `colorMap` export from GradientGlow: deleted (was only used by GradientMesh)
- `tintMap` in GlassPanel: deleted
- `blurPxMap` in GlassPanel: deleted

## Open Questions

1. **`ui/card.tsx` GlassCard blur -- fixed or variable?**
   - What we know: `ui/card.tsx` GlassCard has `blur?: "sm" | "md" | "lg"` (8px/12px/20px). The CONTEXT says GlassPanel fixed 5px, but doesn't explicitly address `ui/card.tsx` GlassCard.
   - What's unclear: Should `ui/card.tsx` GlassCard also be fixed to 5px? Or keep variable since it's a different component?
   - Recommendation: Keep variable for now. The GlassCard in `ui/card.tsx` is a different component (a card, not a panel) and its blur values may intentionally differ. The CONTEXT.md decisions are about GlassPanel specifically. Flag for verification during regression.

2. **`--color-gradient-*` tokens -- can they be removed?**
   - What we know: These 6 tokens (lines 210-215 in globals.css) define oklch gradient palette colors. GradientGlow/GradientMesh used the `colorMap` from GradientGlow.tsx (not these tokens). GlassPill has its own hardcoded `colorValues` map.
   - What's unclear: Are these tokens used anywhere else via Tailwind classes (`text-gradient-purple`, etc.)?
   - Recommendation: Grep for `gradient-purple`, `gradient-blue`, etc. in all `.tsx` files before removing. If no Tailwind class consumers, remove.

3. **`glass-navbar` CSS class -- orphaned?**
   - What we know: Both `sidebar.tsx` (line 107-111) and `header.tsx` (line 61-64) use inline styles for the same effect. The `.glass-navbar` class has identical values.
   - What's unclear: Any other consumer?
   - Recommendation: Grep confirms no `.tsx` file uses `glass-navbar` as a className. Safe to remove.

4. **Showcase page restructuring depth**
   - What we know: `primitives-showcase` page is 80% GradientGlow content. Sections 2, 3, and part of 5 must be removed.
   - What's unclear: Should the page be fully rewritten or just have GradientGlow sections removed?
   - Recommendation: Remove GradientGlow/GradientMesh sections, update GlassPanel section to reflect simplified API, keep TrafficLights and shadows sections. No need for full rewrite.

## Sources

### Primary (HIGH confidence)

- **Codebase analysis:** Direct reading of all source files in `/Users/davideloreti/virtuna-v2.3.5-design-token/src/`
  - `src/components/primitives/GlassPanel.tsx` -- 169 lines, full component with 6 configurable props to remove
  - `src/components/primitives/GradientGlow.tsx` -- 112 lines, 4 consumer files identified
  - `src/components/primitives/GradientMesh.tsx` -- 112 lines, 0 external consumers (only barrel export + self)
  - `src/components/primitives/GlassCard.tsx` -- 139 lines, already `@deprecated`
  - `src/components/primitives/GlassPill.tsx` -- 141 lines, imports `GradientColor` type from GradientGlow
  - `src/components/primitives/index.ts` -- 24 lines, barrel exports for all primitives
  - `src/components/ui/card.tsx` -- 182 lines, has separate GlassCard implementation (Raycast-correct)
  - `src/app/globals.css` -- 414 lines, tokens + utility classes + keyframes
  - `src/components/app/sidebar.tsx` -- 204 lines, uses inline glass styles (correct)
  - `src/components/layout/header.tsx` -- 163 lines, uses inline glass styles (correct)
- **CONTEXT.md (Phase 55):** All implementation decisions locked by user discussion
- **MEMORY.md (user memory):** Raycast extraction values, Lightning CSS backdrop-filter issue, oklch compilation issue

### Secondary (MEDIUM confidence)

- **`BRAND-BIBLE.md` (repo root):** v2.0 with known inaccuracies (font: Satoshi, accent: listed inconsistently, border: 0.08 vs actual 0.06)
- **`.planning/BRAND-BIBLE.md`:** v1.0, completely outdated (iOS 26 direction, wrong accent color #E57850)
- **`docs/` directory:** 8 markdown files + 1 JSON spec, multiple contain outdated font/token references
- **`verification/` directory:** Existing Playwright and contrast audit scripts confirmed functional

### Tertiary (LOW confidence)

None -- all findings from direct codebase analysis.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools already installed in project
- Architecture: HIGH -- direct codebase reading, every file inspected
- Pitfalls: HIGH -- identified through actual import chain analysis and diff of documented vs actual values
- Code examples: HIGH -- based on CONTEXT.md locked decisions + current code structure

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (stable -- this is internal refactoring, not library-dependent)
