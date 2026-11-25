/** @vitest-environment happy-dom */
/**
 * parts.test.tsx — the page's parts as a creator meets them (Task 13b), each rendered for real: the four rows and the button
 * that waits for them, the match row's marks, the thread (an answer that changed nothing among them), the field, the things to
 * check, and the row under the phone. Nothing here is stood in: the parts call no route; the page's calls are tested apart.
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Edit } from "@/lib/edit";
import type { Finding } from "@/lib/edit/review";
import { PRESETS, presetOf } from "@/lib/edit/style/presets";
import type { Download } from "../download";
import { Findings } from "../Findings";
import { MatchRow } from "../MatchRow";
import { FIRST } from "../picking";
import { RequestField, Suggestions } from "../RequestField";
import type { Answer, Turn } from "../session";
import { StylePicker, type Picked } from "../StylePicker";
import { Thread } from "../Thread";
import { UnderPhone } from "../UnderPhone";

afterEach(cleanup);

/** The picker with the page's part of it: what is picked is kept. */
function Picker(props: Partial<Parameters<typeof StylePicker>[0]> & { onMake?: () => void; seen?: (picked: Picked) => void }) {
  const [picking, setPicking] = useState<Picked>({ ...FIRST, file: null });
  props.seen?.(picking);
  return <StylePicker picking={picking} onPick={setPicking} waiting={false} working={null} problem={null} onMake={props.onMake ?? (() => {})} {...props} />;
}
const make = () => screen.getByRole("button", { name: "Make the first cut" });
const row = (name: string) => screen.getByRole("radio", { name: new RegExp(`^${name}`) });

describe("How should it look?", () => {
  it("asks, with four rows in one group, and opens with our pick chosen and no field open", () => {
    render(<Picker />);
    expect(screen.getByRole("heading", { name: "How should it look?" })).toBeInTheDocument();
    const rows = within(screen.getByRole("group", { name: "How should it look?" })).getAllByRole("radio");
    expect(rows.map((one) => (one as HTMLInputElement).name)).toEqual(["look", "look", "look", "look"]);
    expect(rows.map((one) => (one as HTMLInputElement).checked)).toEqual([true, false, false, false]);
    expect(row("Our pick")).toBeChecked();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("makes the first cut in our pick with one tap, as the page opens", () => {
    const onMake = vi.fn();
    let picked: Picked | null = null;
    render(<Picker onMake={onMake} seen={(now) => (picked = now)} />);
    expect(make()).toBeEnabled();
    fireEvent.click(make());
    expect(onMake).toHaveBeenCalledOnce();
    expect(picked).toMatchObject({ choice: "pick" });
  });

  it("opens the chosen row's field only, and keeps the button off until the row has what it needs", () => {
    let picked: Picked | null = null;
    render(<Picker seen={(now) => (picked = now)} />);
    expect(screen.queryByRole("textbox")).toBeNull();

    fireEvent.click(row("Like a video"));
    expect(make()).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "A TikTok link" }), { target: { value: "https://www.tiktok.com/@someone/video/7300000000000000000" } });
    expect(make()).toBeEnabled();

    fireEvent.click(row("A preset"));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(make()).toBeDisabled();
    const presets = screen.getByRole("radiogroup", { name: "Presets" });
    expect(within(presets).getAllByRole("radio").map((chip) => chip.parentElement?.textContent)).toEqual(PRESETS.map((preset) => preset.name));
    fireEvent.click(within(presets).getByRole("radio", { name: presetOf("clean")!.name }));
    expect(picked).toMatchObject({ choice: "preset", preset: "clean" });
    expect(screen.getByText(presetOf("clean")!.description)).toBeInTheDocument();
    expect(make()).toBeEnabled();

    fireEvent.click(row("In your words"));
    expect(make()).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "The look in your words" }), { target: { value: "fast with zooms" } });
    expect(make()).toBeEnabled();
  });

  it("offers Bold pop last among the presets", () => {
    render(<Picker />);
    fireEvent.click(row("A preset"));
    const chips = within(screen.getByRole("radiogroup", { name: "Presets" })).getAllByRole("radio");
    expect(chips.at(-1)?.parentElement?.textContent).toBe("Bold pop");
  });

  it("says a link is not TikTok's once the field is left, not at every letter", () => {
    render(<Picker />);
    fireEvent.click(row("Like a video"));
    const link = screen.getByRole("textbox", { name: "A TikTok link" });
    fireEvent.change(link, { target: { value: "https://example.com/video" } });
    expect(screen.queryByText("That is not a link to a TikTok video.")).toBeNull();
    fireEvent.blur(link);
    expect(screen.getByText("That is not a link to a TikTok video.")).toBeInTheDocument();
    expect(make()).toBeDisabled();
  });

  it("shows a file chosen by its name in the link's place, and lets it be taken away", () => {
    render(<Picker />);
    fireEvent.click(row("Like a video"));
    fireEvent.change(screen.getByLabelText("A video to upload"), { target: { files: [new File(["x"], "reference clip.mp4", { type: "video/mp4" })] } });
    expect(screen.getByText("reference clip.mp4")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "A TikTok link" })).toBeNull();
    expect(make()).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Take the video away" }));
    expect(screen.getByRole("textbox", { name: "A TikTok link" })).toBeInTheDocument();
    expect(make()).toBeDisabled();
  });

  it("gives the button's place to one line and a bar while the cut is made, with every row off", () => {
    render(<Picker working={{ stage: "Cutting your take…", share: 0.9, reading: false }} />);
    expect(screen.queryByRole("button", { name: "Make the first cut" })).toBeNull();
    expect(screen.getByText("Cutting your take…")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "The first cut" })).toHaveAttribute("aria-valuenow", "90");
    expect(screen.getByRole("group", { name: "How should it look?" })).toBeDisabled();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it("keeps the rows on while a video's style is read, so that another can be picked", () => {
    let picked: Picked | null = null;
    render(<Picker working={{ stage: "Reading its cuts…", share: 0.5, reading: true }} seen={(now) => (picked = now)} />);
    expect(screen.getByText("Reading its cuts…")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "The first cut" })).toHaveAttribute("aria-valuenow", "50");
    expect(screen.getByRole("group", { name: "How should it look?" })).toBeEnabled();
    fireEvent.click(row("In your words"));
    expect(picked).toMatchObject({ choice: "words" });
  });

  it("shows a failure as one sentence under the button, with a way to try again", () => {
    const onMake = vi.fn();
    render(<Picker problem="The editor could not be reached. Check your connection." onMake={onMake} />);
    expect(screen.getByRole("alert")).toHaveTextContent("The editor could not be reached. Check your connection.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onMake).toHaveBeenCalledOnce();
  });

  it("offers to try again only while that can be done: not for a row that has not what it needs", () => {
    const onMake = vi.fn();
    render(<Picker problem="That is not a video we could read." onMake={onMake} />);
    fireEvent.click(row("Like a video")); // no link, no file
    expect(screen.getByRole("alert")).toHaveTextContent("That is not a video we could read.");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(make()).toBeDisabled();
    expect(onMake).not.toHaveBeenCalled();
  });

  it("gives the keyboard's focus back to the button when the work ends without a cut", () => {
    const { rerender } = render(<Picker working={{ stage: "Cutting your take…", share: null, reading: false }} />);
    expect(document.activeElement).toBe(document.body);
    rerender(<Picker problem="Something went wrong." />);
    expect(make()).toHaveFocus();
  });

  it("keeps the button off while the take is not here yet", () => {
    render(<Picker waiting />);
    expect(row("Our pick")).toBeChecked();
    expect(make()).toBeDisabled();
  });

  it("says what our pick is, and draws its sample at the house's weight (Task 8)", () => {
    render(<Picker />);
    const label = row("Our pick").closest("label")!;
    expect(label).toHaveTextContent("Clean white captions and a label that stays.");
    const words = label.querySelector<HTMLElement>('[data-sample="look"] > span > span');
    expect(words?.style.fontWeight).toBe("600");
  });
});

describe("the match row", () => {
  const match = {
    fields: [
      { field: "pace.pauseMs", target: "320 ms", actual: "320 ms", verdict: "matched" as const },
      { field: "captions.size", target: "96 px", actual: "82 px", verdict: "near" as const },
      { field: "title", target: "2.5 s at 0.2", actual: "2.5 s at 0.2", verdict: "matched" as const },
      { field: "punchIns.perMin", target: "14 a minute", actual: "5.54 a minute", verdict: "not" as const },
      { field: "look.preset", target: "natural", actual: "natural", verdict: "matched" as const },
    ],
    notMatched: ["emoji", "clips cut in"],
  };

  it("shows the five marks, each saying how close it is, and what the kit cannot draw", () => {
    render(<MatchRow match={match} />);
    const marks = within(screen.getByRole("group", { name: "How close the cut is to the style" })).getAllByRole("button");
    expect(marks.map((mark) => [mark.textContent, mark.dataset.verdict])).toEqual([
      ["Pace, as asked", "matched"], ["Captions, close", "near"], ["Title, as asked", "matched"], ["Zooms, not as asked", "not"], ["Look, as asked", "matched"],
    ]);
    expect(screen.getByText("Not in the kit yet: emoji, clips cut in.")).toBeInTheDocument();
  });

  it("opens one line under the row for a mark, one at a time, and closes it again", () => {
    render(<MatchRow match={match} />);
    const captions = screen.getByRole("button", { name: /^Captions/ });
    const zooms = screen.getByRole("button", { name: /^Zooms/ });
    expect(captions).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(captions);
    expect(captions).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Captions: asked 96 px, set at 82 px.")).toBeVisible();
    fireEvent.click(zooms);
    expect(captions).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Zooms: asked 14 a minute, made 5.5.")).toBeVisible();
    fireEvent.click(zooms);
    expect(screen.queryByText(/^Zooms: /)).toBeNull();
  });
});

const answer = (say: string, changed = true): Answer => ({ say, edit: {} as Edit, findings: [], rounds: 1, ms: 1000, cost: 0.01, changed, match: null, style: null, styleSay: null });

describe("the thread", () => {
  const turns: Turn[] = [
    { request: "Black and white", answer: answer("The video is now black and white.") },
    { request: "Bigger captions", answer: answer("I couldn't make that change: it would cover your face.", false) },
  ];

  it("shows each request with its answer under it, in order", () => {
    render(<Thread turns={turns} pending={null} disabled={false} onUndo={() => {}} />);
    const items = within(screen.getByRole("list", { name: "Your changes" })).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["Black and whiteThe video is now black and white.Undo", "Bigger captionsI couldn't make that change: it would cover your face."]);
  });

  it("shows an answer that changed nothing as a plain reply: no undo of its own, and no alert", () => {
    const onUndo = vi.fn();
    render(<Thread turns={turns} pending={null} disabled={false} onUndo={onUndo} />);
    expect(screen.getAllByRole("button", { name: "Undo" })).toHaveLength(1);
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledWith(0);
  });

  it("shows a request at once while its answer is out, and holds every undo off", () => {
    render(<Thread turns={turns} pending="Tighter cuts" disabled onUndo={() => {}} />);
    expect(screen.getByText("Tighter cuts")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Making the change…");
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
  });

  it("is not drawn before the first request", () => {
    render(<Thread turns={[]} pending={null} disabled={false} onUndo={() => {}} />);
    expect(screen.queryByRole("list")).toBeNull();
  });
});

describe("ask for a change", () => {
  function Field(props: { onSend: (request: string) => void; disabled?: boolean; problem?: Parameters<typeof RequestField>[0]["problem"] }) {
    const [text, setText] = useState("");
    return (
      <>
        <RequestField text={text} onText={setText} onSend={props.onSend} disabled={props.disabled ?? false} problem={props.problem ?? null} />
        <Suggestions disabled={props.disabled ?? false} onPick={setText} />
      </>
    );
  }
  const field = () => screen.getByRole("textbox", { name: "Ask for a change" });

  it("sends on Enter, trimmed; Shift+Enter breaks the line; nothing is sent while it is empty", () => {
    const onSend = vi.fn();
    render(<Field onSend={onSend} />);
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.change(field(), { target: { value: "  Black and white \n" } });
    fireEvent.keyDown(field(), { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("Black and white");
  });

  it("sends with the button too", () => {
    const onSend = vi.fn();
    render(<Field onSend={onSend} />);
    fireEvent.change(field(), { target: { value: "Tighter cuts" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onSend).toHaveBeenCalledWith("Tighter cuts");
  });

  it("has four suggestions that fill the field and send nothing", () => {
    const onSend = vi.fn();
    render(<Field onSend={onSend} />);
    for (const suggestion of ["Bigger captions", "Tighter cuts", "Move the title lower", "Black and white"]) {
      fireEvent.click(screen.getByRole("button", { name: suggestion }));
      expect(field()).toHaveValue(suggestion);
    }
    expect(onSend).not.toHaveBeenCalled();
  });

  it("is off, with its suggestions, while a call is out", () => {
    const onSend = vi.fn();
    render(<Field onSend={onSend} disabled />);
    expect(field()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Black and white" })).toBeDisabled();
  });

  it("shows a change that failed as one sentence, with a way to try again", () => {
    const again = vi.fn();
    render(<Field onSend={() => {}} problem={{ text: "Something went wrong.", again }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(again).toHaveBeenCalledOnce();
  });
});

describe("things to check", () => {
  const findings: Finding[] = [
    { code: "on-face", severity: "warn", where: { frame: 5, shot: "s1" }, says: "the captions at 0.2 s touch the chin; move them up or down" },
    { code: "under-buttons", severity: "warn", where: { frame: 178 }, says: "the captions at 5.9 s touch TikTok's right-side buttons; make them narrower or move them up" },
  ];

  it("is a closed row that says how many; open, each is its sentence, and Show goes to its frame", () => {
    const onShow = vi.fn();
    render(<Findings findings={findings} onShow={onShow} />);
    const fold = screen.getByRole("button", { name: "2 things to check" });
    expect(fold).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(/touch the chin/)).not.toBeVisible();
    fireEvent.click(fold);
    expect(fold).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("The captions at 0.2 s touch the chin; move them up or down.")).toBeVisible();
    fireEvent.click(screen.getAllByRole("button", { name: "Show" })[1]!);
    expect(onShow).toHaveBeenCalledWith(178);
  });

  it("counts one thing as one, and is not drawn for none", () => {
    const { rerender } = render(<Findings findings={findings.slice(0, 1)} onShow={() => {}} />);
    expect(screen.getByRole("button", { name: "1 thing to check" })).toBeInTheDocument();
    rerender(<Findings findings={[]} onShow={() => {}} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("the row under the phone", () => {
  const idle: Download = { at: "idle" };
  const under = (more: Partial<Parameters<typeof UnderPhone>[0]> = {}) => {
    const on = { onUndo: vi.fn(), onStartOver: vi.fn(), onDownload: vi.fn() };
    render(<UnderPhone canUndo canStartOver canDownload download={idle} {...on} {...more} />);
    return on;
  };
  const button = (name: string) => screen.getByRole("button", { name });

  it("has undo off at the first cut, and on after a change", () => {
    const on = under({ canUndo: false });
    expect(button("Undo")).toBeDisabled();
    cleanup();
    const after = under();
    fireEvent.click(button("Undo"));
    expect(after.onUndo).toHaveBeenCalledOnce();
    expect(on.onUndo).not.toHaveBeenCalled();
  });

  it("asks once before starting over, and keeps the cut when told to", () => {
    const on = under();
    fireEvent.click(button("Start over"));
    expect(screen.getByText("Start over? The cut and its changes are dropped.")).toBeInTheDocument();
    expect(on.onStartOver).not.toHaveBeenCalled();
    fireEvent.click(button("Keep the cut"));
    expect(screen.queryByText(/^Start over\?/)).toBeNull();
    fireEvent.click(button("Start over"));
    fireEvent.click(button("Start over"));
    expect(on.onStartOver).toHaveBeenCalledOnce();
  });

  it("puts the keyboard's focus on the question's answer, and back on Start over when the cut is kept", () => {
    under();
    button("Start over").focus();
    fireEvent.click(button("Start over"));
    expect(button("Start over")).toHaveFocus(); // the one inside the question
    expect(screen.getByRole("group", { name: "Start over?" })).toContainElement(document.activeElement as HTMLElement);
    fireEvent.click(button("Keep the cut"));
    expect(screen.queryByRole("group", { name: "Start over?" })).toBeNull();
    expect(button("Start over")).toHaveFocus(); // the word that opened it
  });

  it("turns Download into a bar while the video is made, then into the link to save it", () => {
    const on = under();
    fireEvent.click(button("Download"));
    expect(on.onDownload).toHaveBeenCalledOnce();
    cleanup();
    under({ canDownload: false, download: { at: "making", share: 0.42 } });
    expect(screen.queryByRole("button", { name: "Download" })).toBeNull();
    expect(screen.getByRole("progressbar", { name: "Making the video" })).toHaveAttribute("aria-valuenow", "42");
    cleanup();
    under({ download: { at: "made", url: "https://films.example/film.mp4" } });
    expect(screen.getByRole("link", { name: "Save video" })).toHaveAttribute("href", "https://films.example/film.mp4");
  });

  it("leaves undo and Start over on while the video is made: only Download gives way", () => {
    const on = under({ canDownload: false, download: { at: "making", share: null } });
    expect(button("Undo")).toBeEnabled();
    expect(button("Start over")).toBeEnabled();
    fireEvent.click(button("Undo"));
    expect(on.onUndo).toHaveBeenCalledOnce();
  });

  it("says in one sentence that the video could not be made, or followed, with a way to try again", () => {
    const on = under({ download: { at: "failed", problem: "The video could not be made.", again: "make" } });
    expect(screen.getByRole("alert")).toHaveTextContent("The video could not be made.");
    fireEvent.click(button("Try again"));
    expect(on.onDownload).toHaveBeenCalledOnce();
    cleanup();
    under({ download: { at: "failed", problem: "The connection was lost while the video was being made.", again: "read" } });
    expect(screen.getByRole("alert")).toHaveTextContent("The connection was lost while the video was being made.");
    expect(button("Undo")).toBeEnabled();
    expect(button("Start over")).toBeEnabled();
  });

  it("is off, all of it, while a call is out, and puts the question away", () => {
    const { rerender } = render(<UnderPhone canUndo canStartOver canDownload download={idle} onUndo={() => {}} onStartOver={() => {}} onDownload={() => {}} />);
    fireEvent.click(button("Start over"));
    expect(screen.getByRole("group", { name: "Start over?" })).toBeInTheDocument();
    rerender(<UnderPhone canUndo={false} canStartOver={false} canDownload={false} download={idle} onUndo={() => {}} onStartOver={() => {}} onDownload={() => {}} />);
    expect(screen.queryByRole("group", { name: "Start over?" })).toBeNull();
    for (const name of ["Undo", "Start over", "Download"]) expect(button(name)).toBeDisabled();
  });
});
