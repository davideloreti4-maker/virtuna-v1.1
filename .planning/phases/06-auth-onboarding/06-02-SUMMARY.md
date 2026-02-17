---
phase: 06-auth-onboarding
plan: 02
subsystem: ui, auth
tags: [onboarding, error-handling, ux-polish, supabase, server-actions]

# Dependency graph
requires:
  - phase: 06-auth-onboarding
    provides: "Polished login/signup pages with consistent card sizing (06-01)"
provides:
  - "Polished onboarding flow with pill step indicators, skeleton loading, min-height layout stability"
  - "User-friendly error mapping for login, signup, and OAuth callback"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline error mapping functions in server actions (mapLoginError, mapSignupError)"
    - "Skeleton loading state for client-hydrated pages"
    - "Min-height containers to prevent layout shifts between step transitions"

key-files:
  created: []
  modified:
    - "src/app/(onboarding)/welcome/page.tsx"
    - "src/components/onboarding/connect-step.tsx"
    - "src/components/onboarding/goal-step.tsx"
    - "src/components/onboarding/preview-step.tsx"
    - "src/app/(onboarding)/login/actions.ts"
    - "src/app/(onboarding)/signup/actions.ts"
    - "src/app/auth/callback/route.ts"

key-decisions:
  - "Inline error mapping per action file instead of shared utility (only 2 consumers)"
  - "Generic fallback message hides raw Supabase errors from users"
  - "Pill-shaped step indicators (h-1.5 w-8) for better visual progress feedback"
  - "320px min-height wrapper prevents card resize between onboarding steps"

patterns-established:
  - "Auth error mapping: lowercase-match Supabase error strings to user-friendly messages with generic fallback"
  - "Skeleton loading: glass-styled card shell with animate-pulse placeholders during hydration"

# Metrics
duration: 2min
completed: 2026-02-16
---

# Phase 6 Plan 2: Onboarding Polish & Auth Error Mapping Summary

**Polished onboarding flow with pill step indicators, skeleton hydration state, and user-friendly auth error messages replacing raw Supabase strings**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-16T18:30:08Z
- **Completed:** 2026-02-16T18:32:53Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Onboarding card sizing now matches auth pages (max-w-[400px], rounded-[12px], px-8 py-10)
- Pill-shaped step indicators replace dots for better visual progress feedback
- Min-height wrapper (320px) prevents card from resizing between steps
- Skeleton loading state during hydration instead of blank flash
- All auth errors mapped to clear, user-friendly messages across login, signup, and OAuth
- OAuth callback failures show "Sign-in was cancelled" / "Unable to complete sign-in" instead of "auth_callback_failed"

## Task Commits

Each task was committed atomically:

1. **Task 1: Polish onboarding flow with smooth transitions and consistent step styling** - `db2a2ae` (feat)
2. **Task 2: Map auth errors to user-friendly messages** - `a716e73` (feat)

## Files Created/Modified
- `src/app/(onboarding)/welcome/page.tsx` - Card sizing, pill indicators, min-height wrapper, skeleton loading
- `src/components/onboarding/connect-step.tsx` - Placeholder updated to @yourhandle format
- `src/components/onboarding/goal-step.tsx` - Subtle coral inset shadow on selected goal card
- `src/components/onboarding/preview-step.tsx` - Canvas height reduced to 240px, subtle bg for loading
- `src/app/(onboarding)/login/actions.ts` - mapLoginError function mapping Supabase errors to friendly messages
- `src/app/(onboarding)/signup/actions.ts` - mapSignupError function mapping Supabase errors to friendly messages
- `src/app/auth/callback/route.ts` - Human-readable error messages for OAuth failures

## Decisions Made
- Inline error mapping functions per action file (mapLoginError in login/actions.ts, mapSignupError in signup/actions.ts) instead of shared utility -- only 2 consumers, keeps colocation
- Generic fallback "Something went wrong. Please try again." instead of forwarding unknown Supabase errors
- Pill step indicators (h-1.5 w-8) instead of dots (h-2 w-2) for clearer progress visualization
- 320px min-height prevents layout jumps between steps with different content heights

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- AUTH-03 (smooth onboarding transitions) and AUTH-04 (user-friendly auth errors) are complete
- Phase 06 (Auth & Onboarding) is fully polished with both plans shipped
- All auth error paths produce clean, non-technical messages

## Self-Check: PASSED

All 7 modified files verified present. Both task commits (db2a2ae, a716e73) confirmed in git log.

---
*Phase: 06-auth-onboarding*
*Completed: 2026-02-16*
