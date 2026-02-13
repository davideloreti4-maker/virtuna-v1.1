# Domain Pitfalls

**Domain:** Social media content intelligence platform (backend foundation)
**Researched:** 2026-02-13

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: LLM Output Parsing Without Validation

**What goes wrong:** Treating LLM JSON output as reliable structured data. Gemini and DeepSeek return malformed JSON, extra markdown wrapping (```json ... ```), different field names between calls, or null values where you expect arrays.
**Why it happens:** LLMs are probabilistic. Even with explicit "return ONLY JSON" prompts, they add explanatory text, skip fields, or change casing ~5-10% of the time.
**Consequences:** `JSON.parse()` throws, the app crashes, users see "Analysis failed" with no recovery path. Worse: the parse succeeds but fields are wrong types, causing subtle downstream bugs in scoring.
**Prevention:**
- Parse ALL LLM outputs through Zod schemas with `.safeParse()` -- never `JSON.parse()` alone
- Strip markdown code fences before parsing (regex: `/```json?\n?([\s\S]*?)\n?```/`)
- Implement retry logic: if parse fails, re-prompt with "Your previous response was not valid JSON. Return ONLY the JSON object."
- Set Gemini's `responseMimeType: 'application/json'` and `responseSchema` for structured output (supported in 2.5 models)
- For DeepSeek: use `response_format: { type: "json_object" }` in the API call
- Have a fallback: if 3 retries fail, return a graceful error with partial results where possible
**Detection:** Monitor parse failure rate. Alert if >5% of analyses fail at the parsing stage.

### Pitfall 2: Gemini 2.0 Flash Deprecation (March 31, 2026)

**What goes wrong:** Building the pipeline against `gemini-2.0-flash` and having it break when Google shuts down the model.
**Why it happens:** The original architecture reference specifies "Gemini Flash" without a version. Gemini 2.0 Flash is the most commonly referenced model in tutorials, but it's deprecated and will be shut down March 31, 2026 -- just 6 weeks from now.
**Consequences:** Complete pipeline failure on the deprecation date. Emergency migration under pressure.
**Prevention:**
- Use `gemini-2.5-flash-lite` from day one (cheaper, faster, actively supported)
- Store model ID as a constant/env var, not hardcoded in prompts
- Test with the replacement model before you start, not after deprecation
**Detection:** Google sends deprecation emails. Also monitor for HTTP 404/410 responses from the Gemini API.

### Pitfall 3: Vercel Function Timeout on Analysis Pipeline

**What goes wrong:** The dual-model analysis pipeline (Gemini + DeepSeek) exceeds Vercel's function timeout, returning a 504 to the user.
**Why it happens:** Gemini visual analysis: 1-3s. DeepSeek R1 reasoning with chain-of-thought: 2-8s (CoT can generate up to 32K reasoning tokens). Combined with DB lookups, you're at 5-15s realistically. Add retry logic for LLM parsing failures and you could hit 30s+.
**Consequences:** User sees "Analysis failed" after waiting. No partial results. Wasted API costs for the successful Gemini call.
**Prevention:**
- Set `maxDuration: 120` on the analyze route (Vercel Pro supports this)
- Use SSE streaming so the client gets progress updates during the wait
- If DeepSeek times out, return Gemini-only results with a "basic analysis" label
- Consider a two-phase approach: immediate acknowledgment + polling for result if SSE isn't viable
- Monitor p95 latency. If consistently >10s, reduce DeepSeek prompt complexity or add `max_tokens` limit
**Detection:** Vercel function logs show 504s. Track `latency_ms` in `analysis_results` table.

### Pitfall 4: API Key Exposure in Client-Side Code

**What goes wrong:** Using `NEXT_PUBLIC_GEMINI_API_KEY` or similar, exposing AI API keys to the browser.
**Why it happens:** Next.js convention: `NEXT_PUBLIC_` prefix makes env vars available client-side. Easy to accidentally prefix AI keys this way, especially when copying from tutorials that show client-side usage.
**Consequences:** Anyone can inspect the network tab, extract your API key, and run up your Gemini/DeepSeek/Apify bill. No rate limiting on their end.
**Prevention:**
- AI API keys NEVER get `NEXT_PUBLIC_` prefix
- All AI calls go through API routes (server-side only)
- Add a `.env.local.example` comment: `# NEVER prefix these with NEXT_PUBLIC_`
- Lint rule or CI check: reject any env var matching `NEXT_PUBLIC_.*API_KEY` or `NEXT_PUBLIC_.*SECRET`
**Detection:** Review `.env.local.example` and all `process.env.NEXT_PUBLIC_` references in codebase.

### Pitfall 5: Apify Scraper Blocking / Rate Limiting

**What goes wrong:** Apify actors fail to scrape TikTok data, returning empty or partial datasets. The trending page shows stale data for days without anyone noticing.
**Why it happens:** TikTok actively blocks scrapers. Apify actors are maintained by third parties (clockworks) who may not update them when TikTok changes their anti-bot measures. Actors can also exceed Apify platform usage limits.
**Consequences:** Trending page shows week-old data (stale but looks current), or worse: completely empty if a migration assumes fresh data exists.
**Prevention:**
- Track `last_successful_scrape_at` in a `system_status` table
- If no scrape succeeds in 24h, surface a warning in the admin view (or log alert)
- Keep mock data as a fallback for development/demo purposes
- Don't delete old scraped data on each run -- upsert and let old data age out naturally
- Test the specific Apify actor (clockworks/tiktok-trends-scraper) before committing to it -- run it manually once
**Detection:** Cron route should log success/failure counts. Monitor the `scraped_at` timestamps.

## Moderate Pitfalls

### Pitfall 1: TanStack Query + Mock Data Migration Race Condition

**What goes wrong:** Partially migrating to TanStack Query while some components still import mock data. Two data sources, inconsistent state, broken filters.
**Prevention:**
- Migrate one page at a time, fully. Don't leave a page half-mock, half-real.
- Create a feature flag per page: `USE_REAL_TRENDING_DATA`, `USE_REAL_DEALS_DATA`
- Keep mock data files until ALL consumers are migrated, then delete in a single commit

### Pitfall 2: Supabase Type Generation Drift

**What goes wrong:** Database schema changes via migration but `database.types.ts` isn't regenerated. TypeScript types don't match actual DB columns. Queries succeed but types are wrong.
**Prevention:**
- Run `supabase gen types typescript --local > src/types/database.types.ts` after EVERY migration
- Add to a `postmigrate` script in package.json
- CI check: regenerate types and diff against committed version

### Pitfall 3: DeepSeek API Availability

**What goes wrong:** DeepSeek's API has experienced significant downtime historically (Jan-Feb 2025 capacity issues, rate limiting). If DeepSeek is down, the entire analysis pipeline fails.
**Prevention:**
- Implement circuit breaker: if 3 consecutive DeepSeek calls fail, fall back to Gemini-only scoring for 10 minutes
- Log all API failures with status codes and response times
- Consider having Gemini do both visual + reasoning as a fallback (less accurate but functional)
- DeepSeek's cache hit pricing ($0.07/1M) is dramatically cheaper than cache miss ($0.56/1M) -- design prompts with cacheable prefixes

### Pitfall 4: Cost Runaway from Retry Loops

**What goes wrong:** Retry logic for failed LLM parsing re-calls the API 3 times per failure. At scale, a bad prompt template causes 100% parse failures, tripling API costs.
**Prevention:**
- Hard cap retries at 2 (3 total attempts max)
- Log and alert on retry rate > 10%
- Track costs per analysis in the database (`cost_cents` column)
- Set Google AI Studio and DeepSeek API budget alerts/limits
- First, fix the prompt -- retries should be rare, not a crutch

### Pitfall 5: CRON_SECRET Shared Across All Cron Routes

**What goes wrong:** All cron routes use the same `CRON_SECRET`. If it leaks, all cron endpoints are exposed.
**Prevention:**
- This is Vercel's recommended pattern and is fine for now
- Vercel automatically sends `CRON_SECRET` as Bearer token -- it's not user-generated
- If you need per-route secrets, create separate env vars (`CRON_SECRET_SCRAPE`, etc.) but this adds complexity for no practical benefit at current scale

### Pitfall 6: Infinite Scroll Pagination Instability

**What goes wrong:** New scraped videos are inserted while a user is scrolling, causing duplicate or missing items in offset-based pagination.
**Prevention:**
- Use cursor-based pagination (timestamp + id), not OFFSET/LIMIT
- The architecture doc already specifies this pattern (base64url encoded cursor)
- TanStack Query's `useInfiniteQuery` handles cursor pagination natively

## Minor Pitfalls

### Pitfall 1: SSE Connection Handling in React

**What goes wrong:** SSE EventSource connections aren't cleaned up on component unmount, causing memory leaks and zombie connections.
**Prevention:**
- Close EventSource in cleanup function of useEffect
- Or use fetch() with ReadableStream reader, which naturally closes on component unmount
- Test with React StrictMode (development) which mounts/unmounts twice

### Pitfall 2: Supabase RLS Performance on Large Tables

**What goes wrong:** RLS policies with subqueries slow down as tables grow. `scraped_videos` could have 100K+ rows.
**Prevention:**
- Already using `(SELECT auth.uid())` pattern (94% improvement) -- established in existing migrations
- Public read tables (scraped_videos, trending_sounds) have simple `USING (true)` policies -- no performance concern
- Index on all columns used in WHERE clauses of RLS policies

### Pitfall 3: Environment Variable Mismatch Between Local and Vercel

**What goes wrong:** Working locally with one set of API keys, production uses different keys with different rate limits or model access. Pipeline works locally but fails in production.
**Prevention:**
- Keep `.env.local.example` updated with ALL required variables
- Document which API keys need which plan/tier (e.g., Gemini API key needs Flash Lite access enabled)
- Test the full pipeline against production API keys at least once before deploying

### Pitfall 4: Apify Webhook Verification

**What goes wrong:** The Apify webhook endpoint (`/api/webhooks/apify`) accepts any POST request, allowing attackers to inject fake scraping results.
**Prevention:**
- Verify the webhook secret header (similar to existing Whop webhook verification)
- Validate the request body matches Apify's webhook schema
- Optionally: verify the run ID against the Apify API to confirm it's a real completed run

### Pitfall 5: Stale TanStack Query Cache After Mutation

**What goes wrong:** User submits an analysis, but the analysis history page still shows old data because the query cache wasn't invalidated.
**Prevention:**
- Use `queryClient.invalidateQueries({ queryKey: queryKeys.analysis.all })` in the mutation's `onSuccess`
- Or use optimistic updates for instant UI feedback

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Database schema migration | Type drift after schema changes | Automate `supabase gen types` in post-migrate script |
| Gemini/DeepSeek integration | LLM output parsing failures | Zod validation + structured output format + retries |
| Gemini model selection | Using deprecated 2.0 model | Use `gemini-2.5-flash-lite` from the start |
| Apify scraper setup | Actor not returning expected data shape | Test actor manually first, validate output with Zod |
| TanStack Query migration | Half-mock, half-real data inconsistency | Migrate one page fully before starting the next |
| Cron job setup | Hobby plan daily-only limitation | Ensure Vercel Pro plan for per-minute cron |
| SSE streaming for analysis | Client-side connection cleanup | useEffect cleanup, test with StrictMode |
| Cost management | Retry loops multiplying API costs | Hard cap retries, track costs in DB, set API budget alerts |
| Analysis pipeline timeout | DeepSeek R1 CoT generates too many tokens | Set `max_tokens`, implement per-step timeouts, fallback to Gemini-only |
| Production deployment | Environment variable mismatch | Document all env vars, test with production keys pre-deploy |

## Sources

- [Gemini Models deprecation](https://ai.google.dev/gemini-api/docs/models) -- 2.0 Flash deprecated March 31, 2026
- [DeepSeek API Docs](https://api-docs.deepseek.com/) -- reasoning model token limits
- [Vercel Function Duration](https://vercel.com/docs/functions/configuring-functions/duration) -- timeout configuration
- [Vercel Cron Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) -- Hobby vs Pro limits
- [TanStack Query SSR Guide](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr) -- hydration patterns
- Existing codebase patterns (Whop webhook verification, cron auth, Supabase client setup)
- Domain experience: LLM integration failure modes, scraper reliability patterns
