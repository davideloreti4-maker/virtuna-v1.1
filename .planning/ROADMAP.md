# Roadmap: Virtuna — Landing Page Redesign

## Overview

Replace the societies.io clone landing page with a Raycast-style landing page presenting Virtuna as a social media intelligence platform, built section-by-section via v0 generation adapted to the existing design system.

### Phase 1: Page Foundation & Navigation

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

### Phase 2: Hero Section

**Goal:** Visitor immediately understands what Virtuna is and can take action -- bold hero with value proposition, product visual, animated background, and clear CTA.

**Depends on:** Phase 1 (navbar and page skeleton must exist)

**Requirements:** HERO-01, HERO-02, HERO-03, HERO-04, HERO-06

**Success Criteria** (what must be TRUE):
1. Hero displays a bold headline communicating "social media intelligence" value proposition with a supporting subtitle explaining what Virtuna does
2. Hero contains a primary "Get started" CTA button and a secondary action (e.g., "Learn more" or "View demo") with distinct visual hierarchy
3. A product screenshot showing the app in context is visible in the hero, framed appropriately for desktop presentation
4. An animated gradient/mesh/noise background plays behind the hero content, adding visual depth without distracting from the text

**Plans:** TBD

---

### Phase 3: Social Proof & Trust

**Goal:** Visitor sees credibility signals immediately below the hero -- logos, metrics, and testimonials that build trust before feature explanations.

**Depends on:** Phase 2 (hero must exist to establish visual language)

**Requirements:** SOCL-01, SOCL-02, SOCL-03

**Success Criteria** (what must be TRUE):
1. Animated stat counters (e.g., "500K+ videos analyzed") count up when scrolled into view, conveying platform scale
2. Testimonial cards display placeholder quotes with avatar, name, and role in glass card styling consistent with Raycast aesthetic
3. A logo cloud shows partner/integration logos in a marquee or grid layout, reinforcing ecosystem credibility

**Plans:** TBD

---

### Phase 4: Product Story & Features

**Goal:** Visitor understands what Virtuna does and why it is better -- product screenshots and feature descriptions tell the story through "show don't tell."

**Depends on:** Phase 2 (hero establishes design language for feature sections)

**Requirements:** FEAT-01, FEAT-02, FEAT-03, FEAT-04

**Success Criteria** (what must be TRUE):
1. A feature grid displays 3-4 key capabilities with icons and descriptions inside glass cards
2. Product screenshots of the trending page and dashboard are shown in desktop browser chrome frames (macOS window with traffic lights)
3. Mobile/app view screenshots are displayed in appropriate device frames
4. A Raycast-style asymmetric bento grid layout showcases different capabilities with varying card sizes

**Plans:** TBD

---

### Phase 5: Conversion & Polish

**Goal:** Complete, production-ready landing page with conversion layer (use cases, FAQ, pricing, final CTA), scroll animations on all sections, and verified responsive design across all breakpoints.

**Depends on:** Phase 3, Phase 4 (all content sections must exist before conversion layer and full-page polish)

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

### Phase 6: Premium Hero Visual

**Goal:** Hero section elevated with an interactive 3D element that creates immediate visual impact and differentiates Virtuna from standard SaaS landing pages.

**Depends on:** Phase 2 (hero must exist; this phase enhances it)

**Requirements:** HERO-05

**Success Criteria** (what must be TRUE):
1. An interactive 3D visual (Spline scene or Three.js element) renders in the hero section, responding to mouse movement or scroll
2. 3D element loads via dynamic import with SSR disabled, showing a loading placeholder until ready
3. On mobile or when `prefers-reduced-motion` is active, a static fallback image replaces the 3D element

**Plans:** TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Page Foundation & Navigation | 0/? | Not started | - |
| 2. Hero Section | 0/? | Not started | - |
| 3. Social Proof & Trust | 0/? | Not started | - |
| 4. Product Story & Features | 0/? | Not started | - |
| 5. Conversion & Polish | 0/? | Not started | - |
| 6. Premium Hero Visual | 0/? | Not started | - |

---
*Roadmap created: 2026-02-06*
*Last updated: 2026-02-08 -- Phases renumbered to milestone-scoped (1-6)*
