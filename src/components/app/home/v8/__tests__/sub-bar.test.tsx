/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ComposerSubBar } from "../sub-bar";
import type { Audience } from "@/lib/audience/audience-types";

const audience = { name: "Your people", personas: [], is_general: false } as unknown as Audience;

function renderBar(over: Partial<Parameters<typeof ComposerSubBar>[0]> = {}) {
  return render(
    <ComposerSubBar
      audience={audience}
      watching={false}
      lensLabel="TikTok"
      onOpenAudience={vi.fn()}
      {...over}
    />,
  );
}

describe("ComposerSubBar", () => {
  it("names the audience and the lens; tap opens the audience sheet", () => {
    const onOpenAudience = vi.fn();
    renderBar({ onOpenAudience });
    const control = screen.getByRole("button", { name: "Choose audience and platform" });
    expect(control.textContent).toContain("Your people · TikTok");
    fireEvent.click(control);
    expect(onOpenAudience).toHaveBeenCalled();
  });

  it("is CONTEXT ONLY — no Simulate door, no second control (2026-08-09 rail ruling)", () => {
    renderBar();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByText(/simulate/i)).toBeNull();
  });

  it("signals an in-flight run on the live dot — it never navigates", () => {
    renderBar({ watching: true });
    expect(screen.getByTestId("composer-sub-bar").dataset.watching).toBe("true");
    expect(screen.getByTestId("sub-bar-live-dot").className).toContain("animate-pulse");
    expect(screen.queryByText(/watching/i)).toBeNull();
  });

  it("the live dot is the only accent", () => {
    const { container } = renderBar();
    expect(screen.getByTestId("sub-bar-live-dot")).toBeInTheDocument();
    expect(container.querySelectorAll("[class*='accent']").length).toBe(1);
  });
});
