# Technology Stack

**Analysis Date:** 2026-02-13

## Languages

**Primary:**
- TypeScript 5.x - All application code
- JavaScript - Configuration files (ESLint, PostCSS, Next.js config)

**Secondary:**
- SQL - Supabase database migrations (`supabase/migrations/`)
- GLSL - WebGL shaders (`src/components/visualization/shaders/`)

## Runtime

**Environment:**
- Node.js v25.2.1

**Package Manager:**
- npm v10.x
- Lockfile: `package-lock.json` (lockfileVersion 3) present

## Frameworks

**Core:**
- Next.js 16.1.5 - React framework with App Router
- React 19.2.3 - UI library
- React DOM 19.2.3 - React renderer

**Testing:**
- Playwright 1.58.0 - E2E testing and extraction workflows

**Build/Dev:**
- TypeScript 5.x - Type checking and compilation
- ESLint 9 - Code linting with `eslint-config-next`
- PostCSS - CSS processing
- Tailwind CSS v4 - Styling (`@tailwindcss/postcss`)
- Supabase CLI 2.74.5 - Local database development

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` 2.93.1 - Supabase client SDK
- `@supabase/ssr` 0.8.0 - Server-side rendering utilities for Supabase auth
- `@whop/checkout` 0.0.52 - Whop payment/subscription checkout integration
- `next` 16.1.5 - Application framework
- `zustand` 5.0.10 - Client-side state management

**UI Components:**
- `@radix-ui/react-*` (multiple) - Headless UI primitives (accordion, alert-dialog, avatar, dialog, dropdown-menu, slot, switch, tabs)
- `@phosphor-icons/react` 2.1.10 - Icon library
- `lucide-react` 0.563.0 - Additional icon library
- `class-variance-authority` 0.7.1 - Component variant utilities
- `clsx` 2.1.1 / `tailwind-merge` 3.4.0 - Tailwind class merging

**Animation/3D:**
- `framer-motion` 12.29.3 - React animation library
- `motion` 12.29.2 - Framer Motion runtime
- `three` 0.182.0 - 3D graphics library
- `@react-three/fiber` 9.5.0 - React renderer for Three.js
- `@react-three/drei` 10.7.7 - Three.js helpers
- `@splinetool/react-spline` 4.1.0 - Spline 3D integration

**Data Visualization:**
- `recharts` 3.7.0 - Chart library
- `d3-hierarchy` 3.1.2 - Hierarchical data structures
- `d3-quadtree` 3.0.1 - Spatial indexing

**Infrastructure:**
- `zod` 4.3.6 - Runtime schema validation
- `sugar-high` 0.9.5 - Syntax highlighting
- `react-intersection-observer` 10.0.2 - Viewport intersection detection
- `tw-animate-css` 1.4.0 - Tailwind animation utilities

## Configuration

**Environment:**
- Configuration via environment variables
- Required public vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`
- Required private vars: `SUPABASE_SERVICE_ROLE_KEY`, `WHOP_WEBHOOK_SECRET`, `WHOP_PRODUCT_ID_STARTER`, `WHOP_PRODUCT_ID_PRO`
- Example file: `.env.local.example`
- `.env` files are gitignored

**Build:**
- `next.config.ts` - Next.js configuration (transpilePackages for three.js, remote image patterns)
- `tsconfig.json` - TypeScript configuration (strict mode, path aliases via `@/*`)
- `eslint.config.mjs` - ESLint configuration (Next.js recommended rules)
- `postcss.config.mjs` - PostCSS with Tailwind v4 plugin
- `supabase/config.toml` - Local Supabase development configuration

**TypeScript:**
- Target: ES2017
- Strict mode enabled with additional safety flags (`noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`)
- Path alias: `@/*` maps to `./src/*`

## Platform Requirements

**Development:**
- Node.js 25+ (recommended)
- npm 10+ package manager
- Supabase CLI for local database development
- Playwright for E2E testing

**Production:**
- Vercel (deployment target based on CLAUDE.md)
- Supabase (hosted database and auth)
- Whop (payment/subscription platform)

---

*Stack analysis: 2026-02-13*
