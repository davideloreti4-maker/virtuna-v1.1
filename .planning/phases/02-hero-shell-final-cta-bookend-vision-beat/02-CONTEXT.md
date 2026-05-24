# Phase 2: Hero Shell + Final CTA Bookend + Vision Beat - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers three coordinated content surfaces on `/v3`:

1. **Hero shell** — above-fold H1 (with WordRotate audience cycling) + sub-headline + dual CTA + coral-tinted Aceternity Spotlight backdrop + Magic UI ShimmerButton/AnimatedShinyText/BorderBeam. **No Spline 3D scene** (Phase 3). **No above-fold logo bar / "Backed by..." microcopy** (Phase 3).
2. **Final CTA bookend** — page-end section that visually + verbally mirrors the Hero (same Spotlight + ShimmerButton + AnimatedShinyText), followed by a 4-column footer including a Numen Machines product lockup and Sign-in link.
3. **Vision Beat** — 1-2 sentence founder quote rendered between the Pricing slot and the Final CTA section, attributed plain-text to "Davide Loreti, Founder, Virtuna".

REQ-IDs in scope: HERO-01, HERO-02, HERO-03, HERO-04, HERO-06, HERO-07, HERO-08, HERO-09, HERO-11, CTA-01, CTA-02, CTA-03, CTA-04, CTA-05, CTA-06, VISION-01, MOTION-01, MOTION-02, MOTION-03.

Out of scope (Phase 3): HERO-05 (Spline scene), HERO-10 (above-fold logo bar + "Backed by..." microcopy).

</domain>

<decisions>
## Implementation Decisions

### Hero Copy (working draft — words editable through Phase 11 polish, position locked)

- **D-01: H1 outcome-pattern avoids the "AI that..." prefix.** Locked draft: `Predict viral for [WordRotate] before you post.` — WordRotate primitive is **fused inside the H1** as a single rotating word position, not on a second line.
- **D-02: WordRotate cycle set** — `creators / brands / founders`. Reason: covers primary creator audience + brand-manager expansion + investor-resonant "founders" signal. ROADMAP's original "agencies" replaced with "founders" intentionally (less enterprise-slow, dual-purpose).
- **D-03: Sub-headline** — `Stop guessing what'll hit. Score, refine, ship — in 30 seconds.` Two-line risk-killer + time signal fused. (Working draft.)
- **D-04: Copy lock posture** — Phase 2 ships with the above strings; copy remains iterable through Phase 11 polish before cutover. **Position, structure, and component bindings are locked** — only the exact words may change.

### CTA Strategy

- **D-05: Primary CTA label** — `Score your first TikTok` (verb + object + ownership, OpusClip-pattern). Implemented as Magic UI `ShimmerButton`.
- **D-06: Primary CTA destination** — `#demo` anchor (smooth-scroll to Phase 4 scripted demo). HERO-03 allows `#demo` OR `/signup`; we chose `#demo` to let visitors see value before any signup ask.
- **D-07: Secondary CTA label + destination** — `See pricing` → `#pricing`. HERO-03 default kept.
- **D-08: Final CTA copy strategy** — **Verbatim mirror** of Hero (same H1 + same sub-head + same dual buttons). CTA-02 allows verbatim or paraphrase; verbatim chosen for strongest bookend symmetry and zero risk of introducing drift positioning at page end.
- **D-09: Phase 1 scaffold-header CTA replacement** — the Phase 1 placeholder "Sign up" button in `LandingHeader.tsx` is **NOT** changed in Phase 2. Phase 1 UI-SPEC explicitly tagged that label as scaffold; Phase 2 locks Hero/Final CTA copy without touching the header. Header CTA copy gets a separate decision before cutover (Phase 11).

### Vision Beat

- **D-10: Quote angle** — **Behavioral-science thesis** (investor-resonant, leans on the differentiator from PROJECT.md). Locked draft:
  > "Virality isn't luck — it's a behavioral signal. We built Virtuna to surface that signal before you bet on the post."
- **D-11: Container** — Raycast `GlassPanel` card (137deg gradient, 5px blur, 12px radius, 6% border). **NOT** a plain centered pull-quote and **NOT** a bordered card. The GlassPanel choice adds investor-grade visual weight to the founder voice without breaking Raycast restraint.
- **D-12: Attribution treatment** — Plain text below quote: `— Davide Loreti, Founder, Virtuna`. **No photo**, no signature image, no role chip / coral underline. Matches REQ VISION-01 ("no photo required for v1").

### Footer Architecture

- **D-13: Column structure** — Standard 4-column SaaS layout: **Product / Company / Legal / Social**. Server-rendered, no client JS (CTA-03).
- **D-14: Stub-route strategy** — Routes that don't exist yet:
  - `/privacy` and `/terms` — **real minimal Next.js placeholder pages** must be created in this phase (single H1 + "Coming soon" body + canonical link). Reason: legal page-existence is a basic investor-credibility signal; missing legal pages look unfinished in due-diligence review.
  - `/about`, `/careers`, `/blog` — `href="#"` with `aria-disabled="true"` on each anchor, plus `tabIndex={-1}` to keep them out of tab order while visible.
- **D-15: Social platforms** — Four platforms: **X, LinkedIn, TikTok, Instagram**. Icons via `lucide-react` (already present per Phase 1 UI-SPEC).
- **D-16: Numen Machines lockup placement** — **Bottom strip, full-width** below the 4 columns. Centered horizontal lockup + "A Numen Machines product" microcopy. **Asset note**: REQUIREMENTS.md content-gate table only blocks Phase 9 on the SVG lockup; for Phase 2 a text-only lockup ("**A Numen Machines product**") is acceptable. If the SVG lockup is available by plan time, the planner should use it instead of text.

### Claude's Discretion

- **Spotlight position + intensity** — single-stop coral alpha gradient (MOTION-03) is locked, but exact origin point and opacity stops are planner/executor discretion. Recommended starting point: Aceternity default top-right, ~0.15 alpha at coral-500.
- **Hero vertical rhythm at 375px mobile without Phase 3 credibility hook** — Phase 3 will add the logo bar + "Backed by..." microcopy between H1 and Spline scene. For Phase 2, the planner decides whether to compress vertically or reserve a placeholder spacer. Recommendation: reserve a `min-h-[64px]` gap between sub-head and CTAs so Phase 3 can drop the credibility hook in without re-flowing.
- **BorderBeam timing** — Aceternity BorderBeam loop duration/easing is executor discretion; honor `motionTokens.ts` `triggerOnce: true` and the BRAND-BIBLE VIZ-02 single-pulse rule.
- **WordRotate timing** — interval between word swaps, easing curve, and reduced-motion fallback (static single word) all defer to planner using `motionTokens.ts` constants.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone + project anchors
- `.planning/PROJECT.md` — brand identity, audience priorities (creators + investors equal), coral #FF7F50 brand color, behavioral-science differentiator
- `.planning/MILESTONE.md` — Landing v1 worktree scope, 7-8 section structure, 11-phase cap
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, depends-on (Phase 1), bookend pattern lock
- `.planning/REQUIREMENTS.md` — 19 REQ-IDs in scope (HERO-01..04, 06..09, 11; CTA-01..06; VISION-01; MOTION-01..03)

### Phase 1 artifacts (carry-forward — already implemented)
- `.planning/phases/01-foundation-scaffold/01-UI-SPEC.md` — design system (shadcn new-york + slate + cssVariables), spacing/typography/color tokens, MotionConfig root contract, framer-motion alias, motionTokens contract, Raycast Tailwind v4 guardrails, registry safety table, pre-install collision checks
- `.planning/phases/01-foundation-scaffold/01-VERIFICATION.md` — Phase 1 acceptance + what's already shipped
- `.planning/phases/01-foundation-scaffold/01-01-SUMMARY.md` through `01-05-SUMMARY.md` — per-plan dependency graphs, key files created, pitfalls

### Codebase research maps
- `.planning/codebase/STACK.md` — Next.js 16, React 19, Tailwind v4, motion@12.29 via alias
- `.planning/codebase/ARCHITECTURE.md` — route structure, server/client split, file conventions
- `.planning/codebase/STRUCTURE.md` — file inventory + naming
- `.planning/codebase/INTEGRATIONS.md` — Supabase, Vercel Analytics, external deps

### Brand + design language
- `BRAND-BIBLE.md` (repo root) — coral brand color, Raycast aesthetic anchor, VIZ-02 single-pulse rule
- `CLAUDE.md` (repo root) — Raycast design-language rules verified 2026-02-08 (6% borders, 10% hover, 12px card radius, GlassPanel contract: zero-config 4-prop component with 5px blur + 12px radius + Raycast 137deg gradient — used by Vision Beat per D-11)

### Existing source files Phase 2 will touch or read
- `src/app/(marketing)/v3/page.tsx` — Phase 1 root assembly; Phase 2 replaces the Hero `<SectionShell>` and Final CTA `<SectionShell>` placeholders with real components; inserts new Vision Beat section before `<SectionShell id="final-cta">`
- `src/app/(marketing)/_components/LandingHeader.tsx` — Phase 1 header; **NOT modified in Phase 2** per D-09
- `src/app/(marketing)/_components/SectionShell.tsx` — Phase 1 placeholder wrapper; Hero + Final CTA placeholders **replaced** with dedicated Hero/FinalCta components; Vision Beat may use a new dedicated wrapper or extend SectionShell
- `src/app/(marketing)/motionTokens.ts` — single source for animation durations/easings/staggers (POLISH-07)
- `src/app/(marketing)/v3/MotionRoot.tsx` — MotionConfig client island
- `src/components/ui/marquee.tsx` — **EXISTS** (Phase 1 collision check); NOT consumed in Phase 2 — listed only so Magic UI Marquee install in Phase 9 doesn't trip on it
- `src/app/globals.css` — `@theme` block (spacing, typography, color tokens — Phase 2 consumes, does NOT extend)
- `package.json` (`pnpm.overrides`) — `framer-motion: npm:motion@^12.29.2` alias; all imports MUST be `motion/react`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`SectionShell.tsx`** — wrapper with id/aria-label/alternating-background pattern. Hero section needs `100dvh` (already supported via `isHero` prop in Phase 1 `<SectionShell id="hero" isHero />`). Final CTA section can reuse `SectionShell` with `variant="odd"`. Vision Beat may inline-wrap with its own minimal section element.
- **`motionTokens.ts`** — `durations.hero` (800ms entrance), `easings.outQuart`, `viewportThresholds.hero: 0` (fires immediately above fold), `triggerOnce: true`. All Hero + Final CTA + Vision Beat animations MUST import from here.
- **`MotionRoot.tsx`** — already wraps all SectionShells in `MotionConfig reducedMotion="user"`. Phase 2 components inherit reduced-motion handling automatically for `motion/react` usage. Aceternity components (Spotlight, AnimatedShinyText) do NOT inherit it — must wrap with manual `useReducedMotion()` guard.
- **`LandingHeader.tsx`** — already supplies fixed-top nav with anchor links including `#hero`, `#pricing`, `#final-cta`. Anchor targets the new components must match.
- **`src/components/ui/`** — shadcn primitives (Button, Card, GlassPanel pattern in CLAUDE.md). GlassPanel is a zero-config 4-prop component per Raycast contract — used directly by Vision Beat per D-11.
- **`lucide-react`** — already installed via shadcn new-york preset. Used for footer social icons (D-15).

### Established Patterns

- **`motion/react` only** — never `framer-motion`. Lint/grep before PR.
- **`backdrop-filter` inline-style** — Tailwind v4 Lightning CSS strips backdrop-filter; React inline `style={{ backdropFilter: ... }}` only. Spotlight + GlassPanel may need this.
- **Coral usage: single-stop alpha gradient only** (MOTION-03). Spotlight + BorderBeam coral tints MUST be single-stop. No multi-hue blends.
- **100dvh, not 100vh** — iOS Safari address-bar fix (HERO-08). Phase 1 SectionShell already supports `100dvh` for `isHero`.
- **MotionConfig `reducedMotion="user"`** — Phase 2 `motion/react` usage inherits. Aceternity + Magic UI primitives need manual `prefers-reduced-motion` check or `useReducedMotion()` from `motion/react`.
- **Server-by-default, client-when-interactive** — Hero shell can be server-rendered with client-component islands for Spotlight, ShimmerButton, WordRotate. Final CTA mirrors. Footer is server-rendered (CTA-03). Vision Beat is server-rendered (static content).
- **shadcn new-york + slate + cssVariables preset** — any new shadcn add commands MUST match this preset; no second style accidentally installed.

### Integration Points

- **`/v3/page.tsx`** — replace Hero + Final CTA `<SectionShell>` placeholders, insert Vision Beat before Final CTA. Anchor IDs (`#hero`, `#final-cta`) MUST be preserved for LandingHeader anchor links.
- **`(marketing)/layout.tsx`** — owns `<html>`/`<body>` via root layout. Phase 2 does NOT add layout-level changes (per Phase 1 fragment-style layout decision).
- **Magic UI / Aceternity new installs** — `@magicui/word-rotate`, `@magicui/shimmer-button`, `@magicui/animated-shiny-text`, `@magicui/border-beam`, Aceternity `Spotlight` (registry path verified at plan time). All MUST pass the Phase 1 collision check pattern (registry source view → no network/eval/env access before install).
- **Footer routes** — new files `src/app/(marketing)/privacy/page.tsx` and `src/app/(marketing)/terms/page.tsx` (minimal placeholder pages per D-14). Sitemap.ts (from Phase 1) may need entries added for these.

</code_context>

<specifics>
## Specific Ideas

- **Bookend symmetry** — Hero and Final CTA must look + read identical. User explicitly chose verbatim mirror (D-08) — no creative variation in the Final CTA copy. Planner should consider extracting a shared `<HeroBookend>` component used by both `<HeroSection>` and `<FinalCtaSection>`, with positional context (top vs bottom of page) as the only difference.
- **WordRotate fused inside H1** — the rotating word is one slot inside a single H1 sentence, not on a separate line. Component contract: `<h1>Predict viral for <WordRotate words={["creators","brands","founders"]} /> before you post.</h1>` — exact layout TBD by planner but the fused-in-sentence pattern is locked.
- **Investor signal layering** — every Phase 2 surface has a deliberate investor-audience signal alongside the creator-audience pull: WordRotate includes "founders", Vision Beat is behavioral-science framed, Footer Numen Machines lockup is full-width.
- **No "AI" in user-facing copy** — per D-01 user explicitly steered away from the "AI that..." prefix. This is a brand-voice signal: Virtuna positions on behavioral science + prediction, not on AI as a category. Planner should not reintroduce "AI" language in any new Phase 2 copy (button states, error states, etc.).

</specifics>

<deferred>
## Deferred Ideas

- **Hero credibility hook (logo bar + "Backed by..." microcopy)** — Phase 3 (HERO-10). Hero shell intentionally leaves vertical space for this between sub-head and Spline scene.
- **Spline 3D scene behind Hero** — Phase 3 (HERO-05). Hero shell ships flat (Spotlight only) in Phase 2.
- **Header CTA copy lock** — Phase 1 placeholder "Sign up" in `LandingHeader.tsx` is not Phase 2 scope (D-09). Decision deferred to Phase 11 cutover or a dedicated copy-pass.
- **Real founder photo or signature for Vision Beat** — explicitly out per REQ VISION-01 + D-12. May be reconsidered post-launch.
- **Footer link expansion (About / Careers / Blog real pages)** — currently `aria-disabled` stubs per D-14. Real pages can land after launch when team/hires/blog content actually exists.
- **A/B test for primary CTA destination (#demo vs /signup)** — D-06 chose `#demo` for v1 launch. Add A/B flag in a future conversion-optimization phase, not Phase 2.
- **Real Numen Machines SVG lockup in footer** — REQ blocks Phase 9 on this asset; for Phase 2 a text lockup is acceptable. If the SVG lands before plan time, planner uses it.

</deferred>

---

*Phase: 2-Hero Shell + Final CTA Bookend + Vision Beat*
*Context gathered: 2026-05-24*
