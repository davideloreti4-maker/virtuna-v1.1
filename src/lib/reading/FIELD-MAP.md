# Reading Field Map — consumed-vs-dead (DATA-03, ENG-06 / D-12)

The authoritative map of which `PredictionResult` fields the Reading view-model
**consumes** (→ a `ReadingBlock`) and which are **dropped** (dead / excluded /
live-only). This is the F27/F28/F43 resolution: a single document that says, for
every engine output field, *whether it reaches the surface and why*.

> **No `lib/engine/` edits. `ENGINE_VERSION` is unchanged (3.19.0, FROZEN).** This
> phase is presentation-only — the engine still emits every field below; the
> Reading simply selects the value-bearing subset. The "DROP" rulings are
> view-model selection decisions, NOT engine changes.

Both ingestion paths converge on the narrow `CanonicalReading` intersection shape
(`block-types.ts`, D-09): `canonicalFromLive(result)` (live half, reads `result.*`
top-level) and `fromPersistedRow(row)` (persisted half, reads flattened columns +
`variants.{hero,apollo,craft}`). A live-only field that is not on `CanonicalReading`
**physically cannot reach a block** — the prune is a compile-time guarantee.

---

## KEEP — consumed fields → Reading block

Each row: the `PredictionResult` field → the `CanonicalReading` field it normalizes
to → the `ReadingBlock` kind it feeds. "Both paths" = available live AND persisted
(so the DATA-02 deep-equal holds); "derived" = computed identically on both halves.

| PredictionResult field | CanonicalReading field | Reading block | Both paths? |
|------------------------|------------------------|---------------|-------------|
| `overall_score` | `overallScore` | `verdict` (`score`, in-body) + band via `bandFor` | both |
| `confidence` | `confidence` | `verdict` (backfills confidence label only) | both |
| `confidence_label` | `confidenceLabel` | `verdict` (`confidenceLanguage`, D-06 words) | both |
| `anti_virality_gated` | `antiViralityGated` | `verdict` (folds to "Mixed signals", D-07) | both |
| `hero.verdict_line` | `hero.verdict_line` | `verdict` (`why`, 1st in D-05 chain) | both (live top-level → `variants.hero`) |
| `hero.the_one_fix` | `hero.the_one_fix` | `verdict` (`why`, 2nd) + `expert-insight` (`theOneFix`) | both |
| `hero.ceiling` | `hero.ceiling` | `expert-insight` (`ceiling` fallback) | both |
| `factors[]` | `factors` | `drivers` (whole array) + `verdict` (`why`, top `rationale`, 3rd) | both |
| `apollo_reasoning.rewrites` | `apolloReasoning.rewrites` | `expert-insight` (`rewrites`) | both (live top-level → `variants.apollo`) |
| `apollo_reasoning.ceiling_capper` | `apolloReasoning.ceiling_capper` | `expert-insight` (`ceiling`, preferred) | both |
| `hook_decomposition` | `hookDecomposition` | `hook` | both (flattened column) |
| `heatmap` | `heatmap` | `retention` (`segments`, `weighted_curve`) — null → `retention-degraded` | both (column verbatim; NEVER synthesized) |
| `behavioral_predictions.{share,completion,comment,save}_pct` | `behavioralPredictions` | `audience` (absolute rates; per-rate omit) | both |
| `behavioral_predictions.*_percentile` | `behavioralPredictions` | `audience` (`intents[]` qualitative chips) | both |
| `persona_behavioral_aggregate` | `personaBehavioralAggregate` | `persona-read` | both |
| `suggestions[]` | `suggestions` | `fixes` (headline + category + priority) | both |
| `counterfactuals.suggestions[]` | `counterfactuals` | `fixes` (headline + detail + signal_anchor) | both |
| `content_summary` / `overall_impression` | `contentSummary` / `overallImpression` | `content-summary` | both (live top-level → `variants.craft`) |
| `signal_availability` | `signalAvailability` | `analysis-degraded` derive (tier) + `have[]` | both |
| `analysis_unavailable` | `analysisUnavailable` | `analysis-degraded` (`tier:'unavailable'`, D-14) | both (live flag; persisted derives from `signal_availability`) |
| `partial_analysis` | `partialAnalysis` | `analysis-degraded` (`tier:'partial'`, D-14) | both (live flag; persisted derives) |

**Emitted block kinds (the implemented `ReadingBlock` union — NO `audio`):**
`verdict` · `expert-insight` · `hook` · `retention` · `retention-degraded` ·
`audience` · `fixes` · `drivers` · `persona-read` · `content-summary` ·
`analysis-degraded`.

---

## DROP — dead / excluded / live-only fields (no block)

| PredictionResult field | Rationale (why no block) |
|------------------------|--------------------------|
| `predicted_engagement` (`EngagementRange \| null`) | **Live-only by decision (D-09).** Present top-level live, but persisted under a DIFFERENT key (`variants.engagement_range`) — not a both-path field, so it is EXCLUDED from `CanonicalReading`. Including it would break the live∩persisted intersection and the DATA-02 deep-equal. |
| `audio_fingerprint` (`AudioFingerprintResult \| null`) | **Live-only — `audio` block DROPPED (D-09 / Resolved Q1).** `grep audio_fingerprint src/app/api/` → zero matches; it never reaches the persisted row (`buildInsertRow`, `persistCraftToVariants`, `[id]/route` all skip it). A both-path `audio` block is impossible → the kind is dropped, not conditional-rendered. `view-model.test.ts` asserts no `kind:'audio'` is ever emitted. |
| `optimal_post_window` (`OptimalPostWindow \| null`) | **Non-deterministic on replay.** Recomputed at load time from `creator_profiles` (time + DB dependent) — would diverge live-vs-replay. Dropped from the contract entirely (02-03 removed the route recompute). Not one of the D-01 Reading blocks. |
| `rule_score` | **Dead (F43).** Removed from the score blend; emits `null` (was a fake fixed `50`). DB column kept for back-compat; never surfaced. |
| `trend_score` | **Dead (F43).** Removed from the blend; emits `null` (was a fake `0`/`50`). |
| `gemini_score` | **Dead (F43 / D-R1).** Provenance only after Plan 03-04; `null` on video. Not a surfaced number. |
| `ml_score` | **Dead (F43).** ML removed from the blend; emits `null` (was a fake `0`). |
| `behavioral_score` | **Internal blend term.** A weighting input to `overall_score`, not a creator-facing signal — the `verdict`/`drivers`/`audience` blocks own what's true. |
| `reasoning` | **Empty in production (F43).** Always `""` (no consumer) → emitted `null`; nothing to surface. |
| `emotion_arc` | **Not a Reading block (D-02 DROP set).** Timeline valence series with no D-01 home; excluded. |
| `platform_fit` | **Not a Reading block (D-02 DROP set).** Single-platform (TikTok) product — a cross-platform fit score is noise here. |
| `critique` | **Internal self-check (D-02 DROP set).** `confidence_adjustment` already folded into `confidence`; the raw flags are not a creator surface. |
| `retrieval_score` / `retrieval_evidence` | **Not a Reading block (D-02 DROP set).** Corpus-retrieval provenance, not a verdict signal. |
| `matched_trends` | **Not a Reading block (D-02 DROP set).** Trend-enrichment side output; the audio/trend surface is not part of D-01's blocks. |
| `feature_vector` | **Backbone signal, not a surface (D-02 DROP set).** The standardized engine input vector; consumed upstream, never shown. |
| `score_weights` | **Transparency/internal.** Blend weights, not a creator-facing block. |
| `warnings` | **Folded.** Fatal-flaw warnings are absorbed into the gate / `verdict`; no standalone block. |
| `latency_ms` / `cost_cents` / `engine_version` / `*_model` / `input_mode` / `has_video` / telemetry | **Meta (D-02 DROP set).** Operational metadata, never a Reading block. |
| `audio_perceptual_score` / `audio_description` / `audio_signals` | **Audio surface DROPPED (D-09 / Resolved Q1).** Same ruling as `audio_fingerprint` — no both-path audio block. |
| `verbatim` / `emotion_arc` / `video_signals` / `cta_segment` | **Craft internals.** Feed engine reasoning + the craft summary upstream; only the distilled `content_summary` / `overall_impression` surfaces (→ `content-summary`). |
| `weighted_completion_pct` / `weighted_hook_score` / `weighted_top_dropoff_t` / `dropoff_segment_indices` / `anti_virality_reason` | **Internal/secondary.** Derived weighting + gate-reason discriminators; the throne shows judgment (band + why), not these raw weights. |

---

## Provenance & invariants

- **F27/F28/F43 resolved:** every engine output field above is now classified
  KEEP (→ block) or DROP (→ rationale) — no field is silently unhandled.
- **D-09 intersection:** the DROP set's live-only members (`predicted_engagement`,
  `audio_fingerprint`, `optimal_post_window`) are excluded at the `CanonicalReading`
  type boundary, not at render time — a compile-time prune.
- **D-14 honesty:** an individual null field omits its block silently; whole-analysis
  degradation (`analysis_unavailable` / `partial_analysis`) emits the first-class
  `analysis-degraded` block with a `have: string[]` of what IS present. The
  `heatmap` null case degrades to `retention-degraded` — never a synthesized curve.
- **No engine edits:** `ENGINE_VERSION` unchanged; no `lib/engine/` files were
  modified by this phase. The map reflects selection, not engine surgery.
