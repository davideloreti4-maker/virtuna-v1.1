# What the model actually knows — thread context + user context (2026-08-10)

> ## ▶ UPDATE 2026-08-12 (session 11) — read this before the body
>
> The body below is still accurate on **what is assembled**. Three things measured since change what
> it means, and one is a straight correction.
>
> **1. 🔴 The `voice` role is DEAD for the profile — the column does not exist.** The table in §2
> lists `voice` as active for ideas/hooks/script/remix, sourced from
> `creator_profiles.writing_voice_sample`. **That column is not in the database** (verified directly
> against prod: 36 columns, no `writing_voice_sample`). `profile-role-map.ts:154` reads `undefined`
> and returns null every time, so the role is silently absent. The ONLY way voice ever reaches a
> generator is `apply-creator-persona.ts` backfilling it from a **calibrated audience's**
> `creator_persona.writing_style_sample`. **With a General audience — or none — no generator gets any
> voice instruction at all.** ⚠️ `profile-interview-store.ts:185` still tries to SAVE that field, so
> widening the profile schema before the migration exists breaks profile saving.
>
> **2. 🔴 The dispatch failure is NOT a context problem — this is the session's biggest finding.**
> Item 2 of §3 below asks to fix "claimed hooks, ran nothing". Measured across 183 + 76 + 32
> generations: an ask whose SUBJECT is a product or format dispatches **17–23%**, against ~100% for a
> scenario subject. The model has the full bundle, the full 20-turn replay, the audience, the
> corpus — **and refuses anyway**. Four prompt rewrites failed to move it. What fixed it was adding
> a **count** to the ask (`"give me 5 hooks"` vs `"give me hooks"`): pushbacks **9 → 0** offline, and
> **0/6 → 6/6 on the live route**. So the behaviour here is driven far more by the *shape of the
> request* than by everything carefully assembled around it. Worth holding onto before any future
> "the model needs more context" conclusion. See `docs/HANDOFF-2026-08-12-session-11-guess-pin.md`.
>
> **3. The corpus role bleeds SURFACE, not structure.** §2 lists `corpus` (the retrieved proven
> examples) as a bundle role. Measured on a comedy/storytelling profile: **52%** of cards produced
> for a budgeting app mentioned learning a TikTok dance — on the path where the model *chose* to run,
> unpinned. Scenario subjects: **0%**. The grounding cache returns the right topic; the generator is
> copying the examples' surface rather than their structure.
>
> **⚠️ Findings 1 and 3 may be the same defect.** If the voice role is empty for every uncalibrated
> run, the corpus examples are the strongest style signal left in the bundle — so the model anchors
> style on them because there is nothing else to anchor it to. Not tested. It is cheap to test
> (backfill a voice into `profileRow` and re-measure the bleed) and it is the next thing to run.
>
> **4. First mid-thread observation.** Everything in this lane is a thread's FIRST turn. An
> accidental mid-thread run showed the model declining differently there: it critiques its **own
> previous batch** (*"the previous batch was too 'explainer'"*) rather than pushing back on the
> subject. n=5, still not properly measured.
>
> **Live-probe recipe note:** a live run against `/api/tools/chat` reuses the account's existing open
> thread, so N POSTs are ONE conversation. Send `maven_active_thread=__new__` for genuine first
> turns. A tally that looks right is not proof — read the replies.

Written as the brief for the next session. Two questions were asked:

1. do we maintain thread context, i.e. does Qwen have continuous memory of this conversation?
2. what does Qwen know about the creator when it processes a request (selected audience, voice…)?

**Short answers: (1) yes for the chat agent, no for the generators. (2) a lot — but a different
"a lot" depending on which of the two is running, and the chat agent is the one missing voice.**

Everything below was read out of the code and confirmed against a live run.

---

## 1. Thread context

### The chat agent DOES have it

`/api/tools/chat` loads prior turns (`openChatPriorTurns`, `MAX_PRIOR_TURNS = 20`) and replays
them into the model as **real role messages** — not a summary. A turn that ran a skill is replayed
as a genuine `assistant`→tool-call + `tool` result pair, and the tool result carries
`cards_on_screen`: the actual card lines the creator can see, plus a note saying "these are
ALREADY on screen: never re-list them, and never present them as something you are producing now."

So the agent can see roughly the last 20 turns and the text of the cards in them.

**Live proof that this context is strong — and that it can backfire.** In a thread that already
contained a hooks pack about "morning focus", the ask *"write me 5 hooks about morning focus"*
produced:

```
0.0s  meta
0.0s  predispatch {skill: hooks}
3.5s  done            ← no dispatch, no stage, no cards
```

with the answer *"Here are 5 hooks for 'morning focus' tailored to your comedy storytelling
niche…"*. **It ran nothing and claimed hooks.** The identical ask on a fresh topic
("sourdough baking") dispatched normally and produced 5 real cards in 19.7s.

The context made the model treat a repeat ask as already satisfied — and then narrate as if it
had delivered. That is a live honesty defect and it is caused by context, not by a missing one.

### The generators DO NOT have it

This is the real gap, and it is architectural. A generator pipeline
(`runHooksPipeline` / `runIdeasPipeline` / `runScriptPipeline`) is called with:

```
ask        ← the `topic` STRING the agent wrote into the tool call
anchor?    ← a chain/CTA line
cards?     ← the Stage B rewrite pack (new)
platform, profileRow, audience
```

There is **no conversation** in that list. `assembleBundle` never receives prior turns for a
generation mode. So everything the creator said over the last 20 turns reaches the actual
generating model **only insofar as the agent compressed it into one `topic` string**.

That is why "given everything I've told you, what angle should I lead with?" works (chat agent)
while the hooks it then generates can feel like they forgot the conversation (generator).

**This is the highest-value thing to fix, and it is a small change**: the agent already writes
`topic`; giving the generators a fenced "what the creator has said this session" section is the
same shape as the Stage B `cards` fence that was just built and measured.

---

## 2. What the model knows about the creator

Two different bundles, assembled by the same `assembleBundle` but with **different role sets**
(`MODE_ROLES`, `src/lib/kc/assembler.ts:139`):

| role | what it is | chat agent | ideas | hooks | script | remix |
|---|---|---|---|---|---|---|
| `niche` | `niche_primary` + `niche_sub` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `audience` | `target_audience` JSON (age, gender skew, geo, language) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `platform` | per-request platform (wins over the profile default) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `voice` | `writing_voice_sample`, fenced, "match rhythm/register/tone, STYLE only" | ❌ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| `goals` | `primary_goal` + `creator_stage` | ❌ | ✅ | ❌ | ❌ | ❌ |
| `wins` | `past_wins` (creator-reported) | ❌ | ✅ | ✅ | ✅ | ✅ |
| `flops` | `past_flops` | ❌ | ✅ | ✅ | ✅ | ✅ |

**The chat agent gets niche + audience + platform and nothing else.** It has no voice sample, no
goals, no wins/flops. So the co-pilot that talks to the creator all day knows the least about them
— worth deciding on deliberately, since chat is now the front door.

⚠️ **The `voice` row above is marked ⚠️, not ✅, as of 2026-08-12** — `creator_profiles.
writing_voice_sample` does not exist in the database, so that role is empty for every generator
unless a **calibrated audience** backfills it (`apply-creator-persona.ts`). On a General audience no
generator receives any voice instruction. See the update block at the top of this file.

### The selected audience (the SIM) — three separate contributions

Only for a **calibrated, non-general** audience (`hooks-runner.ts:561-586`,
`apply-creator-persona.ts`):

1. **Steer line** — `buildAudienceGroundingLine(audience, platform, profileRow)` becomes
   `overrides`: *"Generate for this audience — …"*.
2. **Creator steer** — from the audience's `creator_persona`: `content_description` + `context`
   folded in as *"Creator — …"*.
3. **Voice fallback** — `creator_persona.writing_style_sample` fills the voice role **only when
   the profile has no manual `writing_voice_sample`**. A manual profile voice always wins.

A **General** audience (or none) contributes none of these — the run falls back to profile-based
grounding and default weights.

### Also in the bundle, per request

- `corpus` — the retrieved proven examples (grounding), when the grounding flags are on
- `anchor` — the chained hook/idea, under a per-mode contract label
- `cards` — the Stage B rewrite pack (new this session)
- everything creator-supplied is wrapped in `<<<USER_CONTENT>>>` fences with sentinel stripping
- the whole bundle is capped (`BUNDLE_CHAR_CAP`) and **sheds roles from the tail first**, which is
  why `voice` is deliberately not last in any mode's role list

---

## 3. What this suggests for next session

Ordered by value, from what was measured rather than guessed:

1. **Give the generators the conversation.** One fenced section, same shape as the `cards` fence.
   Today the entire thread reaches them through one `topic` string.
2. **Fix the "claimed hooks, ran nothing" case.** Context makes the agent treat a repeat ask as
   satisfied and then narrate delivery. Either it should re-run, or it should say "those are the
   ones above" — never "here are 5 hooks" with no cards. This is the honesty spine, and it is
   reproducible: ask for the same thing twice in a thread.
3. **Decide what the chat agent should know.** It is the front door and currently has the thinnest
   creator picture of any mode — notably no voice.
4. **The typed rewrite door does not work** (measured this session, see the Stage B handoff): the
   model answers "rewrite these" in prose instead of calling a tool, with or without the Stage B
   `cards` slot. The chip door works because the client supplies the pack. The fix is likely to
   treat a typed rewrite the way a chip is treated — detect it and pin the skill + pack.

## Files worth opening first

- `src/lib/kc/assembler.ts` — `MODE_ROLES` (:139), the fences, the cap-drop
- `src/lib/kc/profile-role-map.ts` — every profile field that can reach a prompt
- `src/lib/threads/chat-prior-turns.ts` — how the thread is replayed (`MAX_PRIOR_TURNS`)
- `src/lib/tools/chat-agent-loop.ts:545-575` — the tool-result replay + `cards_on_screen`
- `src/lib/audience/apply-creator-persona.ts` — the audience→voice/steer wiring
- `src/app/api/tools/chat/route.ts:479` — where the chat bundle is built (`mode: "chat"`)
