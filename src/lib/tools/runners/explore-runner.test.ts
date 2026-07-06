/**
 * explore-runner.test.ts — runExplorePipeline unit tests (Task 1, plan 11-04).
 *
 * Tests (EXPLORE-03 / D-01 / D-02 / D-03 / Pitfall 4 / Pitfall 6):
 *   - calibrated audience + mocked provider → block validates against
 *     OutlierGridBlockSchema and every tile has fit.level in {Strong,Fair,Weak}
 *   - General audience → every tile has fit:null (degrade flows through)
 *   - mode "profile" → every tile trackable:true + trackHandle = normalized input
 *     (no '@', lowercased)
 *   - mode "niche" → every tile trackable:false + trackHandle undefined
 *   - the built block .props.mode echoes the requested mode
 *   - the runner makes ZERO SIM/Flash/engine-scoring calls (only the provider scrape)
 *   - the scrape uses the Discover SCRAPE_LIMIT band (30) and the runner caps tiles
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { OutlierGridBlockSchema } from "@/lib/tools/blocks";
import type { Audience, CalibratedPersona } from "@/lib/audience/audience-types";
import type { VideoData } from "@/lib/scraping/types";

// ─── Mock the scraping provider (the only network the runner does) ──────────────
const mockScrapeVideos = vi.fn();
vi.mock("@/lib/scraping", () => ({
  createScrapingProvider: () => ({
    scrapeVideos: (...args: unknown[]) => mockScrapeVideos(...args),
  }),
}));

// Import AFTER the mock so the runner's createScrapingProvider() is the stub.
import { runExplorePipeline } from "@/lib/tools/runners/explore-runner";

// ─── Fixtures ───────────────────────────────────────────────────────────────────

/** Build a VideoData with sane defaults; postedAt is "now" so it stays in-window. */
function makeVideo(overrides: Partial<VideoData> = {}): VideoData {
  return {
    platformVideoId: `vid_${Math.random().toString(36).slice(2, 8)}`,
    videoUrl: "https://www.tiktok.com/@creator/video/123",
    caption: "fitness home workout no equipment",
    views: 100_000,
    likes: 8_000,
    comments: 400,
    shares: 600,
    saves: 1_200,
    hashtags: ["fitness", "homeworkout"],
    durationSeconds: 22,
    postedAt: new Date(), // in-window (recent)
    ...overrides,
  };
}

/** A small set of recent videos with varied engagement → varied fit levels. */
function makeVideos(): VideoData[] {
  return [
    makeVideo({ platformVideoId: "a", views: 500_000, saves: 50, shares: 40 }),
    makeVideo({
      platformVideoId: "b",
      views: 80_000,
      saves: 9_000,
      shares: 5_000,
      caption: "cooking pasta recipe quick dinner",
      hashtags: ["cooking", "recipe"],
    }),
    makeVideo({ platformVideoId: "c", views: 120_000, saves: 1_500, shares: 900 }),
  ];
}

function makePersonas(): CalibratedPersona[] {
  return [
    { archetype: "high_engager", repaint: "", temperature: "cold", disposition: "scanner", share: 0.4 },
    { archetype: "niche_deep_scout", repaint: "", temperature: "warm", disposition: "collector", share: 0.4 },
    { archetype: "loyalist", repaint: "", temperature: "hot", disposition: "connector", share: 0.2 },
  ];
}

/** A calibrated (non-general, non-preset, non-thin, with personas) audience. */
function makeCalibratedAudience(): Audience {
  return {
    id: "aud_1",
    user_id: "u_1",
    name: "fitness creators",
    type: "target",
    platform: "tiktok",
    goal_label: "home workout fitness",
    goal_intent: "grow",
    is_general: false,
    mode: "socials",
    is_preset: false,
    persona_weights: { fyp: 0.5, niche: 0.3, loyalist: 0.15, cross_niche: 0.05 },
    personas: makePersonas(),
    profile: {
      temperature_mix: { cold: 0.4, warm: 0.4, hot: 0.2 },
      top_dispositions: ["scanner", "collector", "connector"],
      follower_tier: "mid",
    },
    calibration: { source: "scrape", handle: "fitcreator", thin: false },
    created_at: "1970-01-01T00:00:00Z",
    updated_at: "1970-01-01T00:00:00Z",
  };
}

/** The General virtual audience (degrade gate → fit:null). */
function makeGeneralAudience(): Audience {
  return {
    id: "general",
    user_id: "__virtual__",
    name: "General",
    type: "target",
    platform: "tiktok",
    goal_label: null,
    goal_intent: null,
    is_general: true,
    mode: "general",
    is_preset: false,
    persona_weights: { fyp: 0.65, niche: 0.2, loyalist: 0.1, cross_niche: 0.05 },
    personas: [],
    profile: null,
    calibration: null,
    created_at: "1970-01-01T00:00:00Z",
    updated_at: "1970-01-01T00:00:00Z",
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("runExplorePipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScrapeVideos.mockResolvedValue(makeVideos());
  });

  it("builds a schema-valid outlier-grid block with a fit level on every tile (calibrated audience)", async () => {
    const { block } = await runExplorePipeline({
      audience: makeCalibratedAudience(),
      mode: "niche",
      normalizedInput: "fitness",
      serendipity: 0,
    });

    // D-14 belt-and-suspenders: the runner-built block must satisfy the schema.
    const parsed = OutlierGridBlockSchema.safeParse(block);
    expect(parsed.success).toBe(true);

    expect(block.type).toBe("outlier-grid");
    expect(block.props.tiles.length).toBeGreaterThan(0);
    for (const tile of block.props.tiles) {
      expect(tile.fit).not.toBeNull();
      expect(["Strong", "Fair", "Weak"]).toContain(tile.fit!.level);
    }
  });

  it("degrades to fit:null on every tile for a General audience", async () => {
    const { block } = await runExplorePipeline({
      audience: makeGeneralAudience(),
      mode: "niche",
      normalizedInput: "fitness",
      serendipity: 0,
    });

    expect(OutlierGridBlockSchema.safeParse(block).success).toBe(true);
    expect(block.props.tiles.length).toBeGreaterThan(0);
    for (const tile of block.props.tiles) {
      expect(tile.fit).toBeNull();
    }
  });

  it("marks profile-mode tiles trackable:true with the normalized handle (no @, lowercased)", async () => {
    const { block } = await runExplorePipeline({
      audience: makeCalibratedAudience(),
      mode: "profile",
      normalizedInput: "@FitCreator",
      serendipity: 0,
    });

    expect(block.props.mode).toBe("profile");
    for (const tile of block.props.tiles) {
      expect(tile.trackable).toBe(true);
      expect(tile.trackHandle).toBe("fitcreator");
    }
  });

  it("marks niche-mode tiles trackable:false with no trackHandle (RESEARCH Q3)", async () => {
    const { block } = await runExplorePipeline({
      audience: makeCalibratedAudience(),
      mode: "niche",
      normalizedInput: "fitness",
      serendipity: 0,
    });

    expect(block.props.mode).toBe("niche");
    for (const tile of block.props.tiles) {
      expect(tile.trackable).toBe(false);
      expect(tile.trackHandle).toBeUndefined();
    }
  });

  it("pulls via the provider with the Discover scrape budget (30) and makes no other network call", async () => {
    await runExplorePipeline({
      audience: makeCalibratedAudience(),
      mode: "niche",
      normalizedInput: "fitness",
      serendipity: 0,
    });

    expect(mockScrapeVideos).toHaveBeenCalledTimes(1);
    // niche mode → clockworks search input (searchQueries), not a profile lookup.
    expect(mockScrapeVideos).toHaveBeenCalledWith("fitness", 30, "search");
  });

  // ── CR-02: the merged "What competitors shipped" multi-handle pull ───────────────

  it("scrapes EACH tracked handle and merges them into one ranked block (CR-02)", async () => {
    // Distinct videos per handle so the merge is observable.
    mockScrapeVideos.mockImplementation((handle: string) =>
      Promise.resolve([
        makeVideo({ platformVideoId: `${handle}_a`, views: 200_000 }),
        makeVideo({ platformVideoId: `${handle}_b`, views: 90_000 }),
      ]),
    );

    const { block } = await runExplorePipeline({
      audience: makeCalibratedAudience(),
      mode: "profile",
      normalizedInput: "creatorone",
      serendipity: 0,
      mergeInputs: ["creatorone", "creatortwo", "creatorthree"],
    });

    // One scrape per handle (3), and the merged grid carries tiles from all of them.
    // Merged competitors pull = handles → profile mode.
    expect(mockScrapeVideos).toHaveBeenCalledTimes(3);
    expect(mockScrapeVideos).toHaveBeenCalledWith("creatorone", 30, "profile");
    expect(mockScrapeVideos).toHaveBeenCalledWith("creatortwo", 30, "profile");
    expect(mockScrapeVideos).toHaveBeenCalledWith("creatorthree", 30, "profile");

    expect(OutlierGridBlockSchema.safeParse(block).success).toBe(true);
    const ids = block.props.tiles.map((t) => t.platformVideoId);
    expect(ids).toContain("creatorone_a");
    expect(ids).toContain("creatortwo_a");
    expect(ids).toContain("creatorthree_a");
  });

  it("merged competitors tiles are NOT individually trackable (no per-tile author — CR-02/Q3)", async () => {
    mockScrapeVideos.mockImplementation((handle: string) =>
      Promise.resolve([makeVideo({ platformVideoId: `${handle}_a` })]),
    );

    const { block } = await runExplorePipeline({
      audience: makeCalibratedAudience(),
      mode: "profile",
      normalizedInput: "creatorone",
      serendipity: 0,
      mergeInputs: ["creatorone", "creatortwo"],
    });

    for (const tile of block.props.tiles) {
      expect(tile.trackable).toBe(false);
      expect(tile.trackHandle).toBeUndefined();
    }
  });

  it("a SINGLE-handle mergeInputs keeps normal profile trackability (CR-02 edge)", async () => {
    mockScrapeVideos.mockResolvedValue([makeVideo({ platformVideoId: "x" })]);

    const { block } = await runExplorePipeline({
      audience: makeCalibratedAudience(),
      mode: "profile",
      normalizedInput: "@SoloCreator",
      serendipity: 0,
      mergeInputs: ["solocreator"],
    });

    expect(mockScrapeVideos).toHaveBeenCalledTimes(1);
    for (const tile of block.props.tiles) {
      expect(tile.trackable).toBe(true);
      expect(tile.trackHandle).toBe("solocreator");
    }
  });

  it("dedupes a video that surfaces under two tracked handles (CR-02 — no double-count)", async () => {
    // Both handles return the SAME video id "dup" → it must appear once.
    mockScrapeVideos.mockImplementation((handle: string) =>
      Promise.resolve([
        makeVideo({ platformVideoId: "dup", views: 150_000 }),
        makeVideo({ platformVideoId: `${handle}_unique` }),
      ]),
    );

    const { block } = await runExplorePipeline({
      audience: makeCalibratedAudience(),
      mode: "profile",
      normalizedInput: "h1",
      serendipity: 0,
      mergeInputs: ["h1", "h2"],
    });

    const dupCount = block.props.tiles.filter((t) => t.platformVideoId === "dup").length;
    expect(dupCount).toBe(1);
  });

  it("does not import or call any engine SIM/Flash scoring (D-02/D-03 — pure grid)", async () => {
    // Statically assert the runner source carries no engine-scoring imports/calls.
    // (Belt-and-suspenders alongside the verification grep; keeps the honesty spine
    // locked by a test, not just a manual check.) Strip comments first so the
    // honesty-constraint PROSE in the file header (which legitimately names these
    // tokens to forbid them) does not trip the matcher — we test real code, not docs.
    const fs = await import("node:fs");
    const path = await import("node:path");
    const raw = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/tools/runners/explore-runner.ts"),
      "utf8",
    );
    const code = raw
      .replace(/\/\*[\s\S]*?\*\//g, "") // strip block comments
      .replace(/\/\/.*$/gm, ""); // strip line comments

    // No engine-scoring CALLS in real code.
    expect(code).not.toMatch(/runPredictionPipeline|aggregateScores|runFlash|runWave3|ENGINE_VERSION/);
    // No import from the engine scoring surface at all (only the provider scrape + pure math).
    expect(code).not.toMatch(/from\s+["']@\/lib\/engine/);
  });
});
