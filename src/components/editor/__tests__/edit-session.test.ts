/**
 * edit-session.test.ts — the editor page's own state (plan 2026-11-24-editor-screens-a, Task 10; spec §5.1-5.3): the reducer, the
 * page's state, which controls are on, the chips, where the playhead goes; then what a read that failed, a refusal of the gate
 * and a first cut the editor was too busy for leave behind, when a problem is over, and how long a read waits. On views of
 * real edits (`views.ts`).
 */
import { describe, expect, it } from "vitest";
import { filmFrames } from "@/lib/edit";
import type { EditView } from "@/lib/edit/edit-view";
import { ASSET, FIRST, changed, viewOf } from "./views";
import {
  LEAD_IN, MOST_HELD_ASKS, MOST_READ_WAIT_MS, START, STILL, chipLabel, chipsOf, controlsOf, isView, lookKeyOfStyle, momentLabel, pageStateOf, pausedMoment, playheadAfter, readWait,
  reduce, styleBody, wantsFirstCut, type Session,
} from "../edit-session";

const take = (status: string) => ({ ...viewOf().take, status });
const waiting = viewOf({ take: take("analysing"), head: null, shown: null, edit: null, turns: [] });
const read = (view = viewOf()): Session => reduce(START, { type: "read", view });

describe("reduce", () => {
  it("takes a read only while no call is out, and an answer only for the call out", () => {
    const out = reduce(read(), { type: "start", working: { what: "change", request: "Shorter", at: null } });
    expect(reduce(out, { type: "read", view: waiting }).view).toEqual(viewOf());
    const answered = reduce(out, { type: "answered", view: viewOf({ head: 2 }) });
    expect(answered).toMatchObject({ working: null, moved: "turn" });
    expect(answered.view?.head).toBe(2);
    expect(reduce(answered, { type: "answered", view: viewOf({ head: 3 }) }).view?.head).toBe(2);
  });

  it("keeps a failed change's request, and lets one call out at a time", () => {
    const out = reduce(read(), { type: "start", working: { what: "change", request: "Shorter", at: null } });
    expect(reduce(out, { type: "start", working: { what: "ops" } }).working).toEqual({ what: "change", request: "Shorter", at: null });
    expect(reduce(out, { type: "failed", text: "Something went wrong." })).toMatchObject({ working: null, problem: { text: "Something went wrong.", request: "Shorter" } });
  });

  it("keeps the moment of a change that failed with its request, for Try again; a change about no moment keeps none (E15)", () => {
    const out = reduce(read(), { type: "start", working: { what: "change", request: "Zoom in here", at: 186 } });
    expect(out.working).toEqual({ what: "change", request: "Zoom in here", at: 186 });
    expect(reduce(out, { type: "failed", text: "Something went wrong." }).problem).toEqual({ text: "Something went wrong.", request: "Zoom in here", at: 186 });
    const none = reduce(reduce(read(), { type: "start", working: { what: "change", request: "Shorter", at: null } }), { type: "failed", text: "Something went wrong." });
    expect(none.problem).toEqual({ text: "Something went wrong.", request: "Shorter" });
    expect(none.problem).not.toHaveProperty("at");
    // A call that is no change has no moment either.
    const moved = reduce(reduce(read(viewOf({ undo: 1 })), { type: "start", working: { what: "move", to: 1 } }), { type: "failed", text: "Something went wrong." });
    expect(moved.problem).not.toHaveProperty("at");
  });

  it("says a move was a move, and reads a refusal as not here or closed", () => {
    const moved = reduce(reduce(read(), { type: "start", working: { what: "move", to: 1 } }), { type: "answered", view: viewOf() });
    expect(moved.moved).toBe("move");
    expect(reduce(START, { type: "unread", status: 404 }).unread).toBe("gone");
    expect(reduce(START, { type: "unread", status: 403 }).unread).toBe("closed");
    expect(reduce(START, { type: "unread", status: 500 }).unread).toBe("failed");
  });

  it("ends the problem of a first cut awaited once a read brings the cut, and keeps any other problem across a read", () => {
    const noCut = viewOf({ head: null, shown: null, edit: null, turns: [] });
    const busy = "The editor is already working on a call of yours; try again when it is done.";
    const awaited = reduce(reduce(read(noCut), { type: "start", working: { what: "cut", look: { kind: "house" } } }), { type: "failed", text: busy });
    expect(reduce(awaited, { type: "read", view: noCut }).problem).toEqual({ text: busy, request: null });
    expect(reduce(awaited, { type: "read", view: viewOf() })).toMatchObject({ view: { shown: 1 }, problem: null });
    // A change another writer got in before: the edit is read again, and the request is still there to send again.
    const changedSince = "The edit changed while this was being made. Try again.";
    const refused = reduce(reduce(read(), { type: "start", working: { what: "change", request: "Shorter", at: null } }), { type: "failed", text: changedSince });
    expect(reduce(refused, { type: "read", view: viewOf({ head: 2 }) })).toMatchObject({ view: { head: 2 }, problem: { text: changedSince, request: "Shorter" } });
  });

  it("ends a problem that was about a take's step once a read shows the take past it, and keeps it while the take stands", () => {
    const analysing = waiting;
    const notPicked = "A video to edit is an MP4 or a MOV file.";
    const picked = reduce(reduce(read(analysing), { type: "start", working: { what: "take" } }), { type: "failed", text: notPicked });
    expect(reduce(picked, { type: "read", view: analysing }).problem).toEqual({ text: notPicked, request: null });
    const ready = reduce(picked, { type: "read", view: viewOf({ head: null, shown: null, edit: null, turns: [] }) });
    expect(ready.problem).toBeNull();
    expect(wantsFirstCut(ready)).toBe(true);
    // Another take in its place, put there elsewhere: the problem was about the one before.
    expect(reduce(picked, { type: "read", view: { ...analysing, take: { ...analysing.take, id: "33333333-3333-4333-8333-333333333333" } } }).problem).toBeNull();
  });

  it("ends the problem of a change that the read after it shows was made, and plays it", () => {
    const unreached = "The editor could not be reached. Check your connection.";
    const lost = reduce(reduce(read(), { type: "start", working: { what: "change", request: "Shorter", at: null } }), { type: "failed", text: unreached, status: 0 });
    const turn = (n: number, request: string, kind: "change" | "said" = "change") => ({ n, kind, request, at: null, say: "Done.", doc: kind === "change", findings: [], kept: [] });
    const made = viewOf({ head: 2, shown: 2, undo: 1, turns: [...viewOf().turns, turn(2, "Shorter")] });
    expect(reduce(lost, { type: "read", view: made })).toMatchObject({ view: { head: 2 }, problem: null, moved: "turn" });
    // An answer that changed nothing is the request's answer all the same.
    expect(reduce(lost, { type: "read", view: viewOf({ head: 2, turns: [...viewOf().turns, turn(2, "Shorter", "said")] }) }).problem).toBeNull();
    // The route keeps a request without the space around it: it is the same request.
    const spaced = reduce(reduce(read(), { type: "start", working: { what: "change", request: " Shorter ", at: null } }), { type: "failed", text: unreached, status: 0 });
    expect(reduce(spaced, { type: "read", view: made }).problem).toBeNull();
    // Another request made there first: this one was not made, and stays to send again.
    expect(reduce(lost, { type: "read", view: viewOf({ head: 2, shown: 2, turns: [...viewOf().turns, turn(2, "Add zooms")] }) }).problem).toEqual({ text: unreached, request: "Shorter" });
  });

  it("ends the problem of a hand change that the read after it shows was made, and plays it (m5)", () => {
    const late = "The editor did not answer in time.";
    const lost = reduce(reduce(read(), { type: "start", working: { what: "ops" } }), { type: "failed", text: late, status: 0 });
    expect(lost.problem).toMatchObject({ text: late, request: null });
    const direct = { n: 2, kind: "direct" as const, request: null, at: null, say: 'Changed "Good" to "Great".', doc: true, findings: [], kept: [] };
    expect(reduce(lost, { type: "read", view: viewOf({ head: 2, shown: 2, undo: 1, turns: [...viewOf().turns, direct] }) })).toMatchObject({ view: { head: 2 }, problem: null, moved: "turn" });
    // Not made: the edit stands where it was, and so does the problem.
    expect(reduce(lost, { type: "read", view: viewOf() }).problem).toMatchObject({ text: late, request: null });
    // A change of another kind made there first is no hand change of this page's.
    const asked = { ...direct, kind: "change" as const, request: "Shorter", say: "Done." };
    expect(reduce(lost, { type: "read", view: viewOf({ head: 2, shown: 2, turns: [...viewOf().turns, asked] }) }).problem).toMatchObject({ text: late, request: null });
    // Any other call that fails after the cut keeps its problem across a read that moved the edit, as before.
    const moveLost = reduce(reduce(read(viewOf({ undo: 1 })), { type: "start", working: { what: "move", to: 1 } }), { type: "failed", text: late, status: 0 });
    expect(reduce(moveLost, { type: "read", view: viewOf({ head: 2, shown: 2, turns: [...viewOf().turns, direct] }) }).problem).toMatchObject({ text: late });
  });

  it("tells the page of a change made after all, so its request leaves the field it was put back in; the next call forgets it (m5)", () => {
    const lost = reduce(reduce(read(), { type: "start", working: { what: "change", request: " Shorter ", at: null } }), { type: "failed", text: "The editor did not answer in time.", status: 0 });
    expect(lost.madeAfterAll).toBeNull();
    expect(reduce(lost, { type: "read", view: viewOf() }).madeAfterAll).toBeNull();
    const turn = { n: 2, kind: "change" as const, request: "Shorter", at: null, say: "Done.", doc: true, findings: [], kept: [] };
    const made = reduce(lost, { type: "read", view: viewOf({ head: 2, shown: 2, undo: 1, turns: [...viewOf().turns, turn] }) });
    expect(made).toMatchObject({ problem: null, madeAfterAll: "Shorter" });
    expect(reduce(made, { type: "start", working: { what: "move", to: 1 } }).madeAfterAll).toBeNull();
    expect(START.madeAfterAll).toBeNull();
  });

  it("says a read that failed, and the gate's own sentence when it refused; the next read that brings the edit ends both", () => {
    const signedOut = reduce(read(), { type: "unread", status: 401, text: "Sign in to use the edit tool." });
    expect(signedOut).toMatchObject({ unread: "closed", gate: "Sign in to use the edit tool." });
    expect(reduce(START, { type: "unread", status: 403, text: "The edit tool is not open to this account yet." })).toMatchObject({ unread: "closed", gate: "The edit tool is not open to this account yet." });
    expect(reduce(START, { type: "unread", status: 0 })).toMatchObject({ unread: "failed", gate: null });
    expect(reduce(signedOut, { type: "read", view: viewOf() })).toMatchObject({ unread: null, gate: null });
    expect(reduce(reduce(START, { type: "unread", status: 503 }), { type: "read", view: viewOf() }).unread).toBeNull();
    // So does a call's answer: it is the edit, read.
    const missed = reduce(read(), { type: "unread", status: 500 });
    expect(reduce(reduce(missed, { type: "start", working: { what: "ops" } }), { type: "answered", view: viewOf({ head: 2 }) }).unread).toBeNull();
  });
});

describe("a first cut the editor was too busy for", () => {
  const noCut = viewOf({ head: null, shown: null, edit: null, turns: [] });
  const busy = "The editor is already working on a call of yours; try again when it is done.";
  const asked = (session: Session): Session => reduce(session, { type: "start", working: { what: "cut", look: { kind: "house" } } });
  const refused = (session: Session, status = 409): Session => reduce(asked(session), { type: "failed", text: busy, status });

  it("is no problem to show while the page asks again by itself, and is not asked for at once", () => {
    const once = refused(read(noCut));
    expect(once).toMatchObject({ working: null, problem: null, busy: 1 });
    expect(pageStateOf(once, null)).toBe("cutting");
    expect(wantsFirstCut(once)).toBe(false);
    expect(refused(once)).toMatchObject({ problem: null, busy: 2 });
  });

  it("becomes the problem shown after it was asked again the most times, and starts over when that is put away", () => {
    let session = read(noCut);
    for (let n = 0; n < MOST_HELD_ASKS; n++) session = refused(session);
    expect(session).toMatchObject({ problem: null, busy: MOST_HELD_ASKS });
    const given = refused(session);
    expect(given).toMatchObject({ problem: { text: busy, request: null }, busy: 0 });
    expect(wantsFirstCut(given)).toBe(false);
    expect(wantsFirstCut(reduce(given, { type: "dismiss" }))).toBe(true);
  });

  it("ends when the cut is made, when it fails another way, and when the cut arrives by a read", () => {
    const once = refused(read(noCut));
    expect(reduce(asked(once), { type: "answered", view: viewOf() })).toMatchObject({ busy: 0, problem: null });
    expect(refused(once, 500)).toMatchObject({ busy: 0, problem: { text: busy, request: null } });
    expect(reduce(once, { type: "read", view: viewOf() })).toMatchObject({ busy: 0, view: { shown: 1 } });
    expect(reduce(once, { type: "read", view: noCut }).busy).toBe(1);
  });

  it("is still asked for again after another call failed meanwhile (a video picked and refused)", () => {
    const once = refused(read(noCut));
    const picked = reduce(reduce(once, { type: "start", working: { what: "take" } }), { type: "failed", text: "Something went wrong.", status: 500 });
    expect(picked).toMatchObject({ busy: 1, problem: { text: "Something went wrong.", request: null } });
    // And not once another take is in its place: that one's cut is asked for afresh.
    expect(reduce(reduce(once, { type: "start", working: { what: "take" } }), { type: "answered", view: waiting }).busy).toBe(0);
  });

  it("leaves a problem shown beside it where it is when the page asks again: that asking is not the creator's new try", () => {
    const notPicked = { text: "A video to edit is an MP4 or a MOV file.", request: null };
    const picked = reduce(reduce(refused(read(noCut)), { type: "start", working: { what: "take" } }), { type: "failed", text: notPicked.text });
    expect(asked(picked).problem).toEqual(notPicked);
    expect(refused(picked)).toMatchObject({ busy: 2, problem: notPicked });
    // The cut made ends it, as any answer does; and the creator's own try starts clean.
    expect(reduce(asked(picked), { type: "answered", view: viewOf() }).problem).toBeNull();
    expect(asked(reduce(picked, { type: "dismiss" })).problem).toBeNull();
    expect(reduce(reduce(read(), { type: "failed", text: "x" }), { type: "start", working: { what: "cut", look: { kind: "house" } } }).problem).toBeNull();
  });

  it("is only a first cut: a look picked on a cut, or a change, that is refused the same way is a problem at once", () => {
    expect(refused(read())).toMatchObject({ busy: 0, problem: { text: busy, request: null } });
    const change = reduce(reduce(read(), { type: "start", working: { what: "change", request: "Shorter", at: null } }), { type: "failed", text: busy, status: 409 });
    expect(change).toMatchObject({ busy: 0, problem: { text: busy, request: "Shorter" } });
  });
});

describe("a read", () => {
  it("waits twice as long after each one that failed, up to half a minute", () => {
    expect([0, 1, 2, 3, 4].map((missed) => readWait(1500, missed))).toEqual([1500, 3000, 6000, 12_000, 24_000]);
    expect(readWait(1500, 5)).toBe(MOST_READ_WAIT_MS);
    expect(readWait(1500, 500)).toBe(MOST_READ_WAIT_MS);
    expect(MOST_READ_WAIT_MS).toBe(30_000);
  });

  it("is an edit only when it has the shape of one", () => {
    expect(isView(viewOf())).toBe(true);
    expect(isView(waiting)).toBe(true);
    for (const not of [{}, null, "edit", [], { ...viewOf(), take: null }, { ...viewOf(), turns: undefined }, { ...viewOf(), shown: undefined }, { ...viewOf(), edit: null }, { ...viewOf(), next: undefined }]) expect(isView(not)).toBe(false);
  });
});

describe("the page's state", () => {
  it("follows the take and the cut (§5.1)", () => {
    expect(pageStateOf(START, null)).toBe("loading");
    expect(pageStateOf(reduce(START, { type: "unread", status: 404 }), null)).toBe("not here");
    expect(pageStateOf(reduce(START, { type: "unread", status: 403 }), null)).toBe("closed");
    const uploading = read(viewOf({ take: take("uploading"), head: null, shown: null, edit: null, turns: [] }));
    expect(pageStateOf(uploading, { status: "sending" })).toBe("getting ready");
    expect(pageStateOf(uploading, null)).toBe("upload stopped");
    expect(pageStateOf(uploading, { status: "failed" })).toBe("upload stopped");
    expect(pageStateOf(read(waiting), null)).toBe("getting ready");
    expect(pageStateOf(read(viewOf({ take: take("failed"), head: null, shown: null, edit: null, turns: [] })), null)).toBe("take failed");
    expect(pageStateOf(read(viewOf({ head: null, shown: null, edit: null, turns: [] })), null)).toBe("cutting");
    expect(pageStateOf(read(), null)).toBe("ready");
    const exporting = viewOf({ export: { job: "j", turn: 1, status: "running", stage: "drawing", progress: 0.4, error: null, filmUrl: null, ms: null } });
    expect(pageStateOf(read(exporting), null)).toBe("exporting");
  });

  it("says an edit that could not be read, until one read brings it; a later read that fails keeps what is shown", () => {
    const failed = reduce(START, { type: "unread", status: 503 });
    expect(pageStateOf(failed, null)).toBe("not read");
    expect(pageStateOf(reduce(failed, { type: "read", view: viewOf() }), null)).toBe("ready");
    expect(pageStateOf(reduce(read(waiting), { type: "unread", status: 500 }), null)).toBe("getting ready");
    expect(pageStateOf(reduce(read(), { type: "unread", status: 401 }), null)).toBe("closed");
  });

  it("asks for the first cut only for a ready take with no turn, nothing out and nothing wrong", () => {
    const ready = read(viewOf({ head: null, shown: null, edit: null, turns: [] }));
    expect(wantsFirstCut(ready)).toBe(true);
    expect(wantsFirstCut(read(waiting))).toBe(false);
    expect(wantsFirstCut(read())).toBe(false);
    expect(wantsFirstCut(reduce(ready, { type: "start", working: { what: "cut", look: { kind: "house" } } }))).toBe(false);
  });
});

describe("the controls and the chips", () => {
  it("are on with a cut, while nothing is out and nothing is exported", () => {
    expect(controlsOf(read(viewOf({ undo: 1, redo: null })))).toEqual({ ask: true, tools: true, undo: true, redo: false, exportOn: true, exporting: false });
    expect(controlsOf(reduce(read(), { type: "start", working: { what: "ops" } })).ask).toBe(false);
    const exporting = viewOf({ undo: 1, export: { job: "j", turn: 1, status: "queued", stage: null, progress: 0, error: null, filmUrl: null, ms: null } });
    expect(controlsOf(read(exporting))).toEqual({ ask: false, tools: false, undo: false, redo: false, exportOn: false, exporting: true });
  });

  it("offer what to check first, a video's style when ready, then the fixed next steps, four at most (§5.3)", () => {
    const finding = { code: "on-face" as const, severity: "error" as const, where: { frame: 30, shot: "s1" }, says: "the captions cover the face" };
    const other = { ...finding, where: { frame: 200, shot: "s2" } };
    const found = viewOf({ turns: [{ n: 1, kind: "cut", request: "house", at: null, say: "Captions are on.", doc: true, findings: [finding, other], kept: [] }] });
    expect(chipsOf(found, false).map(chipLabel)).toEqual(["2 to check", "Shorter", "Bigger captions", "Add zooms"]);
    expect(chipsOf(found, true).map(chipLabel)).toEqual(["2 to check", "Use that style", "Shorter", "Bigger captions"]);
    expect(chipsOf(viewOf(), false).map(chipLabel)).toEqual(["Shorter", "Bigger captions", "Add zooms"]);
    expect(chipsOf(waiting, false)).toEqual([]);
  });

  it("count what to check in the edit shown, also under an answer that changed nothing", () => {
    const finding = { code: "on-face" as const, severity: "error" as const, where: { frame: 30 }, says: "the captions cover the face" };
    const said = viewOf({
      head: 2,
      shown: 1,
      turns: [
        { n: 1, kind: "cut", request: "house", at: null, say: "Captions are on.", doc: true, findings: [finding], kept: [] },
        { n: 2, kind: "said", request: "Shorter", at: null, say: "It is as short as it can be.", doc: false, findings: [], kept: [] },
      ],
    });
    expect(chipsOf(said, false).map(chipLabel)).toEqual(["1 to check", "Shorter", "Bigger captions", "Add zooms"]);
  });

  describe("slice B (Task 8)", () => {
    const face = { code: "on-face" as const, severity: "error" as const, where: { frame: 30, shot: "s1" }, says: "the captions cover the face" };
    const soft = { code: "soft-zoom" as const, severity: "warn" as const, where: { frame: 120, shot: "s2" }, says: "shot s2 is zoomed past its take's sharp limit" };
    const ZOOMS = [
      { kind: "zoom" as const, label: "Zoom less", request: "Zoom in less here.", at: 120 },
      { kind: "zoom" as const, label: "Hold it longer", request: "Hold this zoom longer here.", at: 120 },
    ];
    const changedTo = (more: Partial<EditView["turns"][number]>, next: EditView["next"]) =>
      viewOf({ head: 2, shown: 2, undo: 1, next, turns: [...viewOf().turns, { n: 2, kind: "change", request: "Zoom in here", at: 120, say: "Zoomed in.", doc: true, findings: [], kept: [], ...more }] });

    it("count what is left to check, leave out a kind the steps already offer, and put the steps after the change before the fixed ones", () => {
      const view = changedTo({ findings: [face, soft], kept: ["soft-zoom s2"] }, ZOOMS);
      expect(chipsOf(view, false).map(chipLabel)).toEqual(["1 to check", "Zoom less", "Hold it longer", "Shorter"]);
      expect(chipsOf(view, false)[1]).toEqual({ kind: "step", step: ZOOMS[0] });
      // Everything put away: nothing to check.
      expect(chipsOf(changedTo({ findings: [face, soft], kept: ["soft-zoom s2", "on-face error s1"] }, ZOOMS), false).map(chipLabel)).toEqual(["Zoom less", "Hold it longer", "Shorter", "Bigger captions"]);
      // Put it back and smaller captions take the places of Shorter and Bigger captions.
      const putBack = { kind: "cut" as const, label: "Put it back", request: null, at: null };
      const smaller = { kind: "captions" as const, label: "Smaller captions", request: "Make the captions a little smaller.", at: null };
      expect(chipsOf(changedTo({}, [putBack, smaller]), false).map(chipLabel)).toEqual(["Put it back", "Smaller captions", "Add zooms"]);
      expect(chipsOf(changedTo({}, [putBack, smaller]), true).map(chipLabel)).toEqual(["Use that style", "Put it back", "Smaller captions", "Add zooms"]);
    });

    it("offer Captions on, made by hand, in the place of Bigger captions while the captions are off", () => {
      const off = viewOf({ edit: changed(FIRST, [{ op: "captions.set", on: false }]) });
      expect(chipsOf(off, false).map(chipLabel)).toEqual(["Shorter", "Captions on", "Add zooms"]);
      expect(chipsOf(off, false)[1]).toEqual({ kind: "hand", text: "Captions on", ops: [{ op: "captions.set", on: true }] });
      expect(chipsOf(viewOf(), false).map(chipLabel)).toEqual(["Shorter", "Bigger captions", "Add zooms"]);
    });
  });
});

describe("the playhead after the edit changes", () => {
  it("stands a first cut half a second in, still", () => {
    expect(playheadAfter(null, FIRST, 0, "turn")).toEqual({ frame: STILL, play: false, still: true });
  });

  it("goes to just before where a change starts and plays it", () => {
    const fixed = changed(FIRST, [{ op: "word.set", asset: ASSET.id, index: 4, text: "start" }]);
    expect(playheadAfter(FIRST, fixed, 200, "turn")).toEqual({ frame: 45 - LEAD_IN, play: true, still: false });
    expect(playheadAfter(FIRST, fixed, 200, "move")).toEqual({ frame: 45 - LEAD_IN, play: false, still: false });
  });

  it("stays where it was when the whole film changed, or at the start when its frame is gone", () => {
    const mono = changed(FIRST, [{ op: "look.set", preset: "mono" }]);
    expect(playheadAfter(FIRST, mono, 200, "turn")).toEqual({ frame: 200, play: false, still: false });
    const short = changed(mono, [{ op: "shot.trim", id: "s1", endMs: 3000 }]);
    expect(playheadAfter(mono, short, filmFrames(mono) - 1, "turn").frame).toBe(Math.max(0, filmFrames(short) - 30 - LEAD_IN));
    // The whole film changed and is shorter than where the playhead stood: that frame is gone.
    expect(filmFrames(short)).toBeLessThan(filmFrames(FIRST));
    expect(playheadAfter(FIRST, short, filmFrames(FIRST) - 1, "turn")).toEqual({ frame: 0, play: false, still: false });
    expect(playheadAfter(FIRST, short, 10, "turn")).toEqual({ frame: 10, play: false, still: false });
  });
});

describe("the moment a request is about (E15)", () => {
  it("is the film frame the video is paused on: not while it plays, not where a first cut stands, not its end, not the one taken away", () => {
    expect(pausedMoment(100, 338, false, null)).toBe(100);
    expect(pausedMoment(100, 338, true, null)).toBeNull();
    // The first half second: where a first cut stands by itself, which nobody paused on.
    expect(pausedMoment(15, 338, false, null)).toBeNull();
    expect(pausedMoment(16, 338, false, null)).toBe(16);
    // The film's end: where it stops by itself.
    expect(pausedMoment(337, 338, false, null)).toBeNull();
    expect(pausedMoment(336, 338, false, null)).toBe(336);
    // The tag taken away: gone on that frame, back on another.
    expect(pausedMoment(100, 338, false, 100)).toBeNull();
    expect(pausedMoment(101, 338, false, 100)).toBe(101);
    expect(STILL).toBe(15);
  });

  it("is said as the scrubber says the time: the whole seconds gone by, rounded down", () => {
    expect([186, 40, 29, 30, 1799, 1800].map(momentLabel)).toEqual(["0:06", "0:01", "0:00", "0:01", "0:59", "1:00"]);
  });
});

describe("a look as a cut asks for it", () => {
  it("is a body and a key", () => {
    expect(styleBody({ kind: "house" })).toEqual({});
    expect(styleBody({ kind: "preset", id: "clean" })).toEqual({ style: { preset: "clean" } });
    expect(styleBody({ kind: "words", words: "calm" })).toEqual({ style: { words: "calm" } });
    expect(styleBody({ kind: "video", style: { a: 1 } })).toEqual({ style: { a: 1 } });
    expect(lookKeyOfStyle({ kind: "preset", id: "clean" })).toBe("clean");
    expect(lookKeyOfStyle({ kind: "video", style: null })).toBe("video");
  });
});
