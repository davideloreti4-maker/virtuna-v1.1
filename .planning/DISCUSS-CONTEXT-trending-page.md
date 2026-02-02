# Discussion Context: Trending Page (v1.5)

**Status:** COMPLETE — Ready for requirements
**Last updated:** 2026-02-02

---

## Decisions Made

### Feed Structure

**Approach:** Dashboard overview + drill-down

- **Home state:** Dashboard with category sections (Breaking Out, Sustained Viral, Resurging)
- **Drill-down:** Click category → grid/list view of all videos in that category
- **Deep dive:** Click video → detail modal with Analyze/Remix actions

Supports all use cases:
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
- Exclude outliers
- Minimum sample size required

### Video Card Design

```
┌─────────────────────────────────┐
│ [Thumbnail Preview]             │
│ @creator_handle                 │
│ 🔥 46x their average            │  ← PRIMARY
│ 2.3M views · 18h ago            │  ← SECONDARY
│ #challenge                      │  ← Category tag
└─────────────────────────────────┘
```

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

- User sets primary + secondary niches during onboarding/settings
- Feed prioritizes relevant content (~70% primary, ~20% secondary, ~10% cross-niche)
- AI classifies videos by niche based on content, hashtags, audio, creator profile

---

## Remix Flow (COMPLETE)

### Entry Points
1. **Trending Page** — Tap "Remix" on any video card
2. **Paste URL** — Direct input of any TikTok video URL

### Flow
```
Source video → Analysis (same as predictor) → Remix form → Generate → 3 Remixes → Save/Use
```

### Remix Inputs

**Required:**
| Input | Type | Source |
|-------|------|--------|
| Source video | URL or selection | Paste or tap from Trending |
| Niche | Selection | Default from profile, can override |
| Goal | Selection (1 of 6) | See goals below |

**Goals (6 options):**
1. Maximize reach — "I want this to go viral"
2. Grow followers — "I want new followers"
3. Build authority — "I want to be seen as the expert"
4. Drive sales — "I want people to buy/book"
5. Educate — "I want to teach something valuable"
6. Entertain — "I want to make people laugh/feel"

**Optional Tweaks:**
| Tweak | Type | Example |
|-------|------|---------|
| Target audience | Text or selection | "Beginners", "Busy moms" |
| Tone/style | Selection | Casual, Professional, Raw, Polished, Funny, Serious |
| Constraints | Multi-select + text | No face, Under 30 sec, etc. |
| Brand voice notes | Text | "I always open with a question" |
| Format preference | Selection | Talking head, B-roll heavy, Text overlay, Green screen |

**Save as default:** Optional checkbox to save tweaks for future remixes

### Remix Output: 3 Full Production Briefs

Each remix includes:
- **Hook** (first 3 seconds)
- **Shot list** (visual breakdown)
- **Full script**
- **Audio suggestion**
- **CTA**
- **Hashtags**
- **Filming tips**

### Remix Features (Full Experience)

| Feature | Description |
|---------|-------------|
| Progressive loading | Show preview instantly, breakdown loads progressively |
| Teleprompter mode | Full-screen scrolling script for filming |
| Clipboard auto-detect | Pre-fill if TikTok URL copied |
| Regenerate / "More like this" | Get new remixes or variations |
| Status tracking | To Film / Filmed / Posted tags |
| Mobile-first design | Optimized for phone use |
| Copy sections | One-tap copy hook, script, or full brief |
| Save as default | Optional save of preferences |

---

## Analyze Action

Same system as viral predictor results card.
**Separate discussion needed:** `.planning/DISCUSS-CONTEXT-viral-predictor-results.md`

---

## Data Pipeline

**Source:** Apify TikTok scraper (Instagram later)

**Processing:**
1. Fetch trending videos via Apify
2. Fetch creator's historical performance (last 30 days)
3. Calculate views multiplier
4. AI classify: niche, content type, strategic tags
5. Filter for quality (narrow but high signal)
6. Store in database

---

## Technical Requirements

### Backend
- Apify TikTok scraper integration
- Database for video metadata + creator baselines
- Background jobs for data refresh
- AI classification pipeline (niche, tags)
- Remix generation API (LLM-powered)

### Frontend
- Dashboard view with category sections
- Grid/list drill-down views
- Video detail modal
- Remix form with inputs
- Teleprompter mode
- Niche selection UI (onboarding + settings)
- Filter chips
- Status tracking UI

---

## Next Steps

**This discussion is COMPLETE.**

To proceed:
1. `/clear` for fresh context
2. Run `/gsd:new-milestone` to continue requirements → roadmap
3. Reference this file for context

---

*Created: 2026-02-02*
*Status: Complete — ready for requirements*
