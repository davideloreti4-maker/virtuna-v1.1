/**
 * Phase 2 Plan 01 (R1) — Omni Plus verbatim contracts Wave 0 regression test.
 *
 * Guards all verbatim threading hops so the emotion_arc drop (26/26 null prod
 * rows) cannot recur for verbatim fields. Covers:
 *   - OmniAnalysisZodSchema accepts / rejects verbatim fields
 *   - Exported SegmentSchema accepts per-segment verbatim (transport type)
 *   - buildSystemPrompt contains all required field names + fidelity rules
 *   - analyzeVideoWithOmni assembly hop — hook_verbatim lands on geminiResult.analysis
 *   - per-segment spoken_text survives normalizeSegments (via out.segments[0])
 *   - null-vs-[inaudible] contract (D-02 / D-04.2)
 *
 * Written BEFORE schema/prompt edits (Tasks 2-3) so schema/prompt/assembly cases
 * START RED and turn GREEN as Tasks 2-3 land.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  OmniAnalysisZodSchema,
  SegmentSchema,
} from "@/lib/engine/qwen/schemas";
import { buildSystemPrompt, analyzeVideoWithOmni } from "@/lib/engine/qwen/omni-analysis";

// =====================================================
// Module mocks (used by the assembly-path tests below)
// =====================================================
vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  })),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn() }));

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));
vi.mock("openai", () => {
  const MockOpenAI = vi.fn(function (this: Record<string, unknown>) {
    this.chat = { completions: { create: mockCreate } };
  });
  return { default: MockOpenAI };
});

process.env.DASHSCOPE_API_KEY = "test-key";

// =====================================================
// Fixture helper
// =====================================================

/**
 * Build a complete, Zod-valid Omni response fixture.
 *
 * @param withVerbatim - include hook_verbatim + per-segment spoken_text/on_screen_text
 * @param silent       - when true and withVerbatim, spoken_words === null (no speech)
 * @param hasUnclearSpeech - when true and withVerbatim, spoken_words contains [inaudible]
 */
function makeOmniResponse(
  withVerbatim: boolean,
  silent?: boolean,
  hasUnclearSpeech?: boolean,
): string {
  const body: Record<string, unknown> = {
    content_type: "talking_head",
    niche_primary_slug: "tech",
    niche_micro_slug: "dev_tools",
    factors: [
      { name: "Scroll-Stop Power", score: 3, rationale: "weak open" },
      { name: "Completion Pull",   score: 5, rationale: "mid retention" },
      { name: "Rewatch Potential", score: 2, rationale: "low" },
      { name: "Share Trigger",     score: 4, rationale: "some" },
      { name: "Emotional Charge",  score: 3, rationale: "flat affect" },
    ],
    overall_impression: "A low-production talking-head teaser.",
    content_summary: "Dev introduces a tool to camera.",
    hook_visual_impact: 3,
    hook_decomposition: {
      visual_stop_power:        3,
      audio_hook_quality:       4,
      text_overlay_score:       2,
      first_words_speech_score: 3,
      weakest_modality:         "text_overlay_score",
      visual_audio_coherence:   6,
      cognitive_load:           4,
      watermark_detected:       { tiktok: false, ig: false, yt: false },
    },
    video_signals: {
      visual_production_quality: 4,
      pacing_score:              3,
      transition_quality:        4,
    },
    cta_segment: {
      cta_present: false,
      strength:    null,
      type:        null,
      rationale:   "no explicit ask",
    },
    audio_signals: {
      voice_clarity_0_10:       7,
      audio_hook_first_2s_0_10: 3,
      silence_ratio:            0.1,
      voiceover_ratio:          0.8,
      music_ratio:              0.1,
      audio_description:        "Clear voiceover throughout with minimal background music.",
    },
    audio_perceptual_score: 72,
    emotion_arc: [
      { timestamp_ms: 0,     intensity_0_1: 0.3, label: "low" },
      { timestamp_ms: 5000,  intensity_0_1: 0.6, label: "mid" },
      { timestamp_ms: 15000, intensity_0_1: 0.8, label: "high" },
    ],
    // 5 segments so normalizeSegments does NOT fall back to fixed buckets
    // (MIN_BOUNDARY_COUNT=4; 2-segment fixture triggers fallback, stripping verbatim)
    segments: [
      { t_start: 0,  t_end: 3,  visual_event: "talking head", audio_event: "greeting" },
      { t_start: 3,  t_end: 8,  visual_event: "screen share", audio_event: "explanation" },
      { t_start: 8,  t_end: 16, visual_event: "demo",         audio_event: "walkthrough" },
      { t_start: 16, t_end: 24, visual_event: "cta card",     audio_event: "call to action" },
      { t_start: 24, t_end: 30, visual_event: "outro",        audio_event: "sign off" },
    ],
  };

  if (withVerbatim) {
    if (silent) {
      // D-02: silence → null; NOT "[inaudible]", NOT a description
      (body as Record<string, unknown>).hook_verbatim = {
        spoken_words:   null,
        on_screen_text: null,
      };
    } else if (hasUnclearSpeech) {
      // D-04.2: present-but-unintelligible → [inaudible]; NOT null
      (body as Record<string, unknown>).hook_verbatim = {
        spoken_words:   "[inaudible] to my channel, here's how to...",
        on_screen_text: "SUBSCRIBE NOW",
      };
    } else {
      (body as Record<string, unknown>).hook_verbatim = {
        spoken_words:   "Welcome to my channel, here's how to build this.",
        on_screen_text: "SUBSCRIBE NOW",
      };
    }
    // Per-segment verbatim on first segment (hook zone 0-3s)
    (body.segments as Record<string, unknown>[])[0] = {
      ...(body.segments as Record<string, unknown>[])[0],
      spoken_text:    silent ? null : (hasUnclearSpeech ? "[inaudible]" : "Welcome to my channel"),
      on_screen_text: silent ? null : "SUBSCRIBE NOW",
    };
  }

  return JSON.stringify(body);
}

// =====================================================
// Schema validation tests
// =====================================================

describe("verbatim — OmniAnalysisZodSchema validation", () => {
  it("Schema ACCEPT: response with hook_verbatim + per-segment spoken_text/on_screen_text parses to success", () => {
    const withVerbatim = {
      hook_verbatim: {
        spoken_words:   "Welcome to my channel.",
        on_screen_text: "SUBSCRIBE",
      },
      segments: [
        {
          t_start:        0,
          t_end:          3,
          visual_event:   "talking head",
          audio_event:    "greeting",
          spoken_text:    "Welcome to my channel.",
          on_screen_text: "SUBSCRIBE",
        },
      ],
    };
    const result = OmniAnalysisZodSchema.partial().safeParse(withVerbatim);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hook_verbatim).toBeDefined();
      expect(result.data.hook_verbatim?.spoken_words).toBe("Welcome to my channel.");
      expect(result.data.segments?.[0]).toHaveProperty("spoken_text", "Welcome to my channel.");
      expect(result.data.segments?.[0]).toHaveProperty("on_screen_text", "SUBSCRIBE");
    }
  });

  it("Schema BACKWARD-COMPAT: response without verbatim fields still parses to success", () => {
    const result = OmniAnalysisZodSchema.partial().safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hook_verbatim).toBeUndefined();
    }
  });

  it("Schema CAP REJECT: spoken_words longer than 280 chars fails safeParse", () => {
    const overCap = {
      hook_verbatim: {
        spoken_words: "a".repeat(281),
      },
    };
    const result = OmniAnalysisZodSchema.partial().safeParse(overCap);
    expect(result.success).toBe(false);
  });

  it("Schema CAP REJECT: segment spoken_text longer than 500 chars fails safeParse", () => {
    const overCap = {
      segments: [
        {
          t_start:     0,
          t_end:       3,
          visual_event: "talking head",
          audio_event:  "greeting",
          spoken_text:  "a".repeat(501),
        },
      ],
    };
    const result = OmniAnalysisZodSchema.partial().safeParse(overCap);
    expect(result.success).toBe(false);
  });

  it("Schema NULLABLE: hook_verbatim.spoken_words accepts null (D-02 silence contract)", () => {
    const silent = {
      hook_verbatim: {
        spoken_words:   null,
        on_screen_text: null,
      },
    };
    const result = OmniAnalysisZodSchema.partial().safeParse(silent);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hook_verbatim?.spoken_words).toBeNull();
    }
  });
});

// =====================================================
// Exported SegmentSchema ACCEPT
// =====================================================

describe("verbatim — exported SegmentSchema (transport type)", () => {
  it("SegmentSchema ACCEPT: parses a segment carrying spoken_text + on_screen_text (SegmentGrid carries them through normalizeSegments)", () => {
    const seg = {
      t_start:        0,
      t_end:          3,
      visual_event:   "talking head",
      audio_event:    "greeting",
      spoken_text:    "Welcome to my channel.",
      on_screen_text: "SUBSCRIBE NOW",
    };
    const result = SegmentSchema.safeParse(seg);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.spoken_text).toBe("Welcome to my channel.");
      expect(result.data.on_screen_text).toBe("SUBSCRIBE NOW");
    }
  });

  it("SegmentSchema ACCEPT: parses a segment with null spoken_text (D-02 silence)", () => {
    const seg = {
      t_start:        0,
      t_end:          3,
      visual_event:   "screen",
      audio_event:    "silence",
      spoken_text:    null,
      on_screen_text: null,
    };
    const result = SegmentSchema.safeParse(seg);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.spoken_text).toBeNull();
    }
  });

  it("SegmentSchema BACKWARD-COMPAT: parses a segment without verbatim fields", () => {
    const seg = {
      t_start:      0,
      t_end:        3,
      visual_event: "talking head",
      audio_event:  "greeting",
    };
    const result = SegmentSchema.safeParse(seg);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.spoken_text).toBeUndefined();
    }
  });

  it("SegmentSchema CAP REJECT: spoken_text longer than 500 chars fails", () => {
    const seg = {
      t_start:      0,
      t_end:        3,
      visual_event: "talking head",
      audio_event:  "greeting",
      spoken_text:  "a".repeat(501),
    };
    const result = SegmentSchema.safeParse(seg);
    expect(result.success).toBe(false);
  });
});

// =====================================================
// Prompt literal tests
// =====================================================

describe("verbatim — buildSystemPrompt literal checks", () => {
  it("PROMPT LITERAL: output contains 'hook_verbatim'", () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).toContain("hook_verbatim");
  });

  it("PROMPT LITERAL: output contains 'spoken_text'", () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).toContain("spoken_text");
  });

  it("PROMPT LITERAL: output contains 'on_screen_text'", () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).toContain("on_screen_text");
  });

  it("PROMPT FIDELITY: output contains '[inaudible]' rule (D-04.2)", () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).toContain("[inaudible]");
  });

  it("PROMPT FIDELITY: output contains 'translate' prohibition (D-04.1)", () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).toContain("translate");
  });

  it("PROMPT FIDELITY: output contains 'null' absence-contract cue (D-02)", () => {
    const prompt = buildSystemPrompt({});
    // The absence contract should instruct null for no speech/text
    expect(prompt).toContain("null");
  });
});

// =====================================================
// Assembly hop regression
// =====================================================

describe("verbatim — analyzeVideoWithOmni assembly (regression)", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("ASSEMBLY HOP: threads model-emitted hook_verbatim onto geminiResult.analysis", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: makeOmniResponse(true) } }],
      usage: { prompt_tokens: 100, completion_tokens: 150, total_tokens: 250 },
    });

    const out = await analyzeVideoWithOmni("https://example.com/v.mp4");

    // The exact field+path the aggregator reads (mirroring emotion_arc test :184)
    const verbatim = (out.geminiResult?.analysis as unknown as {
      hook_verbatim?: { spoken_words?: string | null; on_screen_text?: string | null };
    })?.hook_verbatim;

    expect(verbatim).toBeDefined();
    expect(verbatim?.spoken_words).toContain("Welcome to my channel");
  });

  it("ASSEMBLY PER-SEGMENT: spoken_text survives normalizeSegments (out.segments[0].spoken_text defined)", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: makeOmniResponse(true) } }],
      usage: { prompt_tokens: 100, completion_tokens: 150, total_tokens: 250 },
    });

    const out = await analyzeVideoWithOmni("https://example.com/v.mp4");

    // Per-segment verbatim must survive normalizeSegments transport
    // out.segments is SegmentGrid[] — if spoken_text missing from SegmentSchema, it's stripped here
    expect(out.segments).toBeDefined();
    expect(out.segments?.[0]).toHaveProperty("spoken_text");
    const seg0 = out.segments?.[0] as Record<string, unknown> | undefined;
    expect(seg0?.spoken_text).toBeTruthy();
  });

  it("ASSEMBLY BACKWARD-COMPAT: model omits hook_verbatim → analysis.hook_verbatim is undefined (no crash)", async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: makeOmniResponse(false) } }],
      usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
    });

    const out = await analyzeVideoWithOmni("https://example.com/v.mp4");

    const verbatim = (out.geminiResult?.analysis as unknown as {
      hook_verbatim?: unknown;
    })?.hook_verbatim;

    expect(verbatim).toBeUndefined();
    // Sanity: rest of assembly still succeeded
    expect(out.geminiResult?.analysis.factors).toHaveLength(5);
  });
});

// =====================================================
// D-02 / D-04.2 null-vs-[inaudible] contract
// =====================================================

describe("verbatim — null vs [inaudible] contract (D-02 / D-04.2)", () => {
  it("NULL CONTRACT: silent fixture has hook_verbatim.spoken_words === null (NOT '[inaudible]', NOT a description)", () => {
    const parsed = JSON.parse(makeOmniResponse(true, true));
    expect(parsed.hook_verbatim.spoken_words).toBeNull();
    expect(parsed.hook_verbatim.spoken_words).not.toBe("[inaudible]");
  });

  it("[inaudible] CONTRACT: unclear-speech fixture has spoken_words containing '[inaudible]' and NOT null", () => {
    const parsed = JSON.parse(makeOmniResponse(true, false, true));
    expect(parsed.hook_verbatim.spoken_words).not.toBeNull();
    expect(parsed.hook_verbatim.spoken_words).toContain("[inaudible]");
  });
});
