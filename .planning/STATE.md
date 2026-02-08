# Project State -- Virtuna

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-06)

**Core value:** Raycast-quality design system enabling rapid, consistent UI development
**Current focus:** v2.1 Dashboard Rebuild -- Phase 49 in progress (Wave 2)

## Current Position

**Milestone:** v2.1 -- Dashboard Rebuild
**Phase:** 49 -- Hive Interactions -- In progress
**Plan:** 01 of 04 complete
**Status:** In progress (Phase 49 Plan 01 complete, Plans 02-04 pending)
**Last activity:** 2026-02-08 -- Completed 49-01-PLAN.md (interaction utilities)

Progress: [█████████░] 97% (phases 45-48 complete, phase 49 plan 1/4 done)

## Phase Overview

| Phase | Name | Requirements | Status |
|-------|------|-------------|--------|
| 45 | Structural Foundation | 11 (SIDE + MOBL) | Complete (3/3) |
| 46 | Forms & Modals | 10 (FORM + MODL) | Complete (4/4) |
| 47 | Results, Top Bar & Loading | 14 (RSLT + TBAR + LOAD) | Complete (5/5) |
| 48 | Hive Foundation | 9 (HIVE) | Complete (4/4) ✓ |
| 49 | Hive Interactions | 7 (HINT) | In progress (1/4) |

## Dependency Graph

```
Phase 45 (Foundation) ✓
  |---> Phase 46 (Forms & Modals) ✓
  |---> Phase 47 (Results, Top Bar & Loading)
  |---> Phase 48 (Hive Foundation) ---> Phase 49 (Hive Interactions)
```

Phases 46 and 47 are independent of each other (parallel-capable).
Phases 46-47 are independent of 48-49 (Wave 1 vs Wave 2).

## Shipped Milestones

- v2.3 Brand Deals & Affiliate Page (2026-02-06) -- 5 phases, 12 plans, 43 requirements
- v2.2 Trending Page UI (2026-02-06) -- 3 phases, 10 plans, 30 requirements
- v2.0 Design System Foundation (2026-02-05) -- 6 phases, 35 plans, 125 requirements
- v1.2 Visual Accuracy Refinement (2026-01-30) -- 2 phases
- v1.1 Pixel-Perfect Clone (2026-01-29) -- 10 phases

## In-Progress Milestones

- v2.1 Dashboard Rebuild -- Phases 45-49, 51 requirements, ~97% executed (Phases 45-48 complete, Phase 49 plan 1/4 done)

## Key Technical Notes

### Decisions
- Phase numbering continues from v2.0 (last phase 44), starting at 45
- 5 phases derived from 9 requirement categories clustered by delivery boundary
- Wave 1 (dashboard migration): Phases 45-47
- Wave 2 (hive visualization): Phases 48-49
- [45-01] Use Zustand persist middleware for new stores (replaces manual _hydrate pattern)
- [45-01] Default sidebar isOpen: true (expanded on first visit)
- [45-01] SidebarToggle uses Button ghost + Icon primitives (not raw HTML)
- [45-02] Active nav item uses bg-active + icon weight fill for visual emphasis
- [45-02] Test history indicator changed from bg-yellow-500 to bg-accent (coral brand)
- [45-02] AppShell simplified: no more prop-drilled mobile state, uses SidebarToggle + Zustand
- [45-02] All hardcoded rgba/rgb colors in sidebar/test-history replaced with design tokens
- [45-03] Sidebar width 260px (not 300px) per visual verification feedback
- [45-03] GlassPanel backdrop-filter applied via inline styles (Lightning CSS strips it from CSS classes)
- [45-03] Content push margin 284px (260 + 12 + 12)
- [46-01] GlassTextarea rendered transparent inside form card (avoid double glass layers)
- [46-01] Select replaces Radix DropdownMenu for question type selection
- [46-01] Zod v4 validation on blur + submit; re-validate on change after first touch
- [46-01] Button loading prop for submit state (not manual Loader2 spinner)
- [46-02] Badge variant="info" used for both "Popular" and "New" badges (no accent variant in Badge)
- [46-02] App components import Dialog from @/components/ui/dialog, never from @radix-ui/react-dialog
- [46-02] Card grids use responsive Tailwind grid (1/2/3 cols) with GlassCard hover="lift"
- [46-03] Keep AlertDialog for destructive actions (prevents overlay-click close)
- [46-03] Dirty-form confirmation uses second Dialog (isDirty + showDiscardConfirm state pattern)
- [46-03] Zod validation on blur (not keystroke) to avoid noisy UX
- [46-03] AlertDialog migration: keep Radix primitives, apply design system visual classes + inline backdrop-filter
- [46-04] SocietySelector preserves _hydrate pattern (not migrated to Zustand persist)
- [46-04] Selected society card uses ring-2 ring-accent border-accent (coral) matching TestTypeSelector pattern
- [46-04] DialogContent size=full with max-w-[800px] for society selector grid layout
- [47-01] Single coral accent for all impact labels (replaces per-label emerald/blue/amber/red mapping)
- [47-01] 3 individual GlassProgress bars for attention breakdown (not segmented stacked bar)
- [47-01] Short insights (<100 chars) render plain Text; long insights use Accordion with first-sentence summary
- [47-01] Badge variant=accent for AI-generated indicator in VariantsSection
- [47-03] ROLE_LEVELS const kept backward-compatible; separate ROLE_LEVEL_COLORS hex map for inline dot styling
- [47-03] GlassPill className gap-2/gap-1.5 for dot-to-label spacing (GlassPill base has no gap)
- [47-04] Staggered skeleton entry (not skeleton-to-content swap) since data arrives all at once
- [47-04] GlassSkeleton/SkeletonText added to primitives barrel export
- [47-02] ResultsPanel uses plain div (bg-surface) not GlassPanel (avoid double glass with child GlassCards)
- [47-02] ShareButton uses useToast for clipboard feedback (replaces useState/setTimeout pattern)
- [47-02] ToastProvider wraps AppShell in server layout (client component safe as child in RSC tree)
- [47-05] Test type selector and content form use Raycast gradient glass (user-requested override of opaque modal pattern)
- [47-05] Simulate button uses primary variant (coral/orange) for visual prominence
- [47-05] shadow-button inset highlight toned from solid white to rgba(255,255,255,0.2)
- All v2.3 decisions archived in milestones/v2.3-ROADMAP.md
- [48-01] HIVE_OUTER_RADIUS=1200 (not 800) for 1000+ tier-3 node circumference
- [48-01] Sort by id (not name) for deterministic d3-hierarchy layout
- [48-01] mulberry32 seeded PRNG for reproducible mock data (seed=42)
- [48-01] Integer rounding on cartesian coords to prevent sub-pixel anti-aliasing
- [48-01] TIER_CONFIG uses inline values (avoids noUncheckedIndexedAccess issues with Record indexing)
- [48-02] onResizeRef pattern avoids observer re-creation on callback identity change
- [48-02] CSS pixel dimensions computed from buffer/actualDpr for consistency across DPR fallback paths
- [48-02] globalAlpha for per-tier opacity animation (reset after each tier batch)
- [48-02] Batched Canvas 2D: single beginPath/fill per tier, no save/restore in loops
- [48-03] Ref-based animation state with getter return object avoids React re-renders during 60fps animation
- [48-03] Module-level globalAnimationComplete flag prevents animation replay on re-mount
- [48-03] Empty useCallback deps for render() -- all reads are from refs, not state
- [48-03] Reused existing usePrefersReducedMotion hook (SSR-safe defaults)
- [48-04] Center rectangle 48×64 → 65×86 (35% larger) per visual verification feedback
- [49-01] Single search radius (not per-tier) for quadtree hit detection, scaled inversely with zoom
- [49-01] OverlayPlacement limited to right/left/bottom (no top) -- sufficient for canvas layouts
- [49-01] HIT_ZOOM_FLOOR=0.3 prevents search radius explosion at extreme zoom-out (MIN_ZOOM=0.2)

### Design System Components
- v2.0 design system components are the building blocks (GlassPanel, GlassCard, GlassInput, GlassTextarea, GlassPill, GlassProgress, Dialog, Button, Select, Badge, Typography, Spinner, Icon)
- Mobile backdrop-filter budget: max 2 glass elements (MOBL-03)
- Hive uses Canvas 2D (not SVG) for 1000+ node performance
- d3-hierarchy for deterministic layout, d3-quadtree for hit detection
- Z-index scale: base(0) > sidebar(50) > dropdown(100) > sticky(200) > modal-backdrop(300) > modal(400) > toast(500) > tooltip(600)
- Sidebar is a floating GlassPanel (260px, inset 12px, blur=lg) reading state from useSidebarStore
- **Lightning CSS limitation:** Tailwind v4's Lightning CSS strips `backdrop-filter` from compiled CSS classes. GlassPanel applies it via inline React styles as workaround.
- **Form validation pattern:** Zod v4 schema + manual state (safeParse on blur/submit, re-validate on change after first touch). No react-hook-form needed for simple forms.
- **Character counter pattern:** Show at 80%+ of max length, text-error at/over limit.

### v2.2 Trending Components (merged from worktree)
- VideoCard, VideoGrid, VideoDetailModal, TikTokEmbed, VelocityIndicator, EmptyState
- useInfiniteVideos hook, bookmark-store with localStorage persistence
- Trending page at /trending with 3 category tabs + Saved filter

### v2.3 Brand Deals Components (merged from worktree)
- 30+ components: DealCard, DealFilterBar, DealApplyModal, AffiliateLinkCard, AvailableProductCard, EarningsStatCards, EarningsChart, etc.
- Hooks: useCopyToClipboard, useCountUp, useDebouncedCallback
- Brand deals page at /brand-deals with 3-tab layout (Deals / Affiliates / Earnings)

### Blockers/Concerns
None.

### Hive Visualization Foundation
- d3-hierarchy for deterministic radial layout, d3-quadtree for hit detection (Phase 49)
- Pure function layout: computeHiveLayout(data, outerRadius) -> LayoutResult
- Mock data: ~1300 nodes (1 center, 12 tier-1, ~120 tier-2, ~1200 tier-3)
- Tier-based visual constants: white at varying opacity, tier-step line opacity
- Progressive build animation: easeOutCubic, center -> tier-1 -> tier-2 -> tier-3, first-load-only
- HiveCanvas: main component wiring layout + renderer + resize + animation + reduced-motion
- Files: hive-types.ts, hive-constants.ts, hive-layout.ts, hive-mock-data.ts, use-canvas-resize.ts, hive-renderer.ts, use-hive-animation.ts, HiveCanvas.tsx, hive-interaction.ts
- Interaction utilities (Plan 01): buildHiveQuadtree, buildAdjacencyMap, screenToWorld, worldToScreen, findHoveredNode, computeOverlayPosition

### Session Continuity
- Last session: 2026-02-08
- Stopped at: Completed 49-01-PLAN.md (interaction utilities)
- Resume file: None
- Next: 49-02-PLAN.md (interaction hook)

---
*State created: 2026-02-05*
*Last updated: 2026-02-08 -- Phase 49 Plan 01 complete (interaction utilities: quadtree, transforms, adjacency)*
