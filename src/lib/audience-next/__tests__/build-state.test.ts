/**
 * build-state.ts — the building state as a reducer over the stream's events: the three steps in the words
 * the server sends, the evidence, the outcome (done, too little to read, failed) and its sentence, and how
 * many of the ten wedges are lit. Pure; no stand-ins.
 */
import { describe, expect, it } from "vitest";

import { calibrationVocabulary } from "@/lib/audience/calibration-stages";

import { AUDIENCE_STRINGS as S, thinWhy } from "../audience-words";
import { buildRequestOf, type BuildRequest } from "../build-request";
import {
  applyEvent,
  endOfStream,
  failureSentence,
  litWedgesOf,
  startBuild,
  stepsOf,
  type BuildState,
} from "../build-state";
import type { BuildEvent } from "../build-stream";

const OWN = buildRequestOf("own", "nia.tests")!;
const OTHER = buildRequestOf("other", "leo.makes")!;
const DESCRIBED = buildRequestOf("describe", "Busy parents who meal-prep")!;

// The server's own step names (`calibration-stages.ts`), as it sends them.
const READ = "Reading your followers";
const WATCH = "Watching your videos";
const BUILD = "Building your audience profile";

const SYNTHESIS = "We read @nia.tests fine — building the audience from it is what failed. Nothing is wrong with the handle; try again.";
const ID = "00000000-0000-4000-8000-000000000001";

const stage = (name: string, status: "pending" | "active" | "done"): BuildEvent => ({ type: "stage", name, status });
const run = (request: BuildRequest, events: BuildEvent[]): BuildState => events.reduce(applyEvent, startBuild(request));

describe("startBuild", () => {
  it("a handle's read: running, the server's three steps, all next", () => {
    const s = startBuild(OWN);
    expect(s.phase).toBe("running");
    expect(s.request).toBe(OWN);
    expect(s.plan).toEqual([READ, WATCH, BUILD]);
    expect(s.plan).toEqual(calibrationVocabulary(true).plan);
    expect(stepsOf(s)).toEqual([
      { name: READ, at: "next" },
      { name: WATCH, at: "next" },
      { name: BUILD, at: "next" },
    ]);
    expect(s.evidence).toBeNull();
    expect(s.audienceId).toBeNull();
    expect(s.sentence).toBeNull();
    expect(litWedgesOf(s)).toBe(0);
  });

  it("a description's read takes the described words", () => {
    expect(startBuild(DESCRIBED).plan).toEqual(calibrationVocabulary(false).plan);
    expect(startBuild(DESCRIBED).plan).toEqual(["Finding videos in that niche", "Watching what performs there", BUILD]);
  });
});

describe("applyEvent: the steps", () => {
  it("follow the server: active is now, done is done; the ring lights 0, 3, 7, 10 wedges", () => {
    let s = run(OWN, [stage(READ, "active")]);
    expect(stepsOf(s).map((x) => x.at)).toEqual(["now", "next", "next"]);
    expect(litWedgesOf(s)).toBe(0);
    s = run(OWN, [stage(READ, "active"), stage(READ, "done"), stage(WATCH, "active")]);
    expect(stepsOf(s).map((x) => x.at)).toEqual(["done", "now", "next"]);
    expect(litWedgesOf(s)).toBe(3);
    s = applyEvent(applyEvent(s, stage(WATCH, "done")), stage(BUILD, "active"));
    expect(stepsOf(s).map((x) => x.at)).toEqual(["done", "done", "now"]);
    expect(litWedgesOf(s)).toBe(7);
    s = applyEvent(s, stage(BUILD, "done"));
    expect(stepsOf(s).map((x) => x.at)).toEqual(["done", "done", "done"]);
    expect(litWedgesOf(s)).toBe(10);
    expect(s.phase).toBe("running");
  });

  it("a step that is done stays done", () => {
    const s = run(OWN, [stage(READ, "done"), stage(READ, "active"), stage(READ, "pending")]);
    expect(stepsOf(s)[0]).toEqual({ name: READ, at: "done" });
  });

  it("a name outside the plan is ignored", () => {
    const before = startBuild(OWN);
    const after = applyEvent(before, stage("Pulling the account and its posts", "active"));
    expect(after).toBe(before);
    // A description's read does not take a handle's words.
    expect(stepsOf(run(DESCRIBED, [stage(READ, "active")])).map((x) => x.at)).toEqual(["next", "next", "next"]);
  });
});

describe("applyEvent: the evidence", () => {
  const coversOf = (count: number) => Array.from({ length: count }, (_, i) => `https://cdn.example.test/${i}.jpg`);
  const evidence = (count: number, picture: string | null = null): BuildEvent => ({
    type: "evidence",
    handle: "nia.tests",
    picture,
    covers: coversOf(count),
    count,
  });

  it("the last one wins", () => {
    const s = run(OWN, [evidence(2, "https://cdn.example.test/a.jpg"), evidence(12)]);
    expect(s.evidence).toEqual({ picture: null, covers: coversOf(12), count: 12 });
  });

  it("keeps the picture, the covers and the count", () => {
    const s = run(OWN, [evidence(3, "https://cdn.example.test/a.jpg")]);
    expect(s.evidence).toEqual({
      picture: "https://cdn.example.test/a.jpg",
      covers: ["https://cdn.example.test/0.jpg", "https://cdn.example.test/1.jpg", "https://cdn.example.test/2.jpg"],
      count: 3,
    });
  });
});

describe("applyEvent: the outcomes", () => {
  it("done: settling, every step done, the audience's id, the ring full", () => {
    const s = run(OWN, [stage(READ, "active"), { type: "done", audienceId: ID }]);
    expect(s.phase).toBe("settling");
    expect(s.audienceId).toBe(ID);
    expect(stepsOf(s).map((x) => x.at)).toEqual(["done", "done", "done"]);
    expect(litWedgesOf(s)).toBe(10);
  });

  it("too little to read: thin, the sentence about the handle", () => {
    const s = run(OTHER, [stage(READ, "active"), { type: "fallback" }]);
    expect(s.phase).toBe("thin");
    expect(s.sentence).toBe(thinWhy("leo.makes"));
    expect(s.sentence).toBe("@leo.makes doesn't have enough public videos to read yet.");
  });

  it("too little to read for a description: the sentence about the description", () => {
    const s = run(DESCRIBED, [{ type: "fallback" }]);
    expect(s.sentence).toBe(thinWhy(null));
  });

  it("an error: failed, with the sentence failureSentence gives", () => {
    const s = run(OWN, [{ type: "error", message: SYNTHESIS }]);
    expect(s.phase).toBe("failed");
    expect(s.sentence).toBe(SYNTHESIS);
    expect(run(OWN, [{ type: "error", message: null }]).sentence).toBe(S.accountNotFound);
  });

  it.each(["thin", "failed"] as const)("nothing changes after %s", (phase) => {
    const end: BuildEvent = phase === "thin" ? { type: "fallback" } : { type: "error", message: null };
    const s = run(OWN, [end]);
    for (const e of [stage(READ, "done"), { type: "done", audienceId: ID } as BuildEvent, { type: "fallback" } as BuildEvent, { type: "error", message: SYNTHESIS } as BuildEvent]) {
      expect(applyEvent(s, e)).toBe(s);
    }
    expect(endOfStream(s)).toBe(s);
  });

  it("nothing changes after done", () => {
    const s = endOfStream(run(OWN, [{ type: "done", audienceId: ID }]));
    expect(s.phase).toBe("done");
    expect(applyEvent(s, { type: "error", message: SYNTHESIS })).toBe(s);
    expect(applyEvent(s, stage(READ, "active"))).toBe(s);
    expect(endOfStream(s)).toBe(s);
  });

  it("once the audience is made, a late error or fallback does not undo it; a second done keeps the first id", () => {
    const s = run(OWN, [{ type: "done", audienceId: ID }]);
    expect(applyEvent(s, { type: "error", message: null })).toBe(s);
    expect(applyEvent(s, { type: "fallback" })).toBe(s);
    expect(applyEvent(s, { type: "done", audienceId: "another" })).toBe(s);
  });
});

describe("endOfStream", () => {
  it("running: failed, with the local sentence", () => {
    const s = endOfStream(run(OWN, [stage(READ, "active")]));
    expect(s.phase).toBe("failed");
    expect(s.sentence).toBe(S.accountNotFound);
    expect(endOfStream(startBuild(DESCRIBED)).sentence).toBe(S.describeFailed);
  });

  it("settling: done, the id kept", () => {
    const s = endOfStream(run(OWN, [{ type: "done", audienceId: ID }]));
    expect(s.phase).toBe("done");
    expect(s.audienceId).toBe(ID);
    expect(litWedgesOf(s)).toBe(10);
  });
});

describe("failureSentence", () => {
  it("the server's sentence only when it is the synthesis one for a handle", () => {
    expect(failureSentence(SYNTHESIS, OWN)).toBe(SYNTHESIS);
    expect(failureSentence(SYNTHESIS.replace("nia.tests", "leo.makes"), OTHER)).toBe(SYNTHESIS.replace("nia.tests", "leo.makes"));
  });

  it.each([
    "Calibration failed. Check the handle and try again.",
    "fetch failed",
    "TypeError: Cannot read properties of undefined",
    "we read @nia.tests fine",
    "Then: We read @nia.tests fine — but",
    "",
  ])("anything else for a handle is the local sentence: %j", (message) => {
    expect(failureSentence(message, OWN)).toBe(S.accountNotFound);
  });

  it("no sentence: the local one", () => {
    expect(failureSentence(null, OTHER)).toBe(S.accountNotFound);
  });

  it("a description never carries the server's sentence", () => {
    expect(failureSentence("We read @busy parents fine — building the audience from it is what failed.", DESCRIBED)).toBe(S.describeFailed);
    expect(failureSentence(SYNTHESIS, DESCRIBED)).toBe(S.describeFailed);
    expect(failureSentence(null, DESCRIBED)).toBe(S.describeFailed);
  });
});
