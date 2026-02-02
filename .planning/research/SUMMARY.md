# Project Research Summary

**Project:** Virtuna v1.5 - Trending Page
**Domain:** TikTok viral content discovery with AI-powered remix/storyboard generation
**Researched:** 2026-02-02
**Confidence:** HIGH

## Executive Summary

The Trending Page transforms Virtuna from a single-feature viral predictor into a complete content discovery and planning platform. Research shows this bridges a genuine gap: TikTok's Creative Center provides trend discovery but no actionable output, while existing storyboard tools (Boords, Katalist) are generic film production tools, not short-form social content optimizers. The remix-to-storyboard workflow is genuinely novel.

**Recommended approach:** Build on existing Virtuna architecture (Next.js 16, Supabase, Zustand, Tailwind) with four strategic additions: Apify for TikTok scraping, OpenAI for AI classification and remix generation, TanStack Query for server state management, and React-PDF for storyboard export. Use v0 MCP to accelerate development of complex UI components (video cards, storyboard layouts, remix forms), allowing focus on business logic and API integration. Phase implementation to validate core value (feed + basic remix) before investing in advanced features (PDF export, teleprompter).

**Critical risks:** (1) TikTok Terms of Service violations - scraping is explicitly prohibited and enforcement has intensified under post-2026 U.S. ownership; (2) AI tagging inaccuracy destroying feed quality - 30-40% error rate without validation; (3) LLM hallucination in remix scripts producing bad filming advice; (4) PDF generation memory exhaustion with large storyboards; (5) Data completeness issues from fragmented TikTok endpoints. Mitigate through conservative rate limiting, confidence thresholds on AI outputs, RAG grounding for remixes, streaming PDF generation, and graceful degradation for incomplete data.

## Key Findings

### Recommended Stack

The existing stack (Next.js 16, Supabase, Zustand, Tailwind) is sufficient for 90% of the Trending Page. Add **six packages** to enable new capabilities: Apify Client for TikTok scraping, OpenAI SDK for AI processing, TanStack Query for server state management, React-PDF for storyboard export, and Upstash Redis with rate limiting for API caching and protection.

**Core technologies:**
- **Apify Client (v2.22.0):** TikTok data ingestion via managed scrapers - 98% success rate, handles retries, avoids DIY Puppeteer complexity. No official TikTok API exists for trending content, making Apify the practical choice despite ToS concerns.
- **OpenAI SDK (v6.17.0):** AI classification and remix generation using GPT-4o - structured outputs (JSON mode) for video categorization, function calling for storyboard generation. Alternative: Anthropic Claude equally capable, choose based on existing keys/preferences.
- **TanStack Query (v5.x):** Server state management with DevTools, mutations, pagination - better than SWR for this use case due to DevTools visibility during feed development and sophisticated cache invalidation.
- **React-PDF (v4.3.2):** React 19-compatible PDF generation - declarative PDF creation using React components, server-side rendering support, no external dependencies. Superior to Puppeteer for structured documents (avoids memory issues).
- **Upstash Redis:** Edge-compatible caching and rate limiting - serverless Redis works on Vercel Edge, pay-per-request pricing, built-in rate limiting package protects AI endpoints.

**What NOT to add:** Direct TikTok API (doesn't exist), SWR (TanStack Query has better DevTools), multiple AI providers (pick one), DALL-E/image generation (consistency issues, defer to v2), Puppeteer for PDF (memory problems), socket.io (polling sufficient), separate Redis provider (Upstash is Vercel-optimized).

**Estimated costs:** $4.50/day for AI ($2.50 classification, $2.00 remix generation), plus Apify scraping costs (variable based on volume, ~$0.30/1K posts).

### Expected Features

Research reveals a clear divide between table stakes (users expect) and differentiators (competitive advantage). The infinite scroll feed with category filtering is mandatory based on user expectations from TikTok/Instagram/Pinterest. The remix-with-storyboard feature is the core innovation - no competitor offers "see trend → get complete filming plan" in one workflow.

**Must have (table stakes):**
- **Infinite scroll feed** - Standard pattern for discovery; users expect seamless browsing without pagination. Must include virtualized lists for performance.
- **Category filtering** - Users need to narrow discovery to relevant content type (Challenges, Sounds, Formats). Fixed top tabs or horizontal chips.
- **Video preview/playback** - Users make decisions based on first 3 seconds; thumbnail alone insufficient. Autoplay on hover, muted by default.
- **Analyze action** - Reuse existing Viral Predictor; users expect feature consistency across Virtuna.
- **Basic video metadata** - Creator name, view count, date, category tag - essential context for decision-making.

**Should have (competitive):**
- **Remix action with full storyboard** - Transforms inspiration into actionable filming plan; the core differentiator vs TikTok Creative Center. Includes AI-generated script, shot list, filming steps, and CTA/hashtags.
- **AI-generated sub-tags** - Auto-categorization beyond fixed categories (hook type, emotional arc, format style) reveals hidden patterns.
- **PDF export** - Professional output for production planning; industry-standard format differentiates from casual tools.
- **Hook score display** - Shows WHY a video went viral (reuse Viral Predictor insights); educational value for creators.
- **Save/bookmark videos** - Build personal trend library; return to inspiration later. Saves matter more than likes in 2026 TikTok algorithm.
- **Trending velocity indicator** - Shows if trend is rising, peaking, or declining; helps creators avoid jumping on dying trends.

**Defer (v2+):**
- **Video editing tools** - Competes with CapCut (ByteDance's free tool); massive scope, already commoditized. Focus on pre-production guidance.
- **Social features** - Comments/likes on Virtuna recreate TikTok poorly; link to original platform for engagement.
- **Real-time alerts** - Push notification fatigue; trends last days not minutes. On-demand discovery is sufficient.
- **Scheduling/posting** - OAuth complexity, TikTok API restrictions, crowded space. Stay in inspiration/planning phase only.
- **AI video generation** - Different product category; high cost; LTX/Katalist already do this. Focus on storyboard/script; users film themselves for authenticity.

### Architecture Approach

The Trending Page integrates as a parallel feature domain under the existing `(app)/` route group. It follows established Virtuna patterns (Server Component + Client Component split, Zustand for client state, component composition) but introduces new concerns: API routes for external data operations (Apify, AI), TanStack Query for server state, and background jobs for scheduled scraping.

**Major components:**
1. **Feed Infrastructure** - TrendingDashboard (3 category sections: Breaking Out, Sustained Viral, Resurging), VideoCard (thumbnail + metadata + actions), VideoGrid (infinite scroll with virtualization), VideoDetailModal (detail view with Analyze/Remix actions).
2. **Remix System** - RemixForm (multi-step: goal selection → niche/tweaks → generate), RemixOutput (3 variant cards in grid), RemixCard (expandable with hook/shot list/script), TeleprompterView (full-screen script mode), PDFExportButton (download storyboard).
3. **Data Pipeline** - API routes (`/api/trending`, `/api/analyze`, `/api/remix`) handle external service calls, Vercel cron job triggers Apify scrapes every 6h, Upstash Redis caches hot data (5 min TTL for feed), Supabase stores videos/remixes/baselines.
4. **State Management** - Zustand stores for UI state only (selected video, modal open, filters), TanStack Query for server data (videos, remixes, analyze results), no server data in Zustand (avoids SSR hydration issues).

**v0 MCP candidates:** VideoCard, TrendingDashboard, CategorySection, VideoDetailModal, RemixForm, RemixOutput, RemixCard, TeleprompterView. These complex visual layouts benefit from AI-assisted design, saving 16-20 hours of UI development. Standard patterns (feed grid, filter chips, loading skeletons) build manually.

**Integration points:** Sidebar nav item added (TrendingUp icon), Analyze action reuses existing Viral Predictor components (ImpactScore, AttentionBreakdown, InsightsSection), TanStack Query provider wraps app, Supabase schema extended with trending_videos, creator_baselines, remixes tables.

### Critical Pitfalls

Research identified five critical risks that could cause rewrites or major issues. TikTok ToS violations are the highest legal risk, while AI accuracy issues are the highest product quality risk.

1. **TikTok Terms of Service Violations** - Scraping violates TikTok ToS; enforcement intensified under post-2026 U.S. ownership. Consequences: account bans, IP blocks, potential legal action. **Prevention:** Conservative rate limiting (min 10 posts per query), residential proxy rotation, monitor for CAPTCHA failures, consider TikTok Research API (4-week approval in EEA), build Instagram Reels fallback. Address in Phase 1 (Data Pipeline).

2. **Incomplete or Unreliable Scraped Data** - TikTok fragments metadata across endpoints; profile data excludes video details, videos exclude comments, historical data for baseline calculation may be incomplete. Programs break when TikTok changes structures. **Prevention:** Robust null handling, minimum data completeness requirements, separate scrapers for different data types, cache creator baselines, show data freshness indicators, graceful degradation (show videos without multiplier if baseline unavailable). Address in Phase 1 (Data Pipeline).

3. **AI Tagging Inaccuracy Destroying Feed Quality** - 30-40% inaccuracy rate without validation; videos mis-tagged with wrong niches or content types ruin discovery. Audio/video analysis "generally more limited" than text classification. **Prevention:** Multi-signal classification (caption + hashtags + audio + creator profile), confidence thresholds (only auto-tag above 85%), human-in-the-loop for strategic tags, user feedback mechanism ("Wrong category?" button), start with broader categories (6 types easier than 20), validate against creator-declared niche. Address in Phase 2 (AI Classification).

4. **LLM Hallucination in Remix Generation** - Generated scripts contain fabricated techniques, impossible equipment suggestions, inaccurate trend advice, or brand-inconsistent scripts. Air Canada-style failures where AI "makes up" policies. **Prevention:** RAG grounding (retrieve actual successful scripts before generating), constraint validation (parse user constraints, verify outputs respect them), template-based generation (proven structures, LLM fills details), equipment-aware prompting, human review for "tips", prominent regenerate option, confidence disclosure ("AI-generated, review before filming"). Address in Phase 3 (Remix Generation).

5. **PDF Generation Memory Exhaustion** - Puppeteer/Playwright consume 350-450MB per document; storyboards with multiple frames can exceed 500MB. Concurrent generation exhausts server memory. Chrome DevTools 256MB WebSocket limit causes "Page crashed!" errors. **Prevention:** Use streaming output for large documents, queue system (max workers = CPU cores - 1), page limits (cap at 10 frames), close tabs after use, consider React-PDF instead of Puppeteer (no browser overhead), compress images before embedding, or offload to Browserless.io. Address in Phase 4 (PDF Export).

## Implications for Roadmap

Based on research, suggested phase structure prioritizes proving core value (feed + basic remix) before investing in polish features (PDF, teleprompter). Legal/data risks must be addressed in Phase 1 before building features.

### Phase 1: Data Foundation & Feed Infrastructure
**Rationale:** Must establish legally defensible data sourcing and handle incomplete data gracefully before building user-facing features. Feed infrastructure is the core interaction pattern - get this right first.
**Delivers:** Working infinite scroll feed with mock data, database schema, API route structure, Zustand stores, type definitions.
**Addresses:**
- Table stakes: Infinite scroll feed, category filtering, video thumbnails
- Stack: Database schema, Zustand pattern, type definitions
- Pitfalls: TikTok ToS compliance strategy, incomplete data handling
**Avoids:** Building features before data pipeline is proven; committing to Puppeteer PDF before exploring React-PDF alternative.
**Needs research:** No (standard patterns: Next.js routes, Zustand stores, Supabase tables)

### Phase 2: Core Feed UI & Video Display
**Rationale:** Use v0 MCP to accelerate complex UI components (VideoCard, TrendingDashboard, CategorySection). Validate feed UX before investing in backend integration. Test AI classification approach with smaller scope (6 content types, not 20).
**Delivers:** VideoCard, TrendingDashboard with 3 category sections, VideoDetailModal, wire to mock data, filter chips.
**Uses:** v0 MCP for VideoCard, CategorySection, TrendingDashboard, VideoDetailModal. Tailwind for styling. Radix UI for modals/dropdowns.
**Implements:** Feed Infrastructure component (from Architecture research).
**Addresses:**
- Table stakes: Video preview, basic metadata display, loading states
- Differentiators: Category sections (Breaking Out, Sustained, Resurging)
- Pitfalls: Video embed CORS issues (use official TikTok embed code), quality filtering false positives (start permissive)
**Avoids:** Monolithic components (compose from smaller pieces); using v0 output verbatim (adapt to project conventions).
**Needs research:** No (UI patterns are well-documented; v0 handles layout complexity)

### Phase 3: Backend Integration & AI Classification
**Rationale:** Replace mock data with real Apify scrapes and Supabase storage. Implement AI classification with validation pipeline before it damages feed quality. Add TanStack Query for server state management.
**Delivers:** API routes (`/api/trending`, `/api/analyze`), Supabase tables populated, TanStack Query hooks, Apify integration, AI classification with confidence thresholds.
**Uses:** Apify Client (v2.22.0), OpenAI SDK (v6.17.0), TanStack Query (v5.x), Upstash Redis for caching.
**Implements:** Data Pipeline component (from Architecture research).
**Addresses:**
- Stack: Apify, OpenAI, TanStack Query, Upstash Redis
- Pitfalls: AI tagging accuracy (confidence thresholds, multi-signal classification), Apify cost escalation (caching, batch operations)
**Avoids:** Storing server data in Zustand (use TanStack Query); calling Apify directly from client (expose API keys); aggressive quality filters (start permissive, tighten gradually).
**Needs research:** Partial (Apify actor configuration, OpenAI prompt engineering for TikTok content)

### Phase 4: Analyze Integration & Remix MVP
**Rationale:** Reuse existing Viral Predictor for Analyze action (low effort, high value). Build text-only remix MVP to validate user interest before investing in visual storyboard frames or PDF export.
**Delivers:** Analyze action wired to Viral Predictor, RemixForm (goal + niche selection), `/api/remix` route with OpenAI generation, RemixOutput showing 3 text-based variants, save/bookmark functionality.
**Uses:** v0 MCP for RemixForm, RemixOutput, RemixCard. OpenAI GPT-4o for script generation. Existing Viral Predictor components (ImpactScore, AttentionBreakdown).
**Implements:** Remix System component (from Architecture research).
**Addresses:**
- Table stakes: Analyze action (reuse existing)
- Differentiators: Remix with storyboard (text-only MVP validates demand), hook score display, save/bookmark
- Pitfalls: LLM hallucination (RAG grounding, template-based generation, constraint validation)
**Avoids:** Coupling Analyze and Remix logic (keep independent); building full storyboard before validating script-only version.
**Needs research:** Yes (prompt engineering for high-quality remix briefs, RAG implementation)

### Phase 5: Storyboard Visuals & PDF Export
**Rationale:** Only invest in visual frames and PDF export after text-only remix proves user value. Use React-PDF (not Puppeteer) to avoid memory issues.
**Delivers:** Storyboard visual frames (text-first approach, optional AI-generated images), PDFExportButton, StoryboardPDF component, `/api/remix/[id]/pdf` route.
**Uses:** React-PDF (v4.3.2) for PDF generation. Optional: OpenAI GPT Image for visual frames (if character consistency improves).
**Implements:** Export functionality for Remix System.
**Addresses:**
- Differentiators: Visual storyboard frames, PDF export, filming step breakdown
- Pitfalls: PDF memory exhaustion (streaming output, queue limits), storyboard visual consistency (text-primary approach)
**Avoids:** Puppeteer PDF generation (memory problems); AI-generated images without character consistency; complex onboarding (start on feed immediately).
**Needs research:** Partial (React-PDF layout optimization, image compression for embedding)

### Phase 6: Advanced Features & Polish
**Rationale:** Teleprompter, trending velocity, and cron automation are nice-to-haves that enhance but don't define the core experience. Build only after core flow is validated.
**Delivers:** TeleprompterView, trending velocity indicator, Vercel cron job for automated scraping, remix status tracking (To Film/Filmed/Posted).
**Uses:** v0 MCP for TeleprompterView. Vercel Cron for scheduled jobs. Time-series data for velocity calculation.
**Addresses:**
- Differentiators: Trending velocity indicator, teleprompter mode
- Pitfalls: Teleprompter UX issues (adjustable scroll speed, keep-awake), category taxonomy rigidity (extensible schema)
**Avoids:** Auto-detect clipboard (privacy concerns; use opt-in); notification fatigue (pull, not push); scheduling/posting (scope creep).
**Needs research:** No (cron jobs are standard; teleprompter is primarily UX)

### Phase Ordering Rationale

- **Data first, UI second:** Establish legally defensible data sourcing and handle incomplete data gracefully (Phase 1) before building features that depend on reliable data.
- **v0 for acceleration:** Use v0 MCP in Phase 2 to rapidly prototype complex UI components, allowing focus on business logic in later phases.
- **Validate core value early:** Text-only remix (Phase 4) validates user demand before investing in visual storyboards and PDF export (Phase 5).
- **Defer polish features:** Teleprompter and trending velocity (Phase 6) enhance but don't define the core experience; build only after feed + remix are proven.
- **AI validation before scale:** Implement AI classification with confidence thresholds and human-in-the-loop (Phase 3) before it damages feed quality at scale.
- **React-PDF over Puppeteer:** Defer PDF export decision to Phase 5 after evaluating React-PDF as Puppeteer alternative (avoids Phase 1 commitment to memory-problematic approach).

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 3 (Backend Integration):** Apify actor configuration, rate limiting strategy, OpenAI prompt engineering for TikTok content classification accuracy.
- **Phase 4 (Remix MVP):** Prompt engineering for high-quality remix briefs, RAG implementation for grounding, template library for script structures.
- **Phase 5 (PDF Export):** React-PDF layout optimization, image compression for embedding, streaming output for large documents.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Data Foundation):** Standard Next.js routes, Zustand stores, Supabase schema design.
- **Phase 2 (Core Feed UI):** UI patterns are well-documented; v0 MCP handles layout complexity.
- **Phase 6 (Advanced Features):** Cron jobs are standard; teleprompter is primarily UX testing.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Package versions verified on GitHub (apify-client v2.22.0, openai v6.17.0, @react-pdf/renderer v4.3.2). TanStack Query and Upstash Redis are industry standards with extensive documentation. |
| Features | MEDIUM-HIGH | Table stakes verified via multiple 2026 sources (TikTok Creative Center, Instagram/Pinterest UX patterns, infinite scroll research). Differentiators based on competitive analysis (Boords, Katalist, StoryboardHero gaps). User behavior expectations from Buffer/OneStream TikTok research. |
| Architecture | HIGH | Existing codebase analysis confirms patterns. Next.js App Router, Zustand, TanStack Query integration patterns well-documented. v0 MCP workflow validated through official docs. |
| Pitfalls | HIGH | TikTok ToS violations confirmed via official TikTok documentation. AI tagging accuracy (30-40% error rate) from Kontent.ai/VideoTap industry research. LLM hallucination well-documented (EvidentlyAI, Voiceflow). PDF memory issues extensively documented (Puppeteer GitHub issues, Medium articles). |

**Overall confidence:** HIGH

### Gaps to Address

**TikTok Research API availability:** Research shows it exists in EEA with 4-week approval process, but unclear if available outside EEA in 2026. Need to verify during Phase 1 as potential legal alternative to scraping.

**Post-2026 TikTok ownership terms:** U.S. ownership introduced new terms that make enforcement more aggressive. Need legal review of latest policies during Phase 1 before committing to Apify-based approach.

**AI tagging accuracy benchmarks for TikTok content specifically:** Industry research shows 30-40% error rate for general content, but TikTok's unique styles (trends, audio-centric content) may differ. Phase 3 should include baseline accuracy testing before scaling classification.

**User preference for text vs visual storyboards:** Unknown if users want AI-generated visual frames or prefer text-only briefs. Phase 4 (text-only MVP) validates demand before Phase 5 investment in visuals.

**PDF export usage patterns:** Unknown if users will export PDFs frequently (professional creators) or rarely (casual creators). Phase 5 can defer if Phase 4 shows low export demand.

**Remix generation quality:** Prompt engineering for high-quality remix briefs is experimental. Phase 4 requires iteration to achieve output that matches creator expectations. Consider user testing with real creators before full rollout.

## Sources

### Primary (HIGH confidence)

**Stack:**
- [apify-client v2.22.0](https://github.com/apify/apify-client-js) - GitHub releases verified
- [openai v6.17.0](https://github.com/openai/openai-node/releases) - GitHub releases verified
- [@react-pdf/renderer v4.3.2](https://github.com/diegomura/react-pdf/issues/2756) - React 19 compatibility verified
- [TanStack Query v5 Docs](https://tanstack.com/query/latest) - Official documentation
- [Upstash Redis Docs](https://upstash.com/docs/redis/overall/getstarted) - Official documentation

**Features:**
- [TikTok Algorithm Guide 2026 (Buffer)](https://buffer.com/resources/tiktok-algorithm/) - First 3 seconds priority, saves matter more than likes
- [TikTok Trend Discovery Guide (OneStream)](https://onestream.live/blog/tiktok-trend-discovery-guide/) - User behavior expectations
- [YouTube Ends Trending Page (eMarketer)](https://www.emarketer.com/content/youtube-ends-trending-page-prioritize-algorithmic-feeds-hyper-specific-categories) - Industry shift insights
- [Best Storyboard Software 2026 (Boords)](https://boords.com/best-storyboard-software) - Competitive landscape
- [AI Storyboard Generators 2026 (Boords)](https://boords.com/blog/the-6-best-ai-storyboard-generators) - Feature expectations

**Architecture:**
- [Next.js App Router Documentation](https://nextjs.org/docs/app) - Official docs
- [Zustand + React Query Pattern (Medium)](https://medium.com/@freeyeon96/zustand-react-query-new-state-management-7aad6090af56) - State management patterns
- [Server Actions vs API Routes (Makerkit)](https://makerkit.dev/blog/tutorials/server-actions-vs-route-handlers) - Architecture decisions
- [v0.dev Documentation](https://v0.dev/docs) - v0 MCP workflow

**Pitfalls:**
- [TikTok: How We Combat Scraping](https://www.tiktok.com/privacy/blog/how-we-combat-scraping/en) - Official ToS enforcement stance
- [TikTok Terms of Service](https://www.tiktok.com/legal/page/us/terms-of-service/en) - Legal restrictions
- [AI Content Tagging Challenges (Kontent.ai)](https://kontent.ai/blog/ai-based-auto-tagging-of-content-what-you-need-to-know/) - 30-40% error rate documented
- [LLM Hallucination Examples (EvidentlyAI)](https://www.evidentlyai.com/blog/llm-hallucination-examples) - Well-documented failure modes
- [Puppeteer PDF Issues (Medium)](https://medium.com/@onu.khatri/puppeteer-isnt-meant-for-pdfs-here-s-why-1e3a4419263f) - Memory exhaustion documented

### Secondary (MEDIUM confidence)

- [Apify TikTok Scraper Limitations](https://apify.com/clockworks/tiktok-scraper/issues/scraper-limitations-PZaIeYVOBMB4rgxWr) - Community-reported issues
- [TikTok Scraping Guide 2026 (Scrapfly)](https://scrapfly.io/blog/posts/how-to-scrape-tiktok-python-json) - Technical implementation guidance
- [Infinite Scroll Best Practices (Justinmind)](https://www.justinmind.com/ui-design/infinite-scroll) - UX patterns
- [Reducing LLM Hallucinations (Voiceflow)](https://www.voiceflow.com/blog/prevent-llm-hallucinations) - 96% reduction with guardrails
- [AI Storyboarding Tools 2025 (Celtx)](https://blog.celtx.com/modern-storyboarding-ai-technology/) - Emerging capabilities

### Tertiary (LOW confidence)

- [WIPO Remix Culture](https://www.wipo.int/web/wipo-magazine/articles/remix-culture-and-amateur-creativity-a-copyright-dilemma-39210) - Fair use ambiguity (jurisdiction-dependent)
- [AI Video Tagging Challenges (VideoTap)](https://videotap.com/blog/ai-video-tagging-benefits-use-cases-challenges) - "Generally more limited" for audio/video vs text
- [Storyboarder.ai Review 2025 (Skywork)](https://skywork.ai/skypage/en/Storyboarder.ai-Review-2025-The-Ultimate-Guide-to-AI-Storyboarding/1974522243654021120) - Visual consistency issues reported but improving

---
*Research completed: 2026-02-02*
*Ready for roadmap: yes*
