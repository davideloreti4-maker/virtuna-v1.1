# Architecture Research

**Domain:** Single-page SaaS landing site — high-craft rebuild on existing Next.js 15 + Tailwind v4 + 36-component DS
**Researched:** 2026-05-19
**Confidence:** HIGH (based on direct codebase analysis + verified framework behavior)

---

## System Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│  Route: src/app/(marketing)/page.tsx  [RSC, no auth dependency]         │
├────────────────────────────────────────────────────────────────────────┤
│  Layout: src/app/(marketing)/layout.tsx                                  │
│  [Inter font, globals.css, Header — already RSC-safe]                   │
├────────────────────────────────────────────────────────────────────────┤
│  Section Components: src/components/landing/  [mix of RSC + islands]    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │  Navbar  │ │   Hero   │ │ Feature  │ │ Pricing  │ │   CTA    │     │
│  │  RSC     │ │ island   │ │   grid   │ │  RSC+    │ │  island  │     │
│  │          │ │ (motion) │ │ RSC+lazy │ │  island  │ │          │     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
├────────────────────────────────────────────────────────────────────────┤
│  Token Layer: globals.css @theme  [primitive → semantic]                │
│  ┌──────────────────┐  ┌──────────────────────────────────────────┐    │
│  │  Global DS tokens │  │  Landing-scoped tokens (CSS vars, :root) │    │
│  │  (no change)      │  │  -- no @theme pollution                  │    │
│  └──────────────────┘  └──────────────────────────────────────────┘    │
├────────────────────────────────────────────────────────────────────────┤
│  DS Primitives: src/components/ui/ + src/components/primitives/         │
│  [Button, GlassPanel, Typography — consumed directly, no fork needed    │
│   unless landing variant diverges from dashboard semantic]              │
├────────────────────────────────────────────────────────────────────────┤
│  Motion / Effects: src/components/motion/ + src/components/effects/     │
│  [FadeInUp, StaggerReveal, HoverScale — reuse as-is]                   │
├────────────────────────────────────────────────────────────────────────┤
│  Verification: verification/scripts/  [Playwright + pixelmatch]         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Token Layering Strategy

### Decision: CSS custom properties in `:root` via a landing-scoped CSS import

Tailwind v4's `@theme` block maps tokens into the Tailwind utility class namespace globally. Adding landing-specific tokens to `@theme` would expose `--font-display`, `--ease-landing-*`, etc. as utility classes available everywhere — polluting the dashboard's Raycast aesthetic.

**Correct approach — a route-scoped CSS file imported only by the landing layout:**

```
src/app/(marketing)/landing.css   ← imported in (marketing)/layout.tsx
```

Inside `landing.css`, define tokens as plain CSS custom properties under `:root`. They are available to any element rendered inside the marketing route group but are never compiled into Tailwind utilities, so they cannot leak into `(app)/` routes.

```css
/* src/app/(marketing)/landing.css */
/* Landing-scoped tokens — NOT in @theme, NOT in globals.css */
:root {
  /* Display typography scale — larger than DS defaults */
  --landing-text-display-xl: 80px;   /* hero H1, desktop */
  --landing-text-display-lg: 64px;   /* hero H1, tablet */
  --landing-text-display-md: 48px;   /* section heads */
  --landing-text-display-sm: 36px;   /* sub-heads */
  --landing-lh-display: 1.05;
  --landing-lh-body: 1.65;          /* roomier than DS --leading-normal */
  --landing-tracking-display: -0.03em;

  /* Motion easings — Linear-quality, longer than DS defaults */
  --landing-ease-enter: cubic-bezier(0.16, 1, 0.3, 1);   /* expo out */
  --landing-ease-exit: cubic-bezier(0.7, 0, 0.84, 0);    /* expo in  */
  --landing-ease-inout: cubic-bezier(0.87, 0, 0.13, 1);  /* expo inout */
  --landing-dur-enter: 0.7s;
  --landing-dur-slow: 1.1s;
  --landing-dur-stagger: 0.06s;

  /* Gradient tokens — landing-only visual motifs */
  --landing-gradient-hero-glow: radial-gradient(
    ellipse 80% 50% at 50% -10%,
    rgba(255, 127, 80, 0.12) 0%,
    transparent 70%
  );
  --landing-gradient-feature-border: linear-gradient(
    135deg,
    rgba(255, 127, 80, 0.2) 0%,
    rgba(255, 255, 255, 0.04) 50%,
    rgba(255, 127, 80, 0.08) 100%
  );
  --landing-gradient-mesh: radial-gradient(
    circle at 20% 50%,
    rgba(255, 127, 80, 0.06) 0%,
    transparent 50%
  ),
  radial-gradient(
    circle at 80% 20%,
    rgba(255, 127, 80, 0.04) 0%,
    transparent 50%
  );

  /* Spacing rhythm — landing uses more vertical air than dashboard */
  --landing-section-gap: 140px;     /* desktop between sections */
  --landing-section-gap-mobile: 80px;
}
```

**Why not CSS modules?** Landing sections are composed in RSC page.tsx and passed through multiple layers. CSS Modules require `styles.className` dot-notation in every component, breaking the utility-first pattern the codebase uses uniformly. `:root` CSS vars are the right choice here — they scope via import chain, not component boundary.

**Why not extend `@theme`?** The `@theme` block in `globals.css` is intentionally Raycast-accurate. Adding landing tokens there risks naming collisions and creates Tailwind utilities that will compile into every CSS bundle on every route. Keep `@theme` for shared DS tokens only.

### Using landing tokens in components

Landing section components reference these vars via `style` prop or a thin `cn()` utility class. Because Tailwind v4 cannot generate arbitrary `var()` utilities without `@theme` registration, use inline styles for landing-specific token consumption:

```tsx
// In a landing section component:
<h1 style={{
  fontSize: 'var(--landing-text-display-xl)',
  lineHeight: 'var(--landing-lh-display)',
  letterSpacing: 'var(--landing-tracking-display)',
}}>
  {headline}
</h1>
```

For repeated patterns (section gap, etc.), create a small set of Tailwind `@utility` entries in `landing.css` only if the pattern appears 5+ times:

```css
/* landing.css */
@utility landing-section {
  padding-top: var(--landing-section-gap);
  padding-bottom: var(--landing-section-gap);
}
```

---

## 2. Component Reuse vs. Fork vs. Fresh

### Reuse without modification (use directly)

These DS components work as-is in landing context. Their token usage (`bg-accent`, `border-white/[0.06]`, `shadow-button`) is semantically correct on landing pages.

| Component | File | Notes |
|-----------|------|-------|
| `Button` | `src/components/ui/button.tsx` | `variant="primary"` for hero CTA, `variant="secondary"` for ghost nav links. No changes. |
| `GlassPanel` | `src/components/primitives/GlassPanel.tsx` | Use for floating product preview cards, feature highlight overlays. |
| `FadeIn` | `src/components/motion/fade-in.tsx` | Use for logo bar, simple reveals. |
| `FadeInUp` | `src/components/motion/fade-in-up.tsx` | Use for section bodies. Already has `useReducedMotion`. |
| `StaggerReveal` + `StaggerReveal.Item` | `src/components/motion/stagger-reveal.tsx` | Use for feature grid, FAQ items. |
| `HoverScale` | `src/components/motion/hover-scale.tsx` | Use on CTA cards, feature cards. |
| `NoiseTexture` | `src/components/effects/noise-texture.tsx` | Use as bg texture layer on hero section. |

### Needs a landing variant (fork with `landing-` prefix)

These components have hardcoded sizes, spacing, or semantic colors that are correct for the dashboard but too compact for a landing page's display scale.

| Existing Component | New Variant | What Changes |
|--------------------|-------------|--------------|
| `FeatureCard` (`src/components/landing/feature-card.tsx`) | `LandingFeatureCard` | Larger padding (80px vertical vs 48px), gradient border on hover using `--landing-gradient-feature-border`, optional background variant for alternating layout |
| `FAQSection` / `FAQItem` | `LandingFAQAccordion` | Uses Radix Accordion but with larger type, expanded spacing, smooth height animation |
| Header (`src/components/layout/header.tsx`) | `LandingNav` | Glassmorphic sticky nav with scroll-aware opacity transition; current header is static and not scroll-aware |
| Footer (`src/components/layout/footer.tsx`) | Keep as-is or extend | May need landing-specific link columns; audit before deciding |

Place landing variants in `src/components/landing/` alongside existing section files. Export from the existing `src/components/landing/index.ts` barrel.

### Delete and rebuild fresh

The existing landing sections in `src/components/landing/` were built for a different product (Artificial Societies / societies.io clone). Every section needs to be rebuilt with Virtuna's product narrative. The structural skeleton (section shell, max-w container, `<section>` tags) can be copied; the content composition is entirely new.

| Existing File | Action | Reason |
|---------------|--------|--------|
| `hero-section.tsx` | Rebuild | Wrong product, wrong headline, static image asset that does not exist for Virtuna |
| `features-section.tsx` | Rebuild | Wrong features (persona research), hardcoded copy |
| `stats-section.tsx` | Rebuild | Wrong stats; Virtuna stats are TikTok/creator metrics |
| `backers-section.tsx` | Rebuild | Wrong backers; replace with social proof or creator logos |
| `case-study-section.tsx` | Rebuild | Wrong case study; replace with product feature deep-dive section |
| `partnership-section.tsx` | Rebuild | Replace with brand deals / pricing section |
| `faq-section.tsx` | Rebuild | Wrong FAQs; write Virtuna-specific Q&A |
| `cta-section.tsx` | Rebuild | Update copy only, structure reusable |
| `social-proof-section.tsx` | Rebuild | Wrong testimonials |
| `comparison-chart.tsx` | Evaluate | Competitive comparison is valid for Virtuna; rebuild content |
| `persona-card.tsx` | Delete | societies.io artifact, no use in Virtuna |
| `testimonial-quote.tsx` | Keep structure | Typography + GlassPanel pattern is reusable, just swap content |

**Fresh components needed (no existing analogue):**

| Component | Location | Purpose |
|-----------|----------|---------|
| `LandingNav` | `src/components/landing/landing-nav.tsx` | Scroll-aware sticky nav with backdrop blur, CTA inline |
| `HivePreview` | `src/components/landing/hive-preview.tsx` | Lazy-mounted simplified hive canvas demo (below fold) |
| `PricingSection` | `src/components/landing/pricing-section.tsx` | Tier comparison, Starter/Pro, Whop CTA wired |
| `SocialProofTicker` | `src/components/landing/social-proof-ticker.tsx` | Marquee of creator logos / platform names |
| `ProductFeatureSection` | `src/components/landing/product-feature-section.tsx` | Alternating image+copy deep-dive per product pillar |
| `BehavioralScienceMoatSection` | `src/components/landing/moat-section.tsx` | Differentiator section for behavioral science angle |
| `ScrollProgressIndicator` | `src/components/landing/scroll-progress.tsx` | Thin coral line at top, scroll-driven |

---

## 3. Server vs. Client Boundary

### Principle: RSC for shell, client islands for anything that moves or reads browser state

The existing architecture already models this correctly in `(app)/` routes — follow the same pattern in `(marketing)/`.

### Section-by-section boundary map

| Section | Render Mode | Reason |
|---------|-------------|--------|
| `(marketing)/page.tsx` | RSC | No data fetching, pure composition |
| `(marketing)/layout.tsx` | RSC | Font loading, metadata, static shell |
| `LandingNav` | Client island | Scroll listener for opacity/backdrop transitions |
| Hero section shell | RSC | Static headline + CTA text |
| Hero CTA buttons | RSC (Button as `<a>` links) | No client state needed |
| Hero background (glow/noise texture) | RSC | Pure CSS / static |
| `HivePreview` | Client island, lazy-mounted | Canvas 2D, IntersectionObserver trigger |
| Feature grid cards | RSC | Static content, hover via CSS |
| `ProductFeatureSection` | RSC shell + client island for motion | Static layout, client island wraps motion wrapper only |
| `PricingSection` | RSC shell | Pricing copy is static; Whop checkout link is a plain `<a>` |
| Social proof ticker / marquee | Client island | CSS animation driven, but needs JS for pause-on-hover |
| `LandingFAQAccordion` | Client island | Radix Accordion requires JS |
| CTA section | RSC | Button + headline, no state |
| Footer | RSC | Static links |

### Minimizing client bundle

- Wrap motion in client islands at the **leaf level**, not at section level. A section can be RSC; only the `<FadeInUp>` wrapper or `<StaggerReveal>` needs `"use client"`. The existing motion components already follow this — use them as islands inside RSC section wrappers.
- `HivePreview` is the heaviest client bundle risk (d3, Canvas). Use `next/dynamic` with `{ ssr: false, loading: () => <HivePreviewSkeleton /> }`. This keeps the initial RSC payload clean.
- Never put `"use client"` on a full section file unless the entire section is interactive. Break interactive parts into sub-components.

### View Transitions API

Next.js 15 (App Router) does not have first-class View Transitions API integration as of this codebase's Next.js 16.1.5 build. The correct approach is to use the `useViewTransition` hook pattern via `startViewTransition` from the `navigation` event or via `next/navigation`'s `startTransition` wrapper. For a single-page landing with no internal navigation, View Transitions add complexity with minimal benefit — omit for this milestone. Flag for revisit if a multi-page site navigation is added later.

---

## 4. Scroll-Driven Motion Architecture

### IntersectionObserver — the right primitive for section reveals

The existing `FadeInUp` and `StaggerReveal` components use Framer Motion's `whileInView` + `viewport={{ once: true, margin: "-80px" }}`. This is the correct pattern — it defers animation until the section enters the viewport, fires once, and respects `prefers-reduced-motion` via `useReducedMotion()`. Use this system for all section reveal animations. No custom IntersectionObserver hook is needed.

For elements that need richer control (multi-step reveal, element-level stagger within a section), use `StaggerReveal` + `StaggerReveal.Item` — already implemented with configurable `staggerDelay` and `initialDelay`.

### Scroll progress hook — for navbar and progress indicator only

```
src/hooks/use-scroll-progress.ts
```

A minimal hook that reads `window.scrollY` via `scroll` event (throttled with `requestAnimationFrame`). Returns `scrollY` (absolute) and `scrollProgress` (0–1 based on document height). Used by:

- `LandingNav`: fade in background + add backdrop blur once `scrollY > 60`
- `ScrollProgressIndicator`: drive `scaleX` on a fixed top bar

Do not use scroll progress for section-level animations — use `whileInView` instead. Scroll progress hooks re-render on every frame and are expensive when wired to many subscribers.

```tsx
// src/hooks/use-scroll-progress.ts
"use client";
import { useState, useEffect } from "react";

export function useScrollProgress() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setScrollY(window.scrollY);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollProgress = typeof window !== "undefined"
    ? Math.min(scrollY / (document.body.scrollHeight - window.innerHeight), 1)
    : 0;

  return { scrollY, scrollProgress };
}
```

### Sticky scroll sections — product feature deep-dive

For the `ProductFeatureSection` (alternating image+copy, one per product pillar), use a CSS-driven sticky layout rather than JS scroll-tracking:

```css
/* The copy side is sticky, the visual side scrolls past it */
.feature-sticky-copy {
  position: sticky;
  top: calc(var(--nav-height, 64px) + 40px);
  align-self: start;
}
```

This is pure CSS, renders in RSC, and avoids the complexity of a scroll-watcher for this pattern.

### Lazy-mounting heavy visuals

`HivePreview` is the only heavy visual on this page. Mount strategy:

1. Render a placeholder `<div>` with the same aspect ratio (skeleton shimmer or static image fallback).
2. Use `next/dynamic` with `ssr: false` so the heavy canvas code is not in the initial bundle.
3. Use an IntersectionObserver (via the existing `react-intersection-observer` package already in `package.json`) to trigger actual mount only when the section is within 200px of entering the viewport.

```tsx
// src/components/landing/hive-preview.tsx
"use client";
import dynamic from "next/dynamic";
import { useInView } from "react-intersection-observer";

const HiveCanvas = dynamic(
  () => import("@/components/hive/HiveCanvas"),
  { ssr: false, loading: () => <HivePreviewSkeleton /> }
);

export function HivePreview() {
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: "200px" });
  return (
    <div ref={ref} className="...">
      {inView ? <HiveCanvas mode="demo" /> : <HivePreviewSkeleton />}
    </div>
  );
}
```

---

## 5. Asset Strategy

### Fonts

Inter is already loaded in `(marketing)/layout.tsx` via `next/font/google` with `display: "swap"` and `variable: "--font-inter"`. No changes needed. The font variable feeds `--font-sans` in `globals.css`.

If a display typeface is added for landing headlines (Linear uses a custom display cut), load it in the same pattern:

```tsx
// Only if a second typeface is chosen — evaluate before adding
const DisplayFont = Inter({ /* same subset + variable pattern */ });
```

Current decision: stay with Inter for this milestone. Inter at `font-weight: 700` with `letter-spacing: -0.03em` at display sizes achieves Linear-quality typographic rhythm without a second font asset.

### Images

- Use `next/image` with `priority` for above-fold images (hero product preview, hero background asset if any).
- Use `next/image` without `priority` for below-fold images — they lazy-load by default.
- For the hero, prefer SVG or CSS-driven visuals over raster images where possible (reduces LCP payload, scales perfectly).
- All `<Image>` components must have explicit `width` + `height` or `fill` with a sized container to prevent layout shift.

### Video and Lottie

This milestone does not include video backgrounds or Lottie animations (they are not part of Virtuna's brand identity, and they conflict with the Raycast/Linear aesthetic of restraint). If a product demo video is added in a future iteration:

- Use `<video>` with `preload="none"` + `loading="lazy"` for below-fold placement.
- Provide a static poster frame (WCAG 1.2.2 — no auto-playing audio).
- Wrap in reduced-motion guard: if `prefers-reduced-motion`, show the poster frame only.

---

## 6. Build Order

Dependencies flow strictly: tokens before section shells; motion primitives before interactive sections; visual fidelity harness wired before any section is declared "done."

```
Phase 1: Foundation
├── Landing CSS token file (landing.css, route-scoped)
├── (marketing)/layout.tsx updated to import landing.css
├── LandingNav (scroll-aware sticky nav) — replaces static Header for landing route
├── use-scroll-progress.ts hook
└── Visual fidelity harness: verification/scripts/ updated with landing page selectors

Phase 2: Hero + Above-fold
├── Hero section rebuild (RSC shell + FadeInUp client islands)
├── ScrollProgressIndicator (drives nav + thin progress bar)
├── SocialProofTicker / logo marquee (trust signal, immediately below hero)
└── Playwright snapshot: hero at desktop / tablet / mobile

Phase 3: Feature Grid
├── LandingFeatureCard (fork of FeatureCard with landing token sizing)
├── FeaturesSection rebuild (Virtuna product pillars: prediction, competitor intel, brand deals, behavioral science)
├── StaggerReveal integration for card grid
└── Playwright snapshot: feature grid

Phase 4: Product Feature Deep-Dive
├── ProductFeatureSection (sticky-copy + scrolling-visual layout)
├── HivePreview (lazy-mounted HiveCanvas demo with skeleton)
└── Playwright snapshot: product sections

Phase 5: Pricing + CTA
├── PricingSection (Starter/Pro tiers, Whop CTA links)
├── CTA section rebuild
├── LandingFAQAccordion
└── Playwright snapshot: pricing section

Phase 6: Polish + Fidelity Gate
├── MoatSection (behavioral science differentiator)
├── Mobile responsive audit across all sections
├── Motion timing calibration (easing, duration, stagger)
├── WCAG AA contrast check (verification/scripts/contrast-audit.ts)
└── Final full-page Playwright snapshot + regression report
```

### Dependency rules

- `landing.css` must exist before any section component references its tokens.
- `LandingNav` must be built before Hero (nav height feeds `--nav-height` used by sticky sections).
- `HivePreview` depends on `HiveCanvas` from the existing DS — do not modify `HiveCanvas`; create a thin wrapper.
- Playwright harness must be updated in Phase 1 (before any section ships) so every snapshot has a baseline from first render.

---

## 7. Visual Fidelity Verification Harness

### Existing infrastructure

The `verification/` directory already has the complete harness:
- `verification/playwright.config.ts` — three viewports: desktop (1440x900), tablet (768x1024), mobile (375x812). Dark color scheme, `reducedMotion: 'reduce'` for stable screenshots.
- `verification/scripts/visual-comparison.spec.ts` — full-page screenshot + section-level screenshot + pixelmatch diff generation + markdown report.
- `pixelmatch` + `pngjs` already installed.

### What to update for this milestone

The existing `PAGES` array in `visual-comparison.spec.ts` references old sections (backers, case study, partnership). Update it to match the new section structure:

```typescript
// verification/scripts/visual-comparison.spec.ts — new PAGES entry
{
  name: "Landing — Full Page",
  url: "/",
  filename: "landing-full.png",
  sections: [
    { name: "Nav", selector: "nav", filename: "landing-nav.png" },
    { name: "Hero", selector: "section[data-section='hero']", filename: "landing-hero.png" },
    { name: "Social Proof", selector: "section[data-section='social-proof']", filename: "landing-social-proof.png" },
    { name: "Features", selector: "section[data-section='features']", filename: "landing-features.png" },
    { name: "Product Deep-Dive", selector: "section[data-section='product']", filename: "landing-product.png" },
    { name: "Pricing", selector: "section[data-section='pricing']", filename: "landing-pricing.png" },
    { name: "FAQ", selector: "section[data-section='faq']", filename: "landing-faq.png" },
    { name: "Footer", selector: "footer", filename: "landing-footer.png" },
  ],
}
```

Convention: add `data-section="<name>"` attribute to each `<section>` element so selectors are stable across markup changes.

### Craft quality gate (not pixel-match)

Because this is a fresh build (not a pixel-match to a reference site), the harness measures:
1. No layout shift between renders (screenshots taken after `networkidle` + 1000ms settle).
2. No missing content (section height > threshold).
3. Responsive integrity: no horizontal overflow at mobile (375px).
4. WCAG contrast: run `verification/scripts/contrast-audit.ts` per section.

The "side-by-side comparison harness" is human-reviewed: run the verification script, then open the report in the browser to view section screenshots side-by-side with the craft quality bar notes. There is no automated pixel-match to a reference site screenshot — that would be checking content parity, not craft quality.

### Running the harness

```bash
# Start dev server (separate terminal)
pnpm dev

# Run verification suite
npx playwright test --config=verification/playwright.config.ts

# View report
open verification/reports/visual-comparison.md
```

---

## Recommended Project Structure (landing additions)

```
src/
├── app/
│   └── (marketing)/
│       ├── layout.tsx          # Add: import "../landing.css"
│       ├── landing.css         # NEW: route-scoped landing tokens
│       └── page.tsx            # Rebuilt: Virtuna section composition
├── components/
│   └── landing/
│       ├── index.ts            # Update barrel exports
│       ├── landing-nav.tsx     # NEW: scroll-aware sticky nav
│       ├── hero-section.tsx    # REBUILD: Virtuna hero
│       ├── social-proof-ticker.tsx # NEW: creator logo marquee
│       ├── landing-feature-card.tsx # NEW: landing-sized fork of FeatureCard
│       ├── features-section.tsx    # REBUILD: Virtuna product pillars
│       ├── product-feature-section.tsx # NEW: sticky-copy deep-dive
│       ├── hive-preview.tsx        # NEW: lazy-mounted HiveCanvas demo
│       ├── pricing-section.tsx     # NEW: Starter/Pro, Whop CTAs
│       ├── faq-section.tsx         # REBUILD: Virtuna Q&A
│       ├── cta-section.tsx         # REBUILD: CTA copy
│       ├── moat-section.tsx        # NEW: behavioral science differentiator
│       ├── scroll-progress.tsx     # NEW: thin coral progress bar
│       ├── [DELETE] backers-section.tsx
│       ├── [DELETE] case-study-section.tsx
│       ├── [DELETE] comparison-chart.tsx
│       ├── [DELETE] partnership-section.tsx
│       ├── [DELETE] persona-card.tsx
│       └── [DELETE] social-proof-section.tsx (replaced by social-proof-ticker)
└── hooks/
    └── use-scroll-progress.ts  # NEW: rAF-throttled scroll Y + progress
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Token pollution via @theme

**What:** Adding landing-specific tokens (`--font-display`, `--landing-ease-*`) to `globals.css` inside the `@theme` block.
**Why wrong:** These tokens compile into Tailwind utilities available globally. The dashboard gets `font-display` and `ease-landing-enter` utilities it should never use. Drift from the Raycast design language happens silently.
**Instead:** `landing.css` with `:root` CSS custom properties, imported only in `(marketing)/layout.tsx`.

### Anti-Pattern 2: "use client" at section level

**What:** Adding `"use client"` to the top of `hero-section.tsx`, `features-section.tsx`, etc.
**Why wrong:** Pulls the entire section — including all its children — into the client bundle. Static text, headings, and structural markup are shipped as JS and hydrated unnecessarily. Increases TTI.
**Instead:** Section files are RSC. Only motion wrapper components (`FadeInUp`, `StaggerReveal`) need `"use client"`, and they already have it. Import them into RSC section files — Next.js handles the boundary correctly.

### Anti-Pattern 3: Forking motion components to change easing

**What:** Copying `FadeInUp.tsx` to `LandingFadeInUp.tsx` just to change the easing curve.
**Why wrong:** Creates divergent motion primitives. When a global motion fix is needed, it now must be applied twice.
**Instead:** `FadeInUp` already accepts `duration` and supports custom `variants`. Pass the landing easing as a prop or use `motion` directly in landing sections with the landing CSS vars. Extend via props, not fork.

### Anti-Pattern 4: Importing HiveCanvas without ssr:false

**What:** `import { HiveCanvas } from "@/components/hive/HiveCanvas"` directly in a section component.
**Why wrong:** HiveCanvas uses Canvas 2D APIs and `requestAnimationFrame`. These do not exist in the Node.js RSC environment, causing server-side crashes.
**Instead:** Always use `next/dynamic(..., { ssr: false })` for HiveCanvas. This is the existing pattern for the canvas visualization; follow it.

### Anti-Pattern 5: Scroll-watcher driving section animations

**What:** Using `useScrollProgress()` or a scroll event listener to drive section opacity / translate as the user scrolls past.
**Why wrong:** Re-renders on every frame for every subscribed component. On a long landing page with 7+ sections, this creates dozens of simultaneous re-renders per scroll tick.
**Instead:** Use `whileInView` (Framer Motion). Fires once, zero scroll overhead, already implemented in `FadeInUp` and `StaggerReveal`.

---

## Integration Points

### Existing boundaries: landing ↔ dashboard

The landing route does not touch any `(app)/` route logic. No Supabase client, no TanStack Query providers, no Zustand stores. The `(marketing)/layout.tsx` intentionally does not wrap children in `Providers` — this is correct and must be preserved. CTA buttons link to `/signup` via `<a>` or `<Button asChild>` with `<Link>` from `next/navigation`. They do not import from any `(app)/` domain.

### Existing boundaries: landing ↔ DS primitives

Landing sections can import from `src/components/ui/` and `src/components/primitives/` freely. These components have no side-effects and no dashboard-specific state. They apply semantic tokens from `globals.css` which are also available in the marketing route.

### Hive preview boundary

`HiveCanvas` lives in `src/components/hive/`. The landing creates a wrapper `HivePreview` in `src/components/landing/` that imports it dynamically. Do not modify `HiveCanvas` itself — it is shared with the dashboard. The demo mode (mock data, no auth, simplified config) is controlled by props passed from `HivePreview`.

---

## Sources

- Direct analysis of `src/app/globals.css` (294 lines, @theme block)
- Direct analysis of `src/components/landing/` (14 existing files)
- Direct analysis of `src/components/motion/` (FadeInUp, StaggerReveal, HoverScale)
- Direct analysis of `verification/scripts/visual-comparison.spec.ts`
- Direct analysis of `src/app/(marketing)/layout.tsx`
- Direct analysis of `src/components/primitives/GlassPanel.tsx` + `src/components/ui/button.tsx`
- Tailwind CSS v4 @theme documentation (route-scoped import behavior)
- Next.js 15 App Router RSC/client boundary documentation
- `react-intersection-observer` already installed (`package.json`)
- `pixelmatch`, `pngjs` already installed (`package.json`)

---
*Architecture research for: Virtuna landing page rebuild (Linear Landing Clone milestone)*
*Researched: 2026-05-19*
