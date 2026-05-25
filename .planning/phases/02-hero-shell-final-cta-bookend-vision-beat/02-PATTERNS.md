# Phase 2: Hero Shell + Final CTA Bookend + Vision Beat - Pattern Map

**Mapped:** 2026-05-25
**Files analyzed:** 9 (5 new components, 2 modified files, 2 new stub routes)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/(marketing)/_components/HeroSection.tsx` | component | request-response | `src/components/landing/hero-section.tsx` | role-match |
| `src/app/(marketing)/_components/HeroBookend.tsx` | component | request-response | `src/components/landing/hero-section.tsx` | role-match |
| `src/app/(marketing)/_components/FinalCtaSection.tsx` | component | request-response | `src/components/landing/cta-section.tsx` | role-match |
| `src/app/(marketing)/_components/VisionBeat.tsx` | component | request-response | `src/components/landing/testimonial-quote.tsx` | role-match |
| `src/app/(marketing)/_components/LandingFooter.tsx` | component | request-response | `src/components/layout/footer.tsx` | exact |
| `src/app/(marketing)/v3/page.tsx` | route | request-response | `src/app/(marketing)/v3/page.tsx` (self — modify) | exact |
| `src/app/sitemap.ts` | config | batch | `src/app/sitemap.ts` (self — modify) | exact |
| `src/app/(marketing)/privacy/page.tsx` | route | request-response | `src/app/(marketing)/coming-soon/page.tsx` | role-match |
| `src/app/(marketing)/terms/page.tsx` | route | request-response | `src/app/(marketing)/coming-soon/page.tsx` | role-match |

---

## Pattern Assignments

### `src/app/(marketing)/_components/HeroSection.tsx` (component, client)

**Analog:** `src/components/landing/hero-section.tsx` (structure) + `src/app/(marketing)/_components/SectionShell.tsx` (section wrapper contract)

**Directive + imports pattern** (lines 1-8 of analog `hero-section.tsx`):
```tsx
"use client";

import { cn } from "@/lib/utils";
// Phase 2 adds:
import { useReducedMotion } from "motion/react";
import { motionTokens } from "@/app/(marketing)/motionTokens";
```

**Critical import rule:** All animation imports MUST use `motion/react`, never `framer-motion`.

**Section wrapper pattern** (from `SectionShell.tsx` lines 50-65):
```tsx
<section
  id="hero"
  aria-label="Hero section"
  className="relative bg-background min-h-[100dvh] py-12 px-6"
>
  <div className="max-w-7xl mx-auto flex flex-col items-center justify-center text-center h-full">
    {/* content */}
  </div>
</section>
```

Key: `isHero` → `min-h-[100dvh]` (iOS Safari fix). Phase 2 absorbs this shell directly — HeroSection replaces the `<SectionShell id="hero" isHero />` placeholder in `v3/page.tsx`.

**backdropFilter inline style pattern** (from `LandingHeader.tsx` lines 42-47):
```tsx
style={{
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
}}
```
All backdrop-filter usage (Spotlight, GlassPanel) MUST use inline `style={}`, never Tailwind class. Lightning CSS strips `backdrop-filter` in prod builds.

**Reduced-motion guard pattern** (from `src/components/motion/fade-in.tsx` lines 3, 36-39):
```tsx
import { useReducedMotion } from "motion/react";

const prefersReduced = useReducedMotion();
if (prefersReduced) {
  return <div className={className}>{children}</div>;
}
```
Aceternity + Magic UI components (Spotlight, WordRotate, BorderBeam, AnimatedShinyText) do NOT inherit `MotionConfig reducedMotion="user"` — each needs its own `useReducedMotion()` guard.

**motionTokens consumption pattern** (from `src/app/(marketing)/motionTokens.ts`):
```ts
import { motionTokens } from "@/app/(marketing)/motionTokens";

// Hero entrance
duration: motionTokens.durations.hero   // 0.8s
ease: motionTokens.easings.outQuart     // [0.165, 0.84, 0.44, 1]
threshold: motionTokens.viewportThresholds.hero  // 0 (fires immediately)
triggerOnce: motionTokens.triggerOnce   // true
```

**WordRotate IntersectionObserver gate** (from `02-UI-SPEC.md` lines 463-474 — no existing analog, use spec directly):
```tsx
const ref = useRef<HTMLSpanElement>(null);
const [inView, setInView] = useState(false);
useEffect(() => {
  const obs = new IntersectionObserver(([e]) => setInView(e.isIntersecting), {
    threshold: 0,
    rootMargin: "0px",
  });
  if (ref.current) obs.observe(ref.current);
  return () => obs.disconnect();
}, []);
```

---

### `src/app/(marketing)/_components/HeroBookend.tsx` (component, client)

**Analog:** `src/components/landing/hero-section.tsx` — shared inner layout pattern

This is the extracted shared component used by both `HeroSection` and `FinalCtaSection`. Only distinguishing prop: `reducedHeight?: boolean` (Final CTA uses `min-h-[60vh]` instead of `min-h-[100dvh]`).

**Props interface pattern** (modeled on analog lines 9-11):
```tsx
interface HeroBookendProps {
  reducedHeight?: boolean;
  className?: string;
}
```

**Coral single-stop alpha rule** (from `CLAUDE.md` + `02-UI-SPEC.md` MOTION-03):
```tsx
// CORRECT — single-stop alpha gradient only
fill="rgba(255, 127, 80, 0.12)"

// WRONG — multi-hue blend, forbidden
fill="linear-gradient(to bottom, #FF7F50, #FF3F20)"
```

**H1 with fused WordRotate — aria pattern** (from `02-UI-SPEC.md`):
```tsx
<h1
  className="font-bold leading-[1.05] tracking-[-0.04em]"
  style={{ fontSize: 'clamp(40px, 5.5vw, 64px)' }}
  aria-label="Predict viral for creators, brands, and founders — before you post."
>
  Predict viral for{" "}
  <span
    className="inline-flex"
    style={{ minWidth: "/* longest-word width */" }}
    aria-live="off"
    aria-atomic="true"
  >
    {prefersReduced ? (
      <span>creators</span>
    ) : (
      <WordRotate words={["creators", "brands", "founders"]} />
    )}
  </span>{" "}
  before you post.
</h1>
```

**CTA pair layout pattern** (from `src/components/layout/footer.tsx` lines 28-44 and `02-UI-SPEC.md`):
```tsx
<div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6">
  {/* Primary — ShimmerButton */}
  <a href="#demo">
    <ShimmerButton className="w-full sm:w-auto">
      Score your first TikTok
    </ShimmerButton>
  </a>
  {/* Secondary — ghost link */}
  <a
    href="#pricing"
    className="flex items-center min-h-[44px] text-sm text-foreground-secondary hover:text-foreground transition-colors w-full sm:w-auto justify-center"
  >
    See pricing
    <ChevronRight className="ml-1 w-4 h-4" />
  </a>
</div>
```

**Focus-visible pattern** (from existing `LandingHeader.tsx` Sign up button):
```tsx
// Coral focus-visible — global in globals.css, but explicitly set where needed:
// outline: 2px solid #FF7F50; outline-offset: 2px
// Applied via Tailwind: focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF7F50]
```

---

### `src/app/(marketing)/_components/FinalCtaSection.tsx` (component, client)

**Analog:** `src/components/landing/cta-section.tsx`

**Thin wrapper pattern** (analog lines 1-26):
```tsx
// cta-section.tsx is a thin section wrapping inner content.
// FinalCtaSection follows same: thin wrapper calling HeroBookend + attaches LandingFooter.
export function FinalCtaSection() {
  return (
    <section
      id="final-cta"
      aria-label="Final CTA section"
      className="bg-background min-h-[60vh] relative"
      style={{ borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}
    >
      <HeroBookend reducedHeight />
      <LandingFooter />
    </section>
  );
}
```

**H1 single-instance rule** (from `02-UI-SPEC.md` Accessibility Contract):
Final CTA MUST NOT render a second `<h1>`. Use `<p role="heading" aria-level="2">` styled visually as H1, or `aria-hidden="true"` on a visual duplicate. The page may have only one `<h1>` in the accessibility tree.

---

### `src/app/(marketing)/_components/VisionBeat.tsx` (component, server)

**Analog:** `src/components/landing/testimonial-quote.tsx`

No `"use client"` directive — server component (static content only).

**Server component pattern** (from `src/app/(marketing)/_components/SectionShell.tsx` lines 1-2 — no directive):
```tsx
// No "use client" — server component
import type { JSX } from "react";
```

**GlassPanel import + usage pattern** (from `src/components/primitives/GlassPanel.tsx` lines 34-57):
```tsx
import { GlassPanel } from "@/components/primitives/GlassPanel";

// GlassPanel is zero-config — 4 props only: children, className, style, as
// DO NOT pass: tint, blur, opacity, innerGlow, borderGlow (they don't exist)
<GlassPanel className="p-8">
  <blockquote
    className="text-xl font-normal leading-[1.6] text-foreground italic"
    style={{ letterSpacing: '0.1px' }}
  >
    Virality isn&apos;t luck — it&apos;s a behavioral signal. We built Virtuna
    to surface that signal before you bet on the post.
  </blockquote>
  <p
    className="mt-4 text-sm font-normal text-foreground-muted"
    style={{ letterSpacing: '0.2px' }}
  >
    — Davide Loreti, Founder, Virtuna
  </p>
</GlassPanel>
```

**GlassPanel exact CSS values** (from `GlassPanel.tsx` lines 47-52 — do not override):
```tsx
style={{
  background: "linear-gradient(137deg, rgba(17,18,20,0.75) 4.87%, rgba(12,13,15,0.9) 75.88%)",
  backdropFilter: "blur(5px)",
  WebkitBackdropFilter: "blur(5px)",
  boxShadow: "rgba(255,255,255,0.15) 0px 1px 1px 0px inset",
}}
// border: "1px solid rgba(255,255,255,0.06)" applied via className="border border-white/[0.06]"
```

**Section wrapper** (from `SectionShell.tsx` structure):
```tsx
<section
  id="vision-beat"
  aria-label="Founder vision"
  className="bg-background py-16 px-6"
>
  <div className="max-w-2xl mx-auto">
    <GlassPanel className="p-8">
      {/* quote + attribution */}
    </GlassPanel>
  </div>
</section>
```

---

### `src/app/(marketing)/_components/LandingFooter.tsx` (component, server)

**Analog:** `src/components/layout/footer.tsx` — exact role match

No `"use client"` directive — server component (CTA-03: no client JS).

**Server component footer pattern** (analog lines 13-110):
```tsx
// No "use client" — note analog uses phosphor-icons; Phase 2 uses lucide-react (already installed)
import { Twitter, Linkedin, Music, Instagram } from "lucide-react";
import Link from "next/link";

export function LandingFooter() {
  return (
    <footer role="contentinfo" className="bg-background border-t"
      style={{ borderTopColor: 'rgba(255, 255, 255, 0.06)' }}
    >
      <div className="max-w-7xl mx-auto px-6 pt-16 pb-8">
        {/* 4-column grid */}
        <nav aria-label="Footer navigation">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-4 md:gap-16">
            {/* columns */}
          </div>
        </nav>
        {/* Numen Machines strip */}
      </div>
    </footer>
  );
}
```

**Footer column link pattern** (analog lines 57-74):
```tsx
// Active links — from footer.tsx pattern adapted for Raycast tokens
<Link
  href="/privacy"
  className="text-sm text-foreground-secondary hover:text-foreground transition-colors"
  style={{ lineHeight: '1.75' }}
>
  Privacy Policy
</Link>

// Disabled links — About / Careers / Blog
<a
  href="#"
  aria-disabled="true"
  tabIndex={-1}
  className="text-sm text-foreground-secondary"
  style={{ opacity: 0.35, cursor: 'default', pointerEvents: 'none' }}
>
  About
</a>
```

**Social icon link pattern** (analog lines 79-105):
```tsx
<a
  href="https://x.com/virtuna"
  target="_blank"
  rel="noopener noreferrer"
  aria-label="Follow Virtuna on X"
  className="flex h-11 w-11 items-center justify-center text-foreground-muted hover:text-foreground transition-colors"
>
  <Twitter className="w-[18px] h-[18px]" />
</a>
```

**Numen Machines strip pattern** (no exact analog — from `02-UI-SPEC.md` spec):
```tsx
<div
  className="mt-12 pt-6 flex flex-col items-center gap-2"
  style={{ borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}
>
  <a
    href="https://numenmachines.com"
    target="_blank"
    rel="noopener noreferrer"
    className="text-sm text-foreground-muted hover:text-foreground transition-colors"
  >
    A Numen Machines product
  </a>
  <p className="text-sm text-foreground-muted" style={{ opacity: 0.6 }}>
    &copy; 2026 Numen Machines. All rights reserved.
  </p>
</div>
```

**Sign-in link** (from `02-UI-SPEC.md` — bottom of Product column):
```tsx
<div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
  <Link
    href="/login"
    className="text-sm text-foreground-muted hover:text-foreground transition-colors"
  >
    Sign in
  </Link>
</div>
```

---

### `src/app/(marketing)/v3/page.tsx` (modify existing)

**Analog:** Self — current file at lines 77-86

**Replace Hero + Final CTA SectionShell placeholders:**
```tsx
// BEFORE (lines 77, 85 in current page.tsx):
<SectionShell id="hero" label="Hero" shipsInPhase={2} variant="odd" isHero />
// ...
<SectionShell id="final-cta" label="Final CTA" shipsInPhase={2} variant="odd" />

// AFTER:
<HeroSection />
// ... other SectionShells unchanged ...
<VisionBeat />
<FinalCtaSection />
```

**Import addition pattern** (from existing page.tsx lines 1-6):
```tsx
import { HeroSection } from '@/app/(marketing)/_components/HeroSection';
import { FinalCtaSection } from '@/app/(marketing)/_components/FinalCtaSection';
import { VisionBeat } from '@/app/(marketing)/_components/VisionBeat';
// Remove: SectionShell import only if no other SectionShells remain (they do remain for Phases 4-10)
```

Anchor IDs `#hero` and `#final-cta` MUST be preserved — `LandingHeader.tsx` href slugs depend on them.

---

### `src/app/sitemap.ts` (modify existing)

**Analog:** Self — current file (lines 1-30)

**Addition pattern** (extend the returned array):
```ts
// Add after existing entries:
{
  url: `${base}/privacy`,
  lastModified: now,
  changeFrequency: 'yearly',
  priority: 0.3,
},
{
  url: `${base}/terms`,
  lastModified: now,
  changeFrequency: 'yearly',
  priority: 0.3,
},
```

---

### `src/app/(marketing)/privacy/page.tsx` (new stub route)

**Analog:** `src/app/(marketing)/coming-soon/page.tsx` — exact structure match

**Stub page pattern** (analog lines 1-32):
```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Virtuna",
  description: "Privacy Policy for Virtuna.",
  alternates: {
    canonical: "https://virtuna.ai/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="text-center max-w-xl">
        <h1 className="text-4xl font-normal text-foreground md:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-4 text-base text-foreground-muted">
          Coming soon. Last updated: 2026.
        </p>
      </div>
    </main>
  );
}
```

No `"use client"` — server component. No additional styling tokens beyond `globals.css` base.

---

### `src/app/(marketing)/terms/page.tsx` (new stub route)

**Analog:** `src/app/(marketing)/coming-soon/page.tsx` — identical structure to Privacy stub

Same pattern as `privacy/page.tsx` above, with:
- `title: "Terms of Service | Virtuna"`
- `canonical: "https://virtuna.ai/terms"`
- `<h1>Terms of Service</h1>`

---

## Shared Patterns

### backdropFilter — Lightning CSS workaround
**Source:** `src/app/(marketing)/_components/LandingHeader.tsx` lines 42-47
**Apply to:** Spotlight (HeroBookend), GlassPanel (VisionBeat)
```tsx
// ALWAYS inline style, never Tailwind class:
style={{
  backdropFilter: 'blur(Xpx)',
  WebkitBackdropFilter: 'blur(Xpx)',
}}
```

### motion/react import (never framer-motion)
**Source:** `src/app/(marketing)/v3/MotionRoot.tsx` line 3; `src/components/motion/fade-in.tsx` line 3
**Apply to:** HeroSection, HeroBookend, FinalCtaSection (all client components using animation)
```tsx
import { useReducedMotion } from "motion/react";   // CORRECT
import { MotionConfig } from "motion/react";        // CORRECT
// import { ... } from "framer-motion"             // FORBIDDEN
```

### Reduced-motion guard (Aceternity/Magic UI components)
**Source:** `src/components/motion/fade-in.tsx` lines 36-39; `src/hooks/usePrefersReducedMotion.ts`
**Apply to:** WordRotate, ShimmerButton shimmer, BorderBeam, AnimatedShinyText, Spotlight (in HeroBookend)
```tsx
const prefersReduced = useReducedMotion(); // from "motion/react"

// For CSS-animation-based components (ShimmerButton shimmer):
// CSS: @media (prefers-reduced-motion: reduce) { animation: none; }

// For JS-timer components (WordRotate):
if (prefersReduced) return <span>creators</span>;

// For conditional render (BorderBeam):
{!prefersReduced && <BorderBeam ... />}
```

### motionTokens consumption
**Source:** `src/app/(marketing)/motionTokens.ts` (full file, 23 lines)
**Apply to:** HeroBookend (entrance animations, BorderBeam, WordRotate timing)
```ts
import { motionTokens } from "@/app/(marketing)/motionTokens";
// durations.hero = 0.8, durations.slow = 0.3
// easings.outQuart = [0.165, 0.84, 0.44, 1]
// viewportThresholds.hero = 0
// triggerOnce = true
```

### Coral single-stop alpha rule
**Source:** `02-UI-SPEC.md` MOTION-03 + `CLAUDE.md` Raycast rules
**Apply to:** Spotlight fill, BorderBeam stroke, ShimmerButton border
```tsx
// VALID:
rgba(255, 127, 80, 0.12)   // Spotlight fill
rgba(255, 127, 80, 0.25)   // ShimmerButton border (rest)
rgba(255, 127, 80, 0.40)   // ShimmerButton border (hover)

// INVALID: any multi-stop gradient with coral, any oklch() for coral
```

### Raycast border token
**Source:** `src/app/(marketing)/_components/GrainOverlay.tsx` + `LandingHeader.tsx`
**Apply to:** Footer border-top, Final CTA border-top, section separators
```tsx
// 6% white border (Raycast standard):
style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}
// or className="border-white/[0.06]"

// 4% for sub-strips (Numen Machines strip, Sign-in separator):
style={{ borderColor: 'rgba(255, 255, 255, 0.04)' }}
```

### Section landmark pattern
**Source:** `src/app/(marketing)/_components/SectionShell.tsx` lines 50-65
**Apply to:** HeroSection, VisionBeat, FinalCtaSection
```tsx
<section
  id="[slug]"
  aria-label="[Section name]"
  className="bg-background [height-class] py-12 px-6"
>
  <div className="max-w-7xl mx-auto">
    {/* content */}
  </div>
</section>
```

### lucide-react icon usage
**Source:** Installed via shadcn new-york preset (Phase 1) — `lucide-react` package present
**Apply to:** LandingFooter (social icons), HeroBookend (secondary CTA chevron)
```tsx
import { ChevronRight, Twitter, Linkedin, Music, Instagram } from "lucide-react";
// Size via className: "w-[18px] h-[18px]" for footer social icons
// Size via className: "w-4 h-4" (16px) for secondary CTA chevron
```

### External link attributes
**Source:** `src/components/layout/footer.tsx` lines 83-86
**Apply to:** LandingFooter social links, Numen Machines strip link
```tsx
target="_blank"
rel="noopener noreferrer"
aria-label="Follow Virtuna on [Platform]"
```

---

## No Analog Found

All Phase 2 files have sufficient analogs. The following components will be installed fresh (no existing instances in codebase):

| Component | Source | Needed by | Install command |
|-----------|--------|-----------|-----------------|
| `WordRotate` | Magic UI | HeroBookend | `npx shadcn@latest add @magicui/word-rotate` |
| `ShimmerButton` | Magic UI | HeroBookend | `npx shadcn@latest add @magicui/shimmer-button` |
| `AnimatedShinyText` | Magic UI | HeroBookend | `npx shadcn@latest add @magicui/animated-shiny-text` |
| `BorderBeam` | Magic UI | HeroBookend (on ShimmerButton) | `npx shadcn@latest add @magicui/border-beam` |
| `Spotlight` | Aceternity | HeroBookend | `npx shadcn@latest add "https://ui.aceternity.com/registry/spotlight.json"` |

**Pre-install check:** Before each install, check if `src/components/ui/{component-slug}.tsx` already exists. If it does, skip install. See `02-UI-SPEC.md` § Component Inventory for exact file paths to check.

Registry safety gates passed (2026-05-24) — all 5 components reviewed in `02-UI-SPEC.md` § Registry Safety.

---

## Metadata

**Analog search scope:** `src/app/(marketing)/`, `src/components/landing/`, `src/components/layout/`, `src/components/primitives/`, `src/components/motion/`
**Files scanned:** 12 source files read
**Pattern extraction date:** 2026-05-25
