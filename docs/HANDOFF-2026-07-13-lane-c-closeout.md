# Lane C — worktree closeout (2026-07-13)

`~/virtuna-explore-c` · branch `lane/explore-c` · dev port 3002 · lane charter = **discover / data / DB**.

**Status: CLOSED.** 23 PRs shipped, all squash-merged to `main`. Nothing uncommitted, nothing
stranded, no unmerged work anywhere in the worktree. Everything below is either live on `main`
or explicitly owner-gated.

---

## 1. Everything this worktree shipped

| PR | Squash | Date | What |
|----|--------|------|------|
| #203 | `6be110bf` | 07-06 | Maven gull mark + Numen→Maven product rename |
| #209 | `282704d7` | 07-07 | Real drag/tap content planner (`planned_posts`) + /start consistency |
| #213 | `77f146ce` | 07-07 | Dissolve the Grow hub → Analytics tab on /audience, Referrals → Settings |
| #214 | `46b1c5ac` | 07-07 | First-class connected accounts (multi-account, multi-platform) |
| #215 | `05b9c4f6` | 07-07 | Connect UI — account switcher, connect flow, source picker |
| #216 | `d728b4bd` | 07-07 | Multi-platform connect (Instagram + YouTube) via Apify |
| #219 | `12ab509d` | 07-10 | One-bright-thing composer restyle + **restore app-wide font weights** |
| #221 | `ec9cea83` | 07-10 | The ranked audience list survives a typed ask |
| #224 | `47d6502a` | 07-10 | Idea card stops overflowing the mobile viewport |
| #227 | `523415a7` | 07-10 | Handoff + the `grid` `min-width:auto` trap |
| #229 | `110b3828` | 07-11 | Discover tab bar scrolls instead of overflowing the viewport |
| #231 | `b9f5d064` | 07-11 | DB advisor hygiene sweep — initplan ×39, redundant policies, `search_path`, revokes |
| #235 | `ab0ab96d` | 07-11 | /start warming skeleton rail scrolls instead of widening the page 374px |
| #237 | `37243ed0` | 07-11 | Handoff — /feed tab bar, DB hygiene, 390px all-routes sweep |
| #239 | `7148c1c5` | 07-12 | Secondary-pages UX pass — mobile H1 clip, audience-card crush, locale leak, blank /analyze, Discover header jump |
| #243 | `299fcb31` | 07-12 | Leftovers — feed filters closed by default, hooks placeholder dropped, settings left-anchored |
| #245 | `704f55f5` | 07-12 | Handoff — secondary-pages UI/UX pass |
| #251 | `3807e2d5` | 07-12 | **Sidebar threads get real names** — write-once `threads.title` + block-aware derivation |
| #252 | `4358cd0b` | 07-12 | Shared `renderWithClient` wrapper — un-red the 34 composer/home tests |
| #255 | `f5ceb9b3` | 07-13 | Channels stop printing `--` as a follower count |
| #256 | `ee0e3734` | 07-13 | Covering indexes for the 12 unindexed foreign keys |
| #258 | `323d1cbd` | 07-13 | **Content pillars are per connected account, not per user** |
| #260 | `2d363598` | 07-13 | Debt burn-down closeout + prod-cron blocker |

### The three that carry real weight

- **#214 → #216, connected accounts.** The account became a first-class row (`connected_accounts`),
  which is what let /start, /audience and the crons stop assuming a single hardcoded handle.
  #258 finished the job three weeks later — see below.
- **#219, the font-weight fix.** `--font-medium: 500` in Tailwind v4's `@theme` generates
  `.font-medium { font-family: 500 }`, which *shadows* the built-in weight utility. Every weight
  in the app had been silently flattened to 400 across 616 usages / 223 files. `--font-*` is the
  font-FAMILY namespace; weight tokens do not belong there. (Now documented in `CLAUDE.md`.)
- **#258, per-account pillars.** `content_pillars` rows were user-scoped while `account_posts` and
  their `pillar_id` assignments were already account-scoped, and the cron only clustered
  `if (account.is_primary)`. So every secondary account connected since #216 rendered an empty
  pillar rail *forever* — and without that primary-only gate, a second handle's posts would have
  been classified into the first handle's frozen themes, silently merging two content strategies.

## 2. Migrations shipped from here (all applied to prod `qyxvxleheckijapurisj`)

| Migration | PR |
|-----------|-----|
| `20260707120000_planned_posts.sql` | #209 |
| `20260707140000_connected_accounts.sql` | #214 |
| `20260711193000_db_hygiene_advisors.sql` | #231 |
| `20260712120000_thread_titles.sql` | #251 |
| `20260712170000_fk_covering_indexes.sql` | #256 |
| `20260712173000_content_pillars_account_id.sql` | #258 |

All are idempotent (`if not exists` / `drop constraint if exists`) and were applied to prod *before*
merge, so a replay is a no-op. `20260712173000` also ran a backfill (pillars → the user's
`is_primary` account); prod pre-state was 5 pillar rows / 1 user / 1 account / 0 orphans, so the
backfill was unambiguous.

## 3. Open debt — none of it is code

Nothing in this lane is half-finished. What remains needs the owner:

1. 🔴 **`SUPABASE_SERVICE_ROLE_KEY` is missing from Vercel production.** `CRON_SECRET` landed, so the
   401s stopped — but every cron now returns **500 `supabaseKey is required`**, because
   `src/lib/supabase/service.ts` requires that key and `vercel env ls production` lists only
   `CRON_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. **Until this is added
   + redeployed, all scraped data in prod is frozen**: no competitor snapshots, no account
   time-series (stale /start deltas + sparklines), no trend calc, and pillars never re-cluster —
   including the secondary-account pillar sets #258 just enabled. Verify by checking that the next
   ~06:00/07:00 UTC run writes fresh `competitor_snapshots` / `account_snapshots` rows.
2. **The pillar-confirm flow is still user-level** while pillars are now per-account.
   `anyUnconfirmedPillars` has zero callers and `pillar-confirm-card` isn't mounted, so it's dormant
   and harmless — but whoever wires that card must scope it (and the `confirmed: true` sweep in
   `actions/content-pillars/save-pillars`) by `account_id`, or confirming one handle's pillars
   silently confirms every handle's. Noted in `pillars-repo.ts` at the function.
3. **~40 `unused_index` DROP candidates** from the Supabase advisor — parked on purpose. With no real
   production traffic, "unused" means "unmeasured". Revisit after the crons have run for weeks.
4. **Taste calls, unprioritized:** sidebar-collapse affordance discoverability; the mono-lowercase
   subtitle voice is inconsistently adopted outside Discover/calendar.

## 4. Worktree safety state

- Working tree **clean**; no untracked files; no local branches unique to this worktree.
- `lane/explore-c` is synced to `origin/main` (`2d363598`).
- `origin/lane/explore-c` is **stale but redundant** — its 6 unique commits (font-weight fix,
  composer restyle, audience hover fix, 3 handoff docs) are all present on `main` via squash-merge,
  verified by content, not by SHA. Safe to delete.
- The 4 repo-wide `git stash` entries are **not** from this worktree (stashes are shared across all
  worktrees off the single `.git`) — left untouched.
- Dev server on :3002 killed.

Removing the folder is safe whenever you like — a worktree is not a clone; deleting it keeps every
branch and commit in the shared `~/virtuna-v1.1/.git`:

```bash
git worktree remove ~/virtuna-explore-c       # from any worktree
git push origin --delete lane/explore-c       # optional: drop the stale remote branch
```

## 5. Gotchas this lane paid for (will bite the next one)

- **rtk shell shims fake tool output.** `npx tsc` / `npx next lint` / `npm test` print compressed
  one-liners with no detail. Use the real binaries: `./node_modules/.bin/eslint <files>`,
  `node ./node_modules/vitest/vitest.mjs run <paths>`.
- **Tailwind v4 `--font-*` is the font-FAMILY namespace.** Never declare weight tokens there (#219).
- **`gh pr merge --squash --delete-branch` prints `fatal: 'main' is already used by worktree`** — the
  merge *succeeded*; only the local branch-switch failed. Confirm with `gh pr view <n> --json state`.
- **Playwright: navigate before evaluating.** `browser_run_code_unsafe` on a fresh context throws
  "Target page has been closed" unless `browser_navigate` ran first.
- **Memory-dir writes are blocked** for Edit/Write from a worktree session (path guard). Use Bash.
- Auth for browser verification: `e2e-test@virtuna.local` / `e2e-test-password-2026`; login lands
  on `/dashboard`, and the pillar rail lives on `/calendar` and `/audience?tab=account` (not /start).
