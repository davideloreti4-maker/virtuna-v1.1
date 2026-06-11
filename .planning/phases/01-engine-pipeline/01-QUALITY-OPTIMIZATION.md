# Phase 1 — Quality Optimization Plan (3-stage, post-model-swaps)

> Session handoff (2026-06-11). Captures the model decisions made this session + the
> quality-first analysis across the 3 stages. Consume this when executing 01-02/03/04.
> Companion to 01-SYNTHESIS.md (fix-plan) + 01-WALKTHROUGH-LOG.md (flags F1–F47).

## Locked model stack (shipped this session)
| Stage | Model | Settings | Version |
|-------|-------|----------|---------|
| Read | `qwen3.5-omni-flash` | temp 0, seed 7, json_object, **NO max_tokens** (F47), 60s timeout, retries=1 | unchanged |
| Fold | `qwen3.5-omni-flash` | temp 0, seed 7, json_object, max_tokens 4000, thinking OFF (dead branch F17), 90s timeout, **NO retry** (F18) | 3.16.0 |
| Apollo | `qwen3.7-plus` (scoped `QWEN_APOLLO_MODEL`) | temp 0, seed 7, json_object, max_tokens 3000, **thinking ON budget 1500** (tuned for 3.6, not 3.7), 120s timeout, retries=2 + breaker | 3.15.0 |

Rollbacks: `FOLD_MODEL=omni-plus`, `QWEN_APOLLO_MODEL=qwen3.6-plus`. Read flash-vs-plus (D-10/F8) = **CLOSED, keep flash.**

## The unlock: ~50s latency surplus → reinvest in quality/robustness
E2E ~113s → **~59s** (Read ~13s serial → max(Fold ~8s, Apollo ~46s)). Apollo is now the gate; fold is 8s.
**Consequence:** fold retries are nearly free; Apollo has thinking headroom. Shift from "cut latency" to "spend on quality + trust."

## Per-stage quality + robustness work (prioritized)

### READ (01-02) — substrate; silent failures poison everything downstream
- **F47 (HIGH)** — set `OMNI_MAX_TOKENS` (~8000; surplus allows) → stop long-video output truncation → silent total-read failure. (Ashton Hall 79s clip repro.)
- **F46 (HIGH)** — speech-derived fields (`hook_decomposition.first_words_speech_score` etc.) null on NO-SPEECH videos → Zod rejects whole read. Make nullable (mirror D-A2's audio-field nulling for slideshow/b_roll/action).
- **F9 (MED)** — bounded retry on EMPTY critical fields (empty emotion_arc / null hook_verbatim), not just parse/Zod fail; + drift telemetry.
- **D-R1 (HIGH)** — drop Read JUDGMENT (`factors[].score`, `overall_impression`, `improvement_tip`) → pure sensor. `gemini_score` dies with it. Frees prompt budget for richer perception. Ripples: Apollo input (01-03), aggregator gemini_score removal (01-04), Stage-10 basis (F34), version bump, board re-source (Phase 2 F32).
- **F16 (LOW)** — loosen `audio_description` min(10). **F15 (LOW)** — reconcile emotion_arc REQUIRED-vs-optional.

### APOLLO (01-03 input + 01-04 confidence) — the moat, biggest quality lever
- §-cite honesty — **DONE** (remap guard + prose discipline, 3.14.0).
- **F27/F6 (HIGH)** — trim Apollo input bloat (content_text + verbatim + segments + omni factor signals + 9-card creator dump) → perception skeleton. Ties to D-R1 (factor rationales in formatGeminiSignals die). 01-03.
- **F22/F44 (HIGH)** — confidence is Apollo-vs-ITSELF (self-agreement, fake trust anchor). Re-base on **Apollo-vs-Fold** (now reliable). 01-04.
- **thinking_budget sweep (MED)** — 1500 was A/B'd on 3.6-plus; re-tune on 3.7 (harness; cheap). Maybe lower (more capable) or spend surplus for depth.
- **F34 (MED)** — Stage-10 critique basis (gemini_score) dies w/ D-R1; re-base apollo-vs-fold or retire. **F28 (LOW)** — consolidate dual contract. **F24/F29** — drop component_scores on video; fix credibility-as-bonus rubric.

### FOLD (01-04) — now cheap+fast, robustness is ~free
- **F18 (HIGH)** — ZERO retry → any hiccup silently switches to apollo-only blend (loses audience half of overall_score). Add ONE bounded retry (8s→16s, ≪90s).
- **F20 (MED)** — segment-count guard all-or-nothing → salvage valid personas.
- **F19 (MED)** — diversity guard warn-only; add retry-nudge below floor (free now).
- **DEFERRED (noted)** — long-video output: 79s→~20 seg → 10×20 may exceed FOLD_MAX_TOKENS=4000 → segment cap (~12–15) OR persona-split. Revisit if a long video's FOLD truncates.
- **F17 (cleanup)** — delete dead FOLD_USE_THINKING/thinking_budget branch.
- calibration watch: flash slightly optimistic on watch% (may inflate audience half); unprovable without ground truth (F40, deferred).

### CROSS-CUTTING (01-04)
- **F7 (HIGH if real)** — verify/fix tiktok rehost delete racing the read (fire-and-forget before models consume signed URL → 404 → silent zeroed read). Move to true post-pipeline finally.
- **F12/F35/F43** — prune dead persisted constants (confidence:1.0, rule_score:50, trend_score:0, ml_score:0, reasoning:"", platform_fit/audio_fingerprint null).
- **F2 (MED)** — video cache key derives from caption → same-caption collision.
- **Determinism** — re-verify 3.7-plus honors seed (determinism gate) — new model.

## Recommended execution sequence
1. **01-02 Read** — F47 + F46 + F9 + D-R1 pure-sensor + F16. (Substrate first; cheapest, highest leverage; locks Read output shape for 01-03.)
2. **01-03 Apollo** — D-R1 input rebuild (F27/F6) + thinking-budget sweep on 3.7 + F28.
3. **01-04 aggregator/fold/trust** — F18/F20/F19 fold robustness + F22 real confidence + F34 + dead-tail prune + F7 verify + persist.

Highest quality-per-effort overall: **Read robustness (F47/F46/F9)** + **real confidence (F22 Apollo-vs-Fold)** — both newly cheap/feasible from the latency surplus + reliable fold.

## Evidence rigs (scripts/, reusable)
- `apollo-cite-harness.ts` — faithful Apollo runtime path (lean prompt + real user message + sighted); §-cite + prose-leak audit. Swap `QWEN_APOLLO_MODEL`/`QWEN_REASONING_MODEL` env to A/B models.
- `fold-audio-ab.ts` — fold model A/B (omni read shared, fires fold per model variant); diversity + drop-off + latency. Robust fence-strip.

## Op note
DashScope hit a 429 quota/billing cap mid-session (intermittent; heavy video reads drain per-minute TPM). Live `/analyze` 429s when capped. Check Alibaba Model Studio billing if validation/prod calls fail.
