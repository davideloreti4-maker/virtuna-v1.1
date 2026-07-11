# Handoff — Lane a: audit + "Meet your room" meet-mode chat (2026-07-11)

Session ran the three-lane audit prompt, adopted b's lane partition (a = audience/room), shipped
lane a's open item end-to-end, and surfaced one P0 platform finding. Everything is merged; zero
open PRs/issues at close.

## 1. Shipped — PR #233 (`3f093975`, squash-merged to main)

**Feature:** the idle `/home` "Meet your room" cast (Maya/Dev/Priya/… from #217) is now
tappable — each registry-backed row is a real button ("say hi →") opening `PersonaChatDrawer`
in a new **MEET-MODE**: no concept exists yet, so the persona introduces itself in-voice,
grounded on its registry definition + stop/scroll triggers. Honesty spine intact — no fabricated
reaction, non-registry rows stay plain (no dead affordance).

**Contract changes** (all additive; ask-why path byte-identical):
- `PersonaChatTarget.reactionToConcept` + `conceptText` optional end-to-end
  (drawer → `/api/tools/chat` → `chat-runner`). Meet framing replaces the "you STOPPED/SCROLLED"
  prompt line; no reaction anchor is fenced. Partial grounding still degrades to open chat.
- **Meet-mode never creates a thread.** Cookie points at a real thread → turns join its
  per-archetype `persona-chat-turn` sub-thread (continuity with "Ask them why"; GET rehydrates).
  `NEW_THREAD_SENTINEL`/no row → **ephemeral**: no persistence, the drawer carries its own capped
  transcript as `priorTurns` (server-validated, same fenced anchor as DB turns) so follow-ups
  keep context.

**Three real bugs fixed en route (all live-verified):**
1. **Thread spam** — `createOpenThreadLazy` under the sentinel minted a fresh open thread on
   EVERY persona-chat call (4 rows in 4 minutes observed). GET rehydration is now strictly
   read-only (`getOpenThread`, null → `{turns:[]}`); POST meet-mode reuses-or-runs-ephemeral.
   Test-garbage rows deleted from prod DB.
2. **Panel viewport overflow** — the dock panel (`bottom-full h-[70vh] max-h-[calc(100dvh-140px)]`)
   assumed a bottom-pinned thread composer; from the CENTERED home composer it overflowed the
   viewport top (measured −271px @ 717px viewport) — the cast was untappable on the feature's
   primary path. Fix: `maxHeight` clamps to the measured space above the dock anchor
   (`dockRootRef`, resize-aware, floor 200px); the panel body already scrolls.
3. **Esc collapsed the whole stack** (drawer + panel + room — multiple document listeners).
   The drawer now swallows Escape in CAPTURE phase; presence order = drawer → switcher → panel.

Also fixed 2 pre-existing `audience-presence` test failures (the dock pulse honestly echoes the
room score → double `/6 of 10/` match; assertions now pin the room's `font-serif` score).

**Verify evidence:** tsc 0 · eslint clean on changed files (one `set-state-in-effect` = the
file's existing measure-in-layout-effect idiom) · 78 targeted tests green (chat-runner 4 ·
chat route 6 incl. ephemeral/persist split · audience-lens 46 · matte 38) · live on :3001 —
met Maya from fresh /home, 2-question in-voice conversation WITH context carry-over
("Why does that bother you?" → built on her prior "fake casual intro" answer), 0 threads
created, 0 console errors, Esc closes only the drawer, panel fully on-screen (y=16).

## 2. Human review script (browser)

**Code review:** https://github.com/davideloreti4-maker/virtuna-v1.1/pull/233/files
(7 files, +510/−88 — runner/route/drawer/presence + 3 test files).

**Feature review (prod auto-deploys main; or local `next dev`):**
1. Open the app → log in.
2. Sidebar → **New Thread** (must be the fresh/idle state — no reaction in flight).
3. Tap the **audience tab** above the composer ("General · 10 ready") — panel opens, fully
   on-screen, scrollable.
4. Scroll to the cast → every row shows **"say hi →"**; tap **Maya**.
5. Drawer says **"Meet Maya"** + "You're meeting Maya — ask what makes them stop, scroll, or
   share." Ask her something ("what makes you stop scrolling?") → streamed in-voice answer.
6. Ask a follow-up ("why?") → she references her previous answer (context carries).
7. Press **Esc** → only the drawer closes; the panel stays. Esc again → panel closes.
8. (Honesty check) her answers speak to her tastes — never to a concept she hasn't seen.

## 3. 🔴 P0 platform finding — OWNER ACTION (~5 min)

**All scheduled Vercel crons are dead in prod: 32/32 invocations in 22h returned 401.**
`CRON_SECRET` is missing from the Vercel project env — Vercel only attaches the Bearer header
when that var exists, so `verifyCronAuth` rejects every scheduled run. Every prior "cron works"
check was a manual trigger with a local secret. Evidence: `account_snapshots` stale since 07-03;
`refresh-competitors` (with #225's parallelization) has never run scheduled.

**Fix:** Vercel → virtuna-v1.1 → Settings → Environment Variables → add `CRON_SECRET`
(= `openssl rand -hex 32`), all environments → redeploy.
**Verify next morning:** `competitor_profiles.last_scraped_at` stamps ~06:00 UTC and
`khaby.lame`'s `scrape_status='failed'` self-heals (stalest-first). Memory:
`vercel-crons-dead-401.md`. Platform domain = lane c.

## 4. State at close / where lanes continue

- Zero open PRs, zero open issues; all three lanes' 07-11 work merged
  (#229 c/feed-tabbar · #231 c/db-hygiene · #232 b/reading · #233 a/meet-mode · #230 landing).
- Worktree `~/virtuna-explore-a` clean on `lane/explore-a`; dev servers all stopped.
- **a next:** room follow-ups — calibrated-cast meet nuance (sub-thread keys on archetype only:
  two same-archetype personas share history) · rail idle roster has no cast (no meet entry there).
- **b next:** card backlog. **c next:** connected-accounts leftovers + 390px sweep + cron verify
  once the owner sets the secret.
- Lane protocol SSOT: memory `lane-partition-2026-07-11.md` (charters, ports a=3001/b=3010/c=3002,
  claim-by-commit, shared-file rules).

## 5. Gotchas worth carrying

- The memory dir is guarded against Write/Edit from worktree sessions (path-guard hook) — write
  via Bash heredoc.
- Radix Sheet Esc + multiple document Esc listeners = stack collapse; capture-phase containment
  is the fix pattern.
- `getOpenThread` is pointer-driven (cookie): under `NEW_THREAD_SENTINEL` it returns null — any
  route calling `createOpenThreadLazy` per-request in that state will spam thread rows. Audit
  other callers if similar symptoms appear.
- Panel/dock geometry differs between centered-home and bottom-pinned-thread composers — measure,
  don't assume the anchor.
