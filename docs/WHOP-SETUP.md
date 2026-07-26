# Whop setup — what the owner has to do

**Blocks:** the funnel's only conversion point. `/api/whop/checkout` returns **503** until the env
vars below exist (`whop/config.ts:54` → `route.ts:63` refuses rather than granting an unbilled pass).

**Can I do this for you with access?** Partly. Creating products and reading API keys needs the Whop
account, and the payout/tax/identity steps legally need the account holder — that is you. Give me the
**API key + plan ids** once they exist and I wire everything else. Do **not** paste the API key into
chat; put it in `.env.local` and Vercel, and tell me only the plan ids (those are not secrets).

---

## 1. What to create

The funnel converts on exactly **one** path: `$1 → 3 days → $49 Creator`. Everything else on this
page is for the `/pricing` page and is **not** launch-blocking. Build the Creator pair first, verify
the funnel end-to-end, then add the other two.

For each tier you want live, create **one product with two pricing plans** — a full-price plan and a
separate `$1`-initial trial plan. They must be two plans, not one plan with a toggle, because the
code recognises a trial by matching the **plan id** (`isTrialPlanId`, `config.ts:74`) and that is
what caps the trial at 50 credits.

| Tier | Product name | Plan A — full price | Plan B — the tripwire |
|---|---|---|---|
| **starter** ← build first | Maven Creator | `$49` / month, recurring | **`$1` initial charge, 3-day period, then `$49`/month recurring** |
| pro | Maven Pro | `$99` / month, recurring | `$1` initial, 3 days, then `$99`/month |
| studio | Maven Studio | `$499` / month, recurring | `$1` initial, 3 days, then `$499`/month |

Prices must match `src/lib/pricing.ts` exactly — that file is the SSOT for what the customer is
shown, and a mismatch between the card and the charge is the chargeback vector.

> ⚠️ **The trial plan must AUTO-RENEW into the full price.** The whole funnel is designed around
> there being exactly one conversion (`ONBOARDING-FUNNEL-DESIGN.md` §4a). If Whop is configured so
> the trial simply expires, there is no revenue and the entire retention design is pointed at
> nothing. Verify this on the plan before launch.

## 2. The env vars to send back

```bash
WHOP_API_KEY=                     # Whop dashboard → Developer → API keys (SECRET)
WHOP_WEBHOOK_SECRET=              # from the webhook you create in step 3 (SECRET)

WHOP_PRODUCT_ID_STARTER=          # Creator, Plan A  ($49/mo)
WHOP_TRIAL_PLAN_ID_STARTER=       # Creator, Plan B  ($1 → $49)  ← the funnel needs THIS

WHOP_PRODUCT_ID_PRO=              # optional at launch
WHOP_TRIAL_PLAN_ID_PRO=
WHOP_PRODUCT_ID_STUDIO=
WHOP_TRIAL_PLAN_ID_STUDIO=
```

Set them in `.env.local` **and** in Vercel (Production + Preview). A missing trial id silently
degrades to full price (`resolveWhopPlanId`) — the buyer would be charged $49 instead of $1 with no
error anywhere, so double-check these two are not swapped.

## 3. The webhook

- **URL:** `https://<your-domain>/api/webhooks/whop`
- **Events:** `membership.went_valid`, `membership.went_invalid`, `membership.payment_failed`
  (`api/webhooks/whop/route.ts:57`)
- Copy the signing secret into `WHOP_WEBHOOK_SECRET`.

## 4. Two answers I need from Whop before S2 can be built

Both are unknowns in the current code, and each one changes what we build:

1. **Does `POST /api/v5/checkout_sessions` return a hosted checkout URL?**
   Today we keep only `whopData.id` (`checkout/route.ts:110`). Traffic arrives inside TikTok/IG
   webviews, where embedded payment sheets are unreliable — a **full-page hosted checkout** sidesteps
   the whole problem instead of gambling on the embed. If the response carries a URL, we use it on webview
   traffic and the embed elsewhere.

2. **Can a checkout session be created WITHOUT a logged-in user, and does the webhook carry the
   buyer's email?** This is now load-bearing: you chose **payment first, account after**, so the
   Supabase user gets provisioned from the payment. We need to confirm the webhook payload includes
   the buyer email so the account can be created from it, and we must pass our own correlation id in
   `metadata` (the route already sends a `metadata` object — today it sends `supabase_user_id`, which
   will not exist yet under the new order).

3. **What does Whop send as merchant of record before the renewal charge?** (`§4a` / §6 of the design
   doc.) With a 3-day trial the renewal notice is the difference between a renewal and a dispute. If
   Whop sends nothing, we send it ourselves — but we must not double-send.

## 5. Verify before trusting it

1. Buy the trial with a real card in Whop's test/sandbox mode.
2. Confirm `user_subscriptions` gets the row, with the trial window stamped (that is what caps the
   pool at 50 credits).
3. Confirm the renewal is scheduled at the full plan price, not an expiry.
4. Cancel from inside the app in one tap — that path has to work before traffic arrives.
5. Then the one that actually matters: run the whole thing on a real phone, from a TikTok bio link,
   inside the in-app browser.
