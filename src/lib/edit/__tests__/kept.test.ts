/**
 * kept.test.ts — the findings put away (plan 2026-11-25-editor-screens-b, Task 8; spec §7): a finding's key across turns, what
 * is left to check, and what a new turn keeps put away.
 */
import { describe, expect, it } from "vitest";
import type { Finding } from "../review";
import { carryKept, findingKey, toCheck } from "../kept";

const finding = (code: Finding["code"], where: Finding["where"], says = "said"): Finding => ({ code, severity: "warn", where, says });

describe("findingKey", () => {
  it("is the code and the thing it is about: an item, else a mark, else the shot; never the frame", () => {
    expect(findingKey(finding("under-buttons", { frame: 10, shot: "s1" }))).toBe("under-buttons s1");
    expect(findingKey(finding("under-buttons", { frame: 10, shot: "s1", mark: "m1" }))).toBe("under-buttons m1");
    expect(findingKey(finding("under-buttons", { frame: 10, shot: "s1", item: "t1" }))).toBe("under-buttons t1");
    expect(findingKey(finding("under-buttons", { frame: 200, shot: "s1" }))).toBe("under-buttons s1");
    // Another level of a code that is one thing to the creator: the same key.
    expect(findingKey({ ...finding("under-buttons", { frame: 10, shot: "s1" }), severity: "error" })).toBe("under-buttons s1");
    // About nothing named (a finding of the film as a whole): its code alone.
    expect(findingKey(finding("empty-start", { frame: 0 }))).toBe("empty-start");
  });

  it("holds the level for on-face, the face covered (an error) and the chin touched (a warning) being two things (S18)", () => {
    expect(findingKey({ ...finding("on-face", { frame: 10, shot: "s1" }), severity: "error" })).toBe("on-face error s1");
    expect(findingKey(finding("on-face", { frame: 10, shot: "s1" }))).toBe("on-face warn s1");
    expect(findingKey({ ...finding("on-face", { frame: 10, shot: "s1", item: "t1" }), severity: "error" })).toBe("on-face error t1");
    expect(findingKey(finding("on-face", { frame: 200, shot: "s1", mark: "m1" }))).toBe("on-face warn m1");
  });
});

describe("toCheck", () => {
  it("keeps one finding a key, the first in the list's order", () => {
    // The captions under the buttons of both apps in one shot: two findings, one thing to check.
    const tiktok = finding("under-buttons", { frame: 30, shot: "s1" }, "the captions sit under TikTok's description");
    const instagram = finding("under-buttons", { frame: 30, shot: "s1" }, "the captions sit under Instagram's description");
    expect(toCheck([tiktok, instagram], [])).toEqual([tiktok]);
  });

  it("leaves out what was put away, and keeps the list's order", () => {
    const face: Finding = { ...finding("on-face", { frame: 12, shot: "s1" }), severity: "error" };
    const soft = finding("soft-zoom", { frame: 40, shot: "s2" });
    const short = finding("short-text", { frame: 90, shot: "s2", mark: "m1" });
    expect(toCheck([face, soft, short], ["soft-zoom s2"])).toEqual([face, short]);
    expect(toCheck([face, soft, short], [])).toEqual([face, soft, short]);
    expect(toCheck([face, soft, short], ["on-face error s1", "soft-zoom s2", "short-text m1"])).toEqual([]);
    expect(toCheck([], ["on-face error s1"])).toEqual([]);
  });

  it("never puts the chin touched to the creator, alone or beside the face covered, put away or not (S18)", () => {
    const chin = finding("on-face", { frame: 12, shot: "s1" }, "the captions at 0.4 s touch the chin; move them up or down");
    const face: Finding = { ...finding("on-face", { frame: 40, shot: "s2" }, "the captions at 1.3 s cover the mouth; move them up or down"), severity: "error" };
    expect(toCheck([chin], [])).toEqual([]);
    expect(toCheck([chin, face], [])).toEqual([face]);
    expect(toCheck([chin, face], ["on-face warn s1"])).toEqual([face]);
    // A key of the chin never hides the face covered.
    expect(toCheck([face], ["on-face warn s2"])).toEqual([face]);
    // Another warning is still put to the creator.
    const soft = finding("soft-zoom", { frame: 40, shot: "s2" });
    expect(toCheck([chin, soft], [])).toEqual([soft]);
  });

  it("reads a key put away before the level was part of it without a throw: it matches no finding, so the face covered comes back once (S18)", () => {
    const face: Finding = { ...finding("on-face", { frame: 12, shot: "s1" }), severity: "error" };
    expect(toCheck([face], ["on-face s1"])).toEqual([face]);
    // And the next turn does not carry it.
    expect(carryKept(["on-face s1"], [face])).toEqual([]);
  });
});

describe("carryKept", () => {
  it("keeps put away what the new turn still finds, at whatever frame, and drops the rest", () => {
    const moved = finding("soft-zoom", { frame: 75, shot: "s1" });
    expect(carryKept(["soft-zoom s1", "on-face s2"], [moved])).toEqual(["soft-zoom s1"]);
  });

  it("keeps each key once, in kept's order", () => {
    const face: Finding = { ...finding("on-face", { frame: 12, shot: "s1" }), severity: "error" };
    const soft = finding("soft-zoom", { frame: 40, shot: "s2" });
    expect(carryKept(["soft-zoom s2", "on-face error s1", "soft-zoom s2"], [face, soft, soft])).toEqual(["soft-zoom s2", "on-face error s1"]);
    expect(carryKept([], [face])).toEqual([]);
    expect(carryKept(["on-face error s1"], [])).toEqual([]);
  });
});
