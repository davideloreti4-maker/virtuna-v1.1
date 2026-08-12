# Handoff — remix shoot sheet, measured against a real video

**Date:** 2026-08-12
**Lane:** `lane/remix-shoot-sheet` · worktree `~/virtuna-remix-shoot-sheet`
**Evidence:** spec §11 of `docs/superpowers/specs/2026-08-10-remix-shoot-sheet-design.md`

---

## Read this first

The session started as one small fix. It became a measurement exercise, and **the measurements
overturned three things that were written down as true** — including two I wrote earlier in the
same session. The corrections are left in place in the spec rather than tidied away, because the
sequence is the lesson.

**A single live run cannot clear a gate on this path.** The adapt call is non-deterministic, so
one sample proves nothing. Every claim below is a rate, and every rate came from re-running.

---

## What shipped

### 1. Perceived segments — the sheet reads what omni saw

`normalizeSegments`' Rule 3 does not pad a short read up to `MIN_BOUNDARY_COUNT`; it **replaces**
it with fabricated fixed buckets. Correct for the filmstrip, which needs a cell floor and ignores
what is in the cells. Wrong for the shoot sheet, which merges to ≤8 beats anyway and needs the
words. A 3-cell talking-head read reached `buildBlueprint` as `"segment 12s"` with no speech.

**The constant is untouched** (owner: *"don't touch the constant"*). `normalizeSegmentsDetailed`
returns `{ segments, perceived }` — `segments` byte-identical for every existing consumer,
`perceived` carrying the discarded cells — and `buildBlueprint` prefers the real grid.

> **Measured:** omni DOES emit per-segment `spoken_text` (3/5 cells). This had been an open
> unknown, predicted to fail. It didn't.

### 2. `spoken_span_s` — lines a person can actually say

`enforceHookZoneBoundary` splits a cell straddling 3s and CR-01 keeps the whole quote on the left
child, leaving **eight seconds of speech pinned to a three-second beat**. The adapt call read "3s
beat", matched the quote's length, and wrote 23 words for it — 7.7 w/s, unsayable.

The words stay where they are. The window they cover is now recorded and passed to the prompt.
`words_per_second` divides by speaking time instead of wall-clock.

> **Measured:** 3/3 hook lines unsayable → **1/15** across five runs.

### 3. Echo gate re-scoped to subject leakage

Spec §7 (*"no beat shares more than one content token"*) **contradicts D2 and the owner's ruling**
that a remix copies the source ~1:1 and swaps it for the niche. It failed the model for
reproducing the joke's own skeleton while the topic had separated cleanly:

```
src : "My best friend is John.   What's his last name? I have no idea."
new : "My workout buddy is Mark. Where does he live?   I have no idea."
```

That is the product working. `survivingSubjectTokens` replaces it: only the source's **people,
places and brands** must not survive. It under-reads on purpose — a false positive accuses a
faithful remix of plagiarism. `sharedContentTokens` is kept as a **fidelity readout where high is
now good**.

Its tokenizer was also broken: punctuation was stripped before splitting, so `we've` → `we ve` and
`ve` counted as shared topic between any two contracted lines.

> **Measured:** 0 subject leaks in 5 live runs. There was never a topical-leak problem.

### 4. The shoot sheet silently not existing

The model intermittently omits `script[]` entirely. Valid response, exit 0,
`adapt concepts generated {count:3}` in the log, and the creator gets the pre-lane artefact with
**nothing saying the sheet is gone**. `generateAdaptConcepts` now retries on it, reading the RAW
response so `stripInvalidScript`'s drop-a-malformed-script decision stands, and logs at ERROR if
the retry is also bare.

Reverses half of the decision at `adapt.test.ts:431`. Both its premises failed: the script is the
deliverable, not "a garnish"; and "the retry repeats the omission" is false because the call is
non-deterministic.

> **Measured:** 5/5 runs the retry fired and rescued the sheet.

---

## What the evidence overturned

**The adapt call is NOT deterministic.** `adapt.ts` sets `temperature: 0` + a fixed seed and calls
itself *"reproducible (D-04 determinism requirement)"*. Three byte-identical inputs produced three
distinct outputs and echo scores of 1, 2, 4.

⚠️ **Anything else in this tree reasoning from D-04 determinism on a DashScope path is reasoning
from something untrue. NOT AUDITED.**

**Which killed the plan's own remedy.** A failed echo check was to be answered with "a stronger
separation instruction" — but the prompt already carries one, twice, in plain language
(`adapt.ts:47` and `:84`). No wording bounds a non-deterministic sampler.

**A mechanical regenerate loop was designed and then cancelled** before any code was written. Under
the 1:1 ruling it would have forced the model *away* from the source, degrading the fidelity that
retains virality, on every run.

---

## Still open

| # | Item | Severity |
|---|---|---|
| 1 | `angle` over its 300-char cap kills the whole card | 🔴 blocks shipping |
| 2 | Does `spoken_span_s`'s prompt line raise the script-omission rate? | unresolved |
| 3 | Audit the tree for other D-04 determinism assumptions | unknown |
| 4 | 2 composer tests are RED on `main` — not this lane | 🔴 main is red |

**1 — `angle` overrun.** Model returned `angle` > 300 chars, then four concepts on the retry;
whole card lost (`adapt_failed`, error state, nothing rendered). **Pre-existing** — reproduced with
this lane's changes suppressed. `angle` is a one-line muted sub-row in the UI (D-09), so a cosmetic
overrun is being treated as fatal, where `stripInvalidScript` and `stripPartialProduction` already
prefer a degraded card over no card. Observed once; rate unknown.

**2 — the span line.** First-attempt omission looked higher after it landed (5/5 live) than before
(~3/8). Suppressed it and re-ran: 1 of 2 comparable runs still omitted. **Not concluded.** The
controlled evidence says no — frozen-input A/B, 4 runs each way, **8/8 produced script**. The live
signal is confounded by decode text that varies per run. Harmless to output now the retry catches
it, but it may cost an extra ~15s call on most runs. **Watch the
`"no script[] despite a beat map — retrying"` warn rate in production** — that log line is the
measurement.

**4 — main is red.** `composer-fold-on-close.test.tsx` and `composer-stop-disc.test.tsx` fail in
isolation. `composer.tsx` and both test files are byte-identical to `origin/main`; this lane does
not touch them. Introduced by `05acdb6e` ("fix(composer): the dock reserve moves with the chips"),
which changed `composer.tsx` and updated only `composer-v8.test.tsx`.

---

## The probes — how to verify any of this

**None need Apify credit, a dev server, or auth.** They sign an existing storage object and call
the runner's own steps directly. ~2¢ per run.

```bash
cd ~/virtuna-remix-shoot-sheet
OBJ="omni-split/59455-447571480576291.mp4"   # 28s, three speakers, real speech

# does omni populate per-segment spoken_text?
node node_modules/tsx/dist/cli.mjs scripts/probe-perceived-segments.ts --path "$OBJ"

# subject leakage + duration plausibility, through the real pipeline
node node_modules/tsx/dist/cli.mjs scripts/probe-echo-check.ts --path "$OBJ" --niche fitness

# frozen AdaptInput, N runs — no omni call, so any difference is the MODEL
node node_modules/tsx/dist/cli.mjs scripts/probe-adapt-determinism.ts --runs 3
```

Find another object:
```sql
select name from storage.objects where bucket_id='videos' and name ilike '%.mp4'
order by created_at desc limit 15;
```

⚠️ Run these with `node node_modules/tsx/dist/cli.mjs`, not `npx` — npx wraps and swallows output.

---

## Testing notes

- `enable_thinking` on the adapt call: works on a trivial prompt (streamed or not), **blows the 90s
  timeout on the real payload** — 3 runs, all `adapt_failed`, 91s wall time for zero output.
  Confirms the comment at `adapt.ts:301` rather than assuming it. Would need a larger timeout and
  `max_tokens` headroom above 3000, since thinking tokens come from the same budget.
- The seam tests in `omni-analysis-verbatim.test.ts` carry `ASSEMBLY_TIMEOUT_MS = 20_000`. They
  drive the whole assembly path, and vitest's 5s default is not a correctness signal on a loaded
  machine — observed timing out at load ~12 while passing in isolation.
- Full-suite numbers on a loaded box are unreliable here; unrelated files fail differently each
  run. Everything touching this lane is stable across three consecutive runs.

---

## State

- Branch `lane/remix-shoot-sheet`, merged up to `origin/main` (`89e84daf`).
- `npx tsc --noEmit` clean. Full suite 6030 passed / 2 failed — both failures are item 4 above.
- The lane is materially closer to shippable. **It is not shippable while `angle` can kill a card.**
