import { describe, it, expect, vi } from "vitest";
import {
  encodeCursor,
  decodeCursor,
  queryFeed,
  type FeedParams,
} from "../feed-query";

// ── Chainable supabase query mock: every builder method returns the builder; awaiting
//    it resolves to { data, count, error }. ──────────────────────────────────────────
function makeBuilder(result: { data: unknown[]; count: number; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> & { then?: unknown } = {};
  for (const m of ["select", "is", "eq", "not", "in", "ilike", "gte", "or", "order", "limit"]) {
    builder[m] = vi.fn(() => builder);
  }
  // thenable so `await q` settles to the result
  (builder as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(result);
  return builder;
}

function mkRow(i: number, over: Record<string, unknown> = {}) {
  return {
    id: `0000000${i}-0000-4000-8000-000000000000`,
    platform_video_id: `v${i}`,
    video_url: `https://t/${i}`,
    description: `cap ${i}`,
    views: 100 * i,
    likes: 10 * i,
    comments: i,
    shares: i,
    duration_seconds: 12,
    posted_at: `2026-06-2${i}T00:00:00+00:00`,
    outlier_multiplier: i * 0.5,
    baseline_label: "vs own",
    engagement_rate: 0.1 * i,
    creator_handle: "zachking",
    primary_niche: null,
    metadata: { cover_url: `c${i}` },
    ...over,
  };
}

const baseParams = (over: Partial<FeedParams> = {}): FeedParams => ({
  tab: "watched",
  sort: "recent",
  limit: 2,
  cursor: null,
  filters: { platform: "tiktok" },
  ...over,
});

describe("cursor encode/decode", () => {
  it("round-trips a numeric cursor", () => {
    const c = { v: 12.5, id: "00000001-0000-4000-8000-000000000000" };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });

  it("round-trips a timestamp cursor", () => {
    const c = { v: "2026-06-21T00:00:00+00:00", id: "00000001-0000-4000-8000-000000000000" };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });

  it("rejects a non-UUID id and an injection-shaped value", () => {
    expect(decodeCursor(encodeCursor({ v: 1, id: "not-a-uuid" }))).toBeNull();
    const evil = Buffer.from(
      JSON.stringify({ v: "1,or,true)(", id: "00000001-0000-4000-8000-000000000000" }),
    ).toString("base64url");
    expect(decodeCursor(evil)).toBeNull();
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor("@@notbase64@@")).toBeNull();
  });
});

describe("queryFeed", () => {
  it("maps rows to tiles, paginates (limit+1 → nextCursor), filters watched by handle", async () => {
    const builder = makeBuilder({ data: [mkRow(1), mkRow(2), mkRow(3)], count: 9, error: null });
    const supabase = { from: vi.fn(() => builder) } as never;

    const page = await queryFeed(supabase, baseParams(), ["zachking"]);

    expect(page.tiles).toHaveLength(2); // sliced from the limit+1 fetch
    expect(page.total).toBe(9);
    expect(page.tiles[0]).toMatchObject({
      platformVideoId: "v1",
      multiplier: 0.5,
      baselineLabel: "vs own",
      source: "@zachking",
      trackable: true,
      trackHandle: "zachking",
      coverUrl: "c1",
      saves: 0,
    });

    // nextCursor points at the last RETURNED row (row 2), not the lookahead row 3
    expect(decodeCursor(page.nextCursor)).toEqual({
      v: "2026-06-22T00:00:00+00:00",
      id: "00000002-0000-4000-8000-000000000000",
    });

    // watched tab constrains by the tracked handles; sort column forced NOT NULL
    expect(builder.in).toHaveBeenCalledWith("creator_handle", ["zachking"]);
    expect(builder.not).toHaveBeenCalledWith("posted_at", "is", null);
  });

  it("no lookahead row → no nextCursor; applies keyword + min filters", async () => {
    const builder = makeBuilder({ data: [mkRow(1)], count: 1, error: null });
    const supabase = { from: vi.fn(() => builder) } as never;

    const page = await queryFeed(
      supabase,
      baseParams({
        tab: "trending",
        sort: "outlier",
        filters: { platform: "tiktok", q: "morning", minViews: 1000, minOutlier: 3 },
      }),
      null,
    );

    expect(page.nextCursor).toBeNull();
    expect(page.tiles).toHaveLength(1);
    expect(builder.ilike).toHaveBeenCalledWith("description", "%morning%");
    expect(builder.gte).toHaveBeenCalledWith("views", 1000);
    expect(builder.gte).toHaveBeenCalledWith("outlier_multiplier", 3);
    expect(builder.not).toHaveBeenCalledWith("outlier_multiplier", "is", null);
  });
});
