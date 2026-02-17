# Requirements Archive: competitors-tool Competitors Tool

**Archived:** 2026-02-17
**Status:** SHIPPED

For current requirements, see `.planning/REQUIREMENTS.md`.

---

# Requirements: Virtuna Competitors Tool

**Defined:** 2026-02-16
**Core Value:** AI-powered competitor intelligence that shows TikTok creators exactly what their competitors do, why it works, and how to outperform them.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Competitor Management

- [x] **COMP-01**: User can add a competitor by pasting their TikTok @handle
- [x] **COMP-02**: System validates handle exists and fetches initial profile data via Apify scraping
- [x] **COMP-03**: User can view all tracked competitors in a card grid layout with avatar, handle, follower count, and engagement rate
- [x] **COMP-04**: User can switch between grid and table/leaderboard view of competitors
- [x] **COMP-05**: User can remove a tracked competitor with confirmation dialog
- [x] **COMP-06**: User can click into a competitor to see their full profile detail page

### Growth Metrics

- [x] **GROW-01**: Competitor cards display current follower count, total likes, and total video count
- [x] **GROW-02**: Competitor detail page shows follower growth over time as a line chart (from daily snapshots)
- [x] **GROW-03**: System computes and displays average views per video (last 30 videos)
- [x] **GROW-04**: Competitor cards show growth velocity delta indicators (e.g., "+12% this week") with green/red coloring
- [x] **GROW-05**: Competitor cards include sparkline mini-charts showing growth trend direction at a glance
- [x] **GROW-06**: System runs scheduled re-scraping (cron) to collect daily follower/engagement snapshots for time-series data

### Engagement Metrics

- [x] **ENGM-01**: System computes engagement rate per video using formula: (likes + comments + shares) / views * 100
- [x] **ENGM-02**: Competitor detail page shows per-video engagement breakdown (likes, comments, shares, views)
- [x] **ENGM-03**: Competitor detail page displays average engagement rate across recent videos

### Content Analysis

- [x] **CONT-01**: Competitor detail page shows top-performing videos ranked by views or engagement rate
- [x] **CONT-02**: System analyzes and displays posting frequency/cadence (posts per week/month)
- [x] **CONT-03**: System extracts and ranks hashtags from competitor video captions with frequency counts
- [x] **CONT-04**: Competitor detail page shows recent videos feed (last 20 videos, chronological)
- [x] **CONT-05**: System computes and displays best posting time analysis as a day-of-week x hour heatmap
- [x] **CONT-06**: System analyzes video duration distribution and displays format breakdown (< 15s, 15-60s, 1-3min, 3min+)

### Comparison & Benchmarking

- [x] **BENCH-01**: User can select 2 competitors for side-by-side comparison view showing key metrics in parallel columns
- [x] **BENCH-02**: User can compare their own TikTok stats vs a competitor (using @handle from onboarding)
- [x] **BENCH-03**: User can view a sortable leaderboard table ranking all tracked competitors by any metric (followers, growth rate, engagement, posting frequency)

### AI-Powered Intelligence

- [x] **INTL-01**: System generates deep AI analysis of a competitor's content strategy — identifying hooks, patterns, psychological triggers, and content series that drive engagement
- [x] **INTL-02**: When a competitor video goes viral (exceeds their average views by 3x+), system surfaces it with an AI-generated "why it worked" breakdown
- [x] **INTL-03**: System performs hashtag gap analysis comparing user's hashtags vs competitor's, surfacing actionable recommendations
- [x] **INTL-04**: System generates personalized actionable recommendations (format, timing, hooks, content style) based on competitor analysis
- [x] **INTL-05**: AI insights are displayed on the competitor detail page in a dedicated intelligence section

### Data Pipeline

- [x] **DATA-01**: Supabase schema with competitor_profiles, competitor_snapshots, and competitor_videos tables with proper RLS policies
- [x] **DATA-02**: Apify integration for profile scraping (followers, likes, video count, avatar, bio)
- [x] **DATA-03**: Apify integration for video scraping (per-video metrics, captions, timestamps, hashtags, duration)
- [x] **DATA-04**: Scraping deduplicates by unique handle across all users (scrape once, serve to all trackers)
- [x] **DATA-05**: Zod validation schemas for all scraped data at ingestion boundary
- [x] **DATA-06**: Vercel cron route for scheduled batch re-scraping of all tracked competitors

### UI Polish

- [x] **UI-01**: Loading skeleton states for competitor cards, detail page, and charts
- [x] **UI-02**: Empty state when user has no tracked competitors with clear CTA to add first
- [x] **UI-03**: Stale data indicators showing when data was last refreshed
- [x] **UI-04**: Error states for failed scrapes with retry option
- [x] **UI-05**: Mobile responsive layout for all competitor views
- [x] **UI-06**: Competitors page accessible via sidebar navigation

## Future Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Discovery

- **DISC-01**: User can search for TikTok creators by name or keyword
- **DISC-02**: System suggests competitors based on user's niche and content goals from onboarding

### Advanced Intelligence

- **ADVN-01**: "Watch this creator" alerts when competitor posts viral content or hits growth spike
- **ADVN-02**: Content pillar breakdown categorizing competitor content into themes
- **ADVN-03**: Multi-competitor comparison (3+ side-by-side)
- **ADVN-04**: Competitor "report card" summary with strengths/weaknesses
- **ADVN-05**: Sound/audio tracking for trending sounds competitors use

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multi-platform support (Instagram, YouTube, X) | TikTok-only focus — depth over breadth |
| Influencer discovery / marketplace | Agency feature, not creator-first |
| Campaign tracking / ROI measurement | Brand/agency metric |
| PDF report generation | Agency deliverable — dashboards are the product |
| Sentiment analysis on comments | HIGH complexity, LOW value for individual creators |
| Share of voice metrics | Agency metric — use leaderboard instead |
| Ad/promoted post detection | Brand-side tool, not creator-side |
| White-label / team features | Individual creator tool |
| Real-time live monitoring | Daily/twice-daily refresh is sufficient |
| Follower list scraping | Privacy-invasive, TOS risk |
| DM/outreach automation | Different product category entirely |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| COMP-01 | Phase 2 | Shipped |
| COMP-02 | Phase 2 | Shipped |
| COMP-03 | Phase 3 | Shipped |
| COMP-04 | Phase 3 | Shipped |
| COMP-05 | Phase 2 | Shipped |
| COMP-06 | Phase 4 | Shipped |
| GROW-01 | Phase 3 | Shipped |
| GROW-02 | Phase 4 | Shipped |
| GROW-03 | Phase 4 | Shipped |
| GROW-04 | Phase 3 | Shipped |
| GROW-05 | Phase 3 | Shipped |
| GROW-06 | Phase 2 | Shipped |
| ENGM-01 | Phase 4 | Shipped |
| ENGM-02 | Phase 4 | Shipped |
| ENGM-03 | Phase 4 | Shipped |
| CONT-01 | Phase 4 | Shipped |
| CONT-02 | Phase 4 | Shipped |
| CONT-03 | Phase 4 | Shipped |
| CONT-04 | Phase 4 | Shipped |
| CONT-05 | Phase 4 | Shipped |
| CONT-06 | Phase 4 | Shipped |
| BENCH-01 | Phase 5 | Shipped |
| BENCH-02 | Phase 5 | Shipped |
| BENCH-03 | Phase 5 | Shipped |
| INTL-01 | Phase 6 | Shipped |
| INTL-02 | Phase 6 | Shipped |
| INTL-03 | Phase 6 | Shipped |
| INTL-04 | Phase 6 | Shipped |
| INTL-05 | Phase 6 | Shipped |
| DATA-01 | Phase 1 | Shipped |
| DATA-02 | Phase 1 | Shipped |
| DATA-03 | Phase 1 | Shipped |
| DATA-04 | Phase 1 | Shipped |
| DATA-05 | Phase 1 | Shipped |
| DATA-06 | Phase 2 | Shipped |
| UI-01 | Phase 3 | Shipped |
| UI-02 | Phase 3 | Shipped |
| UI-03 | Phase 7 | Shipped |
| UI-04 | Phase 7 | Shipped |
| UI-05 | Phase 7 | Shipped |
| UI-06 | Phase 3 | Shipped |

**Coverage:**
- v1 requirements: 41 total
- Mapped to phases: 41
- Unmapped: 0

---
*Requirements defined: 2026-02-16*
*Last updated: 2026-02-16 -- Traceability updated after roadmap creation*
