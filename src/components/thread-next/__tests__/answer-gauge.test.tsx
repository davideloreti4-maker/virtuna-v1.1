/** @vitest-environment happy-dom */

/**
 * SmallGauge — the gauge every text answer carries (spec §3 rule 4), rendered for real. Its four
 * states: empty (a button that simulates), waiting (the dimmed track), running (the dotted ring)
 * and done (the ink arc and the number). Only the empty one is a control.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { SmallGauge } from "../answer-gauge";

afterEach(cleanup);

const HOOK = "I spent $40 on meal prep and it tasted like regret. Here is the $5 version that actually keeps me alive during finals.";

describe("SmallGauge", () => {
  it("empty: a button named after the text it simulates, cut to 60 characters", () => {
    const onSimulate = vi.fn();
    render(<SmallGauge state={{ kind: "empty" }} label={HOOK} onSimulate={onSimulate} />);
    const button = screen.getByRole("button");
    const name = button.getAttribute("aria-label") ?? "";
    expect(name.startsWith("Simulate: I spent $40 on meal prep")).toBe(true);
    expect(name.slice("Simulate: ".length).length).toBeLessThanOrEqual(60);
    expect(name.endsWith("…")).toBe(true);
    fireEvent.click(button);
    expect(onSimulate).toHaveBeenCalledTimes(1);
  });

  it("empty with a short text: the whole text, no ellipsis", () => {
    render(<SmallGauge state={{ kind: "empty" }} label="Rest Is Part of the Work" onSimulate={() => {}} />);
    expect(screen.getByRole("button", { name: "Simulate: Rest Is Part of the Work" })).toBeEnabled();
  });

  it("empty without a handler: the button is there and disabled", () => {
    render(<SmallGauge state={{ kind: "empty" }} label="A hook" />);
    expect(screen.getByRole("button", { name: "Simulate: A hook" })).toBeDisabled();
  });

  it("done: the number, named as the share that would stop, and no button", () => {
    render(<SmallGauge state={{ kind: "done", value: 45 }} label={HOOK} />);
    expect(screen.queryByRole("button")).toBeNull();
    const gauge = screen.getByRole("img", { name: "45% would stop to watch" });
    expect(gauge).toHaveTextContent("45");
  });

  it("done at 0: the number, no arc", () => {
    const { container } = render(<SmallGauge state={{ kind: "done", value: 0 }} label="A hook" />);
    expect(screen.getByRole("img", { name: "0% would stop to watch" })).toHaveTextContent("0");
    expect(container.querySelector('[data-part="value"]')).toBeNull();
  });

  it("running: the dotted ring, named Simulating, not a button", () => {
    const { container } = render(<SmallGauge state={{ kind: "running" }} label="A hook" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("img", { name: "Simulating" })).toBeInTheDocument();
    expect(container.querySelectorAll("circle, path[data-part='dots']").length).toBeGreaterThan(0);
  });

  it("running: the ring turns only when motion is allowed", () => {
    const { container } = render(<SmallGauge state={{ kind: "running" }} label="A hook" />);
    const ring = container.querySelector('[data-part="ring"]');
    expect(ring?.getAttribute("class") ?? "").toMatch(/motion-safe:animate-/);
    expect(ring?.getAttribute("class") ?? "").not.toMatch(/(^|\s)animate-/);
  });

  it("waiting: the track alone, not a button, no number", () => {
    const { container } = render(<SmallGauge state={{ kind: "waiting" }} label="A hook" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector('[data-part="track"]')).not.toBeNull();
    expect(container.querySelector('[data-part="value"]')).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("draws at the asked size", () => {
    const { container } = render(<SmallGauge state={{ kind: "done", value: 30 }} size={30} label="A hook" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("30");
    expect(svg?.getAttribute("height")).toBe("30");
  });
});
