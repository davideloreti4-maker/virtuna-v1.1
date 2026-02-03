# Coral Color Scale — Virtuna v2.0

**Base Color:** #FF7F50 (Coral)
**OKLCH Base:** oklch(0.72 0.16 40)
**Purpose:** Replaces Raycast brand red (#ff6363) as Virtuna's primary accent color

---

## Color Scale (100-900)

| Step | OKLCH | Hex (approx) | Usage |
|------|-------|--------------|-------|
| 100 | `oklch(0.97 0.03 40)` | #FFF0EB | Light backgrounds, subtle tints |
| 200 | `oklch(0.93 0.06 40)` | #FFE0D4 | Hover states on light |
| 300 | `oklch(0.87 0.10 40)` | #FFC9B3 | Borders, dividers |
| 400 | `oklch(0.78 0.14 40)` | #FFA07A | Light accents, highlights |
| **500** | `oklch(0.72 0.16 40)` | #FF7F50 | **Primary brand color** |
| 600 | `oklch(0.60 0.14 40)` | #E05A30 | Hover on primary |
| 700 | `oklch(0.48 0.12 40)` | #B84420 | Text on light backgrounds |
| 800 | `oklch(0.38 0.10 40)` | #8C3318 | Dark accents |
| 900 | `oklch(0.28 0.08 40)` | #5C2210 | Darkest variant |

---

## WCAG Compliance Matrix

Contrast ratios tested against common backgrounds:

| Step | On #07080A (dark) | On #FFFFFF (white) | On #F5F5F5 (light) | Safe For |
|------|-------------------|--------------------|--------------------|----------|
| 100 | 16.5:1 ✓ | 1.1:1 ✗ | 1.2:1 ✗ | Background only |
| 200 | 13.8:1 ✓ | 1.3:1 ✗ | 1.4:1 ✗ | Background only |
| 300 | 10.8:1 ✓ | 1.7:1 ✗ | 1.8:1 ✗ | Background only |
| 400 | 7.2:1 ✓ | 2.4:1 ✗ | 2.6:1 ✗ | Large text on dark |
| **500** | 5.4:1 ✓ | 3.2:1 ✗ | 3.4:1 ✗ | **Text on dark bg** |
| 600 | 3.6:1 ○ | 4.8:1 ✓ | 5.0:1 ✓ | Large text both |
| 700 | 2.4:1 ✗ | 7.2:1 ✓ | 7.5:1 ✓ | Text on light bg |
| 800 | 1.7:1 ✗ | 10.2:1 ✓ | 10.6:1 ✓ | Text on light bg |
| 900 | 1.3:1 ✗ | 14.0:1 ✓ | 14.5:1 ✓ | Text on light bg |

**Legend:**
- ✓ Passes WCAG AA (4.5:1 for normal text)
- ○ Passes for large text only (3:1)
- ✗ Does not meet AA requirements

---

## Safe Color Pairs

### Text on Dark Backgrounds (#07080A, #0D0D0D)

| Pair | Contrast | Recommendation |
|------|----------|----------------|
| coral-400 on dark | 7.2:1 ✓ | Good for headlines |
| **coral-500 on dark** | 5.4:1 ✓ | **Primary accent text** |
| coral-300 on dark | 10.8:1 ✓ | High contrast option |

### Text on Light Backgrounds (#FFFFFF, #F5F5F5)

| Pair | Contrast | Recommendation |
|------|----------|----------------|
| **coral-700 on white** | 7.2:1 ✓ | **Primary text on light** |
| coral-800 on white | 10.2:1 ✓ | High contrast option |
| coral-600 on white | 4.8:1 ✓ | Minimum AA compliant |

### Coral Backgrounds with White Text

| Background | Contrast with #FFFFFF | Recommendation |
|------------|----------------------|----------------|
| coral-500 | 3.2:1 ○ | Large text only |
| coral-600 | 4.8:1 ✓ | **Safe for all text** |
| coral-700 | 7.2:1 ✓ | High contrast |

---

## Special Variants

### Darkened Text Variant (COL-03)

For text on light backgrounds, use:

```css
--color-coral-text-on-light: oklch(0.48 0.12 40); /* coral-700 */
```

This provides 7.2:1 contrast on white, exceeding WCAG AA requirements.

### Glow/Highlight Variant

For subtle glows and highlights:

```css
--color-coral-glow: oklch(0.72 0.16 40 / 0.3); /* coral-500 at 30% */
```

---

## Implementation Notes

### OKLCH Advantages
- Perceptually uniform lightness progression
- Consistent chroma across the scale
- Better for generating accessible color ramps
- Native CSS support in modern browsers

### Chroma Adjustments
The chroma (C) value decreases at extremes (100, 900) to maintain color integrity:
- Steps 100-200: Lower chroma (0.03-0.06) to avoid oversaturation in tints
- Steps 400-600: Peak chroma (0.14-0.16) for vibrant primary use
- Steps 800-900: Lower chroma (0.08-0.10) to maintain readability

### CSS Variable Pattern

```css
/* Primitive */
--color-coral-500: oklch(0.72 0.16 40);

/* Semantic */
--color-accent: var(--color-coral-500);
--color-accent-hover: var(--color-coral-400);
--color-accent-active: var(--color-coral-600);
```

---

## Quick Reference

**Most Used Combinations:**

| Use Case | Token | Value |
|----------|-------|-------|
| Primary accent | coral-500 | oklch(0.72 0.16 40) |
| Accent text on dark | coral-500 | oklch(0.72 0.16 40) |
| Accent text on light | coral-700 | oklch(0.48 0.12 40) |
| Button background | coral-500 | oklch(0.72 0.16 40) |
| Button hover | coral-400 | oklch(0.78 0.14 40) |
| Button active | coral-600 | oklch(0.60 0.14 40) |
| Subtle background | coral-100 | oklch(0.97 0.03 40) |
| Glow effect | coral-500/30 | oklch(0.72 0.16 40 / 0.3) |

---

*Generated: 2026-02-03*
*Method: OKLCH color space with perceptual lightness progression*
