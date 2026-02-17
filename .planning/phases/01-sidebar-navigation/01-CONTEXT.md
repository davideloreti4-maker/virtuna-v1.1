# Phase 1: Sidebar & Navigation - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix sidebar design, navigation targets, and route integrity. Every sidebar element must be visually correct per brand bible and every button must navigate to the right place. This phase does NOT add new pages or features — it fixes what exists.

</domain>

<decisions>
## Implementation Decisions

### Navigation structure
- Remove "Content Intelligence" nav item — it duplicates Dashboard (same href: /dashboard)
- Final nav items in order: Dashboard, Trending, Referrals (top group), Pricing (bottom group)
- No section labels — flat list with separators only, Raycast style
- Keep current item ordering as-is
- "Referrals" stays as-is — Phase 6 handles the brand deals split/rename

### TikTok handle input
- Move TikTok account selector to top of sidebar, above nav items, in its own section
- Change from OAuth-based connection to simple text input — user types their @handle
- Save button required (not auto-save on blur)
- After saving: show @handle text only (no checkmark icon)
- Handle is saved to Supabase creator_profiles.tiktok_handle as before

### Sidebar visual style
- Replace glassmorphic background with solid dark (#07080a or surface token)
- Remove floating/inset layout — dock sidebar flush to left edge, full height (match Raycast)
- Remove rounded corners on sidebar container (flush = no rounding on left side)
- Active nav item: coral left-border or dot indicator + subtle background highlight (not filled bg)
- Keep 6% borders, Inter font, and other brand bible tokens

### Collapsed behavior
- Full hide when collapsed — sidebar slides completely off-screen
- No icon rail — maximizes content area
- Mobile overlay behavior stays as-is

### Claude's Discretion
- Exact padding/spacing values within brand bible constraints
- Separator placement between nav groups
- TikTok input field styling (follows brand bible input patterns: bg white/5%, border 0.05, radius 8px, height 42px)
- Transition/animation timing for sidebar open/close
- Avatar/account section styling at bottom

</decisions>

<specifics>
## Specific Ideas

- "Match Raycast completely on design language" — sidebar should look like it belongs in Raycast's app shell
- Active state should use coral accent indicator (left border or dot), not a filled background block
- Solid dark sidebar, not glass — Raycast doesn't use glassmorphism for chrome elements

</specifics>

<deferred>
## Deferred Ideas

- Brand Deals as separate page/nav item — Phase 6: Referrals & Brand Deals
- Settings nav item in sidebar — Phase 5 scope (currently accessed via account menu)

</deferred>

---

*Phase: 01-sidebar-navigation*
*Context gathered: 2026-02-16*
