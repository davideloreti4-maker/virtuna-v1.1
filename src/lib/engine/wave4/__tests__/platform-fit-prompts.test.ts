/**
 * Wave 0 test stubs for Phase 9 platform-fit prompt builder.
 * All tests fail RED — prompt builder functions are not yet implemented.
 * Wave 2 implementation plans drive these RED→GREEN.
 */
import { describe, it, expect } from "vitest";

describe("platform-fit prompt builder (Phase 9 Wave 0 stubs)", () => {
  // FAILS: platform-fit-prompts module does not exist → dynamic import throws
  it("builds system prompt with platform-specific instructions", async () => {
    const mod = await import("../platform-fit-prompts");
    const result = mod.buildPlatformFitSystemPrompt("tiktok");
    expect(result).toBeTruthy();
  });

  it.todo("builds user prompt with content payload and metadata");

  it.todo("includes watermark detection instructions in system prompt");

  it.todo("returns valid prompt strings (non-empty)");
});
