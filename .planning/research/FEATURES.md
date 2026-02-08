# Design Token Comparison: Virtuna vs Raycast

**Project:** Virtuna v2.3.5 Design Token Alignment
**Researched:** 2026-02-06
**Mode:** Comparison
**Overall Confidence:** HIGH (verified against live raycast.com extraction 2026-02-06 + MEMORY.md rules)

**Severity Guide:**
- **CRITICAL** -- Fundamentally wrong design philosophy, visually jarring
- **MAJOR** -- Wrong value, visually noticeable at a glance
- **MINOR** -- Slight value difference, may not be visible without side-by-side comparison

---

## 1. Background Colors

### 1.1 Body Background
| Property | Virtuna Current | Raycast Target | Match? |
|----------|----------------|----------------|--------|
| Body bg | `--color-gray-950: #07080a` | `#07080a` | MATCH |

**Verdict:** MATCH. Correct.

### 1.2 Surface Hierarchy
| Property | Virtuna Current | Raycast Target | Match? | Severity |
|----------|----------------|----------------|--------|----------|
| `--color-surface` | `#18191a` (rgb 24,25,26) | No equivalent -- Raycast cards use `bg-transparent` | MAJOR | Cards should NOT have opaque surface bg |
| `--color-surface-elevated` | `#222326` (rgb 34,35,38) | Solid opaque for modals only | MINOR | Correct for modals, wrong when used on cards |
| `--color-background-elevated` | `var(--color-gray-900)` = `#1a1b1e` | `rgb(26,27,30)` = `#1a1b1e` | MATCH | -- |

**Discrepancy D-1.2a: Card backgrounds use `--gradient-card-bg` (gradient from #222326 to #141517)**
- Raycast target: Cards are `bg-transparent` with border only
- Severity: **CRITICAL**
- Impact: Cards look solid/heavy instead of the transparent Raycast style
- Affected components: `Card` (card.tsx), `FeatureCard`, any component using `--gradient-card-bg`
- Fix: Remove gradient background, use `bg-transparent` for cards. Reserve solid backgrounds for modals/dialogs only.

**Discrepancy D-1.2b: `--color-surface` used for base Input background**
- Virtuna: `bg-surface` = `#18191a` (opaque dark)
- Raycast: `rgba(255, 255, 255, 0.05)` (semi-transparent white)
- Severity: **MAJOR**
- Impact: Inputs look heavier/opaquer than Raycast
- Affected components: `Input` (input.tsx), `Select` trigger
- Fix: Input background should be `rgba(255, 255, 255, 0.05)`, not a solid surface color.

### 1.3 Card Hover Background
| Property | Virtuna Current | Raycast Target | Match? | Severity |
|----------|----------------|----------------|--------|----------|
| Card hover bg | No hover bg defined on Card | `rgba(255, 255, 255, 0.03)` = `white/[0.03]` | MAJOR | Missing hover feedback |

**Discrepancy D-1.3: Missing card hover background**
- Severity: **MAJOR**
- Affected components: `Card`, `GlassCard`, `FeatureCard`, `VideoCard`
- Fix: Add `hover:bg-white/[0.03]` to card hover state.

---

## 2. Text Colors

### 2.1 Primary Text
| Property | Virtuna Current | Raycast Target | Match? |
|----------|----------------|----------------|--------|
| `--color-foreground` | `var(--color-gray-50)` = `oklch(0.98 0 0)` ~ `#fafafa` | `#f4feff` (rgb 244,254,255) | MINOR |

**Discrepancy D-2.1: Primary text color slightly different**
- Virtuna: Pure neutral white `#fafafa`
- Raycast: Very slight cool tint `#f4feff` (bluish white)
- Severity: **MINOR** -- Nearly imperceptible
- Affected: All text using `text-foreground`
- Fix: Optional. Could update `--color-gray-50` to `#f4feff` but difference is negligible. Keep as-is unless doing pixel-perfect pass.

### 2.2 Secondary Text
| Property | Virtuna Current | Raycast Target | Match? | Severity |
|----------|----------------|----------------|--------|----------|
| `--color-foreground-secondary` | `var(--color-gray-400)` = `#9c9c9d` | `rgb(156,156,157)` = `#9c9c9d` | MATCH | -- |

**Verdict:** MATCH. Correct.

### 2.3 Muted Text
| Property | Virtuna Current | Raycast Target | Match? | Severity |
|----------|----------------|----------------|--------|----------|
| `--color-foreground-muted` | `var(--color-gray-500)` = `#848586` | `rgb(106,107,108)` = `#6a6b6c` | MAJOR | Virtuna is lighter |

**Discrepancy D-2.3: Muted text too light**
- Virtuna: `#848586` (lightened from `#6a6b6c` for WCAG AA -- documented in globals.css comment)
- Raycast: `#6a6b6c`
- Severity: **MAJOR** -- visually noticeable, muted text appears less muted
- Affected: `Caption` component, placeholder text, all `text-foreground-muted` usage
- Fix: This was an intentional accessibility improvement. Keep `#848586` for WCAG AA compliance (5.4:1 on #07080a). Document the deviation as a conscious accessibility choice, not a bug.
- **Decision needed:** Accessibility vs pixel-perfect. Recommend keeping Virtuna value.

---

## 3. Border Colors and Opacities

### 3.1 Default Border
| Property | Virtuna Current | Raycast Target | Match? |
|----------|----------------|----------------|--------|
| `--color-border` | `rgba(255, 255, 255, 0.06)` | `rgba(255, 255, 255, 0.06)` | MATCH |

**Verdict:** MATCH. Correct.

### 3.2 Hover Border
| Property | Virtuna Current | Raycast Target | Match? |
|----------|----------------|----------------|--------|
| `--color-border-hover` | `rgba(255, 255, 255, 0.1)` | `rgba(255, 255, 255, 0.1)` | MATCH |

**Verdict:** MATCH. Correct.

### 3.3 Feature Card Border (Hardcoded)
| Property | Virtuna Current | Raycast Target | Match? | Severity |
|----------|----------------|----------------|--------|----------|
| FeatureCard border | `border-white/10` (10%) | `rgba(255, 255, 255, 0.06)` (6%) | MAJOR | Too bright |

**Discrepancy D-3.3: FeatureCard uses wrong border opacity**
- Virtuna: `white/10` = 10% (this is hover-level, not resting)
- Raycast: `white/[0.06]` = 6% (standard resting border)
- Severity: **MAJOR**
- Affected: `FeatureCard` component (feature-card.tsx), landing page
- Fix: Change from `border-white/10` to `border-border` (which resolves to 6%).

### 3.4 Feature Card Hover Border (Hardcoded)
| Property | Virtuna Current | Raycast Target | Match? | Severity |
|----------|----------------|----------------|--------|----------|
| FeatureCard hover | `hover:border-white/20` (20%) | `hover:border-white/[0.1]` (10%) | MAJOR | Too bright |

**Discrepancy D-3.4: FeatureCard hover border too bright**
- Virtuna: 20% opacity on hover
- Raycast: 10% opacity on hover
- Severity: **MAJOR**
- Affected: `FeatureCard`
- Fix: Change to `hover:border-border-hover` (which resolves to 10%).

### 3.5 Input Border
| Property | Virtuna Current | Raycast Target | Match? | Severity |
|----------|----------------|----------------|--------|----------|
| GlassInput border | `border-white/5` (5%) | `rgba(255,255,255,0.05)` (5%) | MATCH | -- |
| Base Input border | `border-border` = 6% | `rgba(255,255,255,0.05)` (5%) | MINOR | Slightly too bright |

**Discrepancy D-3.5: Base Input border slightly off**
- GlassInput: Correct at 5%
- Base Input: Uses `border-border` (6%) instead of 5%
- Severity: **MINOR**
- Affected: `Input` component (input.tsx)
- Fix: Change `Input` to use `border-white/5` instead of `border-border`.

### 3.6 Mobile Menu Border (Hardcoded)
| Property | Virtuna Current | Raycast Target | Match? | Severity |
|----------|----------------|----------------|--------|----------|
| Header mobile border | `border-white/10` | `rgba(255, 255, 255, 0.06)` | MINOR | Too bright |

**Discrepancy D-3.6: Header mobile menu divider too bright**
- Severity: **MINOR**
- Affected: `Header` component (header.tsx)
- Fix: Change to `border-border`.

---

## 4. Border Radius Scale

| Token | Virtuna Current | Raycast Target | Match? |
|-------|----------------|----------------|--------|
| `--radius-none` | `0` | `0` | MATCH |
| `--radius-xs` | `4px` | `4px` | MATCH |
| `--radius-sm` | `6px` | `6px` | MATCH |
| `--radius-md` | `8px` | `8px` | MATCH |
| `--radius-lg` | `12px` | `12px` | MATCH |
| `--radius-xl` | `16px` | `16px` | MATCH |
| `--radius-2xl` | `20px` | `20px` | MATCH |
| `--radius-3xl` | `24px` | `24px` | MATCH |
| `--radius-full` | `9999px` | `9999px` | MATCH |

**Verdict:** MATCH. Full scale is correct.

### 4.1 Component-Level Radius Usage

| Component | Virtuna Current | Raycast Target | Match? | Severity |
|-----------|----------------|----------------|--------|----------|
| Cards | `rounded-lg` (12px) | `border-radius: 12px` | MATCH | -- |
| Inputs (base) | `rounded-md` (8px) | `border-radius: 8px` | MATCH | -- |
| GlassInput | `rounded-[var(--rounding-normal)]` (8px) | `8px` | MATCH | -- |
| Modals | `rounded-lg` (12px) | `12px` | MATCH | -- |
| GlassPanel | `rounded-xl` (16px) | Context-dependent | MINOR | See D-4.1 |
| Select dropdown | `rounded-lg` (12px) | `12px` | MATCH | -- |
| Sidebar | `rounded-xl` (16px) | `12px` | MINOR | See D-4.1 |

**Discrepancy D-4.1: GlassPanel and Sidebar use rounded-xl (16px) instead of 12px**
- GlassPanel base always uses `rounded-xl` = 16px
- Raycast glass panels (navbar, sidebar) use 12px
- Severity: **MINOR** -- 4px difference, subtle
- Affected: `GlassPanel`, `Sidebar`, any GlassPanel consumer
- Fix: GlassPanel should default to `rounded-lg` (12px). Sidebar should use `rounded-lg`.

---

## 5. Shadow Definitions

### 5.1 Button Shadow
| Property | Virtuna Current | Raycast Target | Match? |
|----------|----------------|----------------|--------|
| `--shadow-button` | `rgba(0,0,0,0.5) 0px 0px 0px 2px, rgba(255,255,255,0.19) 0px 0px 14px 0px, rgba(0,0,0,0.2) 0px -1px 0.4px 0px inset, rgb(255,255,255) 0px 1px 0.4px 0px inset` | Same 4-layer shadow | MATCH |

**Verdict:** MATCH. The Raycast 4-layer button shadow is correctly replicated.

### 5.2 Card Inset Shadow
| Property | Virtuna Current | Raycast Target | Match? |
|----------|----------------|----------------|--------|
| Card boxShadow (card.tsx) | `inset 0 1px 0 0 rgba(255,255,255,0.1)` | `rgba(255,255,255,0.1) 0 1px 0 0 inset` | MATCH |

**Verdict:** MATCH. Same value, different syntax order.

### 5.3 Glass Inset Shadow
| Property | Virtuna Current | Raycast Target | Match? | Severity |
|----------|----------------|----------------|--------|----------|
| Glass navbar shadow (sidebar.tsx) | `rgba(255,255,255,0.15) 0px 1px 1px 0px inset` | `rgba(255,255,255,0.15) 0 1px 1px 0 inset` | MATCH | -- |
| GlassCard glow shadow | `rgba(255,255,255,0.15) 0px 1px 1px 0px inset` | `rgba(255,255,255,0.15) 0 1px 1px 0 inset` | MATCH | -- |

**Verdict:** MATCH.

### 5.4 Modal Shadow
| Property | Virtuna Current | Raycast Target | Match? |
|----------|----------------|----------------|--------|
| Dialog boxShadow | `0 20px 25px rgba(0,0,0,0.15), 0 10px 10px rgba(0,0,0,0.1), rgba(255,255,255,0.1) 0px 1px 0px 0px inset` | `rgba(255,255,255,0.1) 0 1px 0 0 inset` (+ depth shadow) | MATCH |

**Verdict:** MATCH. Includes Raycast inset highlight.

### 5.5 Generic Shadow Scale
| Token | Virtuna Current | Raycast Equivalent | Notes |
|-------|----------------|-------------------|-------|
| `--shadow-sm` | `0 1px 2px oklch(0 0 0 / 0.2)` | N/A | Virtuna custom |
| `--shadow-md` | 2-layer | N/A | Virtuna custom |
| `--shadow-lg` | 2-layer | N/A | Virtuna custom |
| `--shadow-xl` | 3-layer + border | N/A | Virtuna custom |
| `--shadow-glass` | `0 8px 32px oklch(0 0 0 / 0.2), inset 0 1px 0 oklch(1 0 0 / 0.1)` | N/A | Virtuna custom |
| `--shadow-glow-accent` | `0 0 20px oklch(0.72 0.16 40 / 0.3)` | N/A | Virtuna custom -- NO GLOW on Raycast |

**Discrepancy D-5.5: Glow shadows are a Virtuna invention**
- Raycast does NOT use glow shadows
- `--shadow-glow-accent` and `GlassPanel`'s `shadow-glass` (with 8px 32px spread) are Virtuna additions
- Severity: **MAJOR** (design philosophy mismatch)
- Affected: `GlassPanel` (uses `shadow-glass` as default), `GlassCard` (inherits), `GradientGlow` component
- Fix: Remove `shadow-glass` from GlassPanel default. Cards should only have the inset top highlight, not external glow.

---

## 6. Typography

### 6.1 Font Families
| Property | Virtuna Current | Raycast Target | Match? | Severity |
|----------|----------------|----------------|--------|----------|
| Body font | `--font-sans: Satoshi` | `Inter` | **CRITICAL** | Different font |
| Display font | `--font-display: Funnel Display` | `Inter` (heavier weight) | **CRITICAL** | Different font |
| Mono font | `JetBrains Mono` | `JetBrains Mono` / `Geist Mono` | MINOR | Close enough |

**Discrepancy D-6.1: Font family mismatch (INTENTIONAL)**
- Virtuna uses Satoshi (body) + Funnel Display (headings)
- Raycast uses Inter for everything
- Severity: **CRITICAL** visually, but this is a DELIBERATE brand choice
- Affected: EVERY component, every page, every piece of text
- Fix: This is an intentional Virtuna brand deviation. Do NOT change to Inter. Document as intentional.
- **Classification: INTENTIONAL DEVIATION** -- not a bug.

### 6.2 Font Sizes
| Size | Virtuna Current | Raycast Usage | Match? |
|------|----------------|---------------|--------|
| `--text-xs` | `12px` | `12px` | MATCH |
| `--text-sm` | `14px` | `14px` | MATCH |
| `--text-base` | `16px` | `16px` | MATCH |
| `--text-lg` | `18px` | `18px` | MATCH |
| `--text-xl` | `20px` | `20px` | MATCH |
| `--text-2xl` | `24px` | Various | MATCH |
| `--text-hero` | `52px` | Context-dependent | MATCH |
| `--text-display` | `64px` | Context-dependent | MATCH |

**Verdict:** MATCH. Size scale is correct.

### 6.3 Font Weights
| Weight | Virtuna Current | Raycast Usage | Match? |
|--------|----------------|---------------|--------|
| Regular | `400` | `400` | MATCH |
| Medium | `500` | `500` | MATCH |
| Semibold | `600` | `600` | MATCH |
| Bold | `700` | `700` | MATCH |

**Verdict:** MATCH.

### 6.4 Line Heights
| Token | Virtuna Current | Raycast Usage | Match? |
|-------|----------------|---------------|--------|
| `--leading-none` | `1` | `1` | MATCH |
| `--leading-tight` | `1.1` | Varies | MATCH |
| `--leading-snug` | `1.25` | Varies | MATCH |
| `--leading-normal` | `1.5` | Varies | MATCH |

**Verdict:** MATCH for token definitions.

### 6.5 Body Line Height
| Property | Virtuna Current | Raycast Target | Match? | Severity |
|----------|----------------|----------------|--------|----------|
| body line-height | `1.15` (globals.css) | `1.5` (typical for Inter body) | MAJOR | Text feels cramped |

**Discrepancy D-6.5: Body line-height too tight**
- Virtuna: `line-height: 1.15` on html/body
- Raycast: ~`1.5` for body text with Inter
- Severity: **MAJOR** -- Affects all body text readability
- Affected: Global body styles, all text that inherits
- Fix: Change body `line-height` from `1.15` to `1.5`. This is a standard for body text. The tight `1.15` is appropriate for headings, not body.

### 6.6 Letter Spacing
| Property | Virtuna Current | Raycast Target | Match? |
|----------|----------------|----------------|--------|
| Body letter-spacing | `0.2px` | `0.2px` | MATCH |
| `--tracking-tight` | `-0.02em` | Headings use negative tracking | MATCH |
| `--tracking-normal` | `0` | `0` | MATCH |

**Verdict:** MATCH.

### 6.7 Font Smoothing
| Property | Virtuna Current | Raycast Target | Match? |
|----------|----------------|----------------|--------|
| `-webkit-font-smoothing` | `antialiased` | `antialiased` | MATCH |
| `-moz-osx-font-smoothing` | `grayscale` | `grayscale` | MATCH |

**Verdict:** MATCH.

---

## 7. Glass/Blur Patterns

### 7.1 Navbar/Sidebar Glass
| Property | Virtuna Current (sidebar.tsx) | Raycast Target | Match? |
|----------|-------------------------------|----------------|--------|
| Background gradient | `linear-gradient(137deg, rgba(17,18,20,0.75) 4.87%, rgba(12,13,15,0.9) 75.88%)` | Same | MATCH |
| Blur | `blur(5px)` | `blur(5px)` | MATCH |
| Border | `border-white/[0.06]` | `rgba(255,255,255,0.06)` | MATCH |
| Inset shadow | `rgba(255,255,255,0.15) 0px 1px 1px 0px inset` | `rgba(255,255,255,0.15) 0 1px 1px 0 inset` | MATCH |

**Verdict:** MATCH. Sidebar glass is correctly implemented.

### 7.2 GlassPanel Component vs Raycast Glass
| Property | Virtuna GlassPanel | Raycast Glass | Match? | Severity |
|----------|-------------------|---------------|--------|----------|
| Background | `oklch(0.18 0.01 264 / {opacity})` | `linear-gradient(137deg, ...)` | **CRITICAL** | Different approach |
| Blur default | `12px` (md) | `5px` | **MAJOR** | Too much blur |
| Border | `rgba(28,29,33,0.65)` via `.glass-base` | `rgba(255,255,255,0.06)` | MAJOR | Different color model |
| Shadow | `shadow-glass` (external glow) | Inset-only highlight | MAJOR | Glow is wrong |
| Tinting | Colored oklch tints (purple, blue, etc.) | NO colored tinting | **CRITICAL** | Raycast has no tinting |
| Inner glow | Configurable via `innerGlow` prop | NO inner glow | MAJOR | Raycast has no glow |

**Discrepancy D-7.2: GlassPanel is fundamentally wrong for Raycast matching**
- GlassPanel implements an iOS 26 / liquid glass aesthetic, NOT Raycast's glass
- Raycast glass = simple gradient bg + 5px blur + 6% border + inset highlight
- GlassPanel = oklch tinted bg + 12px blur + external glow shadow + inner glow
- Severity: **CRITICAL**
- Affected: Every component that uses GlassPanel (GlassCard, VideoCard, etc.)
- Fix: For Raycast alignment, GlassPanel should:
  1. Use the gradient background, not oklch tint
  2. Default blur to 5px
  3. Remove external shadow-glass
  4. Remove tinting system (or make it opt-in only for Virtuna-specific contexts)
  5. Remove inner glow default
  6. Add inset highlight shadow only

### 7.3 GlassCard (card.tsx) vs Raycast Cards
| Property | Virtuna GlassCard | Raycast Cards | Match? | Severity |
|----------|-------------------|---------------|--------|----------|
| Background | `rgba(255,255,255,0.05)` via inline | `bg-transparent` | MAJOR | Should be fully transparent |
| Blur | `blur(12px)` | No blur on cards | **CRITICAL** | Cards don't have blur |
| Border | `border-border-glass` (6%) | `rgba(255,255,255,0.06)` | MATCH | -- |
| Inset shadow | `rgba(255,255,255,0.15) 0px 1px 1px 0px inset` | `rgba(255,255,255,0.1) 0 1px 0 0 inset` | MINOR | 0.15 vs 0.10, 1px spread vs 0 |
| Hover translate | Not implemented on GlassCard directly | `-translate-y-0.5` (2px lift) | MAJOR | Missing |
| Hover border | Not implemented | `white/[0.1]` | MAJOR | Missing |
| Hover bg | Not implemented | `white/[0.03]` | MAJOR | Missing |

**Discrepancy D-7.3a: GlassCard (card.tsx) inset shadow intensity wrong**
- Virtuna: `rgba(255,255,255,0.15) 0px 1px 1px 0px inset` (15% opacity, 1px spread)
- Raycast: `rgba(255,255,255,0.1) 0 1px 0 0 inset` (10% opacity, 0px spread)
- Severity: **MINOR** -- subtle difference
- Fix: Change to `rgba(255,255,255,0.1) 0 1px 0 0 inset`.

**Discrepancy D-7.3b: Cards should not have backdrop blur**
- Severity: **CRITICAL**
- Raycast cards are transparent with border, no blur
- Fix: Remove backdrop-filter from card components.

**Discrepancy D-7.3c: Card hover states missing**
- Severity: **MAJOR**
- Raycast card hover: translate-y -0.5 (2px lift) + border to 10% + bg white/[0.03]
- Fix: Add `hover:-translate-y-0.5 hover:border-white/[0.1] hover:bg-white/[0.03]` to cards.

---

## 8. Button Styles

### 8.1 Primary Button
| Property | Virtuna Current | Raycast Target | Match? | Severity |
|----------|----------------|----------------|--------|----------|
| Background | `bg-accent` (coral oklch) | Coral/accent bg | MATCH | -- |
| Text | `text-accent-foreground` (#1a0f0a) | Dark text on accent | MATCH | -- |
| Shadow | `shadow-button` (4-layer) | Same 4-layer | MATCH | -- |
| Hover | `hover:bg-accent-hover` | Lighter accent | MATCH | -- |
| Border radius (md) | `rounded-md` (8px) | `8px` | MATCH | -- |

**Verdict:** MATCH. Primary button is well-implemented.

### 8.2 Secondary Button
| Property | Virtuna Current | Raycast Target | Match? | Severity |
|----------|----------------|----------------|--------|----------|
| Background | `bg-transparent` | `bg-transparent` | MATCH | -- |
| Border | `border-white/[0.06]` | `border-white/[0.06]` | MATCH | -- |
| Text | `text-foreground` | White text | MATCH | -- |
| Hover bg | `hover:bg-white/[0.1]` | `hover:bg-white/[0.1]` | MATCH | -- |

**Verdict:** MATCH. Secondary button is correct.

### 8.3 Ghost Button
| Property | Virtuna Current | Raycast Target | Match? |
|----------|----------------|----------------|--------|
| Background | `bg-transparent` | `bg-transparent` | MATCH |
| Hover | `hover:bg-hover` = `rgba(255,255,255,0.05)` | Similar | MATCH |

**Verdict:** MATCH.

### 8.4 Button Sizes
| Size | Virtuna Height | Brand Bible | Raycast Typical | Match? | Severity |
|------|---------------|-------------|-----------------|--------|----------|
| sm | `36px` (h-9) | `32px` | Context-dependent | MINOR | 4px taller |
| md | `44px` (h-11) | `40px` | `42px` for inputs, varies for buttons | MINOR | Slightly tall |
| lg | `48px` (h-12) | `48px` | Context-dependent | MATCH | -- |

**Discrepancy D-8.4: Button heights differ slightly from Brand Bible (INTENTIONAL)**
- Brand Bible says sm=32px, md=40px, lg=48px
- Virtuna uses sm=36px, md=44px, lg=48px (optimized for touch targets)
- Raycast doesn't have a fixed button height system
- Severity: **MINOR** -- touch target optimization is good UX
- Fix: Keep current values. The 44px minimum for md is correct for mobile touch targets.

---

## 9. Input Styles

### 9.1 GlassInput (Correct Implementation)
| Property | Virtuna GlassInput | Raycast Target | Match? |
|----------|-------------------|----------------|--------|
| Background | `rgba(255,255,255,0.05)` | `rgba(255,255,255,0.05)` | MATCH |
| Border | `border-white/5` | `border: 1px solid rgba(255,255,255,0.05)` | MATCH |
| Radius | `var(--rounding-normal)` = 8px | `8px` | MATCH |
| Height (md) | `42px` | `42px` | MATCH |
| Font size (md) | `14px` | `14px` | MATCH |
| Hover border | `hover:border-white/10` | `hover:border-white/[0.1]` | MATCH |

**Verdict:** GlassInput is the CORRECT Raycast-matching input. Well done.

### 9.2 Base Input (Incorrect Implementation)
| Property | Virtuna Input | Raycast Target | Match? | Severity |
|----------|--------------|----------------|--------|----------|
| Background | `bg-surface` = `#18191a` | `rgba(255,255,255,0.05)` | **MAJOR** | Opaque vs transparent |
| Border | `border-border` = 6% | `rgba(255,255,255,0.05)` = 5% | MINOR | Slightly off |
| Height | `h-11` = 44px | `42px` | MINOR | 2px taller |
| Radius | `rounded-md` = 8px | `8px` | MATCH | -- |
| Focus | `ring-2 ring-accent/50 border-accent` | Accent ring | MATCH | -- |

**Discrepancy D-9.2: Base Input diverges from Raycast pattern**
- GlassInput is correct, base Input is not
- Severity: **MAJOR** -- two input implementations with different aesthetics
- Affected: `Input`, `InputField`, any form using the base component
- Fix: Align base Input to use `rgba(255,255,255,0.05)` background. Consider unifying Input and GlassInput into one component, or deprecating one.

---

## 10. Modal/Dialog Styles

### 10.1 Dialog Content
| Property | Virtuna Current | Raycast Target | Match? | Severity |
|----------|----------------|----------------|--------|----------|
| Background | `bg-surface-elevated` = `#222326` | Solid opaque dark bg | MATCH | -- |
| Border | `border-border-glass` = 6% | Border present | MATCH | -- |
| Radius | `rounded-lg` = 12px | `12px` | MATCH | -- |
| Shadow | Complex + inset highlight | Inset `rgba(255,255,255,0.1)` | MATCH | -- |
| Glass blur | None (correctly opaque) | None (opaque) | MATCH | -- |

**Verdict:** MATCH. Dialogs correctly use solid opaque background, not glass.

### 10.2 Dialog Overlay
| Property | Virtuna Current | Raycast Target | Match? | Severity |
|----------|----------------|----------------|--------|----------|
| Background | `bg-black/60` | Dark overlay | MATCH | -- |
| Blur | `blur(4px)` | Varies | MATCH | -- |

**Verdict:** MATCH.

---

## 11. Navigation Patterns

### 11.1 Header/Navbar
| Property | Virtuna Current | Raycast Target | Match? | Severity |
|----------|----------------|----------------|--------|----------|
| Position | `sticky top-0` | Sticky/fixed | MATCH | -- |
| Background | `bg-background` (solid) | Gradient glass + blur | **CRITICAL** | Fundamentally different |
| Z-index | `z-50` | High z-index | MATCH | -- |

**Discrepancy D-11.1: Header uses solid background instead of glass navbar**
- Virtuna: `bg-background` = solid `#07080a`
- Raycast: Gradient glass pattern with `blur(5px)` + semi-transparent gradient
- Severity: **CRITICAL** -- The header is one of the most prominent UI elements
- Affected: `Header` component (header.tsx)
- Fix: Apply `glass-navbar` class or inline Raycast gradient glass pattern to header. Use `--gradient-navbar` background, `blur(5px)`, `border-white/[0.06]`, inset shadow.

### 11.2 Sidebar
| Property | Virtuna Current | Raycast Target | Match? |
|----------|----------------|----------------|--------|
| Width | `260px` | Similar | MATCH |
| Position | Fixed, floating (inset 12px) | Floating panel | MATCH |
| Background | Raycast gradient glass | Gradient glass | MATCH |
| Blur | `blur(5px)` | `blur(5px)` | MATCH |
| Border | `border-white/[0.06]` | `rgba(255,255,255,0.06)` | MATCH |
| Inset shadow | `rgba(255,255,255,0.15)` | `rgba(255,255,255,0.15)` | MATCH |

**Verdict:** MATCH. Sidebar is correctly implemented with Raycast glass.

---

## 12. Spacing and Layout

### 12.1 Spacing Scale
| Token | Virtuna Current | Standard 4px Base | Match? |
|-------|----------------|--------------------|--------|
| All spacing tokens | 4px base (4/8/12/16/20/24/32/40/48/64/80/96) | Correct 4px base grid | MATCH |

**Verdict:** MATCH. Spacing scale is standard and correct.

### 12.2 Container Width
| Property | Virtuna BRAND-BIBLE | Raycast Usage | Match? |
|----------|---------------------|---------------|--------|
| Max width | `1280px` | Varies by section | MATCH |

**Verdict:** MATCH. Standard container width.

---

## 13. Transition/Animation Values

### 13.1 Durations
| Token | Virtuna Current | Raycast Usage | Match? |
|-------|----------------|---------------|--------|
| `--duration-fast` | `150ms` | Micro-interactions | MATCH |
| `--duration-normal` | `200ms` | Hover states | MATCH |
| `--duration-slow` | `300ms` | Panel transitions | MATCH |

**Verdict:** MATCH.

### 13.2 Easings
| Token | Virtuna Current | Match? |
|-------|----------------|--------|
| `--ease-out-cubic` | `cubic-bezier(0.215, 0.61, 0.355, 1)` | Standard |
| `--ease-out-quart` | `cubic-bezier(0.165, 0.84, 0.44, 1)` | Standard |
| `--ease-in-out` | `cubic-bezier(0.42, 0, 0.58, 1)` | Standard |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Virtuna custom |

**Verdict:** MATCH for standard easings. Spring is a Virtuna addition (acceptable).

### 13.3 Card Hover Transition
| Property | Virtuna Current | Raycast Target | Match? | Severity |
|----------|----------------|----------------|--------|----------|
| Card hover translate | `group-hover:-translate-y-1` (4px) via GlassCard | `-translate-y-0.5` (2px) | MINOR | Double the lift |

**Discrepancy D-13.3: Card hover lift too large**
- Virtuna: 4px lift (`translate-y-1` = 4px in Tailwind)
- Raycast: 2px lift (`translate-y-0.5` = 2px)
- Severity: **MINOR** -- subtle but contributes to "heavier" feel
- Affected: `GlassCard` hover="lift" variant
- Fix: Change to `group-hover:-translate-y-0.5`.

---

## 14. Z-Index Scale

| Token | Virtuna Current | Reasonable Scale | Match? |
|-------|----------------|-----------------|--------|
| `--z-base` | `0` | Standard | MATCH |
| `--z-sidebar` | `50` | Standard | MATCH |
| `--z-dropdown` | `100` | Standard | MATCH |
| `--z-sticky` | `200` | Standard | MATCH |
| `--z-modal-backdrop` | `300` | Standard | MATCH |
| `--z-modal` | `400` | Standard | MATCH |
| `--z-toast` | `500` | Standard | MATCH |
| `--z-tooltip` | `600` | Standard | MATCH |

**Verdict:** MATCH. Well-structured z-index scale.

---

## 15. Philosophical/Systemic Discrepancies

### 15.1 GlassPanel Tinting System
| Property | Virtuna Current | Raycast Target | Severity |
|----------|----------------|----------------|----------|
| Colored glass tints | 7 color tints (neutral, purple, blue, pink, cyan, green, orange) | NO colored tinting anywhere | **CRITICAL** |
| Inner glow | Configurable per-panel | No inner glow | **CRITICAL** |
| GradientGlow component | Ambient colored glow behind panels | No ambient glow | **CRITICAL** |
| GradientMesh component | Multi-color animated mesh backgrounds | No mesh backgrounds | **CRITICAL** |

**Discrepancy D-15.1: The entire Virtuna glassmorphism system is iOS 26 / liquid glass, NOT Raycast**
- This is the BRAND-BIBLE's original design direction: "iOS 26 Liquid Glass + Raycast Premium Aesthetic"
- Raycast's actual aesthetic: Clean, dark, minimal. No colored tinting, no glow. Color only for accents.
- Severity: **CRITICAL** -- Fundamental design philosophy mismatch
- Affected: `GlassPanel`, `GlassCard` (primitives), `GlassPill`, `GradientGlow`, `GradientMesh`, all consumers
- Fix options:
  1. **Full alignment:** Strip all colored tinting, glow, mesh from components. Make them simple transparent panels with border + inset highlight. This removes Virtuna's distinctive identity.
  2. **Selective alignment (RECOMMENDED):** Keep tinting/glow for marketing/landing pages (Virtuna branding), but use Raycast-pure styling for the app dashboard. Two styling modes.
  3. **Layered approach:** Add a `variant="raycast"` to GlassPanel that gives the clean Raycast style, keeping the current as `variant="liquid"`.

### 15.2 BRAND-BIBLE is Inaccurate
| BRAND-BIBLE Claim | Actual Raycast | Severity |
|--------------------|----------------|----------|
| `bg-base: oklch(0.13 0.02 264) / #0A0A0B` | `#07080a` | MAJOR -- wrong hex |
| `surface: oklch(0.18 0.02 264) / ~#121214` | Cards are `bg-transparent` | CRITICAL |
| `surface-elevated: oklch(0.23 0.02 264) / ~#1A1A1E` | Only for modals | MAJOR |
| `text-secondary: oklch(0.70 0 0) / #B3B3B3` | `#9c9c9d` | MAJOR -- wrong value |
| `text-tertiary: oklch(0.50 0 0) / #808080` | `#6a6b6c` or `#848586` | MAJOR |
| Primary accent: `#E57850` | Virtuna coral = `oklch(0.72 0.16 40)` ~ `#FF7F50` | MAJOR -- wrong hex |
| radius-sm: `4px` | Raycast uses 4/6/8/12/16/20/24. BRAND-BIBLE says 4px for "pills, small badges" -- ok | MATCH |
| Button sm height: `32px` | Virtuna uses `36px` | MINOR |
| Button md height: `40px` | Virtuna uses `44px` | MINOR |
| Input border: `1px solid white/10` | Raycast: `rgba(255,255,255,0.05)` = 5% | MAJOR -- 10% vs 5% |

**Discrepancy D-15.2: BRAND-BIBLE should be updated or deprecated**
- Severity: **CRITICAL** for continued use as reference
- Multiple values are wrong compared to actual Raycast extraction
- Fix: Either update BRAND-BIBLE with correct values from MEMORY.md extraction, or mark it as deprecated and create a new accurate reference.

---

## Summary: All Discrepancies Ranked

### CRITICAL (5) -- Design philosophy wrong, must fix
| ID | Issue | Components Affected |
|----|-------|---------------------|
| D-7.2 | GlassPanel uses iOS 26 liquid glass, not Raycast glass | GlassPanel, all consumers |
| D-15.1 | Colored tinting/glow/mesh system is not Raycast | GlassPanel, GlassCard, GlassPill, GradientGlow, GradientMesh |
| D-1.2a | Cards use gradient background instead of bg-transparent | Card, FeatureCard |
| D-7.3b | Cards have backdrop-filter blur (Raycast cards don't) | GlassCard (card.tsx) |
| D-11.1 | Header uses solid bg instead of glass navbar | Header |

### MAJOR (10) -- Visually noticeable, should fix
| ID | Issue | Components Affected |
|----|-------|---------------------|
| D-1.2b | Input uses opaque surface bg instead of white/5 | Input, Select |
| D-1.3 | Missing card hover background (white/[0.03]) | Card, GlassCard, FeatureCard, VideoCard |
| D-3.3 | FeatureCard border 10% instead of 6% | FeatureCard |
| D-3.4 | FeatureCard hover border 20% instead of 10% | FeatureCard |
| D-5.5 | External glow shadows (not Raycast) | GlassPanel, GlassCard |
| D-6.5 | Body line-height 1.15 instead of 1.5 | Global body, all text |
| D-7.3c | Card hover states missing (lift, border, bg) | All card components |
| D-9.2 | Base Input diverges from GlassInput/Raycast | Input, InputField |
| D-15.2 | BRAND-BIBLE contains wrong values | Reference documentation |
| D-2.3 | Muted text color lighter than Raycast (intentional a11y) | Caption, placeholders |

### MINOR (8) -- Subtle, fix if doing pixel-perfect pass
| ID | Issue | Components Affected |
|----|-------|---------------------|
| D-2.1 | Primary text #fafafa vs Raycast #f4feff (negligible) | All text |
| D-3.5 | Base Input border 6% vs 5% | Input |
| D-3.6 | Mobile menu divider 10% vs 6% | Header |
| D-4.1 | GlassPanel/Sidebar uses 16px radius instead of 12px | GlassPanel, Sidebar |
| D-7.3a | Card inset shadow 15%/1px vs 10%/0px | GlassCard |
| D-8.4 | Button heights slightly taller than Brand Bible | Button (intentional for a11y) |
| D-9.2-h | Base Input height 44px vs 42px | Input |
| D-13.3 | Card hover lift 4px vs 2px | GlassCard |

### Intentional Deviations (keep as-is)
| ID | Issue | Rationale |
|----|-------|-----------|
| D-6.1 | Font family (Satoshi/Funnel vs Inter) | Virtuna brand identity |
| D-2.3 | Muted text lighter (#848586 vs #6a6b6c) | WCAG AA accessibility |
| D-8.4 | Button heights 36/44/48 vs 32/40/48 | Touch target accessibility |

---

## Recommended Fix Priority

### Phase 1: Critical Alignment (5 items)
1. Fix Card backgrounds to `bg-transparent` (D-1.2a)
2. Remove backdrop-filter from cards (D-7.3b)
3. Fix Header to use glass navbar pattern (D-11.1)
4. Add proper card hover states (D-7.3c, D-1.3)
5. Fix FeatureCard borders to use tokens (D-3.3, D-3.4)

### Phase 2: Major Alignment (5 items)
6. Fix body line-height to 1.5 (D-6.5)
7. Align base Input to Raycast pattern (D-9.2, D-1.2b)
8. Remove external glow shadows from default GlassPanel (D-5.5)
9. Add Raycast variant to GlassPanel or create separate component (D-7.2)
10. Update or deprecate BRAND-BIBLE (D-15.2)

### Phase 3: Minor Polish (8 items)
11. GlassPanel default radius to 12px (D-4.1)
12. Card inset shadow to 10%/0px (D-7.3a)
13. Card hover lift to 2px (D-13.3)
14. Input border to 5% (D-3.5)
15. Mobile menu divider to 6% (D-3.6)
16. Primary text color to #f4feff (D-2.1)
17. Base Input height to 42px (D-9.2-h)
18. Consider tinting system scope (D-15.1)

---

## Sources

- **HIGH confidence:** MEMORY.md "Raycast Design Language Rules" (extracted from live raycast.com CSS on 2026-02-06)
- **HIGH confidence:** globals.css @theme block (read directly from codebase)
- **HIGH confidence:** Component source files (read directly: button.tsx, card.tsx, input.tsx, dialog.tsx, GlassPanel.tsx, GlassCard.tsx, GlassInput.tsx, GlassPill.tsx, sidebar.tsx, header.tsx, feature-card.tsx, video-card.tsx, typography.tsx, select.tsx, badge.tsx, sidebar-nav-item.tsx)
- **MEDIUM confidence:** WebFetch of raycast.com (limited CSS extraction due to JS rendering)
- **LOW confidence:** BRAND-BIBLE.md (known to be inaccurate per project context)
