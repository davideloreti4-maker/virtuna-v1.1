# Stack Research: Trending Page (v1.5)

**Project:** Virtuna v1.5
**Researched:** 2026-02-02
**Dimension:** Stack additions for TikTok video feed, AI categorization, remix storyboards, and PDF export

---

## Executive Summary

The Trending Page requires **four new capability domains**: video data ingestion (Apify), AI processing (OpenAI or Anthropic), client-side data fetching (TanStack Query), and PDF generation (React-PDF). The existing stack (Next.js 16, Supabase, Zustand, Tailwind) handles storage, auth, and UI.

**Key recommendations:**

1. **Apify Client** (`apify-client` v2.22.0) — Single integration for TikTok scraping via actors
2. **OpenAI SDK** (`openai` v6.17.0) — AI categorization and remix generation (GPT-4o)
3. **TanStack Query** (`@tanstack/react-query` v5.x) — Server state management with caching
4. **React-PDF** (`@react-pdf/renderer` v4.3.2) — React 19-compatible PDF generation
5. **Upstash Redis** (`@upstash/redis` + `@upstash/ratelimit`) — API caching and rate limiting

**What NOT to add:** Direct TikTok API (no official public API), image generation for storyboard frames (complexity, cost, consistency issues), multiple AI providers (pick one).

---

## New Capabilities Required

| Capability | Purpose | Recommendation |
|------------|---------|----------------|
| TikTok data ingestion | Fetch trending videos + creator baselines | Apify TikTok scraper |
| AI categorization | Classify videos by niche, content type, strategic tags | OpenAI GPT-4o |
| AI remix generation | Generate 3 full production briefs per video | OpenAI GPT-4o |
| Video data caching | Cache scraped data, reduce API calls | Upstash Redis |
| API rate limiting | Protect AI endpoints, manage costs | Upstash Ratelimit |
| Server state management | Feed data fetching with caching | TanStack Query |
| PDF generation | Export storyboard briefs | React-PDF |

---

## Apify Integration

### Recommended: `apify-client`

| Attribute | Value |
|-----------|-------|
| Package | `apify-client` |
| Version | **2.22.0** (January 27, 2026) |
| Source | [GitHub](https://github.com/apify/apify-client-js) |
| Confidence | HIGH |

**Why Apify:**
- No official TikTok public API exists for trending content
- Apify provides managed, maintained scrapers with 98% success rate
- Single SDK for all TikTok data needs (videos, profiles, hashtags)
- Automatic retries with exponential backoff built-in
- REST API with unified response format

### Relevant Apify Actors

| Actor | Purpose | Pricing |
|-------|---------|---------|
| [TikTok Scraper (Api Dojo)](https://apify.com/apidojo/tiktok-scraper) | Bulk video scraping, 600 posts/sec | $0.30/1K posts |
| [TikTok Profile Scraper](https://apify.com/clockworks/tiktok-profile-scraper) | Creator historical data | Per-run pricing |
| [TikTok Hashtag Scraper](https://apify.com/clockworks/tiktok-hashtag-scraper) | Trending hashtag discovery | Per-run pricing |

### Integration Pattern

```typescript
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });

// Run TikTok scraper actor
const run = await client.actor('apidojo/tiktok-scraper').call({
  hashtags: ['trending'],
  maxItems: 50,
});

// Fetch results
const { items } = await client.dataset(run.defaultDatasetId).listItems();
```

### Data Flow

```
Vercel Cron (every 6h) → Apify Actor → Raw video data →
  → Calculate views multiplier → AI classify → Store in Supabase
```

---

## AI Provider

### Recommended: OpenAI

| Attribute | Value |
|-----------|-------|
| Package | `openai` |
| Version | **6.17.0** (January 28, 2026) |
| Source | [GitHub](https://github.com/openai/openai-node) |
| Model | `gpt-4o` (for categorization + remix) |
| Confidence | HIGH |

**Why OpenAI over Anthropic:**
- Slightly lower latency for short classification tasks
- Structured outputs (JSON mode) well-suited for categorization
- Existing ecosystem familiarity
- Function calling for structured remix generation

**Alternative:** Anthropic Claude (`@anthropic-ai/sdk`) is equally capable. Choose based on:
- Existing API keys/billing
- Team preference
- Long-form output quality (Claude may be better for full scripts)

### Usage Patterns

**1. Video Classification (batch)**
```typescript
import OpenAI from 'openai';

const openai = new OpenAI();

const classification = await openai.chat.completions.create({
  model: 'gpt-4o',
  response_format: { type: 'json_object' },
  messages: [{
    role: 'user',
    content: `Classify this TikTok video:
      Caption: ${video.description}
      Hashtags: ${video.hashtags.join(', ')}
      Audio: ${video.music.title}

      Return JSON: { "niche": string, "contentType": string, "strategicTags": string[] }`
  }]
});
```

**2. Remix Generation**
```typescript
const remix = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{
    role: 'system',
    content: 'You are a TikTok content strategist creating production briefs...'
  }, {
    role: 'user',
    content: `Generate 3 remix briefs for: ${sourceVideo}
      Creator niche: ${niche}
      Goal: ${goal}
      Constraints: ${constraints}`
  }]
});
```

### Cost Estimation

| Operation | Tokens (est.) | Cost per call | Daily volume | Daily cost |
|-----------|---------------|---------------|--------------|------------|
| Classification | ~500 | $0.005 | 500 videos | $2.50 |
| Remix generation | ~2,000 | $0.02 | 100 remixes | $2.00 |
| **Total estimated** | | | | **~$4.50/day** |

---

## Data Fetching & Caching

### Recommended: TanStack Query

| Attribute | Value |
|-----------|-------|
| Package | `@tanstack/react-query` |
| Version | **5.x** (latest stable) |
| Source | [TanStack Docs](https://tanstack.com/query/latest) |
| Confidence | HIGH |

**Why TanStack Query over SWR:**
- DevTools for debugging (critical for feed development)
- Better mutation support (for save/status tracking)
- More sophisticated cache invalidation (by tags)
- Pagination/infinite scroll built-in
- Prefetching for drill-down views

**Why NOT Zustand alone:**
- Zustand is for client state, not server state
- TanStack Query handles stale-while-revalidate pattern
- Automatic background refetching
- Built-in loading/error states

### Integration Pattern

```typescript
// /lib/queries/trending.ts
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';

export function useTrendingDashboard() {
  return useQuery({
    queryKey: ['trending', 'dashboard'],
    queryFn: () => fetch('/api/trending/dashboard').then(r => r.json()),
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

export function useCategoryVideos(category: string) {
  return useInfiniteQuery({
    queryKey: ['trending', 'category', category],
    queryFn: ({ pageParam = 0 }) =>
      fetch(`/api/trending/category/${category}?offset=${pageParam}`).then(r => r.json()),
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  });
}
```

### Caching Layer: Upstash Redis

| Attribute | Value |
|-----------|-------|
| Package | `@upstash/redis` |
| Version | Latest |
| Source | [Upstash Docs](https://upstash.com/docs/redis/overall/getstarted) |
| Confidence | HIGH |

**Why Upstash:**
- Serverless Redis (no connection management)
- Works on Vercel Edge
- Built-in rate limiting package
- Pay-per-request pricing (~$0.20/100K commands)

### Rate Limiting

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '60 s'), // 10 requests per minute
});

// In API route
const { success } = await ratelimit.limit(userId);
if (!success) return new Response('Rate limited', { status: 429 });
```

### Caching Strategy

| Data Type | Cache Location | TTL | Invalidation |
|-----------|----------------|-----|--------------|
| Dashboard feed | Upstash Redis | 5 min | On Apify refresh |
| Category lists | Upstash Redis | 5 min | On Apify refresh |
| Video details | Supabase + TanStack | 1 hour | On view |
| Creator baselines | Supabase | 24 hours | On Apify refresh |
| Remix results | Supabase | Permanent | Manual delete |

---

## PDF Generation

### Recommended: React-PDF

| Attribute | Value |
|-----------|-------|
| Package | `@react-pdf/renderer` |
| Version | **4.3.2** (React 19 compatible since v4.1.0) |
| Source | [react-pdf.org](https://react-pdf.org) |
| Confidence | HIGH |

**Why React-PDF:**
- React 19 compatible (v4.1.0+)
- Declarative PDF creation using React components
- Server-side rendering support (Next.js API routes)
- No external dependencies (pure JS)
- Excellent for structured documents (storyboards)

**Alternatives considered:**
- **pdfme** (v5.5.0) — Good, but more template-focused
- **pdfmake** — Declarative but not React-native
- **jsPDF** — More imperative, less suited for complex layouts

### Integration Pattern

```typescript
// /components/pdf/StoryboardPDF.tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 30 },
  section: { marginBottom: 10 },
  title: { fontSize: 18, fontWeight: 'bold' },
  content: { fontSize: 12 },
});

interface StoryboardPDFProps {
  remix: RemixBrief;
}

export function StoryboardPDF({ remix }: StoryboardPDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.title}>Hook (First 3 Seconds)</Text>
          <Text style={styles.content}>{remix.hook}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.title}>Shot List</Text>
          {remix.shotList.map((shot, i) => (
            <Text key={i} style={styles.content}>{i + 1}. {shot}</Text>
          ))}
        </View>
        <View style={styles.section}>
          <Text style={styles.title}>Full Script</Text>
          <Text style={styles.content}>{remix.script}</Text>
        </View>
        {/* ... more sections */}
      </Page>
    </Document>
  );
}
```

```typescript
// /api/remix/[id]/pdf/route.ts
import { renderToBuffer } from '@react-pdf/renderer';
import { StoryboardPDF } from '@/components/pdf/StoryboardPDF';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const remix = await getRemix(params.id);
  const buffer = await renderToBuffer(<StoryboardPDF remix={remix} />);

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="remix-${params.id}.pdf"`,
    },
  });
}
```

### Storyboard Visuals

**Decision:** Text-only storyboards for MVP.

**Why NOT AI-generated images:**
- DALL-E 3 deprecated May 2026, GPT Image models new
- Character consistency issues across frames
- Added cost ($0.04-0.12 per image)
- Latency (2-5 seconds per image)
- Storyboards work well as text with shot descriptions

**Future enhancement:** Consider GPT Image when:
- Character consistency improves
- User demand validates
- Budget allows

---

## Recommended Stack Additions

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| `apify-client` | ^2.22.0 | TikTok data ingestion | Managed scraping, 98% success rate |
| `openai` | ^6.17.0 | AI classification + remix | GPT-4o structured outputs |
| `@tanstack/react-query` | ^5.x | Server state management | DevTools, mutations, pagination |
| `@react-pdf/renderer` | ^4.3.2 | PDF storyboard export | React 19 compatible |
| `@upstash/redis` | latest | Edge caching | Serverless, Vercel-optimized |
| `@upstash/ratelimit` | latest | API rate limiting | Protect AI endpoints |

### Installation Command

```bash
pnpm add apify-client openai @tanstack/react-query @react-pdf/renderer @upstash/redis @upstash/ratelimit
```

### Dev Dependencies

None required beyond existing setup.

---

## Already Sufficient (No Addition Needed)

| Existing | Version | For Trending Page |
|----------|---------|-------------------|
| `next` | 16.1.5 | API routes, cron, routing |
| `@supabase/supabase-js` | 2.93.1 | Video/remix storage |
| `zustand` | 5.0.10 | UI state (filters, selections) |
| `zod` | 4.3.6 | API response validation |
| `recharts` | 3.7.0 | Views multiplier charts (if needed) |
| `motion` | 12.29.2 | Card animations, transitions |
| `tailwindcss` | 4 | Styling |

---

## What NOT to Add

| Avoid | Reason |
|-------|--------|
| **Direct TikTok API** | No official public API; use Apify |
| **SWR** | TanStack Query has DevTools, better mutations |
| **Multiple AI providers** | Pick one (OpenAI); switch later if needed |
| **DALL-E/Image generation** | Consistency issues, cost, complexity |
| **pdfmake/jsPDF** | React-PDF is more idiomatic |
| **socket.io/real-time** | Feed doesn't need real-time; polling sufficient |
| **Puppeteer/Playwright** | Apify handles scraping; don't DIY |
| **Separate Redis provider** | Upstash is Vercel-optimized |
| **GraphQL** | REST sufficient for this scope |

---

## Integration with Existing Stack

### Fits Naturally

| Existing | Integration Point |
|----------|-------------------|
| Next.js App Router | `/api/trending/*`, `/api/remix/*` routes |
| Supabase Auth | User ID for remix ownership |
| Supabase DB | `trending_videos`, `remixes`, `creator_baselines` tables |
| Zustand | Filter state, selected video, UI preferences |
| Tailwind | Dashboard layout, video cards |
| Radix UI | Modals, dropdowns, tabs |

### New Patterns Required

| Pattern | Location | Purpose |
|---------|----------|---------|
| TanStack Query Provider | `/app/providers.tsx` | Wrap app with QueryClientProvider |
| Vercel Cron | `/api/cron/refresh-trending` | Scheduled Apify runs |
| Edge caching | API routes | Upstash Redis for hot data |
| Rate limiting middleware | `/api/remix/*` | Protect AI endpoints |
| PDF streaming | `/api/remix/[id]/pdf` | Generate PDF on demand |

### Environment Variables

```env
# Apify
APIFY_API_TOKEN=apify_api_xxx

# OpenAI
OPENAI_API_KEY=sk-xxx

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

---

## Database Schema Additions

```sql
-- Trending videos cache
CREATE TABLE trending_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tiktok_id VARCHAR(50) UNIQUE NOT NULL,
  creator_handle VARCHAR(100) NOT NULL,
  creator_id VARCHAR(50),
  views BIGINT NOT NULL,
  views_multiplier DECIMAL(6,2),
  behavioral_category VARCHAR(20), -- 'breaking_out', 'sustained', 'resurging'
  niche VARCHAR(50),
  content_type VARCHAR(50),
  strategic_tags TEXT[],
  thumbnail_url TEXT,
  video_url TEXT,
  description TEXT,
  hashtags TEXT[],
  audio_title VARCHAR(255),
  posted_at TIMESTAMPTZ,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Creator baselines for multiplier calculation
CREATE TABLE creator_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id VARCHAR(50) UNIQUE NOT NULL,
  creator_handle VARCHAR(100) NOT NULL,
  avg_views_30d BIGINT,
  video_count_30d INT,
  last_calculated TIMESTAMPTZ DEFAULT NOW()
);

-- User remixes
CREATE TABLE remixes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  source_video_id UUID REFERENCES trending_videos,
  source_url TEXT,
  niche VARCHAR(50),
  goal VARCHAR(50),
  constraints JSONB,
  briefs JSONB NOT NULL, -- Array of 3 production briefs
  status VARCHAR(20) DEFAULT 'generated', -- 'generated', 'to_film', 'filmed', 'posted'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_trending_category ON trending_videos(behavioral_category);
CREATE INDEX idx_trending_niche ON trending_videos(niche);
CREATE INDEX idx_trending_scraped ON trending_videos(scraped_at DESC);
CREATE INDEX idx_remixes_user ON remixes(user_id);
```

---

## Confidence Assessment

| Area | Confidence | Reasoning |
|------|------------|-----------|
| Apify integration | HIGH | Official client docs verified, v2.22.0 released Jan 2026 |
| OpenAI SDK | HIGH | v6.17.0 verified on GitHub releases |
| TanStack Query | HIGH | Industry standard, well-documented |
| React-PDF | HIGH | v4.3.2 React 19 support verified in GitHub issues |
| Upstash Redis | HIGH | Official Vercel partner, documented integration |
| PDF-only storyboards | MEDIUM | User preference unknown; may want images later |
| AI cost estimates | MEDIUM | Based on typical usage; actual may vary |

---

## Sources

### Package Versions (Verified)
- [apify-client v2.22.0](https://github.com/apify/apify-client-js) - GitHub releases
- [openai v6.17.0](https://github.com/openai/openai-node/releases) - GitHub releases
- [@react-pdf/renderer v4.3.2](https://github.com/diegomura/react-pdf/issues/2756) - React 19 compatibility
- [TanStack Query](https://tanstack.com/query/latest) - Official docs

### Apify TikTok Scrapers
- [TikTok Scraper (Api Dojo)](https://apify.com/apidojo/tiktok-scraper)
- [TikTok Profile Scraper](https://apify.com/clockworks/tiktok-profile-scraper)
- [Apify JavaScript API](https://apify.com/clockworks/tiktok-video-scraper/api/javascript)

### Caching & Rate Limiting
- [Upstash Rate Limiting](https://upstash.com/blog/nextjs-ratelimiting)
- [Next.js Caching Guide](https://nextjs.org/docs/app/guides/caching)
- [TanStack Query vs SWR](https://tanstack.com/query/v4/docs/react/comparison)

### PDF Generation
- [React-PDF Official](https://react-pdf.org/)
- [React-PDF React 19 Support](https://github.com/diegomura/react-pdf/issues/2756)

### AI Image Generation
- [OpenAI Image Generation](https://platform.openai.com/docs/guides/image-generation) - DALL-E 3 deprecation notice

---

*Research completed: 2026-02-02*
*Ready for roadmap creation*
