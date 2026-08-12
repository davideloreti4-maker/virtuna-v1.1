# HANDOFF — New-user onboarding: the product a fresh account actually meets

**Branch:** `lane/new-user-onboarding` · **Worktree:** `~/virtuna-slot-a` · **Dev port:** 3001
**Base:** rebased onto `origin/main` @ `3c97f8a4` (2026-08-04) · **Status: MERGED AND LIVE.**
**Merged 2026-08-04 via PR #420** (`38882b24`, the four lane commits + the doc rewrite) **and PR
#421** (`8539e5e6`, the verification note). `main` is `8539e5e6`; the #420 production deploy
(`dpl_5Yc3ZC…`) is READY and serving, the #421 one built behind it. Production probes 200 on
`/`, `/go`, `/welcome`, `/home`; zero runtime errors in the window.
**Owner ask (verbatim):** *"adding a good onboarding for new users to the platform … we want to
properly onboard new users."*
⚠️ **Merging to `main` IS deploying** (no preview URLs, prod builds ~3s after merge). Verify first.

> **Rewritten 2026-08-04.** The first version of this doc was a survey that ended in an open
> decision and a sketch. Both are now settled and built — three code commits — and the doc had gone
> stale in exactly the way it warned about. §3 records the decision that was made rather than
> asking for one; §4 records what shipped rather than proposing it.

---

## 0. State in one screen

| | |
|---|---|
| Commits | `a1f28575` survey · `3c08ee01` /welcome rebuild · `f55ecb97` three ways out of the inert product · `5c695b73` the audience intro |
| Merge surface | **Zero file overlap** with everything `main` gained since the fork (all Discover). Rebase was clean. |
| Gates | See §6 — re-run before the PR, `main` moves. |
| Open | The PR itself. Feature discovery (§7) is a separate lane. |

**The survey's finding, which still frames everything:** post-signup onboarding was not thin, it
was *disconnected*. It collected a TikTok handle, wrote it to `creator_profiles.tiktok_handle`,
and nothing read that string except `/competitors`. No connected account, no calibrated audience.
Since every card in this product is audience-relative, a fresh account's first card could only
ever render **"Not tested yet"** and the simulation door opened an empty room. The step promised a
connection and delivered a string.

## 1. What a new account meets now

```
signup → middleware.ts:173 gate → /welcome
   step 1  ConnectStep     @handle  ── or ──  a written description   → draft audience row
   step 2  CalibrationFlow  autoStart, inline, ~128s, spine-drawn
                            → calibrated audience persisted
   → /home  (empty)         HomeAudienceIntro names it, offers ONE first action
```

Both doors end in a calibrated audience. There is no longer a path through onboarding that leaves
the product inert.

### 1.1 `/welcome` — two real steps (`3c08ee01`)

`STEPS = ["connect", "calibrate"]`. The step indicator now counts something; it used to render a
single dot admitted in a comment to be "kept for visual symmetry with prior flow."

- **`connect-step.tsx`** opens one of two doors and creates only the **draft row**. "Skip for now"
  is gone — it completed onboarding with nothing set up. In its place is the describe door, which
  leads somewhere.
- **`calibration-flow.tsx`** gained `autoStart` + `prefillDescription` so step 2 never re-asks what
  step 1 just collected. **Reuse, not a third calibration UI** — there were already two entry
  points and the survey's §7 forbade a third. ⚠️ Its ref guard is load-bearing: calibration is a
  real Apify scrape on a metered account and StrictMode double-invokes mount effects.
- The calibrate stage is **local state, deliberately not persisted** to `onboarding_step`.
  Restoring into it on reload would remount `CalibrationFlow` with `autoStart` and fire a second
  scrape. A reload mid-run returns to step 1 — see §2.2 for what happens to the run it left behind.

### 1.2 The wait is the product, not a spinner

**Owner call, 2026-08-02: calibrate INLINE and BLOCKING** rather than deferring it. The measured
wait is ~128s, but it is not a blank one: the spine (`59ae73ee`) draws calibration's three real
phases and, seconds in, the creator's own avatar, follower count and video covers — their own
material, on screen, roughly two minutes before the audience it produces.

Deferring would have bought an instant entry and handed them a product whose every card reads
"Not tested yet" — the exact disconnect this lane exists to close.

`src/lib/audience/calibration-stages.ts` is the new pure module both sides import (a client
component importing the route drags server code into the bundle; the route importing a
`'use client'` component is the same mistake mirrored).

### 1.3 The described path got its own vocabulary

Found on the live run: the describe door was emitting the **account** vocabulary — "Reading your
followers", "Pulling the account and its posts" — to users who supplied only a description and
have no account, while it was really searching a niche.

Split into `calibrationVocabulary(hasHandle)`, keyed off **the handle, not the type** — because
`/audience/new`'s "From a handle" door builds a `type: "target"` audience from a *real account*,
and that run genuinely is reading one. The handle is what `calibrateFromScrape` itself branches on.

### 1.4 The gate that routes people there — unchanged, do not touch

`src/lib/supabase/middleware.ts:173` — an authenticated, **non-anonymous** user with no
`onboarding_completed_at` hitting a protected path is redirected to `/welcome`. The
`!is_anonymous` narrowing is load-bearing and was itself a fix: an anon funnel visitor can never
satisfy the gate (no `creator_profiles` row is ever written for them), so without it the
acquisition funnel **looped**. Do not widen that condition.

### 1.5 The acquisition funnel is a DIFFERENT thing, and it is done

`/go` → anonymous session → one free video Test → the sealed verdict wall → $1 / 3-day trial →
account claim. That funnel converts a stranger into an account. **This lane starts where it
stops.** Do not re-litigate it, and do not touch the seal / wall / claim path — it is the money path.

## 2. The three ways out of the inert product (`f55ecb97`)

All three would have landed a new account back exactly where the lane started: signed in,
uncalibrated, every card reading "Not tested yet".

**2.1 The likely failure had no way out.** `isThin` is "no follower tier AND fewer than 10 videos"
— a description of a brand-new creator, i.e. *the person onboarding exists for*. Their run falls
back, and the only button was "Continue with General", which IS the uncalibrated state. Their
account cannot be read yet but they can describe who they are making for, so the fallback and
error states now offer the other door and make it **primary**; General steps down to secondary but
stays reachable.

**2.2 A reload mid-calibration spent a second scrape.** Leaving `/welcome` does not stop the run:
the calibrate route does all its work and all its writes inside the SSE stream's `start()`, nothing
cancels it, and `send` swallows frames once the client is gone. So a user who reloaded at t=60s of
a ~128s scrape got their audience at t=128s — and was then asked for their handle again, burning a
second Apify call on a **$5/mo capped account** and stranding a duplicate row. `/welcome` now
adopts what a previous attempt produced: a calibrated audience finishes onboarding outright, a bare
draft is reused so the retry PATCHes it. Verified live — an un-onboarded user holding a calibrated
audience goes `/welcome` → `/home` with **zero** calibrate requests.

**2.3 Completion raced its own precondition.** The store flipped `step` to `"completed"` and *then*
wrote the database. The page redirects to `/home` the moment that step changes, and
`middleware.ts:173` gates `/home` on `onboarding_completed_at` being present **in the database** —
so the redirect raced the write that authorises it, and a creator who had just sat through ~128s of
calibration could be thrown straight back to the welcome form. The write now lands first; a failed
persist still flips the step, so offline behaviour is unchanged rather than trapping anyone.

> Found by instrumenting the real navigation on a production build rather than reasoning about it:
> the log showed `307 /home` arriving **before** `/api/audiences`. The fix is mutation-tested —
> restore the old sequence and `onboarding-store-completion-order` fails while every "does it
> complete" assertion stays green, which is why the race survived this long.

## 3. The audience intro (`5c695b73`)

Onboarding now ends with a calibrated audience and nothing then said so. A new account arrived on
an empty home holding the one thing that separates this from a prompt box, and the surface never
mentioned it.

`home-audience-intro.tsx` — a show-once, dismissible strip **beneath the composer** that names the
audience's size and origin, states what it is FOR, and offers ONE first action.

- **Not a seventh starter card.** THE STARTER CONTRACT (`home-starter.tsx`) is explicit: the six
  are constant furniture, one card anatomy, no prose, the grid must not redraw itself. An
  affordance inside the grid breaks all four. This sits *beside* it, in the quiet footer slot
  `HomeFirstRunDemo` already occupies. It is **not** placed above the grid either — rule 2 forbids
  a prose lede there outright.
- **The action is conditional**, because onboarding has two doors. The handle door leaves a
  connected account behind (`source_account_id`); the describe door cannot. Offering "Read my
  recent posts" to a describing creator hands them a first action that *cannot work*, so they get
  Ideas instead — which needs nothing but the composer.
- **Silent unless there is something true to say.** General, a bare draft with no personas, and
  "no audience" all render nothing. `personas.length` is the app's own calibrated test
  (`select-persona-targets.ts:111`).

Two things only the live run corrected, both invisible from the code:

- the first gate used `startEngaged`, which hid the strip on **precisely the screen a new account
  lands on** — under ambient v2 the empty home opens on the Start surface and the starter grid is
  still behind that gate;
- the copy opened *"Your audience:"*, which the Start surface already says a few hundred pixels
  above with the picker chip. Two labels for one thing on one screen read as two things.

The layout classes ride on the component, not a wrapper div — it returns `null` for anyone
uncalibrated or dismissed, and a wrapper would survive that and leave a dead 12px gap under the
composer for every one of them.

## 4. 💰 What onboarding costs — BOTH doors are paid

**No path through calibration is free.** The branch is on **`handle` presence, not `type`**:

| Door | Apify calls | Notes |
|---|---|---|
| Handle, healthy account | **1** — `scrapeProfileBundle` (profile + videos in one) | `onBundle` hands the raw bundle up so persistence reuses that ONE scrape |
| Handle, **thin** account | **2** — the bundle, then `scrapeNiche` fallback (`calibration.ts:301`) | ⚠️ `isThin` describes a brand-new creator exactly, so for onboarding this is the **common** path |
| Described (no handle) | **1** — `nicheQuery` → `scrapeNiche` (`calibration.ts:344`) | "No account needed" is honest. **"No cost" is not.** |

⚠️ This corrects a claim that was wrong in two places for three weeks: `docs/atlas/
02-audience-subsystem.md` §3b said the target path made *"No Apify call"*, and
`docs/subsystems/audience.md` §H carried it as hypothesis H4. Both described the pre-`34dc98d4`
(2026-07-14) shape. **Both are fixed as of 2026-08-04** — the atlas §3a/§3b rewritten, H3/H4 marked
refuted. If you are costing this flow, read the code, not a doc older than July 14.

Apify is on rotating **FREE** accounts with a **$5/mo hard cap** (~$3.40 left, resets 2026-08-20).
A cap-out is disguised as *"check your handle is public"* — check the ACCOUNT, not the app. **Do
not loop calibration in testing.**

## 5. Traps that will cost you time

- **Audit the funnel on a PRODUCTION BUILD, always.** Dev StrictMode fakes a broken funnel: the
  rehydrate effect's second pass clears `hasUserSelectedToolRef` while the seed inlet early-returns
  on `seedConsumedRef`, so `/home` arrives dead — empty page, no error, forever. It does not ship.
  This cost a previous session ~3 hours. `npm run build && next start`.
- **`npm test` is fake here** — use `node ./node_modules/vitest/vitest.mjs run`. And `npx` wraps and
  swallows output; prefer `node node_modules/<bin>`, trust `$?`, never the summary line.
- **Never run vitest while `npm run build` is running.** Seven API-route tests "fail" on 5s timeouts
  purely from CPU starvation; isolated they pass in ~4s.
  **It does not take a concurrent build.** On 2026-08-04 the full flag-OFF suite failed 2 tests on
  run 1, 2 *different* tests on run 2 (`composer-fold-on-close` + `composer-stop-disc`, at 5523ms
  and 5501ms — the 5s default timeout), and **zero** on run 3, with nothing else running. Those two
  files pass in **3.51s together** in isolation, and the flag-ON pass of the same suite was clean
  throughout. **A wandering failure set at ~5.5s is the machine, not the code** — reproduce in
  isolation before you debug it, and never report it as a regression without that check.
- **Run UI tests BOTH flag ways.** Under `NEXT_PUBLIC_AMBIENT_V2` the thread region only renders
  once `hasConversationContent` is true, so a flags-OFF-only test can pass by matching an *absence*.
  This is not hypothetical here — it is exactly how the `startEngaged` gate in §3 slipped through.
- **The test account has threads**, so `/home` restores the last conversation and
  `hasConversationContent` is legitimately true. Verifying anything on the *empty* home needs a new
  thread. This cost three attempts.
- **Verify RLS, not just the query.** A policy gap turns a count into a silent 0.
- **A green Vercel check on a PR is NOT a build** (`ignoreCommand` skips and posts success). Run
  `npm run build` yourself; vitest does not typecheck.

## 6. Verification

Signed-in verification **works** — `e2e/auth.setup.ts` was fixed 2026-08-01 and passes in ~2.3s.
The test-user credentials are a **REAL PROD account**; dev and prod share one Supabase project, so
anything you write is real. To test a *new* user you need a genuinely fresh account, and every one
you make persists — clean up after yourself (this lane restored the test account afterwards).

Each commit was gated at its own tip: tsc 0 errors · vitest both flag ways, 0 failures ·
`npm run build` clean. Both `3c08ee01`'s new guards and `f55ecb97`'s ordering fix are
**mutation-tested** — each fails when its fix is reverted.

Live, on a production build, signed in as an un-onboarded user (account restored afterwards):
the gate routes `/home` → `/welcome`, `boxShadow` computes to `none`, both step dots track
progress, step 2 auto-starts the spine without re-asking, no console errors — and on `/home` the
intro renders beneath the composer reading *"6 people, built from your description…"*, correctly
offering Ideas rather than the account read for that target audience.

**Re-verified 2026-08-04 at the rebased tip** (`3c97f8a4` + this lane): `tsc --noEmit` 0 errors ·
vitest flag-ON 5043 passed / 0 failed (456 files) · flag-OFF 5042 passed / 0 failed on a quiet
machine (see the timeout trap in §5 before trusting a failing run) · `npm run build` clean.

Re-run the gate before opening the PR — `main` moves:
`node node_modules/typescript/bin/tsc --noEmit` · `node ./node_modules/vitest/vitest.mjs run`
(both flag ways) · `npm run build` (**the** gate — a `src/lib/surfaces/*` import into an API route
breaks the prod build while tsc stays clean).

## 7. Still open

1. ~~The PR.~~ **Merged and deployed 2026-08-04** — see the header. Both PRs merged within seconds
   of being opened (#420 in 7s, #421 in 28s), by the owner's account, with repo auto-merge OFF and
   zero GitHub Actions in this repo. So the near-instant merge was a person or another session
   holding the same token, **not** an automation this lane introduced. Worth knowing if you assume
   a PR on this repo will sit and wait for review: on 2026-08-04 it did not.
2. **Feature discovery — a separate lane.** This lane closes the *setup* gap, not the *teaching*
   one. There is no tour, walkthrough, coachmark or checklist anywhere in `src/` — grepped every
   variant, zero hits, no library. The one first-run affordance that pre-existed
   (`HomeFirstRunDemo`) is gated on `HORIZONTAL_ENABLED = false` and never appears. Everything off
   the Start grid — Discover, Library, Audience, Settings, Referrals — a new user finds or does
   not. Introducing them needs a coachmark pattern that does not exist here: **net-new machinery,
   not wiring.** Worth its own lane and its own decision.

## 8. Do NOT

- Touch the seal / wall / claim path — money path, verified working.
- Widen the `!user.is_anonymous` condition in `middleware.ts:173`.
- Persist the `calibrate` stage to `onboarding_step` (§1.1 — it re-fires a metered scrape).
- Add a second calibration UI. There are already two, and this lane deliberately reused one.
- Flip `hasThread` to render an idle view — it tears the page into a half-thread layout (greeting
  pinned top, composer pinned bottom, dead gap between). Documented in `home-starter.tsx`'s header
  as an already-paid-for bug.
- Stage the untracked leftovers in this worktree: `src/app/zz-preview/`, `scripts/zz-shoot.js`,
  `zz-shots/`, `public/zz-v94-cards.html`, `.planning/sketches/*`. They are the merged card lane's
  throwaway harness. **Stage by name, never `git add -A`.**

## 9. Kickoff

```bash
cd ~/virtuna-slot-a && git switch lane/new-user-onboarding
git rev-parse HEAD                       # must match origin/lane/new-user-onboarding
git rev-list --count HEAD..origin/main   # 0, or rebase before the PR
git status --short                       # untracked zz-* are EXPECTED — never stage them
npm run dev -- --port 3001               # a launchd reaper kills it after ~10 min idle
```

Read in this order: this doc → `src/app/(onboarding)/welcome/page.tsx` →
`src/components/onboarding/connect-step.tsx` → `src/lib/audience/calibration-stages.ts` →
`src/components/app/home/home-audience-intro.tsx` → `src/components/app/home/home-starter.tsx`
(its header comment is a design contract, not commentary).
Every one of those files carries a header comment that argues its own decisions — read them before
changing the code beneath.
