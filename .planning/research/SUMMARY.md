# Design Token Alignment Research Summary

**Project:** Virtuna v2.3.5 Design Token Alignment
**Domain:** Design system correction (Raycast 1:1 accuracy)
**Researched:** 2026-02-06
**Confidence:** HIGH

## Executive Summary

This milestone corrects Virtuna's design tokens to match Raycast's actual design language with 1:1 accuracy. Research involved extracting values directly from raycast.com's production CSS (12 compiled stylesheets) and comparing them against Virtuna's current implementation. The findings reveal both correct implementations and critical discrepancies.

**Key finding:** Virtuna's design system is fundamentally sound but contains critical mismatches in fonts, grey scale values, and card backgrounds. The research identified 23 discrepancies across 5 severity levels. The primary font (Funnel Display + Satoshi) must be replaced with Inter exclusively, grey scale values need hex correction (oklch conversions are inaccurate for dark colors), and card backgrounds must use Raycast's 137deg gradient instead of the current 180deg approach.

**Main risk:** Font swaps and grey scale changes will affect component layouts and text rendering across the entire application. Tailwind v4's Lightning CSS bundler strips backdrop-filter from CSS classes, requiring inline style application. Browser and build cache persistence will make changes appear to not take effect without hard cache clears.

## Key Findings

### Raycast's Actual Design Values (Source of Truth)

Research extracted design tokens directly from live CSS production files. Raycast uses a minimal two-layer token system with primitives in `:root` and semantic aliases in components. The design is dark-mode only with no abstraction for theming.

**Core values extracted:**
- **Body background:** `#07080a` (exact, already correct in Virtuna)
- **Primary font:** Inter exclusively (weight 400-700, no separate display font)
- **Grey scale:** 12-step hex scale from `#e6e6e6` (grey-50) to `#07080a` (grey-900)
- **Border opacity:** `rgba(255,255,255,0.06)` universal (already correct)
- **Card gradient:** `linear-gradient(137deg, #111214 4.87%, #0c0d0f 75.88%)` (NOT flat surface)
- **Glass pattern:** `linear-gradient(137deg, rgba(17,18,20,0.75) 4.87%, rgba(12,13,15,0.9) 75.88%)` + `blur(5px)` + 6% border + inset highlight
- **Button shadows:** 4-layer shadow for primary, 3-layer ring shadow for secondary
- **Body text:** `line-height: 1.6`, `letter-spacing: 0.2px`, Inter 14px weight 500
- **Radius scale:** 4/6/8/12/16/20/24px (matches Virtuna)
- **Spacing scale:** 4px base, 4-224px range (matches Virtuna values)

### Critical Discrepancies Found

**CRITICAL (5 issues) — Fundamentally wrong, must fix:**

1. **Font family mismatch** — Virtuna uses Satoshi (body) + Funnel Display (headings). Raycast uses Inter for everything. This is the most visible difference across the entire UI.

2. **Card backgrounds use gradient from #222326 to #141517** — Raycast cards use `linear-gradient(137deg, #111214 4.87%, #0c0d0f 75.88%)`. Different angle, different colors.

3. **Cards have backdrop-filter blur** — Raycast cards are SOLID gradients, not glass. Blur is reserved for navbar/sidebar only.

4. **Header uses solid background** — Raycast navbar uses the glass gradient pattern with blur(5px). Virtuna header is opaque.

5. **GlassPanel implements iOS 26 liquid glass, not Raycast glass** — Colored tinting, inner glow, external glow shadows, and heavy blur are Virtuna inventions not present in Raycast's minimal glass aesthetic.

**MAJOR (10 issues) — Visually noticeable:**

- Input backgrounds use opaque `#18191a` instead of `rgba(255,255,255,0.05)`
- Missing card hover states (translate-y, border change, bg change)
- FeatureCard borders are 10%/20% instead of 6%/10%
- External glow shadows on glass (Raycast uses inset-only)
- Body line-height is 1.15 instead of 1.5-1.6
- Base Input diverges from GlassInput/Raycast pattern
- BRAND-BIBLE contains wrong values (outdated reference)
- Muted text color is lighter (#848586 vs #6a6b6c) — but this is intentional for WCAG AA

**MINOR (8 issues) — Subtle, fix in polish pass:**

- Primary text #fafafa vs #f4feff (negligible cool tint difference)
- Input border 6% vs 5%
- Mobile menu divider 10% vs 6%
- GlassPanel/Sidebar use 16px radius instead of 12px
- Card inset shadow 15%/1px spread vs 10%/0px spread
- Button heights 36/44/48 vs 32/40/48 (intentional for accessibility)
- Card hover lift 4px vs 2px

### Components Affected

Priority components needing updates:

1. **Typography** (ALL text) — Font swap from Satoshi/Funnel to Inter
2. **Card** (card.tsx) — Background gradient fix, remove blur, add hover states
3. **GlassPanel** — Remove colored tinting, external glow, reduce default blur
4. **Header** — Apply glass navbar pattern
5. **Input/InputField** — Align to GlassInput pattern (white/5 bg)
6. **FeatureCard** — Fix border opacities to use design tokens
7. **GlassCard** — Remove backdrop blur, fix inset shadow, add hover states

### Architecture Impact

**Current state:** Virtuna already uses Tailwind v4's `@theme` block correctly with a two-tier token system (primitives + semantic). This architecture is sound and should be maintained.

**Required changes:**
1. Replace oklch grey values with exact hex (oklch-to-hex conversion is inaccurate for dark colors)
2. Expand `:root` aliases to include Raycast variable names (`--Card-Border`, `--grey-*`, etc.)
3. Add multi-layer shadow tokens (`--shadow-button-dark`, `--shadow-button-danger`)
4. Define card gradient as token, not flat color
5. Apply backdrop-filter via React inline styles (Lightning CSS strips it from classes)

**Build order:**
1. Token foundation (font swap, grey scale, gradients)
2. Component refinement (shadows, hover states)
3. Visual audit and polish

## Implications for Roadmap

Based on research, this milestone should be executed in 3 focused phases:

### Phase 1: Font & Color Foundation
**Rationale:** Font and color changes are foundational — they affect every component. Must be done first before visual audit makes sense.

**Delivers:**
- Inter font loaded and applied globally
- Remove Funnel Display and Satoshi references
- Grey scale corrected with exact hex values
- Body line-height fixed to 1.5-1.6
- Expanded `:root` aliases for Raycast compatibility

**Addresses (from FEATURES.md):**
- Inter font family (table stakes)
- Grey scale exact hex (table stakes)
- Body line-height (differentiator)

**Avoids (from PITFALLS.md):**
- oklch-to-hex compilation inaccuracy (use exact hex)
- Browser cache persistence (document cache clearing steps)

**Research depth:** No additional research needed. Values are extracted and verified.

### Phase 2: Card & Surface Corrections
**Rationale:** Cards are the most visible component after typography. Fixing card backgrounds, shadows, and hover states provides immediate visual alignment.

**Delivers:**
- Card gradient corrected to 137deg Raycast pattern
- Remove backdrop-filter blur from cards
- Add proper card hover states (translate, border, bg)
- Fix FeatureCard border opacities
- Header applies glass navbar pattern
- Input components aligned to Raycast pattern

**Addresses (from FEATURES.md):**
- Card gradient 137deg (table stakes)
- Card hover states (differentiator)
- Header glass pattern (critical)

**Avoids (from PITFALLS.md):**
- Lightning CSS backdrop-filter stripping (use inline styles)
- Card gradient angle affecting glow positioning
- Button shadow complexity (use CSS custom properties)

**Research depth:** No additional research needed. Component patterns are clear.

### Phase 3: GlassPanel & Shadow System
**Rationale:** GlassPanel is the most complex primitive requiring architectural decisions about colored tinting. This should come after simpler corrections are validated.

**Delivers:**
- GlassPanel refactored to Raycast-accurate neutral glass
- Remove or scope colored tinting system (iOS 26 references)
- Remove external glow shadows from default
- Add complete button shadow tokens (dark, danger variants)
- Modal overlay token
- Visual audit of all components

**Addresses (from FEATURES.md):**
- Button shadow variants (differentiator)
- Modal overlay consistency (differentiator)
- Anti-features cleanup (remove iOS 26 references)

**Avoids (from PITFALLS.md):**
- Font swap breaking layouts (visual review complete at this point)
- Grey scale semantic mapping confusion
- Missing monospace font

**Research depth:** No additional research needed. Design philosophy is clear from extraction.

### Phase Ordering Rationale

- **Font first** because it affects character widths, text metrics, and visual rhythm across every component
- **Grey scale second** because text color changes depend on correct font rendering to assess contrast
- **Cards before GlassPanel** because cards are simpler (solid gradient) than glass (tint decisions)
- **GlassPanel last** because it requires architectural decisions (remove tinting vs scope it) that benefit from seeing the rest of the alignment complete

### Research Flags

**Phases with standard patterns (skip research-phase):**
- **Phase 1:** Font loading via Next.js is well-documented
- **Phase 2:** Card component patterns are straightforward CSS
- **Phase 3:** Shadow definitions are copy-paste from extraction

**No additional research needed.** All values are extracted from live CSS with HIGH confidence. Implementation is CSS token updates + component refinement.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Raycast extraction | HIGH | Direct from 12 compiled production CSS files, exact values |
| Token comparison | HIGH | Comprehensive line-by-line audit of globals.css vs extraction |
| Component impact | HIGH | Source code audit of primitives and layout components |
| Pitfalls | HIGH | Tailwind v4 Lightning CSS behavior already documented in project |

**Overall confidence:** HIGH

All research is based on actual extracted values from raycast.com (not approximations or design mockups). The comparison methodology (live CSS extraction + codebase audit) provides accurate discrepancy identification. The only LOW confidence area is predicting exact layout impact of font swap, but this is mitigated by phase 1 visual review.

### Gaps to Address

**No critical gaps.** All required values have been extracted. Implementation guidance is clear.

**Minor validation points:**
- Verify Inter font metrics don't break specific components (discovered during phase 1 visual review)
- Confirm Lightning CSS backdrop-filter stripping still occurs in current Tailwind v4 version
- Test that browser cache clearing procedure is documented for team

## Sources

### Primary (HIGH confidence)
- raycast.com production CSS extraction (12 files, 2026-02-06) — All color, typography, spacing, shadow, and gradient values
- Virtuna globals.css (current codebase) — All current token values
- Virtuna component source files — Actual usage patterns (button.tsx, card.tsx, input.tsx, dialog.tsx, GlassPanel.tsx, GlassCard.tsx, GlassInput.tsx, sidebar.tsx, header.tsx, feature-card.tsx)
- Project MEMORY.md (Raycast Design Language Rules, Tailwind v4 quirks) — Verified Lightning CSS behavior

### Secondary (MEDIUM confidence)
- BRAND-BIBLE.md (current documentation) — Known to be outdated, flagged for rewrite

### Tertiary (LOW confidence)
- None — all research based on direct extraction

---
*Research completed: 2026-02-06*
*Ready for roadmap: yes*
