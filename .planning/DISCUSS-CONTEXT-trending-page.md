# Discussion Context: Trending Page (v1.5)

**Status:** In progress — feed structure defined, Remix flow pending
**Last updated:** 2026-02-02

---

## Decisions Made

### Feed Structure

**Approach:** Dashboard overview + drill-down

- **Home state:** Dashboard with category sections (Breaking Out, Sustained Viral, Resurging)
- **Drill-down:** Click category → grid/list view of all videos in that category
- **Deep dive:** Click video → detail modal with Analyze/Remix actions

This supports all three use cases:
- Discovery browsing (dashboard overview)
- Research/analysis (grid view for scanning)
- Content planning (quick path to Analyze/Remix)

### Primary Metric: Views Multiplier

**Formula:**
```
Multiplier = This Video's Views / Creator's Average Video Views (last 30 days)
```

**Why this metric:**
1. Surfaces videos the TikTok algo "chose" to push
2. Independent of follower count (aligns with TikTok's approach)
3. Identifies pattern-breaking content worth studying
4. Triggers curiosity: "46x average — what did they do?"

**Baseline calculation:**
- Last 30 days of creator's videos
- Exclude outliers (so one viral video doesn't skew baseline)
- Minimum sample size required

### Video Card Design

```
┌─────────────────────────────────┐
│ [Thumbnail Preview]             │
│ @creator_handle                 │
│ 🔥 46x their average            │  ← PRIMARY: Why this matters
│ 2.3M views · 18h ago            │  ← SECONDARY: Scale + recency
│ #challenge                      │  ← Category tag
└─────────────────────────────────┘
```

**Info shown at a glance:**
- Thumbnail (video preview)
- Creator handle
- Views multiplier (primary hook)
- Raw view count + recency
- Category/niche tag

### Category System

**Primary (feed organization):** Behavioral categories
| Category | Definition |
|----------|------------|
| 🔥 Breaking Out | High velocity in last 24h |
| 📈 Sustained Viral | Consistent performance 3-7 days |
| 🔄 Resurging | Old content getting new traction |

**Secondary (filter chips):** Content type + Strategic tags
- Content: Challenge, Tutorial, Story, Comedy, Reaction, Aesthetic
- Strategic: High Remix Potential, Niche Breakout, Trending Sound

### Niche Personalization

**Yes — niche-specific feed**

- User sets primary + secondary niches during onboarding/settings
- Feed prioritizes relevant content (~70% primary, ~20% secondary, ~10% cross-niche breakouts)
- AI classifies videos by niche based on content, hashtags, audio, creator profile

---

## Still To Discuss

### Remix Action Flow

What we know:
- Remix generates 2-3 customized versions
- Includes: hooks, scripts, CTAs
- Tailored to user's goal, audience, niche
- Output should be actionable (ready to film/upload)

Questions to answer:
- What's the UX flow? Modal? Separate page? Side panel?
- What inputs does user provide? (Goal, audience, style preferences)
- What exactly is in each remix? (Hook text, full script, shot list, CTA?)
- How long does generation take? Loading state?
- Can user save/export remixes?
- Integration with user's brand voice/style (if captured elsewhere)?

### Analyze Action

Deferred to separate session — same system as viral predictor results card.
Context file: `.planning/DISCUSS-CONTEXT-viral-predictor-results.md`

---

## Dashboard Layout Sketch

```
┌─────────────────────────────────────────────────────┐
│ TRENDING                          [Niche: Fitness ▼]│
├─────────────────────────────────────────────────────┤
│ 🔥 Breaking Out (47)                      [View All]│
│ [All] [Challenge] [Tutorial] [Comedy] ...           │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ →→→            │
│ │ 46x avg │ │ 38x avg │ │ 29x avg │                │
│ │ 2.3M    │ │ 1.8M    │ │ 890K    │                │
│ └─────────┘ └─────────┘ └─────────┘                │
├─────────────────────────────────────────────────────┤
│ 📈 Sustained Viral (23)                   [View All]│
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ →→→            │
│ │ 12x avg │ │ 9x avg  │ │ 8x avg  │                │
│ └─────────┘ └─────────┘ └─────────┘                │
├─────────────────────────────────────────────────────┤
│ 🔄 Resurging (8)                          [View All]│
│ ...                                                 │
└─────────────────────────────────────────────────────┘
```

---

## Data Pipeline

**Source:** Apify TikTok scraper (Instagram later)

**Processing needed:**
1. Fetch trending videos via Apify
2. For each video, fetch creator's historical performance (last 30 days)
3. Calculate views multiplier
4. AI classify: niche, content type, strategic tags
5. Filter for quality (remove low-quality content)
6. Store in database with metadata

**Quality curation:**
- AI-filtered, not raw dump
- Narrow but high signal
- Parameters TBD for what makes content "quality"

---

## Technical Considerations

### Backend Requirements
- Apify integration (TikTok scraper)
- Database for video metadata + creator baselines
- Background jobs for data refresh
- AI classification pipeline (niche, tags)

### Frontend Requirements
- Dashboard view with category sections
- Grid/list drill-down views
- Video detail modal
- Niche selection UI (onboarding + settings)
- Filter chips for content/strategic tags

---

## Resume Point

To continue this discussion:
1. Run `/gsd:discuss-phase` or start new conversation
2. Reference this file for context
3. Pick up at "Remix Action Flow" section

---

*Created: 2026-02-02*
*Status: In progress*
