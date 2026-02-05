# Phase 41: Extended Components + Raycast Patterns - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Build secondary UI components (Modal/Dialog, Select, Toggle, Toast, Tooltip, Tabs) and Raycast-specific visual patterns (keyboard key caps, shortcut badges). All components integrate with the existing token system from Phase 39-40. Command palette as a full feature is out of scope — only the visual building blocks are delivered here.

</domain>

<decisions>
## Implementation Decisions

### Modal/Dialog behavior
- Match Raycast's modal glass styling exactly — extract their blur, opacity, and border values
- Overlay: match Raycast's treatment (dark scrim + blur as they use it)
- Click-outside dismisses the modal (plus ESC key)
- Size variants: Claude's discretion — determine appropriate sizes from Raycast patterns

### Select & form controls
- Dropdown rendering style: Claude's discretion — match Raycast's select pattern
- Two variants: simple Select for short lists, SearchableSelect (type-to-filter) for long lists
- Toggle/Switch: pixel-match Raycast's exact styling (pill shape, slide animation, sizes, colors)
- Tabs component: Claude's discretion on inclusion based on phase scope

### Keyboard & shortcut visuals
- Key caps: pixel-match Raycast's rendering (rounded rect, gradient, inner shadow, exact border radius)
- Modifier key symbols vs text: Claude's discretion
- Shortcut badge placement (inline vs standalone): Claude's discretion
- Command palette component: Claude's discretion on whether building blocks only or a basic palette fits this phase

### Toast & feedback patterns
- Toast position: match Raycast's feedback pattern (Claude determines best web equivalent of Raycast's inline feedback)
- Toast action buttons: Claude's discretion
- Auto-dismiss timing: Claude's discretion
- Tooltip component: Claude's discretion on inclusion

### Claude's Discretion
- Modal size variants (small/medium/large or single size)
- Select dropdown rendering approach (floating popover vs inline)
- Whether to include Tabs and Tooltip components
- Modifier key rendering (symbols vs text vs both)
- Shortcut badge inline/standalone flexibility
- Whether to include a basic CommandPalette or just building blocks (KeyCap, ShortcutBadge)
- Toast position, action support, and timing strategy
- Animation easing and duration for all new components

</decisions>

<specifics>
## Specific Ideas

- Consistent theme: "match Raycast exactly" — user wants pixel-level fidelity for all visual components, not approximations
- Key caps are an iconic Raycast element — these should feel instantly recognizable
- Toggle should replicate Raycast's settings page switch exactly
- Glass styling on modals should use the same values as Raycast's command palette overlay

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 41-extended-components-raycast-patterns*
*Context gathered: 2026-02-05*
