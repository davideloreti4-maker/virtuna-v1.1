---
quick_id: 20260605-engine-latency-quality-spine-ab
slug: engine-latency-quality-spine-ab
date: 2026-06-05
branch: milestone/engine-opt
status: complete
---

# Engine Latency + Quality — Spine A/B

## Objective

Cut engine E2E latency **without quality loss** (highest-quality co-equal goal),
and — for the first time — **measure the unmeasured 115s spine** (omni → deepseek).
Pack the L1–L6 audit + the cross-session `segment_reasons` dead-weight finding into
one executable experiment with a fresh baseline A/B.

## Findings that scoped this (from recorded runs)

Current call graph (video_upload, ENGINE_VERSION 3.5.0):

```
omni qwen3.5-omni-plus (~40s, SERIAL, gates all)
  ├─→ deepseek Apollo qwen3.6-plus (~75s ← long pole, the HERO insight)
  └─→ fold qwen3.6-flash (25–62s, HIDDEN under deepseek = FREE)
E2E ≈ omni + max(deepseek, fold) ≈ 115s
```

- **Fold is fully A/B'd** (04-05 referee): score **parity perfect** (fold==10-pass);
  the MISS was a **90s timeout**, not quality. Flash/no-thinking/budget-1000 flip
  recovered diversity (25–62s, score 67–73). Fold is hidden → reason-drop barely
  moves E2E but **buys headroom on the 0.1s-margin 90s timeout** (reliability win).
- **The spine (omni + deepseek) has ZERO recorded A/B.** Every "Lx saves ~30s"
  number was speculation. This experiment measures it.
- **`segment_reasons` is dead weight** (cross-session trace): fold emits `reason`
  → packed at weighted-aggregator.ts:236 → **hardcoded `{}` at the serving boundary**
  (analysis/[id]/route.ts) → **rendered nowhere**. Pure cost + the dominant
  variable-length output driving the 25↔62s fold jitter. Safe to drop.
- **Personas-into-omni REJECTED for latency** (user-confirmed): fold is already
  free/parallel; merging it onto the gating omni call is latency-NEGATIVE (~+15s).
  Cost/reliability-positive but wrong objective. The latency-relevant merge would
  be omni+deepseek (Arch B) — deferred, own A/B.
- **Defer-Apollo: NOT this round** (user). Keeps the hero in first paint →
  sub-45s synchronous is out of reach this round; honest target = measure + bank.

## Decisions (locked via discussion)

| # | Decision |
|---|----------|
| D1 | Spine A/B as designed; fold stays a separate call |
| D2 | deepseek thinking_budget 3000→**2000** gentle (hero — small probe, not aggressive) |
| D3 | Fresh **pristine** baseline (Run A) on HEAD, then candidate (Run B) |
| D4 | Defer-Apollo deferred; omni-plus stays (flash unvalidated for segments/verbatim) |
| D5 | Quality bar = referee metrics: score parity ≤5, fold diversity ≥0.8× avgCurveRange, + **manual Apollo-insight eyeball** (no metric captures insight depth) |

## Changes

**Permanent (verified-safe, ship regardless):**
1. **Drop fold `reason`** — fold-prompts.ts: remove from output spec + schema.
   Keep `segment_reasons` plumbing (weighted-aggregator.ts already yields `{}` when
   absent — graceful, nothing downstream breaks).
2. **FOLD_MAX_TOKENS** default **8000→4000** (fold.ts) — tail trim + 90s headroom.

**Env-gated spine levers (default = current behaviour → Run A pristine):**
3. **`DEEPSEEK_THINKING_BUDGET`** (deepseek.ts) default 3000; Run B = 2000.
4. **`OMNI_MAX_TOKENS`** (omni-analysis.ts) default unset/uncapped; Run B = ~6500.

## Smoke design

- Same video both runs: `~/Downloads/TikTok Video Downloader.mp4` (5.3MB).
- Harness: `scripts/measure-pipeline.ts` (greppable per-stage + OVERALL_SCORE line).
- **Run A (baseline):** pristine HEAD, no spine env → capture.
- **Run B (candidate):** `DEEPSEEK_THINKING_BUDGET=2000 OMNI_MAX_TOKENS=6500` + the
  permanent fold fixes → capture.
- **Compare:** omni / deepseek / fold per-stage wall; E2E; OVERALL_SCORE parity (≤5);
  fold diversity; eyeball Apollo rewrites + 6 dimensions (hero quality).

## Success criteria

- [ ] Baseline (Run A) captured — first hard per-stage spine numbers on record
- [ ] Candidate (Run B) captured
- [ ] Score parity |A−B| ≤ 5 AND fold diversity held (≥0.8×)
- [ ] Apollo insight quality not visibly degraded (manual)
- [ ] Net E2E delta quantified; decision recorded on whether to ship spine cuts
- [ ] Build + engine tests green

## Out of scope

omni+deepseek collapse (Arch B), defer-Apollo, omni→flash, L4 split — all deferred
pending the spine numbers this experiment produces.
