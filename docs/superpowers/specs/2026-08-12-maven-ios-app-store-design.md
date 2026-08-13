# Maven on the iOS App Store — design

**Date:** 2026-08-12
**Status:** approved design, not yet implemented
**Goal:** submit v1 to the App Store, with web-layer updates that ship without resubmission, and Whop as the payment rail.

---

## 1. What this is

Maven is a server-rendered Next.js 16 app (RSC, server actions, API routes) on Vercel, with
Supabase auth and Whop billing already wired end-to-end on the web. This design puts that same
app on the App Store inside a native shell, without forking the codebase and without a rewrite.

Two constraints drove every decision:

1. **Updates must ship without App Store review.** The shell loads the live site, so a deploy
   *is* an update. This is not a feature we build; it is a property of the architecture — which
   is exactly why §2 is the first section.
2. **Whop is the payment rail.** v1 links out to Whop's web checkout (US storefront only).
   v1.1 replaces that with Whop's native iOS SDK and widens availability worldwide.

---

## 2. The precondition: deploys must work

**Measured 2026-08-12.** The last production deployment is `dpl_GrPEwroc…`, commit
`1be28832` (PR #455), **2026-08-07T21:48Z**. `main` is at `89e84daf` and is **134 commits
ahead**. Merges on 08-10 and 08-11 (PRs #465–#471) produced no deployment at all.

This is the load-bearing risk in the whole project. The native shell renders whatever the
server serves. If `merge → deploy` does not fire, the App Store app is frozen at August 7th's
code and the "instant updates" property silently does not exist. Nothing downstream of this is
worth building until a production deployment carrying `main`'s HEAD sha is verified live.

**Do not read the CANCELED deployments as failures.** `vercel.json` sets:

```
"ignoreCommand": "[ \"$VERCEL_ENV\" = \"production\" ] && exit 1 || exit 0"
```

`exit 1` means build, `exit 0` means skip — so **previews are skipped by design** and only
production builds. Two consequences:

- The CANCELED previews in the deployment list are expected, not evidence of breakage. The
  evidence of breakage is the *absence* of production deployments after 08-07.
- The catch-up preview in §9 must bypass this ignore command, or it will "succeed" without
  building. This is the documented trap: a green Vercel check is not a build.

### 2.1 New Vercel account

The owner is moving to a new Vercel account. The project must be recreated there, which means:

- **~60 runtime environment variables** must be re-added. Full list in Appendix A.
- Values cannot be read back from the old project — Vercel env vars are write-only once marked
  sensitive. Recover them from local `.env.local`, or regenerate from each provider's dashboard
  (Supabase, Whop, Apify, Upstash, DashScope, Sentry).
- `vercel.json` carries the cron definitions, so those follow the repo. The `CRON_SECRET` does
  not.
- `numenmachines.com` moves to the new account and must be aliased to production.
- **A changed env var needs a redeploy to take effect.** Set them all before the first
  production build, not after.

### 2.2 Domain

`numenmachines.com` currently returns `x-vercel-error: DEPLOYMENT_NOT_FOUND` — the domain is
attached to the project but aliased to no deployment. This is a dashboard fix, not DNS.

`virtuna.ai` — which `src/app/layout.tsx:31` sets as `metadataBase` — does not resolve at all.
That value is stale and must be corrected to whatever domain v1 ships on, because it also
generates the OpenGraph URLs.

**The decided domain is `www.numenmachines.com`** (confirmed 2026-08-12). The `www.` is
load-bearing and must be used consistently everywhere below, because a Supabase auth cookie set
on `www.numenmachines.com` is **not** sent to the apex `numenmachines.com`. A user who lands on
the wrong host is silently signed out. Attach both hosts in Vercel and 301 the apex to `www` so
there is exactly one origin that can ever hold a session.

Every one of these keys off it and must be updated together:

| Consumer | Where |
| --- | --- |
| Shell URL | `capacitor.config.ts` → `server.url` |
| OG / canonical | `layout.tsx` `metadataBase` |
| OAuth redirect allow-list | Supabase dashboard → URL configuration |
| Whop redirect | Whop dashboard → plan redirect URLs |
| Privacy / support URL | App Store Connect |
| Associated domains | `apple-app-site-association` at the domain root |

---

## 3. Architecture

### 3.1 Shell

Capacitor 8, iOS only for v1. Capacitor 8 generates SPM projects by default; CocoaPods is in
maintenance and its trunk closes 2026-12-02. This matters concretely here: the machine has no
CocoaPods and only system Ruby 2.6, so the SPM default removes what would otherwise be the
first hour of toolchain work.

```ts
// capacitor.config.ts
const config: CapacitorConfig = {
  appId: 'com.numenmachines.maven',
  appName: 'Maven',
  webDir: 'native/public',          // minimal local fallback, see §3.3
  server: {
    url: 'https://www.numenmachines.com',
    cleartext: false,
  },
  ios: {
    appendUserAgent: 'MavenIOS/1',
  },
};
```

`appendUserAgent` does two jobs, and both are required:

1. It is the documented workaround for the Capacitor defect where `window.Capacitor` is
   `undefined` on a remote origin (ionic-team/capacitor#7269). Without it, every native plugin
   call from the web layer fails silently — which would take the entire §4 native surface with
   it.
2. It is how the Next.js app detects native context. Because it lands in the request
   `User-Agent`, server components can read it and render app-only affordances without a
   client-side round trip.

**Known caveat, stated plainly:** Capacitor's own docs describe `server.url` as "not intended
for use in production." That is a support-scope statement from Ionic, not an Apple rule — but
it is the configuration that attracts guideline 4.2 and 4.7 scrutiny, and it is the reason §4
is not optional decoration.

### 3.2 Native detection in the web layer

One module, one export, used everywhere:

```ts
// src/lib/native/context.ts
export const NATIVE_UA_TOKEN = 'MavenIOS';
export function isNativeUserAgent(ua: string | null | undefined): boolean;
```

Server components read it from `headers()`. Client components read it from
`navigator.userAgent`. A single predicate keeps the two readings from drifting — the failure
mode otherwise is a surface that hides the Whop CTA on the server and renders it on the client,
which is a 3.1.1 rejection that only appears on the second paint.

### 3.3 Local fallback bundle

`webDir` points at a minimal local page — brand mark, "Can't reach Maven", retry button. It is
what the webview shows when the origin is unreachable at cold start, before any JS from the
server has run. Without it a launch with no network is a white screen, which reviewers do test.

This is distinct from `src/components/app/offline-notice.tsx`, which already handles going
offline *during* a session and is unchanged by this work.

### 3.4 Update model

| Change | Ships via |
| --- | --- |
| Anything in `src/` | Vercel deploy. Live immediately, no review. |
| Plugins, capabilities, `Info.plist`, icon, splash, `server.url` | New binary, App Store review. |

To keep the second row from ever becoming a silent breakage, the shell sends its version in the
UA (`MavenIOS/1`) and the web app reads it. If a future web release ever requires a newer shell,
it can render an "update Maven" notice to old binaries instead of failing. Cheap insurance,
written once, in §3.2's module.

---

## 4. Native surface — the guideline 4.2 defense

Apple rejects apps that are "simply a web app wrapper with no native iOS features." A remote-URL
Capacitor app is exactly the shape reviewers are trained to look for, so this list is the
substance of v1, not polish.

| Capability | Plugin | Why it earns its place |
| --- | --- | --- |
| Splash + icon | `@capacitor/splash-screen` | First impression; a default splash reads as unfinished. |
| Status bar | `@capacitor/status-bar` | Charcoal chrome to match `--color-charcoal-app`. |
| Safe areas | CSS | `viewport` in `layout.tsx` has no `viewportFit`. See §4.1. |
| Haptics | `@capacitor/haptics` | On send, on verdict arrival. Unmistakably native. |
| Share sheet | `@capacitor/share` | Sharing a verdict/idea to the system sheet. |
| In-app browser | `@capacitor/browser` | External links and the Whop checkout (§6). |
| Push | `@capacitor/push-notifications` | Registration + permission + token → Supabase. The single strongest "this is an app" signal. |
| Deep links | `@capacitor/app` | OAuth callback (§5) and future notification routing. |

Sending pushes is explicitly **out of scope for v1** — only registration, permission, and token
persistence. A reviewer sees the permission prompt; the send infrastructure can follow.

### 4.1 Safe areas

`src/app/layout.tsx:26` currently exports:

```ts
export const viewport: Viewport = { width: "device-width", initialScale: 1 };
```

It needs `viewportFit: "cover"`, and the chrome needs `env(safe-area-inset-*)` padding. The two
surfaces that will break without it are the composer dock — `absolute inset-x-0 bottom-0`
(`composer.tsx:3535`), which will sit under the home indicator — and the mobile nav band, whose
offset already threads through `--mobile-nav-band` declared inline on `<main>`
(`app-shell.tsx:172`).

Per the repo's standing rule, this is measured in a browser context opened natively at iPhone
size, not by resizing a loaded page, and not by projecting from the CSS.

---

## 5. Auth

### 5.1 The Google problem

`login-form.tsx:46` and `signup-form.tsx:26` both call `supabase.auth.signInWithOAuth({ provider: "google" })`.
Google refuses to render its consent screen inside an embedded webview
(`disallowed_useragent`), so **signup and login are both dead in the shell as written**.

The trap in the obvious fix: opening the flow in `SFSafariViewController` lets Google render,
but that browser does not share a cookie jar with the `WKWebView`. The session lands somewhere
the app cannot see, and the user is bounced back to a login screen that still says logged out.

The flow that works:

1. Native context detected → the Google button opens the Supabase OAuth URL via
   `@capacitor/browser`, with `redirectTo` set to a custom scheme (`maven://auth/callback`).
2. Google → Supabase → redirect to the custom scheme.
3. `@capacitor/app`'s `appUrlOpen` fires in the shell, which routes the code into the webview.
4. The web layer calls `exchangeCodeForSession(code)` **inside the webview**, so cookies land in
   the jar the app actually uses.

Requires: the scheme registered in `Info.plist`, and `maven://auth/callback` added to Supabase's
redirect allow-list. The existing `src/app/auth/callback/route.ts` stays the web path and is
untouched.

### 5.2 Sign in with Apple

Added for guideline 4.8. Whether it is strictly required is genuinely arguable — the guideline
demands an equivalent alternative when a third-party login is offered, and Supabase
email/password plausibly qualifies — but reviewers flag it often and a rejection costs a full
review cycle. It is cheap insurance next to that.

It is also the *easiest* of the three flows: the native plugin returns an identity token
directly to `supabase.auth.signInWithIdToken`, with no browser round-trip and none of §5.1's
cookie-jar problem.

Requires: Apple Developer → Service ID, Sign in with Apple capability, and a key; Supabase →
Apple provider enabled.

Email/password already works unchanged in the webview.

---

## 6. Payments

**v1: US storefront only, linking out to Whop's web checkout.**

The App Store availability is set to the United States. In native context, upgrade CTAs call the
existing `POST /api/whop/checkout` — unchanged — and open the returned URL with
`@capacitor/browser`. The Whop webhook already grants the tier; `use-subscription` refetches
when the browser closes.

No StoreKit, no IAP, no Paid Apps agreement in v1.

### 6.1 Why link-out and not a stripped-down app

The alternative considered was shipping worldwide with no purchase affordance at all. It was
rejected on three counts:

1. **It is more work, not less.** It requires a native variant of every upgrade surface —
   `credit-wall-listener.tsx`, `upgrade-banner.tsx`, `tier-gate.tsx`, `checkout-modal.tsx`,
   `feature-gate.tsx`, the `composer.tsx` funnel, `pricing-card.tsx`. Link-out is one function.
2. **It weakens the 4.2 story.** An app where the user hits a wall with no way past it reads
   thinner, not richer.
3. **The cost of US-only is close to zero here.** Measured 2026-08-12: 123 users, 2 subscription
   rows, **1 active subscription**. There is no installed base to strand.

### 6.2 The legal basis, and its expiry

Linking out is permitted on the US storefront under the Epic v. Apple injunction. The Ninth
Circuit largely upheld it in December 2025; Apple currently charges zero commission on
linked-out purchases. Apple has sought Supreme Court review and the final commission figure is
still before Judge Gonzalez Rogers.

So this is a decision with a shelf life, and it is sized accordingly: US-only is a one-to-two
week position, not the destination.

### 6.3 v1.1 — Whop's native iOS SDK

Whop ships an iOS Checkout SDK that routes to Whop's own processing in the US (2.7% + $0.30) and
falls back to Apple StoreKit everywhere else. That is the correct end state: globally compliant,
same commercial shape as v1, better conversion than a link-out.

It is **Swift-only** — no Capacitor, React Native, or web binding exists — so it needs a
Capacitor plugin wrapping `Checkout.shared`, plans mirrored as IAP products in App Store
Connect, and a completed Paid Apps agreement with banking and tax. That is why it is not in v1.
Shipping it is what unlocks worldwide availability.

---

## 7. Compliance work in the web app

These are App Store requirements that the product does not currently satisfy. All of them ship
through the web layer, which means they can land after the binary is uploaded — but they must be
live **before a reviewer opens the app**, not merely before submission. See §10.

### 7.1 `/privacy` and `/terms` do not exist

No route matches either. Apple requires a resolving privacy policy URL in App Store Connect and
a link inside the app. The content must genuinely describe what Maven collects — Supabase auth
data, TikTok handles and scraped public post metrics via Apify, prompts sent to model providers,
Sentry error telemetry — because the App Privacy nutrition labels have to agree with it.

### 7.2 Account deletion

`src/components/app/settings/account-section.tsx:139` reads *"Contact support to delete your
account."* Guideline 5.1.1(v) requires deletion to be initiable **in the app**. This is one of
the most reliably enforced rules in review and is an automatic rejection.

There is no route to build on — `src/app/api/settings/account/` contains only `password/`. This
needs a new endpoint that deletes the auth user via the service-role key and cascades the
owned rows, plus a confirmation dialog. Per the repo's standing trap, the real CHECK constraints
and foreign keys must be read before writing the cascade: a swallowed Supabase write stores
nothing and reports success.

### 7.3 Reviewer demo account

The app is gated behind auth and a credit wall, and `BILLING_ENFORCE_QUOTA` is `true` in
production with free tier at `limit:0`. A reviewer who signs up gets a wall and rejects under
2.1. App Store Connect needs demo credentials for an account with an active subscription and
usable credits.

Note this is a **real production account** on a shared Supabase project — the same caveat that
governs the e2e user. Its credits are real spend.

---

## 8. App Store Connect

| Item | Note |
| --- | --- |
| Bundle ID | `com.numenmachines.maven`, with Sign in with Apple + Push capabilities |
| Name / subtitle | "Maven"; subtitle from the existing positioning line |
| Screenshots | 6.9" (1320×2868) required. Captured on a native-sized context, per repo rule. |
| Privacy policy URL | §7.1, must resolve before review |
| Support URL | Must resolve |
| App Privacy labels | Must agree with §7.1 |
| Age rating | Questionnaire |
| Export compliance | HTTPS only → exempt declaration |
| Availability | **United States only** (§6) |
| Demo account | §7.3 |

---

## 9. Catching production up

`main` is 134 commits ahead of what production serves. Promoting that straight to production
under an App Store submission is the wrong order of operations: if prod breaks, the iOS app
breaks with it, and the shell gives no way to roll back independently.

So: build `main` as a preview on the new account, **bypassing the `ignoreCommand`** (§2), and
walk it signed-in — signup, home, composer, checkout — before promoting. The suite is large and
green, but per this repo's own standing rule a green suite proves less than a walk: ~5,200 tests
were green through a home thread whose view never scrolled.

Only after that walk passes does the shell get pointed at production.

---

## 10. Sequencing, and an honest read on "today"

The work is roughly 12–16 hours. Submitting today means the sequence below, and it means
accepting one specific gamble.

**What makes it plausible:** only the shell has to be in the binary. Everything in §7 ships
through the web layer while Apple queues.

**What the gamble is:** review typically starts hours after submission, not immediately — but if
a reviewer opens the app before §7 is live, it is a rejection and a lost cycle. This is a real
risk being taken knowingly, not a safe optimisation.

Order:

1. **New Vercel account, env vars, domain, deploys verified** (§2). Owner action; blocks
   everything. Nothing below is trustworthy until a production deployment carrying `main`'s HEAD
   is confirmed serving.
2. **Preview walk of `main`, then promote** (§9).
3. **Binary path:** Capacitor scaffold, plugins, icon, splash, safe areas (§3, §4) → build →
   sign → upload. Starts the review clock as early as possible.
4. **Web path, in parallel and continuing after upload:** `/privacy`, `/terms`, account
   deletion, auth flows (§5, §7).
5. **App Store Connect metadata, screenshots, demo account** (§8).

Steps 3 and 4 are independent and can run concurrently. Step 1 gates all of them.

---

## 11. Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Deploys stay broken | **Fatal** | §2. Verify a real production sha before building anything native. |
| Guideline 4.2 rejection | High | §4. A remote-URL wrapper is the exact shape reviewers screen for. Even done well this is not a certainty. |
| Mobile UI quality on unaudited routes | High | `/analytics`, `/competitors`, `/calendar`, `/discover` have unknown mobile state. Audit at native viewport before submitting. |
| Reviewer opens app before §7 lands | Medium | Sequence §7 as early as possible; accept knowingly. |
| Injunction reverses | Medium | §6.3 is the migration, and it is planned regardless. |
| 134 unwalked commits | Medium | §9. |
| Cookie-jar failure in OAuth | Medium | §5.1. Test on a real device, not only the simulator. |

---

## Appendix A — runtime environment variables

Required by `src/app` or `src/lib` at request time. Script-only variables (`AB_*`, `PROBE_*`,
`SHOTS`, `VIEWPORT`, `E2E_*`, `STAFF_TEST_*`, …) are excluded — they do not belong in the Vercel
project.

**Supabase** `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY`

**Whop** `WHOP_API_KEY` · `WHOP_WEBHOOK_SECRET` · `WHOP_PRODUCT_ID_STARTER` · `WHOP_PRODUCT_ID_PRO` · `WHOP_PRODUCT_ID_STUDIO` · `WHOP_TRIAL_PLAN_ID_STARTER` · `WHOP_TRIAL_PLAN_ID_PRO` · `WHOP_TRIAL_PLAN_ID_STUDIO`

**Apify** `APIFY_TOKEN` · `APIFY_ACTOR_ID` · `APIFY_ACTOR_LEGACY` · `APIFY_WEBHOOK_SECRET`

**Models** `DASHSCOPE_API_KEY` · `DEEPSEEK_THINKING_BUDGET` · `EMBEDDING_MODEL` · `FLASH_MODEL` · `FOLD_MODEL` · `FOLD_TEMPERATURE` · `FOLD_MAX_TOKENS` · `FOLD_ATTEMPT_TIMEOUT_MS` · `FOLD_DIVERSITY_RETRY_TEMP` · `OMNI_MAX_TOKENS` · `SPLIT_LEG_MAX_TOKENS` · `QWEN_APOLLO_MODEL` · `QWEN_CALIBRATE_MODEL` · `QWEN_DECODE_MODEL` · `QWEN_EMBEDDING_MODEL` · `QWEN_OMNI_MODEL` · `QWEN_REASONING_MODEL` · `QWEN_UNBOUND_CHAT_MODEL` · `QWEN_WATCH_MODEL`

**Infra** `UPSTASH_REDIS_REST_URL` · `UPSTASH_REDIS_REST_TOKEN` · `CRON_SECRET` · `FILMSTRIP_EXTRACT_SECRET` · `NEXT_PUBLIC_APP_URL` · `NEXT_PUBLIC_SENTRY_DSN`

**Build-time only** (read by `next.config.ts`, not at request time) `SENTRY_ORG` · `SENTRY_PROJECT`

**Verified script-only — do NOT add to the Vercel project.** `WHOP_COMPANY_ID` and `APP_URL`
(both `scripts/provision-whop.mjs`), `APIFY_API_TOKEN` (`scripts/spike-free-subtitles.ts`; the
runtime variable is `APIFY_TOKEN`). `GEMINI_API_KEY` and `DEEPSEEK_API_KEY` appear in no
non-test source at all — they are dead and copying them forward would encode a false dependency.

**Billing** `BILLING_ENFORCE_QUOTA` — **`true` in production.** Free tier is `limit:0` +
`enforced:true`; this is what makes §7.3's demo account necessary.

**Flags** `NEXT_PUBLIC_CONCEPT_V8` · `NEXT_PUBLIC_AMBIENT_V2` · `NEXT_PUBLIC_ENGINE_ONE_BRAIN` ·
`CHAT_AGENT_DISPATCH` · `ENGINE_AUDIO_SPLIT` · `AUDIO_EXTRACT_TIMEOUT_MS` · `RECALIBRATION_STEP` ·
`SCRAPER_HASHTAGS` · `GROUNDING_*` (12 vars: `CHAT_PREFLIGHT`, `CHAT_TOOL`, `HOOKS_ADAPT`,
`HOOKS_ENABLED`, `HOOKS_RANK`, `HOOKS_SURFACE`, `IDEAS_ADAPT`, `IDEAS_ENABLED`, `SCRIPT_ADAPT`,
`SCRIPT_ENABLED`, `REF_MIN_SIMILARITY`, `WARRANT_MIN_SIMILARITY`)

⚠️ The v8 concept flags must be passed **inline** — see the platform-concept lane's handoff.
