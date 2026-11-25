/** @vitest-environment happy-dom */
/**
 * editor-thread.test.tsx — the conversation and the field (plan 2026-11-24-editor-screens-a, Task 12; spec §3 screens 3-5, §5.3,
 * §5.4, E19): the first cut's line with no request above it, a look asked for, a request and its answer with Undo on it, a
 * request out, the chips, a failure with Try again; in the chips' place the card of a thing to check (slice B, Task 9) or a line
 * the page says; the latest exchange kept in view; the field sends on Enter, not on Shift+Enter, and not while off. A box's
 * height is stood in (happy-dom lays nothing out).
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TurnShown } from "@/lib/edit/edit-view";
import type { Finding } from "@/lib/edit/review";
import { EditorField, MOST_REQUEST, type FieldHandle } from "../editor-field";
import type { NextChip } from "../edit-session";
import { EditorThread, requestOf, type ThreadProps } from "../editor-thread";

const FINDING: Finding = { code: "on-face", severity: "error", where: { frame: 180 }, says: "the captions cover the face" };
const TURNS: TurnShown[] = [
  { n: 1, kind: "cut", request: "house", at: null, say: "Cut from 12.7 to 11.3 seconds. Captions and a label are on.", doc: true, findings: [], kept: [] },
  { n: 2, kind: "cut", request: "clean", at: null, say: "Captions and a label are on.", doc: true, findings: [], kept: [] },
  { n: 3, kind: "change", request: "Zoom in here", at: null, say: "Zoomed in from 0:06 to 0:08.", doc: true, findings: [FINDING], kept: [] },
];
const props = (more: Partial<ThreadProps> = {}): ThreadProps => ({
  turns: TURNS, pending: null, undoable: true, onUndo: vi.fn(), chips: [{ kind: "check", count: 1 }, { kind: "ask", text: "Shorter" }], onChip: vi.fn(),
  problem: null, disabled: false, status: null, card: null, ...more,
});
const region = () => screen.getByRole("region", { name: "Your edit's changes" });

afterEach(cleanup);

describe("the conversation", () => {
  it("shows what was asked and what was said, the first cut with no request, a look by its name", () => {
    expect(TURNS.map(requestOf)).toEqual([null, "Look: Clean", "Zoom in here"]);
    render(<EditorThread {...props()} />);
    const turns = within(region()).getAllByRole("listitem");
    expect(turns.map((turn) => turn.textContent)).toEqual([
      "Cut from 12.7 to 11.3 seconds. Captions and a label are on.",
      "Look: CleanCaptions and a label are on.",
      "Zoom in hereZoomed in from 0:06 to 0:08.Undo",
    ]);
  });

  it("puts the moment a request was about before its words, for the request out and for its turn; a request about none has no time (E15)", () => {
    const { rerender } = render(<EditorThread {...props({ turns: TURNS.slice(0, 2), undoable: false, pending: { request: "Zoom in here", at: 186 } })} />);
    const out = within(region()).getAllByRole("listitem").at(-1)!;
    expect(out.textContent).toBe("0:06 · Zoom in hereWorking on it…");
    expect(within(out).getByText("0:06 ·")).toHaveClass("text-foreground-muted", "tabular-nums");
    // The turn that comes back with the moment reads the same; the same request about none reads its words alone.
    rerender(<EditorThread {...props({ turns: [...TURNS.slice(0, 2), { ...TURNS[2]!, at: 186 }] })} />);
    expect(within(region()).getAllByRole("listitem").map((turn) => turn.textContent).at(-1)).toBe("0:06 · Zoom in hereZoomed in from 0:06 to 0:08.Undo");
    rerender(<EditorThread {...props()} />);
    expect(within(region()).getAllByRole("listitem").map((turn) => turn.textContent).at(-1)).toBe("Zoom in hereZoomed in from 0:06 to 0:08.Undo");
    // A look asked for has no moment.
    rerender(<EditorThread {...props({ pending: { request: "Look: Clean", at: null } })} />);
    expect(within(region()).getAllByRole("listitem").at(-1)!.textContent).toBe("Look: CleanWorking on it…");
  });

  it("asks nothing above a word fixed by hand", () => {
    expect(requestOf({ n: 4, kind: "direct", request: null, at: null, say: "Fixed a word.", doc: true, findings: [], kept: [] })).toBeNull();
  });

  it("puts Undo on the latest answer only, and the chips under it", () => {
    const shown = props();
    render(<EditorThread {...shown} />);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(shown.onUndo).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Shorter" }));
    expect(shown.onChip).toHaveBeenCalledWith({ kind: "ask", text: "Shorter" });
  });

  it("keeps the chips on one row that scrolls sideways, each at its own width, however many there are", () => {
    // Four chips are wider than a phone (ruling R30): the row scrolls, it never wraps to a second one. (happy-dom lays nothing
    // out, so the row is read by how it is set.)
    render(<EditorThread {...props({ chips: [{ kind: "check", count: 1 }, { kind: "ask", text: "Shorter" }, { kind: "ask", text: "Bigger captions" }, { kind: "ask", text: "Add zooms" }] })} />);
    const row = document.querySelector<HTMLElement>("[data-part=chips]")!;
    const chips = within(row).getAllByRole("button");
    expect(chips.map((chip) => chip.textContent)).toEqual(["1 to check", "Shorter", "Bigger captions", "Add zooms"]);
    expect(row).toHaveClass("flex", "overflow-x-auto");
    expect(row).not.toHaveClass("flex-wrap");
    for (const chip of chips) expect(chip).toHaveClass("shrink-0", "whitespace-nowrap");
  });

  it("names a step after the change and a change by hand by their words, and hands each to the page (slice B, Task 8)", () => {
    const zoomLess: NextChip = { kind: "step", step: { kind: "zoom", label: "Zoom less", request: "Zoom in less here.", at: 120 } };
    const captionsOn: NextChip = { kind: "hand", text: "Captions on", ops: [{ op: "captions.set", on: true }] };
    const shown = props({ chips: [zoomLess, { kind: "ask", text: "Shorter" }, captionsOn] });
    render(<EditorThread {...shown} />);
    const row = document.querySelector<HTMLElement>("[data-part=chips]")!;
    expect(within(row).getAllByRole("button").map((chip) => chip.textContent)).toEqual(["Zoom less", "Shorter", "Captions on"]);
    fireEvent.click(screen.getByRole("button", { name: "Zoom less" }));
    expect(shown.onChip).toHaveBeenCalledWith(zoomLess);
    fireEvent.click(screen.getByRole("button", { name: "Captions on" }));
    expect(shown.onChip).toHaveBeenCalledWith(captionsOn);
  });

  it("draws a line in the chips' place while one is set, the chips row not drawn, and the chips again once it goes (slice B, Task 8)", () => {
    const line = <p role="status">Reading the video&apos;s style.</p>;
    const { rerender } = render(<EditorThread {...props({ status: line })} />);
    expect(within(region()).getByRole("status")).toHaveTextContent("Reading the video's style.");
    expect(document.querySelector("[data-part=chips]")).toBeNull();
    expect(screen.queryByRole("button", { name: "Shorter" })).toBeNull();
    // It is the conversation's last thing, where the chips were.
    expect(region().lastElementChild).toBe(screen.getByRole("status"));
    rerender(<EditorThread {...props()} />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: "Shorter" })).toBeInTheDocument();
  });

  it("brings the line into view when it comes, as anything new at the conversation's end", () => {
    const { rerender } = render(<EditorThread {...props()} />);
    const box = region();
    Object.defineProperty(box, "scrollHeight", { configurable: true, get: () => 900 });
    box.scrollTop = 0;
    rerender(<EditorThread {...props({ status: <p role="status">Reading the video&apos;s style.</p> })} />);
    expect(box.scrollTop).toBe(900);
  });

  it("puts no Undo on an answer that changed nothing, nor when Undo cannot go back", () => {
    const said: TurnShown = { n: 4, kind: "said", request: "Make it purple", at: null, say: "Colours are not something I can change yet.", doc: false, findings: [], kept: [] };
    const { rerender } = render(<EditorThread {...props({ turns: [...TURNS, said] })} />);
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    rerender(<EditorThread {...props({ undoable: false })} />);
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("rests Undo and the chips while off", () => {
    render(<EditorThread {...props({ disabled: true })} />);
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Shorter" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /1 to check/ })).toBeDisabled();
  });

  it("draws the card of a thing to check in the chips' place, before a line the page says, and the chips again once it closes (slice B, Task 9)", () => {
    const card = <div role="group" aria-label="Things to check">The captions cover your face here.</div>;
    const line = <p role="status">Reading the video&apos;s style.</p>;
    const { rerender } = render(<EditorThread {...props({ card, status: line })} />);
    // The card stands where the chips were, the conversation's last thing; the line waits behind it.
    expect(region().lastElementChild).toBe(screen.getByRole("group", { name: "Things to check" }));
    expect(screen.queryByRole("status")).toBeNull();
    expect(document.querySelector("[data-part=chips]")).toBeNull();
    // A failure is said above it, where it is read.
    rerender(<EditorThread {...props({ card, problem: { text: "That is not among the things to check.", again: null } })} />);
    expect(region().lastElementChild).toBe(screen.getByRole("group", { name: "Things to check" }));
    expect(screen.getByRole("alert").nextElementSibling).toBe(screen.getByRole("group", { name: "Things to check" }));
    // Closed: the line again while it is set, else the chips.
    rerender(<EditorThread {...props({ status: line })} />);
    expect(screen.queryByRole("group", { name: "Things to check" })).toBeNull();
    expect(screen.getByRole("status")).toBeInTheDocument();
    rerender(<EditorThread {...props()} />);
    expect(screen.getByRole("button", { name: "Shorter" })).toBeInTheDocument();
  });

  it("hands the chip of the things to check to the page, which opens the card from it", () => {
    const shown = props();
    render(<EditorThread {...shown} />);
    const check = screen.getByRole("button", { name: /1 to check/ });
    // The page gives the focus back to it when the card is closed: it is found by its id.
    expect(check).toHaveAttribute("id", "edit-check");
    expect(check).not.toHaveAttribute("aria-expanded");
    fireEvent.click(check);
    expect(shown.onChip).toHaveBeenCalledWith({ kind: "check", count: 1 });
  });

  it("shows a request out with no chips under it, and a failure with Try again", () => {
    const again = vi.fn();
    render(<EditorThread {...props({ pending: { request: "Shorter", at: null }, problem: { text: "Something went wrong.", again } })} />);
    expect(screen.getByText("Working on it…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Shorter" })).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(again).toHaveBeenCalled();
  });

  it("shows a failure that cannot be tried again with no Try again", () => {
    render(<EditorThread {...props({ problem: { text: "This edit is not here.", again: null } })} />);
    expect(screen.getByRole("alert")).toHaveTextContent("This edit is not here.");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("keeps the latest exchange in view when one arrives, and leaves a creator reading older turns where they are", () => {
    const { rerender } = render(<EditorThread {...props({ turns: TURNS.slice(0, 2), undoable: false })} />);
    const box = region();
    Object.defineProperty(box, "scrollHeight", { configurable: true, get: () => 900 });
    // A request goes out: its exchange is the latest.
    rerender(<EditorThread {...props({ turns: TURNS.slice(0, 2), undoable: false, pending: { request: "Zoom in here", at: null } })} />);
    expect(box.scrollTop).toBe(900);
    // The creator scrolls up; a read brings the same turns anew (a new array): nothing moves.
    box.scrollTop = 0;
    rerender(<EditorThread {...props({ turns: TURNS.slice(0, 2).map((turn) => ({ ...turn })), undoable: false, pending: { request: "Zoom in here", at: null } })} />);
    expect(box.scrollTop).toBe(0);
    // Its answer arrives.
    rerender(<EditorThread {...props()} />);
    expect(box.scrollTop).toBe(900);
    // The card of a thing to check opens under it.
    box.scrollTop = 0;
    rerender(<EditorThread {...props({ card: <div role="group" aria-label="Things to check" /> })} />);
    expect(box.scrollTop).toBe(900);
  });

  it("can be scrolled from the keyboard", () => {
    render(<EditorThread {...props()} />);
    expect(region()).toHaveAttribute("tabindex", "0");
  });

  it("announces a request out and then its answer, each once, and nothing for a read that brings the same turns", () => {
    const { rerender } = render(<EditorThread {...props({ turns: TURNS.slice(0, 2), undoable: false })} />);
    const live = region().querySelector("ol")!;
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(live).toHaveAttribute("aria-relevant", "additions");
    // What a polite region with aria-relevant "additions" reads: the nodes added to it, each read once.
    const watch = new MutationObserver(() => {});
    watch.observe(live, { childList: true, subtree: true });
    const added = () => watch.takeRecords().flatMap((record) => [...record.addedNodes].map((node) => node.textContent));
    rerender(<EditorThread {...props({ turns: TURNS.slice(0, 2).map((turn) => ({ ...turn })), undoable: false })} />);
    expect(added()).toEqual([]);
    rerender(<EditorThread {...props({ turns: TURNS.slice(0, 2), undoable: false, pending: { request: "Zoom in here", at: null } })} />);
    expect(added()).toEqual(["Zoom in hereWorking on it…"]);
    rerender(<EditorThread {...props()} />);
    expect(added()).toEqual(["Zoom in hereZoomed in from 0:06 to 0:08.Undo"]);
    watch.disconnect();
  });
});

describe("the field", () => {
  it("sends the request on Enter, breaks the line on Shift+Enter, and sends nothing while off", () => {
    const onSend = vi.fn();
    const { rerender } = render(<EditorField moment={null} onDropMoment={() => {}} text="Zoom in here" onText={() => {}} onSend={onSend} disabled={false} sending={false} />);
    const field = screen.getByRole("textbox", { name: "Ask for a change" });
    fireEvent.keyDown(field, { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("Zoom in here");
    rerender(<EditorField moment={null} onDropMoment={() => {}} text="Zoom in here" onText={() => {}} onSend={onSend} disabled sending={false} />);
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("sends the words trimmed from its button, nothing when there are none, and not while a word is being composed", () => {
    const onSend = vi.fn();
    const { rerender } = render(<EditorField moment={null} onDropMoment={() => {}} text="   " onText={() => {}} onSend={onSend} disabled={false} sending={false} />);
    const field = screen.getByRole("textbox", { name: "Ask for a change" });
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
    rerender(<EditorField moment={null} onDropMoment={() => {}} text="  Shorter  " onText={() => {}} onSend={onSend} disabled={false} sending={false} />);
    fireEvent.keyDown(field, { key: "Enter", isComposing: true });
    // Safari ends a composition with an Enter that is not composing, but is the composer's key (229).
    fireEvent.keyDown(field, { key: "Enter", keyCode: 229 });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onSend).toHaveBeenCalledWith("Shorter");
  });

  it("hands each keystroke to the page, takes no more than a route takes, and rests its send while one is out", () => {
    const onText = vi.fn();
    const { rerender } = render(<EditorField moment={null} onDropMoment={() => {}} text="" onText={onText} onSend={() => {}} disabled={false} sending={false} />);
    const field = screen.getByRole("textbox", { name: "Ask for a change" });
    expect(field).toHaveAttribute("maxlength", String(MOST_REQUEST));
    fireEvent.change(field, { target: { value: "Add zooms" } });
    expect(onText).toHaveBeenCalledWith("Add zooms");
    rerender(<EditorField moment={null} onDropMoment={() => {}} text="Add zooms" onText={onText} onSend={() => {}} disabled={false} sending />);
    const send = screen.getByRole("button", { name: "Send" });
    expect(send).toBeDisabled();
    expect(send).toHaveAttribute("aria-busy", "true");
  });

  it("is focused by the page, and says whether it is", () => {
    const handle = createRef<FieldHandle>();
    render(<EditorField moment={null} onDropMoment={() => {}} ref={handle} text="" onText={() => {}} onSend={() => {}} disabled={false} sending={false} />);
    expect(handle.current!.focused()).toBe(false);
    handle.current!.focus();
    expect(screen.getByRole("textbox", { name: "Ask for a change" })).toHaveFocus();
    expect(handle.current!.focused()).toBe(true);
  });

  it("puts the caret at the end of the words on a press anywhere on the pill, but not on a press on Send", () => {
    const onSend = vi.fn();
    const { rerender } = render(<EditorField moment={null} onDropMoment={() => {}} text="Shorter" onText={() => {}} onSend={onSend} disabled={false} sending={false} />);
    const field = screen.getByRole("textbox", { name: "Ask for a change" }) as HTMLTextAreaElement;
    const pill = field.closest<HTMLElement>("[data-part='field']")!;
    fireEvent.click(pill);
    expect(field).toHaveFocus();
    expect([field.selectionStart, field.selectionEnd]).toEqual([7, 7]);
    // Pressed again while in it: the caret stays where the creator put it.
    field.setSelectionRange(2, 2);
    fireEvent.click(pill);
    expect([field.selectionStart, field.selectionEnd]).toEqual([2, 2]);
    field.blur();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onSend).toHaveBeenCalledWith("Shorter");
    expect(field).not.toHaveFocus();
    // Off, the pill takes no press.
    rerender(<EditorField moment={null} onDropMoment={() => {}} text="Shorter" onText={() => {}} onSend={onSend} disabled sending={false} />);
    fireEvent.click(pill);
    expect(field).not.toHaveFocus();
  });

  it("shows the moment the request is about as a tag first in the pill, taken away by a press on it or Backspace at the field's start (E15)", () => {
    const onDropMoment = vi.fn();
    const moment = { frame: 186, label: "0:06" };
    const at = (text: string, more: { disabled?: boolean; moment?: typeof moment | null } = {}) => (
      <EditorField text={text} onText={() => {}} onSend={() => {}} disabled={more.disabled ?? false} sending={false} moment={more.moment === undefined ? moment : more.moment} onDropMoment={onDropMoment} />
    );
    const { rerender } = render(at(""));
    const tag = screen.getByRole("button", { name: "Remove the moment at 0:06" });
    expect(tag.textContent).toBe("0:06");
    expect(tag.closest("[data-part='field']")!.firstElementChild).toBe(tag);
    // Drawn as the drawing's `.field .at`: 28 tall, fully round, sunken, 13 semibold with figures of one width, 10 at the sides.
    expect(tag).toHaveClass("tap-44", "h-7", "rounded-full", "bg-surface-sunken", "px-2.5", "text-meta", "font-[600]", "tabular-nums");
    const field = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Ask for a change" });
    expect(field).toHaveAccessibleDescription("This request is about the moment at 0:06.");

    fireEvent.click(tag);
    expect(onDropMoment).toHaveBeenCalledTimes(1);
    // The button goes away with the moment: the focus is the field's, not the page's body.
    expect(field).toHaveFocus();
    fireEvent.keyDown(field, { key: "Backspace" });
    expect(onDropMoment).toHaveBeenCalledTimes(2);
    // With words: Backspace takes a letter, or the words selected; only at the very start with nothing selected the moment.
    rerender(at("Zoom"));
    field.setSelectionRange(4, 4);
    fireEvent.keyDown(field, { key: "Backspace" });
    field.setSelectionRange(0, 4);
    fireEvent.keyDown(field, { key: "Backspace" });
    expect(onDropMoment).toHaveBeenCalledTimes(2);
    field.setSelectionRange(0, 0);
    fireEvent.keyDown(field, { key: "Backspace" });
    expect(onDropMoment).toHaveBeenCalledTimes(3);
    // Off, the tag rests with the field.
    rerender(at("Zoom", { disabled: true }));
    expect(screen.getByRole("button", { name: "Remove the moment at 0:06" })).toBeDisabled();
    // No moment: no tag, nothing describes the field, and Backspace is the field's own.
    rerender(at("", { moment: null }));
    expect(screen.queryByRole("button", { name: /Remove the moment/ })).toBeNull();
    expect(field).not.toHaveAttribute("aria-describedby");
    fireEvent.keyDown(field, { key: "Backspace" });
    expect(onDropMoment).toHaveBeenCalledTimes(3);
  });

  it("takes requests as long as the routes take them", async () => {
    const { MOST } = await import("@/app/api/edit/agent-calls");
    expect(MOST_REQUEST).toBe(MOST.request);
  });
});
