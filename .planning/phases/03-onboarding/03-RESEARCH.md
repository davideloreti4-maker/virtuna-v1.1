# Phase 3: Onboarding - Research

**Researched:** 2026-02-16
**Domain:** Post-signup onboarding flow, state persistence, contextual tooltips
**Confidence:** HIGH

## Summary

Phase 3 is largely **already implemented**. The codebase contains working onboarding flow components (ConnectStep, GoalStep, PreviewStep), a Zustand store with dual persistence (localStorage + Supabase), contextual tooltips with localStorage persistence, and the database schema (onboarding_step, primary_goal, onboarding_completed_at columns on creator_profiles). The /welcome page orchestrates the 3-step flow and the dashboard already renders ContextualTooltip components.

The primary work for this phase is **verification, gap-filling, and wiring** rather than building from scratch. Key gaps identified: (1) the signup action redirects to /login for email confirmation instead of /welcome, so the post-signup-to-onboarding routing needs attention, (2) duplicate auth pages exist at both /auth/* (old) and /(onboarding)/* (new) -- the old ones need cleanup, (3) ONBR-05 (goal selection configures dashboard layout) has no implementation yet, (4) the tooltip store only has 3 tooltip IDs but the requirement asks for 3-4 key features.

**Primary recommendation:** Treat this phase as a "verify and wire" phase. Audit what exists, close the gaps (routing after signup, goal-to-dashboard wiring, tooltip completeness), and verify end-to-end flow rather than rebuilding.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | ^5.0.10 | Client state management (onboarding + tooltip stores) | Already in use, manual persist pattern established |
| @supabase/ssr | ^0.8.0 | Server-side Supabase client for middleware and server actions | Already in use for auth |
| @supabase/supabase-js | ^2.93.1 | Client-side Supabase for profile reads/writes | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next/navigation | 16.1.5 | useRouter for client-side redirect after onboarding | Already used in welcome page |
| lucide-react | ^0.563.0 | Icons for goal selection cards | Already used in GoalStep |
| framer-motion | ^12.29.3 | Step transition animations (if desired) | Available but not currently used in onboarding |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual Zustand persist | zustand/middleware persist | Built-in `persist` middleware handles localStorage + hydration automatically (see Architecture section), but existing manual pattern works fine and is already consistent across stores |
| Client-side onboarding routing | Middleware-based redirect | Middleware would require a DB query per request, too slow; client-side check in welcome page is correct |

**Installation:**
No additional packages needed -- all dependencies are already installed.

## Architecture Patterns

### Existing Project Structure
```
src/
├── app/(onboarding)/
│   ├── layout.tsx            # Minimal centered layout (logo + children)
│   ├── login/                # Login page + form + server action
│   ├── signup/               # Signup page + form + server action
│   └── welcome/page.tsx      # 3-step onboarding orchestrator
├── components/onboarding/
│   ├── connect-step.tsx      # TikTok @handle input (ONBR-02)
│   ├── goal-step.tsx         # Goal selection cards (ONBR-04)
│   └── preview-step.tsx      # Hive preview + "Go to Dashboard" (ONBR-03)
├── components/tooltips/
│   └── contextual-tooltip.tsx # Positioned tooltip with dismiss (ONBR-08)
├── components/hive-demo/
│   ├── hive-demo-canvas.tsx  # Lightweight 50-node canvas hive
│   └── hive-demo-data.ts     # Pre-computed node/link data
├── stores/
│   ├── onboarding-store.ts   # Step/handle/goal state + dual persist
│   └── tooltip-store.ts      # Dismissed tooltips + onboardingComplete flag
└── app/auth/                  # OLD auth pages (to be cleaned up)
    ├── layout.tsx
    ├── login/page.tsx
    ├── signup/page.tsx        # Still references /api/auth/callback
    └── callback/route.ts
```

### Pattern 1: Dual Persistence (localStorage + Supabase)
**What:** Onboarding state persists to both localStorage (immediate) and Supabase (durable). On hydration, localStorage loads first for instant UI, then Supabase data overwrites if newer.
**When to use:** When you need instant client-side state recovery AND cross-device persistence.
**Already implemented in:** `src/stores/onboarding-store.ts`

Key flow:
1. Store initializes with defaults (`step: "connect"`)
2. `_hydrate()` loads from localStorage
3. Welcome page `useEffect` fetches from Supabase and reconciles
4. Each mutation calls both `saveToStorage()` and `persistToSupabase()`

### Pattern 2: Onboarding Routing via Client-Side Check
**What:** Welcome page checks auth status on mount, fetches profile, redirects to dashboard if onboarding already complete.
**When to use:** When middleware-based routing would be too expensive (requires DB query per request).
**Already implemented in:** `src/app/(onboarding)/welcome/page.tsx`

Key flow:
1. User signs up -> redirected to /welcome
2. Welcome page calls `supabase.auth.getUser()`
3. If no user -> redirect to /
4. Upserts creator_profiles row (ensures it exists)
5. Fetches onboarding state from DB
6. If `onboarding_completed_at` is set -> redirect to /dashboard
7. Otherwise, restores step/handle/goal from DB

### Pattern 3: Tooltip Visibility via Store Flag
**What:** Tooltips only show after `onboardingComplete` flag is true AND tooltip ID is not in `dismissedTooltips` array.
**When to use:** When tooltips should only appear after a prerequisite flow completes.
**Already implemented in:** `src/stores/tooltip-store.ts` + `src/components/tooltips/contextual-tooltip.tsx`

Key flow:
1. Dashboard hydrates tooltip store
2. Dashboard sets `onboardingComplete = true` (currently happens on every dashboard visit)
3. `isTooltipVisible(id)` returns `onboardingComplete && !dismissedTooltips.includes(id)`
4. Dismiss writes to localStorage

### Anti-Patterns to Avoid
- **Middleware DB queries for onboarding redirect:** Middleware runs on every request. Querying Supabase for `onboarding_completed_at` in middleware would add latency to every page load. The existing client-side check in the welcome page is correct.
- **Zustand persist middleware with SSR:** The built-in `persist` middleware can cause hydration mismatches in Next.js SSR because localStorage state differs from server-rendered state. The project's manual `_hydrate()` pattern avoids this by explicitly deferring hydration to `useEffect`.
- **Overwriting DB with stale localStorage:** The welcome page correctly checks DB first and only uses localStorage as fallback, not the other way around.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Step persistence | Custom sync logic | Existing dual-persist pattern in onboarding-store | Already handles localStorage + Supabase with proper reconciliation |
| Tooltip positioning | Custom absolute positioning math | Existing ContextualTooltip component | Already handles top/bottom/left/right with arrow styles |
| Hive preview | Full HiveCanvas with physics | Existing HiveDemoCanvas | Lightweight 50-node pre-computed canvas, already used in preview-step |

**Key insight:** Almost everything for this phase is already built. The risk is in **not recognizing what exists** and rebuilding it, or in **not finding the gaps** between what exists and what the requirements demand.

## Common Pitfalls

### Pitfall 1: Signup Action Redirects to Login, Not Welcome
**What goes wrong:** The signup server action at `src/app/(onboarding)/signup/actions.ts` redirects to `/login?message=Check your email to confirm your account` after signup. This means a new user never sees /welcome automatically after signing up via email/password.
**Why it happens:** Email confirmation is required before login. The user must confirm their email, then log in, and only then would they reach /welcome.
**How to avoid:** The login action at `src/app/(onboarding)/login/actions.ts` redirects to the `next` form field value, which defaults to `/dashboard`. For first-time users, this should redirect to `/welcome` instead. Two options: (a) change the login default redirect to `/welcome` and let the welcome page redirect completed users to /dashboard, or (b) add onboarding check logic in the dashboard page to redirect incomplete users to /welcome.
**Warning signs:** New user signs up, confirms email, logs in, and lands on empty dashboard instead of onboarding.

### Pitfall 2: Duplicate Auth Pages (Old /auth/* Still Exists)
**What goes wrong:** Both `/auth/login`, `/auth/signup` (old) and `/login`, `/signup` (new, in (onboarding) route group) exist. The old pages reference `/api/auth/callback` (doesn't exist) and link to `/auth/login` instead of `/login`.
**Why it happens:** Phase 1 created new auth pages but didn't remove old ones (noted as pending todo in STATE.md).
**How to avoid:** Delete `src/app/auth/login/`, `src/app/auth/signup/`, `src/app/auth/layout.tsx` during this phase. Keep `src/app/auth/callback/route.ts` (still needed for OAuth).
**Warning signs:** Users hitting old auth pages with broken OAuth flow.

### Pitfall 3: ONBR-05 (Goal Configures Dashboard) Not Implemented
**What goes wrong:** User selects a goal during onboarding, but the dashboard looks identical regardless of which goal was chosen.
**Why it happens:** GoalStep saves `primary_goal` to Supabase, but no code reads it to configure the dashboard.
**How to avoid:** Define what "configures initial dashboard layout/focus" means concretely. For MVP, this could be as simple as: (a) different welcome message on dashboard based on goal, (b) different default filter pills selected, or (c) different suggested content in the context bar.
**Warning signs:** Success criterion 3 fails: "User picks a primary goal and their dashboard layout/focus reflects that choice."

### Pitfall 4: Tooltip onboardingComplete Flag Logic
**What goes wrong:** The dashboard currently sets `tooltipStore.setOnboardingComplete(true)` on every visit (line 63-67 of dashboard-client.tsx). This means tooltips show for ALL users on first dashboard visit, even those who skipped onboarding or have been using the app for weeks.
**Why it happens:** The flag is set unconditionally instead of checking if the user actually completed onboarding.
**How to avoid:** Only set `onboardingComplete = true` if the user has actually completed (or skipped) onboarding AND this is their first dashboard visit. Could check the Supabase `onboarding_completed_at` field.
**Warning signs:** Returning users who cleared localStorage see tooltips again.

### Pitfall 5: OAuth Callback Default Redirect
**What goes wrong:** The OAuth callback at `src/app/auth/callback/route.ts` defaults to redirecting to `/dashboard` (line 18: `const next = searchParams.get("next") ?? "/dashboard"`). For new OAuth users, this means they skip onboarding entirely.
**Why it happens:** The callback doesn't know if the user is new or returning.
**How to avoid:** After exchanging the OAuth code, check if a `creator_profiles` row exists for the user. If not, redirect to `/welcome` instead of `/dashboard`.
**Warning signs:** Users who sign up via Google OAuth never see the onboarding flow.

## Code Examples

Verified patterns from the existing codebase:

### Onboarding Store Dual Persistence
```typescript
// Source: src/stores/onboarding-store.ts (existing)
// Pattern: Write to localStorage synchronously, Supabase async
setStep: (step) => {
  const state = get();
  saveToStorage({ step, tiktokHandle: state.tiktokHandle, primaryGoal: state.primaryGoal });
  set({ step });
  persistToSupabase({ onboarding_step: step });
},
```

### Welcome Page Hydration from Supabase
```typescript
// Source: src/app/(onboarding)/welcome/page.tsx (existing)
// Pattern: Fetch DB state, reconcile with store, redirect if complete
const { data: profile } = await supabase
  .from("creator_profiles")
  .select("onboarding_step, onboarding_completed_at, tiktok_handle, primary_goal")
  .eq("user_id", user.id)
  .single();

if (profile?.onboarding_completed_at) {
  router.replace("/dashboard");
  return;
}
```

### Contextual Tooltip Usage
```typescript
// Source: src/app/(app)/dashboard/dashboard-client.tsx (existing)
// Pattern: Wrap target element with ContextualTooltip
<ContextualTooltip
  id="hive-viz"
  title="Your AI Society"
  description="This network shows AI personas interacting..."
  position="bottom"
>
  <HiveCanvas data={hiveData} className="h-full w-full" />
</ContextualTooltip>
```

### Zustand Persist Middleware (Alternative Pattern)
```typescript
// Source: Context7 /pmndrs/zustand - persist middleware docs
// NOTE: NOT currently used in this project. The manual _hydrate() pattern
// is preferred to avoid SSR hydration mismatches.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useStore = create(
  persist(
    (set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 })),
    }),
    { name: 'store-key' }, // localStorage key
  ),
)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mock AuthGuard with 350ms delay | Real Supabase auth (getUser) | Phase 1 (2026-02-16) | Onboarding can trust auth state is real |
| /auth/login, /auth/signup routes | /(onboarding)/login, /signup routes | Phase 1 (2026-02-16) | Onboarding layout shared with auth pages |
| No onboarding DB columns | onboarding_step, primary_goal, onboarding_completed_at | Migration 20260213 | Server-side persistence works |

**Deprecated/outdated:**
- `/auth/login` and `/auth/signup` pages: Superseded by `/(onboarding)/login` and `/(onboarding)/signup`. Should be deleted (layout + page files). Keep `/auth/callback/route.ts` for OAuth.
- `getSession()` for client-side auth: Decision [01-01] says use `getSession()` client-side, but the existing code correctly uses `supabase.auth.getUser()` everywhere. Supabase docs recommend `getUser()` as it validates the JWT.

## Gap Analysis (Requirement by Requirement)

| Requirement | Status | Gap |
|-------------|--------|-----|
| ONBR-01: Route to onboarding after signup | PARTIAL | Signup action redirects to /login (email confirm). OAuth callback defaults to /dashboard. Need first-time user routing. |
| ONBR-02: TikTok @handle input | DONE | ConnectStep exists with validation and skip |
| ONBR-03: Personalized hive preview | DONE | PreviewStep renders HiveDemoCanvas with @handle greeting |
| ONBR-04: Goal selection | DONE | GoalStep with 3 goals (monetization, viral_content, affiliate_revenue) |
| ONBR-05: Goal configures dashboard | NOT STARTED | GoalStep saves to DB but nothing reads primary_goal to customize dashboard |
| ONBR-06: Onboarding persists across sessions | DONE | Dual persist (localStorage + Supabase), welcome page reconciles on mount |
| ONBR-07: Skip/complete onboarding | DONE | skipOnboarding() and completeOnboarding() in store, skip buttons on each step |
| ONBR-08: Contextual tooltips | MOSTLY DONE | ContextualTooltip component exists, 2 tooltips placed (hive-viz, test-creation). Need 3-4 total per requirement, and "settings" tooltip is defined but not placed. |
| ONBR-09: Tooltip seen state persists | DONE | localStorage via tooltip-store with dismissedTooltips array |

### Summary of Gaps to Close
1. **Signup-to-onboarding routing** (ONBR-01): First-time users (both email and OAuth) need to reach /welcome
2. **Goal-to-dashboard wiring** (ONBR-05): Dashboard should reflect the chosen goal
3. **Third/fourth tooltip placement** (ONBR-08): Need 3-4 tooltips placed; currently 2 are wired
4. **Old auth page cleanup**: Delete /auth/login, /auth/signup, /auth/layout.tsx
5. **Tooltip onboardingComplete logic**: Should be tied to actual onboarding completion, not unconditional

## Open Questions

1. **What does "goal configures dashboard" mean concretely?**
   - What we know: GoalStep saves primary_goal (monetization | viral_content | affiliate_revenue) to Supabase
   - What's unclear: What dashboard changes per goal? Different widgets? Different default filters? Different welcome text?
   - Recommendation: For MVP, implement as a personalized welcome message or different suggested action in the context bar. Minimal scope -- don't rebuild the dashboard layout per goal.

2. **Where should the 3rd and 4th tooltips point?**
   - What we know: hive-viz and test-creation tooltips exist. "settings" tooltip ID is defined in tooltip-store but not placed.
   - What's unclear: The 4th tooltip target.
   - Recommendation: Place "settings" tooltip on sidebar Settings nav item. Add a 4th tooltip on the sidebar TikTok account selector ("Connect your TikTok account to unlock personalized insights").

3. **Should email confirmation users see onboarding before or after confirming?**
   - What we know: Current flow requires email confirmation before login, then login redirects to /dashboard.
   - What's unclear: Is this the intended flow? Most SaaS products let users proceed and confirm email later.
   - Recommendation: Keep current email-confirm-first flow. After login, redirect first-time users to /welcome instead of /dashboard. This avoids complexity of pre-confirmation onboarding.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/stores/onboarding-store.ts`, `src/stores/tooltip-store.ts`, `src/app/(onboarding)/welcome/page.tsx`, `src/components/onboarding/*.tsx`, `src/components/tooltips/contextual-tooltip.tsx`
- Database schema: `supabase/migrations/20260213000000_onboarding_columns.sql`, `src/types/database.types.ts`
- Middleware: `src/lib/supabase/middleware.ts`
- Context7 `/pmndrs/zustand` - persist middleware, skipHydration, custom storage
- Context7 `/websites/supabase` - SSR middleware patterns, auth session management
- Context7 `/vercel/next.js/v16.1.5` - middleware redirect patterns, route protection

### Secondary (MEDIUM confidence)
- STATE.md accumulated decisions (Phase 1 decisions [01-01], [01-02])
- ROADMAP.md Phase 3 plan descriptions

### Tertiary (LOW confidence)
- None -- all findings verified against codebase and official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and in use
- Architecture: HIGH - Patterns already implemented in codebase, verified by reading source
- Pitfalls: HIGH - Identified by reading actual code, not hypothetical
- Gap analysis: HIGH - Requirement-by-requirement comparison against existing code

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable -- no external API changes expected)
