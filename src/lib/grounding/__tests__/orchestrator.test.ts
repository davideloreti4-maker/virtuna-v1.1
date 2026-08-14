import { describe, it, expect, vi } from "vitest";
import { handleFromUrl, toRetrievedExample, gatherAndExtract } from "../orchestrator";
import type { ScrapingProvider, VideoData } from "@/lib/scraping/types";
import type { RunEvidence } from "@/lib/tools/evidence";
import type { RankedOutlier } from "@/lib/discover/outlier-compute";
import type { Teardown } from "../types";

describe("handleFromUrl", () => {
  it("parses a bare lowercased handle from a TikTok url", () => {
    expect(handleFromUrl("https://www.tiktok.com/@SreneStrawberry/video/123")).toBe("srenestrawberry");
    expect(handleFromUrl("https://tiktok.com/@a.b_c/video/9")).toBe("a.b_c");
  });
  it("returns null when no handle is present", () => {
    expect(handleFromUrl("https://tiktok.com/video/1")).toBeNull();
    expect(handleFromUrl(null)).toBeNull();
    expect(handleFromUrl(undefined)).toBeNull();
  });
});

const ranked = (): RankedOutlier => ({
  platformVideoId: "123",
  videoUrl: "https://tiktok.com/@srenestrawberry/video/123",
  coverUrl: "https://cdn.tiktok/cover-123.jpg",
  caption: "cottage cheese eggs",
  views: 14_700_000,
  likes: 100,
  comments: 10,
  shares: 5,
  saves: 2,
  hashtags: ["highprotein"],
  durationSeconds: 20,
  postedAt: new Date("2026-07-01T00:00:00Z"),
  multiplier: 178.3,
  baselineLabel: "vs niche",
  rankKey: 178.3,
});

const teardown = (): Teardown => ({
  spokenHook: "Stop buying protein bars.",
  hookTemplate: "Stop buying [product category].",
  hookSource: "caption_fallback",
  hookArchetype: "contrarian",
  format: "problem-solution",
  visualHook: null,
  editingStyle: null,
  signatureSeries: null,
  idea: { seed: "s", angle: "a", belief: "b", reality: "r", evidence: "e" },
  template: { name: "Myth-swap", slots: [], skeleton: ["myth", "swap"], guidance: "g" },
  whyItWorks: "pattern interrupt",
  raw: null,
});

describe("toRetrievedExample", () => {
  it("carries the durable receipt + structure + honest source metadata", () => {
    const ex = toRetrievedExample({
      teardownId: "td-1",
      platform: "tiktok",
      ranked: ranked(),
      teardown: teardown(),
      multiplier: 9.2, // durable views÷followers, distinct from the cheap 178.3×
      baselineLabel: "vs followers",
      fitLabel: "adjacent",
      sourcePool: "scraped",
      trustWeight: 0.6,
    });
    expect(ex.handle).toBe("srenestrawberry");
    expect(ex.coverUrl).toBe("https://cdn.tiktok/cover-123.jpg");
    expect(ex.hookTemplate).toBe("Stop buying [product category].");
    expect(ex.multiplier).toBe(9.2);
    expect(ex.baselineLabel).toBe("vs followers");
    expect(ex.views).toBe(14_700_000);
    expect(ex.template?.skeleton).toEqual(["myth", "swap"]);
    expect(ex.hookArchetype).toBe("contrarian");
    expect(ex.sourcePool).toBe("scraped");
    expect(ex.fromPersonal).toBe(false);
    expect(ex.fitLabel).toBe("adjacent");
  });
});

// ─── Mid-flight evidence: the paid pull stops being a blank 25 seconds ──────────────

describe("gatherAndExtract — evidence lands at the SELECTION boundary", () => {
  /** A scraped row that will survive `selectCandidates` (recent + real view count). */
  const scraped = (i: number, views: number): VideoData => ({
    platformVideoId: `v${i}`,
    videoUrl: `https://www.tiktok.com/@creator${i}/video/${i}`,
    coverUrl: `https://cdn.tiktok/cover-${i}.jpg`,
    caption: `high protein breakfast ${i}`,
    views,
    likes: Math.round(views * 0.05),
    comments: 10,
    shares: 5,
    saves: 20,
    hashtags: ["highprotein"],
    durationSeconds: 20,
    postedAt: new Date(),
  });

  /**
   * Run far enough to pass selection, then let the (un-injectable) extraction stage blow up.
   *
   * That is the POINT of the test, not a limitation of it: the whole value of this emit is that
   * it happens BEFORE the expensive half. A payload that only arrived once teardowns succeeded
   * would be worthless — the wait it exists to fill would already be over.
   */
  async function runToExtraction(onEvidence: (e: RunEvidence) => void) {
    const provider = {
      scrapeVideos: async () => [scraped(1, 14_000_000), scraped(2, 9_000_000), scraped(3, 4_000_000)],
      scrapeProfile: async () => {
        throw new Error("stop here — profile scrape is past the boundary under test");
      },
    } as unknown as ScrapingProvider;

    try {
      // supabase is resolved eagerly at the top of the function (getCorpusClient throws with no
      // env), so it must be stubbed or the run dies before the boundary under test.
      await gatherAndExtract(
        { query: "high protein breakfast", onEvidence },
        { provider, supabase: {} as never },
      );
    } catch {
      // expected: the run cannot complete without the LLM/embedding stages
    }
  }

  it("does not let a hung profile scrape hold the run — it degrades on a deadline", async () => {
    // The real failure this pins, measured 2026-08-14: clockworks profile mode stopped returning
    // anything, but it does not fail — it retries each URL ~12 times and resolves EMPTY after
    // 90-130s, while reporting SUCCEEDED. The existing catch only covers a REJECTION, so a scrape
    // that merely takes forever was unbounded, and every grounded run paid two minutes for a value
    // that could not arrive. Modelled as a promise that never settles, which is the shape that
    // slipped through before.
    vi.useFakeTimers();
    try {
      let profileCalls = 0;
      const provider = {
        scrapeVideos: async () => [scraped(1, 14_000_000), scraped(2, 9_000_000), scraped(3, 4_000_000)],
        scrapeProfile: () => {
          profileCalls++;
          return new Promise(() => {}); // never settles — neither resolve nor reject
        },
      } as unknown as ScrapingProvider;

      const run = gatherAndExtract(
        { query: "high protein breakfast" },
        { provider, supabase: {} as never },
      ).catch(() => "reached-extraction");

      // Nothing may resolve on its own; only the deadline can move this forward.
      await vi.advanceTimersByTimeAsync(30_000);
      const outcome = await run;

      expect(profileCalls, "the enrichment must still be attempted").toBeGreaterThan(0);
      // Getting past step 3 at all is the assertion: without the deadline this promise is still
      // pending here and the await above would hang until the test times out.
      expect(outcome).toBe("reached-extraction");
    } finally {
      vi.useRealTimers();
    }
  });

  it("emits the survivors before spending the profile scrapes", async () => {
    const seen: RunEvidence[] = [];
    await runToExtraction((e) => seen.push(e));

    expect(seen).toHaveLength(1);
    const [evidence] = seen;
    expect(evidence!.items.length).toBeGreaterThan(0);
    expect(evidence!.items.every((i) => i.kind === "video")).toBe(true);
    // Real covers and real handles, straight off the scrape.
    expect(evidence!.items[0]!.image).toMatch(/^https:\/\/cdn\.tiktok\/cover-/);
    expect(evidence!.items[0]!.label).toMatch(/^creator\d$/);
  });

  it("states no scrape count, and claims no multiplier it has not computed", async () => {
    const seen: RunEvidence[] = [];
    await runToExtraction((e) => seen.push(e));

    // Owner's rule: the loading UI never says how many things the pipeline pulled.
    expect(seen[0]!.headline).not.toMatch(/\d/);
    // The multiplier needs follower counts, which are fetched AFTER this point, and it has to
    // clear the outlier gate before it may be spoken at all. Views are measured now.
    for (const item of seen[0]!.items) {
      expect(item.metric).not.toMatch(/×/);
      expect(item.metric).toMatch(/views$/);
    }
  });

  it("is inert when no listener is passed (byte-identical to the pre-evidence path)", async () => {
    const provider = {
      scrapeVideos: async () => [scraped(1, 14_000_000)],
      scrapeProfile: async () => {
        throw new Error("stop");
      },
    } as unknown as ScrapingProvider;
    // No onEvidence, no throw from the emit block.
    await expect(
      gatherAndExtract({ query: "q" }, { provider, supabase: {} as never }).catch(
        () => "reached extraction",
      ),
    ).resolves.toBe("reached extraction");
  });
});
