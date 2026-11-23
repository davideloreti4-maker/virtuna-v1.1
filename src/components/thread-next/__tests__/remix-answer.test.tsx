/** @vitest-environment happy-dom */

/**
 * RemixAnswer — the remix card (spec §4.4), rendered for real from the drawing's sample
 * (`REMIX_CAMERA`). Steps come from the real `formatSteps`; several remixes are one card with a
 * pager.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import type { GaugeState } from "../answer-gauge";
import { RemixAnswer } from "../remix-answer";
import { REMIX_CAMERA, proof, remix } from "./fixtures/answers";

afterEach(cleanup);

const empty = (): { state: GaugeState } => ({ state: { kind: "empty" } });

const THREE = [
  remix("The $5 lunch that got me through finals", { proof: proof({ handle: "dij.arc", views: 21000 }) }),
  remix("Nobody tells you the cheapest protein is in the freezer aisle", {
    formatBorrowed: "Cold open → List → Payoff",
    proof: proof({ handle: "nia.tests", views: 1_200_000, multiplier: 3, baselineLabel: "their usual views" }),
  }),
  remix("I ate on $20 a week for a month", { proof: proof({ handle: "lacapture", views: 154000 }) }),
];

describe("RemixAnswer — one remix", () => {
  it("the source row: '@handle' and '{multiplier}× {basis} · {views} views'", () => {
    render(<RemixAnswer items={[REMIX_CAMERA]} hookOf={empty} />);
    expect(screen.getByText("@lacapture")).toBeInTheDocument();
    expect(screen.getByText("10× their average · 154K views")).toBeInTheDocument();
  });

  // Fix round 1 (3): the stored `baselineLabel` is never printed (the runners write "vs their usual
  // views", and spec §3.3 bans "usual"). It is read for its meaning only.
  it.each([
    ["vs their usual views", "10× their average · 154K views"],
    ["their average", "10× their average · 154K views"],
    ["vs median views", "10× their average · 154K views"],
    ["Typical reach", "10× their average · 154K views"],
    ["vs followers", "10× their followers · 154K views"],
    ["their followers", "10× their followers · 154K views"],
    ["vs the niche", "10× · 154K views"],
    [null, "10× · 154K views"],
  ] as const)("a stored basis %j reads as \"%s\"", (baselineLabel, line) => {
    const r = remix("A hook", { proof: proof({ handle: "lacapture", views: 154000, multiplier: 10.4, baselineLabel }) });
    render(<RemixAnswer items={[r]} hookOf={empty} />);
    expect(screen.getByText(line)).toBeInTheDocument();
    expect(screen.queryByText(/usual|median|typical|vs /i)).toBeNull();
  });

  it("without a multiplier the views alone", () => {
    render(<RemixAnswer items={[THREE[0]!]} hookOf={empty} />);
    expect(screen.getByText("@dij.arc")).toBeInTheDocument();
    expect(screen.getByText("21K views")).toBeInTheDocument();
    expect(screen.queryByText(/×/)).toBeNull();
  });

  it("the adapted hook in quotes, its slot named after it, the steps numbered", () => {
    const onSimulate = vi.fn();
    const hookOf = vi.fn(() => ({ state: { kind: "empty" } as GaugeState, onSimulate }));
    render(<RemixAnswer items={[REMIX_CAMERA]} hookOf={hookOf} />);
    expect(screen.getByText("“I’m gonna show y’all how you can fake a $10M camera move”")).toBeInTheDocument();
    expect(hookOf).toHaveBeenCalledWith(REMIX_CAMERA.props.adaptedHook);
    const slot = screen.getByRole("button", { name: /^Simulate the hook: I’m gonna show y’all/ });
    expect(slot).toHaveTextContent("Simulate the hook");
    expect(slot).toHaveTextContent("1 credit");
    fireEvent.click(slot);
    expect(onSimulate).toHaveBeenCalledTimes(1);
    const steps = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(steps.map((s) => s.textContent)).toEqual(["1Visual Hook", "2Concept", "3Tools", "4Footage"]);
  });

  it("short step names sit in two columns as drawn; a long one makes it one column on a phone, two from md", () => {
    const hookOf = () => ({ state: { kind: "empty" } as GaugeState });
    const { unmount } = render(<RemixAnswer items={[REMIX_CAMERA]} hookOf={hookOf} />);
    const short = document.querySelector('[data-part="steps"]')!.className.split(/\s+/);
    expect(short).toContain("grid-cols-2");
    expect(short).not.toContain("grid-cols-1");
    unmount();

    render(
      <RemixAnswer
        items={[remix("Turn any photo into a movie", { formatBorrowed: "Visual Hook → Concept Definition → Tools Required → Footage Preparation" })]}
        hookOf={hookOf}
      />,
    );
    const long = document.querySelector('[data-part="steps"]')!.className.split(/\s+/);
    expect(long).toEqual(expect.arrayContaining(["grid-cols-1", "md:grid-cols-2"]));
    expect(long).not.toContain("grid-cols-2");
  });

  it("the hook simulated: its number and 'would stop to watch'", () => {
    render(<RemixAnswer items={[REMIX_CAMERA]} hookOf={() => ({ state: { kind: "done", value: 52 } })} />);
    expect(screen.getByRole("img", { name: "52% would stop to watch" })).toBeInTheDocument();
    expect(screen.queryByText("Simulate the hook")).toBeNull();
  });

  it("'Script it' costs 2 credits and passes the adapted hook", () => {
    const onScript = vi.fn();
    render(<RemixAnswer items={[REMIX_CAMERA]} hookOf={empty} onScript={onScript} />);
    const button = screen.getByRole("button", { name: /^Script it/ });
    expect(button).toHaveTextContent("2 credits");
    fireEvent.click(button);
    expect(onScript).toHaveBeenCalledWith(REMIX_CAMERA.props.adaptedHook);
  });

  it("the cover: the proof's, else the card's; a cover that fails leaves a plain tile", () => {
    const { container, unmount } = render(<RemixAnswer items={[REMIX_CAMERA]} hookOf={empty} />);
    const img = container.querySelector<HTMLImageElement>('[data-part="cover"] img');
    expect(img).toHaveAttribute("src", "/covers/c9.jpg");
    fireEvent.error(img!);
    expect(container.querySelector('[data-part="cover"] img')).toBeNull();
    expect(container.querySelector('[data-part="cover"]')).toBeInTheDocument();
    unmount();

    const own = remix("A hook", { coverUrl: "/covers/own.jpg", proof: proof({ handle: "dij.arc", views: 900 }) });
    const second = render(<RemixAnswer items={[own]} hookOf={empty} />);
    expect(second.container.querySelector('[data-part="cover"] img')).toHaveAttribute("src", "/covers/own.jpg");
  });

  it("one remix has no pager", () => {
    render(<RemixAnswer items={[REMIX_CAMERA]} hookOf={empty} />);
    expect(screen.queryByRole("button", { name: "Previous" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(screen.queryByRole("region", { name: /Remix 1 of/ })).toBeNull();
  });

  it("has no axe violations", async () => {
    const { container } = render(<RemixAnswer items={[REMIX_CAMERA]} hookOf={empty} onScript={() => {}} />);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });

  it("a simulated remix hook with its page links there (step 2)", () => {
    render(<RemixAnswer items={[REMIX_CAMERA]} hookOf={() => ({ state: { kind: "done", value: 33 }, href: "/simulation/hook/t/k" })} />);
    expect(screen.getByRole("link", { name: /^Open the result: / })).toHaveAttribute("href", "/simulation/hook/t/k");
  });
});

describe("RemixAnswer — several remixes", () => {
  it("one card with a pager: named 'Remix N of 3', Previous and Next move it", () => {
    render(<RemixAnswer items={THREE} hookOf={empty} />);
    expect(screen.getByRole("region", { name: "Remix 1 of 3" })).toBeInTheDocument();
    expect(screen.getByText("“The $5 lunch that got me through finals”")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("region", { name: "Remix 2 of 3" })).toBeInTheDocument();
    expect(screen.getByText("“Nobody tells you the cheapest protein is in the freezer aisle”")).toBeInTheDocument();
    expect(screen.getByText("@nia.tests")).toBeInTheDocument();
    // The stored basis said "usual"; the card never prints it (spec §3.3): it reads "their average".
    expect(screen.getByText("3× their average · 1.2M views")).toBeInTheDocument();
    expect(screen.queryByText(/usual/)).toBeNull();
    expect(within(screen.getByRole("list")).getAllByRole("listitem").map((s) => s.textContent)).toEqual([
      "1Cold open",
      "2List",
      "3Payoff",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("region", { name: "Remix 3 of 3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByRole("region", { name: "Remix 2 of 3" })).toBeInTheDocument();
  });

  it("'Script it' and the slot follow the current page", () => {
    const onScript = vi.fn();
    const hookOf = vi.fn(() => ({ state: { kind: "empty" } as GaugeState }));
    render(<RemixAnswer items={THREE} hookOf={hookOf} onScript={onScript} />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(hookOf).toHaveBeenLastCalledWith(THREE[1]!.props.adaptedHook);
    expect(screen.getByRole("button", { name: /^Simulate the hook: Nobody tells you/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Script it/ }));
    expect(onScript).toHaveBeenCalledWith(THREE[1]!.props.adaptedHook);
  });

  it("under ten the multiplier keeps one decimal; from ten it is whole; views from 100K drop theirs", () => {
    const item = (multiplier: number, views: number) => remix("A hook", { proof: proof({ handle: "x", multiplier, baselineLabel: "their average", views }) });
    const { rerender } = render(<RemixAnswer items={[item(5.24, 21000)]} hookOf={empty} />);
    expect(screen.getByText("5.2× their average · 21K views")).toBeInTheDocument();
    rerender(<RemixAnswer items={[item(40.2, 849100)]} hookOf={empty} />);
    expect(screen.getByText("40× their average · 849K views")).toBeInTheDocument();
    rerender(<RemixAnswer items={[item(9.96, 1_540_000)]} hookOf={empty} />);
    expect(screen.getByText("10× their average · 1.5M views")).toBeInTheDocument();
    rerender(<RemixAnswer items={[item(12, 99_940)]} hookOf={empty} />);
    expect(screen.getByText("12× their average · 99.9K views")).toBeInTheDocument();
  });

  it("the pager says what it pages, in words, and follows the page; the words are hidden from a screen reader (the section is named)", () => {
    const { container } = render(<RemixAnswer items={THREE} hookOf={empty} />);
    const label = () => container.querySelector('[data-part="pager-label"]')!;
    expect(label()).toHaveTextContent("Remix 1 of 3");
    expect(label()).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector('[data-part="dot"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(label()).toHaveTextContent("Remix 2 of 3");
    expect(screen.getByRole("region", { name: "Remix 2 of 3" })).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(<RemixAnswer items={THREE} hookOf={empty} onScript={() => {}} />);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});
