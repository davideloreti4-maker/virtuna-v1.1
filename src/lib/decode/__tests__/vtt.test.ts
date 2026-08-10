import { describe, expect, it, vi } from "vitest";
import { parseVtt, fetchTranscript } from "@/lib/decode/vtt";

const SAMPLE = `WEBVTT

1
00:00:00.000 --> 00:00:03.000
So I made a huge mistake

2
00:00:03.000 --> 00:00:06.000
the last few months as a founder
`;

describe("parseVtt", () => {
  it("strips the header, cue numbers and timestamps into one line of speech", () => {
    expect(parseVtt(SAMPLE)).toBe("So I made a huge mistake the last few months as a founder");
  });

  it("strips inline markup", () => {
    expect(parseVtt("WEBVTT\n\n00:00.000 --> 00:01.000\n<c.white>hello</c> there")).toBe("hello there");
  });

  it("returns an empty string for a cue-less file", () => {
    expect(parseVtt("WEBVTT\n\n")).toBe("");
  });
});

describe("parseVtt — TikTok's JSON utterance format", () => {
  // Measured 2026-08-10 on @thefounderadvisor: `tiktokLink` served THIS, not WEBVTT. The old
  // line filter kept every line (no WEBVTT header, no '-->', no cue numbers), so 13,472 chars
  // of raw JSON went to the model as "Transcript:" — 5,401 prompt tokens of structured noise.
  const JSON_SUBS = JSON.stringify({
    utterances: [
      {
        text: "if you're a founder and you plan on raising capital",
        start_time: 400,
        end_time: 3400,
        words: null,
        text_size: 28,
        text_color: "#FFFFFFFF",
      },
      { text: "you will have a board of directors", start_time: 3400, end_time: 5200 },
    ],
  });

  it("extracts the spoken text and drops the styling metadata", () => {
    expect(parseVtt(JSON_SUBS)).toBe(
      "if you're a founder and you plan on raising capital you will have a board of directors",
    );
  });

  it("collapses to a fraction of the raw payload", () => {
    expect(parseVtt(JSON_SUBS).length).toBeLessThan(JSON_SUBS.length / 2);
  });

  it("returns an empty string for a JSON payload with no utterances", () => {
    expect(parseVtt(JSON.stringify({ utterances: [] }))).toBe("");
  });

  it("still parses WEBVTT — the two formats coexist across videos", () => {
    expect(parseVtt(SAMPLE)).toBe("So I made a huge mistake the last few months as a founder");
  });
});

describe("fetchTranscript", () => {
  it("returns parsed text on a 200", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, text: async () => SAMPLE });
    await expect(fetchTranscript("https://x/sub.vtt", { fetchFn: fetchFn as unknown as typeof fetch }))
      .resolves.toBe("So I made a huge mistake the last few months as a founder");
  });

  it("returns null on a non-200 rather than throwing (the caller escalates per D5)", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 403 });
    await expect(fetchTranscript("https://x/sub.vtt", { fetchFn: fetchFn as unknown as typeof fetch }))
      .resolves.toBeNull();
  });

  it("returns null when the network throws — a decode must never take down a request", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    await expect(fetchTranscript("https://x/sub.vtt", { fetchFn: fetchFn as unknown as typeof fetch }))
      .resolves.toBeNull();
  });

  it("returns null when the file parses to nothing", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, text: async () => "WEBVTT\n\n" });
    await expect(fetchTranscript("https://x/sub.vtt", { fetchFn: fetchFn as unknown as typeof fetch }))
      .resolves.toBeNull();
  });
});
