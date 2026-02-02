# Requirements — Virtuna v1.5 Trending Page

**Defined:** 2026-02-02
**Core Value:** Real-time viral video discovery with full storyboard remix capabilities

## v1.5 Requirements

Requirements for Trending Page milestone. Each maps to roadmap phases.

### Feed & Discovery (FEED)

- [ ] **FEED-01**: User can browse vertical list feed of trending TikTok videos (infinite scroll)
- [ ] **FEED-02**: Each video card shows thumbnail, title, creator, metrics, and category tags
- [ ] **FEED-03**: User can filter feed by category tabs (Challenges, Sounds, Formats, etc.)
- [ ] **FEED-04**: User can filter by AI-generated sub-tags within categories
- [ ] **FEED-05**: User can save/bookmark videos for later
- [ ] **FEED-06**: User sees trending velocity indicator (rising, peaked, declining)
- [ ] **FEED-07**: User can click video to open detail modal

### Analyze (ANLZ)

- [ ] **ANLZ-01**: User can analyze any trending video
- [ ] **ANLZ-02**: User sees viral score breakdown (same format as Predictor)
- [ ] **ANLZ-03**: User sees attention analysis for video
- [ ] **ANLZ-04**: User sees insights/explanation for why video is viral

### Remix & Storyboard (REMIX)

- [ ] **REMIX-01**: User can remix any trending video
- [ ] **REMIX-02**: User receives 2-3 customized script versions per remix
- [ ] **REMIX-03**: Each script includes hook, body, and CTA
- [ ] **REMIX-04**: Each script includes shot-by-shot filming instructions
- [ ] **REMIX-05**: Each script includes visual reference frames
- [ ] **REMIX-06**: User can view script in teleprompter mode
- [ ] **REMIX-07**: User can export storyboard as PDF
- [ ] **REMIX-08**: User can customize remix for their audience/goal

### Backend & Infrastructure (INFRA)

- [ ] **INFRA-01**: System integrates with Apify TikTok scraper
- [ ] **INFRA-02**: System applies quality filter to scraped videos
- [ ] **INFRA-03**: System caches video data for performance
- [ ] **INFRA-04**: System runs AI categorization pipeline on videos
- [ ] **INFRA-05**: System assigns fixed categories to each video
- [ ] **INFRA-06**: System generates sub-tags for each video
- [ ] **INFRA-07**: System calculates trending velocity for each video

### Navigation (NAV)

- [ ] **NAV-01**: Trending Page has dedicated sidebar item
- [ ] **NAV-02**: Sidebar item is visually distinct and discoverable

### UX Polish (UX)

- [ ] **UX-01**: Feed loading states are smooth and non-jarring
- [ ] **UX-02**: Category/filter changes are instant (optimistic UI)
- [ ] **UX-03**: Video detail modal has smooth open/close transitions
- [ ] **UX-04**: Remix generation shows progress indication
- [ ] **UX-05**: PDF export shows download progress
- [ ] **UX-06**: Empty states are helpful (no videos in category, etc.)

## v1.5.x Requirements (Future)

### Instagram Support
- **FEED-IG-01**: User can browse Instagram Reels in feed
- **FEED-IG-02**: System integrates with Apify Instagram scraper

### Advanced Features
- **ADV-01**: User can compare multiple videos side-by-side
- **ADV-02**: User can set notification for rising trends
- **ADV-03**: User can share storyboard via link

## Out of Scope

| Feature | Reason |
|---------|--------|
| Video editing | CapCut dominates; not our value prop |
| Scheduling/posting | Different product category |
| Social features | Community features deferred to later |
| Real-time notifications | Push infrastructure not in place |
| Video download | Copyright concerns, ToS issues |
| Instagram Reels | TikTok first, Instagram in v1.5.x |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FEED-01 | Phase 26 | Pending |
| FEED-02 | Phase 26 | Pending |
| FEED-03 | Phase 26 | Pending |
| FEED-04 | Phase 26 | Pending |
| FEED-05 | Phase 27 | Pending |
| FEED-06 | Phase 26 | Pending |
| FEED-07 | Phase 27 | Pending |
| ANLZ-01 | Phase 27 | Pending |
| ANLZ-02 | Phase 27 | Pending |
| ANLZ-03 | Phase 27 | Pending |
| ANLZ-04 | Phase 27 | Pending |
| REMIX-01 | Phase 28 | Pending |
| REMIX-02 | Phase 28 | Pending |
| REMIX-03 | Phase 28 | Pending |
| REMIX-04 | Phase 28 | Pending |
| REMIX-05 | Phase 29 | Pending |
| REMIX-06 | Phase 29 | Pending |
| REMIX-07 | Phase 29 | Pending |
| REMIX-08 | Phase 28 | Pending |
| INFRA-01 | Phase 25 | Pending |
| INFRA-02 | Phase 25 | Pending |
| INFRA-03 | Phase 25 | Pending |
| INFRA-04 | Phase 25 | Pending |
| INFRA-05 | Phase 25 | Pending |
| INFRA-06 | Phase 25 | Pending |
| INFRA-07 | Phase 25 | Pending |
| NAV-01 | Phase 30 | Pending |
| NAV-02 | Phase 30 | Pending |
| UX-01 | Phase 30 | Pending |
| UX-02 | Phase 30 | Pending |
| UX-03 | Phase 27 | Pending |
| UX-04 | Phase 28 | Pending |
| UX-05 | Phase 29 | Pending |
| UX-06 | Phase 30 | Pending |

**Coverage:**
- v1.5 requirements: 33 total
- Mapped to phases: 33/33
- Unmapped: 0

---
*Requirements defined: 2026-02-02*
*Last updated: 2026-02-02 — Traceability filled in after roadmap creation*
