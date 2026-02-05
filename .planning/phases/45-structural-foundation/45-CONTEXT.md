# Phase 45: Structural Foundation (AppShell + Sidebar) - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Rebuild the AppShell layout with a floating glassmorphic sidebar that works across desktop and mobile viewports. Sidebar includes navigation items and test history. Collapse behavior with persistence and mobile toggle are established here. SocietySelector and ViewSelector are removed — navigation restructured around page-level selectors.

</domain>

<decisions>
## Implementation Decisions

### Sidebar visual style
- Floating panel inset from all viewport edges (visible gap on all sides, Raycast style)
- Wide sidebar (~300px expanded width)
- Subtle semi-transparent border + backdrop blur (matching existing GlassPanel)
- Smooth slide transition (~200-300ms ease curve) for open/close/collapse
- Match Raycast's sidebar aesthetic as the primary visual reference

### Navigation structure
- SocietySelector and ViewSelector removed from sidebar
- Top-level page: "Content Intelligence" as the main dashboard tool
- Sub-pages under it: "Trending Feed" and "Brand Deals" as secondary nav items
- Active item indicated by filled background highlight (Raycast active command style)
- Flat list with visual separators between logical groups (no section headers)
- Test history list rendered below nav items, filling remaining sidebar space

### Mobile behavior
- Hamburger toggle fixed in top-left corner
- Sidebar slides in from the left with dimmed overlay behind
- Close via tapping dimmed overlay or hamburger button — no swipe gesture
- Glassmorphic blur preserved on mobile (uses 1 of 2 backdrop-filter budget slots per MOBL-03)

### Collapse behavior
- Collapsed = fully hidden (no icon-only mode) on both desktop and mobile
- Dedicated collapse button within the sidebar to trigger hide
- Persistent floating toggle button in top-left corner when sidebar is hidden (same position as mobile hamburger)
- Collapsed/expanded state persisted across page refresh

### Claude's Discretion
- Exact inset spacing/gap values around the floating panel
- Z-index scale establishment
- Collapse button icon and exact placement within sidebar
- Test history item density and scroll behavior
- Main content push animation timing relative to sidebar

</decisions>

<specifics>
## Specific Ideas

- Raycast sidebar is the primary visual reference — match its floating panel aesthetic, spacing, and polish
- "Content Intelligence" is the top-level tool, with "Trending Feed" and "Brand Deals" as sub-pages beneath it
- Toggle button position is consistent between mobile hamburger and desktop collapsed state (top-left)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 45-structural-foundation*
*Context gathered: 2026-02-05*
