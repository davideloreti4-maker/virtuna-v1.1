# HANDOFF — a real onboarding experience, landing page → arriving in the app

> ⚠️ **THIS IS THE KICKOFF BRIEF, AND IT HAS BEEN ANSWERED.** The lane was built on 2026-08-04 —
> see **`docs/HANDOFF-2026-08-04-onboarding-activation-SHIPPED.md`** for what exists now, the one
> defect still open, and the traps that cost real time.
>
> Specifically stale below: **§5's five questions are all answered** (owner calls taken; do not
> re-ask them). **§2's "structural question nobody has answered"** is answered — the two funnels
> already converge on `/home`, and `claim-account.ts` stamps a funnel-B payer as onboarded with no
> audience rather than trapping them in calibration. **§7's six UI defects** are fixed except the
> profile-card clip, which is now tracked as §4 of the SHIPPED doc. The framing in §1, §4, §8, §9
> and §11 all still stands and is still worth reading.

**Branch to cut:** `task/onboarding-activation` off `origin/main` · **Worktree:** a free slot · **Port:** 3003
**Owner ask (verbatim, 2026-08-04):** *"the one line sentence is bad. im talking about a real
onboarding flow and experience for new users from landing page to arriving in the new app. … we
want a real onboarding flow like billion dollar companies would release. we need to convert and
keep customers"*

⚠️ **Merging to `main` IS deploying.** Production builds ~3s after the merge and there are no
preview URLs — branch deployments are CANCELED by `ignoreCommand`. Verify BEFORE you merge.

---

## 0. State in one screen

| | |
|---|---|
| Acquisition funnel | **designed in detail, owner calls LOCKED** — `docs/ONBOARDING-FUNNEL-DESIGN.md` (§1 of it is stale, see §2 here) |
| Setup step | **built and working** — `/welcome` = connect + calibrate, repaired today by PR #423 |
| **Activation / teaching** | **DOES NOT EXIST.** One sentence, app-wide. This is the lane. |
| Retention loop | nothing — no empty states that teach, no second-session hook, no lifecycle mail |
| Surfaces | `/` (marketing) · `/go` (offer) · `/signup` · `/welcome` · `/home` |

**The one-line version of the problem:** the product spends ~2 minutes and real money building the
user an audience, then says one sentence about it and drops them in front of a blank composer with
six unexplained verbs and three unexplained nav items.

## 1. Prior art — read this BEFORE designing anything

`docs/ONBOARDING-FUNNEL-DESIGN.md` (30KB) is a **design contract with owner calls already locked**
across three sessions. Do NOT re-litigate what is in it. The locked calls that constrain this lane:

- **§0a① Payment first, account after** — identity moves BEHIND the money. $1 before any personal run.
- **§0a② The wall** — reveal beat 1 in full, lock beat 2. The teaser paywall is load-bearing.
- **§0a③ Trial stays at 3 days.**
- **§0b① The demo IS the real product, run anonymously** — not a walkthrough of it. This is the
  single most important line in the document for this lane: *the owner has already rejected
  "show them a tour" once.* Whatever gets built must be the product doing real work, not a
  narrated overlay on top of it.
- **§0b④ Entry is upload or link — NOT @handle.**
- **§2a Traffic is organic social**, so the funnel runs inside in-app webviews. Mobile-first is the
  default, not the adaptation. §2a also carries a 🔴 BLOCKER about webviews breaking both identity
  paths — check whether that is still true before building around it.
- **§5 Banned** — a list of known conversion leaks. Read it; several obvious "onboarding" ideas are
  already on it.
- **§8** already specifies activation + instrumentation. Start there rather than inventing metrics.

Also relevant: `docs/HANDOFF-2026-08-02-new-user-onboarding.md` (the setup half, as built).

## 2. ⚠️ The design contract's §1 is STALE — here is the traced state as of `8896bac7`

`ONBOARDING-FUNNEL-DESIGN.md §1` is traced at `main@99c494d1` and now describes a product that no
longer exists. Four of its nine rows are dead. **Re-trace before quoting it.** What is true today,
measured live on numenmachines.com 2026-08-04:

### There are TWO entry funnels, and only one passes through onboarding

```
A  /  (marketing)  →  /signup  →  /welcome  (connect + calibrate, ~110-176s)  →  /home
B  /go (offer)     →  /home?v=Test  (ANONYMOUS, no account)  →  paywall  →  $1 trial  →  ???
```

| Fact | Evidence |
|---|---|
| The marketing root and the offer page are different pages with different CTAs | `src/app/(marketing)/page.tsx` vs `src/app/(offer)/go/page.tsx` |
| Every marketing CTA goes to a bare signup | 8 occurrences of `/signup` under `src/components/marketing/` |
| The offer CTA goes to an anonymous free Test | `cta-config.tsx:38` → `href: "/home?v=Test"`, label "Test a video free" |
| Anonymous visitors are EXEMPT from the onboarding gate — by design | `src/lib/supabase/middleware.ts:173` (`!user.is_anonymous`) |
| Un-onboarded *identified* users are force-routed to `/welcome` | same line |
| Signup no longer dead-ends on a confirm email — **fixed today** | `signup/actions.ts`, PR #423 |
| `/welcome` is TWO real steps and ends in a calibrated audience | `welcome/page.tsx`, `CalibrationFlow` |
| The moat (`/api/audiences/calibrate`) IS in the funnel now | measured: 110s and 176s, two live runs |

🔴 **The open structural question nobody has answered:** what happens to a funnel-B visitor who
pays the $1 and becomes a real user? The moment they stop being anonymous, `middleware.ts:173`
starts applying — so they get bounced into a ~2-minute blocking calibration *after* they have
already used the product and paid. That ordering has never been walked end to end. **Walk it first.**

## 3. What "onboarding" consists of today, in full

Not a summary — this is the complete inventory. Verified by grep over `src/` at `8896bac7`:

1. **`/welcome`** — "Connect your TikTok. We'll read your account once to build the audience your
   ideas get tested against." Then 110–176s of blocking calibration. This is *configuration*. It
   teaches exactly one concept.
2. **One sentence on `/home`** — `HomeAudienceIntro`: *"10 people, built from @garyvee. Every card
   you make is written for one of them."* + ONE action + Dismiss. Its own source comment calls it
   "the only place the product says out loud what this is for." That is accurate, and it is what
   the owner has now rejected.
3. **Six labels** — Ideas / Hooks / Script / Remix / Video test / Explore, one line each.

**And that is everything.** There is no fourth item.

- **ZERO** coachmarks, tours, walkthroughs, checklists, progress meters, empty-state teaching, or
  help affordances anywhere under `src/app/(app)`.
- ⚠️ `HomeFirstRunDemo` is **GONE** — older notes say it exists behind `HORIZONTAL_ENABLED`. It is
  not in `src/` at all any more. Do not go looking for it.
- `src/components/offer/walkthrough/*` is real, good, and imported by **nothing** under `(app)`.
  It lives only on `/go`. **This is the most reusable asset in the repo for this lane.**
- The sidebar `?` is the **avatar fallback initials** for an account with no name
  (`Sidebar.tsx:728`), not a help button. Do not cite it as one.
- **Discover, Library and Audience — three of the four sidebar items — are never introduced.**

## 4. The problem to solve, stated honestly

Two different jobs are being conflated, and they need different machinery:

- **CONVERT** — a cold visitor from organic social decides this is worth $1. That is the
  acquisition funnel, and it is already designed (§1 here). Mostly a build-and-measure problem.
- **KEEP** — a paying user reaches their second and fifth session. Nothing in the product does
  this today. **This is the actual gap and it is where the owner's ask lands.**

The retention half has no artifacts at all: no activation definition, no aha-moment instrumentation,
no second-session hook, no lifecycle email, no empty states that teach, no "what now" after the
first card renders.

⚠️ **The trap this lane will fall into if nobody says it out loud:** the obvious answer is a product
tour, and the owner has ALREADY rejected that framing twice — once in `ONBOARDING-FUNNEL-DESIGN.md
§0b①` ("the demo IS the real product, not a walkthrough of it") and once on 2026-08-02 by stopping a
sketch loop. A tour is also the thing every one of those "billion dollar companies" has been
quietly deleting for a decade. The bar the owner set is Linear / Superhuman / Attio, and what those
products actually do is: **the first session produces one real, personal, shareable artifact, and
the interface teaches itself through the empty states around it.** Design toward that, not toward
a coachmark library.

## 5. Questions only the owner can answer — ask these FIRST

Do not start building until these are settled; every one of them changes the shape of the work.

1. **What is the aha moment?** The single thing a new user must see for the product to have
   landed. Candidate: their first card rendered against their own calibrated audience. If it is
   that, everything else is scaffolding toward it and time-to-that-moment is the metric.
2. **Does funnel B (the anonymous /go demo) converge with funnel A, or stay separate?** Two
   onboardings is a maintenance and consistency tax; one is a redesign of both.
3. **Where does the ~2-minute calibration sit relative to the money?** Before the $1 is a long
   blocking wait from a stranger. After the $1 it is a wait from a customer. Both are defensible;
   the choice is the owner's and it moves everything.
4. **Is the teaching allowed to cost an engine run?** A first-session card that is genuinely about
   the user's own account costs money per new signup ([[apify-free-plan-hard-limit]]).
5. **What does "keep" mean numerically?** D1/D7 return, or first-card-created, or trial→paid.
   §8 of the design contract has a starting position — confirm or replace it.

## 6. Measured facts (2026-08-04, live, production build + numenmachines.com)

```
signup → /welcome                       5.0s
calibration, @garyvee, two runs         110.6s and 176.2s   (docs say ~128s — the range is wider)
  · "Reading your followers" alone      94s of that, and the FIRST real material (avatar,
                                        follower count) does not appear until t≈94s
"Use this audience" → /home             9.1s
Apify cost per calibration              ~$0.05   ($2.05 of $5.00 used, cycle resets 2026-08-20)
console errors, every screen            0
horizontal overflow at 390              none
```

## 7. UI defects found in the audit — open, none of them fixed

Fixing these is NOT the lane, but they are on the path and cheap:

1. **"Use this audience" is below the fold at 1512×982.** The terminal action of onboarding needs
   a scroll on a flat dark page with no scroll affordance. An automated run sat on that screen 272s
   without reaching it. **Highest-value single fix in this document.**
2. **Topic chips render raw slugs** — `financial_discipline`, `anti_consumerism`, `ego_death`,
   `judgment_free_zone`. `humanizeSlug()` already exists (`teardown-detail.tsx`).
3. **The progress caption oscillates instead of advancing** — during the 94s step it alternated
   "Pulling the account and its posts" ↔ "Reading who actually engages" at t=11/23/35/47/59/71/83s.
   Reads as looping, not progressing.
4. **The longest stretch of the wait has the least to look at** — see §6. This is exactly what the
   evidence-spine work (PR #411) exists to prevent; that machinery is on `main` and unused here.
5. **The composer dock clips the starter card** on `/home` — "Test something of your own" sits
   half-behind it at 1512×982.
6. **No exit during a 2–3 minute blocking wait.** Reload-recovery works correctly now, but nothing
   on screen says so.

## 8. Constraints that are not style choices

- **A ~2-minute blocking wait is the shape of the product**, not a bug to optimise away. The owner
  chose inline+blocking on 2026-08-02 over deferring, because deferring buys instant entry and a
  product whose every card reads "Not tested yet."
- **NO path through calibration is free.** Described door = 1 Apify call; handle door = 1, or **2
  when `isThin` fires** — and `isThin` describes a brand-new creator exactly, so for real
  onboarding the two-call path is the COMMON one. Budget against [[apify-free-plan-hard-limit]].
- **`BILLING_ENFORCE_QUOTA` is `true` in prod** and free tier is `limit:0 + enforced:true`. Any
  "try this next" you offer a free user is refused unless it is explicitly demo-entitled.
- **Never widen `!user.is_anonymous` in `middleware.ts:173`** — anonymous users have no
  `creator_profiles` row, so without the exemption every demo visitor loops on `/welcome` forever.
- **Never persist the `calibrate` stage to `onboarding_step`** — it re-fires a metered scrape on
  reload.
- **`personas.length` is a CALIBRATION test, never an OWNERSHIP test.** `/api/audiences` composes
  DB rows with five virtual constants; any predicate over its output needs `SENTINEL_IDS` too.
  This exact confusion made onboarding unreachable for every user until today (PR #423).

## 9. Traps that will cost you time

- **`npm test` is fake here** — use `node ./node_modules/vitest/vitest.mjs run`. Never pipe it into
  `tail`: a pipeline returns TAIL's exit code, always 0.
- **A non-zero vitest exit with 0 failures is expected** — 3 pre-existing unhandled rejections in
  `composer.test.tsx`. Judge by the FAILURE COUNT. Baseline at `8896bac7`: 459 files / 5071 tests /
  0 failures / 3 errors.
- **`npm run lint` emits ~1MB of JSON.** Lint what you touched:
  `node node_modules/eslint/bin/eslint.js <paths>`.
- **A green Vercel check on a PR is NOT a build** — `ignoreCommand` skips it and posts success.
  Run `npm run build` yourself; vitest does not typecheck.
- **Playwright fills before hydration silently fail on prod.** A remote signup form validated
  "Passwords do not match" because React never saw the fills. `waitForTimeout(5000)` after
  `domcontentloaded`, then `pressSequentially`. Cost 20 minutes today.
- **A scratchpad ESM script cannot `import 'playwright'`** — Node resolves from the SCRIPT's
  directory. Import the absolute path into the worktree's `node_modules`.
- **Verify on a PRODUCTION build.** Dev StrictMode double-invokes effects and fakes broken funnels.
- **Read refs with `git rev-parse`, never `git log --oneline`** — it elides merges here.

## 10. Verification recipe

The funnel cannot be audited from the code. **Sign up as a new user and walk it.** Every one of the
three defects in PR #423 was invisible to review and obvious within 30 seconds of a real signup.

```
npm run build && node node_modules/next/dist/bin/next start --port 3003
```

Then drive it with Playwright at 1512 and 390. Signup needs only email + password + confirm
(`.local` addresses work — confirmation is off). ⚠️ dev and prod share one Supabase project, so
**every account you create is a real production row.** Name them `onboarding-<purpose>-<date>` and
delete them via the admin API when done — `DELETE {SUPABASE_URL}/auth/v1/admin/users/{id}` with the
service-role key. Check state directly in `creator_profiles`, `audiences` and `user_settings`
rather than trusting the screen.

Credentials for the existing E2E account are in the `e2e-auth-state-is-dead` memory, NOT in
`.env.local` (slot-c has no `E2E_USER_*`).

## 11. Do NOT

- Build a coachmark tour. See §4 — rejected twice, and it is not what the reference products do.
- Re-litigate the locked owner calls in `ONBOARDING-FUNNEL-DESIGN.md §0a/§0b`.
- Quote that document's §1 without re-tracing it — four of its nine rows are dead (§2 here).
- Defer calibration to make onboarding feel faster. That decision was made against, deliberately.
- Add a second `/welcome` for funnel B before answering §5.2.
- Ship a "Skip for now" back into `/welcome`. Both doors must end in a calibrated audience.
- Sketch it first. The owner stopped a sketch loop on an adjacent surface on 2026-08-02: *"we
  wasted to much time on sketching. lets just rework the current render on the live."*

## 12. Kickoff

1. Read `docs/ONBOARDING-FUNNEL-DESIGN.md` §0a, §0b, §5, §8 — the locked calls and the banned list.
2. Read §2–§5 here. Re-trace anything you intend to quote.
3. **Sign up on a production build and walk both funnels end to end**, including the funnel-B
   convergence in §2 that nobody has walked. Screenshot every screen at 1512 and 390.
4. Put §5's five questions to the owner with your recommendation on each — do not start building
   until they are answered.
5. Then build in `src/`, run the gates, and show the real surface.

```
cd ~/virtuna-slot-<free>   # git worktree list; pick one that is idle
git switch -c task/onboarding-activation origin/main
```
