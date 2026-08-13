# Handoff — session 13: the type-level fence, and the producer the spec said didn't exist (2026-08-13)

**Lane:** `lane/in-thread-chat` · worktree `~/virtuna-in-thread-chat`
**Predecessor:** `docs/HANDOFF-2026-08-12-session-12-voice-role.md`
**Closes:** session 12 §4.1 (the type-level fence) and §4.5 (the `creator_persona` mislabel).

---

## 0. ▶️ START HERE

Session 12 fenced the AUDIENCE path and named the residual gap: the profile slot was still spelled
`writing_voice_sample`, and `adapt.ts` / `adapt-profile.ts` read it untouched. This session shipped
the rename that closes it — and found, on the way, that the profile-path producer the spec called
hypothetical **has been in the product the whole time.**

| | |
|---|---|
| the fence | `writing_voice_sample` → `writing_voice_description`, 5 production sites |
| the find | 🔴 **Card 9 of the creator interview IS the profile producer** — and its answer is silently discarded |
| verification | tsc 0 · build 0 · **6330 passed / 42 skipped / 0 failed** · mutation battery **5/5** · screenshot |

🔴 **Nothing here is live.** Production last deployed **2026-08-07**. Merging does not deploy.
Verify on `virtuna-v11.vercel.app`, never `numenmachines.com` (404s BY DESIGN).

---

## 1. 🔴 THE PROFILE PRODUCER EXISTS, AND IT ASKED FOR THE EXACT DEFECT VALUE

`docs/superpowers/specs/2026-08-12-exemplar-fence-design.md` reasons throughout from *"there is no
producer today"*. There is. It is **Card 9 of the 10-card creator interview**, and until this
session its placeholder read:

> *"Paste a short script or caption you want to sound like — the engine will match your style, not
> copy the content."*

That is verbatim the promise #482 measured as **false** — a pasted line donates its topic (43%) or
its words (13% verbatim), never its style. The UI was soliciting the specimen the fence exists to
exclude, and telling the creator it was safe.

**It is harmless today only by accident.** Traced end to end:

```
profile-interview-store.ts:185   serializes { writing_voice_sample: draft.voice }
  → PATCH /api/profile/creator-profile
creator-profile.ts:58            creatorProfilePatchSchema is a plain z.object
                                 → zod STRIPS the unknown key. No error, no log.
creator_profiles (prod)          has NO voice column at all — verified by SQL 2026-08-13
```

Two independent accidents, either of which could be removed by someone "fixing" the other. The
migration `20260619000100_creator_profile_writing_voice_sample.sql` exists in the repo and was
never applied — applying it alone would still be inert; adding the field to the whitelist alone
would 400 every finalize. **Both together silently arm the 43% defect in production.**

Pinned in `schemas/__tests__/creator-profile.test.ts` with the reason and the exact two-step wiring
spelled out, so the next person to touch it gets a failing test instead of a live regression.

⚠️ The copy is now honest (it asks for a description) but the answer is **still discarded**. That
was left deliberately — see §4.

---

## 2. The fence, and what its RED actually proved

The rename is the fence: `writing_voice_description` cannot be filled with a quoted caption without
contradicting itself. Five production sites — `profile-role-map.ts` (field + `formatVoice`),
`assembler.ts` (`hasVoice`), `adapt.ts` (`AdaptProfile` + the `voice (write like this)` render),
`adapt-profile.ts` (`buildAdaptProfile`), `profile-interview-store.ts` (Card 9).

🔑 **`tsc` found every remaining call site.** That is the whole argument for a rename over a comment:
seven test fixtures surfaced as type errors, not as a grep the next person has to remember to run.

**The red test measured the gap rather than assuming it** — `voice-description-fence.test.ts`
asserts on the **assembled bundle**, not the row passed in (spec §6: three of #482's first four
assertions went green against the fully-present defect by checking the input):

```
expected '## Live Grounding Bundle…' not to contain 'Btw this dance took me hours to learn'
```

Before the fence, a row carrying the legacy key put the measured specimen straight into the string
the model sees. 6 of 7 assertions red for that reason; 7/7 green after.

**Mutation battery — 5/5 caught** (`.scratch/mutate-voice-description-fence.sh`). The two that
matter:

| | |
|---|---|
| **M2** | read the new key, **fall back** to the old one — the shape a well-meaning "don't break existing rows" patch takes, which silently restores the defect |
| **M5** | fence by **amputation** — hard-disable the voice role. Every "the specimen must not appear" assertion passes; only the counterweight test catches it |

---

## 3. §4.5 — the mislabel is documented, NOT renamed, and that is deliberate

`enrich-signature.ts` SYNTH_SYSTEM asks for `"writing_style_sample": "<verbatim transcript/caption
of the top video>"`. The name says style; the producer asks for a specimen. Both now carry the
contract in their doc (`audience-types.ts`, `enrich-signature.ts`), naming the SIM as the one
legitimate consumer.

🔑 **Renaming it was rejected on evidence, not taste.** Unlike the profile field, this one is
**persisted jsonb on live `audiences` rows** — all 6 calibrated audiences carry it — and it is read
by `profile-bake.ts`, `general-baseline-signature.ts` and `simulate-runner.ts`. A rename needs a
back-compat read and a data pass, which is a different risk class from a compile-time rename of a
field nothing populates. Left as named follow-up work.

Also corrected, all stale and all actively misleading:
- `assembler.ts:54` described the removed backfill as live, and its 4000→6000 cap measurement has a
  voice row that is now **always empty**. Do not re-derive headroom from it.
- `audience-types.ts:107` said the specimen feeds "generation voice". It has not since #482.
- `route.ts:516` labelled the count hint **"flagged OFF"** while `count-hint.ts:57` has been
  default-ON since #480.

---

## 4. Do next

1. 🔴 **The Card 9 decision is the owner's, and it is now a clean two-way door.** Either wire it
   (column + whitelist entry — the fence makes the slot safe, and `formatVoice`'s header is
   measured-correct against a description) or drop the card. What is not defensible is the current
   state, where the UI asks a question and throws the answer away. Not done here because a new prod
   column is a live DDL and `supabase db push` is unsafe on this project (ledger drift).
2. **The prose-call retry** (session 11 §7.5), pinned to `guessSkill` and NOT the emitted tool name.
   Unchanged and still the best next dispatch work: 6 of 7 residual failures, ~0 measured false
   positives across 107 runs. ⚠️ It rests on **8 fires** — budget for sampled live runs, and note
   that `guess-pin.ts:23`'s argument against a retry does **not** apply to this trigger (it targets
   the *no-tool-call* trigger; a prose-call fires only on non-dispatch, so round-1 text needs no
   buffering and the ~2–3s latency objection does not transfer).
3. **`ENGINE_GUESS_PIN` stays dark.** Unchanged.
4. **§12.4 lever narration** — still the oldest open owner design call, untouched since session 10.
5. **The `creator_persona` rename**, with the back-compat read §3 describes.

---

## 5. ⚠️ WHAT THIS SESSION DID NOT MEASURE

Stated plainly because this lane's recurring failure is a structural change reported as a quality
win:

- **No LLM runs. No live verification. Zero credits spent.** The fence is a compile-time and
  bundle-level property; the 43%→0% numbers quoted throughout are **#482's**, not new measurements.
- **Card 9's copy change has no behavioural effect today** — the field is not persisted, so nothing
  reaches a generator either way. Its value is deciding what lands in the column on the day someone
  adds it, and removing a false promise from the UI.
- The screenshot verified the rendered copy (`.scratch/card9-voice-description.png`, via a
  throwaway `zz-preview` page, deleted). It proves the strings render and fit — nothing about
  generation.

---

## 6. Traps carried forward

- The suite is flaky on a loaded machine — `--maxWorkers=3`. Two full runs this session, 0 failures
  both times (6328 then 6330; the +2 is this session's new schema tests).
- The `AbortError` / happy-dom teardown spew at the end of a full run is **pre-existing noise**, not
  a failure. Read the `Test Files` line.
- `.scratch/` is gitignored and is the only copy. New: `mutate-voice-description-fence.sh`,
  `card9-voice-description.png`, `dev-3014.log`.
- The Next.js dev-overlay "N" sits bottom-left of every dev screenshot. Not a UI bug.
