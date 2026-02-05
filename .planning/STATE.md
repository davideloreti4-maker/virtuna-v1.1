# Project State -- Virtuna

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-05)

**Core value:** Raycast-quality design system enabling rapid, consistent UI development
**Current focus:** v2.1 Dashboard Rebuild -- Phase 46 in progress

## Current Position

**Milestone:** v2.1 -- Dashboard Rebuild
**Phase:** 46 -- Forms & Modals -- In progress
**Plan:** 02 of 04 complete
**Status:** In progress
**Last activity:** 2026-02-05 -- Completed 46-02-PLAN.md (TestTypeSelector Dialog + GlassCard grid)

Progress: [████------] 40% (phase 46: 1/4 plans complete, phase 45: 3/3)

## Phase Overview

| Phase | Name | Requirements | Status |
|-------|------|-------------|--------|
| 45 | Structural Foundation | 11 (SIDE + MOBL) | Complete (3/3) |
| 46 | Forms & Modals | 10 (FORM + MODL) | In progress (1/4) |
| 47 | Results, Top Bar & Loading | 14 (RSLT + TBAR + LOAD) | Pending |
| 48 | Hive Foundation | 9 (HIVE) | Pending |
| 49 | Hive Interactions | 7 (HINT) | Pending |

## Dependency Graph

```
Phase 45 (Foundation) ✓
  |---> Phase 46 (Forms & Modals)
  |---> Phase 47 (Results, Top Bar & Loading)
  |---> Phase 48 (Hive Foundation) ---> Phase 49 (Hive Interactions)
```

Phases 46 and 47 are independent of each other (parallel-capable).
Phases 46-47 are independent of 48-49 (Wave 1 vs Wave 2).

## Shipped Milestones

- v2.0 Design System Foundation (2026-02-05) -- 6 phases, 35 plans, 125 requirements
- v1.2 Visual Accuracy Refinement (2026-01-30) -- 2 phases
- v1.1 Pixel-Perfect Clone (2026-01-29) -- 10 phases

## Infrastructure URLs

- **GitHub**: https://github.com/davideloreti4-maker/virtuna-v1.1
- **Vercel**: https://virtuna-v11.vercel.app
- **Showcase**: /showcase (component documentation, 7 pages)

## Accumulated Context

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

### Key Technical Notes
- v2.0 design system components are the building blocks (GlassPanel, GlassCard, GlassInput, GlassTextarea, GlassPill, GlassProgress, Dialog, Button, Select, Badge, Typography, Spinner, Icon)
- Mobile backdrop-filter budget: max 2 glass elements (MOBL-03)
- Hive uses Canvas 2D (not SVG) for 1000+ node performance
- d3-hierarchy for deterministic layout, d3-quadtree for hit detection
- Z-index scale: base(0) > sidebar(50) > dropdown(100) > sticky(200) > modal-backdrop(300) > modal(400) > toast(500) > tooltip(600)
- Sidebar is a floating GlassPanel (260px, inset 12px, blur=lg) reading state from useSidebarStore
- **Lightning CSS limitation:** Tailwind v4's Lightning CSS strips `backdrop-filter` from compiled CSS classes. GlassPanel applies it via inline React styles as workaround.
- **Form validation pattern:** Zod v4 schema + manual state (safeParse on blur/submit, re-validate on change after first touch). No react-hook-form needed for simple forms.
- **Character counter pattern:** Show at 80%+ of max length, text-error at/over limit.

### Session Continuity
- Last session: 2026-02-05
- Stopped at: Phase 45 complete and verified
- Next: Phase 46 (Forms & Modals) or Phase 47 (Results, Top Bar & Loading)

---
*State created: 2026-02-05*
*Last updated: 2026-02-05 -- Phase 45 complete (verified 17/17 must-haves, 11/11 requirements)*
