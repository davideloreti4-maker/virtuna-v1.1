# Phase 7: Upload & Input UI - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can upload videos, paste TikTok URLs, or enter text through a tabbed content form with 3 input modes. This replaces the existing content form in-place. Creating new API endpoints or modifying the analysis pipeline is out of scope — this phase wires UI to the existing /api/analyze route.

</domain>

<decisions>
## Implementation Decisions

### Tab design & switching
- Tab style is Claude's discretion — pick what fits the Raycast aesthetic best
- Switching tabs preserves all input across tabs (no clearing on switch)
- Default selected tab on load: Text (most common use case)
- Submit button label: generic "Test" always (not dynamic per tab)

### Video upload experience
- Empty state: solid subtle zone (bg-white/[0.03]) with upload icon, not dashed border
- After upload: video thumbnail + metadata (filename, file size, duration badge) — no inline player
- Upload progress: thin progress bar overlay on the upload zone
- File size limit: 200MB
- Drag-drop supported on the upload zone

### TikTok URL input
- Fetch and show preview after pasting valid URL (thumbnail, caption snippet, creator name)
- Accepted formats: full tiktok.com/... and vm.tiktok.com/... URLs, plus @handle/video/ID partial format
- Invalid/unreachable URLs: inline error text below the input field
- URL tab is URL-only — no optional text context fields alongside

### Form layout & flow
- Replace existing content form in-place (tabs added at top of current form)
- Text tab: structured fields — caption textarea, niche dropdown, hashtags input, optional notes
- Video tab: upload zone + same structured context fields (niche, hashtags, caption) below
- Validation: on submit only (not live) — show errors inline if invalid

### Claude's Discretion
- Tab component style (segmented control, underlined tabs, etc.)
- Exact upload zone icon and copy
- Thumbnail extraction method
- URL preview fetch mechanism and loading state
- Field ordering and spacing within each tab
- Error message copy

</decisions>

<specifics>
## Specific Ideas

- Button says "Test" not "Analyze" — matches the product language ("test your content")
- Video thumbnail + metadata preview keeps the UI informative without the weight of an embedded player
- Solid subtle upload zone (not dashed border) stays consistent with Raycast's clean aesthetic

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-upload-input-ui*
*Context gathered: 2026-02-16*
