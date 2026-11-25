/**
 * IN-02 — `resolveSim1Tier` pure tier rule (RED until Wave 1 lands `../tier`).
 *
 * The SIM-1 tier is resolved purely from the stimulus kind (D-03): audio-bearing
 * video → Max, everything else → Flash. No mocks, no model call — a pure function.
 *
 * NOTE: omni-**flash** (the model name) ≠ SIM-1-**Flash** (the tier). The READ after
 * either tier is text, so both map to `QWEN_REASONING_MODEL`; a person-video is heard
 * upstream by the omni watch (profile-bake.ts), never by this map's model.
 *
 * Runner: `node ./node_modules/vitest/vitest.mjs run` (NEVER npm test / npx vitest).
 *
 * EXPECTED-RED: `../tier` does not exist until its Wave-1 implementation plan.
 */
import { describe, it, expect } from "vitest";

import { resolveSim1Tier, SIM1_MODEL_BY_TIER } from "../tier";
import { QWEN_OMNI_MODEL, QWEN_REASONING_MODEL } from "../../qwen/client";

describe("SIM1_MODEL_BY_TIER — the text READ's model", () => {
  it("max → the reasoning model, never omni (the READ is text; the watch heard the video)", () => {
    expect(SIM1_MODEL_BY_TIER.max).toBe(QWEN_REASONING_MODEL);
    expect(SIM1_MODEL_BY_TIER.max).not.toBe(QWEN_OMNI_MODEL);
  });

  it("flash → the reasoning model", () => {
    expect(SIM1_MODEL_BY_TIER.flash).toBe(QWEN_REASONING_MODEL);
  });
});

describe("IN-02: resolveSim1Tier (pure)", () => {
  it("video → max (audio-bearing person-video)", () => {
    expect(resolveSim1Tier("video")).toBe("max");
  });

  it("text → flash", () => {
    expect(resolveSim1Tier("text")).toBe("flash");
  });

  it("file_text → flash", () => {
    expect(resolveSim1Tier("file_text")).toBe("flash");
  });

  it("image → flash (the reasoning model is vision-capable)", () => {
    expect(resolveSim1Tier("image")).toBe("flash");
  });
});
