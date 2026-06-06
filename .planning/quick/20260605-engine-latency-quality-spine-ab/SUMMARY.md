---
quick_id: 20260605-engine-latency-quality-spine-ab
slug: engine-latency-quality-spine-ab
date: 2026-06-05
branch: milestone/engine-opt
status: complete
engine_version: 3.6.0
---

# Engine Latency + Quality — Spine A/B (SUMMARY)

**One-liner:** First-ever measurement of the engine's 116s spine (omni→deepseek),
a sweep proving Apollo insight is NOT thinking-budget-bound, plus a fold output trim.
Shipped a quality-verified **116s → 87s (−25%)** cut across 3 real measured runs.

## Final measured stack (Run C, ENGINE_VERSION 3.6.0)

omni 36s · **fold 46s** · deepseek 51s (budget 1500) · **E2E 87.1s** · score 67 (within
±4 noise) · factors 5 · personas 10 · critique ✓. No mismatch/Zod/retry/diversity warning.

| Run | Config | E2E | fold | deepseek | score |
|-----|--------|-----|------|----------|-------|
| A baseline | 3.5.0 | 116.2s | 63s | 76s | 70 |
| B candidate | reason-drop + deepseek 2000 | 96.6s | 54s | 59s | 71 |
| C +fold trim | + t_start/t_end drop + deepseek 1500 | 87.1s | 46s | 51s | 67 |
| **D omni-flash** | + qwen3.5-omni-flash (ENGINE_VERSION 3.7.0) | **73.8s** | 57s | 53s | 78 |

**omni-flash A/B (Runs D/E/F):** omni read **36→17s (HALVED)**, ~5× cheaper, substrate held/
improved — easy video: verbatim RICHER (full hook vs truncated), score 78, insight deep;
hard video (weak-hook .mov): score 16 correct flop detection, valid structure. **Shipped as
default** (rollback: `QWEN_OMNI_MODEL=qwen3.5-omni-plus`). Final E2E **116→74s (−36%; −76%
from the original ~312s 5-min engine).**

**<45s verdict (settled):** NOT a tuning problem anymore. With omni at 17s the fold (~50s) +
deepseek (~53s) gate; defer-Apollo lands ~67s. Breaking <45 needs the fold to halve →
**2×5 parallel fold split (conflicts with the 1-call mandate)** OR **progressive painting**
(omni's instant score at ~17s, fold+Apollo refine async — the number shifts). A product-
architecture decision, not tuning.

## What shipped (commit-ready, tests 939/0)

| Change | File | Effect |
|---|---|---|
| Drop fold per-segment `reason` | fold-prompts.ts, fold.ts | dead weight (discarded at serving boundary, rendered nowhere); fold 63→54s, cheaper |
| FOLD_MAX_TOKENS 8000→4000 | fold.ts | tail trim + 90s-timeout headroom |
| Apollo thinking_budget 3000→1500 | deepseek.ts | **the win** — deepseek 76→49s, insight depth held |
| `DEEPSEEK_THINKING_BUDGET` env + override param | deepseek.ts | experimentation knob (used by sweep) |
| `OMNI_MAX_TOKENS` env (default off) | omni-analysis.ts | inert; omni is video-bound not output-bound (cap dropped) |
| ENGINE_VERSION 3.5.0→3.6.0 | version.ts | cache invalidation for the new era |

## Measured evidence (real DashScope, same 5.3MB video)

**Run A (baseline 3.5.0) → Run B (candidate):**
- omni 39→37s · fold 63→54s · deepseek 76→59s (@2000) · **E2E 116.2 → 96.6s**
- OVERALL_SCORE 70→71 (parity ✓) · behavioral 66→69 · gemini 82=82 · factors 5 · personas 10 · critique ✓
- No fold diversity-guard warning · no omni truncation/retry

**Apollo budget sweep (identical omni input, only budget varied):**

| budget | latency | composite | insight depth |
|---|---|---|---|
| 3000 | 76.2s | 78 | 6 §-cited dims + 3 grounded rewrites — rich |
| 2000 | 57.2s | 74 | rich |
| 1500 | 48.7s | 78 | rich |
| 1000 | 44.4s | 82 | arguably sharpest |

→ **Insight depth holds 3000→1000; latency falls ~linearly.** Composite swings 74–82
(provider noise, NOT budget-correlated). Apollo is synthesis over a cached knowledge
prefix → doesn't need deep CoT.

## Key findings

1. **The spine was never measured before this.** omni ~37s (video-bound, NOT output-bound — the omni cap saved only ~2s and may have cut emotion_arc 7→5) + deepseek ~76s.
2. **Apollo thinking budget was buying ~30s of nothing.** 1500 chosen: tucked just under the fold so it's fully hidden, max headroom for hard content; lower buys no E2E.
3. **The bottleneck moved to the FOLD (~54s).** Below deepseek ~54s, the fold gates E2E. fold reason-drop got 63→54s; further fold trimming is the next lever.
4. **Sub-45s confirmed impossible synchronously** (omni alone = 37s). Requires omni→flash + fold-trim + defer-Apollo *together*.

## Deviations / caveats

- 1 sample per config (provider noise ±3–4). Insight *text* depth unambiguous; composite *determinism* would want a 2-run confirm.
- omni cap left in code but OFF by default (near-useless + emotion_arc risk).

## Fold trim (DONE — Run C)

Dropped per-segment `t_start`/`t_end` from the fold output — they only echoed the input
grid 10× (same dead-redundancy as `reason`). Adapter re-attaches timing from `segments[i]`
by index (segment-count guard guarantees alignment). Fold 54→46s, cheaper, output stayed
aligned. NOTE: smoke fold has NO keyframes fed (`measure-pipeline` passes no `analysisId`
→ `readKeyframeUris` returns nulls) — so 46s is text-only; a real authed `/analyze` run
should confirm prod fold latency (filmstrip is async, so keyframes likely aren't ready at
fold time in prod either).

## Next (carry-forward)

1. **Prototype defer-Apollo** — score paints from fold, Apollo backfills; the <45s path.
   Still needs omni→flash (omni alone = 36s, video-bound) + the fold (~46s) to overlap/trim.
2. **2-run determinism confirm** — score drifted 70→71→67 (Apollo composite noise 74–82 on
   identical input); a 2× repeat per config would tighten the parity claim.
3. **Prod fold-latency check** — one authed run to see if keyframes get fed to the fold.

## Artifacts

- `scripts/apollo-budget-sweep.ts` — reusable budget-sweep harness (omni once → deepseek ×N budgets, dumps insight)
- `run-A-baseline.log`, `run-B-candidate.log`, `apollo-budget-sweep.log` — raw evidence
