import { describe, it, expect } from "vitest";
import { EMIT_CARD_TOOL, handleEmitCard } from "@/lib/tools/emit-card-tool";
import { ACTION_IDS, RECIPES } from "@/lib/tools/composed-card-schema";
import type { HookProof } from "@/lib/tools/proof-schema";

const noReceipts = async () => new Map<string, HookProof>();

const ROW_1: HookProof = {
  handle: "a",
  videoUrl: null,
  coverUrl: null,
  hookTemplate: null,
  archetype: null,
  multiplier: 4,
  views: 10,
  baselineLabel: "vs their usual views",
  fitLabel: null,
};

describe("handleEmitCard", () => {
  it("returns a validated block for a well-formed card", async () => {
    const r = await handleEmitCard(
      { cards: [{ recipe: "brief", deliverable: { kind: "claim", text: "Ship it ugly." },
                  body: [{ kind: "bullets", items: ["Post before it is ready."] }] }] },
      { materialize: noReceipts },
    );
    expect(r.blocks.length).toBe(1);
    expect(r.blocks[0]?.type).toBe("composed-card");
  });

  it("returns no block and an error the model can act on when the recipe is violated", async () => {
    const r = await handleEmitCard(
      { cards: [{ recipe: "script", deliverable: { kind: "claim", text: "x" },
                  body: [{ kind: "bullets", items: ["y"] }] }] },
      { materialize: noReceipts },
    );
    expect(r.blocks.length).toBe(0);
    expect(r.error).toMatch(/script_timeline/);
  });

  it("materializes receipts for every receiptRef the model named (D7)", async () => {
    const called: string[][] = [];
    const materialize = async (ids: string[]) => {
      called.push(ids);
      return new Map([["row-1", ROW_1]]);
    };
    await handleEmitCard(
      { cards: [{ recipe: "teardown", deliverable: { kind: "claim", text: "x" },
                  receiptRef: "row-1",
                  body: [{ kind: "proof_strip", receiptRefs: ["row-1"] },
                         { kind: "beats", items: [{ label: "a", text: "b" }, { label: "c", text: "d" }] }] }] },
      { materialize },
    );
    expect(called[0]).toContain("row-1");
  });

  it("collects receiptRefs from the card AND from every proof_strip, in one call", async () => {
    const called: string[][] = [];
    const materialize = async (ids: string[]) => {
      called.push(ids);
      return new Map<string, HookProof>();
    };
    await handleEmitCard(
      { cards: [{ recipe: "teardown", deliverable: { kind: "claim", text: "x" },
                  receiptRef: "card-ref",
                  body: [{ kind: "proof_strip", receiptRefs: ["strip-a", "strip-b"] },
                         { kind: "beats", items: [{ label: "a", text: "b" }, { label: "c", text: "d" }] }],
                  disclosure: [{ kind: "proof_strip", receiptRefs: ["drawer-ref"] }] }] },
      { materialize },
    );
    expect(called.length).toBe(1);
    expect([...(called[0] ?? [])].sort()).toEqual(["card-ref", "drawer-ref", "strip-a", "strip-b"]);
  });

  it("attaches the materialized receipt to props.receipts, keyed by row id (Task 5b's field)", async () => {
    const r = await handleEmitCard(
      { cards: [{ recipe: "teardown", deliverable: { kind: "claim", text: "x" },
                  receiptRef: "row-1",
                  body: [{ kind: "proof_strip", receiptRefs: ["row-1"] },
                         { kind: "beats", items: [{ label: "a", text: "b" }, { label: "c", text: "d" }] }] }] },
      { materialize: async () => new Map([["row-1", ROW_1]]) },
    );
    expect(r.blocks[0]?.props.receipts?.["row-1"]).toEqual(ROW_1);
  });

  it("repairs a `cards` array that arrived as a JSON string (spike failure 2, measured)", async () => {
    const cards = [{ recipe: "brief", deliverable: { kind: "claim", text: "Ship it ugly." },
                     body: [{ kind: "bullets", items: ["Post before it is ready."] }] }];
    const r = await handleEmitCard({ cards: JSON.stringify(cards) }, { materialize: noReceipts });
    expect(r.blocks.length).toBe(1);
  });

  it("accepts a single hook — the ask 'just one example hook' is real and common", async () => {
    const r = await handleEmitCard(
      { cards: [{ recipe: "hook-set", deliverable: { kind: "line", text: "I lost £200 a month to Deliveroo." },
                  body: [{ kind: "note", text: "x" }] }] },
      { materialize: noReceipts },
    );
    expect(r.blocks.length).toBe(1);
  });

  it("rejects a card count above the recipe's ceiling", async () => {
    const one = { recipe: "hook-set", deliverable: { kind: "line", text: "A line." },
                  body: [{ kind: "note", text: "x" }] };
    const r = await handleEmitCard(
      { cards: Array.from({ length: 6 }, () => one) },   // hook-set tops out at 5
      { materialize: noReceipts },
    );
    expect(r.blocks.length).toBe(0);
    expect(r.error).toMatch(/5/);
  });

  it("rejects a call whose cards do not share one recipe", async () => {
    const r = await handleEmitCard(
      { cards: [
        { recipe: "hook-set", deliverable: { kind: "line", text: "A line." }, body: [{ kind: "note", text: "x" }] },
        { recipe: "brief", deliverable: { kind: "claim", text: "A claim." }, body: [{ kind: "bullets", items: ["y"] }] },
      ] },
      { materialize: noReceipts },
    );
    expect(r.blocks.length).toBe(0);
    expect(r.error).toMatch(/recipe/i);
  });

  it("emits nothing when one card of a set is malformed — a half-emitted set is a broken answer", async () => {
    const good = { recipe: "hook-set", deliverable: { kind: "line", text: "A line." }, body: [{ kind: "note", text: "x" }] };
    const bad = { recipe: "hook-set", deliverable: { kind: "claim", text: "Wrong kind." }, body: [{ kind: "note", text: "x" }] };
    const r = await handleEmitCard({ cards: [good, bad] }, { materialize: noReceipts });
    expect(r.blocks.length).toBe(0);
    expect(r.error).toBeTruthy();
  });

  it("returns an error rather than blocks when `cards` is absent or unusable", async () => {
    const r = await handleEmitCard({}, { materialize: noReceipts });
    expect(r.blocks.length).toBe(0);
    expect(r.error).toBeTruthy();
  });

  it("never lets a model-authored handle into a block", async () => {
    const r = await handleEmitCard(
      { cards: [{ recipe: "brief", deliverable: { kind: "claim", text: "x" },
                  body: [{ kind: "bullets", items: ["y"] }],
                  handle: "@fabricated" }] },
      { materialize: noReceipts },
    );
    expect(JSON.stringify(r.blocks)).not.toContain("fabricated");
  });

  it("never lets a model-authored receipt into a block, even for a row it named", async () => {
    const r = await handleEmitCard(
      { cards: [{ recipe: "teardown", deliverable: { kind: "claim", text: "x" },
                  receiptRef: "row-1",
                  body: [{ kind: "proof_strip", receiptRefs: ["row-1"] },
                         { kind: "beats", items: [{ label: "a", text: "b" }, { label: "c", text: "d" }] }],
                  receipts: { "row-1": { ...ROW_1, handle: "@fabricated", multiplier: 900 } } }] },
      { materialize: noReceipts },   // the row resolves to nothing
    );
    expect(JSON.stringify(r.blocks)).not.toContain("fabricated");
    expect(r.blocks[0]?.props.receipts).toBeUndefined();
  });
});

describe("EMIT_CARD_TOOL", () => {
  it("is a free function tool named emit_card", () => {
    expect(EMIT_CARD_TOOL.type).toBe("function");
    expect(EMIT_CARD_TOOL.function.name).toBe("emit_card");
  });

  it("carries the no-invented-handle sentence verbatim", () => {
    expect(EMIT_CARD_TOOL.function.description).toContain(
      "Use `proof_strip` ONLY with teardown row ids that search_corpus actually returned — never " +
        "invent one, and never write a creator handle yourself.",
    );
  });

  it("offers exactly the shipped recipes — derived from RECIPES, never a second list", () => {
    const enumerated = (
      EMIT_CARD_TOOL.function.parameters.properties.cards.items.properties.recipe as { enum: string[] }
    ).enum;
    expect([...enumerated].sort()).toEqual(Object.keys(RECIPES).sort());
  });

  it("offers exactly the currently-requestable actions — derived from ACTION_IDS (B3)", () => {
    const enumerated = (
      EMIT_CARD_TOOL.function.parameters.properties.cards.items.properties.actions as {
        items: { enum: string[] };
      }
    ).items.enum;
    expect([...enumerated].sort()).toEqual([...ACTION_IDS].sort());
  });

  it("documents every slot kind the schema accepts", () => {
    const enumerated = (
      EMIT_CARD_TOOL.function.parameters.properties.cards.items.properties.body.items.properties.kind as {
        enum: string[];
      }
    ).enum;
    const shipped = new Set(Object.values(RECIPES).flatMap((r) => r.legalSlots));
    for (const kind of shipped) expect(enumerated).toContain(kind);
    // `actions` is a CARD FIELD, not a slot (B2) — the spike's 11th kind must not come back.
    expect(enumerated).not.toContain("actions");
  });
});
