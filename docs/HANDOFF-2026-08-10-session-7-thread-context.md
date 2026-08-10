# Handoff — session 7: what the model actually sees (2026-08-10)

**Lane:** `lane/in-thread-chat` · worktree `~/virtuna-in-thread-chat`
**Brief:** `docs/CONTEXT-AUDIT-2026-08-10.md` · **Spec:** `docs/superpowers/specs/2026-08-10-thread-context-design.md`
**Outcome:** built, gated, live-measured. **Not merged, not deployed** (Vercel disconnected).

Everything ships dark except the two assembler changes in §2, which are unconditional and
measured byte-identical on today's traffic.

---

## 1. 🔴 Read this first — three findings that outrank the brief

### 1.1 The `voice` role reads a column that does not exist

`writing_voice_sample` is on `ProfileRow`, read by `formatVoice()`, and protected by a comment
block in `assembler.ts` about cap-drop priority. **It is not in the database.**

- Migration `20260619000100_creator_profile_writing_voice_sample.sql` exists in the repo and is
  **absent from `supabase_migrations.schema_migrations`**. Confirmed against `information_schema`:
  no `%voice%` / `%writing%` column exists in any table in `public`.
- Independently, `creatorProfilePatchSchema` is a plain `z.object`, which strips unknown keys — so
  the profile interview's Card 9 sample (`profile-interview-store.ts:185`) is **discarded by zod**
  before the upsert is even built.

Two silent failures, either of which alone would be enough. The only voice that ever reaches a
prompt is `applyCreatorPersona()` backfilling from `audiences.creator_persona.writing_style_sample`
— **6 of 13 audiences** in prod, 214–224 chars.

⚠️ **Do not widen the zod schema on its own.** Sending a column that does not exist to the upsert
would break profile saving for every user. Order is: apply the migration → widen zod → verify.
That is a write to the shared prod DB (`supabase db push` is unsafe here — ledger drift), so it
needs an owner decision. **Not done this session.**

`CONTEXT-AUDIT-2026-08-10.md`'s role table showing `voice ✅` for ideas/hooks/script/remix is
wrong in the general case. This document supersedes it.

### 1.2 Voice was already being evicted on exactly the runs where it exists

Measured through the real `assembleBundle` with the real prod profile shape:

| case | before | after |
|---|---|---|
| hooks · corpus 2800, no overrides | 3818 / 4000 ✓ | fits ✓ |
| hooks · corpus 2800 + calibrated overrides | 3602 / 4000 ⚠ **voice, wins, flops, platform all dropped** | fits, all kept ✓ |
| hooks · worst (+anchor +5 cards) | 4000 / 4000 ⚠ same | fits ✓ |

A calibrated audience is *simultaneously* the only thing that creates a voice (1.1) and the thing
whose `overrides` evict it. The loop pops whole roles, so it shed 675 chars to save 256.

Latent only because grounding is off — and grounding is in the recommended flag-flip set.

The `SKILL_CHAR_BUDGET` comment in `grounding/prompt.ts` claiming *"the corpus still cannot evict a
creator's profile roles"* was wrong: it read 3.6k as evidence of no eviction, when 3.6k **is** the
post-eviction length. Never derive headroom from an output length.

### 1.3 The prefix-cache argument does not hold — I was wrong and it is now documented as wrong

The digest's placement above the `---` was chosen for a prefix-cache reason. Measured
(`.scratch/probe-prefix-cache.ts`), **it buys nothing**:

- The cache is real: **8,960 cached tokens** on the live hooks system prompt.
- `8,960 = 35 × 256` exactly → hits are quantised to **256-token blocks**.
- The shipped digest is 700 chars ≈ **175 tokens — smaller than one block.** It cannot move the
  number wherever it sits. The arithmetic settles it independently of any experiment.

Two probe designs failed before that was clear, and both failure modes are recorded in the
assembler doc: sharing the system prompt between arms measures **call order** (one arm read 8,960
purely for going second); giving each arm its own prefix measures nothing, because a fresh prefix
does not become cacheable within a 45s window.

**The placement stands on a different, honest reason**: the digest is grounding, so it groups with
the profile section above the separator, which is also how the shed order treats it.

### 1.4 The creator profile is essentially unfilled — which deflates both open items

Measured at the end of the session, while checking whether `goals` was still captured at all:

```
profiles                 18
saw the interview         3
completed onboarding     10
has niche / goal / style  2
has past_wins             0
has pain_points           0
```

Nothing was removed — `GoalStagePicker` is card 2 of the interview, still wired, still serialized,
still in the zod schema and the settings form. **The surface works; almost nobody reaches it.**

Three consequences, all of which change what is worth building:

1. **Adding `goals` to `MODE_ROLES.chat` would be a no-op for 16 of 18 users.** The role formatter
   returns `null` when `primary_goal` is absent and the role is silently omitted. It would be a
   live change to the default chat path (`runChatPipeline`, unflagged) buying nothing measurable.
2. **`wins`/`flops` are not "low information", they are EMPTY** — 0 rows, ever. That settles the
   question without needing the honesty argument.
3. **The voice migration (§1.1) is latent, not urgent.** Card 9 is the ninth card of an interview
   three people have opened, so realistically nobody has typed a voice sample and lost it. It is
   still a real bug and still cheap to fix; there is no user cost accruing today. *An earlier draft
   of this handoff called it "active data loss" — that overstated it.*

**The observation worth carrying forward:** the audience path has BETTER coverage than the profile
path — 6 of 13 audiences carry an auto-derived `creator_persona` voice, against 2 of 18 profiles
carrying anything at all. Data derived at calibration beats data we ask people to type, by a wide
margin. So "the co-pilot doesn't know enough about me" is probably not solved by adding roles to
the bundle; the bundle has nothing to put in them. That is a product question, not a
prompt-assembly one, and it is the owner's.

---

## 2. What was built

| # | Change | Flag |
|---|---|---|
| 1 | **Shed order fixed** — corpus → conversation → profile tail → voice. Fenced sections now yield *before* any profile role. | none (unconditional) |
| 2 | **`BUNDLE_CHAR_CAP` 4000 → 6000** | none (unconditional) |
| 3 | **The conversation digest** — the creator's own turns + the cards on screen, reaching the generators as data | `ENGINE_GEN_CONVERSATION` |
| 4 | **The repeat-ask pin** — a re-ask dispatches instead of being narrated | `ENGINE_REPEAT_ASK_PIN` |

**Why the cap moved too, and not just the order.** At 4000 the shed-order fix saves voice by
shedding the *corpus* instead — so grounding dies silently and every role assertion stays green.
Both tiers have to fit. 6000 is 12.9%–23.7% of the system prompts (46,485 hooks / 35,664 ideas /
33,953 script / 25,268 chat), so the "live bundle << system prompt" rule still holds comfortably.

**The digest is DATA, not a model-written argument.** Session 6 measured the alternative failing:
the `cards` slot the model was meant to fill earns nothing, because it never reaches for it. The
loop builds the digest from turns it is already replaying and injects it on `SkillRunContext`.

**Assistant prose is excluded on purpose.** Replaying it into a generator would import the exact
defect `chat-prior-turns.ts` exists to fix.

**`cardsOnScreen` and a `cards` rewrite pack are mutually exclusive** — "rewrite each of these" and
"do not reproduce these" cannot both be true of one list. Enforced in **two** places (the loop's
`includeCards`, and the assembler), so neither a caller slip nor a future call site can produce it.

---

## 3. What was measured live

### 3.1 The digest changes the output — 2 arms × 2 runs, temp-0, real hooks pipeline

A thread stating three checkable constraints ("under 12 words", "never the 5am angle", "no
questions"), against an ask carrying none of them (`"hooks about morning focus routines"`):

| run | A · control (topic only) | B · digest |
|---|---|---|
| 1 | **4 violations** (3 over-length, 1 question) | **1** (one 13-word hook) |
| 2 | **5 violations** (4 over-length, 1 question) | **0** |

Total across 10 hooks per arm: **9 violations → 1**. Consistent in direction and size.

### 3.2 The repeat-ask defect reproduced, and the pin fixes it

Same thread, same ask, real agent loop, stub skill (free, unambiguous read):

**A · control — ran NO tool**, then wrote:

> The hooks on screen are too generic for your niche… **Here are 5 hooks tailored to comedy
> storytelling about morning focus:** 1. "I tried to wake up at 5am for a week…" 2. "POV: You're
> trying to have a 'productive' morning…" …

That is worse than the session-6 write-up recorded. It does not merely *claim* hooks — it
**delivers the paid artefact in prose**: five finished hooks, no scoring, no cards, nothing
saveable, nothing billed.

**B · pinned — ran the tool**, answer: *"Five hooks are on screen."*

### 3.3 Threshold tuned, not guessed

`.scratch/probe-repeat-ask.ts`, over 151 reachable same-skill pairs from the app's own `messages`:
genuine re-asks bottom out at **0.75**, same-skill cross pairs top out at **0.67** → threshold
**0.7**, the midpoint of the clear-air band.

The probe's first version reported "no clear air" because it compared hooks-vs-ideas pairs the
detector can never reach. The same-skill filter is now in the probe with a note.

Rounding is deliberate: **a miss costs nothing** (the turn behaves as today) while **a false pin
spends a credit**, so the threshold rounds up.

---

## 4. Gates

`tsc` clean · prod build clean · **5,855 passed / 0 failed** on a full run.

🟡 An **earlier** full run failed 1 test — `omni-analysis-emotion-arc.test.ts`, "Test 1: empty
emotion_arc on a video → ONE bounded retry". It passes in isolation and on re-run, and shares no
imports with anything touched this session. Recorded rather than dismissed: this is a **new**
flaky file, alongside the four composer ones the session-6 handoff logged. "Green on the retry" is
how an order-dependent bug hides.

---

## 5. What was NOT verified

- **Production.** Everything ran against a local dev environment and the shared prod database.
  Vercel is disconnected; nothing is deployed.
- **The digest through the real route.** The A/B called `runHooksPipeline` directly. The
  loop→ctx→pipeline seam is unit-tested (by reference, both flag states) but the full
  `/api/tools/chat` path with `ENGINE_GEN_CONVERSATION=true` was **not** walked signed-in.
- **The pin through the real route.** Same: `detectRepeatAsk` → `forceSkill` is wired and
  typechecked, and the loop half was exercised directly, but no signed-in browser walk was done.
- **The pin's billing path.** Reused unchanged from B1's `forceSkill`, and a pinned run is gated
  and billed exactly like a chip-pinned one — asserted by the existing tests, not re-measured live.
- **The digest under a calibrated audience.** The A/B used `audience: null`. The interaction
  between the digest and the audience `overrides` block is untested live.
- **Whether 6 turns is the right window**, and whether 700 chars is the right budget. Both are
  reasoned, neither is tuned against outcomes.
- **The repeat-ask pin's false-positive rate on real traffic.** Tuned against 151 historical pairs;
  no live sample.

---

## 6. Still open

**Owner decisions**

1. **The flag flip**, unchanged from session 6, plus the two new flags
   (`ENGINE_GEN_CONVERSATION`, `ENGINE_REPEAT_ASK_PIN`).
2. **Why does nobody reach the profile interview?** (§1.4) — 3 of 18. This is the question
   underneath both of the items below, and it is a product call, not an engineering one.
3. F-6 multiplier positioning; the `composer.tsx` split. Both carried over.

**Parked — deliberately, with the reason**

- **`goals`/`wins`/`flops` for the chat agent.** ~~Nearly free to add.~~ **Not worth doing.**
  `goals` is null for 16 of 18 profiles so the role would be silently omitted; `wins`/`flops` have
  0 rows ever. The voice half of audit item 3 IS decided (Maven, one product voice —
  `MODE_ROLES.chat` unchanged). See §1.4.
- **The voice migration** (§1.1). Still a real bug, still cheap, **no longer urgent** — see §1.4.
  When it is done, the order is migration → ledger row → zod → verify, and never zod first.
  Verified this session: profile loads use `select("*")`, so no query changes are needed, and a
  1000-char sample (the UI's cap) fits the new bundle cap with the corpus and conversation intact
  (5,609 / 6,000).

**Carried over from the audit brief**
- **The typed rewrite door still does not work** (audit item 4). Untouched this session.
- `develop`/`refine`/`chat` still have no quality lever; `remix` is unguarded by the judge.

---

## 7. Traps learned this session

- **A mutation test found a hole in my own test before the code shipped.** The cap-raise test
  asserted the profile roles survived but not that the *corpus* did — so reverting the cap to 4000
  left it green, because the shed-order fix saves voice by killing grounding instead. If a change
  has two halves, assert both halves, or the test only covers one.
- **A hardcoded fixture sized against a constant is a landmine.** `assembler.test.ts`'s
  `BIG_ASK = "y".repeat(2700)` was `CAP - 1300` against the old 4000. Raising the cap made it stop
  overflowing, so nothing was shed and three tests failed on `not.toContain("Past wins")` — a
  fixture that had silently become a no-op. Re-expressed as `BUNDLE_CHAR_CAP - 1300`.
- **DashScope's implicit cache writes with a delay.** Back-to-back calls report `cached_tokens: 0`,
  which reads exactly like "caching is off". It is not — a later call showed 8,960.
- **Two arms sharing 99% of their tokens measure call order, not the thing you varied.**
- **Cache hits are quantised** (256-token blocks here), so anything smaller than a block is
  unmeasurable by construction. Check the arithmetic before designing the experiment.
- **The pre-router's one harmful false alarm is *shaped like* the defect you want to catch.**
  "Yes, run the simulate tool on that hook" guesses `hooks` and necessarily sits in a thread with a
  prior hooks run. Any trigger keyed on "guessed it + ran it before" fires on it. Key on the defect
  itself, not on a proxy.
- **The memory store still cannot be written from this worktree** — the path guard rejects
  `~/.claude/projects/...` because it resolves to a different git root. These docs are the record.

---

## 8. Harnesses (`.scratch/`, gitignored)

```bash
# free, no network
node node_modules/tsx/dist/cli.mjs .scratch/measure-bundle-headroom.ts   # §1.2 eviction
node node_modules/tsx/dist/cli.mjs .scratch/measure-system-prompts.ts    # cap vs system prompt
node node_modules/tsx/dist/cli.mjs .scratch/probe-repeat-ask.ts          # §3.3 threshold tuning
node node_modules/tsx/dist/cli.mjs .scratch/probe-pre-router-real.ts     # session 6

# paid (flash, cheap) — run FOREGROUND with the sandbox off
node node_modules/tsx/dist/cli.mjs .scratch/probe-conversation.ts        # §3.1 the A/B
node node_modules/tsx/dist/cli.mjs .scratch/probe-repeat-ask-live.ts     # §3.2 defect + pin
node node_modules/tsx/dist/cli.mjs .scratch/probe-prefix-cache.ts        # §1.3 (settled; ~90s)
```

## 9. Commits

```
75b785db  docs(chat): design spec — thread context for the generators
0ff17677  feat(kc): shed the corpus before the creator; cap 4000 -> 6000
d81ce44e  feat(chat): the generators finally see the conversation (flagged OFF)
7408b09b  feat(chat): pin a repeat ask so the co-pilot stops claiming work it didn't do
```
