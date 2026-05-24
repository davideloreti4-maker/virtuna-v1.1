/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { ContentStylePicker } from "@/components/app/cards/content-style-picker";

/**
 * PROFILE-07 — Card 4 split onChange contract: clicking a style tile keeps
 * the existing cuts value; clicking a cuts tile keeps the existing style.
 * Each click emits the FULL {style, cuts} pair.
 */
describe("ContentStylePicker (PROFILE-07)", () => {
  it("renders all six style tiles with stable data-testid selectors", () => {
    const { container } = render(
      <ContentStylePicker style={null} cuts={null} onChange={() => {}} />
    );
    for (const id of [
      "talking_head",
      "b_roll",
      "educational",
      "comedy",
      "tutorial",
      "vlog",
    ]) {
      expect(
        container.querySelector(`[data-testid="card-4-style-${id}"]`)
      ).not.toBeNull();
    }
  });

  it("renders all three cuts-per-second tiles with stable data-testid selectors", () => {
    const { container } = render(
      <ContentStylePicker style={null} cuts={null} onChange={() => {}} />
    );
    for (const id of ["slow", "medium", "fast"]) {
      expect(
        container.querySelector(`[data-testid="card-4-cuts-${id}"]`)
      ).not.toBeNull();
    }
  });

  it("clicking a style tile emits {style: <new>, cuts: <existing>}", () => {
    const onChange = vi.fn();
    const { container } = render(
      <ContentStylePicker
        style={null}
        cuts="medium"
        onChange={onChange}
      />
    );
    fireEvent.click(
      container.querySelector(
        '[data-testid="card-4-style-talking_head"]'
      ) as HTMLElement
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      style: "talking_head",
      cuts: "medium", // preserved
    });
  });

  it("clicking a cuts tile emits {style: <existing>, cuts: <new>}", () => {
    const onChange = vi.fn();
    const { container } = render(
      <ContentStylePicker
        style="educational"
        cuts={null}
        onChange={onChange}
      />
    );
    fireEvent.click(
      container.querySelector(
        '[data-testid="card-4-cuts-fast"]'
      ) as HTMLElement
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      style: "educational", // preserved
      cuts: "fast",
    });
  });

  it("aria-pressed reflects only the selected style tile", () => {
    const { container } = render(
      <ContentStylePicker
        style="comedy"
        cuts={null}
        onChange={() => {}}
      />
    );
    expect(
      container
        .querySelector('[data-testid="card-4-style-comedy"]')
        ?.getAttribute("aria-pressed")
    ).toBe("true");
    expect(
      container
        .querySelector('[data-testid="card-4-style-tutorial"]')
        ?.getAttribute("aria-pressed")
    ).toBe("false");
  });

  it("aria-pressed reflects only the selected cuts tile", () => {
    const { container } = render(
      <ContentStylePicker
        style={null}
        cuts="slow"
        onChange={() => {}}
      />
    );
    expect(
      container
        .querySelector('[data-testid="card-4-cuts-slow"]')
        ?.getAttribute("aria-pressed")
    ).toBe("true");
    expect(
      container
        .querySelector('[data-testid="card-4-cuts-medium"]')
        ?.getAttribute("aria-pressed")
    ).toBe("false");
    expect(
      container
        .querySelector('[data-testid="card-4-cuts-fast"]')
        ?.getAttribute("aria-pressed")
    ).toBe("false");
  });

  it("clicking style preserves null cuts when cuts is null", () => {
    const onChange = vi.fn();
    const { container } = render(
      <ContentStylePicker
        style={null}
        cuts={null}
        onChange={onChange}
      />
    );
    fireEvent.click(
      container.querySelector(
        '[data-testid="card-4-style-vlog"]'
      ) as HTMLElement
    );
    expect(onChange).toHaveBeenCalledWith({ style: "vlog", cuts: null });
  });
});
