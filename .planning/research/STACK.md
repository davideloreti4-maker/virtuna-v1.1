# Technology Stack — Landing v1 (Additions Only)

**Project:** Virtuna — Landing v1 milestone
**Researched:** 2026-05-24
**Scope:** NEW additions on top of existing Virtuna stack (Next.js 16.1.5, React 19.2.3, Tailwind v4, framer-motion 12.29, motion 12.29, three 0.182, @react-three/fiber 9.5, @splinetool/react-spline 4.1, shadcn primitives, 36-component design system, coral #FF7F50, dark-mode only).
**Overall confidence:** HIGH — Context7-verified install paths for all 6 libraries; bundle sizes from Motion docs + GSAP forum + Bundlephobia.

---

## TL;DR

| Library | Status | Install command | Bundle (min+gzip) | Locked / Palette |
|---|---|---|---|---|
| **Magic UI** | LOCK | `npx shadcn@latest add @magicui/<name>` (per-component) | ~3-15 KB per component (copy-paste source) | Locked |
| **Aceternity UI** | LOCK | `npx shadcn@latest add https://ui.aceternity.com/registry/<name>.json` OR copy-paste | ~5-20 KB per component | Locked |
| **GSAP + @gsap/react** | PALETTE | `pnpm add gsap @gsap/react` | Core 27 KB + ScrollTrigger ~10 KB | On-demand only |
| **tsParticles (slim + react)** | PALETTE | `pnpm add @tsparticles/react @tsparticles/slim @tsparticles/engine` | ~28-35 KB gzip (slim bundle) | On-demand only |
| **Cult UI** | PALETTE | Same shadcn registry pattern (configure `components.json`) | ~3-10 KB per component | On-demand only |
| **Spline (already installed)** | LOCK if hero needs 3D | n/a | Runtime ~544 KB gzip + scene file | Lazy-load only |

**Do NOT add:** Lottie, Rive, drei full bundle, GSAP business plugins (still proprietary outside free tier), MorphSVG-as-package (use free tier).

---

## 1. Magic UI

**What it is:** A shadcn-style registry of 50+ animated landing-page components (Marquee, BentoGrid, Globe, AnimatedBeam, ShimmerButton, Particles, OrbitingCircles, DotPattern, MagicCard, NumberTicker, BorderBeam, Meteors, Ripple, AnimatedShinyText, BoxReveal, Lens, Safari/iPhone mockups, etc.). Copy-paste source into your `components/magicui/` directory via shadcn CLI.

**Tailwind v4 compatibility:** YES — verified. Components use Tailwind utility classes + animations declared via `@theme inline { --animate-X: ... }` in `globals.css`. No PostCSS plugin needed; works with `@tailwindcss/postcss` v4 already in your project.

**React 19 compatibility:** YES — Magic UI imports `motion/react` (motion.dev package), not legacy `framer-motion`. Already aligns with your motion dep (`motion@^12.29.2`).

**Install path (locked):**
```bash
# Per-component install (recommended over bulk add — keeps bundle minimal)
npx shadcn@latest add @magicui/marquee
npx shadcn@latest add @magicui/bento-grid
npx shadcn@latest add @magicui/animated-beam
npx shadcn@latest add @magicui/shimmer-button
npx shadcn@latest add @magicui/number-ticker
npx shadcn@latest add @magicui/border-beam
npx shadcn@latest add @magicui/orbiting-circles
npx shadcn@latest add @magicui/particles
npx shadcn@latest add @magicui/dot-pattern
npx shadcn@latest add @magicui/animated-shiny-text
```

The shadcn CLI resolves `@magicui/<name>` against the Magic UI registry automatically (no `components.json` registry config needed — `@magicui` is a built-in namespace in current shadcn). Component source lands in `components/magicui/`. Each component pulls in `cn`, `motion/react`, and any peer deps (e.g. `cobe` for Globe, ~3 KB).

**Components likely needed for Landing v1 (per page structure):**

| Section | Magic UI candidate | Rationale |
|---|---|---|
| Hero | BorderBeam, ShimmerButton, AnimatedShinyText | CTA polish + visual interest |
| Demo | NumberTicker, BoxReveal | Confidence-score reveal, scripted insight pop |
| How it works | AnimatedBeam | Linear-style stage connectors (4-stage pipeline) |
| Three Surfaces bento | BentoGrid, MagicCard | Native bento layout primitive |
| Science | Marquee, OrbitingCircles | Citation chip scroller, behavioral-signal orbit |
| Social proof | Marquee | Testimonial scroller (Linear pattern) |
| Pricing | BorderBeam | Pro tier emphasis |
| Background | DotPattern, Particles | Section backdrops |

**Integration friction (call out):**
- Components import `motion/react` — matches your `motion@^12.29.2` direct dep. Good.
- Components use Tailwind utilities + `cn()` from `@/lib/utils` — your project has `tailwind-merge` + `clsx` + uses this path. Good.
- Color customization: components default to `bg-white`, `text-foreground`, etc. You'll need to override with coral (`text-coral-500`, `bg-coral-500/10`) OR style via CSS variables. Source is copy-pasted so direct edits are fine.
- Animations declared in `@theme inline { --animate-marquee: ... }` block — append to your existing `globals.css` `@theme inline` block. Each component's docs lists the keyframe.
- Magic UI's default radius (12-16px), 6% borders, and dark-friendly hover states already align well with your Raycast tokens.

**Version snapshot:** Magic UI is registry-only (no npm package version to pin). Last upstream README commit in registry-content terms: 2026-Q1 active. `magicui-cli` (legacy npm) is at 0.1.6 (deprecated — use shadcn CLI instead).

Sources:
- [Magic UI install docs](https://magicui.design/docs/installation) — Context7 verified
- [shadcn registry namespace pattern](https://github.com/magicuidesign/magicui) — Context7 verified

**Confidence:** HIGH

---

## 2. Aceternity UI

**What it is:** ~200 React + Tailwind + Motion components, often more visually maximal than Magic UI (Spotlight, BackgroundBeams, BackgroundGradientAnimation, AuroraBackground, TracingBeam, Vortex, Lamp, Meteors, HeroParallax, MovingBorder, etc.). Linear/Raycast-leaning subset (Lamp, Spotlight, MovingBorder, Tabs, BackgroundBeams) fits this brief; avoid the maximal subset (Aurora, BackgroundGradientAnimation, Vortex) — too colorful for the dark/restrained brief.

**Tailwind v4 compatibility:** YES — explicit support. Aceternity's "Install Tailwind CSS v4" doc page exists at `ui.aceternity.com/docs/install-tailwindcss` and shows the v4 install (`@import "tailwindcss"; @theme inline { ... }`) which is exactly the pattern you already use. Animations declared via `@theme inline { --animate-X: keyframes... }` — same Tailwind v4 idiom as Magic UI.

**React 19 compatibility:** YES — but with a hard caveat. Aceternity originally targeted `framer-motion`; current docs explicitly recommend switching to the `motion` package (motion.dev) for React 19 compatibility. **Your project already uses both `framer-motion@^12.29.3` AND `motion@^12.29.2`** — the recommended path is to use the `motion/react` import for ALL new Aceternity components, matching Magic UI's import path. Add `motion` overrides in `package.json` ONLY if you hit version-mismatch errors (you should not, since both deps are already at v12.29+).

**Install path (locked):**
```bash
# Peer deps already satisfied in your project (motion, clsx, tailwind-merge present).
# Per-component install via the Aceternity shadcn registry:
npx shadcn@latest add https://ui.aceternity.com/registry/lamp.json
npx shadcn@latest add https://ui.aceternity.com/registry/spotlight.json
npx shadcn@latest add https://ui.aceternity.com/registry/background-beams.json
npx shadcn@latest add https://ui.aceternity.com/registry/moving-border.json
npx shadcn@latest add https://ui.aceternity.com/registry/tracing-beam.json
npx shadcn@latest add https://ui.aceternity.com/registry/hero-parallax.json
```
Some components are still copy-paste only (no registry JSON yet) — those need manual paste from the docs page into `components/ui/` or `components/aceternity/`.

**Components for Landing v1:**

| Section | Aceternity candidate | Why |
|---|---|---|
| Hero | Spotlight, Lamp | Linear-style ambient gradient backdrop (restrained, not Aurora) |
| Demo | MovingBorder, BackgroundBeams | Frame highlighting + subtle backdrop while insight reveals |
| How it works | TracingBeam | Vertical scroll-tracked stroke (alternative to AnimatedBeam for vertical pipeline) |
| Science | StickyScroll, ContainerScroll | Scroll-pinned content reveal for behavioral research moat |
| Social proof | InfiniteMovingCards | Testimonial marquee (overlap w/ Magic UI Marquee — pick one) |
| Pricing | HoverEffect, BorderMagic | Card hover lift (DO NOT use translate-y per Raycast rules — choose Aceternity components that animate border/shadow only) |

**Integration friction:**
- Some components (Aurora, BackgroundGradientAnimation, Vortex, WavyBackground) are too colorful/maximal for the Raycast brief. Skip them. Pick the structural/ambient subset (Spotlight, Lamp, BackgroundBeams, TracingBeam, MovingBorder).
- Card hover effects often include `translate-y` lift — your brand bible forbids this (Raycast rule: cards do NOT lift on hover). Either edit the source after copy-paste, OR choose components without translate (Spotlight, MovingBorder, BorderMagic don't translate; HoverEffect does — patch it).
- Many Aceternity components use `bg-black`, `bg-neutral-900`, or hard-coded hex. Your design tokens use `#07080a` (background) and `#1a1b1e` (background-elevated). Replace hard-coded colors with your tokens (`bg-background`, `bg-background-elevated`) after copy-paste.
- Spotlight component uses an SVG noise mask — confirm Lightning CSS doesn't strip it (mask-image CAN get stripped). If broken, apply via inline `style={{ maskImage: ... }}` per your existing Lightning CSS workaround pattern in `CLAUDE.md`.
- Reduced-motion: most Aceternity components don't honor `prefers-reduced-motion` natively. Wrap or patch with `useReducedMotion()` from `motion/react` to match the standard set in `BRAND-BIBLE.md` § Visual Metaphor Lock.

**Version snapshot:** Registry-only, no single npm version. Active development (Tailwind v4 doc page is current as of 2026-Q1).

Sources:
- [Aceternity Tailwind v4 install](https://ui.aceternity.com/docs/install-tailwindcss) — Context7 verified
- [Aceternity React 19 + motion compat](https://ui.aceternity.com/docs/add-utilities) — Context7 verified
- [Aceternity components catalog](https://ui.aceternity.com/components) — Context7 verified

**Confidence:** HIGH

---

## 3. GSAP + @gsap/react

**Status:** PALETTE — pull in **only if** a section's choreography exceeds `motion/react` ergonomics. Magic UI + Aceternity + `motion/react` cover ~90% of needs.

**License (critical):** GSAP went **100% free for commercial use in April 2025** after Webflow's October 2024 acquisition. ALL plugins (ScrollTrigger, SplitText, MorphSVG, DrawSVG, MotionPath, Flip) are free for any commercial project. No more $99/$199/year Club GreenSock tier required. Source: [Webflow announcement](https://webflow.com/updates/gsap-becomes-free) (April 2025).

This **overrides** the GSAP-rejection note in `BRAND-BIBLE.md` § Visual Metaphor Lock (which was written 2026-05-10 but cites pre-2025 license concerns). The license blocker is gone; bundle-size is the only remaining consideration.

**Install:**
```bash
pnpm add gsap @gsap/react
```

**Current versions (verified `npm view`):**
- `gsap@3.15.0` (latest stable)
- `@gsap/react@2.1.2` (React integration hook `useGSAP`)
- `gsap@3.0.0-beta.11` exists as a `next` tag — DO NOT use; v3.15 is the current stable.

**Bundle impact (gzipped):**
- GSAP core: ~27 KB (smallest pro-grade JS animation lib)
- + ScrollTrigger: ~+10 KB
- + SplitText: ~+5 KB (rewritten 2025, 50% smaller)
- Total typical landing usage (core + ScrollTrigger + SplitText): **~42 KB gzip**

For comparison: `motion/react` with `LazyMotion + m + domAnimation` = ~15 KB gzip. So GSAP costs ~27 KB MORE than the motion baseline for the same scroll-driven work.

**When to prefer GSAP over motion/react:**

| Use case | Tool | Rationale |
|---|---|---|
| Section reveal on scroll, simple stagger | motion/react | Lighter, already imported |
| Complex timeline (multi-element, scrub-linked) | GSAP | `gsap.timeline()` ergonomics beat motion sequences |
| Pin-scroll with content swap (Stripe-style) | GSAP ScrollTrigger `pin: true` | motion/react has no pin equivalent |
| Character-by-character text reveal | GSAP SplitText | motion has no built-in SplitText (you'd hand-roll) |
| Path morphing | GSAP MorphSVG | motion has no equivalent |
| Single-element animation (hover, viewport-enter) | motion/react | GSAP is overkill |

**Suggested use for Landing v1:** Only the Demo section (viewport 2) and possibly the How-it-works pipeline (viewport 3) may justify GSAP. Most other sections fit `motion/react` (already locked).

**React integration pattern:**
```tsx
'use client';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useRef } from 'react';

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function DemoSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 70%',
        toggleActions: 'play none none reverse',
      },
    })
      .from('.demo-stage-1', { opacity: 0, y: 20, duration: 0.5 })
      .from('.demo-stage-2', { opacity: 0, y: 20, duration: 0.5 }, '-=0.2');
  }, { scope: containerRef });

  return <div ref={containerRef}>{/* ... */}</div>;
}
```

`useGSAP` handles cleanup automatically (kills tweens on unmount), preventing the classic GSAP-in-React memory leak. Always import from `gsap/ScrollTrigger` (not the deprecated `gsap/dist/ScrollTrigger` CommonJS path) for ESM tree-shaking.

**Reduced-motion:** Use `gsap.matchMedia` with `(prefers-reduced-motion: reduce)` query, OR check `usePrefersReducedMotion()` (existing hook in `src/hooks/`) and skip the timeline.

Sources:
- [Webflow makes GSAP free](https://webflow.com/updates/gsap-becomes-free) — official, April 2025
- [GSAP useGSAP hook docs](https://gsap.com/resources/React/) — Context7 verified
- [GSAP forum: core size ~27 KB](https://gsap.com/community/forums/topic/12150-size-of-libraries/)

**Confidence:** HIGH

---

## 4. tsParticles

**Status:** PALETTE — pull in **only if** a specific section needs a particle/confetti effect that the existing Canvas-2D hive pattern (`src/components/hive/`) can't deliver. The existing Canvas approach is proven in your codebase (1300+ nodes at 60fps) and adds zero bundle weight beyond hand-written code.

**Install (if used):**
```bash
pnpm add @tsparticles/react @tsparticles/slim @tsparticles/engine
```

**Current versions (verified `npm view`):**
- `@tsparticles/react@3.0.0` (note: `npm view @tsparticles/react version` returned `3.0.0`-era; full ecosystem aligned at `4.0.5`)
- `@tsparticles/slim@4.0.5`
- `@tsparticles/engine@4.0.5`
- `@tsparticles/basic@4.0.5` (smaller than slim, fewer features)
- `@tsparticles/all@4.0.5` (everything — prototypes only)

**Bundle choice (per official docs):**

| Package | Use when | Bundle (min+gzip, approx) |
|---|---|---|
| `@tsparticles/basic` | Single simple effect (one shape, one motion) | ~22 KB |
| `@tsparticles/slim` | **Recommended default** — most features | ~28-35 KB |
| `tsparticles` (full) | Multiple effects, plugins | ~50+ KB |
| `@tsparticles/all` | Prototyping | ~80+ KB — avoid in prod |

(Bundlephobia exact numbers for 4.0.5 not retrievable mid-research; sizes extrapolated from Motion-comparison forum reports and v3.x precedent.)

**Next.js integration pattern (SSR-safe):**
```tsx
'use client';
import { useEffect, useState, useMemo } from 'react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import type { ISourceOptions } from '@tsparticles/engine';

export function HeroParticles() {
  const [init, setInit] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => setInit(true));
  }, []);

  const options: ISourceOptions = useMemo(() => ({
    fpsLimit: 60,
    particles: {
      number: { value: 60 },
      color: { value: '#FF7F50' }, // coral
      opacity: { value: 0.4 },
      size: { value: { min: 1, max: 3 } },
      move: { enable: true, speed: 0.5, outModes: { default: 'out' } },
    },
    detectRetina: true,
  }), []);

  if (!init) return null;
  return <Particles id="hero-particles" options={options} />;
}
```

Wrap in `dynamic(() => import('./HeroParticles'), { ssr: false })` from the parent server component to fully skip SSR work.

**Reduced-motion:** Set `options.fpsLimit = 1` or skip render entirely when `usePrefersReducedMotion()` returns true. tsParticles has no native reduced-motion hook.

**When NOT to use:**
- If you only need ambient floating points behind the hero → use existing hive Canvas pattern OR Magic UI `Particles` component (lighter, ~3 KB hand-written WebGL via cobe-style canvas).
- Magic UI's `Particles` component is a 100-line Canvas 2D implementation; tsParticles is overkill for simple ambient effects.

**Suggested decision rule:** Default to Magic UI `Particles` for hero ambience. Add tsParticles ONLY if you need a specific preset (e.g. confetti success state on signup CTA hover, links-between-nodes graph aesthetic).

Sources:
- [tsParticles React docs](https://github.com/tsparticles/tsparticles/tree/main/wrappers/react) — Context7 verified
- [tsParticles bundle choice guide](https://particles.js.org/) — Context7 verified

**Confidence:** MEDIUM (bundle sizes extrapolated; install path verified)

---

## 5. Cult UI

**Status:** PALETTE — narrow fit. Cult UI's signature components (TextureCard, TextureButton, ShaderLensBlur, BackgroundImageTexture, hero-color-panels) lean **paper/grain/texture/shader** aesthetic. That's an interesting differentiator but **off-brief** for the Linear/Raycast clean-minimal anchor. Pull in selectively.

**Fit assessment:**
- Linear/Raycast aesthetic = clean, dark, NO texture, NO grain, NO colored shaders, transparent surfaces, 6% borders.
- Cult UI's strengths = texture overlays, shader effects, paper-grain backgrounds.
- **Conflict.** Most Cult UI components would violate the brief.

**Components possibly worth considering for a one-off accent:**

| Cult UI component | Use case | Caveat |
|---|---|---|
| `ShaderLensBlur` | Hero backdrop blur halo | Test against Raycast-clean brief — likely too maximal |
| `TerminalAnimation` | Demo section "engine thinking" visualization | Could work if styled with coral + #07080a |
| `TextureCard` | NOT recommended | Adds grain — violates Raycast clean aesthetic |
| `TextureButton` | NOT recommended | Same |

**Install path (if used):**
```bash
# Step 1: Configure Cult registry in components.json
# (Add "@cult-ui": "https://cult-ui.com/r/{name}.json" to "registries" field)

# Step 2: Install specific component
npx shadcn@beta add @cult-ui/terminal-animation
# or
npx shadcn@latest add https://cult-ui.com/r/shader-lens-blur.json
```

Note: Cult UI requires shadcn CLI v3 beta (`npx shadcn@beta`) for the named-registry syntax; the direct-URL syntax works on stable shadcn.

**Tailwind v4 compatibility:** YES — current docs show v4 patterns; components use the same `@theme inline` keyframe declaration pattern as Magic UI / Aceternity.

**Peer deps:** Some Cult UI shader components require `@paper-design/shaders-react` (v0.0.76 as of research; pre-1.0, may have breaking changes). Bundle adds ~30-60 KB (shader runtime). Account for this if pulled in.

**Recommendation:** Skip Cult UI for Landing v1 unless a section explicitly justifies a texture/shader treatment (none in the current 7-8 section plan do). Revisit in a future milestone if brand aesthetic evolves toward "premium grain" territory.

Sources:
- [Cult UI install](https://www.cult-ui.com/docs/installation) — Context7 verified
- [Cult UI components](https://www.cult-ui.com/docs/components) — Context7 verified

**Confidence:** HIGH (fit assessment); MEDIUM (peer dep stability)

---

## 6. Spline (already installed @ 4.1.0)

**Status:** LOCK — pull in **only if** the hero needs a 3D centerpiece beyond the Canvas-2D behavioral-simulation visual already specified in `BRAND-BIBLE.md` § Visual Metaphor Lock. The locked hero concept (VIZ-01) is a Canvas particle aggregation, NOT a Spline scene. Spline is a backup option if the canvas approach is rejected during execution.

**Already in your `package.json`:**
- `@splinetool/react-spline@4.1.0`
- (peer) `@splinetool/runtime@1.12.95` — NOT in package.json. **Must add** if Spline is actually used:

```bash
pnpm add @splinetool/runtime
```

(Bundle size info: runtime is ~544 KB gzip — the heavyweight bit. The `@splinetool/react-spline` wrapper itself is ~3 KB.)

**Best-practice install for hero (Next.js 16 + App Router):**

```tsx
// app/(landing)/_components/HeroSpline.tsx
'use client';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const Spline = dynamic(
  () => import('@splinetool/react-spline/next'), // SSR-blurred-placeholder variant
  { ssr: false, loading: () => <HeroFallback /> }
);

function HeroFallback() {
  return (
    <div
      className="w-full h-full bg-background"
      style={{ background: 'radial-gradient(circle at 50% 30%, rgba(255,127,80,0.15), transparent 60%)' }}
      aria-hidden="true"
    />
  );
}

export function HeroSpline() {
  return (
    <div className="absolute inset-0 -z-10">
      <Suspense fallback={<HeroFallback />}>
        <Spline scene="https://prod.spline.design/<your-scene-id>/scene.splinecode" />
      </Suspense>
    </div>
  );
}
```

**File-size budget:**
- Spline runtime JS: ~1.9 MB raw / ~544 KB gzip. **This blows past your `motion/react` 45 KB budget by 10x.**
- Scene `.splinecode` file: 50 KB - 5 MB depending on complexity. Keep under 500 KB.
- CPU time on scene mount: 5-18 seconds reported on desktop for non-optimized scenes.

**Hard rules if Spline ships:**
1. **Lazy-load via `dynamic(... { ssr: false })`**. No exceptions.
2. **IntersectionObserver-gated mount.** Don't mount Spline until hero is 50%+ in viewport. (Even with `ssr: false`, mounting on first paint hurts LCP.)
3. **Fallback to a static coral gradient backdrop** for `prefers-reduced-motion`, `connection: 'slow-2g'`, and `prefers-data-saver`.
4. **No more than 1 Spline scene per landing** — multiple kills Lighthouse score.
5. **Scene file under 500 KB.** Run Spline's built-in performance panel before export. Reduce textures, mesh count, materials.
6. **Lighthouse Performance must stay ≥ 90.** Spline-on-hero typically takes a 30-40-point hit if not optimized; the case study in DEV.to went from 30 → 90 only after aggressive lazy-loading.

**Better alternative for this brief:** The Canvas-2D behavioral-simulation hero locked in `BRAND-BIBLE.md` § Visual Metaphor Lock costs ~30 KB and proves at 60fps with 1300+ nodes (existing `HiveCanvas.tsx`). Use Spline ONLY if the canvas option is rejected at execution time.

Sources:
- [react-spline README](https://github.com/splinetool/react-spline) — Context7 verified
- [Spline optimization case study](https://dev.to/tolumen/optimizing-web-performance-how-lazy-loading-spline-assets-took-our-build-from-30-to-90-in-4ne2)
- [Spline scene optimization](https://docs.spline.design/exporting-your-scene/how-to-optimize-your-scene)

**Confidence:** HIGH

---

## 7. Magic UI vs Aceternity UI — Overlap Map

Both libraries are shadcn-style registries with motion/react + Tailwind v4 components. Significant overlap. Decision rule below.

### Direct overlaps

| Effect type | Magic UI | Aceternity UI | Default pick | Rationale |
|---|---|---|---|---|
| Testimonial marquee | `Marquee` | `InfiniteMovingCards` | **Magic UI** | Lighter, more configurable (pauseOnHover, vertical, reverse) |
| Bento grid | `BentoGrid` + `MagicCard` | `BentoGrid` | **Magic UI** | Native primitive + cleaner card hover (no translate-y) |
| Background dots | `DotPattern` | `GridBackground` / `DotBackground` | **Magic UI** | Smaller, easier dark-mode override |
| Particles | `Particles` (cobe-style Canvas) | `Sparkles` / `Vortex` | **Magic UI** | Way lighter — Aceternity Sparkles uses tsparticles internally |
| Animated beam | `AnimatedBeam` (horizontal SVG path) | `TracingBeam` (vertical scroll-tracked) | **Both** | Magic UI for horizontal pipeline (How it works), Aceternity for vertical scroll progress |
| Button shimmer/glow | `ShimmerButton`, `BorderBeam` | `MovingBorder`, `HoverBorderGradient` | **Magic UI** | `ShimmerButton` + `BorderBeam` cleanly compose; Aceternity's MovingBorder has more visual weight |
| Text reveal | `BoxReveal`, `AnimatedShinyText`, `TypingAnimation` | `TextGenerateEffect`, `TextHoverEffect` | **Magic UI** | More variants, easier to mix |
| Scroll-pinned content | (none) | `StickyScroll`, `ContainerScroll`, `HeroParallax` | **Aceternity** | Magic UI doesn't have a pin-scroll equivalent |
| Ambient hero backdrop | `Meteors`, `Ripple`, `GridBeams` | `Spotlight`, `Lamp`, `BackgroundBeams` | **Aceternity** | Spotlight + Lamp are signature Linear-aesthetic; Magic UI lacks an equivalent |
| 3D card tilt | (none) | `3DCard`, `CardContainer` | **Aceternity** | Magic UI doesn't have one |
| Globe | `Globe` (cobe-based) | `World` (three.js-based) | **Magic UI** | Cobe is ~5 KB; Aceternity's World drags in three.js bundle |
| 3D-feeling number reveal | `NumberTicker` | (none) | **Magic UI** | Aceternity has no equivalent |

### Default selection rule

- **Magic UI** for: marquee, bento, dots, particles, animated beam (horizontal), buttons, text effects, number ticker, globe. **Default to Magic UI for everything they both cover.**
- **Aceternity UI** for: Spotlight (hero ambient backdrop), Lamp (alternative hero glow), TracingBeam (vertical scroll progress), StickyScroll / ContainerScroll (Science / How-it-works pin-scroll), HeroParallax (Three Surfaces bento alternative). **Use Aceternity for what Magic UI doesn't have.**

### Why default to Magic UI?

1. Lighter per-component (Magic UI sources are shorter — typically 100-200 lines).
2. Less Aceternity-style "wow effect" maximalism (Aceternity components often add multiple gradient layers + glow that conflict with Raycast clean-dark brief).
3. Magic UI components tend to leave hover state to the consumer (you choose lift vs. fade); Aceternity components often hard-code `translate-y` on hover (forbidden per `CLAUDE.md` Raycast rules).
4. Magic UI's color tokenization is cleaner (most components accept `--color-*` CSS variables; Aceternity often hard-codes `bg-black` / `bg-neutral-900`).

### Total component count expected for Landing v1

- Magic UI installs: ~12-15 components (Marquee, BentoGrid, MagicCard, AnimatedBeam, ShimmerButton, BorderBeam, NumberTicker, AnimatedShinyText, BoxReveal, DotPattern, Particles, OrbitingCircles, plus 2-3 more).
- Aceternity installs: ~3-5 components (Spotlight, Lamp, TracingBeam, StickyScroll or HeroParallax).
- GSAP: 1 plugin (ScrollTrigger), optional second (SplitText).
- tsParticles: 0 unless a specific section justifies it.
- Cult UI: 0.

---

## Installation Summary (consolidated)

```bash
# === Phase 1: Locked core (do this first) ===
# Magic UI per-component (install as each component is needed by section)
npx shadcn@latest add @magicui/marquee
npx shadcn@latest add @magicui/bento-grid
npx shadcn@latest add @magicui/animated-beam
npx shadcn@latest add @magicui/shimmer-button
npx shadcn@latest add @magicui/border-beam
npx shadcn@latest add @magicui/number-ticker
npx shadcn@latest add @magicui/box-reveal
npx shadcn@latest add @magicui/dot-pattern
npx shadcn@latest add @magicui/particles
npx shadcn@latest add @magicui/orbiting-circles
npx shadcn@latest add @magicui/animated-shiny-text
npx shadcn@latest add @magicui/magic-card

# Aceternity UI per-component
npx shadcn@latest add https://ui.aceternity.com/registry/spotlight.json
npx shadcn@latest add https://ui.aceternity.com/registry/lamp.json
npx shadcn@latest add https://ui.aceternity.com/registry/tracing-beam.json
npx shadcn@latest add https://ui.aceternity.com/registry/sticky-scroll-reveal.json
# (copy-paste from docs for components without registry JSON)

# === Phase 2: Palette (only when a section justifies it) ===

# GSAP (only if Demo or How-it-works section choreography exceeds motion/react)
pnpm add gsap@^3.15.0 @gsap/react@^2.1.2

# tsParticles (only if hero needs richer particle behavior than Magic UI Particles)
pnpm add @tsparticles/react@^3.0.0 @tsparticles/slim@^4.0.5 @tsparticles/engine@^4.0.5

# Spline runtime (only if hero adopts a 3D Spline scene — peer dep for already-installed @splinetool/react-spline)
pnpm add @splinetool/runtime@^1.12.95

# Cult UI (skip unless brand brief evolves)
# Not recommended for Landing v1
```

### Total bundle ceiling estimate (worst case, ALL palette items pulled in)

| Library | Bundle (min+gzip) |
|---|---|
| Magic UI (~12 components, source-copied) | ~50-80 KB total |
| Aceternity UI (~4 components, source-copied) | ~30-50 KB total |
| motion (LazyMotion + m + domAnimation, already imported) | ~15 KB |
| GSAP core + ScrollTrigger | ~37 KB |
| tsParticles slim + react wrapper | ~35 KB |
| Spline runtime | ~544 KB (lazy-loaded only) |
| cobe (for Globe component, if used) | ~5 KB |
| **Sub-total NON-Spline** | **~170-220 KB gzip** |
| **With Spline** | **~720-770 KB gzip** |

**Target:** ~150-200 KB gzip total motion/animation JS for the landing page (excluding Spline if used). Spline must be lazy + IntersectionObserver-gated.

---

## Alternatives Considered (and why not)

| Alternative | Rejected because |
|---|---|
| Lottie | Out of scope per `PROJECT.md`; no animator pipeline; 50+ KB per animation |
| Rive | Out of scope per `PROJECT.md`; same as Lottie |
| Three.js + @react-three/fiber (full hero) | Already in your bundle; reserve for in-app prediction viz, NOT landing. 600 KB+ bundle even tree-shaken kills LCP |
| Pure CSS keyframes | Inconsistent with `motion/react` standard already locked across the design system (Pitfall 5 in BRAND-BIBLE.md) |
| Anime.js | Smaller than GSAP (~14 KB) but lacks ScrollTrigger ergonomics and React integration polish; motion/react covers same ground |
| React Spring | Spring-physics API differs from existing `motion/react` patterns; would fragment animation vocab |
| Vanta.js | Three.js-based, heavy, brand mismatch (maximalist) |
| Tailwind plugins for animations (`tailwindcss-animate`) | You already have `tw-animate-css@1.4.0`; sufficient for utility-level animations |
| react-three-fiber + drei for hero | Bundle bloat (R3F + drei = 200+ KB even tree-shaken). Canvas-2D pattern from `HiveCanvas.tsx` is 30 KB. Use R3F only if scene complexity justifies it (it does not for Landing v1) |

---

## Integration Pitfalls (specific to YOUR codebase)

1. **Tailwind v4 oklch in @theme** (per `CLAUDE.md`): when Magic UI / Aceternity components declare custom keyframes via `@theme inline`, do NOT use oklch for very dark colors (L < 0.15). Use hex. Affects: any `--color-*` referenced inside `@theme inline { ... }` for very dark accent surfaces.

2. **Lightning CSS strips backdrop-filter** (per `CLAUDE.md`): Aceternity components that use glass effects (Spotlight noise mask, BackgroundBeams blur) may break. Apply `backdropFilter` / `maskImage` via React inline `style={{ ... }}` per your existing `GlassPanel` pattern.

3. **`motion` vs `framer-motion` import paths** (per `BRAND-BIBLE.md` Pitfall 5): ALL new components must import from `motion/react`, not `framer-motion`. Both deps are installed but `framer-motion` is legacy. Add a lint check or accept the two existing legacy imports in `src/components/app/simulation/*.tsx` and migrate later.

4. **Card hover `translate-y` forbidden** (per `CLAUDE.md` Raycast rules): patch any Aceternity / Magic UI component source that animates `translate-y` on hover. Use `bg-white/[0.02]` only.

5. **Reduced-motion**: Most third-party components don't honor `prefers-reduced-motion`. Wrap with your existing `usePrefersReducedMotion()` hook (`src/hooks/usePrefersReducedMotion.ts`) or use `useReducedMotion()` from `motion/react`. Standard set in `BRAND-BIBLE.md` § Visual Metaphor Lock.

6. **Dev cache hygiene** (per `CLAUDE.md`): when Tailwind v4 keyframe additions in `globals.css` don't render, kill dev server + clear `.next/` + `node_modules/.cache/` + browser cache.

7. **shadcn registry namespace collisions**: Magic UI uses `@magicui/`, Cult UI uses `@cult-ui/`, Aceternity uses direct URLs. Adding the Cult UI registry to `components.json` is required for the `@cult-ui/` syntax to work; otherwise use the direct URL form. Magic UI's `@magicui/` works out of the box on stable shadcn.

---

## Sources

- [Magic UI install docs](https://magicui.design/docs/installation) — Context7 `/magicuidesign/magicui` HIGH
- [Magic UI components catalog](https://magicui.design/docs/components) — Context7 HIGH
- [Aceternity Tailwind v4 install](https://ui.aceternity.com/docs/install-tailwindcss) — Context7 `/websites/ui_aceternity` HIGH
- [Aceternity React 19 + motion config](https://ui.aceternity.com/docs/add-utilities) — Context7 HIGH
- [Aceternity components](https://ui.aceternity.com/components) — Context7 HIGH
- [GSAP installation](https://gsap.com/docs/v3/Installation) — Context7 `/llmstxt/gsap_llms_txt` HIGH
- [GSAP useGSAP React hook](https://gsap.com/resources/React/) — Context7 HIGH
- [Webflow makes GSAP 100% free](https://webflow.com/updates/gsap-becomes-free) — official April 2025 HIGH
- [GSAP forum: bundle size](https://gsap.com/community/forums/topic/12150-size-of-libraries/) — MEDIUM
- [tsParticles React integration](https://github.com/tsparticles/tsparticles/tree/main/wrappers/react) — Context7 `/tsparticles/tsparticles` HIGH
- [tsParticles bundle choice](https://particles.js.org/) — Context7 HIGH
- [Cult UI installation](https://www.cult-ui.com/docs/installation) — Context7 `/nolly-studio/cult-ui` HIGH
- [Cult UI components](https://www.cult-ui.com/docs/components) — Context7 HIGH
- [react-spline README](https://github.com/splinetool/react-spline) — Context7 `/splinetool/react-spline` HIGH
- [Spline scene optimization](https://docs.spline.design/exporting-your-scene/how-to-optimize-your-scene) — official HIGH
- [Spline lazy-load case study (DEV.to)](https://dev.to/tolumen/optimizing-web-performance-how-lazy-loading-spline-assets-took-our-build-from-30-to-90-in-4ne2) — MEDIUM
- [Motion LazyMotion bundle docs](https://motion.dev/docs/react-lazy-motion) — official HIGH
- [Motion reduce bundle size](https://motion.dev/docs/react-reduce-bundle-size) — official HIGH

---

*Last updated: 2026-05-24 — Landing v1 milestone, project research phase*
