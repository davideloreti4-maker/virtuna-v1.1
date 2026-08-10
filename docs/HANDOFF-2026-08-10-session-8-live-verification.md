# Handoff — session 8: session 7's work, walked signed-in (2026-08-10)

**Lane:** `lane/in-thread-chat` · worktree `~/virtuna-in-thread-chat`
**Brief:** verify session 7 through the real app · **Predecessor:** `docs/HANDOFF-2026-08-10-session-7-thread-context.md`
**Outcome:** both flags walked signed-in through `/api/tools/chat`, raw frames + real browser.
**No source changes.** Nothing merged, nothing deployed (Vercel disconnected).

Gates on the unchanged lane HEAD: `tsc` clean · prod build clean · **5,855 passed / 0 failed**.
Spend: **13 hooks runs / 13 credits** on the e2e account.

---

## 1. 🔴 Read this first — the digest evicts grounding, live

Session 7 left this as an open item: *"The digest under a calibrated audience. The A/B used
`audience: null`. The interaction between the digest and the audience `overrides` block is
untested live."* It is now tested, and the interaction is real.

**Measured through the route**, on a pinned repeat-ask run with a calibrated audience active:

```
convBlockLen    838      the digest fence
corpusLen      2779      the grounded examples
lenWithCorpus  6183      > BUNDLE_CHAR_CAP (6000)   → corpus SHED
lenNoConv      5343      < 6000                     → without the digest it FITS
```

**838 chars of digest cost 2,779 chars of grounding.** The shed order works exactly as designed —
corpus is the lowest tier and yields first — but the consequence is that turning the digest on
silently turns grounding off on precisely the runs where both apply.

### 1.1 Why the cap looked sufficient and is not

`CONVERSATION_CHAR_BUDGET = 700` bounds **only `turns`**. `cardsOnScreen` (up to 6 × 120 chars) sits
entirely outside it, as do the two contract sentences and the fence. Measured
(`.scratch/measure-digest-cost.ts`, free, deterministic):

| | chars |
|---|---|
| `CONVERSATION_CHAR_BUDGET`, as documented | 700 |
| `turns` at the budget | 640 |
| `cardsOnScreen`, unbudgeted | 714 |
| **emitted block, turns only** | **954** |
| **emitted block, turns + cards** | **1,844 — 2.6× the documented budget** |

So the `BUNDLE_CHAR_CAP` comment's *"worst realistic bundle (~5,585 = corpus 2800 + overrides +
anchor + 5 cards + a full profile + **the conversation digest** + labels)"* modelled the digest at
700. At its true size the same bundle measures **6,100** — over the 6,000 cap by 100.

Verified by mutation: raising the cap to 8000 makes every `SHED` disappear and prints 6,100. The
probe is sensitive to the cap, not printing a constant.

| bundle (hooks, real prod profile shape) | 6000 cap | 8000 cap |
|---|---|---|
| corpus 2800 + overrides, no digest | 4,256 ✓ | 4,256 ✓ |
| \+ digest (turns only) | 5,210 ✓ | 5,210 ✓ |
| \+ digest (turns + cards) | 3,237 ⚠ **corpus shed** | 6,100 ✓ |
| corpus 2800 + digest(max), **no** overrides | 5,662 ✓ | 5,662 ✓ |

The calibrated audience is what tips it — same shape as session 7 §1.2, one tier further down.
Note `measure-bundle-headroom.ts` could never have caught this: **it never passes a `conversation`
at all**, so that line of the comment was reasoned, never measured.

### 1.2 What I did NOT establish

I measured that grounding is **dropped**. I did **not** measure what dropping it costs the output.
Whether a digest is worth more than a corpus on a repeat ask is a real question and it is unanswered
— the shed order asserts an answer ("there is only one creator"), but nothing has A/B'd it.

**Fix options, unimplemented (your call):** budget the whole digest rather than `turns` alone; or
raise the cap ~500; or drop `cardsOnScreen` to 3 lines. The first is closest to what the constant
already claims to do. I did not touch it — it is a live change to unflagged assembler behaviour and
the trade-off above is undecided.

---

## 2. The digest arrives through the route ✅

Fresh thread `699677c9`, three turns, `ENGINE_GEN_CONVERSATION=true`, signed in.

Turns 1–2 were conversational (no dispatch). Turn 2 stated three checkable constraints. Turn 3 asked
`"hooks about morning focus routines"` — **carrying none of them**.

The hooks run's bundle, dumped from inside `assembleBundle`:

```
mode hooks   len 5946 / 6000
sections  [Writing voice, This conversation so far, Creator ask, Per-request overrides, Grounded examples]
conversation kept   corpus kept   digestTurns 2
profileLines  niche · target audience · writing voice · target platform     ← all roles survived
```

All five hooks obeyed all three constraints: ≤12 words (9, 10, 9, 6, 7), no 5am angle, no questions.
**0 violations.**

**Headroom: 54 chars.** This run fit; §1 is the same run's shape one turn later, when it did not.

### 2.1 The calibrated-audience item answered incidentally

The thread's `active_audience_id` is NULL, but `resolveThreadAudience` reads a NULL pin as *the
user's last-used audience*, not General (`resolve-thread-audience.ts:52-55`). So this walk ran under
**`@mrbeast`, calibrated, 10 personas** — visible in the composer as `@mrbeast · CALIBRATED · 25
RANKED`, and in the bundle as the `Per-request overrides` fence. The digest and the overrides block
coexisted with the corpus and the voice at 5,946/6,000.

That also means: **a "General" thread is not an uncalibrated one.** Any future measurement that
assumes `audience: null` because the pin is NULL is measuring the wrong thing.

---

## 3. The repeat-ask pin ✅ — and the defect is depth-dependent

### 3.1 It fires, dispatches, and bills like any other run

Route log on the pinned turn: `repeatAskSkill: "hooks"`, `rawSkill: null`. Real dispatch frame, 5
hook cards, closing line. Billing checked against `reading_events`: at a checkpoint where exactly
**9 runs had dispatched, there were exactly 9 rows**, each `mode=hooks billed=true credits=1
tier=free` — the same row an unpinned run writes. The three defective turns wrote **zero** rows.

### 3.2 The defect reproduced through the route — but only at depth

This is the part session 7 could not see, because it measured the loop with a stub skill.

Thread `870d5430`, flags OFF, the **same ask repeated**:

| repeat | dispatch | cards | what the creator sees |
|---|---|---|---|
| 1 | ✅ | 5 | real pack |
| 2 | ✅ | 5 | real pack |
| 3 | ❌ | **0** | *"Here are 5 hooks that use the **Curiosity Gap**…"* |
| 4 | ❌ | **0** | same |
| 5 | ❌ | **0** | full 5-hook pack **in prose**, with mechanisms |

Repeat 5's answer delivers five finished, numbered hooks with per-hook mechanism notes, in 5.8s,
having **called nothing and billed nothing**. That is session 7 §3.2's finding confirmed on the real
route: not merely a false claim, the paid artefact given away unscored, unsaveable, unbilled.

**Turns 1–2 dispatched correctly.** The defect needs prior packs in the thread — the more precedent
that the work is done, the likelier the model narrates instead of running. A two-turn probe would
have concluded the defect was gone.

### 3.3 The A/B, same thread, same ask, flag only

| | dispatch + cards | no dispatch |
|---|---|---|
| pin **OFF** | 0 | **4** (3 raw + 1 browser) |
| pin **ON** | **5** (2 raw + 3 browser) | 0 |

### 3.4 In the browser

Signed-in Chromium, `/home`, typed into the real composer.

- **Pin OFF** — the creator's bubble "write me 5 hooks about morning focus", then MAVEN: *"**These**
  are designed to be specific and relatable for a comedy storyteller…"* — **no cards**. "These"
  refers to nothing on screen. Follow-up chips offer "Write hooks". Screenshot:
  `.scratch/browser-pin-off-final.png`.
- **Pin ON** — same ask, same thread: a new run receipt, hook cards with VISUAL / WHY IT WORKS /
  "Made for The Passive Dopamine Hit · 12% of your audience" / Write the script → / Save.
  Screenshot: `.scratch/browser-pin-on-final.png`.

---

## 4. The pin does NOT over-fire on real traffic ✅

Session 7's open item: *"tuned against 151 historical PAIRS; no live sample."* A pair is not traffic.

`.scratch/probe-repeat-ask-traffic.ts` replays **every open thread in the app** exactly as the route
sees it — rehydrate → `openChatPriorTurns` → `detectRepeatAsk` at each user turn, in order:

```
threads with messages ......... 180
creator turns ................. 360
…in a thread already holding a run:  62
PIN WOULD FIRE ................ 4     (1.11% of all turns · 6.45% of eligible)
```

**All 4 firings score exactly 1.00 — verbatim repeats.** No judgement calls. The highest-scoring
non-firing pair the detector can actually reach scores **0.44**.

> clear air on real traffic: **(0.44, 1.00]** — against the **(0.67, 0.75]** the synthetic pairs
> suggested. The threshold could be anywhere in that range and behave identically here. 0.7 is safe
> with a very wide margin.

> ⚠️ **§4 was written before §11 and its conclusion is wrong.** The 0.44 pair is not clear air —
> it is an instance of the defect the pin exists to prevent, i.e. a **false negative**. Read §11.

Three things worth carrying:

1. **2 of the 4 firings are this session's own walks.** Historically it is **2 fires in 358 turns**.
2. **`"Write the script from this hook."` vs the same string** scores 1.00 — but *"this hook"* may
   point at a **different** hook the second time. Identical text ≠ identical request. It is also
   most likely a card CTA, in which case `rawSkill` is set and the detector is never consulted
   (the replay cannot distinguish typed from chip-issued, so it over-counts). This is the one shape
   where 1.00 can still be a false pin.
3. **`"Give me a few more hook options."` scores 0.14–0.20 → never pins.** The pin catches verbatim
   re-asks, not "more". Per the design's own asymmetry (a miss costs nothing) that is correct, but
   it means the pin does not cover the commonest *phrasing* of a re-ask.

---

## 5. What I could NOT verify

- **Production.** Local dev + the shared prod DB. Vercel disconnected; nothing deployed.
- **That the digest IMPROVES output through the route.** Walk A was **single-arm** (flags on, n=1).
  5/5 constraint obedience is consistent with session 7's 9→1, but I ran no route-level control, so
  I cannot separate the digest from the model simply doing well on that ask. The arrival is proven;
  the benefit through the route is not.
- **What losing the corpus costs.** §1.2. Measured that it is dropped, not what it is worth.
- **The digest's rewrite path.** `includeCards: false` (a chip carrying a `cards` pack) was never
  exercised live — no chip-with-pack walk. The mutual-exclusion contract is unit-tested only.
- **The pin for a sealed/anonymous visitor**, and **the pin beside a real chip** (`rawSkill` wins).
  Both read correct in the route; neither was walked.
- **Mobile.** Desktop 1200×1000 only. (Memory: resizing a loaded page is not a mobile walk.)
- **More than one account.** One profile shape, one calibrated audience, one niche. The bundle sizes
  in §1 are that account's; a creator with a 224-char voice sample (the prod max — this account's is
  37) sheds ~190 chars sooner.
- **Whether 6 turns / 700 chars are the right window.** Unchanged from session 7, still untuned.
- **The `omni-analysis-*` flakiness.** My first suite run failed 11 tests across 4 files, all
  `Test timed out in 5000ms`, while `tsc` ran concurrently; two later runs alone were fully green.
  Consistent with CPU contention, **not proven** to be only that.

---

## 6. Recommendation on the flag flip

Mine, not a decision. **Superseded in part by §11 — read that first.**

- **`ENGINE_REPEAT_ASK_PIN` — safe, but it buys much less than §3 suggests.** The defect is real on
  the route, reproducible, and visible in the product; the pin corrects it 5/5; it bills exactly
  like any other run; it never false-pins on real traffic. But §11 measures its *coverage* and the
  answer is **0 of 5 historical instances**. It is a correct fix for a shape that barely occurs.
- **`ENGINE_GEN_CONVERSATION` — hold until §1 is decided.** It works and it arrives, but as it
  stands, switching it on switches grounding off on repeat runs, silently. That trade may well be
  right — it is just not one anyone has chosen yet, and it should not be made by a character count.

The two interact: **the pin makes the digest's worst case the common case**, because a pinned run is
by definition a second run in a thread, which is exactly when `cardsOnScreen` is populated.

---

## 7. Traps learned this session

- **A Supabase `.select()` on a column that does not exist returns an ERROR, not a filter.** I read
  `threads.status` and `audiences.is_calibrated`, ignored `error`, and concluded the e2e account had
  **0 threads and 0 audiences**. It has 159 and 2. Every probe here now checks `error` and throws.
  A silently-empty result set reads exactly like a true negative.
- **A NULL `active_audience_id` does not mean General** — it resolves to the last-used audience. A
  probe that assumes "unpinned ⇒ uncalibrated" is measuring something else.
- **The thinking indicator is not a liveness signal for a dispatched run.** It read 0 at 1.8s on a
  turn that took 20s, so an early-exit poll loop reported "finished, no cards" on a run that had not
  started. Two browser walks produced confident wrong deltas before this surfaced.
- **Count the UI only after rehydration settles.** Counting at composer-mount read 0 receipts while
  the thread was still painting, making every later delta a fiction.
- **A defect that needs depth is invisible to a short probe.** Repeats 1–2 dispatched; 3–5 did not.
- **Run `tsc` and the suite sequentially.** Concurrently, 11 tests fail on 5s timeouts and it looks
  like a real regression.
- **The launchd dev-server reaper is real** — the server died mid-session with no error (memory:
  `dev-server-reaper.md`).

---

## 8. Harnesses (`.scratch/`, gitignored — **not versioned, copy before removing this worktree**)

```bash
# free, no network
node node_modules/tsx/dist/cli.mjs .scratch/measure-digest-cost.ts          # §1 the eviction + mutation check
node node_modules/tsx/dist/cli.mjs .scratch/probe-repeat-ask-traffic.ts     # §4 the 180-thread replay
node node_modules/tsx/dist/cli.mjs .scratch/inspect-audiences.ts            # which audience a thread resolves to
node node_modules/tsx/dist/cli.mjs .scratch/inspect-billing.ts              # the reading_events ledger
node node_modules/tsx/dist/cli.mjs .scratch/count-credits.ts                # spend for a session window

# signed-in walks — mint the cookie first
node node_modules/tsx/dist/cli.mjs .scratch/mint-auth.ts
node node_modules/tsx/dist/cli.mjs .scratch/walk-thread.ts 3011 "ask 1" "ask 2" …   # FRESH thread, all frames
node node_modules/tsx/dist/cli.mjs .scratch/walk-existing.ts 3011 <threadId> "ask"  # one ask into a thread
node .scratch/walk-browser-repeat.mjs <threadId> <label>                            # the real UI + screenshot
```

Dev server, flags on:
```bash
ENGINE_GEN_CONVERSATION=true ENGINE_REPEAT_ASK_PIN=true \
NEXT_PUBLIC_ENGINE_ONE_BRAIN=true DEBUG_BUNDLE=1 \
node node_modules/next/dist/bin/next dev --turbopack --port 3011
```

### 8.1 The `DEBUG_BUNDLE` instrumentation — reverted, reproduce from here

The bundle dumps in §1–§2 came from a temporary env-gated `console.error` at the end of
`assembleBundle` (mode, len, cap, fence labels, surviving profile role lines, `conversation`/`corpus`
kept-or-shed, `convBlockLen`, `corpusLen`, `lenWithCorpus`, `lenNoConv`) and one in `route.ts`
reporting `repeatAskSkill`. **Both reverted — the lane HEAD is unmodified.** Backups:
`/private/tmp/claude-501/…/scratchpad/{assembler,route}-instrumented.ts.bak`.

It reports **which roles survive**, never an output length — the §1.2 rule from session 7.
It is worth re-adding for any future bundle question; it is the only way to see what the generator
actually received through the route.

---

## 9. The question underneath — 3 of 18 open the profile interview

Not an engineering answer, and I did not go looking for one. Two observations from this session that
bear on it:

1. **The e2e account is one of the filled ones**, and its filled profile contributes **four role
   lines** to a hooks bundle (niche, target audience, voice, platform) and **three** to chat. Its
   *calibrated audience* contributes an overrides block, 10 personas, per-card "Made for The Passive
   Dopamine Hit · 12% of your audience", and the only voice sample that exists. The asymmetry
   session 7 flagged is visible in the product surface, not just in the coverage counts: the
   audience is doing the grounding work, and it is the thing nobody had to fill in.
2. **The interview's own cost is why its data is scarce, and the cheap data is already free.** The
   voice sample is card **9**. Meanwhile `writing_style_sample` is derived at calibration for 6 of
   13 audiences without anyone typing anything.

If it were mine to call I would not try to raise interview completion; I would ask what else can be
derived at calibration, since that path already out-covers the typed one 6/13 vs 2/18. But that is a
product call and it is yours.

---

## 11. 🔴 How big is the defect, and how much of it does the pin cover?

Asked because §4 measured the pin's *fire rate* and nothing measured its *coverage*. A pin that
never misfires is not the same as a pin that helps.

`.scratch/probe-honesty-defect.ts` walks every assistant text turn in every open thread and flags
the ones whose prose claims a delivered artefact while **zero result blocks** were persisted beside
them. It works off the raw rows, not `openChatPriorTurns`' `toolRuns` — that field only attaches
when `origin === "chat-agent"`, so the old chat path would have scored as one long lie.

```
assistant text turns .................... 414
…claiming a delivered artefact .......... 39
   · with cards actually persisted ...... 26   honest
   · with ZERO cards .................... 13   ← screened as the defect
…an honest credit refusal / guard ....... 71   not a defect
…answering a STRATEGY ask (no such tool)  245  not a defect
```

**Hand-judged, the 13 are ~9 real** (4 are pushbacks that *quote* generic ideas in order to reject
them — "The obvious list would be: batch cook on Sunday…" — which the screen cannot tell from a
delivery). **4 of the 9 are my own induced runs from this session.**

> **Of the 5 historical instances, the pin catches 0.**

Three distinct shapes, none of them reachable:

1. **First-ask narration.** `377c0c52` is a two-row thread: the creator's first ever message,
   `"3 hooks for my new format day in the life of a 1b $ company ceo"`, answered with *"Here are
   three hooks for the…"* and no cards. `detectRepeatAsk` requires a prior run **of that skill** in
   the thread. On a first ask there is none, so the pin is structurally unable to fire — and this is
   the worst case for the creator, who has seen the product do nothing correct yet.
2. **A same-topic re-ask below threshold.** In `f5bdbadb`, `"i launched a budgeting app for
   students. give me hooks for it"` produced 5 real cards. Four turns later, `"give me hooks for my
   student budgeting app that stops food delivery overspending"` produced *"Five hooks are on
   screen."* and **zero cards** — the exact sentence `chat-prior-turns.ts` exists to fix. Similarity:
   **0.444, against a 0.7 threshold. Misses by 0.26.**
   This is the same pair §4 reported as the top of the clear air. It is not clear air. `repeat-ask.ts`
   already calls it *"arguably the SAME request, so 0.7 is the conservative reading"* — measured
   against outcomes rather than intuition, that conservatism costs the catch.
3. **`"Give me a few more hook options."`** — scores 0.14–0.20, never pins. In `f5bdbadb` it produced
   no cards twice and real cards once. Stochastic, and the commonest phrasing of a re-ask.

### What this implies

The pin keys on **the shape of the ask**. Every miss above is a case where the ask looked different
but the *output* was the same lie. The one thing all 9 share is observable at the other end: **the
turn ended with no tool call and prose claiming an artefact.**

That seam already exists — the loop inspects streamed text for the artefact guard — and it has the
property the threshold does not: **a check on the output costs nothing when it is wrong.** The pin
must be conservative because a false pin spends a credit; a post-hoc "you claimed cards and called
nothing" check spends nothing and can be applied to every turn. It also keys on the defect itself
rather than a proxy, which is the principle `repeat-ask.ts`'s own header argues for.

**Not built, not designed — this is an architecture call and it is yours.** Flagging it because it
is a materially better lever than tuning 0.7 downward, and because lowering the threshold to catch
the 0.44 case would put it 0.03 above `"write me 5 hooks about cold brew coffee"` vs
`"…about sourdough baking"` (0.29) — i.e. the margin stops being comfortable.

### Caveats on these numbers

- **The corpus is small and partly synthetic.** 414 assistant turns, 180 threads, several of them
  seeded probe threads (five identical `"Test how my audience would react to this hook"` threads).
  Treat the *shapes* as the finding and the *rate* as indicative.
- **The 4 pushback false-positives are a screen limitation, not a measurement of the model.** A
  regex cannot separate "here are the ideas" from "the ideas anyone would produce are, and they are
  bad". Every one was read by hand.
- **I did not judge the 26 "honest" claims.** They had cards beside them; I did not check the prose
  matched the cards. Walk B turn 1 this session produced an enumerated prose pack that did **not**
  match its own cards, so that class is not clean either — just not measured.

---

## 10. Commits

```
(this document only — no source changes this session)
```
