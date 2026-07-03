# Surfaces Milestone — Status & Honesty Audit (2026-07-04)

> **SSOT status audit for `milestone/surfaces` ship-prep.** Supersedes
> `docs/SURFACES-STATUS-AUDIT-2026-07-03.md` (STALE — predates calendar/analytics/grow;
> it wrongly says "milestone = only /start"). Produced during the ship-to-main pass
> (`docs/SHIP-TO-MAIN-HANDOFF.md`). Branch tip at audit: `affad0d7`.

## 0. Verdict
- ✅ **Production build is GREEN** (`next build` exit 0) after the one real blocker was fixed.
- ✅ **Honesty spine holds** on every surface: every number is REAL, or LABELED *Directional*, or a clearly-marked stubbed contract seam. No surface fabricates a real audience reaction or real analytics.
- ✅ **Guards green** (39 tests): matte + truthfulness + calendar/metrics suites.
- ⚠️ **Deploy pipeline needs an owner decision** — see §4. Merging to `main` is code-ready; the actual Vercel production deploy is a separate, owner-gated step.

## 1. The REAL ship-blocker (the handoff's "memory limit" hypothesis was wrong)
The handoff §2 guessed a Vercel serverless-function **memory** limit. Investigation (Vercel MCP) disproved it:
- The `virtuna-v1.1` Vercel project has **exactly one deployment ever** — the Jan-2026 `source: cli` init (`f510cf0f`). There are **no failing preview deploys** in Vercel's records for any surfaces PR. So "previews fail on a memory limit" was an *unverified hypothesis*, not an observed error.
- `vercel.json` `memory: 2048` is **valid on Pro** (max 3009). An auto-wip commit (`936c3917`) actually *reverted* an intentional `3008 → 2048`; neither is a blocker. Left as `2048` (valid); see §5.

**The actual blocker was a build break.** `next build` failed page-data collection for `/competitors/[handle]`:
```
TypeError: (0 , X.createContext) is not a function
```
Root cause: `src/components/competitors/detail/video-card.tsx` is a **server component** (so is its parent `top-videos-section.tsx`), but it imported icons from the main `@phosphor-icons/react` entry, which creates an `IconContext` via `createContext` at module load. In the RSC server graph React's `react-server` condition stubs out `createContext` → build fails. This is **dependency drift, not surfaces code** (no `package.json` diff vs `main`; `recharts` floated `^3.7.0 → 3.9.1`, phosphor createContext is inherent) — it affects `main` too and is almost certainly why nothing has deployed since January.

**Fix (`affad0d7`):** import the 4 icons from `@phosphor-icons/react/dist/ssr` (the SSR-safe entry, same convention already used in `not-found.tsx`). Keeps the component server-rendered, zero behavior change. `next build` → **exit 0**, full route tree compiles.

## 2. Honesty-spine audit (the pre-merge gate)
Contract: **real, or labeled Directional, or a stubbed seam — never fabricate.** Verified in source + guards.

| Surface | Class | Evidence (verified) |
|---|---|---|
| `/start` first-run detection | **REAL** | `start/page.tsx`: `hasCalibrated = audiences.some(!is_general && signature!=null)`; read error → first-run (never fabricate). `?first=0/1` override. |
| `/start` stat-row + Views tile | **REAL** | `buildAccountStats(getAccountSnapshots(user.id))`; null → `<StatRowEmpty>` "gathering your numbers". |
| `/analytics` 7/30/90d metrics | **REAL** | `buildRangeMetrics(snapshots, range)`; null → "No account numbers yet… We never show made-up analytics"; thin history → deltas read "—". |
| `/analytics` recommendations | **REAL-tagged / Directional** | `buildRecommendations`: "From your numbers" **gated on a real posts delta** (`posts.delta !== "—"`); pillar advice tagged "Directional". Renders the chip (`analytics-view.tsx:167`). |
| `account_snapshots` rig | **REAL (deployed)** | Supabase `qyxvxleheckijapurisj`: table exists, **RLS on**, zachking fixture present, latest `2026-07-03` (daily cron `07:00 UTC` ran). |
| `/grow` readiness / offers / funnel | **MOCK → labeled Directional** | `mock-grow.ts` header "NEVER real sales"; `grow-view.tsx` renders "Directional" chip + "a forecast from your people · not real sales" + "N/10 would buy". |
| `/calendar` predicted tones | **MOCK → labeled Directional** | `MOCK_MONTH_PLAN` (mock-room); `day-detail.tsx:66` "Directional forecast — from your room's patterns, not yet tested"; month-grid tone-dot labeled. |
| `/start` briefing (ideas/outliers/pillars/plan/rings/greeting) | **MOCK (acknowledged stub)** | `getMockStartPage()`; route + component comments mark it a Room⇄Surfaces stub, graft-not-rebuild. |
| `the-loop` (post-publish receipts/accuracy) | **MOCK — DEFERRED, not wired** | `the-loop.tsx` header: ⏸ deferred to milestone-end wire-or-remove; documents why it can't be wired (engine read-shape not exposed, §6.1). |
| Seam-4 actions (Make/Test/Ask) | **STUB — honest toast** | Every launch toasts "(Seam 4: create thread → /thread/:id …)". No action implies real delivery. |
| SurfaceDock / RoomDrawer / EmbeddedComposer | **STUB seams (mock data)** | `MOCK_AUDIENCES`; RoomDrawer "grafted from The Room at integration". Read-only, contract-shaped. |
| `/feed /library /competitors /referrals /audience` | **REAL (pre-existing)** | Real scraped/DB data; headers unified in #120. Not part of the mock/stub concern. |

**Known mock leak (accept-or-fix):** `/start` greeting is hardcoded `"Good afternoon, Davide 👋"` (`mock-room.ts:476`). It sits inside the fully-stubbed briefing; pre-launch, first-run detection shows everyone-but-the-owner the *connect* state, so real-world exposure is low. Options in §5.

## 3. Guards & build (reproduce)
```
node ./node_modules/vitest/vitest.mjs run \
  src/components/reading/__tests__/reskin-matte.test.ts \
  src/components/app/__tests__/truthfulness-callout.test.tsx \
  src/lib/calendar/__tests__/month-layout.test.ts \
  src/lib/account-metrics/__tests__/range-metrics.test.ts \
  src/lib/account-metrics/__tests__/account-metrics.test.ts
# → 39 passed (matte + truthfulness 17, month-layout 3, range-metrics 6, account-metrics 13)

NODE_OPTIONS='--max-old-space-size=4096' node ./node_modules/next/dist/bin/next build   # → exit 0
```
`next build` runs full TypeScript + ESLint (both clean; pre-existing `__tests__` `Audience.mode` TS errors are untouched debt, not in the build path).

## 4. Deploy pipeline (needs owner) — the honest gap
- The `virtuna-v1.1` Vercel project has had **no deploy since the Jan CLI init**; GitHub→Vercel auto-deploy appears **dormant**, and this worktree has no `.vercel/project.json` link (only `~/virtuna-v1.1/` does).
- So merging `milestone/surfaces → main` will **not** automatically ship to production. Shipping needs one of: (a) reconnect/enable the Vercel Git integration for `main` (dashboard), or (b) a manual `vercel --prod` from the linked worktree, or (c) an owner-authorized MCP deploy.
- **Plan assumption:** the app relies on `maxDuration: 300` across ~15 routes → **Pro** (Hobby caps at 60s). Treated as Pro (strong evidence) but **not confirmed** — worth a one-word owner check, because on Hobby those routes would also need lowering.

## 5. Open items (owner calls)
1. **Ship A vs B** (required before main-merge): **A** = ship the honest increment now, graft the live ambient layer when The Room's atoms land; **B** = hold until the atoms land. Owner leaned **A**.
2. **Greeting "Davide":** (a) accept for the increment [recommended — it's inside the graft-later mock briefing], (b) one-line de-personalize to "Good afternoon 👋", (c) wire the real profile name (moderate, throwaway at graft).
3. **vercel.json memory:** left `2048` (valid). Restore the intentional `3008` for the heavy `/api/analyze` route only if it OOMs in practice — no evidence it does.
4. **Deploy mechanics** (§4) + **plan confirm** (Pro?).

## 6. What was NOT touched (per handoff §4)
No new surfaces; the post-publish loop left MOCK/deferred; the ambient atoms left stubbed (The Room owns them); no thread/skills/engine work.
