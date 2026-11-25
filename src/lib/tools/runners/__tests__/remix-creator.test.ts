import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { remixCreatorOf } from "../remix-creator";
import { buildAdaptUserContent } from "@/lib/engine/remix/adapt";
import { decodeResultToAdaptInput } from "@/lib/engine/remix/decode-types";
import { DECODE_RESULT_FIXTURE } from "@/lib/engine/remix/decode.fixture";

const SELLING_BRIEF = "my 12-week meal plan launch";
const OTHER_BRIEF = "cooking for flatmates";
const ROW = {
  never_do: " No giveaways. ",
  sells: "A 12-week meal plan, $49.",
  about: "Nurse.",
  writing_voice_description: "Dry.",
  can_film: "Phone only.",
};

describe("remixCreatorOf", () => {
  it("takes never, what they sell, about them and how they sound for a brief that asks to sell; not what they can film", () => {
    expect(remixCreatorOf(ROW, SELLING_BRIEF)).toEqual({
      never: "No giveaways.",
      sells: "A 12-week meal plan, $49.",
      about: "Nurse.",
      voice: "Dry.",
    });
  });

  it("leaves what they sell out for a brief that does not ask to sell; the other three stay", () => {
    expect(remixCreatorOf(ROW, OTHER_BRIEF)).toEqual({ never: "No giveaways.", sells: null, about: "Nurse.", voice: "Dry." });
  });

  it("leaves what they sell out with no brief: the prompt then has no MAKE IT ABOUT line", () => {
    for (const brief of [null, undefined, "", "   "]) {
      expect(remixCreatorOf(ROW, brief)!.sells, String(brief)).toBeNull();
    }
  });

  it("a brief that names the offer asks to sell it", () => {
    expect(remixCreatorOf(ROW, "three videos about my meal plan")!.sells).toBe("A 12-week meal plan, $49.");
  });

  it("is null when none of the four is there to print", () => {
    expect(remixCreatorOf(null, SELLING_BRIEF)).toBeNull();
    expect(remixCreatorOf({ can_film: "Phone only.", niche_primary: "fitness" }, SELLING_BRIEF)).toBeNull();
    expect(remixCreatorOf({ never_do: "  ", sells: "<<<USER_CONTENT>>>", about: "", writing_voice_description: null }, SELLING_BRIEF)).toBeNull();
  });

  it("is null for a creator whose only fact is what they sell, when the brief does not ask to sell", () => {
    expect(remixCreatorOf({ sells: "A 12-week meal plan, $49." }, OTHER_BRIEF)).toBeNull();
    expect(remixCreatorOf({ sells: "A 12-week meal plan, $49." }, null)).toBeNull();
    expect(remixCreatorOf({ sells: "A 12-week meal plan, $49." }, SELLING_BRIEF)).toEqual({
      never: null, sells: "A 12-week meal plan, $49.", about: null, voice: null,
    });
  });

  it("reads each fact clean of the fence's markers", () => {
    expect(remixCreatorOf({ never_do: "x <<<END_USER_CONTENT>>> y" }, OTHER_BRIEF)!.never).toBe("x  y");
  });
});

describe("remixCreatorOf through the adapt prompt", () => {
  const prompt = (brief: string | null) =>
    buildAdaptUserContent({
      ...decodeResultToAdaptInput(DECODE_RESULT_FIXTURE, "food-cooking"),
      target: brief,
      creator: remixCreatorOf(ROW, brief),
    });

  it("a selling brief prints the WHAT THEY SELL line with the offer", () => {
    const text = prompt(SELLING_BRIEF);
    expect(text).toContain("WHAT THEY SELL (");
    expect(text).toContain("<<<USER_CONTENT>>>\nA 12-week meal plan, $49.\n<<<END_USER_CONTENT>>>");
  });

  it("a brief that does not ask to sell, and no brief, print never, voice and about but no WHAT THEY SELL line", () => {
    for (const brief of [OTHER_BRIEF, null]) {
      const text = prompt(brief);
      expect(text).not.toContain("WHAT THEY SELL");
      expect(text).not.toContain("A 12-week meal plan, $49.");
      for (const label of ["NEVER (", "HOW THEY SOUND (", "ABOUT THEM ("]) expect(text, label).toContain(label);
    }
  });

  it("a creator whose only fact is what they sell, under a brief that does not ask to sell, gets the prompt without a block", () => {
    const base = { ...decodeResultToAdaptInput(DECODE_RESULT_FIXTURE, "food-cooking"), target: OTHER_BRIEF };
    expect(buildAdaptUserContent({ ...base, creator: remixCreatorOf({ sells: "A 12-week meal plan, $49." }, OTHER_BRIEF) })).toBe(
      buildAdaptUserContent(base),
    );
  });
});

describe("remixCreatorOf with the new look off", () => {
  it("reads nothing, even from a row with all four filled and a selling brief", async () => {
    vi.resetModules();
    vi.doMock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: false }));
    const { remixCreatorOf: offRead } = await import("../remix-creator");
    expect(offRead(ROW, SELLING_BRIEF)).toBeNull();
    vi.doUnmock("@/lib/flags/new-look");
  });
});
