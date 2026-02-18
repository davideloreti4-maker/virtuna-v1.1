# Phase 2: ML Model Rehabilitation - Research

**Researched:** 2026-02-18
**Domain:** Multinomial logistic regression, class imbalance handling, ML-aggregator integration
**Confidence:** HIGH

## Summary

The ML model rehabilitation involves fixing a hand-rolled multinomial logistic regression classifier that currently achieves ~31% accuracy on 5 virality tiers. The core problems are: (1) severe class imbalance in tiers 4 and 5, (2) a feature bridge that hardcodes 6 of 15 features to 0.5, (3) no class weighting in the loss function, (4) the ML signal is exported but never called by the pipeline or aggregator, and (5) the retrain-ml cron uses a static 2.6MB JSON file instead of querying live scraped_videos data.

This is a pure refactoring + wiring phase. The ML architecture (multinomial logistic regression with softmax cross-entropy) is already implemented and sound. The changes are: add inverse-frequency class weighting to the gradient descent loop, implement stratified splitting, replace hardcoded feature placeholders with real FeatureVector signals, wire `predictWithML()` into the aggregator with new 5-signal weights, persist `ml_score` to the DB, and rewrite the retrain-ml cron to generate training data dynamically from `scraped_videos`.

**Primary recommendation:** Keep the existing hand-rolled multinomial logistic regression. Do NOT introduce TensorFlow.js or any external ML library. The model is only 5-class, 15-feature, ~7000 samples -- the vanilla implementation is correct, performant, and runs in <1s on Vercel. Focus purely on data quality (class weighting, real features) and integration wiring (aggregator, DB, cron).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Hand-rolled logistic regression | N/A | 5-class multinomial classification | Already implemented in `ml.ts`, ~200 lines. Sound softmax + cross-entropy + L2 reg. No library needed for this scale. |
| Supabase Storage | via `@supabase/supabase-js` | Persist trained model weights | Already used. Weights survive Vercel redeployments. |
| Supabase Postgres | via `@supabase/supabase-js` | Query `scraped_videos` for training data generation | Already wired. Phase 1 ensures data flows in. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js `fs` | built-in | Read/write training data JSON (local fallback) | Only during development/testing. Production uses Supabase. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled logistic regression | TensorFlow.js | Overkill -- 15 features, 5 classes, 7K samples. TFJS adds 40MB+ to bundle, WebAssembly complexity, Vercel cold start penalty. |
| Hand-rolled logistic regression | ml.js / brain.js | Marginal benefit. These are npm packages that add dependency surface. The existing implementation is <200 lines and already correct. |
| JSON-file training data | SQLite/Parquet | Unnecessary complexity. Training data is ~7K rows x 15 features. JSON loads in <100ms. |

**Installation:** No new packages needed. All dependencies are already in the project.

## Architecture Patterns

### Current File Ownership
```
src/lib/engine/
├── ml.ts                 # ML model: train, load, predict, feature bridge
├── aggregator.ts         # Score aggregation: 4-signal weights → needs 5-signal
├── types.ts              # PredictionResult, FeatureVector, score_weights type
├── pipeline.ts           # 10-stage pipeline (does NOT call ml.ts currently)
├── training-data.json    # Static 2.6MB training data (to be replaced by dynamic generation)
├── ml-weights.json       # Local fallback weights (production uses Supabase Storage)
└── calibration.ts        # Platt scaling (Phase 3, no changes needed here)

src/app/api/
├── cron/retrain-ml/route.ts    # Cron handler: triggers trainModel()
└── analyze/route.ts            # Main API: runs pipeline + aggregator + DB insert
```

### Pattern 1: Inverse-Frequency Class Weighting
**What:** Weight each class's loss contribution by `total_samples / (num_classes * class_count)` so minority classes (tiers 4, 5) get proportionally higher gradient signal.
**When to use:** During gradient computation in the training loop.
**Key insight:** The current training data has this distribution:
- Tier 1: 1457 (train) / 379 (test)
- Tier 2: 1481 / 363
- Tier 3: 1479 / 364
- Tier 4: 875 / 225
- Tier 5: 594 / 141

Tiers 4 and 5 are 1.7x and 2.5x underrepresented vs tiers 1-3. Without weighting, the model learns to predict tiers 1-3 and rarely predicts 4-5.

**Formula:**
```typescript
// Compute inverse-frequency weights
// weight_c = total_samples / (num_classes * count_c)
function computeClassWeights(labels: number[], numClasses: number): number[] {
  const counts = new Array(numClasses).fill(0);
  for (const label of labels) {
    counts[label - 1]++; // Labels are 1-indexed
  }
  const total = labels.length;
  return counts.map(count =>
    count > 0 ? total / (numClasses * count) : 1.0
  );
}

// For current data:
// Tier 1: 5886 / (5 * 1457) = 0.808
// Tier 2: 5886 / (5 * 1481) = 0.795
// Tier 3: 5886 / (5 * 1479) = 0.796
// Tier 4: 5886 / (5 * 875)  = 1.346
// Tier 5: 5886 / (5 * 594)  = 1.982
```

**Application in gradient descent:**
```typescript
// In the training loop, multiply the gradient by class weight:
const target = label - 1;
const classWeight = classWeights[target] ?? 1;
for (let c = 0; c < NUM_CLASSES; c++) {
  const error = (probs[c] ?? 0) - (c === target ? 1 : 0);
  // Multiply error by class weight for this sample's true class
  gradB[c] += error * classWeight;
  for (let f = 0; f < NUM_FEATURES; f++) {
    classGrad[f] += error * classWeight * (sample[f] ?? 0);
  }
}
```

### Pattern 2: Stratified Train/Test Split
**What:** When generating training data from `scraped_videos`, split so each tier has proportional representation in both train and test sets.
**When to use:** In the retrain-ml cron when building the training/test datasets.
**Implementation approach:** Group samples by label, shuffle each group independently, take 80% from each group for train and 20% for test.

```typescript
function stratifiedSplit(
  features: number[][],
  labels: number[],
  testRatio: number,
  rng: () => number
): { train: { features: number[][]; labels: number[] }; test: { features: number[][]; labels: number[] } } {
  // Group indices by label
  const groups = new Map<number, number[]>();
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i]!;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(i);
  }

  const trainIndices: number[] = [];
  const testIndices: number[] = [];

  for (const [, indices] of groups) {
    // Fisher-Yates shuffle with seeded RNG
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [indices[i], indices[j]] = [indices[j]!, indices[i]!];
    }
    const splitIdx = Math.floor(indices.length * (1 - testRatio));
    trainIndices.push(...indices.slice(0, splitIdx));
    testIndices.push(...indices.slice(splitIdx));
  }

  return {
    train: {
      features: trainIndices.map(i => features[i]!),
      labels: trainIndices.map(i => labels[i]!),
    },
    test: {
      features: testIndices.map(i => features[i]!),
      labels: testIndices.map(i => labels[i]!),
    },
  };
}
```

### Pattern 3: Aggregator Weight Redistribution (4-signal to 5-signal)
**What:** Add `ml` as a 5th signal in the aggregator weight map. Current weights are `{ behavioral: 0.45, gemini: 0.25, rules: 0.20, trends: 0.10 }`. Target weights are `{ behavioral: 0.35, gemini: 0.25, ml: 0.15, rules: 0.15, trends: 0.10 }`.
**When to use:** The aggregator's `SCORE_WEIGHTS`, `selectWeights()`, `SignalAvailability`, `aggregateScores()`, and the `PredictionResult.score_weights` type all need updating.
**Key concern:** The `selectWeights()` function handles dynamic redistribution when signals are missing. Adding `ml` means: if the ML model is not loaded (no weights in Supabase Storage), the ML signal is unavailable and its 15% gets redistributed to the other 4 signals.

### Pattern 4: Feature Bridge Rehabilitation
**What:** Replace hardcoded `0.5` placeholders in `featureVectorToMLInput()` with real signals from the `FeatureVector`.
**Current state (6 hardcoded features):**
- `shareRate = 0.5` -- should map from `fv.shareability / 10` (DeepSeek 0-10 score)
- `commentRate = 0.5` -- should map from `fv.commentProvocation / 10`
- `likeRate = 0.5` -- should map from `fv.emotionalCharge / 10` (emotional engagement proxy)
- `saveRate = 0.5` -- should map from `fv.saveWorthiness / 10`
- `hasFollowerData = 0` -- no direct FeatureVector signal, keep as 0
- `viewsPerFollower = 0` -- no direct FeatureVector signal, keep as 0

**Why these mappings work:** The ML model was trained on scraped engagement data (shareRate, commentRate, etc.). The inference path has content analysis signals (shareability, commentProvocation) that PROXY these engagement metrics. The model's value is learning cross-feature patterns, so semantic proxies are valid -- they just need to be in the same 0-1 normalized range.

**Remaining features that already have real mappings:**
- `shareToLikeRatio` -- from `fv.shareTrigger / 10` (already implemented)
- `commentToLikeRatio` -- from `fv.commentProvocation / 10` (already implemented)
- `durationSeconds` -- from `fv.durationSeconds / 180` (already implemented)
- `hashtagCount` -- from `fv.hashtagCount / 30` (already implemented)
- `hasTrendingSound` -- from `fv.audioTrendingMatch` (already implemented)
- `captionLength` -- from `fv.captionScore / 10` (already implemented)
- `followerTier = 0.5` -- no FeatureVector signal, keep default (acceptable)
- `weekdayPosted = 0.5` -- no FeatureVector signal, keep default (acceptable)
- `hourPosted = 0.5` -- no FeatureVector signal, keep default (acceptable)

**Net change:** Replace 4 hardcoded `0.5` values with real DeepSeek component score proxies. Keep 3 defaults (`hasFollowerData`, `followerTier` temporal features) that genuinely have no pipeline equivalent.

### Anti-Patterns to Avoid
- **Changing the model architecture:** Do NOT switch to a neural network, random forest, or SVM. The logistic regression is appropriate for this scale and the bottleneck is data quality, not model capacity.
- **Importing TensorFlow.js for a 200-line model:** The bundle size and cold start penalty are not worth it. Keep the hand-rolled implementation.
- **Using `readFileSync` in the retrain-ml cron for production:** The current `trainModel()` reads from the local filesystem. The rewritten cron should query Supabase `scraped_videos` and pass data directly, not write-then-read a JSON file.
- **Overriding model when accuracy drops:** The retrain-ml cron must gate on accuracy > 60% before replacing the production weights. This prevents bad training data from degrading the model.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Model persistence across deploys | In-memory caching only | Supabase Storage (already used) | Vercel cold starts lose module-level state |
| Feature normalization | Custom scaler class | Inline `clamp01` + manual normalization (already done) | Only 15 features, all already normalized to 0-1 in the training data |

**Key insight:** This phase is about DATA and WIRING, not model architecture. The existing hand-rolled logistic regression is correct and sufficient. The improvements come from better training data (class weighting, real features) and proper integration (aggregator wiring, DB persistence).

## Common Pitfalls

### Pitfall 1: Class Weight Explosion
**What goes wrong:** Extremely imbalanced classes (e.g., tier 5 with 594 samples vs tier 1 with 1457) can cause inverse-frequency weights to be so large that the model overfit to the minority class.
**Why it happens:** Weight of 1.98 for tier 5 vs 0.80 for tier 1 is only ~2.5x ratio, which is manageable. But if scraping produces even more imbalanced data in the future, weights could diverge.
**How to avoid:** Cap class weights at a maximum ratio (e.g., 3x the minimum weight). Log class weights during training for monitoring.
**Warning signs:** Training accuracy is high but validation accuracy drops. Confusion matrix shows tier 5 predicted too aggressively at the expense of tier 3/4.

### Pitfall 2: Feature Bridge Domain Mismatch
**What goes wrong:** The model was trained on engagement RATES (shares/views, comments/views), but inference uses content QUALITY scores (shareability 0-10). These are semantically related but not identical distributions.
**Why it happens:** The training features are normalized engagement metrics from real TikTok videos. The inference features are AI-assessed quality scores. They correlate but have different distributional shapes.
**How to avoid:** Normalize inference features to the same 0-1 range as training features. Accept that the model's accuracy on live predictions may be lower than on training data -- this is inherent in the domain gap.
**Warning signs:** Model predicts well on training/test data but all live predictions cluster in tier 2-3 (the model plays it safe when features are out-of-distribution).

### Pitfall 3: Aggregator Weight Sum Drift
**What goes wrong:** Adding `ml` as a 5th signal changes the `selectWeights()` redistribution math. If the ML model isn't loaded, its 15% redistributes to the other 4 signals -- but the ratios change relative to the current 4-signal system.
**Why it happens:** Current fallback (no ML): behavioral 0.45, gemini 0.25, rules 0.20, trends 0.10. New fallback (no ML): weights redistribute proportionally, giving slightly different values than the current hard-coded defaults.
**How to avoid:** Test `selectWeights()` with all combinations of signal availability. Ensure that when ML is unavailable, the remaining 4 signals get weights that are proportionally equivalent to their relative standing (behavioral should still be the dominant signal).
**Warning signs:** Score regression after deployment -- existing predictions change scores because the base weights changed even when ML is present.

### Pitfall 4: Retrain Cron Timeout on Vercel
**What goes wrong:** The retrain-ml cron queries `scraped_videos` (could be 10K+ rows), computes features, trains 200 epochs, evaluates, and uploads weights -- all in one Vercel function invocation.
**Why it happens:** Vercel Pro plan has a 60s timeout. Hobby plan has 10s. The current static JSON training runs in 5-15s. Dynamic generation adds a Supabase query + feature computation overhead.
**How to avoid:** Use `maxDuration = 120` (already on the analyze route). Limit scraped_videos query to most recent 10K rows. Monitor execution time in cron response.
**Warning signs:** Cron returns 504 Gateway Timeout. Training completes but weights aren't uploaded because the function timed out during Supabase Storage upload.

### Pitfall 5: Tier Assignment from Scraped Videos
**What goes wrong:** The training data needs virality tier labels (1-5) assigned to each scraped video. If the tier boundaries are arbitrary or poorly calibrated, the model learns incorrect patterns.
**Why it happens:** scraped_videos have raw metrics (views, likes, shares, comments) but no pre-assigned tier. The tier must be derived from view count (or composite engagement) using percentile-based boundaries.
**How to avoid:** Use percentile-based tier assignment: compute percentiles of view counts across all scraped videos, then assign tiers based on quintiles (20th, 40th, 60th, 80th percentile boundaries). This naturally handles the distribution shape and avoids hard-coded view count thresholds that become stale.
**Warning signs:** Most videos assigned to tier 1 or tier 5 (boundaries too extreme). Or all videos cluster in tier 2-3 (boundaries too tight).

## Code Examples

### Training Data Generation from scraped_videos

The retrain-ml cron must replace the static `training-data.json` with dynamic data from Supabase. Here is the data flow:

```typescript
// 1. Query scraped_videos with engagement metrics
const { data: videos } = await supabase
  .from("scraped_videos")
  .select("views, likes, shares, comments, duration_seconds, hashtags, sound_name, description, author, metadata, created_at")
  .not("views", "is", null)
  .not("likes", "is", null)
  .gt("views", 0)
  .order("created_at", { ascending: false })
  .limit(10000);

// 2. Compute engagement rates (same features as training-data.json)
function videoToFeatures(video: ScrapedVideo): number[] {
  const views = video.views ?? 1; // Avoid division by zero
  const likes = video.likes ?? 0;
  const shares = video.shares ?? 0;
  const comments = video.comments ?? 0;

  // No saves column in scraped_videos -- estimate from likes
  const estimatedSaves = likes * 0.15; // Industry average save:like ratio

  const shareRate = clamp01(shares / views);
  const commentRate = clamp01(comments / views);
  const likeRate = clamp01(likes / views);
  const saveRate = clamp01(estimatedSaves / views);
  const shareToLikeRatio = likes > 0 ? clamp01(shares / likes) : 0;
  const commentToLikeRatio = likes > 0 ? clamp01(comments / likes) : 0;
  const durationSeconds = clamp01((video.duration_seconds ?? 30) / 180);
  const hashtagCount = clamp01((video.hashtags?.length ?? 0) / 30);
  const hasTrendingSound = video.sound_name ? 1 : 0;
  const captionLength = clamp01((video.description?.length ?? 0) / 2000);

  // Follower data not available from scraped_videos
  const hasFollowerData = 0;
  const followerTier = 0.5;
  const viewsPerFollower = 0;

  // Temporal features from created_at
  const date = new Date(video.created_at ?? Date.now());
  const weekdayPosted = date.getUTCDay() / 6; // 0-1 (Sun=0, Sat=1)
  const hourPosted = date.getUTCHours() / 23; // 0-1

  return [
    shareRate, commentRate, likeRate, saveRate,
    shareToLikeRatio, commentToLikeRatio,
    durationSeconds, hashtagCount, hasTrendingSound, captionLength,
    hasFollowerData, followerTier, viewsPerFollower,
    weekdayPosted, hourPosted
  ];
}

// 3. Assign virality tiers using percentile-based boundaries
function assignTiers(videos: { views: number }[]): number[] {
  const sorted = [...videos].sort((a, b) => a.views - b.views);
  const p20 = sorted[Math.floor(sorted.length * 0.2)]?.views ?? 0;
  const p40 = sorted[Math.floor(sorted.length * 0.4)]?.views ?? 0;
  const p60 = sorted[Math.floor(sorted.length * 0.6)]?.views ?? 0;
  const p80 = sorted[Math.floor(sorted.length * 0.8)]?.views ?? 0;

  return videos.map(v => {
    if (v.views <= p20) return 1;
    if (v.views <= p40) return 2;
    if (v.views <= p60) return 3;
    if (v.views <= p80) return 4;
    return 5;
  });
}
```

### Per-Class Precision/Recall Logging

```typescript
// After evaluate(), compute per-class metrics from confusion matrix
function logPerClassMetrics(confusionMatrix: number[][]): void {
  for (let c = 0; c < NUM_CLASSES; c++) {
    const row = confusionMatrix[c];
    if (!row) continue;

    const truePositive = row[c] ?? 0;
    const actualTotal = row.reduce((a, b) => a + b, 0); // Row sum = all actual class c
    const predictedTotal = confusionMatrix.reduce(
      (sum, r) => sum + (r?.[c] ?? 0), 0
    ); // Column sum = all predicted as class c

    const precision = predictedTotal > 0 ? truePositive / predictedTotal : 0;
    const recall = actualTotal > 0 ? truePositive / actualTotal : 0;

    console.log(
      `Tier ${c + 1}: precision=${(precision * 100).toFixed(1)}% recall=${(recall * 100).toFixed(1)}% (${actualTotal} samples)`
    );
  }
}
```

### Aggregator 5-Signal Integration

```typescript
// New SCORE_WEIGHTS (replaces current 4-signal)
const SCORE_WEIGHTS = {
  behavioral: 0.35,
  gemini: 0.25,
  ml: 0.15,
  rules: 0.15,
  trends: 0.10,
} as const;

// Updated SignalAvailability
interface SignalAvailability {
  behavioral: boolean;
  gemini: boolean;
  ml: boolean;      // NEW: ML model loaded and prediction succeeded
  rules: boolean;
  trends: boolean;
}

// In aggregateScores(), call predictWithML:
import { predictWithML, featureVectorToMLInput } from "./ml";

const mlFeatures = featureVectorToMLInput(feature_vector);
const mlScore = await predictWithML(mlFeatures);
const mlAvailable = mlScore !== null;

// Add to overall score computation:
overall_score = Math.round(
  behavioral_score * weights.behavioral +
  gemini_score * weights.gemini +
  (mlScore ?? 0) * weights.ml +
  ruleResult.rule_score * weights.rules +
  trendEnrichment.trend_score * weights.trends
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static training-data.json | Dynamic generation from scraped_videos | This phase | Training data stays fresh as scraping continues |
| 4-signal aggregator (no ML) | 5-signal aggregator with ML | This phase | ML contributes 15% weight to predictions |
| Hardcoded 0.5 feature placeholders | Real FeatureVector-based feature bridge | This phase | Model receives meaningful input instead of noise |
| No class weighting | Inverse-frequency class weighting | This phase | Minority tiers (4, 5) get fair gradient signal |

**Deprecated/outdated:**
- `training-data.json`: Will be kept as fallback for local development but production uses dynamic generation
- Current 4-signal `SCORE_WEIGHTS` and `score_weights` type: Replaced by 5-signal version

## Codebase-Specific Findings

### Critical: scraped_videos has NO `saves` column
The `scraped_videos` table schema (from `database.types.ts` line 971) has: `views`, `likes`, `shares`, `comments` but NO `saves`/`bookmarks`. The Apify TikTok scraper does not return save counts. The `competitor_videos` table (line 109) DOES have `saves`, but that's a different data source.

**Impact on training data generation:** The `saveRate` feature must be estimated. Options:
1. Use `likes * 0.15` as a proxy (industry average save:like ratio for TikTok)
2. Set `saveRate = 0` for all scraped videos (honest but loses information)
3. **Recommended:** Use the proxy approach. The model can still learn from the other 14 features. The save rate proxy adds a weak signal that's better than nothing.

### Critical: `predictWithML` is never called
The function exists in `ml.ts` (line 351) and is exported, but NO file in the codebase imports or calls it. Neither `pipeline.ts` nor `aggregator.ts` reference it. Wiring it into the aggregator requires:
1. Making `aggregateScores()` async (currently sync)
2. Calling `predictWithML()` with the assembled feature vector
3. Including the ML score in the weighted sum

### Critical: `aggregateScores` is synchronous
Currently `aggregateScores(pipelineResult): PredictionResult` is a sync function. Adding `predictWithML()` (which calls `loadModel()` -> Supabase Storage download) makes it async. This affects:
- `src/app/api/analyze/route.ts` line 172: `const result = aggregateScores(pipelineResult)` must become `await aggregateScores(pipelineResult)`
- The return type changes to `Promise<PredictionResult>`

### Critical: PredictionResult.score_weights type needs `ml` field
The current type (types.ts line 150) is:
```typescript
score_weights: {
  behavioral: number;
  gemini: number;
  rules: number;
  trends: number;
};
```
This must add `ml: number`. Since this is a JSON column in the DB, no migration is needed -- JSONB accepts any shape. But the TypeScript type and the `selectWeights()` return type must be updated.

### Training data size: adequate
- Current static file: 5,886 train + 1,472 test = 7,358 total samples
- 15 features, 5 classes
- This is adequate for logistic regression. Rule of thumb: 10x features per class = 10 * 15 * 5 = 750 minimum. We have 10x that.

### ml_score DB column already exists
`analysis_results.ml_score` (database.types.ts line 660) is `number | null` with an optional insert field. The column exists but is never populated -- the `analyze/route.ts` insert (line 190) does not include `ml_score`. Adding it is a one-line change.

### Supabase Storage bucket assumption
The code assumes a `ml-weights` bucket exists in Supabase Storage. If it doesn't exist, `trainModel()` will fail on upload. The retrain-ml cron should handle this gracefully (try-catch on upload, create bucket if needed, or document as a setup requirement).

## Open Questions

1. **Tier assignment strategy for dynamic training data**
   - What we know: scraped_videos have raw view counts. Current static training-data.json already has tiers assigned (distribution: 1457/1481/1479/875/594).
   - What's unclear: How were tiers assigned in the original static file? Were they percentile-based or view-count-threshold-based?
   - Recommendation: Use percentile-based quintile assignment (20/40/60/80th percentiles). This automatically produces balanced-ish classes and adapts to the data distribution. Document the boundaries in the training output for debugging.

2. **Should `aggregateScores` call `predictWithML` or should the pipeline handle it?**
   - What we know: The pipeline runs stages (Gemini, DeepSeek, rules, trends) and returns raw outputs. The aggregator combines them.
   - What's unclear: ML prediction is fast (<10ms) but requires loading model weights (Supabase download on cold start, cached thereafter). Is this a "pipeline stage" or an "aggregator concern"?
   - Recommendation: Call it in the aggregator. The ML prediction is lightweight and depends on the feature vector (assembled in the aggregator). It's conceptually a scoring step, not a data-gathering pipeline stage. Making aggregateScores async is a minimal change.

3. **Accuracy target realism**
   - What we know: Current model is ~31% on 5 classes (random chance = 20%). Target is >75%.
   - What's unclear: With only engagement metrics as features (no content analysis features in training data), the ceiling may be lower than 75%.
   - Recommendation: Class weighting alone typically improves accuracy by 10-20% on imbalanced data. Combined with properly normalized features, 60-75% is realistic. If 75% proves unachievable, the >60% accuracy gate in the retrain cron ensures the model at least provides value above random. The requirement can be revisited if the data ceiling is lower than expected.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/lib/engine/ml.ts` -- Full model implementation, 441 lines
- Codebase analysis: `src/lib/engine/aggregator.ts` -- 4-signal weight system, 382 lines
- Codebase analysis: `src/lib/engine/types.ts` -- PredictionResult, FeatureVector, score_weights types
- Codebase analysis: `src/app/api/cron/retrain-ml/route.ts` -- Current retrain cron, 67 lines
- Codebase analysis: `src/app/api/analyze/route.ts` -- DB insert, aggregateScores call
- Codebase analysis: `src/app/api/webhooks/apify/route.ts` -- Scraped video field mapping
- Codebase analysis: `src/types/database.types.ts` -- scraped_videos schema (no saves column), analysis_results.ml_score column exists
- Training data analysis: 5886 train / 1472 test, distribution {1:1457, 2:1481, 3:1479, 4:875, 5:594}

### Secondary (MEDIUM confidence)
- [Weighted Logistic Regression for Imbalanced Dataset - GeeksforGeeks](https://www.geeksforgeeks.org/machine-learning/weighted-logistic-regression-for-imbalanced-dataset/) -- Inverse-frequency class weighting formula
- [Improving Class Imbalance using Class Weights - Analytics Vidhya](https://www.analyticsvidhya.com/blog/2020/10/improve-class-imbalance-class-weights/) -- Class weight formula: `weight_c = total / (num_classes * count_c)`
- [scikit-learn train_test_split docs](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.train_test_split.html) -- Stratified split algorithm reference

### Tertiary (LOW confidence)
- TikTok save:like ratio estimate of 0.15 -- Based on general industry knowledge. Needs validation against actual data if competitor_videos with saves become available.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new libraries. All changes are to existing hand-rolled code.
- Architecture: HIGH -- Patterns are straightforward (class weighting, feature mapping, aggregator integration). All verified against codebase.
- Pitfalls: HIGH -- Identified from direct codebase analysis (missing saves column, sync aggregator, untested selectWeights changes).
- Training data strategy: MEDIUM -- Percentile-based tier assignment is standard but the specific boundaries depend on the scraped_videos distribution, which we haven't queried live.
- Accuracy target: MEDIUM -- 75% is ambitious for engagement-only features on 5 classes. May need to accept 60-70% and rely on the accuracy gate.

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (30 days -- stable domain, no library version dependencies)
