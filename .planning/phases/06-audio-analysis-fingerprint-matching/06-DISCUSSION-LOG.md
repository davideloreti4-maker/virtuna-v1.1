# Phase 6: Audio Analysis + Fingerprint Matching - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 6-Audio Analysis + Fingerprint Matching
**Areas discussed:** Audio source mechanism, Fingerprint approach, Aggregator weight + boundary, HOOK-02 ownership

---

## Audio source mechanism

### Question 1: How should Phase 6 produce voice clarity / audio hook / silence-music ratio signals from the uploaded video?

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated Gemini Flash audio-prompted call | Reuse fileUri from Phase 4, fire a parallel Gemini 3 Flash call with audio-only prompt. Independent of Phase 5. ~$0.001/call. | |
| Fold into Phase 5 segment calls | Phase 5's Pro hook + Flash body/CTA calls extend prompts to emit audio sub-scores. Couples Phase 6 to Phase 5's plan. | |
| ffmpeg extract + numeric scoring | Add ffmpeg dep, signal-process audio locally. No LLM for audio. Adds binary dep + cold-start risk. | |
| Extend existing Wave 1 video call (free) | Add audio fields to existing gemini_video_analysis prompt schema. Zero extra LLM cost. Ships independently. | ✓ |

**User's choice:** Initially "Dedicated Gemini Flash" but asked "isn't it possible to analyze the audio in combination with the actual video?" — re-presented with refined fourth option that Gemini natively processes both modalities. User picked the free fold path.
**Notes:** User has multimodal-Gemini intent locked in. Decision D-A1.

### Question 2: How should audio signals behave for content types that often have no voiceover (slideshow, b_roll, action)?

| Option | Description | Selected |
|--------|-------------|----------|
| Audio signal is content-type-aware | talking_head/tutorial/vlog get full scoring; slideshow/b_roll/action skip voice fields, keep music/silence ratio. | ✓ |
| Score every video uniformly | All sub-scores fire; aggregator uses Phase 4 weight matrix to down-weight. May under-score slideshows. | |
| Voice fields nullable, music/silence always scored | Voice nullable when no speech; ratios always emit. Separate signal_availability keys. | |

**User's choice:** Audio is content-type-aware.
**Notes:** Decision D-A2.

### Question 3: What format should the silence/voiceover/music ratio take in the audio result?

| Option | Description | Selected |
|--------|-------------|----------|
| Three percentages summing to 1.0 | { silence: 0.05, voiceover: 0.70, music: 0.25 }. Aggregator-friendly. | ✓ |
| Dominant category + confidence | { category: "voiceover", confidence: 0.85 }. Loses information on multi-component audio. | |
| Timeline segments | [{start_s, end_s, kind}, ...]. Richest, feeds M2 retention curve. Gemini Flash hallucination risk. | |

**User's choice:** Three percentages summing to 1.0. User reconfirmed audio-with-video analysis intent.
**Notes:** Decision D-A3.

### Question 4: What is the audio_analysis stage in pipeline.ts responsible for now?

| Option | Description | Selected |
|--------|-------------|----------|
| Repurpose as fingerprint-only stage | Stage owns trending-sound fingerprint matching only. Perceptual scores extracted from gemini_video_analysis in aggregator. | ✓ |
| Thin extractor + fingerprint | Stage executes after gemini result available; extracts perceptual scores AND runs fingerprint match. Sequences with Gemini. | |
| Remove the stage entirely | Delete audio_analysis; perceptual lives in gemini result; fingerprint folds into trend_enrichment. Loses M2 viz boundary. | |

**User's choice:** Asked for Claude's recommendation. Claude recommended option 1 + rename to `audio_fingerprint` (parallelism preserved, M2 boundary kept, stage name honest). User accepted.
**Notes:** Decision D-A4. Stage rename will touch pipeline.ts line 375 (timed("audio_analysis", ...) → timed("audio_fingerprint", ...)).

---

## Fingerprint approach

### Question 1: What's the right fingerprint approach for v3.0-dev?

| Option | Description | Selected |
|--------|-------------|----------|
| Gemini audio embeddings + pgvector | Embeddings + pgvector cosine match. Reuses Phase 8's pgvector setup. Caveat: Gemini doesn't have raw audio embeddings. | ✓ |
| Chromaprint / AcoustID | Industry-standard acoustic fingerprinting. External binary dep + Vercel cold-start risk. | |
| Defer fingerprinting, ship perceptual + caption-trend only | Phase 6 ships AUDIO-01..04, keeps Jaro-Winkler for AUDIO-05/06. Cheapest. | |
| Gemini-asked match against trending_sounds.sound_name list | Pass top-50 names to gemini_video_analysis prompt, let Gemini identify. No reference recordings. | |

**User's choice:** Gemini audio embeddings + pgvector.
**Notes:** Decision D-F0. Claude flagged caveat (no raw audio embeddings from Gemini); followed up with embedding-strategy clarification.

### Question 2: Given Gemini doesn't expose raw audio embeddings, which fingerprint embedding strategy?

| Option | Description | Selected |
|--------|-------------|----------|
| Embed Gemini's audio description | Extend gemini_video_analysis prompt to emit audio_description string; embed via text embedding API. Trending_sounds precomputed via backfill. | ✓ |
| Hybrid: name-first, embedding-on-miss | Gemini multi-choice over top-50 names; fall through to embedding match on miss. | |
| Sound-name-only embedding (cheap) | Embed sound_name + caption + video description. No audio_description. Barely better than Jaro-Winkler. | |

**User's choice:** Embed Gemini's audio description.
**Notes:** Decision D-F1.

### Question 3: How should Phase 6 handle the pgvector dependency given Phase 8 ships pgvector in parallel?

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 6 owns pgvector for trending_sounds | Phase 6 migration adds extension + column + index; Phase 8 reuses. | ✓ |
| Reorder — Phase 6 after Phase 8 | Phase 6 depends on Phase 8; adds one serialization wave. | |
| Decouple — ship fingerprint logic, defer column to Phase 8 | Phase 6 ships function; Phase 8 ships column; signal_availability.audio_fingerprint = false until then. | |

**User's choice:** Phase 6 owns pgvector for trending_sounds.
**Notes:** Decision D-F2. No reorder of Wave 4 phase parallelism.

### Question 4: When BOTH audio fingerprint and caption fuzzy match find a trending sound, what's the source of truth?

| Option | Description | Selected |
|--------|-------------|----------|
| Fingerprint wins; fuzzy only as fallback | Fingerprint populates matched_trends; Jaro-Winkler runs only when signal_availability.audio_fingerprint = false. | ✓ |
| Both fire — union the matches | Both populate matched_trends. UI must dedupe. Noisy. | |
| Both fire — score-weighted union, prefer fingerprint when same sound | Both run; disagreement → fingerprint wins; agreement → confidence boost. Most code. | |

**User's choice:** Fingerprint wins; fuzzy only as fallback.
**Notes:** Decision D-F3. Satisfies SC#4 literally.

### Question 5: How do trending_sounds get their audio_embedding populated?

| Option | Description | Selected |
|--------|-------------|----------|
| One-time backfill + extend the cron to compute on upsert | Phase 6 ships backfill script AND extends calculate-trends cron. ~$0.025/day ceiling. | ✓ |
| One-time backfill only | New trending sounds won't have embeddings until manual rerun. | |
| On-demand embedding at predict time | Embed sound_url at predict time. ~1-2s latency added (exceeds SC#5 budget). | |

**User's choice:** Backfill + cron extension.
**Notes:** Decision D-F4. Backfill script will be a new file; cron route extension touches existing route.

---

## Aggregator weight + boundary

### Question 1: How should audio enter the aggregator score for v3.0-dev?

| Option | Description | Selected |
|--------|-------------|----------|
| Audio as new standalone signal (0.05-0.10 weight) | Top-level signal alongside behavioral/gemini/ml/rules/trends. Two sub-components. Phase 10 tunes. | ✓ |
| Fold audio into existing trends signal | No new top-level signal. Phase 10 can't isolate audio's contribution. | |
| Audio weight = 0 for v3.0-dev (measure only) | Plumbing ships, weight = 0 until Phase 10 measures contribution. Lowest risk. | |

**User's choice:** Audio as new standalone signal.
**Notes:** Decision D-G1. Initial weight ~0.05-0.10; planner picks final value.

### Question 2: When the fingerprint matches a trending sound, how should that affect the final 0-100 score?

| Option | Description | Selected |
|--------|-------------|----------|
| Phase-aware boost on the audio signal only | Emerging +15, rising +10, peak +5, declining -5. Applied to audio_score before weighted average. | ✓ |
| Flat boost regardless of phase | Any match = +10. Doesn't penalize stale trends. | |
| Multiplier on overall score | Match → overall ×1.05 etc. Risks double-counting with trends signal. | |
| Surface-only — no score impact | Match shows in UI, doesn't affect score. Phase 10 measures whether to add scoring. | |

**User's choice:** Phase-aware boost on the audio signal only.
**Notes:** Decision D-G2. Matches platform reality (emerging > peak > declining).

### Question 3: How should the audio_score formula handle different available sub-scores across content types?

| Option | Description | Selected |
|--------|-------------|----------|
| Formula adapts to available sub-scores | talking_head: voice-driven. slideshow: ambient-driven. Honest scoring per content type. | ✓ |
| Uniform formula, null treated as 0 | Slideshow with null voice fields gets low baseline. Penalizes slideshows. | |
| Extend Phase 4 content-type matrix with audio multipliers | Matrix grows a column; formula stays uniform. Cleanest matrix extension. | |

**User's choice:** Formula adapts to available sub-scores.
**Notes:** Decision D-G3. Matches D-A2 (content-type-aware).

### Question 4: What happens to FeatureVector.audioTrendingMatch (today: Jaro-Winkler caption-fuzzy match score, fed to ML)?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep field, populate from fingerprint when available | Same field, source swaps. ML feature vector shape unchanged. Backward-compatible. | ✓ |
| Deprecate field, add audio_fingerprint_similarity | Old field stays (fuzzy); new field added (pgvector). Wider feature vector. Phase 10 ML retrain. | |
| Delete field entirely | Audio lives only in audio_score. ML feature vector shrinks. Touches more files. | |

**User's choice:** Keep field, populate from fingerprint when available.
**Notes:** Decision D-G4. Zero-rewrite — ML never sees the swap.

---

## HOOK-02 ownership

### Question 1: Who owns HOOK-02 (audio hook score for first 2s, 0-10)?

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 6 owns it; Phase 5 consumes | HOOK-02 traceability moves to Phase 6. Phase 5 hook decomp references audio_hook_first_2s. Audio expertise concentrated. | ✓ |
| Phase 5 owns it; Phase 6 doesn't produce a 0-2s score | Phase 5's Pro hook call emits all four hook sub-scores. Tighter Phase 5 ownership. | |
| Both produce; aggregator picks max | Redundancy + cost. Likely overkill. | |

**User's choice:** Phase 6 owns it; Phase 5 consumes.
**Notes:** Decision D-H1. REQUIREMENTS.md HOOK-02 traceability will move from Phase 5 to Phase 6 in the planning step.

### Question 2: With Phase 5's hook segment extended to 0-5s, what window does Phase 6's audio_hook_0_2s actually cover?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 0-2s window for audio hook | Audio impact is a fast-attention-grab phenomenon. Rename field to audio_hook_first_2s. | ✓ |
| Expand to 0-5s to match Phase 5 hook segment | Audio scored across the full 5s hook segment. Parity with Phase 5. Risk: dilutes attention-grab signal. | |
| Both — emit 0-2s and 0-5s scores | Two audio hook scores. Richer but adds a Gemini sub-field. | |

**User's choice:** Keep 0-2s window for audio hook.
**Notes:** Decision D-H2. User mentioned mid-discussion that the Phase 5 hook segment changed 0-3s → 0-5s. Captured as Phase 5 deferred.

### Question 3: Does Phase 5 now strictly depend on Phase 6, or do they stay parallel?

| Option | Description | Selected |
|--------|-------------|----------|
| Stay parallel; Phase 5 handles null gracefully | HOOK-05 picks min over non-null modalities. Widens 3→4 when Phase 6 ships. | ✓ |
| Add strict Phase 5 → Phase 6 dependency | Wave 4 → Wave 4 + Wave 5. One serialization wave added. | |
| Phase 6 ships HOOK-02 first as a Phase 5 prerequisite | Split Phase 6 → 6a + 6b. Phase 5 depends on 6a. Adds phases. | |

**User's choice:** Stay parallel; Phase 5 handles null gracefully.
**Notes:** Decision D-H3. ROADMAP wave structure unchanged.

---

## Claude's Discretion

- **Exact audio field names + Zod schemas** for the extended `gemini_video_analysis` response (`voice_clarity_0_10`, `audio_hook_first_2s_0_10`, `silence_ratio`, `voiceover_ratio`, `music_ratio`, `audio_description`) — researcher/planner lock.
- **Gemini text embedding model + dimensionality** — verify whether `text-embedding-004` (768-dim), Gemini 3 embedding, or other; pgvector column dimension matches. Researcher locks.
- **pgvector index parameters** — ivfflat lists count, probes — based on expected `trending_sounds` row count (~hundreds, not millions).
- **Cosine similarity threshold for "this is a match"** — researcher proposes baseline (suggested 0.80-0.85 for Gemini description embeddings). Phase 12 benchmark validates.
- **Initial audio signal weight value (0.05 vs 0.07 vs 0.10)** — planner picks; Phase 10 retunes.
- **`audio_perceptual_score` formula coefficients** within D-G3's content-type-aware structure — planner picks.
- **Stage event payload shape** for `audio_fingerprint` — matches Phase 3's D-02 `StageEvent` discriminated union.
- **Backfill script idempotency + batching strategy** — resumable on failure.
- **Migration scope** — single migration covering pgvector + audio_embedding + audio_description + ivfflat index. Single or split.
- **Failure semantics** when extended gemini_video_analysis returns video fields but audio fields missing/invalid — graceful degradation per HARD-03.

## Deferred Ideas

### Phase 5 (Multi-Modal Hook Decomposition)
- SEGMENT-01 hook segment window 0-3s → 0-5s (user noted during this discussion).
- HOOK-02 traceability migration in REQUIREMENTS.md (Phase 5 → Phase 6).

### Phase 7 (Multi-Persona Simulation)
- Per-persona audio reaction signals.

### Phase 8 (Benchmark Retrieval)
- Audio embedding reuse for benchmark retrieval (audio-similarity filter on competitor_videos).

### Phase 9 (Platform Algo Fit + Self-Critique + Counterfactuals)
- Platform-specific audio weight tuning (TikTok vs IG vs YT).
- Counterfactual suggestions about audio swap.

### Phase 10 (ML Audit + Calibration + Aggregator Extension)
- Audio signal weight final tuning.
- audio_perceptual_score formula coefficient refinement.
- ML retrain with fingerprint cosine similarity in audioTrendingMatch.

### Engine Foundation milestone retrospective
- Chromaprint / AcoustID revisit if Gemini description embedding fails benchmark.
- Audio sentiment / emotion / genre classification (M2 surfacing).
- Real audio waveform analysis (ffmpeg) if Gemini perceptual scoring proves unreliable.

### Intelligence Surface milestone (M2)
- Audio results UI surfacing (which fields show on result card).
- Audio-correlated retention curve (silence/voiceover/music timeline overlay).
