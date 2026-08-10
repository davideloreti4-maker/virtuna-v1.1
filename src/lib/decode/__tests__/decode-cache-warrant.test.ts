/**
 * The write-back's WARRANT — what earns a live-scraped row its place in the shared corpus.
 *
 * `outlier_teardowns` holds two pools that are admitted on different grounds (retrieve.ts §warrant):
 * curated rows were hand-picked by a human, so curation IS the warrant; SCRAPED rows have nobody in
 * the loop, so the METRIC is the only thing separating a lesson from a random video — and the ≥3×
 * gate is applied at WRITE time by the orchestrator.
 *
 * The first cut of storeDecode ignored all of that: it wrote every decoded video (a 0.298× post —
 * one that UNDERPERFORMED its own creator — landed in the pool during live verification), stored no
 * embedding (making the row unreachable, since retrieval is cosine over the subject embedding), and
 * persisted the ephemeral TikTok cover URL as though it were stable.
 */
import { describe, expect, it, vi } from "vitest";
import { storeDecode } from "@/lib/decode/decode-cache";
import { MIN_OUTLIER_MULTIPLIER } from "@/lib/grounding/outlier-gate";

const decode = {
  hookPattern: "h",
  structure: "s",
  theTurn: "t",
  emotionalBeat: "e",
  spokenHook: "So I made a huge mistake",
  source: "transcript" as const,
};

const baseline = {
  basis: "lifetime-avg-likes" as const,
  value: 126.2,
  label: "vs their lifetime average",
};

/** views ÷ fans = 30000/2000 = 15× — comfortably over the ≥3× bar. */
const outlier = {
  platformVideoId: "123",
  videoUrl: "https://tiktok.com/@a/video/123",
  caption: "founder lessons",
  views: 30_000,
  likes: 118,
  hashtags: ["startup", "founder"],
  coverUrl: "https://p16-sign.tiktokcdn.com/expiring-cover.jpg",
  author: { handle: "a", fans: 2_000, heart: 15_400, videoCount: 122 },
};

/** views ÷ fans = 600/2000 = 0.3× — the video underperformed its own account. */
const dud = { ...outlier, platformVideoId: "456", views: 600 };

function deps() {
  const upsertOutlier = vi.fn().mockResolvedValue("row-id");
  const embedTextsFn = vi.fn().mockResolvedValue([new Array(768).fill(0.01)]);
  return {
    d: { client: {} as never, upsertOutlier, embedTextsFn },
    upsertOutlier,
    embedTextsFn,
  };
}

describe("storeDecode — the ≥3× warrant gate", () => {
  it("writes a row that clears the bar on views ÷ followers", async () => {
    const { d, upsertOutlier } = deps();
    await storeDecode(outlier, decode, baseline, d);
    expect(upsertOutlier).toHaveBeenCalledTimes(1);
    const row = upsertOutlier.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(row.outlierMultiplier).toBe(15);
    // The POOL's basis, not the live tile's — a scraped row is cited as "vs followers".
    expect(row.baselineLabel).toBe("vs followers");
    expect(row.sourcePool).toBe("scraped");
  });

  it("REFUSES a video that underperformed its own account", async () => {
    const { d, upsertOutlier } = deps();
    await storeDecode(dud, decode, baseline, d);
    // 0.3× has no warrant. Writing it would put an unvouched dud in a shared corpus that
    // other surfaces cite as proof.
    expect(upsertOutlier).not.toHaveBeenCalled();
  });

  it("refuses anything under the locked bar, exactly at the boundary", async () => {
    const { d, upsertOutlier } = deps();
    const fans = outlier.author.fans;
    await storeDecode({ ...outlier, views: fans * MIN_OUTLIER_MULTIPLIER }, decode, baseline, d);
    expect(upsertOutlier).toHaveBeenCalledTimes(1);

    const second = deps();
    await storeDecode(
      { ...outlier, views: fans * MIN_OUTLIER_MULTIPLIER - 1 },
      decode,
      baseline,
      second.d,
    );
    expect(second.upsertOutlier).not.toHaveBeenCalled();
  });

  it("admits a row whose follower count is unknown, since no gate is computable", async () => {
    const { d, upsertOutlier } = deps();
    await storeDecode({ ...outlier, author: undefined }, decode, baseline, d);
    // Mirrors the orchestrator's `!g.durable || passesOutlierGate(...)`: absent metric admits.
    expect(upsertOutlier).toHaveBeenCalledTimes(1);
    const row = upsertOutlier.mock.calls[0]?.[1] as Record<string, unknown>;
    // …but it falls back to the per-author basis and NEVER wears the "vs followers" label.
    expect(row.baselineLabel).toBe("vs their lifetime average");
  });
});

describe("storeDecode — reachability", () => {
  it("embeds the row, or it can never be retrieved", async () => {
    const { d, upsertOutlier, embedTextsFn } = deps();
    await storeDecode(outlier, decode, baseline, d);
    // Retrieval is cosine over this vector. A null embedding is a row nothing can find.
    const row = upsertOutlier.mock.calls[0]?.[1] as { embedding?: number[] };
    expect(row.embedding).toHaveLength(768);
    // The §13 formula's segments must actually reach the embedder.
    const text = embedTextsFn.mock.calls[0]?.[0]?.[0] as string;
    expect(text).toContain("founder lessons");
    expect(text).toContain("#startup");
    expect(text).toContain("So I made a huge mistake");
  });

  it("still writes the row when embedding fails — an enhancement, never a gate", async () => {
    const { d, upsertOutlier } = deps();
    d.embedTextsFn = vi.fn().mockRejectedValue(new Error("dashscope 500"));
    await storeDecode(outlier, decode, baseline, d);
    expect(upsertOutlier).toHaveBeenCalledTimes(1);
    const row = upsertOutlier.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(row.embedding).toBeNull();
  });

  it("carries the niche facet when the caller knows which query sourced the video", async () => {
    const { d, upsertOutlier } = deps();
    await storeDecode(outlier, decode, baseline, { ...d, niche: "business" });
    expect((upsertOutlier.mock.calls[0]?.[1] as Record<string, unknown>).niche).toBe("business");
  });
});

describe("storeDecode — contract preserved", () => {
  it("never throws when the canonical writer throws", async () => {
    const { d } = deps();
    d.upsertOutlier = vi.fn().mockRejectedValue(new Error("db down"));
    await expect(storeDecode(outlier, decode, baseline, d)).resolves.toBeUndefined();
  });

  it("hands the ephemeral cover to the canonical writer, which rehosts it", async () => {
    const { d, upsertOutlier } = deps();
    await storeDecode(outlier, decode, baseline, d);
    const row = upsertOutlier.mock.calls[0]?.[1] as Record<string, unknown>;
    // storeDecode must NOT persist the signed TikTok URL itself — upsertOutlierTeardown's
    // durableCover() owns that, and going around it stored a URL that expires.
    expect(row.coverUrl).toBe(outlier.coverUrl);
    expect(upsertOutlier).toHaveBeenCalledTimes(1);
  });

  it("still records the decode and its provenance", async () => {
    const { d, upsertOutlier } = deps();
    await storeDecode(outlier, decode, baseline, d);
    const row = upsertOutlier.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(row.hookTemplate).toBe("h");
    expect(row.hookSource).toBe("native_transcript");
    expect(row.spokenHook).toBe("So I made a huge mistake");
    expect(row.teardown).toMatchObject({ structure: "s", theTurn: "t", emotionalBeat: "e" });
  });
});
