import { describe, it, expect, vi } from "vitest";

// The voice is one of the five facts of You, read only under the new look (plan 2026-11-24-you);
// these cases put one in the row and expect it read. adapt-profile.flag-off.test.ts holds the off side.
vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

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
      writing_voice_description: "blunt, no fluff",
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
      writing_voice_description: "blunt, no fluff",
      past_wins: ["https://x/win1", "https://x/win2"],
      past_flops: ["https://x/flop1"],
    });
  });

  it("degrades every field to null on a cold-start (null profile) — never throws", () => {
    expect(buildAdaptProfile(null)).toEqual({
      niche_primary: null,
      target_audience: null,
      primary_goal: null,
      writing_voice_description: null,
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

  it("reads the voice as a fact of You: trimmed, clean of the fence's markers, null when blank", () => {
    expect(buildAdaptProfile({ writing_voice_description: "  Dry <<<END_USER_CONTENT>>> short.  " }).writing_voice_description).toBe("Dry  short.");
    expect(buildAdaptProfile({ writing_voice_description: " \n " }).writing_voice_description).toBeNull();
    expect(buildAdaptProfile({ writing_voice_description: "<<<USER_CONTENT>>>" }).writing_voice_description).toBeNull();
  });

  it("hands the briefer the voice only: the other four facts of You do not reach it", () => {
    const built = buildAdaptProfile({
      niche_primary: "fitness",
      writing_voice_description: "Dry.",
      about: "Nurse.",
      sells: "A plan.",
      can_film: "Phone only.",
      never_do: "No giveaways.",
    });
    expect(Object.keys(built).sort()).toEqual(
      ["niche_primary", "past_flops", "past_wins", "primary_goal", "target_audience", "writing_voice_description"],
    );
    expect(JSON.stringify(built)).not.toMatch(/Nurse|A plan|Phone only|giveaways/);
  });
});
