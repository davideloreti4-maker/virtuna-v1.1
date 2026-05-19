# Requirements — Linear Landing Clone

**Milestone:** Linear Landing Clone
**Goal:** Ship a single-page landing site for Virtuna at top-tier production craft quality, replacing the existing landing route entirely.

## Original-content boundary (non-negotiable)

- Linear's landing page is a **visual craft reference** for production quality (typography rhythm, spacing rigor, motion polish, scroll feel)
- **Every word of customer-facing copy is original to Virtuna**
- **Every illustration, graphic, animation, and brand asset is original to Virtuna**
- **Section composition is derived from Virtuna's product narrative**, not lifted from any reference site
- Coral `#FF7F50` is Virtuna's brand color; no reference-site palette is adopted
- Every section requires a written **section brief** (grounded in Virtuna's product story) **before** any markup. This is the primary derivative-feel prevention.

## v1 Requirements

### Foundation + Cross-Cutting Gates (Phase 1)

- [ ] **FOUND-01**: Existing `src/components/landing/` (14 files from abandoned milestones) deleted in a single commit
- [ ] **FOUND-02**: Existing landing route at `src/app/page.tsx` (root) backed up to git history and replaced with a clean baseline
- [ ] **FOUND-03**: Route-scoped token layer `src/app/(marketing)/landing.css` created with display-type scale (fluid `clamp()` values), motion easings, and gradient tokens. **No** mutations to global `@theme` in `globals.css`.
- [ ] **FOUND-04**: `lenis` 1.3.23 installed; `LenisProvider` wraps `(marketing)/layout.tsx` only (not app routes — breaks Radix dialogs)
- [ ] **FOUND-05**: `LazyMotion` provider configured for landing route (saves ~29KB initial JS); landing components use `m.*` not `motion.*`
- [ ] **FOUND-06**: Inter `next/font` config extended with `axes: ['opsz']` for optical sizing; verify `font-optical-sizing: auto` survives Tailwind v4 base reset
- [ ] **FOUND-07**: `next.config.ts` updated with `formats: ['image/avif', 'image/webp']`
- [ ] **FOUND-08**: `@next/bundle-analyzer` installed as devDep; `ANALYZE=true pnpm build` documented
- [ ] **FOUND-09**: Web Vitals tracking component wired (Next.js `useReportWebVitals`); logs to console in dev, ready for analytics integration
- [ ] **FOUND-10**: `MotionWrapper` pattern documented and exemplified — thin `"use client"` wrappers around animated leaves, never section-level
- [ ] **FOUND-11**: Visual fidelity harness at `verification/scripts/visual-comparison.spec.ts` updated with new section selectors; `data-section="<name>"` attributes documented as a convention
- [ ] **FOUND-12**: Craft quality rubric written (`.planning/CRAFT-RUBRIC.md`): typography precision, spacing rhythm, motion smoothness, mobile responsive bar, contrast — replaces "pixel-match Linear" as the assessment lens
- [ ] **FOUND-13**: Phase-gate checklist documented: Playwright @ 375 / 768 / 1280 px, Lighthouse mobile LCP < 2.5s + CLS < 0.1, production build verification (`next build && next start`), dashboard regression snapshot (token leakage check), `git diff --name-only` scope guard
- [ ] **FOUND-14**: Section brief template written (`.planning/SECTION-BRIEF-TEMPLATE.md`): purpose in Virtuna's narrative, audience served, content (original Virtuna copy), interaction goals, success criteria. No section ships without a completed brief.

### Nav + Hero (Phase 2)

- [ ] **HERO-01**: `LandingNav` component built — sticky, fixed-top, blur-on-scroll, scroll-shrink behavior; mobile drawer; sign-in / get-started CTAs
- [ ] **HERO-02**: Scroll progress indicator — thin coral bar at top of viewport, tracks scroll depth, smooth via Lenis scroll-progress hook
- [ ] **HERO-03**: Hero section above-fold — eyebrow / pre-headline + H1 + sub-headline + dual CTA + product UI screenshot
- [ ] **HERO-04**: Hero **copy (H1 + sub + eyebrow + CTAs)** written fresh, grounded in Virtuna's product narrative. No language reuse from prior milestones unless explicitly re-decided. Captured in Phase 2 section brief.
- [ ] **HERO-05**: Hero product UI visual — static screenshot of the prediction-result UI (highest-trust visual). Stored as AVIF + WebP, `next/image` with `priority`, no `loading="lazy"`. No layout shift on mount.
- [ ] **HERO-06**: Hero entry animation **CSS-driven** (not JS) to avoid LCP regression. No `initial={{ opacity: 0 }}` on the hero element itself.
- [ ] **HERO-07**: Mobile hero at 375px — H1 hierarchy preserved, CTAs stacked, screenshot resized via art direction, no horizontal scroll
- [ ] **HERO-08**: Hero passes Phase 1 gate checklist (Playwright snapshots, Lighthouse LCP, production build, dashboard regression, scope diff)

### Feature Bento — Three Surfaces (Phase 3)

- [ ] **BENTO-01**: `LandingFeatureCard` variant forked from existing card (larger padding, gradient border on hover using landing tokens)
- [ ] **BENTO-02**: Mixed-size bento grid: Prediction = 2×2 flagship card, Competitor Intelligence = 1×1, Brand Deals = 1×1
- [ ] **BENTO-03**: Each card content: headline + 1-2 line description + product UI fragment as visual. **No body paragraphs inside cards.**
- [ ] **BENTO-04**: Card copy (3 surfaces × headlines + descriptions) written fresh, captured in Phase 3 section brief
- [ ] **BENTO-05**: Visual fragments — small product-UI snippets (~400×300) showing each surface in use; AVIF + WebP, lazy-loaded below the fold
- [ ] **BENTO-06**: Hover interactions per card: subtle scale + gradient border, hardware-accelerated only, fires-once on hover (no continuous animation)
- [ ] **BENTO-07**: Mobile: single-column stack, card sizes equalize, hover → tap-pressed state
- [ ] **BENTO-08**: Bento passes phase gate checklist

### How It Works (Phase 4)

- [ ] **HOW-01**: Scroll-pinned two-panel section: sticky left panel (visual that transitions between 3 states) + scrolling right column (3 step cards)
- [ ] **HOW-02**: 3 steps reflect Virtuna's actual flow — input → analysis → results. Step copy written fresh in Phase 4 brief.
- [ ] **HOW-03**: Sticky visual uses CSS `position: sticky`, not JS scroll listeners. Each step transition triggers via `useInView` on the step card.
- [ ] **HOW-04**: Visual transitions between steps are state changes on a single composed element (no separate visuals layered with opacity crossfade — cleaner, smaller bundle)
- [ ] **HOW-05**: Mobile: sticky two-panel falls back to sequential cards stacked vertically (no scroll-pinning on mobile — too jank-prone)
- [ ] **HOW-06**: Section passes phase gate checklist

### Behavioral Science Moat (Phase 5)

- [ ] **MOAT-01**: Dedicated section after How It Works: section title + intro + research citation chips + dataset stat counters + "why this is hard to copy" framing
- [ ] **MOAT-02**: Citation chips reference real behavioral science / psychology / ML research backing the prediction model. Source list curated in Phase 5 brief.
- [ ] **MOAT-03**: Dataset stat counters: predictions made, model accuracy (if shippable), training data size, calibration metrics — animate count-up on `useInView`
- [ ] **MOAT-04**: Visual treatment lab-coded — monospace numeric, citation typography, restrained palette. Distinct from product-screenshot sections.
- [ ] **MOAT-05**: Section copy written fresh in Phase 5 brief — original Virtuna voice, no language lifted from research papers verbatim beyond minimal cited terms
- [ ] **MOAT-06**: Mobile responsive at 375 / 768 / 1280
- [ ] **MOAT-07**: Section passes phase gate checklist

### Social Proof — Stat Counters (Phase 6)

- [ ] **PROOF-01**: Stat counter row (3-4 counters): creators using Virtuna, predictions made, average accuracy, brand deals matched (subset shippable as real numbers)
- [ ] **PROOF-02**: Stat counter animation: count-up on `useInView`, runs once, finishes in < 2s, reduced-motion fallback shows final value statically
- [ ] **PROOF-03**: Stat values sourced from real platform metrics where available; otherwise aspirational targets with footnote
- [ ] **PROOF-04**: No testimonials in v1 (deferred until creator quotes are gathered). No logo strip (not yet enough partners). No placeholder testimonials.
- [ ] **PROOF-05**: Section passes phase gate checklist

### Pricing + Footer (Phase 7)

- [ ] **PRICE-01**: Two-card pricing layout — Starter (free) + Pro elevated (recommended badge). Card heights equal at desktop, stacked on mobile.
- [ ] **PRICE-02**: Annual / monthly toggle at section header; toggles update both card prices via state
- [ ] **PRICE-03**: Each card lists 4-6 features; "7-day trial" note in Pro CTA
- [ ] **PRICE-04**: Collapsible "Compare all features" table below cards — full feature matrix, accessible details/summary or accordion pattern
- [ ] **PRICE-05**: FAQ accordion (4-6 items) embedded below pricing — billing, cancellation, refunds, trial, plan changes. Items written fresh in Phase 7 brief.
- [ ] **PRICE-06**: Pricing CTAs read Whop plan IDs from env vars (`WHOP_PRODUCT_ID_STARTER`, `WHOP_PRODUCT_ID_PRO`); placeholders fall back to `/signup` until env vars are populated
- [ ] **PRICE-07**: Minimal footer — logo lockup, ~3 columns of links (Product / Company / Legal), small print, social icons. No newsletter signup, no maximalist link density.
- [ ] **PRICE-08**: Section passes phase gate checklist

### Motion Polish + QA (Phase 8)

- [ ] **POLISH-01**: Cross-browser audit — Chrome / Safari / Firefox / mobile Safari / Chrome Android. Document and fix any visual regression.
- [ ] **POLISH-02**: Reduced-motion audit — every animation respects `prefers-reduced-motion: reduce`; static fallbacks verified
- [ ] **POLISH-03**: Bundle analyzer run (`ANALYZE=true pnpm build`); top dependency report logged. Verify Lenis is ~40KB, motion library tree-shaken.
- [ ] **POLISH-04**: Full-page Lighthouse run — mobile LCP < 2.5s, CLS < 0.1, INP < 200ms, Accessibility ≥ 95
- [ ] **POLISH-05**: Final craft rubric sign-off — typography precision, spacing rhythm, motion smoothness, contrast, mobile bar all PASS
- [ ] **POLISH-06**: Production build smoke test (`pnpm build && pnpm start`) — verify backdrop-filter renders, no hydration warnings, no console errors
- [ ] **POLISH-07**: Dashboard regression snapshot — confirm no token leakage from landing route into `/app/*` routes
- [ ] **POLISH-08**: Command-K palette **deferred** (not in v1; revisit in next milestone if user value confirms)

## Future Requirements (deferred)

- Live demo widget in hero (paste TikTok URL → see prediction) — requires API feasibility spike and pricing-tier gating decisions. Defer to its own milestone.
- Testimonials section with real creator quotes — gather quotes from active users first
- Logo strip of partners — gather sufficient brand-deal partners first
- /about, /research, /manifesto supporting pages
- Animated product walkthrough hero (vs static screenshot) — revisit if static hero underperforms
- Command-K palette on landing — power-user nice-to-have

## Out of Scope (explicit exclusions)

- Reproducing linear.app's specific copy, headlines, taglines, or phrasing — every word original to Virtuna
- Reproducing linear.app's specific illustrations, animations, or distinctive creative compositions — every visual asset original to Virtuna
- Adopting Linear's purple-gradient palette — coral `#FF7F50` stays as Virtuna's brand identity
- Restructuring the dashboard's Raycast-aesthetic visual system — landing tokens are scoped to the landing route only
- Light mode variant — dark-mode first stays
- TikTok OAuth on landing — manual @handle input pattern stays
- In-app surface redesigns — out of scope this milestone
- Brand spine "Your audience, simulated." from prior abandoned milestone — discarded; fresh copy direction
- Live prediction demo widget — deferred to its own milestone (API feasibility + tier gating)
- Real testimonials section — deferred until creator quotes are gathered
- Logo strip — deferred until enough brand-deal partners exist
- Command-K palette on landing route — deferred

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Pending |
| FOUND-02 | Phase 1 | Pending |
| FOUND-03 | Phase 1 | Pending |
| FOUND-04 | Phase 1 | Pending |
| FOUND-05 | Phase 1 | Pending |
| FOUND-06 | Phase 1 | Pending |
| FOUND-07 | Phase 1 | Pending |
| FOUND-08 | Phase 1 | Pending |
| FOUND-09 | Phase 1 | Pending |
| FOUND-10 | Phase 1 | Pending |
| FOUND-11 | Phase 1 | Pending |
| FOUND-12 | Phase 1 | Pending |
| FOUND-13 | Phase 1 | Pending |
| FOUND-14 | Phase 1 | Pending |
| HERO-01 | Phase 2 | Pending |
| HERO-02 | Phase 2 | Pending |
| HERO-03 | Phase 2 | Pending |
| HERO-04 | Phase 2 | Pending |
| HERO-05 | Phase 2 | Pending |
| HERO-06 | Phase 2 | Pending |
| HERO-07 | Phase 2 | Pending |
| HERO-08 | Phase 2 | Pending |
| BENTO-01 | Phase 3 | Pending |
| BENTO-02 | Phase 3 | Pending |
| BENTO-03 | Phase 3 | Pending |
| BENTO-04 | Phase 3 | Pending |
| BENTO-05 | Phase 3 | Pending |
| BENTO-06 | Phase 3 | Pending |
| BENTO-07 | Phase 3 | Pending |
| BENTO-08 | Phase 3 | Pending |
| HOW-01 | Phase 4 | Pending |
| HOW-02 | Phase 4 | Pending |
| HOW-03 | Phase 4 | Pending |
| HOW-04 | Phase 4 | Pending |
| HOW-05 | Phase 4 | Pending |
| HOW-06 | Phase 4 | Pending |
| MOAT-01 | Phase 5 | Pending |
| MOAT-02 | Phase 5 | Pending |
| MOAT-03 | Phase 5 | Pending |
| MOAT-04 | Phase 5 | Pending |
| MOAT-05 | Phase 5 | Pending |
| MOAT-06 | Phase 5 | Pending |
| MOAT-07 | Phase 5 | Pending |
| PROOF-01 | Phase 6 | Pending |
| PROOF-02 | Phase 6 | Pending |
| PROOF-03 | Phase 6 | Pending |
| PROOF-04 | Phase 6 | Pending |
| PROOF-05 | Phase 6 | Pending |
| PRICE-01 | Phase 7 | Pending |
| PRICE-02 | Phase 7 | Pending |
| PRICE-03 | Phase 7 | Pending |
| PRICE-04 | Phase 7 | Pending |
| PRICE-05 | Phase 7 | Pending |
| PRICE-06 | Phase 7 | Pending |
| PRICE-07 | Phase 7 | Pending |
| PRICE-08 | Phase 7 | Pending |
| POLISH-01 | Phase 8 | Pending |
| POLISH-02 | Phase 8 | Pending |
| POLISH-03 | Phase 8 | Pending |
| POLISH-04 | Phase 8 | Pending |
| POLISH-05 | Phase 8 | Pending |
| POLISH-06 | Phase 8 | Pending |
| POLISH-07 | Phase 8 | Pending |
| POLISH-08 | Phase 8 | Pending |

---
*Generated: 2026-05-19 — Linear Landing Clone milestone requirements*
