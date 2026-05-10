# Requirements: Landing Page Redesign

**Defined:** 2026-05-11
**Milestone:** Landing Page Redesign (worktree-scoped)
**Core Value:** AI-powered content intelligence that tells TikTok creators whether their content will resonate — and connects them to monetization opportunities.
**Bar:** Production landing — conversion-tuned, mobile responsive, original copy throughout, reads as venture-quality.

## Milestone Requirements

Requirements grouped by section. Each maps to one roadmap phase. All requirements are **user-centric** (what the visitor experiences) and **testable**.

### Hero (above-fold)

- [ ] **HERO-01**: Visitor sees an above-fold hero with eyebrow (`VIRTUNA · A NUMEN MACHINES PRODUCT`), H1, subhead, primary CTA, secondary CTA, and a hero visual on initial page load
- [ ] **HERO-02**: Primary CTA reads "Sign up free" (or equivalent free-tier framing) and routes to `/signup` or `/onboarding`
- [ ] **HERO-03**: Secondary CTA is a soft option (e.g., "See pricing" link or "How it works ↓" scroll anchor) — no second primary
- [ ] **HERO-04**: Hero visual uses layered UI fragments pattern (Raycast-style floating UI tiles on dark gradient) with subtle CSS-only motion on scroll/hover
- [ ] **HERO-05**: Hero copy avoids the words "viral" and "AI" in H1 and brand-spine sentence

### Trust band (logo strip / social proof immediately below hero)

- [ ] **TRUST-01**: Visitor sees a social-proof band immediately under the hero showing creator count, press logos, or "trusted by N" framing
- [ ] **TRUST-02**: Band uses real numbers/logos when available; placeholder treatment is acceptable in milestone but flagged in code for replacement before public launch

### Three Surfaces bento

- [ ] **SURF-01**: Visitor sees a bento section presenting the 3 product surfaces — Prediction · Competitor Intelligence · Brand Deals
- [ ] **SURF-02**: Each bento tile embeds a visual representation (screenshot fragment, abstract viz, or mock UI) of its surface — no separate screenshot dump section
- [ ] **SURF-03**: Each tile shows a name, one-line value prop, and is interactive (routes or scrolls to deeper explanation)
- [ ] **SURF-04**: Bento layout adapts to mobile by stacking vertically (no horizontal carousel)

### How it works (engine pipeline)

- [ ] **PIPE-01**: Visitor sees a "How it works" section with the prediction engine pipeline as a numbered sequence (Linear "1.0 → 5.0" pattern)
- [ ] **PIPE-02**: Each pipeline step has a name, one-line description, and a small visual or icon
- [ ] **PIPE-03**: Pipeline includes subtle scroll-triggered or in-view motion (Linear/Vercel style — never maximalist beams/glow)

### The Science (research moat timeline)

- [ ] **SCI-01**: Visitor sees a "Science" section presenting Virtuna's behavioral-research moat as a chronological timeline (ElevenLabs pattern)
- [ ] **SCI-02**: Timeline includes citation chips, dataset stats, and at least 3 chronological research milestones
- [ ] **SCI-03**: Section reads to non-technical creators (no PhD prerequisites) while still satisfying investor/press scrutiny

### Audience tabs (Built for creators / investors)

- [ ] **AUD-01**: Visitor sees an audience-tab section with at least 2 audience tracks (e.g., "For creators" and "For investors/press")
- [ ] **AUD-02**: Each tab presents 2-4 statements/value props relevant to that audience
- [ ] **AUD-03**: Tab interaction is keyboard accessible and announces tab changes to screen readers

### Social proof (testimonials + metrics)

- [ ] **PROOF-01**: Visitor sees a social-proof section with a 3-up static grid of creator testimonials (no carousel)
- [ ] **PROOF-02**: Section includes accuracy or platform metrics (e.g., predictions made, accuracy %, creators served)
- [ ] **PROOF-03**: Testimonials show creator name, handle, avatar, and quote — placeholder content OK in milestone but flagged for real-quote replacement before public launch

### Tool consolidation calculator

- [ ] **CALC-01**: Visitor sees an interactive widget calculating "Virtuna replaces N tools, saves $X/mo"
- [ ] **CALC-02**: Widget lets the user toggle which tools they currently pay for (competitor analyzer, hashtag tool, viral predictor, etc.) and updates the savings calculation live
- [ ] **CALC-03**: Widget has sensible defaults so non-interactive viewers see a meaningful headline number on first paint
- [ ] **CALC-04**: Calculator anchors into the pricing section with the calculated savings carried forward visually (continuity, not just a button)

### Pricing (Starter / Pro)

- [ ] **PRICE-01**: Visitor sees a pricing section presenting Starter and Pro tiers side-by-side
- [ ] **PRICE-02**: Each tier shows price, key features included, and a CTA appropriate to the tier
- [ ] **PRICE-03**: Pro tier surfaces the 7-day trial offer explicitly
- [ ] **PRICE-04**: Pricing CTAs route to the existing Whop checkout / signup flow (already shipped infrastructure)

### FAQ + Final CTA + Footer

- [ ] **FAQ-01**: Visitor sees a FAQ section with 5-8 collapsible questions, each answered in 1-3 sentences
- [ ] **FAQ-02**: Visitor sees a final CTA block as a closing card repeating the primary CTA
- [ ] **FAQ-03**: Footer includes Numen Machines parent-brand lockup, key navigation links, social links, and legal links

### Original copy (cross-cutting)

- [ ] **COPY-01**: Every customer-facing word on the page is original — zero plagiarized Artificial Societies copy across all 10 sections
- [ ] **COPY-02**: Brand-spine sentence (replacement for v3.0's "Your audience, simulated") emerges during implementation and is finalized before the milestone closes

### System-wide quality

- [ ] **SYS-01**: Page is fully mobile responsive across all 10 sections — single-column stack, visual hierarchy preserved, no horizontal overflow
- [ ] **SYS-02**: Page passes WCAG AA contrast (≥ 4.5:1 for body text, ≥ 3:1 for large text) on all text/background combinations
- [ ] **SYS-03**: Page renders without console errors and without React hydration warnings
- [ ] **SYS-04**: Lighthouse performance score ≥ 90 on desktop and ≥ 80 on mobile; LCP < 2.5s on a fast 4G profile

## Future Requirements (deferred)

Carried over from prior milestones; not in this milestone's scope.

### Supporting brand pages

- **PAGE-01**: `/about` page extending the brand spine
- **PAGE-02**: `/research` page extending The Science section into long-form
- **PAGE-03**: `/manifesto` page (if brand spine warrants one)

### In-app prediction visualization

- **VIZ-01**: Rebuild the in-app prediction visualization to match the new brand-aligned visual metaphor (deferred from v3.0)

### Live demo

- **DEMO-01**: Replace static hero/screenshot visuals with a live "paste TikTok URL → see prediction" embedded demo on the landing page

### Hero visual upgrade

- **HERO-V2**: Swap the layered UI fragments hero visual for a polished looping product video/screencast (kept as in-milestone option but not a default requirement)

## Out of Scope

Explicitly excluded for this milestone.

| Feature | Reason |
|---------|--------|
| `/about`, `/research`, `/manifesto` separate pages | Single `/` only; CTAs may stub these but pages don't ship |
| Live `paste URL → prediction` backend call | Static demo decision — backend integration deferred |
| Light-mode theme variant | Dark-mode-first per project constraint |
| In-app prediction-viz rebuild | Visual metaphor lock from v3.0 carried forward; in-app rebuild is a separate future milestone |
| Reviving v3.0 Brand Statement Landing artifacts beyond carryover | Predecessor abandoned 2026-05-11; full redesign over staged replacement |
| "Viral" and "AI" in H1 / brand spine | Overused, weakens $100M+ venture positioning |
| Maximalist motion-template aesthetic (animated beams everywhere, neon glow) | Conflicts with Anthropic/Linear/Raycast vibe |
| Carousel testimonials | < 1% engagement past slide 1 (research-validated) |
| Multiple primary CTAs per section | Dilutes conversion intent |
| Standalone product-screenshot dump section | Visuals belong embedded in feature/surface sections |

## Carryover (from v3.0 archive)

- `BRAND-BIBLE.md` at repo root — Phase 01 of v3.0 wrote the visual metaphor lock content; preserved as evolvable reference
- `src/components/ui/button.tsx` — Radix Slot `asChild` SSR bug fix from v3.0 Phase 02 plan 04 (real bug fix, kept)
- `.planning/milestones/v3.0-brand-statement-landing/` — full v3.0 artifacts archive (read-only reference)

## Traceability

Populated by ROADMAP.md creation (2026-05-11). All 36 requirements mapped to exactly one phase. No orphans, no duplicates.

| Requirement | Phase | Status |
|-------------|-------|--------|
| HERO-01 | Phase 2 — Hero & Trust Band | Pending |
| HERO-02 | Phase 2 — Hero & Trust Band | Pending |
| HERO-03 | Phase 2 — Hero & Trust Band | Pending |
| HERO-04 | Phase 2 — Hero & Trust Band | Pending |
| HERO-05 | Phase 2 — Hero & Trust Band | Pending |
| TRUST-01 | Phase 2 — Hero & Trust Band | Pending |
| TRUST-02 | Phase 2 — Hero & Trust Band | Pending |
| SURF-01 | Phase 3 — Three Surfaces Bento | Pending |
| SURF-02 | Phase 3 — Three Surfaces Bento | Pending |
| SURF-03 | Phase 3 — Three Surfaces Bento | Pending |
| SURF-04 | Phase 3 — Three Surfaces Bento | Pending |
| PIPE-01 | Phase 4 — How It Works + The Science | Pending |
| PIPE-02 | Phase 4 — How It Works + The Science | Pending |
| PIPE-03 | Phase 4 — How It Works + The Science | Pending |
| SCI-01 | Phase 4 — How It Works + The Science | Pending |
| SCI-02 | Phase 4 — How It Works + The Science | Pending |
| SCI-03 | Phase 4 — How It Works + The Science | Pending |
| AUD-01 | Phase 5 — Audience Tabs + Social Proof | Pending |
| AUD-02 | Phase 5 — Audience Tabs + Social Proof | Pending |
| AUD-03 | Phase 5 — Audience Tabs + Social Proof | Pending |
| PROOF-01 | Phase 5 — Audience Tabs + Social Proof | Pending |
| PROOF-02 | Phase 5 — Audience Tabs + Social Proof | Pending |
| PROOF-03 | Phase 5 — Audience Tabs + Social Proof | Pending |
| CALC-01 | Phase 6 — Calculator + Pricing | Pending |
| CALC-02 | Phase 6 — Calculator + Pricing | Pending |
| CALC-03 | Phase 6 — Calculator + Pricing | Pending |
| CALC-04 | Phase 6 — Calculator + Pricing | Pending |
| PRICE-01 | Phase 6 — Calculator + Pricing | Pending |
| PRICE-02 | Phase 6 — Calculator + Pricing | Pending |
| PRICE-03 | Phase 6 — Calculator + Pricing | Pending |
| PRICE-04 | Phase 6 — Calculator + Pricing | Pending |
| FAQ-01 | Phase 7 — FAQ + Final CTA + Footer | Pending |
| FAQ-02 | Phase 7 — FAQ + Final CTA + Footer | Pending |
| FAQ-03 | Phase 7 — FAQ + Final CTA + Footer | Pending |
| COPY-01 | Phase 8 — Copy + System Hardening | Pending |
| COPY-02 | Phase 8 — Copy + System Hardening | Pending |
| SYS-01 | Phase 8 — Copy + System Hardening | Pending |
| SYS-02 | Phase 8 — Copy + System Hardening | Pending |
| SYS-03 | Phase 8 — Copy + System Hardening | Pending |
| SYS-04 | Phase 8 — Copy + System Hardening | Pending |

**Coverage:**
- Milestone requirements: 36 total
- Mapped to phases: 36 (100%)
- Unmapped: 0
- Phase 1 (Foundation & Route Scaffolding) has no direct requirement mapping — it is enabling infrastructure that every later phase depends on (Magic UI vetting, route scaffolding to replace plagiarized template). Without Phase 1, Phase 2 cannot ship a hero on a clean route.

---
*Requirements defined: 2026-05-11*
*Last updated: 2026-05-11 — Traceability populated by gsd-roadmapper*
