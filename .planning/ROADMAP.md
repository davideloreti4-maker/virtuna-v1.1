# Roadmap: Landing v1

**Milestone:** Landing v1
**Created:** 2026-05-24
**Granularity:** fine
**Phase cap:** 11 (enforced per v3.0 abandonment lesson)
**Coverage:** 126/126 REQ-IDs mapped to exactly one phase

## Overview

Ship a high-end SaaS-style animated landing page (Linear/Raycast aesthetic + OpusClip conversion patterns) that converts TikTok creators AND impresses investors. Built at staging route `/v3`, swapped to root only in final cutover phase. Phase 1 produces visible `/v3` output on day one (anti-v3.0-abandonment guardrail). Each phase delivers a coherent, viewport-verifiable capability; the penultimate phase enforces the Lighthouse ≥ 90 mobile non-negotiable; the final phase is the irreversible cutover gated on Davide approval.

## Phases

**Phase Numbering:**
- Milestone-scoped, starts at Phase 1 (worktree convention overrides global counter)
- Integer phases (1..11): planned milestone work
- Decimal phases (e.g., 2.1): reserved for urgent insertions via `/gsd-insert-phase`

- [ ] **Phase 1: Foundation + Scaffold** — `/v3` route renders placeholder sections, framer-motion alias locked, MotionConfig root, layout bug fixed, sitemap/robots added
- [ ] **Phase 2: Hero Shell + Final CTA Bookend + Vision** — H1 + WordRotate + dual CTA + Spotlight + ShimmerButton render above-fold, Final CTA mirrors Hero, Vision beat shipped
- [ ] **Phase 3: Hero Spline Scene + Above-Fold Credibility Hook** — Spline 3D scene lazy-loads with poster fallback, thin logo bar + "backed by" microcopy visible without scroll
- [ ] **Phase 4: Interactive Demo** — User picks sample TikTok, sees scripted 4-stage loader and animated insight reveal, cursor-following effect during result
- [ ] **Phase 5: How It Works Pipeline** — AnimatedBeam horizontal pipeline (desktop) / TracingBeam vertical (mobile) one-shot animation on viewport entry
- [ ] **Phase 6: Three Surfaces Bento + Dashboard Reveal** — Asymmetric BentoGrid renders Prediction + Competitor Intelligence + Brand Deals with live animated backgrounds; MacbookScroll dashboard reveal follows
- [ ] **Phase 7: Comparison vs Alternatives** — Positioning grid/table shows Virtuna differentiation positively (no logo-vs-logo attack)
- [ ] **Phase 8: The Science** — StickyScroll research narrative + real citation chips + dataset stats (content-gated on real paper citations)
- [ ] **Phase 9: Social Proof** — Logo Marquee + AnimatedTestimonials scaffold + projected-and-labeled metric bar under shared Spotlight (asset-gated on Numen Machines lockup)
- [ ] **Phase 10: Pricing + FAQ** — 2-column Starter/Pro table + monthly/yearly toggle + 6-category checklist + FAQ accordion (placeholder $ amounts)
- [ ] **Phase 11: Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover** — Polish layer + META/ANALYTICS/PERF gates met (Lighthouse ≥ 90 mobile), then `/v3` overwrites root with Davide approval

## Phase Details

### Phase 1: Foundation + Scaffold
**Goal**: `/v3` route renders all 9 placeholder section shells under a stable motion runtime, layout bug + stale title fixed, SEO baseline files in place
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, FOUND-07, FOUND-08, FOUND-09, FOUND-10, MOTION-04, MOTION-05, META-03, PERF-11, PERF-13, POLISH-01, POLISH-07
**Success Criteria** (what must be TRUE):
  1. User can navigate to `/v3` in Vercel preview and see all 9 placeholder section blocks render in order without console errors or hydration warnings
  2. `LandingHeader.tsx` renders at top with anchor links to all 9 sections (smooth-scroll) plus visible "Sign in" link to `/login` and "Sign up" CTA
  3. `/sitemap.xml` and `/robots.txt` resolve in production and reference the canonical landing URL
  4. Skip-to-content link appears on first Tab keypress before any other focusable element; `<html lang="en">` set
  5. Page-root `MotionConfig reducedMotion="user"` wraps all section shells, and `pnpm.overrides` aliases `framer-motion` to `motion@^12.29.2` (single animation runtime verified via `pnpm why framer-motion`)
**Plans**: TBD
**Content gates**: None
**Research flag**: SKIP — patterns verified in research/STACK.md + ARCHITECTURE.md
**UI hint**: yes

### Phase 2: Hero Shell + Final CTA Bookend + Vision Beat
**Goal**: User sees finished Hero shell with H1 + WordRotate + dual CTA above-fold (no Spline yet, no logo bar yet) and a visually identical Final CTA mirror at page end; founder Vision quote sits between Pricing and Final CTA
**Depends on**: Phase 1
**Requirements**: HERO-01, HERO-02, HERO-03, HERO-04, HERO-06, HERO-07, HERO-08, HERO-09, HERO-11, CTA-01, CTA-02, CTA-03, CTA-04, CTA-05, CTA-06, VISION-01, MOTION-01, MOTION-02, MOTION-03
**Success Criteria** (what must be TRUE):
  1. User sees H1 (with `WordRotate` cycling "creators / brands / agencies"), sub-headline, and both primary + secondary CTAs above-fold at 1440px desktop and 375px mobile (no scroll required)
  2. Primary CTA navigates to `#demo` (or sign-up flow) and secondary CTA navigates to `#pricing`; Hero uses `100dvh` for full-viewport height (no iOS Safari address-bar re-flow)
  3. Final CTA section at page end renders identical Spotlight + ShimmerButton + AnimatedShinyText + mirrored copy as Hero, plus 4-column footer with Numen Machines lockup ("A Numen Machines product"), Sign-in link, and WCAG AA (≥ 4.5:1) text contrast
  4. Founder Vision quote (1-2 sentences, attributed to "Davide Loreti, Founder, Virtuna") renders between Pricing slot and Final CTA section
  5. With `prefers-reduced-motion: reduce` enabled, WordRotate shows static single word, ShimmerButton shimmer is disabled, and no autoplay animation fires outside viewport (verified via macOS Reduce Motion + IntersectionObserver gate)
**Plans**: TBD
**Content gates**: None (copy iterable in-phase; coral-tinted Spotlight uses single-stop alpha gradient — no multi-hue)
**Research flag**: SKIP
**UI hint**: yes

### Phase 3: Hero Spline Scene + Above-Fold Credibility Hook
**Goal**: User sees Spline 3D scene render behind Hero shell (with reduced-motion / slow-network static poster fallback) and a thin logo bar + "Backed by..." microcopy between H1 and Spline scene above-fold
**Depends on**: Phase 2
**Requirements**: HERO-05, HERO-10
**Success Criteria** (what must be TRUE):
  1. User on desktop (1440px) with default motion preferences sees Spline 3D scene render behind Hero shell within 2 seconds of viewport entry; Spline chunk is lazy-loaded via `dynamic({ ssr: false })` and IntersectionObserver-gated (does NOT count against initial bundle, verified via bundle analyzer)
  2. User with `prefers-reduced-motion: reduce` OR on slow connection (`Save-Data` header) sees the static poster image instead of the Spline scene; the poster covers LCP so LCP < 2.5s mobile
  3. Above-fold credibility hook (Numen Machines lockup + 4-5 partner/early-backer logo slots in a thin bar, plus "Backed by behavioral research / Numen Machines" microcopy) is visible between H1 microcopy and Spline scene at both 1440px desktop and 375px mobile without scrolling
  4. Screen reader announces credibility hook in reading order (H1 → microcopy → CTAs → credibility hook → Spline scene `aria-hidden`)
**Plans**: TBD
**Content gates**: **BLOCKED ON CONTENT — Spline `.splinecode` scene file (≤ 500 KB optimized) must be supplied by Davide / designer before this phase can ship per REQUIREMENTS.md Content Gates table. Partner logos may be placeholder.**
**Research flag**: NEEDS RESEARCH at plan time — Spline scene optimization parameters + IntersectionObserver mount threshold need per-plan spec
**UI hint**: yes

### Phase 4: Interactive Demo
**Goal**: User picks a sample TikTok and sees a scripted 4-stage loader animation followed by an animated insight reveal (score + signals + confidence band) with cursor-following micro-signal effect — fully keyboard accessible
**Depends on**: Phase 2 (uses Magic UI primitives installed in Phase 1, but Demo section is independent of Spline)
**Requirements**: DEMO-01, DEMO-02, DEMO-03, DEMO-04, DEMO-05, DEMO-06, DEMO-07, DEMO-08, DEMO-09, DEMO-10
**Success Criteria** (what must be TRUE):
  1. User scrolls to `#demo`, picks from 3-4 fictional `@samplecreator` sample TikTok cards (picker is server-rendered, ready ≤ 200ms after section enters viewport), and sees `MultiStepLoader` animate 4 engine-pipeline stages (Reading → Scoring → Comparing → Confidence emerging) in 3-4s total
  2. After loader, user sees animated result reveal: `NumberTicker` score, top behavioral signals via `AnimatedList`, confidence band via `CardStack` or `BoxReveal`; cursor-following dot/particle trail micro-effect renders during result reveal (disabled on touch devices)
  3. User can hit "Reset" CTA to return to picker and run demo on each sample sequentially
  4. Demo is keyboard-accessible: Tab navigates picker cards, Enter selects, focus visible, `aria-live="polite"` announces each loader stage; VoiceOver verifies stage progress announced
  5. With `prefers-reduced-motion: reduce`, loader animation skipped, result shown immediately on pick, cursor trail effect disabled
**Plans**: TBD
**Content gates**: Sample handles confirmed fictional (`@samplecreator1..4`) per REQUIREMENTS.md content gates — locked, no Davide blocker
**Research flag**: SKIP
**UI hint**: yes

### Phase 5: How It Works Pipeline
**Goal**: User scrolls into `#how-it-works`, sees 4-stage engine pipeline animate one-shot — horizontal AnimatedBeam on desktop, vertical TracingBeam on mobile
**Depends on**: Phase 2
**Requirements**: HOW-01, HOW-02, HOW-03, HOW-04, HOW-05, HOW-06, HOW-07
**Success Criteria** (what must be TRUE):
  1. On desktop (`lg+`), user sees Magic UI `AnimatedBeam` horizontal pipeline animate one-shot on viewport entry connecting 4 stage nodes (outcome-word labels, not jargon); beams pulse once and do NOT loop (BRAND-BIBLE VIZ-02 compliance)
  2. On mobile (`<lg`), the horizontal pipeline is replaced by Aceternity `TracingBeam` vertical fallback with the same 4 stages stacked
  3. Stage labels narratively bridge to Demo section above (engine stages mirror Demo loader stages) and Three Surfaces section below
  4. With `prefers-reduced-motion: reduce`, all stages render as static diagram, no beam animation, all nodes visible immediately
**Plans**: TBD
**Content gates**: None
**Research flag**: SKIP
**UI hint**: yes

### Phase 6: Three Surfaces Bento + Dashboard Reveal
**Goal**: User sees a 3-card asymmetric Bento (1 large Prediction + 2 smaller stacked) on desktop with live animated backgrounds, followed by an Aceternity `MacbookScroll` dashboard reveal section that frames a Virtuna dashboard screenshot inside a laptop frame as the user scrolls
**Depends on**: Phase 1
**Requirements**: BENTO-01, BENTO-02, BENTO-03, BENTO-04, BENTO-05, BENTO-06, BENTO-07
**Success Criteria** (what must be TRUE):
  1. User on desktop sees 3-card asymmetric BentoGrid (1 large Prediction card + 2 smaller stacked: Competitor Intelligence + Brand Deals) with each card displaying a live animated background (Marquee of competitor handles, AnimatedList of behavioral signals, or coral BorderBeam)
  2. Each card uses CSS-only hover state (no MagicCard cursor-tracking — avoids INP regression per PITFALLS.md #15); INP < 200ms verified on Pixel-class Android
  3. On mobile (`<lg`), Bento collapses to single-column stack with each card retaining its animated background
  4. Each card uses semantic ARIA roles (`role="article"` + `aria-labelledby`) and links to the relevant in-app surface (gated behind auth — non-blocking)
**Plans**: TBD
**Content gates**: None
**Research flag**: SKIP
**UI hint**: yes

### Phase 7: Comparison vs Alternatives
**Goal**: User sees a positive, positioning-led comparison of Virtuna vs traditional creator analytics (no logo-vs-logo attack, no disparagement)
**Depends on**: Phase 1
**Requirements**: CMP-01, CMP-02, CMP-03, CMP-04, CMP-05, CMP-06, CMP-07
**Success Criteria** (what must be TRUE):
  1. User scrolls into comparison section (between Three Surfaces and Science), sees side-by-side comparison of Virtuna vs traditional creator analytics tools (TikTok Creative Center, Iconosquare-style, generic AI tools) framed positively — highlights predictive-vs-reactive, audience-modeled-vs-raw-stats, integrated-brand-deals-plus-science differentiation
  2. Comparison uses minimal table OR feature-chip grid with ✓/− icons; coral accent applied only to the Virtuna column; no competitor logos appear
  3. Copy tone is confident and capability-led — no disparaging language about competitors
  4. On mobile (`<lg`), the comparison stacks to single-column with clear feature labels; no horizontal scroll
  5. With `prefers-reduced-motion: reduce`, no row reveal animations — all rows visible immediately
**Plans**: TBD
**Content gates**: None (comparison categories iterable during plan)
**Research flag**: SKIP
**UI hint**: yes

### Phase 8: The Science
**Goal**: User scrolls into Science section, sees a sticky-scroll research narrative with real citation chips and dataset stats — investor-facing trust signal
**Depends on**: Phase 1
**Requirements**: SCI-01, SCI-02, SCI-03, SCI-04, SCI-05, SCI-06, SCI-07, SCI-08, SCI-09
**Success Criteria** (what must be TRUE):
  1. User on desktop sees Aceternity `StickyScroll` left rail of research steps with sticky citation chip cluster on right; mobile (`<md`) falls back to linear-flow citation list with reading order preserved
  2. Citation chips reference REAL published behavioral research papers (candidates: BJ Fogg, Berger & Milkman, Cialdini, Krug) with author + year visible — no fake citations
  3. Section displays 3 dataset stats via `NumberTicker` (videos analyzed, signals tracked, models trained) — every number is real OR labeled `[projected]` honestly
  4. Marquee citation band at bottom of section scrolls author + paper-year chips (paused/static under `prefers-reduced-motion`)
  5. "Read more" CTA either links to a real white paper OR is removed entirely — no broken-link gestures
**Plans**: TBD
**Content gates**: **BLOCKED ON CONTENT — real paper citations (3-5 papers, author + year + DOI/URL) must be sourced by Davide before phase ships per REQUIREMENTS.md Content Gates table. White paper existence decision drives SCI-06 ship/skip.**
**Research flag**: NEEDS RESEARCH at plan time — real citation sourcing + dataset stat sourcing pass
**UI hint**: yes

### Phase 9: Social Proof
**Goal**: User sees a logo Marquee + AnimatedTestimonials scaffold + projected-and-labeled metric bar fused under a single shared Spotlight backdrop — avoids "four separate sections jammed together" failure mode
**Depends on**: Phase 2 (shares Spotlight from Hero install)
**Requirements**: PROOF-01, PROOF-02, PROOF-03, PROOF-04, PROOF-05, PROOF-06, PROOF-07, PROOF-08
**Success Criteria** (what must be TRUE):
  1. User sees a 2-row scrolling logo Marquee with Numen Machines lockup highlighted via `BorderBeam`; additional partner/PR logos added as availability allows; all logos have descriptive alt text (logo name + Virtuna partner relation)
  2. Aceternity `AnimatedTestimonials` component is shipped as a scaffold with "Coming soon — first 100 beta creators" placeholder copy; real testimonials can populate later without component refactor
  3. 3-column metric bar shows projected-and-labeled stats (e.g. "Early Signal: X%", "Beta Cohort: Y") — every number framed honestly, no fake testimonials, no stock avatars
  4. A single shared Aceternity `Spotlight` backdrop spans logos + testimonials + metric bar — visually fuses the three sub-sections into one stack
**Plans**: TBD
**Content gates**: **BLOCKED ON ASSET — Numen Machines logo lockup (SVG, multiple weights) must be supplied by Davide / designer before phase ships per REQUIREMENTS.md Content Gates table. Additional partner logos optional; Numen Machines alone is acceptable minimum.**
**Research flag**: SKIP
**UI hint**: yes

### Phase 10: Pricing + FAQ
**Goal**: User sees a 2-column Starter/Pro pricing table with monthly/yearly toggle, 6-category feature checklist (OpusClip-style density), Pro tier visually marked as recommended, and FAQ accordion directly below
**Depends on**: Phase 2 (uses ShimmerButton from Hero install)
**Requirements**: PRICE-01, PRICE-02, PRICE-03, PRICE-04, PRICE-05, PRICE-06, PRICE-07, PRICE-08, PRICE-09
**Success Criteria** (what must be TRUE):
  1. User sees 2-column shadcn `Card` pricing table (Starter / Pro) with monthly/yearly `Tabs` toggle that actually changes prices (NOT visual only), labeled "Save up to X% yearly" (OpusClip pattern)
  2. Pro tier card has Magic UI `BorderBeam` accent + `ShimmerButton` primary CTA — visually marked as recommended
  3. 6-category feature checklist with ✓/− icons compares Starter vs Pro tiers (OpusClip-style density)
  4. Pricing $ amounts use clearly-marked placeholder format (`$XX/mo`) — real prices locked at Phase 11 cutover business decision gate
  5. FAQ accordion (shadcn `Accordion`) directly below pricing with 4-6 conversion-anchored Q&A; mobile tap-to-toggle tooltips on feature rows (no hover); both cards stack single-column on mobile; primary CTA on each tier links to existing Whop checkout flow
**Plans**: TBD
**Content gates**: Placeholder $ amounts acceptable now; **real prices ($ for Starter, $ for Pro, yearly discount %) blocked on Davide business decision before Phase 11 cutover merge per REQUIREMENTS.md Content Gates table**
**Research flag**: SKIP
**UI hint**: yes

### Phase 11: Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover
**Goal**: Polish layer + SEO + Analytics + Performance + Accessibility + Mobile gates all pass on Vercel preview at `/v3`; Davide approves; `/v3` overwrites root landing page in one-way cutover
**Depends on**: Phases 1-10 (all section content must exist before Lighthouse baseline is meaningful)
**Requirements**: POLISH-02, POLISH-03, POLISH-04, POLISH-05, POLISH-06, META-01, META-02, META-04, META-05, ANALYTICS-01, ANALYTICS-02, ANALYTICS-03, ANALYTICS-04, PERF-01, PERF-02, PERF-03, PERF-04, PERF-05, PERF-06, PERF-07, PERF-08, PERF-09, PERF-10, PERF-12, LAUNCH-01, LAUNCH-02, LAUNCH-03, LAUNCH-04, LAUNCH-05, LAUNCH-06, LAUNCH-07
**Success Criteria** (what must be TRUE):
  1. Polish layer ships: scroll progress indicator (thin coral 2-3px line at viewport top), custom coral-tinted cursor on landing only (default cursor in `(app)/` routes, disabled on touch), section dividers via alternating `bg-background` / `bg-background-elevated` tones, secondary accent color (warm gray / muted gold) applied sparingly for non-coral accents (pricing checkmarks, citation chip borders)
  2. Lighthouse on Vercel preview build (mobile, 375px throttled 4G) passes ALL gates: Performance ≥ 90, Accessibility ≥ 95, LCP < 2.5s, CLS < 0.1, INP < 200ms, motion JS ≤ 200 KB gzip (excluding lazy-loaded Spline chunk verified via bundle analyzer); axe-core + pa11y CI clean (no critical/serious issues); all animations skip on `prefers-reduced-motion: reduce` (manual macOS audit clean); heading hierarchy verified (single H1, no level skips)
  3. SEO + Analytics baseline live: meta description ≤ 160 chars, JSON-LD `SoftwareApplication` schema injected, Open Graph image (`opengraph-image.tsx`) regenerated to reflect new H1 identity, Twitter `summary_large_image` card configured, canonical link tag set to production URL; `@vercel/analytics` + `@vercel/speed-insights` installed and mounted; conversion events tracked (hero primary CTA, hero secondary CTA, demo sample selection, demo result reveal, pricing tier CTA, final CTA, sign-in link); DNT/consent respected, no PII captured
  4. Davide reviews Vercel preview of `/v3` and approves cutover (LAUNCH-01 manual gate); reference-fidelity audit passes side-by-side screenshot comparison against Linear, Raycast, OpusClip (feels native to reference set, no template-slop tropes)
  5. Cutover executes: `/v3/page.tsx` content overwrites `(marketing)/page.tsx`, root layout metadata title/OG image/robots/sitemap updated (no "Artificial Societies" residue), standalone `/pricing` route deleted or 301-redirected to `/#pricing`, legacy `src/components/landing/` imports audited and removed, bundle-size regression check passes, real Whop checkout pricing applied to PRICE-05 placeholders
**Plans**: TBD
**Content gates**: **BLOCKED ON DAVIDE — pricing economics decision (Starter $, Pro $, yearly discount %) must be locked before merge per REQUIREMENTS.md Content Gates table. Davide approval on Vercel preview is the LAUNCH-01 hard gate.**
**Research flag**: SKIP
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11

Phases 4-9 are parallelizable after Phase 2 ships shared Hero primitives (Spotlight, ShimmerButton, AnimatedShinyText, BorderBeam) — see research/ARCHITECTURE.md § 8 for the component-sharing graph. Phase 11 always runs last; it is irreversible.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Scaffold | 0/TBD | Not started | - |
| 2. Hero Shell + Final CTA Bookend + Vision | 0/TBD | Not started | - |
| 3. Hero Spline Scene + Above-Fold Credibility Hook | 0/TBD | Not started | - |
| 4. Interactive Demo | 0/TBD | Not started | - |
| 5. How It Works Pipeline | 0/TBD | Not started | - |
| 6. Three Surfaces Bento + Dashboard Reveal | 0/TBD | Not started | - |
| 7. Comparison vs Alternatives | 0/TBD | Not started | - |
| 8. The Science | 0/TBD | Not started | - |
| 9. Social Proof | 0/TBD | Not started | - |
| 10. Pricing + FAQ | 0/TBD | Not started | - |
| 11. Polish, SEO, Analytics, Perf, A11y, Mobile + Cutover | 0/TBD | Not started | - |

## Content Gate Summary

| Phase | Gate | Owner | Blocking |
|-------|------|-------|----------|
| 3 | Spline `.splinecode` scene file (≤ 500 KB optimized) | Davide / designer | Phase 3 ship |
| 8 | Real paper citations (3-5 papers, author + year + DOI/URL) | Davide | Phase 8 ship |
| 8 | White paper existence decision (drives SCI-06 link/skip) | Davide | Phase 8 ship |
| 9 | Numen Machines logo lockup SVG | Davide / designer | Phase 9 ship |
| 9 | Partner logo permissions (optional — Numen Machines alone acceptable) | Davide | Phase 9 ship (optional) |
| 11 | Pricing economics decision (Starter $, Pro $, yearly %) | Davide | Phase 11 cutover merge |
| 11 | Davide approval on `/v3` Vercel preview (LAUNCH-01) | Davide | Phase 11 cutover merge |

## Traceability

Every v1 REQ-ID maps to exactly one phase. Total: 126 REQ-IDs across 17 categories.

### By Phase

| Phase | REQ-IDs | Count |
|-------|---------|-------|
| 1 | FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, FOUND-07, FOUND-08, FOUND-09, FOUND-10, MOTION-04, MOTION-05, META-03, PERF-11, PERF-13, POLISH-01, POLISH-07 | 17 |
| 2 | HERO-01, HERO-02, HERO-03, HERO-04, HERO-06, HERO-07, HERO-08, HERO-09, HERO-11, CTA-01, CTA-02, CTA-03, CTA-04, CTA-05, CTA-06, VISION-01, MOTION-01, MOTION-02, MOTION-03 | 19 |
| 3 | HERO-05, HERO-10 | 2 |
| 4 | DEMO-01, DEMO-02, DEMO-03, DEMO-04, DEMO-05, DEMO-06, DEMO-07, DEMO-08, DEMO-09, DEMO-10 | 10 |
| 5 | HOW-01, HOW-02, HOW-03, HOW-04, HOW-05, HOW-06, HOW-07 | 7 |
| 6 | BENTO-01, BENTO-02, BENTO-03, BENTO-04, BENTO-05, BENTO-06, BENTO-07 | 7 |
| 7 | CMP-01, CMP-02, CMP-03, CMP-04, CMP-05, CMP-06, CMP-07 | 7 |
| 8 | SCI-01, SCI-02, SCI-03, SCI-04, SCI-05, SCI-06, SCI-07, SCI-08, SCI-09 | 9 |
| 9 | PROOF-01, PROOF-02, PROOF-03, PROOF-04, PROOF-05, PROOF-06, PROOF-07, PROOF-08 | 8 |
| 10 | PRICE-01, PRICE-02, PRICE-03, PRICE-04, PRICE-05, PRICE-06, PRICE-07, PRICE-08, PRICE-09 | 9 |
| 11 | POLISH-02, POLISH-03, POLISH-04, POLISH-05, POLISH-06, META-01, META-02, META-04, META-05, ANALYTICS-01, ANALYTICS-02, ANALYTICS-03, ANALYTICS-04, PERF-01, PERF-02, PERF-03, PERF-04, PERF-05, PERF-06, PERF-07, PERF-08, PERF-09, PERF-10, PERF-12, LAUNCH-01, LAUNCH-02, LAUNCH-03, LAUNCH-04, LAUNCH-05, LAUNCH-06, LAUNCH-07 | 31 |
| **Total** | | **126** |

### Per-REQ Mapping (alphabetical by category)

| REQ-ID | Phase |
|--------|-------|
| ANALYTICS-01 | 11 |
| ANALYTICS-02 | 11 |
| ANALYTICS-03 | 11 |
| ANALYTICS-04 | 11 |
| BENTO-01 | 6 |
| BENTO-02 | 6 |
| BENTO-03 | 6 |
| BENTO-04 | 6 |
| BENTO-05 | 6 |
| BENTO-06 | 6 |
| BENTO-07 | 6 |
| CMP-01 | 7 |
| CMP-02 | 7 |
| CMP-03 | 7 |
| CMP-04 | 7 |
| CMP-05 | 7 |
| CMP-06 | 7 |
| CMP-07 | 7 |
| CTA-01 | 2 |
| CTA-02 | 2 |
| CTA-03 | 2 |
| CTA-04 | 2 |
| CTA-05 | 2 |
| CTA-06 | 2 |
| DEMO-01 | 4 |
| DEMO-02 | 4 |
| DEMO-03 | 4 |
| DEMO-04 | 4 |
| DEMO-05 | 4 |
| DEMO-06 | 4 |
| DEMO-07 | 4 |
| DEMO-08 | 4 |
| DEMO-09 | 4 |
| DEMO-10 | 4 |
| FOUND-01 | 1 |
| FOUND-02 | 1 |
| FOUND-03 | 1 |
| FOUND-04 | 1 |
| FOUND-05 | 1 |
| FOUND-06 | 1 |
| FOUND-07 | 1 |
| FOUND-08 | 1 |
| FOUND-09 | 1 |
| FOUND-10 | 1 |
| HERO-01 | 2 |
| HERO-02 | 2 |
| HERO-03 | 2 |
| HERO-04 | 2 |
| HERO-05 | 3 |
| HERO-06 | 2 |
| HERO-07 | 2 |
| HERO-08 | 2 |
| HERO-09 | 2 |
| HERO-10 | 3 |
| HERO-11 | 2 |
| HOW-01 | 5 |
| HOW-02 | 5 |
| HOW-03 | 5 |
| HOW-04 | 5 |
| HOW-05 | 5 |
| HOW-06 | 5 |
| HOW-07 | 5 |
| LAUNCH-01 | 11 |
| LAUNCH-02 | 11 |
| LAUNCH-03 | 11 |
| LAUNCH-04 | 11 |
| LAUNCH-05 | 11 |
| LAUNCH-06 | 11 |
| LAUNCH-07 | 11 |
| META-01 | 11 |
| META-02 | 11 |
| META-03 | 1 |
| META-04 | 11 |
| META-05 | 11 |
| MOTION-01 | 2 |
| MOTION-02 | 2 |
| MOTION-03 | 2 |
| MOTION-04 | 1 |
| MOTION-05 | 1 |
| PERF-01 | 11 |
| PERF-02 | 11 |
| PERF-03 | 11 |
| PERF-04 | 11 |
| PERF-05 | 11 |
| PERF-06 | 11 |
| PERF-07 | 11 |
| PERF-08 | 11 |
| PERF-09 | 11 |
| PERF-10 | 11 |
| PERF-11 | 1 |
| PERF-12 | 11 |
| PERF-13 | 1 |
| POLISH-01 | 1 |
| POLISH-02 | 11 |
| POLISH-03 | 11 |
| POLISH-04 | 11 |
| POLISH-05 | 11 |
| POLISH-06 | 11 |
| POLISH-07 | 1 |
| PRICE-01 | 10 |
| PRICE-02 | 10 |
| PRICE-03 | 10 |
| PRICE-04 | 10 |
| PRICE-05 | 10 |
| PRICE-06 | 10 |
| PRICE-07 | 10 |
| PRICE-08 | 10 |
| PRICE-09 | 10 |
| PROOF-01 | 9 |
| PROOF-02 | 9 |
| PROOF-03 | 9 |
| PROOF-04 | 9 |
| PROOF-05 | 9 |
| PROOF-06 | 9 |
| PROOF-07 | 9 |
| PROOF-08 | 9 |
| SCI-01 | 8 |
| SCI-02 | 8 |
| SCI-03 | 8 |
| SCI-04 | 8 |
| SCI-05 | 8 |
| SCI-06 | 8 |
| SCI-07 | 8 |
| SCI-08 | 8 |
| SCI-09 | 8 |
| VISION-01 | 2 |

**Coverage:** 126/126 REQ-IDs mapped ✓ — no orphans, no duplicates.

---

*Last updated: 2026-05-24 — Roadmap created by gsd-roadmapper. Phase count: 11 (cap enforced per v3.0 abandonment lesson). All section work staged at `/v3`; root landing untouched until Phase 11 cutover.*
