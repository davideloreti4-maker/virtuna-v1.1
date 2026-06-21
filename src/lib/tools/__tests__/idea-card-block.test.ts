/**
 * Task 1 TDD — RED: idea-card block schema + registry behaviour contract.
 *
 * Covers the four behaviour cases from the plan spec:
 *  1. validateBlock({ type: "idea-card", props: <valid> }) → { ok: true }
 *  2. validateBlock({ type: "idea-card", props: <missing required field> }) → { ok: false }
 *  3. assertBlocksInRegistry([{type:"idea-card",...}], ["idea-card"]) → no throw
 *  4. assertBlocksInRegistry([{type:"idea-card",...}], ["band"]) → throws
 */

import { describe, it, expect } from "vitest";
import { validateBlock, assertBlocksInRegistry } from "../block-registry";
import type { BlockType } from "../block-registry";

const VALID_IDEA_CARD_PROPS = {
  title: "Why beginners overthink rest days",
  angle: "Rest is not laziness — here is the evidence",
  whyItFits: "Because: 18-25 · fitness · your last 3 videos overperformed",
  mechanism: "Muscle protein synthesis data vs. intuition gap",
  seedHook: "You've been told to rest 48 hours — science says it depends",
  needsTake: false,
  topic: "Recovery science",
  take: "Data beats bro-science",
  format: "talking head",
  band: "Strong",
  fraction: "7/10 stop",
  scrollQuote: "Wait, my coach has been wrong this whole time?",
  model: "sim1-flash" as const,
};

describe("idea-card block — validateBlock", () => {
  it("returns ok:true for a valid idea-card block", () => {
    const result = validateBlock({
      type: "idea-card",
      props: VALID_IDEA_CARD_PROPS,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.block.type).toBe("idea-card");
    }
  });

  it("returns ok:false for a missing required field (title)", () => {
    const { title: _omitted, ...propsWithoutTitle } = VALID_IDEA_CARD_PROPS;
    const result = validateBlock({
      type: "idea-card",
      props: propsWithoutTitle,
    });
    expect(result.ok).toBe(false);
  });

  it("returns ok:false for an invalid band value", () => {
    const result = validateBlock({
      type: "idea-card",
      props: { ...VALID_IDEA_CARD_PROPS, band: "Excellent" },
    });
    expect(result.ok).toBe(false);
  });

  it("returns ok:false for an invalid model value", () => {
    const result = validateBlock({
      type: "idea-card",
      props: { ...VALID_IDEA_CARD_PROPS, model: "sim1-max" },
    });
    expect(result.ok).toBe(false);
  });

  it("accepts format: null (nullable field)", () => {
    const result = validateBlock({
      type: "idea-card",
      props: { ...VALID_IDEA_CARD_PROPS, format: null },
    });
    expect(result.ok).toBe(true);
  });

  it("accepts needsTake: true", () => {
    const result = validateBlock({
      type: "idea-card",
      props: { ...VALID_IDEA_CARD_PROPS, needsTake: true },
    });
    expect(result.ok).toBe(true);
  });
});

describe("idea-card block — assertBlocksInRegistry", () => {
  const ideaCardBlock = {
    type: "idea-card" as BlockType,
    props: VALID_IDEA_CARD_PROPS,
  };

  it("does not throw when idea-card is in the allowed subset", () => {
    expect(() =>
      assertBlocksInRegistry([ideaCardBlock], ["idea-card"]),
    ).not.toThrow();
  });

  it("throws when idea-card is NOT in the allowed subset", () => {
    expect(() =>
      assertBlocksInRegistry([ideaCardBlock], ["band"]),
    ).toThrow();
  });
});
