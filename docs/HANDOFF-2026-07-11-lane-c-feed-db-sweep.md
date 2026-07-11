# Handoff — lane c (explore-c), 2026-07-11: /feed fix · DB hygiene · 390px sweep

**State: everything merged to `main` and live.** Production (virtuna-v11.vercel.app) is READY on
`ab0ab96d` = main's tip = this lane's last merge. No open PRs, no open issues, lane branch = main,
working tree clean, no dev server running.

## Shipped (3 PRs, each verified before merge)

| PR | Squash | What |
|---|---|---|
| #229 | `110b3828` | `/feed`'s 5-tab DiscoverTabBar scrolls in an `overflow-x-auto` wrapper instead of overflowing the page (was +35/+43/+43px on /feed, /feed/hooks, /feed/channels at 390px). **Not** the `min-width:auto` grid trap — an inline-flex sizes to content; nothing above it could shrink it. |
| #231 | `b9f5d064` | DB hygiene sweep, migration `20260711193000_db_hygiene_advisors.sql` **applied to prod**: RLS initplan ×39 → 0 (wrap `auth.uid()`/`auth.email()` in scalar subselects), redundant permissive policies ×3 dropped, `competitor_profiles` always-true client INSERT dropped (writers are all service-role, code-verified), avatars bucket-wide SELECT → own-folder policy (listing closed, avatar upsert preserved), search_path pinned on 10 fns (`public, extensions, pg_temp`), client EXECUTE revoked on 3 server-only RPCs. |
| #235 | `ab0ab96d` | `/start`'s WarmingRail skeleton mirrors the ready rail's scroll geometry — the first visit of the day showed a 764px-wide page (374px h-scroll) while the outliers sim warmed. |

**390px sweep record (as of #235): every route measures exactly 390.** /home /start /audience /feed
/feed/hooks /feed/channels /calendar /library(/saved→) /settings /analyze /competitors(→/feed) and
marketing / + /pricing. The app is horizontal-overflow-clean at mobile.

## Human review checklist (browser)

Production: **https://virtuna-v11.vercel.app** (auto-deploys from main; preview aliases sit behind
Vercel SSO, prod is public). Use DevTools device toolbar at **390×844** for the mobile checks.

1. **/feed at 390px** — page does not scroll sideways; the Watching·Trending·Competitors∣Channels·Hooks
   pill scrolls horizontally by itself (scrollbar hidden); Hooks reachable; tab switching works.
   Same on /feed/hooks and /feed/channels.
2. **/start at 390px, first visit of the day** — while "Testing today's outliers on your people…"
   shows, the skeleton rail scrolls within itself; the page never scrolls sideways. (Later visits
   show the ready rail — also fine.)
3. **App still reads/writes normally after the RLS rewrite** — open /home (threads list), /audience
   (audiences), /calendar (planned posts), send a thread message. Any 0-rows-where-data-existed or
   permission error would implicate #231 — none expected; policy expressions are verbatim, only
   subselect-wrapped.
4. **Avatar re-upload** (Settings → profile photo, twice in a row) — exercises the new own-folder
   storage policy incl. the ON CONFLICT read path.
5. Code review: PRs #229, #231, #235 on GitHub — each body carries its measured proof.

## Gotchas worth keeping (cost something to learn)

- **`set_config('role', …)` inside a single statement does NOT test RLS** — the plan is built as
  superuser and bypasses policies (it "verified" while proving nothing; caught when anon could
  seemingly list avatar objects). Use statement-level `SET LOCAL role authenticated;` +
  `SET LOCAL request.jwt.claims …;` then query — confirmed working via MCP multi-statement.
- **Three-dot diff lies after squash-merges** (second bite of this trap): `git diff A...B` compares
  against the merge-base, so content that reached main via a squashed PR still shows as "branch-only".
  The audit claimed 7 stranded files on `origin/lane/explore-b`; tip-vs-tip byte-diff showed 6 of 7
  already on main, identical. Always verify with `git cat-file -e origin/main:<file>` + content diff.
- **Skeleton/loading states need the same layout constraints as their ready states** — WarmingRail
  forgot the ready rail's `overflow-x-auto` and no test caught it because it only exists pre-data.
- `/api/profile/avatar` upserts with the **user** client → the avatars bucket must keep a SELECT
  policy scoped to own folder (ON CONFLICT DO UPDATE reads the conflicting row). Public-URL
  rendering never touches RLS.

## Open / next

- **Owner, Supabase dashboard (5 min):** enable leaked-password protection; add MFA options; decide
  pg_graphql (app is PostgREST-only — disabling clears the remaining ~100 exposure warns).
- **Owner, one command:** delete the proven-subsumed remote lane snapshots:
  `git push origin --delete lane/explore-b lane/explore-c`
- **c's next session (fresh context):** per-account content pillars — `content_pillars.account_id`
  + gating; handoff `docs/HANDOFF-2026-07-07-per-account-pillars.md`.
- **Parked:** FK/unused-index judgment pass (needs real traffic); grounding backlog (owner-gated).

## Coordination (3 parallel lanes)

Partition + protocol live in shared memory (`lane-partition-2026-07-11.md`): a = home/room+persona,
b = thread cards + Reading, c = layout/Discover chrome + DB. Ports a=3001 b=3010 c=3002. Commit
early = claim (shared .git makes sibling commits instantly visible); PR small, merge same day;
second mover on shared files waits and rebases. It held today: three lanes, ~8 merges, zero conflicts.
