/**
 * fixes.test.ts — what a finding says to a creator, and its fix (spec 2026-11-24-editor-screens-design.md E18; plan
 * 2026-11-25-editor-screens-b, Task 9): one sentence of the creator's own, never the review's words, the thing named as the edit
 * has it (an item's part, a mark's part, else the captions), the verb agreeing with it; and the fix offered as one button with the
 * request it sends, or none ("Show" only). The edit is real, made by the door from the suite's take, with a title on the film and
 * a call-out on its shot.
 */
import { describe, expect, it } from "vitest";
import type { Finding, FindingCode } from "@/lib/edit/review";
import { fixOf, sentenceOf, thingOf } from "../fixes";
import { FIRST, changed } from "./views";

const EDIT = changed(FIRST, [
  { op: "item.add", item: { id: "hook", part: "title", anchor: "start", at: 0, frames: 60, props: { text: "Three things", font: "tiktok", look: "label", y: 0.18, size: 110, color: "#ffffff", accent: null } } },
  { op: "mark.add", shot: "s1", mark: { id: "c1", part: "callout", atMs: 2000, lenMs: 500, props: { text: "Look", font: "tiktok", look: "pop", x: 0.5, y: 0.4, size: 64, color: "#ffffff" } } },
]);
/** A finding as the review writes it: its `says` is the review's own sentence, with numbers a creator cannot act on. */
const found = (code: FindingCode, where: Omit<Finding["where"], "frame"> = { shot: "s1" }, says = "the review's own words at 6.2 s; move it up or down"): Finding => ({
  code, severity: "warn", where: { frame: 186, ...where }, says,
});
/** The face covered: an `on-face` error (a warning is the chin touched, never shown to the creator: S18). */
const covering = (where: Omit<Finding["where"], "frame">): Finding => ({ ...found("on-face", where), severity: "error" });
/** Every code the review has: a code added to it fails to compile here until it is given a sentence and a fix. */
const CODES = Object.keys({
  "on-face": 1, "under-buttons": 1, "on-text": 1, "text-fits": 1, "two-titles": 1, "cut-outside-pause": 1, "empty-start": 1,
  "short-text": 1, "mark-hidden": 1, "fade-both": 1, "soft-zoom": 1, "caption-rows": 1, unmeasured: 1, "no-analysis": 1,
} satisfies Record<FindingCode, 1>) as FindingCode[];

describe("what a finding is about", () => {
  it("is its item's part, its mark's part, and else the captions", () => {
    expect(thingOf(found("on-face", { item: "hook" }), EDIT)).toBe("title");
    expect(thingOf(found("short-text", { shot: "s1", mark: "c1" }), EDIT)).toBe("callout");
    expect(thingOf(found("on-face", { shot: "s1" }), EDIT)).toBe("captions");
    expect(thingOf(found("on-face", {}), EDIT)).toBe("captions");
  });
});

describe("a finding's sentence for a creator", () => {
  it("names the thing and agrees with it, never in the review's words (1)", () => {
    expect(sentenceOf(covering({ shot: "s1" }), EDIT)).toBe("The captions cover your face here.");
    expect(sentenceOf(covering({ item: "hook" }), EDIT)).toBe("The title covers your face here.");
    expect(sentenceOf(found("short-text", { shot: "s1", mark: "c1" }), EDIT)).toBe("The call-out is gone before it can be read.");
    expect(sentenceOf(found("under-buttons", { shot: "s1" }), EDIT)).toBe("The captions sit under the app's buttons here.");
    expect(sentenceOf(found("under-buttons", { item: "hook" }), EDIT)).toBe("The title sits under the app's buttons here.");
    expect(sentenceOf(found("on-text", { shot: "s1", mark: "c1" }), EDIT)).toBe("The call-out covers other words here.");
    expect(sentenceOf(found("text-fits", { shot: "s1" }), EDIT)).toBe("A caption here is too long to fit at a size people can read.");
    expect(sentenceOf(found("text-fits", { item: "hook" }), EDIT)).toBe("The title is too long to fit at a size people can read.");
    expect(sentenceOf(found("mark-hidden", { shot: "s1", mark: "c1" }), EDIT)).toBe("The call-out sits on a part that was cut, so it never shows.");
    expect(sentenceOf(found("unmeasured", { item: "hook" }), EDIT)).toBe("The title uses a letter we cannot measure, so its fit is a guess.");
    expect(sentenceOf(found("unmeasured", { shot: "s1" }), EDIT)).toBe("The captions use a letter we cannot measure, so their fit is a guess.");
    expect(sentenceOf(found("soft-zoom"), EDIT)).toBe("This zoom makes the picture soft.");
  });

  it("tells a cut at the film's start, at its end and between shots apart by what the review says of it (1)", () => {
    const cut = (says: string) => sentenceOf(found("cut-outside-pause", { shot: "s1" }, says), EDIT);
    expect(cut("the film's start is outside a pause: shot \"s1\" starts at 950 ms of its take, in speech")).toBe("The video starts in the middle of a word.");
    expect(cut("the film's end at 12.7 s is outside a pause: shot \"s1\" ends at 12700 ms of its take, in speech")).toBe("The video ends in the middle of a word.");
    expect(cut("the cut into shot \"s2\" at 4.0 s is outside a pause: shot \"s1\" ends at 4000 ms of its take, in speech")).toBe("This cut lands in the middle of a word.");
  });

  it("gives every code a sentence that ends with a full stop and holds no digit (1)", () => {
    expect(CODES).toHaveLength(14);
    for (const code of CODES) {
      for (const where of [{ shot: "s1" }, { item: "hook" }, { shot: "s1", mark: "c1" }]) {
        const said = sentenceOf(found(code, where), EDIT);
        expect(said, code).toMatch(/^[A-Z].*\.$/);
        expect(said, code).not.toMatch(/\d/);
        expect(said, code).not.toContain("review's own words");
      }
    }
  });
});

describe("a code the tables do not know (fix round 1)", () => {
  it("is said plainly, with no fix, and does not throw", () => {
    const unknown = found("new-check" as FindingCode);
    expect(sentenceOf(unknown, EDIT)).toBe("Have a look at this moment.");
    expect(fixOf(unknown, EDIT)).toBeNull();
  });
});

describe("a finding's fix", () => {
  /** Where a finding is about each kind of thing in the suite's edit. */
  const ON = { captions: { shot: "s1" }, title: { item: "hook" }, callout: { shot: "s1", mark: "c1" } } as const;

  it("is one button and the request it sends, for the four fixes that cleared their finding in two runs of three, on the kind tried (2; Task 10, I4)", () => {
    expect(fixOf(covering(ON.captions), EDIT)).toEqual({ label: "Move them off my face", request: "Move the captions off my face." });
    expect(fixOf(found("under-buttons", ON.captions), EDIT)).toEqual({ label: "Move them clear of the app's buttons", request: "Move the captions clear of the app's buttons." });
    expect(fixOf(found("short-text", ON.title), EDIT)).toEqual({ label: "Keep it on longer", request: "Keep the title on screen longer." });
    expect(fixOf(found("two-titles", ON.title), EDIT)).toEqual({ label: "Keep one", request: "Keep only one title here." });
  });

  it("is none on a kind of thing the fix was not tried on: its sentence stays, with Show and Keep it (I4)", () => {
    const untried: [Finding, string][] = [
      [covering(ON.title), "The title covers your face here."],
      [covering(ON.callout), "The call-out covers your face here."],
      [found("under-buttons", ON.title), "The title sits under the app's buttons here."],
      [found("under-buttons", ON.callout), "The call-out sits under the app's buttons here."],
      [found("short-text", ON.callout), "The call-out is gone before it can be read."],
      [found("short-text", ON.captions), "The captions are gone before they can be read."],
      [found("two-titles", ON.callout), "Two titles show at once here."],
      [found("two-titles", ON.captions), "Two titles show at once here."],
    ];
    for (const [finding, sentence] of untried) {
      expect(fixOf(finding, EDIT), JSON.stringify(finding.where)).toBeNull();
      expect(sentenceOf(finding, EDIT)).toBe(sentence);
    }
  });

  it("is none for the four fixes that cleared their finding in no run of three, on any thing: \"Show\" only (Task 10)", () => {
    for (const code of ["soft-zoom", "text-fits", "caption-rows", "cut-outside-pause"] as const) {
      for (const where of Object.values(ON)) {
        for (const severity of ["error", "warn"] as const) expect(fixOf({ ...found(code, where), severity }, EDIT), `${code} ${severity} ${JSON.stringify(where)}`).toBeNull();
      }
    }
  });

  it("is none where no request clears it: \"Show\" only (2)", () => {
    for (const code of ["fade-both", "empty-start", "on-text", "mark-hidden", "unmeasured", "no-analysis"] as const) {
      for (const where of Object.values(ON)) expect(fixOf(found(code, where), EDIT), code).toBeNull();
    }
  });

  it("is offered for two codes on the captions and two on a title, none on a call-out, and no more: a fix comes back only after a new trial (Task 10, S18, I4)", () => {
    expect(CODES.filter((code) => fixOf({ ...found(code, ON.captions), severity: "error" }, EDIT) !== null)).toEqual(["on-face", "under-buttons"]);
    expect(CODES.filter((code) => fixOf({ ...found(code, ON.title), severity: "error" }, EDIT) !== null)).toEqual(["two-titles", "short-text"]);
    expect(CODES.filter((code) => fixOf({ ...found(code, ON.callout), severity: "error" }, EDIT) !== null)).toEqual([]);
  });
});
