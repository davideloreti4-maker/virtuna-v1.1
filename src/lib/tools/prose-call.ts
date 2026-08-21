/**
 * prose-call.ts — the model wrote the tool call instead of making it. Pin one more round.
 *
 * ─── THE DEFECT, AND WHY IT ONLY BECAME VISIBLE RECENTLY ─────────────────────────────────────
 *
 * `ENGINE_COUNT_HINT` (#480) closed the DISPOSITION half of this lane's dispatch defect — the model
 * arguing that *"'Student budgeting app' is the product, not the hook"* rather than running.
 * Dispatch went 2/12 → 16/20 and pushbacks 9 → 0 across both failing subject shapes.
 *
 * What is left is a different bug: the model has decided to run and fails to EXPRESS the call,
 * emitting it as creator-visible text —
 *
 *     generate_hooks(topic="stand-up comedy podcast", count=5)
 *     generate_ideas(topic='stand-up comedy podcast')
 *
 * Session 10 recorded this shape ONCE in 45 runs and called it "its own kind of bug". Counted, it is
 * 6 of 26 — not because it got worse, but because the defect that used to mask it is gone.
 *
 * ─── WHY THIS TRIGGER IS SAFE WHERE §11.2's WAS NOT ──────────────────────────────────────────
 *
 * ⚠️ `guess-pin.ts` argues at length that retrying after a non-dispatch is "strictly worse". THAT
 * ARGUMENT DOES NOT TRANSFER HERE, and the distinction is the whole basis of this module.
 *
 * Its trigger is "guessed AND the model called no tool", where a false positive is BY DEFINITION an
 * ask the model was right to decline — so the condition SELECTS for false positives instead of
 * filtering them. A prose call is the opposite: the model has asserted the specific call, by name,
 * with args. It is the model's own machine-readable statement of intent, and a false positive would
 * require it to write a tool call it did not mean.
 *
 * Its two concrete costs do not apply either. No blanket buffering of round-1 text (the guard below
 * withholds only from the moment a generator token has literally begun), and no second stream or
 * changed streaming contract (the loop takes one more round instead of breaking).
 *
 * Measured over all 107 recorded runs (`.scratch/analyse-prose-tool-call.ts`, free):
 *
 *     trigger fires                    8
 *       …on a run that DISPATCHED      0     ← never fires where a retry would be wrong
 *       …on a non-dispatch             8
 *     recall within the counted arms   6 of 7 residual failures
 *     overlap with the guess pin       8/8 would also have been pinned by it
 *
 * So this buys PRECISION, NOT COVERAGE: it covers only the failures where the model announced
 * itself, and its trigger cannot select for asks the model was right to decline.
 *
 * ⚠️ CORRECTED 2026-08-21. This paragraph used to read "it is the guess pin with the ~3.4%
 * wrong-run exposure removed." That was not true as written, and the difference matters to anyone
 * reasoning about the two together:
 *
 *   the guess pin   route.ts:519   detectGuessPin(rawAsk)   ← NARROWED by namesOtherToolFirst
 *   this pin        route.ts:569   guessSkill(rawAsk)       ← RAW, no narrowing
 *
 * The narrowing exists for one measured sentence — "Yes, run the simulate tool on that hook" —
 * which `repeat-ask.ts` independently names as the pre-router's single harmful guess. This module
 * never inherited it, and the design doc (§ below) never mentions it. So the exposure is not
 * "removed"; it is removed *by a different mechanism*, which is worth stating precisely because the
 * mechanisms have different edges:
 *
 *   The TRIGGER filters that ask, not the target. Firing requires the model to assert a GENERATOR
 *   call — `generate_ideas|generate_hooks|write_script` followed by `(` — and an ask that says "run
 *   the simulate tool" elicits `simulate(...)`, which is not in GENERATOR_NAMES and does not match.
 *
 * The behaviour is therefore sound and unchanged; only the explanation was wrong. Applying
 * `detectGuessPin` here would make the two sites consistent, but it is a change to measured design
 * behind a dark flag, and this module argues at length (above) that the guess pin's reasoning does
 * NOT transfer. Left as the owner's call rather than silently converged.
 * (The same raw-vs-narrowed split was a REAL defect at the third site, `route.ts:496` — Stage B's
 * dead-zone label, which is user-visible and shipping. Fixed in #536, pinned by route test 6g2.)
 *
 * ⚠️ It rests on 8 fires in 107 runs. Session 11 §7.6 records the retry half as "not built and not
 * measured end-to-end". The ~95%-at-~0-exposure figure is a PROJECTION of composing this with the
 * count hint, not a measurement of the composition — which is why it ships dark.
 *
 * Design: `docs/superpowers/specs/2026-08-13-prose-call-pin-design.md`.
 *
 * Pure, no I/O, no LLM. Deterministic.
 */

/**
 * The generators the loop binds. A LOCAL list, not a registry import — the same reasoning
 * `repeat-ask.ts` gives for its own `TOOL_TO_SKILL`: this module must not depend on the live
 * registry, and a name it does not recognise must simply not match rather than throw.
 *
 * ⚠️ `read_concept` is deliberately absent, mirroring `guess-pin.ts`'s omission of `read`. It is not
 * a generator, so a fire on it would pin the turn to an artefact the creator never asked for.
 */
const GENERATOR_NAMES = ["generate_ideas", "generate_hooks", "write_script"] as const;

const LONGEST_NAME = Math.max(...GENERATOR_NAMES.map((n) => n.length));

/**
 * Index of the earliest asserted generator call in `text`, or -1.
 *
 * "Asserted" means the NAME followed by `(` — the args are what make it a call rather than a
 * mention. `"generate_hooks is the tool for that"` names the tool while discussing it, and §7.5's
 * perfect precision over 107 runs rests on not treating that as intent.
 */
function findCall(text: string): number {
  let earliest = -1;
  for (const name of GENERATOR_NAMES) {
    for (let idx = text.indexOf(name); idx !== -1; idx = text.indexOf(name, idx + 1)) {
      if (!/^\s*\(/.test(text.slice(idx + name.length))) continue;
      if (earliest === -1 || idx < earliest) earliest = idx;
      break;
    }
  }
  return earliest;
}

/**
 * Earliest index from which the tail of `text` could STILL grow into a generator name, or -1.
 *
 * This is what keeps the withhold narrow. Only a tail that is already a prefix of a name is held;
 * everything before it streams immediately. Scanning only the last `LONGEST_NAME` characters is
 * sufficient because anything earlier can no longer become one.
 */
function partialStart(text: string): number {
  for (let i = Math.max(0, text.length - LONGEST_NAME); i < text.length; i++) {
    const tail = text.slice(i);
    if (GENERATOR_NAMES.some((n) => n.startsWith(tail))) return i;
  }
  return -1;
}

/**
 * Did this text assert a generator call?
 *
 * Returns a BOOLEAN and never a skill. The target is always `guessSkill`'s guess — see the route.
 */
export function detectProseCall(text: string): boolean {
  return findCall(text) !== -1;
}

/**
 * Server flag — ships dark, like `ENGINE_GUESS_PIN` and `ENGINE_REPEAT_ASK_PIN`. Exact string
 * "true" only, so a half-set flag reads as off.
 *
 * ⚠️ NOT the `!== "false"` form. That is the default-ON convention (`ENGINE_COUNT_HINT`), and the
 * composition this belongs to has not been measured live — see the module header.
 */
export function isProseCallPinEnabled(): boolean {
  return process.env.ENGINE_PROSE_CALL_PIN === "true";
}

export interface ProseCallGuard {
  /** Feed a streamed delta; emits whatever is now safe to show. */
  push: (delta: string) => void;
  /** Whether a generator call has been asserted in the stream so far. */
  sawProseCall: () => boolean;
  /**
   * Close the round. `pinFired` decides the withheld call's fate: DROPPED when the loop is taking
   * another pinned round (the creator gets cards instead), RELEASED VERBATIM when it is not.
   * Returns the full text the creator actually saw, which is therefore also what gets persisted.
   */
  close: (pinFired: boolean) => string;
}

/**
 * Withhold a malformed tool call so the creator never reads it.
 *
 * 🔴 WHY WITHHOLDING AND NOT POST-FILTERING. Round-1 text streams straight through
 * (`chat-agent-loop.ts`), and the artefact guard that could hold it back runs only for anonymous
 * sessions (`sealedVisitor || unbound`) — a signed-in creator's stream is byte-for-byte untouched.
 * So by the time a prose call can be detected, it is already on their screen. `createArtefactGuard`
 * states the rule this codebase learned the hard way: "a token already streamed cannot be recalled."
 *
 * Deliberately NOT an extension of that guard. It is scoped to unbound sessions and redacts to a
 * visible marker; this runs for every session and drops silently.
 *
 * Once a call is confirmed, everything from it onward is held to the end of the round rather than
 * streamed past it. That costs a little tail latency on the ~7% of turns that do this, and it is
 * what keeps the released text IN ORDER on the turns where the pin does not fire.
 */
export function createProseCallGuard(onToken: (delta: string) => void): ProseCallGuard {
  let shown = ""; // everything released to the creator
  let held = ""; // withheld: either a growing name prefix, or the locked call onwards
  let locked = false; // a call is confirmed; `held` starts at it and runs to end of round
  let saw = false;

  const release = (text: string) => {
    if (!text) return;
    shown += text;
    onToken(text);
  };

  return {
    push(delta: string) {
      held += delta;
      if (locked) return; // everything from the call onward stays held until close

      const call = findCall(held);
      if (call !== -1) {
        release(held.slice(0, call));
        held = held.slice(call);
        locked = true;
        saw = true;
        return;
      }

      // Hold only a tail that could still become a name; stream everything before it.
      const partial = partialStart(held);
      const safe = partial === -1 ? held.length : partial;
      release(held.slice(0, safe));
      held = held.slice(safe);
    },

    sawProseCall() {
      return saw;
    },

    close(pinFired: boolean) {
      if (!locked) {
        // A name prefix that never completed — the creator's own words. Never eat them.
        release(held);
        held = "";
        return shown;
      }
      if (pinFired) {
        // Drop the call itself, keep the line break and anything after it.
        const newline = held.indexOf("\n");
        release(newline === -1 ? "" : held.slice(newline));
      } else {
        release(held);
      }
      held = "";
      return shown;
    },
  };
}
