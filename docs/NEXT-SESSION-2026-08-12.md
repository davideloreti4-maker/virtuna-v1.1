# ▶ Next session — copy-paste brief (written 2026-08-12, end of session 11)

Paste the block below into a fresh session. Everything it references is committed and merged.

---

```
Lane: in-thread chat. Worktree ~/virtuna-in-thread-chat, branch lane/in-thread-chat.
Session 11 is MERGED (PR #475, main = be2237ce). Working tree is clean.

READ FIRST, in this order:
  1. docs/HANDOFF-2026-08-12-session-11-guess-pin.md   — §0 START HERE, then §7
  2. docs/CONTEXT-AUDIT-2026-08-10.md                  — the UPDATE block at the top only

WHAT SHIPPED (both flags DARK — production is byte-identical until one is set):
  ENGINE_COUNT_HINT   injects a count into the assembled bundle. Live-verified 0/6 -> 6/6
                      (p ~ 0.002). Forces nothing, so NO wrong-run exposure. Ready for
                      default-ON on the owner's word.
  ENGINE_GUESS_PIN    pins round 1 to the pre-router's guess. ~100% but ~3.4% of fires would
                      run something unasked-for. The FALLBACK, not the first choice.

THREE DECISIONS WAITING ON THE OWNER (none blocking, all documented):
  1. Turn ENGINE_COUNT_HINT on for real users?
  2. May a count the creator did not type ride in the bundle? (They approved BUILDING it,
     not shipping it. Every dispatching run returns 5 cards either way.)
  3. The §12.4 lever design call — untouched since session 10. Input is in session 10 §12:
     the lever field is 9 templated constants, none of which reads a persona reaction.

MY RECOMMENDED NEXT WORK — the exemplar fence (handoff §8 item 4):
  The generator REPRODUCES whatever exemplar dominates the bundle instead of emulating it.
  Measured, 16 pinned runs: with no voice, 45% of cards for a budgeting app copy the corpus's
  TikTok-dance surface. Backfill a voice sample and that goes to 0% -- while 33% of the pack
  becomes the voice sample echoed back VERBATIM. Original cards barely move (22/40 -> 27/40).
  Removing one exemplar source just promotes the next.
  This needs a design conversation before code (what a style anchor should DO), so start with
  brainstorming, not implementation.
  ⚠️ Do NOT ship the creator_profiles.writing_voice_sample migration as a quality win. That
  column does not exist in the DB, and adding it trades dance hooks for parroted hooks.

TRAPS THAT COST TIME TODAY — do not re-learn these:
  · The suite is FLAKY on a loaded machine (5s per-test timeouts, different tests each run,
    all green in isolation). Use --maxWorkers=3 for a deterministic signal. An unconstrained
    red run is not a regression until you check WHICH tests moved.
  · A live probe against /api/tools/chat reuses the account's open thread, so N POSTs are ONE
    conversation, not N first turns. Send cookie maven_active_thread=__new__. The confounded
    run's TALLY matched the offline control while measuring the wrong population -- only
    reading the replies caught it.
  · Run mutation tests on every new test file. TWO tests this session passed while proving
    nothing (route test 6h, and the count hint's destination rule) and only mutation exposed
    them. Batteries: .scratch/mutate-guess-pin.sh, .scratch/mutate-count-hint.sh
  · Score exemplar copying with a VERBATIM-ECHO check, never a "mentions the wrong topic"
    regex -- the topic regex reads 0% while the pack is entirely copied.
  · A COUNT in the ask is the strongest lever found in this lane. "give me 5 hooks" vs
    "give me hooks" moved dispatch 20% -> 94%. Worth trying before any prompt rewrite;
    four prompt-only rewrites have failed here.

STATE: 0 credits are needed for anything offline -- .scratch/dispatch-lib.ts runs the real
loop behind a stub till and grounding is explicit-only, so a fresh topic never hits Apify.
Live-route runs DO bill (1 credit per hooks pack) on a shared REAL prod account.
.scratch/ (113 files, the only copy of 290 runs) is backed up to
~/virtuna-parked/scratch-backups/in-thread-chat-2026-08-12
```

---

## For the owner, in plain words

**What got fixed.** When a creator asked for hooks about a thing they'd made — their app, their
podcast — the app usually argued instead of generating. Roughly 4 times out of 5. It now generates,
and the fix that worked was giving the model a number ("5 hooks" instead of "hooks"), which is free
and can't charge anyone by mistake.

**What's switched off.** Both fixes ship disabled. Nothing has changed for any real user yet. The
good one is ready whenever you say.

**What we learned that matters more than the fix.** The model had everything — the creator's niche,
their audience, the whole conversation, the examples — and still refused. Adding one word fixed it.
So behaviour here is driven far more by the shape of the request than by everything we assemble
around it. Worth remembering the next time the answer looks like "give it more context."

**The biggest thing still broken.** The examples we show the model get **copied**, not learned from.
Nearly half the hooks written for a budgeting app were about learning a TikTok dance — because the
examples were dance videos. Adding the creator's own writing sample fixes that and creates a worse
problem: the app starts handing the creator their own sentences back as hooks. This affects packs
that already work today, and it's the thing I'd fix next.
