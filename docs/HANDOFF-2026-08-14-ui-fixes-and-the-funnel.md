# Handoff — the four UI fixes, and why nobody has used this (2026-08-14)

**Lane:** `lane/in-thread-chat` · worktree `~/virtuna-in-thread-chat`
**Branch base:** `e70dc603` (fast-forwarded to main at session start)
**Verification:** prod build (`npm run start`, port 3016), native mobile + desktop contexts.
**Merged:** **#495** (the four UI fixes) · **#497** (the funnel instrumentation) — main at `c9ec3fa3`.

> ⚠️ **§6 items 1 and 4 are DONE — they shipped in #497 after this document was written.**
> The origin/path columns exist and are populated; `handle_submit` and `calibrate_done` now fire.
> Everything else below stands. See §8 for what §6 turned into.

---

## 0. ▶️ THE HEADLINE

**There is no funnel drop-off, because there has never been a funnel arrival.**

The brief's "18 signups, 3 opened onboarding, 1 ever generated" is a real query over real
tables — and every one of those numbers counts something other than a user.

| the number | what it actually counts | measured |
|---|---|---|
| "18 signups" | `creator_profiles` rows | 18 = **9 test/staff · 7 anonymous sessions · 2 the owner** |
| "3 opened onboarding" | `profile_interview_seen_at is not null` | 3 = `e2e-test@virtuna.local`, `test@virtuna.dev`, `davide.loreti4@gmail.com`. Last one **2026-05-31** |
| "1 ever generated" | a card-bearing message | 1, on an anonymous session |

**`auth.users` holds 123 rows. 12 have an email. Of those 12, nine are test/staff accounts and
three are the owner's own addresses** (`davide@gmail.com`, `davide.loreti4@gmail.com`,
`davide.loreti88@gmail.com`). **No external person has ever created an account.**

And the money, straight off `funnel_events`:

```
checkout_open   0 events, ever
checkout_paid   0 events, ever
```

Both call sites are live and reachable (`CheckoutModal` mounts in five places — pricing,
tier-gate, upgrade-prompt, reading-limit-dialog, billing-section). These zeros are real.

🔑 **So "why has nobody used this" has a mechanical answer: nobody has arrived.** The product is
deployed and the funnel works. It has never been pointed at an audience.

---

## 1. What the 111 anonymous sessions are

Not a mystery, and mostly not people. `/go`'s only CTA (`FREE_ENTRY`, `cta-config.tsx`) mints an
**anonymous session** and pushes `/home?v=Test` — no account by design. So anonymous rows *are*
the funnel's arrivals. Of 111: 46 opened a thread, 43 sent a message, 1 got a card.

Then group those 43 by their opening line:

```
16 × "give me 5 hooks for my student budgeting app"
10 × "hooks about morning routines for busy founders"
 8 × "https://www.tiktok.com/@creator/video/7460113355847362834"
 3 × "morning routines for busy parents"
 3 × "https://www.tiktok.com/@example/video/7300000000000000000"
 1 × each of three more
```

Eight distinct strings across 43 accounts; the top three are 34 of them, byte-identical, and one
of them is a literal `@example` placeholder URL. **This is scripted probe traffic.** There is no
organic ask anywhere in the table.

Same shape one layer up: six anonymous accounts submitted a handle on 2026-08-05 — all six
`@zachking`, all within 8 minutes, all `updated_at = created_at`, all `personas: 0`. That is one
test session retrying, not six creators failing calibration.

🔑 **The method rule that produced this, and the one to keep:** a count is not a rate, and a rate
over synthetic accounts is not a rate. Before the word "measured", group by user AND check whether
the distinct inputs outnumber the rows. Generalises `group by threads.user_id`
(`HANDOFF-2026-08-13-audit-rewalk.md` §0.0) from *whose rows* to *whether they are anyone's*.

---

## 2. 🔴 Three surfaces are built, wired, and mounted by nothing

Found while tracing the funnel. Each is live code with zero reachable entry point — so its
usage metric reads 0 forever, and 0 looks like a preference.

| surface | only mount | reachable? |
|---|---|---|
| **`ProfileInterviewModal`** — the onboarding interview | `content-form.tsx` | ❌ `ContentForm` ← `CommandBar` ← **nothing in `src/app`** |
| **`ContentForm`** / `CommandBar` | — | ❌ `/analyze` became a bare `redirect('/home')` on 2026-07-18 (`cdb5c423`) |
| **`Walkthrough` / `beats.ts`** — the /go demo beats | — | ❌ `/go/page.tsx` is a static sales page; it never mounts them |

**This is why the interview shows 3 of 18 and nothing since 2026-05-31 — it cannot be opened.**
Memory's `profile-columns-are-mostly-empty` reads that emptiness as creators declining to fill it
in. They were never asked.

⚠️ **And it means four funnel events cannot fire at all.** `demo_fix_open`, `demo_wall_shown`,
`reveal_shown`, `checkout_open`(walkthrough site) are emitted only from `beats.ts`/`walkthrough.tsx`.
Their 0 counts are a **code fact, not user behaviour** — do NOT read `demo_view 23 → demo_fix_open 0`
as "23 people bounced at beat 1". I nearly did.

---

## 3. The funnel instrumentation cannot answer the question it exists for

`FUNNEL_EVENTS` declares 22 events. **9 have a call site. 3 have ever fired.**

```
fired:            start_landed (320 ev / 257 sessions) · demo_view (23) · activation_wall_shown (7)
live but 0:       checkout_open · checkout_paid · first_card_shown
unreachable:      demo_fix_open · demo_wall_shown · reveal_shown          (§2)
never instrumented: demo_pick · demo_scrub · otp_start · otp_done · handle_submit ·
                  calibrate_done · video_submit · gap_shown · intention_set ·
                  prediction_checked · renewal_notice_seen · trial_converted
```

Two specific traps in reading this table:

- **`first_card_shown = 0` does NOT mean no card was ever shown.** It fires only from
  `handleActivationCardRun` — the activation CTA in the audience intro. It means nobody ever
  pressed *that button*. Cards made by typing into the composer emit nothing.
- 🔴 **`funnel_events` records no origin.** No host, no referrer. Dev shares prod's Supabase, so
  **the 257 `start_landed` sessions cannot be separated from my own localhost runs.** Treat that
  number as unusable until an origin column exists. That is the single highest-value one-line fix
  in this document.

---

## 4. The four UI bugs — fixed, measured on a prod build

Re-measured before and after at 393×660 and 1200×729, native contexts.

| # | fix | before | after |
|---|---|---|---|
| **F-13** | composer backdrop guillotine | `background-image: none`, flat `rgb(31,31,30)` | 40px fade (`.composer-veil`), `fadesAtTop: true` both viewports |
| **F-14** | zero headings in the thread | `headings: 0` | **`headings: 8`** — `h1` document · `h2` per turn · `h3` per card |
| **F-18** | ☰ overlays the first line | text sliced mid-word by the opaque burger | 66px `.nav-scrim` band, faded, `pointer-events: none` |
| **F-19** | 84 tap targets under 40px | 84 (box measure) | **4 residual**, and the count is no longer the right instrument — see below |

Screenshot evidence: `.scratch/rewalk-mobile.png` — the top line now dissolves under the band, the
composer's top edge fades instead of cutting.

### F-13 / F-18 are MASKS, not gradient fills

Both keep `bg-background` and fade with `mask-image`. Deliberate: a hand-written
`linear-gradient(#1f1f1e …)` would re-type the page colour as a hex literal, which is exactly the
drift `design-token-drift.test.ts` exists to catch. Pure alpha also dodges the grey haze engines
produce interpolating through `transparent`.

⚠️ **`probe-audit-rewalk.mjs` read only `backgroundImage` and reported `"none"` on the working
fade.** It now reads `maskImage` too and returns a `fadesAtTop` verdict. Had I trusted the old
field I would have re-opened F-13 as a false regression.

### F-19: the count was measuring the wrong thing, in both directions

Enumerating the 84 (`scripts/probe-tap-targets.mjs`, new) changed the problem:

- **58 of 84 were in the closed off-canvas drawer**, and **39 of those were `opacity-0` hover
  affordances** — pin/rename/delete, 22×22, three per thread row. On touch there is no hover, so
  every thread row carried three *invisible, live* hit zones, and the rightmost was **`Delete
  thread`**. That is the real defect; the size was the lesser half. Now `pointer-events-none` while
  hidden, revealed on the active row on coarse pointers. **Measured `invisibleButPressable: []`.**
- **A box measurement cannot see the fix.** The remedy for an inline text affordance is a `::after`
  halo (`.tap-44`), which makes a 47×18 "Copy" a 44×44 *target* while its rect stays 47×18 forever.
  So the probe now hit-tests: sample the 44×44 square and ask `elementFromPoint` who owns it.

Two false readings that cost time inside that probe, both recorded in its header:
1. Sampling the square's **corners** reads every rounded element as broken — on a 203×44 row with an
   8px radius the corner point is outside the shape. 11 of 15 "failures" were pure `border-radius`.
   It samples **edge midpoints** now.
2. `elementFromPoint` only answers for on-screen pixels. Judging an off-canvas drawer or a
   scrolled-away card where it sits returned 89 failures out of 92 controls — including elements it
   had itself measured at 44px. It now scrolls the thread, opens the drawer, and judges each element
   only where it is genuinely visible.

**Residual 4, all understood, none worth chasing:** the last follow-up chip loses one sample point
to the composer dock above it (inherent to a floating dock); `Search threads`'s halo is clipped by
the drawer's own `overflow` (documented limitation of the utility); two sidebar rows are duplicate
row instances that hit-test SELF at all five points when actually visible.

**Honest residual:** the sidebar's pin/rename/delete are **30×44**, not 44×44. Three 44px halos
2px apart would overlap by 20px and the later sibling would win the tap — worse than small. 30px is
the most width a 220px drawer can spare. Fixing it properly is a design call (a `⋯` menu), not a
CSS one.

---

## 5. Two guards I broke, and why the tests were right to fail

Both failures were the tests measuring a *proxy* instead of the thing they name — the same shape as
this lane's standing lesson. Neither was loosened; both were made stricter.

1. `home-page-layout.test.tsx` asserted `queryByRole('heading', {level:1})).toBeNull()` as a proxy
   for **"the greeting is gone"**. My `sr-only` "Conversation" `h1` is not a greeting. Now asserts
   on the greeting's own words *and* its promise line — which the same file's third case already
   warns is the only assertion that catches a regression dropping both.
2. `composed-card-block.test.tsx` compared `container.textContent` indices to prove **layout order**.
   The card's new `sr-only` `h3` repeats the hero line above the eyebrow, so `indexOf` started
   resolving to the hidden copy. `textOf` now strips `.sr-only`, so it means *visible* text.

---

## 6. Do next, in order

1. ✅ **DONE (#497).** Add an origin/host column to `funnel_events` — until then every top-of-funnel
   number is contaminated by localhost and cannot be quoted (§3). Shipped with `path` alongside it.
2. 🔴 **Decide the three orphans (§2): mount them or delete them.** Each is a permanent 0 in a
   metric someone will read as a preference. The interview is the expensive one — it is the input
   `profile-columns-are-mostly-empty` is about.
3. ~~**The product question is not an engineering one.** The engine has been tuned for weeks against
   an audience of zero. Nothing in this repo will change that number; distribution will. Any further
   engine work should be scheduled *after* a decision about how a first real creator arrives.~~
   ⛔ **RETRACTED — see §8.** The owner ruled the opposite on 2026-08-13: being unlaunched is not a
   reason to stop building. The measurement stands; this inference from it did not.
4. ✅ **DONE (#497).** Instrument `handle_submit` and `calibrate_done` — they bracket the ~128s
   blocking Apify scrape on `/welcome`, which is the most likely genuine drop-off and was
   completely unmeasured. See §8 for how to read the rate, and for the two things about it a
   future session must not re-derive.
5. Unchanged from the previous handoff and still true: `templateInstantiated` is CORRECT, do not
   revert it. F-1 still live at ~8%.

---

## 8. What §6 turned into (added after the fact — #497)

**§6.1 and §6.4 are shipped.** `funnel_events` now carries `origin` (Host header) and `path`
(pathname from Referer, query discarded), both server-derived and never accepted from the body —
same rule the route already applied to `user_id`. `handle_submit` and `calibrate_done` now bracket
the ~128s calibration.

Three things about that work that a future session must not re-derive:

- ⚠️ **The DDL is applied to PROD already**, via the SQL-editor path (`execute_sql`), NOT
  `supabase db push` — the ledger has drifted here and push is unsafe. The migration file
  `20260813120000_funnel_events_origin.sql` is the **record, not the mechanism**; a push will not
  reproduce it and does not need to.
- ⚠️ **Pre-2026-08-13 rows have `origin IS NULL` and must stay that way.** Their origin is
  genuinely unknown. Backfilling a guess would launder the exact contamination the column exists
  to expose. **Every traffic query must filter them out, not assume they were production.**
- **`calibrate_done` fires on EVERY exit**, including a failed scrape, with `calibrated: false`.
  That is deliberate: instrumenting only the success path would report a 100% completion rate while
  people were being dropped, which is worse than no metric — it would read as proof the wait is
  fine. Read the rate as `calibrate_done{calibrated:true} / handle_submit`, never as
  `calibrate_done / handle_submit`.

**None of it is deployed, and that is deliberate.** Prod last shipped 2026-08-07; deploy is OFF,
**owner-confirmed 2026-08-13** (`NEXT-SESSION-2026-08-14-remix.md`). So this instrumentation is a
**deposit, not a dashboard** — it reads nothing until launch, which is fine: call sites are the
expensive half to retrofit and they are now correct. Do not go looking for numbers in it, and do
not propose reconnecting the deploy.

⚠️ **§6.3 IS RETRACTED.** It said the engine work should wait on "a decision about how a first real
creator arrives". The owner ruled the opposite the same day: *"'nobody uses it yet' is NOT an
argument against building — the product is unlaunched; that is the normal state of unshipped
software. Build the thing."* §0's measurements stand and are worth keeping — they stop anyone
quoting probe traffic as user evidence. **They kill claims, not work.** §6.2 (the three orphans)
is untouched and still the open question.

---

## 7. Reproducing

```bash
npm run build && npm run start -- --port 3016
node scripts/mint-auth-state.mjs      http://localhost:3016
node scripts/probe-audit-rewalk.mjs   http://localhost:3016 <threadId>   # F-13/14/18/19 + masks
node scripts/probe-tap-targets.mjs    http://localhost:3016 <threadId>   # hit-tested targets
```

⚠️ Audit on the **prod build**. In dev the Next.js indicator and the mock-panel ⚙ sit exactly over
the composer's attach button and read as a covered tap target (`dev-overlays-fake-ui-bugs`).
⚠️ `.scratch/auth-state.json` is a REAL session for a REAL prod account. Gitignored; keep it so.
