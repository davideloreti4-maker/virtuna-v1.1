---
quick_id: 20260605-engine-latency-quality-spine-ab
slug: engine-latency-quality-spine-ab
date: 2026-06-05
branch: milestone/engine-opt
status: complete
engine_version: 3.6.0
---

# Engine Latency + Quality — Spine A/B (SUMMARY)

**One-liner:** First-ever measurement of the engine's 115s spine (omni→deepseek),
plus a sweep proving Apollo insight is NOT thinking-budget-bound. Shipped a
quality-verified **116s → ~91s (−22%)** cut. New bottleneck identified: the fold.

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

## Next (carry-forward)

1. **Trim the fold (~54s)** — investigate flash output size / segment count; target ~40s.
2. **Prototype defer-Apollo** — score paints from fold, Apollo backfills; the <45s path (needs omni-flash + fold-trim too).

## Artifacts

- `scripts/apollo-budget-sweep.ts` — reusable budget-sweep harness (omni once → deepseek ×N budgets, dumps insight)
- `run-A-baseline.log`, `run-B-candidate.log`, `apollo-budget-sweep.log` — raw evidence
