# Requirements Archive: mvp-launch MVP Launch

**Archived:** 2026-02-16
**Status:** SHIPPED

For current requirements, see `.planning/REQUIREMENTS.md`.

---

# Requirements: Virtuna MVP Launch

**Defined:** 2026-02-13
**Core Value:** AI-powered content intelligence that tells TikTok creators whether their content will resonate -- and connects them to monetization opportunities.
**Parallel milestone:** Backend Foundation (worktree at ~/virtuna-backend-foundation/) -- no file conflicts expected, re-run `supabase gen types` after merge.

## MVP Launch Requirements

Requirements for MVP launch. Each maps to roadmap phases.

### Foundation

- [x] **FOUN-01**: App uses real Supabase auth verification (replace mock 350ms AuthGuard) -- Phase 1
- [x] **FOUN-02**: Unauthenticated users are redirected to /login -- Phase 1 (updated wording in Phase 8)
- [x] **FOUN-03**: Sidebar navigation updated for MVP pages (dashboard, trending, affiliate/earnings, pricing) -- Phase 1
- [x] **FOUN-04**: Trending page kept in navigation and accessible at /trending -- Phase 1
- [x] **FOUN-05**: Route groups structured: (marketing) public, (onboarding) post-signup, (app) authenticated -- Phase 1

### Landing Page

- [x] **LAND-01**: Hero section with clear value proposition and "Start free trial" CTA -- Phase 2
- [x] **LAND-02**: Interactive mini hive demo with lightweight rendering (≤50 nodes, pre-computed, no physics) -- Phase 2
- [x] **LAND-03**: Hive demo is mobile-optimized (no scroll blocking, touch-friendly, performant on mid-range devices) -- Phase 2
- [x] **LAND-04**: Features/benefits section showcasing key platform capabilities -- Phase 2
- [x] **LAND-05**: Social proof section (testimonials, metrics, or creator logos) -- Phase 2
- [x] **LAND-06**: FAQ section with common product questions -- Phase 2
- [x] **LAND-07**: Landing page follows Raycast design language (dark mode, coral accents, Inter font) -- Phase 2
- [x] **LAND-08**: Landing page is fully responsive (mobile-first, desktop-enhanced) -- Phase 2

### Onboarding

- [x] **ONBR-01**: User is routed to onboarding flow after first signup -- Phase 3
- [x] **ONBR-02**: TikTok connect step -- manual @handle input (no OAuth) -- Phase 3
- [x] **ONBR-03**: TikTok connect shows personalized hive preview after connection -- Phase 3
- [x] **ONBR-04**: Goal selection step -- user picks primary goal (brand deals / viral content / affiliate revenue) -- Phase 3
- [x] **ONBR-05**: Goal selection configures initial dashboard layout/focus -- Phase 3
- [x] **ONBR-06**: Onboarding state persists across sessions (Supabase, not just client) -- Phase 3
- [x] **ONBR-07**: User can skip/complete onboarding and access dashboard at any time -- Phase 3
- [x] **ONBR-08**: Contextual tooltips on first dashboard visit (3-4 key features, dismissible) -- Phase 3
- [x] **ONBR-09**: Tooltip "seen" state persists (Zustand + localStorage) -- Phase 3

### Payments

- [x] **PAY-01**: Standalone pricing page (/pricing) with Starter vs Pro feature comparison table -- Phase 4
- [x] **PAY-02**: Pricing page has CTA per tier linking to Whop checkout -- Phase 4
- [x] **PAY-03**: Whop embedded checkout modal for subscription purchase -- Phase 4
- [x] **PAY-04**: 7-day Pro trial with card upfront, auto-subscribes after trial -- Phase 4
- [x] **PAY-05**: Webhook handler correctly processes membership events (valid, invalid, payment_failed) -- Phase 4
- [x] **PAY-06**: TierGate component restricts Pro-only features for Starter users -- Phase 4, Phase 7
- [x] **PAY-07**: User's subscription tier is reflected in app UI (badge, tier label) -- Phase 4
- [x] **PAY-08**: Trial countdown UI shows days remaining in app -- Phase 4
- [x] **PAY-09**: Upgrade prompt shown near trial expiry -- Phase 4
- [x] **PAY-10**: Post-checkout tier refresh (user sees updated access without page reload) -- Phase 4

### Referral

- [x] **REF-01**: User can generate a unique referral link (?ref=CODE) -- Phase 5
- [x] **REF-02**: Referral link click is tracked (cookie set server-side, survives OAuth redirect) -- Phase 5
- [x] **REF-03**: Referral conversion attributed when referred user completes purchase via Whop -- Phase 5
- [x] **REF-04**: One-time bonus credited to referrer's account on successful conversion -- Phase 5
- [x] **REF-05**: Referral dashboard shows link, click count, conversions, and earnings -- Phase 5
- [x] **REF-06**: Referral data stored in dedicated tables (not brand-deal affiliate tables) -- Phase 5

### Polish

- [x] **PLSH-01**: Dashboard page UI polish (fix known issues: bg-white/5 card, button shadow, skeleton delays) -- Phase 6
- [x] **PLSH-02**: Affiliate/earnings page reworked from external brand deals to Virtuna referral focus -- Phase 6
- [x] **PLSH-03**: OG meta tags for social sharing (landing page, referral links) -- Phase 6
- [x] **PLSH-04**: Mobile responsiveness pass across all new and existing pages -- Phase 6
- [x] **PLSH-05**: Remove dead code and unused references from removed features -- Phase 6, Phase 8

## Future Requirements

### External Brand Deals Marketplace

- **DEAL-01**: External brand deal listings from partner brands
- **DEAL-02**: Deal application and management flow
- **DEAL-03**: Brand deal earnings tracking

### Backend Intelligence

- **BACK-01**: AI viral prediction engine (Gemini Flash + DeepSeek R1)
- **BACK-02**: TikTok data pipeline (Apify scraping, trend classification)
- **BACK-03**: Real-time trend analysis

### Trending Page (Re-launch)

- **TRND-01**: Trending page with real backend data
- **TRND-02**: AI-classified trend categories

## Out of Scope

| Feature | Reason |
|---------|--------|
| Light mode | Dark-mode first, defer later |
| External brand deals | Handled by future marketplace milestone |
| AI prediction engine | Handled by backend-foundation milestone |
| TikTok OAuth | Manual @handle input is sufficient for MVP |
| Real-time chat/messaging | Not core to intelligence platform |
| Mobile native app | Web-first |
| Fake analysis preview on landing | Deferred -- hive demo is primary interactive element |
| Niche selection onboarding step | Deferred -- 3-step onboarding (TikTok, goal, tooltips) |
| Storybook | Showcase sufficient |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUN-01 | Phase 1 | Shipped |
| FOUN-02 | Phase 1, 8 | Shipped |
| FOUN-03 | Phase 1 | Shipped |
| FOUN-04 | Phase 1 | Shipped |
| FOUN-05 | Phase 1 | Shipped |
| LAND-01 | Phase 2 | Shipped |
| LAND-02 | Phase 2 | Shipped |
| LAND-03 | Phase 2 | Shipped |
| LAND-04 | Phase 2 | Shipped |
| LAND-05 | Phase 2 | Shipped |
| LAND-06 | Phase 2 | Shipped |
| LAND-07 | Phase 2 | Shipped |
| LAND-08 | Phase 2 | Shipped |
| ONBR-01 | Phase 3 | Shipped |
| ONBR-02 | Phase 3 | Shipped |
| ONBR-03 | Phase 3 | Shipped |
| ONBR-04 | Phase 3 | Shipped |
| ONBR-05 | Phase 3 | Shipped |
| ONBR-06 | Phase 3 | Shipped |
| ONBR-07 | Phase 3 | Shipped |
| ONBR-08 | Phase 3 | Shipped |
| ONBR-09 | Phase 3 | Shipped |
| PAY-01 | Phase 4 | Shipped |
| PAY-02 | Phase 4 | Shipped |
| PAY-03 | Phase 4 | Shipped |
| PAY-04 | Phase 4 | Shipped |
| PAY-05 | Phase 4 | Shipped |
| PAY-06 | Phase 4, 7 | Shipped |
| PAY-07 | Phase 4 | Shipped |
| PAY-08 | Phase 4 | Shipped |
| PAY-09 | Phase 4 | Shipped |
| PAY-10 | Phase 4 | Shipped |
| REF-01 | Phase 5 | Shipped |
| REF-02 | Phase 5 | Shipped |
| REF-03 | Phase 5 | Shipped |
| REF-04 | Phase 5 | Shipped |
| REF-05 | Phase 5 | Shipped |
| REF-06 | Phase 5 | Shipped |
| PLSH-01 | Phase 6 | Shipped |
| PLSH-02 | Phase 6 | Shipped |
| PLSH-03 | Phase 6 | Shipped |
| PLSH-04 | Phase 6 | Shipped |
| PLSH-05 | Phase 6, 8 | Shipped |

**Coverage:**
- MVP Launch requirements: 39 total
- Shipped: 39/39 (100%)

---
*Requirements defined: 2026-02-13*
*Archived: 2026-02-16 -- All 39 requirements shipped*
