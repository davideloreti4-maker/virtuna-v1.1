/** @vitest-environment happy-dom */
/**
 * editor-screen.test.tsx — the editor page (plan 2026-11-24-editor-screens-a, Task 15; spec §3, §5.1, §5.4; rulings R17, R20,
 * R23, R24, R27, R28, R29): its ten states, each with something happening or something to tap and one problem at the most; a
 * change and Undo with the playhead sent to it; a look; a word fixed by hand; a video's style read in the background; what to
 * check; the export held in the page, given up, and its Ready sheet; one address a take. Everything of ours is real, the kit's
 * Player and the uploads' holder too; the network is stood in with the routes' own answers (views of real edits), and what
 * happy-dom lacks as a browser (fonts, a file's address) is given empty stand-ins.
 */
import { act, cleanup, fireEvent, renderHook, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const router = { push: vi.fn(), back: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/edit/e" }));

import { filmFrames } from "@/lib/edit";
import type { EditView, ExportShown, TurnShown } from "@/lib/edit/edit-view";
import type { Finding } from "@/lib/edit/review";
import { useShellStore } from "@/stores/shell-store";
import { renderWithClient } from "@/test/render-with-client";
import { EditorScreen, HOLD_MS, useHeld } from "../editor-screen";
import { Refused } from "../net";
import { plainEdit } from "../original";
import { POSTED_KEY } from "../posted";
import { forgetUpload, startUpload, uploadOf, type UploadDeps } from "../uploads";
import { ASSET, EDIT_ID, FIRST, changed, viewOf } from "./views";

/** No captions: happy-dom loads no font to measure them with. */
const QUIET = changed(FIRST, [{ op: "captions.set", on: false }]);
/** The same cut ended at ten seconds: 300 frames, and what changed is seen from frame 270 on (`firstChangedFrame`). */
const SHORT = changed(QUIET, [{ op: "shot.trim", id: "s1", endMs: 10_000 }]);
const base = `/api/edit/edits/${EDIT_ID}`;
const shown = (more: Partial<EditView> = {}) => viewOf({ edit: QUIET, ...more });
const job = (status: string, more: Partial<ExportShown> = {}): ExportShown => ({ job: "j1", turn: 1, status, stage: null, progress: 0.4, error: null, filmUrl: null, ms: null, ...more });
const made = (more: Partial<ExportShown> = {}) => job("done", { progress: 1, filmUrl: "https://media.test/films/film-1.mp4", ms: 12_700, ...more });
const turn = (n: number, more: Partial<TurnShown>): TurnShown => ({ n, kind: "change", request: null, at: null, say: "", doc: true, findings: [], kept: [], ...more });
const FINDING: Finding = { code: "on-face", severity: "error", where: { frame: 180 }, says: "the captions cover the face" };
/** The edit after "Shorter": turn 2, the shorter cut, with one thing to check. */
const two = (more: Partial<EditView> = {}) =>
  shown({ edit: SHORT, head: 2, shown: 2, undo: 1, turns: [...viewOf().turns, turn(2, { request: "Shorter", say: "Cut it to 10 seconds.", findings: [FINDING] })], ...more });
/** The take as it stands before its first cut. */
const before = (status: "uploading" | "analysing" | "ready" | "failed", more: Partial<EditView["take"]> = {}) =>
  viewOf({
    take: { ...viewOf().take, status, ...(status === "ready" ? {} : { previewUrl: null, posterUrl: null, asset: null, ms: null }), ...more },
    look: null, head: null, shown: null, edit: null, turns: [],
  });

type Answer = { status: number; body: unknown };
/** The network: each call's answers in order (one may come later), then the one kept for it; a call with neither fails to get there. */
function network(answers: Record<string, (Answer | Promise<Answer>)[]>, keep: Record<string, Answer> = {}) {
  const asked: { call: string; body: unknown }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith("/edit/fonts/")) return new Response(new ArrayBuffer(8));
    if (!path.startsWith("/api/")) return new Response(null, { status: 404 });
    const call = `${init?.method ?? "GET"} ${path}`;
    asked.push({ call, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const next = (await answers[call]?.shift()) ?? keep[call];
    if (!next) throw new Error(`no answer for ${call}`);
    return new Response(JSON.stringify(next.body), { status: next.status, headers: { "Content-Type": "application/json" } });
  }));
  return { asked, keep, calls: (call: string) => asked.filter((one) => one.call === call) };
}
const ok = (view: EditView): Answer => ({ status: 200, body: view });
const refused = (status: number, error: string): Answer => ({ status, body: { error } });
/** An answer that comes when the test says so. */
function later() {
  let give!: (answer: Answer) => void;
  const answer = new Promise<Answer>((resolve) => (give = resolve));
  return { answer, give };
}
const open = (pollMs = 5) => renderWithClient(<EditorScreen id={EDIT_ID} pollMs={pollMs} />);
const field = () => screen.getByRole("textbox", { name: "Ask for a change" });
const playhead = () => screen.getByRole("slider", { name: "Playhead" });
/** Every frame the playhead is on from here on, in order. */
function framesBeen(): () => number[] {
  const been: number[] = [];
  const read = (records: MutationRecord[]) => records.forEach(() => been.push(Number(playhead().getAttribute("aria-valuenow"))));
  const watch = new MutationObserver(read);
  watch.observe(playhead(), { attributes: true, attributeFilter: ["aria-valuenow"] });
  return () => {
    read(watch.takeRecords());
    return been;
  };
}
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const noButton = (name: string | RegExp) => expect(screen.queryByRole("button", { name })).toBeNull();
/** The take's own `<video>`, before the cut: the stage's child (the film has video elements of its own, deeper). */
const takeVideo = () => document.querySelector<HTMLVideoElement>("[data-part=stage] > video");

/** An upload of the take held by the real holder, its PUT stood in. */
const TAKE = ASSET.id;
const hold = (deps: UploadDeps) =>
  startUpload({ id: TAKE, uploadUrl: "https://r2.test/put", type: "video/mp4" }, new File([new Uint8Array(11_000)], "take.mp4", { type: "video/mp4" }), {
    objectUrl: () => "blob:local/1", revoke: () => {}, ...deps,
  });

class NoFontFace {
  constructor(readonly family: string) {}
  load = async () => this;
}
/** What the Player says as it mounts in happy-dom, which is no browser (no canvas, no AudioContext), and its licence note. */
const SAID_OF_HAPPY_DOM = ["MediaPlayer initialization failed", "AudioContext is not supported", "required to obtain a license to use Remotion"];
beforeAll(() => {
  Object.defineProperty(document, "fonts", { configurable: true, value: { add: () => {}, ready: Promise.resolve() } });
});
beforeEach(() => {
  vi.stubGlobal("FontFace", NoFontFace);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local/meta");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  for (const level of ["error", "warn"] as const) {
    const say = console[level].bind(console);
    vi.spyOn(console, level).mockImplementation((...told: unknown[]) => (told.some((one) => SAID_OF_HAPPY_DOM.some((known) => String(one).includes(known))) ? undefined : say(...told)));
  }
});
afterEach(() => {
  cleanup();
  forgetUpload(TAKE);
  router.push.mockReset();
  router.back.mockReset();
  useShellStore.setState({ threadBack: null });
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("the editor page, with a cut", () => {
  it("shows the cut: the header, the tools, the first cut's line and the field, and nothing of the next slice", async () => {
    network({ [`GET ${base}`]: [ok(shown())] });
    open();
    expect(await screen.findByText("Captions are on.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Good morning" })).toBeInTheDocument();
    expect(button("Back")).toBeEnabled();
    expect(button("Undo")).toBeDisabled();
    expect(button("Redo")).toBeDisabled();
    expect(button("Export")).toBeEnabled();
    expect(button(/^Look/)).toBeEnabled();
    expect(button("Captions")).toBeEnabled();
    expect(field()).toBeEnabled();
    expect(playhead()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(button("Original")).toHaveAttribute("aria-pressed", "false");
    expect(button("Preview as posted")).toBeEnabled();
    expect(document.querySelector("[data-part=editor]")).toHaveAttribute("data-state", "ready");
  });

  it("stands a cut half a second in, and plays it from its start", async () => {
    network({ [`GET ${base}`]: [ok(shown())] });
    open();
    await screen.findByText("Captions are on.");
    await waitFor(() => expect(playhead()).toHaveAttribute("aria-valuenow", "15"));
    const been = framesBeen();
    fireEvent.click(button("Play"));
    await waitFor(() => expect(been()).toContain(0));
    expect(button("Pause")).toBeInTheDocument();
  });

  it("asks for a change, plays it from where it starts, and undoes it from the header", async () => {
    const net = network({ [`GET ${base}`]: [ok(shown())], [`POST ${base}/change`]: [ok(two())], [`POST ${base}/head`]: [ok(shown({ redo: 2 }))] });
    open();
    await screen.findByText("Captions are on.");
    await waitFor(() => expect(playhead()).toHaveAttribute("aria-valuenow", "15"));
    const been = framesBeen();
    fireEvent.change(field(), { target: { value: "Shorter" } });
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(await screen.findByText("Cut it to 10 seconds.")).toBeInTheDocument();
    expect(net.calls(`POST ${base}/change`)[0]?.body).toEqual({ request: "Shorter" });
    expect(field()).toHaveValue("");
    // Sent to half a second before the frame it changed (270), and played from there.
    await waitFor(() => expect(Math.max(...been(), 0)).toBeGreaterThan(255));
    expect(been()[0]).toBe(255);
    expect(Math.min(...been())).toBe(255);
    expect(button("Pause")).toBeInTheDocument();
    expect(playhead()).toHaveAttribute("aria-valuemax", "299");
    const undo = screen.getAllByRole("button", { name: "Undo" })[0]!;
    await waitFor(() => expect(undo).toBeEnabled());
    fireEvent.click(undo);
    await waitFor(() => expect(net.calls(`POST ${base}/head`)[0]?.body).toEqual({ n: 1 }));
    // Back on the first cut: half a second before its first frame the shorter one had not (300), and waiting there.
    await waitFor(() => expect(playhead()).toHaveAttribute("aria-valuenow", "285"));
    expect(button("Play")).toBeInTheDocument();
    expect(button("Redo")).toBeEnabled();
  });

  it("gives a change that failed back: its sentence with Try again, and its words in the field", async () => {
    const net = network({ [`GET ${base}`]: [ok(shown())], [`POST ${base}/change`]: [refused(502, "the editor could not make that change"), ok(two())] }, { [`GET ${base}`]: ok(shown()) });
    open();
    await screen.findByText("Captions are on.");
    fireEvent.change(field(), { target: { value: "Shorter" } });
    fireEvent.keyDown(field(), { key: "Enter" });
    const said = await screen.findByRole("alert");
    expect(said).toHaveTextContent("The editor could not make that change.");
    expect(field()).toHaveValue("Shorter");
    fireEvent.click(within(said).getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Cut it to 10 seconds.")).toBeInTheDocument();
    expect(net.calls(`POST ${base}/change`)).toHaveLength(2);
    expect(field()).toHaveValue("");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not put a change back in the field when the read after its lost answer shows it made, and says no problem (m5)", async () => {
    const made = two();
    const net = network({ [`GET ${base}`]: [ok(shown()), ok(made)], [`POST ${base}/change`]: [refused(500, "it answered 500")] }, { [`GET ${base}`]: ok(made) });
    open();
    await screen.findByText("Captions are on.");
    fireEvent.change(field(), { target: { value: "Shorter" } });
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(await screen.findByText("Cut it to 10 seconds.")).toBeInTheDocument();
    await waitFor(() => expect(net.calls(`GET ${base}`).length).toBeGreaterThanOrEqual(2));
    await act(async () => void (await new Promise((done) => setTimeout(done, 20))));
    expect(field()).toHaveValue("");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(net.calls(`POST ${base}/change`)).toHaveLength(1);
  });

  it("leaves what the creator typed since in the field when that change is found made", async () => {
    const answer = later();
    network({ [`GET ${base}`]: [ok(shown()), ok(two())], [`POST ${base}/change`]: [answer.answer] }, { [`GET ${base}`]: ok(two()) });
    open();
    await screen.findByText("Captions are on.");
    fireEvent.change(field(), { target: { value: "Shorter" } });
    fireEvent.keyDown(field(), { key: "Enter" });
    await screen.findByText("Working on it…");
    fireEvent.change(field(), { target: { value: "Add zooms" } });
    await act(async () => answer.give(refused(500, "it answered 500")));
    expect(await screen.findByText("Cut it to 10 seconds.")).toBeInTheDocument();
    await act(async () => void (await new Promise((done) => setTimeout(done, 20))));
    expect(field()).toHaveValue("Add zooms");
  });

  it("says no problem of a hand change whose answer was lost when the read after it shows it made (m5)", async () => {
    const fixed = shown({ head: 2, shown: 2, undo: 1, turns: [...viewOf().turns, turn(2, { kind: "direct", say: 'Changed "Good" to "Gud".' })] });
    const net = network({ [`GET ${base}`]: [ok(shown()), ok(fixed)], [`POST ${base}/ops`]: [refused(500, "it answered 500")] }, { [`GET ${base}`]: ok(fixed) });
    open();
    await screen.findByText("Captions are on.");
    fireEvent.click(button("Captions"));
    const sheet = await screen.findByRole("dialog", { name: "Captions" });
    fireEvent.click(within(sheet).getByRole("button", { name: "Good" }));
    const word = within(sheet).getByRole("textbox", { name: "Word 1" });
    fireEvent.change(word, { target: { value: "Gud" } });
    fireEvent.keyDown(word, { key: "Enter" });
    expect(await screen.findByText('Changed "Good" to "Gud".')).toBeInTheDocument();
    await waitFor(() => expect(net.calls(`GET ${base}`).length).toBeGreaterThanOrEqual(2));
    await act(async () => void (await new Promise((done) => setTimeout(done, 20))));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("Something went wrong.")).toBeNull();
  });

  it("cuts again in a look picked in its sheet, and says which while it is made", async () => {
    const cut = later();
    const net = network({ [`GET ${base}`]: [ok(shown())], [`POST ${base}/cut`]: [cut.answer] });
    open();
    await screen.findByText("Captions are on.");
    fireEvent.click(button(/^Look/));
    fireEvent.click(await screen.findByRole("button", { name: "Clean" }));
    await waitFor(() => expect(net.calls(`POST ${base}/cut`)[0]?.body).toEqual({ style: { preset: "clean" } }));
    expect(await screen.findByText("Look: Clean")).toBeInTheDocument();
    expect(screen.getByText("Working on it…")).toBeInTheDocument();
    expect(button("Export")).toBeDisabled();
    await act(async () => cut.give(ok(shown({ look: "clean", head: 2, shown: 2, undo: 1, turns: [...viewOf().turns, turn(2, { kind: "cut", request: "clean", say: "Captions are on." })] }))));
    await waitFor(() => expect(screen.queryByText("Working on it…")).toBeNull());
    expect(screen.getByText("Look: Clean")).toBeInTheDocument();
  });

  it("opens what to check in the edit shown as a card at its moment, and closes it when another turn is shown", async () => {
    // The head rests on an answer that changed nothing: what to check is still what was found in the edit shown, turn 2.
    const rests = two({ head: 3, turns: [...two().turns, turn(3, { kind: "said", request: "Make it purple", say: "Colours are not something I can change yet.", doc: false })] });
    network({ [`GET ${base}`]: [ok(rests)], [`POST ${base}/head`]: [ok(shown({ redo: 3 })), ok(rests)] });
    open();
    const check = await screen.findByRole("button", { name: "1 to check" });
    expect(document.querySelectorAll("[data-part=mark]")).toHaveLength(1);
    expect(screen.queryByText(/The captions cover your face/)).toBeNull();
    fireEvent.click(check);
    expect(screen.getByRole("group", { name: "Things to check" })).toHaveTextContent(/^0:06 · The captions cover your face here\./);
    await waitFor(() => expect(playhead()).toHaveAttribute("aria-valuenow", "180"));
    // A cut that was moved before it was ever played plays from where it was put, not from its start.
    const been = framesBeen();
    fireEvent.click(button("Play"));
    await waitFor(() => expect(Math.max(...been(), 0)).toBeGreaterThan(180));
    expect(Math.min(...been())).toBeGreaterThanOrEqual(180);
    fireEvent.click(button("Pause"));
    fireEvent.click(screen.getAllByRole("button", { name: "Undo" })[0]!);
    await waitFor(() => expect(button("Redo")).toBeEnabled());
    expect(screen.queryByRole("group", { name: "Things to check" })).toBeNull();
    noButton("1 to check");
    expect(document.querySelectorAll("[data-part=mark]")).toHaveLength(0);
    fireEvent.click(button("Redo"));
    expect(await screen.findByRole("button", { name: "1 to check" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Things to check" })).toBeNull();
  });

  it("closes the Captions sheet on a word that could not be fixed, so the problem is read", async () => {
    const net = network({ [`GET ${base}`]: [ok(shown())], [`POST ${base}/ops`]: [refused(409, "the edit changed meanwhile")] }, { [`GET ${base}`]: ok(shown()) });
    open();
    await screen.findByText("Captions are on.");
    fireEvent.click(button("Captions"));
    const sheet = await screen.findByRole("dialog", { name: "Captions" });
    fireEvent.click(within(sheet).getByRole("button", { name: "Good" }));
    const word = within(sheet).getByRole("textbox", { name: "Word 1" });
    fireEvent.change(word, { target: { value: "Gud" } });
    fireEvent.keyDown(word, { key: "Enter" });
    await waitFor(() => expect(net.calls(`POST ${base}/ops`)[0]?.body).toEqual({ ops: [{ op: "word.set", asset: ASSET.id, index: 0, text: "Gud" }] }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Captions" })).toBeNull());
    expect(screen.getByRole("alert")).toHaveTextContent("The edit changed meanwhile.");
  });

  it("keeps the Captions sheet open on a word that was fixed", async () => {
    const fixed = shown({ head: 2, shown: 2, undo: 1, turns: [...viewOf().turns, turn(2, { kind: "direct", say: 'Changed "Good" to "Gud".' })] });
    network({ [`GET ${base}`]: [ok(shown())], [`POST ${base}/ops`]: [ok(fixed)] });
    open();
    await screen.findByText("Captions are on.");
    fireEvent.click(button("Captions"));
    const sheet = await screen.findByRole("dialog", { name: "Captions" });
    fireEvent.click(within(sheet).getByRole("button", { name: "Good" }));
    const word = within(sheet).getByRole("textbox", { name: "Word 1" });
    fireEvent.change(word, { target: { value: "Gud" } });
    fireEvent.keyDown(word, { key: "Enter" });
    expect(await screen.findByText('Changed "Good" to "Gud".')).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Captions" })).toBeInTheDocument();
  });

  it("takes a tap on another word while a fix is still being sent, and sends that fix after the first", async () => {
    const first = later();
    const one = shown({ head: 2, shown: 2, undo: 1, turns: [...viewOf().turns, turn(2, { kind: "direct", say: 'Changed "Good" to "Gud".' })] });
    const both = shown({ head: 3, shown: 3, undo: 2, turns: [...one.turns, turn(3, { kind: "direct", say: 'Changed "morning" to "evening".' })] });
    const net = network({ [`GET ${base}`]: [ok(shown())], [`POST ${base}/ops`]: [first.answer, ok(both)] });
    open();
    await screen.findByText("Captions are on.");
    fireEvent.click(button("Captions"));
    const sheet = await screen.findByRole("dialog", { name: "Captions" });
    fireEvent.click(within(sheet).getByRole("button", { name: "Good" }));
    fireEvent.change(within(sheet).getByRole("textbox", { name: "Word 1" }), { target: { value: "Gud" } });
    // A tap on the next word, as a browser tells it: the word being typed is left, which sends it, and then the click comes.
    fireEvent.blur(within(sheet).getByRole("textbox", { name: "Word 1" }));
    await waitFor(() => expect(net.calls(`POST ${base}/ops`)).toHaveLength(1));
    fireEvent.click(within(sheet).getByRole("button", { name: "morning." }));
    const next = within(sheet).getByRole("textbox", { name: "Word 2" });
    fireEvent.change(next, { target: { value: "evening." } });
    fireEvent.keyDown(next, { key: "Enter" });
    // One call at a time: the second fix waits for the first one's answer.
    await act(async () => void (await new Promise((done) => setTimeout(done, 20))));
    expect(net.calls(`POST ${base}/ops`)).toHaveLength(1);
    await act(async () => first.give(ok(one)));
    await waitFor(() => expect(net.calls(`POST ${base}/ops`)).toHaveLength(2));
    expect(net.calls(`POST ${base}/ops`)[1]?.body).toEqual({ ops: [{ op: "word.set", asset: ASSET.id, index: 1, text: "evening." }] });
    expect(await screen.findByText('Changed "morning" to "evening".')).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Captions" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not send a fix that waited behind one that could not be made", async () => {
    const first = later();
    const net = network({ [`GET ${base}`]: [ok(shown())], [`POST ${base}/ops`]: [first.answer] }, { [`GET ${base}`]: ok(shown()) });
    open();
    await screen.findByText("Captions are on.");
    fireEvent.click(button("Captions"));
    const sheet = await screen.findByRole("dialog", { name: "Captions" });
    fireEvent.click(within(sheet).getByRole("button", { name: "Good" }));
    fireEvent.change(within(sheet).getByRole("textbox", { name: "Word 1" }), { target: { value: "Gud" } });
    fireEvent.blur(within(sheet).getByRole("textbox", { name: "Word 1" }));
    await waitFor(() => expect(net.calls(`POST ${base}/ops`)).toHaveLength(1));
    fireEvent.click(within(sheet).getByRole("button", { name: "morning." }));
    const next = within(sheet).getByRole("textbox", { name: "Word 2" });
    fireEvent.change(next, { target: { value: "evening." } });
    fireEvent.keyDown(next, { key: "Enter" });
    await act(async () => first.give(refused(409, "the edit changed meanwhile")));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Captions" })).toBeNull());
    // The first one's sentence stands, and nothing more was sent.
    expect(screen.getByRole("alert")).toHaveTextContent("The edit changed meanwhile.");
    await act(async () => void (await new Promise((done) => setTimeout(done, 20))));
    expect(net.calls(`POST ${base}/ops`)).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent("The edit changed meanwhile.");
  });

  it("offers a video's style once it is read, and cuts in it", async () => {
    const style = { captions: { look: "plain" } };
    const cut = later();
    const net = network({
      [`GET ${base}`]: [ok(shown())],
      "POST /api/edit/references": [{ status: 201, body: { id: "r1" } }],
      "GET /api/edit/references/r1": [{ status: 200, body: { status: "ready", style, judged: true } }],
      [`POST ${base}/cut`]: [cut.answer],
    });
    open();
    await screen.findByText("Captions are on.");
    fireEvent.click(button(/^Look/));
    fireEvent.click(await screen.findByRole("button", { name: /Like a video/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "A TikTok link" }), { target: { value: "https://www.tiktok.com/@someone/video/7300000000000000000" } });
    fireEvent.click(button("Read its style"));
    fireEvent.click(await screen.findByRole("button", { name: "Use that style" }));
    await waitFor(() => expect(net.calls(`POST ${base}/cut`)[0]?.body).toEqual({ style }));
    expect(await screen.findByText("Look: Like a video")).toBeInTheDocument();
    await act(async () => cut.give(ok(shown({ look: "video", head: 2, shown: 2, undo: 1, turns: [...viewOf().turns, turn(2, { kind: "cut", request: "video", say: "Captions are on." })] }))));
    await waitFor(() => noButton("Use that style"));
    expect(screen.getByText("Look: Like a video")).toBeInTheDocument();
  });

  it("reads a video's style in the background, with Stop; one that failed is said in the conversation with Try again", async () => {
    const reference = "POST /api/edit/references";
    const second = later();
    const net = network({ [`GET ${base}`]: [ok(shown())], [reference]: [refused(400, "that link is not a video"), second.answer] });
    open();
    await screen.findByText("Captions are on.");
    fireEvent.click(button(/^Look/));
    fireEvent.click(await screen.findByRole("button", { name: /Like a video/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "A TikTok link" }), { target: { value: "https://www.tiktok.com/@someone/video/7300000000000000000" } });
    fireEvent.click(button("Read its style"));
    const said = await screen.findByRole("alert");
    expect(said).toHaveTextContent("That link is not a video.");
    expect(screen.queryByRole("dialog", { name: "Look" })).toBeNull();
    fireEvent.click(within(said).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(net.calls(reference)).toHaveLength(2));
    expect(net.calls(reference)[1]?.body).toEqual({ url: "https://www.tiktok.com/@someone/video/7300000000000000000" });
    expect(screen.getByRole("status")).toHaveTextContent("Reading the video's style.");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(field()).toBeEnabled();
    fireEvent.click(button("Stop"));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("puts what was said of a style that could not be read away with the next thing asked", async () => {
    network({ [`GET ${base}`]: [ok(shown())], "POST /api/edit/references": [refused(400, "that link is not a video")], [`POST ${base}/change`]: [ok(two())] });
    open();
    await screen.findByText("Captions are on.");
    fireEvent.click(button(/^Look/));
    fireEvent.click(await screen.findByRole("button", { name: /Like a video/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "A TikTok link" }), { target: { value: "https://www.tiktok.com/@someone/video/7300000000000000000" } });
    fireEvent.click(button("Read its style"));
    await screen.findByRole("alert");
    fireEvent.click(button("Shorter"));
    expect(await screen.findByText("Cut it to 10 seconds.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("the editor page, the take as it was shot (E16)", () => {
  /** A cut of 2 s to 10 s of the take (240 frames): its frame 15 shows 2.5 s of the take, the take's own frame 75. */
  const LATE = changed(QUIET, [{ op: "shot.trim", id: "s1", startMs: 2000, endMs: 10_000 }]);
  const late = (more: Partial<EditView> = {}) => shown({ edit: LATE, turns: [{ ...viewOf().turns[0]!, findings: [FINDING] }], ...more });
  const original = () => screen.getByRole("button", { name: "Original", hidden: true });
  const stage = () => document.getElementById("edit-stage")!;
  const playerNode = () => document.querySelector(".__remotion-player");
  const rings = () => document.querySelectorAll("[data-part=mark]").length;
  /** The playhead on a frame, also under a sheet (which hides the page from assistive tech). */
  const at = (frame: number) => waitFor(() => expect(screen.getByRole("slider", { name: "Playhead", hidden: true })).toHaveAttribute("aria-valuenow", String(frame)));

  it("shows the take on the same Player at a tap, at the same moment and with nothing found ringed, and the cut again at the next", async () => {
    network({ [`GET ${base}`]: [ok(late())] });
    open();
    await screen.findByText("Captions are on.");
    await at(15);
    const mounted = playerNode();
    expect(mounted).not.toBeNull();
    expect(original()).toHaveAttribute("aria-pressed", "false");
    expect(playhead()).toHaveAttribute("aria-valuemax", "239");
    expect(rings()).toBe(1);

    fireEvent.click(original());
    expect(original()).toHaveAttribute("aria-pressed", "true");
    expect(within(stage()).getByText("Original")).toBeInTheDocument();
    expect(playhead()).toHaveAttribute("aria-valuemax", String(filmFrames(plainEdit(LATE)!) - 1));
    expect(playhead()).toHaveAttribute("aria-valuemax", "380");
    expect(rings()).toBe(0);
    await at(75);
    expect(playerNode()).toBe(mounted);

    fireEvent.click(original());
    expect(original()).toHaveAttribute("aria-pressed", "false");
    expect(within(stage()).queryByText("Original")).toBeNull();
    expect(playhead()).toHaveAttribute("aria-valuemax", "239");
    await at(15);
    expect(rings()).toBe(1);
    expect(playerNode()).toBe(mounted);
  });

  it("plays on through both taps while the video plays", async () => {
    network({ [`GET ${base}`]: [ok(late())] });
    open();
    await screen.findByText("Captions are on.");
    await at(15);
    fireEvent.click(button("Play"));
    await waitFor(() => expect(Number(playhead().getAttribute("aria-valuenow"))).toBeGreaterThan(3));
    fireEvent.click(original());
    // On the take: two seconds and more in, playing on from there.
    const been = framesBeen();
    await waitFor(() => expect(been().filter((frame) => frame > 66)).not.toHaveLength(0));
    expect(Math.min(...been())).toBeGreaterThanOrEqual(60);
    expect(button("Pause")).toBeInTheDocument();
    fireEvent.click(original());
    expect(playhead()).toHaveAttribute("aria-valuemax", "239");
    const back = framesBeen();
    await waitFor(() => expect(back().length).toBeGreaterThan(3));
    expect(Math.max(...back())).toBeLessThan(60);
    expect(button("Pause")).toBeInTheDocument();
  });

  it("comes back to the frame of the cut that shows where the take was moved to, or the cut's last when the cut left that out", async () => {
    network({ [`GET ${base}`]: [ok(late())] });
    open();
    await screen.findByText("Captions are on.");
    await at(15);
    fireEvent.click(original());
    await at(75);
    // Five seconds on in the take: 7.5 s, which the cut shows on its frame 165.
    fireEvent.keyDown(playhead(), { key: "PageUp" });
    await at(225);
    fireEvent.click(original());
    await at(165);
    fireEvent.click(original());
    await at(225);
    // The take's end, after the cut's: back on the cut's last frame.
    fireEvent.keyDown(playhead(), { key: "End" });
    await at(380);
    fireEvent.click(original());
    await at(239);
    expect(original()).toHaveAttribute("aria-pressed", "false");
  });

  it("is turned off before a request goes out, and rests while it is out", async () => {
    const answer = later();
    network({ [`GET ${base}`]: [ok(late())], [`POST ${base}/change`]: [answer.answer] });
    // What the page shows at the moment the request goes out.
    const routes = globalThis.fetch;
    const atCall: (string | null)[] = [];
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/change")) atCall.push(original().getAttribute("aria-pressed"), within(stage()).queryByText("Original")?.textContent ?? null);
      return routes(input, init);
    }));
    open();
    await screen.findByText("Captions are on.");
    await at(15);
    fireEvent.click(original());
    await at(75);
    fireEvent.change(field(), { target: { value: "Shorter" } });
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(atCall).toEqual(["false", null]);
    await screen.findByText("Working on it…");
    expect(original()).toBeDisabled();
    expect(playhead()).toHaveAttribute("aria-valuemax", "239");
    await at(15);
    await act(async () => answer.give(ok(two())));
    expect(await screen.findByText("Cut it to 10 seconds.")).toBeInTheDocument();
    expect(original()).toBeEnabled();
    expect(original()).toHaveAttribute("aria-pressed", "false");
  });

  it("can be used while the file is made, and rests while a call is out", async () => {
    const asked = later();
    const cancelled = later();
    network({ [`GET ${base}`]: [ok(shown())], [`POST ${base}/export`]: [asked.answer], [`DELETE ${base}/export`]: [cancelled.answer] });
    open();
    await screen.findByText("Captions are on.");
    expect(original()).toBeEnabled();
    fireEvent.click(button("Export"));
    await waitFor(() => expect(original()).toBeDisabled());
    await act(async () => asked.give({ status: 202, body: shown({ export: job("running") }) }));
    expect(await screen.findByRole("heading", { name: "Making your video" })).toBeInTheDocument();
    expect(button(/^Look/)).toBeDisabled();
    expect(original()).toBeEnabled();
    fireEvent.click(original());
    expect(original()).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button("Cancel"));
    expect(original()).toHaveAttribute("aria-pressed", "false");
    expect(original()).toBeDisabled();
    await act(async () => cancelled.give(ok(shown())));
    await waitFor(() => expect(original()).toBeEnabled());
  });

  it("is turned off when a sheet opens, the Ready sheet that opens by itself too", async () => {
    const finished = later();
    network({ [`GET ${base}`]: [ok(late({ export: job("running") })), finished.answer] }, { [`GET ${base}`]: ok(late({ export: made() })) });
    open();
    await screen.findByRole("heading", { name: "Making your video" });
    await at(15);
    fireEvent.click(original());
    await at(75);
    await act(async () => finished.give(ok(late({ export: made() }))));
    expect(await screen.findByRole("dialog", { name: "Ready" })).toBeInTheDocument();
    expect(original()).toHaveAttribute("aria-pressed", "false");
    expect(within(stage()).queryByText("Original")).toBeNull();
    await at(15);
    fireEvent.click(within(screen.getByRole("dialog", { name: "Ready" })).getByRole("button", { name: "Back to the edit" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(original());
    expect(original()).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button(/^Look/));
    expect(await screen.findByRole("dialog", { name: "Look" })).toBeInTheDocument();
    expect(original()).toHaveAttribute("aria-pressed", "false");
  });

  it("is turned off when another turn is shown, and the video goes where that turn puts it", async () => {
    const next = later();
    const shorter = two({ export: job("running") });
    network({ [`GET ${base}`]: [ok(shown({ export: job("running") })), next.answer] }, { [`GET ${base}`]: ok(shorter) });
    open();
    await screen.findByRole("heading", { name: "Making your video" });
    await at(15);
    fireEvent.click(original());
    expect(original()).toHaveAttribute("aria-pressed", "true");
    await act(async () => next.give(ok(shorter)));
    await waitFor(() => expect(original()).toHaveAttribute("aria-pressed", "false"));
    expect(within(stage()).queryByText("Original")).toBeNull();
    // Half a second before where the shorter cut changes (270), waiting there, as for any other turn read.
    expect(playhead()).toHaveAttribute("aria-valuemax", "299");
    await at(255);
    expect(button("Play")).toBeInTheDocument();
  });
});

describe("the editor page, the preview as it will be posted (E17)", () => {
  /** A cut of 2 s to 10 s of the take (240 frames), as in E16's tests. */
  const LATE = changed(QUIET, [{ op: "shot.trim", id: "s1", startMs: 2000, endMs: 10_000 }]);
  const late = () => shown({ edit: LATE });
  const stage = () => document.getElementById("edit-stage")!;
  const playerNode = () => document.querySelector(".__remotion-player");
  const dialog = () => screen.getByRole("dialog", { name: "Preview as posted" });
  const noDialog = () => expect(screen.queryByRole("dialog", { name: "Preview as posted" })).toBeNull();
  /** Page controls, also while the page is inert under the preview. */
  const pageButton = (name: string) => screen.getByRole("button", { name, hidden: true });
  const preview = () => pageButton("Preview as posted");
  const header = () => document.querySelector("[data-part=editor-header]")!;
  const panel = () => screen.getByRole("region", { name: "Your edit", hidden: true });
  /** The page's own scrubber, under the stage's place in the page. */
  const pageScrubber = () => within(screen.getByRole("region", { name: "Your video", hidden: true })).getByRole("slider", { name: "Playhead", hidden: true });
  const windowIs = (width: number, height: number) =>
    act(() => (window as unknown as { happyDOM: { setWindowSize(size: { width: number; height: number }): void } }).happyDOM.setWindowSize({ width, height }));
  const at = (frame: number, slider: () => HTMLElement = () => playhead()) => waitFor(() => expect(slider()).toHaveAttribute("aria-valuenow", String(frame)));

  afterEach(async () => {
    window.localStorage.removeItem(POSTED_KEY);
    await windowIs(1024, 768);
  });

  it("puts the video full screen at a tap, on the same Player, the app last chosen checked and the page under it inert (8)", async () => {
    network({ [`GET ${base}`]: [ok(shown())] });
    open();
    await screen.findByText("Captions are on.");
    const mounted = playerNode();
    expect(mounted).not.toBeNull();
    expect(stage().getAttribute("style")).toBeNull();
    fireEvent.click(preview());
    expect(dialog()).toBeInTheDocument();
    expect(within(dialog()).getByRole("radio", { name: "TikTok" })).toHaveAttribute("aria-checked", "true");
    expect(stage().style.position).toBe("fixed");
    expect(playerNode()).toBe(mounted);
    expect(header()).toHaveAttribute("inert");
    expect(panel()).toHaveAttribute("inert");
    expect(pageScrubber().closest("[inert]")).not.toBeNull();
    expect(stage().closest("[inert]")).toBeNull();
    expect(document.activeElement).toBe(within(dialog()).getByRole("button", { name: "Close preview" }));
    // The video drawn on as posted: the edit's title stands for the caption.
    expect(within(dialog()).getByText("Good morning")).toBeInTheDocument();
  });

  it("keeps the app chosen, cuts Reels' sides, and gives the page back as it was on Escape (9)", async () => {
    network({ [`GET ${base}`]: [ok(shown())] });
    open();
    await screen.findByText("Captions are on.");
    const mounted = playerNode();
    fireEvent.click(preview());
    fireEvent.click(within(dialog()).getByRole("radio", { name: "Reels" }));
    expect(within(dialog()).getByRole("radio", { name: "Reels" })).toHaveAttribute("aria-checked", "true");
    expect(window.localStorage.getItem(POSTED_KEY)).toBe("reels");
    const [top, right, bottom, left] = /^inset\((.+)px (.+)px (.+)px (.+)px\)$/.exec(stage().style.clipPath)!.slice(1).map(Number);
    expect([top, bottom]).toEqual([0, 0]);
    expect(right).toBeGreaterThan(0);
    expect(left).toBeCloseTo(right!, 2);

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    noDialog();
    expect(stage().style.position).toBe("");
    expect(stage().style.clipPath).toBe("");
    expect(header()).not.toHaveAttribute("inert");
    expect(panel()).not.toHaveAttribute("inert");
    expect(playerNode()).toBe(mounted);
    expect(document.activeElement).toBe(preview());

    fireEvent.click(preview());
    expect(within(dialog()).getByRole("radio", { name: "Reels" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Close preview" }));
    noDialog();
    expect(document.activeElement).toBe(preview());
  });

  it("follows the window's size: the phone drawn to scale, whole in it, the stage where the phone has its video (S10)", async () => {
    network({ [`GET ${base}`]: [ok(shown())] });
    open();
    await screen.findByText("Captions are on.");
    const mounted = playerNode();
    fireEvent.click(preview());
    const box = () => [stage().style.left, stage().style.top, stage().style.width, stage().style.height].map((side) => Number.parseFloat(side));
    // 1024 × 768: the phone as tall as the window, centred; its video 50 of its points under its top.
    let pt = 768 / 852;
    expect(box()).toEqual([(1024 - 393 * pt) / 2, 50 * pt, 393 * pt, ((393 * 16) / 9) * pt].map((side) => expect.closeTo(side, 3)));
    // A phone browser with its toolbars: the whole phone smaller, the video above the app's bar, not under it.
    await windowIs(375, 600);
    pt = 600 / 852;
    expect(box()).toEqual([(375 - 393 * pt) / 2, 50 * pt, 393 * pt, ((393 * 16) / 9) * pt].map((side) => expect.closeTo(side, 3)));
    const bar = document.querySelector<HTMLElement>("[data-part=phone]")!;
    expect(bar.style.transform).toBe(`scale(${pt})`);
    // A tall phone: the phone is the window.
    await windowIs(393, 852);
    expect(box().map((side) => Math.round(side * 100) / 100)).toEqual([0, 50, 393, 698.67]);
    expect(playerNode()).toBe(mounted);
  });

  it("gives the stage's sound a button of its own, the same sound as the stage's (S10)", async () => {
    network({ [`GET ${base}`]: [ok(shown())] });
    open();
    await screen.findByText("Captions are on.");
    fireEvent.click(preview());
    fireEvent.click(within(dialog()).getByRole("button", { name: "Mute" }));
    expect(await within(dialog()).findByRole("button", { name: "Unmute" })).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: "Escape" });
    // Back in the page, the stage's own button says the same.
    expect(pageButton("Unmute")).toBeInTheDocument();
    fireEvent.click(pageButton("Unmute"));
    fireEvent.click(preview());
    expect(await within(dialog()).findByRole("button", { name: "Mute" })).toBeInTheDocument();
  });

  it("stays open through a read that fails, and closes when another turn is shown, the focus back on its button (S10)", async () => {
    const failed = later();
    const next = later();
    network({ [`GET ${base}`]: [ok(shown({ export: job("running") })), failed.answer, next.answer] }, { [`GET ${base}`]: ok(two({ export: job("running") })) });
    open();
    await screen.findByRole("heading", { name: "Making your video" });
    fireEvent.click(preview());
    expect(dialog()).toBeInTheDocument();
    await act(async () => failed.give(refused(503, "busy")));
    expect(dialog()).toBeInTheDocument();
    expect(stage().style.position).toBe("fixed");
    await act(async () => next.give(ok(two({ export: job("running") }))));
    await waitFor(noDialog);
    expect(stage().style.position).toBe("");
    expect(document.activeElement).toBe(preview());
  });

  it("moves the playhead from its own scrubber, and the video still plays and pauses at a press (10)", async () => {
    network({ [`GET ${base}`]: [ok(late())] });
    open();
    await screen.findByText("Captions are on.");
    await at(15);
    fireEvent.click(preview());
    const scrubber = () => within(dialog()).getByRole("slider", { name: "Playhead" });
    expect(scrubber()).toHaveAttribute("aria-valuemax", "239");
    expect(scrubber().closest("[data-part=scrubber]")?.querySelector("[data-part=fill]")).toHaveClass("bg-action-foreground");
    fireEvent.keyDown(scrubber(), { key: "PageUp" });
    // Sought on the Player: the frame it tells is the one both scrubbers show.
    await at(165, scrubber);
    await at(165, pageScrubber);
    fireEvent.click(pageButton("Play"));
    expect(pageButton("Pause")).toBeInTheDocument();
    await waitFor(() => expect(Number(scrubber().getAttribute("aria-valuenow"))).toBeGreaterThan(165));
    fireEvent.click(pageButton("Pause"));
    expect(pageButton("Play")).toBeInTheDocument();
    // The stage's own mute button is hidden under the app's buttons; the sound's button is with the creator's controls.
    expect(within(stage()).queryByRole("button", { name: /^(Mute|Unmute)$/ })).toBeNull();
    expect(within(dialog()).getByRole("button", { name: "Mute" })).toBeInTheDocument();
  });

  it("turns Original off before it opens: the video as it will be posted is the cut (11)", async () => {
    network({ [`GET ${base}`]: [ok(late())] });
    open();
    await screen.findByText("Captions are on.");
    await at(15);
    fireEvent.click(pageButton("Original"));
    await at(75);
    fireEvent.click(preview());
    expect(dialog()).toBeInTheDocument();
    expect(pageButton("Original")).toHaveAttribute("aria-pressed", "false");
    expect(within(stage()).queryByText("Original")).toBeNull();
    const scrubber = () => within(dialog()).getByRole("slider", { name: "Playhead" });
    expect(scrubber()).toHaveAttribute("aria-valuemax", "239");
    await at(15, scrubber);
  });

  it("rests while a call is out, as Original does", async () => {
    const answer = later();
    network({ [`GET ${base}`]: [ok(shown())], [`POST ${base}/change`]: [answer.answer] });
    open();
    await screen.findByText("Captions are on.");
    fireEvent.change(field(), { target: { value: "Shorter" } });
    fireEvent.keyDown(field(), { key: "Enter" });
    await screen.findByText("Working on it…");
    expect(preview()).toBeDisabled();
    await act(async () => answer.give(ok(two())));
    await screen.findByText("Cut it to 10 seconds.");
    expect(preview()).toBeEnabled();
  });

  it("holds four controls on one line at every width: Original's word from 390 wide, the preview an icon alone at the row's end (S8)", async () => {
    network({ [`GET ${base}`]: [ok(shown())] });
    open();
    await screen.findByText("Captions are on.");
    const row = document.querySelector<HTMLElement>("[data-part=tools]")!;
    const controls = [...row.children] as HTMLElement[];
    expect(controls.map((control) => control.getAttribute("aria-label") ?? control.textContent)).toEqual(["Look", "Captions", "Original", "Preview as posted"]);
    // One line: a row that does not wrap and does not scroll, of parts that do not shrink.
    expect(row).toHaveClass("flex");
    expect(row.className).not.toMatch(/\bflex-wrap\b|\boverflow-(x-)?(auto|scroll)\b/);
    for (const control of controls) expect(control).toHaveClass("shrink-0");
    // Original: its icon alone, a 36 circle, below 390 wide, its word from there; its name kept for a screen reader, 44 to tap.
    const original = controls[2]!;
    expect(original).toHaveAccessibleName("Original");
    expect(original).toHaveClass("tap-44", "w-9", "px-0", "min-[390px]:w-auto", "min-[390px]:px-3.5");
    expect(within(original).getByText("Original")).toHaveClass("sr-only", "min-[390px]:not-sr-only");
    // The preview: an icon alone at every width, at the row's right end.
    const last = controls[3]!;
    expect(last).toHaveClass("ml-auto", "size-9", "tap-44");
    expect(last.textContent).toBe("");
    expect(last.querySelector("svg")).not.toBeNull();
  });
});

describe("the editor page, the moment a request is about (E15)", () => {
  /** The first cut, with one thing found at 0:06 (frame 186): its card pauses the video there, as the creator would. */
  const found = () => shown({ turns: [{ ...viewOf().turns[0]!, findings: [{ ...FINDING, where: { frame: 186 } }] }] });
  /** The answer to "Zoom in here" at 0:06. */
  const zoomed = (at: number | null = 186) =>
    shown({ edit: SHORT, head: 2, shown: 2, undo: 1, turns: [...found().turns, turn(2, { request: "Zoom in here", at, say: "Zoomed in from 0:06 to 0:08." })] });
  const tag = (label: string) => screen.queryByRole("button", { name: `Remove the moment at ${label}`, hidden: true });
  const noTag = () => expect(screen.queryByRole("button", { name: /^Remove the moment/, hidden: true })).toBeNull();
  const at = (frame: number) => waitFor(() => expect(playhead()).toHaveAttribute("aria-valuenow", String(frame)));
  /** Paused on 0:06 by the card of what was found there; the card closed again, so the chips are back. */
  const pauseOn186 = async () => {
    fireEvent.click(await screen.findByRole("button", { name: "1 to check" }));
    await at(186);
    fireEvent.click(within(screen.getByRole("group", { name: "Things to check" })).getByRole("button", { name: "Close" }));
  };
  const send = (request: string) => {
    fireEvent.change(field(), { target: { value: request } });
    fireEvent.keyDown(field(), { key: "Enter" });
  };
  const latestTurn = () => within(screen.getByRole("region", { name: "Your edit's changes" })).getAllByRole("listitem").at(-1)!;

  it("sends the frame the video is paused on with the request, says it on the request out and on its turn (3, 4)", async () => {
    const answer = later();
    const net = network({ [`GET ${base}`]: [ok(found())], [`POST ${base}/change`]: [answer.answer] });
    open();
    await screen.findByText("Captions are on.");
    await pauseOn186();
    expect(tag("0:06")).toHaveTextContent(/^0:06$/);
    expect(field()).toHaveAccessibleDescription("This request is about the moment at 0:06.");
    send("Zoom in here");
    await waitFor(() => expect(net.calls(`POST ${base}/change`)).toHaveLength(1));
    expect(net.calls(`POST ${base}/change`)[0]!.body).toEqual({ request: "Zoom in here", at: 186 });
    expect(latestTurn().textContent).toBe("0:06 · Zoom in hereWorking on it…");
    await act(async () => answer.give(ok(zoomed())));
    expect(await screen.findByText("Zoomed in from 0:06 to 0:08.")).toBeInTheDocument();
    expect(latestTurn().textContent).toBe("0:06 · Zoom in hereZoomed in from 0:06 to 0:08.Undo");
  });

  it("sends no moment while the video plays, and shows none (3)", async () => {
    const net = network({ [`GET ${base}`]: [ok(found())], [`POST ${base}/change`]: [ok(zoomed(null))] });
    open();
    await screen.findByText("Captions are on.");
    await pauseOn186();
    expect(tag("0:06")).not.toBeNull();
    fireEvent.click(button("Play"));
    await waitFor(() => expect(Number(playhead().getAttribute("aria-valuenow"))).toBeGreaterThan(190));
    noTag();
    send("Zoom in here");
    await waitFor(() => expect(net.calls(`POST ${base}/change`)).toHaveLength(1));
    expect(net.calls(`POST ${base}/change`)[0]!.body).toEqual({ request: "Zoom in here" });
    expect(net.calls(`POST ${base}/change`)[0]!.body).not.toHaveProperty("at");
    expect(await screen.findByText("Zoomed in from 0:06 to 0:08.")).toBeInTheDocument();
    expect(latestTurn().textContent).toBe("Zoom in hereZoomed in from 0:06 to 0:08.Undo");
  });

  it("sends no moment once its tag is taken away, and shows it again when the video is paused on another frame (3)", async () => {
    const net = network({ [`GET ${base}`]: [ok(found())], [`POST ${base}/change`]: [ok(zoomed(null))] });
    open();
    await screen.findByText("Captions are on.");
    await pauseOn186();
    fireEvent.click(tag("0:06")!);
    noTag();
    expect(field()).toHaveFocus();
    expect(field()).not.toHaveAttribute("aria-describedby");
    // Another frame: the moment is offered again.
    fireEvent.keyDown(playhead(), { key: "ArrowRight" });
    await at(216);
    expect(tag("0:07")).not.toBeNull();
    // Back on the frame it was taken from: still gone.
    fireEvent.keyDown(playhead(), { key: "ArrowLeft" });
    await at(186);
    noTag();
    send("Zoom in here");
    await waitFor(() => expect(net.calls(`POST ${base}/change`)).toHaveLength(1));
    expect(net.calls(`POST ${base}/change`)[0]!.body).toEqual({ request: "Zoom in here" });
    expect(net.calls(`POST ${base}/change`)[0]!.body).not.toHaveProperty("at");
  });

  it("puts a change that failed back in the field, and its Try again sends the same moment again (5)", async () => {
    const net = network({ [`GET ${base}`]: [ok(found())], [`POST ${base}/change`]: [refused(502, "the editor could not make that change"), ok(zoomed())] }, { [`GET ${base}`]: ok(found()) });
    open();
    await screen.findByText("Captions are on.");
    await pauseOn186();
    send("Zoom in here");
    const said = await screen.findByRole("alert");
    expect(said).toHaveTextContent("The editor could not make that change.");
    expect(field()).toHaveValue("Zoom in here");
    expect(tag("0:06")).not.toBeNull();
    fireEvent.click(within(said).getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Zoomed in from 0:06 to 0:08.")).toBeInTheDocument();
    expect(net.calls(`POST ${base}/change`).map((one) => one.body)).toEqual([{ request: "Zoom in here", at: 186 }, { request: "Zoom in here", at: 186 }]);
  });

  it("sends no moment with a chip's request (6)", async () => {
    const net = network({ [`GET ${base}`]: [ok(found())], [`POST ${base}/change`]: [ok(two())] });
    open();
    await screen.findByText("Captions are on.");
    await pauseOn186();
    expect(tag("0:06")).not.toBeNull();
    fireEvent.click(button("Shorter"));
    expect(await screen.findByText("Cut it to 10 seconds.")).toBeInTheDocument();
    expect(net.calls(`POST ${base}/change`)[0]!.body).toEqual({ request: "Shorter" });
    expect(net.calls(`POST ${base}/change`)[0]!.body).not.toHaveProperty("at");
  });

  it("offers no moment where a first cut stands by itself, and the frame it is paused on once it is played or moved (7)", async () => {
    network({ [`GET ${base}`]: [ok(shown())] });
    open();
    await screen.findByText("Captions are on.");
    await at(15);
    noTag();
    // Moved a second on, by the scrubber's key: 45, a second and a half in.
    fireEvent.keyDown(playhead(), { key: "ArrowRight" });
    await at(45);
    expect(tag("0:01")).not.toBeNull();
    // Played, none; paused with a tap, the frame it stopped on.
    fireEvent.click(button("Play"));
    await waitFor(() => expect(Number(playhead().getAttribute("aria-valuenow"))).toBeGreaterThan(50));
    noTag();
    fireEvent.click(button("Pause"));
    await waitFor(() => expect(button("Play")).toBeInTheDocument());
    const paused = Number(playhead().getAttribute("aria-valuenow"));
    await waitFor(() => expect(tag(`0:${String(Math.floor(paused / 30)).padStart(2, "0")}`)).not.toBeNull());
  });

  /** Plays the video while a call is out (the stage is usable then) and pauses it past `frame`: the playhead moves on, in real time. */
  const playPast = async (frame: number) => {
    fireEvent.click(button("Play"));
    await waitFor(() => expect(Number(playhead().getAttribute("aria-valuenow"))).toBeGreaterThan(frame), { timeout: 5000 });
    fireEvent.click(button("Pause"));
    await waitFor(() => expect(button("Play")).toBeInTheDocument());
    return Number(playhead().getAttribute("aria-valuenow"));
  };
  const refusedChange = refused(502, "the editor could not make that change");

  it("puts a request that failed back with its own moment, held whatever the playhead does, and Send sends that moment (fix 1)", async () => {
    const answer = later();
    const net = network({ [`GET ${base}`]: [ok(found())], [`POST ${base}/change`]: [answer.answer, ok(zoomed())] }, { [`GET ${base}`]: ok(found()) });
    open();
    await screen.findByText("Captions are on.");
    await pauseOn186();
    send("Zoom in here");
    await screen.findByText("Working on it…");
    // While it is out, the video is played on and paused elsewhere.
    const elsewhere = await playPast(210);
    expect(Math.floor(elsewhere / 30)).not.toBe(6);
    await act(async () => answer.give(refusedChange));
    await screen.findByRole("alert");
    expect(field()).toHaveValue("Zoom in here");
    expect(tag("0:06")).not.toBeNull();
    expect(field()).toHaveAccessibleDescription("This request is about the moment at 0:06.");
    // Played and moved again: the moment stays the request's own.
    fireEvent.click(button("Play"));
    await waitFor(() => expect(button("Pause")).toBeInTheDocument());
    expect(tag("0:06")).not.toBeNull();
    fireEvent.click(button("Pause"));
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(await screen.findByText("Zoomed in from 0:06 to 0:08.")).toBeInTheDocument();
    expect(net.calls(`POST ${base}/change`).map((one) => one.body)).toEqual([{ request: "Zoom in here", at: 186 }, { request: "Zoom in here", at: 186 }]);
  });

  it("puts a request about no moment back with none, and it takes up no moment until the field is emptied or sent (fix 1)", async () => {
    const answer = later();
    const net = network({ [`GET ${base}`]: [ok(found())], [`POST ${base}/change`]: [answer.answer, ok(zoomed(null))] }, { [`GET ${base}`]: ok(found()) });
    open();
    await screen.findByText("Captions are on.");
    await at(15);
    // Sent with the first cut standing by itself: about no moment.
    send("Zoom in here");
    await screen.findByText("Working on it…");
    expect(net.calls(`POST ${base}/change`)[0]!.body).toEqual({ request: "Zoom in here" });
    expect(await playPast(20)).toBeGreaterThan(15);
    await act(async () => answer.give(refusedChange));
    await screen.findByRole("alert");
    expect(field()).toHaveValue("Zoom in here");
    noTag();
    // Paused on another frame by the scrubber: still none.
    fireEvent.keyDown(playhead(), { key: "Home" });
    fireEvent.keyDown(playhead(), { key: "PageUp" });
    await at(150);
    noTag();
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(await screen.findByText("Zoomed in from 0:06 to 0:08.")).toBeInTheDocument();
    expect(net.calls(`POST ${base}/change`)[1]!.body).toEqual({ request: "Zoom in here" });
    expect(net.calls(`POST ${base}/change`)[1]!.body).not.toHaveProperty("at");
  });

  it("lets a request's own moment go at its x, and when the field is emptied; the field then follows the playhead again (fix 1)", async () => {
    const net = network({ [`GET ${base}`]: [ok(found())], [`POST ${base}/change`]: [refusedChange, refusedChange, ok(zoomed())] }, { [`GET ${base}`]: ok(found()) });
    open();
    await screen.findByText("Captions are on.");
    await pauseOn186();
    send("Zoom in here");
    await screen.findByRole("alert");
    fireEvent.keyDown(playhead(), { key: "ArrowRight" });
    await at(216);
    expect(tag("0:06")).not.toBeNull();
    // Its x: gone, and not replaced by the moment the video stands on.
    fireEvent.click(tag("0:06")!);
    noTag();
    expect(field()).toHaveValue("Zoom in here");
    // Paused on another frame: that one is offered, as before any request.
    fireEvent.keyDown(playhead(), { key: "ArrowRight" });
    await at(246);
    expect(tag("0:08")).not.toBeNull();
    fireEvent.keyDown(field(), { key: "Enter" });
    await waitFor(() => expect(net.calls(`POST ${base}/change`)).toHaveLength(2));
    expect(net.calls(`POST ${base}/change`)[1]!.body).toEqual({ request: "Zoom in here", at: 246 });
    // Back with 0:08 held; the video moved on; the field emptied lets it go, and the moment shown is the playhead's.
    await waitFor(() => expect(field()).toHaveValue("Zoom in here"));
    fireEvent.keyDown(playhead(), { key: "PageDown" });
    await at(96);
    expect(tag("0:08")).not.toBeNull();
    fireEvent.change(field(), { target: { value: "" } });
    expect(tag("0:03")).not.toBeNull();
    send("Zoom in here");
    expect(await screen.findByText("Zoomed in from 0:06 to 0:08.")).toBeInTheDocument();
    expect(net.calls(`POST ${base}/change`)[2]!.body).toEqual({ request: "Zoom in here", at: 96 });
  });

  it("offers, while the take as it was shot is on the stage, the moment of the film that shows it, and none where the film leaves it out", async () => {
    /** A cut of 2 s to 10 s of the take (240 frames): the take's frame 150 (5 s) is the cut's frame 90. */
    const LATE = changed(QUIET, [{ op: "shot.trim", id: "s1", startMs: 2000, endMs: 10_000 }]);
    const answer = later();
    const net = network({ [`GET ${base}`]: [ok(shown({ edit: LATE }))], [`POST ${base}/change`]: [answer.answer] });
    open();
    await screen.findByText("Captions are on.");
    await at(15);
    const original = () => screen.getByRole("button", { name: "Original" });
    fireEvent.click(original());
    await at(75);
    // Not moved: the frame of the film it was turned on at, where the first cut stands by itself.
    noTag();
    // 7.5 s of the take: the cut's 5.5 s.
    fireEvent.keyDown(playhead(), { key: "PageUp" });
    await at(225);
    expect(tag("0:05")).not.toBeNull();
    // After the cut's end, and before its start: the film does not show these, so they are no moment of it.
    fireEvent.keyDown(playhead(), { key: "End" });
    await at(380);
    noTag();
    fireEvent.keyDown(playhead(), { key: "Home" });
    await at(0);
    noTag();
    fireEvent.keyDown(playhead(), { key: "PageUp" });
    await at(150);
    expect(tag("0:03")).not.toBeNull();
    // Sent: Original is off first, the film on that very frame, and the request about it.
    send("Zoom in here");
    await waitFor(() => expect(net.calls(`POST ${base}/change`)).toHaveLength(1));
    expect(net.calls(`POST ${base}/change`)[0]!.body).toEqual({ request: "Zoom in here", at: 90 });
    expect(original()).toHaveAttribute("aria-pressed", "false");
    expect(playhead()).toHaveAttribute("aria-valuemax", "239");
    await at(90);
    expect(latestTurn().textContent).toBe("0:03 · Zoom in hereWorking on it…");
  });

  it("offers no moment while the video is seen as it will be posted, and offers it again when that closes", async () => {
    network({ [`GET ${base}`]: [ok(found())] });
    open();
    await screen.findByText("Captions are on.");
    await pauseOn186();
    expect(tag("0:06")).not.toBeNull();
    fireEvent.click(button("Preview as posted"));
    expect(screen.getByRole("dialog", { name: "Preview as posted" })).toBeInTheDocument();
    noTag();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Preview as posted" })).toBeNull());
    expect(tag("0:06")).not.toBeNull();
  });
});

describe("the editor page, the chips after a change and what is left to check (slice B, Task 8)", () => {
  const ZOOMS: EditView["next"] = [
    { kind: "zoom", label: "Zoom less", request: "Zoom in less here.", at: 120 },
    { kind: "zoom", label: "Hold it longer", request: "Hold this zoom longer here.", at: 120 },
  ];
  const chipsRow = () => document.querySelector<HTMLElement>("[data-part=chips]");
  const chipNames = () => within(chipsRow()!).getAllByRole("button").map((chip) => chip.textContent);

  it("puts it back with Undo: the head moves to the view's Undo, and nothing is asked of the agent (8)", async () => {
    const net = network({ [`GET ${base}`]: [ok(two({ next: [{ kind: "cut", label: "Put it back", request: null, at: null }] }))], [`POST ${base}/head`]: [ok(shown({ redo: 2 }))] });
    open();
    await screen.findByText("Cut it to 10 seconds.");
    expect(chipNames()).toEqual(["1 to check", "Put it back", "Captions on", "Add zooms"]);
    fireEvent.click(button("Put it back"));
    await waitFor(() => expect(net.calls(`POST ${base}/head`).map((one) => one.body)).toEqual([{ n: 1 }]));
    await waitFor(() => expect(button("Redo")).toBeEnabled());
    expect(net.calls(`POST ${base}/change`)).toEqual([]);
  });

  it("asks a step about the moment it is about, and shows that moment on the request (8)", async () => {
    const net = network({ [`GET ${base}`]: [ok(two({ next: ZOOMS }))], [`POST ${base}/change`]: [ok(two({ head: 3, shown: 3, turns: [...two().turns, turn(3, { request: "Zoom in less here.", at: 120, say: "Zoomed in less." })] }))] });
    open();
    await screen.findByText("Cut it to 10 seconds.");
    expect(chipNames()).toEqual(["1 to check", "Zoom less", "Hold it longer", "Shorter"]);
    fireEvent.click(button("Zoom less"));
    expect(await screen.findByText("Zoomed in less.")).toBeInTheDocument();
    expect(net.calls(`POST ${base}/change`).map((one) => one.body)).toEqual([{ request: "Zoom in less here.", at: 120 }]);
    expect(within(screen.getByRole("region", { name: "Your edit's changes" })).getAllByRole("listitem").at(-1)!.textContent).toBe("0:04 · Zoom in less here.Zoomed in less.Undo");
  });

  it("turns captions that are off on by hand from its chip, asking the agent nothing (9)", async () => {
    // Its answer is left out: captions on would be measured, and happy-dom loads no font (the chip it then shows is
    // edit-session's to test).
    const answer = later();
    const net = network({ [`GET ${base}`]: [ok(shown())], [`POST ${base}/ops`]: [answer.answer] });
    open();
    await screen.findByText("Captions are on.");
    expect(chipNames()).toEqual(["Shorter", "Captions on", "Add zooms"]);
    fireEvent.click(button("Captions on"));
    await waitFor(() => expect(net.calls(`POST ${base}/ops`).map((one) => one.body)).toEqual([{ ops: [{ op: "captions.set", on: true }] }]));
    // A call like any other: the chips rest while it is out.
    expect(button("Captions on")).toBeDisabled();
    expect(net.calls(`POST ${base}/change`)).toEqual([]);
  });

  it("counts and rings only what is left to check: one put away is neither a chip's count nor a ring", async () => {
    const other: Finding = { code: "soft-zoom", severity: "warn", where: { frame: 60, shot: "s1" }, says: "shot s1 is zoomed past its take's sharp limit" };
    network({ [`GET ${base}`]: [ok(two({ turns: [...viewOf().turns, turn(2, { request: "Shorter", say: "Cut it to 10 seconds.", findings: [other, FINDING], kept: ["soft-zoom s1"] })] }))] });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "1 to check" }));
    expect(document.querySelectorAll("[data-part=mark]")).toHaveLength(1);
    const card = screen.getByRole("group", { name: "Things to check" });
    expect(card).toHaveTextContent(/^0:06 · The captions cover your face here\./);
    expect(within(card).getByText("1 of 1")).toBeInTheDocument();
  });

  it("says the read of a video's style, with Stop, in the chips' place, and gives the chips back once it is stopped (10)", async () => {
    const reading = later();
    network({ [`GET ${base}`]: [ok(shown())], "POST /api/edit/references": [reading.answer] });
    open();
    await screen.findByText("Captions are on.");
    fireEvent.click(button(/^Look/));
    fireEvent.click(await screen.findByRole("button", { name: /Like a video/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "A TikTok link" }), { target: { value: "https://www.tiktok.com/@someone/video/7300000000000000000" } });
    fireEvent.click(button("Read its style"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Look" })).toBeNull());
    const thread = screen.getByRole("region", { name: "Your edit's changes" });
    expect(within(thread).getByRole("status")).toHaveTextContent("Reading the video's style.");
    expect(within(thread).getByRole("button", { name: "Stop" })).toBeInTheDocument();
    expect(chipsRow()).toBeNull();
    noButton("Shorter");
    fireEvent.click(button("Stop"));
    expect(screen.queryByRole("status")).toBeNull();
    expect(chipNames()).toEqual(["Shorter", "Captions on", "Add zooms"]);
  });
});

describe("the editor page, a thing to check at its moment (E18; slice B, Task 9)", () => {
  /** Three things found in the first cut, in the order of their frames: the captions under the app's buttons and the captions on the face, each with a fix that cleared it in Task 10; a part that fades in and out at once, with none. */
  const BARS: Finding = { code: "under-buttons", severity: "error", where: { frame: 60, shot: "s1" }, says: "the captions at 2.0 s sit under TikTok's bottom caption and sound bar; move them up" };
  const FACE: Finding = { code: "on-face", severity: "error", where: { frame: 180, shot: "s1" }, says: "the captions at 6.0 s cover the mouth; move them up or down" };
  const FADES: Finding = { code: "fade-both", severity: "warn", where: { frame: 240, shot: "s1" }, says: "shot \"s1\" at 8.0 s is 9 frames long, shorter than its transitions in (6) and out (6) together" };
  const three = (kept: string[] = []) => shown({ turns: [{ ...viewOf().turns[0]!, findings: [BARS, FACE, FADES], kept }] });
  const card = () => screen.getByRole("group", { name: "Things to check" });
  const noCard = () => expect(screen.queryByRole("group", { name: "Things to check" })).toBeNull();
  const inCard = (name: string | RegExp) => within(card()).getByRole("button", { name });
  const chipsRow = () => document.querySelector<HTMLElement>("[data-part=chips]");
  const at = (frame: number) => waitFor(() => expect(playhead()).toHaveAttribute("aria-valuenow", String(frame)));
  const latestTurn = () => within(screen.getByRole("region", { name: "Your edit's changes" })).getAllByRole("listitem").at(-1)!;

  it("opens the first thing to check as a card in the chips' place, the video paused at its moment (4)", async () => {
    network({ [`GET ${base}`]: [ok(three())] });
    open();
    await screen.findByText("Captions are on.");
    await at(15);
    fireEvent.click(button("Play"));
    fireEvent.click(await screen.findByRole("button", { name: "3 to check" }));
    expect(card()).toHaveTextContent(/^0:02 · The captions sit under the app's buttons here\./);
    expect(within(card()).getAllByRole("button").map((each) => each.getAttribute("aria-label") ?? each.textContent)).toEqual(["Close", "Move them clear of the app's buttons", "Keep it", "Next, 2 of 3"]);
    await at(60);
    expect(button("Play")).toBeInTheDocument();
    expect(chipsRow()).toBeNull();
    noButton("Shorter");
    // The chip it was opened from is gone: the card has the focus.
    expect(document.activeElement).toBe(card());
  });

  it("sends the fix about the finding's moment, and the card closes as it goes out (5)", async () => {
    const answer = later();
    const net = network({ [`GET ${base}`]: [ok(three())], [`POST ${base}/change`]: [answer.answer] });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "3 to check" }));
    await at(60);
    fireEvent.click(inCard("Move them clear of the app's buttons"));
    await waitFor(() => expect(net.calls(`POST ${base}/change`)).toHaveLength(1));
    expect(net.calls(`POST ${base}/change`)[0]!.body).toEqual({ request: "Move the captions clear of the app's buttons.", at: 60 });
    noCard();
    expect(latestTurn().textContent).toBe("0:02 · Move the captions clear of the app's buttons.Working on it…");
    await act(async () => answer.give(ok(two({ turns: [...three().turns, turn(2, { request: "Move the captions clear of the app's buttons.", at: 60, say: "The captions are higher now." })] }))));
    expect(await screen.findByText("The captions are higher now.")).toBeInTheDocument();
    noCard();
  });

  it("puts a finding away with Keep it: the next one takes its place at its moment, and the last one closes the card (6)", async () => {
    const net = network({
      [`GET ${base}`]: [ok(three())],
      [`POST ${base}/kept`]: [ok(three(["under-buttons s1"])), ok(three(["under-buttons s1", "on-face error s1"])), ok(three(["under-buttons s1", "on-face error s1", "fade-both s1"]))],
    });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "3 to check" }));
    await at(60);
    fireEvent.click(inCard("Keep it"));
    await waitFor(() => expect(card()).toHaveTextContent(/^0:06 · The captions cover your face here\./));
    expect(inCard("Next, 2 of 2").textContent).toBe("1 of 2");
    await at(180);
    fireEvent.click(inCard("Keep it"));
    await waitFor(() => expect(card()).toHaveTextContent(/^0:08 · This part fades in and out at once\./));
    expect(within(card()).getByText("1 of 1").tagName).toBe("SPAN");
    expect(inCard("Show")).toBeInTheDocument();
    await at(240);
    fireEvent.click(inCard("Keep it"));
    await waitFor(noCard);
    noButton(/to check/);
    expect(document.querySelectorAll("[data-part=mark]")).toHaveLength(0);
    expect(within(chipsRow()!).getAllByRole("button").map((chip) => chip.textContent)).toEqual(["Shorter", "Captions on", "Add zooms"]);
    expect(net.calls(`POST ${base}/kept`).map((one) => one.body)).toEqual([{ finding: "under-buttons s1" }, { finding: "on-face error s1" }, { finding: "fade-both s1" }]);
    expect(net.calls(`POST ${base}/change`)).toEqual([]);
  });

  it("goes to the next one at its moment, round to the first after the last, shows one again, and closes with the chips back (7)", async () => {
    network({ [`GET ${base}`]: [ok(three())] });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "3 to check" }));
    await at(60);
    fireEvent.click(inCard("Next, 2 of 3"));
    expect(card()).toHaveTextContent(/^0:06 · The captions cover your face here\./);
    await at(180);
    fireEvent.click(inCard("Next, 3 of 3"));
    expect(card()).toHaveTextContent(/^0:08 · This part fades in and out at once\./);
    await at(240);
    // Moved away by the creator, "Show" goes back to its moment.
    fireEvent.keyDown(playhead(), { key: "Home" });
    await at(0);
    fireEvent.click(inCard("Show"));
    await at(240);
    fireEvent.click(inCard("Next, 1 of 3"));
    expect(card()).toHaveTextContent(/^0:02 · The captions sit under the app's buttons here\./);
    await at(60);
    fireEvent.click(inCard("Close"));
    noCard();
    expect(within(chipsRow()!).getAllByRole("button").map((chip) => chip.textContent)).toEqual(["3 to check", "Shorter", "Captions on", "Add zooms"]);
    expect(document.activeElement).toBe(button("3 to check"));
  });

  it("says a keep that failed in the conversation as any failed call, the card staying on the same one (8)", async () => {
    const net = network({ [`GET ${base}`]: [ok(three())], [`POST ${base}/kept`]: [refused(400, "That is not among the things to check.")] }, { [`GET ${base}`]: ok(three()) });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "3 to check" }));
    await at(60);
    fireEvent.click(inCard("Keep it"));
    expect(await screen.findByRole("alert")).toHaveTextContent("That is not among the things to check.");
    expect(card()).toHaveTextContent(/^0:02 · The captions sit under the app's buttons here\./);
    expect(inCard("Next, 2 of 3")).toBeEnabled();
    await waitFor(() => expect(net.calls(`GET ${base}`).length).toBeGreaterThanOrEqual(2));
    expect(card()).toBeInTheDocument();
  });

  it("closes when the read after a keep that failed shows another turn: the card was about the turn it no longer shows", async () => {
    const CHANGED = "The edit changed while this was being made. Try again.";
    const moved = two({ turns: [...three().turns, turn(2, { request: "Shorter", say: "Cut it to 10 seconds.", findings: [FINDING] })] });
    network({ [`GET ${base}`]: [ok(three())], [`POST ${base}/kept`]: [refused(409, CHANGED)] }, { [`GET ${base}`]: ok(moved) });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "3 to check" }));
    await at(60);
    fireEvent.click(inCard("Keep it"));
    expect(await screen.findByText("Cut it to 10 seconds.")).toBeInTheDocument();
    noCard();
    expect(await screen.findByRole("button", { name: "1 to check" })).toBeInTheDocument();
  });

  it("says a finding of a code it does not know plainly, with Show and no fix, and Keep it still puts it away (fix round 1)", async () => {
    // A review newer than the page: a code the card's tables do not know must not break the page.
    const NEW: Finding = { code: "new-check" as Finding["code"], severity: "warn", where: { frame: 90, shot: "s1" }, says: "something new the review checks" };
    const withNew = (kept: string[] = []) => shown({ turns: [{ ...viewOf().turns[0]!, findings: [NEW], kept }] });
    const net = network({ [`GET ${base}`]: [ok(withNew())], [`POST ${base}/kept`]: [ok(withNew(["new-check s1"]))] });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "1 to check" }));
    expect(card()).toHaveTextContent(/^0:03 · Have a look at this moment\./);
    expect(within(card()).getAllByRole("button").map((each) => each.getAttribute("aria-label") ?? each.textContent)).toEqual(["Close", "Show", "Keep it"]);
    await at(90);
    fireEvent.click(inCard("Keep it"));
    await waitFor(noCard);
    expect(net.calls(`POST ${base}/kept`).map((one) => one.body)).toEqual([{ finding: "new-check s1" }]);
    noButton(/to check/);
  });

  describe("the chin touched, never put to the creator (S18)", () => {
    const CHIN: Finding = { code: "on-face", severity: "warn", where: { frame: 30, shot: "s1" }, says: "the captions at 1.0 s touch the chin; move them up or down" };
    const COVERED: Finding = { code: "on-face", severity: "error", where: { frame: 90, shot: "s1" }, says: "the captions at 3.0 s cover the mouth; move them up or down" };
    const first = (findings: Finding[]) => shown({ turns: [{ ...viewOf().turns[0]!, findings, kept: [] }] });
    const rings = () => document.querySelectorAll("[data-part=mark]").length;

    it("a first cut whose only finding is the chin's warning shows nothing to check: no chip, no card, no ring", async () => {
      network({ [`GET ${base}`]: [ok(first([CHIN]))] });
      open();
      await waitFor(() => expect(chipsRow()).not.toBeNull());
      expect(within(chipsRow()!).getAllByRole("button").map((chip) => chip.textContent)).toEqual(["Shorter", "Captions on", "Add zooms"]);
      noButton(/to check/);
      noCard();
      expect(rings()).toBe(0);
    });

    it("an error and a chin warning together show one: the face covered, with its fix", async () => {
      network({ [`GET ${base}`]: [ok(first([CHIN, COVERED]))] });
      open();
      fireEvent.click(await screen.findByRole("button", { name: "1 to check" }));
      expect(rings()).toBe(1);
      expect(card()).toHaveTextContent(/^0:03 · The captions cover your face here\./);
      expect(within(card()).getAllByRole("button").map((each) => each.getAttribute("aria-label") ?? each.textContent)).toEqual(["Close", "Move them off my face", "Keep it"]);
      expect(within(card()).getByText("1 of 1").tagName).toBe("SPAN");
      await at(90);
    });

    it("after \"Move them off my face\" clears the error, nothing is left to check, though the chin's warning stays in the review", async () => {
      const cleared = shown({ head: 2, shown: 2, undo: 1, turns: [{ ...viewOf().turns[0]!, findings: [COVERED], kept: [] }, turn(2, { request: "Move the captions off my face.", at: 90, say: "The captions are lower now.", findings: [CHIN] })] });
      const net = network({ [`GET ${base}`]: [ok(first([COVERED]))], [`POST ${base}/change`]: [ok(cleared)] });
      open();
      fireEvent.click(await screen.findByRole("button", { name: "1 to check" }));
      await at(90);
      fireEvent.click(inCard("Move them off my face"));
      expect(await screen.findByText("The captions are lower now.")).toBeInTheDocument();
      expect(net.calls(`POST ${base}/change`).map((one) => one.body)).toEqual([{ request: "Move the captions off my face.", at: 90 }]);
      noButton(/to check/);
      noCard();
      expect(rings()).toBe(0);
    });
  });

  it("opens again on the finding a fix that failed was for, not on the first (fix round 1)", async () => {
    const net = network({ [`GET ${base}`]: [ok(three())], [`POST ${base}/change`]: [refused(502, "the editor could not make that change")] }, { [`GET ${base}`]: ok(three()) });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "3 to check" }));
    await at(60);
    fireEvent.click(inCard("Next, 2 of 3"));
    await at(180);
    fireEvent.click(inCard("Move them off my face"));
    expect(await screen.findByRole("alert")).toHaveTextContent("The editor could not make that change.");
    expect(net.calls(`POST ${base}/change`).map((one) => one.body)).toEqual([{ request: "Move the captions off my face.", at: 180 }]);
    noCard();
    // The video is moved away meanwhile; "3 to check" opens on the captions on the face, at their moment.
    fireEvent.keyDown(playhead(), { key: "Home" });
    await at(0);
    fireEvent.click(button("3 to check"));
    expect(card()).toHaveTextContent(/^0:06 · The captions cover your face here\./);
    expect(inCard("Next, 3 of 3").textContent).toBe("2 of 3");
    await at(180);
    // Once: closed and opened again, it starts from the first.
    fireEvent.click(inCard("Close"));
    fireEvent.click(button("3 to check"));
    expect(card()).toHaveTextContent(/^0:02 · The captions sit under the app's buttons here\./);
  });

  it("turns Original off as it opens, and closes when a sheet or the preview opens", async () => {
    network({ [`GET ${base}`]: [ok(three())] });
    open();
    await screen.findByText("Captions are on.");
    await at(15);
    fireEvent.click(button("Original"));
    expect(button("Original")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button("3 to check"));
    expect(button("Original")).toHaveAttribute("aria-pressed", "false");
    expect(playhead()).toHaveAttribute("aria-valuemax", String(filmFrames(QUIET) - 1));
    await at(60);
    fireEvent.click(button(/^Look/));
    expect(await screen.findByRole("dialog", { name: "Look" })).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    noCard();
    fireEvent.click(button("3 to check"));
    expect(card()).toBeInTheDocument();
    fireEvent.click(button("Preview as posted"));
    expect(screen.getByRole("dialog", { name: "Preview as posted" })).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Preview as posted" })).toBeNull());
    noCard();
  });
});

describe("the editor page, its export", () => {
  it("holds the edit still while the file is made, gives it back on Cancel", async () => {
    const net = network({
      [`GET ${base}`]: [ok(shown())],
      [`POST ${base}/export`]: [{ status: 202, body: shown({ export: job("running") }) }],
      [`DELETE ${base}/export`]: [ok(shown())],
    });
    open();
    await screen.findByText("Captions are on.");
    fireEvent.click(button("Export"));
    expect(await screen.findByRole("heading", { name: "Making your video" })).toBeInTheDocument();
    expect(field()).toBeDisabled();
    expect(button("Exporting")).toBeDisabled();
    expect(button(/^Look/)).toBeDisabled();
    expect(button("Captions")).toBeDisabled();
    expect(button("Undo")).toBeDisabled();
    // The video can still be watched.
    expect(button("Play")).toBeEnabled();
    expect(playhead()).not.toHaveAttribute("aria-disabled");
    fireEvent.click(button("Cancel"));
    await waitFor(() => expect(field()).toBeEnabled());
    expect(net.calls(`DELETE ${base}/export`)).toHaveLength(1);
    expect(button("Export")).toBeEnabled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the Ready sheet when the export it watched is made", async () => {
    network({ [`GET ${base}`]: [ok(shown({ export: job("running") }))] }, { [`GET ${base}`]: ok(shown({ export: made() })) });
    open();
    const sheet = await screen.findByRole("dialog", { name: "Ready" });
    expect(within(sheet).getByRole("link", { name: /Download/ })).toHaveAttribute("href", "https://media.test/films/film-1.mp4");
    expect(within(sheet).getByText(/0:13 · 1080 × 1920 · with sound/)).toBeInTheDocument();
  });

  it("opens it when a Cancel is answered with the file, made before the cancel arrived", async () => {
    network({ [`GET ${base}`]: [ok(shown({ export: job("running") }))], [`DELETE ${base}/export`]: [ok(shown({ export: made() }))] }, { [`GET ${base}`]: ok(shown({ export: job("running") })) });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("dialog", { name: "Ready" })).toBeInTheDocument();
  });

  it("does not open it by itself for a file made before the page was opened; Export shows it without making the file again", async () => {
    const net = network({ [`GET ${base}`]: [ok(shown({ export: made() }))] });
    open();
    await screen.findByText("Captions are on.");
    await act(async () => void (await new Promise((done) => setTimeout(done, 20))));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(button("Export"));
    const sheet = await screen.findByRole("dialog", { name: "Ready" });
    expect(within(sheet).getByRole("link", { name: /Download/ })).toHaveAttribute("href", "https://media.test/films/film-1.mp4");
    expect(net.calls(`POST ${base}/export`)).toHaveLength(0);
    fireEvent.click(within(sheet).getByRole("button", { name: "Back to the edit" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  describe("on a phone, whose share sheet takes files (R31)", () => {
    const MATCH_MEDIA = Object.getOwnPropertyDescriptor(window, "matchMedia");
    /** A touch screen whose share sheet takes files, and the film's address answering with a file; the routes as `network` answers them. */
    function phone() {
      Object.defineProperty(window, "matchMedia", {
        configurable: true, writable: true,
        value: (query: string) => ({ matches: query === "(pointer: coarse)", media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }),
      });
      Object.defineProperty(navigator, "canShare", { configurable: true, value: (data?: ShareData) => !!data?.files?.length });
      Object.defineProperty(navigator, "share", { configurable: true, value: vi.fn(async () => undefined) });
      const routes = globalThis.fetch;
      const films = vi.fn(async (_input: string) => new Response(new Blob([new Uint8Array(8)])));
      vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => (String(input).startsWith("https://media.test/films/") ? films(String(input)) : routes(input, init))));
      return films;
    }
    afterEach(() => {
      Reflect.deleteProperty(navigator, "canShare");
      Reflect.deleteProperty(navigator, "share");
      if (MATCH_MEDIA) Object.defineProperty(window, "matchMedia", MATCH_MEDIA);
      else Reflect.deleteProperty(window, "matchMedia");
    });

    it("fetches nothing of a film made before the page was opened until the creator opens its sheet, and lets it go when it closes", async () => {
      network({ [`GET ${base}`]: [ok(shown({ export: made() }))] });
      const films = phone();
      open();
      await screen.findByText("Captions are on.");
      await act(async () => void (await new Promise((done) => setTimeout(done, 20))));
      expect(films).not.toHaveBeenCalled();
      fireEvent.click(button("Export"));
      const sheet = await screen.findByRole("dialog", { name: "Ready" });
      expect(await within(sheet).findByRole("button", { name: "Save to Photos" })).toBeEnabled();
      expect(films.mock.calls).toEqual([["https://media.test/films/film-1.mp4"]]);
      fireEvent.click(within(sheet).getByRole("button", { name: "Back to the edit" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await act(async () => void (await new Promise((done) => setTimeout(done, 20))));
      expect(films).toHaveBeenCalledTimes(1);
    });

    it("fetches the film of an export it watched finish, whose sheet opens by itself", async () => {
      network({ [`GET ${base}`]: [ok(shown({ export: job("running") }))] }, { [`GET ${base}`]: ok(shown({ export: made() })) });
      const films = phone();
      open();
      const sheet = await screen.findByRole("dialog", { name: "Ready" });
      expect(await within(sheet).findByRole("button", { name: "Save to Photos" })).toBeEnabled();
      expect(films).toHaveBeenCalledTimes(1);
    });
  });

  it("opens it once for the export it watched: not again when its turn is left and come back to", async () => {
    const done = shown({ export: made(), redo: 2 });
    network(
      { [`GET ${base}`]: [ok(shown({ export: job("running"), redo: 2 }))], [`POST ${base}/head`]: [ok(two()), ok(done)] },
      { [`GET ${base}`]: ok(done) },
    );
    open();
    const sheet = await screen.findByRole("dialog", { name: "Ready" });
    fireEvent.click(within(sheet).getByRole("button", { name: "Back to the edit" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // Another turn is shown (the file is of turn 1), then turn 1 again with its file: seen already, so it stays closed.
    fireEvent.click(button("Redo"));
    const undo = () => screen.getAllByRole("button", { name: "Undo" })[0]!; // the header's
    await waitFor(() => expect(undo()).toBeEnabled());
    fireEvent.click(undo());
    await waitFor(() => expect(undo()).toBeDisabled());
    expect(button("Redo")).toBeEnabled();
    await act(async () => void (await new Promise((resolve) => setTimeout(resolve, 20))));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("says a file that could not be made, and makes it again on Try again", async () => {
    const net = network({ [`GET ${base}`]: [ok(shown({ export: job("failed", { error: "the render stopped" }) }))], [`POST ${base}/export`]: [{ status: 202, body: shown({ export: job("running", { job: "j2" }) }) }] });
    open();
    const said = await screen.findByRole("alert");
    expect(said).toHaveTextContent("The video could not be made.");
    fireEvent.click(within(said).getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Making your video" })).toBeInTheDocument();
    expect(net.calls(`POST ${base}/export`)).toHaveLength(1);
  });
});

describe("the editor page, before its cut", () => {
  it("says an edit that is not there, and an upload that stopped", async () => {
    network({ [`GET ${base}`]: [refused(404, "no such edit")] });
    open();
    expect(await screen.findByText("This edit is not here.")).toBeInTheDocument();
    expect(button("Home")).toBeInTheDocument();
    cleanup();
    network({ [`GET ${base}`]: [ok(before("uploading"))] });
    open();
    expect(await screen.findByText("The upload stopped.")).toBeInTheDocument();
    expect(button("Pick the video again")).toBeInTheDocument();
    noButton("Try again");
  });

  it("leaves an edit that is not there by Home, the way back to Library dropped, with only Back in its header", async () => {
    useShellStore.getState().setThreadBack("/library");
    network({ [`GET ${base}`]: [refused(404, "no such edit")] });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Home" }));
    expect(router.push).toHaveBeenCalledWith("/home");
    expect(useShellStore.getState().threadBack).toBeNull();
    expect(button("Back")).toBeInTheDocument();
    noButton("Export");
    noButton("Undo");
    expect(screen.getByRole("heading", { level: 1, name: "Edit" })).toBeInTheDocument();
  });

  it("says the gate's own sentence when the editor is closed to the account", async () => {
    network({ [`GET ${base}`]: [refused(403, "the edit tool is not open to this account yet")] });
    open();
    expect(await screen.findByText("The edit tool is not open to this account yet.")).toBeInTheDocument();
    expect(button("Home")).toBeInTheDocument();
  });

  it("says an edit it could not read, reads it again on Try again, and goes on trying by itself", async () => {
    const net = network({ [`GET ${base}`]: [refused(500, "it answered 500")] }, { [`GET ${base}`]: refused(500, "it answered 500") });
    // A minute between its own tries: only the tap reads it again here.
    open(60_000);
    expect(await screen.findByText("This edit could not be read.")).toBeInTheDocument();
    expect(net.calls(`GET ${base}`)).toHaveLength(1);
    net.keep[`GET ${base}`] = ok(shown());
    fireEvent.click(button("Try again"));
    expect(await screen.findByText("Captions are on.")).toBeInTheDocument();
    cleanup();
    network({ [`GET ${base}`]: [refused(500, "it answered 500"), refused(500, "it answered 500"), ok(shown())] });
    open(5);
    expect(await screen.findByText("Captions are on.")).toBeInTheDocument();
  });

  it("shows the take being listened to with the looks to pick from, then makes the first cut in the look picked", async () => {
    const ready = later();
    const cut = later();
    const net = network({ [`GET ${base}`]: [ok(before("analysing", { progress: 0.4 })), ready.answer], [`POST ${base}/cut`]: [cut.answer] });
    open();
    const bar = await screen.findByRole("progressbar", { name: "Listening to it" });
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(screen.getByRole("heading", { name: "Pick a look while you wait" })).toBeInTheDocument();
    expect(button("Export")).toBeDisabled();
    noButton("Play");
    fireEvent.click(button("Clean"));
    expect(button("Clean")).toHaveAttribute("aria-pressed", "true");
    await act(async () => ready.give(ok(before("ready"))));
    expect(await screen.findByRole("progressbar", { name: "Making the first cut" })).not.toHaveAttribute("aria-valuenow");
    expect(net.calls(`POST ${base}/cut`)[0]?.body).toEqual({ style: { preset: "clean" } });
    // The take itself can be watched meanwhile; the look it is cut in stays picked, and cannot be changed under the cut.
    expect(takeVideo()).toHaveAttribute("src", "https://media.test/preview.mp4");
    await waitFor(() => expect(button("Clean")).toBeDisabled());
    expect(button("Clean")).toHaveAttribute("aria-pressed", "true");
    await act(async () => cut.give(ok(shown({ look: "clean" }))));
    expect(await screen.findByText("Captions are on.")).toBeInTheDocument();
    expect(takeVideo()).toBeNull();
  });

  it("offers a first cut that failed again in place, and holds the take's first address meanwhile", async () => {
    const again = before("ready", { previewUrl: "https://media.test/preview.mp4?signed=again", posterUrl: "https://media.test/poster.jpg?signed=again" });
    const net = network({ [`GET ${base}`]: [ok(before("ready"))], [`POST ${base}/cut`]: [refused(502, "the editor could not make the cut"), ok(shown())] }, { [`GET ${base}`]: ok(again) });
    open();
    const said = await screen.findByRole("alert");
    expect(said).toHaveTextContent("The editor could not make the cut.");
    expect(screen.queryByRole("progressbar")).toBeNull();
    // The edit is read again after a call that failed: its addresses are signed anew, and the take keeps the first.
    await waitFor(() => expect(net.calls(`GET ${base}`).length).toBeGreaterThanOrEqual(2));
    expect(takeVideo()).toHaveAttribute("src", "https://media.test/preview.mp4");
    expect(takeVideo()).toHaveAttribute("poster", "https://media.test/poster.jpg");
    fireEvent.click(button("Try again"));
    expect(await screen.findByText("Captions are on.")).toBeInTheDocument();
    expect(net.calls(`POST ${base}/cut`)).toHaveLength(2);
  });

  it("shows the upload with the time left as it was measured, the take playing from the device's own copy", async () => {
    let clock = 0;
    hold({
      now: () => clock,
      put: (_url, _file, onSent) => {
        clock = 2000;
        onSent(1000); // a tenth of it in two seconds: twenty more for the rest
        return new Promise(() => {});
      },
    });
    const net = network({ [`GET ${base}`]: [ok(before("uploading"))] });
    open();
    const bar = await screen.findByRole("progressbar", { name: "Uploading" });
    expect(bar).toHaveAttribute("aria-valuenow", "9");
    expect(screen.getByText("20 seconds left")).toBeInTheDocument();
    expect(takeVideo()).toHaveAttribute("src", "blob:local/1");
    expect(button("Play")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pick a look while you wait" })).toBeInTheDocument();
    expect(net.calls(`GET ${base}`)).toHaveLength(1);
  });

  it("lets the device's own copy go once the cut plays from the take's preview", async () => {
    const revoke = vi.fn();
    hold({ put: () => new Promise(() => {}), revoke });
    network({ [`GET ${base}`]: [ok(shown())] });
    expect(uploadOf(TAKE)).not.toBeNull();
    open();
    await screen.findByText("Captions are on.");
    await waitFor(() => expect(uploadOf(TAKE)).toBeNull());
    expect(revoke).toHaveBeenCalledWith("blob:local/1");
  });

  it("offers Try again for an upload that stopped only when trying again can work", async () => {
    const put = vi.fn<NonNullable<UploadDeps["put"]>>().mockRejectedValueOnce(new Error("the upload did not reach R2")).mockReturnValue(new Promise(() => {}));
    hold({ put });
    network({ [`GET ${base}`]: [ok(before("uploading"))] });
    open();
    expect(await screen.findByText("The upload stopped.")).toBeInTheDocument();
    expect(button("Pick the video again")).toBeInTheDocument();
    fireEvent.click(button("Try again"));
    expect(await screen.findByRole("progressbar", { name: "Uploading" })).toBeInTheDocument();
    expect(put).toHaveBeenCalledTimes(2);
    cleanup();
    forgetUpload(TAKE);
    hold({ put: async () => Promise.reject(new Refused("R2 answered 403 to the upload")) });
    network({ [`GET ${base}`]: [ok(before("uploading"))] });
    open();
    expect(await screen.findByText("The upload stopped.")).toBeInTheDocument();
    expect(button("Pick the video again")).toBeInTheDocument();
    noButton("Try again");
  });

  describe("a take whose finish waits for another video of the creator's (R31)", () => {
    const WAITING = "Another video of yours is being listened to. This one starts when it is done.";
    const finishOf = `POST /api/edit/takes/${TAKE}/uploaded`;
    const behind = refused(409, "an analysis of yours is already running; try again when it ends");
    const pass = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

    it("says so instead of that the upload stopped, reads nothing meanwhile, and listens to it once the finish is taken", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const net = network({ [`GET ${base}`]: [ok(before("uploading"))], [finishOf]: [behind] }, { [`GET ${base}`]: ok(before("analysing", { progress: 0.1 })), [finishOf]: { status: 202, body: { job: { id: "j" } } } });
      const put = vi.fn(async () => undefined);
      hold({ put });
      open(1000);
      await pass(0);
      expect(screen.getByRole("progressbar", { name: WAITING })).toBeInTheDocument();
      expect(screen.queryByText("The upload stopped.")).toBeNull();
      expect(screen.queryByRole("alert")).toBeNull();
      noButton("Try again");
      noButton("Pick the video again");
      expect(screen.getByRole("heading", { name: "Pick a look while you wait" })).toBeInTheDocument();
      // Nothing changes on the server while it waits: the edit is not read, and nothing is sent again but the finish.
      await pass(9_999);
      expect(net.calls(`GET ${base}`)).toHaveLength(1);
      expect(net.calls(finishOf)).toHaveLength(1);
      await pass(1);
      expect(net.calls(finishOf)).toHaveLength(2);
      await pass(1000);
      expect(screen.getByRole("progressbar", { name: "Listening to it" })).toBeInTheDocument();
      expect(put).toHaveBeenCalledTimes(1);
    });

    it("says the route's sentence with Try again after five minutes of it; Try again tells only the finish", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      const net = network({ [`GET ${base}`]: [ok(before("uploading"))] }, { [`GET ${base}`]: ok(before("uploading")), [finishOf]: behind });
      const put = vi.fn(async () => undefined);
      hold({ put });
      open(1000);
      await pass(0);
      await pass(299_999);
      expect(screen.getByRole("progressbar", { name: WAITING })).toBeInTheDocument();
      await pass(1);
      expect(screen.getByRole("alert")).toHaveTextContent("An analysis of yours is already running; try again when it ends.");
      expect(screen.queryByText("The upload stopped.")).toBeNull();
      expect(button("Pick the video again")).toBeInTheDocument();
      expect(net.calls(finishOf)).toHaveLength(31);
      fireEvent.click(button("Try again"));
      await pass(0);
      expect(net.calls(finishOf)).toHaveLength(32);
      expect(screen.getByRole("progressbar", { name: WAITING })).toBeInTheDocument();
      expect(put).toHaveBeenCalledTimes(1);
    });
  });

  it("says why a take failed with another video to use, and one problem at a time", async () => {
    network({ [`GET ${base}`]: [ok(before("failed", { error: "the take is longer than 10 minutes" }))] }, { [`GET ${base}`]: ok(before("failed", { error: "the take is longer than 10 minutes" })) });
    open();
    expect(await screen.findByText("The take is longer than 10 minutes.")).toBeInTheDocument();
    expect(button("Use another video")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Choose a video file"), { target: { files: [new File(["words"], "notes.txt", { type: "text/plain" })] } });
    expect(await screen.findByText("A video to edit is an MP4 or a MOV file.")).toBeInTheDocument();
    expect(screen.queryByText("The take is longer than 10 minutes.")).toBeNull();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(button("Use another video")).toBeEnabled();
  });
});

describe("one address a take", () => {
  /** The tab hidden or looked at again, as the browser tells it. */
  const tab = (state: "visible" | "hidden") => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
  };
  afterEach(() => {
    Reflect.deleteProperty(document, "visibilityState");
  });

  it("reads the edit once when the tab is looked at again after an hour and a half, and the take plays from the fresh address", async () => {
    // The page's clock stood in: the tab's own timers do not run while a device sleeps, so none fires here either.
    let clock = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    const signed = (mark: string) => before("ready", { previewUrl: `https://media.test/preview.mp4?signed=${mark}`, posterUrl: `https://media.test/poster.jpg?signed=${mark}` });
    // A first cut that failed: the take's own video stays on the stage, and nothing is read on.
    const net = network({ [`GET ${base}`]: [ok(signed("first")), ok(signed("second")), ok(signed("third"))], [`POST ${base}/cut`]: [refused(502, "the editor could not make the cut")] });
    open();
    await screen.findByRole("alert");
    // The edit is read again after the call that failed; that read is in before the clock is moved.
    await waitFor(() => expect(net.calls(`GET ${base}`)).toHaveLength(2));
    await act(async () => void (await new Promise((done) => setTimeout(done, 20))));
    expect(takeVideo()).toHaveAttribute("src", "https://media.test/preview.mp4?signed=first");
    // Looked at again too soon, and hidden when its time is up: nothing is read.
    clock += HOLD_MS - 1000;
    tab("hidden");
    tab("visible");
    clock += 1000;
    tab("hidden");
    await act(async () => void (await new Promise((done) => setTimeout(done, 20))));
    expect(net.calls(`GET ${base}`)).toHaveLength(2);
    // Looked at again: read once, and the fresh addresses take the held ones' place.
    tab("visible");
    await waitFor(() => expect(takeVideo()).toHaveAttribute("src", "https://media.test/preview.mp4?signed=third"));
    expect(takeVideo()).toHaveAttribute("poster", "https://media.test/poster.jpg?signed=third");
    expect(net.calls(`GET ${base}`)).toHaveLength(3);
    tab("hidden");
    tab("visible");
    await act(async () => void (await new Promise((done) => setTimeout(done, 20))));
    expect(net.calls(`GET ${base}`)).toHaveLength(3);
  });

  it("reads it when the connection comes back, if the read on the look did not get through", async () => {
    // A laptop opened again: the tab is seen at once, the network a few seconds later.
    let clock = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    const signed = (mark: string) => before("ready", { previewUrl: `https://media.test/preview.mp4?signed=${mark}` });
    const net = network({ [`GET ${base}`]: [ok(signed("first")), ok(signed("second"))], [`POST ${base}/cut`]: [refused(502, "the editor could not make the cut")] });
    open();
    await screen.findByRole("alert");
    await waitFor(() => expect(net.calls(`GET ${base}`)).toHaveLength(2));
    await act(async () => void (await new Promise((done) => setTimeout(done, 20))));
    clock += HOLD_MS;
    tab("hidden");
    tab("visible"); // read, and not answered: there is no network yet
    await waitFor(() => expect(net.calls(`GET ${base}`)).toHaveLength(3));
    await act(async () => void (await new Promise((done) => setTimeout(done, 20))));
    expect(takeVideo()).toHaveAttribute("src", "https://media.test/preview.mp4?signed=first");
    net.keep[`GET ${base}`] = ok(signed("fresh"));
    act(() => void window.dispatchEvent(new Event("online")));
    await waitFor(() => expect(takeVideo()).toHaveAttribute("src", "https://media.test/preview.mp4?signed=fresh"));
    expect(net.calls(`GET ${base}`)).toHaveLength(4);
    // Read now: the connection coming back once more reads nothing.
    act(() => void window.dispatchEvent(new Event("online")));
    await act(async () => void (await new Promise((done) => setTimeout(done, 20))));
    expect(net.calls(`GET ${base}`)).toHaveLength(4);
  });

  it("does not read the edit on a look while a call is out", async () => {
    let clock = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    const change = later();
    const net = network({ [`GET ${base}`]: [ok(shown())], [`POST ${base}/change`]: [change.answer] });
    open();
    await screen.findByText("Captions are on.");
    fireEvent.change(field(), { target: { value: "Shorter" } });
    fireEvent.keyDown(field(), { key: "Enter" });
    await screen.findByText("Working on it…");
    clock += HOLD_MS;
    tab("hidden");
    tab("visible");
    await act(async () => void (await new Promise((done) => setTimeout(done, 20))));
    expect(net.calls(`GET ${base}`)).toHaveLength(1);
    await act(async () => change.give(ok(two())));
    expect(await screen.findByText("Cut it to 10 seconds.")).toBeInTheDocument();
    // The answer brought the edit afresh: the next look reads nothing.
    tab("hidden");
    tab("visible");
    await act(async () => void (await new Promise((done) => setTimeout(done, 20))));
    expect(net.calls(`GET ${base}`)).toHaveLength(1);
  });

  it("takes the next address that arrives once the page says the held one is old", () => {
    const held = renderHook(({ address, renewals }: { address: string; renewals: number }) => useHeld("t1", address, renewals), { initialProps: { address: "a1", renewals: 0 } });
    held.rerender({ address: "a2", renewals: 0 });
    expect(held.result.current).toBe("a1");
    // Said old while the page has "a2", of an age nobody knows: it is the one after that is taken.
    held.rerender({ address: "a2", renewals: 1 });
    expect(held.result.current).toBe("a1");
    held.rerender({ address: "a3", renewals: 1 });
    expect(held.result.current).toBe("a3");
    held.rerender({ address: "a4", renewals: 1 });
    expect(held.result.current).toBe("a3");
  });

  it("holds the first address, takes another take's, and after its time the next one that arrives", () => {
    vi.useFakeTimers();
    const held = renderHook(({ take, address }: { take: string | null; address: string | null }) => useHeld(take, address), { initialProps: { take: "t1", address: null as string | null } });
    expect(held.result.current).toBeNull();
    held.rerender({ take: "t1", address: "a1" });
    expect(held.result.current).toBe("a1");
    held.rerender({ take: "t1", address: "a2" });
    expect(held.result.current).toBe("a1");
    // Its time is up: the address the page has then is of an age nobody knows, so it is the next one that is taken.
    act(() => void vi.advanceTimersByTime(HOLD_MS));
    expect(held.result.current).toBe("a1");
    held.rerender({ take: "t1", address: "a3" });
    expect(held.result.current).toBe("a3");
    held.rerender({ take: "t1", address: "a4" });
    expect(held.result.current).toBe("a3");
    held.rerender({ take: "t2", address: null });
    expect(held.result.current).toBeNull();
    held.rerender({ take: "t2", address: "b1" });
    expect(held.result.current).toBe("b1");
  });
});
