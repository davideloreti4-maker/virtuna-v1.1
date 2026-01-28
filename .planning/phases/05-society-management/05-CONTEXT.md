# Phase 5: Society Management - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the society selector and creation flow. Users can select between Personal and Target societies, create new target societies with AI matching UI, and manage society cards with status badges. CRUD operations use mock/local state. Persistence in local storage.

</domain>

<decisions>
## Implementation Decisions

### Society Selector UX
- Claude's discretion: Personal vs Target section layout (reference societies.io)
- Claude's discretion: Selection feedback behavior (instant vs highlight)
- Claude's discretion: Current society indicator in sidebar
- Claude's discretion: Quick actions on cards (if any)

### Create Society Modal
- Claude's discretion: Form fields (reference societies.io structure)
- Claude's discretion: AI matching UI appearance (progress steps vs inline loading)
- Claude's discretion: Validation feedback timing (real-time vs on-submit)
- Claude's discretion: Post-creation behavior (auto-select vs return to selector)

### Society Cards Design
- Claude's discretion: Card information display (reference societies.io)
- Claude's discretion: Status badge types (reference societies.io patterns)
- Claude's discretion: Personal vs Target card differentiation
- Claude's discretion: Activity/timestamp display

### Empty States
- Claude's discretion: No-societies empty state design
- Tooltip hints for first-time users (Claude decides trigger logic)
- Claude's discretion: Personal Society "Needs Setup" state

### Claude's Discretion
Claude has full flexibility on all UI/UX decisions above. Reference societies.io for accuracy. Follow project-wide directive to use v0 MCP for design implementation.

</decisions>

<specifics>
## Specific Ideas

- **v0 MCP required**: Use v0 MCP tool for all UI component design to ensure pixel-perfect accuracy
- **Visual verification**: Include a verification checkpoint to confirm UI matches societies.io reference
- Tooltip hints for onboarding (not a full welcome modal)
- Existing mock data structure from Phase 4: Personal has platform/needsSetup; Target has type/icon/members

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-society-management*
*Context gathered: 2026-01-28*
