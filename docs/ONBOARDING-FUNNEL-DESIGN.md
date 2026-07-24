# Onboarding funnel — design contract

**Milestone:** `milestone/onboarding` · worktree `~/virtuna-onboarding` · off `main@99c494d1`
**Owner calls locked 2026-07-24:** $1 **before** any personal run · anonymous traffic gets a **canned
(but real) demo**, never a free engine run · built on **Ambient v2 Start**.

---

## 0. The one rule

**Onboarding is not a form in front of the product. It is the product's first run.**
Every screen returns a visible artifact. No screen asks a question whose answer we could read
ourselves. No screen can be skipped into an empty state.

---

## 1. What exists today (traced, `main@99c494d1`)

```
/go or /  →  /signup  →  [email-confirm wall]  →  /login  →  /welcome  →  /home
```

| Fact | Evidence |
|---|---|
| Every offer CTA points at a bare signup | `src/lib/routes.ts:10` (`SIGNUP_URL = "/signup"`) |
| Email/password signup dead-ends on a confirm email | `src/app/(onboarding)/signup/actions.ts:52` |
| Google OAuth is the only path that keeps momentum | `signup-form.tsx:23` |
| Un-onboarded users are force-routed to `/welcome` | `src/lib/supabase/middleware.ts:167` |
| Onboarding is ONE text field + "Skip for now" | `welcome/page.tsx:9` (`STEPS = ["connect"]`), `connect-step.tsx` |
| The handle is written as an **inert string** — no scrape, no account, no audience | `onboarding-store.ts:94` |
| The real 10-card profile interview is bolted to the dead `/analyze` surface | `content-form.tsx:558` |
| Money is never collected; Whop only appears as a 402 wall, and enforcement is off in prod | `composer.tsx:1105` (`reportCredit402`), `BILLING_ENFORCE_QUOTA` |
| The moat (`/api/audiences/calibrate`) is not in the funnel at all | — |

**Consequence:** the offer page promises "test your video, see the second they scroll"; the product
delivers an email round-trip and a username field. Time-to-aha is days, or never.

## 2. Constraints the code imposes

- **`/api/whop/checkout` requires an authenticated user** (`route.ts:10` → 401). "Pay first" therefore
  means *1-tap Google OAuth → checkout on the same screen*, never a page nav, never a confirm email.
- **Trial pool = 50 credits** (`pricing.ts:116`). `score` = 10, `simulate` = 2 (`CREDIT_COSTS`).
  Onboarding spends **~12**, leaving ~38 ≈ 3–4 more real tests inside the 3-day window.
- **Calibration is unbilled** — no credit gate on `/api/audiences/calibrate`. It costs Apify money,
  not user credits. Safe to put in onboarding; must be refund-protected on failure (§6).
- **One trial per account**, enforced by `trial_used_at` (`whop/checkout/route.ts:30`).

---

## 3. The psychological spine

Ten states, in order. Each screen below owns exactly one.

| # | State | Mechanism | Where it fires |
|---|---|---|---|
| 1 | Recognition — "this is my problem" | self-identification | S0 hero |
| 2 | Curiosity gap | Loewenstein information gap | S1 demo pick |
| 3 | Vicarious aha | learning something true on a stranger's video | S1 scrub |
| 4 | Mechanism trust | proof of *how*, not claims of *how good* | S1 fix + receipt |
| 5 | Transfer of desire | "what would MINE score?" — the open loop that pays | S1 exit |
| 6 | Micro-commitment | tripwire; browser → buyer is the real state change | S3 $1 |
| 7 | Consistency pressure | having paid, they act to stay consistent | S4–S5 |
| 8 | Effort justification | IKEA effect + labor illusion; co-built asset | S6 build-out |
| 9 | Peak | the gap reveal — proof the room was worth it | S7 |
| 10 | Open loop for day 2 | Zeigarnik + implementation intention | S8 |

**The load-bearing insight:** the $1 is not revenue, it is a *self-concept switch*. Everything
downstream — activation, D2 return, $1→$49 — correlates with that switch far more than with the
dollar. Which means S1's only job is to make the dollar feel like the cheapest way to close an open
loop, not like a purchase decision.

---

## 4. The screens

### Pre-account — on `/go`, no engine spend

**S0 · Hero.** Already shipped: the real `video-test-card` beside the room.
Job: recognition. Unchanged.

**S1 · The playable demo.** ← *the highest-leverage build item in this milestone*

Not a video. Not a GIF. The **real v2 components on pre-computed real analyses.**

- Opens with a choice: *"Which is closest to what you make?"* → 3 pre-analyzed real videos
  (e.g. talking-head / b-roll edit / product demo). The choice is the first foot-in-the-door and
  does the self-identification work no headline can.
- They scrub the filmstrip. The retention dip is annotated where the audience actually left.
- One director's fix opens, with its `ProofReceipt`.
- **Exit line is an open loop, not a CTA:** *"That's Jake's video. What does yours do?"*

**Honesty floor:** these must be real analyses of real videos, run once and frozen as fixtures.
Invented numbers here are fabricated proof and must not ship — same rule as the offer page's
testimonials.

### The commitment — still on `/go`, zero navigation

**S2 · Identity.** One tap Google. Framed as part of the purchase, never as "create an account":
*"Continue with Google — then $1."* Email/password stays available but must become magic-link;
the confirmation wall cannot survive into this funnel.

**S3 · The tripwire.** Whop embed modal, in place.
- Button says what they GET: **"Test my video — $1"**.
- Under it, the honest line already written in `pricing.ts`: `TRIAL.microcopy`
  ("$1 for 3 days · 50 credits, then the plan price — cancel anytime").
- Burying either the credit cap or the renewal price is how you earn chargebacks. It stays visible.

### Guided onboarding — replaces `/welcome` entirely, ~2 min, 4 screens

Progress indicator starts at **40% filled** — "account ✓ · payment ✓" (endowed progress; a bar that
starts empty is a bar that gets abandoned).

**S4 · "What's your handle?"**
One field, no skip. On submit, **`/api/audiences/calibrate` fires immediately in the background.**
The user is not waiting for it — they move straight to S5. Two waits collapse into one.

**S5 · "Drop the video you're about to post."**
Co-creation: the user supplies the stake. Underneath, calibration progress is already ticking.
**No dead end:** *"Nothing ready? We'll test your last post instead"* — the ONE-SCRAPE already
writes `account_posts` during calibration, so this path always has material. Nobody reaches S7 empty.

**S6 · The build-out (60–90s).** The most under-valued screen in the product.
A spinner throws away the perceived value of real work. Show the labor, honestly, because it is real:

```
reading @handle's last 34 posts        ✓
finding your pillars                   ✓
assembling 1,000 viewers who match     ▓▓▓▓▓░░░
watching your video, second by second
```

Labor illusion only works when the labor is real — no padded delays, no fake steps.

**S7 · The gap. ← the peak**
```
General audience says 71.
YOUR audience says 58.
They leave at 0:04 — the cut lands before the payoff.
```
Then, and only then: *"This is your room. Nobody else has it."*
This is the single screen that justifies the subscription. It is the only moment where the
calibrated audience proves it changes the answer.

**S8 · Implementation intention + the open loop.**
- *"When are you posting this?"* → today / tomorrow / this week.
  Implementation intentions roughly double follow-through — this converts vague intent into a
  scheduled return.
- *"We said 58. Post it, and we'll grade ourselves against your real numbers."*
  An ungraded prediction is an open loop the user wants closed. No competitor scores itself.

**S9 · Land in Ambient v2 Start.**
Rail live with their room. Thread already holding their first test card.
**Never a congratulations screen. Never an empty state.** Peak-end rule: the end is the product
working, not a modal saying it worked.

### Days 1–3 — the trial window

| Day | Trigger | Frame |
|---|---|---|
| D1 | they post | the prediction check — we grade ourselves, publicly to them |
| D2 | mid-trial | "38 credits left, 2 days" — capability remaining, not scarcity pressure |
| D3 | conversion | "your room stays. Your credits reset." — the asset is the reason to convert |

---

## 5. Banned (each of these is a known conversion leak)

- Congratulation screens, confetti, "You're all set!"
- Tooltip tours. A tour is what you build when the surface doesn't explain itself — fix the surface.
- Fake urgency, fake social proof, invented testimonials.
- Padded loading delays. The labor illusion is honest here; faking it is not.
- A "Skip" on any step. Replace every skip with a *lighter path that still produces a result*.
- More than one decision per screen.
- Asking a creator what their niche is while we are reading their last 30 posts.

---

## 6. Risks pay-first creates, and the cover

1. **`/go` now carries 100% of conversion.** Mitigation: S1 must be genuinely playable. If it ships
   as a recording, the tripwire will not fire and no amount of copy will save it.
2. **They pay before seeing their own result → chargeback exposure.** Mitigation: honest microcopy
   (already written), one-click cancel visible in-app, and S4–S7 completing inside ~2 minutes. A user
   who paid $1 and watched a spinner refunds *and* tells people.
3. **Calibration can fail** (private account, dead handle, Apify hiccup) *after* they paid.
   Mitigation: **auto-refund the dollar** on calibration failure + "we couldn't read @x — here's your
   dollar back." Cheap insurance and a story people repeat.
4. **Trial pool is finite.** Onboarding must never spend more than ~12 of the 50 credits.

---

## 7. Build slices

| Slice | Deliverable | Gate |
|---|---|---|
| **S1** | Playable demo on `/go` — 3 real pre-computed analyses, real v2 components | 3 one-time engine runs frozen as fixtures |
| **S2** | OAuth → Whop modal inline; kill the confirm-email wall for cold traffic | magic-link replaces password confirm |
| **S3** | New guided `/welcome`: handle → background calibrate ‖ video test → gap → intention | deletes `connect-step.tsx` + the 2-step `onboarding-store` machine |
| **S4** | Exit into Ambient v2 Start, rail armed, thread seeded | rides `NEXT_PUBLIC_AMBIENT_V2` |
| **S5** | Prediction ledger + D1–D3 lifecycle | worthless before S1–S4 convert anyone |

**Deletions this implies:** `onboarding-store.ts` two-step machine · `connect-step.tsx` ·
the orphaned `ProfileInterviewModal` on `content-form.tsx` (fold goal · stage · pain into S6's wait,
infer everything else from the scrape).

## 8. Activation + instrumentation

**Activation = a sealed test against a calibrated audience, in the first session.**

Events, in funnel order — none of these exist today, which is why the funnel cannot currently be
debugged:

`demo_view → demo_pick → demo_scrub → demo_fix_open → oauth_start → oauth_done →
checkout_open → checkout_paid → handle_submit → calibrate_done → video_submit →
gap_shown → intention_set → start_landed → d1_post → d2_return → trial_converted`

Two derived numbers to watch above all: **demo_fix_open → checkout_paid** (does the demo sell?)
and **checkout_paid → gap_shown** (does the product deliver before the regret window?).
