# Project State -- Virtuna

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-06)

**Core value:** Raycast-quality design system enabling rapid, consistent UI development
**Current focus:** v2.3.5 Design Token Alignment -- Phase 55 Plan 01 complete, Plans 02-03 next

## Current Position

**Milestone:** v2.3.5 -- Design Token Alignment
**Phase:** 55 of 55 (Glass, Docs & Regression) -- In progress
**Plan:** 01 of 03 complete
**Status:** 55-01 complete -- GlassPanel refactored, GradientGlow/GradientMesh/GlassCard deleted, CSS cleaned
**Last activity:** 2026-02-08 -- Completed 55-01-PLAN.md

Progress: [███████████████] ~78% (7 of ~9 plans estimated)

### Phase Overview

| Phase | Name | Requirements | Depends On | Status |
|-------|------|-------------|------------|--------|
| 53 | Font & Color Foundation | 12 (TYPO + COLR) | None | Complete |
| 54 | Card & Surface Corrections | 10 (CARD + HEAD + INPT) | Phase 53 | Complete |
| 55 | Glass, Docs & Regression | 15 (GLAS + DOCS + REGR) | Phase 54 | In progress (1/3 plans) |

### Dependency Graph

```
53 (Font & Color) [DONE] --> 54 (Card & Surface) [DONE] --> 55 (Glass, Docs & Regression) [IN PROGRESS]
```

## Shipped Milestones

- v2.2 Trending Page UI (2026-02-06) -- 3 phases, 10 plans, 30 requirements
- v2.0 Design System Foundation (2026-02-05) -- 6 phases, 35 plans, 125 requirements
- v1.2 Visual Accuracy Refinement (2026-01-30) -- 2 phases
- v1.1 Pixel-Perfect Clone (2026-01-29) -- 10 phases

## In-Progress Milestones

- v2.1 Dashboard Rebuild -- Phases 45-49, 51 requirements, 40% executed [main branch]
- v2.3.5 Design Token Alignment -- Phases 53-55, 37 requirements, Phase 55 in progress (7/~9 plans) [worktree]

## Key Technical Notes

### Known Risks
- oklch-to-hex compilation inaccuracy for dark colors -- use exact hex in @theme
- Lightning CSS strips backdrop-filter from CSS classes -- use inline styles
- Browser + .next/ cache will mask CSS changes -- hard clear required

### Decisions
- Switch to Inter font exclusively (matching Raycast 1:1) -- Phase 53 complete
- Strip colored glass tints, inner glow, GradientGlow/GradientMesh -- Phase 55-01 complete
- Use exact hex for dark grey tokens (not oklch) -- done in 53-01
- Use hex for light gray tokens (50-300) too -- consistent and avoids oklch compilation issues
- gradient-glass token = same values as gradient-navbar (semantic separation)
- font-normal (400) replaces font-[350] and font-[450] -- Inter 400 closest to Funnel Display 350 / Satoshi 450
- Input bg-white/5 (semi-transparent) matches Raycast pattern -- replaces opaque bg-surface
- Components inherit font-sans from body -- no per-component font class needed
- Full regression of all 36 components + pages after fixes -- Phase 55
- **Cards use bg-transparent (not gradient) -- Raycast live audit 2026-02-08**
- **Card inset shadow 5% (not 10%) -- Raycast live audit**
- **Card hover: subtle bg-white/2%, NO translate-y, NO border change -- Raycast live audit**
- **Header is floating pill with 16px radius, max-w-1204px, border all sides -- Raycast live audit**
- **Buttons use 8px radius (rounded-lg) for all sizes -- Raycast live audit**
- Input h-[42px] with all GlassInput features merged -- verified in 54-02
- Textarea drops backdrop-filter (not used on Raycast inputs) -- 54-02
- Textarea uses explicit pixel font sizes (13/14/15px) for precision -- 54-02
- GlassCard (ui/card.tsx) keeps rgba(255,255,255,0.05) bg (intentional for glassmorphism blur effect)
- **GlassPanel has exactly 4 props (children, className, style, as) -- zero-config Raycast glass -- 55-01**
- **PillColor type defined locally in GlassPill.tsx (no cross-component dependency) -- 55-01**
- **shadow-glass CSS variable kept (used by showcase/page.tsx) -- 55-01**

### Session Continuity
- Last session: 2026-02-08
- Stopped at: Completed 55-01-PLAN.md
- Resume file: None
- Next: 55-02-PLAN.md (Docs) or 55-03-PLAN.md (Regression)

---
*State created: 2026-02-06*
*Last updated: 2026-02-08 -- Phase 55 Plan 01 complete*
