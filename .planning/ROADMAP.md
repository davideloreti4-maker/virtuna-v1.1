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

### Phase 4: App Layout & Navigation
**Goal**: Build app shell and navigation structure

**Status**: Not Started

**Plans**: 6 plans (5 waves)

Plans:
- [ ] 04-01-PLAN.md — Route groups restructure + install Radix dependencies
- [ ] 04-02-PLAN.md — App layout shell with sidebar
- [ ] 04-03-PLAN.md — Society selector modal + View selector dropdown
- [ ] 04-04-PLAN.md — Network visualization + filter pills
- [ ] 04-05-PLAN.md — Mobile drawer navigation + auth guard
- [ ] 04-06-PLAN.md — Visual verification checkpoint

**Wave Structure**:
- Wave 1: 04-01 (Route groups + dependencies)
- Wave 2: 04-02 (App layout with sidebar)
- Wave 3: 04-03, 04-04 (Selectors and visualization — parallel)
- Wave 4: 04-05 (Mobile nav + auth guard)
- Wave 5: 04-06 (Visual verification checkpoint)

**Success Criteria**:
- App layout matches societies.io
- Navigation is fully functional
- Auth protection works (mock)

**Requirements Covered**: A5, R1, R2, R3

---

### Phase 5: Society Management
**Goal**: Complete society selector and creation flow

**Status**: Not Started

**Tasks**:
- [ ] Build society selector modal (Personal + Target sections)
- [ ] Build Create Target Society modal with AI matching UI
- [ ] Implement society cards with status badges
- [ ] Add CRUD operations (mock/local state)
- [ ] Persist societies in local storage

**Success Criteria**:
- Society selector matches societies.io reference
- Create society modal works with local state
- Society selection updates app context

**Requirements Covered**: SOC-01 to SOC-05

---

### Phase 6: Test Type Selector & Forms
**Goal**: Build test creation flow with all 11 form types

**Status**: Not Started

**Tasks**:
- [ ] Build test type selector modal (11 types in 5 categories)
- [ ] Build content form component (shared by 10 types)
- [ ] Build survey form component (unique structure)
- [ ] Implement TikTok Script form (functional)
- [ ] Implement Instagram Post form (functional)
- [ ] Add Help Me Craft button (UI only)
- [ ] Add Upload Images button (UI only)

**Success Criteria**:
- All 11 test types selectable
- Forms match societies.io styling
- TikTok and Instagram forms submit successfully

**Requirements Covered**: TEST-01 to TEST-08

---

### Phase 7: Simulation & Results
**Goal**: Build simulation flow and results display

**Status**: Not Started

**Tasks**:
- [ ] Build simulation loading states (4 phases)
- [ ] Create network placeholder (animated dots or static image)
- [ ] Build results panel layout
- [ ] Implement Impact Score display
- [ ] Add Attention breakdown (Full/Partial/Ignore)
- [ ] Build Variants section (AI-generated alternatives)
- [ ] Add Insights section
- [ ] Build Conversation themes with sample quotes
- [ ] Add Share Simulation button

**Success Criteria**:
- Full simulation flow from submit to results
- Results panel matches societies.io layout
- Mock data displays correctly

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
        Phase 5 (Society Management)            │
            ↓                                   │
        Phase 6 (Test Forms)                    │
            ↓                                   │
        Phase 7 (Results)                       │
            ↓                                   │
        Phase 8 (History)                       │
            ↓                                   │
        Phase 9 (Settings)                      │
            │                                   │
            └───────────────┬───────────────────┘
                            ↓
                    Phase 10 (QA)
```

## Current Status
- **Current Milestone**: v1.1 (Pixel-Perfect Clone)
- **Current Phase**: 4 (App Layout & Navigation)
- **Completed Phases**: 1, 2, 3
- **Blocked By**: None
- **Next Action**: Execute Phase 4
