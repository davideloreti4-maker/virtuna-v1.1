# HANDOFF — Pricing (2026-07-13) · session SSOT

> Trunk `~/virtuna-v1.1` on `main`. Prices/plans are **owner-locked**; the code SSOT is
> `src/lib/pricing.ts` and the operator doc is `docs/PRICING.md` (read that first — it has the
> plan table, the trial rules, and the 4 steps only the owner can do).

## What shipped

| PR | Squash | What |
|---|---|---|
| **#264** | `78c1f636` | Three plans — **Creator $49 · Pro $99 (best value) · Studio $499** — each starting at **$1 for 3 days**. No free plan. New pricing SSOT; `studio` tier added end-to-end; the Reading meter built (inert). |
| **#265** | *(this session)* | **The $1 trial buys 5 Readings, on every plan** — the leech guard. Trial window persisted + enforced; copy states the cap everywhere. |

### The model

- **Creator $49** (tier id `starter`) — 50 Readings/mo · 1 seat
- **Pro $99** (`pro`) — 150 Readings/mo · 1 seat · 1,000-viewer population depth · **Best value**
- **Studio $499** (`studio`) — unlimited Readings · 5 seats · API
- **$1 / 3 days on all three**, capped at **5 Readings**, then it renews at the plan price.
- **No free plan.** `free` = never-subscribed / lapsed, allowance **0**.

### Two things that will bite you if you don't know them

1. **`starter` is SOLD AS "Creator".** The id is persisted (`user_subscriptions.virtuna_tier`,
   a CHECK constraint) and read by every gate, so it was NOT renamed. The id→name map lives in
   `pricing.ts` and a test locks it. **Never print a tier id in the UI** — print `plan.name`.
   (`upgrade-banner.tsx` was labelling *both* Creator and Studio as "Starter". Fixed in #264.)
2. **The meter is built but OFF** (`BILLING_ENFORCE_QUOTA` unset). It has to be: no Whop plan
   exists to buy yet, and every current user is tier `free` (allowance 0), so switching it on
   today locks everyone — including you — out of `/api/analyze`. It still computes and logs the
   honest verdict, so real usage can be watched before the gate ever closes.

## ▶ NEXT SESSION — the usage system + pricing integration

Everything below is deliberately NOT built. In rough dependency order:

### 1. Make it purchasable (owner + code)

The owner must create **6 Whop plans** (3 full-price + 3 × "$1 for 3 days, then plan price") and
set `WHOP_PRODUCT_ID_{STARTER,PRO,STUDIO}` + `WHOP_TRIAL_PLAN_ID_{STARTER,PRO,STUDIO}`, then run
both migrations (`20260713120000`, `20260713140000`). Code side, verify against a real Whop
sandbox purchase:

- a $1 trial purchase lands `virtuna_tier` + `trial_started_at`/`trial_ends_at`;
- the conversion webhook does **not** re-stamp the window (it would grant a fresh trial every
  cycle — the guard is "stamp once per membership", `src/app/api/webhooks/whop/route.ts`);
- cancellation/expiry drops the tier back to `free`.

### 2. The usage system (the real work)

Today the meter is a **count query** and nothing else. A usage *system* needs:

- **A usage surface in-app.** Nobody can see their own balance. Needs "N of 50 Readings left this
  month" (and "N of 5 trial Readings") in `/settings` billing + a quiet indicator near the
  composer. The verdict object already carries `used` / `limit` / `inTrial`.
- **The 402 needs a UI.** `/api/analyze` returns `reading_quota_exceeded` with a message; no
  client handles it yet — today it surfaces as a generic failure. Wire it to an upgrade/paywall
  prompt (`upgrade-prompt.tsx` exists).
- **Billing-date periods, not calendar months.** `currentPeriodStart()` resets on the 1st, so
  someone who subscribes on the 28th gets a fresh allowance three days later. Reset on
  `current_period_end` (already stored on the subscription row).
- **A ledger, not a count.** Counting `analysis_results` rows conflates "a Reading" with "a row"
  — deletes, retries and failed runs all skew it. A `reading_events` table (user, timestamp,
  reading id, billed=true/false) makes usage auditable, makes refunds possible, and stops a
  failed engine run from costing a customer.
- **Top-ups** (old strategy: 5 Readings = $5, Pro/Studio only) — needs a Whop one-off SKU.
- **Seats.** Studio sells 5 seats; there is no team/seat model in the app at all.

### 3. Leech protection still missing

The 5-Reading trial cap (#265) closed the big hole. Still open, from the 2026-06-17 strategy:

- **one trial per payment method** (Whop-side dedup, or card-fingerprint check);
- **signup rate limit per IP/device** (`lib/http/rate-limit.ts` exists but is inert without
  `UPSTASH_*`);
- **a fair-use ceiling on Studio's "unlimited"** — there is no abuse bound at all today.

### 4. Not decided

Annual billing (-20% in the old model), the grandfather rule for existing users (all tier `free`
→ 0 Readings the day the flag flips), and whether Flash skills / chat stay unmetered.

## Verification standard for this work

`tsc` 0 · `eslint` 0 · **108 tests** (pricing SSOT lock + quota semantics: trial pool beats every
plan incl. Studio's unlimited, fail-open, inert-flag, window boundaries) · browser pass on
`/pricing` + landing at 1440 and 390.
