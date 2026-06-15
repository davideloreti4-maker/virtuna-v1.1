# Phase 2: Hero & Signature Moment - Research

**Researched:** 2026-06-15
**Domain:** Bespoke canvas-2D signature animation ("crowd → score") + RSC/client-island composition in Next.js 16 App Router
**Confidence:** HIGH (every reuse target verified against live code; landmine confirmed via official Next.js docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01..D-16 — all human-taken, authoritative)
- **D-01:** Crowd = flocking field of hundreds of soft particles (each dot = one viewer), charcoal/cream. NOT avatar faces, NOT a persona node-cloud.
- **D-02:** Coral `#d97757` is the reaction accent ONLY (pulse/shift as particles react); base field is neutral charcoal/cream.
- **D-03:** Resolve = ONE continuous motion — crowd flows inward and coalesces into / hands off to the score. Not a separate gauge beside a static crowd; not a sentiment-sort.
- **D-04:** Score form = arc/ring gauge with the number in its center (mirrors the real product's arc-gauge instrument).
- **D-05:** Source video = a labelled `<Placeholder variant="video">` TikTok phone frame in-scene; the crowd reacts to it.
- **D-06:** Centered vertical stack (headline → subcopy → CTA → large centered signature stage). NOT split, NOT a full-bleed particle backdrop.
- **D-07:** Contained flat-warm stage — hairline 6% border, 12px radius, tone-step surface. NOT edge-to-edge, NOT freeform-floating.
- **D-08:** Headline + subcopy + CTA + stage all compose within the first viewport on desktop (stacks tall on mobile, headline first).
- **D-09:** H1 = "Know if it'll pop before you post" — LOCKED verbatim (already the page `<title>`).
- **D-10:** Full headline in Newsreader serif; subcopy in Inter. The serif/sans contrast IS the hybrid voice.
- **D-11:** Subcopy = one tight Inter mechanism line naming the real outputs (watch-through %, Hook, Retention, Shareability, virality score). Product noun = "Simulation" (carried D-23). Exact wording is planner/executor's.
- **D-12:** CTA area = primary "Try it free" → `SIGNUP_URL` + a subtle secondary "See how it works ↓" scroll-cue to `#how-it-works`.
- **D-13:** Trigger = autoplay once on mount → settle on the resolved score → stay. Subtle replay on hover/click. No continuous loop.
- **D-14:** At rest = very slow, low-amplitude drift/shimmer; score stays fixed. MUST be cheap + reduced-motion-gated → frozen.
- **D-15:** Fallback = the resolved end-state (phone + settled field + arc ring + final score). ONE composed still serves all three (reduced-motion == rest == pre-hydration).
- **D-16:** Load = still first → lazily mount the animated canvas (`dynamic(..., { ssr:false })`) and play once. Page stays an RSC; the moment is a client island.

### Claude's Discretion — RESOLVED by the APPROVED UI-SPEC (re-confirm, do not re-decide)
- **Build approach →** custom canvas-2D, single rAF loop. NO R3F/three, NO tsparticles/cobe/Magic UI/Aceternity. (UI-SPEC §RESOLVED item 1)
- **Particle count/density/palette/timing →** desktop ≈300–500 dots (never >600); base cream/charcoal + coral reaction lerp; 2–4px radii; total moment ≤~3.5s. (UI-SPEC §RESOLVED item 2)
- **Mobile sim behavior →** default to the resolved STILL on mobile (`useIsMobile` <768px); do not run the particle loop. (UI-SPEC §RESOLVED item 3)
- **Phone-frame content →** static `<Placeholder variant="video">` poster, no looping video for v1. (UI-SPEC §RESOLVED item 4)
- **Exact score value →** ≥70 (lean high-80s, e.g. 87); planner/executor.
- **Exact subcopy + scroll-cue + ring microcopy wording →** planner/executor within D-11/D-12.

### Deferred Ideas (OUT OF SCOPE)
- Live "paste a real link → engine demo" (REQUIREMENTS Out-of-Scope; the moment is a canned cinematic).
- Real hero asset swap in the phone frame (v2 EXPND-02).
- Hero-variant A/B testing (v2 EXPND-03).
- Audio/sound on the moment (project-wide future polish).
- Removing the redundant `framer-motion` dep (Phase 5 deferral).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HERO-01 | Hybrid-voice headline + subcopy communicating "know if it'll pop before you post" | Newsreader serif wired (`--font-serif`, globals.css:123) + Inter (`--font-sans`); H1 verbatim D-09; `--text-display`/`--text-hero`/`--text-4xl` all exist (globals.css:130/136/134). `FadeInUp`/`StaggerReveal` entrance wrappers exist (motion/index.ts). |
| HERO-02 | Primary "Try it free" CTA routes to app signup | `SIGNUP_URL = "/signup"` (routes.ts:10). `<Button variant="primary" asChild>` wraps an `<a>`/`<Link>` (button.tsx:55, asChild via Radix Slot). Essentially wired — carries from Phase 1. |
| HERO-03 | Signature "crowd → score" moment | Custom canvas-2D feasible: `hive-demo-canvas.tsx` proves the DPR/fit/rAF mechanics; `useCountUp` drives the number; SVG arc geometry re-derived from `ViralScoreRing`. Timing ≤3.5s feasible. Zero new deps. |
| HERO-04 | Reduced-motion / lazy fallback (static composed frame) | `ComposedStill` (RSC-renderable, SVG ring + Placeholder + static dots) SSRs; `SignatureMoment` lazily mounts via `dynamic(ssr:false)` from a `"use client"` wrapper; `usePrefersReducedMotion` + `useIsMobile` + `perf-tier` gate still-vs-animate. **All converge on the same still.** |
</phase_requirements>

## Summary

Every reuse target the UI-SPEC commits to **exists in this worktree and its real API matches the spec's assumptions** — with two prop/return-shape gotchas the planner must encode into tasks. The build approach (custom canvas-2D, zero new deps), the score-honesty threshold (`BAND_THRESHOLDS.STRONG = 70`, verified), the ≤3.5s timing budget, and the SSR-still/client-hydrate split are all feasible exactly as specified. The `@theme` tokens (fonts, text sizes, easing curves, coral/charcoal/cream values) all resolve to the names the UI-SPEC uses.

**The single highest planning risk is real and confirmed:** the UI-SPEC's literal wording — *"the page stays an RSC; the moment mounts via `dynamic(..., { ssr:false })`"* — **will throw a build error if implemented as a direct `dynamic(ssr:false)` call inside an RSC.** Next.js 16 App Router forbids `ssr:false` in Server Components (exact error: *"ssr: false is not allowed with next/dynamic in Server Components"*). The correct, officially-documented pattern is the **Client-Only Entrypoint**: the `dynamic(ssr:false)` call must live inside a thin `"use client"` wrapper component, which the RSC `Hero` renders as a child. The in-repo `Board.tsx` already proves this exact shape (it is a `"use client"` module; an RSC `analyze/layout.tsx` simply renders `<Board/>`). The planner must spell out the boundary chain so the executor gets it right the first time.

**Primary recommendation:** Build three components in `src/components/marketing/hero/` — `Hero` (RSC, composition + copy + CTA), `ComposedStill` (RSC-renderable, no canvas: Placeholder + static SVG dot-field + SVG arc ring + final number = the universal floor), and `SignatureMoment` (the `"use client"` canvas island, **with the `dynamic(ssr:false)` call living in a `signature-moment-client.tsx` wrapper, not in `Hero`**). Build `ComposedStill` first (02-03 dependency feeds both 02-02 and 02-03). Drive the score readout with `useCountUp` inside a `<motion.span>` (NOT a plain span). Re-derive clean SVG arc geometry from `ViralScoreRing` (strip its glow filter, green/yellow/red tiers, pure-white text, and its `framer-motion` import). Gate the canvas manually with `usePrefersReducedMotion` / `useIsMobile` / `perf-tier`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Hero layout, copy, H1, CTA, scroll-cue | Frontend Server (RSC) | — | Static marketing markup; no interactivity beyond a `<Link>`. Keep it server-rendered for first paint + SEO. `page.tsx` is already an RSC. |
| Composed still (SSR fallback frame) | Frontend Server (RSC-renderable) | — | Must paint pre-hydration with zero JS (D-15/D-16). Pure DOM + SVG, no canvas, no client hooks → renders on the server. |
| `dynamic(ssr:false)` lazy-mount of the canvas | Browser / Client | — | `ssr:false` is forbidden in RSC (landmine). The call lives in a `"use client"` boundary module; the RSC only renders that boundary. |
| Particle field + coalesce animation | Browser / Client | — | Canvas 2D + rAF are browser-only APIs. Never touch the server. Gated off entirely on mobile/reduced-motion/low-GPU. |
| Score count-up | Browser / Client | — | `useCountUp` uses `motion/react` MotionValues + `requestAnimationFrame`; client-only, reduced-motion self-gated. |
| Reduced-motion / mobile / perf gating | Browser / Client | — | All three signals (`usePrefersReducedMotion`, `useIsMobile`, `perf-tier`) read browser APIs post-mount; they decide whether the island mounts at all. |

## Standard Stack

**Zero new npm dependencies.** The UI-SPEC's assertion is verified correct — everything needed is platform API or already installed.

### Core (all already installed — verified via package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | **16.1.5** | App Router, `next/dynamic`, route groups | Already the framework. **NOTE: CLAUDE.md says "Next.js 15" — STALE. Live version is 16.1.5.** [VERIFIED: package.json] |
| `react` / `react-dom` | 19.2.3 | RSC + client islands | [VERIFIED: package.json] |
| `motion` | ^12.29.2 (the light `motion/react` package) | `useCountUp`, optional H1/CTA entrance wrappers | UI-SPEC's only permitted motion lib; `useCountUp` already imports from it. [VERIFIED: useCountUp.ts:4] |
| HTML5 Canvas 2D | platform | The particle field + coalesce | Zero bundle weight; full art-direction control; proven feasible in-repo. [VERIFIED: hive-demo-canvas.tsx] |
| SVG | platform | The resolved arc ring (crisp pre-hydration in the still) | Renders on the server with no canvas hazard. [CITED: UI-SPEC §RESOLVED item 1] |

### Supporting (already installed — reused, not added)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@pmndrs/detect-gpu` | 6.0.6 | GPU-tier detection behind `perf-tier.ts` | Only transitively, via `detectInitialTier()`. Do not import directly. [VERIFIED: package.json + perf-tier.ts:43] |
| `zustand` | ^5.0.10 | `usePerfStore` global tier store | Via `perf-tier.ts`. [VERIFIED: perf-tier.ts:2] |
| `class-variance-authority` / `clsx` / `tailwind-merge` | 0.7.1 / 2.1.1 / 3.4.0 | `cn()`, CVA component variants | Standard repo convention. [VERIFIED: utils.ts, package.json] |
| `lucide-react` | ^0.563.0 | `Video`/`Play` glyphs in `<Placeholder variant="video">` | Already used by `placeholder.tsx`. No new icons needed. [VERIFIED: placeholder.tsx:3] |

### Alternatives Considered (all REJECTED by the UI-SPEC — do not revisit)
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Canvas-2D | R3F/three (installed) | +~150KB gz on the lazy chunk for no visual gain (flat-warm is 2D); fights FOUND-06 Lighthouse ≥90. **VETOED.** |
| Canvas-2D | tsparticles / cobe / Magic UI / Aceternity | New dep + library abstraction fights the precise coral-only/coalesce art-direction. **VETOED** ("avoid heavy generic particle libs that fight the calm"). |
| `useCountUp` | `ViralScoreRing`'s `useSpring` count | `ViralScoreRing` imports `framer-motion` directly (the dep being removed) + carries glow/tiers/white. Re-derive clean. |

**Installation:** none.

**Version verification (run, confirmed):**
```
next 16.1.5 · react 19.2.3 · motion ^12.29.2 · @pmndrs/detect-gpu 6.0.6 · vitest ^4.0.18
```

## Package Legitimacy Audit

> **Not triggered.** This phase installs **no** external packages — the signature moment is bespoke vanilla canvas + existing in-repo hooks/components (UI-SPEC §Registry Safety, verified against package.json: nothing to add). slopcheck/registry verification N/A. Every library referenced is already a project dependency.

## Architecture Patterns

### System Architecture Diagram

```
                         REQUEST → /  (Next.js 16 App Router, route group (marketing))
                                    │
                                    ▼
                      ┌─────────────────────────────┐
                      │  page.tsx  (RSC)            │   ← stays a Server Component
                      │  <MotionConfigShell>        │      (already wraps the page)
                      │    <Header/>                │
                      │    <main>                   │
                      │      <Hero/>  ◄─────────────┼── NEW (RSC): composition only
                      │      …other sections…       │
                      │    <Footer/>                │
                      └──────────────┬──────────────┘
                                     │ renders
                                     ▼
                      ┌─────────────────────────────┐
                      │  Hero  (RSC)                │   serif H1 (D-09/10)
                      │   ├─ <h1> Newsreader        │   Inter subcopy (D-11)
                      │   ├─ <p>  subcopy           │   CTA cluster (D-12)
                      │   ├─ CTA: <Button asChild>  │
                      │   │       → SIGNUP_URL       │
                      │   └─ STAGE (bordered, D-07) │
                      │        renders BOTH:        │
                      │        ├─ <ComposedStill/>  │◄── NEW (RSC-renderable): the SSR floor
                      │        │     SVG ring + #    │      (no canvas, paints pre-hydration)
                      │        │     + Placeholder   │
                      │        │     + static dots   │
                      │        └─ <SignatureMomentClient/> ◄── NEW ("use client" WRAPPER)
                      │              (the boundary)  │       │
                      └─────────────────────────────┘       │  contains the
                                                            ▼  dynamic(ssr:false) call
                                            ┌──────────────────────────────────────┐
                                            │ signature-moment-client.tsx          │
                                            │  'use client'                        │
                                            │  const Canvas = dynamic(             │
                                            │    () => import('./signature-canvas'),│
                                            │    { ssr:false,                      │
                                            │      loading: () => <ComposedStill/> })│
                                            │  GATE (post-mount):                  │
                                            │   useIsMobile() ───────┐             │
                                            │   usePrefersReducedMotion() ─┤ true →│ render NOTHING (still already shown)
                                            │   perf-tier 'low' / FPS<40 ──┘       │
                                            │   else → <Canvas/>  (play once)      │
                                            └──────────────────┬───────────────────┘
                                                               ▼ desktop + motion OK
                                            ┌──────────────────────────────────────┐
                                            │ signature-canvas.tsx  ('use client') │
                                            │  one <canvas> + single rAF loop      │
                                            │  settle → coral reaction → coalesce  │
                                            │  → hand off to SVG/canvas ring        │
                                            │  → useCountUp number → rest drift     │
                                            │  cancelAnimationFrame on unmount      │
                                            └──────────────────────────────────────┘
```

**Trace the primary case:** request hits the RSC `page.tsx` → renders RSC `Hero` → `Hero` renders the bordered stage containing the SSR'd `ComposedStill` (full payoff visible immediately, no JS) AND the `"use client"` `SignatureMomentClient` boundary → on the client, the boundary checks mobile/reduced-motion/GPU; on desktop with motion OK it lazy-imports the canvas (`ssr:false`, with `ComposedStill` as the loading fallback) and plays the moment once over the still, then rests.

### Recommended Project Structure
```
src/components/marketing/hero/
├── hero.tsx                       # RSC — composition, H1, subcopy, CTA cluster, the stage
├── composed-still.tsx             # RSC-renderable — Placeholder + static SVG dots + SVG ring + number (the universal floor)
├── signature-moment-client.tsx    # "use client" — the dynamic(ssr:false) BOUNDARY + gating (mobile/reduced-motion/perf)
├── signature-canvas.tsx           # "use client" — the bespoke canvas-2D rAF particle/coalesce loop (lazy-loaded target)
├── hero-constants.ts              # score value (≥70), particle budget, timing, easing, palette steps (token-derived)
└── index.ts                       # barrel — re-export Hero (+ types)
```
Then extend `src/components/marketing/index.ts` to re-export from `./hero` (current barrel: placeholder + motion-config only). [VERIFIED: marketing/index.ts]

### Pattern 1: Client-Only Entrypoint for `ssr:false` (THE landmine fix — mandatory)
**What:** `dynamic(..., { ssr:false })` is illegal in a Server Component. Put the call in a `"use client"` module; the RSC renders that module.
**When to use:** Always, for this phase. `Hero` is an RSC and must stay one (D-16).
**Example:**
```tsx
// Source: https://nextjs.org/docs/app/guides/lazy-loading (official "Client-Only Entrypoint")
// signature-moment-client.tsx
'use client'
import dynamic from 'next/dynamic'
import { ComposedStill } from './composed-still'

const SignatureCanvas = dynamic(() => import('./signature-canvas'), {
  ssr: false,
  loading: () => <ComposedStill score={87} />,   // still is the loading fallback (D-16)
})

export function SignatureMomentClient({ score }: { score: number }) {
  // gating decided here (see Pattern 2); on a "still-only" verdict, render nothing
  // (the RSC ComposedStill underneath is already the full frame).
  return <SignatureCanvas /* pass score, timing, palette */ />
}
```
```tsx
// hero.tsx — STAYS an RSC (no "use client"); just composes
import { ComposedStill } from './composed-still'
import { SignatureMomentClient } from './signature-moment-client'
// ...inside the bordered stage:
//   <ComposedStill score={87} />               {/* SSR floor, paints immediately */}
//   <SignatureMomentClient score={87} />       {/* client island plays over it */}
```
**In-repo proof:** `Board.tsx` is `"use client"` (line 1) and does `dynamic(() => import('./BoardCanvas'), { ssr:false, loading: ... })` (Board.tsx:71-74); the RSC `analyze/layout.tsx` simply renders `<Board/>`. Same shape. [VERIFIED: Board.tsx:1,71-74; analyze/layout.tsx]

### Pattern 2: Manual reduced-motion / mobile / perf gating for the non-Framer rAF loop
**What:** `<MotionConfig reducedMotion="user">` cannot reach a raw canvas rAF loop. Gate it by hand.
**When to use:** In `SignatureMomentClient`, to decide whether to mount the canvas at all.
**Example:**
```tsx
// Source: in-repo hooks + perf-tier (verified signatures below)
'use client'
import { useEffect, useState } from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useIsMobile } from '@/hooks/useIsMobile'
import { detectInitialTier, startFpsSampler, usePerfStore } from '@/lib/perf-tier'

const reduced = usePrefersReducedMotion()   // boolean; SSR-safe default = true (no motion)
const isMobile = useIsMobile()              // boolean; SSR-safe default = true (mobile)
const tier = usePerfStore((s) => s.tier)    // 'high' | 'medium' | 'low'; default 'high'
// detectInitialTier() in a post-mount effect (never block first paint), startFpsSampler(onDrop)
// to settle to the still on sustained <40fps. Mirror Board.tsx:364-384.
const animate = !reduced && !isMobile && tier !== 'low'
```
**Why SSR defaults matter:** both `usePrefersReducedMotion` (returns `true` until mount, usePrefersReducedMotion.ts:13) and `useIsMobile` (returns `true` until mount, useIsMobile.ts:13) default to the *conservative, still-favoring* value. The canvas only ever activates after a client effect confirms desktop + motion-OK — so first paint is always the still. This is exactly the desired behavior.

### Pattern 3: DPR-aware single-rAF canvas (copy the mechanics, not the look, from hive-demo)
**What:** The reusable canvas plumbing the executor should lift from `hive-demo-canvas.tsx`.
**The 6 mechanics to copy (hive-demo-canvas.tsx line refs):**
1. `const dpr = window.devicePixelRatio || 1` and size the backing store to `Math.round(rect.width * dpr)` only when it changed (lines 52-60).
2. `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` then draw in CSS px (line 62).
3. `getBoundingClientRect()` fit transform: compute `scale`/`offsetX`/`offsetY` from content bounds + padding (lines 53, 66-71).
4. Idle/float loop via `elapsed * k` feeding `Math.sin/cos` for cheap drift (lines 83-91) — reuse for the D-14 at-rest shimmer.
5. `style={{ touchAction: "auto" }}` so the canvas never blocks page scroll (line 155).
6. `animRef = requestAnimationFrame(draw)` in the effect; `cancelAnimationFrame(animRef.current)` in cleanup (lines 145-148).
**Pre-compute static data once at module scope** (hive-demo does `BOUNDS`/`NODE_MAP` at lines 9-24) — generate the particle start positions once, not per frame.
**Reject the aesthetic:** hive-demo uses `rgba(255,255,255,…)` strokes/nodes (lines 109, 128-137) — that white is the retired look. Use token-derived cream/charcoal + coral-only reaction.

### Pattern 4: `useCountUp` returns a `MotionValue<string>` — render in `<motion.span>`
**What:** The score readout. Signature: `useCountUp({ to, duration?, format? }): MotionValue<string>` (useCountUp.ts:51-55).
**Critical gotcha (from the hook's own docblock + the one existing call site):**
```tsx
// Source: useCountUp.ts:33-49 docblock + earnings-stat-cards.tsx:50 (the only consumer)
import { motion } from 'motion/react'
import { useCountUp } from '@/hooks/useCountUp'
const display = useCountUp({ to: 87, duration: 1.2 })   // ≈ the UI-SPEC's 1.0–1.4s coalesce window
return <motion.span>{display}</motion.span>             // MUST be motion.span — a plain <span> renders "[object Object]"
```
- It is **already `usePrefersReducedMotion`-gated**: under reduce it calls `count.jump(to)` (instant, no animation) (useCountUp.ts:64-66). So in the *still*, the final number shows immediately. ✔ matches D-15.
- It is on **`motion/react`** (the light package), not `framer-motion`. ✔ matches the library-boundary rule. [VERIFIED: useCountUp.ts:4]

### Anti-Patterns to Avoid
- **Calling `dynamic(ssr:false)` inside `Hero` (the RSC).** Build error: *"ssr: false is not allowed with next/dynamic in Server Components."* Use the `"use client"` boundary (Pattern 1).
- **Importing `ViralScoreRing` / anything from `board/*`, `viral-results/*`, `hive-demo/*`, `audience/*`.** They carry glow/glass/old-brand/green-yellow-red/pure-white and (for `ViralScoreRing`) `framer-motion`. Re-derive clean (UI-SPEC §Component Inventory "Do NOT import").
- **Rendering `useCountUp`'s return in a plain `<span>`.** Renders `[object Object]`.
- **`--ease-spring` on the coalesce.** Overshoot reads "bouncy/flashy," not calm. Use `--ease-out-quart` for the inward arrival (UI-SPEC §RESOLVED item 2).
- **A separate gauge filling beside a static crowd.** Violates D-03 (one continuous coalesce gesture).
- **Hardcoding hex in component code.** Reference semantic tokens / read CSS vars; coral is the lone accent (Phase-1 D-06).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Count-up number animation | A custom rAF counter | `useCountUp` (useCountUp.ts) | Already reduced-motion-gated, MotionValue-based (no per-frame React re-render), proven at one call site. |
| GPU-tier detection / FPS degrade | A custom WebGL/timing probe | `detectInitialTier()` + `startFpsSampler()` + `usePerfStore` (perf-tier.ts) | Cached (7-day localStorage), fail-open, single-drop semantics; mirrors `Board.tsx` usage. |
| Reduced-motion detection (non-Framer) | `window.matchMedia` ad-hoc | `usePrefersReducedMotion` (hooks/) | SSR-safe default, change-listener, already the repo convention. |
| Mobile detection | `window.innerWidth` ad-hoc | `useIsMobile` (hooks/) | SSR-safe default (true), 768px breakpoint, resize listener. |
| The phone/video frame | A custom aspect box | `<Placeholder variant="video">` (placeholder.tsx) | Aspect-locked (no CLS), flat-warm chip + Play overlay, one-prop `src` swap path. |
| Primary CTA-as-link | A styled `<a>` | `<Button variant="primary" asChild>` (button.tsx) | Inherits coral `shadow-button`, focus ring, 44px target; `asChild` composes a `<Link>`. |
| DPR/fit/rAF canvas plumbing | From-scratch boilerplate | Copy mechanics from `hive-demo-canvas.tsx` | Proven DPR handling, fit transform, scroll-safe `touchAction`, clean unmount. |

**Key insight:** The hard, edge-case-laden parts (perf degradation, reduced-motion, DPR, no-CLS framing, count-up) are all already solved in-repo and battle-tested by the product app. The phase's genuinely-new work is narrow: the *choreography* of the particle field coalescing into the ring (the art), and getting the RSC→client-island boundary right (the landmine). Spend effort there; reuse everything else.

## Runtime State Inventory

> N/A — this is a **greenfield additive** phase (new components in `src/components/marketing/hero/` + replacing one stub `<section>`). No rename/refactor/migration. No stored data, live-service config, OS-registered state, secrets, or build artifacts are touched.

## Common Pitfalls

### Pitfall 1: `dynamic(ssr:false)` in a Server Component (THE landmine)
**What goes wrong:** Build fails — *"ssr: false is not allowed with next/dynamic in Server Components."*
**Why it happens:** The UI-SPEC's prose says "the page stays an RSC; the moment mounts via `dynamic(ssr:false)`" — read literally, an executor puts the `dynamic()` call in the RSC `Hero`. Next.js 16 App Router forbids it.
**How to avoid:** Client-Only Entrypoint (Pattern 1) — the `dynamic(ssr:false)` call lives in a `"use client"` wrapper (`signature-moment-client.tsx`); `Hero` (RSC) renders the wrapper. Confirmed by official docs AND `Board.tsx`.
**Warning signs:** A `dynamic(`…`{ ssr: false })` line in any file that does NOT start with `'use client'`.

### Pitfall 2: `useCountUp` rendered in a plain element
**What goes wrong:** The score shows `[object Object]` instead of a number.
**Why it happens:** The hook returns `MotionValue<string>`; only `motion.*` elements subscribe to MotionValue updates.
**How to avoid:** `<motion.span>{display}</motion.span>` (the hook's docblock is explicit; the lone consumer does this).
**Warning signs:** `{display}` inside `<span>`/`<div>`/`<p>`.

### Pitfall 3: Hydration mismatch / CLS from differing SSR vs client frames
**What goes wrong:** Layout shift or a hydration warning when the client island swaps in.
**Why it happens:** If the still and the canvas mount occupy differently-sized boxes, or the still isn't dimension-locked.
**How to avoid:** Lock the stage box with `aspect-ratio` (the `<Placeholder>` already does this for the phone). The canvas mounts *over* the still inside the same fixed box; the still never unmounts on the gated path (it IS the loading fallback and the still-only render). No reserved-space change. (UI-SPEC §A11y/Perf "No CLS — the stage box is dimension-locked.")
**Warning signs:** The stage `<div>` without a fixed aspect-ratio/height; the still being conditionally removed from the tree before the canvas paints.

### Pitfall 4: Stale CLAUDE.md version + Tailwind v4 quirks
**What goes wrong:** Planning against Next 15 semantics; or coral/dark tokens compiling wrong.
**Why it happens:** CLAUDE.md says "Next.js 15" — live is **16.1.5**. Tailwind v4 `@theme` mis-compiles very dark oklch (L<0.15); Lightning CSS strips `backdrop-filter`.
**How to avoid:** Treat Next as 16 (the `dynamic`/RSC rules above are 16-correct). Flat-warm has no blur, so the backdrop-filter issue is moot. Dark tokens already use hex in globals.css (charcoal-app `#262624` etc., globals.css:45-48). Reference semantic token names; don't reintroduce hex.
**Warning signs:** Hand-written hex in hero components; any `backdrop-blur`/glass class.

### Pitfall 5: Reduced-motion "freeze" not actually freezing the at-rest drift
**What goes wrong:** The D-14 ambient drift keeps running under `prefers-reduced-motion`.
**Why it happens:** The drift is part of the same rAF loop; if the gate only blocks the *intro* animation, the rest-drift survives.
**How to avoid:** Under `usePrefersReducedMotion() === true`, the canvas island must not mount at all (render the static still) — Pattern 2. The still has zero motion by construction (D-15). Don't rely on `MotionConfig` for the canvas.
**Warning signs:** rAF still scheduled when `reduced === true`; drift visible with OS reduce-motion on.

## Code Examples

### Re-derived clean SVG arc ring (geometry from ViralScoreRing, everything-else stripped)
```tsx
// Geometry source: ViralScoreRing.tsx:87-93 (radius/circumference/strokeDashoffset).
// STRIPPED vs the product component: glow <filter feGaussianBlur> (ViralScoreRing.tsx:144-151),
// getGlowColor green/yellow/red (45-49), pure-white text "text-white"/"text-white/50" (185,192),
// the framer-motion import (line 4), the tier label.
// score≥70 ⇒ a single strong coral arc is HONEST (no tier palette needed).
const SIZE = 240, STROKE = 12;
const radius = (SIZE - STROKE) / 2;
const circumference = 2 * Math.PI * radius;
const offset = circumference - (score / 100) * circumference;   // score→arc

<svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90"
     role="img" aria-label={`A synthetic audience reacts to a video and resolves into a virality score of ${score} out of 100.`}>
  {/* track — secondary tone, NOT white/10 */}
  <circle cx={SIZE/2} cy={SIZE/2} r={radius} fill="none"
          stroke="var(--color-surface-elevated)" strokeWidth={STROKE} />
  {/* progress — coral accent, no glow filter */}
  <circle cx={SIZE/2} cy={SIZE/2} r={radius} fill="none"
          stroke="var(--color-accent)" strokeWidth={STROKE} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset} />
</svg>
// center number: cream/coral per UI-SPEC §Color, tabular-nums, --text-display 64px / 600.
// In ComposedStill: static offset (final). In the canvas play: animate offset over the coalesce window.
```

### Token-derived constants (no hardcoded hex)
```ts
// hero-constants.ts — values read from the verified @theme tokens (globals.css)
export const HERO_SCORE = 87;                       // ≥ BAND_THRESHOLDS.STRONG (70) ⇒ coral is honest
export const PARTICLE_COUNT_DESKTOP = 420;          // 300–500, never >600 (UI-SPEC)
export const TIMING = { settle: 550, reaction: 800, coalesce: 1200, total: 3500 } as const; // ms, ≤3.5s
// Easing tokens (globals.css:188-191): coalesce → --ease-out-quart cubic-bezier(0.165,0.84,0.44,1)
//   reaction wave → --ease-out-cubic cubic-bezier(0.215,0.61,0.355,1); rest drift → gentle sine.
// Palette (read via getComputedStyle on a token element, or mirror the values):
//   base dots: --color-cream-secondary #c2bdb4 / --color-cream-muted #8a857c (alpha 0.25–0.55)
//   depth chips: --color-charcoal-chip #2f2e2b
//   reaction: lerp → --color-coral-500 oklch(0.68 0.13 33) ≈ #d97757, peak alpha ~0.9
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `dynamic(ssr:false)` allowed anywhere | Forbidden in Server Components → must be in a `"use client"` module | Next.js 13+ App Router (enforced through 16) | The core landmine; dictates the component boundary chain. [CITED: nextjs.org/docs/app/guides/lazy-loading] |
| `framer-motion` import | `motion/react` (the light package) | Phase-1 D-16 (this milestone) | Use `motion/react` only; `useCountUp` already does. `ViralScoreRing`'s `framer-motion` import is a reason not to reuse it. |
| Raycast cold brand (#FF7F50, #07080a, glass) | Flat-warm (charcoal #262624, cream, terracotta #d97757, flat-matte) | Phase-1 D-01 (UAT-locked THEME-06) | All hero visuals use flat-warm tokens; no glow/glass. The repo-root BRAND-BIBLE.md is STALE. |

**Deprecated/outdated:**
- **CLAUDE.md "Next.js 15"** — live is **16.1.5**. Plan against 16.
- **`~/virtuna-numen-rework/BRAND-BIBLE.md` and repo-root `BRAND-BIBLE.md`** — STALE (old Raycast glass). SSOT = `globals.css` + the CONTEXT files.
- **CONTEXT's "port `usePrefersReducedMotion` / `useIsMobile` from numen-rework"** — STALE. **Both already exist in THIS worktree** (`src/hooks/usePrefersReducedMotion.ts`, `src/hooks/useIsMobile.ts`). No port needed — import directly. [VERIFIED]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The composed-still's "settled particle field" is best represented as a small static SVG/DOM scatter of low-alpha cream/charcoal dots (≈30–60, decorative) — NOT a canvas, NOT a heavy texture. | Composed-still approach | LOW. It's a marketing decorative frame; any cheap static representation satisfies D-15. If the executor prefers a faint CSS radial-dot texture or a single decorative SVG `<g>` of circles, that's equally fine. Recommendation: a handful of SVG `<circle>`s positioned around the ring at low opacity = crisp, server-rendered, ~zero cost. |
| A2 | High-80s (87) is the chosen score. | Color / hero-constants | LOW. Any value ≥70 is honest (BAND_THRESHOLDS.STRONG verified =70). Planner/executor may pick another ≥70 value. |
| A3 | `detectInitialTier()` + `startFpsSampler()` graceful-degrade is "nice-to-have" for desktop since mobile already defaults to the still; the must-have gates are `useIsMobile` + `usePrefersReducedMotion`. | Pattern 2 / mobile resolution | LOW. UI-SPEC marks the medium-tier reduced-density path "optional, executor's discretion." The FPS-drop→still path is a robustness add, not a correctness gate. |

**Note:** No assumptions touch compliance/security/retention. All structural claims (APIs, exports, the landmine, the threshold, versions, tokens) are VERIFIED against live code or official docs, not assumed.

## Open Questions

1. **Does the coalesce hand off to an SVG ring or a canvas-drawn ring?**
   - What we know: UI-SPEC explicitly leaves this to the executor ("animates via SVG `strokeDashoffset` … OR is drawn on the same canvas — executor's call; both are cheap"). The *composed still* ring MUST be SVG (crisp pre-hydration).
   - What's unclear: whether the *animated* ring is SVG (cleaner crossfade to the still) or canvas (single render surface).
   - Recommendation: animate an SVG ring overlaid on the canvas — it makes the canvas→still handoff seamless (the same SVG ring is present in both), and the count-up `<motion.span>` lives in the DOM anyway. Not a blocker; either works.

2. **Replay affordance: hover-only, or also keyboard-operable?**
   - What we know: D-13 wants "subtle replay on hover/click." UI-SPEC §A11y: if replay is mouse-hover-only it must NOT be the sole way to perceive the moment (the still already shows the full outcome, so this is satisfied).
   - Recommendation: make the stage a `<button aria-label="Replay the simulation">` wrapper OR a hover/click handler with the still as the accessible baseline. Keyboard-operable replay is a small nicety, not required for a11y (the outcome is always visible). Planner decides; lean: click-to-replay on the stage container, hover as enhancement.

## Environment Availability

> N/A for external services — this is a code-only phase (no DB, no live services, no new CLIs). All build/test tooling is already installed and verified:

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node/Next toolchain | build/dev | ✓ | next 16.1.5 | — |
| Vitest + happy-dom + @testing-library/react | unit tests | ✓ | vitest ^4.0.18 / happy-dom ^20.9.0 / RTL ^16.3.2 | — |
| @playwright/test | (optional) e2e for lazy-mount/CLS | ✓ | ^1.58.0 | unit tests cover most behaviors |
| @pmndrs/detect-gpu | perf-tier | ✓ | 6.0.6 | perf-tier fails open to 'high' |

**Missing dependencies:** none.

## Validation Architecture

> nyquist_validation is **enabled** (`.planning/config.json` workflow.nyquist_validation = true).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | **Vitest 4** (`^4.0.18`) + `@testing-library/react ^16.3.2` + `@testing-library/jest-dom ^6.9.1`; DOM env = **happy-dom ^20.9.0** |
| Config file | **none** — there is NO `vitest.config.*` in the repo. Tests opt into a DOM via a per-file pragma `/** @vitest-environment happy-dom */` (see `src/components/marketing/__tests__/placeholder.test.tsx:1`). New component/hook tests MUST include this pragma. |
| Quick run command | `npx vitest run <path>` (single file) |
| Full suite command | `npm test` (= `vitest run`; 215 test files currently) |
| E2E (optional) | `npm run e2e` (Playwright, `e2e/playwright.config.ts`) — for lazy-mount + no-CLS + reduced-motion in a real browser |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HERO-01 | H1 renders verbatim "Know if it'll pop before you post" in a real `<h1>` with the serif (`--font-serif`) class; subcopy present in Inter | unit (RTL) | `npx vitest run src/components/marketing/hero/__tests__/hero.test.tsx` | ❌ Wave 0 |
| HERO-02 | Primary CTA is a link whose href === `SIGNUP_URL` ("/signup"); secondary scroll-cue href === `#how-it-works` | unit (RTL) | same file | ❌ Wave 0 |
| HERO-03 | `ComposedStill` renders an SVG arc ring with `strokeDashoffset` mapped from score, a coral progress stroke, and the score number; score ≥ 70 | unit (RTL + DOM assert) | `npx vitest run src/components/marketing/hero/__tests__/composed-still.test.tsx` | ❌ Wave 0 |
| HERO-03 | Score honesty: the rendered score constant ≥ `BAND_THRESHOLDS.STRONG` (70) | unit (assert constant) | `npx vitest run src/components/marketing/hero/__tests__/hero-constants.test.ts` | ❌ Wave 0 |
| HERO-04 | Stage container has `role="img"` + an `aria-label` containing the score | unit (RTL) | composed-still test | ❌ Wave 0 |
| HERO-04 | Under reduced-motion (mock `usePrefersReducedMotion → true`), the canvas island does NOT mount; the still stands | unit (RTL + mock) | `npx vitest run src/components/marketing/hero/__tests__/signature-moment-client.test.tsx` | ❌ Wave 0 |
| HERO-04 | On mobile (mock `useIsMobile → true`), the canvas island does NOT mount | unit (RTL + mock) | signature-moment-client test | ❌ Wave 0 |
| HERO-04 | The `dynamic(ssr:false)` call lives in a `"use client"` module (boundary correctness) | static / build | `npm run build` succeeds (an `ssr:false`-in-RSC error fails the build) — optionally a grep test asserting `signature-moment-client.tsx` starts with `'use client'` | ❌ Wave 0 (build is the real gate) |
| HERO-04 | No layout shift: stage box is aspect/dimension-locked (the still occupies the same box the canvas mounts into) | unit (style assert) + optional Playwright CLS | composed-still test asserts an `aspect-ratio`/fixed height on the stage; optional `npm run e2e` | ❌ Wave 0 (unit) |
| HERO-03 | FPS-drop → settle to still (graceful degrade) | unit (mock `startFpsSampler` onDrop) — optional | signature-moment-client test | ❌ Wave 0 (optional) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/components/marketing/hero/` (the phase's tests only — fast).
- **Per wave merge:** `npm test` (full 215-file suite — must stay green; the phase is additive so it should not perturb existing tests).
- **Phase gate:** Full suite green **and** `npm run build` succeeds (the build is the authoritative check for the `ssr:false`/RSC landmine) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `src/components/marketing/hero/__tests__/hero.test.tsx` — covers HERO-01, HERO-02 (H1 verbatim + serif class + CTA href = SIGNUP_URL + scroll-cue href).
- [ ] `src/components/marketing/hero/__tests__/composed-still.test.tsx` — covers HERO-03/HERO-04 (SVG ring geometry + coral stroke + score number + `role="img"`/aria-label + aspect-lock).
- [ ] `src/components/marketing/hero/__tests__/signature-moment-client.test.tsx` — covers HERO-04 gating (reduced-motion → no canvas; mobile → no canvas; optional FPS-drop → still). Mock the three hooks/`perf-tier`.
- [ ] `src/components/marketing/hero/__tests__/hero-constants.test.ts` — covers score ≥ 70 honesty.
- [ ] Every new `*.test.tsx` MUST begin with `/** @vitest-environment happy-dom */` (no global vitest config to set the env).
- [ ] No framework install needed (Vitest + happy-dom + RTL all present). No `vitest.config` needs creating — the pragma pattern is the established convention.

## Security Domain

> `security_enforcement` is **not set** in `.planning/config.json` (treated as default). This phase is a **static marketing surface** with no auth, no user input, no data persistence, no secrets, no file paths, no network calls beyond a `<Link href="/signup">`. The ASVS input-validation/auth/session/crypto categories do not apply.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | CTA links to the app's existing `/signup`; no auth logic here. |
| V3 Session Management | no | No sessions on the marketing page. |
| V4 Access Control | no | Public marketing page. |
| V5 Input Validation | no | No user input on this surface (the phone is a static placeholder; no real "paste a link" — explicitly out of scope). |
| V6 Cryptography | no | None. |

**Only relevant hardening (already covered by the design contract):** the `<Placeholder>` `src` is a build-time developer path, never end-user input (placeholder.tsx docblock). No `dangerouslySetInnerHTML`. No external script. The single outbound link is a same-origin app route. Nothing to add.

## Sources

### Primary (HIGH confidence)
- **Live code, this worktree (VERIFIED):** `hive-demo/hive-demo-canvas.tsx`, `hooks/useCountUp.ts`, `lib/perf-tier.ts`, `viral-results/ViralScoreRing.tsx`, `marketing/placeholder.tsx`, `hooks/usePrefersReducedMotion.ts`, `hooks/useIsMobile.ts`, `board/Board.tsx`, `board/BoardCanvas.tsx`, `app/(app)/analyze/layout.tsx`, `lib/routes.ts`, `lib/utils.ts`, `marketing/index.ts`, `marketing/motion-config.tsx`, `components/motion/*`, `ui/button.tsx`, `app/(marketing)/page.tsx`, `app/globals.css`, `board/verdict/verdict-constants.ts`, `marketing/__tests__/placeholder.test.tsx`, `package.json`, `.planning/config.json`.
- **Context7 `/vercel/next.js`** — lazy-loading / `ssr:false` Client-Only Entrypoint pattern (the landmine fix). https://nextjs.org/docs/app/guides/lazy-loading
- **CONTEXT.md (D-01..D-16) + APPROVED UI-SPEC.md** — the authoritative design contract.

### Secondary (MEDIUM confidence — cross-verified with Context7)
- WebSearch: "ssr: false is not allowed with next/dynamic in Server Components" — confirms the exact error string + the `"use client"` wrapper fix. https://nextjs.org/docs/app/guides/lazy-loading

### Tertiary (LOW confidence)
- None — all critical claims verified against live code or official docs.

## Metadata

**Confidence breakdown:**
- Standard stack / zero-new-deps: **HIGH** — package.json read directly; every lib confirmed installed.
- Reuse-target APIs (hooks/components/signatures): **HIGH** — every file read; signatures/line refs cited.
- The `ssr:false`/RSC landmine + fix: **HIGH** — official Next.js docs (Context7) + web search + in-repo `Board.tsx` proof all agree.
- Score-honesty threshold: **HIGH** — `BAND_THRESHOLDS.STRONG = 70` read from verdict-constants.ts:5.
- Timing/perf feasibility: **HIGH** — hive-demo proves ~1300 nodes @60fps; 300–500 dots is well within budget.
- Composed-still "settled field" representation: **MEDIUM** — A1 is a recommendation, not a locked spec (UI-SPEC leaves the static representation open).

**Research date:** 2026-06-15
**Valid until:** ~2026-07-15 (stable; Next.js `ssr:false` rule and the in-repo APIs are not fast-moving). Re-verify if Next.js majors again or the flat-warm theme is re-UAT'd.

---

## Appendix: Mapping to the suggested 3-plan split (ROADMAP 02-01/02/03)

| Plan | Scope | Reuse targets | Cross-plan dependency |
|------|-------|---------------|------------------------|
| **02-01** — hero layout/copy/CTA (HERO-01, HERO-02) | RSC `Hero`: serif H1 (verbatim D-09), Inter subcopy (D-11), CTA cluster (primary→`SIGNUP_URL` + scroll-cue→`#how-it-works`), the bordered flat-warm stage shell (D-07). Replace the `<section id="hero">` stub in `page.tsx`. | `Button` (asChild), `SIGNUP_URL`, `--font-serif`, `--text-*`, optional `FadeInUp`/`StaggerReveal`, `cn()`. | **Owns the stage container** that 02-03's `ComposedStill` and 02-02's island mount into. The stage's aspect-lock (no-CLS) is decided here. |
| **02-03** — composed still + lazy/reduced-motion/mobile gating (HERO-04) | `ComposedStill` (RSC, SVG ring + Placeholder phone + static dots + number) **and** `SignatureMomentClient` (the `"use client"` `dynamic(ssr:false)` boundary + gating). | `<Placeholder variant="video">`, re-derived SVG ring (geom from `ViralScoreRing`), `usePrefersReducedMotion`, `useIsMobile`, `perf-tier`, `useCountUp` (for the still's instant number). | **`ComposedStill` is SHARED — built here, consumed by 02-02 as the canvas's `loading`/at-rest baseline AND as the gated still-only render.** Build `ComposedStill` EARLY (it is the dependency hub). |
| **02-02** — signature canvas moment (HERO-03) | `signature-canvas.tsx`: the bespoke canvas-2D rAF particle field → coral reaction → coalesce → ring handoff → `useCountUp` number → rest drift. | hive-demo canvas mechanics (copy, not import), `useCountUp` (in `<motion.span>`), `hero-constants.ts`, easing/color tokens. | **Depends on `ComposedStill` (from 02-03) existing** as the `dynamic` `loading` fallback and the visual target the coalesce must match. The ring end-state in the canvas must be pixel-consistent with `ComposedStill`'s SVG ring. |

**Build-order implication (IMPORTANT for the planner):** the ROADMAP lists 02-01 → 02-02 → 02-03, but the **dependency order is 02-01 (stage shell) → 02-03 (`ComposedStill` + boundary) → 02-02 (canvas)**. `ComposedStill` is the keystone artifact shared by both 02-02 and 02-03; the canvas in 02-02 imports it as its loading fallback and must visually converge on it. Recommend either resequencing to 01 → 03 → 02, or splitting `ComposedStill` into its own early sub-step that 02-02 and 02-03 both consume. At minimum, `ComposedStill` and the stage container must land before the canvas work begins.
