# Technology Stack

**Analysis Date:** 2026-02-22

## Languages

**Primary:**
- TypeScript 5 - Full project codebase, strict mode enabled
- CSS3 - Tailwind CSS v4 with @theme block

**Secondary:**
- JavaScript - Build and test configuration files
- SQL - Supabase migrations in `supabase/migrations/`

## Runtime

**Environment:**
- Node.js 20+ (inferred from package.json and Next.js requirements)

**Package Manager:**
- npm (primary, with `package-lock.json`)
- pnpm (preferred, with `pnpm-lock.yaml`)

## Frameworks

**Core:**
- Next.js 16.1.5 - React metaframework with App Router, Vercel deployment
- React 19.2.3 - UI component library with functional components and hooks
- React DOM 19.2.3 - Browser rendering

**Styling:**
- Tailwind CSS 4 - Utility-first CSS with @theme block for semantic design system in `src/app/globals.css`
- @tailwindcss/postcss 4 - PostCSS integration for Tailwind v4
- Tailwind Merge 3.4.0 - Utility class conflict resolution

**3D/Visualization:**
- Three.js 0.182.0 - 3D graphics library
- @react-three/fiber 9.5.0 - React renderer for Three.js
- @react-three/drei 10.7.7 - Useful helpers and abstractions for @react-three/fiber
- Recharts 3.7.0 - React charts library for data visualization
- Motion 12.29.2 - Animation library (framer-motion fork)
- Framer Motion 12.29.3 - Declarative animation primitives

**UI Components:**
- Radix UI - Unstyled, accessible component primitives:
  - @radix-ui/react-accordion 1.2.12
  - @radix-ui/react-alert-dialog 1.1.15
  - @radix-ui/react-avatar 1.1.11
  - @radix-ui/react-dialog 1.1.15
  - @radix-ui/react-dropdown-menu 2.1.16
  - @radix-ui/react-slot 1.2.4
  - @radix-ui/react-switch 1.2.6
  - @radix-ui/react-tabs 1.1.13
- Lucide React 0.563.0 - Icon library
- @phosphor-icons/react 2.1.10 - Alternative icon set
- Class Variance Authority 0.7.1 - Type-safe CSS variant management
- clsx 2.1.1 - Utility for constructing className strings

**State Management:**
- Zustand 5.0.10 - Lightweight state management with persistence middleware
- @tanstack/react-query 5.90.21 - Server state management, caching, and synchronization

**Data Validation:**
- Zod 4.3.6 - TypeScript-first schema validation

**Other Utilities:**
- nanoid 5.1.6 - Lightweight ID generation
- React Intersection Observer 10.0.2 - Intersection Observer API hook
- Clsx 2.1.1 - Utility for conditional CSS classes
- D3 libraries (for data visualization):
  - d3-hierarchy 3.1.2 - Hierarchical data structure layout algorithms
  - d3-quadtree 3.0.1 - Spatial indexing data structure
- Sugar High 0.9.5 - Lightweight syntax highlighting
- tw-animate-css 1.4.0 - Additional Tailwind animations

**Testing:**
- Vitest 4.0.18 - Unit test runner (Node environment)
  - Config: `vitest.config.ts`
  - Coverage: v8 provider with 80% threshold
- @vitest/coverage-v8 4.0.18 - Coverage reporting
- @playwright/test 1.58.0 - E2E and extraction testing
  - E2E config: `e2e/playwright.config.ts`
  - Extraction config: `extraction/playwright.config.ts`
- pixelmatch 6.0.0 - Pixel-level image comparison for visual tests
- pngjs 7.0.0 - PNG image processing

**Linting/Formatting:**
- ESLint 9 - JavaScript/TypeScript linting
  - Config: `eslint.config.mjs` (flat config format)
  - Extends: eslint-config-next (core-web-vitals + typescript)
- eslint-config-next 16.1.5 - Next.js recommended rules
- Prettier - Configured via `.prettierrc` (not visible in search)

**Build/Dev Tools:**
- PostCSS 4 - CSS transformation (tailwindcss integration)
- tsx - TypeScript execution and node runner

## Key Dependencies

**Critical:**
- @supabase/supabase-js 2.93.1 - Supabase client library for database, auth, real-time
- @supabase/ssr 0.8.0 - Supabase Server-Side Rendering helpers for Next.js middleware
- @sentry/nextjs 10.39.0 - Error tracking and performance monitoring (configured in `sentry.*.config.ts`)

**AI/ML:**
- @google/genai 1.41.0 - Google Gemini API client (gemini-2.5-flash-lite)
- openai 6.22.0 - OpenAI client library (used for DeepSeek API compatibility)

**External Integrations:**
- apify-client 2.22.1 - Apify web scraping platform client
- @whop/checkout 0.0.52 - Whop checkout and subscription integration

**Database/Utilities:**
- supabase 2.74.5 - Supabase CLI and utilities (dev dependency)
- dotenv 17.3.1 - Environment variable loading

**Accessibility:**
- wcag-contrast 3.0.0 - WCAG color contrast checking (dev dependency)

## Configuration

**Environment:**
- Located in `.env.local` and `.env.example` (secrets not visible)
- Critical vars (inferred from code):
  - `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
  - `NEXT_PUBLIC_SENTRY_DSN` - Sentry error tracking
  - `SENTRY_ORG` - Sentry organization
  - `SENTRY_PROJECT` - Sentry project
  - `GEMINI_API_KEY` - Google Gemini API key
  - `DEEPSEEK_API_KEY` - DeepSeek API key
  - `APIFY_TOKEN` - Apify API token
  - `APIFY_WEBHOOK_SECRET` - Apify webhook signature verification
  - `APIFY_ACTOR_ID` - Apify actor to run
  - `WHOP_PRODUCT_ID_STARTER` - Whop product ID for Starter tier
  - `WHOP_PRODUCT_ID_PRO` - Whop product ID for Pro tier
  - `NODE_ENV` - Development or production

**Build:**
- `next.config.ts` - Next.js configuration
  - Three.js transpilation enabled
  - Remote image patterns for picsum.photos
  - Sentry integration configured
- `tsconfig.json` - TypeScript compiler options
  - Target: ES2017
  - Strict mode enabled
  - Path alias: `@/*` → `src/*`
  - Plugins: Next.js
  - Excludes: node_modules, extraction, verification, scripts
- `postcss.config.mjs` - PostCSS configuration for Tailwind v4
- `vitest.config.ts` - Vitest configuration
  - Node environment only
  - Path alias matching tsconfig
  - Global test utilities
  - Coverage: 80% threshold on engine code
- `.env.example` - Template for required environment variables

## Platform Requirements

**Development:**
- Node.js 20+ with npm or pnpm
- TypeScript knowledge (strict mode)
- Modern browser for dev server

**Production:**
- Vercel deployment
- Cron functions via Vercel (see `vercel.json`)
- Next.js 16+ runtime
- Database: Supabase (PostgreSQL)
- Requires all environment variables from `.env.example`

## Special Configuration

**Database:**
- Supabase PostgreSQL with migrations in `supabase/migrations/`
- Auto-generated TypeScript types in `src/types/database.types.ts`
- Row-level security (RLS) policies configured

**Cron Jobs:**
- Vercel Cron integrated via `vercel.json`:
  - `/api/cron/calculate-trends` - Every hour
  - `/api/cron/scrape-trending` - Every 6 hours
  - `/api/cron/sync-whop` - Every 12 hours
  - `/api/cron/refresh-competitors` - Daily at 6 AM
  - `/api/cron/validate-rules` - Daily at 2 AM
  - `/api/cron/retrain-ml` - Weekly on Monday at 3 AM
  - `/api/cron/calibration-audit` - Monthly on 1st at 4 AM

**Middleware:**
- `src/middleware.ts` - Uses Supabase SSR session update for auth

---

*Stack analysis: 2026-02-22*
