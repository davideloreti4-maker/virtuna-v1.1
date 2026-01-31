# Roadmap — Virtuna

## Milestones

- **v1.1 Pixel-Perfect Clone** - Phases 1-10 (shipped 2026-01-29)
- **v1.2 Visual Accuracy Refinement** - Phases 11-14 (shipped 2026-01-30)
- **v1.3.2 Landing Page Redesign** - Phases 15-19 (in progress)
- **v1.4 Node Visualization MVP** - Phases 20-24 (planned)

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
- Phase 20: Visualization foundation (orb core, dark mode, visual foundation)
- Phase 21: Particle system (ambient flow, processing rush, captivating idle)
- Phase 22: Node system (chaos nodes, crystallization, connections, motion layers)
- Phase 23: Motion and interaction (physics, gestures, drag, magnetic)
- Phase 24: UX and mobile optimization (tooltips, sheets, 60fps mobile)

---

### Phase 20: Visualization Foundation
**Goal**: Establish the visual core — central glowing orb with ambient breathing, pan/zoom canvas infrastructure, and animation state system
**Depends on**: v1.3.2 complete (Phase 19)
**Requirements**: VIZ-01, VIZ-02, VIZ-09, VIZ-10
**Success Criteria** (what must be TRUE):
  1. Central glowing orb renders as the focal "AI brain" element with radial gradient and glow
  2. Orb has ambient "breathing" animation with 2-3 second scale pulse cycle
  3. Pan/zoom works on desktop (drag + wheel) and touch (pinch + drag)
  4. Reset button appears after user moves view and resets to centered state
  5. Canvas rendering is crisp on retina displays
  6. Orb responds to hover/tap with glow brighten interaction
  7. prefers-reduced-motion shows static orb (no animation)
**Plans**: 3 plans

Plans:
- [ ] 20-01-PLAN.md — Install react-zoom-pan-pinch, create ProgressiveVisualization with pan/zoom
- [ ] 20-02-PLAN.md — Glass orb rendering with Canvas 2D radial gradients and glow
- [ ] 20-03-PLAN.md — Orb animations (breathing, state transitions, hover/tap feedback)

---

### Phase 21: Particle System
**Goal**: Create the ambient particle flow that surrounds the orb and rushes inward during processing
**Depends on**: Phase 20
**Requirements**: VIZ-03, VIZ-04, VIZ-08
**Success Criteria** (what must be TRUE):
  1. Ambient particles flow continuously around the orb in idle state
  2. Particles rush toward the orb when processing begins (triggered state change)
  3. Idle state is captivating enough to hook users before any interaction
  4. Particle system uses requestAnimationFrame for smooth animation loop
  5. Particle count is configurable for later performance optimization
**Plans**: 2 plans

Plans:
- [ ] 21-01-PLAN.md — Core particle infrastructure (types, utilities, simplex-noise)
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
| 20. Visualization Foundation | v1.4 | 0/TBD | Not started | - |
| 21. Particle System | v1.4 | 0/2 | Planned | - |
| 22. Node System | v1.4 | 0/TBD | Not started | - |
| 23. Motion & Interaction | v1.4 | 0/TBD | Not started | - |
| 24. UX & Mobile Optimization | v1.4 | 0/TBD | Not started | - |

---

## Current Status
- **Current Milestone**: v1.3.2 (Landing Page Redesign)
- **Current Phase**: 16 (Hero Section) - Ready to plan
- **Next Action**: `/gsd:discuss-phase 16`

---
*Roadmap created: 2026-01-28*
*Last updated: 2026-01-31 — Phase 15 complete*
