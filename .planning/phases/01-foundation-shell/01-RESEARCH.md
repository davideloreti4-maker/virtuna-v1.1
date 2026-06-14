# Phase 1: Foundation & Shell - Research

**Researched:** 2026-06-14
**Domain:** Design-system port (flat-warm `@theme`) + route scaffold + motion/reduced-motion foundation (Next.js 16 App Router, Tailwind v4, motion/react)
**Confidence:** HIGH

> This is a PORT + scaffold phase. CONTEXT (D-01..D-24) and the approved UI-SPEC are the SSOT for *intent*. This document resolves the 6 unresolved technical unknowns and extracts concrete reference values (exact token blocks, exact file lists, exact import snippets) so the planner writes concrete tasks — not "go read the other worktree."

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01..D-24 — verbatim intent)
- **D-01:** Adopt numen-rework flat-warm wholesale; port its `globals.css` `@theme` block into landing-v2's `globals.css`. Semantic token names are identical → clean swap, replaces cold Raycast tokens.
- **D-02:** Neutral charcoal (NOT warm-brown): `#262624` page bg, `#1a1a18`, `#1e1d1b`, `#2f2e2b`.
- **D-03:** Cream text, never pure white: `#ece7de` / `#c2bdb4` / `#8a857c`.
- **D-04:** Terracotta coral `oklch(0.68 0.13 33)` ≈ `#d97757`. Lone brand accent (logo, primary CTA, focus). `accent-foreground #1a0f0a`.
- **D-05:** Inter for ALL UI/chrome. Newsreader serif (400 + italic) for VOICE MOMENTS ONLY; wire `--font-newsreader` in root layout exactly as numen-rework. (Hero headline lands Phase 2 — wire now, render later.)
- **D-06 (flat-matte):** Depth = tone-step + 6% hairline. NO glass, NO backdrop-blur, NO inset white shine, NO glow. Only `--shadow-float`. **Removed tokens:** `--gradient-navbar`, `--gradient-glass`, `--gradient-feature`, `--shadow-glass`, `--shadow-glow-accent`, the inset-shine layer of `--shadow-button`.
- **D-07:** Borders 6%/hover 10%, card radius 12px, full radius scale, 8px spacing, Inter weights/sizes — carry as-is.
- **D-08:** North star = Claude.ai dark calm. Flat-warm is already UAT-locked (THEME-06); adopt values directly, only a visual sanity check on the assembled landing. **NO new UAT gate.**
- **D-09:** New landing replaces `/` at `src/app/(marketing)/page.tsx`. Phase 1 ships a scroll skeleton (Header + stub anchored sections + Footer).
- **D-10:** Strip `<html>`/`<body>` + stale "Artificial Societies" metadata from `(marketing)/layout.tsx`. Root layout owns html/body/font/base metadata.
- **D-11:** DELETE `src/components/landing/*` and dead test routes `(marketing)/{viz-test, viral-score-test, board-preview, primitives-showcase}`. Rewrite `header.tsx`/`footer.tsx` fresh in place. Fix sibling-route imports broken by deletion.
- **D-12..D-15:** `<Placeholder variant aspect label src?>` (CVA, `ui/` conventions) in NEW `src/components/marketing/`; `src` is the one-prop swap; no asset-registry.
- **D-16:** Standardize on `motion/react`. Migrate `motion/*` wrappers off framer-motion; remove framer-motion dep once grep confirms zero imports (defer if anything still imports it).
- **D-17:** Wrap landing in `<MotionConfig reducedMotion="user">` + a CSS `@media (prefers-reduced-motion: reduce)` block for non-Framer animations. Port `usePrefersReducedMotion` if not present.
- **D-18:** Reuse + lightly extend existing `motion/*` set. Heavy libs (Magic UI/Aceternity) pulled per-component in later phases.
- **D-19..D-22:** Flat sticky Header (no glass pill), CTA constants, simple mobile collapse (no Radix Sheet), compact 2-3 col Footer — all rebuilt from scratch on flat-warm.
- **D-23:** Product output noun = **"Simulation"** across ALL landing copy.
- **D-24:** Milestone docs updated to flat-warm override now (done, committed with CONTEXT).

### Claude's Discretion
- Final hex ramp / serif weights / coral hue → follow numen-rework locked values; do NOT re-derive.
- Component/motion library choices within flat-warm + calm-motion taste bar (Radix / shadcn / Magic UI / Aceternity / motion).
- Exact anchor-link set, section `id`s, scroll-skeleton stub markup → planner.
- Exact `/` page metadata copy → planner.

### Deferred Ideas (OUT OF SCOPE)
- Placeholder asset-registry / one-file swap manifest (the `src` prop suffices for v1).
- Removing the redundant `framer-motion` dep (do it once all wrappers migrated — may slip to Phase 5). **See re-scope below: wrappers are ALREADY migrated; only 4 PRODUCT files block dep removal.**
- Full reskin of sibling marketing routes (`/pricing`, `/showcase`) — Phase 1 only fixes breakage from deleting `landing/*`.
- Standalone routes, real-asset integration, new abstract UAT gate.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | Visitor lands on new marketing page at `/`, replacing current home | Route mount = replace `(marketing)/page.tsx` body; delete `landing/*` import (§5). Mechanically trivial. |
| FOUND-02 | Dark-only flat-warm design system ported from numen-rework | Exact `@theme` delta computed (§1) — clean token-name-identical swap; oklch-vs-hex gotcha mapped. |
| FOUND-03 | Reusable placeholder-slot component (image/video/avatar/logo, swappable via one prop) | API in UI-SPEC; CVA+`cn()` pattern analog = `ui/button.tsx` (§6); `skeleton-breathe` keyframe already ported (§1c). |
| FOUND-04 | Motion wired via motion + permitted libs behind global reduced-motion fallback | `MotionConfig reducedMotion="user"` VERIFIED (§3); two-layer fallback (MotionConfig + CSS `@media`) mapped; wrappers already on `motion/react`. |
| NAV-01 | Header: Stele logo + "Numen" wordmark + "Try it free" CTA | `NumenLogo` reused as-is (§5); current `header.tsx` is the OLD GLASS PILL → full D-19 rewrite (§4/§5). |
| NAV-02 | Footer: brand, in-page links, legal/social placeholders | Current `footer.tsx` is full societies content → full D-22 rebuild (§5). |
| NAV-03 | Header collapses to mobile-appropriate nav | `useIsMobile` already present (§6); D-21 = simple flat collapse, NOT Radix Sheet. |
</phase_requirements>

## Summary

Every Phase-1 unknown resolved with HIGH confidence by direct file inspection of both worktrees. Three findings materially change the plan's shape versus what CONTEXT assumed:

1. **D-16 is already done for the marketing surface.** All 6 `src/components/motion/*` wrappers ALREADY import `motion/react` (verified — zero use `framer-motion`). The 4 `framer-motion` imports are 100% PRODUCT surface (`app/simulation/{analysis-loading,loading-phases}` + `viral-results/{FactorCard,ViralScoreRing}`), all out of marketing scope. **Recommendation: leave product files alone, DEFER `framer-motion` dep removal to Phase 5.** No migration work in Phase 1 — just verify + adopt + wire `MotionConfig`.

2. **The "flatten-on-touch" risk is much smaller than CONTEXT feared, and lives in the wrong place.** `src/components/ui/*` (the shared primitives the landing actually uses — button, card-via-marketing, sheet, dropdown, accordion, marquee, avatar) are CLEAN of removed tokens. The glass/blur that *does* exist is in (a) the OLD `layout/header.tsx` (= the D-19 rewrite target, deleted anyway), (b) `ui/{dialog,toast,select,card-GlassCard}` (modal/overlay primitives Phase 1 never renders), and (c) deep product/`primitives/Glass*` (out of scope). **The token port does NOT cascade visual breakage into anything Phase 1 ships.** Keep the removed gradient/shadow tokens as no-op aliases (numen-rework already does) so `showcase/page.tsx` `var()` refs still resolve.

3. **This is a FRESH worktree with no `node_modules`.** `npm install` (or `pnpm install`) is a hard prerequisite before any build/typecheck/test/dev runs. The planner MUST add an install step as task-zero. Per project memory, `.env.local` also does not propagate to fresh worktrees — but Phase 1 is marketing-surface-only with no Supabase calls, so env is not blocking for *this* phase's build.

**Primary recommendation:** Sequence as: (0) `npm install` → (1) port `@theme` + wire Newsreader + delete `landing/*` + fix the 2 broken sibling imports + strip `(marketing)/layout.tsx` → (2) `<Placeholder>` → (3) `<MotionConfig>` + CSS reduced-motion block → (4) Header → (5) Footer. The theme port is the epicenter and gates everything visual.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Flat-warm design tokens | Frontend Server (CSS `@theme`, build-time) | Browser (CSS custom props) | Tailwind v4 `@theme` compiles tokens at build; components reference semantic names. Single epicenter = `globals.css`. |
| Font loading (Inter + Newsreader) | Frontend Server (`next/font/google`, root layout) | Browser | `next/font` self-hosts + injects `--font-*` vars on `<html>` at SSR. |
| Route mount `/` | Frontend Server (App Router RSC) | — | `(marketing)/page.tsx` is a server component; ships static HTML skeleton. |
| `<Placeholder>` slot | Browser (client, optional motion) / Frontend Server (static when no motion) | — | Pure presentational; client only if `skeleton-breathe` opted in. Default can be a server component. |
| Motion + reduced-motion | Browser (client) | — | `MotionConfig`, `motion.*`, `useReducedMotion` are all client-only ("use client"). |
| Header / mobile nav | Browser (client — stateful menu) | — | Mobile collapse needs `useState` → client. Logo/links are static but the menu toggle forces "use client". |
| Footer | Frontend Server (static) | — | No interactivity → server component (current one is already non-client). |

## Standard Stack

Everything needed is ALREADY in `package.json` (verified). No new dependencies this phase.

### Core (verified in package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | `16.1.5` | App Router, RSC, `next/font` | Project framework. (CLAUDE.md says Next 15 — **outdated**, trust package.json `[VERIFIED: package.json]`) |
| `react` / `react-dom` | `19.2.3` | UI runtime | Locked by Next 16. |
| `tailwindcss` | `^4` | `@theme` token system, utility CSS | The flat-warm reskin is done entirely in `@theme`. |
| `motion` | `^12.29.2` | `motion/react` — animation + `MotionConfig` + `useReducedMotion` | D-16 standard lib. All wrappers already import from it. |
| `class-variance-authority` | `^0.7.1` | CVA variants for `<Placeholder>` | Matches `ui/` convention (see `ui/button.tsx`). |
| `clsx` + `tailwind-merge` | `^2.1.1` / `^3.4.0` | `cn()` in `src/lib/utils.ts` | Established className composition. |
| `lucide-react` | `^0.563.0` | Placeholder media-type glyphs (`Image`/`Video`/`UserRound`/`Building2`) + Header `Menu`/`X` | UI-SPEC primary icon lib. |
| `@phosphor-icons/react` | `^2.1.10` | Fallback icons | Available; current (to-be-deleted) header/footer use it. |

### Supporting (present, used as-is)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `framer-motion` | `^12.29.3` | (redundant) | DO NOT use for new code. Keep installed (4 product files import it). Dep removal deferred to Phase 5. |
| `tw-animate-css` | `^1.4.0` | `@import` in globals.css | Already imported; leave. |
| `next-themes` | `^0.4.6` | (dark-only) | Not needed — dark is the only mode; do not wire a theme switcher. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Simple flat mobile collapse (D-21) | Radix `Sheet` (`ui/sheet.tsx` exists) | UI-SPEC + D-21 explicitly say DON'T — heavyweight for a 3-4 item nav. Use a `useState` disclosure panel. |
| `lucide-react` glyphs | `@phosphor-icons/react` | Both installed; UI-SPEC picks lucide as primary. Stay consistent — new marketing code uses lucide. |

**Installation (task-zero — REQUIRED, fresh worktree has no node_modules):**
```bash
npm install
# (project memory prefers pnpm, but package-lock vs pnpm-lock determines which — check the repo lockfile first)
```

**Version verification:** All versions above read directly from `/Users/davideloreti/virtuna-landing-v2/package.json` `[VERIFIED: package.json]`. No registry round-trip needed (no new packages added).

## Package Legitimacy Audit

No external packages are added this phase. All libraries used are already declared in `package.json` and locked by `main`. slopcheck N/A — zero new install surface. The only install action is `npm install` against the existing, committed manifest.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none added) | — | No new packages — audit N/A |

---

## §1 — globals.css PORT DELTA (D-01,D-02,D-03,D-04,D-06)

**Approach (confirmed by diffing both files):** the two `@theme` blocks are structurally identical (same token names, same ordering, same comments scaffold). The port is **NOT a hand-merge** — the cleanest, lowest-risk task is: **replace landing-v2's `globals.css` wholesale with numen-rework's `globals.css`.** Every section below the `@theme` block (Raycast aliases, keyframes, utility classes, base styles, `@theme inline` marquee) is also byte-identical between the two files EXCEPT the deltas enumerated here. A wholesale copy guarantees no token-name drift.

`[VERIFIED: codebase diff]` — both files read in full this session.

### (a) The flat-warm token blocks to BRING OVER

These are the blocks present in numen-rework `globals.css` that differ from / are absent in landing-v2's current cold file. Port verbatim:

**Coral scale — re-hue 40→33, deeper/desaturated (replaces landing-v2 lines 15-23):**
```css
/* --- Coral Scale (brand) — matured toward terracotta/clay (D-04) --- */
--color-coral-100: oklch(0.97 0.025 33);
--color-coral-200: oklch(0.93 0.05 33);
--color-coral-300: oklch(0.87 0.08 33);
--color-coral-400: oklch(0.76 0.11 33);   /* accent-hover */
--color-coral-500: oklch(0.68 0.13 33);   /* terracotta base ≈ #d97757 */
--color-coral-600: oklch(0.58 0.115 33);  /* accent-active */
--color-coral-700: oklch(0.47 0.10 33);
--color-coral-800: oklch(0.37 0.08 33);
--color-coral-900: oklch(0.28 0.065 33);
```

**NEW charcoal surface scale (absent in landing-v2 — ADD):**
```css
/* --- Charcoal Surface Scale (flat-warm) — MUST be exact HEX (oklch L<0.15 miscompiles in TW v4 @theme) --- */
--color-charcoal-app: #262624;       /* dominant app surface (replaces #07080a) */
--color-charcoal-sidebar: #1a1a18;   /* header/footer surface, one tone-step off */
--color-charcoal-composer: #1e1d1b;  /* card / composer surface */
--color-charcoal-chip: #2f2e2b;      /* chips / lifted matte / PLACEHOLDER chip surface */
```

**NEW cream text scale (absent — ADD):**
```css
/* --- Cream Text Scale — never pure white --- */
--color-cream-primary: #ece7de;      /* brightest text */
--color-cream-secondary: #c2bdb4;    /* default chrome / nav links */
--color-cream-muted: #8a857c;        /* placeholders, labels, captions, em-dash empties */
```

**Repointed semantic backgrounds (landing-v2 lines 69-72 → repoint):**
```css
--color-background: var(--color-charcoal-app);              /* was var(--color-gray-950) #07080a */
--color-background-elevated: var(--color-charcoal-sidebar); /* was var(--color-gray-900) */
--color-surface: var(--color-charcoal-composer);           /* was #18191a */
--color-surface-elevated: var(--color-charcoal-chip);      /* was #222326 */
```

**Repointed semantic text (landing-v2 lines 75-77 → repoint):**
```css
--color-foreground: var(--color-cream-primary);            /* was var(--color-gray-50) */
--color-foreground-secondary: var(--color-cream-secondary);/* was var(--color-gray-400) */
--color-foreground-muted: var(--color-cream-muted);        /* was var(--color-gray-500) */
```

**Note on `--color-accent-foreground`:** value `#1a0f0a` is identical in BOTH files. Only the trailing comment differs (landing-v2 claims "7.2:1 AAA"; numen-rework says "verify AA >7:1"). **The real measured ratio is 6.02:1 = AA pass, below AAA** (per approved UI-SPEC contrast table). No value change required — AA (the FOUND-07 bar) is met. Optionally darken to `#140a06` for AAA; executor's call, NOT a blocker.

**`--color-accent-transparent` alias (`:root` block, landing-v2 line 227):** update hue to match — `oklch(0.68 0.13 33 / 0.15)` (was `oklch(0.72 0.16 40 / 0.15)`).

### (b) Tokens to REMOVE / FLATTEN (D-06)

| Token | landing-v2 current value | Action |
|-------|--------------------------|--------|
| `--shadow-glass` | `0 8px 32px ... inset 0 1px 0 ...` (line 145) | **DELETE** the definition. (Consumers: `showcase/page.tsx` displays it — keep a no-op alias OR accept the showcase swatch goes blank; see note.) |
| `--shadow-glow-accent` | `0 0 20px oklch(0.72 0.16 40 / 0.3)` (line 146) | **DELETE.** |
| `--shadow-button` (inset-shine) | 4-layer with `rgba(255,255,255,0.19)` glow + 2 inset white shines (line 147) | **REPLACE** with flat-matte: `rgba(0,0,0,0.5) 0 0 0 2px, rgba(0,0,0,0.2) 0 1px 2px 0` (numen-rework line 168). |
| `--gradient-navbar` | `linear-gradient(137deg, rgba(17,18,20,0.75)...)` (line 194) | **DELETE.** (Old `header.tsx` consumes it — but header is rewritten/deleted. `showcase/page.tsx` displays it.) |
| `--gradient-glass` | `linear-gradient(137deg, ...)` (line 195) | **DELETE.** |
| `--gradient-feature` | `radial-gradient(...)` (line 196) | **DELETE.** |
| `--gradient-card-bg` | `linear-gradient(137deg, #111214 ..., #0c0d0f ...)` (line 192) | **FLATTEN** to `var(--color-charcoal-composer)` (numen-rework keeps it as a solid-charcoal alias so `var()` refs resolve). |

**ADD the float shadow (absent in landing-v2):**
```css
--shadow-float: 0 10px 30px rgba(0, 0, 0, 0.35);  /* the ONLY allowed shadow — genuinely floating surfaces only */
```

**Showcase-swatch note:** `src/app/(marketing)/showcase/page.tsx` references `--gradient-navbar`, `--shadow-glass`, and `--gradient-card-bg` to *display* them as token swatches (it's a design-system showcase page, not a consumer). `/showcase` is OUT of Phase-1 scope (a sibling route, deferred reskin). **Recommendation: keep `--gradient-navbar`, `--gradient-glass`, `--shadow-glass` as no-op/flattened aliases** (e.g. point them all at the solid charcoal / `none`) rather than fully deleting, so the showcase page doesn't `var()`-resolve to invalid and to match numen-rework's "keep tokens so refs resolve" strategy. The wholesale-copy approach handles this automatically since numen-rework already flattened `--gradient-card-bg` and removed the others without breaking its own build.

### (c) Token NAME mismatches that would break references

**None.** This is the critical de-risking finding: every semantic token name is **identical** between the two `@theme` blocks (`--color-background`, `--color-foreground`, `--color-accent`, `--color-border`, `--color-surface*`, the full spacing/radius/type/z scales). The flat-warm system changes only the *values* the semantics point at (via the primitive layer). Components referencing `bg-background`, `text-foreground`, `border-border`, `bg-accent`, etc. auto-reskin with zero edits. `[VERIFIED: codebase diff]`

The cold `--color-gray-*` ramp SURVIVES in numen-rework (lines 30-40) — it is NOT deleted, because product data/score components still reference it. Keep it. Flat-warm adds the charcoal/cream scales *alongside* and repoints the semantics off gray onto charcoal/cream. No gray-* reference breaks.

### (d) Tailwind v4 oklch-L<0.15 gotcha — which tokens MUST be hex

`[CITED: CLAUDE.md root + worktree]` — "Very dark colors (L < 0.15) compile incorrectly in `@theme`. Use exact hex for dark tokens."

| Token | Must be HEX? | Reason |
|-------|--------------|--------|
| `--color-charcoal-app` `#262624` | **YES (hex)** | L≈0.18 — close to the danger zone; numen-rework uses hex. Preserve hex. |
| `--color-charcoal-sidebar` `#1a1a18` | **YES (hex)** | L≈0.12 — in the miscompile zone. Hex mandatory. |
| `--color-charcoal-composer` `#1e1d1b` | **YES (hex)** | L≈0.14 — danger zone. Hex mandatory. |
| `--color-charcoal-chip` `#2f2e2b` | **YES (hex)** | L≈0.21 — borderline; keep hex for consistency. |
| `--color-cream-*` | hex (already) | High-L, oklch would be safe, but numen-rework uses hex — preserve. |
| `--color-coral-*` | **oklch is SAFE** | L 0.28-0.97, all well above 0.15. numen-rework keeps these as oklch deliberately. Do NOT convert to hex. |
| `--color-accent-foreground` `#1a0f0a` | **YES (hex)** | Very dark brown, L<0.1 — hex mandatory. |

**Net rule for the planner:** the wholesale copy already has every dark surface as hex and every coral step as oklch. Do NOT "normalize" the file to all-oklch or all-hex — the mixed representation is intentional and gotcha-driven.

### (e) Keyframes the placeholder/motion work needs

All present in BOTH files already (numen-rework added none beyond what landing-v2 has):
- `skeleton-breathe` (lines 276-283 landing-v2 / 295-302 numen) — **needed** for the optional `<Placeholder>` breathe (D-13). `.animate-skeleton-breathe` utility class exists (1.2s ease-in-out infinite).
- `shimmer` (lines 267-274) — used by `ui/skeleton.tsx`; the reduced-motion CSS block must gate it.
- `marquee` / `marquee-vertical` (`@theme inline`, lines 311-330) — for the Phase-4 logo wall; the reduced-motion CSS block should gate it now so it's foundation-correct.
- `accordion-down/up`, `gradient-x` — present; FAQ accordion (P4) and not used in P1 chrome.

**No new keyframes required in Phase 1.** The CSS `@media (prefers-reduced-motion: reduce)` block (D-17) must set `animation: none` for `.animate-skeleton-breathe`, `.animate-shimmer`, and `.animate-marquee` / `.animate-marquee-vertical`.

---

## §2 — Newsreader font wiring (D-05)

### EXACT pattern from numen-rework `layout.tsx` (verbatim, lines 1-20, 49-60):
```tsx
import { Inter, Newsreader } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-newsreader",
  style: ["normal", "italic"],
  weight: ["400"],
});

// ...

<html lang="en" className={`${inter.variable} ${newsreader.variable}`}>
```

### What changes in landing-v2's CURRENT root `layout.tsx`

`[VERIFIED: codebase]` — landing-v2 root `layout.tsx` currently imports ONLY `Inter` (line 2: `import { Inter } from "next/font/google";`) and the `<html>` className is `` `${inter.variable}` `` (line 43).

**Precise 3-line diff (do NOT disturb existing Inter wiring or metadata):**
1. **Line 2:** `import { Inter } from "next/font/google";` → `import { Inter, Newsreader } from "next/font/google";`
2. **After the `inter` const (line 10):** add the `newsreader` const block exactly as above (subsets latin, display swap, variable `--font-newsreader`, style `["normal","italic"]`, weight `["400"]`).
3. **Line 43:** `className={`${inter.variable}`}` → `className={`${inter.variable} ${newsreader.variable}`}`

`--font-serif` in `globals.css` already resolves to `var(--font-newsreader)` (numen-rework line 123 — comes over with the wholesale `globals.css` copy). No element renders serif in Phase 1 chrome (D-05 — reserved for the Phase-2 hero). `font-serif` Tailwind utility will Just Work once the var is wired.

**`(marketing)/layout.tsx` does NOT need font wiring** — it currently mis-declares its own `Inter` with `preload: false` (D-10 bug). That whole layout collapses to a pass-through (see §5). The root layout is the sole font owner.

---

## §3 — framer-motion → motion/react migration surface (D-16) — RE-SCOPED

### VERIFIED grep (this session, both `from "..."` and any `framer-motion` string):

**The ONLY 4 files importing `framer-motion`:**
```
src/components/app/simulation/analysis-loading.tsx:4   import { motion, AnimatePresence } from 'framer-motion';
src/components/app/simulation/loading-phases.tsx:3      import { AnimatePresence, motion } from 'framer-motion';
src/components/viral-results/FactorCard.tsx:4           import { motion } from "framer-motion";
src/components/viral-results/ViralScoreRing.tsx:4       import { motion, useSpring, useTransform } from "framer-motion";
```
All 4 are **PRODUCT surface** (`app/simulation/*`, `viral-results/*`). **NONE** in `src/components/motion/`, NONE in `marketing/`, NONE in `layout/`. No `require('framer-motion')`, no dynamic import. `[VERIFIED: codebase grep]`

### What `src/components/motion/*` actually imports TODAY:

ALL 6 wrappers already import `motion/react` — migration is **effectively complete**:
```
hover-scale.tsx       import { motion, useReducedMotion } from "motion/react";
stagger-reveal.tsx    import { motion, useReducedMotion } from "motion/react";  + type { Variants }
fade-in-up.tsx        import { motion, useReducedMotion } from "motion/react";  + type { Variants }
fade-in.tsx           import { motion, useReducedMotion } from "motion/react";  + type { Variants }
page-transition.tsx   import { motion, AnimatePresence, useReducedMotion } from "motion/react";
slide-up.tsx          import { motion, useReducedMotion } from "motion/react";  + type { Variants }
```
(`frozen-router.tsx` imports no motion lib.) `[VERIFIED: codebase grep]`

### Honest re-scope of D-16:

- **Is the marketing landing already framer-motion-free? → YES.** Every motion primitive the landing uses (`FadeIn`, `FadeInUp`, `SlideUp`, `StaggerReveal`, `HoverScale`, `PageTransition`) is on `motion/react`. The marketing surface has ZERO `framer-motion` coupling today.
- **Is removing the `framer-motion` dep safe in Phase 1? → NO — blocked by the 4 product files.** Uninstalling `framer-motion` would break `app/simulation/*` and `viral-results/*` typechecking/build. Those are out of Phase-1 (marketing-only) scope.
- **Migrating the 4 product files now? → NOT recommended in Phase 1.** They're product surface; touching them violates the marketing-surface-only constraint and risks the engine/app build for zero marketing benefit.

### CRISP RECOMMENDATION FOR THE PLANNER:
**leave-product-files-alone + defer-dep-removal.** Phase 1's D-16 task reduces to a one-line VERIFY ("grep confirms all `motion/*` wrappers import `motion/react` — they do") plus the new wiring of `<MotionConfig>` (§ below). Add NO migration task. Record the 4 product `framer-motion` files as a Phase-5 (or separate product-milestone) cleanup item. The CONTEXT/UI-SPEC already anticipated this ("defer if anything still imports it") — this confirms the defer branch fires.

---

## §4 — ui/* primitives carrying glass/gradient/shine (D-06) — SCOPED FILE LIST

`[VERIFIED: codebase grep across all of src/]`

### Removed-token consumers (would `var()`-resolve to deleted tokens):
| File | Tokens referenced | In Phase-1 render path? | Action |
|------|-------------------|--------------------------|--------|
| `src/components/layout/header.tsx` | `--gradient-navbar` (+ inline `backdropFilter: blur(5px)` + inset shine) | **YES — it IS the header** | **DELETED/REWRITTEN by D-19** — the glass goes away with the rewrite. No separate flatten task. |
| `src/app/(marketing)/showcase/page.tsx` | `--gradient-navbar`, `--shadow-glass`, `--gradient-card-bg` | NO (sibling route, deferred) | Keep tokens as no-op aliases (§1b) so it resolves. Do NOT reskin `/showcase` this phase. |
| `src/app/globals.css` | (the definitions) | — | Edited by the port itself. |

### `ui/*` primitives with hardcoded blur/shine (inline `style`, not Tailwind classes — that's why the first class-grep missed them):
| File | Blur/shine | In Phase-1 render path? | Action |
|------|-----------|--------------------------|--------|
| `ui/card.tsx` | `GlassCard` export: `backdropFilter: blur()`, inner-glow inset shine, `glow` prop | **NO** — Phase-1 `<Placeholder>` and stub sections are hand-built in `marketing/`, not `GlassCard`. The base `Card` is fine. | Do NOT touch in P1. Flag for a later "flatten GlassCard" pass IF a Phase-2-4 section ever uses it. |
| `ui/dialog.tsx` | overlay `backdropFilter: blur(4px)` + content inset shine | **NO** — no dialogs in P1 chrome | Leave. |
| `ui/toast.tsx` | `backdropFilter: blur(12px)` + inset shine | **NO** — no toasts in P1 | Leave. |
| `ui/select.tsx` | `backdropFilter: blur(12px)` ×2 + inset shine | **NO** — no selects in P1 | Leave. |

### Phase-1-RELEVANT `ui/*` primitives — ALL CLEAN (verified individually):
`button` · `card` (base) · `sheet` · `dropdown-menu` · `accordion` · `marquee` · `avatar` · `testimonial-card` · `popover` · `skeleton` → **zero** glass/removed-token hits. They reference semantic tokens only → auto-adopt flat-warm after the port. `[VERIFIED: per-file grep]`

### Recommendation:
**No "flatten-on-touch" task is needed for Phase 1.** The only glass in P1's actual render path is the old `header.tsx`, which D-19 rewrites from scratch anyway. The `ui/{card-GlassCard,dialog,toast,select}` blur lives in primitives Phase-1 never mounts. Record a deferred note: "If any Phase 2-4 section reaches for `GlassCard`/`Dialog`/`Toast`/`Select`, flatten that primitive's inline blur/shine at that time." The deep `src/components/primitives/Glass*` and product surfaces are fully out of scope.

---

## §5 — Route-mount + deletion blast radius (D-09,D-10,D-11)

`[VERIFIED: codebase]`

### What `(marketing)/layout.tsx` currently renders (the D-10 bug):
```tsx
// CURRENT — duplicates root <html>/<body> + stale metadata + renders <Header/>
export const metadata = { title: "Artificial Societies | Human Behavior, Simulated", description: "AI personas..." };
export default function MarketingLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable}`}>   // ← DUP of root layout's <html>
      <body className="min-h-screen bg-background font-sans antialiased">  // ← DUP <body>
        <Header />                                       // ← Header rendered HERE
        {children}
      </body>
    </html>
  );
}
```
It also re-declares its own `Inter({ ..., preload: false })` (line 6-11). **D-10 fix:** collapse to a pass-through (`return <>{children}</>` or just `{children}` with no html/body), drop the stale metadata, drop the duplicate Inter. **Decide where `<Header/>` lives:** currently the layout renders it; the new scroll-skeleton can either keep `<Header/>` in the (simplified) marketing layout OR move it into `page.tsx`. Recommendation: keep `<Header/>` + `<Footer/>` in the `page.tsx` skeleton (matches D-09's "Header + main + Footer" description and the current `page.tsx` already renders `<Footer/>`), making the layout a bare `{children}` pass-through. Planner's call, but be explicit so Header isn't double-mounted.

### What's in `src/components/landing/*` (DELETE — D-11):
13 files + barrel: `backers-section`, `case-study-section`, `comparison-chart`, `cta-section`, `faq-section`, `feature-card`, `features-section`, `hero-section`, `partnership-section`, `persona-card`, `social-proof-section`, `stats-section`, `testimonial-quote`, `index.ts`. All old societies-clone. `[VERIFIED: ls + barrel]`

### Sibling routes that import `landing/*` and WILL BREAK on delete (grep `from .*landing`):
| File | Broken import | Fix task |
|------|---------------|----------|
| `src/app/(marketing)/page.tsx` | `import { HeroSection, BackersSection, FeaturesSection, StatsSection, CaseStudySection, PartnershipSection, FAQSection } from "@/components/landing"` + `import { Footer } from "@/components/layout/footer"` | This IS the new `/` — its body is fully replaced by the scroll skeleton (D-09). The `landing` import disappears naturally. |
| `src/app/(marketing)/pricing/page.tsx` | `import { FAQSection } from "@/components/landing"` (line 3) + `import { Footer } from "@/components/layout/footer"` (line 2) | **BREAKS.** `/pricing` is a sibling route. Planner MUST add a fix: either (a) replace `<FAQSection/>` usage with a stub/placeholder or remove it, or (b) inline a minimal FAQ. `/pricing` full reskin is deferred — minimal "stop the build break" fix only. The `Footer` import survives (footer is rewritten in place, same path/export). |

**`showcase/page.tsx` does NOT import `landing/*`** — it imports only `@/components/ui` + local `./_components/*`. Safe from the `landing/*` deletion (but see §1b re: it displaying removed *tokens*). `[VERIFIED: grep]`

### Dead test routes to DELETE (D-11) — all 4 EXIST and each is a single `page.tsx`:
```
src/app/(marketing)/viz-test/page.tsx              ✓ exists
src/app/(marketing)/viral-score-test/page.tsx      ✓ exists
src/app/(marketing)/board-preview/page.tsx         ✓ exists
src/app/(marketing)/primitives-showcase/page.tsx   ✓ exists
```
`viz-test/page.tsx` also uses `backdrop-blur` — irrelevant, it's deleted. No other route imports these (they're leaf test routes). `[VERIFIED: ls + grep]`

### Header/Footer current state (both = full societies rewrite targets):
- `src/components/layout/header.tsx` `[VERIFIED]`: the OLD GLASS PILL — `style={{ background: "var(--gradient-navbar)", backdropFilter: "blur(5px)", boxShadow: "...inset" }}`, rounded-2xl pill, "Sign in" → `/auth/login`, "Book a Meeting" → calendly, phosphor `List`/`X` icons, "Numen home" aria but societies design comment. **Full D-19 rewrite:** flat opaque bar, hairline bottom border, no blur/shine, "Try it free" → `/signup`, "Sign in" → `/login`, anchor links.
- `src/components/layout/footer.tsx` `[VERIFIED]`: full societies content — "Ready to understand your audience?", calendly "Book a meeting", `founders@societies.io`, "Artificial Societies" brand, LinkedIn `societies.io`, "Subprocessors" link, phosphor SSR icons. **Full D-22 rebuild:** Numen brand, anchor mirror, Privacy/Terms/X/TikTok placeholders.
- Both keep their paths (`components/layout/{header,footer}.tsx`) and exports — rewritten in place per D-11, so the `layout/index.ts` barrel and the `Footer` import in `pricing/page.tsx` stay valid.

### Route-mount mechanics (FOUND-01):
Replacing `(marketing)/page.tsx` body. It's a server component (no `"use client"`). Add `export const metadata` with correct Numen copy (planner writes — root layout has base metadata; page can override title/description). The skeleton = `<Header/>` + `<main>` of stub `<section id="...">` anchors + `<Footer/>`.

---

## §6 — Placeholder + reduced-motion reuse (FOUND-03, FOUND-04)

`[VERIFIED: codebase]`

### Hooks — ALREADY PRESENT, no port needed:
- `src/hooks/usePrefersReducedMotion.ts` ✓ — **byte-identical to numen-rework's** (verified). Returns `true` when user prefers reduced motion; defaults `true` (reduced) for SSR safety. Query: `(prefers-reduced-motion: no-preference)`, returns `!matches`. UI-SPEC's claim "already present — no port needed" is CONFIRMED.
- `src/hooks/useIsMobile.ts` ✓ — present, 768px breakpoint, defaults `true` (mobile) for SSR safety. CONFIRMED.

(UI-SPEC referenced these at `src/hooks/use*.ts` — actual paths confirmed: `src/hooks/usePrefersReducedMotion.ts`, `src/hooks/useIsMobile.ts`. Both `camelCase` filenames, not kebab.)

### `MotionConfig reducedMotion="user"` — VERIFIED supported (D-17):
`[CITED: motion.dev/docs/react-motion-config + react-accessibility]` via Context7 (`/websites/motion_dev`):
> "Set the `reducedMotion` option to `"user"` on `MotionConfig` to automatically disable transform and layout animations for all `motion` components, while preserving opacity and background color animations."

`reducedMotion` accepts `"user" | "always" | "never"` (defaults `"never"`). `motion@^12.29.2` is current and exports `MotionConfig` from `motion/react`. **Important nuance for the planner:** `reducedMotion="user"` disables *transform & layout* animations but PRESERVES *opacity/backgroundColor* — so opacity-only fades still play under reduced-motion. The existing wrappers ALSO short-circuit independently via `useReducedMotion()` (e.g. `fade-in.tsx` returns a plain `<div>` when reduced). The two layers are complementary: `MotionConfig` catches any *new* raw `motion.*` elements; the wrappers self-gate. Wire `<MotionConfig reducedMotion="user">` at the marketing tree root (page or a client boundary) — it's a client component, so it needs a `"use client"` wrapper around the skeleton's motion subtree (the RSC `page.tsx` can render a thin client `<MotionConfig>` shell).

### CVA + `cn()` convention the `<Placeholder>` must match:
**Pattern analog = `src/components/ui/button.tsx`** `[VERIFIED]`:
- `import { cva, type VariantProps } from "class-variance-authority";`
- `import { cn } from "@/lib/utils";`
- `const xVariants = cva([baseClasses], { variants: {...}, defaultVariants: {...} });`
- `interface Props extends ..., VariantProps<typeof xVariants> {}`
- `className={cn(xVariants({ variant, size, className }))}`
- `forwardRef`, `displayName`, named export + variants export.

`<Placeholder>` should mirror this: a `placeholderVariants` CVA keyed on `variant` (image/video/avatar/logo) with `defaultVariants`, `aspect`/`label`/`src` as plain props (aspect drives an inline `style={{ aspectRatio }}` since it's a free string, not a CVA enum), `cn()` for class composition, lives in NEW `src/components/marketing/placeholder.tsx` with a `src/components/marketing/index.ts` barrel (D-15). Reference `ui/skeleton.tsx` for the `motion-reduce:animate-none` breathe-gating pattern (it sets `animation` inline + `motion-reduce:animate-none` class to override).

### `cn()` location: `src/lib/utils.ts` ✓ (`twMerge(clsx(inputs))`). Confirmed.

---

## Runtime State Inventory

> This is a greenfield-within-worktree scaffold phase (marketing surface). No datastores, no live services, no OS registrations are renamed or migrated. The only "state" concerns are build-time.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** — marketing-surface-only; no DB/datastore touched (engine/Supabase live on `main`, untouched). | None |
| Live service config | **None** — no external service config references the changed strings. | None |
| OS-registered state | **None** — no task scheduler / pm2 / launchd involvement. | None |
| Secrets/env vars | **None blocking.** `.env.local` does not propagate to fresh worktrees (project memory), but Phase 1 marketing surface makes NO Supabase/auth/engine calls. The CTA is a static `/signup` link, not an API call. Build does not require `.env.local`. | None for P1 (note for later phases) |
| Build artifacts | **`node_modules` ABSENT** (fresh worktree). `.next/` cache may carry stale CSS after the theme port (CLAUDE.md gotcha). | `npm install` (task-zero); clear `.next/` + restart dev if CSS doesn't update. |

**Verified explicitly:** marketing-surface-only scope means zero runtime-state migration. The sole runtime concern is `npm install` + `.next/` cache clearing.

## Common Pitfalls

### Pitfall 1: Building/testing before `npm install`
**What goes wrong:** `node_modules` is absent in this fresh worktree — `next build`, `vitest`, `tsc`, and `next dev` all fail immediately.
**Why it happens:** worktrees fork from `main`'s tree but don't carry the (gitignored) `node_modules`.
**How to avoid:** `npm install` is task-zero before any verification step. The planner must order it first.
**Warning signs:** "Cannot find module 'next'/'motion'/'react'" on first command.

### Pitfall 2: Header double-mount
**What goes wrong:** the current `(marketing)/layout.tsx` renders `<Header/>` AND the rewritten skeleton may also render it in `page.tsx` → two headers.
**Why it happens:** D-10 strips the layout to a pass-through; if the skeleton adds `<Header/>` without removing the layout's, both render.
**How to avoid:** decide ONE owner. Recommendation: skeleton (`page.tsx`) owns `<Header/>` + `<Footer/>`; layout becomes bare `{children}`.
**Warning signs:** duplicated nav bar in the rendered `/`.

### Pitfall 3: Stale `.next/` CSS after the theme port
**What goes wrong:** charcoal/cream/coral changes don't appear; old cold colors persist.
**Why it happens:** Next dev-server + Lightning CSS cache `[CITED: CLAUDE.md]`.
**How to avoid:** kill dev server, clear `.next/` (and `node_modules/.cache/` + browser cache), restart.
**Warning signs:** `#07080a` bg still showing after the port.

### Pitfall 4: "Normalizing" the oklch/hex mix in globals.css
**What goes wrong:** converting charcoal hex → oklch (or coral oklch → hex) reintroduces the TW v4 L<0.15 miscompile, producing wrong dark surfaces.
**Why it happens:** an instinct to make the token file "consistent."
**How to avoid:** preserve the intentional mix (dark surfaces = hex, coral = oklch). The wholesale copy already has it right.
**Warning signs:** muddy/off charcoal after a "cleanup" pass.

### Pitfall 5: Deleting `landing/*` without fixing `pricing/page.tsx`
**What goes wrong:** `npm run build` breaks on `pricing/page.tsx`'s `import { FAQSection } from "@/components/landing"`.
**Why it happens:** the deletion blast radius extends one sibling route beyond `/`.
**How to avoid:** add the `pricing/page.tsx` FAQSection-removal/stub fix in the same task as the `landing/*` deletion.
**Warning signs:** build error "Module not found: @/components/landing" pointing at pricing.

## Validation Architecture

> `workflow.nyquist_validation: true` (verified in `.planning/config.json`). This is a pure-visual/scaffold phase, so the dominant validation surface is **build + typecheck + lint + visual-check**, with light unit tests on the one piece of logic (`<Placeholder>` variant resolution).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (`vitest run`) — `vitest.config.ts` present `[VERIFIED]` |
| Environment | Default `node`; component/hook tests opt into `happy-dom` via `/** @vitest-environment happy-dom */` file pragma |
| Setup file | `./src/test/setup.ts` |
| Existing tests | 212 test files in `src/**` (engine/board/hooks/components) |
| Quick run | `npx vitest run src/components/marketing` (scoped to new component) |
| Full suite | `npm test` (= `vitest run`) |
| Build/typecheck | `npm run build` (= `next build`, includes type-check) |
| Lint | `npm run lint` (= `eslint`) |

> Note: this worktree has **no `tsc`-only script** — type errors surface via `next build`. There is no standalone `typecheck` script; use `next build` (or add `tsc --noEmit` if a faster gate is wanted).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-01 | `/` renders the new skeleton (no `landing/*` import) | build / smoke | `npm run build` | n/a (build gate) |
| FOUND-02 | Flat-warm tokens compile; `bg-background` = `#262624` | build + visual | `npm run build` + manual visual-check | n/a |
| FOUND-03 | `<Placeholder>` resolves variant→icon, renders `src` when present vs stand-in when absent, locks `aspect-ratio` | unit (happy-dom) | `npx vitest run src/components/marketing/__tests__/placeholder.test.tsx -x` | ❌ Wave 0 |
| FOUND-04 | Reduced-motion: wrappers return static node; CSS block sets `animation:none` | unit (happy-dom) + visual | `npx vitest run src/components/marketing` + DevTools "emulate prefers-reduced-motion" | ❌ Wave 0 (component test) |
| NAV-01 | Header renders `NumenLogo` + "Try it free" linking `/signup` | unit (happy-dom) | `npx vitest run src/components/layout/__tests__/header.test.tsx` | ❌ Wave 0 |
| NAV-02 | Footer renders brand + anchor mirror + legal/social stubs | unit (happy-dom) | `npx vitest run src/components/layout/__tests__/footer.test.tsx` | ❌ Wave 0 |
| NAV-03 | Mobile menu toggles open/closed, closes on link tap | unit (happy-dom, user-event) | `npx vitest run src/components/layout/__tests__/header.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run <scoped path>` for the touched component + `npm run build` if `globals.css`/routes changed.
- **Per wave merge:** `npm test` (full vitest) + `npm run build`.
- **Phase gate:** `npm run build` green + `npm test` green + manual visual-check of `/` (the only "UAT" per D-08 — a sanity look, NOT a new gate) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `src/components/marketing/__tests__/placeholder.test.tsx` — covers FOUND-03 (variant→icon, src-vs-stand-in, aspect-ratio lock, reduced-motion breathe gate)
- [ ] `src/components/layout/__tests__/header.test.tsx` — covers NAV-01 + NAV-03 (logo, CTA href, mobile toggle, close-on-tap)
- [ ] `src/components/layout/__tests__/footer.test.tsx` — covers NAV-02 (brand, anchors, legal/social stubs)
- [ ] No framework install needed — vitest + happy-dom already configured. (Confirm `@testing-library/react` + `user-event` are in deps after `npm install`; existing `__tests__/*.test.tsx` use them, so they're present.)
- **Visual-check is manual** (D-08): no automated visual-regression tooling in this worktree. The phase gate's visual sanity check is a human look at `/` under the assembled flat-warm theme.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node + npm | build/test/dev | ✓ (assumed — repo is Node) | — | — |
| `node_modules` | everything | ✗ **ABSENT** | — | `npm install` (task-zero) — no fallback, hard blocker |
| `.env.local` | (Supabase/engine — NOT this phase) | ✗ (doesn't propagate to worktree) | — | Not needed: marketing-surface-only, no API calls |
| vitest + happy-dom | unit tests | ✓ (in package.json) | vitest configured | — |
| Playwright | e2e (not used in P1) | config present | — | N/A for P1 chrome |

**Missing dependencies with no fallback:**
- `node_modules` — `npm install` MUST run before any build/test/dev command. Planner orders it first.

**Missing dependencies with fallback:**
- `.env.local` — not required for the marketing surface; no fallback action needed for Phase 1.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cold Raycast brand (`#07080a`, glass, glow, `#FF7F50`) | Flat-warm (charcoal `#262624`, cream, terracotta `#d97757`, flat-matte) | numen-rework THEME-06 (UAT-locked) | This phase adopts it; no re-derivation. |
| `framer-motion` imports | `motion/react` (single `motion` package) | Already migrated in `motion/*` wrappers | Marketing surface is framer-motion-free today; dep removal deferred. |
| Glass pill header (`backdrop-blur`, inset shine) | Flat opaque sticky bar (hairline border, no blur) | D-19 (this phase) | Full header rewrite. |
| `CLAUDE.md` "Next 15" | Next.js **16.1.5** | package.json | Trust package.json; Next 16 App Router patterns apply. |

**Deprecated/outdated:**
- Root + numen-rework `BRAND-BIBLE.md`: STALE (old Raycast glass). Do NOT follow for visual direction — `globals.css` + `01-CONTEXT.md` are SSOT. Root BRAND-BIBLE OK for component-inventory only.
- `CLAUDE.md` Next 15 reference: outdated.

## Assumptions Log

> All material claims this phase were VERIFIED by direct file read/grep or CITED to official docs/CLAUDE.md. The few `[ASSUMED]` items below are low-risk and do not gate planning.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@testing-library/react` + `user-event` are installed (post-`npm install`) | Validation | LOW — existing `*.test.tsx` files use them, so they're in the manifest; confirm after install. |
| A2 | Wholesale-copying numen-rework `globals.css` won't drop a landing-v2-only token | §1 | LOW — diff showed identical structure; the cold gray ramp + sugar-high vars are present in BOTH. If a landing-only token existed it'd surface as an unresolved `var()` at build (caught by `npm run build`). |
| A3 | The repo uses `npm` (not pnpm) for this worktree | Stack | LOW — project memory prefers pnpm but says "npm if unavailable"; check the lockfile (`package-lock.json` vs `pnpm-lock.yaml`) before installing. Either works. |
| A4 | `next-themes` need not be wired (dark-only) | Stack | LOW — dark is the only mode project-wide; wiring a switcher would be out-of-scope. |

## Open Questions

1. **Header ownership — layout vs page?**
   - What we know: current layout renders `<Header/>`; current `page.tsx` renders `<Footer/>`. D-10 strips the layout.
   - What's unclear: whether the planner puts Header+Footer in `page.tsx` (recommended) or a simplified layout.
   - Recommendation: skeleton `page.tsx` owns both; layout = bare `{children}`. Avoids double-mount (Pitfall 2). Planner decides + states it explicitly.

2. **`/pricing` FAQSection fix depth.**
   - What we know: deleting `landing/*` breaks `pricing/page.tsx`'s `FAQSection` import.
   - What's unclear: stub it, remove it, or inline a minimal FAQ.
   - Recommendation: minimal "stop the build break" — remove the `<FAQSection/>` usage (or replace with a `<Placeholder>`/comment). Full `/pricing` reskin is deferred. Keep the change surgical.

3. **AAA vs AA on the CTA label.**
   - What we know: `#1a0f0a` on `#d97757` = 6.02:1 (AA pass, below AAA). FOUND-07 bar is AA.
   - What's unclear: whether anyone wants AAA.
   - Recommendation: ship as-is (AA met). Optional `#140a06` darken for AAA — executor's call, NOT a blocker. UI-SPEC already adjudicated this.

## Project Constraints (from CLAUDE.md)

- **Tailwind v4 oklch L<0.15 → use hex for dark tokens** (honored in §1d — charcoal stays hex).
- **Lightning CSS strips `backdrop-filter`** — moot here (flat-matte removes blur). If any survives, apply via inline `style` not class. (Phase 1 adds zero blur.)
- **Dev-server CSS cache** — kill dev + clear `.next/`/`node_modules/.cache/`/browser when CSS changes don't appear (Pitfall 3).
- **6%/10% borders, 12px card radius, Inter** — carried by the flat-warm theme (D-07).
- **Server components by default, `"use client"` only when interactive** — Footer = server; Header + MotionConfig + Placeholder-with-motion = client.
- **kebab-case components, barrel `index.ts`, CVA + clsx + tailwind-merge** — `<Placeholder>` in `marketing/placeholder.tsx` + `marketing/index.ts`.
- **NEVER save to root; never commit secrets** — N/A (no new root files, no secrets touched).
- **Run tests + verify build before commit** — Validation section's phase gate.

## Sources

### Primary (HIGH confidence)
- Direct file reads (this session): both worktrees' `globals.css`, `layout.tsx`; landing-v2 `(marketing)/layout.tsx`, `(marketing)/page.tsx`, `ui/button.tsx`, `ui/skeleton.tsx`, `motion/fade-in.tsx`, `layout/header.tsx`, `layout/footer.tsx`, `brand/numen-logo.tsx`, `lib/utils.ts`, `hooks/usePrefersReducedMotion.ts`, `hooks/useIsMobile.ts`, `vitest.config.ts`, `package.json`, `.planning/config.json`. `[VERIFIED: codebase]`
- Grep audits: framer-motion imports, removed-token consumers, blur usage, `landing/*` import blast radius, dead test routes, `ui/*` glass inventory. `[VERIFIED: codebase grep]`
- Context7 `/websites/motion_dev` — `MotionConfig reducedMotion="user"` semantics. `[CITED: motion.dev/docs/react-motion-config + react-accessibility]`

### Secondary (MEDIUM confidence)
- CONTEXT.md (D-01..D-24) + approved UI-SPEC.md — intent SSOT (the decisions, not re-derived here).
- CLAUDE.md (root + worktree) — Tailwind v4 / Lightning CSS gotchas. `[CITED]`

### Tertiary (LOW confidence)
- None. All load-bearing claims verified or cited.

## Metadata

**Confidence breakdown:**
- globals.css port delta: **HIGH** — both files diffed byte-for-byte; token names confirmed identical.
- Newsreader wiring: **HIGH** — exact source pattern + exact 3-line target diff verified.
- D-16 re-scope: **HIGH** — exhaustive grep; all 6 wrappers + all 4 product files inspected.
- ui/* flatten scope: **HIGH** — per-file grep of every Phase-1-relevant primitive.
- Deletion blast radius: **HIGH** — `landing/*` importers enumerated; dead routes confirmed to exist.
- Placeholder/reduced-motion reuse: **HIGH** — hooks confirmed identical-to-numen-rework + present; `MotionConfig` support cited to official docs.

**Research date:** 2026-06-14
**Valid until:** stable — token/file facts are repo-state snapshots; re-verify only if `globals.css` or `package.json` change before planning.

## RESEARCH COMPLETE

**Phase:** 1 - Foundation & Shell
**Confidence:** HIGH

The three findings that most change the plan: (1) **D-16 is a non-event** — all six `motion/*` wrappers already import `motion/react` and the marketing surface is entirely framer-motion-free; the only `framer-motion` importers are four out-of-scope product files, so the planner should add ZERO migration work and explicitly defer the dep removal (no Phase-1 risk). (2) **The flat-warm token port does NOT cascade visual breakage** — every Phase-1-relevant `ui/*` primitive (button, base card, sheet, dropdown, accordion, marquee, avatar) is clean; the only glass in the render path is the old `header.tsx`, which D-19 rewrites away anyway, and the residual blur lives in modal/overlay primitives (`dialog`/`toast`/`select`/`GlassCard`) the landing never mounts — so "flatten on touch" needs no dedicated task. (3) **This is a fresh worktree with no `node_modules`**, making `npm install` a hard task-zero before any build/test/dev. Beyond those: the port is best done as a wholesale `globals.css` replace (token names are byte-identical, so it's a clean value swap with charcoal-as-hex / coral-as-oklch preserved per the TW v4 gotcha); Newsreader wiring is a precise 3-line root-layout diff; the `landing/*` deletion breaks exactly one sibling (`pricing/page.tsx`'s `FAQSection`) needing a surgical stub fix; both hooks are already present and identical to numen-rework; and `MotionConfig reducedMotion="user"` is confirmed-supported (it disables transform/layout but preserves opacity, complementing the wrappers' own self-gating). Validation is build + typecheck-via-`next build` + scoped vitest (happy-dom) on the new components + a single human visual-check (D-08 — no new UAT gate).

### File Created
`/Users/davideloreti/virtuna-landing-v2/.planning/phases/01-foundation-shell/01-RESEARCH.md`

### Ready for Planning
Research complete. The planner can now write concrete `01-01`..`01-05` plans with exact token blocks, exact file lists, and exact import diffs — no "go read the other worktree" indirection remains.
