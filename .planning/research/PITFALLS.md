# Domain Pitfalls

**Domain:** AI-powered social media intelligence platform (Next.js 15 + Vercel + Supabase + dual-model AI + Apify scraping)
**Researched:** 2026-02-13
**Scope:** Adding backend to existing frontend-only Next.js app

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, cost blowouts, or production outages.

---

### Pitfall 1: Vercel Function Timeout Kills Dual-Model Pipeline

**What goes wrong:** The analysis pipeline calls Gemini Flash (1-3s) then DeepSeek R1 (2-8s with CoT reasoning, up to 32K reasoning tokens) sequentially. Add network latency, JSON parsing, Zod validation, and DB writes -- total wall time realistically hits 8-15s. Under load with retries, cold starts, and API queuing, requests hit 30s+. DeepSeek specifically warns that during high traffic, connections stay open while queued -- your function burns wall clock time waiting for inference to begin. DeepSeek's 10-minute connection timeout means your Vercel function dies long before DeepSeek gives up.

**Why it happens:** Developers test locally or against warm APIs with low latency. Production has cold starts, API queuing, and concurrent load that compounds latency unpredictably. The dual-model sequential dependency means you inherit the worst-case latency of BOTH models.

**Consequences:** User-facing analysis requests fail silently or return 504s. Partial pipeline completion (Gemini succeeds, DeepSeek times out) leaves data in inconsistent state. If you retry the whole pipeline, you pay for Gemini twice.

**What goes wrong:** The checkout session passes `supabase_user_id` via Whop metadata, and the webhook reads it from `data.metadata?.supabase_user_id`. If the metadata is missing (timeout, mobile browser session loss, direct Whop page access), the webhook silently accepts the event but cannot link payment to a Supabase user. User pays but gets no tier upgrade.
**Why it happens:** The current webhook handler (lines 57-63) logs a warning and returns `{ received: true }` with 200 status when `supabase_user_id` is missing. Whop considers this a successful delivery and never retries.
**Consequences:** User pays but remains on "free" tier. Silent failure. No diagnostic trail. Cron sync cannot fix it because it only syncs existing records.
**Prevention:**
- Set `maxDuration` explicitly on every AI-calling route: `export const maxDuration = 60` minimum
- Enable Vercel Fluid Compute for AI routes (up to 14 min on Pro, configured in project settings)
- Separate Gemini and DeepSeek into independent steps with intermediate state in Supabase -- if one fails, retry only the failed step
- Implement per-call `AbortController` timeouts: 10s for Gemini, 20s for DeepSeek
- Use SSE streaming so the client gets progress updates during the wait
- If DeepSeek times out, return Gemini-only results with a "basic analysis" label -- never block on DeepSeek
- For batch processing, use fire-and-forget pattern (write to queue, return 202 Accepted)
- Limit DeepSeek's CoT output: set `max_tokens` to cap reasoning token generation

**Detection:** Monitor p99 latency on analysis routes. Alert when p95 exceeds 50% of `maxDuration`. Track partial-completion rate (Gemini done + DeepSeek missing).

**Confidence:** HIGH (verified via [Vercel function duration docs](https://vercel.com/docs/functions/configuring-functions/duration), [DeepSeek API docs](https://api-docs.deepseek.com/quick_start/rate_limit))

**Phase to address:** Phase 1 (API route architecture) -- get this wrong and everything built on top fails.

---

### Pitfall 2: LLM Output Parsing Without Schema Validation

**What goes wrong:** Treating LLM JSON output as reliable structured data. Gemini and DeepSeek return malformed JSON, extra markdown wrapping (` ```json ... ``` `), different field names between calls, null values where you expect arrays, or reasoning preamble before the JSON.

**Why it happens:** LLMs are probabilistic. Even with explicit "return ONLY JSON" prompts, they add explanatory text, skip fields, or change casing ~5-10% of the time. DeepSeek R1's chain-of-thought mode is especially prone to wrapping JSON in reasoning text.

**Consequences:** `JSON.parse()` throws, the app crashes, users see "Analysis failed" with no recovery path. Worse: the parse succeeds but fields are wrong types, causing subtle downstream bugs in scoring and predictions.

**What goes wrong:** User clicks referral link (`virtuna.com/?ref=ABC123`), lands on landing page, clicks "Sign Up", goes through OAuth (Google), returns to app. The `?ref=` parameter is lost during the OAuth redirect chain (app -> Supabase -> Google -> Supabase callback -> app).
**Why it happens:** OAuth flows involve multiple redirects. Query parameters from the original URL are not preserved through the chain.
**Consequences:** Referrers don't get credited. Program trust collapses. Revenue attribution inaccurate.
**Prevention:**
- Parse ALL LLM outputs through Zod schemas with `.safeParse()` -- never raw `JSON.parse()`
- Strip markdown code fences before parsing: `/```json?\n?([\s\S]*?)\n?```/`
- For DeepSeek R1, extract JSON from between `<think>...</think>` tags if present
- Set Gemini's `responseMimeType: 'application/json'` and `responseSchema` for structured output
- For DeepSeek: use `response_format: { type: "json_object" }` in the API call
- Implement retry logic: if parse fails, re-prompt once with "Your previous response was not valid JSON. Return ONLY the JSON object."
- Hard cap retries at 2 (3 total attempts max) to prevent cost multiplication
- Have a fallback: if retries exhaust, return graceful error with partial results

**Detection:** Monitor parse failure rate per model. Alert if >5% of analyses fail at the parsing stage. Track retry rate -- if >10%, fix the prompt, don't rely on retries.

**Confidence:** HIGH (verified via Gemini API docs for structured output, community reports on DeepSeek R1 output format)

**Phase to address:** Phase 2 (AI pipeline implementation) -- build the validation layer before writing any analysis logic.

---

### Pitfall 3: Gemini 2.0 Flash Deprecation (March 31, 2026)

**What goes wrong:** Building against `gemini-2.0-flash`. Google retires Gemini 2.0 Flash and Flash-Lite on March 31, 2026 -- just 6 weeks from now. Additionally, Google reduced free tier limits by 80-92% in December 2025 without warning, breaking applications that relied on those quotas. Free tier RPD for Gemini Flash dropped from 250 to 20 requests per day overnight.

**Why it happens:** Developers hardcode model names and don't monitor deprecation announcements. Google's AI model lifecycle moves faster than traditional APIs -- models get retired in months, not years.

**Consequences:** Complete production outage for all AI-powered features. Emergency migration under pressure. Rate limits and pricing differ between model versions.

**What goes wrong:** Trial doesn't auto-convert to paid, or user gets charged on day 1, or trial length is wrong because Whop dashboard config doesn't match app expectations.
**Why it happens:** Whop trial setup is done in their dashboard, not in code. The app assumes specific plan IDs and trial behavior.
**Consequences:** Users charged unexpectedly = chargebacks. Or trial never converts = zero revenue.
**Prevention:**
- Use `gemini-2.5-flash-lite` from day one (the designated replacement, cheaper, actively supported)
- Never hardcode model names in business logic -- use a configuration layer:
  ```typescript
  // config/ai-models.ts
  export const AI_MODELS = {
    fast_analysis: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite',
    deep_reasoning: process.env.DEEPSEEK_MODEL ?? 'deepseek-reasoner',
  } as const;
  ```
- Build model-agnostic prompt templates that work across Gemini versions
- Subscribe to Google AI developer announcements
- Use paid tier (Tier 1+) -- free tier limits are too unstable for production

**Detection:** Automated health check that calls each model daily with a known prompt. Alert on any 4xx/5xx from model APIs. Monitor Google deprecation announcements.

**Confidence:** HIGH (verified: retirement date confirmed in [multiple sources](https://www.aifreeapi.com/en/posts/gemini-api-free-tier-not-working), [Google rate limits page](https://ai.google.dev/gemini-api/docs/rate-limits))

**Phase to address:** Phase 1 (AI integration setup) -- use the right model from day one.

---

### Pitfall 4: Supabase RLS Disabled = Public Database

**What goes wrong:** You create tables for video analyses, user data, scraped content. You forget to enable RLS on one or more tables. Every row is publicly accessible via the Supabase REST API. In January 2025, 170+ apps built on Supabase were found with exposed databases due to this exact mistake. 83% of Supabase security incidents involve RLS misconfigurations.

**Why it happens:** RLS is disabled by default on new tables. The SQL Editor runs as `postgres` superuser and bypasses all RLS, so queries "work" during development. You only discover the problem when someone accesses your data through the auto-generated REST API.

**Consequences:** Complete data breach. User data, AI analysis results, proprietary prediction models -- all publicly readable and writable.

**What goes wrong:** Interactive Canvas visualization runs at 60fps on desktop but stutters or crashes on mobile. TikTok creators are 80%+ mobile users.
**Why it happens:** Existing hive renders 1300+ nodes with d3-quadtree physics. Directly porting this to landing page creates 5+ second load on mobile.
**Consequences:** Bounce rate spikes. The demo that should sell the product becomes the reason people leave.
**Prevention:**
- Enable RLS on EVERY table at creation time -- make it part of your migration template:
  ```sql
  CREATE TABLE analyses (...);
  ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
  -- THEN add policies
  ```
- Never test RLS through the SQL Editor -- always test through the Supabase client SDK with actual JWT auth
- Add a CI check that queries `pg_tables` and fails if any public table has `rowsecurity = false`
- Use Supabase's built-in Database Advisor (lint `0013_rls_disabled_in_public`)
- Never use `service_role` key in client-side code -- it bypasses RLS entirely
- INSERT policies need corresponding SELECT policies too (PostgreSQL SELECTs newly inserted rows to return them, fails without SELECT policy with cryptic "new row violates policy" errors)
- Write INSERT policies with `WITH CHECK` clauses -- without them, users can insert rows with any `user_id`

**Detection:** Run `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';` in CI. Automated test that attempts to read protected data without auth.

**Confidence:** HIGH (verified via [Supabase RLS docs](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv), [170+ apps exposed report](https://byteiota.com/supabase-security-flaw-170-apps-exposed-by-missing-rls/))

**Phase to address:** Phase 1 (database schema design) -- bake RLS into every migration from the start.

---

### Pitfall 5: API Key Exposure in Client-Side Code

**What goes wrong:** Using `NEXT_PUBLIC_GEMINI_API_KEY` or similar, exposing AI API keys to the browser. Automated bots scan public JavaScript for API keys and exploit them within minutes. Google will detect the leak, disable the key, and you get a simultaneous outage AND a potential bill.

**Why it happens:** Next.js convention: `NEXT_PUBLIC_` prefix makes env vars available client-side. Developers add the prefix to "make it work" without understanding the security implications. Leaked Gemini API keys face immediate exploitation -- bots scanning GitHub and deployed bundles can generate thousands of dollars in charges within hours.

**Consequences:** API key theft. Unauthorized usage burning your quota and budget. Google may disable the key entirely. Emergency key rotation and redeployment.

**What goes wrong:** Canvas uses `touchAction: 'none'` and `preventDefault()` on touch events. On mobile, touch on the canvas prevents scrolling past the hero section.
**Why it happens:** Canvas interaction requires capturing touch events, but mobile browsers stop scroll propagation when touchAction is 'none'.
**Consequences:** Users get "stuck" on hero section. Cannot scroll to pricing. Bounce rate spikes.
**Prevention:**
- AI API keys NEVER get `NEXT_PUBLIC_` prefix
- All AI calls go through API routes (server-side Route Handlers) only
- Enforce with a CI check:
  ```bash
  grep -r "NEXT_PUBLIC_.*\(API_KEY\|SECRET\|TOKEN\)" .env* && exit 1
  ```
- Use Vercel's environment variable UI for production secrets (not `.env` files committed to git)
- Naming convention that signals intent: `GEMINI_API_KEY` (server), `NEXT_PUBLIC_APP_URL` (client)
- Add `.env*.local` to `.gitignore` (default in Next.js, but verify)
- Use separate API keys for dev/staging/production

**Detection:** Scan built client bundles for API key patterns. GitHub secret scanning (enabled by default on public repos). Review all `process.env.NEXT_PUBLIC_` references in codebase.

**Confidence:** HIGH (verified via [Google API key docs](https://ai.google.dev/gemini-api/docs/api-key), [Next.js security guide](https://nextnative.dev/blog/api-key-secure))

**Phase to address:** Phase 1 (project setup) -- establish env var conventions before writing any code.

---

### Pitfall 6: AI API Cost Explosion at Scale

**What goes wrong:** At ~$0.013/analysis, processing 5,000 videos costs ~$65 per scraping cycle. With 4 cycles/day, that's $260/day or ~$7,800/month just for AI analysis. But this assumes happy path. Retries from LLM parsing failures (Pitfall 2) double costs. A runaway loop or bug that triggers re-analysis can burn through budget in hours. A bad prompt template causing 100% parse failures with retry logic = 3x cost.

**Why it happens:** Developers estimate costs from the happy path (one call per analysis) and don't account for: retries on failures, re-processing on schema changes, runaway loops from bugs, exponential backoff retry storms, and key theft. 21% of companies have no formal AI cost tracking.

**Consequences:** Monthly bills 3-10x projected. For a startup, this can be existential.

**What goes wrong:** Whop retries webhooks on non-2xx responses. Current handler has no duplicate event detection. If membership.went_valid replays after adding referral bonus logic, bonuses are credited multiple times.
**Why it happens:** HTTP webhooks provide at-least-once delivery, not exactly-once. Handler assumes exactly-once.
**Consequences:** Double referral bonuses, duplicate wallet transactions, incorrect analytics.
**Prevention:**
- Implement hard budget caps at the application level:
  ```typescript
  const DAILY_BUDGET_CENTS = 30000; // $300/day max
  const dailySpend = await getDailySpend();
  if (dailySpend >= DAILY_BUDGET_CENTS) {
    await alertOps('Budget cap reached');
    throw new BudgetExceededError();
  }
  ```
- Track cost per API call in an `api_costs` table: model, tokens_in, tokens_out, cost_usd
- Set Google Cloud billing alerts at 50%, 80%, 100% of monthly budget
- Deduplicate: hash video content/URL and skip re-analysis of already-processed items
- Cache AI responses aggressively -- same video metadata should return cached analysis
- Rate-limit your own pipeline: process max N videos per minute, not all at once
- Use circuit breakers: if error rate exceeds 20%, stop calling that API for 5 minutes
- Leverage DeepSeek's cache hit pricing ($0.07/1M vs $0.56/1M cache miss) -- design prompts with cacheable prefixes

**Detection:** Real-time cost dashboard. Alert when hourly spend exceeds 2x normal. Alert on retry rate >10%.

**Confidence:** HIGH (verified via Google pricing docs, [AI cost management research](https://www.cloudzero.com/state-of-ai-costs/))

**Phase to address:** Phase 2 (AI pipeline) -- implement cost controls BEFORE running at scale.

---

### Pitfall 7: Apify Scraping Pipeline Silent Failures

**What goes wrong:** Your Apify actor scrapes 5,000 videos every 6 hours. One day, TikTok changes their page structure. The actor returns 5,000 results but 80% have null/empty fields. Your pipeline dutifully processes this garbage data, runs AI analysis on it (spending money), and stores corrupted results. Users see predictions based on bad data. You don't notice for days.

**Why it happens:** Scraping is inherently fragile. Platform HTML changes break selectors without warning. Apify actors may return partial data rather than erroring. Rate limiting by the target platform returns soft failures (empty responses that parse as valid). Apify's own blog confirms page changes are "one of the most common problems" in large-scale scraping.

**Consequences:** Corrupted analysis database. Wrong predictions served to users. Wasted AI API spend on garbage data (compounding Pitfall 6). Trust damage that's hard to recover.

**What goes wrong:** User purchases Pro, modal closes via onComplete callback, but page still shows upgrade prompts because getUserTier() is cached.
**Why it happens:** Server Components in Next.js can be cached. Webhook processing is asynchronous and may not complete before user's browser navigates.
**Consequences:** User pays but sees no immediate change. Panics, contacts support.
**Prevention:**
- Validate scraped data BEFORE processing:
  ```typescript
  const REQUIRED_FIELDS = ['title', 'viewCount', 'likeCount', 'uploadDate'];
  const validItems = items.filter(item => {
    const hasAllFields = REQUIRED_FIELDS.every(f => item[f] != null && item[f] !== '');
    const hasReasonableValues = item.viewCount >= 0 && item.likeCount >= 0;
    return hasAllFields && hasReasonableValues;
  });
  const validationRate = validItems.length / items.length;
  if (validationRate < 0.7) {
    await alertOps('Scraping quality degraded', { validationRate });
    throw new ScrapingQualityError(validationRate);
  }
  ```
- Store raw scraped data in a staging table, validate, then promote to production table
- Track per-field null rates and compare against 7-day historical average
- Pin Apify actor versions -- don't auto-update
- Don't delete old scraped data on each run -- upsert and let old data age out
- Test the specific Apify actor manually before committing to it

**Detection:** Per-field null rate tracking. Historical comparison (today's scrape vs 7-day average). Alert when item count drops by >30% or null rate rises by >20%.

**Confidence:** HIGH (verified via [Apify monitoring guide](https://blog.apify.com/why-you-need-to-monitor-long-running-large-scale-scraping-projects/), [Apify scraping challenges](https://blog.apify.com/web-scraping-challenges/))

**Phase to address:** Phase 2 (data pipeline) -- build validation into the pipeline architecture, not bolted on later.

---

## Moderate Pitfalls

---

### Pitfall 8: Supabase Connection Exhaustion Under Serverless Load

**What goes wrong:** Each Vercel serverless function invocation can open a new database connection. Under concurrent load (processing a batch of 5,000 videos with parallel analysis), you exhaust Supabase's connection pool. Connections "leak" because serverless function suspension doesn't trigger pool cleanup -- the function suspends but the connection stays open. This is a documented issue affecting Vercel + Supabase specifically (GitHub discussion #40671 from November 2025).

**Why it happens:** Serverless functions have a fundamentally different lifecycle than traditional servers. A pool client's idle timeout never fires because the function is suspended, not terminated. Even with Vercel Fluid Compute reusing instances, burst load creates many instances simultaneously.

**Consequences:** Database becomes unreachable. ALL features fail simultaneously -- not just batch processing, but also user-facing app. Recovery requires Supabase pooler restart.

**What goes wrong:** Users create multiple accounts to self-refer and farm bonuses. With card-upfront trials, they can get credit before first payment.
**Why it happens:** One-time bonuses are exploitable if triggered on trial start rather than first payment.
**Consequences:** Bonus payouts without real conversions. Budget drain.
**Prevention:**
- Use Supabase's Supavisor connection pooler (`pooler` connection string) for ALL serverless connections
- Use transaction mode (port 6543), not session mode, for serverless
- Limit concurrent batch processing: queue with concurrency limit of 10-20, not 5,000 parallel operations
- Use a single Supabase client instance per function invocation
- Monitor active connections: `SELECT count(*) FROM pg_stat_activity;`
- Separate read and write paths if needed

**Detection:** Monitor `pg_stat_activity` count. Alert at 60% of max connections. Track connection creation rate per minute.

**Confidence:** HIGH (verified via [Supabase Supavisor FAQ](https://supabase.com/docs/guides/troubleshooting/supavisor-faq-YyP5tI), [Vercel connection pooling guide](https://vercel.com/kb/guide/connection-pooling-with-functions), [GitHub #40671](https://github.com/orgs/supabase/discussions/40671))

**Phase to address:** Phase 1 (database setup) -- configure pooling correctly from the start.

---

### Pitfall 9: DeepSeek API Instability Tanks Pipeline Reliability

**What goes wrong:** DeepSeek has had 69+ outages in the past year, with 4 major outages and 4 minor incidents in the last 90 days. Median outage duration is 33 minutes. Most recently, degraded performance on Feb 6, 2026 (1 week ago). If DeepSeek is a hard dependency, ALL analysis fails when it's down, even though Gemini works fine.

**Why it happens:** DeepSeek is a newer API provider with less infrastructure maturity. Their "no fixed rate limit" policy means they throttle dynamically under load, which is unpredictable. During peak usage, connections stay open waiting for inference to begin, consuming your function's wall clock time.

**Consequences:** 33+ minute outages occurring roughly weekly. Pipeline stops entirely during outages. Users see stale or missing predictions. Batch processing halts mid-run, leaving partial data.

**What goes wrong:** Onboarding state stored only in localStorage/cookie. Returning user on new device or after clearing browser data sees onboarding again.
**Why it happens:** Using client-side storage instead of database for completion state.
**Consequences:** Power users frustrated. Repeat onboarding on every device.
**Prevention:**
- Design DeepSeek as an ENHANCER, not a blocker -- Gemini analysis alone must produce usable results
- Implement circuit breaker:
  ```typescript
  // After 3 consecutive failures, skip DeepSeek for 5 minutes
  const deepseekCircuit = new CircuitBreaker({
    failureThreshold: 3,
    resetTimeout: 300_000,
  });
  ```
- Store an `analysis_depth` field: 'basic' (Gemini only) vs 'full' (Gemini + DeepSeek)
- Show users basic analysis immediately, enhance with DeepSeek results when available
- Queue DeepSeek analysis as a background task that retries when service recovers
- Consider having Gemini do both visual + reasoning as a fallback (less accurate but functional)
- Track DeepSeek status page (status.deepseek.com) programmatically

**Detection:** Track DeepSeek success rate per hour. Circuit breaker state dashboard. Compare basic vs full analysis completion rates.

**Confidence:** HIGH (verified via [status.deepseek.com](https://status.deepseek.com/), [StatusGator tracking](https://statusgator.com/services/deepseek/api--api-service), [API instability analysis](https://api7.ai/blog/analyzing-deepseek-api-instability))

**Phase to address:** Phase 2 (AI pipeline) -- build graceful degradation into the architecture.

---

### Pitfall 10: Vercel Cron Jobs Can't Orchestrate Long-Running Scraping

**What goes wrong:** You set up a Vercel cron job to trigger scraping every 6 hours. The cron job triggers a serverless function that kicks off an Apify actor run. The actor takes 30-60 minutes to complete. But Vercel Pro functions timeout at 60s default (14 min max with Fluid Compute). You can't wait for the Apify run to complete within a single function invocation.

**Why it happens:** Vercel cron jobs invoke Vercel Functions subject to the same timeout limits. They're designed for lightweight tasks (send email, update cache), not orchestrating long-running external processes. Vercel Pro: 100 cron jobs per project, once/min minimum frequency, function timeout still applies.

**Consequences:** Scraping pipeline fails to complete. Data goes stale. Hacking around with chained cron jobs creates a fragile system.

**What goes wrong:** Deleting `/app/(app)/trending/` removes the route but leaves sidebar nav item, mock data, types, and hooks scattered across 11 files.
**Why it happens:** Trending page is wired into sidebar, types, mock data, and hooks.
**Consequences:** Sidebar shows "Trending Feed" link to 404. Dead code confuses future developers.
**Prevention:**
- Use fire-and-forget pattern: cron job STARTS the Apify actor, then returns immediately
- Use Apify webhooks to notify your app when the actor run COMPLETES
- Architecture:
  ```
  Vercel Cron (every 6h) → POST /api/scraping/trigger → calls Apify API to start actor → returns 200
  ...30-60 min later...
  Apify Webhook → POST /api/scraping/complete → ingests data into Supabase staging table
  ```
- Alternative: use Supabase pg_cron + pg_net to trigger Edge Functions on a schedule
- Track scraping job state in a `scraping_jobs` table: started_at, completed_at, status, item_count
- Verify Apify webhook with a secret token in the URL

**Detection:** Monitor time between cron trigger and webhook callback. Alert if scraping cycle doesn't complete within 2 hours.

**Confidence:** HIGH (verified via [Vercel cron docs](https://vercel.com/docs/cron-jobs), [Vercel cron pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Apify webhook docs](https://docs.apify.com/platform/integrations/webhooks/actions))

**Phase to address:** Phase 2 (scraping pipeline) -- design the async pattern before building.

---

### Pitfall 11: Duplicating Server State in Both Zustand and TanStack Query

**What goes wrong:** The existing app uses Zustand for state. You add TanStack Query for server data fetching. Developers start syncing server data between both: fetching with TanStack Query, then writing the result to Zustand, then reading from Zustand in components. Two sources of truth for the same data that drift out of sync.

**Why it happens:** When adding TanStack Query to an existing Zustand codebase, the natural instinct is "put everything in the store like we always have." Developers don't realize TanStack Query IS the cache/store for server state.

**Consequences:** Stale data bugs that are nightmarishly hard to debug. Cache invalidation happens in TanStack Query but the Zustand copy is stale. Double memory usage. Inconsistent UI states.

**Prevention:**
- Hard rule: TanStack Query owns ALL server state. Zustand owns ONLY client state (UI preferences, form drafts, local-only data)
- Never write TanStack Query results into Zustand:
  ```typescript
  // BAD
  const { data } = useQuery({ queryKey: ['analyses'], queryFn: fetchAnalyses });
  useEffect(() => { useStore.setState({ analyses: data }); }, [data]);

  // GOOD -- use data directly from the hook
  const { data: analyses } = useQuery({ queryKey: ['analyses'], queryFn: fetchAnalyses });
  ```
- Use TanStack Query's `select` option for derived state, not Zustand computed values
- Audit existing Zustand stores: identify server state that should migrate to TanStack Query
- Migrate one page fully before starting the next -- don't leave a page half-mock, half-real

**Detection:** Code review rule: any `useEffect` that writes query data to Zustand is a red flag. Grep for patterns like `setState.*data` in components that also use `useQuery`.

**Confidence:** HIGH (verified via [TanStack Query docs](https://tanstack.com/query/v4/docs/framework/react/guides/does-this-replace-client-state), [Zustand discussion #2289](https://github.com/pmndrs/zustand/discussions/2289))

**Phase to address:** Phase 3 (frontend integration) -- establish the boundary before adding queries.

---

### Pitfall 12: RLS Policy Performance Destroys Query Speed at Scale

**What goes wrong:** RLS policies with subqueries cause sequential scans. A policy like `user_id IN (SELECT user_id FROM team_members WHERE team_id = analyses.team_id)` runs the subquery per row. At 10K rows: 50ms instead of 2ms. At 1M rows (realistic: 5K videos x 200 days): queries time out.

**Why it happens:** RLS policies are evaluated per-row. Without indexes, every row requires a full table scan of the referenced tables. Developers test with small datasets and don't notice. The Supabase SQL Editor bypasses RLS entirely, hiding the problem.

**Consequences:** Dashboard loads take 5-10+ seconds. API routes timeout. App feels broken even though the logic is correct.

**Prevention:**
- Index EVERY column referenced in an RLS policy
- Write policies with the auth query first (efficient):
  ```sql
  -- GOOD: filter by auth.uid() first, cache the result
  CREATE POLICY "users see own data" ON analyses
    FOR SELECT USING (
      team_id IN (SELECT team_id FROM team_members WHERE user_id = (SELECT auth.uid()))
    );

  -- BAD: per-row subquery
  CREATE POLICY "users see own data" ON analyses
    FOR SELECT USING (
      (SELECT auth.uid()) IN (SELECT user_id FROM team_members WHERE team_id = analyses.team_id)
    );
  ```
- Wrap `auth.uid()` in `(SELECT auth.uid())` to enable PostgreSQL initPlan caching (documented 94% improvement)
- Run `EXPLAIN ANALYZE` on queries with RLS enabled to verify index usage
- Use Supabase's Performance Advisor
- Public read tables (scraped_videos, trending) use simple `USING (true)` -- no perf concern

**Detection:** `pg_stat_statements` for slow query tracking. Alert for queries exceeding 100ms.

**Confidence:** HIGH (verified via [Supabase RLS performance docs](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv))

**Phase to address:** Phase 1 (database schema) -- write efficient policies from the start.

---

### Pitfall 13: Vercel 4.5MB Body Size Limit Blocks Batch Responses

**What goes wrong:** An API route processes batch analyses and tries to return all results. With 100+ analyses containing AI text, metadata, and scores, the response exceeds 4.5MB. Vercel returns 413. Worse: Next.js's `bodyParser.sizeLimit` config works locally but is IGNORED by Vercel's hard limit.

**Why it happens:** Vercel has a hard 4.5MB limit on both request and response bodies. This cannot be overridden by Next.js config. Developers test locally where the limit doesn't exist.

**Consequences:** Batch operations fail in production but work in development. Frontend redesign needed if you assumed all results come in one response.

**Prevention:**
- Design API routes for pagination from day one -- never return unbounded lists
- Use cursor-based pagination (not OFFSET/LIMIT which is unstable when new rows are inserted):
  ```typescript
  // /api/analyses?cursor=xxx&limit=50
  const { data, nextCursor } = await getAnalyses({ cursor, limit: 50 });
  ```
- For batch results, write to Supabase and let client query directly
- For large payloads, use streaming responses (not subject to 4.5MB limit)
- For media: use Supabase Storage with signed URLs, never proxy through Vercel

**Detection:** Monitor response body sizes. Alert on any route returning >2MB.

**Confidence:** HIGH (verified via [Vercel body size docs](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions))

**Phase to address:** Phase 1 (API architecture) -- design pagination into every list endpoint.

---

### Pitfall 14: Cost Runaway from Retry Loops

**What goes wrong:** Retry logic for failed LLM parsing (Pitfall 2) re-calls the API 3 times per failure. A bad prompt template causes 100% parse failures across 5,000 videos. Retries triple the API cost: $65/cycle becomes $195/cycle. With 4 cycles/day: $780/day instead of $260/day.

**Prevention:**
- Hard cap retries at 2 (3 total attempts max)
- Log and alert on retry rate >10% -- this means the prompt needs fixing, not more retries
- Track costs per analysis in the database (`cost_cents` column)
- Set API budget alerts at provider level (Google AI Studio, DeepSeek dashboard)
- First fix the prompt -- retries should be rare (<3%), not a crutch

**Confidence:** HIGH (derived from cost analysis + LLM integration patterns)

**Phase to address:** Phase 2 (AI pipeline) -- cost tracking from day one.

---

## Minor Pitfalls

---

### Pitfall 15: Supabase Edge Functions 2-Second CPU Limit

**What goes wrong:** You put processing logic in Supabase Edge Functions. The function does CPU-intensive work (JSON parsing large payloads, text processing). It exceeds the 2-second CPU time limit and gets killed, even though wall clock time (150s) is fine.

**Prevention:**
- Supabase Edge Functions for lightweight orchestration only (trigger Apify, validate webhooks, route requests)
- CPU-intensive work goes in Vercel Functions (more generous CPU limits)
- Async I/O (waiting for API responses) doesn't count toward 2s CPU limit, but parsing/processing does

**Confidence:** HIGH (verified via [Supabase Edge Functions limits](https://supabase.com/docs/guides/functions/limits))

**Phase to address:** Phase 2 (pipeline architecture).

---

### Pitfall 16: Supabase Type Generation Drift

**What goes wrong:** Database schema changes via migration but `database.types.ts` isn't regenerated. TypeScript types don't match actual DB columns. Queries succeed at runtime but types are wrong, causing subtle bugs.

**Prevention:**
- Run `supabase gen types typescript --local > src/types/database.types.ts` after EVERY migration
- Add to a `postmigrate` script in package.json
- CI check: regenerate types and diff against committed version

**Confidence:** HIGH (standard Supabase development issue)

**Phase to address:** Phase 1 (project setup).

---

### Pitfall 17: No Idempotency in the Data Pipeline

**What goes wrong:** Apify webhook fires twice (network retry). Pipeline processes the same batch twice, creating duplicate analyses. Or a partial failure triggers a retry that re-processes already-completed items.

**Prevention:**
- Use Apify run ID as a deduplication key:
  ```sql
  CREATE UNIQUE INDEX idx_analyses_source ON analyses(source_run_id, video_id);
  ```
- Use `INSERT ... ON CONFLICT DO NOTHING` for batch inserts
- Track pipeline execution state: `pipeline_runs` table with run_id, status, items_processed

**Confidence:** HIGH (standard distributed systems concern)

**Phase to address:** Phase 2 (pipeline implementation).

---

### Pitfall 18: Stale TanStack Query Cache After Batch Processing

**What goes wrong:** Batch pipeline processes 5,000 videos and writes results to Supabase. Users see stale data because TanStack Query has cached previous results and doesn't know new data exists.

**Prevention:**
- Use Supabase Realtime subscriptions to trigger TanStack Query invalidation:
  ```typescript
  supabase.channel('analyses').on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'analyses' },
    () => queryClient.invalidateQueries({ queryKey: ['analyses'] })
  ).subscribe();
  ```
- Set reasonable `staleTime` values: data updating every 6 hours doesn't need 30-second refetching

**Confidence:** MEDIUM (standard pattern, verified via both TanStack Query and Supabase docs)

**Phase to address:** Phase 3 (frontend data layer).

---

### Pitfall 19: ML Training Pipeline Doesn't Belong in Vercel

**What goes wrong:** Attempting ML model training in Vercel serverless functions. Training requires iterative computation, long execution, and persistent state between iterations. Serverless offers none of this.

**Prevention:**
- ML training is an offline job -- run in Google Colab, Modal, or a VPS
- Export trained model weights to Supabase Storage
- Vercel app only does inference (loading pre-trained weights, running predictions)
- Simple statistical models: pre-compute coefficients in a scheduled job, store as JSON in Supabase

**Confidence:** HIGH (Vercel fundamentally unsuited for training workloads)

**Phase to address:** Phase 4 (ML infrastructure).

---

### Pitfall 20: Supabase Free Plan Storage Ceiling

**What goes wrong:** 5,000 videos x 4 cycles/day x analysis data fills the 500MB free tier in weeks. Supabase enters read-only mode. Pipeline silently fails to write new data.

**Prevention:**
- Start on Supabase Pro ($25/month) from day one -- 8GB database included
- Implement data retention: archive old analyses to cold storage
- Monitor size: `SELECT pg_database_size(current_database());`
- Store structured data, not raw AI response text

**Confidence:** HIGH (verified via [Supabase pricing docs](https://supabase.com/pricing))

**Phase to address:** Phase 1 (infrastructure setup).

---

### Pitfall 21: SSE Connection Cleanup in React

**What goes wrong:** SSE EventSource connections for real-time analysis progress aren't cleaned up on component unmount, causing memory leaks and zombie connections.

**Prevention:**
- Close EventSource in useEffect cleanup
- Or use fetch() with ReadableStream reader (naturally closes on unmount)
- Test with React StrictMode (double mount/unmount in development)

**Confidence:** MEDIUM (standard React pattern)

**Phase to address:** Phase 3 (frontend integration).

---

### Pitfall 22: Apify Webhook Security Not Validated

**What goes wrong:** The `/api/scraping/complete` endpoint accepts any POST request. Attacker injects fake scraping results into your pipeline.

**Prevention:**
- Include a secret token in Apify webhook URL: `/api/scraping/complete?secret=YOUR_WEBHOOK_SECRET`
- Validate secret on every request before processing
- Validate payload structure matches expected Apify output schema
- Optionally: verify run ID against Apify API to confirm it's a real completed run

**Confidence:** HIGH (verified via [Apify webhook docs](https://docs.apify.com/platform/integrations/webhooks/actions))

**Phase to address:** Phase 2 (scraping pipeline).

---

### Pitfall 23: Environment Variable Mismatch Between Local and Vercel

**What goes wrong:** Different API keys locally vs production with different rate limits or model access. Pipeline works locally but fails in production.

**Prevention:**
- Keep `.env.local.example` updated with ALL required variables
- Document which API keys need which plan/tier
- Test full pipeline against production keys at least once before deploying

**Confidence:** HIGH (common deployment issue)

**Phase to address:** Phase 1 (project setup).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation | Severity |
|-------------|---------------|------------|----------|
| **Phase 1: DB Schema & API Setup** | RLS disabled on tables (#4) | Enable RLS in every migration, CI check | Critical |
| **Phase 1: DB Schema & API Setup** | Connection pooling misconfigured (#8) | Use Supavisor transaction mode from day one | Critical |
| **Phase 1: DB Schema & API Setup** | Env var leak via NEXT_PUBLIC_ (#5) | Naming convention, CI lint | Critical |
| **Phase 1: DB Schema & API Setup** | RLS policy performance (#12) | Index policy columns, use `(SELECT auth.uid())` | Moderate |
| **Phase 1: DB Schema & API Setup** | Body size limit surprise (#13) | Pagination in all endpoints | Moderate |
| **Phase 1: DB Schema & API Setup** | Free tier storage ceiling (#20) | Start on Supabase Pro | Minor |
| **Phase 1: DB Schema & API Setup** | Type generation drift (#16) | Automate in postmigrate script | Minor |
| **Phase 2: AI Pipeline** | Function timeout kills pipeline (#1) | Separate models, Fluid Compute, SSE | Critical |
| **Phase 2: AI Pipeline** | LLM output parsing fails (#2) | Zod validation, structured output, retries | Critical |
| **Phase 2: AI Pipeline** | Gemini model retirement (#3) | Use 2.5-flash-lite, config layer | Critical |
| **Phase 2: AI Pipeline** | Cost explosion (#6) | Budget caps, dedup, cost tracking | Critical |
| **Phase 2: AI Pipeline** | DeepSeek instability (#9) | Circuit breaker, graceful degradation | Moderate |
| **Phase 2: AI Pipeline** | Retry cost multiplication (#14) | Hard cap retries, fix prompts first | Moderate |
| **Phase 2: Scraping Pipeline** | Silent scraping failures (#7) | Data validation, quality metrics | Critical |
| **Phase 2: Scraping Pipeline** | Cron can't orchestrate long jobs (#10) | Fire-and-forget + webhook pattern | Moderate |
| **Phase 2: Scraping Pipeline** | No idempotency (#17) | Unique constraints, ON CONFLICT | Moderate |
| **Phase 2: Scraping Pipeline** | Webhook security (#22) | Secret token validation | Minor |
| **Phase 3: Frontend Integration** | Zustand/TanStack state duplication (#11) | Server state in TanStack only | Moderate |
| **Phase 3: Frontend Integration** | Stale cache after batch (#18) | Realtime subscription invalidation | Minor |
| **Phase 3: Frontend Integration** | SSE connection leaks (#21) | useEffect cleanup | Minor |
| **Phase 4: ML Training** | Training in Vercel (#19) | Off-platform training only | Moderate |
| **Phase 4: ML Training** | Edge Function CPU limit (#15) | Edge for orchestration only | Minor |

---

## Sources

### Vercel
- [Vercel Function Timeout Guide](https://vercel.com/kb/guide/what-can-i-do-about-vercel-serverless-functions-timing-out)
- [Vercel Limits](https://vercel.com/docs/limits)
- [Vercel Function Duration Config](https://vercel.com/docs/functions/configuring-functions/duration)
- [Vercel Cron Jobs Docs](https://vercel.com/docs/cron-jobs)
- [Vercel Cron Usage & Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Vercel Body Size Limit](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions)
- [How to Solve Next.js Timeouts - Inngest](https://www.inngest.com/blog/how-to-solve-nextjs-timeouts)
- [Vercel Connection Pooling Guide](https://vercel.com/kb/guide/connection-pooling-with-functions)
- [Serverless Database Connection Problem - Vercel Blog](https://vercel.com/blog/the-real-serverless-compute-to-database-connection-problem-solved)

### Supabase
- [Supabase RLS Performance Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Supabase Database Advisors](https://supabase.com/docs/guides/database/database-advisors)
- [Supabase Edge Functions Limits](https://supabase.com/docs/guides/functions/limits)
- [Supabase Supavisor FAQ](https://supabase.com/docs/guides/troubleshooting/supavisor-faq-YyP5tI)
- [Supabase Pricing](https://supabase.com/pricing)
- [Supabase pg_cron](https://supabase.com/docs/guides/database/extensions/pg_cron)
- [Supavisor Connection Leak Discussion #40671](https://github.com/orgs/supabase/discussions/40671)
- [Max Connection Issue #29675](https://github.com/supabase/supabase/issues/29675)
- [170+ Apps Exposed by Missing RLS](https://byteiota.com/supabase-security-flaw-170-apps-exposed-by-missing-rls/)

### AI APIs
- [Gemini API Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Gemini API Key Security](https://ai.google.dev/gemini-api/docs/api-key)
- [DeepSeek API Rate Limits](https://api-docs.deepseek.com/quick_start/rate_limit)
- [DeepSeek Service Status](https://status.deepseek.com/)
- [DeepSeek API Instability Analysis](https://api7.ai/blog/analyzing-deepseek-api-instability)
- [Gemini 2.0 Flash Retirement & December 2025 Changes](https://www.aifreeapi.com/en/posts/gemini-api-free-tier-not-working)
- [AI Cost Management State 2025](https://www.cloudzero.com/state-of-ai-costs/)

### Apify
- [Apify Webhook Actions](https://docs.apify.com/platform/integrations/webhooks/actions)
- [Apify Large-Scale Scraping Monitoring](https://blog.apify.com/why-you-need-to-monitor-long-running-large-scale-scraping-projects/)
- [Apify Web Scraping Challenges](https://blog.apify.com/web-scraping-challenges/)

### Integration Patterns
- [TanStack Query - Does It Replace Client State?](https://tanstack.com/query/v4/docs/framework/react/guides/does-this-replace-client-state)
- [Zustand + TanStack Query Best Practices](https://github.com/pmndrs/zustand/discussions/2289)
- [Next.js API Key Security](https://nextnative.dev/blog/api-key-secure)
