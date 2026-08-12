import { describe, it, expect } from "vitest";
import { parseComposedCard, RECIPES, ComposedCardBlockSchema } from "@/lib/tools/composed-card-schema";
import type { HookProof } from "@/lib/tools/proof-schema";

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

describe("recipe card counts (G1, corrected in Task 1c)", () => {
  it("every recipe declares a card count", () => {
    for (const [id, recipe] of Object.entries(RECIPES)) {
      expect(recipe.cardCount, id).toBeDefined();
      expect(recipe.cardCount.min, id).toBeGreaterThanOrEqual(1);
      expect(recipe.cardCount.max, id).toBeGreaterThanOrEqual(recipe.cardCount.min);
    }
  });

  it("every recipe accepts a single card — measured: creators really do ask for one", () => {
    // "just one example hook, doesn't have to be good" appears 14x in prod messages.
    for (const [id, recipe] of Object.entries(RECIPES)) {
      expect(recipe.cardCount.min, id).toBe(1);
    }
  });

  it("hook-set tops out at 6 — an overview card PLUS five hooks is what a '5 hooks' ask produces", () => {
    // Was 5, read off §4.2's "3–5 hooks". Measured 2026-08-12: that phrase counts the hooks, not
    // the cards, and the ceiling rejected a correct answer. Same mistake as the floor, other end.
    expect(RECIPES["hook-set"].cardCount).toEqual({ min: 1, max: 6 });
  });

  it("the -set recipes can emit a real set — the spec's own '3 viral formats' example", () => {
    for (const id of ["format-set", "angle-set", "idea-set"] as const) {
      expect(RECIPES[id].cardCount.max, id).toBeGreaterThanOrEqual(3);
    }
  });

  it("a single-deliverable recipe stays at one card", () => {
    for (const id of ["script", "comparison", "teardown", "brief"] as const) {
      expect(RECIPES[id].cardCount, id).toEqual({ min: 1, max: 1 });
    }
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

/**
 * `props.receipts` — the one field on this schema the MODEL may never fill.
 *
 * It has to be DECLARED, because `validateBlock` re-parses every block on render and a zod object
 * strips undeclared keys: a receipt attached after validation would vanish on the first rehydration,
 * leaving a `teardown` — the one recipe that REQUIRES a proof_strip — asserting evidence it never
 * shows. And it has to be STRIPPED at the model-facing door, because a declared field is a field the
 * model can fill, and D7 exists to make an authored handle unreachable rather than merely unlikely.
 * Both halves are load-bearing; either alone is a bug.
 */
const REAL_PROOF: HookProof = {
  handle: "corporate.bro",
  videoUrl: null,
  coverUrl: null,
  hookTemplate: null,
  archetype: null,
  multiplier: 5.7,
  views: 1_400_000,
  baselineLabel: "vs their usual views",
  fitLabel: null,
};

describe("props.receipts (D7)", () => {
  it("discards a model-supplied receipts map — D7 survives the field existing", () => {
    const r = parseComposedCard({
      type: "composed-card",
      props: {
        recipe: "brief",
        deliverable: { kind: "claim", text: "Ship it ugly." },
        body: [{ kind: "bullets", items: ["Post before it is ready."] }],
        receipts: {
          "row-1": { ...REAL_PROOF, handle: "fabricated", multiplier: 999, baselineLabel: "vs followers" },
        },
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.block.props.receipts).toBeUndefined();
  });

  it("discards a WELL-FORMED model receipt too — the shape is not what makes it illegitimate", () => {
    // A hallucinated receipt that happens to validate is the dangerous case: it renders as proof.
    // Nothing about the payload can distinguish it from a real one, so provenance is the only test
    // and the answer is unconditional.
    const r = parseComposedCard({
      type: "composed-card",
      props: {
        recipe: "brief",
        deliverable: { kind: "claim", text: "Ship it ugly." },
        body: [{ kind: "bullets", items: ["Post before it is ready."] }],
        receipts: { "row-1": REAL_PROOF },
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.block.props.receipts).toBeUndefined();
  });

  it("drops the receipt rather than rejecting the card", () => {
    // Deliberate: a hallucinated receipt should cost the model a retry, not cost the creator the
    // card. The rest of the card is still exactly what they asked for.
    const r = parseComposedCard({
      type: "composed-card",
      props: {
        recipe: "brief",
        deliverable: { kind: "claim", text: "Ship it ugly." },
        body: [{ kind: "bullets", items: ["Post before it is ready."] }],
        receipts: { "row-1": REAL_PROOF },
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.block.props.body).toHaveLength(1);
  });

  it("does not mutate the caller's arguments while stripping them", () => {
    // The emit boundary holds the raw tool args and may log them after parsing. Reaching into the
    // caller's object to delete a key would make the log disagree with what the model actually sent.
    const raw = {
      type: "composed-card",
      props: {
        recipe: "brief",
        deliverable: { kind: "claim", text: "Ship it ugly." },
        body: [{ kind: "bullets", items: ["Post before it is ready."] }],
        receipts: { "row-1": REAL_PROOF },
      },
    };
    parseComposedCard(raw);
    expect(raw.props.receipts).toBeDefined();
  });

  it("accepts server-attached receipts on an already-parsed block", () => {
    // The persisted shape must round-trip through the SCHEMA, or validateBlock strips it on render.
    const parsed = ComposedCardBlockSchema.safeParse({
      type: "composed-card",
      props: {
        recipe: "brief",
        deliverable: { kind: "claim", text: "x" },
        body: [{ kind: "bullets", items: ["y"] }],
        receipts: { "row-1": REAL_PROOF },
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("survives JSON — a Map would have serialized to {}", () => {
    // Constraint 1: block props are persisted to `messages.body` as JSON. This assertion is the
    // reason the field is a Record and not the Map the renderer used before it existed.
    const attached = {
      type: "composed-card",
      props: {
        recipe: "brief",
        deliverable: { kind: "claim", text: "x" },
        body: [{ kind: "bullets", items: ["y"] }],
        receipts: { "row-1": REAL_PROOF },
      },
    };
    const persisted: unknown = JSON.parse(JSON.stringify(attached));
    const parsed = ComposedCardBlockSchema.safeParse(persisted);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.props.receipts?.["row-1"]?.handle).toBe("corporate.bro");
      expect(parsed.data.props.receipts?.["row-1"]?.multiplier).toBe(5.7);
    }
  });

  it("rejects a malformed receipt rather than rendering half a proof", () => {
    // A row with no handle is not a receipt (§0.5b). materializeReceipts already refuses to emit
    // one; the schema refuses to carry one.
    const parsed = ComposedCardBlockSchema.safeParse({
      type: "composed-card",
      props: {
        recipe: "brief",
        deliverable: { kind: "claim", text: "x" },
        body: [{ kind: "bullets", items: ["y"] }],
        receipts: { "row-1": { multiplier: 5.7 } },
      },
    });
    expect(parsed.success).toBe(false);
  });
});

/**
 * proof_strip belongs to EVERY recipe.
 *
 * Measured 2026-08-12, across both models and both harnesses: the model repeatedly tried to attach
 * evidence to a recipe that forbade it and lost the whole card for it —
 *   · `comparison` does not allow a proof_strip  (live loop, 1 of 3 runs)
 *   · `script` does not allow a proof_strip      (spike, plus, twice, never recovered)
 *
 * There is no honesty argument for the restriction: the card contract's spine already has a receipt
 * row for every card, and D7 means the model supplies a row id while the SERVER materializes the
 * numbers — an id that does not resolve renders nothing at all. Forbidding proof on a comparison or
 * a script only stops a grounded answer showing what grounded it, which is the product's whole
 * thesis. The recipe constrains SHAPE; evidence is not a shape.
 */
describe("every recipe may carry its proof", () => {
  it("allows proof_strip in all eight recipes", () => {
    for (const [id, recipe] of Object.entries(RECIPES)) {
      expect(recipe.legalSlots, id).toContain("proof_strip");
    }
  });

  it("does NOT widen stat_row with it — those numbers are model-authored", () => {
    // proof_strip carries a row id the server resolves; stat_row carries {value,label} strings the
    // model writes itself. Widening both together would have handed back exactly the fabrication
    // D7 exists to remove. The model asked for stat_row in `comparison` and was refused on purpose.
    expect(RECIPES.comparison.legalSlots).not.toContain("stat_row");
    const allowed = Object.entries(RECIPES).filter(([, r]) => r.legalSlots.includes("stat_row"));
    expect(allowed.map(([id]) => id)).toEqual(["brief"]);
  });
});
