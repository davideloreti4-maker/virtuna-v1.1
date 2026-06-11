# Phase 1: Strip to Senses - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Subtractively strip the **fabricated and dead score-machinery** from the engine so it is honest and under the latency cap — **without breaking the live product**. Score stays; its derivation is otherwise **unchanged** (just the dead terms leave the blend). Apollo does not exist yet — this phase only removes; it does not rederive or rewire.

**Honesty principle (corrected during discussion):** A grounded LLM read **is** honest — the 0–100 score (behavioral + gemini LLM opinions) is an honest expert assessment (R5, chess-engine eval), and P5's grounded engagement range (R11) is an honest prediction. What is dishonest is **ungrounded fabrication**: invented numbers and corpus-rank claims with no corpus behind them. We delete the fabrication, not the act of predicting.

**In scope:**
- Delete the **fabricated engagement stats**: the `Math.sin` jitter derivation (`predicted-engagement.ts` + `computePredictedEngagement` in `aggregator.ts`).
- Delete the **"top X%" corpus-percentile labels** (`deepseek.ts` percentile-label framing + the `calibration-baseline.json` percentile dependency) — scoped to the **labels only**, not deepseek's reasoning.
- Move dead machinery to `src/lib/engine/_dormant/`: `ml.ts`, `audio-fingerprint`, `trends`, `wave4/platform-fit`, `stage11-counterfactuals`, the `rules.ts` **semantic** tier (+ their tests).
- Remove the separate `platform_fit` + `rule`-semantic + `stage11` **calls** from `pipeline.ts`.
- Remove the dead keys from the aggregator blend (`SCORE_WEIGHT_KEYS` + availability flags) so the math is explicitly `behavioral + gemini`.
- Delete vestigial stage10 critique flags (they critique the now-gone blend).
- Null-degrade the UI surfaces tied to the removed data (predicted-engagement card, counterfactuals SuggestionsSection, platform_fit verdict input).

**Out of scope (untouched / deferred):**
- **Score rederivation, directional band, Apollo composite** — P3/P5. Score derivation stays as-is on live signals.
- **Grounded engagement rebuild (R11)** — P5. The *concept* and UI shell are KEPT here; only the fake derivation goes.
- **Omni verbatim (R1)** — P2.
- **Remix path** (`mode:'remix'`, `decode.ts`/`adapt.ts`) — not touched; only **verified** intact (R12).
- **Retrieval / similar-videos / `/trending` dashboard** — NOT this phase (that was the superseded pre-Apollo Phase 1, now archived at `.planning/_archive/01-pre-apollo-strip-retrieval-trending/`).
- **`learning/` engine loop, ingestion crons, scrapers** — untouched.

</domain>

<decisions>
## Implementation Decisions

### D1 — Remove only the fabricated stats (engagement + percentile labels)
- **D1.1:** Delete the sine-jitter engagement derivation: `src/lib/engine/predicted-engagement.ts` (client helper) **and** its mirror `computePredictedEngagement` in `aggregator.ts`. Pure fabrication (`Math.sin` seed → fake view/like/comment/share/save counts) — **hard delete**, no dormant.
- **D1.2:** Remove the **"top X%" corpus-percentile labels**: the percentile-label framing in `deepseek.ts:75` (and the `share/comment/save/completion_percentile` "top X%" output framing) + the `calibration-baseline.json` dependency **used only for percentile labels**. Scope this **tightly to the label framing** — do NOT otherwise change deepseek's reasoning/score derivation (deepseek becomes Apollo in P3; this is subtractive only).
- **D1.3:** **KEEP** the `predicted_engagement` field/type in `PredictionResult`, the board "Predicted Performance" card shell, `tiktok-result-card`, `results-panel`, and `simulation-store`. The *concept* and UI survive as discussed — **P5 (R11) repopulates the field grounded** (creator baseline × quality read, as a range). With the jitter gone, the field is **null/absent in P1** → card renders only when present (null → hidden). Nothing fake is shown; nothing useful is ripped out.
- **D1.4:** **KEEP** the score + confidence and their derivation on live signals (behavioral + gemini). Grounded LLM reads are honest — they are not part of the fabrication being removed.

### D2 — Removal style: uniform `_dormant/`, hard-delete only the fabricated
- **D2.1:** Move to `src/lib/engine/_dormant/` (reversible; holds Apollo-corpus seed material; M-restorable): `ml.ts`, `audio-fingerprint.ts`, `trends.ts`, `wave4/platform-fit*`, `stage11-counterfactuals*`, and the **semantic tier** of `rules.ts`. Tests travel with their source into `_dormant/`.
- **D2.2:** `_dormant/` is excluded from `tsconfig.json` and `vitest.config.ts` — it neither compiles nor runs. Mirrors the archived pre-Apollo convention; `src/lib/engine/retrieval-empty.ts` is the existing empty-helper analog.
- **D2.3:** **Hard-delete** (git history is the restore) only the truly fabricated/vestigial: `predicted-engagement.ts` jitter (D1.1) + the vestigial stage10 critique flags.
- **D2.4:** `rules.ts` regex tier is free + deterministic; planner audits whether it stays (harmless, possible Apollo seed) or moves with the semantic tier. Default: keep regex in active tree if any live consumer remains, else dormant the whole module.

### D3 — Blend cut: remove dead keys + prove score safety
- **D3.1:** Remove the dead keys (`ml`, `trends`, `audio`/`audio_fingerprint`, `retrieval`, `platform_fit`) from `SCORE_WEIGHT_KEYS` + the corresponding `SignalAvailability` flags so the weighted math is explicitly `behavioral + gemini`.
- **D3.2:** **Prove it before commit:** assert R8 determinism (temp0+seed → same video twice = identical score), then **measure the pre/post-strip score delta** on a fixed video set via `scripts/measure-pipeline.ts`. Expectation: ~0 (the dead sources were being redistributed-away by `selectWeights`). **Any non-zero shift is the honesty correction** (a 0-valued source should not have been dragging the weighted average) — document it explicitly; do not silently absorb it.
- **D3.3:** Most of `aggregator.ts`'s weight-redistribution / CTA-penalty / calibration scaffolding evaporates with the dead keys — delete what is now unreachable; keep the `behavioral + gemini` path intact.

### D4 — Cut-call UI surfaces + optimal-post
- **D4.1:** stage11 call removed → `counterfactuals` is null. **Hide** the `SuggestionsSection` when null — do **not** surface `FALLBACK_ITEM` as if it were real advice (ungrounded fallback ≠ honest). Keep the component; P3 wires Apollo rewrites into it.
- **D4.2:** platform_fit call removed → `verdict-derive.ts:89` must be null-safe (verdict ignores `platform_fit` when absent).
- **D4.3:** **Keep** `optimal-post.ts` (honest deterministic 0-LLM heuristic, 0 latency cost) — **pending a quick audit** that it is a real heuristic, not fabricated. If arbitrary/fake → dormant it.

### D5 — Reverification checklist (planner bakes in as `[BLOCKING]` tasks / acceptance criteria)
The user explicitly delegated: *"everything you think should be reverified before plan/execution."* Each item below must be a verifiable acceptance criterion or `[BLOCKING]` task — the phase cannot pass verification without them:

1. **Determinism gate wired** (temp0 + seed + maxRetries:0); same video twice → byte-identical score — R8. (Confirm it is actually live, not just intended.)
2. **Pre/post-strip score delta measured** (`scripts/measure-pipeline.ts`); ~0 expected; any shift documented (D3.2).
3. **DB row counts** = 0 for `trending_sounds` / `scraped_videos` / `outcomes` (confirms trends/audio truly dead before dormanting).
4. **Remix path intact** — `mode:'remix'` (`Omni → decode → adapt`) bypasses the score blend; `/api/remix/adapt` still works end-to-end — R12.
5. **`predicted_engagement` null-degrade** — board card / `tiktok-result-card` / `results-panel` / `simulation-store` render cleanly when the field is null/absent (no crash; card hidden).
6. **`counterfactuals` null-degrade** — `SuggestionsSection` hidden when null (no fake fallback advice shown).
7. **`platform_fit` null-safe** — `verdict-derive.ts:89` handles absent platform_fit.
8. **`*_percentile` UI audit** — consumers of the "top X%" strings audited; removing the labels breaks no render.
9. **`_dormant/` exclusion proven** — tsconfig + vitest exclude `**/_dormant/**`; build + tests green after the move; no active-tree import reaches into `_dormant/`.
10. **Import-graph clean before each move** — no active-tree importer remains for any module moved to `_dormant/`; `pipeline.ts` call sites removed first.
11. **`optimal-post.ts` audited honest** (else dormant) — D4.3.
12. **Latency under cap** — post-strip video-mode E2E < 300s, target ≤90s — R6.
13. **Cache key bumped** past `v3.0.0` — outputs change (no more percentile labels / fabricated engagement) → stale cached results would otherwise serve (ENGINE-MAP S0 warning).
14. **stage10 vestigial-flag deletion** orphans no confidence-calc consumer.
15. **Test suite reconciled** — deleted-feature tests travel with source into `_dormant/` (or are deleted with the fabricated code); tests that mock the cut stages are updated to assert post-strip behavior.

### Claude's Discretion (planner decides)
- Exact `_dormant/` directory layout + whether the `rules.ts` regex tier travels (D2.4) — decide from the import graph.
- Whether to add a short `_dormant/README.md` documenting the convention (useful, non-blocking).
- Order of operations (call-site removal → dormant move → blend cut → UI null-degrade → measure) — sequence for green-at-each-step.
- Whether `calibration-baseline.json` is deleted or kept dormant (it may seed P3) — keep dormant if any non-label consumer survives.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope (SSOT)
- `.planning/ENGINE-MAP.md` — the cut-list SSOT; per-station KEEP/CUT/DORMANT verdicts (S0–S19) + the Remix path section
- `.planning/ROADMAP.md` §"Phase 1: Strip to Senses" — phase scope, success criteria (R6/R9/R5), ship-independently note
- `.planning/REQUIREMENTS.md` — R5 (honest expert score), R6 (under cap), R8 (determinism), R9 (honest by deletion), R11 (grounded engagement — P5), R12 (one brain across modes)
- `.planning/STATE.md` §"Decisions locked (2026-06-03)" — keep-the-score + grounded-engagement decisions
- `.planning/VISION.md` — value-over-moat framing

### Codebase maps (orientation)
- `.planning/codebase/ARCHITECTURE.md`, `STRUCTURE.md`, `STACK.md`, `INTEGRATIONS.md`

### Engine — fabrication to delete
- `src/lib/engine/predicted-engagement.ts` — `Math.sin` jitter engagement derivation — **DELETE** (D1.1)
- `src/lib/engine/aggregator.ts` — `computePredictedEngagement` (jitter mirror) DELETE; `SCORE_WEIGHT_KEYS` (line ~90) + `selectWeights` redistribution + calibration scaffolding — blend cut (D3)
- `src/lib/engine/deepseek.ts:75,84-90,320,387-434` — "top X%" percentile-label framing + `calibration-baseline.json` percentile dependency — **REMOVE LABELS ONLY** (D1.2); do not touch reasoning (becomes Apollo P3)

### Engine — dead machinery to dormant
- `src/lib/engine/ml.ts` (602 ln, disabled), `audio-fingerprint.ts` (dead stub), `trends.ts` (empty tables), `wave4/platform-fit*`, `stage11-counterfactuals*`, `rules.ts` (semantic tier)
- `src/lib/engine/stage10-critique.ts` — vestigial flags — **DELETE** with the blend (D2.3)

### Engine — pipeline call sites + score path (KEEP, edit)
- `src/lib/engine/pipeline.ts` — remove imports/calls for `matchAudioFingerprint` (l.23,739), `enrichWithTrends` (l.30,868), `runPlatformFit` (l.42,907,1018,1070), stage11, rule-semantic; keep Omni + deepseek + wave3
- `src/lib/engine/types.ts` — `PredictionResult`, `SCORE_WEIGHTS`, `platform_fit` (l.310,335,422), `predicted_engagement` (l.250 — keep field, null in P1), `mode:'score'|'remix'` (l.157-177 — do not touch)
- `scripts/measure-pipeline.ts` — the E2E latency + score-delta harness (D3.2, reverify #2,#12)

### UI surfaces to null-degrade (KEEP components)
- `src/components/board/verdict/verdict-derive.ts:89` — null-safe `platform_fit` (D4.2)
- `src/components/app/simulation/results-panel.tsx:205-210` + `insights-section.tsx` (`SuggestionsSection`, `FALLBACK_ITEM`) — hide when `counterfactuals` null (D4.1)
- `src/components/app/simulation/tiktok-result-card.tsx`, `src/stores/simulation-store.ts`, `src/components/board/board-constants.ts` — predicted_engagement null-degrade (D1.3, reverify #5)

### Reusable convention reference (archived)
- `.planning/_archive/01-pre-apollo-strip-retrieval-trending/01-CONTEXT.md` — the `_dormant/` move-not-delete + tests-travel-with-source + single empty-helper conventions (D2). Scope there is superseded; only the conventions carry forward.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/lib/engine/retrieval-empty.ts`** — existing empty-result helper; the analog/precedent for the M-restore swap pattern if any cut source needs a synthesized empty input rather than a removed key.
- **`SuggestionsSection` `FALLBACK_ITEM`** (`insights-section.tsx`) — already degrades gracefully; D4.1 changes it to *hide* rather than show fallback.
- **`selectWeights` redistribution** (`aggregator.ts`) — already redistributes absent sources; this is *why* the pre/post score delta is expected ~0 (D3.2). Read it to confirm dead sources are already treated as unavailable.
- **Determinism gate** — temp0+seed (memory `engine-determinism-gate`); the precondition that makes the score-delta measurement trustworthy.

### Established Patterns
- **Stable-system + volatile-user prompt cache** (`deepseek.ts`, `platform-fit.ts`) — when removing percentile labels from deepseek's user message, preserve the cache split.
- **`mode:'score'|'remix'` one-engine switch** (`types.ts`, `pipeline.ts`) — remix shares Omni, runs decode/adapt, bypasses the score blend. The strip must not regress it (reverify #4).
- **Versioned cache key `v3.0.0`** (ENGINE-MAP S0) — any output-changing engine edit MUST bump it (reverify #13).

### Integration Points
- `aggregator.ts` blend math ↔ `pipeline.ts` stage assembly ↔ board verdict/score UI — the cut ripples here; null-degrade UI, prove score identity.
- `pipeline.ts` Promise.all stage assembly — removing platform_fit/stage11/rule-semantic slots changes the awaited set; test fixtures that mock all stages need updating (reverify #15).
- P2 (Omni Verbatim) edits the same `aggregator.ts` null-fallback path (CONTEXT note from prior planning) — keep edits localized to avoid a P1↔P2 merge conflict.

</code_context>

<specifics>
## Specific Ideas

- Canonical example of a "fake stat" to remove (user): **"you're in the top 8%"** — the corpus-percentile label with no live corpus behind it (D1.2).
- The fix isn't "stop predicting" — it's "stop fabricating." Grounded LLM prediction (the score now; the engagement range in P5) is honest and stays/returns.
- Ship P1 independently to `main` (honesty + latency win, no downstream dependency) — merge promptly per CLAUDE.md.

</specifics>

<deferred>
## Deferred Ideas

- **Grounded engagement estimate (R11)** — rebuild `predicted_engagement` from creator baseline × quality read, as a range + confidence → **P5**. P1 keeps the field/UI shell, nulls the data.
- **Score rederivation / Apollo composite / directional confidence (R5)** — **P3/P5**. P1 leaves derivation unchanged on live signals.
- **`_dormant/README.md`** documenting the convention — nice-to-have, planner's discretion.
- **`database.types.ts` cleanup** of retrieval/engagement columns — coordinate with a later schema pass, not P1.
- **Mining `rules.ts` regex + `persona-registry` as Apollo corpus seed** — P3 corpus distillation, not P1 (dormant preserves the material).

</deferred>

---

*Phase: 1-strip-to-senses*
*Context gathered: 2026-06-04*
