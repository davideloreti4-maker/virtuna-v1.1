# Phase 52: Detail Modal & Bookmarks - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Video detail modal with TikTok embed, action buttons (Analyze/Bookmark/Remix), and bookmark persistence. Users can view video details, take actions, and save videos across sessions. Modal triggered by VideoCard click from Phase 51.

</domain>

<decisions>
## Implementation Decisions

### Modal Layout & Content
- **Layout arrangement:** Claude's discretion — pick responsive layout (side-by-side or stacked based on viewport)
- **Modal size:** Claude's discretion — choose lg or xl based on content needs
- **Metadata hierarchy:** Claude's discretion — design visual hierarchy for creator, views, likes, shares, date
- **Hashtag display:** Claude's discretion — GlassPill tags or inline text

### Action Button Behavior
- **Analyze button:** Navigate to `/viral-predictor` AND prefill with video URL/content from the current video
- **Bookmark feedback:** Icon toggle only (filled/unfilled), no toast notification
- **Remix button:** Disabled button with "Coming Soon" Badge next to it
- **Button arrangement:** Claude's discretion — grouped row or Analyze separate

### Bookmark UX
- **Card indicator:** Small filled bookmark icon overlay in corner of thumbnail
- **Saved tab placement:** After category tabs — Breaking Out | Sustained Viral | Resurging | Saved
- **Empty saved state:** Friendly message with illustration/icon + hint text ("No saved videos yet. Click the bookmark icon to save.")
- **Saved tab count:** No count badge, just "Saved" label

### Modal Interactions
- **Open animation:** Match Dialog component default animation
- **Close button:** No explicit X button — close via overlay click or escape key only
- **Keyboard navigation:** Left/right arrow keys navigate to prev/next video in current filter while modal is open
- **URL sync:** Claude's discretion — may add `?video=id` for shareable links if implementation is clean

### Claude's Discretion
- Modal layout arrangement (responsive)
- Modal size (lg vs xl)
- Metadata visual hierarchy
- Hashtag presentation style
- Action button arrangement
- URL sync for shareability

</decisions>

<specifics>
## Specific Ideas

- **v0 MCP is REQUIRED** for all UI design — every v0 prompt must include BRAND-BIBLE.md context with explicit token names, component names (Dialog, GlassCard, Button, Badge, GlassPill, Typography), color semantics (coral #FF7F50 accent), and spacing guidelines. Iterate with `v0_chat_complete` until Raycast-quality. Integrate by replacing v0 approximations with actual design system imports.
- Keyboard navigation (arrow keys) makes browsing feel fluid like a lightbox gallery
- No explicit close button keeps the modal minimal — overlay click and escape are sufficient
- Bookmark icon overlay on thumbnail follows the pattern of video platforms (YouTube, TikTok saved collections)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 52-detail-modal-bookmarks*
*Context gathered: 2026-02-06*
