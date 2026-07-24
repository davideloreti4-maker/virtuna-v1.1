# Handoff — onboarding funnel milestone

**Worktree:** `~/virtuna-onboarding` · **Branch:** `milestone/onboarding` · **Base:** `main@99c494d1`
**Tip:** `5c3f5e42` · pushed · **NOT merged — see §6, there are two live production hazards**
**Green:** suite 4479 / 0 · tsc 0 · eslint 0

**Read first:** `docs/ONBOARDING-FUNNEL-DESIGN.md` — the contract. **§0a holds the session-2 owner
calls and SUPERSEDES §4/§7 where they conflict.** Do not re-derive the design; it is locked.
**Owner checklist for the last blocker:** `docs/WHOP-SETUP.md`.

---

## 1. What this milestone is

Replace the inert one-field `/welcome` with a conversion funnel: a real-surface interactive demo on
`/go` with a teaser paywall, a $1 tripwire, and identity folded into the purchase. Traffic is organic
TikTok/Instagram, so the whole thing runs inside in-app webviews.

## 2. The design, as locked

```
/go hero → walkthrough (4 beats) → WALL → $1 → reveal the withheld fix → claim account (OTP) → real platform
```

- **Pay first.** $1 before any personal engine run.
- **Payment BEFORE identity** (§0a ①, changed this session). OTP between the aha and the money was a
  step at peak intent that also forced an app-switch to a mail client — which some webviews do not
  survive. Whop captures the email anyway.
- **The wall samples before it withholds** (§0a ②, changed this session). Beat 1 is given away in
  full so the mechanism is proven; beat 2 is locked.
- **3-day trial kept** (§0a ③). Consequence: the "post it and we'll grade ourselves" loop often
  cannot close in 72h, so session one carries ALL the retention weight.
- **One conversion.** The plan auto-renews; nobody is sold twice.

## 3. What is BUILT

### S0 — identity (code-complete, unverified on a real device)
- `lib/auth/in-app-browser.ts` — webview UA detection, 15 tests pinning real UA strings.
- `lib/auth/otp.ts` — `sendOtp`/`verifyOtp`, `shouldCreateUser: true` so one call covers signup and
  login (never make a visitor choose which they are at peak intent).
- `components/auth/email-otp-form.tsx`, `(onboarding)/login/login-form.tsx` — OTP leads, Google only
  where Google works, password behind a disclosure.

### S1 — the walkthrough (built, browser-verified, running on REAL data)
- `components/offer/walkthrough/` — mounted on `/go` directly under the hero (the time-to-aha budget
  is ~10s to beat 1, ~45s to the wall; a demo buried below four persuasion sections cannot meet it).
- Drives the **real `AmbientDetail`** — the instrument they land on after paying. Only the data is
  prefabricated. Zero network after load, and no video element, so there is no autoplay policy to
  lose in a webview.
- **The seal is DATA, not a view flag.** `sealTemplate` strips the fix, the diagnosis and the
  audience score out of the template, so the real component renders its own honest unavailable
  states. Verified live: the sealed text is absent from the DOM at the wall.
- Four beats, one lit affordance each: `frames → revealed → wall → open`.
- `scripts/freeze-walkthrough-fixture.mts` — turns a persisted analysis into the fixture and
  **refuses degraded runs**.
- `lib/analytics/funnel-events.ts` — the §8 event spine. **No sink yet**; `track()` buffers and logs
  in dev. Call sites are the expensive part to retrofit, so they ship now.
- **Preview any beat in dev:** `/go?beat=frames|revealed|wall|open`. Hard-gated to non-production —
  in prod that wall IS the paywall.

### The frozen analysis
Real run `vSoTpo5AixUS` through the production route (`tiktok_url`, engine 3.21.0) over
`https://www.tiktok.com/@ahormozi/video/7665552990991895822` — Alex Hormozi, public, **29s**.
Both insight payloads are the engine's **own words**, split into why/fix, with a test pinning the
exact phrases so nobody can quietly rewrite them into marketing copy. Craft score (55) is derived
from the four measured dims. `WALKTHROUGH_IS_PLACEHOLDER` is now `false`.

> The curve declines **monotonically** — `[0.78, 0.74, 0.70, 0.56, 0.48]`, no local dips. So the
> LOWEST point is trivially the last segment and means nothing; the wall anchors on the steepest
> **drop** instead — 0:12, −14 points — which is what a viewer experiences as "where I left".

## 4. What is NOT built

| Gap | State |
|---|---|
| **The `$1` button does nothing** | fires `checkout_open`, returns. `/go` passes no `onCheckout` because Whop has no keys |
| Whop checkout | 503 by design. **The funnel's only conversion point does not exist** |
| Payment-first rewiring (§0a ①) | the 401 at `api/whop/checkout/route.ts:10` still stands; webhook does not provision users |
| `/welcome` deletion (S3) | untouched, still bounced to by `middleware.ts:167` |
| Post-payment first session (S4) | not started |
| Keyframe stills | `keyframe_uri` is null even on good runs — a separate extraction step. The filmstrip is currently curve + transcript only |
| Analytics sink | events buffer in memory and go nowhere |

## 5. Blocked on the owner

1. ✅ **DONE — Supabase OTP templates are live in production.** Patched via the Management API and
   verified: both `confirmation` and `magic_link` render `{{ .Token }}`, neither has
   `{{ .ConfirmationURL }}`.
   ⛔ **Never run `npx supabase config push` on this project.** It pushes the whole `[auth]` block,
   and `config.toml` is still the local-dev scaffold — it would set `site_url` to `127.0.0.1`, wipe
   the redirect allow-list, and cap auth email at 2/hour. Patch the Management API instead.
2. 🔴 **Whop** — products, the $1/3-day trial SKUs, API key, webhook secret. `docs/WHOP-SETUP.md`.
3. 🔴 **`rate_limit_email_sent = 2` in production** — two auth emails **per hour**, project-wide.
   This throttles OTP to nothing under any real traffic. Needs custom SMTP.
4. 🔴 **`site_url = http://localhost:3000`** in prod, with a localhost-only `uri_allow_list`.
   **Unverified** whether prod OAuth / password reset currently break — check, do not assume.
5. **Real-device pass** — TikTok bio link → in-app browser → OTP → checkout, iOS and Android.
6. **Rotate the Apify key** — the replacement key was pasted into a chat transcript on 2026-07-24.

## 6. ⚠️ Merge readiness — three things to handle first

The original reason for not merging (OTP templates unpushed) is **cleared**. Two new hazards replaced
it, plus one mechanical gotcha:

1. **OTP would become the front door on a project capped at 2 auth emails/hour** (§5.3). Existing
   users can still get in via password or Google, so it degrades rather than locks out — but it is a
   real regression for anyone who takes the primary path. **Fix the rate limit before or with the merge.**
2. **`/go` would ship a `$1` button that does nothing.** The walkthrough renders in production now
   (`WALKTHROUGH_IS_PLACEHOLDER` is false), so a visitor reaches the wall and dead-ends. Acceptable
   only if `/go` has no meaningful traffic yet — which it should not, since Whop was never configured.
3. **This branch deletes 143 `.planning/` files.** That is inherited GSD state cleaned when the
   worktree was created, **not** work from this milestone. Merging naively removes the Numen GSI
   milestone's phase/research docs from `main`. The real diff is **22 files, +2,722 / −70**.

**Merge recipe that preserves `.planning/`:**
```bash
cd ~/virtuna-v1.1 && git switch main && git pull
git merge --no-ff milestone/onboarding          # resolve conflicts if any
git checkout HEAD^ -- .planning                  # restore main's planning tree
git commit --amend --no-edit                     # fold the restore into the merge commit
git diff HEAD^ HEAD --stat -- .planning          # MUST be empty
npm run build                                    # main auto-deploys to Vercel
```

## 7. Hazards carried forward

- **`/api/analyze` lies in three ways** — see `docs/` and the memory note: it silently replays a
  cached row (need `bypass_cache=true`), a degraded run still returns 200 with a score and a
  confidence label, and the `tiktok_url` re-host times out on videos over ~30s **locally** (an
  ~1.8 Mbps upstream, not a size cap — the bucket allows 200MB; likely fine on Vercel).
- **Confidence rises as signals disappear.** A scrape-failed run with gemini/personas/ml/rules/audio
  /retrieval all false was labeled **HIGH (0.55)**; a real full-signal run scores **LOW (0.35)**.
  Not traced — worth a look before any confidence label is shown to a paying user.
- **Webhook drops a grant** if `metadata.supabase_user_id` is missing (`webhooks/whop/route.ts:62`
  warns only). Under §0a ① that id will not exist at checkout — this stops being theoretical.
- **Calibration failure after payment is a recovery ladder, never a refund.**
- **Tests:** `npm test` is a fake script. Use `node ./node_modules/vitest/vitest.mjs run`.
- **Dev server:** `NEXT_PUBLIC_AMBIENT_V2=true`, nohup (not setsid — absent on macOS). This worktree
  needs `.env.local` copied from `~/virtuna-v1.1/` (untracked, does not follow a worktree).
- **Third-party content:** the demo publicly analyses a named creator's video on a commercial page.
  Keep it analytical, imply no endorsement, keep the fixture swappable.

## 8. Next actions, in order

1. **Whop** — longest lead time, and nothing past the wall can be built or measured without it.
2. **Fix the prod email rate limit** (custom SMTP), then merge per §6.
3. **S2 rewired for payment-first** (§0a ①): lift the 401, send an anonymous correlation id, make the
   webhook **provision** the user from the payment email, then OTP to claim.
4. **S3** — delete `/welcome` and the middleware bounce.
5. Keyframe stills into `/public` so the filmstrip is a filmstrip.
6. Wire a sink to the funnel events — use `sendBeacon`, since a `fetch` in flight when a webview is
   backgrounded is a lost event.
