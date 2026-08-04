# HANDOFF — onboarding activation: what got built, what is still open

**Branch:** `task/onboarding-activation` @ **`05201486`** · 9 commits · **UNPUSHED, UNMERGED**
**Base:** rebased onto `origin/main` @ `b5f99214` — **0 behind** at time of writing (main moved 13 commits mid-session; the qwen-flash lane #426 landed in them)
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
| The profile-card clip | **FIXED** (`05201486`) — it was flex shrink, not scroll; see §4 |
| **Open** | **nothing blocking — §5's list only, and §5's cover claim is now settled** |

**Gates at `05201486`:** tsc clean · **472 files / 5251 tests / 0 failures** (post-rebase onto `b5f99214`) · `npm run build` exit 0
· verified live on a production build against a real signup + real scrape.
Baseline before the lane was 459 / 5071 / 0.

⚠️ The suite prints **3 unhandled errors** here — all `ECONNREFUSED :3000`, from a test expecting a
dev server on port 3000. Pre-existing environment noise in this worktree, zero test failures.

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

## 4. ✅ CLOSED 2026-08-04 — the profile-card clip (`05201486`)

**It was flex shrink, not scrolling.** The suspect recorded here — the bounded scroll container
being scrolled ~22px at render — was **wrong**: `scrollTop` measured **0** on every run, at both
sizes, before and after. The container is innocent.

What the measurement actually showed, on a live @garyvee calibration:

| child of the bounded column | `overflow` | `min-height:auto` resolves to | height lost |
|---|---|---|---|
| `✓ We read @garyvee` | visible | content | 0 |
| **profile card (`READING_CARD`)** | **hidden** | **0** | **22px @1512 · 27px @390** |
| personas / posts / tags / provenance | visible | content | 0 |

A flex item's automatic minimum size resolves to its CONTENT height — which is what protected the
column's five other children — but the spec zeroes that minimum for any item whose `overflow` is not
`visible`. `READING_CARD` leads with `overflow-hidden` and is the only such child, so when the
column's content (1484px) exceeded its `max-h` (722px) this card was the single item the algorithm
could shrink, and it absorbed the whole overage alone: 56→34px at 1512, 61→34px at 390. Its own
`overflow-hidden` then clipped the 48px avatar and the name line — the visible slice.

**Fix:** `shrink-0` on that card. Verified on a production build against a real signup + real scrape
(@mrbeast, a heavier account than the one the defect was found on): card **96px @1512 / 112px @390**,
**0** clipped cards, avatar fully inside, CTA unmoved at 939.5/982 and 801.5/844, 0 console errors.

⚠️ **Any future `READING_CARD` added as a DIRECT child of that column inherits this trap.** The
persona rows and post grid are safe only because they sit inside `overflow: visible` wrappers.
`reveal-profile-card.test.tsx` guards the class — it cannot guard the geometry, because happy-dom has
no layout engine and `offsetHeight` is 0 there. The real gate is a browser measurement.

🔑 **The reusable lesson:** a "clipped at the top" symptom reads like a scroll-position bug and is
not one. Two guesses died on that assumption. `scrollHeight - offsetHeight` over every child of the
suspect container names the culprit in one pass:

```js
const sc = document.querySelector('.overflow-y-auto');
[...sc.children].map(el => ({ cls: el.className.slice(0,40), lost: el.scrollHeight - el.offsetHeight,
  minH: getComputedStyle(el).minHeight, ovf: getComputedStyle(el).overflowY }));
```

## 5. Also open, none blocking

- **Personas cannot "assemble one by one" from the engine.** They come back in ONE model response.
  What shipped is a staggered client-side ENTRANCE (`reading-reveal`, 0.05s steps). Honest, but do not
  let anyone believe the engine streams them.
- **Covers all land in one poll — RE-MEASURED 2026-08-04 on a bigger account, claim NOT supported.**
  @mrbeast (131.2M followers) behaved exactly like @garyvee: the cover count went **0 → 12 with images
  in a single poll at t=9s**, and stayed 12 until the reveal at t=155s. Polled every 1.5s, so a trickle
  would have been visible. The dataset polling is real and it is what puts the account on screen early
  (t=9s here, earlier than the recorded t=24s) — but **this actor writes its items as a batch**, so
  "covers appear as they are read" is a framing the evidence does not support. Do not ship that copy.
  `runWithPartials` still earns its place: it is what makes the account appear at t=9s instead of ~78s.
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

### Second pass, 2026-08-04 — the §4 fix, two more live runs

```
calibration (@garyvee)                 209s       ← NOT 132–135s; the wait is not stable
calibration (@mrbeast)                 155s
  · account on screen                  t=9s       (dataset poll; earlier than the recorded t=24s)
  · 12 covers, with images             t=9s, in ONE poll — batch, not a trickle (see §5)
profile card @1512                     96px, 0px lost, avatar inside   (was 34px, 22px lost)
profile card @390                      112px, 0px lost, avatar inside  (was 34px, 27px lost)
clipped cards in the column            0, both sizes                   (was 1, both sizes)
reveal CTA @1512 / @390                bottom 939.5/982 · 801.5/844    (unmoved by the fix)
console errors                         0
Apify                                  2 runs spent here; ~$2.38 / $5.00 left
```

⚠️ **The ~135s wait figure is not reliable** — the same handle took **209s** on this pass. Anything
that quotes a duration to the user (or any test that asserts one) has to tolerate ~3.5 minutes.

## 10. Next session — suggested order

1. ~~Close §4~~ — **DONE** (`05201486`), measured not guessed; see §4 for the real cause.
2. ~~Re-measure §5's cover-streaming claim~~ — **DONE**, on a bigger account. It is a batch. Do not
   ship "covers appear as they are read".
3. **Decide push/merge.** ⚠️ **Merging IS deploying** — re-read the banner at the top of this file
   and re-measure `origin/main` before acting; it moves constantly.
4. Then, if the owner wants to keep going on activation: the second-session hook and lifecycle mail are
   still entirely unbuilt — the KEEP half beyond the first session has no artifacts at all.

**One cosmetic defect found while verifying, NOT fixed (out of scope, owner's call):**
`compactNumber` in `audience-reveal.tsx` has no billions branch, so @mrbeast's like count renders as
**"1300.0M likes"** on the reveal. Three lines to fix; it only bites accounts over 1B.
