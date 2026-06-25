# Engine Model & Latency Policy

> Source-of-truth for **which Qwen model + thinking mode + token budget** every engine LLM
> call uses. Set 2026-06-25 (S3′ latency pass). Goal: **Numen feels snappy while keeping quality.**
> Tune `max_tokens` from logged `usage` after real traffic — values below are measured where noted,
> else headroom estimates.

## The principle

**Thinking (chain-of-thought) is OFF everywhere on the hot path.** We already feed rich input
(KC craft prompts, audience signature/repaint, grounding lines, omni sensor dumps), so CoT is
redundant and its latency isn't worth it. Live-proven on the SIM: thinking-off held identical
verdict bands + better persona voice at **~3–4× lower latency** (~55s → ~15s batched).

**Thinking is ON in exactly two places** — both are judgment-heavy *and* off the snappy per-request path:
- **CALIBRATE** — bake-once (frozen signature on audience creation), not per-Reading → can spend latency for persona quality.
- **APOLLO video insight** — cited, framework-grounded expert judgment over the omni sensor dump (the video moat); video reads are heavy + infrequent, so the CoT tax is acceptable and the §-citation faithfulness is worth it.

## `max_tokens` semantics (DashScope)

`max_tokens` caps **output (completion) tokens**, and **thinking tokens count toward it**
(`engine/deepseek.ts` comment confirms). So:
- **thinking OFF** → `max_tokens` = visible-answer budget.
- **thinking ON** → `max_tokens` = `thinking_budget` + answer (NEVER set tight, or the answer truncates).

**`max_tokens` is a SAFETY RAIL, not a latency lever.** The snappiness win came from thinking-OFF,
not from tight caps — with thinking off, output is bounded by the task itself. Set the rail
**generously (~1.5–2× expected output)**: too tight truncates the JSON mid-stream → the whole
`safeParse` fails → for the batched SIM that silently drops candidates. Unused headroom is free
(you pay actual output, not the cap). The cap only fires on a runaway.

## Policy table

| Role | Call sites | Model | Thinking | max_tokens | thinking_budget | Basis |
|------|-----------|-------|----------|-----------|-----------------|-------|
| **SIMULATE** N=1 | `run-flash-text-mode` (react/script opener) | `qwen3.6-flash` | OFF | 1000 | — | measured ~400–500, ×2 rail |
| **SIMULATE** batch | `run-flash-text-mode` (hooks/ideas/remix, N≤5) | `qwen3.6-flash` | OFF | 3500 | — | measured ~1.9k @ N=5, ×~1.8 rail |
| **GENERATE** hooks | `hooks-runner` | `qwen3.7-plus` | OFF | 1500 | — | measured 587/791, ×~2 rail |
| **GENERATE** ideas | `ideas-runner` | `qwen3.7-plus` | OFF | 2000 | — | est. (richer × 4) |
| **GENERATE** script | `script-runner` | `qwen3.7-plus` | OFF | 2000 | — | est. (beats) |
| **ADAPT** | `remix/adapt` | `qwen3.7-plus` | OFF | 1200 | — | was 1400 w/ thinking |
| **DECODE** | `remix/decode` | `qwen3.7-plus` | OFF | 1200 | — | was 1200 w/ thinking |
| **CONVERSE** chat | `chat-runner`, `analyze/[id]/chat`, 4 tool-route follow-ups | `qwen3.7-plus` | OFF | 2000 (ceiling) | — | bound runaway; streamed |
| **CALIBRATE** synth | `audience/enrich-signature` (synth call) | `qwen3.7-plus` | **ON** | 6000 | 2000 | persona output (~2.5k) + thinking |
| **VIDEO-WATCH** fold | `wave3/fold` | `qwen3.5-omni-flash` | N/A (omni can't think) | 8000 | — | sensor dump (R1) |
| **VIDEO-WATCH** omni | `qwen/omni-analysis` | `qwen3.5-omni-flash` | N/A | 8000 | — | keep |
| **VIDEO-WATCH** scrape | `enrich-signature` (scrape call) | `qwen3.5-omni-flash` | N/A | 600 | — | keep (small) |
| **VIDEO-INSIGHT** Apollo | `engine/deepseek` | `qwen3.7-plus` | **ON** | 3000 | ~1500 | keep — reasoning is the moat |

### Notes
- All scoring/generation calls keep `temperature: 0` + `seed: QWEN_SEED` (determinism). Chat is the
  one exception (`temperature: 0.3`, conversational) — thinking still OFF.
- Model env seams unchanged: `QWEN_FAST_MODEL`=flash, `QWEN_REASONING_MODEL`=3.7-plus,
  `QWEN_OMNI_MODEL`=omni-flash, `QWEN_APOLLO_MODEL`=3.7-plus. Policy sets thinking + budgets per call.
- `enable_thinking: false` is a DashScope extension (apply via the same `@ts-expect-error` pattern as fold).
- The estimated `max_tokens` (ideas/script/adapt/decode/chat) are caps with headroom — verify against
  one real output per site when applied; bump if any truncates.

## Rollout
- **PR-1 (S3′):** SIM batching + generate-rate-rank + SIM flash thinking-off. ✅ done + proven.
- **PR-2 (this policy):** thinking-off on generate/adapt/decode/chat; calibrate→3.7-plus thinking-on;
  set all `max_tokens` budgets. Apollo + omni unchanged.
