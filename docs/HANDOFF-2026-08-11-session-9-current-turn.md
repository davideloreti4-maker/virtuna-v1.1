# Handoff — session 9: the digest's missing turn, and a new defect the walk exposed (2026-08-11)

**Lane:** `lane/in-thread-chat` · worktree `~/virtuna-in-thread-chat`
**Brief:** handoff §14.2 item 1 (the digest omits the creator's current turn), then a design
conversation about the output-side honesty check.
**Predecessor:** `docs/HANDOFF-2026-08-10-session-8-live-verification.md` — still the lane's main
record; read its §0 for anything not covered here.
**Nothing merged, nothing deployed** (Vercel disconnected).

Gates: `tsc` clean · prod build clean · **5,871 passed / 0 failed** (was 5,857; +14 new).
Spend: **2 credits** (two signed-in route walks).

---

## 0. ▶️ START HERE

**Shipped:** one commit, `ef285bb6` — the conversation digest now carries the turn it is answering.
Mutation-tested six ways, verified live through `/api/tools/chat` signed-in.

**Found, not fixed — and it is the more interesting one:**

> 🔴 **A live tool result tells the model the card COUNT and not the card LINES**, then instructs it
> in prose not to restate them. Measured this session, **2 of 2 turns**: the model narrated a pack
> of 10 and then 5 hooks that had **zero overlap with the cards actually rendered**. The replayed
> prior-turn path already passes `cards_on_screen`; the live path does not. §3.

**Do next, in this order:**

1. **The honesty-check design conversation** (owner asked for this before any building). §4 lays out
   the four decisions and what §3 changes about them — §3 is a *cause*, the honesty check is a
   *detector*, and the cheap one may be enough.
2. Nothing else is queued. §5 lists what this session did not verify.

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
zsh .scratch/mutate-current-turn.sh                                          # the six mutations
```

Session 8's list (§8 there) is unchanged and still current.

---

## 7. Traps learned this session

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

## 8. Commits

```
ef285bb6  fix(chat): the digest was missing the turn it was answering
```

Flag-confined: with `ENGINE_GEN_CONVERSATION` off the loop returns `input.context` by reference and
no digest is built, so the change is byte-identical on the default path.

## 9. Where this leaves the two flags

Unchanged from session 8 §13, with one improvement: **`ENGINE_GEN_CONVERSATION` is now worth more
than it was.** Before this commit it did nothing at all on a thread's first generating turn and
silently dropped the constraint on every turn that stated one. `ENGINE_REPEAT_ASK_PIN` is untouched.
Both flips are still the owner's call.
