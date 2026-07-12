import { describe, it, expect, vi } from "vitest";
import type OpenAI from "openai";
import {
  buildTeardownEmbeddingText,
  embedTexts,
  embedQueryText,
  GROUNDING_EMBEDDING_DIM,
  GROUNDING_EMBEDDING_MODEL,
} from "../embedder";

// ─── buildTeardownEmbeddingText — the §13 formula SSOT ───────────────────────
describe("buildTeardownEmbeddingText", () => {
  it("joins caption + #hashtags + on-screen + spoken hook + idea angle with newlines", () => {
    expect(
      buildTeardownEmbeddingText({
        caption: "5 high protein breakfasts",
        hashtags: ["highprotein", "#mealprep"],
        onScreenText: "no eggs needed",
        spokenHook: "Stop skipping breakfast.",
        ideaAngle: "protein without cooking",
      }),
    ).toBe(
      "5 high protein breakfasts\n#highprotein #mealprep\nno eggs needed\nStop skipping breakfast.\nprotein without cooking",
    );
  });

  it("skips empty/whitespace segments and returns '' when nothing has signal", () => {
    expect(
      buildTeardownEmbeddingText({
        caption: "  ",
        hashtags: [],
        spokenHook: "Stop skipping breakfast.",
        ideaAngle: null,
      }),
    ).toBe("Stop skipping breakfast.");
    expect(buildTeardownEmbeddingText({})).toBe("");
    expect(buildTeardownEmbeddingText({ hashtags: [" ", ""] })).toBe("");
  });

  it("caps the output length", () => {
    const text = buildTeardownEmbeddingText({ caption: "x".repeat(5000) });
    expect(text.length).toBe(2000);
  });
});

// ─── embedTexts / embedQueryText — chunking + validation over a fake client ──
function fakeClient(
  impl: (args: { input: string[] }) => { index: number; embedding: number[] }[],
) {
  const create = vi.fn(async (args: { input: string[] }) => ({
    data: impl(args),
  }));
  return { client: { embeddings: { create } } as unknown as OpenAI, create };
}

const vec = (fill: number) => new Array(GROUNDING_EMBEDDING_DIM).fill(fill);

describe("embedTexts", () => {
  it("chunks input at 10 per request and returns vectors aligned 1:1", async () => {
    const { client, create } = fakeClient(({ input }) =>
      input.map((_, i) => ({ index: i, embedding: vec(i) })),
    );
    const texts = Array.from({ length: 12 }, (_, i) => `t${i}`);
    const vectors = await embedTexts(texts, { client });

    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0]![0]).toMatchObject({
      model: GROUNDING_EMBEDDING_MODEL,
      dimensions: GROUNDING_EMBEDDING_DIM,
    });
    expect((create.mock.calls[0]![0] as { input: string[] }).input).toHaveLength(10);
    expect((create.mock.calls[1]![0] as { input: string[] }).input).toHaveLength(2);
    expect(vectors).toHaveLength(12);
    // second chunk's first item is texts[10] → its fake fill is its in-chunk index 0
    expect(vectors[10]![0]).toBe(0);
  });

  it("sorts by the API's index field within a chunk (defensive)", async () => {
    const { client } = fakeClient(({ input }) =>
      input.map((_, i) => ({ index: i, embedding: vec(i) })).reverse(),
    );
    const vectors = await embedTexts(["a", "b", "c"], { client });
    expect(vectors.map((v) => v[0])).toEqual([0, 1, 2]);
  });

  it("throws on a dimension mismatch and on a count mismatch", async () => {
    const bad = fakeClient(({ input }) =>
      input.map((_, i) => ({ index: i, embedding: [1, 2, 3] })),
    );
    await expect(embedTexts(["a"], { client: bad.client })).rejects.toThrow(/768-dim/);

    const short = fakeClient(() => []);
    await expect(embedTexts(["a"], { client: short.client })).rejects.toThrow(
      /expected 1 vectors/,
    );
  });

  it("returns [] for empty input without calling the API", async () => {
    const { client, create } = fakeClient(() => []);
    expect(await embedTexts([], { client })).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("embedQueryText", () => {
  it("returns the single vector for a query", async () => {
    const { client } = fakeClient(({ input }) =>
      input.map((_, i) => ({ index: i, embedding: vec(7) })),
    );
    const v = await embedQueryText("high protein breakfast", { client });
    expect(v).toHaveLength(GROUNDING_EMBEDDING_DIM);
    expect(v[0]).toBe(7);
  });
});
