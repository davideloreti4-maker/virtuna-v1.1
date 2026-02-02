# Roadmap — Virtuna

## Milestones

- **v1.1 Pixel-Perfect Clone** - Phases 1-10 (shipped 2026-01-29)
- **v1.2 Visual Accuracy Refinement** - Phases 11-14 (shipped 2026-01-30)
- **v1.3.2 Landing Page Redesign** - Phases 15-19 (in progress)
- **v1.4 Node Visualization MVP** - Phases 20-24 (planned)
- **v1.6 Brand Deals & Affiliate Hub** - Phases 25-30 (planned)
- **v1.7 Viral Predictor Results** - Phases 35-36 (planned)

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

### Phase 3: Landing Site
**Goal**: Build pixel-perfect landing pages matching societies.io exactly
**Status**: Complete

**Success Criteria**:
- [x] All landing pages pixel-perfect match with societies.io
- [x] Navigation works correctly
- [x] Mobile experience matches societies.io exactly
- [x] Scroll animations match societies.io timing

**Requirements Covered**: L1, L2, L3, L4, L5, R1, R2, R3, AN4

---

### Phase 4: App Layout & Navigation
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

### Phase 5: Society Management
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

### Phase 6: Test Type Selector & Forms
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

### Phase 7: Simulation & Results
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

### Phase 8: Test History & Polish
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

### Phase 9: Settings & Modals
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

### Phase 10: Final QA
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

<details>
<summary>v1.2 Visual Accuracy Refinement (Phases 11-14) - SHIPPED 2026-01-30</summary>

**Milestone Goal:** Achieve 98%+ pixel accuracy against app.societies.io through systematic extraction, comparison, and iterative refinement.

### Phase 11: Extraction
**Goal**: Complete screenshot coverage of every screen, state, and interactive element in app.societies.io
**Status**: Complete (2026-01-30)
**Plans**: 4 plans

Plans:
- [x] 11-01-PLAN.md - Setup Playwright extraction infrastructure
- [x] 11-02-PLAN.md - Extract dashboard and navigation states
- [x] 11-03-PLAN.md - Extract forms, selectors, and interactive elements
- [x] 11-04-PLAN.md - Extract modals, settings, simulation, and video flows

**Success Criteria**:
- [x] All dashboard states captured (default, loading, society selected)
- [x] All selectors and dropdowns captured in open/closed/hover states
- [x] All forms captured empty, filled, and with validation errors
- [x] All modals and overlays captured
- [x] Mobile viewport (375px) screenshots exist for all key screens

**Requirements Covered**: EXT-01 to EXT-13

---

### Phase 12: Comparison
**Goal**: Document every visual discrepancy between Virtuna and app.societies.io with v0 MCP-powered analysis
**Status**: Complete (2026-01-30)
**Plans**: 4 plans

Plans:
- [x] 12-01-PLAN.md — Dashboard, sidebar, and navigation comparison (Wave 1)
- [x] 12-02-PLAN.md — Forms, selectors, and dropdowns comparison (Wave 1)
- [x] 12-03-PLAN.md — Modals, results, and overlays comparison (Wave 1)
- [x] 12-04-PLAN.md — Consolidate discrepancy report with prioritization (Wave 2)

**Success Criteria**:
- [x] Side-by-side comparison images exist for every screen/component
- [x] All discrepancies documented with v0 analysis and pixel-level precision
- [x] Issues categorized by type (spacing, color, typography, layout, animation)
- [x] Issues prioritized (critical/major/minor) with clear criteria
- [x] Discrepancy report ready to guide refinement work

**Requirements Covered**: CMP-01 to CMP-14

</details>

---

## v1.3.2 Landing Page Redesign (In Progress)

**Milestone Goal:** Transform the landing page into a premium Raycast-inspired experience with iOS 26 aesthetic — glassmorphism, gradient lighting, macOS mockups, and smooth animations.

**Approach:** Component-first methodology
- Phase 15: Build foundation primitives (GlassPanel, GradientGlow, TrafficLights)
- Phase 16: Compose hero section with dramatic lighting and macOS mockup
- Phase 17: Build feature cards with per-feature color identity
- Phase 18: Add navigation glassmorphism and scroll animations
- Phase 19: Cross-browser QA, accessibility, performance optimization

---

### Phase 15: Foundation + Primitives
**Goal**: Establish design system constraints and build zero-dependency components that everything else uses
**Depends on**: v1.2 complete (Phase 14)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06
**Success Criteria** (what must be TRUE):
  1. Dark theme tokens are defined and used consistently (background, surfaces, text, borders)
  2. GlassPanel renders with configurable blur/opacity and proper Safari -webkit- prefixes
  3. GradientGlow creates ambient lighting effects with controllable color and intensity
  4. TrafficLights displays red/yellow/green macOS window buttons at correct sizes
  5. Gradient palette provides distinct color identities (purple, blue, pink, etc.) as reusable tokens
**Plans**: 3 plans

Plans:
- [ ] 15-01: Design tokens, gradient palette, and depth system setup
- [ ] 15-02: GlassPanel and GradientGlow components with Safari compatibility
- [ ] 15-03: TrafficLights component and visual verification

---

### Phase 16: Hero Section
**Goal**: Create dramatic first impression with gradient lighting, macOS window mockup, and premium typography
**Depends on**: Phase 15
**Requirements**: HERO-01, HERO-02, HERO-03, HERO-04, HERO-05
**Success Criteria** (what must be TRUE):
  1. Hero background displays animated gradient lighting on near-black (#0A0A0B) base
  2. macOS window mockup floats with traffic lights, glass panel, and static app preview
  3. Headline typography is bold (48-72px) with proper letter-spacing and text shadows
  4. CTA buttons have premium hover effects with spring physics
  5. Hero section entrance animation is smooth and polished
**Plans**: 3 plans

Plans:
- [ ] 16-01: Animated gradient background with ambient lighting
- [ ] 16-02: WindowMockup composite component with traffic lights, glass panel, and static preview
- [ ] 16-03: Hero typography, CTA buttons, and entrance animations

---

### Phase 17: Feature Cards
**Goal**: Showcase features with glassmorphism cards, unique color identities, and polished hover states
**Depends on**: Phase 15
**Requirements**: CARD-01, CARD-02, CARD-03, CARD-04
**Success Criteria** (what must be TRUE):
  1. GradientCard component displays glass background with distinct color glow per feature
  2. Cards follow Raycast pattern: icon + title + description with proper spacing
  3. Hover state scales card (1.02-1.05x) and intensifies glow effect
  4. Cards animate in with staggered scroll-triggered entrance (0.1s delay between cards)
**Plans**: 2 plans

Plans:
- [ ] 17-01: GradientCard component with color identity, glass effects, and layout
- [ ] 17-02: Hover states, glow intensification, and staggered scroll animations

---

### Phase 18: Navigation + Animations
**Goal**: Add sticky glassmorphism navigation and polish all scroll/interaction animations
**Depends on**: Phase 15, Phase 16
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04, ANIM-01, ANIM-02, ANIM-03, ANIM-04, ANIM-05
**Success Criteria** (what must be TRUE):
  1. Header sticks on scroll with glassmorphism blur effect
  2. Navigation links have ghost hover effect (opacity change, no background)
  3. Header CTA button matches hero CTA styling with consistent hover state
  4. Mobile navigation works with slide-in drawer or menu
  5. All sections animate into view on scroll with fade/slide effect
  6. Button hovers use spring physics (stiffness: 400, damping: 17)
  7. Animations maintain 60fps on desktop and mobile
  8. Users with prefers-reduced-motion see instant transitions (no parallax, no scale)
**Plans**: 4 plans

Plans:
- [ ] 18-01: Sticky header with glassmorphism and navigation links
- [ ] 18-02: Mobile responsive navigation (drawer or menu)
- [ ] 18-03: Scroll-triggered section animations with stagger utilities
- [ ] 18-04: Spring physics for hovers and reduced-motion support

---

### Phase 19: Quality & Polish
**Goal**: Cross-browser compatibility, accessibility compliance, and performance optimization
**Depends on**: Phase 16, Phase 17, Phase 18
**Requirements**: QA-01, QA-02, QA-03, QA-04, QA-05
**Success Criteria** (what must be TRUE):
  1. Glassmorphism renders correctly on Chrome, Safari, and Firefox
  2. Safari -webkit-backdrop-filter uses fixed values (no CSS variables) per research findings
  3. Mobile uses reduced blur (6-8px) and limited glass elements for 55+ fps scroll
  4. Text on glass backgrounds meets WCAG 4.5:1 contrast for body text
  5. Landing page displays correctly from 375px to 1440px+ viewports
**Plans**: 3 plans

Plans:
- [ ] 19-01: Cross-browser testing and Safari-specific fixes
- [ ] 19-02: Mobile performance optimization (reduced blur, limited glass)
- [ ] 19-03: Accessibility audit (contrast, reduced-motion) and responsive QA

---

## v1.4 Node Visualization MVP (Planned)

**Milestone Goal:** Ship the mesmerizing "wow" moment visualization — central orb, flowing particles, chaos-to-order node crystallization — optimized for mobile performance.

**Approach:** Build visualization layers progressively
- Phase 20: Visualization foundation (Spline glass orb, canvas setup, accessibility)
- Phase 21: Particle system (ambient flow, processing rush, captivating idle)
- Phase 22: Node system (chaos nodes, crystallization, connections, motion layers)
- Phase 23: Motion and interaction (physics, gestures, drag, magnetic)
- Phase 24: UX and mobile optimization (tooltips, sheets, 60fps mobile)

---

### Phase 20: Visualization Foundation
**Goal**: Establish the visual core — glass orb using Spline 3D (replaces failed R3F shader approach), with accessibility support and camera controls
**Depends on**: v1.3.2 complete (Phase 19)
**Requirements**: VIZ-01, VIZ-02, VIZ-09, VIZ-10
**Success Criteria** (what must be TRUE):
  1. Glass orb renders using Spline 3D with translucent glass effect
  2. Orb has gradient colors (orange core to coral to magenta rim)
  3. Orb has ambient "breathing" animation (designed in Spline)
  4. Pan/zoom works via camera controls on desktop and touch
  5. WebGL rendering is crisp on retina displays
  6. Orb responds to hover with glow boost, tap with feedback
  7. prefers-reduced-motion shows static CSS fallback (no WebGL)
**Status**: In Progress (replanning with Spline approach)
**Plans**: 4 plans

Plans:
- [x] 20-01-PLAN.md — R3F/Three.js setup, Canvas wrapper, camera controls infrastructure
- [ ] 20-02-PLAN.md — Install Spline React package and create SplineOrb component
- [ ] 20-03-PLAN.md — User creates glass orb scene in Spline app (checkpoint)
- [ ] 20-04-PLAN.md — Integrate Spline scene, reduced motion fallback, cleanup old shaders

---

### Phase 21: Particle System
**Goal**: Create the ambient particle flow that surrounds the orb and rushes inward during processing
**Depends on**: Phase 20
**Requirements**: VIZ-03, VIZ-04, VIZ-08
**Success Criteria** (what must be TRUE):
  1. Ambient particles flow continuously around the orb in idle state
  2. Particles rush toward the orb when processing begins (triggered state change)
  3. Idle state is captivating enough to hook users before any interaction
  4. Particle system uses R3F useFrame for smooth animation loop
  5. Particle count is configurable for later performance optimization
**Plans**: 2 plans

Plans:
- [ ] 21-01-PLAN.md — Core particle infrastructure (types, utilities, instanced mesh)
- [ ] 21-02-PLAN.md — ParticleSystem component with idle flow and processing rush

---

### Phase 22: Node System
**Goal**: Implement chaos-to-order node crystallization with connections and multi-layer motion
**Depends on**: Phase 21
**Requirements**: VIZ-05, VIZ-06, VIZ-07, MOTION-01
**Success Criteria** (what must be TRUE):
  1. Dynamic abstract nodes form around orb during processing (unlabeled, chaotic)
  2. Nodes crystallize into labeled insights when analysis completes (order emerges)
  3. Connections between nodes render with animated flow (pulsing lines or particle streams)
  4. Three-layer motion system works: ambient (always), activity (processing), revelation (insights)
  5. Node positions are managed with force simulation for natural clustering

---

### Phase 23: Motion & Interaction
**Goal**: Add physics-based motion and essential touch/mouse interactions
**Depends on**: Phase 22
**Requirements**: MOTION-02, MOTION-03, MOTION-04, MOTION-05, INTERACT-01, INTERACT-02, INTERACT-03, INTERACT-04, INTERACT-05
**Success Criteria** (what must be TRUE):
  1. All motion uses easing curves (no linear animations)
  2. Variable reward timing creates non-metronomic, semi-random revelation bursts
  3. Anticipation precedes reveals (brief wind-up before payoff)
  4. Spring physics govern settling and bounce effects on nodes
  5. Nodes are draggable with realistic momentum and release
  6. Magnetic attraction draws particles toward cursor/finger position
  7. Tap on node shows quick preview tooltip near the node
  8. Hold on node opens bottom sheet with full insight details
  9. Basic tap feedback provides immediate visual response

---

### Phase 24: UX & Mobile Optimization
**Goal**: Polish user experience flows and ensure 60fps performance on mobile devices
**Depends on**: Phase 23
**Requirements**: UX-01, UX-02, UX-03, UX-04, PERF-01, PERF-02, PERF-03, PERF-04, PERF-05, PERF-06, PERF-07
**Success Criteria** (what must be TRUE):
  1. Tap preview displays key metric near the tapped node
  2. Bottom sheet shows full insight data with proper mobile layout
  3. Error state handles "no insights found" gracefully with visual feedback
  4. Processing progress indicators prevent "stuck" feeling during analysis
  5. Visualization maintains 60fps on mid-range mobile (iPhone 11 class)
  6. Touch gestures (tap, hold, drag) are optimized for mobile accuracy
  7. Particle count adapts dynamically based on device capability
  8. GPU acceleration is enabled for all animations
  9. Intersection Observer pauses off-screen animations to save resources
  10. Reduced motion mode respects prefers-reduced-motion preference
  11. Labels remain readable on small screens (375px width minimum)

---

## v1.6 Brand Deals & Affiliate Hub (Planned)

**Milestone Goal:** Creator monetization hub with Revolut-style wallet and tier-gated brand deals marketplace. Manual deal curation first, aggregation deferred to v1.7+.

**Approach:** Foundation-first, display-only wallet (never hold funds)
- Phase 25: Database foundation (deals, wallet, profiles, enrollments schema)
- Phase 26: Creator Profile (social handles, metrics, eligibility)
- Phase 27: Wallet Core (Revolut-style display, transactions, earnings breakdown)
- Phase 28: Deal Marketplace (browse, filter, apply, status tracking)
- Phase 29: Tier Gating & Affiliate (subscription access control, Virtuna affiliate program)
- Phase 30: UX Polish & Navigation (eligibility, confirmations, notifications, sidebar integration)

**Architecture Constraint:** Display earnings only — never hold creator funds (money transmission compliance).

---

### Phase 25: Database Foundation
**Goal**: Establish Supabase schema for all v1.6 features — deals, wallet transactions, creator profiles, enrollments, and affiliate tracking
**Depends on**: v1.4 complete (Phase 24)
**Requirements**: DEAL-02
**Success Criteria** (what must be TRUE):
  1. `creator_profiles` table exists with social handles, follower counts, and niche fields
  2. `deals` table exists with structured data (brand, compensation, requirements, deliverables, tier)
  3. `deal_enrollments` table exists linking creators to deals with status tracking
  4. `wallet_transactions` table exists as immutable ledger with balance snapshots
  5. `affiliate_clicks` and `conversions` tables exist for attribution tracking
  6. RLS policies enforce data access control per user
**Plans**: TBD

---

### Phase 26: Creator Profile
**Goal**: Enable creators to set up profiles with social handles and metrics used for deal eligibility matching
**Depends on**: Phase 25
**Requirements**: PROF-01, PROF-02, PROF-03
**Success Criteria** (what must be TRUE):
  1. User can access profile setup page from settings or onboarding
  2. User can enter social handles (TikTok, Instagram, YouTube, Twitter)
  3. User can enter follower counts and engagement metrics
  4. User can select content niches/categories
  5. Profile data persists in Supabase and is available for eligibility checks
**Plans**: TBD

---

### Phase 27: Wallet Core
**Goal**: Build Revolut-style wallet dashboard showing earnings, transactions, and payment status — display only, never holds funds
**Depends on**: Phase 25
**Requirements**: WALT-01, WALT-02, WALT-03, WALT-04, WALT-05, WALT-06, WALT-07
**Success Criteria** (what must be TRUE):
  1. User sees current balance prominently displayed (large, Revolut-style)
  2. User can view transaction history with sorting and filtering
  3. User can distinguish pending vs available balance
  4. User can see earnings breakdown by source/deal
  5. User can see payment status indicators (paid, pending, processing, failed)
  6. User can see earnings velocity ("You earned $X this week")
  7. Withdrawal flow links to external provider (not in-app holding)
**Plans**: TBD

---

### Phase 28: Deal Marketplace
**Goal**: Build deal browsing experience with filters, details, and application flow — manual curation only
**Depends on**: Phase 25, Phase 26
**Requirements**: MRKT-01, MRKT-02, MRKT-03, MRKT-04, MRKT-05, MRKT-06, MRKT-07, MRKT-08, MRKT-09, MRKT-10, DEAL-01, DEAL-03
**Success Criteria** (what must be TRUE):
  1. User can browse deals with filters (category, tier, compensation type)
  2. User can view deal details (brand info, compensation, requirements, deliverables)
  3. User can see compensation clearly (fixed amount, rev-share %, or hybrid)
  4. User can see deal requirements (follower count, engagement, content type)
  5. User can apply to deals via application form
  6. User can track deal status (applied, accepted, rejected, active, completed)
  7. User can see locked/unlocked status based on subscription tier
  8. User can save/bookmark deals for later
  9. Admin can manually add/edit/remove deals and mark as active/paused/expired
**Plans**: TBD

---

### Phase 29: Tier Gating & Affiliate
**Goal**: Implement subscription-based access control and Virtuna's own affiliate program
**Depends on**: Phase 28
**Requirements**: TIER-01, TIER-02, TIER-03, AFFL-01, AFFL-02, AFFL-03, AFFL-04
**Success Criteria** (what must be TRUE):
  1. Starter subscribers ($9/mo) can access affiliate deals only
  2. Pro subscribers ($29/mo) can access rev-share marketplace deals
  3. Locked deals show "Upgrade to Pro" CTA with clear value proposition
  4. Virtuna affiliate program displayed prominently (highest commission tier)
  5. User can generate affiliate links for available programs
  6. System tracks clicks and conversions for affiliate links
  7. User can see affiliate performance metrics (clicks, conversions, earnings)
**Plans**: TBD

---

### Phase 30: UX Polish & Navigation
**Goal**: Complete user experience with eligibility feedback, confirmations, notifications, and sidebar integration
**Depends on**: Phase 27, Phase 28, Phase 29
**Requirements**: UX-01, UX-02, UX-03, UX-04, UX-05, NAV-01, NAV-02, NAV-03, NAV-04
**Success Criteria** (what must be TRUE):
  1. User sees eligibility status before applying ("You qualify" / "Requires Pro")
  2. User sees confirmation after submitting deal application
  3. User can access "My Deals" showing all applications and active deals
  4. User can mark deal deliverables as complete
  5. User receives notifications (application accepted, payment received, deal status)
  6. Brand Deals accessible from app sidebar
  7. Wallet accessible from app sidebar or header
  8. Subscription tier displayed in relevant contexts
  9. My Deals accessible from sidebar or deals page
**Plans**: TBD

---

## v1.7 Viral Predictor Results (Planned)

**Milestone Goal:** Design and build the viral predictor results card — the breakdown/analysis shown to users after running a prediction. Same format reused in Trending Page's "Analyze" action.

**Context:** See `.planning/DISCUSS-CONTEXT-viral-predictor-results.md`

**Approach:** Research-driven design
- Phase 35: Results Card Structure & Scoring — breakdown sections, scoring system, visual hierarchy
- Phase 36: Results Card Implementation — build components, integrate with predictor flow

---

### Phase 35: Results Card Structure & Scoring
**Goal**: Define the breakdown structure, scoring system, and visual presentation for viral analysis results
**Depends on**: None (design phase)
**Requirements**: TBD (after discussion)
**Success Criteria** (what must be TRUE):
  1. Breakdown structure defined (sections, information hierarchy)
  2. Scoring approach decided (single vs multi-dimensional, confidence levels)
  3. Visual layout direction established (cards vs tabs vs expandable)
  4. Actionability clear (how insights drive user action, connection to Remix)
**Status**: Awaiting discussion
**Plans**: TBD

---

### Phase 36: Results Card Implementation
**Goal**: Build the results card components and integrate with viral predictor flow
**Depends on**: Phase 35
**Requirements**: TBD (derived from Phase 35)
**Success Criteria** (what must be TRUE):
  1. Results card renders breakdown per Phase 35 spec
  2. Scoring displays with appropriate visual treatment
  3. Mobile-responsive layout works from 375px
  4. Reusable for Trending Page "Analyze" action
**Status**: Not started
**Plans**: TBD

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-10 | v1.1 | 44/44 | Complete | 2026-01-29 |
| 11. Extraction | v1.2 | 4/4 | Complete | 2026-01-30 |
| 12. Comparison | v1.2 | 4/4 | Complete | 2026-01-30 |
| 15. Foundation + Primitives | v1.3.2 | 3/3 | Complete | 2026-01-31 |
| 16. Hero Section | v1.3.2 | 0/3 | Not started | - |
| 17. Feature Cards | v1.3.2 | 0/2 | Not started | - |
| 18. Navigation + Animations | v1.3.2 | 0/4 | Not started | - |
| 19. Quality & Polish | v1.3.2 | 0/3 | Not started | - |
| 20. Visualization Foundation | v1.4 | 1/4 | In Progress | - |
| 21. Particle System | v1.4 | 0/2 | Planned | - |
| 22. Node System | v1.4 | 0/TBD | Not started | - |
| 23. Motion & Interaction | v1.4 | 0/TBD | Not started | - |
| 24. UX & Mobile Optimization | v1.4 | 0/TBD | Not started | - |
| 25. Database Foundation | v1.6 | 0/TBD | Not started | - |
| 26. Creator Profile | v1.6 | 0/TBD | Not started | - |
| 27. Wallet Core | v1.6 | 0/TBD | Not started | - |
| 28. Deal Marketplace | v1.6 | 0/TBD | Not started | - |
| 29. Tier Gating & Affiliate | v1.6 | 0/TBD | Not started | - |
| 30. UX Polish & Navigation | v1.6 | 0/TBD | Not started | - |
| 35. Results Card Structure & Scoring | v1.7 | 0/TBD | Awaiting discussion | - |
| 36. Results Card Implementation | v1.7 | 0/TBD | Not started | - |

---

## Current Status
- **Current Milestone**: v1.4 (Node Visualization MVP)
- **Current Phase**: 20 (Visualization Foundation) - In Progress (Spline approach)
- **Next Action**: `/gsd:execute-phase 20`

---
*Roadmap created: 2026-01-28*
*Last updated: 2026-02-02 — Added v1.6 Brand Deals & Affiliate Hub (Phases 25-30)*
