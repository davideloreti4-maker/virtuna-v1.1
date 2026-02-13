# Research Summary: Virtuna MVP Launch

**Domain:** TikTok Creator Intelligence SaaS -- Landing Page, Onboarding, Payments (Whop), Referral Program
**Researched:** 2026-02-13
**Overall confidence:** HIGH

## Executive Summary

Virtuna's MVP launch adds four feature areas to an existing Next.js 16 app with an established design system, Supabase Auth, and working Whop payment integration: (1) a conversion-optimized landing page with interactive hive demo, (2) progressive onboarding with contextual tooltips, (3) Whop-powered 7-day Pro trial with card upfront, and (4) an in-product referral program with one-time bonuses.

The codebase is significantly further along than the milestone scope suggests. The Whop payment integration is already built: embedded checkout modal, webhook handler (membership.went_valid, went_invalid, payment_failed), subscription API, cron sync fallback, tier configuration, and access control utilities (`hasAccessToTier()`, `FeatureGate`). The database schema includes tables for affiliate tracking (affiliate_clicks, affiliate_conversions, wallet_transactions) that were created during the brand-deals milestone. Eleven landing page components already exist. The core work is wiring existing infrastructure to new user-facing flows, not building payment systems from scratch.

The critical missing piece requiring immediate attention is the mock AuthGuard -- the entire authenticated experience is built on a 350ms setTimeout that renders children unconditionally. This must be replaced with real Supabase auth verification before any other feature work. The second risk is the landing page interactive demo: the existing hive visualization renders 1300+ nodes at 60fps on desktop, but porting this directly to a mobile-first landing page (83% of TikTok creator traffic is mobile) would destroy performance. A separate lightweight demo (50 nodes, pre-computed positions, no physics) is essential.

Stack additions are minimal: only `@whop/sdk` needs to be added, replacing raw `fetch()` calls with a typed client. The tooltip system is built custom with Zustand + Framer Motion (both already installed). Everything else leverages existing packages. This is a feature-building milestone, not an infrastructure milestone.

From a competitive standpoint, Virtuna is positioned at 10-20x lower cost than competitors (Pentos $99-$999/mo, Exolyt $199-$600/mo vs Virtuna $19-$49/mo). The hive visualization and viral score prediction are genuine differentiators no competitor offers. The interactive demo on the landing page is the primary conversion lever -- 2026 best practice confirms SaaS pages with embedded demos convert 2-3x over "book a call" CTAs, and 7-day card-upfront trials convert at ~40% due to urgency.

## Key Findings

**Stack:** Only 1 new package needed (`@whop/sdk`). Tooltips built custom (Zustand + Framer Motion). TikTok OAuth implemented manually (2 route handlers, no Auth.js). Everything else already installed.

**Architecture:** Three route groups: (marketing) for landing, (onboarding) for post-signup flow, (app) for dashboard. Middleware captures referral cookies server-side (survives Safari ITP). Cookie + DB dual-state for onboarding persistence. New `referral_links`/`referral_conversions` tables separate from brand-deal affiliate tables.

**Critical pitfall:** Mock AuthGuard must be replaced FIRST. Whop webhook silently drops events when `supabase_user_id` metadata is missing (user pays but stays on free tier). Referral attribution lost during OAuth redirect chain unless captured in server-side cookie before auth.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Foundation -- Auth + Cleanup** - Replace mock AuthGuard with real Supabase auth, remove trending page (11 files), restructure navigation
   - Addresses: Real auth verification, dead code removal, navigation for new pages
   - Avoids: Building features on fake auth (Pitfall 2), orphaned trending references (Pitfall 11)

2. **Landing Page + Pricing** - Rebuild landing components for Virtuna, add pricing section, create lightweight hive demo, mobile-first design
   - Addresses: Conversion funnel, interactive demo (key differentiator), social proof, FAQ
   - Avoids: Canvas scroll blocking on mobile (Pitfall 6), mobile performance death (Pitfall 5)
   - CAN RUN IN PARALLEL with Phase 1 (public route group, no auth dependency)

3. **Onboarding Flow** - Welcome screen, goal selection, TikTok connect, progressive checklist, contextual first-visit tooltips
   - Addresses: User activation (target: first value in 3 minutes), progressive disclosure
   - Avoids: Onboarding state lost across devices (Pitfall 10)
   - DEPENDS ON: Phase 1 (real auth must work)

4. **Payments + Trial** - Configure Whop 7-day Pro trial, wire landing page CTA -> checkout, build TierGate component, trial countdown UI, post-checkout tier refresh
   - Addresses: Revenue activation, trial-to-paid conversion, feature gating
   - Avoids: Whop-Supabase identity mismatch (Pitfall 1), trial config mismatch (Pitfall 4), stale cache after upgrade (Pitfall 8)
   - DEPENDS ON: Phase 1 (auth), Phase 2 (landing page CTA)

5. **Referral Program** - Code generation, click tracking, Whop affiliateCode passthrough, conversion attribution, one-time bonus payout, referral dashboard
   - Addresses: Growth lever, user acquisition cost reduction
   - Avoids: Attribution lost on OAuth redirect (Pitfall 3), bonus abuse (Pitfall 9), Safari ITP (Pitfall 16)
   - DEPENDS ON: Phase 4 (payments must work for conversion tracking)

6. **Polish** - "Aha moment" referral prompt, OG tags for referral links, edge case handling, Whop webhook idempotency, final QA
   - Addresses: Differentiators (referral prompt timing, social sharing previews)
   - Avoids: Webhook replay duplicates (Pitfall 7)
   - DEPENDS ON: Phases 3-5

**Phase ordering rationale:**
- Phase 1 is foundational -- everything depends on real auth
- Phase 2 can run in parallel because landing page is public (marketing route group)
- Phases 3-5 are sequential: auth -> onboarding -> payments -> referrals (each depends on prior)
- Phase 6 is last because polish is meaningless until core flows work end-to-end

**Research flags for phases:**
- Phase 2: Mobile demo performance needs REAL device testing (iPhone SE, mid-range Android), not DevTools emulation
- Phase 3: TikTok developer app approval may block production testing -- submit during Phase 1
- Phase 4: Whop plan configuration is a dashboard action -- create plans during Phase 1 so they exist when needed. Sandbox testing essential
- Phase 5: Whop affiliateCode behavior with custom referral programs (vs Whop marketplace affiliates) needs validation during implementation

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Only 1 new package, all others verified installed and working. Codebase examined directly |
| Features | HIGH | Table stakes verified against 2026 SaaS best practices from 20+ sources. Competitor pricing confirmed |
| Architecture | HIGH | Patterns match existing codebase conventions. All code references verified by reading source files |
| Pitfalls | HIGH | 16 pitfalls identified from codebase analysis + official docs + industry research |
| Whop integration | MEDIUM | affiliateCode prop confirmed in docs, but custom referral program behavior vs marketplace affiliates needs implementation-time validation |
| TikTok OAuth | MEDIUM | Standard OAuth 2.0 flow, but developer app approval timeline is unpredictable |

## Gaps to Address

- **Whop sandbox testing**: Existing checkout and webhook code has never been tested against Whop sandbox. Need end-to-end verification before launch
- **TikTok developer app approval**: Submit immediately (during Phase 1). Production requires HTTPS domain approval. Can take days to weeks
- **Mobile performance budget**: Hive demo on landing page needs profiling on real low-end Android devices. No benchmarks exist yet
- **Referral bonus amount**: Business decision needed -- how much is the one-time referral bonus? Affects unit economics and abuse prevention thresholds
- **Whop plan IDs**: Need to be created in Whop dashboard and added to environment variables before payment flows can be tested
- **Onboarding step count**: Research says 3-5 steps optimal. Exact steps need product decision (goal, TikTok connect, first analysis?)

## Sources

- Codebase analysis: package.json, checkout-modal.tsx, webhook handler, auth-guard.tsx, database.types.ts, billing-section.tsx
- [Whop Checkout Embed Docs](https://docs.whop.com/payments/checkout-embed) -- affiliateCode, sessionId, theme
- [Whop Affiliate Program Docs](https://docs.whop.com/manage-your-business/growth-marketing/affiliate-program)
- [@whop/sdk npm](https://www.npmjs.com/package/@whop/sdk), [@whop/checkout npm](https://www.npmjs.com/package/@whop/checkout)
- [SaaS Landing Page Best Practices 2026](https://www.storylane.io/blog/saas-landing-pages-best-practices)
- [SaaS Landing Page Trends 2026](https://www.saasframe.io/blog/10-saas-landing-page-trends-for-2026-with-real-examples)
- [SaaS Onboarding Strategy](https://userpilot.com/blog/saas-onboarding-strategy/)
- [Trial Conversion Benchmarks 2026](https://ideaproof.io/questions/good-trial-conversion)
- [SaaS Referral Program Guide](https://impact.com/referral/saas-referral-program-guide/)
- [TikTok Creator Metrics 2026](https://influenceflow.io/resources/tiktok-creator-metrics-the-complete-guide-to-tracking-analyzing-optimizing-your-performance-in-2026/)
- [NextStepjs](https://nextstepjs.com/) -- evaluated and not recommended (custom solution preferred)
- [Safari ITP Documentation](https://webkit.org/blog/category/privacy/)
