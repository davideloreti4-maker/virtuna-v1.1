# Requirements — Virtuna v1.6

**Defined:** 2026-02-02
**Core Value:** Creator monetization hub with Revolut-style wallet and tier-gated brand deals

## v1.6 Requirements

### Wallet (WALT)

- [ ] **WALT-01**: User can view current balance (large, prominent display)
- [ ] **WALT-02**: User can view transaction history (sortable, filterable list)
- [ ] **WALT-03**: User can distinguish pending vs available balance
- [ ] **WALT-04**: User can withdraw earnings to bank account
- [ ] **WALT-05**: User can view earnings breakdown by source/deal
- [ ] **WALT-06**: User can see payment status indicators (paid, pending, processing, failed)
- [ ] **WALT-07**: User can see earnings velocity ("You earned $X this week")

### Marketplace (MRKT)

- [ ] **MRKT-01**: User can browse deals with filters (category, tier, compensation type)
- [ ] **MRKT-02**: User can view deal details (brand, compensation, requirements, deliverables)
- [ ] **MRKT-03**: User can apply to deals via application form
- [ ] **MRKT-04**: User can track deal status (applied, accepted, rejected, active, completed)
- [ ] **MRKT-05**: User can see compensation clearly (fixed amount, rev-share %, or hybrid)
- [ ] **MRKT-06**: User can see deal requirements (follower count, engagement, content type)
- [ ] **MRKT-07**: User can see brand information (logo, name, category)
- [ ] **MRKT-08**: User can see deliverables (content count, format, timeline)
- [ ] **MRKT-09**: User can see locked/unlocked status based on subscription tier
- [ ] **MRKT-10**: User can save/bookmark deals for later

### Tier Gating (TIER)

- [ ] **TIER-01**: Starter subscribers ($9/mo) can access affiliate deals only
- [ ] **TIER-02**: Pro subscribers ($29/mo) can access rev-share marketplace deals
- [ ] **TIER-03**: Locked deals show "Upgrade to Pro" CTA with clear value proposition

### Affiliate System (AFFL)

- [ ] **AFFL-01**: Virtuna affiliate program displayed prominently (highest commission tier)
- [ ] **AFFL-02**: User can generate affiliate links for available programs
- [ ] **AFFL-03**: System tracks clicks and conversions for affiliate links
- [ ] **AFFL-04**: User can see affiliate performance metrics (clicks, conversions, earnings)

### Deal Management (DEAL)

- [ ] **DEAL-01**: Admin can manually add/edit/remove deals
- [ ] **DEAL-02**: Deals have structured data (compensation, requirements, brand, deliverables, tier)
- [ ] **DEAL-03**: Deals can be marked as active/paused/expired

### User Experience (UX)

- [ ] **UX-01**: User can see eligibility status before applying ("You qualify" / "Requires Pro")
- [ ] **UX-02**: User sees confirmation after submitting application
- [ ] **UX-03**: User can view "My Deals" — all applications and active deals in one place
- [ ] **UX-04**: User can mark deal deliverables as complete
- [ ] **UX-05**: User receives notifications (application accepted, payment received, deal status)

### Creator Profile (PROF)

- [ ] **PROF-01**: User can set up creator profile (social handles, follower counts, niches)
- [ ] **PROF-02**: User can connect social accounts for metric verification
- [ ] **PROF-03**: Creator metrics used for eligibility matching

### Navigation & Integration (NAV)

- [ ] **NAV-01**: Brand Deals accessible from app sidebar
- [ ] **NAV-02**: Wallet accessible from app sidebar or header
- [ ] **NAV-03**: Subscription tier displayed in relevant contexts
- [ ] **NAV-04**: My Deals accessible from sidebar or deals page

## v1.7+ Requirements (Deferred)

### Premium Tier
- **PREM-01**: Premium subscribers ($89/mo) can access fixed-pay deals
- **PREM-02**: Premium deals include product compensation

### Deal Aggregation
- **AGGR-01**: Strackr API integration for 271+ affiliate networks
- **AGGR-02**: Automated deal sync and updates
- **AGGR-03**: External network conversion tracking

### Advanced Features
- **ADV-01**: Match score ("92% fit for your audience")
- **ADV-02**: Projected earnings based on pipeline
- **ADV-03**: Tax preparation export (CSV/PDF)
- **ADV-04**: Earnings goals/milestones

## Out of Scope

| Feature | Reason |
|---------|--------|
| Premium tier (fixed-pay deals) | Deferred to v1.7, focus on Starter + Pro first |
| Strackr/external aggregation | Defer until manual curation validates concept |
| Match scoring | Complex, requires audience analysis |
| Multi-currency payouts | Regulatory complexity, start with USD |
| Instant withdrawals | Premium payment rails, cash flow risk |
| Social leaderboards | Privacy concerns, unhealthy competition |
| Real-time chat with brands | Support burden, scope creep |
| Commission from creators | Aspire differentiates by NOT doing this |
| Full influencer CRM | Enterprise feature, not creator-focused |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| WALT-01 | Phase 27 | Pending |
| WALT-02 | Phase 27 | Pending |
| WALT-03 | Phase 27 | Pending |
| WALT-04 | Phase 27 | Pending |
| WALT-05 | Phase 27 | Pending |
| WALT-06 | Phase 27 | Pending |
| WALT-07 | Phase 27 | Pending |
| MRKT-01 | Phase 28 | Pending |
| MRKT-02 | Phase 28 | Pending |
| MRKT-03 | Phase 28 | Pending |
| MRKT-04 | Phase 28 | Pending |
| MRKT-05 | Phase 28 | Pending |
| MRKT-06 | Phase 28 | Pending |
| MRKT-07 | Phase 28 | Pending |
| MRKT-08 | Phase 28 | Pending |
| MRKT-09 | Phase 28 | Pending |
| MRKT-10 | Phase 28 | Pending |
| TIER-01 | Phase 29 | Pending |
| TIER-02 | Phase 29 | Pending |
| TIER-03 | Phase 29 | Pending |
| AFFL-01 | Phase 29 | Pending |
| AFFL-02 | Phase 29 | Pending |
| AFFL-03 | Phase 29 | Pending |
| AFFL-04 | Phase 29 | Pending |
| DEAL-01 | Phase 28 | Pending |
| DEAL-02 | Phase 25 | Pending |
| DEAL-03 | Phase 28 | Pending |
| UX-01 | Phase 30 | Pending |
| UX-02 | Phase 30 | Pending |
| UX-03 | Phase 30 | Pending |
| UX-04 | Phase 30 | Pending |
| UX-05 | Phase 30 | Pending |
| PROF-01 | Phase 26 | Pending |
| PROF-02 | Phase 26 | Pending |
| PROF-03 | Phase 26 | Pending |
| NAV-01 | Phase 30 | Pending |
| NAV-02 | Phase 30 | Pending |
| NAV-03 | Phase 30 | Pending |
| NAV-04 | Phase 30 | Pending |

**Coverage:**
- v1.6 requirements: 42 total
- Mapped to phases: 42
- Unmapped: 0

---
*Requirements defined: 2026-02-02*
*Last updated: 2026-02-02 — Phase assignments added (Phases 25-30)*
