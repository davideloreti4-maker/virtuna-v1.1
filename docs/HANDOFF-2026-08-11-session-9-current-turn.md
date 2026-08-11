# Handoff — session 9: the digest's missing turn, and a new defect the walk exposed (2026-08-11)

**Lane:** `lane/in-thread-chat` · worktree `~/virtuna-in-thread-chat`
**Brief:** handoff §14.2 item 1 (the digest omits the creator's current turn), then a design
conversation about the output-side honesty check.
**Predecessor:** `docs/HANDOFF-2026-08-10-session-8-live-verification.md` — still the lane's main
record; read its §0 for anything not covered here.
**Nothing merged, nothing deployed** (Vercel disconnected).

Gates: `tsc` clean · prod build clean · **5,903 passed / 0 failed** (was 5,857; +46 new).
Spend: **6 credits** — six signed-in route walks. The 30 probe generations cost **0** (stub till).

⚠️ Three ledger rows I did not create sit inside today's window: `account` ×2 and `explore_scrape`
(15 credits, 08:02–08:06Z). Not from anything run here. The e2e account is a REAL prod account
shared with whatever else touches it — do not read `count-credits-session9.ts`'s total as one
session's spend.

---

## 0. ▶️ START HERE

**Shipped:** four source/test commits.

| | |
|---|---|
| `ef285bb6` | the conversation digest now carries the turn it is answering (§1–§2) |
| `c6baa49f` | the narrator can SEE the pack it just made — flagged OFF (§3, §10) |
| `8c204865` | generalised to EVERY skill's output, and flipped **ON** as a kill-switch (§12) |
| `1c4e5739` | the replay path's context records had no coverage at all (§12.2) |

**The defect that started the second commit.** A live tool result told the model the card COUNT and
not the card LINES, then instructed it in prose not to restate them. Measured live, **2 of 2 turns**:
it narrated a pack of 10 and then 5 hooks with **zero overlap with the cards rendered beside them**.
The replayed prior-turn path had passed `cards_on_screen` since 2026-08-04; the live path never did.
So the model could discuss the pack it made *last* turn and not the one it had *just* made. §3.

**What the A/B says** (24 offline runs + 2 live walks, §10):

| | arm A · count only | arm B · `cards_on_screen` |
|---|---|---|
| re-lists the real cards (the §12.1 risk) | 0/12 | **0/12** — the risk did not materialise |
| invents a different pack | 1/12 | 0/12 — *too few to call* |
| **names a real card by its text** | **0/12** | **9/12** |

Arm A *cannot* do the last row — with no lines it can only say "here are 5 hooks, pick one."
Live, flag on, the exact ask that failed before now answers:
*"The strongest is "My bank account is a horror movie" — it opens a curiosity gap with zero
friction… Want me to write a script around that one?"*

**Do next, in this order:**

1. **A design call on verdict-shaped results.** Two cheap fixes for the residual lever gap were
   built, measured and REVERTED — handing the model the audience's own scroll reasons did not
   change its narration, and neither did instructing it to use them (**§12.4**). That leaves two
   structural options: fix the card's `lever` field at source (it is an upsell on a Strong Read —
   user-visible copy, so yours), or stop letting the model narrate a verdict freely and derive the
   closing line from the card. A templated line cannot lie, and unlike a PACK a VERDICT needs no
   judgement. I would argue for the second.
2. **A separate reliability problem the A/B surfaced:** 3 of 12 unpinned runs on a plain ask never
   dispatched, one of them incoherently (*"I need the actual text of the hooks you want me to
   generate for"*). No tool ran, so nothing here reaches it — this is dispatch reliability, and on
   a plain "give me hooks for X" it is arguably the worse experience. **§10.4.**
3. **The honesty-check design conversation** — still owed, and now narrowed to one shape: prose
   claiming an artefact when NO tool ran. §4 has the decisions; §11 has what the A/B changed.

**Still parked, do not touch without the owner:** the `writing_voice_sample` migration; adding
goals/wins/flops to `MODE_ROLES.chat`; building the honesty check ahead of the conversation.

⚠️ `.scratch/` is gitignored and now holds **56 files**, the only copy of every harness cited here
and in session 8. Copy it out before any `git worktree remove`.

---

## 1. What shipped — `ef285bb6`

`route.ts` loads prior turns at step (6) and persists the creator's message at step (7), so
`buildConversationDigest` was structurally always one turn behind. Two consequences, both of them
the thing the digest exists to prevent:

| | |
|---|---|
| *"give me hooks, but keep them under 30s"* | the constraint lives in the current turn, so it reached the generator only insofar as the chat agent chose to fold it into `topic` — the exact compression the digest was built to stop relying on |
| a thread's **first** generating turn | no prior turns at all → builder returned `null` → `ENGINE_GEN_CONVERSATION` was a **total no-op**, in the case where the creator has not yet seen the product do anything |

The loop is the only place holding both, so `ChatAgentStreamInput` gains **`currentAsk`** — the
creator's RAW words. `ask` cannot serve: it is `assembleBundle`'s output, and at the digest's
160-char clip it would print the bundle header into the transcript as if the creator had typed it.

Appended as the **newest** turn, so the newest-first budget buys it before anything older and a long
thread can never evict it. `withCurrentTurn` also refuses to double it when a caller hands over a
`priorTurns` that already ends with it — one line's difference from today's route ordering, and the
cost would land at the most valuable end of the budget.

**The budget still holds** (`.scratch/measure-current-turn-digest.ts`, free, deterministic):

```
CONVERSATION_BLOCK_OVERHEAD  297      of a 700 budget → 403 for turns
first generating turn        null                  → {"turns":["…under 30s…"]}
mid-thread                   2 turns / 379 chars   → 3 turns / 443 chars
worst case, all lines at MAX_TURN_LENGTH                        626 / 700  ✓
```

626 is the same worst case `355e0a89` established, with the extra turn charged against the block.

**Mutation-tested, six ways** — every half of the wiring, and the two properties that are easy to
get subtly wrong:

| mutation | result |
|---|---|
| builder ignores `currentAsk` (iterates `priorTurns` again) | **8 tests fail** |
| loop stops passing `currentAsk` to the builder | **2 fail** |
| route stops passing the raw ask | **1 fails** |
| dedupe guard removed (same turn carried twice) | **1 fails** |
| current turn appended **oldest** instead of newest | **4 fail** |
| route passes the assembled **bundle** instead of the creator's words | **1 fails** |

Harness: `.scratch/mutate-current-turn.sh`.

---

## 2. Live, signed-in, through the real route

Dev server on 3011 with `ENGINE_GEN_CONVERSATION=true NEXT_PUBLIC_ENGINE_ONE_BRAIN=true
DEBUG_BUNDLE=1`, `.scratch/walk-thread.ts` then `.scratch/walk-existing.ts`, thread
`72f570fb-32b8-41c2-a3df-dc1cd5bc46fc`. The `DEBUG_BUNDLE` instrumentation was re-added temporarily
and **reverted** — the tree is `ef285bb6` unmodified. It reports **which sections survived** and the
digest's actual lines, never an output length (the §1.2 rule).

**Turn 1 — a fresh thread, i.e. the total-no-op case:**

```
[DEBUG_BUNDLE] {"mode":"hooks","len":5669,"cap":6000,"corpus":"KEPT","conversation":"KEPT",
 "convTurns":["give me hooks for my student budgeting app — keep every one under 8 words
               and none of them a question"], "profileRolesKept":4,"profileRolesTotal":4}
```

**Turn 2 — same thread, a new constraint:**

```
[DEBUG_BUNDLE] {"mode":"hooks","len":5717,"cap":6000,"corpus":"KEPT","conversation":"KEPT",
 "convTurns":["give me hooks for my student budgeting app — keep every one under 8 words
               and none of them a question",
              "more hooks, but this time none of them can mention money or spending"],
 "profileRolesKept":4,"profileRolesTotal":4}
```

Both turns: the current turn reaches the generator, corpus and conversation **both KEPT**, all four
profile roles kept, ~5.7k of a 6,000 cap. The extra turn does not re-open §1's eviction.

**Outcome side, hand-judged.** Turn 1's constraint (under 8 words, no questions) — **5/5 cards
obey**. Turn 2's ("none of them can mention money or spending") — **3/5 obey**; *"My bank account is
a horror movie."* and *"Stop buying coffee. Start buying peace."* violate it. Consistent with §12.4:
the digest reduces violations, it does not eliminate them.

**What is proved is that the constraint ARRIVES**, which is the claim this commit makes. n = 2 turns,
one thread, one profile — not an obedience measurement, and there is no control arm.

---

## 3. 🔴 The live tool result is count-only — and the model fills the gap by inventing

Both walks above produced the same defect, which I was not looking for.

The model streams a closing line after a skill returns. In both turns it instead narrated a **whole
enumerated pack** — 10 hooks in turn 1, 5 in turn 2 — with **zero overlap** with the cards the app
had just rendered beside them:

| | rendered cards | prose above them |
|---|---|---|
| turn 1 | `This app pays you to save money.` · `Your budget is broken. Fix it.` · … (5) | *"Here are 10 hooks under 8 words, no questions:"* + 10 **different** lines |
| turn 2 | `Watch me turn water into Wi-Fi.` · `My bank account is a horror movie.` · … (5) | *"Here are 5 new hooks…"* + 5 **different** lines |

**The cause is structural and it is a one-line asymmetry** (`chat-agent-loop.ts`):

```ts
// a LIVE run, line ~1291
content: JSON.stringify({
  ran: skill.name,
  produced: `${blocks.length} card(s)`,
  note: "cards are shown to the creator; reply with ONE short closing line and do NOT " +
        "restate or rewrite the cards' content in prose",
})

// a REPLAYED prior turn, line ~577 — the same shape PLUS the lines
content: JSON.stringify({
  ran: run.name,
  produced: `${run.cards} card(s)`,
  cards_on_screen: run.lines,          // ← the live path has no equivalent
  note: "these are the cards the creator can see, in order … They are ALREADY on screen: " +
        "never re-list them, and never present them as something you are producing now.",
})
```

`ChatAgentPriorTurn.lines` exists because *"the count alone proved a tool RAN … It left the model
unable to discuss its own output."* That fix was applied to the **replay** path and never to the
**live** one. So on the turn that matters most the model knows a pack of five exists, does not know
what is in it, and is told in prose not to restate it — and the lane's own repeated finding is that
a negative instruction is not a filter. Having nothing to be faithful *with*, it invents.

**Why this matters for §4.** This is not the §11 defect (prose claiming an artefact with **zero**
cards). It is the sibling the §11 screen explicitly could not count — session 8's own caveat: *"I did
not judge the 26 'honest' claims. They had cards beside them; I did not check the prose matched the
cards."* Two for two, on the first two turns anyone looked at. It is a **cause** with a structural
fix; the honesty check is a **detector**. Sequencing them is a real decision, so it is §4's, not
mine — I have not touched it.

**Not established:** how often this happens on real traffic (n = 2, both mine, both with the digest
on — though this seam is flag-independent); whether passing `cards_on_screen` live actually stops it,
or merely gives the re-listing better material. That second one needs measuring before building, and
§12.1 is the reason to be suspicious: putting lines in the prompt made the model likelier to emit
them.

---

## 4. The honesty check — the design conversation, not a plan

Handoff §11 sized the defect: **~9 real instances** of prose claiming an artefact with zero cards,
of which the repeat-ask pin catches **0**. The lever that would move it is an output-side check.
Nothing here is built. Four decisions, with what I would argue and why it is arguable:

1. **A half-streamed answer.** Tokens are already on the creator's screen when the claim becomes
   detectable. Blocking after the fact means retracting visible text.
2. **Re-run or refuse.** A re-run is a second billed generation for a turn the creator already paid
   nothing for (chat is free by decision; the *skill* is what bills). A refusal costs nothing and
   admits the failure.
3. **The free tier.** `createArtefactGuard` already redacts paste-ready lines for a sealed visitor,
   so a second check has to compose with a transform that is already rewriting the stream.
4. **What §3 changes.** If the live tool result carries the lines, the commonest shape may simply
   stop occurring — in which case the detector is a smaller, cheaper backstop rather than the
   primary fix. Measuring §3 first is the cheaper order, and it is reversible.

**Explicitly out of scope per the owner:** tuning the pin's 0.7 threshold. §11 explains why lowering
it is not safe (the 0.44 miss sits 0.03 above an unrelated-topic pair).

---

## 5. What I did NOT verify

- **No control arm on the live walks.** I did not run the same two asks with
  `ENGINE_GEN_CONVERSATION=false` to compare obedience. The claim here is arrival, not benefit —
  the same gap session 8 §5 left open.
- **The digest's benefit is still unmeasured through the route.** Unchanged from session 8.
- **The `ctx.conversation` → runner hand-off still has no coverage at the six generator sites**
  (§14.2 item 2). My tests stop at the skill's `ctx`; deleting the field inside a runner would still
  leave tsc clean and the suite green.
- **The digest shape is still hand-mirrored in five unlinked places** (§14.2 item 3) — `currentAsk`
  did not add a sixth, but it did not fix the five.
- **`replayPriorTurn` still replays prior card lines** (§14.2 item 4), and §3 is now an argument that
  this is *load-bearing* rather than a leftover. Still needs its own measurement.
- **n = 2 for everything in §2 and §3.** Shapes, not rates.

---

## 6. Harnesses added (`.scratch/`, gitignored)

```bash
node node_modules/tsx/dist/cli.mjs .scratch/measure-current-turn-digest.ts   # §1, free, deterministic
node node_modules/tsx/dist/cli.mjs .scratch/count-credits-session9.ts        # today's spend window
zsh .scratch/mutate-current-turn.sh                                          # §1's six mutations
zsh .scratch/mutate-cards-on-screen.sh                                       # §10's seven mutations
zsh .scratch/mutate-on-screen.sh                                             # §12's six mutations
node node_modules/tsx/dist/cli.mjs .scratch/check-detail-clause.ts           # §12.4, free — did it REACH the model?

# the Read half — real Flash, stub till, 0 credits
node node_modules/tsx/dist/cli.mjs .scratch/probe-read-narration.ts 3

# the A/B — real Qwen + real pipeline, STUB till, 0 credits. ~8 min for 24 runs.
GROUNDING_HOOKS_ENABLED=true ENGINE_GEN_CONVERSATION=true \
  node node_modules/tsx/dist/cli.mjs .scratch/probe-cards-on-screen.ts 3
```

Dev server for the live arm-B walk:
```bash
ENGINE_GEN_CONVERSATION=true ENGINE_CHAT_CARDS_ON_SCREEN=true \
NEXT_PUBLIC_ENGINE_ONE_BRAIN=true \
node node_modules/next/dist/bin/next dev --turbopack --port 3011
```

Session 8's list (§8 there) is unchanged and still current.

---

## 7. Traps learned this session

- 🔴 **A control arm that does not FAIL proves nothing about the treatment arm.** The first A/B
  scored arm A at 0/4 on the defect and would have been read as "the fix works" while never having
  reproduced the defect at all. Same class as the `grounded: true` trap (§12.3) and the same logic as
  the lane's mutation rule, applied to probes: **verify the control reproduces the failure first.**
  Two plausible hypotheses about the trigger died against this (§10.3).
- 🔴 **A mutation harness that runs `git checkout -- src/` destroys UNCOMMITTED work.** Mine reverted
  the entire fix along with the first mutation — every edit, source and test, gone in one line, with
  the tree reading clean afterwards so nothing looked wrong. **Commit before mutating.** The harness
  is only safe because the work is now a commit it can restore to.
- **zsh does not word-split an unquoted scalar.** `FILES="a b c"; vitest run $FILES` passes all three
  paths as ONE argument, matches no test file, and every mutation prints "no failures" — a mutation
  harness that silently proves nothing while looking like it proved everything. Use an array, and
  make the harness fail loudly when it cannot find a test summary (it now does).
- **A route test whose `assembleBundle` mock is the identity makes `ask` and `currentAsk` coincide**,
  so an assertion that they differ passes vacuously. `mockImplementationOnce` with a distinguishable
  string is what makes it real.
- **The `DEBUG_BUNDLE` instrumentation is worth its 20 lines** and remains the only way to see what
  the generator actually received through the route. Re-added and reverted again this session; the
  session-8 backups under `…/02a25076-…/scratchpad/*.bak` still exist.

---

## 10. The fix for §3, and the A/B that tested it — `c6baa49f`

### 10.1 What landed

`card-lines.ts` is new and owns the card→line extraction for **both** seams. That is the point of
it: two copies of that map is exactly how the live path came to be blind while the replay path was
not. `chat-prior-turns.ts` now imports it and its behaviour is unchanged.

The live tool result gains `cards_on_screen` behind **`ENGINE_CHAT_CARDS_ON_SCREEN`** (off), with a
note that tells the model to *refer* to the cards — name the strongest and why — rather than the old
bare prohibition. Nothing extractable → the field is **omitted**, never `[]`, and the result is
byte-identical to what shipped before: an empty card list is a claim, and the wrong one.

**Why the three defences in place could not have caught this:**

- `POST_TOOL_TEXT_CAP = 600` — length. Its comment says *"a re-answer cannot fit"*. Measured false:
  the live re-answer was **476 chars**. And it cannot work in principle — a hook is one short
  sentence, so ten hooks and "3–4 sentences of commentary" are **the same size**. The 600 was tuned
  against a 4,625-char re-answer (10 hooks in two formats) and only ever excluded the verbose shape.
- *"never re-write the card content in prose"* — a negative instruction. Three measured failures in
  this lane already (`cardsOnScreen`, the anonymous refusal, the artefact guard's own origin).
- `ENGINE_REPEAT_ASK_PIN` — keys on the shape of the **ask**; catches 0 of 5.

**Mutation-tested, seven ways** (`.scratch/mutate-cards-on-screen.sh`):

| mutation | result |
|---|---|
| lines never attached | **3 fail** |
| flag ignored (attached when OFF) | **1 fails** |
| empty pack sent as `[]` instead of omitted | **2 fail** |
| per-run line cap removed | **2 fail** |
| a missing line becomes the string `"undefined"` | **9 fail** |
| card order reversed | **2 fail** |
| replay path stops sharing the extraction | **3 fail** |

**Gates:** `tsc` clean · prod build clean · **5,886 passed / 0 failed** (was 5,871).

### 10.2 The A/B — `.scratch/probe-cards-on-screen.ts`

Runs the REAL loop against the REAL Qwen and the REAL hooks pipeline, real prod profile + the
calibrated `@mrbeast` audience, with a **stub billing seam** (gate allows, bill is a no-op).
24 generations, **0 credits** — confirmed against the ledger, which has no rows in that window.

2 arms × 2 ask shapes × {pinned, unpinned} × 3 runs. Scored as a **trichotomy**, because there are
two opposite ways to fail: INVENTED (a pack in prose that is *not* the cards — the defect) vs
RELISTED (a pack in prose that *is* the cards — the §12.1 risk, which would mean B is no fix).

```
pin        ask          arm  CLEAN  INVENTED  RELISTED  NO-DISP   quotes-a-card
unpinned   plain        A     2/3     0/3        0/3       1/3       0/3
unpinned   plain        B     1/3     0/3        0/3       2/3       1/3
unpinned   constrained  A     3/3     0/3        0/3       0/3       0/3
unpinned   constrained  B     3/3     0/3        0/3       0/3       3/3
pinned     plain        A     3/3     0/3        0/3       0/3       0/3
pinned     plain        B     3/3     0/3        0/3       0/3       2/3
pinned     constrained  A     2/3     1/3        0/3       0/3       0/3   ← the reproduction
pinned     constrained  B     3/3     0/3        0/3       0/3       3/3
```

**Live, through the route, flag ON**, thread `f854ac70-96be-42c9-a519-bcec4fa36cda`, the same two
asks that produced the 2/2 failure earlier in this session:

| turn | before (arm A, §3) | after (arm B) |
|---|---|---|
| 1 | *"Here are 10 hooks under 8 words…"* + 10 invented lines, 476 ch | *"The strongest is **"My bank account is a horror movie"** — it opens a curiosity gap with zero friction… Want me to write a script around that one?"* 194 ch |
| 2 | *"Here are 5 new hooks…"* + 5 invented lines | *"**"I spent three hours on one spreadsheet"** wins — it opens a curiosity gap about what went wrong…"* |

Both quote a card that is actually on screen.

### 10.3 🔴 What this does NOT establish — and a probe trap worth more than the result

**The elimination claim is not proven.** Arm A reproduced the defect **1 time in 12**; arm B, 0 in
12. That difference is not significant. What the numbers do support, and it is a different claim:

- the **§12.1 risk did not materialise** — 0/12 re-listing, which was the one measured reason to
  expect this fix to backfire;
- the positive change is **categorical, not marginal** — 0/12 → 9/12 runs that name a real card by
  its text. Arm A is structurally incapable of it.

> ⚠️ **The first version of this probe scored arm A at 0/4 INVENTED and would have "proved" the fix
> worked without ever reproducing the defect.** A probe that does not exhibit the failure in its
> control arm measures nothing about that failure — it measures commentary quality and gets read as
> a fix. This is the same class as §12.3's `grounded: true` trap and the lane's mutation rule:
> **check the control arm FAILS before believing the treatment arm passed.**

Two hypotheses died on the way, both recorded because they are plausible and wrong:

1. *"The trigger is an ask carrying output constraints"* — the model demonstrating compliance it
   cannot verify. Reasonable (the live prose opened *"Here are 10 hooks under 8 words, no
   questions:"*), and **wrong**: 0/6 in arm A across both ask shapes.
2. *"The prose is round-1 text, emitted alongside the tool call, where no tool result exists and the
   cap does not apply"* — structurally alarming if true, since the fix could not reach it. **Wrong**:
   the one reproduction had `preCard 0ch`, i.e. it was round-2, post-tool text. Round-1 text does
   occur (3 of 24 runs) but only on non-dispatching pushbacks.

Also unestablished: the offline rate (1/12) is far below the live rate (2/2), so something about the
route — real thread, real persistence, real prior turns — makes it likelier, and the probe does not
capture it. Treat the shapes as the finding and the rates as indicative.

### 10.4 A separate reliability problem, surfaced not fixed

**3 of 12 unpinned runs on the plain ask never dispatched.** Two were legitimate pushbacks for a
sharper angle (the directive sanctions one). The third was not:

> *"I need the actual text of the hooks you want me to generate for. You mentioned 'student
> budgeting app' — is that the topic?"*

The flag cannot reach these — no tool ran, so there is no tool result. This is dispatch reliability,
and on a plain "give me hooks for X" it is arguably a worse experience than the narration bug.
Unmeasured beyond this; noted so it is not rediscovered as part of the same defect.

Also worth keeping: **the enumerated-line detector has false positives on legitimate option lists.**
One arm-B pushback offered three numbered *angles* ("1. The Delusion… 2. The App as the Villain…")
and scored 3 "invented" lines. It was correctly bucketed as NO-DISPATCH, but a shape-based honesty
check (§11) would need to tell those apart — which is exactly §11's own caveat about the 4 pushbacks
its screen could not classify.

---

## 12. Generalised past the generators, and flipped ON — `8c204865`

The owner's requirement: *"it needs to work for all sorts of skills and chat."* The §10 fix covered
three generator card types. That left the one **analysis** skill the agent can call exactly as blind
as before: `read_concept` returns a `multi-audience-read`, so the agent could run a creator's draft
past their audience and then narrate the verdict without being able to read it.

### 12.1 What changed

- **Keyed off the BLOCK, not a hardcoded generator list.** `SKILL_BLOCK_RECORD` — the 9-type
  describer map the replay path has used since 2026-08-04 — moved into `on-screen.ts` (renamed from
  `card-lines.ts`) and now feeds both seams. A test asserts every `RECORDED_BLOCKS` type is
  reachable live, so a new skill cannot be added blind. The reachability drift guard keeps its
  import path via re-export.
- **Two kinds, two instructions**, because the creator is doing a different thing with each. A
  `cards_on_screen` PACK is a set they are choosing between → compare and name one. A
  `result_on_screen` VERDICT is something they are reading → build on it, *never contradict it*.
- **Flipped ON.** `ENGINE_CHAT_CARDS_ON_SCREEN` is now a kill-switch (`!== "false"`), the shape
  `CHAT_AGENT_DISPATCH` already ships with.
- **Hardened.** The guard wraps the whole per-block read, not the describer body. Live, this runs
  AFTER the creator is billed and their cards are on screen, so no failure is worth propagating.
  The first version guarded only inside the describer and was defeated by reading `.props`.

**Gates:** `tsc` clean · prod build clean · **5,899 passed / 0 failed** · 6 mutations, all caught.

### 12.2 🔴 A mutation found that the REPLAY path's records had never been tested

Replacing `recordLineOf(...)` with a constant failed **nothing**. `SKILL_BLOCK_RECORD` had shipped
for a week — the fix for 107 of 982 persisted blocks (11%) being invisible to the agent — with no
test asserting a record line is produced at all. Closed in `1c4e5739` with four tests; the mutation
now fails 3.

This is the lane's own thesis landing again: the green suite was the accomplice. And it matters more
now, because the same describers feed both seams — a silent regression would blind them together.

### 12.3 The results half is a PARTIAL fix — measured, not assumed

`.scratch/probe-read-narration.ts`, 3 runs per arm, real Flash, stub till.
Card every run: `@mrbeast | Strong | 6/10 stop`, lever *"Strong for @mrbeast. Calibrate a second
audience to see where it diverges."*

| | arm A · count only | arm B · `result_on_screen` |
|---|---|---|
| consistent with the band | 3/3 | 3/3 |
| **fabricated metrics** | **1/3** | **0/3** |
| relays the card's lever (`leverSim`) | 0.02–0.03 | 0.02–0.04 |
| names the audience the card names | 0/3 | 0/3 |

**The win is the fabrication.** Arm A run 2 invented a whole report — *"**Key Metrics:** · **Stop
Rate:** High · **Fraction Who Engage:** Moderate-to-High"* — numbers the Read never produced and a
metric it does not even compute, presented as its findings. Arm B produced none.

**The gap is the lever.** Neither arm relays it, and the first live walk showed the same thing: the
model announced *"the lever to push it higher is specificity"* when the card's lever said something
else entirely. A creator reads that as the Read's finding. It is not.

> ⚠️ Partly the CARD's fault, and worth its own look: for a SINGLE-audience Read the `lever` field is
> a meta-nudge (*"Calibrate a second audience…"*), not a craft lever. The model is substituting a
> useful sentence for a useless one. Fixing the narration without fixing that field would only make
> the product relay a nudge nobody wants.

Neither arm names `@mrbeast`; both say "your audience". Unmeasured whether that matters.

**n = 3 per arm, one card, one concept.** The fabrication difference is categorical; the rest is not
a tight interval.

### 12.4 🔴 Two attempts to close the lever gap, both measured, both REVERTED

The obvious reading of §12.3 is "the model does not have the audience's reasons, so give them to it."
The card holds them: four personas scrolled and three gave the same reason (*"No actionable tips
here, just a vague metaphor"* · *"Where's the solution?"* · *"Generic hook"*). Neither attempt worked.

**Attempt 1 — hand the narrator the scroll reason.** A `detail` clause on the live seam only (the
context record rides on every later turn and stays compact), carrying `whoNotFor` plus ONE verbatim
scroll quote labelled *"one voice, not the whole audience"*. **Verified it reached the model** —
324 chars, under the cap, checked with `.scratch/check-detail-clause.ts` rather than assumed.

**Attempt 2 — tell it to use them.** A POSITIVE, specific instruction (not a prohibition, which this
lane keeps measuring as useless): *"If you say what to change, it must be what THIS result actually
found: use the reason the audience gave, in their words, and say who it came from."*

| | arm A | arm B + detail | arm B + detail + instruction |
|---|---|---|---|
| quotes a scroll reason | 0/3 | 0/3 | **0/3** |
| `scrollSim` (best overlap with any scroll quote) | 0.03 | 0.03–0.07 | 0.02–0.07 |

The model reliably substitutes its own craft advice (*"the lever is a concrete jump-scare moment in
the first three seconds"*) — plausible, consistent with the data, and **not what the Read said**.

**Both reverted.** They did not move the metric, and shipping unmeasured complexity into the paid
default path is the thing this lane's docs exist to prevent. The negative result is the deliverable:
**for a verdict-shaped result, neither more data nor better wording changes the narration.** That
rules out the two cheap fixes and leaves only structural ones.

> ⚠️ Also worth noting from the same runs: the SHIPPED `result_on_screen` fix keeps earning its
> place. Arm A again produced invented analysis presented as the Read (*"The mechanism is
> **prediction error**…"*), long enough to be truncated by `POST_TOOL_TEXT_CAP`. Every arm-B run
> was short, clean and band-consistent. §12.4 is about the residual gap, not about §12.3's win.

**The two structural options, neither built — this is a design call:**

1. **Fix the `lever` at source.** On a Strong single-audience socials Read it is
   `Strong for X. Calibrate a second audience to see where it diverges.` — an upsell occupying the
   field named "lever", exactly when the creator most wants to know what would push it further.
   Weak and Mixed at least point at a craft action. User-visible copy, so it is the owner's.
2. **Do not let the model narrate a verdict freely at all.** For a Read the useful closing line is
   *derivable* from the card (band, fraction, who scrolled, their reason) — and a templated line
   cannot lie. This is the "one author per turn" principle followed to its conclusion for
   verdict-shaped results, and it is the one I would argue for. A PACK genuinely needs judgement
   ("which is strongest and why"); a VERDICT does not.

---

## 11. What the A/B changes about the honesty-check design (§4)

§4's four decisions stand, with one narrowed and one answered:

- **Answered — "does giving it the lines backfire?"** No, on 12 runs. That was the blocking unknown.
- **Narrowed — what the detector is FOR.** The commonest shape (post-tool narration of a phantom
  pack) now has a *cause* fix. What remains for a detector is the harder shape: prose claiming an
  artefact when **no tool ran at all** (§11 of the session-8 handoff, ~9 historical). `cards_on_screen`
  cannot touch that one by construction.
- **Unchanged and now better evidenced — the retry framing.** For the no-tool shape the honest
  outcome is not a refusal but the pack the creator asked for: the model has already asserted intent,
  so pinning `tool_choice` and re-running round 1 honours its own decision rather than overriding a
  guess. Nothing expensive has happened at that point — the generation never ran — so "re-run vs
  refuse" was the wrong frame. §10.4's 3/12 non-dispatch rate is the population this would act on.
- **Unchanged — the free tier.** A sealed visitor binds no generators, so there is nothing to pin and
  `createArtefactGuard` continues to own that path untouched.

---

## 8. Commits

```
ef285bb6  fix(chat): the digest was missing the turn it was answering
500efab5  docs(chat): session 9 — the missing turn, and a count-only tool result
c6baa49f  feat(chat): let the narrator see the pack it just made (flagged)
75e49593  docs(chat): the A/B — and the control arm that did not fail
8c204865  feat(chat): every skill's output is visible to the narrator; default ON
1c4e5739  test(chat): the replay path's context records had NO coverage
```

Both source commits are flag-confined. `ENGINE_GEN_CONVERSATION` off → the loop returns
`input.context` by reference and no digest is built. `ENGINE_CHAT_CARDS_ON_SCREEN` off → the live
tool result is byte-identical to what shipped before (pinned by a test). `c6baa49f` also moves the
card-line map out of `chat-prior-turns.ts` into `card-lines.ts`; that refactor is behaviour-neutral
and mutation-tested (M7).

## 9. Where this leaves the two flags

Unchanged from session 8 §13, with one improvement: **`ENGINE_GEN_CONVERSATION` is now worth more
than it was.** Before this commit it did nothing at all on a thread's first generating turn and
silently dropped the constraint on every turn that stated one. `ENGINE_REPEAT_ASK_PIN` is untouched.
Both flips are still the owner's call.
