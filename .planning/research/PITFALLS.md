# Pitfalls Research

**Domain:** Production SaaS landing page — Next.js 15 + Tailwind v4 + motion-heavy single-page rebuild
**Researched:** 2026-05-19
**Confidence:** HIGH (grounded in this project's actual milestone history + verified technical sources)

---

## Critical Pitfalls

### Pitfall 1: Craft Reference Bleeds Into Composition Reproduction

**What goes wrong:**
The page achieves original copy and original assets but still unmistakably "feels like" the reference site. Users correctly identify it as derivative on a first impression. This is exactly what terminated two prior landing milestones: v3.0 "Brand Statement Landing" (abandoned 2026-05-11 after 2/6 phases, viewports 2-7 still 90% like the societies.io template aesthetic), "Landing Page Redesign" worktree (abandoned 2026-05-10 before shipping, direction reset), and the v1.1 pixel-perfect societies.io clone (shipped, then reset for plagiarism vibe persisting across surfaces).

The derivative-feel problem is not about copy or brand assets — it is structural. Specific failure modes:

- **Layout proportions cloned:** Same column ratios, same hero aspect-ratio, same section-to-section height rhythm as the reference site. The skeleton of the page is recognizable even after all content is replaced.
- **Motion choreography cloned:** Identical easing curves, identical stagger timing, identical reveal threshold. Linear's characteristic spring-based feel is deeply recognizable even without Linear's content.
- **Signature creative compositions imported:** Not the graphic itself, but the spatial concept — e.g., a centered UI mockup at a specific angle with a specific light bloom radius, a feature grid with a specific card hover mechanic. The composition *idea* gets reproduced even when the pixels differ.
- **Color token adoption:** Borrowing Linear's cool-gray-dark palette instead of staying with Virtuna's coral+dark-brown identity. Even one borrowed accent creates a tonal fingerprint.
- **Section order and narrative arc cloned:** Hero → product teaser → features grid → social proof → pricing is also Linear's section order. When the section *concepts* (hero, teaser, grid, social, pricing) map 1:1 with matching proportion and pacing, the page reads as a clone regardless of content.

**Why it happens:**
Developers use the reference site as a structural wireframe while only swapping content. The line between "craft quality reference" and "composition source" gets crossed unconsciously because spatial/structural decisions are less visible than copy. The two prior abandoned milestones both failed here: visual identity was not driven by Virtuna's product story but by what "fit" the reference template.

**How to avoid:**
Before building any section, write a one-sentence "Virtuna-specific reason this section exists here" that is grounded in the product narrative (prediction, competitor intel, brand deals, behavioral science moat), not in "Linear has a section here." Section order, proportion, and spatial concept must be derivable from Virtuna's narrative without ever opening the reference site.

Use the reference site **only** to calibrate execution quality: is the typography rhythm tight? Is the spacing this disciplined? Is the motion this restrained? Not: does this section exist here? How wide is this column?

For motion: extract the *quality descriptor* (smooth, deliberate, not decorative), not the timing values. Derive easing curves from the quality descriptor independently.

**Warning signs:**
- Phase plan says "similar to how Linear does..." for any spatial or compositional decision
- Section proportions were eyeballed from the reference site
- The page makes visual sense only if you already know the product — it cannot explain itself through composition alone
- Mobile layout breaks because the desktop composition only made sense at the reference site's desktop breakpoints

**Phase to address:**
Phase 1 (foundation / token layer). Establish a Virtuna-specific section brief — one paragraph per section explaining its existence from the product narrative — before any markup is written. This brief is the gate. No section ships without a section brief that stands on its own.

---

### Pitfall 2: Tailwind v4 oklch Compilation Inaccuracy on Dark Tokens

**What goes wrong:**
Dark colors defined with oklch in the `@theme` block compile to visually wrong values at L < 0.15. The issue is documented in this project's own CLAUDE.md (KEY DECISION: "Dark gray tokens in hex (not oklch) — workaround for Tailwind v4 compilation inaccuracy"). Landing-specific dark tokens added naively in oklch will produce washed-out or subtly wrong dark backgrounds that differ between dev and production, and differ between Chrome and Safari.

**Why it happens:**
Tailwind v4 uses oklch natively for its color system. Lightning CSS (the underlying transformer) has known inaccuracies when converting very dark oklch values to sRGB for browsers that don't support oklch natively. The compiled output diverges from the intended value. This is a confirmed issue on this codebase, not a hypothesis.

**How to avoid:**
All landing-specific dark surface tokens must use exact hex values in `@theme`, not oklch. This is already the established pattern for the existing design system. The landing token layer (`--color-landing-*`, `--surface-landing-*`) must follow the same rule. If a new mid-range or light color is needed (coral tints, accent fills), oklch is acceptable at L > 0.3.

Additionally: Tailwind v4's oklch palette breaks completely for ~7% of users on older browsers (no native oklch support). The existing hex workaround already sidesteps this. Do not regress it.

**Warning signs:**
- A background looks slightly different in Safari vs Chrome
- A dark section looks more gray/washed in production (Vercel build uses Lightning CSS) than in the dev server
- Dev server CSS caching making the problem appear intermittent (kill dev + clear `.next/` + `node_modules/.cache/`)

**Phase to address:**
Phase 1 (token layer setup). Token file must explicitly document which tokens use hex (all darks) vs oklch (mid/light accents only). Verified at token layer phase before any section component is built.

---

### Pitfall 3: Lightning CSS Stripping backdrop-filter

**What goes wrong:**
`backdrop-filter` applied via Tailwind utility classes or CSS classes gets silently stripped by Lightning CSS during the production build. The blur/glass effect works in dev (dev server does not run Lightning CSS) and disappears in production. This is documented in CLAUDE.md as a known issue: "Apply via React inline styles (`style={{ backdropFilter: 'blur(Xpx)' }}`), not CSS classes."

This is particularly dangerous for the landing page because glass morphism effects, frosted nav bars, and blur-behind card sections are common landing UI patterns that will be stripped if implemented the wrong way.

**Why it happens:**
Lightning CSS, which Tailwind v4 uses for transforms in production, removes backdrop-filter declarations it considers non-standard or encounters issues with. This is not a configuration option — it is a build pipeline behavior.

**How to avoid:**
Every backdrop-filter usage on the landing page must be in React inline styles, not CSS classes. Add an ESLint rule or a code review gate: grep for `backdrop-blur` and `backdrop-filter` in class strings on landing components. All occurrences are bugs.

**Warning signs:**
- Frosted glass nav or card looks correct in dev, flat/transparent in production
- `backdrop-blur-*` class in a landing component's className string

**Phase to address:**
Phase 1 (token/component foundation). Establish as a lint-enforceable rule before any glass-effect component is written. If the nav or hero card uses backdrop-filter, verify in a production build (or `next build && next start`) at the end of that phase — not only in dev.

---

### Pitfall 4: LCP Regression From Motion-Heavy Hero

**What goes wrong:**
The hero section, which contains the LCP element (typically the H1 or a hero image), is wrapped in an animation that delays its paint. A Framer Motion `initial={{ opacity: 0 }}` on the hero container means the LCP element is invisible until the JS bundle loads and hydrates. Google measures LCP from first paint — an invisible element is not measured until it appears. This can push LCP to 3-4s on mobile, failing Core Web Vitals.

**Why it happens:**
Motion-first development applies animation wrappers to everything without considering whether the element is the LCP candidate. `AnimatePresence` and `motion.div` on the hero are natural instincts for a polish-focused build, but they cost LCP.

**How to avoid:**
The LCP element (H1 or hero image, whichever is largest at the viewport) must NOT be inside an opacity-animating wrapper on first paint. Options:
- Render the LCP element outside any motion wrapper, then animate supporting elements around it
- Use CSS animations (not JS-driven) on the hero — CSS animations fire before hydration
- If using Framer Motion on the hero, use `initial={false}` for SSR and only animate on mount after a check, OR accept that the hero entry animation is a pure CSS fade-in with `animation-duration: 0.3s`

For hero images: use `<Image priority>` (Next.js) — never `loading="lazy"` on above-the-fold images. This is the single largest LCP fix available.

**Warning signs:**
- Lighthouse LCP > 2.5s on mobile
- Hero H1 has `opacity: 0` in the DOM on initial render (inspect source)
- `motion.div` wrapping the hero with `initial={{ opacity: 0 }}`

**Phase to address:**
Hero section phase (typically Phase 2). LCP measurement is a phase gate: the hero does not ship until Lighthouse mobile LCP < 2.5s is verified.

---

### Pitfall 5: CLS From Images Without Explicit Dimensions and Font Loading

**What goes wrong:**
Two independent CLS sources compound on landing pages:

1. **Images without dimensions:** Any `<img>` or `<Image>` without explicit width/height (or a CSS `aspect-ratio`) causes layout shift when the image loads. On a landing page with feature screenshots, mockups, or illustration assets, this is easy to accumulate across multiple sections.

2. **Font-display: swap with no size-adjust fallback:** `font-display: swap` causes the system font fallback to render first, then the correct font loads and shifts all text. On a display-weight landing headline at 72px, even a 2% font-metric difference causes massive CLS. Next.js `next/font` with its built-in `size-adjust` fallback generation mitigates this — but only if the font is loaded through `next/font`, not via a raw CSS `@import`.

**Why it happens:**
Feature screenshots and mockups are added late in phase development when dimensions may not be known yet. Raw `@import` for Inter is tempting because the design system already uses Inter — but using `next/font` for the landing layer is the correct approach.

Inter is already used globally via the existing design system. The risk is the landing layer adding a second import or overriding font variables without going through `next/font`.

**How to avoid:**
- All landing images: explicit `width` + `height` on `<Image>`, or `style={{ aspectRatio: '16/9' }}` when dimensions are dynamic. No exceptions.
- Inter is loaded by `next/font` at the root layout. The landing route inherits it. Do not add a second font import for the landing.
- Run Lighthouse after each section phase: CLS must be < 0.1 before that section ships.

**Warning signs:**
- Sections visually jump on page load during development
- Lighthouse CLS > 0.1 after adding a new section
- A second `@font-face` or `@import` for Inter in landing CSS

**Phase to address:**
Every section phase. CLS is a continuous gate, not a final audit. Each section phase must end with a Lighthouse check.

---

### Pitfall 6: Scroll Jank From Non-Composited Animations

**What goes wrong:**
Animations that mutate layout properties (top, left, width, height, margin, padding) during scroll force the browser to recalculate layout on every frame. On a motion-heavy landing page with multiple scroll-triggered sections, this compounds into visible scroll jank, especially on mobile. INP also degrades when long JS tasks from animation libraries overlap with user scroll events.

**Why it happens:**
Parallax effects on background images often use `top` or `margin-top` offsets. Section reveal animations using `height` or `translateY` combined with `height: auto` transitions trigger layout. Using `useScroll` + `useTransform` from Framer Motion improperly (reading scrollY and setting non-composited properties) causes layout thrashing.

**How to avoid:**
- Animate only `transform` and `opacity`. No exceptions for scroll-driven animations.
- Parallax: use `transform: translateY()`, never `top` or `margin-top`.
- For scroll-triggered reveals: use `IntersectionObserver` to add a class, use CSS transitions on `opacity` + `transform`. Do not read `scrollY` in a `useEffect` loop.
- If Framer Motion `useScroll` is used: only pipe into `transform` and `opacity` motion values, never into layout-affecting values.
- `will-change: transform` on elements with active scroll animations (use sparingly — overuse causes memory pressure).

**Warning signs:**
- Scroll feels "sticky" or stutters on mobile
- Chrome DevTools Performance panel shows "Layout" or "Style recalculation" blocks during scroll
- FPS drops below 55 when scrolling past animated sections

**Phase to address:**
Each animated section phase. Any section with a scroll-driven animation must be profiled in Chrome DevTools mobile simulation before shipping.

---

### Pitfall 7: Framer Motion SSR Hydration Mismatch

**What goes wrong:**
Next.js 15 App Router renders components on the server. Framer Motion's `motion.*` components access browser APIs (DOM, window) during render, causing the server-rendered HTML to diverge from the first client render. This produces a React hydration mismatch error and a flash of unstyled content, and in some cases, full page remount.

**Why it happens:**
Entire page components or section components are marked `"use client"` to enable Framer Motion, but motion components render during SSR with stale initial state that does not match what the browser will compute. The specific trigger: `AnimatePresence` with `mode="wait"` or any `motion.div` with dynamic `initial` values computed from browser state (viewport width, scroll position, media query result).

**How to avoid:**
- Never mark an entire section component `"use client"` just to enable motion. Instead, create a thin `MotionWrapper` client component that wraps only the animating element. The section's server-rendered content stays as RSC.
- For initial animation values: always use static values (not computed from window/viewport). If viewport-dependent, compute server-side via headers/userAgent or derive from CSS.
- Prefer CSS animations for entry reveals on landing sections — they are isomorphic (work identically on server and client render) and do not require hydration.
- `React.useId()` is the pattern for any ID that must be stable across server/client render — already established in this codebase for InputField.

**Warning signs:**
- Console: "Hydration failed because the initial UI does not match"
- Section flashes or unmounts/remounts on page load
- A browser extension injecting attributes causes false positive hydration errors (verify with `curl` before assuming code bug — already encountered in this project per the memory note on React hydration debugging)

**Phase to address:**
Phase 1 (motion architecture). Establish the MotionWrapper pattern before any section uses Framer Motion. All subsequent section phases inherit the pattern.

---

### Pitfall 8: Desktop-First Layout That Breaks on Mobile

**What goes wrong:**
Landing pages built on a desktop viewport (1440px) with complex grid compositions collapse poorly on mobile. Specific failure modes:
- Hero headline too large for 375px — forces awkward line breaks mid-phrase
- Feature section's side-by-side illustration + text collapses to stacked but loses visual hierarchy
- Motion triggers that fire based on scroll amounts calibrated for desktop (1200px scroll depth) fire immediately on 375px (everything is in viewport)
- Touch scroll on mobile triggers hover states that were built only for mouse

**Why it happens:**
Motion-heavy landing pages are usually designed at 1440px where there is space for the full composition. Mobile is treated as a "last step" responsive pass rather than a parallel constraint.

**Why this history makes it worse:**
The v3.0 Brand Statement Landing specifically called out that "viewports 2-7 still felt 90% like the prior template" — meaning the desktop design was template-derived and the mobile adaptation was even thinner because the desktop design was not rooted in Virtuna's own spatial logic.

**How to avoid:**
- Design mobile layout in parallel with desktop. Every phase plan must specify mobile behavior explicitly, not defer it.
- Hero headline: set a `clamp()` size that is readable at 375px before the desktop value is finalized.
- Scroll-triggered animations: `IntersectionObserver` with `rootMargin` is viewport-agnostic. Do not hardcode pixel offsets.
- Touch: test on actual device (or Safari iOS simulator) before each section ships. Mobile Chrome DevTools emulation does not accurately simulate iOS touch behavior.
- `prefers-reduced-motion`: all animations must respect this. iOS users with vestibular disorders commonly enable it.

**Warning signs:**
- Phase plan says "mobile will be handled in a separate polish pass"
- Hero H1 font-size is set in `px` or `rem` without `clamp()`
- Playwright snapshots only run at 1280px, not at 375px and 768px

**Phase to address:**
Every section phase. Mobile viewport snapshots (375px, 768px) are a required gate alongside 1280px. No section ships mobile-unverified.

---

### Pitfall 9: Landing Token Leakage Into Dashboard

**What goes wrong:**
Landing-specific CSS tokens defined in `:root` or `@theme` bleed into the dashboard routes. A `--font-display` token for a landing headline typeface changes headings in the app. A `--color-landing-surface` accidentally overrides `--color-surface` across all routes. This is the "token scope" failure mode specific to a shared Next.js app with one global CSS entry point.

**Why it happens:**
Tailwind v4 `@theme` is global — there is no route-scoped `@theme`. Tokens defined there affect all routes. If the landing requires any token that differs from the dashboard system, it must be scoped to the landing route only using a CSS class wrapper or a route-specific `@layer`.

**How to avoid:**
- All landing-specific tokens must be scoped to a `.landing` root class applied to the landing page's outermost element, not in `@theme`.
- Syntax: `:root.landing` or `[data-page="landing"]` as the selector, with token overrides inside.
- Never modify existing `@theme` token values for the landing page. Only add new tokens scoped to the landing context class.
- A smoke test: navigate from landing to a dashboard page. Run a visual regression Playwright snapshot on the dashboard after the landing token layer ships. Any change is a regression.

**Warning signs:**
- A dashboard component looks slightly different after a landing CSS change was merged
- A new token in `@theme` that has the same variable name as an existing design system token
- Landing styles bleeding into `/login` or `/dashboard` routes

**Phase to address:**
Phase 1 (token layer). The scoping architecture must be established before any landing-specific token is defined. Post-Phase-1 gate: Playwright snapshot of a dashboard component confirms zero regression.

---

### Pitfall 10: Visual Fidelity Gate Becoming Pixel-Match Obsession

**What goes wrong:**
The per-phase visual fidelity gate devolves into comparing Virtuna's page pixel-by-pixel against Linear's landing page, trying to match specific measurements rather than assessing whether the section reaches production craft quality. This wastes time on measurements that are meaningless (matching Linear's hero column width to the pixel) while missing actual quality gaps (Virtuna's section feels flat because the type rhythm is off, not because the column is 4px narrower).

Pixel-match obsession also drifts into composition reproduction — if the gate is "does this look like Linear?" rather than "does this feel production-quality?", the goal shifts from original craft to clone fidelity.

**Why it happens:**
Playwright snapshots by default do pixel-diff comparison. Without a clear rubric for what "production craft quality" means for Virtuna, the gate defaults to "looks like the reference" as a proxy.

**How to avoid:**
Define a craft quality rubric per phase — not pixel-match criteria. The rubric should assess:
1. Typography: is the type scale legible, well-proportioned, and appropriately weighted for the hierarchy?
2. Spacing: is the section's internal spacing consistent and does it breathe correctly?
3. Motion: is the entry animation deliberate and does it not interfere with content?
4. Mobile: does the section read correctly and feel native at 375px?
5. Polish: no visible rough edges — no clipped text, no misaligned elements, no jank

Playwright snapshots for this project mean: "does the section look substantially the same as the last approved state?" — regression testing against Virtuna's own prior state, not against Linear. Side-by-side audits with Linear are for inspiration calibration only, not a pass/fail gate.

**Warning signs:**
- Phase plan contains measurements sourced from the reference site ("hero H1 should be 72px because Linear uses 72px")
- Review feedback references Linear's page directly ("the card spacing doesn't match what Linear does")
- A section is rejected because it "doesn't look enough like Linear" rather than because it has a craft quality gap

**Phase to address:**
Phase 1 (foundation). The craft quality rubric is written and agreed before any section is built. Every subsequent phase references the rubric, not the reference site.

---

### Pitfall 11: Scope Drift Into In-App Redesign or Brand System Rewrite

**What goes wrong:**
The landing milestone expands to include:
- Redesigning the in-app dashboard to match the landing aesthetic
- Rewriting the design token system for all routes
- Adding sub-pages (/about, /research, /manifesto) during the landing build
- Rebuilding the navbar used in both landing and app

This is explicitly how prior landing milestones collapsed. "Brand Statement Landing" (v3.0) was abandoned partly because the scope was broad enough to touch in-app surfaces. The current milestone's PROJECT.md explicitly calls out sub-pages and in-app surface redesigns as out of scope.

**Why it happens:**
The landing uses a different visual language than the dashboard (Linear-inspired craft quality reference vs. Raycast-extracted design system). When the landing looks noticeably better, there is natural pressure to "just update the dashboard to match while we're here." This is always more work than it looks.

**How to avoid:**
The landing route is completely self-contained. All changes are either:
a) Inside `app/(landing)/` (or equivalent route segment), or
b) New files/tokens scoped to the landing context class

No existing dashboard component is modified. No existing `@theme` token value is changed. The landing token layer is additive only. If a new component is needed that looks better than the existing system, it is a landing-only component — not a design system update.

Hard rule: no cross-route PR comment should say "and I also updated the dashboard to match." If that sentence appears, the scope has been violated.

**Warning signs:**
- Phase plan modifies a component used in both landing and dashboard routes
- "While I was here, I updated GlassPanel to..."
- A phase takes significantly longer than estimated because dashboard pages need updating too
- REQUIREMENTS.md grows to include items from the backlog deferred from prior milestones

**Phase to address:**
Every phase. The gate is: `git diff --name-only` for the phase should show only files under the landing route and landing-specific token/component paths. If it shows a dashboard route file, stop.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Applying `"use client"` to entire section components | Gets Framer Motion working fast | Every RSC benefit lost; larger bundle; hydration surface grows | Never — use MotionWrapper pattern instead |
| oklch for dark landing tokens | Less code, native Tailwind syntax | Compilation inaccuracy visible in Safari/prod; already burned us in the main DS | Never — hex for darks is established rule |
| Inline `backdrop-filter` class instead of style prop | Cleaner JSX | Silently stripped by Lightning CSS in production | Never — production breakage |
| `loading="lazy"` on hero image | Slightly smaller initial payload | LCP regression; hero appears blank until JS loads | Never for above-fold images |
| `font-display: swap` with raw CSS `@import` | Familiar syntax | CLS from font swap; bypasses next/font size-adjust | Never — use next/font |
| Skipping mobile Playwright snapshot | Faster phase completion | Mobile breaks ship without detection | Never — mobile gate is non-optional |
| Writing section proportions by eyeballing the reference site | Feels faster than deriving from Virtuna narrative | Composition reproduction pitfall; derivative-feel guaranteed | Never — section brief required first |
| Modifying an existing DS component "just a little" for the landing | Reuses existing work | Scope drift into in-app redesign; breakage of dashboard | Never — landing-only components only |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `motion.div` with `opacity: 0` initial on LCP element | LCP > 3s on mobile Lighthouse | Keep LCP element outside opacity animation wrappers | Any hero section with JS-driven entry animation |
| Scroll listener in `useEffect` updating non-composited CSS properties | Scroll jank, dropped frames | Use `IntersectionObserver` + CSS transitions only; or Framer Motion composited-only values | Any scroll-animated section with 3+ elements |
| Multiple `useScroll` instances on one page | Memory pressure, janky scroll | Single shared scroll context or CSS scroll-driven animations | Pages with 4+ scroll-animated sections |
| Animation library JS blocking initial render | FPS drop, delayed TTI | Lazy-import animation library behind `dynamic()` or import only in `useEffect` | Motion library loaded eagerly in RSC boundary |
| No `will-change` on animated elements | Composite layer not promoted, causes repaint | Add `will-change: transform` to elements with active scroll animations | Any element animating continuously during scroll |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Framer Motion + Next.js App Router | Wrapping RSC sections with `motion.*` directly | MotionWrapper pattern: thin `"use client"` component containing only the animated element |
| next/font + existing global font | Adding a second Inter import for landing-specific weights | Inherit the root layout's next/font setup; add weight variants to the existing font declaration |
| Playwright visual regression | Running snapshots only at 1280px | Three viewports minimum: 375px, 768px, 1280px — all three required per phase gate |
| Tailwind v4 `@theme` + route scoping | Defining landing tokens in `@theme` (global) | Scope to `.landing` class selector, not `@theme` |
| Vercel production build | Testing only in `next dev` | Verify backdrop-filter effects in `next build && next start` — Lightning CSS only runs in prod |

---

## "Looks Done But Isn't" Checklist

- [ ] **Hero section:** H1 or hero image verified as LCP candidate; Lighthouse mobile LCP < 2.5s confirmed; hero image has `priority` prop
- [ ] **All images:** Every `<Image>` has explicit `width` + `height` or `aspect-ratio` CSS; no `loading="lazy"` above the fold
- [ ] **Backdrop-filter effects:** Verified in production build (`next build && next start`), not only in dev server
- [ ] **Dark token values:** All tokens at L < 0.15 are hex, not oklch; verified by visual comparison in Safari and Chrome
- [ ] **Mobile:** Every section has been viewed at 375px in Safari iOS simulator or real device, not only Chrome DevTools
- [ ] **Animation accessibility:** `prefers-reduced-motion` media query tested — animations fall back gracefully
- [ ] **Hydration:** No console hydration errors on first load (test with browser extensions disabled)
- [ ] **Dashboard regression:** Playwright snapshot of a dashboard route run after each landing CSS/token change; no visual change
- [ ] **Scope boundary:** `git diff --name-only` shows only landing-route files and landing-specific component/token files
- [ ] **Section brief:** Every section has a written Virtuna-product-narrative rationale before markup begins
- [ ] **Craft rubric:** Phase reviewed against the quality rubric (typography, spacing, motion, mobile, polish) — not against the reference site
- [ ] **Tailwind v4 dev cache:** If CSS changes are not appearing, dev server has been killed, `.next/` and `node_modules/.cache/` cleared, browser cache cleared

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Derivative-feel identified after section ships | HIGH | Do not iterate on the same composition — revert to a blank slate and re-derive from Virtuna section brief; iteration on a cloned composition always produces a refined clone |
| Landing token leaked into dashboard | MEDIUM | Identify leaked token; move from `@theme` to `.landing`-scoped CSS; run dashboard regression suite |
| LCP regression from hero animation | LOW | Remove motion wrapper from LCP element; convert hero entry to CSS animation; re-run Lighthouse |
| backdrop-filter stripped in production | LOW | Replace all `backdrop-blur-*` class usages with `style={{ backdropFilter: '...' }}`; test in prod build |
| Scope drift: in-app component modified | HIGH | Revert in-app changes; create a landing-only copy of the component; do not re-merge the in-app change |
| Hydration mismatch from Framer Motion | LOW-MEDIUM | Identify motion component touching browser API during SSR; extract to MotionWrapper client component; verify with `next build` |
| Mobile breakdown discovered late | MEDIUM | Each section needs individual mobile audit and potentially separate mobile layout; cannot be batched at milestone end |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Craft reference bleeds into composition reproduction | Phase 1: Section briefs established | Every section has a written Virtuna product-narrative rationale before markup |
| oklch dark token compilation inaccuracy | Phase 1: Token layer | All dark tokens audited as hex; Safari + Chrome visual comparison |
| Lightning CSS strips backdrop-filter | Phase 1: Token/component foundation | Production build (`next build && next start`) runs before Phase 1 ships |
| LCP regression from hero animation | Hero section phase (Phase 2) | Lighthouse mobile LCP < 2.5s gate |
| CLS from images + font loading | Every section phase | Lighthouse CLS < 0.1 gate per section phase |
| Scroll jank from non-composited animations | Each animated section phase | Chrome DevTools Performance tab reviewed during scroll for that section |
| Framer Motion SSR hydration mismatch | Phase 1: MotionWrapper pattern established | No console hydration errors in `next build && next start` |
| Desktop-first mobile breakdown | Every section phase | Playwright 375px + 768px snapshots required per section |
| Landing token leakage into dashboard | Phase 1: Token scoping architecture | Dashboard Playwright snapshot after Phase 1 token layer ships |
| Visual fidelity gate as pixel-match obsession | Phase 1: Craft quality rubric written | Rubric reviewed and agreed before first section is built |
| Scope drift into in-app redesign | Every phase | `git diff --name-only` scoped to landing files only |
| Derivative-feel identified late | Phase 1: Section briefs | Ongoing: section brief review at start of each section phase |

---

## Sources

- This project's own milestone history: v3.0 Brand Statement Landing abandonment (2026-05-11), Landing Page Redesign worktree abandonment (2026-05-10), v1.1 societies.io clone reset — cited from `.planning/MILESTONES.md` and `.planning/PROJECT.md`
- This project's CLAUDE.md "Known Technical Issues": oklch inaccuracy, Lightning CSS backdrop-filter stripping, dev server CSS caching
- Tailwind v4 oklch browser compatibility: [GitHub discussion #16351](https://github.com/tailwindlabs/tailwindcss/issues/16351), [GitHub discussion #15356](https://github.com/tailwindlabs/tailwindcss/discussions/15356)
- Next.js hydration error documentation: [nextjs.org/docs/messages/react-hydration-error](https://nextjs.org/docs/messages/react-hydration-error)
- Framer Motion + Next.js App Router SSR pattern: [hemantasundaray.com](https://www.hemantasundaray.com/blog/use-framer-motion-with-nextjs-server-components)
- LCP from lazy-loaded hero images: [cloudfour.com](https://cloudfour.com/thinks/stop-lazy-loading-product-and-hero-images/), [debugbear.com](https://www.debugbear.com/blog/lazy-loading-performance)
- CLS from font-display swap: [sentry.io](https://blog.sentry.io/web-fonts-and-the-dreaded-cumulative-layout-shift/), [vercel.com](https://vercel.com/blog/nextjs-next-font)
- Core Web Vitals and animation: [ableneo.com](https://www.ableneo.com/insight/how-to-improve-core-web-vitals-lcp-inp-cls-in-modern-web-apps/), [digitalapplied.com](https://www.digitalapplied.com/blog/core-web-vitals-optimization-guide-2025)
- View Transitions API Next.js 15: [nextjs.org/docs/app/guides/view-transitions](https://nextjs.org/docs/app/guides/view-transitions)
- prefers-reduced-motion: [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion)
- Tailwind v4 token scoping: [GitHub discussion #16325](https://github.com/tailwindlabs/tailwindcss/discussions/16325)

---
*Pitfalls research for: Production SaaS landing page — Next.js 15 + Tailwind v4 + motion-heavy rebuild*
*Researched: 2026-05-19*
