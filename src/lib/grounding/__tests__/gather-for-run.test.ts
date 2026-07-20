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
    visualSetting: "studio_set",
    editingStyle: "office-room-yap",
    hookTechniques: [],
    niche: "health-fitness",
    similarity: 0.71,
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

/**
 * A row as the SCRAPE actually produces it. `orchestrator.ts` sets `similarity: null` — the row was
 * never matched against a query, so there is no cosine to state.
 *
 * The fixtures above all carry `similarity: 0.71`, including the ones exercising the scrape path.
 * That is the blindness this exists to remove: a warrant assessment that treats an unmeasured row as
 * failing marks every paid "Find new outliers" run ungrounded, and NOT ONE cached-fixture test would
 * have gone red.
 */
function scrapedExample(id: string): RetrievedExample {
  return { ...example(id), similarity: null };
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

  /**
   * THE SPEND GATE. A cache miss used to reach for Apify on its own — measured 2026-07-17, that
   * billed the owner on 75% of realistic ideas/script asks (only 3 of 12 cleared the old 0.58
   * floor), silently and with no way to decline. The scrape is now explicit-only. These three
   * assert the DEFAULT costs nothing; the trio below assert the authorized path still works.
   */
  it("does NOT scrape on a cache miss by default — it degrades to ungrounded, free", async () => {
    const gather = vi.fn<Gather>();

    const result = await gatherCorpusForRun(baseInput(), { retrieve: miss, gather });

    expect(gather).not.toHaveBeenCalled(); // the whole point: no silent Apify bill
    // `miss` returns 1 partial row — better than nothing, and it cost nothing to have.
    expect(result.examples.map((e) => e.teardownId)).toEqual(["a"]);
  });

  it("does NOT scrape when read-back throws, by default", async () => {
    const warnings: string[] = [];
    const gather = vi.fn<Gather>();

    const result = await gatherCorpusForRun(baseInput(warnings), {
      retrieve: async () => {
        throw new Error("rpc down");
      },
      gather,
    });

    expect(gather).not.toHaveBeenCalled();
    expect(result.corpus).toBeUndefined();
    expect(result.examples).toEqual([]);
    expect(warnings).toEqual([]); // read-back failure stays invisible to the user
  });

  it("scrapes on a cache miss ONLY when the user authorized it", async () => {
    const gather = vi.fn<Gather>(async () => ({
      examples: [example("live")],
      stats: { scraped: 30, selected: 6, withFollowers: 6, gated: 6, usable: 1 },
    }));

    const result = await gatherCorpusForRun(
      { ...baseInput(), allowScrape: true },
      { retrieve: miss, gather },
    );

    expect(gather).toHaveBeenCalledOnce();
    expect(result.examples.map((e) => e.teardownId)).toEqual(["live"]);
  });

  it("falls through to the scrape when read-back throws, without a user warning", async () => {
    const warnings: string[] = [];
    const gather = vi.fn<Gather>(async () => ({
      examples: [example("live")],
      stats: { scraped: 30, selected: 6, withFollowers: 6, gated: 6, usable: 1 },
    }));

    const result = await gatherCorpusForRun(
      { ...baseInput(warnings), allowScrape: true },
      {
        retrieve: async () => {
          throw new Error("rpc down");
        },
        gather,
      },
    );

    expect(gather).toHaveBeenCalledOnce();
    expect(result.examples).toHaveLength(1);
    expect(warnings).toEqual([]); // read-back failure is invisible to the user
  });

  it("degrades to ungrounded with a warning only when an AUTHORIZED scrape ALSO fails", async () => {
    const warnings: string[] = [];
    const result = await gatherCorpusForRun(
      { ...baseInput(warnings), allowScrape: true },
      {
        retrieve: miss,
        gather: async () => {
          throw new Error("apify down");
        },
      },
    );

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
    // A short-circuit warrants nothing — it never retrieved a row to warrant anything WITH.
    const none = {
      corpus: undefined,
      examples: [],
      scrapeAvailable: false,
      warrant: "none",
      grounded: false,
    };

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

// ─── scrapeAvailable — the "Find new outliers" capability signal ──────────────

/** A cache read that finds NOTHING usable — the fully-ungrounded degrade (vs `miss`'s 1 partial). */
const missEmpty: Retrieve = async () => ({
  examples: [],
  enough: false,
  stats: { matched: 0, good: 0, minRows: 2, minSimilarity: 0.6, rank: "topical", archetypes: 0 },
});

describe("gatherCorpusForRun — scrapeAvailable", () => {
  // The signal must be true EXACTLY when a live scrape would find outliers this run couldn't:
  // grounding on, platform scrapable, cache thin, and the spend not yet authorized. The button
  // that reads it should never dangle where a scrape can't help, and never nag once one has run.

  it("is TRUE when a scrapable run degrades to ungrounded only because the scrape wasn't authorized", async () => {
    const result = await gatherCorpusForRun(baseInput(), {
      retrieve: missEmpty,
      gather: vi.fn<Gather>(),
    });

    expect(result.examples).toEqual([]); // ungrounded…
    expect(result.scrapeAvailable).toBe(true); // …but a scrape is a tap away
  });

  it("is TRUE on a thin partial too — the run is grounded, but more outliers are a scrape away", async () => {
    const result = await gatherCorpusForRun(baseInput(), { retrieve: miss, gather: vi.fn<Gather>() });

    expect(result.examples).toHaveLength(1); // grounded on the 1 partial row we had
    expect(result.scrapeAvailable).toBe(true);
  });

  it("is FALSE on a non-scrapable platform — nothing to reach for, so nothing to offer", async () => {
    const result = await gatherCorpusForRun(
      { ...baseInput(), platform: "instagram" },
      { retrieve: missEmpty, gather: vi.fn<Gather>() },
    );

    expect(result.scrapeAvailable).toBe(false);
  });

  it("is FALSE on a full cache hit — the run is grounded, a scrape adds nothing", async () => {
    const result = await gatherCorpusForRun(baseInput(), { retrieve: hit, gather: vi.fn<Gather>() });

    expect(result.examples.length).toBeGreaterThan(0);
    expect(result.scrapeAvailable).toBe(false);
  });

  it("is FALSE once a scrape is already authorized — there is nothing left to offer", async () => {
    const gather = vi.fn<Gather>(async () => ({
      examples: [example("live")],
      stats: { scraped: 30, selected: 6, withFollowers: 6, gated: 6, usable: 1 },
    }));

    const result = await gatherCorpusForRun(
      { ...baseInput(), allowScrape: true },
      { retrieve: miss, gather },
    );

    expect(gather).toHaveBeenCalledOnce();
    expect(result.scrapeAvailable).toBe(false);
  });

  it("is FALSE when grounding is disabled — the button would be a no-op", async () => {
    const result = await gatherCorpusForRun(
      { ...baseInput(), enabled: false },
      { retrieve: vi.fn<Retrieve>(), gather: vi.fn<Gather>() },
    );

    expect(result.scrapeAvailable).toBe(false);
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

describe("gatherCorpusForRun — the shared warrant contract", () => {
  /**
   * THE regression guard. The user tapped "Find new outliers", paid for an Apify scrape, and got
   * back real above-baseline outliers — which carry no cosine. If the warrant assessment reads that
   * absence as "below the floor", the run they paid for renders UNGROUNDED.
   */
  it("keeps an AUTHORIZED scrape grounded even though scraped rows carry no similarity", async () => {
    const gather = vi.fn<Gather>(async () => ({
      examples: [scrapedExample("live-a"), scrapedExample("live-b")],
      stats: { scraped: 30, selected: 6, withFollowers: 6, gated: 6, usable: 2 },
    }));

    const result = await gatherCorpusForRun(
      { ...baseInput(), skill: "ideas", allowScrape: true },
      { retrieve: miss, gather },
    );

    expect(result.examples).toHaveLength(2);
    expect(result.grounded).toBe(true);
    // Named honestly: warranted by EXTRACTION, not by a closeness we never measured.
    expect(result.warrant).toBe("provenance");
  });

  it("grounds a topical cache hit on the subject axis", async () => {
    const result = await gatherCorpusForRun(
      { ...baseInput(), skill: "ideas" },
      { retrieve: hit, gather: vi.fn<Gather>() },
    );
    expect(result).toMatchObject({ grounded: true, warrant: "topical" });
  });

  it("grounds hooks structurally — its floor is 0 because structure transfers across subjects", async () => {
    const result = await gatherCorpusForRun(
      { ...baseInput(), skill: "hooks" },
      { retrieve: hit, gather: vi.fn<Gather>() },
    );
    expect(result).toMatchObject({ grounded: true, warrant: "structural" });
  });

  it("reports NOT grounded when nothing was retrieved at all", async () => {
    const empty: Retrieve = async () => ({
      examples: [],
      enough: false,
      stats: { matched: 0, good: 0, minRows: 2, minSimilarity: 0.6, rank: "topical", archetypes: 0 },
    });
    const result = await gatherCorpusForRun(
      { ...baseInput(), skill: "ideas" },
      { retrieve: empty, gather: vi.fn<Gather>() },
    );
    expect(result).toMatchObject({ grounded: false, warrant: "none", corpus: undefined });
  });

  it("reports NOT grounded when the skill is gated off", async () => {
    const result = await gatherCorpusForRun(
      { ...baseInput(), enabled: false },
      { retrieve: hit, gather: vi.fn<Gather>() },
    );
    expect(result).toMatchObject({ grounded: false, warrant: "none" });
  });
});
