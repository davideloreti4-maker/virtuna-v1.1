---
phase: 01-foundation-shell
reviewed: 2026-06-14T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/lib/supabase/middleware.ts
  - src/components/app/home/composer.tsx
  - src/app/auth/callback/route.ts
  - src/app/(app)/home/page.tsx
  - src/components/app/home/home-greeting.tsx
  - src/components/sidebar/Sidebar.tsx
  - src/components/sidebar/SidebarAccountSelector.tsx
  - src/components/app/app-shell.tsx
  - src/app/layout.tsx
  - src/app/globals.css
findings:
  critical: 1
  warning: 6
  info: 5
  total: 12
status: fixes_applied
fixes:
  applied_at: 2026-06-14
  fix_batch_tag: 01-06
  resolved: [CR-01, WR-01, WR-02, WR-03, WR-04, WR-05, WR-06]
  deferred: [IN-01, IN-02, IN-03, IN-04, IN-05]
  resolved_count: 7
  deferred_count: 5
  notes: >-
    Critical (CR-01) + all 6 Warnings fixed, each committed atomically under
    the fix(01-06) tag. IN-05 (misleading same-origin comments) was corrected
    in the auth/callback surface as part of CR-01; the remaining 5 Info items
    are deferred. CR-01 ships a focused open-redirect regression test
    (callback-safe-next.test.ts). Full suite: 1967 passed / 0 failed (was 1945
    baseline; +22 new tests). Build: exit 0.
---

# Phase 01: Code Review Report

**Reviewed:** 2026-06-14
**Depth:** standard
**Files Reviewed:** 10
**Status:** fixes_applied — Critical + all Warnings resolved (fix batch `01-06`); 5 Info deferred. See frontmatter `fixes:` for the commit batch + test/build results.

## Summary

Reviewed the Phase 1 foundation-and-shell surfaces with an adversarial focus on auth/redirect correctness, the TikTok URL trust boundary, and React/Next client-state bugs. The flat-warm token migration (`globals.css`, `layout.tsx`) is clean and the per-file logic is mostly sound, but the review surfaced **one BLOCKER**: a real open-redirect in the OAuth callback whose guarding comment is factually wrong (`new URL(next, origin)` does NOT enforce same-origin — a `//evil.com` `next` param escapes to an arbitrary host). This is directly exploitable via the login `next` deep-link that Phase 1 itself wired.

Beyond the blocker, the warnings cluster around two themes: (1) **client/server URL-validation drift** — the client TikTok regex carries a case-insensitive `/i` flag the server lacks, so a `TIKTOK.COM` URL passes the client and is rejected by the server, and neither regex validates the host boundary tightly (`tiktok.com.evil.com` is matched by neither, but `tiktok.com/`-prefixed paths are accepted without a video-path check); and (2) **persisted client state causing first-paint glitches** — `useSidebarStore` persists `isOpen: true`, so the mobile drawer + backdrop render OPEN on every fresh mobile load, and `useIsMobile` defaulting to `true` makes desktop content paint with a 0px sidebar offset then snap.

The accepted/deferred items (marketing `--gradient-navbar` consumers, pre-existing engine-test `tsc` errors, sidebar emerald/amber score-chips per the phase context's "do NOT re-flag" list) were verified and are NOT re-reported here.

## Critical Issues

### CR-01: OAuth callback open redirect — `new URL(next, origin)` does not enforce same-origin

**File:** `src/app/auth/callback/route.ts:21,60,74` (comment at L19-20)
**Issue:** The handler reads an attacker-controllable `next` query param and redirects to it after a successful code exchange:
```ts
const next = searchParams.get("next") ?? "/home";   // L21 — user-supplied
...
let redirectTo = next;                                // L60
...
const response = NextResponse.redirect(new URL(redirectTo, origin));  // L74
```
The inline comment (L19-20) asserts this is safe because `next` "is only ever resolved via `new URL(next, origin)` (same-origin)... never followed as an absolute external URL (open-redirect guard, V5)." **That claim is false.** `new URL()` with a relative base does NOT pin the host — a protocol-relative or absolute `next` overrides the host entirely. Verified:

| `next` value | `new URL(next, origin).href` | same-origin? |
|---|---|---|
| `//evil.com` | `https://evil.com/` | **NO** |
| `/\evil.com` | `https://evil.com/` | **NO** |
| `https://evil.com` | `https://evil.com/` | **NO** |
| `////evil.com` | `https://evil.com/` | **NO** |

Exploit chain (uses Phase 1's own wiring): `src/app/(onboarding)/login/page.tsx` accepts `?next=` and forwards it into the OAuth `redirectTo`; the provider returns to `/auth/callback?code=...&next=//evil.com`; this handler then 302s the freshly-authenticated user to `https://evil.com/`. Classic post-login open redirect — usable for phishing and (depending on the landing page) token/credential capture.

Note the middleware's own `next` (`middleware.ts:145-146`) is server-generated from `request.nextUrl.pathname`, so it is safe — but the callback consumes a *client*-supplied value and must validate it.

**Fix:** Reject any `next` that is not a same-origin, leading-single-slash, non-backslash path. Normalize before use:
```ts
function safeNext(raw: string | null): string {
  if (!raw) return "/home";
  // Must be a root-relative path: exactly one leading slash, no backslashes,
  // no scheme, no protocol-relative "//". Reject everything else.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return "/home";
  }
  // Defense-in-depth: confirm the resolved URL stays on origin.
  try {
    const resolved = new URL(raw, origin);
    if (resolved.origin !== origin) return "/home";
    return resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return "/home";
  }
}
const next = safeNext(searchParams.get("next"));
```
Apply the same normalization anywhere a `next`/return-to param is consumed for redirect, and fix the misleading comment so future readers don't trust `new URL(x, origin)` as a guard.

## Warnings

### WR-01: Client TikTok regex has an `/i` flag the server regex lacks — silent client/server drift

**File:** `src/components/app/home/composer.tsx:40` vs `src/app/api/analyze/route.ts:465`
**Issue:** The component comment claims the client check "mirrors the SERVER trust-boundary regex." It does not — the flags differ:
```ts
// composer.tsx:40  (client)
const TIKTOK_URL_PATTERN = /^https?:\/\/(www\.|vm\.)?tiktok\.com\//i;   // case-INSENSITIVE
// route.ts:465  (server)
const tiktokPattern = /^https?:\/\/(www\.|vm\.)?tiktok\.com\//;          // case-SENSITIVE
```
Consequence: a URL like `https://www.TIKTOK.com/@x/video/1` (or `HTTPS://...`) passes the client `isValidTikTok` check, enables Submit, fires `stream.start`, and is then **rejected by the server with a 400** ("Invalid TikTok URL"). The user sees a generic stream error for a URL the UI just told them was fine. The two regexes must be byte-identical to honor the stated "fast UX reject mirrors the trust boundary" contract.
**Fix:** Make the client regex match the server exactly. Either drop `/i` on the client, or add `/i` on the server (and accept the looser host casing) — pick one and keep them in sync. Cleanest: drop the client `/i`:
```ts
const TIKTOK_URL_PATTERN = /^https?:\/\/(www\.|vm\.)?tiktok\.com\//;
```
Better still, lift the single source of truth into a shared constant imported by both the route and the composer so they cannot drift again.

### WR-02: Mobile sidebar drawer + backdrop render OPEN on every fresh load (persisted `isOpen: true`)

**File:** `src/stores/sidebar-store.ts:18-31`, surfaced in `src/components/sidebar/Sidebar.tsx:233-239,241-250`
**Issue:** `useSidebarStore` wraps state in `persist({ name: 'virtuna-sidebar' })` with **no `partialize`**, so `isOpen` is persisted to localStorage alongside `isCollapsed`. Its default is `isOpen: true`. On mobile (`useIsMobile()` true), the Sidebar renders the full-screen backdrop and slides the drawer in whenever `isOpen` is true:
```tsx
{isOpen && (<div className="fixed inset-0 ... bg-black/50" onClick={close} />)}
<nav className={cn(..., isOpen ? "translate-x-0" : "-translate-x-[...]")} />
```
So a first-time mobile visitor (or anyone whose last action left `isOpen: true`, which is the default) lands on `/home` with the nav drawer already covering the screen behind a dark backdrop, instead of the clean composer. `isOpen` is session/viewport UI state, not a user preference worth persisting — persisting it is the bug.
**Fix:** Exclude `isOpen` from persistence (only `isCollapsed` is a real desktop preference):
```ts
persist(
  (set) => ({ /* ... */ }),
  {
    name: 'virtuna-sidebar',
    partialize: (s) => ({ isCollapsed: s.isCollapsed }),
  }
)
```
Optionally also default `isOpen` based on viewport, or close it on mount for mobile.

### WR-03: `AppShell` content offset flashes on desktop because `useIsMobile` defaults to `true`

**File:** `src/components/app/app-shell.tsx:28-29` + `src/hooks/useIsMobile.ts:16`
**Issue:** `useIsMobile` initializes `useState(true)` ("mobile for SSR safety") and only corrects to the real value inside a `useEffect` after mount. `AppShell` computes the main-content offset from it:
```ts
const offset = isMobile ? 0 : SIDEBAR_INSET + sidebarWidth + CONTENT_GUTTER;
```
On desktop, the first client paint therefore uses `offset = 0` (content full-width, under where the persistent sidebar will be), then on the post-mount effect tick it jumps to `244px`/`84px`. The result is a visible content shift / layout jank on every desktop navigation into the app shell, and a brief frame where the sidebar overlaps content. This is a correctness-of-layout issue, not just polish — the offset is wrong for one paint.
**Fix:** Render the content with the sidebar-present offset by default and treat mobile as the post-mount correction, OR gate the first paint on a "mounted" flag so the marginLeft is only applied once `isMobile` is known. Minimal:
```ts
// In useIsMobile, expose a `hydrated` flag; in AppShell, until hydrated,
// assume desktop (the dominant app context) so content starts offset, not at 0.
```

### WR-04: Sign-out fires two competing router navigations (race: `/login` push vs `onAuthStateChange` `/` replace)

**File:** `src/components/sidebar/Sidebar.tsx:460` and `src/components/app/auth-guard.tsx:42-49`
**Issue:** The account-menu "Log out" handler does:
```tsx
onClick={async () => { await supabase.auth.signOut(); router.push("/login"); setAccountOpen(false); }}
```
But `AuthGuard` (the wrapping `(app)` layout guard) subscribes to auth changes and, on `SIGNED_OUT`, fires its own navigation to a *different* destination:
```tsx
if (event === "SIGNED_OUT" || !session) { router.replace("/"); }
```
So `signOut()` triggers (a) the explicit `router.push("/login")` and (b) the `onAuthStateChange` `router.replace("/")` — two navigations to two different routes in the same tick. The landing destination is non-deterministic (whichever resolves last wins), and the intended `/login` may be clobbered by `/` (or vice-versa). Functionally the user is logged out, but the post-logout location is a coin flip, which is a real UX/correctness defect for an auth flow.
**Fix:** Pick one owner of the post-logout redirect. Simplest: drop the explicit `router.push("/login")` from the Sidebar handler and let `AuthGuard` own it (and decide whether logged-out should land on `/` or `/login` — be consistent). Or make `AuthGuard`'s `SIGNED_OUT` handler a no-op when an explicit sign-out path already navigated.

### WR-05: Navigate-on-id effect can mis-fire / mis-navigate across consecutive submissions (stale `prevAnalysisIdRef`)

**File:** `src/components/app/home/composer.tsx:85-92`
**Issue:** The id→navigate effect is lifted from `Board.tsx:300-307` but **without Board's compensating guard**. The composer's:
```ts
const prevAnalysisIdRef = useRef<string | null>(stream.analysisId);
useEffect(() => {
  const id = stream.analysisId;
  if (id && prevAnalysisIdRef.current === null) { router.push(`/analyze/${id}`); }
  prevAnalysisIdRef.current = id;
}, [stream.analysisId, router]);
```
fires navigation only on a `null → string` transition. That is correct for the first submit. But the shared `useAnalysisStream` resets `analysisId` to `null` at the *start* of each new `mutateAsync` (`use-analysis-stream.ts:315`), and a "New Simulation" wipe also nulls it. In a flow where the composer stays mounted (the pinned/permalink layout, or a fast re-submit before unmount), the sequence `string → null → string'` will re-fire `router.push` for the new id — which may be intended, but if `analysisId` briefly flips to a *non-null stale* value (e.g. permalink hydration setting `analysisId` from `urlAnalysisId` at `use-analysis-stream.ts:521`) while `prevAnalysisIdRef.current === null`, the composer will push to a `/analyze/[id]` that the user did not just submit. Board guards this with an extra `streamingAnalysisIdRef` (`Board.tsx:181-198,231-237`) precisely to distinguish "an id I started streaming" from "an id that appeared via hydration"; the composer copies the navigate logic but omits that guard, so on the pinned layout it can navigate on a hydration-sourced id.
**Fix:** Mirror Board's full pattern — track the id the composer *initiated* a stream for and only navigate when the new `analysisId` matches a just-submitted run, not any null→string flip. At minimum, only arm the navigation immediately after `handleSubmit` actually calls `stream.start` (e.g., set a `pendingNavRef = true` inside `handleSubmit`, and require it in the effect).

### WR-06: `relativeTime()` returns empty string for any date older than ~1 day, mislabeled as "day"

**File:** `src/components/sidebar/Sidebar.tsx:52-60`
**Issue:** The helper buckets only second/minute/hour/day:
```ts
if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
return rtf.format(Math.round(diffSec / 86400), 'day');   // everything ≥ 1 day
```
A simulation created 45 days ago renders as "45 days ago" — fine numerically, but `Intl.RelativeTimeFormat('en', { style: 'narrow' })` with the `'day'` unit will happily print large day counts ("90d ago") instead of rolling up to weeks/months/years, which reads poorly in a history list and never matches the "narrow" expectation users have (≈ "2mo"). More importantly, the empty-snippet fallback row (`Simulation · {relativeTime(...)}`) depends on this returning a sensible string; for a board with no `content_text` and a `created_at` that fails `Date.parse` (undefined or malformed), `relativeTime` returns `''`, producing a dangling "Simulation ·" with a trailing separator and no time. Edge case, but it ships a visibly broken label.
**Fix:** Add week/month/year buckets and guard the separator so it only renders when there's a value:
```ts
if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
if (abs < 2592000) return rtf.format(Math.round(diffSec / 86400), 'day');
if (abs < 31536000) return rtf.format(Math.round(diffSec / 2592000), 'month');
return rtf.format(Math.round(diffSec / 31536000), 'year');
```
And in the JSX, only render the `·` separator when `relativeTime(board.created_at)` is non-empty.

## Info

### IN-01: `home-greeting.tsx` reads `profile?.name` but `useProfile` types `name` as required `string`

**File:** `src/components/app/home/home-greeting.tsx:29` (`useProfile` at `src/hooks/queries/use-profile.ts:8-13`)
**Issue:** `ProfileResponse.name` is typed `string` (non-optional), yet the component (and Sidebar L429/436) defensively uses `profile?.name?.trim()`. The optional-chaining is correct in practice (the row can be absent / name can be empty), but it signals the *type* is too strict — `name` can realistically be `""` or the row can be missing for a brand-new user, which the API type denies. The runtime guard is right; the type lies. This is a latent footgun: a future refactor that trusts the type (`profile.name.split(...)`) would crash on the empty/absent case.
**Fix:** Loosen the API response type to reflect reality (`name?: string` or `name: string | null`) so the type and the defensive code agree.

### IN-02: `AppShellSkeleton` hardcodes off-palette colors (`#0A0A0A`, `border-zinc-800`) — pre-flat-warm leftovers

**File:** `src/components/app/auth-guard.tsx:67,69`
**Issue:** The loading skeleton (shown on every authed page load while the session check runs) uses `bg-[#0A0A0A]` and `border-zinc-800` and a `w-[248px]` sidebar width — none of which match Phase 1's flat-warm tokens (`bg-background` = `#262624`, `border-white/[0.06]`, sidebar `w-[220px]`). The first paint of the entire app shell is therefore a cold near-black skeleton that visibly mismatches the warm charcoal that follows. It's the literal first thing an authed user sees.
**Fix:** Repoint the skeleton to the flat-warm tokens (`bg-background`, `border-white/[0.06]`) and the real `220px`/`60px` sidebar geometry so the loading state matches the shell it stands in for.

### IN-03: `handleAdd` in account selector doesn't disable/guard against double-submit while the async add is in flight

**File:** `src/components/sidebar/SidebarAccountSelector.tsx:44-51,164-178`
**Issue:** `handleAdd` is `async` (`await addAccount(...)`) but the Add button and the Enter keydown have no in-flight lock — only `disabled={!newHandle.trim()}`. Pressing Enter twice quickly (or Enter + clicking Add) fires `addAccount` twice with the same handle before the first resolves, risking a duplicate account insert depending on `useSocialAccounts` idempotency. Low severity (small surface, fast call), but it's an unguarded async submit.
**Fix:** Add a `const [adding, setAdding] = useState(false)` lock; set it true at the top of `handleAdd`, reset in a `finally`, and include it in the button's `disabled` and the Enter handler's guard.

### IN-04: `Sidebar.tsx` import block is split by inline `const` declarations (style/maintainability)

**File:** `src/components/sidebar/Sidebar.tsx:46-81`
**Issue:** Imports are interleaved with module-level `const` definitions (`rtf` L48, `relativeTime` L52, `scoreTone` L68, `focusRing` L77) and then *more* imports resume at L79-81 (`useSidebarStore`, `createClient`, `SidebarAccountSelector`). Imports below non-import statements is legal but unconventional, hurts scannability, and is the kind of thing that breaks naive import-sorting tooling. The file is also 510 lines — 10 over the project's 500-line soft budget (the phase context flagged this; `SidebarAccountSelector` was already extracted to help). Not a bug, but tidy-up worth doing while the file is open.
**Fix:** Hoist all `import` statements to the top of the file, above the helper `const`s. Consider extracting `relativeTime`/`scoreTone` into a small `sidebar-utils.ts` to drop back under 500 lines.

### IN-05: Misleading "same-origin / no open redirect" comments repeated across auth surfaces

**File:** `src/lib/supabase/middleware.ts:63,131` and `src/app/auth/callback/route.ts:19-20`
**Issue:** Three separate comments assert that `new URL(path, request.url)` / `new URL(next, origin)` is an open-redirect *guard*. For the middleware uses the input is server-generated (a literal `/home`, or `request.nextUrl.pathname`), so those redirects happen to be safe — but the comment credits the wrong mechanism (the safety comes from the input being trusted, NOT from `new URL`). For the callback (CR-01) the same comment is actively false. Propagating "`new URL` makes it same-origin" as institutional knowledge is how CR-01 happened and how the next one will.
**Fix:** Correct the comments to state the real invariant ("input is a server-controlled literal/path, never user-supplied") and, after fixing CR-01, point them at the shared `safeNext`/path-validation helper.

---

_Reviewed: 2026-06-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
