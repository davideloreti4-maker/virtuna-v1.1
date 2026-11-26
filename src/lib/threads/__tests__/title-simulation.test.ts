/**
 * title-simulation.test.ts — a simulation's chat gets a name the creator knows it by.
 *
 * Live check 2026-11-26: a simulation started from a new chat had `title: null` in /api/threads/list.
 * Its only user turn is the dropped file's name ("test-pack.mp4"), which `cleanThreadTitle` refuses
 * on purpose (a file name says nothing about a chat), so the drawer showed it as "New chat", like a
 * blank one. For a simulation the video IS the subject: its name without the extension, or for a link
 * the post's author. Typed text still wins; a bare id or link never becomes a name.
 */
import { describe, expect, it } from "vitest";
import { isSimulationTurn, simulationChatTitle, videoNameTitle } from "@/lib/threads/title";

describe("videoNameTitle", () => {
  it.each([
    ["test-pack.mp4", "test-pack"],
    ["TikTok Video Downloader (1).mp4", "TikTok Video Downloader (1)"],
    ["my_first_cook.MOV", "my first cook"],
  ])("%s → %s", (raw, want) => {
    expect(videoNameTitle(raw)).toBe(want);
  });

  it.each([["https://www.tiktok.com/@c/video/1"], ["what should I post?"], [""], ["a1b2c3.mp4x"], [42]])(
    "not a video file name (%s): null",
    (raw) => {
      expect(videoNameTitle(raw)).toBeNull();
    },
  );
});

describe("simulationChatTitle", () => {
  it("typed text wins", () => {
    expect(simulationChatTitle({ userTurn: "Will my cooking video work?", handle: "chef" })).toBe("Will my cooking video work?");
  });

  it("a dropped video: its name without the extension", () => {
    expect(simulationChatTitle({ userTurn: "test-pack.mp4", handle: null })).toBe("test-pack");
  });

  it("a link: the post's author", () => {
    expect(simulationChatTitle({ userTurn: "https://www.tiktok.com/@chef/video/1", handle: "@chef" })).toBe("Video by @chef");
  });

  it("nothing to name it by (a bare link, no author): null, never an id", () => {
    expect(simulationChatTitle({ userTurn: "https://www.tiktok.com/@chef/video/1", handle: null })).toBeNull();
    expect(simulationChatTitle({ userTurn: null, handle: null })).toBeNull();
  });
});

describe("isSimulationTurn", () => {
  it.each([["take.mp4"], ["My Clip (1).MOV"], ["https://www.tiktok.com/@c/video/1"], ["https://vm.tiktok.com/ZMabc/"]])(
    "%s: a simulation's turn",
    (t) => {
      expect(isSimulationTurn(t)).toBe(true);
    },
  );
  it.each([["hooks about meal prep"], ["what about https://www.tiktok.com/@c/video/1 ?"], ["notes.pdf"], [""], [null]])(
    "%s: not one",
    (t) => {
      expect(isSimulationTurn(t)).toBe(false);
    },
  );
});
