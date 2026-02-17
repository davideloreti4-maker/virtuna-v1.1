# Roadmap: Virtuna Competitors Tool

## Overview

Build a full competitor intelligence tracker for TikTok creators -- from database schema and scraping infrastructure through interactive dashboards, analytics charts, benchmarking views, and AI-powered strategy insights. The journey starts with data foundation (schema + Apify scraping), layers on competitor CRUD and scheduling, builds the dashboard and detail pages with rich analytics, adds comparison/benchmarking capabilities, integrates AI intelligence, and finishes with cross-cutting polish.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Data Foundation** - Database schema, Apify scraping service, Zod validation, deduplication logic *(completed 2026-02-16)*
- [x] **Phase 2: Competitor Management** - Add/remove competitors, handle validation, cron scheduling, webhook handling *(completed 2026-02-16)*
- [x] **Phase 3: Competitor Dashboard** - Card grid, table/leaderboard view, stats display, sidebar nav, loading/empty states *(completed 2026-02-16)*
- [x] **Phase 4: Detail Page & Analytics** - Competitor detail page with growth charts, engagement breakdown, content analysis sections *(completed 2026-02-16)*
- [x] **Phase 5: Benchmarking & Comparison** - Side-by-side comparison, self-benchmarking, sortable leaderboard *(completed 2026-02-17)*
- [ ] **Phase 6: AI Intelligence** - Strategy analysis, viral detection, hashtag gap analysis, actionable recommendations
- [ ] **Phase 7: Polish & Edge Cases** - Stale data indicators, error states with retry, mobile responsive layout

## Phase Details

### Phase 1: Data Foundation
**Goal**: Real TikTok data flows into a well-structured database through validated scraping pipelines
**Depends on**: Nothing (first phase)
**File Ownership**: `supabase/migrations/`, `src/lib/scraping/`, `src/lib/schemas/`, `src/lib/supabase/`
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05
**Success Criteria** (what must be TRUE):
  1. Supabase migration creates competitor_profiles, competitor_snapshots, and competitor_videos tables with RLS policies using `(select auth.uid())` pattern
  2. Apify profile scraper fetches follower count, total likes, video count, avatar, and bio for a given TikTok handle
  3. Apify video scraper fetches per-video metrics (views, likes, comments, shares), captions, timestamps, hashtags, and duration
  4. Scraping deduplicates by unique handle -- two users tracking the same creator triggers only one scrape
  5. All scraped data passes through Zod validation schemas at ingestion boundary before database insertion
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md -- Database schema migration (4 tables, RLS policies, indexes, triggers) and service role client
- [ ] 01-02-PLAN.md -- Apify scraping service with ScrapingProvider abstraction, Zod validation schemas, handle normalization

### Phase 2: Competitor Management
**Goal**: Users can add and remove competitors with real data flowing in on a schedule
**Depends on**: Phase 1
**File Ownership**: `src/app/api/competitors/`, `src/app/actions/competitors/`, `src/app/(app)/competitors/`, `vercel.json`
**Requirements**: COMP-01, COMP-02, COMP-05, DATA-06, GROW-06
**Success Criteria** (what must be TRUE):
  1. User can paste a TikTok @handle and the system validates it exists, fetches initial profile + video data, and adds it to their tracked list
  2. User can remove a tracked competitor via confirmation dialog and it disappears from their list
  3. Vercel cron route triggers daily batch re-scraping of all tracked competitors, collecting fresh follower/engagement snapshots for time-series
  4. Scraping failures for individual handles do not block the batch -- failed handles are logged and skipped
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md -- Add/remove competitor server actions with junction table deduplication and handle validation
- [ ] 02-02-PLAN.md -- Cron auth utility, batch re-scraping route, and vercel.json cron schedule

### Phase 3: Competitor Dashboard
**Goal**: Users see all their tracked competitors at a glance with key stats and can navigate between views
**Depends on**: Phase 1, Phase 2
**File Ownership**: `src/app/(app)/competitors/page.tsx`, `src/components/competitors/`, `src/stores/competitors.ts`
**Requirements**: COMP-03, COMP-04, GROW-01, GROW-04, GROW-05, UI-01, UI-02, UI-06
**Success Criteria** (what must be TRUE):
  1. User sees all tracked competitors in a card grid showing avatar, handle, follower count, total likes, video count, engagement rate, growth velocity delta (green/red), and sparkline trend
  2. User can toggle between card grid view and table/leaderboard view
  3. Empty state with clear CTA appears when user has no tracked competitors
  4. Loading skeleton states display while data is being fetched for cards, table, and page shell
  5. Competitors page is accessible via sidebar navigation
**Plans**: 2 plans

Plans:
- [ ] 03-01-PLAN.md -- Data layer, utility functions, card grid view with sparklines and growth delta indicators
- [ ] 03-02-PLAN.md -- Table/leaderboard view toggle, empty state, skeleton loading, sidebar nav entry

### Phase 4: Detail Page & Analytics
**Goal**: Users can drill into any competitor and see comprehensive growth, engagement, and content analytics
**Depends on**: Phase 2, Phase 3
**File Ownership**: `src/app/(app)/competitors/[handle]/`, `src/components/competitors/detail/`, `src/components/competitors/charts/`
**Requirements**: COMP-06, GROW-02, GROW-03, ENGM-01, ENGM-02, ENGM-03, CONT-01, CONT-02, CONT-03, CONT-04, CONT-05, CONT-06
**Success Criteria** (what must be TRUE):
  1. User can click a competitor card to navigate to a full detail page showing all analytics sections
  2. Detail page displays follower growth over time as a Recharts line chart (from daily snapshots) and average views per video
  3. Detail page shows per-video engagement breakdown (likes, comments, shares, views) with computed engagement rate per video and average across recent videos
  4. Detail page displays top-performing videos ranked by views or engagement, recent videos feed (last 20 chronological), and posting frequency/cadence
  5. Detail page shows hashtag frequency ranking from video captions, best posting time heatmap (day-of-week x hour), and video duration format breakdown
**Plans**: 2 plans

Plans:
- [ ] 04-01-PLAN.md -- Detail page server component, profile header, follower growth AreaChart, engagement BarChart, utility functions, dashboard Link wiring
- [ ] 04-02-PLAN.md -- Video cards, top/recent videos feed, posting cadence, hashtag frequency, CSS grid posting heatmap, duration breakdown chart

### Phase 5: Benchmarking & Comparison
**Goal**: Users can directly compare competitors and benchmark against their own performance
**Depends on**: Phase 3, Phase 4
**File Ownership**: `src/components/competitors/comparison/`, `src/app/(app)/competitors/compare/`
**Requirements**: BENCH-01, BENCH-02, BENCH-03
**Success Criteria** (what must be TRUE):
  1. User can select 2 competitors for a side-by-side comparison view showing key metrics in parallel columns
  2. User can compare their own TikTok stats (from onboarding @handle) against any competitor in the same side-by-side layout
  3. Leaderboard table supports sorting by any metric column (followers, growth rate, engagement rate, posting frequency)
**Plans**: 2 plans

Plans:
- [ ] 05-01-PLAN.md -- Side-by-side comparison page with self-benchmarking (server component, client view, selectors, metric cards, bar chart, growth overlay)
- [ ] 05-02-PLAN.md -- Sortable leaderboard table with clickable column headers and Compare navigation link from dashboard

### Phase 6: AI Intelligence
**Goal**: Users receive AI-powered strategic insights about competitor content strategy and actionable recommendations
**Depends on**: Phase 4
**File Ownership**: `src/app/api/intelligence/`, `src/components/competitors/intelligence/`, `src/lib/ai/`
**Requirements**: INTL-01, INTL-02, INTL-03, INTL-04, INTL-05
**Success Criteria** (what must be TRUE):
  1. Competitor detail page has a dedicated intelligence section displaying AI-generated content strategy analysis (hooks, patterns, triggers, content series)
  2. When a competitor video exceeds 3x their average views, the system surfaces it with an AI-generated "why it worked" breakdown
  3. System performs hashtag gap analysis comparing user's hashtags vs competitor's and surfaces actionable recommendations
  4. System generates personalized recommendations (format, timing, hooks, content style) based on competitor analysis data
**Plans**: TBD

Plans:
- [ ] 06-01: AI analysis service layer (DeepSeek/Gemini) with prompt engineering
- [ ] 06-02: Intelligence UI section on detail page with viral detection and recommendations

### Phase 7: Polish & Edge Cases
**Goal**: The competitor tracker handles all edge cases gracefully and works well on mobile
**Depends on**: Phase 3, Phase 4, Phase 5, Phase 6
**File Ownership**: All competitor-related files (cross-cutting)
**Requirements**: UI-03, UI-04, UI-05
**Success Criteria** (what must be TRUE):
  1. All competitor views show stale data indicators displaying when data was last refreshed
  2. Failed scrapes display clear error states with a retry option
  3. All competitor views (dashboard, detail page, comparison, intelligence) are fully responsive on mobile
**Plans**: TBD

Plans:
- [ ] 07-01: Stale data indicators, error states with retry, mobile responsive audit

## Execution Waves

Wave groupings for parallel team dispatch. Phases within a wave have no inter-dependencies.

### Wave 1 (no dependencies)
- Phase 1: Data Foundation

### Wave 2 (depends on Wave 1)
- Phase 2: Competitor Management (needs Phase 1)

### Wave 3 (depends on Wave 2)
- Phase 3: Competitor Dashboard (needs Phase 1, Phase 2)

### Wave 4 (depends on Wave 3)
- Phase 4: Detail Page & Analytics (needs Phase 2, Phase 3)

### Wave 5 (depends on Wave 4)
- Phase 5: Benchmarking & Comparison (needs Phase 3, Phase 4)
- Phase 6: AI Intelligence (needs Phase 4)

### Wave 6 (depends on Wave 5)
- Phase 7: Polish & Edge Cases (needs Phase 3, Phase 4, Phase 5, Phase 6)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Foundation | 2/2 | ✓ Complete | 2026-02-16 |
| 2. Competitor Management | 2/2 | ✓ Complete | 2026-02-16 |
| 3. Competitor Dashboard | 2/2 | ✓ Complete | 2026-02-16 |
| 4. Detail Page & Analytics | 2/2 | ✓ Complete | 2026-02-16 |
| 5. Benchmarking & Comparison | 2/2 | ✓ Complete | 2026-02-17 |
| 6. AI Intelligence | 0/2 | Not started | - |
| 7. Polish & Edge Cases | 0/1 | Not started | - |
