# HANDOFF — onboarding activation: what got built, what is still open

**Branch:** `task/onboarding-activation` @ **`e65bb570`** · 6 commits · **UNPUSHED, UNMERGED**
**Base:** rebased onto `origin/main` @ `558df8f5` — **0 behind** at time of writing
**Worktree:** `~/virtuna-slot-c` · **Port 3003**
**Supersedes:** `docs/HANDOFF-2026-08-04-onboarding-activation.md` (the kickoff brief — its §2 and §5
questions are ANSWERED below; do not re-ask them)

⚠️ **Merging to `main` IS deploying.** Prod builds ~3s after the merge, there are no preview URLs.
⚠️ **A co-session has merged pushes within seconds.** Run the gates before the PUSH, not before the merge.

---

## 0. State in one screen

| | |
|---|---|
| Funnel instrumentation | **BUILT** — `funnel_events` table live on prod, sink wired, verified recording |
| Activation entitlement | **BUILT** — one free card per calibrated creator, verified 200 then 402 |
| The wall | **BUILT** — personalised, quotes their own audience |
| Calibration reliability | **FIXED** — a defect that failed 2 of 5 live runs |
| The craft pass | **BUILT** — wait shows the account 54s earlier; reveal leads with the people |
| Marketing CTAs → `/go` | **DONE** |
| **Open** | **one visual defect (§4), plus §5's list** |

**Gates at `e65bb570`:** tsc clean · **469 files / 5184 tests / 0 failures** · `npm run build` exit 0.
Baseline before the lane was 459 / 5071 / 0.

---

## 1. The owner calls taken this session — LOCKED, do not re-litigate

1. **Fund the first card with an ENTITLEMENT, not a credit grant.** One free `ideas` pack.
2. **Wire the analytics sink FIRST**, before building the experience.
3. **Point all marketing CTAs at `/go`**; `/signup` stays reachable but unpromoted.
4. **The onboarding is the first run** — not a demo, not info screens, not a walkthrough. The teaching
   lives in the artifact and the empty states. (Consistent with the two prior rejections of a tour.)
5. **Full craft pass across all three surfaces**, and **the wait shows the real material as it lands.**

## 2. The five §5 questions, ANSWERED

1. **Aha moment** — the first card rendered against their own calibrated audience. The audience reveal
   is beat 1 (free, already existed, ~135s); the card is beat 2. Metric is time-to-first-card.
2. **Does funnel B converge with funnel A?** They ALREADY converge — `/go`'s entry is
   `<a href="/home?v=Test">`, the param is stripped, and both funnels land on the identical `/home`
   shell. The only difference is whether an `audiences` row exists.
3. **Where does calibration sit relative to the money?** Not open. §0a already locks post-payment +
   parallel for funnel B, and funnel A has no money in it until the wall. The wait was never in the
   wrong place — it just bought the user nothing they could act on.
4. **May teaching cost an engine run?** Yes, once, as an entitlement. `ideas` = 1 model call, **0
   Apify**. The CTA it replaced (`account`) was 2 Apify scrapes at 5 credits.
5. **What does "keep" mean numerically?** Unanswerable until there is traffic — see §3's "no customers".
   §8's definition stands: a sealed test against a calibrated audience in the first session.

## 3. Facts that reframe the whole lane

- **There are no customers.** 47 `auth.users` rows: 8 real (all dev/owner/E2E) and 39 anonymous, nearly
  all from the 2026-07-26→28 build window. **Zero funnel-B claims have ever happened.** Every retention
  number is unmeasurable until real traffic arrives — which is why the sink went first.
- **`checkout_paid` had never been emitted, once, ever.** The §8 spine existed but buffered in memory
  with no sink, and its only call sites were in `components/offer/walkthrough/` — which §0b RETIRED.

## 4. 🔴 THE ONE OPEN DEFECT — start here

**The reveal's profile card is clipped at the top.** "GaryVee ✓" is sliced through horizontally.
Reproduces at BOTH 1512×982 and 390×844, in every screenshot taken after the reveal was restructured.

- **It is real** — not a Playwright `animations:"disabled"` artifact. `READING_CARD` carries no
  entrance animation and `reading-reveal` only translates 6px, nowhere near enough.
- **It was NOT diagnosed.** Two guesses were made and both were wrong; a third guess is not worth
  making. It needs a live DOM measurement.
- **The suspect** is the bounded scroll container added to `audience-reveal.tsx`
  (`max-h-[calc(100vh-260px)] overflow-y-auto`) being scrolled by ~22px at render.

**How to close it, cheaply:** you need a calibrated account sitting ON the reveal, which normally costs
an Apify run. Measure, don't guess:

```js
const box = document.querySelector('[data-testid="calibration-evidence"]')?.parentElement;
// the scroll container is the reveal's first child div
const sc = document.querySelector('.overflow-y-auto');
console.log({ scrollTop: sc?.scrollTop, clientH: sc?.clientHeight, scrollH: sc?.scrollHeight });
```
If `scrollTop > 0`, the container is scrolled and the fix is to pin it to 0 on mount. If it is 0, the
clip is a box-model problem in the profile card itself and the scroll container is innocent.

## 5. Also open, none blocking

- **Personas cannot "assemble one by one" from the engine.** They come back in ONE model response.
  What shipped is a staggered client-side ENTRANCE (`reading-reveal`, 0.05s steps). Honest, but do not
  let anyone believe the engine streams them.
- **Covers all landed in one poll** (12 at t=24s). The dataset polling works, but this actor appears to
  write its items in a batch rather than trickling. Worth re-measuring on a slower/bigger account before
  claiming "they appear as they are read".
- **`/login` does not navigate on password submit** in this build. Cost ~20 minutes; the workaround is
  to sign up fresh rather than log in. Unrelated to this lane, but it will bite the next verification.
- **Four scrape waits are still blind** (the pre-existing `scrape-waits-are-blind` item) — the
  `runWithPartials` helper added here is directly reusable for them.
- **The two `/go` funnel events beyond `demo_view`** (`demo_pick`, `demo_scrub`, `demo_fix_open`) still
  have no call sites on the live surfaces; they only ever existed on the retired walkthrough.

## 6. What was built, by commit

| sha | what |
|---|---|
| `6e47044f` | **The sink.** `funnel_events` table + `POST /api/funnel` + sendBeacon sink in the ROOT layout. Plus the double-mint race fix. |
| `32ea2d49` | **The wait's honesty.** Monotonic sub-copy, per-stage cadence, humanized slugs, CTA above the fold. |
| `286c05d0` | **The activation entitlement + the personalised wall + marketing → `/go`.** |
| `a69720fe` | **Calibration reliability** — renormalise instead of rejecting; `synthesis_failed` split from `scrape_failed`. |
| `e65bb570` | **The craft pass** — progressive scrape evidence, reveal leads with the people, dock/overflow fixes. |

### The pieces worth knowing about

- **`lib/analytics/funnel-sink.ts` + `components/analytics/funnel-provider.tsx`** — root-layout mounted,
  because the funnel starts on `/go` and `/`, which never mount the app providers.
- **`funnel_events.user_id` is nullable + `ON DELETE SET NULL`.** Deliberate: `demo_view` fires before a
  session exists, and `cron/reap-anonymous` deletes anonymous users — under CASCADE the funnel would
  erase its own history and report a conversion rate over survivors only. The journey stitches on a
  client-minted `session_id`, verified to bridge the anonymous→identified transition.
- **`ACTIVATION_ACTION` / `ACTIVATION_RUNS` in `lib/pricing.ts`**, decided in `lib/billing/quota.ts`.
  Keyed on HAVING CALIBRATED + free tier + no trial. **Never** on `is_anonymous` (the demo's key) and
  **never** on tier `free` alone (every user is free — the #423 confusion).
- **`lib/scraping/apify-provider.ts` → `runWithPartials`.** Starts the actor instead of calling it and
  reads the dataset as it fills. Opt-in; all other callers keep the byte-identical `.call()` path.
- **`lib/audience/normalize-shares.ts`** — repairs a near-miss distribution rather than binning a
  completed run.

## 7. Traps found the hard way — these cost real time

- 🔴 **`scrollWidth === clientWidth` does NOT mean "no horizontal overflow".** An ancestor can CLIP
  rather than scroll, so the document never widens while content is severed. A probe using it passed
  green while the 390px reveal was cut off at both edges. **Measure the ELEMENT's `getBoundingClientRect`
  against the viewport, not the document's scroll width.**
- 🔴 **`position: sticky` does nothing inside `flex … items-center justify-center`.** The onboarding
  layout centres its card, so the card's height equals its content and sticky has zero range to move in.
  The first attempt at the below-fold CTA used sticky and changed nothing (y=989 → y=978).
- 🔴 **An effect that depends on `[mounted, seen]` never fires for FETCHED data.** The first-run intro's
  scroll-into-view ran once against a null ref, because the audience arrives after mount and the deps
  never changed again. Re-measured after that "fix": still y=998, unchanged.
- 🔴 **"Calibration failed. Check the handle" can mean the handle is fine.** Apify SUCCEEDED on both
  failed runs; our own schema rejected our own model. Check the Apify RUN STATUS before believing the
  UI. (Sibling of the recorded "a cap-out is disguised as check-your-handle" trap.)
- ⚠️ **Killing a prod server while `npm run build` deletes `.next` gives 500s that look like your code.**
  Kill the server FIRST, then rebuild.
- ⚠️ **`git diff --stat origin/main..HEAD` (two-dot) reported 220 files / 15k deletions** for a 46-file
  branch, because main had moved 54 commits. Use three-dot.

## 8. Verification recipe that works

```bash
cd ~/virtuna-slot-c
lsof -ti:3003 | xargs kill -9      # BEFORE rebuilding
rm -rf .next && npm run build
nohup node node_modules/next/dist/bin/next start --port 3003 > /tmp/s.log 2>&1 &
```

- **Sign up fresh; do not try to log in** (§5). `.local` addresses work, confirmation is off.
- Playwright: `waitForTimeout(5000)` after `domcontentloaded`, then `pressSequentially` — fills before
  hydration silently fail on a prod build.
- Screenshots: `animations:"disabled"`, `caret:"hide"`.
- A scratchpad ESM script must import the ABSOLUTE path into this worktree's `node_modules`.
- ⚠️ **Every account is a real production row.** Name them `onboarding-<purpose>-<date>` and delete via
  `DELETE {SUPABASE_URL}/auth/v1/admin/users/{id}` with the service-role key. Truncate `funnel_events`
  after testing so the table's first real data is clean.

**Local env note:** this worktree's `.env.local` carries `NEXT_PUBLIC_AMBIENT_V2=true` and
`BILLING_ENFORCE_QUOTA=true`, added to match production. Without them you are auditing a different app
than the one users get. Backup of the original is in the session scratchpad.

## 9. Measured, live, production build

```
signup → /welcome                      5.1s
calibration (@garyvee)                 132–135s
  · account on screen                  t=24s      (was ~78s — 54s earlier, same Apify spend)
  · 12 covers                          t=24s
  · sub-copy                           monotonic across 5 phrases, no oscillation
reveal CTA @1512                       y=896 bottom=940 / 982     (was y=989, below fold)
reveal CTA @390                        y=758 bottom=802 / 844
first-run intro @390                   y=737 bottom=844 / 844     (was y=998, off screen)
starter card vs dock                   ends 528, dock starts 681  (was sliced)
first card                             /api/tools/ideas → 200
second card                            → 402, reason "allowance"  (entitlement depletes)
console errors, every screen           0
Apify                                  $2.48 / $5.00, cycle resets 2026-08-20
```

## 10. Next session — suggested order

1. **Close §4** (the profile-card clip). One measurement, then a real fix.
2. **Decide push/merge.** The branch is 6 commits, rebased, gates green, unpushed.
3. **Re-measure §5's cover-streaming claim** on a slower account before trusting the "as they are read"
   framing.
4. Then, if the owner wants to keep going on activation: the second-session hook and lifecycle mail are
   still entirely unbuilt — the KEEP half beyond the first session has no artifacts at all.
