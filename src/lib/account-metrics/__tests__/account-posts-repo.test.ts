/**
 * account-posts-repo.test.ts — upsertAccountPosts stores each post's cover as OUR rehosted URL.
 *
 * The database and the storage bucket are I/O this suite cannot run, so both are stood in at the
 * client boundary (the query builder / storage.from); the rehost helper and the repo run for real.
 * What is pinned: covers are rehosted and written as cover_url; a post whose cover is already
 * stored is not fetched again; a failed rehost never writes null over a stored cover (the row goes
 * in the batch that omits cover_url); a write error is logged, not thrown.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { VideoData } from "@/lib/scraping/types";
import { listAllPosts, upsertAccountPosts } from "../account-posts-repo";

const ALLOWED = (id: string) => `https://p16-sign.tiktokcdn-us.com/obj/${id}.jpeg?x-expires=1`;
const PUBLIC = (path: string) => `https://proj.supabase.co/storage/v1/object/public/covers/${path}`;

function video(id: string, over: Partial<VideoData> = {}): VideoData {
  return {
    platformVideoId: id,
    caption: `caption ${id}`,
    views: 100,
    likes: 1,
    comments: 0,
    shares: 0,
    saves: 0,
    hashtags: [],
    coverUrl: ALLOWED(id),
    ...over,
  } as VideoData;
}

/** A stand-in for the account_posts table: answers the existing-covers read, records upserts. */
function makeDb(opts: { stored?: string[]; upsertError?: string; readError?: string } = {}) {
  const upserts: Array<Record<string, unknown>[]> = [];
  const reads: Array<{ ins: string[] }> = [];
  const db = {
    from(table: string) {
      expect(table).toBe("account_posts");
      const read = { ins: [] as string[] };
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: (_col: string, ids: string[]) => {
          read.ins = ids;
          return builder;
        },
        not: () => {
          reads.push(read);
          return Promise.resolve(
            opts.readError
              ? { data: null, error: { message: opts.readError } }
              : { data: (opts.stored ?? []).filter((id) => read.ins.includes(id)).map((post_id) => ({ post_id })), error: null },
          );
        },
        upsert: (rows: Record<string, unknown>[]) => {
          upserts.push(rows);
          return Promise.resolve({ error: opts.upsertError ? { message: opts.upsertError } : null });
        },
      };
      return builder;
    },
  };
  return { db: db as unknown as SupabaseClient, upserts, reads };
}

function makeStorage() {
  const uploads: string[] = [];
  const storage = {
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string) => {
          uploads.push(`${bucket}/${path}`);
          return { error: null };
        },
        getPublicUrl: (path: string) => ({ data: { publicUrl: PUBLIC(path) } }),
      }),
    },
  };
  return { storage: storage as unknown as SupabaseClient, uploads };
}

function imageResponse() {
  return { ok: true, headers: { get: () => "image/jpeg" }, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer } as unknown as Response;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("upsertAccountPosts — covers", () => {
  it("rehosts each cover and writes OUR url as cover_url", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(imageResponse());
    const { db, upserts } = makeDb();
    const { storage, uploads } = makeStorage();
    await upsertAccountPosts(db, "acc-1", "u-1", "tiktok", "@Nia", [video("a"), video("b")], { storage });
    expect(uploads.sort()).toEqual(["covers/account/tiktok/a.jpg", "covers/account/tiktok/b.jpg"]);
    const rows = upserts.flat();
    expect(rows.map((r) => [r.post_id, r.cover_url])).toEqual([
      ["a", PUBLIC("account/tiktok/a.jpg")],
      ["b", PUBLIC("account/tiktok/b.jpg")],
    ]);
    expect(rows.every((r) => r.handle === "nia" && r.account_id === "acc-1")).toBe(true);
  });

  it("does not fetch a cover already stored, and leaves cover_url out of that row (the stored one stays)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(imageResponse());
    const { db, upserts } = makeDb({ stored: ["a"] });
    const { storage } = makeStorage();
    await upsertAccountPosts(db, "acc-1", "u-1", "tiktok", "nia", [video("a"), video("b")], { storage });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const a = upserts.flat().find((r) => r.post_id === "a")!;
    expect(a).not.toHaveProperty("cover_url");
    expect(upserts.flat().find((r) => r.post_id === "b")!.cover_url).toBe(PUBLIC("account/tiktok/b.jpg"));
  });

  it("a failed rehost (non-OK fetch) or no cover: the row still goes in, without cover_url — never a raw CDN url, never null over a stored one", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 403, headers: { get: () => null } } as unknown as Response);
    const { db, upserts } = makeDb();
    const { storage } = makeStorage();
    await upsertAccountPosts(db, "acc-1", "u-1", "tiktok", "nia", [video("a"), video("b", { coverUrl: undefined })], { storage });
    const rows = upserts.flat();
    expect(rows.map((r) => r.post_id)).toEqual(["a", "b"]);
    expect(rows.some((r) => "cover_url" in r)).toBe(false);
    expect(JSON.stringify(rows)).not.toContain("tiktokcdn");
  });

  it("storage: null skips the rehost entirely (posts still stored)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { db, upserts, reads } = makeDb();
    await upsertAccountPosts(db, "acc-1", "u-1", "tiktok", "nia", [video("a")], { storage: null });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(reads).toHaveLength(0);
    expect(upserts.flat().map((r) => r.post_id)).toEqual(["a"]);
  });

  it("a write error is returned by supabase-js, logged, not thrown", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(imageResponse());
    const { db } = makeDb({ upsertError: "violates check constraint" });
    const { storage } = makeStorage();
    await expect(upsertAccountPosts(db, "acc-1", "u-1", "tiktok", "nia", [video("a")], { storage })).resolves.toBeUndefined();
  });
});

describe("listAllPosts — cover_url", () => {
  it("reads cover_url (null when the column holds none)", async () => {
    const rows = [
      { post_id: "a", caption: "", views: 1, cover_url: PUBLIC("account/tiktok/a.jpg") },
      { post_id: "b", caption: "", views: 1, cover_url: null },
    ];
    let selected = "";
    const builder = {
      select: (cols: string) => ((selected = cols), builder),
      eq: () => builder,
      order: () => builder,
      limit: async () => ({ data: rows, error: null }),
    };
    const db = { from: () => builder } as unknown as SupabaseClient;
    const out = await listAllPosts(db, "acc-1");
    expect(selected).toContain("cover_url");
    expect(out.map((p) => p.cover_url)).toEqual([PUBLIC("account/tiktok/a.jpg"), null]);
  });
});
