# Technology Stack

**Project:** Virtuna Backend Foundation
**Researched:** 2026-02-13

## Recommended Stack

### AI/ML API Clients

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@google/genai` | ^1.41.0 | Gemini 2.5 Flash-Lite for visual analysis | Official unified Google GenAI SDK (GA). Replaces deprecated `@google/generative-ai`. Supports multimodal (image+text) inputs, inline base64 data, and the File API. Use model ID `gemini-2.5-flash-lite` -- cheapest multimodal Gemini, optimized for low latency, 1M context. Note: `gemini-2.0-flash` is deprecated and shuts down March 31, 2026. |
| `openai` | ^6.21.0 | DeepSeek R1 reasoning via OpenAI-compatible API | DeepSeek's API is OpenAI-compatible. Using the official `openai` package (not a third-party wrapper) gives us: battle-tested TypeScript types, streaming support, automatic retries, and zero maintenance risk. Configure with `baseURL: 'https://api.deepseek.com/v1'`. Model ID: `deepseek-reasoner` for R1 chain-of-thought reasoning. |

### Data Pipeline

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `apify-client` | ^2.22.0 | Trigger and fetch results from Apify TikTok scraper actors | We are NOT building scrapers -- we're calling pre-built Apify actors (TikTok Trends Scraper, TikTok Scraper). `apify-client` is the correct choice over the `apify` SDK because we're an external app consuming Apify, not building Apify Actors. Lightweight, supports automatic retries, works in both Node.js and browser. |

### Server State Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@tanstack/react-query` | ^5.90.0 | Server state management for all API data | Replaces mock data imports with cached, auto-refreshing server state. Suspense support (`useSuspenseQuery`), ~20% smaller than v4, pairs naturally with Next.js App Router streaming. Keep Zustand for client-only state (sidebar, bookmarks). TanStack Query owns all server/async data. |
| `@tanstack/react-query-devtools` | ^5.91.0 | Query debugging in development | Tree-shaken out of production builds. Essential during migration from mock data to real APIs -- lets you inspect cache state, refetch timing, stale/fresh status. |

### Database & Backend (Already Installed -- Extend, Don't Replace)

| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| `@supabase/supabase-js` | ^2.93.1 | Database client | Already installed. Use service role client for cron/background jobs, anon client for user-facing queries. |
| `@supabase/ssr` | ^0.8.0 | Server-side Supabase client | Already installed. createServerClient pattern already working. |
| `supabase` (CLI) | ^2.74.5 | Migrations, local dev, type generation | Already installed as devDependency. Use `supabase gen types typescript` for type-safe database queries. |

### Background Jobs / Cron

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vercel Cron Jobs | N/A (config) | Schedule recurring API route invocations | Already proven pattern in the codebase (`/api/cron/sync-whop`). Define schedules in `vercel.json`. Pro plan: per-minute precision, 100 crons/project, 300s max execution. Hobby plan: daily only. |

**No additional job queue library needed.** The workloads (Apify trigger, trend calculation, rule validation, ML retrain) all fit within Vercel's 300s function timeout on Pro. If any job exceeds 300s, split into chunks with a Supabase `job_queue` table pattern (see Architecture).

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | ^4.3.6 (existing) | API response validation, request schemas | Validate all external API responses (Gemini, DeepSeek, Apify). Already in project -- extend usage to all API boundaries. |
| `zustand` | ^5.0.10 (existing) | Client-only UI state | Keep for sidebar, bookmarks, UI preferences. DO NOT use for server data -- that's TanStack Query's job. |

## What NOT to Add

| Technology | Why Not |
|------------|---------|
| `@ai-sdk/google`, `@ai-sdk/deepseek` (Vercel AI SDK) | Adds unnecessary abstraction layer. We need precise control over prompts, token counting, and response parsing for the prediction engine. Direct SDK calls are simpler and more transparent for cost tracking. |
| `apify` (full SDK) | That's for building Apify Actors. We're consuming actors from our Next.js app. `apify-client` is the right tool. |
| `bullmq`, `quirrel`, `inngest` | Job queue systems are overkill. Our cron jobs are simple HTTP triggers (Vercel Cron -> API route -> do work). No need for Redis-backed queues or external services. If we outgrow Vercel Cron, revisit then. |
| `@supabase/functions-js` | We're using Next.js API routes for all backend logic, not Supabase Edge Functions. Keeps deployment unified on Vercel. Edge Functions would split the deployment surface for no benefit. |
| `tensorflow.js`, `onnxruntime-node` | The ML "pipeline" in this milestone is expert rules + API calls. No local model inference. If/when we train models, they'll run as Python services or hosted endpoints, not in-process JS. |
| `node-cron`, `croner` | In-process schedulers don't work in serverless. Vercel functions cold-start on demand; there's no persistent process to run cron in. |
| `react-hook-form` | Project decision (Zod v4 for simple forms). Already validated. |
| `prisma`, `drizzle` | Supabase client handles all DB queries with generated types. Adding an ORM creates a parallel data access layer with no benefit for this project's query complexity. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Gemini SDK | `@google/genai` | `@google/generative-ai` | Deprecated. Google consolidated into `@google/genai` -- the old package will stop receiving updates. |
| DeepSeek Client | `openai` (configured) | `node-deepseek`, `deepseek-api` | Third-party wrappers with tiny npm download counts. DeepSeek's own docs recommend using the OpenAI SDK. One less dependency to maintain. |
| Apify Integration | `apify-client` | Direct REST API calls | `apify-client` adds automatic retries, pagination handling, and TypeScript types. Worth the dependency. |
| Server State | TanStack Query v5 | SWR | TanStack Query has richer devtools, better mutation support, built-in Suspense hooks, and more granular cache control. SWR is simpler but we need the power features for this app's complexity. |
| Background Jobs | Vercel Cron | Supabase pg_cron + Edge Functions | Splits deployment across two platforms. Vercel Cron is already proven in this codebase and keeps all logic in Next.js API routes. pg_cron is better suited for pure database operations (cleanup queries, aggregations). |
| Gemini Model | `gemini-2.5-flash-lite` | `gemini-2.5-flash` | Flash-Lite is cheaper ($0.075/1M input vs $0.15/1M) and faster for our use case (image description + structured extraction). We don't need Flash's deeper reasoning -- that's DeepSeek R1's job. |

## Architecture Decision: Next.js API Routes Over Supabase Edge Functions

**Decision:** All backend logic runs as Next.js API routes on Vercel. No Supabase Edge Functions.

**Rationale:**
1. **Unified deployment** -- one platform (Vercel), one set of logs, one deploy pipeline
2. **Existing pattern** -- cron sync, webhooks, and checkout routes already use Next.js API routes
3. **Full Node.js runtime** -- API routes run in Node.js (not Deno like Edge Functions), giving us full npm ecosystem access for `@google/genai`, `openai`, `apify-client`
4. **Vercel Pro timeout** -- 300s is sufficient for all our workloads (Apify actor runs are async; we trigger and poll)
5. **Supabase client works from API routes** -- service role client for privileged operations, no need for co-located Edge Functions

**When to use Supabase Edge Functions instead:**
- If a function needs sub-10ms cold starts (edge functions boot faster than serverless)
- If you need to respond from a region closer to Supabase DB (latency-critical reads)
- Neither applies to our use case (prediction engine has 3-5s latency budget)

## API Cost Estimates

| API | Model | Cost Basis | Per-Analysis Estimate |
|-----|-------|------------|----------------------|
| Gemini | `gemini-2.5-flash-lite` | $0.075/1M input, $0.30/1M output | ~$0.001 (image + prompt ~1500 tokens in, ~500 tokens out) |
| DeepSeek | `deepseek-reasoner` | $0.56/1M input (miss), $1.68/1M output | ~$0.005 (2K tokens in, ~2K tokens out + CoT reasoning tokens) |
| **Total per analysis** | | | **~$0.006** (lower than original $0.013 estimate due to Flash-Lite pricing) |
| Apify | TikTok Trends Scraper | ~$0.25-0.50 per run | ~$3-4/day at 6hr intervals |

## Environment Variables Required

```bash
# AI APIs
GEMINI_API_KEY=                    # Google AI Studio API key
DEEPSEEK_API_KEY=                  # DeepSeek platform API key

# Apify
APIFY_API_TOKEN=                   # Apify platform token

# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=          # existing
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # existing
SUPABASE_SERVICE_ROLE_KEY=         # existing (used in cron routes)

# Cron Security (already configured)
CRON_SECRET=                       # existing (used in sync-whop cron)
```

## Installation

```bash
# New production dependencies
npm install @google/genai openai apify-client @tanstack/react-query

# New dev dependencies
npm install -D @tanstack/react-query-devtools
```

**Total new dependencies: 4 production + 1 dev.** Minimal surface area increase.

## Version Compatibility Notes

| Constraint | Status |
|------------|--------|
| `@google/genai` requires Node.js >= 18 | OK -- Next.js 16 requires Node.js 18.18+ |
| `@tanstack/react-query` v5 requires React >= 18 | OK -- project uses React 19.2.3 |
| `openai` requires TypeScript >= 4.9 | OK -- project uses TypeScript 5.x |
| `apify-client` works in Node.js and browser | OK -- we'll only use server-side |

## Confidence Assessment

| Decision | Confidence | Source |
|----------|------------|--------|
| `@google/genai` as Gemini SDK | HIGH | Official Google docs, npm page, deprecation notice on old SDK |
| `openai` for DeepSeek | HIGH | DeepSeek official API docs recommend OpenAI SDK compatibility |
| `gemini-2.5-flash-lite` model choice | HIGH | Official model page, deprecation of 2.0-flash confirmed for March 2026 |
| `deepseek-reasoner` model name | HIGH | Official DeepSeek API docs |
| `apify-client` over `apify` SDK | HIGH | Official Apify docs: "client for external applications" |
| TanStack Query v5 | HIGH | npm, official docs, proven React 19 + Next.js App Router support |
| Vercel Cron over job queues | MEDIUM | Fits current scale. May need revisiting if job complexity grows significantly. |
| No Supabase Edge Functions | MEDIUM | Correct for unified deployment but could revisit for latency-critical DB reads |
| Cost estimates | LOW | Based on published pricing; actual costs depend on prompt length and response verbosity |

## Sources

- [@google/genai npm](https://www.npmjs.com/package/@google/genai)
- [Google GenAI SDK GitHub](https://github.com/googleapis/js-genai)
- [Gemini API Quickstart](https://ai.google.dev/gemini-api/docs/quickstart)
- [Gemini Models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini Image Understanding](https://ai.google.dev/gemini-api/docs/image-understanding)
- [DeepSeek API Docs](https://api-docs.deepseek.com/)
- [DeepSeek Reasoning Model](https://api-docs.deepseek.com/guides/reasoning_model)
- [DeepSeek Pricing](https://api-docs.deepseek.com/quick_start/pricing)
- [Apify Client JS Docs](https://docs.apify.com/api/client/js/docs)
- [Apify TikTok Trends Scraper](https://apify.com/clockworks/tiktok-trends-scraper)
- [TanStack Query v5 Docs](https://tanstack.com/query/v5/docs/react/overview)
- [TanStack Query Advanced SSR](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Vercel Cron Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Vercel Function Duration](https://vercel.com/docs/functions/configuring-functions/duration)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [OpenAI Node.js SDK](https://github.com/openai/openai-node)
