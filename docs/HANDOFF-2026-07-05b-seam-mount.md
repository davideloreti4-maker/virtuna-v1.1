# Handoff — Seams 1 & 2: source real pre-tested content · 2026-07-05b

## TL;DR
**Seam 3 is MOUNTED + merged** (PR #153 → `1db11b1f`): the /start dock renders the real
`AudiencePresence variant='surface'` on live audiences; the mock is retired. **Seams 1 & 2 are
BLOCKED — not on adapters (both producers ship, unit-green) but on a real *surface-card data
source*.** This handoff records the mount, the blocker, and **the decision for 1/2**.

**THE DECISION (owner-aligned recommendation): build REAL pre-tested content (the "Option 1+2"
path), NOT the cheap "recent-tests recap" (Option 3).** Sequence **outliers first, then daily-ideas.**
Reasoning + steps below. The design-session collision on the card files is now **RESOLVED** — the
premium-elevation card rewrite already merged to main (PR #154), so wiring data into
`idea-card.tsx`/`outlier-card.tsx` is clean.

---

## 1. What shipped this session (Seam 3 — done, don't redo)
- **Dock is real.** `src/components/surfaces/surface-dock.tsx` is now a thin wrapper mounting the
  Room-owned `<AudiencePresence variant='surface' layout='dock'>`, fed **raw `Audience[]`** resolved
  server-side in `src/app/(app)/start/page.tsx` (`listAudiences` for the switcher list +
  `resolveUserAudience` for the active one). `start-page.tsx` persists on select
  (`PUT /api/settings/last-audience`, UUID-guarded).
- **Type-flow trap resolved:** `AudiencePresence` consumes the DB `Audience` type, **not** the
  contract `ActiveAudience`, so the dock is fed raw `Audience[]` — `audienceToActiveAudience` is
  bypassed for the dock (kept for a future card layer). `SURFACE-SEAM-SPEC §2.4` corrected.
- **Decision baked in:** `layout='dock'` at every breakpoint (/start pins dock+composer as one
  bottom object; its content rail owns the desktop right column, so /home's `rail` doesn't apply).
- Retired `MOCK_AUDIENCES` + the dead `surfaces/audience-constellation.tsx`.
- **Verified 3 ways:** real browser (switcher lists real DB audiences, live select, persist-across-
  reload) · tsc prod-clean · production `next build` passes.
- Full detail: memory `the-room-phase3-built.md` (2026-07-05b) + PR #153 + `SURFACE-SEAM-SPEC.md`.

---

## 2. Why Seams 1 & 2 are blocked (the real problem)
The start-page's **daily-ideas + outliers are fabricated cards** (`mock-room.ts`) with **no
`analysis_results` behind them.** The producers work — `predictionResultToRead(data,id)` (Seam 2)
and `readToCardReaction(read)` (Seam 1) — but they need a **real `PredictionResult` that matches the
card's content.** Feeding a real Read/face onto a mock card = a *mismatched verdict* → violates the
honesty spine (never a fabricated/mismatched reaction).

`room-drawer.tsx` already renders whatever `Read` a tapped card carries (via `RoomFocus.read`), so
**Seam 2 needs no new UI** — it needs the card to carry a real `PredictionResult`. Same root as Seam
1. There is **no surface-cardable data source today**: /feed + /library carry no per-card analyses;
real `PredictionResult`s live only inside the per-thread/analyze engine path.

**⇒ Seams 1/2 = a content-sourcing / pipeline build, not an adapter graft.**

---

## 3. THE DECISION — go real pre-tested content (Options 1+2), reject Option 3

**Recommendation: build the real pre-tested-content pipeline.** The start page's whole promise is
*"your day, pre-tested on your people"* — proactive, pre-tested ideas/outliers. That is the
**predictive-vs-reactive moat** (vs Stanley's reactive coach — see memory `competitor-stanley-
teardown`). **Option 3 (repurpose the user's recent *tested* analyses into a "recently tested"
section) is a trap:** it's cheap, but it silently downgrades the flagship surface into a past-tests
recap that duplicates /library and abandons the wedge. Use Option 3 *only* as a throwaway render
demo if you must see the seam light up before building — never as the shipped answer.

**Both real options are the SAME mechanism — sim real content against the user's audience, persist
the Read — applied to two sections.** Sequence by tractability:

### Step A (do first) — OUTLIERS: sim real competitor videos → real Read/face
The content **already exists**: competitor/feed videos are ingested (`src/lib/feed/feed-query.ts`,
`scraped_videos`/`competitor_profiles` — see memory `discover-feed-milestone`). So no generation
needed — just:
1. Pick the user's top outlier videos (feed/competitor rows).
2. Run each through the sim **against the user's resolved audience** (`resolveUserAudience` — already
   landed) → a real `PredictionResult`. Reuse the in-thread sim (`src/app/api/tools/react` or the
   engine pipeline) — do NOT reinvent scoring.
3. `predictionResultToRead(data, id)` → `readToCardReaction(read)` → real `outlier-card.tsx` face +
   real `room-drawer` Read (Seam 1 + Seam 2 both land here).
4. Persist so it's not re-simmed every load (cost — see below).

### Step B (then) — DAILY-IDEAS: generate → pre-sim → surface
Bigger, because the content must be **generated** first. The engine already does generate→sim→rank
**in-thread** (`src/app/api/tools/ideas` + `react`/the KC pipeline) — this step **exposes it as a
proactive surface producer**: generate candidate ideas from the user's pillars/account → sim each
against their audience → keep the top N as pre-tested cards → same adapter chain onto
`idea-card.tsx`. This is the fuller moat but the heavier lift.

### ⚠️ Cost / cadence (the real gate on both)
Proactive sims cost Readings (see memory `pricing-strategy`). A daily pre-sim for every user is not
free. **Before building, decide:** how many outliers/ideas, how often (daily cron? on-visit lazy?),
and cache/reuse (persist the Read; only re-sim on new content or audience change). This cost model
is the thing that makes 1/2 a scoped milestone, not a quick graft — get an owner call on it.

---

## 4. Ordered next steps
1. **Confirm the cost/cadence model** with the owner (how many, how often, cache strategy). Gates everything.
2. **Step A — outliers** (most tractable): source feed/competitor videos → sim vs audience → persist →
   `predictionResultToRead → readToCardReaction` onto `outlier-card.tsx` + `room-drawer`. Retire the
   mock outlier `read`/`reaction`.
3. **Step B — daily-ideas**: proactive generate→sim→rank producer → same adapter chain onto `idea-card.tsx`.
4. **Retire the rest of `mock-room.ts`** (`MOCK_READS`, `getReadByCardId`, idea/outlier fixtures) as each
   section goes live. (`MOCK_AUDIENCES` already gone.)
5. Phase-4 outcome loop stays **blocked** (needs account-connect) — not this work.

---

## 5. Coordination (design session)
- **The card-file collision is RESOLVED.** The premium-elevation rewrite of `idea-card.tsx` /
  `outlier-card.tsx` (+ the sections) **already merged to main via PR #154** (`7d21f482`). So you can
  wire data into the *current* redesigned cards without fighting a live edit.
- **Still** `git fetch` + re-check before big surface edits (a design follow-up session may reopen):
  `git diff --name-only $(git merge-base origin/main origin/feat/start-elevation) origin/feat/start-elevation`
- **Never touch** `src/app/globals.css` · `docs/DESIGN-SYSTEM.md` · `surface-canvas.ts` · the matte
  guard (`reading/__tests__/reskin-matte.test.ts`) — design-owned.

## 6. The data spine is READY (import, don't rebuild)
- **Audience per user:** `resolveUserAudience(supabase, userId)` (`src/lib/audience/resolve-user-audience.ts`).
- **Producers:** `predictionResultToRead(data,id)` (`src/components/reading/prediction-to-read.ts`) ·
  `readToCardReaction(read)` (`src/lib/room-contract/read-to-card-reaction.ts`). Compose:
  `readToCardReaction(predictionResultToRead(data,id))`.
- **Real content:** `src/lib/feed/feed-query.ts` (competitor videos) · `src/app/api/tools/*`
  (gen + sim: `ideas`, `react`, `remix`, `hooks`, …).
- **The sim → PredictionResult** shape: `src/lib/engine/types.ts` (`PredictionResult`); the reading
  page loads one via `src/app/api/analyze` — mirror how it obtains the result.

## 7. Gotchas (all hit this milestone)
- **Vercel PR check is RED but PRE-EXISTING** — main + the design branch both fail the same `Vercel`
  check (gitignored-lockfile / caret-drift, memory `deps-pinning-gitignored-lockfile`). A local
  `next build` PASSES. Don't chase it; it's not your diff. `mergeable=MERGEABLE`.
- **vitest:** `node ./node_modules/vitest/vitest.mjs run <file>` (npx/`npm test` print a fake PASS).
- **tsc:** production 0; the **21 test-baseline `Audience.mode` errors are pre-existing** (all in
  `*.test.ts`) — ignore. Stale types → `rm -rf .next/dev/types`.
- **Fresh-upload Test is flaky here** (browser→Supabase-storage `ERR_HTTP2`). For real Reads use an
  **existing rich analysis** (`analysis_results`, Supabase project `qyxvxleheckijapurisj`, e2e ids
  `giyyxJfww2iC` / `WPk976kozfWs`, `segment_reasons` non-empty).
- **Auto-wip daemon LIVE** (post-commit auto-pushes) — never force-push. Merge
  `gh pr merge --squash` **WITHOUT** `--delete-branch` (the local step fails on the shared worktree);
  delete the remote branch manually (`git push origin --delete <branch>`).
- **Memory dir is worktree-guarded** — write memory via Bash, not Edit/Write.

## 8. Setup
```bash
cd ~/virtuna-the-room                                   # NOT the surfaces worktree
git fetch origin && git switch -c feat/seam12-<name> origin/main   # main tip: 7d21f482 (or newer)
NODE_OPTIONS='--max-old-space-size=3072' node ./node_modules/next/dist/bin/next dev --turbopack
# http://localhost:3000 · login e2e-test@virtuna.local / e2e-test-password-2026
```

## Read first
- This doc · `docs/SURFACE-SEAM-SPEC.md` (Seam 1/2 rows + §2.4 + 2026-07-05b headline) ·
  `docs/THE-CONTRACT.md` (the 4 seams). Memory auto-loads `the-room-phase3-built.md`.

## Seam status
`1 ⛔ · 2 ⛔` (blocked on the content pipeline above) · `3 🟢 MOUNTED` · `4 🟢` (start-page graft).
