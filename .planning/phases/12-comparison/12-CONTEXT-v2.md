# Phase 12: Comparison (v2) - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning
**Version:** v2 (comprehensive reanalysis)

<domain>
## Phase Boundary

Exhaustive visual comparison of EVERY Virtuna element against Societies reference to achieve **99% clone accuracy**. This is a complete reanalysis using:
- **Playwright** for systematic live capture of every state
- **v0 MCP** for AI-powered analysis of EVERY comparison
- **Pixel-perfect documentation** of every discrepancy

This replaces the v1 comparison which found 45 discrepancies. v2 will be significantly more thorough.

</domain>

<decisions>
## Implementation Decisions

### Capture Coverage
- **Pages:** All app routes — Dashboard, Settings (all tabs), all 11 form types, results, history, every accessible route
- **States:** Exhaustive — every hover, focus, active, loading, empty, error state for every interactive element
- **Viewport:** Desktop 1440x900 only (matches reference extraction)
- **Granularity:** Component-level close-ups — isolate sidebar, header, each form field, each button for pixel-level comparison

### v0 MCP Usage Pattern
- **Method:** Side-by-side image analysis — send both Virtuna screenshot + Societies reference to v0
- **Analysis scope:** Comprehensive — colors (hex), spacing (px), typography (font/size/weight), layout, shadows, borders, animations
- **Output format:** Structured JSON — parseable format with exact values
- **Fix suggestions:** Yes — ask v0 for exact CSS property or code change needed

### Discrepancy Documentation
- **Detail level:** Pixel-perfect spec — exact hex colors, pixel measurements, font specs, border radius, shadow values
- **Annotations:** Highlighted differences — circle/highlight each difference in comparison screenshots
- **Organization:** By component — group all sidebar issues, all form issues, etc.
- **ID format:** Component-based — SIDEBAR-001, FORM-001, MODAL-001

### Element Tracking
- **Additions (Virtuna has, Societies doesn't):** Flag for removal — these should be removed to match reference exactly
- **Missing (Societies has, Virtuna doesn't):** Flag as critical — must be added for 99% accuracy

### Comparison Workflow
- **Process:** Live capture + immediate compare — Playwright captures Virtuna, immediately compare each with v0 MCP
- **Parallelism:** Sequential single agent — one agent does everything in order for consistency
- **Reference source:** Existing Phase 11 extraction screenshots from app.societies.io
- **Deliverables:** Master report + JSON + annotated images

### Claude's Discretion
- Exact Playwright test structure and selector patterns
- v0 prompt engineering details
- Screenshot annotation tool/method
- File organization within comparison directory

</decisions>

<specifics>
## Specific Ideas

### v0 MCP Prompt Template
For each component comparison, v0 should be prompted to:
1. List EVERY visual difference between the two images
2. Provide exact measurements (px for spacing, hex for colors, font specs)
3. Categorize each difference (color, spacing, typography, layout, shadow, border, animation)
4. Rate severity (critical/major/minor)
5. Suggest exact CSS/code fix

### Target Accuracy
- **Goal:** 99% pixel accuracy (up from 98% in v1)
- **Definition:** No visible difference at 1440x900 when switching between Virtuna and Societies

### Component Checklist
Every component must be compared:
- Sidebar (logo, nav items, society selector, version label)
- Header (create test button, user menu)
- Network visualization (dots, lines, clustering, colors)
- Context bar (filter pills, view selector)
- Society selector modal (full layout, sections, cards)
- Test type selector modal (grid, categories, icons)
- All 11 form types (fields, buttons, layout)
- Results panel (impact score, insights, variants)
- Settings (all tabs: profile, account, notifications, team, billing)
- All modals (create society, leave feedback, confirmation dialogs)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-comparison*
*Context gathered: 2026-01-31*
*Version: v2 (comprehensive reanalysis)*
