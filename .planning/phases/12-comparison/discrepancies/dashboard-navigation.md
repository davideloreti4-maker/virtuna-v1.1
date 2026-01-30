# Dashboard & Navigation Discrepancies

**Reference:** `extraction/screenshots/desktop-fullpage/dashboard/01-dashboard-default.png`
**Virtuna:** `.planning/phases/12-comparison/virtuna-screenshots/dashboard/01-dashboard-default.png`
**Analysis Date:** 2026-01-30
**Plan:** 12-01

## Summary

- Total discrepancies: 18
- Critical: 2 | Major: 8 | Minor: 8

## Discrepancies

| ID | Component | Element | Issue | Type | Severity | Reference | Current | Fix Hint | File Path | Status |
|----|-----------|---------|-------|------|----------|-----------|---------|----------|-----------|--------|
| D-001-001 | Network Viz | connection-lines | Missing connection lines between dots | layout | Critical | Visible gray lines connecting dots | No lines visible | Add SVG line elements or Canvas path rendering | src/components/app/network-visualization.tsx | Open |
| D-001-002 | Network Viz | dot-clustering | Dots too scattered, not clustered naturally | layout | Critical | Clustered groups with clear connections | Random scatter pattern | Implement force-directed layout algorithm | src/components/app/network-visualization.tsx | Open |
| D-001-003 | Sidebar | background-color | Background color mismatch | color | Major | #0f0f10 (near black) | #1a1a1a (lighter gray) | Use bg-[#0f0f10] or darker shade | src/components/app/sidebar.tsx | Open |
| D-001-004 | Sidebar | section-label-style | "CURRENT SOCIETY" label styling differs | typography | Major | Smaller, more muted gray | Larger, bolder text | Reduce font-size to 10px, text-gray-500 | src/components/app/sidebar.tsx | Open |
| D-001-005 | Sidebar | society-dropdown | Dropdown styling differs | color | Major | Darker dropdown with subtle border | Lighter dropdown bg | Match bg-[#1a1a1a] with border-[#2a2a2a] | src/components/app/sidebar.tsx | Open |
| D-001-006 | Sidebar | nav-item-padding | Navigation item spacing differs | spacing | Minor | Tighter padding (~8px) | Larger padding (~12px) | Reduce py to py-2 | src/components/app/sidebar.tsx | Open |
| D-001-007 | Sidebar | nav-item-icons | Icon size/weight differs | typography | Minor | Smaller, lighter icons (~16px) | Larger icons (~20px) | Use h-4 w-4 for icons | src/components/app/sidebar.tsx | Open |
| D-001-008 | Sidebar | nav-items-list | Different nav items | layout | Major | Manage plan, Leave Feedback, What's new, Log Out | Settings, Manage plan, Leave Feedback, Product Guide, Log Out | Match reference nav items exactly | src/components/app/sidebar.tsx | Open |
| D-001-009 | Context Bar | pill-background | Filter pill background differs | color | Major | Darker pill bg (#1f1f1f) | Lighter transparent bg | Use bg-[#1f1f1f] border-[#3f3f3f] | src/components/app/context-bar.tsx | Open |
| D-001-010 | Context Bar | pill-text-color | Pill text color differs | color | Minor | White text | Gray/muted text | Use text-white for pill labels | src/components/app/context-bar.tsx | Open |
| D-001-011 | Context Bar | colored-dot-size | Colored indicator dots in pills | spacing | Minor | Smaller dots (~6px) | Larger dots (~8px) | Use w-1.5 h-1.5 for dots | src/components/app/context-bar.tsx | Open |
| D-001-012 | Context Bar | pill-border-radius | Border radius differs | spacing | Minor | More rounded (full pill) | Less rounded | Use rounded-full | src/components/app/context-bar.tsx | Open |
| D-001-013 | Header | create-test-button | "Create a new test" button position/style | layout | Major | Not visible in default state | Visible at top right | Move to sidebar or hide in default view | src/components/app/app-header.tsx | Open |
| D-001-014 | Network Viz | background-color | Main area background differs | color | Minor | Pure black (#000000) | Dark gray (#0a0a0a) | Use bg-black | src/components/app/network-visualization.tsx | Open |
| D-001-015 | Network Viz | dot-colors | Dot color palette differs slightly | color | Minor | Orange, blue, green, purple, red | Orange, blue, green, pink, cyan | Match exact hex colors from reference | src/components/app/network-visualization.tsx | Open |
| D-001-016 | Network Viz | dot-sizes | Dot size variation differs | spacing | Minor | 3 sizes: small, medium, large | 2 sizes: small, large | Add medium size variation | src/components/app/network-visualization.tsx | Open |
| D-001-017 | Sidebar | version-label | Version label positioning | layout | Major | Not visible | "Version 2.1" at bottom | Remove or match reference positioning | src/components/app/sidebar.tsx | Open |
| D-001-018 | Sidebar | logo-icon | Logo styling differs | typography | Major | Simple "A" icon | "N" icon with circle border | Match reference logo/icon | src/components/app/sidebar.tsx | Open |

## Category Breakdown

### Critical (2)
- **D-001-001**: Network connection lines missing - fundamental to visualization meaning
- **D-001-002**: Dot clustering pattern wrong - affects data representation

### Major (8)
- **D-001-003**: Sidebar background color
- **D-001-004**: Section label styling
- **D-001-005**: Dropdown styling
- **D-001-008**: Navigation items mismatch
- **D-001-009**: Context bar pill background
- **D-001-013**: Create test button visibility
- **D-001-017**: Version label visibility
- **D-001-018**: Logo icon mismatch

### Minor (8)
- **D-001-006**: Nav item padding
- **D-001-007**: Nav item icon size
- **D-001-010**: Pill text color
- **D-001-011**: Colored dot size
- **D-001-012**: Pill border radius
- **D-001-014**: Network viz background
- **D-001-015**: Dot colors palette
- **D-001-016**: Dot size variation

## Component Impact Analysis

### Network Visualization (src/components/app/network-visualization.tsx)
**Priority: HIGHEST**
- 2 Critical issues (connection lines, clustering)
- 3 Minor issues (background, colors, sizes)
- This component needs the most work to match reference

### Sidebar (src/components/app/sidebar.tsx)
**Priority: HIGH**
- 7 issues total (1 major: background, 4 major: styling/nav, 2 minor)
- Core navigation element visible on every screen

### Context Bar (src/components/app/context-bar.tsx)
**Priority: MEDIUM**
- 4 issues (1 major: pill background, 3 minor)
- Top bar filter pills styling

### App Header (src/components/app/app-header.tsx)
**Priority: MEDIUM**
- 1 Major issue (create test button placement)

## v0 Analysis Notes

**File path approach for v0 MCP:** Base64 encoding required for local file analysis.

**Reference styling extracted:**
- Sidebar: ~200px width, #0f0f10 background, #2a2a2a borders
- Network viz: Black background, connection lines in #333, clustered dot layout
- Context pills: #1f1f1f background, #3f3f3f border, rounded-full

**Virtuna current styling:**
- Sidebar: ~224px width, #1a1a1a background
- Network viz: #0a0a0a background, no connection lines
- Context pills: Transparent with border

## Recommended Fix Order

1. **D-001-001 & D-001-002** - Network visualization (Critical)
2. **D-001-003 & D-001-005** - Sidebar colors
3. **D-001-008** - Navigation items
4. **D-001-009** - Context bar pills
5. **D-001-018** - Logo icon
6. All minor issues in final polish pass

## Next Steps

1. Plan 02 will analyze forms comparison
2. Plan 03 will analyze results/modals comparison
3. Plan 04 will consolidate all discrepancies and create fix priority matrix
