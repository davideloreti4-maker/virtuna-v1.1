import { expect, it, vi } from "vitest";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: false }));

import { buildAdaptProfile } from "../adapt-profile";

it("with the flag off the briefer gets no voice from the profile", () => {
  expect(buildAdaptProfile({ niche_primary: "fitness", writing_voice_description: "Dry." }).writing_voice_description).toBeNull();
});

it("with the flag off every other field is read as before", () => {
  expect(
    buildAdaptProfile({
      niche_primary: "fitness",
      primary_goal: "grow",
      writing_voice_description: "Dry.",
      target_audience: { age_range: "25-34", gender_skew: null, geo: "US", language: null },
      past_wins: [{ url: "https://example.com/w" }],
      past_flops: null,
    }),
  ).toEqual({
    niche_primary: "fitness",
    target_audience: "age 25-34, US",
    primary_goal: "grow",
    writing_voice_description: null,
    past_wins: ["https://example.com/w"],
    past_flops: null,
  });
});
