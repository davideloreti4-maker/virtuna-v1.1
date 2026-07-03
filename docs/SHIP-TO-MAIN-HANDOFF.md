# Ship `milestone/surfaces` → `main` — Handoff

> **Created 2026-07-04** for a FRESH session. The Surfaces milestone has a large stack of
> verified, honest, MERGED value sitting on `milestone/surfaces` that is **not in production**.
> This session's job is **ship-prep**: fix the one known deploy blocker → audit the honesty
> spine → converge to `main`. **Not** to build new surfaces. Companion SSOTs: this doc +
> `docs/THE-CONTRACT.md` §6 (seam ownership) + the auto-memory `numen-surface-vision-competitive`.

---

## 0. TL;DR
`milestone/surfaces` (tip after #120) carries 6 real surfaces besides `/start`. Get it to `main`:
1. **Fix the Vercel preview blocker** (serverless-function-memory) — the one known thing between this milestone and shipping.
2. **Audit the honesty spine** (every mock/stub is LABELED Directional / not-real; nothing fabricates a real audience reaction or real analytics).
3. **Open a PR `milestone/surfaces` → `main`**, review, merge.
> ⚠️ Converging ships the surfaces **without the live ambient graft** (still Directional/stubbed — The Room's atoms not landed). That is an honest INCREMENT, not the full "ambient everywhere" vision. **Confirm the owner wants to ship the increment now** before merging to main (see §5).

## 1. What's merged on `milestone/surfaces` (the value to ship)
Linear history (newest first): `#120` polish → `#118` grow → `#117` analytics → `#116` calendar → `#114` Views → earlier (`#112` real stat-row, `#110` connect-loop, `#108` pillars, `#106` nav, `#105` start).
Surfaces besides `/start`: **`/calendar`** (month planner) · **`/analytics`** (7/30/90d metrics + recs) · **`/grow`** (business-coach strategy dashboard) · **`/feed` `/library` `/competitors` `/referrals` `/audience`** (pre-existing; headers unified in #120).

## 2. The ONE known blocker — Vercel preview deploy (serverless-function-memory)
- **Symptom:** `milestone/surfaces` Vercel **PREVIEW** deploys fail on a serverless-function-memory limit (project/plan-level; identical failure across disjoint PRs → NOT code). Merges into the milestone branch were made over it (checks non-required).
- **State:** `vercel.json` sets `src/app/api/analyze/route.ts` → `{ maxDuration: 300, memory: 2048 }`. An auto-wip commit (`936c3917`) nudged `vercel.json` by 1 line — **unverified whether it resolves the limit**.
- **Fresh-session task:** reproduce the failing preview deploy → read the real build/runtime error (use the Vercel MCP: `get_deployment` / `get_deployment_build_logs` / `get_runtime_errors`) → fix (bump the offending function's `memory`, or trim/split the heavy route, or raise the plan) → confirm a preview deploy goes green. This MUST be green before main (main deploys to production).

## 3. Honesty-spine audit (the pre-merge gate — this is the important one)
The milestone's contract with the user is **"real, or labeled Directional, or omit — never fabricate."** Verify every surface holds it:
- **REAL (data-backed, keep honest):** `/start` first-run detection · `/start` stat-row (Followers/New-followers/Likes/Posts) + Views tile · `/analytics` 7/30/90d metrics (`buildRangeMetrics` over `account_snapshots`, honest "—" when history is thin) · the `account_snapshots` ingestion rig (migration applied to Supabase `qyxvxleheckijapurisj`, own-row RLS, daily cron 07:00 UTC).
- **MOCK but LABELED Directional (v1 fixtures — must READ as forecasts, never live reactions):** `/start` ideas/outliers/pillars/plan/rings/greeting/the-loop · `/calendar` `MOCK_MONTH_PLAN` predicted tones · `/grow` `mock-grow` readiness + offer "would buy" + funnel · `/analytics` recommendations (tagged "Directional"; "From your numbers" fires ONLY on a real delta). Spot-check each renders its **Directional/"not real sales"/"a forecast"** label.
- **STUBBED contract seams (swap→real at graft, not now):** CardReaction chip · Read/RoomDrawer · SurfaceDock presence (`MOCK_AUDIENCES`) · **Seam-4 = toast placeholders** ("create thread → /thread/:id") on every Make/Test/Ask action. These are honest stubs, not fabrications — confirm none imply real delivery.
- **Guards:** `reading/__tests__/reskin-matte.test.ts` (no coral/glass) green; the unit suites (`month-layout` 3/3, `range-metrics` 6/6, `account-metrics` 13/13). Run with `node ./node_modules/vitest/vitest.mjs run <file>` (npm test / npx vitest print fake PASS(0)).
- **Known mock leak to fix or accept:** `/start` greeting is hardcoded "Davide" (`mock-room.ts` `getMockStartPage().greeting`). Decide: wire to the real profile name, or accept for the increment.

## 4. What NOT to touch
- Don't **build new surfaces** — this is ship-prep.
- Don't **wire the post-publish loop** — deferred (wire-or-remove gate); its read-scalar/accuracy is an ENGINE read-shape not yet exposed (THE-CONTRACT §6.1). `the-loop.tsx` stays MOCK, clearly commented.
- Don't **unstub the ambient atoms** (dock/CardReaction/RoomDrawer/composer) — The Room owns them; Task B was reverted → they haven't landed. Wait for The Room to flag each.
- Don't build **thread / skills / engine** (`~/virtuna-the-room`).

## 5. The decision to confirm with the owner BEFORE merging to main
Converging now ships honest, useful surfaces **but with the moat layer still Directional/stubbed** (no live audience reactions; Seam-4 = toasts). Two paths:
- **A (ship the increment):** land the surfaces on main now as v-next; graft the live ambient layer in a follow-up once The Room's atoms land. Ships value now.
- **B (wait):** hold the milestone until The Room's atoms land, graft, then converge with the full "ambient everywhere" vision intact.
Owner leaned A ("ship what's built"). **Get an explicit yes on A vs B before the main merge** — it's their call, and it changes whether you merge now or keep the branch open.

## 6. Merge mechanics (once §2 green + §3 audited + §5 confirmed = A)
- Prefer a **PR `milestone/surfaces` → `main`** (the review gate) over a local merge.
- GSD-worktree protocol (`~/.claude/rules/gsd-worktree.md`): merge `--no-ff`; restore main's `STATE.md` + `config.json`; keep the branch's `milestones/` additions; delete `MILESTONE.md`; manually reconcile `PROJECT.md` + `MILESTONES.md`. (`.planning` bookkeeping can follow the code merge.)
- ⚠️ **Auto-wip daemon is ACTIVE** — it co-opts uncommitted WIP and auto-commits+pushes (it hit this session: polluted a branch with a chore commit incl. a stray edit). If a branch gets polluted: rebuild clean on a fresh `*-v2` branch off the base (`git checkout <daemon-sha> -- <good files>`), PR that, delete the polluted branch. **Never reset/force-push under the live committer.** If a push is rejected: fetch + MERGE.

## 7. Setup + gotchas
- `cd ~/virtuna-surfaces`; on `milestone/surfaces`; `git pull`. Worktree = the repo's `.git` shared across siblings.
- Dev (768MB OOMs; npx wrapper breaks dev): `PORT=3400 NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev --turbopack`
- Test user: `e2e-test@virtuna.local` / `e2e-test-password-2026`. It has a REAL `zachking` `account_snapshots` fixture (the daily cron refreshes it) → `/start` + `/analytics` show a populated real stat-row. Verify via Playwright a11y snapshot + `browser_evaluate` (remote MCP screenshots don't persist).
- Supabase MCP project = `qyxvxleheckijapurisj`. tsc + eslint clean on TOUCHED files (pre-existing `__tests__` `Audience.mode` TS errors = untouched debt).
- ⚠️ `docs/SURFACES-STATUS-AUDIT-2026-07-03.md` is now STALE (predates calendar/analytics/grow — says "milestone = only /start"). Produce a fresh audit as part of §3; supersede it.

## 8. Deferred backlog (post-merge or next milestone — NOT this session)
- **OAuth/Composio ingestion** — top de-risk of the flaky Apify spine; rig is producer-agnostic. Gate: owner provisions Composio (account + API key). See memory `oauth-profile-ingestion`.
- **Deeper polish** — `library`/`audience`/`settings` headers (live in sub-components `SavedShelf`/`AudienceManager`/`SettingsPage`) + subtle radial-bg cohesion on the older surfaces. Adopt the new `SurfaceHeader` (`src/components/surfaces/surface-header.tsx`).
- **The ambient graft** — swap every stub→real when The Room ships its atoms (one coordinated pass, not a rebuild). THE-CONTRACT §3/§6.
- **Post-publish loop** — wire-or-remove once the engine read-shape lands.
- **Carousel export** — owner de-scoped for now.
