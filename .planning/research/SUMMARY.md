# Research Summary: Virtuna Competitors Tool

**Domain:** TikTok Competitor Intelligence Tracker (new feature milestone)
**Researched:** 2026-02-16
**Overall confidence:** HIGH

## Executive Summary

The competitor tracking milestone requires surprisingly few stack additions. The backend-foundation worktree (shipped 2026-02-13) already provides the core scraping infrastructure: `apify-client` ^2.22.0, webhook handler pattern, cron route pattern, service client utility, and Vercel cron configuration. This milestone extends that foundation with new Apify actor targets (profile scraper + video scraper instead of trending scraper), new database tables for competitor-specific time-series data, and new UI components built with the existing design system and Recharts.

The primary technical challenge is not "what to build" but "how to avoid over-engineering." The temptation to add TimescaleDB (deprecated on Supabase PG17), external search services (overkill for <10K records), dedicated background job frameworks (Inngest/Trigger.dev solve problems already solved by Vercel Cron + Apify webhooks), and additional charting libraries (Recharts 3 already covers multi-series comparison charts) must be resisted. Zero new npm packages are needed if backend-foundation is merged first; at most two packages (`apify-client`, `@tanstack/react-query`) if it has not been merged.

The highest-risk area is TikTok scraping reliability. TikTok deploys aggressive anti-bot measures that can break scrapers overnight. Using Apify Clockworks actors (maintained by a specialized team with 125K+ users) mitigates this, but the architecture must abstract data acquisition behind a clean interface so the scraping provider can be swapped without rewriting the data layer. The second highest risk is unbounded scraping costs -- the architecture must deduplicate scraping across users (scrape each unique handle once, serve to all users who track it) and implement sensible caps.

The competitive landscape reveals a clear gap: every existing TikTok analytics tool (Pentos, Exolyt, Socialinsider, Analisa.io, Favikon) targets brands and agencies at $50-100+/month. No tool is built from the ground up for individual creators asking "how do I compare to creators in my niche?" Virtuna fills this gap by integrating competitor tracking into a creator-first intelligence platform.

## Key Findings

**Stack:** Zero new npm dependencies needed. Extends existing Apify + Supabase + Recharts + Zustand stack with new actors, tables, routes, and components.

**Architecture:** Webhook-driven async scraping (proven pattern from backend-foundation), shared competitor profiles with per-user tracking join table, append-only snapshots for time-series, server components for initial load with client components for charts and interactivity.

**Critical pitfall:** TikTok anti-bot arms race can break scraping overnight. Abstract data acquisition behind a provider interface. Never build a custom scraper.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Database + Scraping Foundation** - Schema migration, Apify scraping service layer, Zod validation schemas, service client extraction
   - Addresses: competitor_profiles, competitor_snapshots, competitor_videos tables; Apify profile + video scraper integration
   - Avoids: TimescaleDB deprecation (Pitfall #7), schema coupling user_id to snapshots (Pitfall #14), RLS performance cliff (Pitfall #3)

2. **API Routes + Server Actions** - Add/remove competitor actions, search API, single-competitor refresh, cron batch refresh route, vercel.json config
   - Addresses: Data pipeline wiring, cron scheduling, webhook handler for competitor data
   - Avoids: Serverless timeout during bulk scraping (Pitfall #9), middleware auth bypass (Pitfall #5), Hobby plan cron limitation (Pitfall #4)

3. **Core UI - Competitor Dashboard** - Page route, sidebar nav, competitor cards grid, table/leaderboard view, empty state, stats bar, Zustand store for UI state
   - Addresses: Table stakes features (add, view, remove competitors), grid and table views, loading/skeleton states
   - Avoids: Dashboard data overload (Pitfall #8), Zustand hydration conflicts (Pitfall #6), client-side Supabase queries (Pitfall #13)

4. **Detail Views + Charts** - Competitor detail panel, Recharts growth charts (LineChart, AreaChart), recent videos grid, engagement breakdown
   - Addresses: Follower growth visualization, per-video engagement, content analysis, posting frequency
   - Avoids: Payload size limits (Pitfall #10), loading all snapshots on page load

5. **Benchmarking + Comparison** - Side-by-side comparison view, own stats vs competitor, multi-competitor growth overlay chart, leaderboard sorting
   - Addresses: Differentiator features (benchmark panel, RadarChart comparison, delta indicators)

6. **Polish + Edge Cases** - Stale data indicators, error states, scrape failure handling, rate limiting, mobile responsive layout, search/discovery flow
   - Addresses: Data freshness trust (Pitfall #15), error recovery, mobile UX
   - Avoids: Stale data without visual indicators (Pitfall #15)

**Phase ordering rationale:**
- Phase 1 (schema) has zero dependencies and unblocks everything else
- Phase 2 (API routes) depends on Phase 1's tables and scraping layer
- Phase 3 (UI) depends on Phase 2's server actions for add/remove
- Phase 4 (charts) depends on Phase 1's snapshot data and Phase 3's UI shell
- Phase 5 (comparison) depends on Phase 3's core UI + Phase 4's chart components
- Phase 6 (polish) spans all previous phases and can start after Phase 3

**Research flags for phases:**
- Phase 1: Standard patterns (PostgreSQL, Zod, Supabase migrations). Unlikely to need additional research.
- Phase 2: Apify actor input/output schemas need verification at implementation time. Clockworks actors may change field names. Flag for quick validation before coding.
- Phase 3: Standard Next.js + design system work. No additional research needed.
- Phase 4: Recharts multi-series LineChart is documented. May need minor research on custom tooltip/legend styling to match Raycast theme.
- Phase 5: RadarChart component in Recharts may need research for proper comparison visualization.
- Phase 6: Mobile responsive patterns already established in codebase. No research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies. All libraries verified in existing package.json. Apify pricing confirmed via official listings. |
| Features | HIGH | Feature landscape mapped against 8+ competitor tools. Table stakes, differentiators, and anti-features clearly delineated. |
| Architecture | HIGH | Extends proven patterns from backend-foundation. Webhook-driven scraping, append-only snapshots, shared profiles. |
| Pitfalls | HIGH | 15 pitfalls catalogued with official sources. Critical ones (TikTok anti-bot, unbounded costs, RLS performance, TimescaleDB deprecation) have concrete prevention strategies. |
| Apify data schemas | MEDIUM | Profile/video field names from Apify docs and WebSearch, not Context7. Schemas may change. Zod validation at ingest is mandatory. |
| Competitive landscape | MEDIUM | Based on WebSearch of competitor tools. Pricing and feature sets may have changed. |

## Gaps to Address

- **Apify actor input/output schemas**: Need runtime verification at implementation time. The Clockworks actors may change output field names or add/remove fields without notice.
- **Vercel plan confirmation**: The cron strategy assumes Pro plan (sub-daily cron). If still on Hobby, daily-only cron changes the refresh strategy.
- **Cost modeling**: Per-user scraping cost needs validation with actual Apify usage after launch. Estimated $0.005/profile/scrape, but real costs depend on proxy usage and retry rates.
- **Legal/ToS compliance**: Scraping TikTok data via third-party services (Apify) operates in a legal gray area. Not researched here -- needs separate review.
- **Backend-foundation merge timing**: If backend-foundation has not been merged into main before this milestone starts, the `apify-client` and `@tanstack/react-query` packages need to be added manually to this worktree.
