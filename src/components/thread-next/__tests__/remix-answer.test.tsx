/** @vitest-environment happy-dom */

/**
 * RemixAnswer — the remix card (spec §4.4), rendered for real from the drawing's sample
 * (`REMIX_CAMERA`). Steps come from the real `formatSteps`; several remixes are one card with a
 * pager.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import type { GaugeState } from "../answer-gauge";
import { RemixAnswer } from "../remix-answer";
import { BLUEPRINT_ANSWER, REMIX_CAMERA, REMIX_DECODED, REMIX_FILMED, proof, remix } from "./fixtures/answers";

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

// Thread feel §4.3: inside a landing the source row, the headline, the slot, the steps and the button
// come in in that order.
describe("RemixAnswer — its places in a landing", () => {
  const iOf = (el: Element | null) => (el as HTMLElement | null)?.style.getPropertyValue("--i") ?? null;
  const headline = () => screen.getByText(/fake a \$10M camera move/);

  it("source 0, headline 1, slot 2, steps 3, button 4", () => {
    const { container } = render(<RemixAnswer items={[REMIX_CAMERA]} hookOf={empty} onScript={() => {}} />);
    expect(container.querySelector('[data-answer="card"]')).not.toHaveClass("land");
    expect(iOf(container.querySelector('[data-part="cover"]')!.closest(".land"))).toBe("0");
    expect(iOf(headline().closest(".land"))).toBe("1");
    expect(iOf(screen.getByRole("button", { name: /^Simulate the hook: / }).closest(".land"))).toBe("2");
    expect(iOf(container.querySelector('[data-part="steps"]')!.closest(".land"))).toBe("3");
    expect(iOf(screen.getByRole("button", { name: /^Script it/ }).closest(".land"))).toBe("4");
  });

  it("without a source row or steps the rest move up", () => {
    render(<RemixAnswer items={[remix("A hook with nothing borrowed", { formatBorrowed: "" })]} hookOf={empty} onScript={() => {}} />);
    expect(iOf(screen.getByText(/A hook with nothing borrowed/).closest(".land"))).toBe("0");
    expect(iOf(screen.getByRole("button", { name: /^Simulate the hook: / }).closest(".land"))).toBe("1");
    expect(iOf(screen.getByRole("button", { name: /^Script it/ }).closest(".land"))).toBe("2");
  });

  it("the slot's place is one element whether the hook is simulated or not, so its number is not landed again", () => {
    const { rerender } = render(<RemixAnswer items={[REMIX_CAMERA]} hookOf={empty} />);
    const place = screen.getByRole("button", { name: /^Simulate the hook: / }).closest(".land");
    rerender(<RemixAnswer items={[REMIX_CAMERA]} hookOf={() => ({ state: { kind: "done", value: 52 }, href: "/dev/answers?state=p7" })} />);
    expect(screen.getByRole("link", { name: /^Open the result: / }).closest(".land")).toBe(place);
  });

  it("several remixes: the pager after the button", () => {
    render(<RemixAnswer items={THREE} hookOf={empty} onScript={() => {}} />);
    expect(iOf(screen.getByRole("button", { name: /^Script it/ }).closest(".land"))).toBe("4");
    expect(iOf(screen.getByRole("button", { name: "Next" }).closest(".land"))).toBe("5");
  });
});

// Thread depth, second part §4: "How to film it" on a remix. Real Radix layers; the read is handed in
// (`loadBeats`), so a test answers it when it wants to.
describe("RemixAnswer — How to film it", () => {
  const filmButton = () => screen.queryByRole("button", { name: "How to film it" });
  const scriptIt = () => screen.getByRole("button", { name: /^Script it/ });
  const dialog = () => screen.findByRole("dialog", { name: "How to film it" });
  const kinds = (d: HTMLElement) =>
    [...d.querySelectorAll<HTMLElement>("[data-sheet^='film-'], [data-part='film-ghost']")].map((r) => r.getAttribute("data-sheet") ?? "ghost");
  const beatNames = (d: HTMLElement) => [...d.querySelectorAll('[data-sheet="film-remix-beat"] h3')].map((h) => h.textContent);
  const close = async (d: HTMLElement) => {
    fireEvent.keyDown(d, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  };

  function deferred() {
    let resolve!: (value: unknown) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<unknown>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  const card = (
    items: Parameters<typeof RemixAnswer>[0]["items"],
    loadBeats: (blueprintId: string) => Promise<unknown> = vi.fn(() => Promise.resolve<unknown>(BLUEPRINT_ANSWER)),
  ) => {
    render(<RemixAnswer items={items} hookOf={empty} onScript={() => {}} loadBeats={loadBeats} />);
    return loadBeats;
  };

  it.each([
    ["a decode and a plan", REMIX_FILMED],
    ["a decode only", REMIX_DECODED],
    ["a plan only", remix("x", { production: REMIX_FILMED.props.production })],
  ])("with %s: the button, named and marked as the script card's", (_, block) => {
    card([block]);
    const button = filmButton()!;
    expect(button).toHaveTextContent(/^How to film it$/);
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it("with neither a decode nor a plan (a blueprint alone counts for nothing): no button, 'Script it' alone", () => {
    card([REMIX_CAMERA]);
    expect(filmButton()).toBeNull();
    cleanup();
    card([remix("x", { blueprintId: "bp-fixture-01" })]);
    expect(filmButton()).toBeNull();
    expect(scriptIt().parentElement!.children).toHaveLength(1);
  });

  it("sits with 'Script it' as the script card's sits with 'Add your take', and lands with it", () => {
    card([REMIX_FILMED]);
    const button = filmButton()!;
    const row = button.parentElement!;
    expect([...row.children]).toEqual([scriptIt(), button]);
    expect(row.className.split(/\s+/).sort()).toEqual(["md:flex", "md:gap-2", "md:items-center"]);
    expect(button).toHaveClass("mt-1.5", "w-full", "h-10", "md:mt-0", "md:w-auto", "md:px-3.5", "md:shrink-0");
    expect(button.closest(".land")).toBe(scriptIt().closest(".land"));
    expect(button.closest<HTMLElement>(".land")!.style.getPropertyValue("--i")).toBe("4");
    expect(row.parentElement).toHaveClass("mt-3.5", "md:mt-5");
  });

  it("says whether its sheet is open; closing it hands the focus back to it", async () => {
    card([REMIX_FILMED]);
    const button = filmButton()!;
    fireEvent.click(button);
    const d = await dialog();
    expect(button).toHaveAttribute("aria-expanded", "true");
    await close(d);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(button);
  });

  it("a page without a blueprint: the sheet is why and the plan, and nothing is read", async () => {
    const loadBeats = card([REMIX_DECODED]);
    fireEvent.click(filmButton()!);
    const d = await dialog();
    expect(kinds(d)).toEqual(["film-why"]);
    expect(loadBeats).not.toHaveBeenCalled();
  });

  it("with one: read once, on the first open, with its id; ghost rows and busy while it runs; the beats after; a second open reads nothing", async () => {
    const read = deferred();
    const loadBeats = vi.fn(() => read.promise);
    card([REMIX_FILMED], loadBeats);
    expect(loadBeats).not.toHaveBeenCalled();
    fireEvent.click(filmButton()!);
    let d = await dialog();
    expect(loadBeats).toHaveBeenCalledTimes(1);
    expect(loadBeats).toHaveBeenCalledWith("bp-fixture-01");
    expect(kinds(d)).toEqual(["film-why", "ghost", "ghost", "film-plan", "film-plan", "film-plan", "film-plan"]);
    expect(d.querySelector('[data-sheet="film-why"]')!.parentElement).toHaveAttribute("aria-busy", "true");

    await act(async () => read.resolve(BLUEPRINT_ANSWER));
    expect(beatNames(d)).toEqual(["Hook", "Setup", "Turn", "Close"]);
    expect(d.querySelector("[aria-busy]")).toBeNull();

    await close(d);
    fireEvent.click(filmButton()!);
    d = await dialog();
    expect(beatNames(d)).toEqual(["Hook", "Setup", "Turn", "Close"]);
    expect(loadBeats).toHaveBeenCalledTimes(1);
  });

  it("the variant: blueprintVariant 1 is the second script; absent is the first", async () => {
    card([{ ...REMIX_FILMED, props: { ...REMIX_FILMED.props, blueprintVariant: undefined } }]);
    fireEvent.click(filmButton()!);
    const d = await dialog();
    await waitFor(() => expect(beatNames(d)).toEqual(["Hook", "Setup"]));
    expect(d.querySelector('[data-sheet="film-remix-beat"] p')).toHaveTextContent("“Variant zero opens here.”");
  });

  it.each<[string, () => Promise<unknown>]>([
    ["a timing that could not be read", () => Promise.resolve({ ...BLUEPRINT_ANSWER, blueprint: { ...BLUEPRINT_ANSWER.blueprint, from_fixed_buckets: true } })],
    ["an empty variant", () => Promise.resolve({ ...BLUEPRINT_ANSWER, script: [[], []] })],
    ["a read that fails", () => Promise.reject(new Error("offline"))],
    ["an answer that is not an object", () => Promise.resolve("Not found")],
    ["a reader that throws at once", () => {
      throw new Error("no network");
    }],
  ])("%s: no beat rows, no message, nothing thrown, the rest of the sheet intact", async (_, read) => {
    card([REMIX_FILMED], vi.fn(read));
    fireEvent.click(filmButton()!);
    const d = await dialog();
    await waitFor(() => expect(d.querySelector("[aria-busy]")).toBeNull());
    expect(kinds(d)).toEqual(["film-why", "film-plan", "film-plan", "film-plan", "film-plan"]);
  });

  it("page 2 of a run: its button, its sheet and its read", async () => {
    const second = remix("Page two's hook", {
      sourceDecode: { ...REMIX_FILMED.props.sourceDecode!, hookPattern: "Page two opens on the receipt." },
      blueprintId: "bp-fixture-02",
      blueprintVariant: 0,
    });
    const loadBeats = card([REMIX_FILMED, second]);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(filmButton()!);
    const d = await dialog();
    expect(loadBeats).toHaveBeenCalledTimes(1);
    expect(loadBeats).toHaveBeenCalledWith("bp-fixture-02");
    expect(d.querySelector('[data-sheet="film-why"] p')).toHaveTextContent("Page two opens on the receipt.");
    await waitFor(() => expect(beatNames(d)).toEqual(["Hook", "Setup"]));
    // Its own plan: none.
    expect(d.querySelectorAll('[data-sheet="film-plan"]')).toHaveLength(0);
  });

  // Fix round 2 (review I1): this test must fail when the guard that drops a late answer is removed
  // (`if (!mounted.current) return` in `RemixFoot`). Without it the late answer would be kept for page
  // 1, its sheet would show those rows and would not read again. The same guard is the only one for an
  // unmount, which leaves nothing to observe (the card's memory goes with it), so that case has no test
  // of its own.
  it("an answer that comes after the page changed is dropped: back on page 1 the sheet reads again and shows only that read", async () => {
    const late = deferred();
    const again = { ...BLUEPRINT_ANSWER, script: [[], [{ index: 0, spoken: "The second read's hook.", on_screen_text: "", shot: "" }]] };
    const loadBeats = vi
      .fn<(id: string) => Promise<unknown>>()
      .mockImplementationOnce(() => late.promise)
      .mockImplementation((id) => Promise.resolve(id === "bp-fixture-01" ? again : { ...BLUEPRINT_ANSWER, script: [[], []] }));
    const second = remix("Page two's hook", { sourceDecode: REMIX_DECODED.props.sourceDecode, blueprintId: "bp-fixture-02" });
    card([REMIX_FILMED, second], loadBeats);
    fireEvent.click(filmButton()!);
    await close(await dialog());
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await act(async () => late.resolve(BLUEPRINT_ANSWER));

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    fireEvent.click(filmButton()!);
    const d = await dialog();
    expect(loadBeats).toHaveBeenCalledTimes(2);
    expect(loadBeats).toHaveBeenLastCalledWith("bp-fixture-01");
    await waitFor(() => expect(d.querySelector("[aria-busy]")).toBeNull());
    expect(beatNames(d)).toEqual(["Hook"]);
    expect(d.querySelector('[data-sheet="film-remix-beat"] p')).toHaveTextContent("“The second read's hook.”");
  });

  // Fix round 2 (review M1).
  it("open, close and open again while the read runs: one read, and the second open still shows the ghosts", async () => {
    const read = deferred();
    const loadBeats = vi.fn(() => read.promise);
    card([REMIX_FILMED], loadBeats);
    fireEvent.click(filmButton()!);
    await close(await dialog());
    fireEvent.click(filmButton()!);
    const d = await dialog();
    expect(loadBeats).toHaveBeenCalledTimes(1);
    expect(d.querySelectorAll('[data-part="film-ghost"]')).toHaveLength(2);
    await act(async () => read.resolve(BLUEPRINT_ANSWER));
    expect(beatNames(d)).toEqual(["Hook", "Setup", "Turn", "Close"]);
  });

  it("back on a page whose read has answered: no second read, its rows at once", async () => {
    const second = remix("Page two's hook", { sourceDecode: REMIX_DECODED.props.sourceDecode, blueprintId: "bp-fixture-02" });
    const loadBeats = card([REMIX_FILMED, second]);
    fireEvent.click(filmButton()!);
    let d = await dialog();
    await waitFor(() => expect(beatNames(d)).toEqual(["Hook", "Setup", "Turn", "Close"]));
    await close(d);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    fireEvent.click(filmButton()!);
    d = await dialog();
    expect(beatNames(d)).toEqual(["Hook", "Setup", "Turn", "Close"]);
    expect(d.querySelectorAll('[data-part="film-ghost"]')).toHaveLength(0);
    expect(loadBeats).toHaveBeenCalledTimes(1);
  });

  // Fix round 2 (review M5): what a read found is kept for its blueprint and variant, not for a place in the pager.
  it("a page replaced in place by another remix: its own read, not the rows of the one before", async () => {
    const loadBeats = vi.fn((id: string) => Promise.resolve(id === "bp-fixture-01" ? BLUEPRINT_ANSWER : { ...BLUEPRINT_ANSWER, script: [[{ index: 0, spoken: "The new remix's hook.", on_screen_text: "", shot: "" }]] }));
    const { rerender } = render(<RemixAnswer items={[REMIX_FILMED]} hookOf={empty} loadBeats={loadBeats} />);
    fireEvent.click(filmButton()!);
    let d = await dialog();
    await waitFor(() => expect(beatNames(d)).toEqual(["Hook", "Setup", "Turn", "Close"]));
    await close(d);
    const other = remix("Another hook", { sourceDecode: REMIX_DECODED.props.sourceDecode, blueprintId: "bp-fixture-03" });
    rerender(<RemixAnswer items={[other]} hookOf={empty} loadBeats={loadBeats} />);
    fireEvent.click(filmButton()!);
    d = await dialog();
    expect(loadBeats).toHaveBeenLastCalledWith("bp-fixture-03");
    await waitFor(() => expect(beatNames(d)).toEqual(["Hook"]));
    expect(d.querySelector('[data-sheet="film-remix-beat"] p')).toHaveTextContent("“The new remix's hook.”");
  });

  // Fix round 2 (review M6, the spec's new wording): a read that failed is tried again on the next open;
  // one that answered, with beats or without, is not.
  it("a read that failed is tried again the next time the sheet opens, and its rows show then", async () => {
    const loadBeats = vi
      .fn<(id: string) => Promise<unknown>>()
      .mockImplementationOnce(() => Promise.reject(new Error("offline")))
      .mockImplementation(() => Promise.resolve(BLUEPRINT_ANSWER));
    card([REMIX_FILMED], loadBeats);
    fireEvent.click(filmButton()!);
    let d = await dialog();
    await waitFor(() => expect(d.querySelector("[aria-busy]")).toBeNull());
    expect(beatNames(d)).toEqual([]);
    await close(d);
    fireEvent.click(filmButton()!);
    d = await dialog();
    expect(loadBeats).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(beatNames(d)).toEqual(["Hook", "Setup", "Turn", "Close"]));
  });

  it("a reader that throws at once is a failed read too: tried again on the next open", async () => {
    const loadBeats = vi
      .fn<(id: string) => Promise<unknown>>()
      .mockImplementationOnce(() => {
        throw new Error("no network");
      })
      .mockImplementation(() => Promise.resolve(BLUEPRINT_ANSWER));
    card([REMIX_FILMED], loadBeats);
    fireEvent.click(filmButton()!);
    await close(await dialog());
    fireEvent.click(filmButton()!);
    const d = await dialog();
    expect(loadBeats).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(beatNames(d)).toEqual(["Hook", "Setup", "Turn", "Close"]));
  });

  it.each<[string, unknown]>([
    ["with no beats for its variant", { ...BLUEPRINT_ANSWER, script: [[], []] }],
    ["with a timing that could not be read", { ...BLUEPRINT_ANSWER, blueprint: { ...BLUEPRINT_ANSWER.blueprint, from_fixed_buckets: true } }],
    ["with something that is not an answer", "Not found"],
  ])("a read that answered %s is not tried again", async (_, answer) => {
    const loadBeats = vi.fn(() => Promise.resolve(answer));
    card([REMIX_FILMED], loadBeats);
    fireEvent.click(filmButton()!);
    let d = await dialog();
    await waitFor(() => expect(d.querySelector("[aria-busy]")).toBeNull());
    await close(d);
    fireEvent.click(filmButton()!);
    d = await dialog();
    expect(d.querySelectorAll('[data-part="film-ghost"]')).toHaveLength(0);
    expect(beatNames(d)).toEqual([]);
    expect(loadBeats).toHaveBeenCalledTimes(1);
  });

  it("has no axe violations with the button", async () => {
    const { container } = render(<RemixAnswer items={[REMIX_FILMED]} hookOf={empty} onScript={() => {}} loadBeats={() => Promise.resolve(BLUEPRINT_ANSWER)} />);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});
