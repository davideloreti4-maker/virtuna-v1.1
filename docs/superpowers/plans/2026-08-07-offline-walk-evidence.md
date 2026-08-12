# Offline half — browser verification evidence

**Date:** 2026-08-07 · **Branch:** `lane/unhappy-paths` · **Tasks 1–7**
**Build:** `next build` + `next start --port 3007` (a production build, never dev)
**Result: 21/21 passed**, two viewports, signed in as the e2e account.

---

## Why a production build, signed in, at native viewport sizes

Three separate traps, each of which has produced a false pass in this repo before:

- **Dev lies about error paths.** A `useRef` + cleanup-only effect made `failBack()` a permanent
  no-op *in dev only* (StrictMode double-invoke), so the error path was invisible to anyone
  testing in dev. Production was fine. This walk is on `next build` + `next start`.
- **Resizing a loaded page does not give you the mobile UI.** One browser context per viewport,
  each opened at that size.
- **A green suite can sit on top of a surface that never worked.** ~5,200 tests passed over a
  home thread whose view never scrolled. Everything below is measured geometry and computed
  style, not a unit assertion restated.

## Spend

**Zero.** The e2e account is a real PRODUCTION account on the shared Supabase project with
`BILLING_ENFORCE_QUOTA` on, so a run costs real credits. The walk types a draft and never presses
send. Note the consequence: the offline *run-failure copy* cannot be reached this way, because
producing it would mean starting a billed run and killing the connection mid-flight. That copy is
covered by the unit tests plus the mechanism probe below, and is called out as the one thing here
not seen end-to-end in a browser.

## The mechanism, checked before any of the UI

Every unit test sets `navigator.onLine` by hand, so all of them would stay green even if a real
browser never satisfied the classifier's two conditions together. Measured in real Chromium:

| Checked | Result |
|---|---|
| `setOffline(true)` flips `navigator.onLine` | `false` ✓ |
| `fetch` rejects rather than resolving non-ok | rejects ✓ |
| the rejection is a real `TypeError` | name `TypeError`, message `Failed to fetch` ✓ |
| `navigator.onLine === false` **inside the catch** | `false` ✓ |
| both `offline` and `online` window events fire | `["offline","online"]` ✓ |

## The walk — 21/21

| # | Check | Desktop 1440×900 | Mobile 390×844 |
|---|---|---|---|
| 1 | signed in, `/home` did not bounce to `/login` | ✓ | ✓ |
| 2 | no notice while online | ✓ | ✓ |
| 3 | with a draft typed and online, send is **enabled** (the control baseline) | ✓ | ✓ |
| 4 | the notice appears when the connection drops | ✓ | ✓ |
| 5 | it is really `fixed` and its `top` resolved to a real value | `top: 0px` | `top: 46px` |
| 6 | no accent in the **computed** background or text | `bg rgb(26,26,25)` `fg rgb(194,189,180)` | same |
| 7 | it clears the mobile top-nav band | n/a | `y=46` |
| 8 | it does **not** cover the composer's send control | notice `y0 h37` vs send `y830` | notice `y46 h57` vs send `y770` |
| 9 | send is disabled while offline | ✓ | ✓ |
| 10 | the notice clears on reconnect | ✓ | ✓ |
| 11 | send re-enables on reconnect, same draft still typed | ✓ | ✓ |

### Row 5 is the one that justifies the whole walk

`top: 46px` on mobile is the custom property **resolving**. The plan's original design read
`--mobile-nav-band`, which is declared inline on `<main>` (`app-shell.tsx:172`) and therefore
reaches only `<main>`'s descendants — from `providers.tsx` it resolves to nothing and the `,0px`
fallback silently takes over. That failure mode renders a bar at `top: 0`, which looks *correct*
on desktop and covers the hamburger on mobile. **`0` and "failed to resolve" are indistinguishable
by eye**, which is why this is asserted as a number.

### Row 6 is measured, not grepped

The unit test greps the markup for `#FF6363` and `--color-accent`. That cannot catch an accent
arriving through an inherited class or a token that resolves to the accent. `rgb(26,26,25)` is
`#1a1a19` (`--color-chrome`) and `rgb(194,189,180)` is `#c2bdb4` (cream secondary), read off
`getComputedStyle`.

### A concern raised and dismissed on evidence

The disabled send disc did not *look* disabled in the screenshot. Checked at the source rather
than by eye: the shared `Button` already applies `disabled:pointer-events-none disabled:opacity-50`
and `aria-disabled` (`button.tsx:40,170`). It dims and stops accepting pointer events. No change
needed.

### One assertion that failed, and why it was the test's fault

The first run was 19/21. Both failures were `send re-enables on reconnect` — because the walk
tested it with an **empty composer**, where `canSubmit` is false and the disc stays disabled for a
reason unrelated to the connection. The walk now types a draft first and asserts the enabled
baseline (row 3) *before* going offline, so rows 9 and 11 mean something. **An assertion whose
precondition makes the outcome inevitable is not an assertion.**

## Reproducing

The walk script is not committed (repo-root scratch scripts are clutter here). It lives at
`<session scratchpad>/offline-walk.mjs` and needs: a production build served on `WALK_BASE_URL`,
and `.env.local` for `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` / `E2E_USER_*`. It mints the session
by POSTing the Supabase token endpoint and writing the chunked `sb-<ref>-auth-token` cookie —
`e2e/auth.setup.ts`'s form-driving approach cannot be used, as `/login` is emailed-code-first.
