# Research Summary — Landing v1

**Project:** Virtuna — Landing v1
**Domain:** High-end animated SaaS landing page (TikTok creator + investor audience)
**Researched:** 2026-05-24
**Confidence:** HIGH — all 4 research files grounded in live filesystem audit + Context7-verified install paths + live reference-landing fetches

---

## Executive Summary

Landing v1 is a dual-audience SaaS landing page that must simultaneously convert TikTok creators (Starter/Pro signup) and impress investors (vision, science, trust). The research consensus is clear: Linear/Raycast aesthetic as the visual anchor (restrained dark minimal, coral accent, no maximalism), OpusClip conversion patterns for copy and section structure (outcome H1s, trial-first CTAs, follower-count social proof, 9-category pricing checklist), and a component stack of Magic UI (default for most motion) + Aceternity UI (Spotlight, TracingBeam, StickyScroll, AnimatedTestimonials where Magic UI has no equivalent) + existing shadcn primitives. GSAP, tsParticles, Spline, and Cult UI are palette-only — none are needed by default, and Cult UI should be skipped entirely.

The page has 8 ordered sections forming a narrative arc: Hero (promise) → Demo (proof) → How It Works (mechanism) → Three Surfaces (scope) → Science (credibility) → Social Proof (trust) → Pricing (commitment) → Final CTA (close). Each section sets up the next; ordering is non-negotiable for conversion. The single highest-value differentiator is the Interactive Demo (viewport 2) — scripted MultiStepLoader → CardStack/AnimatedList result reveal — which no TikTok-intelligence competitor has on their landing. This section alone is the conversion keystone for both audiences.

Two structural risks dominate. First, the v3.0 abandonment pattern: too many pre-build brand-foundation phases before any pixel shipped. Landing v1 explicitly avoids this — copy is iterable, no standalone brand phase, Phase 1 ships visible output at `/v3`. Second, a suite of production-vs-dev divergence traps specific to this codebase: Lightning CSS stripping `backdrop-filter`/`mask-image` (patch to inline style), `framer-motion` vs `motion/react` dual-runtime (alias via `pnpm.overrides`), and Tailwind v4 oklch inaccuracy for L < 0.15 colors (use hex). These three codebase-specific issues pass `pnpm dev` silently and fail on Vercel visibly.

---

## Section-by-Section Build Sheet

| # | Section | Winning Pattern | Key Components | File Location | Server/Client | Top Pitfall | Phase |
|---|---------|----------------|----------------|---------------|---------------|-------------|-------|
| 1 | Hero | Ambient Spotlight + Canvas particle viz + dual CTA | Aceternity `Spotlight`, `BehavioralSimulationHero` Canvas, Magic UI `ShimmerButton` + `AnimatedShinyText` + `BorderBeam` | `_components/HeroSection.tsx` (server shell) + `HeroVisual.tsx` (client) | Shell: server; Canvas + CTA animations: client islands | Spotlight `mask-image` stripped by Lightning CSS → inline style | Phase 2 (shell) + Phase 3 (Canvas) |
| 2 | Interactive Demo | Sample picker → MultiStepLoader → CardStack/AnimatedList result | Aceternity `MultiStepLoader`, Magic UI `AnimatedList` + `NumberTicker` + `BoxReveal` + `MagicCard`, `demo-data.ts` | `_components/DemoSection.tsx` (full client, useReducer state machine) | Entirely client | Demo hydrates late → momentum break; pre-fetch on hero CTA hover | Phase 4 |
| 3 | How It Works | AnimatedBeam pipeline (desktop) + TracingBeam vertical (mobile) | Magic UI `AnimatedBeam` + `OrbitingCircles` + `BorderBeam`, Aceternity `TracingBeam`, Magic UI `DotPattern` | `_components/HowItWorksSection.tsx` (server) + `HowItWorksPipeline.tsx` + `HowItWorksMobile.tsx` (client) | Shell: server; animation: client | AnimatedBeam loops by default — must fire one-shot only (BRAND-BIBLE VIZ-02) | Phase 5 |
| 4 | Three Surfaces Bento | BentoGrid 3-card asymmetric (1 large Prediction + 2 stacked) with live animated card backgrounds | Magic UI `BentoGrid` + `BentoCard` + `Marquee` (vertical) + `AnimatedList` + `NumberTicker` | `_components/SurfacesSection.tsx` (server) + 3 card client islands | Shell: server; card backgrounds: client | MagicCard cursor-tracking on Bento → INP regression; use CSS-only hover | Phase 6 |
| 5 | The Science | Aceternity StickyScroll (left: research steps; right: sticky citation chips) + Marquee citation band | Aceternity `StickyScroll`, Magic UI `Marquee` + `NumberTicker`, shadcn `Badge` chips | `_components/ScienceSection.tsx` (server) + `ScienceStickyScroll.tsx` + `ScienceCitationMarquee.tsx` (client) | Shell: server; StickyScroll + Marquee: client | Fake paper titles destroy investor credibility; only real published papers | Phase 7 |
| 6 | Social Proof | Hybrid: logo Marquee + AnimatedTestimonials centerpiece + metric bar, all under shared Spotlight | Aceternity `Spotlight` + `AnimatedTestimonials`, Magic UI `Marquee` (2-row) + `NumberTicker` × 3 + `AvatarCircles` | `_components/SocialProofSection.tsx` (server) + 3 client islands | Shell: server; Marquee + Testimonials + Metrics: client | Stock testimonials / missing follower counts → trust collapse (OpusClip rule: real @handle + count) | Phase 8 |
| 7 | Pricing | 2-column shadcn Card table + monthly/yearly toggle + 6-category checklist + FAQ accordion | shadcn `Card` + `Tabs` + `Accordion` + `Tooltip`, Magic UI `BorderBeam` + `ShimmerButton` | `_components/PricingSection.tsx` (server) + `PricingToggle.tsx` (client) | Static: server; toggle: client | Pricing buried below excessive scroll → anchor link in header from Phase 1 | Phase 9 |
| 8 | Final CTA + Footer | Hero mirror (same Spotlight + ShimmerButton + AnimatedShinyText) + 4-col footer | Aceternity `Spotlight`, Magic UI `ShimmerButton` + `AnimatedShinyText`, shadcn footer grid | `_components/FinalCtaSection.tsx` + `LandingFooter.tsx` (both server; CTAs client islands) | Mostly server | New copy in final CTA breaks bookend close — mirror hero verbatim (OpusClip pattern) | Phase 2 (shell built alongside Hero) |

---

## 10 Critical Decisions

1. **Build at `/v3`, swap at cutover.** Stage at `src/app/(marketing)/v3/page.tsx`. CI guard rejects PRs touching `(marketing)/page.tsx` without `CUTOVER-APPROVED` string until Phase 11.

2. **`MotionConfig reducedMotion="user"` at page root from Phase 1.** Single kill-switch for `motion/react`-powered animations. Budget 30 min per section for per-component reduced-motion audit (Aceternity components don't honor it natively).

3. **Canvas viz is hero default, not Spline.** Spline = 544 KB gzip, 30-40 Lighthouse point drop. Canvas viz = ~30 KB, 60fps, proven at 1300+ nodes. Only reconsider if Canvas fails Phase 3 QA.

4. **Magic UI default; Aceternity fills gaps.** Magic UI for marquee, bento, beam, buttons, text, number ticker. Aceternity only for: Spotlight, TracingBeam, StickyScroll, AnimatedTestimonials, MultiStepLoader. Never Aurora/Vortex/WavyBackground.

5. **`framer-motion` aliased to `motion/react` via `pnpm.overrides`.** `"framer-motion": "npm:motion@^12.29.2"` + Phase 1 grep audit + convert every copy-pasted Aceternity import immediately.

6. **Lightning CSS pitfalls patched inline-style only.** All `backdrop-filter`, `mask-image`, `backdrop-blur` Tailwind classes replaced with `style={{ backdropFilter: '...', WebkitBackdropFilter: '...' }}`. Validate on Vercel preview, not localhost.

7. **Demo state machine is `useReducer`, no Zustand, no URL params.** 4 phases: `idle → loading → result → reset`. SSR-renders picker layout; only loader + result animations are client-only. Pre-fetch demo chunk on hero CTA `onMouseEnter`.

8. **Social proof verifiability non-negotiable.** Every testimonial needs real @handle + follower count. Every metric must be real or flagged `[projected]`. Every logo must have use permission. No stock avatars.

9. **Coral at single alpha-stepped stop, never multi-hue gradient.** Spotlight/Lamp/BackgroundBeams tinted coral uses single `coral/30 → coral/15 → transparent` stop list. MagicCard cursor gradient alpha capped at `0.06`.

10. **Phase 1 first task: fix duplicate `<html>/<body>` in `(marketing)/layout.tsx`.** Also fix stale `"Artificial Societies | Human Behavior, Simulated"` title at the same time.

---

## Top 10 Pitfalls (Severity Order)

| Rank | Pitfall | Severity | Prevention |
|------|---------|----------|------------|
| 1 | v3.0-style brand-foundation over-commitment | CRITICAL | No standalone brand phase. Phase 1 = scaffold with visible `/v3` output. ≤ 11 phases total. |
| 2 | Lightning CSS strips `backdrop-filter`/`mask-image` | CRITICAL | Inline `style={}` on every glass/spotlight component. Validate on Vercel preview (not localhost). |
| 3 | `framer-motion` + `motion/react` dual-runtime | CRITICAL | `pnpm.overrides` alias + Phase 1 grep audit + convert every Aceternity copy-paste immediately. |
| 4 | Route collision — editing `(marketing)/page.tsx` before Phase 11 | CRITICAL | Build at `v3/` only. CI guard rejects PRs without `CUTOVER-APPROVED`. |
| 5 | Duplicate `<html>/<body>` in marketing layout | HIGH | Phase 1 first task. |
| 6 | Spline 544 KB runtime accidentally shipped | HIGH | Default = Canvas. Bundle-budget CI check post-build. |
| 7 | `prefers-reduced-motion` ignored by Aceternity components | HIGH | `MotionConfig reducedMotion="user"` root + per-component patch + Phase 10 manual audit. |
| 8 | Investor-impression slop tropes | HIGH | Forbidden list in BRAND-BIBLE. Reference-anchor screenshot per section phase. |
| 9 | Demo momentum break from slow hydration | MEDIUM | SSR-render picker. Pre-fetch on hover-intent. Gate: ≤ 200ms to first pickable state. |
| 10 | oklch L < 0.15 compilation inaccuracy | MEDIUM | Hex for all dark colors in `@theme inline`. Hex strings on Magic UI color props. |

---

## Implications for Roadmap

### Recommended Phase Structure (11 phases)

**Phase 1 — Foundation + Scaffold**
Rationale: layout bug + framer-motion alias + MotionConfig root + `/v3` shell must exist before any section work.
Delivers: `/v3` route with placeholder sections; `(marketing)/layout.tsx` bug fixed (duplicate html + stale title); Magic UI + Aceternity core install batch with collision-check; `_components/` + `_data/` + `public/landing/` dirs; `LandingHeader.tsx` with anchor links; `sitemap.ts` + `robots.ts`; `pnpm.overrides` alias; `MotionConfig reducedMotion="user"` root.
Pitfalls: 1, 3, 5, 10, 11, 12, 16, 27, 28.
Research flag: SKIP.

**Phase 2 — Hero Shell + Final CTA Bookend**
Rationale: Spotlight, ShimmerButton, AnimatedShinyText, BorderBeam are shared by Hero and Final CTA — lock the pattern once.
Delivers: Hero shell (static H1 + dual CTA + Spotlight + Canvas viz slot); Final CTA mirror; `100dvh` iOS fix; coral gradient rule locked.
Pitfalls: 2 (first Spotlight = Lightning CSS validation gate), 4, 19, 22, 23.
Research flag: SKIP.

**Phase 3 — BehavioralSimulationHero Canvas**
Rationale: highest-risk visual; Spline yes/no decision gate; isolated from other sections. Can run parallel with Phase 4 if 2 lanes.
Delivers: Canvas particle viz per BRAND-BIBLE VIZ-01; static initial keyframe (LCP fix); reduced-motion static keyframe; LCP gate < 2.5s mobile.
Pitfalls: 6, 7, 13, 23.
Research flag: NEEDS RESEARCH at plan time — Canvas animation spec (particle physics, color batching, timing) needs per-plan spec.

**Phase 4 — Interactive Demo (Viewport 2)**
Rationale: highest-value differentiator; highest implementation complexity; build while team is fresh.
Delivers: `useReducer` state machine; 4 scripted demo samples in `_data/`; MultiStepLoader (4 stages, 3-4s); AnimatedList result cards; NumberTicker score; BoxReveal; keyboard nav; aria-live; reduced-motion skip-loader.
Pitfalls: 24, 31.
Research flag: SKIP.

**Phase 5 — How It Works Pipeline**
Rationale: no shared components with Demo; locked 4-stage spec.
Delivers: AnimatedBeam horizontal (desktop); TracingBeam vertical (mobile `<lg`); one-shot pulse; DotPattern background; outcome-word stage labels.
Pitfalls: reduced-motion fallback.
Research flag: SKIP.

**Phase 6 — Three Surfaces Bento**
Rationale: parallelizable with Phase 5; shared components pre-installed.
Delivers: BentoGrid 3-card asymmetric; per-card animated backgrounds; CSS-only hover (no MagicCard cursor-tracking); aria roles; mobile single-column.
Pitfalls: 15, 29.
Research flag: SKIP.

**Phase 7 — The Science**
Rationale: content-research-bound; build component infra; content review is parallel task.
Delivers: StickyScroll 4 steps + tickers; citation chip Marquee; 3 stat tickers; linear-flow fallback `<md`; `science-steps.ts` with real citations.
Pitfalls: 20.
Research flag: CONTENT GAP — real paper titles + dataset numbers must be sourced before phase ships.

**Phase 8 — Social Proof**
Rationale: asset-dependent; component work is straightforward; asset collection is pacing factor.
Delivers: 2-row logo Marquee (Numen Machines BorderBeam accent); AnimatedTestimonials (real @handle + follower count); 3-col metric bar; shared Spotlight backdrop; alt text on logos.
Pitfalls: 17, 32.
Research flag: ASSET GAP — testimonials availability, logo permissions, projected vs real metrics must be flagged in requirements.

**Phase 9 — Pricing**
Rationale: mostly static; low risk; no heavy animation.
Delivers: 2-col Card table; monthly/yearly Tabs; 6-category checklist; FAQ Accordion; BorderBeam Pro; tap-to-toggle tooltips on mobile.
Pitfalls: 19, 21.
Research flag: BUSINESS DECISION — actual price points and discount % needed before plan is written.

**Phase 10 — Mobile + Reduced-Motion + Performance Polish**
Rationale: dedicated polish pass; Lighthouse Performance ≥ 90 mobile is non-negotiable for investor impression.
Delivers: Lighthouse ≥ 90 mobile; CLS < 0.1; INP < 200ms; LCP < 2.5s; full reduced-motion audit; per-section 375px mobile verification; Sentry scoped to auth routes; axe-core + pa11y clean; "Looks Done But Isn't" checklist completed.
Pitfalls: 5, 14, 15, 17, 18, 20, 21, 30.
Research flag: SKIP.

**Phase 11 — Cutover**
Rationale: all sections verified on Vercel preview at `/v3`. Davide reviews. One-way operation.
Delivers: `v3/` → `(marketing)/page.tsx` overwrite; metadata title + OG updated; `/pricing` deleted + redirect; legacy landing imports audited; reference-fidelity audit.
Pitfalls: 11, 17, 26.
Research flag: SKIP.

### Phase Ordering Rationale

- Phase 1 before everything: global infrastructure (layout bug, module aliasing, MotionConfig) must be correct before any section.
- Phase 2 before Phase 3: hero shell provides the Canvas slot; building both simultaneously creates coordination friction.
- Phases 3+4 can run parallel: Canvas viz is independent of Demo state machine.
- Phases 5–9 maximally parallelizable after Phase 2 (all shared components installed).
- Phase 10 always after all content phases: Lighthouse baseline meaningless until all sections exist.
- Phase 11 always last, always its own phase: cutover is irreversible.

### Research Flags

Needs `/gsd-research-phase` during planning:
- **Phase 3 (Hero Canvas):** Animation spec locked conceptually; pixel-level parameters (particle physics, color batching, timing curve) need per-plan spec work.

Standard patterns (skip research-phase):
- All other phases — verified via Context7, documented in ARCHITECTURE.md, implementation path explicit.

---

## Open Questions (Flag for Requirements Step)

| Question | Why It Blocks | Phase |
|----------|---------------|-------|
| Real testimonials available? (@handle + follower count) | Phase 8 asset-blocked without real quotes | Phase 8 pre-req |
| Partner logos + use permissions (Numen Machines + who else?) | Logo wall needs ≥ 6 credible logos | Phase 8 pre-req |
| Pricing economics (Starter price, Pro price, yearly % discount, tier features) | Wrong prices ship to live landing | Phase 9 pre-req — business decision |
| Real paper citations for Science section (Fogg / Berger & Milkman / Cialdini / Krug — which specific papers?) | Fake citations are investor trust killer | Phase 7 pre-req |
| Dataset stats (2.4M videos / 847 signals / 30-sec avg) — real or projected? | Science section honest framing | Phase 7 content input |
| Demo sample handles — fictional names confirmed? (e.g., `@samplecreator1`, 4 niches) | Brand/legal risk if real creator handles used | Phase 4 pre-req |
| "Read the white paper" CTA in Science — does white paper exist? | Broken link destroys trust the section builds | Phase 7 decision |
| Projected metrics framing — e.g., "12,000+ creators" / "$2.4M brand deals" — labeling? | FTC-adjacent concern; must label projected metrics | Phase 8 framing decision |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Context7-verified install paths + bundle sizes for all 6 libs. GSAP 100%-free confirmed from official April 2025 Webflow announcement. |
| Features | HIGH | Live-fetched from Linear, Raycast, OpusClip, Stripe, Anthropic, Cursor, Vercel, ElevenLabs on 2026-05-24. |
| Architecture | HIGH | Live filesystem audit of `src/app/`, `src/components/`, `src/hooks/`. Every decision verified against actual codebase state. |
| Pitfalls | HIGH | 33 pitfalls grounded in live filesystem audit + CLAUDE.md known issues + v3.0 abandonment archive. Not speculative. |

**Overall confidence:** HIGH

### Gaps to Address

- **Social proof assets:** Testimonials, logos, metrics cannot be sourced by research — business/outreach dependency. Plan Phase 8 with explicit asset-collection pre-step.
- **Science content:** Paper titles and dataset numbers need a content-research pass, distinct from component-build work.
- **Pricing numbers:** Business decision. Must be decided before Phase 9 plan is written.
- **BehavioralSimulationHero Canvas spec:** VIZ-01 locks the concept; animation parameters need spec work at Phase 3 plan time.

---

## Sources

### Primary (HIGH confidence)
- `.planning/research/STACK.md` — Magic UI, Aceternity, GSAP, tsParticles, Cult UI, Spline install paths + bundle sizes
- `.planning/research/FEATURES.md` — 8-section pattern catalog, OpusClip conversion patterns, component inventory per section
- `.planning/research/ARCHITECTURE.md` — file/route structure, server/client split, state management, lazy-loading, build order
- `.planning/research/PITFALLS.md` — 33 pitfalls with phase assignments, tech debt patterns, "Looks Done But Isn't" checklist
- `BRAND-BIBLE.md` § Visual Metaphor Lock — VIZ-01 to VIZ-05
- `CLAUDE.md` — Raycast design language rules, Tailwind v4 / Lightning CSS known issues
- Live reference fetches: Linear, Raycast, OpusClip/opus.pro, Stripe, Anthropic, Cursor, Vercel, ElevenLabs (2026-05-24)
- https://webflow.com/updates/gsap-becomes-free — GSAP 100% free (April 2025)

### Secondary (MEDIUM confidence)
- Spline lazy-load case study (DEV.to) — 30 → 90 Lighthouse with lazy-loading
- tsParticles bundle size estimates — extrapolated from v3.x precedent
- SaaS landing trends 2026 — https://www.saasframe.io/blog/10-saas-landing-page-trends-for-2026-with-real-examples

---

*Research completed: 2026-05-24*
*Ready for roadmap: yes*
