# Requirements — Virtuna v1.2

**Defined:** 2026-01-30
**Core Value:** 98%+ pixel accuracy against app.societies.io

## v1.2 Requirements

### Wave 1: Extraction (EXT)

- [ ] **EXT-01**: Capture all dashboard states (default, loading, society selected)
- [ ] **EXT-02**: Capture society selector (closed, open, hover states, create modal)
- [ ] **EXT-03**: Capture view selector (closed, open, each dropdown option)
- [ ] **EXT-04**: Capture test type selector (all 11 types, hover states)
- [ ] **EXT-05**: Capture content forms (empty, filled, validation states)
- [ ] **EXT-06**: Capture survey form (empty, with options, validation)
- [ ] **EXT-07**: Capture simulation flow (all 4 loading phases)
- [ ] **EXT-08**: Capture results panel (all sections expanded/collapsed)
- [ ] **EXT-09**: Capture test history (empty, with items, item selected, delete modal)
- [ ] **EXT-10**: Capture settings (all tabs: profile, notifications, billing, team)
- [ ] **EXT-11**: Capture all modals (feedback, create society, delete confirmation)
- [ ] **EXT-12**: Capture mobile viewport (375px) for all key screens
- [ ] **EXT-13**: Capture hover/focus states for all interactive elements

### Wave 2: Comparison (CMP)

- [ ] **CMP-01**: Side-by-side comparison of dashboard layout
- [ ] **CMP-02**: Side-by-side comparison of sidebar and navigation
- [ ] **CMP-03**: Side-by-side comparison of society selector modal
- [ ] **CMP-04**: Side-by-side comparison of view selector dropdown
- [ ] **CMP-05**: Side-by-side comparison of test type selector
- [ ] **CMP-06**: Side-by-side comparison of content/survey forms
- [ ] **CMP-07**: Side-by-side comparison of simulation loading states
- [ ] **CMP-08**: Side-by-side comparison of results panel
- [ ] **CMP-09**: Side-by-side comparison of test history sidebar
- [ ] **CMP-10**: Side-by-side comparison of settings pages
- [ ] **CMP-11**: Side-by-side comparison of all modals
- [ ] **CMP-12**: Document all discrepancies with screenshots and coordinates
- [ ] **CMP-13**: Categorize issues: spacing, color, typography, layout, animation
- [ ] **CMP-14**: Prioritize: critical (breaks layout), major (visible), minor (subtle)

### Wave 3: Refinement (REF)

- [ ] **REF-01**: Fix all critical discrepancies (layout breaks)
- [ ] **REF-02**: Fix all major discrepancies (clearly visible differences)
- [ ] **REF-03**: Fix all minor discrepancies (subtle spacing/color)
- [ ] **REF-04**: Use v0 MCP for complex component fixes
- [ ] **REF-05**: Verify each fix against reference screenshot
- [ ] **REF-06**: Final full-screen comparison pass
- [ ] **REF-07**: Mobile responsive verification pass
- [ ] **REF-08**: Achieve 98%+ pixel accuracy validation

### User Flow Testing (FLOW)

- [ ] **FLOW-01**: Test create society flow (open selector -> create -> confirm -> appears in list)
- [ ] **FLOW-02**: Test select society flow (switch between personal/target societies)
- [ ] **FLOW-03**: Test create test flow (select type -> fill form -> simulate)
- [ ] **FLOW-04**: Test simulation flow (submit -> 4 phases -> results appear)
- [ ] **FLOW-05**: Test results interaction (expand sections, copy share link, view variants)
- [ ] **FLOW-06**: Test history flow (view past test -> form pre-fills -> results display)
- [ ] **FLOW-07**: Test delete flow (select item -> confirm delete -> removed from list)
- [ ] **FLOW-08**: Test settings flow (navigate tabs, edit profile, save changes)
- [ ] **FLOW-09**: Test view selector flow (change filters, legend updates)
- [ ] **FLOW-10**: Test mobile navigation flow (hamburger -> drawer -> navigate -> close)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Landing page comparison | Already QA'd in v1.1, focus is app only |
| Network visualization accuracy | Complex canvas animation, deferred |
| Real authentication flows | Mock auth sufficient for visual QA |
| Backend integration | Frontend-only milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| EXT-01 | Phase 11 | Pending |
| EXT-02 | Phase 11 | Pending |
| EXT-03 | Phase 11 | Pending |
| EXT-04 | Phase 11 | Pending |
| EXT-05 | Phase 11 | Pending |
| EXT-06 | Phase 11 | Pending |
| EXT-07 | Phase 11 | Pending |
| EXT-08 | Phase 11 | Pending |
| EXT-09 | Phase 11 | Pending |
| EXT-10 | Phase 11 | Pending |
| EXT-11 | Phase 11 | Pending |
| EXT-12 | Phase 11 | Pending |
| EXT-13 | Phase 11 | Pending |
| CMP-01 | Phase 12 | Pending |
| CMP-02 | Phase 12 | Pending |
| CMP-03 | Phase 12 | Pending |
| CMP-04 | Phase 12 | Pending |
| CMP-05 | Phase 12 | Pending |
| CMP-06 | Phase 12 | Pending |
| CMP-07 | Phase 12 | Pending |
| CMP-08 | Phase 12 | Pending |
| CMP-09 | Phase 12 | Pending |
| CMP-10 | Phase 12 | Pending |
| CMP-11 | Phase 12 | Pending |
| CMP-12 | Phase 12 | Pending |
| CMP-13 | Phase 12 | Pending |
| CMP-14 | Phase 12 | Pending |
| REF-01 | Phase 13 | Pending |
| REF-02 | Phase 13 | Pending |
| REF-03 | Phase 13 | Pending |
| REF-04 | Phase 13 | Pending |
| REF-05 | Phase 13 | Pending |
| REF-06 | Phase 13 | Pending |
| REF-07 | Phase 13 | Pending |
| REF-08 | Phase 13 | Pending |
| FLOW-01 | Phase 14 | Pending |
| FLOW-02 | Phase 14 | Pending |
| FLOW-03 | Phase 14 | Pending |
| FLOW-04 | Phase 14 | Pending |
| FLOW-05 | Phase 14 | Pending |
| FLOW-06 | Phase 14 | Pending |
| FLOW-07 | Phase 14 | Pending |
| FLOW-08 | Phase 14 | Pending |
| FLOW-09 | Phase 14 | Pending |
| FLOW-10 | Phase 14 | Pending |

**Coverage:**
- v1.2 requirements: 45 total
- Mapped to phases: 45
- Unmapped: 0

---
*Requirements defined: 2026-01-30*
*Last updated: 2026-01-30 — Traceability updated with phase mappings*
