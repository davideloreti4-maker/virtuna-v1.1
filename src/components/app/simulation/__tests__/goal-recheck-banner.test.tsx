/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GoalRecheckBanner } from "../goal-recheck-banner";

describe("GoalRecheckBanner", () => {
  const defaultGoal = "grow my channel to 100k";

  it("renders the goal text in the banner question", () => {
    render(<GoalRecheckBanner goal={defaultGoal} onDismiss={() => {}} />);
    expect(screen.getByText(/Quick check/)).toBeInTheDocument();
    expect(screen.getByText(defaultGoal)).toBeInTheDocument();
  });

  it("renders the goal text with accent color", () => {
    render(<GoalRecheckBanner goal={defaultGoal} onDismiss={() => {}} />);
    const goalSpan = screen.getByText(defaultGoal);
    expect(goalSpan.className).toContain("text-accent");
    expect(goalSpan.className).toContain("font-medium");
  });

  it("renders the 'Yes, still right' dismiss button", () => {
    render(<GoalRecheckBanner goal={defaultGoal} onDismiss={() => {}} />);
    expect(screen.getByText("Yes, still right")).toBeInTheDocument();
  });

  it("calls onDismiss when dismiss button is clicked", () => {
    const onDismiss = vi.fn();
    render(<GoalRecheckBanner goal={defaultGoal} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText("Yes, still right"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("hides the banner after dismiss button is clicked", () => {
    const { container } = render(
      <GoalRecheckBanner goal={defaultGoal} onDismiss={() => {}} />
    );
    expect(
      container.querySelector('[data-testid="goal-recheck-banner"]')
    ).not.toBeNull();
    fireEvent.click(screen.getByText("Yes, still right"));
    expect(
      container.querySelector('[data-testid="goal-recheck-banner"]')
    ).toBeNull();
  });

  it("renders with the correct testid", () => {
    const { container } = render(
      <GoalRecheckBanner goal={defaultGoal} onDismiss={() => {}} />
    );
    expect(
      container.querySelector('[data-testid="goal-recheck-banner"]')
    ).not.toBeNull();
  });
});
