# Domain Pitfalls

**Domain:** TikTok Competitor Intelligence Tracking (added to existing Next.js + Supabase SaaS)
**Researched:** 2026-02-16

---

## Critical Pitfalls

Mistakes that cause rewrites, runaway costs, or service-level failures.

---

### Pitfall 1: TikTok Anti-Bot Arms Race Breaks Scraping Overnight

**What goes wrong:** TikTok deploys industry-leading anti-scraping: encrypted headers, device integrity checks, browser fingerprinting, behavioral analysis, JavaScript challenges, CAPTCHAs, and real-time fraud scoring. A scraper that works today can be fully blocked tomorrow with no warning. The Jan 2026 TikTok USDS/Oracle transition changed data handling and anti-bot infrastructure.

**Why it happens:** Teams build scraping directly into their application code, tightly coupling the data pipeline to a specific scraping technique. When TikTok changes detection methods, the entire data layer breaks and requires emergency rewrites.

**Consequences:**
- Complete data pipeline failure with no fallback
- Users see stale data for days/weeks during recovery
- Competitor tracking becomes unreliable, destroying trust
- Emergency engineering time to adapt scraping approach

**Prevention:**
- Abstract data acquisition behind a `CompetitorDataProvider` interface. The app never knows HOW data is fetched -- only that it receives structured competitor data
- Use a third-party scraping service (Apify, ScrapFly, or similar) that handles proxy rotation, fingerprint management, and anti-bot adaptation as their core business -- do NOT build a custom scraper
- Implement a multi-source fallback chain: Primary API/service -> Secondary service -> Cached stale data with "last updated X ago" indicator
- Budget for the scraping service as a variable COGS line item, not a one-time build cost

**Detection:**
- Scraping success rate drops below 90%
- Increased 403/429 response codes in logs
- Data freshness degrades (records older than expected refresh interval)
- Proxy service billing spikes (more retries per successful request)

**Phase:** Data infrastructure (early) -- abstraction layer must be designed before any scraping code is written.
**Confidence:** HIGH (multiple 2026 sources confirm TikTok's aggressive anti-bot measures)

**Sources:**
- [How We Combat Unauthorized Data Scraping of TikTok](https://www.tiktok.com/privacy/blog/how-we-combat-scraping/en)
- [How To Scrape TikTok in 2026 - ScrapFly](https://scrapfly.io/blog/posts/how-to-scrape-tiktok-python-json)
- [TikTok Scraping Teardown - ScrapeOps](https://scrapeops.io/websites/tiktok/)

---

### Pitfall 2: "Unlimited Competitor Tracking" Creates Unbounded Costs

**What goes wrong:** Offering unlimited competitor tracking to all users means scraping costs scale linearly (or worse) with user growth. If 1,000 users each track 10 competitors with daily refreshes, that is 10,000 scraping requests/day. At $0.002/request via API services, that is $20/day ($600/month) just for scraping -- and that is before proxy costs, storage, and egress. With residential proxies at $2-5/GB, the bandwidth costs compound further.

**Why it happens:** "Unlimited" feels like a strong value proposition, but without per-user cost modeling, it creates a classic SaaS death spiral: more users = more cost = negative unit economics. Unlike compute costs that amortize, scraping costs are strictly per-target-per-refresh.

**Consequences:**
- Scraping/proxy costs exceed subscription revenue per user
- Database storage grows unboundedly (every user x every competitor x every data point x every day)
- Supabase egress costs spike when dashboards query historical data for all tracked competitors
- Forced to retroactively add limits, angering existing users

**Prevention:**
- Model the per-user cost ceiling BEFORE launch: `(max_competitors * refreshes_per_day * cost_per_request) + storage + egress = cost_per_user_per_month`
- Implement soft limits disguised as UX: "Track up to 20 competitors" (generous enough to feel unlimited, bounded enough to model costs). Even if "unlimited" in marketing, enforce a technical cap (e.g., 50) that no reasonable user would hit
- Deduplicate scraping: if User A and User B both track @charlidamelio, scrape once and serve both. Maintain a global competitor registry with reference counting
- Tier refresh frequency: Pro users get daily refreshes, free users get weekly. This is the strongest cost lever
- Set up cost monitoring alerts at 50%, 75%, 100% of budget threshold per month

**Detection:**
- Scraping costs growing faster than user revenue
- Database storage growth rate exceeding projections
- Individual users tracking 50+ competitors
- Supabase egress approaching plan limits

**Phase:** Architecture/schema design (early) -- the deduplication and cost model must be baked into the data layer from day one.
**Confidence:** HIGH (basic cost arithmetic, confirmed pricing from Apify, ScrapFly, proxy providers)

**Sources:**
- [Apify TikTok Scraper pricing](https://apify.com/scraptik/tiktok-api)
- [Supabase Pricing](https://supabase.com/pricing)
- [Proxy pricing comparison](https://blog.proxygraphy.com/tiktok-data-scraping-solutions/)

---

### Pitfall 3: RLS Performance Cliff with Time-Series Competitor Data

**What goes wrong:** Supabase RLS policies that work fine with hundreds of rows become catastrophically slow with time-series competitor data. A table with 100K+ rows of daily snapshots (competitors x metrics x days) will cause RLS to evaluate the policy function per row, turning 10ms queries into 10+ second queries. The existing codebase uses `auth.uid()` in Supabase calls -- if RLS policies call `auth.uid()` without the `(select auth.uid())` optimization, every query scans all rows.

**Why it happens:** RLS policies are invisible query filters. Developers test with small datasets during development and never notice the O(n) behavior. PostgreSQL's query planner cannot optimize function calls inside RLS unless explicitly wrapped in subquery selects. Additionally, `LIMIT/OFFSET` queries still evaluate RLS on all rows before limiting, so pagination does not save you.

**Consequences:**
- Dashboard load times of 5-30+ seconds as data grows
- Supabase compute usage spikes (higher billing tier needed)
- Database connection timeouts during peak usage
- Users perceive the entire app as slow, not just competitor features

**Prevention:**
- Always wrap RLS function calls in `(select ...)`: `(select auth.uid()) = user_id` instead of `auth.uid() = user_id`. This triggers PostgreSQL `initPlan` caching -- documented improvement from 11,000ms to 10ms
- Create indexes on EVERY column referenced in RLS policies: `CREATE INDEX idx_competitor_snapshots_user ON competitor_snapshots(user_id)`
- Use the TO clause in RLS policies to skip evaluation for service role: `CREATE POLICY ... TO authenticated`
- Reverse join logic: `team_id IN (SELECT team_id FROM team_members WHERE user_id = (select auth.uid()))` instead of `auth.uid() IN (SELECT user_id FROM team_members WHERE ...)`
- Design the schema so competitors are linked through a junction table (`user_competitors`) rather than embedding user_id in every snapshot row. Snapshots belong to a global competitor record; RLS filters at the junction table level
- Load test with 100K+ rows BEFORE shipping any competitor feature to production

**Detection:**
- Query execution times in Supabase dashboard exceeding 500ms
- `EXPLAIN ANALYZE` showing sequential scans on competitor tables
- Dashboard API responses exceeding 2 seconds
- Supabase "slow query" warnings in logs

**Phase:** Schema design (early) AND every subsequent phase that adds queries.
**Confidence:** HIGH (Supabase official documentation with exact optimization patterns and benchmarks)

**Sources:**
- [RLS Performance Best Practices - Supabase Docs](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [RLS Performance Discussion #14576](https://github.com/orgs/supabase/discussions/14576)
- [Optimizing RLS Performance - AntStack](https://www.antstack.com/blog/optimizing-rls-performance-with-supabase/)

---

### Pitfall 4: Vercel Hobby Plan Cron Limitation Kills Data Freshness

**What goes wrong:** Vercel Hobby plan limits cron jobs to **once per day** with **hourly precision** (a job set for 1am may run anytime between 1:00-1:59am). Expressions for hourly or more frequent execution fail deployment. Competitor tracking needs at minimum daily refreshes, but the imprecise timing and lack of sub-daily frequency makes it unreliable for any serious data pipeline.

**Why it happens:** Teams develop on the Hobby plan and design the cron-based data pipeline around its constraints. When they realize daily-only is insufficient (users want fresher data, or the single daily window is too narrow to scrape all competitors), they face an architecture rewrite or forced plan upgrade.

**Consequences:**
- Competitors' data refreshes only once per day at best, with imprecise timing
- Cannot batch scraping across multiple time windows (everything must happen in one daily burst)
- If the daily job fails or times out, data is stale for 24+ hours with no retry mechanism
- Upgrading to Pro ($20/month) just for cron frequency feels like an expensive fix for a planning mistake

**Prevention:**
- **Plan for Pro from day one** if competitor tracking is a core feature. The $20/month is negligible compared to scraping costs
- Alternatively, use an external cron service (cron-job.org, EasyCron, or Upstash QStash) to trigger Vercel API endpoints at desired frequency -- this works on any Vercel plan
- Design scraping jobs to be idempotent and resumable: if a job times out at 300s (Hobby max), the next invocation picks up where it left off
- Implement a queue-based architecture: cron triggers a "start batch" endpoint, which enqueues individual scrape tasks to process incrementally rather than all-at-once

**Also note:** Vercel Functions have a 300s (5 min) max duration on Hobby, 800s (13 min) on Pro. If scraping 1,000 competitors sequentially, even 800s is tight. The function must fan out work, not process serially.

**Detection:**
- Deployment fails with "Hobby accounts are limited to daily cron jobs"
- Data freshness metrics showing 24h+ staleness consistently
- Scraping jobs timing out before completing all targets
- Users complaining about stale competitor data

**Phase:** Infrastructure setup (early) -- cron strategy must be decided before building the data pipeline.
**Confidence:** HIGH (Vercel official documentation, exact plan limits confirmed)

**Sources:**
- [Vercel Cron Jobs Usage & Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Vercel Functions Limitations](https://vercel.com/docs/functions/limitations)
- [Vercel Limits](https://vercel.com/docs/limits)

---

### Pitfall 5: Next.js Middleware Auth Bypass (CVE-2025-29927)

**What goes wrong:** The existing codebase relies on Next.js middleware (`src/middleware.ts` -> `updateSession`) as the primary auth enforcement layer. CVE-2025-29927 demonstrated that Next.js middleware authorization can be bypassed via a crafted `x-middleware-subrequest` header. The current codebase is on Next.js 16.1.5 which is patched, BUT the architectural pattern of relying solely on middleware for auth remains a risk if future vulnerabilities emerge.

**Why it happens:** Middleware feels like the right place for auth -- it runs before every request. But Vercel now explicitly recommends that middleware should NOT be the sole security boundary. The existing `AuthGuard` client component (`src/components/app/auth-guard.tsx`) is a UI safety net, not a true security layer -- it uses `getSession()` (client-side, from cookies) rather than `getUser()` (server-validated).

**Consequences:**
- New competitor tracking API routes (scraping triggers, data endpoints) inherit the middleware-only auth pattern
- If middleware is bypassed, competitor data for ALL users is exposed
- Service-role API routes (like the existing `/api/cron/sync-whop`) must carefully verify authorization headers -- any new cron/data endpoints need the same rigor

**Prevention:**
- Add server-side auth validation in EVERY API route and server component that accesses competitor data -- do not rely on middleware alone
- Use `supabase.auth.getUser()` (server-validated) not `getSession()` (cookie-based) for security-critical operations
- Add the `/competitors` prefix to `PROTECTED_PREFIXES` in `src/lib/supabase/middleware.ts`
- For new API routes handling competitor data, validate both the session AND that the requesting user owns/tracks the requested competitor
- Consider adding rate limiting at the API route level for competitor data endpoints

**Detection:**
- New API routes that don't call `getUser()` directly
- Competitor data endpoints accessible without auth headers
- Missing ownership checks (user A can view user B's tracked competitors)

**Phase:** Every phase that adds API routes or server actions for competitor data.
**Confidence:** HIGH (CVE documented, current codebase inspected, Vercel's official post-CVE guidance confirmed)

**Sources:**
- [CVE-2025-29927 Advisory](https://github.com/vercel/next.js/security/advisories/GHSA-f82v-jwr5-mffw)
- [Next.js Middleware Authorization Bypass - ProjectDiscovery](https://projectdiscovery.io/blog/nextjs-middleware-authorization-bypass)

---

## Moderate Pitfalls

Mistakes that cause significant rework or degraded user experience.

---

### Pitfall 6: Zustand Store Hydration Conflicts with Competitor State

**What goes wrong:** The existing codebase uses 6 Zustand stores, with mixed persistence approaches: `sidebar-store` uses Zustand's `persist` middleware, while `tooltip-store` and `test-store` use custom `_hydrate()` patterns with manual localStorage reads. Adding a competitor tracking store (tracked competitors, filters, selected competitor) introduces a 7th store that must coordinate with existing state without causing hydration mismatches.

**Why it happens:** Zustand with `persist` middleware in Next.js App Router causes hydration errors because the server renders with initial state while the client restores from localStorage. The existing stores already work around this (sidebar uses persist, others use manual hydration), but each new store is another potential hydration mismatch. Zustand's official Next.js guidance recommends `createStore` + Context API instead of global `create()` for server-rendered apps -- the existing codebase does NOT follow this pattern.

**Prevention:**
- Follow the EXISTING hydration pattern (manual `_hydrate()` in useEffect) for new competitor stores, since refactoring all stores to the Context pattern mid-project is too risky
- Keep competitor state that comes from the server (fetched data) in server components or React Query/SWR cache -- NOT in Zustand. Only put client-only UI state in Zustand (selected competitor, filter state, expanded/collapsed panels)
- Test every new store with full page reload to catch hydration mismatches
- Do NOT use `persist` middleware for any store containing server-fetched data

**Detection:**
- Hydration mismatch warnings in browser console
- "Text content does not match server-rendered HTML" errors
- Competitor sidebar/filters resetting on navigation
- State flashing on page load

**Phase:** UI implementation phase.
**Confidence:** MEDIUM (based on codebase analysis + Zustand official Next.js docs)

**Sources:**
- [Zustand Next.js Setup Guide](https://zustand.docs.pmnd.rs/guides/nextjs)
- [Zustand Discussion #2326 - Next.js hydration](https://github.com/pmndrs/zustand/discussions/2326)

---

### Pitfall 7: TimescaleDB Deprecation on Supabase Postgres 17

**What goes wrong:** The natural choice for time-series competitor data (daily follower counts, engagement rates, view histories) is TimescaleDB's hypertables. However, TimescaleDB is **deprecated on Supabase Postgres 17** and will be supported on Postgres 15 only until approximately **May 2026**. Building on TimescaleDB means building on a sunset technology that requires migration within months.

**Why it happens:** Teams Google "Supabase time-series data" and find TimescaleDB documentation on Supabase's own site. The deprecation notice is buried, and the extension still works on PG15, creating a false sense of safety.

**Prevention:**
- Use native PostgreSQL partitioning (range partitioning by month) instead of TimescaleDB hypertables
- Use PostgreSQL's built-in `date_bin()` function instead of TimescaleDB's `time_bucket()` for time-series aggregation
- Design partition strategy upfront but do NOT implement partitioning until the table exceeds ~1M rows -- premature partitioning adds complexity without benefit
- Schema design: `competitor_snapshots(id, competitor_id, metric_date, followers, likes, views, engagement_rate, ...)` with a simple date column for future partitioning

**Detection:**
- Using `CREATE EXTENSION timescaledb` or `SELECT create_hypertable(...)` in migrations
- Supabase project running Postgres 15 with no upgrade path planned
- Time-series queries using `time_bucket()` function

**Phase:** Schema design (early).
**Confidence:** HIGH (Supabase official docs confirm TimescaleDB deprecation on PG17)

**Sources:**
- [TimescaleDB on Supabase](https://supabase.com/docs/guides/database/extensions/timescaledb)
- [Supabase Postgres 17 Discussion #35851](https://github.com/orgs/supabase/discussions/35851)
- [Supabase Table Partitioning](https://supabase.com/docs/guides/database/partitions)

---

### Pitfall 8: Dashboard Data Overload Kills Usability

**What goes wrong:** Competitor tracking generates a LOT of data: follower counts, engagement rates, posting frequency, top videos, growth trends, comparative rankings. The instinct is to show everything. The result is a cluttered dashboard where users cannot find actionable insights, making the feature feel "interesting but useless."

**Why it happens:** Developer-driven feature design optimizes for "what data do we have?" rather than "what decision does the user need to make?" Competitive analysis tools commonly fall into the "data dump" anti-pattern -- showing raw numbers without context, priorities, or recommended actions.

**Prevention:**
- Design around decisions, not data: "Which competitors are growing fastest?" (one ranking view) is better than "Here are 15 metrics for each competitor" (data dump)
- Use progressive disclosure: overview cards with key metrics -> drill-down for details -> raw data export for power users
- Implement "insight highlights" rather than raw metrics: "Competitor X gained 50K followers this week (3x their average)" is more valuable than "Follower count: 1.2M"
- Maximum 4-6 cards/metrics visible without scrolling on the competitor overview
- Show data freshness prominently: "Updated 2 hours ago" on every data card. Stale data without context destroys trust
- Add sparklines (small trend lines) instead of raw numbers -- users care about direction more than absolute values

**Detection:**
- Users spending less than 30 seconds on competitor dashboard (bounce)
- Feature requests for "simpler view" or "what should I focus on"
- Support tickets asking "what does this number mean?"
- Low engagement with competitor features despite high adoption

**Phase:** UI design and implementation phase.
**Confidence:** MEDIUM (UX best practices, dashboard design literature)

**Sources:**
- [Dashboard Design UX Patterns - Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards)
- [UX Strategies for Real-Time Dashboards - Smashing Magazine](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/)
- [Dashboard Design Principles - UXPin](https://www.uxpin.com/studio/blog/dashboard-design-principles/)

---

### Pitfall 9: Serverless Function Timeout During Bulk Scraping

**What goes wrong:** A cron job that scrapes all tracked competitors sequentially will timeout. With 1,000 tracked competitors at ~1-2 seconds per scrape (including proxy latency), that is 1,000-2,000 seconds of work. Vercel Functions max out at 300s (Hobby) or 800s (Pro). Even 100 competitors would consume 100-200s, leaving no margin for retries or slow responses.

**Why it happens:** Developers build "scrape all competitors" as a single function because it is the simplest architecture. Serverless environments are designed for short-lived request-response cycles, not batch processing.

**Consequences:**
- Function times out mid-scrape, leaving partial data (some competitors updated, others stale)
- No retry mechanism for failed scrapes
- Inconsistent data state across competitors
- 504 errors in monitoring without clear root cause

**Prevention:**
- Fan-out architecture: cron triggers a "coordinator" function that reads the list of competitors due for refresh, then enqueues individual scrape tasks. Each task scrapes ONE competitor
- Use Vercel's serverless concurrency (auto-scales to 30K on Hobby/Pro) by making parallel HTTP calls to individual scrape endpoints
- Alternatively, use a queue service (Upstash QStash, Inngest, or Trigger.dev) for reliable background job processing with retries and dead letter queues
- Implement per-competitor `last_scraped_at` and `next_scrape_at` timestamps. The coordinator only enqueues competitors that are due, naturally spreading load across time windows
- Set `maxDuration` in the cron route: `export const maxDuration = 300;` (or 800 on Pro)

**Detection:**
- 504 `FUNCTION_INVOCATION_TIMEOUT` errors in Vercel dashboard
- Partial data updates (some competitors fresh, others stale from the same batch)
- Cron job completion time growing linearly with user base

**Phase:** Data pipeline implementation.
**Confidence:** HIGH (Vercel official docs, existing cron pattern in codebase confirms sequential processing risk)

**Sources:**
- [Vercel Functions Limitations](https://vercel.com/docs/functions/limitations)
- [How to Solve Next.js Timeouts - Inngest](https://www.inngest.com/blog/how-to-solve-nextjs-timeouts)
- [Upstash Vercel Cost & Workflow](https://upstash.com/blog/vercel-cost-workflow)

---

### Pitfall 10: Supabase 4.5MB Request/Response Body Limit

**What goes wrong:** Vercel Functions have a **4.5 MB** max payload for request or response bodies. When querying historical competitor data (e.g., 365 days of metrics for 20 competitors with multiple data points), the response can exceed this limit, returning a `413 FUNCTION_PAYLOAD_TOO_LARGE` error.

**Why it happens:** Initial queries are small (few competitors, few days of data). As data accumulates and users track more competitors, response sizes grow silently until they hit the hard wall.

**Prevention:**
- Implement server-side pagination for ALL competitor data queries -- never return unbounded result sets
- Use date range parameters on every historical data endpoint (default to 30 days, max 90 days per request)
- Aggregate data server-side: return daily/weekly rollups instead of raw data points
- For chart data, downsample: 365 data points -> 52 weekly averages for year views
- Monitor response sizes in development with `Content-Length` logging

**Detection:**
- 413 errors in Vercel function logs
- API responses approaching 3MB+ (early warning)
- Dashboard charts breaking for users with many competitors and long history

**Phase:** API design and data endpoint implementation.
**Confidence:** HIGH (Vercel official documentation, exact limit confirmed)

---

## Minor Pitfalls

Issues that cause friction or technical debt but are recoverable.

---

### Pitfall 11: Middleware Route Matcher Not Covering New Routes

**What goes wrong:** The existing middleware matcher in `src/middleware.ts` catches all routes except static assets. But `PROTECTED_PREFIXES` in `src/lib/supabase/middleware.ts` is a hardcoded list: `["/dashboard", "/brand-deals", "/settings", "/welcome", "/referrals"]`. If competitor tracking pages live at `/competitors` or `/tracking`, they will NOT be auth-protected unless explicitly added to this list.

**Prevention:**
- Add all new competitor route prefixes to `PROTECTED_PREFIXES` immediately when creating new pages
- Consider refactoring to a deny-list approach: protect everything under `/(app)/` by default, only whitelist public paths
- Add an integration test that verifies unauthenticated requests to competitor routes get redirected to `/login`

**Detection:**
- Competitor pages accessible without login
- No redirect to `/login` when visiting `/competitors` while logged out

**Phase:** First phase that adds competitor pages.
**Confidence:** HIGH (direct codebase inspection)

---

### Pitfall 12: TikTok Research API Is NOT Available for Commercial Use

**What goes wrong:** Teams discover TikTok's Research API and assume it is a legitimate data source for their SaaS product. The Research API is restricted to **academic researchers from non-profit universities in the US and Europe** with approved research plans. Commercial SaaS products do not qualify. Additionally, 1-in-8 videos are inaccessible, and data must be refreshed every 15 days.

**Prevention:**
- Do NOT plan for TikTok Research API access. It is not available for commercial products
- Plan for unofficial data acquisition from day one (third-party scraping services)
- Have a legal review of ToS compliance for any data acquisition method
- Document the data acquisition method and its legal basis

**Detection:**
- Team members suggesting "we can use the TikTok API" without checking eligibility
- Architecture documents referencing official API endpoints

**Phase:** Research/planning phase (now).
**Confidence:** HIGH (TikTok official developer documentation)

**Sources:**
- [TikTok Research API](https://developers.tiktok.com/products/research-api/)
- [TikTok Research API Problems - AI Forensics](https://aiforensics.org/work/tk-api)

---

### Pitfall 13: Client-Side Supabase Queries for Competitor Data

**What goes wrong:** The existing codebase fetches data client-side in `useEffect` hooks (e.g., sidebar fetches `creator_profiles` via client-side Supabase). Replicating this pattern for competitor data means: (1) exposing query patterns to the browser, (2) relying on RLS for security (see Pitfall 3), (3) waterfall loading (page renders -> client fetches -> loading spinner -> data appears).

**Prevention:**
- Use server components and server-side data fetching for ALL competitor data. The page server component fetches data before render, eliminating loading waterfalls
- Reserve client-side Supabase calls for real-time subscriptions only (if implementing live competitor updates)
- For interactive filters (date range, competitor selection), use server actions or API routes instead of direct client-side Supabase queries
- This is a departure from some existing patterns in the codebase -- accept the inconsistency rather than propagating the client-side anti-pattern

**Detection:**
- `createClient()` calls in competitor feature components
- Loading spinners on competitor data that could be server-rendered
- RLS policy evaluations in Supabase logs from browser-origin requests

**Phase:** All UI implementation phases.
**Confidence:** MEDIUM (Next.js 15/16 App Router best practices, Supabase SSR docs)

---

### Pitfall 14: Database Schema Coupling User Identity to Every Data Row

**What goes wrong:** Naive schema design puts `user_id` on every table: `competitor_snapshots(user_id, competitor_handle, date, followers, ...)`. This means if 100 users track the same competitor, the same data is stored 100 times. Storage costs multiply, scraping is duplicated, and queries become slower.

**Prevention:**
- Three-table design:
  - `competitors` (id, tiktok_handle, display_name, avatar_url) -- global registry, one row per TikTok account
  - `user_tracked_competitors` (user_id, competitor_id, added_at, notify_on_change) -- junction table, RLS here
  - `competitor_snapshots` (competitor_id, snapshot_date, followers, likes, views, ...) -- global data, no user_id
- RLS policy on `competitor_snapshots` joins through `user_tracked_competitors`: "user can see snapshots for competitors they track"
- Scraping targets `competitors` table, not user-specific entries
- This is the single most impactful schema decision for the entire feature

**Detection:**
- `user_id` column on snapshot/metrics tables
- Duplicate rows in snapshot table for the same competitor on the same date
- Storage growing proportionally to (users * competitors) instead of just (unique competitors)

**Phase:** Schema design (before any implementation).
**Confidence:** HIGH (standard normalized database design, directly applicable)

---

### Pitfall 15: Stale Data Without Visual Indicators Destroys Trust

**What goes wrong:** Competitor data is inherently stale -- it is a snapshot from the last scrape. If the UI shows "1.2M followers" without indicating when that number was captured, users assume it is real-time. When they check TikTok directly and see a different number, they lose trust in the entire platform.

**Prevention:**
- Display `last_updated` timestamp on every data point: "1.2M followers (updated 3h ago)"
- Color-code freshness: green (<6h), yellow (6-24h), red (>24h)
- When data is stale (>24h), add a banner: "We're updating this competitor's data. Last successful update: [date]"
- Show "Data may be delayed" in the feature's onboarding/first-use experience
- NEVER show data without a freshness indicator -- make this a component-level design rule

**Detection:**
- Metric cards without timestamps
- User complaints about "wrong numbers"
- Support tickets comparing Virtuna data to TikTok

**Phase:** UI implementation (every data display component).
**Confidence:** HIGH (standard practice for any analytics/monitoring product)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Schema design | #14 (coupling user_id to snapshots), #3 (RLS performance), #7 (TimescaleDB deprecation) | Three-table normalized design, RLS with `(select auth.uid())` pattern, native PG partitioning |
| Data pipeline / scraping | #1 (anti-bot arms race), #9 (serverless timeout), #4 (Hobby cron limits), #12 (Research API unavailable) | Provider abstraction, fan-out architecture, Pro plan or external cron, third-party scraping service |
| Cost management | #2 (unbounded costs) | Per-user cost model, competitor deduplication, tiered refresh frequency |
| Auth / security | #5 (middleware bypass), #11 (route matcher gaps) | Server-side auth in every route, add prefixes to protected list |
| UI implementation | #8 (data overload), #15 (stale data trust), #6 (Zustand hydration) | Progressive disclosure, freshness indicators, manual hydration pattern |
| API endpoints | #10 (payload limits), #13 (client-side queries) | Pagination + date ranges, server-side data fetching |

---

## Sources

### Official Documentation (HIGH confidence)
- [Supabase RLS Performance](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Supabase Table Partitioning](https://supabase.com/docs/guides/database/partitions)
- [Supabase TimescaleDB Extension](https://supabase.com/docs/guides/database/extensions/timescaledb)
- [Supabase Pricing](https://supabase.com/pricing)
- [Vercel Functions Limitations](https://vercel.com/docs/functions/limitations)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [TikTok Research API](https://developers.tiktok.com/products/research-api/)
- [TikTok Anti-Scraping](https://www.tiktok.com/privacy/blog/how-we-combat-scraping/en)
- [CVE-2025-29927 Advisory](https://github.com/vercel/next.js/security/advisories/GHSA-f82v-jwr5-mffw)
- [Zustand Next.js Guide](https://zustand.docs.pmnd.rs/guides/nextjs)

### Verified Technical Sources (MEDIUM confidence)
- [ScrapFly TikTok Scraping Guide 2026](https://scrapfly.io/blog/posts/how-to-scrape-tiktok-python-json)
- [Inngest - Solving Next.js Timeouts](https://www.inngest.com/blog/how-to-solve-nextjs-timeouts)
- [Smashing Magazine - Real-Time Dashboard UX](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/)
- [AntStack - RLS Optimization](https://www.antstack.com/blog/optimizing-rls-performance-with-supabase/)

### Codebase Analysis (HIGH confidence)
- `src/middleware.ts` -- route matcher configuration
- `src/lib/supabase/middleware.ts` -- PROTECTED_PREFIXES list, auth flow
- `src/stores/*.ts` -- 6 existing Zustand stores with mixed persistence patterns
- `src/components/app/auth-guard.tsx` -- client-side auth safety net using getSession()
- `src/app/api/cron/sync-whop/route.ts` -- existing cron pattern (sequential processing)
- `package.json` -- Next.js 16.1.5, Zustand 5.0.10, Supabase SSR 0.8.0
