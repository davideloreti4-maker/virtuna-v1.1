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

  /**
   * ⚠️ CHANGED 2026-08-15 with live-first ordering: the cache is read here as `missEmpty`, not
   * `miss`. Under the old order the scrape ran last, so a failed scrape ended the run and its
   * 1-row partial went in the bin. Now the cache is the SAFETY NET behind the live path, and a
   * partial rescues the run instead of being discarded — pinned by "falls back to a PARTIAL cache
   * when the live scrape finds nothing" in the live-first block below.
   *
   * The claim this test exists to make is unchanged and still exact: the warning fires only when
   * the run genuinely degrades, which now means live AND cache both came back with nothing.
   */
  it("degrades to ungrounded with a warning only when an AUTHORIZED scrape ALSO fails", async () => {
    const warnings: string[] = [];
    const result = await gatherCorpusForRun(
      { ...baseInput(warnings), allowScrape: true },
      {
        retrieve: missEmpty,
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
      adapted: false,
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

// ─── live-first ordering — the authorized run reaches Apify BEFORE the cache ──

/** A cache read that finds NOTHING usable — the fully-ungrounded degrade (vs `miss`'s 1 partial). */
const missEmpty: Retrieve = async () => ({
  examples: [],
  enough: false,
  stats: { matched: 0, good: 0, minRows: 2, minSimilarity: 0.6, rank: "topical", archetypes: 0 },
});

describe("gatherCorpusForRun — live-first when the scrape is authorized", () => {
  /**
   * THE ORDERING FIX. Read-back used to return EARLY on a hit, so `allowScrape` was consulted only
   * after a MISS — and the 532-row corpus almost never misses (95.5% of real asks clear gate 1;
   * even "restoring vintage fountain pens", picked to be obscure, hit). The consequence was that an
   * authorization to spend was unreachable on ~19 of every 20 asks: `LIVE_SCRAPE_DEFAULT` could be
   * ON and never once reach Apify, and a second tap of "Find new outliers" was answered by the
   * write-through the FIRST tap had just populated.
   *
   * So authorization now reorders the step rather than only unlocking its tail. Unauthorized runs
   * are untouched — the cache still answers first and nothing is ever scraped without a request.
   */
  it("runs the LIVE scrape first and never reads the cache over it", async () => {
    const retrieve = vi.fn<Retrieve>(hit); // a FULL hit — the row set that used to win by ordering
    const gather = vi.fn<Gather>(async () => ({
      examples: [scrapedExample("live")],
      stats: { scraped: 30, selected: 6, withFollowers: 6, gated: 6, usable: 1 },
    }));

    const result = await gatherCorpusForRun(
      { ...baseInput(), allowScrape: true },
      { retrieve, gather },
    );

    expect(gather).toHaveBeenCalledOnce();
    expect(retrieve).not.toHaveBeenCalled(); // the cache never got to answer
    expect(result.examples.map((e) => e.teardownId)).toEqual(["live"]);
    expect(result.warrant).toBe("provenance"); // extracted rows, judged as extracted rows
  });

  /**
   * The cache stops being the answer and becomes the SAFETY NET. A live scrape that comes back
   * empty is the normal shape of the clockworks outage measured 2026-08-14 (SUCCEEDED, 0 items,
   * $0.00) — throwing away proven cached outliers because a broken upstream returned nothing would
   * make the authorized run strictly worse than the free one.
   */
  it("falls back to the cache when the live scrape comes back EMPTY", async () => {
    const gather = vi.fn<Gather>(async () => ({
      examples: [],
      stats: { scraped: 0, selected: 0, withFollowers: 0, gated: 0, usable: 0 },
    }));

    const result = await gatherCorpusForRun(
      { ...baseInput(), allowScrape: true },
      { retrieve: hit, gather },
    );

    expect(gather).toHaveBeenCalledOnce(); // we DID reach for live first
    expect(result.examples.map((e) => e.teardownId)).toEqual(["a", "b"]); // …and the cache caught it
    expect(result.grounded).toBe(true);
  });

  /**
   * A THROW is the other half of that net, and it is a different code path: the old order let the
   * outer catch turn an Apify failure into an ungrounded run, because by then the cache had already
   * been consulted and passed over. Live-first must not make a failed scrape cost the user the
   * grounding they would have had for free.
   */
  it("falls back to the cache when the live scrape THROWS, with no user-facing warning", async () => {
    const warnings: string[] = [];
    const gather = vi.fn<Gather>(async () => {
      throw new Error("apify down");
    });

    const result = await gatherCorpusForRun(
      { ...baseInput(warnings), allowScrape: true },
      { retrieve: hit, gather },
    );

    expect(gather).toHaveBeenCalledOnce();
    expect(result.examples.map((e) => e.teardownId)).toEqual(["a", "b"]);
    expect(warnings).toEqual([]); // the run is grounded — there is nothing to disclaim
  });

  /** The partial rescue: fewer rows than `minRows`, but two proven sources still beat none. */
  it("falls back to a PARTIAL cache when the live scrape finds nothing", async () => {
    const result = await gatherCorpusForRun(
      { ...baseInput(), allowScrape: true },
      {
        retrieve: miss, // 1 row, enough=false
        gather: async () => {
          throw new Error("apify down");
        },
      },
    );

    expect(result.examples).toHaveLength(1);
    expect(result.corpus).toBeDefined();
    // Nothing left to offer: the scrape it would authorize is the one that just failed.
    expect(result.scrapeAvailable).toBe(false);
  });

  /**
   * THE UNCHANGED HALF, pinned. Reordering on authorization must not reorder anything else: a send
   * that did not authorize spend behaves exactly as it did before, cache-first, Apify untouched.
   * Without this the fix reads as "live-first" when it is really "live-always".
   */
  it("leaves an UNAUTHORIZED run cache-first and free", async () => {
    const retrieve = vi.fn<Retrieve>(hit);
    const gather = vi.fn<Gather>();

    const result = await gatherCorpusForRun(baseInput(), { retrieve, gather });

    expect(retrieve).toHaveBeenCalledOnce();
    expect(gather).not.toHaveBeenCalled();
    expect(result.examples.map((e) => e.teardownId)).toEqual(["a", "b"]);
  });

  /**
   * Authorization cannot reorder a platform that has no scrape to run first. Instagram is the
   * majority of the corpus (208 proof-grade rows) and is read-back-only — reaching for a TikTok
   * scraper there would spend nothing and find nothing, while skipping the rows we do own.
   */
  it("stays cache-first on a non-scrapable platform even when authorized", async () => {
    const retrieve = vi.fn<Retrieve>(hit);
    const gather = vi.fn<Gather>();

    const result = await gatherCorpusForRun(
      { ...baseInput(), platform: "instagram", allowScrape: true },
      { retrieve, gather },
    );

    expect(retrieve).toHaveBeenCalledOnce();
    expect(gather).not.toHaveBeenCalled();
    expect(result.examples.length).toBeGreaterThan(0);
  });
});

// ─── scrapeAvailable — the "Find new outliers" capability signal ──────────────

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
  return vi.fn<Adapt>(async () => ({ corpus: "ADAPTED-BRIEF", used: [example("z")], adapted: true }));
}

describe("gatherCorpusForRun — adapt routing", () => {
  const profile = { niche_primary: "food", writing_voice_description: "plain" };

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
    // The brief's kind reaches the runner — its citation guard binds the madlib check to slices only.
    expect(result.adapted).toBe(true);
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
    expect(result.adapted).toBe(false);
  });

  it("does NOT adapt when the flag is off (default byte-identical path)", async () => {
    const adapt = fakeAdapt();
    const result = await gatherCorpusForRun(
      { ...baseInput(), adaptProfile: profile }, // adapt flag absent
      { retrieve: hit, gather: vi.fn<Gather>(), adapt },
    );

    expect(adapt).not.toHaveBeenCalled();
    expect(result.corpus).toContain("Stop buying");
    expect(result.adapted).toBe(false);
  });

  it("reports adapted:false when the briefer itself FELL BACK to the raw slice", async () => {
    // The adapt stage degrades internally (LLM failure / kept-0 sweep) and returns the slice —
    // the runner's citation guard must still verify THAT corpus under the slice contract.
    const adapt = vi.fn<Adapt>(async () => ({
      corpus: "RAW-SLICE-FALLBACK",
      used: [example("a")],
      adapted: false,
    }));
    const result = await gatherCorpusForRun(
      { ...baseInput(), adapt: true, adaptProfile: profile },
      { retrieve: hit, gather: vi.fn<Gather>(), adapt },
    );

    expect(adapt).toHaveBeenCalledOnce();
    expect(result.corpus).toBe("RAW-SLICE-FALLBACK");
    expect(result.adapted).toBe(false);
  });
});

// ─── Query distillation — search runs short, the briefer keeps the whole ask ──

/**
 * The query candidate is the creator's chat message, and it is routinely 400+ chars. TikTok search
 * takes it literally, so retrieval on the raw ask returns topically random videos — which caps how
 * often a receipt can ever be honest, no matter how good the briefer is.
 *
 * The split these two tests pin: RETRIEVAL (and the live scrape) run on the distilled, search-shaped
 * query; the adapt briefer keeps the RAW ask, because fit is judged against what the creator
 * actually said and the distilled subject has had that context compressed out of it. Wiring both to
 * one string is the easy mistake, and it silently costs whichever half it isn't tuned for.
 */
describe("gatherCorpusForRun — query distillation", () => {
  const profile = { niche_primary: "food", writing_voice_description: "plain" };

  it("retrieves on the distilled query when the candidate is long", async () => {
    const longAsk = "give me hooks for ".padEnd(120, "x");
    const distill = vi.fn(async () => "short subject");
    const retrieve = vi.fn<Retrieve>(miss);

    await gatherCorpusForRun(
      { ...baseInput(), queryCandidates: [longAsk] },
      { retrieve, gather: vi.fn<Gather>(), distill },
    );

    expect(distill).toHaveBeenCalledWith(longAsk);
    expect(retrieve).toHaveBeenCalledWith(expect.objectContaining({ query: "short subject" }));
  });

  it("adapt still receives the RAW query as its fit ask", async () => {
    const longAsk = "give me hooks for ".padEnd(120, "x");
    const adapt = fakeAdapt();

    await gatherCorpusForRun(
      { ...baseInput(), queryCandidates: [longAsk], adapt: true, adaptProfile: profile },
      { retrieve: hit, gather: vi.fn<Gather>(), adapt, distill: vi.fn(async () => "short subject") },
    );

    expect(adapt).toHaveBeenCalledWith(expect.objectContaining({ ask: longAsk }));
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

/**
 * The EVIDENCE emit — the retrieved outliers, handed to the loading spine ~40s before the first
 * card exists.
 *
 * Two invariants, and the second is the one that keeps this honest: the rail describes the rows
 * with the SAME warrant the cards will be stamped with, and it does not fire at all on a run that
 * is not grounded. A wait that advertises "3 proven videos" over an ungrounded generation is a
 * promise the output then quietly disclaims.
 */
describe("gatherCorpusForRun — evidence for the loading spine", () => {
  it("emits the rows the model was shown, with their measured multiplier", async () => {
    const onEvidence = vi.fn();

    await gatherCorpusForRun(
      { ...baseInput(), skill: "ideas", onEvidence },
      { retrieve: hit, gather: vi.fn<Gather>() },
    );

    expect(onEvidence).toHaveBeenCalledTimes(1);
    const evidence = onEvidence.mock.calls[0]![0];
    // CHANGED 2026-08-15, deliberately and in place: was "Drafting against 2 proven videos".
    // Both halves of that string were unearned on a TOPICAL batch — see the test below for the
    // measurement. The claim this test exists to make (the rail describes the rows with the same
    // warrant the cards get) is unchanged and still pinned.
    expect(evidence.headline).toBe("Reading 2 real videos matched to this subject");
    expect(evidence.items).toHaveLength(2);
    expect(evidence.items[0]).toMatchObject({
      kind: "video",
      label: "maker",
      metric: "12× vs followers",
      href: "https://tiktok.com/@maker/video/1",
    });
  });

  it("says what a STRUCTURAL batch actually is — proven shape, not proof about the topic", async () => {
    // hooks ranks structurally, so its rows are borrowed from other subjects. A creator who reads
    // "2 videos on my topic" there has been misled by the wait rather than by the cards.
    const onEvidence = vi.fn();
    await gatherCorpusForRun(
      { ...baseInput(), skill: "hooks", onEvidence },
      { retrieve: hit, gather: vi.fn<Gather>() },
    );
    expect(onEvidence.mock.calls[0]![0].headline).toBe(
      "Reading shape from 2 proven videos",
    );
  });

  /**
   * A TOPICAL batch may not be called "proven", and may not be described with an output verb.
   * Both defects lived in one string — "Drafting against N proven videos" — on the path ~95% of
   * real asks take.
   *
   * 1. "proven" — a topical row earns its place by COSINE, at a floor of 0.5. Measured
   *    2026-08-15 (`scripts/probe-warrant-floor.ts`, 346 queries) that floor admits
   *    `asdfghjkl qwerty zxcvbn` (topSim 0.521), `the` (0.522) and `yes` (0.547); the corpus's
   *    own median similarity is ~0.45 (retrieve.ts). So the batch cannot carry a proof claim
   *    ABOUT THE SUBJECT the way a structural batch (human-curated) or a provenance batch
   *    (search-by-subject + outlier gate) can. The chat surface already knew this and says
   *    "N real videos on this", reserving "proven" for structural
   *    (corpus-references-block.tsx:87). Two surfaces describing ONE warrant with two different
   *    strengths of claim is the defect, and the weaker wording is the correct one.
   *
   * 2. "Drafting against" — an OUTPUT verb, on a callback that fires before a single card exists.
   *    That is exactly the F-4 defect fixed for the structural branch on 2026-08-13
   *    ("Borrowing" → "Reading"); the topical branch was left behind, so the more common path
   *    kept the bug that the rarer one had fixed. The module header states the rule: every verb
   *    here must describe RETRIEVAL, never the output.
   *
   * NOTE: raising the floor was measured and REJECTED as the fix (owner ruling 2026-08-15) —
   * `ok` (0.553) outscores the corpus's own `education-science` (0.541), so no floor separates
   * contentless input from the corpus's own vocabulary. The claim gets fixed, not the threshold.
   */
  it("never calls a TOPICAL batch proven, and never uses an output verb (measured 2026-08-15)", async () => {
    const onEvidence = vi.fn();
    await gatherCorpusForRun(
      { ...baseInput(), skill: "ideas", onEvidence },
      { retrieve: hit, gather: vi.fn<Gather>() },
    );
    const headline: string = onEvidence.mock.calls[0]![0].headline;

    // The unearned proof claim.
    expect(headline).not.toMatch(/proven/i);
    // Output verbs — the cards do not exist when this fires (F-4).
    expect(headline).not.toMatch(/draft|borrow|writ/i);
    // The creative-input count still stays (memory: no PIPELINE counts, input counts keep).
    expect(headline).toContain("2 real videos");
  });

  /**
   * F-4 (audit 2026-08-09): "the loading state promises grounding the cards don't deliver".
   *
   * This headline fires when the ROWS ARE RETRIEVED — before a single card exists. "Borrowing
   * shape from N proven videos" asserts a COMPLETED outcome at a moment when the outcome is
   * unknowable, and measured 2026-08-13 it is wrong most of the time: only ~4% of hook cards end
   * up carrying a proof receipt, because the model claims a madlib it did not instantiate and
   * `templateInstantiated` correctly strips the false citation (81% strip rate, replayed over 58
   * real pre-regression pairs in `.scratch/replay-madlib-guard.ts`).
   *
   * The rows are real and the retrieval is real — so the honest headline names what is TRUE at
   * that instant (the model is being shown these rows) and not what the cards will do with them.
   * The warrant distinction the test above protects is unaffected: a structural batch still reads
   * as shape, never as "videos about my topic".
   */
  it("never asserts a COMPLETED outcome — the cards do not exist yet (F-4)", async () => {
    const onEvidence = vi.fn();
    await gatherCorpusForRun(
      { ...baseInput(), skill: "hooks", onEvidence },
      { retrieve: hit, gather: vi.fn<Gather>() },
    );
    const headline: string = onEvidence.mock.calls[0]![0].headline;

    // "Borrowing" is a claim about output that has not been generated yet.
    expect(headline).not.toMatch(/borrow/i);
    // …while the creative-input count still stays (memory: no PIPELINE counts, input counts keep).
    expect(headline).toContain("2 proven videos");
  });

  it("does NOT fire when the run degraded to ungrounded", async () => {
    const empty: Retrieve = async () => ({
      examples: [],
      enough: false,
      stats: { matched: 0, good: 0, minRows: 2, minSimilarity: 0.6, rank: "topical", archetypes: 0 },
    });
    const onEvidence = vi.fn();

    await gatherCorpusForRun(
      { ...baseInput(), skill: "ideas", onEvidence },
      { retrieve: empty, gather: vi.fn<Gather>() },
    );

    expect(onEvidence).not.toHaveBeenCalled();
  });

  it("does NOT fire when grounding is gated off for the skill", async () => {
    const onEvidence = vi.fn();
    await gatherCorpusForRun(
      { ...baseInput(), enabled: false, onEvidence },
      { retrieve: hit, gather: vi.fn<Gather>() },
    );
    expect(onEvidence).not.toHaveBeenCalled();
  });

  /**
   * The corpus admits hand-curated rows that scored BELOW the outlier bar — some below 1×, i.e.
   * fewer views than the account has followers. The on-card receipt refuses to print those
   * (build-proof.ts provenMultiplier); the rail must refuse them too, or the wait boasts a number
   * the card then withholds. Views are the honest fallback: still true, claims nothing.
   */
  it("refuses a multiplier that did not clear the outlier bar, and falls back to views", async () => {
    const weak: Retrieve = async () => ({
      examples: [{ ...example("weak"), multiplier: 0.5 }],
      enough: true,
      stats: { matched: 1, good: 1, minRows: 1, minSimilarity: 0.6, rank: "topical", archetypes: 1 },
    });
    const onEvidence = vi.fn();

    await gatherCorpusForRun(
      { ...baseInput(), skill: "ideas", onEvidence },
      { retrieve: weak, gather: vi.fn<Gather>() },
    );

    expect(onEvidence.mock.calls[0]![0].items[0].metric).toBe("1M views");
  });

  /**
   * An evidence callback that throws must not take the run down with it. Grounding is an
   * enhancement to generation; SHOWING grounding is an enhancement to that — two layers away from
   * anything the creator paid for.
   */
  it("survives a throwing callback and still returns the corpus", async () => {
    const result = await gatherCorpusForRun(
      {
        ...baseInput(),
        skill: "ideas",
        onEvidence: () => {
          throw new Error("render blew up");
        },
      },
      { retrieve: hit, gather: vi.fn<Gather>() },
    );

    expect(result.grounded).toBe(true);
    expect(result.examples).toHaveLength(2);
  });
});
