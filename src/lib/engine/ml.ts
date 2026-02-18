import { readFileSync } from "fs";
import { join } from "path";
import { createServiceClient } from "@/lib/supabase/service";
import type { FeatureVector } from "./types";

// =====================================================
// Types
// =====================================================

export interface ModelWeights {
  weights: number[][]; // [numClasses x numFeatures]
  biases: number[];
  featureNames: string[];
  numClasses: number;
  trainedAt: string;
  accuracy: number;
  confusionMatrix: number[][];
}

export interface TrainingResult {
  weights: ModelWeights;
  trainAccuracy: number;
  testAccuracy: number;
  confusionMatrix: number[][];
}

interface TrainingData {
  featureNames: string[];
  trainSet: { features: number[][]; labels: number[] };
  testSet: { features: number[][]; labels: number[] };
}

// =====================================================
// Constants
// =====================================================

const NUM_CLASSES = 5;
const NUM_FEATURES = 15;
const LEARNING_RATE = 0.1;
const LR_DECAY = 0.999;
const EPOCHS = 200;
const L2_LAMBDA = 0.001;

// Tier midpoints for score conversion (virality tiers 1-5)
const TIER_MIDPOINTS = [12.5, 35, 55, 72.5, 90];

const STORAGE_BUCKET = "ml-weights";
const STORAGE_PATH = "model/ml-weights.json";

// Paths relative to project root (fallback for training data)
const TRAINING_DATA_PATH = join(
  process.cwd(),
  "src/lib/engine/training-data.json"
);

// =====================================================
// Module-level weight cache
// =====================================================

let cachedWeights: ModelWeights | null = null;

// =====================================================
// Core ML Functions
// =====================================================

/**
 * Softmax with numerical stability (log-sum-exp trick).
 * Returns probability distribution over 5 classes.
 */
function softmax(logits: number[]): number[] {
  const maxLogit = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - maxLogit));
  const sumExps = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sumExps);
}

/**
 * Seeded pseudo-random number generator (mulberry32).
 * Deterministic for reproducible weight initialization.
 */
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Compute accuracy and confusion matrix for a dataset.
 */
function evaluate(
  features: number[][],
  labels: number[],
  weights: number[][],
  biases: number[]
): { accuracy: number; confusionMatrix: number[][] } {
  const confusionMatrix: number[][] = Array.from({ length: NUM_CLASSES }, () =>
    Array.from({ length: NUM_CLASSES }, () => 0)
  );

  let correct = 0;
  for (let i = 0; i < features.length; i++) {
    const sample = features[i];
    const label = labels[i];
    if (sample === undefined || label === undefined) continue;

    const logits = computeLogits(sample, weights, biases);
    const probs = softmax(logits);
    const predicted = argmax(probs);
    const actual = label - 1; // Convert 1-5 to 0-4

    if (predicted === actual) correct++;
    const row = confusionMatrix[actual];
    if (row !== undefined) {
      row[predicted] = (row[predicted] ?? 0) + 1;
    }
  }

  return {
    accuracy: features.length > 0 ? correct / features.length : 0,
    confusionMatrix,
  };
}

/**
 * Compute logits: weights * features + biases
 */
function computeLogits(
  features: number[],
  weights: number[][],
  biases: number[]
): number[] {
  const logits: number[] = [];
  for (let c = 0; c < NUM_CLASSES; c++) {
    let logit = biases[c] ?? 0;
    const classWeights = weights[c];
    if (classWeights !== undefined) {
      for (let f = 0; f < NUM_FEATURES; f++) {
        logit += (classWeights[f] ?? 0) * (features[f] ?? 0);
      }
    }
    logits.push(logit);
  }
  return logits;
}

/**
 * Find index of maximum value in array.
 */
function argmax(arr: number[]): number {
  let maxIdx = 0;
  let maxVal = arr[0] ?? -Infinity;
  for (let i = 1; i < arr.length; i++) {
    const val = arr[i] ?? -Infinity;
    if (val > maxVal) {
      maxVal = val;
      maxIdx = i;
    }
  }
  return maxIdx;
}

// =====================================================
// Class Weighting, Stratified Split & Per-Class Metrics
// =====================================================

/**
 * Compute inverse-frequency class weights.
 * Formula: weight_c = total_samples / (num_classes * count_c)
 * Capped at 3x the minimum weight to prevent overfitting to rare classes.
 *
 * Labels are 1-indexed (1-5). Maps label - 1 to index into counts array.
 */
function computeClassWeights(labels: number[], numClasses: number): number[] {
  const counts = new Array<number>(numClasses).fill(0);
  for (const label of labels) {
    const idx = label - 1;
    if (idx >= 0 && idx < numClasses) {
      counts[idx] = (counts[idx] ?? 0) + 1;
    }
  }
  const total = labels.length;
  const rawWeights = counts.map((count) =>
    count > 0 ? total / (numClasses * count) : 1.0
  );

  // Cap at 3x the minimum weight to prevent overfitting
  const minWeight = Math.min(...rawWeights);
  const maxAllowed = minWeight * 3;
  return rawWeights.map((w) => Math.min(w, maxAllowed));
}

/**
 * Stratified train/test split: partitions samples by label with proportional
 * representation in both sets. Uses Fisher-Yates shuffle with provided RNG
 * for deterministic reproducibility.
 */
export function stratifiedSplit(
  features: number[][],
  labels: number[],
  testRatio: number,
  rng: () => number
): {
  train: { features: number[][]; labels: number[] };
  test: { features: number[][]; labels: number[] };
} {
  // Group indices by label value
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
      features: trainIndices.map((i) => features[i]!),
      labels: trainIndices.map((i) => labels[i]!),
    },
    test: {
      features: testIndices.map((i) => features[i]!),
      labels: testIndices.map((i) => labels[i]!),
    },
  };
}

/**
 * Log per-class precision and recall from a confusion matrix.
 * confusionMatrix[actual][predicted] — rows are actual, columns are predicted.
 */
function logPerClassMetrics(
  confusionMatrix: number[][],
  setName: string
): void {
  for (let c = 0; c < NUM_CLASSES; c++) {
    const row = confusionMatrix[c];
    if (!row) continue;

    const truePositive = row[c] ?? 0;
    const rowSum = row.reduce((a, b) => a + b, 0); // All actual class c
    const colSum = confusionMatrix.reduce(
      (sum, r) => sum + (r?.[c] ?? 0),
      0
    ); // All predicted as class c

    const precision = colSum > 0 ? truePositive / colSum : 0;
    const recall = rowSum > 0 ? truePositive / rowSum : 0;

    console.log(
      `[ml] ${setName} Tier ${c + 1}: precision=${(precision * 100).toFixed(1)}% recall=${(recall * 100).toFixed(1)}% (${rowSum} samples)`
    );
  }
}

// =====================================================
// Training
// =====================================================

/**
 * Train multinomial logistic regression on extracted training data.
 *
 * Uses full-batch gradient descent with softmax cross-entropy loss,
 * L2 regularization, and inverse-frequency class weighting.
 *
 * @param input - One of:
 *   - string: path to training data JSON file
 *   - object: pre-computed { trainSet, testSet, featureNames } (for retrain cron)
 *   - undefined: uses default TRAINING_DATA_PATH
 */
export async function trainModel(
  input?:
    | string
    | {
        trainSet: { features: number[][]; labels: number[] };
        testSet: { features: number[][]; labels: number[] };
        featureNames: string[];
      }
): Promise<TrainingResult> {
  // Load training data from file or use provided data directly
  let trainSet: { features: number[][]; labels: number[] };
  let testSet: { features: number[][]; labels: number[] };
  let featureNames: string[];

  if (typeof input === "object" && input !== null) {
    // Pre-computed data passed directly (e.g., from retrain cron)
    ({ trainSet, testSet, featureNames } = input);
  } else {
    // Load from file path
    const dataPath = (typeof input === "string" ? input : undefined) ?? TRAINING_DATA_PATH;
    const rawData = readFileSync(dataPath, "utf-8");
    const data: TrainingData = JSON.parse(rawData) as TrainingData;
    ({ trainSet, testSet, featureNames } = data);
  }

  const trainFeatures = trainSet.features;
  const trainLabels = trainSet.labels;
  const n = trainFeatures.length;

  // Compute inverse-frequency class weights (capped at 3x min)
  const classWeights = computeClassWeights(trainLabels, NUM_CLASSES);
  const weightLog = classWeights
    .map((w, i) => `Tier ${i + 1}=${w.toFixed(3)}`)
    .join(" ");
  console.log(`[ml] Class weights: ${weightLog} (capped at 3x min)`);

  // Initialize weights with small random values (seeded for reproducibility)
  const rng = seededRandom(42);
  const weights: number[][] = Array.from({ length: NUM_CLASSES }, () =>
    Array.from({ length: NUM_FEATURES }, () => (rng() - 0.5) * 0.01)
  );
  const biases: number[] = Array.from({ length: NUM_CLASSES }, () => 0);

  // Gradient descent
  let lr = LEARNING_RATE;

  for (let epoch = 0; epoch < EPOCHS; epoch++) {
    // Initialize gradient accumulators
    const gradW: number[][] = Array.from({ length: NUM_CLASSES }, () =>
      Array.from({ length: NUM_FEATURES }, () => 0)
    );
    const gradB: number[] = Array.from({ length: NUM_CLASSES }, () => 0);

    // Compute gradients over full batch
    for (let i = 0; i < n; i++) {
      const sample = trainFeatures[i];
      const label = trainLabels[i];
      if (sample === undefined || label === undefined) continue;

      const logits = computeLogits(sample, weights, biases);
      const probs = softmax(logits);

      // Cross-entropy gradient: prob - one_hot(label)
      // Multiply by class weight for the sample's true class (inverse-frequency weighting)
      const target = label - 1; // Convert 1-5 to 0-4
      const classWeight = classWeights[target] ?? 1;
      for (let c = 0; c < NUM_CLASSES; c++) {
        const error = ((probs[c] ?? 0) - (c === target ? 1 : 0)) * classWeight;
        const gradBc = gradB[c];
        if (gradBc !== undefined) {
          gradB[c] = gradBc + error;
        }

        const classGrad = gradW[c];
        if (classGrad !== undefined) {
          for (let f = 0; f < NUM_FEATURES; f++) {
            const prev = classGrad[f] ?? 0;
            classGrad[f] = prev + error * (sample[f] ?? 0);
          }
        }
      }
    }

    // Update weights with gradient descent + L2 regularization
    for (let c = 0; c < NUM_CLASSES; c++) {
      const classWeights = weights[c];
      const classGrad = gradW[c];
      if (classWeights !== undefined && classGrad !== undefined) {
        for (let f = 0; f < NUM_FEATURES; f++) {
          const w = classWeights[f] ?? 0;
          const g = classGrad[f] ?? 0;
          // Gradient: (1/n) * sum_gradient + lambda * weight
          classWeights[f] = w - lr * (g / n + L2_LAMBDA * w);
        }
      }
      const b = biases[c];
      const gb = gradB[c];
      if (b !== undefined && gb !== undefined) {
        biases[c] = b - lr * (gb / n);
      }
    }

    // Decay learning rate
    lr *= LR_DECAY;

    // Log progress every 50 epochs
    if ((epoch + 1) % 50 === 0) {
      const trainEval = evaluate(trainFeatures, trainLabels, weights, biases);
      console.log(
        `Epoch ${epoch + 1}/${EPOCHS} - lr: ${lr.toFixed(5)} - train accuracy: ${(trainEval.accuracy * 100).toFixed(1)}%`
      );
    }
  }

  // Evaluate on train and test sets
  const trainEval = evaluate(trainFeatures, trainLabels, weights, biases);
  const testEval = evaluate(testSet.features, testSet.labels, weights, biases);

  console.log(
    `\nFinal - Train accuracy: ${(trainEval.accuracy * 100).toFixed(1)}% | Test accuracy: ${(testEval.accuracy * 100).toFixed(1)}%`
  );

  // Log per-class precision/recall for both sets
  logPerClassMetrics(trainEval.confusionMatrix, "Train");
  logPerClassMetrics(testEval.confusionMatrix, "Test");

  // Build model weights object
  const modelWeights: ModelWeights = {
    weights,
    biases,
    featureNames,
    numClasses: NUM_CLASSES,
    trainedAt: new Date().toISOString(),
    accuracy: testEval.accuracy,
    confusionMatrix: testEval.confusionMatrix,
  };

  // Persist to Supabase Storage
  const supabase = createServiceClient();
  const weightsJson = JSON.stringify(modelWeights, null, 2);
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(STORAGE_PATH, weightsJson, {
      contentType: "application/json",
      upsert: true,
    });

  if (uploadError) {
    console.error("[ml] Failed to upload weights to storage:", uploadError);
    throw new Error(`Failed to persist ML weights: ${uploadError.message}`);
  }
  console.log(`[ml] Model weights saved to ${STORAGE_BUCKET}/${STORAGE_PATH}`);

  // Update module cache
  cachedWeights = modelWeights;

  return {
    weights: modelWeights,
    trainAccuracy: trainEval.accuracy,
    testAccuracy: testEval.accuracy,
    confusionMatrix: testEval.confusionMatrix,
  };
}

// =====================================================
// Model Loading
// =====================================================

/**
 * Load model weights from Supabase Storage with module-level caching.
 * Returns null if weights don't exist (model not yet trained).
 */
export async function loadModel(): Promise<ModelWeights | null> {
  if (cachedWeights !== null) return cachedWeights;

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(STORAGE_PATH);

    if (error || !data) return null;

    const raw = await data.text();
    cachedWeights = JSON.parse(raw) as ModelWeights;
    return cachedWeights;
  } catch {
    console.error("[ml] Failed to load ML model weights from storage");
    return null;
  }
}

// =====================================================
// Inference
// =====================================================

/**
 * Predict virality score (0-100) from a feature array.
 *
 * Computes softmax probabilities over 5 virality tiers,
 * then converts to a continuous score via weighted tier midpoints.
 *
 * Returns null if model is not available (graceful degradation).
 */
export async function predictWithML(features: number[]): Promise<number | null> {
  const model = await loadModel();
  if (model === null) return null;

  const logits = computeLogits(features, model.weights, model.biases);
  const probs = softmax(logits);

  // Weighted sum of tier midpoints by class probabilities
  let score = 0;
  for (let c = 0; c < NUM_CLASSES; c++) {
    score += (probs[c] ?? 0) * (TIER_MIDPOINTS[c] ?? 0);
  }

  // Clamp to 0-100
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

// =====================================================
// Feature Vector Bridge
// =====================================================

/**
 * Convert a pipeline FeatureVector to the 15-feature array format
 * expected by the ML model.
 *
 * The training data uses engagement metrics from scraped videos;
 * the inference path uses pipeline features. This mapping bridges
 * the two representations. The model's value comes from learning
 * engagement patterns that transfer to content feature patterns.
 *
 * Feature order must match training data featureNames:
 * [shareRate, commentRate, likeRate, saveRate, shareToLikeRatio,
 *  commentToLikeRatio, durationSeconds, hashtagCount, hasTrendingSound,
 *  captionLength, hasFollowerData, followerTier, viewsPerFollower,
 *  weekdayPosted, hourPosted]
 */
export function featureVectorToMLInput(fv: Partial<FeatureVector>): number[] {
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

  // Engagement metrics are NOT in FeatureVector (they're from scraped data).
  // Use 0.5 defaults -- the model learns correlations with content features
  // that proxy these engagement signals.
  const shareRate = 0.5;
  const commentRate = 0.5;
  const likeRate = 0.5;
  const saveRate = 0.5;

  // Derive share-to-like and comment-to-like from FeatureVector signals
  // Map shareability (0-10) and commentProvocation (0-10) to proxy ratios
  const shareToLikeRatio = clamp01((fv.shareTrigger ?? 5) / 10);
  const commentToLikeRatio = clamp01((fv.commentProvocation ?? 5) / 10);

  // Duration (normalized to 0-1, capped at 180s)
  const durationSeconds = clamp01((fv.durationSeconds ?? 30) / 180);

  // Hashtag count (normalized, capped at 30)
  const hashtagCount = clamp01((fv.hashtagCount ?? 5) / 30);

  // Trending sound match
  const hasTrendingSound = fv.audioTrendingMatch != null && fv.audioTrendingMatch > 0 ? 1 : 0;

  // Caption score mapped to caption length proxy (0-10 -> 0-1 range)
  const captionLength = clamp01((fv.captionScore ?? 5) / 10);

  // Follower data -- default to not available from pipeline context
  const hasFollowerData = 0;
  const followerTier = 0.5; // unknown tier
  const viewsPerFollower = 0;

  // Temporal features -- not available from pipeline, use middle-of-week defaults
  const weekdayPosted = 0.5; // mid-week
  const hourPosted = 0.5; // midday

  return [
    shareRate,
    commentRate,
    likeRate,
    saveRate,
    shareToLikeRatio,
    commentToLikeRatio,
    durationSeconds,
    hashtagCount,
    hasTrendingSound,
    captionLength,
    hasFollowerData,
    followerTier,
    viewsPerFollower,
    weekdayPosted,
    hourPosted,
  ];
}
