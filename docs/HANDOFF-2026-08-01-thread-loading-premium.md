# HANDOFF — premium thread loading (session 3 close)

> Date: **2026-08-01** · Worktree `~/virtuna-slot-c` (slot pool), port **3003**.
> **PR #411 — MERGED** (`ceff470e`) · **PR #413 — MERGED** (`96ccff5b`).
> `origin/main` = **`96ccff5b`**, **live on numenmachines.com**
> (`dpl_BCSHpMxJZ3u3wJ6Ty4ALgtsFsCjd`). Design SoT: `src/app/globals.css` + `docs/DESIGN-SYSTEM.md`.
> Sketch target: `.planning/sketches/premium-thread.html` (v3.2) — its loading spec is BUILT.
>
> ✅ **The merge gate is CLOSED.** #411 shipped without it (Apify was capped); the key was replaced
> mid-session and **two live billed runs** then exercised the paid path end to end. **They found a
> real defect**, which #413 fixes. Full account in **§7** — read it before touching the account read.
>
> 🔑 **MERGING TO `main` DEPLOYS TO PRODUCTION**, ~3s after the merge, with no preview URL
> (`vercel-git-disconnected` memory, "trade-off accepted"). **The merge IS the ship. Verify first.**
> This was mis-stated as "prod is behind main" early in this session and cost a wrong assumption.

---

## 0. Read this first

Session 1 built the `evidence` SSE machinery. **Session 2 did the craft pass and the two worst
scrape waits.** The owner's verdict on session 1 was *"the dot + line … needs to be cleaner and more
premium, something ChatGPT/Perplexity/Claude would release, and it's missing loading states when
scrapes happen."* Both of those are addressed.

**Session 3 shipped it, and then fixed what shipping revealed.** #411 merged; the Apify key was
replaced mid-session; the merge gate finally ran and **caught a real defect**; #413 fixed it. Both
are live.

> 📖 **If you are picking this up cold, read §7 → §8 → §10 and skip the rest.** §1–§6 are the
> session-2 record, and §5/§6 are explicitly superseded.

**The three things most likely to bite you next**, all learned the expensive way this session:
1. **Merging to `main` deploys to production.** No previews. Verify before you merge.
2. **A mock provider has no concurrency to get wrong.** The account-read race was green in 4948
   tests for as long as it existed. §8.
3. **A capped Apify account looks exactly like a bad handle.** Check the account, not the app. §7.

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

## 5. What was left at #411 — ⚠️ SUPERSEDED by §10, kept for the reasoning

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
- ~~**A live billed run**~~ — ✅ **DONE**, twice. See **§7**.

### Two open calls the owner left as-is (do not "fix" without asking)

- The **rehydrated receipt shows "· 4 steps", not a time.** That is the honesty rule working.
- The **filmstrip for 4a's post covers** is the assistant's taste, not an instruction. A one-line
  swap back to `buildVideoEvidence` gives chips.

---

## 6. Verification state at #411's merge — ⚠️ SUPERSEDED by §9 (kept for the `npx` trap below)

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

## 7. ✅ The merge gate — closed, and it caught a real defect

**#411 shipped without it.** The Apify account then in use (`rousing_saxophone`, FREE) had spent
**$5.06 against a $5.00 `maxMonthlyUsageUsd` cap**, so every actor run was refused:

```
HTTP 403  {"error":{"type":"platform-feature-disabled","message":"Monthly usage hard limit exceeded"}}
```

🔑 **The tell was Apify's own run history: the newest run was 2026-07-19 — the attempt never
created a run at all.** If your call did not produce a run, the failure is UPSTREAM of the scrape,
and no amount of reading app code will explain it. The routes disguise this: `/api/account-read`
catches the throw and streams *"Couldn't read your account. Check your handle is public and try
again."*, so a hard billing stop is indistinguishable from a bad handle. Check the account, not the
app — see the memory `apify-free-plan-hard-limit`.

**Even the failed attempt proved things**, because it reached the real route on the real 5-credit
path: the credit gate admitted, the stream opened, the new 4a `stage` frame fired at 1.3s, the
error copy stayed generic without echoing the handle (T-10-13), and **`reading_events` stayed at 56
— the creator was NOT billed for a scrape that failed**, verified against the production table
rather than a mock.

### The owner supplied a fresh key, and the gate ran

New account **`arcuate_azurite`** (FREE, $1.56/$5.00, cycle to **2026-08-20**). Replaced in the
`.env.local` of **all 14 worktrees** and in **Vercel Production**, then prod was **redeployed** —
a Vercel env change does nothing until a deployment picks it up.

**Run 1 (pre-fix), `@zachking`, 37.6s — DELIVERED, `reading_events` 56 → 57:**

```
 1.2s  Finding your profile       -> active
19.1s  evidence "Reading 8 of your posts"     <- the POSTS landed first
37.2s  Finding your profile       -> done
37.2s  Reading your last 30 posts -> active
37.2s  Reading your last 30 posts -> done     <- active and done in ONE tick
```

The paid path worked. **But the spine was wrong**, and only a live run could show it — see §8.

**Run 2 (post-fix), same account, 21.0s — DELIVERED, `reading_events` 57 → 58:**

```
 1.0s  Finding your profile       -> active
 1.0s  Reading your last 30 posts -> active
11.5s  Reading your last 30 posts -> done   + covers, step-tagged
20.7s  Finding your profile       -> done   + avatar, step-tagged
21.0s  done
```

**How to run it again** (the driver prints every SSE frame with elapsed timestamps): sign in by
POSTing the Supabase password grant and writing the chunked cookie (§4), then
`POST /api/account-read` with it. The precondition is already MET — the E2E account carries a
personal audience calibrated to `@zachking`, so the route scrapes rather than exiting thin.
⚠️ Each run costs **5 credits + real Apify usage**, against a $5/month cap.

---

## 8. The defect the live run found — shipped as PR #413 (`96ccff5b`)

The account read fires **two independent Apify runs**, and both of row 2's transitions were chained
to the **profile** promise. That encoded an assumption the code stated out loud in
`account-read-stages.ts` — *"the profile typically lands first, the 30-post pull after it"* — and
**both live runs disproved it: the posts came back first, by 18s and by 9s.**

Consequences, all visible only on a real run:
- Row 2 went active and done in the same tick, so the row whose work actually took the time never
  rendered as in-progress.
- The post covers were drawn under *"Finding your profile"* — a step still running — because the
  evidence rail hangs off whichever row is active.
- The avatar the phase exists to surface was on screen for 0.4s before the card replaced it.

🔑 **Why the suite was green throughout: the account-read tests mock the provider, so both promises
settle instantly and in declaration order. A mock with no concurrency has no race to get wrong.**
This is the `green-test-is-the-accomplice` pattern with a new face — and the same face as session
2's *"the account read is one scrape call (no stages)"*: **the code's own comment was the bug.**

### The three commits

| sha | what |
|---|---|
| `3638133c` | Each row reports **its own** promise. Two rows are live at once because two scrapes are. `RunEvidence` gains an optional **`step`** naming its row; the checklist prefers it; `parseRunEvidence` carries it across the wire. Additive — absent ⇒ the old active-row fallback, so every other emitter is byte-identical. |
| `5f8b5058` | The rail said *"Reading 8 of your posts"* while the card replacing it reported 30 analyzed — `MAX_EVIDENCE_ITEMS` leaking into a sentence about the work. The strip still shows 8; the sentence counts the read. |
| `7d0f6fa7` | **One row narrated.** See below. |

### ⚠️ The correct data model was still a visual regression

Giving each row its own promise was right, and it silently undid the session-2 craft pass. Measured
on the **compiled DOM** at the real 728px width, with two rows live:

| | accent-painted elements | running per-row clocks | height |
|---|---|---|---|
| one live row (reference) | 1 | 1 | 55px |
| both live, before `7d0f6fa7` | **2** | **2** | 59px |
| both live, after | **1** | **1** | 55px |

…for `1.0s → 11.5s` of a 21s read — **about half the wait**. The craft pass had taken accent-filled
elements 4 → 1 and in-flight per-row clocks 1 → 0; this gave most of that back, on the exact
surface the lane exists to improve. Two coral nodes also stop answering *"where am I"*.

**Resolution:** the FIRST live row **leads** — accent node, running clock, rotating sub-detail,
travelling rail pulse. Any other live row stays honestly live and goes **quiet**: a brighter
*breathing outline* against pending's still faint one, at the same text weight as a finished row.
Fill vs outline is how this spine already separates states, so a second live row reads as running
without spending the accent. `isLead` defaults true and `ProgressChecklist` marks the first active
row, so **sequential pipelines are byte-identical**. The clock still RUNS for a quiet row (that is
what reports the true duration on freeze); only its display is suppressed. A finished row keeps its
frozen stamp — a receipt, not a second running clock.

🔑 **The lesson worth carrying: a correct data model can still be a visual regression. Measuring
the SSE frames is not measuring the surface — measure the DOM too.**

---

## 9. Verification state at close

`tsc --noEmit` clean · `vitest run` **4956 passed / 42 skipped** · `next build` **exit 0** ·
eslint clean on every touched path · **two live billed runs** against real Apify · production
healthy (`numenmachines.com` + `/login` both 200).

Pre-existing and unrelated: vitest prints 3 "Unhandled Rejection" lines from `composer.test.tsx`;
the suite still exits 0.

## 10. What is LEFT (nothing is blocked)

- **4b — the paid "Find new outliers" Apify run (~25s)**, `src/lib/grounding/orchestrator.ts`
  `gatherAndExtract`. The only EXPLICITLY PURCHASED wait in the product. Copy the
  `emitEvidenceSafely` guard, and **tag its evidence with `step`** — that seam now exists.
- **4c — explore pull**, `src/lib/tools/runners/explore-runner.ts:105`. A cache MISS parks the
  spine then flashes.
- **4e — competitors**, still unsurveyed.
- ⚠️ **Branch these off `main`**, which now carries both the evidence machinery and the `step`
  routing. Do NOT stack on the merged lanes.
- ⚠️ **Apify has ~$3.40 of $5.00 left, resetting 2026-08-20.** Live-scrape verification is possible
  but finite. Check the account before planning work that needs it.
- **One gap, stated plainly:** the final quiet-row treatment was verified as static rendered states
  (compiled DOM, real component, real plan) and the ordering was verified on a live run — but no
  live run was watched rendering the final visual treatment end to end.
