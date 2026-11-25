/**
 * agent-calls.test.ts — the style a first cut is asked in, read as the agent's route reads it, and the look key an edit keeps
 * of it (plan 2026-11-24-editor-screens-a, Task 5). The calls themselves are proved through the routes that make them: the
 * agent's route (`agent-route.test.ts`, unchanged) and the editor's turns (Task 7).
 */
import { describe, expect, it } from "vitest";
import { presetOf } from "@/lib/edit/style/presets";
import { lookKeyOf, styleOf } from "../agent-calls";

const read = async (given: unknown) => {
  const styled = styleOf(given);
  return styled instanceof Response ? { status: styled.status, ...(await styled.json()) } : styled;
};

describe("styleOf", () => {
  it("reads none as the house style, a preset by its id, words, and a profile as it is", async () => {
    expect(await read(undefined)).toEqual({ from: "house" });
    expect(await read(null)).toEqual({ from: "house" });
    expect(await read({ preset: "clean" })).toEqual({ from: "profile", profile: presetOf("clean")!.profile });
    expect(await read({ words: "  calm, small type  " })).toEqual({ from: "words", words: "calm, small type" });
    expect(await read(presetOf("mono")!.profile)).toEqual({ from: "profile", profile: presetOf("mono")!.profile });
  });

  it("refuses an unknown preset, blank or long words, and what is no profile, in the route's words", async () => {
    expect(await read({ preset: "nope" })).toEqual({ status: 400, error: "There is no preset of that name." });
    expect(await read({ words: "  " })).toEqual({ status: 400, error: "Say in a few words what style you want." });
    expect(await read({ words: "x".repeat(301) })).toEqual({ status: 400, error: "A style in words is at most 300 characters." });
    expect(await read({ look: "warm" })).toEqual({ status: 400, error: "This style could not be read." });
  });
});

describe("lookKeyOf", () => {
  it("keeps the look an edit was cut in: house, a preset's id, words, or a video's style", () => {
    expect(lookKeyOf(undefined, { from: "house" })).toBe("house");
    expect(lookKeyOf({ preset: "clean" }, { from: "profile", profile: presetOf("clean")!.profile })).toBe("clean");
    expect(lookKeyOf({ words: "calm" }, { from: "words", words: "calm" })).toBe("words");
    const video = { ...presetOf("clean")!.profile, source: { kind: "reference" as const, name: null } };
    expect(lookKeyOf(video, { from: "profile", profile: video })).toBe("video");
  });
});
