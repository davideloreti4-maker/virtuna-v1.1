# Architecture Patterns

**Domain:** TikTok Creator Intelligence SaaS (MVP Launch Features)
**Researched:** 2026-02-13

## Recommended Architecture

The MVP launch features layer onto an existing Next.js 16 app with clear route group boundaries. The codebase already has substantial infrastructure -- the architecture adds new route groups and components without restructuring what exists.

### High-Level Structure

```
src/
  app/
    (marketing)/          <-- Landing page (public, SSR)
      page.tsx            <-- New landing page (replaces old societies.io clone)
      pricing/page.tsx    <-- Standalone pricing page
      invite/[code]/      <-- Referral landing variant
      layout.tsx          <-- Marketing layout (header + footer, no sidebar, no auth)

    (onboarding)/         <-- NEW: Post-signup onboarding (auth required, no sidebar)
      layout.tsx          <-- Minimal layout: logo + progress bar
      onboarding/page.tsx <-- Multi-step onboarding (step via searchParams)

    (app)/                <-- Authenticated app (existing)
      dashboard/          <-- Existing hive + new first-visit tooltips
      referrals/          <-- NEW: Referral dashboard page (replaces brand-deals)
      settings/           <-- Existing, billing section already built
      layout.tsx          <-- App shell with sidebar, auth guard

    api/
      whop/checkout/      <-- EXISTING: Checkout session creation
      webhooks/whop/      <-- EXISTING: Subscription lifecycle + NEW referral attribution
      subscription/       <-- EXISTING: Subscription status
      referral/           <-- NEW: Link generation, click tracking, stats
      cron/sync-whop/     <-- EXISTING: Membership sync fallback

  components/
    landing/              <-- REBUILD: Landing page sections (hero, pricing, demo, FAQ)
    onboarding/           <-- NEW: Welcome screen, step components, checklist
    referral/             <-- NEW: Link card, stats dashboard, share modal
    app/                  <-- EXISTING: App shell, sidebar, checkout modal, settings
    ui/                   <-- EXISTING: 36 design system primitives

  lib/
    whop/                 <-- EXISTING: Config, subscription, webhook verification
    referral/             <-- NEW: Code generation, attribution logic, bonus calculation
    supabase/             <-- EXISTING: Client creation

  stores/
    onboarding-store.ts   <-- NEW: Checklist state, tour completion (Zustand + persist)
    tooltip-store.ts      <-- NEW: Dismissed tooltip tracking (Zustand + persist)
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| Landing Page (marketing) | Convert visitors to trial signups | Whop checkout (API), referral tracking (read code from URL) |
| Onboarding System | Guide new users to activation | Supabase (persist progress), Zustand (UI state) |
| Contextual Tooltips | First-visit guidance on key features | Zustand store (dismissal state), Framer Motion (animations) |
| Referral System | Generate links, track clicks, attribute conversions, credit bonuses | Supabase (referral tables), Whop webhooks (conversion events) |
| Checkout Flow | Handle trial signup + upgrades | Whop API (sessions), existing CheckoutModal, referral cookie |
| Trial Countdown | Display urgency in-app | Subscription API (existing), app shell UI |
| Tier Gate | Control feature access by subscription | getUserTier() server-side, FeatureGate client-side (existing) |

### Data Flow

```
LANDING PAGE FLOW:
Visitor -> Landing Page -> "Start Free Pro Trial" CTA
  -> Auth (signup/login via Supabase)
  -> Middleware sets onboarding cookie = incomplete
  -> Redirect to /onboarding?step=1
  -> Complete onboarding steps
  -> Whop Checkout Embed (card capture + trial start)
  -> Webhook: membership.went_valid
  -> Supabase: user_subscriptions updated (tier=pro, status=trialing)
  -> Redirect to Dashboard with first-visit tooltips

REFERRAL FLOW:
User -> /referrals -> Copy referral link (virtuna.com/?ref=[code])
  -> Friend clicks link
  -> Middleware captures ?ref= -> sets server-side cookie (30 days)
  -> Friend browses landing page, clicks "Start Trial"
  -> Signs up + subscribes (referral code passed via checkout metadata)
  -> Webhook: membership.went_valid (check metadata for referral_code)
  -> AFTER first real payment (not trial start):
     -> Supabase: referral_conversions insert (status=credited)
     -> Supabase: wallet_transactions insert (bonus credit)
  -> Referrer sees updated stats on referral dashboard

ONBOARDING FLOW:
New user completes auth
  -> Middleware: no onboarding_complete cookie -> redirect to /onboarding
  -> Step 1: Welcome + goal selection ("What do you want to achieve?")
  -> Step 2: Connect TikTok handle (or skip)
  -> Step 3: First quick analysis preview
  -> Supabase: update creator_profiles.onboarding_completed_at
  -> Set onboarding_complete cookie
  -> Redirect to /dashboard
  -> Tooltip store: show first-visit tooltips (5-7 contextual tips)
  -> Each tooltip dismissed -> persisted in Zustand + localStorage
```

## Patterns to Follow

### Pattern 1: Server-First Landing Page

**What:** Render landing page sections as server components, lazy-load interactive elements.
**When:** All static content (hero text, pricing, FAQ, social proof).
**Why:** Sub-2-second load time. SEO indexable. Mobile performance critical (83% of visits).

```typescript
// app/(marketing)/page.tsx -- Server component (no "use client")
import { Suspense } from "react";
import { HeroSection } from "@/components/landing/hero-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { FAQSection } from "@/components/landing/faq-section";
import { DemoSkeleton } from "@/components/landing/demo-skeleton";

const InteractiveDemo = dynamic(
  () => import("@/components/landing/interactive-demo"),
  { ssr: false } // Canvas-based, client only
);

export default function LandingPage() {
  return (
    <main>
      <HeroSection />
      <Suspense fallback={<DemoSkeleton />}>
        <InteractiveDemo />
      </Suspense>
      <PricingSection />
      <FAQSection />
    </main>
  );
}
```

### Pattern 2: Referral Attribution via Checkout Metadata

**What:** Pass referral code through Whop checkout metadata + affiliateCode prop for dual tracking.
**When:** Referred user goes through checkout.
**Why:** Reliable server-side attribution. Not cookie-dependent for the critical conversion event.

```typescript
// api/whop/checkout/route.ts -- extend existing
const checkoutBody = {
  plan_id: whopProductId,
  metadata: {
    supabase_user_id: user.id,
    supabase_email: user.email,
    referral_code: referralCode ?? undefined, // From cookie
  },
  redirect_url: `${appUrl}/dashboard?checkout=success`,
};

// components/app/checkout-modal.tsx -- add affiliateCode prop
<WhopCheckoutEmbed
  sessionId={checkoutConfigId}
  theme="dark"
  skipRedirect
  affiliateCode={referralCode} // Dual tracking via Whop native system
  onComplete={handleComplete}
/>
```

### Pattern 3: Cookie + DB for Onboarding State

**What:** Set a server-side cookie when onboarding completes. Middleware reads cookie (fast). DB is source of truth (durable).
**When:** Any state that middleware needs to check on every request.
**Why:** Avoids DB round-trip in middleware for the common case (onboarding done). Cookie is cache, DB is truth.

```typescript
// middleware.ts
const onboardingComplete = request.cookies.get('onboarding_complete');
if (!onboardingComplete && isAppRoute) {
  return NextResponse.redirect(new URL('/onboarding', request.url));
}

// After onboarding completion (server action):
cookies().set('onboarding_complete', '1', {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  maxAge: 365 * 24 * 60 * 60, // 1 year
});
await supabase.from('creator_profiles')
  .update({ onboarding_completed_at: new Date().toISOString() })
  .eq('user_id', userId);
```

### Pattern 4: Zustand + localStorage for UI-Only State

**What:** Track tooltip dismissals and onboarding checklist in Zustand with localStorage persistence.
**When:** State that only affects UI display, not business logic. Fast reads, no server round-trip.
**Why:** Tooltips must appear/dismiss instantly. No reason to hit the DB for "user saw this tooltip."

```typescript
// stores/tooltip-store.ts
export const useTooltipStore = create<TooltipState>()(
  persist(
    (set, get) => ({
      dismissed: {} as Record<string, boolean>,
      dismiss: (id: string) =>
        set((s) => ({ dismissed: { ...s.dismissed, [id]: true } })),
      shouldShow: (id: string) => !get().dismissed[id],
    }),
    { name: "virtuna-tooltips" }
  )
);
```

### Pattern 5: Middleware for Referral Cookie Capture

**What:** Capture `?ref=` parameter in middleware and set a server-side cookie.
**When:** Any page visit with a ref param (landing page, pricing, invite).
**Why:** Server-set cookies survive Safari ITP (7-day limit on JS-set cookies). Must capture before auth redirect chain which loses URL params.

```typescript
// middleware.ts -- add at the top of middleware function
const ref = request.nextUrl.searchParams.get('ref');
if (ref) {
  response.cookies.set('virtuna_ref', ref, {
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
  });
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Checking Subscription Tier in Middleware

**What:** Querying user_subscriptions table in middleware on every request.
**Why bad:** Middleware runs on Edge runtime (limited APIs). DB queries add 50-200ms to every page load. Subscription changes infrequently. Also vulnerable to middleware bypass (CVE-2025-29927).
**Instead:** Fetch tier in server components via getUserTier(). For client display, use /api/subscription endpoint. Never use middleware as sole security layer.

### Anti-Pattern 2: Cookie-Only Referral Tracking

**What:** Relying solely on browser cookies for referral attribution.
**Why bad:** Cookies blocked by ITP/ETP, expire, don't survive cross-device. TikTok creators share links on mobile but friends may open on different devices.
**Instead:** Cookie for landing page persistence + checkout metadata for server-side attribution. Belt-and-suspenders.

### Anti-Pattern 3: Blocking Onboarding Modal

**What:** Full-screen modal that must be completed before accessing any feature.
**Why bad:** Forced tours have terrible completion rates. Power users and re-signups rage-quit.
**Instead:** Dedicated onboarding route with skip button. Once skipped/completed, never shown again (DB flag). Tooltips are independent and non-blocking.

### Anti-Pattern 4: Landing Page as Full Client Component

**What:** Making entire landing page "use client" for interactivity.
**Why bad:** Kills SEO, destroys mobile load time (< 2s target), unnecessary hydration.
**Instead:** Server components for 90% of page. Only interactive demo and checkout trigger are client components. Suspense boundaries around heavy elements.

### Anti-Pattern 5: Reusing Brand-Deal Tables for Referrals

**What:** Storing Virtuna user-to-user referrals in the existing affiliate_clicks/affiliate_conversions tables.
**Why bad:** Semantic confusion. `program_id`, `creator_id` don't map to referral concepts. Breaks if brand deals return later. Mixed data in analytics.
**Instead:** New `referral_links` + `referral_conversions` tables. Clean separation. Old tables preserved for future brand-deal feature.

## Routing Strategy

Three route groups with middleware-enforced boundaries:

```
(marketing)/    -- Public: landing, pricing, invite/[code], showcase
  layout.tsx    -- Header + Footer, no auth required

(onboarding)/   -- Auth required, no sidebar
  layout.tsx    -- Logo + progress indicator

(app)/          -- Auth required, full app shell
  layout.tsx    -- AuthGuard + Sidebar + ToastProvider
```

Middleware routing rules:
1. Always refresh Supabase session (existing)
2. Capture ?ref= param -> set server cookie (new)
3. Public routes: pass through (/, /pricing, /showcase, /login, /signup)
4. Auth check for everything else -> redirect to /login if no user
5. Onboarding check for app routes -> redirect to /onboarding if incomplete (cookie check, fast)

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| Referral tracking | Supabase direct queries | Add indexes on code, referrer_id | Read replicas or analytics pipeline |
| Landing page load | Server components sufficient | CDN caching, image optimization | Edge rendering, ISR |
| Whop webhooks | Sequential processing fine | Add idempotency via svix-id table | Queue-based processing |
| Onboarding state | DB + cookie, fine | Same | Same |
| Tooltip state | localStorage only, fine | Same | Same (client concern) |

For MVP (target: first 1000 users), the current architecture handles everything without modification.

## Sources

- Existing codebase analysis (api routes, components, database types, middleware)
- [Whop Checkout Embed Docs](https://docs.whop.com/payments/checkout-embed) -- affiliateCode prop, sessionId metadata
- [Whop Affiliate Program Docs](https://docs.whop.com/manage-your-business/growth-marketing/affiliate-program)
- [Next.js App Router Authentication Patterns](https://nextjs.org/docs/app/building-your-application/authentication)
- [Safari ITP Cookie Limitations](https://webkit.org/blog/category/privacy/)
- [Zustand persist middleware](https://zustand.docs.pmnd.rs/integrations/persisting-store-data)
