/**
 * IN-02 — `resolveSim1Tier` pure tier rule (RED until Wave 1 lands `../tier`).
 *
 * The SIM-1 tier is resolved purely from the stimulus kind (D-03): audio-bearing
 * video → Max (the omni sensor), everything else → Flash (qwen3.7-plus). No mocks,
 * no model call — a pure function.
 *
 * NOTE: omni-**flash** (the model name) ≠ SIM-1-**Flash** (the tier). SIM-1 Max =
 * `QWEN_OMNI_MODEL`; SIM-1 Flash = `QWEN_REASONING_MODEL`.
 *
 * Runner: `node ./node_modules/vitest/vitest.mjs run` (NEVER npm test / npx vitest).
 *
 * EXPECTED-RED: `../tier` does not exist until its Wave-1 implementation plan.
 */
import { describe, it, expect } from "vitest";

import { resolveSim1Tier } from "../tier";

describe("IN-02: resolveSim1Tier (pure)", () => {
  it("video → max (omni sensor; audio-bearing)", () => {
    expect(resolveSim1Tier("video")).toBe("max");
  });

  it("text → flash", () => {
    expect(resolveSim1Tier("text")).toBe("flash");
  });

  it("file_text → flash", () => {
    expect(resolveSim1Tier("file_text")).toBe("flash");
  });

  it("image → flash (qwen3.7-plus is vision-capable)", () => {
    expect(resolveSim1Tier("image")).toBe("flash");
  });
});
