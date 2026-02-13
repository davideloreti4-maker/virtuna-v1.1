# Codebase Concerns

**Analysis Date:** 2026-02-13

## Tech Debt

**Mock Data Layer:**
- Issue: Entire application uses mock data instead of real API/database calls. Auth, subscriptions, trending data, tests, societies all simulated.
- Files: `src/lib/mock-data.ts`, `src/lib/mock-brand-deals.ts`, `src/lib/trending-mock-data.ts` (863 lines), `src/lib/mock-societies.ts`, `src/components/app/auth-guard.tsx`, `src/stores/society-store.ts`, `src/stores/test-store.ts`
- Impact: Cannot ship to production without replacing ~15+ integration points. Users cannot actually use the product.
- Fix approach: Replace mock implementations with Supabase queries. Auth already has Supabase setup (`src/lib/supabase/`), need to wire to UI. Subscription system partially implemented (webhooks + DB schema exist), missing UI integration.

**localStorage Persistence Instead of Database:**
- Issue: Critical user data stored in browser localStorage (societies, test results) instead of database
- Files: `src/stores/society-store.ts` lines 9-46, `src/stores/test-store.ts` lines 11-65
- Impact: Users lose all data on browser clear, cannot access across devices, no backup, no analytics possible
- Fix approach: Replace zustand localStorage with Supabase queries. Schema needs tables for societies and test_results (currently missing).

**Large Component Files:**
- Issue: Several components exceed 500 lines, indicating poor separation of concerns
- Files: `src/components/ui/select.tsx` (954 lines), `src/app/(marketing)/showcase/page.tsx` (780 lines), `src/components/hive/use-hive-interaction.ts` (564 lines)
- Impact: Hard to maintain, test, and reason about. High cognitive load.
- Fix approach: Extract sub-components, split business logic from presentation. Select component especially should separate search, filtering, grouping logic.

**Deprecated Component Not Removed:**
- Issue: `mobile-nav.tsx` marked DEPRECATED (replaced in Phase 45), kept to avoid breaking imports
- Files: `src/components/app/mobile-nav.tsx` lines 1-6
- Impact: Technical debt accruing, unclear which imports are stale
- Fix approach: Global search for `MobileNav` imports, update to `SidebarToggle`, delete deprecated file

**Console Logging in Production Code:**
- Issue: 26 occurrences of console.log/warn/error in src/
- Files: `src/hooks/useCopyToClipboard.ts`, `src/app/api/cron/sync-whop/route.ts`, `src/app/api/webhooks/whop/route.ts`, `src/components/app/society-selector.tsx`, and 8 others
- Impact: Exposes internal state in production, performance overhead, potential security risk
- Fix approach: Replace with proper logging service (Sentry, LogRocket, or custom logger with environment checks)

**Type Safety Gaps:**
- Issue: Many files use "mock" or "placeholder" types that don't reflect real data structures
- Files: All mock data files (`src/lib/mock-*.ts`), `src/types/test.ts`, `src/types/viral-results.ts`
- Impact: When switching to real API, type mismatches will cause runtime errors
- Fix approach: Define API contract types first (from Supabase schema), then retrofit UI types to match

## Known Bugs

**ESLint Disable Comment:**
- Symptoms: One eslint-disable comment present
- Files: `src/components/hive/HiveCanvas.tsx` line 1
- Trigger: Linting rule violation being suppressed
- Workaround: Currently suppressed, likely a legitimate override for client directive

## Security Considerations

**Environment Variables Without Validation:**
- Risk: Missing env vars cause runtime crashes with non-descriptive errors
- Files: `src/lib/supabase/client.ts` lines 6-7 (uses `!` assertion), `src/lib/whop/config.ts` lines 16-17, `src/app/api/whop/checkout/route.ts` line 38
- Current mitigation: None - crashes on missing vars
- Recommendations: Add startup validation (fail fast with clear message), use zod schema for env vars, add `.env.local.example` documentation

**Service Role Key Usage:**
- Risk: Service role key bypasses RLS, must only be used server-side
- Files: `src/app/api/webhooks/whop/route.ts` line 10, `src/app/api/cron/sync-whop/route.ts` line 9
- Current mitigation: Only used in API routes (server-side only), correct usage
- Recommendations: Document why service role is needed (webhook bypass RLS), add comment warnings

**Webhook Signature Verification:**
- Risk: Webhook endpoints must verify signatures to prevent spoofing
- Files: `src/app/api/webhooks/whop/route.ts` lines 33-43
- Current mitigation: `verifyWebhookSignature()` implemented and called
- Recommendations: Ensure `WHOP_WEBHOOK_SECRET` is set in production, add monitoring for failed verifications

**Cron Endpoint Authorization:**
- Risk: Cron sync endpoint could be triggered by unauthorized parties
- Files: `src/app/api/cron/sync-whop/route.ts` lines 30-38
- Current mitigation: Bearer token check with `CRON_SECRET`
- Recommendations: Use Vercel Cron's built-in auth header instead of custom secret, or add IP whitelist

**Missing Environment File:**
- Risk: `.env.local` not tracked, developer setup friction
- Files: `.env.local.example` exists
- Current mitigation: Example file documents required vars
- Recommendations: (Permission denied reading example, cannot verify completeness)

## Performance Bottlenecks

**Large Mock Data Files:**
- Problem: 863-line trending mock data loaded on every page
- Files: `src/lib/trending-mock-data.ts` (27,479 bytes)
- Cause: All 42 mock videos with full metadata loaded at module import
- Improvement path: Once real API integrated, paginate/lazy load. For now, code-split trending page to avoid loading on other routes.

**Select Component Complexity:**
- Problem: 954-line Select component re-renders heavily during search
- Files: `src/components/ui/select.tsx`
- Cause: Search, filtering, grouping all in one component without memoization
- Improvement path: Memoize filtered options, debounce search input, virtualize long lists

**Hive Canvas Rendering:**
- Problem: Complex D3 layout + canvas rendering could struggle with large datasets
- Files: `src/components/hive/hive-renderer.ts` (434 lines), `src/components/hive/use-hive-interaction.ts` (564 lines)
- Cause: Manual canvas rendering on every interaction, no optimization for unchanged nodes
- Improvement path: Implement dirty rectangles, only redraw changed regions, throttle interaction callbacks

**Zustand Store Hydration:**
- Problem: Store hydration from localStorage blocks render on every mount
- Files: `src/stores/society-store.ts` lines 54-65, `src/stores/test-store.ts` lines 93-102
- Cause: Synchronous localStorage read in store initialization
- Improvement path: Use zustand persist middleware, async hydration with suspense boundary

## Fragile Areas

**Tailwind v4 Color System:**
- Files: `src/app/globals.css` lines 13-36 (oklch declarations)
- Why fragile: Known issue in CLAUDE.md - "Very dark colors (L < 0.15) compile incorrectly in @theme. Use exact hex values for dark tokens."
- Safe modification: Always use hex for colors with L < 0.15. Test compiled CSS after any color changes.
- Test coverage: No automated visual regression tests for color accuracy

**CSS Build Caching:**
- Files: `.next/` directory, `node_modules/.cache/`
- Why fragile: Dev server aggressively caches CSS, changes don't appear without manual clear
- Safe modification: Kill dev server + clear `.next/` + `node_modules/.cache/` + browser cache after CSS changes (documented in CLAUDE.md line 27)
- Test coverage: Manual verification required

**Backdrop Filter Rendering:**
- Files: Glass effect components (see ARCHITECTURE.md)
- Why fragile: "Lightning CSS strips backdrop-filter" (CLAUDE.md line 26) - must use inline styles
- Safe modification: Never use `backdrop-blur-*` Tailwind classes, always `style={{ backdropFilter: 'blur(Xpx)' }}`
- Test coverage: Visual inspection required

**Subscription State Sync:**
- Files: `src/app/api/webhooks/whop/route.ts`, `src/app/api/cron/sync-whop/route.ts`
- Why fragile: Dual sync paths (webhook + cron) can create race conditions or stale data
- Safe modification: Webhook is source of truth, cron is fallback. Always use `upsert` not `update`. Check `updated_at` timestamp.
- Test coverage: No tests for webhook/cron race conditions

**Raycast Design System Constraints:**
- Files: All UI components, `src/app/globals.css`
- Why fragile: Strict design rules (6% borders, 10% hover, no color tinting) verified 2026-02-08. Deviating breaks visual consistency.
- Safe modification: Follow CLAUDE.md lines 33-47 exactly. Universal border: `white/[0.06]`, hover: `white/[0.1]`. Card radius: 12px, input/button radius: 8px.
- Test coverage: Manual design review, no automated visual tests

## Scaling Limits

**localStorage Size:**
- Current capacity: ~5-10MB browser limit
- Limit: Breaks when user creates >500 test results or >100 societies
- Scaling path: Migrate to Supabase (already configured), add pagination to history views

**Mock Simulation Timing:**
- Current capacity: Simulates 4-phase process with fixed 1s delays (4s total)
- Limit: User perception of "fake" if always exactly 4 seconds
- Scaling path: When implementing real AI, ensure variable timing. Add randomness +/- 500ms even in mock.

**Cron Sync Sequential Processing:**
- Current capacity: Processes subscriptions one-by-one
- Limit: With 1000+ subscriptions, sync could take 10+ minutes (rate limits, timeouts)
- Scaling path: Batch process in chunks of 100, parallelize Whop API calls, add cursor-based pagination

## Dependencies at Risk

**React 19.2.3 / Next.js 16.1.5:**
- Risk: Bleeding edge versions, potential instability
- Impact: RSC API changes, breaking updates
- Migration plan: Pin versions, test updates in isolated branch before upgrading

**Tailwind v4:**
- Risk: Still in beta (based on `@tailwindcss/postcss` package), breaking changes expected
- Impact: Color compilation bugs (already experiencing oklch issues), API changes
- Migration plan: Monitor Tailwind 4 changelog, prepare for migration to stable v4 or rollback to v3

**Supabase SSR (0.8.0):**
- Risk: Relatively new package, middleware API may change
- Impact: Auth flow breaks, session management issues
- Migration plan: Follow Supabase upgrade guides closely, test auth flows after upgrades

**Whop API Integration:**
- Risk: Third-party service, no SLA, API could change without notice
- Impact: Subscription system breaks, revenue impact
- Migration plan: Add error monitoring, implement retry logic, consider Stripe as fallback payment provider

## Missing Critical Features

**Real Authentication:**
- Problem: Auth is fully mocked (`src/components/app/auth-guard.tsx` lines 20-24 - always resolves to logged in)
- Blocks: Cannot have multi-user system, cannot persist data per user, cannot implement paid tiers

**Database Persistence:**
- Problem: No tables for societies, test results, user profiles (only subscriptions table exists)
- Blocks: Cannot launch product, users lose all work

**Error Boundaries:**
- Problem: No React error boundaries in app
- Blocks: Unhandled errors crash entire app instead of showing fallback UI

**Loading States for Real Data:**
- Problem: Loading states exist but only for mock 4s simulation
- Blocks: Real API calls may take longer, need proper Suspense boundaries and skeleton states

**Monitoring/Observability:**
- Problem: No error tracking (Sentry), no analytics, only console.log
- Blocks: Cannot debug production issues, cannot measure user behavior

**Rate Limiting:**
- Problem: No rate limiting on API routes
- Blocks: Vulnerable to abuse, DoS, cost overruns on Whop/Supabase

**Email Verification:**
- Problem: No email verification flow (Supabase supports it, not implemented in UI)
- Blocks: Fake accounts, poor user trust

## Test Coverage Gaps

**No Unit Tests:**
- What's not tested: Entire src/ directory (0 test files found)
- Files: All business logic, utilities, stores, components
- Risk: Refactoring breaks functionality undetected
- Priority: High - Start with critical paths: stores, mock-data utils, subscription logic

**No API Route Tests:**
- What's not tested: Webhook handlers, cron sync, checkout flow
- Files: `src/app/api/webhooks/whop/route.ts`, `src/app/api/cron/sync-whop/route.ts`, `src/app/api/whop/checkout/route.ts`
- Risk: Payment failures, subscription state corruption, webhook replay attacks undetected
- Priority: Critical - These handle money and user access

**No Integration Tests:**
- What's not tested: Auth flow, subscription upgrade flow, test creation flow
- Files: All user-facing flows
- Risk: Multi-step processes break silently
- Priority: High - Add Playwright tests for happy paths

**No Visual Regression Tests:**
- What's not tested: Design system compliance, Raycast aesthetic
- Files: All UI components, especially glass effects and color tokens
- Risk: CSS changes break visual design, Tailwind v4 oklch bugs go unnoticed
- Priority: Medium - Chromatic or Percy for critical pages

**Extraction Tests Not in CI:**
- What's not tested: Extraction tests exist (`extraction/tests/*.spec.ts`) but separate from main test suite
- Files: `extraction/` directory (35+ test files), `extraction/playwright.config.ts`
- Risk: Tests drift from actual implementation, rot over time
- Priority: Medium - Integrate into CI, or document as design reference only

---

*Concerns audit: 2026-02-13*
