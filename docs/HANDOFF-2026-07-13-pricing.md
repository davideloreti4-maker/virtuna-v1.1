# HANDOFF — Pricing (2026-07-13) · session SSOT

> Trunk `~/virtuna-v1.1` on `main`. Prices/plans are **owner-locked**; the code SSOT is
> `src/lib/pricing.ts` and the operator doc is `docs/PRICING.md` (read that first — it has the
> plan table, the trial rules, and the 4 steps only the owner can do).

## What shipped

| PR | Squash | What |
|---|---|---|
| **#264** | `78c1f636` | Three plans — **Creator $49 · Pro $99 (best value) · Studio $499** — each starting at **$1 for 3 days**. No free plan. New pricing SSOT; `studio` tier added end-to-end; the Reading meter built (inert). |
| **#265** | `8ab02885` | **The $1 trial buys 5 Readings, on every plan** — the leech guard. Trial window persisted + enforced; copy states the cap everywhere. |
| **#266** | *(this session)* | **The usage system.** The Reading ledger (`reading_events`), billing-date periods, the balance surfaced in-app, and the 402 turned into a real paywall. |

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

## ✅ The usage system — BUILT (#266)

What the previous version of this doc listed as "the real work" is done:

- **The ledger.** A Reading is now a row in `reading_events` (append-only, billed on success
  only), not a row in `analysis_results`. This fixed three real billing bugs: the SSE branch
  writes its `analysis_results` row *before* the engine runs, so **a failed run charged the
  customer**; **deleting** a Reading refunded the allowance; and usage was unauditable. Written
  at exactly one place (`lib/billing/record-reading.ts`), best-effort — a ledger write must never
  fail a Reading the customer already has. Falls back to the old row count while the migration
  is unapplied, so behaviour is identical either side of it.
- **Billing-date periods.** The allowance resets on the subscription's renewal anchor (the
  day-of-month of `current_period_end`, clamped for short months, walking back to the most recent
  anchor so a stale row can't open a months-wide window) — not on the 1st.
- **The balance is visible.** `/settings` → Billing shows "38 of 50 Readings left", the reset
  date and the plans; the composer carries the same line, quietly. Shown whenever a customer has
  a plan or a trial pool — **visibility is not enforcement**. `free` sees plans, never "0 of 0".
- **The 402 is a paywall.** `use-analysis-stream` carries the payload out (it used to
  `throw new Error(err.error)`, so the user literally read `reading_quota_exceeded` in an error
  line) into `reading-limit-dialog.tsx`. Three walls, three different answers — and a **trialling
  customer is offered a date, not a second checkout**: they have already paid, and putting a
  checkout in front of them is how you charge the same person twice.
- **Two bugs found on the way.** `/api/subscription` never returned `isTrial`/`trialEndsAt`
  even though `useSubscription` read them — so `UpgradePrompt` could never render, for anyone.
  And the settings plan grid still advertised a **"Free" plan that does not exist** and omitted
  Studio entirely. Both fixed; the grid is now generated from the pricing SSOT.

## ▶ NEXT SESSION — what is still open

### 1. Make it purchasable (owner + code)

The owner must create **6 Whop plans** (3 full-price + 3 × "$1 for 3 days, then plan price") and
set `WHOP_PRODUCT_ID_{STARTER,PRO,STUDIO}` + `WHOP_TRIAL_PLAN_ID_{STARTER,PRO,STUDIO}`, then run
the **three** migrations (`20260713120000`, `20260713140000`, `20260713160000`) — verified
2026-07-13 against the live project: **none of them are applied yet**. Code side, verify against
a real Whop sandbox purchase:

- a $1 trial purchase lands `virtuna_tier` + `trial_started_at`/`trial_ends_at`;
- the conversion webhook does **not** re-stamp the window (it would grant a fresh trial every
  cycle — the guard is "stamp once per membership", `src/app/api/webhooks/whop/route.ts`);
- cancellation/expiry drops the tier back to `free`;
- **a real Reading writes exactly one `reading_events` row, and a failed one writes none.**
  This is the one thing #266 could not verify end-to-end: the ledger table does not exist in
  prod yet, so every run today takes the legacy fallback path. Unit tests cover both branches.

### 2. The rest of the usage system

- **Top-ups** (old strategy: 5 Readings = $5, Pro/Studio only) — needs a Whop one-off SKU. The
  ledger makes this trivial now: a top-up is just N unbilled-allowance events, or a credit column.
- **Seats.** Studio sells 5 seats; there is no team/seat model in the app at all.
- **Refunds/comps.** `reading_events.billed=false` is the seat for these, but nothing writes it
  yet and there is no operator UI.
- **`usage_tracking` is now redundant-ish.** The analyze route still upserts a daily
  `analysis_count` alongside the ledger. Left alone deliberately (other things may read it), but
  it is a second source of truth for "how much has this user used" and should probably go.

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

`tsc` 0 · `eslint` 0 · full suite green · browser pass at 1440 and 390.

For #266 that meant **50 billing/pricing/paywall tests** (ledger counting + the pre-migration
fallback + the refusal to substitute a legacy count for a real ledger error; the billing anchor
incl. short-month clamping, the no-early-rollover rule and stale `current_period_end`; the
balance copy; and the paywall's three walls) plus a real browser pass, signed in as the e2e
user, driving each balance state and tripping an actual 402 through the composer.

**Known pre-existing failure, NOT from this work:** `src/app/api/tools/remix/run/__tests__/route.test.ts`
› "SSE stream emits stage + content + score + done events" fails on clean `main` too (confirmed by
stashing). Unrelated to billing; left alone.
