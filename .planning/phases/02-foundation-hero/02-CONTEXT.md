# Phase 2: Foundation & Hero - Context

**Gathered:** 2026-05-10
**Status:** Ready for research / planning
**Note:** User delegated all gray-area calls ("im non technical you decide"). Claude made implementation decisions grounded in Phase 1 brand/tech locks and the Anthropic / Linear / Raycast / Vercel reference set. Davide retains override authority on any decision below before plan-phase.

<domain>
## Phase Boundary

Build the **page scaffold** for the new landing and the **above-fold hero section** (viewport 1) — pre-headline lockup, oversized H1, sub-headline, subline, dual CTA, behavioral-simulation Canvas particle visual, and ambient gradient backdrop. Document external component vetting policy.

**What's in scope:**
- Replace `<HeroSection />` in `src/app/(marketing)/page.tsx` with new hero composition.
- Build `BehavioralHero` + `BehavioralCanvas` components.
- Render hero copy verbatim from REQUIREMENTS.md HERO-01..05.
- Implement behavioral-simulation particle viz per BRAND-BIBLE §Visual Metaphor Lock §1.
- Render ambient gradient backdrop.
- Wire dual CTA routing (auth-aware).
- Mobile responsive at 375px viewport.
- Document BUILD-02 external component rejection criteria as an artifact.

**What's NOT in scope (later phases):**
- Demo viewport (Phase 3 — DEMO-01..08).
- Engine pipeline diagram (Phase 3 — WORKS-01..06).
- Bento three-surfaces (Phase 3 — SURF-01..06).
- Science / Social Proof / Pricing / Footer rebuilds (Phase 4).
- Lighthouse / Core Web Vitals / WCAG audit (Phase 5).
- $100M+ reference-fidelity audit (Phase 6).
- Old landing section removal — old sections (Backers, Features, Stats, CaseStudy, Partnership, FAQ) STAY in `(marketing)/page.tsx` after Phase 2; they get swapped section-by-section in Phases 3-4. Phase 6 confirms final cleanup.

</domain>

<spec_lock>
## Locked From Phase 1 (Non-Negotiable)

These decisions are LOCKED and flow directly into Phase 2 — do NOT re-litigate:

### Tech (from BRAND-BIBLE §Visual Metaphor Lock §1, D-08..D-11)
- **Canvas 2D** for hero particle viz (~30 KB). NO third-party particle library.
- Reuse patterns verbatim from `src/components/hive/`:
  - `use-canvas-resize.ts:43-100` — DPR-aware resize
  - `use-hive-animation.ts:42-49, 121-193` — RAF + module-level `globalAnimationPlayed` flag (one-shot per session)
  - `HiveCanvas.tsx:54-57, 147-186` — ref-based render state (no React re-renders per frame)
  - `hive-renderer.ts:240-298` — color batching via `Map<colorKey, circles>`
- Reuse `src/hooks/usePrefersReducedMotion.ts:1-29` VERBATIM (no new hook).
- Easing: `--ease-out-cubic` (matches `easeOutCubic` at `use-hive-animation.ts:57`).
- Total hero JS budget: **~45 KB** gzipped (Canvas 2D ~30 KB + later pipeline SVG + motion/react ~15 KB). Under 50 KB ceiling per VIZ-04.
- Reduced-motion fallback: render static **converged keyframe** (particles in aggregated state showing confidence score). No animation. (D-10)
- One-shot animation on viewport entry, NEVER a loop.

### Brand & Copy (from BRAND-SPINE.md, REQUIREMENTS.md HERO-01..05)
- Hero copy is **locked verbatim** — no rewriting, no paraphrasing in Phase 2:
  - Pre-headline: `VIRTUNA · A NUMEN MACHINES PRODUCT`
  - H1: *"Predict how your audience will respond. Before you post."*
  - Sub-headline: *"Virtuna simulates your audience to forecast every video before it ships."*
  - Subline: *"Trained on decades of behavioral research. Self-improving with every outcome."*
  - Primary CTA: `Run a prediction →`
  - Secondary CTA: `See the science`
- Vocab guardrails enforced by `scripts/lint-vocab.mjs` + pre-commit hook (Plan 04 of Phase 1). New strings introduced in Phase 2 MUST pass `pnpm lint:vocab`.
- Zero "viral" / "AI" / "go viral" in hero copy (HERO-10).
- Inter as sole font (no new typefaces).
- Coral `#FF7F50` is THE brand color — exact hex (per BRAND-BIBLE: do NOT round-trip through `oklch()`).

### Imports (from BRAND-BIBLE §Visual Metaphor Lock §5 "Bundle pinning rule")
- All NEW motion code uses `motion/react` import path. NEVER `framer-motion`. (Legacy `framer-motion` imports in `src/components/app/simulation/*.tsx` are slated for separate migration.)

### Outstanding Pre-Phase-2 Gate
- **ROADMAP SC2 (hero copy sign-off):** Phase 1 VERIFICATION.md flagged `human_needed` because the sign-off in REPLACEMENT-COPY.md was stamped "via Claude Code orchestrator after 7-step verification protocol" rather than direct Davide review. Davide should personally read `.planning/phases/01-brand-spine-visual-metaphor/01-REPLACEMENT-COPY.md` hero block and confirm before plan-phase. (The copy matches REQUIREMENTS.md HERO-01..05 verbatim, so this is a formality, but it is the only Phase 1 gate still flagged uncertain.)

</spec_lock>

<decisions>
## Implementation Decisions (Davide-delegated, Claude-decided)

### Scaffold Strategy

- **D-01:** **Build directly into `src/app/(marketing)/page.tsx`** — section-by-section replacement. NO parallel `/landing-v2` route at any point.
- **D-02:** Phase 2 modifies `src/app/(marketing)/page.tsx` to replace the import + render of `<HeroSection />` with the new `<BehavioralHero />` component. All other old sections (`<BackersSection />`, `<FeaturesSection />`, `<StatsSection />`, `<CaseStudySection />`, `<PartnershipSection />`, `<FAQSection />`) STAY untouched in Phase 2 and get swapped in Phases 3-4. Old `<HeroSection />` component file (`src/components/landing/hero-section.tsx`) is deleted in Phase 2 if no longer imported anywhere.
- **D-03:** This is a Frankenstein-in-progress strategy: prod landing reads "new hero + old plagiarized middle sections" during Phases 2-3. Acceptable because (a) REQUIREMENTS.md BUILD-09 explicitly forbids `/landing-v2` as end state, (b) Vercel preview deployments on PR branches let Davide review the new state without prod swap, (c) old plagiarized copy on middle sections is the existing legacy violation already flagged in `01-PLAGIARISM-AUDIT.md` — Phases 3-4 are the systematic fix.
- **D-04:** No feature flag. The new hero ships in the same commit + deploy as the old middle sections.

**Rejected:** parallel `/landing-v2` route (REQUIREMENTS forbids end state, doubles maintenance), feature-flag toggle (extra runtime branching, no benefit since Vercel previews suffice for review).

### Behavioral Simulation Visual Execution (Phase 1 D-07 delegated)

- **D-05:** **Particle count = 250 on desktop, 120 on mobile (≤640px).** In Phase 1's suggested 200-400 sweet spot. Matches `hive` viz density at smaller scale. Leaves performance headroom for 60fps on mid-range mobile per HERO-08 ("scales gracefully OR simplifies").
- **D-06:** **Aggregation target = a coral pill (Raycast badge aesthetic) containing a percentage number ("87%").**
  - Reasoning: The hero promises *prediction*; the most honest visual is the actual output (a confidence score). A coral pill aligns with Raycast badge primitives + brand color anchor. Exact percentage value to be picked by researcher (any plausible high-confidence number, e.g., 87% / 91% / 84% — must look credible, not too-good-to-be-true 99%).
  - Pill styling: bg `rgba(255,127,80, 0.15)`, border `rgba(255,127,80, 0.4)`, text-coral, 12px radius, Inter 500 weight, ~14-16px size. Researcher cross-checks against existing badge primitives in `src/components/ui/`.
  - The pill is the **only** text inside the canvas at converged state. No "confidence" label, no axis, no chart-ware.
- **D-07:** **Convergence geometry = drift+attract.** Each particle has small Brownian random motion + an attractor force toward the chip center. Reads as "audience reacting individually then aggregating" vs. mechanical radial collapse.
  - Mechanism: each frame, particle position += (velocity * dt) + (attractor_force * dt) toward target. Velocity has a small random perturbation per frame to read organic. Attractor strength ramps up over the animation duration.
  - Animation duration: 2.0-2.4s total (researcher tunes). Enough time for the viewer to *see* the aggregation, short enough to not feel slow.
- **D-08:** **Initial distribution = uniform random across the canvas.** Not clustered. "Your audience = many distinct individuals, distributed."
- **D-09:** **Color split = ~70% coral (majority/positive), ~30% Raycast neutral gray (minority).** Per-particle color assigned at start. Converged state visibly skews coral, telegraphing high confidence.
- **D-10:** **Particle size = 2-3px (variable, slight randomness).** Small enough that 250 particles read as a "cloud", not "blobs". Renders at DPR-aware sharpness via `use-canvas-resize` reuse pattern.
- **D-11:** **No "video stimulus" visualization.** Phase 1 spec mentioned particles "reacting to a video stimulus" but never required showing the stimulus. Showing a video frame in the hero is confusing (creator hasn't paste a URL yet) and competes with the H1 for attention. The stimulus is **implied** — particles aggregate around the chip center, which represents the prediction output, not the input stimulus.
- **D-12:** **Canvas placement = top-right of hero, behind/beside the H1.** Hero composition: left-side text column (pre-headline → H1 → sub-headline → subline → CTAs), right-side canvas viz. On mobile (≤640px) the canvas stacks above the text column. This matches the Linear / Anthropic / Vercel hero composition pattern.

### Ambient Gradient Backdrop (HERO-07)

- **D-13:** **Full-bleed radial gradient** behind the entire hero section. Coral concentrated in the upper-center area where the canvas particles converge.
- **D-14:** **Static gradient. No animation.** The particle viz IS the motion; the gradient is the still backdrop. Reduces motion-design complexity, matches Raycast's static-gradient hero, satisfies `prefers-reduced-motion` without a separate keyframe.
- **D-15:** **Coral intensity = restrained Raycast-style accent.** Center coral peaks at ~15-25% opacity over dark Raycast neutral background. Coral fades to fully Raycast-neutral by ~40-60% radial distance. Not a brand-forward wash; an anchor for the convergence point.
  - Reference: Raycast hero ambient gradient (`raycast.com`) + Anthropic claude.ai marketing pages (calm, restrained).
- **D-16:** Background base color: existing Raycast neutral darks from `docs/tokens.md`. Specific tokens (researcher picks): `--background` base, fading through a `radial-gradient` with `--coral-500` overlay at low alpha.
- **D-17:** Gradient implementation: pure Tailwind v4 utility classes + `bg-[radial-gradient(...)]` arbitrary value OR a single CSS class in `globals.css`. NO Canvas, NO SVG, NO JS for the gradient — pure CSS keeps it free in bundle terms and renders before JS hydrates (good for LCP per Phase 5 BUILD-04).

### External Component Policy (BUILD-02)

- **D-18:** **Strict NO IMPORT for Phase 2 hero from Magic UI / Aceternity / Origin UI / Cult UI.** Build entirely from raw Tailwind v4 + existing 36-component design system (`src/components/ui/`, `src/components/primitives/`) + Canvas 2D for the particle viz.
  - Reasoning: Reference set (Anthropic / Linear / Raycast / Vercel) all build their own primitives. Importing maximalist motion components (Aceternity AnimatedBeam, BackgroundGradientAnimation, BorderBeam, etc.) directly conflicts with the locked Raycast restraint aesthetic.
- **D-19:** **Rejection criteria documented** as `.planning/phases/02-foundation-hero/02-EXTERNAL-COMPONENT-POLICY.md` — a do/don't matrix that planner produces. Criteria to encode:
  - REJECT if it's a maximalist motion component (animated beams, background gradient animations, neon glow, particle swarms in libraries).
  - REJECT if it ships its own font, color tokens, or design primitives (fights Tailwind v4 + Inter + our tokens).
  - REJECT if it requires a peer dep that conflicts with our `motion@12` / `framer-motion@12` / `next@16.1.5` / `react@19.2.3` / `tailwindcss@4`.
  - REJECT if it adds > 10 KB gzipped for a single component (hero JS budget is ~45 KB total).
  - REJECT if it has accessibility gaps — no reduced-motion support, no screen-reader alternatives.
  - ACCEPT future imports (not Phase 2) only if: single component, copy-pasted into our `src/components/landing/`, restyled to our coral + Raycast tokens, vocab-lint passes, bundle delta verified, accessibility verified.
  - Phase 2 explicit policy: ZERO imports from external libraries for the hero. Future phases (3-4) MAY consider individual imports if a strong case is made against these criteria.
- **D-20:** This policy doc supersedes any earlier instinct to "vet specific imports" — Phase 2 hero is built from scratch, period. Phases 3-6 may revisit per criteria.

### Hero Layout & Typography (researcher fills exact tokens)

- **D-21:** **Layout = two-column hero on desktop, stacked on mobile.** Left column: text stack (pre-headline → H1 → sub-headline → subline → CTAs). Right column: Canvas particle viz. Vertical center alignment on desktop. ~60/40 left/right split on desktop, both ~full-width on mobile.
- **D-22:** **Pre-headline (`VIRTUNA · A NUMEN MACHINES PRODUCT`):** small monospaced uppercase, Raycast-restrained. Use existing monospace token if one exists (researcher checks `docs/tokens.md`); otherwise Inter at letter-spacing-wide + uppercase. ~12-14px. Color = muted Raycast neutral (per BRAND-SPINE §5 lockup pattern).
- **D-23:** **H1 (`Predict how your audience will respond. Before you post.`):** oversized, light weight (Inter 300), tight line-height (~1.05), tight letter-spacing (-0.02em). Size via `clamp()` — researcher picks the range from Anthropic / Linear / Vercel hero references (suggested starting range: `clamp(2.75rem, 7vw, 5.5rem)` = 44-88px). Two-line break preserved on all viewports — use CSS `text-wrap: balance` for natural break, with `<br />` fallback if needed.
- **D-24:** **Sub-headline:** medium weight (Inter 500), ~1.25-1.5rem (~20-24px), Raycast neutral.
- **D-25:** **Subline:** Inter 400, ~1rem-1.125rem (~16-18px), muted Raycast gray (lower contrast than sub-headline, still WCAG AA per BUILD-05 / Phase 1 BRAND-BIBLE `gray-500: #848586` 5.4:1 AA).
- **D-26:** **CTAs:** reuse existing `src/components/ui/button.tsx` CVA variants. Primary `Run a prediction →` uses CVA `default` or `primary` variant (coral background, dark brown text per BRAND-BIBLE accent-foreground spec). Secondary `See the science` uses CVA `outline` or `ghost` variant. NO new button styles introduced.

### CTA Routing (HERO-05 + BUILD-10)

- **D-27:** **Primary CTA `Run a prediction →` routes to `/dashboard`** for logged-in users, `/login?next=/dashboard` for logged-out users. The middleware (`src/lib/supabase/middleware.ts`) already handles the auth redirect — Phase 2 just renders `<Link href="/dashboard">`. The deep-link preservation is existing functionality (per PROJECT.md Validated Requirements).
- **D-28:** **Secondary CTA `See the science` is a smooth-scroll anchor link** to `#science` on the same page. Phase 2 ships the `<Link href="#science">` with `scroll-behavior: smooth` on `html` (already in `globals.css` per existing landing) — even though the Science section doesn't exist yet in Phase 2, the anchor renders correctly and just doesn't scroll until Phase 4 lands SCI-01..06. The anchor is forward-compatible.
- **D-29:** Full BUILD-10 verification happens in Phase 5 (auth-gated routing on real iPhone/tablet viewports). Phase 2 just wires the static `href` values.

### Component Organization

- **D-30:** **New components live in `src/components/landing/`** alongside the existing plagiarized ones — same folder, distinct file names.
  - `BehavioralHero.tsx` — composition (text + canvas + gradient + CTAs)
  - `BehavioralCanvas.tsx` — Canvas 2D particle viz
  - `behavioral-hero-constants.ts` — particle count, color tokens, easing constants, duration
- **D-31:** **File naming convention = PascalCase for components, kebab-case for non-component utilities** (matches existing `src/components/hive/HiveCanvas.tsx` + `src/components/hive/hive-constants.ts` pattern).
- **D-32:** Old plagiarized `src/components/landing/hero-section.tsx` file is DELETED in Phase 2 (after the `(marketing)/page.tsx` swap) since no other import references it. Confirmed via `grep -r "hero-section" src/`.
- **D-33:** `src/components/landing/index.ts` barrel export updated to export `BehavioralHero` and remove the deleted `HeroSection` export.

### Claude's Discretion (delegated to plan-phase researcher / planner)

- **D-34:** Exact percentage value inside the coral confidence chip (87% / 91% / 84% — any plausible high-confidence number that's not 99%).
- **D-35:** Exact `clamp()` values for H1 typography — researcher pulls from Anthropic / Linear / Vercel hero reference inspection.
- **D-36:** Exact particle motion equations (Brownian magnitude, attractor strength curve, easing parameters) — researcher tunes against the locked `easeOutCubic` token from `use-hive-animation.ts:57`.
- **D-37:** Exact gradient color stops in the radial gradient — researcher picks from `docs/tokens.md` neutrals + coral overlay at locked low alpha.
- **D-38:** Whether the canvas component imports particle constants from a shared file vs inlines them — code style call.
- **D-39:** Whether to use `text-wrap: balance` exclusively or pair with explicit `<br />` for the H1 line break — researcher cross-browser checks (Safari support).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner, executor) MUST read these before starting.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` — Phase 2 entry, Success Criteria 1-5, requirement IDs (BUILD-01, BUILD-02, HERO-01..10)
- `.planning/REQUIREMENTS.md` — full requirement text for BUILD-01..02 and HERO-01..10; locked hero copy verbatim
- `.planning/PROJECT.md` — milestone context, hero copy block, three-audience strategy, Out-of-Scope list, Key Decisions table
- `.planning/STATE.md` — current progress, last activity

### Brand & Design System (Phase 1 outputs + existing)
- `BRAND-BIBLE.md` (lines 1-351) — existing Raycast design language: bg-transparent cards, 6% borders, 12px radius, inset shadows, hover-state conventions, coral spec, accent-foreground brown
- `BRAND-BIBLE.md` (lines 352-555) — **§Visual Metaphor Lock addendum** (Phase 1 output) — locked Canvas 2D tech, reuse patterns table with file:line landmarks, performance budget, rejected alternatives, Phase 2-6 usage instructions. **THIS is the most important file for Phase 2 researcher.**
- `.planning/reference/BRAND-SPINE.md` — voice + vocab + tone + Numen Machines lockup pattern + 7-viewport audience tuning. Any new strings introduced in Phase 2 MUST cross-check against §3 (preferred verbs) + §4 (banned table) + §6 (audience tuning).
- `docs/motion-guidelines.md` — existing motion conventions; new hero motion must align
- `docs/tokens.md` — design tokens (coral, Raycast neutrals, `--ease-out-cubic`)
- `docs/design-specs.json` — machine-readable token spec

### Phase 1 Outputs (decisions + research foundation)
- `.planning/phases/01-brand-spine-visual-metaphor/01-CONTEXT.md` — D-01 through D-19, including hero tech split (D-08), reduced-motion fallback (D-10), Phase 2-finalizes list (D-07)
- `.planning/phases/01-brand-spine-visual-metaphor/01-RESEARCH.md` — Canvas + motion patterns research; researcher consults before writing canvas code
- `.planning/phases/01-brand-spine-visual-metaphor/01-PATTERNS.md` — codebase pattern map (closest analogs for new files)
- `.planning/phases/01-brand-spine-visual-metaphor/01-REPLACEMENT-COPY.md` — hero block (verbatim mirror of REQUIREMENTS HERO-01..05); copy compliance source
- `.planning/phases/01-brand-spine-visual-metaphor/01-VERIFICATION.md` — flagged SC2 (hero copy sign-off) as `human_needed`; Davide should personally confirm before Phase 2 plan starts

### Existing Code to Reuse Verbatim or Pattern-Match
- `src/components/hive/HiveCanvas.tsx` — reference Canvas 2D component (1300+ nodes @ 60fps proven); closest pattern analog for `BehavioralCanvas.tsx`
- `src/components/hive/use-canvas-resize.ts` (esp. lines 43-100) — DPR-aware resize hook; REUSE VERBATIM
- `src/components/hive/use-hive-animation.ts` (esp. lines 42-49, 65-69, 121-193) — RAF + module-level `globalAnimationPlayed` + reduced-motion guard; PATTERN REUSE
- `src/components/hive/hive-renderer.ts` (esp. lines 240-298) — color batching via `Map<colorKey, circles>`
- `src/components/hive/HiveCanvas.tsx:54-57, 147-186` — ref-based render state (no React re-renders per frame)
- `src/hooks/usePrefersReducedMotion.ts` (1-29) — REUSE VERBATIM
- `src/components/ui/button.tsx` — CVA button variants for CTAs
- `src/components/ui/typography.tsx` — Heading/Text components (researcher checks whether to use or build inline)
- `src/components/layout/footer.tsx` + `src/components/layout/header.tsx` — Phase 2 keeps these untouched
- `src/app/(marketing)/page.tsx` — current landing entry; Phase 2 modifies this file
- `src/app/(marketing)/layout.tsx` — public marketing layout; Phase 2 does NOT modify

### Tooling & Enforcement
- `scripts/lint-vocab.mjs` — vocab enforcement; runs on commit + on PR
- `.githooks/pre-commit` — invokes lint-vocab over `src/app src/components/landing src/components/onboarding`
- `package.json` scripts: `lint:vocab`, `lint`, `build`, `test`

### Codebase Maps (for orientation)
- `.planning/codebase/STRUCTURE.md` — directory layout
- `.planning/codebase/ARCHITECTURE.md` — Next.js route-group segmentation, layer pattern
- `.planning/codebase/STACK.md` — Next.js 16.1.5, React 19.2.3, Tailwind v4, motion 12.29.2

### Outputs Phase 2 Will Create
- `src/components/landing/BehavioralHero.tsx` — composition (text + canvas + gradient + CTAs)
- `src/components/landing/BehavioralCanvas.tsx` — Canvas 2D particle viz
- `src/components/landing/behavioral-hero-constants.ts` — particle config (count, colors, durations, easing)
- Updated `src/components/landing/index.ts` — exports new components, drops `HeroSection`
- Updated `src/app/(marketing)/page.tsx` — renders `<BehavioralHero />` instead of `<HeroSection />`
- Deleted `src/components/landing/hero-section.tsx` — plagiarized component, replaced
- `.planning/phases/02-foundation-hero/02-EXTERNAL-COMPONENT-POLICY.md` — BUILD-02 rejection-criteria artifact

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (proven in this codebase)
- **Canvas 2D hive viz** (`src/components/hive/`) — proven 1300+ nodes / 60fps. Direct pattern source for `BehavioralCanvas.tsx`. Researcher MUST read `HiveCanvas.tsx`, `use-hive-animation.ts`, `use-canvas-resize.ts`, `hive-renderer.ts`, `hive-constants.ts` before writing the particle component.
- **`useCanvasResize` + `usePrefersReducedMotion`** — reused verbatim, no duplication.
- **CVA `Button` component** (`src/components/ui/button.tsx`) — Hero CTAs use existing variants; no new button styles introduced.
- **36 design system components + 100+ tokens** — Hero composition uses ONLY these + raw Tailwind v4. No external imports per D-18.
- **Inter font + design tokens** (`docs/tokens.md`) — typography pulls from existing tokens; no new fonts/colors introduced.

### Established Patterns
- **Raycast aesthetic on cards**: bg-transparent, 6% borders, 12px radius, inset shadow, hover `bg-white/[0.02]` (per BRAND-BIBLE existing section). The Hero is NOT a card, but adjacent components (CTAs, eventual chip styling) follow these conventions where applicable.
- **`React.useId()`** for SSR-safe unique IDs (per PROJECT.md Key Decisions table). If the Canvas component or gradient defs need IDs, use this hook.
- **Module-level animation-complete flag** — `globalAnimationPlayed` boolean at module scope (per `use-hive-animation.ts:42-49`) — survives component remounts, ensures one-shot per session.
- **Ref-based render state** — camera, layout, interaction in refs; `render()` reads synchronously. NO `useState` per frame.
- **Color batching** — group particles by color, draw all coral first, then all neutrals; fewer `fillStyle` changes per frame.
- **Tailwind v4 `@theme` block** in `src/app/globals.css` — semantic design tokens.
- **PascalCase for components**, **kebab-case for non-component utilities** (per `src/components/hive/HiveCanvas.tsx` + `src/components/hive/hive-constants.ts` pattern).

### Integration Points
- Hero CTAs use `<Link>` from `next/link` (per existing landing components).
- Middleware (`src/lib/supabase/middleware.ts`) handles auth redirect on `/dashboard` access — no client-side auth check needed in hero component.
- Smooth-scroll behavior already configured in `src/app/globals.css` (verify researcher).
- Vercel deploy preview on PR branch is the review channel for visual fidelity (no parallel `/landing-v2` route).

### Known Constraints (from CLAUDE.md / PROJECT.md / BRAND-BIBLE)
- Tailwind v4 has oklch inaccuracy below L < 0.15 — coral is hex `#FF7F50`, do NOT round-trip through `oklch()`.
- Lightning CSS strips backdrop-filter — N/A for canvas particles, but if any glass surface frames either visual, apply `backdropFilter` via React inline `style={{ ... }}`, not a CSS class.
- Dev cache hygiene — if Phase 2 motion changes don't render, kill dev + clear `.next/` + clear `node_modules/.cache/` + clear browser cache.

</code_context>

<specifics>
## Specific Ideas

- **Hero composition**: two-column on desktop (text left, canvas right), stacked on mobile (canvas above text). Vertical-center align. ~60/40 split on desktop.
- **Confidence chip mock**: coral pill with "87%" inside. Single pill, no axis, no chart. Center of canvas at converged state. ~80-120px wide.
- **Particle palette**: 70% coral `#FF7F50`, 30% Raycast neutral gray (researcher picks specific gray token).
- **Convergence motion**: drift+attract, 2.0-2.4s animation, one-shot, `easeOutCubic`.
- **Gradient**: full-bleed radial, coral at center peak ~20% opacity over Raycast dark base, fades to fully neutral by ~50% radial distance.
- **CTAs**: primary `Run a prediction →` → `/dashboard` (middleware handles auth). Secondary `See the science` → `#science` smooth-scroll anchor (forward-compatible — Science section ships in Phase 4).
- **External library imports for Phase 2**: ZERO. Build hero from raw Tailwind + design system + Canvas 2D + motion/react (for later pipeline only — not used in hero).

</specifics>

<deferred>
## Deferred Ideas (do NOT implement in Phase 2)

- **Engine pipeline diagram** — Phase 3 (WORKS-01..06). Phase 2 only does the hero; the pipeline visualization is its own scope.
- **A/B testing hero variants** — OPT-01, out of scope this milestone.
- **Light-mode hero variant** — OPT-02, out of scope this milestone (dark-mode first per PROJECT.md Constraints).
- **Sound design on hero motion** — OPT-04, out of scope.
- **In-app prediction viz rebuild** — APP-01, separate future milestone (visual metaphor locked here, implementation deferred per PROJECT.md "Future milestones").
- **Hover state on confidence chip** — not specified in HERO-01..10; researcher omits unless natural Raycast-native pattern dictates otherwise.
- **Click-through on confidence chip** — chip is decorative, not interactive. No `<button>`, no `<a>`. CTAs handle conversion.
- **Multiple particle viz states** (e.g., different scenarios on hover, click-to-replay) — out of scope; one-shot animation only.
- **Light-mode gradient variant** — out of scope; dark-mode only.
- **Magic UI / Aceternity / Origin UI / Cult UI imports for Phase 2 hero** — explicitly rejected per D-18. Future phases (3-4) may revisit individual imports per D-19 criteria.
- **Hero copy rewrite or paraphrase** — locked verbatim per REQUIREMENTS.md HERO-01..05 + BRAND-SPINE.md compliance.

</deferred>

<pre_phase_gates>
## Pre-Phase-2 Gates (must clear before plan-phase)

- **[ ] Davide personally signs off on hero copy** — read `.planning/phases/01-brand-spine-visual-metaphor/01-REPLACEMENT-COPY.md` hero block (lines reflecting HERO-01..05) and confirm. Phase 1 VERIFICATION flagged SC2 as `human_needed` because the existing sign-off was proxied through the orchestrator. The copy matches REQUIREMENTS.md verbatim, so this is a formality — but ROADMAP SC2 requires direct human review.
- **[ ] Davide reviews this CONTEXT.md** and either approves the delegated calls (D-01 through D-39) or redirects specific decisions. Calls were made by Claude per locked Phase 1 brand/tech context + Anthropic/Linear/Raycast/Vercel reference set, but Davide retains override authority.

</pre_phase_gates>

---

*Phase: 2-Foundation & Hero*
*Context gathered: 2026-05-10*
*User input: delegated all gray-area calls to Claude*
*Decisions made: 39 (D-01 through D-39)*
*Pre-phase gates: 2 outstanding (hero copy sign-off + CONTEXT.md approval)*
