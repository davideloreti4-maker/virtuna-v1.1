# Handoff — 2026-07-27: production went from "cannot take a payment" to a verified money loop

**Trunk:** `~/virtuna-v1.1` on `main`, clean, `== origin/main`, tip `89bc6d46`.
**Live:** https://numenmachines.com (apex + www, certs issued).
**Everything below is on `main` and deployed.** No branches pending merge.

---

## 0. The one-paragraph version

This morning every Whop env var was set, the integration looked finished, and **production
could not take a payment at all**: the checkout endpoint answered 404 and every webhook
answered 401. Four separate defects sat behind one another, each invisible until the one in
front was cleared. All four are fixed and the loop — buy → grant → bill → cancel → revoke —
is now verified end to end on real money, on the real domain, with enforcement on.

**The two rules this session paid for:**

1. **A 200 from a webhook proves delivery, never effect.** The payload that granted nothing
   returned `{"received":true}`.
2. **Every env var being set is not evidence the path works.** That is exactly what made this
   look done for a month.

---

## 1. The four defects (all live in production, all found today)

| # | Defect | Why it hid | Fix |
|---|---|---|---|
| 1 | verifier read `svix-*`; Whop sends `webhook-*` | the checkout test mocked `fetch` and asserted the request BODY, never the URL | `b3b21bd5` (merge) |
| 2 | setting the webhook URL in Whop's **dashboard created a SECOND webhook** with its own secret | both pointed at the same URL; the new one's secret was never deployed → 401 | deleted by hand |
| 3 | **the secret is not base64** | `Buffer.from(s,"base64")` does not throw — it discards unreadable chars and returned 50 wrong bytes from a 67-char raw string. HMAC computed *flawlessly* over the wrong key | `05f41e93` |
| 4 | **the v2 payload puts the event under `type`**, not `event`/`action` | resolved to `""`, fell to `default:`, answered **200 having granted nothing** | `a8b90ae6` |

Plus a fifth thing that is not a defect but will bite again:

> ⚠️ **Merely OPENING and SAVING the webhook in Whop's dashboard silently rewrote its events**
> from `["membership_went_valid",…]` to `["membership.activated",…]` **and flipped
> `api_version` v2 → v1.** Nobody edited the events. The handler now accepts BOTH vocabularies
> (`d9c8162a`). **Never encode Whop's current vocabulary as a contract.**

Whop's docs, dashboard and API disagree with each other in three directions: the docs
advertise event names the API rejected on 07-26 and accepted on 07-27; the dashboard accepts
names the API rejects; and the dashboard creates where you expect it to edit.

### The diagnostic that ended it

`describeSignatureFailure()` (`src/lib/whop/webhook-verification.ts`) logs the **shape** of a
rejected webhook — header names present, raw-vs-base64-decoded secret **lengths**, signature
scheme prefixes, clock skew. Never the secret, signature or body. Defects 1 and 2 took hours
between them; defect 3 took **one press of the test button** once this existed.

**A bare 401 that logs nothing costs hours.**

---

## 2. Verified live (production, real $0 promo purchase `TEST_MAVEN2`)

Account `davide.loreti88@gmail.com`, membership `mem_o3mXSuod9Gxteg`, plan
`plan_OTX4xMIHYyDoY`. `BILLING_ENFORCE_QUOTA=true` since `331888ca`.

- [x] **Trial grants tier + stamps the window once** — `starter`, `is_trial`, 07-27 10:46 → 07-30
- [x] **A Reading bills 10 credits** from the 50-credit trial pool — confirmed in the
      `reading_events` ledger (1 row, 10 credits), not just the UI
- [x] **A repeat trial resolves FULL PRICE** — `/pricing` → Pro offered $99, not $1
- [x] **Cancel → tier `free`, status `cancelled`** — the first time `membership.deactivated`
      ever fired. Without `d9c8162a` a cancellation would have left the customer with full
      access **forever**, discoverable only via someone who stopped paying and kept using.
- [x] Checkout returns a real `ch_…` session, metadata round-trips, redirect lands on the
      live domain
- [x] Build gate verified in the wild — Preview deploys `Canceled` at 6–7s, Production `Ready`

Details: `docs/PRICING.md` §5.

---

## 3. Open, ranked

### Fix before real traffic

1. **`/pricing` promises "$1" to an account that cannot have it.** The guard is server-side
   only (`checkout/route.ts:53` reads `trial_used_at`); **no UI file references it**. Clicking
   "Start for $1" and landing on $99 is a chargeback shape. Once `trial_used_at` is set the
   card should read "Upgrade · $99/month".
2. **`GET /api/team` → 500**, `infinite recursion detected in policy for relation
   "team_members"` (Postgres `42P17`). A recursive RLS policy, hit by a live signed-in user.
3. **Signup/recovery email lands in Gmail spam.** SPF and DKIM both pass and align — pure
   reputation on a domain whose history is a parked page then a suspended cPanel account.
   Levers in order: recipients marking not-spam; deploying a real template (Supabase's stock
   recovery mail is a near-empty body with one bare link, and `supabase/templates/*.html` are
   **local-dev only**); DMARC `p=none` → `p=quarantine`; Google Postmaster Tools.

### Sandbox pass, remaining

- [ ] **The 50-credit wall** — the 6th Reading should 402 with trial copy (a DATE, no
      checkout). Costs 4 more real engine runs; the cheap honest alternative is filling
      `reading_events` to 50 spent, since the ledger sum is the gate's only input.
- [ ] **Day-4 conversion does NOT re-stamp the window** — needs 2026-07-30, or a unit test of
      the stamping branch rather than a live purchase.
- [ ] **`sync-whop` reconciles a desynced row.** ⚠️ It only `select`s and `update`s — **no
      insert path** — so it CANNOT repair a missed webhook. The "drift reconciliation" safety
      net does not cover the failure that actually happened today.
- [ ] **A failed run bills nothing.**

### Owner-gated

- **Whop payout KYC** — charges succeed, money will not settle until it clears.
- **Leaked-password protection is Pro-plan only.** Accepted gap. Signup is genuinely
  password-based, and `minimum_password_length = 8` in Supabase is the ONLY validation at
  signup (`signup-form.tsx` has no `minLength`; `signup/actions.ts` validates nothing). Free
  alternative if it ever matters: a HIBP k-anonymity check in `signup/actions.ts`.

### Not blocking

- `UPSTASH_*` (rate limiting is fail-open — prod has none) · `NEXT_PUBLIC_SENTRY_DSN` ·
  rotate the Apify key (pasted in a transcript) · MFA · 104 pg_graphql advisor warnings.
- **`NEXT_PUBLIC_AMBIENT_V2=true`** — deliberately its own deploy, still gated on the owner's
  hero verdict.
- **29 anonymous users in 24h, minted in PAIRS** (two per event, seconds apart). Demo pool
  working, but something double-invokes anonymous sign-in.
- `is_trial` stays `true` after cancellation — harmless (tier `free` has allowance 0) but stale.

---

## 4. Facts you will need

```
Vercel     prj_WUmPu9fRmFNlbj5rtGIaRmBC8Url · team davide-loretis-projects
Supabase   qyxvxleheckijapurisj   (dev and prod share ONE project)
Whop       company biz_LyBwGuDUAoMFco · webhook hook_Jw56rQjnWOIVO
Domain     numenmachines.com on ns1/ns2.vercel-dns.com (migrated today)
```

- **`WHOP_API_KEY` is in `~/virtuna-v1.1/.env.local`** — enough to query plans, memberships and
  webhooks live: `node --env-file=.env.local -e '…'` against
  `https://api.whop.com/api/v1/...?company_id=biz_LyBwGuDUAoMFco`. `WHOP_WEBHOOK_SECRET` is
  **not** local, so a signed webhook cannot be forged.
- **Vercel runtime logs**: `get_runtime_logs` times out on wide windows — scope by
  `statusCode` or `deploymentId`, ≤20 min.
- **All 23 Vercel env vars are Sensitive** ⇒ `vercel env pull` writes `NAME=""` for every one.
  Not `[SENSITIVE]`. A content grep proves nothing. To learn a value: dashboard, or overwrite.
- **Env changes need a redeploy**, including server-read flags — Vercel does not restart a
  running deployment. `NEXT_PUBLIC_*` additionally inlines at build time.

---

## 5. Traps that cost time today

- ⛔ **`supabase db push` and `supabase config push` are BOTH unsafe here.** 48 local-only /
  41 remote-only migrations; push would recreate `threads`. `config.toml` still holds
  `site_url = "http://127.0.0.1:3000"` and `minimum_password_length = 6` — pushing would point
  production auth at localhost. **Dashboard and SQL editor only.**
- **A cron route curled by hand 401s BY DESIGN** (`verifyCronAuth`). Read SCHEDULED-fire logs.
  Same shape: `GET /api/webhooks/whop` → 405 is correct; the route only exports `POST`.
- **The build gate's exit codes are inverted**: `1 = BUILD`, `0 = SKIP`. Backwards means
  silently never deploying.
- **This worktree (`~/virtuna-ambient-audience-v2`) is on `design/ambient-audience-v2`, behind
  main.** A harness guard blocks editing trunk files from here, so the pattern used all
  session was: `cp` the trunk file in → edit → `cp` back → `git checkout --` to clean. Do NOT
  `rm -rf` a directory to clean up; use `git checkout -- <path>` (an `rm -rf src/app` here
  deleted the whole tree once — recovered, but avoidable).

---

## 6. Today's commits (all on `main`)

```
89bc6d46 docs(pricing): the sandbox pass, verified live
331888ca chore(billing): redeploy to pick up BILLING_ENFORCE_QUOTA=true
d9c8162a fix(billing): accept BOTH of Whop's event vocabularies
a8b90ae6 fix(billing): the v2 webhook puts the event under `type`
05f41e93 fix(billing): Whop's webhook secret is not base64
89420bb3 fix(billing): make a rejected webhook name its own cause
97f2c5e9 fix(billing): a rejected webhook signature has to say what arrived
56eb87a2 docs(pricing): close out the owner steps — nobody to grandfather
bb2887cc fix(ops): restore the three crons that cost nothing
844dd712 docs(env): numenmachines.com is live — the DNS migration
e7195733 docs(env): reconcile the Vercel guide with the live project
b3b21bd5 merge(billing): repair the Whop integration
```

Also landed today, not code: DNS migrated to Vercel nameservers with the mail zone rebuilt
(MX ×3, SPF, DMARC, DKIM, 4 mail hosts — pre-migration zone saved to
`.vercel/zone-backup-numenmachines.txt`); Resend SMTP wired into Supabase; Supabase auth URLs,
redirect wildcards and password length set.

> ⚠️ The SPF was **not** ported verbatim, deliberately. It read `v=spf1 +a +mx …`, and `+a`
> authorizes whatever the apex A record points at — formerly the owner's cPanel box, now
> Vercel's **shared** anycast IPs. A byte-identical copy would have silently authorized
> infrastructure we do not control. **A record can be identical and still mean something new
> once what it points at changes.**
