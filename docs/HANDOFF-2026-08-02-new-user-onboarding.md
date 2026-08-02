# HANDOFF — New-user onboarding: the product a fresh account actually meets

**Branch:** `lane/new-user-onboarding` · **Worktree:** `~/virtuna-slot-a` · **Dev port:** 3001
**Base:** `origin/main` @ `a7ff97f6` · **Status:** survey only, zero code written. This doc IS the lane.
**Owner ask (verbatim):** *"adding a good onboarding for new users to the platform … we want to
properly onboard new users."*
⚠️ **Merging to `main` IS deploying** (no preview URLs, prod builds ~2 min after merge). Verify first.

---

## 0. Read this first — the survey found something that changes the brief

**Do not start by designing a tour or a checklist.** The post-signup onboarding is not thin, it is
*disconnected*: it collects one fact and throws it away, and the thing it fails to set up is the
one the whole product is built on.

Everything in §1 was read out of the code on 2026-08-02, with line numbers. Verify before building
on it anyway — this repo's own standing lesson is that a backlog item can be resolved in the
opposite direction and still read as open (see `e2e-audit-lane`, F-014).

**One decision must be settled with the owner before any build — §3.** It changes the whole shape.

## 1. What exists today (verified)

### 1.1 The whole post-signup onboarding is one text field

`src/app/(onboarding)/welcome/page.tsx` — `STEPS = ["connect"]`, a single step.
`src/components/onboarding/connect-step.tsx` — one `InputField` ("TikTok Handle"), a **Continue**
button, and a **"Skip for now"** link. That is the entirety of it.

`src/stores/onboarding-store.ts:97` `completeOnboarding()` writes `onboarding_step: "completed"`,
`onboarding_completed_at`, and `tiktok_handle`. `:109` `skipOnboarding()` writes the same completion
stamp and **no handle**.

### 1.2 The handle it collects is inert

`grep tiktok_handle` across `src/` returns exactly two kinds of reader:

- the `/competitors/*` pages (`competitors/[handle]/page.tsx:97`, `compare/page.tsx:137`)
- `welcome/page.tsx:89`, rehydrating its own form

It does **not**:

- create a `connected_accounts` row — that is a separate route, `POST /api/connected-accounts/connect`,
  which scrapes the profile and seeds `account_snapshots`
- calibrate an audience — that is `POST /api/audiences/calibrate` (SSE)
- trigger an account read, or influence `/home` in any way

So a brand-new user finishes onboarding with **no connected account and no calibrated audience.**

### 1.3 Why that is the real problem

The product is audience-relative. The skill cards that just shipped (`06f2b210`) render an audience
band whose honest states are, in order: a measured room fraction → a bound persona plus their real
share (`Made for Time Poor Creator · 34% of your audience`) → and, when nothing is calibrated,
**`Not tested yet`**.

A new user has nothing calibrated. So every card they generate shows the fallback, the simulation
door leads to a room with no audience in it, and the differentiator — *"we simulate your actual
audience"* — is invisible on first use. **The onboarding's job is to make the audience band say
something true, and today it does not even try.**

### 1.4 The gate that routes people there

`src/lib/supabase/middleware.ts:173` — an authenticated, **non-anonymous** user with no
`onboarding_completed_at` hitting a protected path is redirected to `/welcome`. The `!is_anonymous`
narrowing is load-bearing and was itself a fix: an anon funnel visitor can never satisfy the gate
(no `creator_profiles` row is ever written for them), so without it the acquisition funnel **looped**.
Do not widen that condition.

### 1.5 The acquisition funnel is a DIFFERENT thing, and it is already built

`/go` → anonymous session → one free video Test → the sealed verdict wall → $1 / 3-day trial →
account claim. Ten sessions of work, merged. `~/virtuna-onboarding` (`milestone/onboarding`) has
only **2 unique commits**, both `/go-v2` landing work.

That funnel converts a stranger into an account. **This lane starts where it stops.** Do not
re-litigate it, and do not touch the seal / wall / claim path — it is the money path.

## 2. Two real defects found in `/welcome` while surveying

Small, but they are in the first authenticated screen every new user sees.

1. **It redirects to a sunset route.** `welcome/page.tsx:60` and `:103` both
   `router.replace("/dashboard")`. There is no `src/app/(app)/dashboard/` — but this is **NOT a
   404**: `middleware.ts:76` 308-redirects `/dashboard` → `/home` (the D-25 sunset). The cost is a
   pointless extra hop on the first navigation of every new account, plus a stale name in the code.
   *I nearly reported this as a broken funnel; check the middleware before you "fix" it.*
2. **It violates the matte design system.** The card carries
   `boxShadow: "rgba(255,255,255,0.05) 0 1px 0 0 inset"` (`:113`, `:135`) — inset shine, explicitly
   retired ("no glass, no glow, no inset-shine"). `--color-charcoal-chip` itself is fine, still a
   live token (`globals.css:58`). Before restyling, read `reading/__tests__/reskin-matte.test.ts` —
   check whether its file list covers `(onboarding)` or stops at `reading/`.

Also vestigial: the step indicator renders a **single dot**, with a comment admitting it is "kept
for visual symmetry with prior flow." A one-step progress bar is chrome that measures nothing.

## 3. 🔴 THE DECISION — settle this with the owner before building

**How does a new user get a calibrated audience?** Calibration is a measured **~126 second** scrape
(`/api/audiences/calibrate`). That single fact forces the shape of the whole onboarding.

| | What it buys | What it costs |
|---|---|---|
| **A. Calibrate inline, blocking** | The product WORKS on first use — the first card they ever generate has a real persona and a real share | A brand-new user stares at a 2-minute wait before seeing anything. Highest-abandon moment in the funnel |
| **B. Defer entirely** | Instant entry | Every card is degraded until they calibrate, and **nothing currently nags them to**. This is today's behaviour, minus the illusion |
| **C. Hybrid — start it in the background, let them explore** | Instant entry AND a working product a couple of minutes in | Needs the wait to be legible, and needs a state for "cards generated before calibration finished" |

**My recommendation: C**, and the machinery for it already exists on `main`.

- The thread loading **spine** landed in #411 and can draw the engine's own material under the
  active step via an `evidence` SSE frame.
- Calibration **already has three real stages with honest copy** (`CalibrationStage` in
  `src/lib/audience/calibration.ts`). Its only defect is that the route emits them via
  `send("status", {message})` instead of `send("stage", …)`, so the longest wait in the product
  renders as one plain line. Fixing that is the cheapest high-value change on the board and it is
  *already* on the backlog independently — see `scrape-waits-are-blind`.

So C is mostly **wiring what exists**, not new invention. But it is the owner's call, not yours.

Second question for the same conversation: **is the TikTok handle required or skippable?** Today
"Skip for now" leads to a permanently inert product. If calibration is the point of onboarding,
skipping needs either a real second path (describe your target audience — `audience-create.tsx`
already supports a *target* path with a textarea, not just a personal @handle) or an honest
consequence the user is told about.

## 4. The build, once §3 is answered

Sketch only — do not treat as approved scope.

1. **Make `/welcome` do the connect it promises.** The handle should create the
   `connected_accounts` row via the existing `/api/connected-accounts/connect`, not just write a
   string to `creator_profiles`.
2. **Hand off into calibration** per the §3 decision, reusing `calibration-flow.tsx` rather than
   building a third calibration UI (there are already two entry points: `calibration-flow.tsx` and
   `audience-create.tsx`).
3. **Fix the two §2 defects** in passing — they are three-line changes.
4. **Give `/home` a first-run state that knows the user is new.** `home-starter.tsx` is
   **THE STARTER CONTRACT** — read its header comment in full before touching it. The six starter
   cards are deliberately **constant furniture**; they do not change with the armed skill, and that
   is a decision the file argues for at length. Adding a seventh card, or making the grid
   conditional, fights an explicit rule. If a first-run affordance is needed, it likely belongs
   *beside* the grid, not inside it.
5. ⚠️ **Never flip `hasThread` to render an idle view.** `composer.tsx` — doing so tears the page
   into a half-thread layout (greeting pinned top, composer pinned bottom, dead gap between). This
   is documented in `home-starter.tsx`'s header as an already-paid-for bug.

## 5. Traps that will cost you time

- **Audit the funnel on a PRODUCTION BUILD, always.** Dev StrictMode fakes a broken funnel: the
  rehydrate effect's second pass clears `hasUserSelectedToolRef` while the seed inlet early-returns
  on `seedConsumedRef`, so `/home` arrives dead — empty page, no error, forever. It does not ship.
  This cost a previous session ~3 hours. `npm run build && next start`.
- **`npm test` is fake here** — use `node ./node_modules/vitest/vitest.mjs run`. And `npx` wraps and
  swallows output; prefer `node node_modules/<bin>`, trust `$?`, never the summary line.
- **Never run vitest while `npm run build` is running.** Seven API-route tests "fail" on 5s timeouts
  purely from CPU starvation; isolated they pass in ~4s. Cost me a false diagnosis this session.
- **Run UI tests BOTH flag ways.** Under `NEXT_PUBLIC_AMBIENT_V2` the thread region only renders
  once `hasConversationContent` is true, so a flags-OFF-only test can pass by matching an *absence*.
- **Verify RLS, not just the query.** A policy gap turns a count into a silent 0 — that is how the
  demo entitlement nearly shipped unlimited free Tests.
- **Apify is on rotating FREE accounts with a $5/mo hard cap**, ~$3.40 left, resets 2026-08-20.
  Calibration is a real scrape. A cap-out is disguised as "check your handle is public" — check the
  ACCOUNT, not the app. Budget your live runs; do not loop calibration in testing.
- **A green Vercel check on a PR is NOT a build** (`ignoreCommand` skips and posts success). Run
  `npm run build` yourself; vitest does not typecheck.

## 6. Verification

Signed-in verification **works** — `e2e/auth.setup.ts` was fixed 2026-08-01 and passes in ~2.3s.
The test-user credentials are a **REAL PROD account**; dev and prod share one Supabase project, so
anything you write is real. To test a *new* user you need a genuinely fresh account, and every one
you make persists — clean up after yourself.

Gate: `npx tsc --noEmit` · `node ./node_modules/vitest/vitest.mjs run` (both flag ways) ·
`npm run build` (**the** gate — a `src/lib/surfaces/*` import into an API route breaks the prod
build while tsc stays clean).

## 7. Do NOT

- Touch the seal / wall / claim path — money path, and it is verified working.
- Widen the `!user.is_anonymous` condition in `middleware.ts:173`.
- Rebuild `/go`. It is done, and three worktrees have historically served it on different ports —
  check the PORT before believing any review of it.
- Add a second calibration UI. There are already two.
- Stage the untracked leftovers in this worktree: `src/app/zz-preview/`, `scripts/zz-shoot.js`,
  `zz-shots/`, `public/zz-v94-cards.html`, `.planning/sketches/*`. They are the merged card lane's
  throwaway harness. **Stage by name, never `git add -A`.**

## 8. Kickoff

```bash
cd ~/virtuna-slot-a && git switch lane/new-user-onboarding
git rev-parse HEAD                       # expect a7ff97f6 + this doc commit
git status --short                       # untracked zz-* are EXPECTED — never stage them
npm run dev -- --port 3001               # a launchd reaper kills it after ~10 min idle
```

Read in this order: this doc → `src/app/(onboarding)/welcome/page.tsx` →
`src/components/onboarding/connect-step.tsx` → `src/components/app/home/home-starter.tsx`
(its header comment is a design contract, not commentary) → `src/lib/supabase/middleware.ts:150-190`.

**Settle §3 with the owner before writing code.**
