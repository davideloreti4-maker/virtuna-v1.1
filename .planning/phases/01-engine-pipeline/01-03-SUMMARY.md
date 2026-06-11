# Plan 01-03 — Apollo / D-R1 / output-contract — SUMMARY (partial — in progress)

> 2026-06-11. 01-03 was re-scoped to absorb D-R1 + Tier-2 output-contract work. This records what
> SHIPPED so far and what is deliberately bundled into 01-04. The deep 3-prompt co-review walk
> (T3.x trims, 9-card creator trim, thinking-budget sweep) — chunk "B" — is NOT yet done.

## Shipped

### D-R1 — Read → pure sensor (commit 6595ec96, ENGINE_VERSION 3.17.0)
The Omni read stopped emitting generic JUDGMENT (factors scores/rationale, overall_impression,
content_summary); it is now a pure perception sensor and Apollo is the sole judge. Atomic across
read prompt+assembly, OmniAnalysisZodSchema + GeminiResponseSchema (fields `.optional()`),
deepseek `formatGeminiSignals` (rebuilt as a RICH perception skeleton: hook-modality 0-10 +
production signals + audio reading + emotion curve), gemini_score (`number | null`, null on video),
stage10 (skips gap-check when null), eval-runner (`?? 0`), impact-score board prop (nullable),
version bump. Decisions: rich skeleton · stop-compute/keep-column-nullable · D-R1-first.
PRESERVED the "expert TikTok content analyst" substring (3 test mocks detect omni by it).
1073 engine/board tests green. Full detail: [[dr1-read-pure-sensor-coordinated]] memory.

### F26 — stop asking Apollo for composite_score (commit fe74635f, no version bump)
The LLM was asked for composite_score but TS overwrote it with the deterministic rubric-sum of the
6 dimension scores (contract said "it is IGNORED"). Dropped the ask + redundant pre-clamp; schema
`.optional()` (rubric-sum sets the real value post-parse). Output-token savings; composite VALUE
byte-identical → no score shift, no cache bump. 101 Apollo+aggregator tests green.

## Bundled into 01-04 (decided 2026-06-11 — they all touch confidence / final assembly)
- **F24** — drop component_scores on video. Verified safe on the overall blend (video = 0.5·apollo
  + 0.5·fold; behavioral_score from component_scores is UNUSED on video) EXCEPT it still feeds
  `calculateConfidence` (the F22 self-agreement bug). So F24 must land WITH the F22 rebase.
- **F22/F44** — re-base confidence agreement on Apollo-vs-Fold (kill self-agreement). aggregator
  `calculateConfidence` (~291-339). Also fixes F34 (stage10 gap basis, currently skipped on null).
- **Hero block (F37)** — emit first-class `{ verdict_line, ceiling, the_one_fix, go_no_go,
  post_window }`. Materials exist: ceiling←ceiling_capper, the_one_fix←rewrites[0].variant,
  go_no_go←anti_virality, post_window←optimal_post_window, verdict_line←tier+anti_virality_gated.
  Assembly is aggregator work (01-04 per synthesis).

## Still TODO in 01-03 (chunk B — the deep co-review walk, NOT started)
The original 01-03 mandate: step-by-step 3-prompt I/O walk WITH Davide (D-12) — T3.x trim
restore/keep decisions (D-13), 9-card creator-context trim (F6/F27), thinking-budget sweep on
qwen3.7-plus, consumed-vs-dead field map (D-14). Best run as its own fresh co-review session.

## Deferred (other phases)
- decode/remix factorless path returns null on video → viral-remix milestone (not this phase).
- Board re-source of "What drives it" (F32) + impact-score apollo-mislabel → Phase 2.
