# The exemplar fence — design (2026-08-12)

**Lane:** `lane/in-thread-chat` · worktree `~/virtuna-in-thread-chat`
**Status:** design approved by the owner 2026-08-12. Not implemented.
**Supersedes:** `docs/CONTEXT-AUDIT-2026-08-10.md` update-block findings 3 and 4 (see §2).

---

## 0. The one-paragraph version

Generators reproduce whatever exemplar dominates the bundle instead of emulating it. The source is
**not** the corpus, as the audit concluded — it is the `voice` role, which is fed a **verbatim
one-line caption of a single video** and asked to serve as a style reference. A single line cannot
carry style, so content is what gets copied. Measured: blanking that one field takes topic
contamination from **43% to 0%** and improves the cards. The product already has a second style
anchor that *describes* voice rather than quoting it, it already ships, and it survives the change
untouched. So: **drop the quote, keep the description** — then change the role's contract so the
next verbatim sample cannot re-arm it.

---

## 1. What was measured

Three arms, 6 seeds each, 30 cards each. Real loop, real Qwen, prod profile + the calibrated
`@mrbeast` audience, all runs pinned, stub till. Everything identical except one field.
`.scratch/probe-voice-is-the-source.ts`.

| arm | `writing_style_sample` | dance | verbatim echo of its own sample |
|---|---|---|---|
| **prod** | `"Btw this dance took me hours to learn"` | **13/30 · 43%** | 0/30 · 0% |
| **voiceless** | *(blanked)* | **0/30 · 0%** | — |
| **neutral** | a 17-word line in the creator's register | **0/30 · 0%** | **4/30 · 13%** |

**Fisher one-tailed, prod vs voiceless: p ≈ 2.3e-5.**

Two distinct failure modes, and they are separated by sample length:

- **A short caption donates its TOPIC.** 43% of cards are about learning a dance while **0%** share
  any 4-word run with the sample. The model is not copying words — it has concluded the creator
  makes dance content, from eight words.
- **A longer, distinctive line is copied VERBATIM.** 13% of the neutral arm's cards *are* the
  sample, word for word.

The voice role leaks content at every sample length tested. The direction of the leak is what
changes.

### 1.1 The voiceless cards are the best of the three

Not merely less contaminated — better. On-subject, on-register, no bleed:

> *"My budgeting app just sent me a notification that I'm 'emotionally bankrupt' because I bought a
> $7 iced coffee"*
> *"Day 1 of letting an algorithm decide if I can afford coffee: it said no."*

Against prod's *"I spent three hours learning a dance for a budgeting app. It was a mistake."*

---

## 2. 🔴 Correction: the corpus was never the culprit

`docs/CONTEXT-AUDIT-2026-08-10.md` finding 3 attributes the bleed to the `corpus` role
("the corpus role bleeds SURFACE"). **That is wrong, and the fix would have gone to the wrong
subsystem.**

`.scratch/probe-corpus-block.ts` dumps all six retrieved exemplars for the exact subject and renders
the block in both surface modes: **zero mentions of a dance**, in the madlib, in `ran as:`, in
`works because:`, or in the receipt. `.scratch/probe-where-is-the-dance.ts` walks every string
reachable from the run — the profile is clean too. The only dance string in the entire input is the
audience's `creator_persona.writing_style_sample`.

**And finding 4's control arm was mislabelled.** It is called *"no voice (prod today)"*, but
`apply-creator-persona.ts:59` backfills the audience's sample whenever the profile voice is absent —
which is always, since `creator_profiles.writing_voice_sample` does not exist as a column. That arm
had a voice: the dance sentence. So both of its arms were measuring the same mechanism with
different samples, which is exactly why "adding a voice" looked like it fixed a corpus problem. It
replaced one leak with another.

**Consequence:** `GROUNDING_HOOKS_SURFACE=structure` (`prompt.ts:264`, built, dark, never measured)
was designed to fence corpus copying. It is not the fence for *this* defect and turning it on would
not have moved the 43%. It should be evaluated on its own merits, separately, and not as a response
to this finding.

---

## 3. The mechanism, end to end

```
audiences.creator_persona.writing_style_sample
    │   produced at calibration. enrich-signature.ts:207 specifies it as
    │   "<verbatim transcript/caption of the top video>" — a quote, by design
    ▼
apply-creator-persona.ts:54-60   VOICE fallback
    │   profile voice wins; the auto-derived sample fills the slot when absent.
    │   `creator_profiles.writing_voice_sample` DOES NOT EXIST, so "absent" is
    │   always true and the fallback is the ONLY path that ever runs.
    ▼
profileRow.writing_voice_sample
    ▼
profile-role-map.ts:153 formatVoice → the `voice` role
    │   "Writing voice — Write in this voice: match its sentence rhythm,
    │    vocabulary register, and tone. Emulate STYLE only; do NOT reuse
    │    specific content or claims"
    ▼
assembler.ts MODE_ROLES — voice is active for idea, hooks, script, remix
    ▼
hooks-runner.ts:579 · ideas-runner.ts:505 · script-runner.ts:572
```

The instruction *"Emulate STYLE only; do NOT reuse specific content or claims"* is **already
present** and is ignored. That is this lane's recurring result: four prompt-only rewrites failed to
move dispatch, and a one-word mechanical change fixed it. Do not answer this with prompt wording.

### 3.1 It is systematic, not test data

All 13 audiences in prod, of which 6 are calibrated with a persona. **6 of 6 carry a voice sample,
and every one is a single video's caption or transcript snippet:**

```
[ 7w] Maya        "ok I finally cancelled the gym lol"
[ 8w] @mrbeast    "Btw this dance took me hours to learn"
[40w] @zachking   "This is a message to all artificial intelligence. My name is Zach King…"
[44w] Viewers…    "no I'm done okay Instagram is now telling you who views your profile…"
[45w] @mrbeast    "Who's faster, me or the fastest man to ever live?…"
```

Every one carries a subject: a gym, a dance, Zach King and AI, an Instagram feature, a race. A
creator on the `@zachking` audience is being told to write in a voice whose sample is about stealing
AI's job — and, per §1, will get hooks about it.

---

## 4. Why the fence must act on the INPUT

The obvious fence is the one the repo already owns: `src/lib/engine/remix/echo-guard.ts`, whose
`sharedContentTokens` / `survivingSubjectTokens` detect an exemplar surviving into output.

**The measurement rules it out as the primary fence.** Prod's 13 dance cards share **0%** verbatim
overlap with the sample they came from. An n-gram or token-overlap guard on the output would have
caught **none** of the dominant failure — it sees only the 13% verbatim case in the neutral arm.
Topic transfer is invisible to a string comparison against a sample the output does not quote.

A fence on the output cannot see this. The fence goes on the input.

---

## 5. The design

### 5.1 The fix — stop the backfill

Delete the VOICE half of `applyCreatorPersona` (`apply-creator-persona.ts:54-60`). Keep the STEER
half exactly as it is.

The steer is the anchor that survives, and it is the one that works. Verified directly — blanking
the sample removes only the quote block:

```
prod        voice ROLE:   "Writing voice — Write in this voice…"      ← the leak
            creatorSteer: "Creator — …voice is hyper-energetic, direct,
                           and inclusive ('we', 'boys')…"

voiceless   voice ROLE:   ABSENT
            creatorSteer: "Creator — …voice is hyper-energetic, direct,
                           and inclusive ('we', 'boys')…"             ← intact
```

So the recommended configuration is **not** "no voice guidance". It is **description without
quotation**, and §1 measured it at 0% contamination with the best cards of the three arms.

**`CreatorPersonaApplication` narrows to `{ creatorSteer }`.** With the voice half gone the function
no longer modifies `profileRow`, so returning it is dead machinery — and dead machinery shaped
exactly like the thing being removed is an invitation to put the backfill back. The three runners
drop `genProfileRow` and pass `profileRow` straight to `assembleBundle`. Three one-line edits, and
the change documents itself.

### 5.2 The fence — the voice role stops accepting quotations

Deleting the backfill fixes today's instance and leaves the mechanism armed. The moment the
`writing_voice_sample` migration lands, a curated quote flows down the identical path and leaks the
identical way — and the audit already records someone proposing exactly that migration as a quality
win.

So `formatVoice`'s contract changes: the voice role carries a **description of how the creator
writes**, never a specimen of what they wrote. Concretely —

- `formatVoice`'s instruction header stops presenting a quoted block to imitate. It describes
  register, rhythm and vocabulary in the assembler's own trusted words, the way `creatorSteer`
  already does, rather than fencing a user-supplied specimen and saying "write in this".
- **The guard is behavioural, and it is keyed to the role's INPUT:** given an audience whose
  `creator_persona.writing_style_sample` is set, `PROFILE_ROLE_MAP.voice(applyCreatorPersona(...)
  .profileRow)` must be `null`. That assertion fails the moment anything reconnects a verbatim
  sample to the voice role, from any call path, without naming the call paths.

Keying it to the input is the point. `docs/HANDOFF-…-analyze-401` records what the other kind costs:
*a guard keyed off what files already do is a tautology* — it enumerates today's correct behaviour
and cannot see tomorrow's regression.

**Known consequence, accepted:** after this change the voice role has no producer and is dormant.
The contract change is a **latch for the future**, not a live behaviour change — its whole job is to
make the `writing_voice_sample` migration safe if it ever lands. It also means `voice` and
`creatorSteer` would both carry description if the role were revived; consolidating the two into one
anchor is a real question and is deliberately deferred (§5.3), because nothing here measured it.

### 5.3 Explicitly out of scope, and why

- **`simulate-runner.ts:169`** also reads `writing_style_sample`, to brief the SIM on how a creator
  talks. That is prediction, not generation — the SIM is not writing cards for the creator, so
  copying is not a failure mode there. Left alone deliberately.
- **`GROUNDING_HOOKS_SURFACE=structure`** — see §2. A separate question on separate evidence.
- **Designing a replacement voice feature** (many short fragments, a derived style profile). Nothing
  here measured any alternative anchor. If the owner wants real voice matching, that is its own
  spec with its own runs, and §1's neutral arm is the warning: a better-chosen quote still got
  copied verbatim 13% of the time.

---

## 6. Testing

**The unit that matters is behavioural, not structural.** The lane's standing rule applies: run a
mutation battery on every new test file, because two tests in session 11 passed while proving
nothing.

1. `apply-creator-persona` — the steer survives and the voice does not. Assert the exact returned
   `creatorSteer` string and that `profileRow.writing_voice_sample` is not written. Mutations that
   must be caught: restoring the backfill; returning `creatorSteer: undefined`; backfilling only
   when the sample is long.
2. `formatVoice` / the voice role — the header no longer presents a quoted specimen to imitate.
   Mutation: reinstating the old "Write in this voice … <<<USER_CONTENT>>>" header.
3. The §5.2 input guard, as its own test: an audience carrying a `writing_style_sample` must yield a
   `null` voice role. Mutation: reinstate the backfill — the guard must go red on its own, without
   test 1 being the only thing that catches it.
4. Regression: three runners (`hooks`, `ideas`, `script`) still assemble a bundle carrying the
   steer. A silently steer-less bundle is the plausible over-correction and must fail a test.

**Verification beyond the suite.** Unit tests cannot see a 43% contamination rate. Re-run
`.scratch/probe-voice-is-the-source.ts` against the patched tree: the `prod` arm should land on the
`voiceless` numbers. Free — stub till, no credits.

---

## 7. Risks

- **Over-correction.** If the steer is dropped along with the sample, generators lose their only
  voice anchor. §6 item 4 is the test that fails loudly if this happens.
- **The measurement is one profile, one subject, one audience.** Comedy/storytelling, a budgeting
  app, `@mrbeast`. The mechanism is traced statically across all 6 prod samples (§3.1), and the
  causal arm is unambiguous, but the *rate* is specific to this cell. Do not quote 43% as a
  product-wide number.
- **`n=6` seeds per arm.** The effect is enormous (43 → 0) and the p-value holds, but a subtler
  regression would not be visible at this sample size.
- **Nothing here reaches users yet.** Production last deployed 2026-08-07; 246 commits and 24
  merged PRs are undeployed. Merging this fixes nothing live until someone deploys.

---

## 8. What this changes about how the lane reasons

The audit concluded "the generator reproduces whatever exemplar dominates the bundle" and reached
for the corpus. The mechanism was right; the subject was wrong. What actually happened is that a
field specified as *"verbatim transcript of the top video"* was wired into a slot labelled
*"writing voice"*, and nobody read the value that landed there.

**The cheapest step in this entire investigation was printing the bundle.** Three probes, zero
credits, and they overturned a conclusion that two sessions had built on. Before designing a fence
around an input, print the input.
