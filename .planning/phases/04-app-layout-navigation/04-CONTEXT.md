# Phase 4: App Layout & Navigation - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the app shell and navigation structure — sidebar, main content area with network visualization, and route protection. This is the structural foundation that all app features (societies, tests, results) will live inside.

**Not in scope:** Society management (Phase 5), test forms (Phase 6), results display (Phase 7). Buttons/links for these features render but are UI-only.

</domain>

<decisions>
## Implementation Decisions

### Design Approach
- **1:1 pixel-perfect clone of societies.io reference**
- Use v0 MCP to generate components from reference screenshots
- Visual evaluation and verification after creating each major component
- Reference images in `.reference/app/_assets/`

### Sidebar Structure
- Claude's discretion on fixed vs collapsible (match reference)
- Claude's discretion on dropdown behavior (Society selector as modal, View selector as dropdown — match reference)
- Bottom nav items (Manage plan, Leave Feedback, Product Guide, Log Out) are **UI-only for now**
- "Create a new test" button behaves same as society selectors — UI shell only, functionality in later phases

### Network Visualization Area
- **Animated dot visualization** as placeholder (CSS/canvas dots with subtle movement, no real data)
- Top context bar **included with hardcoded demo data** (e.g., "Switzerland" label, filter pills)
- Filter pills (Executive Level, Mid Level, Senior Level, Entry Level) — Claude decides on interactivity (visual state toggle vs static)

### Mobile Adaptation
- Claude decides mobile sidebar pattern based on reference (likely hamburger → slide-out drawer)
- Claude decides visualization approach on mobile (full/simplified/hidden)
- Claude decides minimum screen width (likely 375px)

### Auth & Route Protection
- **Mock auth** — always logged in, no real Supabase auth checks in Phase 4
- Log Out button **redirects to landing page** (simulates logout)
- **Brief skeleton state** shown while "checking auth" (300-500ms) for polish

### Claude's Discretion
- Sidebar width and collapse behavior
- Dropdown/modal patterns for selectors
- Mobile navigation pattern
- Network visualization implementation details
- Filter pill interactivity level
- Minimum supported screen width
- Auth loading skeleton duration and style

</decisions>

<specifics>
## Specific Ideas

- **v0 MCP is mandatory** — use it to generate pixel-perfect components from reference screenshots
- Reference screenshots available at `.reference/app/_assets/dashboard-main.png`, `society-selector-open.png`, `view-selector-open.png`, etc.
- Visual verification checkpoint after each major component
- The app should feel exactly like societies.io — this is a clone, not an interpretation

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-app-layout-navigation*
*Context gathered: 2026-01-28*
