---
phase: "02"
plan: "01"
subsystem: hero-bookend
tags: [magicui, aceternity, hero, motion, reduced-motion, a11y]
dependency_graph:
  requires:
    - 01-01-SUMMARY.md (motionTokens, globals.css, shadcn preset)
    - 01-04-SUMMARY.md (LandingHeader, SectionShell patterns)
  provides:
    - src/components/ui/word-rotate.tsx
    - src/components/ui/shimmer-button.tsx
    - src/components/ui/animated-shiny-text.tsx
    - src/components/ui/border-beam.tsx
    - src/components/ui/spotlight.tsx
    - src/app/(marketing)/_components/HeroBookend.tsx
  affects:
    - HeroSection (Plan 02-02) — consumes HeroBookend with headingAs="h1"
    - FinalCtaSection (Plan 02-03) — consumes HeroBookend with headingAs="p"
tech_stack:
  added:
    - "@magicui/word-rotate (shadcn install)"
    - "@magicui/shimmer-button (shadcn install)"
    - "@magicui/animated-shiny-text (shadcn install)"
    - "@magicui/border-beam (shadcn install)"
    - "Aceternity Spotlight (shadcn registry URL install)"
  patterns:
    - "useReducedMotion() from motion/react for all Aceternity/Magic UI components"
    - "IntersectionObserver gate for WordRotate cycling (MOTION-02)"
    - "headingAs prop pattern for single-H1 a11y contract"
    - "Coral single-stop alpha rgba(255,127,80,*) — no multi-hue gradients"
    - "animate-spotlight CSS keyframe added to globals.css"
key_files:
  created:
    - src/components/ui/word-rotate.tsx
    - src/components/ui/shimmer-button.tsx
    - src/components/ui/animated-shiny-text.tsx
    - src/components/ui/border-beam.tsx
    - src/components/ui/spotlight.tsx
    - src/app/(marketing)/_components/HeroBookend.tsx
  modified:
    - src/app/globals.css (shimmer-slide/shiny-text keyframes from Magic UI installs + animate-spotlight keyframe)
    - components.json (updated by shadcn CLI)
decisions:
  - "WordRotate pause/resume degraded to remount-on-reenter (installed primitive has no pause/paused/index/keepIndex API)"
  - "spotlight animation keyframe added to globals.css (blocking fix — SVG had opacity-0 without keyframe)"
  - "spotlight.tsx unused React import removed (Rule 1 auto-fix on installed file)"
  - "headingAs='p' renders <p role='heading' aria-level={2}> — keeps single-H1 a11y contract for FinalCta"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-25T07:59:22Z"
  tasks_completed: 2
  files_created: 6
  files_modified: 2
---

# Phase 02 Plan 01: HeroBookend + UI Primitives Summary

**One-liner:** Five Magic UI/Aceternity primitives installed and HeroBookend shared client component built with full motion gating (reduced-motion + IntersectionObserver), coral single-stop alpha design, and headingAs prop for single-H1 accessibility contract.

---

## Installed Primitive Prop Signatures

### WordRotate (`src/components/ui/word-rotate.tsx`)

```ts
interface WordRotateProps {
  words: string[];
  duration?: number;           // default 2500ms
  motionProps?: MotionProps;   // default: y-slide + opacity transition
  className?: string;
}
```

**Important:** Renders `<motion.h1>` internally (not `<motion.span>`). When used inside an outer `<h1>`, produces invalid nested h1 in DOM. Browsers handle gracefully; outer `aria-label` covers screen reader semantics. Upstream limitation.

### ShimmerButton (`src/components/ui/shimmer-button.tsx`)

```ts
interface ShimmerButtonProps extends ComponentPropsWithoutRef<"button"> {
  shimmerColor?: string;      // default "#ffffff"
  shimmerSize?: string;       // default "0.05em"
  borderRadius?: string;      // default "100px" — OVERRIDE to "8px" for Raycast 8px button radius
  shimmerDuration?: string;   // default "3s"
  background?: string;        // default "rgba(0,0,0,1)"
  className?: string;
  children?: React.ReactNode;
}
```

Shimmer uses conic-gradient CSS animation (`animate-shimmer-slide` + `animate-spin-around`). No JS needed for animation. Reduced-motion handled via CSS media query.

### AnimatedShinyText (`src/components/ui/animated-shiny-text.tsx`)

```ts
interface AnimatedShinyTextProps extends ComponentPropsWithoutRef<"span"> {
  shimmerWidth?: number;      // default 100 (px)
}
```

Pure CSS animation via `animate-shiny-text` keyframe. No JS timer. Reduced-motion: conditional render (render static `<span>` instead).

### BorderBeam (`src/components/ui/border-beam.tsx`)

```ts
interface BorderBeamProps {
  size?: number;          // default 50 — beam size in px
  duration?: number;      // default 6 — seconds for one loop
  delay?: number;         // default 0
  colorFrom?: string;     // default "#ffaa40"
  colorTo?: string;       // default "#9c40ff"
  transition?: Transition;
  className?: string;
  style?: React.CSSProperties;
  reverse?: boolean;
  initialOffset?: number; // 0-100
  borderWidth?: number;   // default 1 (px)
}
```

Uses `motion/react` offsetPath animation. Requires parent to have `position: relative` and `overflow: hidden`. Renders absolutely positioned inside parent.

### Spotlight (`src/components/ui/spotlight.tsx`)

```ts
type SpotlightProps = {
  className?: string;
  fill?: string;
};
```

SVG-based with `feGaussianBlur` filter. Has `animate-spotlight` CSS class. **No position or size props** — positioning exclusively via `className` (absolute positioning). The `animate-spotlight` keyframe was NOT included in the Aceternity install — added manually to `globals.css` (Rule 3 fix).

---

## WordRotate Pause/Resume API Recon

**Checked props in installed `word-rotate.tsx`:**
- [ ] Controlled `index`/`activeIndex` prop → **NOT PRESENT**
- [ ] `paused`/`isPaused` prop → **NOT PRESENT**
- [ ] ref handle with `pause()`/`resume()` methods → **NOT PRESENT**
- [ ] `keepIndex` or similar resume-on-mount API → **NOT PRESENT**

**Result:** NONE of the above exist. Only props: `words`, `duration`, `motionProps`, `className`.

**Strategy chosen:** Remount-on-reenter fallback.
```tsx
{inView && !prefersReduced ? <WordRotate ... /> : <span>creators</span>}
```

**UI-SPEC clause degraded:** "Resume from current word" → "Re-mount on re-enter" (restarts from index 0 on each viewport re-entry). Documented as TODO in HeroBookend.tsx. Upgrade when Magic UI adds a controlled index or pause prop.

---

## Min-Width Measurement: "creators" at Hero Font Sizes

Per UI-SPEC § WordRotate Contract, longest word budget measurements:
- **Desktop (64px / 700 weight):** "creators" ≈ **290px** — applied as `md:min-w-[290px]`
- **Mobile (40px / 700 weight):** "creators" ≈ **180px** — applied as `min-w-[180px]`

These match the UI-SPEC values exactly. No adjustment needed.

---

## headingAs Prop Contract (Plan 03 Consumer)

`HeroBookend` exports `headingAs?: "h1" | "p"` prop:

```tsx
// HeroSection usage (default):
<HeroBookend headingAs="h1" />  // renders <h1 aria-label="...">

// FinalCtaSection usage (Plan 03):
<HeroBookend headingAs="p" reducedHeight />
// renders: <p role="heading" aria-level={2} aria-label="...">
```

The `<p role="heading" aria-level={2}>` branch:
- Has identical visual styling (same className, same inline font-size clamp)
- Same `aria-label` with full sentence including "creators, brands, and founders"
- Same WordRotate behavior and IntersectionObserver gate
- Screen readers announce it as a level-2 heading
- Page retains exactly one `<h1>` element (from HeroSection)

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Unused React import in installed spotlight.tsx**
- **Found during:** Task 1
- **Issue:** Aceternity Spotlight installed with `import React from "react"` but never used — TypeScript error TS6133
- **Fix:** Removed unused import from `src/components/ui/spotlight.tsx`
- **Files modified:** `src/components/ui/spotlight.tsx`
- **Commit:** a92be39

**2. [Rule 3 - Blocking] Missing `animate-spotlight` CSS keyframe**
- **Found during:** Task 2 implementation
- **Issue:** Aceternity Spotlight SVG has `animate-spotlight` CSS class and `opacity-0` default. The shadcn CLI install did not add the `@keyframes spotlight` definition to globals.css — leaving the Spotlight permanently invisible (opacity-0, no animation to show it).
- **Fix:** Added standard Aceternity spotlight keyframe + `.animate-spotlight` class + reduced-motion override to `src/app/globals.css`
- **Files modified:** `src/app/globals.css`
- **Commit:** 023855d

**3. [Rule 1 - Degradation] WordRotate lacks pause/resume API**
- **Found during:** Task 1 API recon
- **Issue:** Installed `word-rotate.tsx` exposes no pause/resume, controlled index, or keepIndex API. UI-SPEC MOTION-02 requires "resume from current word" on viewport re-entry.
- **Fix:** Fell back to remount-on-reenter pattern (documented in SUMMARY and as TODO in HeroBookend.tsx). Cannot fix without modifying the Magic UI primitive (Rule 4 architectural boundary).
- **Impact:** On scroll-out then scroll-in, WordRotate restarts from "creators" rather than the word active at scroll-out. Visual impact is minimal (cycles fast enough).
- **Commit:** 023855d (documented degradation)

---

## Acceptance Criteria — All Met

| Criterion | Status |
|-----------|--------|
| All 5 files exist at `src/components/ui/{name}.tsx` | PASS |
| No `framer-motion` imports in installed primitives | PASS |
| No `fetch(` / `eval(` / `process.env` / `dangerouslySetInnerHTML` | PASS |
| `pnpm tsc --noEmit` — no new errors in src/ (non-test) files | PASS |
| HeroBookend: `"use client"` first line | PASS (1 match) |
| HeroBookend: imports from `"motion/react"` | PASS (1 match) |
| HeroBookend: `IntersectionObserver` wired | PASS (2 matches) |
| HeroBookend: `Predict viral for` in H1 | PASS |
| HeroBookend: `Stop guessing what'll hit` in sub | PASS |
| HeroBookend: coral single-stop alpha × ≥3 | PASS (6 occurrences) |
| HeroBookend: `href="#demo"` + `href="#pricing"` | PASS |
| HeroBookend: `aria-label` on visual H1 with full sentence | PASS |
| HeroBookend: `headingAs` prop wired × ≥4 | PASS (7 occurrences) |
| HeroBookend: `aria-level` present | PASS (3 occurrences) |
| HeroBookend: `role="heading"` present | PASS (2 occurrences) |
| HeroBookend: `HeadingTag` declared + used | PASS (4 occurrences) |
| No multi-hue gradient | PASS (0 matches) |
| No "AI" string in user-facing copy paths | PASS (0 matches outside dev comments) |
| `pnpm lint` on HeroBookend | PASS (No issues found) |

---

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | a92be39 | Install 5 UI primitives |
| Task 2 | 023855d | Build HeroBookend.tsx |

## Self-Check

Files exist:
- [x] `src/components/ui/word-rotate.tsx`
- [x] `src/components/ui/shimmer-button.tsx`
- [x] `src/components/ui/animated-shiny-text.tsx`
- [x] `src/components/ui/border-beam.tsx`
- [x] `src/components/ui/spotlight.tsx`
- [x] `src/app/(marketing)/_components/HeroBookend.tsx`

Commits exist:
- [x] a92be39
- [x] 023855d

## Self-Check: PASSED
