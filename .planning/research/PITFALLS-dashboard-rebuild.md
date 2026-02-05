# Domain Pitfalls: Dashboard Rebuild + Hive Node Visualization

**Domain:** Design system migration, glassmorphic layouts, large-scale node visualization
**Researched:** 2026-02-05
**Applies to:** v2.1 Dashboard Rebuild milestone

---

## Critical Pitfalls

Mistakes that cause rewrites, visual regressions, or major performance problems.

---

### Pitfall 1: Backdrop-filter Over WebGL Canvas May Not Blur

**What goes wrong:** CSS `backdrop-filter: blur()` applied to HTML elements overlaid on top of a WebGL `<canvas>` does not reliably blur the 3D scene behind them. The glassmorphic sidebar and floating panels appear as solid semi-transparent rectangles with no frosted glass effect, despite working perfectly when overlaying regular DOM content.

**Why it happens:** `backdrop-filter` operates on the painted content of elements behind it in the stacking context. WebGL canvases are composited differently by the browser -- the GPU-rendered canvas content may not be treated as "paintable background" for the CSS compositor. The R3F Canvas is already configured with `alpha: true` (line 47 of `VisualizationCanvas.tsx`), but that only controls whether the canvas itself has a transparent background, not whether CSS filters can sample from it.

**Consequences:** The entire glassmorphic design language (frosted sidebar, floating form panels, glass overlays) fails when positioned over the 3D visualization. This is the central layout of the dashboard -- sidebar on left, hive visualization in center, floating panels at bottom.

**Warning signs:**
- Glass elements look like plain semi-transparent rectangles over the 3D area
- Blur works when elements overlap other DOM content but not the canvas
- Inconsistent behavior across browsers (Safari vs Chrome vs Firefox)

**Prevention:**
1. **Prototype early.** Before building the full sidebar, create a minimal test: R3F Canvas with a colored mesh + a `<div>` with `backdrop-filter: blur(12px)` overlaid via absolute positioning. Verify the blur actually samples from the canvas content in Chrome, Safari, and Firefox.
2. **Fallback: solid semi-transparent backgrounds.** The existing `glass-base` utility class (`rgba(24, 25, 28, 0.6)`) from globals.css already works without blur -- it just looks "tinted" rather than "frosted." This is a viable fallback if blur does not work.
3. **Alternative: dual-layer architecture.** Render a blurred snapshot of the 3D scene as a 2D texture behind the sidebar area using R3F's render-to-texture, then use CSS blur on that snapshot element instead of relying on backdrop-filter to reach through the canvas.
4. **Alternative: in-shader blur.** Implement blur in WebGL itself using `@react-three/postprocessing` EffectComposer, which is more reliable than CSS.

**Detection:** Test in the first task of Wave 1. Build a proof-of-concept before committing to the full glassmorphic sidebar.

**Phase:** Wave 1 -- must validate at the very start, before sidebar implementation.

**Confidence:** MEDIUM. Some developers report backdrop-filter works over transparent canvases in recent Chrome builds, but behavior is not guaranteed cross-browser. Must be verified empirically in the actual Virtuna codebase.

---

### Pitfall 2: Stacking Context Hell -- backdrop-filter + Fixed Positioning + Radix Portals

**What goes wrong:** The sidebar uses `fixed` positioning with `backdrop-filter` (sidebar.tsx line 86: `backdrop-blur-[14px]`). Floating form panels use `absolute` positioning. Modals use Radix Dialog portals rendering to `document.body`. Each `backdrop-filter` creates a new stacking context, causing z-index values to stop working as expected. Modals appear behind the sidebar. Floating panels clip under glass elements. Dropdown menus disappear.

**Why it happens:** CSS properties including `backdrop-filter`, `transform`, `filter`, `opacity < 1`, and `will-change` all create new stacking contexts. When the sidebar has `backdrop-filter`, every `position: absolute/fixed` descendant is constrained to that stacking context. Radix portals render to `document.body` (outside the sidebar's stacking context entirely) but then cannot coordinate z-index with sidebar children. The current codebase already has z-index conflicts: sidebar uses `z-50`, mobile overlay uses `z-40`, TestTypeSelector uses `z-50`.

**Consequences:** UI layering breaks in unpredictable ways. Users see modals behind overlays, tooltips hidden by sidebars, and dropdown menus clipped. These issues are often missed in development because they only appear with specific combinations of open panels.

**Warning signs:**
- Modal overlays appear behind the sidebar
- `z-index: 9999` on a modal does not help (stacking contexts are independent hierarchies)
- Elements with `backdrop-filter` break the z-order of their children
- Dropdown menus from the sidebar disappear behind the main content area

**Prevention:**
1. **Use the existing z-index scale exclusively.** The design system defines `--z-base` (0) through `--z-tooltip` (600). Map every layer to this scale: sidebar = `--z-sticky` (200), floating panels = `--z-dropdown` (100), modals = `--z-modal` (400).
2. **Portals for all floating UI.** Modals, dropdowns, and tooltips should render to `document.body` via portals (Radix already does this). Floating panels (ContentForm, ResultsPanel) should also be portaled if they need to appear above the sidebar.
3. **Do not nest glassmorphic elements.** A glassmorphic panel inside another glassmorphic panel creates nested stacking contexts that are nearly impossible to reason about.
4. **Test layering after every glass element.** After each glassmorphic component is built, manually test: open a modal, hover a tooltip, click a dropdown, and verify nothing is hidden.

**Detection:** Open every overlay (modal, dropdown, tooltip) with the sidebar visible.

**Phase:** Wave 1 -- affects sidebar, modals, floating panels.

**Confidence:** HIGH. Well-documented CSS behavior. Already partially visible in the current codebase.

---

### Pitfall 3: InstancedMesh Raycasting Fails Silently at 1000+ Nodes

**What goes wrong:** Click and hover events on individual nodes in the hive visualization stop working or become unreliable with 1000+ instances. The raycaster misses clicks, returns wrong `instanceId` values, or causes frame drops when processing pointer events every frame.

**Why it happens:** Three.js raycasting against `InstancedMesh` checks every instance's bounding sphere per frame per pointer event -- O(n) cost. With 1000+ instances, this is expensive. Additionally, there is a known R3F bug (issue #3289) where `instancedMesh` onClick events fail when bounding spheres are not updated after matrix changes. The bounding sphere must be manually recomputed with `computeBoundingSphere()` after any position update, which is not documented in the API.

**Consequences:** The core interaction model (click = glow/scale + info card, hover = highlight connected nodes) is broken or janky. Users click on nodes and nothing happens, or the wrong info card appears.

**Warning signs:**
- Click events fire for wrong instances or not at all
- Hover state "sticks" or does not clear
- Frame rate drops noticeably on mouse movement over the visualization
- Console warnings about bounding spheres

**Prevention:**
1. **Use BVH spatial indexing.** Install `three-mesh-bvh` or `@three.ez/instanced-mesh` for O(log n) raycasting instead of O(n). This is critical for 1000+ nodes.
2. **Always call `computeBoundingSphere()` after matrix updates.** This is a required workaround for the R3F bounding sphere bug.
3. **Use `event.stopPropagation()` in all click handlers.** R3F propagates events through all intersected objects by default -- without stopping propagation, clicking a leaf node fires events on nodes behind it too.
4. **Throttle hover events.** Use `onPointerMove` with a 50ms throttle instead of firing on every frame.
5. **Layer-based raycasting.** Put decorative (non-interactive) leaf nodes on a different three.js layer to exclude them from raycasting entirely. Only the ~110 main + sub nodes need interactivity.

**Detection:** Test with the actual target node count (1000+) early. Prototyping with 50 nodes and assuming it scales is the trap.

**Phase:** Wave 2 -- node visualization interaction.

**Confidence:** HIGH. Documented in R3F GitHub issues #3289 and discussions #2103.

---

### Pitfall 4: WebGL Context Loss on Route Navigation

**What goes wrong:** Navigating between routes in the Next.js App Router (dashboard -> settings -> dashboard) causes the R3F Canvas to unmount and remount, triggering WebGL context loss. After several navigations, the visualization fails to render -- blank area or console error `THREE.WebGLRenderer: Context Lost`.

**Why it happens:** Browsers limit active WebGL contexts (typically 10-20). Each Canvas mount creates a new context; unmounting forces context loss to free GPU memory. The current architecture has the Canvas inside `dashboard-client.tsx`, which is a child of the `(app)` layout. Navigating to `/settings` unmounts the dashboard page, destroying the Canvas. Navigating back creates a new Canvas and new WebGL context. Safari is especially aggressive about context limits.

**Consequences:** After navigating settings -> dashboard -> settings -> dashboard several times, the visualization stops rendering. Users see a blank area where the hive should be. The dashboard is the primary view, so this affects the core experience.

**Warning signs:**
- Blank visualization area after navigating back to dashboard
- Console error: `THREE.WebGLRenderer: Context Lost`
- Safari showing black rectangles instead of the visualization
- Increasing GPU memory usage in profiler on each navigation

**Prevention:**
1. **Never unmount the Canvas between routes.** Keep one persistent Canvas in the `(app)/layout.tsx` level, and route the 3D scene contents instead of the Canvas itself. The Canvas renders behind all app pages; each page controls what 3D content to display (or nothing).
2. **Use `frameloop="demand"` when the visualization is not visible.** When the user is on the settings page, the Canvas should stop rendering frames but remain mounted. Use `invalidate()` to resume rendering when needed.
3. **Implement a visibility check.** Use `document.hidden` or an IntersectionObserver to pause rendering when the Canvas is not in the viewport.

**Detection:** Navigate between dashboard and settings 10+ times. Check for context loss in Chrome DevTools > Application > Frames.

**Phase:** Wave 2 primarily, but the architecture decision (where the Canvas lives) must be made at the start of Wave 1, because it affects the `AppShell` component structure.

**Confidence:** HIGH. Extensively documented in R3F GitHub issues #514, #3093, #2655.

---

## Moderate Pitfalls

Mistakes that cause delays, visual inconsistencies, or technical debt.

---

### Pitfall 5: Inconsistent Token Usage During Incremental Migration

**What goes wrong:** During migration, some components use design system tokens (`bg-surface`, `text-foreground-muted`, `border-border`) while others retain hardcoded values (`bg-zinc-900`, `text-zinc-400`, `border-zinc-800`). The dashboard ends up with two visual languages that are close but not identical, creating a "95% consistent" look that feels subtly wrong.

**Why it happens:** The existing ~30 dashboard components use Tailwind utility classes with hardcoded color values. Migration happens component-by-component. During the transition period, some components are migrated and some are not. The hardcoded values are close to but not identical to the design system tokens:

| Hardcoded (current) | Design System Token | Visual Difference |
|---------------------|---------------------|-------------------|
| `bg-zinc-900` | `bg-surface` (#18191c) | Slight warmth shift |
| `text-zinc-400` | `text-foreground-secondary` (#9c9c9d) | Lighter gray |
| `border-zinc-800` | `border-border` (rgba 255,255,255,0.08) | Transparency vs solid border |
| `bg-[rgba(21,21,21,0.31)]` | `glass-base` (rgba 24,25,28,0.6) | Different opacity |
| `bg-[#0A0A0A]` | `bg-background` (#07080a) | Very subtle difference |
| `text-[rgb(184,184,184)]` | `text-foreground-secondary` (#9c9c9d) | Notably different gray |
| `border-[rgb(40,40,40)]` | `border-border` (rgba 255,255,255,0.08) | Solid vs transparent |
| `bg-orange-500` | `bg-accent` (coral-500) | Tailwind orange vs oklch coral |
| `text-zinc-500` / `text-zinc-600` | `text-foreground-muted` (#848586) | Multiple shades collapse to one |

**Consequences:** Users perceive something "slightly off" without articulating it. The design loses cohesion. Bugs get filed about "colors don't match" that are actually migration artifacts.

**Prevention:**
1. **Migrate entire visual groups at once.** Do not migrate one button in a card while leaving the card itself unmigrated. Migrate the card + all its children as a unit.
2. **Create the mapping table first.** Before writing code, document every hardcoded value and its corresponding design system token. The table above is a start -- complete it for all 30 components.
3. **"New system only" rule.** Any new code must use tokens. Legacy code stays as-is until explicitly migrated in the scheduled task.
4. **Visual regression snapshots.** Screenshot each component before and after migration to catch subtle color shifts.

**Detection:** Side-by-side comparison of adjacent migrated vs unmigrated components.

**Phase:** Wave 1 -- spans the entire dashboard rebuild.

**Confidence:** HIGH. Directly observable in the current codebase by comparing sidebar.tsx, content-form.tsx, test-type-selector.tsx, and app-shell.tsx hardcoded values against globals.css tokens.

---

### Pitfall 6: Breaking Zustand Store Contracts During Component Refactor

**What goes wrong:** Refactoring dashboard components to use design system primitives accidentally changes how Zustand stores are consumed. A component that used a granular selector like `useTestStore((s) => s.currentStatus)` gets refactored, and the developer destructures the entire store instead, causing unnecessary re-renders throughout the component tree.

**Why it happens:** The current stores (`society-store.ts`, `test-store.ts`, `settings-store.ts`) are consumed via selective hooks. When migrating a component from raw JSX to design system wrappers, developers restructure the component and may change store subscription patterns. The `dashboard-client.tsx` already has this anti-pattern at line 28-39: it destructures the entire `testStore` and `societyStore`, meaning any store change triggers a re-render of the entire dashboard page.

**Consequences:** Subtle performance regressions -- components re-render when they should not. Or broken interactions -- store actions called with wrong arguments after refactoring event handlers.

**Warning signs:**
- Components re-rendering on unrelated state changes (visible in React DevTools Profiler)
- Click handlers that stop working after migration
- `useTestStore((s) => s.someAction)` replaced with `const { someAction } = useTestStore()` (subscribes to everything)
- Increased "Rendering" time in DevTools Performance tab after migration

**Prevention:**
1. **Preserve existing selector patterns.** If a component uses `useTestStore((s) => s.currentStatus)`, keep that exact pattern after migration. The visual layer changes; the data layer does not.
2. **Separate visual migration from store refactoring.** The migration task scope is "replace visual primitives with design system components." Store optimization is a different task.
3. **Test every interaction after migration.** Click every button, submit every form, verify every state transition still works.
4. **Fix `dashboard-client.tsx` store consumption first.** Convert the current full-store destructuring to granular selectors before other refactoring begins.

**Detection:** React DevTools Profiler -- compare render counts before and after migration.

**Phase:** Wave 1 -- every component migration touches this.

**Confidence:** HIGH. The anti-pattern is already visible in `dashboard-client.tsx` line 28.

---

### Pitfall 7: Forcing All Node Tiers Into a Single InstancedMesh

**What goes wrong:** Using one InstancedMesh for all 1000+ hive nodes means all nodes must share the same geometry and material. But the hive design requires different node sizes (center thumbnail, ~10 main nodes, ~100 sub-nodes, ~1000 leaf nodes) and different visual states (default, hovered, selected with glow). Encoding all variations into one InstancedMesh leads to complex custom shaders and visual artifacts.

**Why it happens:** InstancedMesh requires all instances to share the same geometry and material. To vary appearance per instance, you must use instanced attributes (color, scale) or custom shaders. The hive has 4 tiers with distinct sizes and interactive states (glow, scale) that require per-instance uniforms. Developers often try to force everything into one InstancedMesh for "maximum performance," then realize they cannot selectively apply glow effects or use different geometries per tier.

**Consequences:** Either visual quality suffers (all nodes look the same flat circle), or complexity explodes (custom shaders with per-instance attributes for every variation). Both outcomes delay delivery significantly.

**Prevention:**
1. **Use 3-4 separate rendering groups per tier:**
   - Center thumbnail: 1 instance, individual mesh with unique geometry (rectangle)
   - Main nodes: ~10 instances, individual meshes (low count, instancing adds no benefit but limits flexibility)
   - Sub-nodes: ~100 instances, Drei `<Instances>` component with shared material
   - Leaf nodes: ~1000 instances, `InstancedMesh` with minimal per-instance attributes (position, color, scale)
2. **Use Drei's `<Instances>` for declarative per-instance props.** It wraps InstancedMesh but supports per-instance color, scale, and events.
3. **Handle glow as a post-processing effect.** Use `@react-three/postprocessing` selective bloom on the selected node rather than encoding glow per-instance in a custom shader.
4. **Keep individual meshes for the center + main nodes.** At counts below ~50, instancing provides no measurable benefit but significantly limits visual flexibility.

**Detection:** If the shader file for nodes exceeds 50 lines of custom per-instance attribute code, the approach is overengineered.

**Phase:** Wave 2 -- node visualization architecture decision.

**Confidence:** HIGH. Fundamental constraint of three.js InstancedMesh.

---

### Pitfall 8: Backdrop-filter Performance Stacking on Mobile

**What goes wrong:** The glassmorphic sidebar + floating form panels + modals each use `backdrop-filter: blur()`. On mobile devices (especially older iOS), having multiple blurred elements on screen simultaneously causes the dashboard to become sluggish. Scrolling stutters, animations drop frames, and touch input feels laggy.

**Why it happens:** Each `backdrop-filter` element requires the GPU to sample and blur the background pixels on every frame. When combined with the R3F Canvas (which also consumes GPU bandwidth for WebGL rendering), mobile GPUs hit bandwidth limits. The existing codebase already has a mobile optimization in globals.css (lines 373-381) that caps blur at 8px on mobile, but having 3+ blurred elements simultaneously still exceeds the budget.

**Consequences:** Mobile users experience a laggy dashboard. Touch interactions feel unresponsive. Battery drains faster.

**Warning signs:**
- FPS drops below 30 on mobile during scrolling or panel transitions
- Touch input latency visible to the user
- CSS "Rendering" time in DevTools exceeds 16ms per frame
- Mobile devices becoming noticeably warm

**Prevention:**
1. **Limit glassmorphic elements to 2 per viewport on mobile.** The sidebar is always visible, so at most one additional floating panel should have blur on mobile.
2. **Disable backdrop-filter on mobile when the R3F canvas is active.** Fall back to solid semi-transparent backgrounds (`glass-base` class).
3. **Use `will-change: transform` on glassmorphic elements** to promote them to compositor layers.
4. **Keep blur values between 8-12px.** Higher values are exponentially more expensive. The existing 8px mobile cap is good.
5. **Test on actual mobile devices.** Chrome DevTools device emulation does not simulate GPU constraints.

**Detection:** Lighthouse performance audit targeting mobile. Test on a real mid-range Android device and iPhone SE.

**Phase:** Wave 1 -- sidebar and floating panels.

**Confidence:** HIGH. Already partially addressed in globals.css mobile blur cap.

---

### Pitfall 9: Dual Dialog Systems from Partial Modal Migration

**What goes wrong:** The dashboard currently imports Radix Dialog directly (`@radix-ui/react-dialog` in test-type-selector.tsx line 3, create-society-modal.tsx, delete-test-modal.tsx, leave-feedback-modal.tsx). The design system also exports its own `Dialog` component (from `src/components/ui/dialog.tsx`) that wraps Radix with design system styling, animations, and consistent overlay treatment. During migration, some modals get migrated to the design system Dialog while others remain on raw Radix, creating inconsistent modal behavior.

**Consequences:** Some modals animate differently. Some have the design system overlay (correct opacity and blur), others have custom overlays with different opacities. Focus trapping and close-on-click-outside behavior varies. Users perceive inconsistency across the app.

**Warning signs:**
- Two different import paths for Dialog in the codebase: `@radix-ui/react-dialog` and `@/components/ui`
- Modals with different overlay opacities (compare `bg-black/60` in test-type-selector.tsx vs design system overlay)
- Inconsistent close-on-click-outside and escape-key behavior
- Different animation timings between modals

**Prevention:**
1. **Migrate all modals in a single batch.** Do not leave some modals on raw Radix and others on the design system Dialog. There are 4 modals: TestTypeSelector, CreateSocietyModal, DeleteTestModal, LeaveFeedbackModal.
2. **The design system Dialog re-exports all Radix primitives.** It provides `DialogTrigger`, `DialogPortal`, `DialogClose`, `DialogOverlay`, `DialogContent`, etc. There is no feature loss from migrating.
3. **Preserve the TestTypeSelector's custom layout.** It uses a custom 3-column grid inside the dialog content -- this must be kept as custom content within `DialogContent`.

**Detection:** Grep for `@radix-ui/react-dialog` imports. Any remaining after migration = incomplete.

**Phase:** Wave 1 -- modal migration batch.

**Confidence:** HIGH. Both dialog systems already exist in the codebase; the inconsistency is guaranteed if migration is partial.

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable without major rework.

---

### Pitfall 10: R3F Canvas SSR Hydration Mismatch on Layout Restructuring

**What goes wrong:** Moving the `VisualizationCanvas` to a higher level in the component tree (for Pitfall 4 prevention) may place it in or near a server component boundary. Next.js throws a hydration mismatch error because the Canvas depends on WebGL which is browser-only.

**Why it happens:** R3F Canvas depends on WebGL, which is browser-only. The current setup has `"use client"` on `VisualizationCanvas.tsx`, but if the Canvas is moved into the `(app)/layout.tsx` during restructuring, and the layout is a server component (as it is now -- it handles metadata), the Canvas cannot render on the server.

**Prevention:**
1. **Keep `"use client"` on all visualization components.**
2. **Use `next/dynamic` with `{ ssr: false }` if the Canvas component is imported in a layout.** This is the standard Next.js pattern for browser-only components.
3. **Create a `PersistentCanvas` client component** that wraps the dynamic import and lives as a child of the server layout.

**Detection:** Build-time errors or console hydration mismatch warnings on navigation.

**Phase:** Wave 1 if layout restructuring happens early; Wave 2 otherwise.

**Confidence:** HIGH. Standard Next.js App Router behavior.

---

### Pitfall 11: Framer Motion + R3F Animation Frame Competition

**What goes wrong:** The dashboard uses Framer Motion (`framer-motion` v12.29.3) for UI animations and R3F for 3D rendering. Both libraries use `requestAnimationFrame`. When a Framer Motion animation (sidebar slide-in, panel fade-up, modal transition) runs simultaneously with R3F continuous rendering, both compete for the 16ms frame budget, causing jank.

**Why it happens:** R3F's default `frameloop="always"` renders every frame. Framer Motion spring animations also run on every frame. When both fire in the same animation frame, the combined work may exceed 16ms, causing dropped frames.

**Prevention:**
1. **Set `frameloop="demand"` on the Canvas.** Only render 3D frames when the scene needs updating (via `invalidate()`), not every frame. The hive visualization is mostly static except during hover/click interactions.
2. **Stagger animations.** Do not trigger a Framer Motion sidebar transition and a 3D scene animation at the same time.
3. **Prefer CSS transitions for glassmorphic UI elements.** Use `transition-all duration-200` instead of Framer Motion spring animations for simple opacity/transform changes on glass panels.

**Detection:** Chrome DevTools Performance tab -- look for long frames (>16ms) during simultaneous UI + 3D transitions.

**Phase:** Wave 1 + Wave 2 boundary when both systems are active.

**Confidence:** MEDIUM. Depends on animation complexity and device capability.

---

### Pitfall 12: Hover Flickering in Dense Node Clusters

**What goes wrong:** The "hover = highlight connected nodes" interaction fires rapidly in dense layouts. Small mouse movements cross multiple nodes per frame, causing rapid state updates and visual flickering as connection highlights toggle on and off.

**Why it happens:** R3F fires `onPointerMove` on every frame where the pointer intersects a new instance. In a dense graph, micro mouse movements trigger new intersections constantly. Each hover target change triggers a React state update, which triggers a re-render, which updates instance colors -- all within the same frame budget.

**Prevention:**
1. **Debounce hover target changes.** Wait 80-100ms before committing a new hover target.
2. **Use refs for hover tracking, not React state.** Mutate instance color attributes directly via the instanced buffer, bypassing React's render cycle entirely.
3. **Implement smooth transitions.** Fade connection highlights in/out over 200ms so rapid target changes feel smooth rather than strobing.
4. **Pre-compute adjacency lists.** Build a `Map<nodeId, Set<connectedNodeIds>>` once at initialization so looking up connected nodes is O(1) per hover.

**Detection:** Move the mouse quickly across a dense cluster of sub-nodes and leaf nodes. Watch for flickering highlights.

**Phase:** Wave 2 -- node interaction implementation.

**Confidence:** HIGH. Standard issue in interactive graph/network visualizations.

---

### Pitfall 13: Design System Button Variants Do Not Cover All Dashboard Button Styles

**What goes wrong:** The dashboard has several ad-hoc button styles that do not map cleanly to the 4 design system Button variants (primary, secondary, ghost, destructive). For example:
- The "Create a new test" button in dashboard-client.tsx (line 113-126) uses `bg-white text-zinc-900` -- no matching variant.
- Action buttons in content-form.tsx use `border border-zinc-700 bg-zinc-800/50 text-xs text-zinc-500` -- closest is `secondary` but different size and color.
- The sidebar "Create a new test" (sidebar.tsx line 149-156) is a plain text button with no border -- `ghost` is close but has different padding.

**Consequences:** Developers force-fit buttons into existing variants (losing the intended design) or add inline overrides (defeating the purpose of the design system).

**Warning signs:**
- Buttons wrapped in `<Button>` but with extensive `className` overrides
- Visual regressions where buttons look "off" after migration
- Inconsistency between original design intent and design system output

**Prevention:**
1. **Audit all button styles before migration.** Document every unique button pattern and decide: (a) map to existing variant, (b) add a new variant, or (c) use composition (Button with custom className for one-off uses).
2. **Consider adding a `tertiary` or `outline` variant** for the common `border + transparent background + muted text` pattern seen in form action buttons.
3. **Accept that some buttons are intentionally custom.** The white CTA button (`bg-white text-zinc-900`) is a deliberate contrast choice over the dark background -- it may need a `contrast` variant or remain custom.

**Detection:** After migrating each form/panel, compare the button appearance to the original screenshot.

**Phase:** Wave 1 -- early in the migration to avoid rework.

**Confidence:** HIGH. Directly observable by comparing button.tsx variants against the content-form.tsx and dashboard-client.tsx button styles.

---

## Phase-Specific Warning Summary

| Phase | Pitfall # | Pitfall | Risk Level | First Action |
|-------|-----------|---------|------------|--------------|
| Wave 1 (first task) | 1 | Backdrop-filter over Canvas | Critical | Build proof-of-concept |
| Wave 1 | 2 | Stacking context z-index | Critical | Map all layers to z-index scale |
| Wave 1 | 5 | Inconsistent token usage | Moderate | Create hardcoded-to-token mapping table |
| Wave 1 | 6 | Zustand store contracts | Moderate | Fix dashboard-client.tsx selectors first |
| Wave 1 | 8 | Mobile backdrop-filter perf | Moderate | Limit to 2 glass elements on mobile |
| Wave 1 | 9 | Dual dialog systems | Moderate | Migrate all 4 modals in one batch |
| Wave 1 | 13 | Button variant gaps | Minor | Audit all button styles, plan variants |
| Wave 1/2 | 4 | WebGL context loss on navigation | Critical | Decide Canvas placement in layout |
| Wave 1/2 | 11 | Framer Motion + R3F frame competition | Minor | Set frameloop="demand" |
| Wave 2 | 3 | InstancedMesh raycasting at scale | Critical | Use BVH, test with 1000+ nodes |
| Wave 2 | 7 | Single InstancedMesh for all tiers | Moderate | Separate mesh groups per tier |
| Wave 2 | 10 | R3F SSR hydration | Minor | Dynamic import with ssr: false |
| Wave 2 | 12 | Hover flickering in dense clusters | Minor | Debounce + ref-based color updates |

---

## Architecture Decision Required Before Wave 1

One decision affects both waves and must be made before implementation begins:

**Where does the R3F Canvas live?**

| Option | Pros | Cons |
|--------|------|------|
| A: Canvas in `dashboard-client.tsx` (current) | Simple, no restructuring needed | Context loss on navigation (Pitfall 4) |
| B: Canvas in `(app)/layout.tsx` (persistent) | No context loss, single WebGL context | Requires layout restructuring, dynamic import with ssr: false |

**Recommendation:** Option B. The hive visualization is the centerpiece of the product. Context loss from navigation is unacceptable. The restructuring cost is small: move the Canvas from page-level to layout-level, wrap in `next/dynamic({ ssr: false })`, and have each page control what 3D content renders (or nothing for settings/other pages). The `AppShell` component already wraps the layout -- extend it to own the persistent Canvas.

---

## Sources

- [R3F Scaling Performance Guide](https://r3f.docs.pmnd.rs/advanced/scaling-performance) -- official performance documentation (HIGH confidence)
- [Drei Instances Component](https://drei.docs.pmnd.rs/performances/instances) -- declarative instancing API (HIGH confidence)
- [R3F Events and Interaction](https://r3f.docs.pmnd.rs/tutorials/events-and-interaction) -- event handling patterns (HIGH confidence)
- [R3F instancedMesh onClick issue #3289](https://github.com/pmndrs/react-three-fiber/issues/3289) -- bounding sphere bug (HIGH confidence)
- [R3F WebGL context loss issue #3093](https://github.com/pmndrs/react-three-fiber/issues/3093) -- unmount memory leak (HIGH confidence)
- [R3F WebGL context loss issue #514](https://github.com/pmndrs/react-three-fiber/issues/514) -- original leak report (HIGH confidence)
- [R3F Safari context limits discussion #2457](https://github.com/pmndrs/react-three-fiber/discussions/2457) -- Safari WebGL context limits (HIGH confidence)
- [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) -- BVH spatial indexing for fast raycasting (HIGH confidence)
- [@three.ez/instanced-mesh](https://github.com/agargaro/instanced-mesh) -- enhanced InstancedMesh with BVH, frustum culling (HIGH confidence)
- [Three.js Instances Guide (Codrops, July 2025)](https://tympanus.net/codrops/2025/07/10/three-js-instances-rendering-multiple-objects-simultaneously/) -- instancing patterns (MEDIUM confidence)
- [Building Efficient Three.js Scenes (Codrops, Feb 2025)](https://tympanus.net/codrops/2025/02/11/building-efficient-three-js-scenes-optimize-performance-while-maintaining-quality/) -- optimization techniques (MEDIUM confidence)
- [Glassmorphism Implementation Guide 2025](https://playground.halfaccessible.com/blog/glassmorphism-design-trend-implementation-guide) -- performance budgets (MEDIUM confidence)
- [Why backdrop-filter fails with positioned elements](https://medium.com/@aqib-2/why-backdrop-filter-fails-with-positioned-child-elements-0b82b504f440) -- stacking context issues (MEDIUM confidence)
- [Stacking context issues with filter/transform (GitHub gist)](https://gist.github.com/vielhuber/e882f1f7c03f56d9bd70985fe4fe4a5d) -- comprehensive list of stacking context triggers (MEDIUM confidence)
- [Dark Glassmorphism UI Trends 2026](https://medium.com/@developer_89726/dark-glassmorphism-the-aesthetic-that-will-define-ui-in-2026-93aa4153088f) -- mobile performance constraints (LOW confidence)
