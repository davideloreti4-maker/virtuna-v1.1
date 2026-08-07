# Handoff — the unhappy-paths lane (offline shipped, session half open)

**Date:** 2026-08-07 · **Worktree:** `~/virtuna-unhappy-paths` · **Branch:** `lane/unhappy-paths`
**Read §1 first.** It is the only part that is state; everything below it is why.

---

## §1 — Where this actually is

### Update 2026-08-07 (session 2) — the session half is BUILT and UNPUSHED

| | |
|---|---|
| **PR #454** | **MERGED.** The offline half is live in `main` (`58dbd4c9`). |
| Session-half branch | `lane/session-expired`, worktree `~/virtuna-unhappy-paths`, tip `db3db144` |
| vs `origin/main` | **0 behind, 4 ahead** — `58dbd4c9` at last measure |
| **Not pushed** | **no PR opened** — awaiting the owner's call |
| Gates at the tip | `tsc` 0 · **5460 passed / 0 failed** · `next build` exit 0 |
| Browser | **28/28**, prod build, signed in, two native viewports, **zero spend** |

**Done:** Tasks 1–7 (offline, merged) and Tasks 8–11 (expired session, on the branch above).
**Open:** push + PR, if the owner wants it.

Evidence: `docs/superpowers/plans/2026-08-07-session-expired-walk-evidence.md`

⚠️ **Two more plan errors found in session 2, on top of the eight below.**
1. **The plan contradicted itself on whether the 401 draws an inline error.** Task 8's docstring
   said the refusal exists to draw nothing (the CreditWallRefusal trap); Task 10's edits, as
   written, draw the session copy. The offline half had already shipped `CAUSE_COPY.session` and
   four tests for it, all unreachable. **Owner chose: dialog AND inline copy**, so that copy is now
   live. Do not add an `isSessionExpiredRefusal` early-return to a hook catch — it would suppress
   the very copy the flag exists to trigger.
2. **"19 uniform sites + 1 special" is wrong — there are three shapes.** Only the 8 stream-hook
   sites route through `resolveRunError`. `use-chat-stream`'s 402 is an SSE *event*, not a status.
   The other 11 are bespoke surfaces with their own error UI, and three would have rendered the
   route's raw `Unauthorized` slug — hence `SESSION_EXPIRED_MESSAGE`.

⚠️ **"The draft survives by NOT navigating" is false as written** — see the evidence doc §4. The
composer clears optimistically ~150ms after submit, before any response lands. What is true: the
words move into the thread and stay **on screen** because nothing navigated. The dialog copy was
corrected after the screenshot showed it promising more than that.

---

### Session 1 state (superseded, kept for the reasoning below)

| | |
|---|---|
| Lane tip | `fa34eed9` (pushed) |
| **PR #454** | the offline half — **since merged** |
| Gates at the tip | `tsc` 0 · **5434 passed / 0 failed** · `next build` exit 0 |
| Browser | **21/21**, prod build, signed in, two native viewports, **zero spend** |

Spec: `docs/superpowers/specs/2026-08-07-offline-and-expired-session-design.md`
Plan: `docs/superpowers/plans/2026-08-07-offline-and-expired-session.md`
Evidence: `docs/superpowers/plans/2026-08-07-offline-walk-evidence.md`

---

## §2 — What is left, with the traps already found

### Task 8 — `src/lib/auth/session-expired.ts`

A deliberate 1:1 of `src/lib/billing/credit-wall.ts`. **Read that file first**; the mirror is the
point, so the two refusals are learned once.

🔑 **It must NOT navigate.** `AuthGuard` (`src/components/app/auth-guard.tsx:42`) already owns
session expiry — `onAuthStateChange` → `SIGNED_OUT || !session` → `router.replace("/login")` — and
is the *declared* single owner. `Sidebar.tsx:757` records WR-04: two competing router calls made
the post-logout landing non-deterministic. Adding a second owner rebuilds that bug.

🔑 **The real gap is not "no handling".** It is (a) a server 401 while the client still believes it
is signed in, which supabase-js never sees, and (b) the existing redirect being silent and
destructive.

🔑 **The draft survives by NOT navigating — no persistence needed.** Every piece of composer state
is local `useState` (`composer.tsx:378-488`, `769`) with **zero** `localStorage` writes, so it dies
only on unmount and only a route change unmounts it. Staying put *is* the preservation. Do not
build storage for this. (The AuthGuard-redirect case still loses the draft; that is pre-existing
and explicitly out of scope.)

### Task 9 — `SessionExpiredListener`

⚠️ **Use `w-[calc(100%-2rem)]`, not `w-full max-w-sm`.** The shared dialog primitive's `max-w-sm`
has no gutter below the max — measured at *exactly* the viewport width (x=0, w=375) on iPhone
SE/8, borders and rounded corners severed by the screen edge. PR #449 fixed that across 16
dialogs; a new dialog must not reintroduce it.

The action is a **link** to `/login`, not a `router.replace`. The user chooses; AuthGuard keeps
sole ownership of automatic navigation.

### Task 10 — the call sites

**20 sites across 14 files.** The per-file table is in the spec's §4. Do not re-derive it by
grepping — that count was wrong twice, in both directions (§3).

⚠️ **`use-chat-stream.ts` needs a different edit from the other 19.** It calls
`reportCredit402(402, quota)` — a hardcoded status against an already-parsed quota object, not
`(res.status, err)`. Place the 401 check where the real response status is still in scope. Do not
pattern-match it into the others.

Order the checks 401 first, then 402: a 401 is not a 402, and each check then reads only its own
status.

### Task 11 — the walk

The script is **not committed** (repo-root scratch is clutter here). Recreate from the recipe in
the evidence doc. It needs a prod build served on `WALK_BASE_URL` and `.env.local` for
`NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` / `E2E_USER_*`, mints the session by POSTing the Supabase
token endpoint and writing the chunked `sb-<ref>-auth-token` cookie.

⚠️ **The e2e account is a REAL PRODUCTION account** on the shared Supabase project with
`BILLING_ENFORCE_QUOTA` on. A run costs real credits. The offline walk spent nothing by never
pressing send. The 401 walk can do the same: clear the auth cookies with a draft typed, then fire
a run — the refusal happens *before* any engine spend.

---

## §3 — What the plan got wrong, so the next session does not re-trust it

The plan and spec are good but were wrong **eight times**, every one caught by reading source
rather than by reasoning. Treat their claims as leads, not facts.

1. **"No client-side session handling" was false.** `AuthGuard` owns it (§2, Task 8).
2. **The call-site count was wrong twice.** 37 (counted comments + the definition file), then 14
   (a `grep -vE "// "` filter meant to drop comment-only lines silently ate six real sites with
   trailing comments). Truth: **20 in 14 files**. **Count call sites by listing them.**
3. **A 401 does reach the client** — worth confirming, since if `proxy.ts` had redirected `/api`
   the whole half would be moot. It matches `/api`, but `PROTECTED_PREFIXES` lists only page
   prefixes, so the handler answers 401.
4. **`skill` is not a prop on `ThreadTurn`** — derived at `thread-turn.tsx:196`.
5. **`--color-charcoal-chrome` does not exist**; it is `--color-chrome` (`globals.css:68`).
6. **The Task 4 guard's file set was bigger than its conversion list.** Eight files match
   `use-*-stream.ts`; `use-analysis-stream.ts` makes zero `reportCredit402` calls, so it is
   invisible to any list derived from that set — and owns a real error path.
7. **The notice was positioned on top of the composer** (`absolute inset-x-0 bottom-0`,
   `composer.tsx:3535`).
8. **The fix for 7 had its own bug.** `--mobile-nav-band` is declared inline on `<main>`
   (`app-shell.tsx:172`) and inherits only to `<main>`'s descendants, so from `providers.tsx` it
   resolves to nothing and the `,0px` fallback takes over — correct-looking on desktop, covering
   the hamburger on mobile. The component now owns its offset. **An unresolved `var()` is
   indistinguishable by eye from one that resolved to zero; assert it as a number.**

---

## §4 — Testing notes that cost time here

🔑 **Three of the new tests were worthless as first written**, each caught by mutation, not review:
- the `useOnline` unmount test asserted `result.current` was unchanged after unmount — true whether
  or not the listeners are removed, since that value is frozen either way. It now spies the
  listener registry.
- the abort guard was **unkillable**: a real `AbortError` is a `DOMException`, so
  `instanceof TypeError` already misses it. Rather than keep a line no test could kill, the
  contract it exists for is pinned (name beats type).
- the walk's "send re-enables on reconnect" ran against an **empty composer**, where `canSubmit` is
  false and the disc stays disabled regardless. **An assertion whose precondition makes the outcome
  inevitable is not an assertion.**

🔑 **Mutate every guard, and confirm the substitution LANDED before trusting the result.**

🔑 **The glass and the hook cannot see each other's gaps.** `thread-turn` can resolve copy by cause
perfectly while a hook never records one, and every run still renders the generic copy. Both sides
need a test. Task 4's drift guard proves the symbols are imported, not that the catch writes them.

⚠️ **`perl -0pi` will corrupt UTF-8 if your replacement contains a non-ASCII character.** It reads
in byte mode; a wide char in the replacement forces character output, double-encoding every
existing UTF-8 byte in the file (em-dashes became `â` across six files). **`tsc` and the full suite
both pass with that damage** — it only hits comment text. Keep replacements ASCII-only, and verify
with a non-ASCII byte count against `HEAD` per file.
