# HANDOFF — onboarding UI refinement (the owner has feedback to give)

**Branch:** `task/onboarding-ui-refinement`, cut from `origin/main` @ **`470ef6ae`**
**Worktree:** `~/virtuna-slot-c` · **Port 3003**
**Status:** nothing built yet. This document exists so the next session can start from evidence
instead of re-deriving it, and so the owner's feedback lands on something concrete.

⚠️ **Merging to `main` IS deploying** — prod builds ~4 minutes after the merge (the older "~3s" note
was wrong), and there are no preview URLs.
⚠️ **`main` moves constantly.** It moved SIX times during 2026-08-04. `git fetch` and re-measure;
never act on a sha written in a document, including this one.

---

## 0. Start here — the thing to look at first

**The review page: https://claude.ai/code/artifact/1d55c5eb-bf04-428f-93cf-f4e57c10d48a**

Eight steps of the real onboarding, desktop and mobile side by side, every frame a screenshot of
production (`numenmachines.com`, build `61801368`) taken by walking a fresh signup end to end with a
real scrape. Click any frame to enlarge. **This is the artefact the owner is reviewing** — their
feedback will refer to its steps, so read it before touching code.

⚠️ **The screenshots themselves live only in that artifact.** They were captured into a
session-scoped scratchpad that is now gone. §4 has the recipe to re-shoot them.

---

## 1. What shipped today, so it is not re-opened

PR **#429** merged as `61801368` and is live. The onboarding activation lane is **closed**:
the funnel sink (`checkout_paid` had never been emitted once), one free `ideas` card per calibrated
creator, a personalised wall, marketing CTAs → `/go`, the craft pass, the profile-card clip, and the
billions bug (`1300.0M likes` → `1.3B`). Full record:
`docs/HANDOFF-2026-08-04-onboarding-activation-SHIPPED.md`.

**LOCKED owner calls — do not re-litigate** (they were decided, and two were decided twice):

1. The onboarding **is the first run**. Not a demo, not info screens, not a walkthrough, not a tour.
   The teaching lives in the artifact and the empty states.
2. The first card is funded by an **entitlement**, not a credit grant.
3. Marketing CTAs point at **`/go`**; `/signup` stays reachable but unpromoted.
4. Calibration sits **post-payment and parallel** for funnel B (`ONBOARDING-FUNNEL-DESIGN.md`
   §0a/§0b — also not open).
5. The wait shows the **real material as it lands**.

## 2. The six observations the owner is responding to

These are stated on the review page in this order. They are **observations, not agreed defects** —
the owner's feedback decides which become work.

| # | Observation | Status |
|---|---|---|
| 1 | **Desktop step 1 is a 400px card in a 1512×982 void.** The same card fills a phone screen. Compare the two frames — the difference is stark. | Owner's call |
| 2 | **"Good afternoon," ends on a comma with nothing after it.** `home-greeting.tsx` expects a name a new account has not given. | Looks like a straight bug |
| 3 | **The wait is not a stable length.** Same handle, three live runs: **110s, 155s, 209s.** Any copy promising a duration will be wrong for someone. | Constrains copy |
| 4 | **Covers arrive as a batch, not a trickle.** Measured on @mrbeast at 1.5s polling: 0 → 12 covers in ONE poll at t=9s. The screen is honest as built; the *framing* "covers appear as they are read" is not. | Do not ship that copy |
| 5 | **The personas do not stream.** One model response; the stagger is a client-side entrance. Honest as built — just never describe it as the engine thinking. | Do not ship that copy |
| 6 | **The teaching half is one sentence.** *"10 people, built from @mrbeast. Every card you make is written for one of them."* That is the entire explanation of the product, and on desktop it sits below the composer. | Owner's call |

⚠️ **#6 is the one that matters most and is the least built.** It is not "unfinished", it is *empty* —
see [[new-user-onboarding-gap]]. Any "add a tour" answer is refused by locked call #1; the room to
move is inside the artifact and the empty states.

## 3. Which file renders which screen

| Screen | File |
|---|---|
| `/go` landing | `src/app/(offer)/go/page.tsx` + `src/components/offer/**`, `src/components/marketing/**` |
| `/signup` | `src/app/(onboarding)/signup/page.tsx` + `signup-form.tsx` |
| The centred card + logo chrome | `src/app/(onboarding)/layout.tsx` |
| Step 1, both doors | `src/components/onboarding/connect-step.tsx` |
| The step indicator + card shell | `src/app/(onboarding)/welcome/page.tsx` |
| The wait (spine, avatar row, covers) | `src/components/audience/calibration-flow.tsx` |
| The reveal | `src/components/audience/audience-reveal.tsx` |
| `/home` greeting | `src/components/app/home/home-greeting.tsx` |
| `/home` first-run intro (the one teaching sentence) | `src/components/app/home/home-audience-intro.tsx` |
| `/home` start grid + composer | `src/components/app/home/home-starter.tsx`, `composer.tsx` |
| The wall | `src/components/app/reading-limit-dialog.tsx` |

Design system SSOT is `src/app/globals.css` (`@theme`) + `docs/DESIGN-SYSTEM.md`. `BRAND-BIBLE.md`,
`docs/tokens.md`, `docs/components.md` describe the RETIRED Raycast system — do not trust them.

## 4. How to re-shoot the screens (the recipe that works)

**Capture each viewport in a context opened AT that size. Never resize a loaded page.** An earlier
pass produced "mobile" frames by resizing, and they did not match a real mobile load — components
that measure at mount kept their desktop state. The DOM said the first-run intro sat at y=714 of an
844px viewport while the screenshot showed no trace of it.

```js
// scratchpad/native.mjs — import the ABSOLUTE path into this worktree's node_modules
import { chromium } from "/Users/davideloreti/virtuna-slot-c/node_modules/playwright/index.mjs";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto("https://numenmachines.com/signup", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);                       // fills before hydration silently fail
await page.locator('input[name="email"]').pressSequentially(EMAIL, { delay: 10 });
// … password, confirmPassword, then:
await page.getByRole("button", { name: "Create account" }).click();
await page.waitForURL("**/welcome", { timeout: 90000 });
await page.locator('input[placeholder="@yourhandle"]').pressSequentially("mrbeast", { delay: 12 });
await page.getByRole("button", { name: "Continue" }).click();
await page.getByRole("button", { name: "Use this audience" }).waitFor({ timeout: 420000 });
await page.screenshot({ path: "…", animations: "disabled", caret: "hide" });
```

- **Sign up fresh; do NOT try to log in.** `/login` does not navigate on password submit in this
  build. `.local` email addresses work and confirmation is off.
- To reach a SIGNED-IN screen without the login form, mint the cookie: POST
  `{SUPABASE_URL}/auth/v1/token?grant_type=password` with the anon key, then set
  `sb-<project-ref>-auth-token` = `"base64-" + base64(JSON.stringify(session))`, split into
  `.0`/`.1` chunks above 3180 chars, on domain `numenmachines.com`. Verified working today.
- ⚠️ **Do not background the capture with `nohup … &` from a tool call** — the process is killed when
  the wrapper exits, mid-run, *after* it has already spent the Apify money.

## 5. Standing assets — use these before spending anything

**A calibrated production account already exists.** Signing in as it and visiting `/welcome` triggers
the adopt-an-interrupted-attempt path, which completes onboarding and forwards to `/home` — so
`/home` first-run screens cost **nothing**.

| Account | Password | State |
|---|---|---|
| `onboarding-review-20260804@virtuna.local` | `ReviewFlow!2026` | **Calibrated** (@mrbeast, 10 personas), onboarding complete |
| `onboarding-nat-d-20260804@virtuna.local` | `NativePass!2026` | Signed up, never calibrated — sits on step 1 |
| `onboarding-nat-m-20260804@virtuna.local` | `NativePass!2026` | Calibrated (@mrbeast), onboarding complete |

⚠️ **These are real production rows.** Delete when done:
`DELETE {SUPABASE_URL}/auth/v1/admin/users/{id}` with the service-role key, then
`truncate table funnel_events;` so the funnel's first real data is clean.

**Apify is at roughly $2.28 / $5.00, and the cycle resets 2026-08-20.** Each calibration is ~$0.05.
`onboarding-nat-d` is the free way to shoot step 1 without spending anything.

## 6. Traps — every one of these cost real time or real money today

- 🔴 **Resizing a loaded page does not give you the mobile UI.** §4. It silently produced a set of
  screenshots that would have misled the owner's review.
- 🔴 **A killed capture process still spends the Apify run.** The calibrate route does all its work
  and all its writes inside the SSE stream's `start()`; nothing cancels it, and `send` just swallows
  frames once the client is gone. A run killed at t=100s still wrote a complete 10-persona audience.
- 🔴 **`overflow-hidden` zeroes a flex item's automatic minimum size**, so one card in a bounded
  `flex flex-col max-h-[…]` column absorbs the whole overage and clips ITSELF. This produced a
  profile card sliced in half that read exactly like a scroll bug — `scrollTop` was 0 every time.
  Three guesses died on that assumption. `scrollHeight - offsetHeight` over every child names it in
  one pass. → [[overflow-hidden-shrinks-a-flex-item]]
- 🔴 **No unit test can see a layout squash.** happy-dom/jsdom have no layout engine, so
  `offsetHeight` is 0 and every DOM assertion passes. The real gate is a browser measurement.
- 🔴 **`scrollWidth === clientWidth` does NOT mean "no overflow"** — an ancestor can CLIP rather than
  scroll. Measure the ELEMENT's rect against the viewport.
- ⚠️ **A green Vercel check on a PR is not a build.** Run `tsc` yourself; vitest does not typecheck.
- ⚠️ **The suite prints 3 unhandled `ECONNREFUSED :3000` errors** in this worktree, from a test that
  expects a dev server on port 3000. Pre-existing noise, zero test failures. Do not chase it.
- ⚠️ **A co-session pushed this lane's branch underneath me today.** Before force-pushing anything,
  `git cherry -v HEAD origin/<branch>` — all `-` means your side already contains theirs.

## 7. Suggested order for the next session

1. **Take the owner's feedback against the review page's eight steps and six observations.** Do not
   start building until it is clear which of the six are real work.
2. **#2 (the dangling "Good afternoon,") is a straight bug** — fix it whatever else is decided.
3. Anything that changes copy must respect **#3, #4 and #5**: no promised duration, no "as they are
   read", no "the engine is thinking".
4. Re-shoot the screens with §4 after each change and republish the review page — the artifact URL in
   §0 updates in place when the same file path is republished.
5. The KEEP half beyond the first session — the second-session hook and lifecycle mail — still has
   **no artifacts at all**, and there are still **zero customers**, so every retention number remains
   unmeasurable.
