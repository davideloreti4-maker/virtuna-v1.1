# Architecture

**Analysis Date:** 2026-03-11

## Pattern Overview

**Overall:** Next.js App Router with route group segmentation + multi-layer prediction engine

**Key Characteristics:**
- Three route groups: `(app)` (authenticated dashboard), `(marketing)` (public pages), `(onboarding)` (auth/welcome)
- Server components by default, client components only when interactive (`"use client"` directive)
- Zustand for client-side UI state, TanStack Query for server state
- Supabase for auth, database (via RLS), and file storage
- AI prediction pipeline with wave-parallel architecture (Gemini + DeepSeek)
- SSE streaming for real-time analysis progress

## Layers

**Route Layer (Pages):**
- Purpose: Entry points for each URL, metadata, data fetching
- Location: `src/app/`
- Contains: `page.tsx` (server components), `*-client.tsx` (client wrappers), `layout.tsx`, `loading.tsx`, `error.tsx`
- Depends on: Components, Supabase server client
- Used by: Next.js router

**Component Layer:**
- Purpose: Reusable UI components organized by domain
- Location: `src/components/`
- Contains: Domain components (`app/`, `competitors/`, `trending/`, `hive/`, `landing/`), design system (`ui/`, `primitives/`), layout (`layout/`), motion (`motion/`)
- Depends on: Hooks, Stores, Utils, Types
- Used by: Route layer pages

**Hook Layer:**
- Purpose: Data fetching (TanStack Query) and shared stateful logic
- Location: `src/hooks/`
- Contains: Query hooks (`hooks/queries/`), custom hooks for accounts, subscriptions, video upload, clipboard, debounce
- Depends on: API routes (via fetch), Supabase client, Query keys
- Used by: Client components

**Store Layer:**
- Purpose: Client-side UI state management (Zustand)
- Location: `src/stores/`
- Contains: 8 stores for sidebar, test flow, societies, bookmarks, competitors, settings, onboarding, tooltips
- Depends on: Types, Supabase client (for onboarding persistence)
- Used by: Client components

**Library Layer:**
- Purpose: Business logic, utilities, external service clients
- Location: `src/lib/`
- Contains: Prediction engine (`engine/`), AI clients (`ai/`), Supabase helpers (`supabase/`), scraping (`scraping/`), payment (`whop/`), affiliate (`affiliate/`), mappers, schemas, utils
- Depends on: External APIs (Gemini, DeepSeek, Apify, Whop, CJ), Supabase
- Used by: API routes, hooks, components

**API Layer:**
- Purpose: Server-side endpoints for data operations
- Location: `src/app/api/`
- Contains: Route handlers organized by domain (analyze, trending, deals, settings, webhooks, cron)
- Depends on: Supabase (server + service clients), Engine pipeline, AI clients
- Used by: Client hooks via fetch

**Type Layer:**
- Purpose: Shared TypeScript type definitions
- Location: `src/types/`
- Contains: `database.types.ts` (Supabase generated), domain types (`test.ts`, `trending.ts`, `brand-deals.ts`, `settings.ts`, `society.ts`, `viral-results.ts`, `design-tokens.ts`)
- Depends on: Nothing
- Used by: All layers

## Data Flow

**Content Analysis (Primary Flow):**

1. User fills `ContentForm` (`src/components/app/content-form.tsx`) with text/URL/video
2. `DashboardClient` (`src/app/(app)/dashboard/dashboard-client.tsx`) calls `useAnalyze()` mutation
3. For video uploads: file uploaded to Supabase Storage via `useVideoUpload()` hook first
4. Mutation POSTs to `/api/analyze` (`src/app/api/analyze/route.ts`)
5. API validates auth + rate limits, then creates SSE stream
6. `runPredictionPipeline()` (`src/lib/engine/pipeline.ts`) runs 10-stage wave-parallel pipeline:
   - Wave 1 (parallel): Gemini analysis + Creator context + Rule scoring + Audio
   - Wave 2 (parallel): DeepSeek reasoning + Trend enrichment
7. `aggregateScores()` (`src/lib/engine/aggregator.ts`) combines all signals into final score
8. SSE events stream phase updates back to client (`event: phase`, `event: complete`)
9. Result persisted to `analysis_results` table, usage tracked in `usage_tracking`
10. `ResultsPanel` displays final `PredictionResult`

**Authentication Flow:**

1. Supabase middleware (`src/lib/supabase/middleware.ts`) runs on every request
2. Checks protected routes against `PROTECTED_PREFIXES` list
3. Redirects unauthenticated users to `/login` with deep link (`?next=`)
4. Redirects users without onboarding to `/welcome`
5. `(app)/layout.tsx` performs defense-in-depth server-side auth check
6. `AuthGuard` (`src/components/app/auth-guard.tsx`) provides client-side session monitoring

**Competitor Tracking:**

1. `/competitors` page (`src/app/(app)/competitors/page.tsx`) server-fetches from `user_competitors` + `competitor_profiles` + `competitor_snapshots` + `competitor_videos`
2. Data passed as props to `CompetitorsClient`
3. Server actions (`src/app/actions/competitors/`) handle add/remove/retry-scrape
4. Cron job (`src/app/api/cron/refresh-competitors/route.ts`) periodically scrapes via Apify

**State Management:**

- **Server state**: TanStack Query (`@tanstack/react-query`) for all API data. Query keys defined in `src/lib/queries/query-keys.ts`. Mutations invalidate relevant queries.
- **Client UI state**: Zustand stores for ephemeral UI state (sidebar open/close, test flow step, view mode). Some stores use `zustand/middleware/persist` for localStorage persistence.
- **Hydration pattern**: Stores that need localStorage data expose `_hydrate()` and `_isHydrated` for SSR-safe hydration via `useEffect`.

## Key Abstractions

**Prediction Pipeline:**
- Purpose: Multi-model AI content analysis with graceful degradation
- Files: `src/lib/engine/pipeline.ts`, `src/lib/engine/aggregator.ts`, `src/lib/engine/types.ts`
- Pattern: Wave-parallel execution with `timed()` wrapper for stage timing. Every non-critical stage catches errors and falls back to defaults with warnings. No stage is fatal.

**Supabase Client Trio:**
- Purpose: Three Supabase client patterns for different contexts
- Files: `src/lib/supabase/client.ts` (browser, RLS-scoped), `src/lib/supabase/server.ts` (server component, cookie-based), `src/lib/supabase/service.ts` (service role, bypasses RLS)
- Pattern: Use `createClient()` from `client.ts` in `"use client"` components. Use `createClient()` from `server.ts` in server components/pages. Use `createServiceClient()` from `service.ts` in API routes for admin operations.

**Query Key Factory:**
- Purpose: Namespaced cache keys for TanStack Query invalidation
- File: `src/lib/queries/query-keys.ts`
- Pattern: `queryKeys.trending.videos(category)` returns `["trending", "videos", category]`

**Hive Visualization:**
- Purpose: Canvas-based interactive node graph for content analysis visualization
- Files: `src/components/hive/HiveCanvas.tsx`, `src/components/hive/hive-layout.ts`, `src/components/hive/hive-renderer.ts`, `src/components/hive/hive-interaction.ts`
- Pattern: Memoized layout computation (`computeHiveLayout`) + imperative canvas rendering via refs + custom hooks for resize/animation/interaction. Uses d3-hierarchy and d3-quadtree for layout and hit detection.

**Design System (Two Tiers):**
- Purpose: UI component library with Raycast design language
- Files: `src/components/ui/` (base components: Button, Card, Dialog, Input, etc.), `src/components/primitives/` (Glass-prefixed higher-level primitives: GlassPanel, GlassInput, GlassPill, etc.)
- Pattern: Base `ui/` components use CVA for variants, Radix UI for accessibility primitives. `primitives/` layer adds glassmorphism styling. Both export via barrel `index.ts`.

## Entry Points

**Root Layout:**
- Location: `src/app/layout.tsx`
- Triggers: Every page load
- Responsibilities: HTML document setup, Inter font loading, global metadata, `globals.css` import

**App Layout:**
- Location: `src/app/(app)/layout.tsx`
- Triggers: Any `/(app)/*` route (dashboard, trending, competitors, settings, brand-deals, referrals)
- Responsibilities: Server-side auth check + redirect, wraps children in `Providers` (QueryClient) + `ToastProvider` + `AppShell` (sidebar + main)

**Middleware:**
- Location: `src/middleware.ts` (delegates to `src/lib/supabase/middleware.ts`)
- Triggers: Every non-static request
- Responsibilities: Supabase session refresh, protected route enforcement, referral cookie tracking, onboarding redirect

**Analyze API:**
- Location: `src/app/api/analyze/route.ts`
- Triggers: Content form submission
- Responsibilities: Auth, rate limiting, input validation, SSE stream setup, pipeline orchestration, DB persistence, usage tracking

## Error Handling

**Strategy:** Graceful degradation with warnings at pipeline level; fail-fast at API/auth level

**Patterns:**
- Pipeline stages: Every non-critical stage wrapped in try/catch with fallback values and `warnings[]` array. Sentry captures all errors.
- API routes: Top-level try/catch with Sentry reporting, returns structured JSON errors with HTTP status codes
- Auth: Middleware redirects to `/login`, server component redirects, client `AuthGuard` as final safety net
- Client mutations: `onError` callbacks in TanStack Query mutations update UI state (e.g., return to form)
- Rate limiting: HTTP 429 with tier info and reset time
- Input validation: Zod schemas (`AnalysisInputSchema`) + pre-parse manual checks for better error messages

## Cross-Cutting Concerns

**Logging:**
- Custom structured logger (`src/lib/logger.ts`) with `createLogger(bindings)` factory
- JSON output in production, pretty-printed in development
- Levels: debug/info/warn/error with `MIN_LEVEL` based on `NODE_ENV`
- Child loggers for scoped context: `log.child({ module: "pipeline" })`

**Validation:**
- Zod v4 schemas for API input validation (`src/lib/engine/types.ts`, `src/lib/schemas/competitor.ts`)
- Client-side validation in form components with manual checks

**Authentication:**
- Supabase Auth (email/password) with SSR cookie management
- Three-layer enforcement: middleware (primary) + server component check (defense-in-depth) + client AuthGuard (session monitoring)
- Service role client for admin/cron operations that bypass RLS

**Error Tracking:**
- Sentry (`@sentry/nextjs`) integrated via `next.config.ts` wrapper
- Instrumentation files: `src/instrumentation.ts`, `src/instrumentation-client.ts`
- Edge config: `sentry.edge.config.ts`, `sentry.server.config.ts`
- Breadcrumbs added at pipeline wave completion points

**Subscription/Tier Gating:**
- Whop integration for payments (`src/lib/whop/`)
- `useSubscription()` hook for client-side tier checks
- `TierGate` component (`src/components/tier-gate.tsx`) and `FeatureGate` (`src/components/ui/feature-gate.tsx`) for UI gating
- API-level rate limiting per tier in `/api/analyze`

---

*Architecture analysis: 2026-03-11*
