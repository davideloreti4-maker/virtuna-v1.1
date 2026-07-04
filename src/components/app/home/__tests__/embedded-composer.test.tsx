/** @vitest-environment happy-dom */
/**
 * EmbeddedComposer — the Room-owned embeddable composer atom (Seam 4).
 *
 * It is a PURE handoff surface (no stream hooks, no router) so the tests drive its
 * behavior directly, no mocks:
 *  - Enter (and the Launch button) emit onLaunch(trimmedText, verb); empty is inert.
 *  - The verb menu emits onVerbChange.
 *  - A fresh seed (nonce) pre-fills the field; the field clears after a launch.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { EmbeddedComposer } from "../embedded-composer";

afterEach(cleanup);

const noop = () => {};

describe("EmbeddedComposer", () => {
  it("emits onLaunch(trimmedText, verb) on Enter and clears the field", () => {
    const onLaunch = vi.fn();
    render(<EmbeddedComposer verb="Make" onVerbChange={noop} onLaunch={onLaunch} />);
    const field = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: "  morning routines  " } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onLaunch).toHaveBeenCalledWith("morning routines", "Make");
    expect(field.value).toBe(""); // cleared after launch
  });

  it("emits onLaunch on the Launch button click, carrying the active verb", () => {
    const onLaunch = vi.fn();
    render(<EmbeddedComposer verb="Ask" onVerbChange={noop} onLaunch={onLaunch} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "is this hook good?" } });
    fireEvent.click(screen.getByRole("button", { name: "Launch" }));
    expect(onLaunch).toHaveBeenCalledWith("is this hook good?", "Ask");
  });

  it("does not launch on empty / whitespace-only input", () => {
    const onLaunch = vi.fn();
    render(<EmbeddedComposer verb="Make" onVerbChange={noop} onLaunch={onLaunch} />);
    const field = screen.getByRole("textbox");
    fireEvent.change(field, { target: { value: "   " } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onLaunch).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Launch" })).toBeDisabled();
  });

  it("Shift+Enter inserts a newline instead of launching", () => {
    const onLaunch = vi.fn();
    render(<EmbeddedComposer verb="Make" onVerbChange={noop} onLaunch={onLaunch} />);
    const field = screen.getByRole("textbox");
    fireEvent.change(field, { target: { value: "line one" } });
    fireEvent.keyDown(field, { key: "Enter", shiftKey: true });
    expect(onLaunch).not.toHaveBeenCalled();
  });

  it("opens the verb menu and emits onVerbChange on pick", () => {
    const onVerbChange = vi.fn();
    render(<EmbeddedComposer verb="Make" onVerbChange={onVerbChange} onLaunch={noop} />);
    fireEvent.click(screen.getByRole("button", { name: "Verb: Make" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: /A real video/ }));
    expect(onVerbChange).toHaveBeenCalledWith("Test");
  });

  it("swaps the placeholder with the active verb", () => {
    const { rerender } = render(<EmbeddedComposer verb="Make" onVerbChange={noop} onLaunch={noop} />);
    expect(screen.getByPlaceholderText(/What do you want to make/)).toBeInTheDocument();
    rerender(<EmbeddedComposer verb="Test" onVerbChange={noop} onLaunch={noop} />);
    expect(screen.getByPlaceholderText(/Paste a TikTok link/)).toBeInTheDocument();
  });

  it("pre-fills the field from a fresh seed (nonce) and re-seeds on a new nonce", () => {
    const { rerender } = render(
      <EmbeddedComposer verb="Make" onVerbChange={noop} onLaunch={noop} seed={{ text: "first topic", nonce: 1 }} />,
    );
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("first topic");
    rerender(
      <EmbeddedComposer verb="Make" onVerbChange={noop} onLaunch={noop} seed={{ text: "second topic", nonce: 2 }} />,
    );
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("second topic");
  });

  it("respects the disabled prop", () => {
    const onLaunch = vi.fn();
    render(<EmbeddedComposer verb="Make" onVerbChange={noop} onLaunch={onLaunch} disabled />);
    const field = screen.getByRole("textbox");
    fireEvent.change(field, { target: { value: "x" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onLaunch).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Launch" })).toBeDisabled();
  });
});
