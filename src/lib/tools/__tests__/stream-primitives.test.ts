/**
 * STREAM vocabulary guards (phase 1).
 *
 * Locks three things:
 *  1. The canonical fixture is registry-valid AND covers every one of the 16 kinds —
 *     the fixture half of the extension guarantee (a primitive with no fixture fails here).
 *  2. THE LAWS reject compositions that break them (one frame · receipt leads · one
 *     control row · accent marks one thing · honest table rows). Each guard is exercised
 *     against a composition that would render fine in a lawless system — these tests
 *     exist to FAIL when someone relaxes a refine.
 *  3. The vocabulary is closed: unknown kinds and unknown block types never validate.
 */
import { describe, it, expect } from "vitest";
import { validateBlock } from "../block-registry";
import {
  ComposedBlockSchema,
  STREAM_PRIMITIVE_KINDS,
  type StreamItem,
} from "../stream-primitives";
import { STREAM_COMPOSITION } from "./fixtures/stream-composition";

const items = (over: StreamItem[]) => ({ type: "composed", props: { items: over } });
const PROSE: StreamItem = { kind: "prose", text: "hello" };
const RECEIPT: StreamItem = { kind: "receipt", skill: "Hooks", summary: "1 step" };
const ASSET: StreamItem = {
  kind: "asset",
  label: "Script",
  title: "t",
  rows: [{ label: "Hook", text: "x" }],
};
const ASK: StreamItem = { kind: "input-ask", slots: [{ type: "text" }], submitLabel: "Go" };

describe("the canonical fixture", () => {
  it("validates through the registry as a composed block", () => {
    const result = validateBlock(STREAM_COMPOSITION);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.block.type).toBe("composed");
  });

  it("covers every one of the 16 primitive kinds (extension guarantee: no primitive without a fixture)", () => {
    const present = new Set(STREAM_COMPOSITION.props.items.map((i) => i.kind));
    for (const kind of STREAM_PRIMITIVE_KINDS) {
      expect(present, `fixture is missing a "${kind}" item`).toContain(kind);
    }
    expect(STREAM_PRIMITIVE_KINDS).toHaveLength(16);
  });
});

describe("the laws", () => {
  it("ONE frame total — two asset blocks are rejected", () => {
    expect(ComposedBlockSchema.safeParse(items([PROSE, ASSET])).success).toBe(true);
    expect(ComposedBlockSchema.safeParse(items([PROSE, ASSET, ASSET])).success).toBe(false);
  });

  it("the receipt leads — a receipt after any other item is rejected", () => {
    expect(ComposedBlockSchema.safeParse(items([RECEIPT, PROSE])).success).toBe(true);
    expect(ComposedBlockSchema.safeParse(items([PROSE, RECEIPT])).success).toBe(false);
    expect(ComposedBlockSchema.safeParse(items([RECEIPT, PROSE, RECEIPT])).success).toBe(false);
  });

  it("one control row — two input-asks are rejected", () => {
    expect(ComposedBlockSchema.safeParse(items([PROSE, ASK])).success).toBe(true);
    expect(ComposedBlockSchema.safeParse(items([ASK, PROSE, ASK])).success).toBe(false);
  });

  it("a table marks at most ONE accent cell and rows must match columns", () => {
    const table = (rows: unknown[][]) =>
      items([
        {
          kind: "table",
          columns: [{ label: "A" }, { label: "B" }],
          rows: rows as never,
        } as StreamItem,
      ]);
    const cell = (text: string, tone?: string) => (tone ? { text, tone } : { text });

    expect(ComposedBlockSchema.safeParse(table([[cell("x"), cell("1", "accent")]])).success).toBe(true);
    // two accent cells — the second application of accent the laws forbid
    expect(
      ComposedBlockSchema.safeParse(table([[cell("x", "accent"), cell("1", "accent")]])).success,
    ).toBe(false);
    // a row with a missing cell — dishonest table
    expect(ComposedBlockSchema.safeParse(table([[cell("x")]])).success).toBe(false);
  });

  it("a stat line marks at most ONE warn value", () => {
    const stats = (tones: (string | undefined)[]) =>
      items([
        {
          kind: "stats",
          items: tones.map((tone, i) => (tone ? { value: `${i}`, label: "l", tone } : { value: `${i}`, label: "l" })),
        } as StreamItem,
      ]);
    expect(ComposedBlockSchema.safeParse(stats([undefined, "warn"])).success).toBe(true);
    expect(ComposedBlockSchema.safeParse(stats(["warn", "warn"])).success).toBe(false);
  });
});

describe("the vocabulary is closed", () => {
  it("rejects an unknown primitive kind", () => {
    const raw = items([{ kind: "chart", data: [1, 2, 3] } as unknown as StreamItem]);
    expect(ComposedBlockSchema.safeParse(raw).success).toBe(false);
  });

  it("rejects an empty composition", () => {
    expect(ComposedBlockSchema.safeParse(items([])).success).toBe(false);
  });
});
