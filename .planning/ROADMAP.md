# Roadmap — Virtuna

## Milestones

- ✅ **v1.1 Pixel-Perfect Clone** - Phases 1-10 (shipped 2026-01-29)
- 🚧 **v1.2 Visual Accuracy Refinement** - Phases 11-14 (in progress)

---

<details>
<summary>✅ v1.1 Pixel-Perfect Clone (Phases 1-10) - SHIPPED 2026-01-29</summary>

### Phase 1: Infrastructure Setup ✓
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

### Phase 2: Design System & Components ✓
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

### Phase 3: Landing Site ✓
**Goal**: Build pixel-perfect landing pages matching societies.io exactly
**Status**: Complete

**Success Criteria**:
- [x] All landing pages pixel-perfect match with societies.io
- [x] Navigation works correctly
- [x] Mobile experience matches societies.io exactly
- [x] Scroll animations match societies.io timing

**Requirements Covered**: L1, L2, L3, L4, L5, R1, R2, R3, AN4

---

### Phase 4: App Layout & Navigation ✓
**Goal**: Build app shell and navigation structure
**Status**: Complete (2026-01-28)
**Plans**: 6 plans

Plans:
- [x] 04-01-PLAN.md — Route groups restructure + install Radix dependencies
- [x] 04-02-PLAN.md — App layout shell with sidebar
- [x] 04-03-PLAN.md — Society selector modal + View selector dropdown
- [x] 04-04-PLAN.md — Network visualization + filter pills
- [x] 04-05-PLAN.md — Mobile drawer navigation + auth guard
- [x] 04-06-PLAN.md — Visual verification checkpoint

**Success Criteria**:
- [x] App layout matches societies.io
- [x] Navigation is fully functional
- [x] Auth protection works (mock)

**Requirements Covered**: A5, R1, R2, R3

---

### Phase 5: Society Management ✓
**Goal**: Complete society selector and creation flow with Zustand state management
**Status**: Complete (2026-01-29)
**Plans**: 5 plans

Plans:
- [x] 05-01-PLAN.md — Zustand store + types + mock data extraction
- [x] 05-02-PLAN.md — Refactor SocietySelector to use store + CardActionMenu
- [x] 05-03-PLAN.md — Create Target Society modal with AI matching UI
- [x] 05-04-PLAN.md — Wire up create flow + sidebar integration
- [x] 05-05-PLAN.md — Visual verification checkpoint

**Success Criteria**:
- [x] Society selector matches societies.io reference
- [x] Create society modal works with local state
- [x] Society selection updates app context
- [x] Persistence via localStorage

**Requirements Covered**: SOC-01 to SOC-05

---

### Phase 6: Test Type Selector & Forms ✓
**Goal**: Build test creation flow with all 11 form types
**Status**: Complete (2026-01-29)
**Plans**: 5 plans

Plans:
- [x] 06-01-PLAN.md — Test type definitions + TestTypeSelector modal
- [x] 06-02-PLAN.md — ContentForm component (shared by 10 types)
- [x] 06-03-PLAN.md — SurveyForm component (unique structure)
- [x] 06-04-PLAN.md — Test store + TikTok/Instagram functional flows
- [x] 06-05-PLAN.md — Visual verification checkpoint

**Success Criteria**:
- [x] All 11 test types selectable
- [x] Forms match societies.io styling
- [x] TikTok and Instagram forms submit successfully

**Requirements Covered**: TEST-01 to TEST-08

---

### Phase 7: Simulation & Results ✓
**Goal**: Build simulation flow and results display matching societies.io
**Status**: Complete (2026-01-29)
**Plans**: 6 plans

Plans:
- [x] 07-01-PLAN.md — Restructure dashboard layout for floating form
- [x] 07-02-PLAN.md — Build 4-phase loading states with progress
- [x] 07-03-PLAN.md — Extend TestResult interface and mock data generators
- [x] 07-04-PLAN.md — Build results panel components
- [x] 07-05-PLAN.md — Integrate all components into simulation flow
- [x] 07-06-PLAN.md — Visual comparison with societies.io using v0 MCP

**Success Criteria**:
- [x] Full simulation flow from submit to results
- [x] Results panel matches societies.io layout
- [x] Mock data displays correctly
- [x] v0 MCP visual comparison completed

**Requirements Covered**: RES-01 to RES-08

---

### Phase 8: Test History & Polish ✓
**Goal**: Complete test history viewing, deletion, and view selector enhancements
**Status**: Complete (2026-01-29)
**Plans**: 4 plans

Plans:
- [x] 08-01-PLAN.md — Install AlertDialog, extend test store with isViewingHistory
- [x] 08-02-PLAN.md — TestHistoryItem and TestHistoryList components for sidebar
- [x] 08-03-PLAN.md — ViewSelector role colors and LegendPills component
- [x] 08-04-PLAN.md — Integration, read-only forms, and visual verification

**Success Criteria**:
- [x] Test history persists in localStorage
- [x] History list in sidebar with delete via three-dot menu
- [x] Read-only form viewing for past tests
- [x] View selector shows role level colors
- [x] Legend pills display in dashboard

**Requirements Covered**: HIST-01 to HIST-04

---

### Phase 9: Settings & Modals ✓
**Goal**: Complete settings pages and modals matching societies.io
**Status**: Complete (2026-01-29)
**Plans**: 5 plans

Plans:
- [x] 09-01-PLAN.md — Install Radix dependencies + create settings store and types
- [x] 09-02-PLAN.md — Settings page with tabs, profile section, account section
- [x] 09-03-PLAN.md — Notifications section with switches, team section
- [x] 09-04-PLAN.md — Billing section with Stripe link, Leave Feedback modal
- [x] 09-05-PLAN.md — Integration: wire sidebar, create settings route, verification

**Success Criteria**:
- [x] All settings screens complete (profile, account, notifications, billing, team)
- [x] Forms interactive with localStorage persistence
- [x] Modals match societies.io styling
- [x] v0 MCP used for UI design verification

**Requirements Covered**: SET-01 to SET-06

---

### Phase 10: Final QA ✓
**Goal**: Visual verification and polish — pixel-perfect comparison with societies.io
**Status**: Complete (2026-01-29)
**Plans**: 6 plans

Plans:
- [x] 10-01-PLAN.md — App dashboard shell QA
- [x] 10-02-PLAN.md — App dashboard content QA
- [x] 10-03-PLAN.md — Settings page design language QA
- [x] 10-04-PLAN.md — Landing page desktop QA
- [x] 10-05-PLAN.md — Mobile responsive QA
- [x] 10-06-PLAN.md — Performance verification

**Success Criteria**:
- [x] All screens match societies.io reference at 1440px
- [x] Mobile (375px) fully functional with responsive adaptation
- [x] Zero console errors
- [x] 60fps animations
- [x] No layout shift issues

**Requirements Covered**: QA-01 to QA-03

</details>

---

## 🚧 v1.2 Visual Accuracy Refinement (In Progress)

**Milestone Goal:** Achieve 98%+ pixel accuracy against app.societies.io through systematic extraction, comparison, and iterative refinement.

**Approach:** 3-wave methodology
- Wave 1: Extract all screens/states from app.societies.io via Playwright
- Wave 2: Side-by-side comparison with detailed discrepancy documentation
- Wave 3: Iterative fixes using v0 MCP until 98%+ accuracy achieved
- Final: User flow verification to ensure functional correctness

---

### Phase 11: Extraction
**Goal**: Complete screenshot coverage of every screen, state, and interactive element in app.societies.io
**Depends on**: Phases 1-10 (v1.0 and v1.1 complete)
**Requirements**: EXT-01, EXT-02, EXT-03, EXT-04, EXT-05, EXT-06, EXT-07, EXT-08, EXT-09, EXT-10, EXT-11, EXT-12, EXT-13
**Success Criteria** (what must be TRUE):
  1. All dashboard states captured (default, loading, society selected)
  2. All selectors and dropdowns captured in open/closed/hover states
  3. All forms captured empty, filled, and with validation errors
  4. All modals and overlays captured
  5. Mobile viewport (375px) screenshots exist for all key screens
**Plans**: 4 plans

Plans:
- [ ] 11-01-PLAN.md - Setup Playwright extraction infrastructure
- [ ] 11-02-PLAN.md - Extract dashboard and navigation states
- [ ] 11-03-PLAN.md - Extract forms, selectors, and interactive elements
- [ ] 11-04-PLAN.md - Extract modals, settings, simulation, and video flows

---

### Phase 12: Comparison ✓
**Goal**: Document every visual discrepancy between Virtuna and app.societies.io with v0 MCP-powered analysis
**Depends on**: Phase 11
**Status**: Complete (2026-01-30)
**Requirements**: CMP-01, CMP-02, CMP-03, CMP-04, CMP-05, CMP-06, CMP-07, CMP-08, CMP-09, CMP-10, CMP-11, CMP-12, CMP-13, CMP-14

**Methodology**:
For each screen/component:
1. Load reference screenshot (from Phase 11) + Virtuna screenshot
2. Use v0 MCP to analyze: "List EVERY visual difference - spacing, colors, typography, layout, borders, shadows"
3. Document v0's analysis with manual verification
4. Categorize: spacing / color / typography / layout / animation
5. Prioritize: critical (layout breaks) / major (clearly visible) / minor (subtle)

**Success Criteria** (what must be TRUE):
  1. Side-by-side comparison images exist for every screen/component ✓
  2. All discrepancies documented with v0 analysis and pixel-level precision ✓
  3. Issues categorized by type (spacing, color, typography, layout, animation) ✓
  4. Issues prioritized (critical/major/minor) with clear criteria ✓
  5. Discrepancy report ready to guide refinement work ✓
**Plans**: 4 plans

Plans:
- [x] 12-01-PLAN.md — Dashboard, sidebar, and navigation comparison (Wave 1)
- [x] 12-02-PLAN.md — Forms, selectors, and dropdowns comparison (Wave 1)
- [x] 12-03-PLAN.md — Modals, results, and overlays comparison (Wave 1)
- [x] 12-04-PLAN.md — Consolidate discrepancy report with prioritization (Wave 2)

---

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-10 | v1.1 | 44/44 | Complete | 2026-01-29 |
| 11. Extraction | v1.2 | 6/6 | Complete | 2026-01-30 |
| 12. Comparison | v1.2 | 4/4 | Complete | 2026-01-30 |

---

## Current Status
- **Current Milestone**: v1.2 (Visual Accuracy Refinement) — Complete
- **Phases Completed**: 11-12 (Extraction + Comparison)
- **Next Action**: Start new milestone

---
*Roadmap created: 2026-01-28*
*Last updated: 2026-01-30 — v1.2 milestone added*
