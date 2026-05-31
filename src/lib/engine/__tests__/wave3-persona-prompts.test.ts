/**
 * Unit tests for Phase 7 persona prompt builders + PersonaResponseSchema (Plan 07-01 Task 3).
 *
 * Test surface:
 * - D-17 cache prefix byte-stability (Test 1, 2)
 * - D-19 + Pitfall 5 Zod schema validation (Test 3, 4, 5)
 * - PROFILE-16 host-only URL sanitization (Test 6)
 * - D-03 + Pitfall 3 null past_wins fallback (Test 7)
 * - D-11 content type echo (Test 8)
 * - Loyalist-only block boundary (Test 9)
 * - System prompt structure (Test 10)
 *
 * Pure-function tests — no DeepSeek client mocks needed.
 */
import { describe, it, expect } from "vitest";
import {
  buildPersonaSystemPrompt,
  buildPersonaUserMessage,
  PersonaResponseSchema,
  type OmniHookGrounding,
} from "../wave3/persona-prompts";
import type { PersonaSlot } from "../wave3/persona-registry";
import type { ContentPayload, DeepSeekReasoning, Wave0Result } from "../types";
import type { CreatorContext } from "../creator";

function makeSlot(overrides: Partial<PersonaSlot> = {}): PersonaSlot {
  return {
    persona_id: "fyp-1-saver-beauty",
    archetype: "saver",
    slot_type: "fyp",
    niche: "beauty",
    niche_label: "Beauty",
    archetype_definition:
      "You scroll TikTok with a 'this might be useful later' mindset. You bookmark practical content.",
    scroll_past_triggers: ["pure entertainment with no takeaway"],
    stop_triggers: ["step-by-step tutorials"],
    motivator: "utility-shopper",
    time_of_day_label: "Lunch-break browser",
    time_of_day_description:
      "10-15 minutes of focused scrolling between tasks. Patience is moderate.",
    niche_instantiation: "You bookmark step-by-step skincare routines and product layering tips.",
    ...overrides,
  };
}

function makePayload(overrides: Partial<ContentPayload> = {}): ContentPayload {
  return {
    content_text: "This is a video about skincare",
    content_type: "video",
    input_mode: "text",
    video_url: null,
    video_storage_path: null,
    hashtags: ["skincare", "beauty"],
    duration_hint: 30,
    niche: null,
    creator_handle: null,
    society_id: null,
    ...overrides,
  };
}

function makeCreatorContext(overrides: Partial<CreatorContext> = {}): CreatorContext {
  return {
    found: false,
    follower_count: null,
    avg_views: null,
    engagement_rate: null,
    niche: null,
    posting_frequency: null,
    platform_averages: {
      avg_views: 1000,
      avg_engagement_rate: 0.05,
      avg_share_rate: 0.01,
      avg_comment_rate: 0.02,
    },
    target_platforms: null,
    niche_primary: null,
    niche_sub: null,
    target_audience: null,
    primary_goal: null,
    creator_stage: null,
    content_style: null,
    cuts_per_second: null,
    reference_creators: null,
    past_wins: null,
    past_flops: null,
    time_of_day_aware: null,
    pain_points: null,
    ...overrides,
  };
}

function makeWave0Result(
  content_type: Wave0Result["content_type"] = null,
): Wave0Result {
  return { content_type, niche: null };
}

function makeDeepSeekResult(): DeepSeekReasoning {
  return {
    behavioral_predictions: {
      completion_pct: 50,
      completion_percentile: "top 50%",
      share_pct: 5,
      share_percentile: "top 50%",
      comment_pct: 3,
      comment_percentile: "top 50%",
      save_pct: 2,
      save_percentile: "top 50%",
    },
    component_scores: {
      hook_effectiveness: 7,
      retention_strength: 6,
      shareability: 5,
      comment_provocation: 4,
      save_worthiness: 6,
      trend_alignment: 5,
      originality: 6,
    },
    suggestions: [{ text: "x", priority: "high", category: "hook" }],
    warnings: [],
    confidence: "medium",
  };
}

describe("buildPersonaSystemPrompt (Phase 7 D-17 + Pitfall 1)", () => {
  it("PERSONA-08 + D-17: byte-stable for identical inputs", () => {
    const slot = makeSlot();
    const a = buildPersonaSystemPrompt(slot);
    const b = buildPersonaSystemPrompt(slot);
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(500);
  });

  it("D-17: changing time_of_day_label diverges output (cache invalidation signal)", () => {
    const a = buildPersonaSystemPrompt(makeSlot());
    const b = buildPersonaSystemPrompt(makeSlot({ time_of_day_label: "Different label" }));
    expect(a).not.toBe(b);
  });

  it("contains all 6 cache blocks per D-04 + D-05 (4 archetype blocks + niche + output format)", () => {
    const prompt = buildPersonaSystemPrompt(makeSlot());
    expect(prompt).toContain("## Your Behavioral Archetype");
    expect(prompt).toContain("## Your Scroll-Past + Stop Triggers");
    expect(prompt).toContain("## Your Psychographic Motivator");
    expect(prompt).toContain("## Your Current Context");
    expect(prompt).toContain("## Niche Instantiation");
    expect(prompt).toContain("## Output Format");
  });

  it("Pitfall 1: niche_instantiation lives in SYSTEM prompt (not user message)", () => {
    const slot = makeSlot({
      niche_instantiation: "UNIQUE_NICHE_MARKER_STRING_12345",
    });
    const prompt = buildPersonaSystemPrompt(slot);
    expect(prompt).toContain("UNIQUE_NICHE_MARKER_STRING_12345");
  });
});

describe("buildPersonaUserMessage (Phase 7 PROFILE-16 + D-03 + D-11)", () => {
  it("PROFILE-16: loyalist user message surfaces only host, never URL body", () => {
    const slot = makeSlot({ slot_type: "loyalist", niche_label: "Beauty" });
    const ctx = makeCreatorContext({
      past_wins: [{ url: "https://example.com/secret-path?q=user" }],
    });
    const msg = buildPersonaUserMessage(
      makePayload(),
      makeDeepSeekResult(),
      ctx,
      makeWave0Result(),
      slot,
    );
    expect(msg).toContain("example.com");
    expect(msg).not.toContain("secret-path");
    expect(msg).not.toContain("q=user");
  });

  it("Pitfall 3: loyalist with null past_wins falls back to generic niche-loyal framing", () => {
    const slot = makeSlot({ slot_type: "loyalist", niche_label: "Beauty" });
    const ctx = makeCreatorContext({ past_wins: null });
    const msg = buildPersonaUserMessage(
      makePayload(),
      makeDeepSeekResult(),
      ctx,
      makeWave0Result(),
      slot,
    );
    expect(msg).toContain("loyal follower of Beauty creators generally");
  });

  it("D-11: content type echo from Wave 0 surfaces in user message", () => {
    const slot = makeSlot();
    const wave0 = makeWave0Result({
      type: "tutorial",
      confidence: 0.85,
    });
    const msg = buildPersonaUserMessage(
      makePayload(),
      makeDeepSeekResult(),
      makeCreatorContext(),
      wave0,
      slot,
    );
    expect(msg).toContain("tutorial");
    expect(msg).toContain("0.85");
  });

  it("non-loyalist slots: user message does NOT include the loyalist-only block header", () => {
    const slot = makeSlot({ slot_type: "fyp" });
    const ctx = makeCreatorContext({
      past_wins: [{ url: "https://example.com/path" }],
    });
    const msg = buildPersonaUserMessage(
      makePayload(),
      makeDeepSeekResult(),
      ctx,
      makeWave0Result(),
      slot,
    );
    expect(msg).not.toContain("## Creator's Past Wins");
    // Also assert no host leak for non-loyalist personas (defense in depth)
    expect(msg).not.toContain("example.com");
  });

  it("Wave 2 synthesis context (component scores + warnings) surfaces when deepseekResult provided", () => {
    const slot = makeSlot();
    const deepseek = makeDeepSeekResult();
    deepseek.warnings = ["mock-warning"];
    const msg = buildPersonaUserMessage(
      makePayload(),
      deepseek,
      makeCreatorContext(),
      makeWave0Result(),
      slot,
    );
    expect(msg).toContain("Hook effectiveness");
    expect(msg).toContain("Retention strength");
    expect(msg).toContain("mock-warning");
  });

  it("handles null deepseekResult gracefully (omits Wave 2 context)", () => {
    const slot = makeSlot();
    const msg = buildPersonaUserMessage(
      makePayload(),
      null,
      makeCreatorContext(),
      makeWave0Result(),
      slot,
    );
    expect(msg).not.toContain("Hook effectiveness");
    expect(msg).toContain("React as your persona");
  });

  it("hookGrounding provided: message contains Video Craft Signals, visual stop power, and a factor name", () => {
    const slot = makeSlot();
    const hookGrounding: OmniHookGrounding = {
      hook: {
        visual_stop_power: 8,
        audio_hook_quality: 7,
        text_overlay_score: 6,
        first_words_speech_score: 9,
        weakest_modality: "text_overlay_score",
        visual_audio_coherence: 7,
        cognitive_load: 3,
        watermark_detected: undefined,
      },
      factors: [
        { name: "Scroll-Stop Power", score: 8 },
        { name: "Completion Pull", score: 7 },
      ],
    };
    const msg = buildPersonaUserMessage(
      makePayload(),
      null,
      makeCreatorContext(),
      makeWave0Result(),
      slot,
      hookGrounding,
    );
    expect(msg).toContain("Video Craft Signals");
    expect(msg).toContain("Visual stop power: 8/10");
    expect(msg).toContain("Scroll-Stop Power");
  });

  it("hookGrounding null/omitted: message does NOT contain Video Craft Signals", () => {
    const slot = makeSlot();
    const msgNull = buildPersonaUserMessage(
      makePayload(),
      null,
      makeCreatorContext(),
      makeWave0Result(),
      slot,
      null,
    );
    const msgOmitted = buildPersonaUserMessage(
      makePayload(),
      null,
      makeCreatorContext(),
      makeWave0Result(),
      slot,
    );
    expect(msgNull).not.toContain("Video Craft Signals");
    expect(msgOmitted).not.toContain("Video Craft Signals");
  });
});

describe("PersonaResponseSchema (Phase 7 D-19 + Pitfall 5)", () => {
  const canonical = {
    scroll_past_second: 5,
    watch_through_pct: 80,
    comment_intent: 20,
    share_intent: 30,
    save_intent: 70,
    rewatch_intent: 40,
    reasoning: "I'd save this for later — it has the kind of step-by-step structure I bookmark.",
  };

  it("accepts canonical sample", () => {
    const result = PersonaResponseSchema.safeParse(canonical);
    expect(result.success).toBe(true);
  });

  it("Pitfall 5: rejects empty reasoning", () => {
    const result = PersonaResponseSchema.safeParse({ ...canonical, reasoning: "" });
    expect(result.success).toBe(false);
  });

  it("rejects watch_through_pct > 100", () => {
    const result = PersonaResponseSchema.safeParse({ ...canonical, watch_through_pct: 120 });
    expect(result.success).toBe(false);
  });

  it("rejects negative scroll_past_second", () => {
    const result = PersonaResponseSchema.safeParse({ ...canonical, scroll_past_second: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects reasoning longer than 500 chars", () => {
    const result = PersonaResponseSchema.safeParse({
      ...canonical,
      reasoning: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});
