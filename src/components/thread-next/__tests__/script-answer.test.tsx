/** @vitest-environment happy-dom */

/**
 * ScriptAnswer — the script card (spec §4.3), rendered for real from the drawing's script
 * (`SCRIPT_AI`). Times and the total come from the beats' free-text timings through the real
 * `timingStart` / `timingEnd` / `clockLabel`; a timing that does not parse shows no time.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import type { GaugeState } from "../answer-gauge";
import { ScriptAnswer } from "../script-answer";
import { SCRIPT_AI, script } from "./fixtures/answers";

afterEach(cleanup);

const empty: GaugeState = { kind: "empty" };
const beats = () => Array.from(document.querySelectorAll<HTMLElement>('[data-part="beat"]'));

describe("ScriptAnswer", () => {
  it("header 'Script' with the total from the last beat's end; each beat its start", () => {
    render(<ScriptAnswer block={SCRIPT_AI} opener={{ state: empty }} />);
    expect(screen.getByText("Script")).toBeInTheDocument();
    expect(screen.getByText("0:24")).toBeInTheDocument();
    const rows = beats();
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.querySelector('[data-part="time"]')?.textContent)).toEqual(["0:00", "0:03", "0:08", "0:14", "0:20"]);
    expect(rows[0]).toHaveTextContent("I fed 10 million viral videos into an AI to simulate your exact audience.");
    expect(rows[4]).toHaveTextContent("Comment “sim” and I’ll run your video next.");
  });

  it("shows no times and no total when the timings do not parse", () => {
    const block = script([
      { content: "Open on the empty fridge.", timing: "soon" },
      { content: "Then the five-dollar fix.", timing: "after that" },
    ]);
    render(<ScriptAnswer block={block} opener={{ state: empty }} />);
    expect(screen.getByText("Script")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\d:\d\d/);
    expect(beats()).toHaveLength(2);
    for (const row of beats()) expect(row.querySelector('[data-part="time"]')?.textContent ?? "").toBe("");
  });

  it("a beat that parses keeps its time; no total when the last one does not", () => {
    const block = script([
      { content: "Open on the empty fridge.", timing: "0–3s" },
      { content: "Then the five-dollar fix.", timing: "the rest" },
    ]);
    render(<ScriptAnswer block={block} opener={{ state: empty }} />);
    expect(beats().map((r) => r.querySelector('[data-part="time"]')?.textContent ?? "")).toEqual(["0:00", ""]);
    expect(screen.queryByText("0:03")).toBeNull();
  });

  it("the opening's slot: 'Simulate the opening' and '1 credit', named after the opening, calls onSimulate", () => {
    const onSimulate = vi.fn();
    render(<ScriptAnswer block={SCRIPT_AI} opener={{ state: empty, onSimulate }} />);
    const slot = screen.getByRole("button", { name: /^Simulate the opening: I fed 10 million viral videos/ });
    expect(slot).toHaveTextContent("Simulate the opening");
    expect(slot).toHaveTextContent("1 credit");
    expect(slot).toHaveAccessibleDescription("1 credit");
    // The slot sits under the opening beat.
    expect(beats()[0]!.contains(slot)).toBe(true);
    fireEvent.click(slot);
    expect(onSimulate).toHaveBeenCalledTimes(1);
  });

  it("the opening simulated: the gauge with its number and 'would stop to watch', no price", () => {
    render(<ScriptAnswer block={SCRIPT_AI} opener={{ state: { kind: "done", value: 41 } }} />);
    expect(screen.getByRole("img", { name: "41% would stop to watch" })).toBeInTheDocument();
    expect(screen.getByText("would stop to watch")).toBeInTheDocument();
    expect(screen.queryByText("Simulate the opening")).toBeNull();
    expect(screen.queryByText(/credit/)).toBeNull();
  });

  it("the opening running: the small ring and 'Simulating'", () => {
    render(<ScriptAnswer block={SCRIPT_AI} opener={{ state: { kind: "running" } }} />);
    expect(screen.getAllByRole("img", { name: "Simulating" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Simulate the opening/ })).toBeNull();
  });

  it("'Add your take' is free and calls onAddTake", () => {
    const onAddTake = vi.fn();
    render(<ScriptAnswer block={SCRIPT_AI} opener={{ state: empty }} onAddTake={onAddTake} />);
    const button = screen.getByRole("button", { name: "Add your take" });
    expect(button).not.toHaveTextContent(/credit/);
    fireEvent.click(button);
    expect(onAddTake).toHaveBeenCalledTimes(1);
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <ScriptAnswer block={SCRIPT_AI} opener={{ state: empty, onSimulate: () => {} }} onAddTake={() => {}} />,
    );
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});
