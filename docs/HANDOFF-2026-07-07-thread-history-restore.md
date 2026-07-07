# Handoff — Thread history, faithful restore & chat-surface scroll (2026-07-07)

Lane: `lane/explore-a` (worktree `~/virtuna-explore-a`, dev :3001).
Ships four fixes to the `/home` thread system reported from live use.

## The four problems

1. **Opening a paused thread bumped it to "most recent."** Re-opening an old
   chat from the sidebar jumped it to the top of history. It should only move
   when a message is actually sent into it.
2. **Empty "New Thread" polluted history.** Clicking New Thread (or ⌘N) inserted
   a blank thread row before any message was sent, so untitled ghosts appeared in
   the list. A thread should enter history only once it holds a message.
3. **Reopening a thread was lossy.** The user's own message was missing, chat
   turns rendered with the wrong role/wording, and the thread didn't come back
   "the same way it was left."
4. **Threads didn't scroll like a chat.** Only the inner 760px column scrolled
   (wheel dead over the margins) and a scrollbar was visible on the right.

## Root cause (issues 1 & 2)

The server had **no explicit "which thread is open" pointer**. It inferred the
ACTIVE thread as *the most-recently-updated open thread*
(`getOpenThread` → `ORDER BY updated_at DESC`). That conflated two things:

- which thread is **currently open** on screen, and
- which thread was **messaged last** (its sidebar sort position).

So merely opening an old thread had to bump its `updated_at` (→ reorder), and
starting fresh had to insert a row to become "newest" (→ blank thread in history).

## The fix — an explicit active-thread pointer

`src/lib/threads/active-thread-cookie.ts` (new) — a same-origin cookie
(`maven_active_thread`) naming the open thread id, or the `__new__` sentinel for a
fresh blank thread. Client-managed (`set/get/clear`), sent on every request so the
server resolves the target thread **centrally** — no per-route wiring across the
13 tool routes.

- **Not httpOnly by design:** the value is only a thread id; the server ALWAYS
  re-verifies ownership (`user_id` scope) before trusting it. A forged/foreign/
  stale id falls through to the newest-open default.
- Chosen over a URL param (`/home?t=…`) because `/home` deliberately avoids
  `useSearchParams` (it would force a Suspense boundary / client-only de-opt —
  see the comment in `composer.tsx`). The cookie gets the same refresh-safe,
  central behaviour without fighting the SSR design. **Trade-off:** two tabs share
  the pointer for *sending* (viewing is independent) — same class of limitation as
  the old "active == newest" model, acceptable for now.

### `getOpenThread` (`src/lib/threads/threads.ts`)
Now pointer-aware: `__new__` → `null` (empty new thread); a concrete id → that
thread *if still an owned open thread*; otherwise → newest-open (unchanged
default). `readActiveThreadPointer()` swallows the out-of-request-scope throw so
unit tests (which call the helpers directly) fall back to the old behaviour.

### Sort order (`src/lib/threads/messages.ts`)
Opening no longer touches `updated_at`, so **`insertMessage` now bumps the parent
thread's `updated_at`** — a *sent message* is the only thing that promotes a thread
up the list. Sidebar sorts by last message, as expected.

### Client wiring
- `Sidebar.tsx` — **open** re-points the cookie (no touch, no round-trip) and sets
  the active id; **New Thread** points at `__new__` and creates no row; **delete of
  the active thread** clears the pointer. Active-row highlight keys off the
  `board-store.activeThreadId`, not "row 0". (Removed the now-unused
  `useCreateThread`/`useActivateThread` calls + `activatingId` feedback state.)
- `board-store.ts` — added `activeThreadId` + `setActiveThreadId` (drives the
  highlight; survives the `switchThread` reset; synced by the composer on refresh).
- `composer.tsx` — `ensureThreadForSend()` creates the row lazily on the first
  message (flips `__new__` → real id before the skill runs), and the rehydration
  syncs `activeThreadId` from the loaded thread id.

## Issue 3 — faithful restore

- **Persist the user turn for every skill.** Only `chat` used to persist the
  user's message. New route `POST /api/threads/user-turn` stores it as a
  `role:"user"` markdown message; the composer fires it (fire-and-forget) for
  idea/hooks/script/remix/explore/simulate/predict (chat still persists its own
  turn server-side to keep its refine anchor).
- **Restore it on reopen.** Rehydration is now **role-aware**: it restores the last
  `role:"user"` markdown as `lastUserTurn` (the top "you asked" bubble, matching the
  live single-turn layout) and feeds **only assistant/tool** blocks into the type
  buckets — so a user turn never renders as an assistant card/chat reply (this also
  fixes chat reopen, where user + assistant markdown used to mix in one bucket).
- **"Loading state"** is intentionally *not* replayed — reopening shows the
  completed thread (user turn + final cards + restored tool), not the spinner.
- **Known limit:** multi-*skill* interleaved threads still restore per-type (the
  common single-skill thread is faithful). A future unified message-ordered
  renderer would make mixed threads exact.

## Issue 4 — chat-surface scroll

- `globals.css` — scrollbars hidden app-wide (`scrollbar-width:none` +
  `::-webkit-scrollbar{display:none}`); scrolling stays functional. Matches the
  matte "one continuous surface" rule (the sidebar already hid its bar).
- `composer.tsx` (thread mode) + `home-page-layout.tsx` — the thread scroll region
  is now **full-width** (content re-centered at 760px inside the scroll AND the
  pinned dock), so the wheel works across the whole surface and it reads as a real
  chat. The single composer instance stays mounted across empty↔thread (no state
  reset).

## Verification

- `tsc --noEmit` clean.
- `vitest` green for `src/lib/threads`, `src/app/api/threads`, `src/app/api/tools`
  (112 passing; messages.test mock extended for the new `updated_at` bump).
- Dev server recompiles clean.
- ⚠️ One pre-existing failure: `api/tools/remix/run` "SSE emits stage…" fails on a
  clean tree too (missing `stage` event in the test env) — **not** caused by this work.
- Browser E2E not run (no automation in-session) — manual checks:
  1. Open old thread → stays in place; send → then jumps to top.
  2. New Thread + no message + open another → no ghost row.
  3. Send hooks/ideas → open another → reopen first → question bubble + cards back.
  4. Scroll anywhere on a thread → no visible bar, whole surface scrolls.

## Cleanup left for later
- Dead code: the `POST /api/threads/[id]/activate` route and the
  `useCreateThread`/`useActivateThread` hooks are no longer called.
- A unified message-ordered thread renderer (removes the multi-skill restore limit).
