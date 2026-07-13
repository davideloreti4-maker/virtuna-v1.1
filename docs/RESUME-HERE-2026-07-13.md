# RESUME HERE — 2026-07-13

You stepped away mid-billing-work. This is the one page to re-read when you come back; everything
else links out from here. Trunk `~/virtuna-v1.1` is on `main`, clean.

---

## 1. 🔴 Do this first — production is quietly broken (5 min, only you can do it)

**Every scheduled cron in production has been failing for days.** Not a regression from this
week's work; a missing secret. Confirmed live at 09:00 UTC today:

```
GET /api/cron/calculate-trends   500   {"error":"supabaseKey is required."}
GET /api/cron/refresh-competitors 500  Error: supabaseKey is required.
GET /api/cron/scrape-trending    500   {"error":"supabaseKey is required."}
```

Last 24h in prod: **26 × 500, 8 × 401, zero successes.**

**Cause:** `SUPABASE_SERVICE_ROLE_KEY` is **absent from the Vercel production environment**.
Every cron calls `createServiceClient()` (`src/lib/supabase/service.ts`), which throws without it.
Production currently holds only `CRON_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. (The older 401 story is closed — `CRON_SECRET` fixed that; the
crons now die one line later.)

**Fix:** Vercel → `virtuna-v1.1` → Settings → Environment Variables → add
`SUPABASE_SERVICE_ROLE_KEY` (Production) → redeploy. Nothing in code can fix this, which is why
it is sitting on you and not on me.

**Verify after:** the 06:00 UTC run should stamp fresh rows —
`select tiktok_handle, last_scraped_at from competitor_profiles;` — and Vercel runtime logs
should show 200s instead of 500s.

**Blast radius while it's broken:** every scraped thing in prod is frozen. No fresh competitor
stats, no `account_snapshots` time-series, pillars never re-cluster, `sync-whop` never runs —
**and that last one matters for billing**: when you turn Whop on, the cron that reconciles
subscription state is dead. Fix this before you flip anything.

Detail: memory `vercel-crons-dead-401`.

---

## 2. ✅ What got finished (pricing + the usage system)

Shipped and merged: **#264, #265, #267, #268, #270.** The full story is in
[`docs/HANDOFF-2026-07-13-pricing.md`](./HANDOFF-2026-07-13-pricing.md); the operator's view
(plans, trial rules, your steps) is [`docs/PRICING.md`](./PRICING.md). Code SSOT:
`src/lib/pricing.ts`.

**The model:** Creator $49 (50 Readings) · Pro $99 (150) · Studio $499 (unlimited, 5 seats).
Each starts at **$1 for 3 days, capped at 5 Readings** — the cap beats every plan, including
Studio's "unlimited". No free plan.

**The usage system now exists:** a Reading ledger, billing-date periods, the balance visible in
`/settings` and under the composer, and the 402 turned into a real paywall (it used to reach the
user as the raw string `reading_quota_exceeded`).

**The bug that was worth the whole exercise:** the meter counted rows in `analysis_results`, and
the SSE branch writes its row *before* the engine runs — so **a failed engine run charged the
customer a Reading.** A Reading is now a row in `reading_events`, written only on success.

**All three migrations are applied to prod, and the ledger was proven against the real database:**

| Probe | Result |
|---|---|
| A real scored Reading | **exactly 1** billed ledger row |
| A run that failed mid-pipeline | placeholder row left behind (*the row the old meter counted*) · **0** ledger rows |
| The live meter | `used: 1`, where the legacy row count said `3` |

(Those two probe rows have since been deleted from prod. The ledger is back to 0 rows.)

⚠️ **One correction to be aware of:** #267's commit message and PR body claim that *deleting* a
Reading refunded the allowance. **That was wrong** — the delete is soft (`deleted_at`) and the
count never filtered on it. The failed-run bug is the real one; the delete case is a latent
hazard, not a live defect. Corrected in the docs, but the merged commit still says it.

---

## 3. ⛔ What is blocked on you (nobody can pay yet)

Enforcement is deliberately **off** (`BILLING_ENFORCE_QUOTA` unset). It has to be: no Whop plan
exists to buy, and every current user is tier `free` (allowance 0), so switching it on today
locks everyone — including you — out of `/api/analyze`.

1. **Create 6 Whop plans** — one full-price per tier, plus one "$1 for 3 days → plan price" per
   tier — and set `WHOP_PRODUCT_ID_{STARTER,PRO,STUDIO}` +
   `WHOP_TRIAL_PLAN_ID_{STARTER,PRO,STUDIO}` in Vercel.
   *A missing **trial** id degrades to full price (never undercharges); a missing **plan** id
   makes checkout 503 (never a free grant).*
2. **Flip `BILLING_ENFORCE_QUOTA=true`** — but not before step 3.
3. **Decide the grandfather rule.** Every existing user is `free` → **0 Readings** the moment you
   flip the flag. Either grant them a plan in Whop, or accept that they must start a $1 trial.
   This is a judgement call about your existing users, not a technical one.

---

## 4. What I'd pick up next, in order

1. **The cron fix above** (yours, 5 min) — it's a live production breakage and it blocks
   `sync-whop`, which billing needs.
2. **The Whop sandbox pass** (needs your plans to exist). The thing to actually watch: a trial
   purchase must stamp `trial_started_at`/`trial_ends_at`, and the **conversion webhook must NOT
   re-stamp them**. A trial SKU renews into its plan price under the *same* Whop plan id and Whop
   re-sends `went_valid`, so a naive handler would hand every customer a fresh 5-Reading trial
   every billing cycle — and re-cap a paying Pro at 5 Readings. The guard is "stamp once per
   membership" (`src/app/api/webhooks/whop/route.ts`); it is written but has never seen a real
   purchase.
3. **Then, and only then**, the rest of the usage system: top-ups (5 Readings = $5 — trivial now
   the ledger exists), Studio's missing fair-use ceiling, one-trial-per-payment-method, seats.
   All of it is guesswork until a real purchase has happened, which is why I stopped here rather
   than building more billing.

---

## 5. Housekeeping / gotchas worth not re-learning

- **Verification standard for this repo:** `tsc` 0, `eslint` 0, tests green, **and a real browser
  pass**. Green tests are not enough — in this work every programmatic assertion passed while the
  composer's balance line was rendering *half-hidden behind the sidebar avatar* at 390px. Only
  looking at the screenshot caught it.
- **Known pre-existing test failure:** `src/app/api/tools/remix/run/__tests__/route.test.ts` ›
  "SSE stream emits stage + content + score + done events". It fails on clean `main` too
  (confirmed by stashing). Not from this work; still unfixed.
- **`starter` is sold as "Creator".** The tier id is persisted and read by every gate, so it was
  never renamed. **Never print a tier id in the UI** — print `plan.name`.
- **Auth for browser verification:** `e2e-test@virtuna.local` / `e2e-test-password-2026`.
- **Dev server:** `NODE_OPTIONS=--max-old-space-size=3072 node ./node_modules/next/dist/bin/next dev`.
  Add `BILLING_ENFORCE_QUOTA=true` to see the meter actually block.
