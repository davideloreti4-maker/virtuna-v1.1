# Handoff — onboarding funnel milestone (2026-07-24)

**Worktree:** `~/virtuna-onboarding` · **Branch:** `milestone/onboarding` · **Base:** `main@99c494d1`
**Tip:** `4abbfb73` · pushed to `origin/milestone/onboarding` · **NOT merged (deliberate — see §5)**
**Suite:** 4476 passed / 0 failed · **tsc:** 0 · **eslint:** 0

> **Session 2 (2026-07-24) changed the design.** Read `ONBOARDING-FUNNEL-DESIGN.md` **§0a** first —
> it holds three owner calls that SUPERSEDE §4/§7 of that doc: payment now runs **before** identity,
> the wall **reveals beat 1 in full** before withholding beat 2, and the 3-day trial is confirmed
> (with its consequence designed around). **S1 is built** (§3a). The Supabase blocker is **cleared**.

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

## 3a. What is BUILT (S1) — the walkthrough, verified in a browser

- `components/offer/walkthrough/` — the shell drives the **real `AmbientDetail`** from a frozen
  fixture. Four beats, one lit affordance each (`beats.ts`, data not control flow, so the rail is
  testable without rendering and A/B-able without a component edit). Mounted on `/go` under the hero.
- **The seal is DATA, not a view flag.** `sealTemplate` strips the fix, the diagnosis and the
  audience score out of the template, so the real component renders its own honest unavailable
  states. Verified live: the sealed copy is absent from the DOM at the wall. No blur anywhere.
- `lib/analytics/funnel-events.ts` — the §8 event spine. **No sink yet**; `track()` buffers and logs
  in dev. The call sites are the expensive part to retrofit, so they ship now.
- 🔴 The fixture is **placeholder data**. `WALKTHROUGH_IS_PLACEHOLDER` hard-blocks the mount in
  production and a test pins the flag armed — invented numbers on a commercial page are fabricated
  proof (design §4).

> Two defects came out of driving it in a real browser, not out of the tests, and both were fixed in
> `AmbientDetail` itself: absent `population` said **"no run yet"**, which made the *locked* product
> read as a *broken* one (now `populationNote`, mirroring `brainNote`); and the back button rendered
> with no `onBack` — a dead control that was also an exit from the guided rail.

## 4. Blocked on the owner

1. ✅ **DONE — Supabase OTP templates are live in production.** Patched 2026-07-24 via the Management
   API and verified: both `confirmation` and `magic_link` render `{{ .Token }}`, neither contains
   `{{ .ConfirmationURL }}`.
   ⛔ **Do NOT run `npx supabase config push` on this project.** It pushes the whole `[auth]` block,
   and `config.toml` is still the local-dev scaffold — it would set `site_url` to `127.0.0.1`, wipe
   the redirect allow-list, and cap auth email at 2/hour. Patch the Management API instead.
2. 🔴 **Whop does not exist yet** — `/api/whop/checkout` returns **503** by design (`route.ts:63`
   refuses rather than granting an unbilled pass). **The funnel's only conversion point.** Full
   owner-executable checklist, incl. the three questions Whop has to answer before S2:
   **`docs/WHOP-SETUP.md`**.
3. 🔴 **Prod auth config drift**, found while patching the templates. Not changed — each is an owner
   call with production blast radius:
   - `rate_limit_email_sent = 2` — two auth emails **per hour**, project-wide. This will kill the OTP
     funnel on contact with traffic. Needs custom SMTP; the built-in sender is capped regardless.
   - `site_url = http://localhost:3000` and a localhost-only `uri_allow_list`. **Unverified** whether
     prod OAuth/password-reset currently break — check before assuming either way.
   - `mailer_autoconfirm = true`, which contradicts the design's premise that email/password signup
     dead-ends on a confirmation email. That premise may be stale.
4. **Real-device pass**, after 2: open the link from a TikTok bio on iOS + Android and run OTP +
   checkout inside the in-app browser.

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

1. **Whop products + keys** — `docs/WHOP-SETUP.md`. Longest lead time, and nothing downstream of the
   wall can be built or measured until checkout exists. Start here.
2. **Freeze the demo analysis.** `/api/analyze` accepts `input_mode: "tiktok_url"` (`route.ts:482`).
   Run it through the REAL route as the owner so the frozen fixture comes from exactly the production
   code path. Costs 10 credits (`score`). Then extract keyframe stills to `/public`, paste the result
   into `walkthrough-fixture.ts`, and flip `WALKTHROUGH_IS_PLACEHOLDER` — in the same commit as the
   test that pins it.
3. **S2 — rewired for payment-first** (design §0a ①). This is no longer "OTP then checkout":
   - lift the 401 in `api/whop/checkout/route.ts:10` for the funnel path;
   - send an anonymous correlation id in `metadata` instead of `supabase_user_id`, which does not
     exist yet at checkout;
   - **the webhook must PROVISION the Supabase user** from the payment email. The known "paid, no
     access" hazard (§7) is now the primary path, not an edge case — it has to be correct;
   - then OTP, to claim the account, after the fix has been revealed.
   Branch presentation on the existing `isInAppBrowser`: embed on real browsers, **full-page hosted
   checkout inside webviews**, which makes the webview question moot rather than merely answering it.
   ⚠️ Unknown: whether Whop's v5 `checkout_sessions` response carries a hosted purchase URL. The route
   keeps only `checkoutConfigId` (`route.ts:110`). Check the moment credentials exist.
4. **Wire a sink to the funnel events** (`lib/analytics/funnel-events.ts`). Use `sendBeacon` — this
   traffic is mobile webviews, and a `fetch` in flight when the page is backgrounded is a lost event.
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
