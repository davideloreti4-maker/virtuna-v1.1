# Raycast Design Token Extraction

**Extracted:** 2026-02-03
**Method:** Playwright MCP (real browser extraction)
**Source:** https://raycast.com (All Pages)
**Pages Extracted:**
- Homepage (raycast.com)
- Store (raycast.com/store)
- Pro (raycast.com/pro)
- AI (raycast.com/ai)
- Pricing (raycast.com/pricing)
- Teams (raycast.com/teams)
- iOS (raycast.com/ios)
- Windows (raycast.com/windows)
**Screenshots:** ./screenshots/

---

## Global Navbar

The navbar appears on all pages and uses glassmorphism effects.

### Navbar Container

- **Selector:** `.Navbar_container__x_wnu`
- **Position:** `fixed`
- **Top:** `0px`
- **Z-index:** `2`
- **Height:** `92px`
- **Padding:** `16px 16px 0px`
- **Background:** Transparent (glass effect on inner child)

### Navbar Inner (Glassmorphism Bar)

- **Selector:** `.Navbar_navbar__XlgWY`
- **Height:** `76px`
- **Max-width:** `1204px`
- **Display:** `flex`
- **Padding:** `16px 32px`
- **Border-radius:** `16px`

#### Glassmorphism Effect

- **Backdrop-filter:** `blur(5px)`
- **Background:** `linear-gradient(137deg, rgba(17, 18, 20, 0.75) 4.87%, rgba(12, 13, 15, 0.9) 75.88%)`
- **Border:** `1px solid rgba(255, 255, 255, 0.06)`
- **Box-shadow:** `rgba(255, 255, 255, 0.15) 0px 1px 1px 0px inset`

### Nav Links

- **Selector:** `.NavLink_navLink__REP72`
- **Color:** `rgb(156, 156, 157)` / `#9c9c9d`
- **Font-size:** `14px`
- **Font-weight:** `500`
- **Font-family:** `__Inter_f367f3, __Inter_Fallback_f367f3, sans-serif`
- **Padding:** `12px 8px`
- **Letter-spacing:** `0.2px`
- **Border-radius:** `6px`
- **Transition:** `0.2s ease-in-out`

### Download Button (Light variant)

- **Selector:** `.Button_button__JJiqJ.Button_light__KdYEB`
- **Background:** `rgb(230, 230, 230)` / `#e6e6e6`
- **Color:** `rgb(47, 48, 49)` / `#2f3031`
- **Font-size:** `14px`
- **Font-weight:** `500`
- **Padding:** `8px 12px`
- **Height:** `36px`
- **Border-radius:** `8px`
- **Box-shadow:** `rgba(0, 0, 0, 0.5) 0px 0px 0px 2px, rgba(255, 255, 255, 0.19) 0px 0px 14px 0px, rgba(0, 0, 0, 0.2) 0px -1px 0.4px 0px inset, rgb(255, 255, 255) 0px 1px 0.4px 0px inset`
- **Transition:** `background-image 0.2s, background-color 0.2s, box-shadow 0.2s ease-in-out, transform 0.1s ease-in-out`
- **Gap (icon-text):** `8px`

### Logo

- **Location:** First child in navbar
- **Container:** `.Navbar_logoContainer__enocR`

---

## Homepage

### Body / Page Background

- **Background-color:** `rgb(7, 8, 10)` / `#07080a`
- **Color (text):** `rgb(255, 255, 255)` / `#ffffff`
- **Font-family:** `__Inter_f367f3, __Inter_Fallback_f367f3, sans-serif`
- **CSS Variable:** `--background: #07080a`

### Hero Section

#### Hero Title (h1)

- **Text:** "Your shortcut to everything."
- **Font-size:** `64px`
- **Font-weight:** `600`
- **Font-family:** Inter (sans-serif)
- **Line-height:** `70.4px` (1.1 ratio)
- **Letter-spacing:** `normal`
- **Text-align:** `center`
- **Color:** `rgb(255, 255, 255)` / `#ffffff`
- **Max-width:** `540px`

#### Hero Subtitle

- **Text:** "A collection of powerful productivity tools all within an extendable launcher. Fast, ergonomic and reliable."
- **Font-size:** `18px`
- **Font-weight:** `400`
- **Line-height:** `normal`
- **Color:** `rgb(255, 255, 255)` / `#ffffff`
- **Text-align:** `center`

#### Hero Announcement Badge

- **Selector:** `.HeroAnnouncement_announcementContainer__hJe_K`
- **Font-size:** `16px`
- **Font-weight:** `400`
- **Color:** `rgb(255, 255, 255)`
- **Padding:** `40px 0px 0px`
- **Display:** `flex`

---

## Raycast Brand Color (To Replace with Coral)

**IMPORTANT:** This is the color we replace with `#FF7F50` (coral)

### Primary Brand Red

- **Value:** `rgb(255, 99, 99)` / `#ff6363`
- **Usage locations:**
  - Background color on accent elements
  - Text color on highlighted spans
  - Border color (with 25% opacity): `rgba(255, 99, 99, 0.25)`

### Secondary Brand Red (Deeper)

- **Value:** `rgb(215, 42, 42)` / `#d72a2a`
- **Usage:** Background tint on feature sections: `rgba(215, 42, 42, 0.02)`
- **Box-shadow:** `rgba(215, 42, 42, 0.07) 1px 1px 0px 0px inset`

---

## Hover States

### Button Hover (Light Button)

- **Before hover:**
  - Background: `rgb(230, 230, 230)`
  - Box-shadow: `rgba(0, 0, 0, 0.5) 0px 0px 0px 2px, rgba(255, 255, 255, 0.19) 0px 0px 14px 0px, rgba(0, 0, 0, 0.2) 0px -1px 0.4px 0px inset, rgb(255, 255, 255) 0px 1px 0.4px 0px inset`

- **After hover:**
  - Background: `rgb(230, 230, 230)` (same)
  - Box-shadow order changes (subtle reorder of shadow layers)
  - Note: Main interaction is via `transform 0.1s ease-in-out` (scale effect)

### Nav Link Hover

- **Before hover:**
  - Color: `rgb(156, 156, 157)` / `#9c9c9d`
  - Background: transparent
  - Opacity: `1`

- **After hover:**
  - Color: Likely brightens to white (CSS :hover pseudo-class)
  - Transition: `0.2s ease-in-out`

---

## Font Deep Dive

### @font-face Declarations

| Family | Weight | Source | Display |
|--------|--------|--------|---------|
| `__Inter_f367f3` | 100-900 | `/_next/static/media/*.woff2` | swap |
| `__Inter_Fallback_f367f3` | - | `local("Arial")` | - |
| `__JetBrains_Mono_3c557b` | 100-800 | `/_next/static/media/*.woff2` | swap |
| `__JetBrains_Mono_Fallback_3c557b` | - | `local("Arial")` | - |
| `__GeistMono_c1e5c9` | 100-900 | `/_next/static/media/*.woff2` | swap |

### Font Usage by Element

| Element | Font Family | Size | Weight | Line Height |
|---------|-------------|------|--------|-------------|
| h1 | Inter | 64px | 600 | 70.4px |
| h2 | Inter | 20px | 500 | normal |
| h3 | Inter | 24px | 500 | normal |
| h3 (large) | Inter | 56px | 400 | 65.52px |
| p (body) | Inter | 18px | 400 | normal |
| p (subtitle) | Inter | 20px | 500 | normal |
| p (small) | Inter | 16px | 500 | 25.6px |
| button | Inter | 14px | 500 | 16px |
| navLink | Inter | 14px | 500 | normal |

### Font Weights Used

- **300** (Light)
- **400** (Regular) - body text
- **500** (Medium) - nav links, buttons, subtitles
- **600** (Semibold) - h1 headlines
- **700** (Bold)

### Font Families Summary

- **Display/Headlines:** Inter (variable weight)
- **Body text:** Inter
- **Mono/Code:** JetBrains Mono, Geist Mono

---

## Glassmorphism Deep Dive

### Navbar Glass (Primary Pattern)

```css
.navbar-glass {
  backdrop-filter: blur(5px);
  background: linear-gradient(137deg, rgba(17, 18, 20, 0.75) 4.87%, rgba(12, 13, 15, 0.9) 75.88%);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  box-shadow: rgba(255, 255, 255, 0.15) 0px 1px 1px 0px inset;
}
```

### Feature Frame Glass

```css
.feature-frame {
  backdrop-filter: blur(2px);
  background: radial-gradient(85.77% 49.97% at 51% 5.12%, rgba(255, 148, 148, 0.11) 0px, rgba(222, 226, 255, 0.08) 45.83%, rgba(241, 242, 255, 0.02) 100%), rgba(0, 0, 0, 0.44);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 19px;
  box-shadow: rgba(255, 255, 255, 0.03) 0px 0px 40px 20px, rgba(255, 255, 255, 0.3) 0px 0.5px 0px 0px inset;
}
```

### Raycast Window Glass (Heavy Blur)

```css
.raycast-window {
  backdrop-filter: blur(36px);
  background-color: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(143, 141, 145, 0.2);
  border-radius: 12px;
  box-shadow: rgba(0, 0, 0, 0.4) 0px 4px 40px 8px, rgba(0, 0, 0, 0.8) 0px 0px 0px 0.5px, rgba(255, 255, 255, 0.3) 0px 0.5px 0px 0px inset;
}
```

### Dropdown Glass

```css
.dropdown {
  backdrop-filter: blur(36px);
  background-color: rgba(34, 34, 34, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
}
```

### Action Bar Glass

```css
.action-bar {
  backdrop-filter: blur(48px);
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 0px 0px 12px 12px;
}
```

### Dock Glass

```css
.dock {
  backdrop-filter: blur(10px);
  background: linear-gradient(181deg, rgba(0, 0, 0, 0.1) 4.5%, rgba(255, 255, 255, 0.03) 99.51%);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 20px;
  box-shadow: rgba(0, 0, 0, 0.2) 0px 0px 1px 0px, rgba(0, 0, 0, 0.17) 0px 2px 2px 0px, rgba(0, 0, 0, 0.1) 0px 4px 3px 0px, rgba(0, 0, 0, 0.03) 0px 7px 3px 0px;
}
```

### Tooltip Glass

```css
.tooltip {
  backdrop-filter: blur(8px);
  background: linear-gradient(137deg, rgb(17, 18, 20) 4.87%, rgb(12, 13, 15) 75.88%);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  box-shadow: rgba(0, 0, 0, 0.25) 0px 4px 4px 0px;
}
```

### Social Card Glass

```css
.social-card {
  backdrop-filter: blur(10px);
  background: linear-gradient(137deg, rgba(17, 18, 20, 0.75) 4.87%, rgba(12, 13, 15, 0.9) 75.88%);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  box-shadow: rgba(255, 255, 255, 0.15) 0px 1px 1px 0px inset;
}
```

### Snippet Glass

```css
.snippet {
  backdrop-filter: blur(15px);
  background: linear-gradient(137deg, rgba(17, 18, 20, 0.75) 4.87%, rgba(12, 13, 15, 0.9) 75.88%);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 0px 0px 12px 12px;
  box-shadow: rgba(0, 0, 0, 0.03) 0px 7px 3px 0px, rgba(0, 0, 0, 0.25) 0px 4px 4px 0px;
}
```

### Footer Glass

```css
.footer {
  backdrop-filter: blur(20px);
  background: linear-gradient(rgba(7, 8, 10, 0.8) 0.1%, rgb(7, 8, 10) 32.45%), radial-gradient(49.41% 64.58% at 49.4% 0px, rgba(255, 255, 255, 0.05) 0%, transparent 100%);
  box-shadow: rgba(0, 0, 0, 0.11) 0px -4px 10px 0px;
}
```

### Blur Value Summary

| Context | Blur Amount |
|---------|-------------|
| Navbar | 5px |
| Feature frames | 2px |
| Tooltips | 8px |
| Dock/Cards | 10px |
| Snippets | 15px |
| Footer | 20px |
| Windows/Dropdowns | 36px |
| Action bars | 48px |

---

## Homepage Sections (Top to Bottom)

### Section Container

- **Selector:** `.page_sectionContainer__86OJv`
- **Padding:** `224px 24px` (large vertical padding)

### Section Title Container

- **Selector:** `.SectionTitle_container__qvIRZ`
- **Margin-bottom:** `64px`

### Section Headings (h2)

- **Font-size:** `20px`
- **Font-weight:** `500`
- **Letter-spacing:** `0.2px`
- **Color:** `rgb(255, 255, 255)`
- **Text-align:** `center` (varies)

### Large Section Heading (h3 variant)

- **Font-size:** `56px`
- **Font-weight:** `400`
- **Line-height:** `65.52px`

### Body Paragraphs

| Variant | Size | Weight | Color | Line Height |
|---------|------|--------|-------|-------------|
| Primary | 18px | 400 | white | normal |
| Subtitle (muted) | 20px | 500 | `rgb(106, 107, 108)` / `#6a6b6c` | normal |
| Small | 16px | 500 | white | 25.6px (1.6) |

### Card Components

#### Extension Card

```css
.extension-card {
  background: linear-gradient(138deg, rgba(32, 35, 91, 0.7) 22%, rgba(7, 9, 33, 0.7) 82%);
  border-radius: 20px;
  box-shadow: rgba(255, 255, 255, 0.1) 0px 1px 0px 0px inset, rgba(7, 13, 79, 0.05) 0px 0px 20px 3px, rgba(7, 13, 79, 0.05) 0px 0px 40px 20px, rgba(255, 255, 255, 0.06) 0px 0px 0px 1px inset;
}
```

- **Padding (header):** `24px 24px 0px`

---

## Common Spacing Values

### Padding/Margin Scale

- `2px`
- `4px`
- `6px`
- `8px`
- `10px`
- `12px`
- `16px`
- `24px`
- `32px`
- `40px`
- `48px`
- `56px`
- `64px`
- `72px`
- `224px` (large section padding)

### Gap Values

- `8px` (common grid gap)

---

## Common Border Radius Values

- `2px` - tiny elements
- `4px` - small buttons
- `6px` - nav links, tooltips
- `8px` - buttons, dropdowns
- `12px` - cards, windows
- `16px` - navbar, containers
- `19px` - feature frames
- `20px` - extension cards, dock
- `36px` - highlight backdrops
- `1000px` / `100%` - pills/circles

---

## Color Summary

### Backgrounds

| Name | Value | Hex | Usage |
|------|-------|-----|-------|
| Page BG | `rgb(7, 8, 10)` | `#07080a` | Body background |
| Button Light BG | `rgb(230, 230, 230)` | `#e6e6e6` | Light buttons |
| Glass Dark | `rgba(17, 18, 20, 0.75)` | - | Glass gradient start |
| Glass Darker | `rgba(12, 13, 15, 0.9)` | - | Glass gradient end |
| Window BG | `rgba(0, 0, 0, 0.6)` | - | Raycast window |
| Dropdown BG | `rgba(34, 34, 34, 0.85)` | - | Dropdowns |

### Text Colors

| Name | Value | Hex | Usage |
|------|-------|-----|-------|
| Primary | `rgb(255, 255, 255)` | `#ffffff` | Headlines, body |
| Muted | `rgb(156, 156, 157)` | `#9c9c9d` | Nav links |
| Subtle | `rgb(106, 107, 108)` | `#6a6b6c` | Subtitles |
| Button Dark | `rgb(47, 48, 49)` | `#2f3031` | Button text on light |

### Brand Colors (Replace with Coral)

| Name | Value | Hex | Replacement |
|------|-------|-----|-------------|
| Raycast Red | `rgb(255, 99, 99)` | `#ff6363` | `#FF7F50` |
| Raycast Deep Red | `rgb(215, 42, 42)` | `#d72a2a` | Darker coral variant |

### Border Colors

| Name | Value | Usage |
|------|-------|-------|
| Glass Border | `rgba(255, 255, 255, 0.06)` | Most glass elements |
| Window Border | `rgba(143, 141, 145, 0.2)` | Raycast windows |
| Dropdown Border | `rgba(255, 255, 255, 0.2)` | Dropdowns |
| Feature Border | `rgba(255, 255, 255, 0.08)` | Feature frames |

---

## Screenshots Reference

| File | Description |
|------|-------------|
| `01-navbar.png` | Homepage with navbar visible |
| `02-homepage-hero.png` | Hero section |
| `03-button-hover.png` | Button hover state |
| `04-section-1.png` | First scrolled section |
| `04-section-2.png` | Second scrolled section |
| `04-section-3.png` | Third scrolled section (keyboard keys) |
| `04-section-4.png` | Fourth scrolled section |
| `04-section-5.png` | Fifth scrolled section |
| `04-section-6.png` | Sixth scrolled section (footer area) |

---

---

## Store Page (raycast.com/store)

### Hero Section

- **H1:** "Extensions"
- **Font-size:** `80px`
- **Font-weight:** `600`
- **Color:** `rgb(255, 255, 255)`

### Search Button

- **Background:** `rgb(12, 13, 15)` / `#0c0d0f`
- **Border:** `1px solid rgb(47, 48, 49)` / `#2f3031`
- **Border-radius:** `12px`

### Extension Cards

- **Border:** `1px solid rgba(255, 255, 255, 0.06)`
- **Border-radius:** `10px`
- **Padding:** `32px`

### Grid Layout

- **Gap:** `32px`
- **Grid-template-columns:** `358.664px 358.664px 358.664px` (3 equal columns)

---

## Pro Page (raycast.com/pro)

### Hero Section

- **H1:** "Raycast Pro"
- **Font-size:** `48px`
- **Font-weight:** `600`
- **Color:** `rgb(255, 255, 255)`

### Pro Badge

- **Color:** `rgb(170, 225, 255)` / cyan-tinted
- **Border-radius:** `16px`
- **Padding:** `6px 12px 6px 10px`

---

## AI Page (raycast.com/ai)

### Hero Section

- **H1 Font-size:** `48px`
- **Font-weight:** `600`
- **Color:** `rgb(255, 255, 255)`

### Section Headings (H2)

- **Font-size:** `32px`
- **Font-weight:** `500`
- **Color:** `rgb(255, 255, 255)`

---

## Pricing Page (raycast.com/pricing)

### Price Value

- **Font-size:** `64px`
- **Font-weight:** `600`
- **Color:** `rgb(255, 255, 255)`

### CTA Button (Light)

- **Background:** `rgb(230, 230, 230)` / `#e6e6e6`
- **Border-radius:** `8px`
- **Padding:** `8px 12px`

---

## Teams Page (raycast.com/teams)

### Hero Section

- **H1:** "Your team, reimagined."
- **Font-size:** `72px`
- **Font-weight:** `700`
- **Color:** `rgb(255, 255, 255)`

### Section Headings (H2)

- **Font-size:** `36px`
- **Font-weight:** `700`
- **Color:** `rgb(255, 255, 255)`

### CTA Button

- **Background:** `rgb(230, 230, 230)` / `#e6e6e6`
- **Color:** `rgb(47, 48, 49)` / `#2f3031`
- **Border-radius:** `8px`
- **Padding:** `8px 12px`

### Pill Badge (Announcement)

- **Color:** `rgb(255, 146, 23)` (orange accent)
- **Border-radius:** `16px`
- **Padding:** `8px 16px`
- **Border:** `1px solid rgba(255, 255, 255, 0.05)`

---

## iOS Page (raycast.com/ios)

### Hero Section

- **H1:** "Power of Raycast, now on iOS."
- **Font-size:** `48px`
- **Font-weight:** `600`
- **Color:** `rgb(255, 255, 255)`

### Section Headings (H2)

- **Font-size:** `32px`
- **Font-weight:** `500`
- **Color:** `rgb(255, 255, 255)`

### App Store Button

- **Border-radius:** `12px`
- **Padding:** `16px`
- **Border:** `1px solid rgba(255, 255, 255, 0.06)`

### Watch Video Button

- **Border-radius:** `8px`
- **Padding:** `8px 12px`

---

## Windows Page (raycast.com/windows)

### Hero Section

- **H1:** "A New Start" (decorative large text)
- **Font-size:** `168px`
- **Font-weight:** `400`
- **Color:** `rgb(255, 255, 255)`

### Section Headings (H2)

- **Font-size:** `20px`
- **Font-weight:** `500`
- **Color:** `rgb(255, 255, 255)`

### Download Button

- **Background:** `rgb(230, 230, 230)` / `#e6e6e6`
- **Color:** `rgb(47, 48, 49)` / `#2f3031`
- **Border-radius:** `8px`
- **Padding:** `8px 12px`

### Feature Card (article)

- **Border-radius:** `12px`
- **Border:** `1px solid rgba(255, 255, 255, 0.06)`

---

## Screenshots Reference (Updated)

| File | Description |
|------|-------------|
| `01-navbar.png` | Homepage with navbar visible |
| `02-homepage-hero.png` | Hero section |
| `03-button-hover.png` | Button hover state |
| `04-section-1.png` | First scrolled section |
| `04-section-2.png` | Second scrolled section |
| `04-section-3.png` | Third scrolled section (keyboard keys) |
| `04-section-4.png` | Fourth scrolled section |
| `04-section-5.png` | Fifth scrolled section |
| `04-section-6.png` | Sixth scrolled section (footer area) |
| `05-store-hero.png` | Store page hero |
| `05-store-cards.png` | Store page extension cards |
| `06-pro-hero.png` | Pro page hero |
| `07-ai-hero.png` | AI page hero |
| `08-pricing.png` | Pricing page |
| `09-teams.png` | Teams page hero |
| `10-ios.png` | iOS page hero |
| `11-windows.png` | Windows page hero |

---

## Typography Scale Summary (All Pages)

| Context | Size | Weight | Usage |
|---------|------|--------|-------|
| Display XL | 168px | 400 | Windows hero decorative |
| Display L | 80px | 600 | Store hero |
| Display M | 72px | 700 | Teams hero |
| H1 Standard | 64px | 600 | Homepage hero |
| H1 Medium | 48px | 600 | Pro, AI, iOS heroes |
| H2 Large | 36px | 700 | Teams sections |
| H2 Standard | 32px | 500 | AI sections |
| H2 Small | 20px | 500 | Windows sections |
| Price | 64px | 600 | Pricing values |
| Body | 18px | 400 | Paragraphs |
| Body Small | 16px | 500 | Small text |
| Button | 14px | 500 | All buttons |
| Nav | 14px | 500 | Navigation links |

---

## Next Steps for Implementation

1. **Replace brand color:** Swap `#ff6363` with `#FF7F50` (coral)
2. **Implement glassmorphism:** Use the documented blur levels and gradients
3. **Set up font stack:** Load Inter (variable) + JetBrains Mono
4. **Create spacing scale:** Based on extracted values
5. **Build component library:** Using extracted card, button, and glass styles
