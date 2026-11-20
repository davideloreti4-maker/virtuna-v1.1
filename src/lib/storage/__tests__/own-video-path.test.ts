import { describe, expect, it } from "vitest";
import { ownsVideoPath } from "../own-video-path";

describe("ownsVideoPath", () => {
  it("accepts a file in the caller's own folder", () => {
    expect(ownsVideoPath("user-1/V1StGXR8_Z5jdHi6B-myT.mp4", "user-1")).toBe(true);
  });

  it("accepts the re-hosted link video in the caller's folder", () => {
    expect(ownsVideoPath("user-1/tiktok-7391234567890123456.mp4", "user-1")).toBe(true);
  });

  it("accepts an upload whose file had no extension, spaces included", () => {
    // The clients name an upload `<id>/<nanoid>.<what follows the file name's last dot>`.
    expect(ownsVideoPath("user-1/V1StGXR8_Z5jdHi6B-myT.final cut v2", "user-1")).toBe(true);
  });

  it.each([
    ["another account's folder", "user-2/abc.mp4"],
    ["a folder that only starts like the caller's", "user-12/abc.mp4"],
    ["a path that climbs out of the caller's folder", "user-1/../user-2/abc.mp4"],
    ["a path with a dot folder", "user-1/./abc.mp4"],
    ["an empty folder in the middle", "user-1//abc.mp4"],
    ["a leading slash", "/user-1/abc.mp4"],
    ["a bare folder", "user-1/"],
    ["the folder name alone", "user-1"],
    ["no folder at all", "abc.mp4"],
    ["an empty path", ""],
  ])("refuses %s", (_name, path) => {
    expect(ownsVideoPath(path, "user-1")).toBe(false);
  });

  // The path travels to storage inside a URL. A URL parser reads "%2e%2e" as "..", a
  // backslash as a slash, drops tabs and line breaks, and cuts the path at "?" and "#":
  // each of these would turn a path that starts in the caller's folder into a file elsewhere.
  it.each([
    ["an escaped ..", "user-1/%2e%2e/user-2/abc.mp4"],
    ["a half-escaped ..", "user-1/.%2E/user-2/abc.mp4"],
    ["an escaped slash", "user-1/..%2Fuser-2/abc.mp4"],
    ["a backslash climb", "user-1/..\\user-2/abc.mp4"],
    ["a backslash as the separator", "user-1\\..\\user-2\\abc.mp4"],
    ["a tab inside the dots", "user-1/.\t./user-2/abc.mp4"],
    ["a line break inside the dots", "user-1/.\n./user-2/abc.mp4"],
    ["a null byte", "user-1/abc.mp4\u0000"],
    ["a .. followed by a space (a URL trims its end)", "user-1/.. "],
    ["a .. padded with spaces", "user-1/ .. /user-2/abc.mp4"],
    ["a query", "user-1/abc.mp4?download=1"],
    ["a fragment", "user-1/abc.mp4#x"],
  ])("refuses %s, which a URL would rewrite", (_name, path) => {
    expect(ownsVideoPath(path, "user-1")).toBe(false);
  });

  it("refuses everything for a caller without an id", () => {
    expect(ownsVideoPath("/abc.mp4", "")).toBe(false);
  });

  it("refuses a path that is not a string", () => {
    expect(ownsVideoPath(["user-1/abc.mp4"] as unknown as string, "user-1")).toBe(false);
  });
});
