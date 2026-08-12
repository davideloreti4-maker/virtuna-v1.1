# Handoff — session 11: C is built, flagged, mutation-tested and measured (2026-08-12)

**Lane:** `lane/in-thread-chat` · worktree `~/virtuna-in-thread-chat`
**Brief:** session 10 §0 — the owner's single number, answered: ship C.
**Predecessor:** `docs/HANDOFF-2026-08-11-session-10-dispatch.md`. Everything in it still stands
except §11.3's narrowing #1, which this session measured and **replaced** (§3).

**Built, flagged OFF, NOT merged, NOT deployed.** Gates all green — `tsc` 0, **6019 tests passed /
0 failed**, `next build` 0. Spend: **7 credits** — 124 generations through the stub till at zero,
plus 13 through the real billed route for the live verification in §7.7 (ledger-verified).

`main` was merged in first (50 commits behind; no file C touches was affected).

---

## 0. ▶️ START HERE

**C works, and the hard cell is the one it moves furthest.**

| cell | control | C | |
|---|---|---|---|
| product subject — *"give me hooks for my student budgeting app"* | **2/10** | **9/10** | p ≈ 0.0055 |
| format subject — *"give me hooks for my new stand-up comedy podcast"* | **0/10** | **10/10** | p ≈ 1.1e-5 |
| scenario subject — already worked | — | **6/6** | nothing broken |
| the measured false positive — *"run the simulate tool on that hook"* | — | **0/4 pinned** | narrowing holds live |

The format cell is the half that **no wording moved** (0/10 → 1/10, p = 1.0, after a clause written
to name exactly that case). It is now 10/10.

**The tool call itself fires 10/10 in every C cell** — 36 of 36. The one app cell gap is a
generator error *downstream* of a successful pin (`generate_hooks / error`), and the same error
occurs on an **unpinned** run in the same batch, so it is transient pipeline noise, not C.

**Two corrections to session 10 came out of the pre-flight checks. Both are in §2 and §3.**

**Flag: `ENGINE_GUESS_PIN`, server-side, default OFF.** Nothing changes until it is set.

**Do next:** §6 — the flag needs a live-route run before default-ON, and there are three
untouched populations (a second profile, mid-thread turns, the real route).

---

## 1. What shipped

| file | what |
|---|---|
| `src/lib/tools/guess-pin.ts` | new. `isGuessPinEnabled()` + `detectGuessPin(rawAsk)` |
| `src/lib/tools/count-hint.ts` | new. `isCountHintEnabled()` + `addCountHint(rawAsk)` — §7 |
| `src/app/api/tools/chat/route.ts` | (8a-0c) the third `forceSkill` branch; (8a-0d) the bundle ask |
| `src/lib/tools/__tests__/guess-pin.test.ts` | new, 12 tests |
| `src/lib/tools/__tests__/count-hint.test.ts` | new, 12 tests |
| `src/app/api/tools/chat/__tests__/route.test.ts` | Tests 6g + 6h (the pin), 6i (the count's boundary) |

**Two flags, both dark, and they are independent.** `ENGINE_GUESS_PIN` pins `tool_choice`;
`ENGINE_COUNT_HINT` changes only the assembled bundle and forces nothing. §7.6 is why the count is
the one to turn on first.

⚠️ `addCountHint`'s output is **byte-identical to the stimulus §7 measured** for both cells — the
unit tests assert the exact strings rather than the shape, so the shipped code is the thing that was
measured, not a re-implementation of it.

The seam is the one chip taps and `ENGINE_REPEAT_ASK_PIN` already use. Scoping is identical to the
repeat-ask pin — typed asks only, never a sealed visitor — and C is strictly **broader** than it
(every repeat ask is also a guess fire), so the two compose by subsumption, not precedence.

```ts
const guessPinSkill =
  isGuessPinEnabled() && !rawSkill && !isSealedVisitor(user) ? detectGuessPin(rawAsk) : null;
```

---

## 2. ⚠️ Correction to §11: the "36 clean fires" were never checked for AGREEMENT

§11.1 read the 22 unique fires that never produced cards and found 2 false positives — the whole
basis for the quoted ~3.4%. It never looked at the other **36**, which were counted clean because a
run followed. But *"a run followed"* is not *"the RIGHT run followed"*: an ask that guesses `hooks`
while the model correctly dispatches `write_script` works today and **breaks under C**.

`.scratch/probe-guess-agreement.ts` (free, DB reads) measured it. **2 disagreements of 36** — and
reading both, **neither is a wrong run**:

| ask | guessed | ran | reading |
|---|---|---|---|
| *"/hooks for my creator tool startup app"* | `hooks` | `ideas` | The assistant replied *"I can't give you hooks yet because I don't know what the tool does"* and ran ideas. **That is the dispatch defect verbatim**, on a product subject, with the creator having typed `/hooks`. C fixes it. |
| *"Turn the strongest idea into a full script."* | `script` | `ideas`, then `script` | The script did land. C pins the artefact the creator named and bills **one** run instead of two. |

**So the exposure stays 2/58 ≈ 3.4%, and the benefit is one ask larger than §11 credited.** The
category exists, it was worth measuring, and it came back empty.

---

## 3. 🔴 Correction to §11.3: narrowing #1 as written is a LOSING trade

§11.3 recommended *"do not pin when the ask names a different tool (`simulate`, `read`, `predict`,
`remix`)"* and called it a cheap regex win. Measured on the same corpus, it is not:

| rule | correct runs suppressed | false positives killed |
|---|---|---|
| **§11.3 as written** (any mention) | **3** | 1 |
| **tool named BEFORE the artefact noun** | **0** | 1 |
| `run/call/use <tool>` | 0 | 1 |

The cost is structural, not incidental: **this product's own creators describe their subject in tool
vocabulary.** All three suppressed asks are real, confirmed-correct hooks runs —

> *"3 hooks for my saas software that lets creators **simulate** how their audience reacts…"*
> *"give me 3 hooks for my new app which lets you **simulate** your tiktok and instagram audience…"*

— against the one false positive, *"Yes, run the **simulate** tool on that hook."* **Position is what
separates them.** The tool word lands *before* the artefact noun when it is the instruction, and
*after* it when it belongs to the subject. Shipped rule is position; it kills the false positive at
zero measured cost, and is verified live at 0/4 pins in §4.

⚠️ `read` is deliberately **not** in the tool list. The corpus never exercised it and "read" is an
ordinary word in ordinary asks (*"read my draft, then give me hooks"*), where standing the pin down
gives the defect back for nothing. Add it with a measurement.

---

## 4. The live measurement — 76 runs, and the setup error in the middle of it

Real loop, real Qwen, real pipelines, prod profile + calibrated `@mrbeast`, stub till. Each C run
evaluates **the exact expression the route evaluates**, so the pin is never hand-set and a narrowing
shows up as an unpinned run exactly as it would in production.

### 4.1 ⚠️ Run 1's app arm measured nothing, and the reason is a finding

I wrote the app ask as *"give me **5** hooks for my student budgeting app"*. Session 10's 23% cell
is `PLAIN_HOOKS` — **no count**. The control came back **10/10**, i.e. at ceiling, where a treatment
arm can prove nothing. That is §8's first trap walked into directly: *a probe's control arm must
fail before its treatment arm is believed.*

Re-run on the exact string (`probe-guess-pin-live-2.ts`), the control reproduces at **2/10** and the
numbers in §0 are from that. **§9 listed the count as never varied, and it matters a lot:**

```
"give me 5 hooks for my student budgeting app"   15/16  (94%)   ← count present
"give me hooks for my student budgeting app"      2/10  (20%)   ← same ask, no count
```

**A count is read as evidence the creator wants a run.** Unmeasured before today. It does not change
C (the guess fires on both; on the counted phrasing the pin is a no-op), but it is the cheapest
known lever on this defect and it belongs in any future copy/placeholder decision.

### 4.2 Quality — and the dance contamination is NOT C's

The packs are off-brief in a specific way: on the app and podcast subjects they keep producing hooks
about *learning a TikTok dance*. Read alone that looks like C dispatching by lowering the bar, which
§5 of session 10 says disqualifies a fix. It is not:

| cell | cards containing dance vocabulary |
|---|---|
| **app-control** (unpinned — the model CHOSE to run) | **26/50 · 52%** |
| app-C (pinned) | 20/50 · 40% |
| podcast-C (pinned) | 21/50 · 42% |
| scenario-C (pinned) | **0/30 · 0%** |

**The unpinned path is the more contaminated one.** The grounding logs show the right topic cached
(*"stand-up comedy podcast for 18-24 US audience on TikTok"*, 6 teardowns across 6 archetypes), so
the corpus is returning *structurally* relevant teardowns whose **surface** the generator is copying.
That is a real defect, it is bigger than the §12.4 lever, and it is **out of scope for C** — recorded
here because it will misread as a C regression to anyone who reads the packs cold. Card counts,
distinctness and word length all sit in band across every arm (5.0 cards, 11–15w, distinct 5.0).

### 4.3 The false positive, live

Unpinned 4/4, and the model does the right thing on its own every time:

> *"I don't have the hook text in this thread. Paste the exact hook line you want tested, and I'll
> run it past your audience immediately."*

---

## 5. The tests, and the proof they are not decorative

`bash .scratch/mutate-guess-pin.sh` — **7 mutations, 7 caught.** Every one restores the source and
the script re-verifies green at the end.

| mutation | caught by |
|---|---|
| narrowing never fires | the false-positive test, and route 6g |
| narrowing reverts to the naive any-mention rule | the three subject-vocabulary asks |
| flag ignored (ships ON) | the flag tests, and route 6g's control arm |
| pin overrides a tapped chip | route 6h |
| pin fires for a sealed visitor | route 6h |

⚠️ **Test 6h passed the moment it was written**, before any wiring existed — it guards behaviour the
absence of code also produces. It proves nothing on its own; mutations 4 and 5 are what make it
load-bearing. Do not trust a green 6h without them.

---

## 6. What I did NOT verify

- **Nothing ran through the real route.** Every generation number is the loop called directly, first
  turn, no `priorTurns`, no persistence. The route wiring is covered by tests 6g/6h only. Session 9
  §10.3 found the live route reproduces defects at a *higher* rate than the offline probe.
- **One profile, one audience, one platform** (`tiktok`, comedy/storytelling, `@mrbeast`). Unchanged
  from session 10, and still the obvious next cell: a profile with **no niche set**.
- **No mid-thread runs.** Every measurement is a thread's first turn.
- **The disagreement and false-positive numbers rest on 147 unique asks**, a corpus dominated by this
  lane's own walks. Indicative, not established — §11.1's caveat carries forward unchanged.
- **`ENGINE_GUESS_PIN` has never been set anywhere but a test.** No staging run, no prod run.
- **The 2 `generate_hooks / error` runs were not investigated** beyond confirming one is unpinned.
- The `count` finding (§4.1) is **16 runs on one subject**. It is a strong effect on a small sample.

---

## 7. 🔴 A COUNT ELIMINATES THE PUSHBACK — and it may make C's billing risk avoidable

Run after the commit, on the FORMAT cell (the hard one: 0/10 in §4, and 0/10 → 1/10 under the
clause written to name it). All arms **unpinned**. `.scratch/probe-count-evidence.ts`, 26 runs, free.

| arm | dispatched | **genuine pushback** | prose tool-call |
|---|---|---|---|
| the creator's words, unchanged | **0/6** | **5** | 1 |
| the creator TYPES a count | **7/10** | **0** | 3 |
| **the route injects the count** (creator types none) | **7/10** | **0** | 3 |

Pooled against §4's control on the same subject: **0/16 → 14/20.**

**Three things here, and the second is the important one.**

**1. Injecting the count works exactly as well as the creator typing it.** Same 7/10, same pack
size, same quality band. `currentAsk` keeps the creator's real words, so only the assembled bundle
changes — invisible to the creator, and no words are put in their mouth that the pipeline does not
already act on (a hooks run produces 5 cards either way; every dispatching run here returned 5).

**2. The count does not partially fix the defect — it ELIMINATES it.** Zero pushbacks in 20 counted
runs against 5 in 6 uncounted ones. The model stops arguing that *"'stand-up comedy podcast' is the
format, not the hook"* entirely. **What remains is a different bug**: the model has decided to run
and fails to *express* the call, emitting it as creator-visible text —

> `generate_hooks(topic="stand-up comedy podcast", count=5)`
> `generate_ideas(topic='stand-up comedy podcast')`

Session 10 §4 recorded this shape **once in 45 runs** and called it "its own kind of bug". Counted,
it is **6 of 26** — because the disposition defect that used to mask it is gone. A pin fixes it by
construction (`tool_choice` cannot be malformed), which is why C is 10/10 where the count is 7/10.

**3. So C and the count are not alternatives, and the composition may beat both.** The count fixes
DISPOSITION at no billing risk; C fixes EXPRESSION but pays ~3.4%. That opens a trigger neither
session considered: **retry pinned when round 1 emitted a prose tool call.** Unlike §11.2's rejected
"guessed AND no tool call", this trigger cannot select for false positives — the model has asserted
the specific call, by name, with args. It is the model's own machine-readable statement of intent.

### 7.4 CONFIRMED on the second cell — and the pushback goes to ZERO across both

`.scratch/probe-count-app-cell.ts`, 16 more runs, product subject, injected count, unpinned.

```
app cell        control 2/6      injected count 9/10
```

Pooled with §7's format cell — **both subject shapes, 32 unpinned runs:**

| | dispatched | **pushback** | prose tool-call | generator error |
|---|---|---|---|---|
| the creator's words, unchanged | **2/12 · 17%** | **9** | 1 | 0 |
| **the route injects the count** | **16/20 · 80%** | **0** | 3 | 1 |

**Nine pushbacks to zero.** The defect this lane has spent four sessions on — the model arguing that
a named product or format *"is the product, not the hook"* — does not occur once in 20 counted runs,
across both subject shapes. Every residual failure is something else.

⚠️ And the one generator error is **§7.4 of session 10 reappearing**: the run errored and the model
delivered the pack itself in prose — *"Here are 5 hooks that actually work for this specific combo"*,
five numbered hooks, no cards. Session 10 found that defect only on non-dispatch turns; it also
lives downstream of a **failed tool call**, which no detector scoped to non-dispatch would see.

### 7.5 The retry trigger is precise — but must NOT pin to the name the model emitted

`.scratch/analyse-prose-tool-call.ts`, over all **107** recorded runs, free.

```
trigger fires                    8
  …on a run that DISPATCHED      0     ← never fires where a retry would be wrong
  …on a non-dispatch             8
recall within the counted arms   6 of 7 residual failures
overlap with C                   8/8 would also have been pinned by C
```

**Precision is perfect on this corpus** — it never fires on a turn that produced cards, and there is
no "I could run `generate_hooks(...)` if you like" discussion shape anywhere in 107 runs. A false
positive requires the model to write a tool call it did not mean.

🔴 **But §7.3's proposal was wrong in one detail, and it matters: do not pin to the tool the model
named.** In **3 of the 8** fires the model emitted `generate_ideas(...)` for an ask that says
*hooks* — the model that failed to express the call also picked the wrong tool. Pinning to its
emitted name would produce the wrong artefact 38% of the time. Pin to **`guessSkill`'s guess**,
which is correct in all 8. The emitted call is the *trigger*; the guess is the *target*.

Since 8/8 of these would also have been pinned by C, the trigger buys **precision, not coverage** —
it is C with the false-positive exposure removed, at the cost of covering only the failures where
the model announced itself.

### 7.6 What this composes to

| | dispatch | wrong-run exposure | machinery |
|---|---|---|---|
| today | 17% | — | — |
| **C alone** (built, flagged) | ~100% | ~3.4% of fires | one branch, shipped |
| injected count alone | 80% | **none** — forces nothing | a bundle change |
| count + prose-call retry → guess | ~95% (6 of 7 residual) | ~0 observed in 107 runs | bundle change + retry |

⚠️ **The retry half is not built and not measured end-to-end**, and 32 runs is a small corpus. The
count's own numbers are solid across two subject shapes; everything about the retry rests on 8 fires.

---

## 7.7 ✅ VERIFIED ON THE LIVE ROUTE — 0/6 → 6/6, and it is STRONGER there than offline

The gap every previous section listed as open. Real `/api/tools/chat` on a dev server, signed in as
the e2e account, real SSE, real persistence, **real billing**. `.scratch/probe-live-route.ts`.

| arm | live | offline, for comparison |
|---|---|---|
| control (`ENGINE_COUNT_HINT` unset) | **0/6** | 2/10 |
| **count hint ON** | **6/6** | 16/20 |

**p ≈ 0.002.** Every control reply is the defect verbatim — *"'Student budgeting app' is a finance
topic, but your niche is comedy storytelling"* — and every treated run returned 5 cards.

The live route is **harsher at both ends** than the offline probe: the control fails harder (0/6 vs
2/10) and the fix works better (6/6 vs 16/20). That is session 9 §10.3's finding holding again —
offline rates are indicative, not production.

**Spend: 7 credits, ledger-verified** (`reading_events`, 7 rows, all `hooks`), not estimated. The
flag is read server-side, so each arm needed its own dev-server start.

### 7.7.1 ⚠️ THE TRAP: the first control arm was confounded, and its TALLY looked correct

The first live control returned **1/6 — in band with the offline 17%**, and it was measuring
something else entirely. The route resolves the account's existing open thread
(`createOpenThreadLazy` → `getOpenThread`), so six POSTs are **one six-turn conversation**, not six
first turns. Runs 2–6 answered:

> *"The previous batch was too 'explainer' and not enough 'story.'"*

— a perfectly reasonable mid-thread reply to a pack that already existed. And the thread it landed
in already held **26 messages from a previous session**, so even run 1 was mid-thread.

**The number agreed with the offline control while measuring the wrong population.** Only reading
the replies caught it; the tally never would have. That cost 1 credit and would have shipped a false
confirmation.

**The fix is the product's own mechanism, not a delete:** send `maven_active_thread=__new__`
(`active-thread-cookie.ts`), whose row is created on first send. Nothing is destroyed, and every run
is a genuine first turn. Any future live probe in this lane must set that cookie — add it to the
signed-in verification recipe.

### 7.7.2 And it hands over the first real mid-thread signal

Those confounded runs are not worthless: they are the only mid-thread data this lane has. In a
thread that already holds a pack, the model **declines and critiques its own previous batch** rather
than pushing back on the subject. That is a different failure from the one this session fixed, and
§6 still lists mid-thread as unmeasured — it now has a first observation, n=5, from a run that was
trying to measure something else.

---

## 8. Do next

0. ✅ **The count hint is BUILT** (`ENGINE_COUNT_HINT`, dark) — TDD'd, 7 mutations, 7 caught, gates
   green. ⚠️ Mutation 3 **survived the first pass**: the "count the destination, not the input" test
   used *"the best **idea**"*, which the plural-only regex never matches, so it passed against a
   first-match implementation too. The test now uses *"the best **ideas**"*. A test that cannot fail
   is the lane's most expensive recurring bug and it got in again here — run the battery.
1. ✅ **Live-route verification is DONE for the count hint** (§7.7) — 0/6 → 6/6, p ≈ 0.002, stronger
   than offline. `ENGINE_COUNT_HINT` is the one flag with production evidence behind it, and it
   carries no wrong-run exposure. **It is ready for the owner's default-ON call.**
2. **Next: the prose-call retry (§7.5), pinned to `guessSkill` and NOT to the emitted tool name.**
   That closes 6 of the 7 residual failures with no measured false positives. Together with the
   count this reaches ~95% at ~0 exposure, which is a better trade than C's ~100% at 3.4%.
2. **Keep `ENGINE_GUESS_PIN` dark until 0 and 1 are measured.** C is built, gated and ready; it is
   the fallback if the composition does not hold live, not the thing to flip first.
3. **Set `ENGINE_GUESS_PIN=true` on a live route run** and re-measure the two cells there before
   arguing default-ON. That is the last gap between this and a shipping default.
2. **Then the profile cell** — a creator with no niche set. Every pushback *cites* the niche while
   doing something else, so a null-niche profile is where the explanation and the mechanism can
   finally be separated.
3. **§12.4 verdict narration** is still the open owner design call. Session 10 §12 is the input: the
   `lever` field is nine templated constants, none of which reads a persona reaction, while
   `readForAudience` already returns the quotes two failed attempts tried to get the model to relay.
4. **The dance contamination (§4.2)** deserves its own session. It affects the path that already
   works, so it is not blocked on any of the above.

⚠️ `.scratch/` is gitignored and now holds **95 files** — every number here is reproducible from
them and they are the only copy. Copy them out before any `git worktree remove`.

| new harness | what |
|---|---|
| `.scratch/probe-guess-agreement.ts` | §2 — the agreement gap in §11's precision number |
| `.scratch/probe-guess-agreement-2.ts` | §2/§3 — reads the 2 disagreements, scores 3 narrowings |
| `.scratch/probe-guess-pin-live.ts` | §4 — 50 runs; app arm void (§4.1), podcast/scenario/falsepos good |
| `.scratch/probe-guess-pin-live-2.ts` | §4 — 26 runs, the corrected app cell + the count arm |
| `.scratch/mutate-guess-pin.sh` | §5 — the 7 mutations |
| `.scratch/guess-pin-runs.jsonl` | all 76 runs, appended before the next starts |
