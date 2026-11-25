/** @vitest-environment happy-dom */
/**
 * The count under the video: how many of 1,000 viewers, from the stored shares, at the
 * playhead. Real component, real playhead, recorded runs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { useEffect, useState, type ReactNode } from "react";
import early from "@/lib/result/__tests__/fixtures/early.json";
import ending from "@/lib/result/__tests__/fixtures/ending.json";
import { watchingAt } from "@/lib/result/curve";
import { LandingProvider } from "../landing";
import { ViewerCount } from "../viewer-count";
import { modelOf, playhead, renderWithPlayhead } from "./hero-harness";

const count = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-result="count"]')!;
const part = (c: HTMLElement, name: string) => c.querySelector<HTMLElement>(`[data-part="${name}"]`)!;
const mount = (fixture: unknown) => {
  const model = modelOf(fixture);
  return { model, ...renderWithPlayhead(model, <ViewerCount audience={model.audience} />) };
};

describe("ViewerCount", () => {
  it("at rest: the count at the clip's end, watched to the end", () => {
    const { container } = mount(early);
    expect(count(container)).toHaveTextContent("461 of 1,000 watched to the end");
    expect(part(container, "count-number").textContent).toBe("461");
    expect(part(container, "count-words").textContent).toBe("of 1,000 watched to the end");
  });

  it("away from rest: the line's value at the playhead, still watching; back at rest, the end again", () => {
    const { container } = mount(early);
    act(() => playhead.current.seek(0));
    expect(count(container)).toHaveTextContent("1,000 of 1,000 still watching");
    act(() => playhead.current.seek(2.5));
    expect(count(container)).toHaveTextContent("854 of 1,000 still watching");
    act(() => playhead.current.seek(7));
    expect(count(container)).toHaveTextContent("562 of 1,000 still watching");
    act(() => playhead.current.seek(29));
    expect(count(container)).toHaveTextContent("461 of 1,000 watched to the end");
  });

  it("is always the line at the playhead", () => {
    const { container, model } = mount(early);
    for (const t of [0.5, 2.2, 3, 5.5, 13, 21, 28]) {
      act(() => playhead.current.seek(t));
      const n = Math.round(watchingAt(model.audience.points, t) * 10);
      expect(part(container, "count-number").textContent).toBe(n.toLocaleString("en-US"));
    }
  });

  it("ending: 0 watched to the end", () => {
    const { container } = mount(ending);
    expect(count(container)).toHaveTextContent("0 of 1,000 watched to the end");
  });

  it("is plain text for a screen reader: no live region, no role, nothing hidden", () => {
    const { container } = mount(early);
    const el = count(container);
    expect(el.tagName).toBe("P");
    expect(el.getAttribute("aria-live")).toBeNull();
    expect(el.getAttribute("role")).toBeNull();
    expect(el.querySelector("[aria-hidden]")).toBeNull();
  });

  it("the number in the average watch's figure role, the words in the text role; one baseline and centred from a box of 290, the words under the number in a narrower one", () => {
    const { container } = mount(early);
    const classes = count(container).className.split(/\s+/);
    // Narrow box (a 320 phone): always stacked, so rest and playing are equally tall.
    expect(classes).toEqual(expect.arrayContaining(["flex", "flex-col", "items-center"]));
    expect(classes).not.toContain("flex-wrap");
    // From 290: one line, on one baseline, centred.
    expect(classes).toEqual(
      expect.arrayContaining(["@min-[290px]:flex-row", "@min-[290px]:items-baseline", "@min-[290px]:justify-center"]),
    );
    expect(part(container, "count-number").className).toContain("text-3xl");
    expect(part(container, "count-words").className).toContain("text-ui");
  });
});

describe("ViewerCount: the landing", () => {
  // Stand-ins: the clock and the animation frames.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "Date", "setTimeout", "clearTimeout"] });
  });
  afterEach(() => vi.useRealTimers());

  const landed = (fixture: unknown, landing = true) => {
    const model = modelOf(fixture);
    return renderWithPlayhead(
      model,
      <LandingProvider value={landing}>
        <ViewerCount audience={model.audience} />
      </LandingProvider>,
    );
  };
  const frames = (ms: number) => act(() => vi.advanceTimersByTime(ms));

  it("rolls from 1,000 to the count in 1.5 s, ease-out; a screen reader has the count from the first frame", () => {
    const { container } = landed(early);
    expect(part(container, "count-number").textContent).toBe("1,000");
    expect(part(container, "count-number").getAttribute("aria-hidden")).toBe("true");
    expect(count(container).querySelector(".sr-only")!.textContent).toBe("461");
    expect(part(container, "count-words").textContent).toBe("of 1,000 watched to the end");

    frames(750);
    const halfway = Number(part(container, "count-number").textContent!.replace(/,/g, ""));
    // Ease-out: well past half the way (730) at half the time.
    expect(halfway).toBeLessThan(600);
    expect(halfway).toBeGreaterThan(461);

    frames(800);
    expect(part(container, "count-number").textContent).toBe("461");
    expect(part(container, "count-number").hasAttribute("aria-hidden")).toBe(false);
    expect(count(container).querySelector(".sr-only")).toBeNull();
    expect(count(container)).toHaveTextContent("461 of 1,000 watched to the end");
  });

  it("the roll is over when the landing is, also where no frame runs (a hidden tab): the count never stands at 1,000", () => {
    const model = modelOf(early);
    const landingWindow = { close: () => {} };
    function Landing({ children }: { children: ReactNode }) {
      const [landing, setLanding] = useState(true);
      useEffect(() => {
        landingWindow.close = () => setLanding(false);
      }, []);
      return <LandingProvider value={landing}>{children}</LandingProvider>;
    }
    const view = renderWithPlayhead(
      model,
      <Landing>
        <ViewerCount audience={model.audience} />
      </Landing>,
    );
    // No animation frame has run (the tab is hidden); the landing's window closes.
    expect(part(view.container, "count-number").textContent).toBe("1,000");
    act(() => landingWindow.close());
    expect(part(view.container, "count-number").textContent).toBe("461");
    expect(part(view.container, "count-number").hasAttribute("aria-hidden")).toBe(false);
    expect(count(view.container).querySelector(".sr-only")).toBeNull();
  });

  it("the roll leaves the count's box as it is: the same classes on the line and on the number, the final value out of the flow", () => {
    const { container } = landed(early);
    const rolling = { line: count(container).className, number: part(container, "count-number").className };
    // The final value for a screen reader is the only extra child, and it takes no room.
    expect([...count(container).children].map((el) => el.getAttribute("data-part") ?? el.className)).toEqual([
      "count-number",
      "sr-only",
      "count-words",
    ]);
    frames(1600);
    expect(count(container).className).toBe(rolling.line);
    expect(part(container, "count-number").className).toBe(rolling.number);
  });

  it("the video moving during the roll ends it: the count follows the playhead at once", () => {
    const { container } = landed(early);
    frames(300);
    act(() => playhead.current.seek(7));
    expect(count(container)).toHaveTextContent("562 of 1,000 still watching");
    expect(count(container).querySelector(".sr-only")).toBeNull();
  });

  it("an ended roll does not come back when the video returns to rest before 1.5 s", () => {
    const { container } = landed(early);
    frames(300);
    act(() => playhead.current.seek(7));
    act(() => playhead.current.seek(29));
    expect(part(container, "count-number").textContent).toBe("461");
    frames(300);
    expect(part(container, "count-number").textContent).toBe("461");
    expect(count(container).querySelector(".sr-only, [aria-hidden]")).toBeNull();
  });

  it("without the landing the count is there at once", () => {
    const { container } = landed(early, false);
    expect(part(container, "count-number").textContent).toBe("461");
    expect(count(container).querySelector(".sr-only, [aria-hidden]")).toBeNull();
  });
});
