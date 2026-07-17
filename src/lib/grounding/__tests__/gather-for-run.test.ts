import { describe, it, expect, vi } from "vitest";
import { gatherCorpusForRun, GROUNDING_STAGE_NAME } from "../gather-for-run";
import type { RetrievedExample } from "../types";
import type { retrieveCachedExamples } from "../retrieve";
import type { gatherAndExtract } from "../orchestrator";
import type { adaptCorpusBlock } from "../adapt";

function example(id: string): RetrievedExample {
  return {
    teardownId: id,
    handle: "maker",
    videoUrl: "https://tiktok.com/@maker/video/1",
    coverUrl: null,
    platform: "tiktok",
    multiplier: 12,
    views: 1_000_000,
    baselineLabel: "vs followers",
    fitLabel: "adjacent",
    hookArchetype: "contrarian",
    format: "listicle",
    spokenHook: "Stop buying protein bars.",
    hookTemplate: "Stop buying [product category].",
    template: null,
    idea: null,
    whyItWorks: null,
    sourcePool: "scraped",
    trustWeight: 0.6,
    fromPersonal: false,
  };
}

type Retrieve = typeof retrieveCachedExamples;
type Gather = typeof gatherAndExtract;

const hit: Retrieve = async () => ({
  examples: [example("a"), example("b")],
  enough: true,
  stats: { matched: 5, good: 2, minRows: 2, minSimilarity: 0.6, rank: "topical", archetypes: 2 },
});

const miss: Retrieve = async () => ({
  examples: [example("a")],
  enough: false,
  stats: { matched: 2, good: 1, minRows: 2, minSimilarity: 0.6, rank: "topical", archetypes: 1 },
});

function baseInput(warnings: string[] = []) {
  return {
    enabled: true,
    skill: "hooks" as const, // selects the per-skill slice (§1E); hooks → the madlib
    platform: "tiktok",
    queryCandidates: ["high protein breakfast"],
    niche: "food",
    warnings,
  };
}

describe("gatherCorpusForRun — read-back first", () => {
  /**
   * The skill argument selects the RANKING AXIS inside retrieve (hooks → structural, ideas/script
   * → topical), so a skill that does not survive the call is a skill that silently reverts hooks to
   * the topical path that retrieved nothing for 8 of 10 real asks. It typechecks either way — the
   * runner already passed `skill`, gather-for-run simply never forwarded it, and every persisted
   * test stayed green. Assert the wire, not the type.
   */
  it("forwards the skill to retrieval (it picks the ranking axis, not just the render)", async () => {
    const retrieve = vi.fn<Retrieve>(hit);

    await gatherCorpusForRun({ ...baseInput(), skill: "ideas" }, { retrieve, gather: vi.fn<Gather>() });

    expect(retrieve).toHaveBeenCalledWith(expect.objectContaining({ skill: "ideas" }));
  });

  it("skips the scrape entirely on a cache hit", async () => {
    const gather = vi.fn<Gather>();
    const stages: Array<[string, string]> = [];

    const result = await gatherCorpusForRun(
      { ...baseInput(), onStage: (n, s) => stages.push([n, s]) },
      { retrieve: hit, gather },
    );

    expect(gather).not.toHaveBeenCalled();
    expect(result.examples.map((e) => e.teardownId)).toEqual(["a", "b"]);
    expect(result.corpus).toContain("Stop buying");
    expect(stages).toEqual([
      [GROUNDING_STAGE_NAME, "active"],
      [GROUNDING_STAGE_NAME, "done"],
    ]);
  });

  it("falls through to the scrape when the cache has too few good rows", async () => {
    const gather = vi.fn<Gather>(async () => ({
      examples: [example("live")],
      stats: { scraped: 30, selected: 6, withFollowers: 6, gated: 6, usable: 1 },
    }));

    const result = await gatherCorpusForRun(baseInput(), { retrieve: miss, gather });

    expect(gather).toHaveBeenCalledOnce();
    expect(result.examples.map((e) => e.teardownId)).toEqual(["live"]);
  });

  it("falls through to the scrape when read-back throws, without a user warning", async () => {
    const warnings: string[] = [];
    const gather = vi.fn<Gather>(async () => ({
      examples: [example("live")],
      stats: { scraped: 30, selected: 6, withFollowers: 6, gated: 6, usable: 1 },
    }));

    const result = await gatherCorpusForRun(baseInput(warnings), {
      retrieve: async () => {
        throw new Error("rpc down");
      },
      gather,
    });

    expect(gather).toHaveBeenCalledOnce();
    expect(result.examples).toHaveLength(1);
    expect(warnings).toEqual([]); // read-back failure is invisible to the user
  });

  it("degrades to ungrounded with a warning only when the scrape ALSO fails", async () => {
    const warnings: string[] = [];
    const result = await gatherCorpusForRun(baseInput(warnings), {
      retrieve: miss,
      gather: async () => {
        throw new Error("apify down");
      },
    });

    expect(result.corpus).toBeUndefined();
    expect(result.examples).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("apify down");
  });

  it("READS the cache on Instagram but never scrapes it (read-back ≠ scrape)", async () => {
    // The old gate short-circuited the whole step unless platform === "tiktok", because the
    // SCRAPE is TikTok-only. But the read-back is just pgvector — it has no TikTok dependency.
    // The curated corpus is majority Instagram (208 proof-grade rows vs TikTok's 63), so that
    // conflation gave Instagram creators zero grounding, permanently, and left most of the
    // corpus unreachable by anyone.
    const gather = vi.fn<Gather>();
    const result = await gatherCorpusForRun(
      { ...baseInput(), platform: "instagram" },
      { retrieve: hit, gather },
    );

    expect(result.examples.length).toBeGreaterThan(0); // grounded
    expect(gather).not.toHaveBeenCalled(); // but never scraped
  });

  it("grounds on a PARTIAL Instagram cache rather than throwing proven outliers away", async () => {
    // `minRows` decides whether skipping a scrape is worth it — it is not a quality bar. On a
    // platform we cannot scrape there is no scrape to skip, so discarding the real proven
    // outliers we did find, to run ungrounded, would be self-defeating. Two sources beat none.
    const gather = vi.fn<Gather>();
    const result = await gatherCorpusForRun(
      { ...baseInput(), platform: "instagram" },
      { retrieve: miss, gather }, // 1 example, enough=false
    );

    expect(result.examples).toHaveLength(1);
    expect(result.corpus).toBeDefined();
    expect(gather).not.toHaveBeenCalled();
  });

  it("keeps the gates: disabled / unsupported platform / empty query short-circuit before any I/O", async () => {
    const retrieve = vi.fn<Retrieve>();
    const gather = vi.fn<Gather>();
    const none = { corpus: undefined, examples: [] };

    expect(
      await gatherCorpusForRun({ ...baseInput(), enabled: false }, { retrieve, gather }),
    ).toEqual(none);
    expect(
      await gatherCorpusForRun({ ...baseInput(), platform: "linkedin" }, { retrieve, gather }),
    ).toEqual(none);
    expect(
      await gatherCorpusForRun(
        { ...baseInput(), queryCandidates: [null, "  "] },
        { retrieve, gather },
      ),
    ).toEqual(none);
    expect(retrieve).not.toHaveBeenCalled();
    expect(gather).not.toHaveBeenCalled();
  });
});

// ─── Grounding-as-remix routing (adapt briefer) ───────────────────────────────

type Adapt = typeof adaptCorpusBlock;

/** A fake adapt stage: proves the corpus was routed through it, and returns its own `used`. */
function fakeAdapt(): ReturnType<typeof vi.fn<Adapt>> {
  return vi.fn<Adapt>(async () => ({ corpus: "ADAPTED-BRIEF", used: [example("z")] }));
}

describe("gatherCorpusForRun — adapt routing", () => {
  const profile = { niche_primary: "food", writing_voice_sample: "plain" };

  it("routes the retrieved corpus through the adapt briefer when adapt is on (hooks + profile)", async () => {
    const adapt = fakeAdapt();
    const result = await gatherCorpusForRun(
      { ...baseInput(), adapt: true, adaptProfile: profile },
      { retrieve: hit, gather: vi.fn<Gather>(), adapt },
    );

    expect(adapt).toHaveBeenCalledOnce();
    // The runner receives the brief's `used` as its examples (sourceIndex maps against it), not the
    // raw retrieved list — and the corpus is the fitted brief, not the raw slice.
    expect(result.corpus).toBe("ADAPTED-BRIEF");
    expect(result.examples.map((e) => e.teardownId)).toEqual(["z"]);
    // adapt was handed the resolved ask + the retrieved exemplars.
    expect(adapt).toHaveBeenCalledWith(
      expect.objectContaining({
        skill: "hooks",
        ask: "high protein breakfast",
        examples: expect.arrayContaining([expect.objectContaining({ teardownId: "a" })]),
      }),
    );
  });

  it("routes ideas AND script through the adapt briefer too (Phase 2 fan-out)", async () => {
    for (const skill of ["ideas", "script"] as const) {
      const adapt = fakeAdapt();
      const result = await gatherCorpusForRun(
        { ...baseInput(), skill, adapt: true, adaptProfile: profile },
        { retrieve: hit, gather: vi.fn<Gather>(), adapt },
      );

      expect(adapt).toHaveBeenCalledOnce();
      expect(adapt).toHaveBeenCalledWith(expect.objectContaining({ skill }));
      expect(result.corpus).toBe("ADAPTED-BRIEF");
      expect(result.examples.map((e) => e.teardownId)).toEqual(["z"]);
    }
  });

  it("does NOT adapt when the flag is on but no profile was threaded", async () => {
    const adapt = fakeAdapt();
    const result = await gatherCorpusForRun(
      { ...baseInput(), adapt: true }, // adaptProfile omitted
      { retrieve: hit, gather: vi.fn<Gather>(), adapt },
    );

    expect(adapt).not.toHaveBeenCalled();
    expect(result.corpus).toContain("Stop buying");
  });

  it("does NOT adapt when the flag is off (default byte-identical path)", async () => {
    const adapt = fakeAdapt();
    const result = await gatherCorpusForRun(
      { ...baseInput(), adaptProfile: profile }, // adapt flag absent
      { retrieve: hit, gather: vi.fn<Gather>(), adapt },
    );

    expect(adapt).not.toHaveBeenCalled();
    expect(result.corpus).toContain("Stop buying");
  });
});
