/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  SurfaceEmptyState,
  EmptyStateIcon,
} from "@/components/ui/surface-empty-state";

/**
 * Guards the house-style empty state (ratified 2026-07-06, "A — Quiet tile").
 * The whole point of the shared primitive is one consistent tile: filled
 * `bg-background-elevated`, solid 6% border, never dashed, never borderless.
 */
describe("SurfaceEmptyState", () => {
  it("renders the quiet-tile contract: filled bg + solid 6% border, no dashed", () => {
    const { container } = render(
      <SurfaceEmptyState title="No reads yet">They&apos;ll show here.</SurfaceEmptyState>,
    );
    const tile = container.firstElementChild as HTMLElement;
    expect(tile.className).toContain("bg-background-elevated");
    expect(tile.className).toContain("border-white/[0.06]");
    expect(tile.className).not.toContain("dashed");
  });

  it("renders icon, title, subtext, and a single action", () => {
    render(
      <SurfaceEmptyState
        icon={<EmptyStateIcon>*</EmptyStateIcon>}
        title="No competitors tracked yet"
        action={<button type="button">Add Competitor</button>}
      >
        Track their growth.
      </SurfaceEmptyState>,
    );
    expect(screen.getByText("No competitors tracked yet")).toBeTruthy();
    expect(screen.getByText("Track their growth.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add Competitor" })).toBeTruthy();
  });

  it("compact variant drops the tall min-height", () => {
    const { container } = render(
      <SurfaceEmptyState compact title="No channels yet">
        Add channels.
      </SurfaceEmptyState>,
    );
    const tile = container.firstElementChild as HTMLElement;
    expect(tile.className).not.toContain("min-h-[360px]");
    expect(tile.className).toContain("py-10");
  });

  it("forwards passthrough props (e.g. aria-label) to the tile", () => {
    const { container } = render(
      <SurfaceEmptyState aria-label="empty" title="x" />,
    );
    expect(
      (container.firstElementChild as HTMLElement).getAttribute("aria-label"),
    ).toBe("empty");
  });
});
