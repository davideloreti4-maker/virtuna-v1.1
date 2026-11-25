/** @vitest-environment happy-dom */

/**
 * ScriptAnswer — the script card (spec §4.3), rendered for real from the drawing's script
 * (`SCRIPT_AI`). Times and the total come from the beats' free-text timings through the real
 * `timingStart` / `timingEnd` / `clockLabel`; a timing that does not parse shows no time.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { axe } from "vitest-axe";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import type { GaugeState } from "../answer-gauge";
import { ScriptAnswer, scriptText } from "../script-answer";
import { SCRIPT_AI, SCRIPT_FILMED, SCRIPT_PLANNED, script } from "./fixtures/answers";

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

  it("Copy takes the whole script as plain text, a blank line between beats, no times; a check and 'Copied' for a moment", async () => {
    const writeText = vi.fn(async (_text: string) => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    try {
      render(<ScriptAnswer block={SCRIPT_AI} opener={{ state: empty }} />);
      const button = screen.getByRole("button", { name: "Copy script" });
      expect(document.querySelector('[data-part="copied-mark"]')).toBeNull();
      await act(async () => {
        fireEvent.click(button);
      });
      expect(writeText).toHaveBeenCalledTimes(1);
      const copied = writeText.mock.calls[0]![0];
      expect(copied).toBe(scriptText(SCRIPT_AI.props.beats));
      expect(copied.split("\n\n")).toHaveLength(5);
      expect(copied.startsWith("I fed 10 million viral videos into an AI to simulate your exact audience.")).toBe(true);
      expect(copied).not.toMatch(/0:0\d/);
      expect(screen.getByRole("status")).toHaveTextContent("Copied");
      expect(document.querySelector('[data-part="copied-mark"]')).toBeInTheDocument();
    } finally {
      Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    }
  });

  it("scriptText drops empty beats and trims each", () => {
    expect(scriptText([{ content: "  One. " }, { content: "   " }, { content: "Two." }])).toBe("One.\n\nTwo.");
    expect(scriptText([])).toBe("");
  });

  it("a script with no words has no Copy", () => {
    render(<ScriptAnswer block={script([{ content: "  ", timing: "0-3s" }])} opener={{ state: empty }} />);
    expect(screen.queryByRole("button", { name: "Copy script" })).toBeNull();
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

  it("a simulated opening with its page links there (step 2)", () => {
    render(<ScriptAnswer block={SCRIPT_AI} opener={{ state: { kind: "done", value: 41 }, href: "/simulation/hook/t/k?as=opening" }} />);
    expect(screen.getByRole("link", { name: /^Open the result: / })).toHaveAttribute("href", "/simulation/hook/t/k?as=opening");
  });
});

// Thread depth §3.1: each beat's name above its words.
describe("ScriptAnswer — the beats named", () => {
  const nameOf = (row: HTMLElement) => row.querySelector<HTMLElement>('[data-part="beat-name"]');
  const wordsOf = (row: HTMLElement) => row.querySelector<HTMLElement>("p:not([data-part])")!;

  it("a name above every beat, as sent; 'CTA' reads 'Call to action'", () => {
    render(<ScriptAnswer block={SCRIPT_AI} opener={{ state: empty }} />);
    const rows = beats();
    expect(rows.map((r) => nameOf(r)?.textContent)).toEqual(["Hook", "Setup", "Turn", "Payoff", "Call to action"]);
    expect(screen.queryByText("CTA")).toBeNull();
    for (const row of rows) {
      const name = nameOf(row)!;
      // Above the beat's words, in the same column.
      expect(name.compareDocumentPosition(wordsOf(row)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(name.parentElement).toBe(wordsOf(row).parentElement);
    }
  });

  it("the name 12 / 16 at 640 in the secondary ink, 1 under; the 6 above the words moves above it", () => {
    render(<ScriptAnswer block={SCRIPT_AI} opener={{ state: empty }} />);
    for (const [i, row] of beats().entries()) {
      expect(nameOf(row)).toHaveClass("text-label", "leading-4", "font-[640]", "text-foreground-secondary", "pt-1.5", "pb-px");
      const words = wordsOf(row);
      expect(words).not.toHaveClass("pt-1.5");
      // Under the words as today: the opening's 2 (then its slot), the others' 8.
      expect(words).toHaveClass(i === 0 ? "pb-0.5" : "pb-2");
    }
  });

  it("an empty label draws no name and the beat is as today", () => {
    const block = script([
      { label: "  ", content: "Open on the empty fridge.", timing: "0–3s" },
      { label: "Payoff", content: "Then the five-dollar fix.", timing: "3–8s" },
    ]);
    render(<ScriptAnswer block={block} opener={{ state: empty }} />);
    const [first, second] = beats();
    expect(nameOf(first!)).toBeNull();
    expect(wordsOf(first!)).toHaveClass("pt-1.5", "pb-0.5");
    expect(nameOf(second!)).toHaveTextContent("Payoff");
  });

  it("Copy still copies the words only: no names", async () => {
    const writeText = vi.fn(async (_text: string) => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    try {
      render(<ScriptAnswer block={SCRIPT_AI} opener={{ state: empty }} />);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Copy script" }));
      });
      const copied = writeText.mock.calls[0]![0];
      expect(copied).toBe(SCRIPT_AI.props.beats.map((b) => b.content).join("\n\n"));
      for (const name of ["Hook", "Setup", "Turn", "Payoff", "Call to action", "CTA"]) expect(copied).not.toContain(name);
    } finally {
      Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    }
  });
});

// Thread depth §3.2: "How to film it", one tap away. Real Radix layers; the one stand-in is matchMedia.
describe("ScriptAnswer — How to film it", () => {
  function viewport(wide: boolean) {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: wide && /min-width:\s*768px/.test(query),
          media: query,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        }) as MediaQueryList,
    );
  }
  afterEach(() => vi.restoreAllMocks());

  const filmButton = () => screen.queryByRole("button", { name: "How to film it" });
  const take = () => screen.getByRole("button", { name: "Add your take" });
  const card = (block: typeof SCRIPT_AI) => render(<ScriptAnswer block={block} opener={{ state: empty }} onAddTake={() => {}} />);
  const rowsOf = (dialog: HTMLElement, kind: "film-beat" | "film-plan") => [...dialog.querySelectorAll<HTMLElement>(`[data-sheet="${kind}"]`)];
  const text = (row: HTMLElement, selector: string) => row.querySelector(selector)?.textContent ?? null;

  it("a script with neither cues nor a plan has no button: the footer holds 'Add your take' alone", () => {
    card(SCRIPT_AI);
    expect(filmButton()).toBeNull();
    expect(take().parentElement!.children).toHaveLength(1);
  });

  it.each([
    ["a cue only", script([{ label: "Hook", content: "Open on the fridge.", timing: "0–3s", filming: "Close-up on the door." }])],
    ["a plan only", SCRIPT_PLANNED],
    ["cues and a plan", SCRIPT_FILMED],
  ])("with %s: the button under 'Add your take', in the same landing block, with the film icon", (_, block) => {
    card(block);
    const button = filmButton()!;
    expect(take().compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(button.closest(".land")).toBe(take().closest(".land"));
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(button.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(button).toHaveTextContent(/^How to film it$/);
  });

  it("its look: full width, 40 tall, 14 / 570 in the secondary ink, no fill; the sunken fill and the ink on hover and press; 6 above", () => {
    card(SCRIPT_FILMED);
    const button = filmButton()!;
    expect(button).toHaveClass(
      "w-full",
      "h-10",
      "mt-1.5",
      "text-reading",
      "font-[570]",
      "text-foreground-secondary",
      "hover:bg-surface-sunken",
      "active:bg-surface-sunken",
      "hover:text-foreground",
      "active:text-foreground",
    );
    // No fill at rest, and no ring of its own: the look's focus ring.
    expect(button.className.split(/\s+/).filter((c) => /^bg-/.test(c))).toEqual([]);
    expect(button.className).not.toMatch(/outline-none|focus-visible:/);
  });

  // Fix round 1 (seen at 1440 wide): from md the primary is as wide as its content at the card's start,
  // so a full-width quiet button under it sat centred across the card, far from it.
  it("on a phone under the primary, full width, 6 above; from md on the primary's row, right of it, 8 apart, its own width", () => {
    card(SCRIPT_FILMED);
    const button = filmButton()!;
    const row = button.parentElement!;
    // One row holding the two, a row from md only: a plain block on a phone.
    expect(take().parentElement).toBe(row);
    expect([...row.children]).toEqual([take(), button]);
    expect(row.className.split(/\s+/).sort()).toEqual(["md:flex", "md:gap-2", "md:items-center"]);
    // The row sits in the card's footer, which keeps its margins above the primary.
    expect(row.parentElement).toHaveClass("mt-2", "md:mt-5");
    // The phone, as built.
    expect(button).toHaveClass("mt-1.5", "w-full", "h-10", "justify-center");
    // From md: no top margin, as wide as its words with 14 each side, never squeezed; centred on the
    // primary by the row.
    expect(button).toHaveClass("md:mt-0", "md:w-auto", "md:px-3.5", "md:shrink-0");
  });

  it("the primary is the same with and without the quiet button: its classes, and the footer around it", () => {
    card(SCRIPT_AI);
    const alone = take();
    const classes = alone.className;
    // Without the quiet button the primary is the footer's only child, as before this step.
    expect(alone.parentElement).toHaveClass("mt-2", "md:mt-5");
    expect(alone.parentElement!.children).toHaveLength(1);
    cleanup();
    card(SCRIPT_FILMED);
    expect(take().className).toBe(classes);
    expect(take().parentElement!.parentElement).toHaveClass("mt-2", "md:mt-5");
  });

  it("says whether its sheet is open: aria-expanded false, true while open, false again after", async () => {
    card(SCRIPT_FILMED);
    const button = filmButton()!;
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    const dialog = await screen.findByRole("dialog", { name: "How to film it" });
    expect(button).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it.each([
    ["phone", false],
    ["desktop", true],
  ] as const)(
    "on the %s: pressing it opens 'How to film it': the beats with a cue (name, span, cue), then the plan in order; closing returns the focus",
    async (_view, wide) => {
      viewport(wide);
      card(SCRIPT_FILMED);
      const button = filmButton()!;
      fireEvent.click(button);
      const dialog = await screen.findByRole("dialog", { name: "How to film it" });
      const beatRows = rowsOf(dialog, "film-beat");
      // Only the beats that have a cue: Hook, Turn and the CTA (Setup and Payoff have none).
      expect(beatRows.map((r) => text(r, "h3"))).toEqual(["Hook", "Turn", "Call to action"]);
      expect(beatRows.map((r) => text(r, '[data-part="film-span"]'))).toEqual(["0 to 3 s", "8 to 14 s", "20 to 24 s"]);
      expect(beatRows.map((r) => text(r, "p"))).toEqual(
        SCRIPT_FILMED.props.beats.filter((b) => b.filming).map((b) => b.filming),
      );
      const planRows = rowsOf(dialog, "film-plan");
      const plan = SCRIPT_FILMED.props.production!;
      expect(planRows.map((r) => [text(r, "h3"), text(r, "p")])).toEqual([
        ["Shots", plan.shots],
        ["Text on screen", plan.onScreenText],
        ["Setup", plan.setup],
        ["Edit", plan.edit],
      ]);
      expect(beatRows.at(-1)!.compareDocumentPosition(planRows[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      // Nothing in it costs anything: no button of its own (only the shell's Close for a screen reader).
      expect(within(dialog).getAllByRole("button").map((b) => b.textContent)).toEqual(["Close"]);

      fireEvent.keyDown(dialog, { key: "Escape" });
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(document.activeElement).toBe(button);
    },
  );

  it("a plan without an edit has no 'Edit' row; a script with no cue has no beat rows", async () => {
    card(SCRIPT_PLANNED);
    fireEvent.click(filmButton()!);
    const dialog = await screen.findByRole("dialog", { name: "How to film it" });
    expect(rowsOf(dialog, "film-beat")).toHaveLength(0);
    expect(rowsOf(dialog, "film-plan").map((r) => text(r, "h3"))).toEqual(["Shots", "Text on screen", "Setup"]);
  });

  it("cues without a plan: the beat rows alone", async () => {
    card(script([{ label: "CTA", content: "Follow for part two.", timing: "soon", filming: "Point at the follow button." }]));
    fireEvent.click(filmButton()!);
    const dialog = await screen.findByRole("dialog", { name: "How to film it" });
    const [row] = rowsOf(dialog, "film-beat");
    expect(text(row!, "h3")).toBe("Call to action");
    // A timing that cannot be read: no span.
    expect(row!.querySelector('[data-part="film-span"]')).toBeNull();
    expect(text(row!, "p")).toBe("Point at the follow button.");
    expect(rowsOf(dialog, "film-plan")).toHaveLength(0);
  });

  it("has no axe violations with the button", async () => {
    const { container } = render(
      <ScriptAnswer block={SCRIPT_FILMED} opener={{ state: empty, onSimulate: () => {} }} onAddTake={() => {}} />,
    );
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});

// Thread feel §4.3: inside a landing the beats come in one after another, the button after the last.
describe("ScriptAnswer — its places in a landing", () => {
  const iOf = (el: Element | null) => (el as HTMLElement | null)?.style.getPropertyValue("--i") ?? null;

  it("each beat is `land` at its index, the button the next", () => {
    const { container } = render(<ScriptAnswer block={SCRIPT_AI} opener={{ state: empty }} onAddTake={() => {}} />);
    expect(container.querySelector('[data-answer="card"]')).not.toHaveClass("land");
    for (const beat of beats()) expect(beat).toHaveClass("land");
    expect(beats().map(iOf)).toEqual(["0", "1", "2", "3", "4"]);
    expect(iOf(screen.getByRole("button", { name: "Add your take" }).closest(".land"))).toBe("5");
  });
});
