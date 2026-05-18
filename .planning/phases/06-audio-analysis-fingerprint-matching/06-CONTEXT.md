# Phase 6: Audio Analysis + Fingerprint Matching - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Fill the `audio_analysis` no-op stage (`src/lib/engine/pipeline.ts:375`) with real audio signals and replace today's Jaro-Winkler caption-to-`trending_sounds.sound_name` fuzzy match (`src/lib/engine/trends.ts`) with an actual audio-fingerprint match. Five coupled deliverables:

1. **Audio sub-scores produced by extending the existing `gemini_video_analysis` prompt** — voice_clarity, audio_hook_first_2s, music/silence/voiceover ratio. Zero extra LLM call (Gemini's video API natively processes the audio stream from the same `fileUri`). The aggregator extracts these fields from the Gemini response directly. No latency added; no new Gemini cost.

2. **Audio description string + embedding for fingerprint matching** — same extended `gemini_video_analysis` prompt also emits an `audio_description` string (e.g., "upbeat hip-hop track, sampled vocal hook 'oh la la', 90 BPM, female lead"). That description is embedded via Gemini text embedding API. The uploaded video's audio_embedding is compared against precomputed embeddings on `trending_sounds.audio_embedding` (pgvector cosine similarity) to identify which trending sound — if any — is playing.

3. **`audio_fingerprint` stage in pipeline.ts** — the existing `audio_analysis` stage is renamed to `audio_fingerprint`. It owns ONLY the pgvector match against trending_sounds. Runs in Wave 1, parallel with `gemini_video_analysis` / `creator_context` / `rule_scoring`. Stage event survives for the M2 live signal dashboard.

4. **Audio enters the aggregator as a new top-level signal** — alongside behavioral / gemini / ml / rules / trends. Initial weight ~0.05-0.10 (planner picks final value, leaning low for v3.0-dev; Phase 10 ML audit tunes). Two sub-components feed it: `audio_perceptual_score` (formula adapts to available sub-scores per content type) + `audio_fingerprint_boost` (phase-aware: emerging +15, rising +10, peak +5, declining -5 applied to audio_score only).

5. **Backfill + cron extension to populate trending_sounds embeddings** — one-time backfill script iterates existing `trending_sounds` rows, fetches `sound_url` → Gemini description → text embedding → store. Existing `calculate-trends` cron is extended to compute embedding on each newly-upserted sound. ~$0.025/day cost ceiling at ~50 sounds/day.

Plus three coupled changes:

6. **HOOK-02 ownership moves from Phase 5 to Phase 6** — REQUIREMENTS traceability updated. Phase 5's hook decomp will CONSUME `audio_hook_first_2s` rather than produce it. Phase 5 stays parallel with Phase 6 in Wave 4; Phase 5's HOOK-05 (weakest-modality identification) handles null audio gracefully and widens from 3-way to 4-way once Phase 6 ships.

7. **Migration: pgvector extension + new columns on trending_sounds** — `audio_embedding vector` column + `audio_description text` column + ivfflat index. Phase 6 owns the pgvector setup; Phase 8 reuses for `competitor_videos.embedding` later (Phase 8 does NOT need to install pgvector again).

8. **`signal_availability` JSONB extended with `audio` and `audio_fingerprint` keys** — per Phase 3 D-07's forward-compat shape. Persisted to `analysis_results.signal_availability` automatically by the existing aggregator code path; no migration needed (column already exists from Phase 3).

**Out of scope this phase:**
- Phase 5 hook segment width change (0-3s → 0-5s flagged during this discussion) — deferred to Phase 5's discuss-phase.
- ML retrain or Platt calibration against the new audio signal — Phase 10 (ML Audit + Calibration + Aggregator Extension).
- Per-platform audio weight tuning (TikTok favors trending sound use, IG less so) — Phase 9 (Platform Algo Fit) consumes the audio signal but Phase 6 stays platform-agnostic.
- Real audio waveform fingerprinting (Chromaprint / AcoustID) — explicitly rejected per D-F0; revisit only if Gemini-description embedding proves insufficient on the Phase 12 benchmark.
- Audio sentiment / emotion arc / music genre classification — not in REQUIREMENTS AUDIO-01..06; defer.
- UI surfacing of audio result fields (which fields show on the result card, retention curve overlay) — Intelligence Surface (M2) milestone.

</domain>

<decisions>
## Implementation Decisions

### Audio Source Mechanism

- **D-A1: Audio signals come from extending the existing `gemini_video_analysis` prompt.** Gemini natively processes audio inside the video stream (vision + audio + speech in one call). Phase 6 widens the response schema with new audio fields; the `audio_fingerprint` stage extracts them from the Gemini result in the aggregator. Zero extra Gemini calls. Zero added latency by design — Phase 6 SC#5's "<2s added latency" is satisfied trivially. User chose this over a dedicated audio-only Gemini Flash call ($0.001/call) and over a ffmpeg-extract pipeline (new binary dep + serverless cold-start risk). Locked answer to "are we analyzing audio in combination with the video?" — yes.

- **D-A2: Audio scoring is content-type-aware.** Phase 4's content-type detector (talking_head / b_roll / slideshow / action / tutorial / vlog / other) gates which audio sub-scores fire:
  - `talking_head` / `tutorial` / `vlog` → full audio scoring. voice_clarity (0-10), audio_hook_first_2s (0-10), music/silence/voiceover ratio, audio_description.
  - `slideshow` / `b_roll` / `action` → voice_clarity = null, audio_hook_first_2s = null. music/silence/voiceover ratio + audio_description still emit.
  - `other` → full audio scoring (passthrough; if it has voice, score it).
  Won't punish slideshows for lack of voice; voice-heavy formats get richer audio scoring.

- **D-A3: silence/voiceover/music ratio shape = three percentages summing to 1.0.** `{ silence: 0.05, voiceover: 0.70, music: 0.25 }`. Aggregator-friendly (weights can multiply individual components). Phase 10 ML audit reads cleanly. Supports later M2 UI as a small horizontal bar viz. Rejected alternatives: "dominant category + confidence" (loses information) and "timeline segments" (Gemini Flash hallucinates boundaries unreliably).

- **D-A4: `audio_analysis` stage renamed to `audio_fingerprint`.** The renamed stage owns fingerprint match ONLY (the pgvector lookup against trending_sounds). Perceptual scores (voice_clarity, audio_hook, ratios, audio_description) are extracted from the `gemini_video_analysis` response directly inside the aggregator — no separate "extract" stage. Wave 1 parallelism preserved (audio_fingerprint runs alongside gemini_video_analysis, doesn't sequence after it). SSE event for the renamed stage survives for M2 viz. Claude recommended option 1 + rename over thin-extractor or remove-entirely; user accepted.

### Fingerprint Approach

- **D-F0: Audio fingerprint approach = Gemini-description embedding + pgvector cosine match.** User selected over Chromaprint/AcoustID (external dep, Vercel cold-start risk) and over "defer fingerprinting, keep Jaro-Winkler" and over "Gemini-asked match against name list" (no actual recordings as reference). Chosen approach reuses existing Gemini infrastructure; no new vendor.

- **D-F1: Embed Gemini's `audio_description` text (NOT raw audio waveforms).** Gemini does not expose pure-audio embeddings. The extended `gemini_video_analysis` prompt emits an `audio_description` string. That string is embedded via Gemini text embedding API (verify exact endpoint during research: likely `text-embedding-004` or successor). Trending_sounds rows get their descriptions precomputed by feeding `sound_url` → Gemini → description → embedding → DB. Match by pgvector cosine. Precision is description-quality-bound; researcher should propose a baseline confidence threshold during planning (Phase 12 benchmark validates).

- **D-F2: Phase 6 owns pgvector for `trending_sounds`.** Phase 6's migration installs the pgvector extension + adds `audio_embedding vector(768)` (or whatever dimensionality the Gemini text embedding model returns — researcher confirms) + `audio_description text` + ivfflat index on `audio_embedding`. Phase 8 reuses the pgvector extension for `competitor_videos.embedding` later (Phase 8 does not need its own extension install). No reorder of Wave 4 phase parallelism.

- **D-F3: Fingerprint wins; caption fuzzy match runs only on fallback.** When `signal_availability.audio_fingerprint = true`, `matched_trends` is populated from the fingerprint result (sound + velocity from `trend_phase`). When `signal_availability.audio_fingerprint = false` (Gemini description failed, embedding failed, or no pgvector match above threshold), the existing Jaro-Winkler caption ↔ `sound_name` match in `src/lib/engine/trends.ts` runs as fallback. Single source of truth for `matched_trends`. SC#4 satisfied literally.

- **D-F4: One-time backfill + cron extension for trending_sounds embeddings.** Phase 6 ships TWO mechanisms:
  - One-time backfill script (probably `scripts/backfill-trending-sound-embeddings.ts`) iterates every existing `trending_sounds` row, fetches `sound_url` → Gemini description → embed → upsert.
  - `src/app/api/cron/calculate-trends/route.ts` is extended so every newly-upserted sound also gets its embedding computed inline (after the existing upsert path).
  Cost ceiling ~$0.0005/sound × ~50 sounds/day = ~$0.025/day. Negligible. Keeps fingerprint useful as new trending sounds emerge weekly.

### Aggregator Weight + Boundary

- **D-G1: Audio = new standalone signal in aggregator.** Added alongside behavioral / gemini / ml / rules / trends. Initial weight ~0.05-0.10 (planner picks specific value; bias low for v3.0-dev). Two sub-components feed the audio signal:
  - `audio_perceptual_score` — derived from extended gemini_video_analysis output (voice_clarity, audio_hook_first_2s, ratio scoring), formula adapts to content type per D-G3 below.
  - `audio_fingerprint_boost` — phase-aware delta applied to audio_score (see D-G2).
  `SignalAvailability` interface gains two new boolean keys: `audio` (true when any audio sub-score is present) + `audio_fingerprint` (true when pgvector returned a match above threshold). Phase 10 ML audit will tune the final weight against corpus benchmark.

- **D-G2: Fingerprint match = phase-aware boost on the audio signal only (NOT on overall score).** When `audio_fingerprint` returns a match, `audio_score` receives:
  - Emerging sound → +15
  - Rising → +10
  - Peak → +5
  - Declining → -5 (mild penalty for using a sound past its prime)
  - No match → 0 (no adjustment)
  The boosted `audio_score` then enters the weighted average with its 0.05-0.10 weight. Final-score impact is small but directionally meaningful. Avoids double-counting with the `trends` signal (which still scores hashtag relevance + scraped_videos similarity).

- **D-G3: `audio_perceptual_score` formula adapts to available sub-scores.**
  - `talking_head` / `tutorial` / `vlog`: voice-driven formula → average of voice_clarity (0-10), audio_hook_first_2s (0-10), ratio_scoring_voice_heavy (favors high voiceover %), with content-type-specific weight tuning Claude's discretion.
  - `slideshow` / `b_roll` / `action`: ambient-driven formula → ratio_scoring_music_heavy (favors high music %) + audio_description-based quality inference. voice_clarity / audio_hook ignored (null).
  - `other`: balanced formula across all available sub-scores.
  Each formula normalizes to 0-100 BEFORE the fingerprint boost in D-G2 applies, so the boost's magnitude is comparable across content types.

- **D-G4: `FeatureVector.audioTrendingMatch` stays — populated from fingerprint when available.** Today this field (in `src/lib/engine/types.ts`) is populated from the Wave 2 Jaro-Winkler match score (0-1) and fed to ML. With Phase 6:
  - When `signal_availability.audio_fingerprint = true` → populate from pgvector cosine similarity (0-1).
  - When false → fall back to Jaro-Winkler score.
  Field semantics unchanged (still 0-1 match strength). ML feature vector shape unchanged; ML never sees the swap. Zero rewrite of ML feature assembly code.

### HOOK-02 Ownership

- **D-H1: Phase 6 owns HOOK-02 (audio hook score for first 2s).** REQUIREMENTS.md traceability updates: HOOK-02 moves from Phase 5's "Multi-Modal Hook Decomposition" section to Phase 6's "Audio Analysis" section. Phase 5's hook decomp CONSUMES `audio_hook_first_2s` from Phase 6's output; it does not produce it. Audio expertise concentrated in Phase 6; no duplicate Gemini work (Phase 5's Pro hook call doesn't need to also score audio).

- **D-H2: Audio hook window stays 0-2s.** Phase 5's hook segment widens 0-3s → 0-5s per user note during this discussion (Phase 5 scope — see deferred). Phase 6's audio_hook window stays narrower at 0-2s because audio impact is a fast-attention-grab phenomenon — the viewer's audio-on-or-off decision happens in the first ~2 seconds. Field name: `audio_hook_first_2s` for clarity. Output: 0-10 integer score.

- **D-H3: Phase 5 and Phase 6 stay parallel in Wave 4.** No new strict dependency from Phase 5 → Phase 6. Phase 5's HOOK-05 (weakest-modality identification) handles null audio sub-score gracefully:
  - When Phase 6 hasn't shipped yet → audio_hook_first_2s is null → HOOK-05 picks min over 3 modalities (visual, text, speech).
  - When Phase 6 ships → HOOK-05 widens to 4-way comparison (visual, audio, text, speech).
  ROADMAP wave structure unchanged: Wave 4 stays P5 ∥ P6 ∥ P7 ∥ P8.

### Claude's Discretion

User self-identified as non-technical (carried from Phase 2 D-15 via Phase 3 D-21). All purely technical / implementation-mechanic choices are Claude's discretion:

- **Exact audio fields in extended `gemini_video_analysis` response schema** — researcher proposes; planner locks. Recommended additions: `voice_clarity_0_10`, `audio_hook_first_2s_0_10`, `silence_ratio`, `voiceover_ratio`, `music_ratio` (must sum to 1.0), `audio_description` (50-150 char string). Prompt engineering to ensure Gemini Flash-lite reliably emits these — researcher's job.
- **Gemini text embedding model + dimensionality** — verify whether `text-embedding-004` (768-dim), Gemini 3 embedding, or another endpoint; pgvector column dimension matches. Researcher locks.
- **pgvector index parameters** — ivfflat lists count, probes. Researcher proposes based on expected `trending_sounds` row count (~hundreds, not millions).
- **Cosine similarity threshold for "this is a match"** — researcher proposes a baseline (suggested 0.80-0.85 for Gemini description embeddings; varies by model). Phase 12 benchmark validates; Phase 10 may revise.
- **Initial audio signal weight value (0.05 vs 0.07 vs 0.10)** — planner picks based on conservatism vs measurable contribution. Phase 10 ML audit re-tunes after corpus run.
- **`audio_perceptual_score` formula coefficients** within D-G3's content-type-aware structure — planner picks specific weights per sub-score per content type. Phase 10 ML audit refines.
- **Stage event payload shape for `audio_fingerprint`** — matches Phase 3's D-02 `StageEvent` discriminated union. Planner locks the specific `stage` name string ("audio_fingerprint"), wave designator (1), and cost_cents reporting (text embedding call cost).
- **Backfill script idempotency / batching** — likely process N rows at a time with `ON CONFLICT (id) DO UPDATE` semantics. Resumable on failure.
- **Migration scope** — single migration covering pgvector extension + audio_embedding + audio_description + ivfflat index + signal_availability key additions (signal_availability column already exists from Phase 3, just new keys persisted). Planner picks single vs split.
- **Failure semantics when extended gemini_video_analysis returns video fields but audio fields missing/invalid** — graceful degradation per HARD-03: `signal_availability.audio = false`, warning emitted, audio signal weight redistributes to other signals via existing `selectWeights` math. Planner confirms.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` §"Phase 6: Audio Analysis + Fingerprint Matching" — phase goal, dependencies (Phase 3), 5 success criteria.
- `.planning/REQUIREMENTS.md` §"Audio Analysis" (AUDIO-01..06) — 6 requirements covering perceptual scoring, fingerprint match, velocity detection.
- `.planning/REQUIREMENTS.md` §"Multi-Modal Hook Decomposition" — HOOK-02 lives here today; Phase 6 plan must move HOOK-02 to the Audio Analysis section per D-H1.
- `.planning/REQUIREMENTS.md` §"Aggregator Extension" (AGG-01..06) — `SignalAvailability` extends with audio + audio_fingerprint keys per D-G1.
- `.planning/PROJECT.md` §"Current Milestone: Engine Foundation" — milestone-level decisions (additive-only constraint, persona allocation, engine v3.0 versioning).
- `.planning/STATE.md` — current progress, Phase 5 not yet planned, Wave 4 parallel intent.

### Prior Phase Context (Carry-Forward — MANDATORY reading)
- `.planning/phases/03-pipeline-infrastructure/03-CONTEXT.md` — Phase 3 D-01 (fine-grained stage events per `timed()` boundary — `audio_fingerprint` stage emits start+end). D-02 (`StageEvent` discriminated union — Phase 6's stage events follow this shape). D-04 (existing tests must continue passing without modification — additive only). D-05/D-06 (`ENGINE_VERSION = "3.0.0-dev"`, lives in `src/lib/engine/version.ts`). D-07 (`signal_availability` JSONB column on `analysis_results` — Phase 6 adds `audio` + `audio_fingerprint` keys; column already exists, no migration needed for the column itself). D-15 (eval harness bypasses cache — Phase 6's plans MUST keep that contract). D-19 (stub return types in `src/lib/engine/types.ts` — Phase 6 fills the actual `AudioResult` / `AudioFingerprintResult` shapes; types already scaffolded).
- `.planning/phases/04-wave-0-content-type-niche-detection/04-CONTEXT.md` — Phase 4 D-09 (content_type 7-category vocabulary: talking_head / b_roll / slideshow / action / tutorial / vlog / other — these are the categories Phase 6's D-A2 keys off). Phase 4 D-12 (content-type × signal weight matrix — Phase 6 does NOT extend this matrix; the audio signal handles content-type adaptivity via D-G3 formula switching, NOT a new matrix column). Phase 4 D-03 (DeepSeek migrated to v4-flash; irrelevant to Phase 6 but confirms the model landscape).
- `.planning/phases/01-training-corpus-eval-foundation/01-CONTEXT.md` — Phase 1 D-21 (engine_version field; Phase 6 contributes a record-shape with the new audio fields). Eval harness location: `src/lib/engine/corpus/` MUST bypass cache when running benchmarks.
- `.planning/phases/02-creator-profile-9-card-interview/02-CONTEXT.md` — Phase 2 D-10 (niche taxonomy hardcoded TS module). Not Phase-6-relevant directly, but `CreatorContext` enrichment flows into every prediction including audio's containing PredictionResult.

### Codebase Maps
- `.planning/codebase/ARCHITECTURE.md` — prediction pipeline structure (10 stages, wave-parallel, `timed()` wrapper, graceful degradation). Audio stage's place in Wave 1.
- `.planning/codebase/INTEGRATIONS.md` — Gemini AI client (`@google/genai` v1.41.0). DeepSeek not directly relevant to Phase 6. Supabase + pgvector extension management.
- `.planning/codebase/STACK.md` — Vitest 80% threshold; SSE in Vercel serverless context; Gemini Flash-lite cost characteristics.

### Existing Engine Code (to extend / instrument)
- `src/lib/engine/pipeline.ts` — `runPredictionPipeline()`. Line 375: existing no-op `audio_analysis` stage to RENAME to `audio_fingerprint` per D-A4. Lines 417-420: Wave 1 `Promise.all` includes `audioPromise` — keep the slot, fill with real fingerprint work.
- `src/lib/engine/gemini.ts` — `analyzeVideoWithGemini`. The video analysis prompt + response schema (`VIDEO_RESPONSE_SCHEMA`) lives here; Phase 6's plan extends both with audio fields (D-A1). The fileUri reuse pattern (line 478) is the model for Phase 6.
- `src/lib/engine/aggregator.ts` — `aggregateScores`. Lines 211-212: existing `audioTrendingMatch` field populated from `trendEnrichment.matched_trends.length > 0`. Phase 6's D-G4 changes this to populate from fingerprint result when available. Lines 330-349: `SignalAvailability` construction — Phase 6 adds `audio` + `audio_fingerprint` keys here.
- `src/lib/engine/trends.ts` — Wave 2 trend enrichment. Lines 37-83: Jaro-Winkler match loop against `trending_sounds.sound_name`. Phase 6's D-F3 gates this with `if (!signal_availability.audio_fingerprint)`.
- `src/lib/engine/types.ts` — type definitions. Phase 6 adds: `AudioPerceptualResult` / `AudioFingerprintResult` types; extends `PredictionResult` with audio fields; extends `SignalAvailability` interface with `audio` and `audio_fingerprint` booleans (matches D-07 shape from Phase 3).
- `src/lib/engine/wave0/content-type-detector.ts` — pattern reference for new Gemini-based stage code (Flash + JSON response schema + `videoMetadata` + token-cost telemetry). Phase 6's prompt-extension work in `gemini.ts` follows this pattern.
- `src/app/api/cron/calculate-trends/route.ts` — Phase 6 extends this cron to compute embedding inline when upserting each `trending_sounds` row (D-F4 second mechanism).
- `src/types/database.types.ts` — Supabase generated types. Lines 1242-1289: existing `trending_sounds` schema (no embedding column yet). Phase 6 migration adds `audio_embedding vector(N)` + `audio_description text`; types regenerated post-migration.

### Phase 6 Outputs (will be created)
- `supabase/migrations/<timestamp>_phase6_audio_fingerprint.sql` — pgvector extension install + trending_sounds.audio_embedding + audio_description columns + ivfflat index.
- `scripts/backfill-trending-sound-embeddings.ts` — one-time backfill script (D-F4 first mechanism).
- Prompt + schema extensions in `src/lib/engine/gemini.ts` (or extracted to a sibling module — planner picks) for audio fields in the video analysis response.
- `src/lib/engine/audio-fingerprint.ts` — pgvector match logic + threshold handling. Replaces the no-op body in pipeline.ts.
- Extensions to `src/lib/engine/aggregator.ts` — audio signal weight + `audio_perceptual_score` formula per D-G3 + fingerprint boost per D-G2 + SignalAvailability keys per D-G1.
- Test coverage per Vitest 80% threshold: audio extraction from Gemini response, fingerprint match logic, content-type-aware formula switching, aggregator weight redistribution with audio present/absent.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Gemini Files API + `videoMetadata` pattern** (`src/lib/engine/wave0/content-type-detector.ts` lines 148-168) — the exact prototype for any new Gemini call. Phase 6 doesn't add a new Gemini call (D-A1) but uses the same `fileUri` reuse + response schema validation idiom inside the extended `gemini_video_analysis` prompt.
- **`createCache<T>(ttlMs)` factory** (`src/lib/cache.ts`) — pattern for caching the `trending_sounds` top-50 list inside `audio_fingerprint` stage if needed (today's `trends.ts` already uses this; Phase 6 reuses).
- **Existing `audio_analysis` stage scaffolding** (`src/lib/engine/pipeline.ts:375`) — already wired to Wave 1 with `timed()` boundary + `onStageEvent` forwarding. Phase 6 just renames + fills the body. No new pipeline wiring needed.
- **Existing `SignalAvailability` interface in `src/lib/engine/types.ts`** — Phase 3's D-07 design accommodated `audio` + `audio_fingerprint` as future keys. Adding them is a pure type widening.
- **Existing `trends.ts` Jaro-Winkler loop** (`src/lib/engine/trends.ts` lines 37-83) — stays as the fallback path per D-F3; Phase 6 just wraps it in an availability guard.
- **`calculate-trends` cron** (`src/app/api/cron/calculate-trends/route.ts` lines 130-145) — existing upsert batching pattern; Phase 6 extends with inline embedding computation.

### Established Patterns
- **`timed()` wrapper at every pipeline boundary** — Phase 6's `audio_fingerprint` stage continues this (the renamed stage emits its own start/end events per Phase 3 D-01).
- **JSON response schema validation via Zod** — Phase 6's audio fields appended to the existing video response schema follow the same Zod pattern (e.g., `Wave0ContentTypeResultSchema.safeParse(...)` from wave0/content-type-detector.ts).
- **Graceful degradation in engine stages** (Phase 1 / Phase 3 D-04) — `audio_fingerprint` returns null + warning when pgvector match fails; perceptual fields return null when Gemini omits them. Never throws fatally.
- **`createServiceClient()` for DB writes** — backfill script uses this for `trending_sounds` upserts (bypasses RLS appropriately).
- **`createLogger({ module: "audio_fingerprint" })`** — new module logs under its own name; matches established logger pattern.
- **Vitest 80% coverage threshold** — `audio-fingerprint.ts`, aggregator extensions, backfill script all need test coverage.
- **Migration filename pattern** (`supabase/migrations/<timestamp>_<description>.sql`) — single timestamp prefix, descriptive slug, ALTER TABLE idiom.

### Integration Points
- **Pipeline ⟷ extended `gemini_video_analysis`** — the `gemini.ts` response object grows new audio fields. Pipeline returns the same Gemini result downstream. Aggregator dereferences audio fields directly from Gemini result (no separate audio extraction stage).
- **Pipeline ⟷ `audio_fingerprint` stage (renamed)** — Wave 1 sibling of `gemini_video_analysis`. Runs in parallel. Reads `audio_description` from the extended Gemini result (via an awaited inner pattern — planner picks: either pass Gemini's resolved promise into audio_fingerprint, or audio_fingerprint computes its own embedding from whatever input is available at Wave-1 start). Recommended: audio_fingerprint awaits the audio_description from a shared promise that Gemini resolves, OR runs its own minimal Gemini text-description call if architectural constraints prevent the share. Researcher locks.
- **Aggregator ⟷ `audio_perceptual_score`** — derived from extended Gemini result fields + content-type from Phase 4's Wave 0 detector. Plus optional fingerprint_boost from `audio_fingerprint` result. Enters weighted average with audio weight 0.05-0.10.
- **Aggregator ⟷ `SignalAvailability.audio` + `audio_fingerprint`** — persists to existing `signal_availability` JSONB column on `analysis_results` (column exists from Phase 3; Phase 6 just emits new keys).
- **`audio_fingerprint` stage ⟷ pgvector** — Supabase RPC or direct SQL via `supabase.rpc('match_trending_sound_by_audio', { query_embedding, threshold, limit })`. Researcher decides RPC function approach vs inline raw SQL.
- **`calculate-trends` cron ⟷ embedding computation** — after each batch upsert (line 138), call Gemini description + text-embedding for newly-upserted rows. Failure path: warn + skip embedding (sound row still upserts; fingerprint just won't match it until next cron run).
- **`FeatureVector.audioTrendingMatch` ⟷ ML feature assembly** — populated from fingerprint cosine similarity when available, fuzzy match score otherwise. Backward-compatible with ML's existing feature vector shape.

### NO changes to (preserved by additive-only constraint per PROJECT.md)
- `src/lib/engine/aggregator.ts` weight tables for existing signals (behavioral/gemini/ml/rules/trends) — Phase 6 only ADDS the audio weight; doesn't redistribute existing weights. `selectWeights` math handles availability-driven redistribution.
- `src/lib/engine/aggregator.ts` content-type weight matrix (Phase 4 D-12) — Phase 6 does NOT extend this matrix with audio rows. Audio is content-type-aware via the D-G3 formula switch, not via matrix multiplication.
- `src/lib/engine/types.ts` `PredictionResult` core shape — only additions (audio fields). No renames or field removals.
- Existing `timed()` call sites' arguments — only the audio_analysis → audio_fingerprint stage name string changes; orchestration unchanged.
- ML feature vector shape (`featureVectorToMLInput`) — `audioTrendingMatch` field semantics preserved per D-G4.

</code_context>

<specifics>
## Specific Ideas

- **User confirmed multimodal Gemini analysis intent** — twice asked "are we analyzing audio in combination with the actual video?" The answer is yes; Phase 6's audio scoring is a prompt extension on the existing video call, not a separate audio pipeline. Researcher and planner should treat this as the load-bearing constraint: do NOT propose any architecture that re-uploads the video, runs a parallel Gemini call for audio, or adds an ffmpeg extraction stage.

- **User explicitly chose cost-efficient path at every decision** — D-A1 (free Gemini fold over $0.001 dedicated call), D-F0 (Gemini-description embedding over Chromaprint operational complexity), D-F2 (Phase 6 self-contained pgvector setup over Phase-8-reorder serialization), D-F4 (cron extension over on-demand embedding latency). Theme: keep operational complexity bounded; Phase 12 benchmark gates whether the cheap approach is good enough.

- **User explicitly chose "fingerprint wins" over "both fire" hybrid** (D-F3) — the user prefers single source of truth over richer-but-noisier signals. Downstream agents should follow this preference: when two signals could compete, prefer one as canonical and use the other only on fallback.

- **User declined to over-engineer scoring for v3.0-dev** — multiple times user picked the cleaner option that Phase 10 will tune later (e.g., D-G1 initial weight 0.05-0.10 deferred to planner; D-G3 content-type adaptivity but no extension of Phase 4's D-12 matrix). The pattern: ship working measurement first; tune via corpus benchmark.

- **User self-identified as non-technical (carry from Phase 2 D-15 via Phase 3 D-21)** — all technical schema choices (Zod shapes, pgvector dimensionality, ivfflat parameters, similarity thresholds, audio_perceptual_score formula coefficients, stage event payload shape, migration file structure) are Claude's discretion. Future agents follow the same division: ask about user-facing behavior (scoring philosophy, which trends matter, content-type honesty), decide implementation internally.

- **User asked Claude's recommendation explicitly once (D-A4)** — Claude recommended option 1 (rename stage to audio_fingerprint) + explained reasoning (parallelism preserved, M2 viz boundary, name honesty); user accepted. Future Claude-discretion calls should follow the same pattern: state the recommendation, give the reasoning, name the rejected alternatives so the user can override if they disagree.

- **User raised Phase 5 hook-window change mid-discussion** ("hook is extended from 3s to 5s btw") — captured as Phase 5 deferred (not Phase 6 scope). Indicates the user has Phase 5 details in mind already. Phase 5's discuss-phase should treat SEGMENT-01 as updated (0-5s) when it runs.

</specifics>

<deferred>
## Deferred Ideas

### Phase 5 (Multi-Modal Hook Decomposition) — handled during Phase 5 discuss-phase
- **SEGMENT-01 hook window 0-3s → 0-5s** — user noted during Phase 6 discussion. Affects Phase 5's Gemini Pro hook call window. Phase 5's discuss-phase should update SEGMENT-01 in REQUIREMENTS.md and SEGMENT-02 body start (5s instead of 3s).
- **HOOK-02 traceability migration** — REQUIREMENTS.md table will move HOOK-02 from Phase 5's Multi-Modal Hook Decomposition section to Phase 6's Audio Analysis section. Phase 5's plan stages will reference Phase 6's `audio_hook_first_2s` field instead of producing it.

### Phase 7 (Multi-Persona Simulation)
- **Per-persona audio reaction signals** — would each persona react differently to a trending sound match? Maybe a Gen-Z FYP persona favors emerging sounds more strongly than a returning loyalist persona. Out of Phase 6 scope; Phase 7 owns persona-specific reaction weighting and may consume Phase 6's audio output.

### Phase 8 (Benchmark Retrieval)
- **Audio embedding reuse for benchmark retrieval** — could competitor videos' audio embeddings (populated by Phase 6's cron extension for trending_sounds) also feed Phase 8's pgvector top-K retrieval (filter for "videos with similar audio")? Phase 6 ships the pgvector extension; Phase 8 owns audio-as-retrieval-filter design.

### Phase 9 (Platform Algo Fit + Self-Critique + Counterfactuals)
- **Platform-specific audio weight tuning** — TikTok algorithm explicitly favors trending-sound use (ALGO-01 mentions completion/shares/saves but audio is implicit). IG Reels favors original audio (ALGO-02 already specifies "original audio bonus"). YouTube Shorts is audio-agnostic. Phase 9 may want platform-specific audio weight multipliers.
- **Counterfactual suggestions about audio** — "What if you swapped the audio to a rising sound?" — Phase 9's counterfactual stage may want a `suggest_audio_swap` option that's grounded in Phase 6's fingerprint output. Phase 9 designs the counterfactual API; Phase 6 just ensures the data is there.

### Phase 10 (ML Audit + Calibration + Aggregator Extension)
- **Audio signal weight tuning** — Phase 6 ships 0.05-0.10 placeholder weight. Phase 10's corpus benchmark measures audio's accuracy contribution and sets the real weight. May also revise per-content-type formula coefficients in D-G3.
- **`audio_perceptual_score` formula coefficient refinement** — Phase 6 ships a reasonable starting formula per D-G3. Phase 10 corpus benchmark may show some sub-scores (e.g., voice_clarity vs audio_hook_first_2s) contribute more accuracy than others.
- **ML retrain with fingerprint cosine similarity in `audioTrendingMatch`** — Phase 10 ML audit may retrain on the new (post-Phase-6) feature vector where audioTrendingMatch carries pgvector similarity instead of Jaro-Winkler. May improve ML accuracy by 1-2 points.

### Engine Foundation milestone retrospective
- **Chromaprint / AcoustID revisit** — explicitly rejected in Phase 6 D-F0. If Phase 12 benchmark shows Gemini-description embedding has unacceptable fingerprint precision (e.g., <60% recall on known trending-sound usage in corpus), revisit with real audio fingerprinting in a follow-up milestone. Add to milestone retrospective.
- **Audio sentiment / emotion / genre classification** — not in REQUIREMENTS AUDIO-01..06 and explicitly scope-creep this milestone. Intelligence Surface (M2) milestone may want emotion arcs for the retention curve UI; revisit there.
- **Real audio waveform analysis (ffmpeg)** — explicitly rejected per D-A1. If Gemini perceptual scoring proves unreliable, revisit. Probably an M2 or post-M2 question.

### Intelligence Surface milestone (M2)
- **Audio results UI surfacing** — which fields appear on the result card (matched sound name + velocity? music vs voice ratio bar chart? audio hook score callout?). Phase 6 ships the data; M2 owns the visualization.
- **Audio-correlated retention curve** — silence/voiceover/music timeline could overlay retention curve. Phase 6's D-A3 chose three percentages over timeline segments — if M2 needs the timeline, this is a request to revisit.

</deferred>

---

*Phase: 6-Audio Analysis + Fingerprint Matching*
*Context gathered: 2026-05-18*
