---
milestone: Linear Landing Clone
phases: 8
granularity: fine
coverage: 64/64
created: 2026-05-19
---

# Roadmap — Linear Landing Clone

**Milestone goal:** Ship a single-page landing site for Virtuna at top-tier production craft quality, replacing the existing landing route entirely.

**Original-content gate (non-negotiable — propagates into every phase):**
Every section requires a written Virtuna-product-narrative section brief before any markup. Linear's landing page is a craft quality reference only — not a blueprint for composition, layout proportions, section order, or motion choreography. Coral `#FF7F50` stays; no reference-site palette is adopted.

---

## Phases

- [ ] **Phase 1: Foundation + Cross-Cutting Gates** — Delete legacy landing artifacts, wire token layer, motion architecture, harness, rubric, and section brief process. All per-phase gates originate here.
- [ ] **Phase 2: Nav + Hero** — Sticky nav, scroll progress indicator, and hero section — the primary conversion surface and LCP candidate.
- [ ] **Phase 3: Feature Bento (Three Surfaces)** — Mixed-size bento grid showcasing Prediction, Competitor Intel, and Brand Deals with product UI fragments.
- [ ] **Phase 4: How It Works** — Scroll-pinned two-panel walkthrough mapping Virtuna's actual input → analysis → results flow.
- [ ] **Phase 5: Behavioral Science Moat** — Dedicated section establishing Virtuna's research-backed differentiator — citations, stat counters, lab aesthetic.
- [ ] **Phase 6: Social Proof — Stat Counters** — Stat counter row with count-up animation; no placeholder testimonials.
- [ ] **Phase 7: Pricing + Footer** — Two-card pricing layout, annual/monthly toggle, FAQ accordion, comparison table, and minimal footer.
- [ ] **Phase 8: Motion Polish + QA** — Cross-browser audit, reduced-motion formal pass, bundle check, full Lighthouse run, and craft rubric sign-off.

---

## Phase Details

### Phase 1: Foundation + Cross-Cutting Gates

**Goal:** Establish every gate, guard, and shared primitive that subsequent phases depend on — token layer, motion architecture, visual fidelity harness, craft rubric, and section brief process — so no derivative-feel or technical pitfall can be introduced undetected in phases 2-8.

**Depends on:** Nothing (prerequisite for all other phases)

**Requirements:** FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, FOUND-07, FOUND-08, FOUND-09, FOUND-10, FOUND-11, FOUND-12, FOUND-13, FOUND-14

**Success Criteria** (what must be TRUE):
1. `src/app/(marketing)/landing.css` exists with display type scale, motion easings, and gradient tokens — all dark values in hex (no oklch at L < 0.15); `LenisProvider` wraps only `(marketing)/layout.tsx`; `LazyMotion` + `m.*` pattern is the established motion convention for all subsequent landing components
2. `next build && next start` passes with zero hydration warnings, backdrop-filter effects render correctly in production (not just dev), and Playwright dashboard regression snapshot shows zero change from baseline
3. `verification/scripts/visual-comparison.spec.ts` is updated with new `data-section="<name>"` selectors; `.planning/CRAFT-RUBRIC.md` is written and agreed; `.planning/SECTION-BRIEF-TEMPLATE.md` is written — no section ships in any later phase without a completed brief
4. `git diff --name-only` for this phase shows only `(marketing)/`, `src/components/landing/`, `src/hooks/`, `next.config.ts`, and `package.json` — zero dashboard route files in diff
5. Playwright snapshots at 375 / 768 / 1280 px confirm no horizontal overflow, no missing content; Lighthouse mobile LCP < 2.5s + CLS < 0.1 on the baseline empty landing page

**Plans:** 13 plans across 5 waves

Plans:
- [ ] 01-00-PLAN.md — Wave 0: pnpm install, add lenis + @next/bundle-analyzer, rename existing analyze → analyze:dataset, capture pre-Phase-1 /app/dashboard baseline snapshot
- [ ] 01-01-PLAN.md — Wave 1: create src/app/(marketing)/landing.css with `@layer landing` token block (display scale, motion easings, gradient tokens, hex-for-darks surfaces)
- [ ] 01-02-PLAN.md — Wave 1: create LenisProvider client component (inline prefers-reduced-motion detection per RESEARCH §2)
- [ ] 01-03-PLAN.md — Wave 1: create LandingMotionProvider + MotionWrapper (LazyMotion strict + canonical m.* leaf example)
- [ ] 01-04-PLAN.md — Wave 1: create WebVitalsReporter + extend Inter font with axes:['opsz']
- [ ] 01-05-PLAN.md — Wave 1: create scripts/check-landing-scope.ts CI guard + wire prebuild in package.json
- [ ] 01-06-PLAN.md — Wave 1: rewrite next.config.ts (AVIF/WebP, /pricing→/#pricing redirect, withBundleAnalyzer composition) + add analyze*pn scripts
- [ ] 01-07-PLAN.md — Wave 2: write .planning/CRAFT-RUBRIC.md (6 dimensions + AS-01..AS-15 + bundle budget + phase-gate checklist + locked landmines + Pitfall C)
- [ ] 01-08-PLAN.md — Wave 2: write .planning/SECTION-BRIEF-TEMPLATE.md (7-subsection template per D-04)
- [ ] 01-09-PLAN.md — Wave 2: extend visual-comparison.spec.ts with data-section selectors + reference baselines + dashboard regression entry; change playwright.config desktop viewport 1440 → 1280
- [ ] 01-10-PLAN.md — Wave 2: create verification/scripts/capture-references.spec.ts + wire capture:refs script
- [ ] 01-11-PLAN.md — Wave 3 ATOMIC: delete 14 legacy landing components + delete (marketing)/pricing/ + REWRITE (marketing)/layout.tsx (fix duplicate html/body, wire providers) + REPLACE (marketing)/page.tsx with 7-section scaffold — ONE COMMIT
- [ ] 01-12-PLAN.md — Wave 4: fetch DESIGN.md files, run capture:refs, install Taste Skill, run baseline pnpm run analyze, insert bundle figure into CRAFT-RUBRIC.md, full validation suite, Davide visual sign-off checkpoint

**Duration estimate:** 1-2 days

**UI hint**: yes

---

### Phase 2: Nav + Hero

**Goal:** Deliver the sticky nav and hero section — the primary conversion surface, LCP candidate, and highest derivative-feel risk area — with section brief written and LCP gate passed.

**Depends on:** Phase 1

**Requirements:** HERO-01, HERO-02, HERO-03, HERO-04, HERO-05, HERO-06, HERO-07, HERO-08

**Success Criteria** (what must be TRUE):
1. Visitor at 1280 / 768 / 375 px sees a sticky nav that is transparent at the top, transitions to dark with backdrop-filter on scroll, shows mobile drawer, and always exposes sign-in / get-started CTAs — backdrop-filter verified in `next build && next start`, not just dev
2. Hero section copy (H1, subheadline, eyebrow, CTAs) is written from the Virtuna-product-narrative section brief (no language lifted from reference site or prior milestones); product UI screenshot is loaded with `next/image priority`, no `loading="lazy"`, no layout shift on mount
3. Lighthouse mobile LCP < 2.5s and CLS < 0.1; hero entry animation is CSS-driven (no `initial={{ opacity: 0 }}` on the H1); H1 visible pre-hydration
4. Playwright snapshots at 375 / 768 / 1280 px pass; `git diff --name-only` contains only landing-route and landing-component files
5. Mobile hero at 375 px: H1 hierarchy preserved, CTAs stacked, screenshot resized, no horizontal scroll

**Plans:** TBD

**Duration estimate:** 1.5-2 days

**UI hint**: yes

---

### Phase 3: Feature Bento (Three Surfaces)

**Goal:** Communicate Virtuna's three product surfaces — Prediction, Competitor Intel, Brand Deals — through a mixed-size bento grid with product UI fragment visuals and staggered scroll reveal.

**Depends on:** Phase 1

**Requirements:** BENTO-01, BENTO-02, BENTO-03, BENTO-04, BENTO-05, BENTO-06, BENTO-07, BENTO-08

**Success Criteria** (what must be TRUE):
1. Bento grid renders with Prediction as a 2×2 flagship card and Competitor Intelligence + Brand Deals as 1×1 cards; each card contains headline + 1-2 line description + product UI fragment (~400×300 AVIF/WebP); no body paragraphs inside cards; card copy written fresh from Phase 3 section brief
2. `LandingFeatureCard` is a fork (not modification) of the existing card with larger padding and gradient border on hover using `--landing-gradient-feature-border`; hover interaction is hardware-accelerated (transform + opacity only), fires once on hover
3. StaggerReveal integration: cards fade and slide up (60-80ms stagger) on scroll entry via `whileInView` with `viewport={{ once: true }}`
4. Mobile: single-column stack at 375 px; card sizes equalize; hover becomes tap-pressed state; no horizontal overflow
5. Playwright snapshots at 375 / 768 / 1280 px pass; Lighthouse CLS < 0.1; `git diff --name-only` scoped to landing files only

**Plans:** TBD

**Duration estimate:** 2-3 days

**UI hint**: yes

---

### Phase 4: How It Works

**Goal:** Deliver the scroll-pinned two-panel walkthrough that maps Virtuna's actual input → analysis → results flow, with CSS-driven sticky layout and mobile fallback.

**Depends on:** Phase 1 (tokens + motion primitives); Phase 3 recommended first (narrative arc — bento introduces surfaces, How It Works deepens them)

**Requirements:** HOW-01, HOW-02, HOW-03, HOW-04, HOW-05, HOW-06

**Success Criteria** (what must be TRUE):
1. Desktop (1280 px): sticky left panel holds a product visual that transitions between 3 states (input → analysis → results); right column's step cards scroll normally; transitions triggered via `useInView` on each step card; CSS `position: sticky` drives pinning (no JS scroll listeners for layout)
2. Step copy (3 steps) is written fresh in Phase 4 section brief, mapping exactly to Virtuna's actual user flow; no generic "Upload → Analyze → Download" language
3. Visual transitions between steps are state changes on a single composed element (no opacity crossfade layering multiple visuals); only `transform` and `opacity` animated during scroll — Chrome DevTools Performance tab confirms no layout recalculation during scroll
4. Mobile (375 px): sticky two-panel falls back to sequential cards stacked vertically; no scroll-pinning on mobile; section reads correctly with no horizontal overflow
5. Playwright snapshots at 375 / 768 / 1280 px pass; Lighthouse CLS < 0.1; `git diff --name-only` scoped to landing files only

**Plans:** TBD

**Duration estimate:** 2-3 days

**UI hint**: yes

---

### Phase 5: Behavioral Science Moat

**Goal:** Establish Virtuna's research-backed moat — behavioral science + ML research citations, dataset stat counters, and distinctive lab-coded visual treatment — as a dedicated section that communicates why the prediction model is hard to replicate.

**Depends on:** Phase 1; executes after Phase 4 in the page narrative

**Requirements:** MOAT-01, MOAT-02, MOAT-03, MOAT-04, MOAT-05, MOAT-06, MOAT-07

**Success Criteria** (what must be TRUE):
1. Section contains: title + intro copy + citation chips referencing real behavioral science / psychology / ML research + dataset stat counters + "why this is hard to copy" framing — all written fresh from Phase 5 section brief in Virtuna's original voice, no verbatim language from research papers
2. Citation chips link to or cite real sources curated in the Phase 5 brief; dataset stat counters (predictions made, accuracy if shippable, training data size, calibration metrics) animate count-up on `useInView`, run once, finish in < 2s, reduced-motion fallback shows final value statically
3. Visual treatment is distinct from product-screenshot sections: monospace numerics, citation typography, restrained palette — no product UI fragments; section feels like a lab readout, not a marketing pitch
4. Mobile responsive at 375 / 768 / 1280 px with no horizontal overflow; section reads correctly on all viewports
5. Playwright snapshots at 375 / 768 / 1280 px pass; Lighthouse CLS < 0.1; `git diff --name-only` scoped to landing files only

**Plans:** TBD

**Duration estimate:** 1.5-2 days

**UI hint**: yes

---

### Phase 6: Social Proof — Stat Counters

**Goal:** Deliver a credible stat counter row sourced from real platform metrics (or confirmed aspirational targets with footnotes), with count-up animation and reduced-motion fallback — no placeholder testimonials, no logo strip without real partners.

**Depends on:** Phase 1; can execute in parallel with Phases 3-5 after Phase 1 lands

**Requirements:** PROOF-01, PROOF-02, PROOF-03, PROOF-04, PROOF-05

**Success Criteria** (what must be TRUE):
1. Stat counter row (3-4 counters) is visible with real numbers (or aspirational targets with footnotes); no placeholder or lorem ipsum values; no testimonials (deferred); no logo strip (deferred)
2. Count-up animation fires on `useInView` (once), completes in < 2s; `prefers-reduced-motion` fallback renders final value statically without animation
3. Mobile: counters stack or reflow cleanly at 375 px; no horizontal overflow; numbers remain legible
4. Playwright snapshots at 375 / 768 / 1280 px pass; Lighthouse CLS < 0.1; `git diff --name-only` scoped to landing files only
5. PROOF-04 confirmed: no testimonials with fabricated or placeholder attribution; no logo strip without confirmed partners

**Plans:** TBD

**Duration estimate:** 0.5-1 day

**UI hint**: yes

---

### Phase 7: Pricing + Footer

**Goal:** Deliver the conversion endpoint — two-card pricing with monthly/annual toggle, collapsible feature comparison table, FAQ accordion, and minimal footer — with Whop plan IDs read from env vars and FAQ copy written fresh.

**Depends on:** Phase 1; executes after Phases 2-6 are done (pricing is the final conversion step in the narrative)

**Requirements:** PRICE-01, PRICE-02, PRICE-03, PRICE-04, PRICE-05, PRICE-06, PRICE-07, PRICE-08

**Success Criteria** (what must be TRUE):
1. Two pricing cards (Starter + Pro) are visible side-by-side at desktop; Pro card carries "recommended" badge; annual/monthly toggle at section header updates both card prices via state; "7-day trial" note visible in Pro CTA
2. "Compare all features" table is collapsed by default, expands on click via accessible details/summary or accordion pattern; FAQ accordion (4-6 items) is embedded below cards with billing/cancellation/refunds/trial/plan-change coverage — all copy written fresh from Phase 7 section brief
3. Pricing CTAs read `WHOP_PRODUCT_ID_STARTER` and `WHOP_PRODUCT_ID_PRO` from env vars; if env vars are absent, CTAs fall back to `/signup` with a code comment marking the stub
4. Footer: logo lockup + ~3 columns of links (Product / Company / Legal) + small print with dynamic copyright year + social icons; no newsletter signup; no hardcoded year
5. Playwright snapshots at 375 / 768 / 1280 px pass; Lighthouse CLS < 0.1; cards stack correctly on mobile; `git diff --name-only` scoped to landing files only

**Plans:** TBD

**Duration estimate:** 2-3 days

**UI hint**: yes

---

### Phase 8: Motion Polish + QA

**Goal:** Achieve holistic craft rubric sign-off across all sections — cross-browser verification, reduced-motion formal audit, bundle check within targets, full Lighthouse pass, and zero regressions on dashboard routes.

**Depends on:** Phases 2, 3, 4, 5, 6, 7 (all content phases must be complete)

**Requirements:** POLISH-01, POLISH-02, POLISH-03, POLISH-04, POLISH-05, POLISH-06, POLISH-07, POLISH-08

**Success Criteria** (what must be TRUE):
1. Cross-browser audit complete: Chrome, Safari, Firefox, mobile Safari, Chrome Android — all visual regressions documented and fixed; oklch dark tokens verified correct in both Safari and Chrome; backdrop-filter renders in production build (verified via `pnpm build && pnpm start`)
2. `prefers-reduced-motion: reduce` audit complete — every animated element has a static fallback; verified in iOS Safari simulator or real device
3. Bundle analyzer run (`ANALYZE=true pnpm build`): Lenis ~40 KB, motion library tree-shaken; top dependency report logged; hero critical path under 200 KB gzipped
4. Full-page Lighthouse (mobile): LCP < 2.5s, CLS < 0.1, INP < 200ms, Accessibility ≥ 95 — no section regressed from per-phase gates
5. Craft rubric sign-off: typography precision, spacing rhythm, motion smoothness, mobile responsive bar, and WCAG contrast — all PASS; no console hydration errors; dashboard Playwright regression snapshot confirms zero token leakage from landing route into `/app/*` routes

**Plans:** TBD

**Duration estimate:** 1-2 days

**UI hint**: yes

---

## Dependencies

```
Phase 1 ──────────────────────────── prerequisite for ALL phases
         │
         ├── Phase 2 (Nav + Hero) ────────────────────────────────┐
         │                                                         │
         ├── Phase 3 (Feature Bento) ──────────────────────┐      │
         │         │ (recommended first: introduces surfaces)      │
         ├── Phase 4 (How It Works) ◄───────────────────────┘      │
         │                                                         │
         ├── Phase 5 (Behavioral Science Moat) ────────────────────┤
         │                                                         │
         ├── Phase 6 (Social Proof — Stat Counters) ───────────────┤
         │                                                         │
         └── Phase 7 (Pricing + Footer) ◄──────────────────────────┘
                                 │
                           Phase 8 (Motion Polish + QA)
                           [depends on ALL of 2-7]
```

**Parallelization note:** After Phase 1 lands, Phases 2, 3, 5, and 6 can run in parallel (no hard dependencies between them). Phase 4 is recommended after Phase 3 (narrative arc). Phase 7 is recommended last among content phases (Whop plan ID dependency + conversion endpoint). Phase 8 waits for all content phases.

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Cross-Cutting Gates | 0/13 | Plans written | - |
| 2. Nav + Hero | 0/— | Not started | - |
| 3. Feature Bento (Three Surfaces) | 0/— | Not started | - |
| 4. How It Works | 0/— | Not started | - |
| 5. Behavioral Science Moat | 0/— | Not started | - |
| 6. Social Proof — Stat Counters | 0/— | Not started | - |
| 7. Pricing + Footer | 0/— | Not started | - |
| 8. Motion Polish + QA | 0/— | Not started | - |

---

## Requirement Coverage

All 64 v1 requirements mapped. 0 orphans.

| REQ-ID | Phase |
|--------|-------|
| FOUND-01 | Phase 1 |
| FOUND-02 | Phase 1 |
| FOUND-03 | Phase 1 |
| FOUND-04 | Phase 1 |
| FOUND-05 | Phase 1 |
| FOUND-06 | Phase 1 |
| FOUND-07 | Phase 1 |
| FOUND-08 | Phase 1 |
| FOUND-09 | Phase 1 |
| FOUND-10 | Phase 1 |
| FOUND-11 | Phase 1 |
| FOUND-12 | Phase 1 |
| FOUND-13 | Phase 1 |
| FOUND-14 | Phase 1 |
| HERO-01 | Phase 2 |
| HERO-02 | Phase 2 |
| HERO-03 | Phase 2 |
| HERO-04 | Phase 2 |
| HERO-05 | Phase 2 |
| HERO-06 | Phase 2 |
| HERO-07 | Phase 2 |
| HERO-08 | Phase 2 |
| BENTO-01 | Phase 3 |
| BENTO-02 | Phase 3 |
| BENTO-03 | Phase 3 |
| BENTO-04 | Phase 3 |
| BENTO-05 | Phase 3 |
| BENTO-06 | Phase 3 |
| BENTO-07 | Phase 3 |
| BENTO-08 | Phase 3 |
| HOW-01 | Phase 4 |
| HOW-02 | Phase 4 |
| HOW-03 | Phase 4 |
| HOW-04 | Phase 4 |
| HOW-05 | Phase 4 |
| HOW-06 | Phase 4 |
| MOAT-01 | Phase 5 |
| MOAT-02 | Phase 5 |
| MOAT-03 | Phase 5 |
| MOAT-04 | Phase 5 |
| MOAT-05 | Phase 5 |
| MOAT-06 | Phase 5 |
| MOAT-07 | Phase 5 |
| PROOF-01 | Phase 6 |
| PROOF-02 | Phase 6 |
| PROOF-03 | Phase 6 |
| PROOF-04 | Phase 6 |
| PROOF-05 | Phase 6 |
| PRICE-01 | Phase 7 |
| PRICE-02 | Phase 7 |
| PRICE-03 | Phase 7 |
| PRICE-04 | Phase 7 |
| PRICE-05 | Phase 7 |
| PRICE-06 | Phase 7 |
| PRICE-07 | Phase 7 |
| PRICE-08 | Phase 7 |
| POLISH-01 | Phase 8 |
| POLISH-02 | Phase 8 |
| POLISH-03 | Phase 8 |
| POLISH-04 | Phase 8 |
| POLISH-05 | Phase 8 |
| POLISH-06 | Phase 8 |
| POLISH-07 | Phase 8 |
| POLISH-08 | Phase 8 |

---

*Generated: 2026-05-19 — Linear Landing Clone milestone*
*Coverage: 64/64 REQ-IDs across 8 phases (14 FOUND + 8 HERO + 8 BENTO + 6 HOW + 7 MOAT + 5 PROOF + 8 PRICE + 8 POLISH)*
