# Architecture

**Analysis Date:** 2026-02-13

## Pattern Overview

**Overall:** Next.js 15 App Router with Route Groups

**Key Characteristics:**
- File-based routing with route groups for layout separation
- Server-first with client components for interactivity
- Supabase for backend services (authentication, database)
- Zustand for client-side state management
- Component-driven architecture with layered design system

## Layers

**Presentation Layer (App Routes):**
- Purpose: Route handlers and page components
- Location: `src/app/`
- Contains: Route groups, page components, layouts, API routes
- Depends on: Components, lib utilities, stores
- Used by: Next.js router

**Component Layer:**
- Purpose: Reusable UI building blocks organized by domain
- Location: `src/components/`
- Contains: Domain components (app, landing, trending), UI primitives, layout components, motion wrappers
- Depends on: Primitives, UI components, hooks, utilities
- Used by: Pages, other components

**Primitives Layer:**
- Purpose: Low-level Glass UI components (Raycast-inspired design system)
- Location: `src/components/primitives/`
- Contains: GlassPanel, GlassInput, GlassTextarea, GlassPill, TrafficLights
- Depends on: Base utilities only
- Used by: All higher-level components

**UI Components Layer:**
- Purpose: Radix-based headless components with Raycast styling
- Location: `src/components/ui/`
- Contains: Button, Card, Dialog, Input, Tabs, Toast, etc.
- Depends on: Radix UI, Tailwind utilities
- Used by: Domain components

**State Management Layer:**
- Purpose: Client-side state stores
- Location: `src/stores/`
- Contains: Zustand stores (sidebar, settings, test, society, bookmark)
- Depends on: Types
- Used by: Client components

**Data Access Layer:**
- Purpose: External service integrations
- Location: `src/lib/`
- Contains: Supabase clients (server, client, middleware), Whop integration, mock data, utilities
- Depends on: Database types, Supabase SDK
- Used by: API routes, server components, middleware

**Type Definitions:**
- Purpose: TypeScript contracts
- Location: `src/types/`
- Contains: Database types (generated), domain types (test, society, trending, settings)
- Depends on: Nothing
- Used by: All layers

## Data Flow

**Public Marketing Flow:**

1. User hits marketing route `/(marketing)/*`
2. Marketing layout (`src/app/(marketing)/layout.tsx`) applies Header
3. Page imports landing components (`src/components/landing/`)
4. Server components render with static content

**Authenticated App Flow:**

1. User hits app route `/(app)/*`
2. Middleware (`src/middleware.ts`) checks Supabase session via `updateSession`
3. App layout (`src/app/(app)/layout.tsx`) wraps with AppShell + ToastProvider
4. AppShell renders AuthGuard → Sidebar + main content
5. Client components hydrate with Zustand stores
6. User interactions trigger store updates → component re-renders

**API Flow:**

1. Client calls API route (`src/app/api/*/route.ts`)
2. API route creates Supabase server client (`createClient` from `src/lib/supabase/server.ts`)
3. Authenticates user via `supabase.auth.getUser()`
4. Performs business logic (checkout, subscription sync, webhooks)
5. Returns JSON response

**State Management:**

- Zustand stores persist to localStorage (sidebar, settings)
- Stores expose actions + selectors
- Components call `useStore()` hooks
- State updates trigger React re-renders
- Hydration pattern: stores check `_isHydrated` flag, call `_hydrate()` on mount

## Key Abstractions

**Route Groups:**
- Purpose: Isolate layouts without affecting URL structure
- Examples: `src/app/(marketing)/`, `src/app/(app)/`
- Pattern: Parentheses in folder name, each has own `layout.tsx`

**Glass Components:**
- Purpose: Raycast-inspired glassmorphism UI primitives
- Examples: `src/components/primitives/GlassPanel.tsx`, `src/components/primitives/GlassInput.tsx`
- Pattern: Fixed 5px blur, 12px radius, gradient background, 0.06 border, inset shadow

**Supabase Client Factory:**
- Purpose: Context-aware database client creation
- Examples: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/middleware.ts`
- Pattern: Server components use `server.ts` (cookies via `next/headers`), client components use `client.ts` (browser client), middleware uses `middleware.ts` (request-scoped)

**Zustand Store Pattern:**
- Purpose: Type-safe global state with persistence
- Examples: `src/stores/sidebar-store.ts`, `src/stores/settings-store.ts`
- Pattern: `create<StateInterface>()`, actions as methods, `persist` middleware for localStorage, `_hydrate` method for SSR safety

**Motion Wrappers:**
- Purpose: Animation components respecting reduced motion
- Examples: `src/components/motion/fade-in.tsx`, `src/components/motion/page-transition.tsx`
- Pattern: Wrap motion components, check `useReducedMotion`, provide fallback

## Entry Points

**Root Layout:**
- Location: Layouts in `src/app/(marketing)/layout.tsx` and `src/app/(app)/layout.tsx`
- Triggers: Next.js App Router
- Responsibilities: HTML structure, font loading (Inter via `next/font/google`), global CSS import, layout-specific wrappers

**Middleware:**
- Location: `src/middleware.ts`
- Triggers: Every request (except static assets, images)
- Responsibilities: Supabase session refresh, cookie handling

**Marketing Homepage:**
- Location: `src/app/(marketing)/page.tsx`
- Triggers: Root path `/`
- Responsibilities: Landing page composition (Hero, Features, Stats, etc.)

**Dashboard:**
- Location: `src/app/(app)/dashboard/page.tsx` (server) → `dashboard-client.tsx` (client)
- Triggers: `/dashboard` route
- Responsibilities: Test creation flow, hive visualization, store hydration

**API Routes:**
- Location: `src/app/api/*/route.ts`
- Triggers: HTTP requests to `/api/*`
- Responsibilities: Server-side logic (checkout, webhooks, subscription sync)

## Error Handling

**Strategy:** Defensive with fallbacks

**Patterns:**
- API routes: Try-catch blocks, return NextResponse.json with error status codes (401, 400, 500)
- Server components: Supabase errors checked via `error` destructure from response
- Client components: Loading states, toast notifications for user feedback
- Middleware: Silent session refresh (doesn't block request on error)
- Store hydration: Catch localStorage errors silently, continue with defaults

## Cross-Cutting Concerns

**Logging:** Console.error for API route failures and webhook errors

**Validation:** Zod schemas (imported in dependencies), manual validation in API routes (e.g., `planId` check in checkout)

**Authentication:**
- Middleware-level session refresh via `updateSession`
- API route-level guard via `supabase.auth.getUser()`
- Client-side mock AuthGuard (350ms skeleton, always passes — placeholder for production)

**Authorization:** Currently mock/placeholder — production would check user roles from Supabase

**Data Fetching:**
- Server components: Direct Supabase queries (planned, not yet implemented)
- Client components: Mock data from `src/lib/mock-*.ts` files
- API routes: Supabase queries + external API calls (Whop)

**Styling:**
- Global tokens: `src/app/globals.css` with `@theme` block (Tailwind v4)
- Design system: Raycast extraction (6% borders, 12px radius, Inter font, coral accent)
- Component styles: Tailwind utility classes via `cn()` helper
- Constraints: `backdrop-filter` applied via inline styles (Lightning CSS strips classes)

---

*Architecture analysis: 2026-02-13*
