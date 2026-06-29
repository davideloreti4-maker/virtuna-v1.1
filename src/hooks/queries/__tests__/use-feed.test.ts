/**
 * Tests for buildFeedQuery — the /api/feed query-string serializer behind useFeed
 * (Discover Feed Phase 2.2). Pure function: tab/sort always present, the keyset cursor
 * and each filter included only when meaningful, undefined/empty values omitted.
 */
import { describe, it, expect } from "vitest";
import { buildFeedQuery, type UseFeedArgs } from "@/hooks/queries/use-feed";

const base: UseFeedArgs = { tab: "watched", sort: "outlier", filters: {} };

/** Parse the built query string back into a flat record for assertions. */
function parse(qs: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(qs));
}

describe("buildFeedQuery", () => {
  it("always serializes tab + sort, nothing else when filters are empty", () => {
    expect(parse(buildFeedQuery(base))).toEqual({ tab: "watched", sort: "outlier" });
  });

  it("appends the keyset cursor when provided", () => {
    const p = parse(buildFeedQuery(base, "CURSOR123"));
    expect(p.cursor).toBe("CURSOR123");
  });

  it("omits the cursor param when absent", () => {
    expect(parse(buildFeedQuery(base)).cursor).toBeUndefined();
  });

  it("trims the keyword and drops a blank one", () => {
    expect(parse(buildFeedQuery({ ...base, filters: { q: "  viral  " } })).q).toBe("viral");
    expect(parse(buildFeedQuery({ ...base, filters: { q: "   " } })).q).toBeUndefined();
  });

  it("serializes numeric filters, including fractional engagement", () => {
    const p = parse(
      buildFeedQuery({
        ...base,
        filters: { minOutlier: 3, minViews: 1_000_000, minEngagement: 0.05, postedWithinDays: 30 },
      }),
    );
    expect(p).toMatchObject({
      minOutlier: "3",
      minViews: "1000000",
      minEngagement: "0.05",
      postedWithinDays: "30",
    });
  });

  it("joins channels with commas and omits an empty list", () => {
    expect(
      parse(buildFeedQuery({ ...base, filters: { channels: ["zachking", "khaby.lame"] } })).channels,
    ).toBe("zachking,khaby.lame");
    expect(parse(buildFeedQuery({ ...base, filters: { channels: [] } })).channels).toBeUndefined();
  });

  it("carries the trending tab + views sort verbatim", () => {
    const p = parse(buildFeedQuery({ tab: "trending", sort: "views", filters: {} }));
    expect(p).toEqual({ tab: "trending", sort: "views" });
  });
});
