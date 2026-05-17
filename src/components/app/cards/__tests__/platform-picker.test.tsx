/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import {
  PlatformPicker,
  type PlatformId,
} from "@/components/app/cards/platform-picker";

/**
 * PROFILE-03 — Card 0 multi-select platform picker (TikTok / IG / YT).
 *
 * Behavioral contract:
 * - 3 tiles rendered with stable `data-testid="card-0-tile-{id}"` selectors
 * - Clicking an unselected tile adds it to value; clicking a selected tile removes it
 * - onChange always receives a NEW array (caller-immutability)
 * - aria-pressed mirrors selection state
 */
describe("PlatformPicker (PROFILE-03)", () => {
  it("renders three platform tiles with stable data-testid selectors", () => {
    const { container } = render(
      <PlatformPicker value={[]} onChange={() => {}} />
    );
    expect(
      container.querySelector('[data-testid="card-0-tile-tiktok"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="card-0-tile-instagram"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="card-0-tile-youtube"]')
    ).not.toBeNull();
  });

  it("aria-pressed reflects empty initial selection", () => {
    const { container } = render(
      <PlatformPicker value={[]} onChange={() => {}} />
    );
    for (const id of ["tiktok", "instagram", "youtube"] as const) {
      const tile = container.querySelector(`[data-testid="card-0-tile-${id}"]`);
      expect(tile?.getAttribute("aria-pressed")).toBe("false");
    }
  });

  it("clicking an unselected tile invokes onChange with that platform appended", () => {
    const onChange = vi.fn();
    const { container } = render(
      <PlatformPicker value={[]} onChange={onChange} />
    );
    const tile = container.querySelector(
      '[data-testid="card-0-tile-tiktok"]'
    ) as HTMLElement;
    fireEvent.click(tile);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(["tiktok"]);
  });

  it("clicking three different tiles accumulates them in onChange calls", () => {
    // Simulate the modal's controlled-value pattern by re-rendering after each onChange.
    const onChange = vi.fn();
    const value: PlatformId[] = [];
    const { container, rerender } = render(
      <PlatformPicker value={value} onChange={onChange} />
    );

    fireEvent.click(
      container.querySelector('[data-testid="card-0-tile-tiktok"]') as HTMLElement
    );
    expect(onChange).toHaveBeenLastCalledWith(["tiktok"]);

    rerender(<PlatformPicker value={["tiktok"]} onChange={onChange} />);
    fireEvent.click(
      container.querySelector(
        '[data-testid="card-0-tile-instagram"]'
      ) as HTMLElement
    );
    expect(onChange).toHaveBeenLastCalledWith(["tiktok", "instagram"]);

    rerender(
      <PlatformPicker value={["tiktok", "instagram"]} onChange={onChange} />
    );
    fireEvent.click(
      container.querySelector('[data-testid="card-0-tile-youtube"]') as HTMLElement
    );
    expect(onChange).toHaveBeenLastCalledWith([
      "tiktok",
      "instagram",
      "youtube",
    ]);
  });

  it("clicking an already-selected tile deselects it (filters from value)", () => {
    const onChange = vi.fn();
    const { container } = render(
      <PlatformPicker
        value={["tiktok", "instagram"]}
        onChange={onChange}
      />
    );
    fireEvent.click(
      container.querySelector(
        '[data-testid="card-0-tile-instagram"]'
      ) as HTMLElement
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(["tiktok"]);
  });

  it("aria-pressed reflects the controlled value prop on every render", () => {
    const { container } = render(
      <PlatformPicker
        value={["tiktok", "youtube"]}
        onChange={() => {}}
      />
    );
    expect(
      container
        .querySelector('[data-testid="card-0-tile-tiktok"]')
        ?.getAttribute("aria-pressed")
    ).toBe("true");
    expect(
      container
        .querySelector('[data-testid="card-0-tile-instagram"]')
        ?.getAttribute("aria-pressed")
    ).toBe("false");
    expect(
      container
        .querySelector('[data-testid="card-0-tile-youtube"]')
        ?.getAttribute("aria-pressed")
    ).toBe("true");
  });

  it("emits a fresh array reference (never mutates caller's value)", () => {
    const onChange = vi.fn();
    const original: PlatformId[] = ["tiktok"];
    const frozen = Object.freeze([...original]) as PlatformId[];
    const { container } = render(
      <PlatformPicker value={frozen} onChange={onChange} />
    );
    fireEvent.click(
      container.querySelector(
        '[data-testid="card-0-tile-instagram"]'
      ) as HTMLElement
    );
    const next = onChange.mock.calls[0]?.[0] as PlatformId[];
    expect(next).not.toBe(frozen);
    expect(frozen).toEqual(["tiktok"]); // original not mutated
  });
});
