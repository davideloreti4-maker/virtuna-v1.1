/**
 * With the flag off no writer reads the five facts (spec 2026-11-24 §6): a row that holds them gives
 * exactly the bundle of the same row without them, the cap included, and a row with only facts is
 * cold-start, as before. The live database is shared with builds that have the flag on, so a row can
 * hold facts while this build runs.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: false }));

import { assembleBundle, type AssemblerInput } from "../assembler";
import { buildGroundingLine } from "../grounding-line";
import { PROFILE_ROLE_MAP, isProfileThin, youFact } from "../profile-role-map";

const ASK = "five hooks about meal prep";
const FIVE = { about: "Nurse.", sells: "A plan.", writing_voice_description: "Dry.", can_film: "Phone only.", never_do: "No giveaways." };
const BASE = { niche_primary: "food-cooking", target_platforms: ["tiktok"] };
const MODES = ["idea", "hooks", "script", "chat", "remix"] as const;

describe("flag off: the facts are not read", () => {
  it.each(MODES)("%s: the bundle is the one without them", (mode) => {
    expect(assembleBundle({ ask: ASK, platform: "tiktok", mode }, { ...BASE, ...FIVE })).toBe(
      assembleBundle({ ask: ASK, platform: "tiktok", mode }, BASE),
    );
  });

  it.each(MODES)("%s: an ask to sell prints no offer either", (mode) => {
    const input: AssemblerInput = { ask: "5 hooks to sell my meal plan", platform: "tiktok", mode };
    const bundle = assembleBundle(input, { ...BASE, ...FIVE });
    expect(bundle).toBe(assembleBundle(input, BASE));
    expect(bundle).not.toContain("A plan.");
  });

  it.each(MODES)("%s: an overflowing bundle keeps today's cap, whatever the row holds", (mode) => {
    const input: AssemblerInput = { ask: "y".repeat(9000), platform: "tiktok", mode, anchor: "b".repeat(5000) };
    const bundle = assembleBundle(input, { ...BASE, ...FIVE });
    expect(bundle).toBe(assembleBundle(input, BASE));
    expect(bundle).toHaveLength(6000);
  });

  it("a row with only facts is cold-start, as before, in the bundle and on the ideas card", () => {
    expect(isProfileThin(FIVE)).toBe(true);
    expect(assembleBundle({ ask: ASK, platform: "tiktok", mode: "hooks" }, FIVE)).toContain("Creator profile: thin");
    expect(buildGroundingLine(FIVE, "tiktok").coldStart).toBe(true);
  });

  it("no role prints one, the voice included", () => {
    for (const key of Object.keys(FIVE) as (keyof typeof FIVE)[]) expect(youFact(FIVE, key)).toBeNull();
    expect(PROFILE_ROLE_MAP.voice(FIVE)).toBeNull();
    expect(PROFILE_ROLE_MAP.never(FIVE)).toBeNull();
    expect(PROFILE_ROLE_MAP.sells(FIVE)).toBeNull();
    expect(PROFILE_ROLE_MAP.about(FIVE)).toBeNull();
    expect(PROFILE_ROLE_MAP.film(FIVE)).toBeNull();
  });
});
