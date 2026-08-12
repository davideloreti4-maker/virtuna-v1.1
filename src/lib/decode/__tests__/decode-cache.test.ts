import { describe, expect, it, vi } from "vitest";
import { getCachedDecode, storeDecode } from "@/lib/decode/decode-cache";

const decode = {
  hookPattern: "h",
  structure: "s",
  theTurn: "t",
  emotionalBeat: "e",
  spokenHook: "So I made a huge mistake",
  source: "transcript" as const,
};

const video = {
  platformVideoId: "123",
  videoUrl: "https://tiktok.com/@a/video/123",
  caption: "c",
  views: 1893,
  likes: 118,
  durationSeconds: 19,
  coverUrl: "https://cdn/cover.jpg",
  author: { handle: "a", fans: 1321, heart: 15400, videoCount: 122 },
};

const baseline = {
  basis: "lifetime-avg-likes" as const,
  value: 126.2,
  label: "vs their lifetime average",
};

function fakeClient(existing: unknown[] = [], upsertResult: unknown = { error: null }) {
  const upsert = vi.fn().mockResolvedValue(upsertResult);
  return {
    upsert,
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: existing[0] ?? null, error: null }) }),
      }),
      upsert,
    }),
  };
}

describe("getCachedDecode", () => {
  it("returns a stored decode so a video is never decoded twice", async () => {
    const c = fakeClient([
      {
        hook_template: "h",
        teardown: { structure: "s", theTurn: "t", emotionalBeat: "e" },
        spoken_hook: "x",
        hook_source: "native_transcript",
      },
    ]);
    const out = await getCachedDecode("123", { client: c as never });
    expect(out?.hookPattern).toBe("h");
    expect(out?.structure).toBe("s");
    expect(out?.source).toBe("transcript");
  });

  it("reports a caption-only row honestly, so a re-read cannot upgrade its provenance", async () => {
    const c = fakeClient([
      {
        hook_template: "h",
        teardown: { structure: "s", theTurn: "t", emotionalBeat: "e" },
        spoken_hook: null,
        hook_source: "caption_fallback",
      },
    ]);
    const out = await getCachedDecode("123", { client: c as never });
    expect(out?.source).toBe("caption-only");
    expect(out?.spokenHook).toBeNull();
  });

  it("returns null on a miss", async () => {
    const out = await getCachedDecode("nope", { client: fakeClient() as never });
    expect(out).toBeNull();
  });

  it("returns null on a metadata-only corpus row that carries no decode", async () => {
    const c = fakeClient([{ hook_template: null, teardown: null, spoken_hook: null }]);
    const out = await getCachedDecode("123", { client: c as never });
    expect(out).toBeNull();
  });
});


/**
 * storeDecode no longer hand-rolls its own upsert — it delegates to `upsertOutlierTeardown`, which
 * owns the (platform, platform_video_id) conflict target and the durable-cover rehost. What stays
 * this module's responsibility is the ROW it hands over, and two fields on it are constrained by
 * CHECKs that reject silently (supabase-js returns `{error}`, it does not throw):
 *
 *   CHECK (source_pool IN ('curated','competitor','scraped','expanded'))
 *   CHECK (status      IN ('metadata','extracted','watched','failed'))
 *
 * The ≥3× warrant gate, the embedding, and the niche facet are covered in decode-cache-warrant.test.ts.
 */
describe("storeDecode — the row handed to the canonical writer", () => {
  const outlier = { ...video, views: 30_000, author: { ...video.author, fans: 2_000 } };

  function spyDeps() {
    const upsertOutlier = vi.fn().mockResolvedValue("row-id");
    return {
      upsertOutlier,
      deps: {
        client: {} as never,
        upsertOutlier,
        embedTextsFn: async () => [new Array(768).fill(0)],
      },
    };
  }

  it("names a source_pool and status the table's CHECK constraints accept", async () => {
    const { upsertOutlier, deps } = spyDeps();
    await storeDecode(outlier, decode, baseline, deps);
    const row = upsertOutlier.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(row.sourcePool).toBe("scraped");
    expect(row.status).toBe("extracted");
  });

  it("carries the identity, the decode and its provenance", async () => {
    const { upsertOutlier, deps } = spyDeps();
    await storeDecode(outlier, decode, baseline, deps);
    const row = upsertOutlier.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(row.platformVideoId).toBe("123");
    expect(row.creatorHandle).toBe("a");
    expect(row.spokenHook).toBe("So I made a huge mistake");
    expect(row.hookSource).toBe("native_transcript");
  });

  it("stores the basis label alongside the multiplier, never a bare number", async () => {
    const { upsertOutlier, deps } = spyDeps();
    await storeDecode(outlier, decode, baseline, deps);
    const row = upsertOutlier.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(typeof row.outlierMultiplier).toBe("number");
    expect(row.baselineLabel).toBeTruthy();
  });

  it("never throws, and LOGS rather than swallowing a failed write", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { deps } = spyDeps();
    deps.upsertOutlier = vi.fn().mockRejectedValue(new Error("violates check constraint"));
    await expect(storeDecode(outlier, decode, baseline, deps)).resolves.toBeUndefined();
    // A silently-dropped failure is how a write-back cache reads as working while storing nothing.
    // Assert on the Error itself — JSON.stringify flattens an Error to {} and would pass vacuously.
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("[decode-cache]"),
      expect.objectContaining({ message: "violates check constraint" }),
    );
    warn.mockRestore();
  });
});
