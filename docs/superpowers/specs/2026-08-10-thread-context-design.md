# Design — what the model actually sees: thread context for the generators (2026-08-10)

**Lane:** `lane/in-thread-chat` · worktree `~/virtuna-in-thread-chat`
**Brief:** `docs/CONTEXT-AUDIT-2026-08-10.md` · **Prior session:** `docs/HANDOFF-2026-08-10-session-6-stage-b-merged.md`

Everything here ships behind flags that are **OFF by default**, except the two assembler
changes in §3, which are unconditional and measured byte-identical on today's traffic.

---

## 1. Three findings measured before any decision was taken

All three are free to reproduce — no LLM calls. Harnesses in `.scratch/` (§9).

### 1.1 🔴 The `voice` role reads a column that does not exist

`writing_voice_sample` is declared on `ProfileRow`, read by `formatVoice()`, and protected by a
whole comment block in `assembler.ts` about voice's cap-drop priority. It is **not in the
database.**

- Migration `supabase/migrations/20260619000100_creator_profile_writing_voice_sample.sql` exists
  in the repo and is **absent from `supabase_migrations.schema_migrations`** — never applied.
  Confirmed by querying `information_schema`: no column named `%voice%` or `%writing%` exists in
  ANY table in the `public` schema.
- Independently, `creatorProfilePatchSchema` (`src/lib/schemas/creator-profile.ts`) is a plain
  `z.object`, which strips unknown keys. The profile interview's Card 9 serialises
  `writing_voice_sample` (`profile-interview-store.ts:185`) and **zod discards it** before the
  upsert is built.

Two independent, silent failures. A manual profile voice is unreachable by both routes.

**Consequence:** the only voice that ever reaches a prompt is `applyCreatorPersona()` backfilling
from `audiences.creator_persona.writing_style_sample`. Measured in prod: **6 of 13 audiences**
carry one, 214–224 chars. `CONTEXT-AUDIT-2026-08-10.md`'s role table showing `voice ✅` for
ideas/hooks/script/remix is therefore wrong in the general case — it is ✅ only under a
calibrated audience.

⚠️ **Do not "fix" this by widening the zod schema alone.** Adding `writing_voice_sample` to
`creatorProfilePatchSchema` while the column is missing would send an unknown column to the
upsert and **break profile saving for every user**. The only safe order is: apply the migration,
then widen zod, then verify. That is a write to the shared prod database and is explicitly out of
scope here — see §7.

### 1.2 🔴 Voice is already evicted on exactly the runs where it exists

Measured through the real `assembleBundle` with the real prod profile shape (`comedy >
storytelling`, a 4-field `target_audience`) and a 224-char voice sample:

| case | chars | outcome |
|---|---|---|
| hooks · no corpus, no overrides | 955 / 4000 | ✓ all roles kept |
| hooks · calibrated overrides, no corpus | 1393 / 4000 | ✓ all roles kept |
| hooks · corpus 2800, no overrides | 3818 / 4000 | ✓ all roles kept |
| hooks · corpus 2800 + calibrated overrides | 3602 / 4000 | ⚠ voice, wins, flops, platform **all dropped** |
| hooks · worst (+anchor +5 cards) | 4000 / 4000 | ⚠ same |
| chat · agent bundle | 327 / 4000 | — |

The profile section of a grounded, calibrated hooks bundle is literally two lines:

```
### Creator Profile
Niche: comedy > storytelling
Target audience: age 18-24, balanced-skewed, United States, English
```

A calibrated audience is **simultaneously** the only thing that creates a voice (1.1) and the
thing whose `overrides` block evicts it. The cap-drop pops whole roles, so it sheds 675 chars to
save 256.

Grounding is off today, so this is latent — but it is in the recommended flag-flip set
(`GROUNDING_HOOKS_ADAPT`, `GROUNDING_HOOKS_SURFACE`) in the session-6 handoff §6.

The comment on `SKILL_CHAR_BUDGET` (`src/lib/grounding/prompt.ts`) claiming *"the assembled bundle
lands ~3.6k against BUNDLE_CHAR_CAP (4000), so the corpus still cannot evict a creator's profile
roles"* is **measurably wrong**: it read 3.6k as evidence of no eviction, when 3.6k *is* the
post-eviction length.

### 1.3 The cap is far too small relative to the tier it is protecting

The assembler's own stated rule is *"live bundle << system prompt (the warm cache must be the
dominant tier)"*. Measured:

| mode | system prompt | cap 4000 | at cap 6000 |
|---|---|---|---|
| hooks | 46,485 chars | 8.6% | 12.9% |
| ideas | 35,664 chars | 11.2% | 16.8% |
| script | 33,953 chars | 11.8% | 17.7% |
| chat | 25,268 chars | 15.8% | 23.7% |

6,000 still satisfies the rule comfortably. With `qwen3.7-flash` at $0.03/M input tokens
(≤32K context), the cap is not a cost constraint at either value.

---

## 2. Owner decisions taken

| # | Decision | Chosen |
|---|---|---|
| 1 | What the generators receive as conversation | **The creator's own turns + card lines**, as a deterministic digest supplied as DATA by the loop |
| 2 | Shed order under the cap | **Fix the drop order in the assembler** (revised — see §3) |
| 3 | Should the co-pilot sound like the creator | **Maven — one product voice.** `MODE_ROLES.chat` unchanged |
| 4 | The "claimed hooks, ran nothing" fix | **Pin the run up front** (revised trigger — see §5) |

### 2.1 Why the digest is data, not a model-written argument

Session 6 measured this exact thing and it failed: the `cards` slot was added to the generator
tool schemas so a typed *"rewrite these"* could carry the pack, and **the model never reaches for
it** — a typed rewrite produced no dispatch at all, with the flag on or off. B2's measured
7%→75% improvement came entirely from the chip path, where the CLIENT supplies the pack as data.

Ground rule of this lane: **structure beats prompt text.** The digest is therefore assembled by
the loop from `priorTurns` and injected, never requested from the model.

### 2.2 Why assistant prose is excluded from the digest

`chat-prior-turns.ts`'s header documents the defect this whole subsystem exists to fix: the model
saw its own sentence *"Five hooks are on screen."* with no visible cause, and, asked again,
"did the only thing that transcript supports: reproduced the sentence and called nothing."

Feeding assistant prose into a **generator** bundle would import the same failure into a second
place. The creator's own words are the durable signal — they carry the constraints ("under 30s",
"not the 5am angle", "handheld, no b-roll"). The assistant's concrete contribution is its *cards*,
and those ride as card lines, which are data.

---

## 3. Assembler changes (unconditional)

### 3.1 `BUNDLE_CHAR_CAP` 4000 → 6000

Worst realistic bundle measures ~5,585 chars (corpus 2800 + overrides ~440 + anchor ~55 + 5 cards
~370 + full profile ~720 + conversation ~700 + header/labels ~500). At 6,000 nothing sheds on real
traffic.

### 3.2 Shed fenced sections before profile roles

Current behaviour: step 4a pops profile roles from the tail until the bundle fits; fenced sections
are only ever touched in the 4b overflow path. That is why corpus evicts voice.

New order — **first shed = lowest priority**:

```
shed first  →  corpus         (2800 on hooks; the redundant tier — prompt.ts's own words:
                               "six proven sources still teach with four")
               conversation   (fixed budget, §4.3)
               profile tail:  platform → flops → wins
               voice
never       →  niche, audience, ask, anchor, cards
```

**Revised from the owner's selected option.** The option as presented shed `conversation → corpus →
profile tail`. Measurement changed the recommendation: the conversation holds the creator's
*explicit stated constraints*, and violating a stated instruction is a worse failure than having
one fewer proven example. With conversation shedding first, the feature would be dead precisely
under the grounding configuration it is about to be deployed into. Raised with the owner before
adoption, not slid in.

This is the fix `prompt.ts` already names as needed: *"The real fix is in the assembler, not here:
when the bundle overflows it should trim the CORPUS before it drops a creator's voice or wins."*

### 3.3 Both are byte-identical on today's traffic

Nothing currently overflows 4,000 without grounding (max measured 1,393). To be **proved by a
test** over realistic bundles, not asserted.

---

## 4. The conversation digest

### 4.1 Placement — decided by prefix caching

DashScope runs an implicit context cache for Qwen; the hit is on the longest common **token
prefix** of the request. Today the cacheable prefix runs `[system prompt][bundle header][profile
section]` and dies at `Creator ask`, which is volatile every turn.

- Digest placed **after** the ask → never cacheable; the prefix is already dead.
- Digest placed **before** the ask, above the `---` → the digest is *append-only* while a thread
  is short (turn N+1's digest contains turn N's as a literal prefix), so the cached prefix extends
  through it. Once the window slides it degrades to exactly today's extent — **never worse.**

So the digest is emitted **between the profile section and the `---`**. Precedent for a
`<<<USER_CONTENT>>>` fence above the `---` already exists: the `voice` role emits one.

The append-only property holds for the first `MAX_DIGEST_TURNS` (= 6, §4.2) user turns of a
thread, then the window slides and the block shifts. Bounded win, claimed as bounded. **To be
confirmed by reading
`usage.prompt_tokens_details.cached_tokens` on a live run**, not asserted.

Not touched this session, but worth recording: the agent loop's 20-turn replay is append-only
across turns and is already the dominant cached prefix — until `.slice(-MAX_PRIOR_TURNS)` slides
at turn 20.

### 4.2 Content

- Last **6** `role:"user"` turns from `priorTurns`, oldest first, one numbered line each.
- The current ask is excluded — it is already `topic`/`ask`. (The route persists the user turn
  *after* loading `hydratedMessages`, so it is not in `priorTurns` anyway.)
- Card lines already on screen, as a **separate labelled sub-block**, and **only when the run
  carries no `cards` rewrite pack.** The `cards` fence carries an imperative contract ("deliver a
  sharper version of EACH numbered item"); the digest's card lines carry the opposite ("already on
  screen — do not repeat these"). Mixing them would corrupt the rewrite path measured at 7%→75%.
- Fenced through the existing `fenceUserContent` helper, so sentinel-stripping is inherited.

### 4.3 Budget

Fixed pre-assembly budget, in the shape of `CORPUS_CHAR_BUDGET`: the section is built to fit
before it ever reaches the cap, so it cannot grow unbounded and force a shed.

---

## 5. The repeat-ask pin

### 5.1 The defect

Measured session 6, reproducible: in a thread already holding a hooks pack about "morning focus",
the ask *"write me 5 hooks about morning focus"* produced `meta → predispatch → done` in 3.5s —
**no dispatch, no cards** — with the answer *"Here are 5 hooks for 'morning focus'…"*. The
identical ask on a fresh topic dispatched normally.

### 5.2 Trigger — revised after self-review

The first design pinned on `pre-router guesses S` + `thread holds a prior run of S`. Re-running the
free 82-ask probe showed that is **wrong, and wrong in the worst direction**. The pre-router's one
measured harmful case is:

```
FALSE ALARM  want null  got hooks
  "Yes, run the simulate tool on that hook — I want the reaction card."
```

It says *"that hook"*, so it necessarily occurs in a thread that already has a hooks run. The
proposed narrowing would make the single measured false alarm **more** likely to fire, converting
it into a forced, billed, wrong paid run.

**All three conditions must hold:**

1. the pre-router guesses S (its `QUESTION_OPENER` guard already vetoes "which of these is
   strongest"), **and**
2. the thread holds a prior run of S (`priorTurns[].toolRuns[].name`), **and**
3. **the current ask is a near-duplicate of that run's own topic** (`priorTurns[].toolRuns[].topic`
   — the creator's own ask from that turn).

Condition 3 *is* the defect ("ask for the same thing twice in one thread"), not a proxy for it.
`"…run the simulate tool on that hook…"` has almost no token overlap with `"write me 5 hooks about
morning focus"`, so the measured false alarm dies on it.

**"Near-duplicate" is defined mechanically**, so it is testable without a model: lowercase, strip
punctuation, drop a small stop-word list, then compare the two token *sets* by Jaccard similarity
(`|A ∩ B| / |A ∪ B|`). Pin at **≥ 0.6**. Rationale for the shape rather than the exact number:
set-overlap ignores word order, so the paraphrases this must catch — *"give me 5 more hooks on
morning focus"* vs *"write me 5 hooks about morning focus"* — score high, while the false-alarm
pair scores near zero. The threshold is a starting value to be **tuned against the same 82 real
asks** the pre-router was tuned on, then recorded here.

### 5.3 Mechanism

Reuse B1's existing path — `pinnedTool && round === 1` in `chat-agent-loop.ts`. Round 1 only; no
extra rounds, no aborted stream, no added latency. The gate still admits, prices and bills exactly
as it does for a chip-pinned run, and can still refuse with a credit wall.

A first ask keeps the "too vague → push back ONCE" behaviour, because condition 2 fails.

---

## 6. Flags

| flag | covers | default |
|---|---|---|
| `ENGINE_GEN_CONVERSATION` | the digest (§4) | OFF |
| `ENGINE_REPEAT_ASK_PIN` | the pin (§5) | OFF |

Separate so they can be measured independently. Both server-side — neither needs `NEXT_PUBLIC_`,
so neither needs a redeploy to reach a client.

§3 (cap + shed order) is unconditional; see §3.3.

---

## 7. Non-goals, stated explicitly

1. **Applying the voice migration.** Requires a write to the shared prod database. `supabase db
   push` is unsafe in this project (migration-ledger drift — single migrations via the SQL editor
   only). Owner ruling required; it also needs its own verification pass. **Documented in §1.1, not
   acted on.**
2. **Widening `creatorProfilePatchSchema`.** Actively dangerous before the migration lands (§1.1).
3. **`goals`/`wins`/`flops` for the chat agent.** The owner ruled on the *voice* half of audit item
   3. This half is still open. The chat bundle has ~3,673 free chars so it is nearly free to add,
   but it changes behaviour and was not asked for. **Open item.**
4. **The typed-rewrite door** (audit item 4). Still broken, still out of scope.
5. **Correcting `CONTEXT-AUDIT-2026-08-10.md`'s role table.** Superseded by §1.1 of this document.

---

## 8. Verification standard

The lane's standard, all of it, before anything is claimed to work:

1. `tsc` — vitest does not typecheck.
2. Full suite (5,807 tests as of session 6).
3. Prod build — a `src/lib/surfaces/*` import into an API route breaks it while tsc stays clean.
4. **A live measurement:**
   - A/B on a thread with stated constraints ("under 30s", "not the 5am angle"): arm A no digest
     vs arm B digest, temp-0, same profile. Measure constraint adherence, the way session 6
     measured subject retention at 7% → 75%.
   - Reproduce the repeat-ask defect, then confirm the pin fixes it.
   - Read `usage.prompt_tokens_details.cached_tokens` to confirm or retire the §4.1 claim.
5. **Write down what was NOT verified.**

---

## 9. Harnesses added this session (`.scratch/`, gitignored)

```bash
node node_modules/tsx/dist/cli.mjs .scratch/measure-bundle-headroom.ts   # §1.2 — free
node node_modules/tsx/dist/cli.mjs .scratch/measure-system-prompts.ts    # §1.3 — free
node node_modules/tsx/dist/cli.mjs .scratch/verify-eviction.ts           # §1.2 — free
node node_modules/tsx/dist/cli.mjs .scratch/probe-pre-router-real.ts     # §5.2 — free (session 6)
```
