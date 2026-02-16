# Feature Landscape: Competitor Intelligence Tracker

**Domain:** TikTok creator competitor tracking & benchmarking
**Researched:** 2026-02-16
**Overall confidence:** HIGH (verified across Exolyt, Pentos, Socialinsider, Analisa.io, Favikon, Sprout Social, TikTok Creative Center, and InfluenceFlow)

---

## Table Stakes

Features every competitor tracking tool provides. Missing any of these and the product feels broken.

### Growth Metrics

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|-------------|------------|--------------|-------|
| Follower count display | Every tool shows this front-and-center | Low | Apify scraping, Supabase storage | Scraped from public profile |
| Follower growth over time | Pentos, Exolyt, Socialinsider all chart this prominently | Medium | Requires historical data collection (daily snapshots) | Need scheduled scraping — not available in single scrape |
| Total likes / hearts count | Basic profile-level metric all tools show | Low | Apify scraping | Available from profile scrape |
| Total video count | Part of every profile overview | Low | Apify scraping | Available from profile scrape |
| Average views per video | Filters out one-off viral noise, shows typical performance | Medium | Compute from scraped video data | Calculate from last N videos (e.g., last 30) |

### Engagement Metrics

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|-------------|------------|--------------|-------|
| Engagement rate calculation | The single most important metric — every tool computes it | Low | Scraped video data | Formula: (likes + comments + shares + saves) / views * 100. Industry standard |
| Per-video engagement breakdown | Likes, comments, shares displayed per video | Low | Apify video scraping | Core data from video scrape |
| Average engagement rate | Aggregate metric across recent content | Low | Computed from video data | Average of last 20-30 videos |

### Content Analysis

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|-------------|------------|--------------|-------|
| Top-performing videos list | Socialinsider, Exolyt, Pentos all rank content | Low | Scraped video data, sorting | Sort by views or engagement rate |
| Posting frequency / cadence | How often competitors post — foundational strategy metric | Low | Video timestamps | Count posts per week/month from timestamps |
| Hashtag usage analysis | Exolyt and Socialinsider prominently feature this | Medium | Parse hashtags from video captions | Extract, count, rank by frequency and performance |
| Recent videos feed | See what competitors are posting now | Low | Apify video scraping | Last 10-20 videos displayed chronologically |

### Competitor Management

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|-------------|------------|--------------|-------|
| Add competitor by @handle | Primary input method — paste a TikTok username | Low | Apify profile lookup, Supabase storage | Validate handle exists before adding |
| Competitor list / grid view | Dashboard showing all tracked competitors | Low | Supabase query, UI components | Cards with avatar, follower count, engagement rate |
| Remove competitor | Basic CRUD — must be able to un-track | Low | Supabase delete | Confirmation dialog |
| Competitor profile detail page | Click into a competitor to see full analytics | Medium | All scraped data rendered | The core "deep dive" view |

### Comparison / Benchmarking

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|-------------|------------|--------------|-------|
| Side-by-side comparison (2 accounts) | Exolyt, Analisa, Socialinsider all offer this. Core value prop | Medium | Two competitors' data rendered in parallel columns | Key metrics in comparison table format |
| Compare self vs competitor | The whole point for creators — "how do I stack up?" | Medium | User's own TikTok data (from @handle onboarding) + competitor data | Requires scraping user's own profile too |

---

## Differentiators

Features that set Virtuna apart. Not expected from every tool, but high-value for individual creators (not agencies). These are where the product wins.

### Smart Discovery

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Competitor search by name/keyword | Most tools require exact @handle — search is friendlier | High | TikTok search scraping or keyword-based profile lookup | Apify has search actors but reliability varies |
| Niche-based competitor suggestions | "Creators like you in fitness/comedy/cooking" — no other creator-focused tool does this well | High | Content classification, user's niche from onboarding goals | Could use hashtag overlap or content similarity. Leverages existing onboarding goal data |
| "Watch this creator" alerts | Get notified when a competitor posts a viral video or hits a growth spike | Medium | Background polling, notification system (in-app or email) | Real differentiator for creators who check weekly, not daily |

### Advanced Analytics

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Content pillar breakdown | Categorize competitors' content into themes (tutorials, trends, storytelling, etc.) | High | Caption/hashtag analysis, possibly LLM classification | Socialinsider shows this for agencies — bringing it to individual creators is novel |
| Best posting time analysis | When competitors post vs when they get best engagement | Medium | Video timestamps + engagement correlation | Heatmap visualization (day x hour grid) |
| Growth velocity comparison | Not just "who has more followers" but "who is growing faster right now" | Medium | Time-series data, rate-of-change calculation | Percentage growth over 7d/30d/90d windows |
| Engagement depth scoring | Saves + shares weighted higher than likes (algorithm signal) | Medium | Apify may not reliably return saves. Shares more available | Saves are the strongest signal per 2026 algorithm. If unavailable, note as limitation |
| Video format analysis | What video lengths, aspect ratios, and formats work best for competitor | Medium | Video metadata from scrape | Group by duration buckets (< 15s, 15-60s, 1-3min, 3min+) |

### Competitive Intelligence

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Leaderboard / ranking table | Sortable table of all tracked competitors by any metric | Low | All competitor data, table component | Powerful at-a-glance view. Sort by growth, engagement, frequency |
| Competitor "report card" summary | Quick snapshot: strengths, weaknesses, notable patterns | High | Aggregated analytics + templated insights or LLM summary | "Posts 3x/week, engagement above niche average, heavy use of trending audio" |
| Hashtag overlap / gap analysis | Which hashtags competitors use that you don't | Medium | Your hashtags vs competitors' hashtags | Actionable: "Try these 5 hashtags your competitors use successfully" |
| Sound/audio tracking | What trending sounds competitors use | Medium | Audio metadata from video scrape | Apify returns music metadata. Less reliable than other fields |

### UX Differentiators

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Multi-competitor comparison (3+) | Most tools cap at 2 for side-by-side. Showing 3-5 in a scrollable comparison is rare | Medium | Horizontally scrollable comparison grid | More useful for creators tracking a whole niche |
| Spark line mini-charts in cards | Show growth trend direction at a glance without clicking in | Low | Tiny SVG/canvas charts (like GitHub contribution graph) | Raycast aesthetic — information-dense, minimal |
| Metric delta indicators | "+12% this week" or "-3% vs last month" with green/red coloring | Low | Time-series data, simple delta calc | Makes static numbers actionable |

---

## Anti-Features

Features to explicitly NOT build. Either wrong audience (agencies), wrong scope (v1 competitor tracker), or negative ROI.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Multi-platform support (Instagram, YouTube, X) | Virtuna is TikTok-only. Spreading across platforms dilutes focus and 5x's scraping costs | Stay TikTok-only. Depth over breadth |
| Influencer discovery / marketplace | Agency feature (Favikon, HypeAuditor territory). Individual creators don't hire influencers | Focus on tracking known competitors, not discovering influencers |
| Campaign tracking / ROI measurement | Brand/agency feature. Individual creators don't run "campaigns" | Track content performance, not campaign attribution |
| Automated PDF report generation | Agency deliverable. Individual creators look at dashboards, not reports | In-app dashboards with real-time data |
| Sentiment analysis on comments | HIGH complexity (NLP/LLM), LOW value for individual creators. Agencies care about brand perception; creators care about "am I growing faster?" | Show raw engagement numbers. Comment count is sufficient signal |
| Share of voice metrics | Agency metric. An individual creator doesn't think in "share of voice" | Use simpler "niche ranking" or leaderboard instead |
| Ad / promoted post detection | Exolyt does this — but it's for brands tracking competitors' ad spend. Individual creators don't care if a competitor boosted a post | Just show organic performance metrics |
| White-label / team features | Agency feature. Individual creator tool = single user | Keep it simple. One account, one dashboard |
| Real-time live monitoring | Overkill for competitor tracking. Daily/twice-daily data refresh is sufficient | Scheduled scraping (1-2x daily). Background job, not WebSocket |
| Follower list scraping | Privacy-invasive, TOS risk, computationally expensive, low value | Show follower count and growth rate only |
| DM/outreach automation | Different product category entirely (outreach tools). Scope creep trap | Out of scope completely |

---

## Feature Dependencies

```
Apify scraping setup ─────────────────────────── Required for ALL features
    │
    ├── Profile data (followers, likes, video count)
    │       ├── Competitor cards / grid view
    │       ├── Follower count display
    │       └── Basic profile info
    │
    ├── Video data (per-video metrics, captions, timestamps)
    │       ├── Engagement rate calculation
    │       ├── Top-performing videos
    │       ├── Posting frequency analysis
    │       ├── Hashtag extraction
    │       ├── Content pillar classification
    │       ├── Best posting time heatmap
    │       └── Video format analysis
    │
    └── Scheduled re-scraping (cron/background jobs)
            ├── Follower growth over time (requires snapshots)
            ├── Growth velocity comparison
            ├── Metric delta indicators ("+12% this week")
            └── "Watch this creator" alerts

Supabase tables ──────────────────────────────── Required for ALL features
    ├── competitors table (user_id, handle, profile data)
    ├── competitor_snapshots table (daily metrics)
    ├── competitor_videos table (per-video data)
    └── competitor_hashtags table (aggregated)

User's own TikTok data ───────────────────────── Required for benchmarking
    ├── Self vs competitor comparison
    ├── Hashtag gap analysis
    └── Niche-based suggestions

Existing onboarding data ─────────────────────── Optional enrichment
    ├── User's niche/goals → competitor suggestions
    └── User's @handle → self-benchmarking data source
```

---

## MVP Recommendation

### Phase 1: Foundation (must ship first)
1. **Add competitor by @handle** — core input, validates existence, scrapes initial data
2. **Competitor grid/list view** — dashboard with cards showing avatar, handle, follower count, engagement rate
3. **Competitor profile detail page** — full analytics for a single competitor
4. **Per-video engagement breakdown** — recent videos with likes, comments, shares, views
5. **Remove competitor** — basic CRUD

### Phase 2: Analytics Depth
6. **Engagement rate calculation** — the single most important computed metric
7. **Top-performing videos ranked** — sort by views or engagement
8. **Posting frequency analysis** — posts per week/month
9. **Hashtag usage analysis** — top hashtags with counts
10. **Average views per video** — filtered average, not total

### Phase 3: Comparison & Benchmarking
11. **Side-by-side comparison (2 competitors)** — parallel columns, key metrics
12. **Compare self vs competitor** — leverages existing @handle from onboarding
13. **Leaderboard table** — sortable by any metric, all competitors at a glance

### Phase 4: Time-Series & Growth
14. **Scheduled re-scraping** — background job for daily snapshots
15. **Follower growth over time chart** — line chart with date axis
16. **Growth velocity / delta indicators** — "+X% this week" on cards
17. **Metric delta indicators** — green/red directional changes

### Defer to Later
- **Competitor search by name** — HIGH complexity, Apify search actor reliability unclear
- **Niche-based suggestions** — needs content classification pipeline (could leverage backend-foundation work)
- **Content pillar breakdown** — needs LLM classification, HIGH complexity
- **Alerts/notifications** — needs notification infrastructure not yet built
- **Sound/audio tracking** — dependent on Apify returning reliable audio metadata
- **Competitor report card** — needs all other analytics features built first

---

## Competitive Landscape Summary

| Tool | Target | Pricing | Key Strength | Key Weakness (for creators) |
|------|--------|---------|--------------|---------------------------|
| Pentos | Brands, agencies | $99/mo+ | Historical data, trend tracking | Expensive, agency-focused UX |
| Exolyt | Brands, agencies | $49/mo+ | Social listening, share of voice | Overkill for individual creators |
| Socialinsider | Agencies | $82/mo+ | Cross-platform benchmarking | Multi-platform bloat, agency features |
| Analisa.io | Marketers | $59/mo+ | Influencer authenticity scoring | Influencer discovery focus, not creator self-serve |
| Favikon | Brands | $55/mo+ | Creator network mapping | Brand-side tool, not creator-side |
| TikTok Creative Center | Advertisers | Free | Ad intelligence, trends | Ad-focused, no organic competitor tracking |
| **Virtuna (target)** | **Individual creators** | **Included** | **Creator-centric, self-benchmarking, part of intelligence suite** | **Needs real data reliability** |

**The gap:** Every existing tool targets brands and agencies. No tool is built from the ground up for an individual creator asking "how do I compare to creators in my niche?" Virtuna fills this gap by integrating competitor tracking into a creator-first intelligence platform, alongside trending feeds, viral prediction, and brand deals.

---

## Sources

- [Sprout Social - TikTok Competitor Analysis Guide 2026](https://sproutsocial.com/insights/tiktok-competitor-analysis/)
- [Socialinsider - TikTok Competitor Analysis Guide](https://www.socialinsider.io/blog/tiktok-competitor-analysis/)
- [Exolyt - Competitor Analysis Solution](https://exolyt.com/solution/competitor-analysis)
- [Exolyt - Brand Comparison](https://exolyt.com/features/brand-comparison)
- [Favikon - TikTok Competitor Analytics](https://www.favikon.com/features/tiktok-competitor-analytics)
- [Pentos - TikTok Analytics](https://pentos.co/)
- [InfluenceFlow - TikTok Creator Metrics Guide 2026](https://influenceflow.io/resources/tiktok-creator-metrics-the-complete-guide-to-tracking-analyzing-optimizing-your-performance-in-2026/)
- [Apify - TikTok Profile Scraper](https://apify.com/clockworks/tiktok-profile-scraper)
- [Apify - TikTok Scraper](https://apify.com/clockworks/tiktok-scraper)
- [Dashboardly - Best TikTok Analytics Tools 2025](https://www.dashboardly.io/post/best-tiktok-analytics-tools-for-2025)
- [Brand24 - TikTok Analytics Tools 2026](https://brand24.com/blog/tiktok-analytics-tools/)
- [ContentStudio - TikTok Analytics Tools 2025](https://contentstudio.io/blog/tiktok-analytics-tools)
