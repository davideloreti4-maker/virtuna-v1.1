# Feature Landscape: Dashboard Rebuild + Hive Node Visualization

**Domain:** Glassmorphic dashboard UI rebuild + hierarchical node visualization
**Researched:** 2026-02-05
**Confidence:** HIGH (existing codebase analyzed, patterns well-established in ecosystem)

---

## Table Stakes

Features users expect. Missing = product feels incomplete or visually broken.

### Wave 1: Dashboard Rebuild (Design System Migration)

| # | Feature | Why Expected | Complexity | DS Components Available | Notes |
|---|---------|--------------|------------|------------------------|-------|
| T1 | Floating glassmorphic sidebar | Core navigation; current sidebar uses hardcoded `bg-[rgba(21,21,21,0.31)] backdrop-blur-[14px]` instead of GlassPanel | Medium | GlassPanel (blur, tint, borderGlow), GlassPill | Replace `<aside>` inline styles with `<GlassPanel as="aside" blur="xl" opacity={0.6} borderGlow>`. Sidebar currently 240px fixed, keep that width. |
| T2 | Sidebar nav items using DS components | Current SidebarNavItem uses raw Tailwind (`hover:bg-white/5`); should use Button ghost variant or consistent DS patterns | Low | Button (ghost/subtle variants), Icon | Map existing nav items to `<Button variant="ghost" size="sm">` with icon slot |
| T3 | Context bar using GlassPill | Current ContextBar uses hardcoded `border-zinc-800 bg-zinc-900/90 px-3 py-1.5` | Low | GlassPill, Badge | Replace with `<GlassPill>` or `<Badge variant="glass">` -- near 1:1 match |
| T4 | Filter pills using DS Badge/Pill | FilterPill uses hardcoded `border-zinc-600 bg-zinc-800/50` | Low | GlassPill, Badge | Color dot + label maps to GlassPill with custom leading element |
| T5 | ContentForm using GlassPanel + DS inputs | Form container uses `border-zinc-800 bg-zinc-900 p-4`, textarea uses raw styles | Medium | GlassPanel, Input/InputField, Button | Wrap form in GlassPanel, swap textarea for InputField variant, swap submit for `<Button variant="accent">` |
| T6 | SurveyForm using DS inputs + selects | Parallel to ContentForm -- raw inputs need DS replacement | Medium | GlassPanel, Input, Select, Button | Same migration pattern as ContentForm |
| T7 | TestTypeSelector modal using DS Dialog | Currently uses raw Radix Dialog with hardcoded `bg-[rgba(6,6,6,0.667)] backdrop-blur-[8px]` | Medium | Dialog (DialogContent, DialogOverlay), Button | Replace raw Dialog with DS Dialog component. Menu items use Button ghost variant. |
| T8 | LoadingPhases using DS Progress + typography | Uses hardcoded `bg-zinc-900`, `bg-emerald-500`, raw text classes | Low | GlassPanel, Spinner, Text, GlassProgress | Wrap in GlassPanel, use GlassProgress for bar, use Spinner for active phase indicator |
| T9 | ResultsPanel using DS Card + typography | Uses `bg-zinc-900`, `border-zinc-800`, `bg-orange-500` hardcoded | Medium | GlassPanel/GlassCard, Button (accent), Heading, Text, Divider | Header/footer sticky sections become GlassPanel, sections use Heading/Text, CTA uses `<Button variant="accent">` |
| T10 | ImpactScore / AttentionBreakdown rebuilt | Nested result sections with hardcoded styles | Low | Text, Heading, GlassProgress, Badge | These are display-only sections; straightforward token swap |
| T11 | LegendPills using DS Badge | Current uses raw colored dots with text | Low | Badge, GlassPill | Near-direct mapping |
| T12 | Create button using DS Button | Current hardcoded `bg-white text-zinc-900 hover:bg-zinc-200` | Low | Button (variant="default" or "accent") | Direct swap |
| T13 | Mobile nav updated for floating sidebar | MobileNav hamburger + sidebar drawer needs to work with glass sidebar | Low | Existing mobile patterns | Overlay stays, sidebar gains glass treatment |
| T14 | All modals rebuilt (CreateSociety, DeleteTest, LeaveFeedback) | 3 modals use raw Radix Dialog with hardcoded styles | Medium | Dialog, Input, Button, GlassPanel | Batch migration -- same pattern per modal |
| T15 | SocietySelector + ViewSelector dropdowns rebuilt | Currently use hardcoded dropdown styles | Low-Med | Select (custom), Button | Map to DS Select component |
| T16 | Consistent focus rings and keyboard nav | Current hardcoded `focus-visible:ring-2 focus-visible:ring-emerald-500` should use accent | Low | Built into all DS components | DS components already have `ring-accent/50` focus rings |
| T17 | Prefers-reduced-motion respect | Dashboard animations should respect OS setting | Low | VisualizationContext already provides `reducedMotion` | Extend to dashboard transitions via Framer Motion's `useReducedMotion()` |

### Wave 2: Hive Node Visualization (Core Requirements)

| # | Feature | Why Expected | Complexity | DS Components Available | Notes |
|---|---------|--------------|------------|------------------------|-------|
| T18 | Center rounded rectangle (video thumbnail) | Visual anchor for the entire hive; this is what the network radiates from | Low | N/A -- Canvas/WebGL rendered | Static rounded rect with image or placeholder, positioned at center of visualization |
| T19 | First-tier nodes (10-15 main nodes) | Primary radial ring around center -- "persona" or "topic" nodes | Medium | N/A -- Canvas rendered | Radial placement using angle division (2*PI / count). Nodes are colored circles with labels. |
| T20 | Second-tier nodes (100+ sub-nodes) | Each main node spawns ~10 sub-nodes in a secondary radial ring | Medium | N/A -- Canvas rendered | Smaller circles, lighter opacity. Connection lines to parent nodes. |
| T21 | Third-tier leaf nodes (1000+) | Decorative outermost layer, giving the "hive" density impression | High | N/A -- Canvas rendered | Smallest circles, very low opacity. Must maintain 60fps. This is the performance-critical tier. |
| T22 | Connection lines between tiers | Visual hierarchy showing parent-child relationships | Medium | N/A -- Canvas rendered | Lines with distance-based opacity (closer = more opaque). Use brand colors from palette. |
| T23 | Click interaction: glow + scale + info card | Click a node -> it glows/scales, info card appears | High | GlassCard, GlassPill, Text, Badge (for info card overlay) | Two parts: (1) Canvas glow/scale effect on clicked node, (2) HTML overlay info card positioned near node |
| T24 | Hover interaction: highlight connected nodes | Hover a node -> it and its connected nodes brighten, others dim | Medium | N/A -- Canvas logic | Requires: hit detection (quadtree), connection graph traversal, opacity modulation per frame |
| T25 | Smooth zoom/pan | User can zoom into regions and pan around the hive | Low | Existing VisualizationCanvas has OrbitControls | If Canvas 2D: implement manual zoom/pan transform. If WebGL/R3F: leverage existing OrbitControls. |
| T26 | Responsive sizing | Hive fills available space, adapts to container size | Low | ResizeObserver pattern (exists in NetworkVisualization) | Use ResizeObserver like the existing NetworkVisualization component |
| T27 | Retina/HiDPI rendering | Crisp on retina displays | Low | DPR handling exists in NetworkVisualization and VisualizationCanvas | `window.devicePixelRatio` scaling on Canvas, or `dpr={[1,2]}` on R3F Canvas |
| T28 | Reduced motion fallback | Static layout when prefers-reduced-motion is set | Low | VisualizationContext.reducedMotion | Show final layout without animation transitions |

---

## Differentiators

Features that set the product apart visually. Not expected, but create "wow" factor.

| # | Feature | Value Proposition | Complexity | Notes |
|---|---------|-------------------|------------|-------|
| D1 | Ambient glow behind sidebar | GradientGlow behind the sidebar creates a floating-in-space effect that elevates the entire dashboard | Low | Use `<GradientGlow color="orange" intensity="subtle" position="center" blur={60}>` behind sidebar. Matches brand coral. |
| D2 | Node entry animation (stagger reveal) | Nodes appear one-by-one or ring-by-ring when dashboard loads, creating a "network coming alive" moment | Medium | Stagger from center outward: center rect -> tier 1 -> tier 2 -> tier 3. Use easeOutExpo timing. Already have Framer Motion stagger patterns. |
| D3 | Glassmorphic info card on node click | Instead of a plain tooltip, show a GlassCard with blur and glow near the clicked node | Medium | Position HTML `<GlassCard glow tinted hover="none">` at Canvas coordinates converted to screen space. Animate with Framer Motion `<AnimatePresence>`. |
| D4 | Pulsing glow on active/selected node | Selected node has a subtle breathing glow animation (coral/orange) | Low | Canvas glow via `shadowBlur` oscillation on `requestAnimationFrame`. Use coral (#FF7F50) for brand consistency. |
| D5 | Connection line glow on hover path | When hovering a node, the connection lines to its parent/children glow with the node's color | Low-Med | Draw connection lines with increased `lineWidth` and `shadowBlur` for highlighted connections. |
| D6 | Smooth transition between idle and results states | When simulation completes, hive morphs/reorganizes to reflect results | High | Requires node position interpolation. Very impressive but significant complexity. Defer to post-MVP unless time allows. |
| D7 | Sidebar collapse animation | Sidebar collapses to icon-only mode with smooth width transition | Medium | Already has collapse button stub. Animate width with Framer Motion `layout` or CSS transition. Store collapsed state in Zustand. |
| D8 | Floating form panels with glass depth | ContentForm and ResultsPanel floating above the hive with visible glass depth against the node background | Low | Already positioned as `absolute bottom-6` overlays. Adding GlassPanel + GradientGlow creates the depth. The hive behind the glass is what makes glassmorphism work. |
| D9 | Tier-based color coding | Each tier of nodes has a distinct color from the brand palette (coral, purple, blue, cyan) creating visual depth rings | Low | Use the existing `colorMap` from GradientGlow for consistency: orange for tier 1, purple for tier 2, blue/cyan for tier 3. |
| D10 | Mouse proximity reactive nodes | Nodes slightly grow or brighten as mouse approaches (before actual hover) | Low-Med | Requires distance calculation from mouse to all visible nodes (use quadtree). Subtle size/opacity interpolation based on distance. |

---

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| # | Anti-Feature | Why Avoid | What to Do Instead |
|---|--------------|-----------|-------------------|
| A1 | SVG-based node rendering for 1000+ nodes | SVG DOM elements are expensive at scale. 1000+ `<circle>` elements will cause layout thrashing, sluggish hover, and memory bloat. | Use Canvas 2D or WebGL for all node rendering. Only use HTML/React for overlay elements (info cards, tooltips). |
| A2 | Force-directed physics layout | d3-force is popular but wrong here: the hive has a fixed hierarchical structure (center -> tier1 -> tier2 -> tier3), not a dynamic network. Force simulation adds unnecessary complexity, CPU cost, and non-deterministic layout. | Use deterministic radial layout: calculate positions mathematically from parent angle + tier radius. Positions are computed once, not simulated. |
| A3 | React state for individual node positions | Putting 1000+ node positions in React state causes re-render cascade on every animation frame, destroying performance. | Keep node data in a plain JavaScript array (or TypedArray) outside React. Use `useRef` for the array. Canvas reads it directly. React only manages high-level state (selected node, hover state). |
| A4 | Heavy blur on all dashboard panels simultaneously | Multiple `backdrop-filter: blur()` panels visible at once causes GPU compositing layer explosion. GlassPanel docs already warn: "Limit to 2-3 GlassPanel elements with blur visible per viewport." | Apply full blur to sidebar + one floating panel. Other panels use `blur="xs"` or `blur="none"` with opacity-only glass effect. Prioritize blur on the element closest to the hive visualization. |
| A5 | Rebuilding all components at once (big bang migration) | Swapping all 30+ dashboard components simultaneously creates massive regression risk. A single broken component blocks the entire dashboard. | Migrate incrementally: sidebar first (most visible), then forms, then modals, then results. Each component migration is independently testable and deployable. |
| A6 | Custom tooltip library for node info | Adding a tooltip library (Tippy, Floating UI) just for node info cards adds bundle weight and creates another abstraction layer. | Use absolute-positioned GlassCard with manual coordinate calculation. Canvas `getBoundingClientRect()` + node position gives screen coordinates. Framer Motion handles enter/exit. |
| A7 | 3D depth/rotation on the hive | Tempting to use R3F/Three.js for 3D node rotation, but it adds massive complexity for minimal visual gain on a 2D hierarchical structure. The existing VisualizationCanvas uses R3F for the orb, but the hive is fundamentally 2D. | Keep the hive on a 2D Canvas. The existing R3F infrastructure is for the orb visualization (separate concern). The hive should be a separate Canvas 2D component. |
| A8 | Real-time data updates on the hive during simulation | Animating nodes moving/appearing as simulation "processes" sounds cool but couples visualization tightly to simulation state machine. | Keep hive static/decorative during simulation. LoadingPhases already provides progress feedback. Hive can react to final results (post-simulation), not intermediate states. |
| A9 | Per-node accessibility labels | Screen-reading 1000+ decorative nodes is noise, not accessibility. Canvas is inherently inaccessible for individual elements. | Mark the entire canvas as `aria-hidden="true"` (already done in NetworkVisualization). Provide an `sr-only` text summary: "Network visualization showing X personas across Y topics." Info cards (HTML overlays) ARE accessible. |
| A10 | Migrating to a graph visualization library (Sigma, Reagraph, Cytoscape) | These libraries are designed for dynamic, exploratory graph analysis. Our hive is a fixed decorative visualization with known structure. Library overhead (~50-200KB) buys features we don't need. | Custom Canvas 2D rendering. Our requirements (radial layout, hover, click, glow) are simpler than what graph libraries solve. Total custom code will be ~300-500 lines. |

---

## Feature Dependencies

```
DEPENDENCY GRAPH (build order flows top to bottom)

Design System Components (already built)
    |
    v
T1: Floating Glass Sidebar (GlassPanel as="aside")
    |--- T2: Sidebar Nav Items (Button ghost)
    |--- T7: Sidebar collapse (D7 differentiator)
    |--- T13: Mobile nav updated
    |--- T15: SocietySelector + ViewSelector (Select)
    |
    v
T3: Context Bar (GlassPill) ----+
T4: Filter Pills (Badge/Pill) --+-- T12: Create Button (Button)
T11: Legend Pills (Badge) ------+
    |                           |
    (top bar complete)          |
    |                           |
    v                           v
T5: ContentForm (GlassPanel + Input + Button)
T6: SurveyForm (parallel to T5)
T7: TestTypeSelector Modal (Dialog)
    |
    v
T8: LoadingPhases (GlassProgress + Spinner)
    |
    v
T9: ResultsPanel (GlassCard + Button + Typography)
T10: ImpactScore / AttentionBreakdown (subsections of T9)
    |
    v
T14: Other Modals (CreateSociety, DeleteTest, LeaveFeedback)
T16: Consistent focus rings (built into DS)
T17: Reduced motion (extend existing)

---PARALLEL TRACK---

T18: Center rectangle (independent)
    |
    v
T19: Tier 1 nodes (radial layout math)
    |
    v
T20: Tier 2 nodes (extends T19 layout)
    |
    v
T21: Tier 3 leaf nodes (performance-critical)
T22: Connection lines (parallel to T20/T21)
    |
    v
T24: Hover highlight (requires quadtree hit detection)
    |
    v
T23: Click glow + info card (requires T24 hit detection + DS GlassCard overlay)
T25: Zoom/pan (independent)
T26: Responsive sizing (independent)
T27: Retina rendering (independent)
T28: Reduced motion fallback (independent)
```

### Key Dependency Insights

1. **Sidebar is the gateway.** T1 (glass sidebar) should be first because it is the most visible element and validates the migration pattern for all other components.

2. **Top bar components are independent.** T3, T4, T11, T12 can be migrated in any order after the sidebar.

3. **Forms depend on nothing except DS components.** T5/T6 can start as soon as DS primitives are confirmed working.

4. **Hive visualization is fully parallel to dashboard rebuild.** No dependency between Wave 1 and Wave 2 -- they share no components except the containing layout.

5. **Hit detection (quadtree) is the critical path for hive interactivity.** T24 (hover) must be built before T23 (click + info card) because click requires the same spatial lookup.

---

## Existing Component Migration Map

Mapping every dashboard component that needs migration, with the specific DS replacement.

| Current Component | File | Hardcoded Patterns | DS Replacement | Migration Effort |
|-------------------|------|-------------------|----------------|-----------------|
| Sidebar | `app/sidebar.tsx` | `bg-[rgba(21,21,21,0.31)] backdrop-blur-[14px] border-[rgb(40,40,40)]` | `GlassPanel blur="xl" borderGlow as="aside"` | Medium |
| SidebarNavItem | `app/sidebar-nav-item.tsx` | `hover:bg-white/5`, raw Tailwind | `Button variant="ghost" size="sm"` with icon | Low |
| ContextBar | `app/context-bar.tsx` | `border-zinc-800 bg-zinc-900/90 rounded-full` | `GlassPill` or `Badge variant="glass"` | Low |
| FilterPill | `app/filter-pills.tsx` | `border-zinc-600 bg-zinc-800/50` | `GlassPill` with color prop | Low |
| ContentForm | `app/content-form.tsx` | `border-zinc-800 bg-zinc-900`, `bg-orange-500` | `GlassPanel` wrapper, `InputField`, `Button variant="accent"` | Medium |
| SurveyForm | `app/survey-form.tsx` | Same pattern as ContentForm | Same DS components | Medium |
| TestTypeSelector | `app/test-type-selector.tsx` | `bg-[rgba(6,6,6,0.667)] backdrop-blur-[8px]` | `Dialog` + `DialogContent`, `Button variant="ghost"` | Medium |
| LoadingPhases | `app/simulation/loading-phases.tsx` | `bg-zinc-900`, `bg-emerald-500` | `GlassPanel`, `GlassProgress`, `Spinner` | Low |
| ResultsPanel | `app/simulation/results-panel.tsx` | `bg-zinc-900 border-zinc-800`, `bg-orange-500` | `GlassPanel`, `Button variant="accent"`, `Heading`, `Text` | Medium |
| ImpactScore | `app/simulation/impact-score.tsx` | Raw Tailwind typography | `Heading`, `Text`, `Badge` | Low |
| AttentionBreakdown | `app/simulation/attention-breakdown.tsx` | Raw Tailwind | `Text`, `GlassProgress` | Low |
| VariantsSection | `app/simulation/variants-section.tsx` | Raw Tailwind | `Text`, `Card`, `Badge` | Low |
| InsightsSection | `app/simulation/insights-section.tsx` | Raw Tailwind | `Text`, `GlassCard` | Low |
| ThemesSection | `app/simulation/themes-section.tsx` | Raw Tailwind | `Text`, `Badge` | Low |
| ShareButton | `app/simulation/share-button.tsx` | Raw Tailwind | `Button variant="ghost"` | Low |
| LegendPills | `app/legend-pills.tsx` | Raw colored dots | `Badge` or `GlassPill` | Low |
| CreateSocietyModal | `app/create-society-modal.tsx` | Raw Radix Dialog | `Dialog`, `Input`, `Button` | Medium |
| DeleteTestModal | `app/delete-test-modal.tsx` | Raw Radix Dialog | `Dialog`, `Button variant="destructive"` | Low |
| LeaveFeedbackModal | `app/leave-feedback-modal.tsx` | Raw Radix Dialog | `Dialog`, `InputField`, `Button` | Medium |
| SocietySelector | (in sidebar) | Custom dropdown | `Select` component | Low-Med |
| ViewSelector | `app/view-selector.tsx` | Custom dropdown | `Select` component | Low-Med |
| TestHistoryList | `app/test-history-list.tsx` | Raw list items | `Text`, existing list pattern | Low |
| TestHistoryItem | `app/test-history-item.tsx` | Raw Tailwind | `Text`, `Caption`, `Badge` | Low |
| CardActionMenu | `app/card-action-menu.tsx` | Raw dropdown | `Button variant="ghost"` | Low |
| MobileNav | `app/mobile-nav.tsx` | Raw Tailwind | `Button`, `Icon` | Low |

**Total: ~25 components to migrate**
- Low effort: 16 components
- Medium effort: 9 components
- Estimated total: 3-4 focused sessions

---

## MVP Recommendation

### Phase 1: Dashboard Foundation (Wave 1 Priority)

Build first, in this order:

1. **T1: Floating glass sidebar** -- Most visible change, validates the migration pattern, highest visual impact
2. **T5 + T7: ContentForm + TestTypeSelector** -- Core user workflow (creating tests), exercises GlassPanel + Dialog + Input + Button
3. **T3 + T4 + T12: Top bar components** -- Quick wins, high visibility, all Low complexity
4. **T9: ResultsPanel** -- Completes the test flow end-to-end with DS components
5. **T8: LoadingPhases** -- Bridges create and results
6. **T14: Remaining modals** -- Batch migration, same pattern

### Phase 2: Hive Visualization (Wave 2)

Build in this order:

1. **T18 + T19: Center rect + Tier 1 nodes** -- Core structure, validates radial layout math
2. **T20 + T21 + T22: Tier 2, Tier 3, connection lines** -- Fill out the hive, performance validation
3. **T24: Hover highlight** -- Requires quadtree, unlocks interactivity
4. **T23: Click + info card** -- Builds on hover hit detection, adds GlassCard overlay

### Defer to Post-MVP

- **D6: Smooth transition between idle and results** -- Very high complexity, low user value for initial release
- **D7: Sidebar collapse animation** -- Nice but non-essential; collapse button already exists as stub
- **D10: Mouse proximity reactive nodes** -- Polish feature, add after core interactions work

---

## Complexity Budget

| Area | Estimated Effort | Risk Level |
|------|-----------------|------------|
| Sidebar migration (T1-T2) | 1 session | Low -- direct component swap |
| Top bar migration (T3-T4, T11-T12) | 0.5 session | Low -- simple replacements |
| Form migrations (T5-T7) | 1.5 sessions | Medium -- form state must be preserved |
| Results migration (T8-T10) | 1 session | Low -- display-only components |
| Modal migrations (T14) | 1 session | Medium -- 3 modals with varied content |
| Hive layout engine (T18-T22) | 2 sessions | Medium -- radial math, Canvas rendering |
| Hive interactivity (T23-T24) | 2 sessions | High -- quadtree, hit detection, HTML overlay positioning |
| Polish + edge cases (T25-T28) | 0.5 session | Low -- leveraging existing patterns |
| **Total** | **~9.5 sessions** | |

---

## Sources

### Dashboard / Glassmorphism Patterns
- [Glassmorphism UI Design Trend 2026](https://www.designstudiouiux.com/blog/what-is-glassmorphism-ui-trend/) -- MEDIUM confidence, general patterns
- [Glassmorphism Best Practices](https://uxpilot.ai/blogs/glassmorphism-ui) -- MEDIUM confidence, 12 UI features
- [NN/G Glassmorphism Definition](https://www.nngroup.com/articles/glassmorphism/) -- HIGH confidence, authoritative UX source
- [Glassmorphism Meets Accessibility](https://axesslab.com/glassmorphism-meets-accessibility-can-frosted-glass-be-inclusive/) -- HIGH confidence, accessibility-focused
- [Glassmorphism and Accessibility](https://www.newtarget.com/web-insights-blog/glassmorphism/) -- MEDIUM confidence, WCAG considerations
- [Motion React Hover Animations](https://motion.dev/docs/react-hover-animation) -- HIGH confidence, official docs

### Node Visualization Patterns
- [Canvas vs WebGL Performance 2025](https://digitaladblog.com/2025/05/21/comparing-canvas-vs-webgl-for-javascript-chart-performance/) -- MEDIUM confidence, benchmark data
- [SVG vs Canvas vs WebGL 2025](https://www.svggenie.com/blog/svg-vs-canvas-vs-webgl-performance-2025) -- MEDIUM confidence, comparison analysis
- [Force-graph (Canvas renderer)](https://github.com/vasturiano/force-graph) -- HIGH confidence, GitHub source
- [D3 Quadtree](https://d3js.org/d3-quadtree) -- HIGH confidence, official D3 docs
- [Canvas Rendering Optimization](https://blog.ag-grid.com/optimising-html5-canvas-rendering-best-practices-and-techniques/) -- MEDIUM confidence, ag-Grid blog
- [D3 Canvas Network Graphs](https://www.antstack.com/blog/leveling-up-your-d3-network-graphs-from-simple-canvas-to-interactive-powerhouse/) -- MEDIUM confidence, tutorial

### Interaction Patterns
- [Graph Visualization UX](https://cambridge-intelligence.com/graph-visualization-ux-how-to-avoid-wrecking-your-graph-visualization/) -- HIGH confidence, domain specialist
- [NN/G Cards Component](https://www.nngroup.com/articles/cards-component/) -- HIGH confidence, authoritative UX
- [Radial Tree Visualization Techniques](https://fastercapital.com/content/Visualization-Techniques--Radial-Tree---Circling-the-Data--The-Radial-Tree-Approach.html) -- LOW confidence, aggregator content
- [Quadtree JS Implementations](https://github.com/timohausmann/quadtree-js) -- HIGH confidence, open source reference

### Existing Codebase (PRIMARY SOURCE)
- `/src/components/primitives/` -- 30 glass/gradient primitives (GlassPanel, GlassCard, GradientGlow, etc.)
- `/src/components/ui/` -- 23 design system components (Button, Input, Dialog, Select, Badge, etc.)
- `/src/components/app/` -- 25+ dashboard components with hardcoded styles (migration targets)
- `/src/components/visualization/` -- R3F Canvas wrapper, context, shaders (existing WebGL infrastructure)
- `BRAND-BIBLE.md` -- Complete design token reference, color system, spacing
