import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { ReadStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/** Every file stream the route opens, so a test can see that one was let go of. Nothing about the file system is changed. */
const opened: ReadStream[] = [];
vi.mock("node:fs", async (original) => {
  const fs = await original<typeof import("node:fs")>();
  return { ...fs, createReadStream: (...args: Parameters<typeof fs.createReadStream>) => (opened.push(fs.createReadStream(...args)), opened[opened.length - 1]!) };
});

const { GET } = await import("../[...path]/route");

/** A folder standing in for the worktree, with one clip of known bytes in its `.scratch/media/`. */
const root = mkdtempSync(join(tmpdir(), "dev-edit-media-"));
const bytes = Buffer.from(Array.from({ length: 300_000 }, (_, i) => (i * 31 + (i >> 8)) % 251));
const get = (path: string[], range?: string) => GET(new Request("http://127.0.0.1/api/dev-edit/media/x", range ? { headers: { range } } : undefined), { params: Promise.resolve({ path }) });
const body = async (response: Response) => Buffer.from(await response.arrayBuffer());

beforeAll(() => {
  mkdirSync(join(root, ".scratch", "media"), { recursive: true });
  writeFileSync(join(root, ".scratch", "media", "clip.mp4"), bytes);
  writeFileSync(join(root, ".scratch", "media", "notes.txt"), "not a media file");
  writeFileSync(join(root, "secret.mp4"), "outside the media folder");
  vi.spyOn(process, "cwd").mockReturnValue(root);
});
afterAll(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe("the dev page's media route", () => {
  it("gives a whole file, saying how long it is and that it takes byte ranges", async () => {
    const response = await get(["clip.mp4"]);
    expect([response.status, response.headers.get("content-length"), response.headers.get("accept-ranges"), response.headers.get("content-type")]).toEqual([200, "300000", "bytes", "video/mp4"]);
    expect((await body(response)).equals(bytes)).toBe(true);
  });

  it("gives exactly the bytes a range asks for: from a place on, between two places, and the last so many", async () => {
    for (const [range, from, to] of [["bytes=1000-", 1000, 299_999], ["bytes=70000-70999", 70_000, 70_999], ["bytes=-500", 299_500, 299_999], ["bytes=299000-999999", 299_000, 299_999]] as const) {
      const response = await get(["clip.mp4"], range);
      expect([response.status, response.headers.get("content-range"), response.headers.get("content-length")], range).toEqual([206, `bytes ${from}-${to}/300000`, String(to - from + 1)]);
      expect((await body(response)).equals(bytes.subarray(from, to + 1)), range).toBe(true);
    }
  });

  it("refuses a range that starts past the end of the file", async () => {
    const response = await get(["clip.mp4"], "bytes=300000-");
    expect([response.status, response.headers.get("content-range")]).toEqual([416, "bytes */300000"]);
  });

  it("serves nothing outside the media folder, nothing that is not media, and nothing that is not there", async () => {
    for (const path of [["..", "..", "secret.mp4"], ["notes.txt"], ["missing.mp4"], [".."]]) expect((await get(path)).status, path.join("/")).toBe(404);
  });

  it("lets go of the file when the reader stops early, as a player does after the part it wanted", async () => {
    const before = opened.length;
    const reader = (await get(["clip.mp4"], "bytes=0-")).body!.getReader();
    expect((await reader.read()).done).toBe(false);
    await reader.cancel();
    await new Promise((done) => setTimeout(done, 50));
    expect(opened.length).toBe(before + 1);
    expect(opened[before]!.destroyed).toBe(true);
  });

  it("answers 404 in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await get(["clip.mp4"])).status).toBe(404);
    vi.unstubAllEnvs();
  });
});
