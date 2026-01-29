# Phase 6: Test Type Selector & Forms - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the test creation flow: a modal to select one of 11 test types (organized in 5 categories), and the corresponding form for content input. TikTok Script and Instagram Post forms are functional; other forms are UI only. Help Me Craft and Upload Images buttons are UI only.

</domain>

<decisions>
## Implementation Decisions

### Type Selector Layout
- Match societies.io exactly using v0 MCP
- Modal organization (categories, grid, cards) — copy societies.io
- Post-selection flow (modal close vs transition) — copy societies.io
- Back/change type mechanism — copy societies.io
- Card content (icon, name, description) — copy societies.io

### Form Structure
- All 10 "content" forms — match societies.io exactly
- Survey form (unique structure) — match societies.io exactly
- Validation timing (inline vs submit) — match societies.io
- Submit button text — match societies.io

### TikTok/Instagram Forms (Functional)
- Post-submit behavior — match societies.io flow
- Data persistence for history — match societies.io
- Platform-specific fields — match societies.io differences
- Character/word limits with live counter — match societies.io

### Help Me Craft / Upload Buttons (UI Only)
- Click behavior — match societies.io exactly
- Button positioning in form — match societies.io layout
- Icon usage — match societies.io

### Claude's Discretion
- Component file organization
- State management approach (local vs Zustand)
- Form library choice (if any)

</decisions>

<specifics>
## Specific Ideas

- **Primary directive:** Use v0 MCP to match societies.io pixel-perfect
- This is a pixel-perfect clone — every UI decision references societies.io
- No creative freedom on visual design; implementation follows reference exactly

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-test-type-selector-forms*
*Context gathered: 2026-01-29*
