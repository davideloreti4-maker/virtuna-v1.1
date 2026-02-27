# Feature Landscape: Prediction Engine Integration

**Domain:** TikTok creator intelligence platform -- prediction engine frontend wiring, outcomes feedback, analytics, and trending re-launch
**Researched:** 2026-02-20
**Overall confidence:** MEDIUM-HIGH (strong evidence from competitor analysis and established UX patterns; some areas like prediction accuracy transparency are emerging with less established convention)

---

## Table Stakes

Features users expect from a content prediction tool. Missing = product feels broken or incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Prediction results display with score + factor breakdown | Every prediction tool surfaces a single headline score (Opus Clip virality 0-99, Dash Social engagement ranking). Users need one number + why. | Med | Already partially built (ResultsPanel, HeroScore). Needs real data wiring. |
| Prediction history / past analyses | Sprout Social, Hootsuite, Later all maintain post-performance history. Users need to see what they tested before. | Med | History view exists but uses mock data. Wire to `analysis_results` table. |
| Confidence indicator on predictions | Standard in AI tooling. Color-coded badge (green/amber/red) with High/Medium/Low labels. Users expect to know how sure the system is. | Low | `ConfidenceBadge` component exists. Wire to real `confidence_label` from engine. |
| Actionable suggestions | Every creator tool provides "do X to improve Y" feedback. Dash Social, Opus Clip, Sprout Social all do this. Non-negotiable. | Low | `SuggestionsSection` exists. Wired to DeepSeek output. Verify real data flows through. |
| Basic outcome reporting | Users need a way to say "here's how it actually performed." Manual form is minimum viable. Sprout Social does automated tracking; manual is acceptable for v1. | Low | `OutcomeForm` exists with views/likes/shares/platform/URL fields. Already functional. |
| Video upload with processing feedback | CapCut, Descript, Opus Clip all show determinate progress bars during upload, then skeleton/shimmer during analysis. Users panic without feedback. | Med | Not yet built. Needs upload to Supabase Storage + Gemini analysis pipeline. |
| TikTok URL paste-to-analyze | Opus Clip accepts YouTube URLs directly. Same pattern expected for TikTok URLs. Paste link, system extracts content. | Med | Not yet built. Needs Apify scrape integration. |
| Trending content feed with categories | TikTok Creative Center has Hashtags/Songs/Videos tabs with region/time filters. Tokboard shows weekly top sounds. Category navigation is expected. | Low | Already built with 3 tabs (breaking-out, trending-now, rising-again) + saved. Currently queries real `scraped_videos` table. |
| DeepSeek reasoning transparency | Users of AI tools increasingly expect to see "why" behind recommendations. Opus Clip shows scoring criteria (hook, flow, engagement, trend). | Low | `ReasoningSection` component exists with expandable view. Wire to real `reasoning` field. |

## Differentiators

Features that set Virtuna apart. Not expected, but create significant value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Society persona reactions | No competitor simulates audience segment responses with distinct voices. Dash Social predicts engagement generically; Virtuna shows Gen-Z, Career, Parents, Creative, Knowledge personas reacting in character. This is shareable content. | Low | `BehavioralPredictionsSection` exists. Engine outputs `societyReactions` with per-persona `reaction`, `sentiment`, `wouldShare`. Just needs real data wiring. |
| Prediction accuracy tracking over time | No major creator tool shows its own track record transparently. Madgicx does monthly accuracy reviews internally but doesn't expose them to users. Showing "our predictions have been X% accurate this month" builds trust that no competitor offers. | High | Requires sufficient outcome data + calibration math. Aggregate predicted vs actual delta distribution. Show running accuracy %. |
| Auto-scrape outcomes after 48h | Dash Social adapts recommendations over time but doesn't auto-collect performance data from posted content. Auto-scraping posted URLs eliminates manual reporting friction entirely. | High | Needs Apify integration for posted URL scraping, 48h delayed job scheduling, and consent flow. Backend has the plumbing (Apify + crons). |
| Confidence distribution dashboard | No consumer creator tool shows confidence calibration charts. This is borrowed from ML ops tooling (expected calibration error, reliability diagrams). Shows system health to power users. | Med | Backend tracks `is_calibrated` metadata. Need histogram of confidence levels across predictions + actual outcome rates per confidence bucket. |
| Cost tracking dashboard | Unique transparency. Showing per-analysis cost (~$0.013) and daily/monthly cost trends lets users appreciate the infrastructure investment. No competitor exposes this. | Med | Backend already logs `cost_cents` per stage. `/api/admin/costs` endpoint exists. Need frontend chart. |
| Hive visualization with real data | Canvas-based 1300+ node visualization is already unique. Wiring it to real prediction data (not mock) makes it functional, not just eye candy. | Med | Canvas hive exists at 60fps. Needs data bridge from `PredictionResult` to node positions/colors. |
| Model drift monitoring | Borrowed from ML ops. Shows if prediction accuracy is degrading over time. No consumer creator tool does this. Valuable for trust + internal quality. | High | Requires time-series of prediction accuracy. Weekly rolling window of delta between predicted and actual scores. |

## Anti-Features

Features to explicitly NOT build in this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Numeric virality score without context | Opus Clip's virality score (0-99) is widely considered unreliable by users. A bare number without factor breakdown erodes trust. | Always show score WITH factor breakdown (hook, audio, text, timing, creator) and confidence level. Never show the score alone. |
| Guaranteed viral predictions | No system can guarantee virality. Hard accuracy ceiling is 80-85% due to irreducible randomness (algorithm mood, timing, external events). Overselling destroys trust. | Frame as "resonance prediction" not "viral guarantee." Show confidence intervals, not false precision. Display "75-85% likely" ranges, not "82.3%". |
| Real-time trending with sub-minute refresh | TikTok Creative Center updates trends daily/weekly, not real-time. Building real-time adds infrastructure cost without user value -- trends move in 48-72h windows. | 6-hour refresh cadence (matching existing Apify scraper cron). Show "last updated" timestamp. Users don't need minute-by-minute trending. |
| Automated posting from Virtuna | Creator tools like Hootsuite/Later do scheduling. Virtuna is an intelligence layer, not a scheduling tool. Adding posting creates scope creep and platform API complexity. | Keep the "analyze before you post" positioning. User copies insights, posts on TikTok directly. |
| Complex ML ops dashboard for non-technical users | Calibration charts, ECE values, and reliability diagrams are ML ops concepts. Most creators won't understand or care. | Show simplified accuracy: "We predicted 78, it got 82. We're getting better." Reserve detailed ML ops charts for admin view or pro tier. |
| Comparison mode (this video vs that video) | Side-by-side video comparison adds UI complexity without proportional value in v1. | Each analysis is standalone. Users can compare by looking at history. Add comparison in a future milestone. |

## Feature Dependencies

```
Video Upload Pipeline
  --> Supabase Storage upload
  --> Gemini video analysis
  --> Prediction Engine call
  --> Results display

TikTok URL Extraction
  --> Apify scrape of URL
  --> Content extraction (video + metadata)
  --> Prediction Engine call
  --> Results display

Outcomes Feedback Loop
  --> Manual outcome form (exists)
  --> Auto-scrape after 48h (depends on post URL collection)
  --> Predicted vs actual comparison (depends on outcome data)
  --> Accuracy tracking over time (depends on sufficient outcomes)
  --> ML retraining (depends on 1000+ outcomes)

Analytics Dashboard
  --> Confidence distribution (depends on accumulated predictions)
  --> Cost tracking (depends on cost_cents logging -- already done)
  --> Model drift (depends on outcomes feedback data)
  --> Accuracy trends (depends on outcomes feedback data)

Trending Re-launch
  --> Real scraped_videos data (already flowing via Apify crons)
  --> Category filtering (already built)
  --> Velocity indicators (already built)
  --> Detail modal with TikTok embed (already built)
```

## Deep Feature Analysis

### 1. Outcomes Feedback Loop

**What competitors do:**

- **Sprout Social**: Automated post-performance tracking across all connected accounts. Shows reach, engagement, impressions after posting. Monthly/quarterly reports compare predicted best-times vs actual performance. No prediction accuracy tracking.
- **Hootsuite**: Advanced Analytics export includes organic metrics + GA4 data. Best-time recommendations auto-adjust based on past performance. No explicit predicted-vs-actual comparison.
- **Later**: Measures content performance and optimizes posting times. Instagram-focused. No prediction accuracy feedback.
- **Dash Social**: Vision AI adapts recommendations as audience tastes change. Continuously learns from actual engagement. Users see updated recommendations, not accuracy metrics. Cotton On quote: "if Vision says it's not going to perform highly, we're not posting it."
- **No competitor** shows prediction accuracy as a user-facing metric.

**What Virtuna should do:**

1. **Manual outcome form** (exists) -- keep as-is for v1. Three fields minimum: views, likes, shares.
2. **Auto-scrape enhancement** -- when user provides `platform_post_url`, schedule a 48h delayed scrape via Apify to automatically collect actual metrics. Show "pending auto-check" indicator.
3. **Predicted vs Actual comparison** -- after outcome data arrives, show inline comparison: predicted score, actual performance tier, delta, and accuracy direction.
4. **Running accuracy metric** -- after 10+ outcomes, show "Your prediction accuracy: X%" on the dashboard. Update with each new outcome. This is unique. No competitor does this.

**Confidence: MEDIUM** -- auto-scrape timing and Apify reliability for individual URLs needs phase-specific research.

### 2. Content Analytics Dashboard

**What competitors show:**

- **Standard KPI cards**: Total reach, engagement rate, conversions, follower growth -- displayed as large numbers with trend arrows.
- **Layout pattern**: Executive summary cards at top, platform breakdown mid-page, detailed charts below. Hootsuite/Sprout Social both use this hierarchy.
- **Chart types**: Line charts for trends over time, bar charts for content type comparison, pie/donut for distribution breakdowns, area charts for cumulative metrics.
- **Data freshness**: Daily for monitoring, hourly for active campaigns, real-time for critical alerts. Always show timestamp of last update.

**What Virtuna should show (prediction-specific):**

| Section | Visualization | Data Source |
|---------|--------------|-------------|
| Prediction summary cards | 4 KPI cards: Total Analyses, Avg Score, Avg Confidence, Accuracy Rate | `analysis_results` table aggregation |
| Score distribution | Histogram -- how many predictions fall in each score bucket (0-20, 20-40, etc.) | `analysis_results.overall_score` |
| Confidence distribution | Donut chart -- % of predictions at High/Medium/Low confidence | `analysis_results.confidence_label` |
| Accuracy over time | Line chart -- rolling 7-day prediction accuracy (requires outcomes) | `outcomes` table delta tracking |
| Cost trends | Area chart -- daily API cost with per-model breakdown (Gemini vs DeepSeek) | `cost_cents` from structured logs or `/api/admin/costs` |
| Model usage breakdown | Stacked bar -- which models contributed to each prediction | `analysis_results.models_used` metadata |
| Recent predictions list | Table -- last 10 predictions with score, confidence, outcome status | `analysis_results` ordered by date |

**Layout recommendation**: Dashboard follows Sprout Social's pattern -- summary cards top row, charts in 2-column grid below, recent activity table at bottom.

**Confidence: MEDIUM** -- standard dashboard patterns are well-established. Prediction-specific visualizations (confidence calibration) are less conventional in consumer tools.

### 3. Trending Feed Re-launch

**What TikTok Creative Center does:**

- **Tabs**: Hashtags, Songs, Creators, Videos -- each with dedicated browsing interface
- **Filters**: Region, industry, time period (7 days, 30 days, 120 days)
- **Sorting**: By popularity, by growth rate, by recency
- **Data per item**: Usage count, growth trajectory (rising/peaked/declining), associated content examples
- **Refresh cadence**: Daily updates for trend rankings. Trend windows are 48-72 hours for catching rising trends.
- **Songs section**: Shows "new to top 100" badge, Commercial Music Library licensing status

**What Tokboard/TrendTok do:**

- **Tokboard**: Weekly top trending songs. Simple, clean interface. Quick access to what's hot.
- **TrendTok**: Social trends tracking with real-time-ish updates, hashtag tracking, sound tracking.

**What Virtuna already has (v2.2):**

- 3 category tabs: breaking-out, trending-now, rising-again (+ saved)
- VideoCard with GlassCard + HoverScale + GlassPill + velocity indicators
- Infinite scroll with cursor-based pagination from `scraped_videos` table
- Video detail modal with TikTok embed iframe
- Bookmark system with Zustand + localStorage
- Skeleton loading states

**What needs to change for re-launch:**

The existing trending page is already wired to real data (`scraped_videos` table with Apify crons). The "re-launch" is about ensuring the data pipeline is flowing correctly and adding features that leverage the prediction engine:

1. **Verify data freshness** -- confirm Apify scraper is running every 6 hours and `trending_sounds` are being calculated hourly. Show "last updated X hours ago" timestamp.
2. **Add trend velocity context** -- show why a video is trending (trending sound, rising hashtag, creator momentum). Data exists in `trending_sounds.velocity_score` and `trend_phase`.
3. **Add "Analyze this" CTA** -- from trending video detail modal, let users run the prediction engine on that content to understand WHY it's performing.
4. **Add time period filter** -- 7 days / 30 days, matching TikTok Creative Center convention.
5. **Add sound/hashtag sub-tabs** -- show trending sounds and hashtags separately, not just videos.

**Confidence: HIGH** -- trending feed patterns are well-established. Virtuna's existing implementation is solid.

### 4. Video Analysis UX

**How competitors handle upload + analysis:**

- **Opus Clip**: Paste YouTube URL or upload video. AI analyzes entire video in under 2 minutes. Results page shows clips ranked by virality score (0-100). Each clip gets hook, flow, engagement, trend scores. Processing shown as loading animation.
- **Descript**: Upload video, system transcribes automatically. Processing shows progress bar (determinate for upload, indeterminate for transcription). Transcript appears progressively.
- **CapCut**: Upload-first workflow. Drag-and-drop or file picker. Progress bar during upload. Template suggestions appear after upload completes.

**UX flow recommendation for Virtuna video upload:**

```
Step 1: INPUT
  User pastes TikTok URL OR uploads video file
  - URL paste: instant validation (regex check), show URL preview
  - File upload: drag-and-drop zone, file picker fallback, max 100MB

Step 2: UPLOAD (if file)
  Determinate progress bar (% uploaded)
  Show file name, size, estimated time
  Shimmer animation on the upload zone

Step 3: PROCESSING
  Simulation animation starts (existing 4.5s theater)
  Behind the scenes: Gemini visual analysis + DeepSeek reasoning
  Society nodes activate one by one
  If engine takes longer than animation, loop Phase 4 (converge)

Step 4: RESULTS
  Flash/bloom transition
  ResultsPanel renders with real PredictionResult data
  Score + factors + suggestions + society reactions
```

**Key UX patterns from research:**

- **Skeleton screens > spinners**: Skeleton loading with shimmer perceived 20-30% faster than spinners. Virtuna already uses skeletons elsewhere.
- **Progressive disclosure**: Show partial results as they arrive. Hook score might come from Gemini before DeepSeek finishes reasoning. Consider streaming partial results.
- **Upload states matter**: File selection -> uploading (progress %) -> processing (indeterminate) -> complete. Each state needs distinct visual treatment.
- **Error recovery**: Retry button on failure. "Upload failed -- try again" with one-click retry. Never lose the user's file reference.

**Confidence: HIGH** -- upload/processing UX patterns are extremely well-documented.

### 5. Prediction Accuracy Transparency

**How AI tools handle accuracy/trust:**

- **Opus Clip**: Shows virality score 0-99 but provides NO accuracy tracking. Users widely report scores are unreliable. Trust erosion is a real problem.
- **Dash Social**: Adapts recommendations based on performance but doesn't surface accuracy metrics. The trust is implicit ("our recommendations keep improving").
- **Madgicx**: Claims >90% accuracy internally. Recommends "monthly accuracy reviews comparing predictions to actual outcomes" and "30-day accuracy tracking to identify model drift." But this is internal ops, not user-facing.

**What the research recommends:**

From Agentic Design Patterns and AI UX Design Guide:

1. **Confidence visualization**: Use color-coded badges (green >80%, amber 50-80%, red <50%). Show ranges not false precision ("75-85% likely" not "82.3%").
2. **Explain confidence drivers**: "High confidence because: strong hook detected, trending sound, similar content performed well." Not just a percentage.
3. **Historical accuracy**: Show calibration over time. "Last 30 days: we predicted within 10 points of actual 73% of the time." This builds appropriate trust.
4. **Low confidence handling**: When confidence is low, suggest verification or flag uncertainty. "We're less sure about this one -- the niche is uncommon in our training data."
5. **Avoid false precision**: Never show "82.7% virality chance." Round to nearest 5 or use tiers (High/Medium/Low).

**What Virtuna should implement:**

| Component | User-Facing | Admin-Only | When Available |
|-----------|-------------|------------|----------------|
| Confidence badge (H/M/L) | Yes -- on every prediction | -- | Immediately (already built) |
| Factor-level confidence | Yes -- which signals are strong/weak | -- | Immediately (engine outputs factor scores) |
| Predicted vs Actual comparison | Yes -- after outcome reported | -- | After first outcome |
| Running accuracy % | Yes -- "73% accurate this month" | -- | After 10+ outcomes |
| Accuracy trend chart | Pro tier only | Also in admin | After 30+ outcomes |
| Calibration reliability diagram | -- | Yes | After 100+ outcomes |
| Model drift alerts | -- | Yes | After 30 days of continuous data |

**Confidence: MEDIUM** -- the UX patterns for confidence display are well-documented. The "running accuracy" metric is novel for consumer creator tools, so there's no competitor precedent to validate the UX. The risk is over-exposing accuracy early when sample size is small (accuracy on 5 predictions is statistically meaningless).

---

## MVP Recommendation

### Priority 1: Wire existing components to real data (Low complexity, high impact)

These features are already built as UI components but display mock/placeholder data:

1. History view connected to real `analysis_results`
2. Hive visualization wired to real prediction data
3. DeepSeek reasoning exposed in ResultsPanel
4. Confidence badge showing real engine confidence
5. Society persona reactions from real engine output
6. Factor breakdown with real signal scores

### Priority 2: Build input expansion (Medium complexity, unblocks core flow)

Users need to actually GET predictions:

7. Video upload pipeline (Supabase Storage -> Gemini -> Engine)
8. TikTok URL extraction (paste URL -> Apify scrape -> Engine)
9. Niche/hashtag fields functional in prediction form

### Priority 3: Outcomes feedback (Medium complexity, builds trust moat)

The feedback loop is what makes predictions improve over time:

10. Manual outcome form (exists, verify wiring)
11. Auto-scrape posted content after 48h
12. Predicted vs actual comparison view

### Priority 4: Analytics dashboard (Medium complexity, power user value)

13. Prediction summary KPI cards
14. Score/confidence distribution charts
15. Cost tracking visualization
16. Accuracy trend (when outcome data sufficient)

### Priority 5: Trending re-launch (Low complexity, already mostly built)

17. Verify data pipeline flowing
18. Add "Analyze this" CTA on trending videos
19. Add time period filter
20. Show data freshness timestamp

### Defer to future milestone:

- **Model drift monitoring dashboard** -- requires weeks of continuous data, not useful until system has been running in production with real outcomes
- **Calibration reliability diagrams** -- ML ops concept, too technical for creator audience
- **Sound/hashtag sub-tabs on trending** -- nice-to-have, not essential for re-launch
- **Side-by-side prediction comparison** -- scope creep

---

## Sources

### Outcomes & Feedback Loops
- [Sprout Social Post Performance Report](https://sproutsocial.com/insights/post-performance-report/) -- MEDIUM confidence
- [Sprout Social Metrics Guide 2026](https://sproutsocial.com/insights/social-media-metrics/) -- MEDIUM confidence
- [Dash Social Predictive AI](https://www.dashsocial.com/features/predictive-ai) -- HIGH confidence (official product page)
- [Hootsuite vs Later Comparison](https://www.hootsuite.com/hootsuite-vs-later) -- MEDIUM confidence

### Analytics Dashboards
- [UXPin Dashboard Design Principles 2025](https://www.uxpin.com/studio/blog/dashboard-design-principles/) -- HIGH confidence
- [Dataslayer Marketing Dashboard Best Practices 2025](https://www.dataslayer.ai/blog/marketing-dashboard-best-practices-2025) -- MEDIUM confidence
- [Coupler.io Social Media Dashboard Examples](https://www.coupler.io/dashboard-examples/social-media-dashboard) -- MEDIUM confidence

### Trending Feeds
- [TikTok Creative Center](https://ads.tiktok.com/business/creativecenter/trends/hub/pc/en) -- HIGH confidence (first-party)
- [TikTok Creative Center Guide (bir.ch)](https://bir.ch/blog/tiktok-creative-center) -- MEDIUM confidence
- [Creatify TikTok Creative Center Guide](https://creatify.ai/blog/tiktok-creative-center) -- MEDIUM confidence

### Video Analysis UX
- [Opus Clip Virality Score](https://help.opus.pro/docs/article/virality-score) -- HIGH confidence (official docs)
- [Opus Clip vs CapCut vs Descript](https://www.aihustleguy.com/blog/descript-vs-capcut-vs-opus-clip-ai-video-editor) -- MEDIUM confidence
- [LogRocket Skeleton Loading Design](https://blog.logrocket.com/ux-design/skeleton-loading-screen-design/) -- HIGH confidence
- [NNGroup Skeleton Screens vs Progress Bars](https://www.nngroup.com/videos/skeleton-screens-vs-progress-bars-vs-spinners/) -- HIGH confidence

### Prediction Accuracy & Trust
- [Agentic Design Confidence Visualization Patterns](https://agentic-design.ai/patterns/ui-ux-patterns/confidence-visualization-patterns) -- HIGH confidence
- [AI UX Design Guide - Confidence Visualization](https://www.aiuxdesign.guide/patterns/confidence-visualization) -- HIGH confidence
- [UXmatters Design Psychology of Trust in AI](https://www.uxmatters.com/mt/archives/2025/11/the-design-psychology-of-trust-in-ai-crafting-experiences-users-believe-in.php) -- MEDIUM confidence
- [Madgicx Creative Performance Prediction](https://madgicx.com/blog/creative-performance-prediction) -- MEDIUM confidence
- [Eleken AI Transparency Design Lessons](https://www.eleken.co/blog-posts/ai-transparency) -- MEDIUM confidence
