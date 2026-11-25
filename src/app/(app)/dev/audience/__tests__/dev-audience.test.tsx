/** @vitest-environment happy-dom */
/**
 * The dev preview's own states for a group's sheet and More: `group` opens on the third group's sheet,
 * `menu` opens on More; `read-again` opens on Read again's question, and `reading`, `reading-thin` and
 * `reading-failed` show a read again in place of the page. Local state only: nothing is sent. Stand-ins: the build-time flag (on), `fetch` (a
 * spy that must stay unused) and `matchMedia` (a phone).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import { settleClock } from "@/components/thread-next/answer-sheet";
import { AUDIENCE_STRINGS as S, disconnectItem, fromVideos, moreLabel, readAgainLine } from "@/lib/audience-next/audience-words";
import { useShellStore } from "@/stores/shell-store";

import { DevAudience } from "../dev-audience";
import { DEV_PAGES } from "../fixtures";

const OWN = DEV_PAGES.own.page;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  useShellStore.setState({ pushedTitle: "" });
});

const dimmed = () => Array.from(document.querySelectorAll("[data-ring] [data-dimmed]")).map((w) => w.getAttribute("data-wedge"));

describe("/dev/audience — a group and More", () => {
  it("group: the own page with the third group's sheet open, the other nine wedges dimmed", async () => {
    render(<DevAudience state="group" />);
    const third = OWN.groups[2]!;
    expect(await screen.findByRole("dialog", { name: third.name })).toBeInTheDocument();
    expect(dimmed()).toHaveLength(9);
    expect(dimmed()).not.toContain(third.group);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(dimmed()).toEqual([]);
  });

  it("menu: the own page with More open on its menu", async () => {
    render(<DevAudience state="menu" />);
    const menu = await screen.findByRole("dialog", { name: OWN.name });
    const items = within(menu).getAllByRole("button").map((b) => b.textContent);
    expect(items).toEqual(expect.arrayContaining([S.rename, S.readAgain, disconnectItem("nia.tests")]));
  });

  it("the other states: a row opens its group's sheet, and More is in the header", async () => {
    render(<DevAudience state="own" />);
    expect(screen.queryByRole("dialog")).toBeNull();
    const first = OWN.groups[0]!;
    fireEvent.click(document.querySelector<HTMLElement>(`[data-group-row="${first.group}"]`)!);
    expect(await screen.findByRole("dialog", { name: first.name })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: moreLabel(OWN.name), hidden: true })).toBeInTheDocument();
  });

  it("a rename shows at once, locally; nothing is sent", async () => {
    render(<DevAudience state="described" />);
    const page = DEV_PAGES.described.page;
    fireEvent.click(screen.getByRole("button", { name: moreLabel(page.name) }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: S.rename }));
    fireEvent.change(within(screen.getByRole("dialog")).getByRole("textbox"), { target: { value: "Night owls" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: S.save }));
    await waitFor(() => expect(document.querySelector('[data-block="source"] h2')).toHaveTextContent("Night owls"));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("none, loading and failed have no More", () => {
    for (const state of ["none", "loading", "failed"] as const) {
      render(<DevAudience state={state} />);
      expect(screen.queryByRole("button", { name: new RegExp(`^${S.more}:`) })).toBeNull();
      cleanup();
    }
  });
});

describe("/dev/audience — the switcher", () => {
  it("switcher: the own page with the pill's layer open on its rows; a pick only closes it, nothing is sent", async () => {
    render(<DevAudience state="switcher" />);
    const layer = await screen.findByRole("dialog", { name: S.switcherTitle });
    for (const choice of DEV_PAGES.own.choices) {
      expect(within(layer).getByRole("button", { name: choice.name })).toHaveAttribute("aria-pressed", String(choice.selected));
    }
    expect(within(layer).getByRole("button", { name: S.newAudience })).toBeInTheDocument();
    fireEvent.click(within(layer).getByRole("button", { name: DEV_PAGES.own.choices[1]!.name }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(fetch).not.toHaveBeenCalled();
  });

  it("New audience only closes it too", async () => {
    render(<DevAudience state="switcher" />);
    const layer = await screen.findByRole("dialog", { name: S.switcherTitle });
    fireEvent.click(within(layer).getByRole("button", { name: S.newAudience }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(fetch).not.toHaveBeenCalled();
  });

  it("every audience state has the pill in its header, named for the page; it opens the layer", async () => {
    render(<DevAudience state="described" />);
    const page = DEV_PAGES.described.page;
    const pill = screen.getByRole("button", { name: `${S.switcherTitle}: ${page.name}` });
    expect(document.querySelector("header")!.contains(pill)).toBe(true);
    fireEvent.click(pill);
    expect(await screen.findByRole("dialog", { name: S.switcherTitle })).toBeInTheDocument();
  });

  it("none, loading and failed have no pill", () => {
    for (const state of ["none", "loading", "failed"] as const) {
      render(<DevAudience state={state} />);
      expect(screen.queryByRole("button", { name: new RegExp(`^${S.switcherTitle}:`) })).toBeNull();
      cleanup();
    }
  });
});

describe("/dev/audience — Read again", () => {
  let tick = 0;
  beforeEach(() => {
    // The question's first moment takes no press; these tests are not about that moment.
    settleClock.now = () => (tick += 1000);
  });
  afterEach(() => {
    settleClock.now = () => performance.now();
  });

  const header = () => document.querySelector("header")!;
  const building = () => document.querySelector<HTMLElement>("[data-building]");

  it("read-again: the own page with the question open; Cancel closes it, nothing is sent", async () => {
    render(<DevAudience state="read-again" />);
    const question = await screen.findByRole("dialog", { name: S.readAgain });
    expect(within(question).getByText(readAgainLine("nia.tests"))).toBeInTheDocument();
    fireEvent.click(within(question).getByRole("button", { name: S.cancel }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(fetch).not.toHaveBeenCalled();
  });

  it("the source card's Read again and More's item open the question; confirming only closes it", async () => {
    render(<DevAudience state="own" />);
    fireEvent.click(within(document.querySelector<HTMLElement>('[data-block="source"]')!).getByRole("button", { name: S.readAgain }));
    let question = await screen.findByRole("dialog", { name: S.readAgain });
    fireEvent.click(within(question).getByRole("button", { name: S.readAgain }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: moreLabel(OWN.name) }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: S.readAgain }));
    question = await screen.findByRole("dialog", { name: S.readAgain });
    expect(question).toBeInTheDocument();
    expect(building()).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reading: the read running in place of the page; the title alone in the header; the face, the steps, the evidence", () => {
    render(<DevAudience state="reading" />);
    expect(building()).toHaveAttribute("data-building", "running");
    expect(document.querySelector("[data-audience-body]")).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: S.title })).toBeInTheDocument();
    expect(within(header()).queryAllByRole("button")).toEqual([]);
    expect(building()!.querySelector("[data-face]")).toHaveTextContent(OWN.face.initial);
    expect([...document.querySelectorAll("[data-step]")].map((li) => li.getAttribute("data-step"))).toEqual(["done", "now", "next"]);
    expect(building()!.querySelector("[data-evidence]")).toHaveTextContent(fromVideos("your"));
    expect(screen.getByText(S.keepOpen)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reading-thin: too little to read, the groups kept; Close goes back to the page", () => {
    render(<DevAudience state="reading-thin" />);
    expect(screen.getByRole("heading", { level: 2, name: S.thinTitle })).toBeInTheDocument();
    expect(screen.getByText(S.keptAsWas)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: S.close }));
    expect(building()).toBeNull();
    expect(document.querySelector("[data-audience-body]")).not.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reading-failed: the sentence and Try again (it does nothing here); Close goes back to the page", () => {
    render(<DevAudience state="reading-failed" />);
    expect(screen.getByRole("alert")).toHaveTextContent(S.accountNotFound);
    fireEvent.click(screen.getByRole("button", { name: S.tryAgain }));
    expect(building()).toHaveAttribute("data-building", "failed");
    fireEvent.click(screen.getByRole("button", { name: S.close }));
    expect(building()).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
