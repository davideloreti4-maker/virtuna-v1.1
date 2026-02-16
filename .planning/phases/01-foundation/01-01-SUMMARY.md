---
phase: 01-foundation
plan: 01
subsystem: auth
tags: [supabase, middleware, oauth, pkce, server-actions, next-auth]

# Dependency graph
requires: []
provides:
  - "Supabase middleware auth enforcement with deep link preservation"
  - "Login page at /login with email/password server action + Google OAuth"
  - "Signup page at /signup with email/password server action + Google OAuth"
  - "OAuth PKCE callback route at /auth/callback with referral cookie processing"
  - "Real AuthGuard client-side session check with full-page skeleton"
affects: [onboarding, payments, referrals, brand-deals]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server actions for auth form submissions (useActionState pattern)"
    - "Middleware auth redirects with ?next= deep link preservation"
    - "PKCE OAuth callback route with cookie-based session"

key-files:
  created:
    - "src/app/auth/callback/route.ts"
    - "src/app/(onboarding)/login/page.tsx"
    - "src/app/(onboarding)/login/login-form.tsx"
    - "src/app/(onboarding)/login/actions.ts"
    - "src/app/(onboarding)/signup/page.tsx"
    - "src/app/(onboarding)/signup/signup-form.tsx"
    - "src/app/(onboarding)/signup/actions.ts"
  modified:
    - "src/lib/supabase/middleware.ts"
    - "src/app/(onboarding)/layout.tsx"
    - "src/components/app/auth-guard.tsx"

key-decisions:
  - "Auth pages at (onboarding) route group /login and /signup, separate from old /auth/login and /auth/signup"
  - "Server actions with useActionState for form auth (not client-side Supabase calls)"
  - "Middleware redirects to /login (not landing page) for unauthenticated users"
  - "SIGNED_OUT event redirects to / (landing page)"
  - "getSession() for client-side check, getUser() for server-side middleware"

patterns-established:
  - "Auth form pattern: server component page + client component form + server action"
  - "Deep link pattern: middleware sets ?next= param, form preserves via hidden input, action redirects to it"
  - "Public path allowlist in middleware (isPublicPath) for auth bypass"

# Metrics
duration: 6min
completed: 2026-02-16
---

# Phase 1 Plan 1: Auth Foundation Summary

**Real Supabase auth with middleware redirect enforcement, login/signup server actions, Google OAuth PKCE, and deep link preservation via ?next= param**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-16T04:28:58Z
- **Completed:** 2026-02-16T04:35:00Z
- **Tasks:** 3/3
- **Files modified:** 10

## Accomplishments
- Middleware enforces auth on all protected routes, redirecting to /login?next= with deep link preservation
- Authenticated users on /login or /signup are auto-redirected to /dashboard
- Login and signup pages with server actions for email/password + Google OAuth button
- OAuth PKCE callback at /auth/callback exchanges code for session with referral cookie processing
- AuthGuard replaced with real Supabase session check (getSession + onAuthStateChange)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire middleware auth redirects + create OAuth callback route** - `44f9592` (feat)
2. **Task 2: Create auth pages (login + signup) with email/password and Google OAuth** - `fef2c76` (feat)
3. **Task 3: Replace mock AuthGuard with real session check in AppShell** - `20cce3b` (feat)

## Files Created/Modified
- `src/lib/supabase/middleware.ts` - Auth redirect enforcement with public/protected path matching and deep link ?next= param
- `src/app/auth/callback/route.ts` - PKCE OAuth code exchange with referral cookie processing
- `src/app/(onboarding)/layout.tsx` - Centered layout with Virtuna logo for auth pages
- `src/app/(onboarding)/login/page.tsx` - Server component login page with metadata
- `src/app/(onboarding)/login/login-form.tsx` - Client component with email/password form and Google OAuth
- `src/app/(onboarding)/login/actions.ts` - Server action for signInWithPassword
- `src/app/(onboarding)/signup/page.tsx` - Server component signup page with metadata
- `src/app/(onboarding)/signup/signup-form.tsx` - Client component with email/password/confirm form and Google OAuth
- `src/app/(onboarding)/signup/actions.ts` - Server action for signUp with email confirmation redirect
- `src/components/app/auth-guard.tsx` - Real session check with skeleton loading state

## Decisions Made
- **Auth pages in (onboarding) route group:** New pages at /login and /signup instead of modifying old /auth/login and /auth/signup. Old pages left intact (can be removed in cleanup).
- **Server actions with useActionState:** Used React 19's useActionState hook for form submissions instead of client-side Supabase calls. Provides better server-side validation and progressive enhancement.
- **Redirect to /login for unauth:** Middleware redirects unauthenticated users to /login (not landing page /) with ?next= deep link. More standard auth UX.
- **getSession vs getUser for client:** AuthGuard uses getSession() (faster, cached) for client-side check since middleware already validated server-side with getUser(). Server-side uses getUser() for security.
- **Signup redirects to login with message:** After signup, users go to /login?message=Check your email -- requires email confirmation before accessing the app.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Migrated referral cookie processing to new callback route**
- **Found during:** Task 1 (OAuth callback route creation)
- **Issue:** Plan didn't mention referral cookie logic, but the existing /api/auth/callback route had referral tracking. The new /auth/callback route needed this too since OAuth redirects would now point here.
- **Fix:** Copied referral cookie detection and referral_clicks insert logic from /api/auth/callback to /auth/callback/route.ts
- **Files modified:** src/app/auth/callback/route.ts
- **Verification:** Build passes, referral logic preserved
- **Committed in:** 44f9592 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for referral tracking continuity. No scope creep.

## Issues Encountered
- pnpm not available in shell PATH; used npm instead (functionally equivalent)
- Old auth pages at /auth/login and /auth/signup still exist alongside new /login and /signup -- no conflict since URLs are different, but cleanup recommended

## Next Phase Readiness
- Auth foundation complete -- all (app) routes protected by real Supabase middleware
- Login/signup pages functional at /login and /signup
- Deep links preserved through auth flow via ?next= param
- Ready for Phase 1 Plan 2 (sidebar/nav restructuring) and Phase 2 (onboarding flow)
- **Cleanup note:** Old /auth/login and /auth/signup pages can be removed once verified unnecessary

## Self-Check: PASSED

- All 7 created files exist on disk
- All 3 modified files exist on disk
- All 3 task commits found in git history (44f9592, fef2c76, 20cce3b)
- `npm run build` passes cleanly with no TypeScript errors

---
*Phase: 01-foundation*
*Completed: 2026-02-16*
