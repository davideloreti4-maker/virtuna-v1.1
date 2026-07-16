/**
 * corpus-tool.test.ts — the PULL loop (corpus-tool.ts). Fully hermetic: the model call (`complete`) and
 * retrieval (`retrieve`) are injected, so nothing hits DashScope/Supabase. Locks the behaviours the
 * spike observed live (docs/SPIKE-CORPUS-FN-TOOL-2026-07-16.md): the model searches on demand, self-
 * corrects when a query whiffs, a retrieval failure is absorbed not fatal, and the honesty spine holds.
 */

import { describe, it, expect, vi } from "vitest";
import {
  gatherReferencesViaTool,
  executeCorpusSearch,
  buildReferenceBlock,
  SEARCH_CORPUS_TOOL,
  type ChatComplete,
} from "@/lib/grounding/corpus-tool";
import type { RetrievedExample } from "@/lib/grounding/types";

// ─── Fixtures ──────────────────────────────────────────────────────────────

function mkExample(o: Partial<RetrievedExample> = {}): RetrievedExample {
  const base: RetrievedExample = {
    teardownId: "t1",
    handle: "creator1",
    videoUrl: null,
    coverUrl: null,
    platform: "tiktok",
    multiplier: null,
    views: 1_000_000,
    baselineLabel: null,
    fitLabel: "structural",
    hookArchetype: "contrarian",
    format: "breakdowns-explainers",
    spokenHook: "You've been lied to about X.",
    hookTemplate: "You've been lied to about [X].",
    template: null,
    idea: null,
    whyItWorks: null,
    sourcePool: "curated",
    trustWeight: 1,
    fromPersonal: false,
  };
  return { ...base, ...o };
}

/** A model response that requests one search_corpus tool call. */
const toolCallResp = (query: string, axis = "topical", id = "call1") => ({
  choices: [
    {
      message: {
        content: null,
        tool_calls: [
          { id, function: { name: "search_corpus", arguments: JSON.stringify({ query, axis }) } },
        ],
      },
    },
  ],
});

/** A model response with no tool calls — the scout is done gathering. */
const stopResp = (content = "done") => ({ choices: [{ message: { content, tool_calls: [] } }] });

/** A `complete` that returns scripted responses in order (last one repeats if exhausted). */
function scriptedComplete(responses: unknown[]): ChatComplete {
  let i = 0;
  return vi.fn(async () => responses[Math.min(i++, responses.length - 1)]) as unknown as ChatComplete;
}

/** A `retrieve` that returns one row-batch per call (empty batch = a whiff). */
function mkRetrieve(batches: RetrievedExample[][]) {
  let i = 0;
  return vi.fn(async () => {
    const examples = batches[Math.min(i++, batches.length - 1)] ?? [];
    return {
      examples,
      enough: examples.length >= 2,
      stats: { matched: examples.length, good: examples.length, minRows: 2, minSimilarity: 0, rank: "topical", archetypes: 1 },
    };
  }) as never;
}

const DEPS = (complete: ChatComplete, retrieve: unknown) => ({
  complete,
  retrieve: retrieve as never,
  model: "test-model",
  seed: 1,
});

// ─── gatherReferencesViaTool ─────────────────────────────────────────────────

describe("gatherReferencesViaTool [grounding]", () => {
  it("harvests the rows the model pulls, then stops when it emits no tool call", async () => {
    const complete = scriptedComplete([toolCallResp("high protein", "structural"), stopResp()]);
    const retrieve = mkRetrieve([[mkExample({ teardownId: "a" }), mkExample({ teardownId: "b" })]]);

    const res = await gatherReferencesViaTool({ ask: "hooks for protein", platform: "tiktok" }, DEPS(complete, retrieve));

    expect(res.references).toHaveLength(2);
    expect(res.toolCalls).toHaveLength(1);
    expect(res.toolCalls[0]!.axis).toBe("structural");
    expect(res.toolCalls[0]!.rows).toBe(2);
  });

  it("self-corrects: a topical whiff (0 rows) → the model retries and the retry is harvested", async () => {
    const complete = scriptedComplete([
      toolCallResp("q1", "topical", "c1"),
      toolCallResp("q2", "structural", "c2"),
      stopResp(),
    ]);
    const retrieve = mkRetrieve([[], [mkExample({ teardownId: "a" }), mkExample({ teardownId: "b" })]]);

    const res = await gatherReferencesViaTool({ ask: "x", platform: "tiktok" }, DEPS(complete, retrieve));

    expect(res.toolCalls).toHaveLength(2);
    expect(res.toolCalls[0]!.rows).toBe(0);
    expect(res.references).toHaveLength(2);
  });

  it("absorbs a retrieval failure without throwing — the model can retry", async () => {
    const retrieve = vi
      .fn()
      .mockRejectedValueOnce(new Error("rpc down"))
      .mockResolvedValueOnce({ examples: [mkExample({ teardownId: "a" })], enough: false, stats: {} });
    const complete = scriptedComplete([toolCallResp("q1", "topical", "c1"), toolCallResp("q2", "topical", "c2"), stopResp()]);

    const res = await gatherReferencesViaTool({ ask: "x", platform: "tiktok" }, DEPS(complete, retrieve as never));

    expect(res.toolCalls[0]!.error).toContain("rpc down");
    expect(res.references).toHaveLength(1);
  });

  it("stops at maxRounds when the model never stops requesting tools", async () => {
    const complete = scriptedComplete([toolCallResp("q"), toolCallResp("q"), toolCallResp("q"), toolCallResp("q")]);
    const retrieve = mkRetrieve([[mkExample({ teardownId: "a" })]]);

    const res = await gatherReferencesViaTool({ ask: "x", platform: "tiktok", maxRounds: 2 }, DEPS(complete, retrieve));

    expect(res.toolCalls).toHaveLength(2);
  });

  it("dedupes references by teardownId", async () => {
    const complete = scriptedComplete([toolCallResp("q1", "topical", "c1"), toolCallResp("q2", "topical", "c2"), stopResp()]);
    const retrieve = mkRetrieve([[mkExample({ teardownId: "dup" })], [mkExample({ teardownId: "dup" })]]);

    const res = await gatherReferencesViaTool({ ask: "x", platform: "tiktok" }, DEPS(complete, retrieve));

    expect(res.references).toHaveLength(1);
  });

  it("caps the carried references (bounds the injected block)", async () => {
    const many = (n: number, p: string) => Array.from({ length: n }, (_, k) => mkExample({ teardownId: p + k }));
    const complete = scriptedComplete([toolCallResp("q1", "topical", "c1"), toolCallResp("q2", "topical", "c2"), stopResp()]);
    const retrieve = mkRetrieve([many(5, "a"), many(5, "b")]); // 10 distinct rows

    const res = await gatherReferencesViaTool({ ask: "x", platform: "tiktok" }, DEPS(complete, retrieve));

    expect(res.references).toHaveLength(6); // MAX_REFERENCES
  });
});

// ─── executeCorpusSearch ─────────────────────────────────────────────────────

describe("executeCorpusSearch [grounding]", () => {
  it("maps axis → ranking skill (structural→hooks, topical→ideas) and rejects an empty query", async () => {
    const retrieve = vi.fn(async () => ({ examples: [mkExample()], enough: false, stats: {} })) as never;

    await executeCorpusSearch({ query: "x", axis: "structural" }, "tiktok", 1, retrieve);
    // structural → hooks ranking, and the reference config reads cross-platform (recall-favoring).
    expect(retrieve).toHaveBeenCalledWith(
      expect.objectContaining({ skill: "hooks" }),
      expect.objectContaining({ config: expect.objectContaining({ filterPlatform: false }) }),
    );

    await executeCorpusSearch({ query: "x", axis: "topical" }, "tiktok", 1, retrieve);
    // topical → ideas ordering, but the reference config relaxes the generate-path guards.
    expect(retrieve).toHaveBeenLastCalledWith(
      expect.objectContaining({ skill: "ideas" }),
      expect.objectContaining({ config: expect.objectContaining({ filterPlatform: false, rank: "topical" }) }),
    );

    const empty = await executeCorpusSearch({ query: "   " }, "tiktok", 1, retrieve);
    expect(empty.record.error).toBe("empty query");
    expect(empty.examples).toHaveLength(0);
  });
});

// ─── buildReferenceBlock (honesty spine) ─────────────────────────────────────

describe("buildReferenceBlock [grounding]", () => {
  it("carries an HONEST receipt: proven vs curated exemplar; empty in → empty out", () => {
    expect(buildReferenceBlock([])).toBe("");

    const proven = mkExample({ handle: "pro", multiplier: 44, baselineLabel: "vs followers", teardownId: "p" });
    const curated = mkExample({ handle: "cur", multiplier: null, baselineLabel: null, teardownId: "c" });
    const block = buildReferenceBlock([proven, curated]);

    expect(block).toContain("proven by @pro");
    expect(block).toContain("curated exemplar — @cur");
    // The curated row is NEVER dressed as proven.
    expect(block).not.toContain("proven by @cur");
  });
});

describe("SEARCH_CORPUS_TOOL [grounding]", () => {
  it("is a well-formed function tool named search_corpus with a required query", () => {
    expect(SEARCH_CORPUS_TOOL.type).toBe("function");
    expect(SEARCH_CORPUS_TOOL.function.name).toBe("search_corpus");
    expect(SEARCH_CORPUS_TOOL.function.parameters.required).toContain("query");
  });
});
