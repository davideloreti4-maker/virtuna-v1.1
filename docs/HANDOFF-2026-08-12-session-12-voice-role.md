# Handoff — session 12: the count hint shipped, and the copying defect was misdiagnosed (2026-08-12)

**Lane:** `lane/in-thread-chat` · worktree `~/virtuna-in-thread-chat`
**Predecessor:** `docs/HANDOFF-2026-08-12-session-11-guess-pin.md`
**Both PRs MERGED** — #480 (`ENGINE_COUNT_HINT` default-ON) and #482 (the voice-role fix).

---

## 0. ▶️ START HERE

**Two things shipped, and the second one overturns a conclusion two sessions were built on.**

| | |
|---|---|
| **#480** — `ENGINE_COUNT_HINT` is ON by default | live-verified **7/9** vs **0/6** control |
| **#482** — the voice role stops donating content | **43% → 0%**, all arms now identical |

🔴 **Nothing is live.** Production last deployed **2026-08-07**. Merging does not deploy — see §5.

**The single most useful thing this session did was print the bundle.** Three free probes overturned
the corpus attribution that sessions 10 and 11 had built on. Before designing a fence around an
input, print the input.

---

## 1. The count hint is ON — and it is ~85%, not ~100%

Session 11 reported **6/6** live and it read as a total fix. Re-measured on the shipped default
(no env var set anywhere, verified absent from `.env.local`): **7/9**, which lands exactly on the
offline 16/20. Pooled live: **13/15 with the count vs 0/6 without.**

One run in each batch still returned the defect verbatim — *"'Student budgeting app' is a finance
topic, but your niche is comedy storytelling."* The effect is large and real; **the ceiling is not
1.0.** Do not quote 6/6.

`!== "false"` per the house convention. The kill switch is the exact string `"false"`, and a
half-set flag stays ON. 6-mutation battery, 6/6 caught, including `currentAsk: bundleAsk` (the
honesty boundary) and a typo'd sentinel that would leave the switch dead.

⚠️ **Reading the cards, not the tally, is what opened the rest of this session.** The 6/6
verification only ever counted *whether* cards came back. Scoring their content showed **51% of live
cards were about a TikTok dance**, one line appearing verbatim in 5 of 7 independent packs.

---

## 2. 🔴 THE COPYING DEFECT WAS MISATTRIBUTED — it was never the corpus

`docs/CONTEXT-AUDIT-2026-08-10.md` finding 3 says *"the corpus role bleeds SURFACE"*. **Wrong, and
the fix would have gone to the wrong subsystem.**

The whole chain, measured free:

- `.scratch/probe-corpus-block.ts` — all six retrieved exemplars for the subject, rendered in both
  surface modes: **zero mentions of a dance**, in the madlib, in `ran as:`, in `works because:`, or
  in the receipt.
- `.scratch/probe-where-is-the-dance.ts` — walks every string reachable from the run. The profile is
  clean too. The **only** dance string is the audience's `creator_persona.writing_style_sample`:
  **`"Btw this dance took me hours to learn"`** — eight words.
- `apply-creator-persona.ts:59` backfilled that into `profileRow.writing_voice_sample`, and the
  voice role rendered it as *"write in this voice"*.

**And finding 4's control arm was never voiceless.** It is labelled *"no voice (prod today)"*, but
the backfill always ran — `creator_profiles.writing_voice_sample` does not exist as a column, so
`hasProfileVoice` was `false` every time. **Both of its arms measured one mechanism with two
samples**, which is exactly why "add a voice" read as a fix for a corpus problem.

### 1.1 It was systematic, not test data

All 6 calibrated audiences in prod carry a voice sample, and every one is a single video's caption
— `enrich-signature.ts:207` specifies the field as *"verbatim transcript/caption of the top video"*:

```
[ 7w] Maya        "ok I finally cancelled the gym lol"
[ 8w] @mrbeast    "Btw this dance took me hours to learn"
[40w] @zachking   "This is a message to all artificial intelligence. My name is Zach King…"
[44w] Viewers…    "no I'm done okay Instagram is now telling you who views your profile…"
[45w] @mrbeast    "Who's faster, me or the fastest man to ever live?…"
```

Every one carries a subject. A creator on the `@zachking` audience gets hooks about stealing AI's
job.

---

## 3. What shipped, and the two lessons inside it

3 arms × 6 seeds, real loop, one field different. `.scratch/probe-voice-is-the-source.ts`, free.

| arm | dance **before** | **after** | verbatim echo before → after |
|---|---|---|---|
| prod | **13/30 · 43%** | **0/30 · 0%** | 0% → 0% |
| voiceless | 0/30 · 0% | 0/26 · 0% | — |
| neutral (17-word line) | 0/30 · 0% | 0/30 · 0% | **13% → 0%** |

`p ≈ 2.3e-5` before. **All three arms are now identical** — the signature the fix predicts, since
the sample no longer reaches the generator.

🔑 **Two failure modes, and they are different.** A short caption donates its **TOPIC** (43% dance
while sharing **0%** of the sample's words). A longer, better-chosen line is reproduced **VERBATIM**
as 13% of the pack. The role leaked at every sample length; only the direction changed.

🔑 **This rules out the obvious fence.** An `echo-guard.ts`-style n-gram check on the OUTPUT would
have caught **0 of the 13** dance cards. **A fence on the output cannot see topic transfer.**

**What survives is the STEER**, and it is the better anchor — `creator_persona.context` already
DESCRIBES the voice (*"hyper-energetic, direct, and inclusive ('we','boys')"*) instead of quoting a
video. Drop the quote, keep the description.

⚠️ **THE TEST THAT PROVED NOTHING, AGAIN — and TDD is the only reason it was caught.** The first
draft of the guard had four assertions; **three went GREEN against the fully-present defect.** They
assembled the profile row passed *in*, while the runners assemble the row handed *back* (the
backfill clones, so the input is clean either way). The guard is now keyed to the **assembled
bundle**. 5-mutation battery, 5/5 caught — `.scratch/mutate-exemplar-fence.sh`.

---

## 4. Do next

1. 🔴 **The residual gap is real and named.** The guard covers the AUDIENCE path only. A future
   `creator_profiles.writing_voice_sample` column reaches the voice role without tripping it, and
   `adapt.ts` + `adapt-profile.ts` also read that field. **The structural answer is the type-level
   fence** — rename the field to `…_description` so a verbatim sample cannot be assigned without
   someone noticing. Judged out of scope in #482; it is the next piece of this work.
   ⚠️ Still do not ship the `writing_voice_sample` migration as a quality win — the neutral arm is
   the warning: a well-chosen quote was copied verbatim 13% of the time.
2. **The prose-call retry** (session 11 §7.5), pinned to `guessSkill` and NOT the emitted tool name.
   Closes 6 of 7 residual dispatch failures at ~0 measured exposure. Unchanged, still the best
   next dispatch work.
3. **`ENGINE_GUESS_PIN` stays dark.** The count hint at ~85% with zero wrong-run exposure is a
   better trade than the pin's ~100% at 3.4%.
4. **§12.4 lever narration** — the oldest open owner design call, untouched since session 10.
5. **The `creator_persona` producer itself.** `enrich-signature.ts:207` asks calibration for a
   verbatim caption and calls it a style sample. The fix stopped it reaching generators; the
   producer still mislabels it, and `simulate-runner.ts:169` still consumes it (left alone — the SIM
   predicts reaction, it does not write cards, so copying is not a failure there).

---

## 5. 🔴 NOTHING SHIPPED TODAY IS LIVE

Measured, not assumed:

```
last PRODUCTION deployment   2026-08-07T21:48Z  (PR #455)
PRs #480 and #482 merged     2026-08-12         → produced NO deployment
undeployed backlog           246 commits · 24 merged PRs (before today)
```

⚠️ **And the custom domains 404 — the owner confirmed this is INTENTIONAL (2026-08-12). Do not
re-raise it as an outage.**

```
numenmachines.com / www / maven   404 DEPLOYMENT_NOT_FOUND
virtuna-v11.vercel.app            200   ← the only host that serves
```

Ruled out so nobody repeats it: DNS is correct (Vercel anycast), the Aug-7 build is alive at its own
URL, and `"live": false` is a red herring (an unrelated project is also `live: false` and serves
200).

🔑 **The verification recipe in `memory/vercel-git-disconnected.md` is DEAD** — it says *"measure the
change on `numenmachines.com`"*. That host 404s for every path. **Use `virtuna-v11.vercel.app`**, and
expect Aug-7 code behind it.

---

## 6. Traps carried forward

- The suite is FLAKY on a loaded machine. Use `--maxWorkers=3`. This session's one red
  (`composer-fold-on-close`) was green in isolation and untouched by the change.
- A live probe against `/api/tools/chat` reuses the account's open thread — send
  `maven_active_thread=__new__`.
- Score copying with a **verbatim-echo** check AND a topic check. This session proved they are
  different defects: 43% topic transfer at 0% verbatim overlap.
- **Run the mutation battery on every new test file.** Two in session 11, one in session 12.

⚠️ `.scratch/` is gitignored and is the only copy of these runs. New this session:
`probe-corpus-block.ts`, `probe-where-is-the-dance.ts`, `probe-voice-is-the-source.ts`,
`probe-voice-samples-in-prod.ts`, `mutate-count-hint-default-on.sh`, `mutate-exemplar-fence.sh`,
plus `voice-source.log` / `voice-source-AFTER.log`.

**Spend: 7 credits**, all on #480's live verification. Everything in §2–§3 was free.
