# Requirements — Engine Foundation Milestone

**Milestone goal:** Build, train, and validate the content intelligence engine. Ship measurable accuracy improvements before UX investment.

**Acceptance gate:** Engine v3 demonstrates measurable accuracy improvement vs v2.1 baseline on training corpus. Target threshold set in Phase 1 after baseline measurement.

---

## Training Corpus

<!-- The unlock — labeled training data scraped from competitor videos with known outcomes. -->

- [ ] **CORPUS-01**: 500-video training corpus built, stratified across 100 viral / 200 average / 200 underperforming
- [ ] **CORPUS-02**: 30-day rolling refresh mechanism (Apify scrape scheduled)
- [ ] **CORPUS-03**: Multi-niche coverage — minimum 5 niches represented (beauty, fitness, edu, comedy, lifestyle)
- [ ] **CORPUS-04**: Outcome metadata captured per video — views, completion %, shares, comments, saves, creator follower tier
- [ ] **CORPUS-05**: Outcome bucketing logic (viral / average / underperforming thresholds per niche percentile)
- [ ] **CORPUS-06**: Corpus storage schema in Supabase (`training_corpus` table with video metadata + outcomes)
- [ ] **CORPUS-07**: Apify scrape job for corpus refresh (separate from competitor scraping)
- [ ] **CORPUS-08**: Corpus quality validation (no duplicates, valid outcomes, recent within window)

## Evaluation Framework

<!-- Objective measurement of engine accuracy before/after each change. -->

- [ ] **EVAL-01**: Engine evaluation harness runs predictions across full corpus, batched
- [ ] **EVAL-02**: Accuracy metrics computed — prediction error vs actual (MAE for engagement, classification accuracy for viral bucket)
- [ ] **EVAL-03**: Per-signal contribution analysis — which signals add accuracy, which subtract
- [ ] **EVAL-04**: Calibration drift measurement — how well predicted percentiles map to actual percentiles
- [ ] **EVAL-05**: Regression detection — compare engine versions, flag accuracy decrease
- [ ] **EVAL-06**: Benchmark report generation (markdown summary + JSON metrics, persisted)
- [ ] **EVAL-07**: Pass/fail gate against accuracy target (defined in Phase 1)
- [ ] **EVAL-08**: Baseline measurement of current engine (v2.1) on corpus before any changes ship

## Creator Profile + Interview

<!-- 9-card modal on first upload click. Skippable individually, flow mandatory. -->

- [x] **PROFILE-01**: `creator_profiles` table schema in Supabase with RLS policies
- [x] **PROFILE-02**: 9-card interview modal flow with progressive disclosure
- [x] **PROFILE-03**: Card 0 — Target platform (multi-select: TikTok, IG Reels, YT Shorts)
- [x] **PROFILE-04**: Card 1 — Niche (hierarchical: primary → sub-niche → micro-niche)
- [x] **PROFILE-05**: Card 2 — Target audience (age range, gender skew, geo, language)
- [x] **PROFILE-06**: Card 3 — Goal (growth / engagement / brand deals / conversion) + stage (new / growing / established)
- [x] **PROFILE-07**: Card 4 — Content style (talking head / B-roll / edu / comedy / tutorial / vlog) + cuts/sec preference
- [x] **PROFILE-08**: Card 5 — Reference creators (1-3 aspirational, adds to scrape queue if not present)
- [x] **PROFILE-09**: Card 6 — Past wins (1-2 URLs) + past flops (1-2 URLs)
- [x] **PROFILE-10**: Card 7 — Posting cadence (frequency + time-of-day awareness)
- [x] **PROFILE-11**: Card 8 — Pain points (text input)
- [x] **PROFILE-12**: Truthfulness messaging surfaced — UI emphasizes honest answers improve prediction accuracy
- [x] **PROFILE-13**: Individual cards skippable; full flow mandatory before first analysis
- [x] **PROFILE-14**: Modal-on-first-upload-click trigger (intercept upload action for users without profile)
- [x] **PROFILE-15**: Edit-from-settings flow allows profile updates anytime
- [ ] **PROFILE-16**: Re-prompt micro-card every 10 analyses (single question, "Is your goal still X?") → Deferred to Phase 11 per Phase 02 D-14 (no counter column, no trigger code added in Phase 2)
- [x] **PROFILE-17**: Profile loaded into every analysis as enriched `CreatorContext` (extends existing `creator.ts`)

## Pipeline Infrastructure

<!-- Event callback, versioning, provenance — sets up SSE infra for M2 viz. -->

- [ ] **PIPE-01**: `onStageEvent` callback parameter added to `runPredictionPipeline()` (optional, backward-compatible)
- [ ] **PIPE-02**: Pipeline event schema defined (stage start/end, per-signal results, persona reactions, costs)
- [ ] **PIPE-03**: Stage events emitted at each `timed()` boundary
- [ ] **PIPE-04**: SSE infrastructure in `/api/analyze` route (Vercel-compatible streaming)
- [ ] **PIPE-05**: Engine version tagged on every prediction (`engine_version` field; v3.0.0 after this milestone)
- [ ] **PIPE-06**: Prediction provenance — which signals fired, which degraded, signal availability flags persisted
- [ ] **PIPE-07**: Wave 0 stage support (V3 calls before Wave 1)
- [ ] **PIPE-08**: Wave 3 stage support (parallel persona simulation after Wave 2)
- [ ] **PIPE-09**: Stage 10 (self-critique) and Stage 11 (counterfactuals) added post-aggregator

## Caching Layer

<!-- 30-40% cost reduction on heavy users, sub-5s latency on re-uploads. -->

- [ ] **CACHE-01**: Content hash computed on video upload (SHA-256 of buffer)
- [ ] **CACHE-02**: Cache lookup by content hash before pipeline runs; return cached result if hit
- [ ] **CACHE-03**: Persona prompt caching via DeepSeek input cache (80% input discount)
- [ ] **CACHE-04**: Niche taxonomy cached in-memory (no DB roundtrip per analysis)
- [ ] **CACHE-05**: Cache TTL policy (24h for full predictions, 7d for niche taxonomy, persistent for persona prompts)
- [ ] **CACHE-06**: Cache invalidation triggers on engine version bump

## Content Type + Niche Detection (Wave 0)

<!-- Pre-Wave 1 classification drives downstream signal weighting. -->

- [ ] **CONTENT-01**: Content type classifier (V3, ~$0.001/call) — talking head / B-roll / slideshow / action / tutorial / vlog
- [ ] **CONTENT-02**: Hierarchical niche detector (V3, ~$0.001/call) — primary / sub-niche / micro-niche from content + creator profile
- [ ] **CONTENT-03**: Niche taxonomy stored as tree structure with mappings to persona archetypes and benchmark filters
- [ ] **CONTENT-04**: Content-type-aware signal weighting passed to aggregator (e.g., slideshows down-weight pacing signal)

## Video Segmentation

<!-- Native Gemini videoMetadata — single upload, parallel scoped calls. -->

- [ ] **SEGMENT-01**: Gemini 2.5 Pro analysis of hook segment (0-3s) via `videoMetadata: { startOffset, endOffset }`
- [ ] **SEGMENT-02**: Gemini 2.5 Flash analysis of body segment (3s → end-3s) via `videoMetadata`
- [ ] **SEGMENT-03**: Gemini 2.5 Flash analysis of CTA segment (last 3s) via `videoMetadata`
- [ ] **SEGMENT-04**: Parallel execution of 3 segments (single Gemini Files upload reused)
- [ ] **SEGMENT-05**: Segment results merged into single Gemini analysis output (timestamps preserved)
- [ ] **SEGMENT-06**: Model selection per segment configurable via env

## Multi-Modal Hook Decomposition

<!-- Decompose the 0-3s hook into 4 sub-signals + cross-modal scores. -->

- [ ] **HOOK-01**: Visual stop power score (0-10, from Pro hook segment)
- [ ] **HOOK-02**: Audio hook quality score (0-10, first 2s audio analysis)
- [ ] **HOOK-03**: Text overlay readability + impact score (0-10)
- [ ] **HOOK-04**: First-words / speech hook score (0-10, transcription-based)
- [ ] **HOOK-05**: Weakest hook modality identified (one of visual/audio/text/speech)
- [ ] **HOOK-06**: Visual-audio coherence score — mood match across modalities (0-10)
- [ ] **HOOK-07**: Cognitive load score — information density per second (0-10, higher = more load = lower retention)

## Audio Analysis

<!-- Fill the no-op stage with real audio signals. -->

- [ ] **AUDIO-01**: Audio analysis stage replaces existing no-op (`audioResult: null` → real result)
- [ ] **AUDIO-02**: Voice clarity / SNR score (0-10)
- [ ] **AUDIO-03**: Audio hook score for first 2s (0-10)
- [ ] **AUDIO-04**: Silence / voiceover / music ratio computed
- [ ] **AUDIO-05**: Audio fingerprint matching against trending sounds DB (replaces fuzzy string match)
- [ ] **AUDIO-06**: Trending sound detection: bool + velocity (rising / peak / declining)

## Multi-Persona Simulation (Wave 3)

<!-- 10 personas allocated FYP-first. The defining engine improvement. -->

- [ ] **PERSONA-01**: 10-persona simulation running in Wave 3 of pipeline (parallel V3 calls)
- [ ] **PERSONA-02**: 6 FYP non-follower personas (demographically diverse — Gen Z, Millennial, female/male skew, geo variants)
- [ ] **PERSONA-03**: 2 niche-aligned discovery personas (already-interested in topic but new to creator)
- [ ] **PERSONA-04**: 1 returning follower / loyalist persona
- [ ] **PERSONA-05**: 1 cross-niche curiosity persona
- [ ] **PERSONA-06**: Per-persona output schema: scroll-past second, watch-through %, comment intent, share intent, save intent
- [ ] **PERSONA-07**: Persona allocation tunable per content type (FYP-heavy for short discovery content, follower-heavier for serial/community content)
- [ ] **PERSONA-08**: Persona definitions cached for cost efficiency (DeepSeek input cache + niche-specific variants)
- [ ] **PERSONA-09**: `deepseek-chat` (V3) model used for all persona calls; configurable via env
- [ ] **PERSONA-10**: Aggregate persona outputs into behavioral signal (replaces single DeepSeek behavioral_predictions)
- [ ] **PERSONA-11**: Per-persona drop-off second stored on prediction (feeds retention curve in M2)

## Benchmark Retrieval (pgvector)

<!-- Top-K similar competitor videos as evidence. -->

- [ ] **RETRIEVAL-01**: `pgvector` extension installed in Supabase
- [ ] **RETRIEVAL-02**: Two-pool video embedding pipeline — embeddings computed at scrape time (Apify webhook → `scraped_videos.embedding`) AND at corpus build time (`scripts/build-corpus.ts` → `training_corpus.embedding`). Reflects Phase 8 D-01 locked decision: `competitor_videos.embedding` rejected (per-user RLS pool too small + system-wide pattern-match is the actual use case).
- [ ] **RETRIEVAL-03**: Predict-time embedding of input video summary (text-embedding-3-small or Gemini embedding)
- [ ] **RETRIEVAL-04**: Top-K similarity search (K=5) filtered by niche, platform, creator tier
- [ ] **RETRIEVAL-05**: Similar videos returned as `retrieval_evidence` field on prediction (top 5 with similarity scores + outcomes)
- [ ] **RETRIEVAL-06**: Backfill embedding pipeline for existing competitor videos (one-time job)

## Platform Algorithm Fit

<!-- Per-platform signal weighting + creator-tier awareness. -->

- [ ] **ALGO-01**: TikTok algorithm fit signal — completion >> shares > saves > comments > likes
- [ ] **ALGO-02**: Instagram Reels algorithm fit signal — sends-to-DM > comments > shares > saves + original audio bonus + watermark penalty
- [ ] **ALGO-03**: YouTube Shorts algorithm fit signal — watch time + subscribes > replays > likes
- [ ] **ALGO-04**: Per-platform fit score computed and returned on prediction (one score per platform user targets in Card 0)
- [ ] **ALGO-05**: Creator-tier-aware adjustment (nano-creator algo favor on TikTok, established-creator penalty for low engagement, etc.)
- [ ] **ALGO-06**: Watermark detection on uploaded video (Gemini prompt extension, ~free) — flags for IG penalty

## Self-Critique + Counterfactuals

<!-- Honest accuracy via second-pass reasoning. -->

- [ ] **CRITIQUE-01**: Self-critique V3 call on aggregator output
- [ ] **CRITIQUE-02**: Critique cross-references creator's past wins/flops (Card 6) — flags when prediction contradicts creator history
- [ ] **CRITIQUE-03**: Critique adjusts `confidence` field downward when reasoning is internally inconsistent
- [ ] **COUNTER-01**: Counterfactual suggestions generated via V3 ("what if hook moved to 0:02")
- [ ] **COUNTER-02**: Counterfactuals tied to timestamped suggestions + retention curve drop points
- [ ] **COUNTER-03**: Counterfactuals returned in prediction result, available to all tiers (no premium gate)
- [ ] **COUNTER-04**: Anti-virality "this will likely flop" warning when prediction confidence is high but score is low

## ML Classifier Audit + Calibration

<!-- The corpus enables this work. -->

- [ ] **ML-01**: Run existing ML classifier against corpus benchmark — measure current accuracy
- [ ] **ML-02**: Accuracy report with current weight (0.15) impact analysis — does ML signal help or hurt?
- [ ] **ML-03**: Decision: retrain on corpus, down-weight, or disable signal
- [ ] **ML-04**: Platt calibration training on corpus predictions vs actual outcomes
- [ ] **ML-05**: `is_calibrated` flag flips to `true` for predictions where calibration applies
- [ ] **ML-06**: ML weights file regenerated if retrained (commit to repo)

## Aggregator Extension

<!-- SignalAvailability pattern extends naturally. -->

- [ ] **AGG-01**: SignalAvailability extended with new signals — personas, audio, retrieval, hook, algo-fit
- [ ] **AGG-02**: Dynamic weight redistribution rules updated for new signals
- [ ] **AGG-03**: Engine version bumped to v3.0.0 in `ENGINE_VERSION` constant
- [ ] **AGG-04**: PredictionResult schema extended with new fields (per-persona reactions, hook decomp, retrieval evidence, algo-fit per platform, counterfactuals, critique notes)
- [ ] **AGG-05**: Existing 203 tests pass without modification (additive change discipline)
- [ ] **AGG-06**: New aggregator tests cover dynamic redistribution with new signals

## Integration + Privacy

<!-- Wire to existing UI; honest video retention. -->

- [ ] **INT-01**: Existing `/api/analyze` endpoint switched to new pipeline (Engine v3)
- [x] **INT-02**: Existing `src/components/app/video-upload.tsx` integrated with creator profile gate
- [ ] **INT-03**: Existing dashboard renders updated `PredictionResult` (basic display; polished card ships in M2)
- [x] **INT-04**: Existing onboarding (TikTok handle + goal personalization + 4 tooltips) integrates with 9-card profile (no duplication)
- [ ] **INT-05**: Storage retention policy — uploaded videos auto-deleted after 30 days unless user opts in to "save for re-analysis"
- [ ] **INT-06**: Retention policy surfaced in upload UI before user uploads
- [ ] **INT-07**: GDPR-compliant: user can request video deletion + profile data export

## Acceptance Benchmark

<!-- Ship gate: engine must measurably improve. -->

- [ ] **BENCH-01**: Full benchmark run on corpus before milestone completion
- [ ] **BENCH-02**: Target accuracy improvement vs v2.1 baseline met (target set in Phase 1)
- [ ] **BENCH-03**: Cost per analysis within budget — ≤$0.075 average (~$0.065 target with off-peak)
- [ ] **BENCH-04**: Calibration loss reduced vs v2.1 baseline
- [ ] **BENCH-05**: No regressions in existing 203 tests
- [ ] **BENCH-06**: Per-signal contribution analysis shows new signals contribute positively (none subtract)

---

## Out of Scope (Intelligence Surface Milestone)

- Live audience simulation viz (SSE-driven hive extension)
- Polished result card UI (retention curve, persona panels, hook decomp UI, similar videos panel, reasoning narrative card, confidence/calibration banner UI)
- Mobile-first analysis route (camera roll picker, paste-from-clipboard, simplified card, push notif)
- Concept mode (text-only "predict this idea" before filming)
- A/B variant generation (alternate hook scripts, side-by-side predictions)
- Hook archetype library (pre-curated successful hook patterns)
- Trend velocity / lifecycle prediction
- Cross-platform repurposing analysis ("same content scored per platform")
- Comparative baseline display ("X% vs your average")
- Emotion arc visualization
- Anti-virality / don't-post-yet UI surfaces (logic ships M1, surfacing waits for M2)
- Watermark detection UI surface (detection ships M1, UI waits for M2)

## Deferred (Future Milestones)

- Outcome auto-scraper (post-analysis automatic outcome ingestion from creator's posted content)
- Creator-fingerprint embedding from past 20 videos (interview cards seed it manually for now)
- TikTok Insights / IG OAuth integration (creator analytics)
- Multi-language / region-specific predictions
- Brand-deal alignment scoring (lives in Brand Deals tool)
- TikTok Shop / commerce scoring
- Collaboration / guest analysis
- Audience drift detection (30-day longitudinal)
- Shadow-ban detection

## Traceability

<!-- Filled by /gsd-plan-phase as phases plan against requirements. -->

| REQ-ID | Phase | Plan(s) | Status |
|--------|-------|---------|--------|
| PROFILE-01 | 02 | 02-01, 02-06 | Complete |
| PROFILE-02 | 02 | 02-04 | Complete |
| PROFILE-03 | 02 | 02-03 | Complete |
| PROFILE-04 | 02 | 02-02, 02-03 | Complete |
| PROFILE-05 | 02 | 02-03 | Complete |
| PROFILE-06 | 02 | 02-03 | Complete |
| PROFILE-07 | 02 | 02-03 | Complete |
| PROFILE-08 | 02 | 02-03, 02-06 | Complete |
| PROFILE-09 | 02 | 02-03 | Complete |
| PROFILE-10 | 02 | 02-03 | Complete |
| PROFILE-11 | 02 | 02-03 | Complete |
| PROFILE-12 | 02 | 02-04 | Complete |
| PROFILE-13 | 02 | 02-01, 02-04 | Complete |
| PROFILE-14 | 02 | 02-04 | Complete |
| PROFILE-15 | 02 | 02-05 | Complete |
| PROFILE-16 | 11 | (Phase 11 — Deferred per Phase 2 D-14) | Deferred |
| PROFILE-17 | 02 | 02-06 | Complete |
| INT-02 | 02 | 02-04 | Complete |
| INT-04 | 02 | 02-05 | Complete |
| RETRIEVAL-01 | 08 | 08-01, 08-05 | Planned |
| RETRIEVAL-02 | 08 | 08-01, 08-05 | Planned |
| RETRIEVAL-03 | 08 | 08-03, 08-04 | Planned |
| RETRIEVAL-04 | 08 | 08-04 | Planned |
| RETRIEVAL-05 | 08 | 08-04 | Planned |
| RETRIEVAL-06 | 08 | 08-05 | Planned |
