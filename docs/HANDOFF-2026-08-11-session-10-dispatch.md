# Handoff — session 10: dispatch reliability, measured. The trigger is the SUBJECT'S SHAPE (2026-08-11)

**Lane:** `lane/in-thread-chat` · worktree `~/virtuna-in-thread-chat`
**Brief:** session 9 §15 — run the dispatch experiment FIRST, do not build the fix before the
measurement.
**Predecessor:** `docs/HANDOFF-2026-08-11-session-9-current-turn.md`. Its §15 is now answered;
everything else in it still stands.
**Nothing merged, nothing deployed, nothing built.** No `src/` change survives this session.

Gates: **not run** — `src/` is untouched at the end of the session (the one edit was experiment
scaffolding, reverted; see §6). Spend: **0 credits**, 183 generations through the stub till.

---

## 0. ▶️ START HERE

**§15.2 is answered, and the answer is unambiguous: the pushback protects nothing.**

But the bigger finding is one session 9 could not see, because its probe varied only the ask's
*wording*. The trigger is **the shape of the SUBJECT**, and it is close to deterministic:

| unpinned, first turn | dispatch |
|---|---|
| subject is a **product / app / show / format** — *"my student budgeting app"*, *"my new stand-up comedy podcast"* | **7/31 · 23%** |
| subject is a **scenario / premise** — *"my roommate never paying me back"*, *"filing my taxes for the first time"* | **30/30 · 100%** |

Fisher exact **p = 5.4e-11**. The ask's shape is identical across both rows — *"give me hooks for
X"* — and only X moves.

**Niche fit is NOT the trigger, though every pushback blames it.** An **in-niche** product for this
comedy-storytelling profile — *"my new stand-up comedy podcast"* — scored **0/8**, worse than the
off-niche one. The model states the false belief outright:

> *"'Stand-up comedy podcast' is the format, not the hook."*
> *"'Student budgeting app' is the product, not the hook."*

It is wrong. Pinned, the same subjects produce good on-brief packs every time.

**What this costs.** *"give me hooks for my \<the thing I am promoting\>"* is the single most
common real generation ask there is, and it fails **77%** of the time. Session 9 estimated 25%.

**The free fix was tried first and it failed** (§5.1, 80 runs). A clause written against the exact
false belief moved the product cell 3/10 → 7/10 (**p = 0.179**, not significant) and the format cell
**0/10 → 1/10** (p = 1.0). Two clauses composed *worse* than one. That is the **fourth** measured
prompt-only failure in this lane; treat wording as a dead lever on this surface.

**Do next — §7 has the recommendation:**

1. 🔴 **Pin round 1 when `guessSkill` fires — option C, §11.3.** ⚠️ This SUPERSEDES §7.2/§7.3, which
   recommended the retry (A) and framed the blocker as a streaming-UX trade. §11 measured
   `guessSkill` on the app's own history and found **A is not the safer option**: its trigger is
   "guessed AND the model called no tool", and a false positive is by definition an ask the model
   is right to decline — so that condition *selects* for false positives instead of filtering them.
   Identical exposure (~3.4% of fires, the same two asks), and A additionally costs ~2–3s of
   unscopable buffering plus new machinery. Read §7.2/§7.3 for the retry's mechanics, §11 for why
   it is not the recommendation. **The owner's call is now one number: is a ~3.4% wrong-run rate on
   fires acceptable to take the core action from 23% to ~100%?**
2. ✅ **The honesty defect is re-measured (§7.4)** — session 9's queue item 2, done free on this
   session's own corpus. It has NOT evaporated (~7 of 98 no-tool turns hand over a full prose pack),
   but it is **a different shape than §4 was designed for**: the model never falsely claims a card
   exists (0/98), it just does the tool's job itself. A claim-detector would find nothing. And every
   case is a non-dispatch, so **the dispatch fix subsumes it** — §15.1's prediction, now on 98 turns
   instead of 3.
3. **Left for next:** the verdict-narration design call (§12.4 of session 9). Untouched.

⚠️ `.scratch/` is gitignored and now holds **84 files** — every number here is reproducible from
them, and they are the only copy. Copy them out before any `git worktree remove`.

---

## 1. What was run

183 generations through the real loop, real Qwen, real pipelines, real prod profile + the
calibrated `@mrbeast` audience, **stub billing seam** (gate allows, bill is a no-op).

**Zero credits, and zero Apify — verified, not assumed.** 80 of the 183 runs delivered a real pack
through the real pipeline. The probe window was **10:04:56–10:35:57Z**; the newest row in
`reading_events` for this user is **09:21Z**, 43 minutes before the first run, and today's 9 rows
(21 credits) all predate the session. So 80 delivered generations produced 0 ledger rows.

⚠️ Those 9 rows are not mine and are the same warning session 9 recorded: the e2e account is a REAL
prod account shared with whatever else touches it. Never read a day's total as one session's spend.

The Apify part is structural and worth writing down, because two of these arms used brand-new topics that miss the
grounding cache: `gather-for-run.ts` is **explicit-only** (`allowScrape`, owner call 2026-07-17) and
the chat-agent path never sets it, so a cache miss degrades to a partial or to ungrounded — it never
reaches for a paid pull. A new topic is free here. Verified in the logs: every run either logged a
cache HIT or degraded.

| harness | what it is |
|---|---|
| `.scratch/probe-dispatch.ts` | run 1 — six arms, 8 seeds/cell. Verbatim record; predates the shared lib |
| `.scratch/dispatch-lib.ts` | the ONE runner everything after run 1 shares (§8 on why) |
| `.scratch/probe-dispatch-power.ts` | run 2 — 14 fresh seeds on the three cells run 1 left underpowered |
| `.scratch/probe-dispatch-2x2.ts` | run 3 — the 2×2 that separated subject shape from niche fit |
| `.scratch/analyse-dispatch.ts` | scoring, separate from collection, so it can change after the fact |
| `.scratch/probe-dispatch-prompt.ts` + `.scratch/dispatch-prompt.patch` | run 4 — the prompt arms, plus the reverted directive patch they require |
| `.scratch/score-honesty-defect.ts` & `.scratch/score-prose-packs.ts` | §7.4 — the two §11 screens, both mis-calibrated then read |
| `.scratch/dispatch-runs.jsonl` | all 183 runs, appended before the next starts — a crash loses nothing |

---

## 2. The §15.2 answer: the pushback is not protecting quality

The experiment §15.2 asked for: on the seeds where the model pushed back, pin and compare output
quality against the pushback it replaced.

| | |
|---|---|
| control, unpinned | **2/8** dispatched (run 1's cell) |
| **the 6 seeds that pushed back, PINNED** | **6/6** dispatched |
| the same 6 seeds, unpinned, fresh seed | **1/6** |

Mechanically the packs are indistinguishable:

```
unpinned runs that CHOSE to run    5.0 cards · 15.1w avg · on-topic 4.0/5 · distinct 5/5
PINNED runs that had pushed back   5.0 cards · 13.9w avg · on-topic 3.8/5 · distinct 5/5
```

The mechanical row is a screen, not the verdict, so all six pinned packs were read. They sit in the
same band, same voice, same motifs as the two the model chose to run. A sample of what a pushback
was suppressing:

> *"My bank account called me crying at 3 AM."*
> *"POV: You're trying to explain to your parents why your bank app looks like a horror movie."* (control, chose to run)
> *"Look at this outfit. Now look at my bank account."*

**Verdict: narrow the pushback hard.** It is articulate, confident, and wrong — the pipeline handles
the subject it refuses.

### 2.1 🔴 A plain retry is NOT a fix — this corrects §15.3

Session 9 §15.3 proposed "if round 1 produced no tool call on a clear generation ask, retry round 1
pinned", and framed the pin as the mechanism. The **pin** is load-bearing; the **retry** alone is
not. Re-running the same ask unpinned on a fresh seed dispatched **1/6 (17%)** — statistically the
same draw as the 23% base rate, because the input is identical and nothing about the model's
disposition has changed.

One unpinned retry would take 77% failure to ~59%. The pin takes it to 0%.

**Also: the seed does not pin sampling here.** Run 1 seed 1000 dispatched in the batch and did NOT
in the smoke run that preceded it, same input. So "same seed" pairing in these probes is nominal —
treat every run as an independent draw. This matters for reading session 9's own table, where arm A
and arm B differ at a shared seed on a round-1 decision that both arms build identically.

---

## 3. The 2×2 that overturned the first explanation

Run 1's on-niche arm moved two variables at once — the subject went from off-niche **and** from
product to scenario. Both readings fit, and they imply different fixes: a directive defect that hits
every creator naming what they promote, versus a grounding defect keyed on a profile field that
3 of 18 creators have ever filled in. So it was worth 16 more runs.

```
                in-niche              off-niche
  scenario      22/22  (100%)         8/8   (100%)
  product        0/8   (  0%)         7/23  ( 30%)
```

**A pure row effect.** Subject shape decides; niche fit does not appear. The in-niche product is the
*worst* cell in the table.

This is the finding to carry forward. It also retires the natural first hypothesis — that the model
refuses to work outside the creator's declared niche — which was the reading the pushbacks
themselves invite, since they all cite the niche while doing something else entirely.

### 3.1 Deliberation is visible, and it is not a usable predictor

| | round-1 prose before any card |
|---|---|
| product-subject cells | **29/31** |
| scenario-subject cells | **0/30** |

Perfect separation by subject shape: on a scenario the model calls the tool immediately and says
nothing first. On a product it writes 400–1400 chars of reasoning first — *"You're a comedy
storyteller, not a fintech explainer"* — and then resolves that tension by generating (23%) or by
asking a question (77%).

**But prose does not predict the outcome:** of the 7 product-subject runs that DID dispatch, **5
still wrote prose first**. So "the model is deliberating" cannot be used as a failure signal, and
this is the fact that constrains the retry design in §7.3.

---

## 4. How the 77% actually fails

45 non-dispatches. **None** called a tool and failed; all 45 are pure prose. Sub-modes worth
separating:

- **The sanctioned pushback, keyed on the subject** — the majority. The directive says to push back
  once *"when the ask is too vague or too generic to produce something non-obvious"*, and the model
  applies "too generic" to a named product. Often it offers a numbered menu of angles, which is a
  reasonable-looking answer to a question the creator did not ask.
- **Asking for card text that does not exist** — **6 of 45**, e.g. *"I need the actual text of the
  hooks you want me to generate for"*, *"do you have specific hook lines already drafted?"*. All 6
  had `cardsSlot` on; **0** of the 10 slot-off non-dispatches did. ⚠️ **This section originally read
  that as the B2 prose CLAUSE firing. §5.2 measured that and it is wrong — the cause is the `cards`
  parameter on the tool SCHEMA. Read §5.2, not this bullet, for the attribution.**
- **Typing a tool call into the chat as prose** — 1 run emitted
  `generate_hooks(topic="stand-up comedy podcast", anchor=None, count=None, cards=[])` as creator-
  visible text. The model asserted the intent and failed to express it as a call. Its own kind of
  bug, and further evidence that a pinned retry honours the model's decision rather than overriding
  it.

**The aggregate cards-slot rate is NOT significant**: 7/23 with the clause vs 12/22 without,
**p = 0.136** across 45 runs. So the clause is a contributor, not the cause, and removing it cannot
be the whole fix — slot-off still fails 45% of the time. The 6/6-vs-0/10 wording attribution above is
the strong claim; the rate difference is not.

### 4.1 It is not skill-specific

Same plain shape, same product subject, other generators: **ideas 0/4**, **script 2/4**. The script
pushback says the quiet part: *"The topic 'student budgeting app' is too generic."*

---

## 5. The prompt arms — the free fix, tested before the structural one

Two candidate one-clause changes, both aimed at what was actually measured, run behind env vars in
`toolUseDirective` (scaffolding, reverted — §6):

- **V1 · the subject clause.** *"A named product, app, show, newsletter, course or format IS a
  workable subject — deriving the specific premise, story or angle FROM it is your job and the
  tool's, never something to ask the creator to supply first. Push back only when the ask names no
  subject at all."* Aimed at the verbatim false belief.
- **V2 · drop the B2 rewrite clause, keep the `cards` schema slot.** Run 1's arm 4 removed clause
  and schema together and so could not separate them. Attribution is §4's 6/6-vs-0/10.

Measured on **both** failing subjects — the 23% cell and the 0% cell — because a fix that lifts only
the easier one is not a fix. 10 seeds × 4 variants × 2 asks = 80 runs.

Quality is scored alongside dispatch: **a variant that dispatches more by lowering the bar is not a
fix**, and the packs are printed for reading rather than trusted to the mechanical row.

### 5.1 🔴 RESULT — the prompt fix does not work. Prediction held.

```
variant             app (product)   podcast (format)
V0-control            3/10  (30%)     0/10  ( 0%)
V1-subject            7/10  (70%)     1/10  (10%)
V2-noslotclause       4/10  (40%)     1/10  (10%)
V1+V2                 6/10  (60%)     0/10  ( 0%)
```

- **V1 moves the product cell and not significantly.** 3/10 → 7/10 is **p = 0.179** against its own
  in-process control. Against the pooled 33-run control it reaches p = 0.034, but that pools runs
  from three separate processes and the in-run control is the honest comparison. Best case it leaves
  **30% of asks failing**.
- **V1 does nothing for a FORMAT subject.** 0/10 → 1/10, p = 1.0. *"My new stand-up comedy podcast"*
  is immovable by wording, which is the cell that matters most — it is the harder half of the defect
  and the clause was written to name exactly that case ("show, newsletter, course or format").
- **The two clauses do not compose.** V1+V2 is *worse* than V1 alone on both subjects (6 vs 7, 0 vs
  1). Adding a second instruction degraded the first — the same destabilisation `forceSkill`'s header
  records from session 6's attempt.
- **Quality stayed in band** across all four variants (4.8–5.2 cards, 14.2–16.2w), so nothing
  collapsed; the variants simply did not dispatch.

**This is the fourth measured failure of a prompt-only fix in this lane** (negative instructions,
§10.1 of session 9; the positive instruction, 0/3 in §12.4; `forceSkill`'s 1/3 while destabilising
siblings; and now this). The pattern is consistent enough to treat as a property of the surface:
**wording does not move this model's dispatch decision.** Go structural — §7.2.

### 5.2 ⚠️ And it corrects §4: the sub-mode comes from the SCHEMA, not the clause

The "asks for card text that does not exist" sub-mode was attributed in §4 to the B2 **prose
clause**, on a 6/6-vs-0/10 split. V2 tests that directly by dropping the clause and keeping the
`cards` schema slot — and the sub-mode **survives**:

| | asks for card text |
|---|---|
| V0 control (clause + schema) | 3/20 |
| **V2 (clause dropped, schema kept)** | **5/20** |
| run 1 arm 4 (clause AND schema dropped) | **0/10** |

So what invites *"do you have specific hook lines already drafted?"* is the **`cards` parameter on
the tool schema itself** — the model reads the parameter list and infers the ask might be a rewrite.
Removing the sentence that describes it changes nothing; removing the parameter removes the sub-mode.

Both measurements are consistent under this reading and only this one. §4's original attribution was
wrong because arm 4 moved clause and schema together, and the clause was the visible half.

**Consequence for any fix:** the sub-mode cannot be fixed by rewording, and the schema slot is
load-bearing for Stage B's "rewrite these" path, so the honest options are to make the slot
**conditional on cards actually existing in the thread** (the loop knows) or to leave the sub-mode
to the retry. Not attempted — 6 of 45 non-dispatches, the minority failure.

---

## 6. ⚠️ The experiment scaffolding, and that it is reverted

Measuring a directive reword needs the directive changed, and `toolUseDirective` is module-private
(not exported), so the probe cannot inject a variant. Two env reads were added to it, the arms were
run, and **the file was reverted** — `git status` clean, `src/` byte-identical to `36739c8d`.

The patch is saved at **`.scratch/dispatch-prompt.patch`** so the numbers stay reproducible. Anyone
re-running §5 must re-apply it; without it every variant silently measures the control, and all four
cells would agree, which is exactly the shape of a probe that measures nothing.

Because `src/` is unchanged at the end of the session, **tsc / suite / build were not re-run** —
there is nothing to gate. They must be run by whoever ships an actual fix.

---

## 7. The recommendation

### 7.1 The free clause fix was tried first, and it is dead

§5.1. V1 leaves 30% of product asks and 90% of format asks failing. Do not spend more of the budget
on wording — four attempts, four failures, and this one was aimed at a belief the model states in so
many words.

### 7.2 Pin on OBSERVED failure — ⚠️ SUPERSEDED by §11.3, kept for its mechanics

At `chat-agent-loop.ts:1054` — `if (calls.length === 0) break;` — when `guessSkill(ask)` is non-null
and no skill has run this turn, discard round 1 and re-run it pinned to the guess.

- Acts on the model's **own observed behaviour**, not on a prediction of the ask. That is what makes
  it safer than pinning every guess (below).
- Costs one cheap completion, on the failure path only. **No credits** — the generation never ran,
  so this retries a *routing* decision, not a paid one.
- `guessSkill("give me hooks for my student budgeting app")` = `"hooks"`, so the retry has a target
  without a model call.
- The free tier composes untouched: a sealed visitor binds no generators, so there is nothing to pin
  and `createArtefactGuard` still owns that path.

**What I would NOT do: pin every guessed generation ask.** `guessSkill` alone is looser than
`ENGINE_REPEAT_ASK_PIN`'s three conditions, and the pre-router's one measured harmful guess
(*"Yes, run the simulate tool on that hook"*) would become a forced billed wrong run.

### 7.3 The owner call the retry needs first — ⚠️ SUPERSEDED by §11.2; the trade it describes is real but C avoids it entirely

**Round-1 text is already streamed to the creator by the time we know there was no tool call.** Left
alone, the retry appends five hooks under *"I need to know the angle first"* — self-contradiction,
and §10.4 of session 9 already saw one such turn read as incoherent.

The fix is to buffer round-1 text on a guessed-generation ask and flush it the moment a tool-call
fragment appears. And §3.1 is why this is a real trade and not a free win: **5 of the 7 successful
product-subject runs wrote substantive prose first** (411–495 chars of genuine framing — *"the angle
that works is the gap between what student budgeting feels like and the reality"*). So buffering
cannot be scoped to the failing runs; it delays first token on every clear generation ask.

> **The call: is ~2–3s of delayed live text on generation asks worth taking dispatch from 23% to
> ~100%?** Today text starts at ~0.5s; the Stage-B predispatch hint already occupies that dead zone.

Second, smaller call: this narrows behaviour the directive **deliberately** sanctions. The data says
narrow it hard — but it is a product call, not a code one.

---

## 7.4 §11 RE-MEASURED — it has not evaporated, and it is a different shape than §11 described

Session 9's queue item 2. Free: the dispatch experiment produced **98 turns where no tool ran**,
through the real loop on real generation asks — precisely §11's population, and 11× the ~9 historical
cases. Scored with `.scratch/score-honesty-defect.ts` then `.scratch/score-prose-packs.ts`; every hit
was read, because §10.4's enumerated-line detector false-positives on angle menus and a count alone
would be worthless here.

**Three findings, and the middle one changes §4's design.**

**1. The false CLAIM does not happen. 0 of 98.** The first screen flagged 25 turns for "says a card
is generated / ready / on screen". All 25 are false positives on reading — the model writes *"Here
are three **angles**"*, which is true. The directive's strongest prohibition (*"CRITICAL — NEVER tell
the creator a card is 'on screen', 'generated', or 'ready' … UNLESS you actually called the tool THIS
turn"*) is the one instruction in this lane that is actually being obeyed.

**2. 🔴 What DOES happen is an honest prose pack — ~7 of 98 (7%).** The model delivers the paid
artefact itself, with no claim to lie about:

> *"Here are 10 hook angles built for your specific voice and audience:"*
> 1. *"I spent $40 on avocados in college and my bank account looked like a crime scene."*
> 2. *"My bank balance hit -$12.50 and I had to ask my mom for gas money…"*
> …9 more, grouped under three archetype headings, each with a mechanism note.

That is `P-control/2002`, and it is a **better-presented version of the hooks product than the cards
are** — sectioned by archetype, with mechanism commentary the real cards do not carry. Six more like
it (`P-control/2005, 2009, 2011`, `P-slot-off/2012`, `V2/app/4006`, `V1+V2/app/4007`), one borderline.

> **Why this matters for §4.** The honesty check was scoped to detect *a claim about an artefact that
> does not exist*. **That shape does not occur.** A detector keyed on false claims would find nothing
> and pass. The real defect needs no dishonesty: the model substitutes itself for the tool and
> describes what it did accurately. What the creator loses is not the truth — it is the product: no
> cards, nothing in the library, no outlier grounding, no scoring, no evidence rail, and nothing a
> CTA can build a script from. The closing line even says *"Pick one of these and I can write the
> full script"* — a pack the product cannot act on.

**3. And it confirms §15.1's prediction exactly: this defect lives entirely inside the non-dispatch
population.** All 7 cases are no-tool turns, and all 7 are on the product-shaped subject that fails
to dispatch. **Fix dispatch and the honesty defect goes with it** — there is nothing left for a
detector to be the primary lever on. §15.1 argued this from 3 cases; it now holds on 98.

### 7.5 Free bonus: session 9's shipped fix independently confirmed at n=80

The same corpus contains 80 turns that DID dispatch, with `ENGINE_CHAT_CARDS_ON_SCREEN` at its
shipped default (on). Session 9's A/B for it ran at n=12 per arm:

| | session 9 (n=12) | here (n=80) |
|---|---|---|
| INVENTED — prose pack ≠ the cards (the §3 defect) | 0/12 | **1/80 · 1.25%** |
| RELISTED — prose repeats the cards (the §12.1 backfire risk) | 0/12 | **0/80** |
| names a real card by its text | 9/12 · 75% | **50/80 · 63%** |

Same band, 6× the sample, and the backfire risk still does not materialise. `8c204865` is earning its
default-ON. Not a new measurement I set out to make — the corpus was already there.

---

## 8. Traps and notes worth keeping

- **A probe's control arm must fail before its treatment arm is believed** (session 9 §10.3). Here
  the control failed *harder* than session 9 measured — 7/31 vs its 3/12 — so the treatment arms mean
  something. The first thing the smoke run did was reproduce the defect on run one.
- **The seed does not make this provider deterministic.** Same input, same seed, opposite round-1
  decisions. Any probe here that reads a seed as a paired control is over-claiming.
- **`dispatch-lib.ts` exists so "did this run dispatch?" has ONE definition.** Two copies of exactly
  that kind of map is how the live tool result came to be blind while the replay path was not
  (session 9 §10.1). A `request_input` block is not a card and must not count as a dispatch — the
  `toolCalls` row is what tells the sub-modes apart.
- **Run 1's arm 5 is a lesson in confounded design.** It moved niche and subject shape together and
  its obvious reading was wrong. 16 more runs overturned it. The pushbacks' own explanation — the
  niche — was the misleading part.
- **A new topic is free in this path**, because grounding is explicit-only. Worth knowing before
  assuming a topic sweep costs Apify money.
- **Session 9's "every dispatching run had 0ch pre-card prose" does not generalise.** Here 5 of 7
  did write prose. It was true of that probe's runs and false as a property of the path.

---

## 9. What I did NOT verify

- **Nothing was measured through the real route.** Every number here is the loop called directly,
  first turn, no `priorTurns`, no persistence. Session 9 §10.3 found the live route reproduced its
  defect at a *higher* rate than the offline probe, so these rates are indicative for production,
  and the *shapes* are the finding.
- **One profile, one audience, one platform** (`tiktok`, comedy/storytelling, `@mrbeast` calibrated).
  The subject-shape effect is huge and consistent across four subjects and three skills, but it has
  not been shown to survive a different profile — and since the pushbacks all *cite* the niche, a
  profile with no niche set is the obvious next cell and was not run.
- **No mid-thread runs.** Every measurement is a thread's first turn. A thread that already has cards
  changes the B2 clause's applicability, which is precisely §4's sub-mode.
- **The `count` argument was never varied** ("give me 5 hooks for my app" may behave differently from
  "give me hooks for my app" — a count is evidence the creator wants a run).
- **No tsc / suite / build** — `src/` is unchanged (§6).
- **The §7.4 honesty numbers are a READING, not a regex.** Both screens were badly calibrated in
  opposite directions (25/98 claims → all false; 92/98 artefacts → uselessly broad), and the 7 came
  from reading 14 flagged turns and rejecting 6 plus 1 borderline. Someone re-scoring with a different
  threshold will get a different number; the *shapes* are the finding. The near-miss bucket (44 turns
  with 1–2 lines) was printed but only sampled, not read exhaustively — a stricter reader would find
  more than 7.
- **§7.4 is a FIRST-TURN measurement, like everything else here.** The historical §11 cases came from
  real threads where a pack had already been claimed. A thread with prior turns is the population
  where "the transcript showing the pack is stronger precedent than any instruction" applies, and it
  was not measured.
- **§7.5's 1/80 INVENTED was not investigated.** It is one turn; worth a look before anyone claims
  the §3 defect is at zero.

---

## 11. 🔴 The A-vs-C decision, measured — and A is NOT the safer option

§7.3 framed the blocking call as "pay ~2–3s of buffered first token to enable the retry (A)". That
framing was wrong in two ways, and `.scratch/probe-guess-precision.ts` (free, DB reads only, no
model calls) is what showed it.

### 11.1 `guessSkill` on the app's own history

241 threads · 185 with messages · 384 user turns · **147 unique asks** after dedup.

⚠️ **The raw per-turn numbers are not organic traffic.** This lane's own walks repeat a handful of
asks ~15× each, so a per-turn rate mostly measures how often the probes ran. 147 unique asks is the
honest denominator, and it is small enough that everything below is indicative, not established.
Chip turns are also indistinguishable from typed ones in the persisted transcript (session 8 hit the
same limit), so fires are an upper bound.

```
unique asks                 147
guessSkill fires             58   (39%)
  …ran somewhere             36
  …NEVER produced cards      22   ← read all 22
```

Of the 22: **20 are genuine generation asks that never ran** — i.e. the dispatch defect, in
production, on real threads. Two are true false positives:

| ask | guessed | what it wanted |
|---|---|---|
| *"Yes, run the simulate tool on that hook — I want the reaction card."* | `hooks` | the SIM, a different tool |
| *"Three rules for anything we make in this thread: every hook stays under 12 words, never the 5am wake-up angle, and no hooks phrased as questions."* | `hooks` | nothing run — it sets standing constraints |

**≈2 of 58 fires · 3.4%.**

> ⚠️ Correction to session 10's own earlier reading: the first of these is the pre-router's
> documented harmful guess, and I claimed in-session that it returns `null` today. **It does not.**
> `"want"` is in `GENERATION_VERB` and `"hook"` is an artefact noun, so it fires `hooks`. Verified
> directly. The documented risk is live, not stale.

### 11.2 The finding that decides it: A's narrower blast radius is an illusion

A fires when **`guessSkill` fired AND round 1 produced no tool call**. That second condition does not
filter false positives — **it selects for them.**

On *"Three rules for anything we make in this thread…"* the model correctly declines to run
anything. That is exactly A's trigger. So A retries it pinned and forces the same wrong billed run C
would have forced. The same holds for the simulate case.

**A and C have identical false-positive exposure**, because a false positive is by definition an ask
the model is right to decline, and "the model declined" is A's whole signal. A treats the model's
correct judgement as evidence to override it.

What actually differs:

| | A · retry on observed failure | C · pin on the guess |
|---|---|---|
| wrong-run exposure | ~3.4% of fires | ~3.4% of fires — **the same asks** |
| turns where the model already dispatched | untouched | pinned too, so round-1 prose is suppressed |
| first-token latency on generation asks | **+2–3s**, unscopable (5 of 7 successful runs also wrote prose) | none |
| machinery | new buffer + new retry + a changed streaming contract | the existing `forceSkill` seam |

### 11.3 Recommendation: C

Pin round 1 when `guessSkill` fires. It reuses the seam chip taps and `ENGINE_REPEAT_ASK_PIN`
already use (12/12 in session 9, 6/6 here), costs no latency, adds no machinery, and carries the
same false-positive exposure as the alternative that costs both.

The one real loss is round-1 framing prose on turns that already worked — measured at 0 chars under
a pin, 6/6. Reading it, it is preamble (*"You're a comedy storyteller, not a fintech explainer"*);
the sentence that earns its place is the closing line, and round 2 stays unpinned so it survives.

**Two cheap narrowings worth considering with it, neither measured:**

1. **Do not pin when the ask names a different tool** (`simulate`, `read`, `predict`, `remix`). Kills
   false positive #1 with a regex, and it is the same "the creator named something else" logic the
   chip path already respects.
2. Nothing cheap kills #2 — a constraint-setting message that mentions "hook" reads as a hooks ask on
   any surface-level rule. It is 1 of 58.

**The owner's call is now a single number, not a UX trade: is a ~3.4% wrong-run rate on fires
acceptable to take the core action from 23% to ~100%?** A wrong run costs one credit and a confusing
card. Both fixes carry it; only C is free of the latency and the new machinery.
