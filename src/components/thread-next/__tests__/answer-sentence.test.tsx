/** @vitest-environment happy-dom */

/**
 * The line under a pack (`PackSentence`): Maven's pick before the numbers are in (spec
 * 2026-11-25-maven-pick-design.md §3.1), the measured line once every row is simulated (spec
 * 2026-11-21 §3 rule 6). Real markup from the drawing's fixtures; the numbers come from the fixture
 * seals through the real `stopNumberOf`, as the thread reads them.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { stopNumberOf } from "@/lib/thread-next/stop-number";
import { PackSentence } from "../answer-sentence";
import type { GaugeState } from "../answer-gauge";
import { packLastLand, type PackRow } from "../pack-answer";
import { IDEAS_4, MEAL_PREP_HOOKS, SEALS_DONE } from "./fixtures/answers";

afterEach(cleanup);

const empty: GaugeState = { kind: "empty" };
const sealedAt = (i: number): GaugeState => ({ kind: "done", value: stopNumberOf(SEALS_DONE[MEAL_PREP_HOOKS[i]!.props.hookLine])! });

/** The hook rows as the thread builds them: the line, the state, and the writer's rank and reason. */
const hookRows = (state: (i: number) => GaugeState, blocks = MEAL_PREP_HOOKS): PackRow[] =>
  blocks.map((b, i) => ({ key: b.props.hookLine, text: b.props.hookLine, state: state(i), rank: b.props.rank, why: b.props.why }));

const pick = () => document.querySelector<HTMLElement>('[data-part="pack-pick"]');
const HOOK_1_WHY = MEAL_PREP_HOOKS[0]!.props.why!;

describe("the line under a pack of hooks", () => {
  it("before simulating: Maven would post the first-ranked hook, and why", () => {
    render(<PackSentence kind="hook" rows={hookRows(() => empty)} />);
    expect(pick()).toHaveTextContent(`Maven would post hook 1. ${HOOK_1_WHY}`);
    expect(pick()!.tagName).toBe("P");
  });

  it("the same type as the measured line: the pick only adds its landing place", () => {
    const { unmount } = render(<PackSentence kind="hook" rows={hookRows(sealedAt)} />);
    const measured = document.querySelector("p")!;
    const measuredClass = measured.className;
    unmount();
    render(<PackSentence kind="hook" rows={hookRows(() => empty)} />);
    expect(pick()!.className.split(" ").filter((c) => c !== "land").join(" ")).toBe(measuredClass);
  });

  it("names the first-ranked row by its place, wherever it sits", () => {
    const swapped = [MEAL_PREP_HOOKS[1]!, MEAL_PREP_HOOKS[0]!, MEAL_PREP_HOOKS[2]!];
    render(<PackSentence kind="hook" rows={hookRows(() => empty, swapped)} />);
    expect(pick()).toHaveTextContent(`Maven would post hook 2. ${HOOK_1_WHY}`);
  });

  it("stays while some rows are simulated", () => {
    render(<PackSentence kind="hook" rows={hookRows((i) => (i === 0 ? sealedAt(0) : i === 1 ? { kind: "running" } : { kind: "waiting" }))} />);
    expect(pick()).toHaveTextContent(`Maven would post hook 1. ${HOOK_1_WHY}`);
  });

  it("once every row is simulated the measured line takes its place, though it names another hook", () => {
    const { container } = render(<PackSentence kind="hook" rows={hookRows(sealedAt)} />);
    expect(pick()).toBeNull();
    expect(container).toHaveTextContent(/^Hook 3 leads by 15 points\.$/);
  });

  it("no line when the first-ranked hook has no reason", () => {
    const bare = MEAL_PREP_HOOKS.map((b, i) => (i === 0 ? { ...b, props: { ...b.props, why: undefined } } : b));
    const { container } = render(<PackSentence kind="hook" rows={hookRows(() => empty, bare)} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("no line for an old pack with no reasons", () => {
    const old = MEAL_PREP_HOOKS.map(({ type, props: { why: _why, ...props } }) => ({ type, props }));
    const { container } = render(<PackSentence kind="hook" rows={hookRows(() => empty, old)} />);
    expect(container).toBeEmptyDOMElement();
  });

  // Fix round 1 (review I1): a reason that is junk, or the hook itself, is no reason.
  it("no line when the first-ranked hook's reason is its own line, or junk", () => {
    const withWhy = (why: string) => MEAL_PREP_HOOKS.map((b, i) => (i === 0 ? { ...b, props: { ...b.props, why } } : b));
    for (const why of [MEAL_PREP_HOOKS[0]!.props.hookLine.toUpperCase(), ".", "n/a", "https://example.com/v/1"]) {
      const { container, unmount } = render(<PackSentence kind="hook" rows={hookRows(() => empty, withWhy(why))} />);
      expect(container, why).toBeEmptyDOMElement();
      unmount();
    }
  });

  it("no line for one hook", () => {
    const { container } = render(<PackSentence kind="hook" rows={hookRows(() => empty, MEAL_PREP_HOOKS.slice(0, 1))} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("in a landing it comes in after the card's button, before the chips", () => {
    render(<PackSentence kind="hook" rows={hookRows(() => empty)} />);
    expect(pick()).toHaveClass("land");
    expect(pick()!.style.getPropertyValue("--i")).toBe(String(packLastLand(MEAL_PREP_HOOKS.length) + 1));
  });
});

describe("ideas have none", () => {
  it("an idea pack with ranks and reasons on its rows shows no pick", () => {
    const rows: PackRow[] = IDEAS_4.map((b, i) => ({ key: b.props.title, text: b.props.title, state: empty, rank: i + 1, why: "A plain reason." }));
    const { container } = render(<PackSentence kind="idea" rows={rows} />);
    expect(container).toBeEmptyDOMElement();
  });
});
