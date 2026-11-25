import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { READ_SECONDS, UPLOAD_SECONDS, bucket, folderOf, isUnder, listedUnder, objectsUnder, removeObject, signGet, signPut, sizeOf, takeKey } from "../r2";
import { TAKE, USER, keyOf } from "./rows";
import { BUCKET, ENV, R2_ACCOUNT, standIns } from "./stand-ins";

const HOST = `${R2_ACCOUNT}.eu.r2.cloudflarestorage.com`;

describe("R2 for the app (X43)", () => {
  let world: ReturnType<typeof standIns>;
  beforeEach(() => {
    world = standIns();
    vi.stubGlobal("fetch", world.fetch);
    for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("keeps a take under its creator", () => {
    expect(takeKey(USER, TAKE, "source")).toBe(keyOf("source"));
    expect(bucket()).toBe(BUCKET);
  });

  it("signs a read of two hours at the bucket's EU address, by path", async () => {
    const url = new URL(await signGet(keyOf("preview.mp4")));
    expect(url.origin).toBe(`https://${HOST}`);
    expect(url.pathname).toBe(`/${BUCKET}/${keyOf("preview.mp4")}`);
    expect(READ_SECONDS).toBe(7200);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("7200");
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-Credential")).toMatch(/^key-id\/\d{8}\/auto\/s3\/aws4_request$/);
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(url.searchParams.has("response-content-disposition")).toBe(false);
    expect(url.href).not.toContain(ENV.R2_SECRET_ACCESS_KEY);
  });

  it("signs a read that a browser saves as a file, under the name given", async () => {
    const url = new URL(await signGet(`u/${USER}/films/job.mp4`, "film.mp4"));
    expect(url.searchParams.get("response-content-disposition")).toBe('attachment; filename="film.mp4"');
  });

  it("signs an upload for an hour, a PUT and not a read", async () => {
    const put = new URL(await signPut(keyOf("source"), 4_893_635, "video/mp4"));
    const get = new URL(await signGet(keyOf("source")));
    expect(UPLOAD_SECONDS).toBe(3600);
    expect(put.searchParams.get("X-Amz-Expires")).toBe("3600");
    expect(put.pathname).toBe(get.pathname);
    expect(put.searchParams.get("X-Amz-Signature")).not.toBe(get.searchParams.get("X-Amz-Signature"));
  });

  it("binds an upload to its size and type: both are signed into its address (I1)", async () => {
    const put = (bytes: number, type: string) => signPut(keyOf("source"), bytes, type).then((url) => new URL(url).searchParams);
    const signed = await put(4_893_635, "video/mp4");
    expect(signed.get("X-Amz-SignedHeaders")).toBe("content-length;content-type;host");
    expect((await put(4_893_636, "video/mp4")).get("X-Amz-Signature")).not.toBe(signed.get("X-Amz-Signature"));
    expect((await put(4_893_635, "video/quicktime")).get("X-Amz-Signature")).not.toBe(signed.get("X-Amz-Signature"));
    expect(signed.has("content-length")).toBe(false); // signed as headers the browser sends, not put in the address
  });

  it("tells a key inside a creator's folder from one outside it", () => {
    expect(folderOf(USER, { take: TAKE })).toBe(`u/${USER}/takes/${TAKE}/`);
    expect(folderOf(USER, "films")).toBe(`u/${USER}/films/`);
    expect(isUnder(keyOf("preview.mp4"), folderOf(USER, { take: TAKE }))).toBe(true);
    expect(isUnder(`u/${USER}/films/job.mp4`, folderOf(USER, "films"))).toBe(true);
    for (const key of [`u/${USER}/films/`, `u/${USER}/films/../takes/x`, `u/${USER}/films//x`, `u/${USER}/films/./x`, `u/${USER}/films/a\\b`, `u/other/films/x`, `u/${USER}/filmsx/y`]) {
      expect(isUnder(key, folderOf(USER, "films"))).toBe(false);
    }
  });

  it("asks the bucket with a HEAD how much of an object is stored", async () => {
    world.bucket.objects.set(keyOf("source"), 4_893_635);
    expect(await sizeOf(keyOf("source"))).toBe(4_893_635);
    expect(await sizeOf(keyOf("nothing"))).toBeNull();
  });

  it("fails loudly when the bucket refuses", async () => {
    world.bucket.failWith = 403;
    await expect(sizeOf(keyOf("source"))).rejects.toThrow("R2 answered 403 to a HEAD");
  });

  it("fails fast without its settings", async () => {
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "");
    await expect(signGet(keyOf("source"))).rejects.toThrow("R2_SECRET_ACCESS_KEY is not set");
  });
});

describe("R2 for a reference's drop (part 3, Task 11, X96)", () => {
  let world: ReturnType<typeof standIns>;
  /** The lists asked of the bucket, by their query. */
  let lists: URLSearchParams[];
  beforeEach(() => {
    world = standIns();
    lists = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.searchParams.get("list-type") === "2") lists.push(url.searchParams);
      return world.fetch(input, init);
    });
    for (const [name, value] of Object.entries(ENV)) vi.stubEnv(name, value);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  const folder = folderOf(USER, { take: TAKE });

  it("lists every key under a folder and none outside it, page after page", async () => {
    for (const name of ["source", "full.mp4", "preview.mp4", "poster.jpg", "a & b.txt"]) world.bucket.objects.set(keyOf(name), 1);
    world.bucket.objects.set(keyOf("source", "44444444-4444-4444-8444-444444444444"), 1); // another take's
    world.bucket.objects.set(`u/${USER}/takes/${TAKE}x/source`, 1); // a folder whose name only starts the same
    world.bucket.pageSize = 2;
    expect((await objectsUnder(folder)).sort()).toEqual(["a & b.txt", "full.mp4", "poster.jpg", "preview.mp4", "source"].map((name) => keyOf(name)).sort());
    const sorted = [...world.bucket.objects.keys()].filter((key) => key.startsWith(folder)).sort();
    expect(lists.map((query) => [query.get("prefix"), query.get("continuation-token")])).toEqual([[folder, null], [folder, sorted[1]], [folder, sorted[3]]]);
    expect(await objectsUnder(folderOf(USER, { take: "55555555-5555-4555-8555-555555555555" }))).toEqual([]);
  });

  it("lists at most so many objects with when each was written, from just after a key, page after page", async () => {
    const takes = `u/${USER}/takes/`;
    for (const id of ["a", "b", "c", "d", "e"]) world.bucket.objects.set(`${takes}${id}/source`, 1);
    world.bucket.modified.set(`${takes}b/source`, new Date("2026-11-20T10:00:00.000Z"));
    world.bucket.pageSize = 2;
    const listed = await listedUnder(takes, { most: 3, after: `${takes}a/source` });
    expect(listed.map((each) => each.key)).toEqual([`${takes}b/source`, `${takes}c/source`, `${takes}d/source`]);
    expect(listed[0]!.modified).toBe(Date.parse("2026-11-20T10:00:00.000Z"));
    expect(listed[1]!.modified).toBeGreaterThan(Date.now() - 60_000);
    expect(lists.map((query) => [query.get("start-after"), query.get("continuation-token"), query.get("max-keys")])).toEqual([[`${takes}a/source`, null, "3"], [null, `${takes}c/source`, "1"]]);
    expect((await listedUnder(takes, { most: 10 })).map((each) => each.key)).toHaveLength(5);
  });

  it("refuses a prefix that is no folder, and says what R2 answered to a list it refused", async () => {
    await expect(objectsUnder(`u/${USER}/takes/${TAKE}`)).rejects.toThrow("is not a folder");
    expect(lists).toEqual([]);
    world.bucket.failList = 403;
    await expect(objectsUnder(folder)).rejects.toThrow(`R2 answered 403 to a list of ${folder}`);
  });

  it("deletes an object, takes one that is not there as gone, and says what R2 answered to a delete it refused", async () => {
    world.bucket.objects.set(keyOf("source"), 1);
    world.bucket.objects.set(keyOf("full.mp4"), 1);
    await removeObject(keyOf("source"));
    expect([...world.bucket.objects.keys()]).toEqual([keyOf("full.mp4")]);
    await removeObject(keyOf("source")); // gone already: S3 answers 204
    world.bucket.failDelete = 404;
    await removeObject(keyOf("source"));
    world.bucket.failDelete = 403;
    await expect(removeObject(keyOf("full.mp4"))).rejects.toThrow(`R2 answered 403 to a delete of ${keyOf("full.mp4")}`);
    expect(world.bucket.objects.has(keyOf("full.mp4"))).toBe(true);
  });
});
