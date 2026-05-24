/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { CadencePicker } from "@/components/app/cards/cadence-picker";

/**
 * PROFILE-10 — Card 7 frequency Select + time-of-day-aware Toggle.
 *
 * Behavioral contract:
 * - Toggle is a Radix Switch (data-testid="card-7-tod-aware")
 * - Both controls emit onChange with the FULL {frequency, todAware} pair
 * - Toggle click flips todAware and preserves frequency
 */
describe("CadencePicker (PROFILE-10)", () => {
  it("renders the toggle with stable data-testid='card-7-tod-aware'", () => {
    const { container } = render(
      <CadencePicker
        frequency={null}
        todAware={false}
        onChange={() => {}}
      />
    );
    expect(
      container.querySelector('[data-testid="card-7-tod-aware"]')
    ).not.toBeNull();
  });

  it("toggle reflects todAware prop via Radix data-state attribute", () => {
    const { container, rerender } = render(
      <CadencePicker
        frequency={null}
        todAware={false}
        onChange={() => {}}
      />
    );
    const toggle = container.querySelector(
      '[data-testid="card-7-tod-aware"]'
    ) as HTMLElement;
    expect(toggle.getAttribute("data-state")).toBe("unchecked");

    rerender(
      <CadencePicker
        frequency="daily"
        todAware={true}
        onChange={() => {}}
      />
    );
    expect(toggle.getAttribute("data-state")).toBe("checked");
  });

  it("clicking the toggle emits onChange with full spread and todAware=true", () => {
    const onChange = vi.fn();
    const { container } = render(
      <CadencePicker
        frequency="daily"
        todAware={false}
        onChange={onChange}
      />
    );
    const toggle = container.querySelector(
      '[data-testid="card-7-tod-aware"]'
    ) as HTMLElement;
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      frequency: "daily",
      todAware: true,
    });
  });

  it("clicking the toggle from on emits onChange with todAware=false (frequency preserved)", () => {
    const onChange = vi.fn();
    const { container } = render(
      <CadencePicker
        frequency="1-2_per_week"
        todAware={true}
        onChange={onChange}
      />
    );
    const toggle = container.querySelector(
      '[data-testid="card-7-tod-aware"]'
    ) as HTMLElement;
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith({
      frequency: "1-2_per_week",
      todAware: false,
    });
  });

  it("renders the frequency Select with a placeholder when frequency is null", () => {
    const { container } = render(
      <CadencePicker
        frequency={null}
        todAware={false}
        onChange={() => {}}
      />
    );
    // The Select renders a button trigger; placeholder text should appear
    // somewhere inside the picker.
    const root = container.firstChild as HTMLElement;
    expect(root.textContent).toContain("How often do you post?");
  });

  it("exposes the toggle's aria-label for assistive tech", () => {
    const { container } = render(
      <CadencePicker
        frequency={null}
        todAware={false}
        onChange={() => {}}
      />
    );
    const toggle = container.querySelector(
      '[data-testid="card-7-tod-aware"]'
    ) as HTMLElement;
    expect(toggle.getAttribute("aria-label")).toBe(
      "I pay attention to optimal posting times"
    );
  });
});
