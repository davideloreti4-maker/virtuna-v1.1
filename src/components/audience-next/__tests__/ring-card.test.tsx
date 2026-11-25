/** @vitest-environment happy-dom */
/**
 * RingCard and PaleRing, rendered for real on the dev preview's fixtures: the ring draws the groups' own
 * counts and says its total to a screen reader, a wedge's tap area picks its group, a focused group steps
 * the other nine back and names itself in the centre. The handler is a spy; nothing of ours is stood in for.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { DEV_PAGES } from "@/app/(app)/dev/audience/fixtures";

import { PaleRing, RingCard } from "../ring-card";

afterEach(cleanup);

const page = DEV_PAGES.own.page;

function ring(focus: (typeof page.groups)[number]["group"] | null = null, onPick = vi.fn()) {
  const view = render(<RingCard wedges={page.wedges} groups={page.groups} focus={focus} onPick={onPick} />);
  return { ...view, onPick };
}

const wedges = (root: HTMLElement) => Array.from(root.querySelectorAll<SVGGElement>("[data-wedge]"));
const centre = (root: HTMLElement) =>
  Array.from(root.querySelectorAll("[data-ring-centre] text")).map((t) => t.textContent);

describe("RingCard", () => {
  it("draws ten wedges in the groups' order, each with as many dots as its group counts", () => {
    const { container } = ring();
    const drawn = wedges(container);
    expect(drawn.map((w) => w.getAttribute("data-wedge"))).toEqual(page.groups.map((g) => g.group));
    expect(drawn.map((w) => Number(w.getAttribute("data-dots")))).toEqual(page.groups.map((g) => g.count));
    expect(drawn.every((w) => w.getAttribute("data-look") === "full")).toBe(true);
  });

  it("with no group looked at: 1,000 over viewers, nothing stepped back", () => {
    const { container } = ring();
    expect(centre(container)).toEqual(["1,000", "viewers"]);
    expect(container.querySelectorAll("[data-dimmed]")).toHaveLength(0);
  });

  it("says its total to a screen reader, whatever group is looked at", () => {
    const { container } = ring("saver");
    const total = Array.from(container.querySelectorAll(".sr-only")).map((el) => el.textContent);
    expect(total).toEqual(["1,000 viewers"]);
  });

  it("a wedge's tap area picks its group", () => {
    const { container, onPick } = ring();
    const third = page.groups[2]!.group;
    fireEvent.click(container.querySelector(`[data-wedge-area="${third}"]`)!);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(third);
  });

  it("the tap areas are for a pointer: hidden from assistive technology", () => {
    const { container } = ring();
    const areas = container.querySelectorAll("[data-wedge-area]");
    expect(areas).toHaveLength(10);
    expect(areas[0]!.closest("svg")!.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("[data-ring]")!.getAttribute("aria-hidden")).toBe("true");
  });

  it("a focused group dims the other nine and puts its count and name in the centre", () => {
    const savers = page.groups.find((g) => g.group === "saver")!;
    const { container } = ring("saver");
    const dimmed = wedges(container).filter((w) => w.hasAttribute("data-dimmed"));
    expect(dimmed).toHaveLength(9);
    expect(dimmed.map((w) => w.getAttribute("data-wedge"))).not.toContain("saver");
    expect(centre(container)).toEqual([String(savers.count), "Savers"]);
  });
});

describe("PaleRing", () => {
  it("ten equal pale wedges and nothing in the middle", () => {
    const { container } = render(<PaleRing />);
    const drawn = wedges(container);
    expect(drawn).toHaveLength(10);
    expect(drawn.every((w) => w.getAttribute("data-look") === "pale")).toBe(true);
    expect(container.querySelectorAll("text")).toHaveLength(0);
    expect(container.querySelectorAll("[data-wedge-area]")).toHaveLength(0);
  });
});
