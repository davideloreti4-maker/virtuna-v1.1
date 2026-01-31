# Requirements — Virtuna v1.3.2

**Defined:** 2026-01-31
**Core Value:** Premium Raycast-inspired landing page with iOS 26 aesthetic

## v1.3.2 Requirements

### Foundation (FOUND)

- [ ] **FOUND-01**: Dark theme color system with proper design tokens
- [ ] **FOUND-02**: GlassPanel component with configurable blur and opacity
- [ ] **FOUND-03**: GradientGlow component for lighting effects
- [ ] **FOUND-04**: TrafficLights component (macOS window buttons)
- [ ] **FOUND-05**: iOS 26 depth system (shadows, layers, elevation tokens)
- [ ] **FOUND-06**: Gradient palette with distinct color identities per feature

### Hero Section (HERO)

- [ ] **HERO-01**: Dramatic gradient background with animated lighting
- [ ] **HERO-02**: macOS window mockup with traffic lights and glass panels
- [ ] **HERO-03**: Bold headline typography matching Raycast style
- [ ] **HERO-04**: CTA buttons with premium hover effects
- [ ] **HERO-05**: Static app preview screenshot inside mockup

### Feature Cards (CARD)

- [ ] **CARD-01**: GradientCard component with distinct color identity
- [ ] **CARD-02**: Icon + title + description layout matching Raycast
- [ ] **CARD-03**: Hover state with scale (1.02-1.05x) and glow effect
- [ ] **CARD-04**: Staggered scroll-triggered entrance animations

### Navigation (NAV)

- [ ] **NAV-01**: Sticky header with glassmorphism effect
- [ ] **NAV-02**: Logo + navigation links layout
- [ ] **NAV-03**: CTA button in header with hover state
- [ ] **NAV-04**: Mobile responsive navigation

### Animations (ANIM)

- [ ] **ANIM-01**: Scroll-triggered fade/slide animations for sections
- [ ] **ANIM-02**: Button hover effects with spring physics
- [ ] **ANIM-03**: 60fps performance on desktop and mobile
- [ ] **ANIM-04**: `prefers-reduced-motion` support throughout
- [ ] **ANIM-05**: Stagger utilities for grouped element animations

### Quality & Polish (QA)

- [ ] **QA-01**: Cross-browser testing (Chrome, Safari, Firefox)
- [ ] **QA-02**: Safari `-webkit-backdrop-filter` prefix handling
- [ ] **QA-03**: Mobile performance optimization (reduced blur on mobile)
- [ ] **QA-04**: Accessibility: text contrast on glass backgrounds
- [ ] **QA-05**: Mobile responsive design (375px - 1440px)

## v1.3.3 Requirements (Deferred)

Features split from v1.3.2 for cleaner scope:

- **HERO-06**: Animated product demo inside mockup (live app preview)
- **HERO-07**: Floating UI elements with depth and parallax
- **CARD-05**: Interactive demo elements within cards

## Out of Scope

| Feature | Reason |
|---------|--------|
| Additional marketing pages | Homepage focus only for v1.3.2 |
| App dashboard redesign | Separate milestone if desired |
| Real product data | Mock data sufficient for design |
| Full iOS 26 Liquid Glass | Web approximation, not native fidelity |
| Complex node network animation | Deferred from v1.1, not in scope |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 15 | Pending |
| FOUND-02 | Phase 15 | Pending |
| FOUND-03 | Phase 15 | Pending |
| FOUND-04 | Phase 15 | Pending |
| FOUND-05 | Phase 15 | Pending |
| FOUND-06 | Phase 15 | Pending |
| HERO-01 | Phase 16 | Pending |
| HERO-02 | Phase 16 | Pending |
| HERO-03 | Phase 16 | Pending |
| HERO-04 | Phase 16 | Pending |
| HERO-05 | Phase 16 | Pending |
| CARD-01 | Phase 17 | Pending |
| CARD-02 | Phase 17 | Pending |
| CARD-03 | Phase 17 | Pending |
| CARD-04 | Phase 17 | Pending |
| NAV-01 | Phase 18 | Pending |
| NAV-02 | Phase 18 | Pending |
| NAV-03 | Phase 18 | Pending |
| NAV-04 | Phase 18 | Pending |
| ANIM-01 | Phase 18 | Pending |
| ANIM-02 | Phase 18 | Pending |
| ANIM-03 | Phase 18 | Pending |
| ANIM-04 | Phase 18 | Pending |
| ANIM-05 | Phase 18 | Pending |
| QA-01 | Phase 19 | Pending |
| QA-02 | Phase 19 | Pending |
| QA-03 | Phase 19 | Pending |
| QA-04 | Phase 19 | Pending |
| QA-05 | Phase 19 | Pending |

**Coverage:**
- v1.3.2 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0 ✓
- Deferred to v1.3.3: 3

---
*Requirements defined: 2026-01-31*
*Last updated: 2026-01-31 — Scope refined, 3 features deferred to v1.3.3*
