# Phase 7: Simulation & Results - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the simulation flow from test submission to results display. Includes loading states during simulation, results panel with Impact Score, Attention breakdown, AI-generated Variants, Insights, and Conversation themes with sample quotes. Share functionality included.

</domain>

<decisions>
## Implementation Decisions

### Layout & Position
- Form floats at bottom of screen like a chat input
- Network visualization (node hive) visible behind the floating form
- Results appear in same floating position as the form — replacing the form area
- Must match societies.io view when choosing TikTok/Instagram scripts exactly
- Form collapses to show content preview when results appear, with results below

### Loading Sequence
- 4 phases: Analyzing content → Matching profiles → Running simulation → Generating insights
- Visual treatment: Progress steps with checkmarks (show all 4 steps, checkmark each as completed)
- Include thin progress bar alongside steps
- Loading appears inline in form area (below submit button)
- Network dots pulse/connect animation during loading to show "thinking" activity
- Cancel button available — users can abort and return to form

### Results Layout
- Results replace form area in floating position
- Impact Score display: Claude's discretion on visual treatment
- Attention breakdown: Horizontal stacked bar (Full/Partial/Ignore with colors)
- All sections expanded by default — user scrolls through
- Share Simulation button: Claude's discretion on prominence
- Scrolling behavior: Claude's discretion (fixed height internal scroll vs panel grows)
- New test / Re-run actions: Claude's discretion

### Variants Section
- Number of variants: Match societies.io reference
- Display format: Match societies.io reference (carousel/tabs vs vertical list)
- Actions per variant: Match societies.io (copy, use, etc.)
- Variant scores: Match societies.io (whether each variant shows impact score)

### Conversation Themes
- Organization: Match societies.io (sentiment-based or topic-based grouping)
- Quotes per theme: Match societies.io
- Persona attribution: Match societies.io (whether quotes show who said it)
- Expandability: Match societies.io (show more button or all upfront)

### Claude's Discretion
- Total loading sequence timing (4-6 seconds feels right)
- Form collapse/hide behavior during loading
- Impact Score visual treatment (large number vs gauge)
- Share button prominence
- Scrolling behavior for results panel
- New test / Re-run action presentation

</decisions>

<specifics>
## Specific Ideas

- "The input form is at the bottom floating position with the node hive in the background — same as societies view when choosing TikTok or Instagram scripts"
- "Results layout should appear at the exact position of the chat tab floating at the bottom of the screen"
- Critical: 100% accuracy match to societies.io reference throughout

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-simulation-results*
*Context gathered: 2026-01-29*
