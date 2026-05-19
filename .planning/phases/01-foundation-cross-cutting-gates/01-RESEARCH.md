# Phase 1: Foundation + Cross-Cutting Gates — Research

**Phase:** 1
**Researched:** 2026-05-19
**Domain:** Next.js 16 App Router foundation — cascade-isolated CSS layer, Lenis smooth scroll, LazyMotion bundle optimization, Playwright visual harness, Sentry web vitals, anti-slop gate primitives
**Confidence:** HIGH
**Source decisions referenced:** D-01..D-27 (from `01-CONTEXT.md`)
**Requirements addressed:** FOUND-01..FOUND-14

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01..D-27 — verbatim)

**Milestone Scope**
- **D-01:** Scope = **"same grammar, original vocabulary"** — match Linear's craft bar, layout grammar, visual language (3D depth, soft gradients, screenshot-forward heroes); original Virtuna copy + illustrations + coral palette. No literal asset reuse.
- **D-02:** Secondary craft reference = **raycast.com** (alongside primary linear.app).

**Section Brief Workflow (FOUND-14 extension)**
- **D-03:** Briefs written **per-phase, lazy**. Phase 1 writes only the TEMPLATE at `.planning/SECTION-BRIEF-TEMPLATE.md`.
- **D-04:** Section brief template MUST include 7 subsections: Purpose, Audience, Content, Interaction goals, Success criteria, Anti-slop list for this section, Reference anchors.

**Visual Verification Protocol (FOUND-11 extension)**
- **D-05:** Per-phase **visual gate** is **5-layer**, all must be green: Playwright snapshots @ 375/768/1280 + side-by-side audit doc + AI ui-checker pass + craft rubric scoring (5/6 dimensions PASS) + Davide visual review.
- **D-05a:** **Technical phase-gate checklist (FOUND-13) is also required**, complementing visual gate: Lighthouse mobile LCP < 2.5s + CLS < 0.1, production build verification (`next build && next start`), dashboard regression snapshot, `git diff --name-only` scope guard, `landing.css` scope check, both gates must be green to ship.
- **D-06:** Phase 1 captures **frozen reference snapshots** in `verification/reference/`: linear-desktop-1280.png, linear-tablet-768.png, linear-mobile-375.png, linear-bento.png, linear-pricing.png, raycast-desktop-1280.png, raycast-tablet-768.png, raycast-mobile-375.png, raycast-feature-section.png.
- **D-07:** No live linear.app / raycast.com fetching during automation. Snapshots refreshed only on visible-difference basis (manual).

**Anti-AI-Slop Discipline (FOUND-12 extension)**
- **D-08:** CRAFT-RUBRIC.md MUST embed the **AS-01..AS-15 anti-slop blacklist** from `.planning/research/anti-slop-design-playbook.md`. Each forbidden pattern has a refined alternative documented. Phase fails visual gate if any forbidden pattern appears.
- **D-09:** Per-section workflow follows **layered iteration**: structure → typography → color → motion → polish, with snapshot between each layer.
- **D-10:** Prompting vocabulary discipline: "Refine" not "improve"; specific values not adjectives; negative constraints first; reference-anchored framing; specific timings in motion.

**Claude Skill + Reference Files**
- **D-11:** Install **Taste Skill** (`github.com/Leonxlnx/taste-skill`) at `.claude/skills/taste-virtuna/` for this milestone. Read by gsd-ui-checker.
- **D-12:** Fetch **Linear and Raycast DESIGN.md files** from `github.com/VoltAgent/awesome-design-md` into `.planning/reference/design-md/linear.md` + `.planning/reference/design-md/raycast.md`.

**Component Library Policy**
- **D-13:** **Primary source = existing 36-component Virtuna DS**. Fork (don't modify) when landing variant differs.
- **D-14:** **shadcn/ui** = allowed for new primitives (copy-paste, no runtime dep additions).
- **D-15:** **Magic UI** = selective copy-paste ONLY. Each import requires section-brief justification.
- **D-16:** **Aceternity UI** = **discouraged by default**.
- **D-16a:** Motion Primitives = reference only. react-bits = selective copy-paste. Origin UI = allowed primitive source. NextUI/Hero UI = discouraged. Tailwind UI = reference only. awesome-design-md = reference/context only. StyleSeed = DO NOT install. Any other library requires CONTEXT.md amendment before first import.

**Token Scope + Cascade Isolation**
- **D-17:** `landing.css` declares `@layer landing { ... }` (CSS cascade layer) and is imported **ONLY** from `src/app/(marketing)/layout.tsx`. NEVER from root `src/app/layout.tsx`.
- **D-18:** Token naming prefix `--landing-*`. **No mutations to global `@theme` in `globals.css`**.
- **D-19:** Build-time scope check at `scripts/check-landing-scope.ts` — fails CI if `landing.css` is imported anywhere outside `src/app/(marketing)/`.

**Day-1 Baseline Shape (FOUND-02 extension)**
- **D-20:** After Phase 1 ships, `src/app/(marketing)/page.tsx` renders **empty scaffold with 7 section placeholders** using `<section data-section="...">` for hero/bento/how-it-works/behavioral-moat/social-proof/pricing/footer.
- **D-21:** Each placeholder MUST use `data-section="<name>"` (matches FOUND-11 convention).

**Legacy Cleanup**
- **D-22:** All 14 files in `src/components/landing/` deleted in a **single commit**.
- **D-23:** Standalone `/pricing` route deleted in same commit. `next.config.ts` adds permanent redirect `/pricing → /#pricing`.
- **D-24:** Other `(marketing)/` routes (`coming-soon`, `primitives-showcase`, `showcase`, `viral-score-test`, `viz-test`) are **out of scope** — untouched.

**Web Vitals + Bundle Analyzer**
- **D-25:** Phase 1 implements FOUND-09 floor (`console.log` in dev) **AND** wires Sentry web vitals reporter in prod. Scoped to landing route via route check inside reporter.
- **D-26:** `@next/bundle-analyzer` setup includes documented baseline budget: hero critical path < 200 KB gzipped. Phase 1 captures baseline from empty-scaffold day-1 build.

**Open Items**
- **D-27:** Davide will define Virtuna narrative for each section brief. Agents execute on briefs, won't fabricate copy.

### Claude's Discretion (research must give actionable guidance)
- File structure for `verification/reference/` snapshot capture script — research recommends checked-in `pnpm run capture:refs` command (see §13).
- Taste Skill scope: `.claude/skills/taste-virtuna/` (project-scoped) recommended — ships with worktree.
- Exact PostCSS / Tailwind v4 invocation order for `@layer landing` compilation — researched (see §1).
- `LenisProvider` extracted to `src/components/landing/lenis-provider.tsx` — recommended (see §2).

### Deferred Ideas (OUT OF SCOPE)
- Live demo widget in hero (paste TikTok URL → see prediction)
- Real testimonials section / Logo strip of brand-deal partners
- `/about`, `/research`, `/manifesto` supporting pages
- Command-K palette on landing
- Light mode variant
- Animated product walkthrough hero (vs static screenshot)
- Reviving paused `milestone/landing-page` or `milestone/landing-page-redesign` branches
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | Delete 14 files in `src/components/landing/` in single commit | §15 — files enumerated, only 2 consumers verified, atomic-commit strategy documented |
| FOUND-02 | Replace landing route at `src/app/(marketing)/page.tsx` with clean baseline | §1 + D-20 — empty scaffold with 7 `<section data-section="...">` placeholders |
| FOUND-03 | Route-scoped `src/app/(marketing)/landing.css` with display scale, motion easings, gradient tokens | §1 — full `@layer landing` pattern + token list + hex-for-dark rule |
| FOUND-04 | `lenis` 1.3.23 installed; `LenisProvider` wraps `(marketing)/layout.tsx` only | §2 — full SSR-safe LenisProvider code, prefers-reduced-motion handling, Radix conflict mitigation |
| FOUND-05 | `LazyMotion` provider configured; landing components use `m.*` not `motion.*` | §3 — strict mode setup, domAnimation choice, migration path from existing motion components |
| FOUND-06 | Inter `next/font` extended with `axes: ['opsz']`; `font-optical-sizing: auto` survives Tailwind v4 reset | §9 — exact next/font signature + globals.css base style change |
| FOUND-07 | `next.config.ts` updated with `formats: ['image/avif', 'image/webp']` | §6 — exact Next.js 16 syntax shown |
| FOUND-08 | `@next/bundle-analyzer` installed as devDep; `ANALYZE=true pnpm build` documented | §6 — withBundleAnalyzer wrapper composed with Sentry, package.json script |
| FOUND-09 | Web Vitals tracking component wired; logs to console in dev, Sentry in prod | §7 — useReportWebVitals + Sentry capture pattern, route-scoped via pathname check |
| FOUND-10 | `MotionWrapper` pattern documented — thin `"use client"` wrappers around animated leaves | §4 — leaf-wrapper pattern with code, hydration guard for LCP element |
| FOUND-11 | Visual fidelity harness updated; `data-section="<name>"` convention | §5 — Playwright spec extension with new selectors, side-by-side reference comparison |
| FOUND-12 | Craft quality rubric written at `.planning/CRAFT-RUBRIC.md` | §11 — full rubric skeleton with AS-01..AS-15 embedded + 6-dimension scoring + bundle budget |
| FOUND-13 | Phase-gate checklist documented | §16 — Validation Architecture maps each FOUND-XX to a concrete proof |
| FOUND-14 | Section brief template at `.planning/SECTION-BRIEF-TEMPLATE.md` | §12 — 7-subsection template, fillable + machine-parseable |
</phase_requirements>

---

## TL;DR

- **Cascade isolation is the linchpin.** `landing.css` lives in `src/app/(marketing)/` with declaration `@layer theme, base, components, utilities, landing;` then a `@layer landing { :root { --landing-*: ...; } }` block. Imported ONLY from `(marketing)/layout.tsx`. Verified at CI via `scripts/check-landing-scope.ts`. Dashboard physically cannot see the file. **All dark tokens (L<0.15) MUST use hex** — Tailwind v4 oklch compiles incorrectly at low luminance (verified in this project's own design system).
- **Lenis is the table-stakes scroll win + the highest-risk integration.** Extract a `LenisProvider` client component at `src/components/landing/lenis-provider.tsx`. Wrap `(marketing)/layout.tsx` only. Detect `prefers-reduced-motion` and pass `duration: 0, smoothWheel: false` when present. Tag any Radix dialogs with `data-lenis-prevent` (not relevant in landing phase but document the rule for downstream agents).
- **LazyMotion strict + features={domAnimation} + m.* convention.** Saves ~29 KB gzipped from initial bundle. Import path is `import * as m from "motion/react-m"` (NOT `motion/react`). Existing `src/components/motion/` files use `motion.*` directly — these remain unchanged (out of landing scope), but ALL new landing components use `m.*`. Strict mode throws at runtime if `motion.*` slips in.
- **All 14 files in `src/components/landing/` are used by only TWO files** (`(marketing)/page.tsx` + `(marketing)/pricing/page.tsx`). Single-commit deletion is safe. Also delete `src/app/(marketing)/pricing/` (D-23) and add `/pricing → /#pricing` permanent redirect in `next.config.ts`.
- **Phase 1 has NO visible UI sections.** Hero, bento, and content sections are Phases 2-7. The deliverables are scaffolding: token layer, providers, gates, rubric, briefs, scope checks, baseline build measurement. The success criterion is that Phases 2-8 can be assembled on top without any landmine going off.

---

## Stack Confirmation

Verified against `package.json` and npm registry (2026-05-19):

| Package | Installed (package.json) | Current on npm | Action for Phase 1 |
|---------|-------------------------|----------------|--------------------|
| `next` | 16.1.5 | 16.2.6 | No action (works with 16.1.5) [VERIFIED: npm registry] |
| `react` / `react-dom` | 19.2.3 | — | No action |
| `tailwindcss` | ^4 | 4.x | No action |
| `@tailwindcss/postcss` | ^4 | 4.x | No action |
| `motion` | ^12.29.2 | 12.39.0 | No action (LazyMotion API stable since 11.x) [VERIFIED: npm registry] |
| `framer-motion` | ^12.29.3 | — | Alias for motion — no action |
| `@sentry/nextjs` | ^10.39.0 | 10.53.1 | No action (browserTracingIntegration captures web vitals automatically) [VERIFIED: npm registry] |
| `react-intersection-observer` | ^10.0.2 | — | No action |
| `@playwright/test` | ^1.58.0 | — | No action |
| `pixelmatch` | ^6.0.0 | — | No action |
| `pngjs` | ^7.0.0 | — | No action |
| `lenis` | **NOT INSTALLED** | 1.3.23 | **INSTALL** `pnpm add lenis` [VERIFIED: npm registry, package.json] |
| `@next/bundle-analyzer` | **NOT INSTALLED** | 16.2.6 | **INSTALL** `pnpm add -D @next/bundle-analyzer` [VERIFIED: npm registry, package.json] |

**Installation command (Phase 1, all installs in one step):**
```bash
pnpm add lenis@1.3.23
pnpm add -D @next/bundle-analyzer@16.2.6
```

**Engine availability** (verified 2026-05-19 on `/Users/davideloreti/virtuna-landing-linear-clone`):
- pnpm 10.29.3 ✓ — present
- Node v25.2.1 ✓ — present
- npx 11.6.2 ✓ — present
- curl, jq ✓ — present
- Playwright + lenis: not yet in `node_modules/` (worktree has not run `pnpm install` since clone) — Phase 1 wave 0 task must `pnpm install` to materialize the lockfile

---

## 1. Tailwind v4 @layer landing — Cascade Isolation

### Exact landing.css pattern

```css
/* src/app/(marketing)/landing.css */
/*
 * Route-scoped landing token layer.
 * Imported ONLY from src/app/(marketing)/layout.tsx.
 * Enforced by scripts/check-landing-scope.ts in CI.
 *
 * All dark tokens (L < 0.15) MUST use hex, NOT oklch.
 * Reason: Tailwind v4 / Lightning CSS compiles oklch incorrectly at low luminance.
 * Verified in this project's existing @theme block (globals.css).
 */

/* 1. Declare layer order — landing layer sits AFTER utilities so its rules win the cascade */
@layer theme, base, components, utilities, landing;

/* 2. All landing tokens live in @layer landing { :root { ... } } */
@layer landing {
  :root {
    /* ─── Display Type Scale (fluid clamp(), viewport 375 → 1280) ─── */
    --landing-text-display-xl: clamp(2.5rem, 1.4rem + 4.5vw, 5.5rem);   /* 40px → 88px — hero H1 */
    --landing-text-display-lg: clamp(2rem, 1.3rem + 2.9vw, 3.875rem);   /* 32px → 62px — section heads */
    --landing-text-display-md: clamp(1.625rem, 1.2rem + 1.8vw, 2.75rem); /* 26px → 44px — bento heads */
    --landing-text-display-sm: clamp(1.25rem, 0.9rem + 1.5vw, 2rem);    /* 20px → 32px — eyebrows */
    --landing-text-body-lg:    clamp(1.0625rem, 0.95rem + 0.5vw, 1.25rem); /* 17px → 20px */

    --landing-lh-display: 1.05;
    --landing-lh-body: 1.65;
    --landing-tracking-display: -0.03em;

    /* ─── Motion Easings (Linear-quality expo curves) ─── */
    --landing-ease-enter: cubic-bezier(0.16, 1, 0.3, 1);   /* expo out */
    --landing-ease-exit:  cubic-bezier(0.7, 0, 0.84, 0);   /* expo in */
    --landing-ease-inout: cubic-bezier(0.87, 0, 0.13, 1);  /* expo inout */
    --landing-dur-enter:  0.7s;
    --landing-dur-slow:   1.1s;
    --landing-dur-stagger: 0.06s;

    /* ─── Gradient Tokens — coral-anchored, hex for darks ─── */
    --landing-gradient-hero-glow: radial-gradient(
      ellipse 80% 50% at 50% -10%,
      rgba(255, 127, 80, 0.12) 0%,
      transparent 70%
    );
    --landing-gradient-feature-border: linear-gradient(
      135deg,
      rgba(255, 127, 80, 0.20) 0%,
      rgba(255, 255, 255, 0.04) 50%,
      rgba(255, 127, 80, 0.08) 100%
    );
    --landing-gradient-mesh: radial-gradient(circle at 20% 50%, rgba(255,127,80,0.06) 0%, transparent 50%),
                             radial-gradient(circle at 80% 20%, rgba(255,127,80,0.04) 0%, transparent 50%);

    /* ─── Section Rhythm ─── */
    --landing-section-gap: 140px;          /* desktop */
    --landing-section-gap-mobile: 80px;    /* < 768px */

    /* ─── Surface tones (HEX ONLY — see oklch warning above) ─── */
    --landing-surface-base: #07080a;       /* matches existing --color-background */
    --landing-surface-elevated: #0d0d0f;   /* one notch lighter for cards */
    --landing-surface-card:  #111214;      /* matches existing card gradient stop */
    --landing-border-hairline: rgba(255, 255, 255, 0.06);
  }
}
```

### Why this works (Tailwind v4 specifics) [CITED: tailwindcss.com/blog/tailwindcss-v4 + thisdot.co/blog/the-css-utility-hybrid-approach-with-tailwind-v4]

- Tailwind v4 uses **real CSS cascade layers** for its `theme, base, components, utilities` block. The default declaration order in Tailwind's bundled `tailwindcss/index.css` is exactly that.
- A **named layer that's not in Tailwind's reserved set is passed through untouched** to the compiled CSS [CITED: github.com/tailwindlabs/tailwindcss/discussions/18123]. Tailwind only auto-injects rules into `base`, `components`, and `utilities`.
- By declaring `@layer theme, base, components, utilities, landing;` at the top of `landing.css`, we **explicitly position the landing layer LAST**, so its rules win the cascade against any Tailwind utility class (e.g., a stray `text-4xl` cannot override `--landing-text-display-xl` consumed via inline style).
- The custom `@layer landing { :root { ... } }` defines tokens as **plain CSS custom properties** — NOT as `@theme` entries. This means Tailwind does NOT compile them into utility classes (which would leak to global scope). They are consumed by inline styles or via `var(--landing-*)` references in landing components only.

### Import order in `(marketing)/layout.tsx`

```tsx
// src/app/(marketing)/layout.tsx
import "../globals.css";           // 1. Tailwind base + global @theme (existing)
import "./landing.css";              // 2. Landing @layer landing { ... } — LAST = wins cascade
import "lenis/dist/lenis.css";       // 3. Lenis baseline CSS (overflow handling) — UNlayered, runtime-scoped
```

**The import order matters:** `globals.css` declares `@import "tailwindcss"` which loads Tailwind's reserved layers FIRST. Then `landing.css` declares the landing layer's position AFTER utilities. If `landing.css` were imported before `globals.css`, its `@layer theme, base, components, utilities, landing;` declaration would be SHADOWED by Tailwind's own declaration on next parse, and the landing layer would silently end up in unspecified order. **Always import globals.css first, landing.css second.** [VERIFIED: tailwind v4 cascade behavior, multiple sources cross-referenced]

### Hex-only rule for dark tokens — the exact failure mode

**Trap:** `--landing-surface-base: oklch(0.04 0.005 280);` (what L < 0.15 in oklch looks like)

**What goes wrong:**
1. In dev (Vite/Next dev server bypasses Lightning CSS minifier) → renders approximately correctly
2. In `next build` (Lightning CSS minifies + transforms) → rounds oklch coordinates aggressively and produces a noticeably washed-out gray in Chrome
3. In Safari → oklch fallback to sRGB compile produces yet a third different value
4. Result: dev/prod/Safari/Chrome all show slightly different darks

**Workaround (mandatory):** Always use exact hex values for dark surface tokens:
```css
/* GOOD */
--landing-surface-base: #07080a;
/* BAD — will compile inaccurately */
--landing-surface-base: oklch(0.04 0.005 280);
```

oklch is acceptable for mid-luminance accents (L > 0.3) — e.g., coral tints, accent fills. The existing `--color-coral-*` scale in `globals.css` uses oklch successfully at L ≥ 0.28. [CITED: this project's CLAUDE.md "Known Technical Issues" — Tailwind v4 oklch inaccuracy] [VERIFIED: src/app/globals.css gray scale uses hex for L < 0.15]

### Verifying the cascade in DevTools

Open Chrome DevTools → Elements → select a landing element → Computed → scroll to "Style" filter. Cascade layers appear in the specificity panel as small chips next to each declaration. The order should read (bottom-up = highest specificity):
1. `@layer landing` rules (highest — wins)
2. `@layer utilities` rules (Tailwind)
3. `@layer components` rules (Tailwind)
4. `@layer base` rules (Tailwind preflight)
5. `@layer theme` rules (Tailwind @theme block)

If you see `@layer landing` BELOW utilities in this panel, your layer declaration order is wrong — re-check `(marketing)/layout.tsx` import order.

---

## 2. Lenis SSR-safe LenisProvider for Next.js 16 App Router

### File location (Claude's discretion — recommended)

**Extract** to `src/components/landing/lenis-provider.tsx`. Rationale:
- Testable in isolation (unit test for reduced-motion branching)
- Shareable across future `(marketing)/*` routes if needed
- Keeps `(marketing)/layout.tsx` declarative (one import line vs 30 lines of effect logic)

### Complete LenisProvider (SSR-safe, reduced-motion aware)

```tsx
// src/components/landing/lenis-provider.tsx
"use client";

import { ReactLenis } from "lenis/react";
import { useEffect, useState } from "react";

/**
 * Lenis smooth-scroll provider scoped to (marketing)/ routes only.
 *
 * NEVER wrap (app)/ routes — Lenis intercepts wheel/touch events that conflict
 * with Radix Dialog focus traps and Radix scroll-locking on modal open.
 *
 * Respects prefers-reduced-motion: when present, Lenis is initialized with
 * smoothWheel=false and duration=0, effectively acting as a pass-through.
 *
 * For Radix dialogs inside landing (none in Phase 1, but document for
 * downstream phases): tag the dialog content element with `data-lenis-prevent`
 * to disable Lenis on that subtree.
 */
export function LenisProvider({ children }: { children: React.ReactNode }) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <ReactLenis
      root
      options={{
        lerp: 0.08,                        // tighter = snappier; 0.1 default felt rubbery
        duration: prefersReducedMotion ? 0 : 1.2,
        smoothWheel: !prefersReducedMotion,
        syncTouch: false,                  // false = native touch scroll; safer on iOS <16
        autoRaf: true,                     // let Lenis manage its own RAF loop
      }}
    >
      {children}
    </ReactLenis>
  );
}
```

### Integration in `(marketing)/layout.tsx`

```tsx
// src/app/(marketing)/layout.tsx
import "../globals.css";
import "./landing.css";
import "lenis/dist/lenis.css";

import { Header } from "@/components/layout/header";
import { LenisProvider } from "@/components/landing/lenis-provider";
import { LandingMotionProvider } from "@/components/landing/landing-motion-provider"; // §3
import { WebVitalsReporter } from "@/components/landing/web-vitals-reporter";        // §7

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <LenisProvider>
      <LandingMotionProvider>
        {/* Header stays as existing — Phase 2 will replace with LandingNav */}
        <Header />
        {children}
        <WebVitalsReporter />
      </LandingMotionProvider>
    </LenisProvider>
  );
}
```

⚠️ **DO NOT** keep the `<html>` / `<body>` from the current `(marketing)/layout.tsx`. Those belong to the **root** `src/app/layout.tsx` (which already declares them). Next.js App Router renders the root layout's `<html>/<body>` for ALL routes; nested layouts must not duplicate them. The current `(marketing)/layout.tsx` is **buggy** — it declares a second `<html>/<body>` which the root layout already provides. This must be fixed in Phase 1 (currently the layout file at lines 21-28 has duplicate `<html>/<body>`, see "Existing layout" file). [VERIFIED: src/app/layout.tsx + src/app/(marketing)/layout.tsx direct read]

### Why Lenis breaks Radix dialogs (downstream rule for phases 2-7)

Radix Dialog implements a **focus trap** by intercepting Tab/Shift+Tab events on the document. Lenis intercepts **all wheel and touch events at the window level** to drive its smooth-scroll loop. Two interactions break:

1. **Wheel scrolling inside an open dialog body** — Lenis captures the wheel event and applies smooth-scroll to the body BEHIND the dialog backdrop. The dialog's internal scroll feels frozen.
2. **Focus restoration on dialog close** — Radix calls `scrollIntoView()` on the previously-focused trigger. Lenis intercepts this and animates the body scroll, which conflicts with Radix's instant scroll restoration.

**Mitigation:** Add `data-lenis-prevent` to the dialog's scroll content [CITED: github.com/darkroomengineering/lenis README]:

```tsx
<DialogContent data-lenis-prevent>
  {/* dialog scrolls natively now */}
</DialogContent>
```

Phase 1 doesn't build any dialogs, but this rule is documented in CRAFT-RUBRIC.md so Phase 7 (pricing FAQ accordion uses Radix Accordion — different primitive, no conflict) and any future dialog usage in landing routes handles it correctly.

### Reduced-motion early exit alternative

`ReactLenis` does not have a native `disabled` prop. The pattern above (set `smoothWheel: false, duration: 0` when reduced-motion is detected) makes Lenis a no-op without unmounting it. This avoids hydration mismatches that would occur from conditionally rendering `<ReactLenis>` vs raw children. [CITED: bridger.to/lenis-nextjs implementation pattern]

---

## 3. LazyMotion + m.* Convention with motion 12

### Setup in `(marketing)/layout.tsx` via extracted provider

```tsx
// src/components/landing/landing-motion-provider.tsx
"use client";

import { LazyMotion, domAnimation } from "motion/react";

/**
 * Wraps landing routes with LazyMotion + domAnimation features.
 * Reduces initial motion library bundle from ~34 KB gzipped to ~4.6 KB.
 *
 * `strict` enabled: throws at runtime if any landing component imports `motion.*`
 * instead of `m.*` — this is the linting mechanism we use because we can't
 * easily write an ESLint rule that distinguishes landing-route from non-landing
 * imports.
 *
 * `domAnimation` features (+15 KB async): animations, variants, exit animations,
 * tap/hover/focus gestures.
 * If layout animations or drag/pan are needed in a future phase, swap to
 * `domMax` (+25 KB async).
 */
export function LandingMotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}
```

### The m.* import path — exact spelling

```tsx
// CORRECT — in EVERY landing component that uses motion primitives
import * as m from "motion/react-m";
// then use as: <m.div>, <m.section>, etc.

// WRONG — full bundle, defeats LazyMotion (and strict mode throws)
import { motion } from "motion/react";
// <motion.div> — strict mode throws "You're trying to use motion within a LazyMotion component"
```

[CITED: motion.dev/docs/react-lazy-motion — exact import path verified]

### features choice: domAnimation vs domMax

| Feature pack | Bundle cost (async) | Includes | Sufficient for Phase 1 ROADMAP |
|-------------|---------------------|----------|--------------------------------|
| `domAnimation` | +15 KB gzipped | animations, variants, exit, tap/hover/focus gestures | YES — covers HERO entry, BENTO hover, STAGGER reveal, HOW step transitions, MOAT counters, PROOF counters |
| `domMax` | +25 KB gzipped | + pan/drag, + layout animations | Only needed if any phase uses `<m.div layout>` or drag — current spec doesn't |

**Recommendation: `domAnimation`** [CITED: motion.dev/docs/react-reduce-bundle-size — bundle sizes verified]

Initial bundle delta:
- Without LazyMotion: ~34 KB gzipped (full motion library)
- With LazyMotion + domAnimation: ~4.6 KB initial + 15 KB lazy
- **Net saving on first paint: ~29 KB gzipped** (the figure cited in CONTEXT.md)

### Migration path from existing `src/components/motion/` — KEEP, DON'T MIGRATE

The existing `src/components/motion/{fade-in-up,stagger-reveal,hover-scale,fade-in,slide-up}.tsx` import `motion` directly from `motion/react`. They are used by `(app)/` routes — NOT scoped to landing. **Phase 1 must NOT migrate these to `m.*`.** The reasoning:

1. They are not wrapped in `LazyMotion` — if migrated, they'd break with strict mode error.
2. Migrating them changes their public API surface, risking dashboard regression (which D-05a explicitly checks against).
3. The landing route uses its own MotionWrapper pattern (§4) with `m.*` — independent.

**The convention:** any NEW landing component uses `m.*`. Existing `src/components/motion/*` stays untouched. The visual gate's "git diff scope guard" (D-05a) automatically enforces this — if a landing executor accidentally migrates `src/components/motion/fade-in.tsx`, the diff will show that file changed and the gate fails.

### Linting/enforcement: rely on `strict` runtime check (no ESLint rule)

Writing an ESLint custom rule that distinguishes "files imported by `(marketing)/` route" from "files imported by `(app)/` route" requires AST + dependency graph analysis — expensive to maintain. Instead, `LazyMotion strict` throws at runtime if any landing component renders `<motion.*>`. The Playwright snapshot tests at the phase gate WILL catch this — `next dev` errors out, snapshot fails. Cheap, reliable, no custom lint code. [CITED: motion.dev/docs/react-lazy-motion — strict mode behavior]

---

## 4. MotionWrapper "use client" Leaf Pattern

### The rule (from FOUND-10)

A landing **section** is a Server Component (RSC) — pure markup, no `"use client"` directive. Only the **animated leaf** inside the section is a client component using `m.*`.

### Example: hero section structure (Phase 2 will implement, Phase 1 documents)

```tsx
// src/app/(marketing)/_sections/hero.tsx
// NO "use client" — RSC

import { HeroAnimatedHeadline } from "./hero-animated-headline"; // client island
import { HeroCtaGroup } from "./hero-cta-group";                  // client island

export function HeroSection() {
  return (
    <section data-section="hero" className="relative">
      {/* RSC content — static; CSS-driven background, server-rendered SEO-visible markup */}
      <div className="container mx-auto">
        <HeroAnimatedHeadline>          {/* client island wrapping a leaf m.h1 */}
          Predict your next post before you press publish
        </HeroAnimatedHeadline>
        <HeroCtaGroup />                {/* client island for hover animations */}
      </div>
    </section>
  );
}
```

```tsx
// src/app/(marketing)/_sections/hero-animated-headline.tsx
"use client";

import * as m from "motion/react-m";

export function HeroAnimatedHeadline({ children }: { children: React.ReactNode }) {
  return (
    <m.h1
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} // landing-ease-enter
      style={{
        fontSize: "var(--landing-text-display-xl)",
        lineHeight: "var(--landing-lh-display)",
        letterSpacing: "var(--landing-tracking-display)",
      }}
    >
      {children}
    </m.h1>
  );
}
```

### Hero LCP exception — CSS animation, NOT motion library (Phase 2 rule documented now)

The hero H1 is the LCP candidate. JS-driven `initial={{ opacity: 0 }}` keeps it invisible until React hydrates → Lighthouse LCP > 3s on mobile [CITED: cloudfour.com/thinks/stop-lazy-loading-product-and-hero-images + this project's PITFALLS.md Pitfall 4].

**For the LCP element only, use CSS keyframe animation** (Phase 2 will implement, Phase 1 documents the rule in CRAFT-RUBRIC.md):

```css
/* In landing.css @layer landing { ... } */
@keyframes landing-hero-fadein {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}

[data-section="hero"] h1 {
  animation: landing-hero-fadein 0.7s var(--landing-ease-enter) backwards;
}

@media (prefers-reduced-motion: reduce) {
  [data-section="hero"] h1 { animation: none; }
}
```

CSS animations fire on first paint (no hydration dependency) and are isomorphic. No `<m.h1>` wrapper on the hero headline. All other elements (subhead, CTAs, hero illustration) can use `m.*` if they're NOT the LCP candidate. [CITED: PITFALLS.md Pitfall 7 — Framer Motion SSR hydration mismatch]

### `<Suspense>` boundary — not needed in Phase 1

No async client components in Phase 1. Phase 4 (How It Works) sticky panel may need it; Phase 1 doesn't.

---

## 5. Playwright Visual-Comparison Harness Extension

### Current state of `verification/scripts/visual-comparison.spec.ts`

[VERIFIED: file read directly]
- **Viewports:** desktop (1440x900), tablet (768x1024), mobile (375x812) — three projects in `playwright.config.ts`
- **Diff engine:** pixelmatch with threshold 0.3
- **Current PAGES array:** Homepage + showcase routes (lines 66-132)
- **Existing selectors:** `main > *:first-child`, `main > *:nth-child(N)` — positional, fragile to section reorder

### Phase 1 extension — replace positional selectors with `data-section` attribute selectors

```typescript
// verification/scripts/visual-comparison.spec.ts — REPLACE the Homepage entry's sections
{
  name: 'Landing — Full Page',
  url: '/',
  filename: 'landing-full.png',
  sections: [
    { name: 'Nav',              selector: 'nav',                              filename: 'landing-nav.png' },
    { name: 'Hero',             selector: 'section[data-section="hero"]',            filename: 'landing-hero.png' },
    { name: 'Bento',            selector: 'section[data-section="bento"]',           filename: 'landing-bento.png' },
    { name: 'How It Works',     selector: 'section[data-section="how-it-works"]',    filename: 'landing-how-it-works.png' },
    { name: 'Behavioral Moat',  selector: 'section[data-section="behavioral-moat"]', filename: 'landing-behavioral-moat.png' },
    { name: 'Social Proof',     selector: 'section[data-section="social-proof"]',    filename: 'landing-social-proof.png' },
    { name: 'Pricing',          selector: 'section[data-section="pricing"]',         filename: 'landing-pricing.png' },
    { name: 'Footer',           selector: 'section[data-section="footer"]',          filename: 'landing-footer.png' },
  ],
  // Side-by-side reference comparisons
  referenceBaselines: [
    { selector: 'section[data-section="hero"]',    referenceFile: 'verification/reference/linear-desktop-1280.png',    diffName: 'hero-vs-linear.png' },
    { selector: 'section[data-section="bento"]',   referenceFile: 'verification/reference/linear-bento.png',           diffName: 'bento-vs-linear.png' },
    { selector: 'section[data-section="pricing"]', referenceFile: 'verification/reference/linear-pricing.png',         diffName: 'pricing-vs-linear.png' },
  ],
},
// NEW — dashboard regression entry (D-05a, FOUND-13)
{
  name: 'Dashboard regression — token leakage check',
  url: '/app/dashboard',
  filename: 'dashboard-regression.png',
  // Compares against a baseline captured BEFORE Phase 1 lands (commit baseline manually
  // once worktree is set up, then this entry verifies byte-stable against it)
  referenceBaselines: [
    { selector: 'body', referenceFile: 'verification/reference/dashboard-baseline-1280.png', diffName: 'dashboard-vs-baseline.png' },
  ],
},
```

### Playwright config — 3 viewports already present

[VERIFIED: verification/playwright.config.ts]
```typescript
projects: [
  { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  { name: 'tablet',  use: { viewport: { width: 768,  height: 1024 } } },
  { name: 'mobile',  use: { viewport: { width: 375,  height: 812 } } },
],
```

⚠️ **Adjust desktop to 1280x900 to match the reference frozen-snapshot viewport** — Linear/Raycast reference snapshots in D-06 are captured at 1280 width (matching the lower bound where Linear's design grid is fully expressed). Current config uses 1440x900 which doesn't align with the references. Phase 1 must change `desktop.viewport.width` from 1440 → 1280 in `verification/playwright.config.ts`.

### Diff threshold + mask

- Keep `pixelmatch` threshold at 0.3 (existing) — allows anti-aliasing tolerance
- For "side-by-side" reference comparison, the diff is **informational, not pass/fail**. The craft rubric scoring is the gate; pixel diff just provides a visual delta for human review in VISUAL-AUDIT.md.
- Mask `data-flux="dynamic"` attribute (Phase 1 sets the convention) on any dynamic content (count-up numbers, animated graphics) so they don't trigger false-positive diffs.

### Capture-references script — recommendation: checked-in command

**Recommendation: checked-in command, NOT one-time-run script.** Rationale (Claude's discretion area):
- Refresh policy says manual update if Linear/Raycast redesigns (D-07). Manual = run a command. Command must exist.
- A `pnpm run capture:refs` script is auditable in `package.json`, version-controlled, reproducible across machines.
- The script body lives at `verification/scripts/capture-references.spec.ts` (also runnable via Playwright).

```typescript
// verification/scripts/capture-references.spec.ts
// Run via: pnpm run capture:refs
// pnpm script: "capture:refs": "playwright test verification/scripts/capture-references.spec.ts --config=verification/playwright.config.ts"

import { test } from '@playwright/test';
import path from 'path';

const REFERENCE_DIR = path.resolve(__dirname, '../reference');

const TARGETS = [
  { url: 'https://linear.app',         viewport: { width: 1280, height: 900 }, out: 'linear-desktop-1280.png' },
  { url: 'https://linear.app',         viewport: { width: 768,  height: 1024 }, out: 'linear-tablet-768.png' },
  { url: 'https://linear.app',         viewport: { width: 375,  height: 812 }, out: 'linear-mobile-375.png' },
  { url: 'https://linear.app/features',viewport: { width: 1280, height: 900 }, out: 'linear-bento.png' },
  { url: 'https://linear.app/pricing', viewport: { width: 1280, height: 900 }, out: 'linear-pricing.png' },
  { url: 'https://raycast.com',        viewport: { width: 1280, height: 900 }, out: 'raycast-desktop-1280.png' },
  { url: 'https://raycast.com',        viewport: { width: 768,  height: 1024 }, out: 'raycast-tablet-768.png' },
  { url: 'https://raycast.com',        viewport: { width: 375,  height: 812 }, out: 'raycast-mobile-375.png' },
  { url: 'https://raycast.com',        viewport: { width: 1280, height: 900 }, out: 'raycast-feature-section.png', selector: '[data-section="features"]' },
];

for (const target of TARGETS) {
  test(`Capture ${target.out}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: target.viewport, colorScheme: 'dark' });
    const page = await context.newPage();
    await page.goto(target.url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000); // settle
    const outPath = path.join(REFERENCE_DIR, target.out);
    if (target.selector) {
      await page.locator(target.selector).first().screenshot({ path: outPath });
    } else {
      await page.screenshot({ path: outPath, fullPage: false }); // above-fold only
    }
    await context.close();
  });
}
```

```json
// package.json scripts
"capture:refs": "playwright test verification/scripts/capture-references.spec.ts --config=verification/playwright.config.ts --project=desktop"
```

⚠️ Selectors on linear.app / raycast.com are not stable (they may use class names that change). For the per-section snapshots, capture above-fold only and let the visual audit be human-curated. If a specific section selector is broken at capture time, fall back to a full-page screenshot.

---

## 6. next.config.ts Extensions

### Current state [VERIFIED: next.config.ts direct read]

```typescript
// next.config.ts (current)
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  transpilePackages: ['three'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
});
```

### Phase 1 target — all three additions composed correctly

```typescript
// next.config.ts (after Phase 1)
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import withBundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  transpilePackages: ['three'],
  images: {
    formats: ['image/avif', 'image/webp'],          // FOUND-07 — AVIF first, WebP fallback
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
    ],
  },
  async redirects() {                                // D-23 — /pricing → /#pricing permanent
    return [
      {
        source: '/pricing',
        destination: '/#pricing',
        permanent: true,
      },
    ];
  },
};

// Compose order: BundleAnalyzer (outermost — observes Sentry-instrumented output)
//                  → Sentry (middle — wraps nextConfig)
//                    → nextConfig (innermost)
const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

export default withAnalyzer(
  withSentryConfig(nextConfig, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    silent: !process.env.CI,
  })
);
```

### Anchor preservation in redirects — known Next.js gotcha

Next.js' `redirects()` does NOT automatically preserve URL fragments (`#anchor`) on the destination side. The fragment is BROWSER-SIDE and the redirect response is server-side. To get `/pricing` → `/#pricing` working:

- **Destination as written above (`/#pricing`)** — Next.js emits HTTP 308 with `Location: /#pricing`. Browsers DO honor fragments in Location headers per RFC 7231 §7.1.2 — verified working in current Chrome/Safari/Firefox.
- **NOT** `destination: '/?#pricing'` (Next.js may strip the query/fragment).
- **NOT** `destination: '/', then JS scroll-to-anchor on landing` — defeats SEO + breaks browser back-button.

[VERIFIED: Next.js redirects API reference — `permanent: true` emits HTTP 308 Permanent Redirect]

### `@next/bundle-analyzer` script in package.json

```json
"scripts": {
  // ... existing
  "analyze": "ANALYZE=true pnpm build",
  "analyze:server": "BUNDLE_ANALYZE=server ANALYZE=true pnpm build",
  "analyze:browser": "BUNDLE_ANALYZE=browser ANALYZE=true pnpm build"
}
```

⚠️ Existing `package.json` already has an `analyze` script (`"npx tsx scripts/analyze-dataset.ts"`) — rename the existing one to `analyze:dataset` to free the `analyze` namespace for bundle analyzer. [VERIFIED: package.json line 22]

### Composition order matters (withSentryConfig + withBundleAnalyzer)

The outermost wrapper sees the final config. `withBundleAnalyzer` needs to see the Sentry-injected webpack plugins to measure them accurately. Therefore: `withAnalyzer(withSentryConfig(nextConfig, ...))`. Reversing the order causes Sentry's webpack plugin to wrap the bundle-analyzer's plugin, which doesn't break anything but produces a less useful analyze output (Sentry's source map upload is then double-counted). [VERIFIED: @next/bundle-analyzer + @sentry/nextjs composition guidance, multiple sources]

---

## 7. Sentry Web Vitals Reporter Scoped to Landing Route

### Key finding: web vitals are captured AUTOMATICALLY by @sentry/nextjs 10.x

[CITED: docs.sentry.io/platforms/javascript/guides/nextjs/tracing/instrumentation/automatic-instrumentation/] `browserTracingIntegration` is enabled by default in `@sentry/nextjs` 10.x and **automatically captures LCP, CLS, TTFB, INP** on every pageload transaction. **No manual `Sentry.metrics.distribution` call needed.**

This changes the FOUND-09 / D-25 implementation: we don't need a custom Sentry reporter for web vitals — Sentry already has them. What we DO need is:

1. **Console.log in dev** (FOUND-09 floor) — via `useReportWebVitals`
2. **Tag the landing route on Sentry transactions** so we can filter dashboards by route — done via `Sentry.setTag('route', 'landing')` when pathname matches `/`
3. **Verify INP is enabled** — `enableInp: true` is the default in 8.x+, no action needed unless current Sentry config explicitly disables it [VERIFIED: current sentry.client.config.ts via `src/instrumentation-client.ts` — does NOT disable INP]

### WebVitalsReporter component

```tsx
// src/components/landing/web-vitals-reporter.tsx
"use client";

import { useReportWebVitals } from "next/web-vitals";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Web Vitals reporter scoped to the landing route only.
 *
 * Dev: console.log every metric with rating
 * Prod: tag Sentry transaction so /landing-route web vitals can be filtered
 *       (Sentry's browserTracingIntegration already captures LCP/CLS/INP/TTFB
 *       automatically — this reporter just tags + dev-logs.)
 */
export function WebVitalsReporter() {
  const pathname = usePathname();
  const isLandingRoute = pathname === "/" || pathname?.startsWith("/(marketing)");

  // Tag Sentry transaction when on landing route
  useEffect(() => {
    if (isLandingRoute) {
      Sentry.setTag("route", "landing");
    }
  }, [isLandingRoute]);

  useReportWebVitals((metric) => {
    // Only report for landing route
    if (!isLandingRoute) return;

    if (process.env.NODE_ENV === "development") {
      // Floor — FOUND-09
      // eslint-disable-next-line no-console
      console.log(
        `[web-vital:${metric.name}]`,
        Math.round(metric.value),
        metric.rating ?? "—",
        `(id: ${metric.id})`
      );
    }
    // Prod: Sentry automatically captures via browserTracingIntegration —
    // no manual capture needed. The setTag above attaches route context.
  });

  return null;
}
```

### Where to wire it: `(marketing)/layout.tsx` (NOT root layout)

Rendering `<WebVitalsReporter />` inside `(marketing)/layout.tsx` automatically scopes it — Next.js only mounts it on `(marketing)/*` routes. No pathname check would be strictly necessary inside the component, BUT keeping the pathname check is defensive in case a future refactor moves the component to root layout (and prevents false-positives during navigation transitions).

### Metric thresholds (for the dev console output rating)

[CITED: nextjs.org/docs/app/api-reference/functions/use-report-web-vitals — metric.rating values]
- `good` / `needs-improvement` / `poor` are computed by next/web-vitals automatically against Google's published thresholds
- FOUND-13 phase gate: LCP < 2.5s + CLS < 0.1 → equivalent to `rating === "good"` for LCP and CLS

---

## 8. scripts/check-landing-scope.ts CI Guard (D-19)

### Lightweight Node script — no AST parser

```typescript
#!/usr/bin/env node
// scripts/check-landing-scope.ts
// Fails CI if landing.css is imported anywhere outside src/app/(marketing)/.
// Run via: pnpm run check:landing-scope
// CI hook: package.json script + invoked from pre-commit hook or vercel build step

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const PROJECT_ROOT = resolve(__dirname, "..");
const SRC_DIR = join(PROJECT_ROOT, "src");
const ALLOWED_PREFIX = "src/app/(marketing)/";
const PATTERN = /import\s+["'][^"']*landing\.css["']/;

const ext = [".tsx", ".ts", ".jsx", ".js", ".mjs", ".css"];
const violations: string[] = [];

function walk(dir: string) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
      continue;
    }
    if (!ext.some((e) => entry.endsWith(e))) continue;

    const content = readFileSync(full, "utf8");
    if (!PATTERN.test(content)) continue;

    const rel = relative(PROJECT_ROOT, full).replace(/\\/g, "/");
    if (!rel.startsWith(ALLOWED_PREFIX)) {
      violations.push(rel);
    }
  }
}

walk(SRC_DIR);

if (violations.length > 0) {
  // eslint-disable-next-line no-console
  console.error("ERROR: landing.css imported outside src/app/(marketing)/:");
  for (const v of violations) console.error(`  ${v}`);
  console.error("\nlanding.css MUST only be imported from src/app/(marketing)/layout.tsx.");
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log("OK: landing.css scope check passed.");
process.exit(0);
```

### package.json wiring

```json
"scripts": {
  "check:landing-scope": "tsx scripts/check-landing-scope.ts",
  "prebuild": "pnpm run check:landing-scope"
}
```

`prebuild` runs automatically before `pnpm build` (Next.js convention). Vercel runs `pnpm build` → triggers `prebuild` → triggers `check:landing-scope` → fails build if any violation. Zero CI config needed.

### Pre-commit hook (optional, recommended)

```bash
# .githooks/pre-commit (append to existing)
pnpm run check:landing-scope || exit 1
```

### Exit code semantics

- `0` — no violations, build proceeds
- `1` — at least one violation, prebuild fails, deploy stops

### Why no AST parser

A regex matching `import\s+["'][^"']*landing\.css["']` catches:
- `import "./landing.css";`
- `import "../landing.css";`
- `import "@/app/(marketing)/landing.css";`
- `import css from "./landing.css";` (with attribute import)

It does NOT catch:
- Dynamic imports (`await import("./landing.css")`) — but we don't use dynamic CSS imports in this stack, and Next.js doesn't really support them anyway
- Indirect re-exports through barrel files — not a realistic landing.css usage pattern

Regex is sufficient. An AST parser (e.g., `@swc/core`, `ts-morph`) would be ~30x heavier on cold-start and isn't needed.

---

## 9. Inter Font `axes: ['opsz']` (FOUND-06)

### Exact next/font/google signature

```ts
// src/app/layout.tsx (root layout — applies to ALL routes)
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  axes: ["opsz"],   // ← ADD THIS — unlocks optical sizing axis
});
```

[CITED: nextjs.org/docs/app/api-reference/components/font — Inter supports `axes: ['opsz']` since next/font 13.4]

### CSS application

The browser uses the opsz axis automatically when `font-optical-sizing: auto` is set. This belongs in **globals.css** (NOT landing.css), because the dashboard also benefits from optical sizing for its Inter usage.

```css
/* src/app/globals.css — BASE STYLES section (already present at lines 286-296) */
html,
body {
  @apply bg-background text-foreground font-sans;
  overflow-x: hidden;
  line-height: 1.5;
  letter-spacing: 0.2px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-optical-sizing: auto;   /* ← ADD — Inter opsz axis activates per font-size */
}
```

### Survives Tailwind v4 base reset? — YES

Tailwind v4's preflight (the base reset) does NOT touch `font-optical-sizing`. The property is inherited and applies through all descendants of `<body>`. Verified by inspecting the Tailwind v4 preflight CSS (no `font-optical-sizing` declaration anywhere in the reset). [CITED: tailwindcss.com/docs/preflight + tailwindcss/v4 source]

### Why apply in globals.css, NOT landing.css

The Inter font is loaded in the ROOT layout (`src/app/layout.tsx`) — both `(app)/` and `(marketing)/` routes inherit it. The optical sizing setting only kicks in if the font is loaded WITH the `opsz` axis. Once added, it's safe to enable site-wide because:
- Dashboard typography benefits from opsz at large headlines (no visual regression — opsz transitions are subtle stroke contrast changes, not weight changes)
- Avoids divergence between dashboard's Inter rendering and landing's Inter rendering
- D-05a dashboard-regression snapshot will verify zero visible change (the change is sub-pixel)

### Font file size increase

Variable axis font with opsz: ~5-10 KB heavier than without [CITED: STACK.md research]. Self-hosted via next/font from Vercel CDN — no network round-trip cost. One-time payload increase, served on first visit and cached.

---

## 10. Backdrop-Filter Inline-Style Pattern (CLAUDE.md Locked Landmine)

### The rule (locked in repo CLAUDE.md "Known Technical Issues")

> **Lightning CSS strips backdrop-filter:** Apply via React inline styles (`style={{ backdropFilter: 'blur(Xpx)' }}`), not CSS classes.

### Why Lightning CSS strips backdrop-filter from classes

Lightning CSS (Tailwind v4's underlying transformer) is conservative about properties it considers experimental or browser-divergent. `backdrop-filter` is in this category despite being baseline-supported now [CITED: github.com/parcel-bundler/lightningcss issues archive]. When Lightning CSS encounters `backdrop-filter` in a CSS class, it sometimes strips it as part of "browser compatibility transforms" — but **inline styles bypass Lightning CSS entirely** (they're React-emitted at render time, not part of the CSS build).

### The pattern — already established in this codebase

[VERIFIED: src/components/primitives/GlassPanel.tsx + grep across src/]

```tsx
<div
  style={{
    backdropFilter: "blur(5px)",
    WebkitBackdropFilter: "blur(5px)",   // ← Safari prefix REQUIRED (Safari 15+ supports unprefixed, 14- needs -webkit-)
    background: "linear-gradient(137deg, rgba(17,18,20,0.75) 4.87%, rgba(12,13,15,0.9) 75.88%)",
  }}
>
  {children}
</div>
```

### Safari prefix decision: ALWAYS include `WebkitBackdropFilter`

- Safari 15+ supports unprefixed `backdrop-filter`
- Safari 14 and older still need `-webkit-backdrop-filter`
- mobile Safari on iOS 14 (still ~3% of iOS users globally per StatCounter 2026) needs the prefix
- Cost of including the prefix: zero (browser ignores the one it doesn't recognize)
- Cost of NOT including it: silent rendering failure on iOS 14 Safari → glass effect missing → user sees flat dark surface

**Rule: ALWAYS include both `backdropFilter` and `WebkitBackdropFilter` in inline styles.** Already the established pattern in `GlassPanel.tsx`.

### Phase 1 documentation requirement

Phase 1 doesn't build any glass UI (no hero nav, no glass cards — those are Phases 2-7). But CRAFT-RUBRIC.md (§11 below) MUST document the rule:

```markdown
## Locked Repo Landmines

These are NON-NEGOTIABLE rules from the repo's CLAUDE.md. Any phase that violates one fails its gate.

### Backdrop-filter ALWAYS via inline style with Safari prefix
- USE: `style={{ backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }}`
- NEVER: `className="backdrop-blur-sm"` (Tailwind class — stripped by Lightning CSS in prod)
- NEVER: `style={{ backdropFilter: 'blur(5px)' }}` (no Safari prefix — breaks iOS 14)

### Verify in production build
Every phase that uses backdrop-filter MUST verify rendering in `pnpm build && pnpm start`, not just `pnpm dev`. Lightning CSS only runs in prod.
```

---

## 11. CRAFT-RUBRIC.md Structure (FOUND-12, D-08)

### Full skeleton

```markdown
# Virtuna Landing — Craft Rubric

**Purpose:** Per-phase gate. A phase fails its visual gate if 2 or more dimensions score FAIL (5/6 must PASS to ship).
**Consumed by:** gsd-ui-checker agent (machine-parseable scoring), Davide (human visual review).
**Locked:** 2026-05-19. Update only via CONTEXT.md amendment per phase if a new dimension emerges.

---

## 6 Dimensions — each scored PASS / FAIL with one-sentence justification

### 1. Typography Precision
**Pass criteria:**
- Headings use `var(--landing-text-display-*)` tokens, NOT inline Tailwind classes (text-5xl, text-7xl)
- `letter-spacing` is explicit: `-0.03em` for display, `-0.02em` for headlines, `0` for body
- `line-height` is explicit per scale tier (display = 1.05, body = 1.65)
- No headline forces an awkward 2nd-line break at 375 px (verified via Playwright mobile snapshot)
- Optical sizing active (`font-optical-sizing: auto` in globals.css — D-06)

**Fail signals:**
- `text-7xl` directly in markup without landing token
- Heading line-height is browser default (`1.2` for h1)
- 2-word H1 wraps mid-phrase on mobile

### 2. Spacing Rhythm
**Pass criteria:**
- Section padding follows `var(--landing-section-gap)` (140px desktop / 80px mobile)
- Vertical rhythm between elements uses 8px base scale (matches existing DS — `--spacing-*` tokens in globals.css)
- Card padding is consistent within a section (e.g., bento cards all 32px padding, not mixed)
- No "default" Tailwind spacing (`gap-4`, `py-12`) where landing rhythm should apply

**Fail signals:**
- Two adjacent sections use different gap tokens without justification
- Card grid items have visually unequal vertical spacing
- Mobile section gap > 100px (looks padded-out, breaks rhythm)

### 3. Motion Choreography
**Pass criteria:**
- Easing curves from `var(--landing-ease-*)` set (4 tokens documented in §1 of RESEARCH)
- Duration values from `var(--landing-dur-*)` (no inline `0.4s` magic numbers)
- Entry animations fire-once via `viewport={{ once: true }}` (no continuous re-trigger on scroll-up)
- Stagger delays match `--landing-dur-stagger` (60ms default)
- LCP element NOT inside opacity-animating wrapper (CSS animation only — §4)
- All animations respect `prefers-reduced-motion` (verified via Playwright `reducedMotion: 'reduce'` snapshot)

**Fail signals:**
- `transition={{ duration: 0.3 }}` inline values
- Same element animates multiple times during a single scroll-down
- Hero H1 inside `<m.h1 initial={{ opacity: 0 }}>` (LCP-killer)

### 4. Contrast (WCAG AA + brand)
**Pass criteria:**
- All text vs background ≥ 4.5:1 (WCAG AA normal text)
- Headlines vs background ≥ 3.0:1 (WCAG AA large text)
- Coral CTAs use `--color-accent-foreground: #1a0f0a` for 7.2:1 AAA contrast (existing token)
- Muted text uses `--color-foreground-muted: #848586` (5.4:1 on #07080a — existing token)
- No coral-on-coral text (e.g., coral CTA with coral border + coral background → low contrast)

**Fail signals:**
- `text-gray-400` on `bg-background` < 4.5:1 (would fail; current `--color-foreground-muted` is the safe choice)
- Decorative coral gradients with text overlay where overlay sits in the bright spot

### 5. Mobile Bar (375 px)
**Pass criteria:**
- No horizontal overflow at 375 px (Playwright mobile snapshot)
- H1 hierarchy preserved (clamp() floor produces readable mobile size — 40px H1)
- Tap targets ≥ 44×44 px (Apple HIG)
- CTAs stack vertically on mobile (not 2 buttons side-by-side getting cramped)
- No hover-only interactions (everything has touch fallback)

**Fail signals:**
- Page > 100vw at 375 — body has scrollbar horizontal
- 2-line label hidden under a CTA at 375
- Modal/dropdown extends off-screen

### 6. Anti-Slop Discipline (AS-01..AS-15 blacklist)

A phase fails this dimension if ANY of the 15 forbidden patterns appears:

| ID | Forbidden | Refined alternative |
|----|-----------|---------------------|
| AS-01 | Purple / rainbow / "AI-orb" radial gradients as decoration | Coral `#FF7F50` accents only; atmospheric depth via subtle noise + dark layered backgrounds |
| AS-02 | 3-column equal-card feature grids | Mixed-size bento (2×2 + two 1×1) or asymmetric arrangement |
| AS-03 | Centered hero with stack: H1 + sub + single CTA only | Eyebrow + H1 + sub + dual CTA + product UI screenshot |
| AS-04 | Flat white OR flat dark backgrounds | Dark base + atmospheric depth (radial gradient + low-amplitude noise + subtle inset shadows) |
| AS-05 | Default `rounded-2xl` on every card | Explicit per-component radius (cards 12px, buttons 8px, modals 12px) |
| AS-06 | Emoji bullets in feature lists | Lucide / Phosphor icons with coral accent treatment |
| AS-07 | "Rounded card with left coral border" — AI-cliché | Card variants vary by content type, not by gimmick |
| AS-08 | "Gradient orb representing AI" or "abstract neural blob" | Real Virtuna product UI screenshots |
| AS-09 | CSS silhouettes / placeholder shapes as product visuals | AVIF/WebP screenshots from real Virtuna app |
| AS-10 | Scattered, unrelated micro-interactions | Orchestrated entrance sequence per section; once-only on viewport entry |
| AS-11 | Framework-default Tailwind spacing scale verbatim | Display-type fluid `clamp()` scale + spacing rhythm tokens specific to landing |
| AS-12 | "Modern / clean / professional" as design goal | Specific tone-anchored choices grounded in Linear + Raycast references |
| AS-13 | Generic CTA copy ("Get Started", "Learn More") | Verb-led, Virtuna-specific ("Predict your next post") |
| AS-14 | Stock illustration packs / Unsplash heroes | Original Virtuna illustrations OR real product UI |
| AS-15 | Section-level Framer Motion wrappers | Leaf-level `m.*` wrappers; section structure stays static |

---

## Bundle Budget (D-26 — extends FOUND-08)

| Surface | Budget (gzipped) | Measured baseline (Phase 1 empty scaffold) | Measured current | Status |
|---------|-----------------|---------------------------------------------|------------------|--------|
| Hero critical path (initial JS for `/`) | < 200 KB | TBD — Phase 1 measures via `pnpm run analyze` | TBD | TBD |
| Lenis (alone, gzipped) | ~40 KB | — | — | Reference figure (STACK.md) |
| LazyMotion initial | ~4.6 KB | — | — | Reference figure (motion.dev) |
| LazyMotion features (domAnimation, async) | +15 KB | — | — | Reference figure |

**Baseline rule:** Phase 1 captures the baseline value once the empty scaffold ships (`pnpm run analyze` output). Every subsequent phase must MEASURE against this baseline, not against an aspirational target. If Phase 2 adds 80 KB to the hero critical path, that's noted in the phase's VISUAL-AUDIT.md and approved/rejected by Davide.

---

## Locked Repo Landmines (NON-NEGOTIABLE)

These are repo-level locked rules from CLAUDE.md. Any violation = automatic phase fail.

### 1. Backdrop-filter via inline style + Safari prefix
```tsx
style={{ backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)" }}
```
NEVER `className="backdrop-blur-*"`. Verify in `pnpm build && pnpm start`, not just dev.

### 2. Dark tokens (L < 0.15) in hex, never oklch
```css
--landing-surface-base: #07080a;   /* CORRECT */
--landing-surface-base: oklch(0.04 0.005 280);  /* WRONG — Lightning CSS compiles incorrectly */
```

### 3. Dev server cache reset protocol
When CSS changes don't appear in `pnpm dev`:
1. Kill dev server
2. Remove `.next/`
3. Remove `node_modules/.cache/`
4. Browser hard refresh (Cmd+Shift+R)
```

### Format that gsd-ui-checker can parse

Each dimension uses `**Pass criteria:**` and `**Fail signals:**` as machine-readable section headers. The agent reads the markdown structurally and reports per-dimension PASS/FAIL with the failing line of evidence. The 5/6 threshold is computed.

---

## 12. SECTION-BRIEF-TEMPLATE.md Structure (FOUND-14, D-04)

### Full skeleton

```markdown
# Section Brief — [Section Name]

**Phase:** [N — phase name]
**Owner:** Davide (narrative) + Claude (execution)
**Created:** [YYYY-MM-DD]
**Status:** Draft / Approved / Locked

---

## 1. Purpose in Virtuna's narrative
[ONE paragraph — Why does this section exist in Virtuna's product story? Must be derivable from Virtuna's narrative alone (prediction / competitor intel / brand deals / behavioral science / pricing) without reference to linear.app. If the answer is "because Linear has a section here", REWRITE.]

## 2. Audience served
[Pick one or more — Creator (primary conversion), Investor (brand impression), Partner (brand-deal eligibility signal)]

[Then 1-2 sentences on what THIS audience needs to see/feel/understand to take the next step.]

## 3. Content — original Virtuna copy
- **Eyebrow / pre-headline:** [exact text]
- **H1 / section headline:** [exact text]
- **Sub-headline / supporting copy:** [exact text]
- **CTAs:** [exact button text + destination]
- **Body content:** [bullet list, table rows, card content — written fresh]

Copy rule: every word original to Virtuna. No language lifted from linear.app, raycast.com, or prior abandoned milestones.

## 4. Interaction goals
- **Default state:** [what the user sees]
- **Hover / focus state:** [what changes]
- **Active / click state:** [what triggers]
- **Scroll behavior:** [reveal animation? sticky? once-only?]
- **Reduced-motion fallback:** [what the user sees with `prefers-reduced-motion: reduce`]

## 5. Success criteria
- [ ] Visible at 375 / 768 / 1280 (no horizontal overflow)
- [ ] Lighthouse mobile section LCP / CLS within phase budget
- [ ] Section copy delivered from this brief — no agent ad-libbing
- [ ] [section-specific gate]
- [ ] [section-specific gate]

## 6. Anti-slop list for THIS section
Which of AS-01..AS-15 are highest risk here? List them by ID and document the specific guard.

Example:
- **AS-02** (3-column equal grid) — this is a bento section, must be mixed-size 2×2+1×1+1×1. NOT 3 equal cards.
- **AS-08** (gradient orb) — card visuals are real Virtuna product UI fragments, NEVER abstract shapes.
- **AS-15** (section-level motion wrapper) — staggers are leaf-level on cards, NOT a `<m.section>` wrapping everything.

## 7. Reference anchors
- **linear.app:** [URL path + specific section] — anchored craft observation (NOT layout to copy)
  e.g. "linear.app/features feature-section — observe: 32px gap between card and image, 12px card radius, no decorative borders"
- **raycast.com:** [URL path + specific section] — anchored craft observation
  e.g. "raycast.com hero — observe: monochrome chrome, single accent CTA, generous 96px+ vertical rhythm"
- **DESIGN.md citation:** [path + line range from .planning/reference/design-md/{linear|raycast}.md]
  e.g. ".planning/reference/design-md/linear.md lines 45-67 (colors block)"

Reference anchors are for CRAFT calibration only — never for structural reproduction.

---

*Brief written before any markup. Approved by Davide before Phase N execution begins.*
```

### Machine-readable + human-fillable

Each section header (`## 1. ... ## 7. ...`) is a parseable token. The gsd-ui-checker agent verifies:
- All 7 sections present (regex: `^## \d\. `)
- Section 3 has ≥ 1 line of copy (NOT empty)
- Section 6 cites ≥ 1 AS-XX ID
- Section 7 cites both linear.app AND raycast.com

If any of these fail, the brief is "incomplete" and the phase cannot start execution (gsd-ui-researcher rejects).

### Where briefs live per phase

Per D-03: lazy authoring per-phase. Phase 1 writes TEMPLATE at `.planning/SECTION-BRIEF-TEMPLATE.md`. Phases 2-7 each write a filled brief at:
```
.planning/phases/02-nav-hero/02-SECTION-BRIEF.md
.planning/phases/03-feature-bento/03-SECTION-BRIEF.md
... etc
```

---

## 13. Reference Snapshot Capture (D-06 + D-12)

### Two artifacts to capture in Phase 1

1. **PNG screenshots** of linear.app + raycast.com at 3 viewports — into `verification/reference/`
2. **DESIGN.md files** from `github.com/VoltAgent/awesome-design-md` — into `.planning/reference/design-md/`

### A. Screenshot capture — Playwright script (§5 above already defined `verification/scripts/capture-references.spec.ts`)

`pnpm run capture:refs` runs the spec, captures the 9 PNG files D-06 requires into `verification/reference/`:
- linear-desktop-1280.png, linear-tablet-768.png, linear-mobile-375.png (above-fold)
- linear-bento.png, linear-pricing.png (specific sections — uses linear.app/features and linear.app/pricing)
- raycast-desktop-1280.png, raycast-tablet-768.png, raycast-mobile-375.png
- raycast-feature-section.png (a feature section on raycast.com homepage)

⚠️ Linear and Raycast both block headless browsers occasionally. The capture script must use `--headed=false` is fine, but watch for Cloudflare challenge pages. If blocked, the fallback is manual: open the URL in Chrome at the target viewport, screenshot the area, save into `verification/reference/`. Document the fallback in the script comments.

### B. DESIGN.md fetch — direct curl

[VERIFIED: HTTP 200 on both URLs as of 2026-05-19]

```bash
# Run as a Phase 1 task
mkdir -p .planning/reference/design-md
curl -s -o .planning/reference/design-md/linear.md  \
  https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/design-md/linear.app/DESIGN.md
curl -s -o .planning/reference/design-md/raycast.md \
  https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/design-md/raycast/DESIGN.md
```

⚠️ Note paths: VoltAgent uses `design-md/linear.app/` (with the `.app` suffix) for Linear, but `design-md/raycast/` (no `.com` suffix) for Raycast. The HEAD requests verified both URLs return HTTP 200 with `content-type: text/plain; charset=utf-8`. [VERIFIED: curl -sI on both URLs, 2026-05-19]

### Refresh policy (D-07)

Manual only. When Linear or Raycast meaningfully redesigns (visible difference on first glance), re-run `pnpm run capture:refs` + the curl commands. No automated CI re-fetch.

---

## 14. Taste Skill Install (D-11)

### Install scope: project-scoped (Claude's discretion — recommended)

Project-scoped (`.claude/skills/taste-virtuna/`) is correct because:
- Ships with the worktree on `git clone`
- Per-milestone customization possible (we may tune the 3-param equalizer differently for landing vs future milestones)
- Team-shareable when this becomes a multi-contributor project

Global (`~/.claude/skills/`) would only be right if Davide wanted the same Taste Skill on every project — premature.

### Install commands

```bash
# Phase 1 task — at worktree root
mkdir -p .claude/skills
npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"
# This writes to .claude/skills/design-taste-frontend/ — rename to taste-virtuna:
mv .claude/skills/design-taste-frontend .claude/skills/taste-virtuna
```

⚠️ If `npx skills add` is not available in the environment, fall back to manual:
```bash
mkdir -p .claude/skills/taste-virtuna
curl -L https://raw.githubusercontent.com/Leonxlnx/taste-skill/main/skills/taste-skill/SKILL.md \
  -o .claude/skills/taste-virtuna/SKILL.md
```

[CITED: github.com/Leonxlnx/taste-skill README — install via npx skills or manual SKILL.md copy]

### SKILL.md structure (from upstream, with Virtuna tuning)

```markdown
---
name: taste-virtuna
description: Anti-slop frontend design guard for Virtuna's Linear Landing Clone milestone. 3-parameter equalizer + AS-01..AS-15 anti-slop blacklist + coral-only palette enforcement.
allowed-tools: Read, Grep, Glob
---

# Taste Skill — Virtuna Variant

## Equalizer parameters (locked for landing milestone)

- **DESIGN_VARIANCE: 8/10** — favor creative asymmetry (mixed-size bento beats 3-col equal grid)
- **MOTION_INTENSITY: 6/10** — moderate motion (Linear/Raycast bar — restrained, not zero)
- **VISUAL_DENSITY: 4/10** — airy, breathing space (Raycast's generous 96px+ rhythm)

## Hard rules

Inherits all AS-01..AS-15 anti-slop blacklist from .planning/CRAFT-RUBRIC.md.

Adds:
- BANNED: any color outside the coral scale + grayscale + accent foreground
- BANNED: Inter alternative typography ("premium" / "creative" overrides) — Virtuna uses Inter site-wide
- REQUIRED: optical sizing active (font-optical-sizing: auto)
- REQUIRED: backdrop-filter via inline style only (Safari prefix included)

## Used by

- gsd-ui-checker (per-phase gate) — reads this skill + CRAFT-RUBRIC.md, scores each section
- gsd-ui-researcher (Phase 2-7 starts) — reads for craft baseline before section work

## Not used by

- gsd-executor / gsd-team-worker — execution agents follow PLAN.md, not SKILL.md
```

### Reading by gsd-ui-checker

The gsd-ui-checker agent (per Phase 1's CRAFT-RUBRIC.md gate) automatically loads SKILL.md at session start (Claude Code convention: `.claude/skills/*/SKILL.md` files are auto-loaded for the relevant context). It uses the equalizer + AS-01..AS-15 to score each phase's snapshots. [CITED: code.claude.com/docs/en/skills — skill auto-loading]

---

## 15. Legacy Deletion Safety (D-22 + D-23)

### 14 files in `src/components/landing/` — enumerated [VERIFIED: directory listing 2026-05-19]

1. `backers-section.tsx`
2. `case-study-section.tsx`
3. `comparison-chart.tsx`
4. `cta-section.tsx`
5. `faq-section.tsx`
6. `feature-card.tsx`
7. `features-section.tsx`
8. `hero-section.tsx`
9. `index.ts` ← barrel export
10. `partnership-section.tsx`
11. `persona-card.tsx`
12. `social-proof-section.tsx`
13. `stats-section.tsx`
14. `testimonial-quote.tsx`

### Consumer verification — only 2 importers [VERIFIED via grep across src/]

```
$ grep -rE "from ['\"]@/components/landing" src/ --include="*.tsx" --include="*.ts"

src/app/(marketing)/page.tsx:        } from "@/components/landing";
src/app/(marketing)/pricing/page.tsx: import { FAQSection } from "@/components/landing";
```

**Both consumers are also being deleted/replaced in this phase:**
- `(marketing)/page.tsx` → replaced with empty 7-section scaffold (D-20)
- `(marketing)/pricing/page.tsx` → directory deleted entirely (D-23)

→ **No cross-route consumer exists.** Deletion is safe.

### Single-commit strategy (atomic)

```bash
# Single commit — all deletions + replacements in one atomic operation
git rm -r src/components/landing/
git rm -r src/app/\(marketing\)/pricing/

# Replace page.tsx in same staged set
# (Write the empty scaffold via Write tool first, then add to staging)
git add src/app/\(marketing\)/page.tsx

# Update next.config.ts with redirect
git add next.config.ts

git commit -m "refactor(phase-1): delete legacy landing artifacts, scaffold v2 baseline

FOUND-01: delete src/components/landing/ (14 files) + index.ts barrel
FOUND-02 + D-20: empty 7-section scaffold at (marketing)/page.tsx
D-22: atomic single-commit deletion
D-23: delete /pricing route, add /pricing → /#pricing redirect

Verified safe via grep: only consumers were (marketing)/page.tsx and
(marketing)/pricing/page.tsx — both replaced/deleted in this commit."
```

### Verify no broken imports after deletion

```bash
# Run after the commit
pnpm install                # ensure deps resolve (lenis + bundle-analyzer should be in lockfile)
pnpm tsc --noEmit            # full TypeScript check — must pass with 0 errors
pnpm build                   # full Next.js build — must succeed
```

If `tsc --noEmit` reports any unresolved import referencing `@/components/landing/*`, that's a missed consumer — investigate via grep before merging.

### Why single-commit (not staged deletions)

A 5-commit sequence (delete each file, fix consumers between) leaves the worktree in a broken intermediate state where `pnpm build` fails. The single-commit approach guarantees that EVERY commit on the branch passes `pnpm build`, which is the bisect-safety bar for the milestone.

---

## 16. Validation Architecture (Nyquist Dimension 8)

> Required because `workflow.nyquist_validation: true` in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright `^1.58.0` (visual + responsive checks) + Vitest `^4.0.18` (unit) + `pnpm tsc --noEmit` (type check) |
| Config file | `verification/playwright.config.ts` + `vitest.config.ts` |
| Quick run command | `pnpm tsc --noEmit && pnpm test` (~ 30s) |
| Full suite command | `pnpm build && pnpm exec playwright test --config=verification/playwright.config.ts` (~ 5-8 min) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-01 | 14 files in `src/components/landing/` deleted | git diff inspection | `test -z "$(ls src/components/landing/ 2>/dev/null)"` | ✅ shell check |
| FOUND-02 | `(marketing)/page.tsx` is empty 7-section scaffold | DOM snapshot | Playwright: `expect(page.locator('section[data-section]')).toHaveCount(7)` | ❌ Wave 0 — add to visual-comparison.spec.ts |
| FOUND-03 | `landing.css` exists with `@layer landing` + display tokens | file inspection | `test -f src/app/\(marketing\)/landing.css && grep -q '@layer landing' src/app/\(marketing\)/landing.css` | ✅ shell check |
| FOUND-04 | Lenis 1.3.23 installed; LenisProvider wraps (marketing) only | smoke test + dashboard regression | `pnpm exec playwright test verification/scripts/visual-comparison.spec.ts -g "Dashboard regression"` — verify `body` has NO `lenis-*` class on `/app/dashboard` | ❌ Wave 0 — extend spec with class assertion |
| FOUND-05 | LazyMotion + m.* convention | strict-mode runtime check | `pnpm build` succeeds (strict mode would error if any landing component imports `motion` direct) | ✅ build check |
| FOUND-06 | Inter font axes:['opsz']; optical sizing applied | DOM property check | Playwright: `expect(page.locator('body')).toHaveCSS('font-optical-sizing', 'auto')` | ❌ Wave 0 — add to responsive-check.spec.ts |
| FOUND-07 | `next.config.ts` images.formats includes avif+webp | config file inspection | `grep -q "image/avif" next.config.ts && grep -q "image/webp" next.config.ts` | ✅ shell check |
| FOUND-08 | `@next/bundle-analyzer` installed + script | package.json check | `pnpm view @next/bundle-analyzer version` (verify in deps) + `jq -e '.scripts.analyze' package.json` | ✅ shell check |
| FOUND-09 | Web Vitals tracking wired | render check + console scrape | Playwright: visit `/`, capture console.log, expect `[web-vital:LCP]` line in dev mode | ❌ Wave 0 — add console capture test |
| FOUND-10 | MotionWrapper pattern documented + exemplified | code grep | `grep -rE "['\"]use client['\"]" src/components/landing/ --include="*.tsx" \| wc -l` ≥ 2 (LenisProvider + LandingMotionProvider) | ✅ shell check |
| FOUND-11 | Visual harness updated; `data-section` convention | spec inspection | `grep -q "data-section=\"hero\"" verification/scripts/visual-comparison.spec.ts` AND Playwright spec runs green | ✅ shell + Playwright |
| FOUND-12 | CRAFT-RUBRIC.md written + AS-01..AS-15 embedded | file inspection | `test -f .planning/CRAFT-RUBRIC.md && grep -q "AS-15" .planning/CRAFT-RUBRIC.md` | ✅ shell check |
| FOUND-13 | Phase-gate checklist documented | file inspection | `grep -q "Phase-gate Checklist" .planning/CRAFT-RUBRIC.md` (or separate file) | ✅ shell check |
| FOUND-14 | Section brief template written | file inspection | `test -f .planning/SECTION-BRIEF-TEMPLATE.md && grep -cE "^## [1-7]\\." .planning/SECTION-BRIEF-TEMPLATE.md` == 7 | ✅ shell check |

### Sampling Rate

- **Per task commit:** `pnpm tsc --noEmit && pnpm run check:landing-scope` (~ 15s — type check + scope guard)
- **Per wave merge:** `pnpm build && pnpm exec playwright test --config=verification/playwright.config.ts --project=desktop` (~ 3 min — desktop only)
- **Phase gate:** Full Playwright suite (3 viewports) + Lighthouse mobile (LCP < 2.5s, CLS < 0.1) + `pnpm run analyze` baseline capture

### Wave 0 Gaps (must be addressed before any section work begins)

- [ ] `verification/scripts/visual-comparison.spec.ts` — extend with new `data-section="<name>"` selectors and `Dashboard regression — token leakage check` entry (§5)
- [ ] `verification/playwright.config.ts` — change desktop viewport from 1440 → 1280 to match Linear/Raycast reference snapshots (§5)
- [ ] `verification/scripts/capture-references.spec.ts` — NEW file, captures 9 PNG reference snapshots (§13)
- [ ] `verification/scripts/responsive-check.spec.ts` — extend with `font-optical-sizing: auto` assertion on body (FOUND-06 test)
- [ ] `scripts/check-landing-scope.ts` — NEW file, CI scope guard (§8)
- [ ] `package.json` scripts — add `analyze` (rename existing to `analyze:dataset`), `capture:refs`, `check:landing-scope`, `prebuild`
- [ ] `verification/reference/dashboard-baseline-1280.png` — capture BEFORE Phase 1 lands (use `pnpm exec playwright test` against current `main` baseline)

*(If existing test infrastructure covers all phase requirements: it doesn't. Wave 0 has 7 prerequisite tasks before sections work.)*

---

## Runtime State Inventory

> Required because Phase 1 involves deletion/refactor of existing files.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 1 touches no databases, no Supabase tables, no client localStorage | None |
| Live service config | None — Phase 1 does not modify Vercel project config, Sentry project, or Whop dashboard | None |
| OS-registered state | None — no cron jobs, no Task Scheduler entries, no launchd plists | None |
| Secrets/env vars | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` (already in use, unchanged); `ANALYZE` (new env var for bundle-analyzer toggle — local-only, not deployed) | Document `ANALYZE=true` in README or `.env.example` |
| Build artifacts | `.next/` cache contains old route data for `/pricing` — cleared on next `pnpm build`; `node_modules/.cache/` may hold stale Tailwind output if dev was run during transition | Document dev-cache-reset protocol (already in CLAUDE.md and reiterated in CRAFT-RUBRIC.md) |

**Critical:** the existing `node_modules/` directory does NOT yet exist in this worktree (no `pnpm install` has been run since clone). Phase 1 wave 0 MUST run `pnpm install` before any other action. [VERIFIED: `ls node_modules/` returns "no such file or directory"]

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pnpm | Package management, all scripts | ✅ | 10.29.3 | npm fallback |
| Node.js | All runtimes | ✅ | v25.2.1 | — |
| npx | One-shot package execution | ✅ | 11.6.2 | — |
| curl | DESIGN.md fetch from GitHub raw | ✅ | system curl | wget fallback |
| jq | (optional) JSON inspection in scripts | ✅ | system jq | grep/node fallback |
| @playwright/test | Visual harness + capture references | ⚠️ in package.json devDeps, NOT installed (no `node_modules/`) | ^1.58.0 | pnpm install required |
| lenis | Smooth scroll | ❌ NOT in package.json | — | **MUST install** `pnpm add lenis@1.3.23` |
| @next/bundle-analyzer | Bundle baseline | ❌ NOT in package.json | — | **MUST install** `pnpm add -D @next/bundle-analyzer@16.2.6` |
| Lighthouse / `lhci` | Mobile LCP/CLS gate | ❌ not in PATH | — | Use Vercel's automatic Lighthouse on preview deploys (D-25-equivalent decision in STACK.md §4c) |

**Missing dependencies with no fallback:** None — every gap has a recovery path.

**Missing dependencies requiring install:** `lenis`, `@next/bundle-analyzer`. Both INSIDE the `pnpm install` step that Phase 1 wave 0 must run.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Token cascade isolation (`@layer landing`) | CDN / Static (CSS at build time) | Frontend Server (SSR injects link) | Tailwind v4 + Lightning CSS compile cascade layers at build; no runtime overhead |
| Lenis smooth-scroll provider | Browser / Client | — | Pure browser API (wheel events, requestAnimationFrame); SSR-safe via `"use client"` |
| LazyMotion + m.* convention | Browser / Client (animation runtime) | CDN / Static (initial 4.6 KB chunk shipped) | Motion library is client-only; SSR renders static markup, hydration applies animation |
| Web Vitals reporter | Browser / Client | API / Backend (Sentry ingest) | Captured browser-side, posted to Sentry endpoint |
| Bundle analyzer | Build tooling (devDep) | — | Build-time only; produces static HTML report at `.next/analyze/` |
| Visual fidelity harness (Playwright) | Build tooling (CI) | — | Headless browser at CI; not part of runtime |
| Section data-attributes (`data-section`) | CDN / Static (markup) | Browser / Client (Playwright selector + scroll anchor) | Set at render time; consumed by client/CI |
| `/pricing` redirect | Frontend Server (Next.js edge runtime) | — | Emitted as HTTP 308 by Next.js middleware-equivalent (redirects config) |
| Inter font axes opsz | CDN / Static (font binary) | Browser / Client (CSS application) | Vercel-hosted font binary; browser applies opsz via `font-optical-sizing: auto` |
| backdrop-filter inline style | Browser / Client | — | React inline style emitted at render time; bypasses Lightning CSS |

---

## Project Constraints (from CLAUDE.md)

From `/Users/davideloreti/virtuna-landing-linear-clone/CLAUDE.md`:

- **Stack pinned:** Next.js 15 (actually 16.1.5 — repo CLAUDE says 15), TypeScript, Tailwind v4, Supabase — Phase 1 respects this
- **Branding:** Coral `#FF7F50` non-negotiable; Raycast aesthetic for dashboard
- **Tailwind v4 oklch landmine:** L < 0.15 MUST use hex — encoded in §1 and CRAFT-RUBRIC.md
- **Lightning CSS backdrop-filter landmine:** apply via inline style only — encoded in §10 and CRAFT-RUBRIC.md
- **Dev server CSS caching:** kill + clear `.next/` + `node_modules/.cache/` + browser cache when CSS changes don't appear — encoded in CRAFT-RUBRIC.md "Locked Repo Landmines"
- **Phase numbering:** milestone-scoped 1-N — Phase 1 is the first phase of this milestone (consistent)
- **Auto-push hook:** `git config core.hooksPath .githooks` — already required by personal CLAUDE.md
- **Worktree:** `~/virtuna-landing-linear-clone` on `milestone/landing-linear-clone` — current

From personal CLAUDE.md (`~/.claude/CLAUDE.md`):

- pnpm preferred (✅ — only pnpm used)
- Tailwind CSS preferred (✅ — Tailwind v4 in use)
- TypeScript strict over JS (✅)
- Verification rule: prove changes work, never "should work" — encoded in Validation Architecture (§16)
- UI work: one change at a time, screenshot, approval — encoded in D-09 layered iteration

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Tailwind v4 passes through custom `@layer landing` declarations untouched (only `theme/base/components/utilities` are reserved) | §1 | Cascade order may be wrong; landing tokens may not win against utility classes. Mitigation: verify by inspecting compiled CSS at `.next/static/css/*.css` after first `pnpm build`. [Verified at high confidence via multiple sources but not direct hands-on test in this worktree] |
| A2 | Sentry `browserTracingIntegration` 10.x automatically captures LCP, CLS, INP without manual `Sentry.metrics` calls | §7 | Web vitals may not appear in Sentry dashboard. Mitigation: after deploy, verify Sentry "Performance → Web Vitals" view shows landing-route data; if empty, add manual `Sentry.metrics.distribution()` call in WebVitalsReporter. [VERIFIED: Sentry docs say automatic, but actual project's Sentry dashboard not inspected in this research session] |
| A3 | Linear and Raycast DESIGN.md files at the cited paths are stable URLs through Phase 1 execution | §13 | curl returns 404. Mitigation: HTTP 200 verified 2026-05-19; if 404 by execution time, fall back to manually downloading from the repo browser. |
| A4 | `lenis` 1.3.23 React adapter does NOT internally bind to keyboard events that would conflict with Radix Accordion (used in Phase 7 FAQ) | §2 | Phase 7 accordion may have unexpected scroll behavior on keyboard nav. Mitigation: spike Phase 7 FAQ pattern early; if conflict appears, add `data-lenis-prevent` to accordion content. |
| A5 | Vercel deployment runs `prebuild` (npm convention) before `build` — so `check:landing-scope` runs in CI without explicit `vercel.json` configuration | §8 | CI may skip the scope check. Mitigation: verify by inducing a violation in a test PR; if not caught, add explicit `buildCommand` to `vercel.json`. [VERIFIED: Next.js / npm convention — Vercel respects package.json scripts] |
| A6 | The `prebuild` script naming is non-conflicting (no existing `prebuild` in current package.json) | §8 | Naming collision. Mitigation: package.json grepped 2026-05-19 — no `prebuild` script exists currently. |
| A7 | Existing `analyze` script (`npx tsx scripts/analyze-dataset.ts`) can be safely renamed to `analyze:dataset` | §6 | Other docs/scripts/CI may reference the old name. Mitigation: grep for `pnpm run analyze` and `npm run analyze` in repo before renaming; only the `scripts/` directory is referenced in `eslint.config.mjs` and likely safe. |

**User confirmation needed on:**
- A4 (Lenis + Radix Accordion conflict in Phase 7) — flag for Phase 7 discuss-phase

---

## Common Pitfalls (Phase-Specific)

### Pitfall A: Duplicate `<html>/<body>` in `(marketing)/layout.tsx`

**What goes wrong:** Current `(marketing)/layout.tsx` declares its own `<html className={inter.variable}><body>...` which is duplicated from the root `src/app/layout.tsx`. Next.js App Router renders the root layout's HTML/body for ALL routes; nested layouts must NOT duplicate them.

**Detection:** Look at lines 21-28 of current `(marketing)/layout.tsx` — it has `<html>` and `<body>`. The root layout (lines 42-49 of `src/app/layout.tsx`) also has them.

**Fix in Phase 1:** Rewrite `(marketing)/layout.tsx` to NOT render `<html>` or `<body>`. Just return providers + children. Pattern shown in §2 above.

### Pitfall B: Tailwind v4 hot reload misses landing.css changes

**What goes wrong:** Tailwind v4 has aggressive caching; new tokens added to `landing.css` may not appear in `pnpm dev` until cache is cleared.

**Fix:** Kill dev server, `rm -rf .next/ node_modules/.cache/`, restart. (Encoded in CLAUDE.md.)

### Pitfall C: Sentry's default `tracesSampleRate` may be too low to see web vitals

**What goes wrong:** `tracesSampleRate: 0.1` (current value in `sentry.server.config.ts`) samples only 10% of transactions. Web vitals come from `pageload` transactions which inherit this rate. At 10%, the landing route may show "no data" in Sentry for the first few days of low traffic.

**Detection:** After Phase 1 deploys, check Sentry Performance dashboard for landing-route web vitals. If empty after 24h of traffic, raise sample rate.

**Fix:** In `instrumentation-client.ts`, set `tracesSampleRate: 1.0` for landing route. Note this only affects the client side (relevant for web vitals).

⚠️ This is OUT of Phase 1 scope unless Davide explicitly requests sampling adjustment.

### Pitfall D: ESLint config ignores `src/components/motion/` (existing)

**What goes wrong:** [VERIFIED: eslint.config.mjs line 28] The existing ESLint config has `globalIgnores` covering `src/components/motion/**`. If a future agent moves landing motion primitives into `src/components/motion/landing/`, they bypass linting.

**Mitigation:** Keep landing motion primitives at `src/components/landing/landing-motion-provider.tsx` (NOT in `src/components/motion/`). Phase 1 ESLint config does NOT need extension.

### Pitfall E: Production redirect doesn't preserve fragment when `dynamic` is missing

**What goes wrong:** Next.js 16 `redirects()` returns the destination as-is in the HTTP 308 Location header. Some HTTP clients (curl with `-L`, older proxies) strip fragments on redirect. Browsers preserve them.

**Mitigation:** Verify post-deploy that `https://virtuna.ai/pricing` lands on `https://virtuna.ai/#pricing` in Chrome / Safari / Firefox. If a proxy strips the fragment in production, fall back to a client-side `<Link href="/#pricing">` redirect at `/pricing/page.tsx` (delete the server redirect, recreate the route with a minimal client page). [LOW probability — most users hit the landing via direct link or bookmark, not via a fragment-stripping proxy]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS cascade isolation between routes | Custom `.landing` wrapper class with `:root.landing` selectors | Native `@layer landing` (CSS cascade layer) | Browser-native, zero runtime cost, DevTools-inspectable |
| Smooth scroll | Manual `requestAnimationFrame` + `lerp` math | `lenis@1.3.23` (~40 KB gzipped) | Battle-tested across thousands of sites; handles iOS/Android quirks; prevents-attribute API for Radix |
| Motion library bundle optimization | Manual code-splitting of `motion/react` | `LazyMotion` + `m.*` (motion's first-party pattern) | Maintained by motion team; strict mode catches misuse |
| Web Vitals collection | Custom PerformanceObserver wrapper | `useReportWebVitals` (next/web-vitals, ships with Next.js) | Already in the Next.js runtime; zero new dep |
| Bundle analysis | Manual webpack-bundle-analyzer integration | `@next/bundle-analyzer` (official wrapper) | Pre-composed with Next.js' webpack config; handles SSR/edge/client bundles separately |
| Image format conversion (AVIF/WebP) | Manual `sharp` invocations | `next.config.ts` `images.formats: ['image/avif', 'image/webp']` | Sharp already installed as Next.js peer; native pipeline runs at build + on-demand |
| Anti-slop UI review | Manually writing a 100-line review checklist per phase | Taste Skill SKILL.md (`.claude/skills/taste-virtuna/`) | Battle-tested by 13.3k stars worth of users; updated by upstream; gsd-ui-checker auto-loads it |
| Reference DESIGN.md authoring | Writing brand DESIGN.md files for Linear/Raycast from scratch | Fetch from `github.com/VoltAgent/awesome-design-md` | Maintained, peer-reviewed; saves hours per phase |
| `data-section` attribute scheme | Inventing a per-section ID convention | `data-section="<name>"` — already established by FOUND-11 and aligned with existing visual-comparison.spec.ts | Single source of truth; Playwright + scroll-anchor + ui-checker all consume the same attribute |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `framer-motion` direct imports | `motion` package (rebranded 2025); `motion/react` for hooks/components; `motion/react-m` for LazyMotion `m.*` | motion 11.x | Same API; new import paths; LazyMotion is more discoverable |
| AVIF behind a flag | AVIF as baseline (Chrome, Safari 16.4+, Firefox) | early 2024 | `formats: ['image/avif', 'image/webp']` is now safe default |
| `@studio-freight/lenis` | `lenis` (rebranded) | 2025 | Same library; deprecated package name |
| `@studio-freight/react-lenis` | `lenis/react` (folded into main package) | 2025 | Same React adapter; import path changed |
| `font-display: swap` with raw CSS | `next/font` with auto size-adjust fallback | next.js 13.4 | Eliminates font-swap CLS |
| `useReportWebVitals` from `pages/_app` | `useReportWebVitals` from `next/web-vitals` (client component in App Router) | next.js 13 (App Router GA) | Now requires `"use client"` + render inside layout |
| Tailwind v3 `tailwind.config.js` | Tailwind v4 `@theme` in CSS + Lightning CSS engine | Jan 2025 | Configuration moves to CSS; oklch native; cascade layers native |

**Deprecated / outdated for this milestone:**
- `@studio-freight/lenis` (use `lenis`)
- `@studio-freight/react-lenis` (use `lenis/react`)
- Lottie/lottie-react for landing animations (motion/react + CSS covers needs at lower bundle cost)
- GSAP for landing animations (motion/react covers all scroll-linked needs; GSAP adds 250 KB)
- `tailwind.config.js` for v4 (CSS `@theme` block is the new home — already in place)

---

## Code Examples — All Phase 1 Deliverable Patterns Verified

### Example 1: landing.css full structure
See §1 above for the complete file.

### Example 2: LenisProvider (extracted, prefers-reduced-motion aware)
See §2 above for the complete code.

### Example 3: LandingMotionProvider (LazyMotion strict)
See §3 above for the complete code.

### Example 4: WebVitalsReporter (route-scoped, console+Sentry)
See §7 above for the complete code.

### Example 5: check-landing-scope.ts (full script)
See §8 above for the complete code.

### Example 6: next.config.ts (Sentry + bundle-analyzer + redirects)
See §6 above for the complete code.

### Example 7: Empty 7-section scaffold for `(marketing)/page.tsx` (D-20)

```tsx
// src/app/(marketing)/page.tsx (Phase 1 day-1 deliverable)
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Virtuna | AI Content Intelligence for TikTok Creators",
  description:
    "Know what will go viral before you post. AI-powered predictions, trend intelligence, and audience insights for TikTok creators.",
};

export default function LandingPage() {
  return (
    <main>
      <section data-section="hero">{/* Phase 2 — Nav + Hero */}</section>
      <section data-section="bento">{/* Phase 3 — Feature Bento */}</section>
      <section data-section="how-it-works">{/* Phase 4 — How It Works */}</section>
      <section data-section="behavioral-moat">{/* Phase 5 — Behavioral Science Moat */}</section>
      <section data-section="social-proof">{/* Phase 6 — Stat Counters */}</section>
      <section data-section="pricing" id="pricing">{/* Phase 7 — Pricing (also the anchor for /pricing redirect) */}</section>
      <section data-section="footer">{/* Phase 7 — Footer */}</section>
    </main>
  );
}
```

⚠️ Note `id="pricing"` on the pricing section — this is the anchor target for the `/pricing → /#pricing` redirect (D-23). Without the `id`, the fragment scroll doesn't work.

### Example 8: Rewritten `(marketing)/layout.tsx` (fixes Pitfall A above)

```tsx
// src/app/(marketing)/layout.tsx (after Phase 1)
import "../globals.css";
import "./landing.css";
import "lenis/dist/lenis.css";

import { Header } from "@/components/layout/header";
import { LenisProvider } from "@/components/landing/lenis-provider";
import { LandingMotionProvider } from "@/components/landing/landing-motion-provider";
import { WebVitalsReporter } from "@/components/landing/web-vitals-reporter";

// NO export of html/body — root layout owns them.
// NO export of inter font — root layout owns it (with axes:['opsz'] applied).

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <LenisProvider>
      <LandingMotionProvider>
        {/* Header is the existing app header; Phase 2 will replace with LandingNav */}
        <Header />
        {children}
        <WebVitalsReporter />
      </LandingMotionProvider>
    </LenisProvider>
  );
}
```

---

## Open Questions / Risk Surface

1. **Tailwind v4 + custom `@layer landing` — verified at high confidence via documentation but not via direct compile test in this worktree.**
   - What we know: Tailwind v4 source code passes through non-reserved layer names; cascade layer declarations are emitted to compiled CSS.
   - What's unclear: edge cases where Lightning CSS may reorder or strip a `@layer landing { :root { ... } }` block during minification.
   - Recommendation: Phase 1 wave 0 task — write a 5-line smoke test that builds `landing.css` standalone and inspects the output (`grep "@layer landing" .next/static/css/*.css`). If the layer is missing in the output, switch to the unnamed-trailing-layer approach (place all landing CSS in a final unnamed layer after Tailwind's `@import`).

2. **`pnpm install` may fail if registry is offline or if `lenis@1.3.23` becomes deprecated.**
   - Recommendation: include a "verify install" wave 0 task that runs `pnpm install --frozen-lockfile=false`, then `pnpm view lenis version` to confirm 1.3.23 resolves. If not, accept the latest 1.x version (Lenis maintains backward compat within minor versions).

3. **Capture references script may fail against Cloudflare or anti-bot protection on linear.app.**
   - Recommendation: include a manual-screenshot fallback in `verification/scripts/capture-references.spec.ts` comments. If automated capture fails, take screenshots manually in Chrome at the target viewport and place them in `verification/reference/` with the expected filenames.

4. **`/pricing → /#pricing` redirect SEO behavior**
   - What we know: Google handles HTTP 308 redirects identically to 301 (permanent).
   - What's unclear: whether Google indexes the destination including the fragment (typically NO — fragments are client-side).
   - Recommendation: ensure the new pricing section at `(marketing)/page.tsx#pricing` is server-rendered (not lazy-loaded) so crawlers see it. The empty scaffold (Example 7) already does this.

5. **Davide visual review (D-05 layer 5) — process not yet defined.**
   - Phase 1 doesn't ship visible UI, so the "production build at 3 viewports" review for Phase 1 is mostly auditing the dev panel + bundle analyzer report + reference snapshots.
   - Recommendation: define the Phase 1 review checklist as part of CRAFT-RUBRIC.md's "Phase 1 baseline" section.

---

## Sources

### Primary (HIGH confidence)

| Source | Topic |
|--------|-------|
| `nextjs.org/docs/app/api-reference/functions/use-report-web-vitals` | useReportWebVitals API in App Router |
| `motion.dev/docs/react-lazy-motion` | LazyMotion + m.* import path + strict mode |
| `motion.dev/docs/react-reduce-bundle-size` | LazyMotion bundle sizes (4.6 KB initial, +15 KB domAnimation, +25 KB domMax) |
| `github.com/darkroomengineering/lenis` README | Lenis options table (lerp, duration, smoothWheel, autoRaf, data-lenis-prevent) |
| `github.com/darkroomengineering/lenis/packages/react` | ReactLenis component + useLenis hook API |
| `tailwindcss.com/blog/tailwindcss-v4` | Cascade layers used by Tailwind v4, Lightning CSS engine |
| `github.com/tailwindlabs/tailwindcss/discussions/18123` | Custom layer names passed through untouched |
| `docs.sentry.io/platforms/javascript/guides/nextjs/tracing/instrumentation/automatic-instrumentation/` | Sentry browserTracingIntegration captures LCP/CLS/INP automatically |
| `code.claude.com/docs/en/skills` | Claude Code skill install paths (.claude/skills/* project-scoped) |
| `github.com/Leonxlnx/taste-skill` README | npx install + manual SKILL.md install fallback |
| `github.com/VoltAgent/awesome-design-md` | DESIGN.md path structure (verified via HTTP 200 on linear.app/raycast paths) |
| Project `CLAUDE.md` (repo root) | oklch landmine, Lightning CSS backdrop-filter landmine, dev cache reset |
| Project `.planning/research/PITFALLS.md` | Composition reproduction pitfall, LCP regression, hydration mismatch, scroll jank |
| Project `.planning/research/ARCHITECTURE.md` | Route grouping, RSC/client boundary, scroll progress patterns |
| Project `.planning/research/STACK.md` | Bundle deltas, install commands, anti-features |
| Project `.planning/research/anti-slop-design-playbook.md` | AS-01..AS-15 anti-slop blacklist |
| Direct read of `src/app/(marketing)/layout.tsx`, `src/app/layout.tsx`, `next.config.ts`, `src/instrumentation-client.ts`, `verification/scripts/visual-comparison.spec.ts`, `verification/playwright.config.ts`, `src/components/primitives/GlassPanel.tsx`, `src/components/motion/*.tsx`, `package.json`, `eslint.config.mjs`, `postcss.config.mjs`, `src/app/globals.css` | All file-level verifications |
| `npm view` for `lenis`, `@next/bundle-analyzer`, `motion`, `next`, `@sentry/nextjs` | Version verification (2026-05-19) |
| `curl -sI` HEAD checks against awesome-design-md raw URLs | URL availability verification (2026-05-19) |

### Secondary (MEDIUM confidence)

- `bridger.to/lenis-nextjs` — Next.js App Router LenisProvider with prefers-reduced-motion (pattern cross-checked against multiple tutorials)
- `css-tricks.com/using-css-cascade-layers-with-tailwind-utilities/` — cascade layer + Tailwind interaction patterns
- `thisdot.co/blog/the-css-utility-hybrid-approach-with-tailwind-v4` — Tailwind v4 hybrid approach
- `medium.com/@onix_react` — Tailwind v4 expectations
- `tasteskill.dev/docs` — Taste Skill equalizer parameters

### Tertiary (LOW confidence — flagged for verification)

- Cloudflare blocks linear.app from headless browsers — anecdotal, requires test
- `next.config.ts` redirect fragment preservation in proxies — documented as RFC-compliant; not all proxies follow RFC

---

## Metadata

**Confidence breakdown:**
- Standard stack / library versions: HIGH (verified via npm registry + package.json read)
- Cascade layer pattern: HIGH (documented in Tailwind v4 source + discussion threads; smoke test recommended as Phase 1 wave 0)
- Lenis + Radix conflict: HIGH (documented + canonical mitigation `data-lenis-prevent`)
- LazyMotion strict + m.* path: HIGH (motion.dev docs verified)
- Sentry web vitals auto-capture: HIGH (docs verified) but flagged Assumption A2 for post-deploy verification
- Existing codebase patterns (GlassPanel inline backdrop-filter, hex-for-dark, useReducedMotion): HIGH (direct file reads)
- Anti-slop blacklist (AS-01..AS-15): HIGH (sourced from `.planning/research/anti-slop-design-playbook.md`)
- Reference asset capture (linear.app/raycast.com Playwright): MEDIUM (anti-bot risk noted)

**Research date:** 2026-05-19
**Valid until:** 2026-06-19 (1 month — Tailwind v4, motion, lenis are stable; Sentry SDK changes may invalidate web vitals section sooner)

---

## RESEARCH COMPLETE
