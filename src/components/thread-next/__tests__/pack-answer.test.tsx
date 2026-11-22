/** @vitest-environment happy-dom */

/**
 * PackAnswer — the hook and idea pack (spec §4.1, §4.2), rendered for real from the drawing's
 * fixtures. The numbers come from the fixture seals through the real `stopNumberOf`, as the
 * thread will read them; `leadOf` (real) decides Best and the primary.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { stopNumberOf } from "@/lib/thread-next/stop-number";
import type { GaugeState } from "../answer-gauge";
import { PackAnswer, type PackRow } from "../pack-answer";
import { IDEAS_4, MEAL_PREP_HOOKS, SEALS_DONE } from "./fixtures/answers";

afterEach(cleanup);

const HOOKS = MEAL_PREP_HOOKS.map((b) => b.props.hookLine);

function hookRows(states: GaugeState[], failed: number[] = []): PackRow[] {
  return HOOKS.map((text, i) => ({ key: text, text, state: states[i]!, failed: failed.includes(i) }));
}

const empty: GaugeState = { kind: "empty" };
const done = (value: number): GaugeState => ({ kind: "done", value });

/** The fixture seals, read the way the thread reads them. */
const sealed = HOOKS.map((text) => done(stopNumberOf(SEALS_DONE[text])!));

const rows = () => screen.getAllByRole("listitem");
const primary = (name: RegExp) => screen.getByRole("button", { name });

describe("PackAnswer — hooks", () => {
  it("not simulated: empty gauges, '1 credit each', primary 'Simulate all 3' with '3 credits'", () => {
    const onSimulateAll = vi.fn();
    render(<PackAnswer kind="hook" rows={hookRows([empty, empty, empty])} queue={null} onSimulate={() => {}} onSimulateAll={onSimulateAll} />);
    expect(screen.getByText("Would stop to watch")).toBeInTheDocument();
    expect(screen.getByText("1 credit each")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Simulate: / })).toHaveLength(3);
    const button = primary(/Simulate all 3/);
    expect(button).toHaveTextContent("3 credits");
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onSimulateAll).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Best")).toBeNull();
  });

  it("tapping an empty gauge calls onSimulate with that row's key", () => {
    const onSimulate = vi.fn();
    render(<PackAnswer kind="hook" rows={hookRows([empty, empty, empty])} queue={null} onSimulate={onSimulate} />);
    fireEvent.click(within(rows()[1]!).getByRole("button", { name: /^Simulate: Stop eating sad desk lunch/ }));
    expect(onSimulate).toHaveBeenCalledWith(HOOKS[1]);
  });

  it("counts only the rows not simulated: one done, two to go ('Simulate the rest')", () => {
    render(<PackAnswer kind="hook" rows={hookRows([done(30), empty, empty])} queue={null} onSimulateAll={() => {}} />);
    expect(primary(/^Simulate the rest/)).toHaveTextContent("2 credits");
    expect(screen.queryByText(/Simulate all/)).toBeNull();
    expect(screen.getByText("1 credit each")).toBeInTheDocument();
  });

  it("queue running: no primary button, '2 of 3' shown", () => {
    render(
      <PackAnswer
        kind="hook"
        rows={hookRows([done(30), { kind: "running" }, { kind: "waiting" }])}
        queue={{ done: 1, total: 3 }}
        onSimulate={() => {}}
        onSimulateAll={() => {}}
        onScript={() => {}}
      />,
    );
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Simulate all|Script/ })).toBeNull();
    expect(screen.queryByText("1 credit each")).toBeNull();
    expect(screen.getByRole("img", { name: "Simulating" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "30% would stop to watch" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "2 of 3");
  });

  it("all done with a 15-point lead: 'Best' on row 3, primary 'Script the best', onScript(2)", () => {
    const onScript = vi.fn();
    render(<PackAnswer kind="hook" rows={hookRows(sealed)} queue={null} onScript={onScript} />);
    expect(screen.getAllByText("Best")).toHaveLength(1);
    expect(within(rows()[2]!).getByText("Best")).toBeInTheDocument();
    expect(within(rows()[2]!).getByRole("img", { name: "45% would stop to watch" })).toBeInTheDocument();
    expect(screen.queryByText("1 credit each")).toBeNull();
    const button = primary(/Script the best/);
    expect(button).toHaveTextContent("2 credits");
    fireEvent.click(button);
    expect(onScript).toHaveBeenCalledWith(2);
  });

  it("all done without a lead: no 'Best', primary 'Script hook 3'", () => {
    const onScript = vi.fn();
    render(<PackAnswer kind="hook" rows={hookRows([done(30), done(22), done(38)])} queue={null} onScript={onScript} />);
    expect(screen.queryByText("Best")).toBeNull();
    fireEvent.click(primary(/Script hook 3/));
    expect(onScript).toHaveBeenCalledWith(2);
  });

  it("a failed row says 'Couldn't simulate' and keeps an enabled Simulate button", () => {
    const onSimulate = vi.fn();
    render(<PackAnswer kind="hook" rows={hookRows([done(30), empty, done(45)], [1])} queue={null} onSimulate={onSimulate} onSimulateAll={() => {}} />);
    const row = rows()[1]!;
    expect(within(row).getByText("Couldn't simulate")).toBeInTheDocument();
    const gauge = within(row).getByRole("button", { name: /^Simulate: / });
    expect(gauge).toBeEnabled();
    fireEvent.click(gauge);
    expect(onSimulate).toHaveBeenCalledWith(HOOKS[1]);
    expect(within(rows()[0]!).queryByText("Couldn't simulate")).toBeNull();
    expect(primary(/^Simulate the rest/)).toHaveTextContent("1 credit");
  });

  it("no handlers: buttons render disabled, nothing throws", () => {
    render(<PackAnswer kind="hook" rows={hookRows([empty, empty, empty])} queue={null} />);
    for (const gauge of screen.getAllByRole("button", { name: /^Simulate: / })) expect(gauge).toBeDisabled();
    expect(primary(/Simulate all 3/)).toBeDisabled();
    cleanup();
    render(<PackAnswer kind="hook" rows={hookRows(sealed)} queue={null} />);
    expect(primary(/Script the best/)).toBeDisabled();
  });

  it("keeps a hyphenated word on one line and the text whole", () => {
    render(<PackAnswer kind="hook" rows={hookRows([empty, empty, empty])} queue={null} />);
    const text = rows()[1]!.querySelector("p")!;
    expect(text).toHaveTextContent(HOOKS[1]!);
    const kept = [...text.querySelectorAll("span")].map((s) => [s.textContent, s.className]);
    expect(kept).toEqual([["3-step", "whitespace-nowrap"]]);
  });

  it("sets the row text in proportional figures (the body's tabular figures widen Inter's hyphen)", () => {
    render(<PackAnswer kind="hook" rows={hookRows([empty, empty, empty])} queue={null} />);
    expect(rows()[0]!.querySelector("p")!.closest(".proportional-nums")).not.toBeNull();
  });

  it("has no axe violations, not simulated and done", async () => {
    const first = render(<PackAnswer kind="hook" rows={hookRows([empty, empty, empty])} queue={null} onSimulate={() => {}} onSimulateAll={() => {}} />);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(first.container)).toHaveNoViolations();
    cleanup();
    const second = render(<PackAnswer kind="hook" rows={hookRows(sealed)} queue={null} onScript={() => {}} />);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(second.container)).toHaveNoViolations();
  });
});

describe("PackAnswer — ideas", () => {
  const ideaRows = (states: GaugeState[]): PackRow[] =>
    IDEAS_4.map((b, i) => ({ key: b.props.title, text: b.props.title, sub: b.props.angle || null, state: states[i]! }));

  it("idea rows show the title and the grey line, primary 'Script idea 1' when idea 1 leads without a 10-point lead", () => {
    const onScript = vi.fn();
    render(<PackAnswer kind="idea" rows={ideaRows([done(40), done(35), done(33), done(31)])} queue={null} onScript={onScript} />);
    const first = rows()[0]!;
    expect(within(first).getByText("The ‘Productivity Porn’ Trap")).toBeInTheDocument();
    expect(within(first).getByText("Aesthetic routines are performative, not functional.")).toBeInTheDocument();
    expect(screen.queryByText("Best")).toBeNull();
    fireEvent.click(primary(/Script idea 1/));
    expect(onScript).toHaveBeenCalledWith(0);
  });

  it("four not simulated: 'Simulate all 4' with '4 credits'", () => {
    render(<PackAnswer kind="idea" rows={ideaRows([empty, empty, empty, empty])} queue={null} onSimulateAll={() => {}} />);
    expect(primary(/Simulate all 4/)).toHaveTextContent("4 credits");
    expect(screen.getAllByRole("button", { name: /^Simulate: / })).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Simulate: Your To-Do List Is a Mood Board" })).toBeInTheDocument();
  });
});
