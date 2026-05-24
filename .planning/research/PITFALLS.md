# Pitfalls Research — Landing v1

**Domain:** High-end animated SaaS landing page added to existing 43k-LOC Next.js 16 / React 19 / Tailwind v4 codebase (Virtuna), Linear+Raycast aesthetic, OpusClip conversion patterns, dual audience (TikTok creators + investors). Stack additions: Magic UI + Aceternity UI + motion/react + shadcn (locked); GSAP / R3F / tsParticles / Spline / Cult UI (palette).
**Researched:** 2026-05-24
**Confidence:** HIGH — pitfalls grounded in (a) live filesystem audit of `src/components/ui/`, `src/app/(marketing)/`, `src/hooks/`, (b) STACK.md + FEATURES.md + ARCHITECTURE.md cross-references, (c) BRAND-BIBLE Visual Metaphor Lock, (d) CLAUDE.md known issues, (e) v3.0 abandonment archive at `.planning/milestones/v3.0-brand-statement-landing/`.

> **Reading guide for downstream planner:** Every pitfall has a `Phase to address:` field. The bottom-of-file `Pitfall-to-Phase Mapping` is the canonical index — start there if you only need to know which phase owns prevention. Phase numbers reference the recommended phase ordering in ARCHITECTURE.md § 8 (Phase 1 Foundation → Phase 11 Cutover).

---

## Critical Pitfalls

### Pitfall 1: Animation library version-mismatch (`framer-motion` vs `motion`)

**What goes wrong:** Magic UI components import `motion/react` (motion.dev SDK ≥ 12). Some Aceternity components still import `framer-motion`. Both packages live in `package.json` (`framer-motion@^12.29.3` AND `motion@^12.29.2`). At build time you get two animation runtimes shipped to the client (~30 KB of duplicated code on the gzipped path), plus subtle behavioral drift — `motion`'s `useReducedMotion` defaults differ from `framer-motion`'s in edge cases (lazyMotion scope, server-side initial values), and `AnimatePresence` exit animations stop firing when two siblings mount from different packages.

**Why it happens:** Copy-paste from Aceternity docs is not always up to date; the docs page tells you "switch to motion" but the registry JSON still emits `import { motion } from "framer-motion"` for older components. Developers don't notice — both packages export `motion` as the namespace.

**How to avoid:**
1. After every shadcn-registry install (Aceternity or Cult UI), `grep -r "from ['\"]framer-motion['\"]" components/` and rewrite to `from "motion/react"` before committing. Magic UI is safe already.
2. Add `package.json` `pnpm.overrides`: `"framer-motion": "npm:motion@^12.29.2"` to force a single runtime even if a stray import slips through. This aliases the old package name to the new one — verified pattern from motion.dev migration guide.
3. Phase 1 install audit greps the entire `src/app/(marketing)/_components/` tree, fails the phase gate if any `framer-motion` import remains.

**Warning signs:** Two animations on the same page mount with subtly different easing; `AnimatePresence` exit animations fire on one section but not another; bundle analyzer (`@next/bundle-analyzer`) shows both `framer-motion/*` and `motion/*` chunks present.

**Phase to address:** Phase 1 (Foundation install audit) — grep + override. Re-verified at Phase 11 (Cutover) bundle-analyzer pass.

---

### Pitfall 2: Lightning CSS strips `backdrop-filter` and `mask-image` from Aceternity / Magic UI components

**What goes wrong:** Aceternity Spotlight uses an SVG `mask-image` to soft-clip the glow. Magic UI MagicCard, ShimmerButton, and any "glass" Aceternity component use `backdrop-filter: blur(Xpx)`. Lightning CSS (used in Next.js 16 production builds) silently strips both when applied via Tailwind utility classes. Result: glass effect missing in production but works in dev. Looks fine on `pnpm dev`, looks broken on Vercel.

**Why it happens:** CLAUDE.md flags this for `backdrop-filter` already (project uses `GlassPanel` inline-style workaround). Newly installed Magic UI / Aceternity components apply these properties via Tailwind utility classes (`backdrop-blur-md`, `mask-[radial-gradient(...)]`) — the same path Lightning CSS strips. The codebase already has the workaround pattern; new third-party components don't know about it.

**How to avoid:**
1. After installing any glass/backdrop component, audit the component source. Replace `className="backdrop-blur-md"` with `style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}`. Apply the same pattern for `mask-image`: `style={{ maskImage: '...', WebkitMaskImage: '...' }}`.
2. Phase 1 component-install acceptance test: Spotlight + MagicCard + ShimmerButton mount in `/v3`, deploy a preview to Vercel, screenshot-compare against dev. If glass missing → patch inline-style.
3. Add a CI script `scripts/audit-backdrop-classes.sh` that greps `backdrop-blur` and `mask-` in `src/app/(marketing)/_components/` and fails build if any utility-class usage remains (allow CSS variables / inline style only).

**Warning signs:** Component looks great on `localhost:3000`, looks like a flat dark rectangle on Vercel preview; difference is invisible until you side-by-side. Inspecting computed styles in preview shows `backdrop-filter: none` even though the class is on the element.

**Phase to address:** Phase 2 (Hero + Final CTA bookend) — Spotlight first-install verification. Phase 6 (Three Surfaces bento) — MagicCard verification. Continuous gate at every component install.

---

### Pitfall 3: oklch compilation inaccuracy for very dark colors in `@theme inline`

**What goes wrong:** Magic UI and Aceternity components ship custom keyframes via `@theme inline { --animate-foo: ...; }` in `globals.css`. When you customize their colors using oklch (e.g. `--color-background-elevated: oklch(0.08 0 0)` for the Spotlight shadow base), Tailwind v4 compiles the oklch value with float-precision loss for `L < 0.15`, yielding a different visible color than you intended. The Spotlight glow halos look slightly off, the BorderBeam trails look slightly tinted, and you can't tell why.

**Why it happens:** CLAUDE.md flags this for the existing token system; new keyframe additions inside `@theme inline` for landing-specific colors inherit the same compilation bug. New developers copy the project's oklch-token convention from `globals.css` and don't realize the workaround exists.

**How to avoid:**
1. Inside any new `@theme inline` block added for landing-specific animations, use exact hex values for any color with `L < 0.15`. Example: instead of `oklch(0.08 0 0)`, use `#0a0b0c`. This is the same rule already followed for `--color-background: #07080a`.
2. Phase 1 install audit: every new keyframe / color added to `globals.css` for Landing v1 components is checked against the L < 0.15 rule. Add a linter comment block at the top of the relevant `@theme inline` block reminding future contributors.
3. When customizing Magic UI / Aceternity color props (e.g. `<BorderBeam colorFrom="..." colorTo="..." />`), pass hex strings, not oklch references — Magic UI's CSS doesn't go through Tailwind's oklch path so hex works directly anyway.

**Warning signs:** Spotlight halo looks slightly green/blue tinted instead of neutral; BorderBeam trail color shifts subtly across page reloads; production build shows slightly different shadow color than dev. Visual diff tools (Chromatic, Percy) flag pixel-shift but not root cause.

**Phase to address:** Phase 1 (Foundation install audit). Phase 2 (Hero) at first Spotlight install. Documented in `BRAND-BIBLE.md` already; reinforce in landing-specific doc.

---

### Pitfall 4: Coral (#FF7F50) chroma clashing on motion gradients

**What goes wrong:** Spotlight + Lamp + BackgroundBeams + AuroraBackground all paint multi-stop gradient halos. The default Aceternity tints are blue/purple/pink. When you swap to coral (`#FF7F50` — high chroma, mid-orange hue), the gradient stops that previously sat in the cool color spectrum now clash with coral's warm hue — you get a muddy brown-pink "tequila sunrise" look that signals "stock template" not Linear/Raycast premium. Same problem on `MagicCard` cursor-tracking radial gradient — default radius is soft blue, recoloring to coral over a coral CTA underneath stacks coral-on-coral.

**Why it happens:** Aceternity / Magic UI components ship with hand-tuned gradient stops optimized for cool palettes. Coral has unusual luminosity properties (high L, high chroma) that interact differently with the typical 0.05-0.15 alpha multi-stop blend. Designers don't realize until the section renders.

**How to avoid:**
1. Single-color glow rule: any Aceternity Spotlight/Lamp/BackgroundBeams uses coral at a SINGLE alpha-stepped stop list (e.g. `coral-500/30 → coral-500/15 → transparent`), never a multi-hue blend. Override the registry-default gradients on copy-paste.
2. MagicCard cursor radial: pass `gradientColor="rgba(255,127,80,0.06)"` (very low alpha) — much lower than the default `0.18`. Coral is too saturated to take the default opacity.
3. Adjacent layers test: any section with a coral-tinted ambient backdrop forbids a coral CTA inside that 1500px-radius backdrop zone. Either ambient or CTA gets the coral, not both — Linear's pattern is ambient-neutral + CTA-accent, not both. Audit at Phase 2 (Hero) and Phase 8 (Social Proof) where both backdrops AND CTAs collide.

**Warning signs:** Section looks "agency-tier" instead of "Linear-tier" but you can't articulate why; coral feels muddy rather than punchy; ChromaTinter test (visually invert the section to grayscale) reveals luminance contrast that's too low between backdrop and CTA.

**Phase to address:** Phase 2 (Hero shared primitives) — locks the coral-on-backdrop rule once for entire milestone. Phase 8 (Social Proof) — second-most-likely violation spot (shared Spotlight + section CTA).

---

### Pitfall 5: `prefers-reduced-motion` ignored by Aceternity components (and inconsistently honored by Magic UI)

**What goes wrong:** WCAG 2.1 SC 2.3.3 (Animation from Interactions, AAA) and SC 2.2.2 (Pause/Stop/Hide, A) both require honoring `prefers-reduced-motion`. Aceternity StickyScroll, MultiStepLoader, AnimatedTestimonials, TracingBeam, BackgroundBeams, and FlipWords all ship WITHOUT checking the media query. Magic UI is better (most components honor it via `motion/react`'s built-in respect) but AnimatedBeam, OrbitingCircles, and Particles have edge cases where motion still fires. Net effect: a user with `Reduce Motion` enabled hits the landing page and gets full motion-bombardment — vestibular nausea risk, plus WCAG audit failure.

**Why it happens:** The Aceternity registry components are copy-paste-first; documentation focuses on "look pretty" not "ship to production." Many components use raw `useMotionValue` / `useSpring` without `useReducedMotion()` gating. Developers assume the libraries handle it; they don't.

**How to avoid:**
1. After every Aceternity/Magic UI install, scan the component source for `useReducedMotion`, `prefers-reduced-motion`, or `useReducedMotion(MotionConfig)`. If absent, patch the component to early-return a static keyframe when reduced motion is on. The existing `src/hooks/usePrefersReducedMotion.ts` is the codebase standard — re-use it.
2. Per-section reduced-motion fallback specifically defined:
   - **Hero Canvas particles:** static converged keyframe with score visible (BRAND-BIBLE VIZ-04 already specifies this pattern).
   - **Demo MultiStepLoader:** skip the 3-4s loader sequence; transition directly from `picked` → `result` (per ARCHITECTURE.md § 3 demo reducer reduced-motion branch).
   - **AnimatedBeam pipeline:** show static SVG with all 4 stage nodes filled coral, no pulse, no traveling stroke (matches BRAND-BIBLE VIZ-02 reduced-motion fallback).
   - **AnimatedTestimonials:** disable 3D rotation; static 3-card grid with all visible.
   - **StickyScroll:** disable scroll-pinning; render content in linear flow.
   - **Marquee logo / citation wall:** pause scroll, render as static row with all logos visible.
   - **NumberTicker:** show end-state number immediately, no count-up.
   - **OrbitingCircles:** static positioning at 12-3-6-9 clock positions, no orbit.
   - **Spotlight / Lamp / BorderBeam:** keep — they're decorative ambient, no animation that triggers vestibular response.
3. Add `MotionConfig reducedMotion="user"` at the root of `src/app/(marketing)/v3/page.tsx` (then root after cutover) — this acts as a motion/react-wide kill switch and disables motion respectfully across all `motion/react` components automatically.
4. Phase 10 (Mobile + reduced-motion polish) runs a manual audit: enable `Reduce motion` in macOS System Settings → Accessibility, reload `/v3`, scroll through every section, confirm no animation fires that shouldn't.

**Warning signs:** Lighthouse Accessibility audit drops below 100 with a warning about animation. Manual test in Safari with `Reduce motion` shows visible animations still playing. axe-core CI scan flags `motion-reduce` violations.

**Phase to address:** Phase 1 (Foundation) sets up `MotionConfig` root wrapper. Phase 2 (Hero) Canvas honors VIZ-04 pattern. **Every section build phase (2, 4, 5, 6, 7, 8, 9)** has a reduced-motion sub-task. Phase 10 (polish) does the final manual audit. **This is a continuous concern; budget 30 min of audit per section.**

---

### Pitfall 6: Spline `@splinetool/runtime` bundle weight (544 KB gzip) silently regresses Lighthouse

**What goes wrong:** Spline scenes load through `@splinetool/runtime` — a 544 KB gzipped runtime. If anyone (during build or panicked execution) decides "let's drop a 3D scene in the hero," and uses the default install pattern without `dynamic({ ssr: false })` + IntersectionObserver gating, Lighthouse Performance drops from 90+ to 50-60 (validated case study in STACK.md). Worse: even with `ssr: false`, eager mount on first paint still pulls the 544 KB JS during the LCP window, hurting LCP score by 1-2 seconds on mid-tier mobile.

**Why it happens:** Spline is the "shiny" option for hero 3D and the temptation to pull it in is real (BRAND-BIBLE explicitly keeps it as a backup). The project already has `@splinetool/react-spline@4.1.0` installed but NOT the runtime peer — first time anyone runs the component, build fails with a peer-dep error, gets installed with `pnpm add @splinetool/runtime`, no one notices the bundle impact until production.

**How to avoid:**
1. **Default = Canvas particle viz, NOT Spline.** BRAND-BIBLE VIZ-01 already locks this. Don't re-litigate during build unless Canvas viz fails QA.
2. If Spline IS pulled in: enforce the 6-rule contract from STACK.md § 6:
   - `dynamic(() => import('@splinetool/react-spline/next'), { ssr: false })`
   - IntersectionObserver mount gate (don't mount until hero is 50%+ visible)
   - Scene file under 500 KB (verify before commit)
   - Maximum 1 Spline scene per landing
   - Reduced-motion fallback to static gradient
   - Lighthouse Performance ≥ 90 verified in Vercel preview before merging
3. Phase 1 install audit: if `@splinetool/runtime` appears in `package.json` after the Phase 1 install batch, flag for justification.
4. Add bundle-budget CI check: `next build` post-step runs `du -sh .next/static/chunks/` against a baseline (~250 KB pre-spline) and fails if the chunks grew >100 KB without an explicit `BUNDLE_BUDGET_OVERRIDE` env var.

**Warning signs:** Vercel preview Lighthouse Performance drops 30+ points after a phase merge. Bundle analyzer shows a chunk > 400 KB from `@splinetool/runtime`. LCP element measurement on mobile exceeds 3 seconds.

**Phase to address:** Phase 3 (BehavioralSimulationHero Canvas) — verify Canvas viz proves out at 60fps; this is the decision gate for "Spline yes/no." Phase 11 (Cutover) — bundle-analyzer pass.

---

### Pitfall 7: WebGL / R3F context-loss on mobile (3D hero on iPhone Safari kills the page)

**What goes wrong:** If R3F (`@react-three/fiber@9.5`) is pulled in for any hero or background 3D, iOS Safari aggressively reclaims WebGL contexts when memory pressure rises (multi-tab user, screen-locked-then-resumed, app-switch). The R3F canvas comes back as a black rectangle — no error, no fallback, just visibly broken. iPad and Android Chrome are better but not perfect.

**Why it happens:** Mobile Safari has a hard limit of ~8 active WebGL contexts per process; tab churn evicts old ones silently. R3F doesn't listen to `webglcontextlost` by default — you need to add a `<Canvas onContextLost>` handler explicitly. Default install doesn't include this.

**How to avoid:**
1. **Default = no R3F on the landing.** BRAND-BIBLE locks Canvas 2D for the hero viz. R3F is reserved for in-app prediction viz (a future milestone). Use this rule to forbid R3F adoption during Landing v1.
2. If R3F IS used for any section: subscribe to `webglcontextlost` on the canvas and render a static SVG/Canvas-2D fallback. Pattern from R3F docs:
   ```tsx
   <Canvas onCreated={({ gl }) => {
     gl.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); setLost(true); });
   }} />
   ```
3. Mobile-Safari smoke test in Phase 10: open `/v3` on iPhone in Safari, lock screen, unlock, switch tabs, return — confirm WebGL elements still render OR static fallback shows.

**Warning signs:** User reports "black box where the animation should be" on iPhone after backgrounding the app. BrowserStack iOS Safari recording shows blank canvas after a tab switch. Sentry logs show `WebGLContextLostError` (you've added a listener — good — but you haven't built the fallback).

**Phase to address:** Phase 3 (Hero Canvas) — explicit "no R3F on landing" gate. Phase 10 (Mobile polish) — Safari context-loss test. Continuous: forbid R3F adoption in any subsequent landing phase without explicit OK.

---

### Pitfall 8: tsParticles SSR hydration mismatch (touching `window` at module load)

**What goes wrong:** tsParticles' `loadSlim` / `loadFull` engine initializers touch `window` at module level. Without `dynamic({ ssr: false })`, you get a hydration error on first paint — React reconciles a server-rendered "nothing" against a client-rendered particle canvas, throws warnings, and in strict mode replays the entire tree. Layout flickers, console fills with errors.

**Why it happens:** tsParticles documentation shows simple `import Particles from "@tsparticles/react"` examples that work in Vite / CRA but break in Next.js App Router. The hydration boundary is invisible until you actually run on Vercel.

**How to avoid:**
1. ALWAYS wrap with `dynamic(() => import('./HeroParticles'), { ssr: false })` — pattern from STACK.md § 4.
2. Inside the component, gate render on `useState(false)` set by `initParticlesEngine().then(() => setInit(true))` — also from STACK.md.
3. Phase 1 install audit: if tsParticles is added (palette item), verify the dynamic-import + initEngine-gate pattern is in place. If Magic UI `Particles` covers the use case, prefer it (it's ~3 KB Canvas 2D, no SSR concern).

**Warning signs:** Console warnings about hydration mismatch on hero load. Particles flash in/out on first paint. Layout shift detected by Lighthouse.

**Phase to address:** Phase 1 (Foundation) — palette-item integration pattern doc. Phase 2 (Hero) IF tsParticles is chosen for hero ambient (recommend Magic UI Particles instead).

---

### Pitfall 9: Component name collision — existing `src/components/ui/marquee.tsx` and `src/hooks/useCountUp.ts`

**What goes wrong:** ARCHITECTURE.md flags it: `src/components/ui/marquee.tsx` (1.6K) and `src/hooks/useCountUp.ts` (2.4K) already exist. If Phase 1 runs `npx shadcn@latest add @magicui/marquee` without an inspection step, the shadcn CLI either overwrites `marquee.tsx` (data loss) or creates `marquee-1.tsx` (orphaned duplicate). Same for `@magicui/number-ticker` colliding behaviorally with `useCountUp`.

**Why it happens:** shadcn CLI's collision-prompt UX is easy to dismiss in haste. Default-confirm overwrites or creates incremented filenames. Developers don't read the destination path output.

**How to avoid:**
1. Phase 1 install runs each shadcn-add command WITH `--overwrite` flag explicitly disabled. CLI will then halt on collision and report. Inspect each collision; decide replace vs. patch vs. coexist.
2. Pre-install inventory: Phase 1 reads `src/components/ui/marquee.tsx` and `src/hooks/useCountUp.ts` source code BEFORE installing Magic UI. Decision matrix:
   - If existing `marquee.tsx` is already-Magic-UI-source (someone installed before, forgot) → skip install, reuse.
   - If existing `marquee.tsx` is custom legacy → replace via `npx shadcn@latest add @magicui/marquee --overwrite`, then audit downstream consumers (`grep -r "from.*components/ui/marquee" src/`) and patch their import paths if API changed.
   - If existing `useCountUp.ts` is in active use elsewhere → keep both, but use Magic UI `NumberTicker` in Landing v1 (spring physics for visual parity with rest of Magic UI palette). Mark `useCountUp` for cleanup post-cutover.
3. Phase 1 install acceptance test: after every install, `git diff` is reviewed, and `grep -r "import" src/components/landing` confirms no legacy files import the now-replaced primitive.

**Warning signs:** Build fails with "duplicate export" errors. Tests for `useCountUp` consumers regress. `marquee-1.tsx` file appears unexpectedly.

**Phase to address:** Phase 1 (Foundation install audit) — explicit collision-check sub-step for every install.

---

### Pitfall 10: v3.0-style brand-spine over-commitment (the actual reason v3.0 was abandoned)

**What goes wrong:** v3.0 Brand Statement Landing dedicated Phase 1 (4 plans across 2 waves) entirely to brand-spine, voice doc, vocab guardrails, visual metaphor lock, plagiarism audit, AND vocab-lint pre-commit hook — BEFORE any pixel was built. By the time the team finished Phase 1 and got 2 plans into Phase 2 (Foundation + Hero), the momentum was dead and the milestone was abandoned. The brand-spine "Your audience, simulated." has now been formally retired (per PROJECT.md). The vocab guardrails (forbidding "viral" and "AI") fundamentally conflicted with the OpusClip conversion pattern adopted for Landing v1 (which uses "viral" and "AI" extensively per FEATURES.md OpusClip Vocab Choices subsection).

**Why it happens:** Reasonable instinct: "brand foundation before pixels = professional rigor." Reality: each pre-build artifact (BRAND-SPINE.md, BRAND-BIBLE addendum, vocab-lint hook, plagiarism audit) added 4-8 hours of context-loading drag before any visible progress. Two artifacts (the vocab guardrails AND the locked brand-spine line) became contradictory with the OpusClip-pattern goal as the team progressed. Six phases is too long for a landing milestone — momentum decays exponentially after ~3 weeks.

**How to avoid:**
1. **Copy is iterable during build, not pre-locked.** PROJECT.md explicitly says "Brand spine is fully open — no v3.0-style lock phase." Treat copy decisions as in-section concerns within each section's phase. H1 can change at Phase 2 AND Phase 11.
2. **No vocab-lint hook.** Forbidding "viral" / "AI" via lint was the v3.0 mechanism; it directly conflicts with OpusClip patterns. Vocab decisions are per-section judgment, not enforced.
3. **No upfront plagiarism audit.** Original copy is the goal; if any phrase echoes a reference site, fix at content-write time, not via a separate audit phase.
4. **Roadmap MUST cap at ≤ 11 phases** with most phases 2-5 plans (matches ARCHITECTURE.md § 8 phase breakdown). Phase 1 is install/scaffold, NOT brand foundation. The first PR with visible page output should land within Phase 2.
5. **Phase 0/1 ALWAYS visible-progress-first.** Even Phase 1 (Foundation) ships a `/v3` route with placeholder sections rendering — proves the loop closes from `pnpm dev` to "I can see something." Brand artifacts (if any) attach to specific sections, not standalone phases.

**Warning signs:** Phase 1 plan has 4+ document-writing tasks and zero `.tsx` files. Phase 2 hasn't shipped a render-able page after 2 weeks. PROJECT.md "current focus" hasn't moved in 7 days. Team starts asking "should we restart with a fresh approach?"

**Phase to address:** Roadmap-design time (before Phase 1 starts) — enforce the ≤ 11 phase cap and the Phase 1 = scaffold rule. Architectural concern, not in-phase concern.

---

### Pitfall 11: Route collision at `/` — overwriting the live landing page mid-build

**What goes wrong:** ARCHITECTURE.md § 1 verified: there is no `src/app/page.tsx`. Root `/` is served by `src/app/(marketing)/page.tsx` — the current live landing. If anyone (rushed executor, automation) overwrites `src/app/(marketing)/page.tsx` early in the milestone (Phase 1 or Phase 2) with a partial v3 build, the production site at virtuna.ai serves a broken in-progress landing for as long as the next deploy takes. Vercel auto-deploys on merge to `main` — risk is real.

**Why it happens:** Convention in many projects is "edit the page in place." Without explicit guidance, a phase plan might say "build the hero" and the executor naturally edits `(marketing)/page.tsx`. The worktree is on `milestone/landing` branch, which isolates production-impact UNTIL the merge.

**How to avoid:**
1. **Stage at `src/app/(marketing)/v3/page.tsx` throughout the milestone.** ARCHITECTURE.md § 1 already locks this. Every phase plan explicitly forbids editing `(marketing)/page.tsx` except in the Cutover phase (Phase 11).
2. The Cutover phase is its own phase with explicit success criteria — only then does `v3/page.tsx` content move to `(marketing)/page.tsx`.
3. CI guard: a check on the `milestone/landing` branch fails any PR that touches `src/app/(marketing)/page.tsx` UNLESS the PR description contains `CUTOVER-APPROVED`. Phase 11 plan explicitly adds this magic string.
4. Pre-cutover verification: deploy `/v3` to Vercel preview (Vercel previews work per-branch automatically). Investor / Davide reviews the preview URL; only then does the cutover phase merge.

**Warning signs:** A PR diff shows changes to `src/app/(marketing)/page.tsx` before Phase 11. Vercel preview URL points to `/` not `/v3`. Davide reports "the live site looks wrong" mid-milestone.

**Phase to address:** Phase 1 (Foundation) — establishes the `/v3` staging convention. Phase 11 (Cutover) — performs the swap with explicit pre-merge review.

---

### Pitfall 12: Duplicate `<html>` / `<body>` bug in `src/app/(marketing)/layout.tsx`

**What goes wrong:** ARCHITECTURE.md § 1 flags this: `src/app/(marketing)/layout.tsx` currently declares its own `<html>` and `<body>` tags AND re-imports `../globals.css`. This is a Next.js App Router error — only `src/app/layout.tsx` (the root) should have `<html>` and `<body>`. The duplicate causes (a) double-mounted React tree on marketing routes, (b) doubled CSS application (some globals applied twice), (c) breaks Next.js' streaming SSR boundaries. Landing page on top of this bug performs worse than it should.

**Why it happens:** Probably a copy-paste during the earlier landing-page-redesign attempt that was never cleaned up. Browser doesn't complain (both elements exist); Next.js warns in dev but the warning gets lost.

**How to avoid:**
1. Phase 1 (Foundation) explicitly fixes `(marketing)/layout.tsx` — strip `<html>` + `<body>` declarations and the redundant `globals.css` import. The file should be either a passthrough fragment OR (better) wrap with `<Header />` and that's it.
2. After fixing, verify with `pnpm dev` console — no React hydration warnings, no double-CSS issues, marketing pages still render correctly.
3. Also fixes the stale `title: "Artificial Societies | Human Behavior, Simulated"` metadata at the same time.

**Warning signs:** React warns "<html> cannot appear as a child of <html>" or similar in dev console. Lighthouse Best Practices flags invalid HTML. Marketing page LCP measurably worse than `/dashboard` page LCP for similar payload.

**Phase to address:** Phase 1 (Foundation) — first task in the phase.

---

### Pitfall 13: Above-fold hero centerpiece blocks LCP

**What goes wrong:** Hero LCP element is usually the H1 (text), but if the BehavioralSimulationHero Canvas mounts above or alongside the H1 in DOM order, Next.js' Image / LCP detection picks the Canvas as the "Largest Contentful Paint" element. Canvas paints empty on first frame (RAF hasn't fired) — LCP timestamp gets pushed out by 200-800ms. Worse: if the Canvas DOM node is sized with explicit `width: 100%; height: 100vh` (common for hero centerpieces) and starts blank, that's a 0-content paint that LCP detection counts.

**Why it happens:** Hero centerpieces are big visually and naturally selected by browsers' LCP heuristic. Canvas 2D fills in on RAF, not on paint. Mismatch.

**How to avoid:**
1. Hero H1 element should be the LCP candidate. Place it BEFORE the Canvas in DOM order, with explicit dimensions and no CSS that delays paint. Use `font-display: swap` for Inter so text paints immediately.
2. BehavioralSimulationHero renders a "static keyframe" placeholder on its FIRST frame (before RAF fires) — this gives LCP detection a non-empty Canvas to measure. BRAND-BIBLE VIZ-04 already calls out the "reduced-motion fallback = static keyframe" pattern; apply the SAME pattern to the initial paint frame even in non-reduced-motion mode.
3. Phase 3 (Hero Canvas) explicitly measures LCP via Lighthouse mobile after first build. Target: H1 detected as LCP element, time < 2.0s on Vercel preview.
4. Use `next/image` `priority` flag on any logo/image in the hero. Spline / Canvas centerpiece should NOT use `loading="lazy"` (above fold) but ALSO shouldn't be the LCP element.

**Warning signs:** Lighthouse mobile LCP > 2.5s. Lighthouse identifies "Canvas#hero-viz" or unnamed element as LCP. Real-User Monitoring (Sentry / Vercel Speed Insights) shows p75 LCP regression after hero ships.

**Phase to address:** Phase 3 (BehavioralSimulationHero Canvas) — LCP gate. Phase 10 (Polish) — full LCP/CLS/INP audit.

---

### Pitfall 14: Layout shift (CLS) from late-mounting animations

**What goes wrong:** Magic UI `BorderBeam`, `AnimatedBeam`, `OrbitingCircles`, and Aceternity `MovingBorder` all mount client-side and inject absolutely-positioned SVG/DOM elements after hydration. If the parent container doesn't have explicit dimensions reserved, the late-mount triggers a reflow that bumps CLS score. Same problem with `react-intersection-observer`-gated section animations — section appears on scroll, content shifts as it mounts.

**Why it happens:** Hydration delay between SSR-rendered parent and client-rendered animation child. Animation children depend on `getBoundingClientRect` for positioning — they can't render until mount; mount triggers layout calculation; calculation can shift other content.

**How to avoid:**
1. Every section wrapper has an explicit `min-height` reservation (e.g. Hero `min-h-screen`, Demo `min-h-[800px]`, Pipeline `min-h-[500px]`). This ensures the box reserves space even if children mount late.
2. Animations that inject DOM (BorderBeam, AnimatedBeam) wrap inside an `aria-hidden` decorative container with `pointer-events: none; position: absolute; inset: 0;` — they overlay parent space rather than allocate new space.
3. NumberTicker: pre-renders the END-state number SSR (e.g. server renders `87`), then on client-mount restarts from `0` and animates to `87`. This way the box has correct width SSR + no shift on mount. Magic UI's NumberTicker has a `value` prop — wrap with `{!mounted ? value : <Ticker value={value} />}` pattern to avoid SSR/client mismatch and CLS.
4. Phase 10 explicitly measures CLS in Lighthouse. Target CLS < 0.1 per Web Vitals.

**Warning signs:** Lighthouse CLS score > 0.1. Visual review shows content "jumping" after first paint. RUM (Vercel Speed Insights) shows p75 CLS regression.

**Phase to address:** Phase 10 (Polish) primary; **each section build phase** has CLS sub-task at end of phase.

---

### Pitfall 15: INP regressions from cursor-tracked MagicCard / heavy hover handlers

**What goes wrong:** Magic UI `MagicCard` uses `useMotionValue` + `mousemove` listener to track cursor position for the spotlight gradient. On a section with 3 MagicCards (Three Surfaces bento) + a Demo section with sample cards using MagicCard, that's 7+ continuous mousemove handlers. INP (Interaction to Next Paint) regresses on low-end Android, particularly Pixel-class devices. Each handler does a `setMotionValue` → re-renders the gradient style → reflows the SVG mask. Cumulative cost: ~30-50ms per mousemove event on mid-tier mobile.

**Why it happens:** Cursor-tracked components are expensive by design. They're meant to be 1-2 per page, not 5-10. The Bento pattern multiplies them.

**How to avoid:**
1. Use MagicCard ONLY on the Demo section sample-picker cards (4 cards, only one mounted at a time when picked). Bento Three Surfaces uses static cards WITHOUT MagicCard cursor tracking; instead use a CSS-only `:hover` gradient (no JS listener).
2. Throttle the mousemove handler if MagicCard is reused — patch the component source to use `requestAnimationFrame` batching. Magic UI's default is `requestAnimationFrame`-based already; verify on copy-paste.
3. Disable cursor-tracking entirely on mobile (`pointer: coarse` media query). Mobile has no cursor — the listener is dead weight + a touchmove handler firing on scroll-touch.
4. Phase 10 measures INP via Lighthouse + manual Pixel-class Android test.

**Warning signs:** Lighthouse INP > 200ms on mobile. RUM p75 INP > 300ms. User reports "the page feels janky" when moving cursor over cards.

**Phase to address:** Phase 6 (Three Surfaces bento) — explicitly forbids MagicCard cursor-tracking on Bento. Phase 4 (Demo) — MagicCard on sample cards OK. Phase 10 — INP audit.

---

### Pitfall 16: Font loading FOUC / FOIT for Inter

**What goes wrong:** Inter is loaded via `next/font/google` (already configured in `src/app/layout.tsx`). Default behavior is `font-display: optional` (Next.js default) — text either renders immediately in Inter OR renders in the fallback for the entire session (no swap). On slow connections, Inter doesn't arrive in time, and the entire landing renders in `ui-sans-serif` (system) — looks generic, kills the Raycast premium feel. Alternately, if `font-display: block` is configured, text is invisible until Inter loads (FOIT) — hurts LCP measurably.

**Why it happens:** Next.js' `next/font` is generally good but defaults are conservative. Inter's WOFF2 is ~50 KB per weight — at 4 weights (regular, medium, semibold, bold) that's ~200 KB even tree-shaken. On 3G connection, all 4 weights take 1-2 seconds.

**How to avoid:**
1. Configure `next/font` with `display: 'swap'` (renders fallback first, swaps to Inter on arrival) — best for landing page LCP. Trade-off: brief FOUC moment, but premium feel returns within ~500ms.
2. Subset Inter to Latin only (`subsets: ['latin']`) — already standard; verify in `src/app/layout.tsx`.
3. Only load weights actually used: 400 (regular), 500 (medium), 600 (semibold), 700 (bold). Skip 100/200/300/800/900 if not used. Verify against component audit.
4. Add `<link rel="preconnect" href="https://fonts.gstatic.com">` — Next.js does this automatically for `next/font/google`, but verify.
5. Phase 10 audits FOUC visually on slow network throttling (Chrome DevTools 3G).

**Warning signs:** Lighthouse "Ensure text remains visible during webfont load" warning. Manual 3G test shows generic font for >1s. Hero H1 measured wider in Inter than fallback → noticeable jump when font swaps.

**Phase to address:** Phase 1 (Foundation) verifies `next/font` config. Phase 10 (Polish) tests slow-network behavior.

---

### Pitfall 17: Investor-impression failure modes — looking like agency-template slop

**What goes wrong:** "High-end animated landing" is one click away from "Awwwards-template slop." Specific tropes that LOOK premium-aspirational but READ as cheap:
- Multi-hue gradient hero (purple→pink→cyan) — signals "Webflow template," not Linear
- Floating SVG icon orbit around H1 — signals "agency package," not product
- Counter strips with 4+ stats and no source ("10M+ users") — signals "fake metric"
- Stock-photo testimonial avatars or generic names ("Sarah M., Marketing Manager") — signals "made-up testimonial"
- "Trusted by" logo row with no recognizable companies — signals "early-stage, hiding it"
- AI-coded H1: "AI-powered" / "AI that..." / "Supercharge your..." / "10x your..." / "Reimagine..." — signals "wrote with ChatGPT"
- Aurora / Vortex / WavyBackground / animated mesh gradients — signals "Aceternity demo page, didn't customize"
- Sticker-stack hero (3 product screenshots floating at angles with shadows) — signals "Stripe-clone attempt without Stripe's design eye"
- Auto-playing 4K product video on hero — signals "tried too hard"
- Confetti / pop / bounce on CTA hover — signals "consumer app, not B2B"

**Why it happens:** Each individually defensible. Cumulative effect = template-coded. Aceternity / Magic UI default demos use many of these tropes intentionally (they're component showcases, not landing pages).

**How to avoid:**
1. **Hard-list of forbidden tropes** added to a project doc (NOT a new MD; append to `BRAND-BIBLE.md` Visual Metaphor Lock as a "Forbidden Patterns" sub-section).
2. **Trust signal verifiability rule:** every testimonial includes a real handle + follower count (OpusClip pattern per FEATURES.md). Every metric includes a source or "early signal" framing per v3.0 PROOF-04. Every logo is a real partner.
3. **Reference-anchor rule:** during build, every section is screenshot-compared to its Linear / Raycast counterpart (see FEATURES.md "Reference landings" table). If the section looks closer to "Aceternity demo page" than to "Linear product page," patch.
4. Phase 11 (Cutover) has a "reference-fidelity audit" gate similar to v3.0 Phase 6 but lightweight — check each section against the closest Linear/Raycast/OpusClip equivalent, flag tropes.
5. Use Aceternity components from the LINEAR-LEANING subset (Spotlight, Lamp, MovingBorder, TracingBeam, BackgroundBeams, StickyScroll) — NOT the maximalist subset (Aurora, Vortex, WavyBackground, BackgroundGradientAnimation). STACK.md § 2 already calls this out.

**Warning signs:** Davide's first review of a section starts with "...but does this look like a template?" Investor friend says "feels generic." Side-by-side with Linear's hero shows hue/density/restraint mismatch.

**Phase to address:** Phase 11 (Cutover reference-fidelity audit) primary. Each section build phase has a "reference-anchor screenshot" sub-task — done by the section's executor, reviewed before phase ships.

---

## Moderate Pitfalls

### Pitfall 18: Sentry SDK bundle weight on landing routes

**What goes wrong:** `@sentry/nextjs` adds ~80 KB gzipped to client bundles. Currently scoped to all routes including the landing. Landing visitors who never authenticate don't need full Sentry — but they pay the bundle cost. Lighthouse Performance dings the landing for it.

**How to avoid:** Configure Sentry's `tunnel` + `replaysOnErrorSampleRate=0` for the marketing route group. Lazy-load `@sentry/nextjs` only after first interaction (mouse move + 2s) using `next/dynamic`. OR: scope Sentry to authenticated routes only via the `instrumentation.ts` filter. Sentry docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/sampling/.

**Phase to address:** Phase 10 (Performance polish) — Sentry scope review.

---

### Pitfall 19: Pricing buried below excessive scroll

**What goes wrong:** v3.0 had 7 viewports. Landing v1 has 8 sections. If Pricing is viewport 7, and each section is ~100vh, Pricing requires ~6 scroll-down actions to reach. Mobile users abandon at 3-4 swipes. OpusClip's solution per FEATURES.md is "pricing on-page, not /pricing route" — but on-page only helps if users actually scroll to it.

**How to avoid:** Header anchor "Pricing" link (sticky-or-not) jumps directly to `#pricing`. Hero secondary CTA includes "See pricing" as a third option OR the hero subhead includes a price anchor ("Starting at $X / mo" → click → jump). Mobile: condense sections 3-5 (How it works + Three Surfaces + Science) to a single combined section if scroll-depth analytics show abandonment.

**Phase to address:** Phase 2 (Hero) — anchor pattern in header. Phase 9 (Pricing) — re-verify scroll-depth from hero CTA click.

---

### Pitfall 20: Scrolljacking on touch / mobile

**What goes wrong:** Aceternity `StickyScroll`, `ContainerScroll`, `HeroParallax` all use scroll-progress-based animation. On touch devices, native momentum scrolling fights the JS-driven scroll progress — page feels "sticky" or "fights back." Universally hated UX pattern; tanks mobile conversion.

**How to avoid:** Use scroll-pinned components ONLY on desktop (`lg:` breakpoint or wider). Mobile renders the same content in linear flow without pinning. ARCHITECTURE.md § 9 already specifies this per-section (StickyScroll disabled `<md`). Verify each scroll-pinned component has a `useMediaQuery` or CSS `@media (pointer: coarse)` guard that disables pinning on touch.

**Phase to address:** Phase 7 (Science section StickyScroll) — touch fallback. Phase 10 (Mobile polish) — full audit.

---

### Pitfall 21: Hover-dependent reveals on mobile

**What goes wrong:** MagicCard cursor spotlight, BorderBeam-on-hover, OrbitingCircles-on-hover all require pointer hover. Mobile has no hover. Content/effect is invisible to mobile users entirely — they don't know it's there. UX impact: feature appears broken or missing.

**How to avoid:** Any hover-revealed content is mirrored in mobile as either (a) always-visible (no hover gate) or (b) tap-to-reveal with a visual hint. Specifically: pricing tooltips on `Info` icons — desktop hover, mobile tap. Three Surfaces card hover spotlight — desktop only, mobile shows static gradient. AnimatedTestimonials hover-to-zoom — disable on mobile, static stack.

**Phase to address:** Each section's mobile sub-task. Phase 10 sweep.

---

### Pitfall 22: iOS Safari `100vh` viewport trap

**What goes wrong:** Hero is `min-h-screen` (= `min-height: 100vh`). On iOS Safari, the address bar overlap means `100vh` is the viewport WITHOUT the address bar — so on first paint with address bar showing, the hero is `100vh + addressBar = clipped`. Users see content extending past the fold needlessly. Worse: on scroll, address bar collapses, and `100vh` becomes the new height — hero re-flows, content jumps.

**How to avoid:** Use `100dvh` (dynamic viewport height) for hero `min-height`. Modern Safari supports it. Fallback for older browsers: `min-h-screen min-h-[100dvh]` (Tailwind v4 supports the modifier). Tailwind v4 + browser support audit confirms `100dvh` is shipped in Safari 15.4+ (97%+ users).

**Phase to address:** Phase 2 (Hero) — hero min-height.

---

### Pitfall 23: Auto-playing video / motion competing with CTA

**What goes wrong:** Hero centerpiece animation (Canvas particle aggregation) is visually loud — by design (it's the differentiator). But if it runs concurrent with the H1 read time, the user's eye is split between text and motion. CTA button below the text gets less visual attention. Conversion penalty in eye-tracking studies on motion-heavy heroes vs. static is 8-15%.

**How to avoid:**
1. Canvas animation fires ONCE on viewport entry, holds the static end-state thereafter (BRAND-BIBLE VIZ-04 one-shot pattern — already locked).
2. Animation duration is ≤ 2.0 seconds. Eye returns to text + CTA within attention window.
3. CTAs have their own subtle attention pull post-animation: `ShimmerButton` has periodic shine effect (Magic UI default) — fires every 5s, drawing eye back after the hero finishes its one-shot.

**Phase to address:** Phase 3 (BehavioralSimulationHero) — animation duration cap. Phase 2 (Hero shell) — ShimmerButton shine cadence verification.

---

### Pitfall 24: Demo loads slowly → momentum break before conversion

**What goes wrong:** Demo section is the differentiator. If a user clicks "See it work" from hero, anchors to `#demo`, and the section is still hydrating (Aceternity MultiStepLoader, CardStack, BackgroundBeams all mounting), there's a 200-800ms delay where the demo looks blank. Momentum breaks; user might scroll past instead of clicking a sample.

**How to avoid:**
1. Demo section eagerly hydrates on hero CTA hover (`onMouseEnter` triggers `import()` of the demo module). Pattern: pre-fetch dynamic chunks on hover-intent, mount on click. Next.js `Link` does this automatically for route prefetch — apply same pattern for in-page dynamic imports.
2. The "static layout" of the demo (sample picker cards) renders SSR — only the loader + result animations are client-only. User sees the picker immediately on scroll-to.
3. Phase 4 (Demo) explicit gate: from hero CTA click to first sample-pickable state ≤ 200ms on Vercel preview.

**Phase to address:** Phase 4 (Demo) — pre-fetch pattern + SSR-render picker layout.

---

### Pitfall 25: shadcn registry namespace collisions

**What goes wrong:** STACK.md § 7 flags this. Magic UI uses `@magicui/` namespace, Cult UI uses `@cult-ui/`, Aceternity uses direct URLs. If Cult UI is added via the namespace pattern, `components.json` needs the registry registered first. Missing registration → install fails silently or installs to wrong location.

**How to avoid:** Cult UI is currently NOT planned for Landing v1 per STACK.md § 5 ("Skip for Landing v1"). If pulled in later, follow the STACK.md install path. Otherwise: ignore this pitfall.

**Phase to address:** N/A unless Cult UI is added (defer).

---

### Pitfall 26: Footer redundancy / `/pricing` standalone page conflict

**What goes wrong:** `src/app/(marketing)/pricing/page.tsx` currently exists as a standalone pricing page. Landing v1 inlines pricing into root. Conflict: footer link or some external referrer points to `/pricing`. After cutover, `/pricing` either (a) shows the old standalone page (visual inconsistency with new landing) or (b) redirects to `/#pricing` (good UX) or (c) 404s (bad).

**How to avoid:** Phase 11 (Cutover) explicit decision: delete `/pricing` page AND add a redirect via `next.config.ts` `redirects()`: `{ source: '/pricing', destination: '/#pricing', permanent: false }`. OR keep `/pricing` updated as a fallback. Recommend redirect — fewer divergent UIs.

**Phase to address:** Phase 11 (Cutover).

---

### Pitfall 27: Header navigation drift between landing and app

**What goes wrong:** Existing `src/components/layout/Header` is the dashboard header — links go to `/dashboard`, `/competitors`, `/brand-deals`, etc. Landing page needs different links: "Features," "Pricing," "Science" (page anchors), "Log in" (right side). If Landing v1 reuses dashboard Header, links are wrong.

**How to avoid:** Either (a) Landing v1 builds its own `LandingHeader.tsx` in `_components/` with anchor links + Log in, OR (b) existing Header takes a `variant="marketing"` prop. Recommend (a) — keeps marketing and app concerns separate.

**Phase to address:** Phase 1 (Foundation) — header decision before any section work.

---

## Minor Pitfalls

### Pitfall 28: Viewport-zoom blocking (a11y violation)

**What goes wrong:** Some templates set `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">` to prevent zoom. WCAG 2.1 SC 1.4.4 requires zoom to 200% without loss of functionality. Maximum-scale=1 / user-scalable=no violates.

**How to avoid:** Verify root `viewport` meta is `<meta name="viewport" content="width=device-width, initial-scale=1">` only — no `maximum-scale`, no `user-scalable=no`. Audit `src/app/layout.tsx` viewport export.

**Phase to address:** Phase 1 (Foundation).

---

### Pitfall 29: ARIA missing on Bento grid

**What goes wrong:** Magic UI BentoGrid + BentoCard render `<div>` containers. Without `role="region"` + `aria-labelledby` on each cell, screen readers announce the bento as one big undifferentiated div blob.

**How to avoid:** Each BentoCard gets `role="article" aria-labelledby="surface-prediction-heading"` and the heading has matching `id`. Magic UI doesn't add these by default — patch on copy-paste.

**Phase to address:** Phase 6 (Three Surfaces bento) — a11y task.

---

### Pitfall 30: Color contrast on gradient backgrounds

**What goes wrong:** Spotlight + Lamp + AnimatedBeam all create gradient backdrops. Text rendered ON the gradient (e.g. CTA over a coral-tinted Spotlight halo) may locally drop below 4.5:1 contrast in the brightest patch of the gradient. WCAG audit fails.

**How to avoid:** When text overlaps a gradient region, either (a) add a solid background scrim behind the text (`bg-background/90` with backdrop-blur), or (b) limit gradient max-alpha to 0.15 so background remains predominantly `#07080a` everywhere text appears.

**Phase to address:** Each section build phase — verify text contrast at brightest gradient patches.

---

### Pitfall 31: Keyboard navigation on interactive demo

**What goes wrong:** Demo sample picker uses card clicks. Without keyboard handlers, sample cards aren't focusable / triggerable. Screen-reader users can't run the demo. WCAG SC 2.1.1 (Keyboard) failure.

**How to avoid:** Sample picker cards are `<button>` elements (not divs), `tabIndex={0}`, `aria-label="Try sample: {handle}"`. MultiStepLoader is announced via `aria-live="polite"`. Result cards have `role="article"` with `aria-label` for the score.

**Phase to address:** Phase 4 (Demo) — a11y task within phase.

---

### Pitfall 32: Image alt-text generic / missing on partner logos

**What goes wrong:** Logo marquee renders `<img src="/landing/logos/partner-X.svg" alt="" />` — empty alt. Screen-reader users hear nothing. WCAG SC 1.1.1 (Non-text Content) edge case: decorative is OK to skip, but partner logos with brand-name meaning should be announced.

**How to avoid:** Each logo image has descriptive alt: `alt="Numen Machines"`, `alt="TechCrunch"`, etc. Mark only purely decorative ornaments with `alt=""`.

**Phase to address:** Phase 8 (Social proof) — a11y task.

---

### Pitfall 33: Hamburger menu animation on mobile header

**What goes wrong:** If `LandingHeader` adds a mobile hamburger with a fancy slide-in panel + backdrop-blur menu, common bugs: (a) menu doesn't close on outside-tap, (b) menu blocks scroll under it, (c) menu transition has jank on iOS Safari (300ms touch delay legacy), (d) menu links don't close menu after navigation, (e) backdrop-blur dropped by Lightning CSS (Pitfall 2 again).

**How to avoid:** Use a battle-tested shadcn `Sheet` or `Drawer` primitive — already in design system. Don't custom-build the mobile menu.

**Phase to address:** Phase 1 (Foundation) — header decision.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip reduced-motion fallback on a Magic UI / Aceternity component "for now" | Saves 15-30 min per component | WCAG audit failure; vestibular user complaints; rework whole section | Never — every animation must honor reduced motion before phase ships |
| Use a stock testimonial avatar / made-up testimonial as placeholder | Section looks complete in dev | Investor / press demo exposure; trust signal destroyed | Only with explicit "PLACEHOLDER - replace before public launch" prop and a Phase 11 sweep removing all |
| Skip `next/dynamic` on Spline / tsParticles import | "Works on my machine" | LCP catastrophe in production | Never — both libs touch window at module level |
| Edit `(marketing)/page.tsx` instead of `(marketing)/v3/page.tsx` "to save the path-rename step later" | Saves the rename step | Production site serves in-progress landing on next deploy; emergency revert | Never until Phase 11 cutover |
| Copy an Aceternity component's `framer-motion` import as-is | Compiles, no warning | Bundle bloat; subtle animation drift; debugging headaches when AnimatePresence behaves oddly | Never — convert to `motion/react` on copy-paste |
| Use multi-color Aurora / WavyBackground / Vortex backdrop "because it looks impressive" | Section "wows" in isolation | Investor-impression damage; reads as template; conflicts with Raycast brief | Never for Landing v1 |
| Defer mobile responsive of a section until Phase 10 | Build desktop faster | 1.5-2x rework on each section instead of 1.1x in-phase | Acceptable for low-mobile-traffic sections (Pricing has higher desktop weight); not acceptable for Hero / Demo |
| Skip in-phase Lighthouse check, run all at Phase 10 | Faster section build | Regression compound; harder to isolate culprit; Phase 10 becomes catastrophic | Acceptable IF Phase 10 has explicit ≥ 4 hours of polish budget; otherwise per-section gate |
| Use `useState` + `setTimeout` for demo state machine instead of `useReducer` | Marginally less boilerplate | Hard to add 5th demo state; state-bug-prone | Acceptable for placeholder; refactor before Phase 11 |
| Eagerly mount tsParticles "to debug what it looks like" | Faster initial-look feedback | Pitfall 8 hydration bugs | Acceptable in `/v3/preview` route only; never on `/v3` |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Magic UI shadcn install | Run from wrong dir (must be repo root); shadcn writes to weird path | `cd ~/virtuna-landing && npx shadcn@latest add @magicui/...` |
| Aceternity shadcn registry | Use namespace pattern (`@aceternity/...`) which doesn't exist | Use full URL: `npx shadcn@latest add https://ui.aceternity.com/registry/spotlight.json` |
| Cult UI shadcn registry | Same — assume namespace works on stable shadcn | Register `@cult-ui` in `components.json` OR use direct URL |
| `motion/react` from Magic UI | Confused with installed `framer-motion`; double-import same component | Always import from `motion/react`; remove `framer-motion` imports on each new component |
| Vercel preview deploys | Preview deploys auto-merge env vars from production — Sentry DSN leaks to preview, generating noise | Configure Sentry to only initialize for production deploys |
| Whop trial CTA from landing | "Start free trial" routes to dashboard but user isn't authenticated → redirect loop | CTA routes to `/onboarding` (existing flow) which handles unauth → signup → onboard → trial-start cleanly |
| TikTok @handle samples in demo | Use real creator handles → permission / brand risk | Use clearly-fictional handles (e.g. `@samplecreator1`) or placeholder names; never real public TikTok creators without consent |
| OG image | Update root OG; forget marketing-route-group OG (it overrides) | Update BOTH `src/app/opengraph-image.tsx` AND `src/app/(marketing)/opengraph-image.tsx` (or consolidate to one) |
| sitemap.xml | Inline the wrong base URL or forget to update on prod deploy | Use `process.env.NEXT_PUBLIC_SITE_URL` with fallback; document in `.env.example` |
| `next/font/google` Inter | Add a second font (Geist Mono, etc.) "for code snippets" — violates single-font rule | Inter is the only font per CLAUDE.md; use ui-monospace fallback for any code |
| Supabase Auth redirect after CTA click | Don't preserve return URL → user lands on dashboard instead of where they wanted | Use the existing deep-link preservation pattern (PROJECT.md validated) — confirmed working |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Multiple `motion/react` runtimes (framer-motion + motion both shipped) | Bundle ~30 KB larger than needed; subtle animation drift | `pnpm.overrides` aliasing `framer-motion → motion`; grep on every install | Always (subtle regression, hard to spot until bundle audit) |
| Spline runtime above-fold | LCP > 3s on mobile; Lighthouse Performance ≤ 60 | `dynamic({ ssr: false })` + IntersectionObserver gate + Canvas fallback default | Immediately on hero ship to mobile users |
| Cursor-tracked MagicCard 5+ instances | INP 200-500ms on mid-tier mobile | Limit MagicCard to 1-2 instances per page; disable on `pointer: coarse` | Three Surfaces section if every card uses MagicCard |
| tsParticles slim bundle without lazy-load | LCP +200-400ms; hydration warnings | `dynamic({ ssr: false })` + initParticlesEngine gate | Immediately on use |
| Hero Canvas re-renders per frame | Frame rate < 30 fps; battery drain on mobile | Refs + module-level state (BRAND-BIBLE VIZ-04 pattern); no React re-renders inside RAF | At 300+ particles on mid-tier mobile |
| BorderBeam + AnimatedBeam + OrbitingCircles all looping simultaneously | GPU-saturation; battery warning; frame drops in DevTools Performance tab | Loop only ambient (BorderBeam in 1 hero spot); pipeline + orbit one-shot only per BRAND-BIBLE VIZ-04 | Hero with 3+ continuous animations |
| AnimatedTestimonials 3D rotation | Continuous GPU load even when section off-screen | `useInView` gate per ARCHITECTURE.md § 5; suspend rotation when not in view | Section visible on first scroll-resume after long idle |
| Logo Marquee with PNG logos | Each frame paints 12+ raster images, GPU upload cost | Use SVG logos exclusively for marquee | 8+ logos in a single marquee row |
| Hero Canvas + Spotlight + BorderBeam all alpha-blending | Compositor cost; 30+ ms paint per frame | Test on physical iPhone SE / mid-Android; if frame-pacing degrades, drop one (Spotlight first — pure CSS, easiest to reinstate) | Mid-tier Android, > 60 sec session |
| Sentry SDK on landing routes | +80 KB JS on every landing visit | Scope Sentry init to authenticated routes via `instrumentation.ts` filter | All landing visitors (high volume vs auth volume) |
| Bundle-bloat from importing entire `lucide-react` icon library | +50-100 KB if tree-shaking misconfigured | Verify Vite/SWC tree-shaking via `next build` output; use per-icon imports (`import { Video } from 'lucide-react/Video'`) | Whenever bundling pipeline regresses |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Embedding real TikTok creator handles in demo without consent | Brand risk / DMCA / trademark concern | Use fictional `@samplecreator1` handles; if real, get written consent on file |
| Placeholder testimonials with fake reviewer names | Trust signal collapse if discovered; potential FTC issue (US: undisclosed paid testimonials) | Real testimonials only OR labeled `[Placeholder — replace before launch]` until real available |
| Trusted-by logos used without partner permission | Trademark / brand-misuse claim | Only use logos with explicit "use our logo" permission in writing; Numen Machines own lockup is fine |
| Auto-mounting Whop checkout iframe on hero | Hidden cost: tracking cookies before consent | Lazy-mount checkout only after explicit user click on CTA |
| Embedded TikTok player on landing | TikTok's terms-of-service for embed have changed; risk of takedown | Use static thumbnails + click-to-play with link to TikTok; don't autoplay |
| Cookie banner deferral | EU / UK / CA users may load without consent banner; legal exposure | If GDPR/CCPA applicable to audience, add cookie banner before any tracking script loads; flag in Phase 10 if relevant; out-of-scope per PROJECT.md but document the deferral |
| OG image leaking dashboard preview | If OG image fetches real product data, secrets in build artifact | Verify OG image is pure design (no API calls); current `opengraph-image.tsx` is pure JSX-rendered, safe |
| Sample TikTok URL inputs (if demo accepts text) | XSS via inserted iframe / script tags | Demo URL field is purely cosmetic (scripted result regardless of input); validate as TikTok URL pattern OR ignore input entirely (preferred for v1 since result is scripted) |
| Dashboard CTA preserves redirect cookie | Auth flow vulnerability if redirect target unvalidated | Existing pattern validated (PROJECT.md); allow-list `/dashboard` and `/onboarding` only |
| Sentry DSN exposure in client bundle | Public DSN is OK by design but verify only client-safe data sent | Configure `tracesSampleRate` and disable session-replay on marketing routes |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Animation autoplay overload (every section animates on entry simultaneously when user scrolls fast) | Vestibular discomfort; "page feels chaotic" | Stagger section entries; reduce-motion fallback for fast-scrolling users (detect via `IntersectionObserver` velocity) |
| Demo result auto-resets after 5 seconds (user trying to read insights) | Frustration; user can't finish reading | Result persists until user clicks "Try another" or scrolls past; never auto-reset |
| Pricing card tooltip on `Info` icon (hover-only) on mobile | Tooltip content invisible to mobile users | Tap-to-toggle on mobile (shadcn `Popover` handles this natively) |
| Hero CTAs all in same color (coral on coral) | Primary vs secondary indistinguishable | Primary = filled coral; Secondary = transparent + 6% border (existing Button system already does this) |
| Above-fold has 4+ CTAs (hero primary + hero secondary + header signup + sticky bar) | Choice paralysis; conversion drop | Maximum 2 CTAs visible above fold; sticky bar appears below fold |
| Footer link to /research / /about / /manifesto that doesn't exist | 404 on click; trust signal collapse | Per PROJECT.md, "CTAs may stub them" — render but route to a holding "Coming soon" page OR remove links until pages exist |
| Empty state in Demo before user picks a sample (just gray box) | Confused about what to do | Render sample picker visibly with "Pick one to try" cue + arrow / hover-pulse on first card |
| Pricing card with 20+ features per tier | Information overload; user can't scan | Group into ≤ 6 categories per OpusClip-derived pattern (FEATURES.md § 7) |
| Final CTA copy that introduces a new claim ("Save 30% on your first month!") | User has just read 8 sections; new info = doubt | Mirror hero copy verbatim — bookend close (OpusClip pattern) |
| "Read the white paper" CTA → broken link or PDF that doesn't exist | Trust signal collapse on the Science section | Stub to "Coming soon" page OR remove the CTA for v1; don't ship broken |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Hero:** Often missing reduced-motion fallback for Canvas viz — verify by enabling macOS Reduce Motion and reloading
- [ ] **Hero:** Often missing 100dvh fix for iOS Safari — verify on physical iPhone or iOS simulator
- [ ] **Hero:** Often missing LCP optimization — verify Lighthouse identifies H1 (not Canvas) as LCP element
- [ ] **Demo:** Often missing keyboard navigation on sample picker — verify Tab + Space/Enter triggers sample pick
- [ ] **Demo:** Often missing aria-live announcement of loader progress — verify with VoiceOver
- [ ] **Demo:** Often missing reduced-motion skip-loader behavior — verify Reduce Motion mode jumps directly to result
- [ ] **How it works pipeline:** Often missing mobile vertical fallback — verify at 375px width
- [ ] **How it works pipeline:** Often missing one-shot pulse (often loops by default) — verify BRAND-BIBLE VIZ-02 compliance
- [ ] **Three Surfaces bento:** Often missing role="article" + aria-labelledby on each cell — verify with axe-core
- [ ] **Three Surfaces bento:** Often missing single-column collapse on mobile — verify at 375px
- [ ] **Science StickyScroll:** Often missing linear-flow fallback on mobile — verify on iPhone Safari (pinning disabled `<md`)
- [ ] **Science:** Often missing real paper citations — verify all chip text matches a real published paper title
- [ ] **Social proof:** Often missing follower-count signal on testimonials — verify each quote has @handle + count
- [ ] **Social proof:** Often missing logo permission audit — verify every partner logo has documented use permission
- [ ] **Pricing:** Often missing monthly/yearly toggle that actually changes prices (often visual only) — verify both states render
- [ ] **Pricing:** Often missing tooltip-on-mobile pattern — verify tap-to-toggle on each `Info` icon
- [ ] **Pricing FAQ:** Often missing keyboard navigation on accordion — verify Tab + Enter expands/collapses
- [ ] **Final CTA:** Often missing match to hero copy — verify verbatim mirror
- [ ] **Footer:** Often missing real social/legal links — verify every href points to a real page or is stubbed to `#`
- [ ] **Whole page:** Often missing Lighthouse Performance ≥ 90 mobile — run on Vercel preview, not local
- [ ] **Whole page:** Often missing CLS < 0.1 — run Lighthouse, check field data via Vercel Speed Insights
- [ ] **Whole page:** Often missing INP < 200ms — measure with Web Vitals Chrome extension on mid-tier device
- [ ] **Whole page:** Often missing Tab-key full traversal — verify entire landing navigable via keyboard alone
- [ ] **Whole page:** Often missing axe-core / pa11y clean run — run automated a11y scan
- [ ] **Whole page:** Often missing Vercel preview deploy of `/v3` before cutover — verify Davide reviewed at preview URL
- [ ] **OG image:** Often missing landing-specific OG (still uses old marketing layout OG) — verify OG image matches new H1
- [ ] **Metadata:** Often missing landing-specific `<title>` (still uses stale "Artificial Societies..." title) — verify root `(marketing)/layout.tsx` updated
- [ ] **Sitemap.xml:** Often missing landing anchors — verify sitemap.ts includes `/`, `/#demo`, `/#pricing`
- [ ] **robots.txt:** Often missing — verify robots.ts allows `/` and disallows authenticated routes

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Production cutover serving broken `/v3`-stub at `/` | HIGH | Vercel: redeploy previous commit (instant rollback button); investigate, fix, redeploy |
| Lighthouse Performance drops ≥ 20 points after a phase merge | MEDIUM | Bundle-analyzer diff; identify the heavy import; lazy-load or remove |
| Magic UI / Aceternity component breaks on Tailwind v4 oklch / Lightning CSS | LOW | Patch component source per CLAUDE.md workarounds (inline-style backdrop-filter; hex for L<0.15) |
| WCAG audit failure on launch | MEDIUM | Identify specific WCAG SC; per-section fix (most likely reduced-motion or aria-label); re-audit |
| Investor feedback: "feels generic / template" | MEDIUM-HIGH | Reference-anchor comparison; identify trope (likely Aurora gradient, fake testimonial, or AI-coded H1); rewrite the offending section against Linear/Raycast counterpart |
| Demo sample picker not working on iOS Safari | MEDIUM | iOS Safari touch-action bug; add `touch-action: manipulation` to sample buttons; verify on physical device |
| Hero Canvas frame-drops on mid-tier mobile | MEDIUM | Reduce particle count (BRAND-BIBLE VIZ-03 mobile reduction to 100-150); verify 30 fps minimum |
| 544 KB Spline runtime accidentally shipped | HIGH | Revert the import; switch to Canvas viz fallback (already locked default); audit `node_modules` removal |
| Coral CTA invisible against coral-tinted Spotlight | LOW | Reduce Spotlight alpha to 0.10 or shift CTA color (recommend Spotlight reduction — keep coral CTA hue lock) |
| Mobile single-column collapses broke layout | MEDIUM | Per-section Tailwind responsive sweep at 375px; CSS-only changes typically; re-verify at sm/md/lg breakpoints |
| Cookie banner not added for EU traffic | LOW (if non-urgent) | Stub a simple cookie banner via shadcn `Toaster`; defer detailed consent management |
| Sentry noise spike on landing | LOW | Filter `instrumentation.ts` to scope DSN init to authenticated routes |
| Pricing standalone `/pricing` page diverges from on-page pricing | LOW | Phase 11 cutover decision: delete `/pricing` + add redirect to `/#pricing` |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls. Phase numbers reference ARCHITECTURE.md § 8 recommended phase ordering (Phase 1 Foundation → Phase 11 Cutover).

| Pitfall | Prevention Phase(s) | Verification |
|---------|---------------------|--------------|
| **1. framer-motion vs motion mismatch** | Phase 1 (install audit) + every install phase | `grep` clean; `pnpm.overrides` set; bundle analyzer shows single runtime |
| **2. Lightning CSS strips backdrop-filter / mask** | Phase 2 (Hero Spotlight) + every glass-component install | Vercel preview vs dev side-by-side; computed style audit |
| **3. oklch L<0.15 compilation** | Phase 1 (token review) + every new keyframe color | Hex-only for dark colors; visual diff against design |
| **4. Coral chroma clash on gradients** | Phase 2 (Hero shared primitives, locks the rule) + Phase 8 (Social proof) | Side-by-side with Linear; grayscale-invert luminance test |
| **5. prefers-reduced-motion ignored** | Phase 1 (MotionConfig root) + every section build phase + Phase 10 (audit) | macOS Reduce Motion enabled; full scroll-through; axe-core clean |
| **6. Spline 544 KB bundle weight** | Phase 3 (Canvas viz proves out — Spline rejected) + Phase 11 (bundle check) | Bundle analyzer < 250 KB chunks; Lighthouse ≥ 90 |
| **7. WebGL / R3F context-loss** | Phase 3 (no R3F gate) + Phase 10 (iOS Safari test) | Physical iPhone tab-switch test; no black box |
| **8. tsParticles SSR hydration** | Phase 1 (palette doc) + Phase 2 IF tsParticles chosen | No hydration warnings in dev console; no flash on mount |
| **9. Component name collision (marquee, useCountUp)** | Phase 1 (install audit, collision check) | Pre-install file inventory; `git diff` reviewed |
| **10. v3.0-style brand-spine over-commitment** | Roadmap design (before Phase 1) — cap at ≤ 11 phases, Phase 1 = scaffold | Roadmap review by Davide; no standalone brand-foundation phase |
| **11. Route collision at /** | Phase 1 (Foundation, /v3 staging) + Phase 11 (Cutover) | CI guard on `(marketing)/page.tsx` until Phase 11; Vercel preview review |
| **12. Duplicate <html> in marketing layout** | Phase 1 (Foundation, fix as first task) | No React hydration warnings; valid HTML in Lighthouse |
| **13. Above-fold LCP regression** | Phase 3 (Hero Canvas, LCP gate) + Phase 10 (audit) | Lighthouse mobile LCP < 2.5s; H1 identified as LCP element |
| **14. CLS from late-mounting animations** | Phase 10 (CLS audit) + each section's min-height reservation | Lighthouse CLS < 0.1; visual no-jump on first paint |
| **15. INP from cursor-tracked MagicCard** | Phase 6 (Three Surfaces, forbids MagicCard on Bento) + Phase 10 | Lighthouse mobile INP < 200ms; Pixel-class Android manual test |
| **16. Font loading FOUC** | Phase 1 (next/font config verify) + Phase 10 (slow-network test) | DevTools 3G throttling; font swap < 500ms |
| **17. Investor-impression slop tropes** | Phase 11 (reference-fidelity audit) + each section's reference-anchor screenshot | Side-by-side comparison with Linear/Raycast/OpusClip references |
| **18. Sentry SDK bundle weight** | Phase 10 (Sentry scope review) | Bundle analyzer; Sentry init filtered to authenticated routes |
| **19. Pricing buried below scroll** | Phase 2 (header anchor) + Phase 9 (Pricing scroll-depth verify) | Manual click hero → scroll-to-Pricing measured |
| **20. Scrolljacking on mobile** | Phase 7 (Science StickyScroll touch fallback) + Phase 10 | Manual touch device test; StickyScroll disabled `<md` |
| **21. Hover-dependent reveals on mobile** | Each section's mobile sub-task + Phase 10 | Manual mobile test; all hover content also visible via tap/static |
| **22. iOS Safari 100vh trap** | Phase 2 (Hero, 100dvh) | Physical iPhone test; no hero re-flow on scroll |
| **23. Hero animation competing with CTA** | Phase 3 (BehavioralSimulationHero one-shot ≤ 2s) | Animation duration verified; CTA shine cadence verified |
| **24. Demo loads slowly → momentum break** | Phase 4 (Demo, pre-fetch on hover-intent + SSR picker) | Hero CTA click to first sample-pickable state ≤ 200ms |
| **25. shadcn registry namespace collisions** | Phase 1 (palette doc) — N/A unless Cult UI added | Defer |
| **26. Footer / /pricing standalone conflict** | Phase 11 (Cutover) — delete `/pricing` + redirect | `next.config.ts` redirects() configured |
| **27. Header navigation drift** | Phase 1 (header decision) — build LandingHeader | Marketing header links to anchors, not /dashboard |
| **28. Viewport-zoom blocking** | Phase 1 (Foundation) — verify viewport meta | Audit `src/app/layout.tsx` viewport export |
| **29. ARIA missing on Bento** | Phase 6 (Three Surfaces a11y task) | axe-core clean on Bento section |
| **30. Color contrast on gradients** | Each section build phase | Brightest-gradient-patch text contrast measured ≥ 4.5:1 |
| **31. Keyboard nav on demo** | Phase 4 (Demo a11y task) | Tab + Space/Enter triggers sample pick; VoiceOver announces loader |
| **32. Alt-text on partner logos** | Phase 8 (Social proof a11y task) | All logos have descriptive alt; axe-core clean |
| **33. Hamburger menu animation bugs** | Phase 1 (header decision — use shadcn Sheet/Drawer) | Mobile menu opens/closes/navigates correctly |

---

## Sources

- `.planning/PROJECT.md` — milestone scope, retired brand-spine, audience strategy
- `.planning/MILESTONE.md` — Landing v1 worktree identity
- `.planning/research/STACK.md` — install paths, bundle ceilings, integration pitfalls (Tailwind v4, Lightning CSS, motion vs framer-motion, Spline 544 KB, tsParticles SSR)
- `.planning/research/FEATURES.md` — section patterns, OpusClip conversion vocab, anti-patterns per section
- `.planning/research/ARCHITECTURE.md` — file layout, route convention, component reuse, mobile responsive plan, build order
- `BRAND-BIBLE.md` § Visual Metaphor Lock — VIZ-01 to VIZ-05 (Canvas hero one-shot, pipeline one-shot, scale affordances, reduced-motion fallback, performance budget)
- `BRAND-BIBLE.md` Do's and Don'ts — translate-y forbidden, oklch warning, single-font rule, no GradientGlow/GradientMesh
- `CLAUDE.md` — Tailwind v4 oklch known issue, Lightning CSS backdrop-filter stripping, dev cache hygiene, Raycast design language rules
- `.planning/milestones/v3.0-brand-statement-landing/STATE-final.md` — abandoned at 2/6 phases, "stopped at Phase 2 context gathered" — abandonment archived 2026-05-10
- `.planning/milestones/v3.0-brand-statement-landing/REQUIREMENTS.md` — v3.0 brand-spine ("Your audience, simulated."), vocab guardrails forbidding "viral"/"AI", 6-phase plan that didn't survive
- `.planning/milestones/v3.0-brand-statement-landing/ROADMAP.md` — Phase 1 = 4-plan brand-foundation, Phase 6 = $100M+ reference-fidelity audit; structure that proved too top-heavy
- WCAG 2.1 SC 2.2.2, 2.3.3, 1.4.4, 2.1.1, 1.1.1 — accessibility criteria referenced
- Motion.dev migration guide — `framer-motion` → `motion` alias pattern via `pnpm.overrides`
- Next.js App Router docs — `dynamic({ ssr: false })`, `metadata` API, `(marketing)` route group convention
- iOS Safari `100dvh` support — Safari 15.4+ (97%+ user base)

---

*Pitfalls research for: Landing v1 (high-end animated SaaS landing page added to existing Virtuna codebase)*
*Researched: 2026-05-24*
