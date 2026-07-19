# Pricing — what we charge, and what still needs a human

Owner-locked **2026-07-19** (supersedes the 2026-07-13 Readings-only model). Code SSOT:
**`src/lib/pricing.ts`**. Change a number there and the landing teaser, the `/pricing` page,
the checkout dialog, the in-app billing panel, every skill gate and the quota check all move
together. Nothing else may hardcode a price.

## The plans

| Public name | Price | Tier id (persisted) | Credits / month | Seats | Notes |
|---|---|---|---|---|---|
| **Creator** | $49/mo | `starter` | 500 | 1 | ≈ 50 full Readings |
| **Pro** | $99/mo | `pro` | 1,500 | 1 | **Best value** — the one highlighted CTA. Adds 1,000-viewer population depth + priority support |
| **Studio** | $499/mo | `studio` | Unlimited* | 5 | *Fair-use ceiling: 300 credits/UTC-day. API access + dedicated support |

**Every plan starts at $1 for 3 days**, then renews at the plan price. **One $1 trial per
account, ever** — enforced server-side (`trial_used_at`, write-once history; a repeat "trial"
checkout quietly resolves the full-price SKU and the modal says so).

There is **no free plan**. `free` is a tier id, but not something you can buy: it is the state
of someone who never started a trial, or whose subscription lapsed. Its allowance is **0**.

> ⚠️ **`starter` is sold as "Creator".** The id is persisted in
> `user_subscriptions.virtuna_tier` and read by every gate. The mapping lives in `pricing.ts`
> and nowhere else. **Never print a tier id in the UI — print `plan.name`.**

## The meter — credits

One pool per plan; every paid action draws from it at a public price (`CREDIT_COSTS`):

| Credits | Actions |
|---|---|
| **10** | A full **Reading** — score a video/concept, decode a remix source, `/test` in chat |
| **5** | Explore with a **live outlier scrape** (real Apify spend) |
| **2** | A script · a Predict · a Simulate · a Profile read |
| **1** | A hooks pack · an ideas pack · develop-this-idea · a concept Read · a card refine · a cached Explore |
| **0 (free)** | Open chat · type-to-room reactions · viewing anything — free on purpose (the glue), guarded by rate limits, not the meter |

> ⚠️ **The per-action numbers are DRAFT until a final owner sign-off** (the plan allowances
> and ratios are locked). Before flipping enforcement on, verify the costs against measured
> engine spend per skill and sign the list. The margins hold at 70–85% across all-one-skill
> worst cases at the current numbers.

### Mechanics

- **The ledger**: one `reading_events` row per delivered action, stamped with its credit
  price at delivery (append-only, service-role writes only, billed on SUCCESS only — a failed
  run never charges). The quota check SUMS `credits` via the `credits_used_since` RPC.
  Rows that predate the credits column carry its default of 10 — exact, since every
  pre-credits row was a full Reading.
- **The gate**: every paid route calls `creditGate` BEFORE any engine spend and answers a
  spent allowance with **402** + `credit_quota_exceeded` (message written server-side). The
  client raises ONE paywall dialog everywhere (`CreditWallListener`); four walls, four
  different sentences: trial-spent gets a date, no-plan gets the $1 door, plan-spent gets the
  upgrade, Studio's fair-use gets **midnight UTC — never an upsell**.
- **Admission is cost-aware**: 3 credits left affords a 1-credit hooks pack, not a 10-credit
  Reading.
- **Windows**: inside the $1 trial → **50 credits** counted from the trial's start (every
  plan — the cap overrides Studio's unlimited). After conversion → the plan's allowance per
  **billing-anchor month** (day-of-month of `current_period_end`, short-month clamped), not
  the calendar month.
- **Fail-open, everywhere**: a flaky count must never cost a paying customer an action.
- **Fallback chain**: RPC missing → ledger row-count × 10; ledger missing → legacy
  `analysis_results` count × 10. The app behaves identically either side of each migration.
- **Balance**: `/settings` → Billing and under the composer — "380 of 500 credits left",
  amber at 20%, red at zero. Visibility is NOT enforcement: the balance shows whenever
  there's a plan or trial pool, flag or no flag.

## ⛔ What is NOT live yet — the owner's remaining steps

Enforcement is deliberately inert (`BILLING_ENFORCE_QUOTA` unset) until these are done, in
this order:

### 1. Whop: create 6 plans + 3 secrets (the only blocking step)

One full-price plan per tier, plus one **$1 / 3-day trial SKU per tier** that renews into the
full price:

| Env var | What it points at |
|---|---|
| `WHOP_PRODUCT_ID_STARTER` | Creator — $49/mo |
| `WHOP_PRODUCT_ID_PRO` | Pro — $99/mo |
| `WHOP_PRODUCT_ID_STUDIO` | Studio — $499/mo |
| `WHOP_TRIAL_PLAN_ID_STARTER` | Creator — $1 for 3 days, then $49/mo |
| `WHOP_TRIAL_PLAN_ID_PRO` | Pro — $1 for 3 days, then $99/mo |
| `WHOP_TRIAL_PLAN_ID_STUDIO` | Studio — $1 for 3 days, then $499/mo |
| `WHOP_API_KEY` | Dashboard → Developer → API key (server-side checkout sessions) |
| `WHOP_WEBHOOK_SECRET` | Webhook endpoint secret for `https://<domain>/api/webhooks/whop` |

Set them in Vercel (Production). Configure the webhook in Whop to send
`membership.went_valid`, `membership.went_invalid`, `membership.payment_failed`.
A missing **trial** id degrades to full price (never undercharge — and the modal now says
which price was resolved); a missing **plan** id makes checkout 503 rather than silently
granting access.

### 2. Supabase Auth dashboard (15 minutes, one-time)

| Setting | Where | Value |
|---|---|---|
| Leaked-password protection | Auth → Providers → Email | **ON** (advisor currently flags it off) |
| Minimum password length | Auth → Providers → Email | **8** (forms already enforce 8 client-side) |
| Site URL | Auth → URL Configuration | the production domain (currently `https://virtuna-v11.vercel.app`) |
| Redirect URLs | Auth → URL Configuration | `https://<domain>/auth/callback`, `http://localhost:3000/auth/callback` |
| Custom SMTP | Auth → SMTP | **Required before launch** — default Supabase SMTP is ~2 emails/hour, which breaks signup confirmations and password resets at any real volume. Resend/Postmark, 10 min setup |
| Google OAuth | Auth → Providers → Google | confirm prod client id/secret + the prod redirect URL in Google Console |

### 3. Flip the meter: `BILLING_ENFORCE_QUOTA=true`

Until then the quota is computed, shown and logged but never blocks. Flip AFTER the sandbox
pass (below).

### 4. Grandfather rule (7 users in prod, 3 active/30d, 0 subscriptions)

Everyone is tier `free` (allowance 0) — on flip day they stop at zero. Recommendation: comp
the owner's own account(s) (insert a `user_subscriptions` row at `studio`, or unbilled ledger
rows), let the handful of others start a $1 trial. Decide which emails get comped.

### 5. The sandbox pass (with Whop test mode, before real customers)

- [ ] Trial purchase → webhook grants tier + stamps `trial_started_at`/`trial_used_at`
- [ ] 50-credit pool enforced: 5 Readings pass, the 6th 402s with trial copy (a DATE, no checkout)
- [ ] Conversion (day 4) does NOT re-stamp the window; full allowance takes over
- [ ] A second trial attempt on the same account resolves FULL PRICE + the modal says why
- [ ] Cancel → `went_invalid` → tier `free`; payment failure → `past_due`
- [ ] `sync-whop` cron reconciles a manually-desynced row
- [ ] A generation skill (hooks) bills 1 credit; a failed run bills nothing

### Optional hardening (post-launch acceptable)

- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — activates per-user rate limits on
  AI routes (`lib/http/rate-limit.ts` is fail-open without them; free tier of Upstash is fine).
- Whop: ask about payment-method-level trial dedup (our guard is per-account; a new signup
  with a new email + same card still gets a $1 trial).
- MFA options (Supabase advisor flags none enabled) — post-launch.
- pg_graphql schema exposure (advisor WARN ×102): RLS protects the rows; revoking anon
  SELECT grants / disabling GraphQL would silence the advisor — cleanliness, not a breach.

## Done 2026-07-19 (this session)

- Credits model shipped end-to-end (SSOT → RPC meter → 11 gated routes → one wall).
- Migrations **applied to prod**: `credits_ledger` (column + RPC), `trial_used_once`.
- Vercel prod env: pushed `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`,
  `DASHSCOPE_API_KEY`, `DEEPSEEK_API_KEY`, `APIFY_TOKEN`, `FILMSTRIP_EXTRACT_SECRET`,
  `GROUNDING_*_ENABLED`, `NEXT_PUBLIC_APP_URL` — prod can run the engine and its crons for
  the first time. (Whop keys pending step 1; `BILLING_ENFORCE_QUOTA` pending step 3.)
- Password reset flow exists (`/forgot-password` → `/auth/callback` → `/reset-password`).
- One-trial-per-account guard live in checkout.

## What is still owner-gated elsewhere on the site

The "2,000+ creators" social-proof claim and the marquee/testimonial identities are unchanged
and still fictional. They are not part of this pricing work.
