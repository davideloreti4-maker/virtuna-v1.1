# Feature Landscape

**Domain:** TikTok Creator Intelligence SaaS (MVP Launch: Landing Page, Onboarding, Payments, Referral Program)
**Researched:** 2026-02-13
**Overall Confidence:** HIGH (multiple verified sources, existing codebase examined)

---

## Table Stakes

Features users expect. Missing = product feels incomplete or untrustworthy.

### Landing Page

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Clear value proposition in hero (< 3 seconds) | 83% of traffic is mobile; if value is unclear in 3-5s, visitors leave | Low | None | Benefit-driven headline: "Find your next viral TikTok" not "Social media intelligence platform" |
| Interactive product demo in hero | 2026 standard: the website IS the demo. Static screenshots are dead. SaaS pages with embedded demos convert 2-3x over "Book a call" CTAs | Med | Existing Canvas hive visualization | Mini hive viz with fake data + animated analysis preview. 10-15 second loop. NOT a full sandbox |
| Social proof section | Trust signals are non-negotiable for payment-upfront SaaS | Low | None | Creator testimonials, usage stats, TikTok-native language. Even pre-launch: "Join X creators" waitlist count |
| Pricing section with clear tier comparison | Users need to see Starter vs Pro before entering checkout. Card-upfront trials demand transparency | Low | Whop plan IDs | Two-column comparison. Starter $19/mo, Pro $49/mo. Highlight Pro trial badge |
| Mobile-optimized layout | ~83% of visits are mobile for creator tools. TikTok creators are mobile-native. Non-negotiable | Med | None | Mobile-first design, not responsive shrinkdown. Touch-friendly CTAs (min 44px), no pop-ups, fast load (< 2s) |
| Single clear CTA per section | Multiple competing CTAs reduce conversion. Every section drives toward trial signup | Low | None | Primary: "Start Free Pro Trial" (coral button). Secondary: "See pricing" |
| FAQ section | Reduces support burden, addresses objections (billing, cancellation, data safety) | Low | None | Accordion. 6-8 questions: trial length, what happens after trial, cancellation, data sources |
| Fast page load (< 2 seconds) | Every additional second costs ~4.42% of conversions | Med | Next.js SSR, image optimization | Server components for static sections, lazy-load interactive demo, optimize fonts/images |

### Onboarding Flow

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Frictionless signup (social login) | Supabase Auth already supports this. Removing friction at entry is table stakes | Low | Existing Supabase Auth | Google + email/password. Consider adding TikTok OAuth if API allows |
| Welcome screen with goal selection | "What do you want to achieve?" personalizes the path. 86% of users more likely to stay with good onboarding | Low | None | 3-4 goals: "Find viral content ideas", "Analyze my niche", "Track competitors", "Monetize my audience" |
| Progressive checklist (3-5 steps) | Structured path to activation. Checklists increase completion rates by 48%. Must reach first value in minutes | Med | Dashboard features | Steps: Connect TikTok handle, Run first analysis, Explore hive, Set up notifications, Invite a friend |
| Skeleton/loading states during setup | Users need visual feedback that things are happening | Low | Existing UI primitives | Already have skeleton components in the design system |
| Skip/dismiss option on all guidance | Forced tours cause rage-quits. Always let users skip | Low | None | "Skip tour" and "x" on every step. Remember dismissal state |

### Payments (Whop Integration)

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Embedded checkout (not redirect) | Already implemented via WhopCheckoutEmbed. Users expect seamless in-app payment | Low | Existing checkout-modal.tsx, @whop/checkout | ALREADY BUILT. Just needs landing page integration and trial configuration |
| 7-day Pro trial with card upfront | Opt-out trials convert 25-50% (avg 25%). 7-day trials convert ~40.4% due to urgency | Low | Whop plan configuration | Configure on Whop dashboard: 7-day trial on Pro plan. Card required upfront |
| Clear trial-to-paid messaging | Users must know exactly when they'll be charged and how to cancel | Low | None | "7-day free trial, then $49/mo. Cancel anytime." visible at checkout and in settings |
| Billing management in settings | Already have billing-section.tsx. Users need to see plan, status, next billing date, cancel option | Low | Existing billing-section.tsx | ALREADY BUILT. May need polish for trial countdown display |
| Webhook-driven subscription sync | Already implemented. Whop webhooks update Supabase on payment events | Low | Existing webhook handler | ALREADY BUILT. Handles went_valid, went_invalid, payment_failed |
| Feature gating by tier | Already have FeatureGate component and hasAccessToTier utility | Low | Existing feature-gate.tsx | ALREADY BUILT. Wire into new onboarding features |
| Upgrade prompts at gate boundaries | When free users hit a Pro feature, show contextual upgrade prompt | Med | FeatureGate, CheckoutModal | Soft-gate: show blurred preview + "Upgrade to unlock" overlay |

### Referral Program

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Unique shareable referral link per user | Core mechanic. Every user gets a link. Copy-to-clipboard in one tap | Med | Supabase, referral tracking tables | Generate short codes (e.g., virtuna.com/r/abc123). Store in DB. Already have affiliate_clicks table schema |
| Referral dashboard showing clicks/conversions | Users need to see their referral performance | Med | Existing earnings-tab patterns | Repurpose brand-deals earnings UI patterns for referral stats |
| One-time bonus on successful referral | Primary incentive. "Earn $X for each friend who subscribes" | Med | Whop webhooks, wallet_transactions table | Trigger on membership.went_valid webhook when referred user subscribes. Credit to wallet |
| Clear referral program explanation | Users need to understand rules before sharing | Low | None | In-app page with how-it-works steps, reward amount, terms |

---

## Differentiators

Features that set Virtuna apart. Not expected, but create "wow" moments and drive sharing.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Animated hive demo on landing page** | No competitor has an interactive network visualization as their hero demo. This IS the differentiator | Med | Existing Canvas hive viz (network-visualization.tsx) | Lightweight version: 50-100 nodes (not 1300+), auto-plays, shows fake "viral score" analysis. Eye candy that sells |
| **Contextual first-visit tooltips** | Guide users to value without blocking them. Tooltips on key features appear once, dismissed permanently | Med | NextStepjs or Onborda library | NextStepjs: lightweight, Next.js native, Framer Motion (already in deps). 5-7 tooltip steps on dashboard first visit |
| **Trial countdown in-app** | Creates urgency. "3 days left in your Pro trial" in sidebar/header. Drives conversion at day 5-6 | Low | Subscription data (existing) | Calculate from current_period_end. Show banner in app shell when trial active |
| **"Aha moment" referral prompt** | Surface referral CTA after user's first successful analysis (not on first visit). Timing matters: show when value is felt | Low | Onboarding state tracking | Track "first_analysis_complete" event. Show one-time modal: "Love Virtuna? Share with a creator friend and earn $X" |
| **Animated onboarding progress** | Celebration animations on checklist completion (confetti/pulse). Gamification increases engagement by 48% | Low | Framer Motion (existing) | Subtle: checkmark animation, progress bar fill. NOT over-the-top confetti |
| **Deep-link referral with pre-filled context** | Referral links land on personalized page: "Your friend [name] invited you to try Virtuna" | Med | Referral link params, landing page variant | Custom /invite/[code] route showing referrer name + special CTA |
| **Bento grid feature showcase** | 2026 trend: modular layouts that make complex features scannable. Cards with micro-interactions | Med | None (new build) | Each card highlights one feature with hover animation. Better than linear "feature 1, feature 2" sections |

---

## Anti-Features

Features to explicitly NOT build for MVP. These are traps.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Full interactive sandbox on landing page** | Massively complex, slow to load, confusing without context. Kills mobile performance | 10-15 second auto-playing mini demo with fake data. Let the real product be the sandbox |
| **Multi-step signup wizard** | Every field you add loses 5-10% of signups. TikTok creators have zero patience | Email + password OR Google OAuth. Collect profile details AFTER first value moment |
| **Recurring affiliate commissions** | Accounting complexity, Whop integration overhead, payout tracking. Way too much for MVP | One-time bonus per successful referral. Simple. Clear. Easy to implement and understand |
| **Custom referral program outside Whop** | Building your own affiliate tracking is a months-long project. Cookie tracking, attribution, fraud prevention | Use Whop's built-in affiliate system for Whop-tracked referrals. Build lightweight in-app tracking ONLY for Virtuna-specific bonuses |
| **A/B testing framework on landing page** | Premature optimization. You need traffic first. A/B testing with < 1000 visitors is noise | Ship one strong version. Iterate based on actual user feedback and analytics. Add A/B testing after 5K+ monthly visitors |
| **Email drip campaigns for onboarding** | Requires email infrastructure, content creation, timing logic. Low ROI at launch scale | In-app onboarding only for MVP. Add email sequences after proving in-app activation works |
| **Video walkthroughs/tutorials** | Production cost, maintenance burden, goes stale fast as UI changes | Tooltip-based contextual guidance that's always current. Text + interactive beats video for SaaS onboarding |
| **Trending page** | Already decided to remove. Unfocused, hard to maintain, not core to value prop | Focus on hive visualization + analysis as the core differentiator |
| **Leaderboard/social referral mechanics** | Gamification beyond basics adds complexity, potential for gaming, community management overhead | Simple referral dashboard with personal stats only. No competition element for MVP |
| **Plan switching (downgrade from Pro to Starter)** | Edge case complexity. Proration logic, feature access transitions, Whop plan migration | For MVP: upgrade only. Downgrade = cancel. Revisit when churn data warrants it |

---

## Feature Dependencies

```
Landing Page (new)
  |-- Interactive Demo --> depends on: existing Canvas hive viz (network-visualization.tsx)
  |-- Pricing Section --> depends on: Whop plan IDs configured
  |-- "Start Trial" CTA --> depends on: Whop checkout embed (existing @whop/checkout)

Onboarding Flow (new)
  |-- Welcome Screen --> depends on: Auth flow (existing Supabase Auth)
  |-- Checklist Steps --> depends on: Dashboard features (existing)
  |-- First-Visit Tooltips --> depends on: NextStepjs library (new dependency)
  |-- Goal Selection --> depends on: User profile storage (existing creator_profiles)

Payments/Trial (mostly existing, needs wiring)
  |-- Trial Configuration --> depends on: Whop dashboard setup (no code)
  |-- Trial Countdown UI --> depends on: Subscription data API (existing /api/subscription)
  |-- Upgrade Prompts --> depends on: FeatureGate (existing), CheckoutModal (existing)
  |-- Landing Page Checkout --> depends on: Landing page (new), Whop checkout embed (existing)

Referral Program (new, depends on payments)
  |-- Referral Link Generation --> depends on: Auth (existing), new referral_links table
  |-- Click Tracking --> depends on: affiliate_clicks table (existing schema!)
  |-- Conversion Attribution --> depends on: Whop webhooks (existing), affiliate_conversions table (existing schema!)
  |-- Bonus Payout --> depends on: wallet_transactions table (existing schema!), conversion tracking
  |-- Referral Dashboard UI --> depends on: Referral data, existing earnings-tab patterns

Key insight: The database schema for affiliate tracking ALREADY EXISTS
(affiliate_clicks, affiliate_conversions, wallet_transactions tables).
The referral program needs backend logic + UI, not schema design.
```

---

## MVP Recommendation

### Must Ship (Phase 1-2 Priority)

1. **Landing page with interactive hive demo** -- This is the front door. Without a converting landing page, nothing else matters. The mini hive visualization IS the unique selling point that no competitor has.

2. **Whop trial configuration + landing page checkout flow** -- Wire existing WhopCheckoutEmbed into new landing page pricing section. Configure 7-day Pro trial on Whop dashboard. Card upfront, auto-converts. The backend is already built.

3. **Progressive onboarding with checklist** -- Welcome screen, 3-5 step checklist, first-visit tooltips. This is the bridge between "signed up" and "activated." Without it, trial users churn before seeing value. Target: first value moment within 3 minutes.

4. **Basic referral program** -- Unique links, click tracking, one-time bonus on conversion. Leverages existing DB schema. Simple but effective. Show referral CTA after "aha moment" (first analysis complete).

### Defer to Post-MVP

- **Email onboarding sequences** -- In-app guidance first, email later
- **Advanced referral analytics** -- Basic stats are enough. Deep analytics after 100+ referrers
- **Personalized landing page variants** -- One strong page first, personalization at scale
- **Plan downgrade flows** -- Upgrade only for MVP
- **Referral leaderboards/tiers** -- Simple flat bonus. Tiers after proving PMF

### Complexity Budget

| Feature Area | Estimated Effort | Confidence |
|-------------|-----------------|------------|
| Landing page (full rebuild) | 3-5 days | HIGH -- straightforward Next.js page, existing design system |
| Interactive hive demo (mini) | 2-3 days | MEDIUM -- need to create lightweight version of existing viz |
| Onboarding flow | 2-3 days | HIGH -- standard patterns, existing UI primitives |
| Tooltip system (NextStepjs) | 1 day | HIGH -- library handles the hard parts |
| Trial checkout integration | 0.5-1 day | HIGH -- WhopCheckoutEmbed already works, just needs landing page CTA |
| Trial countdown UI | 0.5 day | HIGH -- existing subscription API provides the data |
| Referral link generation + tracking | 2-3 days | MEDIUM -- DB schema exists but needs backend logic |
| Referral dashboard UI | 1-2 days | HIGH -- reuse existing earnings-tab patterns |
| Referral bonus payout logic | 1-2 days | MEDIUM -- webhook integration + wallet crediting |

**Total estimated: 13-20 days** for full MVP launch feature set.

---

## Competitor Feature Matrix (TikTok Creator Tools)

Understanding what competitors charge and offer helps position Virtuna's features.

| Feature | Pentos ($99-$999/mo) | Exolyt ($199-$600/mo) | Virtuna ($19-$49/mo) | Table Stakes? |
|---------|---------------------|-----------------------|----------------------|---------------|
| Content performance analytics | Yes | Yes | Yes (via hive) | YES |
| Competitor tracking | Yes | Yes | Planned (not MVP) | No (differentiator) |
| Trend detection | Yes | Yes | Via hive visualization | YES for creator tools |
| Viral score/prediction | No | No | YES (core feature) | No -- DIFFERENTIATOR |
| Interactive visualization | No | No | YES (hive canvas) | No -- DIFFERENTIATOR |
| Hashtag tracking | Yes | Yes | Planned | Yes for analytics tools |
| Mobile-optimized | Partial | Partial | YES (mobile-first) | YES for creator audience |
| Free trial | Varies | No | 7-day Pro trial | Expected |
| Referral program | No | No | YES | No (growth lever) |
| Price point | $99-999/mo | $199-600/mo | $19-49/mo | N/A |

**Virtuna's positioning:** 10-20x cheaper than enterprise analytics tools, targeting individual creators (not agencies). The hive visualization and viral score prediction are genuine differentiators that no competitor offers. Price accessibility + unique UX = the moat.

---

## Sources

- [SaaS Landing Page Best Practices 2026 - Storylane](https://www.storylane.io/blog/saas-landing-pages-best-practices)
- [SaaS Landing Page Trends 2026 - SaaSFrame](https://www.saasframe.io/blog/10-saas-landing-page-trends-for-2026-with-real-examples)
- [High-Converting SaaS Landing Pages 2026 - SaaS Hero](https://www.saashero.net/design/enterprise-landing-page-design-2026/)
- [SaaS Landing Pages 2026 - fibr.ai](https://fibr.ai/landing-page/saas-landing-pages)
- [SaaS Onboarding Strategy - Userpilot](https://userpilot.com/blog/saas-onboarding-strategy/)
- [SaaS Onboarding Best Practices 2026 - sales-hacking.com](https://www.sales-hacking.com/en/post/best-practices-onboarding-saas)
- [Building Better SaaS Onboarding - Substack](https://ekofi.substack.com/p/building-better-saas-onboarding-flows)
- [SaaS Onboarding Examples - Appcues](https://www.appcues.com/blog/saas-user-onboarding)
- [Whop Embed Checkout Docs](https://docs.whop.com/payments/checkout-embed)
- [Whop Affiliate Program Docs](https://docs.whop.com/manage-your-business/growth-marketing/affiliate-program)
- [@whop/checkout npm](https://www.npmjs.com/package/@whop/checkout)
- [Trial Conversion Benchmarks 2026 - IdeaProof](https://ideaproof.io/questions/good-trial-conversion)
- [SaaS Free Trial Best Practices - Maxio](https://www.maxio.com/blog/saas-free-trials-7-best-practices-for-increased-conversions)
- [Trial-to-Paid Benchmarks - PulseAhead](https://www.pulseahead.com/blog/trial-to-paid-conversion-benchmarks-in-saas)
- [NextStepjs - Next.js Onboarding Library](https://nextstepjs.com/)
- [Onborda - Next.js Onboarding](https://www.shadcn.io/template/uixmat-onborda)
- [React Onboarding Libraries Comparison - UserGuiding](https://userguiding.com/blog/react-onboarding-tour)
- [Website Tooltips Guide 2026 - UserGuiding](https://userguiding.com/blog/website-tooltips)
- [SaaS Referral Programs 2026 - Refgrow](https://refgrow.com/blog/best-referral-programs)
- [SaaS Referral Program Guide - impact.com](https://impact.com/referral/saas-referral-program-guide/)
- [TikTok Analytics 2026 - AgencyAnalytics](https://agencyanalytics.com/blog/tiktok-analytics)
- [TikTok Analytics Tools 2026 - Sprout Social](https://sproutsocial.com/insights/tiktok-analytics-tools/)
- [TikTok Creator Metrics 2026 - InfluenceFlow](https://influenceflow.io/resources/tiktok-creator-metrics-the-complete-guide-to-tracking-analyzing-optimizing-your-performance-in-2026/)
