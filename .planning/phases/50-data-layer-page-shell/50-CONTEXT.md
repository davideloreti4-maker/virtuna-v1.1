# Phase 50: Data Layer & Page Shell - Context

**Gathered:** 2026-02-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Create the `/trending` route with mock data layer, category tabs, and filtering. This is the structural foundation — no video cards, no detail modal, no bookmarks. Those build on top in Phases 51 and 52.

</domain>

<decisions>
## Implementation Decisions

### Page layout & structure
- Max-width container (e.g. ~1280px), centered within AppShell — breathing room on ultrawide
- Heading + stats bar: "Trending" Typography heading with a summary stats row below
- Stats bar shows both category counts ("Breaking Out (8) · Trending Now (7) · Rising Again (6)") AND aggregate metrics (total videos, total views)
- Stats bar stays visible with zeroed values when a tab is empty — no layout shift
- Only tabs are sticky on scroll — heading and stats bar scroll away naturally
- Generous & breathable spacing — premium feel, not data-dense
- Sidebar nav item added for /trending

### Category tabs
- Three categories renamed: **Breaking Out** → **Trending Now** → **Rising Again**
- Tab order: Breaking Out first (default), Trending Now second, Rising Again third
- Default tab: Breaking Out (when no URL param set)
- Active tab syncs with URL search params (e.g. `/trending?tab=breaking-out`) — shareable, back/forward works
- No count badges on tabs — counts are already in the stats bar
- Tab labels only, clean

### Tab transition
- Brief skeleton flash (~200-300ms) when switching tabs — simulates real data fetch UX
- Prepares for future real API integration

### Claude's Discretion
- Tab transition animation style (fade, instant swap, etc.)
- Exact tab visual styling (underline vs pill vs background fill with coral accent)
- Keyboard navigation for tabs
- Stats bar exact layout and metric formatting

</decisions>

<specifics>
## Specific Ideas

### Mock data shape & realism
- 12-15 videos per category (~40 total) — substantial enough to test infinite scroll
- Mixed/general TikTok niches: food, dance, comedy, DIY, life hacks, tech, fitness — realistic trending page variety
- Real placeholder images via picsum.photos or similar service for thumbnails
- Real TikTok URLs included in mock data — will work as actual embeds in Phase 52 detail modal
- Full metadata per video: id, title, thumbnail, creator, views, likes, shares, date, category, hashtags, tiktokUrl, velocity
- Realistic value ranges for metrics (views, likes, shares)

### Loading & empty states
- Initial page load: skeleton cards in the grid shape — previews layout before data
- Tab switching: brief skeleton flash (~200-300ms) for realistic UX
- Empty tab state: illustrated empty state with icon + personality message (e.g. "No videos breaking out right now")

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 50-data-layer-page-shell*
*Context gathered: 2026-02-05*
