# Phase 46: Forms & Modals Migration — Context

**Created:** 2026-02-05
**Phase goal:** All form inputs and modal dialogs across the dashboard use design system components with consistent behavior.
**Requirements:** FORM-01, FORM-02, FORM-03, FORM-04, FORM-05, MODL-01, MODL-02, MODL-03, MODL-04, MODL-05

---

## UI Generation Approach

**v0 MCP is the primary tool for generating all UI in this phase.** Every form and modal component must be generated through v0, guided by the brand bible (`.planning/BRAND-BIBLE.md`) and existing showcase screenshots.

When prompting v0:
- Provide the full brand bible as context
- Reference specific design system primitives by name (GlassTextarea, GlassInput, Dialog, GlassCard, Button, Select)
- Include relevant screenshots of existing components for visual consistency
- Specify the glassmorphic dark theme explicitly (bg-base #0A0A0B, surface-elevated, white/10 borders)
- Reference form component section (Section 10) and button system (Section 9) from brand bible

---

## 1. Form Validation & Error States

### Validation timing
- **On blur + on submit.** Validate each field when user leaves it (blur), then full form validation on submit.
- After a field has been flagged invalid, re-validate on change (clear error as soon as input becomes valid). This gives immediate positive feedback without being noisy before the first interaction.

### Error display
- **Inline text below field.** Small error text directly under the invalid input. No border color change on the input itself — the text alone signals the error.
- No form-level error summary. Each field handles its own error display.

### Error tone
- **Neutral and concise** — matches Raycast's direct, no-nonsense voice. Examples:
  - "Required"
  - "At least 10 characters"
  - "Enter a valid URL"
- No personality, no exclamation marks, no "please".

### Character counter
- Show counter on textareas only when within 20% of max length. Format: `42/500`. Positioned bottom-right of the textarea. Uses `text-tertiary` color, shifts to error color when at/over limit.

### Submit loading state
- Submit button shows a Spinner inside and is disabled while request is in flight. Other form fields remain interactive (user can review their input). The button text is replaced by the spinner, maintaining button dimensions.

### Success behavior
- Modal closes silently after successful submission. The new item appearing in the UI is sufficient feedback. No toast, no inline message.

---

## 2. Modal Behavior & Animations

### Open/close animation
- **Fade + scale up.** Modal fades in from 0 opacity and scales from 95% to 100%. Duration: 200ms with ease-out-cubic. Close is the reverse (fade out + scale down to 95%).
- Respect `prefers-reduced-motion` — instant show/hide with no animation.

### Backdrop
- **Dark semi-transparent overlay** — black at ~50% opacity. Clean separation without adding another backdrop-filter layer (stays within the 2-3 glass layers budget). Backdrop fades in with the modal.

### Mobile behavior
- **Case-by-case:** Simple modals (delete confirmation, leave feedback) stay centered as smaller cards. Complex modals with forms (create society, content form) render as bottom sheets taking ~60-70% of screen height.
- All modals: min touch targets 44x44px, padding increases slightly on mobile.

### Scroll lock
- **Yes, lock body scroll** when any modal is open. Restore on close.

### Close behavior (all modals)
- Close via: overlay click, Escape key, explicit close/cancel button
- Escape works regardless of which element is focused inside the modal
- For modals with forms: if form has been modified (dirty), show a lightweight "Discard changes?" confirmation before closing. If form is untouched, close immediately.

### Focus management
- Focus is trapped inside the modal while open (tab cycling)
- On open: auto-focus the first interactive element (first input for forms, primary button for confirmations)
- On close: return focus to the element that triggered the modal

---

## 3. TestTypeSelector Card Grid

### Layout
- Renders inside a Dialog component
- **Claude decides column count** based on number of test types and available space (likely 2-col for 4 types, 3-col for 6+)
- Cards use responsive grid: 1-col on mobile, 2-3 col on desktop

### Card content
- Each card shows: **icon + title + description + badge**
  - Icon: Phosphor icon, 32px, `regular` weight
  - Title: Satoshi semibold, body size
  - Description: 1-line, `text-secondary`, body-small
  - Badge: optional, for "Popular" or "New" labels. Uses design system Badge component
- Cards use GlassCard with `hover="lift"` and appropriate tint per test type

### Selection feedback
- **Claude decides** — should fit the glass design system. Likely coral border/glow on selected card, consistent with accent patterns in brand bible.

### Selection flow
- **Immediate proceed.** Click a card → instantly opens the form for that test type. No intermediate confirmation step. One less click.

---

## 4. Input Focus & Keyboard Flow

### Auto-focus
- Forms auto-focus the first input when modal opens. User is ready to type immediately.

### Tab order
- Natural DOM order: inputs → selects → textareas → buttons (submit, then cancel)
- No custom tabIndex unless necessary for logical order

### Enter key
- **Enter submits** when focus is on a single-line input (`<input>`)
- Enter does NOT submit when focus is in a textarea (newline behavior preserved)
- No Cmd/Ctrl+Enter — keep it simple

### Focus ring style
- **Claude decides** — should match the design system. Brand bible specifies `ring-2 ring-accent` for focus states. Implementation should be consistent across all form inputs.

### Escape key
- Escape closes the modal (see Modal section above for dirty-form confirmation logic)

---

## Deferred Ideas

_None surfaced during discussion._

---

## Scope Boundary

This phase migrates existing forms and modals to design system components. It does NOT:
- Add new forms or modals that don't exist today
- Change form field requirements or business logic
- Add new validation rules beyond what exists
- Redesign form layouts (structure stays the same, components change)
