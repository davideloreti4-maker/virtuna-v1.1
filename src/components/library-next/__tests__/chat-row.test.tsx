/** @vitest-environment happy-dom */

/**
 * A Library row (spec 2026-11-23 §3.1), rendered for real: the quiet line from a chat's summary
 * (`rowLine`), the title a chat without one is given (`fallbackTitle`), and the row itself: its
 * name and description, its tile (a video's picture, else the mark of what the chat holds), its
 * gauge and what a tap opens. Stand-ins only at the edges: the clock, the network (`fetch`, for a
 * stored video's still) and the browser's on-screen watcher.
 */

import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { axe } from "vitest-axe";

import { renderWithClient } from "@/test/render-with-client";

import { ChatRow, fallbackTitle, rowLine, type ChatRowData } from "../chat-row";
import { atWidth } from "./posted-chats";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const NOW = Date.parse("2026-11-23T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const NONE = { hooks: 0, ideas: 0, scripts: 0, remixes: 0, videos: 0, texts: 0 };

describe("rowLine — what is inside, and when", () => {
  const atNow = () => vi.spyOn(Date, "now").mockReturnValue(NOW);

  it("simulated, with a time: the simulation's time", () => {
    atNow();
    const summary = { counts: { ...NONE, hooks: 3 }, lead: "hooks" as const, sim: { at: ago(2 * HOUR) } };
    expect(rowLine(summary, ago(10 * 60_000))).toBe("3 hooks · simulated 2h ago");
  });

  it("simulated, with no usable time: simulated, and no time", () => {
    atNow();
    const counts = { ...NONE, hooks: 3 };
    expect(rowLine({ counts, lead: "hooks", sim: { at: "" } }, ago(HOUR))).toBe("3 hooks · simulated");
    expect(rowLine({ counts, lead: "hooks", sim: { at: "not a time" } }, ago(HOUR))).toBe("3 hooks · simulated");
  });

  it("not simulated: the chat's last message", () => {
    atNow();
    expect(rowLine({ counts: { ...NONE, scripts: 1 }, lead: "script", sim: null }, ago(2 * HOUR))).toBe("Script · 2h ago");
    // Older than a week: the date, as Home's Recent shows it.
    expect(rowLine({ counts: NONE, lead: "chat", sim: null }, "2026-10-24T09:00:00Z")).toBe("Chat · Oct 24");
  });

  it("not simulated and no time either: what is inside alone, no trailing dot", () => {
    atNow();
    expect(rowLine({ counts: { ...NONE, scripts: 1 }, lead: "script", sim: null }, "")).toBe("Script");
  });

  it("reads a summary that carries more than it needs (the endpoint's link)", () => {
    atNow();
    const fromEndpoint = {
      counts: { ...NONE, videos: 1 },
      lead: "video" as const,
      stage: "simulated" as const,
      sim: { number: 38, measure: "end" as const, at: ago(DAY + HOUR), kind: "video" as const, href: "/simulation/x" },
      frame: null,
    };
    expect(rowLine(fromEndpoint, ago(HOUR))).toBe("Video · simulated 1d ago");
  });
});

describe("fallbackTitle — a chat with no title of its own", () => {
  it.each([
    ["video", "Video simulation"],
    ["hooks", "Hooks"],
    ["ideas", "Ideas"],
    ["script", "Script"],
    ["remix", "Remix"],
    ["text", "Text simulation"],
    ["chat", "Chat"],
  ] as const)("%s → %s", (lead, title) => {
    expect(fallbackTitle(lead)).toBe(title);
  });
});

const BASE: ChatRowData = {
  id: "c1",
  title: "Hook formats, the $400 test",
  pinned: false,
  line: "3 hooks · simulated 2h ago",
  lead: "hooks",
  stageWord: "Simulated",
  frame: null,
  still: null,
  gauge: { number: 66, describes: "66% would stop to watch", href: "/simulation/hook/c1/k1" },
};

const row = (over: Partial<ChatRowData> = {}) => ({ ...BASE, ...over });

function renderRow(over: Partial<ChatRowData> = {}, menu?: React.ReactNode) {
  const onOpen = vi.fn();
  const view = render(
    <ul>
      <ChatRow chat={row(over)} onOpen={onOpen} menu={menu} />
    </ul>,
  );
  return { onOpen, ...view };
}

/** The browser's on-screen watcher, stood in for: every watched tile is on screen at once. */
function onScreen() {
  class Watcher {
    constructor(private readonly notify: (entries: Array<{ isIntersecting: boolean; target: Element }>) => void) {}
    observe(el: Element) {
      this.notify([{ isIntersecting: true, target: el }]);
    }
    disconnect() {}
    unobserve() {}
  }
  vi.stubGlobal("IntersectionObserver", Watcher);
}

describe("ChatRow — the row", () => {
  it("is one button named by the title, its line as the description", () => {
    renderRow();
    const button = screen.getByRole("button", { name: "Hook formats, the $400 test" });
    expect(button).toHaveAccessibleDescription("3 hooks · simulated 2h ago");
    expect(button).toHaveTextContent("3 hooks · simulated 2h ago");
  });

  it("a tap on the row opens the chat", () => {
    const { onOpen } = renderRow();
    fireEvent.click(screen.getByRole("button", { name: "Hook formats, the $400 test" }));
    expect(onOpen).toHaveBeenCalledWith("c1");
  });

  it("is at least 72 tall: a 44 tap on any part of it", () => {
    renderRow();
    expect(screen.getByRole("button", { name: "Hook formats, the $400 test" })).toHaveClass("min-h-[72px]");
  });

  it("the title is clamped to two lines", () => {
    renderRow();
    expect(screen.getByText("Hook formats, the $400 test")).toHaveClass("line-clamp-2");
  });

  it("the quiet line: one line, cut, from 360 up; below 360 it may wrap onto a second line so the \"when\" is kept", () => {
    renderRow();
    const line = screen.getByText("3 hooks · simulated 2h ago");
    const classes = line.className.split(/\s+/);
    expect(classes).toContain("truncate");
    // Tailwind's `max-[360px]` is `width < 360px`: the narrow phones only, 360 and up unchanged.
    expect(classes).toEqual(expect.arrayContaining(["max-[360px]:whitespace-normal", "max-[360px]:line-clamp-2"]));
    expect(classes.filter((c) => c.includes(":") && !c.startsWith("max-[360px]:"))).toEqual([]);
  });

  it("a pinned chat says so, in its picture and its description", () => {
    const { container } = renderRow({ pinned: true });
    expect(container.querySelector('[data-part="pin"]')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hook formats, the $400 test" })).toHaveAccessibleDescription(
      "Pinned, 3 hooks · simulated 2h ago",
    );
  });

  it("an unpinned one shows no pin", () => {
    const { container } = renderRow();
    expect(container.querySelector('[data-part="pin"]')).toBeNull();
  });

  it("the stage word is there for the table and hidden on the phone", () => {
    renderRow({ stageWord: "Draft", gauge: null });
    expect(screen.getByText("Draft")).toHaveClass("hidden", "md:block");
  });

  it("a plain chat has no stage word", () => {
    const { container } = renderRow({ lead: "chat", stageWord: null, gauge: null, line: "Chat · Oct 24" });
    expect(container.querySelector('[data-part="stage"]')).toBeEmptyDOMElement();
  });

  it("the menu it is handed sits inside the row, outside the row's button", () => {
    renderRow({}, <button type="button">More</button>);
    const more = screen.getByRole("button", { name: "More" });
    const rowButton = screen.getByRole("button", { name: "Hook formats, the $400 test" });
    expect(more.closest("li")).toBe(rowButton.closest("li"));
    expect(rowButton.contains(more)).toBe(false);
  });

  it("has no axe violations", async () => {
    const { container } = renderRow({ pinned: true }, <button type="button">More</button>);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("ChatRow — the tile", () => {
  it("a video with a frame shows it, decorative", () => {
    const { container } = renderRow({ lead: "video", frame: "/frames/0.jpg" });
    const img = container.querySelector<HTMLImageElement>('[data-part="thumb"] img');
    expect(img).toHaveAttribute("src", "/frames/0.jpg");
    expect(img).toHaveAttribute("alt", "");
    expect(container.querySelector('[data-part="video-mark"]')).toBeNull();
  });

  it("when the frame fails to load, the video mark shows instead", () => {
    const { container } = renderRow({ lead: "video", frame: "/frames/gone.jpg" });
    fireEvent.error(container.querySelector('[data-part="thumb"] img')!);
    expect(container.querySelector('[data-part="thumb"] img')).toBeNull();
    expect(container.querySelector('[data-part="video-mark"]')).toBeInTheDocument();
  });

  it("a video with neither frame nor still shows the video mark from the start", () => {
    const { container } = renderRow({ lead: "video" });
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[data-part="video-mark"]')).toBeInTheDocument();
  });

  it("a video with no frame but its stored file: the file's first frame, once the tile is on screen", async () => {
    onScreen();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ url: "/signed/take.mp4" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = renderWithClient(
      <ul>
        <ChatRow chat={row({ lead: "video", still: "u1/take one.mp4" })} onOpen={() => {}} />
      </ul>,
    );
    await waitFor(() => expect(container.querySelector('[data-part="still"]')).toHaveAttribute("src", "/signed/take.mp4#t=0.1"));
    expect(fetchMock).toHaveBeenCalledWith(`/api/videos/sign?path=${encodeURIComponent("u1/take one.mp4")}`);
  });

  it("a non-video row with a stored file asks for nothing (fix round 1)", async () => {
    onScreen();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ url: "/signed/take.mp4" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = renderWithClient(
      <ul>
        <ChatRow chat={row({ lead: "hooks", still: "u1/take.mp4" })} onOpen={() => {}} />
      </ul>,
    );
    // Long enough for a query the row might have started to have asked.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelector('[data-part="still"]')).toBeNull();
    expect(container.querySelector('[data-part="mark"]')).toHaveAttribute("data-kind", "hooks");
  });

  it("a video whose frame has loaded asks for nothing, though its stored file is known (fix round 1)", async () => {
    onScreen();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ url: "/signed/take.mp4" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = renderWithClient(
      <ul>
        <ChatRow chat={row({ lead: "video", frame: "/frames/0.jpg", still: "u1/take.mp4" })} onOpen={() => {}} />
      </ul>,
    );
    fireEvent.load(container.querySelector('[data-part="thumb"] img')!);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelector('[data-part="thumb"] img')).toHaveAttribute("src", "/frames/0.jpg");
    expect(container.querySelector('[data-part="still"]')).toBeNull();
  });

  it.each([
    ["hooks"],
    ["ideas"],
    ["script"],
    ["remix"],
    ["text"],
    ["chat"],
  ] as const)("a %s chat shows its kind's mark, never a picture", (lead) => {
    const { container } = renderRow({ lead, frame: "/frames/0.jpg", gauge: null });
    expect(container.querySelector("img")).toBeNull();
    const mark = container.querySelector('[data-part="mark"]');
    expect(mark).toHaveAttribute("data-kind", lead);
    expect(mark?.querySelector("svg")).toBeInTheDocument();
  });

  it("the tile is 42 × 56 on the phone", () => {
    const { container } = renderRow();
    expect(container.querySelector('[data-part="mark"]')).toHaveClass("w-[42px]", "h-14");
  });
});

describe("ChatRow — the gauge", () => {
  it("only with a number: a chat with nothing simulated has no gauge", () => {
    const { container } = renderRow({ gauge: null, stageWord: "Draft" });
    expect(container.querySelector("[data-gauge]")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("with its result page: a link named for the chat, described by what the number measures", () => {
    renderRow();
    const link = screen.getByRole("link", { name: "Open the result: Hook formats, the $400 test" });
    expect(link).toHaveAttribute("href", "/simulation/hook/c1/k1");
    expect(link).toHaveAccessibleDescription("66% would stop to watch");
    expect(link).toHaveTextContent("66");
  });

  it("a video's number says what it measures", () => {
    renderRow({ lead: "video", gauge: { number: 38, describes: "38% watch to the end", href: "/simulation/a1" } });
    expect(screen.getByRole("link", { name: "Open the result: Hook formats, the $400 test" })).toHaveAccessibleDescription(
      "38% watch to the end",
    );
  });

  it("without a result page: a plain picture of the number, not a control", () => {
    renderRow({ gauge: { number: 38, describes: "38% watch to the end", href: null } });
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByRole("img", { name: "38% watch to the end" })).toHaveTextContent("38");
  });

  it("a tap on the gauge opens the result, not the chat", () => {
    const { onOpen } = renderRow();
    fireEvent.click(screen.getByRole("link", { name: "Open the result: Hook formats, the $400 test" }));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("the gauge sits outside the row's button", () => {
    renderRow();
    const rowButton = screen.getByRole("button", { name: "Hook formats, the $400 test" });
    expect(rowButton.contains(screen.getByRole("link"))).toBe(false);
  });
});

// ─── After posting (plan 2026-11-24-after-posting, Task 4) ───────────────────

describe("ChatRow — a posted chat (ruling 30: the line by width)", () => {
  const POSTED: Partial<ChatRowData> = {
    title: "Stop buying snacks, do this",
    line: "3 hooks · posted 4d ago",
    stageWord: "Posted",
    posted: {
      phone: { lead: "Posted 4d ago", rest: "31K views", numbers: true, mark: { text: "1.8× your usual", tone: "above" } },
      cell: { top: "31K views", under: "1.8× your usual", tone: "above" },
    },
  };
  const NAME = "Stop buying snacks, do this";
  const phoneLineOf = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-part="phone-line"]')!;
  const deskLineOf = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-part="desk-line"]')!;
  const usualOf = (container: HTMLElement) => phoneLineOf(container).querySelector<HTMLElement>('[data-part="usual"]');
  const cellOf = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-part="after"]')!;
  /** Every element of the row that carries one of the two "against your usual" colours. */
  const coloured = (container: HTMLElement) => Array.from(container.querySelectorAll(".text-above, .text-below-text"));
  const width = (view: "phone" | "desk") => onTestFinished(atWidth(view));

  it("on a phone a reader hears the posted words and the mark, once", () => {
    width("phone");
    renderRow(POSTED);
    expect(screen.getByRole("button", { name: NAME })).toHaveAccessibleDescription("Posted 4d ago · 31K views 1.8× your usual");
  });

  it("from 768 the line is what the row said before, with posted for simulated; the numbers and the mark are the column's, heard there once", () => {
    width("desk");
    const { container } = renderRow(POSTED);
    expect(screen.getByRole("button", { name: NAME })).toHaveAccessibleDescription("3 hooks · posted 4d ago");
    expect(deskLineOf(container)).toHaveTextContent(/^3 hooks · posted 4d ago$/);
    // The column is not hidden from a reader any more: it is where the numbers are said.
    expect(cellOf(container)).not.toHaveAttribute("aria-hidden");
    expect(cellOf(container).textContent).toBe("31K views1.8× your usual");
    // No copy of the mark for a screen reader only, anywhere in the row.
    expect(container.querySelector(".sr-only, [class*='sr-only']")?.textContent ?? "").not.toContain("your usual");
  });

  it("the two forms switch at 768: the phone's under it, the desk's from it", () => {
    const { container } = renderRow(POSTED);
    expect(phoneLineOf(container)).toHaveClass("md:hidden");
    expect(deskLineOf(container)).toHaveClass("max-md:hidden");
    // The line: wraps on a phone, one line cut from 768.
    const classes = container.querySelector('[id$="-line"]')!.className.split(/\s+/);
    expect(classes).not.toContain("truncate");
    expect(classes).toContain("md:truncate");
  });

  it("the numbers are one unbroken piece; so are the posted words before them", () => {
    const { container } = renderRow({ ...POSTED, posted: { ...POSTED.posted!, phone: { lead: "Posted 5h ago", rest: "54.8K views so far", numbers: true, mark: null } } });
    const pieces = Array.from(phoneLineOf(container).querySelectorAll<HTMLElement>('[data-part="piece"]'));
    expect(pieces.map((piece) => piece.textContent?.replace(/·/g, "").replace(/\s+/g, " ").trim())).toEqual(["Posted 5h ago", "54.8K views so far"]);
    for (const piece of pieces) expect(piece).toHaveClass("whitespace-nowrap");
  });

  it("no \"·\" is ever left at the end of a line, or at its start: each piece carries its own, which the line cuts off where the piece starts a line", () => {
    const { container } = renderRow(POSTED);
    const pieces = Array.from(phoneLineOf(container).querySelectorAll<HTMLElement>('[data-part="piece"]'));
    for (const piece of pieces) {
      const dot = piece.firstElementChild!;
      expect(dot).toHaveTextContent(/^·$/);
      // A 14 wide box at the piece's start…
      expect(dot).toHaveClass("inline-block", "w-3.5");
      expect(dot).toHaveAttribute("aria-hidden", "true");
    }
    // …and the pieces stand 14 to the left inside a box that cuts off what is outside it: a piece at the
    // start of a line has its "·" outside.
    const shifted = pieces[0]!.parentElement!;
    expect(shifted).toHaveClass("-ml-3.5");
    expect(shifted.parentElement).toHaveClass("overflow-hidden");
    // Nowhere else a "·" in the phone's line: none before the mark.
    const dots = phoneLineOf(container).textContent!.match(/·/g) ?? [];
    expect(dots).toHaveLength(pieces.length + 1); // each piece's own, and the reader's " · " between them
  });

  it("the mark stands on its own line under the words, with no separator before it, one unbroken piece in its tone's colour", () => {
    const { container } = renderRow(POSTED);
    const usual = usualOf(container)!;
    expect(usual.textContent).toBe("1.8× your usual");
    expect(usual).toHaveClass("block", "whitespace-nowrap", "text-above");
    expect(usual.previousElementSibling?.textContent).not.toMatch(/·\s*$/);
  });

  it("coral below the usual; around it, the line's own colour", () => {
    const below = renderRow({ ...POSTED, posted: { phone: { ...POSTED.posted!.phone, mark: { text: "0.4× your usual", tone: "below" } }, cell: { top: "3.1K views", under: "0.4× your usual", tone: "below" } } });
    expect(usualOf(below.container)).toHaveClass("whitespace-nowrap", "text-below-text");
    cleanup();
    const around = renderRow({ ...POSTED, posted: { phone: { ...POSTED.posted!.phone, mark: { text: "1× your usual", tone: "around" } }, cell: { top: "31K views", under: "1× your usual", tone: "around" } } });
    expect(usualOf(around.container)).toHaveClass("whitespace-nowrap");
    expect(coloured(around.container)).toEqual([]);
  });

  it("nothing else in the row changes colour: only the mark and the column's under line", () => {
    const { container } = renderRow(POSTED);
    const [mark, under] = coloured(container);
    expect(coloured(container)).toHaveLength(2);
    expect(phoneLineOf(container).contains(mark!)).toBe(true);
    expect(cellOf(container).contains(under!)).toBe(true);
  });

  it("reading, on a phone: the state's words, wrapping as words, no pieces, no mark", () => {
    width("phone");
    const reading = renderRow({ ...POSTED, line: "3 hooks · posted", posted: { phone: { lead: "Posted", rest: "reading the post", numbers: false, mark: null }, cell: { top: "Reading", under: null, tone: null } } });
    expect(screen.getByRole("button", { name: NAME })).toHaveAccessibleDescription("Posted · reading the post");
    expect(phoneLineOf(reading.container).querySelector('[data-part="piece"]')).toBeNull();
    expect(usualOf(reading.container)).toBeNull();
  });

  it("not read, from 768: \"3 hooks · posted\" (the column says Not read)", () => {
    width("desk");
    renderRow({ ...POSTED, line: "3 hooks · posted", posted: { phone: { lead: "Posted", rest: "couldn't read the post", numbers: false, mark: null }, cell: { top: "Not read", under: null, tone: null } } });
    expect(screen.getByRole("button", { name: NAME })).toHaveAccessibleDescription("3 hooks · posted");
  });

  it("so far, no mark: the line alone, uncoloured", () => {
    width("phone");
    const { container } = renderRow({ ...POSTED, posted: { phone: { lead: "Posted 1d ago", rest: "12.4K views so far", numbers: true, mark: null }, cell: { top: "12.4K views", under: "so far", tone: null } } });
    expect(screen.getByRole("button", { name: NAME })).toHaveAccessibleDescription("Posted 1d ago · 12.4K views so far");
    expect(coloured(container)).toEqual([]);
  });

  it("a pinned posted chat: the pin leads both forms, and the reader still hears Pinned first", () => {
    width("phone");
    const { container } = renderRow({ ...POSTED, pinned: true });
    expect(phoneLineOf(container).querySelector('[data-part="pin"]')).not.toBeNull();
    expect(deskLineOf(container).querySelector('[data-part="pin"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: NAME })).toHaveAccessibleDescription("Pinned, Posted 4d ago · 31K views 1.8× your usual");
  });

  it("the stage word is Posted; the gauge is still what Maven said", () => {
    renderRow(POSTED);
    expect(within(screen.getByRole("button", { name: NAME })).getByText("Posted")).toHaveClass("hidden", "md:block");
    expect(screen.getByRole("link", { name: `Open the result: ${NAME}` })).toHaveAccessibleDescription("66% would stop to watch");
  });

  it("the desktop column: the views in the row's weight, under them the usual, small, in its tone; hidden on the phone", () => {
    const { container } = renderRow(POSTED);
    const cell = cellOf(container);
    expect(cell).toHaveClass("hidden", "md:block");
    const [top, under] = Array.from(cell.children);
    expect(top).toHaveTextContent(/^31K views$/);
    expect(top).toHaveClass("text-ui", "text-foreground");
    expect(top!.className).not.toMatch(/font-\[?[56]/);
    expect(under).toHaveTextContent(/^1\.8× your usual$/);
    expect(under).toHaveClass("text-meta", "text-above");
  });

  it("the column's \"so far\" is quiet ink; Reading and Not read stand alone", () => {
    const soFar = renderRow({ ...POSTED, posted: { phone: { lead: "Posted 1d ago", rest: "12.4K views so far", numbers: true, mark: null }, cell: { top: "12.4K views", under: "so far", tone: null } } });
    const under = cellOf(soFar.container).children[1]!;
    expect(under).toHaveTextContent(/^so far$/);
    expect(under).toHaveClass("text-meta", "text-foreground-secondary");
    expect(coloured(soFar.container)).toEqual([]);
    cleanup();
    const reading = renderRow({ ...POSTED, line: "3 hooks · posted", posted: { phone: { lead: "Posted", rest: "reading the post", numbers: false, mark: null }, cell: { top: "Reading", under: null, tone: null } } });
    expect(cellOf(reading.container).children).toHaveLength(1);
    expect(cellOf(reading.container)).toHaveTextContent(/^Reading$/);
  });

  it("a chat with no posted piece leaves the column empty (it keeps its place in the table), and its line is as before", () => {
    const { container } = renderRow();
    expect(cellOf(container)).toBeEmptyDOMElement();
    expect(cellOf(container)).toHaveClass("hidden", "md:block");
    expect(container.querySelector('[data-part="phone-line"]')).toBeNull();
  });

  it("the column sits after the gauge and before the menu, outside the row's button", () => {
    const { container } = renderRow(POSTED, <button type="button">More</button>);
    const cell = cellOf(container);
    const gauge = container.querySelector('[data-part="gauge"]')!;
    expect(gauge.compareDocumentPosition(cell) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(cell.compareDocumentPosition(screen.getByRole("button", { name: "More" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("button", { name: NAME }).contains(cell)).toBe(false);
    expect(cell).toHaveClass("pointer-events-none");
  });

  it.each(["phone", "desk"] as const)("has no axe violations (%s)", async (view) => {
    width(view);
    const { container } = renderRow(POSTED, <button type="button">More</button>);
    // @ts-expect-error -- vitest-axe matcher type augmentation not picked up
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("ChatRow — the table's columns (after posting)", () => {
  // The card's own width picks them (`@container` on Library's card), as the result pages do: the
  // sidebar's width varies. Under 720 inside: tight columns, the title keeps what is left; from 720:
  // the roomier ones. Both: tile, title, Stage, Simulated, After posting (and More).
  it("with More: six columns, from the card's width", () => {
    const { container } = renderRow({}, <button type="button">More</button>);
    const li = container.querySelector("li")!;
    expect(li).toHaveClass(
      "md:@max-[720px]:grid-cols-[44px_minmax(0,1fr)_72px_60px_92px_38px]",
      "md:@min-[720px]:grid-cols-[56px_minmax(0,1fr)_104px_84px_128px_44px]",
      "md:@max-[720px]:gap-x-3",
      "md:@min-[720px]:gap-x-3.5",
    );
  });

  it("without More: the same five", () => {
    const { container } = renderRow();
    expect(container.querySelector("li")).toHaveClass(
      "md:@max-[720px]:grid-cols-[44px_minmax(0,1fr)_72px_60px_92px]",
      "md:@min-[720px]:grid-cols-[56px_minmax(0,1fr)_104px_84px_128px]",
    );
  });
});
