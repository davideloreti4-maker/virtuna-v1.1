# Codebase Structure

**Analysis Date:** 2026-03-11

## Directory Layout

```
virtuna-ui-dashboard/
├── src/
│   ├── app/                        # Next.js App Router pages + API
│   │   ├── layout.tsx              # Root layout (Inter font, globals.css)
│   │   ├── globals.css             # Design tokens + Tailwind v4 @theme
│   │   ├── middleware.ts           # → delegates to lib/supabase/middleware.ts
│   │   ├── error.tsx               # Global error boundary
│   │   ├── not-found.tsx           # 404 page
│   │   ├── (app)/                  # Authenticated dashboard routes
│   │   │   ├── layout.tsx          # Auth check + Providers + AppShell
│   │   │   ├── providers.tsx       # QueryClientProvider
│   │   │   ├── dashboard/          # Main dashboard (hive viz + content form)
│   │   │   ├── trending/           # Trending videos feed
│   │   │   ├── competitors/        # Competitor tracking + detail + compare
│   │   │   ├── brand-deals/        # Partnerships / affiliates / earnings
│   │   │   ├── settings/           # Account, billing, team, notifications
│   │   │   └── referrals/          # Referral program
│   │   ├── (marketing)/            # Public marketing pages
│   │   │   ├── layout.tsx          # Header + public layout
│   │   │   ├── page.tsx            # Landing page (/)
│   │   │   ├── pricing/            # Pricing page
│   │   │   ├── showcase/           # Design system showcase
│   │   │   └── coming-soon/        # Coming soon page
│   │   ├── (onboarding)/           # Auth + onboarding flow
│   │   │   ├── layout.tsx          # Minimal centered layout
│   │   │   ├── login/              # Login (actions.ts + form + page)
│   │   │   ├── signup/             # Signup (actions.ts + form + page)
│   │   │   └── welcome/            # Onboarding wizard
│   │   ├── actions/                # Server actions
│   │   │   └── competitors/        # add.ts, remove.ts, retry-scrape.ts
│   │   ├── api/                    # API route handlers
│   │   │   ├── analyze/            # Content analysis (SSE streaming)
│   │   │   ├── analysis/           # Analysis history + detail
│   │   │   ├── trending/           # Trending videos + stats
│   │   │   ├── deals/              # Brand deals CRUD
│   │   │   ├── bookmarks/          # Video bookmarks
│   │   │   ├── earnings/           # Earnings data
│   │   │   ├── intelligence/       # Competitor intelligence
│   │   │   ├── outcomes/           # Outcome tracking
│   │   │   ├── profile/            # User profile + avatar
│   │   │   ├── programs/           # Affiliate programs (CJ)
│   │   │   ├── settings/           # Account + notification settings
│   │   │   ├── subscription/       # Subscription status
│   │   │   ├── team/               # Team management
│   │   │   ├── webhooks/           # Apify + Whop webhooks
│   │   │   ├── whop/               # Whop checkout
│   │   │   ├── affiliate-links/    # Affiliate link management
│   │   │   ├── admin/              # Admin-only endpoints
│   │   │   └── cron/               # Scheduled jobs (7 cron routes)
│   │   └── auth/
│   │       └── callback/           # Supabase OAuth callback
│   ├── components/
│   │   ├── app/                    # Dashboard-specific components
│   │   │   ├── index.ts            # Barrel export (36+ exports)
│   │   │   ├── app-shell.tsx       # Main layout shell (sidebar + main)
│   │   │   ├── auth-guard.tsx      # Client-side auth wrapper
│   │   │   ├── sidebar.tsx         # Glassmorphic sidebar navigation
│   │   │   ├── content-form.tsx    # Multi-mode input form (text/URL/video)
│   │   │   ├── tiktok-account-selector.tsx
│   │   │   ├── society-selector.tsx
│   │   │   ├── test-creation-flow.tsx
│   │   │   ├── board-canvas.tsx    # Infinite pannable board view
│   │   │   ├── simulation/         # Analysis results display
│   │   │   ├── settings/           # Settings page sections
│   │   │   └── brand-deals/        # Brand deals sub-components
│   │   ├── competitors/            # Competitor feature components
│   │   │   ├── charts/             # Recharts visualizations
│   │   │   ├── comparison/         # Side-by-side comparison
│   │   │   ├── detail/             # Profile detail sections
│   │   │   └── intelligence/       # AI strategy analysis cards
│   │   ├── trending/               # Trending feed components
│   │   │   ├── index.ts            # Barrel export
│   │   │   ├── video-card.tsx      # Video card with thumbnail
│   │   │   ├── video-grid.tsx      # Responsive grid layout
│   │   │   └── video-detail-modal.tsx
│   │   ├── hive/                   # Hive network visualization
│   │   │   ├── HiveCanvas.tsx      # Main canvas component
│   │   │   ├── HiveNodeOverlay.tsx # Selected node popup
│   │   │   ├── hive-layout.ts      # d3-hierarchy layout computation
│   │   │   ├── hive-renderer.ts    # Canvas 2D drawing
│   │   │   ├── hive-interaction.ts # Hit detection + mouse events
│   │   │   ├── hive-types.ts       # TypeScript interfaces
│   │   │   ├── hive-constants.ts   # Visual configuration
│   │   │   ├── hive-mock-data.ts   # Procedural demo data
│   │   │   └── use-*.ts            # Custom hooks (resize, animation, interaction)
│   │   ├── ui/                     # Base design system components
│   │   │   ├── index.ts            # Barrel export (25+ components)
│   │   │   ├── button.tsx          # CVA-based button with 4 variants
│   │   │   ├── card.tsx            # Card + GlassCard
│   │   │   ├── dialog.tsx          # Radix Dialog wrapper
│   │   │   ├── input.tsx           # Input with size variants
│   │   │   ├── toast.tsx           # Toast system with provider
│   │   │   ├── tabs.tsx            # Radix Tabs wrapper
│   │   │   ├── typography.tsx      # Heading, Text, Caption, Code
│   │   │   └── ...                 # badge, avatar, select, skeleton, etc.
│   │   ├── primitives/             # Glass-themed higher-level components
│   │   │   ├── index.ts            # Barrel export
│   │   │   ├── GlassPanel.tsx      # Zero-config glass container
│   │   │   ├── GlassInput.tsx      # Glass-styled input
│   │   │   ├── GlassModal.tsx      # Glass-styled modal
│   │   │   ├── CommandPalette.tsx   # Command palette (Cmd+K)
│   │   │   └── ...                 # 20+ Glass* components
│   │   ├── layout/                 # Marketing page layout
│   │   │   ├── header.tsx          # Marketing header/navbar
│   │   │   ├── footer.tsx          # Marketing footer
│   │   │   └── container.tsx       # Max-width container
│   │   ├── landing/                # Landing page sections
│   │   ├── motion/                 # Framer Motion wrapper components
│   │   │   ├── fade-in.tsx, fade-in-up.tsx, slide-up.tsx
│   │   │   ├── stagger-reveal.tsx
│   │   │   └── page-transition.tsx
│   │   ├── visualization/          # 3D visualization (Three.js / Spline)
│   │   │   ├── GlassOrb.tsx        # Three.js orb with shaders
│   │   │   ├── SplineOrb.tsx       # Spline-based orb
│   │   │   └── shaders/            # GLSL shaders
│   │   ├── referral/               # Referral program components
│   │   ├── viral-results/          # Viral score display components
│   │   ├── effects/                # Visual effects (chromatic, noise)
│   │   ├── tooltips/               # Contextual tooltip system
│   │   ├── onboarding/             # Onboarding wizard steps
│   │   ├── tier-gate.tsx           # Subscription tier gating
│   │   ├── trial-countdown.tsx     # Trial period countdown
│   │   └── upgrade-prompt.tsx      # Upgrade CTA
│   ├── hooks/
│   │   ├── queries/                # TanStack Query hooks
│   │   │   ├── index.ts            # Barrel export (10 hooks)
│   │   │   ├── use-analyze.ts      # Analysis mutation + SSE streaming
│   │   │   ├── use-trending.ts     # Infinite query for trending videos
│   │   │   ├── use-deals.ts        # Deals CRUD
│   │   │   ├── use-bookmarks.ts    # Bookmark toggle
│   │   │   ├── use-outcomes.ts     # Outcome reporting
│   │   │   ├── use-earnings.ts     # Earnings data
│   │   │   ├── use-affiliate-links.ts
│   │   │   ├── use-cj-products.ts  # CJ affiliate products
│   │   │   ├── use-profile.ts      # User profile
│   │   │   └── use-team.ts         # Team management
│   │   ├── use-subscription.ts     # Subscription tier + polling
│   │   ├── use-tiktok-accounts.ts  # Multi-account management
│   │   ├── use-video-upload.ts     # Video upload to Supabase Storage
│   │   ├── use-debounce.ts         # Debounce hook
│   │   ├── use-modal-keyboard-nav.ts
│   │   ├── useCopyToClipboard.ts
│   │   ├── useCountUp.ts           # Animated number counter
│   │   ├── useIsMobile.ts          # Mobile breakpoint detection
│   │   └── usePrefersReducedMotion.ts
│   ├── stores/                     # Zustand state stores
│   │   ├── test-store.ts           # Test creation flow UI state
│   │   ├── sidebar-store.ts        # Sidebar open/close (persisted)
│   │   ├── society-store.ts        # Society selection (localStorage)
│   │   ├── bookmark-store.ts       # Bookmark sync layer over TanStack Query
│   │   ├── competitors-store.ts    # Competitors view mode (persisted)
│   │   ├── onboarding-store.ts     # Onboarding wizard state
│   │   ├── settings-store.ts       # Settings page state (localStorage)
│   │   └── tooltip-store.ts        # Tooltip dismissal state (localStorage)
│   ├── lib/
│   │   ├── engine/                 # Prediction engine core
│   │   │   ├── pipeline.ts         # 10-stage wave-parallel pipeline
│   │   │   ├── aggregator.ts       # Score aggregation from pipeline results
│   │   │   ├── types.ts            # AnalysisInput schema, PredictionResult, FeatureVector
│   │   │   ├── gemini.ts           # Gemini API client (text + video)
│   │   │   ├── deepseek.ts         # DeepSeek reasoning client
│   │   │   ├── creator.ts          # Creator context fetching
│   │   │   ├── rules.ts            # Rule engine loading + scoring
│   │   │   ├── trends.ts           # Trend enrichment
│   │   │   ├── normalize.ts        # Input normalization
│   │   │   ├── calibration.ts      # Score calibration
│   │   │   ├── fuzzy.ts            # Fuzzy matching utilities
│   │   │   ├── ml.ts               # ML model integration
│   │   │   └── __tests__/          # Unit tests (12 test files)
│   │   ├── ai/                     # AI service clients (non-engine)
│   │   │   ├── gemini.ts           # Gemini client wrapper
│   │   │   ├── deepseek.ts         # DeepSeek client wrapper
│   │   │   ├── intelligence-service.ts  # Competitor intelligence
│   │   │   ├── prompts.ts          # Prompt templates
│   │   │   └── types.ts            # AI response types
│   │   ├── supabase/               # Supabase client factories
│   │   │   ├── client.ts           # Browser client (RLS)
│   │   │   ├── server.ts           # Server component client (cookies)
│   │   │   ├── service.ts          # Service role client (admin)
│   │   │   └── middleware.ts       # Middleware session + auth logic
│   │   ├── whop/                   # Whop payment integration
│   │   │   ├── config.ts           # Tier config + plan IDs
│   │   │   ├── subscription.ts     # Subscription management
│   │   │   └── webhook-verification.ts
│   │   ├── affiliate/              # Affiliate integrations
│   │   │   └── cj-client.ts        # Commission Junction API client
│   │   ├── scraping/               # Web scraping
│   │   │   ├── apify-provider.ts   # Apify scraper integration
│   │   │   ├── types.ts            # Scraping types
│   │   │   └── index.ts            # Barrel export
│   │   ├── referral/               # Referral system
│   │   │   ├── code-generator.ts
│   │   │   └── constants.ts
│   │   ├── queries/
│   │   │   └── query-keys.ts       # TanStack Query key factory
│   │   ├── mappers/                # Data transformation
│   │   │   ├── deals.ts            # DB row -> Deal type
│   │   │   ├── trending.ts         # DB row -> Trending type
│   │   │   └── index.ts
│   │   ├── schemas/                # Zod validation schemas
│   │   │   └── competitor.ts
│   │   ├── utils.ts                # cn() utility (clsx + tailwind-merge)
│   │   ├── logger.ts               # Structured logger with child context
│   │   ├── cache.ts                # Caching utilities
│   │   ├── cron-auth.ts            # Cron route authentication
│   │   ├── pagination.ts           # Cursor pagination helpers
│   │   ├── mock-data.ts            # Mock data for development
│   │   ├── mock-societies.ts       # Default society fixtures
│   │   ├── test-types.ts           # Test type config registry
│   │   ├── deal-utils.ts           # Deal helper functions
│   │   ├── competitors-utils.ts    # Competitor metric calculations
│   │   └── affiliate-utils.ts      # Affiliate link utilities
│   └── types/
│       ├── database.types.ts       # Supabase generated types (source of truth)
│       ├── test.ts                 # TestType, TestResult, TestStatus
│       ├── trending.ts             # Trending video types + ValidTab
│       ├── brand-deals.ts          # Deal, Enrollment types
│       ├── settings.ts             # UserProfile, NotificationPrefs, TeamMember
│       ├── society.ts              # Society, PersonalSociety, TargetSociety
│       ├── viral-results.ts        # ViralResult display types
│       └── design-tokens.ts        # Design token type definitions
├── supabase/
│   ├── config.toml                 # Supabase project config
│   ├── migrations/                 # SQL migration files
│   └── seed.sql                    # Database seed data
├── e2e/                            # Playwright E2E tests
├── extraction/                     # Playwright extraction scripts
├── scripts/                        # CLI utility scripts
├── verification/                   # Visual verification tests
├── public/                         # Static assets
├── next.config.ts                  # Next.js + Sentry config
├── vitest.config.ts                # Vitest test runner config
├── postcss.config.mjs              # PostCSS + Tailwind v4
├── eslint.config.mjs               # ESLint flat config
├── vercel.json                     # Vercel deployment config
├── CLAUDE.md                       # Project-level Claude instructions
├── BRAND-BIBLE.md                  # Design system documentation
└── package.json                    # Dependencies + scripts
```

## Directory Purposes

**`src/app/(app)/`:**
- Purpose: Authenticated dashboard pages. All routes require login.
- Contains: Server component pages that fetch data + client wrapper components for interactivity
- Key files: `layout.tsx` (auth check + providers), `dashboard/dashboard-client.tsx` (main dashboard logic), `providers.tsx` (QueryClientProvider)

**`src/app/api/`:**
- Purpose: Backend API endpoints organized by domain
- Contains: `route.ts` files exporting HTTP method handlers (GET, POST, PUT, DELETE, PATCH)
- Key patterns: Auth via `createClient()` from `server.ts`, admin ops via `createServiceClient()`, SSE for streaming

**`src/app/api/cron/`:**
- Purpose: Scheduled background jobs triggered by Vercel Cron
- Contains: 7 cron routes: `calculate-trends`, `calibration-audit`, `refresh-competitors`, `retrain-ml`, `scrape-trending`, `sync-whop`, `validate-rules`
- Auth: Verified via `src/lib/cron-auth.ts`

**`src/components/app/`:**
- Purpose: Dashboard-specific components that compose the main app experience
- Contains: Shell, sidebar, forms, modals, settings sections, simulation results, brand deals
- Key files: `app-shell.tsx`, `sidebar.tsx`, `content-form.tsx`, `tiktok-account-selector.tsx`

**`src/components/ui/`:**
- Purpose: Base design system components (Raycast-style)
- Contains: Button, Card, Input, Dialog, Tabs, Badge, Avatar, Toast, Typography, etc.
- Pattern: CVA variants, Radix UI primitives, semantic token usage from `globals.css`

**`src/components/primitives/`:**
- Purpose: Higher-level Glass-themed components built on `ui/` base
- Contains: GlassPanel, GlassInput, GlassModal, GlassSelect, GlassTooltip, CommandPalette, etc.
- Pattern: Glass gradient + blur + inset shadow styling per BRAND-BIBLE.md

**`src/components/hive/`:**
- Purpose: Custom Canvas 2D network visualization (the "hive" view)
- Contains: Canvas component, layout engine (d3-hierarchy), renderer, interaction system, custom hooks
- Pattern: Imperative rendering via refs, memoized layout, requestAnimationFrame loop

**`src/lib/engine/`:**
- Purpose: Core prediction engine for content analysis
- Contains: 10-stage pipeline, AI model clients (Gemini/DeepSeek), rule engine, trend enrichment, score aggregation
- Key files: `pipeline.ts` (orchestrator), `aggregator.ts` (scoring), `types.ts` (schemas)
- Tests: `__tests__/` directory with 12 test files + `factories.ts` test data factory

**`src/stores/`:**
- Purpose: Zustand client-side state management
- Contains: 8 stores for different UI concerns
- Pattern: `create<State>()` with actions, `_hydrate()` for SSR-safe localStorage reads, `_isHydrated` guard

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root HTML layout, font loading
- `src/app/(app)/layout.tsx`: App shell initialization, auth gate
- `src/middleware.ts`: Request-level auth + redirect logic
- `src/app/api/analyze/route.ts`: Primary API endpoint (analysis pipeline)

**Configuration:**
- `src/app/globals.css`: All design tokens via Tailwind v4 `@theme` block (294 lines)
- `next.config.ts`: Next.js + Sentry configuration
- `vitest.config.ts`: Test runner configuration
- `tsconfig.json`: TypeScript config with `@/*` path alias to `./src/*`
- `postcss.config.mjs`: PostCSS + Tailwind v4
- `eslint.config.mjs`: ESLint flat config

**Core Logic:**
- `src/lib/engine/pipeline.ts`: 10-stage prediction pipeline (wave-parallel)
- `src/lib/engine/aggregator.ts`: Score aggregation from pipeline outputs
- `src/lib/engine/types.ts`: `AnalysisInputSchema`, `PredictionResult`, `FeatureVector`
- `src/lib/supabase/middleware.ts`: Auth middleware with route protection logic

**Design System:**
- `src/components/ui/button.tsx`: Button with 4 variants (primary/secondary/ghost/destructive)
- `src/components/ui/card.tsx`: Card + GlassCard
- `src/components/ui/dialog.tsx`: Modal/dialog system (Radix)
- `src/components/ui/toast.tsx`: Toast notification system with provider
- `src/components/primitives/GlassPanel.tsx`: Core glass container component

**Testing:**
- `src/lib/engine/__tests__/`: 12 unit test files for engine
- `src/lib/engine/__tests__/factories.ts`: Test data factory
- `e2e/`: Playwright E2E test directory
- `vitest.config.ts`: Vitest configuration

## Naming Conventions

**Files:**
- `kebab-case.tsx` for most components: `content-form.tsx`, `sidebar-nav-item.tsx`
- `PascalCase.tsx` for primitives and hive components: `GlassPanel.tsx`, `HiveCanvas.tsx`, `GlassModal.tsx`
- `kebab-case.ts` for utilities and hooks: `use-analyze.ts`, `query-keys.ts`
- `camelCase.ts` for some hooks: `useCopyToClipboard.ts`, `useCountUp.ts`, `useIsMobile.ts`
- `*-client.tsx` suffix for client component wrappers of server pages: `dashboard-client.tsx`, `competitors-client.tsx`
- `index.ts` barrel files in component directories

**Directories:**
- `kebab-case` for all directories
- Route groups use parentheses: `(app)`, `(marketing)`, `(onboarding)`
- Dynamic segments use brackets: `[handle]`, `[id]`, `[videoId]`, `[competitorId]`

## Where to Add New Code

**New App Page (authenticated):**
- Create directory: `src/app/(app)/<page-name>/`
- Add `page.tsx` (server component with metadata) + `<page-name>-client.tsx` (client component)
- Add `loading.tsx` for Suspense skeleton
- Add nav item to `src/components/app/sidebar.tsx` `navItems` array
- Add route to `PROTECTED_PREFIXES` in `src/lib/supabase/middleware.ts`

**New API Route:**
- Create: `src/app/api/<domain>/route.ts`
- Export named handlers: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`
- Use `createClient()` from `server.ts` for auth, `createServiceClient()` from `service.ts` for admin
- Add query key to `src/lib/queries/query-keys.ts`
- Add TanStack Query hook to `src/hooks/queries/`

**New Dashboard Component:**
- Add to: `src/components/app/<component-name>.tsx`
- Export from: `src/components/app/index.ts` (barrel file)
- Use `"use client"` directive if interactive

**New UI Component (design system):**
- Add to: `src/components/ui/<component-name>.tsx`
- Use CVA for variants, Radix UI for accessibility primitives
- Export from: `src/components/ui/index.ts`
- Follow Raycast design tokens from `globals.css`

**New Glass Primitive:**
- Add to: `src/components/primitives/<ComponentName>.tsx` (PascalCase)
- Export from: `src/components/primitives/index.ts`
- Follow glassmorphism pattern from `GlassPanel.tsx`

**New Zustand Store:**
- Add to: `src/stores/<store-name>.ts`
- Pattern: `create<State>()` with typed interface, `_hydrate()` + `_isHydrated` for localStorage

**New TanStack Query Hook:**
- Add to: `src/hooks/queries/use-<resource>.ts`
- Export from: `src/hooks/queries/index.ts`
- Add query key to `src/lib/queries/query-keys.ts`
- Use `queryKeys.<domain>.<method>()` pattern

**New Custom Hook:**
- Add to: `src/hooks/use-<name>.ts` (kebab-case) or `src/hooks/use<Name>.ts` (camelCase, see existing pattern)
- Prefer kebab-case for new hooks

**New Type Definition:**
- Add to: `src/types/<domain>.ts`
- For database types: regenerate `src/types/database.types.ts` via Supabase CLI

**New Engine Stage:**
- Add to: `src/lib/engine/<stage-name>.ts`
- Wire into `src/lib/engine/pipeline.ts` wave structure
- Add test file: `src/lib/engine/__tests__/<stage-name>.test.ts`
- Use `timed()` wrapper for timing capture

**New Server Action:**
- Add to: `src/app/actions/<domain>/<action-name>.ts`
- Use `"use server"` directive

**New Competitor Feature Component:**
- Add to: `src/components/competitors/` (or subdirectory: `charts/`, `detail/`, `comparison/`, `intelligence/`)

**New Trending Feature Component:**
- Add to: `src/components/trending/`
- Export from: `src/components/trending/index.ts`

## Special Directories

**`supabase/`:**
- Purpose: Supabase project configuration, migrations, and seed data
- Generated: Partially (types are generated, migrations are authored)
- Committed: Yes

**`extraction/`:**
- Purpose: Playwright scripts for extracting design data from Raycast website
- Generated: No (manually authored)
- Committed: Yes
- Note: Excluded from TypeScript compilation via `tsconfig.json`

**`verification/`:**
- Purpose: Visual verification/regression test artifacts
- Generated: Yes (test outputs)
- Committed: Yes
- Note: Excluded from TypeScript compilation

**`scripts/`:**
- Purpose: CLI utility scripts (dataset analysis, benchmarking)
- Generated: No
- Committed: Yes
- Note: Excluded from TypeScript compilation

**`e2e/`:**
- Purpose: Playwright end-to-end tests
- Generated: No
- Committed: Yes
- Separate Playwright config at `e2e/playwright.config.ts`

**`.planning/`:**
- Purpose: GSD project planning documents
- Generated: No (authored by Claude/human)
- Committed: Yes

**`public/`:**
- Purpose: Static assets served at root URL
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-03-11*
