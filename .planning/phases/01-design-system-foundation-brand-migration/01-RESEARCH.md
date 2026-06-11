# Phase 1: Design System Foundation + Brand Migration - Research

**Researched:** 2026-06-11
**Domain:** Design-system foundation on Tailwind v4 / Next 16 — token layer, type system, motion system, primitive vocabulary, brand-retirement audit
**Confidence:** HIGH (library mechanics verified via Context7 + npm registry; design direction is pre-locked by CONTEXT.md)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Parallel namespaced token layer. New warm-neutral kit coexists with the live app WITHOUT touching existing coral/Raycast tokens in `globals.css`. Old pages keep working; Numen surface opts in. Retirement per-surface in later phases. (Rejected: global `globals.css` replacement; route-group-scoped CSS.)
- **D-02:** Coexistence mechanism = **scope class** (`.numen-surface`), not a global `@theme` swap. New tokens are CSS variables overridden under the scope class, Tailwind v4 multi-theme pattern, stacking on the existing `@custom-variant dark`. Semantic token names (`--color-bg`, `--color-panel`, `--color-text`, `--color-verdict-good|mixed|bad`, `--color-accent`), declared via `@layer theme`. File location/structure = planner's call.
- **D-03:** L<0.15 dark tokens authored as **exact hex, NOT oklch** (Tailwind v4 oklch bug). Hard rule for the whole dark palette.
- **D-04:** DS-06 = **audit + decision doc only in Phase 1 — delete nothing live.** Grep inventory (`#07080a` / `#FF7F50` / coral / GlassPanel-everywhere / fake macOS chrome / chat dock) + written boundary doc (replaces vs defers, per-surface). Known targets: `src/components/primitives/TrafficLights.tsx`, `src/components/sidebar/Sidebar.tsx`.
- **D-05:** Build scope = **foundation + core primitives + showcase.** Tokens + type + motion PLUS load-bearing primitives: full-pill tool chip, circular icon button, hairline-border/soft-elevation surface, glass primitive (inline `backdropFilter`), verdict-color swatches. (Rejected: tokens-only; full component kit.)
- **D-06:** Kit showcase = **custom Next.js route, NOT Storybook.** Deploys with the app → satisfies "verified on deployed build." Location = planner's call.
- **D-07:** Libraries = permitted toolkit, picks delegated to research/planning. Radix (installed) as unstyled behavior layer; motion + curated copy-in (Magic UI / Aceternity) ONLY re-skinned to warm-neutral. **Hard rule: no neon/gradient/beam/glow/shimmer ships as-is.** Radix cadence slowed post-WorkOS; **Base UI** is the forward option per-primitive (no wholesale migration).
- **D-08:** Variant API = **tailwind-variants** (slots + compound variants; v1+ supports Tailwind v4). Repo has `clsx` + `tailwind-merge` (`cn`). tailwind-variants not yet installed.
- **D-09:** Icons = **Lucide only** (installed). Phosphor = sanctioned escalation ONLY if a verdict/active-state multi-weight need surfaces. No dual icon sets upfront.
- **D-10:** Motion lib = **`motion`** (formerly Framer Motion); opacity = tween easing, springs only on physical props. `AnimatePresence`/stage-reveal = right tool. **Cleanup: repo has BOTH `motion` and `framer-motion` — standardize on `motion`, drop `framer-motion`.**
- **D-11:** Claude proposes a calibrated palette for approval. Derive against warm-neutral base (~`#1a1714`): clay accent evolved from `#FF7F50` + verdict scale (muted green / amber / clay-red). Render swatches/hexes during planning; user final say. All darks exact hex.
- **D-12:** Calibrate with **APCA-aware contrast checks**, not WCAG 2 alone.
- **D-13:** Functional sans stays **Inter**. **Voice serif** for greeting/hero + verdict line; lead = **Source Serif 4**, alt = **Newsreader** to specimen. Fraunces only low-optical-size. Wire via `next/font/google`, variable, self-hosted, `--font-serif`.
- **D-14:** Motion tokens = semantic tiers (duration instant/fast/base/slow; easing families). Stage-reveal = the one key motion moment; no "presence" theater. **`prefers-reduced-motion` MUST be honored** — stage-reveal degrades to static appear (no slide/translate) via `useReducedMotion`.

### Claude's Discretion
- Exact token file structure / naming within the parallel layer.
- Showcase route path/location.
- Per-primitive Radix-vs-Base-UI calls.
- Final serif pick after specimen pass.
- Motion-timing token numeric values + fluid type/spacing scale.
- Whether to use View Transitions API (Next 16) — likely defer to Phase 4.

### Deferred Ideas (OUT OF SCOPE)
- Active deletion of live old-app code (chat dock, TrafficLights, GlassPanel, hardcoded coral) — each surface's own rebuild phase.
- View Transitions API for cross-fade/document settle — likely Phase 4.
- Phosphor icon adoption — only if verdict/active-state weight need emerges.
- Base UI migration — per-primitive, only when a Radix primitive proves stale.
- Desktop instrument density / Konva keep-vs-retire — Phase 7.
- Shareable image-card vs link mechanics — later phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DS-01 | Warm-neutral dark token system, L<0.15 darks as exact hex | Q1 (scope-class `@theme inline` + `@layer theme` pattern); D-03 hex rule confirmed against Tailwind v4 oklch behavior |
| DS-02 | Verdict color scale (green/amber/clay-red) = only load-bearing functional color | Q4 (APCA Lc targets for each verdict swatch on `#1a1714`); palette calibration via APCA |
| DS-03 | Brand accent = coral matured to warm clay/terracotta, used sparingly | Q4 (APCA on accent); palette calibration task; exact hex authoring |
| DS-04 | Sans-led type, serif reserved for voice | Q5 (Source Serif 4 / Newsreader variable axes + `next/font/google` wiring; `--font-serif`) |
| DS-05 | Component vocabulary + glass primitive (backdrop-filter via inline style) | Q2 (tailwind-variants slots for multi-part primitives), Q7 (Lightning CSS inline-style pattern) |
| DS-06 | Migration boundary — inventory + boundary doc | Q8 (grep/ripgrep patterns + measured counts + boundary-doc format) |
| DS-07 | Calm motion system; stage-reveal is the key moment | Q3 (motion tween-vs-spring, `useReducedMotion`), motion token tiers |
| DS-08 | Keyframes ARE the chroma; warm-neutral chrome recedes | Validated by §6; encoded as a kit principle — chrome tokens near-neutral so video stills carry color. Verifiable in showcase. |
</phase_requirements>

## Summary

Every open question in this phase is an *implementation HOW*, not a direction question — direction is locked. The library mechanics resolve cleanly against current versions: Tailwind v4's canonical multi-theme pattern is exactly what D-02 describes (CSS variables overridden under a scope selector, surfaced to utilities via `@theme inline`), `tailwind-variants` v3.2.2 officially supports Tailwind v4 + `tailwind-merge` v3 (both already satisfied here), and `motion` v12.40.0 provides `AnimatePresence` + `useReducedMotion` with the exact tween/spring split D-10/D-14 mandate. The one genuine landmine is a Tailwind v4 CSS-variable resolution subtlety (`@theme inline` vs plain `@theme`) that, if mishandled, silently makes scoped overrides resolve to the wrong value — documented in detail below.

Two CONTEXT assumptions need a small correction the planner should know: (1) `tailwind-variants` is now at **v3.2.2**, not "v1" — the v3.x line is the Tailwind-v4-compatible release (v0.x was the old TW-v3 line); the install is still trivial and composes with the existing `cn()`. (2) `class-variance-authority` (cva) and `wcag-contrast` + `@types/wcag-contrast` are **already installed** — cva is unused legacy from the Raycast kit (the new kit standardizes on tailwind-variants per D-08); `wcag-contrast` exists but is WCAG-2, so an APCA tool must be added for D-12.

**Primary recommendation:** Declare warm-neutral semantic tokens as plain CSS custom properties scoped under `.numen-surface` (and stacked on `.dark`), then expose them to Tailwind utilities via a single `@theme inline` block that maps `--color-bg` → `var(--numen-bg)` etc. Author all dark values as exact hex. Build primitives with `tailwind-variants` `tv({ slots, variants, compoundVariants })` composed through `cn()`. Encode the glass primitive's `backdropFilter` as a React inline `style` prop (never a class). Use `motion`'s `useReducedMotion` to gate every translate/slide in the stage-reveal. Add `apca-w3` as a dev-only contrast-check script. Keep Radix where installed (Phase-1 primitives are mostly custom and need no behavior layer); flag Base UI only as a future per-primitive option.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Token layer (CSS variables under scope class) | Browser / Client (CSS) | Build (Tailwind/Lightning CSS) | Tokens are CSS custom properties resolved by the browser; Tailwind generates utilities at build |
| Type loading (`next/font/google`) | Frontend Server (SSR) | Build | `next/font` self-hosts + injects `<style>` at build/SSR; zero client font-fetch |
| Motion / stage-reveal | Browser / Client | — | `motion` is a client-runtime library; reveal components are `'use client'` |
| Glass primitive (inline backdrop-filter) | Browser / Client | — | Runtime inline style; survives Lightning CSS because it never enters the CSS pipeline |
| Variant resolution (tailwind-variants) | Browser / Client (class strings) | Build (Tailwind scans classes) | `tv()` produces class strings at render; Tailwind must see them statically to generate CSS |
| Showcase route | Frontend Server (SSR) | Browser | App Router page rendered server-side, hydrated for interactive primitives |
| Retirement audit | Build/Tooling (grep) | — | Pure static analysis; produces a doc, no runtime |

## Standard Stack

### Core (already installed — no new install)
| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `tailwindcss` | ^4 | Utility CSS + token engine | Project standard; v4 `@theme`/`@theme inline` is the token mechanism |
| `@tailwindcss/postcss` | ^4 | Tailwind v4 PostCSS plugin | Required for Next 16 build |
| `motion` | 12.29.2 (latest 12.40.0) | Stage-reveal animation (`AnimatePresence`, `useReducedMotion`) | D-10 lock; tween/spring control fits "no bounce" |
| `clsx` + `tailwind-merge` | 2.1.1 / 3.4.0 | `cn()` class merge | Existing convention (`src/lib/utils.ts`); tailwind-merge >=3 satisfies tailwind-variants peer dep |
| `lucide-react` | 0.563.0 | Icons | D-09 lock |
| `@radix-ui/*` + `radix-ui` | various / 1.4.3 | Unstyled behavior layer (when needed) | D-07; installed |
| `next` | 16.1.5 | App Router, `next/font` | Project standard |

### Supporting (NEW installs needed)
| Library | Version to install | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tailwind-variants` | ^3.2.2 `[VERIFIED: npm registry, but name from CONTEXT — see Package Legitimacy Audit]` | Slots + compound variants for multi-part primitives (D-08) | All multi-part primitives (pill chip, glass surface, icon button) |
| `apca-w3` | ^0.1.9 (dev) `[VERIFIED: npm registry; reference impl by Myndex/W3C]` | APCA Lc contrast scoring for palette calibration (D-12) | Dev-only calibration/verification script, not shipped to client |

### Fonts to add (via `next/font/google`, no npm install)
| Font | Axes | Role | Notes |
|------|------|------|-------|
| Source Serif 4 | wght 200–900, opsz | Voice serif (lead) `[CITED: fonts.google.com/specimen/Source+Serif+4]` | Adobe; variable; screen-optimized; opsz softens serifs + lifts x-height at small sizes |
| Newsreader | wght, opsz | Voice serif (alt to specimen) `[CITED: pimpmytype.com/font/newsreader]` | Google-commissioned for on-screen reading; sturdier strokes |
| Fraunces | wght, opsz, SOFT, WONK | Only at LOW opsz if used `[CITED: fonts.google.com/specimen/Fraunces]` | Risks decorative against §6; specimen only |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `tailwind-variants` | `class-variance-authority` (cva, already installed) | cva has NO slots/compound-variant-across-slots; D-08 chose tv specifically for multi-part primitives. cva is dead Raycast-era legacy — do NOT build new primitives on it. |
| Radix primitives | Base UI (`@base-ui-components/react` 1.0.0-rc.0) | Base UI more actively maintained (MUI, full-time engineers); but Phase-1 primitives are custom and need no behavior layer — defer per D-07. |
| `apca-w3` | `bridge-pca` (0.1.6) / Polypane web tool | `bridge-pca` is a WCAG-2↔APCA bridge, not pure APCA; `apca-w3` is the canonical reference algorithm. Stick with `apca-w3` for the calibration script. |

**Installation:**
```bash
pnpm add tailwind-variants
pnpm add -D apca-w3
pnpm remove framer-motion   # D-10 cleanup — after migrating the 4 framer-motion files to `motion`
```

**Version verification (run 2026-06-11):**
- `tailwind-variants` latest = **3.2.2**, peerDeps `{ "tailwind-merge": ">=3.0.0", "tailwindcss": "*" }` — both satisfied (repo has tailwind-merge 3.4.0, tailwindcss ^4). `[VERIFIED: npm view tailwind-variants]`
- `motion` latest = **12.40.0** (repo has 12.29.2 — compatible). `[VERIFIED: npm view motion]`
- `apca-w3` latest = **0.1.9**, last published 2022-07-04, Limited W3 License. Old publish date is expected — it's the frozen W3C reference algorithm, not abandonment. `[VERIFIED: npm view apca-w3]`
- `@base-ui-components/react` = **1.0.0-rc.0** (published 2025-12-11) — stable RC, actively maintained. `[VERIFIED: npm view @base-ui-components/react]`

## Package Legitimacy Audit

> slopcheck not installed in this sandbox — packages below verified via `npm view` against the npm registry + cross-referenced to official docs (Context7). Per the package-name provenance rule, `tailwind-variants` name originated in CONTEXT.md (D-08), not an authoritative source, so registry existence alone does not confer full VERIFIED status — but it IS the well-known HeroUI-maintained library (90.4 benchmark on Context7, official docs at tailwind-variants.org). Planner should still gate the install behind a `checkpoint:human-verify` per protocol.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| tailwind-variants | npm | ~3 yrs | high (HeroUI ecosystem) | github.com/heroui-inc/tailwind-variants | n/a (unavailable) | Approved — gate behind checkpoint |
| apca-w3 | npm | ~4 yrs (frozen ref impl) | moderate | github.com/Myndex/apca-w3 | n/a (unavailable) | Approved (dev-only) — gate behind checkpoint |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
**Note:** No postinstall scripts of concern. `framer-motion` is being *removed*, not added. All other deps are pre-installed and in active use.

## Architecture Patterns

### System Architecture Diagram

```
                       BUILD TIME                          RUNTIME (browser)
  ┌──────────────────────────────────────┐   ┌──────────────────────────────────┐
  │ globals.css                           │   │  <html class="dark">             │
  │  @import "tailwindcss"                │   │    └─ <div class="numen-surface">│
  │  @custom-variant dark (existing)      │   │         ├─ tokens resolve here:  │
  │                                       │   │         │   --numen-bg, --numen- │
  │  [OLD coral/Raycast @theme — UNTOUCHED]│  │         │   panel, --numen-text… │
  │                                       │   │         ├─ utilities bg-bg /     │
  │  .numen-surface { --numen-*: #hex }   │──┼──▶      │   text-text read them   │
  │  .dark .numen-surface { … }           │   │         ├─ <GlassPrimitive>      │
  │  @theme inline {                      │   │         │   style={{backdropFilter│
  │     --color-bg: var(--numen-bg); … }  │   │         │   :'blur(Xpx)'}} ◀──── survives Lightning CSS
  │                                       │   │         └─ <StageReveal> (motion)│
  └──────────────────────────────────────┘   │              useReducedMotion()  │
  ┌──────────────────────────────────────┐   │              → opacity-only if   │
  │ next/font/google → Inter (--font-inter)│  │                reduced            │
  │                   → SourceSerif4(--font-serif) ──────▶ self-hosted, SSR-injected
  └──────────────────────────────────────┘   └──────────────────────────────────┘
                                                          │
  ┌──────────────────────────────────────┐               ▼
  │ Showcase route /…/numen-kit           │   renders every primitive INSIDE
  │  <div class="numen-surface dark"> …   │──▶ .numen-surface so tokens are live
  └──────────────────────────────────────┘   (deploys with app → "verified build")

  grep audit (build/tooling, no runtime) ──▶ BOUNDARY.md (replaces vs defers)
```

### Recommended Project Structure (Claude's discretion — a sane default)
```
src/
├── app/
│   ├── globals.css                # OLD tokens untouched; ADD .numen-surface scope + @theme inline
│   └── (kit)/numen-kit/page.tsx   # showcase route under .numen-surface (D-06)
├── components/numen/              # new warm-neutral primitives (parallel to old src/components)
│   ├── pill-chip.tsx
│   ├── icon-button.tsx
│   ├── surface.tsx
│   ├── glass.tsx                  # inline backdropFilter
│   └── stage-reveal.tsx           # motion + useReducedMotion
├── lib/
│   ├── utils.ts                   # existing cn()
│   └── tokens.ts                  # (optional) TS mirror of token names for type-safety
└── styles/numen-tokens.css        # (optional) split scope-class block, @import into globals
scripts/
└── check-apca.ts                  # dev-only APCA calibration (apca-w3)
docs/
└── numen-migration-boundary.md    # DS-06 boundary doc (per CLAUDE.md: docs to /docs)
```

### Pattern 1: Tailwind v4 scoped multi-theme token layer (D-01/D-02) — THE CORE PATTERN
**What:** Declare warm-neutral values as plain custom properties under the scope selector, then bridge them into Tailwind's utility namespace with `@theme inline`.
**When to use:** The entire new token layer.
**Example:**
```css
/* Source: tailwindcss.com/docs/dark-mode + /docs/colors (@theme inline) — VERIFIED via Context7 */
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));   /* EXISTING — keep */

/* 1. Plain custom props, scoped. Authored as EXACT HEX (D-03, L<0.15 oklch bug). */
.numen-surface {
  --numen-bg:           #1a1714;   /* warm near-black base */
  --numen-panel:        #211e1a;   /* +1 warm step */
  --numen-panel-2:      #2a2622;   /* +2 warm step */
  --numen-text:         #f0ebe3;   /* warm off-white */
  --numen-text-muted:   #a39c91;   /* warm-grey muted (APCA-tune, see Q4) */
  --numen-accent:       #d98a5e;   /* clay (PLACEHOLDER — D-11 calibration owns final) */
  --numen-verdict-good: #7faf7a;   /* muted green (PLACEHOLDER) */
  --numen-verdict-mixed:#d6a85a;   /* amber  (PLACEHOLDER) */
  --numen-verdict-bad:  #c97a64;   /* clay-red (PLACEHOLDER) */
  --numen-border:       rgba(240,235,227,0.06);  /* hairline warm border */
}

/* 2. Bridge to utilities. `inline` is LOAD-BEARING — see Pitfall 1. */
@theme inline {
  --color-bg:            var(--numen-bg);
  --color-panel:         var(--numen-panel);
  --color-panel-2:       var(--numen-panel-2);
  --color-text:          var(--numen-text);
  --color-text-muted:    var(--numen-text-muted);
  --color-accent:        var(--numen-accent);
  --color-verdict-good:  var(--numen-verdict-good);
  --color-verdict-mixed: var(--numen-verdict-mixed);
  --color-verdict-bad:   var(--numen-verdict-bad);
  --font-serif:          var(--font-serif);   /* from next/font, see Pattern 4 */
}
```
Usage: `<div className="numen-surface"><button className="bg-accent text-bg">…</button></div>` — utilities `bg-accent`, `text-text`, `border-border`, `text-verdict-good` all resolve against the scoped values. Old pages (no `.numen-surface`) are 100% unaffected; the OLD `@theme` coral block stays exactly as-is. `[VERIFIED: Context7 /tailwindlabs/tailwindcss.com — dark-mode.mdx + colors.mdx]`

### Pattern 2: tailwind-variants slots for a multi-part primitive (D-08)
**What:** `tv({ slots, variants, compoundVariants })` returns per-slot class-string functions; compose with the existing `cn()` for caller overrides.
**When to use:** Pill chip, glass surface, any primitive with >1 styled part.
**Example:**
```typescript
// Source: tailwind-variants.org/docs/slots — VERIFIED via Context7
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "@/lib/utils";

const toolChip = tv({
  slots: {
    root:  "inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 transition-colors",
    icon:  "size-4 shrink-0 text-text-muted",
    label: "text-sm font-medium text-text",
  },
  variants: {
    intent: {
      instant: { root: "bg-panel hover:bg-panel-2" },
      agentic: { root: "bg-panel-2 ring-1 ring-accent/30" },  // visually distinct (TOOL-04, later phase)
    },
  },
  compoundVariants: [
    { intent: "agentic", class: { icon: "text-accent" } },
  ],
  defaultVariants: { intent: "instant" },
});

export type ToolChipProps = VariantProps<typeof toolChip> & { className?: string; /* … */ };

export function ToolChip({ intent, className, ...p }: ToolChipProps) {
  const { root, icon, label } = toolChip({ intent });
  return <button className={cn(root(), className)} {...p}>{/* … */}</button>;
}
```
Note: `tv()`'s default config already runs `tailwind-merge` internally (since peerDep is tailwind-merge >=3). Still pass caller `className` through `cn()` so external overrides win predictably. `[VERIFIED: Context7 /websites/tailwind-variants]`

### Pattern 3: motion stage-reveal honoring prefers-reduced-motion (D-10/D-14)
**What:** `AnimatePresence` + variants; opacity uses tween easing, springs ONLY on physical props; `useReducedMotion` strips translate/slide.
**When to use:** The stage-reveal (the one key motion moment). Components are `'use client'`.
**Example:**
```typescript
// Source: motion.dev/docs/react-use-reduced-motion — VERIFIED via Context7
"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export function StageBlock({ show, children }: { show: boolean; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: reduce ? 0 : 12 }}   // no translate when reduced
          animate={{
            opacity: 1,
            y: 0,
            transition: {
              opacity: { duration: 0.4, ease: [0.215, 0.61, 0.355, 1] },  // tween — calm
              y: reduce ? { duration: 0 } : { type: "spring", stiffness: 220, damping: 30 }, // critically/over-damped → NO bounce
            },
          }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```
**No-bounce rule:** keep spring `damping` high relative to `stiffness` (damping ratio ≥ 1 → no overshoot). Never use the existing `--ease-spring: cubic-bezier(0.34,1.56,0.64,1)` token (the `1.56` > 1 overshoots — that IS the bounce §6 forbids). Define a new calm easing token instead. `[VERIFIED: Context7 /websites/motion_dev]`

**Import paths (confirmed):** `import { motion, AnimatePresence, useReducedMotion } from "motion/react"`. For pure server components that only animate, `import * as motion from "motion/react-client"` reduces client JS — but stage-reveal needs hooks so it's `"use client"` + `motion/react`. `[VERIFIED: Context7 motion.dev/docs/react-installation]`

### Pattern 4: next/font serif voice font (D-13)
**What:** Self-hosted variable serif via `next/font/google`, exposed as `--font-serif`, wired into `@theme inline`.
**Example:**
```typescript
// src/app/layout.tsx — Source: nextjs.org/docs/app/api-reference/components/font
import { Inter, Source_Serif_4 } from "next/font/google";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const serif = Source_Serif_4({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
  // variable font → no `weight` array needed; opsz axis auto via font-optical-sizing:auto
});

// <html className={`${inter.variable} ${serif.variable}`}>
```
Then in CSS: `@theme inline { --font-serif: var(--font-serif); }` gives a `font-serif` utility. Apply only to voice moments: `<h1 className="font-serif">`. `[CITED: next/font/google API; font names CITED from Google Fonts specimen pages]`

### Pattern 5: Glass primitive — inline backdrop-filter (D-05/Q7)
**What:** Apply `backdropFilter` via React inline `style`, NEVER a Tailwind class — Lightning CSS strips the class form (CLAUDE.md known issue).
**Example:**
```tsx
// Glass primitive — backdrop-filter MUST be inline style (Lightning CSS strips backdrop-* classes)
export function Glass({ blur = 12, className, children, style, ...p }: GlassProps) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-panel/70", className)}
      style={{ backdropFilter: `blur(${blur}px)`, WebkitBackdropFilter: `blur(${blur}px)`, ...style }}
      {...p}
    >
      {children}
    </div>
  );
}
```
Include `WebkitBackdropFilter` for Safari/iOS (PWA target later). Glass is RARE per §6 — composer + tool sheet only. `[CITED: CLAUDE.md known issues; backdrop-filter inline-style is the documented project workaround]`

### Anti-Patterns to Avoid
- **Swapping the global `@theme`** to warm-neutral → breaks all 10 live pages (D-01 rejected this).
- **Using `@theme` (not `@theme inline`) for variable-referencing tokens** → utilities resolve to the wrong/empty value (Pitfall 1).
- **`backdrop-blur-*` Tailwind class** → silently stripped by Lightning CSS (Pitfall 2).
- **`--ease-spring` (cubic-bezier 1.56) or any spring with damping ratio <1** → bounce/overshoot, violates §6 "never bouncy."
- **Building new primitives on `class-variance-authority`** → cva has no cross-slot compound variants; it's dead Raycast-era legacy. Use tailwind-variants (D-08).
- **Authoring dark tokens in oklch** → L<0.15 compiles wrong in Tailwind v4 (D-03). Hex only.
- **Shipping any Magic UI / Aceternity effect un-reskinned** (beam/glow/shimmer/gradient) → "AI-spaceship" aesthetic §3/§6 forbids (D-07 hard rule). Note the OLD globals.css already has `--animate-shimmer` / `gradient-x` keyframes — do NOT carry them into the Numen kit.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-part variant styling | Hand-rolled className conditionals | `tailwind-variants` `tv({slots})` | Cross-slot compound variants + tailwind-merge built in (D-08) |
| Class merge / conflict resolution | Manual string concat | existing `cn()` (clsx+tailwind-merge) | Already the convention; resolves `bg-*` conflicts |
| Reduced-motion detection | Manual `matchMedia` listener | `motion`'s `useReducedMotion()` | Reactive hook, SSR-safe, already in the chosen lib |
| APCA contrast math | Reimplement the algorithm | `apca-w3` | It's the W3C reference impl; reimplementing risks subtle errors |
| Font self-hosting / FOUT | Manual `@font-face` + preload | `next/font/google` | Auto self-host, zero layout shift, variable axes |
| Theme token bridging | JS runtime theming | Tailwind `@theme inline` | Zero-runtime; resolves at build |

**Key insight:** Nearly everything load-bearing here is already a solved primitive in the chosen toolkit — the work is *composition + calibration*, not building machinery.

## Runtime State Inventory

> This is a NEW kit + an audit (delete-nothing per D-04). No data migration, no live rename. Still, explicit per category:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 1 touches no DB/datastore (presentation-only, engine frozen). | None — verified: no Supabase/schema work in DS-01…DS-08. |
| Live service config | None — no external service config carries these design strings. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None — no env var references the brand tokens. | None. |
| Build artifacts | `framer-motion` will be removed (D-10) AFTER its 4 consumers migrate to `motion`; stale `node_modules/framer-motion` cleared by `pnpm remove`. cva (`class-variance-authority`) stays installed (other old components may use it) but the Numen kit must not consume it. | `pnpm remove framer-motion` once `src/components/app/simulation/analysis-loading.tsx`, `loading-phases.tsx`, `viral-results/FactorCard.tsx`, `viral-results/ViralScoreRing.tsx` are migrated. **These 4 files are OLD-app code — migrating them is arguably out of Phase-1 scope (delete-nothing-live, D-04).** Planner decision: either (a) migrate the 4 now as a clean prerequisite to dropping framer-motion, or (b) keep both libs installed for Phase 1 and defer the framer-motion removal to whichever later phase rebuilds those surfaces. Recommend (b) — D-04 says don't touch live surfaces; the "standardize on motion" cleanup applies to NEW code, and the dedupe can wait. |

## Common Pitfalls

### Pitfall 1: `@theme` vs `@theme inline` — scoped overrides silently resolve wrong
**What goes wrong:** You define `--color-bg: var(--numen-bg)` inside a plain `@theme {}` block. The utility `bg-bg` resolves `var(--numen-bg)` *at the `:root`/`@theme` level* where `--numen-bg` is undefined (it only exists under `.numen-surface`), so it falls back to nothing/inherited — colors look wrong or empty under the scope.
**Why it happens:** CSS custom-property resolution: without `inline`, the utility references the theme variable, which resolves `var(--numen-bg)` where the theme var is *defined* (the root), not where the utility is *used* (deep under `.numen-surface`).
**How to avoid:** Use `@theme inline {}` for every token that references another variable. `inline` makes the utility emit the *value* (`var(--numen-bg)`) so it resolves at the usage site, where `.numen-surface` has overridden it. The existing globals.css already uses `@theme inline` for `--animate-marquee` — same principle.
**Warning signs:** Tokens work at `:root` but go transparent/black inside `.numen-surface`; DevTools shows `background-color: var(--color-bg)` resolving to empty.
`[VERIFIED: Context7 /tailwindlabs/tailwindcss.com colors.mdx + theme.mdx]`

### Pitfall 2: Lightning CSS strips `backdrop-filter` from class-generated CSS
**What goes wrong:** `className="backdrop-blur-md"` produces a `backdrop-filter` declaration that Lightning CSS (Tailwind v4's minifier, used by Next 16 build) drops in production → no blur on deployed build, works in dev.
**Why it happens:** Known project issue (CLAUDE.md); Lightning CSS vendor-prefix/minify pass removes the property in this stack.
**How to avoid:** Apply `backdropFilter` via React inline `style={{}}` (Pattern 5). Inline styles never enter the CSS pipeline. Encode this in the Glass primitive so no consumer can get it wrong.
**Warning signs:** Glass renders correctly with `next dev` but flat in `next build && next start` / on Vercel. (Tie the showcase-route check to a *deployed* build per D-06 to catch this.)
`[CITED: CLAUDE.md known issues; corroborated by Tailwind discussion #7044 on backdrop-filter build stripping]`

### Pitfall 3: oklch L<0.15 compiles inaccurately in Tailwind v4
**What goes wrong:** Warm-near-black tokens authored in oklch render the wrong color.
**How to avoid:** Author every dark token as exact hex (D-03). This is why the Pattern-1 example uses `#1a1714` not `oklch(...)`.
`[CITED: CLAUDE.md known issues]`

### Pitfall 4: Dev-server CSS caching hides token changes
**What goes wrong:** Token edits don't appear after editing globals.css.
**How to avoid:** Kill dev server + clear `.next/` + `node_modules/.cache/` + browser cache (CLAUDE.md).
`[CITED: CLAUDE.md known issues]`

### Pitfall 5: tailwind-variants class strings must be statically visible to Tailwind
**What goes wrong:** Dynamically constructed class fragments (e.g. `` `bg-${color}` ``) inside `tv()` aren't generated by Tailwind's scanner → no CSS emitted.
**How to avoid:** Always write full literal class strings in `tv()` variant maps (the Pattern-2 example does). Never interpolate token names into class strings.
`[VERIFIED: general Tailwind JIT behavior; corroborated by tailwind-variants docs]`

## Code Examples

All four canonical patterns above (scoped tokens, tv slots, motion reduced-motion, next/font serif, inline glass) are verified from official sources and ready for the planner to reference in task actions.

### APCA calibration script (dev-only, D-12)
```typescript
// scripts/check-apca.ts — Source: github.com/Myndex/apca-w3 (APCAcontrast + sRGBtoY)
import { APCAcontrast, sRGBtoY, colorParsley } from "apca-w3";

function lc(textHex: string, bgHex: string) {
  return Math.abs(
    APCAcontrast(sRGBtoY(colorParsley(textHex)), sRGBtoY(colorParsley(bgHex)))
  );
}
// Assert each pairing meets its APCA Lc target (see Q4 table):
console.assert(lc("#f0ebe3", "#1a1714") >= 75, "body text fails Lc75");
```
`[VERIFIED: npm apca-w3 0.1.9 API]`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` theme + cva | CSS-first `@theme`/`@theme inline` + tailwind-variants | Tailwind v4 (2024–25) | Tokens live in CSS; cva superseded by tv for slots |
| `framer-motion` import | `motion` (`motion/react`) | Framer Motion rebranded to Motion 2024 | Same API, new package name (D-10) |
| WCAG 2 contrast ratios | APCA (WCAG 3 / perceptual) | APCA = current best for dark mode | D-12 requires it; WCAG 2 misleads on dark bg |
| Radix as default headless layer | Radix OR Base UI (shadcn supports both) | Base UI v1.0 stable Dec 2025 | Per-primitive choice now real (D-07) |

**Deprecated/outdated:**
- `class-variance-authority` for new primitives — superseded by tailwind-variants for slot/compound needs (kept installed for legacy only).
- `next-pwa` — unmaintained; use Serwist (relevant Phase 4, noted here for continuity).

## Validation Architecture

> `.planning/config.json` not found / nyquist key absent → treat as ENABLED. This phase is design-system, so validation is a mix of unit (token/variant logic, view-model-free) + visual/deployed-build checks.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 (+ @testing-library/react 16, happy-dom, vitest-axe) — already installed |
| Config file | `vitest` config present (test scripts in package.json) |
| Quick run command | `pnpm vitest run <file>` |
| Full suite command | `pnpm test` (`vitest run`) |
| Visual/deployed check | `pnpm build && pnpm start` → open showcase route; or Vercel preview (D-06 "verified on deployed build") |
| Contrast check | `pnpm tsx scripts/check-apca.ts` (dev gate) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DS-01 | Token utilities resolve under `.numen-surface`; no pure black; dark tokens are hex | unit + visual | `pnpm vitest run tests/numen/tokens.test.ts` (assert resolved CSS vars) + deployed showcase | ❌ Wave 0 |
| DS-02/03 | Verdict + accent swatches meet APCA Lc targets on base | script | `pnpm tsx scripts/check-apca.ts` | ❌ Wave 0 |
| DS-04 | `--font-serif` applied only on voice slots; body = sans | unit (class) + visual | `pnpm vitest run tests/numen/type.test.ts` | ❌ Wave 0 |
| DS-05 | Glass uses inline `backdropFilter` (not class); blur survives prod build | unit + deployed | `pnpm vitest run tests/numen/glass.test.ts` (assert inline style present) + deployed check | ❌ Wave 0 |
| DS-05 | tailwind-variants primitives produce expected slot classes | unit | `pnpm vitest run tests/numen/primitives.test.ts` | ❌ Wave 0 |
| DS-07 | StageReveal: reduced-motion strips translate; no spring overshoot | unit | `pnpm vitest run tests/numen/stage-reveal.test.ts` (mock `useReducedMotion`) | ❌ Wave 0 |
| DS-06 | Boundary doc exists + grep counts captured | doc/manual | review `docs/numen-migration-boundary.md` | ❌ Wave 0 |
| accessibility | Showcase primitives pass axe | unit | `vitest-axe` on showcase render | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run <touched test>` + (for glass/token tasks) a local `pnpm build` smoke.
- **Per wave merge:** `pnpm test` + `pnpm tsx scripts/check-apca.ts`.
- **Phase gate:** Full suite green + `pnpm build` clean + showcase route verified on a DEPLOYED build (Vercel preview) — directly proves criteria 1 & 3.

### Wave 0 Gaps
- [ ] `tests/numen/tokens.test.ts` — DS-01 (resolved-var assertions via happy-dom)
- [ ] `tests/numen/type.test.ts` — DS-04
- [ ] `tests/numen/glass.test.ts` — DS-05 (inline-style presence)
- [ ] `tests/numen/primitives.test.ts` — DS-05 (tv slot output)
- [ ] `tests/numen/stage-reveal.test.ts` — DS-07 (reduced-motion gate)
- [ ] `scripts/check-apca.ts` — DS-02/DS-03 contrast gate
- [ ] Install: `pnpm add tailwind-variants` + `pnpm add -D apca-w3`

## Security Domain

> `security_enforcement` config absent → treat as enabled. This phase is presentation-only (no auth, no data, no network input). Security surface is minimal.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (no auth touched) |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no | No user input in Phase 1 primitives (showcase is static) |
| V6 Cryptography | no | — |
| V14 Config / Supply-chain | yes | New deps verified on registry (Package Legitimacy Audit); gate installs behind checkpoint:human-verify |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Slopsquatted dependency | Tampering | Verify on npm registry + official docs; checkpoint before install (done above) |
| Malicious font CDN | Tampering | `next/font/google` self-hosts at build — no runtime CDN fetch |
| Postinstall script abuse | Tampering | Checked: no concerning postinstall on tailwind-variants/apca-w3 |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Placeholder hexes for clay/verdict swatches in Pattern 1 | Pattern 1 / D-11 | LOW — explicitly placeholders; D-11 calibration + user sign-off owns the finals. APCA script validates whatever is chosen. |
| A2 | The 4 framer-motion files are OLD-app code outside Phase-1 scope; recommend deferring framer-motion removal | Runtime State Inventory | LOW — planner decides; recommendation aligns with D-04 (don't touch live). |
| A3 | Vitest config exists (inferred from package.json scripts) | Validation Architecture | LOW — verify presence of vitest.config; if absent it's a Wave 0 gap. |
| A4 | `slopcheck` unavailable → deps gated behind checkpoint | Package Legitimacy Audit | LOW — both deps are well-known with official docs; checkpoint is the safe default. |

## Open Questions

1. **Migrate framer-motion now, or keep both libs for Phase 1?**
   - What we know: repo has both; 4 OLD files use framer-motion; D-10 says standardize on `motion`.
   - What's unclear: whether touching those 4 OLD files violates D-04 (delete-nothing-live).
   - Recommendation: keep both installed for Phase 1; build all NEW code on `motion`; defer the `pnpm remove framer-motion` + 4-file migration to the phase that rebuilds those surfaces. (Planner's call.)

2. **Final serif pick** (D-13) — Source Serif 4 (lead) vs Newsreader (alt).
   - What we know: both are variable, opsz-equipped, screen-optimized, free on Google Fonts.
   - Recommendation: planner adds a specimen task in the showcase (render greeting + verdict line in both at real sizes/weights on `#1a1714`), user picks. Source Serif 4 is the front-runner per D-13.

3. **Exact APCA Lc targets per token role** — see Q4 table below for the recommended thresholds; final pass-fail set during calibration.

## Environment Availability
| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build/test | ✓ | v25.2.1 | — |
| pnpm | install | ✓ | 10.29.3 | npm |
| Next | dev/build | ✓ | 16.1.5 | — |
| Vitest | unit tests | ✓ | 4.0.18 | — |
| tailwind-variants | primitives | ✗ (to install) | — | cva exists but lacks slots — not a real fallback |
| apca-w3 | contrast gate | ✗ (to install) | — | manual APCA web tool (apcacontrast.com) |
| Google Fonts (Source Serif 4 / Newsreader) | serif voice | ✓ (via next/font, build-time fetch) | — | bundle .woff2 locally if offline build |

**Missing with no fallback:** none blocking.
**Missing with fallback:** `apca-w3` → web calculator (manual, slower).

---

## Answers to the 9 Research Questions (condensed)

**Q1 — Tailwind v4 scoped multi-theme (D-01/D-02):** Canonical pattern = plain custom props under the `.numen-surface` selector (and `.dark .numen-surface` for the dark stack), bridged to utilities via **`@theme inline`** (NOT plain `@theme` — Pitfall 1, the resolution landmine). Semantic tokens live as the *bridge* in `@theme inline`; the *values* live in the scope-class rule. Utilities (`bg-bg`, `text-text`) resolve at the usage site because `inline` emits the value not the var-reference. The existing global `@theme` coral block stays untouched (D-01). L<0.15 hex rule (D-03) is orthogonal and fully compatible — you author the scope-class values as hex. `[VERIFIED: Context7]`

**Q2 — tailwind-variants on Tailwind v4 (D-08):** YES — current `tailwind-variants` is **v3.2.2** (CONTEXT's "v1" is stale; v3.x is the TW-v4 line, v0.x was TW-v3). peerDeps `{tailwind-merge: ">=3.0.0", tailwindcss: "*"}` — repo satisfies both. `tv({slots, variants, compoundVariants})` shown in Pattern 2; composes with `cn()`. Install `pnpm add tailwind-variants`, no extra config. `[VERIFIED: npm + Context7]`

**Q3 — motion stage-reveal + reduced-motion (D-10/D-14):** `motion` v12.40.0. Pattern 3 shows `AnimatePresence` + variants, opacity via tween cubic-bezier, physical props via high-damping spring (ratio ≥1 → no bounce), `useReducedMotion()` zeroing translate. Import from `motion/react`. Package is `motion` (drop `framer-motion`). Do NOT reuse the old `--ease-spring` token (1.56 overshoot = bounce). `[VERIFIED: Context7]`

**Q4 — APCA contrast (D-12):** Use `apca-w3` (W3C reference impl; `APCAcontrast(sRGBtoY(colorParsley(text)), sRGBtoY(colorParsley(bg)))`, take abs value for dark mode). **Recommended Lc targets on `~#1a1714` base** `[CITED: git.apcacontrast.com APCA-in-a-Nutshell / readtech.org Bronze]`:
  - Body / fluent text (≤16px/400): **Lc ≥ 90** preferred, **75** floor
  - Larger body (≥18px/400): **Lc ≥ 75**
  - Non-body content text (UI labels): **Lc ≥ 60**
  - Large/heavy (≥24px bold / ≥36px/400 — headlines, verdict line): **Lc ≥ 45**
  - Verdict swatches that carry meaning behind text → treat as non-body, **Lc ≥ 60** for any text on them.
  Encode as `scripts/check-apca.ts` asserting each pairing (Code Examples). `[VERIFIED: apca-w3 API]`

**Q5 — next/font serif (D-13):** Pattern 4. Source Serif 4 (wght 200–900 + opsz), Newsreader (wght+opsz), both variable + screen-optimized + free on Google Fonts; Fraunces (wght/opsz/SOFT/WONK) only at low opsz. Wire each via `next/font/google`, `variable: "--font-serif"`, self-hosted, expose through `@theme inline`. Specimen both during planning; Source Serif 4 = front-runner. `[CITED: Google Fonts specimens]`

**Q6 — Base UI vs Radix (D-07):** Radix is maintained by WorkOS but velocity slowed on complex components (Combobox/multi-select most cited); Base UI (MUI, full-time engineers) hit **v1.0 stable Dec 2025** and shadcn now supports both layers. **For Phase 1 specifically: NONE of the load-bearing primitives (pill chip, icon button, surface, glass, verdict swatch) need a behavior layer at all** — they're presentational/custom. Keep Radix installed for the few interactive bits that already use it. Base UI is a *future per-primitive option* (e.g. if a later phase needs a robust dropdown/combobox), not a Phase-1 action. No install. `[VERIFIED: WebSearch + npm]`

**Q7 — Lightning CSS glass (D-05):** Confirmed — class-form `backdrop-blur-*` is stripped by Lightning CSS in this Next 16 / TW v4 stack (CLAUDE.md + corroborating Tailwind discussion). Inline `style={{ backdropFilter, WebkitBackdropFilter }}` survives (never enters the CSS pipeline). Encode in the Glass primitive (Pattern 5). Verify on a *deployed* build (works in dev, can fail in prod). `[CITED: CLAUDE.md + Tailwind #7044]`

**Q8 — DS-06 retirement audit (D-04):** Delete nothing. Run the grep inventory and write a boundary doc. **Measured counts (2026-06-11, this repo):**
  - `#07080a` → 5 files
  - `FF7F50` (case-insensitive) → 17 files
  - `GlassPanel` → 10 files
  - `coral-` (token usage) → 7 files
  - `framer-motion` → 4 files
  - `TrafficLights` → 5 refs (incl. `src/components/primitives/TrafficLights.tsx`, `index.ts`, 3 showcase pages)
  - chat dock → 0 hits for `chat-dock`/`ChatDock` (the "dock" likely lives under a different name — planner should widen the grep, e.g. `chat` + `dock`/`drawer`/`panel` near sidebar, before concluding it's absent)
  **Recommended grep commands** (note: this repo's `rg` is shimmed — `grep -rl` is reliable here):
  ```bash
  grep -rni "07080a" src
  grep -rni "FF7F50\|#ff7f50" src
  grep -rl  "GlassPanel" src
  grep -rni "coral-\|--color-coral" src
  grep -rl  "TrafficLights" src
  grep -rni "chat.*dock\|ChatDock\|chat-dock\|chat.*drawer" src
  ```
  **Boundary-doc format** (`docs/numen-migration-boundary.md`): one row per costume target → columns `Target | Files/Count | Surface(s) | v5.0 Disposition (replace/defer) | Owning Phase`. Concrete known targets: TrafficLights (fake macOS chrome → DEFER delete to whichever phase rebuilds the shell, Phase 5), GlassPanel-everywhere (→ replaced by the rare Glass primitive, per-surface), hardcoded coral (→ replaced by `--numen-accent`, per-surface), chat dock (→ absorbed into the thread, Phase 4/5). `[VERIFIED: grep on this repo]`

**Q9 — Kit showcase route (D-06):** A custom App-Router page (Next 16) mounted inside `.numen-surface dark` so primitives render under live tokens, deployed with the app (Vercel preview = "verified on deployed build"). Put it under a route group so it doesn't pollute marketing/app nav (e.g. `src/app/(kit)/numen-kit/page.tsx`). NOT Storybook (D-06). It also doubles as the serif-specimen surface (Q5) and the deployed-build glass check (Q7). Note: repo already has `(marketing)/showcase` + `primitives-showcase` for the OLD kit — keep the new one separate (parallel kit, D-01). `[CITED: Next 16 App Router; D-06]`

## Sources

### Primary (HIGH confidence)
- Context7 `/tailwindlabs/tailwindcss.com` — dark-mode.mdx, colors.mdx, theme.mdx (@custom-variant, @theme inline, scoped multi-theme)
- Context7 `/websites/tailwind-variants` — slots, compound variants, getting-started, migration (TW v4 support)
- Context7 `/websites/motion_dev` — react-use-reduced-motion, react-installation, base-ui (AnimatePresence, useReducedMotion, import paths)
- npm registry — tailwind-variants 3.2.2 (peerDeps), motion 12.40.0, apca-w3 0.1.9, @base-ui-components/react 1.0.0-rc.0
- This repo — globals.css, layout.tsx, package.json, grep audit counts

### Secondary (MEDIUM confidence)
- WebSearch (verified against official sources): Radix/Base UI status (pkgpulse, shadcn changelog, GitHub radix-ui/primitives README), Google Fonts specimens (Source Serif 4, Newsreader, Fraunces), APCA Lc thresholds (git.apcacontrast.com, readtech.org Bronze)

### Tertiary (LOW confidence)
- Lightning CSS backdrop-filter stripping: corroborated by CLAUDE.md (project-verified) + Tailwind discussion #7044 (general); treat the project note as authoritative for this stack.

## Metadata
**Confidence breakdown:**
- Standard stack: HIGH — all versions verified on npm + official docs.
- Architecture / token pattern: HIGH — Context7-verified `@theme inline` is the documented mechanism.
- Pitfalls: HIGH for Tailwind/oklch/Lightning (project + docs verified); MEDIUM for exact APCA finals (calibration-dependent).
- Palette hexes: LOW (placeholders) — D-11 calibration + user sign-off owns finals.

**Research date:** 2026-06-11
**Valid until:** ~2026-07-11 (stable libs; motion/tailwind-variants move fast — re-verify versions if planning slips a month)

## RESEARCH COMPLETE

Every open HOW in Phase 1 resolves cleanly against current library versions, and the design direction stays locked. The load-bearing finding is the Tailwind v4 **`@theme inline` scoped-token pattern** (Pattern 1 + Pitfall 1): warm-neutral values live as plain custom properties under `.numen-surface`/`.dark .numen-surface`, bridged to utilities through `@theme inline` so they resolve at the usage site — this is exactly the coexistence mechanism D-02 specifies, leaving the old coral `@theme` block untouched (D-01). `tailwind-variants` is at **v3.2.2** (not "v1"), officially supports Tailwind v4, and composes with the existing `cn()`; `motion` v12 gives the tween-opacity / high-damping-spring / `useReducedMotion` split D-10/D-14 demand (avoid the old bouncy `--ease-spring` token); `apca-w3` is the dev-only contrast gate for D-12 with concrete Lc targets (90/75/60/45). The glass primitive must use inline `backdropFilter` (Lightning CSS strips the class form — verify on a deployed build). The DS-06 audit is delete-nothing with measured grep counts captured above (note: no `chat-dock` match — widen the grep before concluding it's absent). Two CONTEXT corrections for the planner: tailwind-variants version, and that cva + wcag-contrast are already installed (cva is dead legacy; wcag-contrast is WCAG-2, so apca-w3 is still needed). Recommend deferring the `framer-motion` removal (touches 4 OLD files, against D-04) to a later surface-rebuild phase. Ready for planning.
