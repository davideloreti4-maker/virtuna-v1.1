# Live Raycast vs Virtuna Audit — 2026-02-08

Extracted by browsing live raycast.com and localhost:3000 (worktree build) side-by-side.

**IMPORTANT:** Dev server must run from `~/virtuna-v2.3.5-design-token/` (worktree), NOT `~/virtuna-v1.1/` (main). Kill any stale server: `lsof -i :3000 -sTCP:LISTEN` then `kill <PID>`, then `npm run dev` from worktree.

---

## 1. CARD — 3 fixes needed

### Current (WRONG)
```
File: src/components/ui/card.tsx (Card component, line 51-67)

background: var(--gradient-card-bg)
  → computes to: linear-gradient(137deg, rgb(17,18,20) 4.87%, rgb(12,13,15) 75.88%)
  → This is an OPAQUE gradient. Cards should NOT have a gradient background.

boxShadow: rgba(255, 255, 255, 0.1) 0px 1px 0px 0px inset
  → 10% opacity inset shadow. Should be 5%.

hover classes: hover:-translate-y-0.5 hover:border-border-hover hover:bg-white/[0.03]
  → Lift + border brighten + white overlay. Raycast does NOT do this.
```

### Raycast (CORRECT) — extracted from live `.ExtensionCard_card__7dfiV`
```css
/* Card base */
border-radius: 12px;
border: 1px solid rgba(255, 255, 255, 0.06);
background: transparent;                              /* NOT gradient */
box-shadow: rgba(255, 255, 255, 0.05) 0px 1px 0px 0px inset;  /* 5%, NOT 10% */
padding: 32px;
transition: background-color 0.15s ease-in-out;

/* Card hover — uses ::after pseudo-element, NOT translate-y */
/* Base ::after: */
.card::after {
  position: absolute;
  inset: 0;
  content: "";
  border-radius: var(--rounding-md);  /* same as card */
  z-index: -1;
  background-image: radial-gradient(100% 100% at 50% 0, var(--grey-700) 0, var(--grey-600) 150%);
  opacity: 0;
  transition: opacity 0.15s ease-in-out;
  will-change: opacity;
}
/* Hover ::after: */
.cardWrapper:has(:hover) .card::after {
  opacity: 1;
}

/* NO translate-y, NO border change on hover */
```

### Fix instructions
1. **Card background**: Change from `var(--gradient-card-bg)` to `transparent`
2. **Card inset shadow**: Change from `0.1` to `0.05`
3. **Card hover**: Remove `hover:-translate-y-0.5 hover:border-border-hover hover:bg-white/[0.03]`. Instead, add `relative overflow-hidden` and implement `::after` radial gradient hover via a pseudo-element (or a simple `hover:bg-white/[0.02]` for a simpler approximation — Raycast's hover is very subtle)
4. **CSS variable `--gradient-card-bg`**: Either remove it or keep for other uses, but Card should NOT reference it

### GlassCard (same file)
GlassCard currently has the same wrong hover classes. Apply same fix.

---

## 2. HEADER — structural mismatch (floating pill)

### Current (WRONG)
```
File: src/components/layout/header.tsx

<header className="sticky top-0 z-50 w-full border-b border-border">
  → Full-width bar, border-bottom only, no border-radius
  → height: 65px
```

### Raycast (CORRECT) — extracted from live `.Navbar_navbar__XlgWY`
```css
/* Outer wrapper (parent of navbar) */
.navbarWrapper {
  padding: 16px 16px 0px;  /* gap from viewport edges */
  display: flex;
  justify-content: center;
  position: sticky;
  top: 0;
  z-index: 50;
}

/* Navbar pill */
.navbar {
  border-radius: 16px;
  max-width: 1204px;
  width: 100%;
  height: 76px;
  padding: 16px 32px;

  background: linear-gradient(137deg, rgba(17,18,20,0.75) 4.87%, rgba(12,13,15,0.9) 75.88%);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.06);  /* ALL sides, not just bottom */
  box-shadow: rgba(255, 255, 255, 0.15) 0px 1px 1px 0px inset;
}
```

### Fix instructions
1. Change header structure from full-width bar to floating pill:
   - Add a wrapper div with `padding: 16px 16px 0`, `display: flex`, `justify-content: center`, `sticky top-0 z-50`
   - Move glass styles to inner navbar div
   - Add `rounded-2xl` (16px), `max-w-[1204px]`, `w-full`
   - Change `border-b` to `border` (all sides)
   - Add `mx-auto` for centering
2. Height: increase padding to match ~76px
3. The glass gradient/blur/shadow values are already correct in the inline styles

---

## 3. FEATURED CARD (Raycast) — slightly different radius

```css
/* Featured extension cards use 10px radius */
.FeaturedExtensionCard_card__gJLxu {
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: transparent;
  box-shadow: rgba(255, 255, 255, 0.05) 0px 1px 0px 0px inset;
  padding: 32px;
}
/* Same hover pattern as regular cards */
```

Our Card component uses 12px which matches the regular Raycast extension card. This is fine.

---

## 4. BUTTONS — reference values

### Raycast Download button (primary/light CTA)
```css
border-radius: 8px;
background: rgb(230, 230, 230);  /* light gray, not white */
color: rgb(47, 48, 49);         /* dark text */
font-weight: 500;
font-size: 14px;
padding: 8px 12px;
height: 36px;
box-shadow: rgba(0,0,0,0.5) 0px 0px 0px 2px,
            rgba(255,255,255,0.19) 0px 0px 14px 0px,
            rgba(0,0,0,0.2) 0px -1px 0.4px 0px inset,
            rgb(255,255,255) 0px 1px 0.4px 0px inset;
```

### Raycast Install button (secondary/dark)
```css
border-radius: 8px;
background: linear-gradient(rgba(255,255,255,0.03), rgba(255,255,255,0.1));
box-shadow: complex multi-layer;
```

### Virtuna "Book a Meeting" (coral CTA)
```css
border-radius: 4px;   /* should be 8px to match Raycast */
background: coral accent;
font-weight: 400;     /* should be 500 */
```

### Virtuna "Get in touch" (secondary)
```css
border-radius: 8px;   /* ✓ correct */
border: 1px solid rgba(255,255,255,0.06);  /* ✓ correct */
background: transparent;  /* ✓ correct */
height: 44px;
```

---

## 5. SEARCH INPUT (Raycast Store)
```css
border-radius: 12px;
border: 1px solid rgb(47, 48, 49);  /* solid color, not white/5% */
background: rgb(12, 13, 15);        /* solid dark, not white/5% */
height: 51.25px;
padding: 16px;
```

Note: This is the store search, different from form inputs. Our Input at 42px/white-5%/8px may be for form contexts (different from large search bars).

---

## 6. CSS VARIABLES — current values in globals.css @theme

```
--gradient-card-bg: linear-gradient(137deg, #111214 4.87%, #0c0d0f 75.88%)
  → PROBLEM: Opaque. Card should use bg-transparent, not this gradient.
  → This variable may still be useful for other surfaces, but Card should not use it.

--gradient-navbar: linear-gradient(137deg, #111214bf 4.87%, #0c0d0fe6 75.88%)
  → ✓ Correct (semi-transparent, matches Raycast exactly)

--gradient-glass: linear-gradient(137deg, #111214bf 4.87%, #0c0d0fe6 75.88%)
  → ✓ Same as navbar (correct)

--color-border: #ffffff0f  → ~6% ✓
--color-border-hover: #ffffff1a → ~10% (not used by Raycast cards on hover, but kept for interactive elements)
```

---

## PRIORITY ORDER FOR FIXES

### P0 — Card visual (Phase 54 scope, most visible)
1. Card `background: transparent` instead of gradient
2. Card `box-shadow` opacity 0.05 instead of 0.1
3. Card hover: remove lift/border-change, add subtle bg change or ::after

### P1 — Header floating pill (Phase 54 scope HEAD-01/HEAD-02)
4. Restructure header from full-width bar to floating pill with 16px radius

### P2 — Button refinements
5. CTA button border-radius 4px → 8px
6. CTA button font-weight 400 → 500

---

## FILES TO MODIFY

- `src/components/ui/card.tsx` — Card background, shadow, hover (P0)
- `src/components/layout/header.tsx` — Floating pill structure (P1)
- `src/app/globals.css` — Maybe update/remove --gradient-card-bg (P0)
- `src/components/ui/button.tsx` — CTA button radius/weight (P2, check current)

---

## VERIFICATION METHOD

After fixes, compare live side-by-side:
1. Open Raycast store: https://www.raycast.com/store
2. Open Virtuna showcase: http://localhost:3000/showcase/data-display
3. Use browser DevTools to compare computed values
4. Card should appear nearly invisible on dark bg (transparent + subtle border)
5. Header should float as a pill with rounded corners and gap from edges
