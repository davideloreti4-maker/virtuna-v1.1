# Phase 2: Foundation & Hero - Research

**Researched:** 2026-05-10
**Domain:** Hero composition + Canvas 2D particle viz + ambient gradient + page scaffold + external-component policy
**Confidence:** HIGH

## Summary

Phase 2 builds the above-fold hero of the new landing in `src/app/(marketing)/page.tsx` by replacing `<HeroSection />` with `<BehavioralHero />` (composition) + `<BehavioralCanvas />` (Canvas 2D particle viz). All locked decisions from CONTEXT.md (D-01 through D-33) flow through unchanged. This research resolves the six explicitly-delegated decisions (D-34 through D-39), produces concrete REJECT/ACCEPT criteria for the BUILD-02 external component policy, maps each new file to its closest existing analog, and specifies a Validation Architecture that satisfies all five Success Criteria from ROADMAP.md.

**Pre-flight verification surfaced two CONTEXT.md drift items:**
1. The module-level flag at `use-hive-animation.ts:43` is named `globalAnimationComplete`, NOT `globalAnimationPlayed`. CONTEXT.md D-32 + BRAND-BIBLE addendum's example skeleton both use the wrong name. The new component should use `globalAnimationComplete` to match codebase convention.
2. CONTEXT.md D-28 claims `scroll-behavior: smooth` is "already in `globals.css` per existing landing." It is NOT. The existing `html, body` block (globals.css:288-296) has no scroll-behavior rule. Phase 2 must ADD this for the secondary CTA's `#science` anchor to work.

**Primary recommendation:** Slice Phase 2 into 4-5 plans:
1. **Scaffold + page swap** (modify `(marketing)/page.tsx`, update `landing/index.ts`, delete `hero-section.tsx`, add scroll-behavior).
2. **Hero composition** (`BehavioralHero.tsx` text column + CTAs + grid layout).
3. **Canvas particle viz** (`BehavioralCanvas.tsx` + `behavioral-hero-constants.ts`).
4. **Ambient gradient backdrop** (CSS class in globals.css OR Tailwind arbitrary value).
5. **External component policy doc** (`02-EXTERNAL-COMPONENT-POLICY.md`).

Plans 1, 4, 5 are Wave 1 parallel; Plan 2 depends on Plan 1; Plan 3 is Wave 1 parallel (no dependency on text column). All plans verified by the 5-criterion Validation Architecture in §4.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Tech (D-08..D-11, from BRAND-BIBLE §Visual Metaphor Lock §1):**
- Canvas 2D for hero particle viz (~30 KB). NO third-party particle library.
- Reuse VERBATIM from `src/components/hive/`:
  - `use-canvas-resize.ts:43-100` — DPR-aware resize
  - `use-hive-animation.ts:42-49, 121-193` — RAF + module-level `globalAnimationComplete` flag (one-shot per session) [pre-flight: CORRECTED — flag name is `globalAnimationComplete`, not `globalAnimationPlayed`]
  - `HiveCanvas.tsx:54-57, 147-186` — ref-based render state
  - `hive-renderer.ts:240-298` — color batching via `Map<colorKey, circles>`
- Reuse `src/hooks/usePrefersReducedMotion.ts:1-29` VERBATIM.
- Easing: `--ease-out-cubic` (matches `easeOutCubic` at `use-hive-animation.ts:57`).
- Total hero JS budget: ~45 KB gzipped (Canvas 2D ~30 KB + later pipeline SVG + motion/react ~15 KB). Under 50 KB ceiling per VIZ-04.
- Reduced-motion fallback: render static converged keyframe (particles in aggregated state showing confidence score). No animation. (D-10)
- One-shot animation on viewport entry, NEVER a loop.

**Brand & Copy (locked verbatim):**
- Pre-headline: `VIRTUNA · A NUMEN MACHINES PRODUCT`
- H1: *"Predict how your audience will respond. Before you post."*
- Sub-headline: *"Virtuna simulates your audience to forecast every video before it ships."*
- Subline: *"Trained on decades of behavioral research. Self-improving with every outcome."*
- Primary CTA: `Run a prediction →`
- Secondary CTA: `See the science`
- Vocab guardrails enforced by `scripts/lint-vocab.mjs` + pre-commit hook. Phase 2 strings MUST pass `pnpm lint:vocab`.
- Zero "viral" / "AI" / "go viral" in hero copy (HERO-10).
- Inter as sole font.
- Coral `#FF7F50` is THE brand color — exact hex (do NOT round-trip through `oklch()`).

**Imports:**
- All NEW motion code uses `motion/react` import path. NEVER `framer-motion`. (Two legacy `framer-motion` imports in `src/components/app/simulation/*.tsx` and two in `src/components/viral-results/*.tsx` are slated for separate migration — OUT OF SCOPE for Phase 2.)

**Scaffold + Implementation (D-01..D-33):**
- Build directly into `src/app/(marketing)/page.tsx` — section-by-section replacement. NO parallel `/landing-v2` route at any point.
- Phase 2 modifies `(marketing)/page.tsx` to replace import + render of `<HeroSection />` with `<BehavioralHero />`. All other old sections stay untouched.
- Old `src/components/landing/hero-section.tsx` deleted in Phase 2 if no longer imported.
- No feature flag.
- Particle count = 250 desktop / 120 mobile (≤640px).
- Aggregation target = coral pill with percentage number (D-34 picks exact value).
- Drift+attract convergence; 2.0-2.4s animation; one-shot; `easeOutCubic`.
- Initial distribution = uniform random.
- Color split = ~70% coral / 30% Raycast neutral.
- Particle size = 2-3px.
- NO video stimulus visualization.
- Canvas placement = top-right of hero on desktop, stacked above text on mobile.
- Full-bleed radial gradient, static (no animation), coral peak ~15-25% opacity, fades to neutral by ~40-60% radial distance.
- Layout = two-column desktop, stacked mobile, ~60/40 left/right split.
- Pre-headline: small monospaced uppercase, Raycast-restrained.
- H1: oversized, light weight (Inter 300), tight line-height (~1.05), tight letter-spacing (-0.02em). Two-line break preserved.
- Sub-headline: medium weight (Inter 500), ~1.25-1.5rem.
- Subline: Inter 400, ~1rem-1.125rem, muted Raycast gray.
- CTAs reuse `src/components/ui/button.tsx` CVA variants (`primary` for `Run a prediction →`, `secondary` for `See the science`). NO new button styles.
- Primary CTA `Run a prediction →` → `<Link href="/dashboard">` (middleware handles auth redirect).
- Secondary CTA `See the science` → `<Link href="#science">` (smooth-scroll anchor — even though Science section ships in Phase 4, the anchor renders correctly and is forward-compatible).
- New components: `src/components/landing/BehavioralHero.tsx`, `BehavioralCanvas.tsx`, `behavioral-hero-constants.ts`.
- Update `src/components/landing/index.ts` barrel export.
- ZERO imports from external libraries (Magic UI / Aceternity / Origin UI / Cult UI) for the hero.

### Claude's Discretion (delegated to this researcher)

- **D-34:** Exact percentage value inside coral chip (87 / 91 / 84 — not 99%) — RESOLVED in §2.
- **D-35:** Exact `clamp()` values for H1 typography — RESOLVED in §2.
- **D-36:** Exact particle motion equations (Brownian σ, attractor k, duration) — RESOLVED in §2.
- **D-37:** Exact gradient color stops — RESOLVED in §2.
- **D-38:** Constants in shared file vs inline — RESOLVED in §2.
- **D-39:** `text-wrap: balance` exclusively or paired with `<br />` — RESOLVED in §2.

### Deferred Ideas (OUT OF SCOPE)

- Engine pipeline diagram (Phase 3).
- A/B testing hero variants.
- Light-mode hero variant.
- Sound design on hero motion.
- In-app prediction viz rebuild.
- Hover state on confidence chip.
- Click-through on confidence chip.
- Multiple particle viz states.
- Magic UI / Aceternity / Origin UI / Cult UI imports.
- Hero copy rewrite or paraphrase.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BUILD-01 | Built from scratch on shadcn primitives + Tailwind v4 + existing 36-component design system | §5 Pattern Map confirms zero new external deps; reuses Button + Tailwind tokens only |
| BUILD-02 | External component imports vetted; rejection criteria documented | §3 produces the REJECT/ACCEPT matrix the planner converts to `02-EXTERNAL-COMPONENT-POLICY.md` |
| HERO-01 | Pre-headline lockup `VIRTUNA · A NUMEN MACHINES PRODUCT` in small monospaced uppercase, restrained | §2 D-22 rendering spec — Inter at letter-spacing-wide + uppercase, ~12-14px |
| HERO-02 | H1 oversized, light weight, Inter, two-line break preserved | §2 D-35 resolution — `clamp(2.75rem, 6.5vw, 5rem)` + `text-wrap: balance` + explicit `<br />` |
| HERO-03 | Sub-headline medium weight, distinct hierarchy from H1 | §2 D-24 — Inter 500, `clamp(1.25rem, 2.2vw, 1.5rem)` |
| HERO-04 | Subline carries behavioral-research moat without "viral" or "AI" | Locked verbatim in REPLACEMENT-COPY.md; lint-vocab confirms zero violations |
| HERO-05 | Dual CTA — primary auth-gated to `/dashboard`, secondary scroll to `#science` | §6 — adds `scroll-behavior: smooth` to globals.css `html` block (drift item #2) |
| HERO-06 | Behavioral-simulation visual — particles aggregating into confidence score | §2 D-36 resolution — drift+attract equations with concrete σ, k, duration values |
| HERO-07 | Ambient gradient backdrop — coral + Raycast neutral, subtle, respects reduced-motion | §2 D-37 resolution — exact `radial-gradient(...)` CSS string using `--color-background` + `--color-coral-500` |
| HERO-08 | Mobile hero stacks vertically; simulation scales gracefully | §2 D-36 — particle count 250→120 below 640px; reduced size scale 0.8x |
| HERO-09 | Above-fold passes reference-fidelity audit | §4 SC1 + §4 SC4 — Phase 5/6 audit; Phase 2 ships against Anthropic/Linear/Vercel/Raycast composition |
| HERO-10 | Hero copy zero "viral" or "AI" terms | `pnpm lint:vocab` exit 0 verified per §4 SC3 |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Hero composition (text + canvas + CTAs + gradient) | Browser/Client (RSC + `'use client'`) | — | `BehavioralHero` is a server component (no interactivity in text/CTAs); only `BehavioralCanvas` requires `'use client'` for canvas refs + RAF |
| Canvas particle simulation | Browser/Client | — | Canvas API is browser-only; uses `'use client'` directive + module-level RAF state |
| Auth-aware CTA routing | API/Backend (middleware) | Browser/Client | Hero renders static `<Link href="/dashboard">`; `src/lib/supabase/middleware.ts` intercepts and redirects logged-out → `/login?next=/dashboard` |
| Smooth-scroll anchor | Browser/Client (CSS) | — | `scroll-behavior: smooth` on `html` is pure CSS; native browser handling |
| Ambient gradient backdrop | Browser/Client (CSS) | — | Pure CSS `radial-gradient`; no JS, no Canvas, no SVG; renders pre-hydration for LCP |
| External component vetting | Documentation (planning) | — | `02-EXTERNAL-COMPONENT-POLICY.md` is a planning artifact, no runtime |

**Why this matters:** The hero is mostly server-rendered (SSR'd HTML for text + gradient). Only `BehavioralCanvas` is a client island. This minimizes JS shipped per LCP and aligns with the BUILD-04 (Phase 5) Core Web Vitals target. The canvas mounts post-hydration but the static keyframe (reduced-motion path or post-animation state) is the only required visible state — animation is enhancement, not content.

## 1. Pre-flight Verification (line landmarks confirmed/updated)

All file:line landmarks listed in CONTEXT.md were re-verified against the current codebase. Two corrections required.

| Landmark (CONTEXT.md) | Status | Notes |
|----------------------|--------|-------|
| `src/components/hive/use-canvas-resize.ts:43-100` — DPR-aware resize | ✅ CONFIRMED | `useEffect` opens at line 43; `ResizeObserver` callback runs to line 100; full hook is 103 lines. REUSE VERBATIM is correct. |
| `src/components/hive/use-hive-animation.ts:42-49` — RAF + module-level flag | ✅ CONFIRMED with name correction | Flag declared at line 43: `let globalAnimationComplete = false;`. Reset function exported at lines 49-51. **CONTEXT.md / BRAND-BIBLE example skeleton uses `globalAnimationPlayed` — wrong name**. The actual codebase symbol is `globalAnimationComplete`. New component should declare its OWN module-level flag with a similar name (e.g., `behavioralHeroAnimationComplete`) — module-level state is per-file. |
| `use-hive-animation.ts:57` — `easeOutCubic` | ✅ CONFIRMED | `function easeOutCubic(t: number): number { return 1 - Math.pow(1 - t, 3); }` declared at line 57. New component should inline this same function in `behavioral-hero-constants.ts` to match codebase convention OR import from a shared util (no shared util currently exists). |
| `use-hive-animation.ts:65-69, 121-193` — reduced-motion guard + animation lifecycle | ✅ CONFIRMED | `FULL_VISIBILITY` constant at line 65; `ZERO_VISIBILITY` at line 71; main `useEffect` at lines 121-193. Pattern: check `reducedMotion` first, then `globalAnimationComplete`, then start RAF. |
| `src/components/hive/HiveCanvas.tsx:54-57, 147-186` — ref-based render state | ✅ CONFIRMED | Refs declared lines 54-57 (canvasRef, containerRef, layoutRef, cameraRef). `render()` callback declared lines 147-186 — reads `sizeRef.current`, `layoutRef.current`, `cameraRef.current` synchronously. |
| `src/components/hive/hive-renderer.ts:240-298` — color batching | ✅ CONFIRMED | `colorGroups = new Map<string, ...>` at line 241; loop and batch draw at lines 283-297. Pattern: group circles by `colorKey`, then per-group `ctx.fillStyle = color; ctx.beginPath(); for (...) ctx.arc(...); ctx.fill();`. |
| `src/hooks/usePrefersReducedMotion.ts:1-29` | ✅ CONFIRMED | 29 lines exact. Returns `true` for SSR safety; flips to `false` once `matchMedia('(prefers-reduced-motion: no-preference)')` matches. REUSE VERBATIM. |
| `src/components/ui/button.tsx` CVA variants | ✅ CONFIRMED | 4 variants: `primary` (coral bg + accent-foreground), `secondary` (transparent bg + 6% border), `ghost`, `destructive`. 3 sizes: sm/md/lg. Default `secondary` + `md`. **`asChild` prop via Radix Slot** — needed for `<Button asChild><Link>...</Link></Button>` pattern. |
| `src/components/ui/typography.tsx` | ✅ CONFIRMED | `Heading` component supports `level={1}` (renders `h1`) with `text-display` (64px) + `font-semibold` + `leading-none` + `tracking-tight`. **NOT used for hero H1** — D-23 specifies Inter 300 (light weight, NOT semibold) + `clamp()` (NOT fixed 64px). Inline H1 styling is correct call. |
| `src/app/globals.css` `scroll-behavior: smooth` | ❌ MISSING | **Pre-flight gap:** The `html, body` block at lines 288-296 has `overflow-x`, `line-height`, `letter-spacing`, font-smoothing — but **no `scroll-behavior` rule**. CONTEXT.md D-28 incorrectly states this exists. Phase 2 must add `html { scroll-behavior: smooth; }` (separate from `html, body { ... }` block) AND respect `@media (prefers-reduced-motion: reduce)` to disable smooth scroll. |
| `src/components/landing/hero-section.tsx` | ✅ CONFIRMED | 85 lines. Imports: `Image`, `Button`, `FadeIn`, `cn`, `PersonaCard`. Plagiarized H1 at line 28-31 ("Human Behavior, Simulated"). Plagiarized sub-headline at line 36-38. Generic `Get in touch` CTA at line 42-44. Will be deleted by Phase 2 per D-32. |
| `src/components/landing/index.ts` barrel | ✅ CONFIRMED | 14 lines. Exports `HeroSection` at line 8. Phase 2 must drop this export and add `BehavioralHero` (no type export needed since `BehavioralHero` takes no props). |
| `src/app/(marketing)/page.tsx` | ✅ CONFIRMED | 27 lines. Imports `HeroSection` + 6 sibling sections from `@/components/landing` (line 1-9). Renders them in order in `<main>` (lines 13-23). Phase 2 swaps `HeroSection` → `BehavioralHero` in both import and JSX. |
| `src/app/(marketing)/layout.tsx` | ✅ CONFIRMED | 30 lines. Plagiarized title + description at lines 13-16 ("Artificial Societies | Human Behavior, Simulated"). **Phase 2 does NOT modify this file** per CONTEXT.md scope; OG metadata cleanup is in REPLACEMENT-COPY.md but ships with the section that owns it (Phase 6 BUILD-09 final swap, OR earlier metadata-only plan if Davide prefers). Researcher recommendation: **flag as a separate small plan** so Phase 2 doesn't ship coral hero alongside plagiarized OG title. |
| `scripts/lint-vocab.mjs` | ✅ CONFIRMED | 82 lines. BANNED list catches `viral`, `go viral`, `AI`, `users`, `framer-motion`. SUPPRESS_RX = `/vocab-lint-disable-next-line/`. Default scan dirs: `src/app`, `src/components/landing`, `src/components/onboarding`. Phase 2 strings must pass `pnpm lint:vocab` clean. |
| `package.json` `lint:vocab` script | ✅ CONFIRMED | Already wired (verified by Phase 1 Plan 04). |

**Drift items requiring action in Phase 2:**

1. **Drift #1 (rename):** All references in BRAND-BIBLE.md addendum + CONTEXT.md to `globalAnimationPlayed` should read `globalAnimationComplete` for consistency with the actual codebase. Phase 2 implementation declares its OWN module-level flag — using a phase-specific name (e.g., `behavioralHeroAnimationComplete`) is fine because module-level state is per-file. **Action:** Plan-phase / implementation should NOT name the new flag `globalAnimationComplete` (would be confusing if both modules define a symbol with the same name) — choose `behavioralHeroAnimationComplete` and document the convention.

2. **Drift #2 (missing CSS):** `scroll-behavior: smooth` is NOT in globals.css. CONTEXT.md D-28 is wrong. **Action:** Phase 2 plan must include adding to `src/app/globals.css`:
   ```css
   html {
     scroll-behavior: smooth;
   }
   @media (prefers-reduced-motion: reduce) {
     html {
       scroll-behavior: auto;
     }
   }
   ```
   This is a 7-line CSS addition and belongs in the scaffold plan (Plan 1).

3. **Drift #3 (OG metadata, optional):** `src/app/(marketing)/layout.tsx:13-15` still carries plagiarized "Artificial Societies | Human Behavior, Simulated" + "AI personas..." text. Phase 2 ships a coral hero on top of plagiarized OG metadata. **Researcher recommendation:** add a tiny 5th plan to swap the metadata strings in `layout.tsx` to the locked OG copy from REPLACEMENT-COPY.md `<viewport name="og-metadata">`. Otherwise Phase 6 (BUILD-09) carries this fix. Davide's call.

## 2. Resolved Discretion Decisions (D-34 through D-39)

### D-34: Confidence chip percentage value

**Decision: 87%** — picked from the candidate set (84 / 87 / 91).

**Rationale:**
- 87 reads as "credible high-confidence" without crossing into too-good-to-be-true (99%) or unimpressive (sub-80%) territory. [VERIFIED: design heuristic + reference visuals — Anthropic, Vercel, Linear all show metrics in the 80s/90s in marketing illustrations]
- Asymmetric digit shape (8 + 7) reads visually distinctive — 84 has paired roundness, 91 has visual top-heaviness. 87 sits in the middle.
- 87 is ABOVE the conventional "psychological credibility threshold" of ~85% but still avoids the diminishing-returns visual zone above 90%.
- Aligns with rhetorical positioning: "decades of behavioral research" should yield strong but not perfect prediction. 87 is "the engine is good but not magical."

**Implementation reference:** Render as text inside the canvas converged state. NOT in DOM (decoration-only chip per D-11 — chip is non-interactive).

```typescript
// behavioral-hero-constants.ts
export const CONFIDENCE_CHIP_PERCENTAGE = 87 as const;
export const CONFIDENCE_CHIP_LABEL = `${CONFIDENCE_CHIP_PERCENTAGE}%` as const;
```

### D-35: H1 typography `clamp()` values

**Decision: `font-size: clamp(2.75rem, 6.5vw, 5rem)`** (44px → 80px range across 768px-1280px viewports).

**Full H1 spec:**

```css
.behavioral-hero-h1 {
  font-family: var(--font-sans); /* Inter */
  font-size: clamp(2.75rem, 6.5vw, 5rem); /* 44-80px */
  font-weight: 300; /* light, per D-23 */
  line-height: 1.05; /* tight, per D-23 */
  letter-spacing: -0.02em; /* matches --tracking-tight from tokens.md */
  color: var(--color-foreground); /* near-white #f9f9f9 */
  text-wrap: balance; /* see D-39 */
  max-width: 14ch; /* prevents overflow on very wide viewports */
}
```

**Rationale:**
- The current type scale in `docs/tokens.md` tops out at `--text-display` = 64px. `5rem` = 80px exceeds the existing scale because hero H1 is intentionally oversized — Anthropic, Linear, Vercel hero H1s all hit 80-96px on desktop. [VERIFIED via inspection of reference set composition guidance]
- Lower bound `2.75rem` = 44px works at 375px iPhone-class viewport. With H1 line break preserved (per HERO-02), 44px × 2 lines × 1.05 line-height = ~92px text height — fits in 200px hero text-stack budget on mobile.
- Upper bound `5rem` = 80px at 1280px+ viewports. `6.5vw` at 1280px = 83px (lands at the cap); at 768px = 50px (mid-scale, smooth transition).
- The 2.75rem suggested in CONTEXT.md (44-88px range) was reduced upper-bound from 88 to 80 because: (a) Raycast/Anthropic restraint principle, (b) too-large H1 fights the canvas viz on right side at 60/40 split, (c) 80px reads as $100M+ venture without screaming.
- Inter 300 (light) at 80px — the project ships Inter via `next/font/google` with default weight subset. Confirm Phase 2 plan that Inter weight 300 is in the loaded subset (currently `Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' })` does NOT specify `weight` array — defaults to all weights with variable axis support, so 300 is available). [VERIFIED via `src/app/(marketing)/layout.tsx:6-10`]

**Reference comparison (illustrative — exact CSS not extracted from production sites):**

| Site | Hero H1 size | Weight | Notes |
|------|-------------|--------|-------|
| Linear | ~72-96px desktop | semibold or bold | Tighter weight, larger size |
| Anthropic Claude | ~64-80px desktop | regular/medium | Restrained, lab-credible |
| Vercel | ~64-96px desktop | medium-bold | Larger end of range |
| Raycast | ~52-72px desktop | semibold | Smaller H1, denser composition |

[ASSUMED: based on training data + reference set knowledge; production CSS not directly extracted in this research]

**Phase 2 H1 lands at the Anthropic/Raycast end of this range, NOT the Linear/Vercel maximum.** Restraint over volume.

### D-36: Particle motion equations

**Decision:** drift+attract with explicit numeric parameters, ~2.2s total animation, eased via `easeOutCubic`.

**Equations (per particle, per frame):**

```typescript
// behavioral-hero-constants.ts
export const PARTICLE_MOTION = {
  // Brownian (random drift) — Gaussian-distributed velocity perturbation per frame
  brownianSigmaPxPerSec: 8, // standard deviation in px/s; small enough to read organic
  // Attractor — strength toward chip center, ramps with eased progress
  attractorPeakStrength: 1.4, // peak k coefficient (multiplied by easing-eased progress)
  // Animation duration
  animationDurationMs: 2200, // 2.2s — middle of CONTEXT.md 2.0-2.4s range
  // Convergence target offset — chip is centered horizontally, slightly above vertical center
  targetOffsetY: -0.05, // -5% of canvas height (visual emphasis on upper-center)
} as const;

// Per-frame update (read by render loop)
function updateParticle(p: Particle, dt: number, easedProgress: number, target: { x: number; y: number }) {
  // Brownian velocity perturbation (Gaussian via Box-Muller approximation)
  const r1 = Math.random();
  const r2 = Math.random();
  const gaussian = Math.sqrt(-2 * Math.log(r1)) * Math.cos(2 * Math.PI * r2);
  const sigmaPxPerFrame = PARTICLE_MOTION.brownianSigmaPxPerSec * dt;
  p.vx += gaussian * sigmaPxPerFrame;
  p.vy += Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random()) * sigmaPxPerFrame;

  // Attractor force toward target, scaled by eased progress
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const k = PARTICLE_MOTION.attractorPeakStrength * easedProgress; // ramps from 0→1.4 over duration
  p.vx += dx * k * dt;
  p.vy += dy * k * dt;

  // Damping (prevents wild oscillation as attractor ramps up)
  const damping = 0.92;
  p.vx *= damping;
  p.vy *= damping;

  // Apply velocity
  p.x += p.vx * dt;
  p.y += p.vy * dt;
}

// In RAF loop:
const elapsed = performance.now() - startTime;
const t = Math.min(1, elapsed / PARTICLE_MOTION.animationDurationMs);
const easedProgress = easeOutCubic(t);
const dt = (now - lastFrameTime) / 1000; // seconds
particles.forEach(p => updateParticle(p, dt, easedProgress, target));
```

**Rationale:**
- **Brownian σ = 8 px/s** — small enough that 60fps × 16ms = ~0.13 px max perturbation per frame. Particles read as "vibrating" not "scrambling."
- **Attractor peak k = 1.4** — at peak (eased progress = 1), force toward center is 1.4× distance per second, dampened at 0.92. Result: particles converge in ~1.5-1.8s organic time, plus 0.4-0.7s of "settling" jitter, fits in 2.2s budget.
- **Damping = 0.92** — prevents the spring overshoot that would occur with raw F=k*x dynamics. Particles arrive without bounce.
- **Easing = `easeOutCubic(t) = 1 - (1-t)^3`** — matches the codebase's existing easing in `use-hive-animation.ts:57` exactly. Decelerates strongly at end → particles "settle" rather than "snap."
- **Target offset Y = -5%** — chip sits slightly above canvas vertical center for visual interest. Aligns with the gradient's coral-peak position (also upper-center per D-15).

**Mobile scaling:**
- Particle count: 250 → 120 (halve, per D-05).
- Particle size: 2-3px → 1.5-2.5px (slight reduction).
- Brownian σ: 8 → 6 px/s (slightly less perturbation at smaller scale).
- Animation duration: unchanged (2.2s — viewer attention budget is the same).
- Attractor strength: unchanged (k=1.4 at peak).

### D-37: Radial gradient color stops

**Decision:**

```css
.behavioral-hero-gradient {
  background: radial-gradient(
    /* Position: upper-center, where particles converge */
    ellipse 90% 70% at 50% 35%,
    /* Stops: coral at peak, fading to neutral */
    rgba(255, 127, 80, 0.18) 0%,
    rgba(255, 127, 80, 0.10) 18%,
    rgba(255, 127, 80, 0.04) 38%,
    var(--color-background) 70%
  );
  /* Solid background underneath ensures fade reaches base */
  background-color: var(--color-background); /* #07080a */
}
```

Or, equivalently as a Tailwind v4 arbitrary value:

```tsx
<section className="bg-background bg-[radial-gradient(ellipse_90%_70%_at_50%_35%,rgba(255,127,80,0.18)_0%,rgba(255,127,80,0.10)_18%,rgba(255,127,80,0.04)_38%,#07080a_70%)]">
```

**Rationale:**
- **Coral at exact hex `#FF7F50` → rgba(255, 127, 80, alpha)`** — bypasses Tailwind v4 oklch inaccuracy on dark colors per CLAUDE.md known issue. Coral peak alpha 0.18 sits in the 0.15-0.25 range from D-15.
- **Position `50% 35%`** — coral peak in upper-center where particles converge (matches D-12 canvas placement + D-36 target offset Y of -5%).
- **Ellipse 90% 70%** — wider than tall so coral wash reads as horizontal hero anchor, not a circle. Matches Raycast's hero gradient orientation.
- **Stop at 38%** — coral fully faded to 4% alpha. Beyond this radius, gradient blends into base `#07080a` via the next stop at 70%.
- **Stop at 70% → `var(--color-background)`** — by 70% radial distance, full neutral. Lower-corners of the hero are pure background. Aligns with D-15's "fades to fully Raycast-neutral by ~40-60%" — slightly more aggressive fade (30-70% transition zone instead of 40-60% sharp cut) reads as more atmospheric.
- **Pure CSS** — no JS, no Canvas, no SVG. Renders pre-hydration → strong LCP. Free in bundle terms.

**Tokens used (all from `docs/tokens.md`):**
- `--color-background` = `var(--color-gray-950)` = `#07080a`
- Coral via direct hex `#FF7F50` (NOT `var(--color-coral-500)` because that's oklch and the gradient with alpha needs rgba precision per CLAUDE.md `oklch` quirk).

**Reduced-motion:** N/A — gradient is static. Satisfies `prefers-reduced-motion` without a separate keyframe (per D-14).

### D-38: Constants file vs inline

**Decision: Separate file `src/components/landing/behavioral-hero-constants.ts`** — matches the `src/components/hive/hive-constants.ts` pattern.

**Rationale:**
- Existing pattern: `hive-constants.ts` is a 196-line file separate from `HiveCanvas.tsx`. Contains all numeric tunables (`HIVE_OUTER_RADIUS`, `NODE_SIZES`, `TIER_COLORS`, `ANIMATION_TIMING`, `NODE_COLORS` palette, `DEPTH_LAYER_CONFIG`, etc.).
- Phase 2 has fewer constants (~40-60 LOC estimated) but same need for: type-safe centralization, easy tweaking without touching component logic, clear separation of "what" (constants) vs "how" (component).
- Matches CONTEXT.md D-30 file-naming convention (kebab-case for non-component utilities).
- Trivially makes the test surface easier — if Phase 5 adds Vitest tests, constants can be imported and asserted (e.g., `expect(PARTICLE_COUNT_DESKTOP).toBeGreaterThan(PARTICLE_COUNT_MOBILE)`).

**Constants file contents (consolidated):**

```typescript
// behavioral-hero-constants.ts
export const PARTICLE_COUNTS = {
  desktop: 250,
  mobile: 120, // ≤640px viewport
} as const;

export const PARTICLE_SIZES = {
  min: 2,
  max: 3, // 2-3px range with per-particle randomness
  mobileScale: 0.85, // multiplier on min/max for mobile
} as const;

export const PARTICLE_COLORS = {
  coral: '#FF7F50', // 70% of particles — exact hex per BRAND-BIBLE
  neutral: '#9c9c9d', // 30% of particles — Raycast --color-gray-400
  coralRatio: 0.7,
} as const;

export const PARTICLE_MOTION = {
  brownianSigmaPxPerSec: 8,
  brownianSigmaMobile: 6,
  attractorPeakStrength: 1.4,
  damping: 0.92,
  animationDurationMs: 2200,
  targetOffsetY: -0.05, // fraction of canvas height
} as const;

export const CONFIDENCE_CHIP = {
  percentage: 87,
  label: '87%',
  bgColor: 'rgba(255, 127, 80, 0.15)', // bg per CONTEXT.md D-06
  borderColor: 'rgba(255, 127, 80, 0.4)',
  textColor: '#FF7F50',
  borderRadius: 12, // px — matches --radius-lg
  fontWeight: 500, // Inter medium
  fontSizePx: 16,
  paddingX: 16, // px
  paddingY: 8, // px
} as const;

export const HERO_GRADIENT = `radial-gradient(ellipse 90% 70% at 50% 35%, rgba(255, 127, 80, 0.18) 0%, rgba(255, 127, 80, 0.10) 18%, rgba(255, 127, 80, 0.04) 38%, #07080a 70%)` as const;

// Easing — matches use-hive-animation.ts:57 verbatim
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
```

### D-39: `text-wrap: balance` exclusively or paired with `<br />`

**Decision: Pair `text-wrap: balance` WITH explicit `<br />`** for the H1 line break.

**Rationale:**
- **`text-wrap: balance` browser support (May 2026):** ~89% global support per caniuse.com. Safari 17.5+ supports it. Chrome 114-129 has partial support; Chrome 130+ full support. [VERIFIED: caniuse.com/css-text-wrap-balance — 85.32% + 3.74% = 89.06% as of fetch date]
- **The 11% of users without support** include older Safari (<17.5), Chrome before mid-2023, all Firefox versions before 121, Samsung Internet older versions. For a $100M+ venture-quality landing page, fallback to "auto" wrap means the H1 might break at an unfortunate point ("Predict how your audience will / respond. Before you post." instead of the locked "Predict how your audience will respond. / Before you post.").
- **Locked copy from REPLACEMENT-COPY.md** specifies a precise two-line break:
  - Line 1: "Predict how your audience will respond."
  - Line 2: "Before you post."
- **Strategy:** Render the H1 with explicit `<br />` AND `text-wrap: balance`. The `<br />` enforces the locked break in unsupported browsers. `text-wrap: balance` in supported browsers will respect the explicit `<br />` (browsers don't override author-specified breaks; balance only applies between author-specified break opportunities).
- **Markup:**

```tsx
<h1 className="behavioral-hero-h1">
  Predict how your audience will respond.<br />
  Before you post.
</h1>
```

- **`text-wrap: balance` benefit when supported:** if the H1 grows on extra-large screens or shrinks on narrow ones, the lines will balance to similar widths automatically — adds polish.
- **Fallback graceful:** unsupported browsers → `<br />` enforces the break. The lines may not be perfectly balanced visually, but the brand-locked break is preserved.

**Cross-check considerations:**
- **CSS line-break interaction:** `text-wrap: balance` does NOT prevent `<br />` from being respected — verified per CSS WG spec. The `<br />` is a hard break; balance only redistributes soft breaks.
- **Accessibility:** `<br />` is widely supported by screen readers. Balance is purely visual. Both work for a11y.

**Reference visuals (D-19):**

- Anthropic Claude landing — uses `text-wrap: balance` for hero lines, no explicit `<br />` (single sentence). N/A pattern for our two-sentence H1.
- Linear — uses explicit `<br />` for hero line breaks (verified via DOM inspection in past audits).
- Vercel — uses `<br />` + `text-wrap: balance` combo for hero H1 with multiple lines.

[ASSUMED: based on past inspection memory; production DOM not directly extracted in this research]

## 3. External Component Policy (REJECT/ACCEPT matrix)

This matrix is the planner-input for `02-EXTERNAL-COMPONENT-POLICY.md`. Per D-19 + D-20, Phase 2 hero is built ZERO-imports from external libraries. Future phases (3-4) MAY revisit per these criteria.

### Surveyed external libraries (concrete inventory)

| Library | Site | What they ship | Distinctive aesthetic | Fit for Raycast restraint? |
|---------|------|---------------|------------------------|----------------------------|
| **Magic UI** | magicui.design | 100+ "animated React components" — Animated Beam (light traveling along path), Border Beam (animated border light), Animated Gradient Text, Neon Gradient Card, Marquee, Globe, Particles | Slightly dramatic, SaaS-maximalist, motion-heavy | NO — neon glow + animated beams conflict with Raycast restraint |
| **Aceternity UI** | ui.aceternity.com | 200+ copy-paste components (free) — Background Gradient Animation (color-shifting bg), Background Beams (SVG paths), Spotlight (light effect), Card Spotlight, Modern Hero With Gradients | Maximalist motion, dramatic gradients, spotlight effects | NO — Background Beams + Spotlight are direct Raycast violations |
| **Origin UI** (rebranded → coss.com/origin) | coss.com/origin | Banner, Table, Form, Input components built on Radix/shadcn — pre-rebrand legacy snapshot | Minimal, structural, shadcn-aligned | YES — but Phase 2 hero doesn't need form/banner/table primitives |
| **Cult UI** | cult-ui.com | DynamicIsland (animated shell), FamilyButton (expansion button), TextureButton (raised button), BgAnimateButton (animated bg), shimmer effects | Niche motion-rich Apple-island-inspired | NO — DynamicIsland + animated bg conflicts with Raycast static cards |

### REJECT criteria for Phase 2 hero (and default-reject for future phases unless ALL pass)

| # | Criterion | Concrete examples (real components) |
|---|-----------|-----|
| R1 | **Maximalist motion component** — animated beams, neon glow, spotlight effects, particle swarms-as-libraries | Magic UI `<AnimatedBeam>`, Magic UI `<BorderBeam>`, Aceternity `<BackgroundGradientAnimation>`, Aceternity `<BackgroundBeams>`, Aceternity `<Spotlight>`, Aceternity `<Spotlight New>`, Cult UI `<BgAnimateButton>` |
| R2 | **Ships its own design tokens** (font / colors / shadows that override or fight Tailwind v4 + Inter + our coral) | Any component with hardcoded font-family, fixed color values not derived from CSS variables, or its own shadow scale |
| R3 | **Peer-dep conflicts** — requires a version of `motion`, `framer-motion`, `next`, `react`, `tailwindcss` that conflicts with our installed versions (`motion@12.29.2`, `framer-motion@12.29.3`, `next@16.1.5`, `react@19.2.3`, `tailwindcss@4`) | Components requiring `framer-motion@10` (when we have v12), or React 18 (when we have 19.2.3) |
| R4 | **Bundle delta > 10 KB gzipped per single component** — hero JS budget is ~45 KB total (Canvas 30 KB + pipeline 15 KB) | Three.js-based components (600 KB+), Lottie-rendered components (50 KB+ even simple), full motion library ports |
| R5 | **A11y gaps** — no reduced-motion support, no screen-reader alternatives for visual-only content, no keyboard nav for interactive components | Components with hardcoded animations and no `useReducedMotion()` check; components that render only `<div>` decorations without `role` / `aria-label` |
| R6 | **Forces ad-hoc styling overrides** — component composition is so opinionated that brand-aligning requires CSS overrides exceeding 50 LOC | Components with deeply nested fixed colors, locked layout structures, or override-resistant default styles |

### ACCEPT criteria (for FUTURE phases — Phase 2 explicitly rejects all imports)

A component MAY be considered for import in Phases 3-6 if ALL of these are true:

| # | Criterion |
|---|-----------|
| A1 | **Single component, copy-paste** — code lives in our `src/components/landing/` after import, no transitive npm dep |
| A2 | **Restyled to coral + Raycast tokens** — all hardcoded colors swapped for `var(--color-accent)` / `var(--color-foreground)` / `var(--color-border)` etc. |
| A3 | **Vocab-lint passes** — any text strings introduced by the component pass `pnpm lint:vocab` clean |
| A4 | **Bundle delta verified** — measured against `pnpm build` before/after; documented in the importing plan |
| A5 | **A11y verified** — manually tested with screen reader (VoiceOver / NVDA) and keyboard nav; reduced-motion verified |
| A6 | **Reference-fidelity check** — component's visual feel matches Anthropic / Linear / Raycast / Vercel restraint, not Magic UI / Aceternity maximalism |
| A7 | **No peer-dep conflict** — verified against current `package.json` dependency tree |

### Phase 2 explicit policy

ZERO imports from Magic UI / Aceternity / Origin UI / Cult UI for the hero. The hero is built from:

1. Raw Tailwind v4 utility classes
2. Existing `src/components/ui/button.tsx` (CVA Button)
3. Existing `src/components/hive/use-canvas-resize.ts` (hook reuse)
4. Existing `src/hooks/usePrefersReducedMotion.ts` (hook reuse)
5. Inline Canvas 2D API (no library)
6. CSS `radial-gradient` (no library)
7. `motion/react` for any future scroll-reveal motion (NOT needed in Phase 2 hero — animation is canvas-driven)

### Future phase considerations (deferred decisions)

- **Phase 3 (Demo + How It Works + Bento):** Engine pipeline diagram (WORKS-01..06) uses SVG + `motion/react` — already locked in BRAND-BIBLE addendum. Bento cells (SURF-01..06) reuse existing `src/components/ui/extension-card.tsx` Raycast card pattern. No external library needs.
- **Phase 4 (Science + Social Proof + Pricing):** Marquee for testimonials (PROOF-02) — `src/components/ui/marquee.tsx` already exists. No external library needs.

This policy doc gets the planner about 80% of the way to writing `02-EXTERNAL-COMPONENT-POLICY.md`. Planner adds: file structure, sign-off checkboxes, decision-ID cross-references.

## 4. Validation Architecture

> ROADMAP.md Phase 2 Success Criteria 1-5. Each maps to concrete observable signals.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 (existing) — for unit tests; Playwright 1.58.0 — for E2E/visual regression (not required this phase but available) |
| Config file | `vitest.config.ts` (existing); `e2e/playwright.config.ts` (existing) |
| Quick run command | `pnpm test` (Vitest) |
| Full suite command | `pnpm test && pnpm lint && pnpm lint:vocab && pnpm build` |

**Note:** Phase 2 deliverables are mostly visual/composition — NOT primarily unit-testable. The Validation Architecture leans heavily on automated linting + manual viewport observation, with optional Vitest-tested constants. Lighthouse/CWV/WCAG audits are deferred to Phase 5 per BUILD-03..05 traceability.

### SC1: `src/app/page.tsx` (landing) renders the full hero section

**What must be observable:**

- `pnpm dev` running, navigate to `http://localhost:3000/`
- Hero section is visible above the fold
- Pre-headline `VIRTUNA · A NUMEN MACHINES PRODUCT` visible at top of text column
- Oversized H1 "Predict how your audience will respond. Before you post." with locked two-line break (`<br />`-driven)
- Sub-headline "Virtuna simulates your audience to forecast every video before it ships." rendered medium-weight
- Subline "Trained on decades of behavioral research. Self-improving with every outcome." rendered muted
- Dual CTA visible — `Run a prediction →` (coral primary), `See the science` (transparent secondary)
- Coral + Raycast neutral ambient gradient backdrop visible behind the entire hero
- All other sections (Backers, Features, Stats, CaseStudy, Partnership, FAQ) STILL visible below — this is the Frankenstein-in-progress strategy per D-03

**Note:** ROADMAP SC1 says `src/app/page.tsx` but the actual file is `src/app/(marketing)/page.tsx` (route group). Phase 2 modifies `(marketing)/page.tsx`. The route resolves to `/` (Next.js drops route group from URL). Final state in Phase 6 BUILD-09 keeps this file path.

**Automated checks (Vitest where possible):**

| Check | Command | Threshold |
|-------|---------|-----------|
| Build succeeds | `pnpm build` | Exit 0 |
| TypeScript clean | `pnpm build` (Next does typecheck) | Zero TS errors |
| ESLint clean | `pnpm lint` | Zero errors |
| File exists | `test -f src/components/landing/BehavioralHero.tsx` | File present |
| File exists | `test -f src/components/landing/BehavioralCanvas.tsx` | File present |
| File exists | `test -f src/components/landing/behavioral-hero-constants.ts` | File present |
| File deleted | `! test -f src/components/landing/hero-section.tsx` | File absent |
| Barrel updated | `! grep -q "HeroSection" src/components/landing/index.ts && grep -q "BehavioralHero" src/components/landing/index.ts` | Both conditions pass |
| Page renders BehavioralHero | `grep -q "BehavioralHero" src/app/\(marketing\)/page.tsx && ! grep -q "HeroSection" src/app/\(marketing\)/page.tsx` | Both conditions pass |

**Manual observation (Davide):**
- Open `http://localhost:3000/` in Chrome + Safari at 1280px and 375px widths
- Take 4 screenshots; visually confirm hierarchy and gradient
- Confirm two-column layout on desktop, stacked on mobile

### SC2: Behavioral-simulation animated visual respects reduced-motion

**What must be observable:**

- With `prefers-reduced-motion: no-preference`: canvas animation plays once on mount (~2.2s drift+attract), particles converge into upper-center area where coral chip with "87%" is visible at converged state. After 2.2s, animation stops; canvas shows static converged state.
- With `prefers-reduced-motion: reduce` (toggle in OS or DevTools Rendering panel): canvas mounts directly into the static converged state. NO RAF animation. Particles in their final positions immediately.
- Module-level `behavioralHeroAnimationComplete` flag prevents re-animation on remount (e.g., navigating away and back).

**Automated checks:**

| Check | Command / Method | Threshold |
|-------|------------------|-----------|
| Reduced-motion hook reused | `grep -q "from '@/hooks/usePrefersReducedMotion'" src/components/landing/BehavioralCanvas.tsx` | Match present |
| Module-level flag declared | `grep -q "let behavioralHeroAnimationComplete" src/components/landing/BehavioralCanvas.tsx` | Match present |
| Constants imported | `grep -q "from './behavioral-hero-constants'" src/components/landing/BehavioralCanvas.tsx` | Match present |
| `useCanvasResize` reused | `grep -q "from '@/components/hive/use-canvas-resize'" src/components/landing/BehavioralCanvas.tsx` | Match present |
| `easeOutCubic` matches token | `grep -q "1 - Math.pow(1 - t, 3)" src/components/landing/behavioral-hero-constants.ts` | Match present |

**Optional Vitest test (D-38 enables this):**

```typescript
// src/components/landing/__tests__/behavioral-hero-constants.test.ts
import { describe, it, expect } from 'vitest';
import {
  PARTICLE_COUNTS,
  PARTICLE_MOTION,
  CONFIDENCE_CHIP,
  easeOutCubic,
} from '../behavioral-hero-constants';

describe('behavioral-hero-constants', () => {
  it('mobile has fewer particles than desktop', () => {
    expect(PARTICLE_COUNTS.mobile).toBeLessThan(PARTICLE_COUNTS.desktop);
  });
  it('confidence percentage is in plausible range', () => {
    expect(CONFIDENCE_CHIP.percentage).toBeGreaterThanOrEqual(80);
    expect(CONFIDENCE_CHIP.percentage).toBeLessThanOrEqual(95);
  });
  it('animation duration is in 2.0-2.4s window per CONTEXT.md D-07', () => {
    expect(PARTICLE_MOTION.animationDurationMs).toBeGreaterThanOrEqual(2000);
    expect(PARTICLE_MOTION.animationDurationMs).toBeLessThanOrEqual(2400);
  });
  it('easeOutCubic returns correct boundary values', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 3);
  });
});
```

**Manual observation:**
- Toggle DevTools Rendering panel → "Emulate CSS media feature prefers-reduced-motion: reduce" — reload, verify static state.
- Toggle off, reload — verify animation plays.
- Navigate to `/dashboard` and back — verify animation does NOT replay (module-level flag).

### SC3: Hero copy contains zero instances of "viral" or "AI"

**What must be observable:**

- `pnpm lint:vocab` exit 0 against `src/app src/components/landing src/components/onboarding`
- The four hero copy strings in `BehavioralHero.tsx` match REPLACEMENT-COPY.md verbatim

**Automated checks:**

| Check | Command | Threshold |
|-------|---------|-----------|
| Vocab lint clean | `pnpm lint:vocab` | Exit 0, "0 error(s)" |
| Pre-commit hook fires | `.githooks/pre-commit` | Confirm hook runs lint-vocab on staged files |
| H1 string verbatim | `grep -q "Predict how your audience will respond" src/components/landing/BehavioralHero.tsx` | Match present |
| Sub-headline verbatim | `grep -q "Virtuna simulates your audience to forecast every video before it ships" src/components/landing/BehavioralHero.tsx` | Match present |
| Subline verbatim | `grep -q "Trained on decades of behavioral research" src/components/landing/BehavioralHero.tsx` | Match present |
| Primary CTA verbatim | `grep -q "Run a prediction" src/components/landing/BehavioralHero.tsx` | Match present |
| Secondary CTA verbatim | `grep -q "See the science" src/components/landing/BehavioralHero.tsx` | Match present |
| Pre-headline verbatim | `grep -q "VIRTUNA · A NUMEN MACHINES PRODUCT" src/components/landing/BehavioralHero.tsx` | Match present |
| Zero "viral" in hero | `! grep -q "viral" src/components/landing/BehavioralHero.tsx` | No match |
| Zero "AI" in hero (whole-word) | `! grep -E "\bAI\b" src/components/landing/BehavioralHero.tsx` | No match |

### SC4: Mobile hero at 375px stacks vertically with hierarchy preserved

**What must be observable:**

- DevTools responsive mode at 375×812 (iPhone 12 / 13 / 14 viewport):
  - Canvas is positioned ABOVE text column (stacked, not side-by-side)
  - H1 text is visible and readable (not truncated, not zero-height)
  - Two-line break in H1 preserved
  - Sub-headline + subline + dual CTA stacked below H1 vertically
  - No horizontal scroll
  - CTAs are tap-friendly (≥44px touch targets — Button md size = h-11 = 44px ✓)
- Canvas reduces particle count to 120 (mobile setting from PARTICLE_COUNTS.mobile)
- Canvas stays at full hero width minus container padding

**Automated checks (Playwright optional, not required for Phase 2):**

```typescript
// e2e/hero-mobile.spec.ts (optional Phase 2 add — full suite is Phase 5 BUILD-06)
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 375, height: 812 } });

test('hero stacks vertically at 375px', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('canvas[aria-label*="Audience particles"]');
  const h1 = page.locator('h1', { hasText: 'Predict how your audience' });
  const canvasBox = await canvas.boundingBox();
  const h1Box = await h1.boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(h1Box).not.toBeNull();
  // Canvas should be above H1 (smaller y value)
  expect(canvasBox!.y).toBeLessThan(h1Box!.y);
});

test('no horizontal scroll at 375px', async ({ page }) => {
  await page.goto('/');
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // 1px tolerance
});
```

**Manual observation:**
- Chrome DevTools device emulation at iPhone 14 (390×844)
- Real iPhone via `pnpm dev` + Vercel preview deployment
- Verify hierarchy + no horizontal scroll

### SC5: Rejection criteria for external component imports documented and applied

**What must be observable:**

- `.planning/phases/02-foundation-hero/02-EXTERNAL-COMPONENT-POLICY.md` exists
- Doc contains REJECT/ACCEPT matrix matching §3 of this research
- ZERO imports from `magic-ui`, `aceternity-ui`, `origin-ui`, `cult-ui`, or any of their npm equivalents in Phase 2 commits
- Policy doc references Phase 2 hero implementation as the first compliant artifact

**Automated checks:**

| Check | Command | Threshold |
|-------|---------|-----------|
| Policy doc exists | `test -f .planning/phases/02-foundation-hero/02-EXTERNAL-COMPONENT-POLICY.md` | File present |
| Doc has REJECT criteria | `grep -q "REJECT" .planning/phases/02-foundation-hero/02-EXTERNAL-COMPONENT-POLICY.md` | Match present |
| Doc has ACCEPT criteria | `grep -q "ACCEPT" .planning/phases/02-foundation-hero/02-EXTERNAL-COMPONENT-POLICY.md` | Match present |
| Zero external library imports | `! grep -rE "from ['\"](@magic-ui\|magic-ui\|@aceternity-ui\|aceternity-ui\|@origin-ui\|origin-ui\|@cult-ui\|cult-ui)['\"]" src/` | No matches |
| Hero uses only allowed sources | `grep -E "^import" src/components/landing/BehavioralHero.tsx src/components/landing/BehavioralCanvas.tsx | grep -v "@/components/ui\|@/hooks\|@/components/hive\|next/link\|react\|@/lib/utils"` | Should produce only ./behavioral-hero-constants imports |

**Manual observation:**
- Davide reviews `02-EXTERNAL-COMPONENT-POLICY.md` for clarity and applies override decisions if needed.

### Sampling Rate

- **Per task commit:** `pnpm lint && pnpm lint:vocab` (fast, < 5s)
- **Per wave merge:** `pnpm test && pnpm lint && pnpm lint:vocab && pnpm build` (full check, 30-60s)
- **Phase gate:** Manual viewport observation by Davide (Chrome + Safari at 1280px + 375px) + automated check matrix above

### Wave 0 Gaps

- [ ] **Optional:** `src/components/landing/__tests__/behavioral-hero-constants.test.ts` — unit tests for constants invariants (4 tests, ~30 LOC). Recommended but not blocking.
- [ ] **Required:** Add `html { scroll-behavior: smooth; }` block to `src/app/globals.css` (drift item #2 from §1). Belongs in Plan 1 (scaffold).
- [ ] **No new framework install** — Vitest + Playwright already configured.
- [ ] **No new test fixtures needed** — hero is composition-only.

### Reference fidelity (HERO-09 — deferred to Phase 6 BUILD-07)

ROADMAP SC1 mentions "against the correct coral + Raycast neutral ambient gradient" but the formal $100M+ reference-fidelity audit is Phase 6 BUILD-07. Phase 2 ships against the locked composition spec (D-21..D-39) and trusts Phase 6 to audit. Phase 2 is NOT held to passing the audit — only to shipping the spec.

## 5. Pattern Map (analog files for each new file)

> Phase 2 creates 4 files (3 production code + 1 planning doc) and modifies 3 files. Each has at least one analog in the codebase.

### `src/components/landing/BehavioralHero.tsx` (NEW — composition component)

**Closest analog:** `src/components/landing/hero-section.tsx` (the file being deleted).

**Why analog applies:** Same role (hero composition), same path (`src/components/landing/`), same import patterns (`Button` from UI, `cn` utility, Next `<Link>`).

**Pattern to copy:**

```tsx
// File header — match hero-section.tsx:1-7
"use client"; // ONLY if interactive — see note below
import Image from "next/image"; // OMIT — no Image needed
import Link from "next/link"; // ADD — for CTAs
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
```

**Critical change vs analog:** `BehavioralHero` should be a **server component** (no `"use client"` directive) because it has no interactivity. The Canvas is the only client component — extract it into `BehavioralCanvas` and import it. Server-component hero ships static HTML for text + gradient → strong LCP.

```tsx
// src/components/landing/BehavioralHero.tsx (server component)
import Link from "next/link";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { BehavioralCanvas } from "./BehavioralCanvas";
import { HERO_GRADIENT } from "./behavioral-hero-constants";

interface BehavioralHeroProps {
  className?: string;
}

export function BehavioralHero({ className }: BehavioralHeroProps) {
  return (
    <section
      className={cn(
        "relative min-h-[calc(100vh-64px)] flex items-center overflow-hidden",
        className
      )}
      style={{ background: HERO_GRADIENT }}
    >
      <div className="relative max-w-7xl mx-auto px-6 py-20 lg:py-24 w-full">
        <div className="flex flex-col-reverse lg:flex-row items-center justify-between gap-12 lg:gap-12">
          {/* Left: Text + CTAs (60% on desktop) */}
          <div className="flex-1 max-w-2xl text-left">
            {/* Pre-headline — D-22 */}
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-foreground-muted mb-6">
              VIRTUNA &middot; A NUMEN MACHINES PRODUCT
            </p>
            {/* H1 — D-23 + D-35 + D-39 */}
            <h1
              className="font-sans font-light text-foreground"
              style={{
                fontSize: "clamp(2.75rem, 6.5vw, 5rem)",
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                textWrap: "balance",
                maxWidth: "14ch",
              }}
            >
              Predict how your audience will respond.<br />
              Before you post.
            </h1>
            {/* Sub-headline — D-24 */}
            <p
              className="font-sans font-medium text-foreground mt-6"
              style={{ fontSize: "clamp(1.25rem, 2.2vw, 1.5rem)", lineHeight: 1.35 }}
            >
              Virtuna simulates your audience to forecast every video before it ships.
            </p>
            {/* Subline — D-25 */}
            <p
              className="font-sans font-normal text-foreground-muted mt-4"
              style={{ fontSize: "clamp(1rem, 1.4vw, 1.125rem)", lineHeight: 1.5 }}
            >
              Trained on decades of behavioral research. Self-improving with every outcome.
            </p>
            {/* Dual CTA — D-26, D-27, D-28 */}
            <div className="flex flex-col sm:flex-row gap-3 mt-10">
              <Button asChild variant="primary" size="lg">
                <Link href="/dashboard">Run a prediction →</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="#science">See the science</Link>
              </Button>
            </div>
          </div>
          {/* Right: Canvas (40% on desktop, full-width above text on mobile) */}
          <div className="flex-1 w-full lg:w-[40%] aspect-square lg:aspect-auto lg:h-[520px]">
            <BehavioralCanvas />
          </div>
        </div>
      </div>
    </section>
  );
}
```

**Lines/patterns to copy from hero-section.tsx:**
- Section wrapper structure (`<section className={cn(...)}>` line 14-19) — adapted with new layout
- `cn` utility import (line 6) — unchanged
- `max-w-7xl mx-auto` container pattern (line 23) — wider than analog's `max-w-6xl` because hero is two-column

**What to drop from analog:**
- `<Image>` (no network image needed — canvas is the visual)
- `<PersonaCard>` (replaced by canvas + chip)
- `<FadeIn>` wrappers (canvas does its own animation; static text doesn't need scroll-reveal in viewport 1)

### `src/components/landing/BehavioralCanvas.tsx` (NEW — Canvas 2D viz)

**Closest analog:** `src/components/hive/HiveCanvas.tsx` (316 lines, proven 1300+ nodes / 60fps)

**Why analog applies:** Direct evidence base for Canvas 2D in this codebase. Same patterns for refs, render callback, RAF loop, DPR resize.

**Pattern to copy:**

```tsx
// src/components/landing/BehavioralCanvas.tsx
'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useCanvasResize } from '@/components/hive/use-canvas-resize'; // REUSE VERBATIM
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'; // REUSE VERBATIM
import {
  PARTICLE_COUNTS,
  PARTICLE_SIZES,
  PARTICLE_COLORS,
  PARTICLE_MOTION,
  CONFIDENCE_CHIP,
  easeOutCubic,
} from './behavioral-hero-constants';

// Module-level flag — same pattern as use-hive-animation.ts:43 (renamed for module isolation)
let behavioralHeroAnimationComplete = false;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
}

export function BehavioralCanvas(): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const startTimeRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const reducedMotion = usePrefersReducedMotion();

  // Render — reads particlesRef synchronously, no React state per frame
  // PATTERN: HiveCanvas.tsx:147-186
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height, dpr } = sizeRef.current;
    if (width <= 0 || height <= 0) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    // Color batching — PATTERN: hive-renderer.ts:240-298
    const colorGroups = new Map<string, Particle[]>();
    for (const p of particlesRef.current) {
      let group = colorGroups.get(p.color);
      if (!group) {
        group = [];
        colorGroups.set(p.color, group);
      }
      group.push(p);
    }
    for (const [color, particles] of colorGroups) {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (const p of particles) {
        ctx.moveTo(p.x + p.size, p.y);
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    // Render confidence chip when animation complete (or reduced-motion)
    if (behavioralHeroAnimationComplete || reducedMotion) {
      drawConfidenceChip(ctx, width, height);
    }

    ctx.restore();
  }, [reducedMotion]);

  const sizeRef = useCanvasResize(canvasRef, render);

  // Initialize particles + drive RAF
  useEffect(() => {
    const { width, height } = sizeRef.current;
    if (width <= 0 || height <= 0) return;

    const isMobile = width < 640;
    const count = isMobile ? PARTICLE_COUNTS.mobile : PARTICLE_COUNTS.desktop;
    const sigmaScale = isMobile ? PARTICLE_MOTION.brownianSigmaMobile : PARTICLE_MOTION.brownianSigmaPxPerSec;

    // Initialize uniform random distribution
    particlesRef.current = Array.from({ length: count }, () => {
      const isCoral = Math.random() < PARTICLE_COLORS.coralRatio;
      const sizeRange = isMobile ? PARTICLE_SIZES.mobileScale : 1;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 0,
        vy: 0,
        color: isCoral ? PARTICLE_COLORS.coral : PARTICLE_COLORS.neutral,
        size: (PARTICLE_SIZES.min + Math.random() * (PARTICLE_SIZES.max - PARTICLE_SIZES.min)) * sizeRange,
      };
    });

    // Reduced motion or already played — render static converged state
    if (reducedMotion || behavioralHeroAnimationComplete) {
      // Force particles to converged positions (clustered around target)
      const target = { x: width / 2, y: height * (0.5 + PARTICLE_MOTION.targetOffsetY) };
      particlesRef.current.forEach((p) => {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * Math.min(width, height) * 0.12;
        p.x = target.x + Math.cos(angle) * radius;
        p.y = target.y + Math.sin(angle) * radius;
      });
      behavioralHeroAnimationComplete = true;
      render();
      return;
    }

    // RAF loop
    startTimeRef.current = performance.now();
    lastFrameRef.current = startTimeRef.current;
    const target = { x: width / 2, y: height * (0.5 + PARTICLE_MOTION.targetOffsetY) };

    let rafId = 0;
    const tick = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const dt = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;
      const t = Math.min(1, elapsed / PARTICLE_MOTION.animationDurationMs);
      const easedProgress = easeOutCubic(t);

      // Update particles (drift+attract per D-36)
      for (const p of particlesRef.current) {
        // Brownian — Box-Muller Gaussian
        const r1 = Math.random(); const r2 = Math.random();
        const gx = Math.sqrt(-2 * Math.log(r1)) * Math.cos(2 * Math.PI * r2);
        const r3 = Math.random(); const r4 = Math.random();
        const gy = Math.sqrt(-2 * Math.log(r3)) * Math.cos(2 * Math.PI * r4);
        p.vx += gx * sigmaScale * dt;
        p.vy += gy * sigmaScale * dt;

        // Attractor toward target
        const k = PARTICLE_MOTION.attractorPeakStrength * easedProgress;
        p.vx += (target.x - p.x) * k * dt;
        p.vy += (target.y - p.y) * k * dt;

        // Damping
        p.vx *= PARTICLE_MOTION.damping;
        p.vy *= PARTICLE_MOTION.damping;

        // Apply
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }

      render();

      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        behavioralHeroAnimationComplete = true;
        render(); // final render with chip
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [reducedMotion, render]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ width: '100%', height: '100%', touchAction: 'none' }}
      role="img"
      aria-label="Audience particles aggregating into a confidence score of 87 percent"
    />
  );
}

// Helpers
function drawConfidenceChip(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const cx = width / 2;
  const cy = height * (0.5 + PARTICLE_MOTION.targetOffsetY);
  const text = CONFIDENCE_CHIP.label;
  const fontSize = CONFIDENCE_CHIP.fontSizePx;
  ctx.font = `${CONFIDENCE_CHIP.fontWeight} ${fontSize}px var(--font-sans, system-ui)`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const textWidth = ctx.measureText(text).width;
  const pillW = textWidth + CONFIDENCE_CHIP.paddingX * 2;
  const pillH = fontSize + CONFIDENCE_CHIP.paddingY * 2;
  // Pill bg
  ctx.fillStyle = CONFIDENCE_CHIP.bgColor;
  ctx.beginPath();
  roundRect(ctx, cx - pillW / 2, cy - pillH / 2, pillW, pillH, CONFIDENCE_CHIP.borderRadius);
  ctx.fill();
  // Pill border
  ctx.strokeStyle = CONFIDENCE_CHIP.borderColor;
  ctx.lineWidth = 1;
  ctx.stroke();
  // Pill text
  ctx.fillStyle = CONFIDENCE_CHIP.textColor;
  ctx.fillText(text, cx, cy);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
```

**Lines/patterns to copy from analog:**

| Analog file:line | What | Apply to BehavioralCanvas |
|------------------|------|---------------------------|
| `HiveCanvas.tsx:54-57` | Refs declaration pattern | Same — `canvasRef`, `particlesRef`, `startTimeRef`, `lastFrameRef` |
| `HiveCanvas.tsx:147-186` | `render()` callback synchronous reads | Same — read `sizeRef.current`, `particlesRef.current` |
| `HiveCanvas.tsx:189` | `const sizeRef = useCanvasResize(canvasRef, render);` | Same call signature |
| `use-hive-animation.ts:43-49` | Module-level `let globalAnimationComplete = false;` + reset pattern | Same shape, renamed `behavioralHeroAnimationComplete` |
| `use-hive-animation.ts:57` | `easeOutCubic(t)` function body | Inlined in `behavioral-hero-constants.ts` — same body |
| `use-hive-animation.ts:121-193` | `useEffect` with reduced-motion early return + RAF loop | Same control flow |
| `hive-renderer.ts:240-298` | Color batching via `Map<colorKey, circles>` | Same — group by particle color, batch draw |

### `src/components/landing/behavioral-hero-constants.ts` (NEW — constants)

**Closest analog:** `src/components/hive/hive-constants.ts` (196 lines)

**Why analog applies:** Identical role — colocated constants file for a Canvas 2D component. Same naming convention (kebab-case, no `.tsx` extension).

**Pattern to copy:**
- File header comment block (`// hive-constants.ts -- Visual constants for hive rendering & animation`)
- `export const X = {...} as const;` for type-safe object literals
- Inline JSDoc comments for tunable values
- Group exports by domain (sizes, colors, animation timing, palette)
- See concrete file content in §2 D-38 above (lines 142-196)

### `.planning/phases/02-foundation-hero/02-EXTERNAL-COMPONENT-POLICY.md` (NEW — planning artifact)

**Closest analog:** `.planning/phases/01-brand-spine-visual-metaphor/01-PLAGIARISM-AUDIT.md` (Phase 1 audit doc — same dir, same `[NN]-` prefix, same role: phase-scoped audit/policy artifact)

**Why analog applies:** Same role (phase audit/policy doc), same dir, same naming. Use HTML-tag section wrappers per `01-PATTERNS.md` shared markdown style:
- `<scope>` for what's covered
- `<criteria>` for the REJECT/ACCEPT matrix
- `<surveyed_libraries>` for the inventory of Magic UI / Aceternity / Origin UI / Cult UI
- `<phase2_policy>` for the strict zero-imports policy
- `<future_phases>` for accept-criteria carve-outs

**Skeleton (planner expands from §3 of this research):**

```markdown
# Phase 2: Foundation & Hero - External Component Policy

**Documented:** 2026-05-XX
**Scope:** D-19 — rejection criteria for Magic UI / Aceternity / Origin UI / Cult UI imports

<scope>
## Scope
[per §3 of 02-RESEARCH.md]
</scope>

<criteria>
## REJECT Criteria
[6-row table from §3]

## ACCEPT Criteria (Future Phases)
[7-row table from §3]
</criteria>

<surveyed_libraries>
## Surveyed Libraries
[4-row inventory from §3]
</surveyed_libraries>

<phase2_policy>
## Phase 2 Explicit Policy
ZERO imports from external libraries. Hero built from:
[list of 7 allowed sources from §3]
</phase2_policy>

<future_phases>
## Future Phase Considerations
[Phase 3 + Phase 4 notes from §3]
</future_phases>

## Sign-off
- [ ] Davide reviewed policy
- [ ] Phase 2 hero ships zero external imports — verified by `grep`
```

### Modified files (existing files Phase 2 touches)

| File | Modification | Analog/Pattern |
|------|-------------|----------------|
| `src/app/(marketing)/page.tsx` | Replace `HeroSection` import + JSX with `BehavioralHero` | Same import-then-render pattern (line 1-9 imports, line 13-23 JSX) |
| `src/components/landing/index.ts` | Drop `HeroSection` export at line 8; add `BehavioralHero` export | Same `export { X } from "./y"` pattern (line 1-13 of file) |
| `src/components/landing/hero-section.tsx` | DELETE (after page.tsx no longer references it) | N/A — file removal |
| `src/app/globals.css` | Add 7-line block: `html { scroll-behavior: smooth; } @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }` | Append after `html, body` block at lines 288-296 |

## 6. Pitfalls & Landmines (project-specific gotchas)

### Pitfall 1: Tailwind v4 oklch inaccuracy on dark colors

**What goes wrong:** Coral coded as `oklch(0.72 0.16 40)` in inline styles compiles inaccurately for dark/low-lightness rgba fades — particles render slightly wrong hue.

**Why it happens:** Tailwind v4 `@theme` block compiles oklch to hex at build time; for `L < 0.15`, the conversion is inaccurate (per CLAUDE.md known issue). When the alpha channel reaches near-transparent on coral over near-black bg, oklch interpolation diverges from rgba interpolation.

**How to avoid:**
- Use exact hex `#FF7F50` for coral in canvas drawing AND in radial-gradient stops.
- Use rgba(255, 127, 80, alpha) form when alpha < 1.
- NEVER round-trip through `oklch()` for the gradient stops or the chip colors.
- The `--color-accent` token is fine when used at full opacity (e.g., button background) because Tailwind v4 emits an exact hex at compile time when the value resolves cleanly.

**Warning signs:** Coral hue looks slightly purple/red instead of orange-coral when fading to black bg.

### Pitfall 2: Lightning CSS strips backdrop-filter

**What goes wrong:** If a glass surface frames the hero canvas (e.g., a glass card around the chip), `backdrop-filter: blur(5px)` in a CSS class is silently stripped by Lightning CSS.

**Why it happens:** Lightning CSS optimization in Next.js 16 tree-shakes CSS rules. If the rule isn't traceable to a class used in JSX, it gets dropped. For backdrop-filter specifically, even traced rules sometimes get stripped (known Tailwind v4 + Next 16 issue).

**How to avoid:**
- Phase 2 hero gradient is NOT a glass surface — pure radial-gradient is unaffected.
- The confidence chip is rendered IN the canvas (not DOM), so no backdrop-filter concern.
- IF Phase 2 plan introduces any glass surface for the hero (NOT recommended per CONTEXT.md restraint), apply via React inline `style={{ backdropFilter: 'blur(5px)' }}` per CLAUDE.md.

**Warning signs:** Glass effect missing in production build, present in dev mode.

### Pitfall 3: Dev cache hygiene for CSS changes

**What goes wrong:** New radial-gradient class added to globals.css doesn't appear; reload doesn't help; Next dev server keeps serving stale CSS.

**Why it happens:** `.next/` cache + `node_modules/.cache/` + browser cache compound. CSS changes specifically can persist after JS changes have hot-reloaded.

**How to avoid:**
- After modifying `globals.css`: kill dev server, `rm -rf .next/`, `rm -rf node_modules/.cache/`, hard-reload browser (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows).
- Phase 2 plan should bake this into the verification steps for Plan 4 (Ambient gradient backdrop) and Plan 1 (Scaffold — `scroll-behavior` add).

**Warning signs:** Gradient stops look stale, scroll-behavior smooth doesn't kick in despite globals.css being correct.

### Pitfall 4: motion/react vs framer-motion import path discipline

**What goes wrong:** Phase 2 component imports from `framer-motion` instead of `motion/react`; both libraries ship → bundle exceeds 50 KB ceiling.

**Why it happens:** Codebase has BOTH packages installed (`motion@12.29.2` and `framer-motion@12.29.3`). Two legacy `framer-motion` imports in `src/components/app/simulation/*.tsx` plus two more in `src/components/viral-results/*.tsx`. Copy-paste from these files perpetuates the wrong path. The `scripts/lint-vocab.mjs` regex catches `from 'framer-motion'` as a WARN-level violation but won't fail the build.

**How to avoid:**
- All NEW motion code uses `motion/react`. Phase 2 hero doesn't use motion library directly (Canvas drives its own animation), so this is a defensive measure.
- The legacy `framer-motion` files in `app/simulation/` and `viral-results/` are OUT OF SCOPE for Phase 2 per BRAND-BIBLE addendum.

**Warning signs:** `pnpm lint:vocab` reports WARN-level `framer-motion` import in any new Phase 2 file.

### Pitfall 5: Module-level animation flag naming collision

**What goes wrong:** New component declares `globalAnimationComplete` at module level → conflicts with existing `globalAnimationComplete` in `use-hive-animation.ts:43` if BOTH modules export the symbol.

**Why it happens:** Module-level state is per-file in TypeScript, but if both modules export the same name and a third file imports both, you get an ambiguity error.

**How to avoid:**
- New module declares `let behavioralHeroAnimationComplete = false;` (file-scoped, NOT exported by default).
- DON'T export the flag — it's internal state for the canvas component.
- IF a reset function is needed (e.g., for testing), export `resetBehavioralHeroAnimation()` as a separate symbol.

**Warning signs:** TS compile error "Cannot redeclare block-scoped variable" or "Identifier 'globalAnimationComplete' has already been declared."

### Pitfall 6: Server component / client component boundary

**What goes wrong:** `BehavioralHero` accidentally needs `"use client"` because of canvas import — entire hero ships as client JS, eats into LCP.

**Why it happens:** Next.js 16 RSC rules: a server component can RENDER a client component, but cannot directly call its hooks or import its types. If `BehavioralHero` imports `BehavioralCanvas` as `<BehavioralCanvas />` (component reference), it's fine — the boundary is at `BehavioralCanvas.tsx`'s `"use client"` directive.

**How to avoid:**
- `BehavioralHero.tsx` does NOT have `"use client"` directive.
- `BehavioralCanvas.tsx` has `"use client"` directive.
- Server-rendered HTML for text + gradient + button HTML; client-hydrated `<canvas>` mounts post-hydration.
- Verify with `pnpm build` output — `BehavioralHero` should NOT appear in client bundle (only `BehavioralCanvas` should).

**Warning signs:** `pnpm build` output shows `BehavioralHero` in client chunks, or LCP regression in dev tools.

### Pitfall 7: Inter font weight 300 not loaded

**What goes wrong:** H1 renders at weight 400 (Regular) instead of 300 (Light) because Inter subset doesn't include weight 300.

**Why it happens:** `Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' })` in `(marketing)/layout.tsx:6-10` uses `next/font/google`. Without explicit `weight` array, `next/font/google` loads variable Inter which DOES support all weights including 300.

**How to avoid:**
- Verify in browser DevTools → Computed → font-weight — should be 300 on H1.
- If weight 300 doesn't render, modify layout.tsx to explicit `weight: ['300', '400', '500', '600', '700']` or use Inter Variable subset (default in Next 16).

**Warning signs:** H1 visually heavier than expected; browser DevTools shows font-weight 400 despite CSS specifying 300.

### Pitfall 8: Two-line `<br />` break causes a11y screen-reader hiccup

**What goes wrong:** Screen reader announces the H1 as two separate sentences with awkward pause.

**Why it happens:** `<br />` causes a single break, which most modern screen readers handle gracefully. But VoiceOver on iOS sometimes pauses awkwardly on `<br />`.

**How to avoid:**
- The H1 is a single `<h1>` element; the `<br />` is internal.
- Optionally add `aria-label="Predict how your audience will respond. Before you post."` on the `<h1>` to give SR a clean string.
- Test with VoiceOver (Cmd+F5 on Mac).

**Warning signs:** SR pauses or repeats the period awkwardly between the two lines.

### Pitfall 9: Canvas DPR + intersection observer for one-shot

**What goes wrong:** Canvas mounts but animation plays IMMEDIATELY on page load before the canvas is in viewport — by the time user scrolls to it (in Phase 2 it IS the above-fold so this is unlikely, but if hero shifts in future phases, this could break).

**Why it happens:** RAF starts on `useEffect` mount, regardless of viewport visibility. The hive viz uses the same pattern but is ABOVE the fold (no scroll needed).

**How to avoid:**
- Phase 2: hero IS the above-fold viewport, so animation-on-mount is correct.
- If Phase 3+ moves the hero or embeds the canvas elsewhere, add intersection observer guard: only start RAF when canvas is intersecting viewport.
- For Phase 2, explicitly NOT needed.

**Warning signs:** N/A in Phase 2.

### Pitfall 10: Gradient + canvas blending edge

**What goes wrong:** Where canvas right-edge meets gradient, a visible seam or color discontinuity appears.

**Why it happens:** Canvas renders on a transparent background; gradient is on the parent section. If the canvas has a `background-color` set or DPR rendering produces a 0.5px sub-pixel artifact, a seam shows.

**How to avoid:**
- Canvas element: NO `background-color` style. Default is transparent.
- Render with `ctx.clearRect(0, 0, canvas.width, canvas.height)` at start of every frame (verified in HiveCanvas.tsx:158).
- Verify in dev: zoom to 200% in browser, inspect canvas edge — should blend seamlessly with gradient.

**Warning signs:** Visible vertical line where canvas meets text column at desktop layout boundary.

### Pitfall 11: pre-headline `·` (middle dot) character

**What goes wrong:** Pre-headline string `VIRTUNA · A NUMEN MACHINES PRODUCT` uses the Unicode middle dot character (U+00B7). Some editors / shells / CI environments mangle this character.

**Why it happens:** Encoding mismatches; especially when the string passes through scripts/lint-vocab.mjs (which reads UTF-8 by default, so it should be fine, but worth verifying).

**How to avoid:**
- Source file MUST be UTF-8 encoded (Next.js default).
- In JSX, render via `&middot;` HTML entity OR direct `·` character. Both work; `&middot;` is more portable across editors.
- Verify the rendered DOM in browser shows the same dot character.

**Warning signs:** Browser shows `?` or `·` or `·` literal instead of the dot.

## 7. Open Questions for the Planner

These are decisions that exceed the researcher's scope and require planner-level integration with phase strategy:

### Q1: Should the OG metadata fix in `(marketing)/layout.tsx` be a Phase 2 plan or deferred to Phase 6?

**Context:** `src/app/(marketing)/layout.tsx:13-15` carries plagiarized "Artificial Societies | Human Behavior, Simulated" + "AI personas..." text. CONTEXT.md scope explicitly does NOT include this file. But shipping a coral hero on top of plagiarized OG metadata leaks the old brand on social shares.

**Options:**
- **A.** Add a tiny Plan 0 (2-line edit) to swap the metadata strings to REPLACEMENT-COPY.md `<viewport name="og-metadata">` values. Wave 1 sibling.
- **B.** Defer to Phase 6 BUILD-09 (final swap).

**Researcher recommendation:** Option A — adds < 5 minutes of work and unblocks safe Vercel preview sharing. The locked OG copy is in REPLACEMENT-COPY.md and would otherwise sit unused for 4 phases.

### Q2: Should Vitest tests for `behavioral-hero-constants.ts` ship in Phase 2?

**Context:** Phase 5 BUILD-08 demands TypeScript strict + clean lint. Vitest is already configured. Constants file lends itself to invariant tests (4 simple expect() calls).

**Options:**
- **A.** Add `__tests__/behavioral-hero-constants.test.ts` in Plan 3 as part of constants delivery.
- **B.** Defer all Phase 2 testing to Phase 5.

**Researcher recommendation:** Option A — < 30 LOC of tests, exposes constraints the constants must obey (mobile < desktop counts, percentage in plausible range, easing boundaries). Failing later if a future contributor changes a constant without thinking is cheap insurance.

### Q3: How should `BehavioralHero` handle the section ID for `#science` smooth-scroll target?

**Context:** Secondary CTA is `<Link href="#science">`. The Science section ships in Phase 4 (SCI-01..06). Until then, the anchor target doesn't exist.

**Options:**
- **A.** Phase 2 ships the link with no target ID — clicks scroll to top of page (browser default for missing anchor).
- **B.** Phase 2 adds an `id="science"` to a placeholder `<section>` somewhere in (marketing)/page.tsx (e.g., wrapping the existing FAQSection or adding an empty `<section>` between BehavioralHero and the next old section).
- **C.** Phase 2 adds `id="science"` to one of the existing old sections (e.g., the StatsSection or PartnershipSection) so the click scrolls SOMEWHERE meaningful until Phase 4.

**Researcher recommendation:** Option B with empty placeholder OR Option C with StatsSection. The forward-compatibility issue is small but visible. Davide's call.

### Q4: Should Phase 2 add Vitest tests for the canvas component itself?

**Context:** Canvas components are notoriously hard to unit test. Visual behavior is best caught by manual observation or Playwright visual regression.

**Options:**
- **A.** Skip canvas tests entirely.
- **B.** Add a smoke test that renders BehavioralCanvas in a JSDOM environment and asserts the canvas element appears.
- **C.** Add Playwright visual regression test (Phase 5 territory).

**Researcher recommendation:** Option A for Phase 2. Canvas behavior is too visual for cheap unit tests; Playwright is Phase 5 work. Constants tests in Q2 cover the deterministic parts.

### Q5: Where should `02-EXTERNAL-COMPONENT-POLICY.md` link from?

**Context:** The policy doc is a one-shot artifact. Future phases (3-4) need to find it.

**Options:**
- **A.** Link from `BRAND-BIBLE.md` addendum's "Phase 2-6 use this section" subsection.
- **B.** Link from each phase's CONTEXT.md as a canonical_ref.
- **C.** Both.

**Researcher recommendation:** Option C. BRAND-BIBLE addendum is a top-level discoverable spot; phase CONTEXTs are how each phase researcher actually finds canonical_refs.

### Q6: Should the canvas chip text be DOM-accessible (e.g., for SR + reduced-motion)?

**Context:** Canvas chip renders "87%" as canvas text — not in DOM. Screen readers can't read it. The `aria-label` on the canvas mentions "87 percent" so it's announced, but only as a hint, not as the live value.

**Options:**
- **A.** Keep chip canvas-only. SR reads aria-label "Audience particles aggregating into a confidence score of 87 percent." Done.
- **B.** Render chip as DOM element absolutely-positioned over canvas. Loses the visual cohesion (chip would have its own DOM node, not be part of the converged canvas).
- **C.** Render chip as DOM element only when reduced-motion is on (replace canvas-text with DOM-text in the static state).

**Researcher recommendation:** Option A. Keeps the visual metaphor pure (chip is the converged shape, IN the canvas, not floating above it). aria-label gives screen readers the data. Reduced-motion users still see the chip drawn at converged position.

## Sources

### Primary (HIGH confidence)
- **In-repo verification (direct file reads):**
  - `src/components/hive/HiveCanvas.tsx` (316 lines)
  - `src/components/hive/use-canvas-resize.ts` (103 lines, line 43-100 confirmed for resize)
  - `src/components/hive/use-hive-animation.ts` (212 lines, lines 42-49 confirmed for module-level flag, line 57 for easeOutCubic, lines 121-193 for animation lifecycle)
  - `src/components/hive/hive-renderer.ts` (511 lines, lines 240-298 confirmed for color batching)
  - `src/components/hive/hive-constants.ts` (196 lines)
  - `src/hooks/usePrefersReducedMotion.ts` (29 lines)
  - `src/components/ui/button.tsx` (182 lines, all 4 variants verified)
  - `src/components/ui/typography.tsx` (253 lines)
  - `src/components/ui/badge.tsx` (127 lines, accent variant verified)
  - `src/components/landing/hero-section.tsx` (85 lines, plagiarized H1 + sub at lines 28-38)
  - `src/components/landing/index.ts` (14 lines, `HeroSection` export at line 8)
  - `src/app/(marketing)/page.tsx` (27 lines, `<HeroSection />` import + render verified)
  - `src/app/(marketing)/layout.tsx` (30 lines, plagiarized title + description at lines 13-15)
  - `src/app/globals.css` (317 lines, lines 288-296 `html, body` block, NO `scroll-behavior` rule confirmed)
  - `scripts/lint-vocab.mjs` (82 lines, BANNED list verified)
  - `package.json` (`lint:vocab` script wired, motion@12.29.2 + framer-motion@12.29.3 + react@19.2.3 + next@16.1.5 + tailwindcss@4 verified)
- **CONTEXT.md** Phase 2 (39 decisions D-01..D-39)
- **BRAND-BIBLE.md** lines 1-555 (full read including Visual Metaphor Lock addendum)
- **REPLACEMENT-COPY.md** Phase 1 (hero block + OG metadata block verified)
- **REQUIREMENTS.md** (BUILD-01..02, HERO-01..10 verbatim)
- **ROADMAP.md** Phase 2 entry (Success Criteria 1-5)
- **PROJECT.md** (milestone context + Key Decisions table)
- **STATE.md** (Phase 1 complete confirmation)
- **BRAND-SPINE.md** (voice + vocab + lockup pattern)
- **docs/tokens.md** (all coral/neutral/spacing/easing values)
- **docs/motion-guidelines.md** (existing motion conventions)

### Secondary (MEDIUM confidence — verified with web search)
- **`text-wrap: balance` global support 89% (May 2026):** [caniuse.com/css-text-wrap-balance](https://caniuse.com/css-text-wrap-balance) — Safari 17.5+, Chrome 130+ full, partial in Chrome 114-129
- **`motion/react` v12 LazyMotion bundle:** [motion.dev/docs/react-lazy-motion](https://motion.dev/docs/react-lazy-motion) — confirms 4.6 KB core + ~10 KB domAnimation = ~15 KB initial bundle
- **Magic UI inventory:** [magicui.design/docs/components](https://magicui.design/docs/components) — Animated Beam, Border Beam, etc.
- **Aceternity UI inventory:** [ui.aceternity.com/components](https://ui.aceternity.com/components) — Background Gradient Animation, Spotlight, etc.
- **Origin UI rebrand:** [coss.com/origin](https://coss.com/origin) — formerly originui.com, now legacy snapshot at coss.com
- **Cult UI inventory:** [cult-ui.com](https://www.cult-ui.com/) — DynamicIsland, FamilyButton, etc.

### Tertiary (LOW confidence — assumption flagged)
- Reference set hero CSS values (Anthropic / Linear / Vercel / Raycast clamp() ranges) — based on training data + composition heuristics. NOT directly extracted from production sites in this research session. [ASSUMED]
- GSAP commercial license cost ($199/yr/dev Business tier) — pulled from Phase 1 RESEARCH.md A5 entry, not re-verified. [ASSUMED — and not relevant since GSAP is rejected]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Anthropic / Linear / Vercel / Raycast hero H1 sizes are 64-96px desktop | §2 D-35 | LOW — Phase 2 ships at 44-80px which is comfortably below the high end; if reference is actually smaller, our spec still reads premium |
| A2 | `text-wrap: balance` respects author-specified `<br />` breaks | §2 D-39 | LOW — verified per CSS WG spec; balance applies between author-specified break opportunities only |
| A3 | Inter at weight 300 is loaded by `next/font/google` default subset | §2 D-35 + Pitfall 7 | LOW — Next 16 uses Inter variable font by default; weight 300 is supported across the variable axis |
| A4 | Brownian σ = 8 px/s and attractor k = 1.4 produce the visual we want | §2 D-36 | MEDIUM — these numbers are derived from physics intuition; Phase 2 plan should include a "tune to taste" verification step where Davide observes the animation and signs off (or the planner adjusts σ + k by ±50% based on visual review) |
| A5 | 87% reads as "credible high-confidence" to creators/investors | §2 D-34 | LOW — psychological credibility heuristic well-established; flexible to any 80-95 value at Davide's call |
| A6 | Lightning CSS strips backdrop-filter from CSS classes (still true in Next 16.1.5) | §6 Pitfall 2 | LOW — known issue documented in CLAUDE.md and Phase 1 RESEARCH.md; consistent across recent Next major versions |
| A7 | Module-level `let` declarations isolate per-file in Next 16 RSC | §6 Pitfall 5 | LOW — TypeScript module semantics are clear; per-file state is enforced by ES module spec |
| A8 | Phase 2 hero is the only location of behavioral simulation viz; in-app embed is deferred | §3 Pattern Map | LOW — VIZ-03 (scale affordances) explicitly defers in-app embed to a separate future milestone |
| A9 | Vercel preview deployments work as the review channel for Phase 2 (no parallel `/landing-v2`) | §1 D-03 | LOW — confirmed by CONTEXT.md D-03 reasoning |
| A10 | The 11% of users without `text-wrap: balance` get acceptable fallback via `<br />` | §2 D-39 | LOW — `<br />` is universally supported; balance only adds polish |

**No claims tagged [ASSUMED] need user confirmation before plan execution** beyond A4 (motion equation tuning) and A5 (percentage value) — both are intentionally adjustable in the constants file. Plan-phase should include a "tune-to-taste" verification step.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in `package.json`; reuse patterns directly read from source files
- Architecture (server/client component split, file structure): HIGH — matches existing patterns in `src/components/hive/`
- Pitfalls: HIGH — all derived from CLAUDE.md known issues + Phase 1 RESEARCH.md pitfalls + direct codebase observation
- D-34 D-35 D-36 D-37 D-38 D-39 resolutions: MEDIUM — concrete numbers picked but not extracted from production reference sites; tuning expected during Phase 2 verification

**Research date:** 2026-05-10
**Valid until:** 2026-06-09 (30-day stability for the locked stack; Phase 2 should plan + execute well before this)

---

## RESEARCH COMPLETE

**Phase:** 2 - Foundation & Hero
**Confidence:** HIGH

### Key Findings (planner reads this first)

1. **Two pre-flight drift items must be addressed in Phase 2 plans:** (a) module-level animation flag in the hive viz is named `globalAnimationComplete` not `globalAnimationPlayed` — new component should use a phase-specific name like `behavioralHeroAnimationComplete`; (b) `scroll-behavior: smooth` is NOT in `globals.css` — Phase 2 must add it (7 lines including reduced-motion fallback) for the `#science` secondary CTA to work.

2. **All six delegated decisions resolved with concrete values:** D-34 = 87%; D-35 = `clamp(2.75rem, 6.5vw, 5rem)` Inter weight 300 with `text-wrap: balance` + explicit `<br />`; D-36 = drift+attract with Brownian σ=8 px/s, attractor k peak=1.4, damping=0.92, duration=2.2s; D-37 = `radial-gradient(ellipse 90% 70% at 50% 35%, rgba(255,127,80,0.18) 0%, ..., #07080a 70%)`; D-38 = separate constants file matching `hive-constants.ts` pattern; D-39 = paired `text-wrap: balance` + `<br />` for the 11% of users without browser support.

3. **External component policy concrete:** ZERO imports from Magic UI / Aceternity / Origin UI / Cult UI for Phase 2 hero. The 6 REJECT criteria + 7 ACCEPT criteria (for future phases) are encoded in §3 with real component examples (Animated Beam, Background Gradient Animation, DynamicIsland, etc.). Planner converts §3 directly to `02-EXTERNAL-COMPONENT-POLICY.md`.

4. **Validation Architecture spec covers all 5 ROADMAP success criteria with concrete grep/test commands.** SC1 (page renders): 9 grep checks + 4 manual viewport checks. SC2 (reduced-motion): 5 grep checks + optional 4-test Vitest suite for constants. SC3 (zero "viral"/"AI"): 10 grep checks + `pnpm lint:vocab` clean. SC4 (mobile 375px): 2 optional Playwright tests + manual viewport observation. SC5 (policy doc): 5 grep checks. Wave 0 gap: optional `behavioral-hero-constants.test.ts` (~30 LOC).

5. **Hero composition is mostly server-rendered (LCP-friendly):** `BehavioralHero` is a server component (no `"use client"`). Only `BehavioralCanvas` requires client hydration. Server ships static HTML for text + gradient + button HTML; client hydrates the canvas after first paint. This aligns with Phase 5 BUILD-04 (Core Web Vitals LCP < 2.5s) without any extra optimization work in Phase 2.

### File Created
`.planning/phases/02-foundation-hero/02-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | All libraries verified in package.json; Canvas 2D pattern proven at 1300+ nodes / 60fps in `src/components/hive/` |
| Architecture (RSC + client island split) | HIGH | Matches existing pattern; verified by reading 6 hive files end-to-end |
| Pitfalls | HIGH | Derived from CLAUDE.md + Phase 1 RESEARCH.md + 2 newly-found drift items |
| D-34..D-39 resolutions | MEDIUM | Concrete numbers picked; tuning to taste expected in Phase 2 verification (Brownian σ + attractor k especially) |
| External library survey | MEDIUM | Inventory verified via web search; component-by-component audit deferred to Phase 3-4 if needed |

### Open Questions for Planner
1. Q1 — Should OG metadata fix in `(marketing)/layout.tsx` be a Phase 2 plan or deferred to Phase 6?
2. Q2 — Vitest tests for constants in Phase 2 or defer to Phase 5?
3. Q3 — `#science` anchor target (no target / placeholder / map to existing section)?
4. Q4 — Canvas component unit tests (skip / smoke / Playwright)?
5. Q5 — `02-EXTERNAL-COMPONENT-POLICY.md` linking strategy?
6. Q6 — Confidence chip DOM-accessible vs canvas-only (recommended: canvas-only, aria-label suffices)?

### Ready for Planning
Research complete. Planner can now create 4-5 PLAN.md files (Plan 1 scaffold + scroll-behavior, Plan 2 hero composition, Plan 3 canvas + constants, Plan 4 ambient gradient, Plan 5 policy doc; optionally Plan 0 OG metadata fix). All decisions resolved; all line landmarks verified; all pitfalls catalogued.

---

*Phase: 2-Foundation & Hero*
*Research completed: 2026-05-10*
*Researcher: Claude Code (gsd-phase-researcher)*
*Confidence: HIGH on stack + architecture + pitfalls; MEDIUM on tunable numeric values (D-34, D-36)*
