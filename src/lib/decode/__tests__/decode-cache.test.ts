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

describe("storeDecode", () => {
  it("writes a source_pool the table's CHECK constraint actually accepts", async () => {
    const c = fakeClient();
    await storeDecode(video, decode, baseline, { client: c as never });
    const row = c.upsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(row.platform_video_id).toBe("123");
    expect(row.creator_handle).toBe("a");
    // CHECK (source_pool IN ('curated','competitor','scraped','expanded')) — "live-scrape"
    // would be rejected by Postgres, and the rejection arrives as {error}, not a throw.
    expect(row.source_pool).toBe("scraped");
    expect(row.spoken_hook).toBe("So I made a huge mistake");
  });

  it("writes a status the table's CHECK constraint accepts", async () => {
    const c = fakeClient();
    await storeDecode(video, decode, baseline, { client: c as never });
    const row = c.upsert.mock.calls[0]?.[0] as Record<string, unknown>;
    // CHECK (status IN ('metadata','extracted','watched','failed')).
    expect(row.status).toBe("extracted");
  });

  it("records the decode's provenance in hook_source", async () => {
    const c = fakeClient();
    await storeDecode(video, decode, baseline, { client: c as never });
    expect((c.upsert.mock.calls[0]?.[0] as Record<string, unknown>).hook_source).toBe(
      "native_transcript",
    );

    const c2 = fakeClient();
    await storeDecode(
      video,
      { ...decode, spokenHook: null, source: "caption-only" },
      baseline,
      { client: c2 as never },
    );
    expect((c2.upsert.mock.calls[0]?.[0] as Record<string, unknown>).hook_source).toBe(
      "caption_fallback",
    );
  });

  it("stores the basis label alongside the multiplier, never a bare number", async () => {
    const c = fakeClient();
    await storeDecode(video, decode, baseline, { client: c as never });
    const row = c.upsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(row.baseline_label).toBe("vs their lifetime average");
    expect(typeof row.outlier_multiplier).toBe("number");
  });

  it("upserts on the composite key the unique index is actually built on", async () => {
    const c = fakeClient();
    await storeDecode(video, decode, baseline, { client: c as never });
    // The only unique index is (platform, platform_video_id). onConflict:"platform_video_id"
    // alone raises 42P10 — "no unique or exclusion constraint matching the ON CONFLICT spec".
    expect(c.upsert.mock.calls[0]?.[1]).toMatchObject({
      onConflict: "platform,platform_video_id",
    });
  });

  it("never throws — a cache write must not fail the creator's request", async () => {
    const c = { from: () => { throw new Error("db down"); } };
    await expect(storeDecode(video, decode, baseline, { client: c as never })).resolves.toBeUndefined();
  });

  it("SURFACES a returned Supabase error instead of discarding it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const c = fakeClient([], { error: { message: "violates check constraint" } });
    await storeDecode(video, decode, baseline, { client: c as never });
    // Supabase returns errors, it does not throw them. A silently-dropped {error} is how a
    // write-back cache reads as working while never storing a single row.
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).toContain("violates check constraint");
    warn.mockRestore();
  });
});
