/**
 * Task 1 TDD — RED: block-registry + blocks.ts behaviour contract.
 *
 * Covers the six validateBlock cases from the plan spec plus the
 * assertBlocksInRegistry throw case.
 */

import { describe, it, expect } from "vitest";
import { validateBlock, assertBlocksInRegistry, BLOCK_REGISTRY } from "../block-registry";
import type { BlockType } from "../block-registry";

describe("BLOCK_REGISTRY", () => {
  it("exports the three required keys", () => {
    expect(Object.keys(BLOCK_REGISTRY)).toEqual(
      expect.arrayContaining(["markdown", "band", "personas"]),
    );
  });
});

describe("validateBlock", () => {
  it("returns ok:true for a valid markdown block", () => {
    const result = validateBlock({ type: "markdown", props: { text: "hi" } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.block).toMatchObject({ type: "markdown", props: { text: "hi" } });
    }
  });

  it("returns ok:true for a valid band block", () => {
    const result = validateBlock({
      type: "band",
      props: { band: "Strong", fraction: "6/10 stop", model: "sim1-flash" },
    });
    expect(result.ok).toBe(true);
  });

  it("returns ok:false for an unknown type", () => {
    const result = validateBlock({ type: "nope", props: {} });
    expect(result.ok).toBe(false);
  });

  it("returns ok:false for invalid band props (unknown band value, missing fields)", () => {
    const result = validateBlock({ type: "band", props: { band: "Amazing" } });
    expect(result.ok).toBe(false);
  });

  it("returns ok:false for null", () => {
    const result = validateBlock(null);
    expect(result.ok).toBe(false);
  });

  it("returns ok:false for empty object", () => {
    const result = validateBlock({});
    expect(result.ok).toBe(false);
  });

  it("never throws — even on completely unexpected input", () => {
    expect(() => validateBlock(undefined)).not.toThrow();
    expect(() => validateBlock(42)).not.toThrow();
    expect(() => validateBlock("string")).not.toThrow();
  });

  // ── Phase 5: the two new block types are registered (Pitfall 4) ──────────────

  it("returns ok:true for a valid profile-read block (Plan 05-01)", () => {
    const result = validateBlock({
      type: "profile-read",
      props: {
        subjectName: "Marcus",
        subjectKind: "person",
        identity: { traits: ["dominant"], commStyle: "clipped", drivers: ["control"] },
        tells: [{ tell: "Reframes asks as favors", evidence: "I'll let you have Friday." }],
        howTheyReact: "Respects a firm deadline.",
        goalScope: "Commit to Friday.",
        caveat: "Directional, from limited evidence.",
        savedAudienceId: "aud_1",
        model: "sim1-flash",
        tier: "Directional",
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.block.type).toBe("profile-read");
  });

  it("returns ok:true for a valid reaction-distribution block (Plan 05-01)", () => {
    const result = validateBlock({
      type: "reaction-distribution",
      props: {
        audienceName: "Marcus",
        subjectKind: "person",
        read: { verdict: "resistant", reasoning: "Reads soft framing as weakness.", quote: "Why would I move?" },
        model: "sim1-flash",
        tier: "Directional",
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.block.type).toBe("reaction-distribution");
  });

  it("returns ok:false for a profile-read carrying a smuggled numeric score", () => {
    const result = validateBlock({
      type: "profile-read",
      props: {
        subjectName: "Marcus",
        subjectKind: "person",
        identity: { traits: ["dominant"], commStyle: "clipped", drivers: ["control"] },
        tells: [{ tell: "Reframes asks as favors", evidence: "I'll let you have Friday." }],
        howTheyReact: "Respects a firm deadline.",
        goalScope: "Commit to Friday.",
        caveat: "Directional.",
        savedAudienceId: "aud_1",
        model: "sim1-flash",
        tier: "Directional",
        score: 88,
      },
    });
    expect(result.ok).toBe(false);
  });
});

describe("assertBlocksInRegistry", () => {
  it("does not throw when all block types are in the allowed subset", () => {
    const blocks = [
      { type: "markdown" as BlockType, props: { text: "hello" } },
      { type: "band" as BlockType, props: { band: "Mixed", fraction: "4/10 stop", model: "sim1-flash" } },
    ];
    expect(() => assertBlocksInRegistry(blocks, ["markdown", "band", "personas"])).not.toThrow();
  });

  it("throws when a block type is outside the allowed subset", () => {
    const blocks = [
      { type: "band" as BlockType, props: { band: "Weak", fraction: "2/10 stop", model: "sim1-max" } },
    ];
    // Only markdown is allowed — band is outside the subset
    expect(() => assertBlocksInRegistry(blocks, ["markdown"])).toThrow();
  });
});
