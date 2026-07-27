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

### 1. ✅ Whop: 6 plans + 3 secrets — PROVISIONED 2026-07-26, integration merged `b3b21bd5` 2026-07-27

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

Set them in Vercel (Production). A missing **trial** id degrades to full price (never
undercharge — and the modal now says which price was resolved); a missing **plan** id makes
checkout 503 rather than silently granting access.

**Build each trial SKU as: `Initial fee` $1 + `Free trial` 3 days + subscription price =
the plan price.** Whop charges an initial fee immediately and only the *subscription* waits
for the trial to end — which is exactly "$1 now, $49 on day 4". There is no separate
"paid trial" primitive.

Subscribe the webhook (`https://<domain>/api/webhooks/whop`) to exactly these three:
**`membership_went_valid`**, **`membership_went_invalid`**, **`payment_failed`**.

> ⚠️ **The docs and the API disagree. Trust the API.** Whop's published event list advertises
> `membership.activated` / `membership.deactivated`, and an earlier edit of this file told you
> to use them. **The webhook endpoint rejects both** — "is not a valid event" — on every
> `api_version`. Probed live 2026-07-26 against the real account. The only accepted
> membership/payment events are the three above. `invoice_past_due` is also rejected.
>
> The API accepts only the **underscored** spelling, and echoes it back underscored — yet the
> same created webhook stored `["membership_went_valid", "membership_went_invalid",
> "payment.failed"]`, mixing both conventions in one array. The handler therefore normalises
> the first underscore to a dot and reads the name from either `event` or `action`
> (`normalizeEventName`), so all four spellings land on one case.
>
> **Do not "modernise" these names from the docs without re-probing the API.**

**What was actually broken** (audit 2026-07-26 — none of it had ever run against real Whop):
`/api/v5/checkout_sessions` and `/api/v5/memberships` were **removed** and answered 404, so
the first purchase would have 500'd; the verifier read `svix-*` headers where Whop sends
Standard Webhooks `webhook-*`, so every delivery 401'd. Both fixed and **verified live**:
a real checkout session now returns a `ch_…` id with metadata round-tripping.
It survived unnoticed because the checkout test stubbed `fetch` wholesale and asserted only
the request *body* — never the URL. A mocked transport proves a call's shape, not its
destination.

> **Still unverified** (needs a real purchase): the webhook **payload** — whether the event
> arrives under `event` or `action`, and how the plan id is nested. The handler reads
> `plan.id → plan_id → product.id → product_id`, and an unrecognised event or unmatched SKU
> is logged at WARN/ERROR with the raw spelling and payload keys — never silently swallowed.
> **The first sandbox event settles it.**

### 2. ✅ Supabase Auth dashboard — DONE 2026-07-27

| Setting | Where | State |
|---|---|---|
| Minimum password length | Auth → Providers → Email | ✅ **8**. ⚠️ This is the *only* enforcement at signup — `signup-form.tsx` has no `minLength` and `signup/actions.ts` passes the password straight to `signUp` with no validation. (`reset-password-form.tsx` does enforce 8 client-side; an earlier revision of this file generalised that to "forms already enforce 8", which was wrong.) |
| Leaked-password protection | Auth → Providers → Email | ⛔ **Pro-plan only** — cannot be enabled on this plan. Accepted gap; the advisor will keep flagging it. Signup is genuinely password-based (`signUp` + `signInWithPassword`), so if this ever matters, the free alternative is a HIBP k-anonymity check inside `signup/actions.ts` (~20 lines, no key, password never leaves the server). |
| Site URL | Auth → URL Configuration | ✅ `https://numenmachines.com` |
| Redirect URLs | Auth → URL Configuration | ✅ `https://numenmachines.com/**`, `https://www.numenmachines.com/**`, `http://localhost:3000/**`. **Wildcards are required, not cosmetic** — the app redirects to `${origin}/auth/callback?next=/welcome` and `?next=/reset-password`; a bare `/auth/callback` entry does not match the query string and the redirect is rejected *after* the user has already clicked the link in their email. |
| Custom SMTP | Auth → SMTP | ✅ **Resend**, `smtp.resend.com:587`, user `resend`, sender `Maven <noreply@numenmachines.com>`. Verified end to end 2026-07-27: `POST /recover` → 200, mail delivered. ⚠️ Also raise Auth → Rate Limits → *emails per hour* — it stays at **30** even after custom SMTP is attached, so Supabase throttles below whatever the provider allows. |
| Google OAuth | Auth → Providers → Google | ✅ confirmed |

⚠️ **Deliverability, not configuration:** the first message landed in Gmail **spam**. SPF and
DKIM both pass and both align (`resend._domainkey.numenmachines.com` signs `d=numenmachines.com`;
return-path `send.numenmachines.com` → `include:amazonses.com`), so this is reputation on a domain
whose entire history is a parked page and then a suspended cPanel account — not an auth failure.
It warms up with volume and engagement. Levers, in order of effect: recipients marking "not spam";
deploying a real email template (Supabase's stock recovery mail is a near-empty body with one bare
link — a textbook spam shape, and `supabase/templates/*.html` are **local-dev only**, prod uses
stock); DMARC `p=none` → `p=quarantine`; Google Postmaster Tools. **Not a launch blocker** — mail
is delivered and accepted, just filed in the wrong folder.

### 3. Flip the meter: `BILLING_ENFORCE_QUOTA=true`

Until then the quota is computed, shown and logged but never blocks. Flip AFTER the sandbox
pass (below).

### 4. ✅ Grandfather rule — there is nobody to grandfather

This step used to read *"7 users in prod, 3 active/30d"* and ask which emails to comp. Queried
against `auth.users` on 2026-07-27, those seven are:

| Email | Analyses | What it is |
|---|---|---|
| `e2e-test@virtuna.local` | 58 | the E2E suite |
| `test@virtuna.dev` · `e2e-home-fresh@virtuna.local` · `tester@numen.dev` · `maven-e2e-2026@example.com` | 0–2 | test fixtures |
| `davide.loreti4@gmail.com` | 7 | the owner |
| `davide@gmail.com` | 0 | never signed in — a typo account |

**Zero real users, zero subscriptions.** The count was real; the interpretation was not — `.local`
and `example.com` addresses were being counted as people. So: comp the owner's account, ignore the
rest, and note that **`BILLING_ENFORCE_QUOTA` has no blast radius** — flipping it strands nobody and
needs no migration or announcement.

29 *anonymous* users exist (demo pool, all within 24h, minted two at a time — worth checking that
double-invocation before real traffic). They carry no subscription and are unaffected.

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
- **Crons verified revived in prod** (2026-07-20 log evidence): `calculate-trends` 500
  "supabaseKey is required" at 15:00 UTC on the old deployment → 200 every hour since the
  env redeploy; `scrape-trending` scraping again after 154h stale.
- **E2E quota flow verified locally with `BILLING_ENFORCE_QUOTA=true`** (2026-07-20, fixture
  starter sub + synthetic ledger rows, removed after): admission block at 3-of-500 left
  refuses a 10-credit Reading with "That needs 10 credits — you have 3 credits left this
  month."; spent allowance at 0 left refuses a 1-credit hooks pack with "You've used all
  500 credits…". Both 402 BEFORE any engine spend. (The Whop-checkout sandbox pass below
  still stands — it needs step 1.)

## What is still owner-gated elsewhere on the site

The "2,000+ creators" social-proof claim and the marquee/testimonial identities are unchanged
and still fictional. They are not part of this pricing work.
