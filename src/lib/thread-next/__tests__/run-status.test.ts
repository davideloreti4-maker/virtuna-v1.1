import { describe, expect, it } from "vitest";
import { USUAL_S, outlineOf, statusWords, usualNote } from "@/lib/thread-next/run-status";

const active = (name: string) => ({ name, status: "active" });
const done = (name: string) => ({ name, status: "done" });
const pending = (name: string) => ({ name, status: "pending" });

describe("statusWords: the thread feel §4.2 table", () => {
  it.each([
    ["hooks", "Writing hooks"],
    ["ideas", "Finding ideas"],
    ["script", "Writing your script"],
    ["remix", "Reworking the video"],
    ["explore", "Scanning for outliers"],
    ["account", "Reading your account"],
  ])("%s, no stage yet: %s", (skill, words) => {
    expect(statusWords(skill, [])).toBe(words);
  });

  it.each([
    ["hooks", "Finding proven outliers", "Looking for videos on this topic"],
    ["hooks", "Generating", "Writing hooks"],
    ["ideas", "Finding proven outliers", "Looking for videos on this topic"],
    ["ideas", "Generating", "Finding ideas"],
    ["script", "Finding proven outliers", "Looking for videos on this topic"],
    ["script", "Generating", "Writing your script"],
    ["remix", "Resolving", "Getting the video"],
    ["remix", "Decoding", "Working out why it worked"],
    ["remix", "Adapting", "Reworking it for your audience"],
    ["explore", "Pulling outliers", "Finding videos"],
    ["explore", "Scoring for your audience", "Checking them against your audience"],
  ])("%s at %s: %s", (skill, stage, words) => {
    expect(statusWords(skill, [active(stage)])).toBe(words);
    // A finished stage still speaks while the next has not started.
    expect(statusWords(skill, [done(stage)])).toBe(words);
  });

  it("the last stage that has started and has words wins, in order", () => {
    expect(statusWords("hooks", [done("Finding proven outliers"), active("Generating")])).toBe("Writing hooks");
    expect(statusWords("remix", [done("Resolving"), done("Decoding"), active("Adapting")])).toBe("Reworking it for your audience");
    // A stage not started yet does not speak.
    expect(statusWords("hooks", [active("Finding proven outliers"), pending("Generating")])).toBe("Looking for videos on this topic");
  });

  it("\"Ranking\" has no words: it keeps \"Writing hooks\"", () => {
    expect(statusWords("hooks", [done("Finding proven outliers"), done("Generating"), active("Ranking")])).toBe("Writing hooks");
    expect(statusWords("ideas", [done("Generating"), done("Ranking")])).toBe("Finding ideas");
  });

  it("an unknown stage keeps the words before it", () => {
    expect(statusWords("hooks", [done("Finding proven outliers"), active("Something new")])).toBe("Looking for videos on this topic");
    expect(statusWords("explore", [active("Something new")])).toBe("Scanning for outliers");
  });

  it("\"Simulating your audience\" is never said", () => {
    expect(statusWords("hooks", [done("Generating"), active("Simulating your audience")])).toBe("Writing hooks");
  });

  it("another skill's stage names do not speak for this one", () => {
    expect(statusWords("hooks", [active("Resolving")])).toBe("Writing hooks");
  });

  it.each(["chat", "test", "predict", "read", ""])("any other run (%s) is \"Thinking\"", (skill) => {
    expect(statusWords(skill, [])).toBe("Thinking");
    expect(statusWords(skill, [active("Generating")])).toBe("Thinking");
  });
});

describe("usualNote", () => {
  it("the usual lengths, round on purpose", () => {
    expect(USUAL_S).toEqual({ hooks: 20, ideas: 30, script: 30 });
  });

  it("\"about 20 s\" for hooks up to twice that, then \"taking longer\"", () => {
    expect(usualNote("hooks", 0)).toBe("about 20 s");
    expect(usualNote("hooks", 40)).toBe("about 20 s");
    expect(usualNote("hooks", 41)).toBe("taking longer");
  });

  it("\"about 30 s\" for ideas and a script", () => {
    expect(usualNote("ideas", 12)).toBe("about 30 s");
    expect(usualNote("script", 60)).toBe("about 30 s");
    expect(usualNote("script", 61)).toBe("taking longer");
  });

  it.each(["remix", "explore", "account", "chat"])("nothing for %s", (skill) => {
    expect(usualNote(skill, 5)).toBeNull();
  });
});

describe("outlineOf", () => {
  it.each([
    ["hooks", "pack"],
    ["ideas", "pack"],
    ["script", "script"],
    ["remix", "remix"],
    ["explore", null],
    ["account", null],
    ["chat", null],
    ["test", null],
  ] as const)("%s: %s", (skill, outline) => {
    expect(outlineOf(skill)).toBe(outline);
  });
});
