# Domain Pitfalls: Design Token Alignment

**Domain:** Design system token correction (Raycast 1:1)
**Researched:** 2026-02-06

## Critical Pitfalls

### Pitfall 1: oklch-to-Hex Compilation Inaccuracy in Tailwind v4

**What goes wrong:** Tailwind v4's `@theme` block compiles oklch values to hex at build time using Lightning CSS. For very dark colors (L < 0.15) and mid-range greys, the conversion produces visually different hex values than expected.
**Why it happens:** oklch is a perceptual color space. The conversion to sRGB hex is mathematically correct but perceptually surprising -- `oklch(0.90 0 0)` does NOT produce `#9c9c9d` (Raycast's grey-200). It produces something much lighter.
**Consequences:** Virtuna's current grey-200 through grey-300 are significantly lighter than Raycast's actual values, making surfaces and text appear washed out.
**Prevention:** Use exact hex values from Raycast's CSS for ALL grey scale tokens in `@theme`. Do not approximate with oklch.
**Detection:** Compare computed CSS values in DevTools against Raycast's documented hex values.

### Pitfall 2: Font Swap Breaking Existing Component Layouts

**What goes wrong:** Replacing Funnel Display + Satoshi with Inter changes character widths, x-heights, and ascender/descender ratios. Components sized to fit specific text may overflow or have excessive whitespace.
**Why it happens:** Different fonts have different metrics even at the same pixel size. Funnel Display is wider than Inter at heading sizes. Satoshi has different x-height than Inter.
**Consequences:** Heading text may wrap differently, card titles may truncate, and overall visual rhythm changes.
**Prevention:** After font swap, do a visual review of every page. Pay special attention to: headings that were at max width, card titles with fixed heights, navigation items in horizontal layouts.
**Detection:** Before/after screenshots of key pages. Automated visual regression if available.

### Pitfall 3: Lightning CSS Stripping backdrop-filter

**What goes wrong:** Lightning CSS (Tailwind v4's bundler) strips `backdrop-filter` and `-webkit-backdrop-filter` from CSS class definitions during compilation.
**Why it happens:** This is a known Lightning CSS behavior with the backdrop-filter property.
**Consequences:** Glass effects defined in CSS classes (like `.glass-blur-lg`) compile to empty rules. The blur effect silently disappears.
**Prevention:** Apply backdrop-filter via React inline styles: `style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}`. This bypasses CSS compilation entirely.
**Detection:** Inspect compiled CSS output. If `.glass-blur-*` classes are empty, this is the cause.

**NOTE:** This was already discovered and documented in the Virtuna project (2026-02-05). The current codebase may already handle this, but verify after any CSS refactor.

## Moderate Pitfalls

### Pitfall 4: Card Gradient Angle Change Affecting Glow Positioning

**What goes wrong:** Changing the card gradient from 180deg to 137deg changes how the background interacts with the card glow `:before` pseudo-element.
**Prevention:** After changing the gradient, verify that card glow effects still look correct. The glow is positioned at `top: -82px, left: 26%, width: 54%` and may need adjustment for the new gradient angle.

### Pitfall 5: Button Shadow Complexity Breaking with Tailwind Utilities

**What goes wrong:** Raycast's button shadows use 3-4 layers with sub-pixel values (e.g., `0.4px`). Tailwind's utility approach doesn't support multi-layer shadows well, and the `shadow-*` utilities override rather than compose.
**Prevention:** Define button shadows as complete CSS custom properties (e.g., `--shadow-button-light`, `--shadow-button-dark`) and apply via `shadow-[var(--shadow-button-light)]` or as component-level CSS classes.

### Pitfall 6: Browser Cache Persistence After Token Changes

**What goes wrong:** After changing CSS tokens, the browser (and Next.js dev server) cache old values. Changes appear not to take effect.
**Prevention:** Kill dev server + clear `.next/` directory + `node_modules/.cache/` + hard refresh browser (Cmd+Shift+R) after token changes. This is a recurring issue documented in the project.

### Pitfall 7: Grey Scale Semantic Mapping Confusion

**What goes wrong:** Raycast's grey scale numbering is INVERTED from typical design systems. Their `--grey-50` (#e6e6e6) is the LIGHTEST and `--grey-900` (#07080a) is the DARKEST. But Virtuna's current scale goes grey-50 (lightest) to grey-950 (darkest). Need to carefully map the equivalents.
**Prevention:** Create an explicit mapping table (included in STACK extraction) showing Virtuna token -> Raycast variable -> hex value. Do not assume number correspondence.

## Minor Pitfalls

### Pitfall 8: Missing Monospace Font

**What goes wrong:** Raycast uses JetBrains Mono and Geist Mono for code/mono text. Virtuna may not load these fonts.
**Prevention:** If monospace text is needed, add JetBrains Mono via Next.js font loading. For MVP, system monospace (`ui-monospace, SFMono-Regular, monospace`) is acceptable.

### Pitfall 9: Sub-Pixel Border Rendering

**What goes wrong:** Raycast uses `0.5px solid rgba(255,255,255,0.1)` for navigation separators. Not all browsers render 0.5px borders consistently.
**Prevention:** Use `1px` borders for Virtuna. The visual difference between 0.5px and 1px at 6-10% opacity is negligible.

### Pitfall 10: Responsive Font Size Cascade

**What goes wrong:** Raycast's hero heading scales from 36px (mobile) to 48px (tablet, 420px) to 64px (desktop, 720px). If not all breakpoints are defined, text may jump sizes abruptly.
**Prevention:** Define responsive font sizes at all breakpoints Raycast uses: 420px, 720px, and optionally 480px and 1080px.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Font swap | Component layout breakage | Visual review of all pages |
| Grey scale | oklch conversion mismatch | Use exact hex values |
| Card gradient | Glow positioning mismatch | Test glow pseudo-elements |
| Shadow system | Tailwind utility limitation | Use CSS custom properties |
| Body line-height | Text overflow in fixed-height containers | Review containers with max-height |
| Cleanup | Breaking components that reference removed tokens | Search codebase for all token references before removing |

## Sources

- Tailwind v4 Lightning CSS behavior: Discovered empirically in Virtuna project (2026-02-05)
- oklch compilation behavior: Discovered empirically in Virtuna project (2026-02-05)
- Browser cache persistence: Documented in project MEMORY.md
- All Raycast values: Extracted from raycast.com CSS files (see STACK-DESIGN-TOKEN-EXTRACTION.md)
