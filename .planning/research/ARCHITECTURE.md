# Architecture — Landing v1 Integration

**Project:** Virtuna — Landing v1 milestone
**Researched:** 2026-05-24
**Scope:** How Landing v1 plugs into the existing Virtuna codebase. NOT new app-side features, NOT auth, NOT DB.
**Overall confidence:** HIGH — verified against live filesystem (`src/app/`, `src/components/`, `src/hooks/`); cross-checked with PROJECT.md, FEATURES.md, STACK.md, BRAND-BIBLE.md, CLAUDE.md.

---

## TL;DR — 10 architectural decisions in one table

| # | Question | Decision | Why |
|---|---|---|---|
| 1 | Where does Landing v1 live? | `src/app/(marketing)/page.tsx` (REPLACE in place at swap time) — build at `src/app/(marketing)/v3/page.tsx` first | Marketing route group already exists; root `/` resolves to `(marketing)/page.tsx`; staging at `/v3` allows QA without disturbing live page |
| 2 | Section component location | `src/app/(marketing)/_components/` (colocated, route-private) — NOT `src/components/landing/` (legacy, soft-deprecate) | Next.js `_components` convention scopes the components to the route group; existing `src/components/landing/` is v2.x legacy and stays untouched until cutover |
| 3 | Section component naming | `HeroSection.tsx`, `DemoSection.tsx`, `HowItWorksSection.tsx`, `SurfacesSection.tsx`, `ScienceSection.tsx`, `SocialProofSection.tsx`, `PricingSection.tsx`, `FinalCtaSection.tsx`, `LandingFooter.tsx` (PascalCase, `<Name>Section` suffix) | Matches existing v2.x landing convention (`hero-section.tsx`, etc.) but using PascalCase filenames for new code (consistent with `BehavioralSimulationHero.tsx` already locked in BRAND-BIBLE) |
| 4 | Server vs Client split | Page = server; section wrappers = server where possible; interactive children isolated to leaf client components. Hero shell server (passes children to `HeroVisual` client). Demo entirely client. Pricing wrapper server, toggle child client. | Minimizes client bundle; matches CLAUDE.md "Server components by default, client only when interactive" |
| 5 | Demo state | Local React state via `useReducer` in a single client component (`DemoSection`). NO Zustand, NO URL searchParams. | 4 scripted samples × 4 demo states (`idle/picked/loading/result`) = tiny state machine. URL search-params would add `useSearchParams` boundary friction; Zustand overkill for ephemeral state |
| 6 | Asset strategy | `public/landing/placeholders/` (build-time placeholders, gitignored variants OK), `public/landing/` (real assets), `public/landing/logos/` (partner SVGs). Swap by replacing files at same path — no code changes. | Existing `public/logos/` + `public/images/` convention already in place; new namespace `/landing/` isolates milestone scope |
| 7 | Lazy-loading pattern | `react-intersection-observer` for in-viewport gating (already in deps, used in `src/components/hive-demo/index.tsx`) + `next/dynamic({ ssr: false })` for heavy client libs (Spline, GSAP, tsParticles when palette items pulled in) | Established pattern in codebase (`HiveDemo`); no new lib needed |
| 8 | Reuse vs install | **Decision tree** (full table below): If component is **structural primitive** (Button, Card, Badge, Accordion, Tabs, Tooltip) → reuse existing shadcn-style from `src/components/ui/`. If **motion choreography** (FadeIn, FadeInUp, StaggerReveal) → reuse `src/components/motion/`. If **glass surface** → reuse `GlassPanel`. If **landing-page-specialized** (BorderBeam, MagicCard, ShimmerButton, Marquee, BentoGrid, NumberTicker, BoxReveal, AnimatedBeam, AnimatedList, Spotlight, MultiStepLoader, CardStack) → install fresh via Magic UI / Aceternity. | Existing primitives cover ~40% of needs; landing-specialized motion components are the explicit additions per STACK.md |
| 9 | SEO / metadata | Per-section/per-route `metadata` exports. Replace root layout title at cutover. Keep existing root `src/app/opengraph-image.tsx` (already on-brand). Add `src/app/sitemap.ts` (NEW) + `src/app/robots.ts` (NEW). | Next.js metadata API is already used (`layout.tsx`); OG image convention already correct; sitemap/robots missing — must add |
| 10 | Mobile breakpoints | Tailwind default breakpoints — `sm: 640px`, `md: 768px`, `lg: 1024px`. Section-by-section mobile strategy in table below. Animations: pipeline horizontal→vertical at `<lg`; Spotlight ambient kept (lightweight CSS); particle counts reduced on `<sm`; AnimatedTestimonials degrades to static stack on `<md`. | Tailwind defaults are codebase standard; reduced-motion + small-screen reductions match BRAND-BIBLE Visual Metaphor Lock VIZ-03 scale affordances |

---

## 1. File / Route Structure

### Verified existing state

| Path | Status | Notes |
|---|---|---|
| `src/app/page.tsx` | **DOES NOT EXIST** | Original brief assumed it exists — it does not. Root `/` resolves through `src/app/(marketing)/page.tsx` (route group `(marketing)` doesn't appear in URL) |
| `src/app/layout.tsx` | EXISTS | Root layout — declares `<html>`, `<body>`, Inter font, metadata, viewport. Used by ALL routes. |
| `src/app/(marketing)/layout.tsx` | EXISTS (BUG) | Declares a SECOND `<html>` + `<body>` — duplicates root layout and re-imports `../globals.css`. **Bug to fix in Phase 0/1.** Should be a fragment that only wraps with `<Header />`. |
| `src/app/(marketing)/page.tsx` | EXISTS | Current live landing. Imports legacy `<HeroSection>`, `<BackersSection>`, `<FeaturesSection>`, `<StatsSection>`, `<CaseStudySection>`, `<PartnershipSection>`, `<FAQSection>` from `@/components/landing` |
| `src/app/(marketing)/pricing/page.tsx` | EXISTS | Standalone pricing page — Landing v1 inlines pricing into root, so this becomes redundant. Decision: keep `/pricing` as a redirect-to-anchor OR delete in cleanup phase |
| `src/app/opengraph-image.tsx` | EXISTS, ON-BRAND | Dark `#07080a` bg, white V mark, coral `#FF7F50` tagline. Reuse as-is for `/`. |
| `src/app/(marketing)/opengraph-image.tsx` | EXISTS | Same content as root — likely a copy. Verify identical, then delete one (consolidation) |

### Recommended build location

**Stage Landing v1 at `src/app/(marketing)/v3/page.tsx`** during build. This gives a live preview URL `/v3` for QA, screenshot comparison against Linear/Raycast, mobile testing, and reduced-motion verification, without touching the live landing page.

**Cutover step (final phase only):**
1. Move `src/app/(marketing)/v3/page.tsx` → `src/app/(marketing)/page.tsx` (overwrite)
2. Delete legacy section imports from old page (do NOT delete `src/components/landing/` yet — orphaned, but other routes may import from it)
3. Update root layout metadata (title/description copy to match Landing v1 H1)
4. Delete `src/app/(marketing)/v3/` route after cutover
5. Decide on `/pricing` page (delete OR redirect to `/#pricing`)

### Component co-location convention

Use Next.js's `_components` private-folder convention:

```
src/app/(marketing)/
├── _components/                  ← NEW; route-private section components
│   ├── HeroSection.tsx
│   ├── HeroVisual.tsx           ← client wrapper around BehavioralSimulationHero canvas
│   ├── DemoSection.tsx          ← whole-section client (state machine)
│   ├── DemoSamplePicker.tsx
│   ├── DemoMultiStepLoader.tsx
│   ├── DemoResultCardStack.tsx
│   ├── demo-data.ts             ← typed scripted demo data
│   ├── HowItWorksSection.tsx    ← server shell
│   ├── HowItWorksPipeline.tsx   ← client (AnimatedBeam)
│   ├── HowItWorksMobile.tsx     ← client (TracingBeam, mobile alt)
│   ├── SurfacesSection.tsx      ← server shell
│   ├── SurfaceBentoPrediction.tsx
│   ├── SurfaceBentoCompetitor.tsx
│   ├── SurfaceBentoBrandDeals.tsx
│   ├── ScienceSection.tsx       ← server shell
│   ├── ScienceStickyScroll.tsx  ← client (StickyScroll)
│   ├── ScienceCitationMarquee.tsx ← client (Marquee)
│   ├── SocialProofSection.tsx   ← server shell
│   ├── SocialProofLogos.tsx     ← client (Marquee)
│   ├── SocialProofTestimonials.tsx ← client (AnimatedTestimonials)
│   ├── SocialProofMetrics.tsx   ← client (NumberTicker)
│   ├── PricingSection.tsx       ← server shell
│   ├── PricingTable.tsx         ← server (static)
│   ├── PricingToggle.tsx        ← client (monthly/yearly Tabs)
│   ├── PricingFaq.tsx           ← server (Accordion accepts children server-side)
│   ├── FinalCtaSection.tsx      ← server shell
│   └── LandingFooter.tsx        ← server (static)
├── _data/                        ← NEW; pure data files
│   ├── demo-samples.ts
│   ├── pricing-tiers.ts
│   ├── science-steps.ts
│   ├── testimonials.ts
│   ├── partner-logos.ts
│   └── faq-questions.ts
├── _hooks/                       ← NEW; route-private hooks
│   ├── useScrollToSection.ts
│   └── (anything else specific to landing)
├── layout.tsx                    ← FIX: remove duplicate <html>/<body>
├── page.tsx                      ← REPLACE at cutover
├── v3/
│   └── page.tsx                  ← BUILD HERE during milestone
└── pricing/
    └── page.tsx                  ← decide: delete or redirect-to-anchor
```

**Why `_components` not `src/components/landing/v3/`:**

- Next.js private folder `_components` is **not routable** — page can't accidentally render as a URL
- Route-group-local components stay close to the only route that uses them
- Existing `src/components/landing/` is shared-namespace and contains legacy v2.x sections; mixing v3 + v2 in the same dir invites import confusion
- Imports from `@/app/(marketing)/_components/HeroSection` are explicit and discoverable

**Confidence:** HIGH

---

## 2. Server vs Client Component Split — Per Section

**Rule (re-stated from CLAUDE.md):** Server by default; `"use client"` only on interactive leaves.

### Section-by-section split

| # | Section | Wrapper (server) | Client islands |
|---|---|---|---|
| 1 | **Hero** | `HeroSection.tsx` — server. Renders static H1, subhead, dual CTA links (`<Link>`), and `<HeroVisual />` as a slot | `HeroVisual.tsx` (Canvas particle viz from BRAND-BIBLE), `<Spotlight />` (Aceternity, client), `<AnimatedShinyText />` (Magic UI eyebrow, client), `<ShimmerButton />` (Magic UI primary CTA, client), `<BorderBeam />` (frame, client) |
| 2 | **Demo** | `DemoSection.tsx` is itself `"use client"` end-to-end — it owns a small state machine (`useReducer`) for sample-picker → loader → result | Whole section is client. No server portion. (Page just renders `<DemoSection />`.) Backdrop `<BackgroundBeams />` (Aceternity, client). |
| 3 | **How it works** | `HowItWorksSection.tsx` — server. Renders heading, copy, and two visual children (desktop pipeline + mobile vertical) with CSS-driven viewport visibility | `HowItWorksPipeline.tsx` (Magic UI `AnimatedBeam` + `OrbitingCircles` + `BorderBeam`, client), `HowItWorksMobile.tsx` (Aceternity `TracingBeam`, client) |
| 4 | **Three Surfaces** | `SurfacesSection.tsx` — server. Renders Magic UI `BentoGrid` container (static), heading, copy. Passes 3 card-background children as client islands | `SurfaceBentoPrediction.tsx` (NumberTicker + animated bars, client), `SurfaceBentoCompetitor.tsx` (Marquee vertical, client), `SurfaceBentoBrandDeals.tsx` (AnimatedList, client) |
| 5 | **Science** | `ScienceSection.tsx` — server. Heading + copy + citation grid (static `<Badge>`s) | `ScienceStickyScroll.tsx` (Aceternity StickyScroll, client), `ScienceCitationMarquee.tsx` (Magic UI Marquee, client), `<NumberTicker />` × 3 stats (client) |
| 6 | **Social proof** | `SocialProofSection.tsx` — server. Section heading + shared `<Spotlight />` backdrop slot | `SocialProofLogos.tsx` (Marquee, client), `SocialProofTestimonials.tsx` (Aceternity AnimatedTestimonials, client), `SocialProofMetrics.tsx` (NumberTicker, client) |
| 7 | **Pricing** | `PricingSection.tsx` — server. Heading, copy, two `<Card>` wrappers with all static feature list content + FAQ accordion. Renders `<PricingToggle />` as a small client island that controls visibility via CSS, NOT React re-render | `PricingToggle.tsx` (shadcn Tabs, client — flips data-attr that swaps prices via CSS variables OR conditional render of two server-rendered tables) |
| 8 | **Final CTA + Footer** | `FinalCtaSection.tsx` — server. `LandingFooter.tsx` — server | `<Spotlight />` (client), `<ShimmerButton />` (client), `<AnimatedShinyText />` (client) |

### Why this matters

- **Hero, Pricing, Footer are mostly server-rendered** → fast LCP, no hydration delay for above-fold text
- **Demo is fully client** because it owns interactive state → that's acceptable, it's lazy-loaded below fold
- **Static content (heading + copy + lists) always renders server-side** → preserves SEO and reduces hydration JS

### "use client" placement rule

Put `"use client"` at the **lowest leaf** that owns the interactive behavior. Pass server-rendered children DOWN as `children` props where possible — Magic UI / Aceternity wrappers often accept arbitrary children.

Example pattern (HeroSection):

```tsx
// HeroSection.tsx — server component, no "use client"
import { HeroVisual } from "./HeroVisual";
import { ShimmerCta, GhostCta, Eyebrow } from "./HeroClient";

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center">
      <HeroVisual />  {/* client island #1 — Canvas + Spotlight */}
      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <Eyebrow />   {/* client island #2 — AnimatedShinyText */}
        <h1 className="text-display font-bold">{/* static, server-rendered */}</h1>
        <p className="text-foreground-secondary mt-6 text-lg">{/* static */}</p>
        <div className="mt-8 flex gap-4 justify-center">
          <ShimmerCta />  {/* client island #3 */}
          <GhostCta />    {/* client island #4 — could be plain Link, no client needed */}
        </div>
      </div>
    </section>
  );
}
```

**Confidence:** HIGH

---

## 3. State Management for the Interactive Demo

**Decision: local React state via `useReducer` inside `DemoSection.tsx`. NO Zustand, NO URL search params.**

### Why useReducer

- 4 explicit states: `'idle' | 'picked' | 'loading' | 'result'`
- 1 explicit "selected sample" field (1 of 4 options)
- All transitions are deterministic and scripted (setTimeout-driven)
- State does not survive remount or page navigation — by design
- No cross-component reads needed (Demo is a self-contained section)

```tsx
'use client';
import { useReducer, useEffect } from 'react';

type DemoState =
  | { phase: 'idle'; sampleId: null }
  | { phase: 'picked'; sampleId: string }
  | { phase: 'loading'; sampleId: string; step: 0 | 1 | 2 | 3 }
  | { phase: 'result'; sampleId: string };

type Action =
  | { type: 'pick'; sampleId: string }
  | { type: 'advance' }
  | { type: 'reveal' }
  | { type: 'reset' };

function reducer(state: DemoState, action: Action): DemoState {
  switch (action.type) {
    case 'pick': return { phase: 'loading', sampleId: action.sampleId, step: 0 };
    case 'advance':
      if (state.phase === 'loading' && state.step < 3) {
        return { ...state, step: (state.step + 1) as 0|1|2|3 };
      }
      return state;
    case 'reveal':
      if (state.phase === 'loading') return { phase: 'result', sampleId: state.sampleId };
      return state;
    case 'reset': return { phase: 'idle', sampleId: null };
  }
}
```

### Why NOT Zustand

- Codebase already uses Zustand in 1 place (bookmark store, per PROJECT.md context: `Bookmark system with Zustand + localStorage persistence`) — adding a new global store for ephemeral 30-second demo state pollutes that pattern
- No persistence needed (refresh = back to idle is desired)
- No cross-component state (entire demo is one section)

### Why NOT URL searchParams

- Would force `useSearchParams()` → triggers Suspense boundary
- Bookmarkable demo states are an anti-feature here (the demo IS the conversion; a deep-link to "result" state skips the loader payoff)
- Defeats the "user investment" conversion mechanic per FEATURES.md Section 2

### Reduced-motion handling

```tsx
const reducedMotion = usePrefersReducedMotion();
useEffect(() => {
  if (reducedMotion) return; // skip auto-advance; user must click through manually OR show final state instantly
  // ... setTimeout sequence
}, [state.phase, reducedMotion]);
```

If reduced-motion: skip the multi-step loader animation, jump straight to result on `pick`. Match BRAND-BIBLE § Visual Metaphor Lock VIZ-04 reduced-motion fallback pattern.

**Confidence:** HIGH

---

## 4. Asset Strategy

### Directory layout (NEW)

```
public/
├── landing/
│   ├── placeholders/          ← build-time placeholders
│   │   ├── hero-mock.png      ← gradient + V mark stand-in
│   │   ├── demo-sample-1.jpg  ← phone-frame TikTok thumb (placeholder)
│   │   ├── demo-sample-2.jpg
│   │   ├── demo-sample-3.jpg
│   │   ├── demo-sample-4.jpg
│   │   ├── safari-mock.png
│   │   └── creator-1.jpg ... creator-5.jpg  ← testimonial avatars
│   ├── logos/                 ← partner SVG + Numen Machines lockup
│   │   ├── numen-machines.svg
│   │   ├── partner-1.svg
│   │   ├── ... (5-8 total)
│   ├── viral-score.png        ← real captures (swap target)
│   ├── competitor-board.png
│   └── brand-deals.png
├── logos/                     ← EXISTING; shared partner/PR logos (legacy, keep)
├── images/                    ← EXISTING
└── fonts/                     ← EXISTING (Inter via next/font is loaded, dir likely empty)
```

### Swap path

Real assets land at the **same path** as placeholders. Filenames stay constant. No code changes at cutover — just `cp real/* public/landing/`.

**Convention:** placeholder filenames should be intent-named (`hero-mock`, `demo-sample-1`), NOT version-named. When real assets arrive, the same filename gets overwritten. Git history preserves the swap.

### Image component usage

Use `next/image` with explicit `width` / `height` for all raster images (LCP optimization). For SVG logos, import as React components via SVGR pattern if SVGR is configured, OR use `<Image>` with the SVG path. Verify by reading one existing logo usage in `src/components/landing/backers-section.tsx` during Phase 1.

### Video / GIF for product captures

If real product captures arrive as MP4/WebM, place under `public/landing/captures/`. Wrap in `<video autoPlay muted loop playsInline poster="..." />` with `loading="lazy"` on the poster fallback. Anti-pattern flag from FEATURES.md: no auto-playing video in the HERO section specifically (poster image OK). Captures inside Three Surfaces or Demo are fine.

**Confidence:** HIGH

---

## 5. Lazy-Loading Pattern

### Existing pattern (codebase-verified)

`src/components/hive-demo/index.tsx:23-65` already establishes the canonical lazy-load pattern:

```tsx
'use client';
import { useInView } from "react-intersection-observer";

export function HiveDemo() {
  const { ref, inView } = useInView({ triggerOnce: false, rootMargin: "200px" });
  return (
    <section>
      <div ref={ref} className="...">
        {inView ? <HiveDemoCanvas /> : <div className="w-full h-full bg-background" />}
      </div>
    </section>
  );
}
```

**This is the pattern Landing v1 reuses.** No new dependency, no `next/dynamic` needed for sections themselves.

### When to use which pattern

| Heaviness | Pattern | Why |
|---|---|---|
| Below-fold section composed of small Magic UI / Aceternity components | `react-intersection-observer` + conditional render inside the section's own wrapper | Lightweight, no separate code-split needed; motion components don't trigger until scrolled into view |
| Single below-fold heavy client lib (e.g. **GSAP if pulled in**, Spline if pulled in, tsParticles if pulled in) | `next/dynamic(() => import('...'), { ssr: false })` PLUS gate the dynamically-imported component behind `useInView` | Avoids server-rendering the heavy lib AND defers its bundle download until in view |
| Above-fold (Hero) | Mount on first paint; do NOT lazy-load above-fold visuals | Hero is the LCP element — lazy loading hurts LCP score |
| Component with SSR conflicts (touches `window` / `document` at module level — e.g. tsParticles, Spline `next` import) | `next/dynamic(() => import('...'), { ssr: false, loading: () => <Fallback /> })` | Required for client-only libs |

### Per-section gating recommendation

| # | Section | Lazy strategy | Rationale |
|---|---|---|---|
| 1 | Hero | EAGER mount | LCP — above fold |
| 2 | Demo | `useInView` gates whole section (rootMargin: 300px) | Multi-step loader and CardStack only mount when user is scrolling toward it |
| 3 | How it works | `useInView` gates `<HowItWorksPipeline />` mount (animation only fires once on entry) | One-shot pulse per BRAND-BIBLE VIZ-04 — must fire on viewport entry, not earlier |
| 4 | Three Surfaces | `useInView` gates each card's animated background (Marquee, NumberTicker, AnimatedList) | Three cards each have ambient animation; only animate when in view |
| 5 | Science | `useInView` gates `<NumberTicker>` ticking + StickyScroll mount | StickyScroll measures scroll position; mount it when in view |
| 6 | Social proof | Eager mount of Marquee + AnimatedTestimonials acceptable (they're below mobile fold but visible early); `useInView` gates NumberTicker bar | Marquee is GPU-cheap; testimonials lightweight |
| 7 | Pricing | EAGER mount (no animation) | Static table — no perf reason to defer |
| 8 | Final CTA / Footer | EAGER mount | Static |

### Heavy-client-lib dynamic pattern (only if pulled in)

```tsx
// Only used if Spline / GSAP / tsParticles is added to a specific section
'use client';
import dynamic from 'next/dynamic';
import { useInView } from 'react-intersection-observer';

const Spline = dynamic(() => import('@splinetool/react-spline/next'), {
  ssr: false,
  loading: () => <HeroFallback />,
});

export function HeroSpline() {
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: "100px" });
  return (
    <div ref={ref} className="absolute inset-0">
      {inView ? <Spline scene="..." /> : <HeroFallback />}
    </div>
  );
}
```

**Note:** Spline is NOT planned per BRAND-BIBLE — Canvas particle viz takes that slot. This pattern is reserved for an as-needed fallback only.

### Reduced-motion + lazy-load interaction

```tsx
const reducedMotion = usePrefersReducedMotion();
const { ref, inView } = useInView({ triggerOnce: !reducedMotion, rootMargin: "200px" });
// triggerOnce when motion enabled: animation plays once on first entry, never replays
// triggerOnce: false when motion disabled: lets caller re-render static keyframe on remount
```

Match BRAND-BIBLE VIZ-04 patterns — animation plays once per session.

**Confidence:** HIGH

---

## 6. Existing Design System Reuse — Decision Tree

### Inventoried existing components (from filesystem scan)

| Directory | Purpose | Reuse in Landing v1? |
|---|---|---|
| `src/components/ui/` (33 components) | shadcn-style structural primitives | **YES — REUSE FIRST** |
| `src/components/primitives/` (24 components) | Glass surface variants (GlassPanel, GlassPill, GlassModal, GlassNavbar, etc.) | **YES — REUSE GlassPanel + GlassPill only** |
| `src/components/motion/` (7 components) | Scroll-reveal helpers (FadeIn, FadeInUp, SlideUp, StaggerReveal, HoverScale, PageTransition, FrozenRouter) | **YES — REUSE for section reveals** (alternative to writing fresh `motion/react` viewport-enter boilerplate) |
| `src/components/effects/` (NoiseTexture, ChromaticAberration) | Effect overlays | OPTIONAL — Spotlight likely supersedes |
| `src/components/landing/` (13 v2.x section components) | LEGACY — current `/` page sections | **NO — soft-deprecate; do not import in v3** |
| `src/components/layout/` (Header, footer) | Page chrome | YES — reuse `Header`; write NEW `LandingFooter` (Landing v1 footer is denser than existing `Footer`) |
| `src/components/hive/` (Canvas hive viz) | App-side viz | NO — Landing v1 uses NEW `BehavioralSimulationHero` (per BRAND-BIBLE VIZ-01) |
| `src/components/hive-demo/` (50-node landing demo) | Existing landing teaser | NO — superseded by Demo Section (viewport 2) per Landing v1 spec |

### Decision tree (use top-to-bottom)

```
For each component need in a Landing v1 section:

1. Does an existing src/components/ui/ component cover it as-is?
   • Button (primary/secondary/ghost/destructive)
   • Card (transparent, 6% border, 12px radius)
   • Badge (semantic variants)
   • Accordion (FAQ)
   • Tabs / CategoryTabs (monthly/yearly toggle)
   • Tooltip (info icons on pricing)
   • Dialog (NOT needed in landing)
   • Avatar / AvatarGroup (NOT needed — Magic UI AvatarCircles is denser)
   → YES: reuse, import from "@/components/ui/<name>"
   → NO: continue

2. Does an existing src/components/motion/ helper cover the viewport-enter need?
   • FadeIn (opacity)
   • FadeInUp (opacity + y-translate)
   • SlideUp (y-translate only)
   • StaggerReveal (child stagger)
   → YES: reuse, import from "@/components/motion"
   → NO: continue

3. Is it a glass surface with the Raycast 5px blur / 12px radius pattern?
   → YES: use <GlassPanel> from "@/components/primitives/GlassPanel"
   → NO: continue

4. Is it a landing-specialized motion / decoration?
   • Marquee (testimonial / logo scroller)        → Magic UI Marquee (NOTE: src/components/ui/marquee.tsx EXISTS — verify it covers the use case BEFORE adding Magic UI Marquee; eliminate duplicate)
   • BentoGrid + BentoCard                        → Magic UI BentoGrid
   • MagicCard (cursor spotlight)                 → Magic UI
   • BorderBeam (traveling border accent)         → Magic UI
   • ShimmerButton (coral CTA polish)             → Magic UI
   • NumberTicker (count-up stats)                → Magic UI (note: src/hooks/useCountUp.ts EXISTS — verify whether to use existing hook + raw render or install Magic UI; recommend installing for consistency with rest of Magic UI feel)
   • BoxReveal (bar-wipe reveal)                  → Magic UI
   • AnimatedList (sequential append)             → Magic UI
   • AnimatedBeam (SVG path between nodes)        → Magic UI
   • OrbitingCircles                              → Magic UI
   • AnimatedShinyText                            → Magic UI
   • DotPattern / Particles                       → Magic UI
   • AvatarCircles                                → Magic UI
   • Spotlight (ambient gradient backdrop)        → Aceternity
   • Lamp (alternative hero glow)                 → Aceternity — skip per FEATURES.md (Spotlight preferred)
   • TracingBeam (vertical scroll-tracked)        → Aceternity (mobile pipeline)
   • StickyScroll                                 → Aceternity (Science section)
   • AnimatedTestimonials                         → Aceternity (Social proof)
   • MultiStepLoader                              → Aceternity (Demo loader)
   • CardStack                                    → Aceternity (Demo result reveal)
   • BackgroundBeams                              → Aceternity (Demo backdrop)
   → INSTALL via shadcn CLI per STACK.md

5. Custom one-off (no library covers it):
   • BehavioralSimulationHero Canvas → write fresh per BRAND-BIBLE VIZ-01 + reuse src/components/hive primitives (use-canvas-resize, color batching pattern)
   • Confidence-distribution bar chart inside Demo CardStack → custom SVG, ~80 lines, no library
   • Engine pipeline SVG layout → custom JSX wrapping Magic UI AnimatedBeam
   → BUILD CUSTOM
```

### Existing `Marquee` collision check (action item)

`src/components/ui/marquee.tsx` (1.6K) ALREADY EXISTS. Phase 1 must inspect this file BEFORE installing Magic UI Marquee. If it's already the Magic UI version (or close to it), reuse; if it's a legacy v2.x implementation, decide between:

- (a) Replace with Magic UI Marquee (`npx shadcn@latest add @magicui/marquee`)
- (b) Patch the existing one to match the Magic UI feature set if it's nearly there

Don't end up with two Marquee components.

### Existing `useCountUp` collision check

`src/hooks/useCountUp.ts` (2.4K) exists. Phase 1 must decide whether to:

- (a) Use `useCountUp` hook directly + render the number ourselves (no Magic UI install for NumberTicker)
- (b) Install Magic UI NumberTicker for visual consistency with other Magic UI components

Recommend (b) — Magic UI NumberTicker uses spring-physics easing that matches Aceternity / Magic UI motion vocabulary; `useCountUp` likely uses linear/rAF easing that visually breaks parity. Mark `useCountUp` as candidate for cleanup once landing ships.

### Existing `TestimonialCard`

`src/components/ui/testimonial-card.tsx` exists. The Landing v1 social proof section uses Aceternity `AnimatedTestimonials` (3D rotating spotlight) instead — Aceternity component renders its own card UI internally. Existing `TestimonialCard` is **not used** in v3. Keep it (other routes may use it).

**Confidence:** HIGH

---

## 7. Sitemap / Metadata / SEO

### Existing state

- `src/app/layout.tsx`: root `metadata` export with `metadataBase`, `title`, `description`, `openGraph`, `twitter`. Pattern is correct.
- `src/app/opengraph-image.tsx`: edge-runtime OG image. Dark `#07080a`, white V mark, coral tagline. ON-BRAND, reuse.
- `src/app/(marketing)/opengraph-image.tsx`: duplicate of root OG image. **Action: verify identical, then delete one** (per Next.js, the closer-to-route image wins. Since root `/` is served by `(marketing)/page.tsx`, the `(marketing)/opengraph-image.tsx` is the one that serves `/`. Pick one location and consolidate to avoid divergence.)
- `src/app/(marketing)/layout.tsx`: has its own `metadata` export — currently `title: "Artificial Societies | Human Behavior, Simulated"` (stale, from prior brand). **Bug**: this title overrides the root for marketing routes. **Fix at cutover**: replace with Landing v1 title.

### Recommended NEW files

```
src/app/sitemap.ts         ← Next.js metadata file convention; static export of routes
src/app/robots.ts          ← Next.js metadata file convention; allow all + sitemap link
src/app/manifest.ts        ← (optional) PWA manifest if installability matters; defer
src/app/icon.tsx           ← (verify if exists; if not, add for favicon)
src/app/apple-icon.tsx     ← (optional)
```

#### sitemap.ts

```ts
import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://virtuna.ai';
  return [
    { url: `${base}/`, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/#demo`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/#pricing`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    // app routes excluded (auth-gated)
  ];
}
```

#### robots.ts

```ts
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/dashboard', '/api', '/auth', '/onboarding'] },
    sitemap: 'https://virtuna.ai/sitemap.xml',
  };
}
```

### Per-page metadata for `/`

At cutover, update `src/app/(marketing)/layout.tsx` metadata block (or move metadata to `(marketing)/page.tsx`):

```tsx
export const metadata: Metadata = {
  title: "Virtuna | Predict viral before you post",
  description: "AI that scores your TikToks before TikTok does. Simulate audiences, get a viral score in 30 seconds.",
  openGraph: { ... matching ... },
  twitter: { ... matching ... },
};
```

Copy is iterable per PROJECT.md — pick final wording during build, but the metadata API call shape is locked.

### Verify root layout title takes precedence at swap

Next.js metadata cascades: deeper segment wins. So `(marketing)/layout.tsx` metadata overrides root `app/layout.tsx`. Audit both at cutover; don't double-set fields that should match.

### Anchor-link strategy for `/#demo` etc.

Each section gets an `id` attribute on its `<section>` element matching its semantic name (`id="hero"`, `id="demo"`, `id="how-it-works"`, `id="surfaces"`, `id="science"`, `id="social-proof"`, `id="pricing"`, `id="final-cta"`). Hero CTA "See it work" anchors to `#demo`. Sitemap can reference anchor URLs for crawler hint, though search engines treat them as same-page.

**Confidence:** HIGH

---

## 8. Build Order / Phase Dependencies

### Parallelizable groups

| Group | Sections | Parallelizable? | Dependency |
|---|---|---|---|
| **A. Foundation** | Fix `(marketing)/layout.tsx` duplicate `<html>` bug; install Magic UI + Aceternity core components per STACK.md; set up `_components/` + `_data/` + `public/landing/` dirs | SERIAL (must finish before anything else) | None |
| **B. Hero shared primitives** | Spotlight + ShimmerButton + AnimatedShinyText + BorderBeam install + style customization (coral overrides per CLAUDE.md) | SERIAL after A; provides Hero AND Final CTA shared elements | A |
| **C. Independent sections (parallel)** | Pricing, Footer, Science (no shared components with hero beyond Spotlight which is in B) | PARALLELIZABLE | A + B |
| **D. Pipeline-derived sections (serial within group)** | How it works pipeline → Demo (Demo references pipeline stages narratively) | SERIAL within group; parallel with C | A + B |
| **E. Composed sections** | Three Surfaces (uses BentoGrid + Marquee + AnimatedList + NumberTicker) | After A + B | A + B |
| **F. Social proof** | Uses Marquee + AnimatedTestimonials + NumberTicker + shared Spotlight | After A + B | A + B |
| **G. Hero centerpiece (BehavioralSimulationHero Canvas)** | Custom Canvas viz per BRAND-BIBLE VIZ-01. Independent of other sections; can run in parallel with C/E/F. Highest-risk visual; allocate buffer. | PARALLEL with C/D/E/F | A |
| **H. Cutover** | Move v3 → root; delete legacy `landing/` section imports; fix metadata; add sitemap/robots; smoke test mobile + reduced-motion + Lighthouse | SERIAL after C through G all done | All |

### Component sharing graph (what gets installed once and reused)

```
SHARED:
  Spotlight        → Hero + Final CTA + Social proof backdrop (3 uses)
  ShimmerButton    → Hero + Final CTA + Pricing Pro CTA (3 uses)
  BorderBeam       → Hero + How-it-works active stage + Pricing Pro card + Numen Machines logo accent (4 uses)
  AnimatedShinyText → Hero eyebrow + Final CTA eyebrow (2 uses)
  Marquee          → Social proof logos + Social proof testimonials (if no AnimatedTestimonials) + Science citation chips + Three Surfaces competitor card (3-4 uses)
  MagicCard        → Three Surfaces cards + Demo sample picker (2 uses)
  NumberTicker     → Demo score + Three Surfaces prediction card + Science dataset stats + Social proof metrics (4 uses)
  BoxReveal        → Demo insight cards (1 use, narrow scope)
  AnimatedBeam     → How-it-works pipeline only (1 use)
  AnimatedList     → Demo insight cards + Three Surfaces brand-deals card (2 uses)
  DotPattern       → How-it-works backdrop + Science backdrop (2 uses)

SECTION-SPECIFIC:
  MultiStepLoader  → Demo only
  CardStack        → Demo only (if chosen over AnimatedList for insights)
  BackgroundBeams  → Demo backdrop only
  OrbitingCircles  → How-it-works active stage accent only
  TracingBeam      → How-it-works mobile vertical only
  StickyScroll     → Science only
  AnimatedTestimonials → Social proof only
```

### Recommended phase ordering for the planner

(Phase counts illustrative; planner can re-bucket)

1. **Phase 1 — Foundation:** layout bug fix, sitemap.ts + robots.ts, Magic UI / Aceternity install batch, asset directory scaffolding, mock data files (`_data/*.ts`), `/v3` route shell with placeholder sections rendering, fix `(marketing)/layout.tsx` metadata stale title
2. **Phase 2 — Hero + Final CTA bookend:** Shared Spotlight, ShimmerButton, AnimatedShinyText, BorderBeam patterns; static H1/subhead copy; build mirror Final CTA in the same phase to lock the bookend pattern. **DOES NOT include BehavioralSimulationHero canvas (defer to dedicated phase)**
3. **Phase 3 — BehavioralSimulationHero canvas:** Custom Canvas viz per BRAND-BIBLE VIZ-01 + VIZ-04. Highest-complexity; isolate. Can run in parallel with Phase 4 if team has 2 lanes.
4. **Phase 4 — Demo (viewport 2):** State machine, sample picker, MultiStepLoader, CardStack/AnimatedList result reveal. The differentiator section per FEATURES.md.
5. **Phase 5 — How it works pipeline:** AnimatedBeam horizontal (desktop) + TracingBeam vertical (mobile). Honor BRAND-BIBLE VIZ-02 (4 stages, one-shot, motion/react LazyMotion).
6. **Phase 6 — Three Surfaces bento:** BentoGrid + per-card animated backgrounds. Independent of pipeline.
7. **Phase 7 — Science:** StickyScroll + citation chip marquee + dataset stats. Content-research-bound (real paper titles needed).
8. **Phase 8 — Social proof:** Marquee logo wall + AnimatedTestimonials + NumberTicker metric bar, all under shared Spotlight backdrop.
9. **Phase 9 — Pricing:** 2-column shadcn Card table + monthly/yearly Tabs + FAQ accordion + BorderBeam on Pro.
10. **Phase 10 — Mobile + reduced-motion polish:** Per-section mobile tweaks (Section 10 below), reduced-motion audit across all sections, Lighthouse ≥ 90 verification.
11. **Phase 11 — Cutover:** v3 → root, delete legacy, sitemap, robots, metadata audit, redirect `/pricing` if kept.

Phases 3 + 4 are highest-risk; Phases 6 + 7 + 8 are most-parallelizable.

**Confidence:** HIGH

---

## 9. Mobile Responsive Architecture

### Breakpoint strategy

Use Tailwind defaults (codebase standard, no custom breakpoints declared in `@theme`):

| Breakpoint | Width | Use |
|---|---|---|
| (default / mobile) | < 640px | Single-column stack; reduce particle counts; collapse pipeline to vertical; AnimatedTestimonials collapses to static stack |
| `sm:` | ≥ 640px | Spacing increase; some side-by-side layouts |
| `md:` | ≥ 768px | Multi-column re-enables (e.g. 2-col pricing) |
| `lg:` | ≥ 1024px | Full desktop layout — pipeline horizontal, bento asymmetric, social proof spotlight backdrop full |
| `xl:` | ≥ 1280px | Optional max-content-width caps |

**Page max-width:** sections inside use `max-w-7xl mx-auto` (1280px) for content alignment — matches existing landing components convention.

### Per-section mobile strategy (concrete)

| # | Section | < 640px (mobile) | 640–1024px (tablet) | ≥ 1024px (desktop) |
|---|---|---|---|---|
| 1 | **Hero** | Centered H1 stacks above CTA stack; Canvas viz scales to ~60vw × 60vw above text; particle count drops to ~100 (per BRAND-BIBLE VIZ-03); Spotlight kept (pure CSS); BorderBeam still around centerpiece; ShimmerButton full-width on mobile only | H1 + CTA above viz; particle count ~200; Spotlight kept | Full Linear-style layout: viz can be side-by-side OR below depending on viz aspect; ~200-400 particles; Spotlight off-axis as designed |
| 2 | **Demo** | Sample picker vertical 2x2 grid; MultiStepLoader full-width; CardStack stacks vertically (Aceternity supports this natively); BackgroundBeams replaced by simple DotPattern (lighter) | 2x2 sample grid; loader inline | 4-column sample picker (horizontal); loader inline below; result cards in horizontal CardStack |
| 3 | **How it works** | `<HowItWorksMobile />` mounts — vertical `TracingBeam` with 4 stage nodes stacked; `AnimatedBeam` desktop hidden via `hidden lg:block` | Vertical TracingBeam OR small horizontal AnimatedBeam (judge by layout test); recommend keep vertical to `md` | Horizontal AnimatedBeam pipeline with OrbitingCircles on active stage; full BRAND-BIBLE VIZ-02 |
| 4 | **Three Surfaces** | BentoGrid collapses to single-column stack (Magic UI BentoGrid handles this with default Tailwind responsive grid classes); each card full-width; Marquee + AnimatedList + NumberTicker stay (lightweight) | 2-col grid (Prediction full width, 2 stacked); SAFE compromise | Asymmetric 1 large + 2 small per FEATURES.md |
| 5 | **Science** | StickyScroll degrades to linear flow (Aceternity StickyScroll falls back gracefully — content stacks below; sticky behavior disables); citation chip marquee kept; NumberTicker stats stack vertically | StickyScroll active with smaller right pane | Full sticky-left-content / sticky-right-citations layout |
| 6 | **Social proof** | Single shared Spotlight kept (CSS); logo Marquee single row (not stacked-2-row pattern — too tall on mobile); AnimatedTestimonials collapses to static stacked cards (3 visible); NumberTicker stats stack 3×1 vertically | Logo Marquee 2 rows; AnimatedTestimonials horizontal 3D-rotating; metrics 3-col | Full FEATURES.md spec — 2-row logo marquee + 3D testimonials + 3-col metric bar |
| 7 | **Pricing** | 2 Card stack vertically; Pro card BorderBeam still active; toggle stays above; FAQ Accordion full-width | Side-by-side 2-col tighter | Full 2-col table with side-by-side comparison; FAQ below |
| 8 | **Final CTA + Footer** | Same as Hero treatment scaled; 4-col footer collapses to 2x2 then 1-col below 480px | 4-col footer | 4-col footer; CTA mirror hero |

### Animation reductions on mobile

| Animation | Mobile behavior |
|---|---|
| Hero Canvas particles | 100-150 particles (vs 200-400 desktop) per BRAND-BIBLE VIZ-03 HERO-08 |
| Spotlight backdrop | KEEP — pure CSS, GPU-cheap |
| AnimatedBeam pipeline | DISABLED — replaced by TracingBeam vertical |
| OrbitingCircles | DISABLED on mobile (small screen makes orbits look cramped) |
| BorderBeam | KEPT (lightweight SVG path) |
| Marquee scrollers | KEPT (CSS transform, GPU-cheap) |
| AnimatedTestimonials 3D rotation | DISABLED on `<md` — fallback to static 3-card stack |
| StickyScroll pin behavior | DISABLED on `<md` — Aceternity handles this natively |
| Particles / BackgroundBeams ambient | DISABLED on `<sm` (replaced by static DotPattern) |
| NumberTicker count-up | KEPT (essentially free, single rAF) |
| MultiStepLoader | KEPT (already mobile-friendly per Aceternity docs) |
| CardStack | KEPT but stacks vertically natively |

Honor `prefers-reduced-motion` regardless of breakpoint — reduced-motion ALWAYS wins.

### Touch-action

Demo sample picker and Three Surfaces cards must use `touch-action: auto` (default). The hive-demo pattern at `src/components/hive-demo/index.tsx` explicitly notes this — Canvas areas must not block scroll. Apply same rule to `BehavioralSimulationHero` Canvas.

### Lighthouse mobile target

Per STACK.md ceiling: Lighthouse Performance ≥ 90 mobile. Spline would blow this; current plan (no Spline, Canvas viz + Magic UI + Aceternity) should comfortably hit 90+ if lazy-load and mobile reductions are honored.

**Confidence:** HIGH

---

## Sources

### Filesystem (live-read 2026-05-24)

| Path | Purpose |
|---|---|
| `src/app/page.tsx` | Verified DOES NOT exist |
| `src/app/layout.tsx` | Root layout pattern reference |
| `src/app/opengraph-image.tsx` | OG image convention (edge runtime) |
| `src/app/(marketing)/page.tsx` | Current landing — legacy section imports |
| `src/app/(marketing)/layout.tsx` | Marketing layout — duplicate `<html>` bug, stale title |
| `src/app/(marketing)/opengraph-image.tsx` | Duplicate OG (verify identical at cutover) |
| `src/app/(marketing)/pricing/page.tsx` | Standalone pricing — becomes redundant |
| `src/components/landing/` (13 files) | Legacy v2.x sections — soft-deprecate |
| `src/components/hive-demo/index.tsx:23-65` | Canonical lazy-load pattern (useInView + conditional render) |
| `src/components/hive/HiveCanvas.tsx`, `use-canvas-resize.ts`, `use-hive-animation.ts`, `hive-renderer.ts` | Canvas patterns to reuse for BehavioralSimulationHero per BRAND-BIBLE |
| `src/components/ui/` (33 components) | Reusable design system primitives |
| `src/components/motion/` (FadeIn, FadeInUp, SlideUp, StaggerReveal, HoverScale) | Existing scroll-reveal helpers |
| `src/components/primitives/GlassPanel.tsx` | Zero-config Raycast glass |
| `src/components/ui/marquee.tsx` | EXISTING Marquee — collision-check before installing Magic UI Marquee |
| `src/hooks/usePrefersReducedMotion.ts:1-29` | Reduced-motion hook (SSR-safe, defaults to true) |
| `src/hooks/useCountUp.ts` | EXISTING count-up — collision-check before installing Magic UI NumberTicker |

### Planning context

| Path | Used for |
|---|---|
| `.planning/PROJECT.md` | Scope, audience, page structure (8 sections), out-of-scope guardrails |
| `.planning/MILESTONE.md` | Worktree identity, animation core (Magic UI + Framer Motion + Aceternity UI + shadcn) |
| `.planning/research/STACK.md` | Install paths, bundle ceilings, integration pitfalls (Tailwind v4 oklch, Lightning CSS, motion vs framer-motion), reduced-motion patterns |
| `.planning/research/FEATURES.md` | Per-section component inventory, winning patterns, anti-patterns, mobile fallback hints |
| `BRAND-BIBLE.md` § Visual Metaphor Lock | VIZ-01 hero Canvas spec, VIZ-02 pipeline SVG spec, VIZ-03 scale affordances, VIZ-04 performance budget |
| `CLAUDE.md` | Tailwind v4 / Lightning CSS gotchas, Raycast surface rules (no translate-y hover, 6% borders, 12px card radius), server-by-default convention |

### Documentation references (Context7-verified per STACK.md)

| Library | Purpose |
|---|---|
| Magic UI (`magicui.design/docs/installation`) | Install path, component sources |
| Aceternity UI (`ui.aceternity.com/docs/install-tailwindcss`) | Tailwind v4 + React 19 compatibility |
| Next.js metadata files (`nextjs.org/docs/app/api-reference/file-conventions/metadata`) | sitemap.ts, robots.ts, opengraph-image conventions |
| `motion/react` LazyMotion (`motion.dev/docs/react-lazy-motion`) | Bundle minimization for SVG pipeline |
| `react-intersection-observer` | Lazy-load pattern (already in deps via hive-demo) |

---

*Last updated: 2026-05-24 — Landing v1 milestone, project research phase (ARCHITECTURE).*
