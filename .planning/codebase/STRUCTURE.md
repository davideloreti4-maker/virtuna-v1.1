# Codebase Structure

**Analysis Date:** 2026-02-13

## Directory Layout

```
virtuna-mvp-launch/
├── .planning/          # GSD workflow (phases, milestones, research)
├── docs/               # Documentation
├── extraction/         # Playwright E2E tests and visual regression
├── public/             # Static assets (fonts, images, logos)
├── scripts/            # Build and utility scripts
├── src/                # Application source code
│   ├── app/            # Next.js App Router (routes + layouts)
│   ├── components/     # React components (domain-organized)
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utilities and external service integrations
│   ├── stores/         # Zustand state stores
│   └── types/          # TypeScript type definitions
├── supabase/           # Database migrations and config
├── test-results/       # Playwright test artifacts
└── verification/       # Verification scripts and reports
```

## Directory Purposes

**`src/app/`:**
- Purpose: Next.js App Router routes and layouts
- Contains: Route groups, page components, layouts, API routes, global CSS
- Key files:
  - `globals.css`: Tailwind v4 `@theme` block with design tokens
  - `(marketing)/`: Public marketing pages (landing, showcase)
  - `(app)/`: Authenticated app pages (dashboard, settings, trending, brand-deals)
  - `api/`: Server-side API endpoints (checkout, webhooks, subscription)

**`src/components/`:**
- Purpose: Reusable React components organized by domain
- Contains: Feature components, UI primitives, layout components
- Subdirectories:
  - `app/`: App-specific components (sidebar, test flow, settings panels)
  - `landing/`: Marketing landing page sections
  - `trending/`: Video trending page components
  - `hive/`: Network visualization (HiveCanvas, force simulation)
  - `visualization/`: Data visualization components
  - `viral-results/`: Viral results analysis components
  - `primitives/`: Low-level Glass UI components (GlassPanel, GlassInput, etc.)
  - `ui/`: Radix-based headless UI components (Button, Card, Dialog, etc.)
  - `layout/`: Site layout components (Header, Footer)
  - `motion/`: Animation wrapper components (FadeIn, PageTransition, etc.)
  - `effects/`: Visual effect components (NoiseTexture)

**`src/lib/`:**
- Purpose: Business logic, utilities, external integrations
- Contains:
  - `supabase/`: Supabase client factories (server, client, middleware)
  - `whop/`: Whop payment integration (config, subscription, webhook verification)
  - `mock-*.ts`: Mock data for development (societies, tests, brand deals, trending)
  - `utils.ts`: Shared utilities (cn for className merging)
  - `*-utils.ts`: Domain-specific utilities (deal-utils, affiliate-utils)

**`src/stores/`:**
- Purpose: Zustand global state management
- Contains: Client-side stores with persistence
- Key files:
  - `sidebar-store.ts`: Sidebar open/closed state
  - `settings-store.ts`: User profile, notifications, team, billing
  - `test-store.ts`: Test creation flow state
  - `society-store.ts`: Society selection state
  - `bookmark-store.ts`: Video bookmark state

**`src/hooks/`:**
- Purpose: Custom React hooks
- Contains: Reusable hook logic
- Key files:
  - `use-infinite-videos.ts`: Infinite scroll pagination
  - `use-debounce.ts`: Debounced values
  - `use-modal-keyboard-nav.ts`: Keyboard navigation for modals
  - `usePrefersReducedMotion.ts`: Accessibility hook for animations
  - `useCountUp.ts`: Animated number counter
  - `useIsMobile.ts`: Mobile breakpoint detection
  - `useCopyToClipboard.ts`: Clipboard copy with feedback

**`src/types/`:**
- Purpose: TypeScript type definitions
- Contains: Domain models and contracts
- Key files:
  - `database.types.ts`: Generated Supabase database types
  - `test.ts`: Test flow types (TestType, TestResult, TestStatus)
  - `society.ts`: Society types (PersonalSociety, TargetSociety)
  - `trending.ts`: Trending video types
  - `brand-deals.ts`: Brand deal types
  - `settings.ts`: Settings page types
  - `viral-results.ts`: Viral results types
  - `design-tokens.ts`: Design token types

**`public/`:**
- Purpose: Static assets served at root
- Contains:
  - `fonts/`: Web fonts (Inter)
  - `images/`: Static images
  - `logos/`: Brand logos

**`supabase/`:**
- Purpose: Database schema and migrations
- Contains: SQL migration files

**`extraction/`:**
- Purpose: Playwright E2E tests for visual regression and user flows
- Contains: Test scripts, fixtures, screenshots, videos, auth state

**`.planning/`:**
- Purpose: GSD workflow artifacts (milestone-scoped)
- Contains: Phases, requirements, roadmap, research, milestones

## Key File Locations

**Entry Points:**
- `src/app/(marketing)/page.tsx`: Landing page
- `src/app/(app)/dashboard/page.tsx`: Dashboard (server wrapper)
- `src/app/(app)/dashboard/dashboard-client.tsx`: Dashboard (client logic)
- `src/app/(app)/trending/page.tsx`: Trending videos page
- `src/app/(app)/brand-deals/page.tsx`: Brand deals page
- `src/app/(app)/settings/page.tsx`: Settings page

**Configuration:**
- `next.config.ts`: Next.js configuration (transpilePackages, image remotePatterns)
- `tsconfig.json`: TypeScript compiler options (strict mode, path aliases)
- `eslint.config.mjs`: ESLint configuration
- `postcss.config.mjs`: PostCSS configuration (Tailwind v4)
- `tailwind.config.ts`: Not present (Tailwind v4 uses `@theme` in CSS)
- `package.json`: Dependencies and scripts

**Core Logic:**
- `src/middleware.ts`: Request middleware (Supabase session refresh)
- `src/lib/supabase/server.ts`: Server-side Supabase client factory
- `src/lib/supabase/client.ts`: Client-side Supabase client factory
- `src/lib/supabase/middleware.ts`: Middleware Supabase session handler

**Testing:**
- `extraction/playwright.config.ts`: Playwright configuration
- `extraction/tests/*.spec.ts`: E2E test specs
- `extraction/scripts/`: Test automation scripts

## Naming Conventions

**Files:**
- Components: `kebab-case.tsx` (e.g., `glass-panel.tsx`)
- Pages: `page.tsx` (Next.js convention)
- Layouts: `layout.tsx` (Next.js convention)
- API routes: `route.ts` (Next.js convention)
- Hooks: `use-*` prefix (e.g., `use-debounce.ts`)
- Stores: `*-store.ts` (e.g., `sidebar-store.ts`)
- Types: `*.types.ts` or `*.ts` in `types/` (e.g., `database.types.ts`)
- Utilities: `*-utils.ts` or `utils.ts`
- Mock data: `mock-*.ts` (e.g., `mock-societies.ts`)

**Directories:**
- Route groups: `(group-name)/` (e.g., `(marketing)/`, `(app)/`)
- Component domains: `lowercase` (e.g., `app/`, `landing/`, `trending/`)
- Special Next.js: `api/`, `_components/` (colocated private components)

**Components:**
- React components: PascalCase export (e.g., `export function GlassPanel`)
- File names: kebab-case (e.g., `glass-panel.tsx` exports `GlassPanel`)

**Types:**
- Interfaces/Types: PascalCase (e.g., `TestType`, `Society`)
- Type files: lowercase with domain prefix (e.g., `test.ts`, `society.ts`)

**Functions:**
- Utilities: camelCase (e.g., `cn()`, `formatNumber()`)
- Hooks: `use*` prefix (e.g., `useDebounce()`)

## Where to Add New Code

**New Feature (App Page):**
- Primary code: `src/app/(app)/[feature-name]/page.tsx`
- Client logic: `src/app/(app)/[feature-name]/[feature-name]-client.tsx` (if interactive)
- Components: `src/components/[feature-name]/` (domain-specific components)
- Types: `src/types/[feature-name].ts`
- Store (if needed): `src/stores/[feature-name]-store.ts`
- Tests: `extraction/tests/[feature-name].spec.ts`

**New Component/Module:**
- Implementation: `src/components/[domain]/[component-name].tsx`
- If reusable UI primitive: `src/components/primitives/[ComponentName].tsx`
- If base UI component: `src/components/ui/[component-name].tsx`

**New API Endpoint:**
- Route handler: `src/app/api/[endpoint]/route.ts`
- Business logic (if complex): `src/lib/[domain]/[feature].ts`
- Types: `src/types/[domain].ts`

**New Landing Section:**
- Section component: `src/components/landing/[section-name].tsx`
- Import in: `src/app/(marketing)/page.tsx`

**Utilities:**
- Shared helpers: `src/lib/utils.ts`
- Domain-specific: `src/lib/[domain]-utils.ts`

**Types:**
- Domain types: `src/types/[domain].ts`
- Database types: Generated via Supabase CLI → `src/types/database.types.ts`

**Hooks:**
- Custom hooks: `src/hooks/use-[hook-name].ts`

## Special Directories

**`.planning/`:**
- Purpose: GSD workflow artifacts (milestone-scoped planning)
- Generated: By GSD commands
- Committed: Yes

**`.next/`:**
- Purpose: Next.js build output
- Generated: Yes (on `next build` and `next dev`)
- Committed: No (in `.gitignore`)

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes (on `npm install`)
- Committed: No (in `.gitignore`)

**`extraction/`:**
- Purpose: Playwright E2E tests and artifacts
- Generated: Test results/screenshots generated on test runs
- Committed: Yes (tests), No (reports/screenshots per `.gitignore`)

**`test-results/`:**
- Purpose: Playwright test artifacts
- Generated: Yes (on test runs)
- Committed: No (in `.gitignore`)

**`.reference/`:**
- Purpose: Reference designs and assets
- Generated: No (manually curated)
- Committed: Yes

**`public/`:**
- Purpose: Static assets served at `/`
- Generated: No (manually added)
- Committed: Yes

## Path Aliases

**Configured in `tsconfig.json`:**
- `@/*` → `src/*` (all source code accessible via `@/` import)

**Examples:**
```typescript
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import type { TestType } from "@/types/test";
import { useSidebarStore } from "@/stores/sidebar-store";
```

## Import Patterns

**Recommended order:**
1. React/Next.js imports
2. Third-party libraries
3. `@/components/*` imports
4. `@/lib/*` utilities
5. `@/stores/*` stores
6. `@/hooks/*` hooks
7. `@/types/*` types
8. Relative imports (if any)

**Example:**
```typescript
import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/primitives/GlassPanel";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useDebounce } from "@/hooks/use-debounce";
import type { TestType } from "@/types/test";
```

## Component Organization Strategy

**By Domain:** Components organized by feature domain (app, landing, trending) rather than technical type (buttons, forms). Promotes feature cohesion.

**Layered:** Base primitives (`ui/`, `primitives/`) → Domain components (`app/`, `landing/`) → Pages (`app/`)

**Colocation:** Page-specific components can live in `app/[route]/_components/` if not reusable

**Index Files:** Most component directories export via `index.ts` barrel file for cleaner imports

---

*Structure analysis: 2026-02-13*
