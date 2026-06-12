# Requirements: Numen Landing (v5.1)

**Defined:** 2026-06-11
**Core Value:** The intelligence that tells creators whether their content will resonate — an honest verdict they can believe, not a hype score. The landing must make that legible in seconds and convert.
**Source spec:** `.planning/LANDING-STRUCTURE.md` (locked reference set + section wireframe + discipline)

## v1 Requirements

Requirements for the shippable MVP landing. Each maps to roadmap phases.

### Hero (HERO)

- [ ] **HERO-01**: Above-fold hero with an intelligence/verdict headline + subhead + primary CTA, mobile-first
- [ ] **HERO-02**: Hero centerpiece is a real Reading staged on a real creator video (krea/luma content-as-hero), full-bleed, chrome minimal — NOT a stock photo or fake browser window
- [ ] **HERO-03**: Verdict shown as a calibrated band + one-line why (no naked number, no "X% accuracy")
- [ ] **HERO-04**: Hero uses the calm stage-reveal motion language (StageBlock / `numen-ease-calm`) with a reduced-motion fallback

### The Reading explained (READ)

- [ ] **READ-01**: Three-step explainer of the real flow — upload → engine reads → verdict + why
- [ ] **READ-02**: Each step shows real content as the demonstration (content is both demo and navigation)

### Honesty moat / anti-snake-oil (TRUST)

- [ ] **TRUST-01**: A trust section contrasting Numen's calibrated, honest verdict against the "virality score" snake-oil tier
- [ ] **TRUST-02**: Comparison framing (kero comparison-table move) of Numen vs fake-precision rivals — zero "X% accuracy" claims anywhere on the page

### Real Readings gallery (GALLERY)

- [ ] **GALLERY-01**: Gallery of real Readings across ≥3 distinct creator niches (specificity over abstract claims)
- [ ] **GALLERY-02**: Gallery items render as gallery-quality content centerpieces (luma staging), not feature diagrams

### Social proof / credibility (PROOF)

- [ ] **PROOF-01**: Social-proof block (creator testimonials and/or live waitlist count)
- [ ] **PROOF-02**: Credibility anchored early on the page where real assets exist

### Conversion (CTA)

- [ ] **CTA-01**: Primary conversion CTA (try / join waitlist) in hero and repeated near footer
- [ ] **CTA-02**: CTA routes to the app entry or waitlist capture and records the signup

### Copy / voice (CONTENT)

- [x] **CONTENT-01**: All copy uses the calm, confident-mentor voice, plain language, NO engine jargon (inherits in-app voice baseline)
- [ ] **CONTENT-02**: Positioning reads "honest verdict creators can believe," explicitly not hype

### Design-system consumption (DS)

- [x] **DS-01**: Landing consumes the Numen Surface Phase 1 `.numen-surface` token layer + primitives — no forked or reinvented tokens
- [ ] **DS-02**: Build tolerates placeholder tokens and swaps to final tokens on Phase 1 calibration lock
- [ ] **DS-03**: Brand-DNA coherence with the app (logo, verdict color language); landing palette tone may diverge per D-L1

### Motion & structure (MOT)

- [ ] **MOT-01**: Calm scroll-driven section reveals reusing the in-app motion language; no bounce/snappy, no presence theater
- [x] **MOT-02**: Section rhythm/pacing modeled on kero's spine

### Nav & shell (NAV)

- [x] **NAV-01**: Minimal, product-focused top nav + footer

### Performance / SEO / a11y (PERF)

- [ ] **PERF-01**: Mobile-first responsive; hero media optimized for fast load (LCP)
- [x] **PERF-02**: SEO meta + social share/OG cards
- [ ] **PERF-03**: Accessibility — APCA contrast inherited from DS, reduced-motion fallback, semantic structure

## v2 Requirements

Deferred to future release. Tracked, not in this roadmap.

### Use cases / personas (USECASE)

- **USECASE-01**: Segmented use-case/persona section (solo creators, agencies, brands)

### Content marketing (BLOG)

- **BLOG-01**: Blog / articles section (kero has one; not MVP)

### Localization (I18N)

- **I18N-01**: Multi-language landing

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| "X% accuracy" / "predict virality" hype claims | Anti-thesis; the honesty stance IS the differentiator (TRUST) |
| Stock photography, fake browser/window chrome, glass-over-photo | Kero "skin" the vision forbids; product is the hero instead |
| Content generation features/demos | Numen is intelligence, not a generation tool (why Runway/Krea dropped as positioning) |
| Auth, payments, onboarding flows | Landing only; the app owns those |
| Anthropic-landing palette cloning | Anthropic was an in-app palette reference only, off the landing |
| Forking/redefining design tokens | Must consume Numen Surface Phase 1 kit (DS-01) |

## Open Decisions (resolve during build)

| ID | Decision | Lean | Resolving phase |
|----|----------|------|-----------------|
| D-L1 | Landing palette: inherit app warm-neutral vs run cooler/cinematic | keyframes carry chroma either way; chrome tone TBD | Phase 4 (token lock) |
| D-L2 | Hero: live interactive Reading vs recorded stage-reveal loop | perf/reliability vs interactivity | Phase 2 (hero spike) |
| D-L3 | Final token swap gated on Phase 1 calibration sign-off | placeholder-tolerant until then | Phase 4 (token lock) |
| D-L4 | Launch credibility assets (testimonials/waitlist/investor logos) | depends what exists at launch | Phase 3 (proof) |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DS-01 | Phase 1 | Complete |
| DS-02 | Phase 1 | Pending |
| NAV-01 | Phase 1 | Complete |
| CONTENT-01 | Phase 1 | Complete |
| MOT-02 | Phase 1 | Complete |
| PERF-02 | Phase 1 | Complete |
| HERO-01 | Phase 2 | Pending |
| HERO-02 | Phase 2 | Pending |
| HERO-03 | Phase 2 | Pending |
| HERO-04 | Phase 2 | Pending |
| READ-01 | Phase 2 | Pending |
| READ-02 | Phase 2 | Pending |
| CTA-01 | Phase 2 | Pending |
| TRUST-01 | Phase 3 | Pending |
| TRUST-02 | Phase 3 | Pending |
| GALLERY-01 | Phase 3 | Pending |
| GALLERY-02 | Phase 3 | Pending |
| PROOF-01 | Phase 3 | Pending |
| PROOF-02 | Phase 3 | Pending |
| CONTENT-02 | Phase 3 | Pending |
| CTA-02 | Phase 3 | Pending |
| DS-03 | Phase 4 | Pending |
| MOT-01 | Phase 4 | Pending |
| PERF-01 | Phase 4 | Pending |
| PERF-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 24 total (DS-01, DS-02, NAV-01, CONTENT-01, MOT-02, PERF-02 in P1; HERO-01..04, READ-01, READ-02, CTA-01 in P2; TRUST-01/02, GALLERY-01/02, PROOF-01/02, CONTENT-02, CTA-02 in P3; DS-03, MOT-01, PERF-01, PERF-03 in P4)
- Mapped to phases: 24 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-11*
*Last updated: 2026-06-11 — roadmap created, all 24 v1 requirements mapped across 4 phases*
