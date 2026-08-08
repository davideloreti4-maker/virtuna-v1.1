/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ComposerSubBar } from "../sub-bar";
import type { Audience } from "@/lib/audience/audience-types";

const audience = { name: "Your people", personas: [], is_general: false } as unknown as Audience;

describe("ComposerSubBar", () => {
  it("left half names the audience and the lens; tap opens the audience sheet", () => {
    const onOpenAudience = vi.fn();
    render(
      <ComposerSubBar
        audience={audience}
        watching={false}
        lensLabel="TikTok"
        onOpenAudience={onOpenAudience}
        onOpenSim={vi.fn()}
      />,
    );
    const left = screen.getByRole("button", { name: "Choose audience and platform" });
    expect(left.textContent).toContain("Your people · TikTok");
    fireEvent.click(left);
    expect(onOpenAudience).toHaveBeenCalled();
  });

  it("right half is the Simulate door at idle", () => {
    const onOpenSim = vi.fn();
    render(
      <ComposerSubBar
        audience={audience}
        watching={false}
        lensLabel="TikTok"
        onOpenAudience={vi.fn()}
        onOpenSim={onOpenSim}
      />,
    );
    const right = screen.getByRole("button", { name: "Open the simulation room" });
    expect(right.textContent).toContain("Simulate");
    fireEvent.click(right);
    expect(onOpenSim).toHaveBeenCalled();
  });

  it("reads watching… while a run is in flight", () => {
    render(
      <ComposerSubBar
        audience={audience}
        watching
        lensLabel="TikTok"
        onOpenAudience={vi.fn()}
        onOpenSim={vi.fn()}
      />,
    );
    expect(screen.getByText("watching…")).toBeInTheDocument();
  });

  it("the live dot is the only accent", () => {
    const { container } = render(
      <ComposerSubBar
        audience={audience}
        watching={false}
        lensLabel="TikTok"
        onOpenAudience={vi.fn()}
        onOpenSim={vi.fn()}
      />,
    );
    expect(screen.getByTestId("sub-bar-live-dot")).toBeInTheDocument();
    expect(container.querySelectorAll("[class*='accent']").length).toBe(1);
  });
});
