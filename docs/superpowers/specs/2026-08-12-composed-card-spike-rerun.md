# Composition spike, re-run against the SHIPPED contract — measured 2026-08-12

**Harness:** `scripts/spike-slot-composer.ts`, now importing `EMIT_CARD_TOOL`, `handleEmitCard`,
`RECIPES` and the shipped `executeCorpusSearch` instead of the draft schema it carried in v0. Real
DashScope, real pgvector over the real 532-row corpus, real receipt materialization from Supabase.
Six asks × two models × **three full runs**.

**Baseline:** spec §2.1 (the v0 run, 2026-08-10).

> **Read the basis changes before comparing any number.** Four things moved under the harness
> between v0 and this run, and each one retires a v0 figure. They are listed in §4.

> 🔴 **§1 AND §2 ARE SUPERSEDED — read the ADDENDUM at the bottom first.** They conclude "flash
> cannot be trusted with this contract", and that conclusion was measured against a loop with no
> search budget, a contract that rejected correct answers, and reasoning switched off. With those
> fixed, flash scores 6/6, 5/6, 6/6 — plus's own range — and 5/5 end-to-end through the real loop.
> §2's diagnosis is also wrong on its own terms: flash was not "refusing the tool and answering in
> prose", it was stuck in a retrieval loop and writing nothing at all. Everything in §3, §4 and §5
> still stands.

---

## 1. The headline ⚠️ SUPERSEDED — see the ADDENDUM

**flash cannot be trusted with this contract. plus can.** The gap is not marginal and it is not
noise — it holds across three runs, and flash's failures are *systematic*, not random.

| comparable dimension | flash v0 | **flash now** | plus v0 | **plus now** |
|---|---|---|---|---|
| emitted a card | 5/6 | **12/18** (4/6 every run) | 6/6 | **18/18** |
| rendered (schema-valid) | 4/6 | **9/18** | 6/6 | **16/18** |
| searched corpus unprompted | 6/6 | **18/18** | 6/6 | **18/18** |

New dimensions the v0 harness could not measure:

| | flash | plus |
|---|---|---|
| **D6 — `hook-set` deliverable is a usable LINE** | *no data* (never produced a hook-set) | **21/21** |
| **fabricated row ids** | **3/18** — the `teardown` case, every run | **0/18** |
| model wrote a `handle` anywhere in its args | 0/18 | 0/18 |
| repair attempt recovered the card (§5 ladder) | **0/3** | **4/6** |
| receipts materialized | 9 | **32** (31 carrying a number) |

### The seed does not pin DashScope

Runs 1/2/3 scored flash **2, 3, 4** valid out of 6 and plus **5, 6, 5** — same seed
(`QWEN_SEED`), same temperature (0.3), same prompts. Any single run of this harness is worth ±1–2
cases. That is why the table above pools three runs, and why n=6-per-run should never be quoted
alone. The v0 §2.1 figures are single-run and carry the same uncertainty retroactively.

---

## 2. What flash actually does wrong ⚠️ SUPERSEDED — the diagnosis below is wrong; see the ADDENDUM

**It refuses the two most common ask shapes.** On `hooks` and `angles`, flash emitted **no card at
all** in 3/3 runs — it did not call the tool and answered in prose. In v0 flash emitted on 5/6
cases; the shipped contract is harder (pick a recipe, satisfy its required slots, type the
deliverable) and flash's response is to not play. That degrade is *safe* — prose, never a broken
card — but it means shipping on flash means the feature simply does not fire for hooks and angles.

**It invents row ids.** Every run, on `teardown`, flash wrote a `proof_strip` ref that retrieval
never returned — e.g. `d831f323-63d5-4bfa-bcd2-cf83f45dcin57`, a *corrupted* UUID (`cin57` is not
hex; it mangled a real id). D7 held: no fabricated handle reached a block, and the id resolved to
nothing. But see §3 — the card still rendered.

**Its double-encode is no longer recoverable.** v0 finding 2 recorded flash sending `cards` as a
JSON string and called it *"recoverable by a repair pass"*. That repair now exists
(`repairCardsArray`). It does not help, because flash corrupts the inner JSON while stringifying it:

```
{"t": "t": "0:20-0:25", "text": "…"}
```

`finish_reason` was `tool_calls` on every attempt — **nothing was truncated**; the model emitted
complete, malformed JSON. Caught 3 times in 4 targeted re-runs of `flash`/`ad`. `JSON.parse`
correctly refuses and the turn degrades to prose. The repair still earns its place (it recovers a
*clean* double-encode, unit-tested), it just cannot rescue this.

---

## 3. 🔴 The finding that is not about model choice

**A `teardown` card whose every receipt ref fails to resolve still renders.**

`teardown` is the one recipe whose `requiredSlots` include `proof_strip`. `parseComposedCard`
checks that the slot is *present*, not that it *resolves*. So flash's fabricated ref produced a
card that validates, renders, and asserts proof it cannot show — the slot renderer correctly draws
nothing (`composed-card-slots.tsx:49`), so the creator sees a teardown with an empty evidence
section.

That is precisely the "never a broken card" case §5 exists to prevent, and no current check stops
it. **This is an owner call, not a bug fix**, because the obvious remedy — reject a card when a
recipe-required `proof_strip` resolves to zero receipts — also kills a legitimate card whenever the
database misses. Recorded here; not implemented.

---

## 4. Basis changes — which v0 numbers are now retired

1. **B2 — `distinctSlotKinds` is not comparable.** `actions` was an 11th slot kind in v0 and is a
   card field in the shipped contract, so the metric counts a different population.
2. **D7 — "fabricated handles" is no longer measurable.** The model supplies row ids; it is never
   asked for a handle. `fabricated row ids` replaces it. It is weaker evidence about honesty and
   stronger evidence about safety: v0's 0/6 was the model choosing not to lie, this run's 0/18 on
   plus is the model *unable* to.
3. **D6 — the hero metric changed shape.** v0 measured a free-text `hero`; this measures a typed
   `deliverable`. This is the change §2.1 finding 1 demanded, and it is the one unambiguous win.
4. **Retrieval changed.** v0 hand-wrapped `retrieveCachedExamples`; this calls the shipped
   `executeCorpusSearch` with `includeRowIds: true`, since row ids are the only thing a
   `proof_strip` can consume.
5. **⚠️ `avg prose` is confounded — do not quote it.** The plan listed it as comparable. It is not:
   the harness accumulates prose across *every round*, and this run has more rounds than v0 (more
   searches, plus the repair attempts). flash averaged 593/377/68 chars across the three runs and
   plus 634/525/737, against a v0 baseline of 61 and 144. Almost all of that delta is round count,
   not verbosity. Fixing the instrument is cheap; it was not done here.

---

## 5. D6 worked

`hook-set` deliverables from plus, 21/21 usable lines across three runs. A sample:

> "We just raised our prices by 40% and here's why it was the best decision we ever made."
> "You guys know the Grey Goose story? They charged more than everyone else and became the #1 vodka in America."
> "I'm about to raise my prices by 3x. Let's see if anyone actually leaves."

Against the v0 failure it replaces — flash writing *"The Faceless Case Study"*, *"The 'Spite'
Angle"* — the typed deliverable is doing exactly the job §0.5 asked of it. **This is measured on
plus only.** flash never produced a `hook-set` in any run, so D6 is *unvalidated* on flash, not
passed.

---

## 6. What this costs — the decision is not free

`QWEN_REASONING_MODEL` defaults to **`qwen3.7-flash`** by an owner call dated **2026-08-04**, whose
stated reason is price: **$0.03/$0.13 per M against plus's $0.40/$1.60 — an order of magnitude**
(`src/lib/engine/qwen/client.ts:38-48`).

So "the measurement says plus" is a recommendation to reverse a deliberate, recent, cost-motivated
decision on the chat path. Three ways forward, in the order I would consider them:

1. **Iterate the contract for flash, then re-measure.** Cheapest, and the failures are specific
   rather than diffuse: flash declining `hooks`/`angles` outright suggests the recipe menu in the
   tool description is too much to hold, not that composition is beyond it. One pass at the
   description plus a re-run is a few hours and no recurring cost.
2. **Ship on plus for composed-card turns only.** `COMPOSED_CARDS` is already a per-request flag,
   so the model could be selected alongside it and the 10× would apply to those turns alone — not
   to decode, adapt, fold, or vision.
3. **Ship on flash as-is.** Costs nothing and is safe (every failure degrades to prose), but the
   feature would not fire for hooks or angles, roughly half of composed asks would render, and
   `teardown` would keep producing evidence-free proof cards until §3 is ruled on.

**Not recommended: flipping `QWEN_REASONING_MODEL` globally.** Nothing here measured decode, adapt,
fold or vision, and the 2026-08-04 call was made on evidence about those paths.

---

## 7. Reproducing

```bash
node node_modules/tsx/dist/cli.mjs scripts/spike-slot-composer.ts
# one model / one case, for chasing a specific failure:
SPIKE_MODEL=qwen3.7-flash SPIKE_CASE=ad node node_modules/tsx/dist/cli.mjs scripts/spike-slot-composer.ts
```

Output lands in `.spike-out/` (gitignored): `slot-composer-report.txt` and the full trees plus every
failed call's raw arguments in `slot-composer-results.json`. Run it more than once before believing
any single figure.

---

# ADDENDUM — making flash work (same day)

The recommendation above was "iterate the contract for flash, then re-measure". Done. **flash now
composes**, and the fix was four things, none of which was the model being too small.

## What was actually wrong

**1. It was not declining the tool — it was drowning in retrieval.** The verdict line said
`NO CARD (prose only)`, and the telemetry said `prose=0`. flash never wrote a word: it spent every
round inside `search_corpus` and hit the round cap. On `hooks` it ran the IDENTICAL query four
times; on `angles` it rephrased six times. **My own report was wrong about the cause** — the string
was written before the instrument existed to check it.

Fix: `src/lib/grounding/search-budget.ts`. A repeat query is refused without running (no embed, no
RPC) and told it already has the rows; three searches per turn, after which the tool is withdrawn.
One module, used by the loop AND the harness, so the two cannot measure different rules.

**2. A refused search still costs a round.** With the governor alone at production's 4-round cap,
flash scored 1/6 — it asked, got refused, and the round was gone. The last round is now reserved:
`search_corpus` is withdrawn on the final round regardless of budget. (Note: flash calls a withdrawn
tool anyway, so withdrawal alone is not sufficient — the round budget had to move too.)

**3. The contract was rejecting correct answers.** Two bounds read off spec prose that real output
does not respect:

| bound | was | now | why |
|---|---|---|---|
| `hook-set.cardCount.max` | 5 | **6** | Asked for "5 hooks", flash sent an overview card **plus** five. §4.2's "3–5" counts hooks, not cards. |
| `proof_strip` legality | 3 of 8 recipes | **all 8** | `comparison` and `script` both refused evidence and lost the whole card. |

`proof_strip` everywhere is the substantive one. There was never an honesty argument for the
restriction — the spine already has a receipt row, and D7 means the model names a row id while the
server materializes it, so a bad id renders nothing. A grounded answer that may not show what
grounded it is the product arguing with itself. **`stat_row` was deliberately NOT widened**: it
carries `{value,label}` strings the MODEL writes, so spreading it spreads model-authored numbers.
The model asked for it in `comparison` and is still refused.

**4. `enable_thinking` was hardcoded false.** Reasoning is what closes the remaining gap, and on
flash it is cheap — $0.13/M output against plus's $1.60. It also searches *less* when it can plan,
so some of the tokens pay for themselves. Verified live that reasoning arrives in its own
`reasoning_content` field (3,253 chars of it against 185 chars of answer) and never reaches
`onToken`: `scripts/probe-thinking-stream.ts`.

Composed-card turns now get reasoning, 6 rounds, and a 4000-token budget. **An ordinary chat turn is
byte-identical to what ships today** — all four are behind `composedCards`.

## 🔴 The one that would have shipped a silent dud

With `emit_card` bound but **unmentioned in the tool-use directive**, the live loop answered a
comparison ask with **2,438 characters of markdown** — `##` headings, bold labels — and never called
the tool. The spike composed a card for the identical ask, because the spike's own prompt names it.

I had decided not to touch the directive, reasoning that the tool description already said "prefer a
card over prose". That was wrong, and only the end-to-end probe caught it: the spike cannot, because
the spike does not use the shipped prompt. The directive now names `emit_card`, bans markdown
structure, and defers explicitly to the paid generators.

## Measured

flash, six asks, against the shipped contract:

| config | rounds | valid |
|---|---|---|
| baseline (as reported above) | 6 | 2/6, 3/6, 4/6 |
| + governor, no reasoning | 6 | 4/6 |
| + governor, no reasoning | 4 | 1/6 |
| **+ governor + reasoning** | **6** | **6/6, 5/6, 6/6** |

For reference, plus with none of this scored 5/6, 6/6, 5/6.

End to end through the **real loop** (`scripts/probe-thinking-stream.ts`), not the harness:

| stage | cards produced |
|---|---|
| directive silent about emit_card | 0/1 — 2,438 chars of markdown |
| directive names it | 1/3 |
| + `proof_strip` in every recipe | 2/4 |
| + the double-encode error names itself | **5/5** |

That last one: `cards` arriving as an unparseable JSON string was the commonest live failure, and
the error said "needs a non-empty `cards` array" — which describes a MISSING argument, so the
model's one repair attempt was a guess. It now says what the model actually did.

## Standing caveats

- **This harness is noisy.** Three runs of the same config spread 2/6–4/6. Treat any single figure
  as ±1–2 cases; the 5/5 above is five real-loop runs, not one.
- **Fabricated row ids are not gone.** flash produced one in the final spike run (1/6). §3 above —
  a `teardown` whose refs all fail to resolve still renders — is still open and still an owner call.
- **`avg prose` remains confounded** (§4.5) and the instrument was not fixed.
- **A bound generator beats emit_card**, correctly: asked for hooks with `generate_hooks` bound, the
  model called the paid skill and composed nothing. That is the intended precedence, but it means
  composed cards will mostly fire on asks no generator covers.
- **Cost is not zero.** Reasoning was ~3.2k characters for a one-sentence answer. Cheap on flash,
  but it is real output spend on every composed-card turn.
