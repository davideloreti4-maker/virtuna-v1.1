# WCAG AA Color Contrast Audit

**Date:** 2026-02-08
**Standard:** WCAG 2.1 Level AA
**Method:** Browser-computed RGB values extracted via Playwright getComputedStyle() on localhost:3000
**Tool:** wcag-contrast v3.0.0 (hex-based contrast ratio calculation)
**Note:** All color values are browser-rendered (not manual oklch conversion)

## Summary

| Metric | Count |
|--------|-------|
| Total combinations tested | 37 |
| Normal text AA pass (>=4.5:1) | 32 |
| Normal text AA fail (<4.5:1) | 5 |
| Large text AA pass (>=3:1) among failures | 5 |
| Large text AA fail (<3:1) | 0 |

**WCAG AA thresholds:**
- Normal text (< 24px / < 18.66px bold): requires **4.5:1**
- Large text (>= 24px / >= 18.66px bold): requires **3:1**

## Failures (Normal Text AA)

The following combinations do not meet the 4.5:1 ratio for normal text:

| Combination | FG Hex | BG Hex | Ratio | Score | Large Text (3:1) |
|-------------|--------|--------|-------|-------|-------------------|
| foreground-muted on surface-elevated | `#848586` | `#222326` | 4.25:1 | AA Large | PASS |
| error on surface | `#de3b3d` | `#18191a` | 4.02:1 | AA Large | PASS |
| error on surface-elevated | `#de3b3d` | `#222326` | 3.59:1 | AA Large | PASS |
| error on bg-elevated | `#de3b3d` | `#1a1b1e` | 3.94:1 | AA Large | PASS |
| info on surface-elevated | `#0088f2` | `#222326` | 4.34:1 | AA Large | PASS |

## Passes (Normal Text AA)

| Combination | FG Hex | BG Hex | Ratio | Score |
|-------------|--------|--------|-------|-------|
| foreground on background | `#f9f9f9` | `#07080a` | 19.03:1 | AAA |
| foreground on surface | `#f9f9f9` | `#18191a` | 16.72:1 | AAA |
| foreground on surface-elevated | `#f9f9f9` | `#222326` | 14.93:1 | AAA |
| foreground on bg-elevated | `#f9f9f9` | `#1a1b1e` | 16.36:1 | AAA |
| foreground-secondary on background | `#9c9c9d` | `#07080a` | 7.3:1 | AAA |
| foreground-secondary on surface | `#9c9c9d` | `#18191a` | 6.42:1 | AA |
| foreground-secondary on surface-elevated | `#9c9c9d` | `#222326` | 5.73:1 | AA |
| foreground-secondary on bg-elevated | `#9c9c9d` | `#1a1b1e` | 6.28:1 | AA |
| foreground-muted on background | `#848586` | `#07080a` | 5.42:1 | AA |
| foreground-muted on surface | `#848586` | `#18191a` | 4.76:1 | AA |
| foreground-muted on bg-elevated | `#848586` | `#1a1b1e` | 4.66:1 | AA |
| accent on background | `#f67d51` | `#07080a` | 7.6:1 | AAA |
| accent-hover on background | `#ff9670` | `#07080a` | 9.4:1 | AAA |
| accent on surface | `#f67d51` | `#18191a` | 6.68:1 | AA |
| accent-hover on surface | `#ff9670` | `#18191a` | 8.26:1 | AAA |
| accent on surface-elevated | `#f67d51` | `#222326` | 5.96:1 | AA |
| accent-hover on surface-elevated | `#ff9670` | `#222326` | 7.37:1 | AAA |
| accent on bg-elevated | `#f67d51` | `#1a1b1e` | 6.54:1 | AA |
| accent-hover on bg-elevated | `#ff9670` | `#1a1b1e` | 8.08:1 | AAA |
| accent-foreground on accent | `#1a0f0a` | `#f67d51` | 7.14:1 | AAA |
| success on background | `#46b250` | `#07080a` | 7.39:1 | AAA |
| success on surface | `#46b250` | `#18191a` | 6.49:1 | AA |
| success on surface-elevated | `#46b250` | `#222326` | 5.79:1 | AA |
| success on bg-elevated | `#46b250` | `#1a1b1e` | 6.35:1 | AA |
| warning on background | `#d9a514` | `#07080a` | 8.91:1 | AAA |
| warning on surface | `#d9a514` | `#18191a` | 7.83:1 | AAA |
| warning on surface-elevated | `#d9a514` | `#222326` | 6.99:1 | AA |
| warning on bg-elevated | `#d9a514` | `#1a1b1e` | 7.66:1 | AAA |
| error on background | `#de3b3d` | `#07080a` | 4.58:1 | AA |
| info on background | `#0088f2` | `#07080a` | 5.54:1 | AA |
| info on surface | `#0088f2` | `#18191a` | 4.87:1 | AA |
| info on bg-elevated | `#0088f2` | `#1a1b1e` | 4.76:1 | AA |

## Extracted Token Values

All values below are browser-computed RGB (via getComputedStyle) converted to hex.

| Token | Computed Value | Hex |
|-------|---------------|-----|
| `--color-background` | `rgb(7, 8, 10)` | `#07080a` |
| `--color-background-elevated` | `rgb(26, 27, 30)` | `#1a1b1e` |
| `--color-surface` | `rgb(24, 25, 26)` | `#18191a` |
| `--color-surface-elevated` | `rgb(34, 35, 38)` | `#222326` |
| `--color-foreground` | `rgb(249, 249, 249)` | `#f9f9f9` |
| `--color-foreground-secondary` | `rgb(156, 156, 157)` | `#9c9c9d` |
| `--color-foreground-muted` | `rgb(132, 133, 134)` | `#848586` |
| `--color-accent` | `lab(66.2924 45.1425 45.672)` | `#f67d51` |
| `--color-accent-hover` | `lab(73.4432 38.9311 38.3056)` | `#ff9670` |
| `--color-accent-foreground` | `rgb(26, 15, 10)` | `#1a0f0a` |
| `--color-success` | `lab(64.9191 -47.7528 40.1045)` | `#46b250` |
| `--color-warning` | `lab(71.1681 11.7208 71.0541)` | `#d9a514` |
| `--color-error` | `lab(51.5803 63.2457 38.9399)` | `#de3b3d` |
| `--color-info` | `lab(54.7815 -1.69867 -63.4783)` | `#0088f2` |
| `--color-border` | `rgba(255, 255, 255, 0.06)` | `#161718` |
| `--color-hover` | `rgba(255, 255, 255, 0.05)` | `#141516` |
| `--color-active` | `rgba(255, 255, 255, 0.1)` | `#202123` |
| `--color-disabled` | `rgba(128, 128, 128, 0.5)` | `#444445` |

## Methodology

1. Launched headless Chromium via Playwright
2. Navigated to http://localhost:3000 (dev server)
3. Extracted CSS custom property raw values via `getComputedStyle(document.documentElement).getPropertyValue()`
4. Resolved each value to sRGB via Canvas 2D API (`fillRect` + `getImageData`) to handle oklch/lab formats
5. Converted pixel RGBA data to hex values
6. For RGBA tokens (borders, states), composited against `--color-background` (#07080a) as base
7. Computed contrast ratios using `wcag-contrast` hex() function
8. Evaluated against WCAG 2.1 Level AA thresholds

**Note:** This audit documents findings only. It does not modify component code. Any failures are noted for a future fix phase.
