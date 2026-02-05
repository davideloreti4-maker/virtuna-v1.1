# Architecture Patterns: Dashboard Rebuild + Hive Visualization

**Domain:** Dashboard UI migration + WebGL node visualization
**Researched:** 2026-02-05
**Confidence:** HIGH (based on direct codebase analysis, not external sources)

## Executive Summary

The v2.1 rebuild integrates two parallel workstreams into an existing Next.js App Router architecture: (1) migrating ~30 dashboard app components from hardcoded styles to the 36-component design system, and (2) building a hive node visualization within the existing React Three Fiber canvas infrastructure. The architecture is well-suited for both -- the design system primitives already cover every UI pattern used in the dashboard, and the R3F canvas + VisualizationContext already handle WebGL lifecycle, mobile detection, and reduced motion.

## Current Architecture Map

### Component Tree (Simplified)

```
(app)/layout.tsx (Server Component)
  |-- AppShell (Client)
  |     |-- AuthGuard
  |     |-- MobileNav
  |     |-- Sidebar (240px fixed, left)
  |     |     |-- SocietySelector (Radix Dialog modal)
  |     |     |-- ViewSelector (Radix DropdownMenu)
  |     |     |-- TestHistoryList
  |     |     |-- SidebarNavItem x4
  |     |     +-- LeaveFeedbackModal (sibling pattern)
  |     |
  |     +-- <main> (flex-1, overflow-auto)
  |           +-- dashboard/page.tsx -> DashboardClient
  |                 |-- VisualizationCanvas (absolute, z-0, R3F)
  |                 |     +-- <mesh> (placeholder sphere)
  |                 |-- Top bar (z-10): ContextBar, LegendPills, FilterPills, Create button
  |                 |-- Floating content (z-20, absolute bottom-center):
  |                 |     |-- ContentForm | SurveyForm
  |                 |     |-- LoadingPhases
  |                 |     +-- ResultsPanel
  |                 +-- TestTypeSelector (Radix Dialog modal)
```

### State Management

```
Zustand Stores (3):
  useTestStore    -> tests[], currentStatus, currentTestType, simulationPhase, etc.
  useSocietyStore -> societies[], selectedSocietyId
  useSettingsStore -> profile settings

All stores use manual _hydrate() pattern with localStorage persistence.
No middleware (no persist/immer).
```

### Design System Inventory (Available for Migration)

| Category | Components | Key for Dashboard |
|----------|-----------|-------------------|
| **primitives/** | GlassPanel, GlassCard, GlassPill, GlassModal, GlassInput, GlassTextarea, GlassSelect, GlassCheckbox, GlassRadio, GlassSlider, GlassToggle, GlassProgress, GlassBadge, GlassAvatar, GlassAlert, GlassSkeleton, GlassSearchBar, GlassTabs, GlassToast, GlassTooltip, GlassNavbar, GlassBreadcrumbs, Divider, Kbd, CommandPalette, LiquidGlassFilters, GradientGlow, GradientMesh, TrafficLights | GlassPanel (sidebar), GlassModal (all modals), GlassInput (forms), GlassTextarea (ContentForm), GlassCard (results sections), GlassProgress (loading), GlassBadge (type badges), GlassPill (filter pills) |
| **ui/** | Button, Card, Badge, Spinner, Typography, Input, Select, Tabs, Dialog, Toggle, Toast, Avatar, Divider, Kbd, Skeleton, ShortcutBadge, Icon, CategoryTabs, ExtensionCard, TestimonialCard | Button (CTAs), Dialog (modals), Tabs (results), Badge (labels), Spinner (loading) |
| **motion/** | FadeIn, FadeInUp, SlideUp, StaggerReveal, HoverScale, FrozenRouter, PageTransition | FadeInUp (panels), StaggerReveal (results), HoverScale (nav items) |
| **effects/** | ChromaticAberration, NoiseTexture | NoiseTexture (glass surfaces) |

## Recommended Architecture for v2.1

### Wave 1: Dashboard UI Migration

#### 1A. Floating Glassmorphic Sidebar

**Current:** `Sidebar` is a static `<aside>` with hardcoded `bg-[rgba(21,21,21,0.31)] backdrop-blur-[14px] border-r border-[rgb(40,40,40)]`.

**Target:** Wrap sidebar content in `GlassPanel` with floating positioning.

**Modification strategy:**

```
MODIFY: src/components/app/app-shell.tsx
  - Change layout from `flex` with static sidebar to sidebar overlaying content
  - Sidebar becomes `position: fixed` or `absolute` with GlassPanel wrapper
  - Main content gets full width, no longer pushed right by sidebar width
  - Sidebar floats over content with glass blur

MODIFY: src/components/app/sidebar.tsx
  - Replace hardcoded glass styles with <GlassPanel blur="xl" opacity={0.7} borderGlow>
  - Interior elements remain the same structurally
  - Add collapse/expand animation (sidebar already has Columns2 icon for this)

MODIFY: src/components/app/mobile-nav.tsx
  - Update for floating sidebar paradigm (may simplify mobile handling)
```

**Key architectural decision:** The sidebar should NOT push content. It floats over the VisualizationCanvas, which already fills `absolute inset-0`. This means `<main>` becomes full-width and the visualization fills the entire viewport behind the floating sidebar.

**AppShell layout change:**
```
BEFORE:                          AFTER:
+--------+-----------+           +---------------------+
| Sidebar|  Main     |           |  Main (full width)  |
| 240px  |  flex-1   |           |  +-------+          |
|        |           |           |  |Sidebar|  Canvas   |
|        |  Canvas   |           |  |float  |  fills    |
|        |  fills    |           |  |       |  entire   |
|        |  main     |           |  +-------+  area    |
+--------+-----------+           +---------------------+
```

#### 1B. Form Components Migration

**Components to migrate (in order):**

| Component | Current Approach | Design System Replacement | Complexity |
|-----------|-----------------|--------------------------|------------|
| `ContentForm` | `<textarea>` + `<button>` with hardcoded zinc styles | `GlassTextarea` (autoResize) + `Button` (primary) + `GlassPill` (type badge) | Medium |
| `SurveyForm` | `<input>` + `<select>` + custom radio with zinc styles | `GlassInput` + `GlassSelect` + `GlassRadio` + `Button` | Medium |
| `TestTypeSelector` | Radix Dialog with hardcoded glass styles | `Dialog` (from ui/) or `GlassModal` wrapper + grid of `GlassCard` items | Medium |
| `CreateSocietyModal` | Radix Dialog + hardcoded textarea + button | `Dialog` + `GlassTextarea` + `Button` (primary) | Low |
| `DeleteTestModal` | Radix AlertDialog + buttons | `Dialog` + `Button` (destructive) + `Button` (secondary) | Low |
| `LeaveFeedbackModal` | Radix Dialog + inputs + textarea + button | `Dialog` + `GlassInput` x2 + `GlassTextarea` + `Button` | Low |
| `SocietySelector` | Radix Dialog + custom card grid | `Dialog` + `GlassCard` items | Medium |

**Migration pattern (same for each):**
1. Read current component to understand props/state/handlers
2. Replace raw HTML inputs with design system equivalents
3. Replace hardcoded `bg-zinc-*`/`border-zinc-*` with design tokens
4. Replace raw `<button>` elements with `<Button variant="...">`
5. Replace Radix Dialog wrappers with `<Dialog>` from ui/ (already styled)
6. Preserve all event handlers, store connections, and business logic unchanged
7. Verify mobile responsive behavior

**Critical constraint:** Do NOT change business logic, store connections, or state flow during UI migration. The migration is purely visual -- swapping presentational atoms while keeping behavioral structure intact.

#### 1C. Results Panel + Simulation Components Migration

| Component | Current | Design System Replacement |
|-----------|---------|--------------------------|
| `ResultsPanel` | `border-zinc-800 bg-zinc-900` wrapper | `GlassPanel` or `GlassCard` wrapper |
| `ImpactScore` | Custom circular display | Keep custom, wrap in `GlassCard` |
| `AttentionBreakdown` | Custom bar chart | Keep custom, wrap in `GlassCard`, use `GlassProgress` for bars |
| `VariantsSection` | Cards with zinc styles | `GlassCard` per variant |
| `InsightsSection` | List with badges | `GlassBadge` + `GlassCard` |
| `ThemesSection` | Cards with percentage | `GlassCard` + `GlassProgress` |
| `LoadingPhases` | Custom phase list + progress bar | `GlassProgress` for bar, `GlassCard` wrapper, keep custom phase indicators |
| `ShareButton` | Custom button | `Button` (secondary) |

#### 1D. Top Bar Components Migration

| Component | Current | Design System Replacement |
|-----------|---------|--------------------------|
| `ContextBar` | Hardcoded text | Typography from ui/ |
| `FilterPillGroup` | Custom pills | `GlassPill` components |
| `LegendPills` | Custom colored pills | `GlassPill` with tint colors |
| Create button | Raw `<button>` | `Button` variant="primary" |

### Wave 2: Hive Node Visualization

#### 2A. Component Architecture

The hive visualization lives inside the existing `VisualizationCanvas` which provides the R3F `<Canvas>`, `OrbitControls`, lighting, and `VisualizationContext` (reduced motion, mobile detection, geometry detail).

**New component tree:**

```
src/components/visualization/
  |-- VisualizationCanvas.tsx (EXISTING - no changes needed)
  |-- VisualizationContext.tsx (EXISTING - no changes needed)
  |-- GlassOrb.tsx (EXISTING - removed from dashboard, may reuse elsewhere)
  |-- hive/
  |     |-- HiveVisualization.tsx     (orchestrator: manages all layers)
  |     |-- HiveThumbnail.tsx         (center rectangle with content thumbnail)
  |     |-- HiveMainNodes.tsx         (Layer 1: 10+ main category nodes)
  |     |-- HiveSubNodes.tsx          (Layer 2: 100+ subcategory nodes)
  |     |-- HiveLeafNodes.tsx         (Layer 3: 1000+ decorative leaf nodes)
  |     |-- HiveConnections.tsx       (lines/curves between connected nodes)
  |     |-- HiveNodeInfoCard.tsx      (HTML overlay card shown on click)
  |     |-- useHiveLayout.ts          (force-directed or radial layout algorithm)
  |     |-- useHiveInteraction.ts     (click, hover, selection state)
  |     +-- hive-types.ts             (HiveNode, HiveConnection, HiveLayer types)
  |
  +-- shaders/
        +-- (existing shaders, may add node glow shader)
```

**Integration with DashboardClient:**

```tsx
// BEFORE (current):
<VisualizationCanvas className="absolute inset-0 z-0" showResetButton={false}>
  <mesh>
    <sphereGeometry args={[1, 32, 32]} />
    <meshStandardMaterial color="#E57850" />
  </mesh>
</VisualizationCanvas>

// AFTER:
<VisualizationCanvas className="absolute inset-0 z-0" showResetButton>
  <HiveVisualization
    societyId={selectedSocietyId}
    onNodeClick={handleNodeClick}
    onNodeHover={handleNodeHover}
  />
</VisualizationCanvas>

{/* Node info card (HTML overlay, outside R3F) */}
{selectedNode && (
  <HiveNodeInfoCard
    node={selectedNode}
    position={selectedNodeScreenPos}
    onClose={() => setSelectedNode(null)}
  />
)}
```

#### 2B. Node Hierarchy Design

```
Layer 0: Center Thumbnail
  - Static rectangle in center of canvas
  - Shows content being tested (text or image preview)
  - z-positioned slightly above other nodes
  - NOT interactive (decorative anchor)

Layer 1: Main Nodes (10-15)
  - Represent top-level categories (countries, demographics, etc.)
  - Positioned in ring around center thumbnail
  - Larger radius (e.g., 0.15-0.25 world units)
  - Colored by category (using COUNTRY_COLORS or similar palette)
  - Click: glow pulse + show info card
  - Hover: highlight self + connected sub-nodes

Layer 2: Sub Nodes (80-120)
  - Represent subcategories within main nodes
  - Positioned in ring between main and leaf layers
  - Medium radius (e.g., 0.06-0.12)
  - Color inherited from parent main node (lighter shade)
  - Click: glow pulse + show info card
  - Hover: highlight self + connected main node + connected leaf nodes

Layer 3: Leaf Nodes (800-1200)
  - Decorative, represent individual AI personas
  - Positioned in outermost ring / scattered
  - Small radius (e.g., 0.02-0.04)
  - Color inherited from parent sub-node (even lighter)
  - Click: subtle glow only (no info card for performance)
  - Hover: highlight self only
```

#### 2C. Performance Architecture for 1000+ Nodes

**Critical: With 1000+ nodes, individual `<mesh>` components will NOT scale.**

Use `InstancedMesh` for each layer:

```
HiveMainNodes:  1 InstancedMesh (10-15 instances)
HiveSubNodes:   1 InstancedMesh (80-120 instances)
HiveLeafNodes:  1 InstancedMesh (800-1200 instances)
HiveConnections: 1 LineSegments geometry (batch all connections)
```

This gives 3-4 draw calls total instead of 1000+.

**Interaction with InstancedMesh:** Use raycasting on the InstancedMesh, then check `instanceId` from the intersection to identify which node was hit. R3F supports this natively via `onPointerOver`/`onClick` events on `<instancedMesh>`.

**Layout algorithm:** Precompute positions once per society change (not per frame). Store positions in a Float32Array used as InstancedMesh matrix buffer. Only update transforms when:
- Society selection changes (full recompute)
- Node is hovered/clicked (update individual instance color/scale)

#### 2D. State Management for Hive Interactions

**Recommendation: Local state in HiveVisualization, NOT Zustand.**

Rationale:
- Node hover/selection is ephemeral UI state, not persistent
- No other components need node selection state (info card is a child)
- Zustand store updates trigger React re-renders; R3F animation loop should use refs
- The existing stores (testStore, societyStore) are for persistent business state

```
HiveVisualization (local state):
  - hoveredNodeId: string | null
  - selectedNodeId: string | null
  - selectedNodeScreenPos: {x, y} | null (for HTML info card positioning)

Communication pattern:
  - R3F mesh events -> set local state
  - Local state -> drives info card rendering (HTML overlay)
  - R3F useFrame -> reads refs for animation (no React state in loop)
```

**Exception:** If society selection (from sidebar's ViewSelector/SocietySelector) needs to change the hive visualization, this already flows via `useSocietyStore.selectedSocietyId` which DashboardClient reads and passes as prop to HiveVisualization.

#### 2E. HTML Overlay Strategy for Info Card

The info card on node click must be an HTML element (not 3D), because it contains text, badges, and interactive buttons.

**Pattern:** Render the info card as a sibling to `<VisualizationCanvas>` in DashboardClient, positioned absolutely using screen-space coordinates computed from the 3D node position.

```
Convert 3D position -> screen position:
1. In HiveVisualization, on node click:
   - Get node's world position from InstancedMesh matrix
   - Use Three.js Vector3.project(camera) to get NDC
   - Convert NDC to CSS pixels: x = (ndc.x + 1) / 2 * width, y = (1 - ndc.y) / 2 * height
   - Pass to parent via onNodeClick callback

2. In DashboardClient:
   - Render HiveNodeInfoCard at computed screen position
   - Card uses GlassCard from design system
   - Card contains node info: name, category, stats, etc.
```

This avoids `Html` from `@react-three/drei` which re-renders the entire R3F tree on scroll/zoom (poor performance with 1000+ nodes).

## Component Modification Map

### MODIFIED Components (Wave 1)

| File | What Changes | What Stays |
|------|-------------|------------|
| `app-shell.tsx` | Layout: flex -> sidebar overlay, main full-width | AuthGuard wrapping, mobile menu state |
| `sidebar.tsx` | Visual: GlassPanel wrapper, design token colors | All store connections, nav items, handlers |
| `mobile-nav.tsx` | Visual: design token styles | Toggle handler |
| `content-form.tsx` | Visual: GlassTextarea, Button, GlassPill | All handlers, store connections, auto-resize logic |
| `survey-form.tsx` | Visual: GlassInput, GlassSelect, GlassRadio, Button | All handlers, store connections, validation |
| `test-type-selector.tsx` | Visual: Dialog from ui/, GlassCard grid | Grid structure, type data, handlers |
| `create-society-modal.tsx` | Visual: Dialog, GlassTextarea, Button | Submit handler, store connection, name extraction |
| `delete-test-modal.tsx` | Visual: Dialog, Button (destructive + secondary) | Delete handler, store connection |
| `leave-feedback-modal.tsx` | Visual: Dialog, GlassInput x2, GlassTextarea, Button | Submit handler, store connection, success state |
| `society-selector.tsx` | Visual: Dialog, GlassCard for society cards | All store connections, filtering, selection |
| `results-panel.tsx` | Visual: GlassPanel wrapper, design token styles | Section composition, scroll behavior |
| `loading-phases.tsx` | Visual: GlassCard wrapper, GlassProgress bar | Phase logic, store connection |
| `impact-score.tsx` | Visual: GlassCard wrapper, design token colors | Score calculation, display logic |
| `attention-breakdown.tsx` | Visual: GlassProgress bars, design tokens | Breakdown calculation |
| `variants-section.tsx` | Visual: GlassCard per variant | Variant data display |
| `insights-section.tsx` | Visual: GlassBadge + GlassCard | Insight list rendering |
| `themes-section.tsx` | Visual: GlassCard + GlassProgress | Theme data display |
| `filter-pills.tsx` | Visual: GlassPill components | Filter state, handler |
| `legend-pills.tsx` | Visual: GlassPill with tint colors | Legend data |
| `context-bar.tsx` | Visual: Typography from design system | Location data |
| `view-selector.tsx` | Visual: design token styles on Radix DropdownMenu | View state, handler |
| `sidebar-nav-item.tsx` | Visual: design token styles, HoverScale motion | Click handler, icon/label props |
| `dashboard-client.tsx` | Layout: adjust z-indices, add node interaction state, swap placeholder mesh | All store connections, flow handlers |

### NEW Components (Wave 2)

| File | Purpose | Depends On |
|------|---------|------------|
| `visualization/hive/HiveVisualization.tsx` | Orchestrator: creates layout, renders all layers | useHiveLayout, all Hive* components |
| `visualization/hive/HiveThumbnail.tsx` | Center rectangle with content preview | R3F mesh, VisualizationContext |
| `visualization/hive/HiveMainNodes.tsx` | InstancedMesh for 10-15 main nodes | R3F InstancedMesh, hive-types |
| `visualization/hive/HiveSubNodes.tsx` | InstancedMesh for 80-120 sub nodes | R3F InstancedMesh, hive-types |
| `visualization/hive/HiveLeafNodes.tsx` | InstancedMesh for 800-1200 leaf nodes | R3F InstancedMesh, hive-types |
| `visualization/hive/HiveConnections.tsx` | BatchedLineSegments between connected nodes | R3F BufferGeometry + LineSegments |
| `visualization/hive/HiveNodeInfoCard.tsx` | HTML overlay info card on node click | GlassCard, GlassBadge from design system |
| `visualization/hive/useHiveLayout.ts` | Radial/force layout algorithm | Pure computation, no R3F dependency |
| `visualization/hive/useHiveInteraction.ts` | Click/hover state management | React state + refs for R3F |
| `visualization/hive/hive-types.ts` | TypeScript interfaces for hive data | None (pure types) |

### UNCHANGED Components

| File | Reason |
|------|--------|
| `VisualizationCanvas.tsx` | Already handles R3F lifecycle correctly |
| `VisualizationContext.tsx` | Already provides reducedMotion, isMobile, geometryDetail |
| `GlassOrb.tsx` | Not used in dashboard rebuild (may reuse elsewhere) |
| `auth-guard.tsx` | Auth flow unchanged |
| `test-history-item.tsx` | Minor visual update only (could defer) |
| `test-history-list.tsx` | Minor visual update only (could defer) |
| `card-action-menu.tsx` | Already uses Radix DropdownMenu, visual update minor |
| All `settings/` components | Settings page is separate scope |
| All `landing/` components | Marketing page unchanged |

## Data Flow Diagram

```
Society Store                    Test Store
  |                                |
  | selectedSocietyId              | currentStatus, currentTestType,
  |                                | currentResult, simulationPhase
  v                                v
DashboardClient ----props----> ContentForm / SurveyForm / LoadingPhases / ResultsPanel
  |
  | selectedSocietyId (prop)
  v
HiveVisualization (R3F)
  |-- useHiveLayout(societyData) -> node positions (Float32Array)
  |-- HiveMainNodes (InstancedMesh, positions from layout)
  |-- HiveSubNodes (InstancedMesh, positions from layout)
  |-- HiveLeafNodes (InstancedMesh, positions from layout)
  |-- HiveConnections (LineSegments, connections from layout)
  |
  | onNodeClick(nodeId, screenPos) -- callback to DashboardClient
  v
DashboardClient
  |-- selectedNode state
  |-- HiveNodeInfoCard (HTML overlay at screenPos, uses GlassCard)
```

## Suggested Build Order

**Rationale:** Start with structural layout changes (AppShell) because everything else renders inside it. Then migrate components from the inside out -- sidebar first (most visible, sets the tone), then forms, then results. Hive visualization comes last because it depends on the layout being finalized and can be developed in isolation.

### Phase 1: Structural (AppShell + Sidebar)
1. `app-shell.tsx` -- layout change to floating sidebar
2. `sidebar.tsx` -- GlassPanel wrapper, design tokens
3. `sidebar-nav-item.tsx` -- design tokens + HoverScale
4. `mobile-nav.tsx` -- adapt for floating sidebar

### Phase 2: Forms + Modals
5. `content-form.tsx` -- GlassTextarea + Button
6. `survey-form.tsx` -- GlassInput + GlassSelect + GlassRadio + Button
7. `test-type-selector.tsx` -- Dialog + GlassCard grid
8. `create-society-modal.tsx` -- Dialog + GlassTextarea + Button
9. `delete-test-modal.tsx` -- Dialog + Button
10. `leave-feedback-modal.tsx` -- Dialog + GlassInput + GlassTextarea + Button
11. `society-selector.tsx` -- Dialog + GlassCard society cards

### Phase 3: Results + Top Bar
12. `results-panel.tsx` -- GlassPanel wrapper
13. `impact-score.tsx` -- GlassCard wrapper
14. `attention-breakdown.tsx` -- GlassProgress bars
15. `variants-section.tsx` -- GlassCard per variant
16. `insights-section.tsx` -- GlassBadge + GlassCard
17. `themes-section.tsx` -- GlassCard + GlassProgress
18. `loading-phases.tsx` -- GlassCard + GlassProgress
19. `filter-pills.tsx` -- GlassPill
20. `legend-pills.tsx` -- GlassPill with tints
21. `context-bar.tsx` -- Typography tokens
22. `dashboard-client.tsx` top bar -- Button for create CTA

### Phase 4: Hive Foundation
23. `hive-types.ts` -- TypeScript interfaces
24. `useHiveLayout.ts` -- Layout algorithm (radial rings)
25. `HiveThumbnail.tsx` -- Center rectangle
26. `HiveMainNodes.tsx` -- InstancedMesh for main layer
27. `HiveVisualization.tsx` -- Orchestrator connecting thumbnail + main nodes

### Phase 5: Hive Expansion
28. `HiveSubNodes.tsx` -- InstancedMesh for sub layer
29. `HiveLeafNodes.tsx` -- InstancedMesh for leaf layer
30. `HiveConnections.tsx` -- Line segments between nodes

### Phase 6: Hive Interactions
31. `useHiveInteraction.ts` -- Click/hover state management
32. `HiveNodeInfoCard.tsx` -- HTML overlay info card (GlassCard)
33. Integration: wire click/hover into DashboardClient
34. Polish: glow shader for selected nodes, hover highlight for connected nodes

## Anti-Patterns to Avoid

### Anti-Pattern 1: Changing Business Logic During Visual Migration
**What:** Refactoring store connections, handler logic, or data flow while swapping UI atoms.
**Why bad:** Two failure modes at once. If something breaks, you cannot tell if it is a visual regression or a logic bug.
**Instead:** Phases 1-3 are PURELY visual. Same handlers, same stores, same data flow. Only the JSX elements and CSS classes change.

### Anti-Pattern 2: Individual Mesh Per Node
**What:** Rendering 1000+ `<mesh>` R3F components for leaf nodes.
**Why bad:** Each mesh is a separate draw call. At 1000+ nodes, frame rate drops below 30fps even on desktop.
**Instead:** Use `InstancedMesh` -- 1 draw call per layer, 3-4 total.

### Anti-Pattern 3: React State in R3F Animation Loop
**What:** Using `useState` or Zustand selectors inside `useFrame` to drive per-frame animations.
**Why bad:** React state changes trigger re-renders. In a 60fps loop, this means 60 re-renders/second, causing garbage collection stalls.
**Instead:** Use refs for all per-frame data. Only use React state for infrequent events (click selection, hover start/end). The existing GlassOrb.tsx already demonstrates this pattern correctly.

### Anti-Pattern 4: Multiple Simultaneous GlassPanel Blurs
**What:** Having 5+ visible GlassPanel elements all with backdrop-filter blur.
**Why bad:** Each backdrop-filter creates a GPU compositing layer. On mobile, 3+ blur layers cause frame drops. GlassPanel docs explicitly warn about this.
**Instead:** Limit to 2-3 visible blur surfaces. The floating sidebar (GlassPanel blur="xl") + floating content panel (GlassPanel blur="md") = 2. The R3F canvas behind them requires no blur.

### Anti-Pattern 5: drei Html Component for Info Card
**What:** Using `@react-three/drei`'s `<Html>` component for the node info card overlay.
**Why bad:** `<Html>` syncs DOM position with 3D transform every frame. With 1000+ nodes in the scene, this causes layout thrashing.
**Instead:** Compute screen position once on click (Vector3.project), render as a normal React component outside the Canvas.

### Anti-Pattern 6: Big Bang Migration
**What:** Migrating all 22 dashboard components in one commit/PR.
**Why bad:** Impossible to review, impossible to bisect if something breaks, merge conflicts with parallel work.
**Instead:** Migrate in groups of 3-5 related components per task. Each task is independently deployable.

## Key Integration Points

### 1. AppShell <-> Sidebar (Layout Contract)
The layout change from static sidebar to floating sidebar is the highest-risk modification. It affects:
- Sidebar positioning (static -> fixed/absolute)
- Main content width (flex-1 -> full width)
- Mobile nav behavior (overlay changes)
- VisualizationCanvas sizing (now fills entire viewport)
- All z-index stacking (sidebar must be above canvas but below modals)

**Z-index stacking order (after rebuild):**
```
z-0:   VisualizationCanvas (R3F hive)
z-10:  Top bar (ContextBar, FilterPills, Create button)
z-20:  Floating content panel (forms, results, loading)
z-30:  Floating sidebar (GlassPanel)
z-40:  Mobile nav overlay
z-50:  Modal backdrop + modals (Dialog, all Radix portals)
```

### 2. DashboardClient <-> HiveVisualization (Data Flow)
DashboardClient passes `selectedSocietyId` as prop. HiveVisualization generates mock hive data from it. On node interactions, HiveVisualization calls back to DashboardClient via `onNodeClick`/`onNodeHover` props.

### 3. Design System <-> App Components (Token Contract)
Every app component migrated must use design tokens (from `globals.css` @theme) rather than hardcoded hex/rgb values. The token contract is:
- Backgrounds: `bg-background`, `bg-surface`, `bg-surface-elevated`
- Text: `text-foreground`, `text-foreground-secondary`, `text-foreground-muted`
- Borders: `border-border`, `border-border-hover`
- Accent: `bg-accent`, `text-accent`, `hover:bg-accent-hover`
- All spacing via token scale
- All shadows via token shadow scale
- All radii via token radius scale

### 4. VisualizationCanvas <-> Hive Components (R3F Contract)
All hive components render inside `<VisualizationCanvas>` children. They receive the R3F context (Canvas, camera, gl) automatically. They access `VisualizationContext` for `reducedMotion`, `isMobile`, and `geometryDetail` via `useVisualization()` hook.

## Scalability Considerations

| Concern | Current (placeholder sphere) | After hive (1000+ nodes) |
|---------|------------------------------|--------------------------|
| Draw calls | 1 | 3-4 (InstancedMesh per layer + connections) |
| GPU memory | ~5KB | ~2MB (instance matrices + connection buffers) |
| CPU per frame | Negligible | Light (only update hovered/selected instance, not all) |
| Mobile | Works fine | Need to reduce node counts: 5 main, 30 sub, 200 leaf |
| Reduced motion | Static sphere | Static positions, no animations, still interactive |

## Sources

- Direct codebase analysis (all 30+ source files read and analyzed)
- Existing `VisualizationCanvas.tsx` and `GlassOrb.tsx` patterns for R3F architecture
- Existing `GlassPanel.tsx` performance documentation (2-3 blur limit)
- React Three Fiber InstancedMesh documentation (from training data, MEDIUM confidence -- verify `instanceId` in event.object before implementation)
- Three.js Vector3.project() for screen-space conversion (from training data, HIGH confidence -- stable API since r100+)

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Wave 1 migration map | HIGH | Every component read, every design system replacement identified |
| AppShell layout change | HIGH | Clear existing structure, clear target, well-understood CSS |
| Hive component tree | HIGH | Follows existing R3F patterns in codebase |
| InstancedMesh performance | MEDIUM | Known R3F pattern, but verify instanceId raycasting API before coding |
| Node count thresholds | MEDIUM | 1000+ nodes with InstancedMesh is well-established, but mobile thresholds need testing |
| Build order | HIGH | Clear dependency chain, no circular dependencies |
