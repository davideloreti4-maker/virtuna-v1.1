# Phase 55: Glass, Documentation & Regression - Context

**Gathered:** 2026-02-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Strip GlassPanel to Raycast-neutral glass only (no colored tints, no inner glow, fixed 5px blur, 12px radius), hard-delete GradientGlow and GradientMesh, rewrite BRAND-BIBLE.md as a full design language reference with accurate Raycast values, and verify zero visual regressions across all 36 components and 3 page routes (trending, dashboard, showcase).

</domain>

<decisions>
## Implementation Decisions

### GlassPanel cleanup
- **Remove `tint` prop entirely** — No colored tints. GlassPanel always renders Raycast neutral glass
- **Remove `innerGlow` prop entirely** — No inner glow effect. Clean glass only
- **Remove `blur` prop entirely** — Fixed 5px blur on all GlassPanel instances (Raycast exact). Applied via inline style (Lightning CSS strips CSS backdrop-filter)
- **Remove `opacity` prop** — GlassPanel uses the Raycast glass gradient directly: `linear-gradient(137deg, rgba(17,18,20,0.75) 4.87%, rgba(12,13,15,0.9) 75.88%)`
- **Remove `borderGlow` prop** — Replace with standard Raycast border: `rgba(255,255,255,0.06)` with `border-radius: 12px`
- **Fixed 12px radius** — Remove radius variability. All GlassPanels use 12px (matches cards)
- **Inset shadow** — `rgba(255,255,255,0.15) 0 1px 1px 0 inset` (Raycast glass exact)
- **Keep `as` prop** — Semantic HTML element choice is still useful
- **Keep `className` and `style` props** — For layout overrides (margin, padding, etc.)
- Strip entire `tintMap`, `blurPxMap`, `GlassTint` type, `GlassBlur` type

### Brand Bible structure
- **Full design language document** — Token reference + usage guidelines + component patterns + do/don't examples
- **Branded as "Virtuna Design System"** — Not "Raycast Design Language". Internal notes section notes Raycast origin
- **Visual aids:** Claude's discretion on whether to include ASCII diagrams for component anatomy
- **File location:** Claude's discretion (repo root or .planning/reference/)
- **Must correct all 10+ identified inaccuracies:**
  1. Font: Inter (not Funnel Display/Satoshi)
  2. Accent: #FF7F50 (not #E57850)
  3. Design direction: Raycast-derived dark minimal (not iOS 26 Liquid Glass)
  4. Borders: 6% base / 10% hover (not 10%)
  5. Glass: Raycast neutral 5px blur only (not multi-level tinted glass)
  6. Cards: transparent bg, no hover lift, 5% inset shadow (not gradient bg + lift)
  7. Radius: Cards/glass = 12px, inputs = 8px, buttons = 8px (not 8px default)
  8. Inputs: white/5% bg, 5% border, 42px height (not surface-elevated + white/10)
  9. Header: floating pill with 16px radius (not documented at all)
  10. Remove GradientGlow/GradientMesh from component docs
  11. Button shadow: 4-layer primary pattern
  12. Letter-spacing: 0.2px (not -0.02em)
  13. Line-height: 1.5-1.6 (not 1.1-1.6 scale)

### Regression verification
- **Fresh Raycast CSS re-extraction first** — Scrape Raycast.com CSS at verification time, create ground-truth reference
- **Compare new extraction to old extraction** — Diff against MEMORY.md / previous extraction values. Double verification to catch any Raycast changes since Phase 53/54
- **Manual comparison in extreme detail** — Compare every component to Raycast's live CSS/code, not just spot-checks
- **Log all issues, fix in batch** — Complete full audit first (create issue log), then fix everything in one pass. Reduces context-switching
- **WCAG AA check all text/background combos** — Systematic check of every text color against every background it appears on, not just known risk areas
- **Scope:** All 36 design system components + trending page + dashboard + 7-page showcase

### Deprecation handling
- **GradientGlow: hard delete** — Delete component file entirely. Any import breaks with clear error
- **GradientMesh: hard delete** — Delete component file entirely
- **Full cleanup** — Remove orphaned CSS classes/tokens that only served GradientGlow/GradientMesh
- **Remove unused blur classes** — Delete glass-blur-sm/md/lg/xl/2xl classes from globals.css. Only keep what's needed for 5px
- **Barrel export cleanup** — Remove from `primitives/index.ts`
- **Update all consumers** — Find and fix every import of GradientGlow/GradientMesh
- **GlassCard included in verification** — Verify GlassCard values match Raycast too, not just GlassPanel

### Claude's Discretion
- Whether to include ASCII/text diagrams in Brand Bible
- Brand Bible file location (repo root vs .planning/reference/)
- Order of regression checks (which components/pages first)
- How to structure the Raycast extraction diff document
- Specific WCAG AA testing methodology

</decisions>

<specifics>
## Specific Ideas

- Re-extraction should create a structured reference document that serves as the single source of truth for all Phase 55 work
- Old extraction values (from MEMORY.md and previous phases) should be diffed against the new extraction to surface any Raycast changes since the last scrape
- The regression log should be a structured document (not just notes) that tracks each component, its issues, and fix status
- "Compare everything we currently have to Raycast's code and live view in extreme detail, check for any design language difference" — the bar is pixel-level accuracy

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 55-glass-docs-regression*
*Context gathered: 2026-02-08*
