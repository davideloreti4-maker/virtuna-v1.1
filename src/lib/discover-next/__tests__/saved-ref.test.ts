/**
 * A video saved from Discover: its ref, how Library tells
 * a library video's row from the others, and the row Save writes. Pure.
 */
import { describe, expect, it } from "vitest";

import type { SavedItem } from "@/lib/shelf/shelf-repo";

import { isLibraryVideoRef, libraryVideoIdOf, pulledVideoRef, pulledVideoSaveOf, videoSaveOf } from "../saved-ref";

const ID = "4a5b0c1d-2e3f-4a5b-8c9d-0e1f2a3b4c5d";

function item(over: Partial<SavedItem> = {}): SavedItem {
  return {
    id: "row-1",
    user_id: "user-1",
    item_type: "outlier",
    ref_id: ID,
    thread_id: null,
    project_id: null,
    title: "Watch this before you cook",
    snapshot: {},
    created_at: "2026-11-25T10:00:00Z",
    ...over,
  };
}

const video = {
  id: ID,
  spokenHook: "  Watch this   before you cook ",
  videoUrl: "https://www.tiktok.com/@jay.makes/video/1",
  coverUrl: "https://example.supabase.co/storage/v1/object/public/covers/1.jpg",
  views: 120_000,
  multiplier: 6,
  baselineLabel: "vs their usual views",
  handle: "jay.makes",
  platform: "tiktok",
};

describe("isLibraryVideoRef: the UUID form", () => {
  it("a UUID, any case", () => {
    expect(isLibraryVideoRef(ID)).toBe(true);
    expect(isLibraryVideoRef(ID.toUpperCase())).toBe(true);
  });

  it.each(["tiktok:7300000000000000001", "pv-1", "", `${ID}x`, ` ${ID}`, "4a5b0c1d2e3f4a5b8c9d0e1f2a3b4c5d", null, undefined])("not %j", (ref) => {
    expect(isLibraryVideoRef(ref)).toBe(false);
  });
});

describe("pulledVideoRef", () => {
  it("is tiktok:<id>", () => {
    expect(pulledVideoRef("7300000000000000001")).toBe("tiktok:7300000000000000001");
  });
});

describe("libraryVideoIdOf", () => {
  it("a saved video with a library video's ref and no chat: its id", () => {
    expect(libraryVideoIdOf(item())).toBe(ID);
  });

  it("a pulled video's tiktok: ref: none (it opens its original)", () => {
    expect(libraryVideoIdOf(item({ ref_id: "tiktok:7300000000000000001" }))).toBeNull();
  });

  it("a video saved in a chat: none (it opens its chat)", () => {
    expect(libraryVideoIdOf(item({ thread_id: "5b6c1d2e-3f4a-4b5c-9d0e-1f2a3b4c5d6e" }))).toBeNull();
  });

  it("a hook, even with a UUID ref: none", () => {
    expect(libraryVideoIdOf(item({ item_type: "hook" }))).toBeNull();
    expect(libraryVideoIdOf(item({ item_type: "read" }))).toBeNull();
  });

  it("no ref: none", () => {
    expect(libraryVideoIdOf(item({ ref_id: null }))).toBeNull();
  });
});

describe("the row Save writes", () => {
  it("a library video: its id as the ref, its card line as the title, and the snapshot Library reads", () => {
    expect(videoSaveOf(video)).toEqual({
      refId: ID,
      title: "Watch this before you cook",
      snapshot: {
        caption: "Watch this before you cook",
        videoUrl: "https://www.tiktok.com/@jay.makes/video/1",
        coverUrl: "https://example.supabase.co/storage/v1/object/public/covers/1.jpg",
        views: 120_000,
        multiplier: 6,
        baselineLabel: "vs their usual views",
        handle: "jay.makes",
        platform: "tiktok",
      },
    });
  });

  it("a video with no line: no title and an empty caption", () => {
    const save = videoSaveOf({ ...video, spokenHook: "[Product] changed my life" });
    expect(save.title).toBeNull();
    expect(save.snapshot.caption).toBe("");
  });

  it("a title longer than the shelf takes (200) is cut at whole characters; the caption keeps the line", () => {
    const line = `${"a".repeat(199)}😀 and more words after the cut`;
    const save = videoSaveOf({ ...video, spokenHook: line });
    expect(save.title).toBe("a".repeat(199));
    expect(save.snapshot.caption).toBe(line);
    const long = videoSaveOf({ ...video, spokenHook: "word ".repeat(60) });
    expect(long.title!.length).toBeLessThanOrEqual(200);
    expect(long.title!.endsWith(" ")).toBe(false);
  });

  it("the row reads back as a library video's", () => {
    const save = videoSaveOf(video);
    expect(libraryVideoIdOf(item({ ref_id: save.refId, title: save.title, snapshot: save.snapshot }))).toBe(ID);
  });

  it("a pulled video: the same with tiktok:<id> as the ref, which Library does not open as a page", () => {
    const pulled = { ...video, id: "7300000000000000001" };
    const save = pulledVideoSaveOf(pulled);
    expect(save).toEqual({ ...videoSaveOf(pulled), refId: "tiktok:7300000000000000001" });
    expect(libraryVideoIdOf(item({ ref_id: save.refId }))).toBeNull();
  });

  it("a pulled video's caption is its title as written: the spoken line's placeholder rules do not apply", () => {
    const save = pulledVideoSaveOf({ ...video, id: "7300000000000000002", spokenHook: "[part 2] the reveal", captioned: true });
    expect(save.title).toBe("[part 2] the reveal");
    expect(save.snapshot.caption).toBe("[part 2] the reveal");
  });
});
