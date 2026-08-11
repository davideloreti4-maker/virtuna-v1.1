import { describe, it, expect } from "vitest";
import { parseComposedCard, RECIPES } from "@/lib/tools/composed-card-schema";

const validFormatSet = {
  type: "composed-card",
  props: {
    recipe: "format-set",
    deliverable: { kind: "claim", text: "Founders who film the failure out-perform the ones who film the win." },
    body: [
      { kind: "beats", items: [
        { label: "Open", text: "Name the failure in the first line." },
        { label: "Turn", text: "Show the receipt that proves it was real." },
      ] },
    ],
  },
};

describe("parseComposedCard", () => {
  it("accepts a card whose slots satisfy its recipe", () => {
    const r = parseComposedCard(validFormatSet);
    expect(r.ok).toBe(true);
  });

  it("rejects a card missing its recipe's required slot", () => {
    const r = parseComposedCard({
      ...validFormatSet,
      props: { ...validFormatSet.props, body: [{ kind: "chips", items: ["a"] }] },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/beats/);
  });

  it("rejects the wrong deliverable kind for the recipe", () => {
    // hook-set's payoff is a LINE (the actual hook), never a claim — D6 + the spike's
    // measured hero failure, where both models wrote a label instead of the hook.
    const r = parseComposedCard({
      type: "composed-card",
      props: {
        recipe: "hook-set",
        deliverable: { kind: "claim", text: "The Faceless Case Study" },
        body: [{ kind: "bullets", items: ["x"] }],
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/line/);
  });

  it("repairs a body arriving as a JSON string (spike failure 2)", () => {
    const r = parseComposedCard({
      ...validFormatSet,
      props: { ...validFormatSet.props, body: JSON.stringify(validFormatSet.props.body) },
    });
    expect(r.ok).toBe(true);
  });

  it("rejects a model-authored action outside the closed enum", () => {
    const r = parseComposedCard({
      ...validFormatSet,
      props: { ...validFormatSet.props, actions: ["buy_credits"] },
    });
    expect(r.ok).toBe(false);
  });

  it("accepts an action the product currently offers", () => {
    const r = parseComposedCard({
      ...validFormatSet,
      props: { ...validFormatSet.props, actions: ["explore"] },
    });
    expect(r.ok).toBe(true);
  });

  it("rejects a skill the product has deliberately shut (HORIZONTAL_ENABLED=false)", () => {
    // `predict` is a REAL skill with a live route and runner — and it is closed at every composer
    // door. A card offering it would be the one back door left open, which is the exact failure
    // skill-capabilities.ts:151-162 records. This test fails the day someone hardcodes the enum.
    for (const shut of ["predict", "profile"]) {
      const r = parseComposedCard({
        ...validFormatSet,
        props: { ...validFormatSet.props, actions: [shut] },
      });
      expect(r.ok, shut).toBe(false);
    }
  });

  it("every recipe declares a deliverable kind and at least one legal slot", () => {
    for (const [id, recipe] of Object.entries(RECIPES)) {
      expect(recipe.deliverable, id).toBeDefined();
      expect(recipe.legalSlots.length, id).toBeGreaterThan(0);
    }
  });
});

describe("recipe card counts (G1)", () => {
  it("every recipe declares a card count", () => {
    for (const [id, recipe] of Object.entries(RECIPES)) {
      expect(recipe.cardCount, id).toBeDefined();
      expect(recipe.cardCount.min, id).toBeGreaterThanOrEqual(1);
      expect(recipe.cardCount.max, id).toBeGreaterThanOrEqual(recipe.cardCount.min);
    }
  });

  it("hook-set asks for 3-5 cards, per the spec table", () => {
    expect(RECIPES["hook-set"].cardCount).toEqual({ min: 3, max: 5 });
  });

  it("a single-card recipe declares exactly one", () => {
    expect(RECIPES.script.cardCount).toEqual({ min: 1, max: 1 });
  });
});

describe("disclosure slot legality (G2)", () => {
  it("holds disclosure to the same legalSlots as the body", () => {
    // `script` does not allow `comparison` anywhere. Smuggling it into disclosure must fail.
    const r = parseComposedCard({
      type: "composed-card",
      props: {
        recipe: "script",
        deliverable: { kind: "claim", text: "Open on the cost, not the tip." },
        body: [{ kind: "script_timeline", lines: [{ t: "0:00", text: "a" }, { t: "0:03", text: "b" }] }],
        disclosure: [{ kind: "comparison", columns: [
          { title: "A", points: ["x"] }, { title: "B", points: ["y"] },
        ] }],
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/comparison/);
  });

  it("allows a legal slot in disclosure", () => {
    const r = parseComposedCard({
      type: "composed-card",
      props: {
        recipe: "script",
        deliverable: { kind: "claim", text: "Open on the cost, not the tip." },
        body: [{ kind: "script_timeline", lines: [{ t: "0:00", text: "a" }, { t: "0:03", text: "b" }] }],
        disclosure: [{ kind: "note", text: "Timings assume a 30s cut." }],
      },
    });
    expect(r.ok).toBe(true);
  });
});
