/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SurfaceErrorState } from "@/components/ui/surface-error-state";

/**
 * Guards the house-style error banner — one shape for every surface that fails
 * to load and offers a Retry. role="alert" + the shipped red wash, never a
 * per-surface hand-roll.
 */
describe("SurfaceErrorState", () => {
  it("announces as an alert with the red banner contract", () => {
    render(<SurfaceErrorState message="Couldn't load your feed." />);
    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("border-red-500/20");
    expect(screen.getByText("Couldn't load your feed.")).toBeTruthy();
  });

  it("renders Retry and fires onRetry", () => {
    const onRetry = vi.fn();
    render(<SurfaceErrorState message="boom" onRetry={onRetry} retryLabel="Retry" />);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("hides Retry when no handler is given", () => {
    render(<SurfaceErrorState message="boom" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("stacked variant switches to a column layout", () => {
    render(<SurfaceErrorState stacked message="long streamed error" onRetry={() => {}} />);
    expect(screen.getByRole("alert").className).toContain("flex-col");
  });
});
