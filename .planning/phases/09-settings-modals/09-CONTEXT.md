# Phase 9: Settings & Modals - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Build settings screens and modals for user profile, account settings, notification preferences, billing UI, team management, feedback collection, and product guide link. All forms use local/mock state — no backend persistence in this phase.

</domain>

<decisions>
## Implementation Decisions

### Settings page structure
- Access from sidebar bottom (near logout) — no avatar dropdown
- Claude's discretion on page vs modal layout (match societies.io)
- Claude's discretion on tabs/sections vs separate routes
- Claude's discretion on team member display format

### Form behavior
- Match societies.io patterns entirely
- Claude's discretion on save mechanism (explicit vs auto-save)
- Claude's discretion on success feedback pattern
- Claude's discretion on unsaved changes handling

### Modal patterns
- Claude's discretion on Leave Feedback modal design
- Claude's discretion on feedback trigger location
- Claude's discretion on empty team state messaging
- Claude's discretion on navigation confirmation dialogs

### Billing UI
- Claude's discretion on billing info display depth
- Claude's discretion on Stripe portal behavior (new tab vs redirect)
- Claude's discretion on upgrade prompt placement
- Claude's discretion on credits/usage display location

### Claude's Discretion
Essentially all UI/UX decisions are delegated to Claude with the directive to match societies.io patterns. Research the live site to determine:
- Settings page structure and navigation
- Form behavior and feedback patterns
- Modal designs and placements
- Billing UI layout and information displayed

</decisions>

<specifics>
## Specific Ideas

**CRITICAL: v0 MCP for all UI design**
- All settings screens, modals, and components MUST be designed using v0 MCP
- Query v0 with reference screenshots from societies.io before implementing
- This ensures pixel-perfect design accuracy

**User-specified access point:**
- Settings link in sidebar bottom area (near logout button)
- NOT from avatar dropdown

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-settings-modals*
*Context gathered: 2026-01-29*
