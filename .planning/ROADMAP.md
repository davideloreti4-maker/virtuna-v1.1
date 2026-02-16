# Roadmap: Virtuna MVP Launch

## Overview

Transform Virtuna from a design-system showcase into a conversion-ready SaaS product. Six phases take the existing Next.js app from mock auth and static pages to a real product with landing page, onboarding flow, Whop payments with 7-day Pro trial, referral program, and polished MVP. This is wiring and feature-building on top of an established codebase (78k+ LOC, 36 components, Supabase Auth, existing Whop infrastructure), not building from scratch.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Replace mock auth, restructure routes and sidebar navigation for MVP (completed 2026-02-16)
- [x] **Phase 2: Landing Page** - Conversion-optimized landing page with interactive hive demo and pricing (completed 2026-02-16)
- [x] **Phase 3: Onboarding** - Progressive post-signup flow with TikTok connect, goal selection, and tooltips (completed 2026-02-16)
- [x] **Phase 4: Payments** - Whop-powered subscriptions with 7-day Pro trial, tier gating, and trial UI (completed 2026-02-16)
- [x] **Phase 5: Referral** - In-product referral program with link generation, tracking, and one-time bonuses (completed 2026-02-16)
- [x] **Phase 6: Polish** - UI fixes, mobile responsiveness pass, OG tags, and dead code cleanup (completed 2026-02-16)
- [ ] **Phase 7: Wire TierGate** - Apply TierGate component to Pro-only features so Starter users see upgrade prompts (Gap Closure)
- [ ] **Phase 8: Dead Code & Process Cleanup** - Remove orphaned routes/exports, update FOUN-02 wording, create Phase 4 VERIFICATION.md (Gap Closure)

## Phase Details

### Phase 1: Foundation
**Goal**: Authenticated users interact with a real auth system, and the app structure reflects MVP scope (trending page kept, correct nav, proper route groups)
**Depends on**: Nothing
**File Ownership**: `src/components/auth-guard.tsx`, `src/middleware.ts`, `src/app/(marketing)/`, `src/app/(onboarding)/`, `src/app/(app)/`, `src/components/sidebar/`
**Requirements**: FOUN-01, FOUN-02, FOUN-03, FOUN-04, FOUN-05
**Success Criteria** (what must be TRUE):
  1. Unauthenticated user visiting /dashboard is redirected to the landing page (not shown a loading spinner forever)
  2. Authenticated user stays logged in across browser sessions without re-authenticating
  3. /trending is accessible and renders the existing trending page
  4. Sidebar navigation shows MVP pages (dashboard, trending, affiliate/earnings, pricing) with no dead links
  5. Route structure uses three groups: (marketing) for public pages, (onboarding) for post-signup, (app) for authenticated
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md -- Real Supabase auth (middleware redirects, login/signup pages, OAuth callback, AuthGuard replacement) (completed 2026-02-16)
- [x] 01-02-PLAN.md -- Restructure sidebar navigation for MVP (keep trending), create 404 page (completed 2026-02-16)

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
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md -- Fix CTA link targets + Raycast design language consistency (borders, text tokens) (completed 2026-02-16)
- [x] 02-02-PLAN.md -- Hive demo IntersectionObserver lazy loading (RAF pause when off-screen, battery optimization) (completed 2026-02-16)

### Phase 3: Onboarding
**Goal**: A new user who just signed up is routed to the onboarding flow at /welcome, sees goal-personalized dashboard content after completing onboarding, and gets contextual tooltips on their first dashboard visit
**Depends on**: Phase 1
**File Ownership**: `src/app/(onboarding)/`, `src/components/onboarding/`, `src/components/tooltips/`, `src/stores/tooltip-store.ts`
**Requirements**: ONBR-01, ONBR-02, ONBR-03, ONBR-04, ONBR-05, ONBR-06, ONBR-07, ONBR-08, ONBR-09
**Success Criteria** (what must be TRUE):
  1. First-time user after signup is routed to onboarding flow (not dropped on empty dashboard)
  2. User can enter their TikTok @handle manually and sees a personalized hive preview
  3. User picks a primary goal and their dashboard layout/focus reflects that choice
  4. Onboarding state persists across sessions (closing browser and returning resumes where they left off)
  5. First dashboard visit shows 3-4 contextual tooltips on key features; tooltips don't reappear after dismissal
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md -- First-time user routing (login + OAuth redirect to /welcome) + old auth page cleanup (completed 2026-02-16)
- [x] 03-02-PLAN.md -- Goal-personalized dashboard, tooltip completeness (4 tooltips), sidebar TikTok handle wiring (completed 2026-02-16)

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
- [x] 04-01-PLAN.md -- Auth-aware pricing CTAs, trial DB migration, webhook+API trial tracking (completed 2026-02-16)
- [x] 04-02-PLAN.md -- useSubscription hook, TierGate, TrialCountdown, UpgradePrompt, sidebar badge (completed 2026-02-16)
- [x] 04-03-PLAN.md -- Post-checkout tier refresh (polling on pricing + billing pages) (completed 2026-02-16)

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
**Plans**: 2 plans

Plans:
- [x] 05-01-PLAN.md — Fix middleware referral cookie persistence bug + RLS INSERT policy for referral_clicks (completed 2026-02-16)
- [x] 05-02-PLAN.md — Update sidebar nav to referrals link + full build verification (completed 2026-02-16)

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
  6. Trending page included in mobile responsiveness pass
**Plans**: 3 plans

Plans:
- [x] 06-01-PLAN.md -- OG metadata fix, marketing OG image, brand-deals redirect, middleware cleanup, dashboard mobile fix (completed 2026-02-16)
- [x] 06-02-PLAN.md -- Dead code deletion (landing components, test pages, visualization, effects, motion), societies.io comment cleanup (completed 2026-02-16)
- [x] 06-03-PLAN.md -- Gap closure: mobile responsiveness audit + PLSH-01 compliance verification (skeleton, cards, buttons) (completed 2026-02-16)

### Phase 7: Wire TierGate
**Goal**: Starter users are blocked from Pro-only features and shown an upgrade prompt — paying for Pro provides clear feature differentiation
**Depends on**: Phase 4, Phase 6
**File Ownership**: `src/components/tier-gate.tsx`, `src/app/(app)/dashboard/`, `src/app/(app)/referrals/`, feature pages with Pro gating
**Requirements**: PAY-06
**Gap Closure**: Closes PAY-06 (requirement) + Tier Gating (flow) from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. At least 2-3 features are wrapped in TierGate and show upgrade prompt for Starter/Free users
  2. Pro users can access all gated features without obstruction
  3. TierGate upgrade prompt links to /pricing for conversion
**Plans**: 2 plans

Plans:
- [ ] 07-01-PLAN.md -- Gate referrals page behind Pro tier with FeatureGate + server-side getUserTier() + /pricing link fallback
- [ ] 07-02-PLAN.md -- Gate simulation results advanced sections (Variants, Insights, Themes) behind Pro tier with client-side TierGate

### Phase 8: Dead Code & Process Cleanup
**Goal**: Remove all orphaned code identified by audit, align requirement wording with implementation, and complete missing process artifacts
**Depends on**: Phase 7
**File Ownership**: `src/app/api/auth/callback/`, `src/app/api/referral/`, `src/lib/whop/config.ts`, `.planning/REQUIREMENTS.md`, `.planning/phases/04-payments/`
**Requirements**: FOUN-02 (wording update)
**Gap Closure**: Closes 3 integration gaps + 1 process gap from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. /api/auth/callback/route.ts deleted (orphaned duplicate)
  2. /api/referral/generate and /api/referral/stats routes deleted (unused)
  3. getTierFromPlanId export removed or consumed
  4. FOUN-02 requirement text updated to match /login redirect behavior
  5. Phase 4 VERIFICATION.md created with retroactive verification
**Plans**: TBD

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

### Wave 5 — Gap Closure (depends on Wave 4)
- Phase 7: Wire TierGate (needs Phase 4, Phase 6)
- Phase 8: Dead Code & Process Cleanup (needs Phase 7)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8
Waves 1-2 support parallel execution (see Execution Waves above).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/2 | ✓ Complete | 2026-02-16 |
| 2. Landing Page | 2/2 | ✓ Complete | 2026-02-16 |
| 3. Onboarding | 2/2 | ✓ Complete | 2026-02-16 |
| 4. Payments | 3/3 | ✓ Complete | 2026-02-16 |
| 5. Referral | 2/2 | ✓ Complete | 2026-02-16 |
| 6. Polish | 3/3 | ✓ Complete | 2026-02-16 |
| 7. Wire TierGate | 0/? | Pending | — |
| 8. Dead Code & Process | 0/? | Pending | — |

---
*Roadmap created: 2026-02-13*
*Depth: comprehensive (8 phases, 39 requirements)*
*Updated: 2026-02-16 — Added gap closure phases 7-8 from milestone audit*
