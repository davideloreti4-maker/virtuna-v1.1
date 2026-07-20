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
    visualSetting: "greenscreen",
    editingStyle: "visual-greenscreen",
    hookTechniques: [],
    niche: "content-creation",
    // Comfortably above the warrant floor by default, so a fixture is citable unless a test says otherwise.
    similarity: 0.71,
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

  it("exposes the facet filters as ENUMS of the real stored vocabulary", () => {
    const props = SEARCH_CORPUS_TOOL.function.parameters.properties as Record<
      string,
      { enum?: readonly string[] }
    >;
    // The spike could not ask for greenscreen and concluded the corpus had none. Both columns that
    // answer that question must be expressible, with the values the rows are actually stored under.
    expect(props.visual_setting?.enum).toContain("greenscreen");
    expect(props.editing_style?.enum).toContain("visual-greenscreen");
    expect(props.editing_style?.enum).toContain("notes-article-greenscreen");
    expect(props.platform?.enum).toEqual(["tiktok", "instagram", "youtube"]);
    expect(props.format?.enum).toContain("breakdowns-explainers");
    expect(props.hook_archetype?.enum).toContain("personal-experience");
    expect(props.niche?.enum).toContain("content-creation");
  });
});

// ─── The warrant contract (the honesty spine at the tool boundary) ───────────
//
// The rule these lock: `grounded` is COMPUTED from measured similarity, never inferred from the fact
// that rows came back. Cosine ALWAYS returns its nearest neighbours — on an absurd query the spike got
// five tangential rows at ~0.5 and a naive `length > 0` called that grounded. Only the model's own
// judgment saved the answer, and a contract that relies on the model choosing honesty is not a contract.

describe("executeCorpusSearch — computed grounding [grounding]", () => {
  const retrieveWith = (examples: RetrievedExample[]) =>
    vi.fn(async () => ({ examples, enough: false, stats: {} })) as never;

  it("topical: rows BELOW the warrant floor are not grounding, however many come back", async () => {
    // Five rows, all tangential — exactly the arm-B shape that slipped through before.
    const tangential = Array.from({ length: 5 }, (_, i) =>
      mkExample({ teardownId: `t${i}`, similarity: 0.42 }),
    );
    const res = await executeCorpusSearch({ query: "quantum tax havens" }, "tiktok", 1, retrieveWith(tangential));
    const payload = JSON.parse(res.content);

    expect(payload.count).toBe(5); // the model still SEES them…
    expect(payload.grounded).toBe(false); // …and is told they prove nothing
    expect(payload.warrant).toBe("none");
    expect(payload.note).toContain("NOT GROUNDED");
    expect(res.record.grounded).toBe(false);
    // Nothing citable: an ungrounded row must never reach a "proven reference" block.
    expect(res.citable).toHaveLength(0);
  });

  it("topical: one row above the floor is enough to warrant a subject claim", async () => {
    const mixed = [mkExample({ teardownId: "a", similarity: 0.62 }), mkExample({ teardownId: "b", similarity: 0.33 })];
    const res = await executeCorpusSearch({ query: "protein" }, "tiktok", 1, retrieveWith(mixed));
    const payload = JSON.parse(res.content);

    expect(payload.grounded).toBe(true);
    expect(payload.warrant).toBe("topical");
    // Per-row honesty INSIDE the batch — grounded means "at least one qualifies", not "all do".
    expect(payload.results.map((r: { on_subject: boolean }) => r.on_subject)).toEqual([true, false]);
    expect(res.citable.map((e) => e.teardownId)).toEqual(["a"]);
  });

  it("structural: warranted on SHAPE regardless of cosine — but never as topic evidence", async () => {
    const offTopic = [mkExample({ teardownId: "s1", similarity: 0.11 })];
    const res = await executeCorpusSearch({ query: "anything", axis: "structural" }, "tiktok", 1, retrieveWith(offTopic));
    const payload = JSON.parse(res.content);

    expect(payload.grounded).toBe(true);
    expect(payload.warrant).toBe("structural");
    expect(payload.note).toContain("never as evidence about this specific topic");
    expect(res.citable).toHaveLength(1); // citable as a pattern
  });

  it("an UNMEASURED similarity never clears the floor (absent is not passing)", async () => {
    const res = await executeCorpusSearch({ query: "x" }, "tiktok", 1, retrieveWith([mkExample({ similarity: null })]));
    const payload = JSON.parse(res.content);

    expect(payload.grounded).toBe(false);
    expect(payload.results[0].on_subject).toBeNull();
    expect(res.citable).toHaveLength(0);
  });

  it("no rows at all → not grounded", async () => {
    const res = await executeCorpusSearch({ query: "x" }, "tiktok", 1, retrieveWith([]));
    expect(JSON.parse(res.content).grounded).toBe(false);
    expect(JSON.parse(res.content).warrant).toBe("none");
  });
});

describe("executeCorpusSearch — facet filters [grounding]", () => {
  it("passes VALID facets down to retrieval and drops values outside the vocabulary", async () => {
    const retrieve = vi.fn(async () => ({ examples: [mkExample()], enough: false, stats: {} })) as never;

    await executeCorpusSearch(
      {
        query: "greenscreen breakdowns",
        visual_setting: "greenscreen",
        editing_style: "visual-greenscreen",
        platform: "instagram",
        format: "breakdowns-explainers",
        niche: "content-creation",
        hook_archetype: "not-a-real-archetype", // invalid → dropped, never guessed
      },
      "tiktok",
      1,
      retrieve,
    );

    expect(retrieve).toHaveBeenCalledWith(
      expect.objectContaining({
        facets: {
          visualSetting: "greenscreen",
          editingStyle: "visual-greenscreen",
          platform: "instagram",
          format: "breakdowns-explainers",
          niche: "content-creation",
        },
      }),
      expect.anything(),
    );
  });

  it("caps a model-supplied limit and reports the facets it used", async () => {
    const many = Array.from({ length: 30 }, (_, i) => mkExample({ teardownId: `r${i}` }));
    const retrieve = vi.fn(async () => ({ examples: many, enough: true, stats: {} })) as never;

    const res = await executeCorpusSearch({ query: "x", limit: 999, platform: "tiktok" }, "tiktok", 1, retrieve);

    expect(JSON.parse(res.content).count).toBe(12); // MAX_ROWS_PER_CALL
    expect(JSON.parse(res.content).filters).toEqual({ platform: "tiktok" });
    expect(res.record.facets).toEqual({ platform: "tiktok" });
  });
});

describe("gatherReferencesViaTool — the harvest gate [grounding]", () => {
  it("carries NO references out of an ungrounded topical pull", async () => {
    const complete = scriptedComplete([toolCallResp("absurd subject", "topical"), stopResp()]);
    const retrieve = mkRetrieve([[mkExample({ teardownId: "a", similarity: 0.4 }), mkExample({ teardownId: "b", similarity: 0.38 })]]);

    const res = await gatherReferencesViaTool({ ask: "x", platform: "tiktok" }, DEPS(complete, retrieve));

    // The model saw two rows and may reason about them; the reference block gets nothing, because a
    // block headed "PROVEN REFERENCE MATERIAL" containing tangential rows is the fabricated citation.
    expect(res.toolCalls[0]!.rows).toBe(2);
    expect(res.toolCalls[0]!.grounded).toBe(false);
    expect(res.references).toHaveLength(0);
  });
});

/**
 * The first-frame TECHNIQUE axis (Sandcastles `visual_hooks` collections, 2026-07-20).
 *
 * These exist because the corpus shipped TWO axes both descended from the phrase "visual hook" and
 * we only ever promoted one. `visual_setting` is WHERE the video is staged; `hook_technique` is what
 * the opening shot DOES. Conflating them is why "show me videos with a good visual hook" quietly
 * answered from the staging taxonomy for months — so the lock below is that the two travel as
 * SEPARATE facets and neither collapses into the other.
 */
describe("executeCorpusSearch — first-frame technique facets [grounding]", () => {
  it("passes hook_technique and hook_family down as their own facets", async () => {
    const retrieve = vi.fn(async () => ({ examples: [mkExample()], enough: false, stats: {} })) as never;

    await executeCorpusSearch(
      { query: "strong openings", hook_technique: "camera-whip", hook_family: "subject-motion" },
      "tiktok",
      1,
      retrieve,
    );

    expect(retrieve).toHaveBeenCalledWith(
      expect.objectContaining({
        facets: { hookTechnique: "camera-whip", hookFamily: "subject-motion" },
      }),
      expect.anything(),
    );
  });

  it("🔴 keeps the TECHNIQUE and the SETTING as separate axes — neither overwrites the other", async () => {
    const retrieve = vi.fn(async () => ({ examples: [mkExample()], enough: false, stats: {} })) as never;

    await executeCorpusSearch(
      { query: "greenscreen with a strong opening", visual_setting: "greenscreen", hook_technique: "match-cut" },
      "tiktok",
      1,
      retrieve,
    );

    const { facets } = (retrieve as unknown as { mock: { calls: Array<[{ facets: Record<string, unknown> }]> } })
      .mock.calls[0]![0];
    expect(facets.visualSetting).toBe("greenscreen"); // staging
    expect(facets.hookTechnique).toBe("match-cut"); // device
  });

  it("drops a technique outside the stored vocabulary rather than guessing", async () => {
    const retrieve = vi.fn(async () => ({ examples: [mkExample()], enough: false, stats: {} })) as never;

    await executeCorpusSearch(
      { query: "x", hook_technique: "sick-transition", hook_family: "not-a-family" },
      "tiktok",
      1,
      retrieve,
    );

    expect(retrieve).toHaveBeenCalledWith(
      expect.objectContaining({ facets: {} }),
      expect.anything(),
    );
  });

  it("names the technique on a catalogued row and OMITS it on an uncatalogued one", async () => {
    // Absent ≠ "this video has no visual hook". Only 154 of 524 rows are catalogued, so emitting
    // null would assert something about the other 370 that nobody ever measured.
    const retrieve = vi.fn(async () => ({
      examples: [
        mkExample({ teardownId: "tagged", similarity: 0.8, hookTechniques: ["Camera Whip"] }),
        mkExample({ teardownId: "untagged", similarity: 0.8, hookTechniques: [] }),
      ],
      enough: true,
      stats: {},
    })) as never;

    const res = await executeCorpusSearch({ query: "openings" }, "tiktok", 1, retrieve);
    const payload = JSON.parse(res.content);

    expect(payload.results[0].hook_technique).toBe("Camera Whip");
    expect(payload.results[1]).not.toHaveProperty("hook_technique");
  });

  it("joins multiple techniques — 4 corpus rows genuinely carry two", async () => {
    const retrieve = vi.fn(async () => ({
      examples: [mkExample({ similarity: 0.8, hookTechniques: ["Camera Whip", "Match Cut"] })],
      enough: true,
      stats: {},
    })) as never;

    const res = await executeCorpusSearch({ query: "openings" }, "tiktok", 1, retrieve);
    expect(JSON.parse(res.content).results[0].hook_technique).toBe("Camera Whip, Match Cut");
  });

  it("the tool schema advertises both axes distinctly, so the model can tell them apart", () => {
    type Prop = { enum?: string[]; description?: string };
    const props = SEARCH_CORPUS_TOOL.function.parameters.properties as Record<string, Prop | undefined>;
    const prop = (name: string): Prop => {
      const p = props[name];
      if (!p) throw new Error(`search_corpus schema is missing the "${name}" parameter`);
      return p;
    };

    expect(prop("hook_technique").enum).toHaveLength(47);
    expect(prop("hook_family").enum).toHaveLength(5);
    expect(prop("hook_technique").enum).toContain("camera-whip");
    expect(prop("hook_family").enum).toContain("pattern-interrupt-visual-switching");
    // The setting's description must point at the technique, or the model keeps conflating them.
    expect(prop("visual_setting").description).toMatch(/hook_technique/);
    // Thin coverage stated in the schema itself — the model reads this, not our docs.
    expect(prop("hook_technique").description).toMatch(/154 of 524/);
  });
});
