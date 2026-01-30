# Phase 11: Extraction - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete screenshot and video coverage of every screen, state, and interactive element in app.societies.io via Playwright automation. This is the foundation for comparison — no analysis or fixes happen here, just comprehensive capture.

</domain>

<decisions>
## Implementation Decisions

### Coverage scope
- Capture the complete app — all features, buttons, modals, dropdowns
- Test complete user flows and capture each step
- Always scroll to bottom of page (top banner may push content down)
- Capture everything visible on each screen

### Viewports
- Desktop: 1440px width
- Mobile: 375px width
- Both viewports for all key screens

### Interactive states
- Capture every state for interactive elements:
  - Dropdowns: open, closed, hover
  - Forms: empty, filled, validation error
  - Buttons: default, hover, focus, disabled
  - Modals: opened states
  - Loading states where applicable

### Authentication
- Use existing browser session (extract cookies from logged-in browser)
- Playwright will load authenticated state from saved session

### Video capture
- Full session recordings alongside screenshots
- Record complete user flow videos to capture:
  - Animation timing and easing
  - Transition effects between states
  - Loading animations and spinners
  - Hover/interaction micro-animations
- Videos provide reference for animation matching in Phase 13

### Claude's Discretion
- Folder structure and naming conventions (organize for easy lookup during comparison)
- Exact scroll behavior implementation
- Video format and quality settings
- Playwright script architecture

</decisions>

<specifics>
## Specific Ideas

- "The app page has a banner on top — always scroll to bottom to capture everything"
- Complete user flows should be captured step-by-step
- Output must be properly structured for Phase 12 comparison work

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-extraction*
*Context gathered: 2026-01-30*
