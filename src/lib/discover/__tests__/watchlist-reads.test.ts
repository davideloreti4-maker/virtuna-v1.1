/** @vitest-environment node */
/**
 * The Watchlist read (`getWatchlistData`): one list of followed creators out of two stores
 * (`tracked_accounts` and `user_competitors` → `competitor_profiles`).
 *
 * The new Discover adds four fields to a row: the records Remove clears (`trackedIds`,
 * `competitorId`), up to three covers Maven stores (`covers`) and the count of measured videos at 3×
 * or more (`provenCount`); and one to the whole read, `incomplete`, when an ownership read failed.
 * The old Discover still renders every other field, so the first block pins today's fields on one
 * fixture, written from the code before the new fields.
 *
 * The two Supabase clients are the boundary and are stood in: the caller's (RLS-scoped) client is
 * passed in, the service client comes from `createServiceClient`. Each stand-in records its calls and
 * answers with the rows a table holds, or with an error for a table named as failing; the rows are
 * written to satisfy the filters the read asks for.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getWatchlistData, type WatchlistSource } from "@/lib/discover/watchlist-reads";

type Rows = Record<string, unknown>[];
interface Call {
  table: string;
  method: string;
  args: unknown[];
}

/**
 * A Supabase client stand-in: `from(table)` answers with that table's rows, or with an error (and no
 * data, as supabase-js does) for a table in `failing`; every call is recorded.
 */
function standIn(tables: Record<string, Rows>, failing: readonly string[] = []) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      calls.push({ table, method: "from", args: [] });
      const result = failing.includes(table)
        ? { data: null, error: { message: `${table}: connection reset`, code: "08006" } }
        : { data: tables[table] ?? [], error: null };
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "in", "not", "or", "order", "limit", "eq"]) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return builder;
        };
      }
      builder.then = (resolve: (r: typeof result) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject);
      return builder;
    },
  };
  return { client, calls };
}

const mocks = vi.hoisted(() => ({ service: null as unknown }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => mocks.service }));

async function read(user: Record<string, Rows>, service: Record<string, Rows>, failing: readonly string[] = []) {
  const u = standIn(user, failing);
  const s = standIn(service, failing);
  mocks.service = s.client;
  const data = await getWatchlistData(u.client as never);
  return { data, userCalls: u.calls, serviceCalls: s.calls };
}

const STORE = "https://proj.supabase.co/storage/v1/object/public";
const stored = (name: string) => `${STORE}/covers/tiktok/${name}.jpg`;
const CDN = (name: string) => `https://p16-sign.tiktokcdn.example/${name}.jpeg?x-expires=1`;

/** The fields a row carried before the new Discover's fields, in their order. */
const OLD_FIELDS = [
  "key",
  "handle",
  "name",
  "avatarUrl",
  "followerCount",
  "outlierCount",
  "bestMultiplier",
  "videosHeld",
  "newestPostAt",
  "mergedFrom",
  "held",
  "profileHandle",
] as const;

const oldFieldsOf = (s: WatchlistSource) =>
  Object.fromEntries(OLD_FIELDS.map((k) => [k, s[k]])) as Pick<WatchlistSource, (typeof OLD_FIELDS)[number]>;

/** One read of a creator: the ingest writes this time on all its rows; "vs own" is its stored basis. */
const OWN_READ = { platform: "tiktok", baseline_label: "vs own", ingested_at: "2026-11-20T09:00:00Z" };

/**
 * One fixture with every kind of row: a profile with two tracked spellings, a profile merged by its
 * display name, a held profile, and a tracked handle with no profile.
 */
const USER: Record<string, Rows> = {
  tracked_accounts: [
    { id: "t-1", handle: "jay.makes", platform: "tiktok" },
    { id: "t-2", handle: "jaymakes", platform: "tiktok" },
    { id: "t-3", handle: "niacooks", platform: "tiktok" },
    { id: "t-4", handle: "made.up.creator", platform: "tiktok" },
  ],
  user_competitors: [{ competitor_id: "p-jay" }, { competitor_id: "p-nia" }, { competitor_id: "p-dev" }],
  scraped_videos: [
    { creator_handle: "jay.makes", outlier_multiplier: 4.2, posted_at: "2026-11-01T00:00:00Z", cover_url: stored("j1"), ...OWN_READ },
    { creator_handle: "jaymakes", outlier_multiplier: 12, posted_at: "2026-11-10T00:00:00Z", cover_url: stored("j2"), ...OWN_READ },
    { creator_handle: "niacooks", outlier_multiplier: 2.9, posted_at: "2026-10-01T00:00:00Z", cover_url: CDN("n1"), ...OWN_READ },
    { creator_handle: "made.up.creator", outlier_multiplier: "3", posted_at: null, cover_url: null, ...OWN_READ },
  ],
};
const SERVICE: Record<string, Rows> = {
  competitor_profiles: [
    {
      id: "p-jay",
      tiktok_handle: "jaymakes",
      display_name: "Jay Makes",
      avatar_url: `${STORE}/avatars/competitor/jaymakes.jpg`,
      follower_count: 162_000_000,
      scrape_status: "done",
    },
    {
      id: "p-nia",
      tiktok_handle: "nia.c",
      display_name: "Nia Cooks",
      avatar_url: null,
      follower_count: 52_000,
      scrape_status: "done",
    },
    {
      id: "p-dev",
      tiktok_handle: "dev.lifts",
      display_name: "junk from a failed read",
      avatar_url: "https://junk.example/a.jpg",
      follower_count: null,
      scrape_status: "failed",
    },
  ],
  // Newest first, as the read asks for.
  competitor_videos: [
    { id: "v-1", competitor_id: "p-jay", caption: "First", cover_url: stored("c1"), views: 1000, posted_at: "2026-11-20T00:00:00Z" },
    { id: "v-2", competitor_id: "p-jay", caption: null, cover_url: stored("c2"), views: null, posted_at: "2026-11-15T00:00:00Z" },
    { id: "v-3", competitor_id: "p-jay", caption: "Third", cover_url: stored("c3"), views: 5, posted_at: "2026-11-12T00:00:00Z" },
    { id: "v-4", competitor_id: "p-nia", caption: "x".repeat(100), cover_url: null, views: 9, posted_at: "2026-11-11T00:00:00Z" },
    { id: "v-5", competitor_id: "p-nia", caption: "Nia's pasta", cover_url: CDN("c5"), views: 7, posted_at: "2026-11-09T00:00:00Z" },
  ],
};

describe("getWatchlistData: today's fields keep their values", () => {
  beforeEach(() => vi.clearAllMocks());

  it("builds the same rows, in the same order, as before the new fields", async () => {
    const { data } = await read(USER, SERVICE);

    expect(data.sources.map(oldFieldsOf)).toEqual([
      {
        key: "p-jay",
        handle: "jaymakes",
        name: "Jay Makes",
        avatarUrl: `${STORE}/avatars/competitor/jaymakes.jpg`,
        followerCount: 162_000_000,
        outlierCount: 2,
        bestMultiplier: 12,
        videosHeld: 3,
        newestPostAt: "2026-11-20T00:00:00Z",
        mergedFrom: null,
        held: false,
        profileHandle: "jaymakes",
      },
      {
        key: "p-nia",
        handle: "nia.c",
        name: "Nia Cooks",
        avatarUrl: null,
        followerCount: 52_000,
        outlierCount: 1,
        bestMultiplier: 2.9,
        videosHeld: 2,
        newestPostAt: "2026-11-11T00:00:00Z",
        mergedFrom: "niacooks",
        held: false,
        profileHandle: "nia.c",
      },
      {
        key: "made.up.creator",
        handle: "made.up.creator",
        name: "made.up.creator",
        avatarUrl: null,
        followerCount: null,
        outlierCount: 1,
        bestMultiplier: 3,
        videosHeld: 0,
        newestPostAt: null,
        mergedFrom: null,
        held: false,
        profileHandle: null,
      },
      {
        key: "p-dev",
        handle: "dev.lifts",
        name: "dev.lifts",
        avatarUrl: null,
        followerCount: null,
        outlierCount: 0,
        bestMultiplier: null,
        videosHeld: 0,
        newestPostAt: null,
        mergedFrom: null,
        held: true,
        profileHandle: "dev.lifts",
      },
    ]);
  });

  it("keeps the latest strip as it was: newest first, a cover required, two per creator", async () => {
    const { data } = await read(USER, SERVICE);

    expect(data.latest).toEqual([
      { id: "v-1", handle: "jaymakes", caption: "First", coverUrl: stored("c1"), views: 1000, postedAt: "2026-11-20T00:00:00Z" },
      { id: "v-2", handle: "jaymakes", caption: "Untitled", coverUrl: stored("c2"), views: 0, postedAt: "2026-11-15T00:00:00Z" },
      { id: "v-5", handle: "nia.c", caption: "Nia's pasta", coverUrl: CDN("c5"), views: 7, postedAt: "2026-11-09T00:00:00Z" },
    ]);
  });

  it("asks for profiles by the caller's own handles and links only, each handed as values", async () => {
    const { serviceCalls } = await read(USER, SERVICE);

    const asked = serviceCalls.filter((c) => c.table === "competitor_profiles" && c.method === "in").map((c) => c.args);
    expect(asked).toEqual([
      ["tiktok_handle", ["jay.makes", "jaymakes", "niacooks", "made.up.creator"]],
      ["id", ["p-jay", "p-nia", "p-dev"]],
    ]);
    expect(serviceCalls.some((c) => c.method === "or")).toBe(false);
  });

  it("does not ask for a handle that could never be a creator's; the others are still asked", async () => {
    const odd = ['a"b', "x,y", "(z)", "back\\slash"];
    const { serviceCalls } = await read(
      { tracked_accounts: [...odd, "jay.makes"].map((handle, i) => ({ id: `t-${i}`, handle, platform: "tiktok" })) },
      {},
    );

    const asked = serviceCalls.filter((c) => c.table === "competitor_profiles" && c.method === "in").map((c) => c.args);
    expect(asked).toEqual([["tiktok_handle", ["jay.makes"]]]);
  });

  it("a profile both doors reach is listed once", async () => {
    const { data } = await read(USER, SERVICE);

    const keys = data.sources.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.filter((k) => k === "p-jay")).toHaveLength(1);
  });

  it("reads an empty account as an empty list, with no service read", async () => {
    const { data, serviceCalls } = await read({}, {});

    expect(data.sources).toEqual([]);
    expect(data.latest).toEqual([]);
    expect(serviceCalls).toEqual([]);
  });
});

const byKey = (sources: WatchlistSource[], key: string) => {
  const row = sources.find((s) => s.key === key);
  if (!row) throw new Error(`no row ${key}`);
  return row;
};

describe("getWatchlistData: the records a row rests on (Remove clears them)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads each tracked record's id", async () => {
    const { userCalls } = await read(USER, SERVICE);

    const select = userCalls.find((c) => c.table === "tracked_accounts" && c.method === "select");
    expect(select?.args).toEqual(["id, handle, platform"]);
  });

  it("gives a tracked handle with no profile its own record and no link", async () => {
    const { data } = await read(USER, SERVICE);

    const row = byKey(data.sources, "made.up.creator");
    expect(row.trackedIds).toEqual(["t-4"]);
    expect(row.competitorId).toBeNull();
  });

  it("gives a profile the caller links to, with nothing tracked, its link and no record", async () => {
    const { data } = await read(USER, SERVICE);

    const row = byKey(data.sources, "p-dev");
    expect(row.trackedIds).toEqual([]);
    expect(row.competitorId).toBe("p-dev");
  });

  it("gives a profile every tracked spelling that folds into it, and its link", async () => {
    const { data } = await read(USER, SERVICE);

    const jay = byKey(data.sources, "p-jay");
    expect(jay.trackedIds).toEqual(["t-1", "t-2"]);
    expect(jay.competitorId).toBe("p-jay");
    // Merged by display name: the one tracked record behind it.
    const nia = byKey(data.sources, "p-nia");
    expect(nia.trackedIds).toEqual(["t-3"]);
    expect(nia.competitorId).toBe("p-nia");
    // The fold is unchanged: still four rows, no tracked spelling of jay.makes on its own.
    expect(data.sources.map((s) => s.key)).toEqual(["p-jay", "p-nia", "made.up.creator", "p-dev"]);
  });

  it("gives a profile reached by a tracked handle alone that record and no link", async () => {
    const { data } = await read(
      { tracked_accounts: [{ id: "t-9", handle: "dev.lifts", platform: "tiktok" }] },
      {
        competitor_profiles: [
          {
            id: "p-dev",
            tiktok_handle: "dev.lifts",
            display_name: "Dev Lifts",
            avatar_url: null,
            follower_count: 900,
            scrape_status: "done",
          },
        ],
      },
    );

    expect(data.sources).toHaveLength(1);
    expect(data.sources[0]).toMatchObject({ key: "p-dev", trackedIds: ["t-9"], competitorId: null });
  });

  it("gives a profile the records of its handle on every platform, so Remove leaves nothing behind", async () => {
    // The fold reads the handle alone. Remove clears every record the row rests on; one left behind
    // would bring the row back on the next read.
    const { data } = await read(
      {
        tracked_accounts: [
          { id: "t-tt", handle: "jay.makes", platform: "tiktok" },
          { id: "t-ig", handle: "jay.makes", platform: "instagram" },
        ],
      },
      {
        competitor_profiles: [
          {
            id: "p-jay",
            tiktok_handle: "jay.makes",
            display_name: "Jay Makes",
            avatar_url: null,
            follower_count: 10,
            scrape_status: "done",
          },
        ],
      },
    );

    expect(data.sources.map((s) => [s.key, s.trackedIds])).toEqual([["p-jay", ["t-tt", "t-ig"]]]);
  });

  it("leaves a second spelling that the fold does not take on its own row, with its own record", async () => {
    // "nia.cooks" matches the profile by its display name and is found first, so it folds in;
    // "nia.c" matches by handle but a different spelling, and today stays its own row.
    const { data } = await read(
      {
        tracked_accounts: [
          { id: "t-a", handle: "nia.cooks", platform: "tiktok" },
          { id: "t-b", handle: "nia.c", platform: "tiktok" },
        ],
        user_competitors: [{ competitor_id: "p-nia" }],
      },
      {
        competitor_profiles: [
          {
            id: "p-nia",
            tiktok_handle: "nia.c",
            display_name: "Nia Cooks",
            avatar_url: null,
            follower_count: 52_000,
            scrape_status: "done",
          },
        ],
      },
    );

    expect(data.sources.map((s) => [s.key, s.trackedIds, s.competitorId])).toEqual([
      ["p-nia", ["t-a"], "p-nia"],
      ["nia.c", ["t-b"], null],
    ]);
  });
});

describe("getWatchlistData: proven videos (3× or more)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("counts the measured videos at 3× or more, while outlierCount still counts every one", async () => {
    const { data } = await read(
      {
        tracked_accounts: [{ id: "t-1", handle: "jay.makes", platform: "tiktok" }],
        scraped_videos: [
          { creator_handle: "jay.makes", outlier_multiplier: 2.9, posted_at: null, cover_url: null, ...OWN_READ },
          { creator_handle: "jay.makes", outlier_multiplier: 3, posted_at: null, cover_url: null, ...OWN_READ },
          { creator_handle: "jay.makes", outlier_multiplier: "14.5", posted_at: null, cover_url: null, ...OWN_READ },
          { creator_handle: "jay.makes", outlier_multiplier: 1.2, posted_at: null, cover_url: null, ...OWN_READ },
        ],
      },
      {},
    );

    expect(data.sources[0]).toMatchObject({ outlierCount: 4, provenCount: 2, bestMultiplier: 14.5 });
  });

  it("counts the last read's proven videos only, as the creator's page shows them", async () => {
    const older = { platform: "tiktok", baseline_label: "vs own", ingested_at: "2026-07-10T09:00:00Z" };
    const { data } = await read(
      {
        tracked_accounts: [{ id: "t-1", handle: "jay.makes", platform: "tiktok" }],
        scraped_videos: [
          // The July read's 5.8× was measured against July's median: the page no longer shows it.
          { creator_handle: "jay.makes", outlier_multiplier: 5.8, posted_at: null, cover_url: null, ...older },
          { creator_handle: "jay.makes", outlier_multiplier: 3.4, posted_at: null, cover_url: null, ...OWN_READ },
          { creator_handle: "jay.makes", outlier_multiplier: 1.9, posted_at: null, cover_url: null, ...OWN_READ },
          // No basis, or no readable read time: not proven (the page shows neither as proven).
          { creator_handle: "jay.makes", outlier_multiplier: 9, posted_at: null, cover_url: null, ...OWN_READ, baseline_label: null },
          { creator_handle: "jay.makes", outlier_multiplier: 8, posted_at: null, cover_url: null, ...OWN_READ, baseline_label: "  " },
          { creator_handle: "jay.makes", outlier_multiplier: 7, posted_at: null, cover_url: null, ...OWN_READ, ingested_at: null },
          // Another platform's newer read of the same handle: the page reads TikTok only, so it neither counts
          // nor moves which read is the last.
          { creator_handle: "jay.makes", outlier_multiplier: 6, posted_at: null, cover_url: null, platform: "instagram", baseline_label: "vs own", ingested_at: "2026-11-25T09:00:00Z" },
        ],
      },
      {},
    );

    expect(data.sources[0]).toMatchObject({ outlierCount: 7, provenCount: 1, bestMultiplier: 9 });
  });

  it("finds the last read across a creator's two spellings, as the page reads both", async () => {
    const { data } = await read(
      {
        tracked_accounts: [{ id: "t-1", handle: "jay.makes", platform: "tiktok" }],
        user_competitors: [{ competitor_id: "p-jay" }],
        scraped_videos: [
          { creator_handle: "jay.makes", outlier_multiplier: 4, posted_at: null, cover_url: null, ...OWN_READ, ingested_at: "2026-07-10T09:00:00Z" },
          { creator_handle: "jaymakes", outlier_multiplier: 6, posted_at: null, cover_url: null, ...OWN_READ },
        ],
      },
      { competitor_profiles: (SERVICE.competitor_profiles ?? []).filter((p) => p.id === "p-jay") },
    );

    expect(byKey(data.sources, "p-jay").provenCount).toBe(1);
  });

  it("counts a profile's proven videos through the tracked spellings, and 0 when there are none", async () => {
    const { data } = await read(USER, SERVICE);

    expect(byKey(data.sources, "p-jay").provenCount).toBe(2);
    expect(byKey(data.sources, "p-nia").provenCount).toBe(0);
    expect(byKey(data.sources, "made.up.creator").provenCount).toBe(1);
    expect(byKey(data.sources, "p-dev").provenCount).toBe(0);
  });
});

describe("getWatchlistData: covers Maven stores", () => {
  beforeEach(() => vi.clearAllMocks());

  it("asks the measured videos for their date and their stored cover", async () => {
    const { userCalls } = await read(USER, SERVICE);

    const select = userCalls.find((c) => c.table === "scraped_videos" && c.method === "select");
    expect(select?.args).toEqual([
      "creator_handle, platform, outlier_multiplier, baseline_label, posted_at, cover_url:metadata->>cover_url, ingested_at:metadata->>ingested_at",
    ]);
  });

  it("takes stored covers only, from both tables, newest first, each once, at most three", async () => {
    const { data } = await read(
      {
        tracked_accounts: [{ id: "t-1", handle: "jay.makes", platform: "tiktok" }],
        user_competitors: [{ competitor_id: "p-jay" }],
        scraped_videos: [
          { creator_handle: "jay.makes", outlier_multiplier: 5, posted_at: "2026-11-18T00:00:00Z", cover_url: stored("a") },
          // The newest, but a signed CDN address that expires: not drawn.
          { creator_handle: "jay.makes", outlier_multiplier: 5, posted_at: "2026-11-25T00:00:00Z", cover_url: CDN("b") },
          { creator_handle: "jay.makes", outlier_multiplier: 5, posted_at: null, cover_url: stored("c") },
          { creator_handle: "jay.makes", outlier_multiplier: 5, posted_at: "2026-11-02T00:00:00Z", cover_url: stored("d") },
        ],
      },
      {
        competitor_profiles: [
          {
            id: "p-jay",
            tiktok_handle: "jay.makes",
            display_name: "Jay Makes",
            avatar_url: null,
            follower_count: 10,
            scrape_status: "done",
          },
        ],
        competitor_videos: [
          { id: "v-e", competitor_id: "p-jay", caption: "e", cover_url: stored("e"), views: 1, posted_at: "2026-11-20T00:00:00Z" },
          // The same stored cover as a measured video: drawn once.
          { id: "v-a", competitor_id: "p-jay", caption: "a", cover_url: stored("a"), views: 1, posted_at: "2026-11-18T00:00:00Z" },
          { id: "v-f", competitor_id: "p-jay", caption: "f", cover_url: stored("f"), views: 1, posted_at: "2026-11-10T00:00:00Z" },
          { id: "v-g", competitor_id: "p-jay", caption: "g", cover_url: null, views: 1, posted_at: "2026-11-24T00:00:00Z" },
        ],
      },
    );

    expect(data.sources).toHaveLength(1);
    expect(data.sources[0]?.covers).toEqual([stored("e"), stored("a"), stored("f")]);
  });

  it("puts a cover with no date after the dated ones", async () => {
    const { data } = await read(
      {
        tracked_accounts: [{ id: "t-1", handle: "jay.makes", platform: "tiktok" }],
        scraped_videos: [
          { creator_handle: "jay.makes", outlier_multiplier: 5, posted_at: null, cover_url: stored("c") },
          { creator_handle: "jay.makes", outlier_multiplier: 5, posted_at: "2026-11-02T00:00:00Z", cover_url: stored("d") },
        ],
      },
      {},
    );

    expect(data.sources[0]?.covers).toEqual([stored("d"), stored("c")]);
  });

  it("gives each row its own covers, and none when nothing stored is held", async () => {
    const { data } = await read(USER, SERVICE);

    expect(byKey(data.sources, "p-jay").covers).toEqual([stored("c1"), stored("c2"), stored("c3")]);
    // Only a CDN address on either table.
    expect(byKey(data.sources, "p-nia").covers).toEqual([]);
    expect(byKey(data.sources, "made.up.creator").covers).toEqual([]);
    expect(byKey(data.sources, "p-dev").covers).toEqual([]);
  });

  it("gives a tracked handle with no profile the covers of its measured videos", async () => {
    const { data } = await read(
      {
        tracked_accounts: [{ id: "t-4", handle: "made.up.creator", platform: "tiktok" }],
        scraped_videos: [
          { creator_handle: "made.up.creator", outlier_multiplier: 4, posted_at: "2026-11-01T00:00:00Z", cover_url: stored("m1") },
          { creator_handle: "made.up.creator", outlier_multiplier: 4, posted_at: "2026-11-03T00:00:00Z", cover_url: stored("m2") },
        ],
      },
      {},
    );

    expect(data.sources[0]?.covers).toEqual([stored("m2"), stored("m1")]);
  });
});

describe("getWatchlistData: an ownership read that fails makes the list incomplete", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is complete when every read answers", async () => {
    const { data } = await read(USER, SERVICE);

    expect(data.incomplete).toBe(false);
  });

  it("is incomplete when the tracked records cannot be read, and still lists the linked creators", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const { data } = await read(USER, SERVICE, ["tracked_accounts"]);

    expect(data.incomplete).toBe(true);
    // As before: what the links reach is still listed, with no tracked record behind it.
    expect(data.sources.map((s) => [s.key, s.trackedIds, s.competitorId])).toEqual([
      ["p-jay", [], "p-jay"],
      ["p-nia", [], "p-nia"],
      ["p-dev", [], "p-dev"],
    ]);
    expect(error).toHaveBeenCalledWith(
      "[getWatchlistData] an ownership read failed",
      expect.objectContaining({ tracked: expect.objectContaining({ code: "08006" }), competitors: null }),
    );
    error.mockRestore();
  });

  it("is incomplete when the links cannot be read, and still lists the tracked creators", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const { data } = await read(USER, SERVICE, ["user_competitors"]);

    expect(data.incomplete).toBe(true);
    // A profile reached by a tracked handle is still listed; its link could not be read.
    expect(byKey(data.sources, "p-jay")).toMatchObject({ trackedIds: ["t-1", "t-2"], competitorId: null });
    expect(byKey(data.sources, "made.up.creator")).toMatchObject({ trackedIds: ["t-4"], competitorId: null });
    expect(error).toHaveBeenCalledWith(
      "[getWatchlistData] an ownership read failed",
      expect.objectContaining({ tracked: null, competitors: expect.objectContaining({ code: "08006" }) }),
    );
    error.mockRestore();
  });

  it("is incomplete when the profiles cannot be read: the linked creators would vanish", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const { data } = await read(USER, SERVICE, ["competitor_profiles"]);

    expect(data.incomplete).toBe(true);
    // As before: only the tracked handles are listed, each on its own, with no link named.
    expect(data.sources.map((s) => [s.key, s.trackedIds, s.competitorId])).toEqual([
      ["jay.makes", ["t-1"], null],
      ["jaymakes", ["t-2"], null],
      ["niacooks", ["t-3"], null],
      ["made.up.creator", ["t-4"], null],
    ]);
    expect(error).toHaveBeenCalledWith(
      "[getWatchlistData] an ownership read failed",
      expect.objectContaining({
        tracked: null,
        competitors: null,
        profiles: expect.objectContaining({ code: "08006" }),
      }),
    );
    error.mockRestore();
  });

  it("stays complete when only the videos cannot be read: the rows come without counts and covers", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const { data } = await read(USER, SERVICE, ["scraped_videos", "competitor_videos"]);

    expect(data.incomplete).toBe(false);
    expect(data.sources.map((s) => s.key)).toEqual(["p-jay", "p-nia", "made.up.creator", "p-dev"]);
    expect(byKey(data.sources, "p-jay")).toMatchObject({
      trackedIds: ["t-1", "t-2"],
      competitorId: "p-jay",
      outlierCount: 0,
      provenCount: 0,
      videosHeld: 0,
      covers: [],
    });
    expect(data.latest).toEqual([]);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
