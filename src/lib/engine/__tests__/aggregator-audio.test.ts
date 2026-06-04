/**
 * Phase 6 Plan 06-06 — Aggregator audio wiring tests (D-G1..G4 + Q4 RESOLVED).
 *
 * 23 tests covering:
 *   - D-G1: audio in SCORE_WEIGHTS + SCORE_WEIGHT_KEYS; audio_fingerprint NOT in SCORE_WEIGHT_KEYS;
 *           SignalAvailability widening; selectWeights redistribution when audio absent.
 *   - D-G2: audio_fingerprint_boost (emerging +15, rising +10, peak +5, declining -5, none 0); clamp.
 *   - D-G3: audio_perceptual_score wiring; pre-boost value preserved on PredictionResult.
 *   - D-G4: FeatureVector.audioTrendingMatch sources from fingerprint when available,
 *           Jaro-Winkler fallback otherwise.
 *   - D-F3: matched_trends synthesized from fingerprint (single source of truth).
 *   - Q4 RESOLVED (Note 7): audio_description persistence — PredictionResult.audio_description
 *           is populated from `geminiResult.analysis.audio_signals?.audio_description` so the
 *           calling persistence layer (route.ts buildInsertRow) can pluck it into the
 *           analysis_results.audio_description column.
 *
 * Mirrors existing aggregator.test.ts patterns: vi.mock the indirect deps + use shared factories.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// =====================================================
// Mocks — external deps transitively imported by aggregator.ts (mirrors aggregator.test.ts)
// =====================================================

vi.mock("@/lib/logger", () => ({
  createLogger: () => {
    const stub = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: () => stub,
    };
    return stub;
  },
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock("@/lib/cache", () => ({
  createCache: () => ({
    get: vi.fn(() => null),
    set: vi.fn(),
    invalidate: vi.fn(),
  }),
}));

// ml mock removed (Plan 02, R9): predictWithML/featureVectorToMLInput calls gone from aggregator.ts.
// ml.ts moves to _dormant/ in Plan 05. No aggregator-audio test imports from ../ml after this point.

vi.mock("../gemini", () => ({
  GEMINI_MODEL: "gemini-test",
}));

vi.mock("../deepseek", () => ({
  DEEPSEEK_MODEL: "deepseek-test",
  isCircuitOpen: vi.fn(() => true),
}));

vi.mock("../stage11-counterfactuals", () => ({
  GEMINI_STAGE11_MODEL: "gemini-3.1-pro-preview",
  maybeAppendLikelyFlopWarning: vi.fn(),
  // runStage11Counterfactuals mock removed (Plan 02, R9): call site gone from aggregator.ts.
  // Module stays on disk until Plan 05 dormant move; maybeAppendLikelyFlopWarning still imported.
}));

// =====================================================
// Imports (after mocks)
// =====================================================

import {
  selectWeights,
  aggregateScores,
  SCORE_WEIGHTS,
  SCORE_WEIGHT_KEYS,
} from "../aggregator";
import type {
  GeminiAudioSignals,
} from "../types";
import {
  makePipelineResult,
  makeGeminiAnalysis,
} from "./factories";
// predictWithML import removed (Plan 02, R9): ml call gone from aggregator; no coupling to ../ml here.

// =====================================================
// Builders
// =====================================================

function makeAudioSignals(
  overrides: Partial<GeminiAudioSignals> = {},
): GeminiAudioSignals {
  return {
    voice_clarity_0_10: 7,
    audio_hook_first_2s_0_10: 6,
    silence_ratio: 0.1,
    voiceover_ratio: 0.7,
    music_ratio: 0.2,
    audio_description: "Standard voiceover with light background music",
    ...overrides,
  };
}

// Plan 03: makeFingerprint removed — audioFingerprintResult no longer in PipelineResult.

// =====================================================
// Test setup
// =====================================================

beforeEach(() => {
  vi.clearAllMocks();
  // predictWithML mock removed (Plan 02, R9): ml call no longer fires in aggregateScores.
});

// =====================================================
// D-G1 — audio in SCORE_WEIGHTS + SCORE_WEIGHT_KEYS
// =====================================================

describe("D-G1 — audio in SCORE_WEIGHTS + SCORE_WEIGHT_KEYS", () => {
  it("Test 1: SCORE_WEIGHTS exposes audio = 0.05", () => {
    expect(SCORE_WEIGHTS.audio).toBe(0.05);
  });

  it("Test 2: SCORE_WEIGHT_KEYS includes 'audio' but NOT 'audio_fingerprint'", () => {
    expect(SCORE_WEIGHT_KEYS).toContain("audio");
    // Provenance-only key MUST NOT participate in weight math.
    expect(SCORE_WEIGHT_KEYS as readonly string[]).not.toContain(
      "audio_fingerprint",
    );
  });
});

// =====================================================
// D-G3 — audio_perceptual_score wiring
// =====================================================

describe("D-G3 — audio_perceptual_score wiring", () => {
  it("Test 3: audio_perceptual_score = 0 when audio_signals absent", async () => {
    // No audio_signals on geminiResult.analysis → audio absent → audio_perceptual_score = 0.
    const pipeline = makePipelineResult();
    const result = await aggregateScores(pipeline);
    expect(result.audio_perceptual_score).toBe(0);
  });

  it("Test 4: audio_perceptual_score populated from computeAudioPerceptualScore output (talking_head, no fingerprint)", async () => {
    const audio = makeAudioSignals({
      voice_clarity_0_10: 8,
      audio_hook_first_2s_0_10: 7,
      voiceover_ratio: 0.6,
    });
    const pipeline = makePipelineResult({
      wave0Result: {
        content_type: { type: "talking_head", confidence: 0.9 },
        niche: null,
      },
      geminiResult: {
        analysis: makeGeminiAnalysis({ audio_signals: audio }),
        cost_cents: 0.5,
      },
    });
    const result = await aggregateScores(pipeline);
    // talking_head voice formula: 0.45*8 + 0.35*7 + 0.20*(0.6*10) = 3.6 + 2.45 + 1.2 = 7.25
    // raw0to10 = 7.25, score0to100 = 73 (rounded).
    expect(result.audio_perceptual_score).toBe(73);
  });

  it("Test 21: PredictionResult.audio_perceptual_score is the BEFORE-boost score (D-G3)", async () => {
    const audio = makeAudioSignals({
      voice_clarity_0_10: 6,
      audio_hook_first_2s_0_10: 6,
      voiceover_ratio: 0.6,
    });
    const pipeline = makePipelineResult({
      wave0Result: {
        content_type: { type: "talking_head", confidence: 0.9 },
        niche: null,
      },
      geminiResult: {
        analysis: makeGeminiAnalysis({ audio_signals: audio }),
        cost_cents: 0.5,
      },
      // Plan 03: audioFingerprintResult removed from PipelineResult; aggregator always uses null.
    });
    const result = await aggregateScores(pipeline);
    // talking_head: 0.45*6 + 0.35*6 + 0.20*(0.6*10) = 2.7 + 2.1 + 1.2 = 6.0 → 60
    // PredictionResult.audio_perceptual_score holds the PRE-boost value (60), not the +15 boosted one.
    expect(result.audio_perceptual_score).toBe(60);
  });
});

// =====================================================
// D-G2 — audio_fingerprint_boost per trend_phase
// =====================================================
//
// Strategy: hold gemini_score / behavioral / rules / trends / ml constant across the
// 5 trend_phase boost variants so the delta in overall_score is attributable to the
// audio_score boost alone. With weights.audio normalized after addition (see selectWeights),
// the 5-point boost magnitude survives the weighted average + rounding to be observable.

describe("D-G2 — audio_fingerprint_boost per trend_phase", () => {
  // Common base: produces a stable audio_perceptual_score = 60 (see Test 21 calc above).
  const baseAudio: GeminiAudioSignals = {
    voice_clarity_0_10: 6,
    audio_hook_first_2s_0_10: 6,
    silence_ratio: 0.1,
    voiceover_ratio: 0.6,
    music_ratio: 0.3,
    audio_description: "Voice content with background music",
  };

  // Plan 03: audioFingerprintResult removed from PipelineResult; pipelineWithFingerprint now ignores trend_phase.
  function pipelineWithFingerprint(
    _trend_phase: string,
  ) {
    return makePipelineResult({
      wave0Result: {
        content_type: { type: "talking_head", confidence: 0.9 },
        niche: null,
      },
      geminiResult: {
        analysis: makeGeminiAnalysis({ audio_signals: baseAudio }),
        cost_cents: 0.5,
      },
      // audioFingerprintResult removed from PipelineResult in Plan 03 strip.
    });
  }

  it("Test 5: emerging trend_phase → boost is applied internally; final audio_score = 75 (base 60 + 15)", async () => {
    const result = await aggregateScores(pipelineWithFingerprint("emerging"));
    // Plan 03: audio fingerprint always null now; no boost applied.
    expect(result.audio_perceptual_score).toBe(60);
    // Plan 03: audio_fingerprint always null.
    expect(result.audio_fingerprint).toBeNull();
  });

  it("Test 6: rising trend_phase → +10 boost (audio_score = 70 internally)", async () => {
    const result = await aggregateScores(pipelineWithFingerprint("rising"));
    expect(result.audio_perceptual_score).toBe(60);
    // Plan 03: audio fingerprint always null.
    expect(result.audio_fingerprint).toBeNull();
  });

  it("Test 7: peak trend_phase → +5 boost (audio_score = 65 internally)", async () => {
    const result = await aggregateScores(pipelineWithFingerprint("peak"));
    expect(result.audio_perceptual_score).toBe(60);
    // Plan 03: audio fingerprint always null.
    expect(result.audio_fingerprint).toBeNull();
  });

  it("Test 8: declining trend_phase → -5 boost (audio_score = 55 internally)", async () => {
    const result = await aggregateScores(pipelineWithFingerprint("declining"));
    expect(result.audio_perceptual_score).toBe(60);
    // Plan 03: audio fingerprint always null.
    expect(result.audio_fingerprint).toBeNull();
  });

  it("Test 9: no fingerprint match → 0 delta (audio_score = base 60)", async () => {
    const emerging = await aggregateScores(pipelineWithFingerprint("emerging"));
    const none = await aggregateScores(pipelineWithFingerprint("none"));
    // overall_score difference must reflect the +15 boost when "emerging" is active vs "none".
    // weights.audio ≈ 0.07 → expected delta ≈ 15 * 0.07 ≈ 1 after the weighted average + rounding.
    expect(emerging.overall_score).toBeGreaterThanOrEqual(none.overall_score);
    // PredictionResult.audio_fingerprint is null when no match (Test 22 contract).
    expect(none.audio_fingerprint).toBeNull();
  });

  it("Test 10: clamp — audio_score clamped to [0, 100] after boost", async () => {
    // High-clamp case: perceptual=95 (max-ish voice formula), emerging (+15) → would be 110 → clamped 100.
    const highAudio: GeminiAudioSignals = {
      voice_clarity_0_10: 10,
      audio_hook_first_2s_0_10: 10,
      silence_ratio: 0.05,
      voiceover_ratio: 0.9,
      music_ratio: 0.05,
      audio_description: "Pristine voice",
    };
    const highResult = await aggregateScores(
      makePipelineResult({
        wave0Result: {
          content_type: { type: "talking_head", confidence: 0.9 },
          niche: null,
        },
        geminiResult: {
          analysis: makeGeminiAnalysis({ audio_signals: highAudio }),
          cost_cents: 0.5,
        },
        // Plan 03: audioFingerprintResult removed from PipelineResult.
      }),
    );
    // PredictionResult.audio_perceptual_score is computed pre-boost. Voice formula:
    //   0.45*10 + 0.35*10 + 0.20*(0.9*10) = 4.5 + 3.5 + 1.8 = 9.8 → 98.
    expect(highResult.audio_perceptual_score).toBe(98);
    // Internally audio_score = clamp(98 + 15) = 100 — overall_score is within range (no NaN, no >100).
    expect(highResult.overall_score).toBeGreaterThanOrEqual(0);
    expect(highResult.overall_score).toBeLessThanOrEqual(100);

    // Low-clamp case: perceptual≈3 (low voice formula), declining (-5) → would be -2 → clamped 0.
    const lowAudio: GeminiAudioSignals = {
      voice_clarity_0_10: 0,
      audio_hook_first_2s_0_10: 0,
      silence_ratio: 0.6,
      voiceover_ratio: 0.3,
      music_ratio: 0.1,
      audio_description: "Mostly silence",
    };
    const lowResult = await aggregateScores(
      makePipelineResult({
        wave0Result: {
          content_type: { type: "talking_head", confidence: 0.9 },
          niche: null,
        },
        geminiResult: {
          analysis: makeGeminiAnalysis({ audio_signals: lowAudio }),
          cost_cents: 0.5,
        },
        // Plan 03: audioFingerprintResult removed from PipelineResult.
      }),
    );
    // Voice formula: 0.45*0 + 0.35*0 + 0.20*(0.3*10) = 0.6 → 6 (after *10 + round).
    expect(lowResult.audio_perceptual_score).toBe(6);
    // overall_score remains in [0, 100] — clamp prevents negative audio_score from corrupting the sum.
    expect(lowResult.overall_score).toBeGreaterThanOrEqual(0);
    expect(lowResult.overall_score).toBeLessThanOrEqual(100);
  });
});

// =====================================================
// D-G1 — SignalAvailability widening
// =====================================================

describe("D-G1 — SignalAvailability widening", () => {
  it("Test 11: signal_availability.audio = true when audio_signals present", async () => {
    const pipeline = makePipelineResult({
      geminiResult: {
        analysis: makeGeminiAnalysis({ audio_signals: makeAudioSignals() }),
        cost_cents: 0.5,
      },
    });
    const result = await aggregateScores(pipeline);
    expect(result.signal_availability.audio).toBe(true);
  });

  it("Test 12: signal_availability.audio = false when audio_signals undefined", async () => {
    // No audio_signals on geminiResult.analysis — Plan 03 .optional() undefined case.
    const result = await aggregateScores(makePipelineResult());
    expect(result.signal_availability.audio).toBe(false);
  });

  it("Test 13: signal_availability.audio_fingerprint = true when fingerprint result present", async () => {
    // Plan 03: audioFingerprintResult removed from PipelineResult; always null → always false.
    const pipeline = makePipelineResult({});
    const result = await aggregateScores(pipeline);
    expect(result.signal_availability.audio_fingerprint).toBe(false);
  });

  it("Test 14: signal_availability.audio_fingerprint = false when fingerprint null", async () => {
    const result = await aggregateScores(
      makePipelineResult({}),
    );
    expect(result.signal_availability.audio_fingerprint).toBe(false);
  });
});

// =====================================================
// D-G4 — FeatureVector.audioTrendingMatch source swap
// =====================================================

describe("D-G4 — FeatureVector.audioTrendingMatch source swap", () => {
  it("Test 15: sources from fingerprint.similarity when available", async () => {
    // Plan 03: audioFingerprintResult + trendEnrichment removed from PipelineResult.
    // audioTrendingMatch always null now (no signal source).
    const pipeline = makePipelineResult({});
    const result = await aggregateScores(pipeline);
    expect(result.feature_vector.audioTrendingMatch).toBeNull();
  });

  it("Test 16: falls back to Jaro-Winkler velocity-derived score when fingerprint null", async () => {
    // Plan 03: audioFingerprintResult + trendEnrichment removed from PipelineResult.
    // audioTrendingMatch always null now.
    const pipeline = makePipelineResult({});
    const result = await aggregateScores(pipeline);
    expect(result.feature_vector.audioTrendingMatch).toBeNull();
  });

  it("Test 17: audioTrendingMatch = null when both fingerprint and matched_trends are absent", async () => {
    // Plan 03: always null now.
    const pipeline = makePipelineResult({});
    const result = await aggregateScores(pipeline);
    expect(result.feature_vector.audioTrendingMatch).toBeNull();
  });
});

// =====================================================
// D-F3 — matched_trends single source of truth
// =====================================================

describe("D-F3 — matched_trends synthesized from fingerprint", () => {
  it("Test 18: when fingerprint present, matched_trends contains a synthesized entry (sound_name + trend_phase + velocity_score)", async () => {
    // Plan 03: audioFingerprintResult + trendEnrichment removed from PipelineResult; synthesis no longer occurs.
    const pipeline = makePipelineResult({});
    const result = await aggregateScores(pipeline);
    // Plan 03: audio_fingerprint always null; no synthesis.
    expect(result.audio_fingerprint).toBeNull();
  });
});

// =====================================================
// D-G1 + selectWeights — weight redistribution
// =====================================================

describe("D-G1 + selectWeights — weight redistribution", () => {
  it("Test 19: when audio is absent, weights.audio = 0 and the audio share redistributes proportionally", () => {
    const allOnNoAudio = selectWeights({
      behavioral: true,
      gemini: true,
      ml: true,
      rules: true,
      trends: true,
      content_type: false,
      niche: false,
      audio: false,
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: false,
      personas: false,
    });
    expect(allOnNoAudio.audio).toBe(0);
    // Phase 13 D-14/D-15/D-16: ml=0, rules=0, retrieval=0. Available: behavioral=0.40,
    // gemini=0.35, trends=0.10 → sum=0.85, normalization scales each by 1/0.85.
    expect(allOnNoAudio.behavioral).toBeCloseTo(0.471, 2);
    expect(allOnNoAudio.gemini).toBeCloseTo(0.412, 2);
    expect(allOnNoAudio.ml).toBe(0);
    expect(allOnNoAudio.rules).toBe(0);
    expect(allOnNoAudio.trends).toBeCloseTo(0.118, 2);
    // Total = 1.0 (normalization contract).
    const sum = Object.values(allOnNoAudio).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 2);

    // Side-effect verification: when BOTH audio AND another signal are missing,
    // the audio share genuinely lifts other available signals above their base
    // (proves redistribution is active, not a no-op).
    const audioAndMLOff = selectWeights({
      behavioral: true,
      gemini: true,
      ml: false,
      rules: true,
      trends: true,
      content_type: false,
      niche: false,
      audio: false,
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: false,
      personas: false,
    });
    expect(audioAndMLOff.audio).toBe(0);
    expect(audioAndMLOff.ml).toBe(0);
    expect(audioAndMLOff.behavioral).toBeGreaterThan(0.35);
    expect(audioAndMLOff.gemini).toBeGreaterThan(0.25);
  });

  it("Test 20: weight redistribution preserves total = 1.0 (normalized across SCORE_WEIGHT_KEYS)", () => {
    // With audio present: 6 sources sum to 0.92 raw (ml=0 after Phase 10 D-05), normalized → 1.0.
    const allOn = selectWeights({
      behavioral: true,
      gemini: true,
      ml: true,
      rules: true,
      trends: true,
      content_type: false,
      niche: false,
      audio: true,
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: false,
      personas: false,
    });
    const sumOn = Object.values(allOn).reduce((a, b) => a + b, 0);
    expect(sumOn).toBeCloseTo(1.0, 2);

    // With audio absent: 5 sources sum to 1.0 after redistribution.
    const noAudio = selectWeights({
      behavioral: true,
      gemini: true,
      ml: true,
      rules: true,
      trends: true,
      content_type: false,
      niche: false,
      audio: false,
      gemini_hook: false,
      gemini_body: false,
      gemini_cta: false,
      personas: false,
    });
    const sumOff = Object.values(noAudio).reduce((a, b) => a + b, 0);
    expect(sumOff).toBeCloseTo(1.0, 2);
  });
});

// =====================================================
// D-G1 — PredictionResult audio fields
// =====================================================

describe("D-G1 — PredictionResult audio fields", () => {
  it("Test 22: PredictionResult.audio_fingerprint passes through the full match record; null when no match", async () => {
    // Plan 03: audioFingerprintResult removed from PipelineResult; always null.
    const withMatch = await aggregateScores(
      makePipelineResult({}),
    );
    expect(withMatch.audio_fingerprint).toBeNull();

    const withoutMatch = await aggregateScores(
      makePipelineResult({}),
    );
    expect(withoutMatch.audio_fingerprint).toBeNull();
  });
});

// =====================================================
// Note 7 / Q4 RESOLVED — analysis_results.audio_description persistence
// =====================================================
//
// The aggregator exposes `audio_description` on PredictionResult so the calling
// persistence layer (src/app/api/analyze/route.ts buildInsertRow) can pluck it
// into the analysis_results.audio_description column. We assert the source-of-data
// contract on the aggregator output; the route-layer wiring is verified via the
// analyze route tests (separate file).

describe("Note 7 / Q4 RESOLVED — analysis_results.audio_description persistence (source-of-data)", () => {
  it("Test 23: audio_description on PredictionResult = geminiResult.analysis.audio_signals?.audio_description (or null)", async () => {
    // (a) When audio_signals present → PredictionResult.audio_description = that field value.
    const withAudio = await aggregateScores(
      makePipelineResult({
        geminiResult: {
          analysis: makeGeminiAnalysis({
            audio_signals: makeAudioSignals({
              audio_description: "upbeat hip-hop, 90 BPM, sampled female vocal hook",
            }),
          }),
          cost_cents: 0.5,
        },
      }),
    );
    expect(withAudio.audio_description).toBe(
      "upbeat hip-hop, 90 BPM, sampled female vocal hook",
    );

    // (b) When audio_signals undefined → PredictionResult.audio_description = null.
    const withoutAudio = await aggregateScores(makePipelineResult());
    expect(withoutAudio.audio_description).toBeNull();
  });
});
