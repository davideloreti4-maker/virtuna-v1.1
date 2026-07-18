import { describe, it, expect } from "vitest";
import { buildAdaptProfile } from "../adapt-profile";
import type { ProfileRow } from "@/lib/kc/profile-role-map";

/**
 * buildAdaptProfile is the ONE bridge from a creator's ProfileRow to the flat AdaptProfile the
 * grounding-as-remix briefer re-voices toward. All three generate-by-remix runners share it, so a
 * drift here silently changes how every skill describes the creator to the briefer. These pin the
 * two non-trivial mappings (structured target_audience → one line; `{ url }[]` outcomes → strings)
 * and the cold-start degrade.
 */

describe("buildAdaptProfile", () => {
  it("flattens the structured target_audience into one line and reduces outcomes to strings", () => {
    const row: ProfileRow = {
      niche_primary: "personal-finance",
      primary_goal: "grow to 100k",
      writing_voice_sample: "blunt, no fluff",
      target_audience: {
        age_range: "25-34",
        gender_skew: "male",
        geo: "US",
        language: "en",
      },
      past_wins: [{ url: "https://x/win1" }, { url: "https://x/win2" }],
      past_flops: [{ url: "https://x/flop1" }],
    };

    expect(buildAdaptProfile(row)).toEqual({
      niche_primary: "personal-finance",
      target_audience: "age 25-34, male-skewed, US, en",
      primary_goal: "grow to 100k",
      writing_voice_sample: "blunt, no fluff",
      past_wins: ["https://x/win1", "https://x/win2"],
      past_flops: ["https://x/flop1"],
    });
  });

  it("degrades every field to null on a cold-start (null profile) — never throws", () => {
    expect(buildAdaptProfile(null)).toEqual({
      niche_primary: null,
      target_audience: null,
      primary_goal: null,
      writing_voice_sample: null,
      past_wins: null,
      past_flops: null,
    });
  });

  it("returns null for an all-empty target_audience and for empty outcome lists (no 'undefined' leaks)", () => {
    const row: ProfileRow = {
      niche_primary: "fitness",
      target_audience: { age_range: null, gender_skew: null, geo: null, language: null },
      past_wins: [],
      past_flops: null,
    };

    const built = buildAdaptProfile(row);
    expect(built.target_audience).toBeNull();
    expect(built.past_wins).toBeNull();
    expect(built.past_flops).toBeNull();
    expect(built.niche_primary).toBe("fitness");
  });
});
