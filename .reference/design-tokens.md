# Design Tokens - Societies.io (Dark Mode)

## Typography

### Font Families
```css
--font-display: "Funnel Display", sans-serif;  /* Headings */
--font-body: Satoshi, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji";
```

### Font Sizes & Weights
| Element | Size | Weight | Line Height | Letter Spacing |
|---------|------|--------|-------------|----------------|
| H1 (Hero) | 52px | 350 | 62.4px (1.2) | normal |
| H2 (Section) | 40px | 350 | 44px (1.1) | normal |
| H3 (Card title) | 18px | 500 | 27px (1.5) | normal |
| Body/Para | 20px | 450 | 30px (1.5) | normal |
| Small text | 14px | 400 | 21px (1.5) | normal |
| Button | 14px | 500 | 21px | normal |
| Nav | 16px | 400 | 24px | normal |

### Blockquote
- Font: Satoshi (body font)
- Size: 20px
- Weight: 400
- Line height: 34px (1.7)

---

## Colors

### Text Colors
| Usage | RGB | Hex |
|-------|-----|-----|
| Primary (white) | rgb(255, 255, 255) | #FFFFFF |
| Secondary | rgb(245, 245, 245) | #F5F5F5 |
| Muted | rgb(204, 204, 204) | #CCCCCC |
| Accent (orange) | rgb(229, 120, 80) | #E57850 |
| Slate (icons) | rgb(112, 128, 144) | #708090 |

### Background Colors
| Usage | RGB | Hex |
|-------|-----|-----|
| Page background | rgb(13, 13, 13) | #0D0D0D |
| Card/elevated | rgb(26, 26, 26) | #1A1A1A |
| Overlay | rgba(0, 0, 0, 0.6) | - |
| Nav overlay | rgba(13, 13, 13, 0.667) | - |

### Accent Colors
| Usage | RGB | Hex |
|-------|-----|-----|
| Primary CTA | rgb(229, 120, 80) | #E57850 |
| Highlighted text | rgb(229, 120, 80) | #E57850 |

---

## Spacing

### Container
- Max width: ~1200px (varies by section)
- Padding (nav): 14px 32px
- Section padding: 48px 26px (varies)

### Component Spacing
- Feature card padding: 48px 26px
- H3 margin-bottom: 12px
- Button padding: 8px 16px

---

## Border Radius
| Usage | Value |
|-------|-------|
| Buttons | 4px |
| Cards | 8px (varies) |
| Avatars | 50% (circular) |

---

## Shadows
- Minimal use of shadows in dark mode
- Primary: none (flat design)

---

## Easing Functions (CSS Variables)
```css
--ease-out-quad: cubic-bezier(.25, .46, .45, .94);
--ease-out-cubic: cubic-bezier(.215, .61, .355, 1);
--ease-out-quart: cubic-bezier(.165, .84, .44, 1);
--ease-out-quint: cubic-bezier(.23, 1, .32, 1);
--ease-out-expo: cubic-bezier(.19, 1, .22, 1);
--ease-out-circ: cubic-bezier(.075, .82, .165, 1);
--ease-in-out-quad: cubic-bezier(.455, .03, .515, .955);
--ease-in-out-cubic: cubic-bezier(.645, .045, .355, 1);
--ease-in-out-quart: cubic-bezier(.77, 0, .175, 1);
--ease-in-out-quint: cubic-bezier(.86, 0, .07, 1);
--ease-in-out-expo: cubic-bezier(1, 0, 0, 1);
--ease-in-out-circ: cubic-bezier(.785, .135, .15, .86);
```

---

## Tailwind Mapping

```ts
// tailwind.config.ts additions
{
  colors: {
    background: '#0D0D0D',
    'background-elevated': '#1A1A1A',
    foreground: '#FFFFFF',
    'foreground-muted': '#CCCCCC',
    'foreground-secondary': '#F5F5F5',
    accent: '#E57850',
  },
  fontFamily: {
    display: ['"Funnel Display"', 'sans-serif'],
    sans: ['Satoshi', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
  },
  fontSize: {
    'hero': ['52px', { lineHeight: '62.4px', fontWeight: '350' }],
    'section': ['40px', { lineHeight: '44px', fontWeight: '350' }],
    'card-title': ['18px', { lineHeight: '27px', fontWeight: '500' }],
  }
}
```

---

## Fonts to Load
1. **Funnel Display** - Google Fonts or self-hosted
2. **Satoshi** - Fontshare (free) or self-hosted

```html
<!-- Satoshi from Fontshare -->
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap" rel="stylesheet">

<!-- Funnel Display - may need self-hosting or alternative -->
```
