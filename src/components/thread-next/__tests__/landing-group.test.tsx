/** @vitest-environment happy-dom */

/**
 * LandingGroup (thread feel §4.3, rulings 11): the answer's parts and chips, inside the one element
 * the landing's CSS keys on (`[data-thread-landing] .land`), carrying how long ago it landed, and only
 * for the landing's window.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { LANDING_WINDOW_MS } from "@/lib/thread-next/landing";

import { LandingGroup } from "../landing-group";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("LandingGroup", () => {
  it("null: the children, and no element of its own", () => {
    const { container } = render(
      <LandingGroup sinceMs={null}>
        <p data-testid="part">A part</p>
      </LandingGroup>,
    );
    expect(container.firstElementChild).toBe(container.querySelector('[data-testid="part"]'));
    expect(container.querySelector("[data-thread-landing]")).toBeNull();
  });

  it("a number: one element that leaves the layout to its parent, `--landed` the negative ms", () => {
    const { container } = render(
      <LandingGroup sinceMs={300}>
        <p data-testid="part">A part</p>
      </LandingGroup>,
    );
    const group = container.querySelector<HTMLElement>("[data-thread-landing]")!;
    expect(group).toBe(container.firstElementChild);
    expect(group).toHaveClass("contents");
    expect(group.style.getPropertyValue("--landed")).toBe("-300ms");
    expect(group.querySelector('[data-testid="part"]')).not.toBeNull();
  });

  it("a landing that starts now is at 0 ms", () => {
    const { container } = render(<LandingGroup sinceMs={0}>x</LandingGroup>);
    expect(container.querySelector<HTMLElement>("[data-thread-landing]")!.style.getPropertyValue("--landed")).toBe("0ms");
  });

  it("keeps the first value it was given", () => {
    const { container, rerender } = render(<LandingGroup sinceMs={120}>x</LandingGroup>);
    const group = container.querySelector<HTMLElement>("[data-thread-landing]")!;
    rerender(<LandingGroup sinceMs={900}>x</LandingGroup>);
    expect(container.querySelector("[data-thread-landing]")).toBe(group);
    expect(group.style.getPropertyValue("--landed")).toBe("-120ms");
    rerender(<LandingGroup sinceMs={null}>x</LandingGroup>);
    expect(container.querySelector("[data-thread-landing]")).toBe(group);
  });

  it("the window over (LANDING_WINDOW_MS after the landing): the same element and parts, no longer a landing, so a part mounted later inside it is at rest", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(
      <LandingGroup sinceMs={300}>
        <p data-testid="part">A part</p>
      </LandingGroup>,
    );
    const group = container.querySelector<HTMLElement>("[data-thread-landing]")!;
    const part = screen.getByTestId("part");
    // Mounted 300 ms into the landing: its window ends 1,300 ms from now.
    act(() => vi.advanceTimersByTime(LANDING_WINDOW_MS - 300 - 1));
    expect(group).toHaveAttribute("data-thread-landing");
    act(() => vi.advanceTimersByTime(1));
    expect(group).not.toHaveAttribute("data-thread-landing");
    expect(container.firstElementChild).toBe(group);
    expect(group).toHaveClass("contents");
    expect(screen.getByTestId("part")).toBe(part); // not mounted again

    // The chips back after a simulation, a remix page's new step: no landing to rise in.
    rerender(
      <LandingGroup sinceMs={300}>
        <p data-testid="part">A part</p>
        <p data-testid="late" className="land">
          Chips
        </p>
      </LandingGroup>,
    );
    expect(screen.getByTestId("late").closest("[data-thread-landing]")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("one timer, cleared when it unmounts inside the window; none for a group at rest", () => {
    vi.useFakeTimers();
    const landing = render(<LandingGroup sinceMs={0}>x</LandingGroup>);
    expect(vi.getTimerCount()).toBe(1);
    landing.unmount();
    expect(vi.getTimerCount()).toBe(0);
    render(<LandingGroup sinceMs={null}>x</LandingGroup>);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("the landing's CSS keys on the same attribute (globals.css); `.land` never on the result page's `data-landing`", () => {
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toMatch(/\[data-thread-landing\] \.land \{/);
    expect(css).not.toMatch(/\[data-landing\] \.land/);
  });

  it("first null, later a number: stays without the element (a turn drawn at rest stays at rest)", () => {
    const { container, rerender } = render(<LandingGroup sinceMs={null}>x</LandingGroup>);
    rerender(<LandingGroup sinceMs={0}>x</LandingGroup>);
    expect(container.querySelector("[data-thread-landing]")).toBeNull();
  });
});
