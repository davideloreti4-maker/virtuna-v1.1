/** @vitest-environment happy-dom */

/**
 * SmallGauge — the gauge every text answer carries (spec §3 rule 4), rendered for real. Its four
 * states: empty (a button that simulates), waiting (the dimmed track), running (the dotted ring)
 * and done (the ink arc and the number). Only the empty one is a control.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { GaugeSlot, SmallGauge } from "../answer-gauge";

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

  it("the number alone in the ring, no unit (a 7 px '%' read as dirt; the pack's header says 'out of 100')", () => {
    render(<SmallGauge state={{ kind: "done", value: 45 }} label={HOOK} />);
    expect(screen.getByRole("img").querySelector("text")!.textContent).toBe("45");
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

describe("SmallGauge — a simulated gauge links to its result (step 2, fix round 1)", () => {
  it("done with an href: ONE link named after the text, described by the number, its data kept", () => {
    render(<SmallGauge state={{ kind: "done", value: 30 }} label={HOOK} href="/simulation/hook/t/k" />);
    const link = screen.getByRole("link");
    const name = link.getAttribute("aria-label") ?? "";
    expect(name.startsWith("Open the result: I spent $40 on meal prep")).toBe(true);
    expect(name.length).toBeLessThanOrEqual("Open the result: ".length + 60);
    expect(link).toHaveAccessibleDescription("30% would stop to watch");
    expect(link).toHaveAttribute("href", "/simulation/hook/t/k");
    expect(link).toHaveAttribute("data-gauge", "done");
    expect(link).toHaveAttribute("data-value", "30");
    expect(link.className.split(/\s+/)).toEqual(expect.arrayContaining(["tap-44", "rounded-full", "pointer-events-auto"]));
  });

  it("done without an href: the number as before, no link", () => {
    render(<SmallGauge state={{ kind: "done", value: 30 }} label={HOOK} href={null} />);
    expect(screen.getByRole("img", { name: "30% would stop to watch" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("GaugeSlot — the link to the result (step 2)", () => {
  const OPENER = "I fed 10 million viral videos into an AI to simulate your exact audience.";

  it("simulated with a page: 'would stop to watch' and a chevron, one link named after the text", () => {
    render(<GaugeSlot state={{ kind: "done", value: 41 }} label="Simulate the opening" text={OPENER} href="/simulation/hook/t/k?as=opening" />);
    const link = screen.getByRole("link", { name: /^Open the result: I fed 10 million/ });
    expect(link).toHaveAttribute("href", "/simulation/hook/t/k?as=opening");
    expect(link).toHaveTextContent("would stop to watch");
    // The name replaces the content, so the number is read as the link's description (fix round 1).
    expect(link).toHaveAccessibleDescription("41% would stop to watch");
  });

  it("simulated without a page (key not known yet): no link", () => {
    render(<GaugeSlot state={{ kind: "done", value: 41 }} label="Simulate the opening" text={OPENER} href={null} />);
    expect(screen.getByText("would stop to watch")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("not simulated: still the Simulate button, whatever the href", () => {
    render(<GaugeSlot state={{ kind: "empty" }} label="Simulate the opening" text={OPENER} href="/x" onSimulate={() => {}} />);
    expect(screen.getByRole("button", { name: /^Simulate the opening: / })).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
