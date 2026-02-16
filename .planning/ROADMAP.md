# Roadmap: Virtuna -- Platform Refinement

## Overview

Comprehensive UI/UX refinement across the Virtuna platform (excluding dashboard). This milestone fixes broken flows, polishes visuals, completes unfinished pages, and ensures every user-facing element works correctly. Six phases organized by page/area, with sidebar first (affects all app pages), then parallel work across landing, trending, settings, referrals, and auth.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Sidebar & Navigation** - Fix sidebar design, navigation targets, and route integrity
- [ ] **Phase 2: Landing Page** - Polish spacing, typography, sections, and messaging
- [ ] **Phase 3: Trending Page** - Redesign layout and populate with meaningful content
- [ ] **Phase 4: Settings** - Wire up profile save, account actions, and notification preferences
- [ ] **Phase 5: Referrals & Brand Deals** - Polish referrals UI and replace dead brand deals route
- [ ] **Phase 6: Auth & Onboarding** - Polish signup, login, welcome flow, and error handling

## Phase Details

### Phase 1: Sidebar & Navigation
**Goal**: Every sidebar element is visually correct per brand bible and every button navigates to the right place
**Depends on**: Nothing (first phase -- foundation for all app pages)
**File Ownership**: `src/components/app/sidebar.tsx`, `src/components/app/sidebar-nav-item.tsx`, `src/components/app/sidebar-toggle.tsx`, `src/components/app/app-shell.tsx`, `src/app/(app)/layout.tsx`
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04, NAV-05
**Success Criteria** (what must be TRUE):
  1. Sidebar tokens (colors, spacing, borders, typography) match brand bible values when compared side-by-side
  2. Every sidebar nav item navigates to the correct page with no dead links or console errors
  3. Only one "Content Intelligence" / "Dashboard" entry exists in the sidebar (duplicate resolved)
  4. Clicking "Brand Deals" in sidebar loads a proper page (not a redirect to referrals)
  5. Sidebar visually harmonizes with the overall platform -- consistent with header, cards, and other chrome
**Plans**: 2 plans

Plans:
- [ ] 01-01: Sidebar visual overhaul + navigation restructure (solid dark, flush, coral indicators, remove Content Intelligence)
- [ ] 01-02: TikTok handle text input + visual verification (text input with Save, Supabase persistence, human checkpoint)

### Phase 2: Landing Page
**Goal**: Landing page communicates Virtuna's value clearly with polished visuals, accurate content, and professional presentation
**Depends on**: Nothing (separate marketing route group)
**File Ownership**: `src/app/(marketing)/page.tsx`, `src/components/landing/`, `src/components/layout/footer.tsx`
**Requirements**: LAND-01, LAND-02, LAND-03, LAND-04, LAND-05, LAND-06, LAND-07
**Success Criteria** (what must be TRUE):
  1. Landing page has consistent spacing, typography, and smooth animations throughout all sections
  2. Hero section has a clear value proposition and CTA buttons that route correctly (signup / login)
  3. Features section accurately describes what Virtuna does today (not aspirational features)
  4. Stats and social proof sections contain defensible numbers and authentic-feeling content
  5. FAQ answers real questions a TikTok creator would ask, and footer is polished with working links
**Plans**: 2 plans

Plans:
- [ ] 02-01: Hero, stats, and features redesign (prediction-focused messaging, capability stats, accurate features)
- [ ] 02-02: FAQ rewrite, CTA section, and minimal footer

### Phase 3: Trending Page
**Goal**: Trending page has a complete, designed layout with meaningful content that follows brand patterns
**Depends on**: Phase 1
**File Ownership**: `src/app/(app)/trending/page.tsx`, `src/components/app/` (trending-specific components if created)
**Requirements**: TREND-01, TREND-02, TREND-03, TREND-04
**Success Criteria** (what must be TRUE):
  1. Trending page displays a redesigned UI layout -- not a placeholder or skeleton
  2. Page shows meaningful mock content (video cards, categories, metrics) even without a live backend
  3. Trending page is reachable via sidebar navigation and back-navigates correctly
  4. Page uses brand bible design patterns (6% borders, 12px card radius, Inter font, coral accents)
**Plans**: TBD

Plans:
- [ ] 03-01: Trending page redesign and content population

### Phase 4: Settings
**Goal**: Settings page is fully functional -- profile saves to Supabase, account actions work, preferences persist
**Depends on**: Phase 1
**File Ownership**: `src/app/(app)/settings/page.tsx`, `src/components/app/settings/`
**Requirements**: SET-01, SET-02, SET-03, SET-04, SET-05, SET-06
**Success Criteria** (what must be TRUE):
  1. User can edit profile fields and save -- data persists in Supabase across page reloads
  2. User can change password and delete account with proper confirmation and error handling
  3. Notification preferences toggle and persist (to Supabase or localStorage)
  4. Team management section shows a clear "coming soon" state or functional placeholder
  5. Settings UI matches brand bible (correct tokens, spacing, input styling, card patterns)
**Plans**: TBD

Plans:
- [ ] 04-01: Profile save and account actions (Supabase integration)
- [ ] 04-02: Notifications, team section, and UI polish

### Phase 5: Referrals & Brand Deals
**Goal**: Referrals page is polished and brand deals has a proper page instead of a dead redirect
**Depends on**: Phase 1
**File Ownership**: `src/app/(app)/referrals/page.tsx`, `src/app/(app)/brand-deals/page.tsx`, `src/components/referral/`
**Requirements**: REF-01, REF-02, REF-03
**Success Criteria** (what must be TRUE):
  1. Referrals page has polished UI (consistent cards, proper spacing, working referral link display)
  2. Brand deals page shows Virtuna affiliate info and a "brand deals coming soon" section -- not a redirect
  3. No dead redirects remain between referrals and brand deals routes
**Plans**: TBD

Plans:
- [ ] 05-01: Referrals polish and brand deals page

### Phase 6: Auth & Onboarding
**Goal**: Auth and onboarding pages are visually polished with graceful error handling
**Depends on**: Nothing (separate onboarding route group)
**File Ownership**: `src/app/(onboarding)/login/`, `src/app/(onboarding)/signup/`, `src/app/(onboarding)/welcome/`, `src/components/onboarding/`
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):
  1. Signup page is visually polished (spacing, alignment, brand-consistent design)
  2. Login page is visually polished with matching quality to signup
  3. Welcome/onboarding flow transitions smoothly between steps without layout jumps
  4. Auth errors (wrong password, duplicate email, network failure) show clear, user-friendly messages
**Plans**: TBD

Plans:
- [ ] 06-01: Signup and login page polish
- [ ] 06-02: Onboarding flow and error state handling

## Execution Waves

Wave groupings for parallel team dispatch. Phases within a wave have no inter-dependencies.

### Wave 1 (completed)
- Phase 1: Sidebar & Navigation ✓

### Wave 2 (all unblocked — can run in parallel)
- Phase 2: Landing Page (no dependencies)
- Phase 3: Trending Page (Phase 1 done)
- Phase 4: Settings (Phase 1 done)
- Phase 5: Referrals & Brand Deals (Phase 1 done)
- Phase 6: Auth & Onboarding (no dependencies)

## Progress

**Execution Order:**
All remaining phases (2-6) can execute in parallel since Phase 1 is complete.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Sidebar & Navigation | 2/2 | ✓ Complete | 2026-02-16 |
| 2. Landing Page | 0/2 | Not started | - |
| 3. Trending Page | 0/1 | Not started | - |
| 4. Settings | 0/2 | Not started | - |
| 5. Referrals & Brand Deals | 0/1 | Not started | - |
| 6. Auth & Onboarding | 0/2 | Not started | - |

---
*Roadmap created: 2026-02-16*
*Last updated: 2026-02-16*
