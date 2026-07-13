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

There is **no free plan**. `free` is a tier id, but it is not something you can buy: it is the
state of someone who has never started a trial, or whose subscription lapsed. Its Reading
allowance is **0** — the $1 trial is the way in.

> ⚠️ **`starter` is sold as "Creator".** The id is persisted in
> `user_subscriptions.virtuna_tier` and read by every gate; renaming it would mean rewriting
> every row for zero user-visible gain. The mapping lives in `pricing.ts` and nowhere else.
> **Never print a tier id in the UI — print `plan.name`.**

## The meter

A **Reading** = one row in `analysis_results` = one full simulation of one video/concept. That
is the unit the customer is charged for, so it is the unit we count (`src/lib/billing/quota.ts`).
The allowance resets on the **1st of the calendar month, UTC**.

The check runs in `POST /api/analyze` *before* any engine spend, and returns **402** with an
`reading_quota_exceeded` payload when the plan is spent. It **fails open**: if the count query
errors, the Reading is allowed — a flaky database must never cost a paying customer.

## ⛔ What is NOT live yet — the owner's four steps

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

2. **Run the migration** `supabase/migrations/20260713120000_pricing_studio_tier.sql` — it
   widens the tier CHECK constraint so the webhook can write `studio`. Additive; no rows change.
   Without it, a Studio purchase's webhook **will fail to persist**.

3. **Flip the meter on**: `BILLING_ENFORCE_QUOTA=true`. Until then the quota is computed and
   logged but never blocks — so you can watch real usage against the limits before the gate
   closes on anyone.

4. **Decide the grandfather rule** for anyone already using the app: they are all tier `free`
   (allowance 0), so the day you flip step 3 they stop at zero Readings. Either grant them a
   plan in Whop, or accept that they must start a $1 trial.

## What is still owner-gated elsewhere on the site

The "2,000+ creators" social-proof claim and the marquee/testimonial identities are unchanged
and still fictional. They are not part of this pricing work.
