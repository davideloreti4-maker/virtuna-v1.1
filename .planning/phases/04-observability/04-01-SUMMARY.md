---
phase: 04-observability
plan: 01
subsystem: infra
tags: [sentry, error-tracking, nextjs, instrumentation, observability]

# Dependency graph
requires: []
provides:
  - "@sentry/nextjs SDK installed and configured"
  - "Server + edge + client Sentry init with runtime-conditional loading"
  - "onRequestError hook for Server Component and middleware error capture"
  - "withSentryConfig wrapper on next.config.ts for source map upload"
affects: [04-02, 05-testing, 06-hardening]

# Tech tracking
tech-stack:
  added: ["@sentry/nextjs@10.39.0"]
  patterns: ["Runtime-conditional Sentry init via instrumentation.ts register()"]

key-files:
  created:
    - sentry.server.config.ts
    - sentry.edge.config.ts
    - src/instrumentation.ts
    - src/instrumentation-client.ts
  modified:
    - next.config.ts
    - .env.example
    - package.json

key-decisions:
  - "Client-side tracesSampleRate set to 0 (backend-only milestone)"
  - "SENTRY_ORG/SENTRY_PROJECT use env vars, not hardcoded (graceful no-op without Sentry account)"
  - "Added onRouterTransitionStart export to suppress SDK warning"

patterns-established:
  - "Sentry 4-file manual setup: server config, edge config, instrumentation hook, client init"
  - "Environment-gated SDK init: Sentry no-ops when DSN is undefined"

# Metrics
duration: 2min
completed: 2026-02-18
---

# Phase 4 Plan 1: Sentry SDK Setup Summary

**@sentry/nextjs 10.39.0 installed with 4-file manual config: server/edge/client init and onRequestError instrumentation hook**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-18T11:03:32Z
- **Completed:** 2026-02-18T11:05:50Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Installed @sentry/nextjs SDK with runtime-conditional initialization
- Server Component and middleware errors captured via onRequestError hook
- next.config.ts wrapped with withSentryConfig for source map upload
- .env.example documents all Sentry env vars (DSN, org, project)
- Build succeeds cleanly with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @sentry/nextjs and create Sentry config files** - `7eec263` (feat)
2. **Task 2: Wrap next.config.ts with withSentryConfig and verify build** - `8ed25bb` (feat)

## Files Created/Modified
- `sentry.server.config.ts` - Sentry Node.js runtime init (server-side)
- `sentry.edge.config.ts` - Sentry Edge runtime init (middleware)
- `src/instrumentation.ts` - Next.js instrumentation hook with register() and onRequestError
- `src/instrumentation-client.ts` - Minimal client-side Sentry init (tracing disabled)
- `next.config.ts` - Wrapped with withSentryConfig for source map upload
- `.env.example` - Added NEXT_PUBLIC_SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT
- `package.json` - Added @sentry/nextjs dependency

## Decisions Made
- Client-side tracesSampleRate set to 0 because this milestone is backend-focused; client performance tracing deferred to future milestone
- SENTRY_ORG and SENTRY_PROJECT use process.env rather than hardcoded values so the build works without a Sentry account (source map upload silently skipped)
- Added onRouterTransitionStart export to instrumentation-client.ts to satisfy SDK requirement and suppress build warning

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added onRouterTransitionStart export**
- **Found during:** Task 2 (build verification)
- **Issue:** Sentry SDK v10.39 requires onRouterTransitionStart export from instrumentation-client.ts for navigation instrumentation
- **Fix:** Added `export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;` to instrumentation-client.ts
- **Files modified:** src/instrumentation-client.ts
- **Verification:** Build succeeds without the ACTION REQUIRED warning
- **Committed in:** 8ed25bb (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** SDK requirement for Next.js 16 navigation hooks. No scope creep.

## Issues Encountered
None

## User Setup Required

External service requires manual configuration for error tracking to be active:
- **NEXT_PUBLIC_SENTRY_DSN** - Required. Get from Sentry Dashboard > Settings > Projects > Client Keys (DSN)
- **SENTRY_ORG** - Optional. For source map upload during CI builds
- **SENTRY_PROJECT** - Optional. For source map upload during CI builds

Without NEXT_PUBLIC_SENTRY_DSN set, Sentry silently no-ops (no errors, no tracking).

## Next Phase Readiness
- Sentry SDK fully wired and ready for pipeline error capture in Phase 4 Plan 2
- Error boundaries and custom captureException calls can be added in subsequent plans
- Build verified clean

---
*Phase: 04-observability*
*Completed: 2026-02-18*
