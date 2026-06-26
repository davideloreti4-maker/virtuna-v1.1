# Engine Model & Latency Policy

> Source-of-truth for **which model + thinking mode + token budget** every engine LLM call uses.
> Updated **2026-06-25** (R1′ model consolidation). Goal: **Numen feels snappy while keeping quality.**
> Tune `max_tokens` from logged `usage` after real traffic — values below are measured where noted,
> else generous headroom rails.

## Two models, platform-wide

The Qwen engine runs on **exactly two models**:

- **`qwen3.5-omni-flash`** — the **sensor**. The only audio-capable model; used ONLY where raw video
  audio must be ingested (Wave 0 read + the audience bake watch). Audio is distilled once here into
  text (`audio_event`, transcript, emotion arc); everything downstream reasons over that.
- **`qwen3.7-plus`** — **everything else** (sighted/deaf: watches video, no audio). Generation,
  SIM scoring, the fold, chat, decode/adapt, audience synth, Apollo.

**`qwen3.6-flash` is RETIRED** (2026-06-25). With thinking OFF the plus/flash latency gap is small,
while `3.7-plus` keeps multi-output reactions (SIM candidates, fold personas) far more distinct.
`QWEN_FAST_MODEL` is removed. (Out of scope: the competitor-intelligence subsystem `src/lib/ai/*`
runs on `deepseek-chat` + `gemini-2.5-flash-lite` — a separate provider decision, not this policy.)

> Card badges are PRODUCT labels, not model ids: **`SIM-1 Flash` = text-only call**, **`SIM-1 Max` =
> with-video call**. The underlying model is `3.7-plus` either way.

## The thinking principle

**Thinking (chain-of-thought) is OFF everywhere except two places.** We feed rich input (KC craft
prompts, audience repaint, grounding lines, omni sensor dumps), so CoT is usually redundant and its
latency isn't worth it. Live-proven on the SIM: thinking-off held identical verdict bands + better
persona voice at **~3–4× lower latency** (~55s → ~15s batched).

**Thinking is ON in exactly two places** — both judgment-heavy *and* off the snappy per-request path:
- **APOLLO video insight** — cited, framework-grounded expert judgment (the video moat). Budget A/B-tuned
  (`deepseek.ts:28`): depth held identically 3000→1000; 1500 chosen. Video reads are heavy + infrequent.
- **CALIBRATE synth** — bake-once frozen audience signature (not per-Reading) → can spend latency for persona quality.

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
| **SIMULATE** N=1 | `run-flash-text-mode` (react/script opener) | `qwen3.7-plus` | OFF | 1000 | — | measured ~400–500, ×2 rail |
| **SIMULATE** batch | `run-flash-text-mode` (hooks/ideas/remix, N≤5) | `qwen3.7-plus` | OFF | 3500 | — | measured ~1.9k @ N=5, ×~1.8 rail |
| **GENERATE** hooks | `hooks-runner` | `qwen3.7-plus` | OFF | 1500 | — | measured 587/791, ×~2 rail |
| **GENERATE** ideas | `ideas-runner` | `qwen3.7-plus` | OFF | 2000 | — | est. (richer × 4) |
| **GENERATE** script | `script-runner` | `qwen3.7-plus` | OFF | 2000 | — | est. (beats) |
| **ADAPT** | `remix/adapt` | `qwen3.7-plus` | OFF | 1200 | — | rail |
| **DECODE** | `remix/decode` | `qwen3.7-plus` | OFF | 1200 | — | rail |
| **CONVERSE** chat | `chat-runner`, `analyze/[id]/chat`, 4 tool-route follow-ups | `qwen3.7-plus` | OFF | 2000 | — | bound runaway; streamed |
| **TEXT-ANALYZE** (no-video path) | `pipeline.ts` gemini_analysis | `qwen3.7-plus` | OFF | 2000 | — | fixed 2026-06-25 (was unbounded + thinking-unset) |
| **FOLD** (Read audience sim) | `wave3/fold` | `qwen3.7-plus` (video, deaf) | OFF | 8000 | — | 10 personas × N segments; independence directive is the diversity lever. ✅ **validated live 2026-06-26** (5-seg video: 40.9s/90s, diversity 0.31 first-attempt no-retry, 0.56¢; `scripts/fold-validate-r1.ts`) |
| **CALIBRATE** synth | `audience/enrich-signature` (synth call) | `qwen3.7-plus` | **ON** | 6000 | 2000 | persona output (~2.5k) + thinking |
| **SENSOR** read | `qwen/omni-analysis` (Wave 0) | `qwen3.5-omni-flash` | OFF | 8000 | — | audio in; sensor dump |
| **SENSOR** bake-watch | `enrich-signature` (watch call) | `qwen3.5-omni-flash` | OFF | 600 | — | per-video watch notes |
| **APOLLO** video insight | `engine/deepseek` | `qwen3.7-plus` (video, deaf) | **ON** | 3000 | 1500 | the reasoning moat (A/B-tuned) |

### Notes
- All scoring/generation calls keep `temperature: 0` + `seed: QWEN_SEED` (determinism). The **fold**
  baseline is `temperature: 0` too, but auto-perturbs to `FOLD_DIVERSITY_RETRY_TEMP` (0.7) on a
  diversity-collapse retry — the old retry re-ran the identical deterministic call (a no-op).
  Reproducibility is no longer a HARD requirement (2026-06-25): `FOLD_TEMPERATURE` env can raise the base.
- Model env seams: `QWEN_OMNI_MODEL`=omni-flash (sensor), `QWEN_REASONING_MODEL`=3.7-plus (everything),
  `QWEN_APOLLO_MODEL`=3.7-plus (scoped so Apollo can move independently). `QWEN_FAST_MODEL` removed.
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
