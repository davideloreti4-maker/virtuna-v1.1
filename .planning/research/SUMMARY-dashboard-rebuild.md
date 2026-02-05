# Project Research Summary

**Project:** Virtuna v2.1 Dashboard Rebuild
**Domain:** Glassmorphic dashboard UI + large-scale hierarchical node visualization
**Researched:** 2026-02-05
**Confidence:** HIGH

## Executive Summary

The v2.1 Dashboard Rebuild consists of two parallel workstreams: (1) migrating ~30 dashboard components from hardcoded styles to the existing 36-component design system, and (2) building a hive node visualization with 1000+ nodes. The research reveals a critical architectural decision that must be made before starting: **Canvas 2D vs R3F for the hive visualization**.

The Stack researcher recommends Canvas 2D + d3-hierarchy, arguing that 1000 nodes is well within Canvas 2D's performance envelope and that R3F introduces unnecessary complexity for a fundamentally 2D radial layout. The Architecture researcher proposes R3F with InstancedMesh, noting that the existing R3F infrastructure (VisualizationCanvas, context, shaders) is already in place. Both approaches are viable, but they have different implications for complexity, integration patterns, and the development path.

**Recommendation: Canvas 2D + d3-hierarchy** for the following reasons: (1) the hive is a 2D radial tree with no 3D transformation requirements, (2) 1000 nodes with connection lines renders at 60fps on Canvas 2D with basic optimization, (3) simpler hit-testing via d3-quadtree vs raycasting against InstancedMesh, (4) separates concerns — R3F stays dedicated to the GlassOrb and future 3D effects, Canvas 2D handles 2D data visualizations. The key risk is ensuring backdrop-filter blur works reliably over both Canvas types (2D and WebGL), which must be validated in the first Wave 1 task via proof-of-concept.

## Key Findings

### Recommended Stack

The dashboard rebuild requires minimal new dependencies. For Wave 1 (design system migration), all components are already available. For Wave 2 (hive visualization with Canvas 2D approach), only two lightweight packages are needed:

**New packages:**
- **d3-hierarchy** (v3.1.2, ~12KB): Computes radial tree layout positions from hierarchical data — deterministic, instant layout without simulation ticks
- **d3-quadtree** (v3.0.1, ~5KB): O(log n) spatial indexing for sub-millisecond hit-testing on 1000+ nodes

**Existing stack remains unchanged:**
- React 19.2.3, Next.js 16.1.5, Tailwind CSS 4 for UI layer
- Framer Motion 12.29.x for UI animations (NOT canvas animations)
- Zustand 5.0.10 for persistent state management
- R3F + Three.js + Drei for the GlassOrb and future 3D effects (separate from hive)

**Critical version requirements:** None — all packages are stable LTS versions.

**Why Canvas 2D over R3F for hive:** The visualization is fundamentally 2D (radial layout, no rotation), 1000 nodes is well within Canvas 2D's performance range (struggles begin at 10K+), hit-testing with d3-quadtree is simpler than InstancedMesh raycasting, and the existing network-visualization.tsx already demonstrates the exact pattern at 200 nodes. R3F InstancedMesh raycasting has known bugs at scale (issue #3289: onClick returns all instances in line of sight, not just the clicked one), requires manual bounding sphere updates, and introduces complexity for a 2D visualization.

### Expected Features

**Wave 1 (Design System Migration) — 17 table stakes features:**
All involve swapping hardcoded styles for design system components. The migration is purely visual — no business logic, store connections, or data flow changes.

Must complete:
- Floating glassmorphic sidebar (GlassPanel replacing hardcoded blur styles)
- All forms rebuilt (ContentForm, SurveyForm using GlassTextarea, GlassInput, GlassSelect, GlassRadio)
- All modals rebuilt (4 modals using DS Dialog component, not raw Radix)
- Results panels (GlassCard wrappers, GlassProgress bars, design tokens)
- Top bar components (GlassPill for filters, Button for CTAs, typography tokens)
- Mobile nav updated for floating sidebar paradigm
- Consistent focus rings and reduced motion support (already built into DS)

**Wave 2 (Hive Visualization) — 11 table stakes features:**

Must complete:
- Center rounded rectangle with content thumbnail (visual anchor)
- 3-tier radial hierarchy (10-15 main nodes, 80-120 sub-nodes, 800-1200 leaf nodes)
- Connection lines between tiers with distance-based opacity
- Click interaction: node glow + scale + info card overlay (HTML GlassCard)
- Hover interaction: highlight connected nodes, dim others
- Smooth zoom/pan (manual transform for Canvas 2D)
- Responsive sizing (ResizeObserver pattern like existing NetworkVisualization)
- Retina/HiDPI rendering (dpr scaling like existing components)

**Differentiators (nice-to-have):**
- Ambient glow behind sidebar (GradientGlow for floating-in-space effect)
- Node entry animation (stagger reveal from center outward)
- Pulsing glow on selected node (breathing animation using coral brand color)
- Connection line glow on hover path
- Tier-based color coding (coral, purple, blue, cyan from brand palette)

**Defer to post-MVP:**
- Smooth transition between idle and results states (node position interpolation — high complexity)
- Sidebar collapse animation (exists as stub, low priority)
- Mouse proximity reactive nodes (distance-based grow/brighten)

### Architecture Approach

The v2.1 rebuild integrates two parallel workstreams into the existing Next.js App Router architecture without changing the core structure. The design system primitives already cover every UI pattern used in the dashboard. The existing R3F infrastructure (VisualizationCanvas, VisualizationContext) already handles WebGL lifecycle, mobile detection, and reduced motion. The hive visualization adds a new Canvas 2D component alongside (not inside) the R3F canvas.

**Major components:**

1. **AppShell Layout Restructure** — Change from static sidebar (240px fixed width, flex layout) to floating sidebar overlaying full-width content. Sidebar becomes position: fixed/absolute with GlassPanel wrapper. Main content becomes full-width with VisualizationCanvas (or hive canvas) filling entire viewport behind floating UI. Critical decision: Canvas must live in (app)/layout.tsx (persistent across routes) to avoid WebGL context loss on navigation.

2. **Dashboard Component Migration (22 components)** — Pure visual migration: replace hardcoded `bg-zinc-900`, `border-zinc-800`, `bg-[rgba(21,21,21,0.31)]` with design system tokens and components. Preserve all handlers, store connections, state flow unchanged. Key components: Sidebar (GlassPanel wrapper), ContentForm/SurveyForm (GlassInput, GlassTextarea, Button), 4 modals (Dialog from ui/), ResultsPanel (GlassCard sections), LoadingPhases (GlassProgress), top bar (GlassPill, Button).

3. **Hive Canvas Component (Canvas 2D approach)** — New component tree: HiveVisualization (orchestrator), useHiveLayout hook (d3-hierarchy radial tree layout), useHiveInteraction hook (quadtree hit-testing + hover/click state), HiveCanvas (Canvas 2D rendering: batched path operations for lines, node circles with glow), HiveNodeInfoCard (HTML overlay using GlassCard). Render strategy: 2 layered canvases (static connection lines on layer 1, animated nodes on layer 2), Float32Array for node positions, quadtree rebuilt on layout change only.

4. **State Management** — No new Zustand stores. Hive hover/selection is local component state (not persistent). Existing testStore and societyStore already flow to dashboard via props. Fix existing anti-pattern in dashboard-client.tsx (line 28: full-store destructuring causes unnecessary re-renders — convert to granular selectors before migration).

**Key integration points:**
- AppShell <-> Sidebar: z-index stacking (z-0: canvas, z-20: floating panels, z-30: sidebar, z-50: modals)
- DashboardClient <-> HiveVisualization: selectedSocietyId prop flows in, onNodeClick/onNodeHover callbacks flow out
- Canvas 2D <-> HTML overlays: compute screen position once on click (getBoundingClientRect), render GlassCard outside canvas
- Design system tokens: all migrated components use `@theme` tokens from globals.css, no hardcoded hex/rgb

**Critical architectural constraint:** Backdrop-filter blur over Canvas (both 2D and WebGL) may not work reliably across browsers. Must validate in proof-of-concept before committing to glassmorphic overlay design. Fallback: solid semi-transparent backgrounds (existing `glass-base` utility).

### Critical Pitfalls

1. **Backdrop-filter Over Canvas May Not Blur** — CSS backdrop-filter on HTML overlays does not reliably blur Canvas content behind them. The GPU-rendered canvas may not be treated as "paintable background" for the CSS compositor. This breaks the entire glassmorphic design (sidebar, floating panels) when positioned over the visualization. **Prevent:** Build proof-of-concept in first Wave 1 task: R3F Canvas (or Canvas 2D) + glassmorphic div overlay. Test in Chrome, Safari, Firefox before building full sidebar. Fallback: solid semi-transparent backgrounds or in-shader blur via postprocessing. **Phase: Wave 1 start — must validate immediately.**

2. **Stacking Context Hell with backdrop-filter + Portals** — Each backdrop-filter creates a new stacking context, breaking z-index coordination between sidebar, floating panels, and Radix Dialog portals. Modals appear behind sidebar, dropdowns clip under panels. The codebase already has z-index conflicts (sidebar z-50, mobile overlay z-40, modals z-50). **Prevent:** Use existing z-index scale exclusively (--z-sticky: 200, --z-modal: 400, --z-tooltip: 600). Portal all floating UI to document.body. Never nest glassmorphic elements. Test all overlays after each glass component. **Phase: Wave 1 throughout.**

3. **Canvas 2D Hit-Testing at 1000+ Nodes Without Quadtree** — Brute-force distance checking on every mousemove event = O(n) per frame = 1000 calculations per frame = 60K calculations/second at 60fps. This causes janky hover interactions and frame drops. **Prevent:** Use d3-quadtree for O(log n) spatial lookup (~10 comparisons per frame vs 1000). Rebuild quadtree only on layout change, not per frame. Throttle mousemove events to ~30/sec. **Phase: Wave 2 — hive interactivity.**

4. **WebGL Context Loss on Route Navigation** — Navigating dashboard -> settings -> dashboard repeatedly causes WebGL context loss after 10+ navigations. Browsers limit active WebGL contexts (10-20). Each Canvas mount creates new context; unmounting forces context loss. Safari is aggressive about limits. **Prevent:** Keep one persistent Canvas in (app)/layout.tsx, never unmount between routes. Use frameloop="demand" when visualization not visible. This decision affects AppShell structure and must be made at Wave 1 start. **Phase: Architecture decision before Wave 1.**

5. **Inconsistent Token Usage During Incremental Migration** — Migrating component-by-component creates a mix of design system tokens (bg-surface, text-foreground-muted) and hardcoded values (bg-zinc-900, text-zinc-400). The dashboard ends up 95% consistent with subtle visual differences (zinc-900 vs surface, zinc-400 vs foreground-secondary, zinc-800 borders vs rgba borders with transparency). **Prevent:** Migrate entire visual groups at once (card + all its children as unit). Create hardcoded-to-token mapping table before coding. "New system only" rule: any new code uses tokens. Screenshot before/after for regression checks. **Phase: Wave 1 throughout.**

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Structural Foundation (AppShell + Sidebar)
**Rationale:** The floating sidebar is the highest-visibility change and validates the glassmorphic overlay pattern that all other components depend on. Layout restructuring (static sidebar to floating sidebar, main content full-width) affects z-index stacking, Canvas sizing, and mobile nav — must be resolved first. This phase also addresses Pitfall 1 (backdrop-filter validation) and Pitfall 4 (persistent Canvas placement decision).

**Delivers:**
- Floating glassmorphic sidebar with GlassPanel wrapper
- AppShell restructured for full-width main + overlaid sidebar
- Proof-of-concept: backdrop-filter blur over Canvas (WebGL or Canvas 2D)
- Persistent Canvas architecture (in layout.tsx, survives navigation)
- Z-index scale applied to all layers
- Mobile nav adapted for floating sidebar

**Addresses (from FEATURES.md):** T1 (floating glass sidebar), T2 (sidebar nav items), T13 (mobile nav update)

**Avoids (from PITFALLS.md):** Pitfall 1 (backdrop-filter validation early), Pitfall 2 (z-index stacking planned), Pitfall 4 (persistent Canvas decision)

### Phase 2: Forms and Modals Migration
**Rationale:** Forms (ContentForm, SurveyForm) are the core user workflow for creating tests. Modals (TestTypeSelector, CreateSocietyModal, DeleteTestModal, LeaveFeedbackModal) are tightly coupled to forms. Migrating these as a batch validates the design system inputs (GlassInput, GlassTextarea, GlassSelect, GlassRadio) and Dialog component. All 4 modals must migrate together to avoid dual dialog systems (Pitfall 9).

**Delivers:**
- ContentForm rebuilt with GlassTextarea, Button, GlassPill
- SurveyForm rebuilt with GlassInput, GlassSelect, GlassRadio, Button
- TestTypeSelector modal using DS Dialog + GlassCard grid
- CreateSocietyModal, DeleteTestModal, LeaveFeedbackModal migrated to DS Dialog
- SocietySelector dropdown migrated
- All Radix Dialog imports replaced with DS Dialog

**Addresses:** T5 (ContentForm), T6 (SurveyForm), T7 (TestTypeSelector), T14 (other modals), T15 (SocietySelector)

**Avoids:** Pitfall 6 (preserve Zustand store contracts), Pitfall 9 (batch modal migration)

### Phase 3: Results Panels and Top Bar
**Rationale:** ResultsPanel, LoadingPhases, and top bar components (ContextBar, FilterPills, LegendPills, Create button) complete the end-to-end test flow. These are display-only components with straightforward design system mappings. Top bar components are quick wins with high visibility. This phase completes the Wave 1 design system migration.

**Delivers:**
- ResultsPanel with GlassCard wrapper, design tokens
- ImpactScore, AttentionBreakdown, VariantsSection, InsightsSection, ThemesSection rebuilt
- LoadingPhases with GlassProgress + Spinner
- Top bar: ContextBar (typography tokens), FilterPills (GlassPill), LegendPills (GlassPill), Create button (Button)
- ViewSelector dropdown migrated
- Consistent focus rings and reduced motion support verified

**Addresses:** T3 (ContextBar), T4 (FilterPills), T8 (LoadingPhases), T9 (ResultsPanel), T10 (results subsections), T11 (LegendPills), T12 (Create button), T16 (focus rings), T17 (reduced motion)

**Avoids:** Pitfall 5 (complete token migration for entire visual group), Pitfall 8 (limit glassmorphic elements on mobile)

### Phase 4: Hive Foundation (Layout + Rendering)
**Rationale:** Wave 2 begins. Build the core hive structure (center thumbnail, tier 1 main nodes, radial layout algorithm) to validate the Canvas 2D + d3-hierarchy approach. This phase establishes the rendering foundation and performance characteristics before adding interaction complexity.

**Delivers:**
- HiveVisualization component (orchestrator)
- useHiveLayout hook (d3-hierarchy radial tree layout)
- Center rounded rectangle with content thumbnail
- Tier 1 main nodes (10-15 nodes, radial distribution)
- Tier 2 sub-nodes (80-120 nodes)
- Tier 3 leaf nodes (800-1200 nodes)
- Connection lines between tiers (batched path rendering)
- Layered canvas rendering (static lines layer, animated nodes layer)
- Responsive sizing, retina/HiDPI support

**Addresses:** T18 (center rectangle), T19 (tier 1), T20 (tier 2), T21 (tier 3), T22 (connection lines), T26 (responsive), T27 (retina), T28 (reduced motion fallback)

**Avoids:** Pitfall 3 (quadtree for hit-testing — built in Phase 5), Pitfall 7 (separate rendering per tier, not single InstancedMesh)

### Phase 5: Hive Interactions (Click + Hover)
**Rationale:** With the rendering foundation stable, add interactivity. This phase implements quadtree-based hit-testing, hover highlighting, click selection, and HTML overlay info cards. The quadtree (Pitfall 3) is the critical path for performant interaction at 1000+ nodes.

**Delivers:**
- useHiveInteraction hook (quadtree hit-testing + state management)
- d3-quadtree spatial index for O(log n) node lookup
- Hover interaction: highlight connected nodes, dim others, update cursor
- Click interaction: glow + scale effect on node, show info card
- HiveNodeInfoCard component (GlassCard overlay, positioned via screen coordinates)
- Smooth zoom/pan controls (manual transform for Canvas 2D)
- Debounced hover to prevent flickering in dense clusters

**Addresses:** T23 (click + info card), T24 (hover highlight), T25 (zoom/pan)

**Avoids:** Pitfall 3 (quadtree for O(log n) hit-testing), Pitfall 12 (debounce hover, ref-based color updates)

### Phase 6: Polish and Differentiators (Optional)
**Rationale:** Core functionality complete. This phase adds visual polish features that enhance the experience but are not essential for launch. Can be deferred if timeline is tight.

**Delivers:**
- Ambient glow behind sidebar (GradientGlow)
- Node entry animation (stagger reveal from center outward)
- Pulsing glow on selected node (coral breathing animation)
- Connection line glow on hover path
- Tier-based color coding (coral/purple/blue/cyan from brand palette)

**Addresses:** D1 (ambient glow), D2 (entry animation), D4 (pulsing glow), D5 (line glow), D9 (tier colors)

**Deferred to post-MVP:** D6 (transition between states — high complexity), D7 (sidebar collapse animation), D10 (mouse proximity reactive)

### Phase Ordering Rationale

- **Sidebar first (Phase 1):** Most visible change, validates glassmorphic overlay pattern for all other components, resolves Canvas placement architecture decision
- **Forms before results (Phase 2 before Phase 3):** Test creation flow is higher priority than results display, forms exercise more design system components (inputs, selects, radios)
- **Complete Wave 1 before Wave 2:** Design system migration must be stable before adding hive visualization complexity
- **Hive foundation before interactions (Phase 4 before Phase 5):** Validate rendering performance at 1000+ nodes before adding hit-testing overhead
- **Polish last (Phase 6):** Differentiators are optional, can be cut if needed

**Dependency insights:**
- Phase 1 blocks everything (layout structure affects all components)
- Phases 2-3 are independent of Phases 4-6 (Wave 1 and Wave 2 are parallel concerns)
- Phase 5 requires Phase 4 (interactions require rendering foundation)
- Phase 6 requires Phases 4-5 (polish builds on stable core)

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 1:** Backdrop-filter over Canvas (WebGL and Canvas 2D) — browser compatibility research, proof-of-concept testing, fallback strategy if blur fails
- **Phase 5:** Quadtree hit-testing performance at 1000+ nodes — benchmark d3-quadtree rebuild cost, test throttling strategies, validate debounce timing

**Phases with standard patterns (skip research-phase):**
- **Phase 2:** Form component migration — direct component swap, no novel patterns
- **Phase 3:** Results panel migration — display-only components, straightforward mapping
- **Phase 4:** Radial layout algorithm — d3-hierarchy is well-documented, established pattern
- **Phase 6:** Visual polish — Framer Motion stagger patterns already exist in codebase

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | Canvas 2D + d3-hierarchy is well-established pattern for 1000-node hierarchical layouts. All recommended packages are stable LTS versions (d3-hierarchy v3.1.2 unchanged for 4 years, d3-quadtree v3.0.1 stable). Existing stack (React, Next.js, Tailwind, R3F) requires no changes. Bundle impact minimal (~17KB). |
| Features | **HIGH** | Feature landscape derived from direct codebase analysis (all 30 dashboard components read, all design system primitives cataloged, existing patterns identified). Table stakes vs differentiators clearly delineated. Anti-features documented from ecosystem pitfalls. Migration map 1:1 complete. |
| Architecture | **HIGH** | Architecture recommendations based on existing Virtuna codebase analysis (VisualizationCanvas, VisualizationContext, GlassPanel, AppShell all read). Component modification map complete for all 22 Wave 1 components. R3F patterns align with existing GlassOrb implementation. New component tree for hive follows existing visualization patterns. |
| Pitfalls | **HIGH** | Critical pitfalls documented in R3F GitHub issues (#3289 InstancedMesh raycasting, #3093 context loss, #514 unmount leak). Backdrop-filter stacking context behavior well-documented in CSS specs. Canvas 2D quadtree optimization is standard practice. Mobile backdrop-filter performance already addressed in globals.css. |

**Overall confidence:** **HIGH**

### Gaps to Address

**Gap 1: Backdrop-filter blur over Canvas reliability**
- **Issue:** CSS backdrop-filter behavior over Canvas (both WebGL and Canvas 2D) is not guaranteed cross-browser. Some reports indicate it works in recent Chrome builds, but Safari and Firefox behavior varies.
- **Resolution:** Build proof-of-concept in Phase 1, Task 1. Test minimal setup (Canvas with colored mesh + glassmorphic div overlay) in Chrome, Safari, Firefox on both desktop and mobile. If blur fails, fall back to solid semi-transparent backgrounds (existing `glass-base` utility) or implement in-shader blur via postprocessing. This is a go/no-go decision before proceeding with full sidebar implementation.

**Gap 2: Canvas 2D vs R3F rendering decision**
- **Issue:** Stack researcher recommends Canvas 2D, Architecture researcher proposes R3F. Both are viable but have different complexity/integration implications.
- **Resolution:** **Go with Canvas 2D + d3-hierarchy** for the following reasons: (1) simpler hit-testing (quadtree vs InstancedMesh raycasting bugs), (2) no 3D transformation needed (radial layout is 2D), (3) separates concerns (R3F for 3D effects, Canvas 2D for data viz), (4) existing network-visualization.tsx validates the pattern at 200 nodes. If performance issues arise at 1000+ nodes during Phase 4, can pivot to R3F InstancedMesh (rendering foundation phase is designed to be swappable).

**Gap 3: Mobile node count optimization**
- **Issue:** 1000+ nodes may exceed mobile GPU/CPU budget even with Canvas 2D optimization. Threshold for acceptable mobile performance unknown until tested.
- **Resolution:** During Phase 4 (rendering foundation), test on actual mid-range Android and iPhone SE devices. If frame rate drops below 30fps, reduce node counts on mobile: 5 main, 30 sub, 200 leaf (Architecture researcher's suggestion). Use VisualizationContext.isMobile to conditionally adjust node generation.

**Gap 4: Hardcoded-to-token mapping completeness**
- **Issue:** The research identifies major color/style patterns to migrate, but a complete mapping table for all 30 components does not exist yet.
- **Resolution:** Create comprehensive mapping table in Phase 1 planning (before coding). Audit every hardcoded color, border, spacing value in all 22 components scheduled for migration. Document exact design system token replacement for each. This prevents inconsistency (Pitfall 5) and speeds migration.

## Sources

### Primary (HIGH confidence)
- **Virtuna Codebase** — 30+ glass/gradient primitives, 23 design system components, 25+ dashboard components, R3F infrastructure (VisualizationCanvas, VisualizationContext, GlassOrb), existing network-visualization.tsx pattern, BRAND-BIBLE.md tokens
- **d3-hierarchy v3.1.2** — Official D3 docs, GitHub source, radial tree layout API
- **d3-quadtree v3.0.1** — Official D3 docs, spatial indexing API
- **R3F GitHub Issues** — #3289 (InstancedMesh onClick bug), #3093 (context loss on unmount), #514 (original context leak report), #2457 (Safari WebGL limits)
- **R3F Official Docs** — Scaling performance guide, events and interaction patterns
- **Drei Official Docs** — Instances component, declarative instancing API
- **Three.js Official Docs** — Vector3.project() for screen-space conversion, InstancedMesh API
- **MDN** — Canvas API optimization, backdrop-filter behavior, stacking contexts

### Secondary (MEDIUM confidence)
- **Canvas vs WebGL Performance Benchmarks (2025)** — Multiple sources confirm Canvas 2D handles 1000s of nodes, WebGL needed at 10K+
- **D3 Network Graph Tutorials** — Canvas rendering optimization patterns, quadtree hit-testing
- **Glassmorphism Implementation Guides (2025-2026)** — Performance budgets (limit 2-3 blur layers), mobile optimization strategies
- **Three.js Instances Tutorials (Codrops)** — Instancing patterns, BVH spatial indexing
- **Stacking Context Behavior Articles** — backdrop-filter + positioned elements, filter/transform stacking triggers

### Tertiary (LOW confidence)
- **Radial Tree Visualization Techniques (FasterCapital)** — General patterns, aggregator content
- **Dark Glassmorphism UI Trends (Medium)** — Mobile performance constraints, aesthetic guidance

---
*Research completed: 2026-02-05*
*Ready for roadmap: yes*
*Canvas approach: Canvas 2D + d3-hierarchy (RECOMMENDED)*
