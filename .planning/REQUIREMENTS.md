# Requirements: Virtuna v2.3.5 Design Token Alignment

**Defined:** 2026-02-06
**Core Value:** 1:1 Raycast design accuracy enabling consistent, predictable UI development

## v2.3.5 Requirements

### Typography

- [ ] **TYPO-01**: All text renders in Inter font family (remove Funnel Display and Satoshi)
- [ ] **TYPO-02**: Body text uses line-height 1.5-1.6 (not 1.15)
- [ ] **TYPO-03**: Body text uses letter-spacing 0.2px matching Raycast
- [ ] **TYPO-04**: Font weights use Inter's 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- [ ] **TYPO-05**: All @theme font-size tokens verified against Raycast type scale

### Color Tokens

- [ ] **COLR-01**: Grey scale uses exact hex values (not oklch) for all dark colors (L < 0.15)
- [ ] **COLR-02**: Card background uses Raycast 137deg gradient (`linear-gradient(137deg, #111214 4.87%, #0c0d0f 75.88%)`)
- [ ] **COLR-03**: Surface/elevated values match Raycast extraction exactly
- [ ] **COLR-04**: Input backgrounds use `rgba(255,255,255,0.05)` (not opaque #18191a)
- [ ] **COLR-05**: Border opacity tokens use 6% base / 10% hover consistently
- [ ] **COLR-06**: Glass gradient uses Raycast pattern (`linear-gradient(137deg, rgba(17,18,20,0.75) 4.87%, rgba(12,13,15,0.9) 75.88%)`)
- [ ] **COLR-07**: Button shadow tokens include Raycast's 4-layer primary and 3-layer secondary patterns

### Card Component

- [ ] **CARD-01**: Cards use solid 137deg gradient background (no backdrop-filter blur)
- [ ] **CARD-02**: Cards have proper hover states: translate-y -0.5, border white/10, bg white/3
- [ ] **CARD-03**: Card border uses `rgba(255,255,255,0.06)` with `border-radius: 12px`
- [ ] **CARD-04**: Card inset shadow uses `rgba(255,255,255,0.1) 0 1px 0 0 inset`
- [ ] **CARD-05**: FeatureCard border opacities corrected to 6% base / 10% hover

### Glass & Effects

- [ ] **GLAS-01**: GlassPanel uses Raycast neutral glass only (no colored tints, no inner glow)
- [ ] **GLAS-02**: GlassPanel default blur is 5px (Raycast exact), not 20px
- [ ] **GLAS-03**: GradientGlow component removed or deprecated (not Raycast pattern)
- [ ] **GLAS-04**: GradientMesh component removed or deprecated (not Raycast pattern)
- [ ] **GLAS-05**: Glass inset shadow uses `rgba(255,255,255,0.15) 0 1px 1px 0 inset`
- [ ] **GLAS-06**: GlassPanel/Sidebar radius corrected to 12px (not 16px)

### Header & Navigation

- [ ] **HEAD-01**: Header/navbar applies Raycast glass pattern (gradient + blur(5px) + 6% border)
- [ ] **HEAD-02**: Mobile menu divider uses 6% opacity (not 10%)

### Input Components

- [ ] **INPT-01**: Base Input component uses `rgba(255,255,255,0.05)` background matching GlassInput/Raycast
- [ ] **INPT-02**: Input border uses 5% opacity (Raycast exact)
- [ ] **INPT-03**: Input height remains 42px (already correct)

### Reference Documentation

- [ ] **DOCS-01**: BRAND-BIBLE.md rewritten from scratch with all Raycast-accurate values
- [ ] **DOCS-02**: Design direction changed from "iOS 26 Liquid Glass" to "Raycast Design Language"
- [ ] **DOCS-03**: All design docs updated with correct token values
- [ ] **DOCS-04**: MEMORY.md updated with final verified Raycast values

### Regression & Verification

- [ ] **REGR-01**: All 36 design system components render correctly after token changes
- [ ] **REGR-02**: Trending page (/trending) renders correctly after changes
- [ ] **REGR-03**: Dashboard renders correctly after changes
- [ ] **REGR-04**: 7-page showcase (/showcase) renders correctly after changes
- [ ] **REGR-05**: WCAG AA contrast compliance maintained (5.4:1+ muted text)

## Future Requirements

### Deferred to later milestones

- Light mode theme variant
- Storybook integration
- Style Dictionary / Tokens Studio pipeline
- Automated visual regression testing (Playwright screenshots)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Light mode support | Dark-mode first, defer later |
| New component creation | This milestone fixes existing, doesn't add new |
| Functionality changes | Only visual/design changes, no behavior modifications |
| Landing page design | Separate milestone (v2.4) |
| iOS 26 liquid glass preservation | Explicitly removing in favor of Raycast accuracy |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TYPO-01 | Phase 53 | Pending |
| TYPO-02 | Phase 53 | Pending |
| TYPO-03 | Phase 53 | Pending |
| TYPO-04 | Phase 53 | Pending |
| TYPO-05 | Phase 53 | Pending |
| COLR-01 | Phase 53 | Pending |
| COLR-02 | Phase 53 | Pending |
| COLR-03 | Phase 53 | Pending |
| COLR-04 | Phase 53 | Pending |
| COLR-05 | Phase 53 | Pending |
| COLR-06 | Phase 53 | Pending |
| COLR-07 | Phase 53 | Pending |
| CARD-01 | Phase 54 | Pending |
| CARD-02 | Phase 54 | Pending |
| CARD-03 | Phase 54 | Pending |
| CARD-04 | Phase 54 | Pending |
| CARD-05 | Phase 54 | Pending |
| GLAS-01 | Phase 55 | Pending |
| GLAS-02 | Phase 55 | Pending |
| GLAS-03 | Phase 55 | Pending |
| GLAS-04 | Phase 55 | Pending |
| GLAS-05 | Phase 55 | Pending |
| GLAS-06 | Phase 55 | Pending |
| HEAD-01 | Phase 54 | Pending |
| HEAD-02 | Phase 54 | Pending |
| INPT-01 | Phase 54 | Pending |
| INPT-02 | Phase 54 | Pending |
| INPT-03 | Phase 54 | Pending |
| DOCS-01 | Phase 55 | Pending |
| DOCS-02 | Phase 55 | Pending |
| DOCS-03 | Phase 55 | Pending |
| DOCS-04 | Phase 55 | Pending |
| REGR-01 | Phase 55 | Pending |
| REGR-02 | Phase 55 | Pending |
| REGR-03 | Phase 55 | Pending |
| REGR-04 | Phase 55 | Pending |
| REGR-05 | Phase 55 | Pending |

**Coverage:**
- v2.3.5 requirements: 37 total
- Mapped to phases: 37
- Unmapped: 0

---
*Requirements defined: 2026-02-06*
*Last updated: 2026-02-06 -- All 37 requirements mapped to phases 53-55*
