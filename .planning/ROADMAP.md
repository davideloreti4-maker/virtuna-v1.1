# Roadmap — Virtuna v1.1

## Milestone: v1.1 — Pixel-Perfect Clone

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

**Plans**: 5 plans (3 waves)

Plans:
- [x] 02-01-PLAN.md — Foundation setup (design tokens, cn() utility, fonts)
- [x] 02-02-PLAN.md — Base UI components (Button, Input, Card, Skeleton)
- [x] 02-03-PLAN.md — Layout components (Container, Header, Footer)
- [x] 02-04-PLAN.md — Animation components (FadeIn, SlideUp, PageTransition)
- [x] 02-05-PLAN.md — Showcase page + visual verification checkpoint

**Wave Structure**:
- Wave 1: 02-01 (Foundation) — sequential, must complete first
- Wave 2: 02-02, 02-03, 02-04 (Components) — parallel, all depend on 02-01
- Wave 3: 02-05 (Showcase) — sequential, depends on all Wave 2 plans

**Success Criteria**:
- [x] All base components match societies.io styling
- [x] Consistent design tokens across project
- [x] Components are reusable and documented

**Requirements Covered**: AN1, AN2, AN3

---

### Phase 3: Landing Site
**Goal**: Build pixel-perfect landing pages matching societies.io exactly

**Status**: Not Started

**Tasks**:
- [ ] Asset capture & navigation setup (download images, update Header/Footer)
- [ ] Animation components enhancement (scroll triggers, parallax)
- [ ] Homepage (hero, features, testimonials, CTAs)
- [ ] Verification checkpoint

**Success Criteria**:
- All landing pages pixel-perfect match with societies.io
- Navigation works correctly (unbuilt pages → /coming-soon)
- Mobile experience matches societies.io exactly
- Scroll animations match societies.io timing and behavior

**Requirements Covered**: L1, L2, L3, L4, L5, R1, R2, R3, AN4

---

### Phase 4: App Layout & Navigation ✓
**Goal**: Build app shell and navigation structure

**Status**: Complete (2026-01-28)

**Plans**: 6 plans (5 waves)

Plans:
- [x] 04-01-PLAN.md — Route groups restructure + install Radix dependencies
- [x] 04-02-PLAN.md — App layout shell with sidebar
- [x] 04-03-PLAN.md — Society selector modal + View selector dropdown
- [x] 04-04-PLAN.md — Network visualization + filter pills
- [x] 04-05-PLAN.md — Mobile drawer navigation + auth guard
- [x] 04-06-PLAN.md — Visual verification checkpoint

**Wave Structure**:
- Wave 1: 04-01 (Route groups + dependencies)
- Wave 2: 04-02 (App layout with sidebar)
- Wave 3: 04-03, 04-04 (Selectors and visualization — parallel)
- Wave 4: 04-05 (Mobile nav + auth guard)
- Wave 5: 04-06 (Visual verification checkpoint)

**Success Criteria**:
- [x] App layout matches societies.io
- [x] Navigation is fully functional
- [x] Auth protection works (mock)

**Requirements Covered**: A5, R1, R2, R3

---

### Phase 5: Society Management ✓
**Goal**: Complete society selector and creation flow with Zustand state management

**Status**: Complete (2026-01-29)

**Plans**: 5 plans (4 waves)

Plans:
- [x] 05-01-PLAN.md — Zustand store + types + mock data extraction
- [x] 05-02-PLAN.md — Refactor SocietySelector to use store + CardActionMenu
- [x] 05-03-PLAN.md — Create Target Society modal with AI matching UI
- [x] 05-04-PLAN.md — Wire up create flow + sidebar integration
- [x] 05-05-PLAN.md — Visual verification checkpoint

**Wave Structure**:
- Wave 1: 05-01 (Foundation - store, types, mock data)
- Wave 2: 05-02, 05-03 (Parallel - selector refactor + create modal)
- Wave 3: 05-04 (Integration - wire up flow)
- Wave 4: 05-05 (Verification checkpoint)

**Success Criteria**:
- [x] Society selector matches societies.io reference
- [x] Create society modal works with local state
- [x] Society selection updates app context
- [x] Persistence via localStorage (manual implementation)

**Requirements Covered**: SOC-01 to SOC-05

---

### Phase 6: Test Type Selector & Forms ✓
**Goal**: Build test creation flow with all 11 form types

**Status**: Complete (2026-01-29)

**Plans**: 5 plans (4 waves)

Plans:
- [x] 06-01-PLAN.md — Test type definitions + TestTypeSelector modal
- [x] 06-02-PLAN.md — ContentForm component (shared by 10 types)
- [x] 06-03-PLAN.md — SurveyForm component (unique structure)
- [x] 06-04-PLAN.md — Test store + TikTok/Instagram functional flows
- [x] 06-05-PLAN.md — Visual verification checkpoint

**Wave Structure**:
- Wave 1: 06-01 (Type definitions + selector modal)
- Wave 2: 06-02, 06-03 (Parallel - content form + survey form)
- Wave 3: 06-04 (Test store + functional flows integration)
- Wave 4: 06-05 (Verification checkpoint)

**Success Criteria**:
- [x] All 11 test types selectable
- [x] Forms match societies.io styling
- [x] TikTok and Instagram forms submit successfully

**Requirements Covered**: TEST-01 to TEST-08

---

### Phase 7: Simulation & Results ✓
**Goal**: Build simulation flow and results display matching societies.io

**Status**: Complete (2026-01-29)

**Plans**: 6 plans (4 waves)

Plans:
- [x] 07-01-PLAN.md — Restructure dashboard layout for floating form
- [x] 07-02-PLAN.md — Build 4-phase loading states with progress
- [x] 07-03-PLAN.md — Extend TestResult interface and mock data generators
- [x] 07-04-PLAN.md — Build results panel components (Impact, Variants, Insights, Themes)
- [x] 07-05-PLAN.md — Integrate all components into simulation flow
- [x] 07-06-PLAN.md — Visual comparison with societies.io using v0 MCP

**Wave Structure**:
- Wave 1: 07-01, 07-02, 07-03 (Parallel - layout, loading, data model)
- Wave 2: 07-04 (Results components - depends on 07-03)
- Wave 3: 07-05 (Integration - depends on all prior)
- Wave 4: 07-06 (Visual comparison checkpoint)

**Success Criteria**:
- [x] Full simulation flow from submit to results
- [x] Results panel matches societies.io layout
- [x] Mock data displays correctly
- [x] v0 MCP visual comparison completed

**Requirements Covered**: RES-01 to RES-08

---

### Phase 8: Test History & Polish
**Goal**: Complete test history and app polish

**Status**: Not Started

**Tasks**:
- [ ] Add test history to sidebar
- [ ] Click to view previous results
- [ ] Implement delete test functionality
- [ ] Build view selector dropdown
- [ ] Add legend pills for views
- [ ] Complete all remaining UI polish

**Success Criteria**:
- Test history persists in local storage
- All interactions work correctly
- UI polish complete

**Requirements Covered**: HIST-01 to HIST-04

---

### Phase 9: Settings & Modals
**Goal**: Complete settings pages and modals

**Status**: Not Started

**Tasks**:
- [ ] Build user profile page
- [ ] Build account settings
- [ ] Build notification preferences
- [ ] Build billing UI (link to Stripe)
- [ ] Build team management UI
- [ ] Build Leave Feedback modal
- [ ] Add Product Guide link

**Success Criteria**:
- All settings screens complete
- Forms interactive (local state)
- Modals match societies.io styling

**Requirements Covered**: SET-01 to SET-06

---

### Phase 10: Final QA
**Goal**: Visual verification and polish

**Status**: Not Started

**Tasks**:
- [ ] Side-by-side comparison with societies.io
- [ ] Fix any discrepancies found
- [ ] Performance optimization
- [ ] Responsive testing (mobile, tablet, desktop)

**Success Criteria**:
- All screens match societies.io reference
- Console error-free
- Responsive on all breakpoints

**Requirements Covered**: QA-01 to QA-03

---

## Phase Dependencies

```
Phase 1 (Infrastructure) ✓
    ↓
Phase 2 (Design System) ✓
    ↓
    ├── Phase 3 (Landing) ✓ ────────────────────┐
    │                                           │
    └── Phase 4 (App Layout) ✓                  │
            ↓                                   │
        Phase 5 (Society Management) ✓          │
            ↓                                   │
        Phase 6 (Test Forms) ✓                  │
            ↓                                   │
        Phase 7 (Results) ✓                     │
            ↓                                   │
        Phase 8 (History) ← NEXT                │
            ↓                                   │
        Phase 9 (Settings)                      │
            │                                   │
            └───────────────┬───────────────────┘
                            ↓
                    Phase 10 (QA)
```

## Current Status
- **Current Milestone**: v1.1 (Pixel-Perfect Clone)
- **Current Phase**: 8 (Test History & Polish)
- **Completed Phases**: 1, 2, 3, 4, 5, 6, 7
- **Blocked By**: None
- **Next Action**: Plan Phase 8
