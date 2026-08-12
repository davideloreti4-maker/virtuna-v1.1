# Composition spike, re-run against the SHIPPED contract — measured 2026-08-12

**Harness:** `scripts/spike-slot-composer.ts`, now importing `EMIT_CARD_TOOL`, `handleEmitCard`,
`RECIPES` and the shipped `executeCorpusSearch` instead of the draft schema it carried in v0. Real
DashScope, real pgvector over the real 532-row corpus, real receipt materialization from Supabase.
Six asks × two models × **three full runs**.

**Baseline:** spec §2.1 (the v0 run, 2026-08-10).

> **Read the basis changes before comparing any number.** Four things moved under the harness
> between v0 and this run, and each one retires a v0 figure. They are listed in §4.

---

## 1. The headline

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

## 2. What flash actually does wrong

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
