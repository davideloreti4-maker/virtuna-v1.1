# Offline + expired session — the two unhappy paths that have no copy

**Date:** 2026-08-07 · **Branch:** `lane/unhappy-paths` · **Worktree:** `~/virtuna-unhappy-paths`
**Predecessor:** PR #449 (three unhappy-path fixes, merged). These are the two it deferred.

---

## §1 — The defect, in one line each

**Offline.** A run fired with no connection fails into the generic skill-error block:
*"The generation or SIM-1 pass dropped out. Tap to retry — nothing was charged."*
Nothing dropped out, and the retry gets the same failure forever.

**Expired session.** A run fired with a dead session either falls through to that same generic
copy, or hard-redirects to `/login` with no explanation and no rescue of what was typed.

---

## §2 — What is actually true today (verified, not assumed)

Everything here was measured against `main` at `960a8b66` on 2026-08-07. Two of my own
starting premises were wrong and are corrected below; a third number was off by 2.6×.

| Claim | Verdict |
|---|---|
| `navigator.onLine` anywhere in `src/` | **0 hits** — true |
| `online` / `offline` event listeners | **0 hits** — true |
| Client-side `status === 401` checks outside `api/` + `lib/` | **0 hits** — true |
| "There is no client-side session handling" | ❌ **FALSE** — see §2.1 |
| "37 `reportCredit402` call sites" | ❌ **14 call sites in 14 files** (the 37 counted comments + the definition) |
| A 401 from an API route reaches the client | ✅ true — see §2.2 |

### §2.1 — `AuthGuard` already owns session expiry, and it is the reason not to build a second one

`src/components/app/auth-guard.tsx:42` subscribes to `onAuthStateChange` and, on
`SIGNED_OUT || !session`, calls `router.replace("/login")`. Its own docstring names the case:
*"Handles edge cases where middleware might not catch (e.g., session expires mid-use)."*

It is also the **single declared owner** of that navigation. `Sidebar.tsx:757` carries the
scar: *"WR-04: AuthGuard's onAuthStateChange owns the post-logout redirect. Don't navigate
here too — two competing router calls made the landing route non-deterministic."*

**So the design must not add a second redirect owner.** The gap is not absence of handling.
It is two specific holes in the existing handling:

1. **The server can 401 while the client still believes it is signed in.** `onAuthStateChange`
   fires when supabase-js notices — typically on a failed token refresh. A refresh token
   revoked server-side, or a route that refuses for its own reasons, produces a 401 that
   supabase-js never sees. That request dies into the generic engine copy.
2. **When it does fire, the redirect is silent and destructive.** No sentence explaining what
   happened, and an unsent composer draft is gone.

### §2.2 — Why a 401 reaches the client at all

`src/proxy.ts` (Next 15.5 renamed `middleware.ts` → `proxy.ts`) matches everything except
static assets, so `/api/*` does pass through `updateSession`. But `PROTECTED_PREFIXES`
(`src/lib/supabase/middleware.ts:12`) lists only page prefixes — `/home`, `/analyze`,
`/settings`… — so `isProtectedPath("/api/tools/ideas")` is false and no redirect fires. The
request reaches the route handler, which does its own `getUser()` and returns
`{ error: "Unauthorized" }, { status: 401 }` (`api/tools/ideas/route.ts:88`).

### §2.3 — The precedent this mirrors

`src/lib/billing/credit-wall.ts` is the shape to follow: one event constant, a one-line
`reportCredit402(status, body)` at each fetch site, one `CreditWallListener` mounted in
`(app)/providers.tsx:25`, and a `CreditWallRefusal` throwable whose docstring records why it
exists — raising the wall *and* throwing drew the generic error **underneath** the modal, so
the user got a paywall on top and a futile retry below it. A 401 has the identical trap.

### §2.4 — The surface that renders the lie

`src/components/thread/run-notices.tsx:29` holds the default body. `thread-turn.tsx:70` keys
overrides by **skill**:

```ts
explore: { headline: 'Couldn’t reach that source.',
           body:     'Check the handle or niche and try again — nothing was charged.' }
```

With the wifi off, that sentence accuses a handle that is fine. This is the same defect class
PR #449 fixed in calibrate, where the client replaced three honest server reasons with
*"Account not found. Check the handle"* — an accusation the route's own comment says "costs
the creator another paid scrape to act on."

**Therefore: cause must beat skill.** Copy resolves by cause first, skill second, default last.

---

## §3 — Design

### §3.1 — Offline is ambient device state

**`src/hooks/use-online.ts`** — `useSyncExternalStore` over `window`'s `online`/`offline`
events. Client snapshot `navigator.onLine`; **server snapshot hardcoded `true`**.

`useSyncExternalStore` rather than `useState(navigator.onLine)` because `navigator` does not
exist during SSR and the naive form hydration-mismatches. Precedent for the pattern already
exists at `src/components/offer/motion/reveal.tsx:240`.

**`<OfflineNotice />`** mounted beside `CreditWallListener` in `(app)/providers.tsx`. A
persistent quiet bar, **not** a dialog — a modal traps a user who cannot act on it.

⚠️ **It gets no accent.** An offline banner is precisely where a red or coral fill feels
natural, and the accent dosage rule is LOCKED: monochrome by default, sanctioned accent uses
are the live-presence dot, the lit constellation node, and the brand mark. This is none of
them. Cream on the existing chrome tone, 6% border — the same vocabulary as every other
notice. Severity is carried by the words, not by a colour.

**Composer gating** at `composer.tsx:3218`, currently:

```ts
disabled={isAnyStreaming ? false : evidenceFile ? profiling : !canSubmit}
```

Offline folds into the **non-streaming arm only**. While streaming, that control is Stop
(`aria-label="Stop the run"`), and disabling Stop at the moment the connection dies is exactly
backwards.

### §3.2 — Expired session corrects the existing owner rather than competing with it

**`src/lib/auth/session-expired.ts`** — a deliberate 1:1 of `credit-wall.ts` so the pattern is
learned once: `SESSION_EXPIRED_EVENT`, `reportSession401(status, body)`,
`SessionExpiredRefusal`, `isSessionExpiredRefusal`.

`reportSession401` **does not navigate.** It raises the event; `SessionExpiredListener`
(mounted in providers) renders a dialog that explains what happened and offers "Sign in
again". AuthGuard remains the sole owner of `router.replace` (§2.1, WR-04).

**The draft survives.** The dialog must not be dismissible into a state where the typed input
is gone — that is half the reason this path is worth fixing.

### §3.3 — Detection, stated honestly

- A `fetch` rejection on a dead connection is a **`TypeError`**; it never reaches `!res.ok`, so
  today it lands in the outer catch indistinguishable from anything else.
- **A `TypeError` is not proof of offline.** CORS, DNS, and an unreachable server all produce
  it. Classify as offline only when `navigator.onLine === false` as well. Never tell someone
  they are offline on the browser's silence.
- **`navigator.onLine === true` does not mean reachable** — a captive portal reports online. So
  the classifier only ever special-cases the negative; it never asserts connectivity.
- **`AbortError` is excluded outright.** That is the user tapping Stop, not a failure.

### §3.4 — Cause beats skill

`runErrorCopy(err, skillId)` resolves cause → skill → default, so an Explore run that fails
offline says so instead of blaming the handle.

**The retry button follows the connection.** `SkillRunError`'s retry is disabled while
`navigator.onLine === false` and re-enables the moment the `online` event fires — `useOnline`
already re-renders on that transition, so this costs nothing extra. Leaving it live offline
recreates the futile-retry loop that `CreditWallRefusal` exists to prevent; removing it
outright would strand a user whose connection returns a second later.

---

## §4 — Scope, stated as a limit rather than implied as coverage

`reportSession401` goes at the **14 sites that already call `reportCredit402`**. That set is
exactly "fetch sites that can be refused" — the paid run paths, where a silent failure costs
the most.

There are **113 raw `/api` fetch sites in client components and no shared fetch wrapper.** The
other 99 are **not** covered by this work. A 401 from one of them still renders whatever that
surface renders today. Building a wrapper for all 113 is a separate piece of work and is not
smuggled into this one.

---

## §5 — Testing

Real behaviour, not mocks of our own code — the classifier and the hook are the units, and
both are driven by genuinely dispatched events.

| Case | Expected |
|---|---|
| `TypeError` + `navigator.onLine === false` | offline copy |
| `TypeError` + `navigator.onLine === true` | generic copy (the honest non-claim) |
| `AbortError` | no error state at all |
| 401 | session event raised, no second redirect |
| Explore skill + offline | offline copy, **not** "check the handle" |
| `use-online` | dispatched `online`/`offline` events flip the snapshot |

**Browser verification on a production build**, via CDP `Network.emulateNetworkConditions`.
Never dev: a `useRef` + cleanup-only effect already faked an error path here once
(StrictMode double-invoke made `failBack()` a permanent no-op in dev only), and the whole
reason that defect survived is that the error path was invisible to anyone testing in dev.

---

## §6 — Non-goals

No retry queue. No offline persistence. No service worker. No optimistic replay. No shared
fetch wrapper for the other 99 sites.
