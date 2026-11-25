/** @vitest-environment happy-dom */
/**
 * editor-a11y.test.tsx — the editor by keyboard and screen reader (plan 2026-11-24-editor-screens-a, Task 17; spec §5.2): the
 * scrubber's keys; what is read aloud (the page opening, the wait's stage as it changes and not its time left); a sheet closed
 * by Escape; the focus order; where the focus goes (to the field when the cut lands, to the panel instead on a touch screen,
 * back to the control a sheet or a call took it from, never away from where the creator put it); every control named.
 * Everything of ours is real, the uploads' holder too; the network is stood in with the routes' answers (views of real edits,
 * `views.ts`), and what happy-dom lacks (fonts, a touch screen) is stood in. Pinned elsewhere: the conversation read as it
 * grows (`editor-thread.test.tsx`), Escape in a word being typed (`sheets.test.tsx`).
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }), usePathname: () => "/edit/e" }));

import type { EditView, TurnShown } from "@/lib/edit/edit-view";
import { renderWithClient } from "@/test/render-with-client";
import { EditorScreen } from "../editor-screen";
import { EditorScrubber } from "../editor-scrubber";
import { forgetUpload, startUpload, type UploadDeps } from "../uploads";
import { ASSET, EDIT_ID, FIRST, changed, viewOf } from "./views";

/** No captions: happy-dom loads no font to measure them with. */
const QUIET = changed(FIRST, [{ op: "captions.set", on: false }]);
const SHORT = changed(QUIET, [{ op: "shot.trim", id: "s1", endMs: 10_000 }]);
const base = `/api/edit/edits/${EDIT_ID}`;
const shown = (more: Partial<EditView> = {}) => viewOf({ edit: QUIET, ...more });
const turn = (n: number, more: Partial<TurnShown>): TurnShown => ({ n, kind: "change", request: null, at: null, say: "", doc: true, findings: [], kept: [], ...more });
/** The edit after "Shorter": turn 2, the shorter cut. */
const two = (more: Partial<EditView> = {}) => shown({ edit: SHORT, head: 2, shown: 2, undo: 1, turns: [...viewOf().turns, turn(2, { request: "Shorter", say: "Cut it to 10 seconds." })], ...more });
/** The take as it stands before its first cut. */
const before = (status: "uploading" | "analysing" | "ready", more: Partial<EditView["take"]> = {}) =>
  viewOf({
    take: { ...viewOf().take, status, ...(status === "ready" ? {} : { previewUrl: null, posterUrl: null, asset: null, ms: null }), ...more },
    look: null, head: null, shown: null, edit: null, turns: [],
  });

type Answer = { status: number; body: unknown };
/** The network: each call's answers in order (one may come later), then the one kept for it. */
function network(answers: Record<string, (Answer | Promise<Answer>)[]>, keep: Record<string, Answer> = {}) {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith("/edit/fonts/")) return new Response(new ArrayBuffer(8));
    if (!path.startsWith("/api/")) return new Response(null, { status: 404 });
    const call = `${init?.method ?? "GET"} ${path}`;
    const next = (await answers[call]?.shift()) ?? keep[call];
    if (!next) throw new Error(`no answer for ${call}`);
    return new Response(JSON.stringify(next.body), { status: next.status, headers: { "Content-Type": "application/json" } });
  }));
}
const ok = (view: EditView): Answer => ({ status: 200, body: view });
/** An answer that comes when the test says so. */
function later() {
  let give!: (answer: Answer) => void;
  const answer = new Promise<Answer>((resolve) => (give = resolve));
  return { answer, give };
}
const open = (pollMs = 5) => renderWithClient(<EditorScreen id={EDIT_ID} pollMs={pollMs} />);
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const field = () => screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Ask for a change" });
const panel = () => screen.getByRole("region", { name: "Your edit" });
/** Radix gives the focus away a tick after a sheet's content has gone: what holds the focus is read after that. */
const settled = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
/**
 * A browser lets go of the focus of a control that is turned off (HTML's focus fixup: it is then on the page's body). happy-dom
 * keeps it there and will not blur a control that is off, so the control is blurred as if it were on, and is off again.
 */
const letGo = (control: HTMLButtonElement | HTMLTextAreaElement) =>
  act(() => {
    control.disabled = false;
    control.blur();
    control.disabled = true;
  });

/** A touch screen: its main pointer is a finger. */
function touchScreen() {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) => ({ matches: query === "(pointer: coarse)", media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false }) as MediaQueryList,
  );
}

/** What a control is called by assistive tech, as far as this page names its controls: its label, else its words. */
function nameOf(element: Element): string {
  const labelled = element.getAttribute("aria-labelledby");
  if (labelled) return document.getElementById(labelled)?.textContent?.trim() ?? "";
  return element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "";
}
const CONTROLS = "button, [role=slider], [role=switch], textarea, input, a[href]";

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
  forgetUpload(ASSET.id);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("the scrubber by keyboard", () => {
  it("moves a second with the arrows, five with Page Up and Page Down, to the ends with Home and End", () => {
    const onSeek = vi.fn();
    render(<EditorScrubber frames={381} frame={60} marks={[]} onSeek={onSeek} />);
    const slider = screen.getByRole("slider", { name: "Playhead" });
    for (const [key, to] of [["ArrowRight", 90], ["ArrowLeft", 30], ["ArrowUp", 90], ["ArrowDown", 30], ["PageUp", 210], ["PageDown", 0], ["Home", 0], ["End", 380]] as const) {
      // The slider's own key: the page does not scroll with it (the default is prevented).
      expect(fireEvent.keyDown(slider, { key })).toBe(false);
      expect(onSeek).toHaveBeenLastCalledWith(to);
    }
    expect(onSeek).toHaveBeenCalledTimes(8);
  });

  it("moves from the film's last frame when the take has played past it, and leaves every other key to the page", () => {
    const onSeek = vi.fn();
    render(<EditorScrubber frames={381} frame={381} marks={[]} onSeek={onSeek} />);
    const slider = screen.getByRole("slider", { name: "Playhead" });
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(onSeek).toHaveBeenLastCalledWith(350);
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(onSeek).toHaveBeenLastCalledWith(380);
    for (const key of ["Tab", " ", "Enter", "a"]) expect(fireEvent.keyDown(slider, { key })).toBe(true);
    expect(onSeek).toHaveBeenCalledTimes(2);
  });

  it("leaves a key held with Alt, Ctrl or Cmd to the browser (Back and Forward), and takes one with Shift", () => {
    const onSeek = vi.fn();
    render(<EditorScrubber frames={381} frame={60} marks={[]} onSeek={onSeek} />);
    const slider = screen.getByRole("slider", { name: "Playhead" });
    for (const held of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }]) {
      for (const key of ["ArrowLeft", "ArrowRight", "Home", "End", "PageUp"]) expect(fireEvent.keyDown(slider, { key, ...held })).toBe(true);
    }
    expect(onSeek).not.toHaveBeenCalled();
    expect(fireEvent.keyDown(slider, { key: "ArrowRight", shiftKey: true })).toBe(false);
    expect(onSeek).toHaveBeenLastCalledWith(90);
  });

  it("does nothing while off", () => {
    const onSeek = vi.fn();
    render(<EditorScrubber frames={381} frame={60} marks={[]} disabled onSeek={onSeek} />);
    fireEvent.keyDown(screen.getByRole("slider", { name: "Playhead" }), { key: "ArrowRight" });
    expect(onSeek).not.toHaveBeenCalled();
  });
});

describe("what is read aloud", () => {
  it("says the page is opening while the edit is read, with no spinner drawn", async () => {
    const read = later();
    network({ [`GET ${base}`]: [read.answer] });
    open();
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Opening your edit…");
    expect(status).toHaveClass("sr-only");
    await act(async () => read.give(ok(shown())));
    await screen.findByText("Captions are on.");
    expect(screen.queryByText("Opening your edit…")).toBeNull();
  });

  it("reads the wait's stage, not its time left, which changes each second", async () => {
    let clock = 0;
    const deps: UploadDeps = {
      objectUrl: () => "blob:local/1", revoke: () => {}, now: () => clock,
      put: (_url, _file, onSent) => {
        clock = 2000;
        onSent(1000); // a tenth of it in two seconds: twenty more for the rest
        return new Promise(() => {});
      },
    };
    startUpload({ id: ASSET.id, uploadUrl: "https://r2.test/put", type: "video/mp4" }, new File([new Uint8Array(11_000)], "take.mp4", { type: "video/mp4" }), deps);
    network({ [`GET ${base}`]: [ok(before("uploading"))] });
    open();
    const label = await screen.findByText("Uploading");
    expect(label).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("20 seconds left").closest("[aria-live]")).toBeNull();
  });

  it("reads the wait's next stage in the same words' place: listened to, then the first cut being made", async () => {
    const ready = later();
    network({ [`GET ${base}`]: [ok(before("analysing", { progress: 0.4 })), ready.answer], [`POST ${base}/cut`]: [new Promise<Answer>(() => {})] });
    open();
    const label = await screen.findByText("Listening to it");
    expect(label).toHaveAttribute("aria-live", "polite");
    await act(async () => ready.give(ok(before("ready"))));
    // The live words that were there say the new stage: a region put in with its words would not be read.
    await waitFor(() => expect(label).toHaveTextContent("Making the first cut"));
    expect(label).toBeInTheDocument();
  });
});

describe("a sheet", () => {
  it("closes on Escape and gives the focus back to the control it was opened from", async () => {
    network({ [`GET ${base}`]: [ok(shown())] });
    open();
    await screen.findByText("Captions are on.");
    for (const name of ["Look", "Captions"]) {
      button(name).focus();
      fireEvent.click(button(name));
      const sheet = await screen.findByRole("dialog", { name });
      await waitFor(() => expect(sheet.contains(document.activeElement)).toBe(true));
      fireEvent.keyDown(document.activeElement!, { key: "Escape" });
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      await settled();
      expect(document.activeElement).toBe(button(name));
    }
  });

  it("closed by a look picked rests its opener while the cut is made: the panel holds the focus, the opener has it back when the cut lands", async () => {
    const cut = later();
    network({ [`GET ${base}`]: [ok(shown())], [`POST ${base}/cut`]: [cut.answer] });
    open();
    await screen.findByText("Captions are on.");
    button("Look").focus();
    fireEvent.click(button("Look"));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Look" })).getByRole("button", { name: "Clean" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await settled();
    expect(button("Look")).toBeDisabled();
    expect(document.activeElement).toBe(panel());
    await act(async () => cut.give(ok(shown({ look: "clean", head: 2, shown: 2, undo: 1, turns: [...viewOf().turns, turn(2, { kind: "cut", request: "clean", say: "Captions are on." })] }))));
    await waitFor(() => expect(document.activeElement).toBe(button("Look")));
  });
});

describe("the focus", () => {
  it("goes through the header, the video, the tools, the chips and the field, in that order", async () => {
    network({ [`GET ${base}`]: [ok(shown())] });
    open();
    await screen.findByText("Captions are on.");
    const wanted = ["Back", "Export", "Play", "Mute", "Playhead", "Look", "Captions", "Shorter", "Ask for a change"];
    const focusable = [...document.querySelectorAll("[data-part=editor] button:not([disabled]), [data-part=editor] textarea:not([disabled]), [data-part=editor] [role=slider][tabindex='0']")].map(nameOf);
    expect(focusable.filter((name) => wanted.includes(name))).toEqual(wanted);
  });

  it("goes to the field when the cut lands, and to the panel on a touch screen, so no keyboard opens over the video", async () => {
    const cut = later();
    network({ [`GET ${base}`]: [ok(before("ready"))], [`POST ${base}/cut`]: [cut.answer] });
    const first = open();
    expect(await screen.findByText("Making the first cut")).toBeInTheDocument();
    await act(async () => cut.give(ok(shown())));
    await screen.findByText("Captions are on.");
    await waitFor(() => expect(document.activeElement).toBe(field()));
    first.unmount();

    touchScreen();
    network({ [`GET ${base}`]: [ok(shown())] });
    open();
    await screen.findByText("Captions are on.");
    await waitFor(() => expect(document.activeElement).toBe(panel()));
    await settled();
    expect(document.activeElement).toBe(panel());
  });

  it("is given back to the field when a change sent from it is answered, and to the panel on a touch screen", async () => {
    for (const touch of [false, true]) {
      if (touch) touchScreen();
      const change = later();
      network({ [`GET ${base}`]: [ok(shown())], [`POST ${base}/change`]: [change.answer] });
      const page = open();
      await screen.findByText("Captions are on.");
      field().focus();
      fireEvent.change(field(), { target: { value: "Shorter" } });
      fireEvent.keyDown(field(), { key: "Enter" });
      await waitFor(() => expect(field()).toBeDisabled());
      await letGo(field());
      await act(async () => change.give(ok(two())));
      await screen.findByText("Cut it to 10 seconds.");
      await waitFor(() => expect(document.activeElement).toBe(touch ? panel() : field()));
      page.unmount();
    }
  });

  it("goes where the work is when the control that sent a call is off once it is answered", async () => {
    const move = later();
    network({ [`GET ${base}`]: [ok(two())], [`POST ${base}/head`]: [move.answer] });
    open();
    await screen.findByText("Cut it to 10 seconds.");
    const undo = screen.getAllByRole<HTMLButtonElement>("button", { name: "Undo" })[0]!;
    undo.focus();
    fireEvent.click(undo);
    await waitFor(() => expect(undo).toBeDisabled());
    await letGo(undo);
    // Back on the first cut there is nothing more to undo: Undo stays off, and the field takes the focus.
    await act(async () => move.give(ok(shown({ redo: 2 }))));
    await waitFor(() => expect(button("Redo")).toBeEnabled());
    expect(undo).toBeDisabled();
    expect(document.activeElement).toBe(field());
  });

  it("is left where the creator put it while a call was out: on the video, or on the app's own navigation", async () => {
    for (const elsewhere of [() => screen.getByRole("button", { name: /^(Play|Pause)$/ }), () => screen.getByRole("link", { name: "Home" })]) {
      const change = later();
      network({ [`GET ${base}`]: [ok(shown())], [`POST ${base}/change`]: [change.answer] });
      // The shell's navigation sits outside the editor's own element.
      const page = renderWithClient(
        <>
          <a href="/home">Home</a>
          <EditorScreen id={EDIT_ID} pollMs={5} />
        </>,
      );
      await screen.findByText("Captions are on.");
      field().focus();
      fireEvent.change(field(), { target: { value: "Shorter" } });
      fireEvent.keyDown(field(), { key: "Enter" });
      await waitFor(() => expect(field()).toBeDisabled());
      await letGo(field());
      elsewhere().focus();
      await act(async () => change.give(ok(two())));
      await screen.findByText("Cut it to 10 seconds.");
      await settled();
      expect(document.activeElement).toBe(elsewhere());
      page.unmount();
    }
  });
});

describe("the moment a request is about (E15)", () => {
  it("is a named button just before the field, which it describes; Backspace at the field's start takes it away, the focus kept in the field", async () => {
    network({ [`GET ${base}`]: [ok(shown())] });
    open();
    await screen.findByText("Captions are on.");
    const slider = screen.getByRole("slider", { name: "Playhead" });
    await waitFor(() => expect(slider).toHaveAttribute("aria-valuenow", "15"));
    expect(field()).not.toHaveAttribute("aria-describedby");
    // Paused a second on, by the scrubber's own key.
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    const tag = await screen.findByRole("button", { name: "Remove the moment at 0:01" });
    expect(tag.textContent).toBe("0:01");
    expect(field()).toHaveAccessibleDescription("This request is about the moment at 0:01.");
    // In the focus order after the chips, first in the field.
    const wanted = ["Add zooms", "Remove the moment at 0:01", "Ask for a change"];
    const focusable = [...document.querySelectorAll("[data-part=editor] button:not([disabled]), [data-part=editor] textarea:not([disabled])")].map(nameOf);
    expect(focusable.filter((name) => wanted.includes(name))).toEqual(wanted);
    field().focus();
    fireEvent.keyDown(field(), { key: "Backspace" });
    await waitFor(() => expect(screen.queryByRole("button", { name: /^Remove the moment/ })).toBeNull());
    expect(document.activeElement).toBe(field());
    expect(field()).not.toHaveAttribute("aria-describedby");
  });
});

describe("the card of a thing to check (E18)", () => {
  it("takes the focus from the chip that opened it, goes through its actions, and gives the focus back to that chip on Escape", async () => {
    const bars = { code: "under-buttons" as const, severity: "error" as const, where: { frame: 60, shot: "s1" }, says: "the captions sit under TikTok's bottom bar" };
    const face = { code: "on-face" as const, severity: "error" as const, where: { frame: 180, shot: "s1" }, says: "the captions cover the mouth" };
    network({ [`GET ${base}`]: [ok(shown({ turns: [{ ...viewOf().turns[0]!, findings: [bars, face] }] }))] });
    open();
    const check = await screen.findByRole("button", { name: "2 to check" });
    check.focus();
    fireEvent.click(check);
    // The chip goes as the card opens: the card has the focus, named and described by what it says.
    const card = screen.getByRole("group", { name: "Things to check" });
    expect(document.activeElement).toBe(card);
    expect(card).toHaveAccessibleDescription("0:02 · The captions sit under the app's buttons here.");
    expect(card).toHaveAttribute("aria-live", "polite");
    const inCard = [...card.querySelectorAll("button:not([disabled])")].map(nameOf);
    expect(inCard).toEqual(["Close", "Move them clear of the app's buttons", "Keep it", "Next, 2 of 2"]);
    // Escape with the focus on one of its actions closes it; the focus is back on the chip it was opened from.
    within(card).getByRole("button", { name: "Keep it" }).focus();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("group", { name: "Things to check" })).toBeNull();
    expect(document.activeElement).toBe(button("2 to check"));
  });
});

describe("every control", () => {
  it("is named, on the page and in its sheets", async () => {
    const found = turn(2, { request: "Shorter", say: "Cut it to 10 seconds.", findings: [{ code: "on-face", severity: "error", where: { frame: 180 }, says: "the captions cover the face" }] });
    network({ [`GET ${base}`]: [ok(two({ turns: [...viewOf().turns, found] }))] });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "1 to check" }));
    const unnamed = (scope: ParentNode) => [...scope.querySelectorAll(CONTROLS)].filter((control) => nameOf(control) === "").map((control) => control.outerHTML.slice(0, 120));
    expect(unnamed(document.querySelector("[data-part=editor]")!)).toEqual([]);
    for (const name of ["Look", "Captions"]) {
      fireEvent.click(button(name));
      const sheet = await screen.findByRole("dialog", { name });
      expect(unnamed(sheet)).toEqual([]);
      // Each of the Look sheet's ways opened in turn, so its fields are there to be read.
      for (const way of within(sheet).queryAllByRole("button", { expanded: false })) {
        fireEvent.click(way);
        expect(unnamed(sheet)).toEqual([]);
      }
      fireEvent.keyDown(document.activeElement!, { key: "Escape" });
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    }
  });
});
