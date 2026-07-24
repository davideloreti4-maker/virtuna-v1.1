# Handoff — 2026-07-24 · test-card Apollo fixes + live video-Brain E2E + branch merged to main

**Branch:** `design/ambient-audience-v2` — **MERGED to `origin/main` (tip `a2976891`), branch even (0/0). Main is GREEN.**
Pairs with the parallel session's handoff `docs/HANDOFF-2026-07-24-artifact-first-start.md` (the Start-grid + thread-layout work, also in this merge).

## What merged (7 commits, two sessions)

| commit | who | what |
|---|---|---|
| `237f805a` | this | stub `characterizeContent` in the react happy-path test (General now rides the baseline signature → the route calls characterize; test never stubbed it → `.catch` crash, only passed via mock-leak) |
| `025fa07a` | this | cover the video-seal write branch in `/test/card` §9b (was untested — gated on `AMBIENT_V2_ENABLED`, off in tests) |
| `68ebf9ad` | other | artifact-first Start grid — Content · Intel, lens lines, real audience picker |
| `796a67bb` | other | Start uses the thread layout — docked composer, empty chat on pick, rail on arm |
| `357aff4e` | other | their handoff doc |
| `c8765330` | this | **test-card: derive director's fixes from Apollo dims when counterfactuals absent** |
| `a2976891` | this | **fix the stale `AmbientOverviewRail` text-brain test** (was pre-existing red on main) |

## The headline fix — the video test card renders the full "new test read" again

**Symptom (owner-reported):** the video Test produced "the old skill card" — craft ring + drivers + filmstrip + working, but **no "Not working" ledger and no "The director's fixes"** (the signature sections of the #355 rework).

**Root cause:** both sections were sourced ONLY from `counterfactuals.suggestions`, but the analyze pipeline **stopped emitting counterfactuals** (Plan 02 R9) — **0 of 8 analyses over 30 days carry any**. So on every real run both sections were empty.

**Fix (`src/lib/tools/video-test-card.ts`):** when there are no counterfactuals, derive `notWorking` + `fixes` from the **weak/mid Apollo craft dims** (always present; each carries a real per-dim `evidence` = the video-specific diagnosis). Title/lever/why are the neutral craft frame (new `FIX_TITLE_BY_DIM` / `LEVER_BY_DIM` / `WHY_BY_DIM` — honest general mechanism, never a fabricated claim). Retention stays a craft FIX (the mid-video dip) though excluded from the craft SCORE. The retention fix + filmstrip weak-beat + drop label anchor to the **measured `weighted_curve` dip** (`curveDipSegment`); other dims aren't time-coded → no fabricated frame. `deriveFixGroundingQueries` mirrors the fallback so the route still grounds the top-2 fixes. No fixes when every dim is strong. Counterfactual path untouched for if the stage returns. Tests: `video-test-card` 15 (+5 Apollo-fallback), `test/card` route 9.

## Live billed E2E — the whole video-Brain chain verified end-to-end

Ran a real 0:29 mp4 through the pipeline (owner-supplied). Chain: **upload → `/api/analyze` Max (real `weighted_curve` len 5, hook_score 0.66) → `/api/tools/test/card` §9b seals a `SimSealVideo` on the thread → `/api/threads/open` reads it → `AmbientOverviewRail` renders the video row (`68 viral`, queued) → Simulate reveals 66% (ranked) → drill → full Brain (real attention scrubber + transcript, "0:21 drop", 9 signals, neuro σ, activation/sec, honest calibration line).** The card now shows 3 grounded director's fixes + a 3-item not-working ledger on real data.

### ⚠️ Ops gotcha that cost the run (READ THIS)
- §9b is gated on **server-side `AMBIENT_V2_ENABLED`**. The dev server had been launched **without** `NEXT_PUBLIC_AMBIENT_V2=true` → test/card returned 200 but silently wrote NO seal.
- **`setsid` DOES NOT EXIST on macOS** — a relaunch using it fails silently and a flagless respawn keeps serving :3007.
- **`ps eww` hides inherited env** on the forked `next-server` worker → the flag looks absent even when set. Verify the flag **behaviorally**, not via `ps`.
- Correct launch: `rm -rf .next && NODE_OPTIONS="--max-old-space-size=2048" NEXT_PUBLIC_AMBIENT_V2=true PORT=3007 nohup node ./node_modules/next/dist/bin/next dev -p 3007 > <log> 2>&1 &`  ← **`nohup`, not `setsid`.** The server is currently running this way.

## The rail test that was red on main (fixed this session)

`AmbientOverviewRail.test.tsx` was **red on `origin/main`** (arrived with the text-sim parity commit `f01717be`; NOT introduced by any branch here). It asserted the old reason-breakdown driver ("What carried the stop"), but that same parity change intentionally **reversed the reason-bars stance** and made the text brain emit the **attention-scrubber** driver. Producer shipped, test never updated → red since. **Owner call this session: the attention-scrubber is the intended text brain.** Re-pointed the assertions at the shipped behaviour (the real "why they stopped" synthesis — the loss reason leading). Test-only change; the branch never touched the producer/component. `AmbientOverviewRail` 7/7.

## Also verified/corrected (prior "OPEN" items were already done)

- **Migration `20260723090753_thread_sim_seals` IS applied** on prod `qyxvxleheckijapurisj` (`sim_seals` jsonb column exists; 3 threads carry real text seals). Prior handoffs said "built, not applied" — **stale, do not re-investigate.**
- **Video-Brain producer chain was code-complete**, not un-wired (the `#2` "cutover" framing was stale). The only gap was the untested §9b write (now covered) + the live E2E (now done).

## Gates (all green — main is GREEN)
`tsc 0 · eslint 0 errors` (3 pre-existing composer warns) `· matte 38 · adapters 12 · brain 21 · population 19 · baseline 5 · AmbientStartHome 3 · AmbientOverviewRail 7 · sim-seals 12 · open-thread 18 · react 14 · test/card 9 · video-test-card 15`.

## OPEN / NEXT (ranked)

1. **Threads + composer fixes (owner has specifics to give).** The owner flagged pending fixes in this area — start the next session by getting them.
2. **Composer Test path doesn't seal.** The composer's video-upload Test (arm skill → upload → Simulate) navigates to the OLD `/analyze/[id]` board and does NOT call `/api/tools/test/card` — so it neither seals the ambient video row nor drops the in-thread card. Only the **in-thread `UploadField`** (`input-request-block.tsx`) POSTs test/card on completion. Decide whether the composer Test should also seal / land the in-thread card, or whether `/analyze` is being dissolved (per `test-vs-simulation-split` memory §"NO separate analysis page"). Likely tied to the parallel session's composer edits — **iterate on `composer.tsx` in a FRESH session** (their note: riskiest edits landed near the end).
3. **Real pricing vertical** — compute pricing `decisionStates` from a pricing-calibrated audience (currently hand-authored fixture).
4. From the parallel session's handoff: don't merge `onEngagedChange` into `hasThread` (documented prior regression); the lens copy is tuned to not wrap at 760px; `/ambient-v2`'s composer is a static stand-in.

## Git / ops notes
- `main` is checked out in the `~/virtuna-v1.1` trunk worktree → `git checkout main` here FAILS. FF via `git push origin HEAD:main` (used this session, clean FF).
- **PR #381** (opened by the parallel session off this branch) is now superseded — main contains the branch tip. Close it if GitHub didn't auto-close.
- `~/virtuna-v1.1` local `main` is behind `origin/main` — `git pull` there when convenient.
- The auto-push hook pushed one commit before a local `--amend`, causing a 1↔1 divergence (identical trees); reconciled with `--force-with-lease`. If you amend, expect this.
