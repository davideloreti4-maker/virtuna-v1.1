# Phase 1: Foundation - Research

**Researched:** 2026-02-13
**Domain:** Supabase Auth + Next.js App Router route restructuring + navigation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Auth redirect flow: Claude decides where unauthenticated users land (login page vs landing page -- pick based on existing code)
- Show full-page skeleton (sidebar + content area layout) while auth state is being checked -- no flash of content, no bare spinner
- Preserve deep links: store intended URL, redirect back after successful auth (best value for customer)
- Claude decides session expiry behavior (silent redirect vs toast + redirect)
- Sidebar top section: Dashboard, Content Intelligence (already named this), Earnings -- in that order
- Above Content Intelligence: TikTok account selector showing avatar + @handle of currently connected account
- Bottom navbar: Pricing
- Mobile: hamburger menu (sidebar slides in), no bottom tab bar
- Content Intelligence label is already in the codebase -- keep it
- Soft-hide removed routes: keep code files but remove routes and nav links (can re-enable later)
- Claude decides what /trending resolves to (404 vs redirect)
- Claude audits nav and flags/removes anything that doesn't belong in MVP scope
- 404 page: Claude's discretion -- match Raycast design language, keep it clean
- Auth methods: Email/password + Google OAuth (both native to Supabase)
- Claude decides post-logout destination (landing page vs login page)
- Claude decides sign-out action location in UI (avatar menu, settings, etc.)
- Claude decides whether sign-up/sign-in are same page with toggle or separate routes

### Claude's Discretion
- Auth redirect target for unauthenticated users
- Session expiry handling (silent vs toast)
- Removed route resolution (404 vs redirect)
- Additional pages to remove beyond /trending (audit codebase)
- 404 page design
- Post-logout landing destination
- Sign-out action placement
- Sign-up vs sign-in page structure (toggle vs separate)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Summary

This phase replaces the mock AuthGuard (a 350ms setTimeout that always resolves to "logged in") with real Supabase authentication, restructures routes into three groups, removes the trending page, and updates sidebar navigation for MVP scope. The codebase already has `@supabase/ssr@0.8.0` and `@supabase/supabase-js@2.93.1` installed, with working Supabase client utilities (`src/lib/supabase/client.ts`, `server.ts`, `middleware.ts`) and a middleware that calls `supabase.auth.getUser()` but does not yet enforce auth redirects. The existing code is 80% wired -- the remaining work is adding redirect logic to middleware, creating auth pages, replacing the mock AuthGuard with a real session check, and restructuring navigation.

The trending page consists of 11 files (2 pages, 7 components, 1 type, 1 mock data, 1 hook, 1 store) that need their routes and nav links removed. The sidebar currently shows Content Intelligence, Trending Feed, and Brand Deals as top nav, with Manage Plan, Leave Feedback, Product Guide, and Log Out at the bottom. This needs to be restructured per MVP requirements.

**Primary recommendation:** Use Supabase middleware for server-side auth enforcement (redirect unauthenticated users before page renders), keep existing `@supabase/ssr` patterns, add auth callback route for OAuth PKCE flow, and use server actions for email/password auth. The heavy lifting is in middleware redirect logic and auth UI pages.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/ssr` | `0.8.0` (installed) | Server-side Supabase client with cookie handling | Official Supabase SSR package, handles session refresh in middleware |
| `@supabase/supabase-js` | `2.93.1` (installed) | Supabase client (auth, DB, etc.) | Official JS client |
| `next` | `16.1.5` (installed) | App Router, middleware, route groups, server actions | Framework already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | `4.3.6` (installed) | Form validation for auth inputs | Validate email/password on server actions |
| `zustand` | `5.0.10` (installed) | Client-side state (sidebar, etc.) | Already used for sidebar store, will need auth-adjacent state |

### Alternatives Considered
None needed -- the stack is already installed and the patterns are established in the codebase.

**Installation:**
```bash
# No new packages needed -- everything is already installed
```

## Architecture Patterns

### Current Route Structure (before)
```
src/app/
  (app)/
    layout.tsx          # AppShell + AuthGuard wrapper
    dashboard/          # Main dashboard
    trending/           # TO BE REMOVED (routes only)
    brand-deals/        # Earnings page
    settings/           # Settings page
  (marketing)/
    layout.tsx          # Header wrapper
    page.tsx            # Landing page
    coming-soon/        # Placeholder page
    showcase/           # Component showcase (dev)
    primitives-showcase/
    viral-score-test/
    viral-results-showcase/
    viz-test/
  api/
    whop/checkout/
    subscription/
    webhooks/whop/
    cron/sync-whop/
```

### Target Route Structure (after)
```
src/app/
  (app)/
    layout.tsx          # AppShell + real auth (middleware-enforced)
    dashboard/
    brand-deals/        # "Earnings" in nav
    settings/           # Keep but remove from MVP nav
  (marketing)/
    layout.tsx          # Header wrapper (public)
    page.tsx            # Landing page
    coming-soon/
    pricing/            # New route or redirect to coming-soon
    showcase/           # Dev only (keep)
  (onboarding)/         # NEW route group
    layout.tsx          # Minimal layout (no sidebar)
    login/              # Sign-in page
    signup/             # Sign-up page (or same as login with toggle)
  auth/
    callback/route.ts   # OAuth callback handler (PKCE code exchange)
    confirm/route.ts    # Email confirmation handler (optional)
  api/
    (unchanged)
```

### Pattern 1: Middleware Auth Enforcement
**What:** Use Next.js middleware to check Supabase session and redirect unauthenticated users before page renders
**When to use:** Every request to `(app)` routes
**Example:**
```typescript
// Source: Context7 /supabase/ssr + /websites/supabase
// src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protected routes: redirect to login with deep link preservation
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    const redirectTo = request.nextUrl.pathname + request.nextUrl.search
    url.pathname = '/login'
    url.searchParams.set('redirectTo', redirectTo)
    return NextResponse.redirect(url)
  }

  // Already authenticated users visiting auth pages: redirect to dashboard
  if (user && (request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/signup'))) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}
```

### Pattern 2: Server Actions for Email/Password Auth
**What:** Use Next.js server actions for form-based authentication (sign in, sign up, sign out)
**When to use:** Login and signup forms
**Example:**
```typescript
// Source: Context7 /websites/supabase
// src/app/(onboarding)/login/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  // Redirect to deep link or dashboard
  const redirectTo = formData.get('redirectTo') as string
  redirect(redirectTo || '/dashboard')
}
```

### Pattern 3: OAuth Callback Route Handler (PKCE)
**What:** Route handler at `/auth/callback` that exchanges the OAuth code for a session
**When to use:** After Google OAuth redirect back to app
**Example:**
```typescript
// Source: Context7 /websites/supabase
// src/app/auth/callback/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  let next = searchParams.get('next') ?? '/dashboard'
  if (!next.startsWith('/')) next = '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-code-error`)
}
```

### Pattern 4: Google OAuth Trigger (Client-Side)
**What:** Client-side function that initiates Google OAuth flow via Supabase
**When to use:** "Sign in with Google" button click
**Example:**
```typescript
// Source: Context7 /websites/supabase
import { createClient } from '@/lib/supabase/client'

export async function signInWithGoogle(redirectTo?: string) {
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback?next=${redirectTo || '/dashboard'}`,
    },
  })
  if (error) console.error('OAuth error:', error.message)
}
```

### Anti-Patterns to Avoid
- **Client-side auth checks only:** Never rely solely on client-side `getSession()` -- always verify server-side with `getUser()` in middleware. `getSession()` reads JWT from cookie without server validation; `getUser()` makes a network call to Supabase to verify.
- **Creating new NextResponse without forwarding request:** When calling `setAll` in middleware cookies, you must re-create `NextResponse.next({ request })` to forward the updated cookies. The existing middleware code does this correctly.
- **Blocking auth check in client components:** The current AuthGuard pattern of showing a loading state in a client component is the wrong layer for auth -- middleware handles redirects before the page ever renders. The client-side skeleton is only for the brief moment while server-rendered HTML hydrates.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session refresh | Custom token refresh logic | `@supabase/ssr` middleware calling `getUser()` | Handles token refresh, cookie rotation, PKCE automatically |
| OAuth code exchange | Custom OAuth callback handler | `supabase.auth.exchangeCodeForSession()` | Handles PKCE verifier, token exchange, error states |
| Cookie management | Custom cookie read/write | `@supabase/ssr` `createServerClient` cookie interface | Handles chunked cookies, encoding, expiry automatically |
| Form validation | Manual email/password regex | `zod` schema validation | Edge cases (international emails, password complexity) |
| Protected route enforcement | Client-side route guards | Next.js middleware + Supabase `getUser()` | Runs before render, no flash of content, server-authoritative |

**Key insight:** The existing `src/lib/supabase/middleware.ts` already has the correct cookie handling pattern. It just needs redirect logic added. Don't rewrite the Supabase client setup -- extend it.

## Common Pitfalls

### Pitfall 1: Using `getSession()` Instead of `getUser()` for Auth Verification
**What goes wrong:** `getSession()` reads the JWT from the cookie without server validation. A tampered or expired token passes client checks.
**Why it happens:** `getSession()` is faster (no network call) so developers use it for convenience.
**How to avoid:** Always use `getUser()` in middleware and server components. It makes a network call to Supabase to verify the token. The existing middleware already calls `getUser()` correctly.
**Warning signs:** Auth works in dev but fails in production; users can access protected routes with expired tokens.

### Pitfall 2: Forgetting the Auth Callback Route for OAuth
**What goes wrong:** Google OAuth redirects to your app with a `code` parameter, but there's no route handler to exchange it for a session. User sees an error or lands on a broken page.
**Why it happens:** Email/password auth doesn't need a callback route, so it's easy to forget when adding OAuth.
**How to avoid:** Create `/auth/callback/route.ts` that calls `exchangeCodeForSession(code)`. Register the callback URL in Supabase Dashboard and Google Cloud Console.
**Warning signs:** Google sign-in redirects but user is never authenticated.

### Pitfall 3: Deep Link Loss on Auth Redirect
**What goes wrong:** User visits `/dashboard/settings?tab=billing`, gets redirected to login, logs in successfully, but lands on `/dashboard` instead of their original URL.
**Why it happens:** The redirect-to-login step doesn't preserve the original URL.
**How to avoid:** In middleware, append `?redirectTo=<original-url>` to the login redirect. In the login action, read `redirectTo` from form data or URL params and redirect there after successful auth.
**Warning signs:** Users complain about losing their place after logging in.

### Pitfall 4: Flash of Protected Content Before Redirect
**What goes wrong:** Protected page briefly renders before middleware redirect kicks in.
**Why it happens:** If middleware is misconfigured or the route isn't matched by the middleware matcher pattern.
**How to avoid:** Ensure middleware matcher covers all protected routes. The existing matcher `/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)` already catches everything except static assets -- this is correct.
**Warning signs:** Brief flash of dashboard content for unauthenticated users.

### Pitfall 5: Route Group Layouts with Duplicate HTML/Body Tags
**What goes wrong:** Each route group has its own `layout.tsx` with `<html>` and `<body>` tags. If route groups share a root layout, you get nested HTML documents.
**Why it happens:** The current codebase already has this -- both `(app)/layout.tsx` and `(marketing)/layout.tsx` declare `<html>` and `<body>`.
**How to avoid:** This is actually the correct pattern in Next.js App Router when route groups have different root layouts. Each route group is a separate "root layout" -- Next.js handles this correctly. The `(onboarding)` group will also need its own root layout.
**Warning signs:** None -- this is the intended pattern.

### Pitfall 6: Soft-Hide vs Hard-Delete Confusion
**What goes wrong:** Removing route files entirely makes it impossible to re-enable features later. Leaving routes in place but forgetting to remove nav links creates dead links.
**Why it happens:** The decision says "soft-hide" -- keep code files but remove routes and nav links.
**How to avoid:** For trending: delete the route files (`src/app/(app)/trending/`) but keep the component files (`src/components/trending/`). Remove the trending nav item from sidebar. Remove the trending type/mock-data imports from nav-adjacent code. Keep the component directory intact for potential future use.
**Warning signs:** Dead links in nav; build errors from broken imports.

## Code Examples

### Full-Page Skeleton (Auth Loading State)
```typescript
// Source: Existing codebase pattern (src/components/app/auth-guard.tsx)
// The existing AppShellSkeleton is already well-designed.
// Keep this pattern but trigger it during real auth check, not a 350ms timeout.
// The skeleton shows sidebar + content area matching the app shell layout.

function AppShellSkeleton() {
  return (
    <div className="flex h-screen bg-[#0A0A0A]">
      {/* Sidebar skeleton - hidden on mobile */}
      <div className="hidden w-[248px] shrink-0 flex-col border-r border-zinc-800 p-4 md:flex">
        <Skeleton className="mb-6 h-6 w-6" />
        {/* ... skeleton structure matching sidebar */}
      </div>
      {/* Main content skeleton */}
      <div className="flex-1 p-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-4 h-[calc(100%-56px)] w-full rounded-lg" />
      </div>
    </div>
  );
}
```

### Sign Out Server Action
```typescript
// Source: Context7 /websites/supabase pattern
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')  // Redirect to landing page
}
```

### MVP Sidebar Navigation Config
```typescript
// Target sidebar structure per user decisions
const navItems = [
  { label: "Dashboard", icon: House, id: "dashboard", href: "/dashboard" },
  // TikTok account selector component sits here (avatar + @handle)
  { label: "Content Intelligence", icon: Lightbulb, id: "content-intelligence", href: "/dashboard" },
  { label: "Earnings", icon: CurrencyDollar, id: "earnings", href: "/brand-deals" },
] as const;

const bottomNavItems = [
  { label: "Pricing", icon: CreditCard, id: "pricing", href: "/pricing" },
] as const;

// Removed: Trending Feed, Manage Plan, Leave Feedback, Product Guide, Log Out (from bottom nav)
// Log Out moves to a user avatar dropdown or settings
```

## Codebase Audit: Current State

### Files to Modify

| File | Change | Why |
|------|--------|-----|
| `src/middleware.ts` | Add auth redirect logic (protect `/dashboard/*`, `/brand-deals/*`, `/settings/*`) | Currently just refreshes session, doesn't enforce auth |
| `src/lib/supabase/middleware.ts` | Add redirect logic to `updateSession()` | The redirect logic goes here since middleware.ts delegates to it |
| `src/components/app/auth-guard.tsx` | Replace mock 350ms timeout with real Supabase `getUser()` check OR remove entirely (middleware handles redirects) | Mock auth guard is the core problem |
| `src/components/app/app-shell.tsx` | Remove AuthGuard wrapper (if middleware handles it) or keep skeleton pattern for hydration | AuthGuard wraps everything currently |
| `src/components/app/sidebar.tsx` | Restructure nav items per MVP spec (Dashboard, Content Intelligence, Earnings top; Pricing bottom) | Current nav has Trending Feed, wrong bottom items |
| `src/app/(app)/layout.tsx` | Keep as-is (AppShell wrapper) | Already correct structure |
| `src/app/(app)/trending/page.tsx` | Delete (remove route) | Trending page removed from MVP |
| `src/app/(app)/trending/trending-client.tsx` | Delete (remove route) | Trending page removed from MVP |

### Files to Create

| File | Purpose |
|------|---------|
| `src/app/(onboarding)/layout.tsx` | Root layout for auth pages (minimal, no sidebar) |
| `src/app/(onboarding)/login/page.tsx` | Login page (email/password + Google OAuth) |
| `src/app/(onboarding)/login/actions.ts` | Server actions: login, signup, signInWithGoogle |
| `src/app/(onboarding)/signup/page.tsx` | Signup page (or combine with login) |
| `src/app/auth/callback/route.ts` | OAuth PKCE callback handler |
| `src/app/not-found.tsx` | Global 404 page (Raycast design language) |

### Files to Keep (soft-hidden -- routes removed, code intact)

| File | Status |
|------|--------|
| `src/components/trending/*` (7 files) | Keep code, remove imports from nav |
| `src/types/trending.ts` | Keep type definitions |
| `src/lib/trending-mock-data.ts` | Keep mock data |
| `src/hooks/use-infinite-videos.ts` | Keep hook |
| `src/stores/bookmark-store.ts` | Keep store |

### Trending Files Complete Inventory (11 files + 1 store)

**Route files (DELETE):**
1. `src/app/(app)/trending/page.tsx`
2. `src/app/(app)/trending/trending-client.tsx`

**Component files (KEEP, soft-hidden):**
3. `src/components/trending/video-card.tsx`
4. `src/components/trending/video-detail-modal.tsx`
5. `src/components/trending/video-grid.tsx`
6. `src/components/trending/empty-state.tsx`
7. `src/components/trending/velocity-indicator.tsx`
8. `src/components/trending/video-card-skeleton.tsx`
9. `src/components/trending/tiktok-embed.tsx`
10. `src/components/trending/index.ts`

**Supporting files (KEEP):**
11. `src/types/trending.ts`
12. `src/lib/trending-mock-data.ts`
13. `src/hooks/use-infinite-videos.ts`
14. `src/stores/bookmark-store.ts`

### Nav Audit: What Doesn't Belong in MVP

| Current Item | Keep/Remove | Reason |
|-------------|-------------|--------|
| Content Intelligence (top) | KEEP | Core MVP feature, already correct label |
| Trending Feed (top) | REMOVE | Not in MVP scope |
| Brand Deals (top) | RENAME to "Earnings" | Per user decision |
| Manage Plan (bottom) | REMOVE from nav | Pricing page handles this |
| Leave Feedback (bottom) | REMOVE | Not MVP |
| Product Guide (bottom) | REMOVE | Not MVP |
| Log Out (bottom) | MOVE to avatar/settings area | Per user decision, Claude decides placement |
| Dashboard (top) | ADD | Per user decision, first item |
| TikTok account selector | ADD | Per user decision, above Content Intelligence |
| Pricing (bottom) | ADD | Per user decision |

## Discretion Recommendations

### Auth redirect target: Landing page (/)
**Rationale:** The header at `/` already has a "Sign in" link pointing to `/auth/login`. Unauthenticated users seeing the landing page first is the standard SaaS pattern. The success criteria explicitly state "Unauthenticated user visiting /dashboard is redirected to the landing page."

### Session expiry: Silent redirect to login
**Rationale:** Toast + redirect is better UX in theory but requires client-side infrastructure (toast state surviving navigation). For MVP, silently redirect to login with `?redirectTo=` preserved. The middleware already runs on every request, so an expired session naturally redirects on the next navigation. Add a `?expired=true` query param so the login page can optionally show "Session expired, please sign in again."

### Removed route resolution: 404 via not-found.tsx
**Rationale:** `/trending` should return a 404. Redirecting implies the content moved, which confuses users and search engines. A clean 404 page with a "Go to Dashboard" link is the correct approach. Creating a global `not-found.tsx` handles this and any other missing routes.

### Additional pages to remove: Settings (from nav, keep route)
**Rationale:** Settings page exists but isn't in the MVP nav spec (Dashboard, Content Intelligence, Earnings, Pricing). Keep the route accessible via direct URL but remove from sidebar nav. The sign-out action can live in an avatar dropdown that also links to settings.

### 404 page design: Minimal dark page with Raycast styling
**Rationale:** Match `src/app/(marketing)/coming-soon/page.tsx` pattern -- centered text, dark background, "Go home" button with coral accent. Keep it simple.

### Post-logout destination: Landing page (/)
**Rationale:** After sign out, redirect to the public landing page. This is the standard SaaS pattern and matches the redirect-for-unauthenticated behavior.

### Sign-out placement: Avatar dropdown in sidebar header area
**Rationale:** The sidebar header currently shows logo + collapse button. Add a user avatar (from Supabase user metadata) next to the collapse button. Clicking opens a dropdown with "Settings" and "Sign out" options. This is the Raycast pattern and keeps the bottom nav clean for MVP items only.

### Sign-up vs sign-in: Separate routes with shared layout
**Rationale:** Separate `/login` and `/signup` routes with a shared `(onboarding)` layout. Each page has a link to the other ("Don't have an account? Sign up" / "Already have an account? Sign in"). This is cleaner for URL sharing and analytics than a toggle on one page. Both pages share the Google OAuth button.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | Different cookie API (`getAll`/`setAll` instead of `get`/`set`/`remove`). Project already uses new package. |
| `getSession()` for auth checks | `getUser()` for server-side verification | Supabase best practice 2024+ | `getSession()` only reads JWT locally; `getUser()` verifies with server. Critical for security. |
| Client-side auth guards | Middleware-based auth enforcement | Next.js 13+ App Router pattern | Prevents flash of protected content, runs server-side before render. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (alias) | Recent Supabase docs update | Both work, the project uses ANON_KEY which is fine. |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Replaced by `@supabase/ssr`. Project already uses `@supabase/ssr`.
- `cookies().get(name)` / `.set(name, value)` individual cookie methods: Replaced by `getAll()` / `setAll()`. Project already uses the new API.

## Open Questions

1. **Google OAuth Configuration**
   - What we know: Supabase supports Google OAuth natively. The `supabase/config.toml` has a placeholder for Apple OAuth but not Google.
   - What's unclear: Whether Google OAuth is already configured in the Supabase dashboard (provider enabled, client ID/secret set, redirect URL registered).
   - Recommendation: The planner should include a task to verify Google OAuth is configured in Supabase Dashboard. The code implementation doesn't depend on this -- it uses `signInWithOAuth({ provider: 'google' })` regardless. If not configured, the button will show an error, which is acceptable for MVP (can be configured during deployment).

2. **TikTok Account Selector Data Source**
   - What we know: The user wants a TikTok account selector above Content Intelligence showing avatar + @handle.
   - What's unclear: Where does TikTok account data come from? The `creator_profiles` table has `tiktok_handle` and `avatar_url` fields, but there's no TikTok API integration yet.
   - Recommendation: For Phase 1, render the TikTok selector as a static component using the authenticated user's profile data from `creator_profiles`. If no profile exists yet, show a placeholder "Connect TikTok" button. The actual TikTok OAuth integration is a separate phase.

3. **Supabase Environment Variables**
   - What we know: `.env.local.example` exists (couldn't read due to permissions) and the code references `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - What's unclear: Whether `.env.local` is populated with real Supabase project credentials.
   - Recommendation: Planner should include a verification step that env vars are set before testing auth flows.

## Sources

### Primary (HIGH confidence)
- Context7 `/supabase/ssr` -- Server-side auth patterns, cookie handling, middleware examples
- Context7 `/websites/supabase` -- Auth callback routes, server actions, Google OAuth, signInWithOAuth
- Context7 `/vercel/next.js/v16.1.5` -- Route groups, middleware, not-found pages, server actions, revalidatePath

### Secondary (MEDIUM confidence)
- Codebase analysis -- Direct file reading of all relevant source files in the project
- Supabase `config.toml` -- Auth configuration (JWT expiry, refresh token rotation, email settings, OAuth providers)

### Tertiary (LOW confidence)
- None -- all findings verified against Context7 or codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All packages already installed, versions verified against package.json
- Architecture: HIGH -- Patterns verified against Context7 official docs and matching existing codebase patterns
- Pitfalls: HIGH -- Common pitfalls verified against Supabase official documentation via Context7
- Discretion recommendations: MEDIUM -- Based on standard SaaS patterns and codebase context, but involve UX judgment calls

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (stable -- Supabase SSR and Next.js App Router are mature)
