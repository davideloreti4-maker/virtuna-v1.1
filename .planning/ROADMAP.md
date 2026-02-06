# Roadmap: Virtuna

## Milestones

- v3.1 Landing Page Redesign -- Phases 53-58 (active)
- v2.2 Trending Page UI -- Phases 50-52 (shipped 2026-02-06) | [Archive](milestones/v2.2-ROADMAP.md)
- v2.1 Dashboard Rebuild -- Phases 45-49 (active, main branch)
- v2.0 Design System Foundation -- Phases 39-44 (shipped 2026-02-05) | [Archive](milestones/v2.0-ROADMAP.md)
- v1.2 Visual Accuracy Refinement -- Phases 11-14 (shipped 2026-01-30)
- v1.1 Pixel-Perfect Clone -- Phases 1-10 (shipped 2026-01-29)
- v1.3.2-v1.7 -- Phases 15-38 (archived 2026-02-03)

## v3.1 Landing Page Redesign

**Milestone Goal:** Replace the societies.io clone landing page with a Raycast-style landing page presenting Virtuna as a social media intelligence platform, built section-by-section via v0 generation adapted to the existing design system.

### Phase 53: Page Foundation & Navigation

**Goal:** Deployable minimal page skeleton with Raycast-style navbar, footer, and infrastructure patterns (SectionWrapper, v0 migration checklist, SEO metadata, SSR strategy) that all subsequent sections build on.

**Depends on:** None (foundation phase)

**Requirements:** NAV-01, NAV-02, NAV-03, NAV-04, FOOT-01, XCUT-03, XCUT-04, XCUT-05

**Success Criteria** (what must be TRUE):
1. Visitor sees a sticky navbar with Virtuna logo, navigation links (Features, Trending, Dashboard), and a "Get started" CTA button that follows Raycast top nav styling
2. On mobile viewport, navbar collapses to a hamburger menu with slide-out navigation containing all links
3. Page renders a minimal footer with copyright text and social icon links
4. Page has correct SEO metadata (title, description, OG image) visible in view-source and social share previews
5. SectionWrapper component enforces consistent max-width, padding, and spacing across all future sections

**Plans:** TBD

---

### Phase 54: Hero Section

**Goal:** Visitor immediately understands what Virtuna is and can take action -- bold hero with value proposition, product visual, animated background, and clear CTA.

**Depends on:** Phase 53 (navbar and page skeleton must exist)

**Requirements:** HERO-01, HERO-02, HERO-03, HERO-04, HERO-06

**Success Criteria** (what must be TRUE):
1. Hero displays a bold headline communicating "social media intelligence" value proposition with a supporting subtitle explaining what Virtuna does
2. Hero contains a primary "Get started" CTA button and a secondary action (e.g., "Learn more" or "View demo") with distinct visual hierarchy
3. A product screenshot showing the app in context is visible in the hero, framed appropriately for desktop presentation
4. An animated gradient/mesh/noise background plays behind the hero content, adding visual depth without distracting from the text

**Plans:** TBD

---

### Phase 55: Social Proof & Trust

**Goal:** Visitor sees credibility signals immediately below the hero -- logos, metrics, and testimonials that build trust before feature explanations.

**Depends on:** Phase 54 (hero must exist to establish visual language)

**Requirements:** SOCL-01, SOCL-02, SOCL-03

**Success Criteria** (what must be TRUE):
1. Animated stat counters (e.g., "500K+ videos analyzed") count up when scrolled into view, conveying platform scale
2. Testimonial cards display placeholder quotes with avatar, name, and role in glass card styling consistent with Raycast aesthetic
3. A logo cloud shows partner/integration logos in a marquee or grid layout, reinforcing ecosystem credibility

**Plans:** TBD

---

### Phase 56: Product Story & Features

**Goal:** Visitor understands what Virtuna does and why it is better -- product screenshots and feature descriptions tell the story through "show don't tell."

**Depends on:** Phase 54 (hero establishes design language for feature sections)

**Requirements:** FEAT-01, FEAT-02, FEAT-03, FEAT-04

**Success Criteria** (what must be TRUE):
1. A feature grid displays 3-4 key capabilities with icons and descriptions inside glass cards
2. Product screenshots of the trending page and dashboard are shown in desktop browser chrome frames (macOS window with traffic lights)
3. Mobile/app view screenshots are displayed in appropriate device frames
4. A Raycast-style asymmetric bento grid layout showcases different capabilities with varying card sizes

**Plans:** TBD

---

### Phase 57: Conversion & Polish

**Goal:** Complete, production-ready landing page with conversion layer (use cases, FAQ, pricing, final CTA), scroll animations on all sections, and verified responsive design across all breakpoints.

**Depends on:** Phase 55, Phase 56 (all content sections must exist before conversion layer and full-page polish)

**Requirements:** CONV-01, CONV-02, CONV-03, CONV-04, XCUT-01, XCUT-02, XCUT-06

**Success Criteria** (what must be TRUE):
1. FAQ section with expandable accordion answers common questions about the platform
2. A bottom CTA section with compelling headline and "Get started" action button creates final conversion opportunity
3. Use case cards show 3-4 personas/scenarios explaining who benefits from Virtuna
4. Pricing section displays tier cards with placeholder content in glass card styling
5. Every section on the page has scroll-triggered reveal animations (fade-in, slide-up, stagger) that fire on first viewport entry
6. Page renders correctly across desktop (1440px+), tablet (768px), and mobile (375px) breakpoints with no overflow or layout breaks

**Plans:** TBD

---

### Phase 58: Premium Hero Visual

**Goal:** Hero section elevated with an interactive 3D element that creates immediate visual impact and differentiates Virtuna from standard SaaS landing pages.

**Depends on:** Phase 54 (hero must exist; this phase enhances it)

**Requirements:** HERO-05

**Success Criteria** (what must be TRUE):
1. An interactive 3D visual (Spline scene or Three.js element) renders in the hero section, responding to mouse movement or scroll
2. 3D element loads via dynamic import with SSR disabled, showing a loading placeholder until ready
3. On mobile or when `prefers-reduced-motion` is active, a static fallback image replaces the 3D element

**Plans:** TBD

---

## v2.1 Dashboard Rebuild

### Phase 45: Structural Foundation (AppShell + Sidebar)

**Goal:** Dashboard layout restructured with floating glassmorphic sidebar that works across desktop and mobile viewports.

**Requirements:** SIDE-01, SIDE-02, SIDE-03, SIDE-04, SIDE-05, SIDE-06, SIDE-07, SIDE-08, MOBL-01, MOBL-02, MOBL-03

**Description:** Rebuild the AppShell layout with a floating GlassPanel sidebar that pushes main content on desktop and hides behind a hamburger toggle on mobile. All sidebar internals (nav items, selectors, test history) migrate to design system components. Collapse behavior with persistence, mobile backdrop-filter budget, and z-index scale are established here as the structural foundation for all subsequent phases.

**Success Criteria:**
1. Sidebar renders as a floating glassmorphic panel with blur/border on desktop, pushing main content to the right
2. User can collapse sidebar to icon-only mode and the collapsed state survives page refresh
3. On mobile viewport, sidebar is hidden by default and togglable via hamburger, with no more than 2 backdrop-filter elements active
4. Nav items, SocietySelector, ViewSelector, and test history list all render using design system primitives (Button, Select, Typography)

**Dependencies:** None (foundation phase)

**Plans:** 3 plans

Plans:
- [x] 45-01-PLAN.md -- Sidebar store (Zustand persist), z-index scale, SidebarToggle component
- [x] 45-02-PLAN.md -- Floating GlassPanel sidebar rebuild, nav items, test history migration
- [x] 45-03-PLAN.md -- AppShell content push, mobile overlay, MobileNav replacement

---

### Phase 46: Forms & Modals Migration

**Goal:** All form inputs and modal dialogs across the dashboard use design system components with consistent behavior.

**Requirements:** FORM-01, FORM-02, FORM-03, FORM-04, FORM-05, MODL-01, MODL-02, MODL-03, MODL-04, MODL-05

**Success Criteria:**
1. User can create content and survey tests using forms built entirely from design system inputs (GlassTextarea, GlassInput, Select, Button)
2. All form inputs show consistent focus rings on keyboard navigation and error states on invalid input
3. Every modal (create society, delete test, leave feedback, society selector) opens with consistent overlay/animation and closes via overlay click, escape key, or close button
4. TestTypeSelector renders as a Dialog with a GlassCard grid for type selection

**Dependencies:** Phase 45 (layout structure must exist)

**Plans:** 4 plans

Plans:
- [x] 46-01-PLAN.md -- ContentForm + SurveyForm migration to design system with Zod v4 validation
- [x] 46-02-PLAN.md -- TestTypeSelector rebuild as Dialog + GlassCard responsive grid
- [x] 46-03-PLAN.md -- CreateSocietyModal + DeleteTestModal + LeaveFeedbackModal migration
- [x] 46-04-PLAN.md -- SocietySelector modal migration + visual consistency verification

---

### Phase 47: Results Panel, Top Bar & Loading States

**Goal:** Results display, top bar filtering, and loading states all render through design system components, completing the dashboard migration.

**Requirements:** RSLT-01, RSLT-02, RSLT-03, RSLT-04, RSLT-05, RSLT-06, RSLT-07, TBAR-01, TBAR-02, TBAR-03, TBAR-04, LOAD-01, LOAD-02, LOAD-03

**Success Criteria:**
1. Results panel renders each section (impact score, attention breakdown, variants, insights, themes) using GlassCard, GlassProgress, Badge, and Typography -- no legacy styled components remain
2. Top bar shows context text with Typography tokens and filter/legend pills as GlassPill components with correct tint colors
3. Loading state displays a GlassPanel with animated GlassProgress bar, Spinner, and a functional cancel button
4. Share button in results panel uses Button ghost variant with correct hover/active states

**Dependencies:** Phase 45 (layout structure must exist)

**Plans:** 5 plans

Plans:
- [ ] 47-01-PLAN.md -- Migrate 5 results section cards (ImpactScore, AttentionBreakdown, Variants, Insights, Themes) to GlassCard/GlassProgress/Accordion
- [ ] 47-02-PLAN.md -- ResultsPanel wrapper + ShareButton toast + ToastProvider + test-creation-flow cleanup
- [ ] 47-03-PLAN.md -- Top bar migration (ContextBar, FilterPills, LegendPills) to GlassPill
- [ ] 47-04-PLAN.md -- Loading state rewrite (skeleton shimmer + progressive reveal + cancel)
- [ ] 47-05-PLAN.md -- Dashboard wiring + mobile blur budget + visual verification checkpoint

---

### Phase 48: Hive Foundation (Layout + Rendering)

**Goal:** Canvas-based hive visualization renders 1000+ nodes in a deterministic radial layout at 60fps with retina support.

**Requirements:** HIVE-01, HIVE-02, HIVE-03, HIVE-04, HIVE-05, HIVE-06, HIVE-07, HIVE-08, HIVE-09

**Success Criteria:**
1. Hive renders a center rounded rectangle with 3 concentric tiers of nodes (10+ main, 100+ sub, 1000+ leaf) connected by lines that fade with distance
2. Layout positions are deterministic (same data produces identical visual output across renders) using d3-hierarchy
3. Canvas maintains 60fps on a standard laptop and renders crisp on retina/HiDPI displays
4. Canvas resizes fluidly when the browser window changes size
5. Users with `prefers-reduced-motion` see a static layout with no animations

**Dependencies:** Phase 45 (needs to render within the AppShell layout)

---

### Phase 49: Hive Interactions (Click, Hover & Navigation)

**Goal:** Users can explore the hive by hovering, clicking, and navigating nodes with responsive feedback.

**Requirements:** HINT-01, HINT-02, HINT-03, HINT-04, HINT-05, HINT-06, HINT-07

**Success Criteria:**
1. Hovering a node highlights it and its connected nodes while dimming unrelated nodes, with no flickering in dense areas
2. Clicking a node triggers a visible glow/scale effect and shows a GlassCard info overlay positioned near the clicked node
3. User can zoom in/out and pan across the hive to explore dense regions
4. Hit detection performs at O(log n) via quadtree -- no perceptible lag when moving cursor across 1000+ nodes

**Dependencies:** Phase 48 (hive rendering must exist before adding interactions)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-10 | v1.1 | 44/44 | Complete | 2026-01-29 |
| 11-14 | v1.2 | 8/8 | Complete | 2026-01-30 |
| 15-38 | v1.3.2-v1.7 | - | Archived | 2026-02-03 |
| 39-44 | v2.0 | 35/35 | Complete | 2026-02-05 |
| 45 | v2.1 | 3/3 | Complete | 2026-02-05 |
| 46 | v2.1 | 4/4 | Complete | 2026-02-06 |
| 47 | v2.1 | 0/5 | Pending | - |
| 48 | v2.1 | 0/? | Pending | - |
| 49 | v2.1 | 0/? | Pending | - |
| 50-52 | v2.2 | 10/10 | Shipped | 2026-02-06 |
| 53 | v3.1 | 0/? | Not started | - |
| 54 | v3.1 | 0/? | Not started | - |
| 55 | v3.1 | 0/? | Not started | - |
| 56 | v3.1 | 0/? | Not started | - |
| 57 | v3.1 | 0/? | Not started | - |
| 58 | v3.1 | 0/? | Not started | - |

---
*Roadmap created: 2026-02-03*
*Last updated: 2026-02-06 -- v3.1 Landing Page Redesign roadmap added (Phases 53-58)*
