# Phase 2: Hero Centerpiece & Reading Explainer - Research

**Researched:** 2026-06-12
**Domain:** Next.js 16 landing hero — recorded stage-reveal loop over a real Reading keyframe, verdict throne, 3-step explainer
**Confidence:** HIGH

## Summary

Phase 2 fills two already-mounted, currently-empty SectionShell slots (`#hero`, `#how-it-works`) in `src/app/(marketing)/page.tsx` with the real product as the centerpiece. Every primitive the phase needs already exists in-repo and is verified: `StageBlock` (`numen/stage-reveal.tsx`), `VerdictSwatch` (`numen/verdict-swatch.tsx`), `SectionShell`, `Surface`, the `.numen-surface` token scope + `bg-verdict-good` bridge, the `--numen-ease-calm` easing, and a working `scripts/check-apca.ts` gate. No new dependency is required; no new motion primitive is required. The build is JSX + Tailwind utilities + ONE shipped static Reading asset bundle in `public/`.

The single load-bearing decision (D-13 spike) is the **capture path**. I inspected the sibling app worktree (`~/virtuna-numen-surface`). Its `/analyze` surface is **auth-gated** (`(app)` route group), renders via an SSE stream (`useAnalysisStream`), and — critically — **its verdict/Reading UI is NOT shipped yet**: `result-card.tsx` renders 8 of 11 panels as the literal placeholder string `"Panel content placeholder — implemented in Phase 3-5"`, and the verdict throne UI (`VerdictNode`) lives in the board/Konva surface, not a clean Reading screen. There is **no polished, screenshot-ready verdict throne** to capture today. Therefore the **primary recommendation is the D-02 fallback path promoted to primary: stage a REAL creator-video keyframe (a genuine still, never stock, never fake chrome) + a real-shaped verdict band + why, and replay it through `StageBlock` as the loop.** This is engine-independent, perf-controllable, satisfies HERO-02's authenticity bar (real keyframe + real-shaped verdict), and avoids coupling the landing to an unshipped app screen. The data *shape* to mirror is in the app's `src/lib/reading/verdict-bands.ts` and this repo's fixtures.

**Primary recommendation:** Build the hero as a static-keyframe + `StageBlock`-driven reveal loop (NOT a captured app screenshot, NOT a video). Ship ONE real creator keyframe as a Next.js statically-imported image (auto width/height/blur, zero CLS) with `preload` (Next 16.1.5 renamed `priority` → `preload`); overlay a `VerdictSwatch`-based `bg-verdict-good` throne with an APCA-Lc-≥60 label on a solid `bg-panel` plate; drive a `show`-state loop controller (calm cadence, ≥3s dwell on verdict) that renders the completed end-state directly under `prefers-reduced-motion`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Hero Reading keyframe render | CDN / Static (`public/` asset via `next/image`) | Browser | It's a shipped static asset; no server compute, no engine call (engine frozen + cross-worktree, NOT callable from landing deploy — D-01) |
| Stage-reveal loop choreography | Browser / Client (`"use client"`) | — | `StageBlock` uses `motion/react` hooks (`useReducedMotion`, `AnimatePresence`); the loop controller is client state |
| Verdict throne composition | Browser / Client | CDN / Static | Overlay markup over the static keyframe; `VerdictSwatch` is a pure presentational component |
| 3-step explainer | Frontend Server (RSC, static) | Browser (only if clickable-to-hero, D-06) | Static markup; can be a server component unless clickable enhancement is shipped |
| Hero CTA scroll-route to `#cta` | Browser / Client | — | `next/link href="#cta"` anchor jump (slot exists from Phase 1); smooth-scroll gated on `prefers-reduced-motion` |

**Key tier note:** Nothing in this phase belongs to the API/Backend tier. There is NO live engine call, NO fetch, NO data view. The hero artifact is a pre-captured static asset; the entire phase is presentation over `public/`.

## Standard Stack

### Core (all already installed — verified in `package.json`)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | `16.1.5` | `next/image` (LCP-optimized hero keyframe), `next/link` (CTA anchor) | Already the project framework `[VERIFIED: package.json]` |
| `motion` | `^12.29.2` | Drives `StageBlock` (`motion/react`) | Already used by `stage-reveal.tsx`; D-10 mandates `motion`, not `framer-motion` `[VERIFIED: package.json + stage-reveal.tsx]` |
| `tailwind-variants` | `^3.2.2` | `tv()` literal-string verdict classes (the `VerdictSwatch` pattern) | Already used; the ONLY way to keep verdict classes greppable so Tailwind v4 emits them `[VERIFIED: package.json + verdict-swatch.tsx]` |
| `lucide-react` | `^0.563.0` | OPTIONAL step affordance icons (`Upload`, `ScanLine`/`Eye`, `Check`) — prefer the real artifact over a glyph | Already used in `nav.tsx`; NO Phosphor `[VERIFIED: package.json + nav.tsx]` |
| `tailwindcss` | `^4` | CSS-first; `.numen-surface` scope + `@theme inline` bridge | Already configured `[VERIFIED: globals.css]` |

### Supporting (in-repo first-party — consume, never fork; DS-01)
| Component | Path | Purpose | When to Use |
|-----------|------|---------|-------------|
| `StageBlock` | `src/components/numen/stage-reveal.tsx` | `{show, children}` reveal; reduced-motion zeroes translate | The loop's per-stage reveal — THE motion |
| `VerdictSwatch` | `src/components/numen/verdict-swatch.tsx` | `verdict: good\|mixed\|bad`, `size`, on-swatch APCA-gated children | Base of the verdict throne band |
| `SectionShell` | `src/components/numen-landing/section-shell.tsx` | `{id, heading?, children, className}` | Fill `#hero` (NO `heading=`) + `#how-it-works` (keeps `heading=`) |
| `Surface` | `src/components/numen/surface.tsx` | `rounded-[12px] border-border bg-panel` + soft shadow | Explainer step cards; verdict-throne backing plate |
| `next/image` | (built-in) | Static-import hero keyframe → auto width/height/blur/CLS | The hero keyframe |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Static keyframe + StageBlock loop | Captured app screenshot of `/analyze` | **Rejected:** app verdict UI is unshipped (8/11 panels are placeholders), `/analyze` is auth-gated + Konva board, no clean throne to capture `[VERIFIED: result-card.tsx, analyze/page.tsx]` |
| Static keyframe + StageBlock loop | Short muted `<video>` loop | Allowed per UI-SPEC but heavier LCP, needs poster + reduced-motion static fallback anyway; a keyframe + StageBlock is lighter and reuses the in-app motion language exactly. Keep video as a *deferred* upgrade |
| `next/image` static import | Raw `<img>` | Loses auto width/height/blur/CLS prevention + the `preload` LCP path |
| `VerdictSwatch` band | Hand-rolled colored div | Loses the APCA gate + the literal-class `tv()` discipline; would re-introduce the `bg-${verdict}` interpolation pitfall |

**Installation:** None. Every dependency is already in `package.json`.

**Version verification:**
```bash
# Confirmed against the EXISTING package.json (no install needed):
next            16.1.5    [VERIFIED: package.json]
motion          ^12.29.2  [VERIFIED: package.json]
tailwind-variants ^3.2.2  [VERIFIED: package.json]
lucide-react    ^0.563.0  [VERIFIED: package.json]
```

## Package Legitimacy Audit

> No external packages are installed this phase. All UI is composed from in-repo first-party primitives + already-installed dependencies + ONE shipped static asset.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none — zero new installs) | — | N/A |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*No install step exists in this phase, so the legitimacy gate is N/A. The planner should NOT add an install task.*

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────┐
                          │  public/  (CDN / static)                 │
   build time ───────────▶│  hero-keyframe.{webp|jpg}  (REAL still)  │
   (asset authored once)  │  [optional] verdict.json (shape mirror)  │
                          └────────────────┬────────────────────────┘
                                           │ static import (next/image)
                                           ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │ (marketing)/layout.tsx  →  <div class="numen-surface bg-bg text-text"> │  ← token scope (load-bearing)
   │                                                                        │
   │  page.tsx                                                              │
   │   ├─ SectionShell id="hero" (NO heading=)   ← single <h1>             │
   │   │    └─ Hero (client)                                                │
   │   │         ├─ H1 + subhead + CTA(→#cta)   [text column, max-w-6xl]    │
   │   │         └─ ReadingLoop (client, full-bleed)                        │
   │   │              ├─ next/image keyframe (preload, blur, fixed dims)    │
   │   │              └─ loop controller: show-state cycles stages          │
   │   │                   └─ StageBlock × N  (numen-ease-calm)             │
   │   │                        └─ VerdictThrone (last stage, dwell ≥3s)    │
   │   │                             └─ VerdictSwatch good + label + why     │
   │   │                                  (on bg-panel plate, APCA Lc ≥ 60) │
   │   │              └─ prefers-reduced-motion ⇒ render END-STATE directly  │
   │   │                   (no cycle, no translate)                         │
   │   │                                                                    │
   │   └─ SectionShell id="how-it-works" (keeps heading=)  ← <h2>          │
   │        └─ HowItWorks: 3 cards (Surface) reuse the SAME real artifacts  │
   │             upload(keyframe) → reads(stage excerpt) → verdict(band+why)│
   └──────────────────────────────────────────────────────────────────────┘
```

Trace the primary path: build authors one real keyframe → static-imported into the hero → loop controller reveals stages via `StageBlock` → dwells on the verdict throne → restarts (or, under reduced motion, paints the final state once). The explainer reuses the same three real artifacts.

### Recommended Project Structure (Claude's discretion per CONTEXT, this is the suggested split)
```
src/components/numen-landing/
├── hero.tsx            # "use client" — H1/subhead/CTA column + mounts ReadingLoop
├── reading-loop.tsx    # "use client" — loop controller + StageBlock cycling + keyframe
├── verdict-throne.tsx  # presentational — VerdictSwatch good band + label + why on plate
└── how-it-works.tsx    # 3-step explainer (RSC unless D-06 clickable enhancement)
public/
└── images/landing/hero/  # the ONE real keyframe (+ optional second-stage still)
```

### Pattern 1: Static-import the hero keyframe for zero-CLS + LCP preload
**What:** Import the real keyframe as a static asset so Next derives `width`/`height`/`blurDataURL` automatically, then opt into the LCP preload path.
**When to use:** The hero keyframe is the largest above-fold element (LCP candidate).
**Example:**
```tsx
// Source: CITED https://github.com/vercel/next.js/blob/v16.1.5/docs/01-app/03-api-reference/02-components/image.mdx
import Image from "next/image";
import heroKeyframe from "@/../public/images/landing/hero/keyframe.webp"; // or relative import

<Image
  src={heroKeyframe}
  alt="A real Reading of a creator video showing an honest 'likely to land' verdict and why."
  preload            // Next 16.1.5: `preload` REPLACES the deprecated `priority` for LCP [CITED: next.js v16.1.5 docs]
  placeholder="blur" // blurDataURL auto-provided by the static import
  // width/height auto-provided by the static import → reserves space → no CLS
  className="w-full h-auto"
/>
```
> **PITFALL (Next 16):** the old `priority` prop is **deprecated** in 16.1.5 in favor of `preload`. Use `preload`. `[CITED: next.js v16.1.5 image.mdx]`

### Pattern 2: Drive a calm reveal LOOP from `StageBlock`
**What:** `StageBlock` is `{show, children}` only — it has no internal sequencing. The loop is a controller that walks a stage index, toggling `show` per stage, dwelling on the verdict, then resetting.
**When to use:** The hero centerpiece (D-01 recorded stage-reveal loop).
**Example:**
```tsx
// Source: VERIFIED src/components/numen/stage-reveal.tsx (StageBlock API)
"use client";
import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { StageBlock } from "@/components/numen/stage-reveal";

const STAGES = [/* keyframe */, /* stage-read excerpt */, /* verdict throne */] as const;
const STEP_MS = 1200;      // calm advance (Claude's discretion)
const VERDICT_DWELL_MS = 4000; // ≥ a few seconds so the band + why is readable

export function ReadingLoop(/* props */) {
  const reduce = useReducedMotion();
  const [revealed, setRevealed] = useState(reduce ? STAGES.length : 0);

  useEffect(() => {
    if (reduce) return;            // HARD: reduced motion paints END-STATE, NO cycle
    let i = 0;
    const tick = () => {
      i = i + 1;
      if (i > STAGES.length) i = 0; // reset → replay
      setRevealed(i);
    };
    const id = setInterval(tick, /* dwell longer on the verdict stage */ STEP_MS);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <>
      {STAGES.map((stage, idx) => (
        <StageBlock key={idx} show={reduce ? true : idx < revealed}>
          {/* stage content; last stage = <VerdictThrone /> */}
        </StageBlock>
      ))}
    </>
  );
}
```
> The exact cadence, whether it pauses on the verdict, and the dwell duration are **Claude's discretion** (CONTEXT) — but MUST stay calm: no bounce, no flashing, no rapid cycling. `StageBlock` already zeroes translate + duration under reduced motion; the **controller** must additionally NOT auto-cycle. `[VERIFIED: stage-reveal.tsx + stage-reveal.test.ts]`

### Pattern 3: Verdict throne — `VerdictSwatch` + label on a solid plate (NOT glass-over-photo)
**What:** Overlay a `bg-verdict-good` band with a bold APCA-Lc-≥60 label + a muted one-line why, anchored ON the keyframe. If the keyframe hurts legibility, back the band with a SOLID `bg-panel` plate — never tint the band, never use glass-over-photo.
**Example:**
```tsx
// Source: VERIFIED src/components/numen/verdict-swatch.tsx + globals.css token bridge
import { VerdictSwatch } from "@/components/numen/verdict-swatch";

<div className="rounded-[12px] border border-border bg-panel p-4 md:p-6"> {/* solid plate */}
  <span className="inline-flex items-center gap-2">
    <VerdictSwatch verdict="good" size="md" />
    <span className="text-sm md:text-base font-bold text-text">This will likely land.</span>
  </span>
  <p className="mt-2 text-sm md:text-base leading-relaxed text-text-muted">
    Strong hook in the first 2 seconds — tighten the middle and it lands.
  </p>
</div>
```

### Pattern 4: Mirror the real verdict-band SHAPE (not the engine)
The app's canonical band table (the data shape to mirror for authenticity) is:
```ts
// Source: VERIFIED ~/virtuna-numen-surface/src/lib/reading/verdict-bands.ts
VERDICT_BANDS = [
  { id: 'high',       label: 'High potential',  min: 70 },
  { id: 'solid',      label: 'Solid contender', min: 40 },
  { id: 'needs-work', label: 'Needs work',      min: 0  },
]
```
> NOTE the app's Reading-facing labels are "High potential / Solid contender / Needs work". The landing's D-03 copy ("This will likely land.") is a *landing-voice* rendering of the GOOD band — keep it band+why per VOICE Rule 3, but be aware the app's own label wording differs. Do NOT show the `/100` number (the app itself demotes it; VOICE Rule 3 forbids a naked number). `[VERIFIED: verdict-bands.ts]`

### Anti-Patterns to Avoid
- **`bg-${verdict}` dynamic interpolation:** Tailwind v4 can't see runtime-built class strings → the color is purged. Use `VerdictSwatch`'s literal `tv()` variants. `[VERIFIED: verdict-swatch.tsx comment]`
- **Glass / `backdrop-filter` over the keyframe:** Lightning CSS strips `backdrop-filter` from CSS classes in prod; also REQUIREMENTS forbids glass-over-photo. Use a solid `bg-panel` plate. If blur were ever unavoidable, apply via React inline `style={{ backdropFilter, WebkitBackdropFilter }}` — but the hero should need NO blur. `[VERIFIED: CLAUDE.md + UI-SPEC]`
- **`priority` prop on `next/image`:** deprecated in Next 16.1.5 → use `preload`. `[CITED: next.js v16.1.5 docs]`
- **Color hex hardcoded in JSX:** breaks the Phase-4 token swap. Use bridged token names (`bg-verdict-good`, `text-text`, …). `[VERIFIED: UI-SPEC]`
- **A second `<h1>`:** the hero is the page's ONLY h1; step titles are `<h3>` (under the `#how-it-works` `<h2>`) or non-heading. `[VERIFIED: page.tsx + section-shell.tsx]`
- **Stock photo / fake browser chrome / fabricated diagram:** forbidden by HERO-02 — the keyframe must be a REAL creator-video still.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reveal motion + reduced-motion fallback | A custom CSS/JS animation | `StageBlock` | Reduced-motion zeroing + non-overshoot easing already built + tested (`stage-reveal.test.ts`) — HERO-04 for free |
| Verdict band color + contrast | A colored div with ad-hoc text color | `VerdictSwatch` + `check-apca.ts` | Literal-class discipline + APCA Lc≥60 gate already encoded |
| Image dimensions / CLS / blur placeholder | Manual `<img>` with hand-set width/height | `next/image` static import | Auto width/height/blurDataURL → zero CLS, plus `preload` LCP path |
| Section rhythm / scroll-margin / single-landmark | A new `<section>` wrapper | `SectionShell` | Locked kero vertical rhythm + `scroll-mt-*` already carried |
| APCA verification | Eyeballing contrast | `pnpm tsx scripts/check-apca.ts` | Real pass/fail gate; exits non-zero on any failing pairing |

**Key insight:** Every load-bearing piece of this phase already exists and is tested. The phase's real work is authoring ONE real asset + composing existing primitives + writing VOICE-compliant copy. Reaching for anything custom re-introduces a pitfall the kit already solved.

## Common Pitfalls

### Pitfall 1: Capturing the unshipped app verdict screen
**What goes wrong:** Planning a task to "screenshot the real Reading from `/analyze`" — but the app's verdict throne UI is NOT shipped (8/11 panels are literal placeholder strings; `/analyze` is auth-gated + a Konva board, not a clean Reading screen).
**Why it happens:** CONTEXT D-02 lists app-export as the *primary* path; the spike was meant to verify it. The spike's answer is: **it's not capturable today.**
**How to avoid:** Promote the D-02 **fallback** (staged-real-keyframe) to the primary build path. Mirror only the verdict *data shape* from `verdict-bands.ts` + fixtures. `[VERIFIED: result-card.tsx, analyze/page.tsx]`

### Pitfall 2: Reduced-motion loop keeps cycling
**What goes wrong:** `StageBlock` correctly zeroes translate under reduced motion, but the LOOP CONTROLLER still runs its `setInterval`, producing opacity flicker / auto-advance — which violates HERO-04 ("no auto-cycle").
**Why it happens:** `useReducedMotion` is honored by `StageBlock` but the controller is separate code.
**How to avoid:** In the controller, `if (reduce) return;` before starting the interval AND initialize `revealed` to the full count so the end-state paints directly. Add a test that mocks `useReducedMotion()=>true` and asserts no timer / final state rendered.
**Warning signs:** Hero subtly pulses with OS "reduce motion" on.

### Pitfall 3: `bg-bg`/`text-text`/`bg-verdict-good` render transparent
**What goes wrong:** A bridged token utility renders with no color.
**Why it happens:** `@theme inline` resolves `var(--numen-bg)` at the usage site, which is only defined under `.numen-surface`. Any element outside that wrapper is transparent.
**How to avoid:** All hero/explainer markup must be a descendant of the `.numen-surface` wrapper (it is — `(marketing)/layout.tsx` mounts it). Don't portal the throne outside the wrapper. `[VERIFIED: globals.css comment + layout.tsx]`

### Pitfall 4: CLS from a late-painting full-bleed keyframe
**What goes wrong:** The largest above-fold element shifts layout as it loads.
**How to avoid:** Static-import the keyframe (auto intrinsic dims reserve space) + `preload` + `placeholder="blur"`. Give the full-bleed container an explicit aspect ratio so the bleed element reserves height before paint.
**Warning signs:** Lighthouse CLS > 0; the H1 jumps when the image lands.

### Pitfall 5: Dev-server CSS cache hides token changes
**What goes wrong:** New `bg-verdict-good` usage doesn't appear.
**How to avoid:** Kill dev server + clear `.next/` + `node_modules/.cache/` + hard-refresh. Verify on a live server, not just unit tests. `[VERIFIED: CLAUDE.md]`

## Runtime State Inventory

> Greenfield-style presentation phase — no rename/refactor/migration. This phase adds NEW components + ONE static asset; it does not move or rename existing runtime state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no DB writes/reads this phase (no live capture; Phase 3 owns waitlist). | none |
| Live service config | None — engine frozen + cross-worktree, NOT called. | none |
| OS-registered state | None. | none |
| Secrets/env vars | None — no API call, no auth. | none |
| Build artifacts | The ONE new hero keyframe in `public/` is a build input, not stale state. | ship it |

**Nothing found in every category — verified by inspecting the phase scope (presentation over `public/`, no fetch/DB/engine).**

## Code Examples

### CTA scroll-route to `#cta` (anchor exists from Phase 1)
```tsx
// Source: VERIFIED page.tsx (#cta SectionShell slot present) + nav.tsx (same CTA label)
import Link from "next/link";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

<Link
  href="#cta"
  className={`inline-flex min-h-11 items-center rounded-lg bg-accent px-5 text-sm font-medium text-bg transition-opacity hover:opacity-90 ${FOCUS_RING}`}
>
  Try Numen   {/* MUST match nav + footer label exactly (locked Phase 1) */}
</Link>
```
> The `#cta` `SectionShell` slot already exists in `page.tsx` (line 57). `scroll-mt-20 md:scroll-mt-24` is carried by `SectionShell`, so the anchor lands below the sticky nav. Gate smooth-scroll behind `prefers-reduced-motion: no-preference` (via a global `html` rule or a no-preference media query). Do NOT deep-link `/analyze`. `[VERIFIED: page.tsx, section-shell.tsx]`

### 3-step explainer card (reuses the same real artifacts)
```tsx
// Source: VERIFIED surface.tsx (Surface API) + UI-SPEC layout contract
import { Surface } from "@/components/numen/surface";

<div className="mt-8 grid gap-6 md:grid-cols-3 md:gap-8">
  {/* step 1 upload = real keyframe; step 2 reads = real stage-read excerpt; step 3 verdict = real band + why */}
  <Surface className="p-4 md:p-6">
    <h3 className="text-base md:text-lg font-medium text-text">Upload</h3>
    <p className="mt-2 text-base leading-relaxed text-text-muted">
      Drop in your video — that&apos;s all it needs.
    </p>
    {/* real keyframe thumbnail here */}
  </Surface>
  {/* ...steps 2 + 3 */}
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next/image priority` | `next/image preload` | Next 16 | Use `preload` for the LCP keyframe; `priority` is deprecated `[CITED: next.js v16.1.5]` |
| `framer-motion` | `motion` (`motion/react`) | motion v11+ | Already adopted (D-10); import `useReducedMotion`, `AnimatePresence`, `motion` from `motion/react` `[VERIFIED: stage-reveal.tsx]` |
| WCAG 2 contrast ratios on dark bg | APCA Lc (WCAG 3 draft) | — | The kit gates on APCA Lc via `scripts/check-apca.ts`; verdict-good label target Lc ≥ 60 on-band (UI-SPEC), and Lc ≥ 45 on base `[VERIFIED: check-apca.ts]` |

**Deprecated/outdated:**
- `next/image priority` → use `preload`.
- The stale `components/landing/*` + `layout/header|footer.tsx` are dead (Phase 4 cleanup) — do NOT import them.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | No real screenshot-ready Reading exists in the app today, so the staged-real-keyframe path is the right primary | Summary / Pitfall 1 | LOW — verified `result-card.tsx` placeholders + auth-gated route; if a polished Reading screen ships before build, app-export becomes viable and is strictly better for authenticity |
| A2 | The exact loop cadence / dwell / pause-on-verdict is acceptable as Claude's discretion within "calm" | Pattern 2 | LOW — CONTEXT explicitly grants this discretion |
| A3 | On-band verdict label meets APCA Lc ≥ 60 on `bg-verdict-good` (`#7faf7a`); if not, fall back to a `bg-panel` plate | Pattern 3 | MEDIUM — `check-apca.ts` only measures verdict-good vs BASE (Lc ≥ 45), NOT label-on-band. The planner MUST add a label-on-`#7faf7a` APCA check; UI-SPEC already prescribes the `bg-panel` plate fallback |
| A4 | A single real creator keyframe can be sourced (real still, licensed/owned) before build | D-02 path | MEDIUM — sourcing a genuinely real, rights-clear creator still is a content task, not a code task; planner should surface this as a checkpoint |

## Open Questions

1. **Where does the ONE real creator keyframe come from?**
   - What we know: it MUST be a real still (no stock, no fake chrome). The app can run `/analyze` (auth-gated) to produce a real Reading on a real video.
   - What's unclear: whether a rights-clear real creator video + its keyframe is on hand, or must be sourced.
   - Recommendation: Planner adds a `checkpoint:human-verify` task — "supply ONE real creator keyframe (rights-clear) for the hero" — gating the asset-dependent tasks. The fallback never requires the engine, only a real still + a real-shaped verdict.

2. **Does the verdict-good label clear APCA Lc ≥ 60 directly on `#7faf7a`?**
   - What we know: `check-apca.ts` proves verdict-good vs BASE at Lc ≥ 45, not label-on-band.
   - What's unclear: the on-band label contrast.
   - Recommendation: extend `check-apca.ts` (or a one-off check) to measure the chosen label color on `#7faf7a`; if < 60, use the `bg-panel` plate (UI-SPEC-sanctioned) so the label sits on the plate, not the band.

3. **Stage-read excerpt content for step 2 + loop stage 2.**
   - What we know: it must be "real" (a real stage-read excerpt), VOICE-clean, no engine jargon.
   - What's unclear: exact text.
   - Recommendation: author a short, plain-language line that reads like the product talking about *their* video (VOICE Rule 1) — Claude's discretion within VOICE.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `next` | hero image + CTA | ✓ | 16.1.5 | — |
| `motion` | StageBlock loop | ✓ | ^12.29.2 | — |
| `tailwind-variants` | verdict classes | ✓ | ^3.2.2 | — |
| `lucide-react` | optional step icons | ✓ | ^0.563.0 | omit icons (prefer real artifact) |
| `scripts/check-apca.ts` (apca-w3) | APCA gate | ✓ | apca-w3 ^0.1.9 | — |
| Real creator keyframe asset | HERO-02 | ✗ | — | none — content task (see Open Q1) |
| Sibling app `/analyze` capture | D-02 primary path | ✗ (auth-gated + unshipped verdict UI) | — | staged-real-keyframe (D-02 fallback → promoted to primary) |

**Missing dependencies with no fallback:** the real creator keyframe must be supplied (content task, not code).
**Missing dependencies with fallback:** app-capture path → staged-real-keyframe path (the recommended primary).

## Validation Architecture

> `workflow.nyquist_validation: true` `[VERIFIED: config.json]` — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.0.18` + Testing Library + happy-dom (per-file pragma) |
| Config file | `vitest.config.ts` (include: `src/**/*.test.ts(x)`, `tests/**/*.test.ts`) |
| Quick run command | `pnpm test` (alias `vitest run`) |
| Full suite command | `pnpm test && pnpm tsx scripts/check-apca.ts && pnpm build` |
| Reduced-motion pattern | mock `motion/react` `useReducedMotion: () => true` (see `tests/numen/stage-reveal.test.ts`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HERO-01 | hero renders single `<h1>` + subhead + CTA | unit (render) | `pnpm test -- hero` | ❌ Wave 0 |
| HERO-02 | hero artifact is a real keyframe (asset present in `public/`, `next/image` used, no stock/chrome markers) | unit/asset | `pnpm test -- hero` | ❌ Wave 0 |
| HERO-03 | verdict shown as `VerdictSwatch good` + label + why; NO naked number rendered (assert no `/100`, no `%`) | unit (render) | `pnpm test -- verdict-throne` | ❌ Wave 0 |
| HERO-04 | reduced-motion → end-state, no auto-cycle, no translate | unit (mock `useReducedMotion=>true`) | `pnpm test -- reading-loop` | ❌ Wave 0 |
| READ-01 | 3 steps render (upload → reads → verdict) under `#how-it-works` | unit (render) | `pnpm test -- how-it-works` | ❌ Wave 0 |
| READ-02 | each step shows real content (keyframe / stage-read / band), not icon-only | unit (render) | `pnpm test -- how-it-works` | ❌ Wave 0 |
| CTA-01 | hero CTA is `href="#cta"`, label "Try Numen", focus ring, ≥44px | unit (render) | `pnpm test -- hero` | ❌ Wave 0 |
| (cross) | single `<h1>` on the page | unit (render page) | `pnpm test -- page` | ❌ Wave 0 |
| (cross) | APCA: verdict-good label meets Lc target | script gate | `pnpm tsx scripts/check-apca.ts` | ✓ (extend for label-on-band) |
| (cross) | no forbidden VOICE copy (`%`, "viral", engine terms) in hero/explainer | unit (string scan) | `pnpm test -- voice` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test` (relevant file)
- **Per wave merge:** `pnpm test && pnpm tsx scripts/check-apca.ts`
- **Phase gate:** `pnpm test && pnpm tsx scripts/check-apca.ts && pnpm build` green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/numen-landing/__tests__/hero.test.tsx` — HERO-01/02/CTA-01
- [ ] `src/components/numen-landing/__tests__/reading-loop.test.tsx` — HERO-04 (mock `useReducedMotion`)
- [ ] `src/components/numen-landing/__tests__/verdict-throne.test.tsx` — HERO-03 (assert NO naked number)
- [ ] `src/components/numen-landing/__tests__/how-it-works.test.tsx` — READ-01/02
- [ ] `src/components/numen-landing/__tests__/voice.test.tsx` — forbidden-copy scan (Rules 1–2)
- [ ] Extend `scripts/check-apca.ts` with a label-on-`#7faf7a` pairing (Open Q2)
- [ ] Framework install: none — Vitest already configured.

## Security Domain

> `security_enforcement` not present in `config.json`. This is a static marketing presentation phase with NO input, NO fetch, NO auth, NO data view, NO destructive action. The standard threat surface is minimal.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | no auth this phase |
| V3 Session Management | no | no sessions |
| V4 Access Control | no | public landing |
| V5 Input Validation | no | NO user input this phase (waitlist is Phase 3) |
| V6 Cryptography | no | no secrets/crypto |
| V11 Business Logic (output encoding) | yes | all copy is static JSX strings → React default escaping; NEVER `dangerouslySetInnerHTML` |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Vestibular-motion harm (auto-cycling loop) | (a11y/safety) | reduced-motion end-state, no auto-cycle (HERO-04) — already the gate |
| XSS via dynamic copy | Tampering | static strings only; React JSX escaping; no `dangerouslySetInnerHTML` |
| Reverse tabnabbing (external links) | — | N/A this phase (no new external links; footer already mitigates with `rel="noopener noreferrer"`) |

## Sources

### Primary (HIGH confidence)
- `src/components/numen/stage-reveal.tsx`, `verdict-swatch.tsx`, `surface.tsx` — primitive APIs (VERIFIED, read in full)
- `src/components/numen-landing/section-shell.tsx`, `nav.tsx`, `footer.tsx`, `(marketing)/layout.tsx`, `(marketing)/page.tsx` — slots + CTA + token scope (VERIFIED)
- `src/app/globals.css` — `.numen-surface` tokens + `@theme inline` bridge + `--numen-ease-calm` (VERIFIED)
- `scripts/check-apca.ts` — APCA gate + locked palette (VERIFIED)
- `tests/numen/stage-reveal.test.ts`, `vitest.config.ts` — reduced-motion test pattern + framework (VERIFIED)
- `package.json` — all dependency versions (VERIFIED)
- `~/virtuna-numen-surface/src/lib/reading/verdict-bands.ts`, `src/app/(app)/analyze/{page,[id]/result-card}.tsx` — app verdict shape + capture-path reality (VERIFIED)
- Context7 `/vercel/next.js/v16.1.5` — `next/image` `preload` (replaces `priority`), static-import dims/blur/CLS (CITED)

### Secondary (MEDIUM confidence)
- App `VerdictNode.tsx` (board surface) — confirms verdict UI lives in the Konva board, not a clean capturable Reading screen

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every dependency verified present in `package.json`; zero installs
- Architecture: HIGH — all primitives + slots read in full source
- Capture path: HIGH — directly inspected the app; verdict UI is unshipped + auth-gated, so staged-real-keyframe is the correct primary
- Pitfalls: HIGH — derived from read source (Lightning CSS, token scope, Tailwind dynamic-class, Next 16 `preload`)
- One residual content dependency (the real keyframe) — surfaced as a checkpoint, not a blocker

**Research date:** 2026-06-12
**Valid until:** 2026-07-12 (stable; revisit sooner if the app ships a polished Reading screen — that would re-open the D-02 primary export path)

## RESEARCH COMPLETE

**Phase:** 2 - Hero Centerpiece & Reading Explainer
**Confidence:** HIGH

### Key Findings
- **D-13 spike answer:** App-export is NOT viable today — `/analyze` is auth-gated and its verdict/Reading UI is unshipped (8/11 panels are literal placeholder strings; verdict lives in a Konva board). Promote the D-02 **staged-real-keyframe** path to PRIMARY; mirror only the verdict *shape* from `verdict-bands.ts`.
- **Asset format recommendation:** static-imported `next/image` keyframe + `StageBlock` reveal loop (NOT a captured screenshot, NOT a video). Use Next 16's `preload` (NOT the deprecated `priority`), `placeholder="blur"`, auto intrinsic dims → zero CLS.
- **Zero new dependencies.** All primitives (`StageBlock`, `VerdictSwatch`, `SectionShell`, `Surface`), the `bg-verdict-good` bridge, `--numen-ease-calm`, and `check-apca.ts` already exist and are tested.
- **HERO-04 is the trap:** `StageBlock` handles reduced-motion, but the LOOP CONTROLLER must independently NOT auto-cycle and paint the end-state (test with mocked `useReducedMotion`).
- **Two residual checks for the planner:** (1) supply ONE rights-clear real creator keyframe (content checkpoint), (2) extend `check-apca.ts` to verify the verdict label on `#7faf7a` ≥ Lc 60, else use the `bg-panel` plate.

### File Created
`.planning/phases/02-hero-centerpiece-reading-explainer/02-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | All versions verified in package.json; zero installs |
| Architecture | HIGH | All primitives + slots read in full |
| Capture path | HIGH | App inspected directly — verdict UI unshipped |
| Pitfalls | HIGH | Derived from read source |

### Open Questions
- Source of the real creator keyframe (content task → checkpoint).
- Verdict label APCA Lc on `#7faf7a` (extend the gate, else plate fallback).

### Ready for Planning
Research complete. Planner can create PLAN.md files. Recommend gating asset-dependent tasks behind a `checkpoint:human-verify` for the real keyframe.
