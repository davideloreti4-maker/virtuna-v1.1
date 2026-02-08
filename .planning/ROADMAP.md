# Roadmap: Virtuna

## Milestones

- v2.3.5 Design Token Alignment -- Phases 53-55 (active)
- v2.2 Trending Page UI -- Phases 50-52 (shipped 2026-02-06) | [Archive](milestones/v2.2-ROADMAP.md)
- v2.1 Dashboard Rebuild -- Phases 45-49 (active)
- v2.0 Design System Foundation -- Phases 39-44 (shipped 2026-02-05) | [Archive](milestones/v2.0-ROADMAP.md)
- v1.2 Visual Accuracy Refinement -- Phases 11-14 (shipped 2026-01-30)
- v1.1 Pixel-Perfect Clone -- Phases 1-10 (shipped 2026-01-29)
- v1.3.2-v1.7 -- Phases 15-38 (archived 2026-02-03)

## v2.3.5 Design Token Alignment

**Milestone Goal:** Achieve 1:1 design alignment with Raycast.com (except coral #FF7F50 branding) by correcting all design tokens, components, reference docs, and verifying zero regressions.

### Phase 53: Font & Color Foundation

**Goal:** All text renders in Inter with correct line-height and letter-spacing, and every color token in globals.css matches the Raycast extraction exactly.

**Dependencies:** None (foundation phase)

**Requirements:** TYPO-01, TYPO-02, TYPO-03, TYPO-04, TYPO-05, COLR-01, COLR-02, COLR-03, COLR-04, COLR-05, COLR-06, COLR-07

**Description:** Replace Funnel Display and Satoshi with Inter via next/font. Fix body line-height from 1.15 to 1.5-1.6 and add letter-spacing 0.2px. Correct all grey scale tokens to exact hex (not oklch). Add card gradient, glass gradient, input background, and button shadow tokens with Raycast-accurate values. This phase touches globals.css @theme, layout.tsx font loading, and token aliases.

**Success Criteria** (what must be TRUE):
1. Every page renders text in Inter font family -- no Funnel Display or Satoshi visible anywhere in the application
2. Body text has comfortable 1.5-1.6 line-height and 0.2px letter-spacing matching Raycast's typographic rhythm
3. All grey scale tokens in globals.css @theme use exact hex values (not oklch), and dark colors (L < 0.15) render to correct hex when compiled
4. Card gradient, glass gradient, input background, border opacity, and button shadow token values in globals.css match the Raycast extraction document exactly
5. Font-size scale tokens are verified against Raycast type scale with any discrepancies documented

**Plans:** 2 plans

Plans:
- [x] 53-01-PLAN.md -- Font + color token foundation (globals.css overhaul, Inter font loading, Satoshi deletion)
- [x] 53-02-PLAN.md -- Component font migration (remove font-display from 11 files, fix weights, input bg, showcase docs)

---

### Phase 54: Card & Surface Corrections

**Goal:** Cards, header/navbar, and input components render with Raycast-accurate backgrounds, borders, shadows, and hover states.

**Dependencies:** Phase 53 (color tokens and font must be correct before component visual fixes)

**Requirements:** CARD-01, CARD-02, CARD-03, CARD-04, CARD-05, HEAD-01, HEAD-02, INPT-01, INPT-02, INPT-03

**Description:** Update Card/GlassCard to use solid 137deg gradient (no backdrop-filter blur), add proper hover states (translate-y, border change, bg overlay), fix border to 6% with 12px radius and correct inset shadow. Fix FeatureCard border opacities to 6%/10%. Apply Raycast glass navbar pattern to Header. Align base Input to GlassInput pattern with white/5 background, 5% border, and 42px height.

**Success Criteria** (what must be TRUE):
1. Cards display a solid 137deg gradient background with no backdrop-filter blur, and hovering a card produces a subtle lift (-0.5 translate-y), border brightening to 10%, and white/3 background overlay
2. Card borders use rgba(255,255,255,0.06) at 12px radius with rgba(255,255,255,0.1) inset shadow, and FeatureCard matches these exact opacities (6% base / 10% hover)
3. Header/navbar uses the Raycast glass pattern (137deg gradient + blur(5px) + 6% border) and mobile menu divider uses 6% opacity
4. All input components use rgba(255,255,255,0.05) background with 5% border opacity and 42px height, matching GlassInput/Raycast pattern

**Plans:** 3 plans

Plans:
- [x] 54-01-PLAN.md -- Card variants + Header glass navbar (Card, GlassCard, FeatureCard, ExtensionCard, TestimonialCard, Header)
- [x] 54-02-PLAN.md -- Input + Textarea consolidation (merge GlassInput features, create Textarea, update barrel)
- [x] 54-03-PLAN.md -- Consumer migration + deprecation re-exports + visual verification checkpoint

---

### Phase 55: Glass, Documentation & Regression

**Goal:** GlassPanel uses Raycast-minimal neutral glass, all reference docs contain accurate Raycast values, and every component/page passes visual regression.

**Dependencies:** Phase 54 (all token and component fixes must be complete before regression)

**Requirements:** GLAS-01, GLAS-02, GLAS-03, GLAS-04, GLAS-05, GLAS-06, DOCS-01, DOCS-02, DOCS-03, DOCS-04, REGR-01, REGR-02, REGR-03, REGR-04, REGR-05

**Description:** Refactor GlassPanel to Raycast neutral glass only (remove colored tints, inner glow, reduce default blur to 5px, fix radius to 12px, correct inset shadow). Remove or deprecate GradientGlow and GradientMesh components. Rewrite BRAND-BIBLE.md from scratch with all Raycast-accurate values. Update all design docs and MEMORY.md. Run full visual regression across all 36 components, trending page, dashboard, and 7-page showcase. Verify WCAG AA contrast compliance maintained.

**Success Criteria** (what must be TRUE):
1. GlassPanel renders with Raycast neutral glass only (no colored tints, no inner glow), default blur of 5px, 12px radius, and correct inset shadow -- GradientGlow and GradientMesh are removed or deprecated
2. BRAND-BIBLE.md describes "Raycast Design Language" (not iOS 26 Liquid Glass) with all token values matching the Raycast extraction
3. All 36 design system components render correctly in the showcase after token and component changes
4. Trending page (/trending) and dashboard render correctly with no visual regressions
5. WCAG AA contrast compliance maintained (5.4:1+ for muted text) and all design docs + MEMORY.md updated with final verified values

**Plans:** 3 plans

Plans:
- [ ] 55-01-PLAN.md -- GlassPanel refactor + component deletions + CSS cleanup
- [ ] 55-02-PLAN.md -- BRAND-BIBLE.md rewrite + design doc updates
- [ ] 55-03-PLAN.md -- Full regression audit + WCAG contrast check + visual verification

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

**Description:** Migrate every form (ContentForm, SurveyForm, TestTypeSelector) and every modal (CreateSociety, DeleteTest, LeaveFeedback, SocietySelector) to use design system GlassInput, GlassTextarea, Select, Dialog, GlassCard, and Button components. All inputs gain consistent focus rings and error states. All modals gain consistent overlay, animation, and close behavior.

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

**Description:** Migrate the results panel sections (ImpactScore, AttentionBreakdown, Variants, Insights, Themes) to GlassCard/GlassProgress/Badge/Typography. Rebuild the top bar ContextBar and filter/legend pills using design system tokens and GlassPill. Replace loading states with GlassPanel + GlassProgress + Spinner. This completes Wave 1 -- full dashboard design system coverage.

**Success Criteria:**
1. Results panel renders each section (impact score, attention breakdown, variants, insights, themes) using GlassCard, GlassProgress, Badge, and Typography -- no legacy styled components remain
2. Top bar shows context text with Typography tokens and filter/legend pills as GlassPill components with correct tint colors
3. Loading state displays a GlassPanel with animated GlassProgress bar, Spinner, and a functional cancel button
4. Share button in results panel uses Button ghost variant with correct hover/active states

**Dependencies:** Phase 45 (layout structure must exist)

---

### Phase 48: Hive Foundation (Layout + Rendering)

**Goal:** Canvas-based hive visualization renders 1000+ nodes in a deterministic radial layout at 60fps with retina support.

**Requirements:** HIVE-01, HIVE-02, HIVE-03, HIVE-04, HIVE-05, HIVE-06, HIVE-07, HIVE-08, HIVE-09

**Description:** Build the HiveCanvas component using Canvas 2D with d3-hierarchy for deterministic radial positioning. Render a center thumbnail placeholder, 10+ tier-1 nodes, 100+ tier-2 nodes, and 1000+ tier-3 leaf nodes with connection lines that fade by distance. The canvas resizes responsively via ResizeObserver, supports retina/HiDPI displays, and provides a reduced-motion fallback with static layout.

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

**Description:** Add interactive behaviors to the hive canvas: d3-quadtree hit detection for O(log n) pointer lookups, hover highlighting with connected-node emphasis and non-connected dimming, click glow/scale effects with a GlassCard info overlay, zoom/pan controls, and debounced hover states to prevent flicker in dense clusters.

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
| 47 | v2.1 | 0/? | Pending | - |
| 48 | v2.1 | 0/? | Pending | - |
| 49 | v2.1 | 0/? | Pending | - |
| 50-52 | v2.2 | 10/10 | Shipped | 2026-02-06 |
| 53 | v2.3.5 | 2/2 | Complete | 2026-02-06 |
| 54 | v2.3.5 | 3/3 | Complete | 2026-02-08 |
| 55 | v2.3.5 | 0/? | Not started | - |

---
*Roadmap created: 2026-02-03*
*Last updated: 2026-02-08 -- Phase 54 complete (Card & Surface Corrections)*
