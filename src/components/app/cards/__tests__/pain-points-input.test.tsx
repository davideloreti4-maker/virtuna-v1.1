/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { PainPointsInput } from "@/components/app/cards/pain-points-input";

/**
 * PROFILE-11 — Card 8 free-text with 500-character cap. The cap is enforced in
 * JavaScript (grapheme-aware truncation, see WR-12) before emitting onChange,
 * so a programmatic caller who passes a 600-char input via `target.value`
 * receives a 500-char value back. The live counter renders `{N} / 500`.
 *
 * NOTE: The current implementation deliberately omits the `maxLength` HTML
 * attribute in favor of grapheme-aware JS truncation. The behavioral contract
 * (the value emitted to onChange is capped at 500) is what we verify; testing
 * for the literal HTML attribute would be structural and brittle.
 */
describe("PainPointsInput (PROFILE-11 — 500-char cap)", () => {
  it("renders the textarea with stable data-testid='card-8-textarea'", () => {
    const { container } = render(
      <PainPointsInput value="" onChange={() => {}} />
    );
    const textarea = container.querySelector(
      '[data-testid="card-8-textarea"]'
    );
    expect(textarea).not.toBeNull();
    expect(textarea?.tagName).toBe("TEXTAREA");
  });

  it("renders a live counter showing '{N} / 500'", () => {
    const { container, rerender } = render(
      <PainPointsInput value="" onChange={() => {}} />
    );
    const counter = container.querySelector(
      '[data-testid="card-8-counter"]'
    );
    expect(counter?.textContent).toBe("0 / 500");

    rerender(<PainPointsInput value="abc" onChange={() => {}} />);
    expect(counter?.textContent).toBe("3 / 500");

    const long = "x".repeat(250);
    rerender(<PainPointsInput value={long} onChange={() => {}} />);
    expect(counter?.textContent).toBe("250 / 500");
  });

  it("typing under 500 chars passes through unchanged", () => {
    const onChange = vi.fn();
    const { container } = render(
      <PainPointsInput value="" onChange={onChange} />
    );
    const textarea = container.querySelector(
      '[data-testid="card-8-textarea"]'
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "hello" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("hello");
  });

  it("typing a 600-char string TRUNCATES to 500 in the onChange payload (dual cap defense)", () => {
    const onChange = vi.fn();
    const { container } = render(
      <PainPointsInput value="" onChange={onChange} />
    );
    const textarea = container.querySelector(
      '[data-testid="card-8-textarea"]'
    ) as HTMLTextAreaElement;
    const sixHundred = "a".repeat(600);
    fireEvent.change(textarea, { target: { value: sixHundred } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const emitted = onChange.mock.calls[0]?.[0] as string;
    expect(emitted.length).toBe(500);
    // All emitted chars should be the same 'a' fill — confirms truncation, not corruption
    expect(emitted).toBe("a".repeat(500));
  });

  it("typing exactly 500 chars is preserved (off-by-one guard)", () => {
    const onChange = vi.fn();
    const { container } = render(
      <PainPointsInput value="" onChange={onChange} />
    );
    const textarea = container.querySelector(
      '[data-testid="card-8-textarea"]'
    ) as HTMLTextAreaElement;
    const exactly500 = "b".repeat(500);
    fireEvent.change(textarea, { target: { value: exactly500 } });
    expect(onChange).toHaveBeenCalledWith(exactly500);
  });

  it("typing 501 chars truncates to 500 (boundary)", () => {
    const onChange = vi.fn();
    const { container } = render(
      <PainPointsInput value="" onChange={onChange} />
    );
    const textarea = container.querySelector(
      '[data-testid="card-8-textarea"]'
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "c".repeat(501) } });
    const emitted = onChange.mock.calls[0]?.[0] as string;
    expect(emitted.length).toBe(500);
  });

  it("renders the textarea with the controlled value", () => {
    const { container } = render(
      <PainPointsInput value="hook drops at 2s" onChange={() => {}} />
    );
    const textarea = container.querySelector(
      '[data-testid="card-8-textarea"]'
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe("hook drops at 2s");
  });
});
