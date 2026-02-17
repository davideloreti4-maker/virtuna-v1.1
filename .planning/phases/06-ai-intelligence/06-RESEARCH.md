# Phase 6: AI Intelligence - Research

**Researched:** 2026-02-17
**Domain:** LLM-powered competitor content analysis (DeepSeek + Gemini)
**Confidence:** HIGH

## Summary

Phase 6 adds AI-generated intelligence to the competitor detail page -- content strategy analysis, viral detection, hashtag gap analysis, and personalized recommendations. The project already has a proven AI engine pattern in the `backend-foundation` worktree (`src/lib/engine/`) that uses `openai` (for DeepSeek via OpenAI-compatible API) and `@google/genai` (for Gemini). This phase replicates that pattern with competitor-specific prompts.

The core architecture is: **server-side API route** calls an AI provider with structured competitor data, validates the response with Zod, caches results in a new `competitor_intelligence` Supabase table, and the detail page server component reads cached insights to pass as props to a new intelligence UI section. No streaming needed -- these are batch analyses that can be pre-computed or generated on-demand and cached.

**Primary recommendation:** Use the same `openai` + `@google/genai` packages already proven in backend-foundation. DeepSeek `deepseek-chat` model for strategy analysis (cheaper, 128K context, JSON mode), Gemini `gemini-2.5-flash-lite` for fast viral detection and hashtag analysis. Cache AI responses in Supabase with TTL-based staleness (re-generate when data changes or 7 days pass).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `openai` | ^6.21.0 | DeepSeek API client (OpenAI-compatible) | Already used in backend-foundation; DeepSeek API is 100% OpenAI-compatible so the `openai` npm package works directly with `baseURL: "https://api.deepseek.com"` |
| `@google/genai` | ^1.41.0 | Google Gemini API client | Already used in backend-foundation; supports structured output via `responseMimeType: "application/json"` + `responseSchema` |
| `zod` | ^4.3.6 | AI response validation | Already installed; project convention for all data boundaries |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | - | - | Zero new npm packages -- reuse existing stack per STATE.md decision |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct `openai`/`@google/genai` | Vercel AI SDK (`ai` + `@ai-sdk/deepseek`) | Adds 2 new dependencies; AI SDK is great for streaming chat UIs but overkill for batch server-side analysis. backend-foundation already proves direct client pattern works. |
| DeepSeek `deepseek-chat` | DeepSeek `deepseek-reasoner` | Reasoner produces better analysis but costs 3x more and is slower (thinking mode). Chat model with good prompts is sufficient for content strategy analysis. |
| Database caching | In-memory caching | Serverless functions are ephemeral -- in-memory cache won't persist between invocations. Database cache survives cold starts. |

**Installation:**
```bash
npm install openai @google/genai
```

**Note:** `openai` and `@google/genai` are NOT yet in this worktree's `package.json`. They exist in `backend-foundation` but need installing here. This is the ONLY new dependency action (both are existing project packages, just not in this worktree). `zod` is already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/ai/                     # AI service layer (new)
│   ├── types.ts                # Zod schemas + TypeScript types for AI responses
│   ├── prompts.ts              # Prompt templates for each analysis type
│   ├── deepseek.ts             # DeepSeek client (strategy analysis, recommendations)
│   ├── gemini.ts               # Gemini client (viral detection, hashtag gap)
│   └── intelligence-service.ts # Orchestrator: coordinates analysis, caching, retrieval
├── app/api/intelligence/
│   └── [competitorId]/
│       └── route.ts            # POST: trigger analysis, GET: retrieve cached
├── components/competitors/intelligence/
│   ├── intelligence-section.tsx     # Main wrapper (server or client component)
│   ├── strategy-analysis-card.tsx   # INTL-01: hooks, patterns, triggers
│   ├── viral-detection-card.tsx     # INTL-02: viral videos + "why it worked"
│   ├── hashtag-gap-card.tsx         # INTL-03: user vs competitor hashtags
│   └── recommendations-card.tsx     # INTL-04: personalized action items
```

### Pattern 1: AI Service Layer (matches backend-foundation)
**What:** Separate AI client modules with lazy-initialized singleton clients, Zod-validated responses, retry logic, and circuit breaker for DeepSeek.
**When to use:** All AI interactions from API routes.
**Example:**
```typescript
// Source: backend-foundation/src/lib/engine/deepseek.ts (proven pattern)
import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY");
    client = new OpenAI({
      apiKey,
      baseURL: "https://api.deepseek.com",
    });
  }
  return client;
}

export async function analyzeStrategy(data: CompetitorContext): Promise<StrategyAnalysis> {
  const ai = getClient();
  const response = await ai.chat.completions.create({
    model: "deepseek-chat",
    messages: [{ role: "user", content: buildStrategyPrompt(data) }],
    response_format: { type: "json_object" },
  });
  const raw = response.choices[0]?.message?.content ?? "";
  return StrategyAnalysisSchema.parse(JSON.parse(stripFences(raw)));
}
```

### Pattern 2: Database-Cached AI Responses
**What:** Store AI-generated insights in a `competitor_intelligence` table with JSONB `insights` column, `analysis_type` discriminator, and `generated_at` timestamp. Server component checks cache first, shows cached data, and offers a "regenerate" action.
**When to use:** All AI analysis results (avoids re-calling LLMs on every page load).
**Example:**
```typescript
// Check cache: fresh if < 7 days old AND no new data since generation
const { data: cached } = await supabase
  .from("competitor_intelligence")
  .select("*")
  .eq("competitor_id", competitorId)
  .eq("analysis_type", "strategy")
  .order("generated_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (cached && !isStale(cached.generated_at, profile.last_scraped_at)) {
  return cached.insights; // JSONB parsed as typed object
}

// Cache miss or stale -- generate fresh
const analysis = await analyzeStrategy(competitorContext);
await supabase.from("competitor_intelligence").insert({
  competitor_id: competitorId,
  analysis_type: "strategy",
  insights: analysis as unknown as Json,
  generated_at: new Date().toISOString(),
});
return analysis;
```

### Pattern 3: Server Component Data Flow (matches existing detail page)
**What:** The detail page server component fetches cached AI insights alongside other data, passes pre-computed props to client intelligence components. This matches the exact pattern used by GrowthSection, EngagementSection, etc.
**When to use:** Displaying AI insights on the detail page.
**Example:**
```typescript
// In [handle]/page.tsx server component
const [strategyInsights, viralVideos, hashtagGap, recommendations] = await Promise.all([
  getStrategyAnalysis(supabase, profile.id),
  getViralDetection(supabase, profile.id, safeVideos, averageViews),
  getHashtagGap(supabase, profile.id, userId),
  getRecommendations(supabase, profile.id),
]);

return (
  <div className="space-y-8 pb-8">
    {/* ...existing sections... */}
    <IntelligenceSection
      strategy={strategyInsights}
      viralVideos={viralVideos}
      hashtagGap={hashtagGap}
      recommendations={recommendations}
    />
  </div>
);
```

### Pattern 4: Viral Video Detection (computation + AI)
**What:** Identify videos exceeding 3x average views using pure computation (already have `computeAverageViews` in `competitors-utils.ts`), then call AI only for the "why it worked" breakdown on flagged videos. This minimizes AI costs.
**When to use:** INTL-02 viral detection.
**Example:**
```typescript
// Pure computation -- no AI needed for detection
function detectViralVideos(
  videos: VideoMetrics[],
  averageViews: number
): ViralVideo[] {
  return videos
    .filter((v) => v.views !== null && v.views > averageViews * 3)
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
}

// AI only for explanation of WHY (called per viral video, cached)
async function explainViralVideo(video: VideoData, competitorContext: CompetitorContext) {
  // ... Gemini flash call with video details + competitor baseline
}
```

### Pattern 5: Hashtag Gap Analysis (computation + AI)
**What:** Compare user's hashtags (from their videos in competitor_videos if they're self-tracked) vs competitor's hashtags. The frequency computation is pure TypeScript (already have `computeHashtagFrequency`). AI generates actionable recommendations from the gap data.
**When to use:** INTL-03 hashtag gap.
**Example:**
```typescript
// User's hashtags come from:
// 1. creator_profiles.tiktok_handle -> competitor_profiles (if self-tracked via compare page pattern)
// 2. Or scrape user's videos if not yet in system
const userHashtags = computeHashtagFrequency(userVideos);
const competitorHashtags = computeHashtagFrequency(competitorVideos);

// Pure computation: find gaps
const competitorOnly = competitorHashtags.filter(
  (ch) => !userHashtags.some((uh) => uh.tag === ch.tag)
);
const userOnly = userHashtags.filter(
  (uh) => !competitorHashtags.some((ch) => ch.tag === uh.tag)
);
const shared = userHashtags.filter(
  (uh) => competitorHashtags.some((ch) => ch.tag === uh.tag)
);

// AI layer: generate recommendations from gap data
```

### Anti-Patterns to Avoid
- **Calling AI on every page load:** Always check database cache first. AI calls are expensive and slow.
- **Sending full video arrays to AI:** Summarize/aggregate data server-side before building prompts. A prompt with 30 video objects wastes tokens.
- **Client-side AI calls:** All AI interactions MUST go through server-side API routes. Never expose API keys.
- **Streaming for batch analysis:** These are not chat interactions. Use non-streaming `chat.completions.create` / `generateContent` and cache the result.
- **Blocking page render on AI generation:** If cache is empty, show "Analysis not yet generated" with a "Generate" button rather than blocking the page.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DeepSeek API client | Custom HTTP fetch wrapper | `openai` npm package with `baseURL` override | DeepSeek is OpenAI-compatible; handles auth, retries, types |
| Gemini API client | Custom HTTP wrapper | `@google/genai` package | Handles auth, structured output, multimodal natively |
| JSON response parsing from LLMs | Regex extraction | Zod `.safeParse()` + `stripFences()` helper | LLMs wrap JSON in markdown fences; Zod catches structural errors |
| Retry logic | Manual setTimeout loops | Same pattern from backend-foundation (for-loop with MAX_RETRIES) | Proven, handles timeout via AbortController |
| Hashtag frequency computation | AI-powered extraction | `computeHashtagFrequency()` in `competitors-utils.ts` | Already exists, pure TypeScript, zero cost |
| Viral video detection | AI classification | Simple threshold check (`views > avgViews * 3`) | Deterministic, instant, free |

**Key insight:** AI should be used for INSIGHT GENERATION (explaining patterns, generating recommendations), not for COMPUTATION (counting hashtags, detecting thresholds). Use existing utility functions for computation, AI for the "why" and "what to do about it."

## Common Pitfalls

### Pitfall 1: Token Budget Explosion
**What goes wrong:** Sending full video objects (with captions, URLs, all metrics) for 30+ videos blows up the prompt to 10K+ tokens.
**Why it happens:** Developer serializes entire database rows into the prompt.
**How to avoid:** Pre-aggregate data server-side. Send summaries, not raw data. Example: instead of 30 video objects, send "top 5 hashtags with frequencies, posting pattern: 4.2/week, avg views: 45K, top 3 videos by views with captions."
**Warning signs:** API costs spike, response latency > 15 seconds, hitting context limits.

### Pitfall 2: Uncached Regeneration on Every Visit
**What goes wrong:** No cache layer, so every detail page visit triggers an AI call ($0.01-0.05 per call adds up).
**Why it happens:** Treating AI like a database query.
**How to avoid:** Database-cached insights with TTL (7 days or until new scrape data arrives). The `generated_at` timestamp compared to `last_scraped_at` determines staleness.
**Warning signs:** High API bill, slow page loads, rate limiting from AI providers.

### Pitfall 3: DeepSeek JSON Mode Unreliability
**What goes wrong:** DeepSeek sometimes wraps JSON in markdown fences or includes `<think>` tags (especially `deepseek-reasoner`).
**Why it happens:** Model behavior varies between chat and reasoner modes.
**How to avoid:** Always `stripFences()` and `stripThinkTags()` before `JSON.parse()`, then validate with Zod `.safeParse()`. Use `deepseek-chat` (not reasoner) with `response_format: { type: "json_object" }` for more reliable JSON.
**Warning signs:** Zod validation failures in logs, empty insights cards.

### Pitfall 4: Missing User Data for Hashtag Gap
**What goes wrong:** Hashtag gap analysis requires user's own videos, but user may not have self-tracked via comparison page.
**Why it happens:** User's TikTok handle is in `creator_profiles.tiktok_handle` but their videos may not be scraped into `competitor_videos`.
**How to avoid:** At analysis time, check if user's handle exists in `competitor_profiles`. If not, scrape and add via `addCompetitor()` server action (same pattern as comparison page `resolveHandle("me")`). If no handle set, show "Set your TikTok handle in settings to enable hashtag gap analysis."
**Warning signs:** Empty hashtag gap card for users who haven't self-benchmarked.

### Pitfall 5: Race Condition on Concurrent Analysis Triggers
**What goes wrong:** Two simultaneous requests both see "no cache" and trigger duplicate AI calls.
**Why it happens:** No lock or dedup mechanism.
**How to avoid:** Use `INSERT ... ON CONFLICT (competitor_id, analysis_type) DO UPDATE` pattern. First writer wins. Second request's insert becomes an update (harmless). Alternatively, set an `analysis_status` column to 'generating' as a soft lock.
**Warning signs:** Duplicate rows in `competitor_intelligence`, doubled AI costs.

### Pitfall 6: Importing AI Libraries in Client Bundle
**What goes wrong:** `openai` or `@google/genai` end up in the client JavaScript bundle.
**Why it happens:** Direct import in a file that's transitively imported by a client component.
**How to avoid:** AI code lives ONLY in `src/lib/ai/` and `src/app/api/`. These are never imported by components. Intelligence UI components receive pre-computed props from server components, never call AI directly.
**Warning signs:** Large client bundle size warnings, API key exposure.

## Code Examples

### Verified: DeepSeek Client with OpenAI SDK
```typescript
// Source: backend-foundation/src/lib/engine/deepseek.ts (working code)
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY!,
  baseURL: "https://api.deepseek.com",
});

const response = await client.chat.completions.create({
  model: "deepseek-chat",
  messages: [{ role: "user", content: prompt }],
  response_format: { type: "json_object" },
});

const text = response.choices[0]?.message?.content ?? "";
```

### Verified: Gemini Client with Structured Output
```typescript
// Source: backend-foundation/src/lib/engine/gemini.ts (working code)
import { GoogleGenAI, Type } from "@google/genai";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const response = await client.models.generateContent({
  model: "gemini-2.5-flash-lite",
  contents: prompt,
  config: {
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.OBJECT,
      properties: { /* ... */ },
      required: [ /* ... */ ],
    },
  },
});

const text = response.text ?? "";
```

### Verified: Zod Validation of AI Response
```typescript
// Source: backend-foundation/src/lib/engine/types.ts (working code)
import { z } from "zod";

const StrategyAnalysisSchema = z.object({
  hooks: z.array(z.object({
    pattern: z.string(),
    frequency: z.number(),
    example: z.string(),
  })),
  content_series: z.array(z.object({
    name: z.string(),
    description: z.string(),
    video_count: z.number(),
  })),
  psychological_triggers: z.array(z.string()),
  overall_strategy: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
});

// Always safeParse, never parse -- AI output is untrusted
const result = StrategyAnalysisSchema.safeParse(JSON.parse(cleaned));
if (!result.success) {
  console.error("AI response validation failed:", result.error.issues);
  throw new Error("Invalid AI response structure");
}
```

### Existing: Viral Detection Threshold (no AI needed)
```typescript
// Source: competitors-utils.ts computeAverageViews + threshold check
const avgViews = computeAverageViews(videos); // already exists
const viralThreshold = (avgViews ?? 0) * 3;
const viralVideos = videos.filter(
  (v) => v.views !== null && v.views > viralThreshold
);
```

### Existing: Hashtag Frequency (no AI needed)
```typescript
// Source: competitors-utils.ts computeHashtagFrequency (already exists)
const competitorHashtags = computeHashtagFrequency(competitorVideos);
const userHashtags = computeHashtagFrequency(userVideos);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `generateObject` (Vercel AI SDK) | `generateText` with `Output.object()` | AI SDK 6 (2025) | Unified structured output; BUT we're not using AI SDK so irrelevant |
| `@google/generativeai` | `@google/genai` | Late 2025 | New package name, same Google Gemini. backend-foundation uses `@google/genai` |
| DeepSeek V2 | DeepSeek V3.2 (`deepseek-chat`) | 2025 | 128K context, cheaper, better JSON mode |
| Per-request AI calls | Cached analysis with TTL | Standard practice | 95%+ cost reduction on repeat visits |

**Deprecated/outdated:**
- `@google/generativeai` -- replaced by `@google/genai` (new SDK name)
- `generateObject` in Vercel AI SDK -- replaced by `generateText` with `output` property (AI SDK 6)
- DeepSeek off-peak pricing -- eliminated Sep 2025, flat rate now

## Open Questions

1. **Which model for which analysis type?**
   - What we know: DeepSeek-chat is cheapest ($0.56/M input, $1.68/M output), Gemini flash-lite is fastest. Both support JSON mode.
   - What's unclear: Whether strategy analysis (INTL-01) needs DeepSeek's deeper reasoning or if Gemini flash suffices.
   - Recommendation: Use DeepSeek-chat for INTL-01 (strategy analysis, needs depth) and INTL-04 (recommendations, needs personalization). Use Gemini flash-lite for INTL-02 (viral explanation, shorter output) and INTL-03 (hashtag recommendations, shorter output). This matches backend-foundation's dual-model pattern.

2. **Cache table schema: separate table vs column on competitor_profiles?**
   - What we know: AI insights are large JSONB blobs (1-5KB each), there are 4 analysis types, and they have independent staleness.
   - What's unclear: Whether to add JSONB columns to `competitor_profiles` or create a new `competitor_intelligence` table.
   - Recommendation: New `competitor_intelligence` table with `(competitor_id, analysis_type)` unique constraint. Cleaner separation, avoids bloating the profiles table, allows per-type TTL and regeneration.

3. **When to trigger analysis: on-demand vs automatic?**
   - What we know: AI calls cost money. Not all users will view every competitor's intelligence section.
   - What's unclear: Whether to pre-generate on scrape or wait for user request.
   - Recommendation: **On-demand with caching.** First visit to intelligence section triggers generation. Subsequent visits read cache. Regeneration when `last_scraped_at` > `generated_at` (new data available) or manual "Regenerate" button. This avoids paying for analysis nobody reads.

4. **User's own video data availability for hashtag gap**
   - What we know: User's TikTok handle is in `creator_profiles.tiktok_handle`. Comparison page already has `resolveHandle("me")` pattern to self-track.
   - What's unclear: Whether we can assume user's videos are always available.
   - Recommendation: Check if user has videos in `competitor_videos` (via self-tracking). If not, show a "Connect your account" CTA linking to comparison page with `?a=me`. Alternatively, scrape on-demand in the API route using the existing `addCompetitor` action.

5. **Environment variables needed**
   - What we know: backend-foundation uses `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `GEMINI_API_KEY`, `GEMINI_MODEL`.
   - What's unclear: Whether these env vars are already set in the Vercel project for this worktree.
   - Recommendation: Document required env vars. Planner should include a task to verify/add them to `.env.local` and Vercel project settings. Keys may already exist from backend-foundation since they share the same Vercel project.

## Supabase Schema Design

### New Table: `competitor_intelligence`
```sql
CREATE TABLE competitor_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES competitor_profiles(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('strategy', 'viral', 'hashtag_gap', 'recommendations')),
  insights JSONB NOT NULL,
  model_used TEXT,                    -- e.g., "deepseek-chat" or "gemini-2.5-flash-lite"
  prompt_tokens INTEGER,              -- for cost tracking
  completion_tokens INTEGER,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- For hashtag gap: also store the user context
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(competitor_id, analysis_type, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'))
);

CREATE INDEX idx_intelligence_competitor_type ON competitor_intelligence(competitor_id, analysis_type);

-- RLS: visible if user tracks the competitor
ALTER TABLE competitor_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view intelligence for tracked competitors"
  ON competitor_intelligence FOR SELECT
  TO authenticated
  USING (competitor_id IN (
    SELECT competitor_id FROM user_competitors WHERE user_id = (SELECT auth.uid())
  ));
```

**Notes:**
- `analysis_type` discriminates the 4 types of insights
- `insights` is JSONB -- shape varies by type, validated by Zod in application layer
- `user_id` is nullable: only set for `hashtag_gap` (which is user-specific). Strategy/viral/recommendations are shared across all users tracking that competitor.
- Unique constraint prevents duplicates while allowing user-specific hashtag_gap rows
- RLS follows existing pattern from `competitor_snapshots` and `competitor_videos`

### TypeScript Types for database.types.ts
```typescript
competitor_intelligence: {
  Row: {
    id: string
    competitor_id: string
    analysis_type: string
    insights: Json
    model_used: string | null
    prompt_tokens: number | null
    completion_tokens: number | null
    generated_at: string
    user_id: string | null
    created_at: string | null
  }
  // ... Insert, Update, Relationships
}
```

## Prompt Engineering Notes

### INTL-01: Strategy Analysis Prompt Context
Feed the AI a **summary** of the competitor's data, not raw rows:
- Profile: handle, follower count, heart count, video count, bio
- Content patterns: top 5 hashtags with counts, posting cadence (X/week), avg engagement rate
- Top 5 video captions (truncated to 100 chars each) with view counts
- Duration breakdown percentages
- Growth velocity (weekly %)

### INTL-02: Viral Video "Why It Worked" Prompt Context
Feed per-video:
- Caption (full), views, likes, comments, shares
- Competitor's average views (baseline for comparison)
- The viral multiplier (e.g., "12.5x average")
- Posting time (day/hour)
- Duration
- Hashtags used

### INTL-03: Hashtag Gap Analysis Prompt Context
Feed the computed gap data, not raw hashtags:
- Competitor-only hashtags (with frequencies)
- User-only hashtags (with frequencies)
- Shared hashtags (with both frequencies)
- Top 10 each category

### INTL-04: Recommendations Prompt Context
Aggregate of all available signals:
- Strategy analysis summary
- Viral patterns detected
- Hashtag gap highlights
- Competitor's strongest metrics vs user's weakest

## Sources

### Primary (HIGH confidence)
- `backend-foundation/src/lib/engine/deepseek.ts` -- Verified working DeepSeek integration using `openai` package with `baseURL` override
- `backend-foundation/src/lib/engine/gemini.ts` -- Verified working Gemini integration using `@google/genai` with structured output
- `backend-foundation/src/lib/engine/types.ts` -- Verified Zod validation pattern for LLM responses
- `src/lib/competitors-utils.ts` -- Existing pure computation functions (hashtag frequency, average views, engagement rate)
- `src/app/(app)/competitors/[handle]/page.tsx` -- Existing detail page server component pattern
- `src/app/(app)/competitors/compare/page.tsx` -- Existing self-benchmarking pattern (`resolveHandle("me")`)
- DeepSeek API docs (https://api-docs.deepseek.com/) -- OpenAI compatibility, model names, JSON mode, 128K context
- Google Gemini quickstart (https://ai.google.dev/gemini-api/docs/quickstart) -- `@google/genai` SDK, model names

### Secondary (MEDIUM confidence)
- DeepSeek pricing (https://api-docs.deepseek.com/quick_start/pricing) -- $0.56/M input, $1.68/M output for deepseek-chat (post Sep 2025)
- Vercel AI SDK structured output docs (https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data) -- Confirmed we DON'T need AI SDK; direct client is simpler for non-streaming batch analysis
- DeepSeek AI SDK guide (https://ai-sdk.dev/cookbook/guides/deepseek-v3-2) -- Confirmed `@ai-sdk/deepseek` exists but is unnecessary given existing `openai` pattern

### Tertiary (LOW confidence)
- LLM caching best practices -- TTL-based cache invalidation is standard but exact TTL (7 days) is a guess. May need tuning based on usage patterns.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Exact same packages (`openai`, `@google/genai`) proven in backend-foundation worktree
- Architecture: HIGH -- Follows established patterns (server component data flow, Zod validation, service client factory, database caching)
- Pitfalls: HIGH -- Derived from real issues observed in backend-foundation (JSON fences, think tags, token budgets)
- Prompt engineering: MEDIUM -- Prompts need iteration; the structure is sound but effectiveness requires testing with real data

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (30 days -- AI SDK landscape moves fast but direct client pattern is stable)
