/**
 * The posted repository (plan 2026-11-24-after-posting, Task 1) against a recording stand-in for the
 * database (`fake-db.ts`, the I/O boundary). Real: every function of the repository and the rules it uses.
 */
import { describe, expect, it } from "vitest";

import { READS_KEPT, type PiecePostRow } from "../posted";
import {
  PIECE_POST_SELECT,
  appendRead,
  claimPosts,
  duePosts,
  insertPost,
  linksInLastDay,
  postOfId,
  postOfPiece,
  postOfVideo,
  postsOfHandle,
  postsOfThreads,
  releasePosts,
  removePost,
  updatePost,
  type NewPost,
  type PostedRead,
} from "../posted-repo";
import { fakeDb, migrationColumns } from "./fake-db";
import { CHAT, CHAT_2, HOUR, MINUTE, NOW, OTHER, USER, ago } from "./fixtures";

const LINK = "https://vm.tiktok.com/ZMmadeup1/";
const piece = (over: Partial<NewPost> = {}): NewPost => ({
  threadId: CHAT,
  pieceKey: "Ab3_k9-Zx0",
  pieceKind: "hooks",
  said: { number: 67, measure: "stop", at: "2026-11-19T09:00:00.000Z" },
  postUrl: LINK,
  ...over,
});

/** Every call the repository made filtered by the caller's id (or, for an insert, wrote it). */
function expectScopedTo(calls: ReturnType<typeof fakeDb>["state"]["calls"], userId: string) {
  expect(calls.length).toBeGreaterThan(0);
  for (const call of calls) {
    expect(call.table).toBe("piece_posts");
    if (call.action === "insert") {
      for (const v of [call.values].flat()) expect(v).toMatchObject({ user_id: userId });
    } else {
      expect(call.filters).toContainEqual({ op: "eq", column: "user_id", value: userId });
    }
  }
}

describe("the select list", () => {
  it("is every column of the migration, once", () => {
    const listed = PIECE_POST_SELECT.split(",").map((s) => s.trim());
    expect([...listed].sort()).toEqual([...migrationColumns()].sort());
    expect(new Set(listed).size).toBe(listed.length);
  });
});

describe("insertPost", () => {
  it("writes the piece, what Maven said and the link for the caller, and returns the stored row", async () => {
    const db = fakeDb();
    const row = await insertPost(db.client, USER, piece());
    expect(row).toMatchObject({
      user_id: USER,
      thread_id: CHAT,
      piece_key: "Ab3_k9-Zx0",
      piece_kind: "hooks",
      said_number: 67,
      said_measure: "stop",
      said_at: "2026-11-19T09:00:00.000000+00:00",
      platform: "tiktok",
      post_url: LINK,
      views: null,
      reads: [],
      attempts: 0,
      read_error: null,
      created_at: "2026-11-24T12:00:00.000000+00:00",
    });
    expect(db.state.calls).toHaveLength(1);
    expect(db.state.calls[0]).toMatchObject({ action: "insert", columns: PIECE_POST_SELECT, single: "single" });
    expect(db.state.calls[0]!.values).toEqual({
      user_id: USER,
      thread_id: CHAT,
      piece_key: "Ab3_k9-Zx0",
      piece_kind: "hooks",
      said_number: 67,
      said_measure: "stop",
      said_at: "2026-11-19T09:00:00.000Z",
      platform: "tiktok",
      post_url: LINK,
    });
    expectScopedTo(db.state.calls, USER);
  });

  it("is null when the piece already has a post, in a chat or in none", async () => {
    const db = fakeDb();
    expect(await insertPost(db.client, USER, piece())).not.toBeNull();
    expect(await insertPost(db.client, USER, piece({ postUrl: "https://vm.tiktok.com/ZMmadeup2/" }))).toBeNull();
    expect(await insertPost(db.client, USER, piece({ threadId: null, pieceKind: "video", pieceKey: "vid_madeup01" }))).not.toBeNull();
    expect(await insertPost(db.client, USER, piece({ threadId: null, pieceKind: "video", pieceKey: "vid_madeup01" }))).toBeNull();
    expect(db.state.rows).toHaveLength(2);
  });

  it("takes the same key in another chat, and another person's same piece", async () => {
    const db = fakeDb();
    await insertPost(db.client, USER, piece());
    expect(await insertPost(db.client, USER, piece({ threadId: CHAT_2 }))).not.toBeNull();
    expect(await insertPost(db.client, OTHER, piece())).not.toBeNull();
    expect(db.state.rows).toHaveLength(3);
  });

  it("throws on any other failure, without the pasted link in the message", async () => {
    const db = fakeDb();
    db.state.failNext = { code: "08006", message: "connection reset by peer" };
    const error = await insertPost(db.client, USER, piece()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("connection reset by peer");
    expect((error as Error).message).not.toContain("tiktok");
  });
});

describe("postOfPiece", () => {
  it("finds the caller's post of a piece in a chat, or in none", async () => {
    const db = fakeDb();
    const inChat = await insertPost(db.client, USER, piece());
    const alone = await insertPost(db.client, USER, piece({ threadId: null, pieceKind: "video", pieceKey: "vid_madeup01" }));
    db.state.calls = [];
    expect((await postOfPiece(db.client, USER, { threadId: CHAT, pieceKey: "Ab3_k9-Zx0" }))?.id).toBe(inChat!.id);
    expect((await postOfPiece(db.client, USER, { threadId: null, pieceKey: "vid_madeup01" }))?.id).toBe(alone!.id);
    expect(await postOfPiece(db.client, USER, { threadId: null, pieceKey: "Ab3_k9-Zx0" })).toBeNull();
    expect(await postOfPiece(db.client, USER, { threadId: CHAT_2, pieceKey: "Ab3_k9-Zx0" })).toBeNull();
    expect(db.state.calls[1]!.filters).toContainEqual({ op: "is", column: "thread_id", value: null });
    expectScopedTo(db.state.calls, USER);
  });

  it("never finds another person's", async () => {
    const db = fakeDb();
    await insertPost(db.client, OTHER, piece());
    expect(await postOfPiece(db.client, USER, { threadId: CHAT, pieceKey: "Ab3_k9-Zx0" })).toBeNull();
  });

  it("asks nothing for a chat id that is not one", async () => {
    const db = fakeDb();
    expect(await postOfPiece(db.client, USER, { threadId: "not-a-chat", pieceKey: "Ab3_k9-Zx0" })).toBeNull();
    expect(db.state.calls).toHaveLength(0);
  });
});

describe("postOfId", () => {
  it("finds the caller's live post by its id, and never another person's", async () => {
    const db = fakeDb();
    const mine = (await insertPost(db.client, USER, piece()))!;
    const theirs = (await insertPost(db.client, OTHER, piece()))!;
    db.state.calls = [];
    expect((await postOfId(db.client, USER, mine.id))?.id).toBe(mine.id);
    expect(await postOfId(db.client, USER, theirs.id)).toBeNull();
    expectScopedTo(db.state.calls, USER);
    for (const call of db.state.calls) expect(call.filters).toContainEqual({ op: "is", column: "removed_at", value: null });
    await removePost(db.client, USER, mine.id, NOW);
    expect(await postOfId(db.client, USER, mine.id)).toBeNull();
  });

  it("asks nothing for an id that is not one", async () => {
    const db = fakeDb();
    expect(await postOfId(db.client, USER, "not-an-id")).toBeNull();
    expect(db.state.calls).toHaveLength(0);
  });
});

describe("postOfVideo", () => {
  it("finds the caller's live post of a video in any chat or none, linked last first", async () => {
    const db = fakeDb();
    const video = (over: Partial<NewPost>) => piece({ pieceKind: "video", pieceKey: "vid_madeup01", said: { number: 40, measure: "end", at: null }, ...over });
    db.state.now = ago(2 * HOUR);
    const older = (await insertPost(db.client, USER, video({ threadId: null })))!;
    db.state.now = ago(1 * HOUR);
    const newer = (await insertPost(db.client, USER, video({ threadId: CHAT })))!;
    await insertPost(db.client, OTHER, video({ threadId: CHAT_2 }));
    // A text piece whose key happens to read the same is not the video.
    await insertPost(db.client, USER, piece({ threadId: CHAT_2, pieceKey: "vid_madeup01" }));
    db.state.calls = [];
    expect((await postOfVideo(db.client, USER, "vid_madeup01"))?.id).toBe(newer.id);
    await removePost(db.client, USER, newer.id, NOW);
    expect((await postOfVideo(db.client, USER, "vid_madeup01"))?.id).toBe(older.id);
    expect(await postOfVideo(db.client, USER, "vid_other")).toBeNull();
    expectScopedTo(db.state.calls.filter((c) => c.action === "select"), USER);
    expect(db.state.calls[0]!.filters).toEqual(
      expect.arrayContaining([
        { op: "eq", column: "piece_kind", value: "video" },
        { op: "eq", column: "piece_key", value: "vid_madeup01" },
        { op: "is", column: "removed_at", value: null },
      ]),
    );
  });

  it("asks nothing for a key that cannot be an analysis id", async () => {
    const db = fakeDb();
    expect(await postOfVideo(db.client, USER, "")).toBeNull();
    expect(await postOfVideo(db.client, USER, "a/b")).toBeNull();
    expect(await postOfVideo(db.client, USER, "x".repeat(201))).toBeNull();
    expect(db.state.calls).toHaveLength(0);
  });
});

describe("postsOfThreads", () => {
  it("returns the caller's posts of those chats, linked last first, in one select", async () => {
    const db = fakeDb();
    db.seed(
      { user_id: USER, thread_id: CHAT, piece_key: "k1", piece_kind: "hooks", said_number: 60, said_measure: "stop", post_url: LINK, created_at: ago(3 * HOUR).toISOString() },
      { user_id: USER, thread_id: CHAT, piece_key: "k2", piece_kind: "ideas", said_number: 61, said_measure: "stop", post_url: LINK, created_at: ago(1 * HOUR).toISOString() },
      { user_id: USER, thread_id: CHAT_2, piece_key: "k3", piece_kind: "video", said_number: 40, said_measure: "end", post_url: LINK, created_at: ago(2 * HOUR).toISOString() },
      { user_id: OTHER, thread_id: CHAT, piece_key: "k4", piece_kind: "hooks", said_number: 50, said_measure: "stop", post_url: LINK },
      { user_id: USER, thread_id: null, piece_key: "k5", piece_kind: "video", said_number: 50, said_measure: "end", post_url: LINK },
    );
    const rows = await postsOfThreads(db.client, USER, [CHAT, CHAT_2]);
    expect(rows.map((r) => r.piece_key)).toEqual(["k2", "k3", "k1"]);
    expect(db.state.calls).toHaveLength(1);
    expectScopedTo(db.state.calls, USER);
  });

  it("asks nothing for no chats, and leaves out an id that is not one", async () => {
    const db = fakeDb();
    expect(await postsOfThreads(db.client, USER, [])).toEqual([]);
    expect(await postsOfThreads(db.client, USER, ["not-a-chat"])).toEqual([]);
    expect(db.state.calls).toHaveLength(0);
    await postsOfThreads(db.client, USER, [CHAT, "not-a-chat"]);
    expect(db.state.calls[0]!.filters).toContainEqual({ op: "in", column: "thread_id", value: [CHAT] });
  });
});

describe("duePosts", () => {
  it("returns the caller's posts a read is owed for, oldest linked first", async () => {
    const db = fakeDb();
    const base = { user_id: USER, piece_kind: "hooks", said_number: 60, said_measure: "stop", post_url: LINK };
    const read = { views: 10, likes: 1, comments: 1, shares: 1, saves: 1, posted_at: ago(30 * HOUR).toISOString() };
    db.seed(
      { ...base, piece_key: "never-read", created_at: ago(2 * HOUR).toISOString() },
      { ...base, piece_key: "stale", created_at: ago(20 * HOUR).toISOString(), ...read, read_at: ago(13 * HOUR).toISOString() },
      { ...base, piece_key: "fresh", ...read, read_at: ago(1 * HOUR).toISOString() },
      { ...base, piece_key: "settled", ...read, read_at: ago(20 * HOUR).toISOString(), settled_at: ago(HOUR).toISOString() },
      { ...base, piece_key: "gone", read_error: "gone", attempts: 1 },
      { ...base, piece_key: "spent", read_error: "failed", attempts: 3, last_attempt_at: ago(HOUR).toISOString() },
      { ...base, piece_key: "retry-wait", read_error: "failed", attempts: 1, last_attempt_at: ago(5 * MINUTE).toISOString() },
      { ...base, piece_key: "retry", ...read, read_at: ago(13 * HOUR).toISOString(), read_error: "failed", attempts: 2, last_attempt_at: ago(11 * MINUTE).toISOString(), created_at: ago(HOUR).toISOString() },
      // Ruling 19a: a post never read whose first read failed is unread; only Try again reads it.
      { ...base, piece_key: "first-read-failed", read_error: "failed", attempts: 1, last_attempt_at: ago(5 * HOUR).toISOString() },
      // Ruling 14: a post with numbers whose reads failed three times is tried again after 12 hours.
      { ...base, piece_key: "spent-read", ...read, read_at: ago(30 * HOUR).toISOString(), read_error: "failed", attempts: 3, last_attempt_at: ago(12 * HOUR).toISOString(), created_at: ago(3 * HOUR).toISOString() },
      { ...base, piece_key: "spent-read-wait", ...read, read_at: ago(30 * HOUR).toISOString(), read_error: "failed", attempts: 3, last_attempt_at: ago(11 * HOUR).toISOString() },
      { ...base, piece_key: "gone-read", ...read, read_at: ago(30 * HOUR).toISOString(), read_error: "gone", attempts: 1 },
      { ...base, user_id: OTHER, piece_key: "theirs" },
    );
    const rows = await duePosts(db.client, USER, NOW);
    expect(rows.map((r) => r.piece_key)).toEqual(["stale", "spent-read", "never-read", "retry"]);
    expect(db.state.calls).toHaveLength(1);
    expect(db.state.calls[0]!.filters).toContainEqual({ op: "is", column: "settled_at", value: null });
    // The select leaves out gone posts only; `isDue` decides the rest.
    expect(db.state.calls[0]!.or).toEqual(["read_error.is.null,read_error.neq.gone"]);
    expectScopedTo(db.state.calls, USER);
  });
});

describe("claimPosts (rulings 18, 22 and 26)", () => {
  const base = { user_id: USER, piece_kind: "hooks", said_number: 60, said_measure: "stop", post_url: LINK };
  /** The rows as the reader last read them (copies: the stand-in's own change when written). */
  const rowsOf = (db: ReturnType<typeof fakeDb>, ...keys: string[]) =>
    keys.map((k) => structuredClone(db.state.rows.find((r) => r.piece_key === k)!) as unknown as PiecePostRow);
  const storedOf = (db: ReturnType<typeof fakeDb>, key: string) => db.state.rows.find((r) => r.piece_key === key)!;

  it("takes, in one statement, the caller's rows no read is on; marks them attempted now and not failed", async () => {
    const db = fakeDb();
    db.seed(
      { ...base, piece_key: "never" },
      { ...base, piece_key: "241s", last_attempt_at: ago(241_000).toISOString() },
      { ...base, piece_key: "240s", last_attempt_at: ago(240_000).toISOString() },
      { ...base, piece_key: "239s", last_attempt_at: ago(239_000).toISOString() },
      // A read that may still be waiting on the scraper (up to 180 s): not taken.
      { ...base, piece_key: "200s", last_attempt_at: ago(200_000).toISOString() },
      // Ended attempts, however recent: a failed one, and one that worked (read at or after it).
      { ...base, piece_key: "failed-10s", last_attempt_at: ago(10_000).toISOString(), read_error: "failed", attempts: 1 },
      { ...base, piece_key: "gone-1s", last_attempt_at: ago(1_000).toISOString(), read_error: "gone", attempts: 1 },
      { ...base, piece_key: "worked-10s", last_attempt_at: ago(10_000).toISOString(), read_at: ago(10_000).toISOString(), views: 5 },
      // In progress: attempted 10 seconds ago, not ended (its last good read is older than the attempt).
      { ...base, piece_key: "reading-10s", last_attempt_at: ago(10_000).toISOString(), read_at: ago(HOUR).toISOString(), views: 5 },
    );
    db.state.calls = [];
    const keys = ["never", "241s", "240s", "239s", "200s", "failed-10s", "gone-1s", "worked-10s", "reading-10s"];
    const got = await claimPosts(db.client, USER, rowsOf(db, ...keys), NOW);
    expect(got.map((r) => r.piece_key).sort()).toEqual(["240s", "241s", "failed-10s", "gone-1s", "never", "worked-10s"]);
    for (const r of got) {
      expect(Date.parse(r.last_attempt_at!)).toBe(NOW.getTime());
      expect(r.read_error).toBeNull();
    }
    // The attempts count is the read's to write.
    expect(storedOf(db, "failed-10s").attempts).toBe(1);
    for (const key of ["239s", "200s", "reading-10s"]) expect(Date.parse(String(storedOf(db, key).last_attempt_at))).not.toBe(NOW.getTime());
    expect(db.state.calls).toHaveLength(1);
    expect(db.state.calls[0]).toMatchObject({ action: "update", columns: PIECE_POST_SELECT });
    expectScopedTo(db.state.calls, USER);
  });

  it("is a compare-and-set: a row changed since it was read is not taken", async () => {
    const db = fakeDb();
    db.seed({ ...base, piece_key: "a" });
    const [seen] = rowsOf(db, "a");
    // Another run claims it first.
    expect(await claimPosts(db.client, USER, [seen!], NOW)).toHaveLength(1);
    expect(await claimPosts(db.client, USER, [seen!], new Date(NOW.getTime() + 241_000))).toEqual([]);
    // Read again: a claimed row is in progress for 240 seconds, then free.
    const [now] = rowsOf(db, "a");
    expect(await claimPosts(db.client, USER, [now!], new Date(NOW.getTime() + 200_000))).toEqual([]);
    expect(await claimPosts(db.client, USER, [now!], new Date(NOW.getTime() + 241_000))).toHaveLength(1);
  });

  it("every end of a read leaves the row free at once: a good read's time is at or after the claim", async () => {
    const db = fakeDb();
    db.seed({ ...base, piece_key: "a" }, { ...base, piece_key: "b" });
    const [a, b] = await claimPosts(db.client, USER, rowsOf(db, "a", "b"), NOW);
    const at = NOW.toISOString();
    await updatePost(db.client, USER, a!.id, { views: 1, likes: 0, comments: 0, shares: 0, saves: 0, read_at: at, attempts: 0, read_error: null, last_attempt_at: at }, NOW);
    await updatePost(db.client, USER, b!.id, { attempts: 1, read_error: "failed", last_attempt_at: at }, NOW);
    const soon = new Date(NOW.getTime() + 1_000);
    expect((await claimPosts(db.client, USER, rowsOf(db, "a", "b"), soon)).map((r) => r.piece_key).sort()).toEqual(["a", "b"]);
  });

  it("never takes another person's row, a removed one or a settled one", async () => {
    const db = fakeDb();
    db.seed(
      { ...base, user_id: OTHER, piece_key: "theirs" },
      { ...base, piece_key: "removed", removed_at: ago(HOUR).toISOString() },
      { ...base, piece_key: "settled", settled_at: ago(HOUR).toISOString() },
    );
    expect(await claimPosts(db.client, USER, rowsOf(db, "theirs", "removed", "settled"), NOW)).toEqual([]);
    expect(db.state.rows.every((r) => r.last_attempt_at === null)).toBe(true);
  });

  it("asks nothing for no rows, rows a read is on, or an id that is not one", async () => {
    const db = fakeDb();
    db.seed({ ...base, piece_key: "reading", last_attempt_at: ago(5_000).toISOString() });
    expect(await claimPosts(db.client, USER, [], NOW)).toEqual([]);
    expect(await claimPosts(db.client, USER, rowsOf(db, "reading"), NOW)).toEqual([]);
    expect(await claimPosts(db.client, USER, [{ ...rowsOf(db, "reading")[0]!, id: "not-an-id", last_attempt_at: null }], NOW)).toEqual([]);
    expect(db.state.calls).toHaveLength(0);
  });
});

describe("releasePosts (ruling 26)", () => {
  const base = { user_id: USER, piece_kind: "hooks", said_number: 60, said_measure: "stop", post_url: LINK };
  const rowsOf = (db: ReturnType<typeof fakeDb>, ...keys: string[]) =>
    keys.map((k) => structuredClone(db.state.rows.find((r) => r.piece_key === k)!) as unknown as PiecePostRow);
  const storedOf = (db: ReturnType<typeof fakeDb>, key: string) => db.state.rows.find((r) => r.piece_key === key)!;

  it("puts back the attempt time and the error a claim replaced, for rows that still hold that claim", async () => {
    const db = fakeDb();
    db.seed(
      { ...base, piece_key: "never" },
      { ...base, piece_key: "failed", read_error: "failed", attempts: 2, last_attempt_at: ago(HOUR).toISOString(), read_at: ago(13 * HOUR).toISOString(), views: 5 },
    );
    const before = rowsOf(db, "never", "failed");
    const got = await claimPosts(db.client, USER, before, NOW);
    expect(got).toHaveLength(2);
    db.state.calls = [];
    await releasePosts(db.client, USER, before, NOW);
    expect(storedOf(db, "never")).toMatchObject({ last_attempt_at: null, read_error: null });
    expect(storedOf(db, "failed")).toMatchObject({ read_error: "failed", attempts: 2 });
    expect(Date.parse(String(storedOf(db, "failed").last_attempt_at))).toBe(ago(HOUR).getTime());
    expect(db.state.calls.every((c) => c.action === "update")).toBe(true);
    expectScopedTo(db.state.calls, USER);
    for (const call of db.state.calls) {
      expect(call.filters).toEqual(
        expect.arrayContaining([
          { op: "eq", column: "last_attempt_at", value: NOW.toISOString() },
          { op: "is", column: "read_error", value: null },
        ]),
      );
    }
  });

  it("leaves a row that changed since the claim (another write ended or replaced it)", async () => {
    const db = fakeDb();
    db.seed({ ...base, piece_key: "a" }, { ...base, piece_key: "b" });
    const before = rowsOf(db, "a", "b");
    await claimPosts(db.client, USER, before, NOW);
    const later = new Date(NOW.getTime() + 5_000).toISOString();
    await updatePost(db.client, USER, String(storedOf(db, "a").id), { read_error: "failed", attempts: 1, last_attempt_at: NOW.toISOString() }, NOW);
    await updatePost(db.client, USER, String(storedOf(db, "b").id), { last_attempt_at: later }, NOW);
    await releasePosts(db.client, USER, before, NOW);
    expect(storedOf(db, "a")).toMatchObject({ read_error: "failed", attempts: 1 });
    expect(Date.parse(String(storedOf(db, "b").last_attempt_at))).toBe(Date.parse(later));
  });

  it("never touches another person's row, and asks nothing for none", async () => {
    const db = fakeDb();
    db.seed({ ...base, user_id: OTHER, piece_key: "theirs", last_attempt_at: NOW.toISOString() });
    const [theirs] = rowsOf(db, "theirs");
    await releasePosts(db.client, USER, [{ ...theirs!, last_attempt_at: null }], NOW);
    expect(Date.parse(String(storedOf(db, "theirs").last_attempt_at))).toBe(NOW.getTime());
    db.state.calls = [];
    await releasePosts(db.client, USER, [], NOW);
    expect(db.state.calls).toEqual([]);
  });
});

describe("postsOfHandle", () => {
  it("returns the caller's unsettled posts of one account", async () => {
    const db = fakeDb();
    const base = { user_id: USER, piece_kind: "hooks", said_number: 60, said_measure: "stop", post_url: LINK };
    db.seed(
      { ...base, piece_key: "a", handle: "nia.cooks" },
      { ...base, piece_key: "b", handle: "nia.cooks", settled_at: ago(HOUR).toISOString() },
      { ...base, piece_key: "c", handle: "sam.bakes" },
      { ...base, piece_key: "d", handle: null },
      { ...base, user_id: OTHER, piece_key: "e", handle: "nia.cooks" },
    );
    expect((await postsOfHandle(db.client, USER, "nia.cooks")).map((r) => r.piece_key)).toEqual(["a"]);
    expectScopedTo(db.state.calls, USER);
  });

  it("asks nothing for a handle that is not one", async () => {
    const db = fakeDb();
    expect(await postsOfHandle(db.client, USER, "Nia Cooks")).toEqual([]);
    expect(db.state.calls).toHaveLength(0);
  });
});

describe("updatePost", () => {
  it("writes the patch and the time, and returns the row", async () => {
    const db = fakeDb();
    const row = (await insertPost(db.client, USER, piece()))!;
    db.state.now = new Date(NOW.getTime() + HOUR);
    const later = new Date(NOW.getTime() + 2 * HOUR);
    const updated = await updatePost(db.client, USER, row.id, { views: 12_400, read_at: later.toISOString(), attempts: 0 }, later);
    expect(updated).toMatchObject({ views: 12_400, attempts: 0, read_at: "2026-11-24T14:00:00.000000+00:00", updated_at: "2026-11-24T14:00:00.000000+00:00" });
    expect(updated?.said_number).toBe(67);
    expectScopedTo(db.state.calls, USER);
  });

  it("never touches another person's row", async () => {
    const db = fakeDb();
    const theirs = (await insertPost(db.client, OTHER, piece()))!;
    expect(await updatePost(db.client, USER, theirs.id, { views: 1 }, NOW)).toBeNull();
    expect(db.state.rows[0]!.views).toBeNull();
  });

  it("asks nothing for an id that is not one", async () => {
    const db = fakeDb();
    expect(await updatePost(db.client, USER, "not-an-id", { views: 1 }, NOW)).toBeNull();
    expect(db.state.calls).toHaveLength(0);
  });
});

describe("removePost", () => {
  it("marks the caller's live row removed, keeps it, and says whether it found one", async () => {
    const db = fakeDb();
    const mine = (await insertPost(db.client, USER, piece()))!;
    const theirs = (await insertPost(db.client, OTHER, piece()))!;
    db.state.calls = [];
    const at = new Date(NOW.getTime() + HOUR);
    expect(await removePost(db.client, USER, theirs.id, at)).toBe(false);
    expect(await removePost(db.client, USER, mine.id, at)).toBe(true);
    expect(await removePost(db.client, USER, mine.id, new Date(at.getTime() + HOUR))).toBe(false); // already removed
    expect(db.state.rows.map((r) => [r.id, r.removed_at])).toEqual([
      [mine.id, "2026-11-24T13:00:00.000000+00:00"],
      [theirs.id, null],
    ]);
    expect(db.state.calls.every((c) => c.action === "update")).toBe(true);
    expectScopedTo(db.state.calls, USER);
    expect(await removePost(db.client, USER, "not-an-id", at)).toBe(false);
  });

  it("a removed row is found by none of the live lookups, and cannot be changed", async () => {
    const db = fakeDb();
    const row = (await insertPost(db.client, USER, piece()))!;
    await updatePost(db.client, USER, row.id, { handle: "nia.cooks" }, NOW);
    // Before the removal each lookup finds it, so the empty answers below are the removal's doing.
    expect(await postOfPiece(db.client, USER, { threadId: CHAT, pieceKey: "Ab3_k9-Zx0" })).not.toBeNull();
    expect(await postsOfThreads(db.client, USER, [CHAT])).toHaveLength(1);
    expect(await duePosts(db.client, USER, NOW)).toHaveLength(1);
    expect(await postsOfHandle(db.client, USER, "nia.cooks")).toHaveLength(1);

    expect(await removePost(db.client, USER, row.id, NOW)).toBe(true);
    db.state.calls = [];
    expect(await postOfPiece(db.client, USER, { threadId: CHAT, pieceKey: "Ab3_k9-Zx0" })).toBeNull();
    expect(await postsOfThreads(db.client, USER, [CHAT])).toEqual([]);
    expect(await duePosts(db.client, USER, NOW)).toEqual([]);
    expect(await postsOfHandle(db.client, USER, "nia.cooks")).toEqual([]);
    expect(await updatePost(db.client, USER, row.id, { views: 5 }, NOW)).toBeNull();
    expect(db.state.rows[0]!.views).toBeNull();
    expect(db.state.calls).toHaveLength(5);
    for (const call of db.state.calls) expect(call.filters).toContainEqual({ op: "is", column: "removed_at", value: null });
  });

  it("lets the piece be linked again once its post is removed", async () => {
    const db = fakeDb();
    const first = (await insertPost(db.client, USER, piece()))!;
    expect(await insertPost(db.client, USER, piece({ postUrl: "https://vm.tiktok.com/ZMmadeup2/" }))).toBeNull();
    await removePost(db.client, USER, first.id, NOW);
    const second = await insertPost(db.client, USER, piece({ postUrl: "https://vm.tiktok.com/ZMmadeup2/" }));
    expect(second).not.toBeNull();
    expect(second!.id).not.toBe(first.id);
    expect((await postOfPiece(db.client, USER, { threadId: CHAT, pieceKey: "Ab3_k9-Zx0" }))?.id).toBe(second!.id);
    expect(await insertPost(db.client, USER, piece())).toBeNull();
    expect(db.state.rows).toHaveLength(2);
  });
});

describe("linksInLastDay", () => {
  it("counts the caller's links of the last 24 hours", async () => {
    const db = fakeDb();
    const base = { piece_kind: "hooks", said_number: 60, said_measure: "stop", post_url: LINK };
    db.seed(
      { ...base, user_id: USER, piece_key: "a", created_at: ago(MINUTE).toISOString() },
      { ...base, user_id: USER, piece_key: "b", created_at: ago(24 * HOUR - 1).toISOString() },
      { ...base, user_id: USER, piece_key: "c", created_at: ago(24 * HOUR).toISOString() },
      { ...base, user_id: USER, piece_key: "d", created_at: ago(30 * HOUR).toISOString() },
      { ...base, user_id: OTHER, piece_key: "e", created_at: ago(MINUTE).toISOString() },
    );
    expect(await linksInLastDay(db.client, USER, NOW)).toBe(2);
    expect(db.state.calls[0]).toMatchObject({ count: "exact", head: true });
    expectScopedTo(db.state.calls, USER);
  });

  it("still counts a link once it is removed (ruling 5)", async () => {
    const db = fakeDb();
    const first = (await insertPost(db.client, USER, piece()))!;
    await removePost(db.client, USER, first.id, NOW);
    await insertPost(db.client, USER, piece({ postUrl: "https://vm.tiktok.com/ZMmadeup2/" }));
    expect(await linksInLastDay(db.client, USER, NOW)).toBe(2);
    expect(db.state.calls.at(-1)!.filters.map((f) => f.column)).not.toContain("removed_at");
  });

  it("throws when the count fails", async () => {
    const db = fakeDb();
    db.state.failNext = { code: "08006", message: "connection reset by peer" };
    await expect(linksInLastDay(db.client, USER, NOW)).rejects.toThrow("connection reset by peer");
  });
});

describe("appendRead", () => {
  const readAt = (i: number): PostedRead => ({
    at: new Date(NOW.getTime() + i * HOUR).toISOString(),
    views: i * 100,
    likes: i,
    comments: i,
    shares: i,
    saves: i,
  });

  it("adds the read last", () => {
    expect(appendRead([readAt(0)], readAt(1))).toEqual([readAt(0), readAt(1)]);
    expect(appendRead([], readAt(1))).toEqual([readAt(1)]);
  });

  it(`keeps the newest ${READS_KEPT}`, () => {
    const twelve = Array.from({ length: READS_KEPT }, (_, i) => readAt(i));
    const next = appendRead(twelve, readAt(12));
    expect(next).toHaveLength(READS_KEPT);
    expect(next[0]).toEqual(readAt(1));
    expect(next.at(-1)).toEqual(readAt(12));
  });

  it("keeps time order, newest last, whatever order the stored reads are in", () => {
    expect(appendRead([readAt(3), readAt(1)], readAt(2)).map((r) => r.views)).toEqual([100, 200, 300]);
  });

  it("drops what is not a read, and starts again from what is not a list", () => {
    expect(appendRead([readAt(0), { at: "never", views: 1 }, null, "x", { ...readAt(1), views: -1 }], readAt(2))).toEqual([readAt(0), readAt(2)]);
    expect(appendRead({ not: "a list" }, readAt(2))).toEqual([readAt(2)]);
    expect(appendRead(null, readAt(2))).toEqual([readAt(2)]);
  });
});
