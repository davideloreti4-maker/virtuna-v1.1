/** @vitest-environment happy-dom */
/**
 * Audience on a desk (spec 2026-11-25-audience, 3.4; the right half of the drawing's desktop frame): from a
 * body 920 wide, two columns in Library's 1012 column. Left: where it came from, the figures, the read's two
 * texts, the videos Maven read. Right, 432 wide: the ring, the buttons under it, then the groups. The DOM
 * keeps the phone's order (ring, source, figures, actions, groups, texts, videos), so a screen reader and the
 * keyboard read the page the same way at every width: the right column's blocks float, each under the last.
 *
 * happy-dom lays nothing out, so this holds the classes that make the columns; where the blocks land is
 * measured in a real browser. Stood in for: the build-time flag (on).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { DEV_PAGES, type DevPageName } from "@/app/(app)/dev/audience/fixtures";
import type { AudiencePage } from "@/lib/audience-next/audience-model";
import { useShellStore } from "@/stores/shell-store";

import { AudienceNextLoading, AudienceScreen, type AudienceScreenProps } from "../audience-screen";

afterEach(() => {
  cleanup();
  useShellStore.setState({ pushedTitle: "" });
});

const OWN = DEV_PAGES.own.page;

function props(over: Partial<AudienceScreenProps> = {}): AudienceScreenProps {
  return {
    state: { kind: "audience", page: OWN },
    pushed: false,
    focus: null,
    onPickGroup: vi.fn(),
    onSimulate: vi.fn(),
    onUseForNewChats: vi.fn(),
    onRetry: vi.fn(),
    ...over,
  };
}
const showing = (page: AudiencePage, over: Partial<AudienceScreenProps> = {}) =>
  render(<AudienceScreen {...props({ state: { kind: "audience", page }, ...over })} />);

const body = () => document.querySelector<HTMLElement>("[data-audience-body]")!;
/** The body's blocks, in the DOM's order (the loading outline's screen-reader line is not one: `sr-only`
 *  takes it out of the flow). */
const blocks = () => (Array.from(body().children) as HTMLElement[]).filter((el) => el.hasAttribute("data-block"));
const names = () => blocks().map((b) => b.getAttribute("data-block"));
const block = (name: string) => document.querySelector<HTMLElement>(`[data-block="${name}"]`)!;

const RIGHT = ["@min-[920px]:float-right", "@min-[920px]:clear-right", "@min-[920px]:w-[432px]"];
const LEFT = ["@min-[920px]:mr-[452px]"];
const BELOW = "@min-[920px]:mt-3";

const RIGHT_BLOCKS = new Set(["ring", "actions", "groups"]);
const FIRST_IN_COLUMN = new Set(["ring", "source", "invite"]);

/** Every block carries its column's classes, and only those; the first of each column has nothing above. */
function expectColumns() {
  for (const el of blocks()) {
    const name = el.getAttribute("data-block")!;
    const right = RIGHT_BLOCKS.has(name);
    for (const c of RIGHT) expect(el.classList.contains(c), `${name} ${c}`).toBe(right);
    for (const c of LEFT) expect(el.classList.contains(c), `${name} ${c}`).toBe(!right);
    expect(el.classList.contains(BELOW), `${name} ${BELOW}`).toBe(!FIRST_IN_COLUMN.has(name));
  }
}

describe("Audience on a desk: two columns, the DOM in the phone's order", () => {
  it("the blocks keep the phone's order: ring, source, figures, actions, groups, texts, videos", () => {
    showing(OWN);
    expect(names()).toEqual(["ring", "source", "figures", "actions", "groups", "texts", "videos"]);
  });

  it("the body lays out by its own width: a column with a gap, and from 920 a flow that holds its floats", () => {
    showing(OWN);
    expect(body().parentElement).toHaveClass("@container");
    expect(body()).toHaveClass("flex", "flex-col", "gap-3", "@min-[920px]:flow-root");
  });

  it("the ring, the buttons and the groups float to the right column, 432 wide, each under the last", () => {
    showing(OWN);
    for (const name of ["ring", "actions", "groups"]) expect(block(name)).toHaveClass(...RIGHT);
  });

  it("the source, the figures, the texts and the videos keep the left, clear of the right column and the 20 between", () => {
    showing(OWN);
    for (const name of ["source", "figures", "texts", "videos"]) {
      expect(block(name)).toHaveClass(...LEFT);
      expect(block(name)).not.toHaveClass("@min-[920px]:float-right");
    }
  });

  it("the ring and the source start at the top; every later block has the phone's 12 above it", () => {
    showing(OWN);
    expectColumns();
  });

  it.each(["other", "described", "few", "bare", "not-default"] satisfies DevPageName[])(
    "%s: every block it has sits in its column (a block left out moves nothing else)",
    (name) => {
      showing(DEV_PAGES[name].page);
      expectColumns();
    },
  );

  it("loading: the outline's blocks take the same columns", () => {
    render(<AudienceNextLoading pushed={false} />);
    expect(names()).toEqual(["ring", "source", "figures", "actions", "groups"]);
    expectColumns();
    // The only other child: the status line, out of the flow.
    const others = Array.from(body().children).filter((el) => !el.hasAttribute("data-block"));
    expect(others).toHaveLength(1);
    expect(others[0]).toHaveClass("sr-only");
  });

  it("none yet: the pale ring on the right, the invitation on the left", () => {
    render(<AudienceScreen {...props({ state: { kind: "none" } })} />);
    expect(names()).toEqual(["ring", "invite"]);
    expectColumns();
  });

  it("a read standing in for the page keeps to a column of 560 (the new audience page's)", () => {
    showing(OWN, { building: <p>the building view</p> });
    const view = screen.getByText("the building view");
    expect(view.parentElement).toHaveClass("max-w-[560px]");
    expect(document.querySelector("[data-audience-body]")).toBeNull();
  });
});

describe("Audience on a desk: the title row", () => {
  const slots = { switcher: <button type="button">pill</button>, menu: <button type="button">more</button> };

  it("in Library's 1012 column: the h1 at the left, the pill and More at the right, 44 above", () => {
    showing(OWN, slots);
    const header = document.querySelector("header")!;
    expect(header.parentElement).toHaveClass("mx-auto", "max-w-[1012px]", "px-4");
    expect(header).toHaveClass("md:justify-between", "md:pt-11");
    const [first, last] = Array.from(header.children);
    expect(first!.tagName).toBe("H1");
    expect(last).toHaveClass("ml-auto");
    expect(Array.from(last!.querySelectorAll("button")).map((b) => b.textContent)).toEqual(["pill", "more"]);
  });

  it("pushed (an audience's own address): the same row on a desk; only the phone hides the h1 (the shell names the page there)", () => {
    showing(DEV_PAGES["not-default"].page, { ...slots, pushed: true });
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveClass("max-md:hidden");
    expect(h1).not.toHaveClass("hidden");
    expect(h1).not.toHaveClass("md:hidden");
    expect(document.querySelector("header")).not.toHaveClass("md:hidden");
  });
});
