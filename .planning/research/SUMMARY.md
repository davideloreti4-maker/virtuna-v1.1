# Project Research Summary

**Project:** Virtuna v1.6 — Brand Deals & Affiliate Hub
**Domain:** Creator Monetization & Affiliate Aggregation Platform
**Researched:** 2026-02-02
**Confidence:** MEDIUM-HIGH

## Executive Summary

The creator monetization space is a $250B market with well-established patterns and clear table stakes. Successful platforms (GRIN, Aspire, CreatorIQ) differentiate on UX simplicity, not feature complexity—73% of creators struggle with earnings tracking, creating a significant opportunity for a Revolut-quality wallet experience.

**Recommended approach:** Use an affiliate aggregator service (Strackr at ~EUR50/mo) rather than building individual network integrations. Start with Supabase + existing stack for wallet UI and deal browsing with mock data. Integrate the aggregator API in a later phase. The three-tier system (Premium/Pro/Starter) maps cleanly to a gamified level progression that drives engagement and unlocks better deals.

**Critical risk:** Legal compliance is the primary threat. Most affiliate programs explicitly prohibit unauthorized aggregation, FTC disclosure violations carry $53K+ fines per incident, and holding creator funds triggers money transmission licensing requirements ($500K+ compliance burden). The architecture must be designed from day one to avoid regulatory traps—display earnings only (never hold funds), enforce mandatory FTC disclosures, and audit every deal source for ToS compliance before aggregation.

## Key Findings

### Recommended Stack

The existing Virtuna stack is sufficient for the wallet and marketplace UI. No new major dependencies are required for Phase 1-2. The architecture already uses Zustand stores for client state with localStorage persistence, Supabase for authentication and database, and component-first architecture with TypeScript strict mode.

**Core additions:**
- **Strackr API** (or wecantrack): Affiliate aggregator providing 271+ networks through unified API — eliminates 2-3 weeks per network for individual integrations and handles disparate authentication schemes
- **Stripe Connect** (future): For eventual automated payouts — industry standard used by Shopify, DoorDash, supports 118+ countries with built-in KYC/compliance
- **Supabase RPC functions**: Atomic wallet operations — prevents race conditions in balance updates with database-level locking

**Already sufficient (no addition needed):**
- Recharts (already installed): Full charting capability for wallet visualizations
- Supabase: Handles wallet storage, transactions, and RLS security
- Zustand: Client-side caching with Supabase sync pattern
- Existing component architecture: Extends cleanly to wallet/deals/levels

**Explicitly avoid:**
- Individual network SDKs (use aggregator instead)
- Custom scraping solutions (legal risk, ToS violations)
- Separate fintech database (Supabase sufficient with proper schema)
- Blockchain/crypto payments (complexity without demand)
- Real-time WebSocket for balance (polling sufficient)

### Expected Features

The creator monetization domain has well-defined table stakes and clear anti-features. Platforms that add complexity lose to those that simplify.

**Must have (table stakes):**
- Wallet: Balance display (available vs pending), transaction history, withdrawal capability
- Deals: Browse/filter marketplace, clear eligibility requirements, deal status tracking
- Levels: Current level display, XP progress bar, tier access indicators
- FTC compliance: Mandatory disclosure badges on all affiliate content
- Payment status: Visual indicators (paid, pending, processing, failed)

**Should have (competitive advantage):**
- Locked/unlocked deal status: Visual tier gating that drives progression
- Earnings velocity: "You earned $X this week" — simple calculation, high psychological impact
- Deal aggregation: Multiple sources in one place (Virtuna's planned differentiator)
- Revolut-quality wallet UX: Real-time balance updates, earnings goals, clean transaction list
- Match scoring: "92% match for your audience" based on performance data
- Source attribution: "From CJ Affiliate, synced 2h ago" builds trust through transparency

**Defer (not essential, avoid scope creep):**
- Multi-currency payouts (single currency with conversion display instead)
- Instant payouts (standard Net-15/30 schedule sufficient)
- Full influencer CRM (enterprise feature, adds complexity)
- Content rights management (legal complexity, not creator-focused)
- Social leaderboards (creates unhealthy competition, privacy concerns)
- Commission from creators (Aspire differentiates by NOT doing this)

**Anti-features (do NOT build):**
- Never hold creator funds (triggers money transmission licensing)
- Never build custom payout infrastructure without licensed provider
- Never sort deals by commission rate over relevance (CFPB violation)
- Never auto-enroll creators in Virtuna's affiliate program (conflict of interest)
- Never scrape networks without API authorization (ToS violations, CFAA risk)

### Architecture Approach

The new features integrate cleanly with Virtuna's existing patterns. All monetization features follow the same client-server pattern: Zustand caches data locally, Supabase is source of truth for persistent data, RLS policies enforce security.

**Database schema highlights:**
- `creator_profiles`: Links to auth.users, tracks level/XP/metrics
- `deals`: Both Virtuna-native and aggregated (source field distinguishes)
- `deal_enrollments`: Creator applications with generated affiliate links
- `affiliate_clicks`: Click tracking for attribution (server-side, privacy-compliant)
- `conversions`: Conversion records with commission amounts and status
- `wallet_transactions`: Immutable ledger with balance snapshots
- `payouts`: Payout requests with external provider references
- `xp_events`: Audit trail for level progression

**Major components:**
1. **WalletDashboard** — Balance display, charts, transaction history (Recharts for visualizations)
2. **DealsMarketplace** — Browse/filter deals with tier-based access control
3. **LevelProgress** — XP bar, current level, unlock status for deals
4. **AffiliateLink** — Server-side click tracking before redirect to preserve attribution

**Data flow patterns:**
- Deal aggregation: Vercel cron job → Strackr API → Normalize → Upsert to Supabase → Zustand cache
- Click tracking: Virtuna redirect endpoint → Log click server-side → Redirect with subid → Network tracks conversion → Webhook back to Virtuna → Credit wallet
- Level progression: XP-granting events → xp_events table → UPDATE creator_profiles → Real-time subscription → level-store updates UI
- Wallet sync: Supabase wallet_transactions (source of truth) → Initial fetch + real-time subscription → wallet-store cache → Component render

### Critical Pitfalls

The research identified legal compliance as the dominant risk category, with technical and UX concerns being secondary.

1. **ToS Violations from Unauthorized Aggregation (CRITICAL)** — Most affiliate programs explicitly prohibit displaying links on "coupon aggregation sites" or "third-party platforms" without authorization. Peak Design and Amazon Associates terms are typical. **Prevention:** Audit every program's ToS before inclusion. Categorize as "API-permitted," "explicit aggregation allowed," or "prohibited." For prohibited programs, only display deals the creator themselves added (user-sourced). Consider becoming a licensed sub-affiliate network. Build relationships with networks for aggregator partnerships. **Phase to address:** Phase 1 (Foundation) — Must establish legal framework before any aggregation.

2. **Money Transmission Licensing Trap (CRITICAL)** — If Virtuna holds creator funds (even temporarily) or facilitates payouts, it becomes a "money transmitter" requiring licenses in 49+ states at $25K-$1M+ per state in surety bonds plus ongoing compliance costs. **Prevention:** Design system to explicitly never hold funds. Phase 1: Display-only (show earnings from external platforms). Phase 2: Link-out to each network's payout portal. Phase 3 (if ever): Partner with licensed provider (Stripe Connect, PayPal Marketplaces). Never build custom payout infrastructure without legal review. **Phase to address:** Phase 1 (Architecture) — Architectural decision that can't be changed later.

3. **FTC Disclosure Liability (CRITICAL)** — Platforms share liability for creator disclosure violations. In 2025, fines exceed $53K per violation, and every non-compliant post counts separately. **Prevention:** Enforce mandatory disclosure badges on all affiliate content. Auto-append disclosure language ("This link may earn a commission"). Provide compliant templates. Document compliance program (FTC considers "due diligence"). **Phase to address:** Phase 2 (UI/Deal Display) — Build into display layer from start.

4. **Attribution Failure as Middleman (HIGH)** — Safari limits cookies to 7 days, Firefox blocks trackers, 17% of clicks are fraudulent. As a middleman, Virtuna faces the hardest attribution problem in affiliate marketing. **Prevention:** Don't become the tracking middleman. Let clicks go directly to affiliate networks via deep links. Display network-reported earnings, not self-calculated. Use server-side tracking with first-party cookies if building custom tracking. **Phase to address:** Phase 2 (Click Handling).

5. **Link Rot and Stale Deals (MODERATE)** — Industry data shows 12-16% of affiliate links are broken at any given time. Stale deals destroy user trust. **Prevention:** Implement automated link health checking (daily for high-traffic deals). Show "last verified" timestamps. Auto-hide failed validations. Build user reporting mechanism. **Phase to address:** Phase 3 (Deal Management).

6. **CFPB "Preferencing" Violations (MODERATE)** — CFPB ruled in 2024 that ranking offers by commission rate over consumer benefit is an "illegal abusive practice." **Prevention:** Default sort by relevance, not commission. Clearly label "sponsored" placements. Provide transparent sorting options. Document algorithm rationale. **Phase to address:** Phase 2 (Deal Display).

7. **Creator Trust Erosion (HIGH UX RISK)** — If Virtuna shows earnings that don't match network dashboards, trust evaporates. Creator communities are vocal about negative experiences. **Prevention:** Display earnings with clear source attribution. Show sync status and timestamps. Don't calculate/estimate earnings—show network-reported values only. Provide discrepancy reporting mechanism. **Phase to address:** Phase 2 (Dashboard UX).

## Implications for Roadmap

Based on research, I recommend a 7-phase structure that frontloads legal/architectural decisions, builds foundation before features, and defers complex integrations until core value is proven.

### Phase 1: Legal Foundation & Database
**Rationale:** Legal compliance must be established before any code. Money transmission architecture decisions can't be changed later without complete rebuild. Database schema enables all other phases.

**Delivers:**
- Legal review of aggregation approach (sub-affiliate network vs. user-sourced deals)
- Supabase tables (creator_profiles, levels, deals, deal_enrollments, wallet_transactions, conversions, xp_events, payouts)
- RLS policies for data access control
- Levels reference data (Starter/Pro/Premium tier definitions)
- RPC functions for atomic wallet operations
- Security architecture (encryption, audit logging for financial data)

**Addresses:** PITFALLS.md money transmission trap, ToS violation risk, financial data security

**Avoids:** Building features that require regulatory licensing, making architectural decisions that lock in compliance violations

**Research flag:** NEEDS LEGAL REVIEW — Consult fintech/affiliate licensing attorney before implementation.

### Phase 2: Level System & Tier Access
**Rationale:** Levels are the simplest feature with no external dependencies. They provide immediate gamification value and establish tier-based access control that all other features depend on.

**Delivers:**
- `level-store.ts` (Zustand store syncing with creator_profiles)
- LevelProgress component (XP bar, current level display)
- LevelCard component (current level with perks listed)
- LevelRoadmap page (all levels with unlock status)
- Level display in sidebar/header
- XP granting logic (backend functions for deal completion, milestones)

**Uses:** STACK.md existing Zustand + Supabase pattern

**Implements:** ARCHITECTURE.md level progression flow

**Addresses:** FEATURES.md gamification/progression mechanics

**Research flag:** STANDARD PATTERN — No additional research needed. Well-established gamification patterns.

### Phase 3: Wallet Core (Display Only)
**Rationale:** Wallet is the differentiator opportunity. Build read-only view first to establish UX quality bar before handling real money flow.

**Delivers:**
- `wallet-store.ts` with Supabase real-time subscription
- WalletDashboard page (balance prominently displayed)
- BalanceCard component (available vs pending, Revolut-style)
- TransactionList and TransactionItem components
- EarningsChart component (Recharts time-series)
- Wallet page route (`/dashboard/wallet`)
- Mock transaction data for UI development

**Uses:** STACK.md Recharts (already installed), Supabase real-time

**Implements:** ARCHITECTURE.md wallet sync flow

**Addresses:** FEATURES.md table stakes (balance, transaction history, pending vs available)

**Avoids:** PITFALLS.md money transmission (display only, never holds funds)

**Research flag:** STANDARD PATTERN — Fintech UI patterns well-documented (Revolut, Cash App references).

### Phase 4: Deals Marketplace (Tier-Gated)
**Rationale:** With levels and wallet UI in place, marketplace provides browsable deals with visual progression incentive. Start with manual/curated deals before aggregation complexity.

**Delivers:**
- `deals-store.ts` with filtering and tier access logic
- DealsMarketplace page with browse/filter UI
- DealCard component (tier badge, locked/unlocked status)
- DealFilters component (tier, category, status)
- DealDetail page with eligibility display
- TierBadge component (Premium/Pro/Starter visual indicator)
- Deal application flow (creates deal_enrollment record)
- Manual deal entry (admin interface or direct DB insert for MVP)

**Uses:** STACK.md existing component architecture, Supabase RLS for tier access

**Implements:** ARCHITECTURE.md deal marketplace, tier-based access control

**Addresses:** FEATURES.md table stakes (deal browsing, status tracking, eligibility)

**Addresses:** FEATURES.md differentiators (locked/unlocked status drives progression)

**Avoids:** PITFALLS.md aggregation ToS violations (manual deals only in this phase)

**Research flag:** STANDARD PATTERN — Marketplace UI well-established. FTC disclosure requirements must be implemented in this phase.

### Phase 5: Affiliate Tracking (Virtuna Program)
**Rationale:** Implement tracking for Virtuna's own affiliate program first to validate attribution flow before aggregating external networks. Lower risk since we control both sides.

**Delivers:**
- Click redirect API route (`/api/affiliate/[code]`)
- Server-side click logging (affiliate_clicks table)
- Attribution cookie (30-day window, first-party)
- Conversion webhook handler (`/api/webhooks/conversion`)
- Conversion-to-wallet pipeline (creates wallet_transaction)
- XP granting on conversion approval
- AffiliateLink component (copy-able link for creators)
- ClickStats component (click/conversion metrics)
- Virtuna affiliate deal (featured in Starter tier)

**Uses:** STACK.md Next.js API routes for server-side tracking

**Implements:** ARCHITECTURE.md affiliate click tracking flow, level progression on conversion

**Addresses:** FEATURES.md Virtuna affiliate as gateway, earnings tracking

**Avoids:** PITFALLS.md attribution failure (server-side, first-party cookies), coupon poaching (creator-specific codes)

**Research flag:** NEEDS VALIDATION — Test attribution accuracy across browsers (Safari, Firefox) and devices before external network integration.

### Phase 6: Deal Aggregation (External Sources)
**Rationale:** With tracking proven and legal framework established, integrate external deal sources through aggregator API. This is the highest-risk phase due to ToS compliance.

**Delivers:**
- Strackr API integration (or wecantrack as alternative)
- Vercel cron job (`/api/cron/deals`) for daily deal sync
- Deal normalization logic (external format → deals schema)
- Source attribution display ("From CJ Affiliate, synced 2h ago")
- Link health checking (automated validation)
- "Last verified" timestamps on deals
- Deal refresh pipeline
- User reporting mechanism for broken links

**Uses:** STACK.md Strackr API recommendation, Vercel cron

**Implements:** ARCHITECTURE.md deal aggregation flow

**Addresses:** FEATURES.md differentiator (deal aggregation from multiple sources)

**Avoids:** PITFALLS.md ToS violations (only aggregate API-permitted programs), link rot (health checking built-in), scraping legality (API-first approach)

**Research flag:** NEEDS PER-SOURCE REVIEW — Each network (CJ, ShareASale, Impact, Rakuten) requires individual ToS audit for aggregation permissions. This is the highest legal risk phase.

### Phase 7: Enhanced Analytics & Payouts
**Rationale:** With core functionality proven and revenue flowing, add polish features and payout capability through licensed provider.

**Delivers:**
- Earnings velocity display ("You earned $X this week")
- Projected earnings based on pending deals
- Monthly earnings patterns (analytics dashboard)
- Tax preparation export (CSV/PDF with categories)
- Stripe Connect integration (connected account onboarding)
- Payout request flow (creates payout record)
- Payout method configuration (in settings page)
- Payout status tracking
- Match scoring ("92% match for your audience")

**Uses:** STACK.md Stripe Connect for licensed payouts

**Implements:** ARCHITECTURE.md payout flow with external provider

**Addresses:** FEATURES.md differentiators (earnings velocity, projected earnings, match scoring)

**Avoids:** PITFALLS.md money transmission (Stripe Connect is licensed provider), unlicensed payout infrastructure

**Research flag:** STANDARD INTEGRATION — Stripe Connect documentation is comprehensive. Consider SOC 2 compliance for enterprise credibility.

### Phase Ordering Rationale

**Legal first:** ToS compliance and money transmission architecture can't be retrofitted. Phase 1 establishes boundaries for all subsequent work.

**Levels before marketplace:** Tier access control is fundamental to the product value prop. Levels are simplest feature with zero external dependencies, so building them first validates the Zustand + Supabase pattern for all other stores.

**Wallet display before real money:** Establishes UX quality bar and proves UI components before handling actual earnings. Reduces risk of poor UX undermining trust when real money is involved.

**Manual deals before aggregation:** De-risks the marketplace UI and tier-gating logic before introducing legal complexity of deal aggregation. Allows soft launch with curated deals while legal review proceeds.

**Virtuna tracking before external:** Validates attribution flow in controlled environment (we own both sides) before integrating external networks where debugging is harder.

**Aggregation after tracking proven:** Highest legal risk comes last, after core value is established. If aggregation proves legally untenable, product still functions with manual deals + Virtuna affiliate.

**Payouts last:** Defer licensed provider integration until revenue is proven. Early users can withdraw directly from networks; automated payouts are polish, not core value.

### Research Flags

**Needs additional research during planning:**
- **Phase 1 (Legal Foundation):** Consult fintech/affiliate licensing attorney. Determine if sub-affiliate network model is viable alternative to user-sourced deals.
- **Phase 5 (Affiliate Tracking):** Validate attribution accuracy across browsers and devices. Test first-party cookie persistence. Benchmark against known networks.
- **Phase 6 (Deal Aggregation):** Audit ToS for each network individually (CJ, ShareASale, Impact, Rakuten, Awin). Determine which require partnership agreements vs. allow aggregation vs. prohibit entirely.

**Standard patterns (can skip research-phase):**
- **Phase 2 (Level System):** Gamification patterns well-documented. Trophy.so and DrawSQL provide reference implementations.
- **Phase 3 (Wallet Core):** Fintech UI patterns established. Revolut and Cash App provide design references. Supabase RPC pattern documented in STACK.md sources.
- **Phase 4 (Deals Marketplace):** Marketplace UI is standard. GRIN, Aspire, CreatorIQ provide feature precedent. FTC disclosure requirements are explicit.
- **Phase 7 (Analytics & Payouts):** Stripe Connect integration well-documented. Analytics patterns straightforward.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Stack** | HIGH | Existing stack sufficient for Phases 1-4. Strackr/wecantrack capabilities verified from multiple sources. Stripe Connect industry standard. |
| **Features** | HIGH | Table stakes well-documented across GRIN, Aspire, CreatorIQ. Creator pain points validated by industry reports (73% struggle with income tracking). |
| **Architecture** | HIGH | Patterns follow existing Virtuna codebase exactly. Zustand + Supabase integration documented in community discussion. Database schema matches standard affiliate/marketplace systems. |
| **Pitfalls** | MEDIUM-HIGH | Legal risks explicit and well-documented (FTC guidelines, state MTL regulations, affiliate program ToS). Technical risks (attribution, link rot) validated by industry data. CFPB preferencing guidance is new (2024), enforcement patterns still emerging. |

**Overall confidence:** MEDIUM-HIGH

The technical approach is well-validated and the feature set is clearly defined. The primary uncertainty is legal compliance—specifically which affiliate networks permit aggregation vs. require partnership agreements vs. prohibit entirely. This requires per-network ToS review and potentially legal consultation before Phase 6 (Deal Aggregation).

### Gaps to Address

**Legal/Compliance gaps:**
- **Per-network ToS audit:** Research identified general prohibition patterns, but each major network (CJ, ShareASale, Impact, Rakuten, Awin) needs individual review. Some may offer "aggregator partner" programs.
- **Sub-affiliate licensing:** Could Virtuna become a licensed sub-affiliate network rather than an aggregator? What are requirements and costs? This could resolve ToS restrictions but adds compliance burden.
- **International compliance:** Research focused on US regulations (FTC, state MTL, CFAA). EU DSA, UK CMA, GDPR implications for non-US creators not covered.

**Technical gaps:**
- **Strackr API tier pricing:** Pricing page shows EUR50/mo for standard tier, but API access requires "custom" tier with undisclosed pricing. Need to confirm actual API tier cost before committing to Strackr.
- **Network-specific webhook formats:** Research covered general conversion tracking patterns, but each network has different postback/webhook formats. Will require per-network handling in Phase 5-6.
- **Attribution window standards:** Different networks use different attribution windows (7-day, 30-day, 90-day click, last-click vs. first-click). Needs clarification for accurate earnings display.

**Business gaps:**
- **Virtuna program conflict of interest:** PITFALLS.md flags risk of featuring Virtuna's affiliate prominently while aggregating competitors. Strategy for separation/disclosure needs definition before Phase 4.
- **Deal curation strategy:** If ToS restrictions limit aggregation, how many manual/curated deals are needed for MVP viability? What's the minimum catalog size creators expect?

**How to handle during execution:**
- **Phase 1:** Allocate budget for legal consultation (fintech attorney specializing in affiliate compliance). Non-negotiable before aggregation.
- **Phase 4:** Define conflict-of-interest disclosure policy before launching marketplace. Consider separate "Virtuna Partnerships" section vs. integrated display.
- **Phase 6:** Execute per-network ToS review before integration. Create spreadsheet: Network | ToS Section | Aggregation Allowed? | Contact for Partnership. May need to pivot to partner agreements rather than aggregation.

## Sources

### Stack Research (STACK.md)
**Primary (HIGH confidence):**
- [Strackr Affiliate API](https://strackr.com/affiliate-api) — Aggregator capabilities, pricing
- [Strackr Pricing](https://strackr.com/pricing) — Verified EUR50/mo standard, custom API tier
- [Stripe Connect Documentation](https://docs.stripe.com/connect) — Official payout integration docs
- [CJ Developer Portal](https://developers.cj.com/) — API verification
- [ShareASale API Building Blocks](https://help.shareasale.com/hc/en-us/articles/5375832636695-API-Building-Blocks) — API verification
- [Supabase Database Transactions Discussion](https://github.com/orgs/supabase/discussions/526) — RPC pattern for atomic operations

**Secondary (MEDIUM confidence):**
- [wecantrack Affiliate Aggregator](https://wecantrack.com/affiliate-aggregator/) — Alternative aggregator
- [Affluent Affiliate API](https://www.affluent.io/affiliate-api/) — Alternative aggregator

### Features Research (FEATURES.md)
**Primary (HIGH confidence):**
- [GRIN](https://grin.co/) — Enterprise platform feature set
- [Aspire](https://www.aspire.io/) — Creator-first positioning, "no commissions" differentiator
- [CreatorIQ](https://www.creatoriq.com/) — Enterprise intelligence capabilities
- [InfluenceFlow Creator Analytics](https://influenceflow.io/resources/creator-income-analytics-master-your-earnings-in-2026/) — 72% use tracking systems, 34% earnings lift
- [TikTok Creator Rewards](https://www.tiktok.com/creator-academy/en/article/creator-rewards-program) — Platform tier mechanics

**Secondary (MEDIUM confidence):**
- [Brandbassador](https://www.brandbassador.com/) — Gamification patterns
- [Trophy - Levels in Gamification](https://trophy.so/blog/levels-feature-gamification-examples) — Design principles

### Architecture Research (ARCHITECTURE.md)
**Primary (HIGH confidence):**
- [Zustand with Supabase Discussion](https://github.com/pmndrs/zustand/discussions/2284) — Integration pattern
- [How to use Zustand with Supabase and Next.js App Router](https://medium.com/@ozergklp/how-to-use-zustand-with-supabase-and-next-js-app-router-0473d6744abc) — Implementation guide
- [Vercel Cron Jobs Documentation](https://vercel.com/docs/cron-jobs) — Aggregation scheduling
- [Best Practices for Supabase](https://www.leanware.co/insights/supabase-best-practices) — RLS patterns

**Secondary (MEDIUM confidence):**
- [DrawSQL Level Up Schema Template](https://drawsql.app/templates/level-up) — Database reference
- [Affiliate Conversion Tracking - Tapfiliate](https://tapfiliate.com/blog/affiliate-conversion-tracking/) — Attribution patterns

### Pitfalls Research (PITFALLS.md)
**Primary (HIGH confidence):**
- [FTC Disclosures 101](https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers) — Official disclosure requirements
- [CSBS Money Transmission Modernization Act](https://www.csbs.org/csbs-money-transmission-modernization-act-mtma) — MTL regulations
- [Peak Design Affiliate Program Rules](https://peakdesign.zendesk.com/hc/en-us/articles/207943586-Affiliate-Program-Rules) — ToS prohibition example
- [Amazon Associates Program Policies](https://affiliate-program.amazon.com/help/operating/policies) — ToS prohibition example
- [Web Scraping Legal Guide 2025 (GroupBWT)](https://groupbwt.com/blog/is-web-scraping-legal/) — CFAA precedent

**Secondary (MEDIUM confidence):**
- [Tapfiliate Affiliate Marketing Compliance 2025](https://tapfiliate.com/blog/affiliate-marketing-compliance-gp/) — CFPB preferencing guidance
- [Link Rot Study (Affluent)](https://www.affluent.io/ask-the-experts-how-link-rot-affects-publishers/) — 12-16% broken links
- [Affiliate Tracking 2025 (AutomateToProfit)](https://automatetoprofit.com/affiliate-tracking-2025-from-pixels-to-server-side-what-really-works-now/) — Attribution gap statistics
- [Money Transmitter License Guide (RemitSo)](https://remitso.com/blogs/money-transmitter-license) — Licensing costs

---
*Research completed: 2026-02-02*
*Ready for roadmap: yes*
