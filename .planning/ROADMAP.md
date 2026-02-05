# Roadmap: Virtuna

## Milestones

- v2.2 Trending Page UI -- Phases 50-52 (active)
- v2.1 Dashboard Rebuild -- Phases 45-49 (active)
- v2.0 Design System Foundation -- Phases 39-44 (shipped 2026-02-05) | [Archive](milestones/v2.0-ROADMAP.md)
- v1.2 Visual Accuracy Refinement -- Phases 11-14 (shipped 2026-01-30)
- v1.1 Pixel-Perfect Clone -- Phases 1-10 (shipped 2026-01-29)
- v1.3.2-v1.7 -- Phases 15-38 (archived 2026-02-03)

## v2.2 Trending Page UI

### Phase 50: Data Layer & Page Shell

**Goal:** Trending page route exists with mock data, category tabs, and filtering -- the structural foundation that all visual components build on.

**Requirements:** MOCK-01, MOCK-02, MOCK-03, PAGE-01, PAGE-02, PAGE-03, PAGE-04, FILT-01, FILT-02, FILT-03, FILT-04

**Description:** Create the mock data layer (20+ trending videos with full metadata across 3 categories), TypeScript types, and the `/trending` route within the `(app)` route group. Build the page shell with Typography heading, full-width AppShell layout, sidebar nav item, and category tabs (Breaking Out / Sustained Viral / Resurging) using the design system Tabs component with coral accent. Tab switching filters content client-side.

**Success Criteria:**
1. User can navigate to `/trending` via sidebar nav item and sees a page header reading "Trending" styled with Typography Heading
2. Three category tabs (Breaking Out, Sustained Viral, Resurging) render with coral accent on the active tab
3. Switching tabs filters content client-side without page reload
4. Mock data file exports 20+ videos with complete metadata (id, title, thumbnail, creator, views, likes, shares, date, category, hashtags, tiktokUrl, velocity) and realistic values

**Dependencies:** None (foundation phase)

**Plans:** 2 plans

Plans:
- [ ] 50-01-PLAN.md -- TypeScript types and mock data layer (42 videos, 3 categories, filtering helpers)
- [ ] 50-02-PLAN.md -- Page route, sidebar nav, client shell with tabs/URL sync/stats bar/skeleton states

---

### Phase 51: Video Feed & Cards

**Goal:** Users see a responsive grid of video cards with thumbnails, metadata, category tags, and trending indicators that respond to the active category tab.

**Requirements:** CARD-01, CARD-02, CARD-03, CARD-04, CARD-05, FEED-01, FEED-02, FEED-03, FEED-04

**Description:** Build the VideoCard component using GlassCard with HoverScale, showing thumbnail, creator name, view count, date, GlassPill category tag, and trending velocity indicator. Assemble cards into a responsive grid (3 cols desktop, 2 tablet, 1 mobile) fed by mock data. Add infinite scroll with Skeleton placeholders and an empty state for unmatched filters. VideoCard click triggers detail modal (wired in Phase 52).

**Success Criteria:**
1. VideoCard displays thumbnail image, creator name, formatted view count, date, and a GlassPill category tag
2. VideoCard shows a trending velocity indicator (rising/peaking/declining arrow) and scales on hover via HoverScale
3. Video grid renders 3 columns on desktop, 2 on tablet, 1 on mobile, populated from mock data matching the active tab
4. Scrolling to the bottom loads more cards with Skeleton placeholders; switching to a tab with no matches shows an empty state message

**Dependencies:** Phase 50 (mock data and page shell must exist)

**Plans:** TBD

---

### Phase 52: Detail Modal & Bookmarks

**Goal:** Users can view video details in a modal with TikTok embed and take actions (analyze, bookmark, remix stub), with bookmark state persisting across sessions.

**Requirements:** DETL-01, DETL-02, DETL-03, DETL-04, DETL-05, DETL-06, DETL-07, BMRK-01, BMRK-02, BMRK-03

**Description:** Build the video detail modal using design system Dialog (lg/xl size) triggered by VideoCard click. Modal shows TikTok embed iframe, full metadata (creator, views, likes, shares, date, hashtags), and three action buttons: Analyze (wired to Viral Predictor), Bookmark (Zustand + localStorage toggle), and Remix ("Coming Soon" badge). Implement Zustand bookmark store with localStorage persistence. Bookmarked videos show filled icon on their VideoCard. Add optional "Saved" filter tab to view bookmarked videos. Modal closes via overlay click, escape key, or close button.

**Success Criteria:**
1. Clicking a VideoCard opens a Dialog modal showing a TikTok embed iframe and full metadata (creator, views, likes, shares, date, hashtags)
2. Modal shows three action buttons: Analyze (navigates to Viral Predictor flow), Bookmark (toggles filled/unfilled icon), and Remix (shows "Coming Soon" tooltip or badge)
3. Bookmarked videos persist across page reloads (Zustand + localStorage) and show a filled bookmark icon on their VideoCard in the grid
4. Modal closes via overlay click, escape key, or close button
5. Optional "Saved" tab in the category bar filters the grid to show only bookmarked videos

**Dependencies:** Phase 51 (VideoCard click must exist to trigger modal)

**Plans:** TBD

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
- [ ] 45-01-PLAN.md -- Sidebar store (Zustand persist), z-index scale, SidebarToggle component
- [ ] 45-02-PLAN.md -- Floating GlassPanel sidebar rebuild, nav items, test history migration
- [ ] 45-03-PLAN.md -- AppShell content push, mobile overlay, MobileNav replacement

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
| 45 | v2.1 | 0/3 | Planned | - |
| 46 | v2.1 | 0/? | Pending | - |
| 47 | v2.1 | 0/? | Pending | - |
| 48 | v2.1 | 0/? | Pending | - |
| 49 | v2.1 | 0/? | Pending | - |
| 50 | v2.2 | 0/2 | Planned | - |
| 51 | v2.2 | 0/? | Not started | - |
| 52 | v2.2 | 0/? | Not started | - |

---
*Roadmap created: 2026-02-03*
*Last updated: 2026-02-05 -- v2.2 Trending Page UI roadmap added (Phases 50-52)*
