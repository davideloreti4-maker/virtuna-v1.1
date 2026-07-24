# Onboarding funnel — design contract

**Milestone:** `milestone/onboarding` · worktree `~/virtuna-onboarding` · off `main@99c494d1`
**Owner calls locked 2026-07-24:** $1 **before** any personal run · cold traffic gets an
**interactive demo preloaded with real examples** — no live video, no engine run · built on
**Ambient v2 Start** · traffic is **organic social**, so the funnel runs in in-app webviews (§2a).

---

## 0a. Owner calls — funnel review, 2026-07-24 (session 2)

Three decisions taken after a conversion review of the flow above. **They supersede the ordering in
§4 and §7 where they conflict.**

### ① Payment first, account after — identity moves BEHIND the money

The old order (aha → OTP → checkout) put a full step between peak intent and the money, and the
worst possible step for this traffic: reading a 6-digit code means switching to a mail app, and some
in-app webviews are killed when backgrounded. Whop collects an email as part of the purchase anyway,
so the identity step is redundant *before* the charge.

```
aha → LOCKED beat → $1 (Whop captures the email) → the withheld fix, revealed → "claim your account" (OTP)
```

OTP now runs when motivation is at its peak and abandonment costs them something they have paid for.

**What this changes in the code** (none of it is a Whop constraint — it is all ours):
- `api/whop/checkout/route.ts:10` — the 401-if-no-user guard must lift for the funnel path.
- `metadata.supabase_user_id` does not exist yet at checkout. Send an anonymous correlation id
  instead, and reconcile on the webhook.
- The webhook must **provision** the Supabase user from the payment email (admin API), not merely
  look one up. This turns the known "paid, no access" hazard (§7 of the handoff) from a warning into
  a code path that must be correct — it is now the *primary* path, not an edge case.
- S0's OTP form survives unchanged; it just fires later in the sequence.

### ② The wall: reveal beat 1 in full, lock beat 2

The old wall withheld the diagnosis of the *example* video, which asked the visitor to pay to satisfy
curiosity about a stranger, with no evidence our answers are any good. Two objections fired at the
worst moment: *"I don't care about his video"* and *"is this analysis even worth a dollar?"*

| Beat | Drop | Treatment |
|---|---|---|
| **1** | the smaller, earlier drop | **fully revealed** — where, why, and the director's fix |
| **2** | the big drop (0:04) | **locked** — this is the wall |

Beat 1 is the mechanism proof and a genuine aha; it costs nothing because the fixture is free.
Beat 2 is then withholding something whose value has just been *demonstrated* rather than asserted.

The lock leads with **"what would YOURS score"**, not with the example's diagnosis — the motivating
state is transfer of desire (§3 state 5), not curiosity about a stranger.

**The honesty floor from §4 is unchanged and still absolute:** beat 2's panel holds the real,
genuinely withheld output. Never a blur over placeholder text.

### ③ Trial stays at 3 days — and that raises the stakes elsewhere

Considered and **rejected**: extending to 7 days. Recorded so it is not re-argued — but the
consequence has to be designed around, because it is real:

> The strongest retention mechanic in this design — *"we said 58. Post it, and we'll grade ourselves
> against your real numbers"* — needs the creator to post, accumulate views, and return. Creators post
> 2–5×/week. **In 72 hours that loop frequently cannot close at all.**

So, with 3 days locked:
1. **The first session carries all of the retention weight.** It is not "the floor" (§4a) — it is the
   whole thing. If the room is not built and a real test is not run in session one, the trial ends
   having proven nothing and renews at $49 against a user with no evidence. That is the dispute.
2. **The pre-charge reminder becomes more important, not less** — 72 hours is short enough that the
   renewal genuinely surprises people. See §6.2; confirm what Whop sends, and fill the gap ourselves.
3. Day-2/day-3 nudges (§4a, "upside only") move up in priority, because there is no day 5 to recover
   in.

### Also adopted, no decision needed

- **Ship the analytics spine WITH S1** (§8), not after. None of the above is arguable without
  `demo_view → checkout_paid`, and it retrofits badly.
- **Time-to-aha budget:** first "oh shit" within ~10s of load, wall by ~45s.
- **CTA leads with the outcome, not the jargon.** "50 credits" is meaningless to a cold visitor.
  Lead: *"$1 — test your next 4 videos before you post."* `TRIAL.microcopy` stays underneath,
  carrying the credit cap and the renewal price, unchanged.
- **Post-payment, calibration runs in parallel with the first test, not in front of it** (§4). The
  handle→calibrate step has the highest failure rate in the product and must not stall the value.
- Keep the fixture module multi-video-ready so swapping the example is a data change (§6.1).

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
  means *identity → checkout on the same screen*, never a page nav, never a confirm email. On this
  traffic that identity step must be **email OTP**, not Google — see §2a.
- **What the $1 actually buys.** Not a calibration, not a test — **3 days and 50 credits, which
  auto-convert to the chosen plan's monthly price** (`TRIAL.days = 3`, `TRIAL.credits = 50`,
  `pricing.ts:101`). The plan is picked at checkout; $49 Creator is the default. **It auto-renews —
  there is no second conversion to win** (§4a).
- **Trial pool = 50 credits** (`pricing.ts:116`). `score` = 10, `simulate` = 2 (`CREDIT_COSTS`).
  The first run spends **~12**, leaving ~38 ≈ 3–4 more real tests across the 72 hours.
- **Calibration is unbilled** — no credit gate on `/api/audiences/calibrate`. It costs Apify money,
  not user credits. A failed scrape does **not** invalidate the purchase; it gets recovered, not
  refunded (§6).
- **One trial per account**, enforced by `trial_used_at` (`whop/checkout/route.ts:30`).

---

## 2a. The traffic profile — organic social (owner, 2026-07-24)

**No paid ads. Traffic is organic from TikTok / Instagram / other social**, i.e. link-in-bio and link
stickers. That single fact drives more of this build than any copy decision, because of what it
implies about the *browser* the funnel runs in.

### 🔴 BLOCKER — in-app webviews break both identity paths

Social apps open links in **embedded webviews**, not the system browser. Today this codebase offers
exactly two ways to get an account, and both fail there:

| Path | What happens in a TikTok/IG webview |
|---|---|
| Google OAuth (`signup-form.tsx:23`) | **Blocked by Google** — embedded webviews are refused (`disallowed_useragent`). Not a bug we can patch; it is Google's policy. |
| Email + password (`signup/actions.ts:52`) | Sends a confirmation email. The user must leave the webview, open a mail app, and click a link that opens in a *different* browser — no session, no referral cookie, no checkout intent. Gone. |

`grep signInWithOtp` returns **zero hits** — there is no magic link and no OTP in the codebase.
So on the only traffic this product has, the funnel currently cannot produce an account at all, and
it fails *between the aha and the dollar* — the worst position in the funnel.

**Required fix: email OTP as the primary identity step.** A 6-digit code typed back into the same
page (`supabase.auth.signInWithOtp`, unused today). The user never leaves the webview, so intent and
cookies survive. Google stays as the fast path on desktop and real mobile browsers, where it works.
This is a **prerequisite for S2**, not a nice-to-have.

### Mobile-first is the default, not the adaptation

`hero-showcase.tsx` is a desktop composition (`max-w-[1000px]`, three responsive utilities in the
whole file). The demo (S1) must be **designed at 390px and allowed to grow**, not designed wide and
squeezed. A filmstrip scrub authored for a mouse does not land its aha under a thumb.

### ⚠️ Verify on a real device before building around it

**Whop checkout inside an embedded webview.** Payment sheets, Apple Pay availability, and 3DS
redirects are all unreliable in in-app browsers. If the embed is flaky there, the tripwire needs a
different presentation on webview traffic. Test before, not after.

### The upside

Organic social traffic is **warm** — they have already watched the creator's content and arrive with
context and some trust. The demo carries less cold-persuasion load than it would on paid traffic, so
it can be shorter and more specific. Volume is lower, which raises the cost of every leak: there is
no budget knob to compensate for a broken step.

---

## 3. The psychological spine

Ten states, in order. Each screen below owns exactly one.

| # | State | Mechanism | Where it fires |
|---|---|---|---|
| 1 | Recognition — "this is my problem" | self-identification | S0 hero |
| 2 | Curiosity gap | Loewenstein information gap | S1 — the LOCKED 'why' |
| 3 | Vicarious aha | learning something true on a stranger's video | S1 scrub |
| 4 | Mechanism trust | proof of *how*, not claims of *how good* | S1 fix + receipt |
| 5 | Transfer of desire | "what would MINE score?" — the open loop that pays | S1 exit → S2 |
| 6 | Micro-commitment | tripwire; browser → buyer is the real state change | S3 $1 |
| 7 | Consistency pressure | having paid, they act to stay consistent | handle + video |
| 8 | Effort justification | IKEA effect + labor illusion; co-built asset | the room builds |
| 9 | Peak | the gap reveal — proof the room was worth it | the gap |
| 10 | Open loop | Zeigarnik + implementation intention | "when are you posting?" |

**The load-bearing insight:** the $1 is not revenue, it is a *self-concept switch* — and since the
plan auto-renews, it is also **the only conversion in the entire funnel.** States 1–6 exist to
produce it. S1's whole job is to make the dollar feel like the cheapest way to close an open loop
rather than like a purchase decision.

**The corollary:** states 7–10 are not selling anything. They happen **on the real platform, on the
real account, spending real credits**, and their only job is to make sure nobody reaches the cancel
button — see §4a.

---

## 4. The screens

### Pre-account — on `/go`, no engine spend

**S0 · Hero.** Already shipped: the real `video-test-card` beside the room.
Job: recognition. Unchanged.

**S1 · The interactive demo.** ← *the highest-leverage build item in this milestone*

**Owner call 2026-07-24: no live video, no engine run. An INTERACTIVE demo, preloaded with
examples.** The real product components, hydrated entirely from bundled example data, driven by taps.

**Zero network calls after page load.** No engine spend, no rate limiting, no abuse surface, nothing
to fail on a slow mobile connection — and, critically for §2a traffic, **no video element**, so there
is no autoplay policy to lose in a TikTok/IG webview.

The pattern is already proven in this repo:

| Piece | Already exists |
|---|---|
| Real v2 components rendering from fixture modules | `/ambient-v2` dev page + `detail-live-fixture.ts`, `overview-fixture.ts`, `start-fixture.ts` |
| Segment/keyframe structure with an image field | `detail-live-fixture.ts:31` (`keyframe_uri`, currently `null`) |
| Keyframes consumed as stills, not video | `retention-scrubber.tsx`, `thumbnail-strip.tsx` |

So S1 productizes an existing dev surface: curated fixtures + static keyframe stills in `/public` +
a mobile-first shell. Not new rendering work.

**It is a WALKTHROUGH of the real platform, not a tour of a mockup** (owner, 2026-07-24). The visitor
performs the same motions they will perform after paying — on the **real surface**: the real rail,
the real card, the real composer from Ambient v2 Start. Only the data is prefabricated.

Two payoffs, both large:
1. A real product surface is far more convincing than a marketing replica of one.
2. After checkout they land on **the screen they just used**, so first-run friction is near zero.
   The demo doubles as training without ever looking like a tutorial.

**Guided rails, not free roam.** Each beat lights only the affordance that advances it — but it is
the **real control**, not a glowing overlay on a screenshot. The visitor drives; they cannot drive
off the road. One example video (owner supplies it), so there is no opening pick to slow things down.

### The teaser paywall — the load-bearing mechanic

**The results are never fully shown. The $1 unlocks them** (owner, 2026-07-24). The wall sits
*inside* the insight, at maximum curiosity, not after it.

The seam matters more than anything else in this milestone. Withhold too much and it reads as bait;
too little and there is no reason to pay:

| SHOWN — proves the mechanism | LOCKED — the reason to pay |
|---|---|
| the filmstrip, real frames | — |
| **WHERE** they leave — "they're gone at 0:04" | **WHY** they leave (the diagnosis) |
| that a fix exists, and its shape | the fix itself (the director's move) |
| the craft score | the audience-specific score + the gap |

Showing the **where** is what makes the mechanism credible — a specific timestamp on a real video is
not a claim, it is a demonstration. Withholding the **why** is maximum tension: knowing you lose
people at 0:04 *without knowing why* is more frustrating than never knowing at all. That is the gap
the dollar closes.

**Honesty floor — two hard rules:**
1. The analysis must be **real**, run once through the real pipeline and frozen. Invented numbers are
   fabricated proof and must not ship — same rule as the offer page's testimonials.
2. **The locked panel must contain that real output, genuinely withheld** — never a blur over
   placeholder text. Paying reveals exactly what was behind the wall. A fake blur would poison the
   one asset the demo exists to build: trust in the mechanism.

### Unlock order — close the old loop before opening the new one

On successful checkout, reveal **the withheld fix immediately**, before asking for anything. They paid
to close that loop; honor it first. Only then ask for their handle. Reversing this — payment, then a
new demand — makes the purchase feel redirected rather than honored.

```
walkthrough → "they're gone at 0:04"  → why? ▓▓ locked ▓▓
                                              ↓  $1
                                       the fix, revealed
                                              ↓
                                       "now run it on yours" → @handle
```

### The commitment — still on `/go`, zero navigation

**S2 · Identity.** Framed as part of the purchase, never as "create an account".

Because the traffic is in-app webviews (§2a), the order is **inverted from the usual**:

- **Email + 6-digit code is the PRIMARY path.** One field, code typed back into the same page, no
  navigation, no mail-app round trip. Works everywhere, including every webview.
- **"Continue with Google" is offered only where it works** — detect the webview and hide it there
  rather than showing a button that returns a Google error page mid-funnel.
- **The password + confirmation-email path is removed from this funnel entirely.** It cannot survive
  an embedded browser.

**S3 · The tripwire.** Whop embed modal, in place.
- Button says what they GET: **"Test my video — $1"**.
- Under it, the honest line already written in `pricing.ts`: `TRIAL.microcopy`
  ("$1 for 3 days · 50 credits, then the plan price — cancel anytime").
- Burying either the credit cap or the renewal price is how you earn chargebacks. It stays visible.

### Post-payment — **the real platform. No wizard.**

The demo sold the trial. The trial is now running. From here the user is on their real account,
building their real audience, running real actions that spend real credits. There is **no separate
onboarding surface** — `/welcome` is deleted outright, and checkout lands them directly in Ambient
v2 Start.

**Guidance is sequencing, not scaffolding.** Three mechanisms, all of them already shipped
behaviour, none of them an overlay:

1. **The empty rail is the call to action.** The audience rail is where the room lives. On first
   run it holds no room, and that absence — plus one lit affordance, *"build your room from your
   account"* — is the entire instruction. No coach marks, no tour, no modal.
2. **The Start grid stays fully live.** Nothing is padlocked. A creator who wants to run Hooks
   before building a room can. But every run without a room returns against the **General
   population baseline, already labeled as such** — so the product itself says *"this is the general
   audience, not yours"* on every card. That is honest, it is shipped, and it creates pull instead
   of a gate. A lock punishes; an honest baseline invites.
3. **`status` already supports an inert tile** (`AmbientStart.tsx:72`) if a first-run state ever
   needs to quiet a tile down. Use it sparingly, and never on anything the creator paid for.

**First real action — the room.**
`@handle` → `/api/audiences/calibrate` → the room builds in the rail, live and watchable:

```
reading @handle's last 34 posts        ✓
finding your pillars                   ✓
assembling 1,000 viewers who match     ▓▓▓▓▓░░░
```

This is the single most under-valued moment in the product. A spinner throws away the perceived
value of work that is genuinely happening. Show the labor — honestly, no padded delays, no invented
steps. The room that appears is theirs, it took visible effort, and it does not port to a competitor.

**Second real action — the video.**
Their own video, on their real account, spending real credits. **No dead end:** if they have nothing
ready, we test their last post — the ONE-SCRAPE already wrote `account_posts` during calibration, so
this path always has material.

**The peak — the gap.**
```
General audience says 71.
YOUR audience says 58.
They leave at 0:04 — the cut lands before the payoff.
```
The only moment in the product where the calibrated audience *proves* it changes the answer. It is
also the argument for the $49, so it must land inside the first session, not on day 2.

**The open loop.**
*"When are you posting this?"* → today / tomorrow / this week. Implementation intentions roughly
double follow-through, and this one schedules the return visit.
*"We said 58. Post it, and we'll grade ourselves against your real numbers."* An ungraded prediction
is a loop the user wants closed — and no competitor scores itself.

**Never a congratulations screen.** Peak-end rule: the session ends with the product working and a
loop open, not a modal saying "you're all set."

### 4a. The 72 hours — a retention problem, not a second conversion

**Owner call 2026-07-24: there is exactly ONE conversion in this funnel — the $1.** The trial
auto-renews into the plan; nobody has to be sold twice. Days 1–3 are therefore not a campaign, and
they do not get campaign-sized effort. The job is narrower and easier: **give them no reason to
cancel.**

Which reduces to three things, in order of how often they break it:

1. **The room exists and the first test happened.** A trial that ends with an empty rail cancels
   itself. This is why §4's first session matters — not as a sales moment, as the floor.
2. **Nothing is visibly broken.** Failed scrape, stuck job, a card that renders empty. Ordinary
   product quality, weighted higher than usual because the window is 72 hours long.
3. **The renewal is not a surprise.** Disclosure at checkout (`TRIAL.microcopy`, already written,
   states both the 50-credit cap and the renewal price) plus one-click cancel reachable in-app.
   That is the floor, and it is a dispute-avoidance measure, not a growth tactic.

Everything else on this arc — the prediction check at ~24h, the balance nudge at ~48h — is **upside,
not requirement**. Build it after the $1 path converts, because it is worth nothing until traffic is
flowing through checkout.

> ⚠️ **Verify before shipping:** Whop is merchant of record. Find out what renewal / pre-charge
> notices Whop already sends on the trial SKU, so we neither double-send nor assume a notice exists
> that doesn't. Auto-renew disclosure obligations vary by jurisdiction — worth one check with
> whoever owns the terms, since the merchant-of-record relationship changes who is responsible.

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
2. **The surprise $49 is the real chargeback vector** — not the dollar, and not "they paid before
   seeing value." Since the trial auto-renews and nobody is re-sold, the renewal charge is where all
   the revenue actually lands, and a dispute there costs more than the subscription earns.
   Floor, non-negotiable: `TRIAL.microcopy` visible under every CTA (already written — states both
   the 50-credit cap and the renewal price) and one-click cancel reachable in-app. Confirm what Whop
   sends as merchant of record (§4a) before deciding whether we send anything ourselves.
3. **Calibration can fail** (private account, dead handle, Apify hiccup) *after* they paid.
   This does **not** invalidate the purchase — they still hold 3 days and 50 credits. So it is a
   **recovery ladder, never a refund**:
   1. auto-retry once, silently;
   2. "@x looks private — connect the account, or try another handle";
   3. fall back to a **General-population first run** so the trial still produces a real test today,
      with the room offered again later. The creator must never be stranded credit-rich and
      surface-poor.
   Refund only if they ask. The dollar is not the thing at stake — the 72 hours are.
4. **Trial pool is finite.** The first session must never spend more than ~12 of the 50 credits, or
   the trial cannot survive to hour 72 with anything left to run.

---

## 7. Build slices

| Slice | Deliverable | Gate |
|---|---|---|
| **S0** | 🔴 **Email OTP auth + webview detection.** Unblocks everything downstream | `signInWithOtp`; verified in a real TikTok/IG in-app browser |
| **S1** | Interactive demo on `/go` — real v2 components + preloaded example data + static keyframe stills, **designed at 390px**, guided rails, zero network | 3 one-time engine runs frozen as fixtures |
| **S2** | OTP-first identity → Whop modal inline; password+confirm removed from this funnel | Whop embed verified on a real device inside a webview |
| **S3** | **Delete `/welcome`.** Checkout lands in Ambient v2 Start; first-run = empty rail + one lit path | deletes `connect-step.tsx`, the 2-step `onboarding-store`, and the middleware `/welcome` bounce (`middleware.ts:167`) |
| **S4** | First real actions on the real account: room calibrates in the rail (visible labor) → their video → the gap → the intention prompt | rides `NEXT_PUBLIC_AMBIENT_V2`; ≤12 credits |
| **S5** | Upside only, AFTER the $1 path converts: prediction check at ~24h, balance nudge at ~48h | not required for launch — the renewal is automatic |

**Deletions this implies:** `onboarding-store.ts` two-step machine · `connect-step.tsx` ·
the orphaned `ProfileInterviewModal` on `content-form.tsx` (fold goal · stage · pain into S6's wait,
infer everything else from the scrape).

## 8. Activation + instrumentation

**The scoreboard is `checkout_paid`.** One conversion, and it happens on `/go`. Everything after it
is measured to catch breakage, not to optimize a second sale.

**Activation = a sealed test against a calibrated audience, in the first session** — the leading
indicator that the trial won't cancel itself.

Events, in funnel order — none of these exist today, which is why the funnel cannot currently be
debugged:

`demo_view → demo_pick → demo_scrub → demo_fix_open → oauth_start → oauth_done →
checkout_open → checkout_paid → start_landed → handle_submit → calibrate_done →
video_submit → gap_shown → intention_set → prediction_checked → renewal_notice_seen →
trial_converted`

Three derived numbers, in priority order:
1. **demo_view → checkout_paid** — the milestone. Everything else is diagnostics for this number.
2. **demo_pick → demo_fix_open** — does the demo actually land its aha? If people pick a video and
   never open a fix, the demo is decorative and the funnel dies upstream of the money.
3. **checkout_paid → gap_shown (same session)** — the cancellation predictor. A paid user who never
   reaches the gap is the one who cancels inside 72 hours.
