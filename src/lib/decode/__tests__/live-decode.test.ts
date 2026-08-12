import { describe, expect, it, vi } from "vitest";
import { decodeVideo } from "@/lib/decode/live-decode";

const GOOD = JSON.stringify({
  hookPattern: "Opens on an admission of failure",
  structure: "Hook 0-3s → context 3-12s → lesson 12-25s",
  theTurn: "The mistake is reframed as the advice",
  emotionalBeat: "Relief that someone said it out loud",
  spokenHook: "So I made a huge mistake",
});

const video = {
  platformVideoId: "1",
  caption: "founder lessons",
  views: 1893,
  likes: 118,
  durationSeconds: 19,
  subtitleUrl: "https://x/sub.vtt",
};

describe("decodeVideo", () => {
  it("decodes from the TRANSCRIPT when subtitles resolve", async () => {
    const complete = vi.fn().mockResolvedValue({ choices: [{ message: { content: GOOD } }] });
    const out = await decodeVideo(video, {
      complete,
      fetchTranscriptFn: async () => "So I made a huge mistake the last few months as a founder",
    });
    expect(out?.source).toBe("transcript");
    expect(out?.spokenHook).toBe("So I made a huge mistake");
    // The transcript must actually reach the model, or the decode is caption-only in disguise.
    expect(JSON.stringify(complete.mock.calls[0]?.[0])).toContain("huge mistake");
  });

  it("falls back to caption-only when there is no transcript (spec D5)", async () => {
    const complete = vi.fn().mockResolvedValue({ choices: [{ message: { content: GOOD } }] });
    const out = await decodeVideo(
      { ...video, subtitleUrl: undefined },
      { complete, fetchTranscriptFn: async () => null },
    );
    expect(out?.source).toBe("caption-only");
  });

  it("never lets a caption-only decode claim a spoken hook", async () => {
    const complete = vi.fn().mockResolvedValue({ choices: [{ message: { content: GOOD } }] });
    const out = await decodeVideo(
      { ...video, subtitleUrl: undefined },
      { complete, fetchTranscriptFn: async () => null },
    );
    // GOOD carries a spokenHook; with no transcript it is a fabrication and must be dropped.
    expect(out?.spokenHook).toBeNull();
  });

  it("repairs a `structure` returned as an ARRAY of steps instead of a string", async () => {
    // Measured 2026-08-10 on a real video: flash returned a 7-element array for `structure`
    // and a perfectly good decode was discarded over the container type alone.
    const arrayStructure = JSON.stringify({
      hookPattern: "Conditional Warning / Direct Address",
      structure: [
        "The creator establishes a specific audience.",
        "The creator introduces the three types of board member.",
      ],
      theTurn: "Mechanics give way to tactical advice",
      emotionalBeat: "Informative and cautionary",
      spokenHook: "if you're a founder",
    });
    const complete = vi
      .fn()
      .mockResolvedValue({ choices: [{ message: { content: arrayStructure } }] });
    const out = await decodeVideo(video, { complete, fetchTranscriptFn: async () => "words" });
    // Joined with the same arrow the SYSTEM example uses, so a repaired list and a compliant
    // string read identically downstream.
    expect(out?.structure).toBe(
      "The creator establishes a specific audience. → The creator introduces the three types of board member.",
    );
  });

  it("repairs a `structure` returned as a list of {step, description} objects", async () => {
    // The SECOND shape the same model produced for the same video, one run later.
    const objectSteps = JSON.stringify({
      hookPattern: "Conditional Warning",
      structure: [
        { step: "Premise Establishment", description: "The creator names the audience." },
        { step: "Categorization", description: "Three types of board member are named." },
      ],
      theTurn: "Mechanics give way to tactical advice",
      emotionalBeat: "Informative and cautionary",
      spokenHook: "if you're a founder",
    });
    const complete = vi.fn().mockResolvedValue({ choices: [{ message: { content: objectSteps } }] });
    const out = await decodeVideo(video, { complete, fetchTranscriptFn: async () => "words" });
    expect(out?.structure).toBe(
      "Premise Establishment: The creator names the audience. → " +
        "Categorization: Three types of board member are named.",
    );
  });

  it("still rejects a bare object — there is no unambiguous prose to recover", async () => {
    const bad = JSON.stringify({
      hookPattern: "x",
      structure: { step1: "a" },
      theTurn: "t",
      emotionalBeat: "e",
    });
    const complete = vi.fn().mockResolvedValue({ choices: [{ message: { content: bad } }] });
    const out = await decodeVideo(video, { complete, fetchTranscriptFn: async () => "words" });
    expect(out).toBeNull();
  });

  it("rejects a list carrying a non-string, non-object element", async () => {
    const bad = JSON.stringify({
      hookPattern: "x",
      structure: ["a", 42],
      theTurn: "t",
      emotionalBeat: "e",
    });
    const complete = vi.fn().mockResolvedValue({ choices: [{ message: { content: bad } }] });
    const out = await decodeVideo(video, { complete, fetchTranscriptFn: async () => "words" });
    expect(out).toBeNull();
  });

  it("returns null on unparseable model output rather than a half-filled decode", async () => {
    const complete = vi.fn().mockResolvedValue({ choices: [{ message: { content: "not json" } }] });
    const out = await decodeVideo(video, { complete, fetchTranscriptFn: async () => "words" });
    expect(out).toBeNull();
  });

  it("returns null when a required field is missing — never zero-fills a decode", async () => {
    const partial = JSON.stringify({ hookPattern: "x" });
    const complete = vi.fn().mockResolvedValue({ choices: [{ message: { content: partial } }] });
    const out = await decodeVideo(video, { complete, fetchTranscriptFn: async () => "words" });
    expect(out).toBeNull();
  });

  it("returns null when the model call throws — a decode never fails the request", async () => {
    const complete = vi.fn().mockRejectedValue(new Error("upstream 500"));
    const out = await decodeVideo(video, { complete, fetchTranscriptFn: async () => "words" });
    expect(out).toBeNull();
  });
});
