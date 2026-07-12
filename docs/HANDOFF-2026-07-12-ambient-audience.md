# HANDOFF 2026-07-12 — explore-b: ambient audience refinement (+ cron P0 applied)

Session record + cold-start context for the next session. Worktree `~/virtuna-explore-b`,
dev port **3010**, branch parked detached at `origin/main`. Memory card:
`ambient-audience-refinement.md`.

## 1. What shipped (all squash-merged to main, live-verified)

| PR | Commit | What |
|----|--------|------|
| #242 | `b48e2a89` | **Bugs.** (1) Thread-switch wipe (`composer.tsx`) now clears the ambient typed-thought focus + ask ledger + drill flag — the previous thread's read no longer haunts a fresh thread, and the idle "meet your room" cast can actually appear. (2) Audience switch/build clears the thought+asks (old audience's reaction was carrying the new audience's name). (3) Portaled switcher menu clamps to its anchored side + flips downward when the chip sits high — was clipping top rows off-viewport on the centered layout. |
| #244 | `381d8e25` | **UX.** Collapsed tab score carries its subject (`2 of 10 would stop · "POV: …"`); open-panel top bar shows readiness ("10 ready"), never the score (Room owns it); `⤺ all N` reachable from a typed-thought read (ask is no longer a one-way door out of the batch); sr-only roster announces the real cast (Maya/Dev/…), placeholder `viewer_N` never borrows a name. |
| #246 | `ba82b475` | **Dead code.** `layout='rail'` branch + `rosterRows`/`peekPulse`/`displayPulse` + `surface-dock.tsx` + 5 rail tests deleted (−309). `variant='surface'` KEPT forward-ready (SURFACE-SEAM-SPEC §2). |

**Cron P0 (from #236):** `CRON_SECRET` added via Vercel CLI to **Production + Development**
(Preview skipped — CLI `--yes` branch-prompt bug; crons never fire on preview) + prod
redeployed (`vercel redeploy`, aliased `virtuna-v11.vercel.app`, Ready). **NOT yet verified
on a scheduled fire** — see §2.

## 2. First 15 minutes of the next session (do these before any task)

1. **Verify crons actually fire** (needs a run after ~06:00 UTC):
   `select tiktok_handle, last_scraped_at, scrape_status from competitor_profiles order by last_scraped_at desc limit 10`
   on project `qyxvxleheckijapurisj` — expect fresh ~06:00 UTC stamps and `khaby.lame` self-healed.
   Cross-check Vercel runtime logs: cron invocations should be 200s (were 32/32 → 401).
   Green → mark memory `vercel-crons-dead-401.md` ✅ closed. Still 401 → the env var isn't
   reaching the runtime; check the deployment picked it up (`vercel env ls`, redeploy again).
2. **Prod env sparseness (found this session, likely P1):** prod has only THREE env vars
   (2 Supabase publics + CRON_SECRET). No `SUPABASE_SERVICE_ROLE_KEY`, no engine keys
   (DashScope/Qwen), no `APIFY_TOKEN`, no `UPSTASH_*`. If server routes need them in prod,
   the engine/scrape layer is dead there (SSO wall may have hidden this — nobody exercised
   prod engine paths). Audit: grep `process.env.` server-side requirements vs `vercel env ls`,
   then add what's missing in the dashboard. Platform work = c-lane per charter, but the
   audit is cheap in any lane.

## 3. Recommended next b-task: ask-history UI (the last visible ambient seam)

The composer maintains `audienceAsks: AudienceAsk[]` + an `onReask` handler
(`composer.tsx` → `AudiencePresenceProps.asks`/`onReask`), but the v6 Bloom renders NO
history — past asks vanish (state accumulates invisibly; cleared on thread/audience switch
since #242). Two honest options; owner picks:

- **A (build):** render recent asks as tappable rows (e.g. above the field when the panel is
  open on idle, or a compact strip under the switcher bar): `"<thought>" · 6/10` → tap →
  `onReask` re-focuses the Room on that read (already wired end-to-end, zero new model calls).
  Keeps the "conversation with the room" feel the P13 spec described.
- **B (delete):** drop `asks`/`onReask` from the props contract + the composer state — the
  room is a "current read" surface, history lives in the thread. Smaller, honest, closes it.

Smaller polish behind it: ranked rows could carry each hook's top bouncer quote (density
tradeoff — sketch first); panel clips mid-row at short heights (bottom fade would polish).

## 4. Alternate tasks (from the 2026-07-11 handoff, still parked)

- **Maven logo decision:** `stash@{0}` ("wip: maven-logo serif + vertical") is PRESERVED.
  Apply on a fresh branch off origin/main, screenshot the WIP lockup vs current
  `MavenMark`/`MavenLogo` in real chrome (sidebar + landing), present side-by-side, owner
  decides keep/drop/iterate. Don't drop the stash until the decision lands.
- **Grounded hooks live-verify** (owner approves Apify spend): flip `GROUNDING_HOOKS_ENABLED`,
  one real hooks query, verify the on-card receipt end-to-end, flag back OFF unless told keep.
  Read `docs/HANDOFF-2026-07-10-grounded-generation-session4-shipped.md` first.
- **Engine-side observation** (engine lane, not UI): S3′ persona quotes sometimes drift
  off-concept (skincare quotes on a morning-routine hook). Worth a look at the card-gen
  reaction prompt if reaction quality comes up.

## 5. Protocol + gotchas (verified this session)

- **Lane rules** (`docs/HANDOFF-2026-07-11-explore-b-cards-reading.md` §2): short branch off
  origin/main → PR → squash-merge same session; overlap-check changed files vs new main
  commits before PR; kill the dev server at session end + curl-verify dead.
- Dev server: `NODE_OPTIONS=--max-old-space-size=3072 node ./node_modules/next/dist/bin/next dev -p 3010`
  (2048 died mid-session under HMR churn; 3072 held).
- Tests: `node ./node_modules/vitest/vitest.mjs run <path>` (`npm test` prints fake PASS).
  Baseline: audience-lens 63/63 · matte 38/38. App/home suite has pre-existing failures — don't
  chase them.
- Lint honesty check: `git stash && npx eslint <files> && git stash pop` — compare issue sets;
  this session's baseline: composer 4 (incl. unused-disable directives), audience-presence 4
  (`set-state-in-effect`), AmbientRoom 1.
- Playwright: inject `*{animation:none!important;transition:none!important}` before shots
  (room never settles). Login: `e2e-test@virtuna.local` / `e2e-test-password-2026`
  (`e2e/create-test-user.ts`).
- `AmbientRoom` tests must render **non-embedded** — the embedded (video-Read) variant hides
  the whole focus-header row (stepper + `⤺ all N`) by design.
- Composer TDZ trap: `focusByThought` (from `useAmbientFocus`) is declared ~line 1670; deps
  arrays or render-time reads ABOVE that line crash — wire ambient-state clears at the
  presence-props level (see #242) or inside effect bodies only.
- Memory dir writes from a worktree hit the path guard — write via Bash/python, not Edit/Write.
