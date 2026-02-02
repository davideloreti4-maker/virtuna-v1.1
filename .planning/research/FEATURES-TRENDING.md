# Feature Landscape: Trending Page

**Domain:** TikTok trend discovery feed + content remix/storyboard tools
**Researched:** 2026-02-02
**Confidence:** MEDIUM-HIGH (verified via multiple 2026 sources)

## Executive Summary

The trending video discovery and content remix space in 2026 is evolving rapidly. TikTok's native Creative Center provides basic trend discovery, but no tool bridges the gap between "see what's trending" and "create your version." This is Virtuna's opportunity.

**Key insight:** YouTube is removing its Trending page entirely in favor of algorithmic feeds, but TikTok creators still need curated discovery for content planning. The remix-to-storyboard workflow is genuinely novel—existing storyboard tools (Boords, Katalist, StoryboardHero) are generic film production tools, not short-form social content tools.

**Core user jobs:**
1. **Inspiration** - "What's working right now that I could adapt?"
2. **Trend tracking** - "Is this trend rising, peaking, or dying?"
3. **Quick execution** - "Give me everything I need to film this tomorrow"

---

## Table Stakes

Features users expect. Missing = product feels incomplete or amateur.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Infinite scroll feed** | Standard pattern for content discovery; users expect seamless browsing without pagination | Medium | None | Must include virtualized lists for performance; load 10-20 items at a time |
| **Category filtering** | Users need to narrow discovery to relevant content type (Challenges, Sounds, Formats) | Low | None | Fixed top tabs or horizontal chips; clear visual state |
| **Video thumbnail grid** | Visual preview is essential for video content; users scan visually before committing | Low | None | Consistent aspect ratios (9:16); lazy loading; show view counts |
| **Video preview/playback** | Users expect to preview content before deeper engagement | Medium | Video player component | Autoplay on hover/tap; muted by default; progress indicator |
| **Basic video metadata** | Creator name, view count, date, category tag | Low | None | Essential context for decision-making |
| **Loading states** | Skeleton loaders during fetch; prevents perceived lag | Low | None | Match thumbnail grid layout; smooth transitions |
| **Pull-to-refresh** | Standard mobile pattern for fresh content | Low | None | Show timestamp of last refresh |
| **Analyze action** | Connect to existing Viral Predictor; users expect feature consistency | Low | Existing Viral Predictor | Reuse existing score/breakdown UI; same flow |
| **Clear empty states** | When no content matches filters or on error | Low | None | Helpful messaging, not blank screens |
| **Link to original TikTok** | Users expect to see original context, comments, engagement | Low | None | Opens in TikTok app or web |

### Why These Are Table Stakes

Based on 2026 research:

**Infinite scroll is mandatory for discovery:**
- "Infinite scrolling works best when users don't need to make decisions; just consume. That's why it thrives on social media, news aggregators, and visual inspiration platforms."
- TikTok, Pinterest, Instagram all use this pattern
- Research shows 77% of users face choice paralysis with paginated content

**Category filtering is expected:**
- TikTok's native Creative Center already provides trend discovery by hashtag, sound, creator, and video type
- Users have mental models of content categories from platform experience
- Without filtering, feed becomes overwhelming noise

**Video preview is non-negotiable:**
- Users make decisions based on first 3 seconds
- Hook quality determines engagement (90% of viral videos score 85+ on hook rating)
- Thumbnail alone is insufficient for video content judgment

---

## Differentiators

Features that set Virtuna apart. Not expected, but create competitive advantage.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Remix action with full storyboard** | Transforms inspiration into actionable filming plan; no competitor offers this | High | AI integration | Key differentiator vs TikTok Creative Center |
| **AI-generated sub-tags** | Auto-categorization beyond fixed categories; reveals hidden patterns | Medium | AI classification | Groups videos by style, hook type, format, emotional arc |
| **Visual storyboard frames** | Shows what to film, not just describes it; reduces creator cognitive load | High | AI image generation | Consider v0 MCP for frame component design |
| **Filming step breakdown** | Specific camera angles, timing, transitions; practical filming guidance | Medium | AI scripting | Includes shot types, duration estimates, B-roll suggestions |
| **PDF export** | Professional output for production planning; shareable with team/friends | Medium | PDF generation | Industry-standard format for shot lists and storyboards |
| **Script generation** | Actual dialogue/voiceover text; ready-to-film scripts with hooks | Medium | AI text generation | Include character count for captions; hook variations |
| **Hook score display** | Shows WHY a video went viral; educational value for creators | Low | Viral Predictor integration | Highlight first 3 seconds importance per 2026 algorithm |
| **Save/bookmark videos** | Build personal trend library; return to inspiration later | Low | User state management | Saves matter more than likes in 2026 TikTok algorithm |
| **Trending velocity indicator** | Shows if trend is rising, peaking, or declining | Medium | Time-series data | Helps creators avoid jumping on dying trends |

### Why These Are Differentiators

**Remix + Storyboard is the core innovation:**
- TikTok Creative Center shows trends but doesn't help you ACT on them
- Existing storyboard tools (Boords, Katalist, StoryboardHero) are generic film production tools:
  - Designed for agencies, filmmakers, corporate videos
  - Require manual script input
  - Not optimized for 15-60 second social content
- Virtuna bridges discovery to execution specifically for short-form viral content
- No competitor offers "see trend -> get complete filming plan" in one workflow

**PDF Export matters for professional creators:**
- 2026 tools like Boords, LTX Studio, StoryboardHero all export PDF
- Professional creators work with teams; need shareable documents
- Industry-standard format for shot lists: PDF, PPT, or PNG exports
- Differentiates from casual tools that only show content in-app

**Hook score provides education, not just analysis:**
- 2026 algorithm prioritizes: watch time, completion rate, engagement velocity
- "A 15-second video watched fully by 80% of viewers will outperform a 60-second video watched halfway"
- Showing creators WHY something worked teaches repeatable skills

**Trending velocity solves timing problem:**
- Creators often see trends too late
- TrendTok Analytics and TickerTrends offer trend velocity tracking
- Showing rising vs. declining trends prevents wasted content creation

---

## Anti-Features

Features to deliberately NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **User-generated content upload** | Scope creep; transforms product into UGC platform; moderation nightmare; not the use case | Focus on curated Apify-sourced content only |
| **Social features (comments, likes on Virtuna)** | Recreates TikTok poorly; users will engage on actual platform; splits attention | Link to original TikTok for social engagement |
| **Real-time trend alerts/notifications** | Push notification fatigue; trends last days not minutes; creates noise | On-demand discovery is sufficient; users visit when ready to create |
| **Video editing tools** | Competes with CapCut (ByteDance's own tool); massive scope; already commoditized | Storyboard is pre-production guidance, not editing |
| **Sound/music library** | Copyright complexity; TikTok has licensed library; legal risk | Reference sounds by name; link to TikTok for audio |
| **AI video generation** | Different product category; high cost; quality concerns; LTX/Katalist already do this | Focus on storyboard/script; users film themselves (authenticity) |
| **Scheduling/posting to TikTok** | OAuth complexity; TikTok API restrictions; not core value prop; crowded space | Stay in inspiration/planning phase only |
| **Detailed analytics dashboard** | Already served by TikTok native analytics + third-party tools; not the use case | Viral Predictor score is sufficient for content analysis |
| **Personalized recommendation algorithm** | Massive ML investment; categories are sufficient for discovery; not the differentiator | Use fixed categories + AI sub-tags instead |
| **Complex onboarding flow** | Research shows lengthy onboarding causes abandonment; users expect immediate value | Start on feed immediately; explain features contextually |
| **Follower/following creator relationships** | Social graph complexity; recreates TikTok poorly; not needed for content discovery | No social features; focus on content, not creators |
| **Multiple video feeds (For You, Following, etc.)** | Increases complexity; TikTok already does this better; one curated feed is sufficient | Single "Trending" feed with category filters |

### Why NOT These Features

**Video editing is the biggest anti-feature trap:**
- CapCut is free, feature-rich, and made by ByteDance (TikTok's owner)
- Building editing competes directly with platform owner's tool
- "CapCut is a TikTok-focused video editor from ByteDance, with templates, transitions, filters"
- Storyboard is differentiated; editing is commoditized

**Social features dilute focus:**
- YouTube is removing its Trending page because "the answer to 'what's trending' was a lot simpler to capture with a singular list... now there are niche communities, fandoms, and micro-trends"
- Adding social features recreates TikTok poorly within Virtuna
- Better to be excellent at discovery + remix than mediocre at everything

**Scheduling/posting adds massive complexity:**
- TikTok API has restrictions on third-party posting
- Shifts product from inspiration tool to social media management tool
- Already crowded space: Later, Buffer, Hootsuite, Sprout Social
- Not the use case for "I want to create content like this"

**Notifications create fatigue:**
- Research shows creators are already overwhelmed with notifications
- "TikTok has launched a new in-app well-being space designed to help users relax, take breaks, and build healthier scrolling habits"
- Trend discovery should be pull (user-initiated), not push (notification-driven)

---

## Feature Dependencies

```
Existing Virtuna Features (already built)
    |
    v
[Viral Predictor] --------> [Analyze Action] (reuse existing)
    |                            |
    v                            v
[Score/Breakdown UI] -----> [Hook Score Display] (extend existing)
    |
    v
[Dashboard] --------------> [Entry point to Trending Page]

New Trending Page Features
    |
    v
[Feed Infrastructure]
    |
    +---> [Infinite Scroll] ------> [Performance: virtualized lists]
    +---> [Category Filters] -----> [Challenges | Sounds | Formats]
    +---> [Video Thumbnails] -----> [9:16 grid, lazy loading]
    +---> [Video Preview] --------> [Autoplay on interaction]
    |
    v
[Action Buttons per Video]
    |
    +---> [Analyze] --> Existing Viral Predictor (reuse)
    |
    +---> [Remix] --> New Remix Flow
           |
           +---> [AI Script Generation] --> Text output
           +---> [Storyboard Frames] -----> AI image generation
           +---> [Filming Steps] ---------> Shot list, angles, timing
           +---> [PDF Export] ------------> Download/share
           |
           v
         [Remix Output View] --> Complex layout (v0 MCP candidate)

[User State]
    |
    +---> [Save/Bookmark] --> Persisted to user profile
```

---

## MVP Recommendation

For MVP, prioritize:

### Must Have (Launch Blockers)

1. **Infinite scroll feed** with thumbnails - core interaction pattern
2. **Category filtering** (Challenges, Sounds, Formats) - navigation
3. **Video preview** - users must see content to evaluate
4. **Analyze action** - integrates with existing Viral Predictor (reuse)
5. **Remix action with script** - core differentiator (text-only for MVP)

### Should Have (Week 1-2 Post-Launch)

6. **AI sub-tags** - enhances discovery beyond fixed categories
7. **Save/bookmark** - builds user engagement and return visits
8. **Basic storyboard** - visual frames alongside script
9. **Hook score highlight** - surface key Viral Predictor insight

### Nice to Have (Post-MVP)

10. **Full storyboard with filming steps** - complete production guide
11. **PDF export** - professional output
12. **Trending velocity indicator** - trend timing guidance

### MVP Rationale

**Why script before full storyboard:**
- Script generation is faster/cheaper than image generation
- Validates user interest in remix feature before heavy AI investment
- Can ship storyboard frames as enhancement once demand proven
- Users can visualize from text; images are enhancement, not necessity

**Why save/bookmark is not MVP:**
- Users can screenshot or copy TikTok links initially
- Adds state management complexity (persistence, sync)
- Focus on core flow: discover -> analyze -> remix
- Can add quickly once core flow validated

**Why PDF export is post-MVP:**
- Requires layout/formatting work
- Script text can be copied initially
- Professional export is valuable but not launch-critical

---

## v0 MCP Considerations

Components that would benefit from AI-assisted design (v0):

| Component | Why v0 | Notes |
|-----------|--------|-------|
| **Storyboard frame card** | Novel UI pattern; no existing component in typical libraries | Shows visual + script + filming notes per shot in cohesive card |
| **Remix output view** | Complex layout; multiple content types need visual hierarchy | Script + steps + frames in scrollable, coherent layout |
| **PDF export template** | Formatted document layout needs design polish | Professional appearance for exported storyboards |
| **Trending velocity badge** | Micro-interaction design; visual indicator states | Rising/peaking/declining with intuitive iconography |
| **Video action bar** | Multiple actions (Analyze, Remix, Save) in compact space | Needs to feel native to video content |

Components to build manually (standard patterns):

- Feed grid (standard infinite scroll implementation)
- Category chips/tabs (use existing Shadcn/UI components)
- Video player (use existing library: react-player, video.js)
- Save button (simple state toggle with icon)
- Loading skeletons (standard pattern)

---

## User Behavior Expectations

Based on 2026 research, users expect:

### Feed Behavior
- **Scroll deeply** - Users browse without specific endpoint in mind
- **Quick judgment** - 1-3 seconds per video thumbnail before scroll or tap
- **Category hopping** - Users switch between Challenges/Sounds/Formats frequently
- **Return visits** - Come back when planning content (not daily habit like TikTok itself)

### Analysis Behavior
- **Selective analysis** - Only analyze videos they're seriously considering
- **Score interpretation** - Expect explanation, not just number
- **Comparison** - May analyze multiple videos to compare scores

### Remix Behavior
- **Action-oriented** - Users who tap Remix want output they can use
- **Quick review** - Scan script/storyboard, not deep read
- **Export intent** - Likely want to save or share output
- **Iteration** - May want to remix same video differently (future feature)

### Platform Expectations (from TikTok)
- **First 3 seconds matter** - Conditioned to judge by hook quality
- **Saves = value** - Saving indicates content worth returning to
- **Silent viewing** - Expect muted autoplay, tap for sound
- **Vertical video** - 9:16 aspect ratio is the standard

---

## Complexity Assessment

| Feature | Complexity | Effort Estimate | Risk |
|---------|------------|-----------------|------|
| Infinite scroll feed | Medium | 1-2 days | Low (standard pattern) |
| Category filtering | Low | 0.5 day | Low |
| Video thumbnails | Low | 0.5 day | Low |
| Video preview | Medium | 1 day | Medium (performance) |
| Analyze action | Low | 0.5 day | Low (reuses existing) |
| Remix with script | High | 3-5 days | Medium (AI integration) |
| AI sub-tags | Medium | 2 days | Medium (classification accuracy) |
| Save/bookmark | Low | 1 day | Low |
| Storyboard frames | High | 3-5 days | High (image generation cost/quality) |
| Filming steps | Medium | 1-2 days | Medium |
| PDF export | Medium | 2 days | Low |
| Trending velocity | Medium | 2 days | Medium (data pipeline needed) |

---

## Sources

### Feed UX & Discovery
- [TikTok Algorithm Guide 2026 - Buffer](https://buffer.com/resources/tiktok-algorithm/)
- [TikTok Trend Discovery Guide - OneStream](https://onestream.live/blog/tiktok-trend-discovery-guide/)
- [Infinite Scroll Best Practices - Justinmind](https://www.justinmind.com/ui-design/infinite-scroll)
- [Activity Feed Design Guide - GetStream](https://getstream.io/blog/activity-feed-design/)
- [UX Design for Video Streaming Apps - NetSolutions](https://www.netsolutions.com/insights/video-streaming-apps-ux-design/)
- [YouTube Ends Trending Page - eMarketer](https://www.emarketer.com/content/youtube-ends-trending-page-prioritize-algorithmic-feeds-hyper-specific-categories)

### Storyboard & Remix Tools
- [Boords - Best Storyboard Software 2026](https://boords.com/best-storyboard-software)
- [Boords - AI Storyboard Generators 2026](https://boords.com/blog/the-6-best-ai-storyboard-generators)
- [LTX Studio - AI Storyboard Generator](https://ltx.studio/platform/ai-storyboard-generator)
- [StoryboarderAI](https://storyboarder.ai/)
- [Katalist.ai - Storyboard AI](https://www.katalist.ai)
- [StoryboardHero](https://storyboardhero.ai/)
- [StudioBinder - Shot List & Storyboard](https://www.studiobinder.com/shot-list-storyboard/)
- [Studiovity - Shotlist Storyboard](http://studiovity.com/shotlist-storyboard/)

### Viral Prediction Tools
- [quso.ai Virality Score](https://quso.ai/products/virality-score)
- [Go Viral - AI Creator Toolkit](https://trygoviral.com/)
- [StreamLadder AI Virality Score](https://streamladder.com/clipgpt-features/ai-virality-score)
- [AI Tools for Predicting Video Virality - StoryShort](https://storyshort.ai/en/blog/ai-tools-for-predicting-video-virality)

### Trend Tracking
- [TrendTok Analytics App](https://apps.apple.com/us/app/trendtok-analytics-tracker/id1550778062)
- [TickerTrends - TikTok Trend Intelligence](https://www.tickertrends.io/tiktok-trends)
- [TikTok Next 2026 Trend Report](https://ads.tiktok.com/business/en/next)
- [Shopify - TikTok Trend Discovery](https://www.shopify.com/blog/tiktok-trend-discovery)
- [Shopify - TikTok Trends 2026](https://www.shopify.com/blog/tiktok-trends)

### UX Anti-Patterns
- [UX Benchmarking: Content Discovery on OTT - Medium](https://medium.com/peepaldesign/ux-benchmarking-ott-platforms-c33bee54faeb)
- [6 UX Guidelines for Streaming Platforms - Medium](https://medium.com/design-bootcamp/6-ux-guidelines-for-streaming-platforms-d315396a3178)
- [Top 5 UX/UI Design Mistakes - Wezom](https://wezom.com/blog/top-5-uxui-mistakes-to-avoid-when-developing-a-mobile-app)
- [UX Patterns Infinite Scroll - UXPatterns.dev](https://uxpatterns.dev/patterns/navigation/infinite-scroll)

### Content Creation & MVP
- [How to Build an MVP - Syndicode](https://syndicode.com/blog/how-to-build-an-mvp/)
- [Content Creator's Toolbox 2025 - Kontent.ai](https://kontent.ai/blog/10-insights-from-content-creators-toolbox/)
- [TikTok Algorithm 2026 - Medium](https://medium.com/@daniel.belhart/what-the-tiktok-algorithm-in-2026-actually-prioritizes-and-why-its-different-from-instagram-05b6a74a773d)
