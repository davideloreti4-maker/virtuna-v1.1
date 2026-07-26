# Handoff — Whop provisioned, Vercel wired, domain pending (2026-07-26)

Branch `fix/whop-api-drift` · worktree `~/virtuna-whop` · tip `08833d7a` · pushed, **not merged**
Suite **4467 passed / 0 failed** (406 files) · tsc 0 · eslint 0 · prod build exit 0

---

## 0. TL;DR

Whop went from *nothing* to *fully provisioned and live-verified* in one session. On the way,
the Whop integration turned out to have **never run against real Whop** and to be broken three
independent ways — each one fatal to billing. All fixed and verified against the live API.

**The one thing standing between here and taking money: DNS.** `numenmachines.com` still
resolves to Namecheap's parking IP.

---

## 1. What exists in Whop now

Company `biz_LyBwGuDUAoMFco` ("Maven"). It was empty before this session.

| Tier | Product | Full-price plan | $1 / 3-day trial SKU |
|---|---|---|---|
| Creator | `prod_zNxqka5RmfYSe` | `plan_LVWd451KE0Rgv` — $49/mo | `plan_OTX4xMIHYyDoY` |
| Pro | `prod_5vCS3QSjYxH4L` | `plan_Pkk9QVyLzdHai` — $99/mo | `plan_QA72bFXMdPqPE` |
| Studio | `prod_kPZIkt2y6nbDn` | `plan_83mfwzNQl17bq` — $499/mo | `plan_oj4jhlB2Yxoel` |

Webhook `hook_Jw56rQjnWOIVO` → `https://numenmachines.com/api/webhooks/whop`, `api_version: v2`,
events `membership_went_valid`, `membership_went_invalid`, `payment.failed`.

> **The $1 trial is not a Whop primitive.** It is one plan carrying `initial_price: 1` +
> `trial_period_days: 3` + `renewal_price: <tier price>`. Whop charges an initial fee
> immediately and only delays the *subscription* — which is exactly "$1 today, full price on
> day 4". Do not go looking for a "paid trial" object; there isn't one.

Created by `scratchpad/provision-whop.mjs` (dry-run by default, `--apply` to commit).
Verified by `scratchpad/verify-whop.mjs` — checks every price against `pricing.ts`, every trial
SKU's initial/trial/renewal, and creates a real checkout session.

**Live verification result: all checks passed.** Session `ch_mscZV9snOHhzcgE` created, correct
`ch_…` format, metadata round-tripped.

---

## 2. The three defects (none had ever been exercised)

### 2.1 Dead API endpoints — first purchase would have 500'd
`POST /api/v5/checkout_sessions` and `GET /api/v5/memberships/:id` both answer **404**. v5 is
gone. → `/api/v1/checkout_configurations` (returns the `ch_…` id that
`<WhopCheckoutEmbed sessionId>` consumes) and `/api/v1/memberships/:id`.

The v1 membership shape also changed: `status` enum + `renewal_period_end` + nested `plan.id`,
where the code read `valid` + `expires_at` + flat `product_id`. Reading the old fields off the
new payload gives `valid === undefined` → **every paying customer marked cancelled**.
`past_due` now KEEPS the tier (matching the webhook path) so a card needing one retry doesn't
lock someone out mid-month.

### 2.2 Wrong webhook headers — customer pays, gets nothing
Whop signs with **Standard Webhooks**: `webhook-id` / `webhook-timestamp` / `webhook-signature`.
The verifier read `svix-*` only, so all three resolved to `""` and **every webhook 401'd**.
The signing *construction* was always correct (Standard Webhooks is the spec Svix donated), so
only the header names changed; `svix-*` kept as fallback. Proven: the pre-fix implementation
returns `false` against real Whop headers.

### 2.3 Event names — and the docs are WRONG
See §3. This one bit twice.

### Why it all hid for months
The checkout test **stubbed `fetch` wholesale and asserted only the request BODY, never the
URL.** A mocked transport proves a call's *shape*, not its *destination* — so a 404 endpoint
stayed green indefinitely. The webhook verifier had **no test file at all**.
Both are now covered; the URL is pinned; the new verifier tests were confirmed to FAIL against
the pre-fix code before being committed. See `green-test-is-the-accomplice`.

---

## 3. ⚠️ Whop's docs contradict Whop's API — trust the API

`docs.whop.com` publishes `membership.activated` / `membership.deactivated`. **The webhook
endpoint rejects both**, on *every* `api_version`:

```
POST /webhooks {"events":["membership_activated"]}
  → "Events membership.activated is not a valid event"
```

The only accepted membership/payment events are:

```
membership_went_valid   membership_went_invalid   payment_failed
```

`invoice_past_due` is rejected too.

**I got this wrong mid-session.** Trusting the docs, I renamed the handler's cases to the
documented names — i.e. I "fixed" the *correct* original names into broken ones. It caused no
damage only because I had kept the old names as aliases. Reverted in `08833d7a`.

Two further inconsistencies, both observed live:
- the API accepts **only underscored** names, echoes them back underscored — yet stored them
  **mixed** in one array: `["membership_went_valid","membership_went_invalid","payment.failed"]`
- the historical *payload* spelling is **dotted**, and the classic payload carries the name
  under **`action`**, not `event`

`normalizeEventName()` therefore reads `event` OR `action` and folds the **first** underscore
only (so `membership_cancel_at_period_end_changed` doesn't become a string of dots). 7 tests
pin all four spellings onto one case.

> **Do not "modernise" these names from the docs without re-probing the API.**

---

## 4. Vercel

- **`numenmachines.com` added** to project `virtuna-v1.1`. Registrar: **Namecheap**.
- **All 8 Whop env vars set** (Production) + `NEXT_PUBLIC_APP_URL=https://numenmachines.com`.
- **Fixed:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` held **literal
  trailing newlines** inside their values. Re-set clean. Side effect: re-adding via CLI marks
  them *sensitive*, so they no longer read back via API — values were verified before writing
  (URL 40 chars, anon key 208). Confirm from the served bundle after the first deploy.
- **Migrations: nothing pending.** Prod's latest is `20260723090753 thread_sim_seals`, matching
  the newest local file.
- **Prod build pre-flight: exit 0** — the ~5 weeks / ~50 PRs of unshipped code compiles.

### Build cost — resolved by another session
Git was disconnected **on purpose** (every push across ~8 worktrees triggered a build; the
`.githooks/post-commit` auto-push was the multiplier). During this session another session
landed an `ignoreCommand` build gate on main (`e534cd08`). Reconnecting is now safe *because*
that gate exists. Note `git.deploymentEnabled` **cannot** express "only main" — unspecified
branches default to `true`.

---

## 5. What is still owner-gated

1. **Namecheap DNS** — currently resolves to `162.213.255.22` (Namecheap parking). See §6.
2. **Whop payout onboarding (KYC)** — plans exist, but Whop won't settle money without bank +
   tax + identity.
3. **Supabase** — Site URL + redirect URLs + custom SMTP. See §7.

---

## 6. Namecheap DNS — exact steps

1. namecheap.com → **Domain List** → `numenmachines.com` → **Manage**
2. **Advanced DNS** tab
3. Under **Host Records**, delete any existing `A`/`ALIAS`/`CNAME` on `@` or `www`
   (a fresh Namecheap domain ships with a `CNAME www → parkingpage.namecheap.com` and a
   URL-redirect record — both must go)
4. **Add New Record** ×2:

   | Type | Host | Value | TTL |
   |---|---|---|---|
   | A Record | `@` | `76.76.21.21` | Automatic |
   | CNAME Record | `www` | `cname.vercel-dns.com.` | Automatic |

5. Save. Propagation is usually minutes.

**Leave the nameservers on Namecheap BasicDNS.** Vercel shows `ns1/ns2.vercel-dns.com` as
"intended" — that is the alternative full-delegation path, not required. The two records above
are enough, and keeping Namecheap DNS avoids moving any email/other records.

Verify: `dig +short numenmachines.com A` → `76.76.21.21` (not `162.213.255.22`).

---

## 7. Supabase — exact steps

> ⛔ **Never run `supabase config push` on this project.** `supabase/config.toml` has
> `site_url = "http://127.0.0.1:3000"` and a 2/hour email cap; pushing it would apply the whole
> `[auth]` block to prod. Use the **dashboard** (or the Management API). See
> `supabase-config-push-hazard`.

Project `qyxvxleheckijapurisj` → dashboard → **Authentication**:

1. **URL Configuration**
   - **Site URL** → `https://numenmachines.com`
   - **Redirect URLs** → add:
     - `https://numenmachines.com/auth/callback`
     - `https://www.numenmachines.com/auth/callback`
     - `http://localhost:3000/auth/callback` (keep for local dev)
2. **Providers → Email**
   - **Leaked password protection** → ON (advisor currently flags it off)
   - **Minimum password length** → `8` (forms already enforce 8 client-side; config.toml still says 6)
3. **SMTP Settings** — ⚠️ **launch blocker.** Default Supabase SMTP caps at **~2 emails/hour**.
   With payments live, signup confirmations and password resets would silently fail. Set up
   Resend or Postmark (~10 min), then set sender name/address.
4. **Providers → Google** — confirm the prod client id/secret and that
   `https://numenmachines.com/auth/callback` is registered in Google Console.

---

## 8. Then, in order

1. DNS resolves → Vercel auto-verifies the domain
2. **Deploy** (`vercel --prod`) — ships ~5 weeks of backlog **and** the Whop fixes **and** bakes
   `NEXT_PUBLIC_APP_URL` in. Keep `NEXT_PUBLIC_AMBIENT_V2` unset for this deploy; the flag flip
   is a **separate** deploy so a regression has one suspect.
3. Confirm the served bundle carries the right Supabase URL (see §4)
4. **Sandbox pass** — this is what finally settles the one remaining unknown (§9)
5. Only then flip `BILLING_ENFORCE_QUOTA=true`

---

## 9. ⚠️ The one thing still unverified

**The webhook payload's own shape** — whether the event arrives under `event` or `action`, and
how the plan id is nested — cannot be determined without a real purchase. Whop's docs have
already been wrong twice this session, so it is not worth guessing from them.

Mitigation, not assumption:
- `skuIdOf` reads `plan.id → plan_id → product.id → product_id`
- an unmatched SKU logs **ERROR** with the sku and payload keys (never a silent `free` grant)
- an unrecognised event logs **WARN** with the raw spelling and payload keys

So the **first sandbox event reports the truth** instead of failing silently. Watch the logs on
the first `$1` purchase and confirm before flipping enforcement.

Remaining sandbox checklist is `docs/PRICING.md` §5.
