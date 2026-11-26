/** @vitest-environment happy-dom */
/**
 * The result's first block as layout parts: the result and the running screen draw through them, so
 * their boxes are written once. Real parts; nothing is stood in for.
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import {
  FirstCard,
  LineFrame,
  PHONE_COLUMN,
  PHONE_LINE_FALLBACK,
  PHONE_TOP_PX,
  PLOT_PX,
  ResultFrame,
  STRIP_GAP_PX,
  WIDE_LINE_FALLBACK,
  WideFrame,
  stripHeight,
} from "../first-block";

const part = (root: ParentNode, name: string) => root.querySelector<HTMLElement>(`[data-part="${name}"]`)!;

describe("FirstCard", () => {
  it("the phone column's top is the one number the pinned player's place is worked out from", () => {
    expect(PHONE_COLUMN.split(" ")).toContain(`pt-[${PHONE_TOP_PX}px]`);
  });

  it("the line under the tile is a container, so the count lays itself out for that box's width", () => {
    const { container } = render(<FirstCard tile={null} under={null} line={null} />);
    expect(part(container, "under").className.split(/\s+/)).toContain("@container");
  });

  it("top to bottom: the tile in its box, the line under the tile, the hairline over the line", () => {
    const { container } = render(
      <FirstCard name="hero" tile={<i data-testid="tile" />} under={<i data-testid="under" />} line={<i data-testid="line" />} />,
    );
    const card = container.querySelector<HTMLElement>('[data-result="hero"]')!;
    const [tileBox, under, lineBox] = [part(card, "tile-box"), part(card, "under"), part(card, "line-box")];
    expect([...card.children]).toEqual([tileBox, under, lineBox]);
    // 20 over the tile, 14 at the sides, 12 under the times.
    expect(card.className).toMatch(/\bpt-5\b/);
    expect(card.className).toMatch(/\bpx-3\.5\b/);
    expect(card.className).toMatch(/\bpb-3\b/);
    // Centred, 53% of the card's inside, never under 140 or over 200 (176 on a 393 phone).
    expect(tileBox.className).toMatch(/\bmx-auto\b/);
    expect(tileBox.className).toContain("w-[clamp(140px,53%,200px)]");
    expect(tileBox.querySelector('[data-testid="tile"]')).not.toBeNull();
    // 16 under it, at least one line of the count, centred.
    expect(under.className).toMatch(/\bmt-4\b/);
    expect(under.className).toContain("min-h-[34px]");
    expect(under.className).toMatch(/\bjustify-center\b/);
    expect(under.querySelector('[data-testid="under"]')).not.toBeNull();
    // 14 under that the hairline, 30 over the plot.
    expect(lineBox.className).toMatch(/\bmt-3\.5\b/);
    expect(lineBox.className).toMatch(/\bborder-t\b/);
    expect(lineBox.className).toContain("pt-[30px]");
    expect(lineBox.querySelector('[data-testid="line"]')).not.toBeNull();
  });

  it("carries no name when none is given (the loading frame)", () => {
    const { container } = render(<FirstCard tile={null} under={null} line={null} />);
    expect(container.querySelector("[data-result]")).toBeNull();
  });
});

describe("LineFrame", () => {
  it("the plot at its height, the strip 8 under it, the two times under them", () => {
    const { container } = render(
      <LineFrame width={333} height={PLOT_PX.phone} plotName="curve" strip={<i data-testid="strip" />} times={["0:00", "0:29"]} />,
    );
    expect(part(container, "line-frame").style.width).toBe("333px");
    const plot = part(container, "plot");
    expect(plot.style.height).toBe("100px");
    expect(plot.getAttribute("data-result")).toBe("curve");
    const slot = part(container, "strip-slot");
    expect(slot.className).toMatch(/\bmt-2\b/);
    expect(slot.querySelector('[data-testid="strip"]')).not.toBeNull();
    const times = part(container, "times");
    expect([...times.children].map((el) => el.textContent)).toEqual(["0:00", "0:29"]);
    expect(times.className).toContain("h-[21px]");
    expect(times.className).toMatch(/\bmt-0\.5\b/);
  });

  it("no times: the row keeps its height and shows nothing; no strip: no slot, and the times 4 under the plot", () => {
    const { container } = render(<LineFrame width={333} height={PLOT_PX.phone} strip={null} times={null} />);
    const times = part(container, "times");
    expect(times.textContent).toBe("");
    expect(times.className).toContain("h-[21px]");
    expect(times.className).toMatch(/\bmt-1\b/);
    expect(container.querySelector('[data-part="strip-slot"]')).toBeNull();
    expect(part(container, "plot").hasAttribute("data-result")).toBe(false);
  });

  it("the box around the plot and the strip takes the caller's props (the result's slider)", () => {
    const { container } = render(
      <LineFrame
        width={333}
        height={PLOT_PX.phone}
        box={{ role: "slider", "aria-label": "Still watching", className: "cursor-ew-resize" }}
        strip={<i />}
        stripClassName="x-strip"
        times={null}
      />,
    );
    const box = container.querySelector<HTMLElement>('[role="slider"]')!;
    expect(box.getAttribute("aria-label")).toBe("Still watching");
    expect(box.className).toMatch(/\brelative\b/);
    expect(box.className).toMatch(/\brounded-md\b/);
    expect(box.className).toMatch(/\bcursor-ew-resize\b/);
    expect(box.contains(part(container, "plot"))).toBe(true);
    expect(box.contains(part(container, "strip-slot"))).toBe(true);
    expect(box.contains(part(container, "times"))).toBe(false);
    expect(part(container, "strip-slot").className).toMatch(/\bx-strip\b/);
  });

  it("without a width the frame is as wide as its box (the loading frame)", () => {
    const { container } = render(<LineFrame height={PLOT_PX.wide} strip={null} times={null} />);
    expect(part(container, "line-frame").getAttribute("style")).toBeNull();
    expect(part(container, "plot").style.height).toBe("104px");
  });

  it("the sizes of the line", () => {
    expect(PLOT_PX).toEqual({ phone: 100, wide: 104 });
    expect(STRIP_GAP_PX).toBe(3);
    expect(stripHeight(333)).toBe(38);
    expect(stripHeight(400)).toBe(38);
    expect(stripHeight(401)).toBe(46);
    expect(PHONE_LINE_FALLBACK).toBe(333);
    expect(WIDE_LINE_FALLBACK).toBe(540);
  });
});

describe("WideFrame", () => {
  it("left the tile and 18 under it its line; right the sentence's card, After posting, the line's card, the rest", () => {
    const { container } = render(
      <WideFrame
        tile={<i data-testid="tile" />}
        under={<i data-testid="under" />}
        first={<i data-testid="first" />}
        after={<i data-testid="after" />}
        line={<i data-testid="line" />}
        rest={
          <>
            <i data-testid="tabs" />
            <i data-testid="panel" />
          </>
        }
      />,
    );
    const column = part(container, "tile-column");
    expect(column.firstElementChild).toBe(container.querySelector('[data-testid="tile"]'));
    const under = part(column, "under");
    expect(under.className).toContain("mt-[18px]");
    expect(under.className).toContain("min-h-[34px]");
    const grid = column.parentElement!;
    expect(grid.className).toContain("max-w-[980px]");
    expect(grid.className).toContain("grid-cols-[minmax(0,372fr)_minmax(0,588fr)]");
    expect(grid.className).toMatch(/\bgap-5\b/);
    const right = grid.children[1]!;
    const sentence = container.querySelector<HTMLElement>('[data-result="sentence-card"]')!;
    const after = part(container, "after");
    const lineCard = part(container, "line-card");
    expect([...right.children].slice(0, 3)).toEqual([sentence, after, lineCard]);
    expect(sentence.querySelector('[data-testid="first"]')).not.toBeNull();
    expect(sentence.className).toContain("min-h-[158px]");
    expect(sentence.className).toContain("p-[22px]");
    expect(after.className).toContain("empty:hidden");
    expect(after.querySelector('[data-testid="after"]')).not.toBeNull();
    expect(lineCard.className).toMatch(/\bpx-6\b/);
    expect(lineCard.className).toMatch(/\bpt-8\b/);
    expect(lineCard.className).toMatch(/\bpb-3\.5\b/);
    expect(lineCard.querySelector('[data-testid="line"]')).not.toBeNull();
    const rest = right.children[3]!;
    expect(rest.className).toMatch(/\bgap-4\b/);
    expect([...rest.children].map((el) => el.getAttribute("data-testid"))).toEqual(["tabs", "panel"]);
  });

  it("waiting: the sentence's card empty at its resting height, no After posting, no rest", () => {
    const { container } = render(<WideFrame name="running" tile={<i />} under={null} first={null} line={<i />} />);
    const root = container.querySelector('[data-result="running"]')!;
    const sentence = root.querySelector('[data-result="sentence-card"]')!;
    expect(sentence.children).toHaveLength(0);
    expect(root.querySelector('[data-part="after"]')).toBeNull();
    expect(part(root, "line-card").parentElement!.lastElementChild).toBe(part(root, "line-card"));
  });

  it("the classes it is given go on the sentence, After posting and the rest", () => {
    const { container } = render(
      <WideFrame
        tile={null}
        under={null}
        first={<i />}
        firstClassName="x-first"
        after={<i />}
        afterClassName="x-after"
        line={null}
        rest={<i />}
        restClassName="x-rest"
      />,
    );
    expect(container.querySelector('[data-result="sentence-card"]')!.firstElementChild!.className).toMatch(/\bx-first\b/);
    expect(part(container, "after").className).toMatch(/\bx-after\b/);
    expect(part(container, "line-card").nextElementSibling!.className).toMatch(/\bx-rest\b/);
    expect(part(container, "line-card").className).not.toMatch(/\bx-(first|after|rest)\b/);
  });
});

describe("ResultFrame", () => {
  it("the first block's own boxes, empty, and no text", () => {
    const { container } = render(<ResultFrame />);
    const frame = container.querySelector<HTMLElement>('[aria-busy="true"]')!;
    expect(frame.textContent).toBe("");
    const [phone, wide] = [...frame.children];
    expect(phone!.className).toMatch(/\bmd:hidden\b/);
    expect(part(phone!, "tile-box").firstElementChild!.className).toMatch(/aspect-\[9\/16\]/);
    expect(part(phone!, "plot").style.height).toBe("100px");
    expect(part(phone!, "strip-slot").firstElementChild!.getAttribute("style")).toContain("height: 38px");
    expect(part(phone!, "times").textContent).toBe("");
    expect(part(wide!, "plot").style.height).toBe("104px");
    expect(part(wide!, "strip-slot").firstElementChild!.getAttribute("style")).toContain("height: 46px");
    expect(wide!.querySelector('[data-result="sentence-card"]')!.className).toContain("min-h-[158px]");
  });
});
