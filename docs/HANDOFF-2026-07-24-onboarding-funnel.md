# Handoff — onboarding funnel milestone (2026-07-24)

**Worktree:** `~/virtuna-onboarding` · **Branch:** `milestone/onboarding` · **Base:** `main@99c494d1`
**Tip:** `bee79e60` · 10 commits · pushed to `origin/milestone/onboarding` · **NOT merged (deliberate — see §5)**
**Suite:** 4453 passed / 0 failed (404 files) · **tsc:** 0 errors

**SSOT for the design:** `docs/ONBOARDING-FUNNEL-DESIGN.md` — read it first, it is the contract.
**Setup blocker doc:** `docs/OTP-EMAIL-TEMPLATE-SETUP.md`

---

## 1. What this milestone is

Replace the inert one-field `/welcome` with a conversion-optimized funnel. Traced state on `main`:
every offer CTA → bare `/signup` → **email-confirm wall** → `/login` → `/welcome` (one text field
writing an **inert** TikTok handle, plus "Skip for now") → `/home`. The $1 promised on `/go` is never
collected; the moat (`/api/audiences/calibrate`) is not in the funnel at all.

## 2. Owner calls locked this session

| Decision | Detail |
|---|---|
| **Pay first** | $1 collected **before** any personal engine run |
| **Demo** | Interactive walkthrough of the **real Ambient v2 surface**, prefabricated data. **No live video, no engine call, zero network after load.** |
| **Teaser paywall** | Results are **never fully shown**. The wall sits INSIDE the insight: SHOW where they leave ("0:04") + that a fix exists + craft score. LOCK the **why**, the fix, the audience-specific score. |
| **Unlock order** | On payment, reveal the withheld fix **first** (close the loop they paid for), *then* ask for their handle. |
| **Traffic** | Organic TikTok/IG only, **no paid ads** → the funnel runs in in-app webviews |
| **One conversion** | The plan auto-renews. Nobody is sold twice. The 72h is a *retention* problem ("give them no reason to cancel"), not a second campaign. |
| **Surface** | Built on Ambient v2 Start (`NEXT_PUBLIC_AMBIENT_V2`) |
| **Demo video** | Alex Hormozi, public, "for now" (swappable): `https://www.tiktok.com/@ahormozi/video/7602332913333472525` |

## 3. What is BUILT (S0) — code-complete, **not yet functional**

- `src/lib/auth/in-app-browser.ts` — webview UA detection. TikTok (4 shipped signatures incl. the
  `trill_…` form), Meta, Snapchat, LinkedIn, Pinterest, X, WeChat, Line + generic Android `; wv)`.
  Fails **open** on a missing UA. 15 tests pin real UA strings.
- `src/lib/auth/otp.ts` — `sendOtp` / `verifyOtp`, customer-facing error mapping,
  `shouldCreateUser: true` so ONE call covers signup and login (never make a visitor choose which
  they are — that is a fork at peak intent).
- `src/components/auth/email-otp-form.tsx` — two stages, one surface. `autocomplete="one-time-code"`,
  numeric keypad, auto-submit on the 6th digit, resend cooldown.
- `src/app/(onboarding)/login/login-form.tsx` — OTP is the front door; Google renders **only** where
  Google accepts it; password folded behind a disclosure.
- `supabase/templates/otp-*.html` + `config.toml` — templates version-controlled.

> A test caught a real bug pre-merge: `/\btrill\b/` cannot match TikTok's actual
> `trill_2022905030` because `_` is a word character, so the closing boundary never fires.

## 4. 🔴 Blocked on the owner — nothing downstream works until these land

1. **Push the Supabase email templates.** `signInWithOtp` sends **Confirm signup** to NEW addresses
   (≈ all cold traffic) and **Magic Link** to known ones. Both must render `{{ .Token }}`.
   ```bash
   npx supabase login && npx supabase link --project-ref qyxvxleheckijapurisj && npx supabase config push
   ```
   Fallbacks (dashboard, Management API curl) in `docs/OTP-EMAIL-TEMPLATE-SETUP.md`.
2. **Custom SMTP.** Supabase's built-in sender allows a few emails/hour. Real traffic will hit
   "too many codes requested" — surfaced honestly by `otp.ts`, but it still costs the conversion.
3. **Whop does not exist yet.** `WHOP_API_KEY`, `WHOP_PRODUCT_ID_*`, `WHOP_TRIAL_PLAN_ID_*` are unset
   in trunk AND worktree, so `/api/whop/checkout` returns **503** by design (`route.ts:63` refuses
   rather than granting an unbilled pass). Needs: 3 products, the $1/3-day trial SKUs, API key,
   webhook secret. **The funnel's only conversion point does not exist until this is done.**
4. **Real-device pass**, after 1 and 3: open the link from a TikTok bio on iOS + Android, and run
   OTP + checkout inside the in-app browser.

## 5. ⚠️ Why this is NOT merged to main

`login-form.tsx` now leads with OTP. **Until the templates are pushed, `signInWithOtp` emails a magic
LINK, while the UI asks for a 6-digit code that does not exist in the email.** Merging to `main`
auto-deploys to Vercel and would degrade sign-in for existing users (password still reachable, but
behind a disclosure). Sequence must be:

```
templates pushed  →  verified on a real device  →  THEN merge
```

Merge command when green:
```bash
cd ~/virtuna-v1.1 && git switch main && git merge --no-ff milestone/onboarding
```

## 6. Next actions, in order

1. **S1 — the walkthrough shell.** Buildable NOW against `detail-live-fixture.ts` placeholder data:
   lock/reveal mechanics, guided-rail sequencing, 390px-first layout. The fixture contract is already
   the right shape, so swapping in the real Hormozi analysis is a data change, not a rewrite.
2. **Freeze the Hormozi analysis.** `/api/analyze` accepts `input_mode: "tiktok_url"` (`route.ts:482`).
   Preferred path: dev server + run it through the REAL route as the owner, so the frozen fixture
   comes from exactly the production code path. Costs 10 credits (`score`). Then extract keyframe
   stills to `/public`.
3. **S2** — OTP-first identity → Whop checkout inline. When keys exist, branch presentation on the
   existing `isInAppBrowser`: `WhopCheckoutEmbed` on real browsers, **full-page hosted checkout inside
   webviews** (same session, same cookies, returns via `redirect_url`) — that makes the webview
   question moot instead of merely answering it.
   ⚠️ Unknown: whether Whop's v5 `checkout_sessions` response carries a hosted purchase URL. The route
   currently keeps only `checkoutConfigId` (`route.ts:110`). Check the moment credentials exist.
4. **S3** — delete `/welcome` outright, incl. the middleware bounce (`middleware.ts:167`); checkout
   lands in Ambient v2 Start.
5. **S4** — first real actions: room calibrates in the rail (visible labor) → their video → the gap
   → the intention prompt. ≤12 of the 50 trial credits.

## 7. Known hazards carried forward

- **Webhook silently drops a grant** if `metadata.supabase_user_id` is missing
  (`api/webhooks/whop/route.ts:62` warns only). Today theoretical; once money flows it is
  "paid, no access." Harden in this milestone.
- **Calibration failure after payment** is a **recovery ladder, never a refund** — the purchase is
  still good (3 days, 50 credits). Retry → private-account prompt → General-population fallback.
- **Dev server** must launch with `NEXT_PUBLIC_AMBIENT_V2=true` (nohup, not setsid — absent on macOS).
  Verify the flag behaviourally, not via `ps`.
- **Tests:** `npm test` is a fake script here. Use `node ./node_modules/vitest/vitest.mjs run`.
- **Third-party content:** the demo publicly tears down a named creator's video on a commercial page.
  Keep it analytical, no implied endorsement, keep fixtures swappable.
