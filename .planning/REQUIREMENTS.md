# Requirements: Virtuna MVP Launch

**Defined:** 2026-02-13
**Core Value:** AI-powered content intelligence that tells TikTok creators whether their content will resonate -- and connects them to monetization opportunities.
**Parallel milestone:** Backend Foundation (worktree at ~/virtuna-backend-foundation/) -- no file conflicts expected, re-run `supabase gen types` after merge.

## MVP Launch Requirements

Requirements for MVP launch. Each maps to roadmap phases.

### Foundation

- [ ] **FOUN-01**: App uses real Supabase auth verification (replace mock 350ms AuthGuard)
- [ ] **FOUN-02**: Unauthenticated users are redirected to landing page
- [ ] **FOUN-03**: Sidebar navigation updated for MVP pages (dashboard, trending, affiliate/earnings, pricing)
- [ ] **FOUN-04**: Trending page kept in navigation and accessible at /trending
- [ ] **FOUN-05**: Route groups structured: (marketing) public, (onboarding) post-signup, (app) authenticated

### Landing Page

- [ ] **LAND-01**: Hero section with clear value proposition and "Start free trial" CTA
- [ ] **LAND-02**: Interactive mini hive demo with lightweight rendering (≤50 nodes, pre-computed, no physics)
- [ ] **LAND-03**: Hive demo is mobile-optimized (no scroll blocking, touch-friendly, performant on mid-range devices)
- [ ] **LAND-04**: Features/benefits section showcasing key platform capabilities
- [ ] **LAND-05**: Social proof section (testimonials, metrics, or creator logos)
- [ ] **LAND-06**: FAQ section with common product questions
- [ ] **LAND-07**: Landing page follows Raycast design language (dark mode, coral accents, Inter font)
- [ ] **LAND-08**: Landing page is fully responsive (mobile-first, desktop-enhanced)

### Onboarding

- [ ] **ONBR-01**: User is routed to onboarding flow after first signup
- [ ] **ONBR-02**: TikTok connect step -- manual @handle input (no OAuth)
- [ ] **ONBR-03**: TikTok connect shows personalized hive preview after connection
- [ ] **ONBR-04**: Goal selection step -- user picks primary goal (brand deals / viral content / affiliate revenue)
- [ ] **ONBR-05**: Goal selection configures initial dashboard layout/focus
- [ ] **ONBR-06**: Onboarding state persists across sessions (Supabase, not just client)
- [ ] **ONBR-07**: User can skip/complete onboarding and access dashboard at any time
- [ ] **ONBR-08**: Contextual tooltips on first dashboard visit (3-4 key features, dismissible)
- [ ] **ONBR-09**: Tooltip "seen" state persists (Zustand + localStorage)

### Payments

- [ ] **PAY-01**: Standalone pricing page (/pricing) with Starter vs Pro feature comparison table
- [ ] **PAY-02**: Pricing page has CTA per tier linking to Whop checkout
- [ ] **PAY-03**: Whop embedded checkout modal for subscription purchase
- [ ] **PAY-04**: 7-day Pro trial with card upfront, auto-subscribes after trial
- [ ] **PAY-05**: Webhook handler correctly processes membership events (valid, invalid, payment_failed)
- [ ] **PAY-06**: TierGate component restricts Pro-only features for Starter users
- [ ] **PAY-07**: User's subscription tier is reflected in app UI (badge, tier label)
- [ ] **PAY-08**: Trial countdown UI shows days remaining in app
- [ ] **PAY-09**: Upgrade prompt shown near trial expiry
- [ ] **PAY-10**: Post-checkout tier refresh (user sees updated access without page reload)

### Referral

- [ ] **REF-01**: User can generate a unique referral link (?ref=CODE)
- [ ] **REF-02**: Referral link click is tracked (cookie set server-side, survives OAuth redirect)
- [ ] **REF-03**: Referral conversion attributed when referred user completes purchase via Whop
- [ ] **REF-04**: One-time bonus credited to referrer's account on successful conversion
- [ ] **REF-05**: Referral dashboard shows link, click count, conversions, and earnings
- [ ] **REF-06**: Referral data stored in dedicated tables (not brand-deal affiliate tables)

### Polish

- [ ] **PLSH-01**: Dashboard page UI polish (fix known issues: bg-white/5 card, button shadow, skeleton delays)
- [ ] **PLSH-02**: Affiliate/earnings page reworked from external brand deals to Virtuna referral focus
- [ ] **PLSH-03**: OG meta tags for social sharing (landing page, referral links)
- [ ] **PLSH-04**: Mobile responsiveness pass across all new and existing pages
- [ ] **PLSH-05**: Remove dead code and unused references from removed features

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
| FOUN-01 | Phase 1 | Pending |
| FOUN-02 | Phase 1 | Pending |
| FOUN-03 | Phase 1 | Pending |
| FOUN-04 | Phase 1 | Pending |

| FOUN-05 | Phase 1 | Pending |
| LAND-01 | Phase 2 | Pending |
| LAND-02 | Phase 2 | Pending |
| LAND-03 | Phase 2 | Pending |
| LAND-04 | Phase 2 | Pending |
| LAND-05 | Phase 2 | Pending |
| LAND-06 | Phase 2 | Pending |
| LAND-07 | Phase 2 | Pending |
| LAND-08 | Phase 2 | Pending |
| ONBR-01 | Phase 3 | Pending |
| ONBR-02 | Phase 3 | Pending |
| ONBR-03 | Phase 3 | Pending |
| ONBR-04 | Phase 3 | Pending |
| ONBR-05 | Phase 3 | Pending |
| ONBR-06 | Phase 3 | Pending |
| ONBR-07 | Phase 3 | Pending |
| ONBR-08 | Phase 3 | Pending |
| ONBR-09 | Phase 3 | Pending |
| PAY-01 | Phase 4 | Pending |
| PAY-02 | Phase 4 | Pending |
| PAY-03 | Phase 4 | Pending |
| PAY-04 | Phase 4 | Pending |
| PAY-05 | Phase 4 | Pending |
| PAY-06 | Phase 4 | Pending |
| PAY-07 | Phase 4 | Pending |
| PAY-08 | Phase 4 | Pending |
| PAY-09 | Phase 4 | Pending |
| PAY-10 | Phase 4 | Pending |
| REF-01 | Phase 5 | Pending |
| REF-02 | Phase 5 | Pending |
| REF-03 | Phase 5 | Pending |
| REF-04 | Phase 5 | Pending |
| REF-05 | Phase 5 | Pending |
| REF-06 | Phase 5 | Pending |
| PLSH-01 | Phase 6 | Pending |
| PLSH-02 | Phase 6 | Pending |
| PLSH-03 | Phase 6 | Pending |
| PLSH-04 | Phase 6 | Pending |
| PLSH-05 | Phase 6 | Pending |

**Coverage:**
- MVP Launch requirements: 39 total
- Mapped to phases: 39/39
- Unmapped: 0

---
*Requirements defined: 2026-02-13*
*Last updated: 2026-02-13 -- Traceability updated after roadmap creation*
