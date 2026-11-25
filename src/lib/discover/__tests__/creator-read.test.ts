/** @vitest-environment node */
/**
 * A followed creator's page, read on the server (`getCreatorPage`). The Watchlist's read says whom the
 * caller follows, and only a row with a profile behind it has a page. Then, side by side: the profile by
 * its id (the service client), that creator's measured TikTok videos and the caller's audiences (the
 * caller's client).
 *
 * The two Supabase clients are the boundary and are stood in, as in the Watchlist read's test: the
 * caller's (RLS-scoped) client is passed in, the service client comes from `createServiceClient`. Each
 * stand-in records its calls and answers with the rows a table holds (written to satisfy the filters the
 * read asks for), or with an error for a table named as failing. One addition: `maybeSingle()` answers
 * the first row matching every `eq` its builder was given, or null. The Watchlist read, the audiences
 * read and the page's rules run for real. Every handle, id and address here is made up.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PROFILE_COLUMNS, VIDEO_COLUMNS, getCreatorPage } from "@/lib/discover/creator-read";
import type { CreatorPage, CreatorRead } from "@/lib/discover-next/creator";

type Rows = Record<string, unknown>[];
interface Call {
  table: string;
  method: string;
  args: unknown[];
}

interface Failing {
  /** Tables whose every read answers an error. */
  tables?: readonly string[];
  /** Tables whose read by id (a builder given `eq("id", …)`) answers an error; their other reads answer. */
  byId?: readonly string[];
}

/**
 * A Supabase client stand-in: `from(table)` answers with that table's rows, or with an error (and no
 * data, as supabase-js does) for a failing read; `maybeSingle()` with the first row matching every `eq`
 * of its builder, or null. Every call is recorded.
 */
function standIn(tables: Record<string, Rows>, failing: Failing = {}) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      calls.push({ table, method: "from", args: [] });
      const eqs: [string, unknown][] = [];
      const error = { message: `${table}: connection reset`, code: "08006" };
      const fails = () =>
        (failing.tables ?? []).includes(table) ||
        ((failing.byId ?? []).includes(table) && eqs.some(([column]) => column === "id"));
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "in", "not", "or", "order", "limit", "eq"]) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          if (method === "eq") eqs.push([args[0] as string, args[1]]);
          return builder;
        };
      }
      builder.maybeSingle = () => {
        calls.push({ table, method: "maybeSingle", args: [] });
        if (fails()) return Promise.resolve({ data: null, error });
        const row = (tables[table] ?? []).find((r) => eqs.every(([column, value]) => r[column] === value));
        return Promise.resolve({ data: row ?? null, error: null });
      };
      builder.then = (resolve: (r: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(fails() ? { data: null, error } : { data: tables[table] ?? [], error: null }).then(resolve, reject);
      return builder;
    },
  };
  return { client, calls };
}

/** Each builder's calls after its `from`, in order (a builder's chain runs whole before the next starts). */
function chains(calls: readonly Call[]): { table: string; steps: unknown[][] }[] {
  const out: { table: string; steps: unknown[][] }[] = [];
  for (const c of calls) {
    if (c.method === "from") out.push({ table: c.table, steps: [] });
    else out.at(-1)?.steps.push([c.method, ...c.args]);
  }
  return out;
}

const mocks = vi.hoisted(() => ({ service: null as unknown }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => mocks.service }));

const NOW = new Date("2026-11-25T12:00:00Z");
const LAST_READ = "2026-07-13T09:00:00Z";
const OLDER_READ = "2026-06-01T09:00:00Z";
const STORE = "https://proj.supabase.co/storage/v1/object/public";
const PICTURE = `${STORE}/avatars/competitor/jaymakes.jpg`;
const cover = (id: string) => `${STORE}/covers/tiktok/${id}.jpg`;
const AUDIENCE_ID = "00000000-0000-4000-8000-000000000001";

/** A measured video as `scraped_videos` holds it; the `metadata` keys arrive as text. */
function video(id: string, ingestedAt: string, multiplier: number | string, views: number, handle = "jaymakes"): Rows[number] {
  return {
    creator_handle: handle,
    platform_video_id: id,
    video_url: `https://videos.example/${handle}/${id}`,
    description: `Desk build ${id} #diy`,
    views,
    likes: 100,
    comments: 10,
    posted_at: "2026-07-01T10:00:00Z",
    outlier_multiplier: multiplier,
    baseline_label: "vs own",
    cover_url: cover(id),
    ingested_at: ingestedAt,
    baseline_views: "8600",
  };
}

/** Another creator's audience, read from `jaymakes` on 14 Nov, as the `audiences` table holds it. */
const AUDIENCE_ROW = {
  id: AUDIENCE_ID,
  user_id: "u-1",
  name: "Jay Makes",
  type: "target",
  platform: "tiktok",
  goal_label: "Grow",
  goal_intent: null,
  mode: "socials",
  success_criterion: null,
  custom_context: [],
  is_general: false,
  is_preset: false,
  source_account_id: null,
  fyp: 0.65,
  niche: 0.2,
  loyalist: 0.1,
  cross_niche: 0.05,
  personas: [],
  profile: null,
  calibration: { source: "scrape", handle: "jaymakes", scraped_at: "2026-11-14T10:00:00Z", thin: false },
  creator_persona: null,
  signature: null,
  created_at: "2026-11-14T10:05:00Z",
  updated_at: "2026-11-14T10:05:00Z",
};

/**
 * One account: `jay.makes` tracked and folding into the profile `jaymakes` (also linked), `dev.lifts`
 * tracked with no profile behind it, `nia.cooks` linked only (read four hours ago), and `ari.codes`
 * linked, whose read failed and kept nothing.
 */
const USER: Record<string, Rows> = {
  tracked_accounts: [
    { id: "t-1", handle: "jay.makes", platform: "tiktok" },
    { id: "t-2", handle: "dev.lifts", platform: "tiktok" },
  ],
  user_competitors: [{ competitor_id: "p-jay" }, { competitor_id: "p-nia" }, { competitor_id: "p-ari" }],
  scraped_videos: [
    // An older read, measured against an older median: its 40× is not the page's.
    video("v-old", OLDER_READ, 40, 900_000),
    video("v-b", LAST_READ, 2, 50_000),
    video("v-a", LAST_READ, "12", 106_100),
    video("v-c", LAST_READ, 2, 90_000),
  ],
  audiences: [AUDIENCE_ROW],
};

const JAY = {
  id: "p-jay",
  tiktok_handle: "jaymakes",
  display_name: "Jay Makes",
  bio: "Furniture from offcuts.",
  avatar_url: PICTURE,
  follower_count: 15_400_000,
  heart_count: 369_100_000,
  video_count: 6_364,
  last_scraped_at: LAST_READ,
  scrape_status: "success",
};
const NIA = {
  id: "p-nia",
  tiktok_handle: "nia.cooks",
  display_name: "Nia Cooks",
  bio: null,
  avatar_url: null,
  follower_count: 52_000,
  heart_count: null,
  video_count: 120,
  last_scraped_at: "2026-11-25T08:00:00Z",
  scrape_status: "success",
};
const ARI = {
  id: "p-ari",
  tiktok_handle: "ari.codes",
  display_name: "junk from a failed read",
  bio: "junk",
  avatar_url: "https://junk.example/a.jpg",
  follower_count: null,
  heart_count: null,
  video_count: null,
  last_scraped_at: null,
  scrape_status: "failed",
};
const SERVICE: Record<string, Rows> = { competitor_profiles: [JAY, NIA, ARI] };

/**
 * A second spelling that folds into a profile by its display name, the one fold that names it
 * (`mergedFrom`): `nia.cooks` tracked, the profile stored as `nia.c` "Nia Cooks".
 */
const FOLDED_USER: Record<string, Rows> = {
  tracked_accounts: [{ id: "t-9", handle: "nia.cooks", platform: "tiktok" }],
  user_competitors: [{ competitor_id: "p-nc" }],
};
const FOLDED_SERVICE: Record<string, Rows> = { competitor_profiles: [{ ...NIA, id: "p-nc", tiktok_handle: "nia.c" }] };

async function page(
  handle: string,
  user: Record<string, Rows> = USER,
  service: Record<string, Rows> = SERVICE,
  failing: Failing = {},
) {
  const u = standIn(user, failing);
  const s = standIn(service, failing);
  mocks.service = s.client;
  const result = await getCreatorPage(u.client as never, handle, NOW);
  return { result, userCalls: u.calls, serviceCalls: s.calls };
}

function creatorOf(result: CreatorRead): CreatorPage {
  if (result.state !== "ready") throw new Error(`expected a page, got ${result.state}`);
  return result.creator;
}

const fromTables = (calls: readonly Call[]) => calls.filter((c) => c.method === "from").map((c) => c.table);
/** Whether a profile was read by its id (the page's read; the Watchlist's asks with `or`). */
const readById = (calls: readonly Call[]) =>
  calls.some((c) => c.table === "competitor_profiles" && (c.method === "eq" || c.method === "maybeSingle"));

describe("getCreatorPage: a followed creator's page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("a followed creator with a profile: the page", async () => {
    const { result } = await page("jaymakes");

    const creator = creatorOf(result);
    expect(creator).toMatchObject({
      handle: "jaymakes",
      name: "Jay Makes",
      bio: "Furniture from offcuts.",
      avatarUrl: PICTURE,
      held: false,
      read: "read 13 Jul",
      canReadAgain: true,
      audience: { id: AUDIENCE_ID, builtOn: "14 Nov" },
      removal: { trackedIds: ["t-1"], competitorId: "p-jay" },
    });
    expect(creator.figures).toEqual([
      { key: "followers", label: "Followers", value: "15.4M" },
      { key: "likes", label: "Likes", value: "369.1M" },
      { key: "posts", label: "Posts", value: "6.4K" },
      { key: "usual", label: "Usual views", value: "8.6K" },
    ]);
    // The last read only, biggest jump first, then views.
    expect(creator.videos.map((v) => v.id)).toEqual(["v-a", "v-c", "v-b"]);
    expect(creator.videos[0]).toMatchObject({
      handle: "jaymakes",
      coverUrl: cover("v-a"),
      views: 106_100,
      multiplier: 12,
      baselineLabel: "vs their average",
    });
  });

  it("words the read and gates Read again by the clock it is given", async () => {
    const { result } = await page("nia.cooks");

    // Read four hours before `now`: dated, and not yet to be read again.
    expect(creatorOf(result)).toMatchObject({ handle: "nia.cooks", read: "read 25 Nov", canReadAgain: false });
  });

  it("the address is read as a handle", async () => {
    const plain = (await page("jaymakes")).result;

    expect(creatorOf(plain).handle).toBe("jaymakes");
    expect((await page("%40JayMakes")).result).toEqual(plain);
    expect((await page(" @jaymakes ")).result).toEqual(plain);
  });
});

describe("getCreatorPage: which client reads what", () => {
  beforeEach(() => vi.clearAllMocks());

  it("the profile is read on the service client, by its id, with the page's columns", async () => {
    const { userCalls, serviceCalls } = await page("jaymakes");

    expect(chains(serviceCalls)).toContainEqual({
      table: "competitor_profiles",
      steps: [["select", PROFILE_COLUMNS], ["eq", "id", "p-jay"], ["maybeSingle"]],
    });
    expect(fromTables(userCalls)).not.toContain("competitor_profiles");
  });

  it("the videos on the caller's client: TikTok, both spellings, measured only", async () => {
    const folded = await page("nia.c", FOLDED_USER, FOLDED_SERVICE);

    expect(creatorOf(folded.result).handle).toBe("nia.c");
    expect(chains(folded.userCalls)).toContainEqual({
      table: "scraped_videos",
      steps: [
        ["select", VIDEO_COLUMNS],
        ["eq", "platform", "tiktok"],
        ["in", "creator_handle", ["nia.c", "nia.cooks"]],
        ["not", "outlier_multiplier", "is", null],
      ],
    });
    expect(fromTables(folded.serviceCalls)).not.toContain("scraped_videos");

    // A creator with no folded spelling asks for one handle.
    const single = await page("nia.cooks");
    expect(chains(single.userCalls)).toContainEqual({
      table: "scraped_videos",
      steps: [
        ["select", VIDEO_COLUMNS],
        ["eq", "platform", "tiktok"],
        ["in", "creator_handle", ["nia.cooks"]],
        ["not", "outlier_multiplier", "is", null],
      ],
    });
  });

  it("the audiences on the caller's client", async () => {
    const { userCalls, serviceCalls } = await page("jaymakes");

    expect(fromTables(userCalls).filter((t) => t === "audiences")).toHaveLength(1);
    expect(fromTables(serviceCalls)).not.toContain("audiences");
  });
});

describe("getCreatorPage: no page, a held page, a failure", () => {
  beforeEach(() => vi.clearAllMocks());

  it("not followed, no such creator, a row with no profile: gone", async () => {
    for (const handle of ["kai.wanders", "dev.lifts"]) {
      const { result, userCalls, serviceCalls } = await page(handle);

      expect(result).toEqual({ state: "gone" });
      // Nothing of the page is read for a creator the caller has no page for.
      expect(readById(serviceCalls)).toBe(false);
      expect(fromTables(userCalls)).not.toContain("audiences");
      expect(chains(userCalls).some((c) => c.steps.some((s) => s[0] === "select" && s[1] === VIDEO_COLUMNS))).toBe(false);
    }

    // No handle at all, written or escaped: nothing is read.
    for (const handle of ["", "@", "%40"]) {
      const none = await page(handle);
      expect(none.result).toEqual({ state: "gone" });
      expect(none.userCalls).toEqual([]);
      expect(none.serviceCalls).toEqual([]);
    }
  });

  it("held: the page of a creator whose read failed with nothing kept", async () => {
    const { result } = await page("ari.codes");

    expect(result).toEqual({
      state: "ready",
      creator: {
        handle: "ari.codes",
        name: null,
        bio: null,
        avatarUrl: null,
        held: true,
        read: null,
        canReadAgain: true,
        figures: [],
        videos: [],
        audience: null,
        removal: { trackedIds: [], competitorId: "p-ari" },
      },
    });
  });

  it("whom the caller follows could not be read: failed, nothing more read", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result, userCalls, serviceCalls } = await page("jaymakes", USER, SERVICE, { tables: ["tracked_accounts"] });

    // The linked profile is still listed, but the list is not whole: never "not on your watchlist".
    expect(result).toEqual({ state: "failed" });
    expect(fromTables(userCalls)).toEqual(["tracked_accounts", "user_competitors"]);
    expect(readById(serviceCalls)).toBe(false);
    error.mockRestore();
  });

  it("a profile, videos or audiences read that fails throws", async () => {
    // The by-id read alone fails: the Watchlist's read of the same table answered.
    await expect(page("jaymakes", USER, SERVICE, { byId: ["competitor_profiles"] })).rejects.toThrow(
      "creator profile read failed: competitor_profiles: connection reset",
    );
    await expect(page("jaymakes", USER, SERVICE, { tables: ["scraped_videos"] })).rejects.toThrow(
      "creator videos read failed: scraped_videos: connection reset",
    );
    await expect(page("jaymakes", USER, SERVICE, { tables: ["audiences"] })).rejects.toThrow(
      "audiences list failed: audiences: connection reset",
    );
  });

  it("the profile gone between the two reads: gone", async () => {
    // The Watchlist's read finds the profile; by the read by id it has been deleted.
    let reads = 0;
    const service: Record<string, Rows> = {
      get competitor_profiles() {
        reads += 1;
        return reads === 1 ? [JAY, NIA, ARI] : [];
      },
    };

    const { result, serviceCalls } = await page("jaymakes", USER, service);

    expect(result).toEqual({ state: "gone" });
    expect(readById(serviceCalls)).toBe(true);
  });
});
