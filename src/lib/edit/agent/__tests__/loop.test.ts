/**
 * The agent's change (part 3, Task 7), with its two network boundaries stood in for: Qwen's `ask` (a list of canned answers,
 * each with its usage and the time it takes on a clock of the test's own) and the worker's `stills` (frames drawn as stand-in
 * JPEGs). The door (`applyOps`, `checkEdit`), `review`, the context and the edits are the real ones.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { QWEN_REASONING_MODEL } from "@/lib/engine/qwen/client";
import { calculateCost } from "@/lib/engine/qwen/cost";
import type { Analyses, FaceSample, TakeAnalysis } from "../../analysis";
import { filmFrames, placed } from "../../derive";
import { DEFAULT_CAPTIONS, newEdit, type Asset, type Edit, type Mark } from "../../doc";
import { applyOps } from "../../ops";
import { review, type Finding } from "../../review";
import type { stillsOf } from "../../worker/stills";
import { catalogue } from "../catalogue";
import { ROOM_YS, captionsFit, captionsWorse, contextOf, effectOf, pauseBefore, roomFor, saidOf, zoomFor } from "../context";
import { tighten } from "../../recipes";
import { AGENT_LIMITS, AnswerSchema, change, claimsChange, contradicts, kitTerms, notEnglish, placedSay, readableEnds, sayFault, sentencesOf, withMoves, withPlaced, withPunctuation, type AgentInput } from "../loop";
import type { Ask, Message } from "../model";
import { landed, momentBlock, momentFor, zoomHere, type Moment } from "../moment";
import { ONLY, closingMessage, sayAgainMessage, systemPrompt } from "../prompt";
import { analysis as fixtureAnalysis, box, faces as fixtureFaces, twoShots } from "./fixture";

/* ── a made-up take: 6 s, 720x1280, ten words, four pauses, the face low in the frame ──────────────────────────────────── */

const TAKE_MS = 6000;
const WORDS = [
  { text: "One", startMs: 200, endMs: 500 },
  { text: "two", startMs: 520, endMs: 980 },
  { text: "three", startMs: 1200, endMs: 1500 },
  { text: "four", startMs: 1520, endMs: 1980 },
  { text: "five", startMs: 2400, endMs: 2800 },
  { text: "six", startMs: 2820, endMs: 3300 },
  { text: "seven", startMs: 3320, endMs: 3900 },
  { text: "eight", startMs: 3920, endMs: 4500 },
  { text: "nine", startMs: 4520, endMs: 5100 },
  { text: "ten", startMs: 5120, endMs: 5800 },
];
const PAUSES = [
  { startMs: 0, endMs: 200, cutMs: 100 },
  { startMs: 1000, endMs: 1200, cutMs: 1100 },
  { startMs: 2000, endMs: 2400, cutMs: 2200 },
  { startMs: 5800, endMs: 6000, cutMs: 5900 },
];
/** The face from 0.6 to 0.9 of the picture's height, its mouth from 0.8 to 0.85, five samples a second. */
const FACES: FaceSample[] = Array.from({ length: TAKE_MS / 200 }, (_, i) => ({
  ms: i * 200, face: { x: 0.2, y: 0.6, w: 0.6, h: 0.3 }, mouth: { x: 0.4, y: 0.8, w: 0.2, h: 0.05 },
}));
const ANALYSIS: TakeAnalysis = { language: "en", pauses: PAUSES, faces: FACES, loudness: null };
const ANALYSES: Analyses = { take: ANALYSIS };

const TAKE: Asset = {
  id: "take", kind: "video", origin: "filmed", at: { bucket: "edit-media", path: "u1/take.mp4" },
  ms: TAKE_MS, w: 720, h: 1280, sound: true, words: WORDS.map((word) => ({ ...word })),
};
const POP: Asset = { id: "pop", kind: "audio", origin: "kit", at: { kit: "sfx/pop.wav" }, ms: 500 };
const LIBRARY: readonly Asset[] = [TAKE, POP];

const through = (edit: Edit, ops: unknown[]): Edit => {
  const made = applyOps(edit, ops, LIBRARY);
  if (!made.ok) throw new Error(made.problems.map((problem) => problem.message).join("; "));
  return made.edit;
};
/** One shot over the take, its captions at 0.3 of the height, above the face: no error. */
const clean = (): Edit => through(newEdit(TAKE), [{ op: "captions.set", y: 0.3 }]);
const errors = (findings: Finding[]) => findings.filter((finding) => finding.severity === "error");

const callout = (over: Partial<Extract<Mark, { part: "callout" }>["props"]> = {}): Mark => ({
  id: "c1", part: "callout", atMs: 3200, lenMs: 800, props: { text: "SAVE", font: "tiktok", look: "pop", x: 0.5, y: 0.2, size: 96, color: "#ffffff", ...over },
});

/* ── the two boundaries ────────────────────────────────────────────────────────────────────────────────────────────────── */

/** One canned answer: its text, the usage DashScope would report, and how long it takes on the test's clock. */
interface Canned {
  text: string;
  usage?: { input: number; output: number };
  takesMs?: number;
}
const answer = (say: string, ops: unknown[], over: Omit<Canned, "text"> = {}): Canned => ({ text: JSON.stringify({ say, ops }), ...over });

/** A call that fails: at once, or after `takesMs` on the test's clock. */
interface Fails {
  fails: Error;
  takesMs?: number;
}

/**
 * Qwen, as a list of canned answers (an Error, or `Fails`, is a call that fails), on a clock of the test's own; `wait` is the
 * loop's wait before asking again, on that clock, and `waits` what it waited.
 */
function scripted(answers: (Canned | Error | Fails)[]) {
  const clock = { t: 0 };
  const calls: { messages: Message[]; maxTokens: number; thinking: boolean; signal: AbortSignal | undefined }[] = [];
  const waits: number[] = [];
  const ask: Ask = async (messages, opts) => {
    calls.push({ messages: structuredClone(messages), maxTokens: opts.maxTokens, thinking: opts.thinking, signal: opts.signal });
    const next = answers.shift();
    if (next === undefined) throw new Error("the script has no answer left");
    if (next instanceof Error) throw next;
    if ("fails" in next) {
      clock.t += next.takesMs ?? 0;
      throw next.fails;
    }
    const ms = next.takesMs ?? 1000;
    clock.t += ms;
    return { text: next.text, usage: next.usage ?? { input: 9000, output: 120 }, ms };
  };
  const wait = async (ms: number) => {
    waits.push(ms);
    clock.t += ms;
  };
  return { ask, calls, clock, waits, wait, now: () => clock.t };
}

const jpegOf = (frame: number) => Buffer.from(`jpeg ${frame}`).toString("base64");

/** The worker's stills: each frame asked as a stand-in JPEG, or the line it fails with. */
function drawer(fails?: string) {
  const calls: { user: string; edit: Edit; frames: number[]; signal: AbortSignal | undefined }[] = [];
  const stills: typeof stillsOf = async (user, edit, frames, stopping = {}) => {
    calls.push({ user, edit: structuredClone(edit), frames: [...frames], signal: stopping.signal });
    if (fails) throw new Error(fails);
    return frames.map((frame) => ({ frame, jpeg: jpegOf(frame) }));
  };
  return { stills, calls };
}

const input = (over: Partial<AgentInput> = {}): AgentInput => ({
  edit: clean(), analyses: ANALYSES, request: "make it better", library: LIBRARY, user: "u1", deadlineMs: 50_000, ...over,
});

/** The text of a message, its text parts joined. */
const textOf = (message: Message | undefined): string => {
  if (!message) return "";
  return typeof message.content === "string" ? message.content : message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n");
};
const lastUser = (messages: Message[]) => textOf(messages.filter((message) => message.role === "user").at(-1));

/* ── the tests ─────────────────────────────────────────────────────────────────────────────────────────────────────────── */

/** The logger's lines, kept off the test's output: `info` goes to console.log, `warn` to console.warn. */
let logged: { info: MockInstance<typeof console.log>; warn: MockInstance<typeof console.warn> };
/** The model's look at a seen change is off as shipped (X115); the tests of its code path run with it on, and one suite with it off. */
const look = (on: boolean) => {
  (AGENT_LIMITS as { look: boolean }).look = on;
};
beforeEach(() => {
  logged = { info: vi.spyOn(console, "log").mockImplementation(() => undefined), warn: vi.spyOn(console, "warn").mockImplementation(() => undefined) };
  look(true);
});
afterEach(() => {
  vi.restoreAllMocks();
  look(false);
});

describe("the fixture", () => {
  it("is clean before any request: review finds no error, and the face is where the captions at 0.75 would be", () => {
    expect(errors(review(clean(), ANALYSES))).toEqual([]);
    expect(errors(review(through(clean(), [{ op: "captions.set", y: 0.75 }]), ANALYSES)).map((finding) => finding.code)).toContain("on-face");
  });
});

describe("change: one round", () => {
  it("applies one good answer: one round, changed, the ops and the edit through the door", async () => {
    const ops = [{ op: "word.set", asset: "take", index: 1, stress: true }];
    const qwen = scripted([answer("I stressed “two”.", ops)]);
    const worker = drawer();
    const result = await change(input(), { ask: qwen.ask, stills: worker.stills, now: qwen.now });

    expect(result.rounds).toHaveLength(1);
    expect(result.changed).toBe(true);
    expect(result.ops).toEqual(ops);
    expect(result.edit).toEqual(through(clean(), ops));
    expect(result.say).toBe("I stressed “two”.");
    expect(result.findings).toEqual(review(result.edit, ANALYSES));
    expect(result.rounds[0]).toMatchObject({ n: 1, ops, refused: null, findings: review(result.edit, ANALYSES), stills: [], outcome: "changed", error: null });
    // A word.set alone changes nothing seen: no stills.
    expect(worker.calls).toEqual([]);
  });

  it("asks with the system prompt (the role, then the catalogue) and the context's sections, each headed by its key, then the request", async () => {
    const qwen = scripted([answer("Done.", [{ op: "word.set", asset: "take", index: 1, stress: true }])]);
    await change(input({ request: "stress the word two" }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });

    const [first] = qwen.calls;
    expect(first?.maxTokens).toBe(AGENT_LIMITS.maxTokens);
    expect(first?.thinking).toBe(AGENT_LIMITS.thinking);
    expect(first?.signal).toBeInstanceOf(AbortSignal);
    const [system, user, ...rest] = first?.messages ?? [];
    expect(rest).toEqual([]);
    expect(system?.role).toBe("system");
    expect(textOf(system).endsWith(catalogue())).toBe(true);
    expect(textOf(system).length).toBeGreaterThan(catalogue().length);
    expect(user?.role).toBe("user");
    const context = contextOf(clean(), ANALYSES, review(clean(), ANALYSES), LIBRARY);
    expect(textOf(user)).toBe(
      [`edit:\n${context.edit}`, `files:\n${context.files}`, `words:\n${context.words}`, `pauses:\n${context.pauses}`, `faces:\n${context.faces}`, `room:\n${context.room}`, `findings:\n${context.findings}`, "request:\nstress the word two", ONLY].join("\n\n"),
    );
    // After the request, what to keep to (Task 14, fix round 2).
    expect(ONLY).toBe('Make this change and no other: nothing "as well", nothing "instead". If part of it cannot be done, do the rest and say what is missing; if none of it can, send "ops": [] and say why, and what would work.');
    // The room (Task 14): where the captions and a new text may sit on this take, the face low in the frame.
    expect(context.room).toMatch(/^captions now size 72, 3 words a page, y=0\.3; as they are they have room at y=\[/);
    expect(context.room).toContain("film=[0,180)f shot s1 w0-w9: one line y=[");
    // The library is the context's files: the kit's pop is on offer.
    expect(context.files).toContain("pop audio 500ms kit to add");
  });

  it("takes an empty list of ops as an accepted round with no change: the model's say, the edit as it was", async () => {
    const qwen = scripted([answer("There is no music to add, so I left your edit as it is.", [])]);
    const result = await change(input({ request: "add some music" }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });

    expect(result.rounds).toHaveLength(1);
    expect(result.rounds[0]).toMatchObject({ outcome: "no change", ops: [], refused: null });
    expect(result.changed).toBe(false);
    expect(result.edit).toEqual(clean());
    expect(result.ops).toEqual([]);
    expect(result.say).toBe("There is no music to add, so I left your edit as it is.");
  });

  it("gives the door the library: a file to add is put in, and a sound on it, which is heard, not seen, draws no stills", async () => {
    const ops = [
      { op: "asset.add", id: "pop" },
      { op: "mark.add", shot: "s1", mark: { id: "p1", part: "sound", asset: "pop", atMs: 3200, lenMs: 400, props: { startMs: 0, volume: 0.8, fadeInMs: 0, fadeOutMs: 100 } } },
    ];
    const qwen = scripted([answer("I added a sound on “six”.", ops)]);
    const worker = drawer();
    const result = await change(input(), { ask: qwen.ask, stills: worker.stills, now: qwen.now });

    expect(result.changed).toBe(true);
    expect(result.edit.assets.map((asset) => asset.id)).toEqual(["take", "pop"]);
    expect(result.edit).toEqual(through(clean(), ops));
    expect(worker.calls).toEqual([]);
  });

  it("never changes the edit it is given", async () => {
    const given = clean();
    const copy = structuredClone(given);
    const qwen = scripted([answer("Black and white.", [{ op: "look.set", preset: "mono" }])]);
    await change(input({ edit: given, stills: false }), { ask: qwen.ask, now: qwen.now });
    expect(given).toEqual(copy);
  });
});

describe("change: repairs", () => {
  it("answers an answer that does not parse with the parse error, then applies the good one: two rounds", async () => {
    const bad = '{"say": "Bigger captions.", "ops": [';
    const parseError = (() => {
      try {
        JSON.parse(bad);
        return "";
      } catch (error) {
        return (error as Error).message;
      }
    })();
    const ops = [{ op: "word.set", asset: "take", index: 1, stress: true }];
    const qwen = scripted([{ text: bad }, answer("I stressed “two”.", ops)]);
    const result = await change(input(), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });

    expect(result.rounds.map((round) => round.outcome)).toEqual(["unreadable", "changed"]);
    expect(result.rounds[0]?.error).toContain(parseError);
    const second = qwen.calls[1]?.messages ?? [];
    expect(second.at(-2)).toEqual({ role: "assistant", content: bad });
    expect(lastUser(second)).toContain(parseError);
    expect(lastUser(second)).toContain("unchanged");
    expect(result.changed).toBe(true);
    expect(result.ops).toEqual(ops);
  });

  it("names what AnswerSchema refuses in an answer that is JSON of the wrong shape", async () => {
    const qwen = scripted([{ text: '{"say": "Done.", "ops": "none"}' }, answer("Done.", [{ op: "word.set", asset: "take", index: 1, stress: true }])]);
    const result = await change(input(), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });
    expect(result.rounds[0]?.outcome).toBe("unreadable");
    expect(lastUser(qwen.calls[1]?.messages ?? [])).toMatch(/ops: .*expected array/);
  });

  it("answers what the door refuses (a trim past the file) with each problem's path and message, then applies the good one", async () => {
    const past = [{ op: "shot.trim", id: "s1", endMs: 9000 }];
    const refused = applyOps(clean(), past, LIBRARY);
    if (refused.ok) throw new Error("the door let a trim past the file through");
    const good = [{ op: "shot.trim", id: "s1", endMs: 5900 }];
    const qwen = scripted([answer("I trimmed the end.", past), answer("I trimmed the end to the last pause.", good)]);
    const result = await change(input(), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });

    // The trim cut silence only: no word went, so there is nothing to look at (Task 14, fix round 3).
    expect(result.rounds.map((round) => round.outcome)).toEqual(["refused", "changed"]);
    expect(result.rounds[0]?.refused).toEqual(refused.problems);
    const repair = lastUser(qwen.calls[1]?.messages ?? []);
    expect(refused.problems.length).toBeGreaterThan(0);
    for (const problem of refused.problems) {
      expect(repair).toContain(problem.path);
      expect(repair).toContain(problem.message);
    }
    expect(repair).toContain('shot "s1" shows 0 to 9000 ms of "take", which is 6000 ms long');
    expect(repair).toContain("unchanged");
    expect(result.edit).toEqual(through(clean(), good));
  });

  it("answers captions moved onto the face with review's on-face finding, the edit unchanged, then applies the good one", async () => {
    const onFace = [{ op: "captions.set", y: 0.75 }];
    const found = errors(review(through(clean(), onFace), ANALYSES));
    const qwen = scripted([answer("I moved the captions down.", onFace), answer("I moved the captions down a little, above your face.", [{ op: "captions.set", y: 0.35 }])]);
    const result = await change(input({ stills: false }), { ask: qwen.ask, now: qwen.now });

    expect(result.rounds.map((round) => round.outcome)).toEqual(["review", "changed"]);
    expect(result.rounds[0]?.findings).toEqual(review(through(clean(), onFace), ANALYSES));
    const repair = lastUser(qwen.calls[1]?.messages ?? []);
    expect(found.some((finding) => finding.code === "on-face")).toBe(true);
    for (const finding of found) expect(repair).toContain(`error ${finding.code} frame=${finding.where.frame} ${finding.says}`);
    expect(repair).toContain("unchanged");
    expect(result.edit.captions.y).toBe(0.35);
    // With the error, where the captions have room as the answer set them (Task 14).
    const [onIt] = found.filter((finding) => finding.code === "on-face");
    if (!onIt) throw new Error("no on-face finding");
    const hint = roomFor(through(clean(), onFace), ANALYSES, onIt, clean());
    expect(hint).toMatch(/^Room for the captions as these ops set them: size 72, 3 words a page, y=0\.75; as they are they have room at y=\[/);
    expect(repair).toContain(`${onIt.says}. ${hint}\n`);
    expect(repair).toContain("a text the request did not name stays where it is");
    expect(repair.endsWith('Write say as a first answer to the request: the creator saw nothing of this try, so nothing was moved or fixed for them. Or, when what was asked has no room or cannot be done, send "ops": [] and say what is in the way and what would work.')).toBe(true);
  });

  it("answers a call-out put on the face with where it has room as it is, by the edit the answer would have made (Task 14)", async () => {
    // On the mouth, at 0.82 of the height; the review's on-face error, then the heights it is clear at.
    const onFace = [{ op: "mark.add", shot: "s1", mark: callout({ y: 0.82 }) }];
    const refused = through(clean(), onFace);
    const [finding] = errors(review(refused, ANALYSES)).filter((each) => each.where.mark === "c1");
    if (!finding) throw new Error("the call-out was not refused");
    const hint = roomFor(refused, ANALYSES, finding);
    expect(hint).toMatch(/^Room for it as it is: y=\[/);
    const qwen = scripted([answer("I added “SAVE”.", onFace), answer("I added “SAVE” above your face.", [{ op: "mark.add", shot: "s1", mark: callout({ y: 0.5 }) }])]);
    const result = await change(input({ stills: false }), { ask: qwen.ask, now: qwen.now });

    expect(result.rounds.map((round) => round.outcome)).toEqual(["review", "changed"]);
    expect(lastUser(qwen.calls[1]?.messages ?? [])).toContain(`- error ${finding.code} frame=${finding.where.frame} ${finding.says}. ${hint}`);
  });

  it("gives up after three bad answers: not changed, the edit it was given, and a plain say that says why", async () => {
    const past = { op: "shot.trim", id: "s1", endMs: 9000 };
    const qwen = scripted([answer("I trimmed the end.", [past]), answer("I trimmed the end.", [past]), answer("I trimmed the end again.", [past])]);
    const result = await change(input(), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });

    // Three answers judged, and a fourth call for the sentence alone, which fails here (the script has no more): the plain line.
    expect(result.rounds.map((round) => round.outcome)).toEqual(["refused", "refused", "refused", "no answer"]);
    expect(qwen.calls).toHaveLength(4);
    // Before its third answer the model is told it is its last.
    expect(lastUser(qwen.calls[1]?.messages ?? [])).not.toContain("This is your last answer");
    expect(lastUser(qwen.calls[2]?.messages ?? []).endsWith('This is your last answer: when you are not sure it passes, send "ops": [] and say what could not be done and what would work.')).toBe(true);
    expect(result.changed).toBe(false);
    expect(result.edit).toEqual(clean());
    expect(result.ops).toEqual([]);
    expect(result.findings).toEqual(review(clean(), ANALYSES));
    // The creator reads a plain line, not the door's: no ids, no file, no milliseconds; nor the refused answer's own say, which
    // tells of a change that was not made. The rounds keep the door's problems as they were.
    expect(result.say).toBe("I couldn't make that change: what I tried is not possible on this video.");
    expect(result.rounds[2]?.refused?.[0]?.message).toBe('shot "s1" shows 0 to 9000 ms of "take", which is 6000 ms long');
  });

  it("says why in plain words when the last bad answer was the review's, could not be read, or the model did not answer", async () => {
    const onFace = [{ op: "captions.set", y: 0.75 }];
    const byReview = scripted([{ text: "{" }, { text: "{" }, answer("Lower captions.", onFace)]);
    const reviewed = await change(input({ stills: false }), { ask: byReview.ask, now: byReview.now });
    expect(reviewed.say).toBe("I couldn't make that change: it would cover your face.");
    expect(reviewed.rounds[2]?.findings.map((finding) => finding.code)).toContain("on-face");

    const unread = scripted([{ text: "{" }, { text: "{" }, { text: "{" }]);
    const unreadable = await change(input(), { ask: unread.ask, stills: drawer().stills, now: unread.now });
    expect(unreadable.say).toBe("I couldn't make that change: something went wrong on my side.");

    const down = scripted([new Error("503"), new Error("503"), new Error("503")]);
    const unanswered = await change(input(), { ask: down.ask, stills: drawer().stills, now: down.now, wait: down.wait });
    expect(unanswered.say).toBe("I couldn't make that change: the editing service did not answer.");
  });

  it("asks again with the same messages when the call to the model fails, after a moment", async () => {
    const qwen = scripted([new Error("503 the model is busy"), answer("Done.", [{ op: "word.set", asset: "take", index: 1, stress: true }])]);
    const result = await change(input(), { ask: qwen.ask, stills: drawer().stills, now: qwen.now, wait: qwen.wait });
    expect(result.rounds.map((round) => round.outcome)).toEqual(["no answer", "changed"]);
    expect(result.rounds[0]?.error).toContain("503 the model is busy");
    expect(qwen.calls[1]?.messages).toEqual(qwen.calls[0]?.messages);
    expect(qwen.waits).toEqual([1000]);
    expect(result.rounds[0]?.ms).toBe(1000);
  });

  it("waits 1 s, then 2 s, between failed calls, and not after the last round", async () => {
    const qwen = scripted([new Error("429"), new Error("503"), new Error("503")]);
    const result = await change(input(), { ask: qwen.ask, stills: drawer().stills, now: qwen.now, wait: qwen.wait });
    expect(result.rounds.map((round) => round.outcome)).toEqual(["no answer", "no answer", "no answer"]);
    expect(qwen.waits).toEqual([1000, 2000]);
    expect(result.ms).toBe(3000);
  });

  it("never waits past the deadline, and asks nothing once it has passed", async () => {
    const qwen = scripted([{ fails: new Error("503"), takesMs: 49_400 }, answer("unused", [])]);
    const result = await change(input(), { ask: qwen.ask, stills: drawer().stills, now: qwen.now, wait: qwen.wait });
    expect(qwen.waits).toEqual([600]);
    expect(qwen.calls).toHaveLength(1);
    expect(result.changed).toBe(false);
    expect(result.say).toBe("I couldn't make that change: the editing service did not answer.");
  });

  it("tells a call stopped by the deadline as the deadline, and asks no more", async () => {
    const timeUp = new DOMException("The operation was aborted due to timeout", "TimeoutError");
    const qwen = scripted([{ fails: timeUp, takesMs: 50_000 }, answer("unused", [])]);
    const result = await change(input(), { ask: qwen.ask, stills: drawer().stills, now: qwen.now, wait: qwen.wait });
    expect(qwen.calls).toHaveLength(1);
    expect(qwen.waits).toEqual([]);
    expect(result.rounds).toHaveLength(1);
    expect(result.rounds[0]).toMatchObject({ outcome: "no answer", error: "the deadline passed before the model answered" });
    expect(result.say).toBe("I couldn't make that change: I ran out of time.");
  });
});

describe("change: an error the edit already had", () => {
  it("does not block an unrelated look.set", async () => {
    const given = newEdit(TAKE); // its captions at 0.8, over the mouth
    const before = errors(review(given, ANALYSES));
    expect(before.map((finding) => finding.code)).toContain("on-face");
    const qwen = scripted([answer("It is black and white now.", [{ op: "look.set", preset: "mono" }])]);
    const result = await change(input({ edit: given, stills: false }), { ask: qwen.ask, now: qwen.now });

    expect(result.rounds.map((round) => round.outcome)).toEqual(["changed"]);
    expect(result.changed).toBe(true);
    expect(result.edit.look.preset).toBe("mono");
    expect(errors(result.findings)).toEqual(errors(review(through(given, [{ op: "look.set", preset: "mono" }]), ANALYSES)));
  });

  it("does not block a trim that moves the old error's moment (the same error, at another time)", async () => {
    const given = newEdit(TAKE);
    const trim = [{ op: "shot.trim", id: "s1", startMs: 1100 }]; // at a pause's cut: the film starts 1.1 s later in the take
    const onFace = (edit: Edit) => errors(review(edit, ANALYSES)).find((finding) => finding.code === "on-face")?.says;
    expect(onFace(given)).toBe("the captions at 0.2 s cover the mouth; move them up or down");
    expect(onFace(through(given, trim))).toBe("the captions at 0.1 s cover the mouth; move them up or down");

    const qwen = scripted([answer("I cut the start.", trim), answer("I cut the start.", [])]);
    const result = await change(input({ edit: given, stills: false }), { ask: qwen.ask, now: qwen.now });
    expect(result.rounds.map((round) => round.outcome)).toEqual(["changed", "no change"]);
    expect(result.changed).toBe(true);
    expect(result.edit).toEqual(through(given, trim));
  });

  it("blocks a change that adds an error of another code, and quotes only that one", async () => {
    const given = newEdit(TAKE);
    const midWord = [{ op: "shot.trim", id: "s1", startMs: 1300 }]; // inside "three": the film starts in speech
    const made = errors(review(through(given, midWord), ANALYSES));
    expect(made.map((finding) => finding.code)).toEqual(["on-face", "under-buttons", "under-buttons", "cut-outside-pause"]);

    const qwen = scripted([answer("I cut the start.", midWord), answer("I cut the start at a pause.", [{ op: "shot.trim", id: "s1", startMs: 1100 }]), answer("I cut the start at a pause.", [])]);
    const result = await change(input({ edit: given, stills: false }), { ask: qwen.ask, now: qwen.now });
    expect(result.rounds.map((round) => round.outcome)).toEqual(["review", "changed", "no change"]);
    const repair = lastUser(qwen.calls[1]?.messages ?? []);
    const [cut] = made.filter((finding) => finding.code === "cut-outside-pause");
    expect(repair).toContain(`error cut-outside-pause frame=${cut?.where.frame} ${cut?.says}`);
    // The old errors, moved by the trim, are the edit's own: they are not told as the ops' doing.
    expect(repair).not.toContain("on-face");
    expect(repair).not.toContain("under-buttons");
  });

  it("blocks a change that turns an old error into another of the same code with other words", async () => {
    const given = newEdit(TAKE);
    const higher = [{ op: "captions.set", y: 0.65 }]; // off the mouth, onto the eyes
    expect(errors(review(through(given, higher), ANALYSES)).map((finding) => finding.says)).toEqual(["the captions at 0.2 s cover the eyes; move them up or down"]);

    const qwen = scripted([answer("I moved the captions up.", higher), answer("unused", []), answer("unused", [])]);
    const result = await change(input({ edit: given, stills: false }), { ask: qwen.ask, now: qwen.now });
    expect(result.rounds[0]?.outcome).toBe("review");
    expect(lastUser(qwen.calls[1]?.messages ?? [])).toContain("error on-face frame=6 the captions at 0.2 s cover the eyes; move them up or down");
  });
});

describe("change: a move the code makes (Task 14, fix round 1)", () => {
  const snappier = { op: "pauses.tighten", ms: 120 };

  it("makes pauses.tighten the recipe's own trims, through the door and the review: the answer's ops are the trims, the round keeps what was sent", async () => {
    const trims = tighten(clean(), ANALYSES, { pauseMs: 120 });
    expect(trims.length).toBeGreaterThan(0);
    const qwen = scripted([answer("Shorter pauses throughout.", [snappier])]);
    const result = await change(input({ stills: false }), { ask: qwen.ask, now: qwen.now });

    // It made the film shorter and cut no word: nothing to look at.
    expect(result.rounds.map((round) => round.outcome)).toEqual(["changed"]);
    expect(effectOf(clean(), through(clean(), trims))).toMatchObject({ risky: false });
    expect(effectOf(clean(), through(clean(), trims)).lines.at(-1)).toBe("no word was cut out or brought in");
    expect(result.rounds[0]?.ops).toEqual([snappier]);
    expect(result.ops).toEqual(trims);
    expect(result.edit).toEqual(through(clean(), trims));
    expect(filmFrames(result.edit)).toBeLessThan(filmFrames(clean()));
    expect(errors(result.findings)).toEqual([]);
  });

  it("makes it on the edit the ops before it leave, and passes every other op on as it is", () => {
    const before = [{ op: "shot.split", id: "s1", atMs: 2200, newId: "s2" }, { op: "shot.remove", id: "s2" }];
    const moved = withMoves(clean(), ANALYSES, [...before, snappier, { op: "look.set", preset: "mono" }], LIBRARY);
    if (!moved.ok) throw new Error("the move was refused");
    expect(moved.ops).toEqual([...before, ...tighten(through(clean(), before), ANALYSES, { pauseMs: 120 }), { op: "look.set", preset: "mono" }]);
    // What the door would refuse before it is refused as the door refuses it.
    const refused = withMoves(clean(), ANALYSES, [{ op: "shot.remove", id: "nothing" }, snappier], LIBRARY);
    expect(refused.ok).toBe(false);
    expect(refused).toEqual(applyOps(clean(), [{ op: "shot.remove", id: "nothing" }], LIBRARY));
  });

  it("refuses one with nothing to cut, or out of range, in words that say what to send, and the model answers again", async () => {
    const tight = through(clean(), tighten(clean(), ANALYSES, { pauseMs: 120 }));
    const qwen = scripted([answer("Shorter pauses.", [snappier]), answer("The pauses are as short as they go.", [])]);
    const result = await change(input({ edit: tight, stills: false }), { ask: qwen.ask, now: qwen.now });
    expect(result.rounds.map((round) => round.outcome)).toEqual(["refused", "no change"]);
    expect(result.rounds[0]?.refused).toEqual([{ path: "ops.0", id: null, message: "the cuts keep no pause longer than 120 ms: there is nothing to cut at that. A lower ms cuts more, down to 120; at 120 already, the pauses are as short as they go" }]);
    expect(lastUser(qwen.calls[1]?.messages ?? [])).toContain("the cuts keep no pause longer than 120 ms");
    // A length a little outside what the move takes is brought to its nearest end, not refused (two thirds of a short pause falls under it).
    expect(withMoves(clean(), ANALYSES, [{ op: "pauses.tighten", ms: 50 }], LIBRARY)).toEqual(withMoves(clean(), ANALYSES, [{ op: "pauses.tighten", ms: 120 }], LIBRARY));
    expect(withMoves(clean(), ANALYSES, [{ op: "pauses.tighten", ms: "short" }], LIBRARY)).toEqual({ ok: false, problems: [{ path: "ops.0", id: null, message: 'pauses.tighten takes only "ms", a whole number from 120 to 400' }] });
    expect(withMoves(clean(), ANALYSES, [{ op: "pauses.tighten", ms: 150, id: "s1" }], LIBRARY).ok).toBe(false);
  });
});

describe("change: the zoom is a move (Task 14, fix round 2)", () => {
  it("makes shot.zoom the shot.set that frames the shot tighter with every text still clear: a punch-in, or with slow a move over the shot", async () => {
    for (const slow of [false, true]) {
      const zoom = { op: "shot.zoom", id: "s1", zoom: 1.2, ...(slow ? { slow: true } : {}) };
      const framed = zoomFor(clean(), ANALYSES, "s1", 1.2, slow);
      if (!("framing" in framed)) throw new Error(`no room to zoom: ${framed.none}`);
      const qwen = scripted([answer("I punched in.", [zoom]), answer("I punched in.", [])]);
      const result = await change(input({ stills: false }), { ask: qwen.ask, now: qwen.now });
      expect(result.rounds[0]?.outcome).toBe("changed");
      expect(result.rounds[0]?.ops).toEqual([zoom]);
      expect(result.ops).toEqual([{ op: "shot.set", id: "s1", framing: framed.framing }]);
      expect(errors(result.findings)).toEqual([]);
      const framing = result.edit.shots[0]?.framing;
      expect(framing?.move === null).toBe(!slow);
      expect(slow ? framing?.move?.to.zoom : framing?.from.zoom).toBeGreaterThan(1);
      expect(slow ? framing?.move?.to.zoom : framing?.from.zoom).toBeLessThanOrEqual(1.2);
      if (slow) expect(framing).toMatchObject({ from: { zoom: 1 }, move: { ease: "linear", part: [0, 1] } });
    }
  });

  it("refuses a zoom that has no room, or that is not one, with the reason and what to do", () => {
    // A shot as tight as a zoom goes has no further to go.
    const tight = through(clean(), [{ op: "shot.set", id: "s1", framing: { from: { zoom: 1.3, x: 0, y: 0.4 }, move: null } }]);
    const none = zoomFor(tight, ANALYSES, "s1", 1.3, false);
    const refused = withMoves(tight, ANALYSES, [{ op: "shot.zoom", id: "s1", zoom: 1.3 }], LIBRARY);
    if (!("none" in none) || refused.ok) throw new Error("the zoom found room");
    expect(none.none).toBe('shot "s1" is at 1.3 already: a zoom there asks for more than that, up to 1.3');
    expect(refused.problems).toEqual([{ path: "ops.0", id: null, message: `${none.none}. Zoom the shots that have room and say which part stays as it is; or send "ops": [] and say what is in the way` }]);
    // A shot that moves already is left as it is.
    const moving = through(clean(), [{ op: "shot.set", id: "s1", framing: { from: { zoom: 1, x: 0, y: 0 }, move: { to: { zoom: 1.2, x: 0, y: 0 }, ease: "linear", part: [0, 1] } } }]);
    expect(withMoves(moving, ANALYSES, [{ op: "shot.zoom", id: "s1", zoom: 1.3 }], LIBRARY)).toMatchObject({ ok: false, problems: [{ message: expect.stringContaining('shot "s1" moves already') }] });
    expect(withMoves(clean(), ANALYSES, [{ op: "shot.zoom", id: "s1", zoom: 2 }], LIBRARY)).toEqual({ ok: false, problems: [{ path: "ops.0", id: null, message: 'shot.zoom takes "id", a shot\'s; "zoom", from 1.08 to 1.3; "slow", true for a slow zoom; and "word", the index of the word to start at' }] });
    // The least is one number everywhere (the schema, the catalogue, the search): under it is not a zoom.
    expect(withMoves(clean(), ANALYSES, [{ op: "shot.zoom", id: "s1", zoom: 1.05 }], LIBRARY).ok).toBe(false);
    expect(withMoves(clean(), ANALYSES, [{ op: "shot.zoom", id: "s1", zoom: 1.08 }], LIBRARY).ok).toBe(true);
    expect(withMoves(clean(), ANALYSES, [{ op: "shot.zoom", id: "nothing", zoom: 1.2 }], LIBRARY)).toEqual({ ok: false, problems: [{ path: "ops.0", id: null, message: 'there is no shot "nothing". Zoom the shots that have room and say which part stays as it is; or send "ops": [] and say what is in the way' }] });
  });
});

describe("change: a zoom from a word starts in the pause before it (Task 14, fix round 3)", () => {
  it("splits the shot at that pause's cut and zooms the piece from there; from the shot's first words, the shot itself", () => {
    // "five" (w4) starts at 2400: the pause before it is [2000,2400), its cut at 2200.
    expect(pauseBefore(clean(), ANALYSES, "s1", 4)).toBe(2200);
    const moved = withMoves(clean(), ANALYSES, [{ op: "shot.zoom", id: "s1", zoom: 1.2, word: 4 }], LIBRARY);
    if (!moved.ok) throw new Error(`refused: ${moved.problems[0]?.message}`);
    const piece = zoomFor(through(clean(), [{ op: "shot.split", id: "s1", atMs: 2200, newId: "s1-z" }]), ANALYSES, "s1-z", 1.2, false);
    if (!("framing" in piece)) throw new Error("the piece has no room");
    expect(moved.ops).toEqual([{ op: "shot.split", id: "s1", atMs: 2200, newId: "s1-z" }, { op: "shot.set", id: "s1-z", framing: piece.framing }]);
    const made = through(clean(), moved.ops);
    expect(errors(review(made, ANALYSES))).toEqual([]);
    expect(made.shots.map((shot) => [shot.id, shot.startMs, shot.framing.from.zoom > 1])).toEqual([["s1", 0, false], ["s1-z", 2200, true]]);
    // From a word of the shot's first phrase there is no pause before it in the shot: the shot is zoomed as it is.
    const first = withMoves(clean(), ANALYSES, [{ op: "shot.zoom", id: "s1", zoom: 1.2, word: 0 }], LIBRARY);
    expect(first.ok && first.ops).toEqual(withMoves(clean(), ANALYSES, [{ op: "shot.zoom", id: "s1", zoom: 1.2 }], LIBRARY).ok && [{ op: "shot.set", id: "s1", framing: (zoomFor(clean(), ANALYSES, "s1", 1.2, false) as { framing: unknown }).framing }]);
    // A piece of that name is there already: the new one takes the next.
    const again = withMoves(made, ANALYSES, [{ op: "shot.zoom", id: "s1", zoom: 1.2, word: 2 }], LIBRARY);
    expect(again.ok && (again.ops[0] as { newId?: string }).newId).toBe("s1-z2");
  });
});

describe("change: a say its own ops contradict is sent back (Task 14, fix round 3)", () => {
  it("tells a say of a move where the height stayed as it was: only the size changed, and the say has them higher (Task 14b)", () => {
    const was = clean().captions;
    expect(contradicts("The captions are now higher, sitting just above your chin.", [{ op: "captions.set", size: 90 }], was, { ...was, size: 90 })).toBe("your say has the captions go higher, and your ops leave them at the height they had");
    expect(contradicts("I moved the captions down a little.", [{ op: "captions.set", size: 90 }], was, { ...was, size: 90 })).toBe("your say has the captions go lower, and your ops leave them at the height they had");
    // Where they sit is not where they went: "above your chin" with nothing moved is no claim of a move.
    expect(contradicts("Larger captions, just above your chin.", [{ op: "captions.set", size: 90 }], was, { ...was, size: 90 })).toBeNull();
  });

  it("sends an answer whose own say contradicts its ops back once, naming both sides; the same answer again stands, and its sentence is asked for alone with what the ops did", async () => {
    const lower = [{ op: "captions.set", y: 0.32 }];
    const untrue = answer("I moved the captions higher, above your chin.", lower);
    const qwen = scripted([untrue, untrue, answer("The captions sit a little lower now.", [])]);
    const result = await change(input({ stills: false }), { ask: qwen.ask, now: qwen.now });
    expect(result.rounds.map((round) => round.outcome)).toEqual(["refused", "changed", "said"]);
    expect(result.rounds[0]?.refused).toEqual([{ path: "say", id: null, message: 'your say has the captions go higher, and your ops set them lower: say and ops must agree. Where there is no room for what was asked, send "ops": [] and say what is in the way and what would work' }]);
    expect(lastUser(qwen.calls[1]?.messages ?? [])).toContain("- say: your say has the captions go higher, and your ops set them lower");
    expect(result.edit.captions.y).toBe(0.32);
    expect(result.changed).toBe(true);
    const asked = lastUser(qwen.calls[2]?.messages ?? []);
    expect(asked).toContain("Your ops were taken, and the edit stands as they left it whatever you send now. Your sentence was not taken: your say has the captions go higher, and your ops set them lower.");
    expect(asked).toContain("What your ops did, as measured:\n- the captions: y 0.3 to 0.32 (lower)");
    // The answer it is asked about comes before the request for the sentence.
    expect(textOf(qwen.calls[2]?.messages.at(-2))).toContain("I moved the captions higher");
    expect(result.say).toBe("The captions sit a little lower now.");
    expect(result.sayBy).toBe("model, asked again");
  });

  it("tells each way a say and the captions' ops can disagree, and nothing where they agree or where other things changed too", () => {
    const was = clean().captions;
    const set = (over: object) => [{ op: "captions.set", ...over }];
    expect(contradicts("Moved them lower.", set({ y: 0.2 }), was, { ...was, y: 0.2 })).toBe("your say has the captions go lower, and your ops set them higher");
    expect(contradicts("Bigger captions.", set({ size: 60 }), was, { ...was, size: 60 })).toBe("your say has the captions bigger, and your ops set them smaller");
    expect(contradicts("Smaller captions.", set({ size: 90 }), was, { ...was, size: 90 })).toBe("your say has the captions smaller, and your ops set them bigger");
    expect(contradicts("Moved them up.", set({ y: 0.2 }), was, { ...was, y: 0.2 })).toBeNull();
    expect(contradicts("Larger captions, up to two words a line.", set({ size: 90, maxWords: 2 }), was, { ...was, size: 90, maxWords: 2 })).toBeNull();
    expect(contradicts("Bigger captions, a little lower.", set({ size: 90, y: 0.34 }), was, { ...was, size: 90, y: 0.34 })).toBeNull();
    // Both directions said: not for code to tell. Another op with it: the words may be about that.
    expect(contradicts("Moved the captions up a little, not down.", set({ y: 0.34 }), was, { ...was, y: 0.34 })).toBeNull();
    expect(contradicts("Moved the title higher.", [...set({ y: 0.34 }), { op: "item.set", id: "hook", props: { y: 0.1 } }], was, { ...was, y: 0.34 })).toBeNull();
    expect(contradicts("Higher.", [], was, was)).toBeNull();
  });

  it("does not place captions against the direction an answer moved them: asked lower, never set higher", async () => {
    // Asked on a pill at 200 px and lower, with a line held right under them: where the largest that fits has room is not
    // lower, so the code places nothing and the review answers.
    const held = through(clean(), [{ op: "item.add", item: { id: "line", part: "title", anchor: "start", at: 0, frames: null, props: { text: "Back at it", font: "tiktok", look: "bold", y: 0.4, size: 96, color: "#ffffff", accent: null } } }]);
    expect(errors(review(held, ANALYSES))).toEqual([]);
    const lowerAndBig = [{ op: "captions.set", look: "pill", size: 200, y: 0.34 }];
    const fit = captionsFit(through(held, lowerAndBig), ANALYSES, held);
    expect(fit && fit.y <= held.captions.y).toBe(true);
    const qwen = scripted([answer("Big captions on a pill, a little lower.", lowerAndBig), answer("There is no room for that.", [])]);
    const result = await change(input({ edit: held, request: "big captions on a pill, lower", stills: false }), { ask: qwen.ask, now: qwen.now });
    expect(result.rounds[0]?.outcome).toBe("review");
    expect(result.edit).toEqual(held);
  });
});

describe("contradicts: strict and simple, since it costs only the wording (the final fix wave's rerun, and the last correction)", () => {
  const was = clean().captions;
  const set = (over: object) => [{ op: "captions.set", ...over }];
  const pop = { ...was, look: "pop" as const };
  const HIGHER = "your say has the captions go higher, and your ops leave them at the height they had";
  const LOWER = "your say has the captions go lower, and your ops leave them at the height they had";
  const MOVED = "your say has the captions moved, and your ops leave them at the height they had";

  it("does not take a word of where something is for a move: above, below and bottom neither claim one nor hide one", () => {
    // The say of the rerun: "lower", with the height as it was; "above the app bars" used to switch the check off.
    expect(contradicts("The captions are now bold and sit lower on the screen, adjusted to fit above the app bars.", set({ look: "pop" }), was, pop)).toBe(LOWER);
    expect(contradicts("The captions sit higher now, clear of the bottom bar.", set({ look: "pop" }), was, pop)).toBe(HIGHER);
    expect(contradicts("Higher captions, no longer below your chin.", set({ look: "pop" }), was, pop)).toBe(HIGHER);
    // A move the other way than said is told whatever place the say names with it.
    expect(contradicts("Moved the captions up from the bottom.", set({ y: 0.34 }), was, { ...was, y: 0.34 })).toBe("your say has the captions go higher, and your ops set them lower");
    expect(contradicts("The captions sit lower now, above the buttons.", set({ y: 0.2 }), was, { ...was, y: 0.2 })).toBe("your say has the captions go lower, and your ops set them higher");
    // Where they sit, with nothing moved, is no claim of a move: the true says of the take whose captions cannot go lower.
    for (const say of ["The captions are now bold and sit just above the bottom bar where there is room.", "Bold captions, below your chin as before.", "The bold style is on and the captions sit at the lowest clear height.", "Bold captions, at the lowest place they fit.", "Bigger captions at the highest size that still fits."]) expect(contradicts(say, set({ look: "pop" }), was, pop), say).toBeNull();
  });

  it("tells a move the ops did not make, whatever else the say tells: no word excuses another", () => {
    expect(contradicts("The captions are now bold and moved to the lowest position that fits without overlapping the app bars.", set({ look: "pop" }), was, pop)).toBe(MOVED);
    expect(contradicts("I moved the captions and made them bold.", set({ look: "pop" }), was, pop)).toBe(MOVED);
    // The three the re-review found passing behind "can't", "already" and "no room".
    expect(contradicts("The captions moved lower so they can't cover your chin.", set({ look: "pop" }), was, pop)).toBe(LOWER);
    expect(contradicts("Lower captions, already in the bold style.", set({ look: "pop" }), was, pop)).toBe(LOWER);
    expect(contradicts("The captions sit lower now; there was no room for them higher.", set({ look: "pop" }), was, pop)).toBe(MOVED);
    // And a say that tells why they did not go is told as well: it names the move. It costs the wording, never the change.
    expect(contradicts("The captions are bold now; there is no room to move them lower.", set({ look: "pop" }), was, pop)).toBe(LOWER);
    // With a height the ops did move, the same words are true.
    expect(contradicts("Moved to the lowest position that fits.", set({ look: "pop", y: 0.34 }), was, { ...pop, y: 0.34 })).toBeNull();
    expect(contradicts("I moved the captions and made them bold.", set({ look: "pop", y: 0.2 }), was, { ...pop, y: 0.2 })).toBeNull();
  });

  it("tells a count of words a page the ops do not set", () => {
    const two = { ...was, size: 100, maxWords: 2 };
    expect(was.maxWords).toBe(3);
    // The say of the rerun: its ops set two words a page.
    expect(contradicts("The captions are now as large as they can be while keeping three words on each line.", set({ size: 100, maxWords: 2 }), was, two)).toBe("your say has the captions at 3 words a page, and your ops leave them at 2");
    expect(contradicts("Bigger captions, 4 words at a time.", set({ size: 100, maxWords: 2 }), was, two)).toBe("your say has the captions at 4 words a page, and your ops leave them at 2");
    expect(contradicts("Bigger captions, one word at a time.", set({ size: 100 }), was, { ...was, size: 100 })).toBe("your say has the captions at 1 words a page, and your ops leave them at 3");
    // The count they have, alone or beside the one they had, agrees.
    expect(contradicts("The captions are larger now, fitting two words per line to keep them clear.", set({ size: 100, maxWords: 2 }), was, two)).toBeNull();
    expect(contradicts("Larger captions, two words at a time instead of three words.", set({ size: 100, maxWords: 2 }), was, two)).toBeNull();
    expect(contradicts("Larger captions: instead of three words, two words at a time.", set({ size: 100, maxWords: 2 }), was, two)).toBeNull();
    expect(contradicts("Bigger captions, still three words a page.", set({ size: 100 }), was, { ...was, size: 100 })).toBeNull();
    // No count named: nothing to hold.
    expect(contradicts("The captions are larger now, with fewer words at a time.", set({ size: 100, maxWords: 2 }), was, two)).toBeNull();
  });
});

describe("sayFault: why a say cannot be shown, asked once the edit is settled (the last correction)", () => {
  const was = clean().captions;
  const none = { request: "make it better", ops: [] as unknown[], was, is: was };
  const bigger = { request: "make it better", ops: [{ op: "captions.set", size: 90 }], was, is: { ...was, size: 90 } };

  it("passes a plain English sentence that agrees with what happened", () => {
    expect(sayFault("The captions are larger now.", bigger)).toBeNull();
    expect(sayFault("There is no music on offer to add.", none)).toBeNull();
    expect(sayFault("The title reads “Wait. What? 90px!” now.", { ...bigger, ops: [{ op: "item.set", id: "hook", props: { text: "Wait. What? 90px!" } }] })).toBeNull();
    // What a say quotes is the creator's own text, not its wording: a kit word in it is none.
    expect(sayFault('The call-out reads "Pop quiz: mono or pill" as you say it.', { ...bigger, ops: [{ op: "mark.set", id: "c1", props: { text: "Pop quiz: mono or pill" } }] })).toBeNull();
  });

  it("tells each fault in words the model can act on", () => {
    expect(sayFault(" \n", bigger)).toBe("your say is blank");
    expect(sayFault("a".repeat(601), bigger)).toBe("your say is longer than 600 characters: one short sentence");
    expect(sayFault("Die Untertitel sind jetzt größer.", bigger)).toContain("your say is not in English");
    expect(sayFault("The captions are larger. They also read better.", bigger)).toBe("your say runs to more than one sentence: say it in one short sentence");
    for (const say of ["The captions are 90 px now.", "Each pause is 160 ms now.", "They sit at y=0.21 now.", "Die Untertitel sind 90 Pixel groß."]) expect(sayFault(say, bigger), say).not.toBeNull();
    expect(sayFault("I applied the mono look preset to the entire film.", { ...bigger, ops: [{ op: "look.set", preset: "mono" }] })).toContain('your say names "preset", "mono"');
    expect(sayFault("Your captions are on a pill now.", { ...bigger, request: "put the captions on a pill", ops: [{ op: "captions.set", look: "pill" }] })).toBeNull();
    expect(sayFault("I've made you taller.", none)).toContain("nothing was changed");
    expect(sayFault("The captions are moved higher, but the title blocks that space.", none)).toContain("nothing was changed");
    expect(sayFault("The captions sit higher now.", bigger)).toBe("your say has the captions go higher, and your ops leave them at the height they had");
  });

  it("counts sentences outside what a say quotes", () => {
    expect(sentencesOf("The hook now reads “Stop. Look. Listen.”.")).toBe(1);
    expect(sentencesOf("I cut the first 1.5 seconds; nothing else is touched.")).toBe(1);
    expect(sentencesOf("Done. It looks great!")).toBe(2);
  });
});

describe("change: the edit and the sentence are judged apart (the last correction, 2026-11-24)", () => {
  const bold = [{ op: "captions.set", look: "pop" }];
  const past = { op: "shot.trim", id: "s1", endMs: 9000 };

  it("keeps the change and the model's own sentence when it is true: one call (a say of the lowest place was sent back on every round, and the change lost)", async () => {
    const qwen = scripted([answer("The captions are bold now and sit at the lowest clear height.", bold)]);
    const result = await change(input({ request: "bold captions, lower", stills: false }), { ask: qwen.ask, now: qwen.now });
    expect(qwen.calls).toHaveLength(1);
    expect(result.rounds.map((round) => round.outcome)).toEqual(["changed"]);
    expect(result.edit.captions.look).toBe("pop");
    expect(result.say).toBe("The captions are bold now and sit at the lowest clear height.");
    expect(result.sayBy).toBe("model");
  });

  it("does not let the creator read a move that was not made: the answer is sent back once, then the edit stands, the sentence is asked for alone, and then the code writes it", async () => {
    const untrue = answer("The captions moved lower so they can't cover your chin.", bold);
    const qwen = scripted([untrue, untrue, answer("The captions moved lower so they can't cover your chin.", []), answer("unused", [])]);
    const result = await change(input({ request: "bold captions, lower", stills: false }), { ask: qwen.ask, now: qwen.now });
    // Two rounds for the edit, one call for the sentence, and no more.
    expect(qwen.calls).toHaveLength(3);
    expect(result.rounds.map((round) => round.outcome)).toEqual(["refused", "changed", "refused"]);
    expect(result.rounds[2]?.refused).toEqual([{ path: "say", id: null, message: "your say has the captions go lower, and your ops leave them at the height they had" }]);
    expect(result.changed).toBe(true);
    expect(result.edit.captions.look).toBe("pop");
    expect(result.ops).toEqual(bold);
    expect(result.say).toBe(saidOf(clean(), result.edit));
    expect(result.say).toBe("The captions are bold white words now.");
    expect(result.sayBy).toBe("code");
  });

  it("a true say called a contradiction costs one round and never the change (it named the move that could not be made): the look is kept in two calls", async () => {
    const honest = answer("The captions are bold now; there is no room to move them lower.", bold);
    const qwen = scripted([honest, honest, answer("The captions are bold now.", [])]);
    const result = await change(input({ request: "bold captions, lower", stills: false }), { ask: qwen.ask, now: qwen.now });
    expect(result.rounds.map((round) => round.outcome)).toEqual(["refused", "changed", "said"]);
    expect(result.rounds[0]?.refused?.[0]?.message).toContain("your say has the captions go lower, and your ops leave them at the height they had: say and ops must agree");
    // The look is in after the second call; the third is for the sentence alone.
    expect(result.rounds[1]?.outcome).toBe("changed");
    expect(result.edit.captions.look).toBe("pop");
    expect(result.say).toBe("The captions are bold now.");
  });

  it("captions asked higher and answered with larger ones and \"higher\": the swap is sent back; with no ops next the true reason is said, and with the same answer again the edit stands under a true sentence of the code's", async () => {
    const swap = answer("The captions are now higher, sitting above your chin.", [{ op: "captions.set", size: 80 }]);
    const honest = scripted([swap, answer("There is no room higher: they would cover the app's top bar.", [])]);
    const refused = await change(input({ request: "Put the captions higher, above my chin.", stills: false }), { ask: honest.ask, now: honest.now });
    expect(refused.rounds.map((round) => round.outcome)).toEqual(["refused", "no change"]);
    expect(refused.rounds[0]?.refused?.[0]?.message).toBe('your say has the captions go higher, and your ops leave them at the height they had: say and ops must agree. Where there is no room for what was asked, send "ops": [] and say what is in the way and what would work');
    expect(refused.changed).toBe(false);
    expect(refused.edit).toEqual(clean());
    expect(refused.say).toBe("There is no room higher: they would cover the app's top bar.");
    expect(refused.sayBy).toBe("model");
    // The same answer again: once is all, the edit stands, and what the creator reads is true.
    const again = scripted([swap, swap, answer("The captions are now higher.", []), answer("unused", [])]);
    const kept = await change(input({ request: "Put the captions higher, above my chin.", stills: false }), { ask: again.ask, now: again.now });
    expect(again.calls).toHaveLength(3);
    expect(kept.rounds.map((round) => round.outcome)).toEqual(["refused", "changed", "refused"]);
    expect(kept.edit.captions.size).toBe(80);
    expect(kept.say).toBe("The captions are bigger.");
    expect(kept.sayBy).toBe("code");
  });

  it("sends such an answer back never twice in a change, and never on the last round", async () => {
    const swap = answer("The captions are now higher.", [{ op: "captions.set", size: 80 }]);
    // Another contradiction after the one send-back: taken.
    const other = scripted([swap, answer("The captions are now lower.", [{ op: "captions.set", size: 90 }]), answer("The captions are larger now.", [])]);
    const twice = await change(input({ stills: false }), { ask: other.ask, now: other.now });
    expect(twice.rounds.map((round) => round.outcome)).toEqual(["refused", "changed", "said"]);
    expect(twice.edit.captions.size).toBe(90);
    // On the last round: taken at once, where a send-back would lose the change.
    const late = scripted([{ text: "{" }, { text: "{" }, swap, answer("The captions are larger now.", [])]);
    const last = await change(input({ stills: false }), { ask: late.ask, now: late.now });
    expect(last.rounds.map((round) => round.outcome)).toEqual(["unreadable", "unreadable", "changed", "said"]);
    expect(last.edit.captions.size).toBe(80);
    expect(last.say).toBe("The captions are larger now.");
  });

  it("does not send an answer back for what the code's own placing made of its captions: that say is judged at the end, against the edit as it is", async () => {
    // A face from 0.2 to 0.77 with its lip at 0.72: under it three words a page cannot be larger than 90 px, and two can.
    const words = ["so", "today", "I", "want", "to", "show", "you", "something", "about", "editing", "that", "creators", "really", "never", "talk", "about"].map((text, i) => ({ text, startMs: 200 + i * 350, endMs: 450 + i * 350 }));
    const take: Asset = { ...TAKE, id: "t1", ms: 6000, words };
    const analyses: Analyses = { t1: { language: "en", pauses: [], loudness: null, faces: Array.from({ length: 30 }, (_, i) => ({ ms: i * 200, face: { x: 0.25, y: 0.2, w: 0.5, h: 0.57 }, mouth: { x: 0.4, y: 0.62, w: 0.2, h: 0.1 } })) } };
    const base: Edit = { ...newEdit(take), captions: { ...DEFAULT_CAPTIONS, look: "pop", size: 90, y: 0.76, maxWords: 3 } };
    expect(errors(review(base, analyses))).toEqual([]);
    const qwen = scripted([answer("Bigger captions, three words at a time.", [{ op: "captions.set", size: 96 }]), answer("Bigger captions now.", [])]);
    const result = await change({ edit: base, analyses, request: "bigger captions", library: [take], user: "u1", deadlineMs: 50_000, stills: false }, { ask: qwen.ask, now: qwen.now });
    // The code set them at two words a page, where 96 px has room: the model's ops did what its say told, so it is not sent back.
    expect(result.rounds.map((round) => round.outcome)).toEqual(["changed", "said"]);
    expect(result.edit.captions).toMatchObject({ size: 96, maxWords: 2 });
    expect(lastUser(qwen.calls[1]?.messages ?? [])).toContain("Your sentence was not taken: your say has the captions at 3 words a page, and your ops leave them at 2.");
    expect(result.say).toBe("Bigger captions now, with fewer words at a time, where they stay clear of your face and the apps' buttons.");
  });

  it("holds a say in another language on every path: with no ops, twice, the creator reads the code's line; after two refusals as well; over a change, what the code measured", async () => {
    const claim = answer("Ich habe die Untertitel höher gesetzt.", []);
    const first = scripted([claim, claim, answer("unused", [])]);
    const none = await change(input({ request: "Setz die Untertitel höher.", stills: false }), { ask: first.ask, now: first.now });
    expect(first.calls).toHaveLength(2);
    expect(none.rounds.map((round) => round.outcome)).toEqual(["no change", "refused"]);
    expect(none.rounds[1]?.refused?.[0]?.message).toContain("your say is not in English");
    expect(none.changed).toBe(false);
    expect(none.say).toBe("I couldn't make that change.");
    expect(none.sayBy).toBe("code");
    // On the last round, after the door refused two answers: the same, with the door's reason in a creator's words.
    const late = scripted([answer("Trimmed.", [past]), answer("Trimmed.", [past]), claim, claim, answer("unused", [])]);
    const third = await change(input({ request: "Setz die Untertitel höher.", stills: false }), { ask: late.ask, now: late.now });
    expect(late.calls).toHaveLength(4);
    expect(third.rounds.map((round) => round.outcome)).toEqual(["refused", "refused", "no change", "refused"]);
    expect(third.say).toBe("I couldn't make that change: what I tried is not possible on this video.");
    // Over ops that raise the captions, a German "lower" twice: the change stands and the sentence is the code's.
    const raise = [{ op: "captions.set", y: 0.2 }];
    const wrong = scripted([answer("Die Untertitel sind jetzt tiefer.", raise), answer("Die Untertitel sind jetzt tiefer.", [])]);
    const raised = await change(input({ request: "tiefer", stills: false }), { ask: wrong.ask, now: wrong.now });
    expect(raised.edit.captions.y).toBe(0.2);
    expect(raised.say).toBe("The captions are higher.");
    expect(raised.sayBy).toBe("code");
    // And an English sentence the second time is taken.
    const right = scripted([answer("Die Untertitel sind jetzt höher.", raise), answer("The captions sit higher now.", [])]);
    const told = await change(input({ request: "höher", stills: false }), { ask: right.ask, now: right.now });
    expect(textOf(right.calls[0]?.messages[0])).toContain("in English whatever language the request is in");
    expect(lastUser(right.calls[0]?.messages ?? [])).toContain("request:\nhöher");
    expect(lastUser(right.calls[1]?.messages ?? [])).toContain("Your sentence was not taken: your say is not in English");
    expect(told.say).toBe("The captions sit higher now.");
    expect(told.sayBy).toBe("model, asked again");
  });

  it("never spends a round on a sentence: a say in pixels, in the kit's words, blank, endless or of two sentences comes with a change that is kept at once", async () => {
    const larger = [{ op: "captions.set", size: 80 }];
    for (const say of ["I increased the captions to 80 pixels.", "The captions are at y=0.3 and 80 px.", "I applied captions.set to the caption item.", " ", "a".repeat(601), "The captions are larger. They look great now."]) {
      const qwen = scripted([answer(say, larger), answer("The captions are larger now.", [])]);
      const result = await change(input({ stills: false }), { ask: qwen.ask, now: qwen.now });
      expect(result.rounds.map((round) => round.outcome), say).toEqual(["changed", "said"]);
      expect(result.edit.captions.size, say).toBe(80);
      expect(result.say, say).toBe("The captions are larger now.");
    }
    // A say that is missing altogether is no reason to read the answer as unreadable either.
    const bare = scripted([{ text: JSON.stringify({ ops: larger }) }, answer("The captions are larger now.", [])]);
    const kept = await change(input({ stills: false }), { ask: bare.ask, now: bare.now });
    expect(kept.rounds.map((round) => round.outcome)).toEqual(["changed", "said"]);
    expect(lastUser(bare.calls[1]?.messages ?? [])).toContain("Your sentence was not taken: your say is blank.");
  });

  it("takes a change on the last round whatever its sentence, where a faulty one used to cost it", async () => {
    const mono = [{ op: "look.set", preset: "mono" }];
    const qwen = scripted([{ text: "{" }, { text: "{" }, answer("Set the mono preset at 160 ms.", mono), answer("Still the mono preset.", [])]);
    const result = await change(input({ stills: false }), { ask: qwen.ask, now: qwen.now });
    expect(result.rounds.map((round) => round.outcome)).toEqual(["unreadable", "unreadable", "changed", "refused"]);
    expect(qwen.calls).toHaveLength(4);
    expect(result.edit.look.preset).toBe("mono");
    expect(result.say).toBe("The video is in black and white.");
  });

  it("writes the sentence itself when time is short, or when the call for it fails or cannot be read", async () => {
    const larger = [{ op: "captions.set", size: 80 }];
    // 49 s of the 50 gone: no call for the sentence.
    const slow = scripted([answer("I increased the captions to 80 pixels.", larger, { takesMs: 49_000 }), answer("unused", [])]);
    const late = await change(input({ stills: false }), { ask: slow.ask, now: slow.now });
    expect(slow.calls).toHaveLength(1);
    expect(late.say).toBe("The captions are bigger.");
    expect(late.sayBy).toBe("code");
    const down = scripted([answer("I increased the captions to 80 pixels.", larger), new Error("503")]);
    const failed = await change(input({ stills: false }), { ask: down.ask, now: down.now, wait: down.wait });
    expect(failed.rounds.map((round) => round.outcome)).toEqual(["changed", "no answer"]);
    expect(failed.say).toBe("The captions are bigger.");
    const junk = scripted([answer("I increased the captions to 80 pixels.", larger), { text: "{" }]);
    const unread = await change(input({ stills: false }), { ask: junk.ask, now: junk.now });
    expect(unread.rounds.map((round) => round.outcome)).toEqual(["changed", "unreadable"]);
    expect(unread.say).toBe("The captions are bigger.");
    expect(unread.edit.captions.size).toBe(80);
  });

  it("with nothing changed, the sentence is the model's only when it claims no change; else it is asked once, and then the code's line stands", async () => {
    const taller = scripted([answer("I've made you taller.", []), answer("The edit cannot change how tall you are.", [])]);
    const told = await change(input({ stills: false }), { ask: taller.ask, now: taller.now });
    expect(told.rounds.map((round) => round.outcome)).toEqual(["no change", "said"]);
    expect(lastUser(taller.calls[1]?.messages ?? [])).toContain("Your last sentence was not taken: your say tells the creator of a change, and nothing was changed");
    expect(lastUser(taller.calls[1]?.messages ?? [])).toContain(closingMessage());
    expect(told.say).toBe("The edit cannot change how tall you are.");
    expect(told.sayBy).toBe("model, asked again");
    const twice = scripted([answer("I've made you taller.", []), answer("You are taller now.", []), answer("unused", [])]);
    const never = await change(input({ stills: false }), { ask: twice.ask, now: twice.now });
    expect(twice.calls).toHaveLength(2);
    expect(never.say).toBe("I couldn't make that change.");
    expect(never.changed).toBe(false);
  });

  it("asks for the sentence with what is wrong with it and what the ops did, or as the closing call does with nothing changed", () => {
    expect(sayAgainMessage("your say is blank", true, ["the captions: size 72 to 80 (bigger)"])).toBe('Your ops were taken, and the edit stands as they left it whatever you send now. Your sentence was not taken: your say is blank.\n\nWhat your ops did, as measured:\n- the captions: size 72 to 80 (bigger)\n\nAnswer with {"say": string, "ops": []} only: one short plain sentence in English that tells the creator what they will see, and nothing your ops did not do.');
    expect(sayAgainMessage("your say is blank", true, [])).not.toContain("as measured");
    expect(sayAgainMessage("your say is blank", false, [])).toBe(`${closingMessage()} Your last sentence was not taken: your say is blank.`);
  });
});

describe("change: captions with no room as they were set are placed by the code (Task 14, fix round 2)", () => {
  it("sets them at the largest size that has room, in the look asked for, and says so after the model's own sentence", async () => {
    // A line held under the captions for the whole film: on a pill at 200 px the captions have no place over it and under the
    // apps' top bars. The model asked only for the look and the size.
    const held = through(clean(), [{ op: "item.add", item: { id: "line", part: "title", anchor: "start", at: 0, frames: null, props: { text: "Back at it", font: "tiktok", look: "bold", y: 0.46, size: 96, color: "#ffffff", accent: null } } }]);
    expect(errors(review(held, ANALYSES))).toEqual([]);
    const big = [{ op: "captions.set", look: "pill", size: 200 }];
    const asked = through(held, big);
    // The review tells it of the captions, or of the line they would cover: the captions' doing either way.
    expect(errors(review(asked, ANALYSES)).length).toBeGreaterThan(0);
    const qwen = scripted([answer("Captions on a pill, much bigger.", big), answer("Captions on a pill, much bigger.", [])]);
    const result = await change(input({ edit: held, request: "captions on a pill, much bigger", stills: false }), { ask: qwen.ask, now: qwen.now });

    expect(result.rounds.map((round) => round.outcome)).toEqual(["changed"]);
    expect(result.ops).toHaveLength(2);
    expect(result.ops[0]).toEqual(big[0]);
    expect(result.ops[1]).toMatchObject({ op: "captions.set" });
    expect(Object.keys(result.ops[1] ?? {}).sort()).toEqual(["maxWords", "op", "size", "y"]);
    expect(result.edit.captions.look).toBe("pill");
    // Larger than they were, and smaller than asked or with fewer words a page: what has room.
    expect(result.edit.captions.size).toBeGreaterThan(clean().captions.size);
    expect(result.edit.captions.size < 200 || result.edit.captions.maxWords < clean().captions.maxWords).toBe(true);
    expect(errors(result.findings)).toEqual([]);
    // One sentence still: the code's part joins the model's own.
    expect(result.say).toBe(`Captions on a pill, much bigger, ${placedSay(clean().captions, asked.captions, result.edit.captions)}.`);
    expect(result.say).toMatch(/^Captions on a pill, much bigger, (as large as fits|with fewer words at a time, where they stay) clear of your face and the apps' buttons/);
    expect(result.say.split(/[.!?]\s/)).toHaveLength(1);
  });

  it("leaves a place that was asked for to the model: captions with room elsewhere are refused with where, not moved back", async () => {
    const onFace = [{ op: "captions.set", y: 0.75 }];
    const qwen = scripted([answer("Lower captions.", onFace), answer("There is no room lower.", [])]);
    const result = await change(input({ stills: false }), { ask: qwen.ask, now: qwen.now });
    expect(result.rounds.map((round) => round.outcome)).toEqual(["review", "no change"]);
    expect(result.edit).toEqual(clean());
  });

  it("says what it did in the creator's words, as the end of the say's own sentence: as large as fits, a little smaller, fewer words at a time", () => {
    const was = clean().captions;
    expect(placedSay(was, { ...was, size: 120 }, { ...was, size: 100, maxWords: 2 })).toBe("as large as fits clear of your face and the apps' buttons, with fewer words at a time");
    expect(placedSay(was, { ...was, look: "pill" }, { ...was, look: "pill", size: 60 })).toBe("a little smaller so they stay clear of your face and the apps' buttons");
    expect(placedSay(was, { ...was, look: "pill" }, { ...was, look: "pill", y: 0.4 })).toBe("where they stay clear of your face and the apps' buttons");
    expect(placedSay(was, { ...was, size: 200 }, { ...was, size: 200, maxWords: 1 })).toBe("with fewer words at a time, where they stay clear of your face and the apps' buttons");
    // Joined to the say: its full stop goes, a comma and the code's part come, and it stays one sentence.
    expect(withPlaced("The captions are on a pill.", "a little smaller so they stay clear of your face and the apps' buttons")).toBe("The captions are on a pill, a little smaller so they stay clear of your face and the apps' buttons.");
    expect(withPlaced("Pill captions!  ", "where they stay clear of your face and the apps' buttons")).toBe("Pill captions, where they stay clear of your face and the apps' buttons.");
    // A part the model's sentence says already is not said twice (the second proof: "… from here to the end, from here to the end.").
    expect(withPlaced("The camera pushes in tighter on you from here to the end.", "from here to the end")).toBe("The camera pushes in tighter on you from here to the end.");
    expect(withPlaced("The camera pushes in from Here to the End of the film.", "from here to the end")).toBe("The camera pushes in from Here to the End of the film.");
    expect(withPlaced("The camera pushes in until the end", "from here to the end")).toBe("The camera pushes in until the end, from here to the end.");
  });
});

describe("change: told what its change did, the model may take it back (Task 14, fix round 2)", () => {
  const cut = [{ op: "shot.trim", id: "s1", startMs: 2200 }]; // at a pause's cut: "One two three four" go

  it("is told the film's new length and the words cut out, and with undo the edit is as it was: not changed, and its new sentence", async () => {
    const qwen = scripted([answer("I cut the first second.", cut), answer("I can't cut just one second without cutting into your words.", [{ op: "undo" }])]);
    const result = await change(input({ request: "cut out the first second", stills: false }), { ask: qwen.ask, now: qwen.now });

    expect(lastUser(qwen.calls[1]?.messages ?? [])).toContain('What your ops did, as measured:\n- the film is now 3.8 s; it was 6.0 s (2.2 s shorter)\n- words cut out of the film: w0 to w3 (4 words: "One two three four")');
    expect(result.rounds.map((round) => round.outcome)).toEqual(["changed", "undone"]);
    expect(result.changed).toBe(false);
    expect(result.ops).toEqual([]);
    expect(result.edit).toEqual(clean());
    expect(result.findings).toEqual(review(clean(), ANALYSES));
    expect(result.say).toBe("I can't cut just one second without cutting into your words.");
  });

  it("takes undo only after it was told: as a first answer it is no operation, and the door says so", async () => {
    const qwen = scripted([answer("Undone.", [{ op: "undo" }]), answer("Nothing to undo.", [])]);
    const result = await change(input({ stills: false }), { ask: qwen.ask, now: qwen.now });
    expect(result.rounds.map((round) => round.outcome)).toEqual(["refused", "no change"]);
  });

  it("looks at no change that cut nothing, moved no length and took nothing out: a look, a word, the captions", async () => {
    for (const ops of [[{ op: "look.set", preset: "mono" }], [{ op: "word.set", asset: "take", index: 1, stress: true }], [{ op: "captions.set", highlight: "#ff0000" }]]) {
      const qwen = scripted([answer("Done.", ops)]);
      const result = await change(input({ stills: false }), { ask: qwen.ask, now: qwen.now });
      expect(result.rounds.map((round) => round.outcome)).toEqual(["changed"]);
      expect(effectOf(clean(), result.edit).risky).toBe(false);
    }
  });
});

describe("change: when no answer was taken, the model is asked for the sentence alone (Task 14, fix round 2)", () => {
  const past = { op: "shot.trim", id: "s1", endMs: 9000 };

  it("asks once more, for say only, and gives that sentence; ops it sends with it are not looked at", async () => {
    const qwen = scripted([answer("Trimmed.", [past]), answer("Trimmed.", [past]), answer("Trimmed.", [past]), answer("Your take is six seconds long, so there is nothing after that to show.", [{ op: "look.set", preset: "mono" }])]);
    const result = await change(input({ stills: false }), { ask: qwen.ask, now: qwen.now });
    expect(result.rounds.map((round) => round.outcome)).toEqual(["refused", "refused", "refused", "said"]);
    expect(lastUser(qwen.calls[3]?.messages ?? []).endsWith(closingMessage())).toBe(true);
    expect(closingMessage()).toContain('Answer with {"say": string, "ops": []} only');
    expect(result.say).toBe("Your take is six seconds long, so there is nothing after that to show.");
    expect(result.changed).toBe(false);
    expect(result.edit).toEqual(clean());
    // Its tokens and cost are counted with the rounds'.
    expect(result.tokens).toEqual({ input: 4 * 9000, output: 4 * 120 });
  });

  it("takes the closing sentence without ops beside it", async () => {
    const qwen = scripted([answer("Trimmed.", [past]), answer("Trimmed.", [past]), answer("Trimmed.", [past]), { text: JSON.stringify({ say: "There is nothing after six seconds to show." }) }]);
    const result = await change(input({ stills: false }), { ask: qwen.ask, now: qwen.now });
    expect(result.rounds.at(-1)?.outcome).toBe("said");
    expect(result.say).toBe("There is nothing after six seconds to show.");
  });

  it("does not ask after answers that could only not be read, nor with under two seconds left", async () => {
    const unread = scripted([{ text: "{" }, { text: "{" }, { text: "{" }, answer("unused", [])]);
    const unreadable = await change(input({ stills: false }), { ask: unread.ask, now: unread.now });
    expect(unread.calls).toHaveLength(3);
    expect(unreadable.say).toBe("I couldn't make that change: something went wrong on my side.");
    // Three answers of 16.5 s each leave half a second of the 50.
    const slow = scripted([answer("Trimmed.", [past], { takesMs: 16_500 }), answer("Trimmed.", [past], { takesMs: 16_500 }), answer("Trimmed.", [past], { takesMs: 16_500 }), answer("unused", [])]);
    const late = await change(input({ stills: false }), { ask: slow.ask, now: slow.now });
    expect(slow.calls).toHaveLength(3);
    expect(late.say).toBe("I couldn't make that change: what I tried is not possible on this video.");
  });
});

describe("change: a framing that brings a text onto the face (Task 14, fix round 1)", () => {
  it("answers it with the review's error and the move that frames a shot", async () => {
    // Zoomed to 1.6 on the picture's bottom, the face low in the frame rises under the title: the review refuses.
    const titled = through(clean(), [{ op: "item.add", item: { id: "hook", part: "title", anchor: "start", at: 0, frames: 60, props: { text: "Back at it", font: "tiktok", look: "bold", y: 0.5, size: 96, color: "#ffffff", accent: null } } }]);
    expect(errors(review(titled, ANALYSES))).toEqual([]);
    const zoom = [{ op: "shot.set", id: "s1", framing: { from: { zoom: 1.6, x: 0, y: 1 }, move: null } }];
    const fresh = errors(review(through(titled, zoom), ANALYSES));
    expect(fresh.some((finding) => finding.code === "on-face")).toBe(true);
    const qwen = scripted([answer("I punched in.", zoom), answer("There is no room to punch in.", [])]);
    const result = await change(input({ edit: titled, stills: false }), { ask: qwen.ask, now: qwen.now });
    expect(result.rounds.map((round) => round.outcome)).toEqual(["review", "no change"]);
    const repair = lastUser(qwen.calls[1]?.messages ?? []);
    expect(repair).toContain("\nFrame a shot with shot.zoom, never by hand: it holds the face where it is and keeps every text clear of it, or says why it cannot.\nAnswer again");
  });
});

describe("change: the warnings an edit came with (Task 14)", () => {
  /** The clean edit with a call-out for 300 ms, clear of the face: the review warns that it is too short to read. */
  const short = () => through(clean(), [{ op: "mark.add", shot: "s1", mark: { ...callout({ y: 0.5 }), id: "old", atMs: 1200, lenMs: 300 } }]);
  const findingsOf = (message: string) => message.slice(message.indexOf("findings:\n") + "findings:\n".length).split("\n\n")[0];

  it("are not shown to the model, which is shown every error: they are the creator's to live with", async () => {
    const warned = review(short(), ANALYSES);
    expect(warned.map((finding) => [finding.code, finding.severity, finding.where.mark])).toEqual([["short-text", "warn", "old"]]);
    const qwen = scripted([answer("Black and white.", [{ op: "look.set", preset: "mono" }])]);
    const result = await change(input({ edit: short(), stills: false }), { ask: qwen.ask, now: qwen.now });
    expect(findingsOf(lastUser(qwen.calls[0]?.messages ?? []))).toBe("none");
    // The answer still tells them all.
    expect(result.findings.map((finding) => finding.code)).toEqual(["short-text"]);

    // An error the edit came with is shown, whole.
    const onFace = through(short(), [{ op: "captions.set", y: 0.75 }]);
    const [error] = errors(review(onFace, ANALYSES));
    const again = scripted([answer("Black and white.", [{ op: "look.set", preset: "mono" }])]);
    await change(input({ edit: onFace, stills: false }), { ask: again.ask, now: again.now });
    expect(findingsOf(lastUser(again.calls[0]?.messages ?? []))).toBe(`error ${error?.code} frame=${error?.where.frame} ${error?.says}`);
  });

  it("does not show a text touching an app's zone, which the review grades as still read", async () => {
    // A title of two lines at 0.2: its top touches Instagram's top bar (a warning), clear of the face low in the frame.
    const add = [{ op: "item.add", item: { id: "t1", part: "title", anchor: "start", at: 0, frames: 60, props: { text: "Bread that never fails", font: "tiktok", look: "bold", y: 0.2, size: 130, color: "#ffffff", accent: null } } }];
    const made = review(through(through(clean(), [{ op: "captions.set", y: 0.45 }]), add), ANALYSES).filter((finding) => finding.where.item === "t1");
    expect(made.map((finding) => [finding.code, finding.severity])).toEqual([["under-buttons", "warn"]]);
    const qwen = scripted([answer("I added a title.", add), answer("I added a title.", [])]);
    await change(input({ edit: through(clean(), [{ op: "captions.set", y: 0.45 }]) }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });
    // None before and none shown now: the findings are as before.
    const shown = lastUser(qwen.calls[1]?.messages ?? []);
    expect(shown).toContain("findings: as before");
    expect(shown).not.toContain("under-buttons");
  });

  it("shows, with the stills, the warning its own change brought, without its fix, and not the one the edit came with", async () => {
    const add = [{ op: "mark.add", shot: "s1", mark: { ...callout({ y: 0.5 }), atMs: 3200, lenMs: 300 } }];
    const qwen = scripted([answer("I added “SAVE”.", add), answer("I added “SAVE”.", [])]);
    await change(input({ edit: short() }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });
    const made = review(through(short(), add), ANALYSES).filter((finding) => finding.where.mark === "c1");
    expect(made.map((finding) => finding.code)).toEqual(["short-text"]);
    expect(findingsOf(lastUser(qwen.calls[1]?.messages ?? []))).toBe(`warn short-text frame=${made[0]?.where.frame} the call-out "SAVE" at 3.2 s shows for 0.3 s, too short to read`);
  });
});

describe("change: stills", () => {
  it("draws a call-out once it has come in, and the middle of the film, and shows them to the model once", async () => {
    const ops = [{ op: "mark.add", shot: "s1", mark: callout() }];
    const made = through(clean(), ops);
    const place = placed(made).find((thing) => thing.thing.id === "c1");
    if (!place) throw new Error("the call-out does not show");
    // The call-out starts on frame 96 and pops in over 12 frames: it is drawn on its 13th, settled, never past its middle.
    const frames = [Math.floor(filmFrames(made) / 2), place.at + 12];
    expect(frames).toEqual([90, 108]);

    const qwen = scripted([answer("I added “SAVE” when you say six.", ops), answer("“SAVE” reads well, clear of your face.", [])]);
    const worker = drawer();
    const result = await change(input({ request: "add SAVE when I say six" }), { ask: qwen.ask, stills: worker.stills, now: qwen.now });

    expect(worker.calls).toHaveLength(1);
    expect(worker.calls[0]).toMatchObject({ user: "u1", edit: made, frames });
    expect(worker.calls[0]?.signal).toBeInstanceOf(AbortSignal);
    expect(result.rounds.map((round) => round.outcome)).toEqual(["changed", "no change"]);
    expect(result.rounds[0]?.stills).toEqual(frames);
    expect(result.changed).toBe(true);
    expect(result.ops).toEqual(ops);
    expect(result.edit).toEqual(made);
    // No ops after the stills: the change stands as it was made, and so does what was said of it (Task 14). The second say is
    // written looking at the changed edit, and reads like a second step.
    expect(result.say).toBe("I added “SAVE” when you say six.");

    const second = qwen.calls[1]?.messages ?? [];
    const look = second.at(-1);
    expect(look?.role).toBe("user");
    if (!look || typeof look.content === "string") throw new Error("the stills are not sent as parts");
    const images = look.content.flatMap((part) => (part.type === "image_url" ? [part.image_url.url] : []));
    expect(images).toEqual(frames.map((frame) => `data:image/jpeg;base64,${jpegOf(frame)}`));
    const text = textOf(look);
    expect(text).toContain("frame 90: the middle of the film");
    expect(text).toContain("frame 108: callout c1");
    expect(text).toContain('Here is how it looks. Hold what your ops did against the request, and judge only your own change: it reads at a glance, clear of the face. If it is what was asked and nothing more, answer with "ops": []. If it is not what was asked (another length, another direction, words cut that were not meant) or more than was asked, answer with [{"op":"undo"}] alone, which takes it all back');
    expect(text).toContain("say is the one message the creator gets about the whole change, written as if it was made in one go");
    expect(text).toContain("add SAVE when I say six");
    // The edit as it is now, since the ops changed it; the rest is as before.
    expect(text).toContain(`edit:\n${contextOf(made, ANALYSES, review(made, ANALYSES), LIBRARY).edit}`);
    expect(text).toContain("words: as before");
    expect(second.at(-2)).toEqual({ role: "assistant", content: JSON.stringify({ say: "I added “SAVE” when you say six.", ops }) });
  });

  it("applies one repair after the stills, through the door and review, and draws no more", async () => {
    const add = [{ op: "mark.add", shot: "s1", mark: callout() }];
    // A little lower, still clear of the captions at 0.3 (at 0.25 the call-out would cover them: review's on-text, Task 10b).
    const fix = [{ op: "mark.set", id: "c1", props: { y: 0.22 } }];
    const qwen = scripted([answer("I added “SAVE”.", add), answer("I moved “SAVE” a little lower.", fix)]);
    const worker = drawer();
    const result = await change(input(), { ask: qwen.ask, stills: worker.stills, now: qwen.now });

    expect(worker.calls).toHaveLength(1);
    expect(result.rounds.map((round) => round.outcome)).toEqual(["changed", "changed"]);
    expect(result.rounds[1]?.stills).toEqual([]);
    expect(result.ops).toEqual([...add, ...fix]);
    expect(result.edit).toEqual(through(through(clean(), add), fix));
    expect(result.say).toBe("I moved “SAVE” a little lower.");
  });

  it("stops after the one repair even when the door refuses it, with the edit and the say of the round it last accepted", async () => {
    const add = [{ op: "mark.add", shot: "s1", mark: callout() }];
    const qwen = scripted([answer("I added “SAVE”.", add), answer("I moved it.", [{ op: "mark.set", id: "nothing", props: { y: 0.25 } }]), answer("unused", [])]);
    const result = await change(input(), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });

    expect(result.rounds.map((round) => round.outcome)).toEqual(["changed", "refused"]);
    expect(qwen.calls).toHaveLength(2);
    expect(result.changed).toBe(true);
    expect(result.edit).toEqual(through(clean(), add));
    expect(result.ops).toEqual(add);
    expect(result.say).toBe("I added “SAVE”.");
  });

  it("draws nothing for a word.set alone", async () => {
    const qwen = scripted([answer("Done.", [{ op: "word.set", asset: "take", index: 3, hidden: true }])]);
    const worker = drawer();
    await change(input(), { ask: qwen.ask, stills: worker.stills, now: qwen.now });
    expect(worker.calls).toEqual([]);
  });

  it("draws nothing with stills: false", async () => {
    const qwen = scripted([answer("I added “SAVE”.", [{ op: "mark.add", shot: "s1", mark: callout() }])]);
    const worker = drawer();
    const result = await change(input({ stills: false }), { ask: qwen.ask, stills: worker.stills, now: qwen.now });
    expect(worker.calls).toEqual([]);
    expect(result.rounds).toHaveLength(1);
    expect(result.changed).toBe(true);
  });

  it("keeps the accepted edit when the stills fail, with no stills and the reason, and asks no more", async () => {
    const ops = [{ op: "mark.add", shot: "s1", mark: callout() }];
    const qwen = scripted([answer("I added “SAVE”.", ops), answer("unused", [])]);
    const worker = drawer("the worker could not be reached");
    const result = await change(input(), { ask: qwen.ask, stills: worker.stills, now: qwen.now });

    expect(worker.calls).toHaveLength(1);
    expect(qwen.calls).toHaveLength(1);
    expect(result.changed).toBe(true);
    expect(result.edit).toEqual(through(clean(), ops));
    expect(result.rounds[0]).toMatchObject({ outcome: "changed", stills: [], stillsError: "the worker could not be reached" });
    expect(result.say).toBe("I added “SAVE”.");
  });

  it("draws the captions where they first show, a shot set to a new framing, and a shot's look", async () => {
    const ops = [
      { op: "shot.split", id: "s1", atMs: 2200, newId: "s2" },
      { op: "captions.set", size: 96 },
      { op: "shot.set", id: "s2", framing: { from: { zoom: 1.2, x: 0, y: 0 }, move: null } },
      { op: "look.set", shot: "s1", preset: "warm" },
    ];
    const qwen = scripted([answer("Bigger captions, closer on the second half, warmer at the start.", ops), answer("Looks right.", [])]);
    const worker = drawer();
    await change(input(), { ask: qwen.ask, stills: worker.stills, now: qwen.now });

    // The first word ("One") is said from frame 6; the captions are drawn 8 frames into it. Shot s1 fills frames 0 to 66 and s2
    // 66 to 180: each is drawn at its middle. The middle of the film is frame 90.
    expect(worker.calls[0]?.frames).toEqual([14, 33, 90, 123]);
    const text = textOf(qwen.calls[1]?.messages.at(-1));
    expect(text).toContain("frame 14: the captions");
    expect(text).toContain("frame 33: shot s1");
    expect(text).toContain("frame 123: shot s2");
  });
});

describe("change: time", () => {
  it("stops once the deadline has passed after round 1", async () => {
    const past = [{ op: "shot.trim", id: "s1", endMs: 9000 }];
    const qwen = scripted([answer("I trimmed the end.", past, { takesMs: 60_000 }), answer("unused", [])]);
    const result = await change(input(), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });

    expect(qwen.calls).toHaveLength(1);
    expect(result.rounds).toHaveLength(1);
    expect(result.changed).toBe(false);
    expect(result.edit).toEqual(clean());
  });

  it("draws no stills once the deadline has passed, and keeps the accepted edit", async () => {
    const ops = [{ op: "mark.add", shot: "s1", mark: callout() }];
    const qwen = scripted([answer("I added “SAVE”.", ops, { takesMs: 60_000 })]);
    const worker = drawer();
    const result = await change(input(), { ask: qwen.ask, stills: worker.stills, now: qwen.now });
    expect(worker.calls).toEqual([]);
    expect(result.changed).toBe(true);
    expect(result.edit).toEqual(through(clean(), ops));
  });

  it("asks nothing when the deadline has passed already", async () => {
    const qwen = scripted([]);
    const result = await change(input({ deadlineMs: 0 }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });
    expect(qwen.calls).toEqual([]);
    expect(result).toMatchObject({ rounds: [], changed: false, ops: [], cost: 0, say: "I couldn't make that change: I ran out of time." });
  });

  it("adds up the rounds' tokens, cost (each call priced on its own) and time", async () => {
    const usage = [{ input: 12_000, output: 400 }, { input: 40_000, output: 300 }];
    const qwen = scripted([
      { text: "{", usage: usage[0], takesMs: 2_500 },
      answer("Done.", [{ op: "word.set", asset: "take", index: 1, stress: true }], { usage: usage[1], takesMs: 3_000 }),
    ]);
    const result = await change(input(), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });

    expect(result.rounds.map((round) => round.tokens)).toEqual(usage);
    expect(result.tokens).toEqual({ input: 52_000, output: 700 });
    const each = usage.map((one) => calculateCost(QWEN_REASONING_MODEL, { prompt_tokens: one.input, completion_tokens: one.output }));
    expect(result.cost).toBeCloseTo(each[0]! + each[1]!, 12);
    // The second call is past 32K input, so it is priced in the dearer band: pricing the sum at once would differ.
    expect(result.cost).not.toBeCloseTo(calculateCost(QWEN_REASONING_MODEL, { prompt_tokens: 52_000, completion_tokens: 700 }), 12);
    expect(result.rounds.map((round) => round.ms)).toEqual([2_500, 3_000]);
    expect(result.rounds.map((round) => round.askMs)).toEqual([2_500, 3_000]);
    expect(result.ms).toBe(5_500);
  });
});

describe("the log", () => {
  it("has one line for a change, with its rounds, tokens, cost and time, and none of the edit's words, the request or its files", async () => {
    const qwen = scripted([answer("I added “SAVE” when you say six.", [{ op: "mark.add", shot: "s1", mark: callout() }]), answer("Looks right.", [])]);
    const result = await change(input({ request: "add SAVE when I say six" }), { ask: qwen.ask, stills: drawer().stills, now: qwen.now });

    const lines = logged.info.mock.calls.map((call) => call.map(String).join(" ")).filter((line) => line.includes("a change"));
    expect(lines).toHaveLength(1);
    const [line = ""] = lines;
    const fields = JSON.parse(line.slice(line.indexOf("{"))) as Record<string, unknown>;
    expect(fields).toMatchObject({ module: "edit.agent", changed: true, rounds: 2, outcomes: ["changed", "no change"], roundMs: [1000, 1000], stills: 2, tokens: result.tokens, cost: result.cost, ms: result.ms, sayBy: "model" });
    for (const word of [...WORDS.map((one) => one.text), "SAVE", "add SAVE when I say six", "u1/take.mp4", "edit-media", "Looks right"]) {
      expect(line).not.toMatch(new RegExp(`\\b${word}\\b`));
    }
  });

  it("warns of a failed call with its round and the call's error, and of failed stills with theirs, and nothing of the edit", async () => {
    const qwen = scripted([new Error("503 the model is busy"), answer("I added “SAVE”.", [{ op: "mark.add", shot: "s1", mark: callout() }])]);
    await change(input(), { ask: qwen.ask, stills: drawer("the worker could not be reached").stills, now: qwen.now, wait: qwen.wait });
    const warned = logged.warn.mock.calls.map((call) => call.map(String).join(" "));
    expect(warned).toHaveLength(2);
    expect(warned[0]).toContain('"round":1,"error":"503 the model is busy"');
    expect(warned[1]).toContain('"round":2,"error":"the worker could not be reached"');
    expect(warned.join(" ")).not.toMatch(/SAVE|u1\/take\.mp4/);
  });
});

describe("AnswerSchema", () => {
  it("takes a say of up to 600 characters and up to 200 ops", () => {
    expect(AnswerSchema.safeParse({ say: "a".repeat(600), ops: Array.from({ length: 200 }, () => ({})) }).success).toBe(true);
  });

  it.each([
    ["over 200 ops", { say: "Done.", ops: Array.from({ length: 201 }, () => ({})) }, "ops"],
    ["no ops", { say: "Done." }, "ops"],
  ])("refuses %s", (_, json, path) => {
    const read = AnswerSchema.safeParse(json);
    expect(read.success).toBe(false);
    expect(read.error?.issues.map((issue) => issue.path.join("."))).toEqual([path]);
  });

  it("reads an answer whatever its sentence: endless, blank, missing, in pixels (the sentence is judged apart, by sayFault)", () => {
    for (const json of [{ say: "a".repeat(601), ops: [] }, { say: " \n\t", ops: [] }, { say: "", ops: [] }, { ops: [] }, { say: 7, ops: [] }, { say: "Each pause is 160 ms now, at 90px and y=0.2.", ops: [] }]) {
      const read = AnswerSchema.safeParse(json);
      expect(read.success, JSON.stringify(json).slice(0, 40)).toBe(true);
      expect(typeof read.data?.say).toBe("string");
    }
    expect(AnswerSchema.parse({ ops: [] }).say).toBe("");
  });
});

describe("a say in plain words (Task 14): the measures a say may not hold", () => {
  const about = { request: "make it better", ops: [] as unknown[], was: clean().captions, is: clean().captions };

  it("tells a length in milliseconds every time, as a size in pixels, in English, German or Italian", () => {
    for (const say of ["Each pause is 160 ms.", "The pauses are down to 160 milliseconds.", "Die Untertitel sind 90 Pixel groß.", "Pausen von 160 Millisekunden.", "90px", "to 90 px", "at y = 0.2"]) expect(sayFault(say, about), say).not.toBeNull();
  });

  it("takes numbers that are not measures: a count of words, seconds, a quoted title", () => {
    for (const say of ["Two words at a time fit there.", "I cannot cut the first 1.5 seconds.", "A title that reads “Top 10 pixel tricks” has no room there.", "It cannot stay about a third bigger."]) expect(sayFault(say, about), say).toBeNull();
  });
});

describe("AGENT_LIMITS", () => {
  it("holds the design's limits, thinking off and 4,000 tokens by Task 14's measures (X88), and the model's look off (X115)", () => {
    look(false);
    expect(AGENT_LIMITS).toEqual({ rounds: 3, changeMs: 50_000, firstCutMs: 170_000, maxTokens: 4000, thinking: false, look: false });
  });
});

describe("the kit's words in a say", () => {
  it("finds a preset, a look by its name, an operation, a mark, an item, a shot's id and pixels", () => {
    expect(kitTerms("I applied a mono look preset to the entire film.", "Black and white please.")).toEqual(["preset", "mono"]);
    expect(kitTerms("Captions in the pop style now.", "Change the caption style.")).toEqual(["pop"]);
    expect(kitTerms("I used shot.zoom on s1-t1 and moved the item.", "Zoom in.")).toEqual(["op", "item", "shot id"]);
    expect(kitTerms("One op added a mark at 90px.", "Add a call-out.")).toEqual(["op", "mark", "px"]);
    expect(kitTerms("Set to 90 pixels with the pill box.", "Bigger captions.")).toEqual(["pill", "px"]);
    expect(kitTerms("Three operations on the items.", "Tidy it.")).toEqual(["op", "item"]);
    expect(kitTerms("The pauses are down to 160 ms each.", "Tighter.")).toEqual(["ms"]);
    expect(kitTerms("Each pause is 160 milliseconds now.", "Tighter.")).toEqual(["ms"]);
  });

  it("leaves a word the creator used, and words that only hold one", () => {
    expect(kitTerms("The captions are in the pill style.", "Use the pill caption style.")).toEqual([]);
    expect(kitTerms("It's black and white now.", "Black and white please.")).toEqual([]);
    // "popular", "remarkable", "stop", "opposite", "e.g." and a time are no kit words.
    expect(kitTerms("A popular, remarkable stop on the opposite side, e.g. after 1.5 seconds.", "x")).toEqual([]);
    expect(kitTerms("Added “New tool” above your head as you say it.", "Add a call-out.")).toEqual([]);
  });
});

describe("change: the model's look is off (X115, Task 14b)", () => {
  beforeEach(() => look(false));

  it("draws no stills and asks nothing more after a change that is seen: one call, and the change stands", async () => {
    const qwen = scripted([answer("A call-out as you say it.", [{ op: "mark.add", shot: "s1", mark: callout() }])]);
    const worker = drawer();
    const result = await change(input(), { ask: qwen.ask, stills: worker.stills, now: qwen.now });
    expect(worker.calls).toHaveLength(0);
    expect(qwen.calls).toHaveLength(1);
    expect(result.rounds.map((round) => round.outcome)).toEqual(["changed"]);
    expect(result.rounds[0]?.stills).toEqual([]);
    expect(result.changed).toBe(true);
  });

  it("still tells the model what a change did when it cut words or took a part out, with no pictures, and takes an undo", async () => {
    const cut = [{ op: "shot.trim", id: "s1", startMs: 2200 }];
    const qwen = scripted([answer("The opening is shorter.", cut), answer("Cutting there would take four of your words out; the opening can go up to the first pause.", [{ op: "undo" }])]);
    const worker = drawer();
    const result = await change(input({ request: "trim the opening" }), { ask: qwen.ask, stills: worker.stills, now: qwen.now });
    expect(worker.calls).toHaveLength(0);
    expect(lastUser(qwen.calls[1]?.messages ?? [])).toContain('words cut out of the film: w0 to w3 (4 words: "One two three four")');
    expect(lastUser(qwen.calls[1]?.messages ?? [])).not.toContain("Here is how it looks");
    expect(result.rounds.map((round) => round.outcome)).toEqual(["changed", "undone"]);
    expect(result.edit).toEqual(clean());
  });
});

describe("change: a say never claims what did not happen (Task 14b, ruling 1)", () => {
  const past = { op: "shot.trim", id: "s1", endMs: 9000 };

  it("tells a say that claims a change from one that does not", () => {
    for (const say of ["I've added a slow zoom to the first shot.", "Added “Save” above your head.", "The whole video is now quicker.", "The label has been removed.", "It's in slow motion now.", "I can't do that, but I've zoomed in instead.", "I changed the look, but I could not move them."]) expect(claimsChange(say), say).toBe(true);
    for (const say of ["I couldn't move the label: it would cover your face.", "I have made no changes.", "I can't add that; nothing was changed.", "There is no room there; I kept them where they are.", "That cannot be cut without clipping a word; the nearest clean cut is after your second sentence.", "I made no other changes."]) expect(claimsChange(say), say).toBe(false);
  });

  it("reads the passive too: are moved, is applied", () => {
    for (const say of ["The captions are moved higher, but the title blocks that space.", "The darker style is applied.", "The pauses are now trimmed."]) expect(claimsChange(say), say).toBe(true);
    for (const say of ["The captions are not moved: there is no room.", "They are where they were.", "I can't add that, so nothing is changed.", "No cut is made there: it would clip a word."]) expect(claimsChange(say), say).toBe(false);
  });

  it("does not take a closing say that claims a change: the loop's own line stands, with no second call for it", async () => {
    const qwen = scripted([answer("Trimmed.", [past]), answer("Trimmed.", [past]), answer("Trimmed.", [past]), answer("The video is now shorter at the end.", []), answer("unused", [])]);
    const result = await change(input({ stills: false }), { ask: qwen.ask, now: qwen.now });
    expect(qwen.calls).toHaveLength(4);
    expect(result.rounds.map((round) => round.outcome)).toEqual(["refused", "refused", "refused", "refused"]);
    expect(result.rounds[3]?.refused?.[0]?.message).toContain("nothing was changed");
    expect(result.say).toBe("I couldn't make that change: what I tried is not possible on this video.");
    expect(result.sayBy).toBe("code");
    expect(result.changed).toBe(false);
    expect(result.edit).toEqual(clean());
  });

  it("reads a closing say as any say is read: one with a size in pixels is not taken, and the loop's own line stands", async () => {
    const qwen = scripted([answer("Trimmed.", [past]), answer("Trimmed.", [past]), answer("Trimmed.", [past]), answer("A title at 90px has no room there.", [])]);
    const result = await change(input({ stills: false }), { ask: qwen.ask, now: qwen.now });
    expect(result.rounds.at(-1)?.outcome).toBe("refused");
    expect(result.say).toBe("I couldn't make that change: what I tried is not possible on this video.");
  });

  it("holds the say after an undo to it as well: asked once for the sentence, and else the loop's own line", async () => {
    const cut = [{ op: "shot.trim", id: "s1", startMs: 2200 }];
    const undone = answer("I can't shorten it that way, but I've zoomed in on you.", [{ op: "undo" }]);
    const again = scripted([answer("The opening is shorter.", cut), undone, answer("Cutting there would take your first words out.", [])]);
    const first = await change(input({ stills: false }), { ask: again.ask, now: again.now });
    expect(first.rounds.map((round) => round.outcome)).toEqual(["changed", "undone", "said"]);
    expect(first.say).toBe("Cutting there would take your first words out.");
    expect(first.edit).toEqual(clean());
    const twice = scripted([answer("The opening is shorter.", cut), undone, answer("I've moved the cut.", []), answer("unused", [])]);
    const second = await change(input({ stills: false }), { ask: twice.ask, now: twice.now });
    expect(twice.calls).toHaveLength(3);
    expect(second.say).toBe("I couldn't make that change: what I tried was not what you asked for.");
    expect(second.changed).toBe(false);
  });
});

describe("change: what the room offers the captions is what the loop takes (the final review)", () => {
  const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });
  const asset = (texts: string[], gapMs: number, lenMs: number): Asset => ({ ...TAKE, id: "t1", ms: 6000, words: texts.map((text, i) => ({ text, startMs: 200 + i * gapMs, endMs: 200 + i * gapMs + lenMs })) });
  /** The heights the room's first line names for the captions as they are. */
  const offered = (edit: Edit, analyses: Analyses): number[] => {
    const line = (contextOf(edit, analyses, []).room.split("\n")[0] ?? "").split(". ")[0] ?? "";
    const ranges = [...line.slice(line.indexOf("room at ")).matchAll(/\[(\d\.\d\d),(\d\.\d\d)\]/g)].map((match) => [Number(match[1]), Number(match[2])] as const);
    return ROOM_YS.filter((y) => ranges.some(([from, to]) => y >= from - 1e-9 && y <= to + 1e-9));
  };
  /** True when the real loop takes captions moved to `y` as sent: changed in its first round, at that height, nothing else touched. */
  const taken = async (edit: Edit, analyses: Analyses, library: readonly Asset[], y: number): Promise<boolean> => {
    const qwen = scripted([answer("Your captions sit elsewhere.", [{ op: "captions.set", y }]), answer("There is no room there.", []), answer("There is no room there.", []), answer("There is no room there.", [])]);
    const result = await change({ edit, analyses, request: "move the captions", library, user: "u1", deadlineMs: 50_000, stills: false }, { ask: qwen.ask, now: qwen.now });
    return result.rounds[0]?.outcome === "changed" && JSON.stringify(result.edit.captions) === JSON.stringify({ ...edit.captions, y });
  };

  /** Forty heights through the real loop, each with the room worked out again. */
  const SWEEP_MS = 30_000;

  it("on a clean edit: every height it names is taken as sent, and no height it leaves out is (a height on the nose was)", { timeout: SWEEP_MS }, async () => {
    // The reviewer's case: a face from 0.3 to 0.66, its mouth from 0.56 to 0.61, captions under the lip at 0.72.
    const take = asset(["Bread", "rises", "when", "the", "dough", "is", "warm", "enough", "every", "time"], 560, 450);
    const analyses: Analyses = { t1: { language: "en", pauses: [], loudness: null, faces: Array.from({ length: 30 }, (_, i) => ({ ms: i * 200, face: box(0.25, 0.3, 0.5, 0.36), mouth: box(0.42, 0.56, 0.16, 0.05) })) } };
    const made = applyOps(newEdit(take), [{ op: "captions.set", look: "pop", size: 72, y: 0.72, maxWords: 3 }], [take]);
    if (!made.ok) throw new Error("no edit");
    expect(errors(review(made.edit, analyses))).toEqual([]);
    const named = offered(made.edit, analyses);
    expect(named).toContain(0.72);
    // On the nose: no place in the room, and the loop no longer takes it (it took 0.52 with "touches the chin").
    expect(named).not.toContain(0.52);
    expect(errors(review({ ...made.edit, captions: { ...made.edit.captions, y: 0.52 } }, analyses)).map((finding) => finding.code)).toContain("on-face");
    for (const y of ROOM_YS.filter((each) => each !== 0.72)) expect(await taken(made.edit, analyses, [take], y), `y=${y}`).toBe(named.includes(y));
  });

  it("on an edit that starts with a captions error: the same, by the one rule (the room said no height and the loop took three)", { timeout: SWEEP_MS }, async () => {
    // The reviewer's case: a small face high up for four seconds, then a close-up whose mouth the captions cover.
    const take = asset(Array.from({ length: 16 }, (_, i) => `w${i}`), 350, 250);
    const faces = Array.from({ length: 30 }, (_, i) => (i * 200 < 4000 ? { ms: i * 200, face: box(0.3, 0.15, 0.4, 0.25), mouth: box(0.42, 0.32, 0.16, 0.05) } : { ms: i * 200, face: box(0.1, 0.3, 0.8, 0.55), mouth: box(0.3, 0.7, 0.4, 0.12) }));
    const analyses: Analyses = { t1: { language: "en", pauses: [], loudness: null, faces } };
    const edit: Edit = { ...newEdit(take), captions: { ...DEFAULT_CAPTIONS, look: "pop", size: 72, y: 0.75, maxWords: 3 } };
    expect(errors(review(edit, analyses)).map((finding) => finding.code)).toContain("on-face");
    const named = offered(edit, analyses);
    expect(named.length).toBeGreaterThan(0);
    for (const y of ROOM_YS) {
      const moved = { ...edit, captions: { ...edit.captions, y } };
      expect(named.includes(y), `the rule at y=${y}`).toBe(!captionsWorse(edit, moved, analyses));
      expect(await taken(edit, analyses, [take], y), `y=${y}`).toBe(named.includes(y));
    }
  });

  it("on an edit that starts with an error on another text: the same (the room went by the error's code, the loop by its sentence, seven heights apart)", { timeout: SWEEP_MS }, async () => {
    // The re-reviewer's case: a line held over the whole film with a call-out on it at 3.2 s; the face low; the captions clear at 0.3.
    const take = asset(["One", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"], 560, 450);
    const analyses: Analyses = { t1: { language: "en", pauses: [], loudness: null, faces: Array.from({ length: 30 }, (_, i) => ({ ms: i * 200, face: box(0.2, 0.6, 0.6, 0.3), mouth: box(0.4, 0.8, 0.2, 0.05) })) } };
    const made = applyOps(newEdit(take), [
      { op: "captions.set", y: 0.3 },
      { op: "item.add", item: { id: "line", part: "title", anchor: "start", at: 0, frames: null, props: { text: "Back at it", font: "tiktok", look: "bold", y: 0.46, size: 96, color: "#ffffff", accent: null } } },
    ], [take]);
    if (!made.ok) throw new Error("no edit");
    const shot = made.edit.shots[0];
    if (!shot) throw new Error("no shot");
    const edit: Edit = { ...made.edit, shots: [{ ...shot, marks: [{ id: "c1", part: "callout", atMs: 3200, lenMs: 1200, props: { text: "Two words", font: "tiktok", look: "pop", x: 0.5, y: 0.46, size: 96, color: "#ffffff" } }] }] };
    expect(errors(review(edit, analyses)).map((finding) => finding.code)).toEqual(["on-text", "on-text"]);
    const named = offered(edit, analyses);
    expect(named).toContain(0.3);
    // On the line the title's error turns into another sentence ("covers the captions"): no place, for the room as for the loop.
    expect(named).not.toContain(0.46);
    for (const y of ROOM_YS.filter((each) => each !== 0.3)) expect(await taken(edit, analyses, [take], y), `y=${y}`).toBe(named.includes(y));
  });

  it("a call-out on the nose is refused by the loop as the room leaves it out", async () => {
    const take = asset(["Bread", "rises", "when", "the", "dough", "is", "warm", "enough", "every", "time"], 560, 450);
    const analyses: Analyses = { t1: { language: "en", pauses: [], loudness: null, faces: Array.from({ length: 30 }, (_, i) => ({ ms: i * 200, face: box(0.25, 0.3, 0.5, 0.36), mouth: box(0.42, 0.56, 0.16, 0.05) })) } };
    const made = applyOps(newEdit(take), [{ op: "captions.set", look: "pop", size: 72, y: 0.72, maxWords: 3 }], [take]);
    if (!made.ok) throw new Error("no edit");
    const mark = { id: "c1", part: "callout", atMs: 2400, lenMs: 1200, props: { text: "Dough", font: "tiktok", look: "pop", x: 0.5, y: 0.52, size: 130, color: "#ffe14a" } };
    const qwen = scripted([answer("The word comes up as you say it.", [{ op: "mark.add", shot: "s1", mark }]), answer("There is no room there.", []), answer("There is no room there.", []), answer("There is no room there.", [])]);
    const result = await change({ edit: made.edit, analyses, request: "Add a call-out when I say dough.", library: [take], user: "u1", deadlineMs: 50_000, stills: false }, { ask: qwen.ask, now: qwen.now });
    expect(result.rounds[0]?.outcome).toBe("review");
    expect(result.rounds[0]?.findings?.filter((finding) => finding.severity === "error").map((finding) => finding.says).join(" ")).toContain("covers the nose");
    expect(result.edit).toEqual(made.edit);
  });
});

describe("change: say is English in this part (X120, the final review)", () => {
  it("tells a German or an Italian sentence from an English one, whatever it quotes", () => {
    for (const say of ["Ich habe die Untertitel vergrößert.", "Die Untertitel sind jetzt größer.", "Ho ingrandito i sottotitoli.", "I sottotitoli ora sono più grandi.", "Das Video ist jetzt in Schwarzweiß."]) expect(notEnglish(say), say).toBe(true);
    for (const say of ["The captions are larger now.", "The hook now reads “Guten Morgen, das ist neu und nicht alt”.", 'A call-out for "Ciao, non per te" appears as you say it.', "The video is now in black and white.", "There is no room higher; they stay where they are.", "Two words per page above your hat now.", "Colours cooler; title removed.", "Done.", "Your café clip is warmer now.", "The title is now on the right, über-large as you asked."]) expect(notEnglish(say), say).toBe(false);
    // A short one with a letter English does not write is told too.
    expect(notEnglish("Video gekürzt.")).toBe(true);
  });

  it("holds the closing say to it as well: a German one is not taken, and the loop's own line stands", async () => {
    const past = { op: "shot.trim", id: "s1", endMs: 9000 };
    const qwen = scripted([answer("Trimmed.", [past]), answer("Trimmed.", [past]), answer("Trimmed.", [past]), answer("Ich habe das Video gekürzt und es ist jetzt kürzer.", []), answer("unused", [])]);
    const result = await change(input({ request: "Kürze das Ende.", stills: false }), { ask: qwen.ask, now: qwen.now });
    expect(qwen.calls).toHaveLength(4);
    expect(result.rounds.at(-1)?.refused?.[0]?.message).toContain("your say is not in English");
    expect(result.say).toBe("I couldn't make that change: what I tried is not possible on this video.");
  });
});

describe("change: a say in the kit's own words is not the creator's to read (Task 14b; judged apart from the edit since the last correction)", () => {
  const mono = [{ op: "look.set", preset: "mono" }];

  it("keeps the change, asks for the sentence with the words it named, and takes the next", async () => {
    const qwen = scripted([answer("I applied the mono look preset to the entire film.", mono), answer("The colour is gone from the whole film.", [])]);
    const result = await change(input({ request: "take the colour out", stills: false }), { ask: qwen.ask, now: qwen.now });
    expect(result.rounds.map((round) => round.outcome)).toEqual(["changed", "said"]);
    expect(lastUser(qwen.calls[1]?.messages ?? [])).toContain('Your sentence was not taken: your say names "preset", "mono": the editing kit\'s own words');
    expect(result.say).toBe("The colour is gone from the whole film.");
    expect(result.edit.look.preset).toBe("mono");
  });

  it("holds a say that comes with no ops to it as well", async () => {
    const qwen = scripted([answer("ops: []", []), answer("There is nothing of that kind to add.", [])]);
    const result = await change(input({ stills: false }), { ask: qwen.ask, now: qwen.now });
    expect(result.rounds.map((round) => round.outcome)).toEqual(["no change", "said"]);
    expect(lastUser(qwen.calls[1]?.messages ?? [])).toContain('your say names "op"');
    expect(result.say).toBe("There is nothing of that kind to add.");
  });

  it("twice, and the code writes the sentence; not for a word the creator used", async () => {
    const twice = scripted([answer("Set the mono preset.", mono), answer("The mono preset is on.", []), answer("unused", [])]);
    const kept = await change(input({ stills: false }), { ask: twice.ask, now: twice.now });
    expect(twice.calls).toHaveLength(2);
    expect(kept.rounds.map((round) => round.outcome)).toEqual(["changed", "refused"]);
    expect(kept.edit.look.preset).toBe("mono");
    expect(kept.say).toBe("The video is in black and white.");
    const asked = scripted([answer("Your captions are bold now, as pop captions are.", [{ op: "captions.set", look: "pop" }])]);
    const pop = await change(input({ request: "pop captions please", stills: false }), { ask: asked.ask, now: asked.now });
    expect(asked.calls).toHaveLength(1);
    expect(pop.sayBy).toBe("model");
  });
});

describe("saidOf: what a change did, in one true sentence of the code's own (the last correction)", () => {
  const hook = { id: "hook", part: "title", anchor: "start", at: 0, frames: 75, props: { text: "Stop *scrolling*", font: "tiktok", look: "bold", y: 0.12, size: 96, color: "#ffffff", accent: "#ffe14a" } };
  const titled = (): Edit => through(clean(), [{ op: "item.add", item: hook }]);
  const marked = (): Edit => through(clean(), [{ op: "mark.add", shot: "s1", mark: callout() }]);
  /** The edit an answer's ops make, the code's moves written out as the loop writes them. */
  const made = (edit: Edit, ops: unknown[]): Edit => {
    const moved = withMoves(edit, ANALYSES, ops, LIBRARY);
    if (!moved.ok) throw new Error(moved.problems.map((problem) => problem.message).join("; "));
    return through(edit, moved.ops);
  };
  const closing = { id: "outro", part: "title", anchor: "end", at: 60, frames: 60, props: { text: "Follow for *more*", font: "tiktok", look: "bold", y: 0.12, size: 96, color: "#ffffff", accent: "#ffe14a" } };

  // One row a kind of change the proof's requests make: the edit it starts from, the ops, the sentence.
  const kinds: [string, () => Edit, unknown[], string][] = [
    ["captions bigger, fewer words a page", clean, [{ op: "captions.set", size: 90, maxWords: 2 }], "The captions are bigger, two words at a time."],
    ["captions higher", clean, [{ op: "captions.set", y: 0.2 }], "The captions are higher."],
    ["another captions' look", clean, [{ op: "captions.set", look: "pop" }], "The captions are bold white words now."],
    ["a look, a size and a height at once", clean, [{ op: "captions.set", look: "pop", size: 64, y: 0.34 }], "The captions are bold white words now, smaller, lower."],
    ["only the words a page", clean, [{ op: "captions.set", maxWords: 1 }], "The captions show one word at a time."],
    ["captions off", clean, [{ op: "captions.set", on: false }], "The captions are off."],
    ["captions lighter", clean, [{ op: "captions.set", weight: 600 }], "The captions are lighter."],
    ["the hook's words", titled, [{ op: "item.set", id: "hook", props: { text: "Day *one*" } }], 'The title now reads "Day one".'],
    ["a call-out added", clean, [{ op: "mark.add", shot: "s1", mark: callout() }], 'A call-out "SAVE" is added.'],
    ["a closing line added", clean, [{ op: "item.add", item: closing }], 'A title "Follow for more" is added.'],
    ["a call-out moved", marked, [{ op: "mark.set", id: "c1", props: { y: 0.12 } }], 'The call-out "SAVE" sits higher.'],
    ["the title taken out", titled, [{ op: "item.remove", id: "hook" }], 'The title "Stop scrolling" is gone.'],
    ["a progress bar", clean, [{ op: "item.add", item: { id: "bar", part: "progress", anchor: "start", at: 0, frames: null, props: { edge: "top", color: "#ffe14a" } } }], "A progress bar is added."],
    ["the pauses shorter", clean, [{ op: "pauses.tighten", ms: 120 }], "The video is a little shorter."],
    ["an end cut to the words", clean, [{ op: "shot.trim", id: "s1", endMs: 5900 }], "The video is a little shorter."],
    ["a cut that takes words out", clean, [{ op: "shot.trim", id: "s1", startMs: 2200 }], "The video is shorter, with some of your words cut."],
    ["the speed", clean, [{ op: "shot.set", id: "s1", speed: 1.25 }], "The video plays faster."],
    ["a slow zoom over the film", clean, [{ op: "shot.zoom", id: "s1", zoom: 1.2, slow: true }], "The picture moves in slowly."],
    ["a punch-in from a word", clean, [{ op: "shot.zoom", id: "s1", zoom: 1.2, word: 4 }], "The picture is closer in part of the video."],
    ["warmer, by the look", clean, [{ op: "look.set", preset: "warm" }], "The colours are warmer."],
    ["warmer, by hand", clean, [{ op: "look.set", adjust: { warmth: 0.5 } }], "The colours are warmer."],
    ["black and white", clean, [{ op: "look.set", preset: "mono" }], "The video is in black and white."],
    ["a word stressed", clean, [{ op: "word.set", asset: "take", index: 1, stress: true }], 'The word "two" is stressed in the captions.'],
    ["a word written otherwise", clean, [{ op: "word.set", asset: "take", index: 3, text: "for." }], 'The captions read "for" where they read "four".'],
  ];

  it.each(kinds)("%s", (_, from, ops, sentence) => {
    const before = from();
    const after = made(before, ops);
    const said = saidOf(before, after);
    expect(said).toBe(sentence);
    // One sentence, in English, with none of the kit's words or numbers, and nothing the ops do not bear out: its own checks pass it.
    expect(sayFault(said, { request: "make it better", ops, was: before.captions, is: after.captions })).toBeNull();
  });

  it("tells three things at most, the captions first, and that there is more; and says so plainly when it can name nothing", () => {
    const before = titled();
    const after = through(before, [{ op: "look.set", preset: "mono" }, { op: "item.remove", id: "hook" }, { op: "captions.set", size: 90 }, { op: "shot.set", id: "s1", speed: 1.25 }]);
    expect(saidOf(before, after)).toBe('The captions are bigger; the title "Stop scrolling" is gone; the video plays faster; other things are changed too.');
    expect(sentencesOf(saidOf(before, after))).toBe(1);
  });

  it("does not call a cut of a shot that moves a new framing: the picture at every moment is as it was (the last re-review)", () => {
    const zoomed = made(clean(), [{ op: "shot.zoom", id: "s1", zoom: 1.2, slow: true }]);
    expect(zoomed.shots[0]?.framing.move).not.toBeNull();
    // The pauses tightened, an end trimmed: the move is kept and its part re-based, so only the length is told.
    expect(saidOf(zoomed, made(zoomed, [{ op: "pauses.tighten", ms: 120 }]))).toBe("The video is a little shorter.");
    expect(saidOf(zoomed, through(zoomed, [{ op: "shot.trim", id: "s1", endMs: 5900 }]))).toBe("The video is a little shorter.");
    // A split alone: two shots where one was, and the same film.
    const split = through(zoomed, [{ op: "shot.split", id: "s1", atMs: 2200, newId: "s1-b" }]);
    expect(split.shots).toHaveLength(2);
    expect(saidOf(zoomed, split)).not.toContain("framed");
    expect(saidOf(zoomed, split)).toBe("The edit is changed.");
    // Nor a framing written otherwise that shows the same picture: at zoom 1 its x and y shift nothing.
    const [shot] = clean().shots;
    if (!shot) throw new Error("no shot");
    expect(saidOf(clean(), { ...clean(), shots: [{ ...shot, framing: { from: { zoom: 1, x: 0.3, y: -0.2 }, move: null } }] })).toBe("The edit is changed.");
    // And a move that is new is still told, on a shot that was cut as well.
    expect(saidOf(clean(), made(through(clean(), [{ op: "shot.trim", id: "s1", endMs: 5900 }]), [{ op: "shot.zoom", id: "s1", zoom: 1.2, slow: true }]))).toBe("The video is a little shorter; the picture moves in slowly.");
  });

  it("claims no change where nothing differs: an answer that sets what the edit already has", () => {
    const before = titled();
    expect(saidOf(before, before)).toBe("Your video looks as it did.");
    // The captions set to the look they had: applied, and the same edit.
    expect(clean().captions.look).toBe("pill");
    expect(saidOf(clean(), through(clean(), [{ op: "captions.set", look: "pill" }]))).toBe("Your video looks as it did.");
  });
});

describe("change: a swapped word keeps its punctuation (Task 14b, ruling 3)", () => {
  const spoken = (): Edit => ({ ...clean(), assets: clean().assets.map((asset) => (asset.kind === "video" ? { ...asset, words: (asset.words ?? []).map((word, i) => (i === 1 ? { ...word, text: "two." } : i === 4 ? { ...word, text: "five," } : word)) } : asset)) });

  it("carries the old word's closing punctuation to a new text that has none, and leaves every other op as it is", () => {
    const ops = [
      { op: "word.set", asset: "take", index: 1, text: "pair" }, { op: "word.set", asset: "take", index: 4, text: "many" },
      { op: "word.set", asset: "take", index: 1, text: "pair!" }, { op: "word.set", asset: "take", index: 0, text: "First" },
      { op: "word.set", asset: "take", index: 1, stress: true }, { op: "word.set", asset: "nobody", index: 1, text: "x" }, { op: "look.set", preset: "mono" },
    ];
    expect(withPunctuation(spoken(), ops)).toEqual([
      { op: "word.set", asset: "take", index: 1, text: "pair." }, { op: "word.set", asset: "take", index: 4, text: "many," },
      ops[2], ops[3], ops[4], ops[5], ops[6],
    ]);
  });

  it("does so before the door sees the op: the edit holds the word with its full stop", async () => {
    const qwen = scripted([answer("The captions say “pair” there.", [{ op: "word.set", asset: "take", index: 1, text: "pair" }])]);
    const result = await change(input({ edit: spoken(), stills: false }), { ask: qwen.ask, now: qwen.now });
    const take = result.edit.assets.find((asset) => asset.id === "take");
    expect(take?.kind === "video" ? take.words?.[1]?.text : null).toBe("pair.");
    expect(result.ops).toEqual([{ op: "word.set", asset: "take", index: 1, text: "pair." }]);
  });
});

describe("change: a cut asked by time is a move the code lands (Task 14b, ruling 4)", () => {
  it("lands the cut on the nearest pause within a second and tells how much went, at the end of the say's own sentence", async () => {
    // The pauses' cuts are at 100, 1100, 2200 and 5900 ms: the first second ends nearest 1100.
    const qwen = scripted([answer("The opening is shorter.", [{ op: "time.cut", fromMs: 0, toMs: 1000 }])]);
    const result = await change(input({ request: "lose the opening second", stills: false }), { ask: qwen.ask, now: qwen.now });
    expect(result.ops).toEqual([{ op: "shot.trim", id: "s1", startMs: 1100 }]);
    expect(result.say).toBe("The opening is shorter, the first 1.1 s, up to the pause, so no word is clipped.");
    expect(errors(result.findings)).toEqual([]);
  });

  it("refuses it where no clean cut lies within a second, with the nearest ones and the words they follow", async () => {
    const qwen = scripted([answer("Cut to four seconds.", [{ op: "time.cut", fromMs: 0, toMs: 3800 }]), answer("That cannot be cut there without clipping a word; the nearest clean cut is after “four”.", [])]);
    const result = await change(input({ stills: false }), { ask: qwen.ask, now: qwen.now });
    expect(result.rounds.map((round) => round.outcome)).toEqual(["refused", "no change"]);
    expect(result.rounds[0]?.refused?.[0]?.message).toContain('no clean cut lies within one second of 3.8 s of the film: the nearest are 2.2 s into the film, after w3 "four" and 5.9 s into the film, after w9 "ten"');
    expect(result.edit).toEqual(clean());
  });
});

describe("change: the film's ends are a move the code makes (Task 14b)", () => {
  it("cuts the end to the last word when the model says which end, and refuses with what to say where nothing is left", async () => {
    // The take whole: the last word ends at 5,800 of 6,000 ms, the first starts at 200.
    const qwen = scripted([answer("The film now ends as you finish speaking.", [{ op: "ends.trim", end: true }])]);
    const result = await change(input({ request: "lose the dead air at the end", stills: false }), { ask: qwen.ask, now: qwen.now });
    expect(result.ops).toEqual([{ op: "shot.trim", id: "s1", endMs: 5860 }]);
    expect(errors(result.findings)).toEqual([]);
    const again = scripted([answer("Shorter still.", [{ op: "ends.trim", end: true }]), answer("The film already ends as you finish speaking.", [])]);
    const none = await change(input({ edit: result.edit, stills: false }), { ask: again.ask, now: again.now });
    expect(none.rounds.map((round) => round.outcome)).toEqual(["refused", "no change"]);
    expect(none.rounds[0]?.refused?.[0]?.message).toBe('the film already ends on its last word: nothing is left to take off there. Send "ops": [] and say that it already does');
    expect(withMoves(clean(), ANALYSES, [{ op: "ends.trim" }], LIBRARY)).toEqual({ ok: false, problems: [{ path: "ops.0", id: null, message: 'ends.trim takes "start": true, "end": true, or both, and nothing else' }] });
  });
});

describe("change: the captions' errors may not get worse (Task 14b: one rule with the room)", () => {
  /** The face high for the first four and a half seconds, its mouth at 0.3 to 0.35; then lower, its mouth at 0.5 to 0.55. */
  const MOVING: Analyses = { take: { ...ANALYSIS, faces: FACES.map((sample) => (sample.ms < 4500 ? { ms: sample.ms, face: { x: 0.2, y: 0.15, w: 0.6, h: 0.25 }, mouth: { x: 0.4, y: 0.3, w: 0.2, h: 0.05 } } : { ms: sample.ms, face: { x: 0.2, y: 0.4, w: 0.6, h: 0.2 }, mouth: { x: 0.4, y: 0.5, w: 0.2, h: 0.05 } })) } };
  /** The captions on the later mouth: an error from 4.5 s on, as a first cut may leave one. */
  const standing = (): Edit => through(newEdit(TAKE), [{ op: "captions.set", y: 0.52 }]);

  it("refuses a change that covers the mouth on more frames than the edit did, though the error reads the same, and takes one that covers it on fewer", async () => {
    expect(errors(review(standing(), MOVING)).map((finding) => finding.code)).toEqual(["on-face"]);
    // Up onto the first four and a half seconds' mouth: the same code and the same sentence but for its moment, on more frames.
    const worse = scripted([answer("Captions higher.", [{ op: "captions.set", y: 0.32 }]), answer("There is no room higher.", [])]);
    const refused = await change(input({ edit: standing(), analyses: MOVING, request: "captions higher", stills: false }), { ask: worse.ask, now: worse.now });
    expect(errors(review(through(standing(), [{ op: "captions.set", y: 0.32 }]), MOVING)).map((finding) => finding.code)).toEqual(["on-face"]);
    expect(refused.rounds[0]?.outcome).toBe("review");
    expect(refused.edit).toEqual(standing());
    // Under both mouths: clear, which is never worse.
    const better = scripted([answer("Captions lower.", [{ op: "captions.set", y: 0.7 }])]);
    const taken = await change(input({ edit: standing(), analyses: MOVING, request: "captions lower", stills: false }), { ask: better.ask, now: better.now });
    expect(taken.rounds[0]?.outcome).toBe("changed");
    expect(taken.edit.captions.y).toBe(0.7);
  });
});


/* ── the moment a request is about (slice B, Task 2), on the moment suite's fixture: its frames are written out in moment.test.ts ── */

describe("change: a request with the moment the video was paused on (slice B, Task 2)", () => {
  const PAUSED: Analyses = { t1: fixtureAnalysis() };
  const ASKED = 'Add a call-out "Go" here.';
  /** The opening of the moment's block: the creator paused here and the request is about it (S13 a). */
  const PAUSED_HERE = "The creator paused the video here, and the request is about this moment:";
  const paused = (over: Partial<AgentInput> = {}): AgentInput => ({ edit: twoShots(), analyses: PAUSED, request: ASKED, library: [], user: "u1", deadlineMs: 50_000, stills: false, ...over });
  /** A call-out the model adds: at y 0.6, clear of the face, the captions and the fixture's own call-out. */
  const go = (id: string, atMs: number): Mark => ({ id, part: "callout", atMs, lenMs: 1000, props: { text: "Go", font: "tiktok", look: "pop", x: 0.5, y: 0.6, size: 120, color: "#ffffff" } });
  /** A title the model adds, counted from the film's start, as clear. */
  const titled = (id: string, at: number, frames: number | null, text = "Go") => ({ id, part: "title", anchor: "start", at, frames, props: { text, font: "tiktok", look: "bold", y: 0.6, size: 96, color: "#ffffff", accent: null } });
  const adds = (mark: Mark, say = "I added a call-out here.") => answer(say, [{ op: "mark.add", shot: "s1", mark }]);
  async function run(over: Partial<AgentInput>, answers: Canned[]) {
    const qwen = scripted(answers);
    return { result: await change(paused(over), { ask: qwen.ask, now: qwen.now }), qwen };
  }
  const markOf = (edit: Edit, id: string) => edit.shots.flatMap((shot) => shot.marks.map((mark) => ({ shot: shot.id, mark }))).find(({ mark }) => mark.id === id);
  const itemOf = (edit: Edit, id: string) => edit.items.find((item) => item.id === id);

  it("sends the system prompt as it is, and the moment's lines directly before the request; without a moment, none", async () => {
    const plain = (await run({}, [answer("I left the video as it is.", [])])).qwen.calls[0]?.messages ?? [];
    const pointed = (await run({ at: 55 }, [answer("I left the video as it is.", [])])).qwen.calls[0]?.messages ?? [];
    expect(plain.map((message) => message.role)).toEqual(["system", "user"]);
    expect(pointed.map((message) => message.role)).toEqual(["system", "user"]);
    expect(plain[0]?.content).toBe(systemPrompt());
    expect(pointed[0]?.content).toBe(systemPrompt());
    expect(textOf(plain[1])).not.toContain("\nmoment:\n");
    const moment = momentFor(twoShots(), PAUSED, 55);
    if (!moment) throw new Error("no moment at frame 55");
    expect(textOf(pointed[1])).toContain(`\n\nmoment:\n${PAUSED_HERE}`);
    expect(textOf(pointed[1])).toContain("\npaused frame=55 of film 156f:");
    // Everything else byte for byte as without it.
    expect(textOf(pointed[1])).toBe(textOf(plain[1]).replace("\n\nrequest:\n", () => `\n\nmoment:\n${momentBlock(moment, twoShots(), PAUSED, false)}\n\nrequest:\n`));
  });

  it("sends no moment for a frame past the film's end, and makes the change as without one", async () => {
    const without = await run({}, [adds(go("c1", 1500))]);
    const past = await run({ at: 156 }, [adds(go("c1", 1500))]);
    expect(past.qwen.calls[0]?.messages).toEqual(without.qwen.calls[0]?.messages);
    expect(past.result.edit).toEqual(without.result.edit);
    expect(markOf(past.result.edit, "c1")?.mark.atMs).toBe(1500);
  });

  it("holds a new call-out that starts within a second of the moment onto its start; one further off is left where it was put", async () => {
    // At frame 55 "this" (w3) is being said on s1 from frame 51, 1700 ms of the take; the model put the call-out on 1500 ms, frame 45.
    const near = await run({ at: 55 }, [adds(go("c1", 1500))]);
    expect(near.result.rounds.map((round) => round.outcome)).toEqual(["changed"]);
    expect(markOf(near.result.edit, "c1")).toEqual({ shot: "s1", mark: { ...go("c1", 1500), atMs: 1700 } });
    expect(placed(near.result.edit).find((place) => place.thing.id === "c1")?.at).toBe(51);
    expect(near.result.ops.at(-1)).toEqual({ op: "mark.set", id: "c1", atMs: 1700 });
    // The model's sentence already says "here": the hold adds nothing to it.
    expect(near.result.say).toBe("I added a call-out here.");
    // On 660 ms, frame 20, 31 frames before the moment's start: the creator named another place.
    const far = await run({ at: 55 }, [adds(go("c1", 660))]);
    expect(markOf(far.result.edit, "c1")?.mark.atMs).toBe(660);
  });

  it("holds a new title the model started 15 frames after the moment onto the moment's start, counted from the film's start", async () => {
    const { result } = await run({ at: 55, request: 'Add a title "Go" from here.' }, [answer("I added a title from here.", [{ op: "item.add", item: titled("t", 70, 60) }])]);
    expect(itemOf(result.edit, "t")).toMatchObject({ anchor: "start", at: 51, frames: 60 });
  });

  it("moves a call-out the model put on another shot to the shot under the moment's start, with the same id", async () => {
    // At frame 75 "works" (w4) is being said on s2 from frame 72, 3200 ms; the model put the call-out on s1 at 2200 ms, frame 66.
    const { result } = await run({ at: 75 }, [adds(go("c1", 2200))]);
    expect(markOf(result.edit, "c1")).toEqual({ shot: "s2", mark: { ...go("c1", 2200), atMs: 3200 } });
    expect(result.edit.shots.find((shot) => shot.id === "s1")?.marks).toEqual([]);
  });

  it("holds an end the model set near the moment onto it", async () => {
    const { result } = await run({ at: 55, request: "End the bar here." }, [answer("The bar now ends here.", [{ op: "item.set", id: "bar", frames: 50 }])]);
    expect(itemOf(result.edit, "bar")).toMatchObject({ anchor: "start", at: 0, frames: 55 });
  });

  it("leaves a request that points at nothing as the model made it, the moment sent all the same; and one that points with no moment", async () => {
    const whole = await run({ at: 55, request: 'Add a call-out "Go" at the start.' }, [adds(go("c1", 1500), "I added a call-out at the start.")]);
    expect(textOf(whole.qwen.calls[0]?.messages[1])).toContain(`\n\nmoment:\n${PAUSED_HERE}`);
    expect(markOf(whole.result.edit, "c1")?.mark.atMs).toBe(1500);
    const unpaused = await run({}, [adds(go("c1", 1500))]);
    expect(markOf(unpaused.result.edit, "c1")?.mark.atMs).toBe(1500);
  });

  it("holds each round's answer against the moment as the edit it is applied to shows it: after a refusal, after a change that kept it, and not once a change cut it out (S11)", async () => {
    const refusedFirst = await run({ at: 55 }, [answer("I added a call-out here.", [{ op: "mark.set", id: "nope", atMs: 1500 }]), adds(go("c1", 1500))]);
    expect(refusedFirst.result.rounds.map((round) => round.outcome)).toEqual(["refused", "changed"]);
    expect(markOf(refusedFirst.result.edit, "c1")?.mark.atMs).toBe(1700);
    // Round 1 takes the fixture's call-out out and is told what it did; the moment is still there, and round 2's call-out is held.
    const keptFirst = await run({ at: 55 }, [answer("I took the other call-out out.", [{ op: "mark.remove", id: "m1" }]), adds(go("c1", 1500))]);
    expect(keptFirst.result.rounds.map((round) => round.outcome)).toEqual(["changed", "changed"]);
    expect(markOf(keptFirst.result.edit, "c1")?.mark.atMs).toBe(1700);
    // Round 1 cuts w2-w3 at the pause's cut@, the moment with them; round 2's title, 15 frames from where the moment was, is left.
    // A title, since an item's start may be set on any frame: a hold made here would show.
    const cutFirst = await run({ at: 55, request: 'Cut this and add a title "Go" from here.' }, [
      answer("I cut this part.", [{ op: "shot.trim", id: "s1", endMs: 1200 }]),
      answer("I cut this part and added a title from here.", [{ op: "item.add", item: titled("t", 70, 30) }]),
    ]);
    expect(cutFirst.result.rounds.map((round) => round.outcome)).toEqual(["changed", "changed"]);
    expect(itemOf(cutFirst.result.edit, "t")).toMatchObject({ anchor: "start", at: 70 });
  });

  it("holds an answer that cuts before the moment and places a thing here against the moment in the film it made (S11)", async () => {
    // The opening cut to 1200 ms: the shorter film shows the moment on frame 19, "this" from 15. Words are cut, so the model is
    // told what it did and answers again with no ops.
    const opening = { op: "shot.trim", id: "s1", startMs: 1200 };
    const said = "I cut the opening and added it here.";
    // A call-out on 1500 ms is on frame 9 of the shorter film: held to 1700 ms, frame 15.
    const marked = await run({ at: 55, request: 'Cut the opening and add a call-out "Go" here.' }, [answer(said, [opening, { op: "mark.add", shot: "s1", mark: go("c1", 1500) }]), answer(said, [])]);
    expect(marked.result.rounds.map((round) => round.outcome)).toEqual(["changed", "no change"]);
    expect(markOf(marked.result.edit, "c1")?.mark.atMs).toBe(1700);
    expect(placed(marked.result.edit).find((place) => place.thing.id === "c1")?.at).toBe(15);
    // A title on frame 45 of the shorter film is held to 15, the moment's start there, not to 51, the film's as handed in.
    const titledRun = await run({ at: 55, request: 'Cut the opening and add a title "Go" here.' }, [answer(said, [opening, { op: "item.add", item: titled("t", 45, 30) }]), answer(said, [])]);
    expect(itemOf(titledRun.result.edit, "t")).toMatchObject({ anchor: "start", at: 15 });
  });

  it("holds the new call-out before a title that stays gives way to it: the title ends six frames before the call-out as held", async () => {
    const hooked = through(twoShots(), [{ op: "item.add", item: titled("hook", 0, null, "Hey") }]);
    const held = await run({ edit: hooked, at: 55 }, [adds(go("c1", 1500))]);
    expect(markOf(held.result.edit, "c1")?.mark.atMs).toBe(1700);
    expect(itemOf(held.result.edit, "hook")).toMatchObject({ at: 0, frames: 45 });
    // Not held, it would give way six frames before the model's own frame 45: too little of it is left, so it is taken out.
    const unheld = await run({ edit: hooked }, [adds(go("c1", 1500))]);
    expect(itemOf(unheld.result.edit, "hook")).toBeUndefined();
  });
});

describe("change: zoom in here starts on the moment, a split there and a push (slice B, Task 3)", () => {
  const PAUSED: Analyses = { t1: fixtureAnalysis() };
  const zoomOn = (id: string, more: Record<string, unknown> = {}) => ({ op: "shot.zoom", id, zoom: 1.3, ...more });
  const momentOf = (edit: Edit, frame: number, analyses: Analyses = PAUSED): Moment => {
    const moment = momentFor(edit, analyses, frame);
    if (!moment) throw new Error(`no moment at frame ${frame}`);
    return moment;
  };
  const refusal = (message: string) => ({ ok: false, problems: [{ path: "ops.0", id: null, message: `${message}. Zoom another part and say which part stays as it is; or send "ops": [] and say what is in the way` }] });
  /** The fixture's take as a file too small to enlarge (2 x 540 / 1080 = 1). */
  const small = (): Edit => ({ ...twoShots(), assets: twoShots().assets.map((asset) => (asset.kind === "video" ? { ...asset, w: 540, h: 960 } : asset)) });
  const asked = (over: Partial<AgentInput>): AgentInput => ({ edit: twoShots(), analyses: PAUSED, request: "Zoom in here.", library: [], user: "u1", deadlineMs: 50_000, stills: false, at: 40, ...over });
  async function run(over: Partial<AgentInput>, answers: Canned[]) {
    const qwen = scripted(answers);
    return { result: await change(asked(over), { ask: qwen.ask, now: qwen.now }), qwen };
  }

  it("case 7: withMoves with the moment makes the zoom of its shot the zoom here; with none, or of another shot, it is as before", () => {
    const e = twoShots();
    const here = momentOf(e, 40);
    const zoom = zoomHere(e, PAUSED, here, 1.3, false, []);
    if ("none" in zoom) throw new Error(zoom.none);
    expect(withMoves(e, PAUSED, [zoomOn("s1")], [], here)).toEqual({ ok: true, ops: zoom.ops, says: ["from here to the next cut"] });
    // The word the model sent is not looked at: the moment says where.
    expect(withMoves(e, PAUSED, [zoomOn("s1", { word: 4 })], [], here)).toEqual({ ok: true, ops: zoom.ops, says: ["from here to the next cut"] });
    // No moment: the zoom of the whole shot, as before.
    const whole = zoomFor(e, PAUSED, "s1", 1.3, false);
    if (!("framing" in whole)) throw new Error(whole.none);
    expect(withMoves(e, PAUSED, [zoomOn("s1")], [], null)).toEqual({ ok: true, ops: [{ op: "shot.set", id: "s1", framing: whole.framing }], says: [] });
    expect(withMoves(e, PAUSED, [zoomOn("s1")], [])).toEqual(withMoves(e, PAUSED, [zoomOn("s1")], [], null));
    // Another shot than the moment's: as before.
    expect(withMoves(e, PAUSED, [zoomOn("s2")], [], here)).toEqual(withMoves(e, PAUSED, [zoomOn("s2")], []));
  });

  it("case 4: a zoom here with no framing that keeps the texts clear of the face is refused with why; nothing of it is made", () => {
    const close: Analyses = { t1: fixtureAnalysis({ faces: fixtureFaces().map((sample) => ({ ms: sample.ms, face: box(0.2, 0.3, 0.6, 0.4), mouth: box(0.4, 0.61, 0.2, 0.08) })) }) };
    const boxed = through(twoShots(), [
      { op: "captions.set", on: false },
      { op: "item.add", item: { id: "hook", part: "title", anchor: "start", at: 0, frames: 66, props: { text: "Back at it", font: "tiktok", look: "bold", y: 0.26, size: 130, color: "#ffffff", accent: null } } },
      { op: "item.add", item: { id: "low", part: "callout", anchor: "start", at: 0, frames: 66, props: { text: "Two words", font: "tiktok", look: "pop", x: 0.5, y: 0.74, size: 130, color: "#ffffff" } } },
    ]);
    expect(withMoves(boxed, close, [zoomOn("s1")], [], momentOf(boxed, 40, close))).toEqual(refusal('shot "s1" has no room to zoom in: a title or a call-out shows over it, and the face would run into it'));
  });

  it("finds the moment again in the edit the answer's ops before the zoom make (S11); a moment they cut out is zoomed as before", () => {
    const e = twoShots();
    const here = momentOf(e, 40);
    // The opening cut to the pause's cut@: the moment, 1333 ms, is on frame 4 of the shorter film, still a split away from s1's start.
    const opening = { op: "shot.trim", id: "s1", startMs: 1200 };
    const moved = withMoves(e, PAUSED, [opening, zoomOn("s1")], [], here);
    expect(moved.ok && moved.ops.slice(0, 2)).toEqual([opening, { op: "shot.split", id: "s1", atMs: 1333, newId: "s1-z" }]);
    expect(moved.ok && moved.ops[2]).toMatchObject({ op: "shot.set", id: "s1-z", framing: { from: { zoom: 1, x: 0, y: 0 }, move: { ease: "out", part: [0, 1067 / 400] } } });
    // s1 cut to 1200 takes the moment out: the zoom is the one asked, of the whole shot.
    const cut = { op: "shot.trim", id: "s1", endMs: 1200 };
    expect(withMoves(e, PAUSED, [cut, zoomOn("s1")], [], here)).toEqual(withMoves(e, PAUSED, [cut, zoomOn("s1")], []));
  });

  it("change: \"Zoom in here.\" paused on frame 40 splits the shot on the moment and pushes in; the say tells how far", async () => {
    const { result, qwen } = await run({}, [answer("I zoomed in here.", [zoomOn("s1")])]);
    expect(result.rounds.map((round) => round.outcome)).toEqual(["changed"]);
    // The block told the model what shot.zoom does here.
    expect(textOf(qwen.calls[0]?.messages[1])).toContain("\nzoom: shot.zoom on s1 starts on this frame; the code splits the shot here and pushes in until frame 66, the next cut; up to 1.3\n");
    expect(result.edit.shots.map((shot) => shot.id)).toEqual(["s1", "s1-z", "s2"]);
    expect(landed("zoom", momentOf(twoShots(), 40), twoShots(), result.edit)).toBe(true);
    expect(result.say).toBe("I zoomed in here, from here to the next cut.");
  });

  it("change: a say that already tells how far the zoom here goes is not told it again", async () => {
    const { result } = await run({}, [answer("The camera pushes in on you from here to the next cut.", [zoomOn("s1")])]);
    expect(result.edit.shots.map((shot) => shot.id)).toEqual(["s1", "s1-z", "s2"]);
    expect(result.say).toBe("The camera pushes in on you from here to the next cut.");
  });

  it("a zoom here among other ops of one answer: each made in order on the edit the ops before it give", () => {
    const e = twoShots();
    const here = momentOf(e, 40);
    const zoom = zoomHere(e, PAUSED, here, 1.3, false, []);
    if ("none" in zoom) throw new Error(zoom.none);
    const mono = { op: "look.set", preset: "mono" };
    const bigger = { op: "captions.set", size: 80 };
    expect(withMoves(e, PAUSED, [mono, zoomOn("s1"), bigger], [], here)).toEqual({ ok: true, ops: [mono, ...zoom.ops, bigger], says: ["from here to the next cut"] });
  });

  it("change: a zoom here and a call-out here in one answer, in either order: the push from the moment, the call-out held onto it on the piece", async () => {
    const go: Mark = { id: "c1", part: "callout", atMs: 1500, lenMs: 1000, props: { text: "Go", font: "tiktok", look: "pop", x: 0.5, y: 0.6, size: 120, color: "#ffffff" } };
    const request = 'Zoom in here and add a call-out "Go" here.';
    for (const ops of [[zoomOn("s1"), { op: "mark.add", shot: "s1", mark: go }], [{ op: "mark.add", shot: "s1", mark: go }, zoomOn("s1")]]) {
      const { result } = await run({ request }, [answer("I zoomed in here and added a call-out here.", ops)]);
      expect(result.rounds.map((round) => round.outcome), JSON.stringify(ops)).toEqual(["changed"]);
      expect(result.edit.shots.map((shot) => shot.id)).toEqual(["s1", "s1-z", "s2"]);
      expect(landed("zoom", momentOf(twoShots(), 40), twoShots(), result.edit)).toBe(true);
      // The call-out the model put on 1500 ms (frame 45) is held onto the moment, 1333 ms (frame 40), on the piece that shows it.
      expect(result.edit.shots.find((shot) => shot.id === "s1-z")?.marks.map((mark) => [mark.id, mark.atMs])).toEqual([["c1", 1333]]);
      expect(placed(result.edit).find((place) => place.thing.id === "c1")?.at).toBe(40);
      expect(result.say).toBe("I zoomed in here and added a call-out here, from here to the next cut.");
    }
  });

  it("change: with a moment and a request that points at nothing, the zoom is as before, of the whole shot", async () => {
    const { result } = await run({ request: "Zoom in on the first shot." }, [answer("I zoomed in on the first shot.", [zoomOn("s1")])]);
    const whole = zoomFor(twoShots(), PAUSED, "s1", 1.3, false);
    if (!("framing" in whole)) throw new Error(whole.none);
    expect(result.edit.shots.map((shot) => shot.id)).toEqual(["s1", "s2"]);
    expect(result.edit.shots[0]?.framing).toEqual(whole.framing);
  });

  it("change: a zoom here the take is too small for is refused, the model is told why, and the creator reads what is in the way", async () => {
    const said = "I couldn't zoom in here: the video is too small to enlarge without going soft.";
    const { result, qwen } = await run({ edit: small() }, [answer("I zoomed in here.", [zoomOn("s1")]), answer(said, [])]);
    expect(textOf(qwen.calls[0]?.messages[1])).toContain('\nzoom: none here: shot "s1" cannot be enlarged further: its file is too small\n');
    expect(result.rounds.map((round) => round.outcome)).toEqual(["refused", "no change"]);
    expect(lastUser(qwen.calls[1]?.messages ?? [])).toContain('shot "s1" cannot be enlarged further: its file is too small. Zoom another part and say which part stays as it is; or send "ops": [] and say what is in the way');
    expect(result.changed).toBe(false);
    expect(result.edit).toEqual(small());
    expect(result.say).toBe(said);
    // Sent again and again, and no sentence after: the code says it could not, never nothing.
    const stubborn = await run({ edit: small() }, [answer("I zoomed in here.", [zoomOn("s1")]), answer("I zoomed in here.", [zoomOn("s1")]), answer("I zoomed in here.", [zoomOn("s1")]), { text: "not json" }]);
    expect(stubborn.result.changed).toBe(false);
    expect(stubborn.result.say).toBe("I couldn't make that change: what I tried is not possible on this video.");
  });

  it("saidOf tells a push as closer, not as a slow move", () => {
    // Through the door once, so that the fixture's hand-written marks read as the door writes them.
    const e = through(twoShots(), [{ op: "captions.set", on: true }]);
    const zoom = zoomHere(e, PAUSED, momentOf(e, 40), 1.3, false, []);
    if ("none" in zoom) throw new Error(zoom.none);
    expect(saidOf(e, through(e, zoom.ops))).toBe("The picture is closer in part of the video.");
    const slow = zoomHere(e, PAUSED, momentOf(e, 40), 1.3, true, []);
    if ("none" in slow) throw new Error(slow.none);
    expect(saidOf(e, through(e, slow.ops))).toBe("The picture moves in slowly in part of the video.");
  });
});

describe("change: a thing added with a moment does not fall back to the film's start (S15, S16)", () => {
  const PAUSED: Analyses = { t1: fixtureAnalysis() };
  /** The fixture as the door writes it, as a stored edit reaches the loop: the code's sentence tells only what changed. */
  const stored = (): Edit => through(twoShots(), [{ op: "captions.set", on: true }]);
  /** A title the model adds, counted from the film's start, clear of the face and the captions. */
  const titled = (id: string, at: number, frames: number | null) => ({ id, part: "title", anchor: "start", at, frames, props: { text: "Go", font: "tiktok", look: "bold", y: 0.6, size: 96, color: "#ffffff", accent: null } });
  const go: Mark = { id: "c1", part: "callout", atMs: 0, lenMs: 1000, props: { text: "Go", font: "tiktok", look: "pop", x: 0.5, y: 0.6, size: 120, color: "#ffffff" } };
  const asked = (over: Partial<AgentInput>): AgentInput => ({ edit: stored(), analyses: PAUSED, request: "Add a title: Go", library: [], user: "u1", deadlineMs: 50_000, stills: false, at: 55, ...over });
  async function run(over: Partial<AgentInput>, answers: Canned[]) {
    const qwen = scripted(answers);
    return { result: await change(asked(over), { ask: qwen.ask, now: qwen.now }), qwen };
  }
  const itemOf = (edit: Edit, id: string) => edit.items.find((item) => item.id === id);
  const atStart = (say = "I added a title at the start.") => answer(say, [{ op: "item.add", item: titled("t", 0, 60) }]);

  it("a title the model left on the film's first frame, with a moment and no pointing word, starts on the moment; the line is the code's", async () => {
    // Paused at 55 (0:01), "this" (w3) being said from frame 51.
    const { result } = await run({}, [atStart()]);
    expect(result.rounds.map((round) => round.outcome)).toEqual(["changed"]);
    expect(itemOf(result.edit, "t")).toMatchObject({ anchor: "start", at: 51, frames: 60 });
    expect(result.ops).toContainEqual({ op: "item.set", id: "t", at: 51 });
    expect(result.say).toBe("The title is on at 0:01.");
    expect(result.sayBy).toBe("code");
  });

  it("a mark the model put at the first moment of the film's first shot starts on the moment too", async () => {
    const { result } = await run({ request: 'Add a call-out "Go"' }, [answer("I added a call-out at the start.", [{ op: "mark.add", shot: "s1", mark: go }])]);
    expect(result.edit.shots.find((shot) => shot.id === "s1")?.marks.find((mark) => mark.id === "c1")?.atMs).toBe(1700);
    expect(placed(result.edit).find((place) => place.thing.id === "c1")?.at).toBe(51);
    expect(result.say).toBe("The call-out is on at 0:01.");
  });

  it("its length is the model's, cut at the film's end", async () => {
    // Paused at 150 (0:05), six frames before the film's end.
    const { result } = await run({ at: 150 }, [atStart()]);
    expect(itemOf(result.edit, "t")).toMatchObject({ anchor: "start", at: 150, frames: 6 });
    expect(result.say).toBe("The title is on at 0:05.");
  });

  it("leaves it on the start when the request names the start, and where the model put it anywhere else; the model's line", async () => {
    const named = await run({ request: "Add a title at the start: Go" }, [atStart()]);
    expect(itemOf(named.result.edit, "t")).toMatchObject({ at: 0, frames: 60 });
    expect([named.result.say, named.result.sayBy]).toEqual(["I added a title at the start.", "model"]);
    const elsewhere = await run({}, [answer("I added a title.", [{ op: "item.add", item: titled("t", 100, 30) }])]);
    expect(itemOf(elsewhere.result.edit, "t")).toMatchObject({ at: 100, frames: 30 });
    expect(elsewhere.result.say).toBe("I added a title.");
  });

  it("moves nothing when the answer cut the moment out", async () => {
    // s1 cut at the pause's cut@ takes "this" and the moment's 1833 ms out; words are cut, so the model is told and answers again.
    const said = "I cut that part and added a title at the start.";
    const { result } = await run({}, [answer(said, [{ op: "shot.trim", id: "s1", endMs: 1200 }, { op: "item.add", item: titled("t", 0, 60) }]), answer(said, [])]);
    expect(itemOf(result.edit, "t")).toMatchObject({ at: 0 });
    expect(result.say).toBe(said);
  });

  it("a sound with no length of its own (a bed under the whole film) is left on frame 0 with the model's sentence; one with a length is moved (S16)", async () => {
    const bed = (frames: number | null) => ({ id: "bed", part: "sound", anchor: "start", at: 0, frames, asset: "pop", props: { startMs: 0, volume: 0.5, fadeInMs: 0, fadeOutMs: 100 } });
    const whole = await run({ request: "Add background music" }, [answer("I added background music.", [{ op: "item.add", item: bed(null) }])]);
    expect(itemOf(whole.result.edit, "bed")).toMatchObject({ at: 0, frames: null });
    expect([whole.result.say, whole.result.sayBy]).toEqual(["I added background music.", "model"]);
    // With a length of its own (the pop's whole 500 ms, all the door takes of it): moved.
    const timed = await run({ request: "Add background music" }, [answer("I added background music.", [{ op: "item.add", item: bed(15) }])]);
    expect(itemOf(timed.result.edit, "bed")).toMatchObject({ at: 51, frames: 15 });
    expect([timed.result.say, timed.result.sayBy]).toEqual(["The sound is on at 0:01.", "code"]);
  });

  it("the line's time is where the thing starts in the film the answer made, the said word's first frame (S16)", async () => {
    // Paused on 61 (0:02); "this" is said from 51 (0:01), where the title starts.
    const { result } = await run({ at: 61 }, [atStart()]);
    const start = placed(result.edit).find((place) => place.thing.id === "t")?.at ?? -1;
    expect(start).toBe(51);
    expect(result.say).toBe(`The title is on at 0:0${Math.floor(start / 30)}.`);
  });

  it("an answer that did more: the line for the moved thing, then the code's own words for the rest; the model's sentence is not said (S16)", async () => {
    const bigger = await run({ request: "Make the captions bigger and add a title: Go" }, [answer("I made the captions bigger and added a title at the start.", [{ op: "captions.set", size: 80 }, { op: "item.add", item: titled("t", 0, 60) }])]);
    expect(bigger.result.rounds.map((round) => round.outcome)).toEqual(["changed"]);
    expect(bigger.result.edit.captions.size).toBe(80);
    expect(itemOf(bigger.result.edit, "t")).toMatchObject({ at: 51 });
    expect([bigger.result.say, bigger.result.sayBy]).toEqual(["The title is on at 0:01; the captions are bigger.", "code"]);
    // A zoom here in the same answer: the push from the moment, told in the code's words, not as the zoom's own part.
    const zoomed = await run({ at: 40, request: "Zoom in here and add a title: Go" }, [answer("I zoomed in here and added a title at the start.", [{ op: "shot.zoom", id: "s1", zoom: 1.3 }, { op: "item.add", item: titled("t", 0, 60) }])]);
    expect(zoomed.result.rounds.map((round) => round.outcome)).toEqual(["changed"]);
    expect(zoomed.result.edit.shots.map((shot) => shot.id)).toEqual(["s1", "s1-z", "s2"]);
    expect(itemOf(zoomed.result.edit, "t")).toMatchObject({ at: 40 });
    expect([zoomed.result.say, zoomed.result.sayBy]).toEqual(["The title is on at 0:01; the picture is closer in part of the video.", "code"]);
  });

  it("a request with no moment is asked and made as it always was", async () => {
    const { result, qwen } = await run({ at: undefined }, [atStart()]);
    expect(textOf(qwen.calls[0]?.messages[1])).not.toContain("\nmoment:\n");
    expect(qwen.calls[0]?.messages[0]?.content).toBe(systemPrompt());
    expect(itemOf(result.edit, "t")).toMatchObject({ at: 0, frames: 60 });
    expect([result.say, result.sayBy]).toEqual(["I added a title at the start.", "model"]);
  });
});

describe("change: the tag is the pointer for code too (S17)", () => {
  const PAUSED: Analyses = { t1: fixtureAnalysis() };
  const stored = (): Edit => through(twoShots(), [{ op: "captions.set", on: true }]);
  const asked = (over: Partial<AgentInput>): AgentInput => ({ edit: stored(), analyses: PAUSED, request: "Zoom in", library: [], user: "u1", deadlineMs: 50_000, stills: false, at: 40, ...over });
  async function run(over: Partial<AgentInput>, answers: Canned[]) {
    const qwen = scripted(answers);
    return { result: await change(asked(over), { ask: qwen.ask, now: qwen.now }), qwen };
  }
  const zoomOn = (id: string) => ({ op: "shot.zoom", id, zoom: 1.3 });
  const momentOf = (edit: Edit, frame: number): Moment => {
    const moment = momentFor(edit, PAUSED, frame);
    if (!moment) throw new Error(`no moment at frame ${frame}`);
    return moment;
  };
  /** The edit an answer's ops make by today's path: no moment given to the moves. */
  const asToday = (ops: unknown[]): Edit => {
    const moved = withMoves(stored(), PAUSED, ops, []);
    if (!moved.ok) throw new Error(moved.problems.map((problem) => problem.message).join("; "));
    return through(stored(), moved.ops);
  };
  const go = (atMs: number): Mark => ({ id: "c1", part: "callout", atMs, lenMs: 1000, props: { text: "Go", font: "tiktok", look: "pop", x: 0.5, y: 0.6, size: 120, color: "#ffffff" } });
  const card = (at: number, frames: number | null) => ({ id: "card", part: "title", anchor: "end", at, frames, props: { text: "Follow for more", font: "tiktok", look: "bold", y: 0.6, size: 96, color: "#ffffff", accent: null } });

  it("(3) \"Zoom in\" with a moment and no pointing word zooms from the moment: the split there and the push", async () => {
    const { result } = await run({}, [answer("I zoomed in.", [zoomOn("s1")])]);
    expect(result.rounds.map((round) => round.outcome)).toEqual(["changed"]);
    expect(result.edit.shots.map((shot) => shot.id)).toEqual(["s1", "s1-z", "s2"]);
    expect(landed("zoom", momentOf(stored(), 40), stored(), result.edit)).toBe(true);
  });

  it("(3) a zoom with a moment is left as the model wrote it when the request names the whole film, or the answer zooms two shots", async () => {
    for (const request of ["Zoom in on the whole video", "Add zooms everywhere"]) {
      const { result } = await run({ request }, [answer("I zoomed in.", [zoomOn("s1")])]);
      expect(result.edit, request).toEqual(asToday([zoomOn("s1")]));
    }
    const two = [zoomOn("s1"), zoomOn("s2")];
    const { result } = await run({}, [answer("I zoomed in.", two)]);
    expect(result.rounds.map((round) => round.outcome)).toEqual(["changed"]);
    expect(result.edit).toEqual(asToday(two));
  });

  it("(2) a call-out the model started 6 frames past the moment, asked with no pointing word, is held onto it; one asked at a time is left", async () => {
    // At 55 "this" (w3) is being said from frame 51, 1700 ms; the model put the call-out on 2033 ms, frame 61.
    const held = await run({ at: 55, request: "Add a call-out: Go" }, [answer("I added a call-out.", [{ op: "mark.add", shot: "s1", mark: go(2033) }])]);
    expect(held.result.edit.shots[0]?.marks.find((mark) => mark.id === "c1")?.atMs).toBe(1700);
    expect(placed(held.result.edit).find((place) => place.thing.id === "c1")?.at).toBe(51);
    const timed = await run({ at: 55, request: "Add a call-out at 0:07: Go" }, [answer("I added a call-out.", [{ op: "mark.add", shot: "s1", mark: go(2033) }])]);
    expect(timed.result.edit.shots[0]?.marks.find((mark) => mark.id === "c1")?.atMs).toBe(2033);
  });

  it("(2) the ends part of the hold stays on a request that points: an end set near the moment, asked with no pointing word, is left", async () => {
    // The bar set to end on 50, five frames before the moment at 55.
    const { result } = await run({ at: 55, request: "Make the bar shorter" }, [answer("The bar is shorter now.", [{ op: "item.set", id: "bar", frames: 50 }])]);
    expect(result.edit.items.find((item) => item.id === "bar")?.frames).toBe(50);
  });

  it("(4) the block offers the numbers that end what is showing only to a request that points", async () => {
    const plain = await run({ at: 75, request: "Add a call-out: Go" }, [answer("I left it as it is.", [])]);
    expect(textOf(plain.qwen.calls[0]?.messages[1])).toContain("\nshowing: mark m1 callout film=[72,96)f; mark p1 sound film=[72,84)f; item bar progress film=[0,156)f\n");
    const pointing = await run({ at: 75, request: "End the bar here." }, [answer("I left it as it is.", [])]);
    expect(textOf(pointing.qwen.calls[0]?.messages[1])).toContain('to end it on this frame "frames":75');
  });

  it("(5) an end card that would not be read starts as long before the end as it lasts, with a moment or without", async () => {
    for (const at of [40, undefined]) {
      const { result } = await run({ at, request: "Add an end card that says Follow for more" }, [answer("I added an end card.", [{ op: "item.add", item: card(3, 90) }])]);
      expect(result.rounds.map((round) => round.outcome), `at ${at}`).toEqual(["changed"]);
      expect(result.edit.items.find((item) => item.id === "card"), `at ${at}`).toMatchObject({ anchor: "end", at: 90, frames: 90 });
      expect(placed(result.edit).find((place) => place.thing.id === "card"), `at ${at}`).toMatchObject({ at: 66, frames: 90 });
    }
  });

  it("(5) readableEnds: at under its own frames is put at them; with no frames, at under 24 is put at 60; a readable one, and any other, as sent", () => {
    const e = stored();
    expect(readableEnds(e, [{ op: "item.add", item: card(3, 90) }])).toEqual([{ op: "item.add", item: card(90, 90) }]);
    expect(readableEnds(e, [{ op: "item.add", item: card(0, 45) }])).toEqual([{ op: "item.add", item: card(45, 45) }]);
    expect(readableEnds(e, [{ op: "item.add", item: card(10, null) }])).toEqual([{ op: "item.add", item: card(60, null) }]);
    const readable = [{ op: "item.add", item: card(90, 60) }, { op: "item.add", item: { ...card(30, null), id: "card2" } }, { op: "item.add", item: { ...card(3, 90), id: "t", anchor: "start" } }, { op: "captions.set", size: 80 }];
    expect(readableEnds(e, readable)).toEqual(readable);
    // A set of the card the edit has, or that the answer added before it, is read against what the card is by then.
    const carded = through(e, [{ op: "item.add", item: card(90, 90) }]);
    expect(readableEnds(carded, [{ op: "item.set", id: "card", at: 3 }])).toEqual([{ op: "item.set", id: "card", at: 90 }]);
    expect(readableEnds(e, [{ op: "item.add", item: card(90, 90) }, { op: "item.set", id: "card", frames: 120 }])).toEqual([{ op: "item.add", item: card(90, 90) }, { op: "item.set", id: "card", frames: 120, at: 120 }]);
  });

  it("a request with no moment: its answers are made as today (S17 (1) to (4) need a moment)", async () => {
    const zoomed = await run({ at: undefined }, [answer("I zoomed in.", [zoomOn("s1")])]);
    expect(zoomed.result.edit).toEqual(asToday([zoomOn("s1")]));
    const marked = await run({ at: undefined, request: "Add a call-out: Go" }, [answer("I added a call-out.", [{ op: "mark.add", shot: "s1", mark: go(2033) }])]);
    expect(marked.result.edit.shots[0]?.marks.find((mark) => mark.id === "c1")?.atMs).toBe(2033);
    expect(textOf(marked.qwen.calls[0]?.messages[1])).not.toContain("\nmoment:\n");
  });
});

describe("change: the request is read without the text it asks to have written, and the end numbers only for an ending (final review I2, I3)", () => {
  const PAUSED: Analyses = { t1: fixtureAnalysis() };
  const stored = (): Edit => through(twoShots(), [{ op: "captions.set", on: true }]);
  const asked = (over: Partial<AgentInput>): AgentInput => ({ edit: stored(), analyses: PAUSED, request: "Add a title: Go", library: [], user: "u1", deadlineMs: 50_000, stills: false, at: 55, ...over });
  async function run(over: Partial<AgentInput>, answers: Canned[]) {
    const qwen = scripted(answers);
    return { result: await change(asked(over), { ask: qwen.ask, now: qwen.now }), qwen };
  }
  const titled = (at: number) => ({ id: "t", part: "title", anchor: "start", at, frames: 60, props: { text: "Go", font: "tiktok", look: "bold", y: 0.6, size: 96, color: "#ffffff", accent: null } });
  const go = (atMs: number): Mark => ({ id: "c1", part: "callout", atMs, lenMs: 1000, props: { text: "Go", font: "tiktok", look: "pop", x: 0.5, y: 0.6, size: 120, color: "#ffffff" } });
  const startOf = (edit: Edit, id: string) => placed(edit).find((place) => place.thing.id === id)?.at;

  it("I2: a title's own words do not switch the pointer off: put on the moment from frame 0, or held there from near it", async () => {
    // At 55 "this" (w3) is being said from frame 51.
    for (const request of ["Add a title: Top 3 tips", "Add a title that says My first vlog", "Add a title for 3 seconds: New drop"]) {
      const moved = await run({ request }, [answer("I added a title at the start.", [{ op: "item.add", item: titled(0) }])]);
      expect(startOf(moved.result.edit, "t"), request).toBe(51);
      expect(moved.result.say, request).toBe("The title is on at 0:01.");
      const held = await run({ request }, [answer("I added a title.", [{ op: "item.add", item: titled(61) }])]);
      expect(startOf(held.result.edit, "t"), request).toBe(51);
    }
    const callout = await run({ request: "Add a call-out: Every creator needs this" }, [answer("I added a call-out.", [{ op: "mark.add", shot: "s1", mark: go(0) }])]);
    expect(startOf(callout.result.edit, "c1")).toBe(51);
  });

  it("I2: the proof's two controls and a clock time still name their place, and are left where the model put them", async () => {
    for (const request of ["Add a hook title at the start: New drop", "Add a title at 0:07: New drop"]) {
      const { result } = await run({ request }, [answer("I added a title.", [{ op: "item.add", item: titled(0) }])]);
      expect([startOf(result.edit, "t"), result.say], request).toEqual([0, "I added a title."]);
    }
    const card = { id: "card", part: "title", anchor: "end", at: 90, frames: 90, props: { text: "Follow for more", font: "tiktok", look: "bold", y: 0.6, size: 96, color: "#ffffff", accent: null } };
    const { result } = await run({ request: "Add an end card that says Follow for more" }, [answer("I added an end card.", [{ op: "item.add", item: card }])]);
    expect([startOf(result.edit, "card"), result.say]).toEqual([66, "I added an end card."]);
  });

  it("I3: a request that points and names no ending is not offered the numbers that end what is showing; \"End the title here.\" is, as before", async () => {
    const hooked = through(stored(), [{ op: "item.add", item: { ...titled(0), id: "hook", frames: null } }]);
    const blockOf = async (request: string) => textOf((await run({ edit: hooked, request }, [answer("I left it as it is.", [])])).qwen.calls[0]?.messages[1]);
    for (const request of ["Zoom in less here.", "Keep only one title here."]) expect(await blockOf(request), request).not.toContain("to end it on this frame");
    const moment = momentFor(hooked, PAUSED, 55);
    if (!moment) throw new Error("no moment at frame 55");
    const ending = await blockOf("End the title here.");
    expect(ending).toContain(`\n\nmoment:\n${momentBlock(moment, hooked, PAUSED, true)}\n\nrequest:\n`);
    expect(ending).toContain('item hook title film=[0,156)f, to end it on this frame "frames":55');
  });
});
