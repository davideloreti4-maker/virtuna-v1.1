/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { GoalStagePicker } from "@/components/app/cards/goal-stage-picker";

/**
 * PROFILE-06 — Card 3 split onChange contract: clicking a goal tile keeps the
 * existing stage; clicking a stage tile keeps the existing goal. Each click
 * emits the FULL {goal, stage} pair.
 */
describe("GoalStagePicker (PROFILE-06)", () => {
  it("renders all four goal tiles with stable data-testid selectors", () => {
    const { container } = render(
      <GoalStagePicker goal={null} stage={null} onChange={() => {}} />
    );
    expect(
      container.querySelector('[data-testid="card-3-goal-growth"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="card-3-goal-engagement"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="card-3-goal-brand_deals"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="card-3-goal-conversion"]')
    ).not.toBeNull();
  });

  it("renders all three stage tiles with stable data-testid selectors", () => {
    const { container } = render(
      <GoalStagePicker goal={null} stage={null} onChange={() => {}} />
    );
    expect(
      container.querySelector('[data-testid="card-3-stage-new"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="card-3-stage-growing"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="card-3-stage-established"]')
    ).not.toBeNull();
  });

  it("clicking a goal tile emits {goal: <new>, stage: <existing>}", () => {
    const onChange = vi.fn();
    const { container } = render(
      <GoalStagePicker goal={null} stage="growing" onChange={onChange} />
    );
    fireEvent.click(
      container.querySelector(
        '[data-testid="card-3-goal-growth"]'
      ) as HTMLElement
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      goal: "growth",
      stage: "growing", // preserved
    });
  });

  it("clicking a stage tile emits {goal: <existing>, stage: <new>}", () => {
    const onChange = vi.fn();
    const { container } = render(
      <GoalStagePicker
        goal="engagement"
        stage={null}
        onChange={onChange}
      />
    );
    fireEvent.click(
      container.querySelector(
        '[data-testid="card-3-stage-established"]'
      ) as HTMLElement
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      goal: "engagement", // preserved
      stage: "established",
    });
  });

  it("aria-pressed reflects only the selected goal tile", () => {
    const { container } = render(
      <GoalStagePicker
        goal="brand_deals"
        stage={null}
        onChange={() => {}}
      />
    );
    expect(
      container
        .querySelector('[data-testid="card-3-goal-brand_deals"]')
        ?.getAttribute("aria-pressed")
    ).toBe("true");
    expect(
      container
        .querySelector('[data-testid="card-3-goal-growth"]')
        ?.getAttribute("aria-pressed")
    ).toBe("false");
    expect(
      container
        .querySelector('[data-testid="card-3-goal-engagement"]')
        ?.getAttribute("aria-pressed")
    ).toBe("false");
    expect(
      container
        .querySelector('[data-testid="card-3-goal-conversion"]')
        ?.getAttribute("aria-pressed")
    ).toBe("false");
  });

  it("aria-pressed reflects only the selected stage tile", () => {
    const { container } = render(
      <GoalStagePicker
        goal={null}
        stage="new"
        onChange={() => {}}
      />
    );
    expect(
      container
        .querySelector('[data-testid="card-3-stage-new"]')
        ?.getAttribute("aria-pressed")
    ).toBe("true");
    expect(
      container
        .querySelector('[data-testid="card-3-stage-growing"]')
        ?.getAttribute("aria-pressed")
    ).toBe("false");
    expect(
      container
        .querySelector('[data-testid="card-3-stage-established"]')
        ?.getAttribute("aria-pressed")
    ).toBe("false");
  });

  it("clicking goal preserves null stage when stage is null", () => {
    const onChange = vi.fn();
    const { container } = render(
      <GoalStagePicker goal={null} stage={null} onChange={onChange} />
    );
    fireEvent.click(
      container.querySelector(
        '[data-testid="card-3-goal-conversion"]'
      ) as HTMLElement
    );
    expect(onChange).toHaveBeenCalledWith({
      goal: "conversion",
      stage: null,
    });
  });
});
