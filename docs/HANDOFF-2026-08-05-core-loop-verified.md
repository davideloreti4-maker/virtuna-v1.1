# HANDOFF — the core loop, walked in a real browser

**Written** 2026-08-05 (late session) · **Base** `origin/main` = `6849f854` · **Supersedes** the
scope of `docs/HANDOFF-2026-08-05-next-core-verify.md` (its P1 framing is corrected in §1 below).

Scope was **thread · skills · rail**, verified signed-in in a running browser rather than on a green
suite. Three defects found, all three fixed, merged and re-verified on production.

---

## 0. Deployment state — and why the Vercel history looks alarming

| | |
|---|---|
| `origin/main` | **`6849f854`** (#444) |
| production | `dpl_7Z7xcKcq…` **READY**, `target: production`, sha `6849f854` |
| previous prod | `dpl_4aHR27jQ…` READY, sha `1a1a9f24` (#443 — the three fixes) |
| `numenmachines.com` · `/go` · `/home` | 200 |
| open PRs | **#376** only (Cursor Cloud env, pre-existing) |

🔑 **A wall of `CANCELED` rows in the deployment list is the build gate working, not a failed
deploy. Read `target`, not `state`.** `target: "production"` + READY = a real build off `main`;
`target: null` + CANCELED = a preview off a branch, skipped by `vercel.json`'s `ignoreCommand`.
Because the auto-push hook pushes every commit as it is made, ONE merged PR leaves 3–4 canceled
preview rows and a single READY row — the noise outnumbers the signal about 4:1.

Every `main` merge on 2026-08-05 built and went READY. Do **not** re-enable preview builds to make
the list look tidier: those skips are the cost control that made reconnecting git possible
(113 branches × full Next.js builds was the original problem).

**The one-step independent check:** measure the change itself on `numenmachines.com`. A code fix
visible on the live domain proves the build ran *and* that the alias moved; the deployment list
alone proves neither.

---

## 1. P1 — omni. The premise in the previous handoff was wrong

That handoff said omni "now does exactly ONE job and it is getting it wrong". **Re-measured: omni
does its one job correctly.** Ground truth first — `ffmpeg silencedetect` on the 28.6s skit:
0.69s of silence in 28.57s = **97.6% audible speech**. Then four back-to-back reads, temp 0, seeded:

| path | result |
|---|---|
| **split AUDIO leg** (omni, the shipped path since #433) | `0.05 / 0.95 / 0` — **right, 4 of 4** |
| **unified** read (the FALLBACK, only runs when the split fails) | **wrong 2 of 4** |

```
run 1  unified  silence 0.05 · voice 0.90 · music 0.05   sum 1.00   right
run 2  unified  silence 0.05 · voice 0.00 · music 0.95   sum 1.00   WRONG — AND IT SUMS
run 3  unified  silence 0.05 · voice 0.00 · music 0.00   sum 0.05   wrong, caught by the sum
run 4  unified  silence 0.05 · voice 0.90 · music 0.05   sum 1.00   right
```

🔑 **The sum invariant everyone reached for would have caught only HALF of it.** Run 2 calls a
pure-dialogue skit 95% music and the arithmetic is exact. The check that works is a
**contradiction test**: the same response reports 0% voice while carrying a verbatim transcript and
a non-null speech score. A read that disagrees with ITSELF is checkable with certainty and needs no
ground truth.

Generalise: when a model emits a structured claim, prefer a check against the model's OWN other
outputs over a check against the spec. The spec-check passes on confident nonsense.

**Shipped** (`src/lib/engine/qwen/audio-mix.ts`, wired into the drift detector on both paths):
a trip is **drift**, not a Zod failure, so the existing bounded retry re-runs only the cheap call
rather than burning a 60s re-read of the video. If the retry still contradicts itself the three
ratios are **nulled together** and every consumer drops the mix — `deepseek.ts` omits Apollo's
`Mix:` line rather than emitting a false one, `merge.ts` tells the coherence judge `not measured`,
`audio-perceptual.ts` renormalises. **Null must never be read as 0**, which would score a talking
head as voiceless.

**Verified live after the change:** the guard tripped on **3/3** unified reads and the bounded
retry landed all three on `0.05 / 0.90 / 0.05`. The split leg never tripped — no false positives.
The retry costs ~7s, and only on the path that is already a fallback.

The original diagnosis of *where* the guard was missing was right and still holds: the refine lived
at `types.ts:637` on the legacy **Gemini** schema while the live path parsed `qwen/schemas.ts`.

---

## 2. Two UI defects, both live on production before the fix

**The sim drill headed every text sim `Untitled`.** Fire a queued rail row → seal → open it, and
the drill read `HOOK / Untitled`. `buildDomainTemplate` was called without `transcript` while the
concept text sat on the descriptor, in the same field the ARM panel two branches up already reads.
It also starved the Brain tab's attention scrubber, which fell back to the coded reason labels.

**Card handoffs fired runs without re-pinning the thread.** `useThreadAutoscroll`'s own contract
says a send must leave the new turn visible, and both *sending* paths honoured it. The in-thread
card CTAs are a third path that dispatches and did not. Measured: a hook card in view at y=389 in a
9,544px thread, `Write the script →` ran a full script **8,478px below the viewport** and the view
never moved for the 90s it took — the button read as dead, twice.

🔑 After fixing a "the view didn't follow the output" defect, enumerate every site that
**DISPATCHES**, not every site that resembles the one you fixed. `grep -n "noteRun("` listed all
seven in one shot. `handleTestHook`/`handleTestScript` genuinely do not need it — they ARM the
composer, whose dock is fixed to the viewport.

⚠️ Playwright's `.click()` auto-scrolls the target into view and releases the pin, manufacturing
this exact symptom. Dispatch with `el.click()` inside `page.evaluate` and assert the button's
`getBoundingClientRect().top` to prove it was genuinely on screen.

---

## 3. Verified WORKING — measured, not assumed

- **Shipped 08-05 and previously unseen on prod, now confirmed there:** the `verdict only` tag on
  every sealed depthless row (all `disabled`), and zero `#N` on hook cards (labels or badges).
- **The full rail drill:** queued → ARM → real `POST /api/tools/react` **200** → row seals at
  rank 2 / 60.0% → click opens **Brain** (WebGL cortex, signal breakdown, network activation),
  **Engagement** and **Audience**, all populated.
- **Thread:** pins to bottom on send, answer fully visible (y=379 in a 717px viewport); the seal and
  full history survive reopening the thread from the sidebar.
- **Skills:** hooks and script render with grounded outlier citations; the `Write the script →`
  handoff and the follow-up chips both run and land.
- **The credit wall:** a 402 renders the personalised trial dialog quoting the user's own audience.

---

## 4. NOT done — the honest gaps

- 🔴 **The skill walk is incomplete.** Covered: hooks, script, chat, the rail. **Not run: `ideas`,
  `remix`, `read`, `test`** (the video-upload path). The new unlimited account (§5) makes this cheap.
- 🔴 **Mobile was not checked at all.** Needs its own context opened at 390×844 — resizing a loaded
  page is not the mobile UI.
- Bare `/home` carries no thread id, so a hard reload lands on a blank new thread; reopening from
  the sidebar restores everything including the seal. Consistent with the existing note that
  `/home?thread=` never existed.
- While collapsed to its 56px rail, the sidebar toggle still reads `aria-label="Collapse sidebar"` —
  it announces the wrong direction.

Still open from earlier sessions, unchanged: insight-drill parity (2 of 6 templates have no
producer — owner scope call), **F-015** (inert Flash/Max selector — bug or unbuilt?), four unmetered
Apify routes, four blind scrape waits, chat driving 3 of 12 skills, and the 65 unmerged commits
across 13 branches (never verified per-branch — do not merge on this session's authority).

---

## 5. Test accounts — two, and they must stay two

| account | tier | job |
|---|---|---|
| `e2e-test@virtuna.local` | `free` | **Keeps the walls testable.** Today's 402 → trial-wall dialog was verified through it. Out of credits, by design. |
| `staff-unlimited@virtuna.local` | `studio` | Billed walks that must not stop. User `29df2c3d-…`. |

Provisioned by `scripts/create-unlimited-test-user.ts` (idempotent; password from
`STAFF_TEST_PASSWORD` or generated and printed once — **credentials are not in the repo**).

⚠️ **"Unlimited" means no MONTHLY wall, not no ceiling.** `UNLIMITED_DAILY_CREDIT_CEILING` still
applies: **300 credits per UTC day**, and the verdict returns `reason: "fair_use"`, not `"upgrade"`.
Raising it means editing that constant — i.e. changing fair-use policy for every Studio customer.

The trial fields are explicitly NULLed: `creditAllowanceFor` lets the TRIAL cap beat "unlimited"
by design, so an account carrying a live trial window is capped at `TRIAL.credits` whatever its
tier says.

⚠️ Both are **real production accounts** on the shared Supabase project. Their runs spend real
DashScope and Apify money.

---

## 6. Traps re-confirmed this session

- **`main` moved twice mid-session under a co-session**, which was also pushing
  `task/calibration-premium` and driving a second tab of the **shared** Playwright browser on the
  **same test account** — an unexplained `POST /api/tools/hooks` appeared in my dev log. `git fetch`
  + `git rev-parse` before acting on any sha, and do not assume a run in your log is yours.
- **A green Vercel check on a PR is not a build.** Run `tsc --noEmit` yourself; vitest does not
  typecheck.
- **Merging IS deploying** (~4 min, no preview URLs).
- **The suite is intermittently flaky under parallel load** — but it was clean all four full runs
  today (5,325 passed), so do not reach for that excuse first.
- `gh pr merge --delete-branch` prints `fatal: 'main' is already used by worktree at …` **after a
  successful merge** — it is `gh` trying to check out `main`, which trunk holds. Check
  `git rev-parse origin/main` before believing the merge failed.
