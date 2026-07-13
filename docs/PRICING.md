# Pricing — what we charge, and what still needs a human

Owner-locked **2026-07-13**. Code SSOT: **`src/lib/pricing.ts`**. Change a price there and the
landing teaser, the `/pricing` page, the checkout dialog, the in-app billing panel and the
quota check all move together. Nothing else may hardcode a price.

## The plans

| Public name | Price | Tier id (persisted) | Readings / month | Seats | Notes |
|---|---|---|---|---|---|
| **Creator** | $49/mo | `starter` | 50 | 1 | |
| **Pro** | $99/mo | `pro` | 150 | 1 | **Best value** — the one highlighted CTA. Adds 1,000-viewer population depth + priority support |
| **Studio** | $499/mo | `studio` | Unlimited | 5 | API access + dedicated support |

**Every plan starts at $1 for 3 days**, then renews at the plan price. Adopted from
makeugc.ai's "Start for $1" (a short *paid* trial that converts, not a free trial).

### The trial pool — 5 Readings, every plan

A $1 trial buys **at most 5 Readings**, whatever plan was picked. This is the leech guard, and
it is what makes the trial safe to offer on all three plans: without it, $1 would buy 150 Pro
Readings (~$22 of engine spend at ~$0.15/Reading) or an *unbounded* number on Studio.

- The pool is counted from the **moment the trial starts**, not from the 1st of the month.
- The cap **overrides Studio's "unlimited"** — `null` (uncounted) must never leak into a trial.
- The plan's real allowance takes over the moment the trial converts.
- Both the cap and the renewal are stated on every card, in the FAQ and under every CTA. A
  trial that hides either one is what chargebacks are made of.

Mechanically: the Whop webhook stamps `trial_started_at` / `trial_ends_at` when the purchased
plan is one of the `WHOP_TRIAL_PLAN_ID_*` SKUs, and the quota check reads that window. The
window is stamped **once per membership** — a trial SKU renews into its plan price under the
same plan id, so re-stamping on renewal would hand out a fresh 5-Reading trial (and re-cap a
now-paying Pro at 5) every billing cycle.

There is **no free plan**. `free` is a tier id, but it is not something you can buy: it is the
state of someone who has never started a trial, or whose subscription lapsed. Its Reading
allowance is **0** — the $1 trial is the way in.

> ⚠️ **`starter` is sold as "Creator".** The id is persisted in
> `user_subscriptions.virtuna_tier` and read by every gate; renaming it would mean rewriting
> every row for zero user-visible gain. The mapping lives in `pricing.ts` and nowhere else.
> **Never print a tier id in the UI — print `plan.name`.**

## The meter

A **Reading** = one row in `reading_events` (billed) = one full simulation actually **delivered**.
That is the unit the customer is charged for, so it is the unit we count
(`src/lib/billing/quota.ts`; billed at exactly one place, `src/lib/billing/record-reading.ts`).

It used to be a row in `analysis_results`, which is not the same thing:

- the SSE branch writes its row *before* the engine runs, so **a failed run charged the
  customer** — real, and live today;
- usage lived in a table the product rewrites. Today's delete is a *soft* delete and the count
  ignores `deleted_at`, so it does not currently refund — **by accident**. A hard delete, a
  prune, or anyone adding `deleted_at` to that WHERE clause would hand the allowance back;
- and none of it was auditable.

The ledger is append-only and only ever written on success. (If the ledger migration has not been
applied, the count silently falls back to the old `analysis_results` behaviour, so the app runs
identically either side of it.)

Two windows, and **the trial wins**:

| Situation | Allowance | Counted from |
|---|---|---|
| Inside the $1 trial | **5** (every plan) | the instant the trial started |
| After it converts | the plan's monthly allowance | the **billing anchor** — the day-of-month of `current_period_end`, clamped for short months |

The check runs in `POST /api/analyze` *before* any engine spend, and returns **402** with a
`reading_quota_exceeded` payload when the allowance is spent (with a different message for a
trialling customer — they have not hit their plan's limit, their plan simply hasn't started).
The client turns that into the paywall (`src/components/app/reading-limit-dialog.tsx`), which
offers a trialling customer **a date, not a second checkout** — they have already paid.
It **fails open**: if the count query errors, the Reading is allowed — a flaky database must
never cost a paying customer.

### Where a customer sees their balance

- `/settings` → Billing: "38 of 50 Readings left", the reset date, and the plans.
- Under the composer: the same line, quiet, going amber at 20% and red at zero.

Visibility is **not** the same as enforcement: the balance shows as soon as someone has a plan
or a trial pool, whether or not `BILLING_ENFORCE_QUOTA` is on. A `free` user sees no meter at
all (allowance 0 by design) — they see the plans instead of a "0 of 0 Readings left" that would
read as a bug.

## ⛔ What is NOT live yet — the owner's four steps
<!-- Step 2 now lists THREE migrations: the ledger (20260713160000) was added by the usage
     system. It is the only one that is optional-ish — without it the meter still works, it
     just keeps billing failed runs. -->


The code is complete and shipped, but **nobody can actually buy a plan until these are done.**
Enforcement is deliberately inert until then: with no purchasable plan, switching the meter on
would lock out every existing user (all of whom are tier `free`, allowance 0).

1. **Create 6 Whop plans** — one full-price plan per tier, plus one **$1 / 3-day trial plan per
   tier** that renews into the full price:

   | Env var | What it points at |
   |---|---|
   | `WHOP_PRODUCT_ID_STARTER` | Creator — $49/mo |
   | `WHOP_PRODUCT_ID_PRO` | Pro — $99/mo |
   | `WHOP_PRODUCT_ID_STUDIO` | Studio — $499/mo |
   | `WHOP_TRIAL_PLAN_ID_STARTER` | Creator — $1 for 3 days, then $49/mo |
   | `WHOP_TRIAL_PLAN_ID_PRO` | Pro — $1 for 3 days, then $99/mo |
   | `WHOP_TRIAL_PLAN_ID_STUDIO` | Studio — $1 for 3 days, then $499/mo |

   Set them in Vercel (prod + preview). A missing **trial** id degrades to full price (the
   buyer is charged the plan price, never less than the button promised); a missing **plan** id
   makes checkout return 503 rather than silently granting access.

2. **Run all three migrations** — additive, no rows change. ⚠️ As of 2026-07-13 **none of them
   are applied to prod** (verified against the live project):
   - `20260713120000_pricing_studio_tier.sql` — widens the tier CHECK so the webhook can write
     `studio`. Without it, a Studio purchase's webhook **will fail to persist**.
   - `20260713140000_trial_window.sql` — adds `trial_started_at` (and adopts the long-dead
     `is_trial` / `trial_ends_at` columns). Without it, the **5-Reading trial cap cannot be
     enforced** and a $1 trial grants the plan's full monthly allowance.
   - `20260713160000_reading_events.sql` — the Reading ledger. Without it the meter falls back
     to counting `analysis_results` rows, which means **a failed engine run still costs the
     customer a Reading** and deleting a Reading refunds one. Nothing breaks without it; it is
     just the difference between billing what was delivered and billing what was attempted.

3. **Flip the meter on**: `BILLING_ENFORCE_QUOTA=true`. Until then the quota is computed and
   logged but never blocks — so you can watch real usage against the limits before the gate
   closes on anyone.

4. **Decide the grandfather rule** for anyone already using the app: they are all tier `free`
   (allowance 0), so the day you flip step 3 they stop at zero Readings. Either grant them a
   plan in Whop, or accept that they must start a $1 trial.

## What is still owner-gated elsewhere on the site

The "2,000+ creators" social-proof claim and the marquee/testimonial identities are unchanged
and still fictional. They are not part of this pricing work.
