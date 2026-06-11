# Phase 1: Design System Foundation + Brand Migration - Pattern Map

**Mapped:** 2026-06-11
**Files analyzed:** 14 new/modified
**Analogs found:** 12 / 14

> Scope note: this is a NEW parallel `.numen-surface` kit (D-01/D-02). The closest analogs are the OLD Raycast/coral kit. **Copy STRUCTURE / mechanism (file shape, inline-style glass, `useReducedMotion` gate, `@theme inline` bridge, slot/variant API, test harness) — NOT values.** All coral/oklch/Raycast values are migration-FROM references, replaced by warm-neutral hex + verdict scale. Three hard inversions vs the analogs are flagged inline: (1) author dark hex not oklch (D-03), (2) use `tailwind-variants` slots not `cva` (D-08), (3) NEVER reuse `--ease-spring` (1.56 overshoot) and define a new calm easing token (D-14).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/globals.css` (MODIFY — append scope block) | config (token layer) | transform (CSS var → utility) | `src/app/globals.css` `@theme` + `@theme inline` (lines 6–215, 311–330) | exact (same file) |
| `src/app/layout.tsx` (MODIFY — add serif font) | config (font wiring) | request-response (SSR font inject) | `src/app/layout.tsx` Inter wiring (lines 2–10, 43) | exact (same file) |
| `src/components/numen/glass.tsx` | component (primitive) | transform (render) | `src/components/primitives/GlassPanel.tsx` | exact |
| `src/components/numen/pill-chip.tsx` (Tool chip) | component (primitive) | transform (render) | `src/components/primitives/GlassPill.tsx` (shape) + `ui/button.tsx` (variant API) | role-match |
| `src/components/numen/icon-button.tsx` | component (primitive) | transform (render) | `src/components/ui/button.tsx` (size/touch-target variants) | role-match |
| `src/components/numen/surface.tsx` | component (primitive) | transform (render) | `src/components/primitives/GlassPanel.tsx` (container shape) | role-match |
| `src/components/numen/verdict-swatch.tsx` | component (primitive) | transform (render) | `src/components/ui/badge.tsx` / `GlassPill` color map | role-match |
| `src/components/numen/stage-reveal.tsx` | component (motion) | event-driven (presence) | `src/components/motion/stagger-reveal.tsx` + `fade-in-up.tsx` | exact |
| `src/lib/tokens.ts` (optional TS mirror) | utility | — | `src/lib/utils.ts` (lib module convention) | partial |
| `src/app/(kit)/numen-kit/page.tsx` (showcase) | route (page) | request-response (SSR) | `src/app/(marketing)/primitives-showcase/page.tsx` | exact |
| `scripts/check-apca.ts` | utility (dev script) | batch (one-shot CLI) | — (no existing dev contrast/calibration script) | no analog |
| `docs/numen-migration-boundary.md` (DS-06 doc) | doc | — | — (no existing boundary doc) | no analog |
| `tests/numen/*.test.ts(x)` | test | — | `src/components/sidebar/__tests__/Sidebar.a11y.test.tsx` | role-match |
| (variant API install) `tailwind-variants` | config (dep) | — | `cva` usage in `ui/button.tsx` (the API it REPLACES) | partial |

## Pattern Assignments

### `src/app/globals.css` — APPEND scope block (config, token layer)

**Analog:** the same file's existing two-tier token system. **Copy the STRUCTURE; do NOT touch the existing `@theme` coral block (D-01).**

**Existing `@theme inline` bridge** — THE load-bearing precedent (`src/app/globals.css` lines 311–330). Repo already uses `@theme inline` for `--animate-marquee`, proving the mechanism Pattern-1/Pitfall-1 require:
```css
@theme inline {
  --animate-marquee: marquee var(--duration) infinite linear;
  /* ... */
}
```
New scope block follows Research Pattern 1: plain custom props under `.numen-surface` (EXACT HEX, D-03), bridged via a NEW `@theme inline` block mapping `--color-bg: var(--numen-bg)` etc. Do not put var-referencing tokens in a plain `@theme {}` block (Pitfall 1 — resolves to empty under the scope).

**Existing hex-for-dark precedent already in the file** (lines 28–38) — confirms the D-03 rule is already practiced here:
```css
  --color-gray-900: #1a1b1e;   /* rgb(26,27,30) — Raycast elevated surface */
  --color-gray-950: #07080a;   /* rgb(7,8,10) — Raycast body background */
```
Note: `--color-gray-950: #07080a` IS the cold base the new `--numen-bg: #1a1714` warm base replaces (and that the DS-06 audit inventories — 5 files).

**Existing `@custom-variant dark` to stack on** (line 4): `@custom-variant dark (&:is(.dark *));` — keep as-is; the `.numen-surface` scope stacks under it (`.dark .numen-surface { … }`).

**DO NOT carry into the Numen kit** (anti-pattern, D-07): `--animate-shimmer` / `gradient-x` keyframes (lines 201–202, 255–274), all coral scale (15–23), all gradient tokens (189–196). These are the "AI-spaceship" effects §6 forbids.

---

### `src/app/layout.tsx` — ADD serif voice font (config, font wiring)

**Analog:** same file's Inter wiring (lines 2–10, 43). Extend the identical pattern for `--font-serif`.

**Existing pattern to mirror** (`src/app/layout.tsx`):
```typescript
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
// ...
<html lang="en" className={`${inter.variable}`}>
```
New (Research Pattern 4 / D-13): add `Source_Serif_4({ subsets:["latin"], display:"swap", variable:"--font-serif" })`, append `${serif.variable}` to the `<html>` className, and bridge `--font-serif` through the new `@theme inline`. Variable font → no `weight` array. Serif applies ONLY to voice slots (greeting/hero + verdict line) per UI-SPEC Typography.

---

### `src/components/numen/glass.tsx` (component, primitive)

**Analog:** `src/components/primitives/GlassPanel.tsx` — near-exact mechanism match. **This is the canonical proof that inline `backdropFilter` is the project workaround (D-05, Lightning CSS).**

**Inline backdrop-filter pattern to copy** (`GlassPanel.tsx` lines 40–57):
```tsx
<Component
  className={cn("rounded-[12px] border border-white/[0.06]", className)}
  style={{
    background: "linear-gradient(137deg, rgba(17,18,20,0.75) 4.87%, rgba(12,13,15,0.9) 75.88%)",
    backdropFilter: "blur(5px)",
    WebkitBackdropFilter: "blur(5px)",
    boxShadow: "rgba(255,255,255,0.15) 0px 1px 1px 0px inset",
    ...style,
  }}
>
```
**Copy:** the `style={{ backdropFilter, WebkitBackdropFilter, ...style }}` mechanism, the `as` polymorphic prop, the `cn(base, className)` merge, `"use client"`.
**INVERT (do NOT copy values):** drop the Raycast gradient + inset glow. New glass uses `bg-panel/70` + `border-border` (warm tokens) and a configurable `blur` prop (Research Pattern 5 default 12px). Glass is RARE — composer + tool-sheet only (UI-SPEC). Verify on a DEPLOYED build.

---

### `src/components/numen/pill-chip.tsx` — Tool chip (component, primitive)

**Analog (shape):** `src/components/primitives/GlassPill.tsx`. **Analog (variant API):** `src/components/ui/button.tsx`.

**Full-pill shape + interactive-element + a11y from GlassPill** (`GlassPill.tsx` lines 108–131):
```tsx
const Component = onClick ? "button" : "span";
// ...
className={cn(
  "inline-flex items-center justify-center rounded-full font-medium",
  "transition-all duration-200",
  isInteractive && "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
  className
)}
```
**Copy:** `rounded-full`, `inline-flex items-center`, the button-vs-span polymorphism, `focus-visible:ring` pattern.
**INVERT — build with `tailwind-variants` slots, NOT GlassPill's hardcoded `colorValues` map and NOT `cva`** (D-08). Use Research Pattern 2: `tv({ slots: { root, icon, label }, variants: { intent: { instant, agentic } }, compoundVariants })`, composed through `cn()`. The `intent` variants (instant vs agentic) must be visually distinct for later TOOL-04. Hairline warm border (`border-border`), near-neutral fill — NO glass on the chip.

**Variant-API + `VariantProps` typing precedent** (`ui/button.tsx` lines 32–80, 85–87) — copy this STRUCTURE but swap `cva` → `tv`:
```typescript
export interface ButtonProps extends ..., VariantProps<typeof buttonVariants> {}
// tailwind-variants exposes the same `VariantProps<typeof toolChip>` helper.
```

---

### `src/components/numen/icon-button.tsx` (component, primitive)

**Analog:** `src/components/ui/button.tsx` — for the touch-target sizing discipline.

**44px touch-target sizing precedent** (`ui/button.tsx` lines 69–73):
```typescript
size: {
  sm: "h-9 min-h-[36px] min-w-[36px] px-3 text-sm rounded-md",
  md: "h-11 min-h-[44px] min-w-[44px] px-4 text-sm rounded-md",
  lg: "h-12 min-h-[48px] min-w-[48px] px-6 text-base rounded-md",
},
```
**Copy:** the `min-h/min-w` 44px floor (UI-SPEC: circular icon button MUST meet 44px hit area even when the icon is smaller), `focus-visible:ring` (line 38), `disabled:opacity-50` (line 41).
**INVERT:** `rounded-full` (not `rounded-md`), icon resting at `text-text-muted` (UI-SPEC), warm-neutral fill, built with `tailwind-variants` not `cva`. Icons = Lucide (`lucide-react`, D-09) — NOT the Phosphor `ui/icon.tsx` wrapper (Phosphor is escalation-only, D-09).

---

### `src/components/numen/surface.tsx` (component, primitive)

**Analog:** `src/components/primitives/GlassPanel.tsx` (container shape only).

**Container shape to copy** (`GlassPanel.tsx` lines 6–14, 41–45): the `{ children, className, style, as }` 4-prop API + `cn("rounded-[12px] border …", className)`.
**INVERT:** NO glass, NO Raycast inset-glow. Surface = hairline warm border (`border-border` → `--numen-border` rgba(240,235,227,0.06)), `bg-panel`, radius `lg` (12px), **soft elevation** (subtle shadow, not the `rgba(255,255,255,0.15) inset` Raycast glow). Plain `<div>` — no `backdropFilter`.

---

### `src/components/numen/verdict-swatch.tsx` (component, primitive)

**Analog:** `src/components/ui/badge.tsx` / `GlassPill` color map (named-color token pattern).
**Pattern:** three named verdict tokens (`--color-verdict-good|mixed|bad`) surfaced as swatches. Any text on a swatch meets APCA Lc ≥ 60 (validated by `scripts/check-apca.ts`). Muted, not saturated. Amber "mixed" is first-class — never styled as error (UI-SPEC Color). Build with `tailwind-variants` `variants: { verdict: { good, mixed, bad } }` referencing the bridged utilities (`bg-verdict-good` etc.). Class strings must be literal (Pitfall 5 — no `bg-${x}` interpolation).

---

### `src/components/numen/stage-reveal.tsx` (component, motion)

**Analog:** `src/components/motion/stagger-reveal.tsx` + `fade-in-up.tsx` — exact mechanism match (already use `motion` + `useReducedMotion`).

**`useReducedMotion` gate to copy** (`stagger-reveal.tsx` lines 1–3, 51–54):
```typescript
import { motion, useReducedMotion } from "motion/react";
// ...
const prefersReducedMotion = useReducedMotion();
if (prefersReducedMotion) {
  return <div className={className}>{children}</div>;  // static — no translate
}
```
**Copy:** the `"use client"` + `motion/react` import, the `useReducedMotion()` early-return-to-static gate (D-14 hard requirement), `Variants` typing.
**INVERT — the easing/transition** (D-14): use `AnimatePresence` for the stage-reveal (Research Pattern 3), opacity via tween cubic-bezier `[0.215, 0.61, 0.355, 1]`, physical props via spring with **damping ratio ≥ 1** (no overshoot). The analogs' eases (`[0.25, 0.1, 0.25, 1.0]`) are fine (calm); but **NEVER use the `--ease-spring: cubic-bezier(0.34,1.56,0.64,1)` token** from globals.css line 170 — the `1.56 > 1` bounces, which §6 forbids. Define a NEW calm easing token. Stage-reveal is the ONE key motion moment — no presence theater elsewhere.

---

### `src/app/(kit)/numen-kit/page.tsx` — showcase route (route, page)

**Analog:** `src/app/(marketing)/primitives-showcase/page.tsx` — exact (existing kit-showcase page).

**Showcase structure to copy** (`primitives-showcase/page.tsx` lines 3–6, 8–18):
```tsx
export const metadata = { title: "...", description: "..." };

export default function PrimitivesShowcasePage() {
  return (
    <div className="min-h-screen ... p-8 md:p-16">
      <h1 className="...">Primitives Showcase</h1>
      <section className="mb-16">{/* one section per primitive */}</section>
```
**Copy:** the `metadata` export, the section-per-primitive layout, the wrapping page div.
**INVERT:** mount inside `<div className="numen-surface dark">` so the new primitives render under LIVE warm tokens (Q9). Keep SEPARATE from the old `primitives-showcase` / `(marketing)/showcase` (parallel kit, D-01) — put under a `(kit)` route group. Doubles as the serif-specimen surface (Source Serif 4 vs Newsreader, D-13) and the deployed-build glass check (D-05). Uses Lucide icons.

---

### `tests/numen/*.test.ts(x)` (test)

**Analog:** `src/components/sidebar/__tests__/Sidebar.a11y.test.tsx` — the project Vitest + happy-dom + vitest-axe harness.

**Test harness to copy** (`Sidebar.a11y.test.tsx` lines 1–4, 38–41):
```typescript
/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
// ...
const { container } = render(<Sidebar />);
const results = await axe(container);
```
**Copy:** the `@vitest-environment happy-dom` pragma, the `render` + `axe` a11y pattern, `vi.mock` for any module-load side-effects. Run via `pnpm vitest run <file>` (package.json `"test": "vitest run"`). Wave-0 test files per Research §Validation: `tokens.test.ts` (resolved-var assertions), `type.test.ts`, `glass.test.ts` (assert inline `backdropFilter` present), `primitives.test.ts` (tv slot output), `stage-reveal.test.ts` (mock `useReducedMotion`).

## Shared Patterns

### Class merge — `cn()`
**Source:** `src/lib/utils.ts` lines 12–14 (`clsx` + `tailwind-merge`).
**Apply to:** every primitive (glass, pill-chip, icon-button, surface, verdict-swatch).
```typescript
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```
`tailwind-variants` runs `tailwind-merge` internally, but still pass caller `className` through `cn()` so external overrides win predictably (Research Pattern 2).

### Inline backdrop-filter (Lightning CSS workaround)
**Source:** `src/components/primitives/GlassPanel.tsx` lines 46–53.
**Apply to:** `glass.tsx` only (glass is rare). NEVER a `backdrop-blur-*` class — stripped in prod by Lightning CSS (D-05). Include `WebkitBackdropFilter` for Safari/iOS PWA.

### `useReducedMotion` static-fallback gate
**Source:** `src/components/motion/stagger-reveal.tsx` lines 51–54, `fade-in-up.tsx` lines 68–72.
**Apply to:** `stage-reveal.tsx` (and any future motion in the kit). Reduced motion → static opacity appear, no slide/translate (D-14, accessibility, not optional).

### `@theme inline` token bridge
**Source:** `src/app/globals.css` lines 311–330 (existing `--animate-marquee` precedent).
**Apply to:** the new `.numen-surface` token layer. Var-referencing semantic tokens MUST go in `@theme inline`, never plain `@theme` (Pitfall 1).

### Variant API — `tailwind-variants` (REPLACES `cva`)
**Source pattern (structure):** `src/components/ui/button.tsx` lines 32–87 (`cva` + `VariantProps`).
**Apply to:** all multi-part / variant primitives (pill-chip, icon-button, verdict-swatch). **Swap `cva` → `tv` (D-08)** — `cva` is dead Raycast-era legacy with no cross-slot compound variants. New install gated behind `checkpoint:human-verify` (Research §Package Legitimacy).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `scripts/check-apca.ts` | utility (dev script) | batch | No existing APCA/contrast/calibration script. `wcag-contrast` is installed but WCAG-2 (wrong metric, D-12). Build fresh from Research §Code Examples (`apca-w3`: `APCAcontrast(sRGBtoY(colorParsley(text)), sRGBtoY(colorParsley(bg)))`). |
| `docs/numen-migration-boundary.md` | doc | — | No existing boundary/audit doc. Build fresh: one row per costume target, columns `Target \| Files/Count \| Surface(s) \| v5.0 Disposition \| Owning Phase`. Counts pre-measured in Research Q8 / UI-SPEC Migration Boundary. Widen grep for chat dock before concluding absent. |

## Metadata

**Analog search scope:** `src/app/` (globals.css, layout.tsx, route groups), `src/components/primitives/` (Glass* kit, TrafficLights), `src/components/ui/` (button/badge/icon — cva kit), `src/components/motion/` (stagger-reveal, fade-in-up), `src/lib/`, `src/**/__tests__/`, `scripts/`, `docs/`.
**Files scanned:** ~18 read in full or in part.
**Pattern extraction date:** 2026-06-11
**Retirement targets located (DS-06):** `src/components/primitives/TrafficLights.tsx` (fake macOS chrome), all `GlassPanel`/`GlassPill`/`Glass*` (10+ files), coral scale in `globals.css`, `--ease-spring` bounce token, shimmer/gradient keyframes — all DEFER-delete per D-04 (document only).
