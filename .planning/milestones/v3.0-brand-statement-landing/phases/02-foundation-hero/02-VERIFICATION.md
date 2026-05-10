---
phase: 02-foundation-hero
verified: 2026-05-10T23:48:00Z
status: human_needed
score: 5/5 must-haves verified (automated); 8 manual gates pending
overrides_applied: 0
human_verification:
  - test: "Hero renders correctly above fold at 1280px desktop"
    expected: "Visual hierarchy: pre-headline -> H1 -> sub-headline -> subline -> dual CTA stacked left; canvas right; coral gradient peak upper-center; '87%' chip overlays canvas convergence point"
    why_human: "Visual fidelity, gradient luminance, two-column proportions are subjective design judgment that grep cannot verify"
  - test: "Hero renders correctly in Safari at 1280x720"
    expected: "Visual parity with Chrome (font rendering, gradient, canvas, text-wrap balance support)"
    why_human: "Cross-browser visual consistency requires actual Safari render"
  - test: "Mobile hero at 375px (iPhone 14 emulation 390x844) stacks vertically with no horizontal scroll, CTAs >= 44px tap target"
    expected: "Canvas above text; no horizontal scroll; CTA buttons >= 44px; hierarchy preserved"
    why_human: "Layout reflow + touch-target sizing requires DevTools device emulation observation"
  - test: "Behavioral particle animation plays once and respects reduced-motion"
    expected: "DevTools Rendering panel -> Emulate prefers-reduced-motion: reduce -> reload -> canvas mounts directly into converged static state, chip still visible. Toggle off -> reload -> 2.2s drift+attract animation plays once"
    why_human: "Motion timing + reduced-motion toggle requires interactive DevTools manipulation"
  - test: "Module-level animation flag prevents replay on remount"
    expected: "Navigate to /dashboard, then back to / -> animation does NOT replay (canvas mounts directly into converged state)"
    why_human: "RSC boundary + module persistence is a runtime behavior across client-side navigation"
  - test: "Screen reader announces '87 percent' via DOM chip"
    expected: "VoiceOver (Cmd+F5 on Mac) -> arrow through hero -> SR announces 'Predicted audience response confidence: 87%' from chip aria-label, AND 'Audience particles aggregating into a confidence score of 87 percent' from canvas role=img"
    why_human: "Screen reader behavior requires actual VoiceOver / NVDA observation"
  - test: "Davide reviews + signs off on external component policy"
    expected: "02-EXTERNAL-COMPONENT-POLICY.md sign-off checkbox 'Davide reviewed policy' is checked; REJECT/ACCEPT criteria match brand restraint judgment"
    why_human: "Subjective design judgment review per VALIDATION.md threat T-2-11 mitigation"
  - test: "Davide reviews + signs off on rendered hero copy verbatim"
    expected: "Davide opens browser, confirms verbatim match against REQUIREMENTS.md HERO-01..05 (pre-headline, H1, sub-headline, subline, dual CTA labels)"
    why_human: "Final human gate per Phase 1 SC2 hand-off; verbatim copy compliance is a brand-spine commitment"
---

# Phase 02: Foundation & Hero Verification Report

**Phase Goal:** Page scaffold exists using the correct tech stack, external component sources are vetted, and the above-fold section (viewport 1) is built and visually correct
**Verified:** 2026-05-10T23:48:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

All 5 ROADMAP success criteria are verified at the codebase level. 8 manual gates remain (visual fidelity, reduced-motion behavior, screen reader announcement, Davide sign-off) — all expected per VALIDATION.md "Manual-Only Verifications" table.

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| SC1 | Landing page (`/`) renders full hero — pre-headline lockup, oversized H1, sub-headline, subline, dual CTA — against coral + Raycast neutral ambient gradient | VERIFIED | `src/app/(marketing)/page.tsx` line 16 renders `<BehavioralHero />` (resolves to `/` route, prerendered). `BehavioralHero.tsx` lines 85-134 render all 6 locked copy strings verbatim. `style={{ background: HERO_GRADIENT }}` line 77 applies the radial-gradient string from constants (`rgba(255,127,80,0.18) -> 0.10 -> 0.04 -> #07080a`). Build prerenders `/` route as static (`○ /` in build output). |
| SC2 | Behavioral-simulation animated visual (audience particles aggregating into a confidence score) is visible and respects reduced-motion | VERIFIED | `BehavioralCanvas.tsx` paints 250 desktop / 120 mobile particles via Canvas 2D (lines 159-180). Drift+attract motion via Brownian + attractor + damping (lines 209-244). Reduced-motion branch (lines 188-201) skips RAF and clusters particles around target with jitter `min(width,height)*0.12`. `usePrefersReducedMotion()` hook reused verbatim. Module flag `behavioralHeroAnimationComplete` (line 57) ensures one-shot per session. DOM chip overlay in `BehavioralHero.tsx` lines 151-169 renders at `top: 45%` (matches `PARTICLE_MOTION.targetOffsetY = -0.05`). Globals.css lines 298-306 gate scroll-behavior on prefers-reduced-motion media query. (Manual gate: actual DevTools toggle observation deferred to human verification.) |
| SC3 | Hero copy contains zero instances of "viral" or "AI" | VERIFIED | `grep -nE "viral|\\bAI\\b"` against the 3 hero source files returns ZERO matches. `pnpm lint:vocab` on `BehavioralHero.tsx`, `BehavioralCanvas.tsx`, `behavioral-hero-constants.ts` returns `0 error(s), 0 warning(s)`. Pre-existing 57-error baseline (legacy hero-section, faq-section, stats-section, etc.) is owned by Plan 06 BUILD-09 per `deferred-items.md`. |
| SC4 | Mobile hero at 375px stacks vertically with hierarchy preserved and simulation scales or simplifies gracefully | VERIFIED | `BehavioralHero.tsx` line 80 uses `flex flex-col-reverse lg:flex-row` — on mobile (<lg/1024px) canvas stacks ABOVE text via flex-col-reverse. Canvas wrapper line 140 uses `aspect-square lg:aspect-auto lg:h-[520px]` so it scales by viewport on mobile. `BehavioralCanvas.tsx` line 159 detects `width < 640` and switches to 120 particles + `mobileScale: 0.85` size multiplier + `brownianSigmaMobile: 6`. (Manual gate: actual 375/390px viewport rendering deferred to human verification.) |
| SC5 | Rejection criteria for any Magic UI / Aceternity / Origin UI / Cult UI component imports are documented and applied | VERIFIED | `02-EXTERNAL-COMPONENT-POLICY.md` exists with 6 REJECT criteria rows (R1-R6) and 7 ACCEPT criteria rows (A1-A7). All 4 libraries (Magic UI, Aceternity, Origin UI, Cult UI) are inventoried with site URLs, what they ship, and Raycast-fit assessment. ZERO-imports policy is explicitly stated for Phase 2 with 7 closed allowed sources. `BRAND-BIBLE.md` line 358 carries blockquote cross-reference linking to the policy. `grep -rE "from ['\"]?(@magicui\|magic-ui\|@aceternity-ui\|aceternity-ui\|@cult-ui\|cult-ui\|@origin-ui\|origin-ui)" src/` returns ZERO matches — applied. (Manual gate: Davide policy sign-off pending per VALIDATION.md threat T-2-11.) |

**Score:** 5/5 truths verified at the codebase level. 8 manual gates required to complete phase verification.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/components/landing/BehavioralHero.tsx` | Server-rendered hero composition with all 6 locked copy strings, gradient, canvas, DOM chip | VERIFIED | 175 LOC, NO `'use client'` directive (server component confirmed). Imports: `next/link`, `@/components/ui` (Button), `@/lib/utils` (cn), `./BehavioralCanvas`, `./behavioral-hero-constants`. All 6 copy strings present at lines 85, 99, 101, 112, 123, 130, 133. Wires BehavioralCanvas, HERO_GRADIENT, CONFIDENCE_CHIP. DOM chip with role="status" + aria-live="off" + aria-label. |
| `src/components/landing/BehavioralCanvas.tsx` | Client component canvas with one-shot drift+attract, reduced-motion branch, module flag | VERIFIED | 260 LOC, `'use client'` at line 1. Reuses useCanvasResize + usePrefersReducedMotion verbatim. Module-level `behavioralHeroAnimationComplete` flag (line 57, file-scoped, not exported). NO `fillText`/`strokeText` calls. role="img" + aria-label "Audience particles aggregating into a confidence score of 87 percent". Mobile detection at width<640 (line 159). |
| `src/components/landing/behavioral-hero-constants.ts` | All 7 named exports + easeOutCubic | VERIFIED | 165 LOC. Exports: PARTICLE_COUNTS (desktop=250, mobile=120), PARTICLE_SIZES, PARTICLE_COLORS (coral=#FF7F50), PARTICLE_MOTION (durationMs=2200, targetOffsetY=-0.05), CONFIDENCE_CHIP (percentage=87, label="87%"), HERO_GRADIENT (exact radial-gradient string), easeOutCubic = `1 - Math.pow(1 - t, 3)`. All `as const`. |
| `src/components/landing/__tests__/behavioral-hero-constants.test.ts` | Vitest invariant suite (4 tests) | VERIFIED | 38 LOC, 4 `it()` blocks. All 4 tests PASS in 1ms: mobile<desktop, percentage in [80,95], duration in [2000,2400]ms, easeOutCubic boundaries (0→0, 1→1, 0.5≈0.875). |
| `src/app/(marketing)/page.tsx` | Landing page imports BehavioralHero (resolves to `/` route) | VERIFIED | 27 LOC. Imports BehavioralHero from `@/components/landing` (line 2), renders `<BehavioralHero />` at line 16. All 6 other landing sections (Backers, Features, Stats, CaseStudy, Partnership, FAQ) preserved in original order. Build prerenders `/` as static (○). Note: ROADMAP SC1 references `src/app/page.tsx`; the actual file uses Next.js route group `(marketing)/page.tsx` which resolves to `/` — same destination URL, naming convention difference. |
| `src/components/landing/index.ts` | Barrel exports BehavioralHero, no HeroSection | VERIFIED | 14 LOC. Line 1: `export { BehavioralHero } from "./BehavioralHero"`. NO `HeroSection` export. All other exports (BackersSection, CaseStudySection, ComparisonChart, FAQSection, FeatureCard, FeaturesSection, PartnershipSection, PersonaCard, StatsSection, TestimonialQuote) preserved. |
| `src/app/globals.css` | scroll-behavior smooth + reduced-motion fallback | VERIFIED | Lines 298-306. `html { scroll-behavior: smooth; }` then `@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }`. Existing `html, body` block at 288-296 untouched. |
| `src/components/landing/hero-section.tsx` | DELETED (legacy plagiarized) | VERIFIED | File absent. `grep -r "hero-section\|HeroSection" src/` returns zero matches. `persona-card.tsx` retained as planned. |
| `.planning/phases/02-foundation-hero/02-EXTERNAL-COMPONENT-POLICY.md` | BUILD-02 policy artifact with REJECT/ACCEPT matrix | VERIFIED | 97 LOC. 6 REJECT rows (R1-R6) per `grep -c "^| R[0-9]"`. 7 ACCEPT rows (A1-A7) per `grep -c "^| A[0-9]"`. All 4 libraries inventoried (Magic UI, Aceternity, Origin UI, Cult UI). ZERO-imports policy stated explicitly with 7 closed allowed sources. Sign-off checkboxes at end. |
| `BRAND-BIBLE.md` | §Visual Metaphor Lock cross-references policy doc | VERIFIED | Line 358 contains blockquote: `> Phase 2 lock — see [external component policy](.planning/phases/02-foundation-hero/02-EXTERNAL-COMPONENT-POLICY.md)...`. §Visual Metaphor Lock heading at line 354 still present. PROJECT.md NOT modified (orchestrator decision #5 honored). |
| `src/components/ui/button.tsx` | Slot SSR fix for asChild + non-asChild branches | VERIFIED | Line 157 sets `Comp = asChild ? Slot : "button"`. Lines 174-186 split body: `asChild ? children : <>{loading && <Loader2/>}{children}</>`. Documentation comment at lines 160-164 explains the fix. Other asChild consumers verified intact: `pricing-section.tsx` (line 62), `cta-section.tsx` (line 18) — both pass single React element child to Button asChild Slot. Dialog asChild consumers (DialogTrigger/DialogClose) use Radix Dialog's own Slot, unrelated. Build prerenders all 55 pages cleanly. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `src/app/(marketing)/page.tsx` | `src/components/landing/BehavioralHero.tsx` | barrel import `@/components/landing` | WIRED | Import line 2-9 destructures BehavioralHero; JSX line 16 renders it |
| `src/components/landing/BehavioralHero.tsx` | `src/components/landing/BehavioralCanvas.tsx` | named import + JSX render | WIRED | Line 38 imports; line 141 renders `<BehavioralCanvas className="w-full h-full" />` |
| `src/components/landing/BehavioralHero.tsx` | `src/components/landing/behavioral-hero-constants` | named imports of HERO_GRADIENT, CONFIDENCE_CHIP, PARTICLE_MOTION | WIRED | Lines 39-43 import; line 77 applies HERO_GRADIENT inline; lines 154-168 use CONFIDENCE_CHIP fields; line 57 uses PARTICLE_MOTION.targetOffsetY |
| `src/components/landing/BehavioralCanvas.tsx` | `src/components/hive/use-canvas-resize` | hook reuse | WIRED | Line 37 imports; line 152 calls `useCanvasResize(canvasRef, render)` |
| `src/components/landing/BehavioralCanvas.tsx` | `src/hooks/usePrefersReducedMotion` | hook reuse | WIRED | Line 38 imports; line 104 calls `usePrefersReducedMotion()` |
| Primary CTA `<Link>` | `/dashboard` (middleware-controlled auth redirect) | next/link | WIRED | Line 130: `<Link href="/dashboard">Run a prediction →</Link>` inside `<Button asChild variant="primary" size="lg">`. Middleware in `src/lib/supabase/middleware.ts` handles auth redirect (existing functionality, not modified by Phase 2). |
| Secondary CTA `<Link>` | `#science` (Phase 4 target) | next/link | WIRED (forward-compat) | Line 133: `<Link href="#science">See the science</Link>`. `#science` anchor target ships in Phase 4 SCI-01..06; until then click is a no-op smooth-scroll, which is the documented forward-compatible behavior per CONTEXT.md D-28 + orchestrator decision #3. |
| `html` element CSS selector | smooth-scroll behavior with reduced-motion override | globals.css | WIRED | Lines 298-306. The `#science` anchor scroll resolves automatically when Phase 4 lands; no Phase 2 follow-up required. |
| `BRAND-BIBLE.md §Visual Metaphor Lock` | `.planning/phases/02-foundation-hero/02-EXTERNAL-COMPONENT-POLICY.md` | markdown link | WIRED | Line 358 blockquote link |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| BehavioralHero (chip overlay) | CONFIDENCE_CHIP.label = "87%" | `behavioral-hero-constants.ts:117-128` (compile-time const) | YES | FLOWING — hardcoded marketing illustration per CONTEXT.md D-34. Not "fake data" — explicitly intended visual asset; constants file is the single source of truth |
| BehavioralHero (gradient backdrop) | HERO_GRADIENT string | `behavioral-hero-constants.ts:145` (compile-time const) | YES | FLOWING — exact radial-gradient string consumed at line 77 inline style |
| BehavioralCanvas (particles array) | particlesRef.current | useEffect Array.from initialization based on PARTICLE_COUNTS, PARTICLE_COLORS, PARTICLE_SIZES, PARTICLE_MOTION | YES | FLOWING — particles initialized with uniform random positions, color split 70/30, size from min/max range. Animated each RAF frame via Brownian + attractor + damping equations. Reduced-motion branch directly clusters around target. |
| BehavioralCanvas (canvas size) | sizeRef.current (width/height/dpr) | useCanvasResize hook (verbatim reuse from hive) | YES | FLOWING — ResizeObserver + DPR aware, populates sizeRef on mount + resize |

All artifacts that render dynamic data trace to real, populated data sources — no hollow props, no static fallbacks masquerading as live data, no empty arrays.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Build compiles cleanly with all 4 plans landed | `pnpm build` | "✓ Compiled successfully in 6.6s" + "✓ Generating static pages using 9 workers (55/55) in 262.4ms" | PASS |
| `/` route prerendered as static | `pnpm build` route table | `○ /` (static prerender symbol) | PASS |
| Vitest hero invariant suite passes | `vitest run src/components/landing/__tests__/behavioral-hero-constants.test.ts` | "Test Files 1 passed (1) | Tests 4 passed (4)" | PASS |
| Vocab lint clean on hero files | `node scripts/lint-vocab.mjs src/components/landing/BehavioralHero.tsx src/components/landing/BehavioralCanvas.tsx src/components/landing/behavioral-hero-constants.ts` | "0 error(s), 0 warning(s)" | PASS |
| No "viral" or "AI" in hero source files | `grep -nE "viral\|\\bAI\\b" hero/canvas/constants` | zero matches | PASS |
| No external library imports in src/ | `grep -rE "from .magicui\|magic-ui\|aceternity\|cult-ui\|origin-ui." src/` | zero matches | PASS |
| Legacy `hero-section.tsx` is deleted with no dangling refs | `grep -r "hero-section\|HeroSection" src/` | zero matches | PASS |
| Other landing sections preserved in barrel + page | `grep -E "BackersSection\|FeaturesSection\|StatsSection\|CaseStudySection\|PartnershipSection\|FAQSection" page.tsx index.ts` | all 6 sections still imported + rendered + exported | PASS |
| Server component invariant (no `'use client'` in BehavioralHero) | `grep -nE "use client" src/components/landing/BehavioralHero.tsx` | zero matches | PASS |
| Module-level animation flag isolated | `grep -nE "behavioralHeroAnimationComplete\|globalAnimationComplete" BehavioralCanvas.tsx` | only `behavioralHeroAnimationComplete` (file-scoped, line 57); zero `globalAnimationComplete` redeclaration | PASS |

**Note on full test suite:** `pnpm test` reports 219 passed / 2 failed (out of 221). The 2 failures are in `src/lib/engine/__tests__/cost-benchmark.test.ts` and `src/lib/engine/__tests__/video-e2e.test.ts` due to missing test fixture file `ssstik.io_@agentoflaughter_1771597963788.mp4` — pre-existing baseline failures NOT introduced by Phase 2, NOT in any Phase 2 plan's `<files_modified>` scope, explicitly called out in the verification task brief as "not introduced by this phase".

### Requirements Coverage

All 12 phase requirement IDs are accounted for across the 4 plans, and each has implementation evidence in the codebase.

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| BUILD-01 | 02-01 | Built from scratch on shadcn primitives + Tailwind v4 + existing 36-component design system | SATISFIED | `BehavioralHero.tsx` uses only `next/link` + existing `@/components/ui` Button + `@/lib/utils` cn + locally created BehavioralCanvas/constants. No external library imports. Scaffold (page.tsx swap + barrel update + globals.css scroll-behavior) all in place. |
| BUILD-02 | 02-03 | External component imports vetted; rejection criteria documented | SATISFIED | `02-EXTERNAL-COMPONENT-POLICY.md` exists with 6 REJECT + 7 ACCEPT criteria; ZERO-imports policy applied (verified by grep against src/). BRAND-BIBLE cross-reference at line 358. (Manual gate: Davide sign-off pending per VALIDATION.md.) |
| HERO-01 | 02-04 | Pre-headline lockup `VIRTUNA · A NUMEN MACHINES PRODUCT` rendered small monospaced uppercase | SATISFIED | `BehavioralHero.tsx:84` uses `font-mono text-xs uppercase tracking-[0.18em] text-foreground/60` for the line `VIRTUNA &middot; A NUMEN MACHINES PRODUCT` |
| HERO-02 | 02-04 | H1 oversized, light weight, Inter, with two-line break preserved | SATISFIED | `BehavioralHero.tsx:89-102` uses `font-light` + `clamp(2.75rem, 6.5vw, 5rem)` + `lineHeight: 1.05` + `letterSpacing: -0.02em` + `textWrap: balance` + `maxWidth: 14ch` + explicit `<br />` for the locked two-line break |
| HERO-03 | 02-04 | Sub-headline medium weight, distinct hierarchy from H1 | SATISFIED | `BehavioralHero.tsx:105-113` uses `font-medium` + `clamp(1.25rem, 2.2vw, 1.5rem)` + `lineHeight: 1.35` |
| HERO-04 | 02-04 | Subline carries behavioral-research moat language without "viral" or "AI" | SATISFIED | `BehavioralHero.tsx:116-124` renders "Trained on decades of behavioral research. Self-improving with every outcome." with `font-normal text-foreground/70` + `clamp(1rem, 1.4vw, 1.125rem)`. Vocab lint confirms zero banned terms in the file. |
| HERO-05 | 02-04 | Dual CTA — primary `Run a prediction →` (auth-gated) + secondary `See the science` (Science section) | SATISFIED | `BehavioralHero.tsx:128-135`. Primary `<Link href="/dashboard">` inside `<Button asChild variant="primary" size="lg">`. Secondary `<Link href="#science">` inside `<Button asChild variant="secondary" size="lg">`. Smooth-scroll fallback in globals.css. Forward-compat anchor — Phase 4 lands the target. |
| HERO-06 | 02-02 + 02-04 | Behavioral-simulation visual — animated audience-particles aggregating into a confidence score | SATISFIED | `BehavioralCanvas.tsx` renders 250/120 particles with drift+attract motion converging to upper-center target. `BehavioralHero.tsx` lines 151-169 overlays a DOM chip displaying CONFIDENCE_CHIP.label = "87%" at the convergence point (top: 45%). Reduced-motion branch produces a static converged keyframe. Vitest invariant suite asserts percentage range, animation duration, and easing. |
| HERO-07 | 02-02 + 02-04 | Ambient gradient backdrop using coral #FF7F50 + Raycast neutral, subtle, respects reduced-motion | SATISFIED | `behavioral-hero-constants.ts:145` defines HERO_GRADIENT as exact radial-gradient with coral alpha 0.18 → 0.10 → 0.04 → #07080a stops. Applied via inline `style={{ background: HERO_GRADIENT }}` in `BehavioralHero.tsx:77`. Static gradient (no animation) — inherently reduced-motion safe. |
| HERO-08 | 02-02 | Mobile hero stacks vertically with hierarchy preserved; behavioral simulation scales gracefully under 640px | SATISFIED | `BehavioralHero.tsx:80,140` use `flex-col-reverse lg:flex-row` (mobile stacks canvas above text) + `aspect-square lg:aspect-auto`. `BehavioralCanvas.tsx:159-164` switches to 120 particles + `mobileScale: 0.85` + reduced Brownian sigma at width<640px. (Manual gate: 375/390px viewport visual confirmation deferred to human verification.) |
| HERO-09 | 02-04 | Above-fold passes reference-fidelity audit against Anthropic / Linear / Vercel / Raycast | NEEDS HUMAN | Final $100M+ reference-fidelity audit is explicitly Phase 6 scope (BUILD-07). Phase 2 implementation honors all locked design specs (Inter weights, clamp() values, restraint-style gradient, single client island, DOM-accessible chip). Subjective design judgment review pending Davide. |
| HERO-10 | 02-02 + 02-04 | Hero copy contains zero "viral" or "AI" terms (vocab guardrail) | SATISFIED | All 3 hero source files (BehavioralHero, BehavioralCanvas, behavioral-hero-constants) pass `pnpm lint:vocab` clean (0 errors / 0 warnings). Direct grep confirms zero matches. Pre-commit hook + lint script enforce the guardrail. |

**Coverage:** 12/12 requirement IDs are accounted for in plan frontmatter. 11 SATISFIED at the codebase level; 1 NEEDS HUMAN (HERO-09 reference-fidelity audit, explicitly Phase 6 scope).

**No orphaned requirements:** REQUIREMENTS.md Traceability table maps Phase 2 to exactly BUILD-01, BUILD-02, HERO-01..10 (12 IDs). All 12 appear in Phase 2 plan frontmatter; the 02-04-SUMMARY closeout table maps each to a specific plan.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none in Phase 2 source files) | - | - | - | No TODO/FIXME/PLACEHOLDER comments, no empty handlers, no hardcoded empty data masquerading as live, no console.log-only implementations, no stub returns in any of the 3 new hero files or the 5 modified files |

**Pre-existing baseline (out of scope):**
- `src/components/landing/cta-section.tsx:11` — contains "viral" ("Ready to predict your next viral hit?"). NOT imported in landing page (per `grep` of `(marketing)/page.tsx`). Owned by Plan 06 BUILD-09 per `deferred-items.md`.
- 57 vocab-lint errors / 3 warnings in baseline files (legacy hero-section was deleted; faq-section, stats-section, comparison-chart, social-proof-section, opengraph-image, onboarding/{goal,preview}-step). All pre-date Phase 2 baseline commit `e0fd76d`. Owned by Phase 6 BUILD-09.
- Marketing layout metadata (`src/app/(marketing)/layout.tsx:13-16`) still has "Artificial Societies | Human Behavior, Simulated" title and "AI personas..." description — not in Phase 2 hero scope; owned by Phase 6 BUILD-09 surface-by-surface plagiarism cleanup. Phase 2 boundary is explicit per CONTEXT.md: only the hero composition + canvas + constants + policy doc are in scope.

These pre-existing violations DO NOT affect Phase 2 goal achievement — the goal is "above-fold hero is built and visually correct" and "rejection criteria documented and applied for external imports". The pre-existing copy elsewhere is the explicit scope of Phase 6.

### Human Verification Required

8 manual gates from VALIDATION.md "Manual-Only Verifications" remain. These are NOT failures — all are defined in the plan as automated-verification-impossible behaviors. Status is `human_needed` per the verification decision tree.

#### 1. Hero renders correctly above fold at 1280px desktop (Chrome)

**Test:** `pnpm dev`, open Chrome at 1280×720, screenshot the hero.
**Expected:** Visual hierarchy: pre-headline → H1 → sub-headline → subline → dual CTA stacked left; canvas right; coral gradient bloom upper-center; "87%" chip overlays canvas convergence point.
**Why human:** Visual fidelity, gradient luminance, two-column proportions are subjective design judgment that grep cannot verify.

#### 2. Visual parity in Safari at 1280×720

**Test:** Same screenshot at 1280×720 in Safari.
**Expected:** Visual parity with Chrome — font rendering, gradient, canvas, text-wrap balance fallback to `<br />`.
**Why human:** Cross-browser visual consistency requires actual Safari render.

#### 3. Mobile hero at 375/390px stacks vertically

**Test:** Chrome DevTools device emulation iPhone 14 (390×844).
**Expected:** Canvas above text; no horizontal scroll; CTA buttons ≥ 44px tap target; hierarchy preserved.
**Why human:** Layout reflow + touch-target sizing requires DevTools device emulation observation.

#### 4. Behavioral particle animation plays once and respects reduced-motion

**Test:** DevTools Rendering panel → Emulate `prefers-reduced-motion: reduce` → reload. Toggle off → reload.
**Expected:** With reduced-motion ON, canvas mounts directly into converged static state with chip still visible. With reduced-motion OFF, 2.2s drift+attract animation plays once.
**Why human:** Motion timing + reduced-motion toggle requires interactive DevTools manipulation.

#### 5. Module-level animation flag prevents replay on remount

**Test:** Navigate to `/dashboard` (will redirect via middleware), then back to `/`.
**Expected:** Animation does NOT replay — canvas mounts directly into converged state.
**Why human:** RSC boundary + module persistence is a runtime behavior across client-side navigation.

#### 6. Screen reader announces "87 percent" via DOM chip

**Test:** VoiceOver (Cmd+F5 on Mac) → arrow through hero.
**Expected:** SR announces "Predicted audience response confidence: 87%" from chip aria-label, AND "Audience particles aggregating into a confidence score of 87 percent" from canvas role=img.
**Why human:** Screen reader behavior requires actual VoiceOver / NVDA observation.

#### 7. External component policy sign-off

**Test:** Davide reads `02-EXTERNAL-COMPONENT-POLICY.md` and ticks the "Davide reviewed policy" checkbox.
**Expected:** REJECT/ACCEPT criteria match brand restraint judgment.
**Why human:** Subjective design judgment review per VALIDATION.md threat T-2-11 mitigation.

#### 8. Hero copy verbatim sign-off

**Test:** Davide opens browser, reads rendered hero copy.
**Expected:** Verbatim match against REQUIREMENTS.md HERO-01..05.
**Why human:** Final human gate per Phase 1 SC2 hand-off; verbatim copy compliance is a brand-spine commitment.

### Gaps Summary

**No gaps blocking Phase 2 goal achievement at the codebase level.** All 5 ROADMAP success criteria are verifiable in the source code, all 11 of 12 requirements are SATISFIED with implementation evidence (the 12th — HERO-09 reference-fidelity audit — is explicitly Phase 6 scope and rightly deferred to human review). All key links are wired. All artifacts are substantive and data flows through them. Build is clean (55/55 prerender). Targeted Vitest passes (4/4). Vocab lint clean on the 3 new hero source files. Zero external library imports applied across `src/`.

**Status is `human_needed`** because 8 manual gates from VALIDATION.md "Manual-Only Verifications" remain — visual hierarchy review, cross-browser parity, mobile viewport check, reduced-motion observation, navigation persistence behavior, screen reader announcement, and two Davide sign-off checkboxes (policy + copy). These are intentional non-automatable gates per the phase's validation strategy, NOT artifacts of incomplete implementation.

**Notable deviation (handled correctly):** Plan 02-04 made a Rule 1/Rule 3 auto-fix to `src/components/ui/button.tsx` — a file outside its declared `<files_modified>` scope. The fix splits the asChild render path so Radix Slot receives a single React element child (skipping the `{loading && <Loader2/>}` fragment in asChild mode) and resolves a latent SSR prerender crash that surfaced when `BehavioralHero` became the first asChild prerendered consumer of Button. The fix is sound: it only changes the asChild branch, preserves all non-asChild loading behavior, and `pricing-section.tsx` + `cta-section.tsx` (the other two `<Button asChild>` consumers in the codebase) continue to work — both pass a single `<Link>` child. Build prerenders all 55 pages cleanly. The deviation is documented in 02-04-SUMMARY.md per the deviation-rules protocol.

**Pre-existing baseline issues (out of scope):** `pnpm lint:vocab` reports 57 baseline errors in legacy files (cta-section, faq-section, stats-section, comparison-chart, social-proof-section, opengraph-image, onboarding/{goal,preview}-step) and the marketing layout metadata still references "Artificial Societies"/"AI personas". All pre-date Phase 2 baseline commit `e0fd76d` and are explicitly owned by Phase 6 BUILD-09 ("Replace plagiarized Artificial Societies copy across all surfaces") per `deferred-items.md`. Phase 2 contributed ZERO new violations and explicitly does NOT scope these (CONTEXT.md domain boundary is hero composition + policy doc only). The 2 failing engine tests (cost-benchmark, video-e2e) are missing-fixture failures unrelated to Phase 2 changes, called out in the verification task brief.

---

*Verified: 2026-05-10T23:48:00Z*
*Verifier: Claude (gsd-verifier)*
