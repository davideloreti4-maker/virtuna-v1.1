# Roadmap — Virtuna v1.1

## Milestone: v1.1 — Pixel-Perfect Clone

### Phase 1: Infrastructure Setup
**Goal**: Complete development environment and deployment pipeline

**Tasks**:
- [x] Create project folder and git repo
- [x] Initialize Next.js with TypeScript + Tailwind
- [x] Create GitHub repository
- [ ] Set up Supabase project (auth only)
- [ ] Configure Vercel deployment
- [ ] Set up environment variables
- [ ] Configure TypeScript strict mode
- [ ] Set up GitHub Projects board

**Success Criteria**:
- App deploys to Vercel on push
- Supabase Auth configured and tested
- All env vars properly set

**Requirements Covered**: I1, I2, I3

---

### Phase 2: Design System & Components ✓
**Goal**: Build reusable component library matching societies.io design

**Status**: Complete (2026-01-27)

**Plans**: 5 plans in 4 waves

Plans:
- [x] 02-01-PLAN.md — Foundation setup (dependencies, utils, design tokens)
- [x] 02-02-PLAN.md — Base UI components (Button, Input, Card, Skeleton)
- [x] 02-03-PLAN.md — Layout components (Header, Footer, Container)
- [x] 02-04-PLAN.md — Animation components (FadeIn, SlideUp, PageTransition)
- [x] 02-05-PLAN.md — Visual verification (showcase page + checkpoint)

**Success Criteria**:
- [x] All base components match societies.io styling
- [x] Consistent design tokens across project
- [x] Components are reusable and documented

**Requirements Covered**: AN1, AN2, AN3

---

### Phase 3: Landing Site
**Goal**: Build pixel-perfect landing pages matching societies.io exactly (Homepage, Pricing, About)

**Plans**: 6 plans in 3 waves

Plans:
- [ ] 03-01-PLAN.md — Asset capture & navigation setup (download images, update Header/Footer)
- [ ] 03-02-PLAN.md — Animation components enhancement (scroll triggers, parallax)
- [ ] 03-03-PLAN.md — Homepage (hero, features, testimonials, CTAs)
- [ ] 03-04-PLAN.md — Pricing page (tiers, toggle, FAQ)
- [ ] 03-05-PLAN.md — About page (mission, team, values)
- [ ] 03-06-PLAN.md — Coming Soon page + visual verification checkpoint

**Wave Structure**:
- Wave 1: 03-01, 03-02 (parallel - foundation work)
- Wave 2: 03-03, 03-04, 03-05 (parallel - page building)
- Wave 3: 03-06 (verification checkpoint)

**Success Criteria**:
- All landing pages pixel-perfect match with societies.io
- Navigation works correctly (unbuilt pages → /coming-soon)
- Mobile experience matches societies.io exactly
- Scroll animations match societies.io timing and behavior

**Requirements Covered**: L1, L2, L3, L4, L5, R1, R2, R3, AN4

---

### Phase 4: App Layout & Navigation
**Goal**: Build app shell and navigation structure

**Tasks**:
- [ ] Create app layout (sidebar, header)
- [ ] Implement sidebar navigation
- [ ] Build user menu dropdown
- [ ] Create mobile app navigation
- [ ] Add breadcrumbs
- [ ] Implement route protection (auth guard)

**Success Criteria**:
- App layout matches societies.io
- Navigation is fully functional
- Auth protection works

**Requirements Covered**: A5, R1, R2, R3

---

### Phase 5: Authentication
**Goal**: Implement complete auth flows with Supabase

**Tasks**:
- [ ] Build sign up page
- [ ] Build login page
- [ ] Build forgot password flow
- [ ] Build email verification UI
- [ ] Integrate OAuth (Google)
- [ ] Connect all forms to Supabase Auth
- [ ] Handle auth errors gracefully

**Success Criteria**:
- All auth flows work end-to-end
- Error states handled
- Session management works

**Requirements Covered**: A1

---

### Phase 6: App Screens — Dashboard
**Goal**: Build main dashboard and home screen

**Tasks**:
- [ ] Create dashboard layout
- [ ] Build widget/card components
- [ ] Implement data display with mock data
- [ ] Add loading states (skeletons)
- [ ] Add empty states

**Success Criteria**:
- Dashboard matches societies.io
- Mock data displays correctly
- Loading/empty states present

**Requirements Covered**: A2

---

### Phase 7: App Screens — Analytics
**Goal**: Build analytics and insights screens

**Tasks**:
- [ ] Implement chart components
- [ ] Build data tables
- [ ] Create filter controls
- [ ] Add date range picker
- [ ] Build export UI (non-functional)

**Success Criteria**:
- Charts render with mock data
- Filters work (with mock data)
- UI matches societies.io

**Requirements Covered**: A3

---

### Phase 8: App Screens — Settings
**Goal**: Build settings and profile pages

**Tasks**:
- [ ] Build user profile page
- [ ] Build account settings
- [ ] Build notification preferences
- [ ] Build billing/subscription UI
- [ ] Build team management UI

**Success Criteria**:
- All settings screens complete
- Forms are interactive (local state)
- UI matches societies.io

**Requirements Covered**: A4

---

### Phase 9: Remaining App Screens
**Goal**: Complete all remaining app screens

**Tasks**:
- [ ] Audit societies.io for remaining screens
- [ ] Build each remaining screen
- [ ] Implement modal dialogs
- [ ] Add all empty states
- [ ] Add all error states

**Success Criteria**:
- Every app screen from societies.io is replicated
- All states (loading, empty, error) present

**Requirements Covered**: A6

---

### Phase 10: Polish & QA
**Goal**: Final polish and AI verification

**Tasks**:
- [ ] Side-by-side visual comparison
- [ ] Record comparison videos
- [ ] Run AI analysis (Gemini)
- [ ] Fix any discrepancies found
- [ ] Performance optimization
- [ ] Final responsive testing

**Success Criteria**:
- AI verification passes (95%+ similarity)
- Lighthouse > 90
- All manual QA passes

**Requirements Covered**: QA1, QA2, QA3

---

## Phase Dependencies

```
Phase 1 (Infrastructure)
    ↓
Phase 2 (Design System)
    ↓
    ├── Phase 3 (Landing) ──────────────────────┐
    │                                           │
    └── Phase 4 (App Layout)                    │
            ↓                                   │
        Phase 5 (Auth)                          │
            ↓                                   │
        Phase 6 (Dashboard)                     │
            ↓                                   │
        Phase 7 (Analytics)                     │
            ↓                                   │
        Phase 8 (Settings)                      │
            ↓                                   │
        Phase 9 (Remaining)                     │
            │                                   │
            └───────────────┬───────────────────┘
                            ↓
                    Phase 10 (QA)
```

## Current Status
- **Current Phase**: 3 (Landing Site)
- **Completed Phases**: 1, 2
- **Blocked By**: None
- **Next Action**: Execute Phase 3 (`/gsd:execute-phase 3`)
