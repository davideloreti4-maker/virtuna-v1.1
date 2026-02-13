# Roadmap: Virtuna MVP Launch

## Overview

Transform Virtuna from a design-system showcase into a conversion-ready SaaS product. Six phases take the existing Next.js app from mock auth and static pages to a real product with landing page, onboarding flow, Whop payments with 7-day Pro trial, referral program, and polished MVP. This is wiring and feature-building on top of an established codebase (78k+ LOC, 36 components, Supabase Auth, existing Whop infrastructure), not building from scratch.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Replace mock auth, remove trending page, restructure routes for MVP
- [ ] **Phase 2: Landing Page** - Conversion-optimized landing page with interactive hive demo and pricing
- [ ] **Phase 3: Onboarding** - Progressive post-signup flow with TikTok connect, goal selection, and tooltips
- [ ] **Phase 4: Payments** - Whop-powered subscriptions with 7-day Pro trial, tier gating, and trial UI
- [ ] **Phase 5: Referral** - In-product referral program with link generation, tracking, and one-time bonuses
- [ ] **Phase 6: Polish** - UI fixes, mobile responsiveness pass, OG tags, and dead code cleanup

## Phase Details

### Phase 1: Foundation
**Goal**: Authenticated users interact with a real auth system, and the app structure reflects MVP scope (no trending page, correct nav, proper route groups)
**Depends on**: Nothing
**File Ownership**: `src/components/auth-guard.tsx`, `src/middleware.ts`, `src/app/(marketing)/`, `src/app/(onboarding)/`, `src/app/(app)/`, `src/components/sidebar/`, trending page files (deletion)
**Requirements**: FOUN-01, FOUN-02, FOUN-03, FOUN-04, FOUN-05
**Success Criteria** (what must be TRUE):
  1. Unauthenticated user visiting /dashboard is redirected to the landing page (not shown a loading spinner forever)
  2. Authenticated user stays logged in across browser sessions without re-authenticating
  3. /trending returns 404 and no trending-related code exists in the codebase
  4. Sidebar navigation shows only MVP pages (dashboard, affiliate/earnings, pricing) with no dead links
  5. Route structure uses three groups: (marketing) for public pages, (onboarding) for post-signup, (app) for authenticated
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md -- Real Supabase auth (middleware redirects, login/signup pages, OAuth callback, AuthGuard replacement)
- [ ] 01-02-PLAN.md -- Remove trending route, restructure sidebar navigation for MVP, create 404 page

### Phase 2: Landing Page
**Goal**: A visitor lands on the homepage and immediately understands what Virtuna does, sees the hive demo in action, compares pricing tiers, and has a clear path to sign up
**Depends on**: Nothing
**File Ownership**: `src/app/(marketing)/page.tsx`, `src/app/(marketing)/pricing/`, `src/components/landing/`, `src/components/hive-demo/`
**Requirements**: LAND-01, LAND-02, LAND-03, LAND-04, LAND-05, LAND-06, LAND-07, LAND-08
**Success Criteria** (what must be TRUE):
  1. Landing page loads with hero, value proposition, and "Start free trial" CTA above the fold
  2. Interactive mini hive demo renders smoothly on mobile (no scroll blocking, no jank on mid-range devices)
  3. Features section, social proof section, and FAQ section are visible below the fold
  4. Pricing comparison table shows Starter vs Pro tiers with per-tier CTAs
  5. Entire page is responsive (mobile-first) and follows Raycast design language (dark mode, coral accents, Inter font)
**Plans**: TBD

Plans:
- [ ] 02-01: Hero section + features/benefits + social proof + FAQ
- [ ] 02-02: Lightweight hive demo component (50 nodes, pre-computed, mobile-optimized)
- [ ] 02-03: Pricing page with tier comparison and CTAs

### Phase 3: Onboarding
**Goal**: A new user who just signed up is guided through connecting TikTok, choosing a goal, and seeing their first personalized hive -- then gets contextual help on their first dashboard visit
**Depends on**: Phase 1
**File Ownership**: `src/app/(onboarding)/`, `src/components/onboarding/`, `src/components/tooltips/`, `src/stores/tooltip-store.ts`
**Requirements**: ONBR-01, ONBR-02, ONBR-03, ONBR-04, ONBR-05, ONBR-06, ONBR-07, ONBR-08, ONBR-09
**Success Criteria** (what must be TRUE):
  1. First-time user after signup is routed to onboarding flow (not dropped on empty dashboard)
  2. User can connect TikTok (OAuth or manual handle) and sees a personalized hive preview
  3. User picks a primary goal and their dashboard layout/focus reflects that choice
  4. Onboarding state persists across sessions (closing browser and returning resumes where they left off)
  5. First dashboard visit shows 3-4 contextual tooltips on key features; tooltips don't reappear after dismissal
**Plans**: TBD

Plans:
- [ ] 03-01: Onboarding flow (routing, TikTok connect step, goal selection step)
- [ ] 03-02: Onboarding persistence (Supabase state) + skip/complete logic
- [ ] 03-03: Contextual tooltips system (Zustand + localStorage persistence)

### Phase 4: Payments
**Goal**: Users can subscribe to Starter or Pro plans through Whop, start a 7-day Pro trial, and see their tier reflected throughout the app with Pro-only features gated
**Depends on**: Phase 1, Phase 2
**File Ownership**: `src/app/api/whop/`, `src/components/tier-gate.tsx`, `src/components/trial-countdown.tsx`, `src/components/upgrade-prompt.tsx`, `src/lib/whop/`, `src/hooks/use-subscription.ts`
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06, PAY-07, PAY-08, PAY-09, PAY-10
**Success Criteria** (what must be TRUE):
  1. User can click CTA on pricing page and complete checkout via Whop embedded modal
  2. 7-day Pro trial starts with card upfront and auto-subscribes after trial ends
  3. Webhook handler processes membership events (valid, invalid, payment_failed) and updates user tier in database
  4. Pro-only features are gated for Starter users (TierGate component shows upgrade prompt)
  5. User sees their subscription tier (badge/label) in app UI, trial countdown during trial, and upgrade prompt near expiry
**Plans**: 3 plans

Plans:
- [ ] 04-01-PLAN.md -- Auth-aware pricing CTAs, trial DB migration, webhook+API trial tracking
- [ ] 04-02-PLAN.md -- useSubscription hook, TierGate, TrialCountdown, UpgradePrompt, sidebar badge
- [ ] 04-03-PLAN.md -- Post-checkout tier refresh (polling on pricing + billing pages)

### Phase 5: Referral
**Goal**: Users can generate a referral link, share it, and earn a one-time bonus when referred users purchase a subscription
**Depends on**: Phase 4
**File Ownership**: `src/app/(app)/referrals/`, `src/components/referral/`, `src/app/api/referral/`, `supabase/migrations/` (referral tables)
**Requirements**: REF-01, REF-02, REF-03, REF-04, REF-05, REF-06
**Success Criteria** (what must be TRUE):
  1. User can generate a unique referral link from the referral dashboard
  2. Clicking a referral link sets a server-side cookie that survives the OAuth redirect chain
  3. When a referred user completes a Whop purchase, the referrer is credited a one-time bonus
  4. Referral dashboard shows link, click count, conversions, and total earnings
**Plans**: 3 plans

Plans:
- [ ] 05-01-PLAN.md — Database foundation (referral tables, code generation API, wallet integration)
- [ ] 05-02-PLAN.md — Cookie tracking through OAuth + webhook conversion attribution
- [ ] 05-03-PLAN.md — Referral dashboard UI (link card, stats, copy button)

### Phase 6: Polish
**Goal**: All pages are visually consistent, mobile-friendly, and free of dead code -- the app feels finished, not like a prototype
**Depends on**: Phase 1, Phase 2, Phase 3, Phase 4, Phase 5
**File Ownership**: `src/app/(app)/dashboard/`, `src/app/(app)/affiliate/`, `src/components/og/`, all pages (mobile pass)
**Requirements**: PLSH-01, PLSH-02, PLSH-03, PLSH-04, PLSH-05
**Success Criteria** (what must be TRUE):
  1. Dashboard fixes applied (card backgrounds, button shadows, skeleton delays use Suspense not hardcoded timers)
  2. Affiliate/earnings page reflects Virtuna referral program (not external brand deals)
  3. Sharing the landing page or a referral link on social media shows correct OG preview image and description
  4. All new and existing pages pass a mobile responsiveness check (no overflow, no tiny touch targets, no broken layouts)
  5. No dead imports, unused components, or references to removed features remain in the codebase
**Plans**: TBD

Plans:
- [ ] 06-01: Dashboard UI fixes + affiliate page rework
- [ ] 06-02: OG meta tags + mobile responsiveness pass + dead code cleanup

## Execution Waves

Wave groupings for parallel team dispatch. Phases within a wave have no inter-dependencies.

### Wave 1 (no dependencies)
- Phase 1: Foundation
- Phase 2: Landing Page

### Wave 2 (depends on Wave 1)
- Phase 3: Onboarding (needs Phase 1)
- Phase 4: Payments (needs Phase 1, Phase 2)

### Wave 3 (depends on Wave 2)
- Phase 5: Referral (needs Phase 4)

### Wave 4 (depends on all prior)
- Phase 6: Polish (needs Phases 1-5)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6
Waves 1-2 support parallel execution (see Execution Waves above).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/2 | Not started | - |
| 2. Landing Page | 0/3 | Not started | - |
| 3. Onboarding | 0/3 | Not started | - |
| 4. Payments | 0/3 | Not started | - |
| 5. Referral | 0/3 | Not started | - |
| 6. Polish | 0/2 | Not started | - |

---
*Roadmap created: 2026-02-13*
*Depth: comprehensive (6 phases, 39 requirements)*
