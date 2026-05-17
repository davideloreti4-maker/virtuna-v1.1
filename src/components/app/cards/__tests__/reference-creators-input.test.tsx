/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import {
  ReferenceCreatorsInput,
  type ReferenceCreatorEntry,
} from "@/components/app/cards/reference-creators-input";

/**
 * PROFILE-08 — Card 5 reference creators with 3-entry cap (T-02-03 Apify
 * cost-runaway mitigation). The cap is dual-enforced: the +Add button hides
 * when value.length === 3, and (since this picker is the SOLE caller-facing
 * surface for adding entries) no other path can grow the array via this
 * component. Remove buttons must expose 1-indexed aria-labels for WCAG.
 */
describe("ReferenceCreatorsInput (PROFILE-08 — 3-entry cap)", () => {
  it("synthesizes one visible empty row when value=[] WITHOUT calling onChange", () => {
    const onChange = vi.fn();
    const { container } = render(
      <ReferenceCreatorsInput value={[]} onChange={onChange} />
    );
    const input = container.querySelector(
      '[data-testid="card-5-input-0"]'
    ) as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(input?.value).toBe("");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders the +Add button when value.length < 3", () => {
    const { container } = render(
      <ReferenceCreatorsInput
        value={[{ handle_or_url: "@a" }, { handle_or_url: "@b" }]}
        onChange={() => {}}
      />
    );
    expect(
      container.querySelector('[data-testid="card-5-add"]')
    ).not.toBeNull();
  });

  it("HIDES the +Add button when value.length === 3 (T-02-03 cost cap)", () => {
    const { container } = render(
      <ReferenceCreatorsInput
        value={[
          { handle_or_url: "@a" },
          { handle_or_url: "@b" },
          { handle_or_url: "@c" },
        ]}
        onChange={() => {}}
      />
    );
    expect(container.querySelector('[data-testid="card-5-add"]')).toBeNull();
  });

  it("renders one row per entry when value has entries", () => {
    const { container } = render(
      <ReferenceCreatorsInput
        value={[
          { handle_or_url: "@a" },
          { handle_or_url: "@b" },
          { handle_or_url: "@c" },
        ]}
        onChange={() => {}}
      />
    );
    expect(
      container.querySelector('[data-testid="card-5-input-0"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="card-5-input-1"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="card-5-input-2"]')
    ).not.toBeNull();
  });

  it("remove buttons expose 1-indexed aria-labels: 'Remove creator 1' / 'Remove creator 2' / ...", () => {
    const { container } = render(
      <ReferenceCreatorsInput
        value={[
          { handle_or_url: "@a" },
          { handle_or_url: "@b" },
          { handle_or_url: "@c" },
        ]}
        onChange={() => {}}
      />
    );
    expect(
      container.querySelector('[aria-label="Remove creator 1"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[aria-label="Remove creator 2"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[aria-label="Remove creator 3"]')
    ).not.toBeNull();
  });

  it("typing into a row emits onChange with the row's handle_or_url updated", () => {
    const onChange = vi.fn();
    const value: ReferenceCreatorEntry[] = [{ handle_or_url: "" }];
    const { container } = render(
      <ReferenceCreatorsInput value={value} onChange={onChange} />
    );
    const input = container.querySelector(
      '[data-testid="card-5-input-0"]'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "@charlidamelio" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]?.[0] as ReferenceCreatorEntry[];
    expect(next).toHaveLength(1);
    expect(next[0]?.handle_or_url).toBe("@charlidamelio");
  });

  it("clicking the +Add button emits an extended array with a new empty entry", () => {
    const onChange = vi.fn();
    const value: ReferenceCreatorEntry[] = [{ handle_or_url: "@a" }];
    const { container } = render(
      <ReferenceCreatorsInput value={value} onChange={onChange} />
    );
    fireEvent.click(
      container.querySelector('[data-testid="card-5-add"]') as HTMLElement
    );
    const next = onChange.mock.calls[0]?.[0] as ReferenceCreatorEntry[];
    expect(next).toHaveLength(2);
    expect(next[0]?.handle_or_url).toBe("@a");
    expect(next[1]?.handle_or_url).toBe("");
  });

  it("clicking a remove button emits an array with that entry filtered out", () => {
    const onChange = vi.fn();
    const value: ReferenceCreatorEntry[] = [
      { handle_or_url: "@a" },
      { handle_or_url: "@b" },
      { handle_or_url: "@c" },
    ];
    const { container } = render(
      <ReferenceCreatorsInput value={value} onChange={onChange} />
    );
    fireEvent.click(
      container.querySelector('[aria-label="Remove creator 2"]') as HTMLElement
    );
    const next = onChange.mock.calls[0]?.[0] as ReferenceCreatorEntry[];
    expect(next).toHaveLength(2);
    expect(next.map((e) => e.handle_or_url)).toEqual(["@a", "@c"]);
  });
});
