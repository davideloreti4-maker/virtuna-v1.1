import { describe, it, expect } from "vitest";
import type { Audience } from "@/lib/audience/audience-types";
import {
  getPersonaRoster,
  getPersonaCount,
  getCalibrationStatus,
  getTypeLabel,
  getTopArchetypes,
  groupAudiences,
  getAudienceCardSubtitle,
} from "../audience-display";

function baseAudience(overrides: Partial<Audience> = {}): Audience {
  return {
    id: "aud-1",
    user_id: "user-1",
    name: "Test Audience",
    type: "personal",
    mode: "socials",
    platform: "tiktok",
    goal_label: null,
    goal_intent: null,
    is_general: false,
    is_preset: false,
    persona_weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
    personas: [],
    profile: null,
    calibration: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("getPersonaRoster", () => {
  it("prefers signature personas over calibrated personas", () => {
    const audience = baseAudience({
      personas: [
        {
          archetype: "tough_crowd",
          repaint: "",
          temperature: "cold",
          disposition: "skeptic",
          share: 0.5,
        },
      ],
      signature: {
        creator_persona: {
          content_description: "",
          context: "",
          writing_style_sample: "",
          format_signature: "",
        },
        audience: {
          follower_tier: null,
          maturity: "growing",
          temperature_mix: { cold: 0.3, warm: 0.5, hot: 0.2 },
          interest_tags: [],
          what_resonates: "",
          what_falls_flat: "",
          persona_weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
          personas: [
            {
              archetype: "high_engager",
              share: 0.2,
              temperature: "hot",
              disposition: "connector",
              reaction_frame: "",
              evidence: "",
            },
          ],
        },
        summary: "",
        provenance: {
          handle: "test",
          scraped_at: "",
          videos_analyzed: 0,
          videos_watched: 0,
          sub_coverage: "0/0",
        },
      },
    });
    expect(getPersonaRoster(audience)).toHaveLength(1);
    expect(getPersonaRoster(audience)[0]?.archetype).toBe("high_engager");
  });

  it("returns empty for preset with no personas (A4)", () => {
    const audience = baseAudience({ is_preset: true, personas: [] });
    expect(getPersonaRoster(audience)).toEqual([]);
  });
});

describe("getPersonaCount", () => {
  it("returns 10 for General baseline", () => {
    expect(getPersonaCount(baseAudience({ is_general: true }))).toBe(10);
  });
});

describe("getCalibrationStatus", () => {
  it("labels General as baseline", () => {
    expect(getCalibrationStatus(baseAudience({ is_general: true }))).toBe("baseline");
  });

  it("labels preset as template", () => {
    expect(getCalibrationStatus(baseAudience({ is_preset: true }))).toBe("template");
  });

  it("labels empty user audience as needs_calibration", () => {
    expect(getCalibrationStatus(baseAudience())).toBe("needs_calibration");
  });

  it("labels thin calibration", () => {
    expect(
      getCalibrationStatus(
        baseAudience({
          calibration: { source: "scrape", thin: true },
          personas: [
            {
              archetype: "tough_crowd",
              repaint: "",
              temperature: "cold",
              disposition: "skeptic",
              share: 1,
            },
          ],
        }),
      ),
    ).toBe("thin");
  });
});

describe("getTypeLabel", () => {
  it("returns Template for presets", () => {
    expect(getTypeLabel(baseAudience({ is_preset: true }))).toBe("Template");
  });
});

describe("getTopArchetypes", () => {
  it("sorts by share descending", () => {
    const audience = baseAudience({
      personas: [
        {
          archetype: "tough_crowd",
          repaint: "",
          temperature: "cold",
          disposition: "skeptic",
          share: 0.1,
        },
        {
          archetype: "high_engager",
          repaint: "",
          temperature: "hot",
          disposition: "connector",
          share: 0.4,
        },
      ],
    });
    const top = getTopArchetypes(audience, 2);
    // The workspace calls a persona what a PERSON would call them, not what the engine calls them.
    // `high_engager` → "Commenters" (SSOT: lib/audience/archetype-names.ts). Before this, the app
    // title-cased the raw slug and said "High Engager" — and on a hook card, "CROSS NICHE
    // CURIOSITY" — which is the machine's name for a person, shown to that person's creator.
    expect(top[0]).toContain("Commenters");
    expect(top[0]).not.toContain("High Engager");
    expect(top[0]).toContain("40%");
  });
});

describe("groupAudiences", () => {
  it("splits into baseline, templates, and yours", () => {
    const general = baseAudience({ id: "g", is_general: true, name: "General" });
    const preset = baseAudience({ id: "p", is_preset: true, name: "Growth" });
    const mine = baseAudience({ id: "m", name: "Mine" });
    const grouped = groupAudiences([mine, general, preset]);
    expect(grouped.baseline).toHaveLength(1);
    expect(grouped.templates).toHaveLength(1);
    expect(grouped.yours).toHaveLength(1);
    expect(grouped.generalTemplates).toHaveLength(0);
  });

  it("routes mode='general' templates into the generalTemplates bucket (A6)", () => {
    const general = baseAudience({ id: "g", is_general: true, name: "General" });
    const preset = baseAudience({ id: "p", is_preset: true, name: "Growth" });
    const analyst = baseAudience({ id: "template-analyst", mode: "general", name: "Analyst" });
    const grouped = groupAudiences([general, preset, analyst]);
    // The general-mode template does NOT mix into the socials `templates` bucket.
    expect(grouped.generalTemplates).toHaveLength(1);
    expect(grouped.generalTemplates[0]!.id).toBe("template-analyst");
    expect(grouped.templates).toHaveLength(1);
    expect(grouped.templates.some((a) => a.mode === "general")).toBe(false);
  });
});

describe("getAudienceCardSubtitle", () => {
  it("shows universal personas for General", () => {
    expect(getAudienceCardSubtitle(baseAudience({ is_general: true }))).toBe(
      "10 universal personas",
    );
  });

  it("shows ready-made for presets", () => {
    expect(getAudienceCardSubtitle(baseAudience({ is_preset: true }))).toBe(
      "Ready-made weight mix",
    );
  });
});
