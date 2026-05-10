# Requirements: Brand Statement Landing

**Defined:** 2026-05-10
**Milestone:** Brand Statement Landing
**Core Value:** AI-powered content intelligence that tells TikTok creators whether their content will resonate — and connects them to monetization opportunities.

**Brand spine** (used everywhere): *"Your audience, simulated."*

**Hero treatment** (locked):
- Pre-headline: `VIRTUNA · A NUMEN MACHINES PRODUCT`
- H1: *"Predict how your audience will respond. Before you post."*
- Sub-headline: *"Virtuna simulates your audience to forecast every video before it ships."*
- Subline: *"Trained on decades of behavioral research. Self-improving with every outcome."*
- CTAs: `Run a prediction →` (primary) + `See the science` (secondary)

**Reference set:** Anthropic + Linear + Raycast + Vercel.

**Quality bar:** Every section reads at a $100M+ venture standard against the reference set.

---

## v1 Requirements

### Hero / Above-fold (HERO)

- [ ] **HERO-01**: Pre-headline lockup `VIRTUNA · A NUMEN MACHINES PRODUCT` rendered in small monospaced uppercase, restrained
- [ ] **HERO-02**: H1 "Predict how your audience will respond. Before you post." rendered oversized, light weight, Inter, with two-line break preserved on all viewports
- [ ] **HERO-03**: Sub-headline "Virtuna simulates your audience to forecast every video before it ships." rendered medium weight, distinct hierarchy from H1
- [ ] **HERO-04**: Subline carries behavioral-research moat language (decades of research, self-improving) without "viral" or "AI"
- [ ] **HERO-05**: Dual CTA — primary `Run a prediction →` (auth-gated, routes to dashboard) + secondary `See the science` (jumps to Science section)
- [ ] **HERO-06**: Behavioral-simulation visual — animated audience-particles reacting to a video stimulus, aggregating into a confidence score
- [ ] **HERO-07**: Ambient gradient backdrop using coral #FF7F50 + Raycast neutral palette; subtle, non-distracting, respects reduced-motion
- [ ] **HERO-08**: Mobile hero stacks vertically with hero hierarchy preserved; behavioral simulation scales gracefully or simplifies under 640px
- [ ] **HERO-09**: Above-fold passes reference-fidelity audit against Anthropic / Linear / Vercel / Raycast comparable heroes
- [ ] **HERO-10**: Hero copy contains zero "viral" or "AI" terms (vocab guardrail)

### Try It / Live Demo (DEMO)

- [ ] **DEMO-01**: TikTok URL input field with controlled state and pattern validation
- [ ] **DEMO-02**: On submit, prediction result UI renders (placeholder/abstract viz acceptable for this milestone)
- [ ] **DEMO-03**: Loading state shows simulated processing steps for 3-5 seconds — visible "engine working" feedback
- [ ] **DEMO-04**: Result includes prediction score + confidence interval + 1-2 audience-response indicators (e.g. "78% of your audience would watch past 3s")
- [ ] **DEMO-05**: Empty / error / invalid-URL states render friendly recovery UI; never broken-looking
- [ ] **DEMO-06**: "Try a sample video" fallback button with pre-baked URL for visitors who don't want to paste their own
- [ ] **DEMO-07**: Demo viewport scrolls naturally from hero (no scroll-jacking)
- [ ] **DEMO-08**: Mobile demo flow has no horizontal scroll, input is keyboard-friendly

### How It Works (WORKS)

- [ ] **WORKS-01**: Engine-pipeline diagram showing 4 stages — video → analyze → simulate audience → predict
- [ ] **WORKS-02**: Subtle motion triggered by intersection observer; pulses through stages once on viewport entry, not loop-spam
- [ ] **WORKS-03**: Each stage has 1-line label and iconographic representation
- [ ] **WORKS-04**: Section headline frames the moat without duplicating hero language
- [ ] **WORKS-05**: Mobile renders vertical stage stack with same labels and icons; motion preserved or simplified
- [ ] **WORKS-06**: Pipeline visual reads as Linear/Vercel-style structured (not Magic UI maximalist)

### Three Surfaces / Bento (SURF)

- [ ] **SURF-01**: Bento grid with 3 cells — Prediction · Competitor Intelligence · Brand Deals (existing validated capabilities)
- [ ] **SURF-02**: Each cell contains short headline + 1-sentence description + mini-screenshot or abstract iconography + "Learn more" link (CTA stub if destination doesn't exist yet)
- [ ] **SURF-03**: Cells use Raycast card pattern — bg-transparent, 6% borders, 12px radius, inset shadow per BRAND-BIBLE
- [ ] **SURF-04**: Hover state on each cell is `bg-white/[0.02]` only — no translate-y, no border change (Raycast convention)
- [ ] **SURF-05**: Mobile collapses to 1-column stack; cell heights normalize for visual consistency
- [ ] **SURF-06**: Section frames Virtuna as a *platform* rather than single tool — multi-audience signal

### The Science (SCI)

- [ ] **SCI-01**: Section headline frames behavioral-research moat (e.g. "Why audience matters more than trends")
- [ ] **SCI-02**: 3-5 citation chips or research surfaces — datasets, papers, principles — surface credibility without academic stuffiness
- [ ] **SCI-03**: Dataset stats — number of behavioral data points, training scale, or honest "growing dataset" framing if not yet impressive
- [ ] **SCI-04**: Self-improving loop visualized — feedback → retrain → improve as small inline diagram or kinetic text
- [ ] **SCI-05**: Lab-coded aesthetic — monospace accents, restrained color, research-paper feel; Anthropic-grade polish, not academic ugliness
- [ ] **SCI-06**: Section reads as Numen Machines lab credibility without overselling or fabricating

### Social Proof / Metrics (PROOF)

- [ ] **PROOF-01**: 3-5 creator quotes with attribution — handle, niche, follower count if shippable
- [ ] **PROOF-02**: Quotes use marquee or static grid; chosen format vetted for Raycast-native feel
- [ ] **PROOF-03**: Platform metrics — predictions run, creators using Virtuna, accuracy / confidence intervals — only metrics that hold up under scrutiny ship here
- [ ] **PROOF-04**: Honest framing — early-stage metrics framed as "early signal" rather than fake-impressive numbers
- [ ] **PROOF-05**: Optional logo strip if any meaningful brand partnerships exist; skip if forced

### Pricing & Conversion (PRICE)

- [ ] **PRICE-01**: Two-tier comparison — Starter (free or low) vs Pro (paid) with feature matrix
- [ ] **PRICE-02**: Pricing card uses Raycast card aesthetic; primary CTA highlighted on Pro tier
- [ ] **PRICE-03**: 7-day Pro trial messaging surfaced (matches existing Whop integration)
- [ ] **PRICE-04**: Single primary CTA at bottom — "Start free" or "Run a prediction" — reuses existing dashboard auth flow
- [ ] **PRICE-05**: Footer with Numen Machines lockup, social links, legal links, copyright
- [ ] **PRICE-06**: Mobile pricing cards stack vertically; comparison reflows clearly without losing scan-ability

### Brand Spine & Voice (BRAND)

- [ ] **BRAND-01**: Brand spine "Your audience, simulated." codified in `.planning/reference/BRAND-SPINE.md` as the canonical one-liner
- [ ] **BRAND-02**: Voice & language doc captures tone, vocab guardrails (avoid "viral" / "AI" / "go viral" / generic marketing-speak), preferred verbs (predict, simulate, forecast, learn, improve)
- [ ] **BRAND-03**: Numen Machines lockup pattern documented — when to lead with it vs use as tag
- [ ] **BRAND-04**: Three-audience framing (creators primary; investors/partners absorb) encoded in voice doc
- [ ] **BRAND-05**: Plagiarized Artificial Societies copy replaced across the live site — every customer-facing word audited for originality
- [ ] **BRAND-06**: Headline + subline + CTA copy authored to brand-spine standard before build, signed off by Davide

### Build & Quality (BUILD)

- [ ] **BUILD-01**: Built from scratch on shadcn primitives + Tailwind v4 + existing 36-component design system
- [ ] **BUILD-02**: External component imports (Magic UI / Aceternity / Origin UI / Cult UI) vetted for Raycast-native feel; rejection criteria documented
- [ ] **BUILD-03**: Lighthouse ≥ 95 on Performance / Accessibility / Best Practices, mobile and desktop
- [ ] **BUILD-04**: Core Web Vitals — LCP < 2.5s, CLS < 0.1, INP < 200ms
- [ ] **BUILD-05**: WCAG AA throughout; reduced-motion fallback for all animations; full keyboard navigation
- [ ] **BUILD-06**: Mobile responsiveness verified across all 7 viewports on iPhone-class viewport (375px) and tablet
- [ ] **BUILD-07**: Reference-fidelity audit — each viewport reviewed against Anthropic / Linear / Vercel / Raycast equivalents; passes $100M+ bar
- [ ] **BUILD-08**: TypeScript strict; zero `any`; `pnpm lint` and `pnpm build` clean
- [ ] **BUILD-09**: Replaces existing `/src/app/page.tsx` (live landing page); no parallel `/landing-v2` route — this *is* the landing
- [ ] **BUILD-10**: Auth-gated CTAs route correctly to dashboard onboarding for logged-out vs logged-in users

### Visual Metaphor Lock (VIZ)

- [ ] **VIZ-01**: Behavioral-simulation visual concept locked — animated audience particles reacting to a video stimulus, aggregating into a confidence score
- [ ] **VIZ-02**: Engine-pipeline visual concept locked — 4-stage diagram (analyze → simulate → predict → score) with subtle pulse motion
- [ ] **VIZ-03**: Visual concepts work at hero scale, mobile scale, and future in-app embed scale
- [ ] **VIZ-04**: Implementation choice (canvas / SVG / WebGL / framer-motion / motion / GSAP) decided in plan-phase research; performance budget < 50KB JS for hero motion
- [ ] **VIZ-05**: Both visuals documented in BRAND-BIBLE addendum as "the visual language of Virtuna" — used everywhere going forward

---

## Future Requirements (deferred)

### Supporting Pages

- **PAGES-01**: /about page extending brand spine
- **PAGES-02**: /research or /science page with deeper behavioral-research story
- **PAGES-03**: /manifesto page (Numen Machines → Virtuna lineage)
- **PAGES-04**: Press kit page with media assets
- **PAGES-05**: Founders / team section with photos and bios

### Long-form & Content

- **CONTENT-01**: Long-form blog architecture for research posts
- **CONTENT-02**: Changelog / "what's new" page

### Optimization

- **OPT-01**: A/B testing framework for hero variants
- **OPT-02**: Light-mode variant for landing
- **OPT-03**: i18n / multi-language support
- **OPT-04**: Sound design / audio reactivity in behavioral simulation

### In-app Continuation

- **APP-01**: In-app prediction viz rebuild using locked visual metaphor (separate future milestone)

---

## Out of Scope (this milestone)

| Feature | Reason |
|---------|--------|
| Reviving paused `milestone/landing-page` branch | Officially abandoned in favor of fresh start |
| In-app prediction viz implementation | Visual metaphor locked here; build deferred to a separate milestone |
| Separate /about, /research, /manifesto pages | Out of scope this milestone; landing CTAs may stub them |
| Maximalist motion-template aesthetic (animated beams everywhere, neon glow, particle swarms) | Conflicts with Anthropic / Linear / Raycast reference vibe |
| "Viral" and "AI" in H1 / brand spine | Overused, weakens $100M+ venture positioning |
| Multi-language i18n | English-only first |
| Storybook integration for landing-only components | Existing showcase sufficient |
| Dedicated mobile native landing | Web responsive sufficient |
| Real-time A/B testing infrastructure | Premature; ship one strong v1 first |
| TikTok OAuth on landing | Manual @handle input sufficient; matches existing onboarding |

---

## Traceability

<!-- Filled by roadmapper: maps each REQ-ID to its phase. -->

| Requirement | Phase | Status |
|-------------|-------|--------|
| (empty — populated when roadmap is created) | | |

**Coverage:**
- v1 requirements: 56 total
- Mapped to phases: 0
- Unmapped: 56 ⚠️ (filled by roadmapper)

---
*Requirements defined: 2026-05-10*
*Last updated: 2026-05-10 after initial definition for Brand Statement Landing milestone*
