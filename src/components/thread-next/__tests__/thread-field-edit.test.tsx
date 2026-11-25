/** @vitest-environment happy-dom */
/**
 * thread-field-edit.test.tsx — the field with the editor open (plan 2026-11-24-editor-screens-a, Task 16): a staged video offers
 * Simulate and Edit, a take only Edit can take staged (past Simulate's 200 MB), the Edit pill in a thread, the picker a caller opens.
 * The field is rendered for real. Stand-ins are browser APIs only (object URLs); the callbacks are the composer's props.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createRef } from "react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import type { ToolId } from "@/components/app/home/composer-controls";
import { ThreadField, type FieldHome, type ThreadFieldProps } from "../thread-field";

const home = (over: Partial<FieldHome> = {}): FieldHome => ({ audience: { label: "@nia.tests", open: false, onOpen: vi.fn() }, picked: null, onClearPicked: vi.fn(), ...over });
const props = (over: Partial<ThreadFieldProps> = {}): ThreadFieldProps => ({
  value: "", onChange: vi.fn(), onKeyDown: vi.fn(), onSubmit: vi.fn((e: React.FormEvent<HTMLFormElement>) => e.preventDefault()),
  // Simulate costs 10 and Edit nothing, as the composer's `priceOfTool` says of them.
  tool: "chat" as ToolId, onSelectTool: vi.fn(), priceOf: (tool) => (tool === "test" ? 10 : null), canSend: true, busy: false, online: true, streaming: false, onStop: vi.fn(),
  video: null, onVideoChange: vi.fn(), evidence: null, onRemoveEvidence: vi.fn(), onDropFile: vi.fn(), errors: [],
  placeholder: "Ask anything, or pick a skill", ariaLabel: "Ask anything about your content", sendLabel: "Send message", onOpenMore: vi.fn(), moreOpen: false, ...over,
});
const take = (megabytes: number) => {
  const file = new File(["x"], "IMG_0042.MOV", { type: "video/quicktime" });
  Object.defineProperty(file, "size", { value: megabytes * 1024 * 1024 });
  return file;
};
const choice = () => screen.getByRole("group", { name: "What to do with this video" });
const pickedPill = () => document.querySelector('[data-part="picked-skill"]');

beforeEach(() => {
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:test/1");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the field on Home with the editor open: a staged video", () => {
  it("offers Simulate or Edit in the picked skill's place, Simulate off for a file it cannot take", () => {
    const onPick = vi.fn();
    render(<ThreadField {...props({ tool: "edit", sendLabel: "Send to edit", video: take(300), home: home({ picked: { label: "Edit", price: null }, videoSkill: { picked: "edit", simulate: false, onPick } }) })} />);
    expect(within(choice()).getAllByRole("button").map((chip) => chip.getAttribute("aria-label"))).toEqual(["Simulate", "Edit"]);
    expect(within(choice()).getByRole("button", { name: "Edit" })).toHaveAttribute("aria-pressed", "true");
    expect(within(choice()).getByRole("button", { name: "Simulate" })).toBeDisabled();
    expect(pickedPill()).toBeNull();
    // The send says what it does and what it spends: Edit, and nothing.
    expect(screen.getByRole("button", { name: "Send to edit" })).toHaveAccessibleDescription("Edit");
  });

  it("switches between the two, and keeps saying what Simulate spends", () => {
    const onPick = vi.fn();
    render(<ThreadField {...props({ tool: "test", sendLabel: "Send to simulate", video: take(20), home: home({ picked: { label: "Simulate", price: 10 }, videoSkill: { picked: "test", simulate: true, onPick } }) })} />);
    const simulate = within(choice()).getByRole("button", { name: "Simulate" });
    expect(simulate).toHaveAttribute("aria-pressed", "true");
    expect(simulate).toHaveTextContent(/^Simulate · 10 credits$/);
    expect(simulate).toHaveAccessibleDescription("10 credits");
    expect(screen.getByRole("button", { name: "Send to simulate" })).toHaveAccessibleDescription("Simulate · 10 credits");
    const edit = within(choice()).getByRole("button", { name: "Edit" });
    expect(edit).toHaveAttribute("aria-pressed", "false");
    expect(edit).toHaveTextContent(/^Edit$/);
    fireEvent.click(edit);
    expect(onPick).toHaveBeenLastCalledWith("edit");
    fireEvent.click(simulate);
    expect(onPick).toHaveBeenLastCalledWith("test");
  });

  it("is the picked skill's pill, as before, where the editor is not open or no video is staged", () => {
    const { unmount } = render(<ThreadField {...props({ tool: "test", video: take(20), home: home({ picked: { label: "Simulate", price: 10 } }) })} />);
    expect(screen.queryByRole("group", { name: "What to do with this video" })).toBeNull();
    expect(pickedPill()).toHaveTextContent(/^Simulate · 10 credits$/);
    unmount();
    render(<ThreadField {...props({ tool: "edit", home: home({ picked: { label: "Edit", price: null }, videoSkill: null }) })} />);
    expect(screen.queryByRole("group", { name: "What to do with this video" })).toBeNull();
    expect(pickedPill()).toHaveTextContent(/^Edit$/);
  });

  it("with Edit picked and no video yet, + says the next step, and takes the focus", () => {
    const base = props({ home: home() });
    const { rerender } = render(<ThreadField {...base} />);
    rerender(<ThreadField {...base} tool="edit" home={home({ picked: { label: "Edit", price: null } })} />);
    const plus = screen.getByRole("button", { name: "Add a video" });
    expect(plus).toHaveTextContent(/^Add video$/);
    expect(document.activeElement).toBe(plus);
  });
});

describe("the field with the editor open: what it stages", () => {
  it("stages a take past Simulate's 200 MB when told the edit tool's check, and refuses it with Simulate's", () => {
    const onVideoChange = vi.fn();
    const { unmount } = render(<ThreadField {...props({ home: home(), onVideoChange, validateVideo: () => null })} />);
    fireEvent.change(screen.getByLabelText("Choose a video file"), { target: { files: [take(300)] } });
    expect(onVideoChange).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
    unmount();
    render(<ThreadField {...props({ home: home(), onVideoChange })} />);
    fireEvent.change(screen.getByLabelText("Choose a video file"), { target: { files: [take(300)] } });
    expect(onVideoChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert").textContent).toMatch(/File too large/);
  });

  it("says the caller's own sentence for a file its check refuses", () => {
    const onVideoChange = vi.fn();
    render(<ThreadField {...props({ home: home(), onVideoChange, validateVideo: () => "A video to edit is at most 2 GB." })} />);
    fireEvent.change(screen.getByLabelText("Choose a video file"), { target: { files: [take(300)] } });
    expect(onVideoChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("A video to edit is at most 2 GB.");
  });
});

describe("the field in a thread with the editor open", () => {
  const pills = () => screen.getAllByRole("button").map((one) => one.getAttribute("aria-label")).filter((name) => ["Simulate", "Edit", "Hooks", "Script", "Remix", "More"].includes(name ?? ""));

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
