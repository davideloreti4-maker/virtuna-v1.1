/** @vitest-environment happy-dom */
/**
 * thread-field-edit.test.tsx — the field with the editor open (plan 2026-11-24-editor-screens-a, Task 16): the Edit pill beside
 * Simulate, in a thread and on Home (one layout since the Home spec of 2026-11-25), a staged video switched between Simulate and
 * Edit by those two pills, a take only Edit can take staged (past Simulate's 200 MB), the picker a caller opens.
 * The field is rendered for real. Stand-ins are browser APIs only (object URLs); the callbacks are the composer's props.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import type { ToolId } from "@/components/app/home/composer-controls";
import { ThreadField, type ThreadFieldProps } from "../thread-field";

const props = (over: Partial<ThreadFieldProps> = {}): ThreadFieldProps => ({
  value: "", onChange: vi.fn(), onKeyDown: vi.fn(), onSubmit: vi.fn((e: React.FormEvent<HTMLFormElement>) => e.preventDefault()),
  // Simulate costs 10 and Edit nothing, as the composer's `priceOfTool` says of them.
  tool: "chat" as ToolId, onSelectTool: vi.fn(), priceOf: (tool) => (tool === "test" ? 10 : null), canSend: true, busy: false, online: true, streaming: false, onStop: vi.fn(),
  video: null, onVideoChange: vi.fn(), evidence: null, onRemoveEvidence: vi.fn(), onDropFile: vi.fn(), errors: [],
  placeholder: "Ask anything", ariaLabel: "Ask anything about your content", sendLabel: "Send message", onOpenMore: vi.fn(), moreOpen: false, ...over,
});
const take = (megabytes: number) => {
  const file = new File(["x"], "IMG_0042.MOV", { type: "video/quicktime" });
  Object.defineProperty(file, "size", { value: megabytes * 1024 * 1024 });
  return file;
};
const pill = (name: string) => screen.getByRole("button", { name });
/** The row's skill buttons, in order (the send and the + are not among them). */
const pills = () => screen.getAllByRole("button").map((one) => one.getAttribute("aria-label")).filter((name) => ["Simulate", "Edit", "Hooks", "Script", "Remix", "More"].includes(name ?? ""));

beforeEach(() => {
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:test/1");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Rules E1 to E3 of the Home integration (2026-11-25): on Home the field is the thread's, so the editor's parts there are the
// thread's too: the Edit pill in the row, the two pills as the choice for a staged video, "+" as the next step with no video.
describe("the field on Home with the editor open", () => {
  it("has the Edit pill beside Simulate, as in a thread, and none where the editor is not open", () => {
    const { unmount } = render(<ThreadField {...props({ home: true, editOpen: true })} />);
    expect(pills()).toEqual(["Simulate", "Edit", "Hooks", "Script", "Remix", "More"]);
    unmount();
    render(<ThreadField {...props({ home: true })} />);
    expect(pills()).toEqual(["Simulate", "Hooks", "Script", "Remix", "More"]);
  });

  it("a staged video: the Simulate and Edit pills are the choice, the pressed one is what the send does; no control of its own", () => {
    const { rerender } = render(<ThreadField {...props({ home: true, editOpen: true, tool: "edit", sendLabel: "Send to edit", video: take(300) })} />);
    expect(pill("Edit")).toHaveAttribute("aria-pressed", "true");
    expect(pill("Edit")).toHaveTextContent(/^Edit$/);
    expect(pill("Simulate")).toHaveAttribute("aria-pressed", "false");
    // Simulate stays a pill a creator can press, as in a thread: its own limit is held at the send (the composer's).
    expect(pill("Simulate")).toBeEnabled();
    expect(screen.queryByRole("group", { name: "What to do with this video" })).toBeNull();
    expect(document.querySelector('[data-part="picked-skill"]')).toBeNull();
    // An edit spends nothing: no price on its pill and none on the send.
    expect(pill("Send to edit")).not.toHaveAttribute("aria-describedby");
    rerender(<ThreadField {...props({ home: true, editOpen: true, tool: "test", sendLabel: "Send to simulate", video: take(20) })} />);
    expect(pill("Simulate")).toHaveAttribute("aria-pressed", "true");
    expect(pill("Simulate")).toHaveTextContent(/^Simulate · 10$/);
    expect(pill("Simulate")).toHaveAccessibleDescription("10 credits");
  });

  it("switches between the two by the pills: a tap on Edit asks for Edit, on Simulate for Simulate, the video stays", () => {
    const shown = props({ home: true, editOpen: true, tool: "test", video: take(20) });
    const { rerender } = render(<ThreadField {...shown} />);
    fireEvent.click(pill("Edit"));
    expect(shown.onSelectTool).toHaveBeenLastCalledWith("edit");
    rerender(<ThreadField {...shown} tool="edit" />);
    expect(screen.getByTestId("field-video")).toBeInTheDocument();
    // With a video the next step is the send: a tap on the other pill puts the cursor in the text.
    expect(document.activeElement).toBe(screen.getByRole("textbox"));
    fireEvent.click(pill("Simulate"));
    expect(shown.onSelectTool).toHaveBeenLastCalledWith("test");
  });

  it("Edit picked outside the field (its card) with no video yet: + takes the focus, and says nothing of its own (no Add video pill)", () => {
    const base = props({ home: true, editOpen: true });
    const { rerender } = render(<ThreadField {...base} />);
    rerender(<ThreadField {...base} tool="edit" />);
    const plus = pill("Add a video");
    expect(document.activeElement).toBe(plus);
    expect(plus).not.toHaveTextContent("Add video");
    expect(screen.queryByText("Add video")).toBeNull();
  });

  it("a tap on the Edit pill with no video keeps the focus on the pill (the next step is +), as in a thread", () => {
    const base = props({ home: true, editOpen: true });
    const { rerender } = render(<ThreadField {...base} />);
    fireEvent.click(pill("Edit"));
    expect(base.onSelectTool).toHaveBeenCalledWith("edit");
    rerender(<ThreadField {...base} tool="edit" />);
    expect(document.activeElement).toBe(pill("Edit"));
  });
});

describe("the field with the editor open: what it stages", () => {
  it("stages a take past Simulate's 200 MB when told the edit tool's check, and refuses it with Simulate's", () => {
    const onVideoChange = vi.fn();
    const { unmount } = render(<ThreadField {...props({ home: true, onVideoChange, validateVideo: () => null })} />);
    fireEvent.change(screen.getByLabelText("Choose a video file"), { target: { files: [take(300)] } });
    expect(onVideoChange).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
    unmount();
    render(<ThreadField {...props({ home: true, onVideoChange })} />);
    fireEvent.change(screen.getByLabelText("Choose a video file"), { target: { files: [take(300)] } });
    expect(onVideoChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert").textContent).toMatch(/File too large/);
  });

  it("says the caller's own sentence for a file its check refuses", () => {
    const onVideoChange = vi.fn();
    render(<ThreadField {...props({ home: true, onVideoChange, validateVideo: () => "A video to edit is at most 2 GB." })} />);
    fireEvent.change(screen.getByLabelText("Choose a video file"), { target: { files: [take(300)] } });
    expect(onVideoChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("A video to edit is at most 2 GB.");
  });
});

describe("the field in a thread with the editor open", () => {
  it("shows the Edit pill beside Simulate only where the editor is open, and gives its picker to the caller", () => {
    const picker = createRef<HTMLInputElement>();
    const { unmount } = render(<ThreadField {...props({ editOpen: true, pickerRef: picker })} />);
    expect(pills()).toEqual(["Simulate", "Edit", "Hooks", "Script", "Remix", "More"]);
    expect(picker.current).toBe(screen.getByLabelText("Choose a video file"));
    unmount();
    render(<ThreadField {...props()} />);
    expect(pills()).toEqual(["Simulate", "Hooks", "Script", "Remix", "More"]);
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("a tap on Edit selects it and, with no video yet, keeps the focus on the pill (the next step is +)", () => {
    const shown = props({ editOpen: true });
    const { rerender } = render(<ThreadField {...shown} />);
    const edit = screen.getByRole("button", { name: "Edit" });
    fireEvent.click(edit);
    expect(shown.onSelectTool).toHaveBeenCalledWith("edit");
    expect(document.activeElement).toBe(edit);
    // Selected: pressed, with no price to say (an edit spends no credits); a second tap puts chat back.
    rerender(<ThreadField {...shown} tool="edit" />);
    expect(edit).toHaveAttribute("aria-pressed", "true");
    expect(edit).toHaveTextContent(/^Edit$/);
    fireEvent.click(edit);
    expect(shown.onSelectTool).toHaveBeenLastCalledWith("chat");
  });
});
