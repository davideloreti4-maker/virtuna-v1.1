/** @vitest-environment happy-dom */

/**
 * SmallGauge — the gauge every text answer carries (spec §3 rule 4), rendered for real. Its four
 * states: empty (a button that simulates), waiting (the dimmed track), running (the dotted ring)
 * and done (the ink arc and the number). Only the empty one is a control.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { GaugeSlot, SmallGauge, type GaugeState } from "../answer-gauge";

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

  it("a number that measures something else says so (Library: a video's 'watch to the end')", () => {
    const { unmount } = render(
      <SmallGauge state={{ kind: "done", value: 38 }} label="A take" href="/simulation/a1" words="38% watch to the end" />,
    );
    expect(screen.getByRole("link", { name: "Open the result: A take" })).toHaveAccessibleDescription("38% watch to the end");
    unmount();
    render(<SmallGauge state={{ kind: "done", value: 38 }} label="A take" words="38% watch to the end" />);
    expect(screen.getByRole("img", { name: "38% watch to the end" })).toHaveTextContent("38");
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

describe("SmallGauge — a score that lands while watched counts up (thread feel §4.4)", () => {
  const MATCH_MEDIA = Object.getOwnPropertyDescriptor(window, "matchMedia");

  /** The viewer's motion setting: `reduce` matches or not, or no `matchMedia` at all. */
  function motion(setting: "allowed" | "reduced" | "unknown") {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value:
        setting === "unknown"
          ? undefined
          : (query: string) => ({
              matches: setting === "reduced" && query === "(prefers-reduced-motion: reduce)",
              media: query,
              onchange: null,
              addEventListener: () => {},
              removeEventListener: () => {},
              addListener: () => {},
              removeListener: () => {},
              dispatchEvent: () => false,
            }),
    });
  }

  /** The clock and the frames, by hand: `advance(ms)` moves the clock and runs the frames asked for. */
  function frames() {
    let now = 0;
    let queue: { id: number; cb: FrameRequestCallback }[] = [];
    let next = 1;
    const cancelled: number[] = [];
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      const id = next++;
      queue.push({ id, cb });
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      cancelled.push(id);
      queue = queue.filter((f) => f.id !== id);
    });
    return {
      advance(ms: number) {
        now += ms;
        const due = queue;
        queue = [];
        act(() => {
          for (const f of due) f.cb(now);
        });
      },
      pending: () => queue.map((f) => f.id),
      cancelled,
    };
  }

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (MATCH_MEDIA) Object.defineProperty(window, "matchMedia", MATCH_MEDIA);
    else delete (window as { matchMedia?: unknown }).matchMedia;
  });

  const numberOf = (gauge: HTMLElement) => gauge.querySelector("text")!.textContent;
  const arcOf = (container: HTMLElement) => container.querySelector('[data-part="value"]');

  it("drawn done (a stored score, a reload): at rest, the number at once and no draw", () => {
    motion("allowed");
    frames();
    const { container } = render(<SmallGauge state={{ kind: "done", value: 45 }} label="A hook" />);
    expect(numberOf(screen.getByRole("img"))).toBe("45");
    expect(arcOf(container)).not.toHaveClass("gauge-draw");
  });

  it("running to done with motion allowed: the arc draws and the number counts from below to exactly the value in 700 ms", () => {
    motion("allowed");
    const clock = frames();
    const { container, rerender } = render(<SmallGauge state={{ kind: "running" }} label="A hook" />);
    rerender(<SmallGauge state={{ kind: "done", value: 45 }} label="A hook" />);

    // The first frame drawn done is the count's start; the name and the data are final already.
    const gauge = screen.getByRole("img", { name: "45% would stop to watch" });
    expect(gauge).toHaveAttribute("data-gauge", "done");
    expect(gauge).toHaveAttribute("data-value", "45");
    expect(arcOf(container)).toHaveClass("gauge-draw");
    expect(Number(numberOf(gauge))).toBeLessThan(45);

    clock.advance(350);
    const halfway = Number(numberOf(gauge));
    expect(halfway).toBeGreaterThan(0);
    expect(halfway).toBeLessThan(45);
    expect(gauge).toHaveAttribute("data-value", "45");

    clock.advance(350);
    expect(numberOf(gauge)).toBe("45");
    // Done counting: no frame is asked for any more.
    expect(clock.pending()).toEqual([]);
  });

  it("a linked gauge counts the same, and its description is the final number from the first frame", () => {
    motion("allowed");
    const clock = frames();
    const { rerender } = render(<SmallGauge state={{ kind: "running" }} label="A hook" href="/simulation/hook/t/k" />);
    rerender(<SmallGauge state={{ kind: "done", value: 30 }} label="A hook" href="/simulation/hook/t/k" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAccessibleDescription("30% would stop to watch");
    expect(link).toHaveAttribute("data-value", "30");
    expect(Number(numberOf(link))).toBeLessThan(30);
    clock.advance(700);
    expect(numberOf(link)).toBe("30");
  });

  it("waiting to done counts as running to done", () => {
    motion("allowed");
    const clock = frames();
    const { container, rerender } = render(<SmallGauge state={{ kind: "waiting" }} label="A hook" />);
    rerender(<SmallGauge state={{ kind: "done", value: 22 }} label="A hook" />);
    expect(arcOf(container)).toHaveClass("gauge-draw");
    expect(Number(numberOf(screen.getByRole("img")))).toBeLessThan(22);
    clock.advance(700);
    expect(numberOf(screen.getByRole("img"))).toBe("22");
  });

  it("empty to done (a seal that arrives without a run being watched): at rest", () => {
    motion("allowed");
    frames();
    const { container, rerender } = render(<SmallGauge state={{ kind: "empty" }} label="A hook" onSimulate={() => {}} />);
    rerender(<SmallGauge state={{ kind: "done", value: 22 }} label="A hook" />);
    expect(numberOf(screen.getByRole("img"))).toBe("22");
    expect(arcOf(container)).not.toHaveClass("gauge-draw");
  });

  it.each(["reduced", "unknown"] as const)("running to done with motion %s: the value at once, no draw", (setting) => {
    motion(setting);
    frames();
    const { container, rerender } = render(<SmallGauge state={{ kind: "running" }} label="A hook" />);
    rerender(<SmallGauge state={{ kind: "done", value: 45 }} label="A hook" />);
    expect(numberOf(screen.getByRole("img", { name: "45% would stop to watch" }))).toBe("45");
    expect(arcOf(container)).not.toHaveClass("gauge-draw");
  });

  it("a render of the parent mid-count neither restarts the count nor cuts it short", () => {
    motion("allowed");
    const clock = frames();
    const { rerender } = render(<SmallGauge state={{ kind: "running" }} label="A hook" />);
    rerender(<SmallGauge state={{ kind: "done", value: 45 }} label="A hook" />);
    clock.advance(350);
    const halfway = Number(numberOf(screen.getByRole("img")));
    expect(halfway).toBeGreaterThan(0);
    expect(halfway).toBeLessThan(45);
    rerender(<SmallGauge state={{ kind: "done", value: 45 }} label="A hook" />);
    expect(Number(numberOf(screen.getByRole("img")))).toBe(halfway);
    clock.advance(350);
    expect(numberOf(screen.getByRole("img"))).toBe("45");
  });

  it("its link arriving after the count has ended (a pack row at the end of 'Simulate all'): the arc does not draw again", () => {
    motion("allowed");
    const clock = frames();
    const { container, rerender } = render(<SmallGauge state={{ kind: "running" }} label="A hook" />);
    rerender(<SmallGauge state={{ kind: "done", value: 45 }} label="A hook" />);
    expect(arcOf(container)).toHaveClass("gauge-draw");
    clock.advance(700);
    expect(numberOf(screen.getByRole("img"))).toBe("45");
    // The count is over: the class goes with it, so the arc in a new element is drawn at rest.
    expect(arcOf(container)).not.toHaveClass("gauge-draw");

    rerender(<SmallGauge state={{ kind: "done", value: 45 }} label="A hook" href="/simulation/hook/t/k" />);
    const link = screen.getByRole("link");
    expect(numberOf(link)).toBe("45");
    expect(link.querySelector('[data-part="value"]')).not.toHaveClass("gauge-draw");
    expect(clock.pending()).toEqual([]);
  });

  it("unmounted mid-count: its frame is cancelled", () => {
    motion("allowed");
    const clock = frames();
    const { rerender, unmount } = render(<SmallGauge state={{ kind: "running" }} label="A hook" />);
    rerender(<SmallGauge state={{ kind: "done", value: 45 }} label="A hook" />);
    clock.advance(100);
    const [waiting] = clock.pending();
    expect(waiting).toBeDefined();
    unmount();
    expect(clock.cancelled).toContain(waiting);
    expect(clock.pending()).toEqual([]);
  });

  describe("in a slot (the script's opening, the remix hook)", () => {
    const OPENER = "I fed 10 million viral videos into an AI to simulate your exact audience.";
    const PAGE = "/simulation/hook/t/k?as=opening";
    const slot = (state: GaugeState, href?: string | null) => (
      <GaugeSlot state={state} label="Simulate the opening" text={OPENER} href={href} />
    );

    it("running to done with its page: the link as today, and its score counts up", () => {
      motion("allowed");
      const clock = frames();
      const { container, rerender } = render(slot({ kind: "running" }));
      rerender(slot({ kind: "done", value: 41 }, PAGE));

      const link = screen.getByRole("link", { name: /^Open the result: I fed 10 million/ });
      expect(link).toHaveAttribute("href", PAGE);
      expect(link).toHaveAttribute("data-slot", "done");
      expect(link).toHaveTextContent("would stop to watch");
      expect(link).toHaveAccessibleDescription("41% would stop to watch");
      const gauge = link.querySelector<HTMLElement>('[data-gauge="done"]')!;
      expect(gauge).toHaveAttribute("data-value", "41");
      expect(arcOf(container)).toHaveClass("gauge-draw");
      expect(Number(numberOf(gauge))).toBeLessThan(41);

      clock.advance(350);
      const halfway = Number(numberOf(link.querySelector<HTMLElement>('[data-gauge="done"]')!));
      expect(halfway).toBeGreaterThan(0);
      expect(halfway).toBeLessThan(41);
      clock.advance(350);
      expect(numberOf(link.querySelector<HTMLElement>('[data-gauge="done"]')!)).toBe("41");
      expect(link).toHaveAccessibleDescription("41% would stop to watch");
    });

    it("running to done before its page is known: counts in place", () => {
      motion("allowed");
      const clock = frames();
      const { container, rerender } = render(slot({ kind: "running" }));
      rerender(slot({ kind: "done", value: 41 }, null));
      expect(screen.queryByRole("link")).toBeNull();
      expect(arcOf(container)).toHaveClass("gauge-draw");
      expect(Number(numberOf(screen.getByRole("img")))).toBeLessThan(41);
      clock.advance(700);
      expect(numberOf(screen.getByRole("img"))).toBe("41");
    });

    it("its page arriving after the score: the link at rest, the score not counted again", () => {
      motion("allowed");
      const clock = frames();
      const { container, rerender } = render(slot({ kind: "running" }));
      rerender(slot({ kind: "done", value: 41 }, null));
      clock.advance(700);
      rerender(slot({ kind: "done", value: 41 }, PAGE));
      const link = screen.getByRole("link", { name: /^Open the result: / });
      expect(numberOf(link.querySelector<HTMLElement>('[data-gauge="done"]')!)).toBe("41");
      expect(arcOf(container)).not.toHaveClass("gauge-draw");
      expect(clock.pending()).toEqual([]);
    });

    it("drawn done with its page (a reload): at rest", () => {
      motion("allowed");
      frames();
      const { container } = render(slot({ kind: "done", value: 41 }, PAGE));
      expect(numberOf(screen.getByRole("link").querySelector<HTMLElement>('[data-gauge="done"]')!)).toBe("41");
      expect(arcOf(container)).not.toHaveClass("gauge-draw");
    });

    it("running to done with its page and reduced motion: at rest", () => {
      motion("reduced");
      frames();
      const { container, rerender } = render(slot({ kind: "running" }));
      rerender(slot({ kind: "done", value: 41 }, PAGE));
      expect(numberOf(screen.getByRole("link").querySelector<HTMLElement>('[data-gauge="done"]')!)).toBe("41");
      expect(arcOf(container)).not.toHaveClass("gauge-draw");
    });
  });
});
