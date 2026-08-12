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
| 1 | ~~`angle` over its 300-char cap kills the whole card~~ | ✅ **FIXED 2026-08-12** |
| 2 | Does `spoken_span_s`'s prompt line raise the script-omission rate? | partly answered — ~33%, not 5/5 |
| 3 | Audit the tree for other D-04 determinism assumptions | unknown — **still not done** |
| 4 | 2 composer tests are RED on `main` — not this lane | 🔴 main is red |

**1 — `angle` overrun. FIXED.** The root cause was not `angle`: the response has **one
all-or-nothing gate**, and both degrade passes in front of it are scoped to OPTIONAL sub-objects,
so nothing degraded the concept's own required prose. Writing the failing test first surfaced a
**third field with the identical defect that was never reported** — `stripPartialProduction` tests
each `production` sub-field for PRESENCE, never for validity, so an over-long `shots` also killed
the card.

Two new sibling passes, `clampOverCapProse` (trims the 4 concept + 4 production prose fields to
their caps, word boundary, ellipsis counted in) and `dropSurplusConcepts` (on >3 concepts keeps the
first 3 that individually validate — **fewer** than 3 still goes to the repair attempt). Caps now
live in one place read by both the schema and the clamp, so validated-cap and trimmed-cap cannot
drift. `script` is deliberately not clamped — its caps are semantic, and `stripInvalidScript`
already covers it.

> **Measured:** 4 unit tests watched returning `null` against the recorded live shape, passing
> after. 6 live runs: **0 `adapt_failed`, 0 over-cap warns** — so the live runs did NOT exercise
> the fix, and are reported as a rate (<1-in-6 on this input), not as verification of it.

⚠️ Found in passing, **not fixed**: `clip()` in `grounding/prompt.ts` returns `max + 1` characters
when the text has no word boundary — the ellipsis is appended after slicing to `max`. Harmless in
prompt building, fatal if ever reused for a schema cap. `trimToCap` in `adapt.ts` is local for that
reason and slices to `cap - 1`.

**2 — the span line.** First-attempt omission looked higher after it landed (5/5 live) than before
(~3/8). Suppressed it and re-ran: 1 of 2 comparable runs still omitted. **Not concluded.** The
controlled evidence says no — frozen-input A/B, 4 runs each way, **8/8 produced script**. The live
signal is confounded by decode text that varies per run. Harmless to output now the retry catches
it, but it may cost an extra ~15s call on most runs. **Watch the
`"no script[] despite a beat map — retrying"` warn rate in production** — that log line is the
measurement.

> **Update — 6 more runs with the line in place: 2/6 omitted (33%).** That sits with the pre-span
> ~3/8 and against the 5/5 that raised the question; 5/5 now reads as small-n noise. The retry
> rescued both, 3/3 concepts scripted in all 6 final outputs. Not a controlled comparison, but the
> alarming number no longer reproduces. Hook density in the same runs: **18/18 sayable**, 3.0–4.7
> w/s — the `spoken_span_s` fix is holding well past its 1/15 measurement.

**3 — the D-04 audit. Scoped, and it has one load-bearing finding.**

Most `D-04` hits in the tree are a different D-04 (the per-thread audience pin) and most
"deterministic" comments describe genuinely deterministic non-model code — the rulebook maths,
`subjectKind` resolution, fixtures. Those are fine. The determinism premise lives in exactly one
place, and everything else inherits it:

> `qwen/client.ts:20-28` (`QWEN_SEED`) — *"Together these make the engine reproducible: the same
> input yields the same score run-to-run. This is the precondition for a trustworthy
> eval/weight-fit number — you cannot separate model error from run-to-run sampling jitter if the
> scorer drifts between runs."*

Two things make that more than a stale comment:

1. **It is scoped to "all scoring-critical LLM calls"**, and it names what depends on it: the eval
   and weight-fit numbers (`scripts/eval.ts` → `src/lib/engine/corpus/eval-harness`). If the
   scorer drifts, an eval delta smaller than the jitter is not a result.
2. **`pipeline.ts:677` scores with the SAME constant the adapt call uses** —
   `QWEN_REASONING_MODEL`, temperature 0, same seed, thinking off. The 9-run, 9-output measurement
   is on that model, not on a cousin of it.

⚠️ Locally `QWEN_REASONING_MODEL` is unset → **`qwen3.7-flash`** (not the `qwen3.6-plus` that ~9
comments across the tree still name — stale since 2026-06-06; corrected in `adapt.ts` only, the
rest left). Production may override the env var.

#### MEASURED 2026-08-12 — the scorer drifts too

`scripts/probe-scorer-determinism.ts`. **24 runs, one frozen caption, 0.245¢ total** — this probe
is ~100× cheaper than the adapt one, so there is no excuse for a small n here ever again.

The chain is exact, not analogical: `scripts/eval.ts` → `eval-harness` → `eval-runner:125` →
`resolvePack("socials").run` = `runPredictionPipeline`, called with `input_mode: "text"`
(`eval-runner.ts:116-123`), which lands on `pipeline.ts:675-715` — the call that emits
`factors[].score`. **Every eval row goes through it.**

| Factor | Range over 24 runs | Δ |
|---|---|---|
| Scroll-Stop Power | 8–8 | 0 |
| Completion Pull | 7–9 | **2** |
| Rewatch Potential | 6–7 | 1 |
| Share Trigger | 6–9 | **3** |
| Emotional Charge | 5–7 | **2** |

**6 distinct score vectors; the modal one appears 12/24 (50%).** Three of the five factors are
unstable; only Scroll-Stop Power held. `aggregator.ts:101` defines
`gemini_score = round(avg(factors) * 10)`, and the mean spans 7.00–7.60 — so **`gemini_score`
ranges 70–76 on byte-identical input.**

⚠️ **Not traced, and it is the link that decides how much this matters:** whether that reaches
`overall_score`, which is what `bucketFromScore` (cuts 70/30) actually consumes.
`aggregator.ts:301` says Apollo's `composite_score` *replaces* `geminiScore` in the current path,
so the drift may be damped, superseded, or compounded downstream. **Trace that before quoting a
bucket-flip rate** — the factor jitter is measured, the bucket consequence is not.

The probe refuses to run if `pipeline.ts` stops matching the parameters it mirrors
(`assertMirrorIsCurrent`), so it cannot silently report a rate for a call production no longer
makes.

**4 — main is red. DOES NOT REPRODUCE — reclassify as a load flake.**
`composer-fold-on-close.test.tsx` and `composer-stop-disc.test.tsx` now pass **4 runs out of 4** —
three in isolation, once inside a full-suite run — on code still byte-identical to `origin/main`
(re-verified with `git diff --stat origin/main`). Nothing was changed to make that happen. Read it
against this doc's own note that full-suite numbers on a loaded box are unreliable here: the red
was the load, not `05acdb6e`. Not "fixed" — **unreproducible**, which is a different claim.

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

- Branch `lane/remix-shoot-sheet`, last merged up to `origin/main` (`89e84daf`) — **`main` has
  moved 65 commits since; re-merge and re-measure before opening a PR.**
- `tsc --noEmit` clean. **Full suite 6040 passed / 0 failed / 42 skipped** (533 files, 149s).
- `angle` can no longer kill a card. The two blockers this doc opened with are closed; what is
  left is measurement, not repair.

### Next

1. Merge `origin/main` (65 commits) into the lane, re-run tsc + suite, PR.
2. **Measure the scorer's jitter** — item 3's open half. A `probe-adapt-determinism`-shaped probe
   pointed at `pipeline.ts:677`. Until then, eval deltas on that path have no floor.
3. Watch `"no script[] despite a beat map — retrying"` and the new
   `"adapt returned over-cap prose — trimming it"` warn rates in production. Both log lines ARE
   their metrics; neither has a prod sample yet, because nothing here is deployed.
