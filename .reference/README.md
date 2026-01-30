# Societies.io Clone Reference

Extracted design specs and assets for 1:1 cloning.

## Structure

```
.reference/
├── README.md              # This file
├── design-tokens.md       # Colors, typography, spacing, easing
├── landing/
│   ├── hero.md            # Hero section specs
│   ├── backers.md         # Investors/backers section
│   ├── features.md        # 4-card features grid
│   ├── testimonials.md    # Case studies & quotes
│   ├── stats.md           # 86% accuracy section
│   ├── faq.md             # FAQ accordion
│   ├── cta.md             # Footer CTA + footer
│   └── _assets/
│       ├── landing-full-dark.png      # Full page (dark mode)
│       ├── hero-viewport.png          # Hero section
│       ├── features-viewport.png      # Features section
│       ├── testimonials-viewport.png  # Testimonials
│       ├── faq-viewport.png           # FAQ section
│       ├── footer-viewport.png        # Footer/CTA
│       ├── teneo-logo-dark.png        # Teneo case study logo
│       └── icons.md                   # SVG icons reference
└── app/
    └── _assets/           # (To be extracted - requires login)
```

## Quick Reference

### Colors (Dark Mode)
| Name | Hex | Usage |
|------|-----|-------|
| Background | `#0D0D0D` | Page bg |
| Elevated | `#1A1A1A` | Cards, sections |
| Foreground | `#FFFFFF` | Primary text |
| Muted | `#CCCCCC` | Secondary text |
| Accent | `#E57850` | CTAs, highlights |

### Typography
- **Display Font:** Funnel Display (headings)
- **Body Font:** Satoshi (text, buttons)
- **H1:** 52px / 350 weight / 1.2 line-height
- **H2:** 40px / 350 weight / 1.1 line-height
- **H3:** 18px / 500 weight / 1.5 line-height
- **Body:** 20px / 450 weight / 1.5 line-height

### Icons
All icons from **Phosphor Icons** (light weight):
- `Crosshair` - Unreachable audiences
- `Lightning` - Instant insights
- `UsersThree` - Millions of personas
- `Brain` - True understanding

## Cursor Workflow

### Per-Component Process
1. Open your component + reference `.md` file side-by-side
2. Open societies.io in browser alongside localhost
3. Feed both screenshots to Cursor Agent: "Make this match the reference"
4. Iterate in small chunks, verify visually each step

### Recommended Order

**Landing (polish first):**
1. Hero section (hero.md)
2. Navigation/header
3. Backers/investors (backers.md)
4. Features grid (features.md)
5. Testimonials/case studies (testimonials.md)
6. Stats/accuracy (stats.md)
7. FAQ accordion (faq.md)
8. Footer/CTA (cta.md)

**App (after login extraction):**
1. Sidebar navigation
2. Header/topbar
3. Society cards
4. Dashboard layout
5. Detail views

## Fonts Setup

```html
<!-- Add to layout or _document -->
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@400,450,500,700&display=swap" rel="stylesheet">
```

For Funnel Display, check Google Fonts or self-host.

## Icon Setup

```bash
pnpm add @phosphor-icons/react
```

```tsx
import { Lightning, Brain, UsersThree } from '@phosphor-icons/react';
<Lightning size={28} weight="light" />
```

## Status

- [x] Landing page extraction complete
- [ ] App pages extraction (requires login)
- [ ] Component-by-component implementation
