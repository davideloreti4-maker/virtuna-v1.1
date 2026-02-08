# Raycast Design Extraction

**Source:** raycast.com live CSS (12 stylesheet files)
**Extracted:** 2026-02-06
**Confidence:** HIGH -- values extracted directly from compiled production CSS
**Method:** WebFetch of all 12 `_next/static/css/*.css` files from raycast.com

---

## 1. CSS Custom Properties (`:root` / Theme Variables)

### Color Scale: Grey

Extracted from `:root` in `5038a0f8e1dbb537.css`.

| Variable | Value | Hex | Context |
|----------|-------|-----|---------|
| `--Base-White` | `#ffffff` | `#ffffff` | Primary text, bright elements |
| `--Base-Black` | `#000000` | `#000000` | Shadows, overlays |
| `--grey-50` | `#e6e6e6` | `#e6e6e6` | Light button background |
| `--grey-100` | `#cdcece` | `#cdcece` | Muted text, secondary labels |
| `--grey-200` | `#9c9c9d` | `#9c9c9d` | Secondary text, descriptions |
| `--grey-300` | `#6a6b6c` | `#6a6b6c` | Dimmed/muted text |
| `--grey-400` | `#434345` | `#434345` | Disabled text, tertiary |
| `--grey-500` | `#2f3031` | `#2f3031` | Command input bg, dark UI chrome |
| `--grey-600` | `#1b1c1e` | `#1b1c1e` | Dividers, footer borders |
| `--grey-700` | `#111214` | `#111214` | Card backgrounds (gradient end) |
| `--grey-800` | `#0c0d0f` | `#0c0d0f` | Card backgrounds (gradient start), radial gradient centers |
| `--grey-900` | `#07080a` | `#07080a` | **Body background** -- THE canonical dark bg |

### Derived Theme Colors

| Variable | Value | Context |
|----------|-------|---------|
| `--background` | `var(--grey-900)` | Page background = `#07080a` |
| `--font-color-rgb` | `255,255,255` | Used in `rgba(var(--font-color-rgb), opacity)` |
| `--lines-color-rgb` | `255,255,255` | Used for border/separator calculations |
| `--blue-dark` | `#56c2ff` | Blue accent |
| `--red-dark` | `rgba(255,99,99,1)` / `#ff6363` | Error/danger text |
| `--Red-Default` | `#ff6363` | Error text color |
| `--Red-Dim` | `#833637` | Error border color |
| `--Red-Muted` | `#2c1617` | Error button background |
| `--Red-Faint` | `#130d0e` | Error button hover background |

### Accent/Feature Colors (from CSS usage patterns)

| Color | Hex | Context |
|-------|-----|---------|
| Success green | `#59d499` | State messages, success indicators |
| Success green bg | `rgba(89,212,153,0.15)` | Success background tint |
| Purple accent | `#d8acff` | Feature highlights, AI elements |
| Purple bg | `rgba(164,133,255,0.15)` or `rgba(216,172,255,0.15)` | Purple pill backgrounds |
| Light blue | `#aae1ff` | Pro badge, waitlist elements |
| Completion blue | `#8cd6ff` | AI completion text |
| Completion blue bg | `linear-gradient(90deg,rgba(86,194,255,0.16) 1.41%,rgba(86,194,255,0.06) 98.59%)` | AI completion background |
| Green accent | `#85e0b4` | Feature highlights |
| Orange accent | `#ff9217` | Warnings |
| Orange bg | `rgba(255,146,23,0.15)` | Warning backgrounds |
| Error red | `#ff6363` | Error messages |
| Error red light | `#f28c8c` | Error accent variant |

### Semantic Text Variables (from fallback patterns in CSS)

| Variable | Fallback Value | Context |
|----------|----------------|---------|
| `--primaryText` | `var(--Base-White, #fff)` | Primary text |
| `--secondaryText` | `rgba(255,255,255,0.6)` | Secondary text |
| `--tertiaryText` | `rgba(255,255,255,0.4)` | Placeholder, hint text |
| `--Text-Default` | `var(--grey-200)` = `#9c9c9d` | Default body text |
| `--Text-Loud` | `var(--Base-White, #fff)` | Emphasized text |
| `--separatorColor` | `rgba(255,255,255,0.1)` | Navigation bar separators |
| `--controlBackground` | `rgba(255,255,255,0.1)` | Interactive control backgrounds |

---

## 2. Typography

### Font Families

| Variable | Value | Usage |
|----------|-------|-------|
| `--main-font` | `var(--font-inter), sans-serif` | **Primary font for everything** |
| `--monospace-font` | `var(--font-jetbrains-mono), Menlo, Monaco, Courier, monospace` | Code, mono elements |
| `--font-geist-mono` | Geist Mono (loaded via Next.js) | Error messages, counts |
| `--font-instrument-serif` | Instrument Serif | Decorative/quote text (rare) |
| `"SF Pro Text"` | System font | In-app mockup components only |

**Key insight:** Raycast uses **Inter** as their sole primary font. No display/heading font variant. Headings are differentiated by weight and size only.

### Font Sizes (Complete Scale)

| Size | Where Used |
|------|-----------|
| `8px` | Tiny mobile labels (keyboard keys) |
| `10px` | Avatar handles, small badges |
| `11px` | Small UI labels (mobile nav) |
| `12px` | Captions, error messages, labels, section titles, testimonial names |
| `13px` | Body small, browse more text, list items, command input |
| `14px` | **Standard body text**, buttons, inputs, section descriptions |
| `15px` | Navigation bar text (mobile) |
| `16px` | Larger body, modal title, section text, alert descriptions |
| `18px` | Section descriptions (desktop), navigation bar (desktop responsive) |
| `20px` | Member names, slider titles, list items (desktop), sub-headings |
| `24px` | Page headers, sub-section headers |
| `28px` | Navigation text (desktop) |
| `30px` | Section headers |
| `32px` | Large section headers |
| `36px` | Centered section headers, hero h1 (mobile) |
| `44px` | Large headers |
| `48px` | Section headers (desktop), hero h1 (tablet) |
| `56px` | Large display headers |
| `64px` | Hero heading (720px+ desktop) |
| `72px` | Hero heading (desktop max) |
| `168px` | Oversized decorative display |

### Font Weights

| Weight | Usage |
|--------|-------|
| `400` | Regular body text, descriptions, navigation items |
| `500` | **Default/medium** -- buttons, inputs, list items, section labels, most UI |
| `600` | Semi-bold -- headings (h1, h2), section headers, names, emphasis |
| `700` | Bold -- hero headlines, strong emphasis |
| `900` | Extra bold -- quote marks (decorative only) |

### Line Heights

| Value | Context |
|-------|---------|
| `1` / `normal` | Tight spacing, single-line labels |
| `110%` / `1.1` | Hero headlines |
| `14px` | Small text (captions) |
| `16px` | Small body text |
| `18px` | Back links |
| `20px` | Standard body, list items |
| `24px` | Larger body, descriptions |
| `28px` | Section headers |
| `36px` | Large headers |
| `40px` | Centered headers |
| `140%` / `1.4` | Modal titles |
| `150%` / `1.5` | Body text relative |
| `160%` / `1.6` | **Primary body text line-height** |
| `175%` / `1.75` | Quote text |

### Letter Spacing

| Value | Context |
|-------|---------|
| `-0.05px` | Negative tracking on some headers |
| `0.01px` | Minimal tracking |
| `0.1px` | Section titles, list items, alert text, navigation |
| **`0.2px`** | **Standard body text** -- used on body element and most text |
| `0.3px` | Monospace text, subscription forms |
| `0.4px` | Subscription form specific |

---

## 3. Spacing Scale

### CSS Custom Properties

| Variable | Value | Notes |
|----------|-------|-------|
| `--spacing-none` | `0px` | |
| `--spacing-0-5` | `4px` | Tiny spacing, icon gaps |
| `--spacing-1` | `8px` | Small gaps, button icon spacing |
| `--spacing-1-5` | `12px` | Medium, button padding |
| `--spacing-2` | `16px` | Standard padding |
| `--spacing-2-5` | `20px` | |
| `--spacing-3` | `24px` | Card padding, section gaps |
| `--spacing-4` | `32px` | Large padding, section margins |
| `--spacing-5` | `40px` | Extra large, margin-bottom |
| `--spacing-6` | `48px` | Section content padding |
| `--spacing-7` | `56px` | Huge gap |
| `--spacing-8` | `64px` | Section dividers |
| `--spacing-9` | `80px` | Large section margins |
| `--spacing-10` | `96px` | Page-level margins |
| `--spacing-11` | `112px` | |
| `--spacing-12` | `168px` | Section container padding |
| `--spacing-13` | `224px` | Page top padding |

### Layout Variables

| Variable | Value | Context |
|----------|-------|---------|
| `--container-xs-width` | `746px` | Small content containers |
| `--container-sm-width` | `1064px` | Medium content areas |
| `--container-width` | `1204px` | **Primary container** |
| `--container-lg-width` | `1280px` | Wide layouts |
| `--grid-gap` | `32px` | Grid spacing |
| `--navbar-width` | `var(--container-width)` | Navbar matches container |

### Observed Padding Patterns

| Component | Padding | Notes |
|-----------|---------|-------|
| Button base | `var(--spacing-1) var(--spacing-1-5)` | 8px 12px |
| Modal content | `var(--spacing-3)` to `var(--spacing-4)` | 24px to 32px responsive |
| List items | `0 var(--spacing-1)` to `0 var(--spacing-2)` | 0 8px to 0 16px |
| Section titles | `var(--spacing-1-5) var(--spacing-1)` | 12px 8px |
| Card content | `var(--spacing-3)` to `var(--spacing-6)` | 24px to 48px |
| Container (mobile) | `16px` sides | |
| Container (desktop) | `0` (centered with max-width) | |

### Observed Gap Patterns

| Context | Gap |
|---------|-----|
| Icon to text | `var(--spacing-0-5)` to `var(--spacing-1)` = 4-8px |
| Button content | `var(--spacing-1)` = 8px |
| List items | `var(--spacing-1-5)` = 12px |
| Card sections | `var(--spacing-2)` to `var(--spacing-3)` = 16-24px |
| Grid columns | `var(--spacing-4)` = 32px |
| Large sections | `var(--spacing-5)` to `var(--spacing-8)` = 40-64px |

---

## 4. Border Radius

### CSS Custom Properties

| Variable | Value | Usage |
|----------|-------|-------|
| `--rounding-none` | `0px` | No rounding |
| `--rounding-xs` | `4px` | Keyboard keys, small badges, tiny elements |
| `--rounding-sm` | `6px` | List items, command input, emoji picker, small buttons |
| **`--rounding-normal`** | **`8px`** | **Buttons, standard inputs** -- default rounding |
| `--rounding-md` | `12px` | **Cards**, modals, panels, slider containers |
| `--rounding-lg` | `16px` | Pills, modal dialogs, larger containers |
| `--rounding-xl` | `20px` | Extension cards, large containers |
| `--rounding-xxl` | `24px` | Jumbo containers |
| `--rounding-full` | `100%` | Avatars, circular elements |

### Context-Specific Usage

| Component | Radius | Variable |
|-----------|--------|----------|
| Buttons | 8px | `--rounding-normal` |
| Cards | 12px | `--rounding-md` |
| Modal dialogs | 16px | `--rounding-lg` |
| Inputs | 8px | `--rounding-normal` |
| List items | 6px | `--rounding-sm` |
| Keyboard keys | 4px | `--rounding-xs` |
| Extension cards | 20px | `--rounding-xl` |
| Browse more card | 22px | hardcoded |
| Pills/badges | 16px | `--rounding-lg` |
| Avatars | 50% / 99999px | `--rounding-full` |
| Snippets address | mixed (0 top, 12px bottom) | `--rounding-none` / `--rounding-md` |

---

## 5. Shadows

### Card Inset Highlight (universal pattern)

The signature Raycast card pattern: a subtle white inset shadow at the top edge.

```css
/* Standard card inset -- used on virtually every card/panel */
box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.1);

/* Glass panel / social card variant (slightly brighter) */
box-shadow: inset 0 1px 1px 0 rgba(255, 255, 255, 0.15);
```

### Button Shadows

**Light button (primary CTA):**
```css
box-shadow:
  0 0 0 2px rgba(0, 0, 0, 0.5),        /* outer ring */
  0 0 14px 0 rgba(255, 255, 255, 0.19), /* glow */
  inset 0 -1px 0.4px 0 rgba(0, 0, 0, 0.2),  /* bottom inner */
  inset 0 1px 0.4px 0 #fff;             /* top highlight */
```

**Dark button (secondary):**
```css
/* Default */
box-shadow:
  inset 0 1px 0 0 rgba(255, 255, 255, 0.05),
  0 0 0 1px rgba(255, 255, 255, 0.25),
  inset 0 -1px 0 0 rgba(0, 0, 0, 0.2);

/* Hover */
box-shadow:
  inset 0 1px 0 0 rgba(255, 255, 255, 0.05),
  0 0 0 1px rgba(255, 255, 255, 0.5),   /* ring brightens */
  inset 0 -1px 0 0 rgba(0, 0, 0, 0.2);

/* Active */
box-shadow:
  inset 0 1px 0 0 rgba(255, 255, 255, 0.05),
  0 0 0 1px rgba(255, 255, 255, 0.15),  /* ring dims */
  inset 0 -1px 0 0 rgba(0, 0, 0, 0.2);

/* Focus */
box-shadow:
  inset 0 1px 0 0 rgba(255, 255, 255, 0.05),
  0 0 0 2px rgba(255, 255, 255, 0.5),   /* thicker ring */
  inset 0 -1px 0 0 rgba(0, 0, 0, 0.2);
```

**Danger button:**
```css
/* Default */
box-shadow:
  inset 0 1px 0 0 rgba(255, 127, 127, 0.11),
  0 0 0 1px #833637,
  inset 0 -1px 0 0 rgba(0, 0, 0, 0.2);

/* Active */
box-shadow: 0 0 0 1px #2c1617;

/* Focus */
box-shadow:
  0 0 0 1px #833637,
  inset 0 1px 0 0 rgba(255, 127, 127, 0.11),
  0 0 0 2px rgba(255, 255, 255, 0.25),
  inset 0 -1px 0 0 rgba(0, 0, 0, 0.2);
```

### AI Chat Window / Heavy Modal Shadow

```css
box-shadow:
  0 4px 40px 8px rgba(0, 0, 0, 0.4),
  0 0 0 0.5px rgba(0, 0, 0, 0.8),
  inset 0 0.5px 0 0 rgba(255, 255, 255, 0.3);
```

### Snippet/Card Drop Shadow

```css
box-shadow:
  0 7px 3px 0 rgba(0, 0, 0, 0.03),
  0 4px 4px 0 rgba(0, 0, 0, 0.25);
```

### Footer Shadow

```css
box-shadow: 0 -4px 10px 0 rgba(0, 0, 0, 0.11);
```

### Browse More Card Hover Shadow

```css
box-shadow: 0 0 24px 8px rgba(255, 255, 255, 0.05);
```

### Text Shadows

| Context | Value |
|---------|-------|
| Hero heading | `0 4px 4px rgba(0, 0, 0, 0.15)` |
| Hero paragraph | `0 4px 4px rgba(0, 0, 0, 0.25)` |
| Dark text shadow | `0 1px 4px rgba(0, 0, 0, 0.75)` |
| Subtle text shadow | `0 0 4px rgba(0, 0, 0, 0.25)` |

### Focus Outlines

```css
/* Standard focus-visible */
outline: 2px solid rgba(255, 255, 255, 0.2);
outline-offset: 8px;

/* Focus-visible for buttons */
box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.5);
```

---

## 6. Borders

### Universal Border Opacities

| Opacity | RGBA | Context |
|---------|------|---------|
| **6%** | `rgba(255, 255, 255, 0.06)` | **Default card/panel border** -- THE universal border |
| **5%** | `rgba(255, 255, 255, 0.05)` | Subtle borders, input borders, button inset highlight |
| **10%** | `rgba(255, 255, 255, 0.1)` | Hover state borders, separator lines, selected items, emoji picker, navigation separator |
| **12%** | `rgba(255, 255, 255, 0.12)` | Feature card hover state |
| **15%** | `rgba(255, 255, 255, 0.15)` | Pill borders, prominent borders |
| **25%** | `rgba(255, 255, 255, 0.25)` | Dark button ring (default) |
| **50%** | `rgba(255, 255, 255, 0.5)` | Dark button ring (hover/focus) |

### Component-Specific Borders

| Component | Border | Notes |
|-----------|--------|-------|
| Card (default) | `1px solid rgba(255,255,255,0.06)` | `--Card-Border` variable |
| Card (hover) | `border-color: rgba(255,255,255,0.12)` | Subtle brightening |
| Navigation separator | `0.5px solid rgba(255,255,255,0.1)` | Half-pixel separator |
| Footer divider | `1px solid var(--grey-600)` = `#1b1c1e` | Solid dark |
| Avatar border | `1px solid var(--grey-600)` = `#1b1c1e` | |
| Input border | `1px solid rgba(255,255,255,0.05)` | Subtle |
| Error input border | `1px solid rgba(255,59,48,0.3)` | Red at 30% |
| Error border (button) | `1px solid var(--Red-Dim, #833637)` | |
| Pill border | `1px solid rgba(255,255,255,0.15)` | |
| Purple accent border | `1px solid #d8acff` | Feature highlight |
| CTA button ring | `3px solid rgba(255,255,255,0.3)` | Thick ring |
| Modal/dialog | `1px solid var(--Card-Border, rgba(255,255,255,0.06))` | Same as cards |
| AI chat window | `1px solid rgba(142,140,144,0.4)` | Special modal border |
| Keyboard key | `0.5px solid rgba(255,255,255,0.4)` mobile, `1px` desktop | |

---

## 7. Glass / Blur Patterns

### Backdrop Filter Values

| Blur | Context |
|------|---------|
| `blur(2px)` | Minimal blur, subtle glass |
| **`blur(5px)`** | **Navbar/sidebar glass** -- Raycast signature light blur |
| `blur(10px)` | Social cards, card backdrop |
| `blur(15px)` | Extension content, address snippet |
| `blur(20px)` | Footer content |
| `blur(24px)` | Large panels |
| `blur(32px)` | Submit button glow |
| `blur(48px)` | AI chat window, large overlay panels |
| `blur(60px)` | Card glow effect (filter, not backdrop) |
| `blur(75px)` | Maximum blur for large background effects |

### Glass Surface Gradient (THE Raycast glass pattern)

```css
/* Primary glass surface -- navbar, sidebar, social cards */
background: linear-gradient(
  137deg,
  rgba(17, 18, 20, 0.75) 4.87%,
  rgba(12, 13, 15, 0.9) 75.88%
);
backdrop-filter: blur(5px);
border: 1px solid rgba(255, 255, 255, 0.06);
box-shadow: inset 0 1px 1px 0 rgba(255, 255, 255, 0.15);
```

### Card Background Gradient (solid, NOT glass)

```css
/* Standard card -- NOT transparent, uses solid gradient */
background: linear-gradient(137deg, #111214 4.87%, #0c0d0f 75.88%);
border: 1px solid rgba(255, 255, 255, 0.06);
box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.1);
```

### Automation Card Gradient

```css
background: linear-gradient(45deg, var(--grey-800) 0, var(--grey-900) 100.67%);
/* = linear-gradient(45deg, #0c0d0f 0, #07080a 100.67%) */
border: 1px solid rgba(255, 255, 255, 0.06);
box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.1);
```

### Footer Glass

```css
background: linear-gradient(
  180deg,
  rgba(7, 8, 10, 0.8) 0.1%,
  #07080a 32.45%
);
backdrop-filter: blur(20px);
```

### Page Background Overlay

```css
/* Hero background fade */
background: linear-gradient(
  180deg,
  #07080a20,         /* 12.5% opacity body bg */
  #07080a00,         /* transparent */
  var(--grey-900)    /* solid at bottom */
);
```

### Card Glow Effect (`:before` pseudo-element)

```css
/* Radial white glow above cards */
background: radial-gradient(
  80% 80% at 50% 50%,
  rgba(255, 255, 255, 0.4) 0,
  transparent 100%
);
filter: blur(60px);
/* Positioned: top: -82px, left: 26%, width: 54%, height: 164px */
pointer-events: none;
```

### Feature Radial Gradient

```css
background: radial-gradient(
  85.77% 49.97% at 51% 5.12%,
  rgba(255, 148, 148, 0.11) 0px,
  rgba(222, 226, 255, 0.08) 45.83%,
  rgba(241, 242, 255, 0.02) 100%
);
```

### AI Completion Text Gradient

```css
color: #8cd6ff;
background: linear-gradient(90deg, rgba(86,194,255,0.16) 1.41%, rgba(86,194,255,0.06) 98.59%);
```

---

## 8. Transitions & Animations

### Standard Transition Patterns

| Duration | Easing | Properties | Context |
|----------|--------|------------|---------|
| `0.1s` | `ease-in-out` | `transform` | Button press |
| `0.15s` | `cubic-bezier(0.16, 1, 0.3, 1)` | all | Modal open |
| `0.2s` | default | `background-color, background-image, box-shadow` | Button hover |
| `0.2s` | `ease` | `border-color` | Card hover |
| `0.2s` | `ease-in-out` | all | General state changes |
| `0.25s` | default | various | Small transitions |
| **`0.3s`** | **`ease`** | **color, border, opacity** | **Standard interaction** |
| `0.3s` | `ease-in-out` | `opacity, transform` | Fade/slide animations |
| `0.3s` | `cubic-bezier(0.4, 0, 0.22, 0.96)` | `opacity, transform` | Hotkeys enter/exit |
| `0.35s` | default | various | Slightly slower |
| `0.5s` | `ease` | various | Medium animations |
| `0.5s` | `ease-in-out` | `transform` | Larger transforms |
| `0.6s` | `ease` | `opacity` | Profile/testimonial fade |
| `1.1s` | `step-end infinite` | opacity | Cursor blink |
| `1.3s` | linear | background | Shimmer/shine |
| `1.5s` | default | various | Slow animations |
| `2s` | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | transform | Extension slide |
| `3s` | `ease-out` | opacity | Background fade |
| `5s` | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | background | Page ambient |

### Key Easing Functions

| Name | Value | Usage |
|------|-------|-------|
| Standard | `ease` | Most interactions |
| Smooth | `ease-in-out` | Transforms, state changes |
| Modal/Dialog | `cubic-bezier(0.16, 1, 0.3, 1)` | Opening modals |
| Overshoot | `cubic-bezier(0.23, 1, 0.32, 1)` | Key press animations |
| Interaction | `cubic-bezier(0.4, 0, 0.22, 0.96)` | Hotkey enter/exit |
| Ambient | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | Slow background animations |

### Hover Transforms

| Component | Transform | Notes |
|-----------|-----------|-------|
| Feature card hover | `border-color` change only | NO translateY, no scale |
| Button active | `transform: none` | Disabled state |
| Hotkey exit | `scale(0.97) translateY(-5px)` | Shrink + slide up |
| Hotkey enter | `scale(1)` | Reset |
| Button press | `scale(0.98)` | Subtle press |
| Slide animation | `scale(1.03)` | Slight zoom |

### Keyframe Animations

| Name | Description | Duration |
|------|-------------|----------|
| `overlayShow` | Modal overlay fade-in | `0.15s` |
| `contentShow` | Modal content appear | `0.15s` |
| `fadeInUp` | `translateY(20px) -> 0`, `opacity 0 -> 1` | `1s ease` |
| `fadeInUpStagger` | Same as above with `1s delay` | `1s ease` |
| `blink` | Cursor blink (50% opacity toggle) | `1.1s step-end infinite` |
| `shine` | Background gradient shift (loading shimmer) | `1.3s linear` |
| `moreFadeIn` | Opacity `0 -> 1` | various |
| `animateIn` | `translateY + opacity` | various |
| `slideIn` | `translateX, translateY, scale` | `2s` |

---

## 9. Component-Specific Patterns

### A. Buttons

**Base button (`Button_button`):**
```css
display: inline-flex;
gap: var(--spacing-1);            /* 8px */
align-items: center;
justify-content: center;
min-height: 36px;
padding: var(--spacing-1) var(--spacing-1-5);  /* 8px 12px */
font-size: 14px;
font-weight: 500;
border: none;
border-radius: var(--rounding-normal);  /* 8px */
cursor: pointer;
transition: background-image 0.2s, background-color 0.2s, box-shadow 0.2s ease-in-out, transform 0.1s ease-in-out;
```

**Light variant (primary CTA):**
```css
color: var(--grey-500);           /* #2f3031 -- dark text on white */
background: var(--grey-50);       /* #e6e6e6 */
/* 4-layer shadow (see Shadows section) */
/* Hover: background -> var(--Base-White) = #fff */
/* Active: background -> var(--grey-100) = #cdcece */
```

**Dark variant (secondary):**
```css
color: var(--Base-White);         /* #fff */
background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.1));
/* 3-layer shadow with ring at 0.25 opacity */
/* Hover: ring brightens to 0.5 */
/* Active: ring dims to 0.15 */
```

**Danger variant:**
```css
color: var(--Red-Default, #ff6363);
background: var(--Red-Muted, #2c1617);
/* Red-tinted shadow layers */
/* Hover: bg -> var(--Red-Faint, #130d0e) */
```

**Disabled state (all variants):**
```css
cursor: not-allowed;
opacity: 0.3;
/* Active transform disabled */
```

### B. Cards

**Standard card:**
```css
background: linear-gradient(137deg, #111214 4.87%, #0c0d0f 75.88%);
border: 1px solid rgba(255, 255, 255, 0.06);
border-radius: var(--rounding-md);    /* 12px */
box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.1);
overflow: hidden;
```

**Card hover:**
```css
border-color: rgba(255, 255, 255, 0.12);
transition: border-color 0.2s ease;
/* NOTE: No transform on hover. Just border color change. */
```

**Extension card (large):**
```css
border-radius: var(--rounding-xl);    /* 20px */
width: 300px -> 360px (desktop);
/* Hover adds radial gradient overlay with soft-light blend */
```

**Browse more card:**
```css
background: var(--grey-700);          /* #111214 */
border: 1px solid var(--Card-Border, rgba(255,255,255,0.06));
border-radius: 22px;
/* Hover: box-shadow: 0 0 24px 8px rgba(255,255,255,0.05) */
/* Focus-visible: box-shadow: 0 0 0 2px rgba(255,255,255,0.5) */
```

### C. Modal / Dialog

**Overlay:**
```css
position: fixed;
inset: 0;
background-color: rgba(0, 0, 0, 0.6);
animation: overlayShow 0.15s cubic-bezier(0.16, 1, 0.3, 1);
```

**Content:**
```css
position: fixed;
top: 50%;
left: 50%;
transform: translate(-50%, -50%);
width: 344px;
max-width: min(500px, calc(100vw - 2 * var(--spacing-2)));
min-height: 198px;
padding: var(--spacing-3) -> var(--spacing-4);  /* 24px -> 32px responsive */
background: var(--grey-900);          /* #07080a -- SOLID, NOT glass */
border: 1px solid var(--Card-Border, rgba(255,255,255,0.06));
border-radius: var(--rounding-lg);    /* 16px */
box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.1);
animation: contentShow 0.15s cubic-bezier(0.16, 1, 0.3, 1);
```

**Modal title:**
```css
font-size: 16px;
font-weight: 500;
line-height: 140%;
color: white;
text-align: center;
letter-spacing: 0.1px;
margin: 0 0 16px;
```

**Modal description:**
```css
font-size: 16px;
font-weight: 500;
line-height: 24px;
color: var(--Text-Default, var(--grey-200));  /* #9c9c9d */
text-align: center;
letter-spacing: 0.1px;
margin-bottom: 24px;
```

### D. AI Chat Window (complex modal)

```css
background: semi-transparent dark;
box-shadow:
  0 4px 40px 8px rgba(0, 0, 0, 0.4),
  0 0 0 0.5px rgba(0, 0, 0, 0.8),
  inset 0 0.5px 0 0 rgba(255, 255, 255, 0.3);
border: 1px solid rgba(142, 140, 144, 0.4);
backdrop-filter: blur(48px);
```

### E. Inputs

**Command input area:**
```css
background: var(--grey-500);          /* #2f3031 */
border-radius: var(--rounding-sm);    /* 6px */
padding: 8px 12px;
font-family: var(--font-geist-mono);
font-size: 13px;
border: none;
color: var(--Text-Default, var(--grey-200));
```

**General form input pattern:**
```css
background: rgba(255, 255, 255, 0.05);
border: 1px solid rgba(255, 255, 255, 0.05);
border-radius: var(--rounding-normal);  /* 8px */
height: 42px;
font-size: 14px;
color: white;
/* Placeholder color: rgba(255,255,255,0.4) -- var(--tertiaryText) */
```

**Error input:**
```css
background: rgba(255, 59, 48, 0.1);
border: 1px solid rgba(255, 59, 48, 0.3);
```

### F. Navigation / Navbar

**In-app navigation bar (preview window mockup):**
```css
display: flex;
gap: var(--spacing-1);               /* 8px */
align-items: center;
padding: 0 var(--spacing-1-5) -> 0 var(--spacing-3);
font-size: 15px -> 28px (responsive);
font-weight: 400;
color: var(--Base-White);
border-bottom: 0.5px solid rgba(255, 255, 255, 0.1);
```

**Glass navbar (site navigation):**
```css
background: linear-gradient(137deg, rgba(17,18,20,0.75) 4.87%, rgba(12,13,15,0.9) 75.88%);
backdrop-filter: blur(5px);
border: 1px solid rgba(255, 255, 255, 0.06);
box-shadow: inset 0 1px 1px 0 rgba(255, 255, 255, 0.15);
```

### G. List Items (Command palette style)

**List item:**
```css
display: flex;
gap: var(--spacing-1-5);             /* 12px */
align-items: center;
height: 40px;                        /* desktop */
padding: 0 var(--spacing-1);         /* 0 8px */
font-size: 13px;
font-weight: 500;
color: var(--Base-White);
letter-spacing: 0.1px;
border-radius: var(--rounding-sm);   /* 6px */
```

**Selected list item:**
```css
background: rgba(255, 255, 255, 0.1);
```

### H. Section Title (in lists)

```css
display: inline-flex;
padding: var(--spacing-1-5) var(--spacing-1);  /* 12px 8px */
font-size: 12px;
font-weight: 500;
line-height: 1;
color: rgba(255, 255, 255, 0.6);
letter-spacing: 0.1px;
```

### I. Testimonials / Avatars

```css
/* Avatar */
width: 40px;
height: 40px;
border-radius: 50%;
border: 1px solid var(--grey-600);  /* #1b1c1e */

/* Name */
font-size: 12px;
font-weight: 600;
color: var(--Base-White);

/* Handle */
font-size: 10px;
font-weight: 500;
color: var(--grey-400);  /* #434345 */

/* Quote text */
font-size: 14px;
font-style: italic;
font-weight: 500;
line-height: 1.75;
color: rgba(255, 255, 255, 0.6);
```

### J. Keyboard Key

```css
display: inline-flex;
align-items: center;
height: 30px;                        /* desktop */
padding: 0 var(--spacing-0-5);      /* 0 4px */
font-size: 20px;                     /* desktop */
border: 1px solid rgba(255, 255, 255, 0.4);
border-radius: var(--rounding-xs);   /* 4px */
```

---

## 10. Layout

### Container Widths

| Variable | Value | Usage |
|----------|-------|-------|
| `--container-xs-width` | `746px` | Blog/content pages |
| `--container-sm-width` | `1064px` | Medium layouts |
| `--container-width` | **`1204px`** | **Primary container** |
| `--container-lg-width` | `1280px` | Wide layouts |

### Responsive Breakpoints

| Breakpoint | Usage in Raycast CSS |
|------------|---------------------|
| `420px` | Small phone text size adjustments |
| `480px` | Mobile layout adjustments |
| `720px` | Tablet -- major layout shifts |
| `768px` | Tablet breakpoint |
| `1080px` | Desktop layout |

### Z-Index Scale

| Value | Context |
|-------|---------|
| `-1` | Background elements, hero backgrounds |
| `0` | Glow effects, standard stacking |
| `1` | Dot inner elements |
| `2` | Messages, submit buttons, footer links |
| `10` | Feature overlays |
| `13` | Submit wrapper |
| `50` | Sticky elements |
| `200` | High-priority overlays |

### Grid Patterns

| Pattern | Values |
|---------|--------|
| Grid gap | `var(--grid-gap)` = `32px` |
| Feature grid | `repeat(2, minmax(...))` or `repeat(6, minmax(...))` |
| Extension cards | Horizontal scroll, `scroll-snap-align: end` |
| Card grid | Responsive 1 -> 2 -> 3 columns |

---

## 11. CTA / Accent Gradients

### Conic Gradient (multi-color glow)

```css
/* Rainbow CTA glow */
background: conic-gradient(
  from 147.14deg at 50% 50%,
  #0294fe -55.68deg,
  #ff2136 113.23deg,
  #9b4dff 195deg,
  #0294fe 304.32deg,
  #ff2136 473.23deg
);

/* Cyan/blue variant (slider dots) */
background: conic-gradient(
  from 136.95deg at 50% 50%,
  #3ec5ff -55.68deg,
  #052dff 113.23deg,
  #00ffe0 195deg,
  #3ec5ff 304.32deg,
  #052dff 473.23deg
);
```

### Heading Text Gradients

```css
/* Hero h1 text gradient (purple tint) */
background: linear-gradient(270.06deg, #d3c4ff 0.04%, #ffffff 52.59%, #ffffff 99.94%);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;

/* Standard heading gradient */
background: linear-gradient(90deg, rgba(255,255,255,0.8) -1.59%, #fff 49.71%, rgba(255,255,255,0.81));
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
```

### Loading/Shimmer Gradient

```css
background: linear-gradient(
  92.74deg,
  rgba(var(--font-color-rgb), 0) 4.57%,
  rgba(var(--font-color-rgb), 0.6) 65.86%,
  rgba(var(--font-color-rgb), 0) 95.43%
);
```

### Pro Badge Gradient

```css
background: linear-gradient(
  150deg,
  rgba(255, 255, 255, 0.23),
  rgba(255, 255, 255, 0.07)
);
```

### Radial Button Gradient (dark buttons)

```css
/* Radial gradient for large buttons */
background: radial-gradient(100% 100% at 50% 0, var(--grey-800) 0, var(--grey-700) 150%);
/* = radial-gradient(100% 100% at 50% 0, #0c0d0f 0, #111214 150%) */

/* Hover variant */
background: radial-gradient(100% 100% at 50% 0, var(--grey-800) 0, var(--grey-700) 100%);
```

### Footer Glow Line

```css
background: linear-gradient(90deg, transparent 20%, rgba(255,170,141,0.36) 50%, transparent 80%);
```

---

## 12. White Opacity Scale (Complete Reference)

Every white opacity value used across Raycast, compiled from all CSS files.

| Opacity | RGBA | Primary Usage |
|---------|------|-------|
| `0.03` | `rgba(255,255,255,0.03)` | Card hover bg, dark button gradient start |
| `0.05` | `rgba(255,255,255,0.05)` | Input bg, subtle border, button inset highlight |
| **`0.06`** | `rgba(255,255,255,0.06)` | **Universal border** (cards, panels, modals) |
| `0.07` | `rgba(255,255,255,0.07)` | Pro badge gradient end |
| `0.1` | `rgba(255,255,255,0.1)` | Card inset shadow, hover border, selected bg, separator, control bg, dark button gradient end |
| `0.12` | `rgba(255,255,255,0.12)` | Feature card hover border |
| `0.15` | `rgba(255,255,255,0.15)` | Glass inset shadow, pill border |
| `0.19` | `rgba(255,255,255,0.19)` | Light button glow |
| `0.2` | `rgba(255,255,255,0.2)` | Focus outline, overlay |
| `0.23` | `rgba(255,255,255,0.23)` | Pro badge gradient start |
| `0.25` | `rgba(255,255,255,0.25)` | Dark button ring (default), button inset |
| `0.3` | `rgba(255,255,255,0.3)` | CTA ring border, AI window inset |
| `0.4` | `rgba(255,255,255,0.4)` | Tertiary text, card glow center, keyboard key border, placeholder |
| `0.5` | `rgba(255,255,255,0.5)` | Dark button ring (hover), focus ring |
| `0.6` | `rgba(255,255,255,0.6)` | Secondary text, section labels, quote text |
| `0.8` | `rgba(255,255,255,0.8)` | Heading gradient point, near-white |
| `0.81` | `rgba(255,255,255,0.81)` | Heading gradient endpoint |
| `0.9` | `rgba(255,255,255,0.9)` | Button background (near-white variant) |
| `1.0` | `#fff` | Primary text, headings |

---

## 13. Black Opacity Scale (Complete Reference)

| Opacity | RGBA | Primary Usage |
|---------|------|-------|
| `0.03` | `rgba(0,0,0,0.03)` | Subtle drop shadow layer |
| `0.11` | `rgba(0,0,0,0.11)` | Footer shadow |
| `0.15` | `rgba(0,0,0,0.15)` | Text shadow, drop shadow |
| `0.2` | `rgba(0,0,0,0.2)` | Button inset bottom, overlay |
| `0.25` | `rgba(0,0,0,0.25)` | Card drop shadow, text shadow, extension overlay |
| `0.4` | `rgba(0,0,0,0.4)` | AI window shadow |
| `0.5` | `rgba(0,0,0,0.5)` | Light button ring |
| `0.6` | `rgba(0,0,0,0.6)` | **Modal overlay** |
| `0.75` | `rgba(0,0,0,0.75)` | Text shadow dark, glass surface bg |
| `0.8` | `rgba(0,0,0,0.8)` | AI window ring, footer bg |
| `0.9` | (in glass surface via rgba(12,13,15,0.9)) | Glass surface bg darker end |

---

## 14. Critical Discrepancies: Virtuna Current vs Raycast Actual

### Things Already Correct

| Property | Virtuna | Raycast | Status |
|----------|---------|---------|--------|
| Body background | `#07080a` | `#07080a` | CORRECT |
| Body letter-spacing | `0.2px` | `0.2px` | CORRECT |
| Card border | `rgba(255,255,255,0.06)` | `rgba(255,255,255,0.06)` | CORRECT |
| Glass navbar blur | `blur(5px)` | `blur(5px)` | CORRECT |
| Glass gradient | `137deg, rgba(17,18,20,0.75)...` | Same | CORRECT |
| Glass inset shadow | `rgba(255,255,255,0.15) 0 1px 1px 0 inset` | Same | CORRECT |
| Modal radius | `16px` | `16px` (`--rounding-lg`) | CORRECT |
| Font smoothing | antialiased | antialiased | CORRECT |
| Card inset shadow | `inset 0 1px 0 oklch(1 0 0 / 0.1)` | `inset 0 1px 0 0 rgba(255,255,255,0.1)` | CORRECT (equivalent) |

### Things That Need Fixing

| Property | Virtuna Current | Raycast Actual | Priority |
|----------|----------------|----------------|----------|
| **Primary font** | Funnel Display + Satoshi | **Inter only** | CRITICAL |
| **h1/h2 font** | `@apply font-display` (Funnel Display) | Inter weight 600-700 | CRITICAL |
| **Card bg gradient** | `linear-gradient(180deg, #222326, #141517)` | `linear-gradient(137deg, #111214 4.87%, #0c0d0f 75.88%)` | HIGH |
| **Body line-height** | `1.15` | `1.5` to `1.6` for body text | HIGH |
| **Grey-200** | `oklch(0.90 0 0)` (very light) | `#9c9c9d` (medium gray) | HIGH |
| **Grey-300** | `oklch(0.80 0 0)` (light) | `#6a6b6c` (darker) | HIGH |
| **Button min-height** | not specified | `36px` | MEDIUM |
| **Button padding** | varies by size | `8px 12px` single size | MEDIUM |
| **Button font-size** | varies by size | `14px` single size | MEDIUM |
| **Error color** | `oklch(0.60 0.20 25)` | `#ff6363` exact | MEDIUM |
| **Success color** | `oklch(0.68 0.17 145)` | `#59d499` exact | MEDIUM |
| **Dark button shadow** | not defined | 3-layer with ring (see section 5) | MEDIUM |
| **Danger button shadow** | not defined | Red-tinted shadow (see section 5) | MEDIUM |
| **Modal overlay** | not explicit | `rgba(0,0,0,0.6)` | LOW |
| **Surface color** | `#18191a` | no exact match -- cards use gradient, not flat color | REVIEW |
| **Accent color** | `#E57850` / oklch coral | N/A (Raycast uses blue/red, we use coral) | INTENTIONAL DIFF |

### Spacing Scale Mapping: Virtuna vs Raycast

| Virtuna Token | Virtuna Value | Raycast Equivalent | Raycast Value |
|---------------|---------------|--------------------|---------------|
| `--spacing-1` | `4px` | `--spacing-0-5` | `4px` |
| `--spacing-2` | `8px` | `--spacing-1` | `8px` |
| `--spacing-3` | `12px` | `--spacing-1-5` | `12px` |
| `--spacing-4` | `16px` | `--spacing-2` | `16px` |
| `--spacing-5` | `20px` | `--spacing-2-5` | `20px` |
| `--spacing-6` | `24px` | `--spacing-3` | `24px` |
| `--spacing-8` | `32px` | `--spacing-4` | `32px` |
| `--spacing-10` | `40px` | `--spacing-5` | `40px` |
| `--spacing-12` | `48px` | `--spacing-6` | `48px` |
| `--spacing-16` | `64px` | `--spacing-8` | `64px` |
| `--spacing-20` | `80px` | `--spacing-9` | `80px` |
| `--spacing-24` | `96px` | `--spacing-10` | `96px` |
| (none) | -- | `--spacing-11` | `112px` |
| (none) | -- | `--spacing-12` | `168px` |
| (none) | -- | `--spacing-13` | `224px` |

**Recommendation:** Keep Virtuna's spacing token NAMES (they follow Tailwind convention: `--spacing-N` where N is the value in 4px units). The actual pixel values are identical. No change needed to spacing scale values.

---

## 15. Font Loading

Raycast loads fonts via Next.js CSS variable classes on `<html>`:
- `__variable_f367f3` -- Inter
- `__variable_3c557b` -- JetBrains Mono
- `__variable_f910ec` -- Geist Mono (or Instrument Serif)

Font files are served as WOFF2 with extensive unicode-range subsetting for Cyrillic, Greek, Vietnamese, Latin Extended.

Inter is loaded with weight range 100-900.
JetBrains Mono is loaded with weight range 100-800.

---

## 16. Summary of Required Token Changes

### CRITICAL (must fix)

1. **Font family:** Replace Funnel Display + Satoshi with Inter. Remove `--font-display` and `--font-sans` split. Single font: `--font-sans: var(--font-inter), sans-serif`.
2. **h1/h2 rule:** Remove `h1, h2 { @apply font-display; }`. Headings use Inter with weight 600-700.
3. **Body line-height:** Change from `1.15` to a value more appropriate for body text. Raycast body text uses `1.6` (160%) for paragraphs.

### HIGH (visual accuracy)

4. **Card gradient:** Change `--gradient-card-bg` from `linear-gradient(180deg, #222326, #141517)` to `linear-gradient(137deg, #111214 4.87%, #0c0d0f 75.88%)`.
5. **Grey scale corrections:** Several oklch values don't match Raycast's hex values. Replace with exact hex from Raycast's CSS.
6. **Add `--grey-*` aliases:** Components reference `var(--grey-600)`, `var(--Card-Border)` etc. Need these as CSS aliases.

### MEDIUM (completeness)

7. **Button tokens:** Add `--shadow-button-dark`, `--shadow-button-danger` shadow definitions.
8. **Error/success colors:** Use exact hex (`#ff6363`, `#59d499`) instead of oklch approximations.
9. **Modal overlay:** Add explicit `rgba(0,0,0,0.6)` token.
10. **Radial button gradient:** Add for large dark buttons.

### LOW (nice to have)

11. **Additional easing functions:** Add modal easing `cubic-bezier(0.16, 1, 0.3, 1)`.
12. **Missing spacing stops:** Add `--spacing-11` (112px), `--spacing-12` (168px), `--spacing-13` (224px) if large pages need them.

---

## Sources

All values extracted directly from raycast.com production CSS files on 2026-02-06:
- `raycast.com/_next/static/css/5038a0f8e1dbb537.css` -- Root variables, font-face, normalize (HIGHEST value -- contains all `:root` definitions)
- `raycast.com/_next/static/css/99983e59c3d5a9bc.css` -- Component styles (buttons, forms, social cards, waitlist)
- `raycast.com/_next/static/css/9e8cdeab5b34655f.css` -- Component styles (buttons, cards, navigation, modals, extension cards, inputs, list items)
- `raycast.com/_next/static/css/78a7c16057bbd884.css` -- Component styles (glass panels, snippets, automation cards)
- `raycast.com/_next/static/css/111aee99f8b09236.css` -- Page-specific styles, additional component references
- `raycast.com/_next/static/css/af9f5781b0bfa376.css` -- Window component styles
- `raycast.com/_next/static/css/8c1d6bf93f98f065.css` -- Feature showcase, AI chat, calculator, keyboard
- `raycast.com/_next/static/css/3563776b487bdaf8.css` -- Snippets, automation, hotkeys
- `raycast.com/_next/static/css/322cff0d1aec2be4.css` -- Testimonials
- `raycast.com/_next/static/css/87aeb4a9a835497c.css` -- Page hero, fade animations
