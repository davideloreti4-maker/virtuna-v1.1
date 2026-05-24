/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import {
  WinsFlopsInput,
  type UrlEntry,
} from "@/components/app/cards/wins-flops-input";

/**
 * PROFILE-09 — Card 6 dual 2+2 URL list. Two columns:
 * - "Past wins" — up to 2 URLs, +Add hidden at 2
 * - "Past flops" — up to 2 URLs, +Add hidden at 2
 *
 * aria-labels must be 1-indexed: "Remove win 1" / "Remove win 2" / "Remove flop 1" / "Remove flop 2"
 * onChange always emits the FULL {wins, flops} object — the other column is preserved.
 */
describe("WinsFlopsInput (PROFILE-09 — 2+2 cap, aria-labels)", () => {
  it("renders both columns with stable testids when both arrays are empty", () => {
    const { container } = render(
      <WinsFlopsInput wins={[]} flops={[]} onChange={() => {}} />
    );
    expect(
      container.querySelector('[data-testid="card-6-win-0"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="card-6-flop-0"]')
    ).not.toBeNull();
  });

  it("renders both +Add buttons when both columns are under cap", () => {
    const { container } = render(
      <WinsFlopsInput
        wins={[{ url: "https://tt.com/a" }]}
        flops={[]}
        onChange={() => {}}
      />
    );
    expect(
      container.querySelector('[data-testid="card-6-win-add"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="card-6-flop-add"]')
    ).not.toBeNull();
  });

  it("HIDES the +Add button on the wins column when wins.length === 2", () => {
    const { container } = render(
      <WinsFlopsInput
        wins={[{ url: "https://tt.com/a" }, { url: "https://tt.com/b" }]}
        flops={[]}
        onChange={() => {}}
      />
    );
    expect(
      container.querySelector('[data-testid="card-6-win-add"]')
    ).toBeNull();
    // Flop column still has its +Add since it's empty
    expect(
      container.querySelector('[data-testid="card-6-flop-add"]')
    ).not.toBeNull();
  });

  it("HIDES the +Add button on the flops column when flops.length === 2", () => {
    const { container } = render(
      <WinsFlopsInput
        wins={[]}
        flops={[{ url: "https://tt.com/a" }, { url: "https://tt.com/b" }]}
        onChange={() => {}}
      />
    );
    expect(
      container.querySelector('[data-testid="card-6-flop-add"]')
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="card-6-win-add"]')
    ).not.toBeNull();
  });

  it("exposes exact 1-indexed aria-labels for win remove buttons", () => {
    const { container } = render(
      <WinsFlopsInput
        wins={[{ url: "https://tt.com/a" }, { url: "https://tt.com/b" }]}
        flops={[]}
        onChange={() => {}}
      />
    );
    expect(
      container.querySelector('[aria-label="Remove win 1"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[aria-label="Remove win 2"]')
    ).not.toBeNull();
  });

  it("exposes exact 1-indexed aria-labels for flop remove buttons", () => {
    const { container } = render(
      <WinsFlopsInput
        wins={[]}
        flops={[{ url: "https://tt.com/a" }, { url: "https://tt.com/b" }]}
        onChange={() => {}}
      />
    );
    expect(
      container.querySelector('[aria-label="Remove flop 1"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[aria-label="Remove flop 2"]')
    ).not.toBeNull();
  });

  it("typing in a win input emits onChange preserving the flops column", () => {
    const onChange = vi.fn();
    const { container } = render(
      <WinsFlopsInput
        wins={[]}
        flops={[{ url: "https://tt.com/flop1" }]}
        onChange={onChange}
      />
    );
    const winInput = container.querySelector(
      '[data-testid="card-6-win-0"]'
    ) as HTMLInputElement;
    fireEvent.change(winInput, { target: { value: "https://tt.com/win1" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const arg = onChange.mock.calls[0]?.[0] as {
      wins: UrlEntry[];
      flops: UrlEntry[];
    };
    expect(arg.wins).toHaveLength(1);
    expect(arg.wins[0]?.url).toBe("https://tt.com/win1");
    expect(arg.flops).toHaveLength(1);
    expect(arg.flops[0]?.url).toBe("https://tt.com/flop1");
  });

  it("typing in a flop input emits onChange preserving the wins column", () => {
    const onChange = vi.fn();
    const { container } = render(
      <WinsFlopsInput
        wins={[{ url: "https://tt.com/win1" }]}
        flops={[]}
        onChange={onChange}
      />
    );
    const flopInput = container.querySelector(
      '[data-testid="card-6-flop-0"]'
    ) as HTMLInputElement;
    fireEvent.change(flopInput, { target: { value: "https://tt.com/flop1" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const arg = onChange.mock.calls[0]?.[0] as {
      wins: UrlEntry[];
      flops: UrlEntry[];
    };
    expect(arg.wins).toHaveLength(1);
    expect(arg.wins[0]?.url).toBe("https://tt.com/win1");
    expect(arg.flops).toHaveLength(1);
    expect(arg.flops[0]?.url).toBe("https://tt.com/flop1");
  });

  it("clicking +Add on wins emits an extended wins array preserving flops", () => {
    const onChange = vi.fn();
    const { container } = render(
      <WinsFlopsInput
        wins={[{ url: "https://tt.com/a" }]}
        flops={[{ url: "https://tt.com/x" }]}
        onChange={onChange}
      />
    );
    fireEvent.click(
      container.querySelector(
        '[data-testid="card-6-win-add"]'
      ) as HTMLElement
    );
    const arg = onChange.mock.calls[0]?.[0] as {
      wins: UrlEntry[];
      flops: UrlEntry[];
    };
    expect(arg.wins).toHaveLength(2);
    expect(arg.wins[1]?.url).toBe("");
    expect(arg.flops).toHaveLength(1);
    expect(arg.flops[0]?.url).toBe("https://tt.com/x");
  });

  it("clicking a remove button on wins emits a filtered wins array preserving flops", () => {
    const onChange = vi.fn();
    const { container } = render(
      <WinsFlopsInput
        wins={[{ url: "a" }, { url: "b" }]}
        flops={[{ url: "x" }]}
        onChange={onChange}
      />
    );
    fireEvent.click(
      container.querySelector('[aria-label="Remove win 1"]') as HTMLElement
    );
    const arg = onChange.mock.calls[0]?.[0] as {
      wins: UrlEntry[];
      flops: UrlEntry[];
    };
    expect(arg.wins).toHaveLength(1);
    expect(arg.wins[0]?.url).toBe("b");
    expect(arg.flops).toHaveLength(1);
    expect(arg.flops[0]?.url).toBe("x");
  });
});
