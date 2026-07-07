# Handoff — explore-b fresh start (2026-07-07)

**Worktree:** `~/virtuna-explore-b` · **Branch:** `lane/explore-b` · **Dev:** `:3002`
**State:** clean, synced to `origin/main` @ `a3591849`. Deps installed, `tsc` clean, dev server running. **No open work — ready for a new task.**

## Start a new session here

```bash
cd ~/virtuna-explore-b
git fetch origin && git reset --hard origin/main   # only if main moved since a3591849
pnpm install                                        # lockfile is gitignored → drifts on reset
# dev server (direct node, 2GB heap — npx wrapper breaks dev):
NODE_OPTIONS=--max-old-space-size=2048 node ./node_modules/next/dist/bin/next dev -p 3002
```
A dev server is already up on `:3002` from this session. `rm -rf .next` if CSS/token changes don't appear.

**How to work (repo rule):** quick fix → `git switch -c fix/<thing>` off `main`, PR + merge + delete same session. Multi-day milestone → its own sibling worktree. Don't grow a lane branch across weeks. Run `git worktree list` + confirm branch before starting.

## What just shipped from this worktree (all merged to main)

- **#211** (`e0aefea6`) — **coral-red `#FF6363` accent + red Maven gull mark everywhere** (incl. marketing), **"See the room" opens the current docked audience** and drills into the tapped card (was a placeholder-viewer Lens), **arrival count-up fix** (`✦N new` badge; edge moved to the stable `Composer` via `arrivalNonce`), and a **floating home dock** (chat scrolls behind the composer/audience cards). Rebased cleanly over #210 so #210's history/restore + page-wide scroll coexist with the floating dock. Wordmark stayed `font-bold` (700, the original Numen weight — extrabold 800/760 tried and rejected as "weird"). Full detail: `docs/HANDOFF-2026-07-07-audience-room-accent.md` (§Session 2).
- Also now on main from parallel lanes: **#212** `/dev/cards` thread gallery, **#210** faithful thread history/restore + chat-surface scroll, **#209** real drag/tap calendar planner (`planned_posts`).

## Environment notes (carry-over gotchas)

- **Tests:** run `node ./node_modules/vitest/vitest.mjs run <path>` — `npm test`/`npx vitest` print a **fake PASS(0)** and hide real failures.
- **Pre-existing red herrings** (present on `main`, not yours): `app/home` suites throw `No QueryClient set` (#210 added `useQueryClient` to `Composer` with no test provider) — ~34 failures; and 2 `audience-presence` failures (people⇄population toggle only shows drilled-in). Ignore unless you're touching those areas.
- **UI verify:** vitest (node) can't catch Next client/server bundle leaks — do a real browser pass (or `next build`) before marking UI work done. Login for browser tests: `npx tsx e2e/create-test-user.ts` → `e2e-test@virtuna.local` / `e2e-test-password-2026`.
- **Design system:** flat-warm charcoal. SSOT = `src/app/globals.css` (`@theme`) + `docs/DESIGN-SYSTEM.md`. Accent is now coral-red `#FF6363` (was terracotta `#d97757`). `reskin-matte.test.ts` guards against the *old* `#FF7F50`/glass — keep green. `BRAND-BIBLE.md`/`docs/tokens.md`/`docs/components.md` are STALE.
- **Auto-push hook** re-pushes every commit; the auto-wip Stop hook is DISABLED (2026-07-07).

## New work

Direction is open — owner picks the next task. No blockers, no debt owed from this stream.
