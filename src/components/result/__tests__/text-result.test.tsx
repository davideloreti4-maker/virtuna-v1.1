/** @vitest-environment happy-dom */
/**
 * TextResultView — the result page of a text simulation (spec §4), from props. Real parts: the gauge,
 * the ring, the model. Stood in for: the router (Back) and the build-time flag.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));
const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/simulation/hook/t/k" }));

import { HOOK_1_POPULATION, MEAL_PREP_HOOKS, population } from "@/components/thread-next/__tests__/fixtures/answers";
import { textResultOf } from "@/lib/result/text-result";
import { useShellStore } from "@/stores/shell-store";
import { TextResultView } from "../text-result";

const HOOK = MEAL_PREP_HOOKS[0]!.props.hookLine;
const model = textResultOf(HOOK_1_POPULATION)!;
const result = { kind: "result" as const, text: HOOK, model };

afterEach(() => {
  cleanup();
  router.push.mockReset();
  router.back.mockReset();
});

describe("TextResultView", () => {
  it("the text, the number, the primary, the ring and the ten groups; no Share", () => {
    const onScript = vi.fn();
    render(<TextResultView state={result} as="hook" onScript={onScript} />);
    expect(screen.getByRole("heading", { level: 1, name: "Hook" })).toBeInTheDocument();
    expect(useShellStore.getState().pushedTitle).toBe("Hook");
    expect(screen.getByText(HOOK)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "30% would stop to watch" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Script this one, 2 credits" }));
    expect(onScript).toHaveBeenCalledTimes(1);
    expect(screen.getByText("1,000")).toBeInTheDocument();
    expect(screen.getByText("viewers")).toBeInTheDocument();
    expect(screen.getByText("Each dot is a viewer. Dark ones would stop.")).toBeInTheDocument();
    const list = screen.getByRole("heading", { level: 2, name: "Would stop, by group" }).parentElement!;
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Savers9% of your audience100%",
      "Quiet watchers14% of your audience52%",
      "Scouts6% of your audience42%",
      "Passers-by8% of your audience38%",
      "Sharers12% of your audience36%",
      "Tough crowd9% of your audience27%",
      "Commenters12% of your audience6%",
      "Purposeful viewers6% of your audience5%",
      "Deep fans6% of your audience3%",
      "Regulars18% of your audience1%",
    ]);
    expect(screen.queryByText("Quiet Watchers")).toBeNull();
    // No Share control (the "Sharers" row is a group, not one).
    expect(screen.queryByRole("button", { name: /^share\b/i })).toBeNull();
  });

  it("the ring: ten wedges, 1,000 dots, each lit to its group's percent, never coral", () => {
    render(<TextResultView state={result} as="hook" />);
    const wedges = [...document.querySelectorAll<SVGGElement>("[data-text-result='ring'] [data-wedge]")];
    expect(wedges).toHaveLength(10);
    expect(wedges.reduce((n, w) => n + Number(w.dataset.dots), 0)).toBe(1000);
    const look = (group: string) => wedges.find((w) => w.dataset.wedge === group)!.dataset.look;
    expect(look("saver")).toBe("full");
    expect(look("loyalist")).toBe("part");
    expect(wedges.some((w) => w.dataset.look === "coral")).toBe(false);
  });

  it("a row looks at its group: its wedge stays, the others step back, the centre names it; again lets go", () => {
    render(<TextResultView state={result} as="hook" />);
    const wedges = () => [...document.querySelectorAll<SVGGElement>("[data-text-result='ring'] [data-wedge]")];
    const centre = () => document.querySelector("[data-text-result='centre']")!.textContent;
    expect(wedges().some((w) => w.hasAttribute("data-dimmed"))).toBe(false);
    expect(centre()).toBe("1,000viewers");

    const savers = screen.getByRole("button", { name: /^Savers/ });
    expect(savers).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(savers);
    expect(savers).toHaveAttribute("aria-pressed", "true");
    expect(wedges().filter((w) => !w.hasAttribute("data-dimmed")).map((w) => w.dataset.wedge)).toEqual(["saver"]);
    expect(centre()).toBe("100%Savers");

    // Another row takes over; one group at a time.
    fireEvent.click(screen.getByRole("button", { name: /^Regulars/ }));
    expect(savers).toHaveAttribute("aria-pressed", "false");
    expect(wedges().filter((w) => !w.hasAttribute("data-dimmed")).map((w) => w.dataset.wedge)).toEqual(["loyalist"]);
    expect(centre()).toBe("1%Regulars");

    fireEvent.click(screen.getByRole("button", { name: /^Regulars/ }));
    expect(wedges().some((w) => w.hasAttribute("data-dimmed"))).toBe(false);
    expect(centre()).toBe("1,000viewers");
  });

  it("each row draws its percent as a length; the caption names the group being looked at", () => {
    render(<TextResultView state={result} as="hook" />);
    const bar = (group: string) => document.querySelector<HTMLElement>(`[data-group='${group}'] [data-part='bar'] > span`)!.style.width;
    expect(bar("saver")).toBe("100%");
    expect(bar("lurker")).toBe("52%");
    expect(bar("loyalist")).toBe("1%");
    const caption = () => document.querySelector("[data-text-result='ring'] figcaption")!.textContent;
    expect(caption()).toBe("Each dot is a viewer. Dark ones would stop.");
    fireEvent.click(screen.getByRole("button", { name: /^Regulars/ }));
    expect(caption()).toBe("Regulars · 18% of your audience");
    fireEvent.click(screen.getByRole("button", { name: /^Regulars/ }));
    expect(caption()).toBe("Each dot is a viewer. Dark ones would stop.");
  });

  it("a row picked while the ring is off screen brings the ring back into view; on screen, or letting go, it does not", () => {
    render(<TextResultView state={result} as="hook" />);
    const figure = document.querySelector<HTMLElement>("[data-text-result='ring']")!;
    const scroll = vi.fn();
    figure.scrollIntoView = scroll;
    const place = (top: number, bottom: number) =>
      (figure.getBoundingClientRect = () => ({ top, bottom, left: 0, right: 0, width: 0, height: bottom - top, x: 0, y: top, toJSON: () => ({}) }));
    Object.defineProperty(window, "innerHeight", { value: 852, configurable: true });

    place(120, 460); // on screen
    fireEvent.click(screen.getByRole("button", { name: /^Savers/ }));
    expect(scroll).not.toHaveBeenCalled();

    place(-600, -260); // scrolled away, above
    fireEvent.click(screen.getByRole("button", { name: /^Scouts/ }));
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });

    // Letting go of the picked row does not move the page.
    fireEvent.click(screen.getByRole("button", { name: /^Scouts/ }));
    expect(scroll).toHaveBeenCalledTimes(1);

    // A tap on a wedge never scrolls: the ring is under the finger.
    fireEvent.click(document.querySelector("[data-wedge-area='lurker']")!);
    expect(scroll).toHaveBeenCalledTimes(1);
  });

  it("a wedge is a tap area for a pointer: it picks its group, and the group's row shows it", () => {
    render(<TextResultView state={result} as="hook" />);
    const areas = [...document.querySelectorAll<SVGPathElement>("[data-text-result='ring'] [data-wedge-area]")];
    expect(areas).toHaveLength(10);
    fireEvent.click(areas.find((a) => a.dataset.wedgeArea === "lurker")!);
    expect(screen.getByRole("button", { name: /^Quiet watchers/ })).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector("[data-text-result='centre']")!.textContent).toBe("52%Quiet watchers");
    // The areas are for a pointer only: the picture stays out of the accessibility tree.
    expect(areas[0]!.closest("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("a mouse over a row looks without picking; leaving lets go; a finger's pointer does not look", () => {
    render(<TextResultView state={result} as="hook" />);
    const dimmed = () => document.querySelectorAll("[data-text-result='ring'] [data-dimmed]").length;
    const scouts = screen.getByRole("button", { name: /^Scouts/ });
    fireEvent.pointerEnter(scouts, { pointerType: "touch" });
    expect(dimmed()).toBe(0);
    fireEvent.pointerEnter(scouts, { pointerType: "mouse" });
    expect(dimmed()).toBe(9);
    expect(scouts).toHaveAttribute("aria-pressed", "false");
    fireEvent.pointerLeave(scouts, { pointerType: "mouse" });
    expect(dimmed()).toBe(0);
  });

  it("one column as drawn, two where the body has 920 of room; a result with no groups stays one column", () => {
    const { unmount } = render(<TextResultView state={result} as="hook" />);
    const column = document.querySelector("[data-text-result='hero']")!.parentElement!.parentElement!;
    expect(column.className).toContain("max-w-[640px]");
    expect(column.className).toContain("@min-[920px]:grid-cols-[400px_minmax(0,1fr)]");
    // The hero and the ring share the first column; the groups are the second.
    expect(column.children).toHaveLength(2);
    expect(column.children[0]!.querySelector("[data-text-result='ring']")).not.toBeNull();
    expect(column.children[1]!.getAttribute("data-text-result")).toBe("groups");
    expect(document.querySelector("[data-result-body]")!.className).toContain("@container");
    unmount();

    render(<TextResultView state={{ kind: "result", text: HOOK, model: textResultOf(population(25.8))! }} as="hook" />);
    expect(document.querySelector("[data-text-result='hero']")!.parentElement!.className).not.toContain("@min-[920px]");
  });

  it("an opening line: titled so, and no primary (it is already a script)", () => {
    render(<TextResultView state={result} as="opening" onScript={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Opening line" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Script this one/ })).toBeNull();
  });

  it("an idea: titled Idea, with the primary", () => {
    render(<TextResultView state={result} as="idea" onScript={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Idea" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Script this one, 2 credits" })).toBeInTheDocument();
  });

  it("a result with a number but no groups: the hero only, no ring and no groups card", () => {
    render(<TextResultView state={{ kind: "result", text: HOOK, model: textResultOf(population(25.8))! }} as="hook" onScript={vi.fn()} />);
    expect(screen.getByRole("img", { name: "26% would stop to watch" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Script this one, 2 credits" })).toBeInTheDocument();
    expect(document.querySelector("[data-text-result='ring']")).toBeNull();
    expect(document.querySelector("[data-text-result='groups']")).toBeNull();
    expect(screen.queryByText("1,000")).toBeNull();
  });

  it("loading: three quiet blocks and no number", () => {
    render(<TextResultView state={{ kind: "loading" }} as="hook" />);
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it("not found: the line and Back", () => {
    Object.defineProperty(window.history, "length", { value: 3, configurable: true });
    render(<TextResultView state={{ kind: "not-found" }} as="hook" />);
    expect(screen.getByText("This simulation isn't here.")).toBeInTheDocument();
    const back = screen.getAllByRole("button", { name: "Back" }).find((b) => b.textContent === "Back")!;
    fireEvent.click(back);
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
