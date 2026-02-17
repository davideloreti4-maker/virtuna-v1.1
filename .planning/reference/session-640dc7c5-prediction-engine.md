# Virtuna Prediction Engine — Architecture Reference
> Source: Session 640dc7c5 (2026-02-03) | Refined: 2026-02-10

---

## AI Model Assignments

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          MODEL STACK                                     │
│                                                                          │
│   ┌──────────────────────────────┐  ┌──────────────────────────────┐    │
│   │        GEMINI FLASH          │  │        DEEPSEEK R1           │    │
│   │        (Visual Brain)        │  │        (Reasoning Brain)     │    │
│   │                              │  │                              │    │
│   │  Multimodal analysis:        │  │  Chain-of-thought reasoning: │    │
│   │                              │  │                              │    │
│   │  • Video frame extraction    │  │  • Expert rule evaluation    │    │
│   │    & first-3s hook scoring   │  │    (match content against    │    │
│   │                              │  │    rule library, explain     │    │
│   │  • Thumbnail quality &       │  │    WHY rules match/fail)    │    │
│   │    click-through prediction  │  │                              │    │
│   │                              │  │  • Pattern recognition       │    │
│   │  • Visual hook detection     │  │    (curiosity gap? negative  │    │
│   │    (text overlays, faces,    │  │    bias? question hook?)     │    │
│   │    motion, cuts)             │  │                              │    │
│   │                              │  │  • Suggestion generation     │    │
│   │  • Scene composition &       │  │    (actionable improvements  │    │
│   │    pacing analysis           │  │    with reasoning chain)     │    │
│   │                              │  │                              │    │
│   │  • Format/aspect ratio       │  │  • Score synthesis           │    │
│   │    detection                 │  │    (weigh all signals,       │    │
│   │                              │  │    explain the final score)  │    │
│   │  Cost: ~$0.01/video          │  │                              │    │
│   │  Latency: 1-2s              │  │  • Society persona reactions │    │
│   │                              │  │    (simulate how each        │    │
│   │  WHY GEMINI:                 │  │    audience segment thinks   │    │
│   │  Best price/perf for         │  │    about the content)        │    │
│   │  multimodal. Native video    │  │                              │    │
│   │  understanding, not just     │  │  Cost: ~$0.003/analysis      │    │
│   │  frame sampling.             │  │  Latency: 2-4s              │    │
│   │                              │  │                              │    │
│   │                              │  │  WHY DEEPSEEK:               │    │
│   │                              │  │  Strongest reasoning at      │    │
│   │                              │  │  lowest cost. Thinking       │    │
│   │                              │  │  tokens show the "why"       │    │
│   │                              │  │  behind every score.         │    │
│   └──────────────────────────────┘  └──────────────────────────────┘    │
│                                                                          │
│   Pipeline mapping:                                                      │
│                                                                          │
│   INPUT NORMALIZATION ──── code only (no AI)                            │
│   HOOK ANALYZER ────────── Gemini (visual) + DeepSeek (pattern match)   │
│   AUDIO MATCHER ────────── DB lookup only (no AI)                       │
│   TEXT ANALYZER ────────── DeepSeek (caption/hashtag reasoning)          │
│   CREATOR CONTEXT ──────── DB lookup only (no AI)                       │
│   EXPERT RULES ─────────── DeepSeek (evaluate rules against content)    │
│   TREND VELOCITY ───────── DB lookup only (no AI)                       │
│   SCORE AGGREGATION ────── DeepSeek (synthesize all signals → score)    │
│   SUGGESTIONS ──────────── DeepSeek (generate actionable improvements)  │
│   SOCIETY REACTIONS ────── DeepSeek (persona-voiced audience sim)        │
│                                                                          │
│   Total cost per analysis: ~$0.013                                      │
│   Total latency: 3-5s (Gemini + DeepSeek run in parallel)              │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## System Overview

Two independent systems share an API call but serve different purposes:

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT (Next.js)                           │
│                                                                     │
│   User submits content ──▶ POST /api/analyze                       │
│                                  │                                  │
│            ┌─────────────────────┼──────────────────────┐          │
│            │                     │                      │          │
│            ▼                     ▼                      ▼          │
│   ┌────────────────┐   ┌──────────────┐   ┌────────────────────┐  │
│   │  SIMULATION    │   │  PREDICTION  │   │  RESULTS CARD      │  │
│   │  (Theater)     │   │  ENGINE      │   │  (Value Delivery)  │  │
│   │                │   │  (Backend)   │   │                    │  │
│   │  Plays         │   │              │   │  Renders when      │  │
│   │  immediately   │   │  Returns     │   │  engine responds   │  │
│   │  on submit     │   │  score +     │   │                    │  │
│   │                │   │  insights    │   │  Score + breakdown  │  │
│   │  4-5s animated │   │  async       │   │  + suggestions     │  │
│   │  loading state │   │              │   │                    │  │
│   └────────────────┘   └──────────────┘   └────────────────────┘  │
│   NO backend logic      ALL backend logic   Displays engine output │
│   Pure client anim      Source of truth      Where users get value │
└─────────────────────────────────────────────────────────────────────┘
```

**The simulation starts instantly on the client while the engine processes on the server.** The animation is timed to match typical engine response time (~3-5s). If the engine responds faster, hold the animation to minimum duration. If slower, loop the final phase.

### Server-Side Model Flow (inside Prediction Engine)

```
POST /api/analyze
        │
        ├──────────────────────────────────────────────┐
        │ PARALLEL                                      │
        ▼                                               ▼
┌───────────────────────┐              ┌───────────────────────────┐
│  🔷 GEMINI FLASH      │              │  📦 DB LOOKUPS            │
│                       │              │                           │
│  Video → frames →     │              │  Audio ID → trending?     │
│  visual hook score,   │              │  Creator ID → baseline    │
│  thumbnail quality,   │              │  Hashtags → velocity      │
│  scene composition    │              │                           │
│                       │              │  No AI cost, <100ms       │
│  ~1-2s, ~$0.01       │              └─────────────┬─────────────┘
└───────────┬───────────┘                            │
            │                                        │
            └──────────────┬─────────────────────────┘
                           │  all signals collected
                           ▼
              ┌─────────────────────────┐
              │  🔶 DEEPSEEK R1         │
              │                         │
              │  Single call that:      │
              │  1. Evaluates rules     │
              │  2. Synthesizes score   │
              │  3. Generates actions   │
              │  4. Simulates societies │
              │                         │
              │  ~2-4s, ~$0.003         │
              └─────────────┬───────────┘
                            │
                            ▼
                    PredictionResult
                    (score + reasoning +
                     suggestions + society
                     reactions)
```

**Total: ~3-5s, ~$0.013 per analysis** (Gemini + DeepSeek run in parallel with DB lookups, then DeepSeek does the thinking)

---

## Prediction Engine — Internal Pipeline

```
                        ┌──────────────────────┐
                        │     USER INPUT       │
                        │                      │
                        │  Video file?         │
                        │  Script/caption?     │
                        │  Thumbnail?          │
                        │  Hashtags?           │
                        │  Platform target?    │
                        │  Creator profile?    │
                        └──────────┬───────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │   INPUT NORMALIZATION       │
                    │                              │
                    │   Determine what we have:    │
                    │   video → extract frames,    │
                    │           audio, transcript  │
                    │   script only → text signals │
                    │   no creator → skip baseline │
                    │                              │
                    │   Output: ContentPayload     │
                    │   {                           │
                    │     transcript?: string       │
                    │     audioId?: string          │
                    │     thumbnailUrl?: string     │
                    │     hashtags?: string[]       │
                    │     duration?: number         │
                    │     platform: Platform        │
                    │     creatorId?: string        │
                    │   }                           │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    SIGNAL EXTRACTION LAYER                           │
│                                                                      │
│   Runs in parallel — each extractor is independent                  │
│                                                                      │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│   │    HOOK      │ │   AUDIO     │ │   TEXT      │ │  CREATOR    │ │
│   │  ANALYZER    │ │  MATCHER    │ │  ANALYZER   │ │  CONTEXT    │ │
│   │             │ │             │ │             │ │             │ │
│   │ 🔷 GEMINI   │ │ 📦 DB      │ │ 🔶 DEEPSEEK│ │ 📦 DB      │ │
│   │ + DEEPSEEK  │ │   LOOKUP    │ │             │ │   LOOKUP    │ │
│   │             │ │             │ │             │ │             │ │
│   │ Gemini:     │ │ Sound ID →  │ │ Caption     │ │ Avg views   │ │
│   │ frame-by-   │ │ lookup in   │ │ sentiment,  │ │ Follower    │ │
│   │ frame visual│ │ trending    │ │ hashtag     │ │ count,      │ │
│   │ analysis,   │ │ sounds DB   │ │ relevance,  │ │ niche,      │ │
│   │ hook detect │ │             │ │ CTA detect  │ │ post freq   │ │
│   │             │ │ Returns:    │ │ length      │ │             │ │
│   │ DeepSeek:   │ │ trending?   │ │             │ │ "Viral" is  │ │
│   │ pattern     │ │ velocity    │ │ Duration    │ │ relative to │ │
│   │ classify    │ │ usage count │ │ vs platform │ │ this creator│ │
│   │ (question?  │ │             │ │ sweet spot  │ │             │ │
│   │ neg. bias?) │ │ No AI cost  │ │             │ │ No AI cost  │ │
│   └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ │
│          │               │               │               │        │
│          └───────────────┴───────────────┴───────────────┘        │
│                                  │                                  │
│                    FeatureVector {                                  │
│                      hookScore: number        // 0-100             │
│                      hookPattern: string      // "question" etc    │
│                      audioTrending: boolean                        │
│                      audioVelocity: number    // usage growth/hr   │
│                      captionScore: number     // 0-100             │
│                      hashtagRelevance: number // 0-100             │
│                      durationFit: number      // 0-100             │
│                      creatorBaseline: number  // avg views         │
│                      platform: Platform                            │
│                    }                                                │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                 ┌─────────────────┼─────────────────┐
                 │                 │                  │
                 ▼                 ▼                  ▼
┌─────────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
│    EXPERT RULES     │ │ TREND VELOCITY  │ │     ML MODEL        │
│                     │ │                 │ │                     │
│  🔶 DEEPSEEK R1    │ │ 📦 DB LOOKUP   │ │  Classification     │
│                     │ │                 │ │  model trained on:  │
│  DeepSeek evaluates │ │ Is this sound   │ │                     │
│  content against    │ │ rising/peaked?  │ │  - Scraped viral    │
│  rule library with  │ │                 │ │    videos (Apify    │
│  chain-of-thought:  │ │ Is this format  │ │    5K+/day)         │
│                     │ │ saturated?      │ │                     │
│  "The hook uses a   │ │                 │ │  - User outcome     │
│  curiosity gap      │ │ Hashtag growth  │ │    reports           │
│  pattern: 'You      │ │ rate (rising    │ │                     │
│  won't believe...'  │ │ vs declining)   │ │  Output:            │
│  → +12. But the     │ │                 │ │  probability 0-1    │
│  first 2s are slow  │ │ Window:         │ │  + confidence 0-1   │
│  → -20 penalty."    │ │ last 24h vs     │ │                     │
│                     │ │ last 7d         │ │  If confidence      │
│  Hook rules         │ │                 │ │  < 0.85 → flag as  │
│  ├ Question hook    │ │ Output:         │ │  "uncertain"        │
│  │ → +15 score     │ │ trendScore 0-1  │ │                     │
│  ├ Curiosity gap   │ │ trendPhase:     │ │  ⚠ Only available  │
│  │ → +12 score     │ │ "rising" |      │ │  after 1000+        │
│  └ Negative bias   │ │ "peak" |        │ │  outcome reports    │
│    → +10 score     │ │ "declining"     │ │                     │
│                     │ │                 │ │  Before that:       │
│  Retention rules    │ │ No AI cost      │ │  returns null,      │
│  ├ Slow start      │ │                 │ │  pipeline uses      │
│  │ → -20 penalty   │ │                 │ │  rules + trends     │
│  └ No payoff       │ │                 │ │  only               │
│    → -15 penalty   │ │                 │ │                     │
│                     │ │                 │ │                     │
│  Platform rules     │ │                 │ │                     │
│  ├ TikTok: 15-60s │ │                 │ │                     │
│  ├ Reels: 15-30s  │ │                 │ │                     │
│  └ Shorts: <60s   │ │                 │ │                     │
│                     │ │                 │ │                     │
│  Output:            │ │                 │ │                     │
│  ruleScore 0-100    │ │                 │ │                     │
│  matchedRules[]     │ │                 │ │                     │
│  penalties[]        │ │                 │ │                     │
│  reasoning: string  │ │                 │ │                     │
│                     │ │                 │ │                     │
│  ✅ Available       │ │ ✅ Available     │ │                     │
│  from day 1        │ │ after Apify     │ │                     │
│                     │ │ setup           │ │                     │
└──────────┬──────────┘ └────────┬────────┘ └──────────┬──────────┘
           │                     │                      │
           │ ruleScore           │ trendScore            │ mlScore?
           │ matchedRules[]      │ trendPhase            │ mlConfidence?
           │ penalties[]         │                      │
           └─────────────────────┼──────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      SCORE AGGREGATION                              │
│                      🔶 DEEPSEEK R1                                 │
│                                                                      │
│   DeepSeek synthesizes all signals into a final score with          │
│   chain-of-thought reasoning explaining the weighting:              │
│                                                                      │
│   Weights adapt based on what's available:                          │
│                                                                      │
│   Phase 1 (rules only):                                             │
│     finalScore = ruleScore                                          │
│                                                                      │
│   Phase 2 (rules + trends):                                        │
│     finalScore = (ruleScore × 0.6) + (trendScore × 0.4)           │
│                                                                      │
│   Phase 4 (rules + trends + ML):                                   │
│     if mlConfidence >= 0.85:                                        │
│       finalScore = (ruleScore × 0.25) + (trendScore × 0.25)       │
│                   + (mlScore × 0.50)                                │
│     else:                                                           │
│       finalScore = (ruleScore × 0.55) + (trendScore × 0.45)       │
│       flag: "low ML confidence, using rules + trends"              │
│                                                                      │
│   Edge cases:                                                       │
│   - No audio → drop audio weight, redistribute                     │
│   - No creator profile → skip baseline, note in output             │
│   - Script-only (no video) → Gemini skipped, DeepSeek only         │
│                                                                      │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      OUTPUT ASSEMBLY                                │
│                      🔶 DEEPSEEK R1                                 │
│                                                                      │
│   DeepSeek generates actionable suggestions and society             │
│   persona reactions from the final score + feature vector:          │
│                                                                      │
│   PredictionResult {                                                │
│     score: number                  // 0-100, the ONE number         │
│     confidence: "high" | "medium" | "low"                          │
│     reasoning: string              // DeepSeek's thinking chain     │
│     factors: {                                                      │
│       hook:    { score, pattern, suggestion? }                     │
│       audio:   { score, trending, suggestion? }                    │
│       text:    { score, suggestion? }                              │
│       timing:  { score, trendPhase, suggestion? }                  │
│       creator: { score, baseline, suggestion? }                    │
│     }                                                               │
│     suggestions: string[]          // DeepSeek-generated actions    │
│     societyReactions: {            // DeepSeek persona simulation   │
│       genZ:      { reaction, sentiment, wouldShare }               │
│       career:    { reaction, sentiment, wouldShare }               │
│       parents:   { reaction, sentiment, wouldShare }               │
│       creative:  { reaction, sentiment, wouldShare }               │
│       knowledge: { reaction, sentiment, wouldShare }               │
│     }                                                               │
│     warnings: string[]             // "low confidence" etc          │
│     meta: {                                                         │
│       engineVersion: string                                         │
│       modelsUsed: string[]         // ["gemini", "deepseek", "ml"] │
│       processingMs: number                                          │
│       geminiMs: number             // visual analysis time          │
│       deepseekMs: number           // reasoning time                │
│     }                                                               │
│   }                                                                 │
│                                                                      │
│   Example DeepSeek suggestion output:                               │
│   - "Shorten hook to under 2s — your first 3s are slow"           │
│   - "This sound is trending UP — good timing"                      │
│   - "Add a CTA — your caption has no call to action"              │
│   - "Post between 6-8pm for your audience"                         │
│   - "This format is saturated — 2000+ similar posts today"        │
│                                                                      │
│   Example DeepSeek society reaction:                                │
│   genZ: {                                                           │
│     reaction: "The hook is mid but the sound saves it.             │
│                I'd watch to the end but probably not share.",       │
│     sentiment: "neutral-positive",                                  │
│     wouldShare: false                                               │
│   }                                                                 │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Data Stores

```
┌──────────────────────────────────────────────────────────────────┐
│                        SUPABASE                                  │
│                                                                  │
│  ┌─────────────────────┐  ┌──────────────────────────────────┐  │
│  │  outcomes            │  │  scraped_videos                  │  │
│  │                     │  │                                  │  │
│  │  content_id     FK  │  │  video_id          PK            │  │
│  │  predicted_score    │  │  platform                        │  │
│  │  actual_views       │  │  view_count                      │  │
│  │  actual_engagement  │  │  engagement_rate                 │  │
│  │  actual_shares      │  │  audio_id                        │  │
│  │  reported_at        │  │  hashtags          jsonb         │  │
│  │  delta              │  │  duration                        │  │
│  │  (predicted - actual)│  │  creator_followers              │  │
│  └─────────────────────┘  │  scraped_at                      │  │
│                           └──────────────────────────────────┘  │
│  ┌─────────────────────┐  ┌──────────────────────────────────┐  │
│  │  trending_sounds    │  │  rule_library                    │  │
│  │                     │  │                                  │  │
│  │  audio_id       PK  │  │  rule_id           PK            │  │
│  │  usage_count_24h    │  │  category                        │  │
│  │  usage_count_7d     │  │  pattern                         │  │
│  │  velocity           │  │  score_modifier     int          │  │
│  │  phase: rising |    │  │  platform           nullable     │  │
│  │    peak | declining │  │  active              bool        │  │
│  │  updated_at         │  │  evidence_count      int         │  │
│  └─────────────────────┘  └──────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Background Jobs (not in the request/response path)

```
┌────────────────────────────────────────────────────────────────┐
│                     CRON / BACKGROUND                          │
│                                                                │
│  ┌─────────────────────┐    Runs: every 6 hours               │
│  │  APIFY SCRAPER      │    Scrapes 5K+ trending videos       │
│  │                     │    Writes to: scraped_videos          │
│  └─────────────────────┘                                       │
│                                                                │
│  ┌─────────────────────┐    Runs: hourly                      │
│  │  TREND CALCULATOR   │    Calculates velocity from          │
│  │                     │    scraped_videos → trending_sounds  │
│  └─────────────────────┘    Flags rising/peak/declining       │
│                                                                │
│  ┌─────────────────────┐    Runs: weekly (when data exists)   │
│  │  ML RETRAINER       │    Retrains model on new outcomes    │
│  │                     │    + scraped data                    │
│  └─────────────────────┘    Only after 1000+ outcome rows     │
│                                                                │
│  ┌─────────────────────┐    Runs: daily                       │
│  │  RULE VALIDATOR     │    Compares rule predictions vs      │
│  │                     │    actual outcomes                   │
│  └─────────────────────┘    Adjusts score_modifier weights    │
└────────────────────────────────────────────────────────────────┘
```

---

## Build Phases

```
PHASE 1 (Week 1-2)                    PHASE 2 (Week 2-3)
┌──────────────────────────┐          ┌──────────────────────────┐
│ Signal extraction        │          │ Apify scraper setup      │
│ Expert rules engine      │          │ Trending sounds DB       │
│ Score aggregation (rules │          │ Trend velocity calc      │
│   only, no ML)           │          │ Aggregation adds trend   │
│ Output assembly          │          │   weights                │
│ POST /api/analyze        │          │                          │
│                          │    ────▶ │ Input: real trend data   │
│ Input: content only      │          │ Output: score + timing   │
│ Output: score + rules    │          │   insights               │
└──────────────────────────┘          └──────────────────────────┘
     Delivers value                        Adds timing signal
     immediately                           "this sound is rising"

PHASE 3 (Week 3-4)                    PHASE 4 (Month 2+)
┌──────────────────────────┐          ┌──────────────────────────┐
│ Outcome tracking UI      │          │ Train ML model on        │
│ outcomes table            │          │   scraped + outcomes     │
│ "How did this perform?"  │          │ Confidence thresholds    │
│   prompt after posting   │          │ Aggregation adds ML      │
│ Delta tracking           │          │   weights (50% when      │
│   (predicted vs actual)  │    ────▶ │   confidence >= 0.85)    │
│                          │          │                          │
│ Input: user reports      │          │ Input: training data     │
│ Output: growing dataset  │          │ Output: highest accuracy │
└──────────────────────────┘          └──────────────────────────┘
     Building ground truth                 The accuracy jump
     for ML training                       75-85% range

PHASE 5 (Month 3+)
┌──────────────────────────┐
│ Calibration loop         │
│ Rule weight auto-tuning  │
│ Weekly retraining        │
│ Confidence reporting     │
│                          │
│ Hard ceiling: 80-85%     │
│ (irreducible randomness: │
│  algo mood, luck,        │
│  external events)        │
└──────────────────────────┘
     Self-improving system
```

---

## Simulation Layer (Client-Side Only)

```
TIMELINE (4.5s total)

0.0s ─── PHASE 1: APPEAR ──────────────────────────
         Thumbnail fades in at center (120x120, 16px radius)
         5 society nodes fade in dim (opacity 0.3)
         Pentagon layout, 140px from center

0.5s ─── PHASE 2: CONNECT ─────────────────────────
         Dashed lines draw from each node toward center
         Dash-offset animates (flowing toward thumbnail)
         Subtle glow pulse on thumbnail border

1.2s ─── PHASE 3: ACTIVATE ────────────────────────
         Nodes light up one by one (0.4s interval):
           Gen-Z → Career → Parents → Creative → Knowledge
         Each node: opacity 0.3 → 1.0, scale 1.0 → 1.1 → 1.0
         Connection line brightens when node activates

3.2s ─── PHASE 4: CONVERGE ────────────────────────
         Energy particles flow from all nodes to center
         Thumbnail glow intensifies
         All nodes pulse together

4.0s ─── PHASE 5: RESOLVE ─────────────────────────
         Flash/bloom on thumbnail
         Nodes settle, lines solidify
         Transition to results card

4.5s ─── RESULTS CARD RENDERS ─────────────────────
         (or hold phase 4 loop if engine still processing)


LAYOUT:

              ●  Gen-Z
             ╱
       ●────┌──────┐────●  Career
    Creative│ 📷   │
            │thumb │
            └──────┘────●  Parents
             ╲
              ●  Knowledge

NODE SPEC:
  - 48px diameter circles
  - Emoji + label below
  - Start: opacity 0.3, white border
  - Active: opacity 1.0, society accent color
  - Connected: dashed line to center, white/20 → accent when active
```

---

## Societies: Theater vs Truth

| | Simulation (Theater) | Prediction Engine (Truth) |
|---|---|---|
| Runs on | Client | Server |
| Purpose | WOW factor, screenshots, virality | Actual scoring accuracy |
| Accuracy | Irrelevant — needs to be SHAREABLE | As high as possible |
| Powered by | CSS/canvas animation, no logic | ML + Rules + Trends + Calibration |
| Societies | Visual nodes that light up | Not involved in scoring |
| Score source | Displays engine output | Calculates the score |
| Latency | Instant (client animation) | 2-5s (API call) |

---

## Naming Decision

Moved away from "viral" / "prediction engine" — too narrow, too cheap.

**Core reframe:** "Will this resonate?" not "Will this go viral?"

Top candidates from session:
- Impact Score / Resonance Score / Content Score
- Audience Pulse / Crowd Check
- Test / Check / Scan (simple verb)
- Pulse / Signal / Echo (brandable)

**Unresolved** — no final pick was made.

---

## Strategic Decisions

1. **Two systems** — simulation (theater, client) is fully separate from prediction (truth, server)
2. **Expert rules first** — work immediately with zero training data, ML comes later
3. **Single score output** — one 0-100 number, factor breakdown in results card
4. **Simulation = marketing** — the loading state is the content people share
5. **Societies = experience** — insightful > accurate, societies.io inspired
6. **Adaptive weights** — aggregation shifts toward ML as confidence grows, falls back to rules when uncertain
7. **Graceful degradation** — missing inputs (no video, no creator profile) reduce scope, never fail
8. **Hard accuracy ceiling** — 80-85% max acknowledged, don't oversell to users
9. **Gemini for eyes, DeepSeek for brain** — Gemini Flash handles all visual/multimodal analysis (best price/perf for video), DeepSeek R1 handles all reasoning (rule evaluation, score synthesis, suggestion generation, society persona simulation). Two models, clear separation, no overlap.
10. **Single DeepSeek call** — all reasoning tasks (rules + score + suggestions + societies) in one prompt to minimize latency and cost. DeepSeek's thinking tokens naturally chain these steps together.
