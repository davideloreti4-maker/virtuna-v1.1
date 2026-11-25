/** @vitest-environment happy-dom */
/**
 * agent.test.tsx — the whole page (`AgentPage`), rendered with everything of ours real: its state, its calls, its parts and
 * the kit's Player. Only the network is stood in (`fetch`), answering in the routes' own shapes with edits made by the real
 * door (`firstEdit`, `applyOps`). Two things the test environment lacks as a browser are given empty stand-ins so that the
 * Player can mount (`FontFace`, `document.fonts`); it draws no video here, and nothing of the picture is tested.
 *
 * What is held: the calls the page makes and with what, a failed change keeping its request, undo, a cut tried again without
 * reading its video again, a read that is stopped, a download that cannot be followed or made (and that a creator can always
 * get back to their cut), a take that cannot be read, and where the keyboard's focus goes.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyOps, type Asset, type Edit, type Op } from "@/lib/edit";
import { presetOf } from "@/lib/edit/style/presets";
import { firstEdit } from "@/lib/edit/worker/takes";
import { AgentPage } from "../agent";
import { LOST_TOUCH, NOT_MADE } from "../download";

const TAKE = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const JOB = "33333333-3333-4333-8333-333333333333";
const LINK = "https://www.tiktok.com/@someone/video/7300000000000000000";

const asset = (id: string): Asset => ({
  id, kind: "video", origin: "uploaded", at: { bucket: "takes", path: `u/creator/takes/${id}/full.mp4` }, ms: 8000, w: 1080, h: 1920, sound: true,
  words: [{ text: "Hello", startMs: 200, endMs: 600 }, { text: "there", startMs: 700, endMs: 1100 }],
});
const ASSET = asset(TAKE);
/** Edits as the agent's route would answer them: made by the door, so the Player is given real ones. */
const FIRST: Edit = firstEdit(ASSET);
const changed = (edit: Edit, op: Op): Edit => {
  const made = applyOps(edit, [op], [ASSET]);
  if (!made.ok) throw new Error(made.problems.map((problem) => problem.message).join("; "));
  return made.edit;
};
const MONO = changed(FIRST, { op: "look.set", preset: "mono" });
const WARM = changed(FIRST, { op: "look.set", preset: "warm" });

const answer = (say: string, edit: Edit, more: Record<string, unknown> = {}) => ({
  status: 200,
  body: { say, ops: [], edit, findings: [], rounds: 1, ms: 1200, cost: 0.01, changed: true, match: null, style: null, styleSay: null, ...more },
});
const refused = (status: number, error: string) => ({ status, body: { error } });

type Answered = { status: number; body: unknown };
interface Asked {
  call: string;
  body: unknown;
}

/**
 * `fetch`: each call of the page's (`METHOD path`) is answered by the next answer listed for it, and kept in `asked`. A call
 * with no answer left fails the test. Whatever is not one of the app's routes is the Player's: the kit's font files are
 * answered empty, and the take's video 404 (there is no video here).
 */
function network(answers: Record<string, Answered[]>): Asked[] {
  const asked: Asked[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith("/edit/fonts/")) return new Response(new ArrayBuffer(8)); // the kit's own font files: nothing is drawn with them here
    if (!path.startsWith("/api/")) return new Response(null, { status: 404 });
    const call = `${init?.method ?? "GET"} ${path}`;
    asked.push({ call, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const next = answers[call]?.shift();
    if (!next) throw new Error(`the page made a call the test has no answer for: ${call}`);
    return new Response(JSON.stringify(next.body), { status: next.status, headers: { "Content-Type": "application/json" } });
  });
  return asked;
}
const calls = (asked: Asked[], call: string) => asked.filter((one) => one.call === call);

const TAKES = { status: 200, body: { takes: [{ id: TAKE, name: "take.mp4", status: "ready", ms: 8000, posterUrl: null }] } };
const READ_TAKE = { status: 200, body: { take: { id: TAKE }, asset: ASSET, previewUrl: "https://media.example/preview.mp4" } };
/** The answers every walk starts with: the takes, and the take. */
const opening = () => ({ "GET /api/edit/takes": [TAKES], [`GET /api/edit/takes/${TAKE}`]: [READ_TAKE] });

const make = () => screen.getByRole("button", { name: "Make the first cut" });
const field = () => screen.getByRole("textbox", { name: "Ask for a change" });
const row = (name: string) => screen.getByRole("radio", { name: new RegExp(`^${name}`) });
const under = () => within(document.querySelector<HTMLElement>("[data-part=under-phone]")!);
const turns = () => [...document.querySelectorAll("[data-part=thread] li[data-changed]")].map((turn) => turn.textContent);

/** The page opened and the take read: the first cut can be made. */
async function open(answers: Record<string, Answered[]>): Promise<Asked[]> {
  const asked = network({ ...opening(), ...answers });
  render(<AgentPage />);
  await waitFor(() => expect(make()).toBeEnabled());
  return asked;
}
/** The first cut made in our pick. */
async function cutMade(answers: Record<string, Answered[]>): Promise<Asked[]> {
  const asked = await open(answers);
  fireEvent.click(make());
  await screen.findByRole("region", { name: "Your cut" });
  return asked;
}
const ask = (request: string) => {
  fireEvent.change(field(), { target: { value: request } });
  fireEvent.keyDown(field(), { key: "Enter" });
};

/** What happy-dom lacks as a browser, for the kit's fonts: they load nothing here. */
class NoFontFace {
  constructor(readonly family: string) {}
  load = async () => this;
}
beforeAll(() => {
  Object.defineProperty(document, "fonts", { configurable: true, value: { add: () => {}, ready: Promise.resolve() } });
  // The Player says, each time it mounts, that it has no canvas to draw the take on. True here, and not what is tested.
  const say = console.error.bind(console);
  vi.spyOn(console, "error").mockImplementation((...told: unknown[]) => (told.some((one) => String(one).includes("MediaPlayer initialization failed")) ? undefined : say(...told)));
});
beforeEach(() => vi.stubGlobal("FontFace", NoFontFace));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the page, from opening to a cut and its changes", () => {
  it("opens with the take in the Player and our pick chosen, and makes the first cut with one call", async () => {
    const asked = await cutMade({ "POST /api/edit/agent": [answer("Cut from 8.0 s to 7.1 s.", FIRST)] });
    expect(asked.map((one) => one.call)).toEqual(["GET /api/edit/takes", `GET /api/edit/takes/${TAKE}`, "POST /api/edit/agent"]);
    expect(asked[2]?.body).toEqual({ takes: [TAKE], firstCut: true });
    expect(screen.getByText("Cut from 8.0 s to 7.1 s.")).toBeInTheDocument();
    expect(document.querySelector("main")).toHaveAttribute("data-state", "cut");
    expect(under().getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(under().getByRole("button", { name: "Download" })).toBeEnabled();
  });

  it("puts the keyboard's focus in the request field when the cut lands", async () => {
    await cutMade({ "POST /api/edit/agent": [answer("Cut.", FIRST)] });
    await waitFor(() => expect(field()).toHaveFocus());
  });

  it("sends a change on the edit that stands, shows its answer under it, and turns everything off while it is out", async () => {
    let release = () => {};
    const held = new Promise<void>((done) => (release = done));
    const asked = await cutMade({ "POST /api/edit/agent": [answer("Cut.", FIRST), answer("The video is now black and white.", MONO)] });
    const real = globalThis.fetch;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/edit/agent") await held; // the change is out until the test lets it go
      return real(input, init);
    });
    ask("Black and white");
    expect(await screen.findByText("Making the change…")).toBeInTheDocument();
    expect(field()).toBeDisabled();
    for (const name of ["Undo", "Start over", "Download"]) expect(under().getByRole("button", { name })).toBeDisabled();
    release();
    expect(await screen.findByText("The video is now black and white.")).toBeInTheDocument();
    expect(calls(asked, "POST /api/edit/agent")[1]?.body).toEqual({ takes: [TAKE], edit: FIRST, request: "Black and white" });
    expect(turns()).toEqual(["Black and whiteThe video is now black and white.Undo"]);
    expect(field()).toBeEnabled();
    expect(field()).toHaveValue("");
    expect(under().getByRole("button", { name: "Undo" })).toBeEnabled();
  });

  it("keeps a change that failed in the field, says why in one sentence, and sends the same again on Try again", async () => {
    const asked = await cutMade({
      "POST /api/edit/agent": [answer("Cut.", FIRST), answer("Black and white now.", MONO), refused(500, "something went wrong"), answer("Warmer now.", WARM)],
    });
    ask("Black and white");
    await screen.findByText("Black and white now.");
    ask("Warmer colours");
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong.");
    expect(field()).toHaveValue("Warmer colours"); // what was asked is not lost
    expect(turns()).toHaveLength(1); // and the thread is as it was
    expect(under().getByRole("button", { name: "Undo" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("Warmer now.");
    const sent = calls(asked, "POST /api/edit/agent");
    expect(sent[2]?.body).toEqual({ takes: [TAKE], edit: MONO, request: "Warmer colours" });
    expect(sent[3]?.body).toEqual(sent[2]?.body);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(field()).toHaveValue("");
    expect(turns()).toHaveLength(2);
  });

  it("goes back one edit on undo: the next change is asked of the edit before", async () => {
    const asked = await cutMade({ "POST /api/edit/agent": [answer("Cut.", FIRST), answer("Black and white now.", MONO), answer("Warmer now.", WARM)] });
    ask("Black and white");
    await screen.findByText("Black and white now.");
    fireEvent.click(under().getByRole("button", { name: "Undo" }));
    expect(turns()).toEqual([]);
    expect(under().getByRole("button", { name: "Undo" })).toBeDisabled();
    ask("Warmer colours");
    await screen.findByText("Warmer now.");
    expect(calls(asked, "POST /api/edit/agent")[2]?.body).toEqual({ takes: [TAKE], edit: FIRST, request: "Warmer colours" });
  });

  it("starts over when asked, and puts the keyboard's focus back on the row that is chosen", async () => {
    await cutMade({ "POST /api/edit/agent": [answer("Cut.", FIRST)] });
    fireEvent.click(under().getByRole("button", { name: "Start over" }));
    fireEvent.click(under().getByRole("button", { name: "Start over" }));
    expect(await screen.findByRole("heading", { name: "How should it look?" })).toBeInTheDocument();
    expect(document.querySelector("main")).toHaveAttribute("data-state", "picking");
    await waitFor(() => expect(row("Our pick")).toHaveFocus());
  });
});

describe("a first cut in a video's style", () => {
  const STYLE = presetOf("clean")!.profile;
  const linked = () => {
    fireEvent.click(row("Like a video"));
    fireEvent.change(screen.getByRole("textbox", { name: "A TikTok link" }), { target: { value: LINK } });
  };

  it("reads the video, then cuts in its style; a cut that fails is tried again without reading the video again", async () => {
    const asked = await open({
      "POST /api/edit/references": [{ status: 202, body: { id: "a-reference" } }],
      "GET /api/edit/references/a-reference": [{ status: 200, body: { status: "ready", style: STYLE, judged: true } }],
      "POST /api/edit/agent": [refused(409, "The editor is already working on a call of yours; try again when it is done."), answer("Cut like the video.", FIRST)],
    });
    linked();
    fireEvent.click(make());
    expect(await screen.findByRole("alert")).toHaveTextContent("The editor is already working on a call of yours; try again when it is done.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("Cut like the video.");
    expect(calls(asked, "POST /api/edit/references")).toEqual([{ call: "POST /api/edit/references", body: { url: LINK } }]);
    expect(calls(asked, "GET /api/edit/references/a-reference")).toHaveLength(1);
    const cuts = calls(asked, "POST /api/edit/agent");
    expect(cuts).toHaveLength(2);
    expect(cuts[1]?.body).toEqual({ takes: [TAKE], firstCut: true, style: STYLE });
  });

  it("stops reading when another row is picked: the button is back, and a style read late cuts nothing", async () => {
    const asked = await open({
      "POST /api/edit/references": [{ status: 202, body: { id: "a-reference" } }],
      "GET /api/edit/references/a-reference": [{ status: 200, body: { status: "analysing", stage: "reading its cuts", progress: 0.3 } }, { status: 200, body: { status: "ready", style: STYLE, judged: true } }],
    });
    linked();
    fireEvent.click(make());
    expect(await screen.findByText("Reading its cuts…")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "How should it look?" })).toBeEnabled(); // the rows stay on while it is read
    fireEvent.click(row("Our pick"));
    expect(make()).toBeEnabled();
    expect(screen.queryByText("Reading its cuts…")).toBeNull();
    await new Promise((done) => setTimeout(done, 1800)); // past the read's next turn (1.5 s)
    expect(calls(asked, "GET /api/edit/references/a-reference")).toHaveLength(1); // no read after the stop
    expect(calls(asked, "POST /api/edit/agent")).toHaveLength(0); // and no cut in a style nobody waits for
    expect(document.querySelector("main")).toHaveAttribute("data-state", "picking");
  });

  it("drops the problem of a failed read when another row is picked", async () => {
    await open({ "POST /api/edit/references": [refused(422, "the video is not there any more")] });
    linked();
    fireEvent.click(make());
    expect(await screen.findByRole("alert")).toHaveTextContent("The video is not there any more.");
    fireEvent.click(row("Our pick"));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("a download", () => {
  const RUNNING = { status: 200, body: { status: "running", stage: "rendering", progress: 0.4, error: null } };
  const MADE = { status: 200, body: { status: "done", stage: null, progress: 1, error: null, filmUrl: "https://films.example/film.mp4" } };
  const started = (id = JOB) => ({ status: 202, body: { job: { id, status: "queued", stage: null, progress: 0, error: null } } });
  const download = () => fireEvent.click(under().getByRole("button", { name: "Download" }));

  it("is asked for the edit on the phone, shows its bar, and turns off nothing but itself", async () => {
    const asked = await cutMade({
      "POST /api/edit/agent": [answer("Cut.", FIRST), answer("Black and white now.", MONO)],
      "POST /api/edit/renders": [started()],
      [`GET /api/edit/jobs/${JOB}`]: [RUNNING, RUNNING, RUNNING, RUNNING, RUNNING],
    });
    download();
    await waitFor(() => expect(under().getByRole("progressbar", { name: "Making the video" })).toHaveAttribute("aria-valuenow", "40"));
    expect(calls(asked, "POST /api/edit/renders")[0]?.body).toEqual({ edit: FIRST });
    expect(under().queryByRole("button", { name: "Download" })).toBeNull();
    expect(field()).toBeEnabled();
    expect(under().getByRole("button", { name: "Start over" })).toBeEnabled();
    // The creator goes on working while it is made: a change can be asked.
    ask("Black and white");
    await screen.findByText("Black and white now.");
    expect(under().getByRole("button", { name: "Download" })).toBeEnabled(); // the edit changed: the video asked for is not of it
  });

  it("that can no longer be followed is given up on in a sentence, with everything else on; Try again reads it again", async () => {
    const asked = await cutMade({
      "POST /api/edit/agent": [answer("Cut.", FIRST)],
      "POST /api/edit/renders": [started()],
      [`GET /api/edit/jobs/${JOB}`]: [RUNNING, refused(401, "sign in to use the edit tool"), MADE],
    });
    download();
    expect(await under().findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent(LOST_TOUCH); // the second read, a second later
    expect(under().queryByRole("progressbar")).toBeNull();
    expect(field()).toBeEnabled();
    expect(under().getByRole("button", { name: "Start over" })).toBeEnabled();
    expect(document.querySelector("main")).toHaveAttribute("data-busy", "false");

    fireEvent.click(under().getByRole("button", { name: "Try again" }));
    expect(await under().findByRole("link", { name: "Save video" })).toHaveAttribute("href", "https://films.example/film.mp4");
    expect(calls(asked, "POST /api/edit/renders")).toHaveLength(1); // read again, not made again
    expect(calls(asked, `GET /api/edit/jobs/${JOB}`)).toHaveLength(3);
  });

  it("whose job is not there could not be made; Try again asks for the video anew", async () => {
    const asked = await cutMade({
      "POST /api/edit/agent": [answer("Cut.", FIRST)],
      "POST /api/edit/renders": [started(), started("44444444-4444-4444-8444-444444444444")],
      [`GET /api/edit/jobs/${JOB}`]: [refused(404, "no such job")],
      "GET /api/edit/jobs/44444444-4444-4444-8444-444444444444": [MADE],
    });
    download();
    expect(await under().findByRole("alert")).toHaveTextContent(NOT_MADE);
    expect(field()).toBeEnabled();
    fireEvent.click(under().getByRole("button", { name: "Try again" }));
    expect(await under().findByRole("link", { name: "Save video" })).toBeInTheDocument();
    expect(calls(asked, "POST /api/edit/renders")).toHaveLength(2);
  });

  it("that the route refuses to start says the route's sentence, and Try again asks again", async () => {
    const asked = await cutMade({
      "POST /api/edit/agent": [answer("Cut.", FIRST)],
      "POST /api/edit/renders": [refused(409, "a render of yours is already running; try again when it ends"), started()],
      [`GET /api/edit/jobs/${JOB}`]: [MADE],
    });
    download();
    expect(await under().findByRole("alert")).toHaveTextContent("A render of yours is already running; try again when it ends.");
    fireEvent.click(under().getByRole("button", { name: "Try again" }));
    expect(await under().findByRole("link", { name: "Save video" })).toBeInTheDocument();
    expect(calls(asked, "POST /api/edit/renders")).toHaveLength(2);
  });

  it("can be left by starting over while it is made", async () => {
    await cutMade({
      "POST /api/edit/agent": [answer("Cut.", FIRST)],
      "POST /api/edit/renders": [started()],
      [`GET /api/edit/jobs/${JOB}`]: [RUNNING, RUNNING, RUNNING],
    });
    download();
    await under().findByRole("progressbar", { name: "Making the video" });
    fireEvent.click(under().getByRole("button", { name: "Start over" }));
    fireEvent.click(under().getByRole("button", { name: "Start over" }));
    expect(await screen.findByRole("heading", { name: "How should it look?" })).toBeInTheDocument();
  });
});

describe("a take that cannot be read", () => {
  const TWO = { status: 200, body: { takes: [{ id: TAKE, name: "newest.mp4", status: "ready", ms: 8000, posterUrl: null }, { id: OTHER, name: "older.mp4", status: "ready", ms: 8000, posterUrl: null }] } };

  it("says so, and keeps the row of takes so that another can be picked", async () => {
    network({
      "GET /api/edit/takes": [TWO],
      [`GET /api/edit/takes/${TAKE}`]: [refused(500, "something went wrong")],
      [`GET /api/edit/takes/${OTHER}`]: [{ status: 200, body: { take: { id: OTHER }, asset: asset(OTHER), previewUrl: "https://media.example/older.mp4" } }],
    });
    render(<AgentPage />);
    expect(await screen.findByRole("heading", { name: "Your take is not here yet" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong.");
    const takes = screen.getByRole("group", { name: "Your takes" });
    expect(within(takes).getAllByRole("radio")).toHaveLength(2);
    fireEvent.click(within(takes).getByRole("radio", { name: "older.mp4" }));
    await waitFor(() => expect(make()).toBeEnabled());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("is read again on Try again", async () => {
    const asked = network({ "GET /api/edit/takes": [TAKES, TAKES], [`GET /api/edit/takes/${TAKE}`]: [refused(500, "something went wrong"), READ_TAKE] });
    render(<AgentPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    await waitFor(() => expect(make()).toBeEnabled());
    expect(calls(asked, `GET /api/edit/takes/${TAKE}`)).toHaveLength(2);
  });
});
