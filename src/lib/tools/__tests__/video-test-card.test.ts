import { describe, it, expect } from "vitest";
import {
  predictionResultToVideoTestCard,
  type VideoTestSource,
} from "@/lib/tools/video-test-card";
import { VideoTestCardBlockSchema } from "@/lib/tools/profile-blocks";
import type { PersonaSimulationResult } from "@/lib/engine/types";

// One valid PersonaSimulationResult. `scrolledAt` drives the stop/scroll derivation
// (stopped iff scroll_past_second >= 3, the ~3s hook window).
function persona(archetype: PersonaSimulationResult["archetype"], scrolledAt: number, reasoning = "because"): PersonaSimulationResult {
  return {
    persona_id: `p-${archetype}`,
    archetype,
    slot_type: "fyp",
    niche: "fitness",
    scroll_past_second: scrolledAt,
    watch_through_pct: 50,
    comment_intent: 0,
    share_intent: 0,
    save_intent: 0,
    rewatch_intent: 0,
    reasoning,
  };
}

const OPTS = { analysisId: "an-1", audienceName: "Skincare buyers", tier: "Directional" as const };

// 7 stops (>=3s) + 3 scrolls (<3s) → Strong (>=6), fraction "7/10 stopped".
function healthySource(): VideoTestSource {
  return {
    overall_score: 72,
    anti_virality_gated: false,
    persona_simulation_results: [
      persona("high_engager", 8, "hook grabbed me"),
      persona("saver", 6),
      persona("lurker", 5),
      persona("purposeful_viewer", 4),
      persona("niche_deep_buyer", 3),
      persona("loyalist", 10),
      persona("cross_niche_curiosity", 7),
      persona("tough_crowd", 1, "seen it before"),
      persona("sharer", 2),
      persona("niche_deep_scout", 0),
    ],
    hero: {
      verdict_line: "High potential",
      ceiling: "The middle sags after the demo.",
      the_one_fix: "Open on the after-shot.",
      go_no_go: "go",
      post_window: null,
    },
    apollo_reasoning: null,
    optimal_post_window: {
      day_of_week: "Tue",
      hour_range: [18, 21],
      timezone: "UTC",
      reasoning: "x",
      source: "niche",
    },
    verbatim: { hook: { spoken_words: "here's the one thing nobody tells you", on_screen_text: null } },
  };
}

describe("predictionResultToVideoTestCard", () => {
  it("maps a healthy video result → an honest, schema-valid card (sim1-max, bands-only)", () => {
    const block = predictionResultToVideoTestCard(healthySource(), OPTS);
    expect(block).not.toBeNull();
    // The block MUST validate against its own strict schema — proves NO smuggled 0-100 score.
    const parsed = VideoTestCardBlockSchema.safeParse(block);
    expect(parsed.success).toBe(true);

    expect(block!.props.model).toBe("sim1-max");
    expect(block!.props.verdict).toBe("High potential"); // the WORD, never the number
    expect(block!.props.goNoGo).toBe("go");
    expect(block!.props.band).toBe("Strong"); // 7 stops >= STRONG_THRESHOLD (6)
    expect(block!.props.fraction).toBe("7/10 stopped");
    expect(block!.props.analysisId).toBe("an-1");
    expect(block!.props.audienceName).toBe("Skincare buyers");
    expect(block!.props.postWindow).toBe("Tue 18:00–21:00 UTC");
    expect(block!.props.theOneFix).toBe("Open on the after-shot.");
    // The room anchor is the video's own verbatim hook (honest — what the clip said).
    expect(block!.props.conceptText).toBe("here's the one thing nobody tells you");
  });

  it("omits conceptText when the clip has no verbatim hook (silent/no-speech video)", () => {
    const src = healthySource();
    src.verbatim = null;
    const block = predictionResultToVideoTestCard(src, OPTS)!;
    expect(block.props.conceptText).toBeUndefined();
    // Still schema-valid (conceptText is optional).
    expect(VideoTestCardBlockSchema.safeParse(block).success).toBe(true);
  });

  it("carries NO 0-100 number anywhere in the serialized card (honesty spine)", () => {
    const block = predictionResultToVideoTestCard(healthySource(), OPTS);
    const json = JSON.stringify(block!.props);
    // The source score is 72 — it must not leak into any field.
    expect(json).not.toContain("72");
  });

  it("derives per-persona reactions from the sim (stop iff watched past the ~3s hook)", () => {
    const block = predictionResultToVideoTestCard(healthySource(), OPTS)!;
    const tough = block.props.reactions.find((r) => r.archetype === "tough_crowd");
    const engager = block.props.reactions.find((r) => r.archetype === "high_engager");
    expect(tough!.verdict).toBe("scroll"); // scrolled at 1s
    expect(engager!.verdict).toBe("stop"); // watched to 8s
    expect(engager!.quote).toBe("hook grabbed me");
  });

  it("returns null when there are NO per-persona results (no honest reaction → caller degrades)", () => {
    const src = healthySource();
    src.persona_simulation_results = [];
    expect(predictionResultToVideoTestCard(src, OPTS)).toBeNull();
  });

  it("bands on the flash thresholds: 3-5 stops = Mixed, <3 = Weak", () => {
    const mixed = healthySource();
    // 4 stops (>=3s), 6 scrolls.
    mixed.persona_simulation_results = [
      persona("high_engager", 5), persona("saver", 4), persona("lurker", 3), persona("loyalist", 9),
      persona("tough_crowd", 1), persona("sharer", 0), persona("purposeful_viewer", 2),
      persona("niche_deep_buyer", 1), persona("niche_deep_scout", 0), persona("cross_niche_curiosity", 2),
    ];
    expect(predictionResultToVideoTestCard(mixed, OPTS)!.props.band).toBe("Mixed");
    expect(predictionResultToVideoTestCard(mixed, OPTS)!.props.fraction).toBe("4/10 stopped");

    const weak = healthySource();
    weak.persona_simulation_results = [
      persona("high_engager", 5), persona("saver", 4), // 2 stops
      persona("lurker", 1), persona("loyalist", 0), persona("tough_crowd", 1),
      persona("sharer", 0), persona("purposeful_viewer", 2), persona("niche_deep_buyer", 1),
      persona("niche_deep_scout", 0), persona("cross_niche_curiosity", 2),
    ];
    expect(predictionResultToVideoTestCard(weak, OPTS)!.props.band).toBe("Weak");
  });

  it("falls back to a WORD verdict + no-go from the gate when the hero is absent", () => {
    const src = healthySource();
    src.hero = null;
    src.anti_virality_gated = true;
    src.overall_score = 22;
    const block = predictionResultToVideoTestCard(src, OPTS)!;
    expect(block.props.verdict).toBe("Don't post yet");
    expect(block.props.goNoGo).toBe("no-go");
    expect(block.props.theOneFix).toBeNull();
    expect(block.props.ceiling).toBeNull();
    // Still no number leaked despite deriving from score 22.
    expect(JSON.stringify(block.props)).not.toContain("22");
  });

  it("falls back to Apollo rewrites/ceiling for the fix + ceiling when the hero is absent", () => {
    const src = healthySource();
    src.hero = null;
    src.apollo_reasoning = {
      rewrites: [{ variant: "Lead with the number." }],
      ceiling_capper: "No proof shown.",
    };
    const block = predictionResultToVideoTestCard(src, OPTS)!;
    expect(block.props.theOneFix).toBe("Lead with the number.");
    expect(block.props.ceiling).toBe("No proof shown.");
  });

  it("clamps a long persona reasoning to a display-legible quote", () => {
    const src = healthySource();
    const long = "word ".repeat(120).trim(); // ~600 chars
    src.persona_simulation_results = [persona("high_engager", 8, long)];
    const block = predictionResultToVideoTestCard(src, OPTS)!;
    const q = block.props.reactions[0]!.quote;
    expect(q.length).toBeLessThanOrEqual(281); // <= cap + ellipsis
    expect(q.endsWith("…")).toBe(true);
  });
});
