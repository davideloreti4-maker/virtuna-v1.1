/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { FactRow, type FactRowProps } from "../fact-row";
import { FACTS } from "../you-words";

const VOICE = FACTS.find((f) => f.key === "writing_voice_description")!;
const ABOUT = FACTS.find((f) => f.key === "about")!;

function props(over: Partial<FactRowProps> = {}): FactRowProps {
  return {
    label: ABOUT.label, value: null, open: false, draft: "", limit: ABOUT.limit, placeholder: ABOUT.placeholder, hint: ABOUT.hint,
    busy: false, failed: false, onOpen: vi.fn(), onDraft: vi.fn(), onSave: vi.fn(), onCancel: vi.fn(), ...over,
  };
}
const field = () => screen.getByRole("textbox", { name: "About you" });

afterEach(cleanup);

describe("FactRow, closed", () => {
  it("is one button: its name, what is saved, and it opens", () => {
    const p = props({ value: "Nursing student, cooks for four flatmates." });
    render(<FactRow {...p} />);
    const row = screen.getByRole("button", { name: /^About you/ });
    expect(row).toHaveTextContent("Nursing student, cooks for four flatmates.");
    fireEvent.click(row);
    expect(p.onOpen).toHaveBeenCalledTimes(1);
  });

  it("with nothing saved says Add", () => {
    render(<FactRow {...props()} />);
    expect(screen.getByRole("button", { name: "About you Add" })).toBeInTheDocument();
  });

  it("hands its button to the screen, which returns the focus to it when the row closes", () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<FactRow {...props({ buttonRef: ref })} />);
    expect(ref.current).toBe(screen.getByRole("button", { name: "About you Add" }));
  });

  it("has no axe violations", async () => {
    const { container } = render(<FactRow {...props()} />);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("FactRow, open", () => {
  it("is a field named for the row, focused, the caret at the end, with the example as its placeholder", () => {
    render(<FactRow {...props({ open: true, draft: "Nurse" })} />);
    expect(field()).toHaveFocus();
    expect((field() as HTMLTextAreaElement).selectionStart).toBe(5);
    expect(field()).toHaveAttribute("placeholder", "Nurse, mum of two, started posting last year.");
  });

  it("counts against the limit and cannot pass it", () => {
    const p = props({ open: true, draft: "x".repeat(57) });
    render(<FactRow {...p} />);
    expect(screen.getByText("57 / 200")).toBeInTheDocument();
    expect(field()).toHaveAttribute("maxlength", "200");
    fireEvent.change(field(), { target: { value: "y".repeat(205) } });
    expect(p.onDraft).toHaveBeenLastCalledWith("y".repeat(200));
  });

  it("How you sound says not to paste a post, and the field is described by it", () => {
    render(<FactRow {...props({ open: true, label: VOICE.label, hint: VOICE.hint, limit: VOICE.limit, placeholder: VOICE.placeholder })} />);
    const hint = screen.getByText("Describe it. Don't paste a post: Maven would copy its topic.");
    expect(screen.getByRole("textbox", { name: "How you sound" }).getAttribute("aria-describedby")).toContain(hint.id);
  });

  it("Save saves, Cancel and Escape cancel", () => {
    const p = props({ open: true, draft: "Nurse" });
    render(<FactRow {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(p.onSave).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(field(), { key: "Escape" });
    expect(p.onCancel).toHaveBeenCalledTimes(2);
  });

  it("Escape cancels from anywhere inside the open row, not only the field", () => {
    const p = props({ open: true, draft: "Nurse" });
    render(<FactRow {...p} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Save" }), { key: "Escape" });
    expect(p.onCancel).toHaveBeenCalledTimes(1);
    expect(p.onSave).not.toHaveBeenCalled();
  });

  it("while saving nothing more is sent and nothing cancels; the field keeps the focus", () => {
    const p = props({ open: true, draft: "Nurse", busy: true });
    render(<FactRow {...p} />);
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toHaveAttribute("aria-busy", "true");
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(save).not.toBeDisabled();
    fireEvent.click(save);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(field(), { key: "Escape" });
    expect(p.onSave).not.toHaveBeenCalled();
    expect(p.onCancel).not.toHaveBeenCalled();
    expect(field()).toHaveFocus();
  });

  it("a failed save says so, and the field is described by it", () => {
    render(<FactRow {...props({ open: true, draft: "Nurse", failed: true })} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't save. Try again.");
    expect(field()).toHaveAttribute("aria-invalid", "true");
    expect(field().getAttribute("aria-describedby")).toContain(alert.id);
  });

  it("has no axe violations", async () => {
    const { container } = render(<FactRow {...props({ open: true, draft: "Nurse", failed: true })} />);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("FactRow: a save that is out", () => {
  it("holds the field: what is typed after Save was tapped is not taken, so the text shown is the text sent", async () => {
    const p = props({ open: true, draft: "Nurse", busy: true });
    render(<FactRow {...p} />);
    const field = screen.getByRole("textbox");
    expect(field).toHaveAttribute("readonly");
    fireEvent.change(field, { target: { value: "Nurse and more" } });
    expect(p.onDraft).not.toHaveBeenCalled();
    // Read-only keeps the focus, where disabled would drop it.
    expect(field).not.toBeDisabled();
  });

  it("Escape while text is being composed (an IME candidate) does not cancel the row", () => {
    const p = props({ open: true, draft: "Nurse" });
    render(<FactRow {...p} />);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape", isComposing: true });
    expect(p.onCancel).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(p.onCancel).toHaveBeenCalledTimes(1);
  });
});
