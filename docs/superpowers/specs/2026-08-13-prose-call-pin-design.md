# The prose-call pin — design

**Date:** 2026-08-13
**Status:** approved design
**Lane:** in-thread chat / dispatch. Session 11 §7.5 is the origin; session 12 §4 item 2 named it
"the best next dispatch work".
**Flag:** `ENGINE_PROSE_CALL_PIN`, ships dark.

---

## 1. The defect this closes

Four sessions of this lane have chased one family of defect: **the model declines to dispatch a
generator the creator asked for.** Session 10 measured the disposition half over 183 real
generations — a product/app/show/format subject dispatches **7/31 · 23%** against **30/30 · 100%**
for a scenario subject, Fisher exact **p = 5.4e-11** — and the model states the false belief
verbatim: *"'Student budgeting app' is the product, not the hook."*

`ENGINE_COUNT_HINT` (PR #480, default-ON) closed the disposition half: dispatch **2/12 → 16/20**,
pushbacks **9 → 0**, live **0/6 → 6/6** at p ≈ 0.002. It forces nothing, so it carries no wrong-run
exposure.

**What remains is a different bug, and the count made it visible by removing what masked it.** The
model has decided to run and fails to *express* the call, emitting it as creator-visible text:

```
generate_hooks(topic="stand-up comedy podcast", count=5)
generate_ideas(topic='stand-up comedy podcast')
```

Session 10 recorded this shape **once in 45 runs** and called it "its own kind of bug". Counted, it
is **6 of 26**.

## 2. The trigger, and why it is not the one §11.2 rejected

§11.2 rejected *"retry pinned after observing no tool call"* as **strictly worse**, and the argument
is correct: that trigger is "guessed AND the model called no tool", and a false positive there is
**by definition an ask the model was right to decline** — the condition *selects* for false
positives rather than filtering them.

**A prose call inverts that.** The model has asserted the specific call, by name, with args. It is
the model's own machine-readable statement of intent, and a false positive would require it to write
a tool call it did not mean.

⚠️ **`guess-pin.ts:23-31` must not be read as settling this.** That comment argues against the
no-tool-call trigger and does not transfer. Its two concrete costs also do not apply here: round-1
text needs no blanket buffering (§5 holds only a line that has already begun a generator token), and
no new retry path or streaming contract is introduced (§4). The new module records this explicitly.

### Measured — `.scratch/analyse-prose-tool-call.ts`, all 107 recorded runs, free

```
trigger fires                    8
  …on a run that DISPATCHED      0     ← never fires where a retry would be wrong
  …on a non-dispatch             8
recall within the counted arms   6 of 7 residual failures
overlap with C                   8/8 would also have been pinned by C
```

Because 8/8 would also have been caught by the guess pin, this buys **precision, not coverage**: it
is C with the false-positive exposure removed, covering only the failures where the model announced
itself.

## 3. 🔴 The target is the guess, never the emitted name

In **3 of the 8** fires the model emitted `generate_ideas(...)` for an ask that says *hooks* — **the
model that failed to express the call also picked the wrong tool.** Pinning to its emitted name
produces the wrong artefact **38%** of the time. `guessSkill(rawAsk)` is correct in all 8.

> The emitted call is the **trigger**. The guess is the **target**.

This is the single detail most likely to be "simplified" away by a later reader, because reusing the
emitted name looks more direct. It is wrong.

## 4. Mechanism — one more round, not a retry

`chat-agent-loop.ts:1140` is `if (calls.length === 0) break;` — exactly where a prose-call turn gives
up. Instead of breaking: if a prose call was seen, the turn is not already pinned, and `guessSkill`
has a guess, set the pin and `continue` for one more round.

```
for (round = 1..maxRounds)
  ...
  if (calls.length === 0) {
-   break;
+   if (proseCallSeen && guess && !pinnedTool && !alreadyProsePinned) {
+     pinNextRound = guess; alreadyProsePinned = true; continue;
+   }
+   break;
  }
```

Two distinct conditions, deliberately not collapsed: `!pinnedTool` is §7's "the turn is not already
pinned" (a chip, repeat-ask or the guess pin owns round 1), and `!alreadyProsePinned` is §7's "at
most once per turn" latch that makes a loop impossible.

`tool_choice` currently reads `pinnedTool && round === 1`; it becomes a per-round value so the pin
can apply to the round after detection.

**Rejected: a second `runChatAgentStream` call.** It matches the handoff's literal "retry" wording
but re-streams a fresh turn over a stream the creator is already reading, and needs its own answer
for the first pass's prose. The loop already has every part required.

**Billing is unchanged and cannot double-charge.** `deps.billing.gate` / `.bill` fire only inside the
tool-dispatch branch (`chat-agent-loop.ts:1418`, `:1450`). A prose-call turn dispatches nothing and
bills nothing; the extra pinned round bills exactly once, at the same price as any other run.

## 5. The withhold — the creator must never see the malformed call

🔴 **The measurement the handoff does not contain.** Round-1 text **streams straight through**
(`chat-agent-loop.ts:1105-1110`, `guard.push(slice)`), and the guard that could withhold it runs only
for anonymous sessions — `guardArtefacts = (deps.sealedVisitor ?? false) || unbound`. **A signed-in
creator's stream is byte-for-byte untouched.** So by the time a prose call can be detected, the
creator has already read `generate_hooks(topic=…)`.

`createArtefactGuard`'s own doc states the governing principle, learned the hard way on this
codebase: *"Withholding rather than post-filtering is what makes it work at all: a token already
streamed cannot be recalled."*

**`createProseCallGuard`** — a new, separate component. It is deliberately **not** an extension of
the artefact guard: that one is scoped to unbound sessions and redacts to a visible marker; this one
runs for every session and drops silently.

Its logic mirrors the artefact guard's proven quote handling:

1. Stream normally.
2. The moment the trailing text could be the start of a generator token, withhold from that point.
3. If it resolves to anything else, release immediately — nothing is lost.
4. If it resolves to `«generator»(`, hold to end of line.
5. At round end: **drop** the held line if the pin fired; **release it verbatim** if it did not.

Step 2 is why the latency cost lands on ~0 normal turns: nothing is ever held unless a generator name
has literally begun. §7.5 found no *"I could run `generate_hooks(...)` if you like"* discussion shape
anywhere in 107 runs, so the release path is expected to be rare — but it exists, and it is verbatim,
because the alternative is eating a creator's sentence on a false match.

## 6. The detector

Trigger: one of `generate_ideas` · `generate_hooks` · `write_script`, immediately followed by `(`.

A **local** name set, not a registry import — the same reasoning `repeat-ask.ts:57` gives for its
local `TOOL_TO_SKILL`: this module must not depend on the live registry, and a name it does not
recognise must simply not match rather than throw.

`read_concept` is **excluded**, matching `guess-pin.ts`'s deliberate omission of `read`: it is not a
generator, and the corpus never exercised it.

The detector returns a boolean. It never returns a skill — see §3.

## 7. Scoping

Mirrors the guess pin exactly:

- typed asks only (`!rawSkill`) — never overrides a real chip
- never a sealed visitor
- never when the turn is already pinned (chip, repeat-ask, or guess pin)
- **at most once per turn**, so it cannot loop

## 8. Flag

`ENGINE_PROSE_CALL_PIN`, server-side, **exact string `"true"`** — the house convention for a dark
flag, matching `ENGINE_GUESS_PIN` and `ENGINE_REPEAT_ASK_PIN`. A half-set flag reads as off.

⚠️ Not the `!== "false"` form. That is the *default-on* convention (`ENGINE_COUNT_HINT`), and this
ships dark.

## 9. Testing

Red-first, per the lane's rule. Then the **mutation battery** on every new test file.

⚠️ **The lane's most expensive recurring bug is a test that cannot fail**, and it has landed three
times across sessions 11 and 12. Session 11's mutation 3 survived the first pass because the test
said *"the best **idea**"* against a plural-only regex, so it passed against a first-match
implementation too. Session 12's exemplar-fence guard had **three of four assertions go green
against the fully-present defect**, because they asserted the row passed *in* rather than the bundle
handed *back*.

Every assertion must be verified to fail against unfixed code before it is kept.

Coverage:

- the detector: each generator name fires; `read_concept` does not; a name without `(` does not
- the target: an ask saying *hooks* whose prose call names `generate_ideas` pins **hooks** (§3)
- the guard: a held line is dropped when the pin fires, released verbatim when it does not
- the guard: a false start (`generated a lot of ideas`) releases with nothing lost
- scoping: no fire on a chip-pinned turn, a sealed visitor, or an already-pinned turn
- the loop: at most one extra round; a turn that dispatched normally is byte-identical
- flag off: byte-identical behaviour, asserted by test

## 10. What this rests on, stated plainly

**8 fires in 107 runs.** §7.6 records the retry half as "not built and not measured end-to-end", and
32 runs is a small corpus. The ~95%-at-~0-exposure figure is a **projection of composing two
mechanisms**, not a measurement of the composition.

**No single live run can clear this.** `temperature: 0` with a fixed seed is not reproducible on
DashScope — 9 identical inputs returned 9 different outputs. Verification means sampling N and
reporting a rate.

**The flag ships dark for that reason.** Default-ON is a later call, and it needs live sampled
measurement of the composition, on `virtuna-v11.vercel.app` — production last deployed 2026-08-07 and
merging does not deploy.

## 11. Out of scope

- Flipping `ENGINE_GUESS_PIN`. It stays dark; the count hint at ~85% with zero wrong-run exposure is
  the better trade, and this pin narrows the gap further.
- The generator-error shape (session 10 §7.4, seen once in the count arms): a *failed* tool call
  followed by the model delivering the pack in prose. It lives downstream of a dispatch, so no
  detector scoped to non-dispatch turns sees it. Real, separate, unaddressed here.
- The 18k–33k-character prose turn recorded in the composed-card lane. Reproduces with no card
  composed, so it is not this.
