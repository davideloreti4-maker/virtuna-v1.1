# HANDOFF — premium thread loading (session 3 close)

> Date: **2026-08-01** · Branch `task/thread-loading-premium` · **PR #411 — MERGED**
> Worktree: `~/virtuna-slot-c` (slot pool), port **3003**. Base: `origin/main` `fb0a5a00`.
> HEAD at merge: **`a053c4ae`** · 17 commits ahead of main · pushed (post-commit hook auto-pushes).
>
> ⚠️ **#411 was merged WITHOUT the live billed run its own §5 named as the merge gate.**
> The gate could not be run — see §7. Read that section before assuming the paid
> account-read path has been exercised against real Apify. It has not.
> Design SoT: `src/app/globals.css` + `docs/DESIGN-SYSTEM.md`.
> Sketch target: `.planning/sketches/premium-thread.html` (v3.2) — its loading spec is now BUILT.

---

## 0. Read this first

Session 1 built the `evidence` SSE machinery. **Session 2 did the craft pass and the two worst
scrape waits.** The owner's verdict on session 1 was *"the dot + line … needs to be cleaner and more
premium, something ChatGPT/Perplexity/Claude would release, and it's missing loading states when
scrapes happen."* Both of those are addressed.

**Recommendation on the table, owner has not decided:** ship #411 now rather than growing it, and do
4b/4c/4e in a fresh lane off main afterwards. Reasoning in §5.

---

## 1. What session 2 shipped (4 commits)

| sha | what |
|---|---|
| `7a8075e7` | **Job 1 — the craft pass on the spine** |
| `59ae73ee` | **4d — calibration (126s) onto the spine** |
| `f63ce649` | **4a — account read (30s) emits profile + post covers** |
| `1d9ad727` | **fix — a display bug could fail a PAID scrape** (see §3) |

### The craft pass — the diagnosis, which is the part worth keeping

The problem was never the dot's styling. **A filled cream disc with a ✓ sat at full brightness on
every finished row for the whole run, while the covers we had just fetched sat under it in 12px
grey — the progress chrome was louder than the proof.** Reference tools invert that. So did we.

Locked decisions (owner-approved from `.planning/sketches/thread-spine-craft-2026-08-01.html`, two
rounds, published for review):

- **No per-step ✓ at all.** Neither Claude nor ChatGPT marks a finished step with one; both let the
  step go quiet and let the block collapse. Completion is carried by the **filled rail leg** + the
  label receding to `--color-cream-muted`.
- Node **16px → 7px**, rail **2px → 1px**. States separate by **fill vs outline**, not brightness —
  at 7px a brightness delta is invisible.
- **Finished rows recede.** At any moment exactly one row is at full cream: the live one.
- **One clock**, in the run-surface head. Per-step durations moved to the **expanded receipt**.
- **Collapse = "Generated in 0:32"**, via a new per-skill `SkillRunMeta.took` verb ("Generated in"
  is right for a draft, wrong for a scrape).
- **A run surface to collapse into**: 2% white whisper, deliberately lighter than the result cards,
  so process reads as subordinate to output.
- Evidence headline **replaces** the rotating sub-detail on a step that has evidence (it was the
  same sentence twice). Rail eyebrow: 11px uppercase tracked → 12px sentence case.

Measured before→after on the rendered DOM: checkmarks **4 → 0**, accent-filled elements **4 → 1**,
in-flight per-row clocks **1 → 0**, block height **307 → 320px** (it got *taller*, not denser — the
surface head costs more than the tighter rows save; the owner accepted this).

### 4d + 4a — both were fixed PREMISES, not new features

- **4d calibration** needed no new pipeline knowledge. The three phases were always real and always
  honest; they were emitted as `status` **messages**, so the longest wait in the product rendered as
  one plain line. They now also ride as `stage` frames. `status` frames are untouched and still the
  fallback.
- **4a account read** was blind because the code's own comment was wrong: *"the account read is one
  scrape call (no stages)"*. It is `scrapeProfile` + `scrapeVideos` — two independent Apify runs.
  It is now the app's **first `kind:'profile'` producer** (the rail supported the avatar disc;
  nothing had ever emitted one). The creator's own posts render as a **filmstrip**, not chips —
  they are all one account, so a row repeating the same handle is noise.

> ⚠️ Stage names for both live in **client-safe modules** (`lib/audience/calibration-stages.ts`,
> `lib/account-read/account-read-stages.ts`). The route emits them and a `'use client'` component
> renders them, so either side owning the constant forces the other to import it. Importing
> `account-read.ts` from the field drags `ApifyScrapingProvider` into the browser bundle — **tsc is
> happy with that; `next build` is the gate that is not.**

---

## 2. Honesty rules (locked by tests — do not regress)

Session 1's rules all still hold. Session 2 added three:

- **The run clock reports only what THIS component timed.** A rehydrated turn replays its plan as
  done having measured nothing, so it keeps the step-count receipt and shows **no** duration. You
  only ever see "Generated in 0:32" on a run you actually watched.
- **A duration is displayed only where we both timed the step AND know it completed.** The clock
  reports on unmount (see §3), which cannot distinguish finished from aborted; the settled stage
  list can.
- **A phase boundary is a fact about the pipeline** and must never depend on whether there is
  something pretty to show.

---

## 3. Three real bugs found while building — the pattern matters

All three were invisible to a green suite. Two were mine.

1. **The last step's duration was always lost.** The spine unmounts at collapse before that row
   observes its own `done`, so `useStageClock` never froze. Fixed by reporting on the way out.
2. **A display bug could fail a PAID read** (`1d9ad727`). Evidence emission is chained onto the
   scrape promises, so a throwing builder rejected the chain and returned `scrape_failed` for a
   scrape that had **succeeded** — the creator pays 5 credits and is told it failed.
3. **The spine could stick on step 1 forever** (`1d9ad727`). The phase transition sat inside
   `if (evidence)`, so an account with no avatar and no handle never advanced.

> 🔑 **2 and 3 were found by re-reading the diff, not by a test.** The account-read unit tests mock
> the provider, so neither path was ever exercised — the "green test is the accomplice" pattern,
> verbatim. Both new tests were confirmed RED against the previous commit (stash the source, watch
> them fail, restore). **A test that passes before the fix proves nothing.**

---

## 4. ✅ Signed-in verification is UNBLOCKED — and `auth.setup.ts` now works again

> **Session 3 correction — both claims below were dev-only artefacts.** `npm run e2e:auth` is
> fixed and passing (`a053c4ae`); the ordinary Playwright path is live again, and the
> cookie-minting recipe further down is now a fallback, not the only door.

**The `/login` hydration bug does NOT reproduce on a production build.** Measured on `next build`
+ `next start` at :3003: the toggle click reveals the password field, a full password sign-in
lands on `/home` with `sb-<ref>-auth-token` set, and the page logs **zero** pageerror events,
**zero** console errors and **zero** hydration mentions. **Returning password users are not locked
out.** (Session 2's dev observation stands as a dev observation; it was not re-verified in dev,
because prod is what the question was about.)

**`e2e/auth.setup.ts` is fixed, not deleted.** What was actually stale:
- It filled `input[name="password"]` on arrival, but that field does not exist until the
  "Sign in with a password instead" disclosure is opened.
- `input[name="email"]` is now **ambiguous** — the OTP form has one too — so the old unscoped
  selector is a strict-mode violation. Fields are scoped to the form owning the password input.
- `networkidle` never settles (dev HMR socket). Replaced with `domcontentloaded` + locator waits.
- It waited for `dashboard|welcome`; **this app has no `dashboard` route** and an established
  account lands on `/home`. Now it asserts only that we left `/login`.
- It now throws when no Supabase cookie was set, instead of writing a `storageState` that
  authenticates nobody.
- `baseURL` hardcoded `:3000` → `E2E_BASE_URL` with the same default, so a slot worktree stops
  silently driving whichever other worktree owns that port.

Verified: `--project=setup` passes in **2.3s** against the prod build and writes the same
2635-char cookie the manual recipe produced.

**What works — mint the session directly** (full recipe in memory `signed-in-verification-recipe`):

1. `POST {SUPABASE_URL}/auth/v1/token?grant_type=password`, headers `apikey` + `Authorization:
   Bearer <ANON>`, body `{email,password}` → the session JSON.
2. `@supabase/ssr` 0.8 stores it as `sb-<ref>-auth-token` = `'base64-' + base64url(JSON)`, chunked
   at 3180 chars (a real session is ~2635 → one chunk).
3. Write as a Playwright `storageState` (`domain: 'localhost'`, `secure: false`). Verified: `/dev/cards`
   loads authenticated instead of 307ing.

**Credentials are in `~/virtuna-slot-c/.env.local`** as `E2E_USER_EMAIL` / `E2E_USER_PASSWORD`
(gitignored, verified untracked). ⚠️ It is a **real prod account** — a live run spends real credits.

**Other traps this cost time on:**
- `waitUntil:'networkidle'` **never settles** (dev HMR socket). Always `domcontentloaded` + an
  explicit wait.
- The app SSRs to a near-empty shell — `/home` and `/dev/cards` both render just `⚙` in the HTML.
  **A near-empty body is not proof the route is broken.**
- The dev server is killed by a launchd reaper after ~10 min idle. **Confirm it is listening before
  every run** — it died twice mid-session.
- For pure COMPONENT verification skip auth entirely: a throwaway `src/app/zz-preview/page.tsx` sits
  OUTSIDE the `(app)` group, compiles in seconds, mounts real components with fixtures. **Delete it
  before committing** (and `rm -rf .next/dev/types` after, or tsc fails on a stale route type).
  For before/after, extract the old component:
  `git show "<sha>:src/components/thread/progress-checklist.tsx"` — **quote the `sha:path`**, zsh
  applies its `:s/` history modifier and silently mangles it otherwise.

---

## 5. What is LEFT

### ✅ DECIDED (session 3) — shipped

The owner chose **ship #411 now; do the rest in a fresh lane off main.** Merged as a `--no-ff`
PR merge, the house convention. **4b/4c/4e must branch off `main`, not off this branch.**

The merge gate below could not be run. See **§7** — it is the one thing this PR shipped without.

### Not done

- **4b — the paid "Find new outliers" Apify run (~25s).** `src/lib/grounding/orchestrator.ts`
  `gatherAndExtract`: `scrapeVideos` (broad search) → `selectCandidates` → `Promise.all(survivors
  .map(profile-scrape))` → extract. All under one static "Finding proven outliers" row. **This is
  the only EXPLICITLY PURCHASED wait in the product and deserves the most legible progress in the
  app.** Real sub-boundaries already exist inside; emit them, and emit survivors' covers as they are
  profile-scraped. The `emitEvidenceSafely` guard from `1d9ad727` is the pattern to copy.
- **4c — explore pull.** `src/lib/tools/runners/explore-runner.ts:105` —
  `sources.map((s) => provider.scrapeVideos(s, …))`. The route brackets it with one
  active→done, so a cache MISS parks the spine then flashes. Ranked tiles carry `coverUrl`.
- **4e — competitors.** Still not surveyed. `src/components/competitors/*-skeleton.tsx`,
  `api/cron/refresh-account-snapshots`.
- **A live billed run** — ⚠️ STILL NOT DONE, and now merged around. See **§7**.

### Two open calls the owner left as-is (do not "fix" without asking)

- The **rehydrated receipt shows "· 4 steps", not a time.** That is the honesty rule working.
- The **filmstrip for 4a's post covers** is the assistant's taste, not an instruction. A one-line
  swap back to `buildVideoEvidence` gives chips.

---

## 6. Verification state at handoff

`npx tsc --noEmit` clean · `npx vitest run` **4948/0** · `npx next build` **exit 0** (the
"1 routes / ~460ms" line is the output formatter, not the build — check `$?`) · eslint clean on
every touched path. Two pre-existing warnings/errors confirmed by stashing:
`api/audiences/calibrate/route.ts` (1 warning) and `dev/cards/page.tsx`
`react-hooks/set-state-in-effect` at HEAD line 1391.

**Previews:** `/dev/cards` → the **Loading** tab now has `loading-run-lifecycle`, a looping full run
(pending → active → done → measured receipt). It exists because the measured total is real client
state with no prop that fakes it — the only way to look at it is to let a run play out.

**Review artifacts** (owner-facing, real components at true 728px width):
- Craft-pass sketch v2 — <https://claude.ai/code/artifact/10273a2d-97bd-4c32-b98b-7dfa6937bf60>
- What shipped, before/after — <https://claude.ai/code/artifact/f4c1dcff-9148-4c0d-9eaa-76da2d67f1dc>

**Re-verified at session-3 close** (post `a053c4ae`): `tsc --noEmit` clean · `vitest run`
**4948 passed / 42 skipped**, exit 0 · `next build` **exit 0** · eslint clean on both changed
files. The 3 "Unhandled Rejection" lines vitest prints from `composer.test.tsx` are
**pre-existing** and unrelated — `e2e/` is excluded from tsconfig, so nothing session 3 touched
is even in vitest's or tsc's scope.

> 🔑 **`npx` is wrapped in this environment and eats command output.** `npx next start` wrote
> only `Errors: 1` to its log and exited 1, with the real message swallowed; the identical
> command as `node node_modules/next/dist/bin/next start` started fine. When a CLI fails with
> output that looks like a summary rather than an error, **re-run it through `node <bin>` before
> debugging the app.** Same for reading logs — `cat` results get reformatted too.

---

## 7. ⚠️ The merge gate was NOT closed — Apify is at its hard limit

**#411 merged without the live billed account-read run.** Do not read the merge as evidence that
the paid path works end-to-end; it is not.

**Why it could not run.** The Apify account (`rousing_saxophone`, **FREE** plan) has spent
**$5.06 against a $5.00 `maxMonthlyUsageUsd` cap**. Every actor run is refused:

```
HTTP 403  {"error":{"type":"platform-feature-disabled",
           "message":"Monthly usage hard limit exceeded"}}
```

The billing cycle runs **2026-07-11 → 2026-08-10**, so the cap lifts on **2026-08-10** unless the
plan is upgraded. Corroboration that this is environmental and not a code fault: Apify's own run
history shows the **last actor run was 2026-07-19** — today's attempt never created a run at all.

**What the attempt DID prove** (it reached the real route, signed in, on the real 5-credit path):

| | |
|---|---|
| auth + credit gate | passed — HTTP 200, `text/event-stream` opened |
| `status` frame | emitted at 1.1s |
| **`stage` frame** | **`Finding your profile → active` at 1.3s** — the new 4a plumbing fires on the real route |
| failure path | generic copy, `retry:true`, **handle never echoed** (T-10-13 held) |
| **billing** | **`reading_events` 56 → 56 — NOT charged.** The bill-on-delivery rule held on a real failure |

That last row is worth keeping: a creator whose scrape failed was not billed, verified against the
production table rather than a mock.

**What remains unproven** — the success half: `buildProfileFrame` and `buildAccountPostFrames`
against real Apify shapes, `ACCOUNT_READ_PLAN[0] → done` / `[1] → active`, the filmstrip, and the
`done` frame.

**Why merging anyway was defensible** (owner's call, made on this reasoning): the defect class the
gate targets was made *structurally impossible* by `1d9ad727`. Both evidence emissions sit inside
`emitEvidenceSafely` (`account-read.ts:424,429`), whose `catch` swallows everything, and `onStage`
routes to the route's `send()`, which wraps `enqueue` in its own try/catch (`route.ts:117-125`).
**The split chain can therefore only reject if the provider itself rejects — the pre-existing
behaviour, unchanged by this PR.**

**➡️ Owed, first session after 2026-08-10 (or immediately if the plan is topped up):** one
`POST /api/account-read` signed in as the E2E user. The precondition is already MET — the account
carries a personal audience calibrated to **`@zachking`**, so the route will scrape rather than
exit on the thin fallback. Confirm the four success-path items above, and that `reading_events`
increments by exactly one. The driver script is in the session scratchpad
(`live-account-read.mjs`) — it prints every SSE frame with elapsed timestamps.
