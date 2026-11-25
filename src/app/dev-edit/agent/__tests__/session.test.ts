/**
 * session.test.ts — the page's own state (Task 13b): a first cut, the requests and their answers, undo, start over, and that
 * nothing moves while a call is out. The edits here are stand-ins: the session carries an edit and never reads into it.
 */
import { describe, expect, it } from "vitest";
import type { Edit } from "@/lib/edit";
import { START, canUndo, editOf, findingsOf, reduce, type Action, type Answer, type Session } from "../session";

const edit = (name: string) => ({ name }) as unknown as Edit;
const answer = (name: string, more: Partial<Answer> = {}): Answer => ({
  say: `made ${name}`, edit: edit(name), findings: [], rounds: 1, ms: 1000, cost: 0.01, changed: true, match: null, style: null, styleSay: null, ...more,
});
const after = (...actions: Action[]): Session => actions.reduce(reduce, START);

const CUT: Action[] = [{ type: "cutting", stage: "Cutting your take…", share: null }, { type: "cut", answer: answer("first") }];
const change = (request: string, name: string, more: Partial<Answer> = {}): Action[] => [{ type: "asking", request }, { type: "answered", answer: answer(name, more) }];

describe("the first cut", () => {
  it("starts with nothing: no cut, no call out, no problem", () => {
    expect(START).toEqual({ cut: null, working: null, problem: null, spent: { calls: 0, cost: 0, last: null } });
    expect(editOf(START)).toBeNull();
  });

  it("shows its stage while it is out, each stage in turn, then holds the cut", () => {
    const reading = after({ type: "cutting", stage: "Getting the video…", share: null }, { type: "cutting", stage: "Reading its cuts…", share: 0.4 });
    expect(reading.working).toEqual({ what: "cut", stage: "Reading its cuts…", share: 0.4 });
    expect(reading.cut).toBeNull();
    const cut = after(...CUT);
    expect(cut.working).toBeNull();
    expect(editOf(cut)).toEqual(edit("first"));
    expect(cut.cut?.turns).toEqual([]);
  });

  it("that fails leaves no cut and one sentence to show, and trying again clears it", () => {
    const failed = after({ type: "cutting", stage: "Cutting your take…", share: null }, { type: "failed", text: "The editor could not be reached." });
    expect(failed).toEqual({ ...START, problem: { text: "The editor could not be reached.", request: null } });
    expect(reduce(failed, { type: "cutting", stage: "Cutting your take…", share: null }).problem).toBeNull();
  });

  it("in a video's style: its style is read first, stage by stage, then the take is cut", () => {
    const reading = after({ type: "reading", stage: "Getting the video…", share: null }, { type: "reading", stage: "Reading its cuts…", share: 0.4 });
    expect(reading.working).toEqual({ what: "read", stage: "Reading its cuts…", share: 0.4 });
    const cutting = reduce(reading, { type: "cutting", stage: "Cutting your take…", share: 0.9 });
    expect(cutting.working).toEqual({ what: "cut", stage: "Cutting your take…", share: 0.9 });
    expect(reduce(cutting, { type: "cut", answer: answer("first") }).cut?.first.say).toBe("made first");
  });

  it("a read can be stopped, and nothing read late starts it again as a cut; a call of the agent's cannot be stopped", () => {
    const reading = after({ type: "reading", stage: "Reading its cuts…", share: 0.4 });
    const stopped = reduce(reading, { type: "stopped" });
    expect(stopped).toEqual(START);
    expect(reduce(stopped, { type: "cut", answer: answer("late") })).toBe(stopped);
    const cutting = after({ type: "cutting", stage: "Cutting your take…", share: null });
    expect(reduce(cutting, { type: "stopped" })).toBe(cutting);
    expect(reduce(cutting, { type: "reading", stage: "Reading its cuts…", share: 0.4 })).toBe(cutting);
  });

  it("a problem shown goes when the creator changes what they picked, and not while something is under way", () => {
    const failed = after({ type: "reading", stage: "Getting the video…", share: null }, { type: "failed", text: "The video is longer than three minutes." });
    expect(failed.problem).toEqual({ text: "The video is longer than three minutes.", request: null });
    expect(reduce(failed, { type: "moved on" })).toEqual(START);
    expect(reduce(START, { type: "moved on" })).toBe(START);
    const cutting = after({ type: "cutting", stage: "Cutting your take…", share: null });
    expect(reduce(cutting, { type: "moved on" })).toBe(cutting);
  });

  it("is not asked for twice at once, nor over a cut", () => {
    const cut = after(...CUT);
    expect(reduce(cut, { type: "cutting", stage: "Cutting your take…", share: null })).toBe(cut);
    expect(reduce(cut, { type: "reading", stage: "Getting the video…", share: null })).toBe(cut);
    const asking = reduce(cut, { type: "asking", request: "Black and white" });
    expect(reduce(asking, { type: "cutting", stage: "Cutting your take…", share: null })).toBe(asking);
  });
});

describe("a change", () => {
  it("shows the request at once, and its answer under it when it comes", () => {
    const asking = after(...CUT, { type: "asking", request: "Black and white" });
    expect(asking.working).toEqual({ what: "change", request: "Black and white" });
    expect(editOf(asking)).toEqual(edit("first"));
    const answered = reduce(asking, { type: "answered", answer: answer("mono") });
    expect(answered.working).toBeNull();
    expect(answered.cut?.turns.map((turn) => [turn.request, turn.answer.say])).toEqual([["Black and white", "made mono"]]);
    expect(editOf(answered)).toEqual(edit("mono"));
  });

  it("that changes nothing is a turn like any other: its say is shown, the edit stays, and there is nothing to undo", () => {
    const session = after(...CUT, ...change("Bigger captions", "first", { changed: false, say: "I couldn't make that change: it would cover your face." }));
    expect(session.problem).toBeNull();
    expect(session.cut?.turns).toHaveLength(1);
    expect(session.cut?.turns[0]?.answer.say).toBe("I couldn't make that change: it would cover your face.");
    expect(editOf(session)).toEqual(edit("first"));
    expect(canUndo(session)).toBe(false);
  });

  it("that fails keeps the cut and the thread, and holds its request to try again", () => {
    const session = after(...CUT, ...change("Black and white", "mono"), { type: "asking", request: "Tighter cuts" }, { type: "failed", text: "Something went wrong." });
    expect(session.problem).toEqual({ text: "Something went wrong.", request: "Tighter cuts" });
    expect(session.working).toBeNull();
    expect(session.cut?.turns).toHaveLength(1);
    expect(editOf(session)).toEqual(edit("mono"));
    expect(reduce(session, { type: "asking", request: "Tighter cuts" }).problem).toBeNull();
  });

  it("is not asked without a cut, nor while another call is out", () => {
    expect(reduce(START, { type: "asking", request: "Black and white" })).toBe(START);
    const asking = after(...CUT, { type: "asking", request: "Black and white" });
    expect(reduce(asking, { type: "asking", request: "Tighter cuts" })).toBe(asking);
  });

  it("answered when none was asked is left aside", () => {
    const cut = after(...CUT);
    expect(reduce(cut, { type: "answered", answer: answer("stray") })).toBe(cut);
  });
});

describe("undo", () => {
  const three = after(...CUT, ...change("Black and white", "mono"), ...change("Tighter cuts", "tight"), ...change("Bigger captions", "tight", { changed: false }));

  it("is off at the first cut", () => {
    const cut = after(...CUT);
    expect(canUndo(cut)).toBe(false);
    expect(reduce(cut, { type: "undo" })).toBe(cut);
  });

  it("goes back one edit: the last change and what was said after it are dropped", () => {
    expect(canUndo(three)).toBe(true);
    const back = reduce(three, { type: "undo" });
    expect(back.cut?.turns.map((turn) => turn.request)).toEqual(["Black and white"]);
    expect(editOf(back)).toEqual(edit("mono"));
    const first = reduce(back, { type: "undo" });
    expect(first.cut?.turns).toEqual([]);
    expect(editOf(first)).toEqual(edit("first"));
    expect(canUndo(first)).toBe(false);
  });

  it("of one answer goes back to the edit before it, dropping it and all after it", () => {
    const back = reduce(three, { type: "undo", turn: 0 });
    expect(back.cut?.turns).toEqual([]);
    expect(editOf(back)).toEqual(edit("first"));
  });

  it("of an answer that changed nothing, or of none there is, does nothing", () => {
    expect(reduce(three, { type: "undo", turn: 2 })).toBe(three);
    expect(reduce(three, { type: "undo", turn: 7 })).toBe(three);
  });

  it("clears a problem shown: what it was about is gone", () => {
    const failed = reduce(reduce(three, { type: "asking", request: "Move the title lower" }), { type: "failed", text: "Something went wrong." });
    expect(reduce(failed, { type: "undo" }).problem).toBeNull();
  });
});

describe("while a call is out", () => {
  it("nothing else moves: no undo, no start over", () => {
    const asking = after(...CUT, ...change("Black and white", "mono"), { type: "asking", request: "Tighter cuts" });
    expect(canUndo(asking)).toBe(false);
    expect(reduce(asking, { type: "undo" })).toBe(asking);
    expect(reduce(asking, { type: "start over" })).toBe(asking);
    const cutting = after({ type: "cutting", stage: "Cutting your take…", share: null });
    expect(reduce(cutting, { type: "start over" })).toBe(cutting);
  });
});

describe("start over", () => {
  it("drops the cut and its changes", () => {
    const over = reduce(after(...CUT, ...change("Black and white", "mono")), { type: "start over" });
    expect({ ...over, spent: START.spent }).toEqual(START);
  });
});

describe("what the page reads off a session", () => {
  it("shows the things to check of the edit as it stands: the latest answer's", () => {
    const chin = { code: "on-face" as const, severity: "warn" as const, where: { frame: 5 }, says: "the captions at 0.2 s touch the chin" };
    const bar = { code: "under-buttons" as const, severity: "warn" as const, where: { frame: 0 }, says: "the title touches the top bar" };
    const cut = after({ type: "cutting", stage: "Cutting your take…", share: null }, { type: "cut", answer: answer("first", { findings: [chin, bar] }) });
    expect(findingsOf(cut)).toEqual([chin, bar]);
    const changed = [...change("Move the title lower", "lower", { findings: [chin] })].reduce(reduce, cut);
    expect(findingsOf(changed)).toEqual([chin]);
    expect(findingsOf(reduce(changed, { type: "undo" }))).toEqual([chin, bar]);
    expect(findingsOf(START)).toEqual([]);
  });

  it("adds up every call for the details, undone or not: the last one's rounds and time, and the cost of all", () => {
    const session = after(...CUT, ...change("Black and white", "mono", { rounds: 2, ms: 23_056, cost: 0.048 }));
    expect(session.spent.last).toEqual({ rounds: 2, ms: 23_056, cost: 0.048 });
    expect(session.spent.calls).toBe(2);
    expect(session.spent.cost).toBeCloseTo(0.058, 6);
    const undone = reduce(session, { type: "undo" });
    expect(undone.spent).toEqual(session.spent);
    expect(reduce(undone, { type: "start over" }).spent).toEqual(session.spent);
  });
});
