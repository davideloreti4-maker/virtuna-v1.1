import { describe, it, expect } from "vitest";
import { deriveCreatorRulebook } from "../creator-rulebook";
import type {
  CtaSegmentResult,
  Factor,
  GeminiAudioSignals,
  HookDecomposition,
  PredictionResult,
} from "../types";

// deriveCreatorRulebook reads only a handful of optional PredictionResult fields
// (hook_decomposition, video_signals, cta_segment, audio_signals, feature_vector,
// factors). We build minimal fixtures touching exactly those and cast — honest because
// the function never reads anything else.

function hook(overrides: Partial<HookDecomposition> = {}): HookDecomposition {
  return {
    visual_stop_power: 8,
    audio_hook_quality: 7,
    text_overlay_score: 7,
    first_words_speech_score: 6,
    weakest_modality: "none",
    visual_audio_coherence: 7,
    cognitive_load: 3, // INVERTED: low = good
    watermark_detected: { tiktok: false, ig: false, yt: false },
    ...overrides,
  } as HookDecomposition;
}

function factors(share = 8, emotion = 8): Factor[] {
  const mk = (name: string, score: number): Factor => ({
    id: name.toLowerCase().replace(/\s+/g, "_"),
    name,
    score,
    max_score: 10,
    rationale: "x",
    improvement_tip: "y",
  });
  return [
    mk("Scroll-Stop Power", 7),
    mk("Completion Pull", 7),
    mk("Rewatch Potential", 6),
    mk("Share Trigger", share),
    mk("Emotional Charge", emotion),
  ];
}

const audio = (hook2s: number | null): GeminiAudioSignals => ({
  voice_clarity_0_10: 7,
  audio_hook_first_2s_0_10: hook2s,
  silence_ratio: 0.1,
  voiceover_ratio: 0.7,
  music_ratio: 0.2,
  audio_description: "spoken voiceover over light music",
});

const cta = (present: boolean): CtaSegmentResult =>
  ({ cta_present: present, type: present ? "follow" : "none", rationale: "x" }) as CtaSegmentResult;

function result(p: Partial<PredictionResult> = {}): PredictionResult {
  return p as PredictionResult;
}

function full(overrides: Partial<PredictionResult> = {}): PredictionResult {
  return result({
    hook_decomposition: hook(),
    video_signals: { visual_production_quality: 8, hook_visual_impact: 8, pacing_score: 8, transition_quality: 7 },
    cta_segment: cta(true),
    audio_signals: audio(7),
    factors: factors(),
    feature_vector: { durationSeconds: 34 } as PredictionResult["feature_vector"],
    ...overrides,
  });
}

const byId = (rb: ReturnType<typeof deriveCreatorRulebook>, id: string) =>
  rb.checks.find((c) => c.id === id)!;

describe("deriveCreatorRulebook — structure & attribution", () => {
  it("emits 11 checks, each with a stable id and a valid creator attribution", () => {
    const rb = deriveCreatorRulebook(full());
    expect(rb.checks).toHaveLength(11);
    const ids = rb.checks.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length); // ids unique
    for (const c of rb.checks) {
      expect(["Hoyos", "Ava", "Hormozi"]).toContain(c.creator);
      expect(c.rule.length).toBeGreaterThan(0);
      expect(c.target.length).toBeGreaterThan(0);
    }
    // all three creators represented
    expect(new Set(rb.checks.map((c) => c.creator))).toEqual(new Set(["Hoyos", "Ava", "Hormozi"]));
  });

  it("is deterministic — same input twice yields identical output", () => {
    const input = full();
    expect(deriveCreatorRulebook(input)).toEqual(deriveCreatorRulebook(input));
  });

  it("a strong video passes its computable checks; counts and coverage add up", () => {
    const rb = deriveCreatorRulebook(full());
    expect(rb.coveragePct).toBe(100); // every signal present
    expect(rb.knownCount).toBe(11);
    expect(rb.passCount + rb.warnCount + rb.failCount).toBe(rb.knownCount);
    expect(rb.failCount).toBe(0);
  });
});

describe("Three-Hook Stack (Ava #2)", () => {
  it("3 modalities ≥4 → pass 3/3", () => {
    const rb = deriveCreatorRulebook(full({ hook_decomposition: hook() }));
    const c = byId(rb, "three_hook_stack");
    expect(c.status).toBe("pass");
    expect(c.actual).toBe("3/3");
  });
  it("2 of 3 present → warn 2/3", () => {
    const rb = deriveCreatorRulebook(
      full({ hook_decomposition: hook({ audio_hook_quality: 1 }) }),
    );
    const c = byId(rb, "three_hook_stack");
    expect(c.status).toBe("warn");
    expect(c.actual).toBe("2/3");
  });
  it("≤1 present → fail", () => {
    const rb = deriveCreatorRulebook(
      full({ hook_decomposition: hook({ text_overlay_score: 1, audio_hook_quality: 1 }) }),
    );
    expect(byId(rb, "three_hook_stack").status).toBe("fail");
  });
});

describe("cognitive_load is polarity-inverted (low = good)", () => {
  it("low load → pass", () => {
    const rb = deriveCreatorRulebook(full({ hook_decomposition: hook({ cognitive_load: 2 }) }));
    expect(byId(rb, "cognitive_load").status).toBe("pass");
  });
  it("high load → fail", () => {
    const rb = deriveCreatorRulebook(full({ hook_decomposition: hook({ cognitive_load: 9 }) }));
    expect(byId(rb, "cognitive_load").status).toBe("fail");
  });
});

describe("length_fit bands (Hoyos #5/#6, Ava #37)", () => {
  const lenStatus = (s: number | null) =>
    byId(deriveCreatorRulebook(full({ feature_vector: { durationSeconds: s } as PredictionResult["feature_vector"] })), "length_fit").status;
  it("~34s → pass", () => expect(lenStatus(34)).toBe("pass"));
  it("20s (sub-30) → warn", () => expect(lenStatus(20)).toBe("warn"));
  it("75s (over 60 cap) → warn", () => expect(lenStatus(75)).toBe("warn"));
  it("120s → fail", () => expect(lenStatus(120)).toBe("fail"));
  it("null duration → unknown", () => expect(lenStatus(null)).toBe("unknown"));
});

describe("watermark anti-pattern", () => {
  it("any platform watermarked → fail with list", () => {
    const rb = deriveCreatorRulebook(
      full({ hook_decomposition: hook({ watermark_detected: { tiktok: true, ig: false, yt: false } }) }),
    );
    const c = byId(rb, "clean_repost");
    expect(c.status).toBe("fail");
    expect(c.actual).toContain("TikTok");
  });
  it("no watermark → pass", () => {
    expect(byId(deriveCreatorRulebook(full()), "clean_repost").status).toBe("pass");
  });
  it("watermark_detected absent → unknown", () => {
    const rb = deriveCreatorRulebook(
      full({ hook_decomposition: hook({ watermark_detected: undefined }) }),
    );
    expect(byId(rb, "clean_repost").status).toBe("unknown");
  });
});

describe("CTA architecture (consensus #11)", () => {
  it("present → pass", () => expect(byId(deriveCreatorRulebook(full({ cta_segment: cta(true) })), "cta_architecture").status).toBe("pass"));
  it("absent → warn", () => expect(byId(deriveCreatorRulebook(full({ cta_segment: cta(false) })), "cta_architecture").status).toBe("warn"));
  it("no cta_segment → unknown", () => expect(byId(deriveCreatorRulebook(full({ cta_segment: undefined })), "cta_architecture").status).toBe("unknown"));
});

describe("graceful degradation on text / url inputs (no video signals)", () => {
  it("bare result → content checks unknown, never fabricated, coverage drops", () => {
    const rb = deriveCreatorRulebook(result({}));
    expect(rb.knownCount).toBe(0);
    expect(rb.coveragePct).toBe(0);
    for (const c of rb.checks) {
      expect(c.status).toBe("unknown");
      expect(c.actual).toBeNull();
    }
  });
  it("null audio_hook → that check is unknown, others still resolve", () => {
    const rb = deriveCreatorRulebook(full({ audio_signals: audio(null) }));
    expect(byId(rb, "audio_hook_2s").status).toBe("unknown");
    expect(byId(rb, "hook_strength").status).toBe("pass");
    expect(rb.knownCount).toBe(10);
  });
});
