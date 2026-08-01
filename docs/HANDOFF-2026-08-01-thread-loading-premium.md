# HANDOFF — premium thread loading (session 2 close)

> Date: **2026-08-01** · Branch `task/thread-loading-premium` · **PR #411** (open, NOT merged)
> Worktree: `~/virtuna-slot-c` (slot pool), port **3003**. Base: `origin/main` `fb0a5a00`.
> HEAD: **`1d9ad727`** · 15 commits ahead of main · pushed (post-commit hook auto-pushes).
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

## 4. ✅ Signed-in verification is UNBLOCKED — but not the documented way

**`e2e/auth.setup.ts` cannot work and should be treated as dead code.** It fills
`input[name="password"]`, but `/login` is now **emailed-code-first**: the only input is `email`, and
password lives behind a "Sign in with a password instead" button. **That button does nothing** — the
page throws *"A tree hydrated but some attributes … didn't match. This won't be patched up"*, so
React never attaches its `onClick`. The config also hardcodes `baseURL: :3000`.

> ⚠️ **Product bug worth its own look, outside this PR:** if that hydration mismatch reproduces on a
> PROD build, returning password users cannot reach password sign-in at all.

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

### The recommendation (owner has not decided)

**Ship #411 now; do the rest in a fresh lane off main.** It is 15 commits, the two waits the owner
ranked most painful are done, and what remains is the shallow end. Growing it triples the review
surface for a fraction of the felt improvement.

**Gate the merge on ONE live account-read run.** Not for the craft — that is measured. For the
plumbing: a `Promise.all` was split on a 5-credit path and the two defects in §3 were both invisible
to the mocked tests. One real run is the only thing that closes it.

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
- **A live billed run** — see the gate above.

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
