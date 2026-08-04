# Engine Model & Latency Policy

> Source-of-truth for **which model + thinking mode + token budget** every engine LLM call uses.
> Updated **2026-08-04** (reasoning model plus → flash). Goal: **Numen feels snappy while keeping quality.**
> Tune `max_tokens` from logged `usage` after real traffic — values below are measured where noted,
> else generous headroom rails.

## Two models, platform-wide

The Qwen engine runs on **exactly two models**, split by ONE capability line — **audio**:

- **`qwen3.5-omni-flash`** — the **sensor**, and the only audio-capable model. Used ONLY where raw
  video audio must be ingested (Wave 0 read + the audience bake watch). Audio is distilled once here
  into text (`audio_event`, transcript, emotion arc); everything downstream reasons over that.
- **`qwen3.7-flash`** — **everything else**, text AND video (sighted, deaf). Generation, SIM scoring,
  the fold, chat, decode/adapt.

…with **no exceptions.** Apollo and the CALIBRATE synth both failed on flash first and were both
FIXED rather than held back (see the A/B below) — the two failures were in our prompt/parse layer,
not in the model's ability to do the job. `QWEN_APOLLO_MODEL` and `QWEN_CALIBRATE_MODEL` remain as
scoped env seams so either call can be pinned back to plus in one variable, but both now default to
`qwen3.7-flash`.

> ⚠️ **One accepted behaviour change, not a bug: Apollo grades HARSHER on flash.** Same prompt, same
> clips, flash lands the hook band one step below plus, and hook carries ~80% of the composite
> (§2.0a) — so the headline score moves ~30 points on the videos measured (49 vs 80, 53 vs 82). The
> reasoning is sound and the citations are identical; flash is stricter, not wrong. This is the one
> thing to watch after the swap, because it moves a number users see.

**The reasoning model moved `qwen3.7-plus` → `qwen3.7-flash` on 2026-08-04** (owner call). Same
generation, still sighted, still deaf — so no call site changed capability and the audio boundary is
exactly where it was. Cost falls roughly 10×: **$0.03/$0.13** per M at ≤32K input against plus's
$0.40/$1.60 (flash is priced in context BANDS — $0.10/$0.40 through 256K, $0.20/$0.80 through 1M —
which `qwen/cost.ts` now models; a flat rate would have understated every video call). `ENGINE_VERSION`
bumped 3.21.0 → **3.22.0**: the prediction cache keys on it, so without the bump every row scored by
plus would keep replaying. Rollback is env-only (`QWEN_REASONING_MODEL=qwen3.7-plus`) — but note that
rolling the model back does NOT roll the version back, so plus rows re-score once under 3.22.0.

### The 2026-08-04 A/B — both risks were real questions; one of them bit

Two things were flagged as unverifiable from source. Both were then measured live, and they came back
opposite ways. **This is why the swap was validated before merging, not after.**

**① Output diversity on the fold — PASSED.** `qwen3.6-flash` was retired in 2026-06-25 because plus
held multi-output reactions (SIM candidates, fold personas) far more distinct. That did NOT transfer
to the new generation. `scripts/fold-validate-r1.ts`, live, 8-segment video:

| | result | gate |
|---|---|---|
| diversity (`avgCurveRange`) | **0.28** | floor 0.10, healthy 0.27–0.41 ✅ |
| latency | **13.7s** | 90s ceiling ✅ |
| parse | clean first attempt, **no diversity retry** | ✅ |
| cost | 0.547¢ | — |

The cast spread is visible in the personas themselves: `tough_crowd` watch 25% / share 2 against
`sharer` watch 85% / share 80. Not a collapsed fold.

**② Apollo's citations — FAILED on the first pass, then FIXED. Apollo runs on flash.** `scripts/apollo-cite-harness.ts`,
same video, both models back to back:

| | `qwen3.7-plus` | `qwen3.7-flash` |
|---|---|---|
| composite | **81** | **53** |
| §-cites | `§2.1 §2.2 §2.3 §2.5` | **none** |
| hook lever | `§2.1 rapid context + specificity` | `contrast / curiosity gap` |
| latency | 59.7s | 17.1s |
| cost | 2.07¢ | 0.50¢ |

Flash emits **no framework citations at all** — every lever degrades to generic prose. That citation
is the product: this doc's own line for Apollo is *"cited, framework-grounded expert judgment (the
video moat)"*. The headline composite also swings 28 points on one clip. The 3× speedup is the tell
that `thinking_budget` is not being spent, and Apollo is the only call running thinking ON — which is
exactly why it is the only one that regressed.

> 🔑 **The lesson to keep: a cheaper model is not cheaper if it stops answering the question.** Flash
> is ~4× cheaper on this call and returns something that *looks* like an Apollo result — valid schema,
> plausible prose, sensible dimensions. Nothing in the type system, the tests, or the build would have
> caught it. Only running the real harness and reading the output did.

**The fix (2026-08-04), and why it was ours to make.** The output contract never actually *required*
the token. It said *"name the §2 lever"* and *"Cite section numbers ONLY inside the auditable
fields"* — a restriction on where cites may go, which plus read as an instruction to cite and flash
read as permission not to. So the contract now demands it in both places (`apollo-core.ts`
APOLLO_INSTRUCTION + the per-dimension JSON contract in `deepseek.ts`: `"lever": "§<n.n> …"`), and
`reasonWithDeepSeek` gates on it — fewer than `MIN_CITED_DIMENSIONS` (4 of 6) cited `lever`s sets a
cite-specific retry nudge and re-asks; exhausting the retries logs an error and reports to Sentry
rather than passing an uncited read off as the framework-grounded product.

Re-measured after the fix, same clip, 5 runs each:

| | `qwen3.7-plus` | `qwen3.7-flash` |
|---|---|---|
| §-cites | `§2.1 §2.2 §2.3 §2.5` | **`§2.1 §2.2 §2.3 §2.5` — identical** |
| dimensions cited | 6/6 | **6/6** |
| danglers · prose leaks | 0 · 0 | 0 · 0 |
| composite across 5 runs | 52, 80, 80, 80, 80 | **49, 49, 49, 49, 49** |

Two things worth keeping from that table. **Flash is the deterministic one** — plus swings 52→80 on
its own seed, which is what thinking-mode staging does (the same Pitfall-3 jitter D-01 cites for
CALIBRATE); so part of the "28-point swing" originally blamed on flash was plus's own noise.
**But the ~30-point composite gap is real and systematic**, reproduced on a second clip (82 vs 53):
flash grades the hook one band lower. See the ⚠️ note at the top — accepted, and the thing to watch.

> 🔎 Observed once while measuring, NOT caused by this change and NOT yet fixed: on a clip with no
> verbatim hook, **plus** emitted empty `rewrites[].original` three times and burned all 3 retries →
> `reasonWithDeepSeek` returned null. Flash handled the same clip. Same family as the single-shot
> CALIBRATE fragility below: a hard schema field the model cannot satisfy when the input lacks it.

**③ The CALIBRATE synth — FAILED on the first pass, then FIXED. CALIBRATE runs on flash.**
`scripts/calibrate-synth-harness.ts` drives the real exported `enrichSignature()` on a REAL 32-post
@zachking payload (`account_posts` + the 2026-07-17 `account_snapshots` profile — the same scrape
generation as the shipped audience row), byte-identical for both models:

| | `qwen3.7-plus` | `qwen3.7-flash` |
|---|---|---|
| runs passing | **3 / 3** | **0 / 7** |
| Σ persona shares | 1.00 every run | **0.75 – 0.85, never 1.0** |
| shape | nested correctly 3/3 | **flattened in 2 of 7** (`personas`/`persona_weights` at top level) |
| latency | 52.6–56.5s | ~20s |
| cost | ~0.63¢ | ~0.053¢ |

Flash breaks the two **hard** invariants in `SynthSchema` while satisfying every soft one. Its prose
was good — 10 distinct, creator-specific personas with real axis spread, no diversity collapse — so
the qwen3.6-flash failure this swap was watching for did **not** recur. What it cannot do is hold a
10-way constrained allocation: the shares simply do not add up.

That is not a quality regression, it is an **outage**. `defaultSynthesize` had no retry, so the zod
throw propagated to `calibration.ts:375` and every bake returned `{ error: "scrape_failed" }` —
*after* the Apify scrape is paid for, and blaming the scrape for a synthesis failure.

**The fix (2026-08-04): make the call robust, not the model timid.** `repairSynthShape()` runs before
Zod and does exactly two things, both no-ops on a clean response: it **lifts** flattened keys back
under `audience`, and it **renormalizes** the three proportion vectors to sum 1.0 — inside a guard
band (total must land in 0.5–1.5). Renormalizing rescales what the model allocated and preserves
every ratio, so nothing is invented; the guard band is what keeps that true, because a vector summing
to 0.2 means the model misunderstood the task and must NOT be silently rescaled into looking right.
Out of band → Zod still rejects. Every repair is logged (`synth output repaired`). On top of that the
call now gets **one retry** carrying an arithmetic nudge — closing a single-shot fragility that plus
had too, it just bit far less often.

Re-measured on flash after the fix: **5/5 PASS**, 24–31s, ~0.053¢ — against plus's 52.6–56.5s and
~0.63¢, so **~12× cheaper and ~2× faster** with the persona quality unchanged (10/10 distinct
creator-specific names, 0 archetype echoes, 0/8 flat axes, and 0 interest keys outside `topic_vocab`
where the shipped plus baseline scores 3). The repair fired on all 5 runs — shares came in at
Σ 0.80–0.90 every time and one run also flattened — so this is load-bearing, not belt-and-braces.

> ⚠️ **Correction — CALIBRATE is NOT a thinking-ON call site.** This document said it was, in this
> section, in *The thinking principle* below, and in the policy table (`Thinking: ON`, `max_tokens
> 6000`, `thinking_budget 2000`). The code has set `enable_thinking: false` at
> `enrich-signature.ts:391` (D-01) with `max_tokens: 8000` and no budget. **Apollo is the only
> thinking-ON call in the codebase** — `engine/deepseek.ts:554` holds the sole `enable_thinking: true`
> in non-test source; every other live call site sets it to `false`. So Apollo's failure mode (an
> unspent `thinking_budget`) never applied here, and the two calls failed for unrelated reasons.

> ⚠️ **The `Basis` column below predates this move.** Every measured latency, cost and diversity figure
> in the policy table was taken on `3.7-plus` (or earlier). The `max_tokens` rails are output-size
> budgets and carry over as safety rails, but the *measurements* have not been re-run on flash. They
> are kept as written because they record what was observed, not what runs now.

(Note: the legacy competitor-intelligence files `src/lib/ai/deepseek.ts` + `gemini.ts` — despite their
names — both resolve to `QWEN_REASONING_MODEL` via DashScope and have no live (non-test) importers.
The old `deepseek-chat` + `gemini-2.5-flash-lite` providers are gone; the dead files are a deletion
candidate.) `QWEN_FAST_MODEL` is removed.

> Card badges are PRODUCT labels, not model ids: **`SIM-1 Flash` = text-only call**, **`SIM-1 Max` =
> with-video call**. The underlying model is `3.7-flash` either way — and note the third collision in
> this area: `SIM-1 Flash` (tier) ≠ `omni-flash` (sensor model) ≠ `3.7-flash` (reasoning model).

## The thinking principle

**Thinking (chain-of-thought) is OFF everywhere except two places.** We feed rich input (KC craft
prompts, audience repaint, grounding lines, omni sensor dumps), so CoT is usually redundant and its
latency isn't worth it. Live-proven on the SIM: thinking-off held identical verdict bands + better
persona voice at **~3–4× lower latency** (~55s → ~15s batched).

**Thinking is ON in exactly ONE place** — judgment-heavy *and* off the snappy per-request path:
- **APOLLO video insight** — cited, framework-grounded expert judgment (the video moat). Budget A/B-tuned
  (`deepseek.ts:28`): depth held identically 3000→1000; 1500 chosen. Video reads are heavy + infrequent.

> Verified 2026-08-04 by grepping every `chat.completions.create` call site: `engine/deepseek.ts:554`
> is the only `enable_thinking: true` in non-test source. This section previously listed **CALIBRATE**
> as a second thinking-ON call; that was wrong — see the ⚠️ correction above.

## `max_tokens` semantics (DashScope)

`max_tokens` caps **output (completion) tokens**, and **thinking tokens count toward it**. So:
- **thinking OFF** → `max_tokens` = visible-answer budget.
- **thinking ON** → `max_tokens` = `thinking_budget` + answer (NEVER set tight, or the answer truncates).

**It is a SAFETY RAIL, not a latency lever.** Set it generously (~1.5–2× expected output): too tight
truncates the JSON → `safeParse` fails → silent drops (batched SIM) or a lost audience half (fold).
Unused headroom is free (you pay actual output, not the cap).

## Policy table

| Role | Call sites | Model | Thinking | max_tokens | thinking_budget | Basis |
|------|-----------|-------|----------|-----------|-----------------|-------|
| **SIMULATE** N=1 | `run-flash-text-mode` (react/script opener) | `qwen3.7-flash` | OFF | 1000 | — | measured ~400–500, ×2 rail |
| **SIMULATE** batch | `run-flash-text-mode` (hooks/ideas/remix, N≤5) | `qwen3.7-flash` | OFF | 3500 | — | measured ~1.9k @ N=5, ×~1.8 rail |
| **GENERATE** hooks | `hooks-runner` | `qwen3.7-flash` | OFF | 1500 | — | measured 587/791, ×~2 rail |
| **GENERATE** ideas | `ideas-runner` | `qwen3.7-flash` | OFF | 2000 | — | est. (richer × 4) |
| **GENERATE** script | `script-runner` | `qwen3.7-flash` | OFF | 2000 | — | est. (beats) |
| **ADAPT** | `remix/adapt` | `qwen3.7-flash` | OFF | 1200 | — | rail |
| **DECODE** | `remix/decode` | `qwen3.7-flash` | OFF | 1200 | — | rail |
| **CONVERSE** chat | `chat-runner`, `analyze/[id]/chat`, 4 tool-route follow-ups | `qwen3.7-flash` | OFF | 2000 | — | bound runaway; streamed |
| **TEXT-ANALYZE** (no-video path) | `pipeline.ts` gemini_analysis | `qwen3.7-flash` | OFF | 2000 | — | fixed 2026-06-25 (was unbounded + thinking-unset) |
| **FOLD** (Read audience sim) | `wave3/fold` | `qwen3.7-flash` (video, deaf) | OFF | 8000 | — | 10 personas × N segments; independence directive is the diversity lever. ✅ **validated live 2026-06-26** (5-seg video: 40.9s/90s, diversity 0.31 first-attempt no-retry, 0.56¢; `scripts/fold-validate-r1.ts`) |
| **CALIBRATE** synth | `audience/enrich-signature` (synth call) | `qwen3.7-flash` | OFF | 8000 | — | v2 persona output (~3.5k) + headroom. ✅ **on flash 2026-08-04** — raw flash was 0/7 (shares summed 0.75–0.85); `repairSynthShape()` + 1 retry → **5/5, ~12× cheaper, ~2× faster**, persona quality unchanged. Seam: `QWEN_CALIBRATE_MODEL` |
| **SENSOR** read | `qwen/omni-analysis` (Wave 0) | `qwen3.5-omni-flash` | OFF | 8000 | — | audio in; sensor dump |
| **SENSOR** bake-watch | `enrich-signature` (watch call) | `qwen3.5-omni-flash` | OFF | 600 | — | per-video watch notes |
| **APOLLO** video insight | `engine/deepseek` | `qwen3.7-flash` (video, deaf) | **ON** | 3000 | 1500 | the reasoning moat (A/B-tuned). ✅ **on flash 2026-08-04** — flash cited nothing until the contract REQUIRED the § token; now 6/6 dimensions cited, identical cite set, deterministic. ⚠️ grades ~30 composite points harsher. Seam: `QWEN_APOLLO_MODEL` |

### Notes
- All scoring/generation calls keep `temperature: 0` + `seed: QWEN_SEED` (determinism). The **fold**
  baseline is `temperature: 0` too, but auto-perturbs to `FOLD_DIVERSITY_RETRY_TEMP` (0.7) on a
  diversity-collapse retry — the old retry re-ran the identical deterministic call (a no-op).
  Reproducibility is no longer a HARD requirement (2026-06-25): `FOLD_TEMPERATURE` env can raise the base.
- Model env seams: `QWEN_OMNI_MODEL`=omni-flash (sensor), `QWEN_REASONING_MODEL`=3.7-flash (everything),
  `QWEN_APOLLO_MODEL`=3.7-PLUS and `QWEN_CALIBRATE_MODEL`=3.7-PLUS (both scoped so they can stay put —
  see the A/B above). `QWEN_FAST_MODEL` removed.
- `enable_thinking: false` is a DashScope extension (apply via the `@ts-expect-error` pattern).
- Estimated `max_tokens` are rails with headroom — verify against one real output per site; bump if any truncates.

## Rollout
- **PR-1 (S3′):** SIM batching + generate-rate-rank + SIM thinking-off. ✅ done + proven.
- **PR-2 (thinking policy):** thinking-off on generate/adapt/decode/chat; calibrate thinking-on; budgets set. ✅
- **PR-3 (R1′ model consolidation, 2026-06-25):** retire 3.6-flash → 3.7-plus (SIM); fold omni-flash →
  3.7-plus (sighted/deaf) + independence directive + real diversity retry; fix the no-video text-analyze
  gaps; cut dead `wave3.ts`; retire `QWEN_FAST_MODEL`. ✅ this change.
- **R1′ fold live validation (2026-06-26):** ✅ **clean PASS** — real `runFold` on a 5-segment video:
  40.9s/90s, diversity **0.31 first-attempt (no retry)**, 0.56¢. The 3.7-plus fold holds the 10 personas
  distinct natively (the collapse was a small-model artifact). Harness `scripts/fold-validate-r1.ts`.
- **Follow-up (R1′b, not yet built):** unify the fold onto the ambient audience (repaint the 10 archetypes
  with the calibrated signature; General → byte-identical) + surface the Read audience reaction on the
  thread with the `SIM-1 Max` badge.
