/** @vitest-environment happy-dom */
/**
 * sheets.test.tsx — the two things done by hand (plan 2026-11-24-editor-screens-a, Task 13; spec §3 screens 2, 9 and 10, E5, E9,
 * E22): the eight looks drawn on the take's frame, "starts again" after changes, the look in use left as it is, "Like a video"
 * read in the background and stopped by another look or by the creator, "Describe it"; the take's words, a word fixed in place
 * with the video sent to it, "Fix all N" keeping each place's own marks, Escape leaving a word as it was, captions off. On real
 * edits (`views.ts`): the suite's take, "Good morning. Let us begin".
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyOps } from "@/lib/edit";
import { assetOf } from "@/lib/edit/worker/takes";
import { BUCKET, takeRow } from "@/lib/edit/worker/__tests__/rows";
import { CaptionsSheet, othersLike, wordFrame, type CaptionsSheetProps } from "../captions-sheet";
import { LOOKS, LookRow, LookSheet, STARTS_AGAIN, type LookSheetProps } from "../look-sheet";
import { ASSET, FIRST, changed } from "./views";

afterEach(cleanup);

const IDLE = { status: "idle" as const, line: null, share: null, problem: null, style: null };
const READING = { status: "reading" as const, line: "Getting the video…", share: null, problem: null, style: null };
const sheet = (more: Partial<LookSheetProps> = {}): LookSheetProps => ({
  open: true, onOpenChange: vi.fn(), picked: "house", poster: "https://media.test/poster.jpg", words: ["Good", "morning."], changed: false, disabled: false,
  onPick: vi.fn(), reading: IDLE, onReadVideo: vi.fn(), onStopReading: vi.fn(), ...more,
});
const samples = () => [...document.querySelectorAll<HTMLElement>("[data-sample]")];

describe("the Look sheet", () => {
  it("offers ours and the seven presets, each drawn on the take's frame, the one in use pressed", () => {
    render(<LookSheet {...sheet()} />);
    const looks = within(screen.getByRole("group", { name: "Looks" })).getAllByRole("button");
    expect(looks.map((look) => look.querySelector("[data-part=look-name]")?.textContent)).toEqual(["Our pick", "Sentences", "Clean", "One word", "Highlighter", "Key words", "Black and white", "Bold pop"]);
    expect(screen.getByRole("button", { name: "Black and white" })).toBeInTheDocument();
    expect(looks[0]).toHaveAttribute("aria-pressed", "true");
    expect(looks.slice(1).every((look) => look.getAttribute("aria-pressed") === "false")).toBe(true);
    expect(samples()).toHaveLength(LOOKS.length);
    expect(samples().every((sample) => sample.style.backgroundImage.includes("https://media.test/poster.jpg"))).toBe(true);
    expect(screen.queryByText(STARTS_AGAIN)).toBeNull();
  });

  it("cuts in the look picked and closes; after changes it says the cut starts again", () => {
    const props = sheet({ changed: true });
    render(<LookSheet {...props} />);
    expect(screen.getByText(STARTS_AGAIN)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clean" }));
    expect(props.onPick).toHaveBeenCalledWith({ kind: "preset", id: "clean" });
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(props.onStopReading).not.toHaveBeenCalled();
  });

  it("leaves the look in use as it is when nothing changed, and starts it again from the take when something did", () => {
    const still = sheet();
    render(<LookSheet {...still} />);
    fireEvent.click(screen.getByRole("button", { name: "Our pick" }));
    expect(still.onPick).not.toHaveBeenCalled();
    expect(still.onOpenChange).toHaveBeenCalledWith(false);
    cleanup();
    const moved = sheet({ changed: true });
    render(<LookSheet {...moved} />);
    fireEvent.click(screen.getByRole("button", { name: "Our pick" }));
    expect(moved.onPick).toHaveBeenCalledWith({ kind: "house" });
  });

  it("cuts in a look said in words, and reads a video's style in the background", () => {
    const props = sheet();
    render(<LookSheet {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Describe it/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "The look in your words" }), { target: { value: "calm, small white type" } });
    fireEvent.click(screen.getByRole("button", { name: "Use it" }));
    expect(props.onPick).toHaveBeenCalledWith({ kind: "words", words: "calm, small white type" });
    fireEvent.click(screen.getByRole("button", { name: /Like a video/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "A TikTok link" }), { target: { value: " https://www.tiktok.com/@someone/video/7300000000000000000 " } });
    fireEvent.click(screen.getByRole("button", { name: "Read its style" }));
    expect(props.onReadVideo).toHaveBeenCalledWith({ link: "https://www.tiktok.com/@someone/video/7300000000000000000" });
  });

  it("reads an uploaded video's style", () => {
    const props = sheet();
    render(<LookSheet {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Like a video/ }));
    const file = new File(["not a real video"], "reference.mp4", { type: "video/mp4" });
    fireEvent.change(screen.getByLabelText("A video to read the style of"), { target: { files: [file] } });
    expect(props.onReadVideo).toHaveBeenCalledWith({ file });
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("says how a read goes, and stops it when the creator says so or picks another look", () => {
    const props = sheet({ reading: READING });
    render(<LookSheet {...props} />);
    expect(screen.getByRole("status")).toHaveTextContent("Getting the video…");
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(props.onStopReading).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Bold pop" }));
    expect(props.onStopReading).toHaveBeenCalledTimes(2);
    expect(props.onPick).toHaveBeenCalledWith({ kind: "preset", id: "bold-pop" });
  });

  it("says a read that failed, and puts it away with the next look", () => {
    const props = sheet({ reading: { ...IDLE, status: "failed", problem: "The video's style could not be read. Try it again, or another video." } });
    render(<LookSheet {...props} />);
    expect(screen.getByRole("alert")).toHaveTextContent("The video's style could not be read.");
    fireEvent.click(screen.getByRole("button", { name: /Describe it/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "The look in your words" }), { target: { value: "big yellow words" } });
    fireEvent.submit(screen.getByRole("textbox", { name: "The look in your words" }).closest("form")!);
    expect(props.onStopReading).toHaveBeenCalledTimes(1);
    expect(props.onPick).toHaveBeenCalledWith({ kind: "words", words: "big yellow words" });
  });

  it("picks nothing while a call is out", () => {
    const props = sheet({ disabled: true });
    render(<LookSheet {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Clean" }));
    expect(props.onPick).not.toHaveBeenCalled();
  });

  it("opens fresh: a way left open and its words are gone once the sheet is closed", () => {
    const props = sheet();
    const { rerender } = render(<LookSheet {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Describe it/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "The look in your words" }), { target: { value: "calm" } });
    rerender(<LookSheet {...props} open={false} />);
    rerender(<LookSheet {...props} open />);
    expect(screen.queryByRole("textbox", { name: "The look in your words" })).toBeNull();
  });

  it("is a row while the take gets ready", () => {
    const onPick = vi.fn();
    render(<LookRow picked="house" poster={null} words={["go", "now"]} onPick={onPick} />);
    expect(screen.getByRole("heading", { name: "Pick a look while you wait" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Our pick" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Bold pop" }));
    expect(onPick).toHaveBeenCalledWith({ kind: "preset", id: "bold-pop" });
  });

  it("draws stand-in words before the take's are heard, and one word for the look of one word", () => {
    render(<LookRow picked="house" poster={null} words={[]} onPick={() => {}} />);
    const [ours, , , oneWord] = samples();
    expect(ours?.querySelector("[data-part=title]")?.textContent).toBe("Your words");
    expect(oneWord?.querySelector("[data-part=title]")).toBeNull(); // its title is over the opening only
    expect(oneWord?.querySelectorAll("[data-part=said] > span")).toHaveLength(1);
    cleanup();
    render(<LookRow picked="house" poster={null} words={["Hello"]} onPick={() => {}} />);
    expect(samples()[3]?.querySelector("[data-part=said]")?.textContent).toBe("Hello");
  });
});

describe("the Captions sheet", () => {
  /** "Good morning. Let us begin", with "Let" heard as "good" too: a word heard twice. */
  const TWICE = changed(FIRST, [{ op: "word.set", asset: ASSET.id, index: 2, text: "good" }]);
  const captions = (more: Partial<CaptionsSheetProps> = {}): CaptionsSheetProps => ({
    open: true, onOpenChange: vi.fn(), edit: TWICE, takeId: ASSET.id, disabled: false, onOps: vi.fn(async () => true), onSeek: vi.fn(), ...more,
  });

  it("finds where a word is on the film and where else it was heard", () => {
    expect(wordFrame(FIRST, 519, ASSET.id)).toBe(16);
    expect(wordFrame(changed(FIRST, [{ op: "shot.trim", id: "s1", startMs: 1000 }]), 519, ASSET.id)).toBeNull();
    const words = TWICE.assets[0]!.kind === "video" ? TWICE.assets[0]!.words ?? [] : [];
    expect(othersLike(words, 0)).toEqual([2]);
    expect(othersLike(words, 1)).toEqual([]);
  });

  it("finds a word in the take's own shots, not in another file's that shows the same moment", () => {
    const other = assetOf(takeRow({ id: "33333333-3333-4333-8333-333333333333" }), BUCKET);
    const made = applyOps(FIRST, [
      { op: "asset.add", id: other.id },
      { op: "shot.insert", after: null, shot: { id: "b1", asset: other.id, startMs: 0, endMs: 2000 } },
    ], [ASSET, other]);
    if (!made.ok) throw new Error(made.problems.map((problem) => problem.message).join("; "));
    expect(wordFrame(made.edit, 519, other.id)).toBe(16);
    expect(wordFrame(made.edit, 519, ASSET.id)).toBe(60 + 16);
  });

  it("fixes a word in place, sends the video to it, then offers to fix every place it was heard", async () => {
    const props = captions();
    render(<CaptionsSheet {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Good" }));
    expect(props.onSeek).toHaveBeenCalledWith(16);
    const word = screen.getByRole("textbox", { name: "Word 1" });
    expect(word).toHaveFocus();
    fireEvent.change(word, { target: { value: "Gud" } });
    fireEvent.keyDown(word, { key: "Enter" });
    await waitFor(() => expect(props.onOps).toHaveBeenCalledWith([{ op: "word.set", asset: ASSET.id, index: 0, text: "Gud" }]));
    fireEvent.click(await screen.findByRole("button", { name: "Fix all 2" }));
    expect(props.onOps).toHaveBeenLastCalledWith([{ op: "word.set", asset: ASSET.id, index: 2, text: "Gud" }]);
    expect(screen.queryByRole("button", { name: /Fix all/ })).toBeNull();
  });

  it("gives each other place the fix with its own marks", async () => {
    const marked = changed(FIRST, [{ op: "word.set", asset: ASSET.id, index: 4, text: "good." }]);
    const props = captions({ edit: marked });
    render(<CaptionsSheet {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Good" }));
    const word = screen.getByRole("textbox", { name: "Word 1" });
    fireEvent.change(word, { target: { value: "Gud" } });
    fireEvent.keyDown(word, { key: "Enter" });
    fireEvent.click(await screen.findByRole("button", { name: "Fix all 2" }));
    expect(props.onOps).toHaveBeenLastCalledWith([{ op: "word.set", asset: ASSET.id, index: 4, text: "Gud." }]);
  });

  it("offers no Fix all for a word heard once, nor after a fix that was not made", async () => {
    const once = captions({ edit: FIRST });
    render(<CaptionsSheet {...once} />);
    fireEvent.click(screen.getByRole("button", { name: "morning." }));
    fireEvent.change(screen.getByRole("textbox", { name: "Word 2" }), { target: { value: "evening." } });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Word 2" }), { key: "Enter" });
    await waitFor(() => expect(once.onOps).toHaveBeenCalledWith([{ op: "word.set", asset: ASSET.id, index: 1, text: "evening." }]));
    expect(screen.queryByRole("button", { name: /Fix all/ })).toBeNull();
    cleanup();
    const refused = captions({ onOps: vi.fn(async () => false) });
    render(<CaptionsSheet {...refused} />);
    fireEvent.click(screen.getByRole("button", { name: "Good" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Word 1" }), { target: { value: "Gud" } });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Word 1" }), { key: "Enter" });
    await waitFor(() => expect(refused.onOps).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: /Fix all/ })).toBeNull();
  });

  it("sends nothing for a word left as it was, and leaves it on Escape with the sheet open", async () => {
    const props = captions();
    render(<CaptionsSheet {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "morning." }));
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Word 2" }), { key: "Enter" });
    await waitFor(() => expect(screen.getByRole("button", { name: "morning." })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Good" }));
    const word = screen.getByRole("textbox", { name: "Word 1" });
    fireEvent.change(word, { target: { value: "Gud" } });
    fireEvent.keyDown(word, { key: "Escape" });
    expect(screen.queryByRole("textbox", { name: "Word 1" })).toBeNull();
    expect(screen.getByRole("button", { name: "Good" })).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(props.onOpenChange).not.toHaveBeenCalled();
    expect(props.onOps).not.toHaveBeenCalled();
  });

  it("sets a word on leaving it", async () => {
    const props = captions();
    render(<CaptionsSheet {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "us" }));
    const word = screen.getByRole("textbox", { name: "Word 4" });
    fireEvent.change(word, { target: { value: "as" } });
    fireEvent.blur(word);
    await waitFor(() => expect(props.onOps).toHaveBeenCalledWith([{ op: "word.set", asset: ASSET.id, index: 3, text: "as" }]));
    expect(props.onOps).toHaveBeenCalledTimes(1);
  });

  it("opens fresh: a Fix all offered is gone once the sheet is closed", async () => {
    const props = captions();
    const { rerender } = render(<CaptionsSheet {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Good" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Word 1" }), { target: { value: "Gud" } });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Word 1" }), { key: "Enter" });
    await screen.findByRole("button", { name: "Fix all 2" });
    rerender(<CaptionsSheet {...props} open={false} />);
    rerender(<CaptionsSheet {...props} open />);
    expect(screen.queryByRole("button", { name: /Fix all/ })).toBeNull();
  });

  it("turns captions off, and on", () => {
    const props = captions({ edit: FIRST });
    const { rerender } = render(<CaptionsSheet {...props} />);
    const toggle = screen.getByRole("switch", { name: "Captions" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggle);
    expect(props.onOps).toHaveBeenCalledWith([{ op: "captions.set", on: false }]);
    rerender(<CaptionsSheet {...props} edit={changed(FIRST, [{ op: "captions.set", on: false }])} />);
    expect(screen.getByRole("switch", { name: "Captions" })).toHaveAttribute("aria-checked", "false");
    fireEvent.click(screen.getByRole("switch", { name: "Captions" }));
    expect(props.onOps).toHaveBeenLastCalledWith([{ op: "captions.set", on: true }]);
  });

  it("changes nothing while a call is out, and says a take with no speech", () => {
    const props = captions({ disabled: true });
    render(<CaptionsSheet {...props} />);
    expect(screen.getByRole("switch", { name: "Captions" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Good" })).toBeDisabled();
    cleanup();
    const take = FIRST.assets[0]!;
    const none = { ...FIRST, assets: [take.kind === "video" ? { ...take, words: null } : take] };
    render(<CaptionsSheet {...captions({ edit: none })} />);
    expect(screen.getByText("No speech was found in this take.")).toBeInTheDocument();
  });
});
