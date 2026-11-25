/**
 * The reader (`readDue`, plan 2026-11-24-after-posting, Task 2, with rulings 10, 13 and 14). Real: the reader,
 * the rules (`isDue`, `usualOf`, `postedAtOf`, `handleOf`, `finalAtOf`, `stateOf`) and the repository. Stood
 * in for: the database (`fake-db.ts`) and the scraper (a recording provider with exactly the two calls).
 * Every handle, id and link is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IngestError, type VideoData } from "@/lib/scraping/types";
import { READS_KEPT, RETRY_MAX, isBeingRead, isDue, stateOf, usualOf, type PiecePostRow } from "../posted";
import { READS_PER_RUN, RUN_SECONDS, readDue, type PostReader } from "../read-posts";
import { fakeDb } from "./fake-db";
import { CHAT, HOUR, MINUTE, NOW, OTHER, USER, ago, idAt } from "./fixtures";

// ─── The scraper stand-in ────────────────────────────────────────────────────

type Answer<T> = T | Error | (() => T);
function recorder(script: { single?: Record<string, Answer<VideoData | null>>; account?: Record<string, Answer<VideoData[]>> } = {}) {
  const calls: Array<{ call: "single"; url: string } | { call: "account"; handle: string; limit: number; mode: string }> = [];
  const answer = <T>(a: Answer<T> | undefined, what: string): T => {
    if (a === undefined) throw new Error(`stand-in: no answer scripted for ${what}`);
    if (a instanceof Error) throw a;
    return typeof a === "function" ? (a as () => T)() : a;
  };
  const provider: PostReader = {
    async scrapeSinglePostMetrics(url) {
      calls.push({ call: "single", url });
      return answer(script.single?.[url], url);
    },
    async scrapeVideos(handle, limit, mode) {
      calls.push({ call: "account", handle, limit, mode });
      return answer(script.account?.[handle], handle);
    },
  };
  return { provider, calls };
}

/** A post as the scraper returns it, with a caption and an author's name that must never be stored. */
function post(p: { id: string; handle?: string | null; views?: number; postedAt?: Date; pinned?: boolean; likes?: number }): VideoData {
  const handle = p.handle === undefined ? "nia.cooks" : p.handle;
  return {
    platformVideoId: p.id,
    videoUrl: handle ? `https://www.tiktok.com/@${handle}/video/${p.id}` : "",
    caption: "A CAPTION FROM OUTSIDE THE APP",
    views: p.views ?? 12_400,
    likes: p.likes ?? 2_100,
    comments: 84,
    shares: 310,
    saves: 420,
    hashtags: ["madeup"],
    durationSeconds: 21,
    postedAt: p.postedAt ?? NOW, // the scraper fills a missing time with "now"
    ...(p.pinned ? { isPinned: true } : {}),
    ...(handle ? { author: { handle, fans: 1000, heart: 5000, videoCount: 40 } } : {}),
  };
}

/** Six of the account's other posts, each older than 72 hours: views 1,000 to 6,000 (median 3,500). */
const OLD_POSTS = [1, 2, 3, 4, 5, 6].map((i) => post({ id: idAt(ago((80 + i) * HOUR), i), views: i * 1000 }));

// ─── Rows ────────────────────────────────────────────────────────────────────

let db: ReturnType<typeof fakeDb>;
let warn: ReturnType<typeof vi.spyOn>;
const LINK = (n: number) => `https://vm.tiktok.com/ZMmadeup${n}/`;
let keyN = 0;

/** Seed one stored row of `piece_posts` and return it as stored. */
function seed(over: Partial<PiecePostRow> & { user_id?: string } = {}): PiecePostRow {
  keyN += 1;
  db.seed({
    user_id: USER,
    thread_id: CHAT,
    piece_key: `key-${keyN}`,
    piece_kind: "hooks",
    said_number: 67,
    said_measure: "stop",
    said_at: ago(100 * HOUR).toISOString(),
    post_url: LINK(keyN),
    created_at: ago(1 * HOUR).toISOString(),
    ...over,
  });
  // A copy: the stand-in's own row changes when the reader writes it.
  return structuredClone(db.state.rows.at(-1)) as unknown as PiecePostRow;
}
const counts = { views: 900, likes: 90, comments: 9, shares: 3, saves: 1 };
/** A row read before, of `handle`, posted `ageH` hours ago, last read `readH` hours ago. */
function seedRead(p: { handle?: string | null; ageH: number; readH: number; low?: number } & Partial<PiecePostRow>): PiecePostRow {
  const { handle = "nia.cooks", ageH, readH, low = 999, ...over } = p;
  const at = ago(ageH * HOUR);
  return seed({
    post_id: idAt(at, low),
    handle,
    posted_at: at.toISOString(),
    ...counts,
    read_at: ago(readH * HOUR).toISOString(),
    last_attempt_at: ago(readH * HOUR).toISOString(),
    reads: [{ at: ago(readH * HOUR).toISOString(), ...counts }],
    created_at: ago((ageH - 1) * HOUR).toISOString(),
    ...over,
  });
}
const stored = (id: string) => db.state.rows.find((r) => r.id === id) as unknown as PiecePostRow;
const writes = () => db.state.calls.filter((c) => c.action !== "select");

beforeEach(() => {
  db = fakeDb();
  keyN = 0;
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
});

/** Every call the reader made to the table was scoped to the caller. */
function expectScoped() {
  for (const call of db.state.calls) expect(call.filters).toContainEqual({ op: "eq", column: "user_id", value: USER });
}

// ─── 1. A post never read ────────────────────────────────────────────────────

describe("a post never read", () => {
  it("is read once by its link: post id, account, post time from the id, numbers, one kept read, the canonical link", async () => {
    const row = seed();
    const postedAt = ago(30 * HOUR);
    const id = idAt(postedAt);
    const { provider, calls } = recorder({ single: { [row.post_url]: post({ id, views: 12_400 }) } });

    const touched = await readDue(db.client, USER, provider, NOW);
    expect(calls).toEqual([{ call: "single", url: LINK(1) }]);
    const after = stored(row.id);
    expect(after).toMatchObject({
      post_id: id,
      handle: "nia.cooks",
      post_url: `https://www.tiktok.com/@nia.cooks/video/${id}`,
      views: 12_400,
      likes: 2_100,
      comments: 84,
      shares: 310,
      saves: 420,
      read_error: null,
      attempts: 0,
      settled_at: null,
    });
    expect(Date.parse(after.posted_at!)).toBe(Math.floor(postedAt.getTime() / 1000) * 1000);
    expect(Date.parse(after.read_at!)).toBe(NOW.getTime());
    expect(Date.parse(after.last_attempt_at!)).toBe(NOW.getTime());
    expect(after.reads).toEqual([{ at: NOW.toISOString(), views: 12_400, likes: 2_100, comments: 84, shares: 310, saves: 420 }]);
    expect(stateOf(after)).toBe("so-far");
    expect(touched.map((r) => r.id)).toEqual([row.id]);
    // Text from outside the app is never stored.
    expect(JSON.stringify(db.state.rows)).not.toContain("CAPTION");
    expectScoped();
  });

  it("gone (the scraper finds no post): read_error gone, attempts + 1, the attempt's time; unread", async () => {
    const row = seed();
    const { provider } = recorder({ single: { [row.post_url]: null } });
    await readDue(db.client, USER, provider, NOW);
    expect(stored(row.id)).toMatchObject({ read_error: "gone", attempts: 1, views: null });
    expect(Date.parse(stored(row.id).last_attempt_at!)).toBe(NOW.getTime());
    expect(stateOf(stored(row.id))).toBe("unread");
  });

  it("a failed read: read_error failed, attempts + 1, the attempt's time; logged by its class, never with the link", async () => {
    const row = seed();
    const { provider } = recorder({ single: { [row.post_url]: new IngestError("scrape_failed", row.post_url) } });
    await readDue(db.client, USER, provider, NOW);
    expect(stored(row.id)).toMatchObject({ read_error: "failed", attempts: 1, read_at: null });
    expect(Date.parse(stored(row.id).last_attempt_at!)).toBe(NOW.getTime());
    // Ruling 19a: one failed first read is enough; the card offers Try again.
    expect(stateOf(stored(row.id))).toBe("unread");
    expect(warn).toHaveBeenCalled();
    const logged = warn.mock.calls.flat().map(String).join(" ");
    expect(logged).toContain("IngestError[scrape_failed]");
    expect(logged).not.toContain("tiktok");
    expect(logged).not.toContain("ZMmadeup");
  });

  it("an Error of another kind is logged by its name only", async () => {
    const row = seed();
    const { provider } = recorder({ single: { [row.post_url]: new TypeError(`fetch failed for ${LINK(1)}`) } });
    await readDue(db.client, USER, provider, NOW);
    const logged = warn.mock.calls.flat().map(String).join(" ");
    expect(logged).toContain("TypeError");
    expect(logged).not.toContain("ZMmadeup");
  });

  it("a post never read whose first read failed is not read again until Try again (ruling 19a)", async () => {
    seed({ attempts: 1, read_error: "failed", last_attempt_at: ago(5 * HOUR).toISOString() });
    const { provider, calls } = recorder();
    expect(await readDue(db.client, USER, provider, NOW)).toEqual([]);
    expect(calls).toEqual([]);
    expect(writes()).toEqual([]);
  });

  it("numbers that are not numbers are a failed read, and nothing is stored from it", async () => {
    const row = seed();
    const { provider } = recorder({ single: { [row.post_url]: { ...post({ id: idAt(ago(30 * HOUR)) }), views: Number.NaN } } });
    await readDue(db.client, USER, provider, NOW);
    expect(stored(row.id)).toMatchObject({ read_error: "failed", attempts: 1, views: null, post_id: null, handle: null });
  });

  it("without a valid account or id, the pasted link stays and the post time comes from the scraper only when it is not a filled-in now", async () => {
    const a = seed();
    const b = seed();
    const { provider } = recorder({
      single: {
        [a.post_url]: post({ id: "not-a-number", handle: null, postedAt: ago(40 * HOUR) }),
        [b.post_url]: post({ id: "also-not", handle: "Not A Handle!", postedAt: NOW }),
      },
    });
    await readDue(db.client, USER, provider, NOW);
    expect(stored(a.id)).toMatchObject({ post_id: null, handle: null, post_url: LINK(1), views: 12_400 });
    expect(Date.parse(stored(a.id).posted_at!)).toBe(ago(40 * HOUR).getTime());
    expect(stored(b.id)).toMatchObject({ post_id: null, handle: null, post_url: LINK(2), posted_at: null });
  });

  it("older than 72 hours: read alone, then ONE account read gives the usual, and it settles", async () => {
    const row = seed({ created_at: ago(2 * HOUR).toISOString() });
    const id = idAt(ago(100 * HOUR));
    const target = post({ id, views: 7_000 });
    const { provider, calls } = recorder({ single: { [row.post_url]: target }, account: { "nia.cooks": [target, ...OLD_POSTS] } });

    await readDue(db.client, USER, provider, NOW);
    expect(calls).toEqual([
      { call: "single", url: LINK(1) },
      { call: "account", handle: "nia.cooks", limit: 30, mode: "profile" },
    ]);
    const after = stored(row.id);
    expect(after).toMatchObject({ views: 7_000, usual_views: 3_500, usual_posts: 6 });
    expect(usualOf([target, ...OLD_POSTS], id, NOW)).toEqual({ views: 3_500, posts: 6 });
    expect(Date.parse(after.settled_at!)).toBe(NOW.getTime());
    expect(stateOf(after)).toBe("final");
    // One read of the post, kept once: the account read in the same run adds no second one.
    expect(after.reads).toHaveLength(1);
  });

  it("older than 72 hours and not among the account's latest 30: settles with their usual, read once", async () => {
    const row = seed();
    const id = idAt(ago(100 * HOUR));
    const { provider, calls } = recorder({ single: { [row.post_url]: post({ id, views: 7_000 }) }, account: { "nia.cooks": OLD_POSTS } });
    await readDue(db.client, USER, provider, NOW);
    expect(calls.map((c) => c.call)).toEqual(["single", "account"]);
    expect(stored(row.id)).toMatchObject({ views: 7_000, usual_views: 3_500, usual_posts: 6 });
    expect(stored(row.id).settled_at).not.toBeNull();
    expect(stored(row.id).reads).toHaveLength(1);
  });

  it("older than 72 hours with no account: read alone, and it settles without a usual", async () => {
    const row = seed();
    const { provider, calls } = recorder({ single: { [row.post_url]: post({ id: idAt(ago(100 * HOUR)), handle: null }) } });
    await readDue(db.client, USER, provider, NOW);
    expect(calls).toHaveLength(1);
    expect(stored(row.id)).toMatchObject({ usual_views: null, usual_posts: null, views: 12_400 });
    expect(Date.parse(stored(row.id).settled_at!)).toBe(NOW.getTime());
  });
});

// ─── 2. The account read ─────────────────────────────────────────────────────

describe("the account read", () => {
  it("two posts of one account cost one account read; each gets its numbers and a kept read", async () => {
    const a = seedRead({ ageH: 30, readH: 13, low: 1 });
    const b = seedRead({ ageH: 50, readH: 14, low: 2 });
    const { provider, calls } = recorder({
      account: { "nia.cooks": [post({ id: a.post_id!, views: 5_000 }), post({ id: b.post_id!, views: 8_000 }), ...OLD_POSTS] },
    });
    const touched = await readDue(db.client, USER, provider, NOW);
    expect(calls).toEqual([{ call: "account", handle: "nia.cooks", limit: 30, mode: "profile" }]);
    expect(stored(a.id)).toMatchObject({ views: 5_000, settled_at: null, usual_views: null, attempts: 0, read_error: null });
    expect(stored(b.id)).toMatchObject({ views: 8_000, settled_at: null });
    expect(stored(a.id).reads).toHaveLength(2);
    expect(Date.parse(stored(a.id).read_at!)).toBe(NOW.getTime());
    expect(touched.map((r) => r.id).sort()).toEqual([a.id, b.id].sort());
    expectScoped();
  });

  it("settles a post found in it at 72 hours, with the usual of the account's other posts (by finalAtOf, ruling 10)", async () => {
    const row = seedRead({ ageH: 72, readH: 1 });
    const unknownTime = seedRead({ ageH: 80, readH: 13, low: 5, posted_at: null, created_at: ago(72 * HOUR).toISOString() });
    const list = [post({ id: row.post_id!, views: 7_000 }), post({ id: unknownTime.post_id!, views: 2_000 }), ...OLD_POSTS];
    const { provider } = recorder({ account: { "nia.cooks": list } });
    await readDue(db.client, USER, provider, NOW);
    // Its usual: the six old posts and the other linked one (80 hours old), not itself.
    expect(usualOf(list, row.post_id, NOW)).toEqual({ views: 3_000, posts: 7 });
    expect(stored(row.id)).toMatchObject({ views: 7_000, usual_views: 3_000, usual_posts: 7 });
    expect(Date.parse(stored(row.id).settled_at!)).toBe(NOW.getTime());
    // No post time: its 72 hours count from the link.
    expect(stored(unknownTime.id).settled_at).not.toBeNull();
    expect(stored(unknownTime.id)).toMatchObject({ usual_views: usualOf(list, unknownTime.post_id, NOW)!.views });
  });

  it("a post not yet 72 hours old is not settled (71 h 59 min)", async () => {
    const row = seedRead({ ageH: 0, readH: 13, posted_at: new Date(NOW.getTime() - 72 * HOUR + MINUTE).toISOString() });
    const { provider } = recorder({ account: { "nia.cooks": [post({ id: row.post_id! }), ...OLD_POSTS] } });
    await readDue(db.client, USER, provider, NOW);
    expect(stored(row.id).settled_at).toBeNull();
  });

  it("with fewer than five settled other posts, it settles without a usual (null stays null)", async () => {
    const row = seedRead({ ageH: 90, readH: 13 });
    const { provider } = recorder({ account: { "nia.cooks": [post({ id: row.post_id! }), ...OLD_POSTS.slice(0, 4)] } });
    await readDue(db.client, USER, provider, NOW);
    expect(stored(row.id).settled_at).not.toBeNull();
    expect(stored(row.id)).toMatchObject({ usual_views: null, usual_posts: null });
  });

  it("updates the account's other linked posts it finds too, owed a read or not", async () => {
    const due = seedRead({ ageH: 30, readH: 13, low: 1 });
    const fresh = seedRead({ ageH: 20, readH: 1, low: 2 });
    const { provider } = recorder({ account: { "nia.cooks": [post({ id: due.post_id!, views: 5_000 }), post({ id: fresh.post_id!, views: 6_000 })] } });
    const touched = await readDue(db.client, USER, provider, NOW);
    expect(stored(fresh.id)).toMatchObject({ views: 6_000 });
    expect(touched.map((r) => r.id).sort()).toEqual([due.id, fresh.id].sort());
  });

  it("a due post not in it is read alone; past 72 hours it then settles with the account's usual", async () => {
    const row = seedRead({ ageH: 100, readH: 1 });
    const { provider, calls } = recorder({
      account: { "nia.cooks": OLD_POSTS },
      single: { [row.post_url]: post({ id: row.post_id!, views: 9_000 }) },
    });
    await readDue(db.client, USER, provider, NOW);
    expect(calls.map((c) => c.call)).toEqual(["account", "single"]);
    expect(stored(row.id)).toMatchObject({ views: 9_000, usual_views: 3_500, usual_posts: 6 });
    expect(stored(row.id).settled_at).not.toBeNull();
  });

  it("a due post not in it that is gone becomes gone, and is not settled", async () => {
    const row = seedRead({ ageH: 30, readH: 13 });
    const { provider } = recorder({ account: { "nia.cooks": OLD_POSTS }, single: { [row.post_url]: null } });
    await readDue(db.client, USER, provider, NOW);
    expect(stored(row.id)).toMatchObject({ read_error: "gone", attempts: 1, views: 900, settled_at: null });
  });

  it("a post not owed a read and not in it is left alone", async () => {
    const due = seedRead({ ageH: 30, readH: 13, low: 1 });
    const fresh = seedRead({ ageH: 20, readH: 1, low: 2 });
    const { provider, calls } = recorder({ account: { "nia.cooks": [post({ id: due.post_id! })] } });
    await readDue(db.client, USER, provider, NOW);
    expect(calls).toHaveLength(1);
    expect(stored(fresh.id)).toEqual(fresh);
  });

  it("a failed account read is a failed read of each due post of that account; the next account is still read", async () => {
    const a = seedRead({ ageH: 30, readH: 13, low: 1 });
    const b = seedRead({ ageH: 30, readH: 13, low: 2, handle: "sam.bakes" });
    const { provider, calls } = recorder({
      account: { "nia.cooks": new IngestError("scrape_failed", "nia.cooks"), "sam.bakes": [post({ id: b.post_id!, handle: "sam.bakes", views: 4_000 })] },
    });
    await readDue(db.client, USER, provider, NOW);
    expect(calls.map((c) => (c.call === "account" ? c.handle : c.url))).toEqual(["nia.cooks", "sam.bakes"]);
    expect(stored(a.id)).toMatchObject({ read_error: "failed", attempts: 1, views: 900 });
    expect(stored(b.id)).toMatchObject({ read_error: null, views: 4_000 });
  });

  it("never writes another person's post of the same account", async () => {
    const mine = seedRead({ ageH: 30, readH: 13 });
    const theirs = seedRead({ ageH: 30, readH: 13, user_id: OTHER, post_id: mine.post_id });
    const { provider } = recorder({ account: { "nia.cooks": [post({ id: mine.post_id!, views: 5_000 })] } });
    await readDue(db.client, USER, provider, NOW);
    expect(stored(mine.id).views).toBe(5_000);
    expect(stored(theirs.id)).toEqual(theirs);
    expect(writes().length).toBeGreaterThan(0);
    expectScoped();
  });
});

// ─── 3. A post with no account ───────────────────────────────────────────────

describe("a post read before with no account", () => {
  it("is read alone, and settles without a usual once 72 hours old", async () => {
    const young = seedRead({ ageH: 30, readH: 13, handle: null, low: 1 });
    const old = seedRead({ ageH: 100, readH: 1, handle: null, low: 2 });
    const { provider, calls } = recorder({
      single: { [young.post_url]: post({ id: young.post_id!, handle: null, views: 1_500 }), [old.post_url]: post({ id: old.post_id!, handle: null, views: 2_500 }) },
    });
    await readDue(db.client, USER, provider, NOW);
    expect(calls.map((c) => c.call)).toEqual(["single", "single"]);
    expect(stored(young.id)).toMatchObject({ views: 1_500, settled_at: null });
    expect(stored(old.id)).toMatchObject({ views: 2_500, usual_views: null });
    expect(stored(old.id).settled_at).not.toBeNull();
  });
});

// ─── 4. The cap, and one failure among many ──────────────────────────────────

describe("the cap and failures", () => {
  it(`makes at most ${READS_PER_RUN} scraper calls a run; the rest stay owed`, async () => {
    const rows = [1, 2, 3, 4, 5].map(() => seed());
    const single = Object.fromEntries(rows.map((r, i) => [r.post_url, post({ id: idAt(ago(30 * HOUR), i + 1) })]));
    const { provider, calls } = recorder({ single });
    await readDue(db.client, USER, provider, NOW);
    expect(READS_PER_RUN).toBe(3);
    expect(calls).toHaveLength(3);
    expect(rows.slice(3).map((r) => stored(r.id))).toEqual(rows.slice(3));
  });

  it("the cap holds across never-read posts and account reads", async () => {
    const a = seed();
    const b = seed();
    seedRead({ ageH: 30, readH: 13, low: 1 });
    seedRead({ ageH: 30, readH: 13, low: 2, handle: "sam.bakes" });
    const { provider, calls } = recorder({
      single: { [a.post_url]: post({ id: idAt(ago(30 * HOUR), 7), handle: "ade.lifts" }), [b.post_url]: post({ id: idAt(ago(30 * HOUR), 8), handle: "ade.lifts" }) },
      account: { "nia.cooks": OLD_POSTS, "sam.bakes": OLD_POSTS },
    });
    await readDue(db.client, USER, provider, NOW);
    expect(calls.map((c) => c.call)).toEqual(["single", "single", "account"]);
  });

  it("a throw in one post does not stop the others", async () => {
    const a = seed();
    const b = seed();
    const { provider } = recorder({ single: { [a.post_url]: new Error("actor crashed"), [b.post_url]: post({ id: idAt(ago(30 * HOUR)) }) } });
    await readDue(db.client, USER, provider, NOW);
    expect(stored(a.id)).toMatchObject({ read_error: "failed", attempts: 1 });
    expect(stored(b.id)).toMatchObject({ read_error: null, views: 12_400 });
  });

  it("a failed read never hides numbers already read (ruling 14): the post stays so far, its numbers as they were", async () => {
    const row = seedRead({ ageH: 30, readH: 13, attempts: 2, read_error: "failed", last_attempt_at: ago(11 * MINUTE).toISOString() });
    const { provider } = recorder({ account: { "nia.cooks": new Error("actor crashed") } });
    await readDue(db.client, USER, provider, NOW);
    expect(stored(row.id)).toMatchObject({ attempts: 3, read_error: "failed", views: 900 });
    expect(stateOf(stored(row.id))).toBe("so-far");
  });

  it("keeps the newest 12 reads", async () => {
    const reads = Array.from({ length: READS_KEPT }, (_, i) => ({ at: ago((40 - i) * HOUR).toISOString(), ...counts }));
    const row = seedRead({ ageH: 50, readH: 13, reads });
    const { provider } = recorder({ account: { "nia.cooks": [post({ id: row.post_id!, views: 5_000 })] } });
    await readDue(db.client, USER, provider, NOW);
    const kept = stored(row.id).reads as Array<{ at: string; views: number }>;
    expect(kept).toHaveLength(READS_KEPT);
    expect(kept.at(-1)).toEqual({ at: NOW.toISOString(), views: 5_000, likes: 2_100, comments: 84, shares: 310, saves: 420 });
    expect(kept[0]!.at).toBe(reads[1]!.at);
  });

  it("reads nothing that is not owed: settled, removed, gone, waiting after a failure, read recently", async () => {
    seedRead({ ageH: 100, readH: 13, settled_at: ago(HOUR).toISOString() });
    seed({ removed_at: ago(HOUR).toISOString() });
    seed({ read_error: "gone", attempts: 1 });
    seed({ read_error: "failed", attempts: 1, last_attempt_at: ago(5 * MINUTE).toISOString() });
    seedRead({ ageH: 20, readH: 2 });
    const { provider, calls } = recorder();
    expect(await readDue(db.client, USER, provider, NOW)).toEqual([]);
    expect(calls).toEqual([]);
    expect(writes()).toEqual([]);
  });

  it("another person's owed posts are never read", async () => {
    seed({ user_id: OTHER });
    const { provider, calls } = recorder();
    expect(await readDue(db.client, USER, provider, NOW)).toEqual([]);
    expect(calls).toEqual([]);
  });
});

// ─── 5. One post, and "Try again" ────────────────────────────────────────────

describe("only one post", () => {
  it("reads just that one when it is owed", async () => {
    const a = seed();
    const b = seed();
    const { provider, calls } = recorder({ single: { [b.post_url]: post({ id: idAt(ago(30 * HOUR)) }) } });
    const touched = await readDue(db.client, USER, provider, NOW, { only: b.id });
    expect(calls).toEqual([{ call: "single", url: b.post_url }]);
    expect(touched.map((r) => r.id)).toEqual([b.id]);
    expect(stored(a.id)).toEqual(a);
  });

  it("reads nothing for one not owed, another person's, or an id that is not one", async () => {
    const fresh = seedRead({ ageH: 20, readH: 1 });
    const theirs = seed({ user_id: OTHER });
    const { provider, calls } = recorder();
    for (const only of [fresh.id, theirs.id, "not-an-id"]) expect(await readDue(db.client, USER, provider, NOW, { only })).toEqual([]);
    expect(calls).toEqual([]);
    expect(writes()).toEqual([]);
  });

  it("Try again of a gone post: reads it now, even inside the ten-minute wait; a good read sets attempts to 0", async () => {
    const row = seed({ read_error: "gone", attempts: 1, last_attempt_at: ago(2 * MINUTE).toISOString() });
    const { provider, calls } = recorder({ single: { [row.post_url]: post({ id: idAt(ago(30 * HOUR)) }) } });
    const touched = await readDue(db.client, USER, provider, NOW, { only: row.id, retry: true });
    expect(calls).toHaveLength(1);
    expect(stored(row.id)).toMatchObject({ read_error: null, attempts: 0, views: 12_400 });
    expect(touched.map((r) => stateOf(r))).toEqual(["so-far"]);
  });

  it("Try again of a post whose reads failed before it was ever read: a failed try counts on (ruling 27), and it is unread again", async () => {
    const row = seed({ read_error: "failed", attempts: 3, last_attempt_at: ago(HOUR).toISOString() });
    const { provider, calls } = recorder({ single: { [row.post_url]: new Error("actor crashed") } });
    await readDue(db.client, USER, provider, NOW, { only: row.id, retry: true });
    expect(calls).toHaveLength(1);
    expect(stored(row.id)).toMatchObject({ read_error: "failed", attempts: 4 });
    expect(stateOf(stored(row.id))).toBe("unread");
  });

  it("Try again after one failed first read, and the read is good: so far", async () => {
    const row = seed({ read_error: "failed", attempts: 1, last_attempt_at: ago(2 * MINUTE).toISOString() });
    const { provider } = recorder({ single: { [row.post_url]: post({ id: idAt(ago(30 * HOUR)) }) } });
    const touched = await readDue(db.client, USER, provider, NOW, { only: row.id, retry: true });
    expect(touched.map((r) => stateOf(r))).toEqual(["so-far"]);
    expect(stored(row.id)).toMatchObject({ read_error: null, attempts: 0 });
  });

  it("Try again of a gone post that has numbers goes through its account read", async () => {
    const row = seedRead({ ageH: 30, readH: 13, read_error: "gone", attempts: 1, last_attempt_at: ago(2 * MINUTE).toISOString() });
    const { provider, calls } = recorder({ account: { "nia.cooks": [post({ id: row.post_id!, views: 5_000 })] } });
    await readDue(db.client, USER, provider, NOW, { only: row.id, retry: true });
    expect(calls.map((c) => c.call)).toEqual(["account"]);
    expect(stored(row.id)).toMatchObject({ read_error: null, attempts: 0, views: 5_000 });
  });

  it("Try again of a gone post with numbers that the account read misses: a failed try counts on", async () => {
    const row = seedRead({ ageH: 30, readH: 13, read_error: "gone", attempts: 1, last_attempt_at: ago(2 * MINUTE).toISOString() });
    const { provider, calls } = recorder({ account: { "nia.cooks": OLD_POSTS }, single: { [row.post_url]: new Error("actor crashed") } });
    await readDue(db.client, USER, provider, NOW, { only: row.id, retry: true });
    expect(calls.map((c) => c.call)).toEqual(["account", "single"]);
    expect(stored(row.id)).toMatchObject({ read_error: "failed", attempts: 2, views: 900 });
    expect(stateOf(stored(row.id))).toBe("so-far");
  });

  it(`Try again is bounded (ruling 27): the ${RETRY_MAX}th failed read is still made; the next Try again makes no call and answers the post unchanged`, async () => {
    const row = seed({ read_error: "failed", attempts: RETRY_MAX - 1, last_attempt_at: ago(1_000).toISOString() });
    const { provider, calls } = recorder({ single: { [row.post_url]: new Error("actor crashed") } });
    await readDue(db.client, USER, provider, NOW, { only: row.id, retry: true });
    expect(calls).toHaveLength(1);
    expect(stored(row.id)).toMatchObject({ read_error: "failed", attempts: RETRY_MAX });

    const spent = structuredClone(stored(row.id));
    db.state.calls = [];
    const answer = await readDue(db.client, USER, provider, new Date(NOW.getTime() + 1_000), { only: row.id, retry: true });
    expect(calls).toHaveLength(1);
    expect(writes()).toEqual([]);
    expect(stored(row.id)).toEqual(spent);
    expect(answer).toEqual([spent]);
    expect(stateOf(answer[0]!)).toBe("unread");
  });

  it("a good read after failures sets attempts to 0", async () => {
    const row = seed({ read_error: "failed", attempts: 5, last_attempt_at: ago(HOUR).toISOString() });
    const { provider } = recorder({ single: { [row.post_url]: post({ id: idAt(ago(30 * HOUR)) }) } });
    await readDue(db.client, USER, provider, NOW, { only: row.id, retry: true });
    expect(stored(row.id)).toMatchObject({ read_error: null, attempts: 0, views: 12_400 });
  });

  it("Try again of a post that is not unread is only a read of it when owed", async () => {
    const row = seedRead({ ageH: 20, readH: 1, attempts: 1, read_error: "failed", last_attempt_at: ago(2 * MINUTE).toISOString() });
    const { provider, calls } = recorder();
    expect(await readDue(db.client, USER, provider, NOW, { only: row.id, retry: true })).toEqual([]);
    expect(calls).toEqual([]);
    expect(stored(row.id)).toEqual(row);
  });
});

// ─── 6. One read at a time (ruling 18) ───────────────────────────────────────

/** A promise the stand-in scraper waits on, so that two runs can both get past their reads of what is owed. */
function gate() {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => (open = resolve));
  return { opened, open };
}
const ticks = async (n = 20) => {
  for (let i = 0; i < n; i += 1) await Promise.resolve();
};

describe("one read at a time (ruling 18)", () => {
  it("two runs started together on the same owed post cost one scraper call; the other returns without it", async () => {
    const row = seed();
    const g = gate();
    const { provider, calls } = recorder({
      single: {
        [row.post_url]: () => post({ id: idAt(ago(30 * HOUR)) }),
      },
    });
    const slow: PostReader = {
      ...provider,
      async scrapeSinglePostMetrics(url) {
        await g.opened;
        return provider.scrapeSinglePostMetrics(url);
      },
    };
    const first = readDue(db.client, USER, slow, NOW);
    const second = readDue(db.client, USER, slow, NOW);
    await ticks();
    g.open();
    const [a, b] = await Promise.all([first, second]);
    expect(calls).toHaveLength(1);
    expect([a.length, b.length].sort()).toEqual([0, 1]);
    expect(stored(row.id)).toMatchObject({ views: 12_400, attempts: 0 });
  });

  it("a run for one post and a run for everything owed, together: each post is read once", async () => {
    const x = seed();
    const y = seed();
    const g = gate();
    const { provider, calls } = recorder({
      single: { [x.post_url]: post({ id: idAt(ago(30 * HOUR), 1) }), [y.post_url]: post({ id: idAt(ago(30 * HOUR), 2) }) },
    });
    const slow: PostReader = {
      ...provider,
      async scrapeSinglePostMetrics(url) {
        await g.opened;
        return provider.scrapeSinglePostMetrics(url);
      },
    };
    const one = readDue(db.client, USER, slow, NOW, { only: x.id });
    const all = readDue(db.client, USER, slow, NOW);
    await ticks();
    g.open();
    const [a, b] = await Promise.all([one, all]);
    expect(calls.map((c) => (c.call === "single" ? c.url : c.handle)).sort()).toEqual([x.post_url, y.post_url].sort());
    expect(a.map((r) => r.id)).toEqual([x.id]);
    expect(b.map((r) => r.id)).toEqual([y.id]);
  });

  it("two runs on the same account's owed post cost one account read", async () => {
    const row = seedRead({ ageH: 30, readH: 13 });
    const g = gate();
    const { provider, calls } = recorder({ account: { "nia.cooks": [post({ id: row.post_id!, views: 5_000 })] } });
    const slow: PostReader = {
      ...provider,
      async scrapeVideos(handle, limit, mode) {
        await g.opened;
        return provider.scrapeVideos(handle, limit, mode);
      },
    };
    const first = readDue(db.client, USER, slow, NOW);
    const second = readDue(db.client, USER, slow, NOW);
    await ticks();
    g.open();
    await Promise.all([first, second]);
    expect(calls).toHaveLength(1);
    expect(stored(row.id)).toMatchObject({ views: 5_000 });
    expect(stored(row.id).reads).toHaveLength(2);
  });

  it("two runs on the same owed post with no account cost one call", async () => {
    const row = seedRead({ ageH: 30, readH: 13, handle: null });
    const g = gate();
    const { provider, calls } = recorder({ single: { [row.post_url]: post({ id: row.post_id!, handle: null, views: 1_500 }) } });
    const slow: PostReader = {
      ...provider,
      async scrapeSinglePostMetrics(url) {
        await g.opened;
        return provider.scrapeSinglePostMetrics(url);
      },
    };
    const first = readDue(db.client, USER, slow, NOW);
    const second = readDue(db.client, USER, slow, NOW);
    await ticks();
    g.open();
    await Promise.all([first, second]);
    expect(calls).toHaveLength(1);
    expect(stored(row.id).views).toBe(1_500);
  });

  it("the post is claimed before the scraper is called", async () => {
    const row = seed();
    let atCall: string | null = "not called";
    const { provider } = recorder({ single: { [row.post_url]: post({ id: idAt(ago(30 * HOUR)) }) } });
    const watching: PostReader = {
      ...provider,
      async scrapeSinglePostMetrics(url) {
        atCall = stored(row.id).last_attempt_at;
        return provider.scrapeSinglePostMetrics(url);
      },
    };
    await readDue(db.client, USER, watching, NOW);
    expect(Date.parse(String(atCall))).toBe(NOW.getTime());
    const claim = db.state.calls.find((c) => c.action === "update")!;
    expect(claim.values).toMatchObject({ last_attempt_at: NOW.toISOString(), read_error: null });
    // A compare-and-set on the attempt time it saw (none yet).
    expect(claim.or).toEqual([`and(id.eq.${row.id},last_attempt_at.is.null)`]);
  });

  it("Try again a second after a failed read reads at once: one more call (ruling 22)", async () => {
    const row = seed();
    const answers = [new Error("actor crashed"), post({ id: idAt(ago(30 * HOUR)) })];
    const { provider, calls } = recorder({ single: { [row.post_url]: () => {
      const a = answers.shift()!;
      if (a instanceof Error) throw a;
      return a;
    } } });
    await readDue(db.client, USER, provider, NOW);
    expect(stateOf(stored(row.id))).toBe("unread");
    const second = new Date(NOW.getTime() + 1_000);
    const touched = await readDue(db.client, USER, provider, second, { only: row.id, retry: true });
    expect(calls).toHaveLength(2);
    expect(touched.map((r) => stateOf(r))).toEqual(["so-far"]);
    expect(stored(row.id)).toMatchObject({ read_error: null, attempts: 0, views: 12_400 });
  });

  it("Try again of a gone post a second after: read at once", async () => {
    const row = seed({ read_error: "gone", attempts: 1, last_attempt_at: ago(1_000).toISOString() });
    const { provider, calls } = recorder({ single: { [row.post_url]: post({ id: idAt(ago(30 * HOUR)) }) } });
    await readDue(db.client, USER, provider, NOW, { only: row.id, retry: true });
    expect(calls).toHaveLength(1);
  });

  it("a read in progress (claimed 10 seconds ago, not ended) is not taken by a Try again", async () => {
    const row = seed({ last_attempt_at: ago(10_000).toISOString() });
    const { provider, calls } = recorder({ single: { [row.post_url]: post({ id: idAt(ago(30 * HOUR)) }) } });
    expect(await readDue(db.client, USER, provider, NOW, { only: row.id, retry: true })).toEqual([]);
    expect(calls).toEqual([]);
    expect(stored(row.id)).toEqual(row);
  });

  it("two Try agains of the same unread post sent together cost one call", async () => {
    const row = seed({ read_error: "failed", attempts: 1, last_attempt_at: ago(1_000).toISOString() });
    const g = gate();
    const { provider, calls } = recorder({ single: { [row.post_url]: post({ id: idAt(ago(30 * HOUR)) }) } });
    const slow: PostReader = {
      ...provider,
      async scrapeSinglePostMetrics(url) {
        await g.opened;
        return provider.scrapeSinglePostMetrics(url);
      },
    };
    const first = readDue(db.client, USER, slow, NOW, { only: row.id, retry: true });
    const second = readDue(db.client, USER, slow, NOW, { only: row.id, retry: true });
    await ticks();
    g.open();
    const [a, b] = await Promise.all([first, second]);
    expect(calls).toHaveLength(1);
    expect([a.length, b.length].sort()).toEqual([0, 1]);
  });

  it("every post a run claims ends its attempt: a post found with numbers that are not numbers is a failed read", async () => {
    const owed = seedRead({ ageH: 30, readH: 13, low: 1 });
    const other = seedRead({ ageH: 30, readH: 2, low: 2, read_error: "gone", attempts: 1 });
    const { provider } = recorder({
      account: { "nia.cooks": [post({ id: owed.post_id!, views: 5_000 }), { ...post({ id: other.post_id! }), views: Number.NaN }] },
    });
    await readDue(db.client, USER, provider, NOW);
    expect(stored(other.id)).toMatchObject({ read_error: "failed", attempts: 2, views: 900 });
    expect(isBeingRead(stored(other.id), new Date(NOW.getTime() + 1_000))).toBe(false);
    expect(isBeingRead(stored(owed.id), new Date(NOW.getTime() + 1_000))).toBe(false);
  });

  it.each([[20_000], [200_000]])("an account read never writes a post another run is reading (claimed %i ms ago, not ended)", async (since) => {
    const owed = seedRead({ ageH: 30, readH: 13, low: 1 });
    // Being read by another run right now: claimed `since` ago, not ended (its last read is older).
    const held = seedRead({ ageH: 30, readH: 13, low: 2, last_attempt_at: ago(since).toISOString() });
    const { provider } = recorder({
      account: { "nia.cooks": [post({ id: owed.post_id!, views: 5_000 }), post({ id: held.post_id!, views: 6_000 })] },
    });
    const touched = await readDue(db.client, USER, provider, NOW);
    expect(stored(owed.id).views).toBe(5_000);
    expect(stored(held.id)).toEqual(held);
    expect(touched.map((r) => r.id)).toEqual([owed.id]);
  });
});

describe("a claim holds for the longest read, and a run gives back what it did not read (ruling 26)", () => {
  it("an account read writes a post whose claim is 241 seconds old (that read is over)", async () => {
    const owed = seedRead({ ageH: 30, readH: 13, low: 1 });
    const stale = seedRead({ ageH: 30, readH: 13, low: 2, last_attempt_at: ago(241_000).toISOString() });
    const { provider } = recorder({
      account: { "nia.cooks": [post({ id: owed.post_id!, views: 5_000 }), post({ id: stale.post_id!, views: 6_000 })] },
    });
    await readDue(db.client, USER, provider, NOW);
    expect(stored(stale.id).views).toBe(6_000);
  });

  it("a second Try again 200 seconds into the first one's read makes no call", async () => {
    const row = seed({ read_error: "gone", attempts: 1, last_attempt_at: ago(HOUR).toISOString() });
    const g = gate();
    const { provider, calls } = recorder({ single: { [row.post_url]: post({ id: idAt(ago(30 * HOUR)) }) } });
    const slow: PostReader = {
      ...provider,
      async scrapeSinglePostMetrics(url) {
        await g.opened;
        return provider.scrapeSinglePostMetrics(url);
      },
    };
    const first = readDue(db.client, USER, slow, NOW, { only: row.id, retry: true });
    await ticks();
    const second = await readDue(db.client, USER, slow, new Date(NOW.getTime() + 200_000), { only: row.id, retry: true });
    expect(second).toEqual([]);
    g.open();
    await first;
    expect(calls).toHaveLength(1);
  });

  it("a run stopped by the cap gives back the posts it claimed and did not read: they are owed again at once", async () => {
    const a = seed();
    const b = seed();
    const missed = seedRead({ ageH: 30, readH: 13, low: 1, read_error: "failed", attempts: 1 });
    const missedBefore = structuredClone(stored(missed.id));
    const { provider, calls } = recorder({
      single: { [a.post_url]: post({ id: idAt(ago(30 * HOUR), 7), handle: null }), [b.post_url]: post({ id: idAt(ago(30 * HOUR), 8), handle: null }) },
      account: { "nia.cooks": OLD_POSTS },
    });
    await readDue(db.client, USER, provider, NOW);
    // Two reads by link and the account read: the cap. The account's post is not among the latest 30, and
    // its own read would be a fourth call: it was claimed, not read, and is given back as it was.
    expect(calls.map((c) => c.call)).toEqual(["single", "single", "account"]);
    expect({ ...stored(missed.id), updated_at: null }).toEqual({ ...missedBefore, updated_at: null });
    expect(isDue(stored(missed.id), NOW)).toBe(true);
    expect(isBeingRead(stored(missed.id), NOW)).toBe(false);
    // The next run reads it.
    const next = recorder({ account: { "nia.cooks": OLD_POSTS }, single: { [missed.post_url]: post({ id: missed.post_id!, views: 4_000 }) } });
    await readDue(db.client, USER, next.provider, NOW);
    expect(stored(missed.id)).toMatchObject({ views: 4_000, read_error: null, attempts: 0 });
  });

  it("a run that throws after a claim still gives the post back", async () => {
    const row = seed();
    const { provider } = recorder({ single: { [row.post_url]: post({ id: idAt(ago(30 * HOUR)) }) } });
    const failing: PostReader = {
      ...provider,
      async scrapeSinglePostMetrics(url) {
        // The database fails the read's write: the result is lost, so the claim is given back.
        db.state.failNext = { code: "08006", message: "connection reset by peer" };
        return provider.scrapeSinglePostMetrics(url);
      },
    };
    const before = structuredClone(stored(row.id));
    await expect(readDue(db.client, USER, failing, NOW)).rejects.toThrow("connection reset by peer");
    expect({ ...stored(row.id), updated_at: null }).toEqual({ ...before, updated_at: null });
  });
});

describe("a post that can no longer be read is closed with the numbers it has (ruling 34)", () => {
  it(`the ${RETRY_MAX}th failure in a row of a post with numbers settles it: final, no usual, never due again`, async () => {
    const row = seedRead({ ageH: 30, readH: 40, attempts: RETRY_MAX - 1, read_error: "failed", last_attempt_at: ago(13 * HOUR).toISOString() });
    expect(isDue(row, NOW)).toBe(true);
    const { provider } = recorder({ account: { "nia.cooks": new Error("actor crashed") } });
    await readDue(db.client, USER, provider, NOW);
    const after = stored(row.id);
    expect(after).toMatchObject({ attempts: RETRY_MAX, read_error: "failed", views: 900, usual_views: null, usual_posts: null });
    expect(Date.parse(after.settled_at!)).toBe(NOW.getTime());
    expect(stateOf(after)).toBe("final");
    expect(isDue(after, new Date(NOW.getTime() + 100 * HOUR))).toBe(false);
  });

  it("before that it is tried as ruling 14 says: every 12 hours after three failures", async () => {
    const row = seedRead({ ageH: 30, readH: 40, attempts: RETRY_MAX - 2, read_error: "failed", last_attempt_at: ago(13 * HOUR).toISOString() });
    const { provider } = recorder({ account: { "nia.cooks": new Error("actor crashed") } });
    await readDue(db.client, USER, provider, NOW);
    const after = stored(row.id);
    expect(after).toMatchObject({ attempts: RETRY_MAX - 1, settled_at: null });
    expect(stateOf(after)).toBe("so-far");
    expect(isDue(after, new Date(NOW.getTime() + 12 * HOUR - MINUTE))).toBe(false);
    expect(isDue(after, new Date(NOW.getTime() + 12 * HOUR))).toBe(true);
  });

  it("a post with numbers found gone at its 8th failure in a row (a Try again) is closed too: final", async () => {
    const row = seedRead({ ageH: 30, readH: 40, attempts: RETRY_MAX - 1, read_error: "gone", last_attempt_at: ago(HOUR).toISOString() });
    const { provider } = recorder({ account: { "nia.cooks": OLD_POSTS }, single: { [row.post_url]: null } });
    await readDue(db.client, USER, provider, NOW, { only: row.id, retry: true });
    expect(stored(row.id)).toMatchObject({ attempts: RETRY_MAX, read_error: "gone", views: 900 });
    expect(stored(row.id).settled_at).not.toBeNull();
    expect(stateOf(stored(row.id))).toBe("final");
    // A closed post is never claimed again: a further Try again makes no call.
    const again = recorder();
    expect(await readDue(db.client, USER, again.provider, new Date(NOW.getTime() + 1_000), { only: row.id, retry: true })).toEqual([]);
    expect(again.calls).toEqual([]);
  });

  it("a post never read stays unread at its 8th failure: nothing to close it with", async () => {
    const row = seed({ read_error: "failed", attempts: RETRY_MAX - 1, last_attempt_at: ago(HOUR).toISOString() });
    const { provider } = recorder({ single: { [row.post_url]: new Error("actor crashed") } });
    await readDue(db.client, USER, provider, NOW, { only: row.id, retry: true });
    expect(stored(row.id)).toMatchObject({ attempts: RETRY_MAX, settled_at: null });
    expect(stateOf(stored(row.id))).toBe("unread");
  });
});

describe(`a run stays inside its time (ruling 33): no call starts ${RUN_SECONDS} s after it began`, () => {
  /** A real clock the test moves, apart from the injected `now`. */
  const clockAt = (start = 1_000_000) => {
    const c = { t: start };
    return { c, clock: () => c.t };
  };

  it("after 110 seconds no further call starts; the posts not reached are not touched and stay owed", async () => {
    const rows = [seed(), seed(), seed()];
    const { c, clock } = clockAt();
    const { provider, calls } = recorder({
      single: Object.fromEntries(
        rows.map((r, i) => [
          r.post_url,
          () => {
            c.t += i === 0 ? RUN_SECONDS * 1000 : 0; // the first read takes the whole budget
            return post({ id: idAt(ago(30 * HOUR), i + 1) });
          },
        ]),
      ),
    });
    await readDue(db.client, USER, provider, NOW, {}, clock);
    expect(RUN_SECONDS).toBe(110);
    expect(calls).toHaveLength(1);
    expect(rows.slice(1).map((r) => stored(r.id))).toEqual(rows.slice(1));
  });

  it("just under 110 seconds the next call still starts", async () => {
    const rows = [seed(), seed()];
    const { c, clock } = clockAt();
    const { provider, calls } = recorder({
      single: Object.fromEntries(
        rows.map((r, i) => [
          r.post_url,
          () => {
            c.t += i === 0 ? RUN_SECONDS * 1000 - 1 : 0;
            return post({ id: idAt(ago(30 * HOUR), i + 1) });
          },
        ]),
      ),
    });
    await readDue(db.client, USER, provider, NOW, {}, clock);
    expect(calls).toHaveLength(2);
  });

  it("a post claimed and not read because the time ran out is given back, as for the cap", async () => {
    const missed = seedRead({ ageH: 30, readH: 13, low: 1, read_error: "failed", attempts: 1 });
    const before = structuredClone(stored(missed.id));
    const { c, clock } = clockAt();
    const { provider, calls } = recorder({
      account: {
        "nia.cooks": () => {
          c.t += 111_000;
          return OLD_POSTS; // not among them: its own read would be a second call
        },
      },
    });
    await readDue(db.client, USER, provider, NOW, {}, clock);
    expect(calls.map((x) => x.call)).toEqual(["account"]);
    expect({ ...stored(missed.id), updated_at: null }).toEqual({ ...before, updated_at: null });
    expect(isDue(stored(missed.id), NOW)).toBe(true);
  });
});

describe("the scraper is made only when a read is owed (ruling 23)", () => {
  it("nothing owed: the maker is never called", async () => {
    seedRead({ ageH: 20, readH: 1 });
    const make = vi.fn(() => recorder().provider);
    expect(await readDue(db.client, USER, make, NOW)).toEqual([]);
    expect(await readDue(db.client, USER, make, NOW, { only: "33333333-3333-4333-8333-333333333333" })).toEqual([]);
    expect(make).not.toHaveBeenCalled();
  });

  it("something owed: made once, before anything is claimed; a maker that throws writes nothing", async () => {
    const a = seed();
    const b = seed();
    const { provider, calls } = recorder({ single: { [a.post_url]: post({ id: idAt(ago(30 * HOUR), 1) }), [b.post_url]: post({ id: idAt(ago(30 * HOUR), 2) }) } });
    const make = vi.fn(() => provider);
    await readDue(db.client, USER, make, NOW);
    expect(make).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(2);

    const c = seed();
    db.state.calls = [];
    await expect(readDue(db.client, USER, () => { throw new Error("no token"); }, NOW)).rejects.toThrow("no token");
    expect(writes()).toEqual([]);
    expect(stored(c.id)).toEqual(c);
  });
});

describe("a database error", () => {
  it("is thrown (the route answers 500)", async () => {
    seed();
    db.state.failNext = { code: "08006", message: "connection reset by peer" };
    const { provider } = recorder();
    await expect(readDue(db.client, USER, provider, NOW)).rejects.toThrow("connection reset by peer");
  });
});
