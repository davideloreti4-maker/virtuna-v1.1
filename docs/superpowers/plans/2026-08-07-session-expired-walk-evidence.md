# Verification evidence — the expired-session half

**Date:** 2026-08-07 · **Branch:** `lane/session-expired` · **Worktree:** `~/virtuna-unhappy-paths`
**Build:** `next build` exit 0, served by `next start` on :3005. **Never dev** — a cleanup-only
`useRef` guard already made an error path a silent no-op in dev only, which is exactly why that
defect survived.

**Result: 28/28**, signed in, two natively-opened viewports, **zero engine spend**.

---

## §1 — Gates

| Gate | Result |
|---|---|
| `./node_modules/.bin/tsc --noEmit` | exit 0, no output |
| `./node_modules/.bin/vitest run` | **5460 passed / 0 failed**, 42 skipped |
| `npm run build` | exit 0 |
| Non-ASCII count per changed file vs `HEAD` | every delta explained by an added em-dash; zero mojibake signatures |

## §2 — How the 401 was produced without spending

The e2e account is a **real production account** on the shared Supabase project with
`BILLING_ENFORCE_QUOTA` on, so a completed run costs real credits. The walk never completes one:
it types a draft, **clears the auth cookies**, and only then presses send. The route's own
`getUser()` refuses before any engine work, so the refusal is free. Nothing is ever sent while
authenticated.

That is also the exact gap this lane exists for — a server 401 while the client still believes it
is signed in. `context.clearCookies()` reproduces it faithfully: supabase-js is never told.

Observed on both viewports: `a 401 actually reached the client — /api/tools/chat`. Asserted, not
assumed, by recording every response status the page received.

## §3 — What was checked, both viewports

Each viewport gets its **own context opened at that size**; resizing a loaded page does not give
you the mobile UI.

| # | Check | Desktop 1440×900 | Mobile 390×844 |
|---|---|---|---|
| 1 | `/home` loads signed in, no bounce to `/login` | ✓ | ✓ |
| 2 | draft present in the composer before the refusal | ✓ | ✓ |
| 3 | **send is enabled with that draft** (the precondition) | ✓ | ✓ |
| 4 | auth cookies cleared — the session is genuinely dead | ✓ | ✓ |
| 5 | a real 401 reached the client | ✓ `/api/tools/chat` | ✓ `/api/tools/chat` |
| 6 | the session dialog is showing | ✓ | ✓ |
| 7 | it says signed out, and never the `Unauthorized` slug | ✓ | ✓ |
| 8 | offers a "Sign in again" link to `/login` | ✓ | ✓ |
| 9 | dialog keeps a gutter, not flush to the screen edge | ✓ x=528 w=384 | ✓ **x=16 w=358 vw=390** |
| 10 | no accent anywhere in the dialog (**computed**, not grepped) | ✓ | ✓ |
| 11 | **the app did NOT navigate on its own** | ✓ `/home → /home` | ✓ `/home → /home` |
| 12 | the user's words are still on screen | ✓ | ✓ |
| 13 | composer cleared optimistically on submit (recorded) | ✓ | ✓ |
| 14 | **the failed turn reads as signed-out, not "dropped out"** | ✓ | ✓ |

Row 3 exists because of the offline walk's own lesson: its first run "passed" a re-enable check
against an **empty** composer, where the control is disabled for a reason unrelated to the thing
under test. An assertion whose precondition makes the outcome inevitable is not an assertion.

Row 9 is the PR #449 defect. `max-w-sm` alone renders *exactly* the viewport width below 384px;
`x=16` on a 390px screen is the primitive's `w-[calc(100%-2rem)]` gutter surviving.

Row 10 is measured off `getComputedStyle` across the dialog subtree, not grepped from markup — a
class scan cannot see an accent arriving through an inherited class or a token that resolves to it.

Row 14 is measured with the dialog **removed from a clone of the document**. The dialog says
"signed out" too, so asserting against the whole page would have passed on the dialog alone and
proved nothing about the turn.

## §4 — The claim that was wrong, and what is true instead

The spec and handoff both assert: *"The draft survives by NOT navigating — no persistence needed."*

**As literally written, that is false, and the walk caught it.** The first run was 22/24; both
failures were the draft check. A follow-up probe sampled the composer ~150ms after submit — before
any response could have landed — and found it **already empty**. The composer clears
optimistically on submit. That has nothing to do with the 401, and no amount of not-navigating
brings it back.

**What is true is narrower and still worth the design.** The words are not destroyed; they move
into the thread as the sent turn, and they are still on screen after the refusal *because nothing
navigated*. A `router.replace("/login")` — the second redirect owner this lane deliberately did not
build — unmounts the thread and takes them with it. So the guarantee is "your words are still in
front of you", not "your draft is still in the box".

⚠️ **This surfaced a copy bug in the dialog, found by looking at the screenshot rather than by any
probe.** The first version ended *"— anything you've typed is still here"*, which a user reads as
"still in the composer". After a send it is not. The sentence now claims only what is true:
*"Sign in again to pick up where you left off."*

## §5 — What is NOT covered

- The **other case still loses the draft and is out of scope**: when supabase-js itself notices
  (`SIGNED_OUT`), `AuthGuard` fires `router.replace("/login")`, the composer unmounts, and the
  typed input is gone. Changing that means overriding the declared single owner of that redirect
  (WR-04) or building draft persistence. Neither is smuggled in here.
- **The other 99 raw `/api` fetch sites.** This lane covers the 20 that already handle the credit
  402 — the paid run paths. A 401 from any of the other 99 still renders whatever that surface
  renders today. A shared fetch wrapper is separate work (spec §4.1).
- The walk drives the **chat** send path. The other 19 sites are covered by the drift guard (they
  call it) and by the hook test (the call does something), not by a browser walk each.

## §6 — Reproducing

The walk is **not committed** — repo-root scratch is clutter here. It lives at
`<session scratchpad>/session-walk.mjs` and needs a production build on `WALK_BASE_URL`
(default `:3005`), `.env.local` for `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY`, and
`E2E_USER_EMAIL` / `E2E_USER_PASSWORD` **from the environment** — this worktree's `.env.local`
carries no `E2E_USER_*`, and they must not be written into a new tracked file.

It mints the session by POSTing the Supabase token endpoint and writing the chunked
`sb-<ref>-auth-token` cookie; `e2e/auth.setup.ts`'s form-driving approach is not used here because
`/login` is emailed-code-first.
