# Roadmap: Virtuna v2.0 — Design System Foundation

## Overview

This milestone extracts Raycast's complete design system from raycast.com and implements it as Virtuna's foundation with coral (#FF7F50) branding. The journey progresses from token extraction and validation through core components, extended patterns, effects, showcase pages, and finally verification and documentation. Each phase builds on the previous, delivering a production-ready design system that enables rapid, consistent UI development.

## Milestones

- v1.1 Pixel-Perfect Clone — Phases 1-10 (shipped 2026-01-29)
- v1.2 Visual Accuracy Refinement — Phases 11-14 (shipped 2026-01-30)
- v1.3.2 - v1.7 — Phases 15-38 (archived 2026-02-03)
- **v2.0 Design System Foundation** — Phases 39-44 (in progress)

---

<details>
<summary>v1.1 Pixel-Perfect Clone (Phases 1-10) - SHIPPED 2026-01-29</summary>

### Phase 1: Infrastructure Setup
**Goal**: Complete development environment and deployment pipeline
**Status**: Complete (2026-01-28)
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Create Next.js App Router structure + Supabase utilities
- [x] 01-02-PLAN.md — Verify build + Vercel deployment

**Success Criteria**:
- [x] App deploys to Vercel on push
- [x] Supabase Auth configured and tested
- [x] All env vars properly set

**Requirements Covered**: I1, I2, I3

---

### Phase 2: Design System & Components
**Goal**: Build reusable component library matching societies.io design
**Status**: Complete (2026-01-28)
**Plans**: 5 plans

Plans:
- [x] 02-01-PLAN.md — Foundation setup (design tokens, cn() utility, fonts)
- [x] 02-02-PLAN.md — Base UI components (Button, Input, Card, Skeleton)
- [x] 02-03-PLAN.md — Layout components (Container, Header, Footer)
- [x] 02-04-PLAN.md — Animation components (FadeIn, SlideUp, PageTransition)
- [x] 02-05-PLAN.md — Showcase page + visual verification checkpoint

**Success Criteria**:
- [x] All base components match societies.io styling
- [x] Consistent design tokens across project
- [x] Components are reusable and documented

**Requirements Covered**: AN1, AN2, AN3

---

### Phase 3-10: Landing, App, Society, Tests, Results, History, Settings, QA
**Status**: Complete (2026-01-29)

All phases completed. See archived details.

</details>

---

<details>
<summary>v1.2 Visual Accuracy Refinement (Phases 11-14) - SHIPPED 2026-01-30</summary>

**Milestone Goal:** Achieve 98%+ pixel accuracy against app.societies.io through systematic extraction, comparison, and iterative refinement.

### Phase 11: Extraction
**Goal**: Complete screenshot coverage of every screen, state, and interactive element
**Status**: Complete (2026-01-30)
**Plans**: 4 plans

### Phase 12: Comparison
**Goal**: Document every visual discrepancy with v0 MCP-powered analysis
**Status**: Complete (2026-01-30)
**Plans**: 4 plans

</details>

---

<details>
<summary>v1.3.2 - v1.7 (Phases 15-38) - ARCHIVED 2026-02-03</summary>

**Status:** Archived for complete rework. Design system foundation required before feature work.

- v1.3.2 Landing Page Redesign (Phases 15-19)
- v1.4 Node Visualization MVP (Phases 20-24)
- v1.5 Trending Page (Phases 25-30)
- v1.6 Brand Deals & Affiliate Hub (Phases 31-36)
- v1.7 Viral Predictor Results (Phases 37-38)

</details>

---

## v2.0 Design System Foundation (In Progress)

**Milestone Goal:** Extract Raycast's complete design system and implement it with coral (#FF7F50) branding, creating a production-ready foundation for all future UI development.

**Brand Rule:** Coral #FF7F50 replaces Raycast's primary brand color; everything else matches Raycast 1:1.

### Phase 39: Token Foundation
**Goal**: Extract and validate all design tokens with two-tier architecture and accessible coral scale
**Depends on**: Nothing (fresh milestone start)
**Requirements**: EXT-01 to EXT-13, COL-01 to COL-08, TYP-01 to TYP-06, SPC-01 to SPC-04, SHD-01 to SHD-04, BRD-01 to BRD-03, ANI-01 to ANI-05, BRK-01 to BRK-05, GRD-01 to GRD-04, ARC-01 to ARC-05 (57 requirements)
**Success Criteria** (what must be TRUE):
  1. All Raycast design values extracted and documented with source references
  2. Two-tier token architecture (primitive + semantic) implemented in globals.css
  3. Coral scale (100-900) generated with all text/background combinations passing WCAG AA (4.5:1)
  4. Tailwind @theme updated with all tokens accessible as utilities
  5. Token values verified against raycast.com live site
**Plans**: TBD

---

### Phase 40: Core Components
**Goal**: Build foundational component set with full TypeScript types and accessibility
**Depends on**: Phase 39
**Requirements**: CMP-01 to CMP-13, CMQ-01 to CMQ-06 (19 requirements)
**Success Criteria** (what must be TRUE):
  1. Button renders all variants (primary, secondary, ghost, destructive) with all states working
  2. Card and GlassCard components render with proper glassmorphism effects
  3. Input handles all types (text, password, search) with label, helper, and error states
  4. All components have TypeScript interfaces, JSDoc examples, and keyboard navigation
  5. All interactive elements meet 44x44px touch target minimum
**Plans**: TBD

---

### Phase 41: Extended Components + Raycast Patterns
**Goal**: Build secondary components and Raycast-specific UI patterns
**Depends on**: Phase 40
**Requirements**: CMX-01 to CMX-06, RAY-01 to RAY-05 (11 requirements)
**Success Criteria** (what must be TRUE):
  1. Modal/Dialog renders with glass styling and proper focus management
  2. Select/Dropdown component works with keyboard navigation
  3. Keyboard key visualization renders like Raycast key caps
  4. Shortcut badge displays command combinations correctly
  5. All extended components integrate with existing token system
**Plans**: TBD

---

### Phase 42: Effects & Animation
**Goal**: Implement glassmorphism effects and animation patterns matching Raycast aesthetic
**Depends on**: Phase 40
**Requirements**: GLS-01 to GLS-07, EFX-01 to EFX-06 (13 requirements)
**Success Criteria** (what must be TRUE):
  1. GlassPanel renders with configurable blur, opacity, and border effects
  2. Mobile blur optimized (6-8px vs 12-20px desktop) for performance
  3. FadeInUp animation matches Raycast signature reveal pattern
  4. Staggered reveal works for lists and grids
  5. Noise texture and chromatic aberration effects available as optional enhancements
**Plans**: TBD

---

### Phase 43: Showcase Enhancement
**Goal**: Build comprehensive showcase pages demonstrating all components and variants
**Depends on**: Phase 41, Phase 42
**Requirements**: SHW-01 to SHW-10 (10 requirements)
**Success Criteria** (what must be TRUE):
  1. /showcase main page displays complete token visualization
  2. All category pages exist (inputs, navigation, feedback, data-display, layout, utilities)
  3. Each component page shows all variants and all states
  4. Showcase pages follow consistent section pattern
  5. Code snippets available for all components
**Plans**: TBD

---

### Phase 44: Verification & Documentation
**Goal**: Verify visual accuracy, accessibility compliance, and document entire system
**Depends on**: Phase 43
**Requirements**: VER-01 to VER-07, DOC-01 to DOC-08 (15 requirements)
**Success Criteria** (what must be TRUE):
  1. Visual comparison confirms /showcase matches Raycast reference (except coral branding)
  2. All color combinations verified for WCAG AA compliance
  3. Token reference document complete with all values and usage notes
  4. Component API documentation complete with props, variants, examples
  5. BRAND-BIBLE.md updated with complete design system reference
**Plans**: TBD

---

## Progress

**Execution Order:**
Phases execute in numeric order: 39 → 40 → 41 → 42 → 43 → 44

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-10 | v1.1 | 44/44 | Complete | 2026-01-29 |
| 11-14 | v1.2 | 8/8 | Complete | 2026-01-30 |
| 15-38 | v1.3.2-v1.7 | - | Archived | 2026-02-03 |
| 39. Token Foundation | v2.0 | 0/TBD | Not started | - |
| 40. Core Components | v2.0 | 0/TBD | Not started | - |
| 41. Extended Components | v2.0 | 0/TBD | Not started | - |
| 42. Effects & Animation | v2.0 | 0/TBD | Not started | - |
| 43. Showcase Enhancement | v2.0 | 0/TBD | Not started | - |
| 44. Verification & Docs | v2.0 | 0/TBD | Not started | - |

---

## Requirement Coverage

**v2.0 Requirements:** 125 total (corrected from initial 106 estimate)
**Mapped:** 125/125

| Category | Count | Phase |
|----------|-------|-------|
| Extraction (EXT) | 13 | Phase 39 |
| Colors (COL) | 8 | Phase 39 |
| Typography (TYP) | 6 | Phase 39 |
| Spacing (SPC) | 4 | Phase 39 |
| Shadows (SHD) | 4 | Phase 39 |
| Borders (BRD) | 3 | Phase 39 |
| Animation Tokens (ANI) | 5 | Phase 39 |
| Breakpoints (BRK) | 5 | Phase 39 |
| Gradients (GRD) | 4 | Phase 39 |
| Architecture (ARC) | 5 | Phase 39 |
| Core Components (CMP) | 13 | Phase 40 |
| Component Quality (CMQ) | 6 | Phase 40 |
| Extended Components (CMX) | 6 | Phase 41 |
| Raycast Patterns (RAY) | 5 | Phase 41 |
| Glassmorphism (GLS) | 7 | Phase 42 |
| Effects (EFX) | 6 | Phase 42 |
| Showcase (SHW) | 10 | Phase 43 |
| Verification (VER) | 7 | Phase 44 |
| Documentation (DOC) | 8 | Phase 44 |

---
*Roadmap created: 2026-02-03*
*Last updated: 2026-02-03 — v2.0 Design System Foundation phases defined*
